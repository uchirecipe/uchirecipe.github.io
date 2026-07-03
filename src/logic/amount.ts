/**
 * 分量の人数換算。
 * "3"（3個）や "1/2" のような数字は人数に合わせて掛け算し、
 * "少々" "適量" のような言葉はそのまま返す。
 */
export function scaleAmount(
  amount: string,
  baseServings: number,
  targetServings: number,
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
  // 小数第2位まで（末尾の0は消す）: 1.50 → 1.5, 2.00 → 2
  const rounded = Math.round(scaled * 100) / 100
  return String(rounded)
}
