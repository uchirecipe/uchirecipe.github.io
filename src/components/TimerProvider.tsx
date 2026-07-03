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
import { ja } from '../i18n/ja'

/**
 * タイマーのグローバル管理。
 * App 全体を包んでいるので、タブを移動してもタイマーは動き続ける。
 */

export interface ActiveTimer {
  id: number
  /** 表示名（例: "肉じゃが 10分"） */
  label: string
  /** 終了予定時刻（ミリ秒） */
  endsAt: number
  totalSeconds: number
  done: boolean
}

interface TimerContextValue {
  timers: ActiveTimer[]
  /** 現在時刻（残り時間の計算用。動作中は約0.3秒ごとに更新） */
  now: number
  startTimer: (label: string, seconds: number) => void
  dismissTimer: (id: number) => void
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

function announceFinished(timer: ActiveTimer, audio: AudioContext | undefined) {
  playChime(audio)
  // バイブレーション（対応端末のみ）
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate([300, 120, 300])
  } catch {
    /* 無視 */
  }
  // ブラウザ通知（許可済みのときだけ）
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(ja.timer.notificationTitle, {
        body: ja.timer.notificationBody.replace('{label}', timer.label),
      })
    }
  } catch {
    /* 無視 */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timers, setTimers] = useState<ActiveTimer[]>([])
  const [now, setNow] = useState(() => Date.now())
  const audioRef = useRef<AudioContext>(undefined)

  const startTimer = useCallback((label: string, seconds: number) => {
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
    const timer: ActiveTimer = {
      id: nextTimerId++,
      label,
      endsAt: Date.now() + seconds * 1000,
      totalSeconds: seconds,
      done: false,
    }
    setNow(Date.now())
    setTimers((prev) => [...prev, timer])
  }, [])

  const dismissTimer = useCallback((id: number) => {
    setTimers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const hasRunning = timers.some((t) => !t.done)

  // 動作中だけ時計を進める
  useEffect(() => {
    if (!hasRunning) return
    const interval = setInterval(() => setNow(Date.now()), 300)
    return () => clearInterval(interval)
  }, [hasRunning])

  // 終了したタイマーに合図を出す
  useEffect(() => {
    const finished = timers.filter((t) => !t.done && t.endsAt <= now)
    if (finished.length === 0) return
    finished.forEach((t) => announceFinished(t, audioRef.current))
    setTimers((prev) =>
      prev.map((t) => (t.endsAt <= now ? { ...t, done: true } : t)),
    )
  }, [now, timers])

  return (
    <TimerContext.Provider value={{ timers, now, startTimer, dismissTimer }}>
      {children}
    </TimerContext.Provider>
  )
}

export function useTimers(): TimerContextValue {
  const value = useContext(TimerContext)
  if (!value) throw new Error('useTimers must be used inside TimerProvider')
  return value
}
