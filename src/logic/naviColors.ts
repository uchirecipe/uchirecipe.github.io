/**
 * 並行調理ナビのレシピ色（最大3品）。デザイントークンのチップ色を流用する。
 *
 * 2026-08-08 便ED: 常駐タイマーの左端にも同じ色を出す（オーナー実機フィードバック
 * 「どのレシピのタイマーか一目で分かるように」）ため、ナビ画面のローカル定数から
 * ここへ移した。**色を変えるときはこの1か所だけを直す**（画面ごとに書き分けない）。
 */
export const NAVI_RECIPE_COLORS = ['var(--chip-blue)', 'var(--chip-green)', 'var(--chip-pink)'] as const

/** 0,1,2 のレシピ色添字から CSS の色を返す（範囲外は折り返す） */
export function naviRecipeColor(colorIndex: number): string {
  const size = NAVI_RECIPE_COLORS.length
  return NAVI_RECIPE_COLORS[((colorIndex % size) + size) % size]
}

/**
 * 上の色に対応する日本語の色名（2026-08-10 便FI・docs/69 第3段）。
 *
 * 調理中モードで「色を言うとその品の手順に移る」を入れるにあたり、**画面に出す語と
 * 声で受ける語を1か所にまとめる**。色（NAVI_RECIPE_COLORS）と語がばらばらの場所にあると、
 * 片方だけ変わったときに「青と言ったのに緑が動く」事故になる。
 *
 * docs/69 のオーナー原文は「赤・青・緑」だが、それは意図の説明であって画面の実物ではない。
 * 実装の3色は**青・緑・ピンク**なので、語もそれに合わせる（**赤は使わない**）。
 */
export const NAVI_COLOR_WORDS = ['青', '緑', 'ピンク'] as const

/** 0,1,2 のレシピ色添字から日本語の色名を返す（範囲外は折り返す） */
export function naviColorWord(colorIndex: number): string {
  const size = NAVI_COLOR_WORDS.length
  return NAVI_COLOR_WORDS[((colorIndex % size) + size) % size]
}

/**
 * 声で受け付ける色の言い方（添字＝レシピ色の添字）。
 *
 * 音声認識は同じ発話を漢字・かな・カナのどれでも返しうるので、その揺れだけを並べる。
 * **ここに入れる語はすべて「発話まるごとが一致したときだけ」当てる**（logic/voiceCommand.ts の
 * matchVoiceColor）。部分一致で当てると「青ねぎを切る」「緑黄色野菜」で手順が飛ぶ。
 */
export const NAVI_COLOR_SPEECH: readonly (readonly string[])[] = [
  ['青', 'あお', 'アオ', '青色'],
  ['緑', 'みどり', 'ミドリ', '緑色'],
  ['ピンク', 'ぴんく', 'ピンク色'],
]
