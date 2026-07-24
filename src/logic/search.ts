import { toHiragana } from './kana'
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

/** 入力文字列を検索語の配列に分ける（空白・カンマ・読点区切り→ひらがな化） */
export function splitTerms(input: string): string[] {
  return splitValues(input).map(toHiragana)
}

function matchesQuery(recipe: Recipe, terms: string[]): boolean {
  if (terms.length === 0) return true
  const pool = [...recipe.searchWords, toHiragana(recipe.title)]
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
      const pantryKeys = (options.pantryNames ?? []).map(toHiragana)
      const ingredientNames = recipe.ingredients.map((i) => toHiragana(i.name))
      const usesPantry = pantryKeys.some((key) => ingredientNames.some((n) => n.includes(key)))
      if (!usesPantry) continue
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
