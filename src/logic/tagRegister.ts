import { ja } from '../i18n/ja'
import type { ConfirmContent } from './confirmContent'

/**
 * 検索したキーワードを、そのままタグとして登録する仕組みの純ロジック
 * （2026-08-19 便HU・⑭ オーナー「キーワード検索して結果出した後、キーワードをタグに登録ボタン
 * 作って絞り込みに反映して。もちろん削除もできるように」）。
 *
 * 【どのレシピにタグが付くのか】
 * 「タグの名前だけを作る」形にすると、絞り込みのチップを押しても1品も出てこない
 * （＝オーナーの「絞り込みに反映して」を満たせない）。そこで
 * **押した時点でその検索に一致しているレシピにまとめて付ける**形にする。
 * 何品に付くのかは押す前にボタンの文字に出し（規約F）、確認の窓でもう一度言う。
 *
 * 【取り返しがつくこと】
 * 「削除」でそのタグを付けた品からタグを外す＝登録前の状態に戻る。
 * どのタグが検索から作られたものかは settings.keywordTags に控える
 * （同梱の基本レシピに元から付いている「和食」などを、まとめて消せてしまわないため）。
 *
 * 画面にもDexieにも触らない。書き込みは db/recipes.ts、出す場所は pages/RecipesPage.tsx。
 */

/** タグ名として扱える最大の長さ（チップに収まらない長さのタグを作らないための歯止め） */
export const KEYWORD_TAG_MAX_LENGTH = 20

/**
 * 検索語からタグ名を作る。前後の空白は落とし、語の間の空白（全角も）は半角1つにまとめる。
 * 空になる検索語・長すぎる検索語では作らない（null）。
 */
export function tagFromQuery(query: string): string | null {
  const normalized = query.replace(/[\s　]+/g, ' ').trim()
  if (normalized === '') return null
  if (normalized.length > KEYWORD_TAG_MAX_LENGTH) return null
  return normalized
}

/** そのタグがまだ付いていないレシピのid（＝これから実際に変わる品） */
export function recipeIdsMissingTag(
  recipes: readonly { id?: number; tags: string[] }[],
  tag: string,
): number[] {
  return recipes
    .filter((recipe) => recipe.id !== undefined && !recipe.tags.includes(tag))
    .map((recipe) => recipe.id as number)
}

/** そのタグが付いているレシピの品数（絞り込みのチップに出す数） */
export function countRecipesWithTag(recipes: readonly { tags: string[] }[], tag: string): number {
  return recipes.filter((recipe) => recipe.tags.includes(tag)).length
}

/** タグを1つ足した配列（既にあれば増やさない。並びは末尾に足す） */
export function tagsWithAdded(tags: readonly string[], tag: string): string[] {
  return tags.includes(tag) ? [...tags] : [...tags, tag]
}

/** タグを1つ外した配列（他のタグは順番も含めてそのまま） */
export function tagsWithRemoved(tags: readonly string[], tag: string): string[] {
  return tags.filter((value) => value !== tag)
}

/** 検索から登録したタグの控えに1つ足す（重複させない・登録した順に並べる） */
export function keywordTagsWith(current: readonly string[] | undefined, tag: string): string[] {
  const list = current ?? []
  return list.includes(tag) ? [...list] : [...list, tag]
}

/** 検索から登録したタグの控えから1つ外す */
export function keywordTagsWithout(current: readonly string[] | undefined, tag: string): string[] {
  return (current ?? []).filter((value) => value !== tag)
}

/**
 * 登録の確認（規約F: 何が変わって何が変わらないかを件数つきで両方書く）。
 * @param tag 付けるタグ名
 * @param targetCount これからタグが付く品数
 * @param untouchedCount タグが付かないまま残る品数（端末にある全レシピ − targetCount）
 */
export function buildKeywordTagAddConfirm(params: {
  tag: string
  targetCount: number
  untouchedCount: number
}): ConfirmContent {
  const t = ja.search
  const fill = (text: string) =>
    text
      .replace('{name}', params.tag)
      .replace('{n}', String(params.targetCount))
      .replace('{rest}', String(params.untouchedCount))
  return {
    title: fill(t.keywordTagConfirmTitle),
    bullets: [
      { label: t.keywordTagConfirmAddedLabel, text: fill(t.keywordTagConfirmAdded) },
      { label: t.keywordTagConfirmKeptLabel, text: fill(t.keywordTagConfirmKept) },
    ],
    notes: [t.keywordTagConfirmNote],
    confirmLabel: t.keywordTagConfirmOk,
  }
}

/**
 * 削除の確認（規約F）。タグを外すだけでレシピそのものは1品も消えないことを必ず書く。
 * @param count そのタグが付いている品数
 */
export function buildKeywordTagRemoveConfirm(params: { tag: string; count: number }): ConfirmContent {
  const t = ja.search
  const fill = (text: string) =>
    text.replace('{name}', params.tag).replace('{n}', String(params.count))
  return {
    title: fill(t.keywordTagRemoveConfirmTitle),
    bullets: [
      { label: t.keywordTagRemoveConfirmGoneLabel, text: fill(t.keywordTagRemoveConfirmGone) },
      { label: t.keywordTagRemoveConfirmKeptLabel, text: fill(t.keywordTagRemoveConfirmKept) },
    ],
    confirmLabel: t.keywordTagRemoveConfirmOk,
  }
}
