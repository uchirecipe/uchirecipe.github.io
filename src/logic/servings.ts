/**
 * 人数分(servings)の範囲ガード。
 *
 * 上限・下限自体は2026-07-28 便BWで決めたもの（家庭用レシピ帳として常識的な範囲）。
 * ただし当時のクランプは ± ボタンの onClick にしか無く、「外から入ってくる人数分」
 * ——URL取り込み・テキスト貼り付け・下書き復元——は素通りしていた（2026-07-30 便CK/①-1）。
 * 手では21人分以上を作れないのに、貼り付けからは50人分、下書きからは99人分が保存できていた。
 *
 * そのため範囲の定義とクランプをここに集約し、setServings を呼ぶ全経路がこれを通る形にした。
 * 純ロジックとして切り出してあるのは scripts/test-logic.mjs から直接検証するため
 * （画面側の onClick に埋めたままでは、また別の経路が足された時に守られない）。
 */
const MIN_SERVINGS_VALUE = 1
const MAX_SERVINGS_VALUE = 20

export const MIN_SERVINGS = MIN_SERVINGS_VALUE
export const MAX_SERVINGS = MAX_SERVINGS_VALUE

/** 人数分として保存してよい値か（1〜20の整数のみ。小数・NaN・範囲外はすべてfalse） */
export function isServingsInRange(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_SERVINGS && value <= MAX_SERVINGS
}

/**
 * 人数分を許容範囲に収める。
 * 小数は切り捨てる（「2.5人分」は手入力でも作れない）。数値でない値は下限に寄せる
 * （取り込み・下書きの壊れた値を捨てて既定値に戻すより、いちばん近い有効値を残す）。
 */
export function clampServings(value: number): number {
  if (!Number.isFinite(value)) return MIN_SERVINGS
  return Math.min(MAX_SERVINGS, Math.max(MIN_SERVINGS, Math.floor(value)))
}

/**
 * 献立の枠の「既定の食数」（2026-08-03 便DK）。枠ごとに食数を決めていないときに、
 * 何人分として扱うかを返す。
 *
 * 設定「ふだん作る人数」(Settings.householdServings)があればその人数、無ければ
 * 従来どおりその料理に登録されている人数分(Recipe.servings)。どちらも無い・壊れた値なら1人分。
 *
 * 「既定に戻す」の戻り先もこの値なので、ボタンの文言（何人分に戻るか）と実際の戻り先が
 * ずれないよう、判定はこの1か所だけに置く。
 */
export function defaultMealServings(
  householdServings: number | undefined,
  recipeServings: number | undefined,
): number {
  if (householdServings != null && householdServings > 0) return clampServings(householdServings)
  if (recipeServings != null && recipeServings > 0) return clampServings(recipeServings)
  return MIN_SERVINGS
}

/**
 * 献立の枠を実際に何人分作るか＝実効食数（2026-08-03 便DK）。優先順位は
 *  ①その枠に決めた食数(MealPlanEntry.servings) ②設定「ふだん作る人数」 ③レシピの登録人数分。
 *
 * 買い物メモの分量と、これから作る予定の概算食費は必ずこの値で数える
 * （画面ごとに優先順位を書き分けると、買い物メモと食費で違う人数分が出る）。
 * ①②とも未設定なら③＝従来とまったく同じ値になる（後方互換）。
 */
export function effectiveMealServings(
  entryServings: number | undefined,
  householdServings: number | undefined,
  recipeServings: number | undefined,
): number {
  if (entryServings != null && entryServings > 0) return clampServings(entryServings)
  return defaultMealServings(householdServings, recipeServings)
}
