/**
 * 月タブ「期間の栄養と食費」の集計ロジック（2026-07-28 便CA・オーナー確定仕様）。
 *
 * オーナー原文（2026-07-27）:
 * ・期間指定の栄養と価格(1食分)は、合計を食数で割った、いわゆる平均値ではなく、1人が期間内に
 *   摂取した食事の合計(期間内に作った料理1食ずつの合計)を表示したいです。
 *   「期間内に摂取できた栄養(1人分)」
 * ・選択した期間が過去の場合は実績のみ、未来の場合は予定の献立で計算。
 *   過去の予定ベース計算は邪魔なので表示なし。
 *
 * ここから確定した2つの規則:
 *  規則1（1人分の期間合計）: 平均を出さない。料理1品につき1人分（perServing）を1回だけ足す。
 *    2人分作っても4人分作っても「1人が食べた分」は1食なので、作った人数では重み付けしない。
 *  規則2（過去=実績・今日以降=予定）: 1日は必ずどちらか片方の基準だけで数える。
 *    過去日（date < today）は「作った記録」だけ、今日以降（date >= today）は「登録した献立」だけ。
 *    今日を予定側に入れるのは、月カレンダーが以前から「過去日は予定を出さない・今日と未来日は
 *    予定を出す」（isPastDateが境界）で動いており、表示と集計の境界を揃えるため。
 *    同じ日を実績と予定の両方で数えない＝二重計上しない、が最優先。
 *
 * 2026-08-03 便DK（オーナー確定「3人家族なら予算や買い物メモは3人分で計算した数値が必要。
 * 栄養は1人当たりのみで十分」）で規則3が加わった:
 *  規則3（作る食数ぶんの食費）: 「これから作る予定」の食費は、実際に作る食数（実効食数＝
 *    枠ごとに決めた食数 > 設定「ふだん作る人数」 > レシピの登録人数分）ぶんの金額も出す。
 *    実績側が記録した人数でスケールした金額（cookedHouseholdYen）を出しているのと同じ考え方で、
 *    規則1の「1人分」は栄養と対の数字なのでいっさい変えない（1人分と食数ぶんを別の値として並べる）。
 *
 * 2026-08-03 便DQ（オーナー指示「価格は一人分と食数、全員分と食数、1日あたりの平均食費、を表で出す」）
 * で規則4が加わった:
 *  規則4（1日あたりの平均の分母）: 作った記録がある日数で割る（cookedDayCount）。実績は過ぎた日にしか
 *    無いので暦日数で割ると当月は必ず極端に小さい額になる。分子(cookedHouseholdYen)と分母を同じ料理から
 *    数え、画面の表でも「全員分 ÷ 作った記録のある◯日」と分母を書いて検算できるようにする。
 *
 * 集計自体は栄養(nutrition.ts)と食費(priceEstimate.ts)の既存ロジックを組み合わせるだけで、
 * この層は「どの日をどちらの基準で数えるか」と「1人分の合計」に責任を持つ純関数だけを置く。
 * 金額・栄養はあくまで概算・めやす（医療・効能の文脈では使わない）。
 */
import type { Ingredient } from '../db/types'
import {
  sumPersonalNutrition,
  addPersonalNutritionSum,
  type PersonalNutritionSum,
} from './nutrition'
import { sumCookedRecipesCost, type PriceIndexEntry } from './priceEstimate'

/** 集計に必要なレシピの最小形（テストから素の物体を渡せるようにRecipe全体には依存しない） */
export interface RangeRecipeLike {
  ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[]
  servings: number
}

/** 期間内の「作った記録」1件（日付＋レシピ＋記録時の人数） */
export interface RangeCookedDish {
  /** YYYY-MM-DD */
  date: string
  recipe: RangeRecipeLike
  /** 記録時の人数（任意）。無い古い記録はレシピの登録人数で代替する */
  log?: { servings?: number }
}

