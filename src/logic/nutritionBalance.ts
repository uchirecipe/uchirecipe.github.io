import {
  addPersonalNutritionSum,
  computeRecipeNutrition,
  emptyPersonalNutritionSum,
  sumPersonalNutrition,
  type NutrientTotals,
  type PersonalNutritionSum,
  type RecipeNutrition,
} from './nutrition'
import {
  MEAL_PURPOSES,
  MORE_MEAL_PURPOSES,
  type MealPurpose,
  type MealSlot,
  type Recipe,
} from '../db/types'

/**
 * 栄養バランス献立 第1段「見える化」の純ロジック（2026-07-30 便CL・docs/60 第1段）。
 *
 * この層の責任は3つだけで、献立エンジン（logic/mealPlan.ts）には一切依存しない:
 *  1. 「目安」の公的基準値を1か所に持つ（DAILY_GUIDES）
 *  2. 野菜量（g）を数える（vegetableGrams。八訂の食品群「06 野菜類」だけを合計する）
 *  3. 日・期間の合計と、「目安との並置を出してよいか」の判定（docs/60 §5）
 *
 * 【文言・表示の規律（docs/60 §1-3。UI側で必ず守ること）】
 *  - 見出しには必ず「目安」を含める。
 *  - **不足・過多を断定しない**。「◯g／目安7.5g」のように数値を並置するだけにとどめ、
 *    「足りません」「摂りすぎです」とは書かない。色で善悪も表さない。
 *  - 「監修」「推奨」「減塩」「健康的」は使わない（景表法・医療助言の文脈になる。docs/08 §3）。
 *  - 計算に入っていないもの（ごはん・飲みもの・おやつ・外食）を必ず添える。
 *  - エネルギー・たんぱく質・脂質・炭水化物には**目安を出さない**（docs/60 §1-2。
 *    推定エネルギー必要量は年齢・性別・身体活動レベルで大きく変わり、1本の線を引くと誤誘導になる）。
 *
 * あくまで概算・目安。医療・効能の文脈では使わない（nutrition.ts 冒頭の設計方針と同じ）。
 */

// ---------- 目安の定数（出典つき・数値はここにだけ書く） ----------

/**
 * 目安1件の型。UIに数値を直書きさせないため、値と出典を必ず対で持つ
 * （docs/60 §1-1 運用ルール: 基準値は1か所にだけ書き、source / sourceUrl を必ず持たせる）。
 */
export interface DailyGuide {
  /** 出典名（UIに出す。栄養成分値の出典＝日本食品標準成分表とは別行で出すこと） */
  source: string
  /** 出典URL（UIからは出さず、コード・報告での検証用） */
  sourceUrl: string
}

/**
 * 食塩相当量の1日の目安（docs/60 §1-1）。
 *
 * 出典: 厚生労働省「日本人の食事摂取基準（2025年版）」の目標量。
 *   18歳以上 男性 7.5g/日未満・女性 6.5g/日未満。
 *   確認先（2026-07-30 に実際に開いて数値を確認した）:
 *   https://kennet.mhlw.go.jp/information/information/dictionary/food/ye-024.html
 *   （原文「18歳以上の男性で7.5g/日未満、女性で6.5g/日未満と設定されています」）
 *
 * ※ docs/60 §1-1 は「策定検討会報告書の本体PDFで再確認し、ページ番号をコメントに残す」ことを
 *   求めているが、本実装環境にPDFのテキスト抽出手段が無く本体PDFの該当ページまでは辿れていない。
 *   上の確認先は厚労省自身の解説サイト（健康日本21アクション支援システム＝旧e-ヘルスネット）で、
 *   一次資料そのものではない。本体PDFのページ番号追記は宿題として残っている。
 *
 * ※ 男女どちらを出すかの選択（docs/60 第3段「目安の基準」）は第1段では作らないため、
 *   UIは**両方を併記**する（docs/60 §7 未決#5＝(b) 併記。片方に丸めると
 *   「自分の値ではない数字」を出すことになる）。
 */
export const SALT_DAILY_GUIDE = {
  male: 7.5,
  female: 6.5,
  source: '日本人の食事摂取基準（2025年版）（厚生労働省）',
  sourceUrl: 'https://kennet.mhlw.go.jp/information/information/dictionary/food/ye-024.html',
} as const satisfies DailyGuide & { male: number; female: number }

