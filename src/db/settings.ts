import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings, type MealSlot, type Settings } from './types'

/** 設定を取得（未保存の項目は初期値で補う） */
export async function getSettings(): Promise<Settings> {
  const stored = await db.settings.get(1)
  return { ...defaultSettings, ...stored }
}

/** 設定の一部だけを更新する（例: updateSettings({ theme: 'dark' })） */
export async function updateSettings(
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = { ...defaultSettings, ...(await db.settings.get(1)) }
    await db.settings.put({ ...current, ...patch, id: 1 })
  })
}

/** 設定を画面で使うためのフック（変更されると自動で再描画） */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, [])
}

/**
 * 初回起動日時を一度だけ記録する（起動時、基本レシピの投入より先に呼ぶこと）。
 * この項目が無い頃から使っている既存ユーザー（=基本レシピ投入済み）には 0 を入れて、
 * 「初日はお知らせを出さない」抑制の対象にしない。
 */
export async function recordFirstLaunchIfNeeded(): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = { ...defaultSettings, ...(await db.settings.get(1)) }
    if (current.firstLaunchAt !== undefined) return
    const firstLaunchAt = current.starterSeeded ? 0 : Date.now()
    await db.settings.put({ ...current, firstLaunchAt, id: 1 })
  })
}

/**
 * 献立タブに表示する食事帯（visibleMealSlots）の初期値を1回だけ決めて保存する
 * （2026-07-13 Fable設計・オーナー判断: 新規ユーザーは「夕食のみ」を既定にして
 * 朝昼夜すべて埋めなければというプレッシャーを減らす）。
 * ただし、既にmealPlanに朝食・昼食のエントリがある既存ユーザーは、この処理で
 * 急にそれらが見えなくなると困るため、従来どおり朝昼夜3枠を維持する。
 * 起動時に一度だけ呼ぶこと（visibleMealSlotsが未設定のときだけ処理し、以降は何もしない）
 */
export async function resolveVisibleMealSlotsIfNeeded(): Promise<void> {
  const stored = await db.settings.get(1)
  if (stored?.visibleMealSlots !== undefined) return
  // slotは単独の索引になっていない（[date+slot]の複合索引のみ）ため、where('slot')は
  // SchemaErrorになる。mealPlansは家庭の献立データで件数が少ない前提なので、
  // 全件取得してJS側でフィルタする
  const all = await db.mealPlans.toArray()
  const hasBreakfastOrLunch = all.some((e) => e.slot === 'breakfast' || e.slot === 'lunch')
  const visibleMealSlots: MealSlot[] = hasBreakfastOrLunch ? ['breakfast', 'lunch', 'dinner'] : ['dinner']
  await updateSettings({ visibleMealSlots })
}
