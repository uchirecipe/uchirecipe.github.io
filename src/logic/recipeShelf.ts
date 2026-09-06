import type { Recipe } from '../db/types'
import { cookedWithinDays } from './cooked'
import { lastCookedDate, pantryMatchCount } from './recipeSort'
import { makePantryMatcher } from './pantry'
import { todayString } from './date'

/**
 * 横スクロールの区画（棚）に並べるレシピを選ぶ（2026-09-05 便ND）。
 *
 * 置き場所は献立の「日」（2026-09-06 便NH で、レシピ一覧の上から引っ越した。
 * オーナー確定「何を作るのかサーっと探せるページはそこだから」）。3段:
 * 「最近作ったレシピ」→「しばらく作っていないレシピ」→「在庫の食材を使うレシピ」。
 * 選ぶ物差しはこのファイルの関数のまま動かしていない＝引っ越しで並びは変わらない。
 *
 * オーナー原文（区画を作ったときのもの）:
 *   「しばらく作っていない棚は、自分で登録したレシピが優先で出るようにする、
 *     毎回同じ作っていないレシピが並ば内容にする、ようにしたい」
 *   （「しばらく」「棚」は内部向けの呼び名。画面の見出しは ja.recipes.shelfNotRecentTitle）
 *
 * 決めごと（司令部裁定 2026-09-05）:
 *  ・境目は「14日」＝候補選び（mealPlan の suggestForSlot と TodaySuggestPanel の drawOne が
 *    最近作った品を後回しにする !cookedWithinDays(r, 14)）と同じ物差し。
 *    同じアプリの中に「最近／しばらく」の境目を2つ作らない
 *    （絞り込みチップ「最近作ってない」は 2026-09-06 便NIで撤去。同じ14日は抽選側に残っている）
 *  ・自分で登録したレシピ（!isStarter）が先。足りないぶんは同梱の基本レシピで埋める
 *    （自作0品でも区画は出る）
 *  ・一度も作っていない品も入れて先頭側（記録を付けない人ほどこの区画が要るため）
 *  ・上位10件まで。該当0件なら区画ごと出さない（出す・出さないは呼び出し側）
 *  ・並びは「日替わりの種」でシャッフル＝同じ日は何度開いても同じ並び
 *    （開くたび変えると、詳細から一覧へ戻るたび別物になり壊れて見える＋e2eで固定できない）
 */

