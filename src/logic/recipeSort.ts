import type { Recipe } from '../db/types'
import { titleKanaKey } from './kana'
import { makePantryMatcher } from './pantry'
import {
  estimateRecipeCost,
  recipeCostConfidence,
  type PriceIndexEntry,
} from './priceEstimate'
import {
  computeRecipeNutrition,
  nutritionLabelFor,
  nutritionUnitFor,
  type NutrientTotals,
} from './nutrition'
import type { SearchResult } from './search'

/**
 * 栄養並び替えの顔ぶれ（2026-08-19 便HU・⑯で栄養価の表示と同じ8項目にそろえた。
 * 並びも表示と同じ＝エネルギー・たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウム・塩分相当量）。
 *
 * オーナー「ラインナップをいつもの栄養価にして。糖質は炭水化物？鉄も入ってない」の2点は
 * 実データで確かめた結果どちらもそのとおりだった:
 *  (a) 旧「糖質」の中身は成分表の CHOCDF-（炭水化物）で、食物繊維を引いた糖質ではない
 *      → **中身は変えず名前を炭水化物に合わせた**（ja.nutrition.carbLabel）
 *  (b) 鉄（ironMg）はデータにも栄養8項目の表示にもあるのに、並び替えだけ抜けていた
 *      → 食物繊維・カルシウムと合わせて足した
 * 無料/Proの線引き（FREE_NUTRIENT_SORT_OPTIONS）は動かしていない＝無料はエネルギー順だけ。
 *
 * 旧: 栄養並び替えの5種類（カロリー・たんぱく質・塩分・脂質・糖質）。
 * 2026-07-16 便T: 従来はカロリーだけ無料でも選べたが、5項目まとめてPro機能化した
 * （オーナー指示による確定・docs/34便T-4）。
 * 2026-08-01 線引きB'（オーナー確定）: このうち**カロリー順だけを無料に開放**し、
 * たんぱく質・塩分・脂質・糖質はProのまま（FREE_NUTRIENT_SORT_OPTIONS参照）。
 * 並べ替えの計算そのものは無料/Proで同じ（ここは選択肢の見せ方＝UIのゲートだけを分ける）。
 */
export const NUTRIENT_SORT_OPTIONS = [
  'kcal',
  'protein',
  'fat',
  'carb',
  'fiber',
  'iron',
  'calcium',
  'salt',
] as const
export type NutrientSortOption = (typeof NUTRIENT_SORT_OPTIONS)[number]

/**
 * 無料でも選べる栄養並び替え（2026-08-01 線引きB'・オーナー確定）。
 * エネルギー（カロリー）順だけ。無料版で見える栄養の値がエネルギーだけなので、
 * 「画面に出ている値で並べ替えられる」という対応関係を保つ。
 * 2026-08-19 便HU・⑯で顔ぶれが8項目に増えたが、無料側はここを動かしていない。
 */
export const FREE_NUTRIENT_SORT_OPTIONS: readonly NutrientSortOption[] = ['kcal']

/** Pro解錠が要る栄養並び替え（顔ぶれからエネルギーを引いた残り全部） */
export const PRO_NUTRIENT_SORT_OPTIONS: readonly NutrientSortOption[] = NUTRIENT_SORT_OPTIONS.filter(
  (option) => !FREE_NUTRIENT_SORT_OPTIONS.includes(option),
)


/** レシピ一覧の並べ替えオプション（栄養並び替えは NutrientSortOption の8項目。2026-07-13 Fable設計、
 * 2026-07-16 便Tで塩分・脂質・糖質を追加。旧'theme'（基本レシピ順）は配布テーマ全廃で無意味化した
 * ため2026-07-24 便BN・タスク4で廃止。sessionStorageに旧'theme'が残っていても、sortResultsは
 * 該当なしで更新順のタイブレークに落ちるだけなので後方互換上の問題はない） */
export type RecipeSortOption =
  | 'updated'
  | 'pantryMatch'
  | 'kana'
  | 'cooked'
  /** 最近作った順（2026-08-03 オーナー指示）。「作った！」の記録の最新日付で並べる */
  | 'recentCooked'
  /** 1食あたりの原価順（2026-08-25 便KS・②。オーナー原文「原価で並び替えもほしい」）。無料で使える */
  | 'cost'
  | NutrientSortOption

