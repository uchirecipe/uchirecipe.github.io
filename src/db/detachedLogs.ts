import { db } from './db'
import type { DetachedCookedRecord, Recipe } from './types'
import {
  buildDetachedRecord,
  mergeCookedLogLists,
  planDetachedReattach,
} from '../logic/detachedLogs'

/**
 * レシピを削除しても残る「作った記録」の読み書き（2026-08-16 便GZ・オーナー承認）。
 * 判断そのもの（何を残すか・どれとどれを結び直すか）は logic/detachedLogs.ts の純ロジックが持ち、
 * ここはDexieへの出し入れだけを行う。
 *
 * 集計へは渡さない: この記録には材料が無い（レシピ本体を消しているため）ので、
 * 栄養・食費の集計に混ぜると「中身が0の料理を1品作った」と数えてしまう。
 * 出すのは**記録として読む場所**（記録の一覧・献立の「日」の最近作ったもの・月カレンダー・記録の小窓）だけ。
 */

/**
 * 削除するレシピの記録を「レシピの無い記録」へ移す。
 * **呼び出し側の rw トランザクション（db.detachedLogs を含むもの）の中から呼ぶこと。**
 * 削除と移し替えを同じトランザクションにしないと、片方だけ成功して記録が消える。
 *
 * 同じ印のまとまりが既にあれば1行に畳む（同じレシピを入れ直しては消す、を繰り返しても行が増えない）。
 * 記録が1件も無いレシピでは行を作らない。戻り値は残した記録の件数。
 */
export async function detachRecipeLogs(
  recipes: readonly Recipe[],
  now: number = Date.now(),
): Promise<number> {
  let kept = 0
  for (const recipe of recipes) {
    const record = buildDetachedRecord(recipe, now)
    if (!record) continue
    kept += record.logs.length
    const uid = record.recipeUid
    const existing = uid
      ? await db.detachedLogs.where('recipeUid').equals(uid).first()
      : undefined
    if (existing?.id != null) {
      await db.detachedLogs.update(existing.id, {
        title: record.title,
        iconKey: record.iconKey,
        servings: record.servings,
        logs: mergeCookedLogLists(existing.logs, record.logs).logs,
        detachedAt: now,
      })
      continue
    }
    await db.detachedLogs.add(record as DetachedCookedRecord)
  }
  return kept
}

/** 残っている記録のまとまりを全件、削除が新しい順で取得（記録の一覧・カレンダーが読む） */
export async function listDetachedRecords(): Promise<DetachedCookedRecord[]> {
  const records = await db.detachedLogs.toArray()
  return records.sort((a, b) => b.detachedAt - a.detachedAt)
}

/**
 * 入れ直したレシピと、残っている記録のつながりを戻す（オーナーの求めた④）。
 *
 * 結ぶ条件は**印（recipeUid）の完全一致だけ**で、料理名は一切見ない
 * （planDetachedReattach。似た名前の違うレシピにつながる事故を、名前を見ないことで防ぐ）。
 * 結べなかった記録はそのまま残す（消さない・推測で他のレシピにつながない）。
 *
 * 呼ぶ場所は「レシピが増えうる操作のあと」＝バックアップの取り込み・配布セットの取り込み・
 * 基本レシピの入れ直し・起動時（印を後から振ったあと）。
 * 記録が1件も残っていなければ、レシピを1件も読まずに終わる。
 */
export async function reattachDetachedLogs(): Promise<{ logs: number; recipes: number }> {
  if ((await db.detachedLogs.count()) === 0) return { logs: 0, recipes: 0 }
  return db.transaction('rw', db.recipes, db.detachedLogs, async () => {
    const records = (await db.detachedLogs.toArray()).filter((r) => !!r.recipeUid)
    if (records.length === 0) return { logs: 0, recipes: 0 }
    // 印で引く（uid の索引があるので、レシピを全件読まずに候補だけを取り出せる）
    const uids = [...new Set(records.map((r) => r.recipeUid as string))]
    const candidates = await db.recipes.where('uid').anyOf(uids).toArray()
    const plan = planDetachedReattach(records, candidates)
    for (const item of plan.items) {
      await db.recipes.update(item.recipeId, { cookedLogs: item.cookedLogs })
      await db.detachedLogs.delete(item.recordId)
    }
    return { logs: plan.logsReattached, recipes: plan.recipes }
  })
}

/**
 * レシピの無い記録を1件だけ消す（記録の小窓の「この記録を消す」）。
 * これが無いと、レシピを消したあとの記録が二度と減らせなくなる
 * （レシピ側の記録を1件だけ消せる deleteCookedLog と対になる操作）。
 * まとまりの記録が0件になったら、まとまりの行ごと消す（空の行を残さない）。
 */
export async function deleteDetachedLog(recordId: number, index: number): Promise<void> {
  await db.transaction('rw', db.detachedLogs, async () => {
    const record = await db.detachedLogs.get(recordId)
    if (!record || !record.logs[index]) return
    const logs = record.logs.filter((_, i) => i !== index)
    if (logs.length === 0) {
      await db.detachedLogs.delete(recordId)
      return
    }
    await db.detachedLogs.update(recordId, { logs })
  })
}
