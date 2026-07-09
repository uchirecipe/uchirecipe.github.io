import { hasNgIngredient } from './ng'
import { cookedWithinDays } from './cooked'
import { currentSeason } from './season'
import type { MealSlot, Recipe, Season } from '../db/types'

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

/** 引数の日付を含む月の全日付（1日〜月末）をYYYY-MM-DDの配列で返す */
export function monthDates(reference: Date): string[] {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => toDateString(new Date(year, month, i + 1)))
}

/** YYYY-MM-DD を months ヶ月分だけ前後にずらす（同じ日にちが無い月は月末に丸める） */
export function shiftMonth(dateStr: string, months: number): string {
  const original = new Date(`${dateStr}T00:00:00`)
  const day = original.getDate()
  const shifted = new Date(original.getFullYear(), original.getMonth() + months, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))
  return toDateString(shifted)
}

/** 引数の日付を含む月の1日が、月曜始まりのカレンダーで何列目か（先頭の空白セル数） */
export function monthLeadingBlanks(reference: Date): number {
  const firstDay = new Date(reference.getFullYear(), reference.getMonth(), 1).getDay() // 0=日 1=月...
  return firstDay === 0 ? 6 : firstDay - 1
}

export interface SuggestOptions {
  quickOnly: boolean
  excludeNg: boolean
  ngIngredients: string[]
  /** この週で既に使っているレシピID（同じ主菜が続かないように避けたい） */
  usedRecipeIds: number[]
  /** どの食事帯の枠か。朝から鍋が出る、のようなミスマッチを避けるために使う */
  slot: MealSlot
  /** 今の季節（省略時は現在日時から判定）。季節指定がall以外で一致しないレシピは提案しない */
  season?: Exclude<Season, 'all'>
}

/**
 * 夕食・昼食の枠で「単品の主菜」になりにくいタグ。
 * これらを含むレシピは夕食・昼食枠の提案では後回しにする
 * （8月の夕食にサラダ単品、のようなミスマッチを避ける。2026-07-09ペルソナ第2波）。
 */
const SIDE_DISH_TAGS = ['汁物', 'サラダ', 'おやつ']

/**
 * 空き枠の自動提案。
 * まず「季節が合わない（all以外で不一致）」のレシピを除外し、「NG除外」「時短」で
 * 絞り込んだ後、「向いている時間帯」が一致するものを優先（未設定のレシピは制限なし
 * として扱う）。夕食・昼食の枠では主菜になりうるレシピ（汁物/サラダ/おやつタグを
 * 含まない）を優先し、足りない場合のみ他を許可する。その中で「最近作ってない」
 * 「週内で重複しない」の順にも絞り込む。候補が無くなったら段階的に
 * 条件を緩めて必ず何か返す（季節外しか無い場合を除き0件にはしない）。
 */
export function suggestForSlot(recipes: Recipe[], options: SuggestOptions): Recipe | undefined {
  const season = options.season ?? currentSeason()
  const base = recipes.filter((r) => {
    // 季節外（例: 8月に冬タグのシチュー）は提案しない。通年・未設定は常に対象
    if (r.season && r.season !== 'all' && r.season !== season) return false
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

  // 夕食・昼食の枠は主菜になりうるレシピを優先し、無いときだけ汁物・サラダ等も許可
  let mainPool = slotPool
  if (options.slot === 'dinner' || options.slot === 'lunch') {
    const mains = slotPool.filter((r) => !r.tags.some((tag) => SIDE_DISH_TAGS.includes(tag)))
    if (mains.length > 0) mainPool = mains
  }

  const notUsedThisWeek = mainPool.filter((r) => !options.usedRecipeIds.includes(r.id!))
  const freshAndUnused = notUsedThisWeek.filter((r) => !cookedWithinDays(r, 14))

  const pool =
    freshAndUnused.length > 0 ? freshAndUnused : notUsedThisWeek.length > 0 ? notUsedThisWeek : mainPool
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
