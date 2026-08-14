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
import { parseStoredTimers, TIMERS_STORAGE_KEY } from '../logic/timerOrder'
import { naviStepSpeechText } from '../logic/naviStepText'
import {
  TIMER_BEEP_INTERVAL_SECONDS,
  timerSoundBeepCount,
  timerSoundGain,
} from '../logic/timerSound'
import type { TimerSoundLength, TimerSoundVolume } from '../db/types'
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
  /**
   * 手順番号（1始まり。常駐タイマーのタップ先スクロールに使う）。
   * 0 = どの手順にも紐付かない（自由な時間で始めるタイマー=ja.timer.customLabel「タイマー」）
   */
  stepNumber: number
  /** 終了予定時刻（ミリ秒） */
  endsAt: number
  totalSeconds: number
  done: boolean
  /** このタイマーだけ消音しているか */
  muted: boolean
  /**
   * 手順の時間ではなく、自分で時間を決めて始めたタイマーか（2026-08-03 オーナー実機フィードバック②）。
   * 調理中モードから始めると「始めた時点の手順番号」を持つため、番号バッジだけでは
   * 手順の時間をはかるタイマーと見分けが付かなかった。この印が立っているものは
   * 番号ではなく時計のバッジで描く（戻り先としての手順番号は保持したまま）。
   */
  isCustom?: boolean
  /**
   * 並行調理ナビから始めたタイマーか（2026-08-08 便ED・オーナー実機フィードバック②）。
   * 常駐バーのタップでレシピ詳細へ飛ばさず、ナビの該当手順へ戻すために持つ。
   */
  fromNavi?: boolean
  /** ナビのレシピ色の添字（0,1,2）。常駐バーの左端をこの色で塗り、どの料理か一目で分かるようにする */
  naviColorIndex?: number
  /**
   * 並行調理ナビの段取りでの通し番号（2026-08-09 便EH・オーナー実機報告
   * 「タイマーの番号が元のレシピの手順番号のまま」）。
   * 常駐バーの番号バッジはこちらを出す。stepNumber（レシピ内の手順番号）は
   * 戻り先を決めるのに使うので、そのまま持ち続ける。
   */
  naviOrder?: number
  /**
   * そのレシピ内での手順番号の表示（2026-08-09 便ES・オーナー指示E-12
   * 「タイマーのバーの番号がナビの番号のみ・色も違う→両方の番号＋レシピ色」）。
   * レシピの1手順を段取りの上で2つに分けた工程では「3-1」のような形になるので、
   * 数字ではなく文字列で持つ。
   */
  naviStepLabel?: string
  /**
   * 一時停止中の残り（ミリ秒。2026-08-10 便EZ・オーナー実機
   * 「タイマー音声操作→『ストップ』は聞き取れていてもタイマーとまらない」）。
   * 値が入っている間は時計を進めず、終了の合図も出さない。`endsAt` は止めた時点の
   * 終了予定時刻のまま据え置く（保存の後始末「終了から1時間より古い分は捨てる」を
   * そのまま働かせるため）。再開すると「今から残りぶん」で数え直す。
   */
  pausedRemainingMs?: number
}

export interface StartTimerOptions {
  /** 重複起動防止キー。同じ手順・同じ時間なら同じキーになるようにする */
  key: string
  label: string
  doneLabel?: string
  seconds: number
  recipeId: number
  stepNumber: number
  /** 自分で時間を決めて始めたタイマー（ja.timer.customLabel「タイマー」）のとき true */
  isCustom?: boolean
  /** 並行調理ナビから始めたタイマー（戻り先をナビにする・2026-08-08 便ED） */
  fromNavi?: boolean
  /** ナビのレシピ色の添字（0,1,2） */
  naviColorIndex?: number
  /** ナビの段取りでの通し番号（常駐バーの番号バッジに出す） */
  naviOrder?: number
  /** そのレシピ内での手順番号の表示（「3」「3-1」）。常駐バーに段取りの番号と並べて出す */
  naviStepLabel?: string
}

