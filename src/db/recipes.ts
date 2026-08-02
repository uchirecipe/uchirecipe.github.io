import { db } from './db'
import { defaultSettings } from './types'
import type { CookedLog, Recipe, RecipeInput } from './types'
import { buildSearchWords, SEARCH_INDEX_VERSION, searchIndexNeedsRebuild } from '../logic/kana'
import { exclusionRecordFor } from '../logic/backup'
import { archiveIdsForRecipe } from '../logic/cookedArchive'
import { summarizeRecipeDeleteImpact, type RecipeDeleteImpact } from '../logic/recipeDelete'
import { READINGS_VERSION } from '../logic/ingredientReadings'

/** 入力の掃除: 名前が空の材料行・本文が空の手順行は保存しない */
function cleanInput(input: RecipeInput): RecipeInput {
  const cleanedKeywords = input.keywords?.map((k) => k.trim()).filter(Boolean)
  return {
    ...input,
    title: input.title.trim(),
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    ingredients: input.ingredients
      .map((i) => ({ ...i, name: i.name.trim(), memo: i.memo?.trim() || undefined }))
      .filter((i) => i.name !== ''),
    steps: input.steps
      .map((s) => ({ ...s, text: s.text.trim(), memo: s.memo?.trim() || undefined }))
      .filter((s) => s.text !== ''),
    keywords: cleanedKeywords && cleanedKeywords.length > 0 ? cleanedKeywords : undefined,
  }
}

/** レシピを新規作成し、採番された id を返す */
export async function createRecipe(input: RecipeInput): Promise<number> {
  const cleaned = cleanInput(input)
  const now = Date.now()
  const recipe: Recipe = {
    ...cleaned,
    isFavorite: false,
    cookedLogs: [],
    searchWords: buildSearchWords(cleaned.title, cleaned.ingredients, cleaned.tags, cleaned.keywords),
    createdAt: now,
    updatedAt: now,
  }
  return db.recipes.add(recipe)
}

/** id でレシピを1件取得 */
export async function getRecipe(id: number): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}

/** 全レシピを更新が新しい順で取得 */
export async function listRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('updatedAt').reverse().toArray()
}

/** レシピの内容を更新（お気に入り・作った記録・作成日時は保持する） */
export async function updateRecipe(id: number, input: RecipeInput): Promise<void> {
  const cleaned = cleanInput(input)
  await db.recipes.update(id, {
    ...cleaned,
    searchWords: buildSearchWords(cleaned.title, cleaned.ingredients, cleaned.tags, cleaned.keywords),
    updatedAt: Date.now(),
  })
}

/**
 * レシピを削除。配布セット（テーマ）由来のレシピなら (setId, title) の「再取込除外」記録を残し、
 * テーマの再取込（再読み込み）で削除した品が復活しないようにする（トゥームストーン。
 * 2026-07-13 Fable設計。確認ダイアログは出さない＝設定のテーマ一覧「すべて戻す」で戻せるため）。
 * 同一トランザクションで週間献立(mealPlans)・今日の献立(todayList)から当該レシピの行も削除し、
 * 削除済みレシピを指す孤児データが残らないようにする（データ堅牢性強化・2026-07-13）。
 * mealPlansはrecipeIdに索引が無いためfilterで該当行を洗い出してから削除する
 */
export async function deleteRecipe(id: number): Promise<void> {
  await db.transaction('rw', db.recipes, db.setExclusions, db.mealPlans, db.todayList, async () => {
    const recipe = await db.recipes.get(id)
    if (recipe) {
      const record = exclusionRecordFor(recipe)
      if (record) {
        // 同じ (setId, title) の記録が既にあれば増やさない（何度削除しても記録は1件のまま）
        const already = await db.setExclusions
          .where('setId')
          .equals(record.setId)
          .and((e) => e.title === record.title)
          .count()
        if (already === 0) {
          await db.setExclusions.add({ ...record, excludedAt: Date.now() })
        }
      }
    }
    await db.recipes.delete(id)
    const orphanMealPlanIds = await db.mealPlans.filter((e) => e.recipeId === id).primaryKeys()
    if (orphanMealPlanIds.length > 0) await db.mealPlans.bulkDelete(orphanMealPlanIds)
    await db.todayList.where('recipeId').equals(id).delete()
  })
}

/**
 * レシピ一覧の「まとめて削除」で選んだ複数品を削除し、削除できた件数を返す
 * （2026-08-02 便CT・オーナー承認）。
 * 1品削除（deleteRecipe）を選択件数ぶん繰り返すのと同じことを1トランザクションで行う:
 * 配布セット由来の品には再取込除外の記録（トゥームストーン）を残し、週の献立・今日の献立から
 * 当該レシピの行も消して孤児データを作らない。同梱の基本レシピ（sourceSetIdなし）に
 * トゥームストーンを付けないのも1品削除と同じで、設定の「基本レシピを入れ直す」で戻せる
 * （＝確認文でその違いを伝える。logic/recipeDelete.ts）。
 * mealPlansはrecipeIdに索引が無いためfilterで該当行を洗い出してから削除する。
 */
