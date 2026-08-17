import { recipeDishType } from './mealPlan'
import { preferSeasonWithFallback } from './season'
import type { DishType, Recipe, Season } from '../db/types'

/**
 * 「今日なに作る？」で選べる料理の種別（2026-08-03 便DH。2026-08-17 便HGで献立の「日」へ移設）。
 * レシピ登録の「料理の種別」と同じ4区分・同じ並び。recipeDishType は必ずこの4つの
 * どれか1つを返すので、4区分は互いに重ならず、合わせると全レシピを覆う。
 */
export const DISH_TYPE_OPTIONS: DishType[] = ['main', 'side', 'soup', 'dessert']

/**
 * 「今日なに作る？」の候補を決める（2026-08-04 便DV-1）。
 *
 * 直したバグ（オーナー実機報告「主菜〜その他の全ボタンを選択すると候補が減る」）:
 * 旧実装は「種別で絞る → その結果に季節の優先（preferSeasonWithFallback）をかける」順だった。
 * preferSeasonWithFallback は「今の季節ぴったりの品が SEASON_MIN_CANDIDATES(10) 以上あれば
 * その季節の品だけに絞り、足りなければ通年の品まで広げる」ため、**入れる集合が大きいほど
 * 出てくる集合が小さくなる**逆転が起きる。同梱レシピの夏は主菜5・副菜4・その他1のちょうど10品で、
 *   ・主菜だけ選択      → 主菜59品中の夏は5品（10未満）→ 通年まで広げて候補55品
 *   ・4区分すべて選択   → 109品中の夏は10品（10以上）→ 夏の10品だけに絞られる
 * となり、種別を増やすほど候補が減っていた（未選択＝絞らないも同じ10品）。
 *
 * 直し方: 季節の優先を**選ばれた種別ごとに別々にかけて、その結果を合わせる**。
 * 種別は互いに重ならないので、選ぶ種別を増やせば候補は必ず増える（減ることはない）。
 * 未選択は「4区分すべて選択」と同じものとして扱う＝絞らないときと全選択が必ず一致する。
 *
 * 並びは DISH_TYPE_OPTIONS の順で固定する（チップを押した順に候補の並びが変わって、
 * 同じ抽選値でも別の料理が出る、といったブレを作らないため）。
 *
 * 0件回避（従来どおり）: 選んだ種別に合う品が1つも無いときだけ、種別で絞らずに全体から選ぶ。
 * 候補0件で「候補がありません」が出るより、種別の希望を一旦外して1品出す方を優先する。
 */
export function suggestionCandidates(
  pool: readonly Recipe[],
  dishTypes: readonly DishType[],
  season: Exclude<Season, 'all'>,
): Recipe[] {
  const byType = new Map<DishType, Recipe[]>()
  for (const recipe of pool) {
    const type = recipeDishType(recipe)
    const list = byType.get(type)
    if (list) list.push(recipe)
    else byType.set(type, [recipe])
  }
  const selected = dishTypes.length > 0 ? dishTypes : DISH_TYPE_OPTIONS
  const picked: Recipe[] = []
  for (const type of DISH_TYPE_OPTIONS) {
    if (!selected.includes(type)) continue
    picked.push(...preferSeasonWithFallback(byType.get(type) ?? [], season))
  }
  return picked.length > 0 ? picked : preferSeasonWithFallback([...pool], season)
}