/** 期間内の「登録した献立」1枠1品（日付＋レシピ） */
export interface RangePlannedDish {
  /** YYYY-MM-DD */
  date: string
  recipe: RangeRecipeLike
  /**
   * その枠を何人分作るか＝実効食数（任意・2026-08-03 便DK）。
   * 呼び出し側が logic/servings.ts effectiveMealServings で解決してから渡す
   * （枠ごとの食数 > 設定「ふだん作る人数」 > レシピの登録人数分）。
   * 未指定＝レシピの登録人数分。「これから作る予定の食費（作る食数ぶん）」だけに効き、
   * 1人分の食費・栄養はこの値では変わらない。
   */
  servings?: number
}

/** 期間を「実績で数える日」と「予定で数える日」に分けた結果 */
export interface RangeBasisSplit {
  /** 作った記録で数える範囲（過去日）。過去日が1日も無ければ null */
  actual: { start: string; end: string } | null
  /** 登録した献立で数える範囲（今日以降）。今日以降が1日も無ければ null */
  plan: { start: string; end: string } | null
}

/**
 * 選んだ期間を「過去（実績で数える）」と「今日以降（予定で数える）」に切り分ける（規則2）。
 * YYYY-MM-DD同士の辞書式比較がそのまま日付比較になる前提（isPastDateと同じ）。
 * start<=end に正規化済みの値を渡すこと（呼び出し側の normalizeDateRange 済み）。
 */
export function splitRangeByToday(start: string, end: string, today: string): RangeBasisSplit {
  // 期間全体が過去（終了日が今日より前）: すべて実績
  if (end < today) return { actual: { start, end }, plan: null }
  // 期間全体が今日以降（開始日が今日以降）: すべて予定
  if (start >= today) return { actual: null, plan: { start, end } }
  // またぐ期間（当月など）: 今日の前日までが実績・今日から終了日までが予定
  return { actual: { start, end: prevDay(today) }, plan: { start: today, end } }
}

/** YYYY-MM-DD の前日。splitRangeByToday の表示用の境界（月またぎ・うるう年もDateに任せる） */
function prevDay(date: string): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 実績・予定それぞれの集計結果 */
export interface RangeBasisPart {
  /** この基準で数えた品数（料理1品＝1） */
  dishCount: number
  /** 1人分の食費合計（円） */
  personalYen: number
  /** この基準で数えた日付の範囲（1日も無ければ null。表示の「◯/◯〜◯/◯は〜」に使う） */
  range: { start: string; end: string } | null
  /** 1人分の栄養合計（8項目） */
  nutrition: PersonalNutritionSum
}

/** 期間の集計結果（実績・予定を分けたうえで、1人分の合計は両者を足した値も持つ） */
export interface RangeIntakeSummary {
  /** 過去分（作った記録） */
  actual: RangeBasisPart
  /** 今日以降（登録した献立） */
  plan: RangeBasisPart
  /** 実績＋予定の「1人が期間内に食べた分」の食費合計（円） */
  personalYen: number
  /** 実績＋予定の「期間内に摂取できた栄養（1人分）」 */
  nutrition: PersonalNutritionSum
  /** 作った記録の全体食費（家族全員分・過去日のみ）。オーナー指示で残す「作った食数の合算」 */
  cookedHouseholdYen: number
  /** 作った記録の食数（延べ人数。2人分作った記録は2食）。同じく「作った食数の合算」用 */
  cookedMealCount: number
  /**
   * これから作る予定の食費（作る食数ぶん・今日以降のみ・2026-08-03 便DK）。
   * 実績側の cookedHouseholdYen と対になる数字で、数え方も同じ＝1人分の単価×実際に作る人数。
   * 予定側は「記録した人数」の代わりに実効食数（枠ごとの食数 > ふだん作る人数 > 登録人数分）を使う。
   */
  planHouseholdYen: number
  /** これから作る予定の食数（延べ人数。3人分作る予定は3食）。cookedMealCountと対 */
  planMealCount: number
  /**
   * 作った記録がある日数（実績側・同じ日に何品作っても1日。2026-08-03 便DQ）。
   * 月タブの表に出す「1日あたりの平均」の分母。暦日数で割ると、実績が過ぎた日にしか無い当月は
   * 必ず極端に小さい額になる。cookedHouseholdYen とまったく同じ料理から数えるので、
   * 画面上で「全員分 ÷ この日数 ＝ 1日あたりの平均」を検算できる。
   */
  cookedDayCount: number
  /** cookedHouseholdYen を cookedDayCount で割った1日あたりの金額（円・記録が1日も無ければ0） */
  cookedPerDayYen: number
}

