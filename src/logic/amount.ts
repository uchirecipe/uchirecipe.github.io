// 大さじ・小さじ・カップ(計量スプーン/カップ類): 0.25刻み
const SPOON_UNITS = new Set(['大さじ', '小さじ', 'カップ'])
// 個数として数える単位: 0.5刻み(最小0.5、0にはしない)
const COUNT_UNITS = new Set([
  '個', '本', '枚', '切れ', '丁', '缶', '袋', '束', 'かけ', '尾', '玉', '株', '合', '片', '箱', '杯',
])
// 重量・容量: 10未満は整数、10以上は5刻み、100以上は10刻み
const WEIGHT_VOLUME_UNITS = new Set(['g', 'ml', 'cc'])
// 帯分数(「1と1/2」)で表示する単位(個数系・スプーン系)。
// 原稿の基準人数表記が分数(1/2等)のため、人数変更後の表示もここで分数に揃える(2026-07-07 Fable相談・ユーザー決定)。
const FRACTION_DISPLAY_UNITS = new Set([...COUNT_UNITS, ...SPOON_UNITS])

/** 表示用に丸めた分量の数値を返す（単位ごとの丸め幅、5章の設計表どおり） */
function roundForDisplay(value: number, unit?: string): number {
  if (unit && SPOON_UNITS.has(unit)) {
    return Math.round(value * 4) / 4
  }
  if (unit && COUNT_UNITS.has(unit)) {
    return Math.max(0.5, Math.round(value * 2) / 2)
  }
  if (unit && WEIGHT_VOLUME_UNITS.has(unit)) {
    // 0より大きい値が丸めで0表示になるのを防ぐ（最小1、B8）
    if (value < 10) return value > 0 ? Math.max(1, Math.round(value)) : 0
    if (value < 100) return Math.round(value / 5) * 5
    return Math.round(value / 10) * 10
  }
  // その他の単位は現状維持: 小数第2位まで（末尾の0は消す）
  return Math.round(value * 100) / 100
}

/**
 * 0.25刻み・0.5刻みに丸め済みの数値を帯分数の文字列にする。
 * 例: 1.5→"1と1/2"、3.75→"3と3/4"、0.5→"1/2"、2→"2"
 */
function formatFraction(value: number): string {
  const whole = Math.floor(value)
  const frac = value - whole
  const fracLabel = frac === 0.25 ? '1/4' : frac === 0.5 ? '1/2' : frac === 0.75 ? '3/4' : ''
  if (!fracLabel) return String(whole)
  if (whole === 0) return fracLabel
  return `${whole}と${fracLabel}`
}

/** 全角数字・全角の「／」「．」を半角にする（分量入力の表記ゆれ対策） */
export function normalizeDigits(text: string): string {
  return text.replace(/[０-９／．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

/**
 * 分量の人数換算。
 * "3"（3個）や "1/2" のような数字は人数に合わせて掛け算し、
 * "少々" "適量" のような言葉はそのまま返す。
 * 表示専用の丸め処理（保存データそのものは変更しない）。
 * 個数系・計量スプーン系の単位は帯分数（例:「1と1/2」）で返す。基準人数時点の分数表記(原稿の書き方)と
 * 人数変更後の見た目を揃えるため（g/ml/cc等はこれまでどおり整数・小数のまま）。
 * 全角数字("２"等)で保存された分量も、半角に正規化してから解釈する（人数変更で反応しない不具合対策）。
 */
export function scaleAmount(
  amount: string,
  baseServings: number,
  targetServings: number,
  unit?: string,
): string {
  const trimmed = normalizeDigits(amount.trim())
  if (!trimmed || baseServings <= 0 || baseServings === targetServings) {
    // 人数を変えていなくても、全角数字は半角に正規化して返す(基準人数表示でも正しく見えるように)
    return trimmed || amount
  }

  // 対応する形: "200" "1.5" "1/2"
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
  if (!match) return amount

  let value = Number.parseFloat(match[1])
  const denominator = match[2] ? Number.parseFloat(match[2]) : undefined
  if (denominator) {
    if (denominator === 0) return amount
    value /= denominator
  }

  const scaled = (value * targetServings) / baseServings
  const rounded = roundForDisplay(scaled, unit)
  if (unit && FRACTION_DISPLAY_UNITS.has(unit)) {
    return formatFraction(rounded)
  }
  return String(rounded)
}

/**
 * 分量と単位を、日本語として自然な順序の文字列にまとめる。
 * 大さじ・小さじ・カップ（計量スプーン/カップ）は「単位→数量」（例:「大さじ1」「小さじ1/2」）、
 * それ以外（g・個・かけ 等）は「数量→単位」（例:「200g」「1個」）。
 * データは amount/unit のまま保持し、これは表示専用の整形。
 */
export function formatAmountUnit(amount: string | undefined, unit?: string): string {
  const a = (amount ?? '').trim()
  const u = (unit ?? '').trim()
  if (!u) return a
  if (!a) return u
  if (SPOON_UNITS.has(u)) return `${u}${a}`
  return `${a}${u}`
}
