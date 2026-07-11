import { toHiragana } from './kana'
import { NUTRITION_DATA, type NutritionFood, type NutritionPer100g } from './nutritionData'
import type { Ingredient, Recipe } from '../db/types'
import { normalizeDigits } from './amount'

/**
 * 栄養価の自動概算（M6-1・Pro機能）の純ロジック。
 *
 * 【二重ロック】実際の計算表示は isNutritionUnlocked(isPro) が true のときだけ行う。
 * NUTRITION_ENABLED は M6-1 の公開判断まで false のまま寝かせる（FREE_LIMIT_ENABLED と同じ運用）。
 * ★ true に切り替えるリリースでは管理栄養士ペルソナQAを必ず通すこと（docs/09 M6-1 の必須条件。
 *   併せて M6-3 の価格改定ストーリー「栄養機能搭載で800円」と同一リリース計画に載せる）。
 *
 * 【出典】成分値は文部科学省「日本食品標準成分表（八訂）増補2023年」から
 * scripts/build-nutrition.mjs が機械抽出したサブセット（src/logic/nutritionData.ts）。
 * 手書きの成分値は存在しない。
 *
 * 【設計方針】あくまで「概算・めやす」。医療・効能の文脈では使わない。
 * 計算できなかった材料は隠さず「計算対象外 n件」として必ず表示に含めること（excluded参照）。
 */

/**
 * 栄養価機能「フル版」（5項目・材料内訳・計算対象外の明示まで含む完全パネル）の全体フラグ。
 * M6-1本公開まで false（Pv発動・Pro発売・管理栄養士QA通過後にONにする。docs/09参照）。
 * ★ 2026-07-10 バッチH-4でエネルギー・食塩相当量の2項目のみは無料版にも常時表示するよう変更した
 * （NutritionTeaser.tsx参照。このフラグとは独立に動く。計算ロジック自体はscripts/test-nutrition.mjsの
 * 回帰スモークで既に検証済みのため、2項目限定の先行公開はQA対象外とした。オーナー確定・docs/09に記録）。
 */
export const NUTRITION_ENABLED = false

/**
 * 栄養UIカード自体の表示フラグ（緊急停止用）。false にすると無料の2項目表示・フル版どちらも出さない。
 */
export const NUTRITION_TEASER_ENABLED = true

/** 栄養価の計算・表示を実際に行ってよいか（二重ロック: 機能フラグ && Pro解錠） */
export function isNutritionUnlocked(isPro: boolean): boolean {
  return NUTRITION_ENABLED && isPro
}

/** 1レシピ分の栄養合計値 */
export interface NutrientTotals {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  saltG: number
}

/** 計算対象外になった理由 */
export type ExcludedReason =
  | 'food' // 成分表サブセットに該当食材が無い
  | 'unit' // 単位をグラムに換算できない
  | 'amount' // 分量が数値でない（少々・適量など）
  | 'prep' // 塩もみ・板ずり用の塩など、洗い流し・絞りで大半が食べる分に残らない下ごしらえ用

export interface ExcludedIngredient {
  name: string
  reason: ExcludedReason
}

/** 「少々」「適量」を仮の目安量で計算に含めたときの記録(2026-07-11オーナー要望) */
export interface AssumedIngredient {
  name: string
  note: string // 例: '少々 → 約0.5g/食'
}

/** 1材料分の計算結果（内訳表示・デバッグ用） */
export interface IngredientNutrition {
  name: string
  foodLabel: string
  grams: number
  nutrients: NutrientTotals
}

export interface RecipeNutrition {
  /** 仮の目安量で計算に含めた材料(UIで必ず明示すること) */
  assumed: AssumedIngredient[]
  /** レシピ全量（servings人分）の合計 */
  total: NutrientTotals
  /** 1人分（total ÷ servings） */
  perServing: NutrientTotals
  servings: number
  /** 計算に含めた材料の内訳 */
  items: IngredientNutrition[]
  /** 計算対象外の材料（UIでは「計算対象外 n件」として必ず明示すること） */
  excluded: ExcludedIngredient[]
}

// ---------- 名寄せ（材料名 → 成分表の食品） ----------

/** 材料名の正規化: toHiragana（カタカナ→ひらがな・NFKC・読み仮名辞書）＋空白除去 */
function normalizeName(name: string): string {
  return toHiragana(name.trim()).replace(/[\s・]+/g, '')
}

/** 括弧書きの注記を落とす（「めんつゆ(2倍濃縮)」のように括弧が意味を持つ場合は先に完全一致で拾う） */
function stripParens(normalized: string): string {
  return normalized.replace(/\([^)]*\)/g, '').trim()
}

/**
 * 計算上ゼロ扱いにしてよい材料（水・湯・氷）。対象外件数にも数えない。
 * 比較は正規化後の形で行うので、セットも同じ関数で正規化してから作る
 * （例:「水」は読み仮名辞書で「みず」になる）。
 */
