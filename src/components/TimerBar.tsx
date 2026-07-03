import { X, Timer as TimerIcon, BellRing } from 'lucide-react'
import { useTimers } from './TimerProvider'
import { formatRemaining } from '../logic/time'
import { ja } from '../i18n/ja'

/** 起動中タイマーの常駐表示（タブナビのすぐ上に出る。どの画面でも見える） */
export default function TimerBar() {
  const { timers, now, dismissTimer } = useTimers()
  if (timers.length === 0) return null

  return (
    <div
      className="fixed inset-x-0 z-10"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-w-md space-y-1 px-[var(--space-sm)]">
        {timers.map((timer) => {
          const remaining = Math.ceil((timer.endsAt - now) / 1000)
          return (
            <div
              key={timer.id}
              className={`flex items-center gap-2 rounded-md border px-[var(--space-md)] py-2 shadow-md ${
                timer.done
                  ? 'border-warning bg-surface text-warning'
                  : 'border-edge bg-surface'
              }`}
            >
              {timer.done ? (
                <BellRing size={20} className="shrink-0 animate-pulse" aria-hidden />
              ) : (
                <TimerIcon size={20} className="shrink-0 text-accent" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">
                {timer.label}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {timer.done ? ja.timer.done : formatRemaining(remaining)}
              </span>
              <button
                type="button"
                onClick={() => dismissTimer(timer.id)}
                aria-label={ja.timer.dismiss}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
