import { toHiragana } from './kana'
import { resolvePantryGroup } from './pantryGroups'
import type { PantryItem, PantryLevel } from '../db/types'

/**
 * 「今あるもので作れる」検索に使う、在庫のある食材名の一覧。
 * 「ある」「少ない」を在庫ありとみなし、「ない」は含めない。
 */
export function pantryAvailableNames(items: PantryItem[]): string[] {
  return items.filter((item) => item.level !== 'none').map((item) => item.name)
}

/** 在庫を1段階だけ下げる: ある→少ない→ない（ないは据え置き） */
const PANTRY_LEVEL_DOWN: Record<PantryLevel, PantryLevel> = {
  have: 'low',
  low: 'none',
  none: 'none',
}

/**
 * 「作った！」の在庫反映（2026-07-23 オーナー実機FB #11）で、1段階下げる対象を選ぶ純ロジック。
 * - レシピで使った食材（材料名に在庫チップ名が含まれる＝在庫一致順と同じ名寄せ）だけが対象
 * - 調味料グループ（logic/pantryGroups）は対象外（毎回減らすと実態と合わないため）
 * - すでに「ない」の食材は据え置き（それ以上は下げない）
 * - 在庫チップに無い食材は勝手に作らない（反映は登録済みチップの範囲だけ）
 * 返すのは実際に変化する分だけ（id と下げた後のlevel）。
 */
export function selectPantryDowngrades(
  items: PantryItem[],
  ingredientNames: string[],
): { id: number; level: PantryLevel }[] {
  const ingredientKeys = ingredientNames.map((n) => toHiragana(n)).filter(Boolean)
  if (ingredientKeys.length === 0) return []
  const result: { id: number; level: PantryLevel }[] = []
  for (const item of items) {
    if (item.id === undefined || item.level === 'none') continue
    if (resolvePantryGroup(item) === 'seasoning') continue
    const key = toHiragana(item.name)
    if (!key) continue
    if (!ingredientKeys.some((name) => name.includes(key))) continue
    result.push({ id: item.id, level: PANTRY_LEVEL_DOWN[item.level] })
  }
  return result
}

/**
 * 買い物候補から除く食材名の一覧。
 * 「ある」だけを対象にする（「少ない」は買い足したいことがあるので候補に残す）。
 */
export function pantryHaveNames(items: PantryItem[]): string[] {
  return items.filter((item) => item.level === 'have').map((item) => item.name)
}
