import { INGREDIENT_READINGS, READINGS_VERSION } from './ingredientReadings'
import { isSeasoningLike } from './mainIngredients'

/**
 * 検索の「ゆらぎ」対策。
 * 「タマネギ」と「たまねぎ」のようなカタカナ⇄ひらがなの表記ゆれ、
 * 「玉ねぎ」と「たまねぎ」のような漢字⇄ひらがなの表記ゆれ（食材名辞書ベース）
 * を吸収する。目的は「正しい読み」ではなく「同じ食材が同じキーに収束すること」。
 *
 * 制限: 辞書（src/logic/ingredientReadings.ts）に無い漢字表記は変換されない。
 * 網羅は狙っておらず、ユーザーから報告があった食材を辞書に追記していく運用。
 * それまでは同じ食材を同じ表記で登録することで回避できる。
 */

// 辞書キーを長い順に並べた正規表現を1度だけ構築する（module scope）。
// 長い順にすることで「大根」が「切干大根」等より先に食われる事故を防ぎ、
// 1パスの置換にすることで置換結果への再置換（連鎖置換）を防ぐ。
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
const readingKeys = Object.keys(INGREDIENT_READINGS).sort((a, b) => b.length - a.length)
const readingPattern =
  readingKeys.length > 0 ? new RegExp(readingKeys.map(escapeRegExp).join('|'), 'g') : null

/**
 * カテゴリ語辞書(2026-07-12オーナー実機フィードバック: 「しめじ」「えのき」等で検索しても
 * 「きのこ」で検索しても両方ヒットしてほしい)。材料名がいずれかの word を含んでいたら、
 * 検索語に category を追加する。将来カテゴリを増やす場合はこの配列に1エントリ足すだけでよい。
 */
interface CategoryRule {
  /** 検索語として追加する語 */
  category: string
  /** 材料名にこれらのいずれかを含めば category を追加する(toHiragana正規化した上で判定) */
  words: string[]
}

const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'きのこ',
    words: [
      'しめじ',
      'えのき',
      '榎茸',
      'まいたけ',
      '舞茸',
      'エリンギ',
      'しいたけ',
      '椎茸',
      'なめこ',
      'マッシュルーム',
      'きくらげ',
    ],
  },
]

/** カタカナをひらがなに変換し、全角英数を半角化・小文字化した上で食材名辞書を適用する */
export function toHiragana(input: string): string {
  const normalized = input
    .normalize('NFKC') // 全角英数・記号を半角に揃える
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    )
  if (!readingPattern) return normalized
  return normalized.replace(readingPattern, (matched) => INGREDIENT_READINGS[matched])
}

/**
 * 料理名・材料名・タグから検索用キーワード一覧を作る（保存時に呼ぶ）。
 *
 * 調味料的な材料（大さじ/小さじ/単位なし/「少々」等。isSeasoningLikeと同じ基準）は
 * 検索語に含めない。「鮭（さけ）」で検索すると調味料の「酒（さけ）」を使うレシピが
 * 大量にヒットする誤爆の対策（2026-07-09 ペルソナテスト第1波）。
 * タイトル・タグ・主材料での検索はこれまで通り。
 */
export function buildSearchWords(
  title: string,
  ingredients: ReadonlyArray<{ name: string; amount: string; unit: string }>,
  tags: readonly string[],
): string[] {
  const words = new Set<string>()
  const mainNames = ingredients.filter((ing) => !isSeasoningLike(ing)).map((ing) => ing.name)
  for (const raw of [title, ...mainNames, ...tags]) {
    const trimmed = raw.trim()
    if (trimmed) words.add(toHiragana(trimmed))
  }
  // カテゴリ語(例:「しめじ」→「きのこ」)を材料名から検索語に追加する
  for (const ing of ingredients) {
    const normalizedName = toHiragana(ing.name)
    for (const rule of CATEGORY_RULES) {
      if (rule.words.some((word) => normalizedName.includes(toHiragana(word)))) {
        words.add(toHiragana(rule.category))
      }
    }
  }
  return [...words]
}

/**
 * searchWords（buildSearchWordsの出力）を作り直すべき変更が入るたびに+1する。
 * ingredientReadingsVersion（読み仮名辞書の版）とは別枠: こちらはカテゴリ辞書
 * （CATEGORY_RULES）等、読み仮名以外の理由でsearchWordsの作り直しが必要になったときに使う。
 * db/recipes.ts の rebuildSearchWordsIfNeeded が settings.searchIndexVersion と比較し、
 * 食い違っていれば起動時に全レシピのsearchWordsを再構築する。
 */
export const SEARCH_INDEX_VERSION = 1

/**
 * settingsに保存済みのバージョンが古く、全レシピのsearchWordsを再構築すべきかを判定する
 * （db/recipes.ts の rebuildSearchWordsIfNeeded が使う判定部分だけを切り出したもの。
 * db非依存の純ロジックなので単体テストできる）。読み仮名辞書・カテゴリ辞書のどちらか
 * 一方でも版が古ければtrueを返す。
 */
export function searchIndexNeedsRebuild(settings: {
  ingredientReadingsVersion: number
  searchIndexVersion: number
}): boolean {
  return (
    settings.ingredientReadingsVersion !== READINGS_VERSION ||
    settings.searchIndexVersion !== SEARCH_INDEX_VERSION
  )
}
