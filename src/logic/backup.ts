import { db } from '../db/db'
import { getSettings, updateSettings } from '../db/settings'
import { defaultSettings, type Recipe, type Settings } from '../db/types'
import { buildSearchWords } from './kana'

/**
 * バックアップ: 全データ（レシピ・写真・作った記録・設定）を
 * 1つのJSONファイルに書き出し／読み込みする。
 * 写真はBase64（画像を文字にした形式）で埋め込む。
 */

interface BackupRecipe extends Omit<Recipe, 'photo'> {
  photoBase64?: string
  photoType?: string
}

export interface BackupFile {
  app: 'uchi-recipe'
  version: 1
  exportedAt: string
  /** 配布用のレシピセットにはsettingsを含めない（個人設定の器を配布物に持たせないため） */
  settings?: Settings
  recipes: BackupRecipe[]
  /** 配布レシピセットのID・表示名・版番号（個人のバックアップファイルには無い） */
  setId?: string
  setName?: string
  setVersion?: number
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/** 全データをJSON文字列にまとめる */
export async function exportBackup(): Promise<string> {
  const recipes = await db.recipes.toArray()
  const settings = await getSettings()
  const backupRecipes: BackupRecipe[] = await Promise.all(
    recipes.map(async ({ photo, ...rest }) => ({
      ...rest,
      photoBase64: photo ? await blobToBase64(photo) : undefined,
      photoType: photo?.type || undefined,
    })),
  )
  const file: BackupFile = {
    app: 'uchi-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    recipes: backupRecipes,
  }
  return JSON.stringify(file)
}

/** JSONをファイルとしてダウンロードし、最終バックアップ日時を記録する */
export async function downloadBackup(): Promise<void> {
  const json = await exportBackup()
  const date = new Date()
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `uchi-recipe-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  await updateSettings({ lastBackupAt: Date.now() })
}

/** バックアップファイルを検証して読み込む。壊れていたら例外 */
export function parseBackup(json: string): BackupFile {
  const data = JSON.parse(json) as Partial<BackupFile>
  if (data.app !== 'uchi-recipe' || !Array.isArray(data.recipes)) {
    throw new Error('invalid backup file')
  }
  return data as BackupFile
}

/** 'replace' 用: id を振り直さず、そのままの内容で取り込む */
function toRecipe(backup: BackupRecipe): Recipe {
  const { photoBase64, photoType, ...rest } = backup
  const recipe: Recipe = { ...rest }
  if (photoBase64) {
    recipe.photo = base64ToBlob(photoBase64, photoType || 'image/jpeg')
  }
  return recipe
}

export interface ImportResult {
  /** 新規に追加したレシピ数 */
  added: number
  /** 既存と重複していたため取り込まなかったレシピ数（merge時のみ発生） */
  skipped: number
}

/**
 * バックアップを取り込む。
 * mode 'replace': 今のデータを全部消してから復元（引っ越し・復旧向け）
 * mode 'merge'  : 今のデータは残し、バックアップのレシピを id で照合して取り込む。
 *   - 同一ID・同一内容 → スキップ（すでに入っている）
 *   - 同一ID・内容が違う → 取り込まずスキップ（今のデータを優先。上書きしない）
 *   - 新規ID → 追加
 */
export async function importBackup(
  file: BackupFile,
  mode: 'replace' | 'merge',
): Promise<ImportResult> {
  const recipes = file.recipes.map(toRecipe)

  if (mode === 'replace') {
    await db.transaction('rw', db.recipes, db.settings, async () => {
      await db.recipes.clear()
      // 設定も復元。基本レシピの二重投入を防ぐため starterSeeded は必ず true にする
      await db.settings.put({
        ...defaultSettings,
        ...file.settings,
        id: 1,
        starterSeeded: true,
      })
      await db.recipes.bulkAdd(recipes)
    })
    return { added: recipes.length, skipped: 0 }
  }

  // merge: 1件ずつ id で照合する
  let added = 0
  let skipped = 0
  await db.transaction('rw', db.recipes, async () => {
    for (const recipe of recipes) {
      if (recipe.id == null) {
        // 古い形式などIDが無い場合は照合できないので新規として追加
        const { id: _unused, ...rest } = recipe
        await db.recipes.add(rest as Recipe)
        added++
        continue
      }
      const existing = await db.recipes.get(recipe.id)
      if (!existing) {
        await db.recipes.add(recipe) // 同じIDのまま追加（次回以降も照合できるように）
        added++
      } else {
        // 同一IDが既にある: 内容が同じでも違ってもスキップ（今のデータを優先）
        skipped++
      }
    }
  })
  return { added, skipped }
}

/** URLが見つからない・壊れている場合の理由を、呼び出し側が文言を出し分けられるよう表す */
export class RecipeSetFetchError extends Error {
  reason: 'not_found' | 'invalid'
  constructor(reason: 'not_found' | 'invalid') {
    super(reason)
    this.reason = reason
  }
}

/** URLからレシピセットのJSON（バックアップと同形式）を取得する。配布元がCORSに対応していないと失敗する */
export async function fetchRecipeSet(url: string): Promise<BackupFile> {
  const res = await fetch(url)
  if (!res.ok) throw new RecipeSetFetchError('not_found')
  const text = await res.text()
  try {
    return parseBackup(text)
  } catch {
    // 開発サーバー(Vite)はSPAのため、存在しないURLでも200＋アプリ本体のHTMLを返す
    // （実在しないset=IDを開いたときに気づきにくい・2026-07-12オーナー実機報告で発覚）。
    // 本文がHTMLなら「見つからない」寄りの文言、それ以外は「壊れている」寄りの文言にする
    throw new RecipeSetFetchError(text.trim().startsWith('<') ? 'not_found' : 'invalid')
  }
}

/**
 * 配布セット取り込み時、料理名が既存レシピと重複した場合にどう扱うか決める（純ロジック・DB非依存）。
 * - 既存レシピが「同じ配布セット」由来（sourceSetIdが一致）→ 'updateName'
 *   （セット側の表示名（テーマ名）が変わっていたら、レシピを増やさずsourceSetNameだけ追従させる。
 *   バッチH-1: kintoreテーマ改名時、旧名称バッジのまま残ってしまう不具合の再発防止）
 * - それ以外（個人登録・別セット由来・setId不明）→ 'skip'（既存を優先し何もしない。従来どおり）
 */
export function resolveDuplicateTitleAction(
  existingSourceSetId: string | undefined,
  incomingSetId: string | undefined,
): 'skip' | 'updateName' {
  if (incomingSetId !== undefined && existingSourceSetId === incomingSetId) return 'updateName'
  return 'skip'
}

/**
 * 配布されているレシピセット（バックアップと同形式のJSON）を追加で読み込む。
 * 個人のバックアップ復元(importBackup)とは別物:
 * - idは信用せず振り直す（配布元と自分のIDが衝突する可能性があるため）
 * - 読み込んだレシピはisStarter扱いにする（無料版の件数制限に含めない）
 * - 重複判定はidではなく料理名（完全一致）で行う
 * - settingsは取り込まない（配布元の設定で自分の設定を上書きしないため）
 * - 同一セットの再取込（テーマ改名など）では重複させず、sourceSetNameだけ新名称に更新する
 *   （resolveDuplicateTitleAction参照）
 */
export async function importRecipeSet(file: BackupFile): Promise<ImportResult> {
  let added = 0
  let skipped = 0
  await db.transaction('rw', db.recipes, async () => {
    const existingByTitle = new Map(
      (await db.recipes.toArray()).map((r) => [r.title.trim(), r] as const),
    )
    for (const backupRecipe of file.recipes) {
      const { id: _unused, ...rest } = toRecipe(backupRecipe)
      const title = rest.title.trim()
      const existing = existingByTitle.get(title)
      if (existing) {
        const action = resolveDuplicateTitleAction(existing.sourceSetId, file.setId)
        if (action === 'updateName' && existing.sourceSetName !== file.setName) {
          await db.recipes.update(existing.id!, { sourceSetName: file.setName })
        }
        skipped++
        continue
      }
      const now = Date.now()
      const newRecipe: Recipe = {
        ...rest,
        isStarter: true,
        sourceSetId: file.setId,
        sourceSetName: file.setName,
        searchWords: buildSearchWords(rest.title, rest.ingredients, rest.tags),
        createdAt: now,
        updatedAt: now,
      }
      await db.recipes.add(newRecipe)
      existingByTitle.set(title, newRecipe)
      added++
    }
  })
  return { added, skipped }
}

/** 30日以上バックアップしていない（または一度もしていない）か */
export function backupOverdue(lastBackupAt: number | undefined): boolean {
  if (lastBackupAt === undefined) return true
  return Date.now() - lastBackupAt > 30 * 24 * 60 * 60 * 1000
}