/**
 * そのレシピの「作った！」の記録のうち、いちばん新しい日付（YYYY-MM-DD）。
 * 記録が1件も無ければ null（並べ替えでは昇順/降順に関わらず常に末尾へ回す）。
 * CookedLog.date は日付までしか持たないので、同じ日の複数記録は同着になる。
 * 記録は追加順のまま保存されており日付順とは限らないため、必ず最大値を取る
 */
export function lastCookedDate(recipe: Pick<Recipe, 'cookedLogs'>): string | null {
  let latest: string | null = null
  for (const log of recipe.cookedLogs) {
    if (!log.date) continue
    if (latest === null || log.date > latest) latest = log.date
  }
  return latest
}

/** 並べ替えオプションが栄養並び替え（カロリー順のみ無料・残りはPro）かどうか */
export function isNutrientSortOption(option: RecipeSortOption): option is NutrientSortOption {
  return (NUTRIENT_SORT_OPTIONS as readonly string[]).includes(option)
}

/**
 * その並べ替えを無料版でも選べるか（2026-08-01 線引きB'）。
 * 栄養並び替え以外（更新順・五十音順など）は元から無料なので常にtrue。
 */
export function isFreeSortOption(option: RecipeSortOption): boolean {
  if (!isNutrientSortOption(option)) return true
  return FREE_NUTRIENT_SORT_OPTIONS.includes(option)
}

/** 並べ替えの昇順/降順（2026-07-13 UI改善） */
export type SortDirection = 'asc' | 'desc'

/**
 * 並べ替えの種類ごとの既定方向。「あいうえお順（五十音順）」だけ昇順（あ→ん）が自然で、
 * それ以外（更新順=新しい順・よく使う順=多い順・在庫一致順=多い順）は降順が自然なため、
 * 種類を切り替えたときはこの既定値にリセットする（呼び出し側で使う）。
 * 栄養並び替えの既定は「たんぱく質・食物繊維・鉄・カルシウムは多い方から・エネルギー・脂質・
 * 炭水化物・塩分相当量は少ない方から（ヘルシー志向）」（2026-07-13にカロリーで導入した方針を
 * 2026-07-16に塩分・脂質にも適用、2026-08-19 便HUで足した3項目にも同じ考え方で向きを決めた。
 * どれも昇順/降順トグルで反転できる）。
 */
export const defaultSortDirection: Record<RecipeSortOption, SortDirection> = {
  updated: 'desc',
  pantryMatch: 'desc',
  kana: 'asc',
  cooked: 'desc',
  // 「最近作った順」は新しい方から（2026-08-03）
  recentCooked: 'desc',
  // 「1食あたりの原価順」は安い方から（2026-08-25 便KS・②。エネルギーと同じ考え方で、
  // 探す動機が「安く作れる品を見つける」側にあるため。昇順/降順トグルで反転できる）
  cost: 'asc',
  kcal: 'asc',
  protein: 'desc',
  fat: 'asc',
  carb: 'asc',
  // 2026-08-19 便HU・⑯で足した3項目。食物繊維・鉄・カルシウムは「多い方から探す」のが自然
  // （たんぱく質と同じ向き。少ない方から見たいときは昇順/降順トグルで反転できる）
  fiber: 'desc',
  iron: 'desc',
  calcium: 'desc',
  salt: 'asc',
}

/**
 * 栄養並び替え用の1食（1人分）あたりの値。null は算出不能（材料が名寄せできない自作レシピ等）で、
 * 昇順/降順に関わらず常に末尾へ回す（2026-07-16 便T: 塩分・脂質・糖質を追加）
 */
export type NutrientSortValue = {
  [K in keyof NutrientTotals]: number | null
}

/** 並べ替えオプション → NutrientSortValue のキーの対応表（sortResultsと一覧カードの値表示で共用） */
export const NUTRIENT_SORT_FIELD: Record<NutrientSortOption, keyof NutrientSortValue> = {
  kcal: 'kcal',
  protein: 'proteinG',
  fat: 'fatG',
  carb: 'carbG',
  fiber: 'fiberG',
  iron: 'ironMg',
  calcium: 'calciumMg',
  salt: 'saltG',
}

