import { toHiragana } from './kana'
import { isSeasoningLike } from './mainIngredients'
import type { Ingredient } from '../db/types'

export interface ShoppingCandidate {
  name: string
  /** 表示用にまとめた分量。単位が揃えば合計し、揃わなければ「・」で列挙する */
  amount: string
  recipeIds: number[]
  /** 全レシピでの使われ方が調味料的（大さじ/小さじ/単位なし/少々等）なら true */
  isSeasoningLike: boolean
}

/**
 * 単位ごとにグループ化し、数値化できるものはグループ内で合計する
 * （例:「大さじ2」+「大さじ3」+「小さじ1」→「大さじ5・小さじ1」）。
 * 数値化できないもの（「少々」等）はそのまま列挙する。
 */
function combineAmounts(parts: { amount: string; unit: string }[]): string {
  const nonEmpty = parts.filter((p) => p.amount.trim() || p.unit.trim())
  if (nonEmpty.length === 0) return ''

  const groups = new Map<string, { amount: string; unit: string }[]>()
  for (const part of nonEmpty) {
    const unit = part.unit.trim()
    const list = groups.get(unit)
    if (list) list.push(part)
    else groups.set(unit, [part])
  }

  const texts: string[] = []
  for (const [unit, items] of groups) {
    const nums = items.map((p) => Number.parseFloat(p.amount))
    if (nums.every((n) => Number.isFinite(n))) {
      const total = nums.reduce((sum, n) => sum + n, 0)
      const totalText = Number.isInteger(total) ? String(total) : String(Math.round(total * 10) / 10)
      texts.push(`${totalText}${unit}`)
    } else {
      texts.push(...items.map((p) => `${p.amount}${p.unit}`.trim()))
    }
  }
  return texts.join('・')
}

/**
 * 選んだレシピの材料を名前でまとめ、在庫「ある」の食材を除いた買い物候補を作る。
 * ここで作った候補はまだ買い物メモではなく、確認してから確定してもらう「下書き」。
 */
export function buildShoppingCandidates(
  recipes: { id: number; ingredients: Ingredient[] }[],
  pantryHaveNames: string[],
): ShoppingCandidate[] {
  const haveKeys = new Set(pantryHaveNames.map(toHiragana))
  const order: string[] = []
  const map = new Map<
    string,
    { name: string; parts: { amount: string; unit: string }[]; recipeIds: number[] }
  >()

  for (const recipe of recipes) {
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
      entry.parts.push({ amount: ing.amount, unit: ing.unit })
      if (!entry.recipeIds.includes(recipe.id)) entry.recipeIds.push(recipe.id)
    }
  }

  return order.map((key) => {
    const entry = map.get(key)!
    return {
      name: entry.name,
      amount: combineAmounts(entry.parts),
      recipeIds: entry.recipeIds,
      isSeasoningLike: entry.parts.every(isSeasoningLike),
    }
  })
}
