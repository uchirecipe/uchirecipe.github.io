/**
 * 品ごとの「できあがりの目安」と、その開き（2026-08-14 便GF・利用者テスト）。
 *
 * 指摘（原文）:
 *   「アプリは合計だけ出して、各品が何分後にできるかは表示しません。開きは最大16分。
 *     みそ汁ができてから主菜が焼き上がるまで12分放置になります。平日の夕食は3品同時に
 *     出したいので、この開きが出ること自体を画面に出してほしい（今は自分で足し算しないと
 *     分からない）」
 *
 * ここは**測り方を変えない**。docs/72 の N1（完成の揃い）を `scripts/audit-cook-navi.mjs` で
 * 測っているので、画面に出す数字も同じ定義でそろえる:
 *   - 品の完成時刻＝段取りの中で**その品の最後の工程が終わる時刻**（`endMin` の最大）。
 *     「半日〜一晩漬ける」のような今回の調理では終わらない待ちは幅0なので伸びない。
 *   - 開き＝**冷たくして出す品を除いた**完成時刻の最大−最小。冷たい品を先に仕上げて
 *     冷やすのはオーナー指示どおりの正しい動き（2026-08-08 便EG）なので、開きの計算から外す。
 *     対象が1品以下なら開きは0。
 *   - 「開きが大きい」の線も N1 と同じ＝**全体の目安の30%を超えたら**大きいとみなす。
 *
 * 段取りの組み方（logic/cookNavi.ts）には手を入れない。ここは組み上がった段取りから
 * 読み取るだけの導出で、監査の数値を動かさない。
 */
import type { Recipe } from '../db/types'
import { recipeServeTemp } from './cookNavi'

/** 品ごとのできあがりの目安 */
export interface RecipeFinish {
  recipeId: number
  /** 調理を始めてから何分後にできあがるか */
  minutes: number
  /** 冷たくして出す品か（開きの計算から外す。上の解説を参照） */
  cold: boolean
}

/** N1 と同じ線＝全体の目安のこの割合を超える開きを「大きい」とみなす */
export const FINISH_SPREAD_WIDE_RATIO = 0.3

/**
 * 段取りから、品ごとのできあがりの目安を読み取る。
 * 並びは `recipes`（段取りが持っている品の並び＝選んだ順＝色の順）のまま。
 * 段取りに工程が1つも無い品は返さない（画面に出す数字が無いため）。
 */
export function recipeFinishTimes(
  items: readonly { recipeId: number; endMin: number }[],
  recipes: readonly { id: number }[],
  recipeById: (id: number) => Pick<Recipe, 'title' | 'steps' | 'dishType'> | undefined,
): RecipeFinish[] {
  const lastEnd = new Map<number, number>()
  for (const item of items) {
    const current = lastEnd.get(item.recipeId)
    if (current === undefined || item.endMin > current) lastEnd.set(item.recipeId, item.endMin)
  }
  const finishes: RecipeFinish[] = []
  for (const recipe of recipes) {
    const minutes = lastEnd.get(recipe.id)
    if (minutes === undefined) continue
    const source = recipeById(recipe.id)
    finishes.push({
      recipeId: recipe.id,
      minutes,
      cold: source ? recipeServeTemp(source) === 'cold' : false,
    })
  }
  return finishes
}

/**
 * 完成の開き（分）。冷たい品を除いた最大−最小で、対象が1品以下なら0（docs/72 N1 と同じ）。
 * どの品どうしの開きなのかも返す（画面では品名で書く＝どの2品の話か読んで分かるようにするため）。
 */
export function finishSpread(finishes: readonly RecipeFinish[]): {
  minutes: number
  first?: RecipeFinish
  last?: RecipeFinish
} {
  const warm = finishes.filter((f) => !f.cold)
  if (warm.length < 2) return { minutes: 0 }
  let first = warm[0]
  let last = warm[0]
  for (const one of warm) {
    if (one.minutes < first.minutes) first = one
    if (one.minutes > last.minutes) last = one
  }
  return { minutes: last.minutes - first.minutes, first, last }
}

/** その開きを「大きい」と見るか（docs/72 N1 の線＝全体の目安の30%超） */
export function isFinishSpreadWide(spreadMinutes: number, totalMinutes: number): boolean {
  if (totalMinutes <= 0) return false
  return spreadMinutes > totalMinutes * FINISH_SPREAD_WIDE_RATIO
}