/**
 * 期間内で実際に数える料理を、規則2（過去=作った記録・今日以降=登録した献立）で切り分ける。
 * summarizeRangeIntake と rangeIntakeRecipes が同じ料理を見るための共通部品
 * （集計と、その集計に添える注記が別々の対象を数えることが無いようにするため）。
 */
function splitRangeDishes(input: {
  start: string
  end: string
  today: string
  cooked: RangeCookedDish[]
  planned: RangePlannedDish[]
}): { actualDishes: RangeCookedDish[]; planDishes: RangePlannedDish[] } {
  const { start, end, today, cooked, planned } = input
  const split = splitRangeByToday(start, end, today)
  const actual = split.actual
  const plan = split.plan
  return {
    // 過去分: 作った記録だけを数える（過去の予定ベース計算はオーナー指示で廃止）
    actualDishes:
      actual == null ? [] : cooked.filter((d) => d.date >= actual.start && d.date <= actual.end),
    // 今日以降: 登録した献立だけを数える
    planDishes: plan == null ? [] : planned.filter((d) => d.date >= plan.start && d.date <= plan.end),
  }
}

/**
 * 期間の合計に実際に入れた料理のレシピ一覧（2026-07-30 便CH/C2）。
 * 「価格が分からない材料◯種類を除いた概算です」の注記を、合計と同じ対象から数えるために使う。
 * 並びは 作った記録→登録した献立（注記は件数だけを使うので順序に意味は持たせない）。
 */
export function rangeIntakeRecipes(input: {
  start: string
  end: string
  today: string
  cooked: RangeCookedDish[]
  planned: RangePlannedDish[]
}): RangeRecipeLike[] {
  const { actualDishes, planDishes } = splitRangeDishes(input)
  return [...actualDishes.map((d) => d.recipe), ...planDishes.map((d) => d.recipe)]
}

/**
 * 期間の「1人が摂取した合計」を、過去=実績・今日以降=予定の規則で集計する（規則1＋規則2）。
 *
 * 渡す cooked / planned は期間外の日が混ざっていてもよい（ここで start〜end に絞る）。
 * planned は「1枠1品」＝献立エントリ1件につき1品として渡すこと（主菜+副菜の枠は2品）。
 */
