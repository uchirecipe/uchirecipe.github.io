import type { CookedLog, DetachedCookedRecord, Recipe } from '../db/types'
import { ja } from '../i18n/ja'
import type { ConfirmContent } from './confirmContent'

/**
 * 「作った記録」のアーカイブ（古い記録の書き出し）。2026-08-02 オーナー採用。
 * 目的は端末容量の軽量化＝「直近◯ヶ月だけ端末に残し、それより前の記録は写真ごとファイルへ出す」。
 *
 * 対象は2か所にある記録の両方（2026-08-16 便HC）:
 * - レシピの中の記録（recipes.cookedLogs）
 * - レシピを削除しても残った記録（detachedLogs。2026-08-16 便GZ）。**レシピが無いぶん
 *   容量だけが残っている**状態なので、ここを対象外にすると軽量化という目的を果たせない。
 *   便GZの時点では対象外で、減らす手立てが「記録の小窓から1件ずつ消す」しか無かった。
 *
 * バックアップとの関係:
 * - バックアップ（logic/backup.ts）は「今の端末の中身を丸ごと往復させる」ためのもので、
 *   端末から消した記録は当然もう入らない。アーカイブファイルは端末に無い記録の唯一の控えになる。
 * - 取り違えると事故になるので、ファイルの種別マーク（kind: 'cooked-log-archive'）で区別する。
 *   バックアップファイルを「アーカイブを見る」に渡した場合も、壊れている扱いにせず
 *   「これはバックアップファイルです」と言い分けられるよう reason を返す（ArchiveFileError）。
 *
 * このファイルはDB非依存（db/db.ts を読まない）。DBの読み書きは呼び出し側
 * （SettingsPage / db/recipes.ts の deleteArchivedCookedLogs）が行う。
 * 単体テスト（scripts/test-logic.mjs）から素のNodeで読めるようにするため。
 */

/** アーカイブファイルの種別マーク（バックアップと取り違えないための目印） */
export const ARCHIVE_KIND = 'cooked-log-archive'

/** 「◯ヶ月より前」の選択肢と既定値（既定=1ヶ月。オーナー指定） */
export const ARCHIVE_MONTH_OPTIONS = [1, 3, 6]
export const DEFAULT_ARCHIVE_MONTHS = 1

/**
 * アーカイブファイルに入る記録1件。
 * アーカイブファイル単体でも「いつ・何を作ったか」が読めるように料理名を持たせる。
 * 写真はBase64で埋め込む（バックアップと同じ流儀。ファイル1つで完結させるため）。
 *
 * **ファイルの形は便GZ以前と同じ**（2026-08-16 便HC）。レシピを削除しても残った記録も
 * 同じ形で入れるので、version は 1 のままでよく、**古いアーカイブファイルもそのまま読める**
 * （記録がレシピの中にあったのか、レシピの無い記録だったのかは、端末側の話でファイルには残さない）。
 */
export interface ArchivedCookedLog {
  /** 記録1件を表す固定のID。同じ記録を二重に取り込まないための鍵（buildArchiveLogId） */
  id: string
  /** YYYY-MM-DD */
  date: string
  /** 記録した時点の料理名 */
  recipeTitle: string
  note?: string
  servings?: number
  photoBase64?: string
  photoType?: string
}

/** アーカイブファイルの中身 */
export interface CookedLogArchiveFile {
  app: 'uchi-recipe'
  /** 種別マーク。バックアップ（この項目を持たない）と区別する */
  kind: typeof ARCHIVE_KIND
  version: 1
  exportedAt: string
  logs: ArchivedCookedLog[]
}

/**
 * 端末側の記録1件（書き出し対象）。書き出したあとに端末から消すときに、
 * 「どこにある何番目の記録か」が要る。
 */
export interface ArchiveTarget {
  /** 'recipe'＝レシピの中の記録／'detached'＝レシピを削除しても残った記録（2026-08-16 便HC） */
  source: 'recipe' | 'detached'
  /** source が 'recipe' ならレシピ番号、'detached' なら記録のまとまりの番号 */
  sourceId: number
  recipeTitle: string
  /** recipe.cookedLogs ／ record.logs の添字 */
  logIndex: number
  log: CookedLog
  id: string
}

