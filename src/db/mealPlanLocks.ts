import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { mealLockKey } from '../logic/mealPlan'
import type { MealPlanLock, MealSlot } from './types'

/**
 * 献立のロック（2026-08-08 便DX・オーナー指示）の読み書き。
 * 「その日のその食事は自動の一括操作で触らない」という印だけを持つテーブルで、
 * 何を守るのか・日ごとと時間帯ごとの関係は db/types.ts の MealPlanLock と
 * logic/mealPlan.ts のロック節に書いてある。ここはDexieへの保存・取得だけを担う。
 */

/** 掛かっている鍵の全件。週・月・日の窓のどこから見ても同じ鍵を見るために期間で切らない */
export function useMealPlanLocks() {
  return useLiveQuery(() => db.mealPlanLocks.toArray(), [])
}

/** 鍵の掛かっている食事のキー（'YYYY-MM-DD|slot'）の集合。画面はこの形で持ち回る */
export function toLockKeySet(locks: MealPlanLock[] | undefined): Set<string> {
  return new Set((locks ?? []).map((l) => l.key))
}

/**
 * 鍵を掛ける・外すをまとめて書く（logic/mealPlan.ts の plan*LockToggle が作った計画をそのまま渡す）。
 * 掛けるほうを put にしてあるので、同じ食事に二重に掛けても行は増えない（主キーが 日付|食事）。
 * 1トランザクションにまとめ、日ごと・すべてロックのような複数件の掛け外しが途中で
 * 中断されて半端な状態にならないようにする。
 */
export async function applyMealLockToggle(toggle: {
  lock: { date: string; slot: MealSlot }[]
  unlock: { date: string; slot: MealSlot }[]
}): Promise<void> {
  if (toggle.lock.length === 0 && toggle.unlock.length === 0) return
  const lockedAt = Date.now()
  const rows: MealPlanLock[] = toggle.lock.map(({ date, slot }) => ({
    key: mealLockKey(date, slot),
    date,
    slot,
    lockedAt,
  }))
  const keysToRemove = toggle.unlock.map(({ date, slot }) => mealLockKey(date, slot))
  await db.transaction('rw', db.mealPlanLocks, async () => {
    if (rows.length > 0) await db.mealPlanLocks.bulkPut(rows)
    if (keysToRemove.length > 0) await db.mealPlanLocks.bulkDelete(keysToRemove)
  })
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealPlanLock }
