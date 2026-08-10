/**
 * 画面下部に固定されている帯（タブナビ・タイマーの常駐バー・新しいバージョンのお知らせ）が
 * いま何px使っているかを測り、ページ側の下余白をそれに追随させる仕組み（2026-08-11 便FN）。
 *
 * 直したバグ（利用者テスト・実機報告）:
 *   タイマーを2本動かして献立の画面を開くと、画面下のタイマーの帯2本で「作った記録の一覧」が
 *   完全に隠れて押せない。お知らせの帯も出ていると「全て作った！」「並行調理ナビ」まで隠れる。
 *
 * 真因: ページの下余白が固定値だった。全ページを包む `<main>` は `pb-24`（96px）で
 * **タブナビ1本分しか見込んでいない**。タイマーの帯はタブナビの上に重なって出るうえ、
 * 高さが本数・お知らせの有無で変わる（1本あたり約48px＋間隔・最大で画面の38%）ため、
 * 固定値ではどう置いても足りない日が出る。一部のページが持っていた `pb-48`（192px）も
 * 同じ理由の当て推量で、3本目からは足りない。
 *
 * 直し方: 帯の実際の高さを測って CSS変数 `--app-bottom-inset` に入れ、下余白はこれを使う。
 * 帯には便ETの `data-app-bottom-bar` が付いているので、測る対象はその印だけで決まる
 * （新しい帯を足すときはこの印を付ければ、余白は自動でついてくる）。
 */

/** ページの下余白が読む CSS変数の名前。既定値は src/index.css の :root に置いてある */
export const BOTTOM_INSET_VAR = '--app-bottom-inset'

/**
 * 画面下部に固定されている帯が使っている高さ（px）。
 * 帯どうしは重なって置かれる（タイマーの帯はタブナビの上に乗る）ので、合計ではなく
 * **いちばん上まで来ている帯の下端から画面の下端まで**を採る。
 */
export function measureBottomBarInset(): number {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0
  const vh = window.innerHeight
  let inset = 0
  for (const bar of document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]')) {
    const r = bar.getBoundingClientRect()
    if (r.height > 0 && r.top < vh) inset = Math.max(inset, vh - r.top)
  }
  return Math.max(0, inset)
}

/**
 * 帯の増減・高さの変化を見張って `--app-bottom-inset` を書き換え続ける。戻り値を呼ぶと止まる。
 *
 * 見張る対象:
 *   - 帯そのものが出入りする（タイマーが1本目で現れ、最後の1本を消すと消える）… MutationObserver
 *   - 帯の高さが変わる（タイマーが増える・初回の案内が出る・折り返す）        … ResizeObserver
 *   - 画面の向き・大きさが変わる                                              … resize イベント
 *
 * 文字の変化（残り時間のカウントダウン）は監視しない（`characterData` を見ない）。
 * 1秒ごとに測り直すと台所で使う画面が無駄に忙しくなるうえ、高さは変わらないため。
 */
export function watchBottomBarInset(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {}
  const root = document.documentElement
  let frame = 0
  let observed: HTMLElement[] = []

  const schedule = () => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(apply)
  }

  const resizeObserver =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null

  function apply() {
    frame = 0
    const bars = Array.from(document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]'))
    // 帯の顔ぶれが変わったときだけ貼り直す（毎回貼り直すと ResizeObserver が鳴り続ける）
    if (
      resizeObserver &&
      (bars.length !== observed.length || bars.some((bar, i) => bar !== observed[i]))
    ) {
      resizeObserver.disconnect()
      for (const bar of bars) resizeObserver.observe(bar)
      observed = bars
    }
    const inset = Math.round(measureBottomBarInset())
    // 帯が1本も見つからないとき（描画前など）は書き込まず、index.css の既定値に任せる。
    // 0pxを書き込むと、タブナビの裏に中身が潜り込んだ画面をそのまま出してしまう
    if (inset > 0) root.style.setProperty(BOTTOM_INSET_VAR, `${inset}px`)
    else root.style.removeProperty(BOTTOM_INSET_VAR)
  }

  apply()
  const mutationObserver = new MutationObserver(schedule)
  mutationObserver.observe(document.body, { childList: true, subtree: true })
  window.addEventListener('resize', schedule)
  window.addEventListener('orientationchange', schedule)

  return () => {
    if (frame !== 0) window.cancelAnimationFrame(frame)
    mutationObserver.disconnect()
    resizeObserver?.disconnect()
    window.removeEventListener('resize', schedule)
    window.removeEventListener('orientationchange', schedule)
    root.style.removeProperty(BOTTOM_INSET_VAR)
  }
}
