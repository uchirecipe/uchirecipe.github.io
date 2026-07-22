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
  | 'pasta'
  | 'noodle'
  | 'bread'
  | 'soup'
  | 'salad'
  | 'vegetable'
  | 'tofu'
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
  /**
   * 記録につけた写真（任意・1枚。2026-07-12写真添付）。保存前に長辺1280px・
   * JPEG品質0.8に圧縮する（logic/image.ts の resizePhoto）。
   * バックアップへの包含は既定OFF（ファイル肥大を避けるため。設定画面のチェックボックスでONにできる）
   */
  photo?: Blob
  /**
   * 記録フォームを開いた時点の詳細画面の表示人数（人数スケール後。2026-07-12人数の自動入力）。
   * 「何人分作ったか」を残すための記録用の値で、表示・スケール計算には使わない
   */
  servings?: number
}

/** 季節タグ（任意）。ホームの提案がこれを見て今の季節のレシピを優先する */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all'

/**
 * 料理の種別（任意・2026-07-13献立の主菜+副菜提案精度向上対応）。
 * 献立プランナーの自動提案でこれがあれば最優先で使う（logic/mealPlan.tsのisMainCandidate/
 * isSideCandidate）。未設定のレシピ（主にユーザー自作）は現行のタグヒューリスティックに
 * フォールバックする（既存挙動を壊さない）。dessertはどちらの提案プールにも入らない
 */
export type DishType = 'main' | 'side' | 'soup' | 'dessert'