export async function deleteRecipes(ids: readonly number[]): Promise<number> {
  if (ids.length === 0) return 0
  return db.transaction('rw', db.recipes, db.setExclusions, db.mealPlans, db.todayList, async () => {
    const targets = (await db.recipes.bulkGet([...ids])).filter((r): r is Recipe => !!r)
    const targetIds = targets.map((r) => r.id).filter((id): id is number => id != null)
    if (targetIds.length === 0) return 0
    for (const recipe of targets) {
      const record = exclusionRecordFor(recipe)
      if (!record) continue
      // 同じ (setId, title) の記録が既にあれば増やさない（何度削除しても記録は1件のまま）
      const already = await db.setExclusions
        .where('setId')
        .equals(record.setId)
        .and((e) => e.title === record.title)
        .count()
      if (already === 0) await db.setExclusions.add({ ...record, excludedAt: Date.now() })
    }
    await db.recipes.bulkDelete(targetIds)
    const idSet = new Set(targetIds)
    const orphanMealPlanIds = await db.mealPlans.filter((e) => idSet.has(e.recipeId)).primaryKeys()
    if (orphanMealPlanIds.length > 0) await db.mealPlans.bulkDelete(orphanMealPlanIds)
    await db.todayList.where('recipeId').anyOf(targetIds).delete()
    return targetIds.length
  })
}

/**
 * 「まとめて削除」の確認文（規約F）に入れる件数を数える（2026-08-02 便CT）。
 * 削除で巻き添えになる作った記録・写真・週の献立の予定・今日の献立と、削除後に残るレシピ数を
 * 実データから数え、集計そのものは純ロジック（logic/recipeDelete.ts）に任せる。
 * 読み取り専用トランザクションで一括して読むので、数えている途中で件数がずれない。
 */
export async function countRecipesDeleteImpact(
  ids: readonly number[],
): Promise<RecipeDeleteImpact> {
  return db.transaction('r', db.recipes, db.mealPlans, db.todayList, async () => {
    const targets = (await db.recipes.bulkGet([...ids])).filter((r): r is Recipe => !!r)
    const idSet = new Set(targets.map((r) => r.id))
    const totalRecipes = await db.recipes.count()
    const mealPlanEntries = await db.mealPlans.filter((e) => idSet.has(e.recipeId)).count()
    const todayEntries =
      idSet.size === 0
        ? 0
        : await db.todayList
            .where('recipeId')
            .anyOf([...idSet].filter((id): id is number => id != null))
            .count()
    return summarizeRecipeDeleteImpact(targets, { totalRecipes, mealPlanEntries, todayEntries })
  })
}

/**
 * 配布レシピ（テーマ/セット）由来のレシピをまとめて削除し、削除件数を返す。
 * 単品削除(deleteRecipe)と同様に、同一トランザクションで週間献立(mealPlans)・
 * 今日の献立(todayList)から当該レシピの行も削除し、削除済みレシピを指す孤児データが
 * 残らないようにする（2026-07バグ修正。従来はbulkDeleteのみで孤児が残っていた）。
 * mealPlansはrecipeIdに索引が無いためfilterで該当行を洗い出してから削除する
 * 再取込除外の記録（トゥームストーン）はここでは追加しない: テーマ丸ごとの削除後に
 * ユーザーが自分で「追加する」を押すのは明確な再取込の意思表示であり、そこで全品除外扱いに
 * なってしまうと「追加したのに何も入らない」事故になるため（2026-07-13）。
 * 既に個別削除で残っている除外記録は消さずに尊重する（再取込しても個別削除した品は戻らない。
 * 戻したければテーマ一覧の「除外中◯品・すべて戻す」で解除できる）
 */
export async function deleteRecipesBySourceSet(setId: string): Promise<number> {
  return db.transaction('rw', db.recipes, db.mealPlans, db.todayList, async () => {
    const ids = await db.recipes.where('sourceSetId').equals(setId).primaryKeys()
    if (ids.length === 0) return 0
    await db.recipes.bulkDelete(ids)
    const idSet = new Set(ids)
    const orphanMealPlanIds = await db.mealPlans.filter((e) => idSet.has(e.recipeId)).primaryKeys()
    if (orphanMealPlanIds.length > 0) await db.mealPlans.bulkDelete(orphanMealPlanIds)
    await db.todayList.where('recipeId').anyOf(ids).delete()
    return ids.length
  })
}

/**
 * 食材名の読み仮名辞書（表記ゆれ対策）またはカテゴリ辞書（logic/kana.ts の
 * CATEGORY_RULES、例:「きのこ」）が更新されていたら、全レシピのsearchWordsを
 * 作り直す（保存済みsearchWordsは古い変換のまま残ってしまうため）。
 * updatedAtは変えない（一覧の並び順を崩さないため）。
 * ingredientReadingsVersion・searchIndexVersion のどちらか一方でも版が古ければ実行する
 * （両方まとめて1回のスキャンで作り直し、二重に全件走査しない）。
 * トランザクションが失敗すればバージョンの書き込みも巻き戻るため、次回起動時に再試行される
 * （冪等・失敗しても既存データを壊さない）。
 */
