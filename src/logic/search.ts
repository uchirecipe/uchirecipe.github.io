import {
  applianceSearchWords,
  categorySearchWords,
  dishTypeSearchWord,
  titleKanaKey,
  toHiragana,
  toTagKey,
} from './kana'
import { isSeasoningLike } from './mainIngredients'
import { ja } from '../i18n/ja'
import { makePantryMatcher } from './pantry'
import { hasNgIngredient } from './ng'
import { splitValues } from './textSplit'
import { recipeDishType } from './mealPlan'
import type { DishType, EffortLevel, Recipe } from '../db/types'

/** 調理時間の絞り込み: すべて / 〜10分 / 〜30分 / 30分超 */
export type TimeFilter = 'all' | 'under10' | 'under30' | 'over30'
export type EffortFilter = 'all' | EffortLevel
/** タグ絞り込み: 'all' またはタグ文字列そのもの（例: '作り置き'） */
export type TagFilter = 'all' | string
/**
 * タグを2つ以上選んだときの選び方（2026-08-19 便HZ・③ オーナー
 * 「タグ検索は、複数選択できるよにして。AND検索OR検索の切り替え機能も欲しい」）。
 *
 * 'any' = 選んだタグの**どれかが付いている**レシピ（和集合。オーナーの言う OR検索）
 * 'all' = 選んだタグが**すべて付いている**レシピ（積集合。オーナーの言う AND検索）
 *
 * 1つしか選んでいないときは、どちらでも結果は同じ（＝これまでの絞り込みと変わらない）。
 */
export type TagMatchMode = 'any' | 'all'
/**
 * 料理の種別（主菜・副菜・汁物・その他）の絞り込み（2026-08-10 便FF・オーナー要望
 * 「主菜副菜などでも絞り込みしたい」）。
 *
 * 主菜/副菜は**タグではなくレシピの項目**（Recipe.dishType。レシピ登録の「料理の種別」）で、
 * 未設定のレシピは料理名・材料からの推定に倒す。判定は献立の自動提案・
 * 「今日なに作る？」と同じ logic/mealPlan.ts recipeDishType に一本化する
 * ＝同じ料理が画面によって主菜だったり副菜だったりしないようにするため。
 *
 * 2026-08-19 便HU（オーナー「料理の種別については複数選択できても良いと思う」）:
 * 1つだけ選ぶ形（'all' か1区分）から**複数選べる形**（選んだ区分の和集合）に変えた。
 * 何も選んでいない状態＝絞らない、なので 'all' に当たる値は持たない。
 */
export type DishTypeFilter = DishType

export interface SearchOptions {
  /** 料理名・材料名・タグのテキスト検索 */
  query: string
  /** 使いたい食材（空白・読点区切りで複数） */
  ingredients: string
  time: TimeFilter
  effort: EffortFilter
  /**
   * タグを1つだけ指定して絞る（献立のレシピ選択ピッカー・献立テンプレートが使う旧来の口）。
   * 'all' または未指定＝この条件では絞らない。レシピ一覧は下の tags / tagMatch を使う
   */
  tag?: TagFilter
  /**
   * タグで絞る（2026-08-19 便HZ・③で複数選択に）。空配列・未指定＝絞らない。
   * 2つ以上入れたときの扱いは tagMatch で決める（既定は 'any' ＝どれかが付いていれば残す）。
   * 任意項目にしてあるので、この絞り込みを使わない呼び出し側は据え置きでよい
   */
  tags?: readonly string[]
  /**
   * 自分で登録した言葉のタグで絞る（2026-08-19 便IB・② オーナー実機フィードバック
   * 「やりたいことは『好きなキーワードをよく使うタグとして絞り込みに登録したい』」）。
   *
   * 中身は**検索の言葉**で、レシピには何も書き込まれていない（A案）。それでも利用者から見れば
   * tags と同じ「絞り込みに使うタグ」なので、**同じ入れ物・同じ選び方（tagMatch）に乗せる**。
   * 判定はテキスト検索（query と同じ matchesQuery）＝登録した言葉をそのまま検索欄に打ったときと
   * 同じ品が出る。空配列・未指定＝絞らない
   */
  keywords?: readonly string[]
  /** tags と keywords を合わせて2つ以上指定したときの選び方（既定 'any'） */
  tagMatch?: TagMatchMode
  /**
   * 料理の種別で絞る（任意・2026-08-10 便FF → 2026-08-19 便HUで複数選択に）。
   * 未指定・空配列＝絞らない。複数入れたときは**そのどれかに当たる**レシピが残る（和集合）。
   * 任意項目にしてあるので、この絞り込みを使わない呼び出し側（献立のレシピ選択ピッカー等）は据え置きでよい
   */
  dishTypes?: readonly DishTypeFilter[]
  favoriteOnly: boolean
  /** NG食材を含むレシピを結果から隠す */
  excludeNg: boolean
  /** 時短版の手順(quickSteps)があるレシピだけに絞る */
  quickOnly: boolean
  ngIngredients: string[]
  /**
   * 在庫（ある/少ない）の食材を材料に1つ以上含むレシピだけに絞る（2026-07-24 便BN・司令部追加）。
   * 判定は並び替え「在庫との一致順」と同じ部分一致で行う。pantryNamesに在庫の食材名を渡すこと。
   * 任意項目（未指定=絞り込みしない）なので、この絞り込みを使わない呼び出し側は据え置きでよい
   */
  pantryOnly?: boolean
  /** pantryOnly用の在庫（ある/少ない）の食材名リスト（未指定なら空扱い） */
  pantryNames?: string[]
}

