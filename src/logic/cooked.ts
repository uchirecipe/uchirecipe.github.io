import type { Recipe } from '../db/types'

/**
 * 直近 days 日以内に「作った」記録があれば true。
 *
 * 2026-07-29 便CI/C08: 以前は cookedLogs[0] の1件だけを見ていたが、addCookedLog が
 * 日付を見ずに先頭へ積んでいたため、過去の日付を後から記録すると先頭＝最新ではなくなり
 * 「今日作ったばかりのレシピが14日以上作っていない扱い」になっていた。
 * 保存側（db/recipes.ts）を日付順に直したうえで、ここも保険として全件の最大日付を見る
 * （すでに順序が崩れて保存済みのデータでも正しく判定できるようにするため）。
 */
export function cookedWithinDays(recipe: Recipe, days: number): boolean {
  const last = recipe.cookedLogs.reduce<string | undefined>(
    (max, log) => (max !== undefined && max >= log.date ? max : log.date),
    undefined,
  )
  if (!last) return false
  const elapsed = Date.now() - new Date(last).getTime()
  return elapsed < days * 24 * 60 * 60 * 1000
}
