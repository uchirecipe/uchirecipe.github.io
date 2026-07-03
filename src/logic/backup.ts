import { db } from '../db/db'
import { getSettings, updateSettings } from '../db/settings'
import { defaultSettings, type Recipe, type Settings } from '../db/types'

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
  settings: Settings
  recipes: BackupRecipe[]
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

function toRecipe(backup: BackupRecipe): Recipe {
  const { photoBase64, photoType, ...rest } = backup
  const recipe: Recipe = { ...rest }
  delete recipe.id // 読み込み先で新しい番号を振り直す
  if (photoBase64) {
    recipe.photo = base64ToBlob(photoBase64, photoType || 'image/jpeg')
  }
  return recipe
}

/**
 * バックアップを取り込む。
 * mode 'replace': 今のデータを全部消してから復元（引っ越し・復旧向け）
 * mode 'merge'  : 今のデータは残し、バックアップのレシピを追加する
 */
export async function importBackup(
  file: BackupFile,
  mode: 'replace' | 'merge',
): Promise<number> {
  const recipes = file.recipes.map(toRecipe)
  await db.transaction('rw', db.recipes, db.settings, async () => {
    if (mode === 'replace') {
      await db.recipes.clear()
      // 設定も復元。基本レシピの二重投入を防ぐため starterSeeded は必ず true にする
      await db.settings.put({
        ...defaultSettings,
        ...file.settings,
        id: 1,
        starterSeeded: true,
      })
    }
    await db.recipes.bulkAdd(recipes)
  })
  return recipes.length
}

/** 30日以上バックアップしていない（または一度もしていない）か */
export function backupOverdue(lastBackupAt: number | undefined): boolean {
  if (lastBackupAt === undefined) return true
  return Date.now() - lastBackupAt > 30 * 24 * 60 * 60 * 1000
}