/** レシピ本体（IndexedDB に保存される形） */
export interface Recipe {
  id?: number
  title: string
  /**
   * ひとこと説明（任意。2026-07-13）。料理名だけでは中身が想像しにくい料理
   * （例: ヨーグルトバーク）向けに、詳細画面で料理名の直下に1〜2文だけ表示する
   */
  intro?: string
  /** 長辺1200pxに縮小済みの写真 */
  photo?: Blob
  servings: number
  cookMinutes?: number
  effortLevel: EffortLevel
  tags: string[]
  /** 料理の種別（任意）。未設定は献立提案でタグヒューリスティックにフォールバックする */
  dishType?: DishType
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
  /**
   * ワンポイント（任意・2026-07メモ2区画化）。こつ・知識・豆知識など、
   * 「知っているとよりおいしく作れる」情報向け。詳細画面ではメモより先に表示する。
   * 既存レシピのmemoはこちらに移行しない（既存データ破壊なしのため、既存のmemoは
   * すべて従来どおり「メモ」側に残り、onePointは未設定＝空のまま）
   */
  onePoint?: string
  /**
   * メモ（任意）。保存方法・注意書き・安全（保存日数・沸騰再加熱・交差汚染・
   * 半熟の対象者案内・弁当・冷凍等）向け。詳細画面ではワンポイントの後に表示する
   */
  memo?: string
  isFavorite: boolean
  cookedLogs: CookedLog[]
  /**
   * 検索用キーワード（料理名・材料名・タグをひらがな化したもの）。
   * 「玉ねぎ」「タマネギ」「たまねぎ」のゆらぎを吸収するために保存時に自動生成する。
   */
  searchWords: string[]
  /**
   * 検索キーワード（任意・ユーザー入力）。一覧・詳細には表示せず、検索のヒット対象にのみ使う
   * （別名・表記ゆれ・気分語などをタグに出さずに検索だけ効かせたいときのための欄）。
   * logic/kana.ts の buildSearchWords がひらがな正規化して searchWords へ合流させる。
   */
  keywords?: string[]
  /** 同梱の基本レシピなら true（将来の件数制限のカウント外にする） */
  isStarter?: boolean
  /** 配布レシピセットから読み込んだ場合、そのセットのID（例: "kintore"） */
  sourceSetId?: string
  /** 配布レシピセットから読み込んだ場合、そのセットの表示名（例: "高たんぱくごはん"） */
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

/**
 * 献立1品の役割: 主菜/副菜（2026-07-13 献立の主菜+副菜構成対応）。
 * 同じ日×枠に主菜1件+副菜1件（またはそれ以上）を並べて登録できるようにするための区分
 */
export type MealRole = 'main' | 'side'

/**
 * 週間献立の1品分（日付＋枠にレシピを割り当てる）。
 * 同じ日×枠に複数件登録できる（例: 夕食の主菜+副菜。2026-07-13対応）。
 */
export interface MealPlanEntry {
  id?: number
  /** YYYY-MM-DD */
  date: string
  slot: MealSlot
  recipeId: number
  /**
   * 主菜/副菜の区分（任意）。未設定の既存データ（2026-07-13より前に保存された行）は
   * 主菜として扱う（後方互換）。新規追加時は必ずどちらかを設定する
   */
  role?: MealRole
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

/** テーマ設定: 端末に合わせる / ライト固定 / ダーク固定 / ブラウン固定 / グリーン固定 */
export type ThemeSetting = 'auto' | 'light' | 'dark' | 'brown' | 'green'

/**
 * ホーム画面に置ける表示パーツ。
 * 2026-07-16 便S: 「在庫ボードを見る・編集する」(旧'pantry')はホームから削除（食材タブへの
 * 導線はタブナビで足りるため）。'pantry'という値自体は過去にsettings.homeWidgetsへ保存された
 * ままの端末がありうるため型からは外すが、db/settings.ts の getSettings() で未知キーとして
 * 安全に無視する（除去はしない＝ユーザーの並び順を書き換えない）
 */
export type HomeWidgetKey = 'mealPlan' | 'suggestion' | 'ingredientSearch' | 'history'

/** 標準の表示パーツ構成（すべて表示・この並び順） */
export const defaultHomeWidgets: HomeWidgetKey[] = [
  'mealPlan',
  'suggestion',
  'ingredientSearch',
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
  /**
   * 検索インデックス（searchWords）の反映バージョン。logic/kana.ts の SEARCH_INDEX_VERSION と
   * 食い違っていたら、起動時に全レシピのsearchWordsを再構築する。ingredientReadingsVersionとは
   * 別枠（カテゴリ辞書など、読み仮名辞書以外の理由でsearchWordsを作り直したい場合に使う）
   */
  searchIndexVersion: number
  /** Pro解錠コード（正規化済み・平文で保存。バックアップで復元されればPro状態も復元される） */
  proCode?: string
  /** Pro解錠日時（ミリ秒） */
  proActivatedAt?: number
  /**
   * 【廃止】追加レシピパック解錠コード。2026-07-22の全無料化(収録レシピは全て無料・有料はPro機能のみ)で
   * 追加レシピパック(UP-)は製品廃止した。新規に書き込むことはもう無いが、既存ユーザーのIndexedDBや
   * バックアップに残っていても壊れないよう、フィールド自体は読み取り互換のため残す(無視するだけ)。
   */
  recipePackCode?: string
  /** 【廃止】追加レシピパック解錠日時（ミリ秒）。recipePackCodeと同じく後方互換のため残す */
  recipePackActivatedAt?: number
  /** アプリ内お知らせで最後に見た（閉じた）お知らせのid。未読管理に使う */
  lastSeenNewsId?: string
  /**
   * 初回起動日時（ミリ秒・任意）。初日はお知らせバナーを出さない判定に使う。
   * この項目が導入される前からの既存ユーザーには 0（=とっくに初日を過ぎている扱い）を入れる
   */
  firstLaunchAt?: number
  /**
   * じぶんタイマー(自由な分数のタイマー)で最後に使った分数(2026-07-12・タイマー自由設定)。
   * 次回開くときの既定値にする。未設定(初回)は呼び出し側で3分を既定値として扱う。
   * 秒刻み対応(同日オーナー実機フィードバック)後は下のlastCustomTimerSecondsが優先され、
   * この項目は後方互換の読み取り専用フォールバックとして残す(新規書き込みはしない)
   */
  lastCustomTimerMinutes?: number
  /**
   * じぶんタイマーで最後に使った秒数(2026-07-12秒刻み対応)。±10秒/±30秒/±1分の調整後の値を
   * そのまま保存する。未設定なら呼び出し側でlastCustomTimerMinutes→なければ3分(180秒)を既定値にする
   */
  lastCustomTimerSeconds?: number
  /** 食材価格マスタ（頻出食材の目安価格）の初期投入が済んでいるか */
  priceMasterSeeded: boolean
  /**
   * 食材価格マスタの「目安/自分の価格」バッジ用フラグ(isDefault等)を、
   * 既存ユーザーの手持ちデータに1回だけ後付けする移行が済んでいるか（2026-07-12 UX改修）。
   * 済んでいなければ起動時にprices.tsのseedPriceDefaultsIfNeededが移行処理を行う
   */
  priceDefaultFlagsMigrated: boolean
  /**
   * 食材価格マスタに反映済みのPRICE_DEFAULTS版番号(2026-07-16 バージョン付きトップアップ移行)。
   * data/priceDefaults.tsのPRICE_DEFAULTS_VERSIONより低ければ、起動時にprices.tsの
   * seedPriceDefaultsIfNeededが「まだ無い項目だけ」を追加投入する。未設定（既存ユーザー含む）は
   * 0扱い（マイグレーション不要。この項目自体は任意のためスキーマ変更なしで運用できる）
   */
  priceDefaultsVersion?: number
  /**
   * レシピ一覧の表示形式（グリッド/リスト。2026-07-13 UI改善）。未設定（既存ユーザー含む）は
   * 従来どおりのグリッド表示として扱う
   */
  recipeListLayout?: RecipeListLayout
  /**
   * 献立タブ「日」を最後に自動取り込み(週プラン→今日の献立)した日付（YYYY-MM-DD・任意。
   * 2026-07-16 便U-3 Fable設計）。日タブを開くたびに今日の日付と比較し、一致していなければ
   * 表示中の食事帯の週プラン登録を今日の献立へ取り込み、
   * 「取り込み対象が1件以上あったとき」だけこの値を今日の日付に更新する
   * （対象0件の空振りでは記録しない＝あとで今日の分を計画すれば同じ日のうちでも取り込まれる）。
   * 一致していれば何もしない＝同じ日付につき1回だけ自動実行する歯止め
   * （ユーザーが取り込み後に消した品が同じ日のうちに再出現しないようにするため）。
   * 未設定（既存ユーザー含む）は「まだ一度も自動実行していない」扱いになる
   */
  lastAutoImportDate?: string
}

/** レシピ一覧の表示形式 */
export type RecipeListLayout = 'grid' | 'list'

/**
 * 削除した配布セット由来レシピの「再取込除外」記録（トゥームストーン。2026-07-13 Fable設計）。
 * 配布セット（テーマ）のレシピを削除したとき (setId, title) を残しておき、
 * 同じテーマの再取込（再読み込み）で削除した品が復活しないようにする。
 * 設定のテーマ一覧「除外中◯品・すべて戻す」で記録を消せば、次の取込で戻る
 */
export interface SetExclusion {
  id?: number
  /** 配布セットID（Recipe.sourceSetIdと同じ値。例: "kintore"） */
  setId: string
  /** 除外する品の料理名（セット内で一意。importRecipeSetの重複判定と同じくtitleで照合する） */
  title: string
  /** 記録した日時（ミリ秒） */
  excludedAt: number
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
  searchIndexVersion: 0,
  priceMasterSeeded: false,
  priceDefaultFlagsMigrated: false,
}

/**
 * 食材価格マスタの1件（「食材と価格」画面で編集する目安価格）。
 * 地域・店舗で差があるため、あくまで概算食費計算のフォールバック用の目安値として扱う。
 */
export interface PriceEntry {
  id?: number
  /** 食材名 */
  name: string
  /** 単価（円） */
  pricePerUnit: number
  /** 単価の基準（例:「100g」「1個」「1本」など、数量＋単位の自由記述） */
  unit: string
  /** 最終更新日時（ミリ秒） */
  updatedAt: number
  /**
   * PRICE_DEFAULTSから投入されたまま、価格・単位をユーザーが書き換えていない行か
   * （「食材と価格」画面の「目安」/「自分の価格」バッジに使う。2026-07-12 UX改修）。
   * ユーザーが新規追加した行や、価格/単位を一度でも編集した行は false（または未設定）になる
   */
  isDefault?: boolean
  /** isDefaultの行の元の目安値のスナップショット。「目安に戻す」ボタンの復元先 */
  defaultPricePerUnit?: number
  defaultUnit?: string
}

/**
 * 「ファイルに書き出す」の保存先ハンドル（File System Access API対応ブラウザのみ。
 * 2026-07-17バックアップ改修 修正2+3）。FileSystemFileHandleはJSON化できないため
 * バックアップ本体(BackupFile)には含めず、専用テーブルにオブジェクトのまま
 * structured cloneで保存する（IndexedDBのネイティブ機能。他ブラウザ間で共有されない・
 * 端末固有の値なのでバックアップの往復対象にもしない）。1件のみ保持し、新しく
 * 保存先を選ぶたびに置き換える（id固定=1）
 */
export interface BackupFileHandleRecord {
  id?: number
  handle: FileSystemFileHandle
  /** 記録した日時（ミリ秒）。参考表示用（任意） */
  savedAt: number
}

/**
 * 「読み込む（今のデータと置き換え）」実行前の自動退避（2026-07-17設定ゼロベース裁定#6b・
 * 三重の網の(b)）。exportBackup相当のJSON文字列をそのまま1世代だけ保持し、置き換え直後の
 * 「元に戻す」（restorePreImportSnapshot）で復元する。1件のみ保持し、次の置き換えのたびに
 * 上書きする（id固定=1。BackupFileHandleRecordと同じ流儀）。バックアップ本体には含めない
 * （端末内の一時的な安全網であり、往復対象のユーザーデータではないため）
 */
export interface PreImportSnapshotRecord {
  id?: number
  json: string
  savedAt: number
}

/** 登録・編集フォームから受け取る入力（派生フィールドは含まない） */
export type RecipeInput = Pick<
  Recipe,
  | 'title'
  | 'intro'
  | 'photo'
  | 'servings'
  | 'cookMinutes'
  | 'effortLevel'
  | 'tags'
  | 'dishType'
  | 'ingredients'
  | 'steps'
  | 'quickSteps'
  | 'quickCookMinutes'
  | 'sourceUrl'
  | 'onePoint'
  | 'memo'
  | 'iconKey'
  | 'showIconInsteadOfPhoto'
  | 'season'
  | 'suitableFor'
  | 'keywords'
>