const ZERO_INGREDIENTS = new Set(
  ['水', 'ぬるま湯', 'お湯', '湯', '熱湯', '氷'].map((n) => normalizeName(n)),
)

export function isZeroIngredient(name: string): boolean {
  return ZERO_INGREDIENTS.has(stripParens(normalizeName(name)))
}

// 照合用の索引を起動時に一度だけ構築する。
// aliasは実行時に toHiragana で正規化するので、データ側と辞書(ingredientReadings)の
// 正規化ルールが将来変わっても常に同じ土俵で照合される。
interface MatchIndex {
  /** 正規化前の完全一致（「鮭」vs「酒」の衝突回避用） */
  raw: Map<string, NutritionFood>
  /** 正規化後の完全一致 */
  exact: Map<string, NutritionFood>
  /** 部分一致用: 正規化済みalias（3文字以上）を長い順に並べたもの */
  partial: { key: string; food: NutritionFood }[]
}

function buildIndex(): MatchIndex {
  const raw = new Map<string, NutritionFood>()
  const exact = new Map<string, NutritionFood>()
  for (const food of NUTRITION_DATA.foods) {
    for (const alias of food.rawAliases ?? []) {
      if (!raw.has(alias)) raw.set(alias, food)
    }
    for (const alias of food.aliases) {
      const key = normalizeName(alias)
      const existing = exact.get(key)
      if (existing && existing !== food) {
        // 同じ正規化キーを2つの食品が奪い合うのはデータ不備。開発中に気づけるよう警告する
        console.warn(`[nutrition] alias衝突: "${alias}" → ${existing.label} / ${food.label}`)
        continue
      }
      exact.set(key, food)
    }
  }
  const partial = [...exact.entries()]
    .filter(([key]) => key.length >= 3)
    .map(([key, food]) => ({ key, food }))
    .sort((a, b) => b.key.length - a.key.length)
  return { raw, exact, partial }
}

let index: MatchIndex | null = null
function getIndex(): MatchIndex {
  index ??= buildIndex()
  return index
}

/**
 * 材料名から成分表の食品を探す。
 * 1) 正規化前の完全一致 → 2) 正規化後の完全一致 → 3) 括弧を除いた完全一致
 * → 4) 最長の部分一致（3文字以上のaliasのみ）の順で照合する。
 */
export function matchNutritionFood(name: string): NutritionFood | null {
  const idx = getIndex()
  const rawKey = name.trim()
  const rawHit = idx.raw.get(rawKey)
  if (rawHit) return rawHit

  const normalized = normalizeName(name)
  if (!normalized) return null
  const exactHit = idx.exact.get(normalized)
  if (exactHit) return exactHit

  const stripped = stripParens(normalized)
  if (stripped && stripped !== normalized) {
    const strippedHit = idx.exact.get(stripped)
    if (strippedHit) return strippedHit
  }

  for (const { key, food } of idx.partial) {
    if (normalized.includes(key)) return food
  }
  return null
}

// ---------- 換算（分量 × 単位 → グラム） ----------

/** "3"・"1.5"・"1/2" を数値にする（scaleAmountと同じ形だけ対応。他はnull） */
export function parseAmountNumber(amount: string): number | null {
  const match = normalizeDigits(amount.trim()).match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
  if (!match) return null
  let value = Number.parseFloat(match[1])
  const denominator = match[2] ? Number.parseFloat(match[2]) : undefined
  if (denominator !== undefined) {
    if (denominator === 0) return null
    value /= denominator
  }
  return value
}

const SPOON_ML: Record<string, number> = { 大さじ: 15, 小さじ: 5, カップ: 200 }

/**
 * 分量×単位をグラムに換算する。換算できないときは null。
 * 優先順位: 明示のunitGrams → g/kg → ml/cc(gramsPerMl) → 大さじ/小さじ/カップ(gramsPerMl経由)
 */
export function convertToGrams(value: number, unit: string, food: NutritionFood): number | null {
  const u = unit.trim()
  const explicit = food.unitGrams?.[u]
  if (explicit !== undefined) return value * explicit
  if (u === 'g' || u === 'グラム') return value
  if (u === 'kg') return value * 1000
  if (u === 'ml' || u === 'cc' || u === 'ミリリットル') {
    return food.gramsPerMl !== undefined ? value * food.gramsPerMl : null
  }
  const spoonMl = SPOON_ML[u]
  if (spoonMl !== undefined && food.gramsPerMl !== undefined) {
    return value * spoonMl * food.gramsPerMl
  }
  return null
}

// ---------- 集計 ----------

function emptyTotals(): NutrientTotals {
  return { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, saltG: 0 }
}

function addScaled(target: NutrientTotals, per100g: NutritionPer100g, grams: number): NutrientTotals {
  const f = grams / 100
  target.kcal += per100g.kcal * f
  target.proteinG += per100g.proteinG * f
  target.fatG += per100g.fatG * f
  target.carbG += per100g.carbG * f
  target.saltG += per100g.saltG * f
  return target
}

