import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { MealPlanEntry, MealRole, MealSlot } from './types'

export async function listMealPlanRange(startDate: string, endDate: string) {
  return db.mealPlans.where('date').between(startDate, endDate, true, true).toArray()
}

/** 指定期間の献立を取得するフック（変更されると自動で再描画） */
export function useMealPlanRange(startDate: string, endDate: string) {
  return useLiveQuery(() => listMealPlanRange(startDate, endDate), [startDate, endDate])
}

/**
 * 指定の日・枠・役割（主菜/副菜）に新しいレシピの割り当てを1件追加する。
 * 同じ日×枠に複数件（主菜+副菜、または同じ役割を複数）を追加できる
 * （2026-07-13 献立の主菜+副菜構成対応。以前は1枠=1件だったが、mealPlansの
 * [date+slot]索引はもともとunique指定ではなかったため、スキーマ変更なしで
 * 複数件を保存できる）
 */
export async function addMealEntry(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
): Promise<void> {
  await db.mealPlans.add({ date, slot, recipeId, role })
}

/** 既存エントリのレシピだけを差し替える（役割・日付・枠は変えない） */
export async function updateMealEntryRecipe(entryId: number, recipeId: number): Promise<void> {
  await db.mealPlans.update(entryId, { recipeId })
}

/** 指定エントリを削除する（その行だけを外す） */
export async function removeMealEntry(entryId: number): Promise<void> {
  await db.mealPlans.delete(entryId)
}

/**
 * その日・枠の「主菜」を設定する（無ければ追加、あれば差し替え）。役割未設定の
 * 既存データも主菜として扱う（後方互換）。「今日の献立」との食い違い解消チップなど、
 * 役割を意識せず「この枠にこのレシピ」を素早く設定したい場面向けの簡易ヘルパー
 */
export async function setMainMeal(date: string, slot: MealSlot, recipeId: number): Promise<void> {
  await db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    const existingMain = sameSlot.find((e) => (e.role ?? 'main') === 'main')
    if (existingMain) {
      await db.mealPlans.update(existingMain.id!, { recipeId })
    } else {
      await db.mealPlans.add({ date, slot, recipeId, role: 'main' })
    }
  })
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealPlanEntry }
