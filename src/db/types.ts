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

/** 季節タグ（任意）。献立の「今日なに作る？」がこれを見て今の季節のレシピを優先する */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter' | 'all'

/**
 * 料理の種別（任意・2026-07-13献立の主菜+副菜提案精度向上対応）。
 * 献立プランナーの自動提案でこれがあれば最優先で使う（logic/mealPlan.tsのisMainCandidate/
 * isSideCandidate）。未設定のレシピ（主にユーザー自作）は現行のタグヒューリスティックに
 * フォールバックする（既存挙動を壊さない）。dessertはどちらの提案プールにも入らない
 */
export type DishType = 'main' | 'side' | 'soup' | 'dessert'

/**
 * レシピを削除したあとも端末に残る「作った記録」のまとまり（削除したレシピ1品ぶん。
 * 2026-08-16 便GZ・オーナー承認「レシピカードは削除されるが記録は読める」）。
 *
 * なぜ別のテーブルなのか: 記録（cookedLogs）はレシピの中の配列なので、レシピを消すと
 * 記録も写真も一緒に消えていた。削除の直前にここへ移し替えることで、カードも詳細画面も
 * 無くなったあとに「いつ・何を作ったか」「そのときの写真・ひとことメモ」だけが残る。
 *
 * recipeUid を持つのが要点（オーナーの懸念「似た名前の違うレシピとつながってしまいそう」への答え）。
 * 結び直しは **recipeUid の完全一致のときだけ** 行い、料理名では絶対に結ばない。
 * title は画面に料理名を出すための写しで、照合には一切使わない。
 */
export interface DetachedCookedRecord {
  id?: number
  /**
   * 削除したレシピの一意の印（Recipe.uid の写し）。同じ印を持つレシピが端末に入り直したときだけ
   * 記録を結び直す。印を持たない古いバックアップ由来のレシピを消した場合は undefined になり、
   * その記録は二度と自動では結ばれない（推測で別のレシピにつながないため）。
   */
  recipeUid?: string
  /** 削除した時点の料理名（記録の一覧・カレンダーに出す表示用。照合には使わない） */
  title: string
  /** 削除した時点のアイコン指定（写真の無い記録の絵柄を削除前と同じにするため） */
  iconKey?: IconKey
  /** 削除した時点の「何人分のレシピか」（記録に食数が入っていないときの表示の手がかり） */
  servings?: number
  /** 残す「作った！」の記録（写真もこの中に入っている） */
  logs: CookedLog[]
  /** レシピを削除した日時 */
  detachedAt: number
}

