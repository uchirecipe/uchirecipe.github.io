/** 手間レベル: 超簡単 / ふつう / 手の込んだ */
export type EffortLevel = 'easy' | 'normal' | 'fancy'

/** 材料1行分 */
export interface Ingredient {
  name: string
  /** 分量。"3" のような数字なら人数換算の対象、"少々" などはそのまま表示 */
  amount: string
  unit: string
  /** 価格（円・任意） */
  price?: number
}

/** 手順1つ分。minutes があれば将来タイマー化できる */
export interface Step {
  text: string
  minutes?: number
}

/** 「作った！」の記録 */
export interface CookedLog {
  /** YYYY-MM-DD 形式 */
  date: string
  note?: string
}

/** レシピ本体（IndexedDB に保存される形） */
export interface Recipe {
  id?: number
  title: string
  /** 長辺1200pxに縮小済みの写真 */
  photo?: Blob
  servings: number
  cookMinutes?: number
  effortLevel: EffortLevel
  tags: string[]
  ingredients: Ingredient[]
  steps: Step[]
  sourceUrl?: string
  memo?: string
  isFavorite: boolean
  cookedLogs: CookedLog[]
  /**
   * 検索用キーワード（料理名・材料名・タグをひらがな化したもの）。
   * 「玉ねぎ」「タマネギ」「たまねぎ」のゆらぎを吸収するために保存時に自動生成する。
   */
  searchWords: string[]
  /** 同梱の基本レシピなら true（将来の件数制限のカウント外にする） */
  isStarter?: boolean
  createdAt: number
  updatedAt: number
}

/** テーマ設定: 端末に合わせる / ライト固定 / ダーク固定 */
export type ThemeSetting = 'auto' | 'light' | 'dark'

/** アプリ全体の設定（1件だけ保存する） */
export interface Settings {
  /** 常に 1（設定は1レコードだけ） */
  id?: number
  /** NG食材（アレルギー・苦手）。ここに載る食材を含むレシピに警告を出す */
  ngIngredients: string[]
  /** 料理中に画面を暗くしない（レシピ詳細を開いている間） */
  keepScreenOn: boolean
  theme: ThemeSetting
  /** 基本レシピの初回投入が済んでいるか */
  starterSeeded: boolean
  /** 基本レシピを一覧・ホームに出さない */
  hideStarters: boolean
  /** 最後にバックアップを書き出した日時（ミリ秒） */
  lastBackupAt?: number
}

export const defaultSettings: Settings = {
  id: 1,
  ngIngredients: [],
  keepScreenOn: false,
  theme: 'auto',
  starterSeeded: false,
  hideStarters: false,
}

/** 登録・編集フォームから受け取る入力（派生フィールドは含まない） */
export type RecipeInput = Pick<
  Recipe,
  | 'title'
  | 'photo'
  | 'servings'
  | 'cookMinutes'
  | 'effortLevel'
  | 'tags'
  | 'ingredients'
  | 'steps'
  | 'sourceUrl'
  | 'memo'
>
