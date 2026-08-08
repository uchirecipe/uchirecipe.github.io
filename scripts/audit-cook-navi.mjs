/**
 * 並行調理ナビの診断（2026-08-08 便p85/navi-audit）。
 *
 * オーナー問題提起「今の仕組みでは、ユーザーが登録したレシピでは並行ナビが破綻すると思います」を、
 * 憶測でなく数字で確かめるための計測スクリプト。**アプリの挙動は一切変えない**（読むだけ）。
 *
 * 実行: npx tsx scripts/audit-cook-navi.mjs            … 数値のサマリだけ
 *       npx tsx scripts/audit-cook-navi.mjs --dump     … 生成された段取りの全文も出す
 *
 * 測るもの:
 *   1. 待ち工程の検出率（手順のうち何%が「待ち」と判定されたか）
 *   2. 並行の効果（1品ずつ順に作った合計時間に対して何%短縮できたか）
 *   3. 付きっきりの誤判定（人の答え合わせに対する取りこぼし・危険な誤判定）
 *   4. 材料突き合わせの命中率（手順に分量が出た割合・材料欄の網羅率）
 *   5. 段階分けの成否（準備→加熱→仕上げの分類率・'other'に落ちた率）
 *   6. 所要時間の推定の妥当性（minutes無しの手順を一律4分とみなす影響）
 *
 * 比較対象:
 *   同梱109品（src/db/starters.ts。minutes・memo・材料表記が整っている）
 *   vs 「野生のレシピ」標本（scripts/data/navi-wild-recipes.mjs をURL取込/貼り付けの実装に通したもの）
 */
import {
  classifyStep,
  resolveStepMinutes,
  resolveWaitMinutes,
  buildCookPlan,
  cutOrderRank,
  isHandsOnStep,
  stepCategory,
  stepStageRank,
  buildCookTimeline,
  WAIT_VERB_PATTERNS,
  DEFAULT_ACTIVE_MINUTES,
} from '../src/logic/cookNavi.ts'
import { findTimeTokens } from '../src/logic/time.ts'
import { stepIngredientAmounts } from '../src/logic/naviIngredients.ts'
import { parseRecipeText } from '../src/logic/parseRecipeText.ts'
import { buildImportedIngredientRows, filterImportedSteps } from '../src/logic/urlImportRows.ts'
import { starterDefs } from '../src/db/starters.ts'
import { urlSamples, pasteSamples, manualSamples } from './data/navi-wild-recipes.mjs'
import {
  urlSamples as holdoutUrlSamples,
  pasteSamples as holdoutPasteSamples,
  manualSamples as holdoutManualSamples,
} from './data/navi-holdout-recipes.mjs'

const DUMP = process.argv.includes('--dump')

// ---------------------------------------------------------------- 標本づくり

let nextId = 1
/** 計測に必要なところだけ持つレシピ（Recipe と同じ形。buildCookTimeline は id/title/steps を見る） */
function makeRecipe({ title, servings, cookMinutes, ingredients, steps, truth, realWaits, realMinutes, group }) {
  return {
    id: nextId++,
    title,
    servings: servings ?? 2,
    cookMinutes,
    effortLevel: 'normal',
    tags: [],
    ingredients,
    steps,
    isFavorite: false,
    cookedLogs: [],
    createdAt: 0,
    updatedAt: 0,
    // 診断用の付帯情報（アプリの型には無い。計測でしか使わない）
    _truth: truth,
    _realWaits: realWaits ?? [],
    _realMinutes: realMinutes,
    _group: group,
  }
}

/** 同梱109品 */
const starterRecipes = starterDefs.map((d) =>
  makeRecipe({
    title: d.title,
    servings: d.servings,
    cookMinutes: d.cookMinutes,
    ingredients: d.ingredients,
    steps: d.steps,
    realMinutes: d.cookMinutes,
    group: '同梱109品',
  }),
)

/** A: URL取り込み。Worker応答→フォーム行→保存レシピ、と実装と同じ順で通す（minutes/memoは付かない） */
const buildUrlRecipes = (samples, group) =>
  samples.map((s) => {
    const rows = buildImportedIngredientRows(s.ingredients.map((i) => ({ name: i.name, amount: i.amount })))
    const steps = filterImportedSteps(s.steps).map((text) => ({ text }))
    return makeRecipe({
      title: s.title,
      servings: s.servings,
      cookMinutes: s.cookMinutes,
      ingredients: rows.map((r) => ({ name: r.name, amount: r.amount, unit: r.unit, memo: r.memo })),
      steps,
      truth: s.truth,
      realWaits: s.realWaits,
      realMinutes: s.realMinutes,
      group,
    })
  })

/** B: 貼り付け取り込み。生テキストを parseRecipeText に通した結果をそのまま使う */
const buildPasteRecipes = (samples, group) =>
  samples.map((s) => {
    const parsed = parseRecipeText(s.raw)
    return makeRecipe({
      title: parsed.title ?? s.id,
      servings: parsed.servings ?? 2,
      cookMinutes: parsed.cookMinutes,
      ingredients: parsed.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, memo: i.memo })),
      steps: parsed.steps.map((text) => ({ text })),
      truth: s.truth,
      realWaits: s.realWaits,
      realMinutes: s.realMinutes,
      group,
    })
  })

/** C: 手入力（短い手順・minutes無し・memo無し） */
const buildManualRecipes = (samples, group) =>
  samples.map((s) =>
    makeRecipe({
      title: s.title,
      servings: s.servings,
      ingredients: s.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })),
      steps: s.steps.map((text) => ({ text })),
      truth: s.truth,
      realWaits: s.realWaits,
      realMinutes: s.realMinutes,
      group,
    }),
  )

const aRecipes = buildUrlRecipes(urlSamples, 'A: URL取込')
const bRecipes = buildPasteRecipes(pasteSamples, 'B: 貼り付け取込')
const cRecipes = buildManualRecipes(manualSamples, 'C: 手入力')

// ホールドアウト標本（docs/68 合格ライン「合格の追加条件」。修繕後に書き下ろした初見の9品）
const haRecipes = buildUrlRecipes(holdoutUrlSamples, 'ホA: URL取込')
const hbRecipes = buildPasteRecipes(holdoutPasteSamples, 'ホB: 貼り付け取込')
const hcRecipes = buildManualRecipes(holdoutManualSamples, 'ホC: 手入力')