interface TimerContextValue {
  timers: ActiveTimer[]
  /** 現在時刻（残り時間の計算用。動作中は約0.3秒ごとに更新） */
  now: number
  /** 連打などで既に動いているタイマーに気づかせるための、点滅対象タイマーID */
  flashingId: number | null
  /** タイマーの決まりごと（音と通知はアプリを開いている間だけ）を初回だけ知らせるための表示フラグ */
  showFirstTimeNotice: boolean
  dismissFirstTimeNotice: () => void
  startTimer: (options: StartTimerOptions) => void
  dismissTimer: (id: number) => void
  toggleMute: (id: number) => void
  /**
   * 実行中タイマーの残り時間を調整する（±調整の窓。2026-07-12タイマー自由設定）。
   * 完了済み(done)のタイマーには効かない。残りが0を下回る調整は0で止め、即完了扱いにはしない
   * （0になったら通常どおり次のtickで完了フローに乗る）
   */
  adjustTimer: (id: number, deltaSeconds: number) => void
  /**
   * タイマーを一時停止する（2026-08-10 便EZ）。残り時間を覚えて時計を止めるだけで、
   * タイマーは消えない＝**取り消せる操作**なので、声の「ストップ」からも呼べる。
   * 終わったタイマー・すでに止めてあるタイマーには効かない。
   */
  pauseTimer: (id: number) => void
  /** 一時停止したタイマーを、覚えていた残りから動かし直す（同） */
  resumeTimer: (id: number) => void
}

const TimerContext = createContext<TimerContextValue | null>(null)

let nextTimerId = 1

/**
 * 動作中タイマーの端末内保存（2026-07-28 機能④診断C7）。
 * 以前はメモリ内stateだけだったため、リロード・OSによるタブ破棄でタイマーが
 * 無警告で全消滅していた（60分タイマー中の誤操作で全損する）。
 * endsAt は絶対時刻なので、そのまま保存して読み戻すだけで残り時間が正しく復元できる。
 * 読み戻しの規則そのものは src/logic/timerOrder.ts の純関数側にある（単体テスト対象）。
 */
function loadStoredTimers(): ActiveTimer[] {
  let restored: ActiveTimer[] = []
  try {
    restored = parseStoredTimers(localStorage.getItem(TIMERS_STORAGE_KEY), Date.now())
  } catch {
    return []
  }
  // 復元したIDと衝突しないように採番を進める
  for (const t of restored) if (t.id >= nextTimerId) nextTimerId = t.id + 1
  return restored
}

function saveTimers(timers: ActiveTimer[]) {
  try {
    if (timers.length === 0) localStorage.removeItem(TIMERS_STORAGE_KEY)
    else localStorage.setItem(TIMERS_STORAGE_KEY, JSON.stringify(timers))
  } catch {
    /* 保存できない環境（プライベートモード等）では諦める。動作自体は従来どおり続く */
  }
}

/** タイマー終了音の鳴らし方（設定「タイマー音」の音量・長さ。未指定は従来の音） */
export interface TimerChimeOptions {
  volume?: TimerSoundVolume
  length?: TimerSoundLength
}

/**
 * タイマーを持たない場所（設定の試聴ボタン）から鳴らすときに使い回す AudioContext。
 * ブラウザは同時に持てる AudioContext の数を制限しており（Chromeは6個程度）、押すたびに
 * 作ると数回で作れなくなって無音になる。設定で音量を聴き比べるのは押し比べる操作なので、
 * 1本だけ作って使い回す。作れない環境では undefined のまま＝静かに何もしない。
 */
let sharedAudio: AudioContext | undefined
function getSharedAudio(): AudioContext | undefined {
  try {
    sharedAudio ??= new AudioContext()
  } catch {
    return undefined
  }
  return sharedAudio
}

