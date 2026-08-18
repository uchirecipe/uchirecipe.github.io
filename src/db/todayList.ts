import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { addCookedLog } from './recipes'
import { lowerPantryLevelsForCooked } from './pantry'
import { todayString } from '../logic/date'
import { staleTodayListFromPlanIds } from '../logic/mealPlan'
import { isOneTapCookedLog } from '../logic/cooked'
import { effectiveMealServings } from '../logic/servings'

/**
 * ボタン1回の「作った！」で記録する食数を決める（2026-08-10 便FF・オーナー指示
 * 「作った！では基本的に、作った！押下時に設定されている食数を記録したい。
 * 設定がなければ個人設定に登録されている食数を自動で反映して」）。
 *
 * 優先順位は買い物メモ・概算食費とまったく同じ（logic/servings.ts effectiveMealServings）:
 *   ①その枠に決めた食数 ②設定「食数の設定」の人数 ③レシピに登録されている人数分。
 * 呼び出し側が①を解決済みの値として渡せるので、渡された分はそのまま使い、
 * 渡されなかった品だけここで②③に倒す（画面ごとに違う人数が記録されないよう、
 * 解決の規則はこの1か所とeffectiveMealServingsに閉じ込める）。
 *
 * 既にある記録は一切書き換えない（この関数は新しく足す記録の値だけを決める）。
 */
async function resolveCookedServings(
  recipeIds: number[],
  resolved?: ReadonlyMap<number, number>,
): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  const missing = recipeIds.filter((id) => {
    const value = resolved?.get(id)
    if (value != null && value > 0) {
      map.set(id, value)
      return false
    }
    return true
  })
  if (missing.length === 0) return map
  const settings = await db.settings.get(1)
  for (const recipeId of missing) {
    const recipe = await db.recipes.get(recipeId)
    map.set(
      recipeId,
      effectiveMealServings(undefined, settings?.householdServings, recipe?.servings),
    )
  }
  return map
}

/**
 * 献立ページの「作った」「全て作った！」でも、レシピ詳細の「作った！」と同じように
 * 在庫を1段階下げる（2026-07-29 便CC/C3）。
 *
 * 従来 lowerPantryLevelsForCooked の呼び出しは RecipeDetailPage にしか無く、同じ「作った」と
 * いう語なのに入口によって在庫が減ったり減らなかったりしていた。
 * 設定（cookedReflectPantry・既定OFF）はレシピ詳細と共通で、OFFなら何もしない。
 * レシピ1品につき1回ずつ数える＝詳細ページで1品ずつ「作った！」を押したときと同じ結果になる。
 *
 * 在庫の更新は、記録（recipes・todayList）のトランザクションが終わってから行う
 * （Dexieは対象テーブルが外側の集合に含まれていないと同じトランザクション内で触れないため）。
 */
async function reflectPantryForCooked(recipeIds: number[]): Promise<void> {
  if (recipeIds.length === 0) return
  const settings = await db.settings.get(1)
  if (!settings?.cookedReflectPantry) return
  for (const recipeId of recipeIds) {
    const recipe = await db.recipes.get(recipeId)
    if (recipe) await lowerPantryLevelsForCooked(recipe.ingredients)
  }
}

export async function listTodayList() {
  return db.todayList.orderBy('addedAt').toArray()
}

/** 「今日の献立」の一覧を取得するフック（変更されると自動で再描画） */
export function useTodayList() {
  return useLiveQuery(listTodayList, [])
}

/**
 * レシピ詳細の「今日の献立に追加」ボタン（旧文言「今日つくる」）から追加（同じレシピは重複追加しない）。
 * 重複チェック(get)と追加(add)を1トランザクションにして原子化する（データ堅牢性強化・2026-07-13。
 * 同時タップ等でチェックと追加の間に別の追加が割り込み、重複登録されることを防ぐ）
 */
export async function addToTodayList(recipeId: number): Promise<void> {
  await db.transaction('rw', db.todayList, async () => {
    const existing = await db.todayList.where('recipeId').equals(recipeId).first()
    if (existing) return
    await db.todayList.add({ recipeId, addedAt: Date.now() })
  })
}

