import type { Ingredient } from '../db/types'
import { normalizeDigits } from './amount'

/**
 * 概算食費計算: レシピの「材料ごとの価格入力」(Ingredient.price)を優先し、
 * 未入力の材料だけ食材価格マスタ(PriceEntry)で補うフォールバック計算。
 * 優先度: レシピ個別入力 > マスタ一致 > なし（docs/20 実装設計書 §3）。
 */

/** 材料名の表示正規化: 括弧書き（全角/半角どちらも）を落として前後の空白を削る */
export function normalizeIngredientNameForPrice(name: string): string {
  return name
    .trim()
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim()
}

/** マスタ照合用に正規化・整形済みの1件 */
export interface PriceIndexEntry {
  normalizedName: string
  pricePerUnit: number
  unit: string
  /**
   * マスタ行が投入時の目安価格のままか(true)、ユーザーが価格・単位を上書きしたか(false)。
   * db/prices.tsのPriceEntry.isDefaultと同じ意味（未設定は「安全側」でfalse扱い。2026-07-13追加）
   */
  isDefault: boolean
}

/**
 * PriceEntry配列から照合用の索引を作る。
 * 正規化名が長いものを先に並べる（前方一致で複数ヒットしたとき、より具体的な名前を優先するため）。
 */
export function buildPriceIndex(
  entries: { name: string; pricePerUnit: number; unit: string; isDefault?: boolean }[],
): PriceIndexEntry[] {
  return entries
    .map((e) => ({
      normalizedName: normalizeIngredientNameForPrice(e.name),
      pricePerUnit: e.pricePerUnit,
      unit: e.unit,
      isDefault: e.isDefault === true,
    }))
    .filter((e) => e.normalizedName && e.pricePerUnit > 0)
    .sort((a, b) => b.normalizedName.length - a.normalizedName.length)
}

/**
 * 材料名からマスタの1件を探す。
 * 1) 正規化後の完全一致 → 2) 材料名がマスタ名で始まる前方一致（例:「たまねぎ薄切り」→「たまねぎ」）
 * の順で照合する（表示正規化=括弧除去後の名前で前方一致程度の緩さ）。
 */
export function matchPriceEntry(name: string, index: PriceIndexEntry[]): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  const exact = index.find((e) => e.normalizedName === normalized)
  if (exact) return exact
  return index.find((e) => normalized.startsWith(e.normalizedName))
}

/** "200" "1.5" "1/2" のような数字の分量を数値化する（人数換算不要の素の値） */
function parseNumericAmount(amount: string): number | undefined {
  const trimmed = normalizeDigits(amount.trim())
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
  if (!match) return undefined
  let value = Number.parseFloat(match[1])
  const denominator = match[2] ? Number.parseFloat(match[2]) : undefined
  if (denominator) {
    if (denominator === 0) return undefined
    value /= denominator
  }
  return value
}

/**
 * マスタの unit（例:「100g」「1個」「大さじ1」「1小さじ」）を数量と単位に分解する。
 * 先頭が数字の「数量+単位」（100g・1個）だけでなく、末尾が数字の「単位+数量」
 * （大さじ1・小さじ1）も解釈する（PRICE_DEFAULTSに両方の書式が混在しているため）。
 * どちらの書式にも当てはまらなければ、qty=1・baseUnit=元の文字列のまま返す
 * （後続の按分計算では ingredient.unit と一致しない限り使われないので実害はない）。
 *
 * IngredientPricesPage（「食材と価格」の数量＋単位選択UI。2026-07-15）でも、既存行の
 * unit文字列を編集フォームの初期値（数量欄＋単位選択）へ分解するのに共用する
 * （二重実装を避けるためexport）。
 */
