import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { addToTodayList } from './todayList'
import { mealRoleForRecipe, planRoleAssign, todaySlotAddPlan } from '../logic/mealPlan'
import type { MealPlanEntry, MealPurpose, MealRole, MealSlot } from './types'

export async function listMealPlanRange(startDate: string, endDate: string) {
  return db.mealPlans.where('date').between(startDate, endDate, true, true).toArray()
}

/** 指定期間の献立を取得するフック（変更されると自動で再描画） */
export function useMealPlanRange(startDate: string, endDate: string) {
  return useLiveQuery(() => listMealPlanRange(startDate, endDate), [startDate, endDate])
}

/**
 * 献立が入っている一番古い日（2026-08-21 便IO）。
 *
 * 「過去の献立をコピー」で、どこまで週を送れるかを決めるのに使う
 * （logic/mealPlan.ts の maxCopySourceWeeksBack）。date は索引を張ってあるので、
 * 全件を読まずに先頭の1件だけを取る。
 *
 * 返し分け: 読み込み中は undefined、**献立が1件も無いときは null**、あれば日付。
 * 画面は「まだ何も入れていない人」にだけ案内を出すので、この2つを見分けられる必要がある
 * （読み込み中に「まだありません」と出すと、直後に消える案内を見せることになる）。
 */
export function useEarliestMealPlanDate() {
  return useLiveQuery(async () => (await db.mealPlans.orderBy('date').first())?.date ?? null, [])
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
): Promise<number> {
  // auto=true は「まとめて献立を立てる」由来の枠だけに付ける。手動追加(既定)は付けない
  // （＝手動配置として保護される。types.ts MealPlanEntry.auto 参照）。falseはあえて保存せず
  // 既存の「未設定=手動」の後方互換とそろえる（レコードを余計な項目で汚さない）。
  // purpose も同じ流儀で、指定があるときだけ書く
  const entry: MealPlanEntry = { date, slot, recipeId, role }
  if (auto) entry.auto = true
  if (auto && purpose) entry.purpose = purpose
  // 付いたidを返す（2026-08-19 便IA）。サイコロで入れた行を「元に戻す」で外すには、
  // どの行が増えたのかを呼び出し側が知っている必要がある。
  // 使わない呼び出し側はそのまま無視できる（戻り値が void → number に増えただけ）
  return (await db.mealPlans.add(entry)) as number
}

/**
 * 同じ日×枠に同じレシピが既にあれば追加せず 'duplicate' を返す追加ヘルパー
 * （2026-07-17 便Z-1・docs/35 §2: 「今日の献立に追加」のスロット振り分け窓用。
 * 呼び出し側は 'duplicate' のときトーストで案内する）。
 * 重複チェック(where)と追加(add)を1トランザクションで原子化する
 * （todayList.tsのaddToTodayListと同じ作法。同時タップの割り込み重複を防ぐ）
 *
 * 2026-08-11 便FN: その品を今日すでに作ったかどうかも受け取り、作り終えた行は
 * 「重複」と数えない（'restore' を返す＝行は増やさず、呼び出し側が今日の献立へ戻す）。
 * 判断そのものは純関数 logic/mealPlan.ts todaySlotAddPlan に置いてテストで固定してある。
 */