/** 「×」でいつでも外す */
export async function removeFromTodayList(recipeId: number): Promise<void> {
  await db.todayList.where('recipeId').equals(recipeId).delete()
}

/**
 * 個別の「作った」: 今日の日付で記録し、今日の献立から外す。
 * addCookedLog(recipes.ts)とremoveFromTodayListをrecipes+todayListを跨ぐ1トランザクションに
 * まとめて原子化する（データ堅牢性強化・2026-07-13）。addCookedLogは内部で
 * db.transaction('rw', db.recipes, ...)を開くが、Dexieのトランザクションは対象テーブルが
 * 外側の集合の部分集合なら外側を再利用する(reentrant)ため、この呼び出しも含めて単一の
 * 物理トランザクションになる。addCookedLogの他の呼び出し元(markAllTodayListCooked等)は
 * 従来どおり単独のトランザクションのまま動作し、挙動は変わらない。
 *
 * 2026-08-10 便FF: 何人分作ったかも一緒に記録する（resolveCookedServings 参照）。
 * servings には「その枠に決めた食数」を解決済みの値で渡す。渡さなければ
 * 設定「食数の設定」→レシピの登録人数分の順に自動で決まる。
 */
export async function markTodayListCooked(recipeId: number, servings?: number): Promise<void> {
  const servingsById = await resolveCookedServings(
    [recipeId],
    servings != null ? new Map([[recipeId, servings]]) : undefined,
  )
  await db.transaction('rw', db.recipes, db.todayList, async () => {
    await addCookedLog(recipeId, { date: todayString(), servings: servingsById.get(recipeId) })
    await removeFromTodayList(recipeId)
  })
  await reflectPantryForCooked([recipeId]) // 在庫反映(便CC/C3。設定ONのときだけ)
}

/**
 * 直前の「作った」を取り消す（2026-08-02 便DE-3・オーナー指示。
 * 2026-08-03 便DP-1で「全て作った！」の複数件にも使えるよう配列を受け取る形へ拡張）。
 * markTodayListCooked / markAllTodayListCooked と対になる操作で、今日の日付で付いた記録を
 * 1品につき1件消し、その品を今日の献立へ戻す。トーストの「元に戻す」からだけ呼ぶ
 * （誤タップの直後を想定した経路）。実際に取り消せた品数を返す。
 *
 * 消す対象は「今日の日付で、メモも写真も付いていない記録」の先頭1件に限る
 * （2026-08-10 便FF: ボタン1回の記録にも食数が入るようになったので、判定から人数を外した。
 * logic/cooked.ts isOneTapCookedLog に判定を集約）。
 * 記録フォーム（レシピ詳細の「作った！」）で書いたメモ・写真つきの記録は、同じ日でも
 * この操作では消さない＝押し間違いの取り消しが、手で書いた記録を巻き込まないようにする。
 * 対象が1件も見つからなければ0を返し、何も変えない（呼び出し側はその旨を伝える）。
 * 一部だけ取り消せた場合も、取り消せた分の品数をそのまま返す（黙って「全部戻した」と言わない）。
 *
 * 在庫（cookedReflectPantry がONのときに1段階下げた分）は戻さない。戻す量を機械的に
 * 決められない（間に手で在庫を触っているかもしれない）ためで、呼び出し側は
 * その事実をトーストに添える。
 *
 * fromPlan（予定の写しかどうか）は、記録を付けた時点の状態を呼び出し側が控えて渡す
 * （2026-08-03 便DP-4）。ここで印を復元しないと、取り消した品だけが印の無い状態に変わり、
 * そのあと週の予定を消したときに今日の献立へ取り残される（＝直したバグが取り消し経由で戻る）。
 */
