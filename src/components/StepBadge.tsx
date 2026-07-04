type Props = {
  number: number
  size?: number
}

/** 手順番号の丸バッジ。レシピ詳細・フォーカスモード・タイマー表示で共通の見た目にする */
export default function StepBadge({ number, size = 32 }: Props) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-accent font-bold text-app"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
    >
      {number}
    </span>
  )
}