/**
 * 野菜の1日の目安（docs/60 §1-1）。350g以上。
 *
 * 出典: 厚生労働省「健康日本21（第三次）」の目標値（栄養・食生活）。
 *   確認先: https://www.mhlw.go.jp/content/10900000/001122156.pdf
 *   （「健康日本21（第三次）について ～栄養・食生活関連を中心に～」厚生労働省 健康局健康課栄養指導室）
 *
 * ※ docs/60 §1-1 が挙げていたURL（.../content/10904750/001122156.pdf）は 2026-07-30 時点で
 *   404 だった（フォルダ番号が 10904750 ではなく 10900000）。UIに死んだ出典URLを載せないため、
 *   同一文書の生きているURLに差し替えている（文書名・数値は変えていない）。
 */
export const VEGETABLE_DAILY_GUIDE = {
  perDayG: 350,
  source: '健康日本21（第三次）（厚生労働省）',
  sourceUrl: 'https://www.mhlw.go.jp/content/10900000/001122156.pdf',
} as const satisfies DailyGuide & { perDayG: number }

/**
 * 第1段で目安を出す指標は「食塩相当量」と「野菜量」の2つだけ
 * （docs/60 §7 未決#2＝(a)。オーナー承認済み）。
 * エネルギー・食物繊維・鉄・カルシウム等に目安を増やすのは第1段の範囲外。
 */
export const DAILY_GUIDES = {
  saltG: SALT_DAILY_GUIDE,
  vegetableG: VEGETABLE_DAILY_GUIDE,
} as const

// ---------- 野菜量（八訂の食品群 06 野菜類だけを数える） ----------

/**
 * 八訂の食品群番号「06 野菜類」。野菜量はこの群に名寄せできた材料の重量だけを合計する。
 *
 * 国民健康・栄養調査の「野菜類」の定義に合わせ、
 * **いも類(02)・豆類(04)・果実類(07)・きのこ類(08)・藻類(09)は数えない**
 * （健康日本21の350g/日と同じ土俵に乗せるため）。
 * 例: ポテトサラダのじゃがいもは野菜に数えない／肉じゃがのじゃがいもも数えない。
 */
const VEGETABLE_GROUP_CODE = '06'

/**
 * すでに計算した RecipeNutrition から「1人分の野菜量(g)」を取り出す。
 *
 * items[].grams はレシピ全量（servings人分）のグラム数なので、人数で割って1人分にする。
 * 名寄せできなかった材料・分量が数値にできなかった材料は items に入らない＝数えない。
 * つまりこの値は**常に少なめ（下限側）に出る**ので、UIでは「目安より実際は多い可能性がある」
 * 方向の但し書きを必ず添えること（docs/60 §5-3）。
 */
export function vegetableGramsOf(nutrition: Pick<RecipeNutrition, 'items' | 'servings'>): number {
  let grams = 0
  for (const item of nutrition.items) {
    // 先頭2桁が食品群番号。'custom:◯◯'（八訂に収載が無い市販品参考の概算）はどの群にも入らない
    if (item.foodId.startsWith(VEGETABLE_GROUP_CODE)) grams += item.grams
  }
  const servings = nutrition.servings > 0 ? nutrition.servings : 1
  return grams / servings
}

/**
 * レシピ1品の「1人分の野菜量(g)」（docs/60 §2-1 のフィージビリティ実測と同じ数え方）。
 *
 * 期待値の見張り（scripts/test-logic.mjs）: 野菜炒め178g／コールスロー142g／
 * ペペロンチーノ6g／鮭の塩焼き0g／ポテトサラダ36g／肉じゃが134g。
 * とくにポテトサラダ・肉じゃがは「いも類を野菜に数えない」定義が守られているかの見張り役。
 */
export function vegetableGrams(recipe: Pick<Recipe, 'ingredients' | 'servings'>): number {
  return vegetableGramsOf(computeRecipeNutrition(recipe))
}

/** 表示用の丸め（野菜量は概算なので1g単位まで。小数は出さない） */
export function roundVegetableGrams(value: number): number {
  return Math.round(value)
}

// ---------- 日・期間の合計 ----------

/**
 * 集計に必要なレシピの最小形（テストから素の物体を渡せるようにRecipe全体には依存しない）。
 * id / title は「計算できなかった料理の名前」を画面へ出すためだけの任意項目（2026-08-23 便JP・②。
 * 数え方には関わらないので、ごはん1杯の擬似レシピのように持たない品もそのまま渡せる）。
 */
