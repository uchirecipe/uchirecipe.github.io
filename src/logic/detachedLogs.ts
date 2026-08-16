import type { CookedLog, DetachedCookedRecord, Recipe } from '../db/types'
import { indexRecipesByUid } from './recipeUid'

/**
 * レシピを削除しても残る「作った記録」の純ロジック（DB非依存。2026-08-16 便GZ・オーナー承認）。
 *
 * オーナーの求めた形:
 *  ①レシピを削除したら、カードも詳細画面も無くなる（従来どおり）
 *  ②記録は残り、記録した内容も写真も見られる
 *  ③記録からレシピ詳細へは行けない（そのレシピがもう無いことが読んで分かる）
 *  ④書き出したファイルから同じレシピを入れ直したら、記録とレシピのつながりが戻る
 *
 * ④を「料理名で結ばない」で実現するのが要点（オーナーの懸念「似た名前の違うレシピと
 * つながってしまいそう」への答え）。結び直しは Recipe.uid（logic/recipeUid.ts）の
 * 完全一致だけを見る。印を持たない古い書き出しファイルから入れ直したレシピには
 * 起動時に**新しい印**が振られるので、記録とは結ばれないまま残る
 * （docs/69「『消えない』より『間違ったものが残らない』を優先」）。
 *
 * このファイルはDB非依存（db/db.ts を読まない）。DBの読み書きは db/detachedLogs.ts が行う
 * （単体テスト scripts/test-logic.mjs から素のNodeで読めるようにするため）。
 */

/**
 * 「同じ記録か」の照合キー（日付＋ひとことメモ）。
 * logic/backup.ts の cookedLogKey と同じ決め方にそろえてある（バックアップの取り込みで
 * 記録を重複させない判定と、結び直しの判定が食い違うと、同じ記録が2件に増えるため）。
 */
export function detachedLogKey(log: Pick<CookedLog, 'date' | 'note'>): string {
  return `${log.date}\n${log.note ?? ''}`
}

/** 記録の並びは日付の新しい順（db/recipes.ts の sortLogsByDateDesc と同じ） */
function sortByDateDesc(logs: readonly CookedLog[]): CookedLog[] {
  return [...logs].sort((a, b) => b.date.localeCompare(a.date))
}

/**
 * 削除するレシピから「残す記録」のまとまりを作る。
 * 記録が1件も無いレシピは null（残すものが無いので行を作らない＝空の行でテーブルを太らせない）。
 * 写真は記録の中のBlobをそのまま持ち替えるだけなので、容量は増えも減りもしない。
 */
export function buildDetachedRecord(
  recipe: Pick<Recipe, 'uid' | 'title' | 'iconKey' | 'servings' | 'cookedLogs'>,
  now: number = Date.now(),
): Omit<DetachedCookedRecord, 'id'> | null {
  const logs = recipe.cookedLogs ?? []
  if (logs.length === 0) return null
  return {
    recipeUid: recipe.uid,
    title: recipe.title,
    iconKey: recipe.iconKey,
    servings: recipe.servings,
    logs: sortByDateDesc(logs),
    detachedAt: now,
  }
}

/**
 * 記録のまとまり同士を1つに畳む（同じ印のレシピを2回消した場合など）。
 * 同じ記録（日付＋メモ）は1件だけ残し、写真は「片方にしか無ければ有る方を採る」
 * （logic/cookedArchive.ts の mergeArchiveLogs と同じ流儀）。
 */
export function mergeCookedLogLists(
  existing: readonly CookedLog[],
  incoming: readonly CookedLog[],
): { logs: CookedLog[]; added: number } {
  const logs = existing.map((log) => ({ ...log }))
  const indexByKey = new Map<string, number>()
  logs.forEach((log, index) => {
    const key = detachedLogKey(log)
    if (!indexByKey.has(key)) indexByKey.set(key, index)
  })
  let added = 0
  for (const log of incoming) {
    const key = detachedLogKey(log)
    const index = indexByKey.get(key)
    if (index === undefined) {
      logs.push({ ...log })
      indexByKey.set(key, logs.length - 1)
      added++
      continue
    }
    if (!logs[index].photo && log.photo) logs[index].photo = log.photo
  }
  return { logs: sortByDateDesc(logs), added }
}

/**
 * 印が同じまとまり同士を1行に畳む（印を持たない行は畳まず、そのまま1行ずつ残す）。
 * 印が無い行は「どのレシピの記録か分からない記録」なので、まとめてよい根拠が無い。
 */
export function mergeDetachedRecords(
  records: readonly Omit<DetachedCookedRecord, 'id'>[],
): Omit<DetachedCookedRecord, 'id'>[] {
  const byUid = new Map<string, Omit<DetachedCookedRecord, 'id'>>()
  const out: Omit<DetachedCookedRecord, 'id'>[] = []
  for (const record of records) {
    if (!record.recipeUid) {
      out.push({ ...record, logs: sortByDateDesc(record.logs) })
      continue
    }
    const found = byUid.get(record.recipeUid)
    if (!found) {
      const copy = { ...record, logs: sortByDateDesc(record.logs) }
      byUid.set(record.recipeUid, copy)
      out.push(copy)
      continue
    }
    found.logs = mergeCookedLogLists(found.logs, record.logs).logs
    // 料理名・アイコンは新しく消した方（＝より新しい姿）を採る
    if (record.detachedAt >= found.detachedAt) {
      found.title = record.title
      found.iconKey = record.iconKey
      found.servings = record.servings
      found.detachedAt = record.detachedAt
    }
  }
  return out
}