export const defaultSearchOptions: Omit<SearchOptions, 'ngIngredients'> = {
  query: '',
  ingredients: '',
  time: 'all',
  effort: 'all',
  tag: 'all',
  tags: [],
  keywords: [],
  tagMatch: 'any',
  dishTypes: [],
  favoriteOnly: false,
  excludeNg: false,
  quickOnly: false,
}

export interface SearchResult {
  recipe: Recipe
  /** 「使いたい食材」のうちこのレシピで使える数 */
  usedCount: number
  /** 「使いたい食材」の合計数（0なら食材検索していない） */
  wantedCount: number
}

const tagCollator = new Intl.Collator('ja')

/** タグ1つと、そのタグが付いているレシピの件数 */
export interface TagUsage {
  tag: string
  /** そのタグが付いているレシピの件数 */
  count: number
}

/**
 * タグ絞り込みチップの候補と件数（2026-08-03 オーナー指示 → 2026-08-10 便FFで件数も返す）。
 *
 * 数える対象は**渡されたレシピ集合そのもの**＝いま一覧に出ているレシピ。
 * 「基本レシピを表示しない」をONにしていれば自分で登録したレシピだけが数えられ、
 * OFFなら同梱の基本レシピも含めて数える（＝画面に出ている一覧と件数が必ず一致する）。
 *
 * 並びは「そのタグが付いているレシピの多い順」。同数のときはタグ名の五十音順にして、
 * 開くたびに並びが入れ替わらないようにする。
 * タグは自由入力なので、絞り込み側の判定（recipe.tags.includes）と食い違わないよう
 * 表記をまとめず、保存されている文字列そのままで数える（trimもしない。チップの文字列が
 * 保存値と1文字でも違うと、押しても何も絞り込めないチップになる）。
 * 中身が空白だけのタグは数えない。同じレシピ内の重複タグは1件と数える。
 */
export function tagUsageCounts(recipes: { tags: string[] }[], limit: number): TagUsage[] {
  if (limit <= 0) return []
  const counts = new Map<string, number>()
  for (const recipe of recipes) {
    const seen = new Set<string>()
    for (const tag of recipe.tags) {
      if (tag.trim() === '' || seen.has(tag)) continue
      seen.add(tag)
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || tagCollator.compare(a[0], b[0]))
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }))
}

/**
 * レシピ一覧の絞り込みのタグ候補に出さないタグ（2026-08-19 便HU・⑮ オーナー指示
 * 「『高たんぱく』のタグは絞り込み欄から削除」）。
 *
 * **レシピに付いているタグそのものは消さない**（同梱の基本レシピ15品に付いている。
 * データを失う方には倒さない）。候補のチップに出さないだけなので、
 * タグを指定した絞り込み自体（searchRecipes の tag）は今までどおり効く。
 */
export const FILTER_HIDDEN_TAGS: readonly string[] = ['高たんぱく']

