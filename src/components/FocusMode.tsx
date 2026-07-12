import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
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
} from 'lucide-react'
import type { Recipe } from '../db/types'
import { useTimers } from './TimerProvider'
import { deriveDoneLabel } from '../logic/timerLabel'
import { findTimeTokens, formatRemaining, isMinutesShownInText } from '../logic/time'
import { collectUniqueTerms } from '../logic/termSplit'
import { renderJaUnits } from './jaUnits'
import StepBadge from './StepBadge'
import TimeText from './TimeText'
import TermText from './TermText'
import TermPopover, { useTermPopover } from './TermPopover'
import { ja } from '../i18n/ja'

type Props = {
  recipe: Recipe
  recipeId: number
  initialStep: number
  onClose: () => void
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
  const { startTimer, timers, now, dismissTimer } = useTimers()
  const [index, setIndex] = useState(initialStep)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const total = recipe.steps.length
  const step = recipe.steps[index]
  const stepNumber = index + 1
  // 用語タップ辞書(2026-07-11): この手順(本文+memo)内で同じ語は最初の1回だけタップ可能にする
  // memo側の既出用語=手順本文の語(純粋導出・StrictMode対策)
  const stepTermSeen = new Set(collectUniqueTerms(step.text).map((c) => c.term))
  const stepTerms = collectUniqueTerms(step.text, step.memo)
  const { state: termPopoverState, open: openTerm, close: closeTermPopover } = useTermPopover()
  // 調理中モードは全画面表示で常駐タイマー(TimerBar)を覆い隠してしまうため、
  // 動作中のタイマーをここにも表示する(押しても反応が無いように見える不具合の対策)
  const recipeTimers = timers.filter((t) => t.recipeId === recipeId)

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

  const stopSpeech = () => {
    if (speechSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // 依存なし(setSpeakingはuseStateの安定した関数)なので、音声認識の効果からも安全に呼べる
  const speak = useCallback((text: string) => {
    if (!speechSupported) return
    const utterance = new SpeechSynthesisUtterance(text)
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

      if (/次|つぎ/.test(transcript)) {
        if (currentIndex < total - 1) {
          stopSpeech()
          setIndex(currentIndex + 1)
        }
      } else if (/戻|もど|前へ|まえ/.test(transcript)) {
        if (currentIndex > 0) {
          stopSpeech()
          setIndex(currentIndex - 1)
        }
      } else if (/もう1?回|もういちど|もう一度/.test(transcript)) {
        speak(currentStep.text)
      } else if (/ストップ|とめて|止めて/.test(transcript)) {
        stopSpeech()
      } else if (/タイマー/.test(transcript)) {
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
          onClick={onClose}
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
        <div className="flex items-center gap-3">
          {micSupported && (
            <button
              type="button"
              onClick={() => setListening((v) => !v)}
              aria-label={listening ? ja.focus.micStop : ja.focus.micStart}
              className={`rounded-full p-3 ${listening ? 'text-accent' : 'text-ink-muted'}`}
            >
              {listening ? (
                <Mic size={24} className="animate-pulse" aria-hidden />
              ) : (
                <MicOff size={24} aria-hidden />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={toggleSpeak}
            disabled={!speechSupported}
            aria-label={speaking ? ja.focus.stop : ja.focus.read}
            className="rounded-full p-3 text-accent disabled:opacity-30"
          >
            {speaking ? <VolumeX size={24} aria-hidden /> : <Volume2 size={24} aria-hidden />}
          </button>
        </div>
      </div>

      {micSupported && (
        <p className="px-[var(--space-md)] pb-1 text-center text-xs text-ink-muted">
          {ja.focus.micHint}
          {listening && <span className="ml-1 font-bold text-accent">{ja.focus.micListening}</span>}
        </p>
      )}

      {recipeTimers.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2 px-[var(--space-md)] pb-1">
          {recipeTimers.map((t) => (
            <div
              key={t.id}
              className={`inline-flex items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1.5 ${
                t.done ? 'border-warning text-warning' : 'border-accent text-accent'
              }`}
            >
              <button
                type="button"
                onClick={() => goTo(t.stepNumber - 1)}
                aria-label={ja.timer.stepLabel.replace('{n}', String(t.stepNumber))}
                className="flex items-center gap-1.5"
              >
                <StepBadge number={t.stepNumber} size={24} />
                <span className="text-lg font-bold tabular-nums">
                  {t.done ? t.doneLabel : formatRemaining(Math.max(0, Math.ceil((t.endsAt - now) / 1000)))}
                </span>
              </button>
              <button
                type="button"
                onClick={() => dismissTimer(t.id)}
                aria-label={ja.timer.dismiss}
                className="rounded-full p-1.5"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex flex-1 flex-col items-center justify-center gap-[var(--space-md)] overflow-y-auto px-[var(--space-lg)] py-[var(--space-md)] text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <StepBadge number={stepNumber} size={56} />
        <p className="ja-phrase w-full text-2xl font-bold leading-relaxed">
          <TermText
            text={step.text}
            onOpenTerm={openTerm}
            renderPlain={(t) => (
              <TimeText text={t} onStart={(_tokenText, seconds) => startStepTimer(seconds)} />
            )}
          />
        </p>
        {step.memo && (
          <MemoText
            text={step.memo}
            className="w-full text-ink-muted"
            onOpenTerm={openTerm}
            seen={stepTermSeen}
          />
        )}
        {stepTerms.length > 0 && (
          <div className="w-full text-sm text-ink-muted md:max-w-md">
            {/* 用語は常時表示にする(2026-07-11オーナー実機フィードバック: タップしないと説明が
                見えないのが不便)。「用語＝説明文」を1行ずつ、最大3語まで表示する。
                説明が長い場合も文節折返し(.ja-phrase)を適用する。
                PCなど広い画面だと左端に寄りすぎる(2026-07-12オーナー実機フィードバック)ため、
                md(768px)以上だけ幅を絞る。親(text-center + items-center の縦flex)が
                中央寄せしてくれるので、margin指定なしでも「中央気味」に収まる。
                375px幅では w-full のまま挙動が変わらないことを確認済み */}
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
                      className="rounded-sm px-1.5 py-0.5 font-bold text-accent underline decoration-dotted underline-offset-2"
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
        {step.minutes != null && step.minutes > 0 && !isMinutesShownInText(step.text, step.minutes) && (
          <button
            type="button"
            onClick={() => startStepTimer((step.minutes ?? 0) * 60)}
            aria-label={ja.timer.start}
            className="inline-flex items-center gap-1 rounded-md px-4 py-2 font-bold text-accent underline underline-offset-2"
            style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
          >
            <TimerIcon size={18} aria-hidden />
            {ja.detail.minutesStandalonePrefix}
            {step.minutes}
            {ja.detail.minutesSuffix}
          </button>
        )}
        {!speechSupported && <p className="w-full text-sm text-ink-muted">{ja.focus.readUnsupported}</p>}
      </div>

      <div className="flex gap-2 px-[var(--space-md)] pb-[calc(var(--space-md)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          className="flex flex-1 items-center justify-center gap-1 rounded-md border border-edge bg-surface py-4 text-lg font-bold text-accent shadow-sm disabled:opacity-30"
        >
          <ChevronLeft size={22} aria-hidden />
          {ja.focus.prev}
        </button>
        {index === total - 1 ? (
          <button
            type="button"
            onClick={onComplete ?? onClose}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md"
          >
            <Check size={22} aria-hidden />
            {ja.focus.complete}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md"
          >
            {ja.focus.next}
            <ChevronRight size={22} aria-hidden />
          </button>
        )}
      </div>
      <TermPopover state={termPopoverState} onClose={closeTermPopover} />
    </div>
  )
}