/** レシピ本体（IndexedDB に保存される形） */
export interface Recipe {
  id?: number
  /**
   * このレシピを一意に指す印（2026-08-16 便GZ）。id は端末ごとの連番なので、
   * 別の端末・別のファイル同士では同じ番号が違う料理を指す。書き出したファイルから
   * 入れ直したときに「作った記録」を正しい料理へ結び直すには、端末をまたいでも
   * ぶつからない印が要る。
   *
   * 中身: 同梱の基本レシピは `starter:<料理名>`（アプリが配る品なので、入れ直しでも同じ印になる）、
   * それ以外は作成時に振る乱数（crypto.randomUUID）。
   *
   * 任意項目にしてあるのは、この対応より前に保存された既存データを壊さないため
   * （起動時に db/recipeUid.ts の backfillRecipeUids が印の無いレシピにだけ後から振る）。
   */
  uid?: string
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

/**
 * 在庫チップの大分類グループ（2026-07-23 オーナー実機FB #1・食材/買い物UX）。
 * 通常表示でこのグループごとにチップをまとめる。自動振り分けの情報源は
 * 栄養データベース（scripts/nutrition-foods.mjs の分類）＝logic/pantryGroups.ts。
 * PantryItem.group が未設定の食材は名前から自動判定し、判定できない食材は 'other'。
 */
export type PantryGroupKey = 'meatFish' | 'vegetable' | 'soyEgg' | 'staple' | 'seasoning' | 'other'

/** 在庫ボードの1食材分（よく使う食材をタップで3段階切替） */
export interface PantryItem {
  id?: number
  name: string
  level: PantryLevel
  /** 在庫ボードに表示するか（外した食材は非表示にする） */
  isFrequent: boolean
  /** 手動並び替えの順序（任意）。未指定の食材はid順（＝登録順）で表示する */
  sortOrder?: number
  /**
   * 大分類グループの手動指定（任意・2026-07-23）。未設定なら名前から自動判定する
   * （logic/pantryGroups.ts）。ユーザーが整理モードでグループを変えたときだけ入る。
   * 任意項目なのでスキーマ変更・マイグレーションは不要。
   */
  group?: PantryGroupKey
  /**
   * 3段階だけでは判断しにくい食材に添える、任意の一言メモ（20字まで・2026-07-29 便CC/C8）。
   * 例:「あと2個」「開封済み」。**表示専用**で、検索・買い物候補・在庫反映・並び替えの
   * どのロジックにも渡さない（数量管理を持ち込まない＝「数は数えず、ざっくり」の設計を保つ）。
   * 任意項目なのでスキーマ変更・マイグレーションは不要。
   */
  note?: string
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
  /**
   * 週の予定からの自動取り込み（便U-3）で入った品だけに付く印（2026-08-03 便DP）。
   *
   * 付ける理由: 週の予定を消したあと、その品が今日の献立に「レシピ一覧から選択中」として
   * 取り残されるバグを直すため。自分でレシピ一覧から足した品と、予定の写しとして自動で
   * 入った品を、消してよいかどうかで区別する必要がある（自動で入った品だけを、予定が
   * 消えたときに一緒に片付ける）。
   *
   * 任意項目なので既存データはそのまま動く（印の無い品＝自分で足した扱いで、勝手に消さない）。
   */
  fromPlan?: boolean
}

/** 献立の枠: 朝/昼/夜 */
export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

/**
 * 献立1品の役割: 主菜/副菜/汁物/その他（2026-07-13 献立の主菜+副菜構成対応 →
 * 2026-08-02 便DE-4 オーナー指示で汁物・その他を追加）。
 * 同じ日×枠に主菜1件+副菜1件（またはそれ以上）を並べて登録できるようにするための区分で、
 * 区分の名前と並びはレシピ登録の「料理の種別」（DishType・ja.dishType）とそろえてある
 * （画面ごとに違う言葉で同じ分類を出さない）。
 *
 * 自動提案（まとめて献立を立てる・行のサイコロのペア提案）が扱うのは従来どおり主菜と副菜だけ。
 * 汁物・その他は「＋料理を追加」で自分で足す行で、勝手に増えたり消えたりしない。
 */
export type MealRole = 'main' | 'side' | 'soup' | 'other'

/** 献立の役割の並び（画面の行順・並べ替えのランクに使う。ja.mealPlan.role と同じ並び） */
export const MEAL_ROLES: MealRole[] = ['main', 'side', 'soup', 'other']

/**
 * 自動提案（まとめて献立を立てる・ペア提案）が埋める役割（2026-08-02 便DE-4）。
 * 汁物・その他は自動で入れない＝planWeekFill が触る役割をここに固定する。
 */
export const AUTO_FILL_ROLES = ['main', 'side'] as const
export type AutoFillRole = (typeof AUTO_FILL_ROLES)[number]

/**
 * 自動提案の「目的」（2026-08-02 便CP-2・docs/62 決定②。Pro機能）。
 * ユーザーが「今週はこの軸で組みたい」を指定すると、提案が同じ枠を数回引き直して
 * その軸に最も沿う組み合わせを採る（docs/60 第2段の引き直し方式）。
 *  - 'protein'  … たんぱく質多め（1人分のたんぱく質が多い組み合わせを採る）
 *  - 'lowSalt'  … 塩分ひかえめ（1人分の食塩相当量が少ない組み合わせを採る）
 * 未指定（undefined）は従来どおりの提案＝引き直しをしない（k=1で現行と完全に等価）。
 *
 * 2026-08-07 便DT-9（オーナー指示）で軸を8つへ広げた。「多め」4つ（たんぱく質・食物繊維・鉄・
 * カルシウム）と「ひかえめ」4つ（エネルギー・脂質・炭水化物・塩分）で、どれも
 * logic/nutrition.ts の NutrientTotals にすでにある項目だけを使う（新しい計算は足していない）。
 * **既存の 'protein' / 'lowSalt' の値はそのまま残す**＝設定・献立に保存済みの目的が読めなくなる
 * マイグレーションを起こさない（新フィールドは任意項目にして既存データを壊さない、と同じ作法）。
 *
 * 「バランスの良い」「不足しています」等の断定はしない。あくまで
 * 「たんぱく質が多めになる組み合わせを選ぶ」という選び方の指定であり、
 * 栄養指導・目標達成の約束ではない（logic/nutritionBalance.ts 冒頭の規律に従う）。
 */
export type MealPurpose =
  | 'protein'
  | 'fiber'
  | 'iron'
  | 'calcium'
  | 'lowEnergy'
  | 'lowFat'
  | 'lowCarb'
  | 'lowSalt'

/**
 * 「多め」を狙う目的（値が大きいほど目的に沿う）。
 * この2本の配列が目的の分類の唯一の正で、ペナルティの向き（logic/nutritionBalance.ts の
 * purposePenalty）も画面の並び（MealPlanPage の2群表示）もここから引く。
 */
export const MORE_MEAL_PURPOSES = ['protein', 'fiber', 'iron', 'calcium'] as const satisfies readonly MealPurpose[]

/** 「ひかえめ」を狙う目的（値が小さいほど目的に沿う） */
export const LESS_MEAL_PURPOSES = ['lowEnergy', 'lowFat', 'lowCarb', 'lowSalt'] as const satisfies readonly MealPurpose[]

/** 目的の選択肢（UIの並び順もこの順。'none'に当たる「指定なし」は undefined で表す） */
export const MEAL_PURPOSES: MealPurpose[] = [...MORE_MEAL_PURPOSES, ...LESS_MEAL_PURPOSES]

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
  /**
   * 「まとめて献立を立てる」(自動提案)が入れた枠か（任意・2026-07-22 便BE）。
   * true=自動提案由来、未設定/false=手動配置（ピッカー選択・行サイコロ・食い違い解消チップ等
   * ユーザーが自分で置いた枠）。「まとめて献立を立てる」を再度押したとき、自動提案由来の枠だけを
   * 埋め直し、手動配置は残す（＝手動で入れた献立を無警告で上書きしない）ために使う。
   * 未設定（この項目導入前の既存データを含む）は手動扱い＝保護する側に倒す（非破壊が既定）。
   */
  auto?: boolean
  /**
   * この枠を自動提案が入れたときに指定されていた「目的」（任意・2026-08-02 便CP-2・docs/62 決定②）。
   * 月タブの「答え合わせ」（目的を指定して組んだ日が何日あり、その日の数字がどうだったか）を
   * 事実として出すためだけに残す記録で、提案のやり直しには使わない。
   * 手動配置・目的なしの自動配置には付かない（未設定＝目的を指定せずに置いた枠）。
   */
  purpose?: MealPurpose
  /**
   * この枠を何人分作るか（任意・2026-08-03 便DJ・オーナー指示）。
   *
   * 未設定＝そのレシピに登録されている人数分（Recipe.servings）で作る、という既定の扱い。
   * 既存データは全て未設定なので、この項目が増えても見え方も計算結果も変わらない
   * （任意項目なのでスキーマ変更・マイグレーションも不要）。
   *
   * 意味は「作る量の記録」だけに限る。栄養と食費の「1人分」の表示は、何人分作っても
   * 1人が食べる量は1人分のままなので**この値では変えない**（logic/nutrition.ts の perServing、
   * logic/nutritionBalance.ts の1人分集計はいずれもこの値を見ない）。
   * 効くのは買い物メモへ渡す材料の分量だけ（MealPlanPage goShopping → ShoppingPage）。
   *
   * 範囲は人数分と同じ1〜20（logic/servings.ts clampServings）。
   */
  servings?: number
}