export function parseUnitQuantity(unit: string): { qty: number; baseUnit: string } {
  const trimmed = normalizeDigits(unit.trim())
  const leading = trimmed.match(/^(\d+(?:\.\d+)?)(.*)$/)
  if (leading) {
    const qty = Number.parseFloat(leading[1])
    const baseUnit = leading[2].trim()
    return { qty: qty > 0 ? qty : 1, baseUnit: baseUnit || trimmed }
  }
  const trailing = trimmed.match(/^(\D+?)(\d+(?:\.\d+)?)$/)
  if (trailing) {
    const baseUnit = trailing[1].trim()
    const qty = Number.parseFloat(trailing[2])
    if (baseUnit) return { qty: qty > 0 ? qty : 1, baseUnit }
  }
  return { qty: 1, baseUnit: trimmed }
}

/** 単位の次元。質量・体積は基準単位(g・ml)に換算して按分し、個数は単位名が一致する時だけ按分する */
export type UnitDimension = 'mass' | 'volume' | 'count'

/**
 * 単位正規化の結果。mass/volumeは基準量(g・ml換算後の数値)に統一されるので次元さえ揃えば
 * そのまま比率計算できる。countは「1個」と「1本」が別物のため、単位名(unit)も保持する。
 */
export type NormalizedUnit =
  | { dim: 'mass'; base: number }
  | { dim: 'volume'; base: number }
  | { dim: 'count'; unit: string; base: number }

/** 質量: 基準はg（Fable設計確定表） */
const MASS_UNIT_FACTORS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
}

/** 体積: 基準はml（Fable設計確定表。大さじ=15ml・小さじ=5ml・カップ=200ml） */
const VOLUME_UNIT_FACTORS: Record<string, number> = {
  ml: 1,
  cc: 1,
  l: 1000,
  L: 1000,
  リットル: 1000,
  大さじ: 15,
  小さじ: 5,
  カップ: 200,
}

/** 個数: 単位名ごとに別物として扱う（「1個」と「1本」は換算不可。Fable設計確定表） */
const COUNT_UNIT_NAMES = new Set([
  '個', '本', '枚', '玉', '束', 'パック', 'かけ', '片', '株', '尾', '切れ', '丁', '袋', '缶', '房', '節',
])

/**
 * 数量+単位を「次元(mass/volume/count)＋基準量」に正規化する。
 * - 質量(g/kg/mg)・体積(ml/cc/l/L/リットル/大さじ/小さじ/カップ)は基準単位換算後の数値を返すので、
 *   同じ次元同士なら基準量の比でそのまま按分できる（kg↔g・L↔ml・大さじ↔小さじ 等）。
 * - 個数（個/本/枚/玉/束/パック/かけ/片/株/尾/切れ/丁/袋/缶/房/節）は単位名込みで返す
 *   （呼び出し側で単位名が一致する時だけ按分に使うこと。「1個」と「1本」は別物）。
 * - 「少々」「適量」等の解釈できない単位・0以下の数量はnull（呼び出し側でフォールバック）。
 */
export function normalizeUnit(amount: number, unit: string): NormalizedUnit | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const trimmed = (unit ?? '').trim()
  if (!trimmed) return null

  const massFactor = MASS_UNIT_FACTORS[trimmed]
  if (massFactor != null) return { dim: 'mass', base: amount * massFactor }

  const volumeFactor = VOLUME_UNIT_FACTORS[trimmed]
  if (volumeFactor != null) return { dim: 'volume', base: amount * volumeFactor }

  if (COUNT_UNIT_NAMES.has(trimmed)) return { dim: 'count', unit: trimmed, base: amount }

  return null
}

/** マスタ行が投入時の目安のままか(default)、ユーザーが上書きした価格か(user)の由来種別 */
export type PriceSource = 'default' | 'user'

/** マスタ由来の1行分の見積もり（金額＋由来種別。2026-07-13 UIペルソナQA: 表示側の「目安」表記の出し分けに使う） */
export interface IngredientPriceEstimate {
  yen: number
  source: PriceSource
}