/** 「最近作っていない」の境目（日数）。1品・献立の候補選びと同じ14日 */
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
export function pickShelfRecipes(
  recipes: readonly Recipe[],
  seed: string,
  // 「最近作ったもの」の棚に既に並んだ品は除く（2026-09-06 便NH・司令部裁定
  // 「同じ品はページ内の棚に1回だけ」。最後に作ったのが14日以上前でも、記録の新しい5品に
  // 入っていれば「最近作ったもの」と両方に並んでしまうため＝週末しか作らない人で普通に起きる）。
  // 口の形は下の pickPantryShelfRecipes の excludeIds と同じ。省略時は今までどおり除かない
  excludeIds: ReadonlySet<number> = new Set(),
): Recipe[] {
  return recipes
    .filter(
      (recipe) =>
        (recipe.id == null || !excludeIds.has(recipe.id)) &&
        !cookedWithinDays(recipe, SHELF_NOT_RECENT_DAYS),
    )
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

/**
 * 2つ目の区画「在庫の食材を使うレシピ」（2026-09-05 便NF）に出すレシピを選ぶ。
 *
 * 司令部裁定（案A）: **新しい物差しを発明しない**。既存の2つをそのまま使い回す:
 *  ・候補 = 絞り込み「在庫の食材で絞る」（ja.search.pantryFilter・logic/search.ts の
 *    pantryOnly）と同じ「在庫（ある/少ない）の食材を**1つ以上**使う」。
 *    判定は makePantryMatcher（名寄せの一本化先）を経由し、ここで再実装しない
 *  ・並び = 並べ替え「在庫との一致が多いレシピ順」（ja.search.sortPantryMatch）と同じ
 *    pantryMatchCount（在庫チップ1件につき判定器1つ）の多い順。
 *    同点は 自作優先 → 日替わりの種（hash32。上の区画と同じ札）→ updatedAt
 *
 * 「作れる」の物差しは作らない: 実測では「全材料そろう」は同梱109品に対して
 * プリセット在庫12件を全部「ある」にしても0品（材料の51%が調味料で、在庫チップに
 * 調味料がほぼ入らないため）＝棚として成立しない。だから見出しも「作れる」と言わない。
 *
 * pantryNames は呼び出し側が pantryAvailableNames（ある/少ないだけ・「ない」を除く）で
 * 作って渡す＝在庫チップ0件なら候補0件で空を返し、呼び出し側が区画ごと出さない。
 * これを守らないと「matchers 0件→全品0点→更新順」の並びが在庫の見出しで出てしまう。
 * 在庫は「作った！」で1つ下がる（Dexie 経由）ので、区画は在庫の動きに合わせて自動で変わる。
 */
export function pickPantryShelfRecipes(
  recipes: readonly Recipe[],
  pantryNames: readonly string[],
  seed: string,
  // 上の棚に既に並んだ品は除く（2026-09-05 司令部裁定。自作中心の人ほど両棚に同じ品が
  // 2回並び、棚の意味が薄れるため。下見§4の推奨②）。
  // 2026-09-06 便NH: 日タブでは棚が3段になったので、呼び出し側は
  // 「最近作った5品＋最近作っていない10品」を渡す＝同じ品はページ内の棚に1回だけ（鎖の除外）
  excludeIds: ReadonlySet<number> = new Set(),
): Recipe[] {
  if (pantryNames.length === 0) return []
  // 「1つ以上使うか」の判定器と、「何チップ一致するか」の判定器の列。
  // どちらも makePantryMatcher 経由＝絞り込み・並べ替えとまったく同じ名寄せ
  const matchesAny = makePantryMatcher([...pantryNames])
  const matchers = pantryNames.map((name) => makePantryMatcher([name]))
  return recipes
    .filter((recipe) => recipe.id != null && !excludeIds.has(recipe.id))
    .filter((recipe) => recipe.ingredients.some((i) => matchesAny(i.name)))
    .map((recipe) => ({
      recipe,
      count: pantryMatchCount(recipe, matchers),
      // 自作優先は「同点のとき」だけ（一致数の物差しを崩さない）。上の区画の shelfTier と
      // 違い「作った/作っていない」は見ない＝この区画の軸は在庫だけ
      own: recipe.isStarter ? 1 : 0,
      key: hash32(`${seed}:${recipe.id ?? recipe.title}`),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.own - b.own ||
        a.key - b.key ||
        // 札が同じ（まず起きない）ときも並びが揺れないように、更新順で決める
        b.recipe.updatedAt - a.recipe.updatedAt,
    )
    .slice(0, SHELF_MAX)
    .map((entry) => entry.recipe)
}

/** 「最近作ったもの」の棚に出す最大の品数（旧 components/RecentCookedList の5件と同じ） */
export const RECENT_SHELF_MAX = 5

/**
 * 3段の1つ目「最近作ったもの」の棚（2026-09-06 便NH）に出すレシピを選ぶ。
 *
 * 旧「最近作ったもの」（components/RecentCookedList＝作った記録を縦に5件）の置き換え。
 * オーナー確定「『最近作った』も同じレシピ横スクロールにする」。
 *  ・「作った！」の記録のいちばん新しい日付（lastCookedDate を流用・再実装しない）が
 *    新しい順に RECENT_SHELF_MAX 件。記録が1件も無い品は並べない（0件なら棚ごと出さない）
 *  ・並べるのは記録の行ではなく**レシピ**＝同じ品を2回作っていても1回だけ出る。
 *    記録そのものは棚の下の既存リンク「作った記録の一覧」で今までどおり全部見られる
 *  ・レシピを削除したあとも残っている記録（detached）は並べない: 棚のカードはレシピ詳細への
 *    入口で、削除済みの品には行き先が無い（旧 RecentCookedList との意図的な差）
 *  ・種は使わない（日替わりに混ぜる棚ではなく時系列そのもの）。同じ日に複数作った日は
 *    updatedAt で並びを固定する＝開き直しても揺れない（揺れると壊れて見える＋e2eで固定できない）
 */
export function pickRecentCookedShelfRecipes(recipes: readonly Recipe[]): Recipe[] {
  return recipes
    .map((recipe) => ({ recipe, last: lastCookedDate(recipe) }))
    .filter((entry): entry is { recipe: Recipe; last: string } => entry.last !== null)
    .sort((a, b) => b.last.localeCompare(a.last) || b.recipe.updatedAt - a.recipe.updatedAt)
    .slice(0, RECENT_SHELF_MAX)
    .map((entry) => entry.recipe)
}
