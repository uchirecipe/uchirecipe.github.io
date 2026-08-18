import { useEffect, useMemo, useRef, useState, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Bell,
  BellOff,
  Timer as TimerIcon,
  BellRing,
  Pause,
  Play,
  ALargeSmall,
} from 'lucide-react'
import type { Recipe } from '../db/types'
import { useTimers } from './TimerProvider'
import { useSettings, updateSettings } from '../db/settings'
import { deriveDoneLabel } from '../logic/timerLabel'
import { findTimeTokens, formatRemaining, isMinutesShownInText } from '../logic/time'
import { sortTimersForDisplay, stepTimerKey, timerRemainingSeconds, timerAdjustAria} from '../logic/timerOrder'
import { collectUniqueTerms } from '../logic/termSplit'
import { buildIngredientNames } from '../logic/ingredientSpans'
import {
  pickVoiceResumeTarget,
  pickVoiceStopTarget,
  resolveVoiceTimerSeconds,
} from '../logic/voiceCommand'
import {
  micSupported,
  speechSupported,
  useSpeech,
  useVoiceCommands,
} from './useVoiceCommands'
import { renderJaUnits } from './jaUnits'
import StepBadge from './StepBadge'
import ComposedStepText from './ComposedStepText'
import TermPopover, { useTermPopover } from './TermPopover'
import TimerAdjustModal from './TimerAdjustModal'
import CustomTimerModal from './CustomTimerModal'
import VoiceHint from './VoiceHint'
import SpeechReadingHint from './SpeechReadingHint'
import CookTextSizeModal from './CookTextSizeModal'
import { useScrollLock } from './useScrollLock'
import { cookFontSize, resolveCookFontScale } from '../logic/cookFontScale'
import { useAppBusyWhileMounted } from '../logic/appBusy'
import { ja } from '../i18n/ja'

// 自由な時間のタイマー(ja.timer.customLabel「タイマー」)の既定値(秒)。2026-07-12秒刻み対応で分単位のstateを廃止し秒単位に統一
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

/**
 * 手順を1つずつ画面いっぱいに表示するモード。
 * スワイプ or 大ボタンで前後に移動でき、読み上げ・音声操作・タイマーもその場で使える。
 * 「画面を暗くしない」設定は詳細画面(呼び出し元)側のWake Lockがそのまま効く。
 */