/**
 * マスタ一致した材料1行分の金額を見積もる。
 * ingredientの分量・単位がマスタのunitと数量として噛み合えば按分計算し、
 * 噛み合わない（「少々」等の非数値・単位不一致・マスタ側が「1/4個」等で解釈不能）場合は
 * マスタの金額をそのまま1行分の目安として使う（按分できないだけで、値自体は常識的な範囲）。
 * sourceは一致したマスタ行がisDefaultのままか(user='default')、ユーザーが上書き済みか('user')を表す。
 *
 * 按分の優先順位（2026-07-14 単位正規化・オーナー要望「kgが混ざっても平気か不安」への対応）:
 * 1) normalizeUnitで両者を正規化し、同じ次元（質量↔質量・体積↔体積）なら基準量換算で按分。
 *    個数(count)同士は単位名も一致する時だけ按分する（「1個」と「1本」は換算不可）。
 * 2) どちらか（または両方）がnormalizeUnitで解釈できない単位でも、文字列として完全一致するなら
 *    従来どおり按分する（「1杯」「1合」「1箱」等、mass/volume/countの対応表に無い単位の後方互換。
 *    既存の"完全一致で按分"の挙動を正規化に置き換えるのではなく包含するため）。
 * 3) 上記いずれにも当てはまらなければ、マスタの金額をそのまま使う（安全側のフォールバック）。
 */
export function estimateIngredientYen(
  ingredient: Pick<Ingredient, 'name' | 'amount' | 'unit'>,
  index: PriceIndexEntry[],
): IngredientPriceEstimate | undefined {
  const entry = matchPriceEntry(ingredient.name, index)
  if (!entry) return undefined
  const { qty: baseQty, baseUnit } = parseUnitQuantity(entry.unit)
  const ingUnit = (ingredient.unit ?? '').trim()
  const amountNum = parseNumericAmount(ingredient.amount ?? '')
  const source: PriceSource = entry.isDefault ? 'default' : 'user'

  if (amountNum != null && amountNum > 0 && ingUnit && baseUnit) {
    const recipeNorm = normalizeUnit(amountNum, ingUnit)
    const masterNorm = normalizeUnit(baseQty, baseUnit)
    if (recipeNorm != null && masterNorm != null && recipeNorm.dim === masterNorm.dim) {
      if (recipeNorm.dim === 'count') {
        if (masterNorm.dim === 'count' && recipeNorm.unit === masterNorm.unit) {
          return { yen: Math.round(entry.pricePerUnit * (recipeNorm.base / masterNorm.base)), source }
        }
        // 個数系だが単位名が違う（例:「1個」vs「1本」）→ 換算不可なのでフォールバックへ
      } else {
        return { yen: Math.round(entry.pricePerUnit * (recipeNorm.base / masterNorm.base)), source }
      }
    } else if (ingUnit === baseUnit) {
      return { yen: Math.round(entry.pricePerUnit * (amountNum / baseQty)), source }
    }
  }
  return { yen: entry.pricePerUnit, source }
}

/** レシピ1品分の概算食費（材料ごとの内訳を集計した結果） */
export interface RecipeCostEstimate {
  /** 円換算の合計（レシピ登録時の基準人数分） */
  total: number
  /** マスタ価格で補完した材料の件数（0件なら注記は不要） */
  fromMasterCount: number
  /** 価格情報（個別入力・マスタ一致のどちらか）が1件でもあるか */
  hasAnyPriceInfo: boolean
}

/**
 * 材料一覧から概算食費を計算する。優先度: 個別入力(price) > マスタ一致 > なし。
 * RecipeDetailPage（1レシピの概算食費）・MealPlanPage（週の概算食費の合算）の両方から使う。
 */
export function estimateRecipeCost(
  ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[],
  index: PriceIndexEntry[],
): RecipeCostEstimate {
  let total = 0
  let fromMasterCount = 0
  let hasAnyPriceInfo = false
  for (const ing of ingredients) {
    if (ing.price != null && ing.price > 0) {
      total += ing.price
      hasAnyPriceInfo = true
      continue
    }
    const estimated = estimateIngredientYen(ing, index)
    if (estimated != null && estimated.yen > 0) {
      total += estimated.yen
      fromMasterCount++
      hasAnyPriceInfo = true
    }
  }
  return { total, fromMasterCount, hasAnyPriceInfo }
}
