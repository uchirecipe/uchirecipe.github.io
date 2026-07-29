import { dowIndex, isPastDate, MEAL_SLOTS } from './mealPlan'
import type { MealPlanEntry, MealRole, MealSlot, MealTemplateItem } from '../db/types'

/**
 * マイ献立テンプレ（2026-07-29 便CB-2・docs/59 A-1＋B-2）の純ロジック。
 * DB・DOMに触らない（テストで固定できるようにするため。db/mealTemplates.ts が読み書きを担う）。
 *
 * 設計の要は「テンプレは日付ではなく曜日で持つ」こと（db/types.ts MealTemplateItem 参照）。
 * これにより A-1（1週間まるごと別の週へ流し込む）と B-2（金曜だけを選んで月の全部の金曜へ
 * 流し込む＝毎週◯曜はカレー）が、同じデータの「流し込む曜日を絞るか否か」の違いだけになる。
 */

/** テンプレ名の上限文字数（「平日の定番」程度が十分入る長さ） */
export const TEMPLATE_NAME_MAX_LENGTH = 20

/** 曜日の全指定（0=月 … 6=日）。既定は全曜日＝1週間まるごと流し込む */
export const ALL_DOWS = [0, 1, 2, 3, 4, 5, 6]

/**
 * 表示中の週の献立を、テンプレの中身（曜日×食事×役割）へ変換する。
 * dates に含まれない日付のエントリは捨てる（週タブが前後の週を見ているときに、
 * 取得範囲の重なりで別の週の献立が混ざらないようにするため）。
 * 並びは 曜日→食事→役割 に固定する（保存内容が押した順に左右されないように）。
 */
export function buildTemplateItems(
  entries: Pick<MealPlanEntry, 'date' | 'slot' | 'recipeId' | 'role'>[],
  dates: string[],
): MealTemplateItem[] {
  const target = new Set(dates)
  const items: MealTemplateItem[] = entries
    .filter((e) => target.has(e.date))
    .map((e) => ({
      dow: dowIndex(e.date),
      slot: e.slot,
      role: (e.role ?? 'main') as MealRole,
      recipeId: e.recipeId,
    }))
  const roleRank = (role: MealRole) => (role === 'main' ? 0 : 1)
  return items.sort(
    (a, b) =>
      a.dow - b.dow ||
      MEAL_SLOTS.indexOf(a.slot) - MEAL_SLOTS.indexOf(b.slot) ||
      roleRank(a.role) - roleRank(b.role) ||
      a.recipeId - b.recipeId,
  )
}

/** テンプレを流し込む計画（planTemplateFill の戻り値。呼び出し側はこれを見てDB操作をする） */
export interface TemplateFillPlan {
  /** 実際に追加する行（日付・食事・役割・レシピ）。空なら流し込むものが無い */
  ops: { date: string; slot: MealSlot; role: MealRole; recipeId: number }[]
  /** これから献立が入る食事の数（＝空いていた食事の数） */
  fillSlotCount: number
  /** すでに献立が入っていて触らない食事の数（規約Fの確認文で「残るもの」として出す） */
  keptSlotCount: number
  /** テンプレに中身がある曜日にあたった日数（確認文の「何日分か」に使う） */
  targetDayCount: number
  /**
   * テンプレに中身はあるのに、その食事を画面に出していないせいで入れられなかった食事
   * （2026-07-30 便CH/C14）。1品も入らなかったときに「選んだ曜日には献立がありません」と
   * 事実と違う理由を返していたので、本当の理由を言い分けるために返す。
   */
  hiddenSlots: MealSlot[]
}

/**
 * テンプレを対象期間へ流し込む計画を立てる。
 *
 * 守ること（既存の「先週の献立をコピー」＝S-3と同じ非破壊の作法にそろえる）:
 * - すでに献立が1品でも入っている食事（date×slot）には入れない＝上書きしない。手動配置も
 *   自動提案由来の枠も等しく残す（何が残るかを確認文で言い切れるように、粒度は「食事」で統一）。
 * - 過去日（今日より前）は対象外。上書きも新規埋めもしない（便W-⑤a以来の共通ルール）。
 * - 表示していない食事（visibleSlots外）には入れない。画面に出ない献立が黙って増えるのを防ぐ。
 * - allowedDows で曜日を絞れる（B-2「毎週この曜日だけ」）。既定は全曜日（ALL_DOWS）。
 */
export function planTemplateFill(options: {
  items: MealTemplateItem[]
  /** 流し込む対象の日付（週タブ＝7日・月タブ＝その月の全日） */
  dates: string[]
  /** 対象期間にすでに入っている献立（重なりを判定するためだけに使う） */
  entries: Pick<MealPlanEntry, 'date' | 'slot'>[]
  /** YYYY-MM-DD（今日） */
  today: string
  /** 流し込む曜日（0=月 … 6=日）。B-2の「毎週この曜日だけ」 */
  allowedDows: number[]
  /** 表示中の食事（朝食・昼食・夕食のうち画面に出しているもの） */
  visibleSlots: MealSlot[]
}): TemplateFillPlan {
  const { items, dates, entries, today, allowedDows, visibleSlots } = options
  const filledSlotKeys = new Set(entries.map((e) => `${e.date}|${e.slot}`))
  const itemsByDowSlot = new Map<string, MealTemplateItem[]>()
  for (const item of items) {
    const key = `${item.dow}|${item.slot}`
    const list = itemsByDowSlot.get(key)
    if (list) list.push(item)
    else itemsByDowSlot.set(key, [item])
  }

  const ops: TemplateFillPlan['ops'] = []
  let fillSlotCount = 0
  let keptSlotCount = 0
  let targetDayCount = 0
  const hiddenSlotSet = new Set<MealSlot>()
  for (const date of dates) {
    if (isPastDate(date, today)) continue
    const dow = dowIndex(date)
    if (!allowedDows.includes(dow)) continue
    // 表示していない食事にテンプレの中身があるかを控えておく（2026-07-30 便CH/C14。
    // 入らなかった理由を「曜日に中身が無い」と取り違えないようにするため）
    for (const slot of MEAL_SLOTS) {
      if (visibleSlots.includes(slot)) continue
      if ((itemsByDowSlot.get(`${dow}|${slot}`) ?? []).length > 0) hiddenSlotSet.add(slot)
    }
    let dayHasTemplateItems = false
    for (const slot of visibleSlots) {
      const slotItems = itemsByDowSlot.get(`${dow}|${slot}`)
      if (!slotItems || slotItems.length === 0) continue
      dayHasTemplateItems = true
      if (filledSlotKeys.has(`${date}|${slot}`)) {
        keptSlotCount++
        continue
      }
      fillSlotCount++
      for (const item of slotItems) {
        ops.push({ date, slot, role: item.role, recipeId: item.recipeId })
      }
    }
    if (dayHasTemplateItems) targetDayCount++
  }
  return {
    ops,
    fillSlotCount,
    keptSlotCount,
    targetDayCount,
    hiddenSlots: MEAL_SLOTS.filter((s) => hiddenSlotSet.has(s)),
  }
}

/**
 * テンプレの中身から「その曜日に入っている品数」を数える（曜日チップの補助表示用）。
 * 0品の曜日は選んでも何も起きないので、画面側でそれが分かるようにするために使う。
 */
export function templateDowCounts(items: MealTemplateItem[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0]
  for (const item of items) {
    if (item.dow >= 0 && item.dow <= 6) counts[item.dow] += 1
  }
  return counts
}
