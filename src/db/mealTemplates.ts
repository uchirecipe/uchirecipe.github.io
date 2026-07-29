import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { MealTemplate, MealTemplateItem } from './types'

/**
 * マイ献立テンプレ（2026-07-29 便CB-2・docs/59 A-1＋B-2）の読み書き。
 * 中身の作り方・流し込み方の判断は純ロジック（logic/mealTemplate.ts）が持ち、
 * ここはDexieへの保存・取得・削除だけを担う。
 */

/** 保存済みテンプレの一覧（保存が古い順）。変更されると自動で再描画される */
export function useMealTemplates() {
  return useLiveQuery(() => db.mealTemplates.orderBy('createdAt').toArray(), [])
}

/** テンプレを新しく保存する（同じ名前でも別のテンプレとして増やせる＝複数保存可） */
export async function saveMealTemplate(name: string, items: MealTemplateItem[]): Promise<number> {
  return db.mealTemplates.add({ name, items, createdAt: Date.now() })
}

/** テンプレを削除する（すでに献立へ流し込んだ分は消えない＝雛形だけを消す） */
export async function deleteMealTemplate(id: number): Promise<void> {
  await db.mealTemplates.delete(id)
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealTemplate, MealTemplateItem }
