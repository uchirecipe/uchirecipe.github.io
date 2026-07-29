import { INGREDIENT_READINGS, READINGS_VERSION } from './ingredientReadings'
import { DISH_WORD_READINGS, TITLE_READINGS } from './titleReadings'
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
 * 材料名の照合キー。toHiragana に加えて空白・中黒を落とす
 * （「白 いりごま」「オリーブ・オイル」のような区切りのゆれを吸収する）。
 * 栄養の名寄せ(nutrition.ts)と「少々・適量」の仮の量(amountAssumption.ts)が
 * 同じ土俵で名前を比べられるよう、1箇所に置いている（2026-07-28 便BY）。
 */
export function toIngredientKey(name: string): string {
  return toHiragana(name.trim()).replace(/[\s・]+/g, '')
}

/**
 * 在庫・買い物メモで「同じ食材か」を判定するときの照合キー（2026-07-29 便CC/C4）。
 * toIngredientKey に加えて、材料名の末尾に付く括弧書きの修飾を落とす
 * （「長ねぎ（白い部分）」「片栗粉（あん用）」「さば（切り身）」→ 本体の食材名だけにする）。
 *
 * 同梱103レシピの材料名199種のうち50種（25%）が括弧・空白付きで、これを落とさないと
 * 在庫チップ「長ねぎ」が材料「長ねぎ（白い部分）」と別物になり、
 * ①買い物候補から除外されない ②買い物完了で同名別チップが増える、という食い違いが出る。
 *
 * 経路ごとにバラバラだった名寄せ（かな完全一致／かな部分一致）をこのキーの**完全一致**に
 * 揃える。部分一致に寄せてはいけない: 在庫「卵」が材料「砂糖（卵用）」に、
 * 在庫「豆腐」が「高野豆腐」に当たって誤って減るため（診断C4の反証で実測）。
 *
 * 売り場分類（pantryGroups.categorizePantryName）は「同じ食材か」ではなく「どの棚か」を
 * 決める別目的なので、このキーには寄せない（漢字キーワードがかな化キーに当たらなくなる）。
 * 栄養の matchNutritionFood も括弧に意味がある場合（めんつゆ（2倍）等）があるため対象外。
 */
export function toPantryKey(name: string): string {
  return toIngredientKey(name)
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim()
}

/**
 * タグでよく使う語の読み（2026-07-28 便BW・QA S3）。
 *
 * タグ候補の絞り込みは toHiragana で行っているが、その辞書（INGREDIENT_READINGS）は食材名だけで、
 * 「夏」「作り置き」のようなタグ語の読みを持たない。そのため「なつ」と打っても既存タグの「夏」に
 * 辿り着けなかった。ここでは献立・保存・ジャンルなど、タグとして実際によく使う語だけを補う。
 * 網羅は狙わない（読みが引けない語は従来どおり表記の一致で拾う）。
 */
const TAG_READINGS: Record<string, string> = {
  春: 'はる',
  夏: 'なつ',
  秋: 'あき',
  冬: 'ふゆ',
  和食: 'わしょく',
  洋食: 'ようしょく',
  中華: 'ちゅうか',
  韓国: 'かんこく',
  作り置き: 'つくりおき',
  作りおき: 'つくりおき',
  常備菜: 'じょうびさい',
  時短: 'じたん',
  節約: 'せつやく',
  簡単: 'かんたん',
  定番: 'ていばん',
  弁当: 'べんとう',
  朝食: 'ちょうしょく',
  昼食: 'ちゅうしょく',
  夕食: 'ゆうしょく',
  夜食: 'やしょく',
  主菜: 'しゅさい',
  副菜: 'ふくさい',
  汁物: 'しるもの',
  主食: 'しゅしょく',
  子供: 'こども',
  子ども: 'こども',
  来客: 'らいきゃく',
  行事: 'ぎょうじ',
  正月: 'しょうがつ',
  煮物: 'にもの',
  焼き物: 'やきもの',
  揚げ物: 'あげもの',
  炒め物: 'いためもの',
  蒸し物: 'むしもの',
  鍋: 'なべ',
  丼: 'どんぶり',
  麺: 'めん',
  漬物: 'つけもの',
  甘辛: 'あまから',
  作り方: 'つくりかた',
  // 2026-07-29 便CI/C09: 同梱レシピが実際に使っているタグのうち、読みが引けなかったもの。
  // 実機QAで「こうたんぱく」「れいとうすとっく」「さかな」がいずれも0件だった
  高たんぱく: 'こうたんぱく',
  高タンパク: 'こうたんぱく',
  冷凍: 'れいとう',
  魚: 'さかな',
  肉: 'にく',
  野菜: 'やさい',
  減塩: 'げんえん',
  低糖質: 'ていとうしつ',
}
const tagReadingKeys = Object.keys(TAG_READINGS).sort((a, b) => b.length - a.length)
const tagReadingPattern =
  tagReadingKeys.length > 0 ? new RegExp(tagReadingKeys.map(escapeRegExp).join('|'), 'g') : null

