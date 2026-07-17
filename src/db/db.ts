import Dexie, { type Table } from 'dexie'
import type {
  BackupFileHandleRecord,
  MealPlanEntry,
  PantryItem,
  PreImportSnapshotRecord,
  PriceEntry,
  Recipe,
  SetExclusion,
  Settings,
  ShoppingItem,
  TodayListItem,
} from './types'

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
  prices!: Table<PriceEntry, number>
  setExclusions!: Table<SetExclusion, number>
  fileHandles!: Table<BackupFileHandleRecord, number>
  preImportSnapshots!: Table<PreImportSnapshotRecord, number>

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
    // バージョン8: recipesにsourceSetIdの索引を追加
    // （配布セット=テーマ由来のレシピをテーマ単位でまとめて検索・削除する機能のため。既存データはそのまま引き継がれる）
    this.version(8).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
    })
    // バージョン9: 食材価格マスタ（頻出食材の目安価格）テーブルを追加
    // （既存のレシピ・設定等はそのまま引き継がれる。新規テーブルのみの追加なのでupgrade関数は不要）
    this.version(9).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
      prices: '++id, name, updatedAt',
    })
    // バージョン10: 献立を「1枠=1件」から「1枠=主菜+副菜（複数件）」に拡張（2026-07-13）。
    // mealPlansに任意フィールド role('main'|'side')を追加したが、Dexieのインデックス定義に
    // roleを含めない（絞り込みに使わないため不要）ので、ストア定義はバージョン9と同一。
    // [date+slot]はもともとunique指定（&プレフィックス）ではなかったため、同じ日×枠に
    // 複数行を保存してもDexie側の制約に引っかからない。既存の行はrole未設定のまま残り、
    // アプリ側で「role未設定=主菜」として扱う（後方互換）。バージョンのみ上げて設計変更を記録する
    this.version(10).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
      prices: '++id, name, updatedAt',
    })
    // バージョン11: 削除した配布セット由来レシピの「再取込除外」記録（トゥームストーン）テーブルを
    // 追加（2026-07-13 Fable設計）。配布セットのレシピを削除しても記録が残らず、テーマ再取込で
    // 復活してしまう問題への対応。新規テーブルのみの追加で既存データには影響しない（upgrade関数不要）
    this.version(11).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
      prices: '++id, name, updatedAt',
      setExclusions: '++id, setId, title',
    })
    // バージョン12: 「ファイルに書き出す」の保存先ハンドル（File System Access API対応ブラウザの
    // 「前回の場所に上書き」用。2026-07-17バックアップ改修 修正2+3）を保存するテーブルを追加。
    // 新規テーブルのみの追加で既存データには影響しない（upgrade関数不要）
    this.version(12).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
      prices: '++id, name, updatedAt',
      setExclusions: '++id, setId, title',
      fileHandles: 'id',
    })
    // バージョン13: 「読み込む（今のデータと置き換え）」実行前の自動退避（2026-07-17設定
    // ゼロベース裁定#6b・三重の網の(b)）を保存するテーブルを追加。新規テーブルのみの追加で
    // 既存データには影響しない（upgrade関数不要）
    this.version(13).stores({
      recipes: '++id, title, *tags, *searchWords, updatedAt, sourceSetId',
      settings: 'id',
      pantryItems: '++id, name',
      shoppingItems: '++id, order',
      mealPlans: '++id, date, [date+slot]',
      todayList: '++id, recipeId, addedAt',
      prices: '++id, name, updatedAt',
      setExclusions: '++id, setId, title',
      fileHandles: 'id',
      preImportSnapshots: 'id',
    })
  }
}

export const db = new UchiRecipeDB()