export type BalanceRecipeLike = Pick<Recipe, 'ingredients' | 'servings'> & {
  id?: number
  title?: string
}

/**
 * 「1人分」のバランス集計（8項目＋野菜量）。
 * 8項目の数え方は既存の sumPersonalNutrition（便CAで確定した「料理1品につき1人分を1回足す」）
 * をそのまま使う＝新しい数え方は作らない（docs/60 §3 第1段）。
 */
export interface BalanceSum {
  /** 1人分の栄養合計（8項目）と品数の内訳 */
  nutrition: PersonalNutritionSum
  /** 1人分の野菜量合計(g) */
  vegetableG: number
}

/** 空の BalanceSum（1品も無いときの戻り値・呼び出し側の初期値にも使う） */
export function emptyBalanceSum(): BalanceSum {
  return { nutrition: emptyPersonalNutritionSum(), vegetableG: 0 }
}

/**
 * 料理群（その日の献立／作った記録）の「1人分の合計」を出す。
 *
 * 野菜量は計算を2周する形になっているが、これは意図した設計:
 * 8項目の「どの品を合計に入れるか」の規則（1品も計算できないレシピは除く）は
 * sumPersonalNutrition が唯一の正であり、そこに野菜量の合計を書き足して規則を二重に持つと
 * 片方だけ直る事故が起きる。1品も計算できないレシピは items が0件＝野菜量も必ず0なので、
 * 全品を素直に足しても合計対象は自動的に一致する。
 */
export function sumBalance(recipes: BalanceRecipeLike[]): BalanceSum {
  const nutrition = sumPersonalNutrition(recipes)
  let vegetableG = 0
  for (const recipe of recipes) vegetableG += vegetableGrams(recipe)
  return { nutrition, vegetableG }
}

// ---------- ごはんを含めて計算する（2026-08-02 便CW-10・オーナー承認。無料・既定OFF） ----------

/**
 * 「ごはん1杯」を1品として数えるための擬似レシピ（1人分＝1杯）。
 *
 * 量も成分値も、日本食品標準成分表の「ご飯」（01088・logic/nutritionData.ts）から
 * **機械的に**引く。「1杯＝150g」は成分表側の unitGrams が持っている定義で、
 * ここにも画面にも数字を書き写さない（書き写すと成分表を直したときに片方だけ古くなる）。
 *
 * 献立に登録するのは「おかず」だけで、ごはんは登録しない人が大半という前提の機能。
 * 加えるのは各食1杯だけで、丼・麺・カレーのように主食を含む主菜の食事には加えない
 * （どの食事に加えるかの判定は、一品ものの定義を持つ献立エンジン側＝呼び出し側が決める）。
 */
export const RICE_SERVING_RECIPE: BalanceRecipeLike = {
  servings: 1,
  ingredients: [{ name: 'ご飯', amount: '1', unit: '杯' }],
}

/**
 * ごはん1杯のグラム数（UI文言に埋める値）。成分表の換算をそのまま使う＝手書きしない。
 * 名寄せできない・換算できない場合は 0 を返す（そのときUIは量を出さない）。
 */
let riceGramsCache: number | undefined
export function riceServingGrams(): number {
  if (riceGramsCache != null) return riceGramsCache
  const nutrition = computeRecipeNutrition(RICE_SERVING_RECIPE)
  let grams = 0
  for (const item of nutrition.items) grams += item.grams
  riceGramsCache = Math.round(grams)
  return riceGramsCache
}

/** ごはん{n}杯ぶんの擬似レシピ列（日・週の合計に足し込むために使う） */
export function riceServingRecipes(servings: number): BalanceRecipeLike[] {
  const count = Math.max(0, Math.floor(servings))
  return Array.from({ length: count }, () => RICE_SERVING_RECIPE)
}

/** 「ごはんを含めて計算する」の対象を数えるための、食事1つぶんの入力（純関数用の最小形） */
export interface RiceSlotInput {
  /** YYYY-MM-DD */
  date: string
  /** その日の中で食事を区別するキー（朝食/昼食/夕食） */
  slot: string
  /** その食事の主菜が一品もの（丼・麺・カレー・鍋）か＝主食が重なるので足さない */
  oneDishMain: boolean
}

