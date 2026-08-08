/**
 * 合わせ調味料（先にまとめて計量してよい材料）のグループ色。
 * 食材チップの色（logic/ingredientColor.ts、食材の種類ごとの意味付け）とは別物で、
 * こちらはグループ番号ごとに単純に色を割り当てるだけ。
 * アクセント色・警告色と紛らわしくならないよう、その2色は使わない。
 */
const GROUP_COLOR_TOKENS = ['--chip-blue', '--chip-green', '--chip-pink', '--chip-yellow'] as const

export const MAX_SEASONING_GROUP = GROUP_COLOR_TOKENS.length

export function seasoningGroupColorToken(group: number): string {
  return GROUP_COLOR_TOKENS[(group - 1) % GROUP_COLOR_TOKENS.length]
}

/** 登録フォームでのタップ操作用: なし→1→2→…→上限→なし、の順に切り替える */
export function nextSeasoningGroup(current: number | undefined): number | undefined {
  if (current === undefined) return 1
  if (current >= MAX_SEASONING_GROUP) return undefined
  return current + 1
}

/**
 * 並行調理ナビでの合わせ調味料の線の引き方（2026-08-09 便EH・オーナー実機報告
 * 「なんでこっちに青で描いてるの？って混乱する」）。
 *
 * ナビの材料一覧は、どのレシピの材料かを**レシピごとの色**で示している。そこへ
 * 合わせ調味料のグループ色（青・緑・桃・黄）を重ねると、レシピの色と食い違って読めなくなる。
 * ナビでは線の色をレシピの色にそろえ、**同じレシピに合わせ調味料が2組以上あるとき**だけ
 * 線の引き方（実線→破線→点線→二重線）で組を見分ける（同梱109品では4品が該当）。
 */
const GROUP_LINE_STYLES = ['solid', 'dashed', 'dotted', 'double'] as const

export function seasoningGroupLineStyle(group: number): string {
  return GROUP_LINE_STYLES[(group - 1) % GROUP_LINE_STYLES.length]
}
