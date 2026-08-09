/**
 * 「押したら画面が伸びた」ときに、伸びた部分を画面の中へ入れるための共通処理
 * （2026-08-09 便EO・オーナー実機フィードバック③）。
 *
 * オーナーの指摘: 「折りたたみや編集押下後など、画面が伸びるときには、伸びた部分が画面内に
 * 収まるように移動して欲しい。伸びる部分が大きくて画面内に収まらない場合には上を基準に
 * 表示したい。編集ボタンを押しても編集画面が画面外に見切れてしまうため」
 *
 * 決めごと:
 *  - 伸びた部分がすでに全部見えているなら**何もしない**（勝手に動かさない）
 *  - 下にはみ出しているだけなら、はみ出した分だけスクロールして下端を入れる
 *  - 画面に収まらない大きさなら、伸びた部分の**上端**を画面の上にそろえる
 *  - 上部に貼り付く帯（レシピ詳細のヘッダー・設定/買い物の目次）と、下部に固定される帯
 *    （タブナビ・タイマー）の裏に潜り込まないよう、その分を除いた範囲を「画面内」とみなす。
 *    帯には `data-app-top-bar` / `data-app-bottom-bar` を付けてある
 *  - 動きを減らす設定（prefers-reduced-motion）のときは、なめらかスクロールをやめて一瞬で移動する
 */

/** 伸びた部分と画面の縁のあいだに残す余白（px）。ぴったり付けると見切れて見えるため */
const EDGE_GAP = 8

/** 動きを減らす設定かどうか（設定が無い環境では false） */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 画面上部に貼り付いている帯の下端（＝ここから下が「見えている範囲」）。
 *
 * 2026-08-09 便ET: 貼り付く帯（position: sticky）は、いま画面の途中にあっても
 * **下へスクロールすれば必ず上端に来る**。「今この瞬間に上端にあるか」だけで数えていると、
 * 画面の一番上から折りたたみを開いたときに「帯はまだ下、だから邪魔者なし」と判断して
 * スクロールし、動き終わったあとに貼り付いた帯が開いた中身の頭を隠してしまう。
 * そこで、伸びた領域より上にある sticky の帯は、貼り付いたときの高さ（top＋帯の高さ）を
 * 先に見込んでおく。
 *
 * @param target 伸びた領域。これより下にある帯は（スクロールしても上には来ないので）数えない
 */
function topBarInset(target?: HTMLElement): number {
  let inset = 0
  const targetTop = target ? target.getBoundingClientRect().top : Number.POSITIVE_INFINITY
  for (const bar of document.querySelectorAll<HTMLElement>('[data-app-top-bar]')) {
    const r = bar.getBoundingClientRect()
    if (r.height <= 0) continue
    const style = getComputedStyle(bar)
    if (style.position === 'sticky') {
      const stuckTop = Number.parseFloat(style.top)
      // 貼り付き先が数値で決まっていて、かつ帯が伸びた領域より上にある（＝下へ動けば頭を隠す）
      if (Number.isFinite(stuckTop) && r.top < targetTop) {
        inset = Math.max(inset, stuckTop + r.height)
        continue
      }
    }
    // 今まさに画面の上に貼り付いている帯だけを数える（流れて下にある間は邪魔をしない）
    if (r.top <= 2) inset = Math.max(inset, r.bottom)
  }
  return Math.max(0, inset)
}

/** 画面下部に固定されている帯の高さの合計（タブナビ・タイマーの浮遊バー） */
function bottomBarInset(): number {
  const vh = window.innerHeight
  let inset = 0
  for (const bar of document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]')) {
    const r = bar.getBoundingClientRect()
    if (r.height > 0 && r.top < vh) inset = Math.max(inset, vh - r.top)
  }
  return Math.max(0, inset)
}

/** 自分を実際にスクロールさせている親（窓の中など）。無ければ null＝ページ全体 */
function scrollParentOf(el: HTMLElement): HTMLElement | null {
  let p: HTMLElement | null = el.parentElement
  while (p && p !== document.body && p !== document.documentElement) {
    const overflowY = getComputedStyle(p).overflowY
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      p.scrollHeight > p.clientHeight + 1
    ) {
      return p
    }
    p = p.parentElement
  }
  return null
}

/**
 * 伸びた領域 `el` を画面の中へ入れる。動かす必要が無ければ何もしない。
 * @param el      伸びた（新しく現れた）領域そのもの
 * @param instant true ならなめらかスクロールを使わない
 */
export function revealExpanded(el: HTMLElement, instant = prefersReducedMotion()): void {
  if (typeof window === 'undefined') return
  const rect = el.getBoundingClientRect()
  // まだ高さが無い（閉じている・描画前）ときは対象外
  if (rect.height < 1) return

  const container = scrollParentOf(el)
  let viewTop: number
  let viewBottom: number
  if (container) {
    const cr = container.getBoundingClientRect()
    viewTop = cr.top + EDGE_GAP
    viewBottom = cr.bottom - EDGE_GAP
  } else {
    viewTop = topBarInset(el) + EDGE_GAP
    viewBottom = window.innerHeight - bottomBarInset() - EDGE_GAP
  }
  const viewHeight = viewBottom - viewTop
  if (viewHeight <= 0) return

  let delta = 0
  if (rect.height > viewHeight || rect.top < viewTop) {
    // 画面に収まらない大きさ／上にはみ出している → 上端を基準にそろえる
    delta = rect.top - viewTop
  } else if (rect.bottom > viewBottom) {
    // 下にはみ出しているだけ → はみ出した分だけ送る（上端は必ず画面内に残る）
    delta = rect.bottom - viewBottom
  }
  if (Math.abs(delta) < 1) return

  const behavior: ScrollBehavior = instant ? 'auto' : 'smooth'
  if (container) container.scrollBy({ top: delta, behavior })
  else window.scrollBy({ top: delta, behavior })
}