/**
 * 日付メモ（2026-07-29 便CB-1・docs/59 A-2）。レシピに紐付かない、その日1行の自由メモ
 * （「外食」「実家」「お弁当いる」など）。週タブの各日カードと月タブの日モーダルで編集する。
 *
 * 献立（mealPlans）に相乗りさせず専用テーブルにした理由:
 * mealPlansの1行は必ず recipeId を持つ「料理1品」で、日付・食事帯・役割の集計対象
 * （月セルの予定プレビュー・食費・栄養・買い物リスト・まとめて献立の保護判定）になる。
 * メモは「その日レシピを1品も登録していない日」にこそ必要（外食の日など）なので、
 * mealPlansへ入れるとダミーのrecipeIdを持つ行が必要になり、上記の集計すべてを汚す。
 * 日付を主キーにした別テーブルなら1日1件が構造で保証でき、既存データにも一切触らない
 * （新規テーブルの追加だけ＝マイグレーション不要）。
 */
export interface DayNote {
  /** YYYY-MM-DD（主キー。1日1件） */
  date: string
  /** 1行メモの本文（空文字は保存せず行ごと削除する） */
  text: string
  /** 最終更新日時（ミリ秒） */
  updatedAt: number
}

/**
 * 献立のロック（2026-08-08 便DX・オーナー指示）。1行＝「その日のその食事は自動の一括操作で
 * 触らない」という印。鍵が掛かっている食事は
 *   ・まとめて献立を入力（空き枠だけ／レシピを総入れ替えの両方）
 *   ・テンプレートを適用
 *   ・先週の献立をコピー
 *   ・まとめて空にする
 * の対象から外れる。手での追加・差し替え・削除は鍵が掛かっていても自由
 * （鍵は「自分で決めた献立を自動入力から守る」ためのもので、編集の禁止ではない）。
 *
 * 献立（mealPlans）に相乗りさせず専用テーブルにした理由（DayNoteと同じ考え方）:
 * 鍵は**まだ料理が1品も入っていない食事にも掛けられる**必要がある（「金曜の夕食は自分で
 * 決めるから自動で入れないで」）。mealPlansの1行は必ず recipeId を持つ「料理1品」なので、
 * 空の食事の鍵を持てない。日付＋食事を主キーにした別テーブルなら1食1件が構造で保証でき、
 * 既存データにも一切触らない（新規テーブルの追加だけ＝マイグレーション不要を保つ）。
 *
 * 粒度は「日付×食事」の1階層だけにしている。画面の2階層（日ごと／時間帯ごと）のうち
 * 「日ごと」は、その日の朝食・昼食・夕食3件をまとめて掛け外しする操作として表す
 * （logic/mealPlan.ts の isDayMealLocked / planDayLockToggle）。日ごとの記録を別に持つと
 * 「日は解錠・夕食だけ施錠」のときにどちらが勝つのかという優先関係が生まれるが、
 * 1階層にすればその判断自体が要らなくなる（鍵は掛かっているか掛かっていないかだけ）。
 */
