import { ja } from '../i18n/ja'
import type { ConfirmContent } from './confirmContent'

/**
 * よく使う検索を「絞り込みのタグ」として登録しておく仕組みの純ロジック
 * （2026-08-19 便HZ・②。初出は便HU・⑭）。
 *
 * 【いま作っているもの＝A案】
 * オーナーの訂正: 「検索結果にタグづけは、絞り込んだレシピにタグをつけるのではなく、
 * 絞り込み機能の『タグ』に新しいタグを追加する、という意味でした。レシピ自体はいじりません」
 * 「よく使うタグを自分で設定する機能です。レシピにつけたい場合は、ユーザーがレシピを
 * 編集画面でタグかキーワードを入力する必要があります」。
 *
 * つまり登録するのは**検索の言葉だけ**。押すとその検索が呼び戻される。
 * **レシピのデータには一切書き込まない**（この一点がこの版の作り直しの目的）。
 * 控えは settings.savedSearches に持つ。
 *
 * 【以前の版（便HU）との違い】
 * 便HU版は、押した時点で検索に一致したレシピに実際にタグを書き込んでいた。
 * その書き込みの経路（db/recipes.ts の addTagToRecipes・tagsWithAdded・recipeIdsMissingTag）は
 * この版で全部消してある。すでに書き込まれてしまったタグは黙って消さず、
 * 絞り込みパネルの「以前の版でレシピに書き込まれたタグ」から外せるようにする
 * （＝データを失う方に勝手に倒さない）。その後始末だけが tagsWithRemoved を使う。
 *
 * 画面にもDexieにも触らない。出す場所は pages/RecipesPage.tsx。
 */

/**
 * 登録できる言葉の最大の長さ
 * （チップに収まらない長さのタグを作らないための歯止め。文字数はチップ1行ぶんの目安）
 */
export const SAVED_SEARCH_MAX_LENGTH = 20

/**
 * 検索語から、登録する言葉を作る。前後の空白は落とし、語の間の空白（全角も）は半角1つにまとめる。
 * 空になる検索語・長すぎる検索語では作らない（null）。
 * 空白のまとめ方を検索と合わせてあるので、登録した言葉をそのまま検索欄に戻せば同じ結果になる。
 */
export function savedSearchFromQuery(query: string): string | null {
  const normalized = query.replace(/[\s　]+/g, ' ').trim()
  if (normalized === '') return null
  if (normalized.length > SAVED_SEARCH_MAX_LENGTH) return null
  return normalized
}

/** 登録した言葉の控えに1つ足す（重複させない・登録した順に並べる） */
export function savedSearchesWith(current: readonly string[] | undefined, name: string): string[] {
  const list = current ?? []
  return list.includes(name) ? [...list] : [...list, name]
}

/** 登録した言葉の控えから1つ外す */
export function savedSearchesWithout(
  current: readonly string[] | undefined,
  name: string,
): string[] {
  return (current ?? []).filter((value) => value !== name)
}

/** そのタグが付いているレシピの品数（以前の版が書き込んだタグの後始末に使う） */
export function countRecipesWithTag(recipes: readonly { tags: string[] }[], tag: string): number {
  return recipes.filter((recipe) => recipe.tags.includes(tag)).length
}

/** タグを1つ外した配列（他のタグは順番も含めてそのまま） */
export function tagsWithRemoved(tags: readonly string[], tag: string): string[] {
  return tags.filter((value) => value !== tag)
}

/**
 * 登録したタグを削除するときの確認（規約F: 何が消えて何が残るかを件数つきで両方書く）。
 * 消えるのは絞り込みに並ぶタグだけで、レシピは1品も変わらない。
 * @param name 登録した言葉
 * @param recipeCount 端末にあるレシピの品数（＝この操作で1品も変わらないことを数で示す）
 */
export function buildSavedSearchRemoveConfirm(params: {
  name: string
  recipeCount: number
}): ConfirmContent {
  const t = ja.search
  const fill = (text: string) =>
    text.replace(/\{name\}/g, params.name).replace(/\{n\}/g, String(params.recipeCount))
  return {
    title: fill(t.savedSearchRemoveConfirmTitle),
    bullets: [
      { label: t.savedSearchRemoveConfirmGoneLabel, text: fill(t.savedSearchRemoveConfirmGone) },
      { label: t.savedSearchRemoveConfirmKeptLabel, text: fill(t.savedSearchRemoveConfirmKept) },
    ],
    notes: [fill(t.savedSearchRemoveConfirmNote)],
    confirmLabel: t.savedSearchRemoveConfirmOk,
  }
}

/**
 * 以前の版がレシピ本体に書き込んだタグを外すときの確認（規約F）。
 * タグを外すだけでレシピそのものは1品も消えないことを必ず書く。
 * @param count そのタグが付いている品数
 */
export function buildLegacyTagRemoveConfirm(params: { tag: string; count: number }): ConfirmContent {
  const t = ja.search
  const fill = (text: string) =>
    text.replace(/\{name\}/g, params.tag).replace(/\{n\}/g, String(params.count))
  return {
    title: fill(t.legacyTagRemoveConfirmTitle),
    bullets: [
      { label: t.legacyTagRemoveConfirmGoneLabel, text: fill(t.legacyTagRemoveConfirmGone) },
      { label: t.legacyTagRemoveConfirmKeptLabel, text: fill(t.legacyTagRemoveConfirmKept) },
    ],
    confirmLabel: t.legacyTagRemoveConfirmOk,
  }
}
