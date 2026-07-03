import Dexie, { type Table } from 'dexie'
import type { Recipe, Settings } from './types'

/**
 * うちレシピのデータベース（ブラウザ内蔵の IndexedDB を Dexie 経由で使う）。
 * 端末内保存なのでサーバー不要・オフラインで動く。
 */
class UchiRecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  settings!: Table<Settings, number>

  constructor() {
    super('uchi-recipe')
    this.version(1).stores({
      // ++id: 自動採番 / *tags, *searchWords: 配列の中身で検索できる索引
      recipes: '++id, title, *tags, *searchWords, updatedAt',
    })
    // バージョン2: 設定テーブルを追加（既存のレシピはそのまま引き継がれる）
    this.version(2).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
    })
  }
}

export const db = new UchiRecipeDB()
