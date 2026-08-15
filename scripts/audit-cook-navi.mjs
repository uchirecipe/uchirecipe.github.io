/**
 * 並行調理ナビの診断（2026-08-08 便p85/navi-audit）。
 *
 * オーナー問題提起「今の仕組みでは、ユーザーが登録したレシピでは並行ナビが破綻すると思います」を、
 * 憶測でなく数字で確かめるための計測スクリプト。**アプリの挙動は一切変えない**（読むだけ）。
 *
 * 実行: npx tsx scripts/audit-cook-navi.mjs            … 数値のサマリだけ
 *       npx tsx scripts/audit-cook-navi.mjs --dump     … 生成された段取りの全文も出す
 *       N7_DUMP=n7.json npx tsx scripts/audit-cook-navi.mjs
 *                                                     … N7（火にかけたままの放置）の超過を1件ずつJSONに
 *       N4_DUMP=n4.json npx tsx scripts/audit-cook-navi.mjs
 *                                                     … N4（混在手順）の1件ずつをJSONに（型に分けて数えるため）
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
  // 2026-08-13 便GB（並べ方の作り直し）で足した並べ替えの部品
  hasParallelCue,
  // N4_DUMP（混在手順の書き出し）でだけ使う。原因調べ用で、判定そのものには使わない（2026-08-15 便GR）
  splitMixedStep,
  splitWaitFirstStep,
} from '../src/logic/cookNavi.ts'
import { findTimeTokens } from '../src/logic/time.ts'
// 2026-08-13 便GC（器具の占有）。**器具の見分けそのものは下で別に書いた独立版を使う**
// （本体の見分けで本体を検査すると答え合わせにならないため）。ここで使うのは台数の型だけ
import { DEFAULT_KITCHEN, applianceCapacity } from '../src/logic/cookAppliance.ts'
import { stepIngredientAmounts } from '../src/logic/naviIngredients.ts'
import { buildIngredientNames, findIngredientMatches } from '../src/logic/ingredientSpans.ts'
import { parseRecipeText } from '../src/logic/parseRecipeText.ts'
// 取り込んだ手順の本文に書かれた時間を分数欄へ写す（実機の登録経路。2026-08-08 便ED 打ち手#2）
import { stepMinutesFromText } from '../src/logic/importStepMinutes.ts'
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
/** N7（火にかけたままの放置）の超過を1件ずつ書き出す先。環境変数で指定したときだけ動く */
const N7_DUMP = process.env.N7_DUMP ?? null
/** N4（混在手順）の1件ずつを書き出す先。環境変数で指定したときだけ動く（2026-08-15 便GR） */
const N4_DUMP = process.env.N4_DUMP ?? null

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

/**
 * 取り込んだ手順を、**アプリと同じ形**の Step にする（2026-08-14 便GK）。
 *
 * `src/pages/RecipeFormPage.tsx` の `toImportedStepRows` が、2026-08-08 便ED の打ち手#2 で
 * **本文に書いてある時間を分数欄へ写す**ようになっている（`logic/importStepMinutes.ts`）。
 * この監査はその転記を通しておらず、**分数欄が必ず空**のレシピを「取り込んだレシピ」として
 * 測り続けていた。そのため、分数欄の有無で挙動が変わる手当て（混在手順の分割など）は
 * 監査では効いて見えるのに実機では1件も効かない、という食い違いが起きる
 * （実操作テスト3回目で実際に起きた。docs/71 の追記）。
 * 測る素材を実機にそろえる。
 */
const toImportedSteps = (texts) =>
  texts.map((text) => {
    const minutes = stepMinutesFromText(text)
    return minutes != null ? { text, minutes } : { text }
  })

