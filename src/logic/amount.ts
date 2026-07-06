// 大さじ・小さじ・カップ(計量スプーン/カップ類): 0.25刻み
const SPOON_UNITS = new Set(['大さじ', '小さじ', 'カップ'])
// 個数として数える単位: 0.5刻み(最小0.5、0にはしない)
const COUNT_UNITS = new Set([
  '個', '本', '枚', '切れ', '丁', '缶', '袋', '束', 'かけ', '尾', '玉', '株', '合', '片', '箱', '杯',
])
// 重量・容量: 10未満は整数、10以上は5刻み、100以上は10刻み
const WEIGHT_VOLUME_UNITS = new Set(['g', 'ml', 'cc'])

/** 表示用に丸めた分量の数値を返す（単位ごとの丸め幅、5章の設計表どおり） */
function roundForDisplay(value: number, unit?: string): number {
  if (unit && SPOON_UNITS.has(unit)) {
    return Math.round(value * 4) / 4
  }
  if (unit && COUNT_UNITS.has(unit)) {
    return Math.max(0.5, Math.round(value * 2) / 2)
  }
  if (unit && WEIGHT_VOLUME_UNITS.has(unit)) {
    if (value < 10) return Math.round(value)
    if (value < 100) return Math.round(value / 5) * 5
    return Math.round(value / 10) * 10
  }
  // その他の単位は現状維持: 小数第2位まで（末尾の0は消す）
  return Math.round(value * 100) / 100
}

/**
 * 分量の人数換算。
 * "3"（3個）や "1/2" のような数字は人数に合わせて掛け算し、
 * "少々" "適量" のような言葉はそのまま返す。
 * 表示専用の丸め処理（保存データそのものは変更しない）。
 */
export function scaleAmount(
  amount: string,
  baseServings: number,
  targetServings: number,
  unit?: string,
): string {
  const trimmed = amount.trim()
  if (!trimmed || baseServings <= 0 || baseServings === targetServings) {
    return amount
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
  return String(roundForDisplay(scaled, unit))
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
