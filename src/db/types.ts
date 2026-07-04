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
  /** ひとことメモ（任意。例: 「なければ玉ねぎでも可」） */
  memo?: string
}

/** 手順1つ分。minutes があれば将来タイマー化できる */
export interface Step {
  text: string
  minutes?: number
  /** ひとことメモ（任意。例: 「焦げやすいので注意」） */
  memo?: string
}

/**
 * プレースホルダーアイコンの種類。
 * 料理名・材料から自動で選ぶが、編集画面で手動指定もできる。
 */
export type IconKey =
  | 'rice'
  | 'noodle'
  | 'bread'
  | 'soup'
  | 'salad'
  | 'fish'
  | 'egg'
  | 'chicken'
  | 'meat'
  | 'dessert'
  | 'drink'
  | 'default'

/** 「作った！」の記録 */
export interface CookedLog {
  /** YYYY-MM-DD 形式 */
  date: string
  note?: string
}

/** 季節タグ（任意）。ホームの提案がこれを見て今の季節のレシピを優先する */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all'

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
  /** プレースホルダーアイコンの手動指定（未指定なら料理名・材料から自動選択） */
  iconKey?: IconKey
  /** 写真があっても、一覧・詳細でアイコン表示を優先する */
  showIconInsteadOfPhoto?: boolean
  /** 季節（任意）。未指定は「季節を問わない」として扱う */
  season?: Season
  createdAt: number
  updatedAt: number
}

/**
 * 在庫の3段階（ざっくり在庫）。数量は数えず「ある/少ない/ない」だけを管理し、
 * 自動計算と実際の中身がズレる問題を仕組みごと避ける。
 */
export type PantryLevel = 'have' | 'low' | 'none'

/** 在庫ボードの1食材分（よく使う食材をタップで3段階切替） */
export interface PantryItem {
  id?: number
  name: string
  level: PantryLevel
  /** 在庫ボードに表示するか（外した食材は非表示にする） */
  isFrequent: boolean
}

/** 献立の枠: 朝/昼/夜 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

/** 週間献立の1枠分（日付＋枠にレシピを割り当てる） */
export interface MealPlanEntry {
  id?: number
  /** YYYY-MM-DD */
  date: string
  slot: MealSlot
  recipeId: number
}

/**
 * 買い物メモの1項目。
 * レシピから作る「候補」はDBに保存せず画面上だけで検討し、
 * ユーザーが確定した項目だけがここに保存される（自動任せにしない設計）。
 */
export interface ShoppingItem {
  id?: number
  name: string
  amount?: string
  isChecked: boolean
  /** 並び順（上へ/下へ移動で隣の項目と入れ替える） */
  order: number
  /** どのレシピから来たか（複数レシピで材料が重複した場合の合算元） */
  fromRecipeIds?: number[]
}

/** テーマ設定: 端末に合わせる / ライト固定 / ダーク固定 / ブラウン固定 */
export type ThemeSetting = 'auto' | 'light' | 'dark' | 'brown'

/** ホーム画面に置ける表示パーツ */
export type HomeWidgetKey = 'mealPlan' | 'suggestion' | 'ingredientSearch' | 'pantry' | 'history'

/** 標準の表示パーツ構成（すべて表示・この並び順） */
export const defaultHomeWidgets: HomeWidgetKey[] = [
  'mealPlan',
  'suggestion',
  'ingredientSearch',
  'pantry',
  'history',
]

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
  /** タイマー音の全体ON/OFF（個別ミュートとは別に、これがOFFなら全タイマーが無音） */
  timerSoundEnabled: boolean
  /** 週の食費予算（円・任意）。献立プランナーで概算食費と比較する */
  weeklyBudget?: number
  /** ホーム画面に表示するパーツと並び順（配列に無いものは非表示） */
  homeWidgets: HomeWidgetKey[]
}

export const defaultSettings: Settings = {
  id: 1,
  ngIngredients: [],
  keepScreenOn: false,
  theme: 'auto',
  starterSeeded: false,
  hideStarters: false,
  timerSoundEnabled: true,
  homeWidgets: defaultHomeWidgets,
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
  | 'iconKey'
  | 'showIconInsteadOfPhoto'
  | 'season'
>
