import { useState } from 'react'
import { X, BellRing, Bell, BellOff } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTimers, type ActiveTimer } from './TimerProvider'
import { hasCookNaviTimeline } from '../logic/cookNaviSession'
import { naviRecipeColor } from '../logic/naviColors'
import { formatRemaining } from '../logic/time'
import { sortTimersForDisplay } from '../logic/timerOrder'
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
  const location = useLocation()
  // ±調整の窓（2026-07-12タイマー自由設定）: どのタイマーを調整中か
  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  const adjustingTimer = timers.find((t) => t.id === adjustingId) ?? null
  if (timers.length === 0) return null

  // 表示順(2026-07-28 機能④診断C6): 以前は起動順のままで、先に鳴るタイマーが最下段に
  // 来ることがあり「どれが一番先に終わるか」を毎回数字で読み比べる必要があった。
  // 終わったもの→残りが少ない順に並べる。TimerProvider の配列自体は触らず表示用の
  // コピーだけ並べ替える(key={timer.id} なので並べ替えでタイマーの状態は壊れない)
  const sortedTimers = sortTimersForDisplay(timers)

  /**
   * 完了タイマーのタップで該当レシピの該当手順へ。
   * 通常は単品レシピ詳細（?step=）へ飛んで詳細画面側でスクロール＆一時ハイライトする。
   * ただし並行調理ナビ実行中は、常駐バーは元々レシピ詳細向けの設計なので詳細へ離脱させず、
   * ナビ内に同じ手順カードが表示されていればナビ内でスクロール＆ハイライトして文脈に留める
   * （2026-07-23便BI。バグ修正: ナビ実行中に完了タイマーをタップすると単品詳細へ飛ばされ
   * ナビから離脱していた）。ナビにその手順が無い（別の組み合わせで再構築した・タイムライン
   * を畳んだ等）ときは従来どおり詳細へフォールバックする。
   */
  const goToStep = (timer: ActiveTimer) => {
    const { recipeId, stepNumber } = timer
    // `navi-step-...` の id は CookNaviPage の naviStepDomId が付与する。形式を変えるときは両方を揃える
    if (
      location.pathname === '/cook-navi' &&
      document.getElementById(`navi-step-${recipeId}-${stepNumber}`)
    ) {
      navigate(`/cook-navi?focusStep=${recipeId}-${stepNumber}`, { replace: true })
      return
    }
    // ナビから始めたタイマーは、別の画面にいてもナビの該当手順へ戻す（2026-08-08 便ED・
    // オーナー実機フィードバック②「他画面からタイマーをタップするとレシピ詳細に飛び、
    // しかもナビが消えて最初からになる」）。作りかけの段取りが残っているときだけ通す
    if (timer.fromNavi && hasCookNaviTimeline()) {
      navigate(`/cook-navi?focusStep=${recipeId}-${stepNumber}`)
      return
    }
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
        {sortedTimers.map((timer) => {
          const remaining = Math.ceil((timer.endsAt - now) / 1000)
          const isFlashing = flashingId === timer.id
          // ±調整の窓を開くボタンの読み上げ名（複数タイマー同時進行でも区別できるよう手順番号を含める。
          // 手順に紐付かない自由な時間のタイマーはラベルのみ）
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
                timer.done ? goToStep(timer) : setAdjustingId(timer.id)
              }
              aria-label={timer.done ? undefined : adjustAriaLabel}
              // 終わった行は薄い赤みの面で塗る（2026-08-03 オーナー実機フィードバック⑧）。
              // 枠線と文字色だけだと、動作中の行と面の色が同じで一目では見分けにくかった
              /* 左端にナビのレシピ色（2026-08-08 便ED・オーナー実機フィードバック⑧
                 「どのレシピのタイマーか一目で分かるように」）。ナビ以外から始めた
                 タイマーには色が無いので従来どおりの見た目のまま */
              style={{
                ...(timer.done
                  ? { background: 'color-mix(in oklab, var(--warning) 12%, var(--surface))' }
                  : {}),
                ...(timer.naviColorIndex != null
                  ? { borderLeftWidth: 6, borderLeftColor: naviRecipeColor(timer.naviColorIndex) }
                  : {}),
              }}
              className={`flex w-full items-center gap-2 rounded-md border px-[var(--space-md)] py-2 text-left shadow-md transition-transform ${
                timer.done
                  ? 'border-warning text-warning'
                  : 'border-edge bg-surface'
              } ${isFlashing ? 'animate-pulse ring-2 ring-accent' : ''}`}
            >
              <StepBadge
                number={timer.isCustom || timer.stepNumber <= 0 ? 'custom' : timer.stepNumber}
                size={28}
              />
              {timer.done && <BellRing size={18} className="shrink-0 animate-pulse" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{timer.label}</span>
              <span className="text-lg font-bold tabular-nums">
                {timer.done ? timer.doneLabel : formatRemaining(remaining)}
              </span>
              {/* +1分ミニボタン(2026-07-13 UIペルソナQA)。行タップ(±調整の窓)より手前で即+60秒したい
                  ニーズに応える近道ボタン。既存adjustTimerをそのまま流用する。doneな行は
                  adjustTimerが効かない(TimerProvider側の既定)ので出さない */}
              {!timer.done && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    adjustTimer(timer.id, 60)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      e.preventDefault()
                      adjustTimer(timer.id, 60)
                    }
                  }}
                  aria-label={ja.timer.plusOneMinuteAria.replace('{label}', timer.label)}
                  className="flex h-9 shrink-0 items-center justify-center rounded-sm px-1.5 text-xs font-bold text-accent-ink"
                >
                  {ja.timer.plusOneMinute}
                </span>
              )}
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
        /* 動作中タイマーからレシピの手順へ戻る導線(2026-08-03 実機FB③の復活)。
           終わった行は従来どおり行タップで直接その手順へ飛ぶ */
        onGoToStep={
          adjustingTimer
            ? () => {
                setAdjustingId(null)
                goToStep(adjustingTimer)
              }
            : undefined
        }
        onToggleMute={
          adjustingTimer ? () => toggleMute(adjustingTimer.id) : undefined
        }
      />
    </div>
  )
}
