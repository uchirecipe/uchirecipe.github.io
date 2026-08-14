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
 *   - 「開きが大きい」の線も N1 と同じ＝**全体の目安の30%を超えたら**大きいとみなす。
 *
 * **開きの範囲だけは 2026-08-14 便GK で画面側の判断に切り替えた**（下の `finishSpread` を参照）。
 * 段取りを測る N1 は今までどおり冷たい品を外して数える（`scripts/audit-cook-navi.mjs`）。
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
 * 完成の開き（分）＝**全部の品**の最大−最小。対象が1品以下なら0。
 * どの品どうしの開きなのかも返す（画面では品名で書く＝どの2品の話か読んで分かるようにするため）。
 *
 * **2026-08-14 便GK で「冷たい品を外す」をやめた**（実操作テスト3回目）。原文:
 *   「ごま和えを17分後に和えて、鶏ができるのは34分後。17分放置。なのにアプリが警告するのは
 *     『みそ汁ができてから鶏ができるまで約4分あきます』だけ。4分は言うのに17分は何も言わない。
 *     判定基準がわからない」
 *
 * 冷たい品を先に仕上げるのは 2026-08-08 便EG のオーナー指示どおりの**正しい動き**なので、
 * 段取りを測る側（docs/72 N1）は今までどおり冷たい品を外して数える——ここは1文字も変えていない。
 * 変えたのは**画面の出し方**。利用者は画面に並んだ完成時刻を見て開きを自分で数えるので、
 * いちばん大きい開きを黙って飛ばすと「基準が分からない」としか読めない。
 * 開きは全部の品で出したうえで、**先にできる品が冷たい品なら理由を書く**（`first.cold`）＝
 * 同じ数字に対して「放置になる」と「先に仕上げる並びにしている」を書き分ける。
 */
export function finishSpread(finishes: readonly RecipeFinish[]): {
  minutes: number
  first?: RecipeFinish
  last?: RecipeFinish
} {
  if (finishes.length < 2) return { minutes: 0 }
  let first = finishes[0]
  let last = finishes[0]
  for (const one of finishes) {
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