export default function FocusMode({ recipe, recipeId, initialStep, onClose, onComplete }: Props) {
  // 調理中は、アプリの更新のお知らせを出さない(2026-08-09 便ER。logic/appBusy.ts)
  useAppBusyWhileMounted()
  const {
    startTimer,
    timers,
    now,
    dismissTimer,
    adjustTimer,
    toggleMute,
    flashingId,
    showFirstTimeNotice,
    dismissFirstTimeNotice,
    pauseTimer,
    resumeTimer,
  } = useTimers()
  const settings = useSettings()
  /** 手順の文字の大きさ（2026-08-12 便FX。設定は調理中モード2画面で共用） */
  const fontScale = resolveCookFontScale(settings?.cookStepFontScale)
  const navigate = useNavigate()
  const [index, setIndex] = useState(initialStep)
  /**
   * 読み上げ・声の操作は components/useVoiceCommands.ts に切り出して、並行調理ナビの
   * 調理中セッション（CookSessionOverlay）と**同じコード**を使う（2026-08-09 便EL・docs/69）。
   * この画面の挙動は切り出し前と同じ（受ける言葉・手応えの出し方・許可まわりの案内は不変）。
   */
  const { speaking, speak, stopSpeech, speechMessage } = useSpeech()
  const touchStartX = useRef<number | null>(null)
  // ±調整の窓（2026-07-12タイマー自由設定）: どのタイマーを調整中か
  const [adjustingId, setAdjustingId] = useState<number | null>(null)
  // 自由な時間のタイマー（ja.timer.customLabel「タイマー」。同バッチ）の窓
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

  // 自由な時間のタイマーの既定値(秒刻み対応・2026-07-12): 新フィールドlastCustomTimerSecondsを優先し、
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
      // 戻り先として手順番号は持たせるが、見た目は時計のバッジにする（2026-08-03 実機FB②）
      isCustom: true,
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
  /** 読み上げを使ったか（2026-08-12 便FX。使った人にだけ、読み方の直し方を1回案内する） */
  const [speechUsed, setSpeechUsed] = useState(false)
  /** 手順の文字の大きさ（2026-08-12 便FX。並行調理ナビの調理中モードと同じ設定を使う） */
  const [textSizeOpen, setTextSizeOpen] = useState(false)

  // 開いている間は背景(レシピ詳細)をスクロールさせない(2026-07-28 機能④診断)。
  // 手順を読むための縦スワイプが背後のページに抜けてしまい、閉じたときに
  // 詳細画面の見当違いな位置へ着地していた。閉じたら開く前の位置へ戻る。
  //
  // 2026-08-16 便HE: ここに直接書いていた「overflow を hidden にする」を、窓ぜんぶで使う
  // 共通の仕組み(useScrollLock)に寄せた。理由は2つ:
  //  ・overflow: hidden だけでは iOS Safari が後ろの画面を送れてしまう(実装上の既知の差)
  //  ・この全画面の上には確認の窓・タイマーの窓が重なる。別々に止めると、上の窓を閉じた瞬間に
  //    下の全画面ぶんの固定まで外れる。共通の仕組みは重なった数を数えるので、そうならない
  useScrollLock(true)

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
    setSpeechUsed(true)
    speak(step.text)
  }

  const startStepTimer = (seconds: number) =>
    startTimer({
      key: stepTimerKey(recipeId, index, seconds),
      label: recipe.title,
      doneLabel: deriveDoneLabel(step.text),
      seconds,
      recipeId,
      stepNumber,
    })

  // 音声コマンド:「次へ」「戻って」「読み上げ」「◯分タイマー」「ストップ」「再開」。
  // 聞き取りの仕組みは components/useVoiceCommands.ts（並行調理ナビの調理中セッションと共用）
  const { listening, toggleListening, micDenied, dismissMicDenied, voiceMessage } =
    useVoiceCommands({
      onNext: () => {
        const currentIndex = indexRef.current
        if (currentIndex < total - 1) {
          stopSpeech()
          setIndex(currentIndex + 1)
        }
      },
      onPrev: () => {
        const currentIndex = indexRef.current
        if (currentIndex > 0) {
          stopSpeech()
          setIndex(currentIndex - 1)
        }
      },
      /**
       * 「最初の手順へ」＝手順1に戻る（2026-08-15 便GS・オーナー実機
       * 「ボタンと同じ表記にも対応したい」）。並行調理ナビの調理中モードには同じ名前の
       * ボタンがあり、声の言葉が画面ごとに違うと「片方では効くのに片方では黙る」ことになる
       */
      onFirst: () => {
        if (indexRef.current === 0) return
        stopSpeech()
        setIndex(0)
      },
      onRepeat: () => {
        const currentStep = recipe.steps[indexRef.current]
        if (!currentStep) return
        setSpeechUsed(true)
        speak(currentStep.text)
      },
      /**
       * 「読み上げストップ」＝読み上げだけを止める（2026-08-15 便GS・オーナー実機
       * 「読み上げをストップする方法が、音声にない」）。タイマーには触らない
       * ＝「ストップ」単独は今までどおりタイマーの一時停止（オーナー「片方優先するならタイマー」）
       */
      onStopSpeech: () => stopSpeech(),
      /**
       * 「ストップ」＝読み上げを止め、動作中のタイマーを1本だけ一時停止する
       * （2026-08-10 便EZ・オーナー実機「『ストップ』は聞き取れていてもタイマーとまらない」）。
       * それまでは読み上げしか止まらず、タイマーは声から一切触れなかった。
       * どれを止めるかは logic/voiceCommand.ts の pickVoiceStopTarget が決める
       * （この料理のタイマー→次に鳴る1本の順）。止めても消えないので言い直しがきく
       */
      onStop: () => {
        stopSpeech()
        const target = pickVoiceStopTarget(timers, recipeId)
        if (!target) return
        pauseTimer(target.id)
        return ja.focus.micTimerPaused.replace('{label}', target.label)
      },
      /**
       * 「再開」＝一時停止しているタイマーを1本だけ動かし直す（2026-08-10 便FC・
       * オーナー実機「一時停止の後に音声操作で再開できない」）。止める声だけがあって
       * 動かす声が無かったので、手が汚れていると画面に触るしかなかった。
       * どれを動かすかは logic/voiceCommand.ts の pickVoiceResumeTarget が決める
       */
      onResume: () => {
        const target = pickVoiceResumeTarget(timers, recipeId)
        if (!target) return
        resumeTimer(target.id)
        return ja.focus.micTimerResumed.replace('{label}', target.label)
      },
      onTimer: (transcript) => {
        const currentIndex = indexRef.current
        const currentStep = recipe.steps[currentIndex]
        if (!currentStep) return false
        // 「3分タイマー」のように分数の指定があればそれを使い、
        // 「タイマー」とだけ言った場合は手順に設定された分数→本文中の最初の時間表記の順で探す
        // (判定は logic/voiceCommand.ts の純関数に集約。2026-08-03 便DS/実機FB⑤)
        const seconds = resolveVoiceTimerSeconds(
          transcript,
          currentStep.minutes,
          findTimeTokens(currentStep.text)[0]?.seconds,
        )
        if (!seconds) return false
        startTimerRef.current({
          key: stepTimerKey(recipeId, currentIndex, seconds),
          label: recipe.title,
          doneLabel: deriveDoneLabel(currentStep.text),
          seconds,
          recipeId,
          stepNumber: currentIndex + 1,
        })
        return true
      },
    })

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
          aria-label={ja.common.close}
          className="tap-target rounded-full p-3 text-ink-muted"
        >
          <X size={24} aria-hidden />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          {/* 調理中モードは手順のみで料理名が分からなかった(2026-07-11オーナー実機フィードバック)ため、
              「手順」表記の上に料理名を表示する。
              2026-08-15 便GX(オーナー実機「ただでさえ狭い画面の上側一列に文字を表示できなくて、
              文字数が多いと隠れてしまいます」): 1行に収める切り詰め(truncate)をやめ、折り返して
              全部出す。390px幅では料理名に使える幅が128pxしかなく、24文字の名前は7文字で切れて
              いた(必要な幅350pxのうち204pxが隠れていた)。並行調理ナビの調理中モード
              (CookSessionOverlay)は2026-08-11 便FOで同じ理由から折り返しに変えてあり、
              1品の画面だけが切り詰めのまま残っていた。行数のほうを譲るのは、いま何を作っているかが
              調理中モードで最初に読む情報のため */}
          <p data-testid="focus-recipe-title" className="ja-phrase text-sm font-bold leading-snug text-ink">
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
            disabled={!speechSupported}
            aria-label={speaking ? ja.focus.stop : ja.focus.read}
            className="flex flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-accent-ink disabled:opacity-30"
          >
            {speaking ? <VolumeX size={24} aria-hidden /> : <Volume2 size={24} aria-hidden />}
            <span className="text-[10px] font-bold leading-none">{ja.focus.readLabel}</span>
          </button>
          {/* 手順の文字の大きさ（2026-08-12 便FX）。並行調理ナビの調理中モードと同じ窓・同じ設定 */}
          <button
            type="button"
            data-testid="cook-text-size-open"
            onClick={() => setTextSizeOpen(true)}
            aria-label={ja.focus.textSizeTitle}
            className="flex flex-col items-center gap-0.5 rounded-md px-1.5 py-1.5 text-accent-ink"
          >
            <ALargeSmall size={24} aria-hidden />
            <span className="text-[10px] font-bold leading-none">{ja.focus.textSizeLabel}</span>
          </button>
          {/* 自由な時間のタイマーの入口(2026-08-15 便GX・オーナー実機「じぶんタイマー
              (起動していない時のアイコン)は横一列潰さずに、アイコンだけ表示にできませんか？」)。
              下のタイマーの行に置いていたときは、タイマーが1本も動いていなくても行だけが残り、
              390px幅で48pxを何も出さずに使っていた。ここへ移すと、動いていない間はその行ごと無くなる。
              文字を添えないのは、レシピ詳細・並行調理ナビの見出しにある同じ入口と同じ形にそろえるため
              (どちらもアイコンのみ・aria-labelは ja.timer.customOpenAria)。読み上げ名はここにも付ける。
              置き場所をこの行に固定したので、タイマーが増えても減っても動かない
              (2026-08-03 実機FB⑥「動いているタイマーが増減しても置き場所が動かない」を保つ) */}
          <button
            type="button"
            data-testid="focus-custom-timer"
            onClick={openCustomTimer}
            aria-label={ja.timer.customOpenAria}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent text-accent-ink"
          >
            <TimerIcon size={20} aria-hidden />
          </button>
        </div>
      </div>

      {/* 声の案内は「声で操作」を聞いている間だけ出す（2026-08-15 便GS）。
          並行調理ナビの調理中モード（CookSessionOverlay）は 2026-08-11 便FO で既にこの形に
          なっていて、同じ部品（VoiceHint）を使いながら**出す条件だけ**がずれていた。
          マイクを切っているときに「『次へ』で手順の移動」と出ていると、その言葉を言っても
          何も起きない＝画面が実態と違うことを言っている状態になる。
          声で操作できること自体は、上の「声で操作」ボタン（micSupportedなら常にある）と
          レシピ詳細の「読み上げ・声での操作・タイマーも使えます」で分かる。
          手応え（聞き取った言葉・マイクが使えなかったこと）は、切ったあとも読めるように残す */}
      {micSupported && (listening || voiceMessage) && (
        <p className="px-[var(--space-md)] pb-1 text-center text-xs text-ink-muted">
          {/* 声で使える言葉の案内（2026-08-12 便FX で3つにまとめ、読み上げだけを目立たせた）。
              並行調理ナビの調理中モードと同じ部品を使う＝片方だけ言い方が変わらない */}
          {listening && <VoiceHint />}
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

      {/* 押したのに読み上げが始まらなかったとき（2026-08-16 便GY）。
          発話が無視されるとエラーの通知も来ないので、これが無いと画面は何も変わらない */}
      {speechMessage && (
        <p
          data-testid="speech-not-started"
          className="ja-phrase px-[var(--space-md)] pb-1 text-center text-xs font-bold text-warning"
        >
          {speechMessage}
        </p>
      )}

      {/* 読み方が合わないときの直し方（2026-08-12 便FX）。読み上げを使ったあと1回だけ出す */}
      <SpeechReadingHint used={speechUsed} />

      {/* マイクがブラウザで断られている案内(2026-08-03 実機FB①)。
          「声で操作」を押しても何も起きないように見える状態の原因と直し方をその場に出す */}
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
            aria-label={ja.common.close}
            className="tap-target shrink-0 rounded-full p-1 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* タイマーバー: 動作中タイマーのバッジ(2026-07-11)。
          2026-08-15 便GX: 1本も動いていないときは行ごと出さない。以前は自由な時間のタイマーの
          ボタンの置き場所として常に出しており、中身が無くても48pxを使っていた。ボタンは上の
          見出しの行へ移したので、置き場所のためだけに行を残す必要がなくなった */}
      {shownTimers.length > 0 && (
      <div className="flex items-start gap-2 px-[var(--space-md)] pb-1">
        <div className="flex max-h-[30vh] min-w-0 flex-1 flex-wrap items-center justify-center gap-2 overflow-x-hidden overflow-y-auto overscroll-contain">
        {shownTimers.map((t) => {
          const isThisRecipe = t.recipeId === recipeId
          // 2026-08-03 実機FB②: どのレシピのタイマーかが分からなかったため、この料理の分も含め
          // 名前を必ず出す(以前はこの料理の手順タイマーだけ名前を省いていた)。
          // 自分で時間を決めたタイマーは名前が「タイマー」・バッジが時計になる
          const isCustom = t.isCustom === true || t.stepNumber <= 0
          const fullLabel =
            t.stepNumber > 0
              ? `${t.label}・${ja.timer.stepLabel.replace('{n}', String(t.stepNumber))}`
              : t.label
          // この料理の終わったタイマーだけ、タップでその手順へ戻る(他の料理の手順番号へは飛べない)。
          // それ以外は調整の窓を開く=残り時間の±も消音も停止も、調理中モードから出ずにできる
          const jumpsToStep = t.done && isThisRecipe && t.stepNumber > 0
          return (
            <div
              key={t.id}
              // 2026-08-03 実機FB⑧: 以前は終了したチップ全体をanimate-pulseで点滅させていたため、
              // 文字ごと薄くなって「終わり」の文言が読み取れない瞬間があった。
              // 点滅はベルのアイコンだけに残し、チップは薄い赤みの面で塗って一目で見分ける
              style={
                t.done
                  ? { background: 'color-mix(in oklab, var(--warning) 14%, var(--surface))' }
                  : undefined
              }
              className={`inline-flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-1.5 pr-1 ${
                t.done ? 'border-warning text-warning' : 'border-accent text-accent-ink'
              } ${flashingId === t.id ? 'animate-pulse ring-2 ring-accent' : ''}`}
            >
              <button
                type="button"
                onClick={() => (jumpsToStep ? goTo(t.stepNumber - 1) : setAdjustingId(t.id))}
                aria-label={
                  jumpsToStep
                    ? ja.timer.goToStep.replace('{n}', String(t.stepNumber))
                    : timerAdjustAria(fullLabel, ja.timer.adjustOpenAria, ja.timer.customLabel)
                }
                className="flex min-w-0 items-center gap-1.5"
              >
                <StepBadge number={isCustom ? 'custom' : t.stepNumber} size={24} />
                {/* 終了の合図(2026-07-28 機能④診断C5): 常駐バー(TimerBar)と同じベル+点滅にそろえる。
                    以前は色が変わるだけの静止ピルで、音を聞き逃すと画面上の手掛かりが実質無かった */}
                {t.done && <BellRing size={16} className="shrink-0 animate-pulse" aria-hidden />}
                <span className="max-w-[7rem] truncate text-xs font-bold">{t.label}</span>
                {/* 止まっていることが数字だけでは分からないので、時間の手前に印を出す(便EZ) */}
                {t.pausedRemainingMs != null && <Pause size={14} className="shrink-0" aria-hidden />}
                <span className="whitespace-nowrap text-base font-bold tabular-nums">
                  {t.done ? t.doneLabel : formatRemaining(timerRemainingSeconds(t, now))}
                </span>
              </button>
              {/* 一時停止中は消音の代わりに「再開」を出す(2026-08-10 便EZ)。止まっているタイマーは
                  もう鳴らないので、ここで要るのは音の入り切りではなく動かし直すこと */}
              {!t.done && t.pausedRemainingMs != null && (
                <button
                  type="button"
                  data-testid="focus-timer-resume"
                  onClick={() => resumeTimer(t.id)}
                  aria-label={ja.timer.resumeAria.replace('{label}', t.label)}
                  className="shrink-0 rounded-full p-1.5 text-accent-ink"
                >
                  <Play size={16} aria-hidden />
                </button>
              )}
              {/* このタイマーだけ消音する(2026-08-03 実機FB④)。常駐バーの行と同じ位置・同じ働き。
                  終わったタイマーには効く音がもう無いので出さない */}
              {!t.done && t.pausedRemainingMs == null && (
                <button
                  type="button"
                  onClick={() => toggleMute(t.id)}
                  aria-label={t.muted ? ja.timer.unmute : ja.timer.mute}
                  className="shrink-0 rounded-full p-1.5 text-ink-muted"
                >
                  {t.muted ? <BellOff size={16} aria-hidden /> : <Bell size={16} aria-hidden />}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismissTimer(t.id)}
                aria-label={ja.timer.dismiss}
                className="tap-target shrink-0 rounded-full p-1.5"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          )
        })}
        </div>
      </div>
      )}

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
            aria-label={ja.common.close}
            className="tap-target shrink-0 rounded-full p-1"
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
        className="flex flex-1 flex-col items-center justify-center-safe gap-[var(--space-md)] overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-lg)] pb-[calc(var(--space-lg)+var(--space-sm))] pt-[var(--space-sm)] text-center"
        /* 文字の大きさ（2026-08-12 便FX）は、この枠の中で大きさを指定していない文字に効く
           ＝手順本文（下で明示）・メモ。番号のバッジ・ボタンは各自の大きさを持つので動かない */
        style={{ fontSize: cookFontSize(1, fontScale) }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <StepBadge number={stepNumber} size={56} />
        <p
          className="ja-phrase w-full font-bold leading-relaxed"
          style={{ fontSize: cookFontSize(1.5, fontScale) }}
        >
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
      <CookTextSizeModal
        open={textSizeOpen}
        scale={fontScale}
        onChange={(next) => void updateSettings({ cookStepFontScale: next })}
        onClose={() => setTextSizeOpen(false)}
      />
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
        /* 一時停止／再開(2026-08-10 便EZ。声の「ストップ」で止めたタイマーを戻す道) */
        onTogglePause={
          adjustingTimer
            ? () =>
                adjustingTimer.pausedRemainingMs != null
                  ? resumeTimer(adjustingTimer.id)
                  : pauseTimer(adjustingTimer.id)
            : undefined
        }
        /* このタイマーを始めた手順へ戻る(2026-08-03 実機FB③)。
           この料理の分は調理中モードの中で手順を送るだけ。別の料理の分は、その料理の
           レシピ詳細の該当手順を開いて調理中モードを閉じる(navigateが履歴を1つ積むので、
           閉じるときの履歴の後始末はそちらに任せる) */
        onGoToStep={
          adjustingTimer && adjustingTimer.stepNumber > 0
            ? adjustingTimer.recipeId === recipeId
              ? () => {
                  const target = adjustingTimer.stepNumber - 1
                  setAdjustingId(null)
                  goTo(target)
                }
              : () => {
                  const { recipeId: otherId, stepNumber: otherStep } = adjustingTimer
                  setAdjustingId(null)
                  navigate(`/recipes/${otherId}?step=${otherStep}`)
                  onClose(index)
                }
            : undefined
        }
        onToggleMute={adjustingTimer ? () => toggleMute(adjustingTimer.id) : undefined}
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
