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
