import type { Recipe } from '../db/types'
import { toHiragana } from './kana'
import { computeRecipeNutrition } from './nutrition'
import type { SearchResult } from './search'

/**
 * 栄養並び替えの5種類（カロリー・たんぱく質・塩分・脂質・糖質=docs/08の「栄養価のめやす」Pro5項目と整合）。
 * 2026-07-16 便T: 従来はカロリーだけ無料でも選べたが、5項目まとめてPro機能化した
 * （オーナー指示による確定・docs/34便T-4。アプリ未公開・実ユーザー0のため後戻り問題なし）
 */
export const NUTRIENT_SORT_OPTIONS = ['kcal', 'protein', 'salt', 'fat', 'carb'] as const
export type NutrientSortOption = (typeof NUTRIENT_SORT_OPTIONS)[number]

/** レシピ一覧の並べ替えオプション（kcal/protein/salt/fat/carb=栄養並び替え。2026-07-13 Fable設計、
 * 2026-07-16 便Tで塩分・脂質・糖質を追加。theme=基本レシピ順（2026-07-17オーナー指示で追加、
 * 2026-07-20 便AMで「基本レシピ→自作」の2区分に単純化しラベルも改称。識別子theme自体は
 * sessionStorage保存値の互換のため据え置き）） */
export type RecipeSortOption =
  | 'updated'
  | 'pantryMatch'
  | 'kana'
  | 'cooked'
  | 'theme'
  | NutrientSortOption

/** 並べ替えオプションが栄養並び替え（Pro機能）かどうか */
export function isNutrientSortOption(option: RecipeSortOption): option is NutrientSortOption {
  return (NUTRIENT_SORT_OPTIONS as readonly string[]).includes(option)
}

/** 並べ替えの昇順/降順（2026-07-13 UI改善） */
export type SortDirection = 'asc' | 'desc'

/**
 * 並べ替えの種類ごとの既定方向。「あいうえお順（五十音順）」だけ昇順（あ→ん）が自然で、
 * それ以外（更新順=新しい順・よく使う順=多い順・在庫一致順=多い順）は降順が自然なため、
 * 種類を切り替えたときはこの既定値にリセットする（呼び出し側で使う）。
 * 栄養並び替えの既定は「たんぱく質だけ多い方から（高たんぱく志向）・それ以外（カロリー・塩分・脂質・糖質）は
 * 少ない方から（ヘルシー志向）」（2026-07-13にカロリーで導入した方針を2026-07-16に塩分・脂質・糖質にも適用。
 * どれも昇順/降順トグルで反転できる）。
 * 基本レシピ順（theme）の既定も昇順で、①基本レシピ（公式全部）→②自作レシピ、の順に
 * 読める並びを基準にする（2026-07-17オーナー指示で新設時は①基本レシピ→②各テーマ（五十音順）→
 * ③自作レシピの3区分だったが、2026-07-20 便AMで第◯弾/テーマの括りを廃止し2区分に単純化。
 * 降順トグルで全体反転できる）
 */
export const defaultSortDirection: Record<RecipeSortOption, SortDirection> = {
  updated: 'desc',
  pantryMatch: 'desc',
  kana: 'asc',
  cooked: 'desc',
  theme: 'asc',
  kcal: 'asc',
  protein: 'desc',
  salt: 'asc',
  fat: 'asc',
  carb: 'asc',
}

/**
 * 栄養並び替え用の1食（1人分）あたりの値。null は算出不能（材料が名寄せできない自作レシピ等）で、
 * 昇順/降順に関わらず常に末尾へ回す（2026-07-16 便T: 塩分・脂質・糖質を追加）
 */
export interface NutrientSortValue {
  kcal: number | null
  proteinG: number | null
  fatG: number | null
  carbG: number | null
  saltG: number | null
}

/** 並べ替えオプション → NutrientSortValue のキーの対応表（sortResultsと一覧カードの値表示で共用） */
export const NUTRIENT_SORT_FIELD: Record<NutrientSortOption, keyof NutrientSortValue> = {
  kcal: 'kcal',
  protein: 'proteinG',
  salt: 'saltG',
  fat: 'fatG',
  carb: 'carbG',
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
      map.set(recipe.id, { kcal: null, proteinG: null, fatG: null, carbG: null, saltG: null })
    } else {
      map.set(recipe.id, {
        kcal: nutrition.perServing.kcal,
        proteinG: nutrition.perServing.proteinG,
        fatG: nutrition.perServing.fatG,
        carbG: nutrition.perServing.carbG,
        saltG: nutrition.perServing.saltG,
      })
    }
  }
  return map
}

