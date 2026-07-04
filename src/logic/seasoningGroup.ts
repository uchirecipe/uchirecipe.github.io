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
