import { db } from './db'
import { defaultSettings } from './types'
import type { CookedLog, Recipe, RecipeInput } from './types'
import { buildSearchWords, SEARCH_INDEX_VERSION, searchIndexNeedsRebuild } from '../logic/kana'
import { exclusionRecordFor } from '../logic/backup'
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
 * 配布レシピ（テーマ/セット）由来のレシピをまとめて削除し、削除件数を返す。
 * 今日の献立・週間/月間プランナーはrecipeIdで参照するだけなので、
 * 単品削除(deleteRecipe)と同じくここでは追加の後始末は不要
 * （読み出し側が「該当レシピが見つからない」を無視して除外する既存の作りに委ねる）。
 * 再取込除外の記録（トゥームストーン）はここでは追加しない: テーマ丸ごとの削除後に
 * ユーザーが自分で「追加する」を押すのは明確な再取込の意思表示であり、そこで全品除外扱いに
 * なってしまうと「追加したのに何も入らない」事故になるため（2026-07-13）。
 * 既に個別削除で残っている除外記録は消さずに尊重する（再取込しても個別削除した品は戻らない。
 * 戻したければテーマ一覧の「除外中◯品・すべて戻す」で解除できる）
 */
export async function deleteRecipesBySourceSet(setId: string): Promise<number> {
  const ids = await db.recipes.where('sourceSetId').equals(setId).primaryKeys()
  await db.recipes.bulkDelete(ids)
  return ids.length
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

/** 「作った！」記録を追加（新しい順に先頭へ） */
export async function addCookedLog(id: number, log: CookedLog): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return
    await db.recipes.update(id, {
      cookedLogs: [log, ...recipe.cookedLogs],
    })
  })
}

/** 「作った！」記録を後から編集する（日付・ひとことメモの追記や修正） */
export async function updateCookedLog(
  id: number,
  index: number,
  patch: Partial<CookedLog>,
): Promise<void> {
  await db.transaction('rw', db.recipes, async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe || !recipe.cookedLogs[index]) return
    const cookedLogs = recipe.cookedLogs.map((log, i) =>
      i === index ? { ...log, ...patch } : log,
    )
    await db.recipes.update(id, { cookedLogs })
  })
}