export async function undoTodayListCooked(
  items: { recipeId: number; fromPlan?: boolean }[],
): Promise<number> {
  if (items.length === 0) return 0
  const date = todayString()
  return db.transaction('rw', db.recipes, db.todayList, async () => {
    let undone = 0
    for (const { recipeId, fromPlan } of items) {
      const recipe = await db.recipes.get(recipeId)
      if (!recipe) continue
      const index = recipe.cookedLogs.findIndex((log) => isOneTapCookedLog(log, date))
      if (index < 0) continue
      await db.recipes.update(recipeId, {
        cookedLogs: recipe.cookedLogs.filter((_, i) => i !== index),
      })
      const existing = await db.todayList.where('recipeId').equals(recipeId).first()
      if (!existing)
        await db.todayList.add(
          fromPlan ? { recipeId, addedAt: Date.now(), fromPlan: true } : { recipeId, addedAt: Date.now() },
        )
      undone += 1
    }
    return undone
  })
}

/**
 * 「まとめて作った！」: 表示中の全レシピを今日の日付で記録し、リストを空にする。
 * 記録(addCookedLog)とクリア(todayList.clear)をrecipes+todayListを跨ぐ1トランザクションに
 * まとめて原子化する（2026-07バグ修正。従来は記録ループとclearが別トランザクションで、
 * 途中で失敗すると「一部だけ記録されてリストは残る/消える」不整合が起き得た）。
 * addCookedLogは内部でdb.transaction('rw', db.recipes, ...)を開くが、Dexieのトランザクションは
 * 対象テーブルが外側の集合の部分集合なら外側を再利用する(reentrant)ため、単一の物理
 * トランザクションになる(markTodayListCookedと同じ方式)。
 *
 * 2026-08-10 便FF: 1品ずつの「作った！」と同じく、何人分作ったかも記録する。
 * servingsByRecipeId には枠に決めた食数を解決済みで渡す（渡さない品は自動で決める）。
 */
export async function markAllTodayListCooked(
  recipeIds: number[],
  servingsByRecipeId?: ReadonlyMap<number, number>,
): Promise<void> {
  const date = todayString()
  const servingsById = await resolveCookedServings(recipeIds, servingsByRecipeId)
  await db.transaction('rw', db.recipes, db.todayList, async () => {
    for (const recipeId of recipeIds) {
      await addCookedLog(recipeId, { date, servings: servingsById.get(recipeId) })
    }
    await db.todayList.clear()
  })
  await reflectPantryForCooked(recipeIds) // 在庫反映(便CC/C3。設定ONのときだけ)
}

/**
 * 選んだ品だけをまとめて「作った」記録にする（2026-08-08 便ED・並行調理ナビの
 * 「まとめて作った！」）。今日の日付で記録し、記録した品だけを今日の献立から外す。
 *
 * markAllTodayListCooked（日タブの「全て作った！」）との違いは、今日の献立を丸ごと空に
 * しないこと。ナビで組むのは今日の献立の一部（2〜3品）なので、選んでいない品まで
 * 消してはいけない。記録・献立からの削除は1トランザクションにまとめて原子化する。
 */
/**
 * 2026-08-09 便EH（オーナー実機報告「まとめて作った！すると、その品が再度記録され、記録が2つになる」）:
 * **今日すでに同じ品の記録が付いているときは、記録を足さない**。
 *
 * 対象から外すのは「今日の日付で、メモも写真も付いていない記録」がある品だけ
 * ＝この関数が付ける記録とまったく同じものが既にある品。レシピ詳細の「作った！」で
 * メモや写真を添えて記録した品は別物なので、ここでは判断材料にしない
 * （undoTodayListCooked が取り消す対象の決め方と同じ規則＝logic/cooked.ts isOneTapCookedLog。
 * 2026-08-10 便FF で、この判定から人数を外した。ボタン1回の記録にも食数が入るようになり、
 * 人数の有無で見分けると二重記録の歯止めが効かなくなるため）。
 * 同じ料理を1日に2回作ったときに記録を残せなくなる心配はある。ただしその場合は
 * レシピ詳細の記録フォーム（人数・メモつき）から付けられるので、
 * **黙って二重に付くことの害の方が大きい**と判断した。
 *
 * 実際に記録した品のIDを返す（呼び出し側はその件数をそのまま画面に出す）。
 */