const groups = [
  { key: '同梱109品', recipes: starterRecipes },
  { key: 'A: URL取込', recipes: aRecipes },
  { key: 'B: 貼り付け取込', recipes: bRecipes },
  { key: 'C: 手入力', recipes: cRecipes },
]

const holdoutGroups = [
  { key: 'ホA: URL取込', recipes: haRecipes },
  { key: 'ホB: 貼り付け取込', recipes: hbRecipes },
  { key: 'ホC: 手入力', recipes: hcRecipes },
]

// ---------------------------------------------------------------- 1レシピの計測

const pct = (num, den) => (den === 0 ? 0 : (num / den) * 100)
const f1 = (n) => (Math.round(n * 10) / 10).toFixed(1)

function measureRecipe(r) {
  const steps = r.steps
  const kinds = steps.map((s) => classifyStep(s))
  const cats = steps.map((s) => stepCategory(s))
  const waitCount = kinds.filter((k) => k === 'wait').length
  const activeSteps = steps.filter((s, i) => kinds[i] === 'active')
  const activeNoMinutes = activeSteps.filter((s) => !(s.minutes != null && s.minutes > 0)).length
  const explicitMinutes = steps.filter((s) => s.minutes != null && s.minutes > 0).length
  const withMemo = steps.filter((s) => (s.memo ?? '').trim() !== '').length
  const otherCount = cats.filter((c) => c === 'other').length

  // 材料突き合わせ
  const matchedNames = new Set()
  let stepsWithAmount = 0
  const stepMatches = steps.map((s) => {
    const hits = stepIngredientAmounts(s.text, r.ingredients, r.servings, r.servings)
    if (hits.length > 0) stepsWithAmount++
    for (const h of hits) matchedNames.add(h.name)
    return hits
  })

  // 待ち動詞は有るのに分数が分からず手作業に落ちた手順（＝あと一歩で待ちにできた手順）
  const waitVerbNoTime = steps.filter(
    (s, i) => kinds[i] === 'active' && !isHandsOnStep(s) && /煮|蒸|漬|炊|茹で|ゆで|冷ま|冷や|粗熱|寝かせ|浸|さらす|温め|オーブン|レンジ|発酵|なじ|しみ|置い|おく/.test(s.text) && resolveStepMinutes(s) == null,
  ).length

  // 危険側の目視候補: 待ちと判定されたのに本文のどこかに「焼く/炒め/揚げ」がある
  const riskyWaits = steps.filter((s, i) => kinds[i] === 'wait' && /焼|炒め|炒る|揚げ/.test(s.text))

  const solo = buildCookTimeline([r]).totalMinutes
  const detectedWaitMinutes = steps.reduce(
    (sum, s, i) => sum + (kinds[i] === 'wait' ? (resolveWaitMinutes(s) ?? 0) : 0),
    0,
  )
  const realWaitMinutes = (r._realWaits ?? []).reduce((a, w) => a + w.minutes, 0)

  return {
    recipe: r,
    kinds,
    cats,
    stepMatches,
    stepCount: steps.length,
    waitCount,
    explicitMinutes,
    withMemo,
    otherCount,
    activeCount: activeSteps.length,
    activeNoMinutes,
    stepsWithAmount,
    ingredientCount: r.ingredients.length,
    matchedIngredients: matchedNames.size,
    waitVerbNoTime,
    riskyWaits,
    solo,
    detectedWaitMinutes,
    realWaitMinutes,
    realWaitCount: (r._realWaits ?? []).length,
  }
}

const measures = new Map()
for (const g of [...groups, ...holdoutGroups]) for (const r of g.recipes) measures.set(r.id, measureRecipe(r))

// ---------------------------------------------------------------- 組み合わせ（3品）の計測

/** 決まった順で毎回同じ組み合わせを作る簡易乱数（診断結果を再現可能にするため） */
function lcg(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}

function allTriples(list) {
  const out = []
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      for (let k = j + 1; k < list.length; k++) out.push([list[i], list[j], list[k]])
  return out
}

function sampleTriples(list, count, seed) {
  const rnd = lcg(seed)
  const seen = new Set()
  const out = []
  let guard = 0
  while (out.length < count && guard++ < count * 50) {
    const idx = []
    while (idx.length < 3) {
      const n = Math.floor(rnd() * list.length)
      if (!idx.includes(n)) idx.push(n)
    }
    idx.sort((a, b) => a - b)
    const key = idx.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(idx.map((n) => list[n]))
  }
  return out
}

function measureTriple(trio) {
  const timeline = buildCookTimeline(trio)
  // 画面に出る形（並行の段取り／1品ずつ順に作る正直表示）はアプリと同じ関数で決める
  const plan = buildCookPlan(trio)
  const solos = trio.map((r) => measures.get(r.id).solo)
  const seq = solos.reduce((a, b) => a + b, 0)
  const lower = Math.max(...solos)
  const par = timeline.totalMinutes
  return {
    trio,
    timeline,
    seq,
    par,
    lower,
    gainPct: pct(seq - par, seq),
    idealGainPct: pct(seq - lower, seq),
    honest: plan.mode === 'sequential',
    waitSteps: timeline.items.filter((it) => it.kind === 'wait').length,
    steps: timeline.items.length,
  }
}

function summarizeTriples(triples) {
  const rows = triples.map(measureTriple)
  const gains = rows.map((r) => r.gainPct)
  const zero = gains.filter((g) => g < 0.5).length
  const under5 = gains.filter((g) => g < 5).length
  return {
    n: rows.length,
    avgGain: gains.reduce((a, b) => a + b, 0) / rows.length,
    minGain: Math.min(...gains),
    maxGain: Math.max(...gains),
    zeroRate: pct(zero, rows.length),
    under5Rate: pct(under5, rows.length),
    honestRate: pct(rows.filter((r) => r.honest).length, rows.length),
    avgIdeal: rows.reduce((a, r) => a + r.idealGainPct, 0) / rows.length,
    avgSeq: rows.reduce((a, r) => a + r.seq, 0) / rows.length,
    avgPar: rows.reduce((a, r) => a + r.par, 0) / rows.length,
    rows,
  }
}

// ------------------------------------------------- 打ち手のシミュレーション（アプリは変更しない）

