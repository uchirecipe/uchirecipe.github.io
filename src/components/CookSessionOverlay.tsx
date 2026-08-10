import { useEffect, useRef, useState, type TouchEvent } from 'react'
import {
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  Hourglass,
  Hand,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Bell,
  BellOff,
  BellRing,
  Pause,
  Play,
  Timer as TimerIcon,
} from 'lucide-react'
import Collapse from './Collapse'
import StepBadge from './StepBadge'
import ComposedStepText from './ComposedStepText'
import { MemoText } from './MemoText'
import TermPopover, { useTermPopover } from './TermPopover'
import TimerAdjustModal from './TimerAdjustModal'
import { useTimers, type ActiveTimer } from './TimerProvider'
import { useSpeech, useVoiceCommands } from './useVoiceCommands'
import { sortTimersForDisplay, timerRemainingSeconds } from '../logic/timerOrder'
import { formatRemaining, findTimeTokens, isMinutesShownInText } from '../logic/time'
import {
  pickVoiceResumeTarget,
  pickVoiceStopTarget,
  resolveVoiceTimerSeconds,
} from '../logic/voiceCommand'
import { circledNumber } from '../logic/naviStepText'
import { naviRecipeColor } from '../logic/naviColors'
import { seasoningGroupLineStyle } from '../logic/seasoningGroup'
import { recipeStepLabel, type TimelineItem, type TimelineRecipe } from '../logic/cookNavi'
import type { NaviIngredientAmount } from '../logic/naviIngredients'
import {
  advanceCursor,
  backCursor,
  collapseStepText,
  findCursorIndex,
  isCursorAtFirst,
  isCursorAtLast,
  nextStepsByRecipe,
  startCursor,
  type CookCursor,
} from '../logic/cookSession'
import { useAppBusyWhileMounted } from '../logic/appBusy'
import { ja } from '../i18n/ja'

/**
 * 畳んだ1行に出す上限の文字数。**390px 幅の実DOMで測って決めた値**。
 *
 * 2026-08-09 便ES（オーナー指示E-8「画面横幅いっぱいに」）: 料理名と同じ行に詰めるのをやめ、
 * 手順本文を**その下の行に全幅で**置くようにしたので、使える幅が広がった。
 * 1行の内訳: 画面幅390 − 左右の余白32 − 色の線4 − 内側の余白6 ＝ 本文に使える幅 348px。
 * 本文は 14px（text-sm）で1字あたり約14.4px＝24.1字。端末差で数pxずれても2行にならないよう
 * **23字**を上限にする（旧: 料理名と同居していたので19字）。
 * 上限を超える手順は「文頭…文末」に畳む（logic/cookSession.ts の collapseStepText）。
 * 切る位置は**文節の切れ目だけ**なので、「じん切りにする。」のような語の途中の切れ方は起きない。
 */
const FOLDED_MAX_CHARS = 23

/**
 * 動作中タイマーの1つぶん（2026-08-09 便ES）。画面上部（大きく表示中の品）と
 * 「他の品の次の手順」の行の両方から同じ見た目で使う。
 *
 * 番号は**段取りの通し番号とレシピ内の手順番号の両方**を出し、レシピ内の番号はその料理の色で
 * 描く（オーナー指示E-12。段取りの番号だけだと、どの品のどの手順か分からなかった）。
 */
