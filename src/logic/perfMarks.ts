/**
 * レシピ一覧の速さを測るための印（2026-09-01 便MV。調査Cの④A「?perf=1 のときだけ動く計器」）。
 *
 * URLに ?perf=1 が付いているときだけ動く（HashRouterなので http://…/?perf=1#/recipes の形）。
 * 普段の利用では active が false のまま＝どの関数も何もしない。
 *
 * 印は Performance API の performance.mark に残すだけで、**判定はここでは一切しない**
 * （しきい値を決めるのは測る側の仕事。端末差でしきい値は必ず荒れるため、アプリには持ち込まない）。
 * 測る側（Playwright等）は performance.getEntriesByType('mark') で回収する。
 * 「recipes:render:3」のような連番付きの印は、描画が何回走ったかを数えるためのもの。
 */

/** 計測が有効か（?perf=1 のときだけ true。判定はモジュール読み込み時の1回だけ） */
export const perfActive: boolean =
  typeof window !== 'undefined' &&
  (() => {
    try {
      return new URLSearchParams(window.location.search).get('perf') === '1'
    } catch {
      return false
    }
  })()

/** 「name:何度目か」を数えるための入れ物（計測が有効なときしか増えない） */
const counts = new Map<string, number>()

/** 名前付きの印を1つ残す（計測が無効なら何もしない） */
export function perfMark(name: string): void {
  if (!perfActive) return
  try {
    performance.mark(name)
  } catch {
    // 印を残せない環境でも、アプリの動きには関係ないので黙って何もしない
  }
}

/** 同じ名前の何度目かを数えて「name:n」の印を残す（描画回数の計測用） */
export function perfCountMark(name: string): void {
  if (!perfActive) return
  const n = (counts.get(name) ?? 0) + 1
  counts.set(name, n)
  perfMark(`${name}:${n}`)
}
