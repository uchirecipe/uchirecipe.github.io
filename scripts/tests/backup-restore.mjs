// バックアップと書き出し（置き換え・マージ・確認文）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import {
  saveCookNaviSession,
  loadCookNaviSession,
  clearCookNaviSession,
  COOK_NAVI_SESSION_KEY,
} from '../../src/logic/cookNaviSession.ts'
import {
  tablesToReplace,
  mergeUnlockCodes,
  countReplaceImpact,
  daysSinceBackup,
  backupNoticeKind,
  buildReplaceSettings,
  mergeTableRows,
  mergeRowKeys,
  resolveMergeRecipeAction,
  mergeRecipeUserData,
  remapBackupRecipeRefs,
  buildSelectedRecipesExportConfirm,
  buildReplaceConfirm,
  buildUndoReplaceConfirm,
} from '../../src/logic/backup.ts'
import {
  supportsSaveFilePicker,
  backupFileName,
  selectedRecipesFileName,
  isAbortError,
} from '../../src/logic/fileSave.ts'
import {
  ARCHIVE_KIND,
  ArchiveFileError,
  archiveCutoffDate,
  archiveFileName,
  archiveIdsForRecipe,
  buildArchiveFile,
  collectArchiveTargets,
  countArchiveTargets,
  formatArchiveDate,
  mergeArchiveLogs,
  parseArchiveFile,
} from '../../src/logic/cookedArchive.ts'
import {
  photoReplacePlan,
  replaceConfirmTargets,
  needsReplaceConfirm,
} from '../../src/logic/replaceConfirm.ts'
import { ja } from '../../src/i18n/ja.ts'
import { confirmContentText } from '../../src/logic/confirmContent.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// ---------- tablesToReplace(バックアップの全ユーザーデータ対応・2026-07-13
// データ堅牢性強化: 在庫・買い物メモ・週献立・今日の献立・食材価格マスタの復元判定)。
// undefined(=項目自体が無い古いバックアップ)と空配列[](=空にする意図)を区別できることが
// 後方互換の要(fake-indexeddb等が無い環境のためDB本体でのclear非実行はE2Eで別途担保する。
// ここでは判定ロジックそのものを純ロジックとして固定する) ----------
{
  const baseFile = { app: 'uchi-recipe', version: 1, exportedAt: '', recipes: [] }
  eq(
    '全フィールドが無い(この対応より前の古いバックアップ)場合はすべて置き換え対象外',
    tablesToReplace(baseFile),
    {
      pantryItems: false,
      shoppingItems: false,
      mealPlans: false,
      todayList: false,
      prices: false,
      dayNotes: false,
      mealTemplates: false,
      mealPlanLocks: false,
      detachedLogs: false,
    },
  )
  eq(
    '空配列(テーブルを空にする意図)は置き換え対象になる(undefinedとの区別)',
    tablesToReplace({ ...baseFile, pantryItems: [], prices: [] }),
    {
      pantryItems: true,
      shoppingItems: false,
      mealPlans: false,
      todayList: false,
      prices: true,
      dayNotes: false,
      mealTemplates: false,
      mealPlanLocks: false,
      detachedLogs: false,
    },
  )
  eq(
    '中身入りの配列も置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      mealPlans: [{ date: '2026-07-20', slot: 'dinner', recipeId: 1, role: 'main' }],
      todayList: [{ recipeId: 1, addedAt: 1000 }],
    }),
    {
      pantryItems: false,
      shoppingItems: false,
      mealPlans: true,
      todayList: true,
      prices: false,
      dayNotes: false,
      mealTemplates: false,
      mealPlanLocks: false,
      detachedLogs: false,
    },
  )
  eq(
    '全フィールドが有る(空配列込み)場合はすべて置き換え対象',
    tablesToReplace({
      ...baseFile,
      pantryItems: [],
      shoppingItems: [],
      mealPlans: [],
      todayList: [],
      prices: [],
      dayNotes: [],
      mealTemplates: [],
      mealPlanLocks: [],
      detachedLogs: [],
    }),
    {
      pantryItems: true,
      shoppingItems: true,
      mealPlans: true,
      todayList: true,
      prices: true,
      dayNotes: true,
      mealTemplates: true,
      mealPlanLocks: true,
      detachedLogs: true,
    },
  )
  // 日付メモ(2026-07-29 便CB-1・docs/59 A-2)。新テーブルを足したときの後方互換の要:
  // この項目を持たない古いバックアップ(=undefined)を復元しても、端末に残っているメモを消さない
  eq(
    '日付メモの項目が無い古いバックアップは、復元してもメモのテーブルに触らない',
    tablesToReplace({ ...baseFile, mealPlans: [] }).dayNotes,
    false,
  )
  eq(
    '日付メモが中身入りで入っていれば置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      dayNotes: [{ date: '2026-07-30', text: '外食', updatedAt: 1000 }],
    }).dayNotes,
    true,
  )
  // マイ献立テンプレ(2026-07-29 便CB-2・docs/59 A-1)。日付メモと同じ後方互換のルール:
  // 項目を持たない古いバックアップを復元しても、端末に残っているテンプレを消さない
  eq(
    'テンプレの項目が無い古いバックアップは、復元してもテンプレのテーブルに触らない',
    tablesToReplace({ ...baseFile, mealPlans: [] }).mealTemplates,
    false,
  )
  eq(
    'テンプレが中身入りで入っていれば置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      mealTemplates: [
        { name: '平日の定番', items: [{ dow: 4, slot: 'dinner', role: 'main', recipeId: 1 }], createdAt: 1000 },
      ],
    }).mealTemplates,
    true,
  )
}

