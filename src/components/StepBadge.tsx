import { Timer } from 'lucide-react'

type Props = {
  /**
   * 'custom' = 手順に紐付かないタイマー(ja.timer.customLabel「タイマー」)用。数字の代わりに
   * タイマーアイコンを出す。文字列（'3-1' 等）は、レシピの1手順を段取りの上で2つに分けたときの
   * 番号（2026-08-09 便ES・オーナー指示D-4）。桁が増えるので丸ではなく角丸の楕円で描く
   */
  number: number | string | 'custom'
  size?: number
  /**
   * 塗りの色（既定はアクセント色）。並行調理ナビの「レシピごとの手順番号」だけ、
   * そのレシピの色で描いて全体の通し番号と見分けられるようにする（2026-08-09 便EH・
   * オーナー案「番号だけ分けて、オレンジの手順番号の各色バージョンで一回り小さく」）。
   */
  color?: string
}

/** 手順番号の丸バッジ。レシピ詳細・調理中モード・タイマー表示で共通の見た目にする */
export default function StepBadge({ number, size = 32, color }: Props) {
  // 「3-1」のように2文字を超える番号は、丸のままだと文字が潰れる。横に伸ばして読めるようにする
  const label = typeof number === 'string' && number !== 'custom' ? number : null
  const wide = label != null && label.length > 2
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
        color ? '' : 'bg-accent text-on-accent'
      }`}
      style={{
        width: wide ? 'auto' : size,
        minWidth: size,
        height: size,
        ...(wide ? { paddingLeft: Math.round(size * 0.2), paddingRight: Math.round(size * 0.2) } : {}),
        fontSize: Math.round(size * (wide ? 0.42 : 0.5)),
        ...(color ? { backgroundColor: color, color: 'var(--chip-ink)' } : {}),
      }}
    >
      {number === 'custom' ? <Timer size={Math.round(size * 0.55)} aria-hidden /> : number}
    </span>
  )
}
