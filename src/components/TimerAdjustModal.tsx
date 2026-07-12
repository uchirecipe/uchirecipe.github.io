import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { ActiveTimer } from './TimerProvider'
import { formatRemaining } from '../logic/time'
import StepBadge from './StepBadge'
import { ja } from '../i18n/ja'

type Props = {
  /** 調整対象のタイマー。null なら窓を閉じたまま何も描画しない */
  timer: ActiveTimer | null
  /** 残り時間の計算用（TimerProvider の now をそのまま渡す） */
  now: number
  onAdjust: (deltaSeconds: number) => void
  onStop: () => void
  onClose: () => void
}

/**
 * 実行中タイマーの±調整の窓（2026-07-12タイマー自由設定・Fable設計docs/20 §6）。
 * 「作った！」記録の窓（CookedLogModal）と同じ様式（角丸カード・枠線・shadow-md・中央寄せ）で、
 * 常駐バー(TimerBar)・調理中モード(FocusMode)の動作中タイマー表示をタップすると開く。
 * 「+1分」「−30秒」「停止」の3操作のみを置く。背景タップ・×ボタン・Escapeで閉じる。
 */
export default function TimerAdjustModal({ timer, now, onAdjust, onStop, onClose }: Props) {
  useEffect(() => {
    if (!timer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [timer, onClose])

  if (!timer) return null

  const remaining = Math.max(0, Math.ceil((timer.endsAt - now) / 1000))

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.timer.adjustDialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{ja.timer.adjustDialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-[var(--space-sm)] flex items-center justify-center gap-2">
          <StepBadge number={timer.stepNumber > 0 ? timer.stepNumber : 'custom'} size={32} />
          <span className="min-w-0 truncate font-bold">{timer.label}</span>
        </div>
        <p className="mt-1 text-center text-4xl font-bold tabular-nums">
          {formatRemaining(remaining)}
        </p>
        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-30)}
            className="flex-1 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent shadow-sm"
          >
            {ja.timer.minusThirtySeconds}
          </button>
          <button
            type="button"
            onClick={() => onAdjust(60)}
            className="flex-1 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent shadow-sm"
          >
            {ja.timer.plusOneMinute}
          </button>
        </div>
        <button
          type="button"
          onClick={onStop}
          className="mt-[var(--space-sm)] w-full rounded-md border border-warning py-3 text-lg font-bold text-warning shadow-sm"
        >
          {ja.timer.stopTimer}
        </button>
      </div>
    </div>
  )
}
