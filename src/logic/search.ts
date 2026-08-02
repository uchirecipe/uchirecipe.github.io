import { toHiragana } from './kana'
import { makePantryMatcher } from './pantry'
import { hasNgIngredient } from './ng'
import { splitValues } from './textSplit'
import type { EffortLevel, Recipe } from '../db/types'

/** 調理時間の絞り込み: すべて / 〜10分 / 〜30分 / 30分超 */
export type TimeFilter = 'all' | 'under10' | 'under30' | 'over30'
export type EffortFilter = 'all' | EffortLevel
/** タグ絞り込み: 'all' またはタグ文字列そのもの（例: '作り置き'） */
export type TagFilter = 'all' | string

export interface SearchOptions {
  /** 料理名・材料名・タグのテキスト検索 */
  query: string
  /** 使いたい食材（空白・読点区切りで複数） */
  ingredients: string
  time: TimeFilter
  effort: EffortFilter
  tag: TagFilter
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

/**
 * 「よく使うタグ」チップの候補（2026-08-03 オーナー指示）。
 * 従来は「作り置き」「お弁当」をコードに直書きした固定2択で、レシピを増やしても
 * 中身が変わらなかった。実際に付いているタグを数え、そのタグが付いたレシピの件数が
 * 多い順に limit 件返す。
 * 同数のときはタグ名の五十音順にして、開くたびに並びが入れ替わらないようにする。
 * タグは自由入力なので、絞り込み側の判定（recipe.tags.includes）と食い違わないよう
 * 表記をまとめず、保存されている文字列そのままで数える（trimもしない。チップの文字列が
 * 保存値と1文字でも違うと、押しても何も絞り込めないチップになる）。
 * 中身が空白だけのタグは数えない。同じレシピ内の重複タグは1件と数える。
 */
export function topTagsByUsage(recipes: { tags: string[] }[], limit: number): string[] {
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
    .map(([tag]) => tag)
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

  const results: SearchResult[] = []
  for (const recipe of recipes) {
    if (!matchesQuery(recipe, queryTerms)) continue
    if (!matchesTime(recipe, options.time)) continue
    if (options.effort !== 'all' && recipe.effortLevel !== options.effort) continue
    if (options.tag !== 'all' && !recipe.tags.includes(options.tag)) continue
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