/** 書き出し対象の件数（画面表示・確認文の件数に使う） */
export interface ArchiveTargetCounts {
  logs: number
  photos: number
  /** 記録が属する品数（レシピ＋レシピの無い記録のまとまり） */
  recipes: number
  /** そのうち「レシピを削除しても残った記録」の件数（確認文で言い分けるのに使う） */
  detachedLogs: number
}

/**
 * 「◯ヶ月より前」の境目の日付（YYYY-MM-DD）。この日を含まず、これより前の記録が対象。
 * 例: 2026-08-02 に 1ヶ月 → '2026-07-02'。7/1の記録は対象、7/2の記録は残る
 * （「1ヶ月より前」＝ちょうど1ヶ月前の当日は「より前」ではないので残す）。
 *
 * 月末の補正: 3/31の1ヶ月前は「2/31」＝JSの日付では3/3になってしまうため、
 * 日がずれたら月末へ丸める（3/31 → 2/28）。丸めないと「1ヶ月より前」の境目が
 * 未来寄りにずれ、残すつもりの記録まで対象に入る。
 */
export function archiveCutoffDate(months: number, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const day = d.getDate()
  d.setMonth(d.getMonth() - months)
  if (d.getDate() !== day) d.setDate(0)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** 'YYYY-MM-DD' を「2026年8月2日」の形にする（確認文・画面表示用） */
export function formatArchiveDate(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${Number(y)}年${Number(m)}月${Number(d)}日`
}

/**
 * 記録1件のID。同じ記録を2回書き出しても1件にまとめる（追記型の重複排除）ための鍵で、
 * 「レシピ番号＋日付＋ひとことメモ」で作る。
 *
 * 料理名ではなくレシピ番号を使う理由: 同じ料理名のレシピを2品登録していると、名前で作った鍵が
 * 別レシピの記録どうしでぶつかる。ぶつかると①ファイルの中で2件が1件に潰れ、②「書き出した記録を
 * 端末から消す」が2件とも消すので、ファイルに入っていない記録まで消えてしまう。
 * 番号は端末の中で一意なので、この取り違えが起きない。
 *
 * seq は「同じレシピを同じ日に同じメモ（＝メモ無しどうし）で複数回記録した」場合の連番。
 * 内容が完全に同じ記録どうしを区別する手掛かりが他に無いため、並び順で2件目以降に
 * '#2' '#3' を付けて別件として残す（付けないと書き出した時点で1件に潰れてしまう）。
 */
export function buildArchiveLogId(
  recipeKey: string,
  date: string,
  note: string | undefined,
  seq: number,
): string {
  const base = `${recipeKey}\n${date}\n${note?.trim() ?? ''}`
  return seq > 0 ? `${base}#${seq + 1}` : base
}

/** 1つのまとまりの各記録にIDを割り当てる（返り値の並びは渡した記録と同じ） */
function archiveIdsForLogs(
  sourceKey: string,
  logs: readonly Pick<CookedLog, 'date' | 'note'>[],
): string[] {
  const seen = new Map<string, number>()
  return logs.map((log) => {
    const key = `${log.date}\n${log.note?.trim() ?? ''}`
    const seq = seen.get(key) ?? 0
    seen.set(key, seq + 1)
    return buildArchiveLogId(sourceKey, log.date, log.note, seq)
  })
}

/**
 * 1つのレシピの各記録にIDを割り当てる（返り値の並びは recipe.cookedLogs と同じ）。
 * 書き出すときと、書き出したあとに端末から消すときの両方で同じIDを作るために使う
 * （消す対象をIDで指定するので、両方で同じ手順で作らないと取り違える）。
 */
export function archiveIdsForRecipe(
  recipe: Pick<Recipe, 'id' | 'title' | 'cookedLogs'>,
): string[] {
  return archiveIdsForLogs(String(recipe.id ?? `?${recipe.title.trim()}`), recipe.cookedLogs)
}

/**
 * レシピを削除しても残った記録のまとまりの鍵（2026-08-16 便HC）。
 *
 * レシピ側の鍵（レシピ番号の数字）とも、IDを持たない行の鍵（'?'＋料理名）ともぶつからない形にする。
 * 印（recipeUid）があるときは印を使う: まとまりの番号は端末の中でしか通じず、
 * バックアップの「データを上書き」で振り直されるため、印の方が同じ記録に同じIDを付け続けられる。
 */
export function archiveDetachedKey(
  record: Pick<DetachedCookedRecord, 'id' | 'recipeUid'>,
): string {
  return record.recipeUid ? `u:${record.recipeUid}` : `d${record.id ?? '?'}`
}

/** 残った記録のまとまり1つぶんのIDを割り当てる（並びは record.logs と同じ） */
export function archiveIdsForDetached(
  record: Pick<DetachedCookedRecord, 'id' | 'recipeUid' | 'logs'>,
): string[] {
  return archiveIdsForLogs(archiveDetachedKey(record), record.logs)
}

/**
 * 端末にある「境目の日付より前の記録」を集める（日付の新しい順）。
 * 対象はレシピの中の記録と、レシピを削除しても残った記録の両方（2026-08-16 便HC）。
 * レシピ本体・境目以降の記録には触れない（この関数は選ぶだけで、消しはしない）。
 *
 * detachedRecords を省いても従来どおり動く（呼び出し側が1か所ずつ移れるように任意にしてある）。
 */
export function collectArchiveTargets(
  recipes: readonly Recipe[],
  cutoff: string,
  detachedRecords: readonly DetachedCookedRecord[] = [],
): ArchiveTarget[] {
  const targets: ArchiveTarget[] = []
  const collect = (
    source: ArchiveTarget['source'],
    sourceId: number,
    recipeTitle: string,
    logs: readonly CookedLog[],
    ids: readonly string[],
  ) => {
    logs.forEach((log, logIndex) => {
      if (log.date >= cutoff) return
      targets.push({ source, sourceId, recipeTitle, logIndex, log, id: ids[logIndex] })
    })
  }
  for (const recipe of recipes) {
    if (recipe.id == null) continue
    collect('recipe', recipe.id, recipe.title, recipe.cookedLogs, archiveIdsForRecipe(recipe))
  }
  for (const record of detachedRecords) {
    if (record.id == null) continue
    collect('detached', record.id, record.title, record.logs, archiveIdsForDetached(record))
  }
  return targets.sort(
    (a, b) => b.log.date.localeCompare(a.log.date) || a.recipeTitle.localeCompare(b.recipeTitle),
  )
}

/** 書き出し対象の件数を数える（記録・写真・品数・そのうち残った記録の件数） */
export function countArchiveTargets(targets: readonly ArchiveTarget[]): ArchiveTargetCounts {
  return {
    logs: targets.length,
    photos: targets.filter((t) => !!t.log.photo).length,
    // 同じ番号でもレシピ側と残った記録側は別の品なので、どちらの番号かまで含めて数える
    recipes: new Set(targets.map((t) => `${t.source}:${t.sourceId}`)).size,
    detachedLogs: targets.filter((t) => t.source === 'detached').length,
  }
}

/**
 * 「書き出した記録を端末から消す」の確認の中身（規約F: 何が消えて何が残るかを件数つきで両方書く）。
 *
 * 2026-08-16 便HC: 残った記録（レシピを削除しても残っている記録）も対象になったので、
 * 「残るもの」に無条件で書いていた「レシピ本体」を、**レシピの中の記録を消すときだけ**にした
 * （レシピの無い記録だけを消す場面で「レシピ本体は残ります」と言うと、消える記録の元レシピが
 * 端末に残っているかのように読める）。
 * 画面ではなくここで組み立てるのは、まとめて削除の確認文（logic/recipeDelete.ts）と同じ理由で、
 * 文の規則を1か所に集めて scripts/test-logic.mjs から測れるようにするため。
 */
export function buildArchiveDeleteConfirm(exported: {
  /** 消える記録の件数 */
  logs: number
  /** そのうち写真つきの枚数 */
  photos: number
  /** そのうち「レシピを削除しても残った記録」の件数 */
  detachedLogs: number
  /** 「◯ヶ月より前」の境目（YYYY-MM-DD） */
  cutoff: string
}): ConfirmContent {
  const t = ja.settings
  const keepsRecipeLogs = exported.logs > exported.detachedLogs
  return {
    title: t.archiveDeleteConfirmTitle,
    bullets: [
      {
        label: t.archiveDeleteConfirmGoneLabel,
        text: t.archiveDeleteConfirmGone
          .replace('{c}', String(exported.logs))
          .replace('{p}', String(exported.photos)),
      },
      {
        label: t.archiveDeleteConfirmKeptLabel,
        text: (keepsRecipeLogs
          ? t.archiveDeleteConfirmKept
          : t.archiveDeleteConfirmKeptDetachedOnly
        ).replace('{date}', formatArchiveDate(exported.cutoff)),
      },
    ],
    notes:
      exported.detachedLogs > 0
        ? [t.archiveDeleteConfirmDetachedNote.replace('{d}', String(exported.detachedLogs))]
        : [],
    confirmLabel: t.archiveDeleteConfirmOk,
  }
}

/** 記録の並び（日付の新しい順・同じ日は料理名順）。閲覧画面とファイルの中身の並びに使う */
export function sortArchivedLogs(logs: readonly ArchivedCookedLog[]): ArchivedCookedLog[] {
  return [...logs].sort(
    (a, b) => b.date.localeCompare(a.date) || a.recipeTitle.localeCompare(b.recipeTitle),
  )
}

/**
 * 前回のアーカイブファイルの中身と、今回書き出す記録を1つにまとめる（追記型）。
 * 同じIDの記録は1件だけ残す。写真は「片方にしか無ければ有る方を採る」
 * （前回は写真を含めずに書き出した、といった取りこぼしを次の書き出しで埋められるように）。
 */
export function mergeArchiveLogs(
  existing: readonly ArchivedCookedLog[],
  incoming: readonly ArchivedCookedLog[],
): ArchivedCookedLog[] {
  const byId = new Map<string, ArchivedCookedLog>()
  for (const log of [...existing, ...incoming]) {
    const found = byId.get(log.id)
    if (!found) {
      byId.set(log.id, log)
      continue
    }
    if (!found.photoBase64 && log.photoBase64) {
      byId.set(log.id, { ...found, photoBase64: log.photoBase64, photoType: log.photoType })
    }
  }
  return sortArchivedLogs([...byId.values()])
}

/** アーカイブファイルの中身を組み立てる（JSON文字列化は呼び出し側） */
export function buildArchiveFile(
  logs: readonly ArchivedCookedLog[],
  exportedAt: string = new Date().toISOString(),
): CookedLogArchiveFile {
  return {
    app: 'uchi-recipe',
    kind: ARCHIVE_KIND,
    version: 1,
    exportedAt,
    logs: sortArchivedLogs(logs),
  }
}

/**
 * アーカイブファイルの既定ファイル名（書き出し日基準。バックアップと名前で見分けられるようにする）。
 *
 * 2026-08-20 便IH・④（オーナー承認済み）で `uchi-recipe-records-` から `uchi-recipe-archive-` に
 * 変えた。アプリの中ではこのファイルを「アーカイブファイル」と呼んでいるのに、名前だけ
 * `records`（記録）で、同じものだと分からなかったため。ファイル名は日本語にしない
 * （PCによっては文字化け・並べ替えの不都合が出るため）。
 *
 * **名前が変わっても、古い名前のファイルはそのまま読める**。読み込みは中身の種別マーク
 * （kind: cooked-log-archive）だけを見ており、ファイル名は一切見ていない
 * （parseArchiveFile が受け取るのは中身の文字列だけ）。利用者が自分で付け替えた名前でも同じ。
 */
export function archiveFileName(date: Date = new Date()): string {
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `uchi-recipe-archive-${stamp}.json`
}

/**
 * 読み込んだファイルがアーカイブとして扱えないときの理由。
 * 'backup' … うちレシピのバックアップファイルだった（壊れてはいない。使う場所が違う）
 * 'invalid' … JSONとして読めない・うちレシピのファイルではない
 */
export class ArchiveFileError extends Error {
  reason: 'backup' | 'invalid'
  constructor(reason: 'backup' | 'invalid') {
    super(reason)
    this.reason = reason
  }
}

/** 読み込み結果。壊れた記録があっても、読めた分はそのまま使う（正直に件数を出すため） */
export interface ArchiveParseResult {
  logs: ArchivedCookedLog[]
  /** 読めなかった記録の件数（日付・料理名が欠けている行など） */
  brokenCount: number
  exportedAt?: string
}

/**
 * アーカイブファイルを読む。ファイル全体が読めないときだけ例外（ArchiveFileError）を投げ、
 * 1件ずつの記録は「読めたものは採る・読めなかったものは数える」で処理する
 * （途中の1件が壊れているだけで全部が読めなくなると、控えとしての役目を果たさないため）。
 * IDを持たない行（手で編集したファイルなど）は料理名・日付・メモから作り直す。
 */
export function parseArchiveFile(json: string): ArchiveParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new ArchiveFileError('invalid')
  }
  if (!data || typeof data !== 'object') throw new ArchiveFileError('invalid')
  const file = data as Partial<CookedLogArchiveFile> & { recipes?: unknown }
  if (file.kind !== ARCHIVE_KIND) {
    // バックアップファイル（種別マークが無く recipes を持つ）は言い分ける
    if (file.app === 'uchi-recipe' && Array.isArray(file.recipes)) {
      throw new ArchiveFileError('backup')
    }
    throw new ArchiveFileError('invalid')
  }
  if (!Array.isArray(file.logs)) throw new ArchiveFileError('invalid')

  const logs: ArchivedCookedLog[] = []
  const seen = new Map<string, number>()
  let brokenCount = 0
  for (const row of file.logs) {
    if (!row || typeof row !== 'object') {
      brokenCount++
      continue
    }
    const entry = row as Partial<ArchivedCookedLog>
    const date = typeof entry.date === 'string' ? entry.date : ''
    const recipeTitle = typeof entry.recipeTitle === 'string' ? entry.recipeTitle.trim() : ''
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !recipeTitle) {
      brokenCount++
      continue
    }
    const note = typeof entry.note === 'string' && entry.note ? entry.note : undefined
    let id = typeof entry.id === 'string' && entry.id ? entry.id : ''
    if (!id) {
      // IDが無い行（手で編集したファイルなど）は料理名から作り直す。端末側のID
      // （レシピ番号で始まる）とぶつからないよう、'?' を付けて別の形にする
      const recipeKey = `?${recipeTitle}`
      const key = `${recipeKey}\n${date}\n${note ?? ''}`
      const seq = seen.get(key) ?? 0
      seen.set(key, seq + 1)
      id = buildArchiveLogId(recipeKey, date, note, seq)
    }
    logs.push({
      id,
      date,
      recipeTitle,
      note,
      servings: typeof entry.servings === 'number' ? entry.servings : undefined,
      photoBase64: typeof entry.photoBase64 === 'string' ? entry.photoBase64 : undefined,
      photoType: typeof entry.photoType === 'string' ? entry.photoType : undefined,
    })
  }
  return {
    // 同じIDが二重に入っているファイル（手で編集したもの・別経路で足したもの）でも
    // 1件にまとめてから返す（閲覧の件数と、書き出しに引き継ぐ件数を一致させるため）
    logs: mergeArchiveLogs([], logs),
    brokenCount,
    exportedAt: typeof file.exportedAt === 'string' ? file.exportedAt : undefined,
  }
}

/** 閲覧画面で写真を出すためのデータURL（端末には保存せず、その場で表示するだけ） */
export function archivePhotoDataUrl(log: ArchivedCookedLog): string | undefined {
  if (!log.photoBase64) return undefined
  return `data:${log.photoType || 'image/jpeg'};base64,${log.photoBase64}`
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** 端末側の記録（写真はBlob）を、ファイルに入る形（写真はBase64）へ変換する */
export async function toArchivedLogs(
  targets: readonly ArchiveTarget[],
): Promise<ArchivedCookedLog[]> {
  return Promise.all(
    targets.map(async (target) => ({
      id: target.id,
      date: target.log.date,
      recipeTitle: target.recipeTitle,
      note: target.log.note || undefined,
      servings: target.log.servings,
      photoBase64: target.log.photo ? await blobToBase64(target.log.photo) : undefined,
      photoType: target.log.photo ? target.log.photo.type || undefined : undefined,
    })),
  )
}
