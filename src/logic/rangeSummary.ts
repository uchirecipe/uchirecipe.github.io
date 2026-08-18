/**
 * 月タブ「期間の食費と栄養」の集計ロジック（2026-07-28 便CA・オーナー確定仕様）。
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
 *  規則2（過去=実績・未来=予定・今日=両方）: 過去日（date < today）は「作った記録」だけ、
 *    未来日（date > today）は「登録した献立」だけ。
 *    **今日だけは「作った記録があるものは記録・まだのものは登録した献立」で数える**
 *    （2026-08-08 便EA・オーナー指摘「今日の『作った記録』が集計に入っていない」。
 *    従来は今日を丸ごと予定側に入れており、今日すでに作ったものが記録として数えられず、
 *    基準行も「8/7〜8/7は作った記録、8/8〜8/9は登録した献立」とその通りに出ていた）。
 *    同じ料理を実績と予定の両方で数えない＝二重計上しない、が最優先
 *    （今日の予定は、記録1件につき1枠を先着で取り下げる。logic/mealPlan.ts cookedPlanEntryIds と同じ数え方）。
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
  type NutrientTotals,
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
  /**
   * どのレシピの記録か（任意・2026-08-08 便EA）。
   * 「今日」は記録と予定が同居しうるので、同じ料理を二重に数えないための照合キーに使う。
   * 渡さなければ照合しない＝今日の予定はそのまま予定として数える（従来と同じ）。
   */
  recipeId?: number
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
  /**
   * どのレシピの予定か（任意・2026-08-08 便EA）。
   * 今日の枠が「もう作った」ときに、記録側と二重に数えないための照合キー。
   */
  recipeId?: number
}

/**
 * 基準行（「どの日をどちらで数えたか」）に出す3つの部分（2026-08-08 便EA）。
 * 今日は記録と献立が同居しうるので、過去・未来と分けて持つ。
 */
export interface RangeBasisParts {
  /** 作った記録だけで数える過去の範囲（今日を含まない）。無ければ null */
  past: { start: string; end: string } | null
  /** 登録した献立だけで数える未来の範囲（今日を含まない）。無ければ null */
  future: { start: string; end: string } | null
  /** 期間に今日が入っているか（今日は「作った分は記録・まだの分は献立」で数える） */
  includesToday: boolean
}

/** 基準行の材料を作る。start<=end に正規化済みの値を渡すこと */
export function rangeBasisParts(start: string, end: string, today: string): RangeBasisParts {
  const pastEnd = end < today ? end : shiftDay(today, -1)
  const futureStart = start > today ? start : shiftDay(today, 1)
  return {
    past: start <= pastEnd ? { start, end: pastEnd } : null,
    future: futureStart <= end ? { start: futureStart, end } : null,
    includesToday: start <= today && today <= end,
  }
}

/** YYYY-MM-DD を日数ぶんずらす（月またぎ・うるう年もDateに任せる） */
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 期間を「実績で数える日」と「予定で数える日」に分けた結果 */
export interface RangeBasisSplit {
  /** 作った記録で数える範囲（過去日）。過去日が1日も無ければ null */
  actual: { start: string; end: string } | null
  /** 登録した献立で数える範囲（今日以降）。今日以降が1日も無ければ null */
  plan: { start: string; end: string } | null
}

/**
 * 選んだ期間を「作った記録で数える範囲」と「登録した献立で数える範囲」に切り分ける（規則2）。
 * YYYY-MM-DD同士の辞書式比較がそのまま日付比較になる前提（isPastDateと同じ）。
 * start<=end に正規化済みの値を渡すこと（呼び出し側の normalizeDateRange 済み）。
 *
 * 2026-08-08 便EA（オーナー指摘「今日の『作った記録』が集計に入っていない」）:
 * 従来は「今日の前日まで＝記録／今日から先＝予定」で切っていたため、**今日すでに作ったものが
 * 記録として数えられず、予定側で数えられていた**（基準行も「8/7〜8/7は作った記録、8/8〜8/9は
 * 登録した献立」と、その通りに出ていた）。今日は両方の範囲に入れ、
 * 「作った記録があるものは記録・まだのものは予定」で数える（二重計上は splitRangeDishes で防ぐ）。
 */
