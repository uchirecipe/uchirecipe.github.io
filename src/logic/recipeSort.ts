import type { Recipe } from '../db/types'
import { toHiragana } from './kana'
import type { SearchResult } from './search'

/** レシピ一覧の並べ替えオプション */
export type RecipeSortOption = 'updated' | 'pantryMatch' | 'kana' | 'cooked'

/** 並べ替えの昇順/降順（2026-07-13 UI改善） */
export type SortDirection = 'asc' | 'desc'

/**
 * 並べ替えの種類ごとの既定方向。「あいうえお順」だけ昇順（あ→ん）が自然で、
 * それ以外（更新順=新しい順・よく使う順=多い順・在庫一致順=多い順）は降順が自然なため、
 * 種類を切り替えたときはこの既定値にリセットする（呼び出し側で使う）
 */
export const defaultSortDirection: Record<RecipeSortOption, SortDirection> = {
  updated: 'desc',
  pantryMatch: 'desc',
  kana: 'asc',
  cooked: 'desc',
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

/** 各並べ替えの「昇順」方向の比較値（updatedAt・かな順・作った回数・在庫一致数のいずれか） */
function compareAscending(
  option: RecipeSortOption,
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
  }
}

/**
 * 検索結果の並べ替え。directionは各並べ替えの「昇順」を基準に反転する
 * （例: kanaの昇順=あいうえお順、updatedの降順=新しい順）。
 * 省略時はその並べ替えの既定方向（defaultSortDirection）を使うため、
 * 昇順/降順トグルを触っていないユーザーには従来どおりの並びを保つ。
 * 同点のときは常に更新順（新しい順）を維持する（directionの影響を受けない）
 */
export function sortResults(
  results: SearchResult[],
  option: RecipeSortOption,
  pantryNames: string[],
  direction: SortDirection = defaultSortDirection[option],
): SearchResult[] {
  const normalizedPantry = option === 'pantryMatch' ? pantryNames.map(toHiragana) : []
  const sign = direction === 'asc' ? 1 : -1
  const sorted = [...results]
  sorted.sort(
    (a, b) =>
      sign * compareAscending(option, a, b, normalizedPantry) ||
      b.recipe.updatedAt - a.recipe.updatedAt,
  )
  return sorted
}
