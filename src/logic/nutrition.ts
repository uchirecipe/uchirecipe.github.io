import { toIngredientKey } from './kana'
import { NUTRITION_DATA, type NutritionFood, type NutritionPer100g } from './nutritionData'
import type { Ingredient, Recipe } from '../db/types'
import {
  leadingRangeAmount,
  normalizeAmountInput,
  parseAmountNumber as parseAmountValue,
  resolveCalcAmount,
} from './amount'
import { VOLUME_UNIT_FACTORS } from './unitGrams'
import { matchAssumedGrams } from './amountAssumption'
import { ja } from '../i18n/ja'

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
 * 計算できなかった材料は隠さず「計算に含めていない材料 n件」として必ず表示に含めること（excluded参照）。
 */

/**
 * 栄養価機能「フル版」（5項目・材料内訳・計算対象外の明示まで含む完全パネル）の全体フラグ。
 * 本来はM6-1本公開（Pv発動・Pro発売・管理栄養士QA通過後にONにする運用。docs/09参照）まで
 * false としてきた（凍結資産の維持ルール・docs/09「凍結資産の維持ルール」節）。
 * ★ 2026-07-12 オーナー指示で前倒し有効化。本番公開の最終判断は再公開時。
 *   現状: `main`はMAINTENANCE_MODE=true（準備中ページ）でこの変更の影響を受けない。
 *   `dev`はローカルcommitのみ・push禁止で運用し、Pro購入窓口（M2-4）も未開設のため一般ユーザーが
 *   正規解錠する経路は依然として存在しない（実質的な公開影響はない）。ただし docs/09 の
 *   「M6-1の公開＝Pv発動＋Pro発売と同一リリース計画・その時点で管理栄養士ペルソナQAを必須とする」
 *   という決定はこの変更だけでは満たしていないため、実際にユーザーへ見せる（dev→mainの合流・
 *   Pro購入窓口の開設）前には、①ユーザーの明示指示、②管理栄養士ペルソナQAの通過を別途行うこと。
 * ★ 2026-07-10 バッチH-4でエネルギー・食塩相当量の2項目のみは無料版にも常時表示するよう変更した
 * （NutritionTeaser.tsx参照。このフラグとは独立に動く。計算ロジック自体はscripts/test-nutrition.mjsの
 * 回帰スモークで既に検証済みのため、2項目限定の先行公開はQA対象外とした。オーナー確定・docs/09に記録）。
 * ★ 2026-08-01 オーナー確定（線引きB'）で無料側の内訳を変更した:
 *   **無料＝エネルギー＋野菜量(g)／Pro＝栄養8項目（食塩相当量を含む）＋野菜量**。
 *   食塩相当量は無料側から外してPro側の8項目表に集約し、めやすとの並置（めやす7.5g/6.5g）も
 *   Proゲートの内側へ移した。野菜量は無料のまま（バランス提案エンジンが使う基準そのものなので、
 *   無料でも見えないと「なぜこの副菜か」を説明できない。docs/60 §7 未決#3）。
 *   宣伝・販売の開始前なので既存の無料機能を動かしてよい、という前提での変更（オーナー確定）。
 *   **計算ロジックは一切変えていない（表示のゲートだけを動かした）**。
 */
export const NUTRITION_ENABLED = true

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
  /** 食物繊維(g)。2026-07-13 第2弾で追加(オーナー承認・Fable設計) */
  fiberG: number
  /** 鉄(mg) */
  ironMg: number
  /** カルシウム(mg) */
  calciumMg: number
}

/**
 * 栄養表示に出す項目の顔ぶれと並び（2026-08-19 便HU・⑯）。
 *
 * レシピの「栄養価の概算」(NutritionTeaser)・献立の栄養表示・レシピ一覧の栄養価での並び替えは、
 * **同じ顔ぶれ**でなければならない（オーナー「ラインナップをいつもの栄養価にして」）。
 * 顔ぶれを1か所に置き、表示側も並び替え側もここを基準にする
 * ＝項目が増えたときに片方だけ古いままにならない。
 * 並びは無料で見えるエネルギーを先頭に、注意して見る塩分相当量を末尾に置く従来どおりの順。
 */
