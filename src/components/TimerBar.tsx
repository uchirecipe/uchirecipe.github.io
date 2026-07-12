import { useState } from 'react'
import { X, BellRing, Bell, BellOff } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTimers } from './TimerProvider'
import { formatRemaining } from '../logic/time'
import StepBadge from './StepBadge'
import TimerAdjustModal from './TimerAdjustModal'
import { ja } from '../i18n/ja'

/** 起動中タイマーの常駐表示（タブナビのすぐ上に出る。どの画面でも見える） */
export default function TimerBar() {
  const {
    timers,
    now,
    flashingId,
    showFirstTimeNotice,
    dismissFirstTimeNotice,
    dismissTimer,
    toggleMute,
    adjustTimer,
  } = useTimers()
  const navigate = useNavigate()
  // ±調整の窓（2026-07-12タイマー自由設定）: どのタイマーを調整中か
  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  const adjustingTimer = timers.find((t) => t.id === adjustingId) ?? null
  if (timers.length === 0) return null

  /** タップで該当レシピの該当手順へ（詳細画面側でスクロール＆一時ハイライトする） */
  const goToStep = (recipeId: number, stepNumber: number) => {
    navigate(`/recipes/${recipeId}?step=${stepNumber}`)
  }

  return (
    <div
      className="fixed inset-x-0 z-10"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-h-[38vh] max-w-md space-y-1 overflow-y-auto px-[var(--space-sm)]">
        {showFirstTimeNotice && (
          <div className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-xs text-ink-muted shadow-md">
            <span className="min-w-0 flex-1">{ja.timer.notice}</span>
            <button
              type="button"
              onClick={dismissFirstTimeNotice}
              aria-label={ja.focus.close}
              className="shrink-0"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
        {timers.map((timer) => {
          const remaining = Math.ceil((timer.endsAt - now) / 1000)
          const isFlashing = flashingId === timer.id
          // ±調整の窓を開くボタンの読み上げ名（複数タイマー同時進行でも区別できるよう手順番号を含める。
          // 手順に紐付かないじぶんタイマーはラベルのみ）
          const adjustAriaLabel = ja.timer.adjustOpenAria.replace(
            '{label}',
            timer.stepNumber > 0
              ? `${timer.label}・${ja.timer.stepLabel.replace('{n}', String(timer.stepNumber))}`
              : timer.label,
          )
          return (
            <button
              key={timer.id}
              type="button"
              onClick={() =>
                timer.done ? goToStep(timer.recipeId, timer.stepNumber) : setAdjustingId(timer.id)
              }
              aria-label={timer.done ? undefined : adjustAriaLabel}
              className={`flex w-full items-center gap-2 rounded-md border px-[var(--space-md)] py-2 text-left shadow-md transition-transform ${
                timer.done
                  ? 'border-warning bg-surface text-warning'
                  : 'border-edge bg-surface'
              } ${isFlashing ? 'animate-pulse ring-2 ring-accent' : ''}`}
            >
              <StepBadge number={timer.stepNumber > 0 ? timer.stepNumber : 'custom'} size={28} />
              {timer.done && <BellRing size={18} className="shrink-0 animate-pulse" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{timer.label}</span>
              <span className="text-lg font-bold tabular-nums">
                {timer.done ? timer.doneLabel : formatRemaining(remaining)}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleMute(timer.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    e.preventDefault()
                    toggleMute(timer.id)
                  }
                }}
                aria-label={timer.muted ? ja.timer.unmute : ja.timer.mute}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-muted"
              >
                {timer.muted ? <BellOff size={18} aria-hidden /> : <Bell size={18} aria-hidden />}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation()
                  dismissTimer(timer.id)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    e.preventDefault()
                    dismissTimer(timer.id)
                  }
                }}
                aria-label={ja.timer.dismiss}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-muted"
              >
                <X size={20} aria-hidden />
              </span>
            </button>
          )
        })}
      </div>
      <TimerAdjustModal
        timer={adjustingTimer}
        now={now}
        onAdjust={(delta) => {
          if (adjustingId !== null) adjustTimer(adjustingId, delta)
        }}
        onStop={() => {
          if (adjustingId !== null) dismissTimer(adjustingId)
          setAdjustingId(null)
        }}
        onClose={() => setAdjustingId(null)}
      />
    </div>
  )
}
