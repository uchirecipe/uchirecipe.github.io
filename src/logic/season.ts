import type { Recipe, Season } from '../db/types'

/** 現在の月から季節を判定する（3〜5月=春, 6〜8月=夏, 9〜11月=秋, 12〜2月=冬） */
export function currentSeason(date: Date = new Date()): Exclude<Season, 'all'> {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

/**
 * 候補の中から今の季節を優先する。
 * 今の季節にぴったりのレシピがあればそれだけに絞り、無ければ
 * 季節指定なし（通年・未設定）まで含めて絞る。他の季節のレシピは
 * それらが1つも無いときだけ仕方なく含める（0件にはしない）。
 */
export function preferSeason(recipes: Recipe[], season: Exclude<Season, 'all'>): Recipe[] {
  if (recipes.length === 0) return recipes
  const exact = recipes.filter((r) => r.season === season)
  if (exact.length > 0) return exact
  const neutral = recipes.filter((r) => r.season == null || r.season === 'all')
  if (neutral.length > 0) return neutral
  return recipes
}

/**
 * 季節候補が少なすぎるときに自動で候補を広げる版（2026-07-29 便CD/MP-12）。
 *
 * preferSeason は「その季節ぴったりの品が1つでもあれば、その品だけ」に絞る。同梱レシピの
 * 夏タグは5品しかないため、献立の「今日なに作る?」は何度振り直しても同じ5品の中でしか
 * 回らず、同じ料理が連発していた（PDCA2周目・P3/P4/P5が独立に指摘）。献立エンジン側
 * （suggestForSlot）は「季節外を除くだけ＝通年の品も候補に残す」ので、扱いも非対称だった。
 *
 * そこで「季節ぴったりの品が minCount 未満なら、通年・季節指定なしの品も混ぜる」ことで
 * 自動的に候補を広げる。季節の品が十分あるときは従来どおり季節優先のまま＝設定は増やさない。
 */
export const SEASON_MIN_CANDIDATES = 10

export function preferSeasonWithFallback(
  recipes: Recipe[],
  season: Exclude<Season, 'all'>,
  minCount: number = SEASON_MIN_CANDIDATES,
): Recipe[] {
  if (recipes.length === 0) return recipes
  const exact = recipes.filter((r) => r.season === season)
  if (exact.length >= minCount) return exact
  const neutral = recipes.filter((r) => r.season == null || r.season === 'all')
  const widened = [...exact, ...neutral]
  return widened.length > 0 ? widened : recipes
}