export const NUTRITION_DISPLAY_KEYS: readonly (keyof NutrientTotals)[] = [
  'kcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'ironMg',
  'calciumMg',
  'saltG',
]

/**
 * 栄養項目の画面に出す名前（2026-08-19 便HU・⑯）。
 * 表示と並び替えで違う名前を出さないよう、名前もここに集約する
 * （並び替えが「糖質」、表示が「炭水化物」と食い違っていた。中身は炭水化物=CHOCDF-）。
 */
export function nutritionLabelFor(key: keyof NutrientTotals): string {
  switch (key) {
    case 'kcal':
      return ja.nutrition.kcalLabel
    case 'proteinG':
      return ja.nutrition.proteinLabel
    case 'fatG':
      return ja.nutrition.fatLabel
    case 'carbG':
      return ja.nutrition.carbLabel
    case 'fiberG':
      return ja.nutrition.fiberLabel
    case 'ironMg':
      return ja.nutrition.ironLabel
    case 'calciumMg':
      return ja.nutrition.calciumLabel
    case 'saltG':
      return ja.nutrition.saltLabel
  }
}

/** 栄養項目の単位（kcal / mg / g）。表示と並び替えで同じ単位を出すために共用する */
export function nutritionUnitFor(key: keyof NutrientTotals): string {
  if (key === 'kcal') return ja.nutrition.kcalUnit
  if (key === 'ironMg' || key === 'calciumMg') return ja.nutrition.mgUnit
  return ja.nutrition.gramUnit
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
  /**
   * 保存されている分量テキスト（例: '適量(お好みで)'・'1パック'）。2026-07-28 便BY/NUT-02。
   * 「無視していいのか、意外と効くのか」を判断する手掛かりとしてUIに併記する。
   * 計算時にだけ作る型でIndexedDBには保存しないため、任意項目でよい（マイグレーション不要）。
   */
  amountText?: string
}

/**
 * 「量は書いてあるのに計算できなかった」材料が含まれているか（2026-07-28 便BY/NUT-01）。
 *
 * reason別に重みが違う:
 * - amount / prep … 「適量」「少々」「塩もみ用の塩」など、元々分量が書かれていない薬味・下ごしらえ。
 *   同梱103品の計算対象外66件はすべてこちら。数値を出しても実害が小さい。
 * - food / unit … 「牛肉 300g」「米 360cc」のように分量は書いてあるのに、成分データが無い・
 *   単位をグラムに換算できないケース。主材料が丸ごと落ちるのはこちらで、
 *   エネルギーも塩分も大きく過小に出る（実測で最大21倍の過小表示を確認）。
 *
 * この線引きなら同梱カタログでは1件も警告が出ず、主材料が落ちたときだけ発火する。
 * nutrition.ts 冒頭の設計方針「計算できなかった材料は隠さず必ず表示に含めること」を、
 * 折りたたみ既定（2026-07-11）で見えなくなった部分欠落にも効かせるための判定。
 */
export function hasMaterialGap(nutrition: Pick<RecipeNutrition, 'excluded'>): boolean {
  return nutrition.excluded.some((e) => e.reason === 'food' || e.reason === 'unit')
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
  /**
   * 名寄せできた食品の八訂の食品番号（NutritionFood.id。例: 玉ねぎ='06153'）。
   * 2026-07-30 便CL/docs/60 第1段で追加。先頭2桁が食品群番号なので、
   * 「野菜類（06）だけを合計する」のような食品群単位の集計を、
   * グラム換算のロジックを二重に書かずに行える（logic/nutritionBalance.ts が使う）。
   * 八訂に収載が無い食品（市販品参考の概算）は 'custom:◯◯' なのでどの食品群にも入らない。
   */
  foodId: string
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
  /** 計算に含めていない材料（UIでは「計算に含めていない材料 n件」として必ず明示すること） */
  excluded: ExcludedIngredient[]
}

