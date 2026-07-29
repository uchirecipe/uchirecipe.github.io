import { dowIndex, isPastDate, MEAL_SLOTS } from './mealPlan'
import { ja } from '../i18n/ja'
import type { MealPlanEntry, MealRole, MealSlot } from '../db/types'

/**
 * 献立表（2026-07-29 便CB-2・docs/59 A-4）の組み立て。
 * 週または月の献立を「1枚に整形」した中身を作る純ロジックで、
 *  ・画面と印刷（@media print で出すHTML）
 *  ・画像保存（logic/planSheetImage.ts のCanvas描画）
 * の両方が同じこの結果を見る＝紙と画像で内容がずれないようにするのがこのモジュールの役割。
 *
 * 何を載せるかの規則は、アプリの他の画面とそろえる（過ぎた日は「作った記録」・今日から先は
 * 「登録した献立」）。過ぎた日の未達成の予定を紙に出さないのは、週タブ・月タブと同じ扱い
 * （便BS・タスク2）で、印刷物だけ違う顔になるのを避けるため。日付メモ（A-2）も一緒に載せる。
 */

/** 献立表の1品（主菜/副菜と料理名） */
export interface PlanSheetDish {
  role: MealRole
  title: string
}

/** 献立表の1日×1つの食事（例: 夕食 主菜 肉じゃが／副菜 きんぴら） */
export interface PlanSheetSlotRow {
  slot: MealSlot
  /** 「夕食」等の表示名 */
  label: string
  dishes: PlanSheetDish[]
}

/** 献立表の1日分 */
export interface PlanSheetDay {
  /** YYYY-MM-DD */
  date: string
  /** 「7/29（水）」 */
  label: string
  isPast: boolean
  /** 今日以降の日の「登録した献立」（品が1つも無い食事は行ごと出さない） */
  slots: PlanSheetSlotRow[]
  /** 過ぎた日の「作った記録」の料理名 */
  cookedTitles: string[]
  /** 日付メモ（A-2）。無ければundefined */
  note?: string
}

/** 献立表1枚分 */
export interface PlanSheet {
  /** 「7/27〜8/2の献立」「2026年8月の献立」等（呼び出し側が渡す） */
  title: string
  days: PlanSheetDay[]
  /** 献立も記録もメモも1件も無い（＝白紙になる）か。呼び出し側はこのとき案内を出す */
  isEmpty: boolean
}

/** 献立表に載せる1日分を組み立てる（日付順は渡された dates のまま） */
export function buildPlanSheet(options: {
  title: string
  /** 対象の日付（週＝7日・月＝その月の全日） */
  dates: string[]
  /** YYYY-MM-DD（今日） */
  today: string
  /** 表示中の食事（画面に出している食事だけを紙にも出す＝画面と同じ内容にする） */
  visibleSlots: MealSlot[]
  entries: Pick<MealPlanEntry, 'date' | 'slot' | 'role' | 'recipeId'>[]
  /**
   * レシピID→料理名（見つからない＝レシピを消した等の孤児行は載せない）。
   * 2026-07-30 便CH/C7: 呼び出し側は全レシピから引くようになった。以前は設定
   * 「基本レシピを一覧に表示しない」を反映した表を渡していたため、設定をONにすると
   * 献立表から今日以降の行だけが丸ごと消えていた（記録の行は残るので紙の中で扱いが食い違う）。
   */
  titleOf: (recipeId: number) => string | undefined
  /** 日付→日付メモの本文 */
  notes: Map<string, string>
  /** 日付→その日の「作った記録」の料理名 */
  cookedTitlesByDate: Map<string, string[]>
}): PlanSheet {
  const { title, dates, today, visibleSlots, entries, titleOf, notes, cookedTitlesByDate } = options
  const byDateSlot = new Map<string, Pick<MealPlanEntry, 'date' | 'slot' | 'role' | 'recipeId'>[]>()
  for (const e of entries) {
    const key = `${e.date}|${e.slot}`
    const list = byDateSlot.get(key)
    if (list) list.push(e)
    else byDateSlot.set(key, [e])
  }
  const roleRank = (role: MealRole) => (role === 'main' ? 0 : 1)
  const slotOrder = MEAL_SLOTS.filter((s) => visibleSlots.includes(s))

  const days: PlanSheetDay[] = dates.map((date) => {
    const isPast = isPastDate(date, today)
    const slots: PlanSheetSlotRow[] = []
    if (!isPast) {
      for (const slot of slotOrder) {
        const dishes = (byDateSlot.get(`${date}|${slot}`) ?? [])
          .map((e) => ({ role: (e.role ?? 'main') as MealRole, title: titleOf(e.recipeId) }))
          .filter((d): d is PlanSheetDish => d.title !== undefined)
          .sort((a, b) => roleRank(a.role) - roleRank(b.role))
        if (dishes.length > 0) slots.push({ slot, label: ja.mealPlan.slot[slot], dishes })
      }
    }
    return {
      date,
      label: formatSheetDayLabel(date),
      isPast,
      slots,
      cookedTitles: isPast ? (cookedTitlesByDate.get(date) ?? []) : [],
      note: notes.get(date),
    }
  })

  const isEmpty = days.every(
    (d) => d.slots.length === 0 && d.cookedTitles.length === 0 && !d.note,
  )
  return { title, days, isEmpty }
}

/** YYYY-MM-DD を「7/29（水）」の形にする（献立表の日付見出し） */
export function formatSheetDayLabel(date: string): string {
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  return `${month}/${day}（${ja.mealPlan.dow[dowIndex(date)]}）`
}

/** 献立表を1行ずつの文字列にしたもの（画像化のCanvas描画がそのまま上から並べるための形） */
export interface PlanSheetLine {
  /** 'day'=日付見出し / 'dish'=その日の中身 / 'note'=日付メモ・記録の但し書き */
  kind: 'day' | 'dish' | 'note'
  text: string
}

/**
 * 献立表を行の配列に平らにする（画像化＝logic/planSheetImage.ts 用。純ロジックなのでテストできる）。
 * 画面・印刷のHTMLと同じ内容・同じ並びになるよう、buildPlanSheetの結果だけを見て組み立てる。
 * 献立も記録もメモも無い日は日付だけの行を出す（1週間・1か月の抜けが紙の上で分かるように）。
 */
export function planSheetLines(sheet: PlanSheet): PlanSheetLine[] {
  const lines: PlanSheetLine[] = []
  for (const day of sheet.days) {
    lines.push({ kind: 'day', text: day.label })
    for (const slotRow of day.slots) {
      const dishes = slotRow.dishes
        .map((d) => `${ja.mealPlan.role[d.role]} ${d.title}`)
        .join('　')
      lines.push({ kind: 'dish', text: `${slotRow.label}　${dishes}` })
    }
    if (day.cookedTitles.length > 0) {
      lines.push({
        kind: 'dish',
        text: `${ja.mealPlan.pastCookedTitle}　${day.cookedTitles.join('　')}`,
      })
    }
    if (day.note) lines.push({ kind: 'note', text: `${ja.mealPlan.dayNoteLabel}　${day.note}` })
  }
  return lines
}
