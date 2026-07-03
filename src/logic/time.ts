/**
 * 手順の文章から「10分」「1時間半」「30秒」のような時間表記を見つける。
 * 見つけた部分はタップでタイマー開始できるボタンとして表示される。
 */

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
