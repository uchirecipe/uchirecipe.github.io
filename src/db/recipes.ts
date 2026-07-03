import { db } from './db'
import type { CookedLog, Recipe, RecipeInput } from './types'
import { buildSearchWords } from '../logic/kana'

/** 入力の掃除: 名前が空の材料行・本文が空の手順行は保存しない */
function cleanInput(input: RecipeInput): RecipeInput {
  return {
    ...input,
    title: input.title.trim(),
    tags: input.tags.map((t) => t.trim()).filter(Boolean),
    ingredients: input.ingredients
      .map((i) => ({ ...i, name: i.name.trim() }))
      .filter((i) => i.name !== ''),
    steps: input.steps
      .map((s) => ({ ...s, text: s.text.trim() }))
      .filter((s) => s.text !== ''),
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
    searchWords: buildSearchWords(cleaned.title, cleaned.ingredients, cleaned.tags),
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
    searchWords: buildSearchWords(cleaned.title, cleaned.ingredients, cleaned.tags),
    updatedAt: Date.now(),
  })
}

/** レシピを削除 */
export async function deleteRecipe(id: number): Promise<void> {
  await db.recipes.delete(id)
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