/** 結び直しの計画1件（この記録のまとまりを、このレシピへ戻す） */
export interface DetachedReattachPlanItem {
  /** 戻す記録のまとまり（detachedLogs テーブルの行） */
  recordId: number
  /** 戻し先のレシピ */
  recipeId: number
  /** 戻したあとのレシピの記録（重複を除いて日付順に整えたもの） */
  cookedLogs: CookedLog[]
  /** 実際に足した記録の件数（0なら既に同じ記録がレシピ側にある） */
  added: number
}

export interface DetachedReattachPlan {
  items: DetachedReattachPlanItem[]
  /** 戻した記録の合計件数（結果表示に使う） */
  logsReattached: number
  /** つながりが戻ったレシピの品数 */
  recipes: number
}

/**
 * 「入れ直したレシピ」と「残っている記録」を突き合わせて、結び直す組を決める（純ロジック）。
 *
 * 結ぶ条件は **印（recipeUid）の完全一致だけ**。料理名は一切見ない。
 * - 印を持たない記録のまとまり（古い書き出しファイル由来のレシピを消したもの）は結ばない
 * - 印が一致するレシピが端末に無ければ結ばない
 * - 同じ印のレシピが2品あるときは、id の小さい方（先に入った方）に結ぶ（indexRecipesByUid）
 *
 * 結んだ記録はレシピ側へ移し、まとまりの行は消す（呼び出し側が実行する）。
 * レシピ側に同じ記録（日付＋メモ）が既にあれば足さず、写真だけ埋める。
 */
export function planDetachedReattach(
  records: readonly DetachedCookedRecord[],
  recipes: readonly Pick<Recipe, 'id' | 'uid' | 'cookedLogs'>[],
): DetachedReattachPlan {
  const byUid = indexRecipesByUid(recipes)
  const items: DetachedReattachPlanItem[] = []
  let logsReattached = 0
  // 同じレシピへ2つのまとまりが戻る場合に、前の結果を土台にして続けて畳む
  const workingLogs = new Map<number, CookedLog[]>()
  for (const record of records) {
    if (!record.recipeUid || record.id == null) continue
    const recipe = byUid.get(record.recipeUid)
    if (!recipe || recipe.id == null) continue
    const base = workingLogs.get(recipe.id) ?? recipe.cookedLogs ?? []
    const merged = mergeCookedLogLists(base, record.logs)
    workingLogs.set(recipe.id, merged.logs)
    items.push({
      recordId: record.id,
      recipeId: recipe.id,
      cookedLogs: merged.logs,
      added: merged.added,
    })
    logsReattached += merged.added
  }
  return { items, logsReattached, recipes: new Set(items.map((i) => i.recipeId)).size }
}

/**
 * 記録のまとまりを、画面の部品へ渡すための「レシピの形」にする。
 *
 * **id を持たせない**のが要点（オーナーの求めた③）。記録の一覧・カレンダー・記録の小窓は
 * すでに「id の無いレシピ＝端末に無いレシピ」を、レシピ詳細への行き先を出さない形で
 * 扱えるようになっている（月間サンプルデモの見本で使っている経路）。
 * 同じ道に乗せることで、削除済みレシピの記録から詳細画面へ行ける穴を作らずに済む。
 *
 * 材料・手順は空にする。栄養・食費の集計に「中身の無い料理」を0として混ぜないよう、
 * 集計側にはこの形を渡さない（呼び出し側の責任。db/detachedLogs.ts のコメント参照）。
 */
export function detachedRecipeStub(record: DetachedCookedRecord): Recipe {
  return {
    id: undefined,
    uid: record.recipeUid,
    title: record.title,
    servings: record.servings ?? 1,
    effortLevel: 'normal',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: record.logs,
    searchWords: [],
    iconKey: record.iconKey,
    createdAt: record.detachedAt,
    updatedAt: record.detachedAt,
  }
}

/** 残っている記録の件数と、そのうち写真つきの枚数 */
export function countDetachedLogs(records: readonly Pick<DetachedCookedRecord, 'logs'>[]): {
  logs: number
  photos: number
  recipes: number
} {
  let logs = 0
  let photos = 0
  for (const record of records) {
    logs += record.logs.length
    photos += record.logs.filter((log) => !!log.photo).length
  }
  return { logs, photos, recipes: records.length }
}

/** 残っている記録の写真の合計バイト数（設定画面の容量の目安に足す） */
export function detachedPhotoBytes(
  records: readonly Pick<DetachedCookedRecord, 'logs'>[],
): number {
  return records.reduce(
    (sum, record) =>
      sum + record.logs.reduce((logSum, log) => logSum + (log.photo?.size ?? 0), 0),
    0,
  )
}
