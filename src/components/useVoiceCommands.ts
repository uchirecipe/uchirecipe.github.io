import { useCallback, useEffect, useRef, useState } from 'react'
import { matchVoiceColor, matchVoiceCommand } from '../logic/voiceCommand'
import { toSpeechText } from '../logic/toSpeechText'
import { ja } from '../i18n/ja'

/**
 * 「声で操作」と「読み上げ」のフック（2026-08-09 便EL・docs/69）。
 *
 * もとは FocusMode.tsx（調理中モード）だけが持っていた仕組みを、並行調理ナビの
 * 調理中セッション（CookSessionOverlay）と**同じコードで**動かすために切り出した。
 * 2つの画面で聞き取りの言い回しがずれると「片方では効くのに片方では黙る」ことになり、
 * 台所では原因が分からない（FocusMode で実際に起きた「もう一回」が漏れていた事故と同型）。
 *
 * 判定そのものは logic/voiceCommand.ts の純関数（単体テストで語形を固定済み）。
 * ここが持つのは、ブラウザの音声認識・読み上げの扱いと、マイクの許可まわりの案内だけ。
 *
 * **音声で受けるのは、間違っても戻せる操作だけ**（次へ／戻って／読み上げ／ストップ／再開／タイマー）。
 * 記録・タイマーの削除・セッションの終了は、聞き間違いで実行されると取り返しがつかない
 * ので受けない（docs/69「音声の規律」）。
 * 2026-08-10 便EZ: 「ストップ」はタイマーの**一時停止**まで受ける。止めても消えず、
 * 画面の「再開」で元の残り時間から動かし直せる＝可逆なので、この規律の内側に収まる。
 * 2026-08-10 便FC: その戻り道を声にも通した（「再開」）。止める／動かすのどちらも
 * 言い直しで元に戻せるので、規律の内側のまま。読み上げの語は画面のボタン名と同じ
 * 「読み上げ」を主にした（「もう一回」も引き続き受ける）。
 * 2026-08-10 便FI: 並行調理ナビの調理中画面だけ、色（「青」「緑」「ピンク」）で
 * その品の手順に移れるようにした（docs/69 第3段）。動くのは段取りの並びとカーソルだけで、
 * 手順は1つも消えず、記録・タイマーの削除・終了も起きない＝別の色を言えば移り直せるので、
 * これも規律の内側。
 */

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
export const micSupported =
  typeof window !== 'undefined' && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition)

/**
 * マイクの使用がブラウザ側で断られたままになっていないかを調べる（2026-08-03 実機FB①）。
 * 一度「許可しない」を選ぶとブラウザがその判断を覚え、以後は許可を尋ねる画面すら出ないまま
 * 音声認識が即座に失敗する。押しても何も起きないボタンに見えるので、開始する前に確かめる。
 * Permissions API を持たないブラウザ（Safariなど）では判定できないので false を返し、
 * 従来どおり一度開始してみて、失敗（not-allowed）を受けてから案内を出す。
 */
async function isMicPermissionDenied(): Promise<boolean> {
  try {
    const permissions = navigator.permissions
    if (!permissions?.query) return false
    const status = await permissions.query({ name: 'microphone' as PermissionName })
    return status.state === 'denied'
  } catch {
    return false
  }
}

export interface SpeechControls {
  /** いま読み上げ中か */
  speaking: boolean
  /** 読み上げる（用語辞書の読み仮名を発話直前に適用。表示のテキストは変えない） */
  speak: (text: string) => void
  /** 読み上げを止める */
  stopSpeech: () => void
}

