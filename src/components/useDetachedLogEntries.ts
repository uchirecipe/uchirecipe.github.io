import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { detachedRecipeStub } from '../logic/detachedLogs'
import type { CookedLogDetailTarget } from './CookedLogDetailModal'

/**
 * レシピを削除したあとも残っている「作った記録」を、記録が並ぶ画面がそのまま扱える形で読む
 * （2026-08-16 便GZ・オーナー承認）。
 *
 * 返す形をレシピ側の記録（{ recipe, log, logIndex }）とそろえてあるので、
 * 記録の一覧・ホームの「最近作ったもの」・月カレンダーは、日付で並べ替える手前で
 * 合流させるだけでよい。レシピの形は id を持たない見た目だけの形（detachedRecipeStub）で、
 * レシピ詳細への行き先も編集も出ない（オーナーの求めた③）。
 *
 * **栄養・食費の集計には渡さないこと。** これらの記録には材料が無い（レシピ本体を消した後なので、
 * 何をどれだけ使ったかの情報が端末に残っていない）ため、集計に混ぜると
 * 「中身が0の料理を1品作った」と数えてしまう。出すのは記録として読む場所だけにする。
 */
export type DetachedLogEntry = CookedLogDetailTarget & { detachedRecordId: number }

export function useDetachedLogEntries(): DetachedLogEntry[] | undefined {
  const records = useLiveQuery(() => db.detachedLogs.toArray(), [])
  return useMemo(() => {
    if (!records) return undefined
    return records.flatMap((record) => {
      if (record.id == null) return []
      const recipe = detachedRecipeStub(record)
      const recordId = record.id
      return record.logs.map((log, logIndex) => ({
        recipe,
        log,
        logIndex,
        detachedRecordId: recordId,
      }))
    })
  }, [records])
}