export function summarizeRangeIntake(input: {
  start: string
  end: string
  today: string
  cooked: RangeCookedDish[]
  planned: RangePlannedDish[]
  priceIndex: PriceIndexEntry[]
}): RangeIntakeSummary {
  const { start, end, today, cooked, planned, priceIndex } = input
  const split = splitRangeByToday(start, end, today)
  const { actualDishes, planDishes } = splitRangeDishes({ start, end, today, cooked, planned })

  const actualCost = sumCookedRecipesCost(actualDishes, priceIndex)
  const actualNutrition = sumPersonalNutrition(actualDishes.map((d) => d.recipe))
  // 予定側は「これから何人分作るか」＝実効食数を、実績側の「記録した人数」と同じ枠に入れて
  // 同じ集計に通す（2026-08-03 便DK）。実効食数が未指定なら登録人数どおりで従来と同値になり、
  // personalTotal（全量÷登録人数を1品1回）はどちらにしても sumMealPlanEntriesCost と同じ値になる
  const planCost = sumCookedRecipesCost(
    planDishes.map((d) => ({ recipe: d.recipe, log: { servings: d.servings } })),
    priceIndex,
  )
  const planNutrition = sumPersonalNutrition(planDishes.map((d) => d.recipe))
  // 「1日あたりの平均」の分母（便DQ）。同じ日に3品作っても1日として数える
  const cookedDayCount = new Set(actualDishes.map((d) => d.date)).size

  const actual: RangeBasisPart = {
    dishCount: actualCost.dishCount,
    personalYen: actualCost.personalTotal,
    range: split.actual,
    nutrition: actualNutrition,
  }
  const plan: RangeBasisPart = {
    dishCount: planCost.dishCount,
    personalYen: planCost.personalTotal,
    range: split.plan,
    nutrition: planNutrition,
  }
  return {
    actual,
    plan,
    personalYen: actual.personalYen + plan.personalYen,
    nutrition: addPersonalNutritionSum(actualNutrition, planNutrition),
    cookedHouseholdYen: actualCost.total,
    cookedMealCount: actualCost.count,
    planHouseholdYen: planCost.total,
    planMealCount: planCost.count,
    cookedDayCount,
    cookedPerDayYen: cookedDayCount > 0 ? Math.round(actualCost.total / cookedDayCount) : 0,
  }
}

/** カレンダーの1日分のセルに出す「1人分」の数字（2026-07-28 便CA・タスク2） */
export interface DayIntake {
  /** その日の1人分のエネルギー（kcal・概算） */
  kcal: number
  /** その日の1人分の食費（円・概算） */
  yen: number
  /** その日を数えた基準（過去=実績・今日以降=予定） */
  basis: 'actual' | 'plan'
  /** その日に数えた品数 */
  dishCount: number
}

/**
 * 月カレンダーの各セルに出す「その日1人分」の栄養・食費を日付ごとに集計する
 * （2026-07-28 便CA・タスク2「セル表示の切り替え」用）。
 * 期間集計と同じ規則2（過去日=作った記録・今日以降=登録した献立）で、1日は片方だけを数える。
 * 数字が出ない日（記録も予定も無い日）はMapに入れない＝呼び出し側でセルを空扱いにする。
 */
export function dayIntakeMap(input: {
  dates: string[]
  today: string
  cooked: RangeCookedDish[]
  planned: RangePlannedDish[]
  priceIndex: PriceIndexEntry[]
}): Map<string, DayIntake> {
  const { dates, today, cooked, planned, priceIndex } = input
  const cookedByDate = new Map<string, RangeCookedDish[]>()
  cooked.forEach((d) => {
    const list = cookedByDate.get(d.date)
    if (list) list.push(d)
    else cookedByDate.set(d.date, [d])
  })
  const plannedByDate = new Map<string, RangePlannedDish[]>()
  planned.forEach((d) => {
    const list = plannedByDate.get(d.date)
    if (list) list.push(d)
    else plannedByDate.set(d.date, [d])
  })

  const map = new Map<string, DayIntake>()
  for (const date of dates) {
    const basis: 'actual' | 'plan' = date < today ? 'actual' : 'plan'
    const dishes =
      basis === 'actual'
        ? (cookedByDate.get(date) ?? [])
        : (plannedByDate.get(date) ?? []).map((d) => ({ date: d.date, recipe: d.recipe }))
    if (dishes.length === 0) continue
    const cost = sumCookedRecipesCost(dishes, priceIndex)
    const nutrition = sumPersonalNutrition(dishes.map((d) => d.recipe))
    map.set(date, {
      kcal: nutrition.total.kcal,
      yen: cost.personalTotal,
      basis,
      dishCount: dishes.length,
    })
  }
  return map
}