/**
 * アプリの buildCookTimeline（貪欲法）を、**判定だけ差し替えられる形**でこのスクリプト内に再現したもの。
 * 打ち手を入れたら段取りがどれだけ良くなるかを、コードを書き換えずに見積もるために使う。
 * 「差し替えなし」で走らせたときに本物と1分もずれないことを起動時に自己検証する（下の verifySim）。
 */
function simulateTimeline(recipes, opt) {
  const jobs = recipes
    .filter((r) => r.steps.length > 0)
    .map((r, colorIndex) => {
      const steps = (opt.splitSteps ? splitLongSteps(r.steps) : r.steps).map((s, i) => {
        const kind = opt.classify(s)
        const waitMinutes = kind === 'wait' ? (opt.waitMinutes(s) ?? 0) : 0
        const activeMinutes =
          kind === 'active' ? (s.minutes != null && s.minutes > 0 ? s.minutes : DEFAULT_ACTIVE_MINUTES) : 0
        return {
          i,
          kind,
          waitMinutes,
          activeMinutes,
          category: stepCategory(s),
          stageRank: stepStageRank(s),
          cutRank: cutOrderRank(s),
          text: s.text,
        }
      })
      return { colorIndex, steps, ptr: 0, readyAt: 0, title: r.title }
    })

  const remainingSpan = (j) => {
    let t = 0
    for (let i = j.ptr; i < j.steps.length; i++)
      t += j.steps[i].kind === 'wait' ? j.steps[i].waitMinutes : j.steps[i].activeMinutes
    return t
  }

  let cookAt = 0
  let total = 0
  let lastActiveCategory = null
  const items = []
  while (jobs.some((j) => j.ptr < j.steps.length)) {
    const active = jobs.filter((j) => j.ptr < j.steps.length)
    let ready = active.filter((j) => j.readyAt <= cookAt)
    if (ready.length === 0) {
      cookAt = Math.min(...active.map((j) => j.readyAt))
      ready = active.filter((j) => j.readyAt <= cookAt)
    }
    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    let chosen
    if (waits.length > 0) {
      waits.sort((a, b) => b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes || a.colorIndex - b.colorIndex)
      chosen = waits[0]
    } else {
      const sameCat = (j) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
      chosen = ready.slice().sort((a, b) => {
        const stepA = a.steps[a.ptr]
        const stepB = b.steps[b.ptr]
        // 切る工程どうしは、まな板の順序（野菜→肉・魚）を先に見る（アプリ本体と同じ規則）
        if (stepA.category === 'cut' && stepB.category === 'cut' && stepA.cutRank !== stepB.cutRank) {
          return stepA.cutRank - stepB.cutRank
        }
        return (
          remainingSpan(b) - remainingSpan(a) ||
          stepA.stageRank - stepB.stageRank ||
          sameCat(a) - sameCat(b) ||
          a.colorIndex - b.colorIndex
        )
      })[0]
    }
    const step = chosen.steps[chosen.ptr]
    const startMin = cookAt
    let endMin
    if (step.kind === 'wait') {
      endMin = startMin + step.waitMinutes
      chosen.readyAt = endMin
    } else {
      endMin = startMin + step.activeMinutes
      cookAt = endMin
      chosen.readyAt = endMin
      lastActiveCategory = step.category
    }
    total = Math.max(total, endMin)
    items.push({ title: chosen.title, kind: step.kind, waitMinutes: step.waitMinutes, text: step.text })
    chosen.ptr++
  }
  return { totalMinutes: total, items }
}

/** 打ち手なし（＝いまのアプリと同じ判定。便EDの修繕後はこれが「修繕後の実装」になる） */
const BASELINE = {
  classify: classifyStep,
  waitMinutes: resolveWaitMinutes,
  splitSteps: false,
}

/**
 * 打ち手2で追加する待ち動詞（現行の WAIT_VERB_PATTERNS に無い、家庭の書き方でよく出る言い回し）。
 * 値は「時間が書かれていなかったときに当てる既定の分数」。
 */
const EXTRA_WAIT_VERBS = [
  { re: /沸か|沸騰させ|湯を沸/, minutes: 5 }, // 湯を沸かす
  { re: /もどす|もどし|戻す|戻し/, minutes: 15 }, // 乾物をもどす
  { re: /解凍/, minutes: 30 },
  { re: /冷蔵庫に入れ|冷蔵庫で/, minutes: 30 },
  { re: /ふたをして|フタをして|蓋をして/, minutes: 8 }, // ふたをして火にかける＝多くは放置工程
]

/** 現行辞書＋追加辞書のどれかに当たるか */
function hasAnyWaitVerb(text, extended) {
  if (WAIT_VERB_PATTERNS.some((re) => re.test(text))) return true
  return extended ? EXTRA_WAIT_VERBS.some((v) => v.re.test(text)) : false
}

/** 時間表記が無い待ち工程に当てる既定分数（動詞ごと） */
const DEFAULT_WAIT_BY_VERB = [
  { re: /解凍/, minutes: 30 },
  { re: /炊/, minutes: 30 },
  { re: /漬|浸/, minutes: 20 },
  { re: /寝かせ|寝かし|ねかせ|休ませ/, minutes: 20 },
  { re: /もどす|もどし|戻す|戻し/, minutes: 15 },
  { re: /オーブン|グリル/, minutes: 15 },
  { re: /冷ま|冷や|粗熱|冷蔵/, minutes: 10 },
  { re: /煮/, minutes: 10 },
  { re: /茹で|ゆで/, minutes: 8 },
  { re: /蒸/, minutes: 8 },
  { re: /ふたをして|フタをして|蓋をして/, minutes: 8 },
  { re: /沸か|沸騰させ/, minutes: 5 },
  { re: /発酵/, minutes: 40 },
  { re: /レンジ|チンす|チンし/, minutes: 3 },
]
const FALLBACK_WAIT_MINUTES = 10

function estimatedWaitMinutes(step, extended) {
  const explicit = resolveStepMinutes(step)
  if (explicit != null) return explicit
  const hit = DEFAULT_WAIT_BY_VERB.find((v) => v.re.test(step.text))
  if (hit) return hit.minutes
  return extended ? FALLBACK_WAIT_MINUTES : undefined
}

/** 打ち手1: 時間の書いていない待ち工程に既定分数を当てる（辞書は現行のまま） */
const PLAN1 = {
  classify: (s) => (isHandsOnStep(s) ? 'active' : hasAnyWaitVerb(s.text, false) ? 'wait' : 'active'),
  waitMinutes: (s) => estimatedWaitMinutes(s, true),
  splitSteps: false,
}