export interface MealPlanLock {
  /** 主キー。'YYYY-MM-DD|slot'（logic/mealPlan.ts の mealLockKey が組み立てる） */
  key: string
  /** YYYY-MM-DD（期間で読み出すための索引） */
  date: string
  slot: MealSlot
  /** 鍵を掛けた日時（ミリ秒） */
  lockedAt: number
}

/**
 * マイ献立テンプレの1品（2026-07-29 便CB-2・docs/59 A-1＋B-2）。
 *
 * 日付ではなく「曜日」で持つのがこの型の要。テンプレは別の週・別の月へ流し込むものなので、
 * 保存元の日付を持っていても意味がない。曜日で持つことで
 *  ①1週間まるごと別の週へ流し込む（A-1）
 *  ②「金曜だけ」を選んで月の全部の金曜へ流し込む＝毎週◯曜はカレー（B-2）
 * が同じデータ構造の使い分けだけで実現できる（B-2に専用の繰り返し設計を足さない）。
 */
export interface MealTemplateItem {
  /** 月曜始まりの曜日（0=月 … 6=日。logic/mealPlan.ts の dowIndex と同じ並び） */
  dow: number
  slot: MealSlot
  role: MealRole
  recipeId: number
}

/**
 * マイ献立テンプレ（2026-07-29 便CB-2・docs/59 A-1）。「お気に入りの1週間」に名前を付けて
 * 端末内に保存し、別の週や月へ流し込む。複数保存できる（平日用・週末用など）。
 * 端末内保存で完結する（docs/59 C-3: クラウド同期前提のテンプレ配信はやらない）。
 *
 * 献立（mealPlans）とは別テーブルにする理由: mealPlansの1行は必ず実在の日付を持つ「予定」で、
 * 食費・栄養・買い物リスト・月セルの集計対象になる。テンプレは日付を持たない雛形なので、
 * 同じテーブルに混ぜるとそれらの集計をすべて汚す。新規テーブルの追加だけなので既存データには
 * 一切触れない（マイグレーション不要を保つ）。
 */
export interface MealTemplate {
  id?: number
  /** 利用者が付けた名前（例:「平日の定番」） */
  name: string
  /** 中身（曜日×食事×役割の料理。空のテンプレは保存しない） */
  items: MealTemplateItem[]
  /** 保存日時（ミリ秒）。一覧の並び順に使う */
  createdAt: number
}

/**
 * 買い物メモの1項目。
 * レシピから作る「候補」はDBに保存せず画面上だけで検討し、
 * ユーザーが確定した項目だけがここに保存される（自動任せにしない設計）。
 */
/**
 * 買い物メモの1行が「どのレシピから、どれだけ来たか」の1件分
 * （2026-08-08 オーナー実機フィードバック②「どのレシピから登録したのか確認できるように」）。
 * amount は買い物メモに入れた時点の食数で計算済みの分量（そのレシピが出した分だけ）。
 * 分量が空・未設定のときは、表示側でそのレシピの材料欄から読み直す。
 */
export interface ShoppingItemSource {
  recipeId: number
  /** そのレシピが出した分量（例:「200g」）。空なら表示側がレシピの材料欄から読む */
  amount?: string
}

