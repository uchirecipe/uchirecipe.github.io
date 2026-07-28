/**
 * 「URLから取り込む」の失敗理由の判定(2026-07-28 便BX/C05)。
 *
 * urlImport.ts(IMPORT_ENDPOINTの解決に import.meta.env を使う)とは独立させ、vite依存ゼロに
 * してある(urlImportImage.ts と同じ理由・同じ作法。scripts/test-logic.mjs から tsx で直接
 * テストできるようにするため)。
 *
 * 背景: Worker(workers/recipe-import/src/index.ts)は上流の非2xxをすべて error:'fetch_failed'
 * に丸めていたため、恒久的な404・サイト側の拒否(403)・一時的な通信不調が同じ文言
 * 「読み込めませんでした。時間をおいて試すか…」に潰れていた。「時間をおいて試す」は404では
 * 絶対に解決しないため、Workerが添えるようにした上流ステータス(status)を使ってここで細分化する。
 */

/**
 * 取り込み失敗の理由。Workerが返すのは fetch_failed / no_recipe / invalid_url の3つで、
 * not_found・blocked は上流HTTPステータスからこちら側で細分化したもの。
 */
export type ImportErrorReason =
  | 'fetch_failed'
  | 'no_recipe'
  | 'invalid_url'
  | 'not_found'
  | 'blocked'

/** 恒久的に「そのURLでは取れない」= URLを直すべきステータス(404 Not Found / 410 Gone) */
const NOT_FOUND_STATUSES = new Set([404, 410])

/**
 * サイト側が取り込みを拒否しているステータス。時間をおいても変わらないので
 * 「待つ」ではなく貼り付けへ案内する(白ごはん.com・クラシル・DELISH KITCHENが実測で403)。
 */
const BLOCKED_STATUSES = new Set([401, 403, 451])

/** Workerが返しうる error 値(それ以外の未知の値は fetch_failed 扱いにする) */
const KNOWN_REASONS = new Set<ImportErrorReason>(['fetch_failed', 'no_recipe', 'invalid_url'])

/**
 * Worker応答の error と上流ステータスから、文言を出し分けられる粒度の理由に落とす。
 * status は fetch_failed のときだけ意味を持つ(no_recipe/invalid_url は上流に到達した/しない
 * 以前の判断なので、ステータスで上書きしない)。
 */
export function resolveImportErrorReason(error: unknown, status?: unknown): ImportErrorReason {
  const reason =
    typeof error === 'string' && KNOWN_REASONS.has(error as ImportErrorReason)
      ? (error as ImportErrorReason)
      : 'fetch_failed'
  if (reason !== 'fetch_failed' || typeof status !== 'number') return reason
  if (NOT_FOUND_STATUSES.has(status)) return 'not_found'
  if (BLOCKED_STATUSES.has(status)) return 'blocked'
  return 'fetch_failed'
}
