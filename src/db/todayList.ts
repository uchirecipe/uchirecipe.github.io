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

/**
 * レシピ詳細の「今日の献立に追加」ボタン（旧文言「今日つくる」）から追加（同じレシピは重複追加しない）。
 * 重複チェック(get)と追加(add)を1トランザクションにして原子化する（データ堅牢性強化・2026-07-13。
 * 同時タップ等でチェックと追加の間に別の追加が割り込み、重複登録されることを防ぐ）
 */
export async function addToTodayList(recipeId: number): Promise<void> {
  await db.transaction('rw', db.todayList, async () => {
    const existing = await db.todayList.where('recipeId').equals(recipeId).first()
    if (existing) return
    await db.todayList.add({ recipeId, addedAt: Date.now() })
  })
}

/** 「×」でいつでも外す */
export async function removeFromTodayList(recipeId: number): Promise<void> {
  await db.todayList.where('recipeId').equals(recipeId).delete()
}

/**
 * 個別の「作った」: 今日の日付で記録し、今日の献立から外す。
 * addCookedLog(recipes.ts)とremoveFromTodayListをrecipes+todayListを跨ぐ1トランザクションに
 * まとめて原子化する（データ堅牢性強化・2026-07-13）。addCookedLogは内部で
 * db.transaction('rw', db.recipes, ...)を開くが、Dexieのトランザクションは対象テーブルが
 * 外側の集合の部分集合なら外側を再利用する(reentrant)ため、この呼び出しも含めて単一の
 * 物理トランザクションになる。addCookedLogの他の呼び出し元(markAllTodayListCooked等)は
 * 従来どおり単独のトランザクションのまま動作し、挙動は変わらない
 */
export async function markTodayListCooked(recipeId: number): Promise<void> {
  await db.transaction('rw', db.recipes, db.todayList, async () => {
    await addCookedLog(recipeId, { date: todayString() })
    await removeFromTodayList(recipeId)
  })
}

/**
 * 「まとめて作った！」: 表示中の全レシピを今日の日付で記録し、リストを空にする。
 * 記録(addCookedLog)とクリア(todayList.clear)をrecipes+todayListを跨ぐ1トランザクションに
 * まとめて原子化する（2026-07バグ修正。従来は記録ループとclearが別トランザクションで、
 * 途中で失敗すると「一部だけ記録されてリストは残る/消える」不整合が起き得た）。
 * addCookedLogは内部でdb.transaction('rw', db.recipes, ...)を開くが、Dexieのトランザクションは
 * 対象テーブルが外側の集合の部分集合なら外側を再利用する(reentrant)ため、単一の物理
 * トランザクションになる(markTodayListCookedと同じ方式)
 */
export async function markAllTodayListCooked(recipeIds: number[]): Promise<void> {
  const date = todayString()
  await db.transaction('rw', db.recipes, db.todayList, async () => {
    for (const recipeId of recipeIds) {
      await addCookedLog(recipeId, { date })
    }
    await db.todayList.clear()
  })
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
