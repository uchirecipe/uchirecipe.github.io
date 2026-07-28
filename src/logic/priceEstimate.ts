import type { Ingredient } from '../db/types'
import { leadingRangeAmount, normalizeAmountInput, resolveCalcAmount } from './amount'
import { toHiragana } from './kana'
import { normalizeUnit, parseUnitQuantity } from './unitGrams'
import { typicalAmountFor } from './amountAssumption'
// 栄養側の「1枚=◯g」等の目安量(文部科学省 日本食品標準成分表ベース・docs/47監査済み)を
// 原価の按分にも使うための参照。依存の向きは priceEstimate → nutrition の一方通行で、
// nutrition側は単位換算の定義を unitGrams.ts から取るため循環importにはならない
// （2026-07-28 便BY/COST-01。同じ材料の「量」を2つのエンジンが別々に解釈していたのを解消する）。
import { convertToGrams, matchNutritionFood } from './nutrition'

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
  /**
   * 元になったPriceEntryのid(2026-07-16 裁定1「原価ビュー」追加)。マスタから作った索引なら
   * 必ず入っている想定だが、PRICE_DEFAULTSの生データ(idを持たない)から直接buildPriceIndexを
   * 呼ぶテスト用途もあるため任意項目のまま後方互換を保つ。原価ビューの編集チップは
   * matchPriceEntryで見つけたエントリのidからマスタ行を特定し、編集モーダルに渡す
   */
  id?: number
  normalizedName: string
  /**
   * 照合専用キー: normalizedName(括弧除去済みの表示名)をさらにtoHiraganaでかな正規化したもの
   * （カタカナ⇄ひらがな⇄辞書登録済み漢字の表記ゆれを吸収）。
   * H-2(Fable裁定): db/prices.tsの重複チェック(normalizeForDuplicateCheck)と同一の正規化に
   * 揃えることで、「たまねぎ」で登録した価格が材料名「玉ねぎ」にも一致するようにする
   * (登録時はかな正規化で重複ブロックされるのに照合時は一致しない、という袋小路の解消)。
   * normalizedNameは表示・デバッグ用にかな正規化前のまま保持する。
   */
  matchKey: string
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
 * 照合キー(かな正規化後)が長いものを先に並べる（前方一致で複数ヒットしたとき、より具体的な名前を優先するため）。
 */
export function buildPriceIndex(
  entries: { id?: number; name: string; pricePerUnit: number; unit: string; isDefault?: boolean }[],
): PriceIndexEntry[] {
  return entries
    .map((e) => {
      const normalizedName = normalizeIngredientNameForPrice(e.name)
      return {
        id: e.id,
        normalizedName,
        matchKey: toHiragana(normalizedName),
        pricePerUnit: e.pricePerUnit,
        unit: e.unit,
        isDefault: e.isDefault === true,
      }
    })
    .filter((e) => e.normalizedName && e.pricePerUnit > 0)
    .sort((a, b) => b.matchKey.length - a.matchKey.length)
}

/**
 * 材料名からマスタの1件を探す。
 * 1) かな正規化後の完全一致 → 2) 材料名がマスタ名で始まる前方一致（例:「たまねぎ薄切り」→「たまねぎ」、
 * 「トウフ」で登録した材料が「とうふ」のマスタに一致 等）の順で照合する（H-2: db/prices.tsの
 * 重複チェックと同じかな正規化キーで比較する）。
 */
export function matchPriceEntry(name: string, index: PriceIndexEntry[]): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  const key = toHiragana(normalized)
  const exact = index.find((e) => e.matchKey === key)
  if (exact) return exact
  return index.find((e) => key.startsWith(e.matchKey))
}

