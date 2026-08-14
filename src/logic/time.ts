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
  /**
   * タイマーにする秒数。**幅のある書き方（「12〜15分」）では短いほう**（2026-08-14 便GK）。
   * 理由は下の `mergeRangeTokens` に書いた。
   */
  seconds: number
  /**
   * その表記が指しうる**いちばん長い**秒数（幅が無ければ `seconds` と同じ）。
   * 段取りの見積り（cookNavi.resolveStepMinutes）と、取り込み時の分数欄への転記はこちらを使う。
   */
  maxSeconds: number
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

/**
 * 幅のある書き方（「12〜15分」）の区切り。全角/半角の波ダッシュ・長音・ハイフンを見る。
 * 「12分〜15分」のように単位が2回書かれる形にも同じ区切りを使う。
 */
const RANGE_SEPARATOR = '[〜～~ー－‐–—―\\-]'
/** 時間表記の**手前**に取り残された範囲の始まり（「…12〜」+「15分」） */
const RANGE_PREFIX_RE = new RegExp(`(?:\\d+(?:\\.\\d+)?)\\s*${RANGE_SEPARATOR}\\s*$`)
/** 2つの時間表記のあいだが区切りだけ（「12分」+「〜」+「15分」） */
const RANGE_JOIN_RE = new RegExp(`^\\s*${RANGE_SEPARATOR}\\s*$`)

/**
 * 「12〜15分」を1つのまとまりとして扱う（2026-08-12 便FU-5・利用者テスト
 * 「『魚焼きグリルの弱火で12〜 ⏱15分 焼く。』— 範囲の『12〜』だけが取り残されて、
 * 時間チップと分断表示になります。『1〜 ⏱2分 煮る』も同様」）。
 *
 * もともとの走査は「15分」「2分」だけを時間表記として拾うので、範囲の前半（「12〜」）が
 * 地の文に残り、チップの手前に意味の切れた数字が浮いていた。前半を取り込んで1つの表記にする。
 *
 * **タイマーにする長さは範囲の短いほう**（2026-08-14 便GK・実操作テスト3回目の原文
 * 「本文は『12〜15分焼く』。ボタンのラベルは『12〜15分 タイマー開始』なのに、表示と実際の待ちは
 *   約15分。チーズがのっているものを最初から15分放置に設定するのは危ない。12分で一度見るほうが
 *   正しい。焦げるかどうかを見るタイミングを潰しています」）。
 * レシピが幅で書いているのは「12分で一度見て、足りなければ15分まで」という意味なので、
 * 上限で鳴らすタイマーは**見るタイミングそのものを消す**。序列「安全 > 正直 > 短縮効果」に従い、
 * 鳴らすのは短いほうにする。
 *
 * **段取りの見積りは長いほうのまま**（`maxSeconds`）。待ちを短く見積もると、その待ちの中へ
 * 差し込む手作業が増えて詰め込みすぎになる（＝待ちが明けても手が戻らない段取りになる）。
 * 鳴らす長さと見積る長さを分けて持つことで、どちらも安全側に倒せる。
 */
function mergeRangeTokens(text: string, tokens: TimeToken[]): TimeToken[] {
  const merged: TimeToken[] = []
  for (const token of tokens) {
    const prev = merged[merged.length - 1]
    const prevEnd = prev ? prev.start + prev.text.length : 0
    const between = text.slice(prevEnd, token.start)
    if (prev && between !== '' && RANGE_JOIN_RE.test(between)) {
      prev.text = text.slice(prev.start, token.start + token.text.length)
      prev.seconds = Math.min(prev.seconds, token.seconds)
      prev.maxSeconds = Math.max(prev.maxSeconds, token.seconds)
      continue
    }
    const head = RANGE_PREFIX_RE.exec(between)
    if (head) {
      const start = token.start - head[0].length
      merged.push({
        text: text.slice(start, token.start + token.text.length),
        start,
        seconds: rangeLowerSeconds(head[0], token),
        maxSeconds: token.seconds,
      })
      continue
    }
    merged.push({ ...token })
  }
  return merged
}

/**
 * 「12〜」＋「15分」の形で、前半（単位が省かれている側）の秒数を出す。
 * 単位は後半の表記のものを使う（「12〜15分」なら分）。読み取れなければ後半と同じ長さにする
 * （＝これまでと同じ挙動。**短く見積もる方向にだけ動かす**）。
 */
function rangeLowerSeconds(headText: string, token: TimeToken): number {
  const head = /(\d+(?:\.\d+)?)/.exec(headText)
  const tail = /(\d+(?:\.\d+)?)/.exec(token.text)
  if (!head || !tail) return token.seconds
  const from = Number.parseFloat(head[1])
  const to = Number.parseFloat(tail[1])
  if (!(from > 0) || !(to > 0) || from >= to) return token.seconds
  return Math.round((token.seconds * from) / to)
}

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
      tokens.push({ text: match[0], start: match.index, seconds, maxSeconds: seconds })
    }
  }
  return mergeRangeTokens(normalized, tokens)
}

/**
 * 手順の分数(step.minutes)と同じ時間が、本文中の時間表記としてすでに書かれているか。
 * 「3分ほど煮る」のように本文とstep.minutesが同じ内容を指している場合、
 * 本文のタップ操作だけで十分なので、別枠のタイマーボタンは表示しない判定に使う
 */
export function isMinutesShownInText(text: string, minutes: number): boolean {
  const seconds = minutes * 60
  // 幅のある書き方（「12〜15分」）は、どちらの端と一致しても「本文に書かれている」と読む
  return findTimeTokens(text).some(
    (token) => token.seconds === seconds || token.maxSeconds === seconds,
  )
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
 * 自由な時間のタイマー（ja.timer.customLabel「タイマー」）の設定値(まだ開始していない秒数)を「3分30秒」のような分+秒表記にする
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