const collator = new Intl.Collator('ja')

/** 在庫にある食材のうち、このレシピの材料に含まれるものの数 */
function pantryMatchCount(recipe: Recipe, normalizedPantryNames: string[]): number {
  if (normalizedPantryNames.length === 0) return 0
  const ingredientNames = recipe.ingredients.map((i) => toHiragana(i.name))
  return normalizedPantryNames.filter((pantryName) =>
    ingredientNames.some((name) => name.includes(pantryName)),
  ).length
}

/**
 * 「基本レシピ順」並び替えの基本区分（2026-07-17オーナー指示で新設、2026-07-20 便AMで単純化）。
 * 第◯弾/テーマの括りは表示上廃止したため、配布テーマ取り込み品（sourceSetNameあり）も
 * 公式(isStarter)としてひとまとめにする。0=基本レシピ（isStarter。テーマ取り込み品含む）／1=自作レシピ
 */
function themeGroupRank(recipe: Recipe): number {
  return recipe.isStarter ? 0 : 1
}

/** 各並べ替えの「昇順」方向の比較値（updatedAt・かな順・作った回数・在庫一致数・テーマ区分のいずれか） */
function compareAscending(
  option: Exclude<RecipeSortOption, NutrientSortOption>,
  a: SearchResult,
  b: SearchResult,
  normalizedPantryNames: string[],
): number {
  switch (option) {
    case 'updated':
      return a.recipe.updatedAt - b.recipe.updatedAt
    case 'kana':
      return collator.compare(toHiragana(a.recipe.title), toHiragana(b.recipe.title))
    case 'cooked':
      return a.recipe.cookedLogs.length - b.recipe.cookedLogs.length
    case 'pantryMatch':
      return (
        pantryMatchCount(a.recipe, normalizedPantryNames) -
        pantryMatchCount(b.recipe, normalizedPantryNames)
      )
    case 'theme':
      // ①基本レシピ（公式全部）→②自作レシピの2区分（2026-07-20 便AMで第◯弾/テーマの区分を
      // 廃止し単純化。公式内の順序はここでは0を返し、sortResults側の既定タイブレーク
      // （更新順=新しい順）に委ねる＝「公式内は既定順」の要件どおり）
      return themeGroupRank(a.recipe) - themeGroupRank(b.recipe)
  }
}

/**
 * 検索結果の並べ替え。directionは各並べ替えの「昇順」を基準に反転する
 * （例: kanaの昇順=あいうえお順、updatedの降順=新しい順）。
 * 省略時はその並べ替えの既定方向（defaultSortDirection）を使うため、
 * 昇順/降順トグルを触っていないユーザーには従来どおりの並びを保つ。
 * 同点のときは常に更新順（新しい順）を維持する（directionの影響を受けない）。
 * 栄養並び替え（kcal/protein/salt/fat/carb）では nutrientValues（buildNutrientSortValues の結果）を渡すこと。
 * 値が null（算出不能）のレシピは昇順/降順に関わらず常に末尾に回す
 */
export function sortResults(
  results: SearchResult[],
  option: RecipeSortOption,
  pantryNames: string[],
  direction: SortDirection = defaultSortDirection[option],
  nutrientValues?: ReadonlyMap<number, NutrientSortValue>,
): SearchResult[] {
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...results]

  if (isNutrientSortOption(option)) {
    const field = NUTRIENT_SORT_FIELD[option]
    const valueOf = (result: SearchResult): number | null => {
      const value = result.recipe.id === undefined ? undefined : nutrientValues?.get(result.recipe.id)
      if (!value) return null
      return value[field]
    }
    sorted.sort((a, b) => {
      const av = valueOf(a)
      const bv = valueOf(b)
      // 算出不能（null）は昇順/降順に関わらず常に末尾へ
      if ((av === null) !== (bv === null)) return av === null ? 1 : -1
      if (av !== null && bv !== null && av !== bv) return sign * (av - bv)
      return b.recipe.updatedAt - a.recipe.updatedAt
    })
    return sorted
  }

  const normalizedPantry = option === 'pantryMatch' ? pantryNames.map(toHiragana) : []
  sorted.sort(
    (a, b) =>
      sign * compareAscending(option, a, b, normalizedPantry) ||
      b.recipe.updatedAt - a.recipe.updatedAt,
  )
  return sorted
}
