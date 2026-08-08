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
