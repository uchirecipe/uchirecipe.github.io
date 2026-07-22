import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import type { MealPlanEntry, MealRole, MealSlot } from './types'

export async function listMealPlanRange(startDate: string, endDate: string) {
  return db.mealPlans.where('date').between(startDate, endDate, true, true).toArray()
}

/** 指定期間の献立を取得するフック（変更されると自動で再描画） */
export function useMealPlanRange(startDate: string, endDate: string) {
  return useLiveQuery(() => listMealPlanRange(startDate, endDate), [startDate, endDate])
}

/**
 * 指定の日・枠・役割（主菜/副菜）に新しいレシピの割り当てを1件追加する。
 * 同じ日×枠に複数件（主菜+副菜、または同じ役割を複数）を追加できる
 * （2026-07-13 献立の主菜+副菜構成対応。以前は1枠=1件だったが、mealPlansの
 * [date+slot]索引はもともとunique指定ではなかったため、スキーマ変更なしで
 * 複数件を保存できる）
 */
export async function addMealEntry(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
  auto = false,
): Promise<void> {
  // auto=true は「まとめて献立を立てる」由来の枠だけに付ける。手動追加(既定)は付けない
  // （＝手動配置として保護される。types.ts MealPlanEntry.auto 参照）。falseはあえて保存せず
  // 既存の「未設定=手動」の後方互換とそろえる（レコードを余計な項目で汚さない）
  await db.mealPlans.add(auto ? { date, slot, recipeId, role, auto: true } : { date, slot, recipeId, role })
}

/**
 * 同じ日×枠に同じレシピが既にあれば追加せず 'duplicate' を返す追加ヘルパー
 * （2026-07-17 便Z-1・docs/35 §2: 「今日の献立に追加」のスロット振り分け窓用。
 * 呼び出し側は 'duplicate' のときトーストで案内する）。
 * 重複チェック(where)と追加(add)を1トランザクションで原子化する
 * （todayList.tsのaddToTodayListと同じ作法。同時タップの割り込み重複を防ぐ）
 */
export async function addMealEntryIfAbsent(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
): Promise<'added' | 'duplicate'> {
  return db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    if (sameSlot.some((e) => e.recipeId === recipeId)) return 'duplicate'
    await db.mealPlans.add({ date, slot, recipeId, role })
    return 'added'
  })
}

/**
 * 既存エントリのレシピだけを差し替える（役割・日付・枠は変えない）。
 * ピッカーでの選び直し・行サイコロなど、ユーザーが明示的に置き換える経路で使う。
 * このとき auto フラグを外して手動扱いに戻す（2026-07-22 便BE）：自動提案由来の枠を
 * ユーザーが差し替えたら、それはもう「手動で決めた枠」なので、次の「まとめて献立を立てる」で
 * 上書きされないよう保護する。「まとめて献立を立てる」自身は remove+add で埋め直すので
 * この関数は通らない
 */
export async function updateMealEntryRecipe(entryId: number, recipeId: number): Promise<void> {
  await db.mealPlans.update(entryId, { recipeId, auto: false })
}

/** 指定エントリを削除する（その行だけを外す） */
export async function removeMealEntry(entryId: number): Promise<void> {
  await db.mealPlans.delete(entryId)
}

/**
 * 指定期間のうち、指定した食事帯（例: 朝食）のエントリだけをまとめて削除する。
 * 週タブの「この帯の今週分を空にする」用（2026-07-16 便U-4 Fable設計:
 * 「朝のみ削除したい」というオーナー要望への回答。帯を選んで確認ダイアログを経てから
 * 呼び出す想定）。他の帯・他の日付には影響しない
 */
export async function clearMealSlotInRange(
  startDate: string,
  endDate: string,
  slot: MealSlot,
): Promise<void> {
  const rows = await db.mealPlans
    .where('date')
    .between(startDate, endDate, true, true)
    .and((e) => e.slot === slot)
    .toArray()
  const ids = rows.map((r) => r.id).filter((id): id is number => id != null)
  if (ids.length > 0) await db.mealPlans.bulkDelete(ids)
}

/**
 * その日・枠の「主菜」を設定する（無ければ追加、あれば差し替え）。役割未設定の
 * 既存データも主菜として扱う（後方互換）。「今日の献立」との食い違い解消チップなど、
 * 役割を意識せず「この枠にこのレシピ」を素早く設定したい場面向けの簡易ヘルパー
 */
export async function setMainMeal(date: string, slot: MealSlot, recipeId: number): Promise<void> {
  await db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    const existingMain = sameSlot.find((e) => (e.role ?? 'main') === 'main')
    if (existingMain) {
      await db.mealPlans.update(existingMain.id!, { recipeId })
    } else {
      await db.mealPlans.add({ date, slot, recipeId, role: 'main' })
    }
  })
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealPlanEntry }
