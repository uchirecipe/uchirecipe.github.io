import { useEffect } from 'react'
import { X, BellRing, Bell, BellOff, CornerUpLeft, Eye, Pause, Play } from 'lucide-react'
import type { ActiveTimer } from './TimerProvider'
import { formatRemaining } from '../logic/time'
import { timerRemainingSeconds } from '../logic/timerOrder'
import { naviStepText } from '../logic/naviStepText'
import StepBadge from './StepBadge'
import { useScrollLock } from './useScrollLock'
import { naviRecipeColor } from '../logic/naviColors'
import { ja } from '../i18n/ja'

type Props = {
  /** 調整対象のタイマー。null なら窓を閉じたまま何も描画しない */
  timer: ActiveTimer | null
  /** 残り時間の計算用（TimerProvider の now をそのまま渡す） */
  now: number
  onAdjust: (deltaSeconds: number) => void
  onStop: () => void
  onClose: () => void
  /**
   * このタイマーを始めたレシピの手順へ戻る（2026-08-03 オーナー実機フィードバック③）。
   * 未指定なら導線を出さない（戻り先が無い＝別の料理の手順へは飛べない場面）。
   */
  onGoToStep?: () => void
  /**
   * `onGoToStep` が**手順を見るだけ**か（2026-08-15 便GQ・オーナー判断A案）。
   *
   * 並行調理ナビの調理中（段取りの中に現在地があるとき）は、タイマーの手順を開いても
   * **現在地を動かさない**（動かすと「済んだ手順＝現在地より前」の導出が巻き戻る。
   * logic/cookSession.ts の resolveTimerStepLanding に理由を書いた）。
   * 起きることが変わるので、ボタンの名前と印もそれに合わせて分ける。
   * 未指定＝今までどおりその手順へ移る場面（1品のレシピ詳細・調理していないとき）。
   */
  goToStepIsPeek?: boolean
  /** このタイマーだけ消音する／音を戻す（同④）。未指定なら切り替えを出さない */
  onToggleMute?: () => void
  /**
   * 番号を「並行調理ナビの段取りの通し番号」で出すか（2026-08-09 便EH）。
   * 常駐タイマーバーから開いたときだけ true。調理中モード（1品の画面）から開いたときは
   * そのレシピ内の手順番号のままにする。
   */
  useNaviOrder?: boolean
  /**
   * レシピ名をタップしたときの移動先（2026-08-09 便ES・オーナー指示E-14
   * 「タイマーのバー→調整画面→レシピ名タップ→該当手順へ移動（タイマー全般）」）。
   * 未指定ならレシピ名はただの見出しのまま（飛び先が無い場面）。
   */
  onLabelClick?: () => void
  /**
   * 一時停止／再開の切り替え（2026-08-10 便EZ）。
   * 声の「ストップ」で止めたタイマーを、声を使わずに動かし直せる場所でもある。
   * 未指定なら切り替えを出さない。
   */
  onTogglePause?: () => void
}

/**
 * 実行中タイマーの±調整の窓（2026-07-12タイマー自由設定・Fable設計docs/20 §6）。
 * 「作った！」記録の窓（CookedLogModal）と同じ様式（角丸カード・枠線・shadow-md・中央寄せ）で、
 * 常駐バー(TimerBar)・調理中モード(FocusMode)の動作中タイマー表示をタップすると開く。
 * 「+1分」「−30秒」「停止」の3操作のみを置く。背景タップ・×ボタン・Escapeで閉じる。
 */
