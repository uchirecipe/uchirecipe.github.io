import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import {
  X,
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
import StepBadge from './StepBadge'
import TimeText from './TimeText'
import { ja } from '../i18n/ja'

type Props = {
  recipe: Recipe
  recipeId: number
  initialStep: number
  onClose: () => void
}

const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const micSupported =
  typeof window !== 'undefined' && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

/**
 * 手順を1つずつ画面いっぱいに表示するモード。
 * スワイプ or 大ボタンで前後に移動でき、読み上げ・音声操作・タイマーもその場で使える。
 * 「画面を暗くしない」設定は詳細画面(呼び出し元)側のWake Lockがそのまま効く。
 */
export default function FocusMode({ recipe, recipeId, initialStep, onClose }: Props) {
  const { startTimer } = useTimers()
  const [index, setIndex] = useState(initialStep)
  const [speaking, setSpeaking] = useState(false)
  const [listening, setListening] = useState(false)
  const touchStartX = useRef<number | null>(null)

  const total = recipe.steps.length
  const step = recipe.steps[index]
  const stepNumber = index + 1

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
      } else {
        const minuteMatch = transcript.match(/(\d+)分/)
        if (minuteMatch) {
          const seconds = Number(minuteMatch[1]) * 60
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
        <span className="font-bold text-ink-muted">
          {ja.focus.stepCounter.replace('{n}', String(stepNumber)).replace('{t}', String(total))}
        </span>
        <div className="flex items-center gap-1">
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
          {listening ? ja.focus.micListening : ja.focus.micHint}
        </p>
      )}

      <div
        className="flex flex-1 flex-col items-center justify-center gap-[var(--space-md)] overflow-y-auto px-[var(--space-lg)] py-[var(--space-md)] text-center"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <StepBadge number={stepNumber} size={56} />
        <p className="text-2xl font-bold leading-relaxed">
          <TimeText text={step.text} onStart={(_tokenText, seconds) => startStepTimer(seconds)} />
        </p>
        {step.memo && <p className="text-ink-muted">{step.memo}</p>}
        {step.minutes != null && step.minutes > 0 && (
          <button
            type="button"
            onClick={() => startStepTimer((step.minutes ?? 0) * 60)}
            aria-label={ja.timer.start}
            className="inline-flex items-center gap-1 rounded-md border border-edge px-4 py-2 font-bold text-accent"
          >
            <TimerIcon size={18} aria-hidden />
            {step.minutes}
            {ja.detail.minutesSuffix}
          </button>
        )}
        {!speechSupported && <p className="text-sm text-ink-muted">{ja.focus.readUnsupported}</p>}
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
        <button
          type="button"
          onClick={() => goTo(index + 1)}
          disabled={index === total - 1}
          className="flex flex-1 items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md disabled:opacity-30"
        >
          {ja.focus.next}
          <ChevronRight size={22} aria-hidden />
        </button>
      </div>
    </div>
  )
}
