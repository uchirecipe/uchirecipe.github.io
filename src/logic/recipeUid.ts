import type { Recipe } from '../db/types'

/**
 * レシピを一意に指す「印」（uid）の決め方（純ロジック・DB非依存。2026-08-16 便GZ）。
 *
 * なぜ要るのか: レシピを削除しても「作った記録」を残す設計にすると、あとで同じレシピを
 * 書き出したファイルから入れ直したときに、記録をどのレシピへ結び直すかを決める手掛かりが要る。
 * いまの `id` は端末ごとの連番なので、別の端末・別のファイルでは同じ番号が違う料理を指す
 * （ファイルを渡し合うと必ずぶつかる）。料理名で結ぶのは、オーナーが懸念したとおり
 * **似た名前の違うレシピが勝手につながる**ので採らない。
 *
 * 印の中身は2種類:
 * - `starter:<料理名>` … 同梱の基本レシピ（isStarter かつ sourceSetId なし）。
 *   アプリが配っている品なので、設定画面の「基本レシピを入れ直す」で入り直しても
 *   同じ印になり、記録が戻る。この印が付くのは「アプリが配った、この料理名の品」だけで、
 *   ユーザーが同じ料理名で自分で登録したレシピには付かない（そちらは乱数の印）。
 *   ＝同名でも別のレシピなら結ばれない。削除済み基本レシピの再取込を料理名で止めている
 *   既存の仕組み（setExclusions のトゥームストーン）と同じ同一性の考え方。
 * - 乱数（crypto.randomUUID） … それ以外すべて。自作レシピ・配布セット由来・
 *   取り込んだレシピ。名前を変えても印は変わらず、同名を作っても印はぶつからない。
 */

/** 同梱の基本レシピの印に付ける頭文字。乱数の印（UUID）とは形が違うので見分けられる */
export const STARTER_UID_PREFIX = 'starter:'

/** 同梱の基本レシピの印（アプリが配る品なので、入れ直しでも同じ印になる） */
export function starterRecipeUid(title: string): string {
  return `${STARTER_UID_PREFIX}${title.trim()}`
}

/** 同梱の基本レシピの印か */
export function isStarterUid(uid: string | undefined): boolean {
  return typeof uid === 'string' && uid.startsWith(STARTER_UID_PREFIX)
}

/**
 * 新しいレシピに振る乱数の印。
 * crypto.randomUUID が使えない環境（古いブラウザ・非セキュアコンテキスト）でも
 * 印が空にならないよう、時刻＋乱数の組み合わせに落とす。印がぶつかっても
 * 「結び直さない」側に倒れるだけで、データが壊れることはない。
 */
export function newRecipeUid(): string {
  const c = globalThis.crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const rand = () => Math.random().toString(36).slice(2, 10)
  return `r-${Date.now().toString(36)}-${rand()}${rand()}`
}

/** 印を振る対象を見分けるのに要る、レシピ1品分の最小情報 */
export interface RecipeUidTarget {
  id?: number
  uid?: string
  title: string
  isStarter?: boolean
  sourceSetId?: string
}

/**
 * まだ印を持っていないレシピに振る印を決める（純ロジック・DB非依存）。
 *
 * この対応より前に保存されたレシピには印が無いので、起動時に1回だけ後から振る
 * （db/recipeUid.ts の backfillRecipeUids がこの結果を書き込む）。
 * 印を足すだけで既存の中身は1文字も書き換えないので、途中で失敗しても失うものは無い
 * （書き込みは1つのトランザクションなので、途中で落ちれば丸ごと巻き戻り、次の起動でやり直す）。
 *
 * starterTitles は同梱の基本レシピの料理名（db/starters.ts の starterDefs 由来）。
 * ここに載っている料理名の基本レシピにだけ `starter:<料理名>` を振り、他は乱数にする。
 * 同じ印が2品に付かないよう、既に使われている印は避けて乱数に落とす
 * （印がぶつかると、結び直しの相手が一意に決まらなくなるため）。
 */
export function planRecipeUidBackfill(
  recipes: readonly RecipeUidTarget[],
  starterTitles: ReadonlySet<string>,
  makeUid: () => string = newRecipeUid,
): { id: number; uid: string }[] {
  const used = new Set<string>()
  for (const recipe of recipes) {
    if (recipe.uid) used.add(recipe.uid)
  }
  const plan: { id: number; uid: string }[] = []
  for (const recipe of recipes) {
    if (recipe.uid || recipe.id == null) continue
    const title = recipe.title.trim()
    const starterUid =
      recipe.isStarter === true && recipe.sourceSetId == null && starterTitles.has(title)
        ? starterRecipeUid(title)
        : null
    let uid = starterUid != null && !used.has(starterUid) ? starterUid : makeUid()
    // 乱数がぶつかることは実質ないが、ぶつかったまま書くと結び直しの相手が二重になるので念のため
    while (used.has(uid)) uid = makeUid()
    used.add(uid)
    plan.push({ id: recipe.id, uid })
  }
  return plan
}

/** レシピの印→レシピの対応表。同じ印が2品に付いていたら、id の小さい方（先に入った方）を採る */
export function indexRecipesByUid<T extends Pick<Recipe, 'id' | 'uid'>>(
  recipes: readonly T[],
): Map<string, T> {
  const map = new Map<string, T>()
  for (const recipe of recipes) {
    if (!recipe.uid || recipe.id == null) continue
    const found = map.get(recipe.uid)
    if (found == null || (found.id ?? Infinity) > recipe.id) map.set(recipe.uid, recipe)
  }
  return map
}