export default function TimerAdjustModal({
  timer,
  now,
  onAdjust,
  onStop,
  onClose,
  onGoToStep,
  goToStepIsPeek,
  onToggleMute,
  useNaviOrder,
  onLabelClick,
  onTogglePause,
}: Props) {
  useEffect(() => {
    if (!timer) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [timer, onClose])
  useScrollLock(timer !== null)

  if (!timer) return null
  /** 画面に出す番号（ナビの通し番号を使う場面ではそちらを優先する） */
  const naviOrder = useNaviOrder ? timer.naviOrder : undefined

  /**
   * そのレシピ内での手順番号（分けた工程は「3-1」）。
   * 段取りの通し番号を出しているとき（ナビ由来）だけ並べる＝同じ数字を2つ並べない
   */
  const recipeStepBadge =
    naviOrder == null
      ? undefined
      : (timer.naviStepLabel ?? (timer.stepNumber > 0 ? String(timer.stepNumber) : undefined))

  /**
   * 名前の横に添える手順の呼び方。
   * 2026-08-10 便EZ（オーナー指示「『段取りの7番目』は削除」）: ナビ由来のタイマーは、
   * すぐ左にある2つのバッジと同じ「⑦3-1」の並びで呼ぶ。以前は同じ場所で
   * 「段取りの7番目」と別の数え方を名乗っていて、バッジと読み比べる必要があった
   */
  const stepText =
    naviOrder != null
      ? ja.timer.stepLabel.replace('{n}', naviStepText(naviOrder, recipeStepBadge))
      : timer.stepNumber > 0
        ? ja.timer.stepLabel.replace('{n}', String(timer.stepNumber))
        : null

  /**
   * 手順への導線の名前（2026-08-15 便GQ）。**起きることが違えば名前も違う**にする。
   * 見るだけ＝「手順⑦（3-1）を見る」／その手順へ移る＝従来どおり「手順⑦（3-1）を開く」
   */
  const stepActionLabel = goToStepIsPeek ? ja.timer.peekStep : ja.timer.goToStep

  const remaining = timerRemainingSeconds(timer, now)
  /** 一時停止中（2026-08-10 便EZ）。時計が止まっているので、残り時間はその場に固定される */
  const paused = timer.pausedRemainingMs != null
  // 窓を開いたままタイマーが終わった場合(2026-07-28 機能④診断C10)。
  // adjustTimer は完了済みには効かない(TimerProvider側の既定)ため、以前は「+1分」「−30秒」を
  // 押しても00:00のまま何も起きない死にボタンになり、窓の中からは終わったことも分からなかった。
  // 終了後は残り時間の代わりに終了文言を出し、±ボタンは押せないことが見て分かる状態にする
  // (「停止」は引き続き押せる=この窓から片付けられる)
  const finished = timer.done

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
          <h3 className="flex min-w-0 items-center gap-1 font-bold">
            {ja.timer.adjustDialogTitle}
            {/* 消音は記号だけにして見出しの横へ（2026-08-09 便ES・オーナー指示E-15）。
                下段の大きなボタンだと「+1分」「停止」と同じ重みに見えて、
                窓の主な操作が3つあるように読めていた */}
            {onToggleMute && !finished && (
              <button
                type="button"
                data-testid="timer-adjust-mute"
                onClick={onToggleMute}
                aria-label={timer.muted ? ja.timer.unmute : ja.timer.mute}
                className="shrink-0 rounded-full p-1.5 text-ink-muted"
              >
                {timer.muted ? <BellOff size={20} aria-hidden /> : <Bell size={20} aria-hidden />}
              </button>
            )}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-[var(--space-sm)] flex items-center justify-center gap-1.5">
          <StepBadge
            number={
              timer.isCustom
                ? 'custom'
                : (naviOrder ?? (timer.stepNumber > 0 ? timer.stepNumber : 'custom'))
            }
            size={32}
          />
          {/* 段取りの通し番号だけでなく、そのレシピ内の手順番号もレシピの色で並べる
              （2026-08-09 便ES・オーナー指示E-13） */}
          {!timer.isCustom && recipeStepBadge && (
            <StepBadge
              number={recipeStepBadge}
              size={26}
              color={timer.naviColorIndex != null ? naviRecipeColor(timer.naviColorIndex) : undefined}
            />
          )}
          {/* レシピ名をタップするとその手順へ移動する（同・オーナー指示E-14） */}
          {onLabelClick ? (
            <button
              type="button"
              data-testid="timer-adjust-label"
              onClick={onLabelClick}
              className="min-w-0 truncate font-bold text-accent-ink underline"
            >
              {timer.label}
            </button>
          ) : (
            <span className="min-w-0 truncate font-bold">{timer.label}</span>
          )}
          {/* 手順のタイマーは、どの手順の時間かを名前の横に添える(2026-08-03 実機FB②)。
              時計バッジの「自分で時間を決めたタイマー」には手順表記を付けない */}
          {!timer.isCustom && stepText && (
            <span className="shrink-0 text-sm text-ink-muted">{stepText}</span>
          )}
        </div>
        {finished ? (
          <p className="mt-1 flex items-center justify-center gap-2 text-center text-3xl font-bold text-warning">
            <BellRing size={26} className="shrink-0 animate-pulse" aria-hidden />
            {timer.doneLabel}
          </p>
        ) : (
          <p
            data-testid="timer-adjust-remaining"
            className={`mt-1 flex items-center justify-center gap-2 text-center text-4xl font-bold tabular-nums ${
              paused ? 'text-ink-muted' : ''
            }`}
          >
            {/* 止まっていることが数字だけでは分からないので、記号と語で言い切る（便EZ） */}
            {paused && <Pause size={26} className="shrink-0" aria-hidden />}
            {formatRemaining(remaining)}
            {paused && <span className="text-sm font-bold">{ja.timer.pausedMark}</span>}
          </p>
        )}
        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            onClick={() => onAdjust(-30)}
            disabled={finished}
            className="flex-1 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent-ink shadow-sm disabled:opacity-30"
          >
            {ja.timer.minusThirtySeconds}
          </button>
          <button
            type="button"
            onClick={() => onAdjust(60)}
            disabled={finished}
            className="flex-1 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent-ink shadow-sm disabled:opacity-30"
          >
            {ja.timer.plusOneMinute}
          </button>
        </div>
        {finished && (
          <p className="mt-[var(--space-sm)] text-center text-sm text-ink-muted">
            {ja.timer.adjustFinishedHint}
          </p>
        )}
        {/* 一時停止／再開（2026-08-10 便EZ）。声の「ストップ」で止めたタイマーを、
            声を使わずに動かし直せる場所。終わったタイマーには止める先が無いので出さない */}
        {onTogglePause && !finished && (
          <button
            type="button"
            data-testid="timer-adjust-pause"
            onClick={onTogglePause}
            aria-label={(paused ? ja.timer.resumeAria : ja.timer.pauseAria).replace(
              '{label}',
              timer.label,
            )}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent-ink shadow-sm"
          >
            {paused ? <Play size={20} aria-hidden /> : <Pause size={20} aria-hidden />}
            {paused ? ja.timer.resume : ja.timer.pause}
          </button>
        )}
        {/* このタイマーを始めた手順へ戻る(2026-08-03 オーナー実機フィードバック③)。
            2026-08-15 便GQ: 調理中は**見るだけ**になるので、そのときは名前と印を分ける
            （矢印の印は「移る」を表すため、見るだけの場面では目の印にする） */}
        {onGoToStep && (
          <button
            type="button"
            data-testid="timer-adjust-go-step"
            onClick={onGoToStep}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 text-lg font-bold text-accent-ink shadow-sm"
          >
            {goToStepIsPeek ? (
              <Eye size={20} aria-hidden />
            ) : (
              <CornerUpLeft size={20} aria-hidden />
            )}
            {/* 2026-08-10 便EZ（オーナー指示）: 「段取りの7番目を開く」→「手順⑦3-1を開く」。
                すぐ上のバッジ（段取りの通し番号＋レシピ内の手順番号）と同じ並びで呼ぶ */}
            {naviOrder != null
              ? stepActionLabel.replace('{n}', naviStepText(naviOrder, recipeStepBadge))
              : timer.stepNumber > 0
                ? stepActionLabel.replace('{n}', String(timer.stepNumber))
                : ja.timer.goToRecipe}
          </button>
        )}
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
