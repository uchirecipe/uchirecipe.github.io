/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSettings, updateSettings } from '../db/settings'
import { useWakeLock } from './useWakeLock'
import { ja } from '../i18n/ja'

/**
 * タイマーのグローバル管理。
 * App 全体を包んでいるので、タブを移動してもタイマーは動き続ける。
 */

export interface ActiveTimer {
  id: number
  /** 重複起動防止のためのキー（レシピID・手順番号・秒数から組み立てる） */
  key: string
  /** 表示名（例: "肉じゃが・手順3"） */
  label: string
  /** 終了時に表示する文言（例: "煮込み終わり"）。判別できなければ既定の「終わり」 */
  doneLabel: string
  recipeId: number
  /** 手順番号（1始まり。常駐タイマーのタップ先スクロールに使う） */
  stepNumber: number
  /** 終了予定時刻（ミリ秒） */
  endsAt: number
  totalSeconds: number
  done: boolean
  /** このタイマーだけ消音しているか */
  muted: boolean
}

export interface StartTimerOptions {
  /** 重複起動防止キー。同じ手順・同じ時間なら同じキーになるようにする */
  key: string
  label: string
  doneLabel?: string
  seconds: number
  recipeId: number
  stepNumber: number
}

interface TimerContextValue {
  timers: ActiveTimer[]
  /** 現在時刻（残り時間の計算用。動作中は約0.3秒ごとに更新） */
  now: number
  /** 連打などで既に動いているタイマーに気づかせるための、点滅対象タイマーID */
  flashingId: number | null
  /** タイマーの制限（アプリを開いている間だけ動く）を初回だけ知らせるための表示フラグ */
  showFirstTimeNotice: boolean
  dismissFirstTimeNotice: () => void
  startTimer: (options: StartTimerOptions) => void
  dismissTimer: (id: number) => void
  toggleMute: (id: number) => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

let nextTimerId = 1

/** 終了の合図: ピピピと3回鳴らす（音が出せない環境では静かに無視） */
function playChime(ctx: AudioContext | undefined) {
  try {
    const audio = ctx ?? new AudioContext()
    void audio.resume()
    for (let i = 0; i < 3; i++) {
      const at = audio.currentTime + i * 0.45
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      gain.connect(audio.destination)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.4, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      osc.start(at)
      osc.stop(at + 0.4)
    }
  } catch {
    /* 無視 */
  }
}

function announceFinished(timer: ActiveTimer, audio: AudioContext | undefined, soundOn: boolean) {
  if (soundOn && !timer.muted) {
    playChime(audio)
    // バイブレーション（対応端末のみ）
    try {
      if (typeof navigator.vibrate === 'function') navigator.vibrate([300, 120, 300])
    } catch {
      /* 無視 */
    }
  }
  // ブラウザ通知（許可済みのときだけ）。表示上のlabelはレシピ名のみだが、
  // 通知本文はtruncateされないので手順番号も含めた完全な説明にする
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const stepText = ja.timer.stepLabel.replace('{n}', String(timer.stepNumber))
      new Notification(ja.timer.notificationTitle, {
        body: ja.timer.notificationBody.replace('{label}', `${timer.label}・${stepText}`),
      })
    }
  } catch {
    /* 無視 */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [flashingId, setFlashingId] = useState<number | null>(null)
  const [showFirstTimeNotice, setShowFirstTimeNotice] = useState(false)
  const audioRef = useRef<AudioContext>(undefined)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const settings = useSettings()
  const soundOn = settings?.timerSoundEnabled ?? true
  const wakeLockOn = settings?.timerWakeLockEnabled ?? true

  const startTimer = useCallback((options: StartTimerOptions) => {
    // 同じ手順・同じ時間ボタンの連打防止: 既に動作中なら新規起動せず、既存タイマーを点滅で知らせる
    const existing = timers.find((t) => t.key === options.key && !t.done)
    if (existing) {
      setFlashingId(existing.id)
      clearTimeout(flashTimeoutRef.current)
      flashTimeoutRef.current = setTimeout(() => setFlashingId(null), 1200)
      return
    }

    // ボタンを押した瞬間（ユーザー操作中）に音の準備と通知の許可依頼を済ませる
    try {
      audioRef.current ??= new AudioContext()
      void audioRef.current.resume()
    } catch {
      /* 無視 */
    }
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        void Notification.requestPermission()
      }
    } catch {
      /* 無視 */
    }
    // アプリの制限（閉じている間は動かない）を初回だけ知らせる
    if (settings && !settings.timerNoticeShown) {
      setShowFirstTimeNotice(true)
      void updateSettings({ timerNoticeShown: true })
    }
    const timer: ActiveTimer = {
      id: nextTimerId++,
      key: options.key,
      label: options.label,
      doneLabel: options.doneLabel ?? ja.timer.done,
      recipeId: options.recipeId,
      stepNumber: options.stepNumber,
      endsAt: Date.now() + options.seconds * 1000,
      totalSeconds: options.seconds,
      done: false,
      muted: false,
    }
    setNow(Date.now())
    setTimers((prev) => [...prev, timer])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, settings])

  const dismissTimer = useCallback((id: number) => {
    setTimers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toggleMute = useCallback((id: number) => {
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)))
  }, [])

  const dismissFirstTimeNotice = useCallback(() => setShowFirstTimeNotice(false), [])

  const hasRunning = timers.some((t) => !t.done)

  // 動作中だけ時計を進める
  useEffect(() => {
    if (!hasRunning) return
    const interval = setInterval(() => setNow(Date.now()), 300)
    return () => clearInterval(interval)
  }, [hasRunning])

  // タイマーが1本でも動作中は画面を暗くしない。他アプリ等から戻ってきた瞬間に
  // 時計を再同期し、バックグラウンドで止まっていた間に終わったタイマーを即座に反映する
  useWakeLock(hasRunning && wakeLockOn, () => setNow(Date.now()))

  // 終了したタイマーに合図を出す
  useEffect(() => {
    const finished = timers.filter((t) => !t.done && t.endsAt <= now)
    if (finished.length === 0) return
    finished.forEach((t) => announceFinished(t, audioRef.current, soundOn))
    setTimers((prev) =>
      prev.map((t) => (t.endsAt <= now ? { ...t, done: true } : t)),
    )
  }, [now, timers, soundOn])

  return (
    <TimerContext.Provider
      value={{
        timers,
        now,
        flashingId,
        showFirstTimeNotice,
        dismissFirstTimeNotice,
        startTimer,
        dismissTimer,
        toggleMute,
      }}
    >
      {children}
    </TimerContext.Provider>
  )
}

export function useTimers(): TimerContextValue {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useTimers must be used inside TimerProvider')
  return value
}