// ---------- 名寄せ（材料名 → 成分表の食品） ----------

/** 材料名の正規化: toHiragana（カタカナ→ひらがな・NFKC・読み仮名辞書）＋空白除去
 * （kana.tsのtoIngredientKey。原価側の「少々・適量」の仮の量と同じキーで比べるため共有している） */
const normalizeName = toIngredientKey

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
  // 「1と1/2」のような帯分数も解釈する(2026-07-28 便BW/C-18。アプリ自身が人数変更後の表示に
  // 使う書き方なので、それを保存した分量が栄養計算の対象外になるのを防ぐ)
  // 範囲分量(「200〜250」)は先頭の値で計算する(2026-07-28 便BX/C06。表示は原文のまま)。
  // 従来はここで解釈できず、材料が丸ごと計算対象外に落ちていた。
  // 数値化そのものは amount.ts の parseAmountNumber に集約（同じ解釈器を人数変更・
  // 買い物メモの合算とも共有する。2026-07-29 便CC/C1）。ここは栄養計算向けに
  // 「範囲は先頭値で計算する」という前処理だけを足した薄いラッパー
  return parseAmountValue(leadingRangeAmount(normalizeAmountInput(amount.trim())))
}

/**
 * 大さじ/小さじ/カップのml換算。unitGrams.tsのVOLUME_UNIT_FACTORSと同一の値を使う
 * （1948年制定のJIS S 2052「家庭用計量スプーン」に由来する日本の調理計量の標準値。
 * 大さじ15ml・小さじ5ml・カップ200ml。2026-07-21 単位換算監査(docs/48)で確認）。
 * 数値を2箇所に手書きすると片方だけ変更されて食い違う事故が起きるため、
 * ここでは書き写さずunitGrams.tsから直接参照して一本化している。
 */
const SPOON_ML: Record<string, number> = {
  大さじ: VOLUME_UNIT_FACTORS.大さじ,
  小さじ: VOLUME_UNIT_FACTORS.小さじ,
  カップ: VOLUME_UNIT_FACTORS.カップ,
}

/**
 * 分量×単位をグラムに換算する。換算できないときは null。
 * 優先順位: 明示のunitGrams → g/kg → ml/cc(gramsPerMl) → 大さじ/小さじ/カップ(gramsPerMl経由)
 * unitはNFKC正規化してから比較する(2026-07-21全角対応: 全角「ｇ」「ｍｌ」等でも半角と同じ
 * 食品データに一致させるため。全角入力欄が「アサリ 300ｇ」のように全角単位で保存されていても
 * ここで解釈できれば計算できる。保存データ自体は書き換えない)
 */
export function convertToGrams(value: number, unit: string, food: NutritionFood): number | null {
  const u = normalizeAmountInput(unit).trim()
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
  return { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, saltG: 0, fiberG: 0, ironMg: 0, calciumMg: 0 }
}

function addScaled(target: NutrientTotals, per100g: NutritionPer100g, grams: number): NutrientTotals {
  const f = grams / 100
  target.kcal += per100g.kcal * f
  target.proteinG += per100g.proteinG * f
  target.fatG += per100g.fatG * f
  target.carbG += per100g.carbG * f
  target.saltG += per100g.saltG * f
  target.fiberG += per100g.fiberG * f
  target.ironMg += per100g.ironMg * f
  target.calciumMg += per100g.calciumMg * f
  return target
}

/**
 * 分量欄と単位欄から、栄養計算用の(数値, 単位)を解決する。
 * 「大2」「小1/2」(大さじ/小さじの略記)・「ひとかけ」「一房」等の和語の個数詞を優先的に解釈し
 * (resolveCalcAmount、いずれも単位欄が空の時のみ該当)、どちらでもなければ通常どおり
 * amount+ing.unitとして扱う。少々・適量・範囲(「2〜3」等)のように数値化できないものはnull
 * （呼び出し側でmatchAssumedのフォールバックに回す）。
 */