/** 手順の読み上げ（Web Speech API）。フックを外れるとき（画面を閉じるとき）に必ず止める */
export function useSpeech(): SpeechControls {
  const [speaking, setSpeaking] = useState(false)

  const stopSpeech = useCallback(() => {
    if (speechSupported) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

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

  useEffect(() => stopSpeech, [stopSpeech])

  return { speaking, speak, stopSpeech }
}

export interface VoiceCommandActions {
  /** 「次へ」 */
  onNext: () => void
  /** 「戻って」 */
  onPrev: () => void
  /** 「読み上げ」＝いま出ている手順を初めから読み上げる（「もう一回」でも同じ） */
  onRepeat: () => void
  /**
   * 「ストップ」＝読み上げを止め、動作中のタイマーを1本だけ一時停止する
   * （2026-08-10 便EZ・オーナー実機「『ストップ』は聞き取れていてもタイマーとまらない」）。
   * どれを止めたかを短い文で返すと、その場の手応えとしてそれを出す（返さなければ従来の
   * 「聞き取りました」のまま）。**止めるのは一時停止まで**＝タイマーを消す・記録する等の
   * 取り消せない操作は声では受けない（docs/69「音声の規律」）。
   */
  onStop: () => string | void
  /**
   * 「再開」＝一時停止しているタイマーを1本だけ動かし直す（2026-08-10 便FC・オーナー実機
   * 「一時停止の後に音声操作で再開できない」）。どれを動かしたかを短い文で返すと、
   * その場の手応えとしてそれを出す。止めてあるタイマーが1本も無ければ何も返さない
   *（画面側は「一時停止中のタイマーはありません」を出す）。
   * **再開は取り消せる操作**（もう一度「ストップ」と言えば止まる）なので声で受けてよい。
   */
  onResume: () => string | void
  /**
   * 「タイマー」。何秒ではかるかは画面側が決める
   * （logic/voiceCommand.ts の resolveVoiceTimerSeconds を使う）。
   * 時間を決められなかったときは false を返す＝言い方の案内をその場に出す。
   */
  onTimer: (transcript: string) => boolean
  /**
   * 色（「青」「緑」「ピンク」）＝その色の品の手順に移る（2026-08-10 便FI・docs/69 第3段。
   * オーナー要望「並行調理ナビ調理中モードの、色で手順入れ替えはいつ実装しますか？」）。
   *
   * **並行調理ナビの調理中画面だけが渡す**。1品の調理中モード（FocusMode）には色が無いので
   * 渡さず、渡されていないときは色の言葉をそもそも見にいかない
   * （＝1品の画面で「青ねぎ」と読み上げても何も起きない状態を保つ）。
   *
   * 行き先が無かったとき（いま開いている品・完成した品・その色の品が無い）に短い文を返すと、
   * その場の手応えとしてそれを出す。**手順は1つも消えない**（その手順をいまの位置へ
   * 引き寄せるだけ）ので、言い直せば戻せる。
   */
  onColor?: (colorIndex: number) => string | void
}

export interface VoiceCommandControls {
  /** このブラウザで音声認識が使えるか（使えなければボタン自体を出さない） */
  micSupported: boolean
  /** 聞き取り中か */
  listening: boolean
  /** 聞き取りの入り切り */
  toggleListening: () => void
  /** マイクの使用がブラウザで断られている（案内を出す） */
  micDenied: boolean
  /** 案内を閉じる */
  dismissMicDenied: () => void
  /** 聞き取れた言葉・エラーのその場の手応え */
  voiceMessage: string
}

/**
 * 音声コマンドの聞き取り。「次へ」「戻って」「読み上げ」「ストップ」「再開」「タイマー」と、
 * 色を受け取る画面でだけ色（「青」「緑」「ピンク」）を受ける。
 *
 * 呼び出し側の処理（actions）は ref 経由で常に最新を見る。
 * 認識オブジェクトを張り直すのは「聞き取りの入り切り」のときだけにして、
 * 手順が進むたびに abort→start が走らないようにする（発話の取りこぼしを防ぐ）。
 */
export function useVoiceCommands(actions: VoiceCommandActions): VoiceCommandControls {
  const [listening, setListening] = useState(false)
  // マイクの使用がブラウザで断られている状態（2026-08-03 実機FB①）。
  // 閉じるまで出しっぱなしにする（1行の手応えでは流れてしまい、気づけなかった）
  const [micDenied, setMicDenied] = useState(false)
  // 声の操作の手応え(2026-07-28 機能④診断C14)。聞き取れた言葉・マイクが使えなかったことを
  // その場に短く出す。以前は認識しても拒否されても画面に何の変化も無く、効いたのか分からなかった
  const [voiceMessage, setVoiceMessage] = useState('')
  const voiceMessageTimeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  const showVoiceMessage = useCallback((message: string, ms = 2500) => {
    setVoiceMessage(message)
    clearTimeout(voiceMessageTimeout.current)
    voiceMessageTimeout.current = setTimeout(() => setVoiceMessage(''), ms)
  }, [])
  useEffect(() => () => clearTimeout(voiceMessageTimeout.current), [])

  /**
   * 「声で操作」の入り切り（2026-08-03 実機FB①）。
   * 断られたままの状態で start しても即座に失敗して黙って戻るだけなので、
   * 始める前に許可の状態を確かめ、断られていたら直し方の案内を出す。
   * ブラウザの設定で許可し直したら、その場で案内を引っ込めて聞き始められるようにする。
   */
  const toggleListening = useCallback(() => {
    setListening((wasListening) => {
      if (wasListening) return false
      void isMicPermissionDenied().then((denied) => {
        setMicDenied(denied)
        if (denied) setListening(false)
      })
      return true
    })
  }, [])

  // ブラウザの設定でマイクを許可し直したら案内を引っ込める（Permissions APIがある環境のみ）
  useEffect(() => {
    if (!micSupported) return
    let status: PermissionStatus | undefined
    const onChange = () => setMicDenied(status?.state === 'denied')
    void (async () => {
      try {
        if (!navigator.permissions?.query) return
        status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        status.addEventListener('change', onChange)
      } catch {
        /* 判定できない環境では何もしない（開始してみて失敗したら案内を出す） */
      }
    })()
    return () => status?.removeEventListener('change', onChange)
  }, [])

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
      // 聞き取れた言葉をその場に短く出す(機能④診断C14)。
      // 手応えが無いと「聞こえたのか・効いたのか」が分からず、同じ言葉を繰り返すことになる
      const feedback = () =>
        showVoiceMessage(ja.focus.micHeard.replace('{text}', transcript.slice(0, 12)))

      // コマンドの言い回し判定は logic/voiceCommand.ts に集約(2026-07-30 便CK/④-1)。
      // 画面に直書きしていたため、案内文どおりの「もう一回」(漢数字)が読み上げのパターンから
      // 漏れていることに誰も気づけなかった(単体テストで語形を固定する)
      const command = matchVoiceCommand(transcript)
      const current = actionsRef.current
      if (command === 'next') {
        feedback()
        current.onNext()
      } else if (command === 'prev') {
        feedback()
        current.onPrev()
      } else if (command === 'repeat') {
        feedback()
        current.onRepeat()
      } else if (command === 'stop') {
        // 止めたタイマーの名前が返ってきたら、それをその場に出す（2026-08-10 便EZ）。
        // 「聞き取りました」だけだと、複数動いているときにどれが止まったのか分からない
        const paused = current.onStop()
        if (paused) showVoiceMessage(paused, 4000)
        else feedback()
      } else if (command === 'resume') {
        // 止めたタイマーを動かし直す（2026-08-10 便FC）。止めるときと同じで、
        // どれが動き出したかを名前で出す。止めてあるものが無いときは、
        // 黙って終わらずに状態を返す（「聞こえていないのか効かないのか」を作らない）
        const resumed = current.onResume()
        if (resumed) showVoiceMessage(resumed, 4000)
        else showVoiceMessage(ja.focus.micNoPausedTimer, 4000)
      } else if (command === 'timer') {
        // 「3分タイマー」のように分数の指定があればそれを使い、
        // 「タイマー」とだけ言った場合は手順に設定された分数→本文中の最初の時間表記の順で探す
        if (current.onTimer(transcript)) {
          feedback()
        } else {
          // 時間の書かれていない手順では何分にすればよいか決められず、聞き取れていても
          // 無反応になっていた(2026-08-03 実機FB⑤)。言い方を同じ場所に出す
          showVoiceMessage(ja.focus.micTimerHint, 5000)
        }
      } else if (current.onColor) {
        // 色（「青」「緑」「ピンク」）は**判定順のいちばん最後**（2026-08-10 便FI）。
        // 上のコマンドが1つも当たらなかったときにだけ見る。しかも当てるのは
        // 発話まるごとが色の名前と一致したときだけなので、「青ねぎを切る」では動かない
        const colorIndex = matchVoiceColor(transcript)
        if (colorIndex != null) {
          // 移れたときは聞き取りの手応えではなく、どの品に移ったかを名前で出す
          //（色の言葉だけでは、どの料理が開いたのか読み上げても分からない）
          const message = current.onColor(colorIndex)
          if (message) showVoiceMessage(message, 4000)
          else feedback()
        }
      }
    }

    // マイクを断られたら、この認識オブジェクトはもう使えない。onend からの自動再開が
    // 「開始→即エラー」を延々と繰り返してしまうため、断られた印を立てて再開を止める
    // (2026-08-03 実機FB①。以前は再開ループの分だけエラーが積み重なっていた)
    let denied = false

    recognition.onerror = (event) => {
      // マイク拒否は聞き続けても無駄なのでOFFにする。無音タイムアウト等はonendから再開に任せる
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        denied = true
        setListening(false)
        // 以前は無言でOFFに戻るだけで、なぜ効かないのかが分からなかった(機能④診断C14)。
        // 2026-08-03 実機FB①: 短い1行では流れてしまうので、直し方の案内を閉じるまで出す
        showVoiceMessage(ja.focus.micDenied, 6000)
        setMicDenied(true)
      }
    }
    recognition.onend = () => {
      if (denied) return
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
  }, [listening, showVoiceMessage])

  return {
    micSupported,
    listening,
    toggleListening,
    micDenied,
    dismissMicDenied: useCallback(() => setMicDenied(false), []),
    voiceMessage,
  }
}