/** "200" "1.5" "1/2" のような数字の分量を数値化する（人数換算不要の素の値） */
function parseNumericAmount(amount: string): number | undefined {
  // 範囲分量(「200〜250」)は先頭の値で計算する(2026-07-28 便BX/C06。栄養側と同じ扱い)
  const trimmed = leadingRangeAmount(normalizeAmountInput(amount.trim()))
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

/** マスタ行が投入時の目安のままか(default)、ユーザーが上書きした価格か(user)の由来種別 */
export type PriceSource = 'default' | 'user'

/** マスタ由来の1行分の見積もり（金額＋由来種別。2026-07-13 UIペルソナQA: 表示側の「目安」表記の出し分けに使う） */
export interface IngredientPriceEstimate {
  yen: number
  source: PriceSource
}

/**
 * 「数量+単位」を、栄養側の目安量(NutritionFood.unitGrams・gramsPerMl)でグラムに換算する。
 * foodは材料名とマスタ名の両方で名寄せを試す(材料名が「鶏むね肉(皮なし)」のような
 * 書き方でも、マスタ名「鶏むね肉」で拾えるようにするため)。
 */
function toGramsForPrice(
  ingredientName: string,
  entryName: string,
  value: number,
  unit: string,
): number | null {
  const food = matchNutritionFood(ingredientName) ?? matchNutritionFood(entryName)
  if (!food) return null
  return convertToGrams(value, unit, food)
}

/**
 * マスタ一致した材料1行分の金額を見積もる。
 * ingredientの分量・単位がマスタのunitと数量として噛み合えば按分計算し、
 * 最後まで噛み合わなければマスタの金額をそのまま1行分の目安として使う。
 * sourceは一致したマスタ行がisDefaultのままか(user='default')、ユーザーが上書き済みか('user')を表す。
 *
 * 按分の優先順位（1〜2は2026-07-14 単位正規化・オーナー要望「kgが混ざっても平気か不安」への対応。
 * 3〜4は2026-07-28 便BY/COST-01で追加）:
 * 1) normalizeUnitで両者を正規化し、同じ次元（質量↔質量・体積↔体積）なら基準量換算で按分。
 *    個数(count)同士は単位名も一致する時だけ按分する（「1個」と「1本」は換算不可）。
 * 2) どちらか（または両方）がnormalizeUnitで解釈できない単位でも、文字列として完全一致するなら
 *    従来どおり按分する（「1杯」「1合」「1箱」等、mass/volume/countの対応表に無い単位の後方互換。
 *    既存の"完全一致で按分"の挙動を正規化に置き換えるのではなく包含するため）。
 * 3) 次元も単位名も食い違うときは、両者を栄養側の目安量でグラムに寄せて質量比で按分する
 *    （「鶏むね肉 1枚」とマスタ「100g」のように、個数と重さで書かれていて比べられなかった組。
 *    従来はここでマスタ金額の満額＝100g分の90円が1枚に乗り、実勢の1/2〜1/5という過小計上に
 *    なっていた。栄養側は同じ材料を250gとして計算しており、同じ画面の2つの数字が
 *    食い違う原因でもあった）。
 * 4) 分量が数値で書かれていない（「適量」「少々」）材料は、1回の調理で使う量
 *    （amountAssumption.tsのtypicalAmountFor）を持っていればその量で按分する
 *    （登録単位が販売単位のサラダ油・ごま油・オリーブオイルで、「適量」1行にボトル1本分の
 *    金額が乗るのを止める）。
 * 5) 上記いずれにも当てはまらなければ、マスタの金額をそのまま使う（安全側のフォールバック）。
 */
export function estimateIngredientYen(
  ingredient: Pick<Ingredient, 'name' | 'amount' | 'unit'>,
  index: PriceIndexEntry[],
): IngredientPriceEstimate | undefined {
  const entry = matchPriceEntry(ingredient.name, index)
  if (!entry) return undefined
  const { qty: baseQty, baseUnit } = parseUnitQuantity(entry.unit)
  // 「大2」「小1/2」(大さじ/小さじの略記)・「ひとかけ」等の和語の個数詞(単位欄が空の時のみ該当)は、
  // resolveCalcAmountが展開した単位(大さじ/小さじ/かけ 等)をingUnitとして使う(2026-07-21分量表記拡充)。
  // 該当しなければingredient.unitをNFKC正規化したもの(2026-07-21全角対応: 下のingUnit===baseUnitの
  // 完全一致フォールバックはbaseUnit(parseUnitQuantityで正規化済み)と比較するため、ingUnit側も
  // 同じ正規化形にしておく必要がある)
  const resolved = resolveCalcAmount(ingredient.amount ?? '', ingredient.unit)
  const ingUnit = resolved ? resolved.unit : normalizeAmountInput((ingredient.unit ?? '').trim())
  const amountNum = resolved ? resolved.value : parseNumericAmount(ingredient.amount ?? '')
  const source: PriceSource = entry.isDefault ? 'default' : 'user'
  const masterNorm = baseUnit ? normalizeUnit(baseQty, baseUnit) : null

  if (amountNum != null && amountNum > 0 && ingUnit && baseUnit) {
    const recipeNorm = normalizeUnit(amountNum, ingUnit)
    if (recipeNorm != null && masterNorm != null && recipeNorm.dim === masterNorm.dim) {
      if (recipeNorm.dim === 'count') {
        if (masterNorm.dim === 'count' && recipeNorm.unit === masterNorm.unit) {
          return { yen: Math.round(entry.pricePerUnit * (recipeNorm.base / masterNorm.base)), source }
        }
        // 個数系だが単位名が違う（例:「1個」vs「1本」）→ グラム換算の按分へ
      } else {
        return { yen: Math.round(entry.pricePerUnit * (recipeNorm.base / masterNorm.base)), source }
      }
    } else if (ingUnit === baseUnit) {
      return { yen: Math.round(entry.pricePerUnit * (amountNum / baseQty)), source }
    }
    // 3) グラム換算での按分
    const recipeGrams = toGramsForPrice(ingredient.name, entry.normalizedName, amountNum, ingUnit)
    const masterGrams = toGramsForPrice(ingredient.name, entry.normalizedName, baseQty, baseUnit)
    if (recipeGrams != null && masterGrams != null && masterGrams > 0) {
      return { yen: Math.round(entry.pricePerUnit * (recipeGrams / masterGrams)), source }
    }
  } else if (baseUnit) {
    // 4) 「適量」「少々」を1回の使用量で按分
    const typical = typicalAmountFor(entry.normalizedName)
    if (typical) {
      const { qty: typQty, baseUnit: typUnit } = parseUnitQuantity(typical)
      const typNorm = normalizeUnit(typQty, typUnit)
      if (
        typNorm != null &&
        masterNorm != null &&
        typNorm.dim === masterNorm.dim &&
        (typNorm.dim !== 'count' ||
          (masterNorm.dim === 'count' && typNorm.unit === masterNorm.unit))
      ) {
        return { yen: Math.round(entry.pricePerUnit * (typNorm.base / masterNorm.base)), source }
      }
      const typGrams = toGramsForPrice(ingredient.name, entry.normalizedName, typQty, typUnit)
      const masterGrams = toGramsForPrice(ingredient.name, entry.normalizedName, baseQty, baseUnit)
      if (typGrams != null && masterGrams != null && masterGrams > 0) {
        return { yen: Math.round(entry.pricePerUnit * (typGrams / masterGrams)), source }
      }
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

/**
 * 材料1行分の「1食あたりの按分原価」(2026-07-20 便AJ「原価ビュー」再改修・docs/45)。
 * 「原価を見る」ON時、材料行の計量表記の位置に表示する値の計算本体。
 * 優先度はestimateRecipeCostと同じ(個別入力(ing.price) > マスタ一致 > なし)。
 * 全量(登録時のamount・レシピ登録人数=servings分)の金額をservingsで割った値
 * (=1食あたりの按分原価)を返す。servingsで割ってからさらに表示側の人数変更(servingsOverride)
 * には追従させない設計のため、呼び出し側は必ずrecipe.servings(登録人数)を渡すこと
 * (仕様書「2食分などの変動値は出さない」)。
 * 価格情報が無い(マスタ不一致かつ個別入力も無い)材料はundefinedを返す
 * (estimateRecipeCostの合計計算から除外される材料と同じ扱い)。
 */
export interface IngredientRowCostEstimate {
  /** 全量(登録量)の金額。個別入力ならその値、マスタ一致ならestimateIngredientYenの結果 */
  totalYen: number
  /** totalYen ÷ servings を四捨五入した1食あたりの按分原価。0(=1円未満)なら
   *  呼び出し側は金額の代わりに「1円未満」を表示する想定(仕様書「四捨五入・1円未満は「1円未満」」) */
  perServingYen: number
}

export function estimateIngredientRowCost(
  ingredient: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>,
  index: PriceIndexEntry[],
  servings: number,
): IngredientRowCostEstimate | undefined {
  let totalYen: number
  if (ingredient.price != null && ingredient.price > 0) {
    totalYen = ingredient.price
  } else {
    const estimated = estimateIngredientYen(ingredient, index)
    if (estimated == null || estimated.yen <= 0) return undefined
    totalYen = estimated.yen
  }
  const perServingYen = Math.round(servings > 0 ? totalYen / servings : totalYen)
  return { totalYen, perServingYen }
}

/** 献立エントリ群(mealPlans)の概算食費の合計・内訳 */
export interface MealPlanCostSum {
  /** 円換算の合計 */
  total: number
  /** マスタ価格で補完した材料の件数の合計 */
  fromMasterCount: number
}

/**
 * 献立エントリ群(mealPlans)の概算食費合計。エントリのrecipeIdから該当レシピを引き、
 * estimateRecipeCost(レシピ登録時の基準人数分)を合算する。週の概算食費(MealPlanPageの
 * weekCostEstimate)と期間の食費(2026-07-17 便AB・docs/35 §5「期間の食費」のrangeCostEstimate)が
 * 共通で使う集計ロジック。recipeが見つからないエントリ(削除済みレシピ等を指す孤児行)はスキップする
 */
export function sumMealPlanEntriesCost<E extends { recipeId: number }>(
  entries: E[],
  recipeById: Map<number, { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[] }>,
  index: PriceIndexEntry[],
): MealPlanCostSum {
  return entries.reduce<MealPlanCostSum>(
    (acc, e) => {
      const recipe = recipeById.get(e.recipeId)
      if (!recipe) return acc
      const estimate = estimateRecipeCost(recipe.ingredients, index)
      return {
        total: acc.total + estimate.total,
        fromMasterCount: acc.fromMasterCount + estimate.fromMasterCount,
      }
    },
    { total: 0, fromMasterCount: 0 },
  )
}

/** 「作った記録」群の実績原価合計と食数（記録1件=1食）。2026-07-24 便BH-3・タスク9 */
export interface CookedLogsCostSum {
  /** 実績原価の合計（各記録のレシピを登録人数基準のestimateRecipeCostで見積もって合算） */
  total: number
  /** 食数（=渡した記録の件数。1回の「作った!」を1食として数える） */
  count: number
}

/**
 * 「作った記録」（cookedLogs）群の実績ベースの概算食費合計と食数を出す（2026-07-24 便BH-3・タスク9・
 * 期間の食費の「実績ベース」表示用）。渡す配列は「記録1件につきそのレシピ1件」（同じレシピを2回
 * 作った記録があれば同じレシピが2件並ぶ）を想定する。予定ベースのsumMealPlanEntriesCostと同じく
 * 登録人数基準で見積もる。countは食数（記録件数）で、呼び出し側は total÷count で「1食あたり」を出す。
 */
export function sumCookedRecipesCost(
  recipesForLogs: { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[] }[],
  index: PriceIndexEntry[],
): CookedLogsCostSum {
  let total = 0
  for (const r of recipesForLogs) {
    total += estimateRecipeCost(r.ingredients, index).total
  }
  return { total, count: recipesForLogs.length }
}
