import type { Recipe } from '../db/types'
import { cookedWithinDays } from './cooked'
import { lastCookedDate } from './recipeSort'
import { todayString } from './date'

/**
 * レシピ一覧の上の横スクロールの区画「最近作っていないレシピ」（2026-09-05 便ND）。
 *
 * オーナー原文:
 *   「しばらく作っていない棚は、自分で登録したレシピが優先で出るようにする、
 *     毎回同じ作っていないレシピが並ば内容にする、ようにしたい」
 *   （「しばらく」「棚」は内部向けの呼び名。画面の見出しは ja.recipes.shelfNotRecentTitle）
 *
 * 決めごと（司令部裁定 2026-09-05）:
 *  ・境目は「14日」＝絞り込み「最近作ってない」（ja.dayStart.condNotRecent・
 *    TodaySuggestPanel と mealPlan の !cookedWithinDays(r, 14)）と同じ物差し。
 *    同じアプリの中に「最近／しばらく」の境目を2つ作らない
 *  ・自分で登録したレシピ（!isStarter）が先。足りないぶんは同梱の基本レシピで埋める
 *    （自作0品でも区画は出る）
 *  ・一度も作っていない品も入れて先頭側（記録を付けない人ほどこの区画が要るため）
 *  ・上位10件まで。該当0件なら区画ごと出さない（出す・出さないは呼び出し側）
 *  ・並びは「日替わりの種」でシャッフル＝同じ日は何度開いても同じ並び
 *    （開くたび変えると、詳細から一覧へ戻るたび別物になり壊れて見える＋e2eで固定できない）
 */

/** 「最近作ってない」の境目（日数）。絞り込み・献立の候補選びと同じ14日 */
export const SHELF_NOT_RECENT_DAYS = 14

/** 区画に出す最大の品数 */
export const SHELF_MAX = 10

/**
 * 並びを決める「種」。**種の決め方はこの1か所だけ**に置く。
 *
 * いまは今日の日付（YYYY-MM-DD）＝日替わり。日をまたぐと並びが変わり、同じ日のあいだは
 * 何度開いても・詳細から戻っても同じ並びになる（e2e は E2E_FAKE_TODAY で固定できる）。
 * 「開くたびに変える」へ切り替えるなら、この return を
 * `String(Math.random())` に差し替えるだけでよい（呼び出し側はマウントごとに1回だけ読む）。
 */
export function shelfSeed(): string {
  return todayString()
}

/**
 * 文字列を32bitの数へ潰す（FNV-1a）。「種＋レシピ番号」から並び順の札を作るためのもの。
 * 乱数の状態を持たないので、同じ種なら何度計算しても同じ並びになる＝テストで固定できる。
 */
function hash32(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * 並びの優先順。数が小さいほど先頭側。
 *  0 自作・一度も作っていない ／ 1 自作・前に作った ／
 *  2 同梱・一度も作っていない ／ 3 同梱・前に作った
 * 「自作が先」が外側、「一度も作っていない品が先頭側」が内側。
 */
function shelfTier(recipe: Recipe): number {
  return (recipe.isStarter ? 2 : 0) + (lastCookedDate(recipe) === null ? 0 : 1)
}

/**
 * 区画に出すレシピを選ぶ。入力は一覧が扱っている集合（visibleRecipes＝
 * 「基本レシピを表示しない」反映済み）をそのまま渡す＝一覧に出ない品を区画に出さない。
 *
 * 14日以内に作った品を除き、優先順（shelfTier）→種で決めた札（hash32）の順に並べて
 * 上位 SHELF_MAX 件。判定は cookedWithinDays / lastCookedDate を**流用**する（再実装しない）。
 * 0件のときは空の配列＝呼び出し側が区画ごと出さない。
 */
export function pickShelfRecipes(recipes: readonly Recipe[], seed: string): Recipe[] {
  return recipes
    .filter((recipe) => !cookedWithinDays(recipe, SHELF_NOT_RECENT_DAYS))
    .map((recipe) => ({
      recipe,
      tier: shelfTier(recipe),
      key: hash32(`${seed}:${recipe.id ?? recipe.title}`),
    }))
    .sort(
      (a, b) =>
        a.tier - b.tier ||
        a.key - b.key ||
        // 札が同じ（まず起きない）ときも並びが揺れないように、更新順で決める
        b.recipe.updatedAt - a.recipe.updatedAt,
    )
    .slice(0, SHELF_MAX)
    .map((entry) => entry.recipe)
}
