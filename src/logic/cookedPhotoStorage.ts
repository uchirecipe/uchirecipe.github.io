import type { Recipe } from '../db/types'

/**
 * 「作った記録」写真の容量ガード（2026-07-12写真添付・docs/20 §4）。
 * 自動削除はしない。合計容量が閾値を超えたら、古い順の削除を促すバナーを出すだけ。
 */
export const COOKED_PHOTO_WARNING_BYTES = 50 * 1024 * 1024 // 50MB

/** 全レシピの「作った記録」写真の合計バイト数 */
export function totalCookedLogPhotoBytes(recipes: Pick<Recipe, 'cookedLogs'>[]): number {
  return recipes.reduce(
    (sum, recipe) =>
      sum + recipe.cookedLogs.reduce((logSum, log) => logSum + (log.photo?.size ?? 0), 0),
    0,
  )
}

/** 合計容量が閾値(50MB)を超えているか */
export function isOverCookedPhotoLimit(totalBytes: number): boolean {
  return totalBytes > COOKED_PHOTO_WARNING_BYTES
}

/** バイト数をMB表示用に丸める（小数第1位まで） */
export function bytesToMB(bytes: number): number {
  return Math.round((bytes / (1024 * 1024)) * 10) / 10
}
