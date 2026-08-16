/**
 * 手順の読み上げ（Web Speech API）の段取り（2026-08-16 便GY・オーナー実機 iPhone SE2/Safari
 * 「読み上げは、２−３回ONOFF繰り返し押さないと音が出ない気がします。やり方が悪いのか、
 * 音が出るまでにラグがあるだけなのか、、、？」）。
 *
 * ブラウザの読み上げ（speechSynthesis）には、押しても鳴らない形が何通りかある。
 * 実機（iPhone）が手元に無いので、**ブラウザを差し替えて呼ぶ順番を単体テストで固定できる形**に
 * 切り出してある（scripts/test-logic.mjs の SPEAK-01〜07）。React・DOMには依存しない。
 *
 * 直したのは4つ:
 *  ① **何も鳴っていないときは取り消し（cancel）を呼ばない**。iOS/Safari は
 *     「cancel の直後に speak」を同じ流れの中で並べると発話を捨てることがある。
 *     読み直しで取り消しが要るときも、少し間を置いてから話し始める。
 *  ② **一時停止（paused）のまま残っていたら動かし直す（resume）**。この状態の speak は
 *     待ち行列に積まれるだけで音にならない。
 *  ③ **一度読み込めた声を覚えておく**。声の一覧は後から届く（最初の getVoices が空のことがある）。
 *     ただし**声を待って読み上げを遅らせない**＝空なら端末の既定の声で先に話し始める。
 *  ④ **始まった合図（onstart）が来ないまま時間が過ぎたら、言い直す→それでも駄目なら画面に返す**。
 *     speak そのものが無視された場合は onerror も来ないので、黙って終わってしまう。
 *
 * あわせて、**取り消した発話の終了通知を新しい発話のものとして扱わない**ようにした（seq）。
 * 以前は「読み上げ中」の表示だけが先に消え、鳴っているのにボタンが「読み上げ」に戻っていた
 * ＝押すたびに読み直し／停止が交互に入り、オーナーの言う「2〜3回押さないと」に見える形になる。
 */

export interface SpeechVoiceLike {
  readonly lang: string
}

/**
 * 読み上げの通知（onstart/onend/onerror）。ブラウザの SpeechSynthesisUtterance を
 * そのまま受け取れる形にしておく（引数は使わないので never で受ける）。
 */
type UtteranceHandler = ((event: never) => void) | null

export interface SpeechUtteranceLike {
  lang: string
  voice: SpeechVoiceLike | null
  onstart: UtteranceHandler
  onend: UtteranceHandler
  onerror: UtteranceHandler
}

export interface SpeechSynthesisLike {
  readonly speaking: boolean
  readonly pending: boolean
  readonly paused: boolean
  speak(utterance: SpeechUtteranceLike): void
  cancel(): void
  resume(): void
  getVoices(): SpeechVoiceLike[]
}

export type SpeechTimerHandle = unknown

export interface SpeechEngineHost {
  /** ブラウザの読み上げ（window.speechSynthesis）。テストでは替え玉を渡す */
  synth: SpeechSynthesisLike
  /** 読み上げる文を発話に変える（読み仮名の当て込みは呼び出し側で済ませておく） */
  createUtterance(text: string): SpeechUtteranceLike
  setTimer(fn: () => void, ms: number): SpeechTimerHandle
  clearTimer(handle: SpeechTimerHandle): void
  /** 読み上げ中かどうかが変わったとき（ボタンの見た目に使う） */
  onSpeakingChange(speaking: boolean): void
  /** 言い直しても始まらなかったとき（黙って終わらせない） */
  onNotStarted(): void
}

export interface SpeechEngine {
  speak(text: string): void
  stop(): void
  /** 声の一覧を読み直して覚える（voiceschanged から呼ぶ） */
  refreshVoices(): void
}

/** 取り消してから話し直すまでに置く間（ミリ秒） */
export const SPEECH_RESTART_DELAY_MS = 150
/**
 * 始まった合図をここまで待って来なければ、言い直す（ミリ秒）。
 * 実際に鳴り始めるまでは長くても数百ミリ秒なので、待ちすぎない
 * （待つあいだボタンは「止める」の見た目のままになる＝押しても止まるだけになる）
 */
export const SPEECH_START_TIMEOUT_MS = 1200

