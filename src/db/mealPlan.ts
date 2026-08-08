import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { planRoleAssign } from '../logic/mealPlan'
import type { MealPlanEntry, MealPurpose, MealRole, MealSlot } from './types'

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
  /**
   * 自動提案が「目的」を指定した状態で入れた枠なら、その目的（2026-08-02 便CP-2）。
   * 月タブの答え合わせ（目的を指定して組んだ日の事実表示）にだけ使う記録。
   */
  purpose?: MealPurpose,
): Promise<void> {
  // auto=true は「まとめて献立を立てる」由来の枠だけに付ける。手動追加(既定)は付けない
  // （＝手動配置として保護される。types.ts MealPlanEntry.auto 参照）。falseはあえて保存せず
  // 既存の「未設定=手動」の後方互換とそろえる（レコードを余計な項目で汚さない）。
  // purpose も同じ流儀で、指定があるときだけ書く
  const entry: MealPlanEntry = { date, slot, recipeId, role }
  if (auto) entry.auto = true
  if (auto && purpose) entry.purpose = purpose
  await db.mealPlans.add(entry)
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

/**
 * 指定エントリの「食数（何人分作るか）」だけを書き換える（2026-08-03 便DJ・オーナー指示）。
 * レシピ・日付・食事・役割は変えない。auto（自動提案由来かどうか）も変えない
 * ＝食数を直しただけで「まとめて献立を立てる」の埋め直し対象から外れたりはしない。
 * servings に undefined を渡すと項目ごと消し、そのレシピに登録されている人数分に戻す。
 */
export async function updateMealEntryServings(
  entryId: number,
  servings: number | undefined,
): Promise<void> {
  if (servings == null) {
    await db.mealPlans
      .where('id')
      .equals(entryId)
      .modify((e) => {
        delete e.servings
      })
    return
  }
  await db.mealPlans.update(entryId, { servings })
}

/** 指定エントリを削除する（その行だけを外す） */
export async function removeMealEntry(entryId: number): Promise<void> {
  await db.mealPlans.delete(entryId)
}

/**
 * 指定期間のうち、選んだ食事（例: 朝食・昼食）のエントリだけをまとめて削除する。
 * 週タブの「この週の◯◯をまとめて空にする」用（2026-07-16 便U-4 Fable設計:
 * 「朝のみ削除したい」というオーナー要望への回答。食事を選んで確認ダイアログを経てから
 * 呼び出す想定）。2026-08-03 便DJ（オーナー指示）で、1つだけだった指定を複数選択にした。
 * 指定が空のときは何もしない（誤って全消しにならないようにする）。
 * 選んでいない食事・他の日付には影響しない。
 */
export async function clearMealSlotsInRange(
  startDate: string,
  endDate: string,
  slots: MealSlot[],
): Promise<void> {
  if (slots.length === 0) return
  const targets = new Set(slots)
  const rows = await db.mealPlans
    .where('date')
    .between(startDate, endDate, true, true)
    .and((e) => targets.has(e.slot))
    .toArray()
  const ids = rows.map((r) => r.id).filter((id): id is number => id != null)
  if (ids.length > 0) await db.mealPlans.bulkDelete(ids)
}

/**
 * その日・枠に、役割（主菜/副菜）を尊重してレシピを1品入れる（2026-07-29 便CB-1）。
 * 「今日の献立」との食い違い解消チップのように、枠を指定して素早く登録したい場面で使う。
 *
 * 旧 setMainMeal（役割を見ずに必ず主菜を置き換える）を置き換えたもの。旧版は副菜の料理を
 * 押しても「その枠の主菜」を差し替えていたため、夕食の主菜が副菜に化けて消えていた（便CD報告）。
 * どうするかの判断は純関数 planRoleAssign（logic/mealPlan.ts）に置き、テストで固定してある。
 *
 * 差し替えのときは auto を外して手動配置に戻す（updateMealEntryRecipe と同じ考え方。
 * ユーザーが自分で置いた枠は「まとめて献立を立てる」で上書きさせない）。
 * 判定と書き込みは1トランザクションにまとめ、連打しても二重追加にならないようにする。
 */
export async function assignMealEntryByRole(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
): Promise<'added' | 'replaced' | 'duplicate'> {
  return db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    const plan = planRoleAssign(sameSlot, recipeId, role)
    if (plan.kind === 'duplicate') return 'duplicate'
    if (plan.kind === 'replace') {
      await db.mealPlans.update(plan.entryId, { recipeId, auto: false })
      return 'replaced'
    }
    await db.mealPlans.add({ date, slot, recipeId, role })
    return 'added'
  })
}

/**
 * その日の献立を、渡した内容そのものへ戻す（2026-08-07 便DU・オーナー指示
 * 「日の窓の変更をキャンセルで取り消せるように」）。
 *
 * 月タブの日の窓は、開いている間の追加・差し替え・削除がその場でDBへ入る作り
 * （週タブと同じ編集部品をそのまま使っているため）。「キャンセル」は、窓を開いた時点で
 * 控えておいたその日の行を、この関数でまるごと入れ直して元に戻す。
 * id ごと入れ直すので、戻した後の行は開いたときと同じidになる（他の日には一切触らない）。
 */
export async function restoreDayMealPlan(
  date: string,
  entries: MealPlanEntry[],
): Promise<void> {
  await db.transaction('rw', db.mealPlans, async () => {
    const current = await db.mealPlans.where('date').equals(date).toArray()
    const ids = current.map((e) => e.id).filter((id): id is number => id != null)
    if (ids.length > 0) await db.mealPlans.bulkDelete(ids)
    if (entries.length > 0) await db.mealPlans.bulkPut(entries.map((e) => ({ ...e, date })))
  })
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealPlanEntry }
