/**
 * 一覧カードの主要食材チップに、調味料（しょうゆ・みりん・少々・適量など）ばかりが
 * 選ばれないようにする。「大さじ／小さじ／単位なし」または分量が数値化できない
 * （少々・適量等）ものを調味料寄りとみなし、それ以外を優先して先頭から選ぶ。
 */
export function isSeasoningLike(ingredient: { amount: string; unit: string }): boolean {
  const unit = ingredient.unit.trim()
  if (unit === '大さじ' || unit === '小さじ' || unit === '') return true
  return !Number.isFinite(Number.parseFloat(ingredient.amount))
}

export function pickMainIngredients<T extends { amount: string; unit: string }>(
  ingredients: readonly T[],
  count = 3,
): T[] {
  const main = ingredients.filter((ing) => !isSeasoningLike(ing))
  const seasoning = ingredients.filter((ing) => isSeasoningLike(ing))
  return [...main, ...seasoning].slice(0, count)
}