function resolveIngredientAmount(ing: Ingredient): { value: number; unit: string } | null {
  const resolved = resolveCalcAmount(ing.amount, ing.unit)
  if (resolved) return resolved
  const value = parseAmountNumber(ing.amount)
  if (value === null) return null
  return { value, unit: ing.unit }
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
  const resolved = resolveIngredientAmount(ing)
  if (resolved === null) {
    // 少々・適量は仮の目安量で計算に含める(2026-07-11オーナー要望。UIで仮定を必ず明示)
    const assumption = matchAssumedGrams(ing)
    if (assumption) {
      const grams = assumption.gramsPerServing * servings
      const nutrients = addScaled(emptyTotals(), food.per100g, grams)
      return {
        item: { name: ing.name, foodLabel: food.label, foodId: food.id, grams, nutrients },
        assumed: { name: ing.name, note: assumption.note },
      }
    }
    return { reason: 'amount' }
  }
  const grams = convertToGrams(resolved.value, resolved.unit, food)
  if (grams === null) return { reason: 'unit' }
  const nutrients = addScaled(emptyTotals(), food.per100g, grams)
  return { item: { name: ing.name, foodLabel: food.label, foodId: food.id, grams, nutrients } }
}

/**
 * レシピ全体の栄養概算。servingsが不正(0以下)のときは1人分として扱う。
 * 戻り値の excluded は UI で「計算に含めていない材料 n件」として必ず明示すること（docs/09 M6-1）。
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
      excluded.push({
        name: ing.name,
        reason: result.reason,
        amountText: `${ing.amount ?? ''}${ing.unit ?? ''}`.trim() || undefined,
      })
      continue
    }
    if (result.assumed) assumed.push(result.assumed)
    items.push(result.item)
    total.kcal += result.item.nutrients.kcal
    total.proteinG += result.item.nutrients.proteinG
    total.fatG += result.item.nutrients.fatG
    total.carbG += result.item.nutrients.carbG
    total.saltG += result.item.nutrients.saltG
    total.fiberG += result.item.nutrients.fiberG
    total.ironMg += result.item.nutrients.ironMg
    total.calciumMg += result.item.nutrients.calciumMg
  }

  const perServing: NutrientTotals = {
    kcal: total.kcal / servings,
    proteinG: total.proteinG / servings,
    fatG: total.fatG / servings,
    carbG: total.carbG / servings,
    saltG: total.saltG / servings,
    fiberG: total.fiberG / servings,
    ironMg: total.ironMg / servings,
    calciumMg: total.calciumMg / servings,
  }
  return { total, perServing, servings, items, excluded, assumed }
}

/**
 * 期間内に「1人が摂取した」栄養の合計（sumPersonalNutrition の戻り値）。
 * 2026-07-28 便CA・オーナー確定仕様: 従来の「1食あたりの平均（averagePerMealNutrition）」を廃止し、
 * 「期間内に作った料理を1食ずつ足した、1人分の期間合計」に置き換えた。
 */
export interface PersonalNutritionSum {
  /** 1人分の期間合計（8項目）。料理1品につき perServing（1人分）を1回だけ足した値 */
  total: NutrientTotals
  /** 合計に入れた品数（料理1品＝1。作った人数・延べ人数では数えない） */
  dishCount: number
  /** 材料が丸ごと計算対象外で1品も計算できず、合計から除いた品数 */
  excludedDishCount: number
  /**
   * 合計には入れたが、量の書いてある材料を計算できなかった品数（2026-07-28 便BY/NUT-01）。
   * 主材料が落ちたレシピは合計を静かに下げるので、件数を呼び出し側で明示する。
   */
  partialDishCount: number
}