// 「少々」「適量」の仮の目安量(1食あたりg・概算)。
// 塩系はmemoの「約◯g」表記があればそれを優先。お好みで表記は食べるか不明なため対象外のまま。
const OIL_NAMES = /(サラダ油|ごま油|オリーブオイル|オリーブ油|^油$)/
function matchAssumed(ing: Ingredient): { gramsPerServing: number; note: string } | null {
  const name = ing.name
  const amount = ing.amount ?? ''
  if (/お好みで/.test(name) || /お好みで/.test(amount)) return null
  if (/少々/.test(amount)) {
    if (name.includes('塩')) {
      const m = (ing.memo ?? '').match(/約([\d.]+)g/)
      const g = m ? Number(m[1]) : 0.5
      return { gramsPerServing: g, note: `少々 → 約${g}g/食` }
    }
    if (name.includes('こしょう')) {
      return { gramsPerServing: 0.3, note: '少々 → 約0.3g/食' }
    }
  }
  if (/適量/.test(amount) && OIL_NAMES.test(name)) {
    return { gramsPerServing: 3, note: '適量 → 約3g/食(大さじ1/2を2食で使う想定)' }
  }
  return null
}

/** 材料1行を計算する（対象外なら reason を返す） */
function computeIngredient(
  ing: Ingredient,
  servings: number,
): { item: IngredientNutrition; assumed?: AssumedIngredient } | { reason: ExcludedReason } | 'zero' {
  if (isZeroIngredient(ing.name)) return 'zero'
  // 塩もみ・板ずり用の塩は、洗い流し・絞りで大半が食べる分に残らないため計算に含めない(2026-07-11)
  if (ing.name.includes('塩') && /(塩もみ|板ずり)用/.test(ing.memo ?? '')) return { reason: 'prep' }
  const food = matchNutritionFood(ing.name)
  if (!food) return { reason: 'food' }
  const value = parseAmountNumber(ing.amount)
  if (value === null) {
    // 少々・適量は仮の目安量で計算に含める(2026-07-11オーナー要望。UIで仮定を必ず明示)
    const assumption = matchAssumed(ing)
    if (assumption) {
      const grams = assumption.gramsPerServing * servings
      const nutrients = addScaled(emptyTotals(), food.per100g, grams)
      return {
        item: { name: ing.name, foodLabel: food.label, grams, nutrients },
        assumed: { name: ing.name, note: assumption.note },
      }
    }
    return { reason: 'amount' }
  }
  const grams = convertToGrams(value, ing.unit, food)
  if (grams === null) return { reason: 'unit' }
  const nutrients = addScaled(emptyTotals(), food.per100g, grams)
  return { item: { name: ing.name, foodLabel: food.label, grams, nutrients } }
}

/**
 * レシピ全体の栄養概算。servingsが不正(0以下)のときは1人分として扱う。
 * 戻り値の excluded は UI で「計算対象外 n件」として必ず明示すること（docs/09 M6-1）。
 */
export function computeRecipeNutrition(
  recipe: Pick<Recipe, 'ingredients' | 'servings'>,
): RecipeNutrition {
  const servings = recipe.servings > 0 ? recipe.servings : 1
  const total = emptyTotals()
  const items: IngredientNutrition[] = []
  const excluded: ExcludedIngredient[] = []
  const assumed: AssumedIngredient[] = []

  for (const ing of recipe.ingredients) {
    if (!ing.name.trim()) continue
    const result = computeIngredient(ing, servings)
    if (result === 'zero') continue
    if ('reason' in result) {
      excluded.push({ name: ing.name, reason: result.reason })
      continue
    }
    if (result.assumed) assumed.push(result.assumed)
    items.push(result.item)
    total.kcal += result.item.nutrients.kcal
    total.proteinG += result.item.nutrients.proteinG
    total.fatG += result.item.nutrients.fatG
    total.carbG += result.item.nutrients.carbG
    total.saltG += result.item.nutrients.saltG
  }

  const perServing: NutrientTotals = {
    kcal: total.kcal / servings,
    proteinG: total.proteinG / servings,
    fatG: total.fatG / servings,
    carbG: total.carbG / servings,
    saltG: total.saltG / servings,
  }
  return { total, perServing, servings, items, excluded, assumed }
}

/** 表示用の丸め: kcalは整数、それ以外は小数1桁（概算なのでこれ以上細かくしない） */
export function roundNutrient(key: keyof NutrientTotals, value: number): number {
  if (key === 'kcal') return Math.round(value)
  return Math.round(value * 10) / 10
}

/** 出典表記（UI・/about/で使う。文言はja.tsに置くが、出典名はデータ由来なのでここから取る） */
export function nutritionSourceName(): string {
  return NUTRITION_DATA.source
}