/** 「日付|食事」の照合キー（杯数の数え方を1か所に閉じるための内部表現） */
export function riceSlotKey(date: string, slot: string): string {
  return `${date}|${slot}`
}

/**
 * ごはんを足す食事を選ぶ（2026-08-09 便EN でUIから切り出した純関数）。
 *
 * 規則は便CW-10のまま変えていない:
 *  ・料理が1品でも入っている食事ごとに1杯（**1日1杯ではなく食事の数だけ**）
 *  ・一品もの（丼・麺・カレー・鍋）が主菜の食事には足さない
 * 渡すのは「料理が入っている食事」だけ＝空の食事は呼び出し側で除く。
 *
 * オーナー質問（2026-08-09 実機）「昼食と夕食がおかずのみになっていても1杯のみの追加で
 * 計算している?」への回答をテストで固定するために切り出した。答えは「食事ごとに1杯」。
 */
export function riceSlotKeysOf(slots: RiceSlotInput[]): Set<string> {
  const keys = new Set<string>()
  for (const slot of slots) {
    if (slot.oneDishMain) continue
    keys.add(riceSlotKey(slot.date, slot.slot))
  }
  return keys
}

/** 「日付|食事」キーの集合から、日付ごとの杯数を数える */
export function riceServingsByDate(keys: Iterable<string>): Map<string, number> {
  const counts = new Map<string, number>()
  for (const key of keys) {
    const date = key.split('|')[0]
    counts.set(date, (counts.get(date) ?? 0) + 1)
  }
  return counts
}

// ---------- 目安との並置を出してよいかの判定（docs/60 §5） ----------

/**
 * 期間の合計で目安との並置をやめる、計算できなかった品の割合の上限
 * （docs/60 §7 未決#8＝(a) オーナー承認済み: 1日単位は「1品でもあれば出さない」・
 *  期間は2割で切る。厳しすぎると期間の比較がほぼ出なくなるため）。
 */
export const RANGE_EXCLUDED_RATIO_LIMIT = 0.2

/**
 * 【1日分】目安との並置を出してよいか（docs/60 §5 新設規則1〜3）。
 *
 * その日に「計算できない品」が1品でもあれば false にして、数値だけを出す。
 * 合計が下振れしていると分かっているものを「目安内」と見せるのは誤誘導になるため。
 * 対象は既存の2区分:
 *  - excludedDishCount … 1品も計算できないレシピ
 *  - partialDishCount  … 量が書いてあるのに計算できなかった材料がある品（hasMaterialGap）
 * 「適量・少々」だけが外れている品は数えない（便BY/NUT-01の線引きを踏襲＝誤警告を増やさない）。
 */
export function canCompareDay(sum: PersonalNutritionSum): boolean {
  return sum.dishCount > 0 && sum.excludedDishCount === 0 && sum.partialDishCount === 0
}

/**
 * 【期間（週・月）】目安との並置を出してよいか（docs/60 §5-4）。
 * 1日単位より影響が薄まるため件数を明示したうえで比較を出すが、
 * 1品も計算できなかった品が期間の品数の2割を超えたら出さない。
 */
export function canCompareRange(sum: PersonalNutritionSum): boolean {
  const totalDishes = sum.dishCount + sum.excludedDishCount
  if (sum.dishCount === 0) return false
  return sum.excludedDishCount / totalDishes <= RANGE_EXCLUDED_RATIO_LIMIT
}

/** 目安を日数分に伸ばす（週まとめ用。1日の目安 × 数えた日数） */
export function guideForDays(perDayGuide: number, days: number): number {
  return perDayGuide * days
}

// ---------- 週タブ用: 過去=実績・今日以降=予定で日ごとに集計する ----------

/** 1日分の料理1品（日付＋レシピ） */
export interface BalanceDish {
  /** YYYY-MM-DD */
  date: string
  recipe: BalanceRecipeLike
  /**
   * 「記録と献立で同じ料理か」を照合するキー（任意・2026-08-09 便EK）。
   *
   * 今日は作った記録と登録した献立が同居しうるので、同じ料理を両方で数えないための鍵に使う。
   * レシピIDそのものではなく文字列にしてあるのは、ごはん（RICE_SERVING_RECIPE）のように
   * レシピIDを持たない料理も記録側・献立側の両方に積まれるため（キーが無いと二重に数える）。
   * 渡さなければ照合しない＝その品は必ず両方に残る。
   */
  matchKey?: string
}