/**
 * 栄養並び替えの項目名（2026-08-19 便HU・⑯でここへ集約）。
 * 従来は RecipesPage が自前の文言を持っていたため、栄養表示の名前と食い違っても誰も気づかなかった
 * （並び替え「糖質」／表示「炭水化物」）。名前は栄養表示（nutritionLabelFor）から引く。
 */
export const NUTRIENT_SORT_LABELS: Record<NutrientSortOption, string> = Object.fromEntries(
  NUTRIENT_SORT_OPTIONS.map((option) => [option, nutritionLabelFor(NUTRIENT_SORT_FIELD[option])]),
) as Record<NutrientSortOption, string>

/** 並び替えの項目に対応する単位（kcal / g / mg）。表示と同じものを使う */
export function nutrientSortUnit(option: NutrientSortOption): string {
  return nutritionUnitFor(NUTRIENT_SORT_FIELD[option])
}

/**
 * 全レシピ分の栄養並び替え値（1食あたり）をまとめて計算する（2026-07-13 Fable設計）。
 * 栄養概算はレシピ数×材料数に比例して重いので、呼び出し側（RecipesPage）は
 * 栄養並び替えを選んでいる間だけ useMemo で1回計算し、毎レンダー再計算しない。
 * 計算に含められた材料が1つも無いレシピは null（算出不能）にする
 * （NutritionTeaser が「0kcal」を表示しないのと同じ判定基準）
 */
export function buildNutrientSortValues(recipes: Recipe[]): Map<number, NutrientSortValue> {
  const map = new Map<number, NutrientSortValue>()
  for (const recipe of recipes) {
    if (recipe.id === undefined) continue
    const nutrition = computeRecipeNutrition(recipe)
    if (nutrition.items.length === 0) {
      map.set(recipe.id, {
        kcal: null,
        proteinG: null,
        fatG: null,
        carbG: null,
        saltG: null,
        fiberG: null,
        ironMg: null,
        calciumMg: null,
      })
    } else {
      // 顔ぶれが増えても書き写しが古くならないよう、1食あたりの値をそのまま写す
      const per = nutrition.perServing
      map.set(recipe.id, {
        kcal: per.kcal,
        proteinG: per.proteinG,
        fatG: per.fatG,
        carbG: per.carbG,
        saltG: per.saltG,
        fiberG: per.fiberG,
        ironMg: per.ironMg,
        calciumMg: per.calciumMg,
      })
    }
  }
  return map
}

/**
 * 1食あたりの原価で並べるための値（2026-08-25 便KS・②。オーナー原文「原価で並び替えもほしい」）。
 *
 * 【「安い順」に嘘を並べないための決めごと】
 * 価格が分からない材料の分は合計に1円も入らないので、その品の金額は**必ず実際より安く出る**。
 * そのまま値だけで並べると、値段を入れ忘れただけの品が「いちばん安い品」として先頭に来る。
 * そこで、値のほかに「金額がそろっているか」を持ち、次の3つのまとまりの順に並べる
 * （このまとまりの順は昇順/降順のどちらでも変わらない。反転するのはまとまりの中だけ）:
 *   ①金額がそろっている品（価格が分からない材料が0件）
 *   ②一部の材料の価格が分からない品（レシピ詳細で「※」が付く品と同じ判定）
 *   ③金額が1円も分からない品（値が無いので、まとまりの中は更新順）
 * ②を末尾へ回さず②のまとまりの中でも金額順に並べるのは、材料10件中1件だけ抜けている品まで
 * 「並べない」にすると、自分で登録したレシピの多くが原価順から締め出されるため。
 * どのまとまりに入るかは、レシピ詳細の「※」と同じ根拠なので、画面で理由を確かめられる。
 */
export interface RecipeCostSortValue {
  /** 1食あたりの概算（円）。金額が1円も分からない品は null */
  perServingYen: number | null
  /** 価格が分からない材料が1件も無い（＝金額がそろっている） */
  complete: boolean
}

