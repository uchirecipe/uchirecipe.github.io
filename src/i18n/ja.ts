/**
 * 画面に表示する日本語の文言はすべてここに集める。
 * コンポーネント内に直接日本語を書かないこと（将来の英語対応のため）。
 * {n} のような部分は表示時に .replace() で置き換える。
 */
export const ja = {
  app: {
    name: 'うちレシピ',
    url: 'uchirecipe.com',
  },
  common: {
    back: '戻る',
    close: '閉じる',
    // 説明文の折りたたみトグル共通ラベル(2026-07-16 UI総点検B-5: 在庫ボード・買い物候補の
    // 説明文が常時表示でゴチャつきの一因だったため。既定は閉。文言はどちらも同じなので共通化)
    usageHint: '使い方',
  },
  chip: {
    remove: 'このチップを削除',
  },
  icon: {
    rice: 'ご飯・丼',
    pasta: 'パスタ',
    noodle: '麺類',
    bread: 'パン',
    soup: '汁物・鍋',
    salad: 'サラダ・和え物',
    vegetable: '炒め物・煮物',
    tofu: '豆腐・大豆',
    fish: '魚',
    egg: '卵',
    chicken: '鶏肉',
    meat: '肉',
    dessert: 'デザート',
    drink: '飲み物',
    default: 'その他',
  },
  nav: {
    home: 'ホーム',
    recipes: 'レシピ',
    mealPlan: '献立',
    shopping: '食材',
    settings: '設定',
  },
  home: {
    title: 'ホーム',
    suggestTitle: '今日なに作る？',
    shuffle: 'ほかの候補を見る',
    condAll: 'すべて',
    condNotRecent: '最近作ってない',
    condFavorite: 'お気に入り',
    condQuick: '10分以内',
    // 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5)。既定閉。MealPlanPage「提案の条件」と
    // 同じパターン(既定値=すべて以外を選んでいるときは畳んだラベルにも現在値を出す)
    conditionsToggle: '条件をしぼる',
    pantryOnlyToggle: '在庫の食材で',
    pantryOnlyFallback: '在庫の食材を使うレシピが見つからなかったので、通常の候補から選びました',
    noCandidate: 'この条件に合うレシピがありません',
    empty: 'レシピを登録すると、ここにおすすめが表示されます',
    goRegister: 'レシピを登録する',
    ingShortcutTitle: '使いたい食材から探す',
    ingPlaceholder: '食材を1つずつ入力',
    ingAdd: '追加',
    ingButton: 'この食材で探す',
    mealPlanTitle: '今日の献立',
    historyTitle: '最近作ったもの',
    historyMore: 'すべて見る',
    backupReminder: 'しばらくバックアップしていません。設定から書き出しておくと安心です',
    backupReminderLink: 'バックアップを開く',
    newsLinkLabel: '詳しく見る',
  },
  pantry: {
    title: '食材の在庫',
    description:
      'よく使う食材をタップして「ある→少ない→ない」の3段階を切り替えます。数は数えず、ざっくりでOK',
    level: {
      have: 'ある',
      low: '少ない',
      none: 'ない',
    },
    addPlaceholder: '例: 豚肉',
    add: '追加',
    empty: 'よく使う食材を登録すると、ここに並びます',
    addToSearch: '在庫から追加',
    reorderToggle: '並び替え',
    reorderDone: '完了',
    // 整理モード(2026-07-16 UI総点検B-10: チップ常時×が状態切替タップと隣接し誤操作の元
    // だったため廃止。代わりにモードに入って複数選択→一括削除にする)
    organizeToggle: '整理',
    organizeDone: '完了',
    organizeSelect: 'タップして選択',
    organizeDeleteSelected: '選択した{n}件を削除',
    organizeConfirm: '選択した{n}件を食材の在庫から削除します。よろしいですか？',
    // まとめて状態設定(2026-07-17 docs/35 §5 案D): 整理モード中、選択した食材をまとめて
    // 「ある」「少ない」「ない」のいずれかに一括変更する。ボタン文言はpantry.levelを流用
    organizeBulkSetToast: '{n}件を『{level}』にしました',
  },
  history: {
    title: '作った記録',
    empty: 'まだ「作った！」の記録がありません',
    monthFormat: '{y}年{m}月',
  },
  mealPlan: {
    title: '献立',
    todayTitle: '今日の献立',
    todayEmpty: 'まだ今日つくるものが決まっていません',
    todayMarkCooked: '作った',
    todayRemove: 'この献立から外す',
    todayMarkAllCooked: '全て作った！',
    todayImport: '今週の献立から今日の分を取り込む（{n}件）',
    weekTitle: '今週の献立',
    prevWeek: '前の週',
    nextWeek: '次の週',
    thisWeek: '今週へ戻る',
    // 3タブ構成(2026-07-16 便U-1 Fable設計: 現行の「今日セクション+週/月切替」を
    // ページ上部の「日」「週」「月」タブに再構成)
    viewDay: '日',
    viewWeek: '週',
    viewMonth: '月',
    monthTitle: '月間の献立',
    prevMonth: '前の月',
    nextMonth: '次の月',
    thisMonth: '今月へ戻る',
    monthDayHasPlan: '献立あり',
    monthProGateTitle: '月間表示はPro版の機能です',
    monthProGateDescription: '1か月分の献立をカレンダーでまとめて見渡せます。日付をタップすると、その日の献立を確認できます。',
    monthProGateLink: 'Pro版について見る',
    // 日タブの食事帯選択の補足文(便U-2)。visibleMealSlotsは週タブの表示帯フィルタと共通の設定値
    daySlotFilterHint: '選んだ帯の今週の予定を、自動で今日の献立に取り込みます',
    // 週タブ「この帯の今週分を空にする」(便U-4 Fable設計。「朝のみ削除したい」への回答)
    clearWeekSlotTitle: 'この帯の今週分を空にする',
    clearWeekSlotTargetAria: '空にする帯として{slot}を選ぶ',
    clearWeekSlotButton: '空にする',
    clearWeekSlotConfirm: '{slot}の今週の登録をすべて削除します。よろしいですか？',
    clearWeekSlotDone: '{slot}の今週分を削除しました',
    // 月タブの日タップモーダル(便U-5 Fable設計。従来の即週ジャンプを廃止しモーダル内の
    // ボタンへ移動。「突然週に飛ばされる」問題の解消)
    monthDayModalTitle: '{m}月{d}日の献立',
    monthDayModalEmpty: '献立はありません',
    monthDayModalOpenWeek: 'この週を開く',
    // 週/月の過去振り返り(2026-07-17 便Z-2・docs/35 §3 Fable設計)。週タブの過去日と
    // 月タブの日モーダルに、その日の「作った記録」(cookedLogs日付一致)を表示する。
    // 月間献立への機能追加はPro v2まで凍結が既定だったが、オーナー指示で解除して実装
    monthDayHasLog: '記録あり',
    pastCookedTitle: '作った記録',
    // 期間の食費(2026-07-17 便AB・オーナー決定・docs/35 §5): 月タブのモードボタン。
    // 開始日タップ→終了日タップの2タップで期間を選び、期間の献立原価合計・1日あたり平均を出す。
    // 段階1(予定ベース・登録人数基準。既存の週の概算食費と同方式)。段階2(実績ベース)は後日
    rangeCostToggle: '期間の食費',
    rangeCostGuideStart: '開始日をタップしてください',
    rangeCostGuideEnd: '終了日をタップしてください',
    rangeCostResultTitle: '期間の食費',
    rangeCostResultRange: '{sm}/{sd}〜{em}/{ed}（{n}日間）',
    rangeCostResultAverage: '1日あたり 約{n}円',
    dow: ['月', '火', '水', '木', '金', '土', '日'] as string[],
    slot: {
      breakfast: '朝食',
      lunch: '昼食',
      dinner: '夕食',
    },
    /** 献立1品の役割ラベル（2026-07-13献立の主菜+副菜構成対応。行の先頭に小さく表示） */
    role: {
      main: '主菜',
      side: '副菜',
    },
    empty: '未定',
    assign: '選ぶ',
    change: '変更する',
    suggest: '自動提案',
    suggestAria: 'この行にレシピを自動提案する',
    clear: 'この割り当てを外す',
    removeExtraRow: 'この追加枠を取り消す',
    addRow: '＋枠を追加',
    quickOnlyToggle: '自動提案は時短レシピ優先',
    quickOnlySummary: '時短優先',
    genreAny: '指定なし',
    preferHighProteinToggle: '高たんぱく優先',
    fillWeek: 'まとめて献立を立てる',
    // 提案条件6ボタンの折りたたみ(2026-07-16 UI総点検A-3: 常時全展開がゴチャつきの一因)。
    // 既定閉。選択中の条件が既定以外のときは畳んだラベルにも現在値を出す（例:「提案の条件: 和食」）
    suggestConditionsToggle: '提案の条件',
    todayCookedToast: '作った記録をつけました',
    slotFilterTitle: '表示する食事帯',
    slotFilterKeepOne: '少なくとも1つの食事帯は表示します',
    pickTitle: 'レシピを選ぶ',
    pickSearchPlaceholder: 'レシピ名で絞り込み',
    pickEmpty: 'レシピがありません',
    pickNoMatch: '見つかりません',
    pickCurrentBadge: '選択中',
    noSuggestion: '提案できるレシピがありません。先にレシピを登録してください',
    weekCostTitle: '今週の概算食費',
    weekCostNote: '材料に価格を入力したレシピだけが計算対象です',
    weekCostNoteLink: '食材と価格を編集する',
    budgetCompareOver: '予算より約{n}円オーバーしています',
    budgetCompareUnder: '予算まで約{n}円の余裕があります',
    budgetNotSet: '設定画面で週の食費予算を登録すると、ここで比較できます',
    goToShopping: 'この週の買い物リストを作る',
    goToShoppingEmpty: 'レシピを割り当てると、まとめて買い物リストの候補にできます',
    historyLink: '過去の記録を見る',
    planMismatchNotice: '今日の献立と今週の予定が食い違っています',
    planMismatchDescription: 'タップすると、その時間帯の週の予定を今日の献立に合わせて更新します',
    planMismatchCurrent: '現在: {title}',
    planMismatchEmpty: '現在: 未定',
    cookNaviEntry: '並行調理ナビ',
    cookNaviEntrySub: '複数レシピの段取りの叩き台を作る',
    todayBadge: '今日',
  },
  cookNavi: {
    title: '並行調理ナビ',
    proTag: 'Pro',
    gateTitle: '並行調理ナビはPro版の機能です',
    gateDescription:
      '選んだ2〜3品の手順を1本にまとめ、待ち時間の長い工程を先に、その隙間に別の手作業を差し込んだ「段取りの叩き台」を作ります。',
    gateLink: 'Pro版について見る',
    intro:
      '今日の献立から2〜3品を選ぶと、待ち時間の長い工程を先にして、その隙間に別の手作業を差し込んだ「1本の段取り」を提案します。',
    disclaimer:
      'これはあくまで段取りの叩き台（目安）です。火加減や進み具合を見ながら、自分のやりやすい順に調整してください。この通りに進めなくても大丈夫です。',
    selectTitle: '組み合わせるレシピを選ぶ',
    selectHint: '今日の献立から2〜3品まで選べます',
    selectedCount: '{n}品を選択中',
    emptyToday:
      '今日の献立にレシピがありません。レシピ詳細の「今日の献立に追加」から追加すると、ここで段取りを組めます。',
    onlyOneToday:
      '今日の献立が1品だけです。2品以上あると、待ち時間を活かした段取りを組めます。',
    goToday: '今日の献立を見る',
    needTwo: '2品以上を選んでください',
    maxThree: '選べるのは3品までです（v1）',
    build: '段取りを作る',
    rebuild: 'レシピを選び直す',
    totalEstimate: '全体の目安 約{n}分',
    totalNote: '手作業のおおよその時間も含んだ目安です。実際の火加減で前後します。',
    orderNote: '番号は手を付ける順番の目安です。待ち時間の間は、次の番号の作業と並行して進みます。',
    legendTitle: '組み合わせる{n}品',
    kindWait: '待ち',
    kindActive: '手を動かす',
    waitBlockTitle: '約{n}分の待ち時間',
    waitFillHint: 'この間に、次の手作業を進められます',
    stepNumberLabel: '手順{n}',
    openRecipe: 'レシピを開く',
    startTimer: 'タイマーを始める',
  },
  shopping: {
    // 食材タブの2タブ分割(2026-07-16 UI総点検B-9: 買い物メモが最上部を占有しヘビーユーザーの
    // 壁になっていた所見への対応。既定タブは在庫)
    tabInventory: '食材の在庫',
    tabMemo: '買い物メモ',
    fromRecipeTitle: 'レシピから追加',
    pickRecipes: '材料を合算したいレシピを選ぶ',
    pickerSearchPlaceholder: 'レシピ名で絞り込み',
    pickerEmpty: 'レシピがありません',
    pickerNoMatch: '見つかりません',
    makeCandidates: '候補を作る',
    candidateTitle: '買い物候補（下書き）',
    candidateDescription:
      '内容を確認してチェックを入れ、「買い物メモに追加」を押すと確定します。自動計算はあくまで下書きです',
    candidateEmpty: '選んだレシピの材料は、食材の在庫で「ある」に登録済みのようです',
    amountPlaceholder: '分量',
    addConfirmed: '買い物メモに追加',
    discardCandidates: '候補を閉じる',
    memoTitle: '買い物メモ',
    memoEmpty: 'まだ買い物メモがありません。レシピから追加するか、下から手入力できます',
    manualPlaceholder: '食材を入力',
    manualAmountPlaceholder: '分量（任意）',
    manualAdd: '追加',
    remove: 'この項目を削除',
    complete: '買い物完了',
    completeConfirmTitle: '食材の在庫に反映しますか？',
    completeConfirmDescription:
      'チェックした食材のうち、食材の在庫に登録済みのものを「ある」にします。反映してもしなくても、チェック済みの項目はメモから消えます',
    completeYes: '反映する',
    completeNo: '反映せず完了',
  },
  settings: {
    title: '設定',
    // タブ分割(2026-07-12オーナー実機フィードバック: 縦に長大化したため上部タブで分割)
    // タブ名は「基本」→「全般」(2026-07-13 UIペルソナQA。タブ構造・id('basic')はそのまま、表示名のみ変更)
    tabBasic: '全般',
    tabRecipe: 'レシピ',
    tabBackup: 'バックアップ',
    tabProPack: 'Pro・パック',
    // 全般タブの小見出し4グループ(2026-07-16 UI総点検B-2オーナー決定: 9カードフラット並列を整理。
    // 見た目(テーマカラー・ホームカスタマイズ)/食材と価格/料理中/その他。並びとグループ見出しのみで
    // カードの中身は変更しない)
    groupAppearanceTitle: '見た目',
    groupIngredientsTitle: '食材と価格',
    groupCookingTitle: '料理中',
    groupOtherTitle: 'その他',
    // バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)。タブバーの下・全タブ共通の
    // 常設バナー。「◯日前」形式はバックアップタブ内の既存表示(backupLastDate「最終バックアップ: {date}」)
    // とは別建て(頂点バナーは経過日数、タブ内は日付そのもの)。未実施はbackupNeverを流用する
    bannerLastBackupToday: '最終バックアップ: 今日',
    bannerLastBackupDaysAgo: '最終バックアップ: {n}日前',
    bannerSaveNow: '今すぐ保存',
    ngTitle: 'NG食材（アレルギー・苦手）',
    ngDescription: 'ここに登録した食材を含むレシピには警告マークが付きます（例:「豚」で「豚肉」「豚バラ」もヒットします）',
    // 見出し行の件数常時表示(2026-07-17設定ゼロベース裁定#2)。0件は登録を促す「未設定」にする
    ngCount: '{n}件',
    ngCountEmpty: '未設定',
    ngPlaceholder: '例: えび',
    ngAdd: '追加',
    ngRemove: 'このNG食材を削除',
    ngEmpty: 'まだ登録されていません',
    screenTitle: '料理中に画面を暗くしない',
    screenDescription: 'レシピ詳細を開いている間、画面の自動消灯を防ぎます（対応ブラウザのみ）',
    // Wake Lock API非対応環境向けの注記(2026-07-10)。トグル自体は残したまま説明の下に添える
    wakeLockUnsupportedNote:
      'この環境（ブラウザ）では利用できません。https（保護された接続）でアクセスすると使えるようになる場合があります。',
    // 「テーマ」→「テーマカラー」(2026-07-16 UI総点検B-1オーナー決定: レシピ側の「テーマ一覧」
    // (配布レシピ集)との用語衝突。色選択側のみ改名し、レシピ側の用語(themeListTitle等)は不変)
    themeTitle: 'テーマカラー',
    themeDescription: '「自動」はお使いの端末の明暗設定（OSのライト/ダークモード）に合わせて自動で切り替わります',
    themeAuto: '自動',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    themeBrown: 'ブラウン',
    themeGreen: 'グリーン',
    timerSoundTitle: 'タイマー音',
    timerSoundDescription: 'タイマー終了時に音を鳴らします（各タイマーごとの消音は常駐バーの🔔で切り替えられます）',
    timerWakeLockTitle: 'タイマー中は画面を暗くしない',
    timerWakeLockDescription: 'タイマーが1本でも動いている間、どの画面を見ていても自動消灯を防ぎます（対応ブラウザのみ）',
    weeklyBudgetTitle: '週の食費予算（円・任意）',
    weeklyBudgetDescription: '献立プランナーで、その週の概算食費と比較して表示します',
    weeklyBudgetPlaceholder: '例: 5000',
    homeWidgetsTitle: 'ホーム画面のカスタマイズ',
    homeWidgetsDescription: '表示するパーツを選び、上下で並び順を変えられます',
    homeWidgetMoveUp: '上へ移動',
    homeWidgetMoveDown: '下へ移動',
    homeWidgetShow: '表示する',
    homeWidgetHide: '表示しない',
    ngMatchPreview: '一致するレシピ: {n}件',
    ngAddedFeedback: '「{ng}」を追加しました（該当レシピ {n}件）',
    starterTitle: '基本レシピ',
    starterDescription: 'アプリに最初から入っている定番レシピ（{n}品）の扱いを選べます',
    starterHide: '基本レシピを一覧に表示しない',
    starterReload: '基本レシピを入れ直す',
    starterReloadConfirm: '基本レシピを最初の状態に戻します（自分で編集した基本レシピは上書きされます）。よろしいですか？',
    starterReloadDone: '基本レシピを入れ直しました',
    recipeSetTitle: 'レシピセットを読み込む',
    recipeSetDescription:
      '配布されているレシピ集（JSONファイル）を追加で読み込めます。同じ料理名のレシピはスキップされます。読み込んだレシピはご自身の登録分とは別枠で管理されます',
    recipeSetUrlPlaceholder: 'https://…',
    recipeSetUrlLoad: 'URLから読み込む',
    recipeSetUrlHint: '配布元のサーバー設定によっては読み込めない場合があります',
    recipeSetFileLoad: 'ファイルから読み込む',
    recipeSetLoading: '読み込み中…',
    recipeSetResult: '{a}件追加しました（重複{s}件はスキップ）',
    /** 更新（内容が変わっていた再取込）が1件以上あるときのみ使う。u=0のときはrecipeSetResultのまま */
    recipeSetResultWithUpdate: '{a}件追加・{u}件更新しました（重複{s}件はスキップ）',
    /** 削除済みのため取り込まなかった品があるとき（1件以上）だけ末尾に付ける。0件なら出さない（2026-07-13） */
    recipeSetResultExcluded: '（削除済みの除外中{e}件）',
    recipeSetError: '読み込めませんでした。レシピセットのJSONファイルか確認してください',
    recipeSetNotFound: '指定されたURLにレシピセットが見つかりませんでした。IDの綴りが正しいか確認してください',
    recipeSetDeepLinkConfirm: '「{name}」（{n}品）を追加しますか？',
    recipeSetPageLink: '配布ページを見る',
    recipeSetBlocked: 'このレシピセットの追加には、追加レシピパックまたはPro版の解錠が必要です',
    // 2026-07-17バックアップ改修 修正5: バックアップタブを3カード(バックアップを取る/
    // バックアップから戻す/困ったとき)に再構成。backupTitleは「バックアップを取る」カードの見出し
    backupTitle: 'バックアップを取る',
    backupDescription: 'レシピ・写真・記録・設定を1つのファイルに保存します。機種変更やデータ消失に備えて定期的にどうぞ',
    // 修正1: バックアップファイルにPro・追加レシピパックの解錠コードが含まれることの注意喚起
    backupContainsCodeNotice: 'バックアップファイルには購入コードが含まれます。他の人に渡さないでください',
    backupExport: 'ファイルに書き出す',
    backupLastDate: '最終バックアップ: {date}',
    backupNever: 'まだバックアップしていません',
    // 修正2+3: File System Access API対応ブラウザ(Chrome/Edge等)向けの保存先選択・上書き
    backupSaveError: '保存に失敗しました。もう一度お試しください',
    backupOverwrite: '前回の場所に上書き',
    backupOverwriteNote: '前回選んだファイルにそのまま上書き保存します',
    // 修正5: 「バックアップから戻す」カードの見出し・導入文
    backupRestoreTitle: 'バックアップから戻す',
    backupRestoreDescription: '書き出したファイルを選んで読み込みます。「追加」と「置き換え」のどちらか、目的に合う方をお使いください',
    backupImportReplace: '読み込む（今のデータと置き換え）',
    // 置き換えボタン直下に出す短い注意キャプション(2026-07-16 データ消失事故の再発防止。
    // 追加側のbackupImportMergeNoteと対になる、置き換え側の警告表示)
    importReplaceCaption: '今のデータを消して選んだファイルの内容だけにします',
    backupImportMerge: '読み込む（今のデータに追加）',
    // 置き換え確認文(2026-07-17設定ゼロベース裁定#6a・app/CLAUDE.md規約F)。ファイル選択を開く前
    // (pickImportFile)・ファイル選択後の最終確認(onImportFile)の両方で同じ文言を使い整合させる
    // (2026-07-16新設の「押した瞬間に確認なしでファイル選択が開いてしまう穴を塞ぐ手前の確認」と、
    // 実行直前の確認の2段構成はそのまま維持)。消える件数({r}レシピ・{c}作った記録・{p}価格)を
    // 具体的に明示した上で、実行前に自動退避すること・直後なら「元に戻す」で戻せることを明記する
    // （「よろしいですか？」だけの確認にしない＝規約F）
    backupImportReplaceConfirm:
      '今のレシピ{r}件・作った記録{c}件・価格{p}件が消え、読み込むファイルの内容に置き換えます。置き換え前のデータは自動で退避されるので、直後なら「元に戻す」で戻せます。よろしいですか？',
    backupImportMergeConfirm: 'ファイルのレシピを今のデータに追加します。よろしいですか？',
    backupImportMergeNote: '同じレシピ（同一ID）はスキップされ、今のデータが優先されます。新しいレシピだけが追加されます',
    // 置き換え直後に1回だけ出す「元に戻す」バナー(2026-07-17設定ゼロベース裁定#6c・三重の網の(c))。
    // savePreImportSnapshotで退避したデータからrestorePreImportSnapshotで復元する
    replaceUndoMessage: '置き換え前のデータを退避しました。今なら元に戻せます',
    replaceUndoButton: '元に戻す',
    replaceUndoDismiss: '閉じる',
    replaceUndoDone: '元のデータに戻しました',
    replaceUndoError: '元に戻せませんでした（退避データが見つかりません）',
    // 機種変更・引っ越しガイド(2026-07-17設定ゼロベース裁定#5)。バックアップタブの折りたたみ
    moveGuideToggle: '機種変更するときは',
    moveGuideStep1: '①この端末で「ファイルに書き出す」',
    moveGuideStep2: '②新しい端末でアプリを開き「読み込む（置き換え）」',
    moveGuideStep3: '③購入コードを入れ直す（コードは「Pro・パック」タブでコピーできます）',
    moveGuideNote:
      '②は新しい端末の中身を今のファイルの内容に置き換えます。新しい端末で先にレシピを登録していた場合は消えるのでご注意ください',
    backupIncludeCookedPhotos: '「作った記録」の写真もバックアップに含める',
    backupIncludeCookedPhotosNote:
      'ONにするとバックアップファイルが大きくなります（写真1枚あたりおおよそ150〜300KB）。既定はOFFです',
    cookedPhotoOverLimitBanner:
      '「作った記録」の写真が合計{n}MBになっています。古い記録から写真を削除すると容量を減らせます（自動では削除されません）',
    // 「アプリの表示を修復する」ボタン(2026-07-16新設。2026-07-17ボタン文言・説明文を全面改訂
    // =修正4)。SWとキャッシュだけ消してリロードする安全な機能で、ブラウザの「Cookieと他の
    // サイトデータ」削除でレシピ・購入コードを失った事故の再発防止として追加
    refreshAppTitle: '困ったとき',
    refreshAppButton: 'アプリの表示を修復する',
    // 修正4: 「消えるもの/残るもの/押すとき」を分けて明記(旧: 1文にまとめていたため何が起きるか
    // 分かりにくかった、というオーナー指示への対応)
    refreshAppWhenToUse:
      '押すとき: 表示がおかしい・アイコンが出ない・レシピの追加やテーマの読み込みがうまくいかないとき',
    refreshAppWhatIsCleared: '消えるもの: 画面の一時ファイルだけです',
    refreshAppWhatRemains: '残るもの: レシピ・価格・設定・購入コードなど、すべてのデータはそのまま残ります',
    refreshAppConfirm:
      'アプリの表示を修復します。レシピや価格などのデータは消えません。よろしいですか？',
    // M-2(2026-07-16): オフライン時に実行すると新しいファイルを取得できず白画面になるための案内
    refreshAppOffline:
      'インターネットに繋がっているときにお試しください（オフラインだとアプリを取り直せません）',
    // 修正4: ブラウザ自体のキャッシュクリア機能を使う場合の注意(「Cookieと他のサイトデータ」を
    // 消すとIndexedDBごと消え、レシピ・購入コードが失われる事故の再発防止。2026-07-16の実際の
    // 事故を踏まえ、アプリ内の「アプリの表示を修復する」で足りることを案内した上で、
    // どうしてもブラウザ側で消す場合の絞り込み方を明記する)
    refreshAppCacheClearWarning:
      'ブラウザの設定から消す場合は「キャッシュされた画像とファイル」だけにしてください。「Cookieと他のサイトデータ」を消すとレシピなどのデータがすべて消えます（消す前にバックアップを取ってください）',
    // 「購入と解錠」1カード統合(2026-07-17設定ゼロベース裁定#7)。入力欄1つでPro/追加レシピ
    // パックのどちらのコードも受け付け、種類(UR-/UP-)は自動判定する(src/logic/pro.tsの
    // detectCodeKind)。既存の相互判定ヒント(旧proCodeIsPackCode/packCodeIsProCode。
    // 「違う欄に入力してください」という案内)は、「そのまま正しい方で解錠する」という
    // 発展形になったため役目を終え、この統合で削除した
    unlockTitle: '購入と解錠',
    unlockDescription:
      '解錠コードを入力すると、Pro版または追加レシピパックが使えるようになります。コードの種類は自動で判定されます',
    unlockCodePlaceholder: '解錠コード (例: UR-XXXX-XXXX / UP-XXXX-XXXX)',
    unlockActivate: '解錠する',
    unlockActivating: '確認中…',
    unlockUnknownCode: 'コードの形式が正しくありません（UR-またはUP-で始まるコードを入力してください）',
    unlockStatusActive: '解錠済み',
    unlockStatusInactive: '未解錠',
    // Pro解錠済みのときの追加レシピパック行に出す案内(旧packNotNeededWithProの後継。
    // Pro解錠済みなら入力欄自体を出さないため、状態一覧の行内表示に位置づけを変更した)
    packIncludedInPro: 'Pro版に含まれています',
    // 解錠コードの控え表示+コピー(2026-07-17設定ゼロベース裁定#4。機種変更時の「購入の復元」用)
    unlockCodeCopy: 'コピー',
    unlockCodeCopied: 'コピーしました',
    unlockCodeToggleAria: 'コードの表示を切り替え',
    proTitle: 'Pro版',
    proDescription: '並行調理ナビ・月間献立など、これから追加されるPro向け機能をすべて使えるようになります。',
    proInvalidCode: 'コードが正しくありません。ご購入時のコードをご確認ください',
    proActivatedTitle: 'Pro版をご利用いただきありがとうございます',
    proActivatedDate: '解錠日: {date}',
    // Pro解錠直後に「何が使えるようになったか」を控えめに案内する(2026-07-09ペルソナ第2波)
    proActivatedFeaturesTitle: '使えるようになった機能',
    proActivatedFeatures: [
      '並行調理ナビ（献立タブから）',
      '月間ビュー（献立の週・月切替から）',
      'レシピテーマ（下のテーマ一覧から）',
    ] as string[],
    packTitle: '追加レシピパック',
    packDescription:
      '配布されているレシピテーマがすべて使えるようになる買い切りのパックです。今後追加されるテーマも、すべて追加料金なしで使えます（Pro版には最初から含まれています）。',
    packInvalidCode: 'コードが正しくありません。ご購入時のコードをご確認ください',
    packActivatedTitle: '追加レシピパックをご利用いただきありがとうございます',
    packActivatedDate: '解錠日: {date}',
    themeListTitle: 'テーマ一覧',
    themeListDescription:
      '興味のあるテーマだけ選んで取り込めます。テーマをタップすると収録レシピを確認できます（取り込みには追加レシピパックまたはPro版の解錠が必要です）。',
    themeListLoading: '読み込み中…',
    themeItemsCount: '収録レシピ（{n}品）',
    themeListEmpty: '現在配布中のテーマはありません',
    themeAdd: '追加する',
    themeAdded: '追加済み',
    themeAddAll: 'すべて追加',
    themeAddAllResult: '{n}件のテーマから追加しました',
    themeAddAllNone: '追加できる新しいテーマはありません',
    themeDelete: 'このテーマのレシピを削除',
    themeDeleteConfirm: '「{name}」のレシピをすべて削除します。よろしいですか？',
    themeDeleteDone: '「{name}」のレシピを削除しました（{n}件）',
    // 削除したセット品の再取込除外(トゥームストーン・2026-07-13 Fable設計)。
    // 個別に削除した品は再取込しても復活しない。このボタンで除外記録を消すと次の取込で戻る
    themeExclusionRestore: '除外中{n}品・すべて戻す',
    themeExclusionRestored: '「{name}」の除外を解除しました。次にこのテーマを取り込むと戻ります',
    aboutTitle: 'うちレシピについて',
    // バージョン+データ件数(2026-07-17設定ゼロベース裁定#3。問い合わせ対応に必須)
    aboutVersion: 'バージョン {v}',
    aboutDataCount: 'レシピ {r}件・作った記録 {c}件',
    aboutPageLink: 'アプリの紹介ページを見る',
    termsLink: '利用規約・プライバシーポリシー',
    feedbackLink: 'ご意見箱',
    feedbackFormUrl: 'https://forms.gle/NcyrQTg1hbgtMMPTA',
    backupImportDone: '{n}品のレシピを読み込みました',
    backupImportMergeResult: '追加{a}件・スキップ{s}件',
    backupImportError: 'ファイルを読み込めませんでした。うちレシピのバックアップファイルか確認してください',
    priceMasterTitle: '食材と価格',
    priceMasterDescription: '頻出食材の目安価格を登録・編集できます。材料に価格を入れていないレシピの概算食費に使われます',
    priceMasterLink: '食材と価格を編集する',
  },
  effort: {
    easy: '超簡単',
    normal: 'ふつう',
    fancy: '手の込んだ',
  },
  season: {
    spring: '春',
    summer: '夏',
    autumn: '秋',
    winter: '冬',
    all: '通年',
  },
  dishType: {
    main: '主菜',
    side: '副菜',
    soup: '汁物',
    dessert: 'デザート',
  },
  recipes: {
    title: 'レシピ',
    empty: 'まだレシピがありません',
    emptyHint: '右下の「＋」から最初のレシピを登録しましょう',
    addRecipe: 'レシピを登録',
    minutesSuffix: '分',
    freeLimitNearBanner: '無料版はあと{n}件登録できます（既存のレシピはこのまま全部使えます）',
    themeShortcut: 'レシピテーマを見る →',
  },
  search: {
    placeholder: '料理名・材料・タグで検索',
    // 並び替え/絞り込みボタン(2026-07-16 便T: 従来は絞り込みボタン1つに両方入っていたが別ボタンに分離)
    sortToggle: '並び替え',
    filterToggle: '絞り込み',
    ingredientTitle: '使いたい食材から探す',
    ingredientPlaceholder: '食材を1つずつ入力',
    timeTitle: '調理時間',
    timeAll: 'すべて',
    timeUnder10: '〜10分',
    timeUnder30: '〜30分',
    timeOver30: '30分超',
    effortTitle: '手間レベル',
    effortAll: 'すべて',
    tagTitle: 'よく使うタグ',
    tagAll: 'すべて',
    favoriteOnly: 'お気に入り',
    excludeNg: 'NG食材を含むレシピを隠す',
    myRecipesOnly: '自分で登録したレシピのみ',
    // 「時短レシピ」→「時短レシピのみに絞る」(2026-07-16 便T-5: 何をする絞り込みか分かる文言に)
    quickOnly: '時短レシピのみに絞る',
    sortTitle: '並べ替え',
    sortUpdated: '更新順',
    sortPantryMatch: '在庫との一致が多いレシピ順',
    // 「あいうえお順」→「五十音順」(2026-07-16 便T-5)
    sortKana: '五十音順',
    sortCooked: 'よく使う順',
    // 基本レシピ順(2026-07-17オーナー指示で「テーマごと」として新設。2026-07-20 便AMで
    // 第◯弾/テーマの括りを廃止し①基本レシピ(公式全部)→②自作レシピの2区分に単純化・改称)。
    // 降順トグルで全体反転。追加のグループ見出しは出さず、既存の「基本レシピ」バッジ(RecipeCard)が
    // そのまま「どちらの塊か」の表示を兼ねる
    sortTheme: '基本レシピ順',
    // 栄養並び替え(2026-07-13 Fable設計→2026-07-16 便Tで5項目全部Pro機能化。「(1食)」表記は
    // 見出し「栄養価で並び替え」で1食あたりであることが分かるため省いた)
    sortKcal: 'カロリー',
    sortProtein: 'たんぱく質',
    sortSalt: '塩分',
    sortFat: '脂質',
    sortCarb: '糖質',
    // 栄養並び替えの区分見出し(Pro解錠済み時)とPro未解錠時のグレーのティーザー行(2026-07-16 便T-4)。
    // タップでPro案内(/settings?section=pro)へ、既存のProゲート表現(Lock+ミュート色+underlineリンク)を流用
    sortNutritionTitle: '栄養価で並び替え',
    sortNutritionGate: '栄養価で並び替え（Pro機能）',
    // 並べ替えの昇順/降順トグル(2026-07-13 UI改善)。既定は並べ替えの種類ごとに異なる
    // (五十音順のみ昇順が既定、それ以外は降順が既定。logic/recipeSort.tsのdefaultSortDirection参照)
    sortAsc: '昇順',
    sortDesc: '降順',
    // 絞り込み無しでも常に表示する総件数(2026-07-13 UI改善)
    totalCount: '全{n}件',
    // 絞り込み中は「結果件数 / 総件数」の形でまとめて表示する
    resultCountWithTotal: '{n}件 / 全{t}件',
    noResult: '条件に合うレシピが見つかりません',
    noResultHint: '右下の「＋」ボタンから自分のレシピを登録できます',
    usedAll: '入れた食材ぜんぶ使える',
    usedSome: '食材 {m}/{t} が使える',
    clear: '条件をクリア',
    apply: '決定',
    // 一覧の表示切替(グリッド/リスト。2026-07-13 UI改善)。ボタンは現在の表示から
    // 切り替わる先のアイコン・aria-labelを出す(押すと何になるかが分かるように)
    layoutToggleToList: 'リスト表示に切り替え',
    layoutToggleToGrid: 'グリッド表示に切り替え',
  },
  card: {
    ngBadge: 'NG食材を含む',
    todayBadge: '今日の献立に追加済み',
    starterBadge: '基本レシピ',
    /** 「時短」絞り込み中、調理時間をquickCookMinutesに切り替えたときに数字の前に添える */
    quickTimePrefix: '時短',
    /** 栄養価並び替え中のカードバッジ(便T-7)。「カロリー: 350kcal」のようにラベル+値で組み立てる
     * ときの区切り(2026-07-16オーナー指示: ラベル付き表示に変更) */
    nutrientBadgeSeparator: ': ',
  },
  paste: {
    open: 'テキスト貼り付けで自動入力',
    description: 'レシピの文章を貼り付けると、材料と手順に自動で振り分けます。結果は必ず確認して直せます',
    placeholder: 'ここにレシピの文章を貼り付け',
    apply: '自動で振り分ける',
    close: '閉じる',
    empty: '文章を貼り付けてください',
    resultNone: '材料や手順を見つけられませんでした。手入力をお願いします',
    resultPoor:
      'この文章の形はうまく振り分けられませんでした。読み取れた分だけ入れたので、お手数ですが手で直してください。「材料」「作り方」の見出しや改行のある文章は上手に読み取れます',
    resultSummary: '材料{i}件・手順{s}件を読み取りました。内容を確認して修正してください',
  },
  urlImport: {
    open: 'URLから取り込む',
    description:
      'レシピのページのURLを貼り付けると、材料と手順を自動で読み込みます。対応していないサイトもあります',
    placeholder: 'https://…',
    // 「写真も取り込む」チェック(2026-07-21 オーナー指示)。既定ON・その場限り(保存しない)。
    // 説明文はオーナー指定の2点(できないことがある注意+容量注意)を1文にまとめたもの
    fetchPhoto: '写真も取り込む',
    fetchPhotoNote: 'サイトによっては写真を取り込めないことがあります。写真のぶん保存容量が多くなります',
    apply: '読み込む',
    loading: '読み込み中…',
    close: '閉じる',
    empty: 'URLを入力してください',
    errorInvalidUrl: 'URLの形式が正しくありません',
    // no_recipe/fetch_failedの案内文は既存の「テキスト貼り付け」欄への導線を兼ねる(下に配置している前提の文言)
    errorNoRecipe:
      'このサイトは自動取り込みに対応していません。ページの文章をコピーして、下の貼り付け欄をお使いください',
    errorFetchFailed: '読み込めませんでした。時間をおいて試すか、貼り付けをお使いください',
    resultSummary: '材料{i}件・手順{s}件を読み込みました。内容を確認して修正してください',
    // レシピ写真の自動取り込み(2026-07-21)はベストエフォート: 取れた場合だけ結果メッセージに追記する
    // (取れなくてもエラー表示はしない=写真だけ無しで従来どおりアイコン表示のまま)
    photoImported: '写真も取り込みました',
  },
  share: {
    button: 'シェア',
    textOption: 'テキストでシェア',
    imageOption: '画像カードでシェア',
    copied: 'レシピの文章をコピーしました',
    downloaded: '画像を保存しました',
    generating: '画像を作成中…',
    failed: 'シェアできませんでした',
    moreIngredients: '…ほか',
    // シェアの選択式モーダル(2026-07-16 Fable裁定docs/30裁定3)。
    // 「作り方は全◯ステップ」行はオーナーの固定項目列挙に無いため削除(字義解釈・オーナー報告事項)。
    // {lines}には選択された任意行(調理時間/原価/栄養)が「行+改行」の形で入る(無選択なら空文字=従来形式)
    textTemplate: '{title}（{servings}人分）\n{lines}\n【材料】\n{ingredients}\n\n#{app}\nhttps://{url}/',
    dialogTitle: 'シェアする内容',
    alwaysIncluded: '料理名・食数・材料（最初の8件）は常に入ります',
    optImage: 'レシピ画像（写真またはアイコン）',
    optImageCardOnly: '※画像カードのみ',
    optCookMinutes: '調理時間',
    optCost: '原価',
    optNutrition: '1食あたりのカロリー・塩分',
    optAllIngredients: '材料をすべて載せる',
    lineCookMinutes: '調理時間 約{n}分',
    lineCost: '原価 1人分 約{n}円／全量（{s}人分） 約{m}円',
    lineNutrition: '1食あたり 約{kcal}kcal・塩分 約{salt}g（めやす）',
  },
  form: {
    newTitle: 'レシピを登録',
    editTitle: 'レシピを編集',
    // 「かんたん / くわしく」タブ(2026-07-16 Fable裁定docs/26・案A)。かんたんだけで保存完結、
    // くわしくは全部任意。新規・編集とも初期表示は常にかんたん
    formTabSimple: 'かんたん',
    formTabDetail: 'くわしく',
    formTabDetailFilledHint: '入力済みの項目があります',
    nameLabel: '料理名',
    namePlaceholder: '例: 肉じゃが',
    nameRequired: '料理名を入力してください',
    // ひとこと説明(任意。2026-07-13)。料理名だけでは中身が想像しにくい料理向けの短い説明文
    introLabel: 'ひとこと説明（任意）',
    introPlaceholder: '例: ヨーグルトに二種類のソースをかけた見た目も楽しいデザートです',
    freeLimitBlocked: '無料版の登録上限（50件）に達しました。上限の解除はPro版（開発中）で提供予定です。お困りの場合は設定画面の「ご意見箱」からお声をお寄せください（今までのレシピはそのまま使えます）',
    // 「画像」= 写真/アイコンの3択をまとめたセクション見出し(2026-07-16 Fable裁定docs/30
    // 裁定2【画像の3択】。旧「写真」から改称。値だけ変更・キー名は既存のphotoLabelのまま)
    photoLabel: '画像',
    photoTake: 'カメラで撮る',
    photoPick: 'アルバムから選ぶ',
    photoRemove: '写真を削除',
    photoError: '写真を読み込めませんでした',
    servingsLabel: '人数分',
    servingsUnit: '人分',
    cookMinutesLabel: '調理時間（分）',
    cookMinutesPlaceholder: '例: 30',
    effortLabel: '手間レベル',
    ingredientsLabel: '材料',
    ingredientName: '名前',
    ingredientNamePlaceholder: '例: じゃがいも',
    ingredientAmount: '分量',
    ingredientAmountPlaceholder: '例: 3',
    ingredientUnit: '単位',
    ingredientUnitPlaceholder: '例: 個',
    // 材料ごとの価格入力欄は撤去し「食材と価格」ページに一元化(2026-07-14 オーナー要望)。
    // この画面には案内の一文とリンクだけを表示する(mealPlan.weekCostNote/weekCostNoteLinkと同じ形)
    ingredientPriceGuide: '価格は「食材と価格」ページでまとめて管理します',
    ingredientPriceGuideLink: '食材と価格を編集する',
    ingredientMemoPlaceholder: '材料メモ（任意。例: なければ玉ねぎでも可）',
    ingredientGroupHint:
      '丸いボタンをタップすると色がつきます。同じ色の材料は先にまとめて計量してOKという意味です（合わせ調味料）',
    ingredientGroupNone: '合わせ調味料グループ: なし（タップで設定）',
    ingredientGroupSet: '合わせ調味料グループ{n}（タップで切替、外すには色がなくなるまで押す）',
    addIngredient: '材料を追加',
    stepsLabel: '手順',
    stepTextPlaceholder: '例: じゃがいもを一口大に切る',
    stepMinutes: '分（任意）',
    stepMinutesPlaceholder: '例: 10',
    stepMemoPlaceholder: '手順メモ（任意。例: 焦げやすいので注意）',
    addStep: '手順を追加',
    tagsLabel: 'タグ',
    tagPlaceholder: '例: 和食、作り置き など',
    addTag: '追加',
    removeTag: 'タグを外す',
    keywordsLabel: '検索キーワード（任意）',
    keywordsDescription: '一覧や詳細には表示されません。検索だけに使われます',
    keywordPlaceholder: '例: チンジャオロース、おつまみ など',
    addKeyword: '追加',
    removeKeyword: 'キーワードを外す',
    // ワンポイント/メモの2区画化(2026-07)。ワンポイント=こつ・知識・豆知識、
    // メモ=保存方法・注意書き・安全。既存レシピのmemoはメモ側のまま(既存データ破壊なし)
    onePointLabel: 'ワンポイント（任意）',
    onePointPlaceholder: 'こつ・知識など。例: 味噌は煮立てると香りが飛ぶので最後に',
    memoLabel: 'メモ',
    memoDescription: '保存方法・注意書きなど',
    memoPlaceholder: '気づいたこと・アレンジなどを自由に',
    sourceUrlLabel: '参照元URL（任意）',
    sourceUrlPlaceholder: 'https://…',
    // iconLabelは「画像」3択への統合(裁定2)でセクション見出しとしては使わなくなったため削除。
    // 折りたたみの開閉ボタン文言はiconPickOpen、展開時の説明文はiconDescriptionを流用
    iconPickOpen: 'アイコンから選ぶ',
    iconDescription: '一覧・詳細で写真の代わりに使うアイコンです。「自動」なら料理名・材料から自動で選びます',
    iconAuto: '自動',
    iconShowInsteadOfPhoto: '写真ではなくアイコンを表示',
    iconShowInsteadOfPhotoDescription: '写真を登録していても、一覧・詳細でアイコンを優先表示します',
    seasonLabel: '季節（任意）',
    seasonDescription: 'ホームの「今日なに作る？」で、今の季節のレシピが優先されます。もう一度押すと解除できます',
    suitableForLabel: '向いている時間帯（任意）',
    suitableForDescription:
      '献立プランナーの自動提案で優先されます。何も選ばなければ制限なしとして扱われます',
    dishTypeLabel: '料理の種別（任意）',
    dishTypeDescription:
      '献立プランナーの主菜・副菜の自動提案に使われます。もう一度押すと解除できます',
    draftFound: '書きかけの下書きがあります。復元しますか？（写真は下書きに含まれません）',
    draftRestore: '復元する',
    draftDiscard: '破棄する',
    save: '保存する',
    saving: '保存中…',
    cancel: 'キャンセル',
    moveUp: '上へ移動',
    moveDown: '下へ移動',
    removeRow: 'この行を削除',
    confirmRemoveRow: 'この行を削除しますか？',
    deleteRecipe: 'このレシピを削除',
    confirmDelete: 'このレシピを削除します。よろしいですか？',
    // 「デフォルトに戻す」(2026-07-15 オーナー要望)。編集画面限定でDBには書き込まず、
    // フォームの入力値だけを差し替える(保存を押すまで確定しない安全設計)。
    // 自作レシピ=前回保存した内容、基本レシピ/配布セット由来=原本(デフォルト)に戻す
    resetToSavedLabel: '前回保存した内容に戻す',
    resetToDefaultLabel: 'デフォルトに戻す',
    // window.confirmは使わず、もう一度押す方式で誤操作を防ぐ(押すとこの文言に切り替わり、
    // もう一度押すと実行される。数秒操作が無ければ元のラベルに自動で戻る)
    resetConfirmLabel: 'もう一度押すと戻します',
    resetting: '確認中…',
    resetFeedback: 'まだ保存されていません。保存すると確定します',
    resetStarterNotFound: 'デフォルトの元になるレシピが見つかりませんでした',
    resetSetFetchError:
      'デフォルトの内容を取得できませんでした。通信状況を確認してからもう一度お試しください',
  },
  detail: {
    notFound: 'レシピが見つかりませんでした',
    backToList: 'レシピ一覧へ戻る',
    ingredients: '材料',
    seasoningGroupHint: '左に同じ色のラインがある材料は、先にまとめて計量してOKです（合わせ調味料）',
    steps: '手順',
    normalMode: '通常',
    quickMode: '時短',
    /** 通常/時短タブに調理時間を併記するときの形（{mode}=normalMode/quickMode, {n}=分数） */
    modeLabelWithMinutes: '{mode}（{n}分）',
    servingsUnit: '人分',
    servingsDown: '人数を減らす',
    servingsUp: '人数を増やす',
    favoriteOn: 'お気に入りに追加',
    favoriteOff: 'お気に入りを解除',
    priceAbout: '約',
    priceYen: '円',
    // 1食あたりの概算食費(2026-07-14 オーナー実機フィードバック: 合計だけでなく
    // 1食分の目安も見たい。{n}=合計÷表示中のservingsを丸めた値)
    pricePerServing: '1食あたり 約{n}円',
    // 材料行ごとの原価ビュー切り替え(2026-07-15 オーナー要望「どの食材が値段に反映されて
    // いるかが分からない」への対応。常時表示は「うるさい」で2026-07-14に廃止済みのため、
    // 見出し行のチップで表示・非表示を切り替える方式にした。既定は非表示)。
    // 2026-07-20 便AJ(docs/45)で「原価を見る」(閲覧=1食あたり按分)と「原価を編集」(単価編集)の
    // 2ボタンに再改修。それぞれ選択中はaria-pressedで示し、選択中のボタンをもう一度押すと
    // 非表示に戻る(2択とも「その状態を再度押す」で閉じるトグル)
    priceViewShow: '原価を見る',
    priceEditShow: '原価を編集',
    // 原価を編集モードの説明(2026-07-20 便AJ・オーナー指示の文言をそのまま使用)。
    // チップ表(登録単位と価格)の上に表示し、ここでの価格変更が「食材と価格」マスタに
    // 保存される旨を明記する
    priceEditNote: 'ここで変更した価格は「食材と価格」に保存されます',
    // マスタ不一致かつ個別入力も無い材料（原価ビューの本体: どの材料が金額に反映されていないかを明示する）
    priceNone: '価格なし',
    // 材料行の「価格なし」チップの登録導線
    costAddPrice: '登録',
    // 「原価を見る」ON時、材料行の計量表記の位置に出す1食あたりの按分原価(2026-07-20 便AJ)。
    // estimateIngredientRowCostのperServingYenが四捨五入で0になった(=1円未満)ときの表示
    costUnderOneYen: '1円未満',
    // レシピ個別入力(ing.price)がある行の表示。マスタ編集の対象外のため編集チップにはしない
    costRecipeSpecific: '約{n}円（このレシピ専用）',
    // 価格編集モーダル(裁定1: インライン不採用・CookedLogModal様式の中央カード窓)。
    // 編集モードのダイアログaria-label({name}=マスタ行の食材名。可視の見出しは食材名そのもの)
    costEditTitle: '{name}の価格を編集',
    // 登録モードのダイアログaria-label兼可視の見出し(名前は別欄で編集可のため見出しは固定文言)
    costAddTitle: '食材を価格に登録',
    // 登録時にaddPriceEntryがduplicateを返した(かな揺れでmatchは外れたがマスタに実在)場合の案内。
    // モーダルを編集モードへ切り替えたうえでこの文言を表示する({name}=既存のマスタ名)
    costEditExists: '「{name}」として登録済みです。こちらを編集できます',
    minutesSuffix: '分',
    /** 手順文中に時間が出てこない工程のタイマー(2026-07-12: 唐突に見える指摘への対応)。
     * ラベル体「目安◯分」にする(文章体「◯分が目安」は続くとくどく、ボタンに見えない
     * というオーナー指摘で改稿。これはUIボタンのラベルであってレシピ本文ではないため、
     * 本文の表記規約とは別枠) */
    minutesStandalonePrefix: '目安',
    // ワンポイント/メモの2区画化(2026-07)。表示順は①ワンポイント→②メモ(オーナー承認済み)
    onePoint: 'ワンポイント',
    memo: 'メモ',
    source: '参照元',
    edit: '編集する',
    ngWarning: 'NG食材を含みます',
    cooked: '作った！',
    cookedDialogTitle: '作った記録をつける',
    cookedDate: '日付',
    cookedNote: 'ひとことメモ（任意）',
    cookedNotePlaceholder: '例: 少し甘めにしたら好評だった',
    cookedPhotoLabel: '写真（任意）',
    cookedPhotoView: '写真を拡大表示',
    cookedLogPhotoRemove: 'この記録の写真を削除',
    cookedSave: '記録する',
    cookedRecordedToast: '作った記録をつけました',
    cookedCancel: 'やめる',
    cookedLogsTitle: '作った記録',
    cookedCountSuffix: '回',
    cookedLogEdit: 'この記録を編集',
    cookedLogEditTitle: '記録を編集',
    cookedLogNotePlaceholder: 'ひとことメモ（任意）',
    cookedLogSave: '保存する',
    cookedLogCancel: 'やめる',
    // 「今日つくる」→「今日の献立に追加」(2026-07-16 UI総点検B-8オーナー決定)。
    // todayAdded(既に追加済みの表示)は変更しない
    todayAdd: '今日の献立に追加',
    todayAdded: '今日の献立に追加済み',
    // スロット振り分け窓(2026-07-17 便Z-1・docs/35 §2 Fable設計)。「今日の献立に追加」の
    // 直接追加をこの窓経由に置き換える。朝/昼/夕({slot})=週プランの今日のその枠+今日の献立の
    // 両方へ、「決めない」=従来どおり今日の献立へ直接(枠なし)
    todaySlotDialogTitle: 'どの食事に入れますか？',
    todaySlotDialogHint: '朝食・昼食・夕食を選ぶと、今週の予定（今日の枠）と今日の献立の両方に入ります',
    todaySlotUndecided: '決めない',
    todaySlotAddedToast: '今日の{slot}に追加しました',
    todaySlotDuplicateToast: '今日の{slot}にすでに入っています',
  },
  focus: {
    open: '調理中モードで見る',
    openHint: '大きな文字で1手順ずつ表示',
    stepCounter: '手順 {n}/{t}',
    close: '閉じる',
    prev: '前へ',
    next: '次へ',
    complete: '完成！',
    read: '読み上げ',
    stop: '止める',
    readUnsupported: 'お使いのブラウザは読み上げに対応していません',
    micStart: '声で操作する',
    micStop: '声の操作をやめる',
    micHint: '声で操作:「次へ」「戻って」「もう一回」「タイマー」「ストップ」',
    micListening: '聞いています…',
  },
  nutrition: {
    // 栄養価のめやす(M6-1)の文言。トーンは既存のPro案内(月間献立・並行調理ナビのゲート)と同じ控えめ路線を保つこと
    title: '栄養価のめやす',
    proBadge: 'Pro',
    gateLink: 'Pro版について見る',
    // 折りたたみ(2026-07-11 オーナー実機フィードバック: 面積を取りすぎるため既定は1行のみ)。
    // 「{title}{summaryLabel}{数値}」の順で1行に組み立てる
    summaryLabel: '（1食あたり）: ',
    saltShortLabel: '塩分',
    // 材料が丸ごと計算対象外などで1食あたりが実質求まらないときの1行表示(「0kcal」という
    // 誤解を招く数値を出さないためのフォールバック)
    unavailableSummary: '材料からは計算できませんでした',
    toggleExpand: '栄養価のめやすを詳しく見る',
    toggleCollapse: '栄養価のめやすを閉じる',
    // 状態3（Pro解錠済み・実パネル / M6-1 UI統合③）の文言。
    // 「概算・めやす」であることを必ず明示し、医療・効能の文脈は使わない。
    // 計算対象外の材料は隠さず件数と材料名で明示する。
    estimateBadge: '概算',
    servingHeader: '1人分',
    totalHeader: '全量（{n}人分）',
    kcalLabel: 'エネルギー',
    kcalUnit: 'kcal',
    proteinLabel: 'たんぱく質',
    fatLabel: '脂質',
    carbLabel: '炭水化物',
    saltLabel: '塩分相当量',
    // 2026-07-13 第2弾(オーナー承認・Fable設計): Pro側パネルに食物繊維・鉄・カルシウムを追加
    fiberLabel: '食物繊維',
    ironLabel: '鉄',
    calciumLabel: 'カルシウム',
    gramUnit: 'g',
    mgUnit: 'mg',
    estimateNote: '※ 材料と分量から自動計算しためやすです。調理による変化などは反映しておらず、実際の栄養価とは異なります。',
    // ビタミンを表示しない理由の注記(2026-07-13オーナー指示・文面確定。一字一句変更しないこと)
    vitaminNote: '※ ビタミンは調理による損失が大きく、材料からの計算では実際と大きくズレやすいため表示していません',
    assumedLabel: '仮の目安で計算 {n}件',
    assumedHint: '分量が「少々」「適量」の材料は、次の仮の量で計算に含めています。',
    excludedLabel: '計算対象外 {n}件',
    // 2026-07-21分量表記拡充: URL取り込みレシピでは「単位をグラムに変換できない」(パック等の
    // 包装単位が辞書に無い等)ケースが実際に起こるため、既存の3ケース(食材データが無い/分量が数値でない/
    // 下ごしらえ用)に加えて明記した(旧文言は自社カタログではunit理由が0件だったため触れていなかった)
    excludedHint: '次の材料は、成分データが無い・分量や単位を数値に変換できない・塩もみなど下ごしらえ用で洗い流す、といった理由で計算に含めていません。',
    sourcePrefix: '出典: ',
    // 2026-07-21・オーナー決定: グラノーラ・コチュジャンの2品は八訂に収載が無いため、
    // 市販品の栄養成分表示を参考にした概算値で追加した。出典表記の末尾に必ず添えること
    sourceCommercialNote: '※一部、市販品の栄養成分表示を参考にした概算を含みます',
    // 無料版でも表示する基本2項目（エネルギー・食塩相当量）用(2026-07-10 バッチH-4)
    perServingLabel: '1食あたり',
    // 未解錠案内の冒頭に置く、Pro版で増える項目の明示（2026-07-13 UIペルソナQA:
    // 「Pro版で何が増えるか」が伝わりにくいとの指摘。断定・誇大な表現は避け、事実のみを1文で書く）
    proNutrientHighlight: 'Pro版では、たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウムのめやすも表示されます。',
    freeDescription:
      'たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウムのめやすは、Pro版で見られるようになる予定です（現在開発中）。',
    // Pro解錠済みユーザー向け: 「解錠したのに残りが見えない」と誤解させない文言
    freeDescriptionPro:
      'たんぱく質・脂質・炭水化物などの残りの項目は、Pro特典として開発中です。公開されると自動で使えるようになります。',
  },
  term: {
    // 用語タップ辞書(2026-07-11)。タップ可能な語のaria-label・調理中モードのチップ欄・
    // ポップオーバーの文言をここに集約する
    openAria: '{term}の説明を見る',
    closeAria: '説明を閉じる',
    chipLabel: '用語: ',
    // 用語の常時表示(2026-07-11オーナー実機フィードバック): 「用語＝説明文」形式の区切り記号
    definitionSeparator: '＝',
  },
  timer: {
    start: 'タイマー開始',
    done: '終わり',
    dismiss: 'タイマーを閉じる',
    stepLabel: '手順{n}',
    mute: 'このタイマーを消音',
    unmute: 'このタイマーの音を戻す',
    notificationTitle: 'うちレシピ',
    notificationBody: '「{label}」のタイマーが終わりました',
    notice:
      'タイマーの通知と音は、アプリを開いている間だけ動きます（アプリの仕組み上の制限です）',
    // 実行中タイマーの±調整(窓方式。2026-07-12タイマー自由設定バッチ・Fable設計docs/20 §6)。
    // 常駐バー・調理中モードの動作中タイマー表示をタップすると開く窓の文言
    adjustOpenAria: '{label}のタイマーを調整',
    adjustDialogTitle: 'タイマーを調整',
    plusOneMinute: '+1分',
    // 常駐バー行の「+1分」ミニボタン(2026-07-13 UIペルソナQA)。複数タイマー同時進行でも
    // どのタイマーへの操作か区別できるようaria-labelにlabelを差し込む(adjustOpenAriaと同じ流儀)
    plusOneMinuteAria: '{label}に1分追加',
    minusThirtySeconds: '−30秒',
    stopTimer: '停止',
    // じぶんタイマー(自由な分数で始めるタイマー。同バッチ)。ラベルは常にこの文言(レシピ名にしない)
    customLabel: 'じぶんタイマー',
    customOpenAria: 'じぶんタイマーを開く',
    customBarButton: 'じぶんタイマー',
    customStart: '開始',
    customMinutesDown: 'じぶんタイマーの分数を減らす',
    customMinutesUp: 'じぶんタイマーの分数を増やす',
    // 秒刻み操作の追加分(2026-07-12オーナー実機フィードバック)。visible textをそのままaria-labelとして
    // 使う(TimerAdjustModalの「−30秒」「+1分」ボタンと同じ流儀。aria-label重複はダイアログのスコープが
    // 別なので問題ない)。±1分ボタンはアイコンのまま(テキスト化しない)にする: 残り時間の表示自体に
    // 「1分」のような文字列が出るため、ボタンにも同じ文字列を乗せるとE2Eのテキスト一致チェックで
    // 表示文言とボタン文言の区別がつかなくなるため
    minusTenSeconds: '−10秒',
    plusTenSeconds: '+10秒',
    plusThirtySeconds: '+30秒',
    secondsSuffix: '秒',
  },
  // 食材価格マスタ「食材と価格」画面(docs/20 §3)。
  // 2026-07-12 UX改修: 編集モーダル方式をやめ、一覧の各行を直接編集できる形にした
  // （オーナー実機フィードバック: 「編集が面倒くさい」「目安/自分の価格の反映状況が見えない」）
  // 2026-07-13: マスタ価格を使ったときの注記(mixedNote)はレシピ詳細・週の献立の両方から
  // オーナー実機フィードバックで削除済み(定義も撤去)
  priceMaster: {
    title: '食材と価格',
    // 表記の簡素化(2026-07-13 UI改善: 「目安」/「自分の価格」バッジを廃止し、
    // 代わりにページ冒頭のこの一文だけで説明する)
    disclaimer: 'はじめから入っている価格は目安です。タップすると自分の価格に直せます',
    empty: 'まだ食材が登録されていません',
    searchLabel: '食材名で絞り込む',
    searchPlaceholder: '食材名で絞り込む',
    searchEmpty: '該当する食材が見つかりません',
    nameLabel: '食材名',
    namePlaceholder: '例: 玉ねぎ',
    priceLabel: '価格（円）',
    pricePlaceholder: '例: 50',
    // 2026-07-15 UI改修: 単位欄を「数量(数字)＋単位(選択)」に分離(オーナー実機フィードバック:
    // 自由入力だと不安・使いにくい)。unitLabel/unitPlaceholderは、単位選択で「その他」を
    // 選んだときだけ出す自由入力欄のラベルに用途を変更した(従来の自由入力欄そのもの)
    quantityLabel: '数量',
    quantityPlaceholder: '例: 100',
    unitTypeLabel: '単位',
    unitOther: 'その他',
    unitLabel: 'その他の単位（自由入力）',
    unitPlaceholder: '例: 1/4個、少々',
    add: '追加',
    // 二重登録防止(2026-07-14 オーナー実機フィードバック): 正規化(前後空白・括弧書き除去)して
    // 一致する食材が既にマスタにあるときに出す案内。既存の行を優先し、重複行は作らない
    duplicateName: '「{name}」は既に登録済みです',
    remove: 'この食材を削除',
    priceYen: '円',
    // 一覧の各行のインライン編集欄（食材名ごとに区別できるようaria-labelへ{name}を差し込む）
    entryPriceAria: '{name}の価格（円）',
    entryQuantityAria: '{name}の数量',
    entryUnitAria: '{name}の単位',
    entryUnitOtherAria: '{name}のその他単位（自由入力）',
    // 上書き済みの行を投入時の価格へ戻すボタン(2026-07-13「目安に戻す」→「デフォルトに戻す」に変更)
    resetToDefault: 'デフォルトに戻す',
    resetToDefaultAria: '{name}をデフォルト価格に戻す',
    // レシピ詳細の材料行: 個別価格が無くマスタの目安価格から計算した行にだけ出す控えめな注記。
    // 一致したマスタ行が投入時の目安のままなら「目安」表記、ユーザーが上書きした価格なら
    // 「目安」を外す(2026-07-13 UIペルソナQA: 自分で入れた価格に「目安」と付くのは違和感があるため)
    ingredientFromMasterNote: '（目安{n}円）',
    ingredientFromMasterNoteCustom: '（{n}円）',
  },
} as const

export type Messages = typeof ja
