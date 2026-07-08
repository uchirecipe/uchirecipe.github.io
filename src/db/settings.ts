import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings, type Settings } from './types'

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
