import { db } from './db'
import { starterDefs } from './starters'
import { planRecipeUidBackfill, type RecipeUidTarget } from '../logic/recipeUid'

/**
 * まだ「印」（Recipe.uid）を持っていないレシピに、後から印を振る（2026-08-16 便GZ）。
 *
 * 印が何のために要るかは logic/recipeUid.ts の冒頭を参照。
 * この対応より前に保存されたレシピ、および印を持たない古いバックアップから復元したレシピが
 * 対象になる（起動のたびに判定するので、復元の直後でも次の起動で必ず印が付く）。
 *
 * **失敗しても元に戻れる形**にしてある:
 * - 足すのは uid だけ。料理名・材料・手順・記録・写真には一切触らない（消える情報が無い）
 * - 書き込みは1つのトランザクションなので、途中で落ちれば丸ごと巻き戻る（半端に付いた状態にならない）
 * - 巻き戻ったあとは印が無い状態＝この関数がまた対象として拾うので、次の起動でやり直す（冪等）
 * - updatedAt は動かさない（レシピ一覧の並び順を崩さないため。rebuildSearchWordsIfNeeded と同じ）
 *
 * 全件を毎回読み直さないために、まず索引だけで「印を持つ件数」と「全件数」を数える
 * （db.ts バージョン17で recipes に uid の索引を足したのはこのため）。
 * 数が一致していれば1件も読まずに終わる＝2回目以降の起動はほぼ無料。
 */
export async function backfillRecipeUids(): Promise<number> {
  const total = await db.recipes.count()
  // 索引に載っているのは uid を持つ行だけ（持たない行は索引に現れない）
  const withUid = await db.recipes.where('uid').above('').count()
  if (total === withUid) return 0

  const starterTitles = new Set(starterDefs.map((d) => d.title.trim()))
  return db.transaction('rw', db.recipes, async () => {
    const targets: RecipeUidTarget[] = []
    // toArray() ではなく each() で1件ずつ読む（写真つきのレシピを全件メモリに抱えないため。
    // logic/backup.ts の merge 復元と同じ作法）
    await db.recipes.each((recipe) => {
      targets.push({
        id: recipe.id,
        uid: recipe.uid,
        title: recipe.title,
        isStarter: recipe.isStarter,
        sourceSetId: recipe.sourceSetId,
      })
    })
    const plan = planRecipeUidBackfill(targets, starterTitles)
    for (const { id, uid } of plan) {
      await db.recipes.update(id, { uid })
    }
    return plan.length
  })
}