/**
 * 絞り込みパネルに出すタグ候補（2026-08-19 便HU・⑮）。
 * 出さないタグを**先に**取り除いてから上位 limit 件を取る
 * ＝隠したぶんだけ候補の枠が減る、ということが起きない。
 */
export function filterTagUsageCounts(recipes: { tags: string[] }[], limit: number): TagUsage[] {
  const hidden = new Set(FILTER_HIDDEN_TAGS)
  const visible = recipes.map((recipe) => ({ tags: recipe.tags.filter((tag) => !hidden.has(tag)) }))
  return tagUsageCounts(visible, limit)
}

/**
 * 自分で登録したタグ（＝検索の言葉）に、いま何品が当たるかを数える（2026-08-19 便IB・②）。
 *
 * もとからあるタグのチップは「そのタグが付いている品数」を出しているのに、登録したタグだけ
 * 数字が無く、説明文（「タグが付いているレシピの品数です」）も片方にしか効かなかった
 * （オーナー指摘）。同じ形の数字を出すために、**絞り込みと同じ searchRecipes で数える**
 * ＝画面に出す数字と、そのタグを押したときに実際に出る品数が食い違わない。
 *
 * 数える対象は渡されたレシピ集合そのもの（＝いま一覧に出ているレシピ）で、
 * もとからあるタグの数え方（tagUsageCounts）とそろえる。
 */
export function countRecipesMatchingKeyword(recipes: Recipe[], keyword: string): number {
  return searchRecipes(recipes, {
    ...defaultSearchOptions,
    ngIngredients: [],
    keywords: [keyword],
  }).length
}

/** 件数を捨ててタグ名だけを返す版（献立のレシピ選択ピッカーが使う） */
export function topTagsByUsage(recipes: { tags: string[] }[], limit: number): string[] {
  return tagUsageCounts(recipes, limit).map((t) => t.tag)
}

/** 入力文字列を検索語の配列に分ける（空白・カンマ・読点区切り→ひらがな化） */
export function splitTerms(input: string): string[] {
  return splitValues(input).map(toHiragana)
}

function matchesQuery(recipe: Recipe, terms: string[]): boolean {
  if (terms.length === 0) return true
  const pool = [...recipe.searchWords, toHiragana(recipe.title)]
  // 「作った記録」のひとことメモも検索対象にする(2026-07-29 便CI/C16)。
  // メモは「子どもが完食」「しょうゆ少なめで◎」のように、そのレシピを思い出す手がかりに
  // なっているのに引けなかった。searchWordsに入れるとレシピ保存時にしか作り直されず、
  // 記録を足した瞬間に検索できない=索引が古くなるため、ここで直接読む
  for (const log of recipe.cookedLogs) {
    if (log.note) pool.push(toHiragana(log.note))
  }
  return terms.every((term) => pool.some((word) => word.includes(term)))
}

/**
 * 検索の言葉が、そのレシピの**どこに当たったか**（2026-08-20 便IH・②）。
 *
 * オーナー原文:
 *   「キーワード検索はどこからワードを拾ってきますか？『魚』と入れたところ６件ありましたが、
 *     レシピのタグやキーワードに入っているわけではなさそうでした。」
 *   （見せ方の訂正）「各レシピカードに表示ではなく、検索バーの下に、一致した言葉を
 *     多い順に羅列するイメージでした」
 *
 * 検索の索引（logic/kana.ts の buildSearchWords）は、料理名・材料名・タグ・検索キーワード・
 * 手順に出てくる調理器具・料理の種別・材料のカテゴリ語を**ひらがなの語の集まりに均して**持つ。
 * 均した時点で「どこから来た語か」は消えるので、一致した場所はここで**同じ規則をもう一度たどって**出す。
 * 索引の作り方（kana.ts）とこの関数の見る先がずれると説明が嘘になるため、
 * 語の作り方（toHiragana / toTagKey / applianceSearchWords / categorySearchWords /
 * dishTypeSearchWord）は**索引と同じ口**から読む。
 */
export type SearchMatchField =
  | 'title'
  | 'tag'
  | 'ingredient'
  | 'keyword'
  | 'appliance'
  | 'dishType'
  | 'cookedNote'

