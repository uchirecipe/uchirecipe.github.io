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
  buildPlanSteps,
  isSoakWait,
  isLongRestStep,
  serveTempRank,
  estimateActiveMinutes,
  waitOverrunAllowance,
  WAIT_VERB_PATTERNS,
  DEFAULT_ACTIVE_MINUTES,
  // ここから下は2026-08-13 便FZ（新しく測る6項目 N1〜N6）で使う。読むだけで挙動は変えていない
  EXTRA_WAIT_VERB_PATTERNS,
  recipeServeTemp,
  waitUrgency,
  stepMainText,
} from '../src/logic/cookNavi.ts'
import { findTimeTokens } from '../src/logic/time.ts'
import { stepIngredientAmounts } from '../src/logic/naviIngredients.ts'
import { buildIngredientNames, findIngredientMatches } from '../src/logic/ingredientSpans.ts'
import { parseRecipeText } from '../src/logic/parseRecipeText.ts'
import { buildImportedIngredientRows, filterImportedSteps } from '../src/logic/urlImportRows.ts'
import { starterDefs } from '../src/db/starters.ts'
// 汁物かどうかの判定（N2。2026-08-13 便GA）。取り込み・手入力のレシピは料理の種別が付かないので、
// アプリが登録時に初期値を提案するのと同じ関数で補う（＝実機と同じ見分け方で測る）
import { guessDishType } from '../src/logic/dishTypeGuess.ts'
import { urlSamples, pasteSamples, manualSamples } from './data/navi-wild-recipes.mjs'
import {
  urlSamples as holdoutUrlSamples,
  pasteSamples as holdoutPasteSamples,
  manualSamples as holdoutManualSamples,
} from './data/navi-holdout-recipes.mjs'
// R3（docs/71 の実操作）の再現標本。新しい6項目の答え合わせにだけ使う（2026-08-13 便FZ）
import {
  pasteSamples as r3PasteSamples,
  manualSamples as r3ManualSamples,
} from './data/navi-r3-recipes.mjs'
// 「その間に」を本文に書いたレシピの標本（N6の分母。2026-08-13 便FZ）
import {
  urlSamples as cueUrlSamples,
  pasteSamples as cuePasteSamples,
  manualSamples as cueManualSamples,
} from './data/navi-parallel-recipes.mjs'

const DUMP = process.argv.includes('--dump')

// ---------------------------------------------------------------- 標本づくり

