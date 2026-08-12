/**
 * 調理中モードの手順の文字の大きさ（2026-08-12 便FX・オーナー実機
 * 「調理中モードの文字の大きさは、ユーザーが自由に変更できない？
 * 小さい画面だと表示できなくなるから無理か」）。
 *
 * オーナーの懸念（大きくすると画面に入りきらない）は、手順を出している枠が
 * もともと縦にスクロールする作りなので**入りきらないことは起きない**（はみ出したぶんは送れる）。
 * 逆に小さい画面では**小さくしたい**という要求もあるので、標準より下も用意する。
 *
 * 効くのは手順まわりの文字だけ（手順本文・その手順の注意書き・その手順で使う材料）。
 * 番号のバッジ・ボタン・待ちブロックの但し書きは変えない＝押す場所の大きさが動かないので、
 * 台所で持ち替えたときに指の位置が変わらない。
 */

/** 選べる倍率（標準＝1）。並びがそのまま画面のボタンの並びになる */
export const COOK_FONT_SCALES = [0.85, 1, 1.25, 1.5] as const

export const DEFAULT_COOK_FONT_SCALE = 1

/**
 * 設定に入っている値を、選べる倍率のどれかに寄せる。
 * 未設定（既存ユーザー含む）・壊れた値・一覧に無い値は標準に戻す
 * ＝古い版や手で書き換えたデータで文字が消えるほど小さくならない。
 */
export function resolveCookFontScale(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_COOK_FONT_SCALE
  return COOK_FONT_SCALES.find((scale) => scale === value) ?? DEFAULT_COOK_FONT_SCALE
}

/** その倍率での文字の大きさ（CSSの font-size に入れる文字列）。{rem}＝標準の大きさ */
export function cookFontSize(baseRem: number, scale: number): string {
  return `${(baseRem * scale).toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}rem`
}