/** 打ち手2: 打ち手1＋待ち動詞辞書の拡張（沸かす・もどす・解凍・ふたをして 等） */
const PLAN2 = {
  classify: (s) => (isHandsOnStep(s) ? 'active' : hasAnyWaitVerb(s.text, true) ? 'wait' : 'active'),
  waitMinutes: (s) => estimatedWaitMinutes(s, true),
  splitSteps: false,
}

/** 長すぎる手順を句点で分ける（貼り付けの一段落レシピ対策）。80字以上かつ句点2つ以上のものだけ */
function splitLongSteps(steps) {
  const out = []
  for (const s of steps) {
    const sentences = s.text.split(/(?<=。)/).filter((t) => t.trim() !== '')
    if (s.text.length >= 80 && sentences.length >= 2) {
      for (const t of sentences) out.push({ text: t.trim(), memo: s.memo })
    } else out.push(s)
  }
  return out
}

/** 打ち手3: 打ち手2＋長文手順の文分割 */
const PLAN3 = { ...PLAN2, splitSteps: true }

/**
 * 打ち手4（安全版）: 打ち手2の「時間の穴埋め」は入れるが、
 *   (a) 手順の**最後に来る動作**が待ち動詞のときだけ待ちにする（cookNavi が炒め・揚げに使っている
 *       位置ルールを、すべての手作業動作に広げる）
 *   (b)「さっと」「軽く」など短時間の合図がある工程には既定分数を当てない
 * の2つの歯止めを付けたもの。
 */
const ACTION_VERBS =
  /炒め|炒る|揚げ|焼く|焼き|焼い|取る|取り|取っ|加え|入れ|混ぜ|溶き|溶い|溶か|絞る|絞り|絞っ|切る|切り|切っ|盛る|盛り|盛っ|かける|かけて|ふる|ふり|返す|返し|のせ|散ら|和え|あえ|つぶ|こね|まぶ|止め|ぬぐ|添え|よそ|包む|巻く|にぎ|ほぐ/
const SHORT_CUE = /さっと|ざっと|軽く|手早く|素早く/
function lastIdx(text, patterns) {
  let last = -1
  for (const re of patterns) {
    const g = new RegExp(re.source, 'g')
    let m
    while ((m = g.exec(text)) !== null) {
      last = Math.max(last, m.index)
      if (m.index === g.lastIndex) g.lastIndex++
    }
  }
  return last
}
const PLAN4 = {
  classify: (s) => {
    if (isHandsOnStep(s)) return 'active'
    const waitAt = lastIdx(s.text, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERBS.map((v) => v.re)])
    if (waitAt === -1) return 'active'
    if (lastIdx(s.text, [ACTION_VERBS]) > waitAt) return 'active'
    return PLAN4.waitMinutes(s) != null ? 'wait' : 'active'
  },
  waitMinutes: (s) => {
    const explicit = resolveStepMinutes(s)
    if (explicit != null) return explicit
    if (SHORT_CUE.test(s.text)) return undefined
    const hit = DEFAULT_WAIT_BY_VERB.find((v) => v.re.test(s.text))
    return hit ? hit.minutes : FALLBACK_WAIT_MINUTES
  },
  splitSteps: false,
}
/** 打ち手5: 打ち手4（安全版）＋長文手順の文分割 */
const PLAN5 = { ...PLAN4, splitSteps: true }

/**
 * 打ち手6（安全版・改）: 打ち手4の位置ルールを、**分数が書かれていない手順にだけ**適用する。
 * ユーザーが自分で待ち分数を入れた手順（同梱109品はこれが36%）はその意思を尊重して従来どおり待ちにする。
 */
const PLAN6 = {
  classify: (s) => {
    if (isHandsOnStep(s)) return 'active'
    const explicit = s.minutes != null && s.minutes > 0
    const waitAt = lastIdx(s.text, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERBS.map((v) => v.re)])
    if (waitAt === -1) return 'active'
    if (!explicit && lastIdx(s.text, [ACTION_VERBS]) > waitAt) return 'active'
    return PLAN6.waitMinutes(s) != null ? 'wait' : 'active'
  },
  waitMinutes: PLAN4.waitMinutes,
  splitSteps: false,
}


/**
 * 打ち手7（推奨案）: 打ち手6に、実測で分かった誤りの元を2つ塞いだもの。
 *   (c) 既定分数を当てるのは「時間が読める調理法」だけに限る（煮る・ゆでる・蒸す・炊く・漬ける・
 *       オーブン・レンジ・解凍・もどす・沸かす・冷蔵庫で冷やす）。それ以外の待ち動詞
 *       （なじませる・味をしみ込ませる・温める・置く 等）は、時間が書かれていなければ従来どおり手作業のまま
 *   (d) 「〜ておく」（作っておく・溶いておく・混ぜ合わせておく）は待ちにしない。
 *       これは“先に済ませておく”という言い方であって放置時間ではない（同梱109品で実測）
 */
const CONFIDENT_WAIT = [
  { re: /解凍/, minutes: 30 },
  { re: /炊/, minutes: 30 },
  { re: /発酵/, minutes: 40 },
  { re: /漬|浸/, minutes: 20 },
  { re: /もどす|もどし|戻す|戻し/, minutes: 15 },
  { re: /オーブン|グリル/, minutes: 15 },
  { re: /冷蔵庫/, minutes: 30 },
  { re: /煮/, minutes: 10 },
  { re: /茹で|ゆで/, minutes: 8 },
  { re: /蒸/, minutes: 8 },
  { re: /ふたをして|フタをして|蓋をして/, minutes: 8 },
  { re: /沸か|沸騰させ/, minutes: 5 },
  { re: /レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]/, minutes: 3 },
]
/** 「〜ておく／〜ておき／〜ておいて」＝先に済ませる言い方。放置時間ではない */
const TE_OKU = /[てで](?:お|置)[くきい]/
const PLAN7 = {
  classify: (s) => {
    if (isHandsOnStep(s)) return 'active'
    const explicit = s.minutes != null && s.minutes > 0
    const waitAt = lastIdx(s.text, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERBS.map((v) => v.re)])
    if (waitAt === -1) return 'active'
    if (!explicit && lastIdx(s.text, [ACTION_VERBS]) > waitAt) return 'active'
    return PLAN7.waitMinutes(s) != null ? 'wait' : 'active'
  },
  waitMinutes: (s) => {
    const explicit = resolveStepMinutes(s)
    if (explicit != null) return explicit
    if (SHORT_CUE.test(s.text)) return undefined
    if (TE_OKU.test(s.text)) return undefined
    const hit = CONFIDENT_WAIT.find((v) => v.re.test(s.text))
    return hit ? hit.minutes : undefined
  },
  splitSteps: false,
}