/**
 * その日を数えた基準（rangeSummary.ts の DayIntake.basis と同じ語彙）。
 * mixed＝今日で「作った記録」と「まだ作っていない献立」の両方を数えた日（2026-08-09 便EK）。
 */
export type BalanceBasis = 'actual' | 'plan' | 'mixed'

/** 1日分のバランス集計結果 */
export interface DayBalance {
  /** YYYY-MM-DD */
  date: string
  /** 作った記録だけ（actual）／登録した献立だけ（plan）／今日で両方を数えた日（mixed） */
  basis: BalanceBasis
  /** その日の1人分の合計 */
  balance: BalanceSum
  /** 目安との並置を出してよいか（canCompareDay） */
  comparable: boolean
  /**
   * 合計に入れた品のうち、どの食事（朝/昼/夕）のものか分からない品数（2026-08-09 便EK）。
   * ＝その日の献立と結び付かなかった「作った記録」の品数。
   * 0でない日は、食事ごとの小計を出すと1日の合計と足し算が合わない（呼び出し側で出さない）。
   */
  slotUnknownDishCount: number
  /**
   * その日の合計に足したごはんの杯数（2026-08-10 便FD・オーナー実機
   * 「この日の献立栄養で、合計何杯分のご飯が計算に入るか入れて」）。
   *
   * 数え直しはしない。**合計に実際に積んだ品のうち、ごはんの擬似レシピ
   * （RICE_SERVING_RECIPE）そのものが何個あったか**を数える＝画面に出す杯数と
   * 合計の中身が食い違いようがない。「ごはんを含めて計算する」がOFFの日は0。
   * 今日のように記録と献立が同居する日も、二重計上を落とした後の品で数える。
   */
  riceServings: number
}

/**
 * 今日ぶんの二重計上を防ぐ（2026-08-09 便EK。rangeSummary.ts の同名処理と同じ数え方）。
 * 今日の作った記録の件数だけ、今日の献立を先着で取り下げる＝記録1件につき献立1枠を消費する。
 * 照合キーの無い品は落とさない（＝従来どおり献立として数える）。
 */
function dropPlannedAlreadyCooked(
  plannedDishes: BalanceDish[],
  cookedDishes: BalanceDish[],
): { remaining: BalanceDish[]; matched: number } {
  const left = new Map<string, number>()
  for (const dish of cookedDishes) {
    if (dish.matchKey == null) continue
    left.set(dish.matchKey, (left.get(dish.matchKey) ?? 0) + 1)
  }
  if (left.size === 0) return { remaining: plannedDishes, matched: 0 }
  const remaining: BalanceDish[] = []
  let matched = 0
  for (const dish of plannedDishes) {
    const key = dish.matchKey
    const n = key == null ? 0 : (left.get(key) ?? 0)
    if (key == null || n <= 0) {
      remaining.push(dish)
      continue
    }
    left.set(key, n - 1)
    matched++
  }
  return { remaining, matched }
}

/**
 * 日付ごとの「その日1人分」のバランスを集計する（週タブの各日カード用）。
 *
 * 数える基準は便CA以降の統一規則（rangeSummary.ts §規則2）と同じ:
 * **過去日（date < today）は作った記録だけ・未来日（date > today）は登録した献立だけ・
 * 今日は「作った記録があるものは記録、まだのものは登録した献立」**。
 * 1日を実績と予定の両方で数えない＝二重計上しない、が最優先。
 * 日付比較は YYYY-MM-DD の辞書式比較がそのまま日付比較になる前提（isPastDate と同じ）。
 *
 * 2026-08-09 便EK: 従来は今日を予定側だけで数えていたため、**今日すでに作ったものが1日の合計に
 * 入らず**、同じ規則で数えているはずの期間集計（summarizeRangeIntake・dayIntakeMap。2026-08-08
 * 便EAで修正済み）と食い違っていた。今日の数え方をそちらへそろえる。
 *
 * 数字が出ない日（記録も予定も無い日）はMapに入れない＝呼び出し側でその日は何も出さない。
 * 食事帯（朝/昼/夕）では絞らない: 1日の合計は「その日に登録されている献立ぜんぶ」で数える
 * （表示帯フィルタで夕食だけ見ている日に朝食の塩分が消えると、合計の意味が変わってしまう）。
 */
