/**
 * 「URLから取り込む」機能のapp側ロジック(fetchRecipeSet(src/logic/backup.ts)と同じ形の薄いラッパー)。
 * 実際のHTML取得・schema.org/Recipe抽出はCloudflare Worker(workers/recipe-import/)側で行い、
 * ここではエンドポイントへの問い合わせと正規化JSONの型付けだけを担う。
 *
 * エンドポイント未設定(VITE_RECIPE_IMPORT_ENDPOINT未設定=Workerデプロイ前)でも、
 * dev/本番のビルドが壊れないよう定数化しておく(isUrlImportEnabledがfalseならUI側でURL欄自体を隠す)。
 */

/** Worker側 workers/recipe-import/src/normalize.ts の NormalizedRecipe と同じ形(型は独立定義) */
export interface ImportedIngredient {
  name: string
  amount?: string
}

export interface ImportedRecipe {
  title: string
  ingredients: ImportedIngredient[]
  steps: string[]
  servings?: number
  cookMinutes?: number
  imageUrl?: string
  sourceUrl: string
}

type ImportErrorReason = 'fetch_failed' | 'no_recipe' | 'invalid_url'

/** 取り込み失敗の理由を呼び出し側が文言を出し分けられるよう表す(RecipeSetFetchErrorと同じ形) */
export class UrlImportError extends Error {
  reason: ImportErrorReason
  constructor(reason: ImportErrorReason) {
    super(reason)
    this.reason = reason
  }
}

/**
 * URL取り込みエンドポイント(Cloudflare Workerの公開URL)。
 * 未設定(空文字)ならURL取り込みUI自体を表示しない(Workerデプロイ前のdev/本番で壊れないため)。
 */
export const IMPORT_ENDPOINT: string = import.meta.env.VITE_RECIPE_IMPORT_ENDPOINT ?? ''

/** URL取り込みUIを表示してよいか(エンドポイント設定済みか) */
export function isUrlImportEnabled(): boolean {
  return IMPORT_ENDPOINT.trim() !== ''
}

function isImportedRecipe(value: unknown): value is ImportedRecipe {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return (
    typeof r.title === 'string' &&
    Array.isArray(r.ingredients) &&
    Array.isArray(r.steps) &&
    typeof r.sourceUrl === 'string'
  )
}

/** URLからレシピを取り込む(Worker経由)。失敗時はUrlImportErrorをthrowする */
export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
  if (!isUrlImportEnabled()) throw new UrlImportError('fetch_failed')
  let res: Response
  try {
    res = await fetch(`${IMPORT_ENDPOINT}?url=${encodeURIComponent(url)}`)
  } catch {
    throw new UrlImportError('fetch_failed')
  }
  if (!res.ok) throw new UrlImportError('fetch_failed')
  let json: unknown
  try {
    json = await res.json()
  } catch {
    throw new UrlImportError('fetch_failed')
  }
  const body = json as { ok?: boolean; error?: ImportErrorReason; recipe?: unknown }
  if (!body.ok) throw new UrlImportError(body.error ?? 'fetch_failed')
  if (!isImportedRecipe(body.recipe)) throw new UrlImportError('fetch_failed')
  return body.recipe
}
