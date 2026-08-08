import { Timer } from 'lucide-react'

type Props = {
  /** 'custom' = 手順に紐付かないタイマー(ja.timer.customLabel「タイマー」)用。数字の代わりにタイマーアイコンを出す */
  number: number | 'custom'
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
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
        color ? '' : 'bg-accent text-on-accent'
      }`}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.5),
        ...(color ? { backgroundColor: color, color: 'var(--chip-ink)' } : {}),
      }}
    >
      {number === 'custom' ? <Timer size={Math.round(size * 0.55)} aria-hidden /> : number}
    </span>
  )
}
