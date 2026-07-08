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
  /**
   * 合わせ調味料グループ番号（任意）。同じ番号の材料は先にまとめて計量してよい印として、
   * 詳細画面で同じ色の左ラインを表示する（logic/seasoningGroup.ts で番号→色を決める）
   */
  seasoningGroup?: number
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
  /**
   * 時短版の手順（任意。レンジ活用など、通常より手早く作る代替手順）。
   * ある場合のみ詳細画面に「通常/時短」の切り替えを表示する
   */
  quickSteps?: Step[]
  /** 時短版の合計時間（任意。未指定なら通常の cookMinutes を流用表示） */
  quickCookMinutes?: number
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
  /** 配布レシピセットから読み込んだ場合、そのセットのID（例: "kintore"） */
  sourceSetId?: string
  /** 配布レシピセットから読み込んだ場合、そのセットの表示名（例: "筋トレ・高たんぱくセット"） */
  sourceSetName?: string
  /** プレースホルダーアイコンの手動指定（未指定なら料理名・材料から自動選択） */
  iconKey?: IconKey
  /** 写真があっても、一覧・詳細でアイコン表示を優先する */
  showIconInsteadOfPhoto?: boolean
  /** 季節（任意）。未指定は「季節を問わない」として扱う */
  season?: Season
  /** 向いている時間帯（任意・複数可）。未指定は「制限なし」として扱う */
  suitableFor?: MealSlot[]
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
  /** 手動並び替えの順序（任意）。未指定の食材はid順（＝登録順）で表示する */
  sortOrder?: number
}

/**
 * 「今日の献立」＝今日つくるリストの1件分。
 * 週間プランナー（予定）とは別物で、その場で「今日これ作る」を管理する。
 * 日付フィールドを持たない＝作らなかった分は翌日も残る（「×」でいつでも外せる）。
 */
export interface TodayListItem {
  id?: number
  recipeId: number
  addedAt: number
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
  /** 在庫ボードへの「よく使う食材」プリセット投入が済んでいるか */
  pantryPresetSeeded: boolean
  /** 基本レシピを一覧・ホームに出さない */
  hideStarters: boolean
  /** 最後にバックアップを書き出した日時（ミリ秒） */
  lastBackupAt?: number
  /** タイマー音の全体ON/OFF（個別ミュートとは別に、これがOFFなら全タイマーが無音） */
  timerSoundEnabled: boolean
  /** タイマーが1本でも動作中は、どの画面を見ていても画面を暗くしない */
  timerWakeLockEnabled: boolean
  /** タイマーの制限（アプリを開いている間だけ通知・音が鳴る）の説明を初回に表示済みか */
  timerNoticeShown: boolean
  /** 週の食費予算（円・任意）。献立プランナーで概算食費と比較する */
  weeklyBudget?: number
  /** 献立タブに表示する食事帯（任意・未指定は朝昼夜すべて表示） */
  visibleMealSlots?: MealSlot[]
  /** ホーム画面に表示するパーツと並び順（配列に無いものは非表示） */
  homeWidgets: HomeWidgetKey[]
  /**
   * 食材名の読み仮名辞書（表記ゆれ対策）の反映バージョン。
   * logic/ingredientReadings.ts の READINGS_VERSION と食い違っていたら、
   * 起動時に全レシピのsearchWordsを再構築する（辞書追記のたびに追従させるため）。
   */
  ingredientReadingsVersion: number
  /** Pro解錠コード（正規化済み・平文で保存。バックアップで復元されればPro状態も復元される） */
  proCode?: string
  /** Pro解錠日時（ミリ秒） */
  proActivatedAt?: number
  /** 追加レシピパック解錠コード（Proとは別体系。同じ仕組みで検証する） */
  recipePackCode?: string
  /** 追加レシピパック解錠日時（ミリ秒） */
  recipePackActivatedAt?: number
  /** アプリ内お知らせで最後に見た（閉じた）お知らせのid。未読管理に使う */
  lastSeenNewsId?: string
  /**
   * 初回起動日時（ミリ秒・任意）。初日はお知らせバナーを出さない判定に使う。
   * この項目が導入される前からの既存ユーザーには 0（=とっくに初日を過ぎている扱い）を入れる
   */
  firstLaunchAt?: number
}

export const defaultSettings: Settings = {
  id: 1,
  ngIngredients: [],
  keepScreenOn: false,
  theme: 'auto',
  starterSeeded: false,
  pantryPresetSeeded: false,
  hideStarters: false,
  timerSoundEnabled: true,
  timerWakeLockEnabled: true,
  timerNoticeShown: false,
  homeWidgets: defaultHomeWidgets,
  ingredientReadingsVersion: 0,
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
  | 'quickSteps'
  | 'quickCookMinutes'
  | 'sourceUrl'
  | 'memo'
  | 'iconKey'
  | 'showIconInsteadOfPhoto'
  | 'season'
  | 'suitableFor'
>
