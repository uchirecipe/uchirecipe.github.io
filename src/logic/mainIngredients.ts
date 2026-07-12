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

/**
 * 括弧書き(半角/全角どちらも。「(切り身)」「（テンメンジャン）」「(3倍濃縮)」等、
 * 部位・状態・ふりがなの注記)を除去する(半角(...)・全角（...）の両方に対応)。
 * データ(保存されている材料名)は変更しない。一覧カードの表示専用の正規化。
 */
const PAREN_PATTERN = /[（(][^）)]*[）)]/g

/**
 * 表示ラベルを1つに統一する食材名の別名辞書(2026-07-12オーナー実機フィードバック:
 * 「生鮭」「甘塩鮭」はどちらもチップでは「鮭」と表示してスッキリさせたい)。
 * キーは括弧書き除去後の文字列。将来、別の食材で同種の要望が出たらここに追記する。
 */
const CHIP_LABEL_SYNONYMS: Record<string, string> = {
  生鮭: '鮭',
  甘塩鮭: '鮭',
}

/** 一覧カードの食材チップに出す表示専用ラベル(データは変更しない) */
export function normalizeIngredientChipLabel(name: string): string {
  const withoutParens = name.replace(PAREN_PATTERN, '').replace(/\s+/g, ' ').trim()
  return CHIP_LABEL_SYNONYMS[withoutParens] ?? withoutParens
}

/**
 * 一覧カードに出す食材チップ(最大 count 件・表示専用ラベル)を選ぶ。
 * pickMainIngredients で候補を多めに集めてから表示ラベルへ正規化し、
 * 同じラベルになったもの(例:「生鮭」と「甘塩鮭」→どちらも「鮭」)は重複させず1つにまとめる
 * (同カード内で重複したら1つに、2026-07-12オーナー実機フィードバック)。
 */
export function pickDisplayIngredientChips<
  T extends { name: string; amount: string; unit: string },
>(ingredients: readonly T[], count = 3): { name: string }[] {
  const candidates = pickMainIngredients(ingredients, count * 3)
  const seen = new Set<string>()
  const chips: { name: string }[] = []
  for (const ing of candidates) {
    const label = normalizeIngredientChipLabel(ing.name)
    if (!label || seen.has(label)) continue
    seen.add(label)
    chips.push({ name: label })
    if (chips.length >= count) break
  }
  return chips
}
