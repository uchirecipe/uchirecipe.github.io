import { toHiragana } from './kana'
import { isSeasoningLike } from './mainIngredients'
import { formatAmountUnit, normalizeDigits } from './amount'
import { categorizePantryName, SHOPPING_AISLE_ORDER } from './pantryGroups'
import type { Ingredient } from '../db/types'

/**
 * 買い物メモを一般的なスーパーの売り場順に自動整列する（2026-07-24 実機FB #11）。
 * 食材名から在庫グループを判定し（pantryGroups の分類を流用）、SHOPPING_AISLE_ORDER の
 * 順に並べる。同じグループ内は元の並び（＝既存の追加順）を保つ安定ソート。
 * 表示専用で、DBの保存順（order）は書き換えない。
 */
export function sortShoppingByAisle<T extends { name: string }>(items: T[]): T[] {
  const rank = new Map(SHOPPING_AISLE_ORDER.map((key, index) => [key, index]))
  return items
    .map((item, index) => ({ item, index, group: categorizePantryName(item.name) }))
    .sort((a, b) => (rank.get(a.group)! - rank.get(b.group)!) || a.index - b.index)
    .map((entry) => entry.item)
}

export interface ShoppingCandidate {
  name: string
  /** 表示用にまとめた分量。単位が揃えば合計し、揃わなければ「・」で列挙する */
  amount: string
  recipeIds: number[]
  /**
   * 全レシピでの使われ方が調味料的（大さじ/小さじ/単位なし/少々等）、
   * または水道から出るもの（水・お湯・湯）なら true。
   * true の候補は買い物候補でデフォルト未チェックになる
   */
  isSeasoningLike: boolean
}

/**
 * 買うものではないのに分量が数値（600ml等）のせいで主材料扱いされてしまう食材。
 * 調味料と同じくデフォルト未チェックにする（2026-07-09ペルソナ第2波: 「水」がチェック済みで入る）
 */
const TAP_WATER_NAMES = new Set(['水', 'お湯', '湯'].map(toHiragana))

/** 買い物候補づくりの内部で扱う、1材料分の分量パーツ（scale=食数スケール、既定1） */
interface AmountPart {
  amount: string
  unit: string
  /** そのレシピの「指定食数 ÷ 登録人数」。数値化できる分量にだけ掛ける（2026-07-23 #3） */
  scale: number
}

/**
 * 単位ごとにグループ化し、数値化できるものはグループ内で合計する
 * （例:「大さじ2」+「大さじ3」+「小さじ1」→「大さじ5・小さじ1」）。
 * 数値化できないもの（「少々」等）はそのまま列挙する。
 * 各パーツの scale（指定食数スケール）は数値化できる分量にのみ掛ける。
 */
function combineAmounts(parts: AmountPart[]): string {
  const nonEmpty = parts.filter((p) => p.amount.trim() || p.unit.trim())
  if (nonEmpty.length === 0) return ''

  const groups = new Map<string, AmountPart[]>()
  for (const part of nonEmpty) {
    const unit = part.unit.trim()
    const list = groups.get(unit)
    if (list) list.push(part)
    else groups.set(unit, [part])
  }

  const texts: string[] = []
  for (const [unit, items] of groups) {
    const nums = items.map((p) => Number.parseFloat(normalizeDigits(p.amount)) * p.scale)
    if (nums.every((n) => Number.isFinite(n))) {
      const total = nums.reduce((sum, n) => sum + n, 0)
      const totalText = Number.isInteger(total) ? String(total) : String(Math.round(total * 10) / 10)
      texts.push(formatAmountUnit(totalText, unit))
    } else {
      // 「少々」など数値化できない分量は食数スケールを掛けられないので原文のまま列挙する
      texts.push(...items.map((p) => formatAmountUnit(p.amount, p.unit)))
    }
  }
  return texts.join('・')
}

/**
 * 選んだレシピの材料を名前でまとめ、在庫「ある」の食材を除いた買い物候補を作る。
 * ここで作った候補はまだ買い物メモではなく、確認してから確定してもらう「下書き」。
 *
 * 各レシピは任意で scale（指定食数スケール。2026-07-23 #3「食数の+/-」方式で
 * targetServings ÷ recipe.servings を渡す）を持てる。未指定は1（＝1回分そのまま）。
 */
export function buildShoppingCandidates(
  recipes: { id: number; ingredients: Ingredient[]; scale?: number }[],
  pantryHaveNames: string[],
): ShoppingCandidate[] {
  const haveKeys = new Set(pantryHaveNames.map(toHiragana))
  const order: string[] = []
  const map = new Map<
    string,
    { name: string; parts: AmountPart[]; recipeIds: number[] }
  >()

  for (const recipe of recipes) {
    const scale = recipe.scale && recipe.scale > 0 ? recipe.scale : 1
    for (const ing of recipe.ingredients) {
      const trimmedName = ing.name.trim()
      if (!trimmedName) continue
      const key = toHiragana(trimmedName)
      if (haveKeys.has(key)) continue // 在庫「ある」は候補に出さない

      let entry = map.get(key)
      if (!entry) {
        entry = { name: trimmedName, parts: [], recipeIds: [] }
        map.set(key, entry)
        order.push(key)
      }
      entry.parts.push({ amount: ing.amount, unit: ing.unit, scale })
      if (!entry.recipeIds.includes(recipe.id)) entry.recipeIds.push(recipe.id)
    }
  }

  return order.map((key) => {
    const entry = map.get(key)!
    return {
      name: entry.name,
      amount: combineAmounts(entry.parts),
      recipeIds: entry.recipeIds,
      isSeasoningLike: TAP_WATER_NAMES.has(key) || entry.parts.every(isSeasoningLike),
    }
  })
}