/** 自己検証: 差し替えなしのシミュレーションが本物と一致するか */
function verifySim() {
  let bad = 0
  for (const g of groups)
    for (const r of g.recipes) {
      const a = buildCookTimeline([r]).totalMinutes
      const b = simulateTimeline([r], BASELINE).totalMinutes
      if (a !== b) bad++
    }
  const triples = sampleTriples(starterRecipes, 200, 99)
  for (const t of triples) {
    if (buildCookTimeline(t).totalMinutes !== simulateTimeline(t, BASELINE).totalMinutes) bad++
  }
  return bad
}

function planStats(triples, plan) {
  const rows = triples.map((trio) => {
    const seq = trio.reduce((a, r) => a + simulateTimeline([r], plan).totalMinutes, 0)
    const par = simulateTimeline(trio, plan).totalMinutes
    return { seq, par, gain: pct(seq - par, seq) }
  })
  const gains = rows.map((r) => r.gain)
  return {
    avgGain: gains.reduce((a, b) => a + b, 0) / gains.length,
    zeroRate: pct(gains.filter((g) => g < 0.5).length, gains.length),
    avgPar: rows.reduce((a, r) => a + r.par, 0) / rows.length,
  }
}

// ---------------------------------------------------------------- 出力

const out = []
const say = (line = '') => out.push(line)

say('=========================================================')
say(' 並行調理ナビ 診断（アプリの挙動は変更していない・計測のみ）')
say('=========================================================')
say()

// --- 1/5/6: 手順の性質 ---
say('■ 1. 手順の性質と分類（レシピ群ごとの合計）')
say()
say('| レシピ群 | 品数 | 手順数 | minutes有 | memo有 | 待ちと判定 | other分類 | 一律4分の手順 |')
say('|---|---|---|---|---|---|---|---|')
const groupStats = new Map()
for (const g of groups) {
  const ms = g.recipes.map((r) => measures.get(r.id))
  const sum = (f) => ms.reduce((a, m) => a + f(m), 0)
  const stepCount = sum((m) => m.stepCount)
  const st = {
    n: g.recipes.length,
    stepCount,
    explicitMinutes: sum((m) => m.explicitMinutes),
    withMemo: sum((m) => m.withMemo),
    waitCount: sum((m) => m.waitCount),
    otherCount: sum((m) => m.otherCount),
    activeCount: sum((m) => m.activeCount),
    activeNoMinutes: sum((m) => m.activeNoMinutes),
    stepsWithAmount: sum((m) => m.stepsWithAmount),
    ingredientCount: sum((m) => m.ingredientCount),
    matchedIngredients: sum((m) => m.matchedIngredients),
    waitVerbNoTime: sum((m) => m.waitVerbNoTime),
    riskyWaits: ms.flatMap((m) => m.riskyWaits.map((s) => ({ title: m.recipe.title, text: s.text }))),
    detectedWaitMinutes: sum((m) => m.detectedWaitMinutes),
    realWaitMinutes: sum((m) => m.realWaitMinutes),
    realWaitCount: sum((m) => m.realWaitCount),
    ms,
  }
  groupStats.set(g.key, st)
  say(
    `| ${g.key} | ${st.n} | ${stepCount} | ${f1(pct(st.explicitMinutes, stepCount))}% | ${f1(pct(st.withMemo, stepCount))}% | ` +
      `${f1(pct(st.waitCount, stepCount))}% | ${f1(pct(st.otherCount, stepCount))}% | ${f1(pct(st.activeNoMinutes, st.activeCount))}% |`,
  )
}
say()
say('  ※「一律4分の手順」＝手作業と判定された手順のうち、minutes が無いため')
say(`     DEFAULT_ACTIVE_MINUTES=${DEFAULT_ACTIVE_MINUTES}分 と仮定して順番を組んでいる割合。`)
say()

// --- 5: 段階分けの内訳 ---
say('■ 1b. 手順文そのものの形（なぜ待ちが見つからないのかの手掛かり）')
say()
say('| レシピ群 | 平均字数 | 1分以上の時間表記がある手順 | 12字以下の短い手順 | 80字以上の長い手順 | 手順が1つだけの品 |')
say('|---|---|---|---|---|---|')
for (const g of groups) {
  const texts = g.recipes.flatMap((r) => r.steps.map((s) => s.text))
  const withTime = texts.filter((t) => findTimeTokens(t).some((x) => x.seconds >= 60)).length
  const shortS = texts.filter((t) => t.length <= 12).length
  const longS = texts.filter((t) => t.length >= 80).length
  const one = g.recipes.filter((r) => r.steps.length <= 1).length
  say(
    `| ${g.key} | ${Math.round(texts.reduce((a, t) => a + t.length, 0) / texts.length)}字 | ${f1(pct(withTime, texts.length))}% | ` +
      `${f1(pct(shortS, texts.length))}% | ${f1(pct(longS, texts.length))}% | ${one}品 |`,
  )
}
say()

say('■ 5. 段階分け（stepCategory）の内訳')
say()
say('| レシピ群 | cut 切る | wash 下処理 | season 味/成形 | heat 加熱 | finish 仕上げ | other 不明 |')
say('|---|---|---|---|---|---|---|')
for (const g of groups) {
  const ms = groupStats.get(g.key).ms
  const all = ms.flatMap((m) => m.cats)
  const c = (k) => f1(pct(all.filter((x) => x === k).length, all.length)) + '%'
  say(`| ${g.key} | ${c('cut')} | ${c('wash')} | ${c('season')} | ${c('heat')} | ${c('finish')} | ${c('other')} |`)
}
say()

// --- 4: 材料突き合わせ ---
say('■ 4. 材料突き合わせ')
say()
say('| レシピ群 | 分量が出た手順の割合 | 材料欄のうち手順で1度でも拾えた割合 |')
say('|---|---|---|')
for (const g of groups) {
  const st = groupStats.get(g.key)
  say(
    `| ${g.key} | ${f1(pct(st.stepsWithAmount, st.stepCount))}% | ${f1(pct(st.matchedIngredients, st.ingredientCount))}% |`,
  )
}
say()