/**
 * タグの絞り込み用のキー。toHiragana（食材名辞書つき）に加えてタグ語の読みも当てる。
 * 例: 「夏」→「なつ」／「作り置き」→「つくりおき」。読みが引けない語はそのまま返す。
 */
export function toTagKey(input: string): string {
  const base = toHiragana(input)
  if (!tagReadingPattern) return base
  return base.replace(tagReadingPattern, (matched) => TAG_READINGS[matched])
}

// 料理名の読み（2026-07-29 便CI/C12）。辞書は logic/titleReadings.ts、
// 引き当ての手順だけをここに置く（読み仮名の変換はこのモジュールに集約する）
const dishWordKeys = Object.keys(DISH_WORD_READINGS).sort((a, b) => b.length - a.length)
const dishWordPattern =
  dishWordKeys.length > 0 ? new RegExp(dishWordKeys.map(escapeRegExp).join('|'), 'g') : null

/**
 * 料理名の読み（並び替え「五十音順」の比較キー）。
 * ①同梱の基本レシピは料理名まるごとの読み（TITLE_READINGS）を使う
 * ②それ以外は食材名辞書（toHiragana）＋料理名によく出る語（DISH_WORD_READINGS）で寄せる。
 * どちらも引けない語はそのまま残る（従来と同じで、悪化はしない）。
 */
export function titleKanaKey(title: string): string {
  const trimmed = title.trim()
  const exact = TITLE_READINGS[trimmed]
  if (exact) return exact
  const base = toHiragana(trimmed)
  if (!dishWordPattern) return base
  return base.replace(dishWordPattern, (matched) => DISH_WORD_READINGS[matched])
}

/**
 * 料理名・材料名・タグ・検索キーワードから検索用キーワード一覧を作る（保存時に呼ぶ）。
 *
 * 調味料的な材料（大さじ/小さじ/単位なし/「少々」等。isSeasoningLikeと同じ基準）は
 * 検索語に含めない。「鮭（さけ）」で検索すると調味料の「酒（さけ）」を使うレシピが
 * 大量にヒットする誤爆の対策（2026-07-09 ペルソナテスト第1波）。
 * タイトル・タグ・主材料での検索はこれまで通り。
 *
 * keywords（Recipe.keywords、任意）は一覧・詳細には表示しない検索専用の語（別名・
 * 表記ゆれ・気分語など）。第4引数は省略可能なので既存の呼び出し元（keywordsを持たない
 * データ）は変更なしで動く。
 *
 * 2026-07-29 便CI/C09・C21: 読み（toTagKey／titleKanaKey）の形も一緒に入れる。
 * 実機QAで「和食66件／わしょく0件」「作り置き44件／つくりおき0件」のように、
 * タグは漢字でしか引けなかった（読み辞書はタグ候補の入力補助にしか配線されていなかった）。
 * 置き換えではなく**足す**のがポイントで、こうすると漢字表記での検索（「和食」「鍋」）も
 * そのまま効き続ける＝既存の検索結果を1件も減らさずに、かなでも引けるようになる。
 */
export function buildSearchWords(
  title: string,
  ingredients: ReadonlyArray<{ name: string; amount: string; unit: string }>,
  tags: readonly string[],
  keywords?: readonly string[],
): string[] {
  const words = new Set<string>()
  const mainNames = ingredients.filter((ing) => !isSeasoningLike(ing)).map((ing) => ing.name)
  for (const raw of [title, ...mainNames, ...tags, ...(keywords ?? [])]) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    words.add(toHiragana(trimmed))
    words.add(toTagKey(trimmed))
  }
  // 料理名は読み（「肉じゃが→にくじゃが」「豚汁→とんじる」）でも引けるようにする
  if (title.trim()) words.add(titleKanaKey(title))
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
export const SEARCH_INDEX_VERSION = 2 // v2: タグ・料理名の読みも検索語に入れる(2026-07-29 便CI/C09・C12)

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
