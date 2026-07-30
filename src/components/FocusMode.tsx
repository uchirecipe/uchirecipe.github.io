import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { MemoText } from './MemoText'
import {
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Timer as TimerIcon,
  BellRing,
} from 'lucide-react'
import type { Recipe } from '../db/types'
import { useTimers } from './TimerProvider'
import { useSettings, updateSettings } from '../db/settings'
import { deriveDoneLabel } from '../logic/timerLabel'
import { findTimeTokens, formatRemaining, isMinutesShownInText } from '../logic/time'
import { sortTimersForDisplay } from '../logic/timerOrder'
import { collectUniqueTerms } from '../logic/termSplit'
import { buildIngredientNames } from '../logic/ingredientSpans'
import { toSpeechText } from '../logic/toSpeechText'
import { matchVoiceCommand } from '../logic/voiceCommand'
import { renderJaUnits } from './jaUnits'
import StepBadge from './StepBadge'
import ComposedStepText from './ComposedStepText'
import TermPopover, { useTermPopover } from './TermPopover'
import TimerAdjustModal from './TimerAdjustModal'
import CustomTimerModal from './CustomTimerModal'
import { ja } from '../i18n/ja'

// じぶんタイマーの既定値(秒)。2026-07-12秒刻み対応で分単位のstateを廃止し秒単位に統一
const DEFAULT_CUSTOM_TIMER_SECONDS = 180

type Props = {
  recipe: Recipe
  recipeId: number
  initialStep: number
  /**
   * 閉じるとき。引数は「閉じた時点で見ていた手順のindex」(2026-07-28 機能④診断C3)。
   * 呼び出し元がこれを覚えておくことで、材料を見に一度戻ってから開き直しても
   * 手順1に巻き戻らない。手順が無い等で引数なしで呼ばれたときは先頭扱いでよい。
   */
  onClose: (lastStep?: number) => void
  /** 最終手順の「完成！」を押したとき(未指定ならonCloseと同じ)。作った記録への導線に使う */
  onComplete?: () => void
}

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const micSupported =
  typeof window !== 'undefined' && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

/**
 * 手順を1つずつ画面いっぱいに表示するモード。
 * スワイプ or 大ボタンで前後に移動でき、読み上げ・音声操作・タイマーもその場で使える。
 * 「画面を暗くしない」設定は詳細画面(呼び出し元)側のWake Lockがそのまま効く。
 */
