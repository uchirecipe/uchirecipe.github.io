import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { DayNote } from './types'

/**
 * 日付メモ（2026-07-29 便CB-1・docs/59 A-2）の読み書き。
 * レシピに紐付かない「その日1行の自由メモ」（外食・実家・お弁当いる など）を、
 * 日付を主キーにした専用テーブルで持つ（設計理由は db/types.ts の DayNote 参照）。
 */

/** 期間内（開始日〜終了日、両端含む）の日付メモを取得する */
export async function listDayNoteRange(startDate: string, endDate: string): Promise<DayNote[]> {
  return db.dayNotes.where('date').between(startDate, endDate, true, true).toArray()
}

/** 期間内の日付メモを取得するフック（変更されると自動で再描画） */
export function useDayNoteRange(startDate: string, endDate: string) {
  return useLiveQuery(() => listDayNoteRange(startDate, endDate), [startDate, endDate])
}

/**
 * 日付メモを保存する。前後の空白を落として空になったらその日の行ごと削除する
 * （空のメモを残さない＝月セルの「メモあり」マークが空メモで点かないようにするため）。
 * 戻り値は呼び出し側の案内トーストの出し分け用。
 */
export async function saveDayNote(date: string, text: string): Promise<'saved' | 'removed'> {
  const trimmed = text.trim()
  if (trimmed === '') {
    await db.dayNotes.delete(date)
    return 'removed'
  }
  await db.dayNotes.put({ date, text: trimmed, updatedAt: Date.now() })
  return 'saved'
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { DayNote }
