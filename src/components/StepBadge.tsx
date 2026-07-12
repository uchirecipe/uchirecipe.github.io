import { Timer } from 'lucide-react'

type Props = {
  /** 'custom' = 手順に紐付かないタイマー(じぶんタイマー)用。数字の代わりにタイマーアイコンを出す */
  number: number | 'custom'
  size?: number
}

/** 手順番号の丸バッジ。レシピ詳細・調理中モード・タイマー表示で共通の見た目にする */
export default function StepBadge({ number, size = 32 }: Props) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-app"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {number === 'custom' ? <Timer size={Math.round(size * 0.55)} aria-hidden /> : number}
    </span>
  )
}
