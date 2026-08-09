/**
 * 押すと文言が入れ替わるボタンで、**ボタンの幅を変えない**ためのラベル（2026-08-09 便EO）。
 *
 * オーナー実機「ボタンも押下後にサイズが変わって場所がズレるので、誤操作や見失いの元に
 * なってる。基本的にサイズと位置は変えないで」。
 *
 * 「開く」→「閉じる」のように文字数が変わると、ボタンの幅が変わって隣のボタンまで動く。
 * ここでは候補の文言をすべて同じ場所に重ねて置き、いま出す1つ以外を見えなくする。
 * こうすると**一番長い文言の幅**でボタンが確定し、どちらの状態でも1pxも動かない。
 * 文字数をそろえて書き直す手もあるが、それだと文言の選択肢が狭まる（規約H）ので、
 * 文言は分かりやすさで選び、幅は仕組みで固定する。
 *
 * 見えない側は `visibility: hidden`＋`aria-hidden` の二重で外す＝読み上げにも
 * ボタンの読み上げ名にも入らない。
 */
export default function SwapLabel({
  current,
  labels,
  className,
}: {
  /** いま出す文言（labels に含めておく） */
  current: string
  /** この場所に入りうる文言すべて。幅はこの中で一番長いものにそろう */
  labels: readonly string[]
  className?: string
}) {
  // 同じ文言が重複していても場所は1つでよい
  const all = labels.includes(current) ? [...new Set(labels)] : [...new Set([...labels, current])]
  return (
    <span className={`grid justify-items-center ${className ?? ''}`}>
      {all.map((label) => {
        const shown = label === current
        return (
          <span
            key={label}
            aria-hidden={shown ? undefined : true}
            className={`col-start-1 row-start-1 whitespace-nowrap ${shown ? '' : 'invisible'}`}
          >
            {label}
          </span>
        )
      })}
    </span>
  )
}
