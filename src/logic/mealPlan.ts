import { hasNgIngredient } from './ng'
import { cookedWithinDays } from './cooked'
import type { MealSlot, Recipe } from '../db/types'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 引数の日付を含む週（月曜始まり・7日分）をYYYY-MM-DDの配列で返す */
export function weekDates(reference: Date): string[] {
  const day = reference.getDay() // 0=日 1=月 ... 6=土
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(reference)
  monday.setDate(reference.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateString(d)
  })
}

/** YYYY-MM-DD を weeks 週分だけ前後にずらす */
export function shiftWeek(dateStr: string, weeks: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + weeks * 7)
  return toDateString(d)
}

export interface SuggestOptions {
  quickOnly: boolean
  excludeNg: boolean
  ngIngredients: string[]
  /** この週で既に使っているレシピID（同じ主菜が続かないように避けたい） */
  usedRecipeIds: number[]
  /** どの食事帯の枠か。朝から鍋が出る、のようなミスマッチを避けるために使う */
  slot: MealSlot
}

/**
 * 空き枠の自動提案。
 * 「NG除外」「時短」で絞り込んだ後、「向いている時間帯」が一致するものを優先し
 * （未設定のレシピは制限なしとして扱う）、その中で「最近作ってない」
 * 「週内で重複しない」の順にも絞り込む。候補が無くなったら段階的に
 * 条件を緩めて必ず何か返す（0件にはしない）。
 */
export function suggestForSlot(recipes: Recipe[], options: SuggestOptions): Recipe | undefined {
  const base = recipes.filter((r) => {
    if (options.excludeNg && hasNgIngredient(r, options.ngIngredients)) return false
    if (options.quickOnly && !(r.cookMinutes != null && r.cookMinutes > 0 && r.cookMinutes <= 15))
      return false
    return true
  })
  if (base.length === 0) return undefined

  // 時間帯が一致する(または未設定の)レシピを優先。無ければ全体まで含める
  const slotMatched = base.filter(
    (r) => !r.suitableFor || r.suitableFor.length === 0 || r.suitableFor.includes(options.slot),
  )
  const slotPool = slotMatched.length > 0 ? slotMatched : base

  const notUsedThisWeek = slotPool.filter((r) => !options.usedRecipeIds.includes(r.id!))
  const freshAndUnused = notUsedThisWeek.filter((r) => !cookedWithinDays(r, 14))

  const pool =
    freshAndUnused.length > 0 ? freshAndUnused : notUsedThisWeek.length > 0 ? notUsedThisWeek : slotPool
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * 「今日の献立」（todayList）と週間プランの今日の枠が食い違っているレシピIDを返す。
 * 週プランの今日の枠が1件も無いとき（＝週プランを使っていない）は食い違い扱いにしない
 * （毎回警告が出て煩わしくなるのを防ぐため）。同期はしない設計を維持し、
 * この結果はあくまで「気づかせる」表示にのみ使う。
 */
export function todayPlanMismatch(todayListIds: number[], todayPlanRecipeIds: number[]): number[] {
  if (todayPlanRecipeIds.length === 0) return []
  return todayListIds.filter((id) => !todayPlanRecipeIds.includes(id))
}
