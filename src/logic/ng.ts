import { toHiragana } from './kana'
import type { Ingredient } from '../db/types'

/**
 * NG食材（アレルギー・苦手）の判定。
 * ひらがな化して比較するので「エビ」「えび」「海老エビ」の表記ゆれも拾える。
 * 材料名にNGワードが含まれていれば一致とみなす（例: NG「えび」→「むきえび」も警告）。
 */

/** NGに引っかかる材料の行番号（index）の集合を返す */
export function ngMatchedIndices(
  ingredients: readonly Ingredient[],
  ngIngredients: readonly string[],
): Set<number> {
  const matched = new Set<number>()
  const ngWords = ngIngredients.map((ng) => toHiragana(ng.trim())).filter(Boolean)
  if (ngWords.length === 0) return matched

  ingredients.forEach((ingredient, index) => {
    const name = toHiragana(ingredient.name)
    if (ngWords.some((ng) => name.includes(ng))) matched.add(index)
  })
  return matched
}

/** レシピがNG食材を1つでも含むか */
export function hasNgIngredient(
  recipe: { ingredients: readonly Ingredient[] },
  ngIngredients: readonly string[],
): boolean {
  return ngMatchedIndices(recipe.ingredients, ngIngredients).size > 0
}