// ---------- mergeUnlockCodes(バックアップ修正1・2026-07-17: merge復元でPro・追加レシピ
// パックの解錠コードを「バックアップ側にあれば設定、無ければ既存を保持」で戻す。
// オーナー実害「ブラウザデータ消去→復元しても購入状態が戻らない」の再発防止。
// 空文字列/undefinedで既存コードを上書きしない=旧形式(コード無し)バックアップの
// 後方互換の要 ----------
{
  const noCode = {
    proCode: undefined,
    proActivatedAt: undefined,
    recipePackCode: undefined,
    recipePackActivatedAt: undefined,
  }
  const withProCode = {
    proCode: 'UR-AAAA-AAAA',
    proActivatedAt: 1000,
    recipePackCode: undefined,
    recipePackActivatedAt: undefined,
  }
  const withPackCode = {
    proCode: undefined,
    proActivatedAt: undefined,
    recipePackCode: 'UP-BBBB-BBBB',
    recipePackActivatedAt: 2000,
  }

  eq(
    'コード往復: 既存コード無し+バックアップにコード有り→採用する',
    mergeUnlockCodes(noCode, withProCode),
    withProCode,
  )
  eq(
    '既存コード有り+バックアップ側が旧形式(settings自体が無い=undefined)→既存を保持(消さない)',
    mergeUnlockCodes(withProCode, undefined),
    withProCode,
  )
  eq(
    '既存コード有り+バックアップのsettingsはあるがコード欄が無い(空)→既存を消さない(空で上書きしない)',
    mergeUnlockCodes(withProCode, noCode),
    withProCode,
  )
  eq(
    '既存Pro解錠済み+バックアップに別のPro解錠コード→バックアップ側を採用する(コードがあれば設定)',
    mergeUnlockCodes(withProCode, { ...noCode, proCode: 'UR-ZZZZ-ZZZZ', proActivatedAt: 9999 }),
    { proCode: 'UR-ZZZZ-ZZZZ', proActivatedAt: 9999, recipePackCode: undefined, recipePackActivatedAt: undefined },
  )
  eq(
    'proCodeとrecipePackCodeは独立に判定される(Pro解錠済みの状態でパックだけ含む古いバックアップをmerge)',
    mergeUnlockCodes(withProCode, withPackCode),
    { proCode: 'UR-AAAA-AAAA', proActivatedAt: 1000, recipePackCode: 'UP-BBBB-BBBB', recipePackActivatedAt: 2000 },
  )
  eq(
    '両方コード無しどうし→両方とも既存(undefined)のまま・エラーにならない',
    mergeUnlockCodes(noCode, noCode),
    noCode,
  )
}

// ---------- buildReplaceSettings(2026-07-30 便CJ/C2・S2事故の再発防止)。
// 「置き換え」でsettingsを持たないJSON(配布セット形式・レビュー用の書き出し・手編集)を読むと
// 解錠コード・NG食材・週の食費予算・テーマが既定値へ初期化されていた。
// settingsはあってもproCodeを含まないファイル(購入前に取った自分のバックアップ)でも
// 購入状態が消えていた ----------
{
  const current = {
    id: 1,
    ngIngredients: ['パクチー'],
    theme: 'dark',
    weeklyBudget: 5000,
    proCode: 'UR-AAAA-AAAA',
    proActivatedAt: 1000,
    starterSeeded: true,
  }
  const fromFile = {
    ngIngredients: ['セロリ'],
    theme: 'brown',
    weeklyBudget: 3000,
    proCode: 'UR-BBBB-BBBB',
    proActivatedAt: 2000,
  }
  const replacedWithFile = buildReplaceSettings(current, fromFile)
  eq(
    '置き換えの設定: ファイルに設定があればファイルの内容になる(置き換えの意味は保つ)',
    {
      ng: replacedWithFile.ngIngredients,
      theme: replacedWithFile.theme,
      budget: replacedWithFile.weeklyBudget,
      pro: replacedWithFile.proCode,
    },
    { ng: ['セロリ'], theme: 'brown', budget: 3000, pro: 'UR-BBBB-BBBB' },
  )
  const noSettings = buildReplaceSettings(current, undefined)
  eq(
    '置き換えの設定: settingsを持たないJSON(配布セット形式など)では今の設定を保つ(初期化しない)',
    {
      ng: noSettings.ngIngredients,
      theme: noSettings.theme,
      budget: noSettings.weeklyBudget,
      pro: noSettings.proCode,
    },
    { ng: ['パクチー'], theme: 'dark', budget: 5000, pro: 'UR-AAAA-AAAA' },
  )
  const noCode = buildReplaceSettings(current, { ngIngredients: [], theme: 'light' })
  eq(
    '置き換えの設定: 解錠コードを含まないファイル(購入前に取ったバックアップ)でも購入状態を消さない',
    { pro: noCode.proCode, proAt: noCode.proActivatedAt, ng: noCode.ngIngredients, theme: noCode.theme },
    { pro: 'UR-AAAA-AAAA', proAt: 1000, ng: [], theme: 'light' },
  )
  eq(
    '置き換えの設定: starterSeededは必ずtrue(基本レシピの二重投入を防ぐ既存の理由)',
    buildReplaceSettings({ starterSeeded: false }, { starterSeeded: false }).starterSeeded,
    true,
  )
  eq('置き換えの設定: idは必ず1(設定は1レコードだけ)', buildReplaceSettings(undefined, undefined).id, 1)
  eq(
    '置き換えの設定: 設定が空の端末+設定なしファイルでも既定値で成立する(エラーにならない)',
    buildReplaceSettings(undefined, undefined).ngIngredients,
    [],
  )
}