export async function addMealEntryIfAbsent(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
  cookedToday = false,
): Promise<'added' | 'restore' | 'duplicate'> {
  return db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    const plan = todaySlotAddPlan(
      sameSlot.map((e) => e.recipeId),
      recipeId,
      cookedToday,
    )
    if (plan !== 'add') return plan
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
 * 指定したidの献立をまとめて削除する（2026-08-08 便DX）。
 * 「まとめて空にする」が使う。どの行を消すかの判断は純ロジック
 * （logic/mealPlan.ts の planClearMealSlots。鍵の掛かった食事を外す）が持ち、ここは消すだけ。
 */
export async function removeMealEntries(entryIds: number[]): Promise<void> {
  if (entryIds.length === 0) return
  await db.mealPlans.bulkDelete(entryIds)
}

/**
 * 選んだレシピを**まとめて**今日の献立へ入れる（2026-08-11 便FP・利用者テスト①②）。
 *
 * 直した問題: 3品を今日の献立に入れるのに、〈一覧→レシピを開く→今日の献立に追加→食事を選ぶ→
 * 戻る〉を3周する以外の手段が無かった。レシピ一覧の「選択」も書き出しと削除にしか使えなかった。
 *
 * 1品ずつの経路（RecipeDetailPage の「今日の献立に追加」）とまったく同じ判断を使う
 * ＝どちらの入口から入れても結果が変わらないようにする:
 *  - 予定の行の役割は、レシピの「料理の種別」から決める（mealRoleForRecipe）
 *  - その食事に同じ品が既にある扱いは todaySlotAddPlan（今日すでに作った品は行を増やさず戻す）
 *  - slot を渡さない＝「朝食・昼食・夕食を決めずに今日の献立に追加」と同じで、今週の予定には入れない
 *
 * @returns added=入れた品数 / already=すでに入っていて何も増やさなかった品数
 */
export async function addRecipesToToday(
  date: string,
  recipeIds: number[],
  slot?: MealSlot,
): Promise<{ added: number; already: number }> {
  let added = 0
  let already = 0
  for (const recipeId of recipeIds) {
    const recipe = await db.recipes.get(recipeId)
    if (!recipe) continue
    if (slot) {
      const cookedToday = (recipe.cookedLogs ?? []).some((log) => log.date === date)
      const result = await addMealEntryIfAbsent(
        date,
        slot,
        recipeId,
        mealRoleForRecipe(recipe),
        cookedToday,
      )
      if (result === 'duplicate') {
        already++
        continue
      }
      await addToTodayList(recipeId)
      added++
      continue
    }
    const existing = await db.todayList.where('recipeId').equals(recipeId).first()
    if (existing) {
      already++
      continue
    }
    await addToTodayList(recipeId)
    added++
  }
  return { added, already }
}

/**
 * その日・枠に、役割（主菜/副菜/汁物/その他）の行としてレシピを1品**足す**
 * （2026-07-29 便CB-1 → 2026-08-24 便KIで「足すだけ」に改めた）。
 * 日タブの「◯食に入れる」のように、枠を指定して素早く登録したい場面で使う。
 *
 * **この関数は献立を1件も消さない。** 2026-08-24 便KIまでは主菜のときだけ既存の主菜を
 * 差し替えていたため、もとからあった夕食の主菜が消えていた（オーナー実機報告）。
 * 何をするかの判断は純関数 planRoleAssign（logic/mealPlan.ts）に置き、テストで固定してある
 * （そちらに「消す」結果そのものが無い＝この入口から献立が消える道を型ごと無くしてある）。
 *
 * 判定と書き込みは1トランザクションにまとめ、連打しても同じ料理が二重に入らないようにする
 * （2回目は 'duplicate' が返り、呼び出し側が「すでに入っています」と知らせる）。
 */
export async function assignMealEntryByRole(
  date: string,
  slot: MealSlot,
  recipeId: number,
  role: MealRole,
): Promise<'added' | 'duplicate'> {
  return db.transaction('rw', db.mealPlans, async () => {
    const sameSlot = await db.mealPlans.where('[date+slot]').equals([date, slot]).toArray()
    const plan = planRoleAssign(sameSlot, recipeId, role)
    if (plan.kind === 'duplicate') return 'duplicate'
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

/**
 * ✕で外した献立の行を、外す直前の姿のまま入れ直す（2026-08-18 便HQ・軸1）。
 *
 * 「元に戻す」が戻すのは、その✕が消したものだけ。渡された行だけを id ごと入れ直すので、
 * 同じ日の他の行や、外したあとに足した行には一切触らない
 * （その日を丸ごと入れ替える restoreDayMealPlan とはそこが違う）。
 * id を持ったまま put するので、戻したあとの行は外す前と同じ id になる。
 */
export async function restoreMealEntries(entries: readonly MealPlanEntry[]): Promise<void> {
  if (entries.length === 0) return
  await db.mealPlans.bulkPut(entries.map((e) => ({ ...e })))
}

/** 型の再エクスポート（呼び出し側がdb/typesを個別importしなくてよいように） */
export type { MealPlanEntry }