/**
 * 全レシピ分の「1食あたりの原価」をまとめて計算する。
 * 栄養並び替え（buildNutrientSortValues）と同じで、呼び出し側は原価順を選んでいる間だけ
 * useMemo で1回計算する。1食あたりの割り算はレシピ詳細の原価サマリーと同じ
 * （登録人数で割る＝表示中の人数には追随しない値）。
 */
export function buildCostSortValues(
  recipes: Recipe[],
  priceIndex: PriceIndexEntry[],
): Map<number, RecipeCostSortValue> {
  const map = new Map<number, RecipeCostSortValue>()
  for (const recipe of recipes) {
    if (recipe.id === undefined) continue
    const cost = estimateRecipeCost(recipe.ingredients, priceIndex)
    const confidence = recipeCostConfidence(recipe.ingredients, priceIndex)
    map.set(recipe.id, {
      perServingYen: cost.hasAnyPriceInfo
        ? Math.round(recipe.servings > 0 ? cost.total / recipe.servings : cost.total)
        : null,
      complete: !confidence.shouldWarn,
    })
  }
  return map
}

/** 原価順の「まとまり」（小さいほど先。昇順/降順に関わらずこの順は変わらない） */
function costTier(value: RecipeCostSortValue | undefined): number {
  if (!value || value.perServingYen === null) return 2
  return value.complete ? 0 : 1
}

const collator = new Intl.Collator('ja')

/**
 * 在庫にある食材のうち、このレシピの材料に含まれるものの数。
 * 在庫との照合は logic/pantry.ts の判定器に一本化する(2026-07-29 便CC/C4)。
 */
function pantryMatchCount(
  recipe: Recipe,
  matchers: ((ingredientName: string) => boolean)[],
): number {
  if (matchers.length === 0) return 0
  return matchers.filter((matches) => recipe.ingredients.some((i) => matches(i.name))).length
}

/** 各並べ替えの「昇順」方向の比較値（updatedAt・かな順・作った回数・在庫一致数のいずれか。
 * 'recentCooked'（記録なしを常に末尾へ）と 'cost'（金額のそろい方でまとまりを分ける）は
 * 別の扱いが要るので sortResults 側で個別に処理する） */
function compareAscending(
  option: Exclude<RecipeSortOption, NutrientSortOption | 'recentCooked' | 'cost'>,
  a: SearchResult,
  b: SearchResult,
  pantryMatchers: ((ingredientName: string) => boolean)[],
): number {
  switch (option) {
    case 'updated':
      return a.recipe.updatedAt - b.recipe.updatedAt
    case 'kana':
      // 2026-07-29 便CI/C12: 食材名辞書だけで読みを引いていたため、辞書に無い漢字始まりの
      // 料理名(肉じゃが・親子丼・麻婆豆腐…)がコードポイント比較で末尾に固まっていた。
      // 料理名の読み(logic/titleReadings.ts)で比べる
      return collator.compare(titleKanaKey(a.recipe.title), titleKanaKey(b.recipe.title))
    case 'cooked':
      return a.recipe.cookedLogs.length - b.recipe.cookedLogs.length
    case 'pantryMatch':
      return pantryMatchCount(a.recipe, pantryMatchers) - pantryMatchCount(b.recipe, pantryMatchers)
  }
}

/**
 * 検索結果の並べ替え。directionは各並べ替えの「昇順」を基準に反転する
 * （例: kanaの昇順=あいうえお順、updatedの降順=新しい順）。
 * 省略時はその並べ替えの既定方向（defaultSortDirection）を使うため、
 * 昇順/降順トグルを触っていないユーザーには従来どおりの並びを保つ。
 * 同点のときは常に更新順（新しい順）を維持する（directionの影響を受けない）。
 * 栄養並び替え（NUTRIENT_SORT_OPTIONS）では nutrientValues（buildNutrientSortValues の結果）を渡すこと。
 * 値が null（算出不能）のレシピは昇順/降順に関わらず常に末尾に回す
 */
