import { isKnownSeasoningName, isOptionalAmount } from './seasoningDictionary'

/**
 * 一覧カードの主要食材チップに、調味料（しょうゆ・みりん・少々・適量など）ばかりが
 * 選ばれないようにする。「大さじ／小さじ／単位なし」または分量が数値化できない
 * （少々・適量等）ものを調味料寄りとみなし、それ以外を優先して先頭から選ぶ。
 *
 * 検索索引（kana.ts）・買い物候補の初期チェック状態（shopping.ts）でも使う共有ロジックなので、
 * ここに手を入れると保存済みレシピの検索語と食い違う。一覧カード表示だけを絞り込みたい場合は
 * pickMainIngredients 側（名前辞書 isKnownSeasoningName・isOptionalAmount）に足すこと。
 */
export function isSeasoningLike(ingredient: { amount: string; unit: string }): boolean {
  const unit = ingredient.unit.trim()
  if (unit === '大さじ' || unit === '小さじ' || unit === '') return true
  return !Number.isFinite(Number.parseFloat(ingredient.amount))
}

/**
 * 一覧カードに出す主要食材（最大 count 件）を先頭から選ぶ。
 * 調味料・水・油・粉類・だし系・薬味少量（名前辞書）と「お好みで」の材料、
 * および分量・単位が調味料的なもの（isSeasoningLike）を除外し、
 * 残った材料をレシピの並び順のまま先頭から返す（枠を埋めるための水増しはしない）。
 */
export function pickMainIngredients<T extends { name: string; amount: string; unit: string }>(
  ingredients: readonly T[],
  count = 3,
): T[] {
  return ingredients
    .filter(
      (ing) =>
        !isSeasoningLike(ing) && !isKnownSeasoningName(ing.name) && !isOptionalAmount(ing.amount),
    )
    .slice(0, count)
}