/** A: URL取り込み。Worker応答→フォーム行→保存レシピ、と実装と同じ順で通す */
const buildUrlRecipes = (samples, group) => {
  return samples.map((s) => {
    const rows = buildImportedIngredientRows(s.ingredients.map((i) => ({ name: i.name, amount: i.amount })))
    const steps = toImportedSteps(filterImportedSteps(s.steps))
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
}

/** B: 貼り付け取り込み。生テキストを parseRecipeText に通し、本文の時間を分数欄へ写す（実機と同じ） */
const buildPasteRecipes = (samples, group) =>
  samples.map((s) => {
    const parsed = parseRecipeText(s.raw)
    return makeRecipe({
      title: parsed.title ?? s.id,
      servings: parsed.servings ?? 2,
      cookMinutes: parsed.cookMinutes,
      ingredients: parsed.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit, memo: i.memo })),
      steps: toImportedSteps(parsed.steps),
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
            // 利用者の「その間に」（2026-08-13 便GB。直前が待ちのときだけ有効）
            parallelCue: false,
          }
        },
      )
      for (let i = 1; i < steps.length; i++) {
        steps[i].parallelCue =
          steps[i].kind === 'active' &&
          steps[i - 1].kind === 'wait' &&
          steps[i - 1].waitMinutes > 0 &&
          hasParallelCue(steps[i].text)
      }
      return {
        colorIndex,
        steps,
        ptr: 0,
        readyAt: 0,
        waitDoneAt: 0,
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
  const remainingActive = (j) => {
    let t = 0
    for (let i = j.ptr; i < j.steps.length; i++)
      if (j.steps[i].kind !== 'wait') t += j.steps[i].activeMinutes
    return t
  }
  /** 「着火」とみなす待ちの長さ（アプリ本体の IGNITION_WAIT_MINUTES と同じ値） */
  const IGNITION_WAIT = 8
  const hasIgnitionAhead = (j) => {
    for (let i = j.ptr; i < j.steps.length; i++)
      if (j.steps[i].kind === 'wait' && j.steps[i].waitMinutes >= IGNITION_WAIT) return true
    return false
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
    // 手作業の締め切り判定は**ほかの品の締め切りだけ**を見る（アプリ本体と同じ。2026-08-12 便FU-1）。
    // 「その間に」で自分の鍋の待ちの中に置く手順だけは自分の締め切りも見る（2026-08-13 便GB）
    const fitsBeforeDeadline = (j) => {
      const othersDeadline = jobs.reduce(
        (min, k) => (k !== j && k.attendUntil > cookAt ? Math.min(min, k.attendUntil) : min),
        Number.POSITIVE_INFINITY,
      )
      const ownDeadline =
        j.steps[j.ptr].parallelCue && j.attendUntil > cookAt ? j.attendUntil : Number.POSITIVE_INFINITY
      return cookAt + j.steps[j.ptr].activeMinutes <= Math.min(othersDeadline, ownDeadline)
    }
    const projectedEnd = (j) => Math.max(j.readyAt, cookAt) + remainingSpan(j)
    const attendDue = (j) => (j.attendUntil > 0 && j.waitDoneAt <= cookAt ? 0 : 1)
    const cueDue = (j) => (j.steps[j.ptr].parallelCue && j.waitDoneAt > cookAt ? 0 : 1)
    const ignitionRank = (j) => (hasIgnitionAhead(j) ? 0 : 1)
    const cutRun = (j) => (lastActiveCategory === 'cut' && j.steps[j.ptr].category === 'cut' ? 0 : 1)
    const sameCat = (j) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
    // 完成の順番（冷やす品は先に・熱々の品は最後に仕上げる）。その品の最後の手順にだけ効かせる
    const finishBias = (j) => (j.ptr === j.steps.length - 1 ? j.serveRank : 1)
    // 温かい品の仕上げは、ほかの品の完成に合わせて後ろへ寄せる（2026-08-13 便GB）
    const holdsFinish = (j) => {
      if (j.serveRank < 2) return false
      if (j.ptr !== j.steps.length - 1) return false
      if (j.steps[j.ptr].kind !== 'active') return false
      const othersEnd = jobs.reduce(
        (max, k) => (k !== j && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max),
        -1,
      )
      return othersEnd > cookAt + j.steps[j.ptr].activeMinutes
    }
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
          cueDue(a) - cueDue(b) ||
          cutRun(a) - cutRun(b) ||
          ignitionRank(a) - ignitionRank(b) ||
          finishBias(a) - finishBias(b) ||
          remainingSpan(b) - remainingSpan(a) ||
          stepA.stageRank - stepB.stageRank ||
          sameCat(a) - sameCat(b) ||
          a.colorIndex - b.colorIndex
        )
      })[0]
    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    waits.sort((a, b) => b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes || a.colorIndex - b.colorIndex)
    const fittingActives = ready.filter(
      (j) => j.steps[j.ptr].kind === 'active' && fitsBeforeDeadline(j),
    )
    const eagerActives = fittingActives.filter((j) => !holdsFinish(j))
    const shortestActive = eagerActives.reduce(
      (min, j) => Math.min(min, j.steps[j.ptr].activeMinutes),
      Number.POSITIVE_INFINITY,
    )
    const dueWaits = waits.filter((j) => j.attendUntil > 0)
    const waitWouldIdle =
      waits.length > 0 &&
      dueWaits.length === 0 &&
      eagerActives.length > 0 &&
      waits[0].steps[waits[0].ptr].attendWithin < shortestActive
    // 漬け込み・寝かせの前に、いま着手できる切る工程を先に片付ける（アプリ本体と同じ規則）
    const readyCuts = eagerActives.filter((j) => j.steps[j.ptr].category === 'cut')
    const soakOnly = waits.length > 0 && waits.every((j) => j.steps[j.ptr].soakWait)
    let chosen
    let holdFinish = false
    if (dueWaits.length > 0) {
      chosen = dueWaits[0]
    } else if (waits.length > 0 && !(soakOnly && readyCuts.length > 0) && !waitWouldIdle) {
      chosen = waits[0]
    } else if (soakOnly && readyCuts.length > 0) {
      chosen = pickActive(readyCuts)
    } else if (eagerActives.length > 0) {
      chosen = pickActive(eagerActives)
    } else if (waits.length > 0) {
      chosen = waits[0]
    } else if (fittingActives.length > 0) {
      chosen = pickActive(fittingActives)
      const held = chosen.steps[chosen.ptr]
      const othersEnd = jobs.reduce(
        (max, k) => (k !== chosen && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max),
        -1,
      )
      const othersActive = jobs.reduce(
        (sum, k) => (k !== chosen && k.ptr < k.steps.length ? sum + remainingActive(k) : sum),
        0,
      )
      const nextAt = active.reduce(
        (next, j) => (j !== chosen && j.readyAt > cookAt ? Math.min(next, j.readyAt) : next),
        attendDeadline,
      )
      if (
        Number.isFinite(nextAt) &&
        nextAt > cookAt &&
        othersEnd - nextAt >= othersActive + held.activeMinutes
      ) {
        cookAt = nextAt
        continue
      }
      holdFinish = true
    } else {
      cookAt = active.reduce((next, j) => (j.readyAt > cookAt ? Math.min(next, j.readyAt) : next), attendDeadline)
      continue
    }
    const step = chosen.steps[chosen.ptr]
    let startMin = cookAt
    if (holdFinish) {
      const othersEnd = jobs.reduce(
        (max, k) => (k !== chosen && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max),
        -1,
      )
      const nextAt = active.reduce(
        (next, j) => (j !== chosen && j.readyAt > cookAt ? Math.min(next, j.readyAt) : next),
        attendDeadline,
      )
      const landing = Math.min(Number.isFinite(nextAt) ? nextAt : othersEnd, othersEnd)
      if (Number.isFinite(landing)) startMin = Math.max(cookAt, landing - step.activeMinutes)
    }
    const keepsPot = step.kind === 'active' && step.parallelCue && chosen.waitDoneAt > startMin
    if (!keepsPot) chosen.attendUntil = 0
    let endMin
    if (step.kind === 'wait') {
      endMin = startMin + step.waitMinutes
      chosen.waitDoneAt = endMin
      chosen.readyAt = chosen.steps[chosen.ptr + 1]?.parallelCue ? startMin : endMin
      const attendUntil = startMin + step.attendWithin
      chosen.attendUntil = Number.isFinite(attendUntil) ? attendUntil : 0
    } else {
      endMin = startMin + step.activeMinutes
      cookAt = endMin
      chosen.readyAt = Math.max(endMin, chosen.waitDoneAt)
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
//  【新規】段取りの質を測る8項目 N1〜N8（docs/72 §2・2026-08-13 便FZ／N7・N8は 2026-08-14 便GG）
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
const N_LINE = { n1: 30, n1over: 20, n2: 10, n3: 0, n3rank: 1, n4: 90, n5: 0, n6: 80, n7: 0 }
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
 * 後半は**器具の見分けのために足した分**（便FZで追加）。「油揚げは短冊切りにする」が
 * 「揚げ」に当たってコンロ使用に化けていた（実測で見つけて塞いだ）。
 *
 * 2026-08-13 便GC: 「蒸し大豆」を足した。**測る側の取りこぼし**で、
 * 「ボウルにツナ・蒸し大豆…を入れてあえて器に盛る」がコンロ使用と数えられ、
 * 同梱109品でN5が3件残っていた（本体の見分けは正しく器具なしと読んでいた）。
 * 線は動かしていない＝測り違いを直しただけ。
 */
const MEASURE_NON_WAIT_NOUN =
  /漬け汁|漬けだれ|漬けタレ|漬けダレ|漬け床|漬物|漬け物|オーブンシート|オーブンペーパー|しょうゆ|つゆ|煮干し|蒸し器|蒸しパン|ゆで卵|ゆでうどん|ゆで麺|お浸し|油揚げ|厚揚げ|薄揚げ|揚げ玉|さつま揚げ|焼きのり|焼き海苔|焼き豆腐|焼きそば麺|めんつゆ|煮汁|煮物|煮もの|蒸し鶏|蒸しタオル|蒸し大豆|蒸し野菜|蒸しえび|蒸しエビ|蒸しどり/g
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
function applianceUse(item, kitchen = DEFAULT_KITCHEN) {
  const found = stepAppliance(item.text)
  if (!found) return undefined
  // 持っていない器具の工程は、フライパン・鍋でやることになる＝コンロが1口ふさがる（本体と同じ扱い）
  const key = applianceCapacity(kitchen, found) === 0 ? 'stove' : found
  if (item.kind === 'wait') {
    if (item.waitMinutes <= 0) return undefined
    if (waitUrgency({ text: item.text, minutes: item.minutes }) === 'relaxed') return undefined
  } else if (item.activeMinutes <= 0) return undefined
  return { key, start: item.startMin, end: item.endMin }
}

/**
 * 2つ以上の器具を**同時に使っている時間**の合計（分）。docs/72 第3段Bの「もっと重ねる」を
 * 短縮率とは別の角度から見るための数字（口数を増やしたときに、実際に火が重なっているか）。
 */
function overlapMinutes(intervals) {
  const points = [...new Set(intervals.flatMap((iv) => [iv.start, iv.end]))].sort((a, b) => a - b)
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]
    const to = points[i + 1]
    const busy = intervals.filter((iv) => iv.start <= from && iv.end >= to && iv.end > iv.start).length
    if (busy >= 2) total += to - from
  }
  return total
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

/**
 * 【N7 火にかけたままの放置】2026-08-14 便GG（docs/72 第5段）。
 *
 * きっかけ（利用者・料理歴20年の原文）:
 *   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が
 *     挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と
 *     書いてあるのに。豆腐は崩れるしわかめは溶けます。」
 *
 * **N1〜N6では1件も捉えられない**。N2は「完成が早すぎる」を見るが、この段取りではみそ汁の完成が
 * 主菜と揃っている（放置4分＝合格）。**揃えるために火にかけたまま止めていた**のがこの症状で、
 * N2は完成時刻しか見ないので、その間に鍋が煮え続けていることを知らない。
 *
 * 測り方: 品ごとに「いま火にかかっているか」を段取りの順に追い、**火にかかったまま次の手順に
 * 手が戻るまでの時間**が猶予を超えた件数を数える。
 *   - 火がつく   … その工程が加熱器具（コンロ・グリル・レンジ・トースター）を使う
 *                  （漬ける・冷ますの待ち＝relaxed は火にかかっていないので対象外）
 *   - 火が消える … 火を止める・火からおろす・器に盛る・取り出す・ざるにあげる・冷ます 等の語
 *   - どちらでもない工程では**状態を引き継ぐ**。これが肝心で、「沸いたら豆腐とわかめを入れる」は
 *     火の語を持たないが鍋は火にかかったままなので、次の「火を止める」までが放置になる
 *     （＝アプリ本体が締め切りを持てていなかったのと同じ穴を、測る側で塞ぐ）
 */
