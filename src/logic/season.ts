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
