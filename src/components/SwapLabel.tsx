/**
 * 押すと文言が入れ替わるボタンで、**ボタンの幅を変えない**ためのラベル（2026-08-09 便EO）。
 *
 * オーナー実機「ボタンも押下後にサイズが変わって場所がズレるので、誤操作や見失いの元に
 * なってる。基本的にサイズと位置は変えないで」。
 *
 * 「開く」→「閉じる」のように文字数が変わると、ボタンの幅が変わって隣のボタンまで動く。
 * ここでは**両方の文言を同じ場所に重ねて置き、幅だけを長い方に合わせる**。
 * 重ねる側は `::before` / `::after` の content で描く＝画面上の文字（textContent）は
 * いま出している1つだけになるので、
 *  ・ページ内検索やコピーに、出していない方の文言が混ざらない
 *  ・読み上げ・ボタンの読み上げ名にも入らない（visibility: hidden で外れる）
 * 文字数をそろえて書き直す手もあるが、それだと文言の選び方が狭まる（規約H）ので、
 * 文言は分かりやすさで選び、幅は仕組みで固定する。
 */
export default function SwapLabel({
  current,
  labels,
  className,
}: {
  /** いま出す文言 */
  current: string
  /** この場所に入りうる2つの文言。幅はこの2つと current のうち一番広いものにそろう */
  labels: readonly [string, string]
  className?: string
}) {
  return (
    <span
      data-swap-a={labels[0]}
      data-swap-b={labels[1]}
      className={`grid justify-items-center before:invisible before:col-start-1 before:row-start-1 before:whitespace-nowrap before:content-[attr(data-swap-a)] after:invisible after:col-start-1 after:row-start-1 after:whitespace-nowrap after:content-[attr(data-swap-b)] ${className ?? ''}`}
    >
      <span className="col-start-1 row-start-1 whitespace-nowrap">{current}</span>
    </span>
  )
}
