/**
 * 手順の文章から「10分」「1時間半」「30秒」のような時間表記を見つける。
 * 見つけた部分はタップでタイマー開始できるボタンとして表示される。
 */
import { ja } from '../i18n/ja'

export interface TimeToken {
  /** 文中に現れたままの表記（例: "1時間半"） */
  text: string
  /** 文中での開始位置 */
  start: number
  /** タイマーにする秒数 */
  seconds: number
}

/** 全角数字を半角に直す（文字数が変わらないので位置ズレしない） */
function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
}

// 対応: "1時間" "1時間半" "1時間20分" "10分" "3分半" "30秒"
const TIME_RE =
  /(\d+(?:\.\d+)?)\s*時間\s*(半)?\s*(?:(\d+(?:\.\d+)?)\s*分)?|(\d+(?:\.\d+)?)\s*分\s*(半)?|(\d+(?:\.\d+)?)\s*秒/g

export function findTimeTokens(text: string): TimeToken[] {
  const normalized = normalizeDigits(text)
  const tokens: TimeToken[] = []
  for (const match of normalized.matchAll(TIME_RE)) {
    let seconds = 0
    if (match[1]) {
      seconds =
        Number.parseFloat(match[1]) * 3600 +
        (match[2] ? 1800 : 0) +
        (match[3] ? Number.parseFloat(match[3]) * 60 : 0)
    } else if (match[4]) {
      seconds = Number.parseFloat(match[4]) * 60 + (match[5] ? 30 : 0)
    } else if (match[6]) {
      seconds = Number.parseFloat(match[6])
    }
    seconds = Math.round(seconds)
    if (seconds > 0 && match.index !== undefined) {
      tokens.push({ text: match[0], start: match.index, seconds })
    }
  }
  return tokens
}

/**
 * 手順の分数(step.minutes)と同じ時間が、本文中の時間表記としてすでに書かれているか。
 * 「3分ほど煮る」のように本文とstep.minutesが同じ内容を指している場合、
 * 本文のタップ操作だけで十分なので、別枠のタイマーボタンは表示しない判定に使う
 */
export function isMinutesShownInText(text: string, minutes: number): boolean {
  const seconds = minutes * 60
  return findTimeTokens(text).some((token) => token.seconds === seconds)
}

/** 残り秒数を "08:24" や "1:05:00" の形にする */
export function formatRemaining(totalSeconds: number): string {
  const total = Math.max(0, totalSeconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/**
 * じぶんタイマーの設定値(まだ開始していない秒数)を「3分30秒」のような分+秒表記にする
 * (2026-07-12秒刻み対応・オーナー実機フィードバック)。formatRemainingの"08:24"はカウントダウン中の
 * 表示用でこの画面には合わないため別関数にする。0分・0秒の側は表示を省く(「3分」「30秒」)
 */
export function formatMinutesSecondsLabel(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes === 0) return `${seconds}${ja.timer.secondsSuffix}`
  if (seconds === 0) return `${minutes}${ja.detail.minutesSuffix}`
  return `${minutes}${ja.detail.minutesSuffix}${seconds}${ja.timer.secondsSuffix}`
}