// ---------- merge復元の非破壊マージ(2026-07-30 便CJ/C1・S1事故の再発防止)。
// 「読み込む(今のデータに追加)」がレシピ本体と解錠コードしか見ておらず、
// 7テーブルと「既にあるレシピの作った記録・写真・お気に入り」を無言で捨てていた。
// さらに同一IDを内容も見ずにスキップしていたため、同梱レシピが増えた版とのズレで
// 自作レシピが丸ごと落ちていた ----------
{
  // --- mergeTableRows: 既存に無い行だけ足す(既存行は消さない・上書きしない) ---
  eq(
    '非破壊マージ: 既存に無い行だけ返す(既存と同じキーの行は足さない)',
    mergeTableRows([{ name: '牛乳' }], [{ name: '牛乳' }, { name: 'にんじん' }], mergeRowKeys.pantryItems),
    [{ name: 'にんじん' }],
  )
  eq(
    '非破壊マージ: 既存が空なら全部足す',
    mergeTableRows([], [{ name: '牛乳' }, { name: 'にんじん' }], mergeRowKeys.pantryItems),
    [{ name: '牛乳' }, { name: 'にんじん' }],
  )
  eq(
    '非破壊マージ: ファイル内に同じキーが重複していても1件だけ足す',
    mergeTableRows([], [{ name: '牛乳' }, { name: '牛乳' }], mergeRowKeys.pantryItems),
    [{ name: '牛乳' }],
  )
  eq(
    '非破壊マージ: 前後の空白は同じ行として扱う(名前の照合)',
    mergeTableRows([{ name: '牛乳' }], [{ name: ' 牛乳 ' }], mergeRowKeys.pantryItems),
    [],
  )
  eq(
    '非破壊マージ: 週献立は日付+食事帯+レシピで照合する(同じ日の別の枠は別行として足す)',
    mergeTableRows(
      [{ date: '2026-08-01', slot: 'dinner', recipeId: 1 }],
      [
        { date: '2026-08-01', slot: 'dinner', recipeId: 1 },
        { date: '2026-08-01', slot: 'dinner', recipeId: 2 },
        { date: '2026-08-01', slot: 'lunch', recipeId: 1 },
      ],
      mergeRowKeys.mealPlans,
    ),
    [
      { date: '2026-08-01', slot: 'dinner', recipeId: 2 },
      { date: '2026-08-01', slot: 'lunch', recipeId: 1 },
    ],
  )
  eq(
    '非破壊マージ: 日付メモは日付(主キー)で照合し、今のメモを上書きしない',
    mergeTableRows(
      [{ date: '2026-08-02', text: '今の端末のメモ', updatedAt: 2 }],
      [
        { date: '2026-08-02', text: 'ファイル側のメモ', updatedAt: 1 },
        { date: '2026-08-03', text: '来客あり', updatedAt: 1 },
      ],
      mergeRowKeys.dayNotes,
    ),
    [{ date: '2026-08-03', text: '来客あり', updatedAt: 1 }],
  )
  eq(
    '非破壊マージ: 今日の献立はレシピで照合する',
    mergeTableRows([{ recipeId: 3, addedAt: 1 }], [{ recipeId: 3, addedAt: 2 }, { recipeId: 4, addedAt: 2 }], mergeRowKeys.todayList),
    [{ recipeId: 4, addedAt: 2 }],
  )

  // --- resolveMergeRecipeAction: ID衝突でレシピを落とさない(版ズレ対策) ---
  const titleById = new Map([
    [1, '肉じゃが'],
    [2, 'カレー'],
  ])
  const idByTitle = new Map([
    ['肉じゃが', 1],
    ['カレー', 2],
  ])
  eq(
    'ID照合: 同じIDに同じ料理名(まっさら端末の同梱レシピ)→本体はそのまま、記録などだけ足す',
    resolveMergeRecipeAction({ id: 1, title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: そのIDが空いている→従来どおり同じIDのまま追加する',
    resolveMergeRecipeAction({ id: 9, title: '自作レシピ' }, titleById, idByTitle),
    { kind: 'add' },
  )
  eq(
    'ID照合(版ズレ): 同じIDが別の料理に使われている+同じ料理名が無い→新しいIDで追加する(自作レシピを落とさない)',
    resolveMergeRecipeAction({ id: 2, title: 'わたしの唐揚げ' }, titleById, idByTitle),
    { kind: 'addWithNewId' },
  )
  eq(
    'ID照合(版ズレ): 同じIDが別の料理+同じ料理名が別のIDにある→そちらへ記録などを足す(二重登録しない)',
    resolveMergeRecipeAction({ id: 2, title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: 同じIDどうしの料理名は前後の空白を無視して同じ料理として扱う',
    resolveMergeRecipeAction({ id: 1, title: ' 肉じゃが ' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合(版ズレ): 料理名の突き合わせも前後の空白を無視する',
    resolveMergeRecipeAction({ id: 2, title: ' 肉じゃが ' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: IDが無い古い形式は従来どおり新規として追加する',
    resolveMergeRecipeAction({ title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'addWithNewId' },
  )

  // --- mergeRecipeUserData: 既にあるレシピへ記録・お気に入り・写真だけ足す ---
  const photoA = 'photoA' // 実体(Blob)はDOM依存なので、ここでは同一性だけを見る代用値
  const photoB = 'photoB'
  const base = {
    id: 1,
    title: '肉じゃが',
    memo: '今の端末で書いたメモ',
    isFavorite: false,
    cookedLogs: [],
    servings: 2,
  }
  const fromFile = {
    id: 1,
    title: '肉じゃが',
    memo: 'ファイル側のメモ',
    isFavorite: true,
    photo: photoB,
    cookedLogs: [
      { date: '2026-07-01', note: '記録1', photo: photoB },
      { date: '2026-07-20', note: '記録2' },
    ],
    servings: 4,
  }
  const merged = mergeRecipeUserData(base, fromFile)
  eq('記録の取り込み: 件数(作った記録2件・お気に入り1・写真2枚)', {
    changed: merged.changed,
    cookedLogsAdded: merged.cookedLogsAdded,
    favoriteAdded: merged.favoriteAdded,
    photosAdded: merged.photosAdded,
  }, { changed: true, cookedLogsAdded: 2, favoriteAdded: true, photosAdded: 2 })
  eq(
    '記録の取り込み: レシピ本体(メモ・人数・料理名)は今のデータを優先し書き換えない',
    { memo: merged.recipe.memo, servings: merged.recipe.servings, title: merged.recipe.title },
    { memo: '今の端末で書いたメモ', servings: 2, title: '肉じゃが' },
  )
  eq('記録の取り込み: お気に入りはtrueを優先する', merged.recipe.isFavorite, true)
  eq('記録の取り込み: 写真は今のレシピに無いときだけ入れる', merged.recipe.photo, photoB)
  eq(
    '記録の取り込み: 今のレシピに写真があればファイル側で上書きしない',
    mergeRecipeUserData({ ...base, photo: photoA }, fromFile).recipe.photo,
    photoA,
  )
  const dedup = mergeRecipeUserData(
    { ...base, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
    { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
  )
  eq(
    '記録の取り込み: 同じ記録(日付+メモが同じ)は二重に足さない',
    { added: dedup.cookedLogsAdded, total: dedup.recipe.cookedLogs.length },
    { added: 0, total: 1 },
  )
  const fillPhoto = mergeRecipeUserData(
    { ...base, isFavorite: true, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
    { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '記録1', photo: photoB }] },
  )
  eq(
    '記録の取り込み: 同じ記録に写真だけが無ければファイル側の写真で埋める(既存の写真は消さない)',
    { photosAdded: fillPhoto.photosAdded, photo: fillPhoto.recipe.cookedLogs[0].photo },
    { photosAdded: 1, photo: photoB },
  )
  eq(
    '記録の取り込み: 同じ日でもメモが違えば別の記録として足す',
    mergeRecipeUserData(
      { ...base, cookedLogs: [{ date: '2026-07-01', note: '1回目' }] },
      { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '2回目' }] },
    ).recipe.cookedLogs.length,
    2,
  )
  eq(
    '記録の取り込み: 足すものが何も無ければ changed=false(DBへ書き戻さない)',
    mergeRecipeUserData({ ...base, isFavorite: true, photo: photoA }, { ...base, isFavorite: false, cookedLogs: [] })
      .changed,
    false,
  )

  // --- remapBackupRecipeRefs: 版ズレでIDを振り直したときの参照の付け替え ---
  const remapFile = {
    mealPlans: [{ date: '2026-08-01', slot: 'dinner', recipeId: 104 }],
    todayList: [{ recipeId: 104, addedAt: 1 }],
    shoppingItems: [{ name: 'にんじん', order: 1, isChecked: false, fromRecipeIds: [104, 7] }],
    mealTemplates: [{ name: '平日', items: [{ dow: 0, slot: 'dinner', role: 'main', recipeId: 104 }], createdAt: 1 }],
  }
  eq(
    '参照の付け替え: 振り直したレシピを指す献立・今日の献立・テンプレ・買い物メモが新しいIDを指す',
    remapBackupRecipeRefs(remapFile, new Map([[104, 210]])),
    {
      mealPlans: [{ date: '2026-08-01', slot: 'dinner', recipeId: 210 }],
      todayList: [{ recipeId: 210, addedAt: 1 }],
      shoppingItems: [{ name: 'にんじん', order: 1, isChecked: false, fromRecipeIds: [210, 7] }],
      mealTemplates: [{ name: '平日', items: [{ dow: 0, slot: 'dinner', role: 'main', recipeId: 210 }], createdAt: 1 }],
    },
  )
  // DY-2 再発防止: 出所の内訳(fromRecipes・2026-08-08)も付け替える。
  // 片方だけ直すと、出所の小窓が実在しないレシピを指す
  eq(
    '参照の付け替え: 買い物メモの出所の内訳(fromRecipes)も新しいIDを指す',
    remapBackupRecipeRefs(
      {
        shoppingItems: [
          {
            name: 'にんじん',
            order: 1,
            isChecked: false,
            fromRecipeIds: [104, 7],
            fromRecipes: [
              { recipeId: 104, amount: '1本' },
              { recipeId: 7, amount: '50g' },
            ],
          },
        ],
      },
      new Map([[104, 210]]),
    ).shoppingItems,
    [
      {
        name: 'にんじん',
        order: 1,
        isChecked: false,
        fromRecipeIds: [210, 7],
        fromRecipes: [
          { recipeId: 210, amount: '1本' },
          { recipeId: 7, amount: '50g' },
        ],
      },
    ],
  )
  eq(
    '参照の付け替え: 手で足しただけの行(出所なし)はそのまま返す',
    remapBackupRecipeRefs(
      { shoppingItems: [{ name: 'ラップ', order: 1, isChecked: false, manualAdded: true }] },
      new Map([[104, 210]]),
    ).shoppingItems,
    [{ name: 'ラップ', order: 1, isChecked: false, manualAdded: true }],
  )
  eq(
    '参照の付け替え: 振り直しが無ければそのまま返す(項目の有無=undefinedも保つ)',
    remapBackupRecipeRefs({ mealPlans: undefined, todayList: [{ recipeId: 1, addedAt: 1 }] }, new Map()),
    { mealPlans: undefined, todayList: [{ recipeId: 1, addedAt: 1 }] },
  )
  eq(
    '参照の付け替え: 項目自体が無い古いバックアップでもエラーにならない(undefinedのまま)',
    remapBackupRecipeRefs({}, new Map([[1, 2]])),
    { mealPlans: undefined, todayList: undefined, shoppingItems: undefined, mealTemplates: undefined },
  )
}

// ---------- countReplaceImpact(2026-07-17設定ゼロベース裁定#6a: 置き換え確認文の件数表示) ----------
{
  eq('退避件数: レシピ0件・記録0件・価格0件', countReplaceImpact([], 0), { recipes: 0, cookedLogs: 0, prices: 0 })
  eq(
    '退避件数: レシピ件数はそのまま・作った記録は全レシピの合算',
    countReplaceImpact(
      [{ cookedLogs: [{ date: '2026-01-01' }, { date: '2026-01-02' }] }, { cookedLogs: [] }, { cookedLogs: [{ date: '2026-01-03' }] }],
      5,
    ),
    { recipes: 3, cookedLogs: 3, prices: 5 },
  )
}

// ---------- BK-SWAP: 「データを上書き」「元に戻す」の確認文と、置き換えで捨てる覚え書き
// (2026-08-15 便GP・規約F)。(a)上書きの確認文が消えるものを数え落としていた
// (レシピ・作った記録・価格しか書いていないのに、在庫・買い物メモ・献立なども入れ替わる)
// (b)「元に戻す」に確認文が無かった (c)置き換えがDexieしか入れ替えず、並行調理ナビの段取りの
// 覚え書き(localStorage)が同じ日のうち残る＝**同じ番号の別の料理**を指しうる ----------
{
  const scriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const backupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const settingsSrc = readFileSync(path.join(scriptDir, '../src/pages/SettingsPage.tsx'), 'utf-8')
  const impact = countReplaceImpact([{ cookedLogs: [{ date: '2026-08-01' }] }, { cookedLogs: [] }], 4)
  const replaceText = confirmContentText(buildReplaceConfirm(impact))

  // (1) 置き換えで中身が入れ替わるテーブルは、1つ残らず確認文の言葉になっている。
  // テーブルを足したのに確認文を直し忘れたら、ここが「言葉が決まっていない」で落ちる
  const replaceBranch = backupSrc.slice(
    backupSrc.indexOf("if (mode === 'replace') {"),
    backupSrc.indexOf('// merge: 今のデータは1件も消さず'),
  )
  const clearedTables = [...new Set([...replaceBranch.matchAll(/db\.(\w+)\.clear\(\)/g)].map((m) => m[1]))]
  const wordForTable = {
    recipes: 'レシピ',
    setExclusions: '削除したレシピ',
    pantryItems: '在庫',
    shoppingItems: '買い物メモ',
    mealPlans: '週の献立',
    todayList: '今日の献立',
    prices: '価格',
    dayNotes: '日付メモ',
    mealTemplates: '献立テンプレート',
    mealPlanLocks: '献立のロック',
    // 2026-08-16 便GZ: レシピを削除しても残っている記録。上書きではこれもファイルの内容に
    // 置き換わるので、「消えるもの」の作った記録の件数（countReplaceImpactが合算する）で伝える
    detachedLogs: '作った記録',
  }
  eq('BK-SWAP 置き換えの分岐を読めている(空振りしていない)', clearedTables.length > 0, true)
  eq(
    'BK-SWAP 置き換えで空にするテーブルは、すべて確認文の言葉が決まっている',
    clearedTables.filter((t) => !(t in wordForTable)),
    [],
  )
  for (const table of clearedTables) {
    eq(
      `BK-SWAP 上書きの確認文が${table}の入れ替えに触れている`,
      replaceText.includes(wordForTable[table] ?? '＿言葉が未定＿'),
      true,
    )
  }
  eq('BK-SWAP 上書きの確認文は設定もファイルの内容になると書く', /設定/.test(replaceText), true)
  eq('BK-SWAP 上書きの確認文は何が残るかも書く(規約F)', /解錠コード[^。]*残り/.test(replaceText), true)
  eq('BK-SWAP 上書きの確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(replaceText), false)
  eq('BK-SWAP 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(replaceText), false)

  // (2) 段取りの1行は、覚え書きが残っているときだけ出す
  // (docs/69「捨てたときは失うものがある場合だけ知らせる」)
  eq(
    'BK-SWAP 段取りが残っていれば、その品数つきで消えると書く',
    confirmContentText(buildReplaceConfirm(impact, 3)).includes(ja.settings.replaceCookNaviNote.replace('{n}', '3')),
    true,
  )
  eq('BK-SWAP 段取りが無いときは段取りの話を書かない', /段取り/.test(replaceText), false)

  // (3) 置き換えのあとに、前の段取りの覚え書きが残らない。
  // localStorageはNodeに無いので、読み書きだけを差し替えて確かめる
  {
    const local = new Map()
    const session = new Map()
    const fake = (store) => ({
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
    globalThis.localStorage = fake(local)
    globalThis.sessionStorage = fake(session)
    saveCookNaviSession({
      selectedIds: [11, 12],
      showTimeline: true,
      trialActive: false,
      current: { recipeId: 11, stepIndex: 0 },
    })
    eq('BK-SWAP 前提: 段取りの覚え書きが端末に残っている', loadCookNaviSession()?.selectedIds, [11, 12])
    clearCookNaviSession()
    eq('BK-SWAP 覚え書きを捨てると読み戻せない', loadCookNaviSession(), undefined)
    eq('BK-SWAP 覚え書きの置き場所も空になる', local.has(COOK_NAVI_SESSION_KEY), false)
    delete globalThis.localStorage
    delete globalThis.sessionStorage
  }
  // 置き換え復元(importBackupのreplace)がその後始末を通ること。
  // 実行にはDexieが要るので、ここは配線で見る(この1行が抜けると古い段取りが復活する)
  eq('BK-SWAP 置き換え復元は段取りの覚え書きを捨てる', /clearCookNaviSession\(\)/.test(replaceBranch), true)
  eq(
    'BK-SWAP 「元に戻す」も同じ置き換え経路を通る(段取りの後始末も同じ)',
    /restorePreImportSnapshot[\s\S]{0,400}importBackup\(backup, 'replace'\)/.test(backupSrc),
    true,
  )

  // (4) 「元に戻す」の確認文。事故から戻すためのボタンなので短いまま、消える・残るを両方書く
  const undoText = confirmContentText(buildUndoReplaceConfirm(impact))
  eq(
    'BK-UNDO 確認文はいまのレシピ・作った記録の件数を差し込む',
    undoText.includes(
      ja.settings.replaceUndoGone
        .replace('{r}', String(impact.recipes))
        .replace('{c}', String(impact.cookedLogs))
        .replace('{navi}', ''),
    ),
    true,
  )
  eq('BK-UNDO 確認文は何が消えるかを書く(規約F)', /消え/.test(undoText), true)
  eq('BK-UNDO 確認文は何が残るかを書く(規約F)', /残り/.test(undoText), true)
  eq('BK-UNDO 確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(undoText), false)
  eq(
    `BK-UNDO 事故から戻すボタンなので長くしない(実測${[...undoText].length}字・上限は保険)`,
    [...undoText].length <= 200,
    true,
  )

  // (5) 画面の配線: 確認してから控えで置き換える(以前は確認なしで置き換えていた)
  const undoHandler = settingsSrc.slice(
    settingsSrc.indexOf('const handleUndoReplace'),
    settingsSrc.indexOf('setMessage(restored'),
  )
  eq(
    'BK-UNDO 画面は確認してから控えで置き換える',
    /await confirm\(buildUndoReplaceConfirm\([\s\S]*restorePreImportSnapshot\(\)/.test(undoHandler),
    true,
  )
}

// ---------- daysSinceBackup(2026-07-17設定ゼロベース裁定#1: バックアップ状態バナー) ----------
{
  const now = Date.parse('2026-07-17T12:00:00+09:00')
  eq('経過日数: 未実施はnull', daysSinceBackup(undefined, now), null)
  eq('経過日数: 今日(同時刻)は0日前', daysSinceBackup(now, now), 0)
  eq('経過日数: 5日前', daysSinceBackup(now - 5 * 24 * 60 * 60 * 1000, now), 5)
  eq('経過日数: 31日前(要警告)', daysSinceBackup(now - 31 * 24 * 60 * 60 * 1000, now), 31)
  eq('経過日数: 23時間59分前は端数切り捨てで0日前', daysSinceBackup(now - (24 * 60 * 60 * 1000 - 60000), now), 0)
}

// ---------- backupNoticeKind(2026-08-21 便IR: バックアップのうながしを出す時と言い方) ----------
// 直した中身: 以前は「一度も書き出していなければ常に出す」だったので、**アプリを触り始めた
// 初日から**「しばらくバックアップしていません」と出ていた（「しばらく」が嘘になる）。
// 出さなくするのではなく、出す時（使い始めから7日）と言い方（別の文言）を分けた。
{
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2026-08-21T12:00:00+09:00')
  // --- 一度も書き出していない人 ---
  eq('うながし: 使い始めた初日には出さない（「しばらく」が嘘になる）', backupNoticeKind(undefined, now, now), 'none')
  eq('うながし: 使い始めから6日目はまだ出さない', backupNoticeKind(undefined, now - 6 * day, now), 'none')
  eq('うながし: 使い始めから7日たったら出す', backupNoticeKind(undefined, now - 7 * day, now), 'first')
  eq('うながし: 使い始めの日時が未記録の一瞬は出さない', backupNoticeKind(undefined, undefined, now), 'none')
  // firstLaunchAt が無い頃から使っている人には 0 が入る（db/settings.ts）。従来どおり出る
  eq('うながし: 既存ユーザー(使い始めの記録が0)には出す', backupNoticeKind(undefined, 0, now), 'first')
  // --- 一度は書き出した人 ---
  eq('うながし: 書き出し済み29日は出さない', backupNoticeKind(now - 29 * day, 0, now), 'none')
  eq('うながし: 書き出し済み31日は「しばらく」で出す', backupNoticeKind(now - 31 * day, 0, now), 'overdue')
  eq(
    'うながし: 一度でも書き出していれば、使い始めの日時では変わらない',
    backupNoticeKind(now - 31 * day, now, now),
    'overdue',
  )

  // --- 文言（規約H: 押した結果が分かる名前・言っていることが本当か） ---
  // 押しても書き出しは始まらず、設定のバックアップの節へ移るだけ。行き先の名前をそのまま名乗る
  eq(
    'うながし: 行き先の名前が、設定の節の名前(ja.settings.tabBackup)を名乗っている',
    ja.dayStart.backupReminderLink.includes(ja.settings.tabBackup) &&
      ja.dayStart.backupReminderLink.includes(ja.settings.title),
    true,
  )
  eq(
    'うながし: 行き先の名前が「バックアップを開く」（ファイルを開くと読める言い方）に戻っていない',
    ja.dayStart.backupReminderLink === `${ja.settings.tabBackup}を開く`,
    false,
  )
  eq(
    'うながし: 一度も書き出していない人には「しばらく」と言わない',
    /しばらく/.test(ja.dayStart.backupReminderFirst),
    false,
  )
  eq('うながし: 30日以上の人には「しばらく」と言う', /しばらく/.test(ja.dayStart.backupReminder), true)
  // 2つの言い方は、どちらも同じ締めくくり（設定の「ファイルに書き出す」）に着地する。
  // 2026-08-27 便LS: 一度も書き出していない人への言い方は、置き場所の説明（1行目）と
  // すすめ（2行目 backupReminderFirstNote）の2行になったので、**2行あわせて**着地を見る
  eq(
    'うながし: どちらの言い方も、設定の「ファイルに書き出す」に着地する',
    [
      ja.dayStart.backupReminder,
      `${ja.dayStart.backupReminderFirst}\n${ja.dayStart.backupReminderFirstNote}`,
    ].filter((t) => !t.includes(ja.settings.backupExport.replace('す', 'し'))),
    [],
  )

  // 画面側が、2つの言い方を出し分けているか（片方を書いたまま繋ぎ忘れると気づけない）
  const dayStartSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(scriptFileUrl)), '../src/components/DayStartNotices.tsx'),
    'utf-8',
  )
  eq(
    'うながし: 画面が backupNoticeKind の答えで言い方を出し分けている',
    /backupNoticeKind\(settings\.lastBackupAt, settings\.firstLaunchAt\)/.test(dayStartSrc) &&
      /backupNotice === 'first'[\s\S]{0,80}backupReminderFirst/.test(dayStartSrc),
    true,
  )
}

// ---------- fileSave(バックアップ修正2+3・2026-07-17: 保存先選択+前回に上書き) ----------
{
  eq(
    'supportsSaveFilePicker: window自体が無いNode環境ではfalse(未対応ブラウザ相当)',
    supportsSaveFilePicker(),
    false,
  )
  eq(
    'backupFileName: 日付から yyyy-mm-dd 形式のファイル名を組み立てる',
    backupFileName(new Date(2026, 6, 5)), // 月は0始まり(6=7月)
    'uchi-recipe-backup-2026-07-05.json',
  )
  eq(
    'backupFileName: 1桁の月日も0埋めする',
    backupFileName(new Date(2026, 0, 9)),
    'uchi-recipe-backup-2026-01-09.json',
  )
  // 選択したレシピの書き出し(2026-08-09 便EM)。中身の範囲が違うファイルなので、
  // 全体のバックアップ・アーカイブと名前で見分けられること
  eq(
    'selectedRecipesFileName: バックアップと見分けの付く名前になる',
    selectedRecipesFileName(new Date(2026, 6, 5)),
    'uchi-recipe-recipes-2026-07-05.json',
  )
  eq(
    'selectedRecipesFileName: 全体のバックアップと同じ名前にならない',
    selectedRecipesFileName(new Date(2026, 6, 5)) === backupFileName(new Date(2026, 6, 5)),
    false,
  )
  eq('isAbortError: DOMExceptionでもAbortError以外はfalse', isAbortError(new DOMException('x', 'NotFoundError')), false)
  eq('isAbortError: DOMException以外(普通のError)はfalse', isAbortError(new Error('x')), false)
  eq(
    'isAbortError: name=AbortErrorのDOMExceptionはtrue(ユーザーがピッカーをキャンセルした扱い)',
    isAbortError(new DOMException('x', 'AbortError')),
    true,
  )
}

// ---------- 古い記録の書き出し(アーカイブ。2026-08-02 オーナー採用) ----------
// 期間の境目・追記型の重複排除・壊れたファイルの読み取りを固定する。
// 事故になるのは①境目がずれて「残すはずの記録」まで書き出して消す
// ②追記で同じ記録が二重に増える／逆に別件が1件に潰れる ③1件壊れているだけで全部読めなくなる、の3つ。
{
  // (1) 期間の境目: 「◯か月より前」はちょうど◯か月前の当日を含まない
  eq('ARCH 1ヶ月前の境目', archiveCutoffDate(1, new Date(2026, 7, 2)), '2026-07-02')
  eq('ARCH 3ヶ月前の境目', archiveCutoffDate(3, new Date(2026, 7, 2)), '2026-05-02')
  eq('ARCH 6ヶ月前の境目(年をまたぐ)', archiveCutoffDate(6, new Date(2026, 2, 15)), '2025-09-15')
  // 月末の丸め: 3/31の1ヶ月前は「2/31」=JSでは3/3になるため、月末へ丸めないと境目が未来へずれる
  eq('ARCH 月末は月末へ丸める(3/31→2/28)', archiveCutoffDate(1, new Date(2026, 2, 31)), '2026-02-28')
  eq('ARCH 月末は月末へ丸める(5/31→4/30)', archiveCutoffDate(1, new Date(2026, 4, 31)), '2026-04-30')

  const archRecipes = [
    {
      id: 1,
      title: '肉じゃが',
      cookedLogs: [
        { date: '2026-08-01', note: '今月の記録' }, // 残る
        { date: '2026-07-02' }, // 境目ちょうど = 残る
        { date: '2026-07-01', note: 'メモあり' }, // 対象
        { date: '2026-06-30' }, // 対象(写真なし)
      ],
    },
    {
      id: 2,
      title: 'カレーライス',
      cookedLogs: [
        { date: '2026-05-05', photo: { size: 1 } }, // 対象(写真あり)
        { date: '2026-05-05' }, // 同じ日・メモ無しの2件目(対象)
      ],
    },
  ]
  const archCutoff = archiveCutoffDate(1, new Date(2026, 7, 2))
  const archTargets = collectArchiveTargets(archRecipes, archCutoff)
  eq(
    'ARCH 境目ちょうどの記録は書き出さない(残す)',
    // 便LK: 対象が0件でも every は true になる（何も書き出さなくなった退行が緑で通る）ので、
    // 「1件以上あって、そのすべてが境目より前」を1つの条件にする
    archTargets.length > 0 && archTargets.every((t) => t.log.date < '2026-07-02'),
    true,
  )
  eq('ARCH 対象件数', countArchiveTargets(archTargets).logs, 4)
  eq('ARCH 対象の写真枚数', countArchiveTargets(archTargets).photos, 1)
  eq('ARCH 対象のレシピ数', countArchiveTargets(archTargets).recipes, 2)
  eq('ARCH 並びは日付の新しい順', archTargets.map((t) => t.log.date), [
    '2026-07-01',
    '2026-06-30',
    '2026-05-05',
    '2026-05-05',
  ])
  // 同じ料理・同じ日・メモ無しが2件あっても、連番で別件として残る(潰れない)
  const archDupIds = archTargets
    .filter((t) => t.source === 'recipe' && t.sourceId === 2)
    .map((t) => t.id)
  eq('ARCH 同じ日の重複記録は連番で別件になる', new Set(archDupIds).size, 2)
  // 端末から消すときも同じIDが作られる(消す対象の取り違え防止)
  eq(
    'ARCH 消すとき用のIDは書き出し時と同じ',
    archiveIdsForRecipe(archRecipes[1]),
    archDupIds,
  )
  // 同じ料理名のレシピを2品登録していても、記録のIDはぶつからない
  // (ぶつかると、ファイルに入っていない方の記録まで「書き出した記録を消す」で消える)
  eq(
    'ARCH 同名レシピが2品あってもIDがぶつからない',
    archiveIdsForRecipe({ id: 10, title: 'カレー', cookedLogs: [{ date: '2026-05-05' }] })[0] ===
      archiveIdsForRecipe({ id: 11, title: 'カレー', cookedLogs: [{ date: '2026-05-05' }] })[0],
    false,
  )

  // (2) 追記型の統合: 同じIDは1件にまとめ、写真は「有る方」を残す
  const archOld = [
    { id: 'a', date: '2026-05-01', recipeTitle: '肉じゃが' },
    { id: 'b', date: '2026-04-01', recipeTitle: 'カレーライス', photoBase64: 'AAA', photoType: 'image/jpeg' },
  ]
  const archNew = [
    { id: 'a', date: '2026-05-01', recipeTitle: '肉じゃが', photoBase64: 'BBB', photoType: 'image/jpeg' },
    { id: 'c', date: '2026-06-01', recipeTitle: '肉豆腐' },
  ]
  const archMerged = mergeArchiveLogs(archOld, archNew)
  eq('ARCH 統合で同じIDは1件にまとまる', archMerged.length, 3)
  eq('ARCH 統合の並びは日付の新しい順', archMerged.map((l) => l.id), ['c', 'a', 'b'])
  eq(
    'ARCH 統合で欠けていた写真は新しい方から埋まる',
    archMerged.find((l) => l.id === 'a').photoBase64,
    'BBB',
  )
  eq(
    'ARCH 統合で既にある写真は消えない',
    archMerged.find((l) => l.id === 'b').photoBase64,
    'AAA',
  )
  eq('ARCH 同じ内容を2回統合しても増えない', mergeArchiveLogs(archMerged, archMerged).length, 3)

  // (3) ファイルの読み取り: 種別マークで区別し、壊れた記録は数えて残りは読む
  const archFileJson = JSON.stringify(buildArchiveFile(archMerged, '2026-08-02T00:00:00.000Z'))
  eq('ARCH 書き出したファイルに種別マークが入る', JSON.parse(archFileJson).kind, ARCHIVE_KIND)
  const archParsed = parseArchiveFile(archFileJson)
  eq('ARCH 書き出し→読み込みで件数が保たれる', archParsed.logs.length, 3)
  eq('ARCH 壊れた記録は0件', archParsed.brokenCount, 0)

  const archBroken = parseArchiveFile(
    JSON.stringify({
      app: 'uchi-recipe',
      kind: ARCHIVE_KIND,
      version: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      logs: [
        { id: 'ok1', date: '2026-05-01', recipeTitle: '肉じゃが' },
        { id: 'ng1', date: '2026-05-02' }, // 料理名が無い
        { id: 'ng2', date: 'こわれた', recipeTitle: 'カレーライス' }, // 日付の形が違う
        null,
        { date: '2026-05-03', recipeTitle: '肉豆腐' }, // IDが無い(手編集)→作り直す
      ],
    }),
  )
  eq('ARCH 壊れたファイルでも読める記録は読む', archBroken.logs.length, 2)
  // 同じIDが二重に入っているファイルでも1件にまとめる(閲覧の件数と引き継ぐ件数を合わせる)
  eq(
    'ARCH 同じIDが二重に入っていても1件にまとめる',
    parseArchiveFile(
      JSON.stringify({
        app: 'uchi-recipe',
        kind: ARCHIVE_KIND,
        version: 1,
        exportedAt: '',
        logs: [
          { id: 'dup', date: '2026-05-01', recipeTitle: '肉じゃが' },
          { id: 'dup', date: '2026-05-01', recipeTitle: '肉じゃが' },
        ],
      }),
    ).logs.length,
    1,
  )
  eq('ARCH 読めなかった記録の件数を数える', archBroken.brokenCount, 3)
  eq(
    'ARCH IDの無い記録はIDを作り直す',
    archBroken.logs.some((l) => l.id.includes('肉豆腐')),
    true,
  )

  const archReason = (json) => {
    try {
      parseArchiveFile(json)
      return 'ok'
    } catch (e) {
      return e instanceof ArchiveFileError ? e.reason : 'other'
    }
  }
  eq(
    'ARCH バックアップファイルは「バックアップです」と言い分ける',
    archReason(JSON.stringify({ app: 'uchi-recipe', version: 1, recipes: [] })),
    'backup',
  )
  eq('ARCH JSONでないファイルは読めない扱い', archReason('これはJSONではない'), 'invalid')
  eq(
    'ARCH 他アプリのJSONは読めない扱い',
    archReason(JSON.stringify({ app: 'other', logs: [] })),
    'invalid',
  )
  // 2026-08-20 便IH・④: 名前を uchi-recipe-records- から uchi-recipe-archive- に変えた。
  // 名前そのものの決まりごとは下の IH-4 でまとめて見る
  eq('ARCH ファイル名にバックアップと同じ名前を使わない', archiveFileName(new Date(2026, 7, 2)), 'uchi-recipe-archive-2026-08-02.json')
  eq('ARCH 日付の表示', formatArchiveDate('2026-07-02'), '2026年7月2日')
}

// ---------- 置き換え確認に写真を含める(2026-07-30 便CK/②-1・S1) ----------
// 写真つきの既存レシピを編集中にURL取り込みすると、確認文にも判定にも写真が無いため
// 確認なく写真が差し替わり、保存すると元の写真は復元できなくなっていた(規約Fの漏れ)
{
  eq('便CK/②-1 写真があり「写真も取り込む」ONなら置き換わる', photoReplacePlan(true, true), 'replace')
  eq('便CK/②-1 写真があってもOFFならそのまま残る', photoReplacePlan(true, false), 'kept')
  eq('便CK/②-1 写真が無ければ写真については何も起きない', photoReplacePlan(false, true), 'none')
  const filled = { filledIngredients: 1, filledSteps: 1, parsedIngredients: 2, parsedSteps: 2 }
  eq(
    '便CK/②-1 材料・手順・写真の3つとも消えるものとして数える',
    replaceConfirmTargets({ ...filled, photoPlan: 'replace' }),
    // 2026-08-25 便KS・⑦で料理名・ひとこと説明・メモが加わった（この呼び方では未入力＝false）
    { title: false, intro: false, memo: false, ingredients: true, steps: true, photo: true },
  )
  eq(
    '便CK/②-1 写真がOFFで残るなら写真は「消えるもの」ではない',
    replaceConfirmTargets({ ...filled, photoPlan: 'kept' }).photo,
    false,
  )
  // 料理名と写真だけのレシピ(材料・手順が空)でも、写真が置き換わるなら確認を出す
  const photoOnly = {
    filledIngredients: 0,
    filledSteps: 0,
    parsedIngredients: 2,
    parsedSteps: 2,
    photoPlan: 'replace',
  }
  eq(
    '便CK/②-1 材料・手順が空でも写真が置き換わるなら確認する',
    needsReplaceConfirm(replaceConfirmTargets(photoOnly)),
    true,
  )
  eq(
    '便CK/②-1 消えるものが何も無ければ確認は出さない(便BW/C-04の仕様は維持)',
    needsReplaceConfirm(
      replaceConfirmTargets({ ...photoOnly, photoPlan: 'none' }),
    ),
    false,
  )
  eq(
    '便CK/②-1 入力済みでも取り込み側が0件ならその項目は消えない(便BW/C-04の仕様は維持)',
    replaceConfirmTargets({
      filledIngredients: 3,
      filledSteps: 3,
      parsedIngredients: 0,
      parsedSteps: 0,
      photoPlan: 'none',
    }),
    // 2026-08-25 便KS・⑦で料理名・ひとこと説明・メモが加わった（この呼び方では未入力＝false）
    { title: false, intro: false, memo: false, ingredients: false, steps: false, photo: false },
  )
}

// ---------- 便EM: 選択したレシピの書き出しの確認文(規約F) ----------
// 何が含まれ、何が含まれないかを両方書く。ファイルを作るだけで端末のレシピは減らないので、
// そのことも書く(すぐ下に削除ボタンが並ぶため)。戻し方まで書いて行き止まりにしない。
// 2026-08-15 便GV: 素のダイアログ(window.confirm)から画面の中の窓(ConfirmDialog)へ移し、
// 見出し+箇条書き+補足の3つに分けた。測る中身は同じなので、確認の名前(EM-6/FA-3)は残す。
{
  const confirm = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: true,
  })
  const all = [confirm.title, ...confirm.bullets.map((b) => `${b.label}: ${b.text}`), ...confirm.notes].join('\n')
  const bulletText = (label) => confirm.bullets.find((b) => b.label === label)?.text ?? ''
  eq('EM-6 確認に選んだ品数が入る', confirm.title.includes('レシピ3品'), true)
  eq('EM-6 確認に「入るもの」がある', bulletText('入るもの') !== '', true)
  eq('EM-6 確認に「入らないもの」がある', bulletText('入らないもの') !== '', true)
  eq('EM-6 入らないものに選んでいない品数が入る', bulletText('入らないもの').includes('選んでいないレシピ106品'), true)
  eq('EM-6 記録の写真は入らないと書いてある', bulletText('入らないもの').includes('記録の写真'), true)
  eq('EM-6 アプリの設定は入らないと書いてある', bulletText('入らないもの').includes('設定'), true)
  eq('EM-6 端末のレシピが残ることを書いてある', all.includes('端末のレシピは減りません'), true)
  eq(
    'EM-6 戻し方を画面名・ボタン名で書いてある(規約H: 指示語で場所を示さない)',
    all.includes('設定の「バックアップを読み込む」の「今のデータに追加」'),
    true,
  )
  eq('EM-6 差し込みの取り残しが無い', /\{[a-z]+\}/.test(all), false)
  eq(
    'EM-6 選んでいない品が0でも文が壊れない',
    buildSelectedRecipesExportConfirm({ selected: 109, remaining: 0, bytes: 1024, canPickLocation: true })
      .bullets.find((b) => b.label === '入らないもの')
      ?.text.includes('選んでいないレシピ0品'),
    true,
  )
  // 2026-08-10 便FA(オーナー承認・docs/65 A-2): 書き出したファイルを人に渡すときの一言。
  // 「軽い注意」なので1行だけ。渡すこと自体は止めない（Pro版の解錠コードが入る全体の
  // バックアップとは言うべきことが違う。そちらは settings.backupContainsCodeNotice が
  // 「他の人に渡さないでください」と言い切る）
  eq(
    'FA-3 書き出し時に人へ渡すときの一言がある',
    confirm.notes.some((n) => n.includes('人に渡す・公開するときは中身をご確認ください')),
    true,
  )
  eq('FA-3 選択レシピの書き出しの確認で解錠コードの話はしない(このファイルには入らない)', all.includes('解錠コード'), false)
  eq(
    'FA-3 全体のバックアップは「他の人に渡さないでください」のまま(言うべきことが違う)',
    ja.settings.backupContainsCodeNotice.includes('他の人に渡さないでください'),
    true,
  )
  eq('FA-3 注意は1行に収める(重い警告にしない)', confirm.notes.filter((n) => n.includes('ご確認ください')).length, 1)
}

// ---------- 便GV-3: レシピの書き出しの確認(2026-08-15 オーナー実機「文章が長い。
// 箇条書きや太字で読みやすくして。ファイルのサイズも書いてあると親切」) ----------
// 素のダイアログ(window.confirm)では太字も箇条書きも出せないので、画面の中の窓
// (ConfirmDialog)に置き換える。ここでは窓に流し込む中身(純ロジック)を測る。
{
  // 素のダイアログのままだった旧確認文の文字数(改行込み240字。r=3・rest=106のとき)。
  // 「箇条書きにしただけで行数が増えては逆効果」なので、読む量そのものを減らせたかを測る。
  // 実測の基準値なので、確認の中身を意図的に増やすとき以外はこの数字を上げないこと
  const OLD_CONFIRM_LENGTH = 240
  const picked = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: true,
  })
  eq('GV-3 ファイルの大きさを実測値で出す', picked.bullets.some((b) => b.text.includes('128KB')), true)
  eq(
    'GV-3 保存先を選べる端末では選べると書く',
    picked.bullets.find((b) => b.label === '保存先')?.text.includes('選べます'),
    true,
  )
  // 保存先を選べない端末(iPhone・iPad・Firefox等)で「選べます」と書かない
  const downloaded = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: false,
  })
  const dlSaveTo = downloaded.bullets.find((b) => b.label === '保存先')?.text ?? ''
  eq('GV-3 保存先を選べない端末で「選べます」と書かない', dlSaveTo.includes('選べます'), false)
  eq('GV-3 保存先を選べない端末では入る場所を書く', dlSaveTo.includes('ダウンロード'), true)

  const newLength = [picked.title, ...picked.bullets.map((b) => `${b.label}: ${b.text}`), ...picked.notes].join('\n')
    .length
  eq('GV-3 素のダイアログのときより読む量が減っている', newLength < OLD_CONFIRM_LENGTH, true)
}