function TimerChip({
  timer,
  now,
  flashing,
  onOpen,
  onToggleMute,
  onResume,
  onDismiss,
}: {
  timer: ActiveTimer
  now: number
  flashing: boolean
  onOpen: () => void
  onToggleMute: () => void
  /** 一時停止中のタイマーを動かし直す（2026-08-10 便EZ。声の「ストップ」の戻り道） */
  onResume: () => void
  onDismiss: () => void
}) {
  const paused = timer.pausedRemainingMs != null
  // ナビが足した工程（湯を沸かす）は stepNumber を持たないが、段取りの番号は持つ。
  // 番号があるものを「自由な時間のタイマー」の時計バッジにしない（2026-08-09 便ES）
  const isCustom = timer.isCustom === true || (timer.stepNumber <= 0 && timer.naviOrder == null)
  const recipeStepBadge =
    timer.naviOrder == null
      ? undefined
      : (timer.naviStepLabel ?? (timer.stepNumber > 0 ? String(timer.stepNumber) : undefined))
  return (
    <div
      style={
        timer.done
          ? { background: 'color-mix(in oklab, var(--warning) 14%, var(--surface))' }
          : undefined
      }
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 ${
        timer.done ? 'border-warning text-warning' : 'border-accent text-accent-ink'
      } ${flashing ? 'animate-pulse ring-2 ring-accent' : ''}`}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={ja.timer.adjustOpenAria.replace('{label}', timer.label)}
        className="flex min-w-0 items-center gap-1"
      >
        <StepBadge number={isCustom ? 'custom' : (timer.naviOrder ?? timer.stepNumber)} size={24} />
        {!isCustom && recipeStepBadge && (
          <StepBadge
            number={recipeStepBadge}
            size={20}
            color={timer.naviColorIndex != null ? naviRecipeColor(timer.naviColorIndex) : undefined}
          />
        )}
        {timer.done && <BellRing size={16} className="shrink-0 animate-pulse" aria-hidden />}
        {/* 止まっていることが数字だけでは分からないので、時間の手前に印を出す（便EZ） */}
        {paused && <Pause size={14} className="shrink-0" aria-hidden />}
        <span className="max-w-[7rem] truncate text-xs font-bold">{timer.label}</span>
        <span className="whitespace-nowrap text-base font-bold tabular-nums">
          {timer.done ? timer.doneLabel : formatRemaining(timerRemainingSeconds(timer, now))}
        </span>
      </button>
      {/* 一時停止中は消音の代わりに「再開」を出す（止まっているタイマーはもう鳴らないので、
          この場所で要るのは音の入り切りではなく動かし直すこと。2026-08-10 便EZ） */}
      {!timer.done && paused && (
        <button
          type="button"
          data-testid="timer-chip-resume"
          onClick={onResume}
          aria-label={ja.timer.resumeAria.replace('{label}', timer.label)}
          className="shrink-0 rounded-full p-1.5 text-accent-ink"
        >
          <Play size={16} aria-hidden />
        </button>
      )}
      {!timer.done && !paused && (
        <button
          type="button"
          onClick={onToggleMute}
          aria-label={timer.muted ? ja.timer.unmute : ja.timer.mute}
          className="shrink-0 rounded-full p-1.5 text-ink-muted"
        >
          {timer.muted ? <BellOff size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label={ja.timer.dismiss}
        className="shrink-0 rounded-full p-1.5"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}

type Props = {
  /** 組み直した段取り（保存しない導出値） */
  items: readonly TimelineItem[]
  /** 段取りに組んだ品（色の順） */
  recipes: readonly TimelineRecipe[]
  /** いま開いている手順（書ける状態はこれ1つだけ） */
  cursor: CookCursor
  /** 手順ごとの材料と分量。キーは `${recipeId}-${stepIndex}` */
  stepIngredients: Map<string, NaviIngredientAmount[]>
  /** 手順本文の材料名に下線を引くための名前一覧（レシピごと） */
  ingredientNamesByRecipeId: Map<number, string[]>
  /** カーソルを動かす（呼び出し側が覚え書きに書く） */
  onMove: (next: CookCursor) => void
  /**
   * この画面を閉じる（2026-08-10 便FC）。**調理中の手順は消さない**＝呼び出し側は
   * 全画面をしまうだけで、次に開いたときは同じ手順から始まる（オーナー実機
   * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
   */
  onExit: () => void
  /** 最後の手順まで進んで終える（確認なしで調理中の位置を消す） */
  onFinish: () => void
  /** タイマーを始める（段取りの通し番号・レシピの色つきで常駐バーに出す） */
  onStartTimer: (item: TimelineItem, seconds: number) => void
}

/**
 * 並行調理ナビの「調理中の画面」（2026-08-09 便EL・docs/69 第1段）。
 *
 * 段取りの一覧は「作る前に読む画面」で、手を動かしながら見るには文字が小さく、
 * いまどこにいるのかも分からなかった。ここでは**いまやる手順だけ**を全画面に大きく出し、
 * 他の品の次の手順は下部に1行ずつ置く。
 *
 * 状態の持ち方（ここが肝。docs/69）:
 *   - 書ける状態はカーソル（`cursor`）1つだけ。済んだ手順の一覧も、各品の進み具合も持たない
 *   - 済んだ手順＝カーソルより前／各品の次の手順＝カーソルより後の最初の1件（純関数で導出）
 *   - 位置の計算は logic/cookSession.ts の純関数だけが行う（遷移表は単体テストで固定）
 *
 * この画面から**別の画面へは移動しない**（単品のレシピ詳細への入口を置かない）。
 * 調理の途中で1品の画面へ飛ぶと、戻ってきたときに並行の文脈が切れるため。
 */
export default function CookSessionOverlay({
  items,
  recipes,
  cursor,
  stepIngredients,
  ingredientNamesByRecipeId,
  onMove,
  onExit,
  onFinish,
  onStartTimer,
}: Props) {
  // 段取りの実行中は、アプリの更新のお知らせを出さない(2026-08-09 便ER。logic/appBusy.ts)
  useAppBusyWhileMounted()
  const { timers, now, dismissTimer, adjustTimer, toggleMute, flashingId, pauseTimer, resumeTimer } =
    useTimers()
  const { speaking, speak, stopSpeech } = useSpeech()
  const { state: termPopoverState, open: openTerm, close: closeTermPopover } = useTermPopover()
  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  /**
   * 下部の行をタップして中身を確認している品（保存しない一時的な表示状態）。
   * **カーソルは動かさない**＝見るだけ。ここで位置まで動かすと、オーナーが懸念した
   * 「手順飛ばし」「戻り先の誤り」が起きうるので、第1段では確認だけに絞る（docs/69）。
   */
  const [peekRecipeId, setPeekRecipeId] = useState<number | null>(null)
  const touchStartX = useRef<number | null>(null)
  // 一度でも読み上げを使ったら、以降は手順が切り替わるたびに自動で読み上げる（調理中モードと同じ）
  const autoReadRef = useRef(false)

  const index = findCursorIndex(items, cursor)
  const item = index === -1 ? undefined : items[index]
  const total = items.length
  const atFirst = isCursorAtFirst(items, cursor)
  const atLast = isCursorAtLast(items, cursor)
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const others = nextStepsByRecipe(items, cursor, recipes.map((r) => r.id))

  // 手順が変わったら、下部で開いていた全文は閉じる（前の手順のまま残ると読み違える）
  useEffect(() => {
    setPeekRecipeId(null)
  }, [index])

  // カーソルを動かす前に読み上げを止める（前の手順を読みながら次に進まない）
  const move = (next: CookCursor | undefined) => {
    if (!next) return
    stopSpeech()
    onMove(next)
  }
  const goNext = () => move(advanceCursor(items, cursor))
  const goPrev = () => move(backCursor(items, cursor))
  /**
   * 段取りの最初の手順へ（2026-08-10 便FC・オーナー実機「左上に、①に戻るボタンを設置したい」）。
   * 途中から開き直したとき・作り直したいときに、次へ／前へを何回も押さずに先頭へ帰れる。
   * カーソルを動かすだけなので、押し間違えても「次へ」で戻れる（可逆）。
   */
  const goFirst = () => move(startCursor(items))

  // 開いている間は背景（段取りの一覧）をスクロールさせない（調理中モードと同じ）
  useEffect(() => {
    const { body, documentElement: html } = document
    const prevBody = body.style.overflow
    const prevHtml = html.style.overflow
    body.style.overflow = 'hidden'
    html.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevBody
      html.style.overflow = prevHtml
    }
  }, [])

  /**
   * 端末の「戻る」で、この画面だけを閉じる（調理中モード FocusMode と同じ作法）。
   * 履歴を1つ積んでおかないと、Androidの戻るジェスチャ・iOSの端スワイプで
   * 並行調理ナビごと献立タブまで戻ってしまう。
   */
  const closeRef = useRef(onExit)
  closeRef.current = onExit
  useEffect(() => {
    window.history.pushState({ uchiCookSession: true }, '')
    const onPopState = () => closeRef.current()
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      if ((window.history.state as { uchiCookSession?: boolean } | null)?.uchiCookSession) {
        window.history.back()
      }
    }
  }, [])

  // 読み上げを一度使ったら、手順が切り替わるたびに自動で読み上げる
  useEffect(() => {
    if (!autoReadRef.current) return
    const current = items[findCursorIndex(items, cursor)]
    if (current) speak(current.text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const toggleSpeak = () => {
    if (!item) return
    if (speaking) {
      stopSpeech()
      return
    }
    autoReadRef.current = true
    speak(item.text)
  }

  /**
   * 声で受けるのは1品の調理中モードと同じ言葉だけ
   *（次へ／戻って／読み上げ／ストップ／再開／タイマー）。
   * どれも間違って言われても戻せる操作にする。記録・タイマーの削除・調理を終える、は
   * 聞き間違いで実行されると取り返しがつかないので**タップだけ**にしてある（docs/69）。
   */
  const { listening, toggleListening, micDenied, dismissMicDenied, voiceMessage, micSupported } =
    useVoiceCommands({
      onNext: goNext,
      onPrev: goPrev,
      onRepeat: () => {
        if (item) speak(item.text)
      },
      /**
       * 「ストップ」＝読み上げを止め、動作中のタイマーを1本だけ一時停止する
       * （2026-08-10 便EZ）。どれを止めるかは logic/voiceCommand.ts の
       * pickVoiceStopTarget が決める（いま大きく出している品→次に鳴る1本の順）。
       */
      onStop: () => {
        stopSpeech()
        const target = pickVoiceStopTarget(timers, item?.recipeId)
        if (!target) return
        pauseTimer(target.id)
        return ja.focus.micTimerPaused.replace('{label}', target.label)
      },
      /**
       * 「再開」＝一時停止しているタイマーを1本だけ動かし直す（2026-08-10 便FC・
       * オーナー実機「一時停止の後に音声操作で再開できない」）。
       * どれを動かすかは pickVoiceResumeTarget（止めるときの裏返し）が決める
       */
      onResume: () => {
        const target = pickVoiceResumeTarget(timers, item?.recipeId)
        if (!target) return
        resumeTimer(target.id)
        return ja.focus.micTimerResumed.replace('{label}', target.label)
      },
      onTimer: (transcript) => {
        if (!item) return false
        const seconds = resolveVoiceTimerSeconds(
          transcript,
          item.minutes,
          findTimeTokens(item.text)[0]?.seconds,
        )
        if (!seconds) return false
        onStartTimer(item, seconds)
        return true
      },
    })

  // 段取りに無い手順を指している間は何も描かない（呼び出し側が一覧表示へ戻す）
  if (!item) return null

  const isWait = item.kind === 'wait'
  // その品がこの手順で出来上がるか（段取りの一覧の「完成」と同じ判定＝以降にその品の手順が無い）
  const isRecipeLast = !items.slice(index + 1).some((x) => x.recipeId === item.recipeId)
  const color = naviRecipeColor(item.colorIndex)
  const currentStepLabel = recipeStepLabel(item)
  const ingredients = stepIngredients.get(`${item.recipeId}-${item.stepIndex}`) ?? []
  const ingredientNames = ingredientNamesByRecipeId.get(item.recipeId) ?? []
  const showWaitTimerButton =
    isWait && item.minutes != null && item.minutes > 0 && !isMinutesShownInText(item.text, item.minutes)
  /**
   * タイマーの置き場所（2026-08-09 便ES・オーナー指示E-11
   * 「大きく表示中のタイマーは画面上、他のタイマーは『他の品の〜』に直接表示」）。
   * いま大きく出している品のタイマーだけを画面上部に置き、他の品のタイマーは
   * その品の行に付ける。どのタイマーがどの料理のものか、目を動かさずに分かるようにする。
   */
  const sortedTimers = sortTimersForDisplay(timers)
  const planRecipeIds = new Set(recipes.map((r) => r.id))
  const timersByRecipeId = new Map<number, typeof sortedTimers>()
  // 段取りに入っていない品のタイマー（並行調理ナビの画面で自分で始めたタイマーなど）は、
  // 置き場所になる行が下部に無いので画面上部に出す
  const currentTimers = sortedTimers.filter(
    (t) => t.recipeId === item.recipeId || !planRecipeIds.has(t.recipeId),
  )
  for (const t of sortedTimers) {
    if (t.recipeId === item.recipeId || !planRecipeIds.has(t.recipeId)) continue
    const list = timersByRecipeId.get(t.recipeId) ?? []
    list.push(t)
    timersByRecipeId.set(t.recipeId, list)
  }
  const adjustingTimer = timers.find((t) => t.id === adjustingId) ?? null
  /**
   * そのタイマーを始めた手順（段取りの中の1つ）。見つからないタイマー
   * （自分で時間を決めたタイマー・別の組み合わせで始めたもの）には飛び先が無い
   */
  const timerStep = (timer: ActiveTimer) =>
    items.find(
      (x) => x.recipeId === timer.recipeId && (recipeStepLabel(x) ?? '') === (timer.naviStepLabel ?? ''),
    )
  /** 調整の窓の「レシピ名タップで該当手順へ」（オーナー指示E-14）。段取りに無い手順には飛ばさない */
  const goToTimerStep = (timer: ActiveTimer) => {
    const target = timerStep(timer)
    if (!target) return
    setAdjustingId(null)
    move({ recipeId: target.recipeId, stepIndex: target.stepIndex })
  }
  /**
   * このタイマーの手順へ移動できるか（2026-08-10 便FC）。飛び先が無いタイマーで
   * レシピ名に下線を引く・「手順◯を開く」を出すと、押しても何も起きない見せかけになる
   */
  const adjustingTimerStep = adjustingTimer ? timerStep(adjustingTimer) : undefined

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    if (dx < 0) goNext()
    else goPrev()
  }

  return (
    <div data-testid="cook-session" className="fixed inset-0 z-50 flex flex-col bg-app">
      {/* 上部: 閉じる / 最初の手順へ / どの品の何手順目か / 読み上げ・声の操作 */}
      <div className="flex items-center justify-between px-[var(--space-sm)] py-[var(--space-sm)]">
        <button
          type="button"
          onClick={onExit}
          aria-label={ja.cookNavi.sessionClose}
          data-testid="cook-session-close"
          className="rounded-full p-2 text-ink-muted"
        >
          <X size={24} aria-hidden />
        </button>
        {/* 段取りの最初の手順へ（2026-08-10 便FC・オーナー実機「左上に、①に戻るボタン」）。
            呼び方は画面の大きいバッジと同じ丸数字にそろえる＝「手順①へ」（便EZで統一した
            「手順⑦3-1」の書き方と同じ流儀）。「戻る」の語を使わないのは、下の「前へ」や
            端末の戻る操作と読み分けられなくなるため。先頭にいる間は押せない */}
        <button
          type="button"
          data-testid="cook-session-to-first"
          onClick={goFirst}
          disabled={atFirst}
          className="shrink-0 rounded-md border border-edge bg-surface px-2 py-1.5 text-xs font-bold text-accent-ink shadow-sm disabled:opacity-30"
        >
          {ja.cookNavi.sessionToFirst.replace('{n}', circledNumber(items[0]?.order ?? 1))}
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          <p className="truncate">
            <span
              data-testid="cook-session-recipe"
              className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-sm font-bold"
              style={{ backgroundColor: color, color: 'var(--chip-ink)' }}
            >
              {item.recipeTitle}
            </span>
          </p>
          <span className="text-sm font-bold text-ink-muted" data-testid="cook-session-counter">
            {ja.cookNavi.sessionCounter
              .replace('{n}', String(index + 1))
              .replace('{t}', String(total))}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {micSupported && (
            <button
              type="button"
              onClick={toggleListening}
              aria-label={listening ? ja.focus.micStop : ja.focus.micStart}
              className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 ${
                listening ? 'text-accent-ink' : 'text-ink-muted'
              }`}
            >
              {listening ? (
                <Mic size={24} className="animate-pulse" aria-hidden />
              ) : (
                <MicOff size={24} aria-hidden />
              )}
              <span className="text-[10px] font-bold leading-none">{ja.focus.micLabel}</span>
            </button>
          )}
          <button
            type="button"
            onClick={toggleSpeak}
            aria-label={speaking ? ja.focus.stop : ja.focus.read}
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-accent-ink"
          >
            {speaking ? <VolumeX size={24} aria-hidden /> : <Volume2 size={24} aria-hidden />}
            <span className="text-[10px] font-bold leading-none">{ja.focus.readLabel}</span>
          </button>
        </div>
      </div>

      {micSupported && (
        <p className="px-[var(--space-md)] pb-1 text-center text-xs text-ink-muted">
          {ja.focus.micHint}
          {voiceMessage ? (
            <span className={`ml-1 font-bold ${listening ? 'text-accent-ink' : 'text-warning'}`}>
              {voiceMessage}
            </span>
          ) : (
            listening && <span className="ml-1 font-bold text-accent-ink">{ja.focus.micListening}</span>
          )}
        </p>
      )}

      {/* マイクがブラウザで断られている案内（調理中モードと同じ内容） */}
      {micDenied && (
        <div className="mx-[var(--space-md)] mb-1 flex items-start gap-2 rounded-md border border-warning bg-surface px-[var(--space-md)] py-2 text-xs">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-warning">{ja.focus.micDeniedTitle}</p>
            <p className="mt-0.5 text-ink-muted">{ja.focus.micDeniedBody}</p>
            <p className="mt-0.5 text-ink-muted">{ja.focus.micDeniedIphone}</p>
            <p className="text-ink-muted">{ja.focus.micDeniedAndroid}</p>
          </div>
          <button
            type="button"
            onClick={dismissMicDenied}
            aria-label={ja.focus.close}
            className="shrink-0 rounded-full p-1 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* 動作中のタイマー。この画面が常駐タイマーバーを覆い隠すので、ここにも出す
          （調理中モードと同じ理由）。**ここに出すのは大きく表示中の品のタイマーだけ**で、
          他の品のタイマーは下の「他の品の次の手順」の行に付ける（2026-08-09 便ES・E-11） */}
      {currentTimers.length > 0 && (
        <div
          data-testid="cook-session-current-timers"
          className="flex max-h-[22vh] flex-wrap items-center justify-center gap-2 overflow-y-auto px-[var(--space-md)] pb-1"
        >
          {currentTimers.map((t) => (
            <TimerChip
              key={t.id}
              timer={t}
              now={now}
              flashing={flashingId === t.id}
              onOpen={() => setAdjustingId(t.id)}
              onToggleMute={() => toggleMute(t.id)}
              onResume={() => resumeTimer(t.id)}
              onDismiss={() => dismissTimer(t.id)}
            />
          ))}
        </div>
      )}

      {/* いまやる手順（1枚）。左右スワイプでも前後に動かせる */}
      <div
        className="flex flex-1 flex-col items-center justify-center-safe gap-[var(--space-md)] overflow-y-auto px-[var(--space-lg)] pb-[var(--space-md)] pt-[var(--space-sm)] text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex items-center gap-2">
          <StepBadge number={item.order} size={44} />
          {/* そのレシピ内の手順番号はレシピ色のバッジ（段取りの一覧と同じ見分け方）。
              レシピの1手順を2つに分けた工程は「3-1」「3-2」（2026-08-09 便ES・E-4） */}
          {currentStepLabel && (
            <>
              <span className="sr-only">
                {item.splitOf != null && item.splitPart != null
                  ? ja.cookNavi.splitStepNumberLabel
                      .replace('{n}', String(item.splitOf))
                      .replace('{part}', String(item.splitPart))
                  : ja.cookNavi.stepNumberLabel.replace('{n}', currentStepLabel)}
              </span>
              <span aria-hidden>
                <StepBadge number={currentStepLabel} size={30} color={color} />
              </span>
            </>
          )}
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${
              isWait ? 'border-accent text-accent-ink' : 'border-edge text-ink-muted'
            }`}
          >
            {isWait ? <Hourglass size={12} aria-hidden /> : <Hand size={12} aria-hidden />}
            {isWait ? ja.cookNavi.kindWait : ja.cookNavi.kindActive}
          </span>
        </div>

        <p className="ja-phrase w-full text-2xl font-bold leading-relaxed">
          <ComposedStepText
            text={item.text}
            ingredientNames={ingredientNames}
            onOpenTerm={openTerm}
            onStartTimer={(_t, seconds) => onStartTimer(item, seconds)}
          />
        </p>

        {/* 待ち工程の分数とタイマー（段取りの一覧の待ちブロックと同じ内容） */}
        {isWait && (
          <div
            className="w-full rounded-sm p-[var(--space-sm)]"
            style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-accent-ink">
                <Hourglass size={16} aria-hidden />
                {/* ナビが足した湯沸かしは分数を出さない（2026-08-09 便ES・オーナー指示D-3） */}
                {item.addedByNavi
                  ? ja.cookNavi.waitBlockBoil
                  : ja.cookNavi.waitBlockTitle.replace('{n}', String(item.waitMinutes))}
              </span>
              {showWaitTimerButton && (
                <button
                  type="button"
                  onClick={() => onStartTimer(item, item.waitMinutes * 60)}
                  className="inline-flex items-center gap-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm font-bold text-accent-ink shadow-sm"
                >
                  <TimerIcon size={16} aria-hidden />
                  {ja.cookNavi.startTimer}
                </button>
              )}
            </div>
            {item.waitEstimated && (
              <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.waitEstimatedNote}</p>
            )}
          </div>
        )}

        {item.memo && <MemoText text={item.memo} className="w-full text-ink-muted" />}

        {/* この手順で使う材料と分量（3品ぶんの材料が混ざるのを防ぐ。色はその料理の色） */}
        {ingredients.length > 0 && (
          <div
            data-testid="cook-session-ingredients"
            className="w-full rounded-sm border-l-2 pl-2 text-left"
            style={{ borderLeftColor: color }}
          >
            <p className="ja-phrase">
              {ingredients.map((ing, i) => (
                <span
                  key={`${ing.name}-${i}`}
                  className="mr-3 inline-block whitespace-nowrap"
                  style={
                    ing.seasoningGroup
                      ? { borderBottom: `2px ${seasoningGroupLineStyle(ing.seasoningGroup)} ${color}` }
                      : undefined
                  }
                >
                  {ing.name}
                  {ing.amount && <span className="ml-1 font-bold">{ing.amount}</span>}
                </span>
              ))}
            </p>
          </div>
        )}

        {/* 手作業の目安時間（段取りの一覧と同じ書き分け） */}
        {!isWait && item.activeMinutes > 0 && (
          <p className="w-full text-right text-xs text-ink-muted">
            {(item.activeEstimated ? ja.cookNavi.activeMinutesEstimated : ja.cookNavi.activeMinutes).replace(
              '{n}',
              String(item.activeMinutes),
            )}
          </p>
        )}

        {/* その品がここで出来上がる（段取りの一覧と同じ印） */}
        {isRecipeLast && (
          <p className="w-full text-right">
            <span
              data-testid="cook-session-recipe-done"
              className="inline-block rounded-full px-3 py-0.5 text-sm font-bold"
              style={{ backgroundColor: color, color: 'var(--chip-ink)' }}
            >
              {ja.cookNavi.recipeDone}
            </span>
          </p>
        )}
      </div>

      {/* 下部: 他の品の次の手順を1行ずつ。タップすると全文が出る（カーソルは動かない）。
          2026-08-09 便ES: 行ごとに出していた「確認するだけです〜」は見出しの横に1回だけにし（E-6/E-10）、
          番号は段取りの通し番号とレシピ内の番号の両方（E-7）、本文は画面幅いっぱいの別行で
          文節の切れ目から畳む（E-8）、色の線はレシピ名の横から全文まで1本で通す（E-9） */}
      {others.length > 0 && (
        <div
          data-testid="cook-session-others"
          className="border-t border-edge bg-surface px-[var(--space-md)] py-1"
        >
          <p className="flex flex-wrap items-baseline gap-x-2 text-[10px] text-ink-muted">
            <span className="font-bold">{ja.cookNavi.sessionOthersTitle}</span>
            <span data-testid="cook-session-others-hint">{ja.cookNavi.sessionOthersHint}</span>
          </p>
          {others.map(({ recipeId, item: next }) => {
            const recipe = recipeById.get(recipeId)
            const otherColor = naviRecipeColor(recipe?.colorIndex ?? 0)
            const open = peekRecipeId === recipeId
            const otherTimers = timersByRecipeId.get(recipeId) ?? []
            const nextLabel = next ? recipeStepLabel(next) : undefined
            return (
              // 色の線はこの枠に1本だけ引く＝レシピ名の横から、開いた全文の下端まで続く
              <div
                key={recipeId}
                className="border-l-4 pl-1.5"
                style={{ borderLeftColor: otherColor }}
              >
                <button
                  type="button"
                  data-testid="cook-session-other-row"
                  disabled={!next}
                  onClick={() => setPeekRecipeId(open ? null : recipeId)}
                  aria-expanded={open}
                  aria-label={(open ? ja.cookNavi.sessionPeekCloseAria : ja.cookNavi.sessionPeekOpenAria).replace(
                    '{title}',
                    recipe?.title ?? '',
                  )}
                  className={`w-full text-left ${next ? 'py-1' : 'py-0.5'}`}
                >
                  <span className="flex items-center gap-1">
                    {next && <StepBadge number={next.order} size={20} />}
                    {nextLabel && <StepBadge number={nextLabel} size={18} color={otherColor} />}
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">
                      {recipe?.title}
                    </span>
                    {/* 作り終えた品は、料理名の横に「完成」を置いた1行だけにする
                        （2026-08-10 便FC・オーナー実機「他の品の次の手順『作り終えました』→
                        レシピ名横に『完成』で、１列にする。終わった場所はコンパクトに」）。
                        印は段取りの一覧・調理中の手順と同じ「完成」で、料理の色で塗る */}
                    {!next && (
                      <span
                        data-testid="cook-session-other-done"
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ backgroundColor: otherColor, color: 'var(--chip-ink)' }}
                      >
                        {ja.cookNavi.recipeDone}
                      </span>
                    )}
                  </span>
                  {/* 本文は画面の横幅いっぱいを使う（レシピ名と同じ行に詰め込まない）。
                      作り終えた品には本文の行を作らない＝終わった場所は1行だけになる */}
                  {next && (
                    <span className="ja-phrase mt-0.5 block w-full text-sm">
                      {collapseStepText(next.text, FOLDED_MAX_CHARS)}
                    </span>
                  )}
                </button>
                <Collapse open={Boolean(open && next)}>
                  {next && (
                    <div
                      data-testid="cook-session-peek"
                      className="mb-1 max-h-[28vh] overflow-y-auto rounded-sm bg-app px-2 py-1.5"
                    >
                      <p className="ja-phrase text-sm leading-relaxed">{next.text}</p>
                      {next.memo && (
                        <MemoText text={next.memo} className="mt-1 text-xs text-ink-muted" />
                      )}
                    </div>
                  )}
                </Collapse>
                {/* その品のタイマーはこの行に直接出す（画面上部には出さない。E-11）。
                    2026-08-10 便FC・オーナー実機「タイマーは、他の品の次の手順を開いたら
                    手順の下に来るようにして」: 全文（Collapse）より**後ろ**に置く。
                    畳んでいる間の見え方は変わらない（閉じた折りたたみは高さを持たないため、
                    今までどおり1行の手順のすぐ下に並ぶ） */}
                {otherTimers.length > 0 && (
                  <div
                    data-testid="cook-session-other-timers"
                    className="flex flex-wrap items-center gap-1 pb-1"
                  >
                    {otherTimers.map((t) => (
                      <TimerChip
                        key={t.id}
                        timer={t}
                        now={now}
                        flashing={flashingId === t.id}
                        onOpen={() => setAdjustingId(t.id)}
                        onToggleMute={() => toggleMute(t.id)}
                        onResume={() => resumeTimer(t.id)}
                        onDismiss={() => dismissTimer(t.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 前へ / 次へ（最後の手順では「完成！」。2026-08-10 便EZ・オーナー指示
          「調理中モード『調理を終える』→『完成！』単品の時と揃える」。
          1品の調理中モード（FocusMode）の最終手順と同じ ja.focus.complete を共用する＝
          片方だけ言い方が変わることが構造的に起きない） */}
      <div className="flex gap-2 px-[var(--space-md)] pb-[calc(var(--space-sm)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]">
        <button
          type="button"
          onClick={goPrev}
          disabled={atFirst}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-edge bg-surface py-4 text-lg font-bold text-accent-ink shadow-sm disabled:opacity-30"
        >
          <ChevronLeft size={22} aria-hidden />
          {ja.focus.prev}
        </button>
        {atLast ? (
          <button
            type="button"
            data-testid="cook-session-finish"
            onClick={onFinish}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            <Check size={22} aria-hidden />
            {ja.focus.complete}
          </button>
        ) : (
          <button
            type="button"
            data-testid="cook-session-next"
            onClick={goNext}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            {ja.focus.next}
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
      </div>

      <TermPopover state={termPopoverState} onClose={closeTermPopover} />
      {/* タイマーの調整。この画面では別の画面へ飛ばさず、段取りの中でその手順へカーソルを移す
          （2026-08-09 便ES・オーナー指示E-14「レシピ名タップ→該当手順へ移動」） */}
      <TimerAdjustModal
        timer={adjustingTimer}
        now={now}
        onLabelClick={
          adjustingTimer && adjustingTimerStep ? () => goToTimerStep(adjustingTimer) : undefined
        }
        /* 「手順⑦3-1を開く」（2026-08-10 便FC・オーナー実機「調理中モードでスタートした
           タイマーからの戻り先が調理中モードの手順にしたい」）。この画面では別の画面へ飛ばさず、
           段取りの中でその手順へカーソルを移す＝常駐バーから開いた窓と同じ言い方・同じ着地にする。
           以前はレシピ名のタップにしか道が無く、押せる場所が見た目から分からなかった */
        onGoToStep={
          adjustingTimer && adjustingTimerStep ? () => goToTimerStep(adjustingTimer) : undefined
        }
        onAdjust={(delta) => {
          if (adjustingId !== null) adjustTimer(adjustingId, delta)
        }}
        onStop={() => {
          if (adjustingId !== null) dismissTimer(adjustingId)
          setAdjustingId(null)
        }}
        onClose={() => setAdjustingId(null)}
        onToggleMute={adjustingTimer ? () => toggleMute(adjustingTimer.id) : undefined}
        /* 一時停止／再開（2026-08-10 便EZ。声の「ストップ」で止めたタイマーを戻す道） */
        onTogglePause={
          adjustingTimer
            ? () =>
                adjustingTimer.pausedRemainingMs != null
                  ? resumeTimer(adjustingTimer.id)
                  : pauseTimer(adjustingTimer.id)
            : undefined
        }
        useNaviOrder
      />
    </div>
  )
}