export function dayBalanceMap(input: {
  dates: string[]
  /** YYYY-MM-DD */
  today: string
  cooked: BalanceDish[]
  planned: BalanceDish[]
}): Map<string, DayBalance> {
  const { dates, today, cooked, planned } = input
  const byDate = (dishes: BalanceDish[]): Map<string, BalanceDish[]> => {
    const map = new Map<string, BalanceDish[]>()
    dishes.forEach((d) => {
      const list = map.get(d.date)
      if (list) list.push(d)
      else map.set(d.date, [d])
    })
    return map
  }
  const cookedByDate = byDate(cooked)
  const plannedByDate = byDate(planned)

  const result = new Map<string, DayBalance>()
  for (const date of dates) {
    let dishes: BalanceDish[]
    let basis: BalanceBasis
    // 合計に入れたが、どの食事のものか分からない品数（＝献立と結び付かなかった記録）
    let slotUnknownDishCount: number
    if (date < today) {
      dishes = cookedByDate.get(date) ?? []
      basis = 'actual'
      // 作った記録には食事（朝/昼/夕）の情報が無い＝過去日は全品が「食事の分からない品」
      slotUnknownDishCount = dishes.length
    } else if (date > today) {
      dishes = plannedByDate.get(date) ?? []
      basis = 'plan'
      slotUnknownDishCount = 0
    } else {
      const cookedDishes = cookedByDate.get(date) ?? []
      const { remaining, matched } = dropPlannedAlreadyCooked(
        plannedByDate.get(date) ?? [],
        cookedDishes,
      )
      dishes = [...cookedDishes, ...remaining]
      basis =
        cookedDishes.length === 0 ? 'plan' : remaining.length === 0 ? 'actual' : 'mixed'
      // 献立に無い料理を作った記録だけが「食事の分からない品」として残る
      slotUnknownDishCount = cookedDishes.length - matched
    }
    if (dishes.length === 0) continue
    const balance = sumBalance(dishes.map((d) => d.recipe))
    result.set(date, {
      date,
      basis,
      balance,
      comparable: canCompareDay(balance.nutrition),
      slotUnknownDishCount,
      // 合計に積んだ品そのものから数える（riceServingRecipes が返すのは
      // RICE_SERVING_RECIPE の参照なので、同一性で数えれば取りこぼしも数え間違いも起きない）
      riceServings: dishes.filter((d) => d.recipe === RICE_SERVING_RECIPE).length,
    })
  }
  return result
}

/**
 * 食事（朝食/昼食/夕食）1つぶんの小計（2026-08-02 便CW-6・オーナー要望「朝昼夜別の栄養内訳」）。
 * 数え方は1日の合計とまったく同じ（sumBalance）で、分ける軸が増えただけ。
 */
export interface SlotBalance {
  slot: MealSlot
  balance: BalanceSum
}

/**
 * 小計を並べる順（朝食→昼食→夕食）。
 * 同じ並びの定数が logic/mealPlan.ts に MEAL_SLOTS としてあるが、この層は献立エンジンに
 * 依存しない方針（ファイル冒頭）なので、順序だけをここに持つ。
 * `satisfies` を付けてあるので、MealSlot に食事が増えたらここで型エラーになる。
 */
const SLOT_ORDER = ['breakfast', 'lunch', 'dinner'] as const satisfies readonly MealSlot[]

/**
 * 1日の献立を食事ごとに小計する（Pro表示用）。
 *
 * 並びは MEAL_SLOTS（朝食→昼食→夕食）に固定し、料理が1品も無い食事は返さない
 * （空の行を並べない）。呼び出し側は「2つ以上の食事に献立がある日」だけ表示に使う
 * ＝1食しか登録していない日は、1日の合計と同じ数字がもう一度並ぶだけになるため。
 *
 * 対象は**登録した献立だけ**。作った記録（CookedLog）には食事の情報が無いので、
 * 過ぎた日の小計は作れない（作れないものを推測で埋めない）。
 * 今日は記録と献立が同居しうるが、記録がすべて献立の中の料理なら
 * 「献立ぜんぶ＝その日の合計」なので小計を出せる（DayBalance.slotUnknownDishCount が0の日）。
 */