/** 空の PersonalNutritionSum（期間内に1品も無いときの戻り値・呼び出し側の初期値にも使う） */
export function emptyPersonalNutritionSum(): PersonalNutritionSum {
  return { total: emptyTotals(), dishCount: 0, excludedDishCount: 0, partialDishCount: 0 }
}

/**
 * 料理（作った記録／登録した献立）のレシピ群から、「1人が期間内に摂取した栄養の合計」を概算する
 * 純ロジック（2026-07-28 便CA・オーナー確定仕様・月タブ「期間の食費と栄養」用）。
 *
 * 各レシピの perServing（1人分＝1食分）を、料理1品につき1回だけ単純合計する。
 * 2人分作っても4人分作っても「1人が食べた分」は1食なので、作った人数では重み付けしない
 * （オーナー原文: 「1人が期間内に摂取した食事の合計(期間内に作った料理1食ずつの合計)」）。
 * 従来の averagePerMealNutrition は延べ人数で割った「1食あたりの平均」を返しており、
 * 「期間で摂った合計」を知りたいという要望と食い違っていたため廃止した。
 *
 * 材料が丸ごと計算対象外で1品も計算できないレシピ（computeRecipeNutrition の items が0件）は
 * 0kcal の品として合計を薄めないよう除外し、excludedDishCount で数える。
 * あくまで概算・めやす（医療・効能の文脈では使わない）。呼び出し側は必ず「めやす／概算」表記と、
 * excludedDishCount>0 のときはその件数を明示すること。
 */
export function sumPersonalNutrition(
  recipes: Pick<Recipe, 'ingredients' | 'servings'>[],
): PersonalNutritionSum {
  const total = emptyTotals()
  let dishCount = 0
  let excludedDishCount = 0
  let partialDishCount = 0
  for (const recipe of recipes) {
    const n = computeRecipeNutrition(recipe)
    if (n.items.length === 0) {
      excludedDishCount++
      continue
    }
    if (hasMaterialGap(n)) partialDishCount++
    const p = n.perServing
    total.kcal += p.kcal
    total.proteinG += p.proteinG
    total.fatG += p.fatG
    total.carbG += p.carbG
    total.saltG += p.saltG
    total.fiberG += p.fiberG
    total.ironMg += p.ironMg
    total.calciumMg += p.calciumMg
    dishCount++
  }
  return { total, dishCount, excludedDishCount, partialDishCount }
}

/** 2つの PersonalNutritionSum を足す（実績（過去）＋予定（今日以降）を1つの期間合計にまとめる用） */
export function addPersonalNutritionSum(
  a: PersonalNutritionSum,
  b: PersonalNutritionSum,
): PersonalNutritionSum {
  return {
    total: {
      kcal: a.total.kcal + b.total.kcal,
      proteinG: a.total.proteinG + b.total.proteinG,
      fatG: a.total.fatG + b.total.fatG,
      carbG: a.total.carbG + b.total.carbG,
      saltG: a.total.saltG + b.total.saltG,
      fiberG: a.total.fiberG + b.total.fiberG,
      ironMg: a.total.ironMg + b.total.ironMg,
      calciumMg: a.total.calciumMg + b.total.calciumMg,
    },
    dishCount: a.dishCount + b.dishCount,
    excludedDishCount: a.excludedDishCount + b.excludedDishCount,
    partialDishCount: a.partialDishCount + b.partialDishCount,
  }
}

/** 表示用の丸め: kcalとカルシウム(mg・値が大きい)は整数、それ以外は小数1桁
 * （概算なのでこれ以上細かくしない。鉄は1食1〜数mgの世界なので小数1桁を保つ） */
export function roundNutrient(key: keyof NutrientTotals, value: number): number {
  if (key === 'kcal' || key === 'calciumMg') return Math.round(value)
  return Math.round(value * 10) / 10
}

/** 出典表記（UI・/about/で使う。文言はja.tsに置くが、出典名はデータ由来なのでここから取る） */
export function nutritionSourceName(): string {
  return NUTRITION_DATA.source
}
