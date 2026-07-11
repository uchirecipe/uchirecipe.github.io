import type { ReactNode } from 'react'
import { Timer as TimerIcon } from 'lucide-react'
import { findTimeTokens } from '../logic/time'
import { wrapJaPhrases, ZWSP } from '../logic/jaWrap'
import { ja } from '../i18n/ja'

type Props = {
  text: string
  /** 時間表記をタップしたときに呼ばれる（タイマー開始） */
  onStart: (tokenText: string, seconds: number) => void
}

/**
 * 手順の文章を表示し、「10分」「1時間半」などの時間表記だけを
 * タップできるボタンに変える。文章部分はBudouXで文節折返しにする。
 * タイマーボタンは直後の文節(7文字以下)と結合し、「5分/とろみを付ける」のような
 * ボタン直後での折返しを防ぐ(2026-07-11オーナー指摘)。
 */
export default function TimeText({ text, onStart }: Props) {
  const tokens = findTimeTokens(text)
  if (tokens.length === 0) return <>{wrapJaPhrases(text)}</>

  const parts: ReactNode[] = []
  let cursor = 0
  tokens.forEach((token, i) => {
    if (token.start > cursor) parts.push(wrapJaPhrases(text.slice(cursor, token.start)))
    const button = (
      <button
        type="button"
        onClick={() => onStart(token.text.trim(), token.seconds)}
        aria-label={`${token.text.trim()} ${ja.timer.start}`}
        className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-bold text-accent underline underline-offset-2"
        style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
      >
        <TimerIcon size={16} aria-hidden />
        {token.text.trim()}
      </button>
    )
    const afterEnd = i + 1 < tokens.length ? tokens[i + 1].start : text.length
    const after = text.slice(token.start + token.text.length, afterEnd)
    const units = after ? wrapJaPhrases(after).split(ZWSP) : []
    if (units.length > 0 && units[0].length > 0 && units[0].length <= 7) {
      // ボタンと直後の文節をひとかたまりに(折返し禁止)
      parts.push(
        <span key={i} className="whitespace-nowrap">
          {button}
          {units[0]}
        </span>,
      )
      if (units.length > 1) parts.push(units.slice(1).join(ZWSP))
    } else {
      parts.push(<span key={i}>{button}</span>)
      if (after) parts.push(wrapJaPhrases(after))
    }
    cursor = afterEnd
  })

  return <>{parts}</>
}
