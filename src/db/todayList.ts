import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { addCookedLog } from './recipes'
import { todayString } from '../logic/date'

export async function listTodayList() {
  return db.todayList.orderBy('addedAt').toArray()
}

/** 「今日の献立」の一覧を取得するフック（変更されると自動で再描画） */
export function useTodayList() {
  return useLiveQuery(listTodayList, [])
}

/** レシピ詳細の「今日つくる」ボタンから追加（同じレシピは重複追加しない） */
export async function addToTodayList(recipeId: number): Promise<void> {
  const existing = await db.todayList.where('recipeId').equals(recipeId).first()
  if (existing) return
  await db.todayList.add({ recipeId, addedAt: Date.now() })
}

/** 「×」でいつでも外す */
export async function removeFromTodayList(recipeId: number): Promise<void> {
  await db.todayList.where('recipeId').equals(recipeId).delete()
}

/** 個別の「作った」: 今日の日付で記録し、今日の献立から外す */
export async function markTodayListCooked(recipeId: number): Promise<void> {
  await addCookedLog(recipeId, { date: todayString() })
  await removeFromTodayList(recipeId)
}

/** 「まとめて作った！」: 表示中の全レシピを今日の日付で記録し、リストを空にする */
export async function markAllTodayListCooked(recipeIds: number[]): Promise<void> {
  const date = todayString()
  for (const recipeId of recipeIds) {
    await addCookedLog(recipeId, { date })
  }
  await db.todayList.clear()
}

/** 今週の献立から、指定したレシピIDをまとめて取り込む（既に入っているものはスキップ） */
export async function importRecipeIdsToTodayList(recipeIds: number[]): Promise<void> {
  const existing = await listTodayList()
  const existingIds = new Set(existing.map((item) => item.recipeId))
  const toAdd = recipeIds.filter((id) => !existingIds.has(id))
  let addedAt = Date.now()
  for (const recipeId of toAdd) {
    await db.todayList.add({ recipeId, addedAt: addedAt++ })
  }
}