export function splitRangeByToday(start: string, end: string, today: string): RangeBasisSplit {
  // 記録で数える範囲は「開始日〜min(終了日, 今日)」＝今日を含む
  const actualEnd = end < today ? end : today
  // 予定で数える範囲は「max(開始日, 今日)〜終了日」＝今日を含む
  const planStart = start > today ? start : today
  return {
    actual: start <= actualEnd ? { start, end: actualEnd } : null,
    plan: planStart <= end ? { start: planStart, end } : null,
  }
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
  /**
   * 「全員分」の合計（円・2026-08-19 便HV・オーナー書き溜め⑧⑨
   * 「期間の食費と栄養は、過去と未来に分けない表示のみでいいのでは？
   * 　過去の数値が知りたい人は過去の期間のみで絞り込みするし、これからの予算が知りたい人も然り」）。
   * 作った食数ぶん（cookedHouseholdYen）と、これから作る食数ぶん（planHouseholdYen）を足した額。
   * 画面はこの1つだけを出す＝過去と未来で行が2つに割れない。
   * 割る前の2つも残してあるのは、折りたたみの中の内訳がそのまま使うため。
   */
  householdYen: number
  /** 「全員分」ののべ食数（cookedMealCount + planMealCount）。householdYen と対の数字 */
  mealCount: number
  /**
   * 「1日あたりの平均」の分母（作った記録か登録した献立がある日数・同じ日に何品でも1日）。
   * 便HV で分子（householdYen）が実績＋予定になったので、分母も同じ料理から数える
   * ＝画面の上で「全員分 ÷ この日数 ＝ 1日あたりの平均」を検算できる形を保つ。
   */
  dayCount: number
  /** householdYen を dayCount で割った1日あたりの金額（円・数える日が1日も無ければ0） */
  perDayYen: number
  /**
   * 基準行に出す材料（2026-08-08 便EA）。actual.range / plan.range は今日を両方に含むので、
   * 画面の文言はこちら（過去・未来・今日を分けたもの）から組み立てる。
   */
  basis: RangeBasisParts
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
  // 過去日と今日: 作った記録を数える（過去の予定ベース計算はオーナー指示で廃止）
  const actualDishes =
    actual == null ? [] : cooked.filter((d) => d.date >= actual.start && d.date <= actual.end)
  // 今日と未来日: 登録した献立を数える。ただし今日は、もう作った品を記録側で数えているので落とす
  const planDishes =
    plan == null ? [] : planned.filter((d) => d.date >= plan.start && d.date <= plan.end)
  return {
    actualDishes,
    planDishes: dropPlannedAlreadyCooked(planDishes, actualDishes, today),
  }
}

/**
 * 今日ぶんの二重計上を防ぐ（2026-08-08 便EA・オーナー指摘）。
 *
 * 今日は「作った記録があるものは記録・まだのものは予定」で数える。同じ料理を両方で数えないよう、
 * 今日の作った記録の件数だけ、今日の予定を先着で取り下げる
 * （数え方は logic/mealPlan.ts cookedPlanEntryIds と同じ＝記録1件につき予定1枠を消費するので、
 * 同じ料理を2枠に予定して1回だけ作った日は、片方だけが記録側に移り、残りは予定のまま残る）。
 *
 * recipeId を渡していない呼び出し（照合キーが無い）では何も落とさない＝従来どおりの数え方になる。
 */
function dropPlannedAlreadyCooked(
  planDishes: RangePlannedDish[],
  actualDishes: RangeCookedDish[],
  today: string,
): RangePlannedDish[] {
  const remaining = new Map<number, number>()
  for (const dish of actualDishes) {
    if (dish.date !== today || dish.recipeId == null) continue
    remaining.set(dish.recipeId, (remaining.get(dish.recipeId) ?? 0) + 1)
  }
  if (remaining.size === 0) return planDishes
  return planDishes.filter((dish) => {
    if (dish.date !== today || dish.recipeId == null) return true
    const left = remaining.get(dish.recipeId) ?? 0
    if (left <= 0) return true
    remaining.set(dish.recipeId, left - 1)
    return false
  })
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
  // 便HV（⑧⑨）: 過去と未来を分けない合計。分母も分子と同じ料理から数える
  const dayCount = new Set([...actualDishes, ...planDishes].map((d) => d.date)).size
  const householdYen = actualCost.total + planCost.total

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
    householdYen,
    mealCount: actualCost.count + planCost.count,
    dayCount,
    perDayYen: dayCount > 0 ? Math.round(householdYen / dayCount) : 0,
    basis: rangeBasisParts(start, end, today),
  }
}

/** カレンダーの1日分のセルに出す「1人分」の数字（2026-07-28 便CA・タスク2） */
export interface DayIntake {
  /**
   * その日の1人分の栄養8項目（概算・2026-08-19 便HV・⑥）。
   * 従来はエネルギーだけを持っていたが、マスに出す項目を選べるようにしたので8項目とも持つ
   * （顔ぶれ・名前は logic/nutrition.ts の NUTRITION_DISPLAY_KEYS が1か所で決める）。
   */
  nutrition: NutrientTotals
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
    // 2026-08-08 便EA: 今日は「作った記録があるものは記録・まだのものは登録した献立」で数える
    // （期間の集計＝summarizeRangeIntake と同じ規則2。カレンダーと期間カードが同じ数字になる）
    const todayCooked = date === today ? (cookedByDate.get(date) ?? []) : []
    const dishes: RangeCookedDish[] =
      date < today
        ? (cookedByDate.get(date) ?? [])
        : date > today
          ? (plannedByDate.get(date) ?? []).map((d) => ({ date: d.date, recipe: d.recipe }))
          : [
              ...todayCooked,
              ...dropPlannedAlreadyCooked(plannedByDate.get(date) ?? [], todayCooked, today).map(
                (d) => ({ date: d.date, recipe: d.recipe }),
              ),
            ]
    // 今日は記録と献立が混ざりうる。記録が1件でもあれば「作った記録」の色・読み上げにする
    const basis: 'actual' | 'plan' = date < today || todayCooked.length > 0 ? 'actual' : 'plan'
    if (dishes.length === 0) continue
    const cost = sumCookedRecipesCost(dishes, priceIndex)
    const nutrition = sumPersonalNutrition(dishes.map((d) => d.recipe))
    map.set(date, {
      nutrition: nutrition.total,
      yen: cost.personalTotal,
      basis,
      dishCount: dishes.length,
    })
  }
  return map
}