// --- 3: 答え合わせ（標本のみ） ---
say('■ 3. 付きっきりの判定の答え合わせ（人の判定 vs ナビの判定。標本A/B/Cのみ）')
say()
say('| レシピ群 | 手順数 | 一致 | 見逃し(本当は待ち→手作業) | 危険(本当は手作業→待ち) | 一致率 |')
say('|---|---|---|---|---|---|')
const truthDetail = []
const truthTotal = { ok: 0, missed: 0, dangerous: 0, total: 0 }
for (const g of groups.slice(1)) {
  let ok = 0
  let missed = 0
  let dangerous = 0
  let total = 0
  for (const r of g.recipes) {
    const m = measures.get(r.id)
    const truth = r._truth
    if (!truth || truth.length !== m.kinds.length) {
      truthDetail.push(`  !! ${r.title}: 答え合わせの数が合わない（手順${m.kinds.length} / 答え${truth?.length}）`)
      continue
    }
    truth.forEach((t, i) => {
      total++
      if (t === m.kinds[i]) ok++
      else if (t === 'wait') {
        missed++
        truthDetail.push(`  [見逃し] ${r.title} 手順${i + 1}: ${r.steps[i].text.slice(0, 46)}`)
      } else {
        dangerous++
        truthDetail.push(`  [危険]   ${r.title} 手順${i + 1}: ${r.steps[i].text.slice(0, 46)}`)
      }
    })
  }
  say(`| ${g.key} | ${total} | ${ok} | ${missed} | ${dangerous} | ${f1(pct(ok, total))}% |`)
  truthTotal.ok += ok
  truthTotal.missed += missed
  truthTotal.dangerous += dangerous
  truthTotal.total += total
}
say(
  `| **合計** | ${truthTotal.total} | ${truthTotal.ok} | ${truthTotal.missed} | **${truthTotal.dangerous}** | **${f1(pct(truthTotal.ok, truthTotal.total))}%** |`,
)
say()
for (const line of truthDetail) say(line)
say()

// 待ち時間そのものの取りこぼし
say('■ 3b. 料理として本当にある待ち時間 vs ナビが見つけた待ち時間（標本A/B/C）')
say()
say('| レシピ群 | 本当の待ち回数 | 見つけた待ち回数 | 本当の待ち合計(分) | 見つけた待ち合計(分) | 見つけた割合 |')
say('|---|---|---|---|---|---|')
for (const g of groups.slice(1)) {
  const st = groupStats.get(g.key)
  say(
    `| ${g.key} | ${st.realWaitCount} | ${st.waitCount} | ${st.realWaitMinutes} | ${st.detectedWaitMinutes} | ${f1(pct(st.detectedWaitMinutes, st.realWaitMinutes))}% |`,
  )
}
say()

// 危険候補の一覧
say('■ 3c. 「待ち」と判定されたが本文に焼く/炒め/揚げが含まれる手順（目視候補）')
say()
for (const g of groups) {
  const st = groupStats.get(g.key)
  say(`  ${g.key}: ${st.riskyWaits.length}件`)
  for (const x of st.riskyWaits.slice(0, 12)) say(`    - ${x.title}: ${x.text.slice(0, 60)}`)
}
say()

// --- 6: 所要時間の推定 ---
say('■ 6. 1品だけ作ったときの所要時間の推定（ナビの見積り vs 実際）')
say()
const median = (arr) => {
  const a = arr.slice().sort((x, y) => x - y)
  return a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2
}
say('| レシピ群 | ナビ見積り平均(分) | 実際の平均(分) | 平均誤差(分) | 誤差率の中央値 | 誤差3割超の品 | 最悪の誤差 |')
say('|---|---|---|---|---|---|---|')
for (const g of groups) {
  const ms = groupStats.get(g.key).ms.filter((m) => m.recipe._realMinutes != null)
  if (ms.length === 0) continue
  const errs = ms.map((m) => m.solo - m.recipe._realMinutes)
  const rel = ms.map((m) => Math.abs(m.solo - m.recipe._realMinutes) / m.recipe._realMinutes)
  const worst = ms.reduce((a, m) =>
    Math.abs(m.solo - m.recipe._realMinutes) > Math.abs(a.solo - a.recipe._realMinutes) ? m : a,
  )
  say(
    `| ${g.key} | ${f1(ms.reduce((a, m) => a + m.solo, 0) / ms.length)} | ${f1(ms.reduce((a, m) => a + m.recipe._realMinutes, 0) / ms.length)} | ` +
      `${f1(errs.reduce((a, b) => a + b, 0) / errs.length)} | ${f1(median(rel) * 100)}% | ${f1(pct(rel.filter((x) => x > 0.3).length, rel.length))}% | ` +
      `${worst.recipe.title} 見積${worst.solo}分 / 実際${worst.recipe._realMinutes}分 |`,
  )
}
say()
say('  ※同梱109品の「実際」は cookMinutes（レシピに書かれた調理時間）。冷凍・冷蔵で数時間おく品は')
say('     cookMinutes に待ち時間を含めていないため、見積りが大きく出る（ナビの誤りではなく定義の差）。')
say()

// --- 2: 並行の効果 ---
say('■ 2. 並行の効果（3品の組み合わせ）')
say()
const comboSets = [
  { key: '同梱109品（無作為500通り）', triples: sampleTriples(starterRecipes, 500, 20260808) },
  { key: 'A: URL取込（全20通り）', triples: allTriples(aRecipes) },
  { key: 'B: 貼り付け取込（全20通り）', triples: allTriples(bRecipes) },
  { key: 'C: 手入力（全20通り）', triples: allTriples(cRecipes) },
  {
    key: '野生の混合A+B+C（無作為200通り）',
    triples: sampleTriples([...aRecipes, ...bRecipes, ...cRecipes], 200, 424242),
  },
]
say('| 組み合わせ | 通り数 | 順に作る平均(分) | ナビの平均(分) | 平均短縮率 | 短縮ゼロの割合 | 短縮5%未満の割合 | 正直表示になった割合 | 理論上の最大短縮率 |')
say('|---|---|---|---|---|---|---|---|---|')
const comboSummaries = new Map()
for (const c of comboSets) {
  const s = summarizeTriples(c.triples)
  comboSummaries.set(c.key, s)
  say(
    `| ${c.key} | ${s.n} | ${f1(s.avgSeq)} | ${f1(s.avgPar)} | ${f1(s.avgGain)}% | ${f1(s.zeroRate)}% | ${f1(s.under5Rate)}% | ${f1(s.honestRate)}% | ${f1(s.avgIdeal)}% |`,
  )
}
say()
say('  ※「順に作る」＝3品を1品ずつ最後まで作った場合の合計。「理論上の最大短縮率」＝いちばん時間の')
say('     かかる1品の時間まで縮められたと仮定した上限（＝これ以上は物理的に縮まない）。')
say()

