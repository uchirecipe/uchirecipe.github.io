import { useState } from 'react'
import { X, BellRing, Bell, BellOff, Pause, Play } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTimers, type ActiveTimer } from './TimerProvider'
import { hasCookNaviCursor, hasCookNaviTimeline } from '../logic/cookNaviSession'
import { naviRecipeColor } from '../logic/naviColors'
import { formatRemaining } from '../logic/time'
import { naviStepSpeechText, naviStepText } from '../logic/naviStepText'
import { sortTimersForDisplay, timerRemainingSeconds, timerAdjustAria} from '../logic/timerOrder'
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
    pauseTimer,
    resumeTimer,
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
   * そのレシピ内での手順番号（分けた工程は「3-1」）。
   * 出すのは**段取りの通し番号を出しているタイマーだけ**＝ナビ由来のもの。
   * ナビ以外のタイマーは1つめのバッジがすでにレシピ内の手順番号なので、同じ数字を2つ並べない
   */
  const recipeStepBadge = (timer: ActiveTimer): string | undefined => {
    if (timer.naviOrder == null) return undefined
    return timer.naviStepLabel ?? (timer.stepNumber > 0 ? String(timer.stepNumber) : undefined)
  }

  /**
   * `navi-step-...` の id は CookNaviPage の naviStepDomId が付与する。形式を変えるときは両方を揃える。
   * 2026-08-13 便GD: 1つの手順を2つに分ける形が増えたので、手順番号ではなく
   * **そのレシピ内の手順の呼び名**（「3」「3-1」「3-2」）で指す
   */
  const naviStepDomId = (timer: ActiveTimer) =>
    `navi-step-${timer.recipeId}-${timer.naviStepLabel ?? String(timer.stepNumber)}`

  /**
   * 押すと**その手順を見るだけ**になるか（2026-08-15 便GQ・オーナー判断A案）。
   *
   * 並行調理ナビの段取りに現在地があるとき、着地先の CookNaviPage は
   * **カーソルを動かさず**に全画面の調理中モードでその手順を出す
   *（理由は logic/cookSession.ts の resolveTimerStepLanding）。起きることが変わるので、
   * 窓のボタンも「開く」ではなく「見る」と名乗る。
   * 現在地が無いとき（調理していない）は今までどおり段取りの一覧の該当カードへ送り、
   * ナビと関係のないタイマーは単品レシピ詳細を開くので、どちらも「開く」のまま。
   */
  const opensAsPeek = (timer: ActiveTimer): boolean => {
    if (!hasCookNaviCursor()) return false
    if (location.pathname === '/cook-navi' && document.getElementById(naviStepDomId(timer))) {
      return true
    }
    return timer.fromNavi === true && hasCookNaviTimeline()
  }

  /**
   * このタイマーを始めた手順を開く。
   * 通常は単品レシピ詳細（?step=）へ飛んで詳細画面側でスクロール＆一時ハイライトする。
   * ただし並行調理ナビ実行中は、常駐バーは元々レシピ詳細向けの設計なので詳細へ離脱させず、
   * ナビ内に同じ手順カードが表示されていればナビ内でスクロール＆ハイライトして文脈に留める
   * （2026-07-23便BI。バグ修正: ナビ実行中に完了タイマーをタップすると単品詳細へ飛ばされ
   * ナビから離脱していた）。ナビにその手順が無い（別の組み合わせで再構築した・タイムライン
   * を畳んだ等）ときは従来どおり詳細へフォールバックする。
   *
   * 2026-08-11 便FO: **帯そのもののタップからは呼ばない**（利用者テスト「帯を消そうとして
   * 触ったら、並行調理ナビの画面に飛ばされた。消す✕は帯の右端の小さい印だけ。濡れた手だと
   * 確実に押し間違える」）。画面が変わる操作は、調整の窓の中の手順のボタンを
   * **名前を読んで押したときだけ**にする。
   *
   * 2026-08-15 便GQ: 調理の途中（段取りに現在地がある）なら、着地先の CookNaviPage が
   * **カーソルを動かさず**その手順を見るだけの窓で出す（上の opensAsPeek）。
   * ここが送り出す `?focusStep=` そのものは変えていない。
   */
  const goToStep = (timer: ActiveTimer) => {
    const { recipeId, stepNumber } = timer
    const stepKey = timer.naviStepLabel ?? String(stepNumber)
    if (location.pathname === '/cook-navi' && document.getElementById(naviStepDomId(timer))) {
      navigate(`/cook-navi?focusStep=${recipeId}-${stepKey}`, { replace: true })
      return
    }
    // ナビから始めたタイマーは、別の画面にいてもナビの該当手順へ戻す（2026-08-08 便ED・
    // オーナー実機フィードバック②「他画面からタイマーをタップするとレシピ詳細に飛び、
    // しかもナビが消えて最初からになる」）。作りかけの段取りが残っているときだけ通す
    if (timer.fromNavi && hasCookNaviTimeline()) {
      navigate(`/cook-navi?focusStep=${recipeId}-${stepKey}`)
      return
    }
    navigate(`/recipes/${recipeId}?step=${stepNumber}`)
  }

  return (
    <div
      data-app-bottom-bar
      className="fixed inset-x-0 z-10"
      style={{ bottom: 'calc(72px + env(safe-area-inset-bottom))' }}
    >
      <div className="mx-auto max-h-[38vh] max-w-md space-y-1 overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-sm)]">
        {showFirstTimeNotice && (
          <div className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-xs text-ink-muted shadow-md">
            <span className="min-w-0 flex-1">{ja.timer.notice}</span>
            <button
              type="button"
              onClick={dismissFirstTimeNotice}
              aria-label={ja.focus.close}
              className="tap-target shrink-0"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        )}
        {sortedTimers.map((timer) => {
          const remaining = timerRemainingSeconds(timer, now)
          const isFlashing = flashingId === timer.id
          /** 一時停止中（2026-08-10 便EZ。声の「ストップ」で止めた状態） */
          const paused = timer.pausedRemainingMs != null
          // ±調整の窓を開くボタンの読み上げ名（複数タイマー同時進行でも区別できるよう手順番号を含める。
          // 手順に紐付かない自由な時間のタイマーはラベルのみ）
          // 並行調理ナビから始めたタイマーは、画面のバッジと同じ「⑦3-1」の並びで呼ぶ
          // （2026-08-10 便EZ・オーナー指示「『段取りの7番目』は削除」）
          const stepText =
            timer.naviOrder != null
              ? ja.timer.stepLabel.replace(
                  '{n}',
                  naviStepText(timer.naviOrder, recipeStepBadge(timer)),
                )
              : timer.stepNumber > 0
                ? ja.timer.stepLabel.replace('{n}', String(timer.stepNumber))
                : null
          // 読み上げ名だけは2つの番号を呼び分ける（2026-08-14 便GL）。
          // 画面の文字（stepText）はバッジと並んでいるので今までどおり「手順⑨（1-2）」のまま
          const speechStepText =
            timer.naviOrder != null
              ? naviStepSpeechText(timer.naviOrder, recipeStepBadge(timer))
              : stepText
          const adjustAriaLabel = timerAdjustAria(
            speechStepText ? `${timer.label}・${speechStepText}` : timer.label,
            ja.timer.adjustOpenAria,
            ja.timer.customLabel,
          )
          return (
            <button
              key={timer.id}
              type="button"
              /* 終わった行も動作中の行と同じく「調整の窓を開く」だけにする（2026-08-11 便FO）。
                 以前は終わった行だけがタップで画面を移動していたため、消そうとして
                 触っただけで別の画面に飛んでいた。窓には「手順◯を開く」と
                 「タイマーを消す」が大きく並ぶので、どちらも窓から選べる */
              onClick={() => setAdjustingId(timer.id)}
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
                number={
                  timer.isCustom
                    ? 'custom'
                    : (timer.naviOrder ?? (timer.stepNumber > 0 ? timer.stepNumber : 'custom'))
                }
                size={28}
              />
              {/* そのレシピ内の手順番号も、レシピの色で並べて出す（2026-08-09 便ES・
                  オーナー指示E-12「タイマーのバーの番号がナビの番号のみ・色も違う
                  →両方の番号＋レシピ色」）。段取りの番号だけでは、どの品のどの手順か分からなかった */}
              {!timer.isCustom && recipeStepBadge(timer) && (
                <StepBadge
                  number={recipeStepBadge(timer)!}
                  size={22}
                  color={
                    timer.naviColorIndex != null ? naviRecipeColor(timer.naviColorIndex) : undefined
                  }
                />
              )}
              {timer.done && <BellRing size={18} className="shrink-0 animate-pulse" aria-hidden />}
              {/* 止まっていることが数字だけでは分からないので、時間の手前に印を出す（便EZ） */}
              {paused && <Pause size={16} className="shrink-0 text-ink-muted" aria-hidden />}
              <span className="min-w-0 flex-1 truncate text-sm font-bold">{timer.label}</span>
              <span className={`text-lg font-bold tabular-nums ${paused ? 'text-ink-muted' : ''}`}>
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
              {/* 一時停止中は消音の代わりに「再開」を出す（止まっているタイマーはもう鳴らないので、
                  ここで要るのは音の入り切りではなく動かし直すこと。2026-08-10 便EZ）。
                  終わった行には止める先が無いので、従来どおり消音のままにする */}
              {paused && !timer.done ? (
                <span
                  role="button"
                  tabIndex={0}
                  data-testid="timer-bar-resume"
                  onClick={(e) => {
                    e.stopPropagation()
                    resumeTimer(timer.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation()
                      e.preventDefault()
                      resumeTimer(timer.id)
                    }
                  }}
                  aria-label={ja.timer.resumeAria.replace('{label}', timer.label)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-accent-ink"
                >
                  <Play size={18} aria-hidden />
                </span>
              ) : (
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
              )}
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
                className="tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-ink-muted"
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
        /* 常駐バーから開いた窓は、ナビの段取りの通し番号で呼ぶ（2026-08-09 便EH） */
        useNaviOrder
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
        /* 調理の途中なら、押しても現在地は動かない＝「開く」ではなく「見る」と名乗る（便GQ） */
        goToStepIsPeek={adjustingTimer ? opensAsPeek(adjustingTimer) : false}
        /* レシピ名のタップでも同じ手順へ移動する（2026-08-09 便ES・オーナー指示E-14） */
        onLabelClick={
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
        /* 一時停止／再開（2026-08-10 便EZ。声の「ストップ」で止めたタイマーを戻す道） */
        onTogglePause={
          adjustingTimer
            ? () =>
                adjustingTimer.pausedRemainingMs != null
                  ? resumeTimer(adjustingTimer.id)
                  : pauseTimer(adjustingTimer.id)
            : undefined
        }
      />
    </div>
  )
}