/** 日本語の声を選ぶ（無ければ端末の既定の声にまかせる） */
function pickJaVoice(voices: SpeechVoiceLike[]): SpeechVoiceLike | null {
  return voices.find((v) => typeof v.lang === 'string' && v.lang.toLowerCase().startsWith('ja')) ?? null
}

export function createSpeechEngine(host: SpeechEngineHost): SpeechEngine {
  /**
   * いま有効な発話の番号。speak / stop のたびに進める。
   * 古い発話から後から届く onend・onerror は、この番号が合わないので無視する
   */
  let seq = 0
  /** 話し始めるまでの待ち（取り消しの直後に speak しないための間） */
  let restartTimer: SpeechTimerHandle | null = null
  /** 始まった合図を待つ見張り */
  let startTimer: SpeechTimerHandle | null = null
  /** 一度読み込めた声の一覧（iOS/Safari は空を返すことがあるので覚えておく） */
  let knownVoices: SpeechVoiceLike[] = []

  const clearTimers = () => {
    if (restartTimer !== null) {
      host.clearTimer(restartTimer)
      restartTimer = null
    }
    if (startTimer !== null) {
      host.clearTimer(startTimer)
      startTimer = null
    }
  }

  const refreshVoices = () => {
    const voices = host.synth.getVoices()
    if (voices && voices.length > 0) knownVoices = voices
  }

  /** 一時停止のまま残っていたら動かし直す（この状態の speak は音にならない） */
  const wakeUp = () => {
    if (host.synth.paused) host.synth.resume()
  }

  /**
   * 実際に話し始める。attempt=0 が最初、1 が言い直し。
   * 言い直しても始まらなければ、鳴らなかったことを呼び出し側へ返す
   */
  const start = (text: string, attempt: number) => {
    const mySeq = ++seq
    const utterance = host.createUtterance(text)
    utterance.lang = 'ja-JP'
    refreshVoices()
    const jaVoice = pickJaVoice(knownVoices)
    if (jaVoice) utterance.voice = jaVoice

    let started = false
    utterance.onstart = () => {
      if (mySeq !== seq) return
      started = true
      if (startTimer !== null) {
        host.clearTimer(startTimer)
        startTimer = null
      }
      host.onSpeakingChange(true)
    }
    utterance.onend = () => {
      if (mySeq !== seq) return
      clearTimers()
      host.onSpeakingChange(false)
    }
    utterance.onerror = () => {
      if (mySeq !== seq) return
      clearTimers()
      host.onSpeakingChange(false)
    }

    wakeUp()
    host.synth.speak(utterance)

    startTimer = host.setTimer(() => {
      startTimer = null
      if (mySeq !== seq || started) return
      // 合図が来ないだけで鳴ってはいる端末もあるので、鳴っているなら何もしない
      if (host.synth.speaking) return
      if (attempt === 0) {
        // 発話が捨てられた形。取り消してから間を置いて言い直す
        host.synth.cancel()
        wakeUp()
        restartTimer = host.setTimer(() => {
          restartTimer = null
          start(text, attempt + 1)
        }, SPEECH_RESTART_DELAY_MS)
        return
      }
      // 言い直しても始まらなかった。読み上げ中の表示のまま残さず、手応えを画面に返す
      host.onSpeakingChange(false)
      host.onNotStarted()
    }, SPEECH_START_TIMEOUT_MS)
  }

  const speak = (text: string) => {
    clearTimers()
    // ここまでの発話の通知を無効にする（後から届く終了通知で表示が消えないように）
    seq++
    // 押した手応えは先に返す（始まった合図を待つと、押しても何も変わらない間ができる）
    host.onSpeakingChange(true)
    wakeUp()
    if (host.synth.speaking || host.synth.pending) {
      // 読み直しのときだけ取り消す。取り消しの直後に続けて話し始めない（発話が捨てられる）
      host.synth.cancel()
      restartTimer = host.setTimer(() => {
        restartTimer = null
        start(text, 0)
      }, SPEECH_RESTART_DELAY_MS)
      return
    }
    // 何も鳴っていないときは取り消しを挟まず、押した操作の流れのまま話し始める
    start(text, 0)
  }

  const stop = () => {
    clearTimers()
    // 待っている発話も、鳴っている発話の終了通知も、ここで切り離す
    seq++
    host.synth.cancel()
    // 一時停止のまま残ると次の読み上げが鳴らないので、ここで解いておく
    wakeUp()
    host.onSpeakingChange(false)
  }

  return { speak, stop, refreshVoices }
}