export function sortResults(
  results: SearchResult[],
  option: RecipeSortOption,
  pantryNames: string[],
  direction: SortDirection = defaultSortDirection[option],
  nutrientValues?: ReadonlyMap<number, NutrientSortValue>,
  /** 原価順（'cost'）のときだけ渡す。buildCostSortValues の結果 */
  costValues?: ReadonlyMap<number, RecipeCostSortValue>,
): SearchResult[] {
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...results]

  // 「使いたい食材」を入れているあいだは、使える食材が多いレシピを必ず先に出す
  // (2026-07-29 便CI/C11)。logic/search.ts は usedCount 降順に並べていたのに、その結果を
  // ここが並べ替えの種類(既定=更新順)で丸ごと並べ直していたため、「入れた食材ぜんぶ使える」
  // レシピが5位・10位に埋もれていた。並べ替えの選択は同点内の順序として引き続き効く
  const wantedActive = results.some((result) => result.wantedCount > 0)
  const byUsedCount = (a: SearchResult, b: SearchResult) =>
    wantedActive ? b.usedCount - a.usedCount : 0

  if (isNutrientSortOption(option)) {
    const field = NUTRIENT_SORT_FIELD[option]
    const valueOf = (result: SearchResult): number | null => {
      const value = result.recipe.id === undefined ? undefined : nutrientValues?.get(result.recipe.id)
      if (!value) return null
      return value[field]
    }
    sorted.sort((a, b) => {
      const used = byUsedCount(a, b)
      if (used !== 0) return used
      const av = valueOf(a)
      const bv = valueOf(b)
      // 算出不能（null）は昇順/降順に関わらず常に末尾へ
      if ((av === null) !== (bv === null)) return av === null ? 1 : -1
      if (av !== null && bv !== null && av !== bv) return sign * (av - bv)
      return b.recipe.updatedAt - a.recipe.updatedAt
    })
    return sorted
  }

  // 1食あたりの原価順(2026-08-25 便KS・②)。金額がそろっている品→一部の価格が分からない品→
  // 金額が1円も分からない品、の順にまとめてから、まとまりの中を金額で並べる
  // (まとまりの順は昇順/降順で変わらない＝「安い順」の先頭に、値段を入れ忘れただけの品を出さない)
  if (option === 'cost') {
    const valueOf = (result: SearchResult): RecipeCostSortValue | undefined =>
      result.recipe.id === undefined ? undefined : costValues?.get(result.recipe.id)
    sorted.sort((a, b) => {
      const used = byUsedCount(a, b)
      if (used !== 0) return used
      const av = valueOf(a)
      const bv = valueOf(b)
      const tier = costTier(av) - costTier(bv)
      if (tier !== 0) return tier
      const ay = av?.perServingYen ?? null
      const by = bv?.perServingYen ?? null
      if (ay !== null && by !== null && ay !== by) return sign * (ay - by)
      return b.recipe.updatedAt - a.recipe.updatedAt
    })
    return sorted
  }

  // 最近作った順(2026-08-03 オーナー指示)。「作った！」の記録の最新日付で並べ、
  // 記録が1件も無いレシピは昇順/降順に関わらず常に末尾へ回す(栄養並び替えのnullと同じ扱い)
  if (option === 'recentCooked') {
    sorted.sort((a, b) => {
      const used = byUsedCount(a, b)
      if (used !== 0) return used
      const av = lastCookedDate(a.recipe)
      const bv = lastCookedDate(b.recipe)
      if ((av === null) !== (bv === null)) return av === null ? 1 : -1
      if (av !== null && bv !== null && av !== bv) return sign * (av < bv ? -1 : 1)
      return b.recipe.updatedAt - a.recipe.updatedAt
    })
    return sorted
  }

  // 在庫チップ1件ごとの照合器を1回だけ作る(2026-07-29 便CC/C4。判定は logic/pantry.ts に一本化)
  const pantryMatchers =
    option === 'pantryMatch' ? pantryNames.map((name) => makePantryMatcher([name])) : []
  sorted.sort(
    (a, b) =>
      byUsedCount(a, b) ||
      sign * compareAscending(option, a, b, pantryMatchers) ||
      b.recipe.updatedAt - a.recipe.updatedAt,
  )
  return sorted
}