export async function rebuildSearchWordsIfNeeded(): Promise<void> {
  await db.transaction('rw', db.recipes, db.settings, async () => {
    const settings = { ...defaultSettings, ...(await db.settings.get(1)) }
    if (!searchIndexNeedsRebuild(settings)) return
    const all = await db.recipes.toArray()
    for (const recipe of all) {
      const searchWords = buildSearchWords(recipe.title, recipe.ingredients, recipe.tags, recipe.keywords)
      await db.recipes.update(recipe.id!, { searchWords })
    }
    await db.settings.put({
      ...settings,
      ingredientReadingsVersion: READINGS_VERSION,
      searchIndexVersion: SEARCH_INDEX_VERSION,
      id: 1,
    })
  })
}

/** お気に入りの ON/OFF を切り替える */
export async function toggleFavorite(id: number): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return
    await db.recipes.update(id, { isFavorite: !recipe.isFavorite })
  })
}

/**
 * 「作った！」記録の並び順は常に日付の新しい順（2026-07-29 便CI/C08）。
 * 以前は追加順（先頭に積むだけ）だったため、過去の日付を後から記録すると
 * cookedLogs[0] が最新でなくなり、logic/cooked.ts の cookedWithinDays（＝ホームの
 * 「今日なに作る？」と献立自動提案の「最近作ってない」条件）が誤判定していた。
 * date は 'YYYY-MM-DD' 固定（db/types.ts）なので文字列比較で日付順になる。
 * JSのsortは安定なので、同じ日付の記録どうしは元の順序（新しく足した方が先頭）を保つ。
 */
function sortLogsByDateDesc(logs: CookedLog[]): CookedLog[] {
  return [...logs].sort((a, b) => b.date.localeCompare(a.date))
}

/** 「作った！」記録を追加（日付の新しい順に並べ直して保存する） */
export async function addCookedLog(id: number, log: CookedLog): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return
    await db.recipes.update(id, {
      cookedLogs: sortLogsByDateDesc([log, ...recipe.cookedLogs]),
    })
  })
}

/** 「作った！」記録を後から編集する（日付・ひとことメモ・人数・写真の修正） */
export async function updateCookedLog(
  id: number,
  index: number,
  patch: Partial<CookedLog>,
): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe || !recipe.cookedLogs[index]) return
    // 日付を直したときも並びが崩れたままにならないよう、書き戻す前に必ず日付順に整える
    const cookedLogs = sortLogsByDateDesc(
      recipe.cookedLogs.map((log, i) => (i === index ? { ...log, ...patch } : log)),
    )
    await db.recipes.update(id, { cookedLogs })
  })
}

/**
 * 「作った！」記録を1件だけ削除する（2026-07-29 便CI/C02）。
 * これが無かったため、誤タップ・重複記録を消す唯一の手段が「レシピごと削除」になっており、
 * 記録・写真・献立の予定まで巻き添えにする全損経路へ誘導していた。
 * 記録は Recipe に埋め込んだ配列なので、対象の index を除いて書き戻すだけでよい
 * （写真Blobも同じ要素に入っているので一緒に消え、容量も戻る）。
 */
export async function deleteCookedLog(id: number, index: number): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe || !recipe.cookedLogs[index]) return
    await db.recipes.update(id, {
      cookedLogs: recipe.cookedLogs.filter((_, i) => i !== index),
    })
  })
}

/**
 * ファイルへ書き出し済みの「作った記録」を端末から消す（2026-08-02 古い記録のアーカイブ）。
 * 書き出しと削除を1つのボタンにまとめない設計なので、消す対象は「今の端末の記録」ではなく
 * 「書き出したファイルに入っているID」で指定する。消す直前にDBを読み直してIDを作り直すため、
 * 書き出したあとに追加・編集された記録を巻き込むことはない
 * （IDはレシピ番号＋日付＋メモから作る＝logic/cookedArchive.ts の archiveIdsForRecipe）。
 * レシピ本体・境目以降の記録・お気に入り・写真つきのレシピ画像には触れない。
 */
export async function deleteArchivedCookedLogs(
  ids: readonly string[],
): Promise<{ logs: number; photos: number }> {
  const idSet = new Set(ids)
  let logs = 0
  let photos = 0
  if (idSet.size === 0) return { logs, photos }
  await db.transaction('rw', db.recipes, async () => {
    const recipes = await db.recipes.toArray()
    for (const recipe of recipes) {
      if (recipe.id == null || recipe.cookedLogs.length === 0) continue
      const logIds = archiveIdsForRecipe(recipe)
      const kept = recipe.cookedLogs.filter((log, i) => {
        if (!idSet.has(logIds[i])) return true
        logs++
        if (log.photo) photos++
        return false
      })
      if (kept.length === recipe.cookedLogs.length) continue
      await db.recipes.update(recipe.id, { cookedLogs: kept })
    }
  })
  return { logs, photos }
}