export async function markRecipesCooked(
  recipeIds: number[],
  servingsByRecipeId?: ReadonlyMap<number, number>,
): Promise<number[]> {
  if (recipeIds.length === 0) return []
  const date = todayString()
  const servingsById = await resolveCookedServings(recipeIds, servingsByRecipeId)
  const recorded = await db.transaction('rw', db.recipes, db.todayList, async () => {
    const done: number[] = []
    for (const recipeId of recipeIds) {
      const recipe = await db.recipes.get(recipeId)
      const alreadyLogged = recipe?.cookedLogs.some((log) => isOneTapCookedLog(log, date))
      if (!alreadyLogged) {
        await addCookedLog(recipeId, { date, servings: servingsById.get(recipeId) })
        done.push(recipeId)
      }
      await db.todayList.where('recipeId').equals(recipeId).delete()
    }
    return done
  })
  await reflectPantryForCooked(recorded) // 在庫反映(便CC/C3。設定ONのときだけ)
  return recorded
}

/**
 * 指定したレシピIDをまとめて今日の献立へ入れる（既に入っているものはスキップ）。
 *
 * fromPlan=true で呼ぶのは日タブの自動取り込み（便U-3）だけ。「予定の写しとして入った品」の
 * 印になり、週の予定を消したときに removeStaleFromPlanTodayList が片付ける対象になる
 * （2026-08-03 便DP-4）。おまかせ提案など自分で入れた品には印を付けない＝勝手に消えない。
 * 既に入っている品はスキップするので、自分で足した品が後から自動取り込みで
 * 「予定の写し」に格上げされることもない。
 */
export async function importRecipeIdsToTodayList(
  recipeIds: number[],
  options?: { fromPlan?: boolean },
): Promise<void> {
  const existing = await listTodayList()
  const existingIds = new Set(existing.map((item) => item.recipeId))
  const toAdd = recipeIds.filter((id) => !existingIds.has(id))
  let addedAt = Date.now()
  for (const recipeId of toAdd) {
    await db.todayList.add(
      options?.fromPlan
        ? { recipeId, addedAt: addedAt++, fromPlan: true }
        : { recipeId, addedAt: addedAt++ },
    )
  }
}

/**
 * 週の予定から自動取り込みした品のうち、その予定がもう無いものを今日の献立から片付ける
 * （2026-08-03 便DP-4・バグ修正）。消した品数を返す。
 *
 * 直したバグ: 週の予定を削除しても、日タブを開いたときに自動取り込みされた写しが今日の献立に
 * 残り、「レシピ一覧から選択中」として並び続けた（自分で選んだわけではない品が、自分で
 * 選んだ扱いで出てしまう）。予定を消す入口は週タブ・月タブの日モーダル・まとめて空にする、と
 * 複数あるため、消す側それぞれに後始末を足すのではなく、「今日の予定と写しを突き合わせて
 * 合わなくなったものを片付ける」1か所に集約している。
 *
 * 対象は fromPlan の印が付いた品だけ（logic/mealPlan.ts staleTodayListFromPlanIds）。
 * 自分でレシピ一覧から足した品は今日の予定に無くても残す。
 */
export async function removeStaleFromPlanTodayList(
  todayPlanRecipeIds: number[],
): Promise<number> {
  const items = await listTodayList()
  const staleIds = staleTodayListFromPlanIds(items, todayPlanRecipeIds)
  if (staleIds.length === 0) return 0
  for (const recipeId of staleIds) {
    await removeFromTodayList(recipeId)
  }
  return staleIds.length
}

/**
 * ✕で外した「今日の献立」の行を、外す直前の姿のまま入れ直す（2026-08-18 便HQ・軸1）。
 *
 * 並び順は addedAt で決まる（listTodayList）ので、控えておいた addedAt をそのまま戻す
 * ＝戻った品が一覧の末尾へ飛ばず、外す前と同じ場所に戻る。
 * 週の予定の写しの印（fromPlan）も控えのまま戻す。
 */
export async function restoreTodayListItems(
  items: readonly { id?: number; recipeId: number; addedAt: number; fromPlan?: boolean }[],
): Promise<void> {
  if (items.length === 0) return
  await db.transaction('rw', db.todayList, async () => {
    for (const item of items) {
      const existing = await db.todayList.where('recipeId').equals(item.recipeId).first()
      if (existing) continue
      await db.todayList.put({ ...item })
    }
  })
}
