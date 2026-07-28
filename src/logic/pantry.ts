import { toPantryKey } from './kana'
import { matchNutritionFood } from './nutrition'
import { categorizePantryName, matchesGenericPantryChip, resolvePantryGroup } from './pantryGroups'
import type { PantryItem, PantryLevel } from '../db/types'

/**
 * 「今あるもので作れる」検索に使う、在庫のある食材名の一覧。
 * 「ある」「少ない」を在庫ありとみなし、「ない」は含めない。
 */
export function pantryAvailableNames(items: PantryItem[]): string[] {
  return items.filter((item) => item.level !== 'none').map((item) => item.name)
}

/**
 * 在庫チップ名の一覧に対して「この材料は在庫にあるか」を返す判定器を作る
 * （2026-07-29 便CC/C4。名寄せ規則の一本化）。
 *
 * これまで経路ごとに規則が違い（買い物候補の除外＝かな完全一致／「作った！」の降下＝かな部分
 * 一致／在庫で絞り込み・在庫一致順＝かな部分一致）、同じ食材で「減る/減らない」「候補に出る/
 * 出ない」が食い違っていた。判定はこの1か所に集約し、全経路が同じ答えを返すようにする。
 * 成立条件は selectPantryDowngrades と同じ3つ（キー完全一致／栄養DBで同じ食品／総称チップ）。
 */
export function makePantryMatcher(pantryNames: string[]): (ingredientName: string) => boolean {
  const chips = pantryNames
    .map((name) => ({ key: toPantryKey(name), food: matchNutritionFood(name) }))
    .filter((chip) => chip.key)
  if (chips.length === 0) return () => false
  const keys = new Set(chips.map((chip) => chip.key))
  return (ingredientName: string): boolean => {
    const key = toPantryKey(ingredientName)
    if (!key) return false
    if (keys.has(key)) return true
    const food = matchNutritionFood(ingredientName)
    return chips.some(
      (chip) =>
        (chip.food != null && food === chip.food) || matchesGenericPantryChip(chip.key, ingredientName),
    )
  }
}

/** 在庫を1段階だけ下げる: ある→少ない→ない（ないは据え置き） */
const PANTRY_LEVEL_DOWN: Record<PantryLevel, PantryLevel> = {
  have: 'low',
  low: 'none',
  none: 'none',
}

/**
 * 「作った！」の在庫反映（2026-07-23 オーナー実機FB #11）で、1段階下げる対象を選ぶ純ロジック。
 * - レシピで使った食材だけが対象
 * - 調味料グループ（logic/pantryGroups）は対象外（毎回減らすと実態と合わないため）
 * - すでに「ない」の食材は据え置き（それ以上は下げない）
 * - 在庫チップに無い食材は勝手に作らない（反映は登録済みチップの範囲だけ）
 * 返すのは実際に変化する分だけ（id と下げた後のlevel）。
 *
 * 2026-07-29 便CC/C3・C4: 「同じ食材か」の判定を作り直した（QA S2）。
 * 旧: かな化した材料名が在庫チップ名を**含む**部分一致。これが誤爆と不発を同時に起こしていた
 * （'たまねぎ'.includes('ねぎ')=true で無関係の「ねぎ」が減り、逆に
 *  'ぶたこまぎれにく'.includes('ぶたにく')=false でプリセットの「豚肉」は一生減らない）。
 * 新: ①toPantryKey の完全一致（買い物候補の除外・買い物完了の在庫反映と同じキー）
 *     ②栄養DBで同じ食品に名寄せできる（表記ゆれの吸収）
 *     ③在庫チップが総称語（豚肉・鶏肉…）で、材料が肉・魚介の部位名（matchesGenericPantryChip）
 * のいずれかが成り立つときだけ対象にする。
 */
export function selectPantryDowngrades(
  items: PantryItem[],
  ingredientNames: string[],
): { id: number; level: PantryLevel }[] {
  const ingredients = ingredientNames
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({
      name,
      key: toPantryKey(name),
      food: matchNutritionFood(name),
      // 総称チップの救済で「鶏がらスープの素」のような調味料を巻き込まないための歯止め
      isSeasoning: categorizePantryName(name) === 'seasoning',
    }))
    .filter((ing) => ing.key)
  if (ingredients.length === 0) return []

  const result: { id: number; level: PantryLevel }[] = []
  for (const item of items) {
    if (item.id === undefined || item.level === 'none') continue
    if (resolvePantryGroup(item) === 'seasoning') continue
    const key = toPantryKey(item.name)
    if (!key) continue
    const chipFood = matchNutritionFood(item.name)
    const used = ingredients.some(
      (ing) =>
        ing.key === key ||
        (chipFood != null && ing.food === chipFood) ||
        (!ing.isSeasoning && matchesGenericPantryChip(key, ing.name)),
    )
    if (!used) continue
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
