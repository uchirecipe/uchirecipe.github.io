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
import { formatRemaining, findTimeTokens } from '../logic/time'
import {
  pickVoiceResumeTarget,
  pickVoiceStopTarget,
  resolveVoiceTimerSeconds,
} from '../logic/voiceCommand'
import { naviColorWord, naviRecipeColor } from '../logic/naviColors'
import { seasoningGroupLineStyle } from '../logic/seasoningGroup'
import {
  endsWithLongRest,
  hasLaterHandsOnStep,
  recipeStepLabel,
  showsWaitTimerButton,
  type TimelineItem,
  type TimelineRecipe,
} from '../logic/cookNavi'
import type { NaviIngredientAmount } from '../logic/naviIngredients'
import { recipeNoteStepKey, type RecipeNote } from '../logic/naviRecipeNotes'
import NaviRecipeNotes from './NaviRecipeNotes'
import {
  advanceCursor,
  backCursor,
  collapseStepText,
  findCursorIndex,
  isCursorAtFirst,
  isCursorAtLast,
  nextStepsByRecipe,
  resolveColorMove,
  startCursor,
  type CookCursor,
  type StepPull,
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
  /**
   * レシピ本体のメモを手順ごとに割り当てたもの（2026-08-11 便FM）。
   * キーは手順ごとの材料と同じ `${recipeId}-${stepIndex}`。無い手順には何も出さない
   */
  recipeNotes: Map<string, RecipeNote[]>
  /** カーソルを動かす（呼び出し側が覚え書きに書く） */
  onMove: (next: CookCursor) => void
  /**
   * 色で手順を引き寄せる（2026-08-10 便FI・docs/69 第3段）。
   * 言われた品の手順をいまの位置へ移し、カーソルもそこへ送る（呼び出し側がまとめて行う）。
   */
  onPullStep: (pull: StepPull) => void
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
  /**
   * 1品ずつ順に作る段取りか（2026-08-11 便FL）。並行の余地が無いときは待ち時間に
   * 別の品を差し込まないので、「この間に、次の手作業を進められます」を出さない
   */
  sequential: boolean
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
  recipeNotes,
  onMove,
  onPullStep,
  onExit,
  onFinish,
  onStartTimer,
  sequential,
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
   * **カーソルは動かさない**＝見るだけ（EL-03）。
   * 2026-08-10 便FI で「色を言うとその品の手順に移る」を入れたが、**タップの意味は変えない**。
   * 同じ行に「見る」と「移る」の2つの意味を持たせると、台所で押し間違えたときに
   * どちらが起きたのか分からなくなる。移るのは声だけ、見るのは指だけで分ける。
   */
  const [peekRecipeId, setPeekRecipeId] = useState<number | null>(null)
  /**
   * 「最初の手順へ」を押す直前にいた手順（2026-08-11 便FO・利用者テスト
   * 「閉じる✕のすぐ隣にあるので、押し間違えたら今いる場所を失う（戻る手段は『次へ』を8回）」）。
   * 押したあとだけ「元の手順に戻す」を出して、1回で元の場所へ帰れるようにする。
   * 保存しない一時的な表示状態で、他の移動（次へ・前へ・色）をしたら消える。
   */
  const [undoFirst, setUndoFirst] = useState<CookCursor | null>(null)
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
    // 別の移動をした時点で「元の手順に戻す」は役目を終える（どこへ戻すのかが曖昧になるため）
    setUndoFirst(null)
    onMove(next)
  }
  const goNext = () => move(advanceCursor(items, cursor))
  const goPrev = () => move(backCursor(items, cursor))
  /**
   * 段取りの最初の手順へ（2026-08-10 便FC・オーナー実機「左上に、①に戻るボタンを設置したい」）。
   * 途中から開き直したとき・作り直したいときに、次へ／前へを何回も押さずに先頭へ帰れる。
   *
   * 2026-08-11 便FO: 押した直後だけ「元の手順に戻す」を出す。閉じる✕の隣にある小さなボタンで、
   * 押し間違えると段取りの途中から先頭へ飛ばされ、帰り道が「次へ」の連打しかなかった。
   */
  const goFirst = () => {
    const first = startCursor(items)
    if (!first || atFirst) return
    const from: CookCursor = { recipeId: cursor.recipeId, stepIndex: cursor.stepIndex }
    move(first)
    setUndoFirst(from)
  }

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
   * 声で受けるのは1品の調理中モードと同じ言葉
   *（次へ／戻って／読み上げ／ストップ／再開／タイマー）に、
   * この画面だけの**色**（青・緑・ピンク＝その色の品の手順に移る）を足したもの。
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
      /**
       * 色（「青」「緑」「ピンク」）＝その色の品の手順に移る（2026-08-10 便FI・docs/69 第3段）。
       *
       * 行き先は**下部にその色で出ている行の手順**（logic/cookSession.ts の resolveColorMove が
       * 決める＝下部の行と同じ導出）。移り方は**引き寄せ**＝その手順をいまの位置へ持ってきて、
       * 開いていた手順は1つ後ろに下がる（手順が1つも消えない）。記録もタイマーの削除も
       * 終了も起きない。別の色を言えば移り直せる。
       * 行き先が無いときは理由を返す＝黙って何も起きない状態を作らない。
       */
      onColor: (colorIndex) => {
        const target = resolveColorMove(items, cursor, colorIndex, recipes)
        if (target.kind === 'none') {
          return ja.cookNavi.sessionColorMissing.replace('{color}', naviColorWord(colorIndex))
        }
        const title = recipeById.get(target.recipeId)?.title ?? ''
        if (target.kind === 'current') {
          return ja.cookNavi.sessionColorCurrent.replace('{title}', title)
        }
        if (target.kind === 'done') {
          // 段取りが長い待ちで終わる品は「完成しています」と言わない
          // （2026-08-11 便FL・司令部裁定。画面の「あとは待つだけ」と声を食い違わせない）
          const done = endsWithLongRest(items, target.recipeId)
            ? ja.cookNavi.sessionColorLongRest
            : ja.cookNavi.sessionColorDone
          return done.replace('{title}', title)
        }
        // 前の手順を読みながら次に移らない（move と同じ作法）
        stopSpeech()
        onPullStep({ before: cursor, target: target.cursor })
        return ja.cookNavi.sessionColorMoved.replace('{title}', title)
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
  /** この手順に割り当てたレシピ本体のメモ（2026-08-11 便FM） */
  const currentRecipeNotes = recipeNotes.get(recipeNoteStepKey(item)) ?? []
  // 段取りの一覧と同じ判定（2026-08-11 便FN・logic/cookNavi.ts showsWaitTimerButton）。
  // 「約◯分の待ち時間」と名乗ったブロックには必ずタイマーのボタンを出す
  const showWaitTimerButton = showsWaitTimerButton(item)
  /**
   * 「この間に、次の手作業を進められます」を出すか（2026-08-11 便FL。段取りの一覧と同じ条件）。
   * 後ろに手作業が残っている待ちのときだけ＝1品ずつ作る段取りや、今回の調理では終わらない
   * 長い待ちには出さない
   */
  const showFillHint = isWait && !sequential && !item.longRest && hasLaterHandsOnStep(items, index)
  /**
   * タイマーの置き場所（2026-08-09 便ES・オーナー指示E-11
   * 「大きく表示中のタイマーは画面上、他のタイマーは『他の品の〜』に直接表示」）。
   * いま大きく出している品のタイマーだけを画面上部に置き、他の品のタイマーは
   * その品の行に付ける。どのタイマーがどの料理のものか、目を動かさずに分かるようにする。
   */
  const sortedTimers = sortTimersForDisplay(timers)
  const planRecipeIds = new Set(recipes.map((r) => r.id))
  const timersByRecipeId = new Map<number, typeof sortedTimers>()
  /**
   * 鳴り終わったタイマー（2026-08-11 便FO・利用者テスト「鳴り終わったタイマーが、画面の
   * 一番下に小さく『終わり』と出るだけ。コンロの前で手を動かしているときに、あの位置の
   * あの大きさでは気づけない」）。
   *
   * **どの品のものでも必ず画面の上に、同じ大きさ・同じ場所で出す**。動作中のタイマーの
   * 置き場所（大きく出している品は上・他の品はその行）は変えていないが、終わったものだけは
   * 手順を進めても場所が動かない＝探し直さなくてよい。
   */
  const finishedTimers = sortedTimers.filter((t) => t.done)
  // 段取りに入っていない品のタイマー（並行調理ナビの画面で自分で始めたタイマーなど）は、
  // 置き場所になる行が下部に無いので画面上部に出す
  const currentTimers = sortedTimers.filter(
    (t) => !t.done && (t.recipeId === item.recipeId || !planRecipeIds.has(t.recipeId)),
  )
  for (const t of sortedTimers) {
    if (t.done) continue
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
            置き場所は指示どおり左上のまま。呼び方は「手順①へ」から改めた（2026-08-11 便FO・
            利用者テスト「押すまで意味不明。丸囲みの①はこのアプリの他のどこにも出てこない」）。
            画面の手順番号のバッジは丸の中に普通の数字を描いており、丸囲み数字（①）は
            ここだけで使われていた語だった。何が起きるかをそのまま書く。「戻る」の語を
            使わないのは、下の「前へ」や端末の戻る操作と読み分けられなくなるため。
            先頭にいる間は押せない */}
        <button
          type="button"
          data-testid="cook-session-to-first"
          onClick={goFirst}
          disabled={atFirst}
          className="shrink-0 rounded-md border border-edge bg-surface px-2 py-1.5 text-xs font-bold text-accent-ink shadow-sm disabled:opacity-30"
        >
          {ja.cookNavi.sessionToFirst}
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          {/* 料理名は折り返して全部出す（2026-08-11 便FO・利用者テスト
              「調理中モードの料理名の帯が途中で切れる（『ほうれん草のおひ…』11文字で切れる）。
              読み上げ用のテキストには全部入っている」）。1行に収めるために切っていたが、
              いま何を作っているかは調理中モードで最初に読む情報なので、行数のほうを譲る */}
          <p>
            <span
              data-testid="cook-session-recipe"
              className="ja-phrase inline-block max-w-full rounded-full px-2 py-0.5 text-sm font-bold leading-snug"
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

      {/* 「最初の手順へ」の取り消し（2026-08-11 便FO）。押した直後だけ出て、
          他の移動をすると消える。閉じる✕の隣に置かず、行を分けて誤爆から離す */}
      {undoFirst && findCursorIndex(items, undoFirst) !== -1 && (
        <div className="px-[var(--space-md)] pb-1 text-center">
          <button
            type="button"
            data-testid="cook-session-undo-first"
            onClick={() => move(undoFirst)}
            className="inline-flex items-center gap-1 rounded-md border border-accent bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
          >
            <ChevronLeft size={16} aria-hidden />
            {ja.cookNavi.sessionUndoToFirst}
          </button>
        </div>
      )}

      {/* 声の操作の案内は、声を使っている間だけ出す（2026-08-11 便FO・利用者テスト
          「声を使わないのに、画面の上5行がずっと声の説明で埋まっている。マイクは切ってあるのに
          消えない。一度読めば十分な文章に、狭いスマホ画面の上1/6を毎回使われている」）。
          言葉の一覧は「声で操作」を押してから要るもので、押していない間は場所だけを取っていた。
          手応え（聞き取った言葉・移った品）は、切ったあとも読めるように残す */}
      {micSupported && (listening || voiceMessage) && (
        <p className="px-[var(--space-md)] pb-1 text-center text-xs text-ink-muted">
          {/* 1品の調理中モードと同じ案内に、この画面だけの「色」を足す（2026-08-10 便FI）。
              ja.focus.micHint 自体は FocusMode と共用しているので書き換えない
              ＝色の無い1品の画面に、色の言い方が出てしまうことが構造的に起きない */}
          {listening && (
            <>
              {ja.focus.micHint}
              {ja.cookNavi.sessionMicColorHint}
            </>
          )}
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

      {/* 鳴り終わったタイマー（2026-08-11 便FO）。品を問わず、手順を進めても動かない場所に
          全幅で出す。中身を押すと調整の窓（消音・手順を開く・消す）が開き、右の大きな
          ボタンでその場で消せる＝小さな✕を狙わなくてよい */}
      {finishedTimers.length > 0 && (
        <div
          data-testid="cook-session-finished-timers"
          className="mx-[var(--space-md)] mb-1 max-h-[26vh] space-y-1 overflow-y-auto"
        >
          {finishedTimers.map((t) => (
            <div
              key={t.id}
              style={{ background: 'color-mix(in oklab, var(--warning) 16%, var(--surface))' }}
              className="flex items-center gap-2 rounded-md border-2 border-warning px-2 py-2 shadow-md"
            >
              <button
                type="button"
                onClick={() => setAdjustingId(t.id)}
                aria-label={ja.timer.adjustOpenAria.replace('{label}', t.label)}
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <BellRing size={28} className="shrink-0 animate-pulse text-warning" aria-hidden />
                {/* どの手順のタイマーだったかを、常駐バー・調整の窓と同じ番号の並びで出す */}
                <StepBadge
                  number={
                    t.isCustom || (t.stepNumber <= 0 && t.naviOrder == null)
                      ? 'custom'
                      : (t.naviOrder ?? t.stepNumber)
                  }
                  size={26}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-warning">{t.label}</span>
                  <span className="block text-xl font-bold text-warning">{t.doneLabel}</span>
                </span>
              </button>
              <button
                type="button"
                data-testid="cook-session-finished-dismiss"
                onClick={() => dismissTimer(t.id)}
                className="shrink-0 rounded-md border border-warning bg-surface px-3 py-3 text-sm font-bold text-warning shadow-sm"
              >
                {ja.timer.dismiss}
              </button>
            </div>
          ))}
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

        <p data-testid="cook-session-step-text" className="ja-phrase w-full text-2xl font-bold leading-relaxed">
          <ComposedStepText
            text={item.text}
            ingredientNames={ingredientNames}
            onOpenTerm={openTerm}
            onStartTimer={(_t, seconds) => onStartTimer(item, seconds)}
          />
        </p>

        {/* 2026-08-11 便FL: 手順カードの並びを段取りの一覧にそろえた
            （本文 → 注意書き → 材料 → 待ちブロック）。ここだけ待ちブロックが注意書きより
            上にあり、同じ手順が2つの画面で違う順に見えていた。注意書きは本文の但し書き
            （「焦げやすいので」等）なので本文の直後に読ませ、タイマーは手を動かし終えてから
            押すものなので最後に置く */}
        {item.memo && (
          <div data-testid="cook-session-memo" className="w-full">
            <MemoText text={item.memo} className="w-full text-ink-muted" />
          </div>
        )}

        {/* レシピ本体のメモ（2026-08-11 便FM）。段取りの一覧と同じ位置（本文→手順の注意書き→
            ここ→材料→待ちブロック）に置く。いまやる1手順を大きく出す設計を崩さないよう、
            出すのは**この手順に割り当てた行だけ**で、長いときはこの枠の中だけを送る */}
        <NaviRecipeNotes
          notes={currentRecipeNotes}
          testId="cook-session-recipe-memo"
          className="max-h-[24vh] w-full overflow-y-auto"
        />

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

        {/* 待ち工程の分数とタイマー（段取りの一覧の待ちブロックと同じ内容） */}
        {isWait && (
          <div
            data-testid="cook-session-wait-block"
            className="w-full rounded-sm p-[var(--space-sm)]"
            style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
          >
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span className="inline-flex items-center gap-1 font-bold text-accent-ink">
                <Hourglass size={16} aria-hidden />
                {/* ナビが足した湯沸かしは分数を出さない（2026-08-09 便ES・オーナー指示D-3）。
                    今回の調理では終わらない待ちも分数を出さない（2026-08-11 便FL） */}
                {item.addedByNavi
                  ? ja.cookNavi.waitBlockBoil
                  : item.longRest
                    ? ja.cookNavi.waitBlockLongRest
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
            {/* 段取りの一覧にだけ出ていた「この間に、次の手作業を進められます」を
                調理中の画面にも出す（2026-08-11 便FL）。待ちを仕掛けたあと「次へ」で
                別の品に移ってよいことは、手を動かしている最中こそ要る案内 */}
            {showFillHint && (
              <p data-testid="cook-session-fill-hint" className="mt-1 text-xs text-ink-muted">
                {ja.cookNavi.waitFillHint}
              </p>
            )}
            {item.waitEstimated && (
              <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.waitEstimatedNote}</p>
            )}
            {item.longRest && (
              <p data-testid="cook-session-long-rest" className="mt-1 text-xs text-ink-muted">
                {ja.cookNavi.longRestNote}
              </p>
            )}
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

        {/* その品がここで出来上がる（段取りの一覧と同じ印）。
            最後の手順が長い待ちの品は「完成」と言わない（2026-08-11 便FL・司令部裁定） */}
        {isRecipeLast && (
          <p className="w-full text-right">
            <span
              data-testid={item.longRest ? 'cook-session-recipe-long-rest-done' : 'cook-session-recipe-done'}
              className="inline-block rounded-full px-3 py-0.5 text-sm font-bold"
              style={{ backgroundColor: color, color: 'var(--chip-ink)' }}
            >
              {item.longRest ? ja.cookNavi.recipeDoneLongRest : ja.cookNavi.recipeDone}
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
                  {...(next
                    ? {
                        'aria-expanded': open,
                        'aria-label': (open
                          ? ja.cookNavi.sessionPeekCloseAria
                          : ja.cookNavi.sessionPeekOpenAria
                        ).replace('{title}', recipe?.title ?? ''),
                      }
                    : // 作り終えた品には開く全文が無い。「全文を開く」と名乗らせず、
                      // 読み上げても見たままの「料理名＋完成」になるようにする（2026-08-10 便FC）
                      {})}
                  className={`w-full text-left ${next ? 'py-1' : 'py-0.5'}`}
                >
                  <span className="flex items-center gap-1">
                    {/* 声で言う色の名前（2026-08-10 便FI）。色の帯だけでは何と言えばよいか
                        決められず、ピンクを「赤」と言ってしまう。**この印は押しても移らない**
                        ＝行のタップは今までどおり全文を開くだけ（EL-03）で、移るのは声だけ */}
                    <span
                      data-testid="cook-session-color-word"
                      className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-bold"
                      style={{ backgroundColor: otherColor, color: 'var(--chip-ink)' }}
                    >
                      {naviColorWord(recipe?.colorIndex ?? 0)}
                    </span>
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
                        {/* 段取りが長い待ちで終わる品は「完成」と言わない
                            （2026-08-11 便FL・司令部裁定。手順カードと同じ言い分けにする） */}
                        {endsWithLongRest(items, recipeId)
                          ? ja.cookNavi.recipeDoneLongRest
                          : ja.cookNavi.recipeDone}
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
                      {/* その手順に割り当てたレシピ本体のメモ（2026-08-11 便FM）。
                          「次に何をするか」を先に確かめる場所なので、その手順で読む行も
                          ここで読めるようにする（開いた人だけが見る＝面積は増やさない） */}
                      <NaviRecipeNotes
                        notes={recipeNotes.get(recipeNoteStepKey(next)) ?? []}
                        testId="cook-session-peek-recipe-memo"
                        className="mt-1"
                      />
                      {/* 指でも別の品へ移れるようにする（2026-08-11 便FO・利用者テスト
                          「他の品への切り替えが、画面からはできない。色で飛べるのは声だけで、
                          画面には同じ手段がない。手が濡れていて声も使いたくない私には、
                          次へを連打する以外の選択肢がなかった」）。
                          **行そのものの意味は変えない**（タップ＝全文を開くだけ。2026-08-11
                          オーナー承認済みの設計）。移る操作は、開いて中身を確かめた人だけが
                          押せるこの中に置く＝1つの行に2つの意味を持たせない。
                          動きは声で色を言ったときと同じ引き寄せ（onPullStep）で、手順は
                          1つも消えず、別の品へ言い直すのと同じように移り直せる */}
                      <button
                        type="button"
                        data-testid="cook-session-peek-move"
                        onClick={() => {
                          stopSpeech()
                          setUndoFirst(null)
                          onPullStep({
                            before: cursor,
                            target: { recipeId: next.recipeId, stepIndex: next.stepIndex },
                          })
                        }}
                        className="mt-1 flex w-full items-center justify-center gap-1 rounded-md border border-accent bg-surface py-3 text-sm font-bold text-accent-ink shadow-sm"
                      >
                        <ChevronRight size={16} aria-hidden />
                        {ja.cookNavi.sessionPeekMove}
                      </button>
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
