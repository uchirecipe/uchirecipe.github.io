import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { toHiragana } from '../logic/kana'
import { selectPantryDowngrades } from '../logic/pantry'
import { defaultSettings } from './types'
import type { Ingredient, PantryGroupKey, PantryItem, PantryLevel } from './types'

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

/**
 * 整理モードで選択した複数の食材をまとめて指定の状態(ある/少ない/ない)にする
 * (docs/35 §5 在庫チップ=案D「整理モードにまとめて状態設定」)。1トランザクションで実行する。
 */
export async function setPantryItemsLevel(ids: number[], level: PantryLevel): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.pantryItems, async () => {
    await db.pantryItems.where('id').anyOf(ids).modify({ level })
  })
}

/**
 * 整理モードで選択した複数の食材をまとめて指定の大分類グループに移す（2026-07-23 #1）。
 * 手動指定（group）を書き込むので、以降その食材は自動振り分けより手動指定が優先される。
 */
export async function setPantryItemsGroup(ids: number[], group: PantryGroupKey): Promise<void> {
  if (ids.length === 0) return
  await db.transaction('rw', db.pantryItems, async () => {
    await db.pantryItems.where('id').anyOf(ids).modify({ group })
  })
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
 * 買い物完了時に使う: その食材を「ある」にする。在庫ボードに未登録なら新しくチップを作って反映する
 * （2026-07-23 オーナー実機FB #8: 未作成だと無反応＝実質バグだった。反映するなら作って反映する）。
 * 同名（表記ゆれ含む）が既にあれば新規作成せず「ある」に更新するだけ。1件ずつトランザクションで安全に。
 */
export async function markPantryHaveOrCreate(name: string): Promise<void> {
  const trimmed = name.trim()
  const key = toHiragana(trimmed)
  if (!key) return
  await db.transaction('rw', db.pantryItems, async () => {
    const all = await db.pantryItems.toArray()
    const match = all.find((item) => toHiragana(item.name) === key)
    if (match) {
      await db.pantryItems.update(match.id!, { level: 'have' })
      return
    }
    const maxOrder = all.reduce((max, item) => Math.max(max, item.sortOrder ?? item.id ?? 0), 0)
    await db.pantryItems.add({
      name: trimmed,
      level: 'have',
      isFrequent: true,
      sortOrder: maxOrder + 1,
    })
  })
}

/**
 * 「作った！」の在庫反映（2026-07-23 オーナー実機FB #11）: レシピで使った食材の在庫を
 * 1段階だけ下げる（ある→少ない→ない）。調味料系は対象外・登録済みチップの範囲だけ・
 * すでに「ない」は据え置き（判定は logic/pantry.ts selectPantryDowngrades）。
 */
export async function lowerPantryLevelsForCooked(ingredients: Ingredient[]): Promise<void> {
  const ingredientNames = ingredients.map((ing) => ing.name)
  await db.transaction('rw', db.pantryItems, async () => {
    const all = await db.pantryItems.toArray()
    const downgrades = selectPantryDowngrades(all, ingredientNames)
    for (const { id, level } of downgrades) {
      await db.pantryItems.update(id, { level })
    }
  })
}