const MEASURE_HEAT_OFF =
  /火を止め|火をとめ|火を消|火からおろ|火から下ろ|火から外|火からはず|器に盛|皿に盛|椀に|お椀に|盛り付け|盛りつけ|盛って|取り出|とり出|ざるにあげ|ざるに上げ|ざるにとり|ざるに移|ザルにあげ|ザルに上げ|ザルにとり|ザルに移|湯を切|湯をき|湯切り|油をき|油を切|水気をき|水気を切|水けをき|水けを切|水気をしぼ|水気を絞|水けをしぼ|水けを絞|つぶ|水にとる|水に取る|水にさら|流水|洗う|洗い|洗っ|冷水|冷ま|粗熱|できあがり|出来上がり/
/** 火にかかっている合図（火を下ろす語との位置くらべに使う） */
const MEASURE_HEAT_ON =
  /火にかけ|火に掛け|火をつけ|火を入れ|点火|強火|中火|弱火|とろ火|煮|茹|ゆで|沸か|沸騰|煮立|炒め|炒る|揚げ|蒸|焼く|焼き|焼い|熱し|熱する|加熱|温め/
/** patterns のどれかが最後に現れる位置（無ければ -1） */
function lastIdxOf(text, patterns) {
  let last = -1
  for (const re of patterns) {
    const g = new RegExp(re.source, 'g')
    let m
    while ((m = g.exec(text)) !== null) {
      if (m.index > last) last = m.index
      if (m.index === g.lastIndex) g.lastIndex++
    }
  }
  return last
}
/**
 * 火にかけたまま次の手順まで空けてよい時間（分）。
 *
 * 3分の根拠は利用者自身の手順そのもの＝「豆腐を入れて味噌を溶くのは焼き上がりの3分前」。
 * レシピ本文の「1〜2分煮る」に1分の余裕を足した幅で、**短い煮込みを最後まで通せる**。
 * 煮込み・焼き物はもともと幅で書かれるので、本体の超過許容（待ちの2割・上限5分）が
 * これより大きいときはそちらを使う（＝猶予は3〜5分）。**relaxed（漬ける・冷ます）は火の上に無い**。
 */
const HEAT_IDLE_ALLOWANCE = 3
function heatAllowanceOf(item) {
  if (item.kind !== 'wait') return HEAT_IDLE_ALLOWANCE
  const over = waitOverrunAllowance({ text: item.text, minutes: item.minutes }, item.waitMinutes)
  return Number.isFinite(over) ? Math.max(HEAT_IDLE_ALLOWANCE, over) : Number.POSITIVE_INFINITY
}
/**
 * 【N8 仕上げの鮮度（参考値）】和える・混ぜる・盛る・かける等、**食卓に出す直前にやりたい一手**。
 * R4の指摘「私は絞ったほうれん草だけ用意しておいて、和えるのは食べる直前にします。早く和えると
 * 水が出て味が薄まる」を数字で見るためだけの項目で、**線は引かない**
 * （冷たい品を先に仕上げるのは2026-08-08 便EGのオーナー指示であり、線にすると指示と衝突する）。
 */
const MEASURE_FINISH_ACTION = /和え|あえ|混ぜ|盛る|盛り|盛っ|かける|かけて|添え|ふる|ふり|ふっ|散ら|よそ/
/**
 * 【手でこねる・形を作る工程は、火の上ではできない】2026-08-15 便GM。
 *
 * 便GGの「どちらでもない工程では状態を引き継ぐ（keep）」は、「沸いたら豆腐とわかめを入れる」を
 * 捕まえるための肝だが、**中身が鍋から出ている品まで火にかけたままと読んでしまう**。
 * 実例（ハンバーグ・野生標本C）:
 *   1 玉ねぎをみじん切りにして炒める → 2 ひき肉とまぜてこねる → 3 形を作る → 4 焼く
 * 本文に「火を止める」が無いため、1で付いた火が2・3・4までずっと続いていると読み、
 * 1→2・2→3・3→4 の空きをすべて放置に数えていた（108件中9件）。
 * 実際には、**ひき肉を手でこねる工程はボウルの中の作業**で、炒めた玉ねぎはとっくに鍋から出ている。
 * 火を点けたままボウルで肉をこねる台所は無い＝**この工程が来る時点で火は下りている**。
 * したがって、
 *   ①この工程は「火が消える」（次の「焼く」で改めて火がつく）
 *   ②**この工程に入るまでの空きも数えない**（火は前の加熱が済んだ時点で止まっている）
 * ②が要るのは、放置の判定が「その工程が始まった時刻」で行われるため（①だけでは1→2が残る）。
 *
 * 語は**手でタネを扱う工程だけ**に絞る。「丸める」「混ぜる」は鍋の中でもやるので入れない
 * （「煮汁を混ぜながら煮る」を火から下ろすと読むと、N7が本来の症状を取りこぼす）。
 */
const MEASURE_OFF_HEAT_BY_HAND = /こね|捏ね|成形|形を作|形を整え|形にする/

/**
 * その工程のあと、その品は火にかかっているか（'on' 火がつく／'off' 火が消える／'keep' 変わらない）。
 *
 * **数えるのはコンロ（IH含む）だけ**にした（司令部の案から範囲を狭めた・理由は下記）。
 * 司令部の案は「**加熱を伴う待ち**が終わってから次の手順まで」だったが、実測しながら精査すると
 * 電子レンジ・魚焼きグリル・トースターは**待ちが明けた時点で加熱が止まる**（タイマーで切れる／
 * 扉を開けて取り出す。レシピにも「3分加熱」と時間が書いてあるので、利用者は止める合図を持っている）。
 * そこに置きっぱなしになるのは「冷める」問題＝**N2が測っている軸**で、料理が失敗する軸ではない。
 * 対してコンロは、**火を止める合図が段取りに出てこない限り加熱が続く**。利用者の原文
 * 「豆腐は崩れるしわかめは溶けます」「#7の後に『火を止める』も『弱火にする』も出てきません」は
 * まさにこれで、N7はこの1軸だけを見る。**混ぜると線（0件）が届かない数字になり、
 * 症状の切れ味も鈍る**（レンジ待ちの1分の遅れと、鍋の18分の煮すぎが同じ1件になる）。
 */
function heatTransition(item) {
  const t = maskForMeasure(item.text)
  // 火を下ろす語と火にかける語が両方あるときは、**あとに来たほうが主役**
  // （「水気を絞って鍋に戻し、5分煮る」は火にかける。「こねてから焼く」も火にかける）
  const offAt = lastIdxOf(t, [MEASURE_HEAT_OFF, MEASURE_OFF_HEAT_BY_HAND])
  if (offAt >= 0 && offAt > lastIdxOf(t, [MEASURE_HEAT_ON])) return 'off'
  const key = stepAppliance(item.text)
  if (key == null) return 'keep'
  // コンロ以外の器具（レンジ・グリル・トースター）は、その工程が終われば加熱も終わる
  if (key !== 'stove') return 'off'
  if (item.kind === 'wait') {
    if (item.waitMinutes <= 0) return 'keep'
    if (waitUrgency({ text: item.text, minutes: item.minutes }) === 'relaxed') return 'off'
  }
  return 'on'
}

// ---------------------------------------------------------------- 1組み合わせの分析