/**
 * 終了の合図: ピピピと鳴らす（音が出せない環境では静かに無視）。
 * 2026-08-08 オーナー実機フィードバック③: 音量と鳴る長さを設定から変えられるようにしたので、
 * 回数とピークの音量を logic/timerSound.ts の対応表から引く。未設定なら従来と同じ音
 * （880Hz・0.45秒間隔で3回・ピーク0.4）。
 *
 * 2026-08-08 オーナー実機フィードバック⑥「音が重なって確認しづらい。他のボタン押下で音は
 * 重複でなく切り替えしたい」: この呼び出しが鳴らす分だけを止める後始末を返す。
 * 呼び出し側（設定の試聴ボタン）が前回の後始末を先に呼べば、鳴っている音を止めてから
 * 次の音に切り替わる。タイマー本体の鳴らし方は変えない＝止めるかどうかは呼び出し側が決める
 * （同時に終わったタイマーの音を、あとから終わった側が消してしまわないようにするため）。
 */
export function playTimerChime(
  ctx: AudioContext | undefined,
  options?: TimerChimeOptions,
): () => void {
  const started: OscillatorNode[] = []
  /** この呼び出しで鳴らす音だけを今すぐ止める（まだ鳴り始めていない分の予約も解除される） */
  const stop = () => {
    for (const osc of started) {
      try {
        osc.stop()
        osc.disconnect()
      } catch {
        /* 既に止まっている分は無視 */
      }
    }
    started.length = 0
  }
  try {
    const audio = ctx ?? getSharedAudio()
    if (!audio) return stop
    void audio.resume().catch(() => {
      /* 無視（ユーザー操作なしのresumeはブラウザによって拒否されることがある） */
    })
    const peak = timerSoundGain(options?.volume)
    const beeps = timerSoundBeepCount(options?.length)
    for (let i = 0; i < beeps; i++) {
      const at = audio.currentTime + i * TIMER_BEEP_INTERVAL_SECONDS
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      gain.connect(audio.destination)
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(peak, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
      osc.start(at)
      osc.stop(at + 0.4)
      started.push(osc)
    }
  } catch {
    /* 無視 */
  }
  return stop
}

/**
 * 終了の合図のうち「その場で鳴る・震える」分だけ（2026-08-03 オーナー実機フィードバック⑦）。
 * 画面を見ていないときに終わった分をあとから鳴らし直すため、通知（1回きりでよい）と分けてある。
 */
function alertFinished(
  timer: ActiveTimer,
  audio: AudioContext | undefined,
  soundOn: boolean,
  chime?: TimerChimeOptions,
) {
  if (soundOn && !timer.muted) {
    playTimerChime(audio, chime)
  }
  // バイブレーション（対応端末のみ）。
  // 2026-07-28 機能④診断C5: 以前はチャイムと同じ `soundOn && !muted` の中にあり、
  // 設定「タイマー音」をOFFにする・その行を消音すると振動まで止まっていた。
  // 「音は出せないが振動で気づきたい」（夜間・子どもが寝ている・イヤホン使用中）が
  // 消音の主目的なので、振動は音の条件から切り離して常に出す。
  // 2026-08-03 オーナー実機フィードバック⑦: 振動の長さを300msから400msに伸ばし、
  // 3拍にする（鍋の音・換気扇の音の中でも気づけるようにするため）。
  // 仕様上、画面が表示されていない間の vibrate は端末側で捨てられるので、
  // その場合は下の再通知（visibilitychange）で戻ってきたときに鳴らし直す
  try {
    if (typeof navigator.vibrate === 'function') navigator.vibrate([400, 150, 400, 150, 400])
  } catch {
    /* 無視 */
  }
}

function announceFinished(
  timer: ActiveTimer,
  audio: AudioContext | undefined,
  soundOn: boolean,
  chime?: TimerChimeOptions,
) {
  alertFinished(timer, audio, soundOn, chime)
  // ブラウザ通知（許可済みのときだけ）。表示上のlabelはレシピ名のみだが、
  // 通知本文はtruncateされないので手順番号も含めた完全な説明にする。
  // stepNumber<=0（手順に紐付かない自由な時間のタイマー）は手順表記を付けない。
  // 並行調理ナビから始めたタイマーは、画面のバッジと同じ「⑦3-1」の呼び方にそろえる
  // （2026-08-10 便EZ・オーナー指示。通知だけ別の番号を名乗ると照合できない）
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      // 通知も耳で読まれる場面があるので、2つの番号を呼び分ける（2026-08-14 便GL）
      const stepText =
        timer.naviOrder != null
          ? naviStepSpeechText(timer.naviOrder, timer.naviStepLabel)
          : timer.stepNumber > 0
            ? ja.timer.stepLabel.replace('{n}', String(timer.stepNumber))
            : null
      const fullLabel = stepText ? `${timer.label}・${stepText}` : timer.label
      new Notification(ja.timer.notificationTitle, {
        body: ja.timer.notificationBody.replace('{label}', fullLabel),
      })
    }
  } catch {
    /* 無視 */
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  // 起動時に端末内の保存分を読み戻す（2026-07-28 機能④診断C7）
  const [timers, setTimers] = useState<ActiveTimer[]>(loadStoredTimers)
  const [now, setNow] = useState(() => Date.now())
  const [flashingId, setFlashingId] = useState<number | null>(null)
  const [showFirstTimeNotice, setShowFirstTimeNotice] = useState(false)
  const audioRef = useRef<AudioContext>(undefined)
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const settings = useSettings()
  const soundOn = settings?.timerSoundEnabled ?? true
  const wakeLockOn = settings?.timerWakeLockEnabled ?? true
  // 音量・鳴る長さ（2026-08-08 オーナー実機フィードバック③）。未設定なら従来と同じ音
  const soundVolume = settings?.timerSoundVolume
  const soundLength = settings?.timerSoundLength
  // 画面が表示されていない間に終わったタイマー（戻ってきたら鳴らし直す。実機FB⑦）
  const pendingAlertRef = useRef<Set<number>>(new Set())
  // 鳴らし直しの効果は張り替えたくないので、最新の値はrefで参照する
  const timersRef = useRef(timers)
  const soundOnRef = useRef(soundOn)
  const chimeRef = useRef<TimerChimeOptions>({ volume: soundVolume, length: soundLength })
  useEffect(() => {
    timersRef.current = timers
  }, [timers])
  useEffect(() => {
    soundOnRef.current = soundOn
  }, [soundOn])
  useEffect(() => {
    chimeRef.current = { volume: soundVolume, length: soundLength }
  }, [soundVolume, soundLength])

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
      void audioRef.current.resume().catch(() => {
        /* 無視（ユーザー操作なしのresumeはブラウザによって拒否されることがある） */
      })
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
    // タイマーの決まりごと（音と通知はアプリを開いている間だけ）を初回だけ知らせる。
    // 2026-07-28 機能④診断C7: この案内は常駐バー(TimerBar)にしか描かれておらず、
    // 全画面の調理中モードから起動すると覆い隠されたままフラグだけ立って二度と出せなく
    // なっていた。調理中モード側にも同じ案内を出すようにした（FocusMode）ので、
    // ここでフラグを立てても「誰にも読まれない」経路は無くなる
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
      isCustom: options.isCustom === true,
      fromNavi: options.fromNavi === true,
      naviColorIndex: options.naviColorIndex,
      naviOrder: options.naviOrder,
      naviStepLabel: options.naviStepLabel,
    }
    setNow(Date.now())
    setTimers((prev) => [...prev, timer])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timers, settings])

  const dismissTimer = useCallback((id: number) => {
    setTimers((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const adjustTimer = useCallback((id: number, deltaSeconds: number) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.done) return t
        // 一時停止中は、覚えている残りのほうを増減する（時計は止めたまま。2026-08-10 便EZ）
        if (t.pausedRemainingMs != null) {
          const remaining = Math.max(0, t.pausedRemainingMs + deltaSeconds * 1000)
          return { ...t, pausedRemainingMs: remaining, endsAt: Date.now() + remaining }
        }
        // 残りが0を下回らないようにする（即完了扱いにはせず、0になったら次のtickで
        // 通常の完了フロー＝音・通知に自然に乗る）
        const newEndsAt = Math.max(Date.now(), t.endsAt + deltaSeconds * 1000)
        return { ...t, endsAt: newEndsAt }
      }),
    )
    setNow(Date.now())
  }, [])

  /**
   * 一時停止（2026-08-10 便EZ）。残りを覚えて時計を止める。
   * `endsAt` は据え置く＝止めた時点の「本来の終了予定時刻」を保つ（保存の後始末で使う）。
   */
  const pauseTimer = useCallback((id: number) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.done || t.pausedRemainingMs != null) return t
        return { ...t, pausedRemainingMs: Math.max(0, t.endsAt - Date.now()) }
      }),
    )
    setNow(Date.now())
  }, [])

  /** 再開。覚えていた残りを、いまから数え直す */
  const resumeTimer = useCallback((id: number) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id || t.pausedRemainingMs == null) return t
        return { ...t, endsAt: Date.now() + t.pausedRemainingMs, pausedRemainingMs: undefined }
      }),
    )
    setNow(Date.now())
  }, [])

  const toggleMute = useCallback((id: number) => {
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)))
  }, [])

  const dismissFirstTimeNotice = useCallback(() => setShowFirstTimeNotice(false), [])

  // 動作中タイマーを端末内に保存する（2026-07-28 機能④診断C7）。
  // 起動・±調整・停止・完了のたびに配列そのものが差し替わるので、この1本で全経路を拾える
  useEffect(() => {
    saveTimers(timers)
  }, [timers])

  // 一時停止中のタイマーは時計も画面の点灯も要らない（2026-08-10 便EZ）
  const hasRunning = timers.some((t) => !t.done && t.pausedRemainingMs == null)

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
    // 一時停止中は終了の合図を出さない（止めたまま予定時刻を過ぎても鳴らない。便EZ）
    const finished = timers.filter((t) => !t.done && t.pausedRemainingMs == null && t.endsAt <= now)
    if (finished.length === 0) return
    const hidden = typeof document !== 'undefined' && document.hidden
    finished.forEach((t) => {
      announceFinished(t, audioRef.current, soundOn, { volume: soundVolume, length: soundLength })
      // 画面が表示されていない間の振動・音はブラウザ側で捨てられる（振動は仕様で明示的に中止、
      // 音も自動再生の制限で鳴らないことがある）。戻ってきたときに鳴らし直すため覚えておく
      if (hidden) pendingAlertRef.current.add(t.id)
    })
    setTimers((prev) =>
      prev.map((t) => (t.pausedRemainingMs == null && t.endsAt <= now ? { ...t, done: true } : t)),
    )
  }, [now, timers, soundOn, soundVolume, soundLength])

  /**
   * 画面に戻ってきたときの鳴らし直し（2026-08-03 オーナー実機フィードバック⑦）。
   * 他のアプリを見ている間・画面が消えている間にタイマーが終わると、その瞬間の振動と音は
   * 端末側で捨てられ、戻ってきても「終わり」の表示が出ているだけで何も起きなかった。
   * まだ片付けていない（画面に残っている）分だけ、戻ってきた時点で一度だけ鳴らし直す。
   * 通知は終わった時点で1回出ているので、ここでは出さない（二重通知にしない）。
   */
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) return
      setNow(Date.now())
      const pending = pendingAlertRef.current
      if (pending.size === 0) return
      const ids = [...pending]
      pending.clear()
      for (const id of ids) {
        const t = timersRef.current.find((x) => x.id === id)
        if (t?.done) alertFinished(t, audioRef.current, soundOnRef.current, chimeRef.current)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

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
        adjustTimer,
        pauseTimer,
        resumeTimer,
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