export interface SearchMatchReason {
  field: SearchMatchField
  /**
   * 当たった言葉（レシピに書いてある形のまま）。**料理名と作った記録のひとことメモは持たない**
   * ——どちらも品ごとに違う文なので、言葉として並べると1品ずつばらばらに並んで一覧が埋まる
   */
  word?: string
}

/**
 * 並べる順。品数が同じときだけ効く（並びの第一は品数の多い順＝オーナー指定）。
 * 料理名を先に置くのは、いちばん当たり前の一致だから（読み飛ばせる位置に固定する）。
 */
const MATCH_FIELD_ORDER: readonly SearchMatchField[] = [
  'title',
  'tag',
  'ingredient',
  'keyword',
  'appliance',
  'dishType',
  'cookedNote',
]

/** 索引に入る2つの形（ひらがな化・タグの読み）のどちらかに検索語が含まれるか */
function wordHits(source: string, term: string): boolean {
  const trimmed = source.trim()
  if (trimmed === '') return false
  return toHiragana(trimmed).includes(term) || toTagKey(trimmed).includes(term)
}

/** その語が料理名（読み仮名を含む）に当たっているか */
function titleHits(recipe: Recipe, term: string): boolean {
  return wordHits(recipe.title, term) || titleKanaKey(recipe.title).includes(term)
}

/**
 * そのレシピが検索の言葉に一致した理由を、場所ごとに返す。
 * terms は splitTerms を通したあと（＝ひらがな化済み）の語を渡すこと。
 *
 * 料理名に一致した語は、**一致した場所を料理名だけにする**（他の欄は見ない）。
 * 「豆腐」で麻婆豆腐が出たときに「料理名」と「材料: 木綿豆腐」の両方で数えると、
 * 同じ1品が2か所で数えられて、一覧の数字が読みにくくなるため。
 */
