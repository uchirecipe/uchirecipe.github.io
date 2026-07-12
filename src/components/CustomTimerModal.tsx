import { useEffect } from 'react'
import { X, Minus, Plus } from 'lucide-react'
import { ja } from '../i18n/ja'
import { formatMinutesSecondsLabel } from '../logic/time'

type Props = {
  open: boolean
  totalSeconds: number
  onSecondsChange: (value: number) => void
  onStart: () => void
  onClose: () => void
}

// 開始前に設定できる最小値(秒)。0秒タイマーを作れてしまわないための床
const MIN_SECONDS = 10

/**
 * じぶんタイマー（自由な分数で始めるタイマー）の窓（2026-07-12タイマー自由設定・Fable設計docs/20 §6）。
 * 「作った！」記録の窓（CookedLogModal）と同じ様式。中央の±1分(アイコンのみ、既存どおり)に加えて、
 * ±30秒・±10秒のボタン行を追加（同日オーナー実機フィードバックで秒刻み対応）。
 * ±1分をあえてアイコンのまま（テキスト化しない）にしているのは、表示中の残り時間そのものに
 * 「1分」「3分」のような文字列が出るため、ボタンにも同じ文字列を乗せるとE2Eの
 * テキスト一致チェックが紛らわしくなる（表示なのかボタンなのか判別できない）ため。
 * →「開始」で既存のタイマー機構(useTimers/startTimer)を呼び出す（呼び出し元が担当）。
 * 背景タップ・×ボタン・Escapeで閉じる。
 */
export default function CustomTimerModal({
  open,
  totalSeconds,
  onSecondsChange,
  onStart,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const adjust = (deltaSeconds: number) => {
    onSecondsChange(Math.max(MIN_SECONDS, totalSeconds + deltaSeconds))
  }

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
            onClick={() => adjust(-60)}
            aria-label={ja.timer.customMinutesDown}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
          >
            <Minus size={22} aria-hidden />
          </button>
          <span className="min-w-24 text-center text-2xl font-bold tabular-nums">
            {formatMinutesSecondsLabel(totalSeconds)}
          </span>
          <button
            type="button"
            onClick={() => adjust(60)}
            aria-label={ja.timer.customMinutesUp}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
          >
            <Plus size={22} aria-hidden />
          </button>
        </div>
        {/* 秒刻み調整(2026-07-12追加分)。±1分の下に小さめのボタンで並べる */}
        <div className="mt-[var(--space-sm)] grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => adjust(-30)}
            className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
          >
            {ja.timer.minusThirtySeconds}
          </button>
          <button
            type="button"
            onClick={() => adjust(-10)}
            className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
          >
            {ja.timer.minusTenSeconds}
          </button>
          <button
            type="button"
            onClick={() => adjust(10)}
            className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
          >
            {ja.timer.plusTenSeconds}
          </button>
          <button
            type="button"
            onClick={() => adjust(30)}
            className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
          >
            {ja.timer.plusThirtySeconds}
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