function analyzePlan(trio, kitchen = DEFAULT_KITCHEN) {
  const timeline = buildCookTimeline(trio, kitchen)
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
  // **冷たい品は対象から外す**（2026-08-13 司令部の裁定・便GCで実装）。
  // いちばん悪い例が「煮豚100分／ポテトサラダ24分」型で、**ポテトサラダを先に仕上げて
  // 冷蔵庫に入れるのはオーナー指示どおりの正しい動き**（2026-08-08 便EG「冷たい方がいいものは
  // 先に仕上げて冷蔵庫で冷やしたい」）なのに、開きが大きいという理由で不合格に数えていた。
  // **線（30%超が20%以下）は動かさない。測る対象を正しくするだけ。**
  const warmFinishes = trio
    .filter((r) => recipeServeTemp(r) !== 'cold')
    .map((r) => finish.get(r.id))
    .filter((f) => f != null)
  const spread =
    warmFinishes.length >= 2 ? Math.max(...warmFinishes) - Math.min(...warmFinishes) : 0

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
  const uses = items.map((it) => applianceUse(it, kitchen)).filter(Boolean)
  const overlap = overlapMinutes(uses)
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

  // --- N7 火にかけたままの放置（2026-08-14 便GG）
  // 品ごとに火の状態を段取りの順に追い、「この時刻までに手を戻さないといけない」時刻（dueAt）を
  // 持ち回る。次の工程の**開始**がそれを過ぎていたら、その差が放置の超過。
  const heatIdles = []
  /**
   * 【原因調べ用】その工程を始める時点で、その品の鍋が火にかかったまま手を待っていたか。
   * 放置の空きに何が挟まっていたのかを見分けるためだけに使う（N7_DUMP を付けたときだけ計算）。
   */
  const potPending = new Map()
  if (N7_DUMP) {
    for (const [, list] of byRecipe) {
      let d = null
      for (const it of list) {
        potPending.set(it, d != null)
        const tr = heatTransition(it)
        if (tr === 'off') d = null
        else if (tr === 'on' || d != null) d = it.endMin
      }
    }
  }
  for (const [, list] of byRecipe) {
    let dueAt = null
    let since = null
    for (const it of list) {
      // 手でタネを扱う工程（こねる・形を作る）は、その手前で火が下りている＝空きを数えない
      // （2026-08-15 便GM。上の MEASURE_OFF_HEAT_BY_HAND の説明を参照）
      const offByHand = MEASURE_OFF_HEAT_BY_HAND.test(maskForMeasure(it.text))
      if (dueAt != null && it.startMin > dueAt && !offByHand) {
        heatIdles.push({
          // 空いた時間に何が挟まっていたか（原因調べ用。N7_DUMP を付けたときだけ）
          gap: N7_DUMP
            ? items
                .filter(
                  (o) =>
                    o.recipeId !== it.recipeId &&
                    o.startMin < it.startMin &&
                    o.endMin > since.endMin,
                )
                .map(
                  (o) =>
                    `${o.recipeTitle}|${o.kind}|${potPending.get(o) ? '鍋が待っていた' : '鍋は火の上にない'}|${o.startMin}-${o.endMin}|${o.text.slice(0, 26)}`,
                )
            : undefined,
          title: it.recipeTitle,
          fromText: since.text,
          fromEnd: since.endMin,
          fromKind: since.kind,
          nextText: it.text,
          nextStart: it.startMin,
          dueAt,
          excess: it.startMin - dueAt,
          idle: it.startMin - since.endMin,
        })
      }
      const tr = heatTransition(it)
      if (tr === 'off') {
        dueAt = null
        since = null
      } else if (tr === 'on') {
        const due = it.endMin + heatAllowanceOf(it)
        dueAt = Number.isFinite(due) ? due : null
        since = it
      } else if (dueAt != null) {
        // 火にかかったまま別の一手を挟んだ（「その間に」等）。鍋の締め切りは早まらない
        const due = it.endMin + HEAT_IDLE_ALLOWANCE
        if (due > dueAt) {
          dueAt = due
          since = it
        }
      }
    }
  }

  // --- N8 仕上げの鮮度（参考値・2026-08-14 便GG）
  // 「和える」「盛る」等の仕上げの工程が、**食卓に出る時刻（最後の品の完成）**より何分前に
  // 済んでしまっているか。R4の指摘「早く和えると水が出て味が薄まる」を数字で見るための参考。
  let staleFinish = null
  let staleWhich = null
  for (const [, list] of byRecipe) {
    const lastItem = list.reduce((a, b) => (b.endMin > a.endMin ? b : a), list[0])
    if (!lastItem || lastItem.kind !== 'active') continue
    if (!MEASURE_FINISH_ACTION.test(maskForMeasure(lastItem.text))) continue
    const early = last - lastItem.endMin
    if (staleFinish == null || early > staleFinish) {
      staleFinish = early
      staleWhich = lastItem
    }
  }

  return {
    trio, timeline, total, finish, spread, hotIdle, ignitions, longestStarts,
    concurrency, overlap, cues, last, heatIdles, staleFinish, staleWhich,
  }
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
/**
 * 検査する台所の設定（2026-08-13 便GC・docs/72 第3段）。
 * **段取りはその設定で組み直して測る**（既定の段取りを別の設定に当てはめて数え直すのではない）。
 */
const KITCHENS = [
  { key: 'コンロ1口', kitchen: { burners: 1, microwave: true, grill: true, toaster: true } },
  { key: 'コンロ2口（既定）', kitchen: DEFAULT_KITCHEN },
  { key: 'コンロ3口', kitchen: { burners: 3, microwave: true, grill: true, toaster: true } },
  {
    key: 'コンロ2口・レンジ/グリル/トースター無し',
    kitchen: { burners: 2, microwave: false, grill: false, toaster: false },
  },
]
/** 台所の設定ごとの分析結果。鍵は「設定名 → 標本名」 */
const nAnalysesByKitchen = new Map(
  KITCHENS.map((k) => [
    k.key,
    new Map(nSets.map((s) => [s.key, s.triples.map((t) => analyzePlan(t, k.kitchen))])),
  ]),
)
const nAnalyses = nAnalysesByKitchen.get('コンロ2口（既定）')
/** 合否は「野生レシピ＋ホールドアウト」で見る（同梱109品は比較のために出すだけ） */
const wildKeys = nSets.filter((s) => s.wild).map((s) => s.key)
const wildRows = wildKeys.flatMap((k) => nAnalyses.get(k))

const nameOf = (a) => a.trio.map((r) => r.title).join(' / ')

say('=========================================================')
say(' 【新規】段取りの質を測る8項目 N1〜N8（docs/72 §2・便FZ／N7・N8は便GG）')
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
say('  ※対象の引き直し（2026-08-13 便GC・司令部の裁定）: **冷たい品を対象から外した**。')
say('     いちばん悪い例が「煮豚100分／ポテトサラダ24分」型で、ポテトサラダを先に仕上げて')
say('     冷蔵庫に入れるのは2026-08-08 便EGのオーナー指示どおりの正しい動きなのに、')
say('     開きが大きいという理由で不合格に数えていた。**線は動かさず、測る対象だけを正した**。')
say('     ＝温かい品（と汁物）どうしの完成が揃っているかだけを見る。対象が1品以下なら開き0分。')
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
/** N4_DUMP を付けたときだけ貯める、混在手順の1件ずつ（2026-08-15 便GR） */
const n4Dump = []
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
      // 合計の行は同じ手順をもう一度なぞるだけなので書き出さない（二重に数えない）
      if (N4_DUMP && !label.startsWith('**')) {
        const split = splitMixedStep(s)
        const waitFirst = splitWaitFirstStep(s)
        n4Dump.push({
          group: label,
          title: r.title,
          no: i + 1,
          text: s.text,
          minutes: s.minutes ?? null,
          kind: classifyStep(s),
          counted: acc.wait > 0 && acc.active > 0 ? '両方' : acc.wait > 0 ? '待ちだけ' : acc.active > 0 ? '手作業だけ' : 'どちらも0分',
          wait: acc.wait,
          active: acc.active,
          split: split ? [split.active.text, split.wait.text] : null,
          waitFirstSplit: waitFirst ? [waitFirst.wait.text, waitFirst.active.text] : null,
          isLongRest: isLongRestStep(s),
        })
      }
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
// 混在手順の全件書き出し（2026-08-15 便GR）。`N4_DUMP=<書き出し先> npx tsx scripts/audit-cook-navi.mjs`
if (N4_DUMP) {
  const fs = await import('node:fs')
  fs.writeFileSync(N4_DUMP, JSON.stringify(n4Dump, null, 1))
  say(`  （N4_DUMP: 混在手順 ${n4Dump.length}件を ${N4_DUMP} に書き出しました）`)
}
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
say('  ※**その設定で段取りを組み直して**測る（別の設定で組んだ段取りを当てはめて数え直すのではない）。')
say(`  ※数える器具は docs/72 §3 の4つ（コンロ・電子レンジ・魚焼きグリル・トースター）。`)
say('  ※見分けはこのスクリプトが独自に持つ判定を使う（本体の見分けで本体を検査すると答え合わせに')
say('     ならないため）。持っていない器具の工程はコンロ1口として数える＝本体と同じ扱い。')
say()
say('| 組み合わせ | 通り数 | **1口で組んで1口を超える** | 2口で組んで2口超 | 3口で組んで3口超 | レンジ | グリル | トースター | 判定(1口) |')
say('|---|---|---|---|---|---|---|---|---|')
for (const s of nSets) {
  const rowsAt = (kitchenKey) => nAnalysesByKitchen.get(kitchenKey).get(s.key)
  const over = (kitchenKey, key, cap) => rowsAt(kitchenKey).filter((a) => a.concurrency[key] > cap).length
  const n = rowsAt('コンロ2口（既定）').length
  const c1 = over('コンロ1口', 'stove', 1)
  say(
    `| ${s.key} | ${n} | **${c1}件（${f1(pct(c1, n))}%）** | ${over('コンロ2口（既定）', 'stove', 2)}件 | ${over('コンロ3口', 'stove', 3)}件 | ` +
      `${over('コンロ2口（既定）', 'microwave', 1)}件 | ${over('コンロ2口（既定）', 'grill', 1)}件 | ${over('コンロ2口（既定）', 'toaster', 1)}件 | ${s.wild ? verdict(c1 === N_LINE.n5) : '（参考）'} |`,
  )
}
{
  const wildAt = (kitchenKey) => wildKeys.flatMap((k) => nAnalysesByKitchen.get(kitchenKey).get(k))
  const over = (kitchenKey, key, cap) => wildAt(kitchenKey).filter((a) => a.concurrency[key] > cap).length
  const n = wildAt('コンロ2口（既定）').length
  const c1 = over('コンロ1口', 'stove', 1)
  say(
    `| **野生＋ホールドアウト 合計** | ${n} | **${c1}件（${f1(pct(c1, n))}%）** | ${over('コンロ2口（既定）', 'stove', 2)}件 | ${over('コンロ3口', 'stove', 3)}件 | ` +
      `${over('コンロ2口（既定）', 'microwave', 1)}件 | ${over('コンロ2口（既定）', 'grill', 1)}件 | ${over('コンロ2口（既定）', 'toaster', 1)}件 | ${verdict(c1 === N_LINE.n5)} |`,
  )
}
say()
{
  const worst = wildKeys
    .flatMap((k) => nAnalysesByKitchen.get('コンロ1口').get(k))
    .filter((a) => a.concurrency.stove > 1)
    .sort((a, b) => b.concurrency.stove - a.concurrency.stove)
    .slice(0, 3)
  say('  いちばん悪い3例（コンロ1口の家では成立しない段取り）:')
  for (const a of worst) {
    const uses = a.timeline.items
      .map((it) => ({ it, use: applianceUse(it, { burners: 1, microwave: true, grill: true, toaster: true }) }))
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

// ---------------------------------------------------------------- N7
say('■ N7. 火にかけたままの放置（火にかかったまま次の手順まで空いた時間。線＝**超過0件**）')
say()
say('  2026-08-14 便GG（docs/72 第5段）で追加。利用者（料理歴20年）の原文:')
say('    「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が')
say('      挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と')
say('      書いてあるのに。豆腐は崩れるしわかめは溶けます。」')
say()
say('  **定義**: 品ごとに火の状態を段取りの順に追い、火にかかったまま**次の工程が始まるまで**の時間が')
say('  猶予を超えた件数。火がつく＝コンロを使う工程／火が消える＝火を止める・器に盛る・取り出す・')
say('  ざるにあげる・冷ます等／どちらでもない工程は**状態を引き継ぐ**（「沸いたら豆腐とわかめを入れる」は')
say('  火の語を持たないが鍋は火にかかったまま）。漬ける・冷ますの待ち（relaxed）は火の上に無い。')
say('  **数えるのはコンロだけ**（司令部の案から範囲を狭めた）。レンジ・グリル・トースターは待ちが明けた')
say('  時点でタイマーが切れ、レシピにも時間が書いてあるので利用者は止める合図を持っている。そこに')
say('  置きっぱなしになるのは「冷める」問題＝**N2が測っている軸**。コンロだけが、段取りに「火を止める」が')
say('  出てこない限り加熱が続く（利用者の原文「#7の後に『火を止める』も『弱火にする』も出てきません」）。')
say(`  **猶予**: ${HEAT_IDLE_ALLOWANCE}分（煮込み・焼き物は待ちの2割・最大5分がこれを超えるならそちら）。`)
say('  3分の根拠は利用者自身の手順「豆腐を入れて味噌を溶くのは焼き上がりの3分前」。')
say('  **数えないもの**（2026-08-15 便GM）: 手でタネを扱う工程（こねる・形を作る）に入るまでの空き。')
say('  ボウルの中の作業なので中身は鍋から出ており、火を点けたままにはならない（実例: ハンバーグの')
say('  「玉ねぎを炒める→ひき肉とまぜてこねる→形を作る→焼く」。本文に「火を止める」が無いだけ）。')
say('  ＝レシピ本文「1〜2分煮る」の直後に15分空く段取りは**超過12分**で不合格になる。')
say()
say('| 組み合わせ | 通り数 | **超過した通り** | 超過の延べ件数 | 超過の最大(分) | 判定 |')
say('|---|---|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows, wild: true }]) {
  const rows = s.rows ?? nAnalyses.get(s.key)
  const bad = rows.filter((a) => a.heatIdles.length > 0)
  const all = rows.flatMap((a) => a.heatIdles)
  const max = all.length === 0 ? 0 : Math.max(...all.map((x) => x.excess))
  say(
    `| ${s.key} | ${rows.length} | **${bad.length}件（${f1(pct(bad.length, rows.length))}%）** | ${all.length}件 | ${max} | ` +
      `${s.wild ? verdict(all.length === N_LINE.n7) : '（参考）'} |`,
  )
}
say()
{
  const worst = dedupe(
    wildRows.flatMap((a) => a.heatIdles.map((x) => ({ ...x, trio: nameOf(a) }))).sort((a, b) => b.excess - a.excess),
    (x) => x.title + x.fromText + x.nextText,
  ).slice(0, 5)
  say('  いちばん悪い5例（火にかけたまま何分空いたか）:')
  if (worst.length === 0) say('    （なし）')
  for (const x of worst) {
    say(`    - ${x.title}: 「${x.fromText.slice(0, 34)}」が${x.fromEnd}分に終わり、`)
    say(`      次の「${x.nextText.slice(0, 34)}」は${x.nextStart}分（${x.idle}分の放置・猶予${x.dueAt - x.fromEnd}分を${x.excess}分超過）`)
    say(`      組み合わせ: ${x.trio}`)
  }
  say()
  {
    // 何が原因で戻れなかったのかの内訳（打ち手を決めるのに要る）
    const all = wildRows.flatMap((a) => a.heatIdles)
    const buckets = new Map()
    for (const x of all) {
      const k = x.excess <= 2 ? '超過1〜2分' : x.excess <= 5 ? '超過3〜5分' : x.excess <= 10 ? '超過6〜10分' : '超過11分以上'
      buckets.set(k, (buckets.get(k) ?? 0) + 1)
    }
    say('  超過の大きさの内訳: ' + [...buckets].map(([k, v]) => `${k} ${v}件`).join(' / '))
  }
  // 超過した全件の書き出し（2026-08-15 便GM）。`N7_DUMP=<書き出し先> npx tsx scripts/audit-cook-navi.mjs`
  // で、1件ごとに「直前の工程／次の工程／空いた分数／その空きに挟まった他の品の工程」をJSONで残す。
  // 便GMはこれで108件を型に分けた（＝全件が「もう1つの鍋に戻る一手」1つに挟まれた形だった）。
  // 付けなければ何も書き出さず、表示される数値にも一切影響しない。
  if (N7_DUMP) {
    const fs = await import('node:fs')
    const all = wildRows.flatMap((a) => a.heatIdles.map((x) => ({ ...x, trio: nameOf(a) })))
    fs.writeFileSync(N7_DUMP, JSON.stringify(all, null, 1))
  }
}
say()

// ---------------------------------------------------------------- N8（参考値）
say('■ N8. 仕上げの鮮度（参考値・線は引かない）')
say()
say('  R4の指摘: 「#11でごま和えが完成（21分時点）。私は絞ったほうれん草だけ用意しておいて、')
say('  和えるのは食べる直前にします。早く和えると水が出て味が薄まる。」')
say('  和える・混ぜる・盛る・かける等で終わる品の**最後の一手**が、食卓に出る時刻（最後の品の完成）より')
say('  何分早く済んでしまっているかを見る。**線は引かない**＝冷たい品を先に仕上げるのは')
say('  2026-08-08 便EGのオーナー指示であり、線にすると指示と衝突するため（数字だけ残す）。')
say()
say('| 組み合わせ | 対象を含む通り | 早すぎの中央値(分) | 早すぎの最大(分) |')
say('|---|---|---|---|')
for (const s of [...nSets, { key: '**野生＋ホールドアウト 合計**', rows: wildRows }]) {
  const rows = (s.rows ?? nAnalyses.get(s.key)).filter((a) => a.staleFinish != null)
  if (rows.length === 0) {
    say(`| ${s.key} | 0 | — | — |`)
    continue
  }
  const v = rows.map((a) => a.staleFinish)
  say(`| ${s.key} | ${rows.length} | ${f1(median(v))} | ${Math.max(...v)} |`)
}
say()

// ---------------------------------------------------------------- まとめ
say('■ N. 8項目のまとめ（野生レシピ＋ホールドアウト。同梱109品は判定に使わない）')
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
  const n5 = wildKeys
    .flatMap((k) => nAnalysesByKitchen.get('コンロ1口').get(k))
    .filter((a) => a.concurrency.stove > 1).length
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
  const n7rows = wildRows.filter((a) => a.heatIdles.length > 0)
  const n7 = wildRows.reduce((sum, a) => sum + a.heatIdles.length, 0)
  const n7max = n7 === 0 ? 0 : Math.max(...wildRows.flatMap((a) => a.heatIdles).map((x) => x.excess))
  say(`| N7 火にかけたままの放置 | 猶予（${HEAT_IDLE_ALLOWANCE}〜5分）を超えた件数 | 0件 | **${n7}件**（${n7rows.length}通り / ${wildRows.length}通り・最大超過${n7max}分） | ${verdict(n7 === N_LINE.n7)} |`)
  const stale = wildRows.filter((a) => a.staleFinish != null).map((a) => a.staleFinish)
  say(`| N8 仕上げの鮮度 | 仕上げの一手が食卓より何分早いか | （線なし） | 中央値${f1(median(stale))}分・最大${Math.max(...stale)}分 | （参考） |`)
}
say()

// ================================================================================
//  【新規】E5' 到達率（2026-08-14 便GI・docs/68 の合格ラインの引き直し）
//
//  旧E5「同梱109品の平均短縮率32.6%以上」は、**火にかけた鍋の口がすぐ空く前提**で
//  組まれていた頃の段取り（＝物理的に成立しない段取り）を基準にした値で、同じ物差しで
//  前後を比べられない。オーナー裁定（2026-08-14）「必要ならラインの見直しをしてください」に
//  基づき、**人が手で組んだ段取りにどれだけ近いか**で測り直す。旧E5は参考値として残す。
// ================================================================================

/**
 * 【理論下限】この3品を、どんなに上手に並べても切れない床（分）。次の3つのいちばん大きいもの。
 *   ① 手作業の合計 ………… 手は1組しかないので、手を動かす時間は必ず直列に積み上がる
 *   ② 最長1品の単独所要 …… 1品の中の順序は動かせないので、いちばん長い1品より短くはならない
 *   ③ 器具の占有 ÷ 台数 …… コンロ2口なら「火にかかっている合計時間」の半分より短くならない
 *
 * **③が今回の引き直しの核心**。旧E5（短縮率）も便GCが出した理論下限（①②だけ）も、
 * 火にかけた鍋がすぐ口を空ける前提で引かれていた。③を入れると「鍋が口をふさぐぶん、
 * どうしても長くなる」が**床の側**に入るので、物理を守った段取りが数字で罰されない。
 *
 * ①②③はすべて**その品を単独で作ったときの段取り**から計算する（3品を並べた結果を見ない）
 * ＝段取りの側で数字を作れない。③のコンロは「火がついてから火を下ろす合図が出るまで」を
 * 1台ぶんの占有として数える（見分けはN7と同じ `heatTransition`。レンジ・グリル・トースターは
 * タイマーで切れるのでその工程の長さだけ）。**迷ったら床を低く見積もる側**に倒してある
 * （床が低いほど到達率は悪く出る＝甘い数字にならない）。
 */
const soloCache = new Map()
function soloOf(r, kitchen) {
  const key = `${r.id}@${kitchen.burners}${kitchen.microwave ? 'm' : ''}${kitchen.grill ? 'g' : ''}${kitchen.toaster ? 't' : ''}`
  if (!soloCache.has(key)) {
    const tl = buildCookTimeline([r], kitchen)
    const occupancy = { stove: 0, microwave: 0, grill: 0, toaster: 0 }
    // コンロ以外＝その工程の長さ（扉を閉じてタイマーが切れれば空く）
    for (const it of tl.items) {
      const use = applianceUse(it, kitchen)
      if (!use || use.key === 'stove') continue
      occupancy[use.key] += use.end - use.start
    }
    // コンロ＝火がついてから火を下ろす合図が出るまで（その間ずっと1口ふさがる）。
    // 火が下りる工程が**コンロの前でやる一手**（「みそを溶いて火を止める」）ならその工程の終わりまで、
    // そうでないもの（冷ます・寝かせる／レンジやグリルへ移る）は**その手前**で火が下りていると数える。
    // ＝鍋を火から下ろして置いておくぶんは口をふさがない側に倒す（床を低く見積もる側）。
    let onFrom = null
    let lastEnd = 0
    for (const it of tl.items) {
      lastEnd = Math.max(lastEnd, it.endMin)
      const tr = heatTransition(it)
      if (tr === 'on') {
        if (onFrom == null) onFrom = it.startMin
      } else if (tr === 'off' && onFrom != null) {
        const atStove = stepAppliance(it.text) === 'stove'
        occupancy.stove += Math.max(0, (atStove ? it.endMin : it.startMin) - onFrom)
        onFrom = null
      }
    }
    if (onFrom != null) occupancy.stove += Math.max(0, lastEnd - onFrom)
    soloCache.set(key, {
      total: tl.totalMinutes,
      active: tl.items.reduce((sum, it) => sum + it.activeMinutes, 0),
      occupancy,
    })
  }
  return soloCache.get(key)
}

/** 3品の理論下限（分）と、その内訳 */
function floorOf(trio, kitchen = DEFAULT_KITCHEN) {
  const solos = trio.map((r) => soloOf(r, kitchen))
  const hands = solos.reduce((sum, s) => sum + s.active, 0)
  const longest = Math.max(...solos.map((s) => s.total))
  let load = 0
  let loadKey = null
  for (const key of Object.keys(APPLIANCE_LABEL)) {
    const capacity = applianceCapacity(kitchen, key)
    if (capacity <= 0) continue
    const need = solos.reduce((sum, s) => sum + s.occupancy[key], 0) / capacity
    if (need > load) {
      load = need
      loadKey = key
    }
  }
  const floor = Math.max(hands, longest, load)
  return {
    floor,
    hands,
    longest,
    load,
    loadKey,
    // 便GC互換（①②だけ）の下限。引き直しで床がどれだけ動いたかを見るために並べて出す
    floorGC: Math.max(hands, longest),
    driver: floor === load && load > longest && load > hands ? '器具' : floor === longest ? '最長1品' : '手作業',
  }
}

/** その3品の到達率（理論下限に対して何%増しか） */
function reachOf(trio, kitchen = DEFAULT_KITCHEN) {
  const f = floorOf(trio, kitchen)
  const total = buildCookTimeline(trio, kitchen).totalMinutes
  return {
    ...f,
    trio,
    total,
    reach: f.floor <= 0 ? 0 : pct(total - f.floor, f.floor),
    reachGC: f.floorGC <= 0 ? 0 : pct(total - f.floorGC, f.floorGC),
    impossible: total < f.floor,
  }
}

/**
 * 【E5'の線】到達率の**中央値10%以下**。
 *
 * 根拠（人の実測から取る。こちらの都合で動かせないようにするため）:
 *   - `docs/71` R3／2026-08-14 R4 の3品（鶏むね肉のみそマヨ焼き／ごま和え／みそ汁）を
 *     **人が手で組むと約30分・完成の開き0分**。その組み方（R3原文「私ならこうします」）は
 *     「鶏を切って漬ける→その10分で副菜→鶏をグリルへ→焼いている間に汁物と和え物」＝
 *     **いちばん長い1品の鎖を0分から始めて、ほかの品を全部その隙間に畳み込む**形。
 *     同じ物差し（アプリの手順ごとの見積り）で並べ直すと36分＝**理論下限そのもの＝到達率0.0%**。
 *   - 人には見積り誤差が無い。機械は**分数の書かれていない手順を一律4分**と仮定して並べるので
 *     （DEFAULT_ACTIVE_MINUTES）、どれだけ正しく並べても**1手順ぶんの粒度**は残る。
 *     いちばん理論下限の短い標本群（C: 手入力・下限41分前後）でも 4分 ÷ 41分 ＝ 9.8%。
 *   - よって **線＝人の到達率（0%）＋1手順ぶんの粒度（約10%）＝ 中央値10%以下**。
 *
 * 判定は**同梱109品・野生の混合・ホールドアウトの3つとも**で行う
 * （旧E5は同梱109品だけを見ていた。「同梱だけで判断しない」＝docs/72 §5 の反省）。
 */
const E5_REACH_LINE = 10

say('=========================================================')
say(" 【新規】E5' 到達率（合格ラインの引き直し・2026-08-14 便GI）")
say('=========================================================')
say()
say('  **なぜ引き直したか**: 旧E5「同梱109品の平均短縮率32.6%以上」は、**火にかけた鍋の口が')
say('  すぐ空く前提**で組まれていた頃の段取りを基準にした値。いまの段取りは物理を守るように')
say('  なった（便GA〜GG）ので、**同じ物差しで前後を比べられない**。')
say('  代わりに「**人が手で組んだ段取りにどれだけ近いか**」で測る。')
say()
say('  **理論下限**＝この3品をどんなに上手に並べても切れない床。次の3つのいちばん大きいもの:')
say('    ① 手作業の合計（手は1組しかない）')
say('    ② 最長1品の単独所要（1品の中の順序は動かせない）')
say('    ③ 器具の占有の合計 ÷ 台数（コンロ2口なら、火にかかっている合計時間の半分）')
say('  ③が引き直しの核心。**旧E5も便GCの理論下限（①②だけ）も、鍋がすぐ口を空ける前提**だった。')
say('  ③を床に入れると「鍋が口をふさぐぶん長くなる」が物理として床に入り、**正しい段取りが')
say('  数字で罰されない**。①②③とも**単独で作ったときの段取り**から計算する（並べた結果を見ない）。')
say()
say(`  **到達率**＝（ナビの所要時間 − 理論下限）÷ 理論下限。**線＝中央値 ${E5_REACH_LINE}%以下**。`)
say('  線の根拠: 人（R4・料理歴20年）の手組みは理論下限そのもの（**到達率0.0%**）。人には見積り')
say('  誤差が無いが、機械は分数の書かれていない手順を一律4分と仮定して並べるので、正しく並べても')
say('  **1手順ぶんの粒度**が残る（いちばん下限の短い標本群でも 4分÷41分＝9.8%）。')
say('  ＝**人の到達率0% ＋ 1手順ぶん ＝ 10%**。')
say()
say('| 組み合わせ | 通り数 | 理論下限の中央値(分) | ナビの中央値(分) | **到達率の中央値** | 平均 | 悪いほう1割 | 最大 | 判定 |')
say('|---|---|---|---|---|---|---|---|---|')
const e5Sets = [
  { key: '同梱109品（無作為500通り）', triples: comboSets[0].triples, judged: true },
  { key: 'A: URL取込（全20通り）', triples: comboSets[1].triples, judged: false },
  { key: 'B: 貼り付け取込（全20通り）', triples: comboSets[2].triples, judged: false },
  { key: 'C: 手入力（全20通り）', triples: comboSets[3].triples, judged: false },
  { key: '野生の混合A+B+C（無作為200通り）', triples: comboSets[4].triples, judged: true },
  { key: 'ホールドアウト混合（全84通り）', triples: allTriples(holdoutAll), judged: true },
]
const e5Rows = new Map()
for (const s of e5Sets) {
  const rows = s.triples.map((t) => reachOf(t))
  e5Rows.set(s.key, rows)
  const reaches = rows.map((r) => r.reach).sort((a, b) => a - b)
  const p90 = reaches[Math.min(reaches.length - 1, Math.floor(reaches.length * 0.9))]
  const med = median(reaches)
  say(
    `| ${s.key} | ${rows.length} | ${f1(median(rows.map((r) => r.floor)))} | ${f1(median(rows.map((r) => r.total)))} | ` +
      `**${f1(med)}%** | ${f1(reaches.reduce((a, b) => a + b, 0) / reaches.length)}% | ${f1(p90)}% | ${f1(Math.max(...reaches))}% | ` +
      `${s.judged ? verdict(med <= E5_REACH_LINE) : '（参考）'} |`,
  )
}
say()
{
  say('  到達率のいちばん悪い3例（＝理論下限からいちばん離れた段取り）:')
  const worst = [...e5Rows.get('同梱109品（無作為500通り）'), ...e5Rows.get('野生の混合A+B+C（無作為200通り）')]
    .slice()
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 3)
  for (const r of worst) {
    say(`    - ${r.trio.map((x) => x.title).join(' / ')}`)
    say(`      ナビ${r.total}分 / 理論下限${f1(r.floor)}分（${r.driver}が決めた）→ **${f1(r.reach)}%増し**`)
  }
}
say()
say('  ※理論下限を決めているのはどれか（床の内訳）:')
say()
say('| 組み合わせ | 手作業の合計が決めた | 最長1品が決めた | **器具の占有が決めた** | 便GC互換の下限(①②のみ)との差(分) |')
say('|---|---|---|---|---|')
for (const s of e5Sets) {
  const rows = e5Rows.get(s.key)
  const by = (k) => f1(pct(rows.filter((r) => r.driver === k).length, rows.length)) + '%'
  const diff = rows.reduce((sum, r) => sum + (r.floor - r.floorGC), 0) / rows.length
  say(`| ${s.key} | ${by('手作業')} | ${by('最長1品')} | **${by('器具')}** | +${f1(diff)}分 |`)
}
say()
say('  ※**理論下限を下回った組み合わせ＝物理的に成立しない段取り**（E5\'-b・線＝0件）。')
say('     手も器具も足りていないのに「できる」と言っている段取りなので、短縮効果ではなく')
say('     **正直**の問題（序列「安全>正直>短縮効果」）。器具の設定ごとに数える。')
say()
say('| 台所の設定 | ' + e5Sets.map((s) => s.key.replace(/（.*/, '')).join(' | ') + ' | 判定 |')
say('|---|' + e5Sets.map(() => '---').join('|') + '|---|')
const impossibleSamples = []
for (const k of KITCHENS) {
  const counts = e5Sets.map((s) => {
    const bad = s.triples.filter((t) => reachOf(t, k.kitchen).impossible)
    for (const t of bad.slice(0, 2)) impossibleSamples.push({ label: k.key, kitchen: k.kitchen, trio: t })
    return bad.length
  })
  say(`| ${k.key} | ${counts.map((c) => `**${c}件**`).join(' | ')} | ${verdict(counts.reduce((a, b) => a + b, 0) === 0)} |`)
}
say()
if (impossibleSamples.length > 0) {
  say('  下回った組み合わせの実例（先頭3件）:')
  for (const { label, kitchen, trio } of impossibleSamples.slice(0, 3)) {
    const r = reachOf(trio, kitchen)
    say(`    - [${label}] ${trio.map((x) => x.title).join(' / ')}`)
    say(
      `      ナビ${r.total}分 < 理論下限${f1(r.floor)}分（手作業${r.hands}分 / 最長1品${r.longest}分 / 器具${f1(r.load)}分＝${r.loadKey ?? '—'}）`,
    )
  }
  say()
}
say('  ※旧E5（同梱109品の平均短縮率32.6%以上）は**参考値として残す**（消さない・前後の比較に使う）。')
say('     上の「器具の設定ごと」の表に出している値がそれ。')
say()
{
  const r3 = [...buildPasteRecipes(r3PasteSamples, 'R3再現'), ...buildManualRecipes(r3ManualSamples, 'R3再現')]
  const r = reachOf(r3)
  say('  ※R4/R3の3品（人の手組み＝約30分・完成の開き0分）での到達率:')
  say(
    `     理論下限 ${r.floor}分（手作業の合計${r.hands}分 / 最長1品${r.longest}分 / 器具${f1(r.load)}分＝${r.loadKey ?? '—'}）`,
  )
  say(`     ナビ ${r.total}分 → **到達率 ${f1(r.reach)}%**`)
  say('     人の手組みは「鶏を切って漬ける→その10分で副菜→鶏をグリルへ→焼いている間に汁物と和え物」')
  say(`     ＝最長1品（鶏 ${r.longest}分）の鎖を0分から始め、ほかの品をその隙間に畳み込む形＝**到達率0.0%**。`)
}
say()

// ------------------------------------------------- 器具の設定ごとの13項目（2026-08-13 便GC）
say('=========================================================')
say(' 【器具の設定ごと】14項目（既存7＋新規7）')
say('=========================================================')
say()
say('  docs/72 第3段（器具の占有）で、段取りは**台所の設定に合わせて組み直される**ようになった。')
say('  合否は**既定の設定（コンロ2口・レンジ/グリル/トースターあり）**で判定する（＝設定を触って')
say('  いない人が実際に見る段取り）。ほかの設定は、口数を変えると何がどれだけ変わるかを見るための参考。')
say()
say('  S1（危険側誤判定）とE4（一致率）は**手順の分類だけ**で決まり、器具の設定では1件も動かない')
say('  （分類のコードに触れていないため）。この表には短縮率・正直表示・6項目だけを載せる。')
say()

/** その設定で3品の段取りを組み、短縮率まわりをまとめる */
function summarizeAt(triples, kitchen) {
  const solo = new Map()
  const soloOf = (r) => {
    const k = `${r.id}`
    if (!solo.has(k)) solo.set(k, buildCookTimeline([r], kitchen).totalMinutes)
    return solo.get(k)
  }
  const rows = triples.map((trio) => {
    const plan = buildCookPlan(trio, kitchen)
    const seq = trio.reduce((a, r) => a + soloOf(r), 0)
    const par = buildCookTimeline(trio, kitchen).totalMinutes
    return { gain: pct(seq - par, seq), honest: plan.mode === 'sequential', seq, par }
  })
  const gains = rows.map((r) => r.gain)
  return {
    n: rows.length,
    avgGain: gains.reduce((a, b) => a + b, 0) / rows.length,
    zeroRate: pct(gains.filter((g) => g < 0.5).length, rows.length),
    honestRate: pct(rows.filter((r) => r.honest).length, rows.length),
    // 「黙った短縮ゼロ」＝ほとんど縮まないのに正直表示が出ない件数（S2。線＝0件）
    silentZero: rows.filter((r) => r.gain < 5 && !r.honest).length,
    avgPar: rows.reduce((a, r) => a + r.par, 0) / rows.length,
  }
}

const wildMixTriples = comboSets[4].triples
const holdoutTriples = allTriples(holdoutAll)
const cueTriples = allTriples(cueRecipes)
say('| 項目 | 線 | ' + KITCHENS.map((k) => k.key).join(' | ') + ' |')
say('|---|---|' + KITCHENS.map(() => '---').join('|') + '|')
const kitchenStats = KITCHENS.map((k) => {
  const at = (t) => summarizeAt(t, k.kitchen)
  const rowsOf = (key) => nAnalysesByKitchen.get(k.key).get(key)
  const wild = wildKeys.flatMap((key) => rowsOf(key))
  const ratios = wild.map((a) => pct(a.spread, a.total))
  const hot = wild.filter((a) => a.hotIdle != null).map((a) => a.hotIdle)
  const cues = rowsOf('並行指示の標本（全20通り）')
    .flatMap((a) => a.cues)
    .filter((c) => c.cue === 'meanwhile' && c.hasWait)
  return {
    key: k.key,
    starter: at(comboSets[0].triples),
    mix: at(wildMixTriples),
    a: at(comboSets[1].triples),
    b: at(comboSets[2].triples),
    c: at(comboSets[3].triples),
    holdout: at(holdoutTriples),
    n1over: pct(ratios.filter((x) => x > N_LINE.n1).length, wild.length),
    n2: Math.max(...hot),
    n5: wild.filter((a) => a.concurrency.stove > applianceCapacity(k.kitchen, 'stove')).length,
    overlap: rowsOf('野生の混合A+B+C（無作為200通り）').reduce((sum, a) => sum + a.overlap, 0) /
      rowsOf('野生の混合A+B+C（無作為200通り）').length,
    n6: pct(cues.filter((c) => c.inside).length, cues.length),
    n7: wild.reduce((sum, a) => sum + a.heatIdles.length, 0),
  }
})
const row = (label, line, get) => say(`| ${label} | ${line} | ` + kitchenStats.map((k) => get(k)).join(' | ') + ' |')
row('S2 黙った短縮ゼロ（混合）', '0件', (k) => `${k.mix.silentZero}件`)
row('E1 混合の平均短縮率', '25%以上', (k) => `**${f1(k.mix.avgGain)}%**`)
row('E2 A: URL取込', '20%以上', (k) => `${f1(k.a.avgGain)}%`)
row('E2 B: 貼り付け取込', '20%以上', (k) => `${f1(k.b.avgGain)}%`)
row('E2 C: 手入力', '20%以上', (k) => `${f1(k.c.avgGain)}%`)
row('E3 正直表示の発生率（混合）', '10%以下', (k) => `${f1(k.mix.honestRate)}%`)
row('E5 同梱109品の平均短縮率', '32.6%以上', (k) => `**${f1(k.starter.avgGain)}%**`)
row('（参考）ホールドアウトの平均短縮率', '—', (k) => `${f1(k.holdout.avgGain)}%`)
row('（参考）混合のナビ所要（分）', '—', (k) => f1(k.mix.avgPar))
row('（参考）**2つ以上の器具を同時に使う時間**（混合・平均分）', '—', (k) => `**${f1(k.overlap)}分**`)
row('N1 開きが30%超の割合', '20%以下', (k) => `${f1(k.n1over)}%`)
row('N2 温かい品と汁物の放置（最大・分）', '10分以内', (k) => `${k.n2}分`)
row('N3 放置調理の取りこぼし', '0件', () => `${n3Stranded}件`)
row('N4 混在手順の両方計上', '90%以上', () => `${f1(pct(n4Total.both, n4Total.mixed))}%`)
row('N5 器具の重なり', '0件', (k) => `**${k.n5}件 / ${wildKeys.flatMap((key) => nAnalysesByKitchen.get(k.key).get(key)).length}通り**`)
row('N6 利用者の並行指示', '80%以上', (k) => `${f1(k.n6)}%`)
row('N7 火にかけたままの放置', '0件', (k) => `**${k.n7}件**`)
say()
say('  ※N3・N4は手順の見分け方だけで決まる項目なので、器具の設定では動かない（同じ値が並ぶ）。')
say('  ※「持っていない器具」の工程は**コンロ1口**として数える＝レンジ・グリル・トースターを')
say('     持っていない家では、その工程をフライパンや鍋でやることになるため（本体・監査とも同じ扱い）。')
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
  say(`    N7 火にかけたままの放置 ${a.heatIdles.length}件`)
  for (const x of a.heatIdles) {
    say(`       - ${x.title}: 「${x.fromText.slice(0, 30)}」が${x.fromEnd}分に終わり、次の「${x.nextText.slice(0, 24)}」は${x.nextStart}分`)
    say(`         ＝${x.idle}分そのまま火にかかっている（猶予${x.dueAt - x.fromEnd}分を${x.excess}分超過）`)
  }
  say(`    N8 仕上げの鮮度（参考）${a.staleFinish == null ? '該当なし' : `${a.staleWhich.recipeTitle}「${a.staleWhich.text.slice(0, 22)}」が食卓の${a.staleFinish}分前に完了`}`)
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
