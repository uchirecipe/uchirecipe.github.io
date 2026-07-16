import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { toHiragana } from '../logic/kana'
import { defaultSettings } from './types'
import type { PantryItem, PantryLevel } from './types'

/** タップのたびに ある→少ない→ない→ある… と3段階を巡回する */
const nextLevel: Record<PantryLevel, PantryLevel> = {
  have: 'low',
  low: 'none',
  none: 'have',
}

/** 初回に用意しておく「よく使う食材」プリセット（一般的な家庭の常備品） */
const PANTRY_PRESET_NAMES = [
  '卵', '玉ねぎ', 'にんじん', 'じゃがいも', 'キャベツ',
  '豚肉', '鶏肉', '牛乳', 'しょうゆ', 'みそ', '米', '豆腐',
]

/**
 * 初回起動時だけ、「よく使う食材」プリセットを在庫ボードに用意する
 * （すべて「ない」状態。ユーザーがタップして自分の状況に合わせる前提）。
 * 既にプリセット投入済み、または在庫ボードに何か登録済みなら何もしない。
 */
export async function seedPantryPresetIfNeeded(): Promise<void> {
  await db.transaction('rw', db.pantryItems, db.settings, async () => {
    const settings = { ...defaultSettings, ...(await db.settings.get(1)) }
    if (settings.pantryPresetSeeded) return
    const existingCount = await db.pantryItems.count()
    if (existingCount === 0) {
      await db.pantryItems.bulkAdd(
        PANTRY_PRESET_NAMES.map((name, index) => ({
          name,
          level: 'none' as const,
          isFrequent: true,
          sortOrder: index,
        })),
      )
    }
    await db.settings.put({ ...settings, pantryPresetSeeded: true, id: 1 })
  })
}

/**
 * sortOrder（手動並び替え）があればそれで、無ければid（＝登録順）で並べる。
 * こうすることで、並び替えたことがない人は自然に「登録順」表示になる。
 */
export async function listPantryItems(): Promise<PantryItem[]> {
  const items = await db.pantryItems.toArray()
  return items.sort((a, b) => (a.sortOrder ?? a.id ?? 0) - (b.sortOrder ?? b.id ?? 0))
}

/** 在庫ボードの一覧を取得するフック（変更されると自動で再描画） */
export function usePantryItems() {
  return useLiveQuery(listPantryItems, [])
}

/** 「よく使う食材」として登録する。既にあれば新規追加せず isFrequent を立てるだけ */
export async function addFrequentIngredient(name: string): Promise<void> {
  const trimmed = name.trim()
  if (!trimmed) return
  const existing = await db.pantryItems.where('name').equalsIgnoreCase(trimmed).first()
  if (existing) {
    if (!existing.isFrequent) await db.pantryItems.update(existing.id!, { isFrequent: true })
    return
  }
  // 新規追加時は「ある」から開始する。よく使う食材として登録するのは
  // 大抵「今まさに家にある」場面が多く、「ない」始まりだと実態と逆になりがちだった
  await db.pantryItems.add({ name: trimmed, level: 'have', isFrequent: true })
}

/** タップで3段階を切り替える */
export async function cyclePantryLevel(id: number): Promise<void> {
  const item = await db.pantryItems.get(id)
  if (!item) return
  await db.pantryItems.update(id, { level: nextLevel[item.level] })
}

/** 在庫ボードから食材を外す */
export async function removePantryItem(id: number): Promise<void> {
  await db.pantryItems.delete(id)
}

/** 在庫ボードから複数の食材をまとめて外す(整理モードの一括削除から呼ぶ) */
export async function removePantryItems(ids: number[]): Promise<void> {
  await db.pantryItems.bulkDelete(ids)
}

/** 隣の食材と順序を入れ替える（並び替えモードの矢印ボタンから呼ぶ） */
export async function movePantryItem(
  items: PantryItem[],
  index: number,
  direction: -1 | 1,
): Promise<void> {
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= items.length) return
  const a = items[index]
  const b = items[targetIndex]
  const aOrder = a.sortOrder ?? a.id!
  const bOrder = b.sortOrder ?? b.id!
  await db.transaction('rw', db.pantryItems, async () => {
    await db.pantryItems.update(a.id!, { sortOrder: bOrder })
    await db.pantryItems.update(b.id!, { sortOrder: aOrder })
  })
}

/**
 * 買い物完了時に使う: その食材が在庫ボードに登録済みなら「ある」にする。
 * 登録されていない食材は勝手に追加しない（在庫ボードは自分で選んだものだけに保つ）。
 */
export async function markPantryHaveIfTracked(name: string): Promise<void> {
  const key = toHiragana(name.trim())
  if (!key) return
  const all = await db.pantryItems.toArray()
  const match = all.find((item) => toHiragana(item.name) === key)
  if (match) await db.pantryItems.update(match.id!, { level: 'have' })
}
