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

/**
 * 合わせ調味料の組を指す印としてレシピでよく使われる記号（2026-08-14 便GF）。
 *
 * ここに集めたのは「材料名の先頭に付く印」と「手順文の中の印」を**同じ物差しで**読むため。
 * 貼り付け取り込み（logic/parseRecipeText.ts）が材料側の印を読み、並行調理ナビ
 * （logic/naviIngredients.ts）が手順側の印を読む。別々に持つと、材料は組にできたのに
 * 手順文の印と結び付かない（またはその逆）という食い違いが起きる。
 *
 * 「※」「＊」は注釈の印として使われるので入れない。英字（A〜D）は本文の別の意味と
 * 紛れるため**この一覧には入れず**、「そのレシピが実際にその英字で組を作っているとき」だけ
 * 別扱いで見る（seasoningLetterMark）。
 */
// 2026-08-23 便KF: 「◯」(U+25EF・大きい丸)を足した。見た目がほぼ同じ「○」(U+25CB)は
// 元から入っていたが、実データ（つくおき「基本の切り干し大根の煮物」）が使っていたのは
// U+25EF のほうで、印として読めずに材料名に『◯酒』のまま残っていた。
export const SEASONING_MARK_CHARS = '☆★◎○◯●◇◆■□▲△▼▽'
export const SEASONING_MARK_PATTERN = new RegExp(`[${SEASONING_MARK_CHARS}]`)

/**
 * 「A みりん」「Ｂしょうゆ」のように英字1文字で組を示す書き方（2026-08-14 便GF）。
 * 記号と違って本文の別の意味（「A5ランク」「Lサイズ」）と紛れるので、
 *   ①大文字の A〜D だけ（色は4組までなので E 以降は組にならない）
 *   ②直後が英数字でない（「A5」「AB」は組の印ではない）
 * の2つを満たすときだけ印とみなす。全角（Ａ〜Ｄ）は半角に読み替える。
 */
export function seasoningLetterMark(text: string): string | undefined {
  const trimmed = text.trim()
  const head = trimmed.charAt(0)
  if (!head) return undefined
  const half = /^[Ａ-Ｄ]$/.test(head) ? String.fromCharCode(head.charCodeAt(0) - 0xfee0) : head
  if (!/^[A-D]$/.test(half)) return undefined
  const next = trimmed.charAt(1)
  if (next !== '' && /[0-9０-９A-Za-zＡ-Ｚａ-ｚ]/.test(next)) return undefined
  return half
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
