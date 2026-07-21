// 大さじ・小さじ・カップ(計量スプーン/カップ類): 0.25刻み
const SPOON_UNITS = new Set(['大さじ', '小さじ', 'カップ'])
// 個数として数える単位: 0.5刻み(最小0.5、0にはしない)。
// 「房」は2026-07-21分量表記拡充で追加(「ひと房」の解釈用。src/logic/priceEstimate.tsの
// COUNT_UNIT_NAMESには元から入っていたが、こちらは漏れていた表記ゆれ)
const COUNT_UNITS = new Set([
  '個', '本', '枚', '切れ', '丁', '缶', '袋', '束', 'かけ', '尾', '玉', '株', '合', '片', '箱', '杯', '節', '房',
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
 * 2026-07-21 分量表記拡充（オーナー実機報告: URL取り込みレシピの計算対象外10件のうち8件が
 * 「大2」「小1」のような大さじ/小さじの略記だった）。
 *
 * 「大2」「小1」「小1/2」のような大さじ/小さじの略記を、計算専用に大さじ/小さじの数量へ解決する。
 * **表示は原文（「大2」）を尊重する**ため、ここで返す値は栄養計算(nutrition.ts)・原価計算
 * (priceEstimate.ts)・人数スケール(scaleAmount)の計算専用であり、呼び出し側はamount欄の
 * 表示文字列そのものを書き換えないこと（scaleAmountは表示用の再構成だけ行う）。
 *
 * 単位欄(unit)が空の時だけ解釈する: 単位欄に何か入力済み（例:「大1個」のような
 * サイズ修飾語+助数詞。docs/43「材料名に残る大きさ修飾語」参照）と衝突しないようにするため。
 * 範囲（「大1〜1.5」）は非対応（既存の範囲分量の方針＝人数換算・計算には使わず表示のみ、に合わせる。
 * scaleAmount側のF3コメント参照）。
 */
export interface AbbreviatedSpoonAmount {
  value: number
  /** 展開後の正式な単位名（convertToGrams・normalizeUnit等の計算関数にそのまま渡せる） */
  unit: '大さじ' | '小さじ'
  /** 元の略記1文字（表示の再構成用。「大さじ」ではなく「大」のまま残す） */
  prefix: '大' | '小'
}

export function parseAbbreviatedSpoonAmount(
  amount: string,
  unit?: string,
): AbbreviatedSpoonAmount | null {
  if (unit && unit.trim()) return null
  const trimmed = normalizeDigits(amount.trim())
  const match = trimmed.match(/^([大小])(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
  if (!match) return null
  let value = Number.parseFloat(match[2])
  const denominator = match[3] ? Number.parseFloat(match[3]) : undefined
  if (denominator !== undefined) {
    if (denominator === 0) return null
    value /= denominator
  }
  const prefix = match[1] as '大' | '小'
  return { value, unit: prefix === '大' ? '大さじ' : '小さじ', prefix }
}

/**
 * 「ひとかけ」「一房」のような和語の個数詞（常に1個のぶんだけ）を、既存のunitGrams等が
 * 対応する単位名に開く（新しい重量換算値は作らず、既にある「かけ」「房」等の換算に載せるだけ）。
 * 単位欄が空の時だけ解釈する（parseAbbreviatedSpoonAmountと同じ理由）。
 * 網羅は狙わず、「ひと」が自然に付く和語の助数詞のみ収録（「ひと本」「ひと個」等は不自然な
 * 言い回しのため対象外。2026-07-21分量表記拡充・docs/43/47の実例調査より）。
 */
const COUNTER_WORD_ONE: Record<string, string> = {
  ひとかけ: 'かけ',
  一かけ: 'かけ',
  一片: '片',
  ひと切れ: '切れ',
  ひときれ: '切れ',
  一切れ: '切れ',
  ひと房: '房',
  ひとふさ: '房',
  一房: '房',
  ひと束: '束',
  一束: '束',
  ひと株: '株',
  一株: '株',
  ひと玉: '玉',
  一玉: '玉',
}

export interface CounterWordAmount {
  value: 1
  unit: string
}

export function parseCounterWordAmount(amount: string, unit?: string): CounterWordAmount | null {
  if (unit && unit.trim()) return null
  const trimmed = normalizeDigits(amount.trim())
  const resolvedUnit = COUNTER_WORD_ONE[trimmed]
  return resolvedUnit ? { value: 1, unit: resolvedUnit } : null
}

/**
 * 栄養計算(nutrition.ts)・原価計算(priceEstimate.ts)から共通で使う、計算専用の分量解決。
 * parseAbbreviatedSpoonAmount → parseCounterWordAmountの順で試す。どちらにも該当しなければnull
 * （呼び出し側は従来どおり通常の数値パース（parseAmountNumber等）にフォールバックすること）。
 */
export function resolveCalcAmount(amount: string, unit?: string): { value: number; unit: string } | null {
  return parseAbbreviatedSpoonAmount(amount, unit) ?? parseCounterWordAmount(amount, unit)
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

  // 「大2」「小1/2」のような大さじ/小さじの略記(単位欄が空の時のみ)。表示は略記の1文字
  // (「大」「小」)のまま保ち、数値だけ大さじ/小さじと同じ丸め幅(0.25刻み)・帯分数表示で更新する
  // (例: 2人分「大2」→4人分は「大4」。「大さじ4」のような展開はしない=原文尊重)
  const spoonAbbrev = parseAbbreviatedSpoonAmount(trimmed, unit)
  if (spoonAbbrev) {
    const scaled = (spoonAbbrev.value * targetServings) / baseServings
    const rounded = roundForDisplay(scaled, spoonAbbrev.unit)
    return spoonAbbrev.prefix + formatFraction(rounded)
  }

  // 「ひとかけ」「一房」のような和語の個数詞(単位欄が空の時のみ)。スケール後は「1」の意味が
  // 崩れるため、通常の個数表記(「2かけ」等・数値→単位の順)に切り替える
  const counterWord = parseCounterWordAmount(trimmed, unit)
  if (counterWord) {
    const scaled = (counterWord.value * targetServings) / baseServings
    const rounded = roundForDisplay(scaled, counterWord.unit)
    return `${formatFraction(rounded)}${counterWord.unit}`
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