export function slotBalances(dishes: { slot: MealSlot; recipe: BalanceRecipeLike }[]): SlotBalance[] {
  const bySlot = new Map<MealSlot, BalanceRecipeLike[]>()
  for (const dish of dishes) {
    const list = bySlot.get(dish.slot)
    if (list) list.push(dish.recipe)
    else bySlot.set(dish.slot, [dish.recipe])
  }
  const result: SlotBalance[] = []
  for (const slot of SLOT_ORDER) {
    const recipes = bySlot.get(slot)
    if (!recipes || recipes.length === 0) continue
    result.push({ slot, balance: sumBalance(recipes) })
  }
  return result
}

/** 週（期間）まとめの集計結果 */
export interface WeekBalance {
  /** 期間の1人分の合計 */
  balance: BalanceSum
  /** 実際に数えた日数（献立も記録も無い日は数えない＝目安の掛け算の日数になる） */
  countedDays: number
  /** 目安との並置を出してよいか（canCompareRange） */
  comparable: boolean
  /** 期間の合計に足したごはんの杯数（日ごとの杯数の合計。2026-08-10 便FD） */
  riceServings: number
}

// ---------- 目的モード（docs/62 決定②）: 目的の軸と、その軸での比べ方 ----------

/**
 * 目的ごとに見る栄養素（1人分・8項目のどれか）。
 * 例:「たんぱく質多め」＝たんぱく質(g)、「塩分ひかえめ」＝食塩相当量(g)。
 * UIの表示ラベルもこのキーから引く（数値と項目名がずれないように1か所で決める）。
 *
 * 2026-08-07 便DT-9（オーナー指示）で8軸へ拡張した。使うのは既存の NutrientTotals の項目だけで、
 * 新しい栄養計算は1つも足していない＝成分値の出どころ（日本食品標準成分表）は変わらない。
 * `satisfies Record<MealPurpose, …>` を付けてあるので、目的が増えたらここで型エラーになる。
 */
export const PURPOSE_NUTRIENT_KEY = {
  protein: 'proteinG',
  fiber: 'fiberG',
  iron: 'ironMg',
  calcium: 'calciumMg',
  lowEnergy: 'kcal',
  lowFat: 'fatG',
  lowCarb: 'carbG',
  lowSalt: 'saltG',
} as const satisfies Record<MealPurpose, keyof NutrientTotals>

/**
 * その目的が「多め」を狙うものか（true＝値が大きいほど目的に沿う）。
 * 分類そのものは db/types.ts の MORE_MEAL_PURPOSES が持つ＝2か所に書かない。
 */
export function isMorePurpose(purpose: MealPurpose): boolean {
  return (MORE_MEAL_PURPOSES as readonly MealPurpose[]).includes(purpose)
}

/**
 * 目的の軸で見た「1食ぶんの合計」（主菜＋副菜の1人分を足した値）。
 * perServingTotals には、そのペアに入っている料理の1人分（perServing）を並べて渡す。
 */
export function purposeAxisValue(
  purpose: MealPurpose,
  perServingTotals: Partial<NutrientTotals>[],
): number {
  const key = PURPOSE_NUTRIENT_KEY[purpose]
  let sum = 0
  for (const t of perServingTotals) sum += t[key] ?? 0
  return sum
}

/**
 * 引き直し（chooseBalancedPair）に渡す「目的からの遠さ」。**小さいほど目的に沿う**。
 *
 * 【なぜ「目安からの距離」にしないか】
 * docs/60 §1-2 のとおり、たんぱく質には**1日の目安を出さない**（推定必要量は年齢・性別・
 * 身体活動レベルで大きく変わり、1本の線を引くと誤誘導になる）。目的モードのために
 * 表に出さない目標値をこっそり決めるのは、その規律を裏口から破ることになる。
 * そこで「線に近いか」ではなく「引いた候補どうしを比べてどちらが軸に沿うか」だけで決める。
 *
 *  - 「多め」の目的（たんぱく質・食物繊維・鉄・カルシウム）… 1 / (1 + 軸の値)。
 *    多いほど小さくなる（＝多い方を採る）が、必ず正の値なので0以下にはならない
 *    ＝「ここで満足」という打ち切り点を作らない（満たすべき線が無いことを式でも表す）。
 *  - 「ひかえめ」の目的（エネルギー・脂質・炭水化物・塩分）… 軸の値そのもの。
 *    少ないほど小さくなる。0（＝計算上ゼロ）のときだけ打ち切る。
 *
 * 2026-08-07 便DT-9: 軸が8つになっても式は上の2種類のままで、向き（多め/ひかえめ）だけで
 * 決まる＝軸ごとの重み付け・目標値は持たない。単位（g / mg / kcal）が違っても、
 * 比べるのは**同じ軸どうしの相対値**だけなので単位換算は要らない。
 *
 * どちらも「良い/悪い」の判定ではなく、候補の並べ替えに使う相対値でしかない。
 */