let nextId = 1
/** 計測に必要なところだけ持つレシピ（Recipe と同じ形。buildCookTimeline は id/title/steps を見る） */
function makeRecipe({ title, servings, cookMinutes, ingredients, steps, truth, realWaits, realMinutes, group, dishType }) {
  return {
    id: nextId++,
    title,
    servings: servings ?? 2,
    cookMinutes,
    effortLevel: 'normal',
    tags: [],
    // 同梱109品は確定済みの値、それ以外は登録時と同じ推定（2026-08-13 便GA・N2で使う）
    dishType: dishType ?? guessDishType({ title, tags: [], ingredients: ingredients ?? [] }),
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
    dishType: d.dishType,
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

  // 下線と分量の食い違い（2026-08-08 便EG・オーナー実機報告
  // 「下線は出るのに分量が出ない材料がある」）。手順本文に下線が引かれた語のうち、
  // 分量として出なかったものを数える。**0件であることが要件**
  const underlineNames = buildIngredientNames(r.ingredients)
  const underlineOnly = []
  steps.forEach((s, i) => {
    const underlined = [...new Set(findIngredientMatches(s.text, underlineNames).map((m) => m.text))]
    if (underlined.length === 0) return
    const shownNames = new Set()
    for (const hit of stepMatches[i]) for (const n of buildIngredientNames([{ name: hit.name }])) shownNames.add(n)
    for (const word of underlined) if (!shownNames.has(word)) underlineOnly.push({ step: s.text, word })
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
    underlineOnly,
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
      // アプリ本体と同じく「湯を沸かす」を差し込んでから組む（2026-08-08 便EG）
      const steps = buildPlanSteps(opt.splitSteps ? splitLongSteps(r.steps) : r.steps).map(
        ({ step: s }, i) => {
          const kind = opt.classify(s)
          // 「半日〜一晩漬ける」のように今回の調理では終わらない待ちは時間の計算から外す
          // （2026-08-11 便FL。アプリ本体と同じ規則。打ち手の比較にも同じ土俵で効かせる）
          const longRest = kind === 'wait' && isLongRestStep(s)
          const waitMinutes = kind === 'wait' && !longRest ? (opt.waitMinutes(s) ?? 0) : 0
          const activeMinutes = kind === 'active' ? estimateActiveMinutes(s).minutes : 0
          return {
            i,
            kind,
            waitMinutes,
            activeMinutes,
            category: stepCategory(s),
            stageRank: stepStageRank(s),
            cutRank: cutOrderRank(s),
            soakWait: kind === 'wait' && isSoakWait(s),
            // 手を戻す締め切り（2026-08-09 便EH。アプリ本体と同じ規則）
            attendWithin:
              kind !== 'wait'
                ? 0
                : longRest
                  ? Number.POSITIVE_INFINITY
                  : waitMinutes + waitOverrunAllowance(s, waitMinutes),
            text: s.text,
          }
        },
      )
      return {
        colorIndex,
        steps,
        ptr: 0,
        readyAt: 0,
        attendUntil: 0,
        title: r.title,
        serveRank: serveTempRank(r),
      }
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
    // 手を戻す締め切り（2026-08-09 便EH。アプリ本体と同じ規則）
    const attendDeadline = jobs.reduce(
      (min, j) => (j.attendUntil > cookAt ? Math.min(min, j.attendUntil) : min),
      Number.POSITIVE_INFINITY,
    )
    const attendDue = (j) => (j.attendUntil > 0 && j.readyAt <= cookAt ? 0 : 1)
    const cutRun = (j) => (lastActiveCategory === 'cut' && j.steps[j.ptr].category === 'cut' ? 0 : 1)
    const sameCat = (j) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
    // 完成の順番（冷やす品は先に・熱々の品は最後に仕上げる）。その品の最後の手順にだけ効かせる
    const finishBias = (j) => (j.ptr === j.steps.length - 1 ? j.serveRank : 1)
    const pickActive = (cands) =>
      cands.slice().sort((a, b) => {
        const stepA = a.steps[a.ptr]
        const stepB = b.steps[b.ptr]
        // 切る工程どうしは、まな板の順序（野菜→肉・魚）を先に見る（アプリ本体と同じ規則）
        if (stepA.category === 'cut' && stepB.category === 'cut' && stepA.cutRank !== stepB.cutRank) {
          return stepA.cutRank - stepB.cutRank
        }
        return (
          attendDue(a) - attendDue(b) ||
          finishBias(a) - finishBias(b) ||
          cutRun(a) - cutRun(b) ||
          remainingSpan(b) - remainingSpan(a) ||
          stepA.stageRank - stepB.stageRank ||
          sameCat(a) - sameCat(b) ||
          a.colorIndex - b.colorIndex
        )
      })[0]
    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    waits.sort((a, b) => b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes || a.colorIndex - b.colorIndex)
    const fittingActives = ready.filter(
      (j) => j.steps[j.ptr].kind === 'active' && cookAt + j.steps[j.ptr].activeMinutes <= attendDeadline,
    )
    const shortestActive = fittingActives.reduce(
      (min, j) => Math.min(min, j.steps[j.ptr].activeMinutes),
      Number.POSITIVE_INFINITY,
    )
    const dueWaits = waits.filter((j) => j.attendUntil > 0)
    const waitWouldIdle =
      waits.length > 0 &&
      dueWaits.length === 0 &&
      fittingActives.length > 0 &&
      waits[0].steps[waits[0].ptr].attendWithin < shortestActive
    // 漬け込み・寝かせの前に、いま着手できる切る工程を先に片付ける（アプリ本体と同じ規則）
    const readyCuts = fittingActives.filter((j) => j.steps[j.ptr].category === 'cut')
    const soakOnly = waits.length > 0 && waits.every((j) => j.steps[j.ptr].soakWait)
    let chosen
    if (dueWaits.length > 0) {
      chosen = dueWaits[0]
    } else if (waits.length > 0 && !(soakOnly && readyCuts.length > 0) && !waitWouldIdle) {
      chosen = waits[0]
    } else if (soakOnly && readyCuts.length > 0) {
      chosen = pickActive(readyCuts)
    } else if (fittingActives.length > 0) {
      chosen = pickActive(fittingActives)
    } else if (waits.length > 0) {
      chosen = waits[0]
    } else {
      cookAt = active.reduce((next, j) => (j.readyAt > cookAt ? Math.min(next, j.readyAt) : next), attendDeadline)
      continue
    }
    const step = chosen.steps[chosen.ptr]
    const startMin = cookAt
    chosen.attendUntil = 0
    let endMin
    if (step.kind === 'wait') {
      endMin = startMin + step.waitMinutes
      chosen.readyAt = endMin
      const attendUntil = startMin + step.attendWithin
      chosen.attendUntil = Number.isFinite(attendUntil) ? attendUntil : 0
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

// --- 4b: 下線と分量の食い違い（2026-08-08 便EG。0件が要件） ---
say('■ 4b. 手順本文の下線と、分量表示の食い違い（下線が引かれたのに分量が出ない語）')
say()
say('| レシピ群 | 手順数 | 食い違いのある手順 | 食い違いの語の数 |')
say('|---|---|---|---|')
const underlineSamples = []
for (const g of [...groups, ...holdoutGroups]) {
  let stepsWith = 0
  let words = 0
  let stepCount = 0
  for (const r of g.recipes) {
    const m = measures.get(r.id)
    stepCount += m.stepCount
    const bySteps = new Set(m.underlineOnly.map((x) => x.step))
    stepsWith += bySteps.size
    words += m.underlineOnly.length
    for (const x of m.underlineOnly)
      if (underlineSamples.length < 12) underlineSamples.push(`${r.title}: ${x.word} ← ${x.step.slice(0, 40)}`)
  }
  say(`| ${g.key} | ${stepCount} | ${stepsWith} | ${words} |`)
}
if (underlineSamples.length > 0) {
  say()
  say('  食い違いの例（0件が要件。1件でも出たら下線か分量のどちらかを直す）:')
  for (const s of underlineSamples) say(`    - ${s}`)
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

// ================================================================================
//  【新規】段取りの質を測る6項目 N1〜N6（docs/72 §2・2026-08-13 便FZ）
//
//  docs/71 のR3（自分で登録したレシピだけで試した1体）で、**短縮率30.4%を満たしたまま
//  汁物が27分冷める段取り**が合格になっていた。原因は「測っていない軸があったこと」。
//  ここから下は、その軸を測るために追加した部分。**アプリの挙動は1行も変えていない**
//  （`src/` は読むだけ。器具の見分けなど新しい判定はすべてこのスクリプトの中に置く）。
//
//  ここより上の出力（既存7項目）は1文字も変えていない。
// ================================================================================

/**
 * 6項目の合格ライン。
 *
 * **n1over / n2 / n3 の3本は 2026-08-13 便GA で引き直した**（docs/72 §2 で決めた線が、
 * 狙った症状を1件も捉えられていないことが便FZの実測で分かったため。**すべて厳しくする方向**で、
 * 緩めた線は1本も無い）。理由はそれぞれの項目の直前に書いてある。
 *   n1     … 開きの割合の中央値。**参考値**として残す（合否には使わない）
 *   n1over … 開きが30%を超えた組み合わせの割合。**これがN1の合否**（20%以下）
 *   n2     … 温かい品**と汁物**の放置の最大値（分）
 *   n3     … 放置してよい調理なのに手作業と判定された8分以上の工程の件数
 *   n3rank … 最長待ちの着火順位の中央値。**参考値**として残す（合否には使わない）
 */
const N_LINE = { n1: 30, n1over: 20, n2: 10, n3: 0, n3rank: 1, n4: 90, n5: 0, n6: 80 }
const verdict = (ok) => (ok ? '合格' : '**不合格**')
/** 同じ実例が別の組み合わせから何度も出てくるので、代表1件にまとめる */
function dedupe(list, keyOf) {
  const seen = new Set()
  return list.filter((x) => {
    const k = keyOf(x)
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---------------------------------------------------------------- 測り方の道具

/**
 * 【完成時刻の定義】その品ができあがる時刻（調理開始からの分）。
 *
 * 段取り（`buildCookTimeline`）は工程を1本の列に並べ、工程ごとに開始位置 `startMin` と
 * 終了位置 `endMin` を持つ。手作業の工程は「手を動かす見積り時間」ぶんの幅、待ちの工程は
 * 「待ち時間」ぶんの幅を持つ（待ちは仕掛けた瞬間から裏で進み、料理人はすぐ次の工程に移る）。
 * したがって **その品の最後の工程の endMin ＝ 手を動かす時間の積み上げ＋待ちの明ける時刻**
 * になり、これをその品の完成時刻とする（docs/72 の指定どおりの数え方）。
 *
 * 「半日〜一晩漬ける」のような今回の調理では終わらない待ち（longRest）は幅0なので、
 * 完成時刻を伸ばさない（アプリ本体の数え方と同じ。docs/68 便FL）。
 */
function finishTimes(timeline) {
  const finish = new Map()
  for (const it of timeline.items) {
    finish.set(it.recipeId, Math.max(finish.get(it.recipeId) ?? 0, it.endMin))
  }
  return finish
}

/**
 * 測定用の名詞マスク（`cookNavi.ts` の NON_WAIT_NOUN_PATTERN の写し。同じ長さの伏せ字にする）。
 * 後半は**器具の見分けのために足した分**（この便で追加）。「油揚げは短冊切りにする」が
 * 「揚げ」に当たってコンロ使用に化けていた（実測で見つけて塞いだ）。
 */
const MEASURE_NON_WAIT_NOUN =
  /漬け汁|漬けだれ|漬けタレ|漬けダレ|漬け床|漬物|漬け物|オーブンシート|オーブンペーパー|しょうゆ|つゆ|煮干し|蒸し器|蒸しパン|ゆで卵|ゆでうどん|ゆで麺|お浸し|油揚げ|厚揚げ|薄揚げ|揚げ玉|さつま揚げ|焼きのり|焼き海苔|焼き豆腐|焼きそば麺|めんつゆ|煮汁|煮物|煮もの|蒸し鶏|蒸しタオル/g
/** 「〜ておく」＝先に済ませる言い方であって放置時間ではない（アプリ本体と同じ扱い） */
const MEASURE_TE_OKU = /[てで](?:お|置)[くきい]/g
/** 判定に使う本文（括弧の中の任意の記述・待ちでない名詞・「〜ておく」を伏せる） */
function maskForMeasure(text) {
  return stepMainText(text ?? '')
    .replace(MEASURE_NON_WAIT_NOUN, (m) => '＊'.repeat(m.length))
    .replace(MEASURE_TE_OKU, (m) => '＊'.repeat(m.length))
}

/** patterns のどれかが最初に現れる位置（無ければ -1） */
function firstIdx(text, patterns) {
  let first = -1
  for (const re of patterns) {
    const m = new RegExp(re.source).exec(text)
    if (m && (first === -1 || m.index < first)) first = m.index
  }
  return first
}

/**
 * 【器具の見分け】この便で新しく作った判定。**測るためだけのもので、アプリには入れない**。
 * docs/72 §3「数える器具は4つ＝コンロ（口数）・電子レンジ・魚焼きグリル・トースター」に合わせる
 * （オーブンと炊飯器は数える対象に入っていないので見分けない）。
 *
 * コンロは「火の入る言い方」が本文にあれば1口使うとみなす。鍋・フライパンの語が無くても
 * 「しんなりするまで炒める」はコンロを使っているため。逆に **火の語が無い手順は数えない**
 * （「鍋に豆腐を入れる」だけでは火が入っているか分からない）＝**少なめに数える側に倒してある**。
 */
const APPLIANCE_TOASTER = /トースター/
const APPLIANCE_MICROWAVE = /レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]/
const APPLIANCE_GRILL = /グリル/
const APPLIANCE_OVEN = /オーブン/
const STOVE_HEAT_CUE =
  /火にかけ|火に掛け|中火|弱火|強火|とろ火|煮|茹で|ゆで|沸か|沸騰|炒め|炒る|揚げ|蒸|焼く|焼き|焼い|熱し|熱する|加熱|温め/
const APPLIANCE_LABEL = { stove: 'コンロ', microwave: '電子レンジ', grill: '魚焼きグリル', toaster: 'トースター' }

function stepAppliance(text) {
  const t = maskForMeasure(text)
  if (APPLIANCE_TOASTER.test(t)) return 'toaster'
  if (APPLIANCE_MICROWAVE.test(t)) return 'microwave'
  if (APPLIANCE_GRILL.test(t)) return 'grill'
  if (APPLIANCE_OVEN.test(t)) return null // docs/72 の数える4器具に入っていない
  return STOVE_HEAT_CUE.test(t) ? 'stove' : null
}

/**
 * その工程が器具を占有している区間（分）。占有していなければ undefined。
 * docs/72 §3「占有する待ち＝煮る・焼く／占有しない待ち＝漬ける・冷ます・寝かせる」は、
 * アプリ本体の `waitUrgency`（onTime=ゆでる・レンジ／simmer=煮る・グリル／relaxed=漬ける・冷ます）
 * とそのまま対応するので、**relaxed の待ちだけ占有しない**とみなす。
 */
function applianceUse(item) {
  const key = stepAppliance(item.text)
  if (!key) return undefined
  if (item.kind === 'wait') {
    if (item.waitMinutes <= 0) return undefined
    if (waitUrgency({ text: item.text, minutes: item.minutes }) === 'relaxed') return undefined
  } else if (item.activeMinutes <= 0) return undefined
  return { key, start: item.startMin, end: item.endMin }
}

/** 区間の最大同時使用数（端が接するだけ＝前の工程が終わった瞬間に次が始まる、は重なりとしない） */
function maxConcurrent(intervals) {
  const events = []
  for (const iv of intervals) {
    if (iv.end <= iv.start) continue
    events.push([iv.start, 1], [iv.end, -1])
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  let cur = 0
  let max = 0
  for (const [, delta] of events) {
    cur += delta
    if (cur > max) max = cur
  }
  return max
}

/**
 * 【混在手順の見分け】1つの手順の中に「手を動かす作業」と「待ち」が同居しているか。
 * 判定は位置で行う（アプリ本体の位置ルールと同じ考え方）＝**手作業の語が待ちの語より前**にあるとき、
 * その手順は「手を動かしてから放置する」形になっている。
 *   「そぎ切りにする。10分ほどおく」   → 切り(手作業) の後ろに おく(待ち)   → 混在
 *   「鍋に水とだしの素を入れて中火にかける」→ 入れ(手作業) の後ろに 火にかけ(待ち) → 混在
 *   「煮立ったら浮いてきたアクを取る」   → 煮(待ち) の後ろに 取る(手作業)   → 混在ではない（手作業の手順）
 * 「火にかける」は待ち動詞の辞書に無いが、**沸くまでの待ちが必ず続く**言い方なので待ち側に数える
 * （docs/72 の対象2に挙がっている実例そのもの）。
 */
const MEASURE_ACTION_VERB =
  /炒め|炒る|揚げ|焼く|焼き|焼い|取る|取り|取っ|加え|入れ|混ぜ|溶き|溶い|溶か|絞る|絞り|絞っ|切る|切り|切っ|そぎ|盛る|盛り|盛っ|かける|かけて|ふる|ふり|ふっ|ふって|返す|返し|のせ|散ら|和え|あえ|つぶ|こね|まぶ|止め|ぬぐ|添え|よそ|包む|巻く|にぎ|ほぐ|むく|むき|洗う|洗い|洗っ|締め|刺し|もみ/
const IMPLIED_WAIT_CUE = /火にかけ|火に掛け/
function isMixedStep(step) {
  const text = maskForMeasure(step.text)
  const waitAt = firstIdx(text, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS, IMPLIED_WAIT_CUE])
  if (waitAt < 0) return false
  const actionAt = firstIdx(text, [MEASURE_ACTION_VERB])
  return actionAt >= 0 && actionAt < waitAt
}

/**
 * 【利用者の並行指示】手順本文の「その間に」「〜しながら」（docs/72 §2 N6）。
 *
 * 「その間に」系（その間に・〜している間に）は**ほかの工程と同時にやれ**という指示そのものなので、
 * これをN6の主指標にする。
 *
 * 「〜しながら」は、実際の本文を全数見たところ **「ほぐしながら炒める」「混ぜながら煮る」のように
 * 1つの動作の中の同時**がほとんどで、並行の指示ではなかった（むしろ本体では
 * `HANDS_ON_PATTERNS` の「混ぜながら」が**目を離さない合図**として使われている）。
 * これを主指標に混ぜると、直せない数字を直せと言うことになるので**件数だけ別に出す**
 * （docs/72 は両方を拾うよう指定しているので、拾ったうえで内訳を分ける）。
 */
const CUE_MEANWHILE =
  /その間|そのあいだ|している間|しているあいだ|待つ間|待っている間|寝かせている間|焼いている間|煮ている間|漬けている間|ゆでている間|茹でている間|冷ましている間|炊いている間/
const CUE_NAGARA = /ながら/
function parallelCue(text) {
  const t = maskForMeasure(text)
  if (CUE_MEANWHILE.test(t)) return 'meanwhile'
  return CUE_NAGARA.test(t) ? 'nagara' : undefined
}

/**
 * 【放置してよいのに手作業と判定された長い工程】N3の読み方に必要な補助。
 * 「魚焼きグリルで15分焼く」は、位置ルール（最後に来る動作＝焼く＝手作業）で **手作業15分** になる。
 * ユーザーが登録したレシピは分数欄が空なので位置ルールが必ず効き、**同梱109品では分数欄が
 * 埋まっているため位置ルールが適用されず待ちのまま**＝この差は同梱109品では絶対に見えない。
 */
const UNATTENDED_COOK = /グリル|オーブン|トースター|レンジ|煮|蒸|炊/
function isStrandedLongCook(item) {
  return item.kind === 'active' && item.activeMinutes >= 8 && UNATTENDED_COOK.test(maskForMeasure(item.text))
}

/**
 * 【N2の対象】温かいうちに出したい品（2026-08-13 便GA・線の引き直し）。
 *
 * 便FZまでは `recipeServeTemp(r) === 'hot'` だけを対象にしていた。ところが**R3のみそ汁は
 * 'neutral' 判定で対象から外れる**（最後の手順が「みそを溶いて火を止める」＝火を使う語が
 * 「止める」しか無く、加熱で終わる品と読めない）。汁物が冷める問題を測るための項目なのに、
 * 発端になった汁物そのものを取りこぼしていた。
 *
 * そこで**料理の種別が汁物（dishType === 'soup'）の品は、温度の判定に関係なく常に対象**にする。
 * 汁物は冷めたら作り直せず、放置が一番はっきり体験に出る種別のため。
 * 種別が付いていないレシピ（取り込み・手入力）は、アプリが登録時に初期値を提案するのと同じ
 * `guessDishType` で補う＝実機と同じ見分け方で測る。
 */
function isN2Target(recipe) {
  return recipeServeTemp(recipe) === 'hot' || recipe.dishType === 'soup'
}

// ---------------------------------------------------------------- 1組み合わせの分析

function analyzePlan(trio) {
  const timeline = buildCookTimeline(trio)
  const items = timeline.items
  const finish = finishTimes(timeline)
  const byRecipe = new Map()
  for (const it of items) {
    if (!byRecipe.has(it.recipeId)) byRecipe.set(it.recipeId, [])
    byRecipe.get(it.recipeId).push(it)
  }
  const total = timeline.totalMinutes
  const finishes = [...finish.values()]
  const last = Math.max(...finishes)

  // --- N1 完成の揃い
  const spread = last - Math.min(...finishes)

  // --- N2 温かい品の放置（対象の品が、最後の品より何分早く終わるか）
  let hotIdle = null
  for (const r of trio) {
    if (!isN2Target(r)) continue
    const f = finish.get(r.id)
    if (f == null) continue
    hotIdle = Math.max(hotIdle ?? 0, last - f)
  }

  // --- N3 最長待ちの着火順
  const ignitions = []
  for (const [recipeId, list] of byRecipe) {
    let longest = null
    for (let i = 0; i < list.length; i++) {
      if (list[i].kind !== 'wait' || list[i].waitMinutes <= 0) continue
      if (longest === null || list[i].waitMinutes > list[longest].waitMinutes) longest = i
    }
    if (longest === null) continue
    const target = list[longest]
    // その品の準備が終わった時刻＝1つ前の工程が終わる時刻（最初の工程なら0分）
    const readyAt = longest === 0 ? 0 : list[longest - 1].endMin
    // 準備が終わってから着火までの間に、何件の工程に着手したか。
    // **同じ時刻に始まる工程は数えない**（待ちを続けて2つ仕掛けても着火は遅れないため）
    const before = items.filter(
      (x) => x.order < target.order && x.startMin >= readyAt && x.startMin < target.startMin,
    ).length
    ignitions.push({
      recipeId,
      title: target.recipeTitle,
      rank: before + 1,
      waitMinutes: target.waitMinutes,
      readyAt,
      startMin: target.startMin,
      text: target.text,
    })
  }

  // --- N3補助: その品でいちばん長い工程（待ちか手作業かを問わない）が、いつ着火されたか。
  // R3の「グリル15分が最後に回る」は、グリルが**待ちと判定されていない**ため上のN3では見えない。
  // 「一番長い待ちを最初に始める」という並行調理の基本を、判定に左右されない形で測るための補助。
  const longestStarts = []
  for (const [, list] of byRecipe) {
    let best = null
    for (const it of list) {
      const span = it.kind === 'wait' ? it.waitMinutes : it.activeMinutes
      if (span <= 0) continue
      if (best === null || span > (best.kind === 'wait' ? best.waitMinutes : best.activeMinutes)) best = it
    }
    if (!best) continue
    longestStarts.push({
      title: best.recipeTitle,
      startMin: best.startMin,
      minutes: best.kind === 'wait' ? best.waitMinutes : best.activeMinutes,
      kind: best.kind,
      total,
      text: best.text,
    })
  }

  // --- N5 器具の重なり
  const uses = items.map(applianceUse).filter(Boolean)
  const concurrency = {}
  for (const key of Object.keys(APPLIANCE_LABEL)) {
    concurrency[key] = maxConcurrent(uses.filter((u) => u.key === key))
  }

  // --- N6 利用者の並行指示（その手順が、同じ品の直前の待ちが明ける前に置かれているか）
  const cues = []
  for (const [, list] of byRecipe) {
    for (let i = 0; i < list.length; i++) {
      const cue = parallelCue(list[i].text)
      if (!cue) continue
      let ref = null
      let gap = 0
      for (let k = i - 1; k >= 0; k--) {
        if (list[k].kind === 'wait' && list[k].waitMinutes > 0) {
          ref = list[k]
          gap = i - k
          break
        }
      }
      cues.push({
        cue,
        title: list[i].recipeTitle,
        text: list[i].text,
        hasWait: ref != null,
        inside: ref != null && list[i].startMin < ref.endMin,
        // その待ちの「次の手順」として書かれているか（＝レシピ内の順序に縛られて動かせない形）
        nextOfWait: ref != null && gap === 1,
        startMin: list[i].startMin,
        waitEnd: ref?.endMin,
      })
    }
  }

  return { trio, timeline, total, finish, spread, hotIdle, ignitions, longestStarts, concurrency, cues, last }
}

// ---------------------------------------------------------------- 標本（野生＋ホールドアウト）

const holdoutAll = [...haRecipes, ...hbRecipes, ...hcRecipes]
/**
 * N6（利用者の並行指示）専用の標本。既存の野生18品・ホールドアウト9品には
 * **「その間に」型の指示が1件も無く**、分母0で測れないため別に書き下ろした6品
 * （`scripts/data/navi-parallel-recipes.mjs`）。既存の標本は1文字も変えていない。
 */
const cueRecipes = [
  ...buildUrlRecipes(cueUrlSamples, '並: URL取込'),
  ...buildPasteRecipes(cuePasteSamples, '並: 貼り付け取込'),
  ...buildManualRecipes(cueManualSamples, '並: 手入力'),
]
const nSets = [
  { key: '同梱109品（無作為500通り）', triples: comboSets[0].triples, wild: false },
  { key: 'A: URL取込（全20通り）', triples: comboSets[1].triples, wild: true },
  { key: 'B: 貼り付け取込（全20通り）', triples: comboSets[2].triples, wild: true },
  { key: 'C: 手入力（全20通り）', triples: comboSets[3].triples, wild: true },
  { key: '野生の混合A+B+C（無作為200通り）', triples: comboSets[4].triples, wild: true },
  { key: 'ホールドアウト混合（全84通り）', triples: allTriples(holdoutAll), wild: true },
  { key: '並行指示の標本（全20通り）', triples: allTriples(cueRecipes), wild: false, cue: true },
]
const nAnalyses = new Map(nSets.map((s) => [s.key, s.triples.map(analyzePlan)]))
/** 合否は「野生レシピ＋ホールドアウト」で見る（同梱109品は比較のために出すだけ） */
const wildKeys = nSets.filter((s) => s.wild).map((s) => s.key)
const wildRows = wildKeys.flatMap((k) => nAnalyses.get(k))

const nameOf = (a) => a.trio.map((r) => r.title).join(' / ')

say('=========================================================')
say(' 【新規】段取りの質を測る6項目 N1〜N6（docs/72 §2・便FZ）')
say('=========================================================')
say()
say('  ここから下は 2026-08-13 便FZ で追加した計測。**アプリの挙動は1行も変えていない**。')
say('  合否は**野生レシピ（A/B/C）とホールドアウト**で判定する（同梱109品は比較のために並べるだけ。')
say('  同梱109品だけで測って見落としたのが今回の反省。docs/72 §5）。')
say()
say('  完成時刻の定義: 段取りの中で**その品の最後の工程が終わる時刻**（分）。')
say('    手作業の工程は手を動かす見積り時間ぶん、待ちの工程は待ち時間ぶんの幅を持ち、')
say('    待ちは仕掛けた瞬間から裏で進む。＝**手を動かす時間の積み上げ＋待ちの明ける時刻**。')
say('    「半日漬ける」のような今回の調理で終わらない待ちは幅0（アプリ本体と同じ数え方）。')
say()

// ---------------------------------------------------------------- N1
say('■ N1. 完成の揃い（品ごとの完成時刻の開き。**線＝開きが30%を超える組み合わせが20%以下**）')
say()
say('  ※線の引き直し（2026-08-13 便GA）: 便FZまでは「開きの割合の**中央値**が30%以内」を線に')
say('     していたが、**中央値25.4%で合格しながら41.6%の組み合わせが30%を超えていた**（R3の再現は')
say('     60%）。中央値は半分の組み合わせが線を割っていても合格になる。**30%を超えた組み合わせの')
say('     割合そのものを線にする**（20%以下）。中央値は参考値として残す。')
say()
say('| 組み合わせ | 通り数 | 開きの中央値(分) | 全体の中央値(分) | 開きの割合の中央値（参考） | **30%超の割合** | 判定 |')
say('|---|---|---|---|---|---|---|')
for (const s of nSets) {
  const rows = nAnalyses.get(s.key)
  const ratios = rows.map((a) => pct(a.spread, a.total))
  const med = median(ratios)
  const over = pct(ratios.filter((x) => x > N_LINE.n1).length, rows.length)
  say(
    `| ${s.key} | ${rows.length} | ${f1(median(rows.map((a) => a.spread)))} | ${f1(median(rows.map((a) => a.total)))} | ` +
      `${f1(med)}% | **${f1(over)}%** | ${s.wild ? verdict(over <= N_LINE.n1over) : '（参考）'} |`,
  )
}
{
  const ratios = wildRows.map((a) => pct(a.spread, a.total))
  const med = median(ratios)
  const over = pct(ratios.filter((x) => x > N_LINE.n1).length, wildRows.length)
  say(`| **野生＋ホールドアウト 合計** | ${wildRows.length} | ${f1(median(wildRows.map((a) => a.spread)))} | ${f1(median(wildRows.map((a) => a.total)))} | ${f1(med)}% | **${f1(over)}%** | ${verdict(over <= N_LINE.n1over)} |`)
  say()
  const worst = dedupe(
    wildRows.slice().sort((a, b) => pct(b.spread, b.total) - pct(a.spread, a.total)),
    (a) => nameOf(a),
  ).slice(0, 3)
  say('  いちばん悪い3例:')
  for (const a of worst) {
    const fin = [...a.finish.entries()].map(([id, m]) => `${a.trio.find((r) => r.id === id).title}=${m}分`)
    say(`    - ${nameOf(a)}`)
    say(`      全体${a.total}分・完成時刻 ${fin.join(' / ')} → 開き${a.spread}分（${f1(pct(a.spread, a.total))}%）`)
  }
}
say()

// ---------------------------------------------------------------- N2
say('■ N2. 温かい品と汁物の放置（対象の品が最後の品より何分早く終わるか。線＝最大10分以内）')
say()
say('  ※対象の引き直し（2026-08-13 便GA）: 便FZまでは「できたてが温かい」判定（recipeServeTemp）の')
say('     品だけを見ていたが、**R3のみそ汁はこの判定が neutral で対象外**になっていた（最後の手順が')
say('     「みそを溶いて火を止める」で、加熱で終わる品と読めないため）。汁物が冷める問題を測る項目が')
say('     発端の汁物を取りこぼしていたので、**料理の種別が汁物（dishType===\'soup\'）の品は温度の')
say('     判定に関係なく常に対象**に加えた（対象が増える＝厳しくなる方向）。')
say()
say('| 組み合わせ | 対象を含む通り | 放置の中央値(分) | **放置の最大値(分)** | 10分超の割合 | 判定 |')
say('|---|---|---|---|---|---|')
for (const s of nSets) {
  const rows = nAnalyses.get(s.key).filter((a) => a.hotIdle != null)
  if (rows.length === 0) {
    say(`| ${s.key} | 0 | — | — | — | （該当なし） |`)
    continue
  }
  const idles = rows.map((a) => a.hotIdle)
  const max = Math.max(...idles)
  say(
    `| ${s.key} | ${rows.length} | ${f1(median(idles))} | **${max}** | ${f1(pct(idles.filter((x) => x > N_LINE.n2).length, rows.length))}% | ${s.wild ? verdict(max <= N_LINE.n2) : '（参考）'} |`,
  )
}
{
  const rows = wildRows.filter((a) => a.hotIdle != null)
  const idles = rows.map((a) => a.hotIdle)
  const max = Math.max(...idles)
  say(`| **野生＋ホールドアウト 合計** | ${rows.length} | ${f1(median(idles))} | **${max}** | ${f1(pct(idles.filter((x) => x > N_LINE.n2).length, rows.length))}% | ${verdict(max <= N_LINE.n2)} |`)
  say()
  const worst = dedupe(rows.slice().sort((a, b) => b.hotIdle - a.hotIdle), (a) => nameOf(a)).slice(0, 3)
  say('  いちばん悪い3例:')
  for (const a of worst) {
    const hot = a.trio.filter((r) => isN2Target(r))
    const detail = hot
      .map((r) => `${r.title}(${recipeServeTemp(r) === 'hot' ? '温' : '汁'})=${a.finish.get(r.id)}分`)
      .join(' / ')
    say(`    - ${nameOf(a)}`)
    say(`      全体${a.total}分・最後の品の完成${a.last}分 / ${detail} → 放置${a.hotIdle}分`)
  }
}
say()
say('  ※N2の対象の内訳（温かい判定＋汁物）:')
say()
say('| レシピ群 | 品数 | 温かい(hot) | 冷たい(cold) | どちらでもない(neutral) | うち汁物 | **N2の対象** |')
say('|---|---|---|---|---|---|---|')
for (const g of [...groups, ...holdoutGroups, { key: '並行指示の標本', recipes: cueRecipes }]) {
  const t = (k) => g.recipes.filter((r) => recipeServeTemp(r) === k).length
  const soup = g.recipes.filter((r) => r.dishType === 'soup').length
  const target = g.recipes.filter((r) => isN2Target(r)).length
  say(`| ${g.key} | ${g.recipes.length} | ${t('hot')} | ${t('cold')} | ${t('neutral')} | ${soup} | **${target}** |`)
}
say()

// ---------------------------------------------------------------- N3
say('■ N3. 放置調理の取りこぼし（放置してよい調理なのに手作業と判定された8分以上の工程。線＝0件）')
say()
say('  ※線の引き直し（2026-08-13 便GA）: 便FZまでのN3は「最長**待ち**の着火順」だったが、')
say('     **待ちと判定されなかった加熱はそもそも対象に入らない**。R3の「魚焼きグリルで15分焼く」は')
say('     手作業15分と判定されていたため、順位1.0番目で合格しながら症状を1件も捉えられていなかった。')
say('     便FZが補助として足したこの指標を**正式な項目に格上げし、線＝0件**とする。')
say('     従来の着火順は下に参考として残す。')
say()
say('| レシピ群 | 品数 | **該当する工程** | 判定 | 例 |')
say('|---|---|---|---|---|')
let n3Stranded = 0
for (const g of [...groups, ...holdoutGroups, { key: '並行指示の標本', recipes: cueRecipes }]) {
  const hits = []
  for (const r of g.recipes) {
    for (const it of buildCookTimeline([r]).items) if (isStrandedLongCook(it)) hits.push(`${r.title}: ${it.text.slice(0, 30)}（手作業${it.activeMinutes}分）`)
  }
  // 合否は野生＋ホールドアウト＋並行指示の標本で見る（同梱109品は参考。docs/72 §5）
  const judged = g.key !== '同梱109品'
  if (judged) n3Stranded += hits.length
  say(`| ${g.key} | ${g.recipes.length} | **${hits.length}** | ${judged ? verdict(hits.length === N_LINE.n3) : '（参考）'} | ${hits[0] ?? '—'} |`)
}
say(`| **判定対象の合計（同梱109品を除く）** | — | **${n3Stranded}** | ${verdict(n3Stranded === N_LINE.n3)} | — |`)
say()
say('  ※参考1（旧N3）: 最長**待ち**の着火順（その品の準備が終わってから何番目に着火したか）。')
say()
say('| 組み合わせ | 対象の品数 | 順位の中央値 | 1番目の割合 | 3番目以降の割合 |')
say('|---|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows }]) {
  const ig = (s.rows ?? nAnalyses.get(s.key)).flatMap((a) => a.ignitions)
  const ranks = ig.map((x) => x.rank)
  say(
    `| ${s.key} | ${ig.length} | ${f1(median(ranks))} | ${f1(pct(ranks.filter((r) => r === 1).length, ranks.length))}% | ` +
      `${f1(pct(ranks.filter((r) => r >= 3).length, ranks.length))}% |`,
  )
}
say()
{
  const ig = wildRows.flatMap((a) => a.ignitions)
  const worst = dedupe(
    ig.slice().sort((a, b) => b.rank - a.rank || b.waitMinutes - a.waitMinutes),
    (x) => x.title + x.text,
  ).slice(0, 3)
  say('  着火順のいちばん悪い3例:')
  for (const x of worst) {
    say(`    - ${x.title}: 最長の待ち${x.waitMinutes}分が、準備の終わった${x.readyAt}分から${x.rank}番目・${x.startMin}分地点で着火`)
    say(`      ${x.text.slice(0, 54)}`)
  }
}
say()
say('  ※参考2: 判定に左右されない形で「長い加熱を先に始めているか」を見る。')
say('     **その品でいちばん長い工程（待ち・手作業を問わない）が、何分地点で始まったか**。')
say()
say('| 組み合わせ | 対象の品数 | 着火時刻の中央値 | **全体に対する位置（中央値）** | 後半(50%超)で始まる割合 |')
say('|---|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows }]) {
  const rows = s.rows ?? nAnalyses.get(s.key)
  const list = rows.flatMap((a) => a.longestStarts)
  const posn = list.map((x) => pct(x.startMin, x.total))
  say(
    `| ${s.key} | ${list.length} | ${f1(median(list.map((x) => x.startMin)))}分 | **${f1(median(posn))}%** | ${f1(pct(posn.filter((x) => x > 50).length, posn.length))}% |`,
  )
}
say()

// ---------------------------------------------------------------- N4
say('■ N4. 混在手順の両方計上（手作業と待ちが同居する手順で、両方の時間が計上された割合。線＝90%以上）')
say()
say('| レシピ群 | 手順数 | 混在手順 | 両方計上 | 待ちだけ計上 | 手作業だけ計上 | **両方計上の割合** | 判定 |')
say('|---|---|---|---|---|---|---|---|')
const mixedWorst = []
function n4Row(label, recipes, judge) {
  let steps = 0
  let mixed = 0
  let both = 0
  let waitOnly = 0
  let activeOnly = 0
  for (const r of recipes) {
    const timeline = buildCookTimeline([r])
    // 元の手順1つに対応する段取り工程をまとめる（湯沸かしの切り出しで1手順が2工程になることがある）
    const byStep = new Map()
    for (const it of timeline.items) {
      const key = it.splitOf ?? it.stepNumber
      const acc = byStep.get(key) ?? { wait: 0, active: 0 }
      acc.wait += it.waitMinutes
      acc.active += it.activeMinutes
      byStep.set(key, acc)
    }
    r.steps.forEach((s, i) => {
      steps++
      if (!isMixedStep(s)) return
      mixed++
      const acc = byStep.get(i + 1) ?? { wait: 0, active: 0 }
      if (acc.wait === 0 && acc.active === 0) {
        // 「半日〜一晩漬ける」等、今回の調理では終わらない待ち（longRest）は本体が意図して0分にしている。
        // 手を動かす部分まで0分になっている点は同じ問題だが、別扱いで数える
        activeOnly++
        mixedWorst.push({ kind: 'どちらも0分（長い待ち）', title: r.title, no: i + 1, text: s.text, wait: 0, active: 0, lost: estimateActiveMinutes(s).minutes })
      } else if (acc.wait > 0 && acc.active > 0) both++
      else if (acc.wait > 0) {
        waitOnly++
        // 消えた手作業ぶん＝待ちの語より前（手を動かす部分）だけを取り出して見積る。
        // 「20分煮ます」の20分が手作業の見積りに混ざらないよう、時間表記は落としてから見積る
        const head = s.text
          .slice(0, firstIdx(maskForMeasure(s.text), [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS, IMPLIED_WAIT_CUE]))
          .replace(/[0-9０-９]+(?:\.[0-9]+)?\s*(?:分|秒|時間)/g, '')
        mixedWorst.push({ kind: '待ちだけ', title: r.title, no: i + 1, text: s.text, wait: acc.wait, active: acc.active, lost: estimateActiveMinutes({ text: head }).minutes })
      } else {
        activeOnly++
        mixedWorst.push({ kind: '手作業だけ', title: r.title, no: i + 1, text: s.text, wait: acc.wait, active: acc.active, lost: resolveWaitMinutes(s) ?? 0 })
      }
    })
  }
  const rate = pct(both, mixed)
  say(
    `| ${label} | ${steps} | ${mixed} | ${both} | ${waitOnly} | ${activeOnly} | **${f1(rate)}%** | ${judge ? verdict(rate >= N_LINE.n4) : '（参考）'} |`,
  )
  return { mixed, both }
}
n4Row('同梱109品', starterRecipes, false)
const n4Wild = []
for (const g of [...groups.slice(1), ...holdoutGroups]) n4Wild.push(...g.recipes)
for (const g of [...groups.slice(1), ...holdoutGroups]) n4Row(g.key, g.recipes, true)
const n4Total = n4Row('**野生＋ホールドアウト 合計**', n4Wild, true)
say()
{
  const worst = dedupe(mixedWorst.slice().sort((a, b) => b.lost - a.lost), (x) => x.title + x.no).slice(0, 3)
  say('  いちばん悪い3例（計上されずに消えた時間の大きい順）:')
  for (const x of worst) {
    say(`    - ${x.title} 手順${x.no}: ${x.text.slice(0, 50)}`)
    say(`      段取りでは ${x.kind}（待ち${x.wait}分・手作業${x.active}分）＝もう片方の約${x.lost}分が0分として扱われている`)
  }
}
say()

// ---------------------------------------------------------------- N5
say('■ N5. 器具の重なり（設定した数を超えて同時に使う段取りを出した件数。線＝0件・1口が最重要）')
say()
say('  ※器具の占有はまだ実装されていない。**いまの出力を、器具の設定に当てはめて数え直した**もの。')
say(`  ※数える器具は docs/72 §3 の4つ（コンロ・電子レンジ・魚焼きグリル・トースター）。`)
say()
say('| 組み合わせ | 通り数 | **コンロ1口で重なる** | コンロ2口 | コンロ3口 | レンジ | グリル | トースター | 判定(1口) |')
say('|---|---|---|---|---|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows, wild: true }]) {
  const rows = s.rows ?? nAnalyses.get(s.key)
  const over = (key, cap) => rows.filter((a) => a.concurrency[key] > cap).length
  const c1 = over('stove', 1)
  say(
    `| ${s.key} | ${rows.length} | **${c1}件（${f1(pct(c1, rows.length))}%）** | ${over('stove', 2)}件 | ${over('stove', 3)}件 | ` +
      `${over('microwave', 1)}件 | ${over('grill', 1)}件 | ${over('toaster', 1)}件 | ${s.wild ? verdict(c1 === N_LINE.n5) : '（参考）'} |`,
  )
}
say()
{
  const worst = wildRows
    .filter((a) => a.concurrency.stove > 1)
    .sort((a, b) => b.concurrency.stove - a.concurrency.stove)
    .slice(0, 3)
  say('  いちばん悪い3例（コンロ1口の家では成立しない段取り）:')
  for (const a of worst) {
    const uses = a.timeline.items
      .map((it) => ({ it, use: applianceUse(it) }))
      .filter((x) => x.use && x.use.key === 'stove' && x.use.end > x.use.start)
    // いちばん重なっている時刻を探して、そこで同時に火にかかっているものだけを出す
    let peakAt = 0
    let peak = 0
    for (const { use } of uses) {
      const n = uses.filter((x) => x.use.start <= use.start && x.use.end > use.start).length
      if (n > peak) {
        peak = n
        peakAt = use.start
      }
    }
    say(`    - ${nameOf(a)}（${peakAt}分の時点でコンロを同時に${peak}口）`)
    for (const { it, use } of uses.filter((x) => x.use.start <= peakAt && x.use.end > peakAt)) {
      say(`      ${use.start}〜${use.end}分 [${it.recipeTitle}] ${it.text.slice(0, 34)}`)
    }
  }
}
say()

// ---------------------------------------------------------------- N6
say('■ N6. 利用者の並行指示（「その間に」が直前の待ちの中に置かれた割合。線＝80%以上）')
say()
say('  ※既存の野生標本18品にもホールドアウト9品にも **「その間に」型の指示は1件も無い**')
say('     （分母0＝この標本では測れない）。そのため「その間に」を本文に書いたレシピ6品を')
say('     `scripts/data/navi-parallel-recipes.mjs` に別途書き下ろし、そちらで判定する。')
say('  ※「〜しながら」は「ほぐしながら炒める」のように1つの動作の中の同時が大半で、並行の指示では')
say('     ないため主指標から外し、件数だけ下に出す。')
say()
say('| 組み合わせ | 通り数 | 「その間に」の延べ数 | 直前に待ちあり | **待ちの中に置けた割合** | 直前の待ちが見つからない | 判定 |')
say('|---|---|---|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows, wild: true }]) {
  const rows = s.rows ?? nAnalyses.get(s.key)
  const cues = rows.flatMap((a) => a.cues).filter((c) => c.cue === 'meanwhile')
  const withWait = cues.filter((c) => c.hasWait)
  const inside = withWait.filter((c) => c.inside).length
  const rate = pct(inside, withWait.length)
  const judged = s.cue || s.wild
  say(
    `| ${s.key} | ${rows.length} | ${cues.length} | ${withWait.length} | **${withWait.length === 0 ? '—' : f1(rate) + '%'}** | ${cues.length - withWait.length} | ` +
      `${judged ? (withWait.length === 0 ? '（測れない・該当なし）' : verdict(rate >= N_LINE.n6)) : '（参考）'} |`,
  )
}
say()
{
  const cueRows = nAnalyses.get('並行指示の標本（全20通り）')
  const all = [...wildRows, ...cueRows].flatMap((a) => a.cues)
  const nagara = all.filter((c) => c.cue === 'nagara')
  say(
    `  「〜しながら」の内訳（参考）: 延べ${nagara.length}件・直前に待ちあり${nagara.filter((c) => c.hasWait).length}件・` +
      `そのうち中に置けた${nagara.filter((c) => c.inside).length}件`,
  )
  const nagaraSample = [...new Set(nagara.map((c) => c.text.slice(0, 34)))].slice(0, 3)
  for (const t of nagaraSample) say(`    例: ${t}`)
  say()
  {
    // なぜ0%になるのかを数字で示す（打ち手を決めるのに要る）
    const mw = cueRows.flatMap((a) => a.cues).filter((c) => c.cue === 'meanwhile' && c.hasWait)
    say(
      `  内訳: 「その間に」の手順が、その待ちの**次の手順**として書かれているもの ${mw.filter((c) => c.nextOfWait).length}件 / ${mw.length}件`,
    )
    say('    ＝レシピ内の手順は「前の手順が終わるまで着手しない」作りなので、**同じ品の次の手順は')
    say('      その待ちの中に置けない**（置けるのは他の品の手順だけ）。N6が0%なのはこの作りが理由で、')
    say('      辞書や並べ替えの調整では動かない。')
    say()
  }
  const worst = dedupe(
    cueRows
      .flatMap((a) => a.cues)
      .filter((c) => c.cue === 'meanwhile' && c.hasWait && !c.inside)
      .sort((a, b) => b.startMin - b.waitEnd - (a.startMin - a.waitEnd)),
    (c) => c.title + c.text,
  ).slice(0, 3)
  say('  いちばん悪い3例（待ちが明けてから何分も後に置かれたもの）:')
  if (worst.length === 0) say('    （なし）')
  for (const c of worst) {
    say(`    - ${c.title}: ${c.text.slice(0, 46)}`)
    say(`      直前の待ちは${c.waitEnd}分で明けているのに、${c.startMin}分地点（${c.startMin - c.waitEnd}分後）に置かれた`)
  }
}
say()

// ---------------------------------------------------------------- まとめ
say('■ N. 6項目のまとめ（野生レシピ＋ホールドアウト。同梱109品は判定に使わない）')
say()
say('| 記号 | 見るもの | 線 | **現状値** | 判定 |')
say('|---|---|---|---|---|')
{
  const ratios = wildRows.map((a) => pct(a.spread, a.total))
  const n1 = median(ratios)
  const n1over = pct(ratios.filter((x) => x > N_LINE.n1).length, wildRows.length)
  const hot = wildRows.filter((a) => a.hotIdle != null).map((a) => a.hotIdle)
  const n2 = Math.max(...hot)
  const ranks = wildRows.flatMap((a) => a.ignitions).map((x) => x.rank)
  const n3rank = median(ranks)
  const n3 = n3Stranded
  const n4 = pct(n4Total.both, n4Total.mixed)
  const n5 = wildRows.filter((a) => a.concurrency.stove > 1).length
  // N6だけは専用標本で測る（既存の標本に「その間に」が1件も無いため。上のN6の表を参照）
  const cues = nAnalyses
    .get('並行指示の標本（全20通り）')
    .flatMap((a) => a.cues)
    .filter((c) => c.cue === 'meanwhile' && c.hasWait)
  const n6 = pct(cues.filter((c) => c.inside).length, cues.length)
  say(`| N1 完成の揃い | **開きが30%を超えた組み合わせの割合** | 20%以下 | **${f1(n1over)}%**（開きの割合の中央値は${f1(n1)}%） | ${verdict(n1over <= N_LINE.n1over)} |`)
  say(`| N2 温かい品と汁物の放置 | 最後の品より何分早く終わるか（最大） | 10分以内 | **${n2}分** | ${verdict(n2 <= N_LINE.n2)} |`)
  say(`| N3 放置調理の取りこぼし | **手作業と判定された8分以上の放置調理** | 0件 | **${n3}件**（最長待ちの着火順は中央値${f1(n3rank)}番目） | ${verdict(n3 === N_LINE.n3)} |`)
  say(`| N4 混在手順の両方計上 | 両方の時間が計上された割合 | 90%以上 | **${f1(n4)}%** | ${verdict(n4 >= N_LINE.n4)} |`)
  say(`| N5 器具の重なり | コンロ1口で重なる段取りの件数 | 0件 | **${n5}件 / ${wildRows.length}通り** | ${verdict(n5 === N_LINE.n5)} |`)
  say(`| N6 利用者の並行指示 | 直前の待ちの中に置けた割合 | 80%以上 | **${f1(n6)}%**（並行指示の標本${cues.length}件） | ${verdict(n6 >= N_LINE.n6)} |`)
}
say()

// ---------------------------------------------------------------- R3の答え合わせ
say('■ N0. R3の実測が再現できるか（道具が正しく測れているかの答え合わせ）')
say()
say('  docs/71 R3の実測: **全体44分／みそ汁が13分地点・ごま和えが16分地点で完成／鶏は約40分**')
say('  **＝27分の放置（27分÷44分＝61%）／「その間に」が9番目・約16分地点／段取りは全12工程**')
say('  標本は `scripts/data/navi-r3-recipes.mjs`（R3の本文は記録に残っていないため、docs/71 に')
say('  引用された断片と書き方の特徴だけから書き起こした**再現**）。')
say()
{
  const r3 = [...buildPasteRecipes(r3PasteSamples, 'R3再現'), ...buildManualRecipes(r3ManualSamples, 'R3再現')]
  const a = analyzePlan(r3)
  say(`  段取り全体: ${a.total}分・全${a.timeline.items.length}工程`)
  for (const it of a.timeline.items) {
    const kind = it.kind === 'wait' ? `待ち${it.waitMinutes}分` : `手作業${it.activeMinutes}分`
    say(`    ${String(it.order).padStart(2)}. ${String(it.startMin).padStart(2)}〜${String(it.endMin).padStart(2)}分 [${it.recipeTitle}] (${kind}) ${it.text.slice(0, 46)}`)
  }
  say()
  for (const r of r3) {
    say(
      `    完成時刻 ${r.title}: ${a.finish.get(r.id)}分（温度の判定＝${recipeServeTemp(r)}／種別＝${r.dishType}／N2の対象＝${isN2Target(r) ? 'はい' : 'いいえ'}）`,
    )
  }
  say()
  say(`    N1 開き ${a.spread}分 ÷ 全体 ${a.total}分 ＝ ${f1(pct(a.spread, a.total))}%（R3実測 27分÷44分＝61.4%）`)
  say(`    N2 温かい品と汁物の放置 ${a.hotIdle ?? '—'}分`)
  for (const x of a.ignitions) say(`    N3 ${x.title}: 最長待ち${x.waitMinutes}分が準備後${x.rank}番目・${x.startMin}分地点で着火`)
  for (const x of a.longestStarts) {
    say(`    N3補助 ${x.title}: 最長工程${x.minutes}分（${x.kind === 'wait' ? '待ち' : '手作業'}）が${x.startMin}分地点＝全体の${f1(pct(x.startMin, x.total))}%地点で着火`)
  }
  say(`    N5 同時に使う口数の最大 コンロ${a.concurrency.stove}・レンジ${a.concurrency.microwave}・グリル${a.concurrency.grill}`)
  say(`    R3本人の手組み（28〜30分・全部同時着地）との差: 全体 ${a.total - 30}分ぶん長い・開き ${a.spread}分`)
  for (const c of a.cues) {
    say(`    N6 「${c.text.slice(0, 24)}」 → ${c.startMin}分地点に配置・直前の待ちは${c.hasWait ? `${c.waitEnd}分で明ける` : '見つからない'} → ${c.inside ? '待ちの中' : '**待ちの外**'}`)
  }
  say()
  for (const r of r3) {
    for (const it of buildCookTimeline([r]).items) {
      if (isStrandedLongCook(it)) say(`    ※ ${r.title}「${it.text.slice(0, 30)}」は**待ちではなく手作業${it.activeMinutes}分**と判定されている`)
    }
  }
}
say()

console.log(out.join('\n'))