export default function FocusMode({ recipe, recipeId, initialStep, onClose, onComplete }: Props) {
  const {
    startTimer,
    timers,
    now,
    dismissTimer,
    adjustTimer,
    flashingId,
    showFirstTimeNotice,
    dismissFirstTimeNotice,
  } = useTimers()
  const settings = useSettings()
  const [index, setIndex] = useState(initialStep)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  // 声の操作の手応え(2026-07-28 機能④診断C14)。聞き取れた言葉・マイクが使えなかったことを
  // その場に短く出す。以前は認識しても拒否されても画面に何の変化も無く、効いたのか分からなかった
  const [voiceMessage, setVoiceMessage] = useState('')
  const touchStartX = useRef<number | null>(null)
  // ±調整の窓（2026-07-12タイマー自由設定）: どのタイマーを調整中か
  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  // じぶんタイマー（自由な分数で始めるタイマー。同バッチ）の窓
  const [customTimerOpen, setCustomTimerOpen] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(DEFAULT_CUSTOM_TIMER_SECONDS)

  const total = recipe.steps.length
  const hasSteps = total > 0
  // 手順0件のレシピでこのモードが開かれた場合の防御(2026-07バグ修正)。
  // 呼び出し元(詳細画面)はボタン自体を隠すが、それ以外の経路から開かれても
  // recipe.steps[index]がundefinedになりstep.textでクラッシュしないよう安全側に倒す。
  // フックは常に同じ順で呼ぶ必要があるため、ここでは早期returnせず末尾でreturn nullする
  useEffect(() => {
    if (!hasSteps) onClose()
  }, [hasSteps, onClose])
  const step = recipe.steps[index]
  const stepNumber = index + 1
  // 手順本文中の材料名に控えめな下線を付けるための名前一覧(正規化・長さ降順。docs/20 §7)
  const ingredientNames = useMemo(() => buildIngredientNames(recipe.ingredients), [recipe.ingredients])
  // 用語タップ辞書(2026-07-11): この手順(本文+memo)内で同じ語は最初の1回だけタップ可能にする
  // memo側の既出用語=手順本文の語(純粋導出・StrictMode対策)。stepが無い(手順0件)場合は空扱い
  const stepTermSeen = step ? new Set(collectUniqueTerms(step.text).map((c) => c.term)) : new Set<string>()
  const stepTerms = step ? collectUniqueTerms(step.text, step.memo) : []
  const { state: termPopoverState, open: openTerm, close: closeTermPopover } = useTermPopover()
  // 調理中モードは全画面表示で常駐タイマー(TimerBar)を覆い隠してしまうため、
  // 動作中のタイマーをここにも表示する(押しても反応が無いように見える不具合の対策)。
  //
  // 2026-07-28 機能④診断C4/C8: 以前は「この料理のタイマー」だけに絞っていたため、
  // 2〜3品を同時に進めているとき、他の料理のタイマーは残り時間も「終わり」表示も見えず
  // ±調整も停止もできなかった(常駐バーは覆われている)。全部を出して、他の料理の分は
  // 料理名を併記する。全画面をやめる・レシピ切替タブを足すといった構造は変えない。
  //
  // 並び順: この料理の分が先、そのあと終わったもの→残りが少ない順(機能④診断C6)。
  // 起動順のままだと先に鳴るタイマーが端に来ることがあり、毎回数字を読み比べる必要があった
  const shownTimers = sortTimersForDisplay(timers).sort(
    (a, b) => Number(b.recipeId === recipeId) - Number(a.recipeId === recipeId),
  )
  const adjustingTimer = timers.find((t) => t.id === adjustingId) ?? null

  // じぶんタイマーの既定値(秒刻み対応・2026-07-12): 新フィールドlastCustomTimerSecondsを優先し、
  // 無ければ旧フィールドlastCustomTimerMinutes(分)を秒に換算して読む(後方互換)。どちらも無ければ既定3分
  const openCustomTimer = () => {
    setCustomSeconds(
      settings?.lastCustomTimerSeconds ??
        (settings?.lastCustomTimerMinutes != null
          ? settings.lastCustomTimerMinutes * 60
          : DEFAULT_CUSTOM_TIMER_SECONDS),
    )
    setCustomTimerOpen(true)
  }

  const startCustomTimer = () => {
    void updateSettings({ lastCustomTimerSeconds: customSeconds })
    startTimer({
      key: `custom-${recipeId}-${customSeconds}`,
      label: ja.timer.customLabel,
      seconds: customSeconds,
      recipeId,
      stepNumber,
    })
    setCustomTimerOpen(false)
  }

  // 音声認識のコールバックは初期化時のクロージャで固定されるため、
  // 最新の手順位置・startTimerを常にrefで参照して古い値を掴まないようにする
  const indexRef = useRef(index)
  useEffect(() => {
    indexRef.current = index
  }, [index])
  const startTimerRef = useRef(startTimer)
  useEffect(() => {
    startTimerRef.current = startTimer
  }, [startTimer])
  // 一度でも読み上げを使ったら、以降は手順が切り替わるたびに自動で読み上げる
  const autoReadRef = useRef(false)

  // 声の操作の手応えを一定時間だけ出す(機能④診断C14)
  const voiceMessageTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const showVoiceMessage = useCallback((message: string, ms = 2500) => {
    setVoiceMessage(message)
    clearTimeout(voiceMessageTimeout.current)
    voiceMessageTimeout.current = setTimeout(() => setVoiceMessage(''), ms)
  }, [])
  useEffect(() => () => clearTimeout(voiceMessageTimeout.current), [])

  const stopSpeech = () => {
    if (speechSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // 依存なし(setSpeakingはuseStateの安定した関数)なので、音声認識の効果からも安全に呼べる
  // 用語辞書の読み仮名を発話直前に適用(表示のtextはそのまま。docs/20 §2)
  const speak = useCallback((text: string) => {
    if (!speechSupported) return
    const utterance = new SpeechSynthesisUtterance(toSpeechText(text))
    utterance.lang = 'ja-JP'
    const jaVoice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith('ja'))
    if (jaVoice) utterance.voice = jaVoice
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }, [])

  // モードを閉じるとき・切り替え中は読み上げを止める
  useEffect(() => stopSpeech, [])

  // 開いている間は背景(レシピ詳細)をスクロールさせない(2026-07-28 機能④診断)。
  // 手順を読むための縦スワイプが背後のページに抜けてしまい、閉じたときに
  // 詳細画面の見当違いな位置へ着地していた。スクロール位置そのものは保たれる
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

  // 端末の「戻る」で調理中モードだけを閉じる(2026-07-28 機能④診断C11)。
  // このモードは画面(ルート)ではなくレシピ詳細の上に重なるだけなので、以前は
  // Androidの戻るジェスチャ・iOSの端スワイプで詳細ページごとレシピ一覧まで戻ってしまい、
  // 復帰に「一覧→レシピ→調理中モード→次へ連打」が必要だった。
  // 開いている間だけ履歴を1つ積み、戻る操作はその1つを消費して閉じるだけに留める。
  // ✕や「完成！」で閉じたときは積んだ履歴を自分で戻して残さない。
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])
  useEffect(() => {
    window.history.pushState({ uchiFocusMode: true }, '')
    const onPopState = () => {
      // 戻る操作で既に履歴は消費済み。ここでは閉じるだけ(自分で history.back しない)
      closeRef.current(indexRef.current)
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      // 自分で閉じた場合だけ、積んだ履歴エントリを取り除く
      if ((window.history.state as { uchiFocusMode?: boolean } | null)?.uchiFocusMode) {
        window.history.back()
      }
    }
  }, [])

  // 読み上げを一度使ったら、手順が切り替わるたびに自動で読み上げる
  // (indexが変わった直後の再レンダリングで実行されるので、その時点の最新stepを読む)
  useEffect(() => {
    if (!autoReadRef.current) return
    speak(recipe.steps[index]?.text ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const goTo = (nextIndex: number) => {
    if (nextIndex < 0 || nextIndex >= total) return
    stopSpeech()
    setIndex(nextIndex)
  }

  const toggleSpeak = () => {
    if (!speechSupported) return
    if (speaking) {
      stopSpeech()
      return
    }
    autoReadRef.current = true
    speak(step.text)
  }

  const startStepTimer = (seconds: number) =>
    startTimer({
      key: `${recipeId}-${index}-${seconds}`,
      label: recipe.title,
      doneLabel: deriveDoneLabel(step.text),
      seconds,
      recipeId,
      stepNumber,
    })

  // 音声コマンド:「次へ」「戻って」「もう一回」「◯分タイマー」「ストップ」
  useEffect(() => {
    if (!listening) return
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) {
      setListening(false)
      return
    }
    const recognition = new Ctor()
    recognition.lang = 'ja-JP'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = (last?.[0]?.transcript ?? '').replace(/\s/g, '')
      if (!transcript) return
      const currentIndex = indexRef.current
      const currentStep = recipe.steps[currentIndex]
      if (!currentStep) return
      const currentStepNumber = currentIndex + 1
      // 聞き取れた言葉をその場に短く出す(機能④診断C14)。
      // 手応えが無いと「聞こえたのか・効いたのか」が分からず、同じ言葉を繰り返すことになる
      const feedback = () =>
        showVoiceMessage(ja.focus.micHeard.replace('{text}', transcript.slice(0, 12)))

      // コマンドの言い回し判定は logic/voiceCommand.ts に集約(2026-07-30 便CK/④-1)。
      // 画面に直書きしていたため、案内文どおりの「もう一回」(漢数字)が読み上げのパターンから
      // 漏れていることに誰も気づけなかった(単体テストで語形を固定する)
      const command = matchVoiceCommand(transcript)
      if (command === 'next') {
        feedback()
        if (currentIndex < total - 1) {
          stopSpeech()
          setIndex(currentIndex + 1)
        }
      } else if (command === 'prev') {
        feedback()
        if (currentIndex > 0) {
          stopSpeech()
          setIndex(currentIndex - 1)
        }
      } else if (command === 'repeat') {
        feedback()
        speak(currentStep.text)
      } else if (command === 'stop') {
        feedback()
        stopSpeech()
      } else if (command === 'timer') {
        feedback()
        // 「3分タイマー」のように分数の指定があればそれを使い、
        // 「タイマー」とだけ言った場合は手順に設定された分数→本文中の最初の時間表記の順で探す
        const minuteMatch = transcript.match(/(\d+)分/)
        const fallbackToken = findTimeTokens(currentStep.text)[0]
        const seconds = minuteMatch
          ? Number(minuteMatch[1]) * 60
          : currentStep.minutes
            ? currentStep.minutes * 60
            : fallbackToken?.seconds
        if (seconds) {
          startTimerRef.current({
            key: `${recipeId}-${currentIndex}-${seconds}`,
            label: recipe.title,
            doneLabel: deriveDoneLabel(currentStep.text),
            seconds,
            recipeId,
            stepNumber: currentStepNumber,
          })
        }
      }
    }

    recognition.onerror = (event) => {
      // マイク拒否は聞き続けても無駄なのでOFFにする。無音タイムアウト等はonendから再開に任せる
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setListening(false)
        // 以前は無言でOFFに戻るだけで、なぜ効かないのかが分からなかった(機能④診断C14)
        showVoiceMessage(ja.focus.micDenied, 6000)
      }
    }
    recognition.onend = () => {
      // ブラウザは無音が続くと自動停止するため、聞いている間は再開し続ける
      try {
        recognition.start()
      } catch {
        /* 既に開始処理中などは無視 */
      }
    }

    try {
      recognition.start()
    } catch {
      /* 無視 */
    }

    return () => {
      recognition.onend = null
      recognition.onerror = null
      recognition.onresult = null
      recognition.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, recipe, recipeId, total, speak])

  // 手順0件の防御: ここまでで全フックを呼び終えているので、以降は何も描画しない
  // (上のuseEffectがonCloseを呼ぶので、呼び出し元は自然に閉じる)
  if (!step) {
    return null
  }

  const onTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.touches[0].clientX
  }
  const onTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (touchStartX.current == null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) < 50) return
    goTo(dx < 0 ? index + 1 : index - 1)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-app">
      <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => onClose(index)}
          aria-label={ja.focus.close}
          className="rounded-full p-3 text-ink-muted"
        >
          <X size={24} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          {/* 調理中モードは手順のみで料理名が分からなかった(2026-07-11オーナー実機フィードバック)ため、
              「手順」表記の上に料理名を表示する。長い料理名はtruncateで省略する */}
          <p className="truncate text-sm font-bold text-ink" title={recipe.title}>
            {recipe.title}
          </p>
          <span className="font-bold text-ink-muted">
            {ja.focus.stepCounter.replace('{n}', String(stepNumber)).replace('{t}', String(total))}
          </span>
        </div>
        {/* アイコンだけでは何のボタンか分からなかった(2026-07-28 機能④診断C15)ため、
            小さな文字で名前を添える。状態(聞き取り中・読み上げ中)は色とアイコンで示し、
            文字は固定にして押すたびに幅が動かないようにする */}
        <div className="flex items-center gap-1">
          {micSupported && (
            <button
              type="button"
              onClick={() => setListening((v) => !v)}
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
            disabled={!speechSupported}
            aria-label={speaking ? ja.focus.stop : ja.focus.read}
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-accent-ink disabled:opacity-30"
          >
            {speaking ? <VolumeX size={24} aria-hidden /> : <Volume2 size={24} aria-hidden />}
            <span className="text-[10px] font-bold leading-none">{ja.focus.readLabel}</span>
          </button>
        </div>
      </div>

      {micSupported && (
        <p className="px-[var(--space-md)] pb-1 text-center text-xs text-ink-muted">
          {ja.focus.micHint}
          {/* 聞いている最中・聞き取れた言葉・マイクが使えなかったことの手応え(機能④診断C14) */}
          {voiceMessage ? (
            <span className={`ml-1 font-bold ${listening ? 'text-accent-ink' : 'text-warning'}`}>
              {voiceMessage}
            </span>
          ) : (
            listening && <span className="ml-1 font-bold text-accent-ink">{ja.focus.micListening}</span>
          )}
        </p>
      )}

      {/* タイマーバー: 動作中タイマーのバッジ(2026-07-11)＋じぶんタイマー起動ボタン(2026-07-12・入口B)。
          タイマーが無い時も「じぶんタイマー」ボタンの置き場所として常に表示する */}
      <div className="flex max-h-[30vh] flex-wrap items-center justify-center gap-2 overflow-y-auto px-[var(--space-md)] pb-1">
        {shownTimers.map((t) => {
          const isThisRecipe = t.recipeId === recipeId
          // この料理の手順タイマー以外は、どれの時間か分かるよう名前を併記する
          // (他の料理=料理名 / じぶんタイマー=「じぶんタイマー」。機能④診断C4・C19)。
          // じぶんタイマーは起動場所によって手順番号が入るため、番号ではなく名前で判定する
          const showLabel = !isThisRecipe || t.label !== recipe.title
          const fullLabel =
            t.stepNumber > 0
              ? `${t.label}・${ja.timer.stepLabel.replace('{n}', String(t.stepNumber))}`
              : t.label
          // この料理の終わったタイマーだけ、タップでその手順へ戻る(他の料理の手順番号へは飛べない)。
          // それ以外は調整の窓を開く=残り時間の±も停止も、調理中モードから出ずにできる
          const jumpsToStep = t.done && isThisRecipe && t.stepNumber > 0
          return (
            <div
              key={t.id}
              className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 ${
                t.done ? 'animate-pulse border-warning text-warning' : 'border-accent text-accent-ink'
              } ${flashingId === t.id ? 'animate-pulse ring-2 ring-accent' : ''} ${
                isThisRecipe ? '' : 'opacity-90'
              }`}
            >
              <button
                type="button"
                onClick={() => (jumpsToStep ? goTo(t.stepNumber - 1) : setAdjustingId(t.id))}
                aria-label={
                  jumpsToStep
                    ? ja.timer.stepLabel.replace('{n}', String(t.stepNumber))
                    : ja.timer.adjustOpenAria.replace('{label}', fullLabel)
                }
                className="flex min-w-0 items-center gap-1.5"
              >
                <StepBadge number={t.stepNumber > 0 ? t.stepNumber : 'custom'} size={24} />
                {/* 終了の合図(2026-07-28 機能④診断C5): 常駐バー(TimerBar)と同じベル+点滅にそろえる。
                    以前は色が変わるだけの静止ピルで、音を聞き逃すと画面上の手掛かりが実質無かった */}
                {t.done && <BellRing size={16} className="shrink-0 animate-pulse" aria-hidden />}
                {showLabel && (
                  <span className="max-w-24 truncate text-xs font-bold">{t.label}</span>
                )}
                <span className="text-lg font-bold tabular-nums">
                  {t.done ? t.doneLabel : formatRemaining(Math.max(0, Math.ceil((t.endsAt - now) / 1000)))}
                </span>
              </button>
              <button
                type="button"
                onClick={() => dismissTimer(t.id)}
                aria-label={ja.timer.dismiss}
                className="shrink-0 rounded-full p-1.5"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )
        })}
        <button
          type="button"
          onClick={openCustomTimer}
          aria-label={ja.timer.customOpenAria}
          className="inline-flex items-center gap-1 rounded-full border border-accent px-3 py-1.5 text-sm font-bold text-accent-ink"
        >
          <TimerIcon size={16} aria-hidden />
          {ja.timer.customBarButton}
        </button>
      </div>

      {/* タイマーの決まりごとの初回案内(2026-07-28 機能④診断C7)。常駐バー(TimerBar)にしか
          描かれておらず、この全画面モードから初めてタイマーを起動すると覆い隠されたまま
          「見せた」ことになり、二度と出せなくなっていた。TimerBarの内容をここにも複製する
          という既存方針(上のバッジ行と同じ)にそろえて、同じ案内をここにも出す */}
      {showFirstTimeNotice && (
        <div className="mx-[var(--space-md)] mb-1 flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-xs text-ink-muted">
          <span className="min-w-0 flex-1">{ja.timer.notice}</span>
          <button
            type="button"
            onClick={dismissFirstTimeNotice}
            aria-label={ja.focus.close}
            className="shrink-0 rounded-full p-1"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      <div
        // 手順テキストの縦位置(2026-07-21オーナー実機フィードバック): 中央揃えのままだと
        // 画面全体で見たとき視線より低く見えるため、上下のpaddingをあえて非対称にして
        // 見た目の重心を少し上へ寄せる(pt<pb。paddingの合計は変えず配分だけ変える手法)
        //
        // justify-center-safe(= justify-content: safe center。2026-07-28 機能④診断C2):
        // 素の justify-center は、中身が枠より高いとき開始側(上)をスクロール原点より外へ
        // 押し出す。scrollTopは負にできないため、長い手順では本文の冒頭が永久に読めなくなる
        // (Chromium系で発生。375x667の同梱レシピ10手順で実測。最大101px欠落)。
        // safe center は「あふれた時だけ flex-start 相当に落ちる」ので、収まる短い手順の
        // 見え方は上のpt<pb裁定を含めて1pxも変わらない
        className="flex flex-1 flex-col items-center justify-center-safe gap-[var(--space-md)] overflow-y-auto px-[var(--space-lg)] pb-[calc(var(--space-lg)+var(--space-sm))] pt-[var(--space-sm)] text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <StepBadge number={stepNumber} size={56} />
        <p className="ja-phrase w-full text-2xl font-bold leading-relaxed">
          <ComposedStepText
            text={step.text}
            ingredientNames={ingredientNames}
            onOpenTerm={openTerm}
            onStartTimer={(_tokenText, seconds) => startStepTimer(seconds)}
          />
        </p>
        {/* 表示順(2026-07-12オーナー実機フィードバック): 本文→単独タイマー→メモ→用語説明の順。
            メモが長いとタイマーボタンが画面外になり押せなくなる不具合の対策 */}
        {step.minutes != null && step.minutes > 0 && !isMinutesShownInText(step.text, step.minutes) && (
          <button
            type="button"
            onClick={() => startStepTimer((step.minutes ?? 0) * 60)}
            aria-label={ja.timer.start}
            className="inline-flex items-center gap-1 rounded-md px-4 py-2 font-bold text-accent-ink underline underline-offset-2"
            style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
          >
            <TimerIcon size={18} aria-hidden />
            {ja.detail.minutesStandalonePrefix}
            {step.minutes}
            {ja.detail.minutesSuffix}
          </button>
        )}
        {step.memo && (
          <MemoText
            text={step.memo}
            className="w-full text-ink-muted"
            onOpenTerm={openTerm}
            seen={stepTermSeen}
          />
        )}
        {stepTerms.length > 0 && (
          <div className="mt-[var(--space-sm)] w-full rounded-md bg-surface p-[var(--space-sm)] text-sm text-ink-muted md:max-w-md">
            {/* 用語は常時表示にする(2026-07-11オーナー実機フィードバック: タップしないと説明が
                見えないのが不便)。「用語＝説明文」を1行ずつ、最大3語まで表示する。
                説明が長い場合も文節折返し(.ja-phrase)を適用する。
                PCなど広い画面だと左端に寄りすぎる(2026-07-12オーナー実機フィードバック)ため、
                md(768px)以上だけ幅を絞る。親(text-center + items-center の縦flex)が
                中央寄せしてくれるので、margin指定なしでも「中央気味」に収まる。
                375px幅では w-full のまま挙動が変わらないことを確認済み。
                2026-07-21オーナー実機フィードバック: 上のメモ(text-ink-muted・背景なし)と
                見た目が同化していたため、mt-[var(--space-sm)]でメモとの間を通常のgapより
                広めに離し、bg-surfaceの薄い面色+角丸+paddingで「用語説明の区画」を
                視覚的に独立させる */}
            {stepTerms.slice(0, 3).map((term) => (
              <p key={term.term} className="ja-phrase text-left leading-snug">
                <span className="font-bold text-ink">{term.term}</span>
                {ja.term.definitionSeparator}
                {renderJaUnits(term.description)}
              </p>
            ))}
            {/* 4語目以降は面積を取りすぎるため、従来どおりタップ式のチップに残す */}
            {stepTerms.length > 3 && (
              <p className="mt-1 text-left">
                {ja.term.chipLabel}
                <span className="ml-1 inline-flex flex-wrap gap-x-1 gap-y-1.5">
                  {stepTerms.slice(3).map((term) => (
                    <button
                      key={term.term}
                      type="button"
                      onClick={(e) => openTerm(term, e.currentTarget)}
                      aria-label={ja.term.openAria.replace('{term}', term.term)}
                      className="rounded-sm px-1.5 py-0.5 font-bold text-accent-ink underline decoration-dotted underline-offset-2"
                      style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
                    >
                      {term.term}
                    </button>
                  ))}
                </span>
              </p>
            )}
          </div>
        )}
        {!speechSupported && <p className="w-full text-sm text-ink-muted">{ja.focus.readUnsupported}</p>}
      </div>

      <div className="flex gap-2 px-[var(--space-md)] pb-[calc(var(--space-md)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-edge bg-surface py-4 text-lg font-bold text-accent-ink shadow-sm disabled:opacity-30"
        >
          <ChevronLeft size={22} aria-hidden />
          {ja.focus.prev}
        </button>
        {index === total - 1 ? (
          <button
            type="button"
            onClick={() => (onComplete ? onComplete() : onClose(0))}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            <Check size={22} aria-hidden />
            {ja.focus.complete}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            {ja.focus.next}
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
      </div>
      <TermPopover state={termPopoverState} onClose={closeTermPopover} />
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
      <CustomTimerModal
        open={customTimerOpen}
        totalSeconds={customSeconds}
        onSecondsChange={setCustomSeconds}
        onStart={startCustomTimer}
        onClose={() => setCustomTimerOpen(false)}
      />
    </div>
  )
}
