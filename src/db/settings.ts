import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings, type Settings } from './types'

/** 設定を取得（未保存なら初期値を返す） */
export async function getSettings(): Promise<Settings> {
  return (await db.settings.get(1)) ?? defaultSettings
}

/** 設定の一部だけを更新する（例: updateSettings({ theme: 'dark' })） */
export async function updateSettings(
  patch: Partial<Omit<Settings, 'id'>>,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? defaultSettings
    await db.settings.put({ ...current, ...patch, id: 1 })
  })
}

/** 設定を画面で使うためのフック（変更されると自動で再描画） */
export function useSettings(): Settings | undefined {
  return useLiveQuery(getSettings, [])
}
