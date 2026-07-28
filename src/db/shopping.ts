import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { markPantryHaveOrCreate } from './pantry'
import { toPantryKey } from '../logic/kana'
import { combineAmountTexts } from '../logic/shopping'
import type { ShoppingItem } from './types'

export async function listShoppingItems(): Promise<ShoppingItem[]> {
  return db.shoppingItems.orderBy('order').toArray()
}

/** 買い物メモの一覧を取得するフック（変更されると自動で再描画） */
export function useShoppingItems() {
  return useLiveQuery(listShoppingItems, [])
}

async function nextOrder(): Promise<number> {
  const last = await db.shoppingItems.orderBy('order').last()
  return (last?.order ?? 0) + 1
}

/**
 * 追加しようとしている食材が、買い物メモに既にあれば分量を合算して1行にまとめる
 * （2026-07-29 便CC/C14）。下書きの中では同名の材料をまとめるのに、買い物メモに入れた
 * 後は同じ食材を足しても別行で並ぶだけで、売り場順に並べ替えると離れた位置に重複が出ていた
 * （実測: 同じレシピを2回確定すると全材料が2行ずつ）。
 *
 * まとめるのは**まだチェックしていない行だけ**にする。チェック済み＝もうカゴに入れた行に
 * 後から足すと、増えた分が買ったことになって見えなくなるため（その場合は新しい行を足す）。
 * 名前の照合は在庫と同じ toPantryKey の完全一致。
 *
 * 返り値は追加ではなく合算にまとめた場合に true。
 */
async function mergeIntoExisting(
  name: string,
  amount: string | undefined,
  recipeIds?: number[],
): Promise<boolean> {
  const key = toPantryKey(name)
  if (!key) return false
  const all = await db.shoppingItems.toArray()
  const target = all.find((item) => !item.isChecked && toPantryKey(item.name) === key)
  if (!target?.id) return false
  const mergedRecipeIds = [...new Set([...(target.fromRecipeIds ?? []), ...(recipeIds ?? [])])]
  await db.shoppingItems.update(target.id, {
    amount: combineAmountTexts([target.amount, amount]) || undefined,
    fromRecipeIds: mergedRecipeIds.length > 0 ? mergedRecipeIds : undefined,
  })
  return true
}

/** 手動で1件追加する（同じ食材が未チェックで残っていれば分量を合算する） */
export async function addShoppingItem(name: string, amount?: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  await db.transaction('rw', db.shoppingItems, async () => {
    if (await mergeIntoExisting(trimmed, amount?.trim() || undefined)) return
    const order = await nextOrder()
    await db.shoppingItems.add({
      name: trimmed,
      amount: amount?.trim() || undefined,
      isChecked: false,
      order,
    })
  })
}

/** レシピから作った候補のうち、確定された項目をまとめて買い物メモに追加する */
export async function addConfirmedItems(
  items: { name: string; amount: string; recipeIds: number[] }[],
): Promise<void> {
  if (items.length === 0) return
  await db.transaction('rw', db.shoppingItems, async () => {
    let order = await nextOrder()
    for (const item of items) {
      // 既にメモにある食材は分量を合算して1行にまとめる(C14)
      if (await mergeIntoExisting(item.name, item.amount || undefined, item.recipeIds)) continue
      await db.shoppingItems.add({
        name: item.name,
        amount: item.amount || undefined,
        isChecked: false,
        order: order++,
        fromRecipeIds: item.recipeIds,
      })
    }
  })
}

/** チェックのオン・オフ（買い物中の消し込み） */
export async function toggleShoppingChecked(id: number): Promise<void> {
  const item = await db.shoppingItems.get(id)
  if (!item) return
  await db.shoppingItems.update(id, { isChecked: !item.isChecked })
}

/**
 * 買い物メモの全項目をまとめてチェック/解除する（2026-07-23 オーナー実機FB #6「まとめてチェック」）。
 * 1トランザクションで一括更新する。
 */
export async function setAllShoppingChecked(checked: boolean): Promise<void> {
  await db.transaction('rw', db.shoppingItems, async () => {
    await db.shoppingItems.toCollection().modify({ isChecked: checked })
  })
}

export async function removeShoppingItem(id: number): Promise<void> {
  await db.shoppingItems.delete(id)
}

/**
 * 買い物完了: チェック済みの項目を削除する。
 * reflectToPantry が true なら、チェックした食材を在庫「ある」に反映する
 * （2026-07-23 #8: 在庫ボードに未登録の食材は新しくチップを作って反映する）。
 */
export async function completeShopping(
  checkedItems: ShoppingItem[],
  reflectToPantry: boolean,
): Promise<void> {
  if (checkedItems.length === 0) return
  if (reflectToPantry) {
    for (const item of checkedItems) {
      await markPantryHaveOrCreate(item.name)
    }
  }
  await db.shoppingItems.bulkDelete(checkedItems.map((i) => i.id!))
}
