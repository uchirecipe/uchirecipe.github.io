import { useEffect } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import { ja } from '../i18n/ja'

type Props = {
  open: boolean
  minutes: number
  onMinutesChange: (value: number) => void
  onStart: () => void
  onClose: () => void
}

const MIN_MINUTES = 1

/**
 * じぶんタイマー（自由な分数で始めるタイマー）の窓（2026-07-12タイマー自由設定・Fable設計docs/20 §6）。
 * 「作った！」記録の窓（CookedLogModal）と同じ様式。分数ステッパー(±1分)→「開始」で
 * 既存のタイマー機構(useTimers/startTimer)を呼び出す（呼び出し元が担当）。
 * 背景タップ・×ボタン・Escapeで閉じる。
 */
export default function CustomTimerModal({ open, minutes, onMinutesChange, onStart, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.timer.customLabel}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{ja.timer.customLabel}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-[var(--space-sm)] flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onMinutesChange(Math.max(MIN_MINUTES, minutes - 1))}
            aria-label={ja.timer.customMinutesDown}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
          >
            <Minus size={22} aria-hidden />
          </button>
          <span className="min-w-20 text-center text-2xl font-bold tabular-nums">
            {minutes}
            {ja.detail.minutesSuffix}
          </span>
          <button
            type="button"
            onClick={() => onMinutesChange(minutes + 1)}
            aria-label={ja.timer.customMinutesUp}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
          >
            <Plus size={22} aria-hidden />
          </button>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 text-lg font-bold text-app shadow-sm"
        >
          {ja.timer.customStart}
        </button>
      </div>
    </div>
  )
}
