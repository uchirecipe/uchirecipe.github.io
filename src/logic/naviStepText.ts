/**
 * 並行調理ナビのタイマーが指す手順の「呼び方」（2026-08-10 便EZ・オーナー指示）。
 *
 * オーナー実機フィードバック（原文）:
 *   タイマー「段取りの〜を開く』→「手順⑦3-1を開く」、「段取りの7番目」は削除
 *
 * 画面には手順番号のバッジが2つ並んでいる（src/components/StepBadge.tsx）:
 *   ①大きいバッジ＝**段取りの通し番号**（3品を1本に並べたときの順番。アクセント色）
 *   ②小さいバッジ＝**そのレシピ内の手順番号**（「3」、1手順を2つに分けた工程は「3-1」。料理の色）
 * これまで文字の側だけが「段取りの7番目」と別の呼び方をしていたため、画面の丸数字と
 * 読み比べる必要があった。文字の側もバッジと同じ並び（丸数字＋レシピ内の番号）にそろえる。
 */

/** 丸数字にできる上限（Unicodeに①〜㊿までしか無い） */
const CIRCLED_MAX = 50

/**
 * 段取りの通し番号を丸数字にする（画面の大きいバッジと同じ見え方を文字で表す）。
 * ①〜⑳・㉑〜㉟・㊱〜㊿を使い、範囲の外（0以下・51以上）はそのままの数字を返す。
 */
export function circledNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > CIRCLED_MAX) return String(n)
  if (n <= 20) return String.fromCodePoint(0x2460 + (n - 1))
  if (n <= 35) return String.fromCodePoint(0x3251 + (n - 21))
  return String.fromCodePoint(0x32b1 + (n - 36))
}

/**
 * タイマーが指す手順の呼び方（「⑦3-1」）。
 * レシピ内の手順番号が分からないタイマー（ナビが足した「湯を沸かす」など）は丸数字だけ。
 * 段取りの通し番号を持たないタイマー（レシピ詳細から始めたもの）はここを通さない。
 */
export function naviStepText(naviOrder: number, recipeStepLabel?: string): string {
  return recipeStepLabel ? `${circledNumber(naviOrder)}${recipeStepLabel}` : circledNumber(naviOrder)
}
