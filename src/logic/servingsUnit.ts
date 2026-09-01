/**
 * 人数分の数え方（人/個）による名札の出し分け（2026-09-01 便MW・オーナー裁定★2）。
 *
 * オーナー原文「単位は、食数を個数にした場合には、栄養も1個で表示。例えば、シフォンケーキ1個の
 * 栄養が一人分で表記されていても、なん等分したのかによって変わってしまうため数値を出しようがない。
 * シュークリームなども8個のレシピから1個分の栄養が表示される分には問題ない」。
 *
 * 決めごと:
 *  - **数字の意味・掛け算は変えない。**変えるのは名札（「人分/個分」「1食あたり/1個あたり」）だけ。
 *  - 出し分けはこの1か所に集約する。先例の Recipe.wholeBatch は `recipe.wholeBatch === true` を
 *    7ファイルに書き散らしており、片方だけ直す事故が起きうる形だった。画面は必ずここを通す。
 *  - 文言そのものは持たない（UI文言は ja.ts の一箇所・規約H）。ここは「どのキーを使うか」だけを決める。
 *  - 純ロジック・DB非依存＝scripts/tests から直接測れる（logic/servings.ts と同じ言い分）。
 */
import { ja } from '../i18n/ja'
import type { ServingsUnit } from '../db/types'
import { defaultMealServings } from './servings'

/** 未設定（既存データ）は人で数える */
export function isPieceUnit(unit: ServingsUnit | undefined): boolean {
  return unit === 'piece'
}

/**
 * 数え方で切り替わる名札の一覧。値はすべて ja.ts のキーの値そのもの
 * （{n} 等の差し込みは呼ぶ側が今までどおり .replace で行う）。
 */
export function servingsUnitText(unit: ServingsUnit | undefined) {
  const piece = isPieceUnit(unit)
  return {
    /** 数字のうしろの単位（「8人分」「8個分」）。共有カード画像のメタ行もこれ */
    suffix: piece ? ja.detail.servingsUnitPiece : ja.detail.servingsUnit,
    /** レシピ詳細の人数ステッパーの読み上げ名 */
    stepDown: piece ? ja.detail.servingsDownPiece : ja.detail.servingsDown,
    stepUp: piece ? ja.detail.servingsUpPiece : ja.detail.servingsUp,
    /** 原価の「1食あたり/1個あたり 約{n}円」（レシピ詳細と一覧のバッジ） */
    pricePerServing: piece ? ja.detail.pricePerServingPiece : ja.detail.pricePerServing,
    /** 人数分が未確認の品の注意（原価のそばと栄養カードの2か所） */
    servingsUnreadNote: piece ? ja.detail.servingsUnreadNotePiece : ja.detail.servingsUnreadNote,
    /** 栄養カードの折りたたみ1行「（1食あたり/1個あたり）: 」 */
    nutritionSummaryLabel: piece ? ja.nutrition.summaryLabelPiece : ja.nutrition.summaryLabel,
    /**
     * 栄養の表の1列目「1人分/1個分」。献立の栄養パネル（NutritionBalancePanel）が使う
     * ja.nutrition.servingHeader とはキーを分けてある（司令部裁定3: 献立側を巻き込まない）
     */
    nutritionServingHeader: piece
      ? ja.nutrition.recipeServingHeaderPiece
      : ja.nutrition.recipeServingHeader,
    /** 栄養の表の2列目「全量（{n}人分/個分）」 */
    nutritionTotalHeader: piece ? ja.nutrition.totalHeaderPiece : ja.nutrition.totalHeader,
    /** 登録フォームの欄の名前（「人数分」「個数」） */
    formLabel: piece ? ja.form.servingsLabelPiece : ja.form.servingsLabel,
    /** 登録フォームの数字のうしろの単位 */
    formSuffix: piece ? ja.form.servingsUnitPiece : ja.form.servingsUnit,
    /** 取り込みで人数分が読めなかったときの欄の下の注意 */
    formNotReadNote: piece ? ja.form.servingsNotReadNotePiece : ja.form.servingsNotReadNote,
    /** 保存前の範囲ガードの文言 */
    formOutOfRange: piece ? ja.form.servingsOutOfRangePiece : ja.form.servingsOutOfRange,
    /** 共有テキストの原価行 */
    shareLineCost: piece ? ja.share.lineCostPiece : ja.share.lineCost,
    /** 共有テキストの栄養行の「何あたりの値か」 */
    shareScope: piece ? ja.share.scopePerPiece : ja.share.scopePerServing,
    /** 共有モーダルの「いま表示している◯人分/個分の分量で〜」 */
    shareServingsNote: piece ? ja.share.servingsNotePiece : ja.share.servingsNote,
    /** 共有モーダルの栄養の選択肢の名前 */
    shareOptNutrition: piece ? ja.share.optNutritionPiece : ja.share.optNutrition,
    shareOptNutritionKcalOnly: piece
      ? ja.share.optNutritionKcalOnlyPiece
      : ja.share.optNutritionKcalOnly,
    /** 並行調理ナビの材料一覧の見出し「{n}人分/個分」 */
    naviIngredientsServings: piece
      ? ja.cookNavi.ingredientsServingsPiece
      : ja.cookNavi.ingredientsServings,
    /** 献立の食数を決める窓の「レシピに登録されている〜」の1行（司令部裁定4） */
    mealPlanRecipeNote: piece ? ja.mealPlan.servingsRecipeNotePiece : ja.mealPlan.servingsRecipeNote,
  }
}

/**
 * レシピ詳細を開いたときの表示人数の既定（2026-09-01 便MW・司令部裁定1）。
 *
 * 個で数える品は、設定「食数の設定」（householdServings）を**無視して**登録の個数で開く
 * ＝他人の人数を個数に流用しない（「食数の設定=3人」の人が「8個」のシフォンを開くと
 * 「3個分」で開き、材料が3/8に化ける穴をふさぐ）。
 * 人で数える品は今までどおり defaultMealServings（設定があれば設定の人数）。
 */
export function detailOpenServings(
  unit: ServingsUnit | undefined,
  householdServings: number | undefined,
  recipeServings: number | undefined,
): number {
  if (isPieceUnit(unit)) return defaultMealServings(undefined, recipeServings)
  return defaultMealServings(householdServings, recipeServings)
}