export function purposePenalty(
  purpose: MealPurpose,
  perServingTotals: Partial<NutrientTotals>[],
): number {
  const value = purposeAxisValue(purpose, perServingTotals)
  if (isMorePurpose(purpose)) return 1 / (1 + Math.max(0, value))
  return value
}

// ---------- 目的モードの「答え合わせ」（月タブ・docs/62 決定②） ----------

/** 1つの目的についての事実表示（断定・達成/未達の判定はしない。数字の並置だけ） */
export interface PurposeDayReview {
  purpose: MealPurpose
  /** その目的を指定して組んだ日のうち、数字が出た日数 */
  days: number
  /** 期間内で数字が出た日数（分母。献立も記録も無い日は数えない） */
  totalDays: number
  /** 目的を指定して組んだ日の「1日あたり」の軸の値（1人分・g）。0日なら null */
  averageWith: number | null
  /** それ以外の日の「1日あたり」の軸の値（1人分・g）。0日なら null */
  averageWithout: number | null
}

/**
 * 「目的を指定して組んだ日」の答え合わせ（2026-08-02 便CP-2・docs/62 決定②）。
 *
 * 出すのは**事実だけ**: ①その目的で組んだ日が期間内に何日あったか ②その日の1日あたりの
 * 軸の値（1人分）と、それ以外の日の同じ値。達成/未達の判定も、良し悪しの色分けもしない
 * （docs/60 §1-3 の文言規律。「多い方がよい」とも言わない）。
 *
 * 日ごとの合計は dayBalanceMap の結果をそのまま使う＝過去日は作った記録・今日以降は登録した献立
 * という既存の数え方（rangeSummary.ts 規則2）と必ず一致する。
 * 1品も計算できなかった日（dishCount=0）は平均も日数も数えない（0gの日として平均を薄めない）。
 */
export function reviewPurposeDays(
  days: Iterable<DayBalance>,
  purposeByDate: ReadonlyMap<string, MealPurpose>,
): PurposeDayReview[] {
  const countable = [...days].filter((d) => d.balance.nutrition.dishCount > 0)
  const totalDays = countable.length
  const result: PurposeDayReview[] = []
  for (const purpose of MEAL_PURPOSES) {
    const key = PURPOSE_NUTRIENT_KEY[purpose]
    let withDays = 0
    let withSum = 0
    let withoutDays = 0
    let withoutSum = 0
    for (const day of countable) {
      const value = day.balance.nutrition.total[key]
      if (purposeByDate.get(day.date) === purpose) {
        withDays++
        withSum += value
      } else {
        withoutDays++
        withoutSum += value
      }
    }
    if (withDays === 0) continue // その目的で組んだ日が無い期間には何も出さない
    result.push({
      purpose,
      days: withDays,
      totalDays,
      averageWith: withSum / withDays,
      averageWithout: withoutDays > 0 ? withoutSum / withoutDays : null,
    })
  }
  return result
}

/**
 * dayBalanceMap の結果を期間の合計にまとめる（週タブの週まとめ用）。
 *
 * 目安は「1日の目安 × countedDays」で並置する（guideForDays）。
 * 7日固定で掛けないのは、3日しか登録していない週を7日ぶんの目安と並べると
 * 「ぜんぜん足りない」と読める数字になり、数値の並置という規律から外れるため。
 */
export function summarizeWeekBalance(days: Iterable<DayBalance>): WeekBalance {
  // 8項目の足し算は既存の addPersonalNutritionSum に任せる（同じ足し算を2か所に書かない）
  let nutrition = emptyPersonalNutritionSum()
  let vegetableG = 0
  let countedDays = 0
  let riceServings = 0
  for (const day of days) {
    nutrition = addPersonalNutritionSum(nutrition, day.balance.nutrition)
    vegetableG += day.balance.vegetableG
    countedDays++
    riceServings += day.riceServings
  }
  return {
    balance: { nutrition, vegetableG },
    countedDays,
    comparable: canCompareRange(nutrition),
    riceServings,
  }
}
