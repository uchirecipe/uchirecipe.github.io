import type { Recipe } from '../db/types'
import { toHiragana } from './kana'
import type { SearchResult } from './search'

/** レシピ一覧の並べ替えオプション */
export type RecipeSortOption = 'updated' | 'pantryMatch' | 'kana' | 'cooked'

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
 * 検索結果の並べ替え。「更新順」は listRecipes() が既に新しい順に並べているのでそのまま。
 * それ以外の基準で並べ替え、同点のときは更新順（新しい順）を維持する。
 */
export function sortResults(
  results: SearchResult[],
  option: RecipeSortOption,
  pantryNames: string[],
): SearchResult[] {
  if (option === 'updated') return results
  const sorted = [...results]
  if (option === 'kana') {
    sorted.sort(
      (a, b) =>
        collator.compare(toHiragana(a.recipe.title), toHiragana(b.recipe.title)) ||
        b.recipe.updatedAt - a.recipe.updatedAt,
    )
  } else if (option === 'cooked') {
    sorted.sort(
      (a, b) =>
        b.recipe.cookedLogs.length - a.recipe.cookedLogs.length ||
        b.recipe.updatedAt - a.recipe.updatedAt,
    )
  } else if (option === 'pantryMatch') {
    const normalizedPantry = pantryNames.map(toHiragana)
    sorted.sort(
      (a, b) =>
        pantryMatchCount(b.recipe, normalizedPantry) -
          pantryMatchCount(a.recipe, normalizedPantry) || b.recipe.updatedAt - a.recipe.updatedAt,
    )
  }
  return sorted
}