// --- 2b: 待ちがゼロの品 ---
say('■ 2b. 「待ちが1つも見つからない品」の割合（＝その品は並行の材料にならない）')
say()
say('| レシピ群 | 品数 | 待ちゼロの品 | 割合 | 打ち手7を入れた場合 |')
say('|---|---|---|---|---|')
for (const g of groups) {
  const ms = groupStats.get(g.key).ms
  const zero = ms.filter((m) => m.waitCount === 0).length
  const zero7 = g.recipes.filter((r) => r.steps.every((s) => PLAN7.classify(s) !== 'wait')).length
  say(`| ${g.key} | ${ms.length} | ${zero} | ${f1(pct(zero, ms.length))}% | ${f1(pct(zero7, ms.length))}% |`)
}
say()

// --- 4. 打ち手のシミュレーション ---
say('■ 7. 打ち手を入れたらどうなるか（シミュレーション・アプリは未変更）')
say()
const simDiff = verifySim()
say(`  自己検証: 打ち手なしの再現とアプリ本体の食い違い ${simDiff}件（0件なら計算は本物と同じ）`)
say()
say('  打ち手1 = 時間が書かれていない待ち工程に、動詞ごとの既定分数を当てる（煮る=10分 等）')
say('  打ち手2 = 打ち手1 ＋ 待ち動詞の辞書に「沸かす・もどす・解凍・ふたをして」を追加')
say('  打ち手3 = 打ち手2 ＋ 80字以上の長い手順を句点で分ける')
say('  打ち手4 = 打ち手2に歯止め2つ（手順の最後の動作が待ち動詞のときだけ待ち／「さっと」等は穴埋めしない）')
say('  打ち手5 = 打ち手4 ＋ 長文手順の文分割')
say()
say('  打ち手6 = 打ち手4の位置ルールを「分数が書かれていない手順」にだけ適用（自分で分数を入れた手順は尊重）')
say('  打ち手7 = 打ち手6 ＋ 既定分数を当てるのは時間が読める調理法だけ・「〜ておく」は待ちにしない【推奨案】')
say()
say('| 組み合わせ | 現行 | 打ち手1 | 打ち手2 | 打ち手3 | 打ち手4 | 打ち手5 | 打ち手6 | 打ち手7 | 短縮ゼロ率 現行→打ち手7 |')
say('|---|---|---|---|---|---|---|---|---|---|')
for (const c of comboSets) {
  const base = comboSummaries.get(c.key)
  const p1 = planStats(c.triples, PLAN1)
  const p2 = planStats(c.triples, PLAN2)
  const p3 = planStats(c.triples, PLAN3)
  const p4 = planStats(c.triples, PLAN4)
  const p5 = planStats(c.triples, PLAN5)
  const p6 = planStats(c.triples, PLAN6)
  const p7 = planStats(c.triples, PLAN7)
  say(
    `| ${c.key} | ${f1(base.avgGain)}% | ${f1(p1.avgGain)}% | ${f1(p2.avgGain)}% | ${f1(p3.avgGain)}% | ${f1(p4.avgGain)}% | ${f1(p5.avgGain)}% | ${f1(p6.avgGain)}% | ${f1(p7.avgGain)}% | ${f1(base.zeroRate)}% → ${f1(p7.zeroRate)}% |`,
  )
}
say()

// 打ち手3を入れたときの「答え合わせ」への影響（危険側が増えないか）
say('■ 7b. 打ち手を入れたときの答え合わせ（標本A/B/Cの一致率と危険な誤判定の増減）')
say()
say('| 打ち手 | 一致 | 見逃し | 危険(手作業→待ち) | 一致率 |')
say('|---|---|---|---|---|')
const dangerLists = new Map()
for (const [name, plan] of [
  ['現行', BASELINE],
  ['打ち手1', PLAN1],
  ['打ち手2', PLAN2],
  ['打ち手4(安全版)', PLAN4],
  ['打ち手6(安全版・改)', PLAN6],
  ['打ち手7(推奨案)', PLAN7],
]) {
  let ok = 0
  let missed = 0
  const danger = []
  for (const g of groups.slice(1))
    for (const r of g.recipes) {
      const truth = r._truth
      if (!truth || truth.length !== r.steps.length) continue
      r.steps.forEach((s, i) => {
        const k = plan.classify(s)
        if (k === truth[i]) ok++
        else if (truth[i] === 'wait') missed++
        else danger.push(`${r.title} 手順${i + 1}: ${s.text.slice(0, 50)}（待ち${plan.waitMinutes(s) ?? '?'}分と判定）`)
      })
    }
  dangerLists.set(name, danger)
  say(`| ${name} | ${ok} | ${missed} | ${danger.length} | ${f1(pct(ok, ok + missed + danger.length))}% |`)
}
say()
say('  打ち手2で「待ち」に化けてしまう手作業工程（＝目を離させてしまう手順）:')
for (const line of dangerLists.get('打ち手2')) say(`    - ${line}`)
say()
for (const name of ['打ち手4(安全版)', '打ち手6(安全版・改)', '打ち手7(推奨案)']) {
  say(`  ${name}で「待ち」に化けてしまう手作業工程:`)
  const d = dangerLists.get(name)
  if (d.length === 0) say('    （なし）')
  for (const line of d) say(`    - ${line}`)
  say()
}

// 同梱109品で現行→打ち手6により判定が変わる手順（退行が無いかの確認）
say('■ 7c. 同梱109品で判定が変わる手順（現行 → 打ち手7・推奨案）')
say()
{
  const flips = { toActive: [], toWait: [] }
  for (const r of starterRecipes)
    r.steps.forEach((s, i) => {
      const a = classifyStep(s)
      const b = PLAN7.classify(s)
      if (a === b) return
      const line = `${r.title} 手順${i + 1}: ${s.text.slice(0, 52)}`
      if (b === 'active') flips.toActive.push(line)
      else flips.toWait.push(line)
    })
  say(`  待ち → 手作業 に変わる: ${flips.toActive.length}件`)
  for (const l of flips.toActive) say(`    - ${l}`)
  say(`  手作業 → 待ち に変わる: ${flips.toWait.length}件`)
  for (const l of flips.toWait) say(`    - ${l}`)
}
say()

