import type { ReactNode } from 'react'
import { Timer as TimerIcon } from 'lucide-react'
import { findTimeTokens } from '../logic/time'
import { ja } from '../i18n/ja'

type Props = {
  text: string
  /** 時間表記をタップしたときに呼ばれる（タイマー開始） */
  onStart: (tokenText: string, seconds: number) => void
}

/**
 * 手順の文章を表示し、「10分」「1時間半」などの時間表記だけを
 * タップできるボタンに変える。
 */
export default function TimeText({ text, onStart }: Props) {
  const tokens = findTimeTokens(text)
  if (tokens.length === 0) return <>{text}</>

  const parts: ReactNode[] = []
  let cursor = 0
  tokens.forEach((token, i) => {
    if (token.start > cursor) parts.push(text.slice(cursor, token.start))
    parts.push(
      <button
        key={i}
        type="button"
        onClick={() => onStart(token.text.trim(), token.seconds)}
        aria-label={`${token.text.trim()} ${ja.timer.start}`}
        className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-bold text-accent underline underline-offset-2"
        style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
      >
        <TimerIcon size={16} aria-hidden />
        {token.text.trim()}
      </button>,
    )
    cursor = token.start + token.text.length
  })
  if (cursor < text.length) parts.push(text.slice(cursor))

  return <>{parts}</>
}