export interface ShoppingItem {
  id?: number
  name: string
  amount?: string
  isChecked: boolean
  /** 並び順（上へ/下へ移動で隣の項目と入れ替える） */
  order: number
  /** どのレシピから来たか（複数レシピで材料が重複した場合の合算元） */
  fromRecipeIds?: number[]
  /**
   * どのレシピから、どれだけ来たか（任意・2026-08-08 オーナー実機フィードバック②）。
   * fromRecipeIds はレシピの並びしか持っておらず、「そのレシピでの分量」が出せなかったため、
   * 買い物メモに入れる時点の計算結果をレシピごとに残す。
   * 未設定（この項目より前に作った既存の行）は fromRecipeIds から読み、分量はレシピの材料欄で補う。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  fromRecipes?: ShoppingItemSource[]
  /**
   * 手で足した分が含まれるか（任意・2026-08-08 オーナー実機フィードバック②）。
   * レシピ由来の行に手入力で足したときも立てる。出所の小窓で「自分で追加」を正直に出すために使う。
   */
  manualAdded?: boolean
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

/**
 * 月タブのカレンダーセルの表示内容（2026-07-28 便CA・オーナー指示
 * 「デフォは写真>献立(作った食数)。加えて、栄養と価格表示をスイッチなどで切り替え表示できるようにしたい」）。
 */
export type MonthCellMode = 'photo' | 'nutrition' | 'cost'

/** アプリ全体の設定（1件だけ保存する） */
export interface Settings {
  /** 常に 1（設定は1レコードだけ） */
  id?: number
  /** NG食材（アレルギー・苦手）。ここに載る食材を含むレシピに警告を出す */
  ngIngredients: string[]
  /** 料理中に画面を暗くしない（レシピ詳細と調理中モードを開いている間） */
  keepScreenOn: boolean
  theme: ThemeSetting
  /** 基本レシピの初回投入が済んでいるか */
  starterSeeded: boolean
  /**
   * 旧配布テーマ(第◯弾)全廃(2026-07-23)に伴う、既存ユーザーへの差分投入が済んでいるか（任意）。
   * テーマ全廃より前に初回シード済みの端末は、旧テーマ由来の基本レシピがまだ入っていないため、
   * 起動時に不足分だけ1回投入する（topUpFlattenedStartersIfNeeded）。未設定（既存ユーザー）は
   * false 扱い＝1回だけ差分投入が走る。任意項目なのでスキーマ変更・マイグレーションは不要。
   */
  starterFlattenSeeded?: boolean
  /** 在庫ボードへの「よく使う食材」プリセット投入が済んでいるか */
  pantryPresetSeeded: boolean
  /** 基本レシピを一覧・提案に出さない */
  hideStarters: boolean
  /**
   * 検索したキーワードから登録したタグの控え（2026-08-19 便HU・⑭・任意項目）。
   * どのタグが検索から作られたものかを覚えておき、そのタグだけを絞り込みの欄から
   * 削除できるようにするために持つ（同梱の基本レシピに元から付いている「和食」などを
   * まとめて消せてしまわないための線引き）。登録した順に並べる
   */
  keywordTags?: string[]
  /** 最後にバックアップを書き出した日時（ミリ秒） */
  lastBackupAt?: number
  /** タイマー音の全体ON/OFF（個別ミュートとは別に、これがOFFなら全タイマーが無音） */
  timerSoundEnabled: boolean
  /** タイマーが1本でも動作中は、どの画面を見ていても画面を暗くしない */
  timerWakeLockEnabled: boolean
  /** タイマーの決まりごと（音と通知はアプリを開いている間だけ鳴る）の説明を初回に表示済みか */
  timerNoticeShown: boolean
  /** 週の食費予算（円・任意）。献立プランナーで概算食費と比較する */
  weeklyBudget?: number
  /**
   * ふだん作る人数（任意・2026-08-03 便DK・オーナー指示）。
   *
   * 献立に入れた料理を、最初から何人分として扱うか。未設定＝従来どおり、その料理に
   * 登録されている人数分（Recipe.servings）で扱う。設定していても、枠ごとに決めた食数
   * （MealPlanEntry.servings）があればそちらが優先（優先順位は logic/servings.ts
   * effectiveMealServings に1本化してある）。
   *
   * 効く先は「作る量」だけ＝買い物メモに渡す分量、これから作る予定の概算食費、
   * レシピ詳細を開いたときの人数ステッパーの初期値（2026-08-03 オーナー決定・A/B提示のB採用。
   * 元のレシピが何人分かは「登録: ◯人分」で併記する）。
   * 栄養は何人分作っても1人が食べる量は1人分のままなので、この値では一切変えない
   * （logic/nutrition.ts・logic/nutritionBalance.ts はこの値を見ない）。
   *
   * 範囲は人数分と同じ1〜20（logic/servings.ts clampServings）。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  householdServings?: number
  /**
   * コンロ（IHを含む）の口数（任意・2026-08-13 便GC・docs/72 第3段）。
   *
   * きっかけは実操作テスト2体目（コンロ1口の家）の一番の不満
   * 「設定を全部見ましたが、コンロ・IH・レンジといった器具の設定は一つもありません。
   * 　うちは1口なので、この段取りはそもそも成立しません」（docs/71 R2）。
   *
   * 効く先は**並行調理ナビの段取りだけ**。設定した口数を超えて同時に火を使う順番を出さなくなり、
   * 口数に余裕があるときは長い放置調理を前倒しして重ねる。
   * 範囲は logic/cookAppliance.ts の MIN_BURNERS〜MAX_BURNERS（1〜4）。
   * 未設定（既存ユーザー含む）は2口（DEFAULT_KITCHEN）扱い。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  kitchenBurners?: number
  /**
   * 電子レンジを持っていない（任意・2026-08-13 便GC）。
   * 未設定/false＝持っている（既定）。持っていない器具の工程は、フライパンや鍋でやることになるので
   * **コンロを1口使うもの**として数える（logic/cookAppliance.ts stepApplianceFor）。
   * 「持っていない」だけを持つ形にしてあるので、未設定の端末は従来どおりの段取りになる。
   */
  kitchenNoMicrowave?: boolean
  /** 魚焼きグリルを持っていない（任意・2026-08-13 便GC。扱いは kitchenNoMicrowave と同じ） */
  kitchenNoGrill?: boolean
  /** トースターを持っていない（任意・2026-08-13 便GC。扱いは kitchenNoMicrowave と同じ） */
  kitchenNoToaster?: boolean
  /** 献立タブに表示する食事帯（任意・未指定は朝昼夜すべて表示） */
  visibleMealSlots?: MealSlot[]
  /**
   * 週タブの表示起点（任意・2026-07-24 便BH-3・タスク3）。true=「今日を先頭に7日間」（今日起点の
   * ローリング表示）、未設定/false=従来の週区切り（月曜始まりのカレンダー週）。既定は従来表示。
   * 任意項目なのでスキーマ変更・マイグレーション不要（既存ユーザーは従来どおりの週区切り）。
   */
  weekStartsToday?: boolean
  /**
   * 月タブのカレンダーセルに何を出すか（任意・2026-07-28 便CA・オーナー指示）。
   * 'photo'=既定（写真があれば写真・無ければ献立のプレビュー）、'nutrition'=その日の1人分の
   * エネルギー、'cost'=その日の1人分の食費。未設定は 'photo'（従来どおり）。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  monthCellMode?: MonthCellMode
  /**
   * 月カレンダーの写真に、レシピに登録されている写真を使わないか
   * （任意・2026-08-07 便DU・オーナー指示「レシピのサムネ写真は表示しないスイッチ」）。
   * 未設定/false＝従来どおり、作った記録に写真が無い日はレシピの写真で代用する。
   * true＝自分で撮った「作った記録」の写真がある日だけカレンダーに写真を出す。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  monthHideRecipePhoto?: boolean
  /**
   * 月カレンダーのその日のセルに、どの料理の写真を出すか（任意・2026-08-07 便DU・オーナー指示
   * 「カレンダーのサムネに使うレシピを日ごとに選べるように」）。
   * 鍵が日付（YYYY-MM-DD）・値がレシピのid。選んでいない日は載せない
   * （＝載っていない日は logic/monthCover.ts の既定の優先順で自動的に決まる）。
   * 端末内の表示の好みだけを持つ記録で、献立・記録のデータには一切影響しない。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  monthDayCoverRecipe?: Record<string, number>
  /**
   * 献立の栄養・食費に「ごはん1杯」を足して見るか（任意・2026-08-02 便CW-10・オーナー承認）。
   * 未設定/false＝足さない（既定）。献立にはおかずだけを登録し、ごはんは登録しない人が多く、
   * その状態の合計は主食のぶんだけ小さく出るため、本人が選んで足せるようにする。
   * 足すのは各食1杯だけで、丼・麺・カレーのように主食を含む主菜の食事には足さない。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  includeRice?: boolean
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
   * 自由な時間のタイマー(ja.timer.customLabel「タイマー」)で最後に使った分数(2026-07-12・タイマー自由設定)。
   * 次回開くときの既定値にする。未設定(初回)は呼び出し側で3分を既定値として扱う。
   * 秒刻み対応(同日オーナー実機フィードバック)後は下のlastCustomTimerSecondsが優先され、
   * この項目は後方互換の読み取り専用フォールバックとして残す(新規書き込みはしない)
   */
  lastCustomTimerMinutes?: number
  /**
   * 自由な時間のタイマーで最後に使った秒数(2026-07-12秒刻み対応)。±10秒/±30秒/±1分の調整後の値を
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
  /**
   * 「作った！」記録時に、使った食材の在庫を1段階だけ下げるスイッチの記憶値
   * （2026-07-23 オーナー実機FB #11）。既定はOFF（未設定＝false扱い）。
   * ユーザーがスイッチを切り替えるたびに保存し、次回の既定値にする（調味料系は対象外）。
   */
  cookedReflectPantry?: boolean
  /**
   * 「調理中モードで見る」ボタンの初回ヒントを表示済みか（2026-07-23 便BJ・docs/55 CEO提案1-5:
   * このアプリ最強の機能が初見で気づかれにくい問題への控えめな対策）。レシピ詳細を初めて開いた
   * ときだけ、ボタンを指す一言ヒントを1回だけ出し、以降は出さない。未設定（既存ユーザー含む）は
   * 「まだ見せていない」扱い=次にレシピ詳細を開いたとき1回だけ表示される
   */
  cookModeHintSeen?: boolean
  /**
   * 読み上げの読み方についての案内を出し終えたか（2026-08-12 便FX・オーナー実機
   * 「読み上げ精度なんとかならない？端末依存であれば、端末の設定見直してね、って
   * 教えてくれるだけでも信頼度変わるよ」）。
   *
   * 単位の読み（cm・g・mlなど）はアプリ側で直したうえで、それでも読み方が合わないときの
   * 直し方を案内する。**読み上げを実際に使ったあと、1回だけ**出して以後は出さない
   * （毎回出すと、うまく読めているときにも邪魔になる）。
   * 未設定（既存ユーザー含む）は「まだ出していない」扱い。任意項目なのでマイグレーション不要。
   */
  speechReadingHintSeen?: boolean
  /**
   * 調理中モードの手順の文字の大きさ（倍率・任意。2026-08-12 便FX・オーナー実機
   * 「調理中モードの文字の大きさは、ユーザーが自由に変更できない？」）。
   * 選べる値は logic/cookFontScale.ts の COOK_FONT_SCALES（0.85/1/1.25/1.5）。
   * 未設定（既存ユーザー含む）・一覧に無い値は標準（1）として扱うので、
   * 任意項目のままでよくマイグレーションは要らない。
   */
  cookStepFontScale?: number
  /**
   * 「今日なに作る？」の条件「◯分以内」で選んだ調理時間のしきい値（分・任意。
   * 2026-07-24 便BN・タスク7）。選択肢は10/15/20/30分で、切り替えるたびに保存し次回の既定にする。
   * 未設定（既存ユーザー含む）は10分扱い＝従来の「10分以内」と同じ挙動。任意項目なので
   * スキーマ変更・マイグレーション不要。
   */
  homeQuickMinutes?: number
  /**
   * 献立の「提案の条件」の「調理時間◯分以内を優先」で選んだ分数（分・任意。
   * 2026-08-19 便HT・オーナー原文「調理時間15分いないを優先は、時間だけプルダウンで
   * 変更できるようにしたい」）。選べる値は logic/mealPlan.ts の PLAN_QUICK_MINUTES_OPTIONS。
   *
   * 未設定（既存ユーザー含む）・一覧に無い値は15分扱い＝この項目が無かった頃と同じ提案になる。
   * 優先そのもののON/OFF（quickOnly）は画面を開いているあいだだけの状態で、
   * 分数だけを覚えるのは「今日なに作る？」の homeQuickMinutes と同じ作法。
   * 任意項目なのでスキーマ変更・マイグレーションは要らない。
   */
  planQuickMinutes?: number
  /**
   * 「今日なに作る？」で「1品」と「献立」のどちらを出しているか（任意・2026-08-18 便HM・
   * オーナー実機「『1品』↔️『献立』に切り替えスイッチにしませんか？」）。
   *
   * 2026-08-19 便HT（オーナー原文「基本を献立表示にして、1品にする時のみスイッチ押すように
   * した方が良いかも」）: 未設定（既存ユーザー含む）は **'plan' 扱い**＝主菜＋副菜の献立から始まる。
   * 一度でも切り替えた人は保存された側のまま（'one' を保存していれば1品から始まる）。
   * 覚えておくのは、この切り替えが**その人の作り方の好み**（1品だけ決めたいか、
   * 主菜＋副菜をまとめたいか）で、開くたびに選び直すものではないため。
   * 同じ節の「◯分以内」の分数（homeQuickMinutes）も同じ理由で覚えている。
   * 任意項目なのでスキーマ変更・マイグレーションは要らない。
   */
  dayStartSuggestMode?: 'one' | 'plan'
  /**
   * 「今日なに作る？」を常に表示するか（任意・2026-08-03 便DH）。
   *
   * **2026-08-17 便HG以降は読んでいない。** オーナー決定で出す条件が
   * 「その日の献立が決まっていないときだけ」の1通りに定まり、切り替える設定そのものを
   * 無くしたため（設定「ホーム画面のカスタマイズ」ごと撤去）。
   * 保存済みの値を消すとバックアップの読み込みで困るので、項目だけ残してある。
   */
  homeSuggestionAlways?: boolean
  /**
   * 献立の自動提案で選んでいる「目的」（任意・2026-08-02 便CP-2・docs/62 決定②。Pro機能）。
   * 未設定＝指定なし（従来どおりの提案）。時短・ジャンル等の他の条件と違って画面を閉じても
   * 覚えておくのは、この指定が「1か月続ける」ためのものだから（毎回選び直させない）。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  planPurpose?: MealPurpose
  /**
   * 並行調理ナビの「お試し」を使った回数（任意・2026-08-02 便CP-2・docs/62 決定③）。
   * 未解錠のまま COOK_NAVI_TRIAL_LIMIT 回まで本物のナビを使える（期限なし・端末内カウント）。
   * 未設定（既存ユーザー含む）は0回扱い。データ消去でリセットされる緩い鍵で、
   * 解錠コードと同じく善良なユーザーを前提にする（サーバー照合はしない）。
   */
  cookNaviTrialCount?: number
  /**
   * 月間献立のお試し表示（ロック案内の「1回だけ表示」）を使ったか
   * （任意・2026-08-02 便CP-2・docs/62 決定③）。
   * 未解錠のまま1回だけ、本人の実データが入った月タブをフル表示する。未設定＝まだ使っていない。
   * cookNaviTrialCount と同じく端末内の緩いフラグ。
   */
  monthTrialUsed?: boolean
  /**
   * 栄養8項目の見本表示（レシピ詳細の「栄養価の概算」の「1回だけ表示」）を使ったか
   * （任意・2026-08-08 便DZ・オーナー決定）。未解錠のまま、任意の1レシピで栄養8項目を
   * 1回だけフル表示できる。未設定＝まだ使っていない。monthTrialUsed と同じ端末内の緩いフラグで、
   * Proの表示ゲート（isNutritionUnlocked）自体は変えない（見本を出すのはこの1回だけ）。
   */
  nutritionTrialUsed?: boolean
  /**
   * 登録件数の案内を出す予約（任意・2026-08-08 便DZ・オーナー指示）。
   * レシピを登録し終えた時点の件数が節目（20件目・27件目・30件目）だったときにその件数を控え、
   * レシピ一覧で1回だけ案内を出す。閉じたら0に戻して再表示しない。
   * 0・未設定＝出す案内は無い（logic/freeLimit.ts の freeLimitNoticeFor で判定する）。
   */
  freeLimitNoticeCount?: number
  /**
   * 買い物メモを並べる売り場の順番（任意・2026-08-02 便CT/C15 オーナー承認）。
   * 未設定（既存ユーザー含む）は logic/pantryGroups.ts の SHOPPING_AISLE_ORDER
   * （野菜・きのこ→肉・魚介→豆腐・卵・乳→主食・粉→調味料→その他）をそのまま使う。
   * 店の回り方は家庭ごとに違うので、6グループの並び順だけを入れ替えられるようにする
   * （グループの中身＝食材の振り分けは変えない）。読み出しは normalizeAisleOrder を通し、
   * 未知のキーや欠けたキーがあっても既定順で補って必ず6グループ揃った配列にする。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  shoppingAisleOrder?: PantryGroupKey[]
  /**
   * 買い物メモで、チェックした食材をページの下にまとめるか
   * （任意・2026-08-08 オーナー実機フィードバック
   * 「スイッチで、チェックした商品をまとめてページの下方に表示し、チェックしていない食材だけが
   * 上に残るようにしたい」）。
   * 未設定/false＝従来どおり、チェックした食材も売り場ブロックの中に残る（既定）。
   * true＝売り場ブロックには未チェックだけを残し、チェック済みは下の1ブロックに集める。
   * 表示の切り替えだけで、買い物メモの中身も並び順（order）も書き換えない。
   * 任意項目なのでスキーマ変更・マイグレーション不要。
   */
  shoppingCheckedAtBottom?: boolean
  /**
   * タイマー終了音の音量（任意・2026-08-08 オーナー実機フィードバック③
   * 「タイマー音量や長さは、設定から調整や確認できるようにしたい」）。
   * 未設定（既存ユーザー含む）は 'normal' ＝これまで鳴っていた音そのまま。
   * 実際の値は logic/timerSound.ts が持つ（任意項目なのでマイグレーション不要）。
   */
  timerSoundVolume?: TimerSoundVolume
  /**
   * タイマー終了音の鳴る長さ（任意・2026-08-08 オーナー実機フィードバック③）。
   * 未設定（既存ユーザー含む）は 'short' ＝これまでどおりの3回（約1秒）。
   */
  timerSoundLength?: TimerSoundLength
}

/** タイマー終了音の音量（3段階。既定は 'normal' ＝従来の音量） */
export type TimerSoundVolume = 'low' | 'normal' | 'high'

/** タイマー終了音の鳴る長さ（3段階。既定は 'short' ＝従来の長さ） */
export type TimerSoundLength = 'short' | 'medium' | 'long'

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
  // 「料理中」の3つの設定は初期値をすべてON(2026-08-04 便DV-6・オーナー指示)。
  // 料理中に画面が消えないことがこのアプリの前提の使い方で、対応していないブラウザでは
  // 設定画面に「お使いのブラウザは対応していません」が出る(ONのままでも害はない)
  keepScreenOn: true,
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
