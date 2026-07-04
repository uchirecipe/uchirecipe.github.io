import Dexie, { type Table } from 'dexie'
import type { MealPlanEntry, PantryItem, Recipe, Settings, ShoppingItem, TodayListItem } from './types'

/**
 * うちレシピのデータベース（ブラウザ内蔵の IndexedDB を Dexie 経由で使う）。
 * 端末内保存なのでサーバー不要・オフラインで動く。
 */
class UchiRecipeDB extends Dexie {
  recipes!: Table<Recipe, number>
  settings!: Table<Settings, number>
  pantryItems!: Table<PantryItem, number>
  shoppingItems!: Table<ShoppingItem, number>
  mealPlans!: Table<MealPlanEntry, number>
  todayList!: Table<TodayListItem, number>

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
    // バージョン3: 在庫ボード（ざっくり在庫）テーブルを追加
    this.version(3).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
      pantryItems: '++id, name',
    })
    // バージョン4: 買い物メモ（確定済みの項目だけを保存）テーブルを追加
    this.version(4).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
    })
    // バージョン5: 週間献立プランナー用テーブルを追加（[date+slot]で1枠1件を検索）
    this.version(5).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
    })
    // バージョン6: 「今日の献立」＝今日つくるリストのテーブルを追加
    this.version(6).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId',
    })
    // バージョン7: todayListにaddedAtの索引が抜けていた不具合を修正
    // （orderBy('addedAt')がインデックス無しのフィールドを指定していたため
    //   ホーム・献立タブが白画面になっていた。versionは上書きせず新規追加する）
    this.version(7).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
    })
  }
}

export const db = new UchiRecipeDB()