export function searchMatchReasons(recipe: Recipe, terms: readonly string[]): SearchMatchReason[] {
  if (terms.length === 0) return []
  const found: SearchMatchReason[] = []
  const seen = new Set<string>()
  const add = (field: SearchMatchField, word?: string) => {
    const key = `${field} ${word ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    found.push(word === undefined ? { field } : { field, word })
  }
  for (const term of terms) {
    if (term === '') continue
    if (titleHits(recipe, term)) {
      add('title')
      continue
    }
    for (const tag of recipe.tags) if (wordHits(tag, term)) add('tag', tag.trim())
    for (const ing of recipe.ingredients) {
      // 索引に入っているのは調味料以外の材料名だけ（buildSearchWords と同じ線引き）
      if (!isSeasoningLike(ing) && wordHits(ing.name, term)) add('ingredient', ing.name.trim())
      // カテゴリ語（しめじ→きのこ）で当たったときは、その元になった材料名を出す
      // ＝「きのこ」で探した人が、どの材料でこの品が出たのかを読める
      else if (categorySearchWords(ing.name).some((word) => word.includes(term)))
        add('ingredient', ing.name.trim())
    }
    for (const keyword of recipe.keywords ?? [])
      if (wordHits(keyword, term)) add('keyword', keyword.trim())
    // 器具の一覧は「魚焼きグリル」と「グリル」、「オーブントースター」と「オーブン」のように
    // 長い名前と短い名前が両方入る（手順に長い方が書いてあれば短い方も当たる）。
    // 当たったものが他の当たったものの一部でしかないときは出さない＝手順に書いてある形だけが残る
    const appliances = applianceSearchWords(recipe.steps).filter((word) => wordHits(word, term))
    for (const appliance of appliances)
      if (!appliances.some((other) => other !== appliance && other.includes(appliance)))
        add('appliance', appliance)
    const dishWord = dishTypeSearchWord(recipeDishType(recipe))
    if (wordHits(dishWord, term)) add('dishType', dishWord)
    for (const log of recipe.cookedLogs)
      if (log.note && toHiragana(log.note).includes(term)) add('cookedNote')
  }
  return found.sort(
    (a, b) => MATCH_FIELD_ORDER.indexOf(a.field) - MATCH_FIELD_ORDER.indexOf(b.field),
  )
}

/** 一致した場所1つと、そこで一致した品数 */
export interface SearchMatchSummaryRow {
  field: SearchMatchField
  /** 当たった言葉（料理名・作った記録のメモは持たない） */
  word?: string
  /** その場所で一致したレシピの品数 */
  count: number
}

export interface SearchMatchSummary {
  /** 品数の多い順に並べた、一致した場所（上限まで） */
  rows: SearchMatchSummaryRow[]
  /** 上限に収まらなかった場所の件数（0なら全部出ている） */
  hiddenCount: number
  /** 一致した場所の総数（上限で切る前）。入口の判定に使う */
  total: number
}

/**
 * 検索まどの下に出す「当たった言葉の一覧」（2026-08-20 便IH・②。オーナー訂正
 * 「各レシピカードに表示ではなく、検索バーの下に、一致した言葉を多い順に羅列するイメージ」）。
 *
 * 数える相手は**いま一覧に出ている品そのもの**（呼び出し側が searchRecipes の結果を渡す）
 * ＝画面の数字と、実際に並んでいる品数が食い違わない。
 *
 * 並びは**品数の多い順**（オーナー指定）。同じ品数のときは場所の順（MATCH_FIELD_ORDER）→
 * 言葉の五十音順にして、打ち直すたびに並びが入れ替わらないようにする。
 *
 * 2語以上打ったとき（「豆腐 レンジ」）は、1品が2つの場所で一致することがある
 * ＝**数字の合計は出ている品数と一致しない**。合計を出さないのはそのため。
 *
 * @param limit 並べる場所の上限。超えた分は hiddenCount で数を返す（黙って切らない）
 */
export function searchMatchSummary(
  recipes: readonly Recipe[],
  terms: readonly string[],
  limit: number,
): SearchMatchSummary {
  if (terms.length === 0) return { rows: [], hiddenCount: 0, total: 0 }
  const counts = new Map<string, SearchMatchSummaryRow>()
  for (const recipe of recipes) {
    for (const reason of searchMatchReasons(recipe, terms)) {
      const key = `${reason.field} ${reason.word ?? ''}`
      const row = counts.get(key)
      if (row) row.count += 1
      else counts.set(key, { ...reason, count: 1 })
    }
  }
  const sorted = [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      MATCH_FIELD_ORDER.indexOf(a.field) - MATCH_FIELD_ORDER.indexOf(b.field) ||
      tagCollator.compare(a.word ?? '', b.word ?? ''),
  )
  const kept = limit > 0 ? sorted.slice(0, limit) : []
  return {
    rows: kept,
    hiddenCount: sorted.length - kept.length,
    total: sorted.length,
  }
}

/** 一致した場所の名前（ja に集約。ここで文字を書かない） */
const MATCH_FIELD_LABELS: Record<SearchMatchField, string> = {
  title: ja.search.matchFieldTitle,
  tag: ja.search.matchFieldTag,
  ingredient: ja.search.matchFieldIngredient,
  keyword: ja.search.matchFieldKeyword,
  appliance: ja.search.matchFieldAppliance,
  dishType: ja.search.matchFieldDishType,
  cookedNote: ja.search.matchFieldCookedNote,
}

/**
 * 一覧に並べる1つぶんの文字（例:「タグ: 魚 4品」「料理名 8品」）。
 * 言葉を持たない場所（料理名・作った記録のメモ）は、場所の名前と品数だけにする。
 */
export function searchMatchRowText(row: SearchMatchSummaryRow): string {
  const label = MATCH_FIELD_LABELS[row.field]
  const count = String(row.count)
  return row.word === undefined
    ? ja.search.matchRowWithoutWord.replace('{field}', label).replace('{n}', count)
    : ja.search.matchRow
        .replace('{field}', label)
        .replace('{word}', row.word)
        .replace('{n}', count)
}

function matchesTime(recipe: Recipe, time: TimeFilter): boolean {
  if (time === 'all') return true
  const minutes = recipe.cookMinutes
  if (minutes == null || minutes <= 0) return false
  if (time === 'under10') return minutes <= 10
  if (time === 'under30') return minutes <= 30
  return minutes > 30
}

/**
 * レシピの絞り込みと並べ替え。
 * 「使いたい食材」が入力されている場合は、全部使えるレシピを先頭に、
 * 一部だけ使えるレシピは「足りない食材が少ない順」に並べる。
 */
export function searchRecipes(recipes: Recipe[], options: SearchOptions): SearchResult[] {
  const queryTerms = splitTerms(options.query)
  const wantedTerms = splitTerms(options.ingredients)
  // 在庫との照合器は1回だけ作る(2026-07-29 便CC/C4)
  const matchesPantry = makePantryMatcher(options.pantryOnly ? (options.pantryNames ?? []) : [])
  // タグの絞り込みの判定器（2026-08-19 便IB・②）。もとからあるタグは「付いているか」、
  // 登録したタグは「その言葉で検索して当たるか」で、判定の中身は違うが同じ並びに入れる。
  // 言葉の分解（splitTerms）はレシピごとにやると重いので、ここで1回だけ済ませる
  const tagChecks: ((recipe: Recipe) => boolean)[] = [
    ...(options.tags ?? []).map((name) => (recipe: Recipe) => recipe.tags.includes(name)),
    ...(options.keywords ?? []).map((word) => {
      const terms = splitTerms(word)
      return (recipe: Recipe) => matchesQuery(recipe, terms)
    }),
  ]

  const results: SearchResult[] = []
  for (const recipe of recipes) {
    if (!matchesQuery(recipe, queryTerms)) continue
    if (!matchesTime(recipe, options.time)) continue
    if (options.effort !== 'all' && recipe.effortLevel !== options.effort) continue
    if (options.tag != null && options.tag !== 'all' && !recipe.tags.includes(options.tag)) continue
    // タグの複数選択（2026-08-19 便HZ・③ → 便IB・②で「自分で登録したタグ」も同じ入れ物に）。
    // 何も選んでいなければ絞らない。
    // 'all'（すべて当てはまる）は選んだタグの数だけ条件が増えるので、選ぶほど必ず減る。
    // 'any'（どれかが当てはまる）は選ぶほど必ず増える＝同じ選び方をしている
    // 「料理の種別」（上の dishTypes）と同じ和集合になる。
    // もとからあるタグ（レシピに付いている印）と登録したタグ（検索の言葉）は判定の中身が違うが、
    // **同じ選び方に乗せる**ので、利用者はどちらのタグかを意識せずに選べる
    if (tagChecks.length > 0) {
      const matched =
        options.tagMatch === 'all'
          ? tagChecks.every((matches) => matches(recipe))
          : tagChecks.some((matches) => matches(recipe))
      if (!matched) continue
    }
    // 料理の種別（2026-08-10 便FF → 2026-08-19 便HUで複数選択）。未設定のレシピも
    // recipeDishType が必ず4区分のどれかに割り当てるので、4つを合わせると一覧の全レシピを
    // ちょうど覆う（取りこぼしが出ない）。何も選んでいなければ絞らない
    if (options.dishTypes != null && options.dishTypes.length > 0) {
      if (!options.dishTypes.includes(recipeDishType(recipe))) continue
    }
    if (options.favoriteOnly && !recipe.isFavorite) continue
    if (options.excludeNg && hasNgIngredient(recipe, options.ngIngredients)) continue
    if (options.quickOnly && (recipe.quickSteps?.length ?? 0) === 0) continue
    if (options.pantryOnly) {
      // 在庫との照合は logic/pantry.ts の判定器に一本化する(2026-07-29 便CC/C4)。
      // 旧: かな化した材料名が在庫名を含む部分一致で、在庫「卵」が材料「砂糖（卵用）」に
      // 当たる一方、在庫「豚肉」は「豚こま切れ肉」に当たらない、という食い違いがあった
      if (!recipe.ingredients.some((i) => matchesPantry(i.name))) continue
    }

    let usedCount = 0
    if (wantedTerms.length > 0) {
      const names = recipe.ingredients.map((i) => toHiragana(i.name))
      usedCount = wantedTerms.filter((term) =>
        names.some((name) => name.includes(term)),
      ).length
      if (usedCount === 0) continue // 1つも使えないレシピは出さない
    }

    results.push({ recipe, usedCount, wantedCount: wantedTerms.length })
  }

  if (wantedTerms.length > 0) {
    // 使える食材が多い（=足りない食材が少ない）順 → 新しい順
    results.sort(
      (a, b) => b.usedCount - a.usedCount || b.recipe.updatedAt - a.recipe.updatedAt,
    )
  }
  return results
}
