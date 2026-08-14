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
import { ja } from '../i18n/ja'

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
 * タイマーが指す手順の呼び方（「⑦（3-1）」）。
 * レシピ内の手順番号が分からないタイマー（ナビが足した「湯を沸かす」など）は丸数字だけ。
 * 段取りの通し番号を持たないタイマー（レシピ詳細から始めたもの）はここを通さない。
 *
 * 2つの番号のあいだに括弧を入れる（2026-08-12 便FU-4・利用者テスト
 * 「『前に開いていた手順⑫5から始まります。』⑫と5がくっついていて読めません。
 * タイマー調整のラベルも『手順③2のタイマーを調整』」）。
 * 便EZで画面のバッジと同じ並び（段取りの通し番号＋レシピ内の手順番号）にそろえたが、
 * バッジは2つの丸に分かれているのに対し、文字は続けて書くと1つの数字に見える。
 * 区切りに括弧を使うのは、レシピ内の手順番号が「3-1」（1手順を段取りの上で2つに分けた工程）に
 * なることがあり、中黒や別のつなぎ記号では番号の一部と紛れるため。
 */
export function naviStepText(naviOrder: number, recipeStepLabel?: string): string {
  return recipeStepLabel
    ? `${circledNumber(naviOrder)}（${recipeStepLabel}）`
    : circledNumber(naviOrder)
}

/**
 * 同じタイマーの**読み上げ用の呼び方**（2026-08-14 便GL・利用者テスト
 * 「タイマーの読み上げ名『手順⑨（1-2）』が、同じ『手順』で2つの番号を指していて紛らわしい」）。
 *
 * 画面では番号のバッジが2つ並んでいるので「手順⑨（1-2）」で読み比べられるが、
 * 耳で聞くときはバッジが無く、**1つの「手順」という語に2つの番号がぶら下がって**聞こえる。
 * 読み上げのときだけ、2つの番号を**それぞれの名前**で呼ぶ:
 *   段取りの通し番号 → 「段取り9」（画面の大きいバッジ）
 *   レシピ内の手順番号 → 「手順3」「手順1の2つめ」（画面の小さいバッジ。1手順を2つに分けた工程）
 *
 * 画面に出る文字（naviStepText）は変えない（2026-08-10 便EZ のオーナー指示で
 * バッジと同じ並びにそろえたもので、隣にバッジがあるかぎり読み比べられる）。
 * 丸数字を使わないのは、読み上げソフトによって「まる9」「9」と読みが割れるため。
 */
export function naviStepSpeechText(naviOrder: number, recipeStepLabel?: string): string {
  const order = ja.timer.stepSpeechOrder.replace('{o}', String(naviOrder))
  if (!recipeStepLabel) return order
  // 「3-1」＝レシピの手順3を段取りの上で2つに分けた1つめ。数字の羅列にせず言葉で分ける
  const split = /^(\d+)-(\d+)$/.exec(recipeStepLabel)
  const step = split
    ? ja.timer.stepSpeechSplit.replace('{n}', split[1]).replace('{part}', split[2])
    : recipeStepLabel
  return ja.timer.stepSpeechLabel.replace('{o}', order).replace('{r}', step)
}