// --- 8: ホールドアウト標本（docs/68 合格ラインの追加条件） ---
say('■ 8. ホールドアウト標本（修繕後に書き下ろした初見の9品。標本に合わせた調整が効いていないかの確認）')
say()
{
  const all = holdoutGroups.flatMap((g) => g.recipes)
  const comboSets8 = [
    ...holdoutGroups.map((g) => ({ key: g.key, triples: allTriples(g.recipes) })),
    { key: 'ホ混合（全84通り）', triples: allTriples(all) },
  ]
  say('| 組み合わせ | 通り数 | 順に作る平均(分) | ナビの平均(分) | 平均短縮率 | 短縮ゼロ | 短縮5%未満 | 正直表示になった割合 |')
  say('|---|---|---|---|---|---|---|---|')
  for (const c of comboSets8) {
    const s = summarizeTriples(c.triples)
    say(
      `| ${c.key} | ${s.n} | ${f1(s.avgSeq)} | ${f1(s.avgPar)} | ${f1(s.avgGain)}% | ${f1(s.zeroRate)}% | ${f1(s.under5Rate)}% | ${f1(s.honestRate)}% |`,
    )
  }
  say()
  say('| レシピ群 | 品数 | 手順数 | 待ちと判定 | 待ちゼロの品 |')
  say('|---|---|---|---|---|')
  for (const g of holdoutGroups) {
    const ms = g.recipes.map((r) => measures.get(r.id))
    const stepCount = ms.reduce((a, m) => a + m.stepCount, 0)
    const waitCount = ms.reduce((a, m) => a + m.waitCount, 0)
    const zero = ms.filter((m) => m.waitCount === 0).length
    say(`| ${g.key} | ${ms.length} | ${stepCount} | ${f1(pct(waitCount, stepCount))}% | ${zero} |`)
  }
  say()
  say('| レシピ群 | 手順数 | 一致 | 見逃し | 危険(手作業→待ち) | 一致率 |')
  say('|---|---|---|---|---|---|')
  const hTotal = { ok: 0, missed: 0, danger: 0, total: 0 }
  const hDetail = []
  for (const g of holdoutGroups) {
    let ok = 0
    let missed = 0
    let danger = 0
    let total = 0
    for (const r of g.recipes) {
      const m = measures.get(r.id)
      const truth = r._truth
      if (!truth || truth.length !== m.kinds.length) {
        hDetail.push(`  !! ${r.title}: 答え合わせの数が合わない（手順${m.kinds.length} / 答え${truth?.length}）`)
        continue
      }
      truth.forEach((t, i) => {
        total++
        if (t === m.kinds[i]) ok++
        else if (t === 'wait') {
          missed++
          hDetail.push(`  [見逃し] ${r.title} 手順${i + 1}: ${r.steps[i].text.slice(0, 46)}`)
        } else {
          danger++
          hDetail.push(`  [危険]   ${r.title} 手順${i + 1}: ${r.steps[i].text.slice(0, 46)}`)
        }
      })
    }
    say(`| ${g.key} | ${total} | ${ok} | ${missed} | ${danger} | ${f1(pct(ok, total))}% |`)
    hTotal.ok += ok
    hTotal.missed += missed
    hTotal.danger += danger
    hTotal.total += total
  }
  say(
    `| **合計** | ${hTotal.total} | ${hTotal.ok} | ${hTotal.missed} | **${hTotal.danger}** | **${f1(pct(hTotal.ok, hTotal.total))}%** |`,
  )
  say()
  for (const line of hDetail) say(line)
  say()
}

// --- 段取り全文（B/C） ---
function dumpTimeline(title, trio) {
  const m = measureTriple(trio)
  say(`--- ${title} ---`)
  say(`選んだ3品: ${trio.map((r) => r.title).join(' / ')}`)
  say(`順に作ると ${m.seq}分 → ナビの段取り ${m.par}分（短縮 ${f1(m.gainPct)}%）`)
  say()
  for (const it of m.timeline.items) {
    const kind = it.kind === 'wait' ? `待ち${it.waitMinutes}分` : '手作業'
    const r = trio.find((x) => x.id === it.recipeId)
    const hits = stepIngredientAmounts(it.text, r.ingredients, r.servings, r.servings)
    const ing = hits.length > 0 ? `      材料: ${hits.map((h) => `${h.name} ${h.amount}`).join(' / ')}` : '      材料: （表示なし）'
    say(`  ${String(it.order).padStart(2)}. [${it.recipeTitle}] (${kind}) ${it.text}`)
    say(ing)
  }
  say()
}

say('■ 実際に生成された段取りの全文')
say()
dumpTimeline('B: 貼り付け取込 3品（B1・B2・B4）', [bRecipes[0], bRecipes[1], bRecipes[3]])
dumpTimeline('B: 貼り付け取込 3品（B3・B5・B6）', [bRecipes[2], bRecipes[4], bRecipes[5]])
dumpTimeline('C: 手入力 3品（C1・C2・C6）', [cRecipes[0], cRecipes[1], cRecipes[5]])
dumpTimeline('C: 手入力 3品（C3・C4・C5）', [cRecipes[2], cRecipes[3], cRecipes[4]])
dumpTimeline('A: URL取込 3品（A1・A3・A6）', [aRecipes[0], aRecipes[2], aRecipes[5]])
dumpTimeline('比較: 同梱109品から3品（先頭3品）', starterRecipes.slice(0, 3))

if (DUMP) {
  say('■ 追加ダンプ: 短縮ゼロだった組み合わせ（野生の混合から最大5件）')
  say()
  const mixed = comboSummaries.get('野生の混合A+B+C（無作為200通り）')
  const zeros = mixed.rows.filter((r) => r.gainPct < 0.5).slice(0, 5)
  for (const z of zeros) dumpTimeline(`短縮ゼロ: ${z.trio.map((r) => r.title).join(' / ')}`, z.trio)
}

console.log(out.join('\n'))
