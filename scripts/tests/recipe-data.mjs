// レシピ本体と記録（セット取り込み・アイコン/種別・削除・作った記録）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, neq, scriptFileUrl } from './_harness.mjs'
import { normalizeImportedIngredient } from '../../src/logic/parseRecipeText.ts'
import { buildSearchWords, toHiragana } from '../../src/logic/kana.ts'
import { isOneDish } from '../../src/logic/mealPlan.ts'
import { guessDishType, suggestDishType } from '../../src/logic/dishTypeGuess.ts'
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
import {
  summarizeRecipeDeleteImpact,
  buildBulkDeleteConfirm,
  buildSingleDeleteConfirm,
  isRestorableStarter,
} from '../../src/logic/recipeDelete.ts'
import {
  buildCookPlan,
  buildPlanSteps,
  waitUrgency,
  waitOverrunAllowance,
  waitKeepsAppliance,
} from '../../src/logic/cookNavi.ts'
import {
  stepApplianceFor,
  applianceCapacity,
  APPLIANCE_KEYS,
  DEFAULT_KITCHEN,
} from '../../src/logic/cookAppliance.ts'
import {
  resolveDuplicateTitleAction,
  buildUpdatedSetRecipe,
  exclusionRecordFor,
  buildExclusionTitleSet,
  tablesToReplace,
  countReplaceImpact,
  mergeRowKeys,
  resolveMergeRecipeAction,
} from '../../src/logic/backup.ts'
// 同じ料理名の品に番号を付けて入れる道具（2026-08-22 便JA）。名前を1つずつ import せず
// まとめて受け取るのは、**関数が無いときに import ごと落ちて他の節の結果まで消えるのを避ける**ため
// （IZ-1 と同じ「掴めていないことを先に赤で言う」作法。下の JA-0 が有無そのものを測る）
import * as backupLogic from '../../src/logic/backup.ts'
import { buildPriceIndex, matchPriceEntry } from '../../src/logic/priceEstimate.ts'
import { pickIconKey, resolveIconKey, iconKeyOrder } from '../../src/logic/icon.ts'
import {
  starterDefs,
  buildUpdatedStarterRecipe,
  planStarterReload,
  planStarterReloadFor,
  countStarterReloadImpact,
  buildStarterReloadConfirm,
  planFlattenedStarterTopUp,
} from '../../src/db/starters.ts'
import { isDashiIngredientName, DASHI_RECIPE_TITLE } from '../../src/logic/dashiLink.ts'
import { cookedWithinDays, isOneTapCookedLog } from '../../src/logic/cooked.ts'
import {
  ARCHIVE_KIND,
  archiveIdsForDetached,
  archiveIdsForRecipe,
  buildArchiveDeleteConfirm,
  buildArchiveFile,
  collectArchiveTargets,
  countArchiveTargets,
  mergeArchiveLogs,
  parseArchiveFile,
} from '../../src/logic/cookedArchive.ts'
import {
  MIN_SERVINGS,
  MAX_SERVINGS,
  clampServings,
  isServingsInRange,
  defaultMealServings,
  effectiveMealServings,
} from '../../src/logic/servings.ts'
import { ja } from '../../src/i18n/ja.ts'
import { confirmContentText } from '../../src/logic/confirmContent.ts'
import { resolveBackTarget } from '../../src/logic/backLink.ts'
// 便GZ: レシピを削除しても「作った記録」が残る仕組み（2026-08-16 オーナー承認）
import {
  starterRecipeUid,
  isStarterUid,
  newRecipeUid,
  planRecipeUidBackfill,
} from '../../src/logic/recipeUid.ts'
import {
  buildDetachedRecord,
  mergeDetachedRecords,
  planDetachedReattach,
  detachedRecipeStub,
  countDetachedLogs,
  detachedPhotoBytes,
} from '../../src/logic/detachedLogs.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// ---------- resolveDuplicateTitleAction(配布セット再取込: kintoreテーマ改名で旧名称バッジが
// 残ってしまった不具合の再発防止。バッチH-1 2026-07-10) ----------
eq(
  '同一セット由来の再取込は重複させずセット名だけ更新',
  resolveDuplicateTitleAction('kintore', 'kintore'),
  'updateName',
)
eq(
  '別セット由来の同名料理はスキップのみ(既存を優先)',
  resolveDuplicateTitleAction('other-set', 'kintore'),
  'skip',
)
eq(
  '個人登録(sourceSetIdなし)と同名の取込はスキップのみ',
  resolveDuplicateTitleAction(undefined, 'kintore'),
  'skip',
)
eq(
  '取込元のsetIdが無い(通常バックアップ相当)場合は常にスキップ',
  resolveDuplicateTitleAction('kintore', undefined),
  'skip',
)

// ---------- buildUpdatedSetRecipe(レシピセットの再取込で内容を更新できるように・2026-07-12
// オーナー実機フィードバック「review中セットに修正を配信する手段が無い」の対策) ----------
{
  const existingSetRecipe = {
    id: 42,
    title: 'レンジ蒸し鶏',
    photo: 'FAKE_PHOTO_BLOB',
    servings: 2,
    cookMinutes: 15,
    effortLevel: 'easy',
    tags: ['高たんぱく'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '鶏むね肉', amount: '300', unit: 'g' }],
    steps: [{ text: '鶏むね肉をレンジで加熱する' }],
    quickSteps: undefined,
    memo: '旧メモ',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: ['old'],
    isStarter: true,
    sourceSetId: 'kintore',
    sourceSetName: '筋トレ・高たんぱくセット',
    createdAt: 1000,
    updatedAt: 1000,
  }

  // (1) 内容が変わっていれば更新される(修正版JSONの再取込で中身が反映されること)
  const changedContent = {
    servings: 2,
    cookMinutes: 12,
    effortLevel: 'easy',
    tags: ['高たんぱく', '時短'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [
      { name: '鶏むね肉', amount: '300', unit: 'g' },
      { name: '塩こうじ', amount: '1', unit: '大さじ' },
    ],
    steps: [{ text: '鶏むね肉に塩こうじを揉み込みレンジで加熱する' }],
    quickSteps: undefined,
    memo: '新メモ:レンジ加熱時間を修正',
    sourceUrl: undefined,
  }
  const updated = buildUpdatedSetRecipe(existingSetRecipe, changedContent, existingSetRecipe.sourceSetName, 5000)
  eq('内容が変わっていれば更新結果が返る(null以外)', updated !== null, true)
  eq('更新: cookMinutesが反映される', updated?.cookMinutes, 12)
  eq('更新: memoが反映される', updated?.memo, '新メモ:レンジ加熱時間を修正')
  eq('更新: ingredientsが反映される', updated?.ingredients, changedContent.ingredients)
  eq('更新: tagsが反映される', updated?.tags, changedContent.tags)
  eq('更新: updatedAtが今回渡した時刻になる', updated?.updatedAt, 5000)
  eq(
    '更新: searchWordsが新しい材料で再構築される',
    updated?.searchWords,
    buildSearchWords(existingSetRecipe.title, changedContent.ingredients, changedContent.tags),
  )

  // (2) ユーザーデータ(id・createdAt・favorite・cookedLogs・photo・isStarter)は保持される
  eq('保持: idは既存のまま', updated?.id, existingSetRecipe.id)
  eq('保持: createdAtは既存のまま', updated?.createdAt, existingSetRecipe.createdAt)
  eq('保持: favoriteは既存のまま', updated?.isFavorite, existingSetRecipe.isFavorite)
  eq('保持: cookedLogsは既存のまま', updated?.cookedLogs, existingSetRecipe.cookedLogs)
  eq('保持: photoは既存のまま', updated?.photo, existingSetRecipe.photo)
  eq('保持: isStarterは既存のまま', updated?.isStarter, existingSetRecipe.isStarter)

  // (3) 内容が完全に同一(セット名込み)ならnull=スキップ扱い(毎回「更新しました」と出るノイズを防ぐ)
  const sameContent = {
    servings: existingSetRecipe.servings,
    cookMinutes: existingSetRecipe.cookMinutes,
    effortLevel: existingSetRecipe.effortLevel,
    tags: [...existingSetRecipe.tags],
    season: existingSetRecipe.season,
    suitableFor: existingSetRecipe.suitableFor,
    ingredients: existingSetRecipe.ingredients.map((i) => ({ ...i })),
    steps: existingSetRecipe.steps.map((s) => ({ ...s })),
    quickSteps: existingSetRecipe.quickSteps,
    memo: existingSetRecipe.memo,
    sourceUrl: existingSetRecipe.sourceUrl,
  }
  eq(
    '内容が完全に同一ならnull(スキップ扱い)',
    buildUpdatedSetRecipe(existingSetRecipe, sameContent, existingSetRecipe.sourceSetName, 5000),
    null,
  )

  // セット名だけ変わっている(テーマ改名)場合も更新扱いになり、sourceSetNameに反映される
  // (バッチH-1で対応した挙動が、内容更新の仕組みに統合された後も保たれることの確認)
  const renamed = buildUpdatedSetRecipe(existingSetRecipe, sameContent, '新テーマ名', 5000)
  eq('セット名だけの変更でも更新扱いになる(null以外)', renamed !== null, true)
  eq('更新後のsourceSetNameが新名称になる', renamed?.sourceSetName, '新テーマ名')
}

// ---------- buildUpdatedSetRecipe: intro・quickCookMinutesも更新対象フィールドに含まれる
// (2026-07バグ修正: 前回dishTypeを追加したのと同型。これが無いと配布側でintro/
// quickCookMinutesだけを直しても再取込で既存ユーザーへ届かなかった) ----------
{
  const base = {
    id: 101,
    title: 'よだれ鶏',
    photo: undefined,
    intro: '旧イントロ',
    servings: 2,
    cookMinutes: 20,
    quickCookMinutes: 10,
    effortLevel: 'normal',
    tags: ['中華'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '鶏むね肉', amount: '300', unit: 'g' }],
    steps: [{ text: '鶏むね肉を茹でる' }],
    quickSteps: [{ text: 'レンジで加熱する' }],
    memo: '',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: [],
    isStarter: true,
    sourceSetId: 'chuka',
    sourceSetName: '中華セット',
    keywords: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }

  // introだけが違う場合も「内容の更新」として扱われる(dishType導入時と同じ確認パターン)
  const introOnly = { ...base, intro: '新イントロ' }
  const updatedIntro = buildUpdatedSetRecipe(base, introOnly, base.sourceSetName, 6000)
  eq('introだけの差分でも更新される(nullでない)', updatedIntro !== null, true)
  eq('更新結果にintroが反映される', updatedIntro?.intro, '新イントロ')
  eq('intro更新でもお気に入りは保持される', updatedIntro?.isFavorite, true)

  // quickCookMinutesだけが違う場合も「内容の更新」として扱われる
  const quickCookOnly = { ...base, quickCookMinutes: 8 }
  const updatedQuickCook = buildUpdatedSetRecipe(base, quickCookOnly, base.sourceSetName, 6000)
  eq('quickCookMinutesだけの差分でも更新される(nullでない)', updatedQuickCook !== null, true)
  eq('更新結果にquickCookMinutesが反映される', updatedQuickCook?.quickCookMinutes, 8)
  eq(
    'quickCookMinutes更新でもユーザーデータ(作った記録)は保持される',
    updatedQuickCook?.cookedLogs,
    base.cookedLogs,
  )

  // onePointだけが違う場合も「内容の更新」として扱われる(2026-07メモ2区画化で追加。
  // introやquickCookMinutesと同じ理由: これが無いと配布側でonePointだけを直しても
  // 再取込で既存ユーザーへ届かない)
  const onePointOnly = { ...base, onePoint: '新ワンポイント' }
  const updatedOnePoint = buildUpdatedSetRecipe(base, onePointOnly, base.sourceSetName, 6000)
  eq('onePointだけの差分でも更新される(nullでない)', updatedOnePoint !== null, true)
  eq('更新結果にonePointが反映される', updatedOnePoint?.onePoint, '新ワンポイント')
  eq('onePoint更新でもお気に入りは保持される', updatedOnePoint?.isFavorite, true)
}

// ---------- buildUpdatedSetRecipe: keywordsも更新対象フィールドに含まれる(検索キーワード欄
// 2026-07-12バッチ。公式レシピへの語彙付与ルールをセット再配信で反映できるようにする) ----------
{
  const base = {
    id: 99,
    title: 'ホイコーロー',
    photo: undefined,
    servings: 2,
    cookMinutes: 20,
    effortLevel: 'normal',
    tags: ['中華'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '豚バラ肉', amount: '200', unit: 'g' }],
    steps: [{ text: '豚バラ肉を炒める' }],
    quickSteps: undefined,
    memo: '',
    sourceUrl: undefined,
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    isStarter: true,
    sourceSetId: 'chuka',
    sourceSetName: '中華セット',
    keywords: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }
  const withKeyword = { ...base, keywords: ['回鍋肉'] }
  const updated = buildUpdatedSetRecipe(base, withKeyword, base.sourceSetName, 6000)
  eq('keywordsが増えただけでも更新扱いになる(null以外)', updated !== null, true)
  eq('更新: keywordsが反映される', updated?.keywords, ['回鍋肉'])
  eq(
    '更新: searchWordsにkeywordsが合流する',
    updated?.searchWords.some((w) => w.includes(toHiragana('回鍋肉'))),
    true,
  )
}

// ---------- buildUpdatedStarterRecipe / planStarterReload(基本レシピの入れ直しでユーザーデータを
// 保持できるように・2026-07-13 Fable設計。buildUpdatedSetRecipeと同じ考え方を移植し、
// 削除→再追加で消えていたお気に入り・作った記録・写真・編集を保持できるようにした) ----------
{
  const existingStarter = {
    id: 7,
    title: 'E2Eテスト用肉じゃが',
    photo: 'FAKE_PHOTO_BLOB',
    servings: 2,
    cookMinutes: 35,
    effortLevel: 'normal',
    tags: ['和食'],
    season: 'all',
    suitableFor: ['dinner'],
    ingredients: [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    steps: [{ text: '旧手順' }],
    quickSteps: undefined,
    memo: '旧メモ',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: ['old'],
    isStarter: true,
    sourceSetId: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }

  // (1) 内容は新版(starterDefs)に置き換わる
  const newDef = {
    title: 'E2Eテスト用肉じゃが',
    servings: 2,
    cookMinutes: 30,
    effortLevel: 'normal',
    tags: ['和食', '定番'],
    season: 'all',
    suitableFor: ['dinner'],
    ingredients: [
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: '牛こま切れ肉', amount: '200', unit: 'g' },
    ],
    steps: [{ text: '新手順' }],
    quickSteps: undefined,
    memo: '新メモ',
    sourceUrl: undefined,
  }
  const updated = buildUpdatedStarterRecipe(existingStarter, newDef, 5000)
  eq('内容が変わっていれば更新結果が返る(null以外)', updated !== null, true)
  eq('更新: 内容は新版に置き換わる(cookMinutes)', updated?.cookMinutes, 30)
  eq('更新: 内容は新版に置き換わる(steps)', updated?.steps, newDef.steps)
  eq('更新: 内容は新版に置き換わる(ingredients)', updated?.ingredients, newDef.ingredients)
  eq('更新: updatedAtが今回渡した時刻になる', updated?.updatedAt, 5000)

  // (2) お気に入り・作った記録・写真・id・createdAtが保持される
  eq('保持: お気に入りが保持される', updated?.isFavorite, true)
  eq('保持: 作った記録が保持される', updated?.cookedLogs, existingStarter.cookedLogs)
  eq('保持: 写真が保持される', updated?.photo, existingStarter.photo)
  eq('保持: idは既存のまま', updated?.id, existingStarter.id)
  eq('保持: createdAtは既存のまま', updated?.createdAt, existingStarter.createdAt)

  // (3) 内容が完全に同一なら同一内容はスキップ(null)
  const sameDef = {
    title: existingStarter.title,
    servings: existingStarter.servings,
    cookMinutes: existingStarter.cookMinutes,
    effortLevel: existingStarter.effortLevel,
    tags: [...existingStarter.tags],
    season: existingStarter.season,
    suitableFor: existingStarter.suitableFor,
    ingredients: existingStarter.ingredients.map((i) => ({ ...i })),
    steps: existingStarter.steps.map((s) => ({ ...s })),
    quickSteps: existingStarter.quickSteps,
    memo: existingStarter.memo,
    sourceUrl: existingStarter.sourceUrl,
  }
  eq('同一内容はスキップ(null)', buildUpdatedStarterRecipe(existingStarter, sameDef, 5000), null)

  // (3b) dishTypeだけが違う場合も「内容の更新」として扱う(dishType導入(2026-07-13)の配布が
  // 入れ直しで既存ユーザーへ届くことの保証。これが無いと同一内容扱いでスキップされる)
  {
    const withDishType = { ...sameDef, dishType: 'side' }
    const updatedByDishType = buildUpdatedStarterRecipe(existingStarter, withDishType, 6000)
    eq('dishTypeだけの差分でも更新される(nullでない)', updatedByDishType !== null, true)
    eq('更新結果にdishTypeが入る', updatedByDishType?.dishType, 'side')
    eq('dishType更新でもお気に入りは保持される', updatedByDishType?.isFavorite, true)
  }

  // (3c) intro・quickCookMinutesだけが違う場合も「内容の更新」として扱う(2026-07バグ修正:
  // 前回dishTypeを足したのと同型。これが無いと「基本レシピを入れ直す」でintro/
  // quickCookMinutesだけの配布側修正が既存ユーザーへ届かなかった)
  {
    const withIntro = { ...sameDef, intro: '新イントロ' }
    const updatedByIntro = buildUpdatedStarterRecipe(existingStarter, withIntro, 6000)
    eq('introだけの差分でも更新される(nullでない)', updatedByIntro !== null, true)
    eq('更新結果にintroが入る', updatedByIntro?.intro, '新イントロ')
    eq('intro更新でもお気に入りは保持される', updatedByIntro?.isFavorite, true)

    const withQuickCook = { ...sameDef, quickCookMinutes: 15 }
    const updatedByQuickCook = buildUpdatedStarterRecipe(existingStarter, withQuickCook, 6000)
    eq('quickCookMinutesだけの差分でも更新される(nullでない)', updatedByQuickCook !== null, true)
    eq('更新結果にquickCookMinutesが入る', updatedByQuickCook?.quickCookMinutes, 15)
    eq(
      'quickCookMinutes更新でも作った記録は保持される',
      updatedByQuickCook?.cookedLogs,
      existingStarter.cookedLogs,
    )

    // onePointだけが違う場合も「内容の更新」として扱う(2026-07メモ2区画化: intro等と同型)
    const withOnePoint = { ...sameDef, onePoint: '新ワンポイント' }
    const updatedByOnePoint = buildUpdatedStarterRecipe(existingStarter, withOnePoint, 6000)
    eq('onePointだけの差分でも更新される(nullでない)', updatedByOnePoint !== null, true)
    eq('更新結果にonePointが入る', updatedByOnePoint?.onePoint, '新ワンポイント')
    eq(
      'onePoint更新でも作った記録は保持される',
      updatedByOnePoint?.cookedLogs,
      existingStarter.cookedLogs,
    )
  }

  // (4) planStarterReload: 新規追加・更新・削除の仕分け。旧title品(starterDefsに無いtitle。
  // 旧版の品・ユーザーがタイトルを変えた品)は削除される
  const otherExisting = {
    id: 8,
    title: '旧版だけにあった品',
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    isStarter: true,
    sourceSetId: undefined,
    createdAt: 500,
    updatedAt: 500,
  }
  const defs = [newDef, { ...newDef, title: '新版で追加された品' }]
  const plan = planStarterReload([existingStarter, otherExisting], defs, 9000)
  eq('planStarterReload: 新規titleは追加対象になる', plan.toAdd.map((d) => d.title), [
    '新版で追加された品',
  ])
  eq('planStarterReload: 内容が変わった既存titleは更新対象になる', plan.toUpdate.length, 1)
  eq('planStarterReload: 更新対象のidは既存のまま', plan.toUpdate[0]?.id, existingStarter.id)
  eq('旧title品は削除される(starterDefsに無いtitle)', plan.toDeleteIds, [otherExisting.id])

  // (5) 二重投入ガード・トゥームストーン尊重(2026-07-23テーマ全廃)。planStarterReloadに
  // allTitles(端末上の全料理名)・excludedTitles(削除済み記録)を渡すと、基本レシピに同名が無くても
  // 端末に同名レシピがある/削除済みの品は新規追加しない
  {
    const addDefs = [
      { ...newDef, title: 'ゼロから新規の品' },
      { ...newDef, title: '?set=で取込済みの品' },
      { ...newDef, title: '削除済みの品' },
    ]
    const allTitles = new Set(['E2Eテスト用肉じゃが', '?set=で取込済みの品'])
    const excludedTitles = new Set(['削除済みの品'])
    const plan2 = planStarterReload([existingStarter], addDefs, 9000, allTitles, excludedTitles)
    eq(
      'planStarterReload: 端末に無く未削除の品だけ追加される(二重投入・復活を防ぐ)',
      plan2.toAdd.map((d) => d.title),
      ['ゼロから新規の品'],
    )
  }

  // (6) 「基本レシピを入れ直す」の確認文(2026-08-15 便GP・規約F)。
  // 旧文は「自分で編集した基本レシピは上書きされます。よろしいですか？」で、実際には
  // **料理名を変えた品が作った記録・写真ごと削除される**ことを伝えていなかった(説明が事実と違う)。
  // planStarterReloadは純関数なので、押す前に予行して件数で言い切れる
  {
    const baseDef = starterDefs[0]
    const asRecipe = (def, id, extra = {}) => ({
      ...def,
      id,
      isStarter: true,
      sourceSetId: undefined,
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    })
    // 料理名を自分で変えた基本レシピ(作った記録2件・レシピ写真1枚・記録の写真1枚つき)
    const renamed = asRecipe(baseDef, 2, {
      title: `${baseDef.title}（うちの味）`,
      photo: 'FAKE_PHOTO_BLOB',
      isFavorite: true,
      cookedLogs: [{ date: '2026-08-01' }, { date: '2026-08-02', photo: 'FAKE_PHOTO_BLOB' }],
    })
    const kept = asRecipe(baseDef, 1)
    const own = {
      id: 3,
      title: '自分で登録した品',
      isStarter: false,
      sourceSetId: undefined,
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const { plan, existingStarters } = planStarterReloadFor([kept, renamed, own], [], 9000)
    const impact = countStarterReloadImpact(existingStarters, plan)
    eq('STARTER-RELOAD 料理名を変えた基本レシピは消える(上書きではない)', impact.removed, 1)
    eq('STARTER-RELOAD 消える品に付いた作った記録も数える', impact.removedCookedLogs, 2)
    // 2026-08-16 便GZ: 作った記録とその写真は品と一緒には消えず残るので、消える写真は
    // レシピに登録した写真だけになった（記録の写真は「残るもの」側で数える）
    eq('STARTER-RELOAD 記録の写真は残る側で数える', impact.removedCookedPhotos, 1)
    eq('STARTER-RELOAD 消えるのはレシピに登録した写真だけ', impact.removedRecipePhotos, 1)
    eq('STARTER-RELOAD 料理名が一致する品は残る側で数える', impact.kept, 1)
    eq('STARTER-RELOAD 自分で登録したレシピは入れ直しの対象にしない', existingStarters.length, 2)
    eq(
      'STARTER-RELOAD 端末に無い基本レシピは追加される(自分で消した品も含む)',
      impact.added,
      starterDefs.length - 1,
    )

    const text = confirmContentText(buildStarterReloadConfirm(impact))
    eq(
      'STARTER-RELOAD 確認文は消える品数を件数で言う',
      text.includes(ja.settings.starterReloadConfirmRemoved.replace('{d}', String(impact.removed))),
      true,
    )
    eq(
      'STARTER-RELOAD 確認文は消えるレシピの写真の枚数も言う',
      text.includes(
        ja.settings.starterReloadConfirmRemovedData.replace(
          '{p}',
          String(impact.removedRecipePhotos),
        ),
      ),
      true,
    )
    // 0のものを並べない(「写真0枚も消えます」＝消えないものを数える文にしない)
    {
      const noPhoto = confirmContentText(
        buildStarterReloadConfirm({ ...impact, removedRecipePhotos: 0 }),
      )
      eq(
        'STARTER-RELOAD レシピの写真が無い品なら写真の件数は書かない',
        /レシピの写真\d+枚/.test(noPhoto),
        false,
      )
      // 2026-08-16 便GZ: 記録は残るので、記録の話は「残るもの」側に出る
      eq(
        'STARTER-RELOAD レシピの写真が無くても、残る記録の件数は書く',
        /作った記録2件（うち写真1枚）も残り/.test(noPhoto),
        true,
      )
      const noUserData = confirmContentText(
        buildStarterReloadConfirm({ ...impact, removedCookedLogs: 0, removedRecipePhotos: 0 }),
      )
      eq(
        'STARTER-RELOAD 記録も写真も無ければ、その1行ごと出さない',
        /も消えます/.test(noUserData),
        false,
      )
    }
    eq('STARTER-RELOAD 確認文は何が残るかも書く(規約F)', text.includes(ja.settings.starterReloadConfirmStays), true)
    eq('STARTER-RELOAD 確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(text), false)
    eq('STARTER-RELOAD 消える品を「上書き」と言い換えていない', /上書き/.test(text), false)

    // 消える品が0件のときに削除の話を書くと、消えないのに不安にさせる。件数で出し分ける
    const noneImpact = countStarterReloadImpact([kept], planStarterReloadFor([kept], [], 9000).plan)
    const noneText = confirmContentText(buildStarterReloadConfirm(noneImpact))
    eq('STARTER-RELOAD 料理名を変えていなければ消える品は0件', noneImpact.removed, 0)
    eq('STARTER-RELOAD 消える品が0件のときは削除の話を書かない', /削除|消え/.test(noneText), false)
    // 2026-08-26 オーナー指示（書き溜め0826）で「戻るもの: 基本レシピ{k}品の材料・手順・メモ」を
    // やめ、何をする操作かを言い切る1文（窓の本文）にした
    eq(
      'STARTER-RELOAD 消える品が0件でも、内容が元に戻ることは書く',
      noneText.includes(ja.settings.starterReloadConfirm),
      true,
    )
    eq(
      'STARTER-RELOAD 「戻るもの」の見出しの語を並べていない',
      /戻るもの/.test(noneText),
      false,
    )
    eq('STARTER-RELOAD 消える品が0件でも、何が残るかは書く', noneText.includes(ja.settings.starterReloadConfirmStays), true)
    eq('STARTER-RELOAD 件数の差し込み跡が残っていない', /\{[a-z]\}/.test(`${text}${noneText}`), false)

    // 画面の配線: 押す前に予行してから確認文を出す(ja.settings.starterReloadConfirmを直に出さない)
    const settingsSrc = readFileSync(
      path.join(path.dirname(fileURLToPath(scriptFileUrl)), '../src/pages/SettingsPage.tsx'),
      'utf-8',
    )
    eq(
      'STARTER-RELOAD 画面は押す前に予行して件数入りの確認文を出す',
      /previewStarterReload\(\)[\s\S]{0,200}await confirm\(buildStarterReloadConfirm\(/.test(
        settingsSrc,
      ),
      true,
    )
  }
}

// ---------- planFlattenedStarterTopUp(既存ユーザーへの差分投入。テーマ全廃2026-07-23) ----------
{
  const setDefs = [
    { title: '高たんぱく品A' },
    { title: '和食品B' },
    { title: '冷凍品C' },
    { title: 'ダイエット品D' },
  ]
  // 端末に既にB(自作or?set=取込済み)があり、Cは過去に削除済み(トゥームストーン)
  const existingTitles = ['肉じゃが', '和食品B']
  const exclusionTitles = ['冷凍品C']
  const toAdd = planFlattenedStarterTopUp(existingTitles, exclusionTitles, setDefs)
  eq(
    '差分投入: 端末に無く削除もされていない品だけ追加(既存品と削除品は除外)',
    toAdd.map((d) => d.title),
    ['高たんぱく品A', 'ダイエット品D'],
  )
  eq(
    '差分投入: 端末が空・削除記録も無ければ全部追加',
    planFlattenedStarterTopUp([], [], setDefs).length,
    4,
  )
  eq(
    '差分投入: 前後空白を無視して料理名照合する',
    planFlattenedStarterTopUp(['  高たんぱく品A '], [], setDefs).map((d) => d.title),
    ['和食品B', '冷凍品C', 'ダイエット品D'],
  )
}

// ---------- 全品同梱の健全性(テーマ全廃2026-07-23: 収録109品・料理名は一意) ----------
{
  eq('starterDefsは109品(基本57+旧テーマ52)', starterDefs.length, 109)
  const titles = starterDefs.map((d) => d.title.trim())
  eq('starterDefsの料理名はカタログ全体で一意', new Set(titles).size, titles.length)
  eq(
    '収録レシピ「だしのとり方」が同梱に含まれる(だし紐づけの飛び先)',
    titles.includes(DASHI_RECIPE_TITLE),
    true,
  )

  // 2026-07-29 副菜6品の増枠(docs/61)。6品とも副菜(dishType='side')・通年・昼夜で入っていること
  const SIDE6 = [
    'チンゲン菜としいたけのにんにく炒め',
    '白菜とにんじんの中華とろみ煮',
    'パプリカといんげんのオイスター炒め',
    'かぼちゃのミルク煮',
    'ラタトゥイユ',
    'ブロッコリーとにんじんのハーブマリネ',
  ]
  for (const t of SIDE6) {
    const def = starterDefs.find((d) => d.title === t)
    eq(`増枠副菜が同梱される: ${t}`, def != null, true)
    eq(`増枠副菜の種別は副菜: ${t}`, def?.dishType, 'side')
    eq(`増枠副菜は通年: ${t}`, def?.season, 'all')
    eq(`増枠副菜は昼・夜: ${t}`, def?.suitableFor, ['lunch', 'dinner'])
  }

  // 既存端末(増枠前の103品が入っている)への差分投入: 「基本レシピを入れ直す」で
  // 増枠6品だけが追加され、既存103品は内容が同じなので更新0件・削除0件になること
  // (お気に入り・作った記録などのユーザーデータに触れない = 増枠のたびに全消しされない)
  {
    const before = starterDefs
      .filter((d) => !SIDE6.includes(d.title))
      .map((d, k) => ({ ...d, id: k + 1, isStarter: true, isFavorite: false, cookedLogs: [] }))
    eq('増枠前の端末は103品', before.length, 103)
    const topUp = planStarterReload(before, starterDefs, 9000)
    eq('増枠の差分投入: 追加は増枠6品だけ', topUp.toAdd.map((d) => d.title).sort(), [...SIDE6].sort())
    eq('増枠の差分投入: 既存103品は更新されない(ユーザーデータに触れない)', topUp.toUpdate.length, 0)
    eq('増枠の差分投入: 削除は発生しない', topUp.toDeleteIds.length, 0)
  }
}

// ---------- だし紐づけ: 材料名が「だし汁」系か判定(2026-07-23) ----------
{
  eq('だし汁はだし系', isDashiIngredientName('だし汁'), true)
  eq('だしはだし系', isDashiIngredientName('だし'), true)
  eq('和風だしはだし系', isDashiIngredientName('和風だし'), true)
  eq('かつおだしはだし系', isDashiIngredientName('かつおだし'), true)
  eq('用途の丸括弧補足付きも拾う(だし汁(つゆ用))', isDashiIngredientName('だし汁(つゆ用)'), true)
  eq('全角丸括弧の補足も拾う(だし汁（卵液用）)', isDashiIngredientName('だし汁（卵液用）'), true)
  eq('だしの素は対象外(調味料でありだし汁ではない)', isDashiIngredientName('だしの素'), false)
  eq('複合表記「水またはだし汁」は対象外(保守的)', isDashiIngredientName('水またはだし汁'), false)
  eq('無関係な材料は対象外', isDashiIngredientName('しょうゆ'), false)
}

// ---------- 削除したセット品の再取込除外(トゥームストーン・2026-07-13 Fable設計) ----------
{
  // 削除時の記録: 配布セット由来なら(setId, title)を記録し、自作レシピは記録しない
  eq(
    '除外記録: セット由来レシピは(setId, title)を記録する',
    exclusionRecordFor({ sourceSetId: 'kintore', title: ' 漬けるだけ味玉 ' }),
    { setId: 'kintore', title: '漬けるだけ味玉' },
  )
  eq('除外記録: 自作レシピ(sourceSetIdなし)は記録しない', exclusionRecordFor({ title: '味玉' }), null)

  // 取込時の照合: 記録に一致する品はスキップ(importRecipeSetが追加直前にこの集合で判定する)
  const exclusions = [{ setId: 'kintore', title: '漬けるだけ味玉' }]
  eq(
    '取込時: 除外記録に一致する品はスキップされる',
    buildExclusionTitleSet(exclusions, 'kintore').has('漬けるだけ味玉'),
    true,
  )
  eq(
    '取込時: 別セットの同名品は除外しない(setIdまで一致した場合だけ)',
    buildExclusionTitleSet(exclusions, 'bento').has('漬けるだけ味玉'),
    false,
  )
  eq(
    '取込時: setIdの無いファイル(個人バックアップ形式)は除外対象なし',
    buildExclusionTitleSet(exclusions, undefined).size,
    0,
  )
  // 解除(「すべて戻す」で記録を消す)→再取込で復活する
  eq(
    '解除後(記録を消した後)は再取込で復活する(除外されない)',
    buildExclusionTitleSet([], 'kintore').has('漬けるだけ味玉'),
    false,
  )
}

// ---------- pickIconKey: 自動判定アイコンの全品スナップショット(2026-07-12 全面改修時の監査。
// 2026-07-15 アイコン分類改訂[docs/28]でpasta/vegetable/tofu新設に伴い19件を再ベースライン) ----------
// starters全品(51) + public/sets/data/*.json全品(bento/kintore/diet/summer/freezer)の
// title→期待キーを丸ごと並べる。今後の規則調整で意図せず判定が変わったらここで落ちる。
// (このテストが失敗しても即バグとは限らない。意図した変更ならこの期待表を更新すること)
const iconKeyExpected = {
  '肉じゃが': 'meat',
  'カレーライス': 'rice',
  '豆腐とわかめの味噌汁': 'soup',
  '豚の生姜焼き': 'meat',
  'ツナキャベツ丼': 'rice',
  '野菜炒め': 'vegetable', // 2026-07-15 vegetable新設(defaultだった野菜の副菜の受け皿)
  '親子丼': 'rice',
  'ハンバーグ': 'meat',
  '鶏の唐揚げ': 'chicken',
  '五目炊き込みご飯': 'rice',
  'ナポリタン': 'pasta', // 2026-07-15 pasta新設で洋麺をnoodleから切り出し
  'ペペロンチーノ': 'pasta', // 2026-07-15 pasta新設で洋麺をnoodleから切り出し
  'だし巻き卵': 'egg',
  '豚汁': 'soup',
  '寄せ鍋': 'soup',
  'チャーハン': 'rice',
  'ポテトサラダ': 'salad',
  'きんぴらごぼう': 'vegetable', // 2026-07-15 vegetable新設
  'さばの味噌煮': 'fish',
  'クリームシチュー': 'soup',
  '牛丼': 'rice',
  'ほうれん草のおひたし': 'salad',
  '麻婆豆腐': 'tofu', // 2026-07-15 tofu新設(豆腐がmeatより先に取る)
  '鮭の塩焼き': 'fish',
  '肉うどん': 'noodle', // 2026-07-12 Fable裁定: 主食(麺)が料理の類型を決めるので主食優先
  'ひじきの煮物': 'vegetable', // 2026-07-15 vegetable新設
  'もやしのナムル': 'salad',
  '白和え': 'salad',
  'コールスロー': 'salad',
  'ニラ玉': 'egg',
  '中華風卵スープ': 'soup', // 2026-07-12 Fable裁定: 「◯◯スープはsoup」
  '大学芋': 'dessert',
  'さんまの塩焼き': 'fish',
  '肉豆腐': 'tofu', // 2026-07-15 tofu新設(豆腐がmeatより先に取る)
  '鶏そぼろ丼': 'rice',
  '鮭のホイル焼き': 'fish',
  'なめこと豆腐の味噌汁': 'soup',
  'さつまいもの甘辛煮': 'vegetable', // 2026-07-15 vegetable新設
  'きゅうりとわかめの酢の物': 'salad',
  'オムライス': 'egg',
  'コンソメ野菜スープ': 'soup',
  '春雨サラダ': 'salad',
  '大根とツナのサラダ': 'salad',
  'キャベツの塩昆布あえ': 'salad',
  '蒸しなすの香味だれ': 'vegetable', // 2026-07-15 vegetable新設
  'バンバンジー': 'chicken',
  '牛乳もち': 'dessert',
  'フレンチトースト': 'bread',
  '家庭で作る杏仁豆腐': 'dessert',
  '鶏の照り焼き': 'chicken',
  '回鍋肉(ホイコーロー)': 'meat',
  'ミートボールの甘酢あん': 'meat',
  '卯の花(おからの炒り煮)': 'tofu', // 2026-07-15 tofu新設
  '切り干し大根のハリハリ漬け': 'vegetable', // 2026-07-15 vegetable新設
  '肉巻きおにぎり': 'rice',
  'れんこんのきんぴら': 'vegetable', // 2026-07-15 vegetable新設
  '高野豆腐の含め煮': 'tofu', // 2026-07-15 tofu新設
  'ちくわときゅうりの土佐酢あえ': 'salad',
  '甘辛手羽先の照り焼き': 'chicken',
  'こんにゃくの炒り煮': 'vegetable', // 2026-07-15 vegetable新設
  '手作り鮭フレーク': 'fish',
  'レンジ蒸し鶏（自家製サラダチキン）': 'chicken',
  '鶏むねのガーリック照り焼き': 'chicken',
  'ささみとブロッコリーのごま和え': 'salad',
  'サバ缶とトマトの煮込み': 'fish',
  '鶏ひき肉の豆腐ハンバーグ': 'tofu', // 2026-07-15 tofu新設。オーナー可逆判断(docs/28): chicken希望ならexclude追加で戻せる
  '漬けるだけ味玉': 'egg',
  'オートミール卵雑炊': 'rice',
  'エビとブロッコリーの卵炒め': 'fish',
  '鶏団子スープ': 'soup',
  'ツナと蒸し大豆の香味サラダ': 'salad',
  '鶏もも肉のタンドリー風': 'chicken',
  '豚肉のケチャップ炒め': 'meat',
  '鮭のハーブレモン焼き': 'fish',
  '鶏むね肉のオイスター炒め': 'chicken',
  '牛肉のプルコギ風': 'meat',
  '鶏もも肉のガーリックハーブ焼き': 'chicken',
  'えびのガーリックオイル炒め': 'fish',
  '豚肉の甜麺醤炒め': 'meat',
  '鶏むね肉のレモンペッパー炒め': 'chicken',
  '鮭の西京みそ漬け': 'fish',
  'さわらの西京焼き': 'fish',
  '豆腐ときのこの和風あんかけ': 'tofu', // 2026-07-15 tofu新設
  '鶏ささみの梅しそレンジ蒸し': 'chicken',
  'しらたきのチャプチェ風': 'noodle',
  'きのこの和風マリネ': 'salad',
  '白菜と豚しゃぶのレンジ蒸し': 'meat',
  '豆腐グラタン': 'tofu', // 2026-07-15 tofu新設
  'フルーツヨーグルトバーク': 'dessert',
  'たらの香味レンジ蒸し': 'fish',
  'よだれ鶏': 'chicken',
  '豆乳担々スープ': 'soup',
  '冷やし茶碗蒸し': 'egg',
  '梅しそ冷奴': 'tofu', // 2026-07-15 tofu新設
  'えびと薬味の香味だれそうめん': 'noodle', // 2026-07-12 Fable裁定: 主食(麺)が料理の類型を決めるので主食優先
  '冷しゃぶサラダ': 'salad',
  '冷や汁': 'soup',
  '冷やしトマトの浅漬け': 'salad',
  'オクラと長芋の梅肉あえ': 'salad',
  'ゴーヤチャンプルー': 'vegetable', // 2026-07-15 vegetable新設
  '梅おろしぶっかけうどん': 'noodle',
  '水ようかん': 'dessert',
  'だしのとり方': 'soup',
  // 2026-07-29 追加の副菜6品(docs/61)。判定結果はdocs/61 §4-7の実測どおり
  // (vegetable5・salad1。defaultに落ちる品はゼロ)
  'チンゲン菜としいたけのにんにく炒め': 'vegetable',
  '白菜とにんじんの中華とろみ煮': 'vegetable',
  'パプリカといんげんのオイスター炒め': 'vegetable',
  'かぼちゃのミルク煮': 'vegetable',
  'ラタトゥイユ': 'vegetable',
  'ブロッコリーとにんじんのハーブマリネ': 'salad',
}

{
  // 収録全109品(基本+旧テーマ由来)はstarterDefsが連結済み。旧public/sets/data/*.jsonは
  // テーマ全廃(2026-07-23)で撤去したため読まない(starterDefsだけで全品を網羅する)
  const iconEntries = []
  for (const def of starterDefs) {
    iconEntries.push({ source: 'starters.ts', recipe: def })
  }

  const seenTitles = new Set()
  for (const { source, recipe } of iconEntries) {
    seenTitles.add(recipe.title)
    const expected = iconKeyExpected[recipe.title]
    if (expected === undefined) {
      failures.push(`pickIconKey期待表に無いタイトル(${source}): ${recipe.title}`)
      continue
    }
    eq(`アイコン自動判定[${source}]: ${recipe.title}`, recipe.iconKey ?? pickIconKey(recipe), expected)
  }
  eq('アイコン期待表の品数は全品数と一致', Object.keys(iconKeyExpected).length, iconEntries.length)
  eq('アイコン期待表に無い余剰キーは無い', Object.keys(iconKeyExpected).every((t) => seenTitles.has(t)), true)

  // 2026-07-15 アイコン分類改訂(docs/28): カタログ全品でpickIconKeyがdefaultに
  // 落ちるものが無いこと(誤爆防止の核=たんぱく源が野菜の調理法語より先に取ること)。
  const defaultCount = iconEntries.filter(({ recipe }) => pickIconKey(recipe) === 'default').length
  eq('カタログ全品でpickIconKeyがdefaultになるものは0件', defaultCount, 0)

  // ---- 2026-08-15 便GU: 「レシピカードにアイコンも何も表示されていないものがある」の再発防止 ----
  // カードの絵はPNGをCSSマスクで描くので、アプリが絵を持たない種別が入ると
  // 「読めない画像でマスクする＝一切塗られない＝空白のタイル」になる。
  // 描く直前に通す resolveIconKey が、必ず絵のある種別だけを返すことを確かめる。
  // (手で選んだ値はアプリの選択UI以外からも入る: バックアップの読み込み・貼り付け取り込み・
  //  ファイルの手直し。値そのものを信用して描かないための歯止め)
  const hamburg = { title: 'ハンバーグ', tags: [], ingredients: [{ name: '合いびき肉' }] }
  eq(
    '便GU アイコン: 絵を持たない種別が入っていても、絵のある種別に落とす',
    iconKeyOrder.includes(resolveIconKey({ ...hamburg, iconKey: 'gratin' })),
    true,
  )
  eq(
    '便GU アイコン: 空文字が入っていても、絵のある種別に落とす',
    iconKeyOrder.includes(resolveIconKey({ ...hamburg, iconKey: '' })),
    true,
  )
  eq(
    '便GU アイコン: 手で選んだ種別は、絵があるかぎりそのまま使う',
    resolveIconKey({ ...hamburg, iconKey: 'soup' }),
    'soup',
  )
  eq(
    '便GU アイコン: 指定が無ければ自動判定と同じ結果になる',
    resolveIconKey(hamburg),
    pickIconKey(hamburg),
  )
  // カタログ全品も、描く直前の関数を通して必ず絵のある種別になる
  eq(
    '便GU アイコン: カタログ全品が絵のある種別に解決する',
    // 便LK: カタログを読めず0件になっても every は true になる（読めていないのに緑）
    iconEntries.length > 0 &&
      iconEntries.every(({ recipe }) => iconKeyOrder.includes(resolveIconKey(recipe))),
    true,
  )
}

// ---------- guessDishType: 役割の自動判定(2026-07-23 便BH-1・docs/56 §3-2) ----------
{
  // (a) guessDishType は pickIconKey の結果を役割へ写像するだけ。全カタログ109品で、期待アイコン
  //     (iconKeyExpected)から導いた役割と一致することを確認する(docs/56の63/71一致検証を流用)。
  const iconToRole = (icon) => {
    switch (icon) {
      case 'soup': return 'soup'
      case 'salad': case 'vegetable': return 'side'
      case 'dessert': case 'drink': case 'bread': return 'dessert'
      default: return 'main' // fish/egg/tofu/chicken/meat/rice/pasta/noodle/default はすべて主菜
    }
  }
  for (const def of starterDefs) {
    const expectedIcon = iconKeyExpected[def.title]
    if (expectedIcon === undefined) continue
    eq(`guessDishType[${def.title}]`, guessDishType(def), iconToRole(expectedIcon))
  }

  // (b) 代表ケースの固定(docs/56 §4-1)。既知の限界(卵の小鉢→main)も含めて挙動を明示する。
  eq('guessDishType: 野菜炒め→side(野菜が主役)', guessDishType({ title: '野菜炒め', tags: [], ingredients: [{ name: 'キャベツ' }] }), 'side')
  eq('guessDishType: 親子丼→main(主食)', guessDishType({ title: '親子丼', tags: [], ingredients: [{ name: '鶏もも肉' }] }), 'main')
  eq('guessDishType: 味噌汁→soup', guessDishType({ title: '豆腐とわかめの味噌汁', tags: [], ingredients: [{ name: '豆腐' }] }), 'soup')
  eq('guessDishType: ポテトサラダ→side', guessDishType({ title: 'ポテトサラダ', tags: [], ingredients: [{ name: 'じゃがいも' }] }), 'side')
  eq('guessDishType: 大学芋→dessert(その他)', guessDishType({ title: '大学芋', tags: [], ingredients: [{ name: 'さつまいも' }] }), 'dessert')
  eq('guessDishType: さばの味噌煮→main(魚)', guessDishType({ title: 'さばの味噌煮', tags: [], ingredients: [{ name: 'さば' }] }), 'main')
  eq('guessDishType: だし巻き卵→main(既知の限界:卵→main。データ側は裁定でside)', guessDishType({ title: 'だし巻き卵', tags: [], ingredients: [{ name: '卵' }] }), 'main')
  eq('guessDishType: 該当語なし→main(default)', guessDishType({ title: 'なぞの料理', tags: [], ingredients: [{ name: 'なにか' }] }), 'main')

  // (b-2) 2026-07-28 便BW/C-05: 実機QAで「全部 主菜(main)で保存される」と実測された6品の再発防止。
  // 5体のペルソナ全員が自動提案をそのまま通すと明言しており、誤った種別はそのままDBに残る。
  const dish = (title, ingredients = []) => guessDishType({ title, tags: [], ingredients })
  eq('C-05: 麦茶→その他(飲み物)', dish('麦茶', [{ name: '麦茶パック' }]), 'dessert')
  eq('C-05: ほうじ茶→その他(飲み物)', dish('ほうじ茶'), 'dessert')
  eq('C-05: 甘酒→その他(飲み物)', dish('甘酒'), 'dessert')
  eq('C-05: ぬか漬け→副菜(漬物)', dish('ぬか漬け', [{ name: 'きゅうり' }]), 'side')
  eq('C-05: きゅうりのピクルス→副菜', dish('きゅうりのピクルス'), 'side')
  eq('C-05: いちごのシャーベット→その他(菓子)', dish('いちごのシャーベット', [{ name: 'いちご' }]), 'dessert')
  eq('C-05: フルーツポンチ→その他(菓子)', dish('フルーツポンチ'), 'dessert')
  eq('C-05: 鮭のみそ汁→汁物(魚より汁物が料理の類型を決める)', dish('鮭のみそ汁', [{ name: '鮭' }]), 'soup')
  eq('C-05: あさりのお吸い物→汁物', dish('あさりのお吸い物', [{ name: 'あさり' }]), 'soup')
  eq('C-05: たらの水炊き→汁物', dish('たらの水炊き', [{ name: 'たら' }]), 'soup')
  // 汁物語を含まない魚料理は従来どおり主菜のまま(soupの前出しで魚料理を巻き込まないこと)
  eq('C-05: 鮭のホイル焼き→主菜(据え置き)', dish('鮭のホイル焼き', [{ name: '鮭' }]), 'main')
  eq('C-05: さばの味噌煮→主菜(据え置き)', dish('さばの味噌煮', [{ name: 'さば' }]), 'main')
  // 茶碗蒸し・お茶漬けは飲み物ではない(「茶」1文字を飲み物語に入れていないことの固定)
  eq('C-05: 茶碗蒸し→主菜(卵。飲み物にしない)', dish('茶碗蒸し', [{ name: '卵' }]), 'main')
  eq('C-05: 鮭のお茶漬け→主菜(ご飯もの。飲み物にしない)', dish('鮭のお茶漬け', [{ name: 'ご飯' }]), 'main')
  // 「◯◯漬け」全般を漬物にしていないこと(肉料理を副菜に巻き込まない)
  eq('C-05: 豚肉の味噌漬け→主菜(据え置き)', dish('豚肉の味噌漬け', [{ name: '豚ロース' }]), 'main')

  // (c) オーナー裁定8品の同梱データ(dishType)ピン留め(2026-07-23確定・docs/56 §2-3)。
  const byTitle = new Map(starterDefs.map((d) => [d.title, d]))
  const rulings = [
    ['野菜炒め', 'side'],
    ['だし巻き卵', 'side'],
    ['漬けるだけ味玉', 'side'],
    ['卯の花(おからの炒り煮)', 'side'],
    ['高野豆腐の含め煮', 'side'],
    ['寄せ鍋', 'main'],
    ['クリームシチュー', 'main'],
    ['手作り鮭フレーク', 'dessert'],
  ]
  for (const [title, expected] of rulings) {
    eq(`dishType裁定ピン留め: ${title}`, byTitle.get(title)?.dishType, expected)
  }
  // ジャンルタグ欠落品への付与(docs/56 §2-3 B)
  eq('野菜炒めに中華タグを付与', byTitle.get('野菜炒め')?.tags.includes('中華'), true)
  eq('レンジ蒸し鶏に和食タグを付与', byTitle.get('レンジ蒸し鶏（自家製サラダチキン）')?.tags.includes('和食'), true)

  // (d) isOneDish: 一品もの(丼・麺・鍋・カレー・シチュー)判定(docs/56 §3-8)
  eq('isOneDish: 寄せ鍋(鍋タグ)', isOneDish(byTitle.get('寄せ鍋')), true)
  eq('isOneDish: クリームシチュー(タイトル語・鍋/ご飯ものタグ無し)', isOneDish(byTitle.get('クリームシチュー')), true)
  eq('isOneDish: カレーライス(ご飯もの)', isOneDish(byTitle.get('カレーライス')), true)
  eq('isOneDish: 肉うどん(麺)', isOneDish(byTitle.get('肉うどん')), true)
  eq('isOneDish: 冷や汁(ご飯もの)', isOneDish(byTitle.get('冷や汁')), true)
  eq('isOneDish: 肉じゃが(該当なし)', isOneDish(byTitle.get('肉じゃが')), false)
  eq('isOneDish: 野菜炒め(該当なし)', isOneDish(byTitle.get('野菜炒め')), false)
  eq('isOneDish: だし巻き卵(該当なし)', isOneDish(byTitle.get('だし巻き卵')), false)
}

// ---------- 三つ葉/みつばの名寄せ統合(2026-07-23 便BH-1) ----------
{
  const mitsuba = PRICE_DEFAULTS.filter((d) => d.name === '三つ葉' || d.name === 'みつば')
  eq('三つ葉/みつばはPRICE_DEFAULTSに1件だけ(二重登録の解消)', mitsuba.length, 1)
  eq('統合先の名前はみつば', mitsuba[0]?.name, 'みつば')
  // 2026-08-26 便LF: みつばを100→155円/1束にしたので期待値もそろえた。
  // この節が見張っているのは「三つ葉とみつばが1行に寄っていること」で、値そのものではない
  // （155円の根拠は src/data/priceDefaults.ts のみつばの行のコメント）
  eq('統合先の価格は155円(docs/49のときは100円。2026-08-26 便LFが実勢に合わせた)', mitsuba[0]?.pricePerUnit, 155)
  eq('統合先の単位は1束', mitsuba[0]?.unit, '1束')
  const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  eq('材料「三つ葉(または刻みのり)」が価格解決する(旧表記のエイリアス)', matchPriceEntry('三つ葉(または刻みのり)', idx)?.pricePerUnit, 155)
  eq('材料「みつば(または小ねぎ)」が価格解決する', matchPriceEntry('みつば(または小ねぎ)', idx)?.pricePerUnit, 155)
  eq('三つ葉とみつばは同じ価格エントリに解決する', matchPriceEntry('三つ葉', idx)?.pricePerUnit, matchPriceEntry('みつば', idx)?.pricePerUnit)
}

// ---------- pickIconKey: 将来入力の代表ケース(2026-07-15 アイコン分類改訂・docs/28 §5) ----------
// タイトルのみ(タグ・材料は空)で判定させ、新優先順位表(rice→pasta→noodle→dessert→drink→
// fish→soup→egg→salad→tofu→chicken→meat→bread→vegetable)が意図どおり機能するかを確認する。
// 1つでも外れたら優先順位表の語順・exclude・段の位置をdocs/28と突き合わせて直すこと。
const futureIconCases = [
  ['肉野菜炒め', 'meat'],
  ['野菜炒め', 'vegetable'],
  ['カレーうどん', 'noodle'],
  ['マカロニサラダ', 'salad'],
  ['スパゲッティサラダ', 'salad'],
  ['杏仁豆腐', 'dessert'],
  ['茶碗蒸し', 'egg'],
  ['蒸しパン', 'bread'],
  ['焼きそば', 'noodle'],
  ['冷やし中華', 'noodle'],
  ['そうめん', 'noodle'],
  ['ナポリタン', 'pasta'],
  ['ペペロンチーノ', 'pasta'],
  ['カルボナーラ', 'pasta'],
  ['麻婆豆腐', 'tofu'],
  ['豆腐グラタン', 'tofu'],
  ['冷奴', 'tofu'],
  ['厚揚げの煮物', 'tofu'],
  ['ゴーヤチャンプルー', 'vegetable'],
  ['こんにゃくの炒り煮', 'vegetable'],
  ['きんぴられんこん', 'vegetable'],
  ['肉うどん', 'noodle'],
  ['さばの味噌煮', 'fish'],
  ['鶏の唐揚げ', 'chicken'],
  ['肉じゃが', 'meat'],
  // M-1(2026-07-16 Fable品質監査再発防止): drinkワードを含んでいても煮込み・肉料理は
  // drinkに誤爆しない(exclude: ['煮','豚','鍋'])
  ['紅茶豚', 'meat'],
  ['豚肉の紅茶煮', 'meat'],
  ['手羽元のオレンジジュース煮', 'chicken'],
]
for (const [title, expected] of futureIconCases) {
  eq(`pickIconKey将来入力: ${title}`, pickIconKey({ title, tags: [], ingredients: [] }), expected)
}

// ---------- cookedWithinDays: 「最近作った」判定(2026-07-29 便CI/C08) ----------
// 旧実装は cookedLogs[0] の1件だけを見ており、addCookedLog が日付を見ずに先頭へ積むため、
// 過去の日付を後から記録すると「今日作ったばかりのレシピ」が最近作っていない扱いになっていた
// (「今日なに作る？」の候補と献立の自動提案が誤って拾う)。全件の最大日付で判定する。
{
  const day = 24 * 60 * 60 * 1000
  const ymd = (offsetDays) => new Date(Date.now() - offsetDays * day).toISOString().slice(0, 10)
  const recipeWith = (dates) => ({ cookedLogs: dates.map((date) => ({ date })) })

  eq('C08 記録が無ければ false', cookedWithinDays(recipeWith([]), 14), false)
  eq('C08 今日の記録だけなら true', cookedWithinDays(recipeWith([ymd(0)]), 14), true)
  eq('C08 30日前の記録だけなら false', cookedWithinDays(recipeWith([ymd(30)]), 14), false)
  eq(
    'C08 今日の記録のあとに過去日を足しても(配列先頭が古くても)true のまま',
    cookedWithinDays(recipeWith([ymd(60), ymd(0)]), 14),
    true,
  )
  eq(
    'C08 並び順に関わらず判定は同じ(全件の最大日付で見る)',
    cookedWithinDays(recipeWith([ymd(0), ymd(60)]), 14),
    cookedWithinDays(recipeWith([ymd(60), ymd(0)]), 14),
  )
  eq(
    'C08 古い記録しか無ければ、何件あっても false',
    cookedWithinDays(recipeWith([ymd(90), ymd(40), ymd(20)]), 14),
    false,
  )
}

// ---------- 人数分の範囲ガード(2026-07-30 便CK/①-1) ----------
// ±ボタンのonClickにしかクランプが無く、URL取り込み(50人分)・貼り付け(50人分)・下書き復元(99人分)は
// 素通りしてそのまま保存できていた(手では21人分以上を作れないのに、詳細ページに
// 「50人分レシピの1食あたり 約24円」が出る状態)。全経路がこのクランプを通る形に直した
{
  eq('便CK/①-1 人数分の範囲は1〜20', [MIN_SERVINGS, MAX_SERVINGS], [1, 20])
  eq('便CK/①-1 範囲内の値はそのまま', clampServings(4), 4)
  eq('便CK/①-1 下限・上限そのものは通る', [clampServings(1), clampServings(20)], [1, 20])
  eq('便CK/①-1 貼り付けの50人分は20人分に収める', clampServings(50), 20)
  eq('便CK/①-1 URL取り込みの48人分は20人分に収める', clampServings(48), 20)
  eq('便CK/①-1 下書きの99人分は20人分に収める', clampServings(99), 20)
  eq('便CK/①-1 0以下は下限に寄せる', [clampServings(0), clampServings(-3)], [1, 1])
  eq('便CK/①-1 小数は切り捨てる(2.5人分は作れない)', clampServings(2.5), 2)
  eq('便CK/①-1 壊れた値(NaN)は下限に寄せる', clampServings(Number.NaN), 1)
  eq(
    '便CK/①-1 保存前の範囲チェック: 範囲外はfalse',
    [isServingsInRange(0), isServingsInRange(21), isServingsInRange(50), isServingsInRange(2.5)],
    [false, false, false, false],
  )
  eq(
    '便CK/①-1 保存前の範囲チェック: 範囲内はtrue',
    [isServingsInRange(1), isServingsInRange(2), isServingsInRange(20)],
    [true, true, true],
  )
}

// ---------- 実効食数の優先順位(2026-08-03 便DK・設定「ふだん作る人数」) ----------
// オーナー確定「3人家族なら予算や買い物メモは3人分で計算した数値が必要」。
// 優先順位は ①枠ごとに決めた食数 ②設定「ふだん作る人数」 ③レシピの登録人数分 の順で、
// 買い物メモの分量と概算食費が別々の人数分で計算されないよう、この1本だけを使う。
// 再発防止の要点: ①②とも未設定なら③＝従来とまったく同じ値になること(後方互換)
{
  eq('DK-SERV 枠ごとに決めた食数が最優先(設定より強い)', effectiveMealServings(4, 3, 2), 4)
  eq('DK-SERV 枠が未設定なら設定「ふだん作る人数」', effectiveMealServings(undefined, 3, 2), 3)
  eq(
    'DK-SERV 後方互換: 枠も設定も無ければレシピの登録人数分(従来と同値)',
    effectiveMealServings(undefined, undefined, 2),
    2,
  )
  eq(
    'DK-SERV どれも無い/壊れた値なら1人分',
    [
      effectiveMealServings(undefined, undefined, undefined),
      effectiveMealServings(0, 0, 0),
      effectiveMealServings(undefined, undefined, -3),
    ],
    [1, 1, 1],
  )
  eq('DK-SERV 範囲外の値は1〜20に収める(設定経由でも上限を破らせない)', effectiveMealServings(undefined, 50, 2), 20)
  // 「既定に戻す」の戻り先＝枠の食数を無視した値。ボタンの文言と実際の戻り先を同じ関数から出す
  eq('DK-SERV 既定の食数: 設定があればその人数', defaultMealServings(3, 2), 3)
  eq('DK-SERV 既定の食数: 設定が無ければレシピの登録人数分', defaultMealServings(undefined, 4), 4)
  eq('DK-SERV 既定の食数は枠ごとの食数を見ない', defaultMealServings(undefined, 2), 2)
}

// ---------- 便CT: レシピ一覧のまとめて削除の確認文(規約F。2026-08-02 オーナー承認) ----------
{
  const log = (photo) => (photo ? { date: '2026-08-01', photo: { size: 1 } } : { date: '2026-08-01' })
  // 「入れ直しで戻せる基本レシピ」は同梱の基本レシピだけ。配布セット由来(sourceSetIdあり)は
  // 削除でトゥームストーンが残り入れ直しでも復活しないので、戻せる扱いにしない
  eq('CT-DEL 同梱の基本レシピは戻せる', isRestorableStarter({ isStarter: true }), true)
  eq(
    'CT-DEL 配布セット由来は戻せない',
    isRestorableStarter({ isStarter: true, sourceSetId: 'kintore' }),
    false,
  )
  eq('CT-DEL 自作レシピは戻せない', isRestorableStarter({ isStarter: false }), false)

  const impact = summarizeRecipeDeleteImpact(
    [
      { isStarter: true, cookedLogs: [log(true), log(false)] },
      { isStarter: false, cookedLogs: [log(true)] },
      { isStarter: true, sourceSetId: 'kintore', cookedLogs: [] },
    ],
    { totalRecipes: 109, mealPlanEntries: 4, todayEntries: 2 },
  )
  eq('CT-DEL 削除する品数', impact.recipes, 3)
  eq('CT-DEL 作った記録の合計', impact.cookedLogs, 3)
  eq('CT-DEL 写真つきの枚数', impact.photos, 2)
  eq('CT-DEL 戻せる基本レシピの品数', impact.restorableStarters, 1)
  eq('CT-DEL 献立の予定の件数', impact.mealPlanEntries, 4)
  eq('CT-DEL 今日の献立の件数', impact.todayEntries, 2)
  eq('CT-DEL 残るレシピの品数', impact.remaining, 106)

  const text = confirmContentText(buildBulkDeleteConfirm(impact))
  // 規約F: 何が消えるか・何が残るかを件数つきで両方書く(「よろしいですか？」だけは禁止)
  eq('CT-DEL 確認文に削除する品数が入る', /レシピ3品を削除します/.test(text), true)
  eq('CT-DEL 確認文に作った記録の件数が入る', /作った記録3件/.test(text), true)
  eq('CT-DEL 確認文に写真の枚数が入る', /写真2枚/.test(text), true)
  eq('CT-DEL 確認文に献立の予定の数が入る', /献立の予定4[品件]/.test(text), true)
  eq('CT-DEL 確認文に今日の献立の数が入る', /今日の献立2[品件]/.test(text), true)
  eq('CT-DEL 確認文に元に戻せないことが入る', text.includes('元に戻せません'), true)
  eq('CT-DEL 確認文に残るレシピの品数が入る', /他のレシピ106品/.test(text), true)
  // 2026-08-15 便GW: 「残るもの」は太字の項目名になったので、項目名と中身の両方を見る
  eq('CT-DEL 確認文に残るものが入る', /残るもの: [^\n]*買い物メモ・食材の在庫/.test(text), true)
  eq('CT-DEL 「よろしいですか？」だけで終わらせない', text.includes('よろしいですか'), false)
  // 基本レシピだけは入れ直しで戻せる(ただし記録は戻らない)ことを区別して書く。
  // 規約H: 場所は指示語ではなく画面名・ボタン名で言う
  eq('CT-DEL 基本レシピの戻し方を添える', /基本レシピ1品は、設定画面の「基本レシピを入れ直す」で戻せます/.test(text), true)
  // 2026-08-16 便GZ: 基本レシピの印は料理名から決まるので、入れ直すと記録もつながり直す
  // （それまでは「作った記録は戻りません」だった）
  eq('CT-DEL 記録もつながり直すことを添える', text.includes('作った記録もつながり直します'), true)

  // 基本レシピを含まない選択では、入れ直しの一文を出さない(戻せない品に戻せると言わない)
  const ownOnly = summarizeRecipeDeleteImpact([{ isStarter: false, cookedLogs: [] }], {
    totalRecipes: 5,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 自作だけなら入れ直しの一文は出さない', ownOnly.restorableStarters, 0)
  eq(
    'CT-DEL 自作だけの確認文に入れ直しの案内を出さない',
    confirmContentText(buildBulkDeleteConfirm(ownOnly)).includes('基本レシピを入れ直す'),
    false,
  )
  eq(
    'CT-DEL 記録0件でも件数を明示する(0件と書く)',
    /作った記録0件（うち写真0枚）/.test(confirmContentText(buildBulkDeleteConfirm(ownOnly))),
    true,
  )
  // 全部消す選択でも「残り0品」と正直に書く(残るものの行自体は消さない)
  const allGone = summarizeRecipeDeleteImpact([{ isStarter: false }, { isStarter: false }], {
    totalRecipes: 2,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 全件削除なら残りは0品', allGone.remaining, 0)
  eq('CT-DEL 残り0品でも残るものを書く', /他のレシピ0品/.test(confirmContentText(buildBulkDeleteConfirm(allGone))), true)
  // 記録の配列が無いレシピ(cookedLogs未設定)でも落ちない
  eq(
    'CT-DEL cookedLogs未設定でも数えられる',
    summarizeRecipeDeleteImpact([{ isStarter: true }], {
      totalRecipes: 1,
      mealPlanEntries: 0,
      todayEntries: 0,
    }).cookedLogs,
    0,
  )
}

// ---------- 便FF-1: 「作った！」で食数を記録する(2026-08-10 オーナー指示) ----------
{
  // 記録する食数の決まり方＝買い物メモ・概算食費とまったく同じ優先順位。
  // ①枠に決めた食数 ②設定「食数の設定」の人数 ③レシピの登録人数分
  eq('FF-COOKSV 枠に決めた食数が最優先', effectiveMealServings(3, 4, 2), 3)
  eq('FF-COOKSV 枠に無ければ設定の人数', effectiveMealServings(undefined, 4, 2), 4)
  eq(
    'FF-COOKSV どちらも無ければレシピの登録人数分',
    effectiveMealServings(undefined, undefined, 2),
    2,
  )
  eq('FF-COOKSV 全部無ければ1人分', effectiveMealServings(undefined, undefined, undefined), 1)
  eq('FF-COOKSV 範囲外の食数は1〜20に収める', effectiveMealServings(99, undefined, 2), 20)

  // ボタン1回の記録の見分け方。**食数を判定材料にしない**のが要点で、
  // 入れてしまうと便FF以降の記録が「元に戻す」で取り消せず、
  // 同じ日に何度でも二重に付く(便EHで直したバグの再発)。
  const today = '2026-08-10'
  eq(
    'FF-ONETAP 食数だけ入った記録はボタン1回の記録として扱う',
    isOneTapCookedLog({ date: today, servings: 4 }, today),
    true,
  )
  eq(
    'FF-ONETAP 食数も無い古い記録も従来どおり対象',
    isOneTapCookedLog({ date: today }, today),
    true,
  )
  eq(
    'FF-ONETAP メモを書いた記録は対象外(手で書いた記録を巻き込まない)',
    isOneTapCookedLog({ date: today, servings: 4, note: '子どもが完食' }, today),
    false,
  )
  eq(
    'FF-ONETAP 写真を付けた記録は対象外',
    isOneTapCookedLog({ date: today, servings: 4, photo: {} }, today),
    false,
  )
  eq(
    'FF-ONETAP 別の日の記録は対象外',
    isOneTapCookedLog({ date: '2026-08-09', servings: 4 }, today),
    false,
  )
}

// ---------- GF-A 「まとめて作った！」の案内文と、実際に起きることを一致させる ----------
// 2026-08-14 便GF・利用者テスト（原文）:
//   「ダイアログに『記録した3件は今日の献立から外れます（レシピと段取りはそのまま残ります）』と
//     書かれている／『記録をつける』を押す／並行調理ナビが『今日の献立にレシピがありません』に
//     なり、段取りが消える。リロードしても戻らない」
//   「実害: 作り終えて記録をつけた直後に『あれ、パセリの前に何やったっけ』と振り返れない。
//     説明文がその場で嘘になっているのが一番まずい」
// 記録したら段取りを終える動き自体はオーナーの整理どおり（2026-08-13）なので、直すのは案内文。
// **動き（消える）と案内文（消えると書いてある）を1つのテストで突き合わせる**＝
// 片方だけ直しても緑にならない形にする。
{
  const store = new Map()
  const shim = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: shim, configurable: true, writable: true })
  const { saveCookNaviSession, loadCookNaviSession, clearCookNaviSession } = await import(
    '../../src/logic/cookNaviSession.ts'
  )
  saveCookNaviSession({
    selectedIds: [1, 2, 3],
    showTimeline: true,
    trialActive: false,
    current: { recipeId: 1, stepIndex: 0 },
  })
  eq('GF-A 前提: 段取りは端末に残っている', loadCookNaviSession()?.showTimeline, true)
  // 「まとめて作った！」が呼ぶ後始末（CookNaviPage の markAllCooked）
  clearCookNaviSession()
  eq('GF-A 記録をつけたあと、段取りは残らない', loadCookNaviSession(), undefined)
  const confirmText = ja.cookNavi.markAllCookedConfirm
  eq(
    'GF-A 案内文に、段取りが消えることが書いてある',
    confirmText.includes('段取り') && confirmText.includes('消えます'),
    true,
  )
  neq(
    'GF-A 案内文が「段取りは残る」と言っていない（利用者が読んだ嘘の一文）',
    /段取り[^。]*残ります/.test(confirmText),
    true,
  )
  eq(
    'GF-A 案内文に、何が残るかも書いてある（規約F）',
    confirmText.includes('レシピ・作った記録') && confirmText.includes('残ります'),
    true,
  )
  // 記録した直後の並行調理ナビは「今日の献立が空」ではなく「今日の献立を作り終えた」状態。
  // 「レシピがありません」と出ると、そこでも画面が事実と違うことを言うことになる
  eq(
    'GF-A 作り終えたときの案内は、献立が空のときの文言をそのまま使わない',
    ja.cookNavi.emptyTodayCooked.includes('今日の献立にレシピがありません'),
    false,
  )
  eq(
    'GF-A 作り終えたときの案内は、件数と次にできることを書く',
    ja.cookNavi.emptyTodayCooked.includes('{n}品') &&
      ja.cookNavi.emptyTodayCooked.includes('「今日の献立に追加」'),
    true,
  )
  if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal)
  else delete globalThis.localStorage
  if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession)
  else delete globalThis.sessionStorage
}

// ---------- 便GZ: レシピを削除しても「作った記録」が残る(2026-08-16 オーナー承認) ----------
// オーナーの求めた形:
//  ①レシピを削除したらカードも詳細画面も無くなる ②記録は残り、内容も写真も見られる
//  ③記録からレシピ詳細へは行けない ④書き出したファイルから同じレシピを入れ直すとつながりが戻る
// オーナーの懸念は「似た名前の違うレシピとつながってしまいそう」。ここは**名前で結ばない**ことを固定する。
{
  const log = (date, note, photo) => ({
    date,
    ...(note ? { note } : {}),
    ...(photo ? { photo: { size: photo } } : {}),
  })

  // --- 印(uid)の決め方 ---
  eq('GZ-UID 基本レシピの印は料理名から決まる', starterRecipeUid('肉じゃが'), 'starter:肉じゃが')
  eq('GZ-UID 前後の空白は印に含めない', starterRecipeUid(' 肉じゃが '), 'starter:肉じゃが')
  eq('GZ-UID 基本レシピの印は見分けが付く', isStarterUid(starterRecipeUid('肉じゃが')), true)
  neq('GZ-UID 乱数の印は毎回違う', newRecipeUid(), newRecipeUid())
  eq('GZ-UID 乱数の印は基本レシピの印と形が違う', isStarterUid(newRecipeUid()), false)

  // 後から印を振る(移行)。印を持っている品は触らない・基本レシピだけ料理名由来の印になる
  {
    let n = 0
    const makeUid = () => `rnd-${++n}`
    const plan = planRecipeUidBackfill(
      [
        { id: 1, title: '肉じゃが', isStarter: true },
        { id: 2, title: '肉じゃが', isStarter: false }, // 自分で登録した同名レシピ
        { id: 3, title: '高たんぱく品A', isStarter: true, sourceSetId: 'kintore' },
        { id: 4, title: '既に印あり', uid: 'keep-me' },
      ],
      new Set(['肉じゃが']),
      makeUid,
    )
    eq('GZ-移行 印の無い品だけに振る', plan.length, 3)
    eq('GZ-移行 基本レシピは料理名由来の印', plan.find((p) => p.id === 1).uid, 'starter:肉じゃが')
    // ここがオーナーの懸念そのもの: 同じ料理名でも、自作レシピは基本レシピと別の印になる
    eq('GZ-移行 同名の自作レシピは乱数の印(基本レシピと同じ印にしない)', plan.find((p) => p.id === 2).uid, 'rnd-1')
    eq('GZ-移行 配布セット由来は乱数の印', plan.find((p) => p.id === 3).uid, 'rnd-2')
    eq('GZ-移行 既に印がある品は作り直さない', plan.some((p) => p.id === 4), false)
    // 印は二度と重ならない(重なると結び直しの相手が一意に決まらない)
    eq('GZ-移行 振った印に重複が無い', new Set(plan.map((p) => p.uid)).size, plan.length)
  }
  {
    // 既に他の品が同じ料理名由来の印を使っていたら、乱数に落とす(重複を作らない)
    const plan = planRecipeUidBackfill(
      [
        { id: 1, title: 'カレー', uid: 'starter:カレー' },
        { id: 2, title: 'カレー', isStarter: true },
      ],
      new Set(['カレー']),
      () => 'rnd-x',
    )
    eq('GZ-移行 印がぶつかるときは乱数に落とす', plan[0].uid, 'rnd-x')
  }

  // --- 削除で残すまとまりの作り方 ---
  {
    const recipe = {
      uid: 'u-1',
      title: '肉じゃが',
      iconKey: 'meat',
      servings: 2,
      cookedLogs: [log('2026-08-01'), log('2026-08-03', 'おいしくできた', 10)],
    }
    const record = buildDetachedRecord(recipe, 1000)
    eq('GZ-削除 印を写して残す', record.recipeUid, 'u-1')
    eq('GZ-削除 料理名を写して残す(表示用。照合には使わない)', record.title, '肉じゃが')
    eq('GZ-削除 記録は日付の新しい順に並べる', record.logs.map((l) => l.date), ['2026-08-03', '2026-08-01'])
    eq('GZ-削除 写真も一緒に残る', record.logs[0].photo.size, 10)
    eq('GZ-削除 ひとことメモも残る', record.logs[0].note, 'おいしくできた')
    eq(
      'GZ-削除 記録が1件も無いレシピはまとまりを作らない',
      buildDetachedRecord({ uid: 'u-2', title: 'から揚げ', servings: 2, cookedLogs: [] }),
      null,
    )
  }

  // --- 結び直し(オーナーの④と懸念) ---
  {
    const records = [
      { id: 1, recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01'), log('2026-08-02')], detachedAt: 1 },
      { id: 2, recipeUid: 'u-2', title: 'カレー', logs: [log('2026-07-01')], detachedAt: 1 },
      { id: 3, title: '印の無い記録', logs: [log('2026-06-01')], detachedAt: 1 },
    ]
    // 「肉じゃが」という同じ料理名の別レシピ(印が違う)を入れ直しても結ばれてはいけない
    const recipes = [{ id: 10, uid: 'other-uid', cookedLogs: [] }]
    const noMatch = planDetachedReattach(records, recipes)
    eq('GZ-結び直し 料理名が同じでも印が違えば結ばない', noMatch.items.length, 0)
    eq('GZ-結び直し 結ばなかった記録は消えない(件数0)', noMatch.logsReattached, 0)

    // 印が一致するレシピが入り直したときだけ結ぶ
    const matched = planDetachedReattach(records, [
      { id: 10, uid: 'u-1', cookedLogs: [] },
      { id: 11, uid: 'other-uid', cookedLogs: [] },
    ])
    eq('GZ-結び直し 印が一致した1品だけ結ぶ', matched.items.length, 1)
    eq('GZ-結び直し 戻した記録の件数', matched.logsReattached, 2)
    eq('GZ-結び直し 戻し先のレシピ', matched.items[0].recipeId, 10)
    eq('GZ-結び直し 消すまとまりの番号', matched.items[0].recordId, 1)
    eq('GZ-結び直し 印の無い記録は結ばない', matched.items.some((i) => i.recordId === 3), false)

    // 同じ記録がレシピ側にもある場合は二重にしない(写真だけ埋める)
    const dup = planDetachedReattach(
      [{ id: 1, recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01', undefined, 5)], detachedAt: 1 }],
      [{ id: 10, uid: 'u-1', cookedLogs: [log('2026-08-01')] }],
    )
    eq('GZ-結び直し 同じ記録は二重に足さない', dup.logsReattached, 0)
    eq('GZ-結び直し 記録の件数は増えない', dup.items[0].cookedLogs.length, 1)
    eq('GZ-結び直し 欠けていた写真だけ埋める', dup.items[0].cookedLogs[0].photo.size, 5)
  }

  // --- まとまりの畳み込み(同じレシピを入れ直しては消す、を繰り返しても行が増えない) ---
  {
    const merged = mergeDetachedRecords([
      { recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01')], detachedAt: 1 },
      { recipeUid: 'u-1', title: '肉じゃが（改）', logs: [log('2026-08-05')], detachedAt: 2 },
      { title: '印なし', logs: [log('2026-08-03')], detachedAt: 1 },
    ])
    eq('GZ-畳み込み 同じ印は1行にまとめる', merged.length, 2)
    eq('GZ-畳み込み 記録は両方残る', merged[0].logs.length, 2)
    eq('GZ-畳み込み 料理名は新しく消した方を採る', merged[0].title, '肉じゃが（改）')
    eq('GZ-畳み込み 印の無い行はまとめない', merged[1].title, '印なし')
  }

  // --- 画面へ渡す形(オーナーの③: レシピ詳細へ行けない) ---
  {
    const stub = detachedRecipeStub({
      id: 7,
      recipeUid: 'u-1',
      title: '肉じゃが',
      iconKey: 'meat',
      servings: 3,
      logs: [log('2026-08-01')],
      detachedAt: 1,
    })
    // レシピ番号を持たない＝小窓・カードがレシピ詳細への行き先を出さない経路に乗る
    eq('GZ-表示 レシピ番号を持たない(詳細画面へ行けない)', stub.id, undefined)
    eq('GZ-表示 料理名は出す', stub.title, '肉じゃが')
    eq('GZ-表示 アイコンは削除前のものを引き継ぐ', stub.iconKey, 'meat')
    eq('GZ-表示 記録はそのまま読める', stub.cookedLogs.length, 1)
    // 材料・手順は空にする＝栄養や食費の集計に「中身が0の料理」を混ぜないための歯止め
    eq('GZ-表示 材料は空(集計に混ぜない)', stub.ingredients.length, 0)
    eq('GZ-表示 手順は空', stub.steps.length, 0)
  }

  // --- 件数と容量 ---
  {
    const records = [
      { logs: [log('2026-08-01'), log('2026-08-02', undefined, 100)] },
      { logs: [log('2026-07-01', undefined, 50)] },
    ]
    eq('GZ-件数 残っている記録の件数', countDetachedLogs(records).logs, 3)
    eq('GZ-件数 そのうち写真つきの枚数', countDetachedLogs(records).photos, 2)
    eq('GZ-容量 写真の合計バイト数', detachedPhotoBytes(records), 150)
  }

  // --- 削除の確認文(規約F・オーナー指示「記録は残るに変わるはずなので文言も直す」) ---
  {
    const impact = summarizeRecipeDeleteImpact(
      [
        { isStarter: true, cookedLogs: [log('2026-08-01', undefined, 1), log('2026-08-02')] },
        { isStarter: false, cookedLogs: [log('2026-08-01', undefined, 1)] },
      ],
      { totalRecipes: 109, mealPlanEntries: 4, todayEntries: 2 },
    )
    const text = confirmContentText(buildBulkDeleteConfirm(impact))
    eq('GZ-確認文 記録は「残るもの」に件数つきで入る', /残るもの: 作った記録3件（うち写真2枚）/.test(text), true)
    eq('GZ-確認文 「消えるもの」に記録を書かない', /消えるもの: [^\n]*作った記録/.test(text), false)
    eq('GZ-確認文 消えるものはレシピの中身と献立', /消えるもの: [^\n]*材料・手順/.test(text), true)
    eq('GZ-確認文 献立の予定・今日の献立の数は残す', /献立の予定4[品件]・今日の献立2[品件]/.test(text), true)
    eq('GZ-確認文 記録がどこで読めるか書く', text.includes('作った記録の一覧'), true)
    eq('GZ-確認文 レシピ詳細へ行けなくなることを書く', text.includes('レシピ詳細へは行けなくなります'), true)
    eq('GZ-確認文 入れ直せば戻ることを書く', text.includes('読み込み直す'), true)
    eq('GZ-確認文 基本レシピは記録もつながり直すと書く', text.includes('作った記録もつながり直します'), true)
    eq('GZ-確認文 「よろしいですか？」だけで終わらせない', text.includes('よろしいですか'), false)

    // 記録が0件なら、残り方の説明は出さない(残らないものを「残ります」と言わない)
    const noLogs = summarizeRecipeDeleteImpact([{ isStarter: false, cookedLogs: [] }], {
      totalRecipes: 5,
      mealPlanEntries: 0,
      todayEntries: 0,
    })
    const noLogsText = confirmContentText(buildBulkDeleteConfirm(noLogs))
    eq('GZ-確認文 記録0件でも件数は明示する', /作った記録0件（うち写真0枚）/.test(noLogsText), true)
    eq('GZ-確認文 記録0件なら残り方の説明は出さない', noLogsText.includes('作った記録の一覧'), false)

    // 1品削除も同じ規則(2つの確認文が食い違わない)
    const single = confirmContentText(buildSingleDeleteConfirm({ cookedLogs: 2, photos: 1 }))
    eq('GZ-確認文 1品削除でも記録は残るものに入る', /残るもの: 作った記録2件（うち写真1枚）/.test(single), true)
    eq('GZ-確認文 1品削除でも消えるものに記録を書かない', /消えるもの: [^\n]*作った記録/.test(single), false)
    eq('GZ-確認文 1品削除でも記録の読み場所を書く', single.includes('作った記録の一覧'), true)
    eq(
      'GZ-確認文 1品削除で記録0件なら残り方の説明は出さない',
      confirmContentText(buildSingleDeleteConfirm({ cookedLogs: 0, photos: 0 })).includes('作った記録の一覧'),
      false,
    )
    eq('GZ-確認文 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(`${text}${single}`), false)
  }

  // --- バックアップ(古いファイルとの往復。オーナー指示「古いバックアップから戻せなくなるのは絶対に不可」) ---
  {
    const base = { app: 'uchi-recipe', version: 1, exportedAt: '', recipes: [] }
    eq(
      'GZ-バックアップ 項目を持たない古いファイルでは残った記録に触らない',
      tablesToReplace(base).detachedLogs,
      false,
    )
    eq(
      'GZ-バックアップ 空配列は「空にする意図」として置き換え対象',
      tablesToReplace({ ...base, detachedLogs: [] }).detachedLogs,
      true,
    )
    eq(
      'GZ-バックアップ 中身があれば置き換え対象',
      tablesToReplace({ ...base, detachedLogs: [{ title: 'x', logs: [], detachedAt: 1 }] }).detachedLogs,
      true,
    )
    // 上書きの確認文は、残った記録も消える件数に数える(数え漏らすと言った件数より多く消える)
    const impact = countReplaceImpact([{ cookedLogs: [log('2026-08-01')] }], 3, [
      { logs: [log('2026-07-01'), log('2026-07-02')] },
    ])
    eq('GZ-バックアップ 上書きで消える記録に残った記録も足す', impact.cookedLogs, 3)
    eq(
      'GZ-バックアップ 残った記録を渡さなくても従来どおり数えられる',
      countReplaceImpact([{ cookedLogs: [log('2026-08-01')] }], 3).cookedLogs,
      1,
    )
    // 「今のデータに追加」で同じまとまりかを見分ける鍵は印。料理名では突き合わせない
    eq(
      'GZ-バックアップ 印があれば印だけで見分ける',
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: '肉じゃが', detachedAt: 1 }),
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: 'ぜんぜん違う名前', detachedAt: 999 }),
    )
    neq(
      'GZ-バックアップ 料理名が同じでも印が違えば別のまとまり',
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: '肉じゃが', detachedAt: 1 }),
      mergeRowKeys.detachedLogs({ recipeUid: 'u-2', title: '肉じゃが', detachedAt: 1 }),
    )
  }

  // --- 「基本レシピを入れ直す」の確認文も、記録が残る側に変わる ---
  {
    const removed = {
      removed: 1,
      removedCookedLogs: 2,
      removedCookedPhotos: 1,
      removedRecipePhotos: 1,
      kept: 3,
      added: 0,
    }
    const text = confirmContentText(buildStarterReloadConfirm(removed))
    eq('GZ-入れ直し 消えるのはレシピの写真だけ', text.includes('レシピの写真1枚も消えます'), true)
    eq('GZ-入れ直し 「消えるもの」に作った記録を書かない', /消えるもの: [^\n]*作った記録/.test(text), false)
    eq('GZ-入れ直し 残るものに記録の件数を書く', text.includes('作った記録2件（うち写真1枚）も残り'), true)
    eq(
      'GZ-入れ直し 記録が付いていない品なら記録の話は書かない',
      /作った記録\d+件（うち写真/.test(
        confirmContentText(buildStarterReloadConfirm({ ...removed, removedCookedLogs: 0 })),
      ),
      false,
    )
    eq('GZ-入れ直し 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(text), false)
  }

  // --- 配線の確認(画面・DB操作がこの仕組みを通っているか。実DBはe2eで見る) ---
  {
    const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const recipesSrc = readFileSync(path.join(appRoot, 'src/db/recipes.ts'), 'utf-8')
    // 削除の3経路すべてで、消す前に記録を移し替えていること
    eq(
      'GZ-配線 1品削除は消す前に記録を残す',
      /deleteRecipe\(id: number\)[\s\S]{0,600}detachRecipeLogs\(\[recipe\]\)[\s\S]{0,600}db\.recipes\.delete\(id\)/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'GZ-配線 まとめて削除も消す前に記録を残す',
      /deleteRecipes\(ids[\s\S]{0,900}detachRecipeLogs\(targets\)[\s\S]{0,900}bulkDelete\(targetIds\)/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'GZ-配線 セット丸ごと削除も消す前に記録を残す',
      /deleteRecipesBySourceSet[\s\S]{0,900}detachRecipeLogs\(targets\)[\s\S]{0,900}bulkDelete\(ids\)/.test(
        recipesSrc,
      ),
      true,
    )
    // 移し替えと削除が同じトランザクションでないと、片方だけ成功して記録が消える
    eq(
      'GZ-配線 1品削除は記録の移し替えと同じトランザクション',
      /deleteRecipe\(id: number\)[\s\S]{0,200}db\.transaction\('rw'[^)]*db\.detachedLogs/.test(recipesSrc),
      true,
    )
    const backupSrc = readFileSync(path.join(appRoot, 'src/logic/backup.ts'), 'utf-8')
    eq('GZ-配線 バックアップに残った記録を含める', /detachedLogs,\n\s*\}\n\s*return JSON\.stringify\(file\)/.test(backupSrc), true)
    eq('GZ-配線 取り込みのあとに結び直す', (backupSrc.match(/await reattachDetachedLogs\(\)/g) ?? []).length >= 3, true)
    const appSrc = readFileSync(path.join(appRoot, 'src/App.tsx'), 'utf-8')
    eq(
      'GZ-配線 起動時に印を振ってから結び直す',
      /backfillRecipeUids\(\)[\s\S]{0,120}reattachDetachedLogs\(\)/.test(appSrc),
      true,
    )
    // 集計へ混ぜない歯止め(材料が無い記録を栄養・食費に0として数えない)
    // 状態と手続きは 2026-08-27 便LQ（docs/74 第4手）で
    // src/pages/mealPlan/useMealPlanState.ts へ移した（中身は1文字も動かしていない）。
    // ここは**画面一式**を1つの本文として読む＝分ける前と同じものを見ている
    const mealPlanSrc = ['src/pages/MealPlanPage.tsx', 'src/pages/mealPlan/useMealPlanState.ts']
      .map((rel) => readFileSync(path.join(appRoot, rel), 'utf-8'))
      .join('\n')
    eq(
      'GZ-配線 削除済みレシピの記録は栄養・食費の入力(cookedLogsByDate)に混ぜない',
      /const cookedLogsByDate = useMemo\(\(\) => \{[\s\S]{0,500}\}, \[recipes\]\)/.test(mealPlanSrc),
      true,
    )
  }
}

// ---------- 便HC: 便GZの積み残し2件(2026-08-16) ----------
// ①古い記録の書き出し(アーカイブ)が「レシピを削除しても残った記録」を対象にしていなかった。
//   この機能の目的は端末容量の軽量化(2026-08-02 オーナー要望)で、**残った記録こそレシピが無いぶん
//   容量だけが残っている**状態なので、対象外なのは目的に反する。
// ②「今のデータに追加」のレシピ照合が料理名／IDだけだったため、同名の別レシピがある端末へ
//   書き出したファイルから同じレシピを入れ直すと、既存の同名レシピに合流して印が入らず、
//   記録が結び直せなかった。
{
  const log = (date, note, photo) => ({
    date,
    ...(note ? { note } : {}),
    ...(photo ? { photo: { size: photo } } : {}),
  })

  // --- ①書き出しの対象 ---
  {
    const cutoff = '2026-07-02'
    const recipes = [
      { id: 1, title: '肉じゃが', cookedLogs: [log('2026-07-01'), log('2026-08-01')] },
    ]
    const detached = [
      // レシピを削除しても残った記録(印あり)。写真つきの古い記録が容量を占め続けている
      {
        id: 3,
        recipeUid: 'u-1',
        title: 'カレー',
        logs: [log('2026-05-05', undefined, 10), log('2026-08-05')],
        detachedAt: 1,
      },
      // 印を持たない古い記録のまとまりも、容量は同じように残っているので対象に入れる
      { id: 4, title: '印なし', logs: [log('2026-04-04')], detachedAt: 1 },
    ]
    const targets = collectArchiveTargets(recipes, cutoff, detached)
    eq('HC①-対象 残った記録も書き出しの対象に入る', targets.length, 3)
    eq(
      'HC①-対象 境目以降の記録は残った記録でも書き出さない',
      targets.every((t) => t.log.date < cutoff),
      true,
    )
    const counts = countArchiveTargets(targets)
    eq('HC①-対象 件数に残った記録も足す', counts.logs, 3)
    eq('HC①-対象 写真の枚数に残った記録の写真も足す', counts.photos, 1)
    eq('HC①-対象 品数はレシピ1品＋残った記録2まとまり', counts.recipes, 3)
    eq('HC①-対象 そのうち残った記録の件数を別に数える', counts.detachedLogs, 2)
    eq(
      'HC①-対象 レシピの記録と残った記録でIDがぶつからない',
      new Set(targets.map((t) => t.id)).size,
      targets.length,
    )
    eq(
      'HC①-対象 どこにある記録かが分かる(消すときにレシピ側と残った記録側を取り違えない)',
      targets.map((t) => t.source).sort(),
      ['detached', 'detached', 'recipe'],
    )
    eq(
      'HC①-対象 残った記録を渡さなくても従来どおり数えられる(古い呼び出しを壊さない)',
      collectArchiveTargets(recipes, cutoff).length,
      1,
    )

    // 消すときのIDは書き出しのときと同じ手順で作る(違うと消す対象を取り違える)
    eq(
      'HC①-対象 消すとき用のIDは書き出し時と同じ',
      archiveIdsForDetached(detached[0]),
      ['u:u-1\n2026-05-05\n', 'u:u-1\n2026-08-05\n'],
    )
    // まとまりの番号は「データを上書き」で振り直されるので、印があるうちは印を鍵にする
    eq(
      'HC①-ID まとまりの番号が変わっても印が同じならIDは変わらない',
      archiveIdsForDetached({ id: 99, recipeUid: 'u-1', logs: [log('2026-05-05')] })[0],
      archiveIdsForDetached({ id: 3, recipeUid: 'u-1', logs: [log('2026-05-05')] })[0],
    )
    eq(
      'HC①-ID 印の無いまとまりはまとまりの番号を鍵にする',
      archiveIdsForDetached({ id: 4, logs: [log('2026-04-04')] })[0],
      'd4\n2026-04-04\n',
    )
    // レシピ側のIDはレシピ番号(数字)・手編集の行は'?'＋料理名。どれともぶつからない形にする
    eq(
      'HC①-ID レシピ側のIDとぶつからない',
      new Set([
        ...archiveIdsForRecipe({ id: 4, title: 'カレー', cookedLogs: [log('2026-04-04')] }),
        ...archiveIdsForDetached({ id: 4, logs: [log('2026-04-04')] }),
        ...archiveIdsForDetached({ id: 4, recipeUid: 'u-1', logs: [log('2026-04-04')] }),
      ]).size,
      3,
    )
  }

  // --- ①書き出したファイルの形（古いアーカイブファイルが読めなくならないこと） ---
  {
    // 便GZ以前に書き出したファイル: レシピ番号を鍵にしたIDだけが入っている
    const oldFileJson = JSON.stringify({
      app: 'uchi-recipe',
      kind: ARCHIVE_KIND,
      version: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      logs: [
        { id: '1\n2026-05-01\n', date: '2026-05-01', recipeTitle: '肉じゃが' },
        {
          id: '2\n2026-04-01\n',
          date: '2026-04-01',
          recipeTitle: 'カレー',
          photoBase64: 'AAA',
          photoType: 'image/jpeg',
        },
      ],
    })
    const oldParsed = parseArchiveFile(oldFileJson)
    eq('HC①-旧ファイル 便GZ以前のアーカイブファイルがそのまま読める', oldParsed.logs.length, 2)
    eq('HC①-旧ファイル 読めなかった記録は0件', oldParsed.brokenCount, 0)
    eq(
      'HC①-旧ファイル 写真も読める',
      oldParsed.logs.find((l) => l.recipeTitle === 'カレー').photoBase64,
      'AAA',
    )
    // 残った記録を足して書き出しても、ファイルの形（版・種別マーク・項目）は変えない
    const appended = mergeArchiveLogs(oldParsed.logs, [
      { id: 'u:u-1\n2026-03-01\n', date: '2026-03-01', recipeTitle: '削除したレシピ' },
    ])
    const newFile = buildArchiveFile(appended, '2026-08-16T00:00:00.000Z')
    eq('HC①-旧ファイル 版を上げない(古いアプリでも読める形のまま)', newFile.version, 1)
    eq('HC①-旧ファイル 種別マークは同じ', newFile.kind, ARCHIVE_KIND)
    eq(
      'HC①-旧ファイル ファイルの項目は増やさない',
      Object.keys(newFile).sort(),
      ['app', 'exportedAt', 'kind', 'logs', 'version'],
    )
    eq('HC①-旧ファイル 前のファイルの記録は残る', appended.length, 3)
    eq(
      'HC①-旧ファイル 書き足したファイルも読める',
      parseArchiveFile(JSON.stringify(newFile)).logs.length,
      3,
    )
    eq(
      'HC①-旧ファイル 同じファイルを2回まとめても増えない',
      mergeArchiveLogs(appended, appended).length,
      3,
    )
  }

  // --- ①「書き出した記録を端末から消す」の確認文（規約F・実態に合わせる） ---
  {
    const bullet = (content, label) =>
      (content.bullets ?? []).find((b) => b.label === label)?.text ?? ''
    const goneLabel = '消えるもの'
    const keptLabel = '残るもの'

    // レシピの中の記録と、残った記録の両方を消す場面
    const both = buildArchiveDeleteConfirm({
      logs: 5,
      photos: 2,
      detachedLogs: 2,
      cutoff: '2026-07-16',
    })
    eq('HC①-確認文 消える件数と写真の枚数を書く', bullet(both, goneLabel), '作った記録5件・写真2枚')
    eq(
      'HC①-確認文 レシピの記録も消すときは「レシピ本体は残る」と書く',
      bullet(both, keptLabel).includes('レシピ本体'),
      true,
    )
    eq(
      'HC①-確認文 残るものに境目の日付を入れる',
      bullet(both, keptLabel).includes('2026年7月16日以降の記録'),
      true,
    )
    eq(
      'HC①-確認文 残った記録が含まれるときは内訳を出す',
      (both.notes ?? []).some((n) => n.includes('2件') && n.includes('レシピを削除したあと')),
      true,
    )

    // レシピの無い記録だけを消す場面（「レシピ本体は残ります」が誤解を生む場面）
    const detachedOnly = buildArchiveDeleteConfirm({
      logs: 3,
      photos: 1,
      detachedLogs: 3,
      cutoff: '2026-07-16',
    })
    eq(
      'HC①-確認文 レシピの無い記録だけを消すときは「レシピ本体」と書かない',
      bullet(detachedOnly, keptLabel).includes('レシピ本体'),
      false,
    )
    eq(
      'HC①-確認文 それでも残るものは件数・日付つきで書く(規約F)',
      bullet(detachedOnly, keptLabel),
      '2026年7月16日以降の記録・書き出したファイル',
    )
    eq(
      'HC①-確認文 消えるものは件数つきで書く(規約F)',
      bullet(detachedOnly, goneLabel),
      '作った記録3件・写真1枚',
    )

    // 残った記録が1件も無いときは内訳を出さない（無い話をしない）
    const recipeOnly = buildArchiveDeleteConfirm({
      logs: 2,
      photos: 0,
      detachedLogs: 0,
      cutoff: '2026-07-16',
    })
    // 2026-08-20 便IJ・①: 補足そのものが1件も無いこと（notes.length===0）で測っていたが、
    // それは「補足を1つも足せない」という別の約束になってしまう（実際、読みかたの制限の1行を
    // 足した便IJで落ちた）。測りたいのは**残った記録の内訳を出していないこと**なので、
    // その1行の形（ja の型に数字を入れたもの）を作って、それが混じっていないかで見る
    const detachedNoteRe = new RegExp(
      `^${ja.settings.archiveDeleteConfirmDetachedNote
        .split('{d}')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\d+')}$`,
    )
    eq(
      'HC①-確認文 残った記録が無ければ内訳は出さない',
      (recipeOnly.notes ?? []).filter((n) => detachedNoteRe.test(n)),
      [],
    )
    // 見張りが当たっていること（型が合わなくなったら、上の判定は何も測らずに合格してしまう）
    eq(
      'HC①-確認文 内訳の見張りが当たっている（残った記録があるときは拾える）',
      (both.notes ?? []).some((n) => detachedNoteRe.test(n)),
      true,
    )
    eq(
      'HC①-確認文 レシピの記録だけなら従来どおり「レシピ本体」を書く',
      bullet(recipeOnly, keptLabel).includes('レシピ本体'),
      true,
    )
    const allText = [both, detachedOnly, recipeOnly].map(confirmContentText).join('\n')
    eq('HC①-確認文 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(allText), false)
    eq('HC①-確認文 「よろしいですか？」だけで終わらせない', allText.includes('よろしいですか'), false)
    eq('HC①-確認文 実行ボタンは何が起きるか分かる言葉', both.confirmLabel, '端末から消す')
  }

  // --- ②「今のデータに追加」でのレシピ照合(司令部の裁定4項目) ---
  {
    // 端末側: 1=肉じゃが(印u-mine) / 2=わたしの唐揚げ(印u-karaage)
    const titleById = new Map([
      [1, '肉じゃが'],
      [2, 'わたしの唐揚げ'],
    ])
    const idByTitle = new Map([
      ['肉じゃが', 1],
      ['わたしの唐揚げ', 2],
    ])
    const uidById = new Map([
      [1, 'u-mine'],
      [2, 'u-karaage'],
    ])
    const idByUid = new Map([
      ['u-mine', 1],
      ['u-karaage', 2],
    ])

    // 規則1: 印が一致すれば、番号も料理名も違っても同じレシピとみなす(最優先)
    eq(
      'HC②-照合 印が一致すれば料理名が違っても同じレシピ',
      resolveMergeRecipeAction(
        { id: 9, title: '肉じゃが（名前を変えた）', uid: 'u-mine' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )

    // 規則3: 両方が印を持ち、印が違うときは「合流はする・印は引き継がない」
    // (レシピを重複させない＝「追加」の見え方を変えない。記録は結ばず端末に残す)
    eq(
      'HC②-照合 同名で印が違っても合流はする(レシピを重複させない)',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 印が違うときはファイル側の印を引き継がない(記録を結ばない)',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ).adoptUid,
      undefined,
    )
    eq(
      'HC②-照合 版ズレで番号がずれていても、印が違えば印は引き継がない',
      resolveMergeRecipeAction(
        { id: 2, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 番号が空いていれば従来どおり同じ番号のまま追加する',
      resolveMergeRecipeAction(
        { id: 5, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'add' },
    )
    // 規則4: この関数は「消す」指示を返さない(追加は今のデータを1件も消さない)
    eq(
      'HC②-照合 返すのは合流・追加だけ(消す指示は返さない)',
      [
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        { id: 5, title: '肉じゃが', uid: 'u-file' },
        { id: 2, title: 'まったく新しい料理', uid: 'u-new' },
        { id: undefined, title: '番号なし', uid: 'u-x' },
      ]
        .map(
          (r) =>
            resolveMergeRecipeAction(r, titleById, idByTitle, uidById, idByUid).kind,
        )
        .every((kind) => ['enrich', 'add', 'addWithNewId'].includes(kind)),
      true,
    )

    // 規則2: 料理名で当たった既存レシピが印を持っていなければ、従来どおり同一とみなし印を引き継ぐ
    eq(
      'HC②-照合 今のレシピに印が無ければファイル側の印を引き継ぐ',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        new Map(),
        new Map(),
      ),
      { kind: 'enrich', targetId: 1, adoptUid: 'u-file' },
    )
    eq(
      'HC②-照合 版ズレで番号がずれていても、印を持たない同名レシピには印を引き継ぐ',
      resolveMergeRecipeAction(
        { id: 2, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        new Map([[2, 'u-karaage']]),
        new Map([['u-karaage', 2]]),
      ),
      { kind: 'enrich', targetId: 1, adoptUid: 'u-file' },
    )

    // 印を持たない古いバックアップは従来どおり(照合の仕方を変えない=古いファイルが読めなくならない)
    eq(
      'HC②-照合 印の無い古いファイルは従来どおり同名で合流する',
      resolveMergeRecipeAction({ id: 1, title: '肉じゃが' }, titleById, idByTitle, uidById, idByUid),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 印の無い古いファイルは版ズレの振り直しも従来どおり',
      resolveMergeRecipeAction(
        { id: 2, title: 'まったく新しい料理' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'addWithNewId' },
    )
    // 印の照合表を渡さない呼び出しでも、合流先の選び方は従来どおり(印が分からない＝印を
    // 持っていない端末として扱うので、規則2どおり印は引き継ぐ側になる)
    {
      const { kind, targetId } = resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
      )
      eq('HC②-照合 印の照合表を渡さなくても合流先は従来どおり', { kind, targetId }, {
        kind: 'enrich',
        targetId: 1,
      })
    }

    // 規則3の裏付け: 印が食い違う相手へ合流しても、記録はその相手に結ばれない
    // (＝オーナーの懸念「似た名前の違うレシピとつながる」を防ぐ)。記録は残ったままになる
    const record = {
      id: 7,
      recipeUid: 'u-file',
      title: '肉じゃが',
      logs: [log('2026-08-01')],
      detachedAt: 1,
    }
    const notLinked = planDetachedReattach([record], [{ id: 1, uid: 'u-mine', cookedLogs: [] }])
    eq('HC②-結び直し 印が違う同名レシピには記録を結ばない', notLinked.items.length, 0)
    eq('HC②-結び直し 結ばなかった記録は消えない', notLinked.logsReattached, 0)
    // 規則2で印を引き継いだ場合は、そのレシピに記録が戻る
    const linked = planDetachedReattach([record], [{ id: 1, uid: 'u-file', cookedLogs: [] }])
    eq('HC②-結び直し 印を引き継いだレシピには記録が戻る', linked.items.length, 1)
    eq('HC②-結び直し 戻し先は印が一致したレシピ', linked.items[0].recipeId, 1)
  }

  // --- 配線の確認(画面・DB操作がこの仕組みを通っているか。実DBはe2eで見る) ---
  {
    const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const recipesSrc = readFileSync(path.join(appRoot, 'src/db/recipes.ts'), 'utf-8')
    // 書き出した記録を消す先も2か所(レシピの中と、残った記録)。同じトランザクションで消す
    eq(
      'HC①-配線 書き出した記録の削除は残った記録も対象にする',
      /deleteArchivedCookedLogs[\s\S]{0,1400}archiveIdsForDetached\(record\)/.test(recipesSrc),
      true,
    )
    eq(
      'HC①-配線 削除は2か所を同じトランザクションで行う',
      /deleteArchivedCookedLogs[\s\S]{0,900}db\.transaction\('rw', db\.recipes, db\.detachedLogs/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'HC①-配線 記録が0件になったまとまりは行ごと消す(空の行を残さない)',
      /archiveIdsForDetached\(record\)[\s\S]{0,400}db\.detachedLogs\.delete\(record\.id\)/.test(
        recipesSrc,
      ),
      true,
    )
    const settingsSrc = readFileSync(path.join(appRoot, 'src/pages/SettingsPage.tsx'), 'utf-8')
    eq(
      'HC①-配線 書き出しの対象に残った記録を渡している',
      /collectArchiveTargets\(\s*recipes \?\? \[\],\s*archiveCutoff,\s*detachedRecords \?\? \[\],\s*\)/.test(
        settingsSrc,
      ),
      true,
    )
    eq(
      'HC①-配線 削除の確認文は1か所(logic/cookedArchive.ts)で組み立てる',
      settingsSrc.includes('confirm(buildArchiveDeleteConfirm(archiveExported))'),
      true,
    )
    const backupSrc = readFileSync(path.join(appRoot, 'src/logic/backup.ts'), 'utf-8')
    eq(
      'HC②-配線 「今のデータに追加」の照合に印の表を渡している',
      /resolveMergeRecipeAction\(\s*recipe,\s*existingTitleById,\s*existingIdByTitle,\s*existingUidById,\s*existingIdByUid,\s*\)/.test(
        backupSrc,
      ),
      true,
    )
    eq(
      'HC②-配線 引き継ぐ印を今のレシピへ書き戻している',
      /action\.adoptUid \? \{ \.\.\.merged\.recipe, uid: action\.adoptUid \}[\s\S]{0,300}db\.recipes\.put\(adopted\)/.test(
        backupSrc,
      ),
      true,
    )
    eq(
      'HC②-配線 追加したレシピの印も照合表に載せる(同じファイルの中で二重に入らない)',
      (backupSrc.match(/indexExisting\(/g) ?? []).length >= 4,
      true,
    )
  }
}

// ---------- JA-0〜JA-6: 同じ料理名のレシピを、番号を付けて入れる（2026-08-22 便JA） ----------
// オーナー原文「◯件入らなかったお知らせ→それでも入れるか聞く→はいで（２）、（３）...、とつけて入れる。
// いいえで重複して入れない。」／「懸念、『肉じゃが（２）』を重複で入れると、『肉じゃが（３）』ではなく
// 『肉じゃが（２）（２）』になりそう。」
// ここで測るのは「利用者が確かめたいこと」＝①同じ番号を2つ作らないこと ②もともと括弧のある
// 料理名を壊さないこと ③中身が同じだけの品を「入らなかった」と言わないこと。
{
  const jaTools = ['stripTitleNumber', 'nextDuplicateTitle', 'isSameRecipeBody', 'buildNumberedRecipeCopy', 'buildDuplicateTitleConfirm']
  eq(
    'JA-0 番号を付けて入れる道具がそろっている',
    jaTools.filter((name) => typeof backupLogic[name] !== 'function'),
    [],
  )
  // 道具が無いときは全ケースを「(未実装)」で落とす（import ごと落ちて他の節まで消えないように）
  const strip = (t) => backupLogic.stripTitleNumber?.(t) ?? '(未実装)'
  const next = (t, titles) => backupLogic.nextDuplicateTitle?.(t, titles) ?? '(未実装)'
  const sameBody = (a, b) => backupLogic.isSameRecipeBody?.(a, b) ?? '(未実装)'

  // --- JA-1: 料理名の末尾に付けた番号だけを外す ---
  eq('JA-1 半角の番号を外す', strip('肉じゃが (2)'), '肉じゃが')
  eq('JA-1 全角の括弧で書かれた番号も外す', strip('肉じゃが（2）'), '肉じゃが')
  eq('JA-1 全角の数字で書かれた番号も外す', strip('肉じゃが（２）'), '肉じゃが')
  eq('JA-1 スペースなしの番号も外す', strip('肉じゃが(2)'), '肉じゃが')
  eq('JA-1 番号が付いていない料理名はそのまま', strip('肉じゃが'), '肉じゃが')
  // 実在する品名（src/db/starters.ts）。末尾が数字だけの括弧ではないので番号とは見なさない
  for (const title of [
    'レンジ蒸し鶏（自家製サラダチキン）',
    '卯の花(おからの炒り煮)',
    '回鍋肉(ホイコーロー)',
    'きんぴら（金平）ごぼう',
  ]) {
    eq(`JA-1 説明の括弧が付いた「${title}」を壊さない`, strip(title), title)
  }
  eq('JA-1 括弧の中に数字以外が混ざっていたら番号ではない', strip('カレー (2人分)'), 'カレー (2人分)')
  eq('JA-1 料理名が番号だけになるときは外さない', strip('(2)'), '(2)')

  // --- JA-2: 次の番号の決め方（オーナーの懸念の本体） ---
  eq('JA-2 同じ料理名が1品あるなら (2)', next('肉じゃが', ['肉じゃが']), '肉じゃが (2)')
  eq('JA-2 (2)まであるなら (3)', next('肉じゃが', ['肉じゃが', '肉じゃが (2)']), '肉じゃが (3)')
  eq(
    'JA-2 入れる品が「肉じゃが (2)」でも「肉じゃが (2) (2)」にはしない（オーナーの懸念）',
    next('肉じゃが (2)', ['肉じゃが', '肉じゃが (2)']),
    '肉じゃが (3)',
  )
  eq(
    'JA-2 端末側が全角の番号で入っていても数として読む',
    next('肉じゃが', ['肉じゃが', '肉じゃが（２）']),
    '肉じゃが (3)',
  )
  eq('JA-2 番号が飛んでいたら、いちばん大きい番号の次', next('肉じゃが', ['肉じゃが', '肉じゃが (5)']), '肉じゃが (6)')
  eq('JA-2 別の料理名は数に入れない', next('肉じゃが', ['肉じゃが', '肉じゃがコロッケ (3)']), '肉じゃが (2)')
  eq(
    'JA-2 説明の括弧が付いた料理名にも番号を足せる',
    next('レンジ蒸し鶏（自家製サラダチキン）', ['レンジ蒸し鶏（自家製サラダチキン）']),
    'レンジ蒸し鶏（自家製サラダチキン） (2)',
  )
  {
    // 1回の読み込みで同じ料理名が3品あるとき、(2)(3)(4) と続くこと（同じ番号を2つ作らない）
    const titles = new Set(['肉じゃが'])
    const made = []
    for (let i = 0; i < 3; i++) {
      const title = next('肉じゃが', titles)
      made.push(title)
      titles.add(title)
    }
    eq('JA-2 1回の読み込みで同じ料理名が続いても番号が増える', made, ['肉じゃが (2)', '肉じゃが (3)', '肉じゃが (4)'])
    eq('JA-2 同じ番号を2つ作らない', new Set(made).size, made.length)
  }

  // --- JA-3: 「入らなかった」と言う相手を、中身が違う品だけに絞る ---
  const jaRecipe = (over = {}) => ({
    title: '肉じゃが',
    servings: 2,
    effortLevel: 'normal',
    tags: ['和食'],
    ingredients: [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    steps: [{ text: '煮る' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  })
  eq('JA-3 中身が同じなら「入らなかった」と言わない', sameBody(jaRecipe(), jaRecipe()), true)
  eq(
    'JA-3 番号・印・作った記録・お気に入り・写真・日時の違いは中身の違いにしない',
    sameBody(
      jaRecipe(),
      jaRecipe({ id: 9, uid: 'u-file', isFavorite: true, cookedLogs: [{ date: '2026-01-01' }], createdAt: 99, updatedAt: 99 }),
    ),
    true,
  )
  eq(
    'JA-3 材料が違えば中身が違う',
    sameBody(jaRecipe(), jaRecipe({ ingredients: [{ name: '牛肉', amount: '200', unit: 'g' }] })),
    false,
  )
  eq('JA-3 手順が違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ steps: [{ text: '焼く' }] })), false)
  eq('JA-3 メモが違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ memo: '冷蔵で2日' })), false)
  eq('JA-3 分量の人数が違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ servings: 4 })), false)

  // --- JA-4: 番号を付けて入れる品の中身 ---
  {
    const copy =
      backupLogic.buildNumberedRecipeCopy?.(
        jaRecipe({
          id: 7,
          uid: 'u-file',
          isStarter: true,
          sourceSetId: 'kintore',
          sourceSetName: '高たんぱくごはん',
          cookedLogs: [{ date: '2026-01-01' }],
        }),
        new Set(['肉じゃが']),
        new Set(),
        () => 'u-new',
      ) ?? {}
    eq('JA-4 番号を付けた料理名で入る', copy.title, '肉じゃが (2)')
    eq('JA-4 ファイル側の番号は引き継がない（端末の番号は端末が振る）', Object.hasOwn(copy, 'id'), false)
    eq(
      'JA-4 基本レシピ・配布セットの目印は外す（「基本レシピを入れ直す」で黙って消えるのを防ぐ）',
      [copy.isStarter, copy.sourceSetId, copy.sourceSetName],
      [undefined, undefined, undefined],
    )
    eq('JA-4 端末で使われていない印はそのまま引き継ぐ', copy.uid, 'u-file')
    eq('JA-4 作った記録は足さない（同じ料理名の品へ足したものと二重にしない）', copy.cookedLogs, [])
    eq('JA-4 番号を付けた料理名で検索できる', (copy.searchWords ?? []).includes('にくじゃが (2)'), true)
    eq('JA-4 材料・手順はファイルの内容が入る', copy.ingredients, jaRecipe().ingredients)
    const copyUsed =
      backupLogic.buildNumberedRecipeCopy?.(
        jaRecipe({ uid: 'u-file' }),
        new Set(['肉じゃが']),
        new Set(['u-file']),
        () => 'u-new',
      ) ?? {}
    eq(
      'JA-4 端末で使われている印は付け直す（同じ印が2品に付くと記録の結び直しが壊れる）',
      copyUsed.uid,
      'u-new',
    )
  }

  // --- JA-5: 聞き方（1回だけ・件数を言う・何が変わらないかを言う） ---
  {
    const ask = backupLogic.buildDuplicateTitleConfirm?.(3) ?? {}
    const askText = typeof ask.title === 'string' ? confirmContentText(ask) : ''
    eq('JA-5 見出しに件数が入る', /3品/.test(ask.title ?? ''), true)
    eq('JA-5 今のレシピが変わらないことを言っている', /変わらない|そのまま/.test(askText), true)
    // 窓の文（confirmContentText）にはボタンの言葉が入らないので、ボタンは別に測る
    eq('JA-5 押すと何が起きるかがボタンの言葉で分かる', (ask.confirmLabel ?? '').includes('番号'), true)
    eq('JA-5 番号の付け方が具体例で分かる', /\(2\)/.test(askText) && /\(3\)/.test(askText), true)
  }

  // --- JA-6: 読み込みの流れに繋がっているか（画面を立ち上げずに形だけ測る） ---
  {
    const jaRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const backupSrc = readFileSync(path.join(jaRoot, 'src/logic/backup.ts'), 'utf-8')
    const settingsSrc = readFileSync(path.join(jaRoot, 'src/pages/SettingsPage.tsx'), 'utf-8')
    eq(
      'JA-6 「追加」の結果に、入らなかった品を返している',
      /duplicateTitleRecipes/.test(backupSrc),
      true,
    )
    eq(
      'JA-6 設定画面が、入らなかった品を受けて聞いてから入れている',
      /buildDuplicateTitleConfirm[\s\S]{0,400}importDuplicateTitleRecipes/.test(settingsSrc),
      true,
    )
  }
}


// ==========================================================================================
// JF-1〜JF-5: オーナーの書き溜め7件（2026-08-22 便JF）
// 献立の週タブ（過ぎた日の編集モード・チェックマーク・過ぎた日の面の色・表示のしかたのプルダウン）、
// 記録の栄養の文言、日タブの「◯食に入れる」の取り消し、Pro案内からの帰り道。
// ==========================================================================================
{
  const jfRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const jfRead = (rel) => readFileSync(path.join(jfRoot, rel), 'utf-8')
  // 献立の画面は2026-08-25 便KZ（docs/74 第3手）で、画面の本体と src/pages/mealPlan/ の部品に
  // 分かれた（中身は1文字も動かしていない）。記録のカード（CookedLogCard）は DayParts.tsx に
  // あるので、ここは**画面一式**を1つの本文として読む＝分ける前と同じものを見ている
  const jfMealPlanSrc = [
    'src/pages/MealPlanPage.tsx',
    'src/pages/mealPlan/DayParts.tsx',
    'src/pages/mealPlan/IntakeParts.tsx',
    'src/pages/mealPlan/MonthParts.tsx',
    // 状態と手続きは 2026-08-27 便LQ（docs/74 第4手）でここへ移した
    'src/pages/mealPlan/useMealPlanState.ts',
  ]
    .map(jfRead)
    .join('\n')
  const mealPlanLogicJF2 = await import('../../src/logic/mealPlan.ts')

  // --- JF-1: 過ぎた日の編集モードは「作った記録を足す」（①） ---
  {
    const mealPlanLogicJF = await import('../../src/logic/mealPlan.ts')
    const planDayEditKind = mealPlanLogicJF.planDayEditKind
    eq('JF-1 前提: planDayEditKind がある（無ければ以下は測れていない）', typeof planDayEditKind, 'function')
    if (typeof planDayEditKind === 'function') {
      // 日付は「今日」を引数で渡す＝曜日・月替わりの前提を置かない（禁じ手①）
      eq('JF-1 過ぎた日の編集は「作った記録」を足す編集', planDayEditKind('2026-08-21', '2026-08-22'), 'record')
      eq('JF-1 今日の編集は献立の編集', planDayEditKind('2026-08-22', '2026-08-22'), 'plan')
      eq('JF-1 先の日の編集は献立の編集', planDayEditKind('2026-08-23', '2026-08-22'), 'plan')
      // 月替わり・年またぎでも同じ（文字列比較なので桁が繰り上がっても崩れない）
      eq('JF-1 月をまたいだ過ぎた日も記録の編集', planDayEditKind('2026-07-31', '2026-08-01'), 'record')
      eq('JF-1 年をまたいだ過ぎた日も記録の編集', planDayEditKind('2025-12-31', '2026-01-01'), 'record')
    }
    // 記録を足す入口は**編集モードの中だけ**に置く（司令部の訂正: 通常表示は今までどおり）。
    // 画面のどこに置いたかではなく「編集モードの分岐の中にあるか」で見る
    const jfAddIdx = jfMealPlanSrc.indexOf('data-testid="past-record-add"')
    eq('JF-1 過ぎた日に「作った記録を追加」の入口がある', jfAddIdx >= 0, true)
    if (jfAddIdx >= 0) {
      // その入口を出している式が dayEditing（編集モード）に掛かっていること。
      // 直前2000字の中に dayEditing が出ていなければ、通常表示に置かれている疑いがある
      const jfBefore = jfMealPlanSrc.slice(Math.max(0, jfAddIdx - 2000), jfAddIdx)
      eq('JF-1 その入口は編集モードの中にある（通常表示には出さない）', /dayEditing/.test(jfBefore), true)
    }
  }

  // --- JF-2: 記録の栄養の文言3つ（④） ---
  {
    eq(
      'JF-2 過ぎた日の数え方の1行は「作った記録から計算しています」',
      ja.nutritionBalance.basisNoteActual,
      '作った記録から計算しています',
    )
    eq(
      'JF-2 「3食のうち夕食だけを〜」の説明は無くす（説明し過ぎ）',
      Object.hasOwn(ja.nutritionBalance, 'registeredOnlyMealNote'),
      false,
    )
    const jfPanelSrc = jfRead('src/components/NutritionBalancePanel.tsx')
    eq(
      'JF-2 栄養パネルからも「3食のうち〜」を出していない',
      /registeredOnlyMealNote/.test(jfPanelSrc),
      false,
    )
    // 「計算に含めていない材料」は画面に出ている名前。地の文と混ざって主語が消えていたので
    // 鉤括弧で囲って主語にする（司令部裁定・直しの芯）
    eq(
      'JF-2 除外の但し書きは「計算に含めていない材料」を鉤括弧で主語にする',
      ja.nutrition.excludedDirectionNote.startsWith('「計算に含めていない材料」は'),
      true,
    )
    eq(
      'JF-2 献立の栄養では、どこで中身を見られるかを添える',
      typeof ja.nutrition.excludedDirectionNoteTotal === 'string' &&
        ja.nutrition.excludedDirectionNoteTotal.startsWith('「計算に含めていない材料（') &&
        ja.nutrition.excludedDirectionNoteTotal.includes('）」は'),
      true,
    )
    eq(
      'JF-2 献立の栄養パネルは、添え書き付きのほうを使う',
      /excludedDirectionNoteTotal/.test(jfPanelSrc),
      true,
    )
    // 2026-08-22 司令部の裁定（便JFの申し送り1・A案）: 月の期間カードだけ「過ぎた日なので、」が
    // 残っていた。オーナーが余計だと言ったのは**頭の「過ぎた日なので、」**の部分で、「だけ」には
    // 月では意味がある（過去と先の日が混ざりうる期間なので、記録だけで数えていることを言う必要が
    // ある）。頭だけ落として、週の言い回しとそろえる
    eq(
      'JF-2 月の期間カードも「過ぎた日なので、」を頭に付けない',
      ja.mealPlan.rangeBasisActualOnly.startsWith('過ぎた日なので'),
      false,
    )
    eq(
      'JF-2 ただし「だけ」は残す（記録だけで数えていることは言う）',
      ja.mealPlan.rangeBasisActualOnly.includes('だけ'),
      true,
    )
    // レシピ詳細の栄養は、一覧のすぐ下に出るので添え書きの要らない側を使ったまま
    const jfTeaserSrc = jfRead('src/components/NutritionTeaser.tsx')
    eq(
      'JF-2 レシピ詳細は添え書きの無いほうを使う（一覧のすぐ下なので行き先を書かない）',
      /excludedDirectionNote\b/.test(jfTeaserSrc) && !/excludedDirectionNoteTotal/.test(jfTeaserSrc),
      true,
    )
  }

  // --- JF-3: Pro案内からの帰り道（⑦） ---
  {
    // レシピの登録・編集の画面から飛んだときも、その画面の名前で帰り道を出す。
    // /recipes/ の先頭一致に巻き込まれて「レシピに戻る」になっていないこと
    const jfNew = resolveBackTarget('/recipes/new')
    const jfEdit = resolveBackTarget('/recipes/12/edit')
    eq('JF-3 レシピの登録画面へ帰れる', jfNew?.label, 'レシピの登録に戻る')
    eq('JF-3 レシピの登録画面の戻り先は入力していた画面そのもの', jfNew?.to, '/recipes/new')
    eq('JF-3 レシピの編集画面へ帰れる', jfEdit?.label, 'レシピの編集に戻る')
    eq('JF-3 レシピ詳細の帰り道は今までどおり', resolveBackTarget('/recipes/12')?.label, 'レシピに戻る')
    eq('JF-3 レシピ一覧の帰り道は今までどおり', resolveBackTarget('/recipes')?.label, 'レシピ一覧に戻る')
    // 案内の側: いま出ている画面のパスを載せる（決め打ちの文字列を書かない）
    const jfFormSrc = jfRead('src/pages/RecipeFormPage.tsx')
    // 2026-08-27 便LU: 帰り道の作り方を「現在地のパスだけ」から
    // 「現在地＋覚えた場所へ戻す印（useSettingsDetour）」へ変えた。見張る中身は同じ
    // ＝決め打ちの文字列ではなく、いま出ている画面から帰り道を作っていること
    eq(
      'JF-3 登録上限のPro案内が、いまの画面を戻り先に載せている',
      /detourLinkTo\('\/settings\?section=pro'\)/.test(jfFormSrc),
      true,
    )
    eq(
      'JF-3 登録上限のPro案内に、戻り先の無いリンクが残っていない',
      /to="\/settings\?section=pro"/.test(jfFormSrc),
      false,
    )
    const jfSettingsSrc = jfRead('src/pages/SettingsPage.tsx')
    eq(
      'JF-3 設定のサンプルデモが、決め打ちでなくいまの画面を戻り先に載せている',
      !/back=%2Fsettings%3Fsection%3Dpro/.test(jfSettingsSrc) &&
        /month-demo\?back=\$\{encodeURIComponent\(location\.pathname \+ location\.search\)\}/.test(
          jfSettingsSrc,
        ),
      true,
    )
    eq(
      'JF-3 献立のサンプルデモも決め打ちをやめている',
      !/to="\/month-demo\?back=\/meal-plan"/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-3 予算の設定案内にも帰り道を付けている',
      /settingsLinkWithBack\(\s*'\/settings\?section=budget'/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-3 予算の設定案内に、戻り先の無いリンクが残っていない',
      /to="\/settings\?section=budget"/.test(jfMealPlanSrc),
      false,
    )
  }

  // --- JF-4: 表示のしかたはプルダウン（⑤） ---
  {
    eq(
      'JF-4 プルダウンの名前がある',
      typeof ja.mealPlan.weekLayoutLabel === 'string' && ja.mealPlan.weekLayoutLabel.length > 0,
      true,
    )
    eq(
      'JF-4 週の表示のしかたがプルダウンになっている',
      /<select[\s\S]{0,400}data-testid="week-layout"[\s\S]{0,400}<option/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-4 選べる字は今までと同じ2つ',
      [ja.mealPlan.weekLayoutCalendar, ja.mealPlan.weekLayoutRolling],
      ['週区切り', '今日から7日間'],
    )
  }

  // --- JF-6: 過ぎた日の記録の削除（オーナー追加指示「削除ボタンも入れて」） ---
  {
    // ボタンと確認の文言がそろっているか
    const m = ja.mealPlan
    eq(
      'JF-6 削除ボタンの名前がある',
      typeof m.pastRecordDelete === 'string' && m.pastRecordDelete.length > 0,
      true,
    )
    for (const [name, key] of [
      ['見出し', 'pastRecordDeleteTitle'],
      ['消えるもの', 'pastRecordDeleteGone'],
      ['残るもの', 'pastRecordDeleteKept'],
      ['押すボタン', 'pastRecordDeleteOk'],
      ['消したときの知らせ', 'pastRecordDeletedToast'],
      ['戻したときの知らせ', 'pastRecordDeleteUndoneToast'],
    ]) {
      eq(`JF-6 確認と知らせの文言がある（${name}）`, typeof m[key], 'string')
    }
    // 規約F: 何が消えて何が残るかを両方書く。件数も入れる
    eq('JF-6 「消えるもの」に件数が入る', /\{n\}|1件/.test(m.pastRecordDeleteGone ?? ''), true)
    eq('JF-6 「残るもの」に件数が入る', (m.pastRecordDeleteKept ?? '').includes('{n}'), true)
    // トーストから1回で戻せるので「元に戻せません」と書かない（書くと画面と食い違う）
    const deleteTexts = [
      m.pastRecordDeleteTitle,
      m.pastRecordDeleteGone,
      m.pastRecordDeleteKept,
      m.pastRecordDeletedToast,
    ].join(' ')
    eq('JF-6 戻せるので「元に戻せません」とは書かない', /元に戻せません/.test(deleteTexts), false)
    // 削除は編集モードの中だけ（通常表示は今までどおり記録が並ぶだけ）
    const delIdx = jfMealPlanSrc.indexOf('data-testid="past-record-delete"')
    eq('JF-6 過ぎた日の記録に削除の入口がある', delIdx >= 0, true)
    // 削除のボタンは部品（CookedLogCard）の中にあるので、置き場所ではなく
    // **出す条件**で見る: ①渡されたときだけ描く ②渡している式が編集モードに掛かっている
    eq(
      'JF-6 削除は「渡されたときだけ」出す作りになっている',
      delIdx >= 0 && /\{onDelete && \(\s*$/m.test(jfMealPlanSrc.slice(Math.max(0, delIdx - 400), delIdx)),
      true,
    )
    // onDelete={...} に渡している式（三項の入れ子があるので、次の属性が始まるまでを丸ごと拾う）
    const onDeletePass = jfMealPlanSrc.match(/\n\s*onDelete=\{[\s\S]*?\n\s*\}\n/g) ?? []
    // 2026-08-23 便JN: 月タブの日の窓も週の曜日カードと同じ2モードになったので、
    // 渡している場所は**2か所**（週の曜日カード・月の日の窓）になった。
    // 見張りの狙いは変わらない＝「増えていないこと」と「どちらも編集モードのときだけ」
    eq(
      'JF-6 削除を渡している場所は2か所だけ（週の曜日カードと月の日の窓。別の画面からこっそり増えていない）',
      onDeletePass.length,
      2,
    )
    eq(
      'JF-6 どの場所も、渡さない道（undefined）を持っている＝条件付きで出している',
      onDeletePass.filter((pass) => /undefined/.test(pass)).length,
      onDeletePass.length,
    )
    eq(
      'JF-6 出す条件は「その日の編集モード」だけ（週＝dayEditing / 月＝dayModalWindow.recordDelete）',
      onDeletePass
        .map((pass) =>
          /dayEditing && dayEditKind === 'record'/.test(pass)
            ? '週の曜日カード'
            : /dayModalWindow\.recordDelete/.test(pass)
              ? '月の日の窓'
              : `見覚えのない条件: ${pass.trim().slice(0, 60)}`,
        )
        .sort(),
      ['月の日の窓', '週の曜日カード'],
    )
    eq(
      'JF-6 消す前に確かめている（確認の窓を通す）',
      /pastRecordDeleteTitle[\s\S]{0,1200}confirmLabel/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-6 削除も1回で戻せる（取り消しの控えがある）',
      /setUndoRecordDelete\(/.test(jfMealPlanSrc) && /undoRecordDeleteActive/.test(jfMealPlanSrc),
      true,
    )
    // 記録の小窓（「記録を見る」）からの削除は今までどおり残す
    const jfDetailSrc = jfRead('src/components/CookedLogDetailModal.tsx')
    eq(
      'JF-6 記録の小窓からの削除は残っている',
      /deletedRecipeLogDelete/.test(jfDetailSrc),
      true,
    )
    // レシピを消したあとに残っている記録も、消したら戻せる
    const jfDetachedSrc = jfRead('src/db/detachedLogs.ts')
    eq(
      'JF-6 レシピの無い記録も、消す前の姿を控えてから消せる',
      /restoreDetachedRecord/.test(jfDetachedSrc),
      true,
    )
  }

  // --- JF-7: 鍵を掛けたら記録も編集できない／「まとめて空にする」は記録を消さない
  //           （オーナー追加指示「記録は編集モードで消せる。鍵をかけたら編集もできなくなるようにして。
  //             変更を入れるなら、まとめて献立を空ににする機能の対象外にしたい。
  //             献立を変種していたら誤って記録まで消してしまう事故が起こりそう」） ---
  {
    // (1) 鍵を掛けた日は、記録の追加も削除も止まる。
    //     献立の側は 2026-08-08 便EA で「鍵を掛けたら手での操作も全部止める」になっているので、
    //     記録も**同じ止め方**（押せる場所は出したまま、押せなくする）にそろえる
    eq(
      'JF-7 記録を足す入口が、鍵で止まる形になっている',
      /data-testid="past-record-add"[\s\S]{0,900}disabled=\{/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-7 記録の削除も、鍵で止まる形になっている',
      /data-testid="past-record-delete"[\s\S]{0,500}disabled=\{/.test(jfMealPlanSrc),
      true,
    )
    // 止める判断は、日付の横の鍵の絵と**同じ値**でなければならない
    // （閉じた鍵が出ているのに押せる／開いた鍵なのに押せない、を作らない）
    eq(
      'JF-7 前提: 日付の横の鍵は「その日の3食とも掛かっているか」で描いている',
      /const dayLocked = isDayMealLocked\(lockedKeys, date\)/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-7 止める判断も同じ値（鍵の絵と食い違わせない）',
      /data-testid="past-record-add"[\s\S]{0,900}disabled=\{dayLocked\}/.test(jfMealPlanSrc) &&
        /deleteDisabled=\{dayLocked\}/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-7 押せない理由を読める文言がある',
      typeof ja.mealPlan.pastRecordLockedNote === 'string' &&
        ja.mealPlan.pastRecordLockedNote.length > 0,
      true,
    )
    eq(
      'JF-7 その理由が、鍵の掛かった日に出る形になっている',
      /data-testid="past-record-locked-note"/.test(jfMealPlanSrc),
      true,
    )

    // (2) 「まとめて空にする」は作った記録に触らない。
    //     消す計画（planClearMealSlots）が返すのは**献立の行の番号だけ**で、
    //     それを受ける removeMealEntries は mealPlans しか触らない
    const clearPlan = mealPlanLogicJF2.planClearMealSlots(
      [
        { id: 1, date: '2026-08-20', slot: 'dinner' },
        { id: 2, date: '2026-08-21', slot: 'dinner' },
      ],
      ['dinner'],
      new Set(),
    )
    eq(
      'JF-7 消す計画が返すのは献立の行の番号だけ（記録を指す口を持たない）',
      Object.keys(clearPlan).sort(),
      ['entryIdsToRemove', 'lockedEntryCount', 'lockedSlotCount', 'targetCount'],
    )
    const dbMealPlanSrc = jfRead('src/db/mealPlan.ts')
    const removeFn = dbMealPlanSrc.slice(
      dbMealPlanSrc.indexOf('export async function removeMealEntries'),
    )
    const removeBody = removeFn.slice(0, removeFn.indexOf('\n}\n') + 3)
    eq(
      'JF-7 前提: 献立の行を消す関数を読めている',
      removeBody.includes('bulkDelete'),
      true,
    )
    eq(
      'JF-7 献立の行を消す関数は、レシピ（＝作った記録の置き場所）に触らない',
      /db\.recipes|cookedLogs|detachedLogs/.test(removeBody),
      false,
    )
    // 消す相手は見出しで名指ししてある（「予定◯品を削除します」）＝
    // 作った記録が対象でないことは、名前のほうで言い切っている。
    // 「作った記録は残ります」と書き足すのは 2026-08-18 のオーナー指摘（嘘書かないで）で
    // 禁じられており、PLANWORD-1 が見張っている。ここでは名指しのほうを固定する
    eq(
      'JF-7 確認の見出しが、消す相手を「予定」と名指ししている（食事を選んだとき）',
      (ja.mealPlan.clearWeekSlotConfirmTitle ?? '').includes('予定'),
      true,
    )
    eq(
      'JF-7 確認の見出しが、消す相手を「予定」と名指ししている（3食とも選んだとき）',
      (ja.mealPlan.clearWeekSlotConfirmAllTitle ?? '').includes('予定'),
      true,
    )
  }

  // --- JF-5: 「◯食に入れる」の取り消し（⑥） ---
  {
    eq(
      'JF-5 「◯食に入れる」の取り消しの控えがある',
      /setUndoAssign\(/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-5 その取り消しがトーストの「元に戻す」につながっている',
      /undoAssignActive/.test(jfMealPlanSrc) && /runUndoAssign/.test(jfMealPlanSrc),
      true,
    )
    eq(
      'JF-5 取り消したことを知らせる文言がある',
      typeof ja.mealPlan.planMismatchAssignUndoneToast === 'string' &&
        ja.mealPlan.planMismatchAssignUndoneToast.includes('{title}'),
      true,
    )
  }
}

// ---------- JP-3: 手間レベルが「普通」の品は、カードにバッジを出さない ----------
//
// オーナー原文: 「③（手間レベル）推奨通り。絞り込みでどういう扱いになる？」
//   ＝司令部の推奨（C案＋バッジを出さない）どおり。
// 「普通」は**選ばなければそうなる既定値**（レシピ登録の未入力扱いも normal・
// src/pages/RecipeFormPage.tsx）で、人が選んだ結果ではない。並ぶカードの大半が
// 同じ「普通」で埋まると、見比べる手がかりにならない。
//
// 2026-08-23 追補（オーナー指示「絞り込みからも普通はずして」）: **絞り込みの選択肢からも外す**。
// 既定値の「普通」には、選ばなかった品と選んだ品が混ざって落ちてくるので、条件として品を
// 選り分けられない。**レシピのデータは触らない**（絞り込みの判定そのもの＝logic/search.ts も
// 1文字も変えない。変えたのは「画面に出す選択肢」と「保存されていた選択の直し方」だけ）。
{
  const jpEffort = await import('../../src/logic/effort.ts').catch(() => ({}))
  eq(
    'JP-3 手間レベルのバッジを出すかの決めごとがある（無ければ以下は測れていない）',
    typeof jpEffort.showsEffortBadge,
    'function',
  )
  if (typeof jpEffort.showsEffortBadge === 'function') {
    eq('JP-3 「普通」はバッジを出さない（既定値であって選んだ結果ではない）', jpEffort.showsEffortBadge('normal'), false)
    eq('JP-3 「超簡単」はバッジを出す', jpEffort.showsEffortBadge('easy'), true)
    eq('JP-3 「手の込んだ」はバッジを出す', jpEffort.showsEffortBadge('fancy'), true)
    eq(
      'JP-3 出さないのは既定値の1つだけ（既定値の定義を1か所から読んでいる）',
      jpEffort.DEFAULT_EFFORT_LEVEL,
      'normal',
    )
    // 絞り込みの選択肢（オーナー指示「絞り込みからも普通はずして」）。
    // バッジを出す規則と同じ1か所で決まっていること＝画面に出ない値では絞れない
    eq(
      'JP-3 絞り込みで選べる手間レベルに「普通」が入っていない',
      [...(jpEffort.EFFORT_FILTER_LEVELS ?? [])],
      ['easy', 'fancy'],
    )
    eq(
      'JP-3 選択肢は、バッジを出す規則と同じ1か所で決まっている',
      [...(jpEffort.EFFORT_LEVELS ?? [])].filter((l) => jpEffort.showsEffortBadge(l)),
      [...(jpEffort.EFFORT_FILTER_LEVELS ?? [])],
    )
    // 選べなくなった値が保存に残っていても、空の一覧から必ず抜けられる
    eq(
      'JP-3 保存されていた「普通」の絞り込みは「すべて」に戻す（抜ける道がある）',
      jpEffort.normalizeEffortFilter?.('normal'),
      'all',
    )
    eq(
      'JP-3 いまも選べる絞り込みは、そのまま戻す',
      [jpEffort.normalizeEffortFilter?.('easy'), jpEffort.normalizeEffortFilter?.('fancy'), jpEffort.normalizeEffortFilter?.(undefined)],
      ['easy', 'fancy', 'all'],
    )
  }
  // 絞り込みは変えない: 「普通」で絞れば「普通」の品が出る（バッジの有無と結びつけない）
  const jpSearch = await import('../../src/logic/search.ts')
  const jpRecipe = (id, title, effortLevel) => ({
    id,
    title,
    effortLevel,
    servings: 2,
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    createdAt: 0,
    updatedAt: 0,
  })
  const jpList = [
    jpRecipe(1, 'ふつうの品', 'normal'),
    jpRecipe(2, 'かんたんな品', 'easy'),
    jpRecipe(3, '手の込んだ品', 'fancy'),
  ]
  const jpFind = (effort) =>
    jpSearch
      .searchRecipes(jpList, { ...jpSearch.defaultSearchOptions, effort, ngIngredients: [] })
      .map((r) => r.recipe.id)
  // 絞り込みの**判定そのもの**は変えていない（選択肢を減らしただけで、データも判定も無傷）。
  // ここが崩れると、保存された絞り込みや将来の入口で「普通」の品が消える
  eq('JP-3 絞り込みの判定は変えていない（「普通」で絞れば「普通」の品が出る）', jpFind('normal'), [1])
  eq('JP-3 絞り込みの判定は変えていない（絞らなければ3品とも出る）', jpFind('all').sort(), [1, 2, 3])
  eq('JP-3 「超簡単」で絞ればその品だけが出る', jpFind('easy'), [2])
}


// ==========================================================================================
// JQ-1〜JQ-3（2026-08-23 便JQ）: 献立の編集モードで「操作の段がどの品のものか」を読める形の見張り
//
// オーナー原文:
//   「献立・週
//     ・編集の主菜や◯人分、削除などの列が、どのレシピについているのかわからない。
//       上下のレシピで距離が同じ」
//
// 画面での見え方（間隔・囲み・線の濃さ）は e2e の JQBOX-01/02・JQSAME-03・JQTHEME-04 が
// 実測で受け持つ。ここで見張るのは**書き方そのものに残る決まりごと**で、e2e より早く・
// ブラウザ無しで気づける3つ:
//   JQ-1 1品の中（カードの段と操作の段の間）より、品と品の間のほうが広い（**関係で測る**。
//        「12pxであること」ではなく「近いほうが同じ品」を守る）
//   JQ-2 1品ぶんが囲みで囲まれていて、その線は並ぶカード用の濃い線（--border-card ＝
//        border-edge-card。2026-08-22 便JE が5テーマで 3:1 を満たす濃さにしたもの）を使う
//   JQ-3 囲みのぶんを**外へ逃がして**いる＝料理名の幅を1pxも削っていない
//        （囲みの内側の余白＋線 と、逃がす負の余白 が釣り合っている）
//
// 掴み方は「関数の範囲」と「その中の目印」だけで、行番号は使わない。
// **見つけられなければその場で赤にする**（書き方が変わったのに黙って素通りしない）。
// ==========================================================================================
{
  const jqSrc = readFileSync(new URL('../src/pages/MealPlanPage.tsx', scriptFileUrl), 'utf-8')
  eq('JQ-1 前提: 献立の画面を読めている（0なら見張りが壊れている）', jqSrc.length > 10000, true)

  /** Tailwind の間隔クラスを px にする（p-1=4px / space-y-4=16px / -mx-[5px]=5px） */
  const jqPx = (raw) => {
    if (raw == null) return null
    const bracket = raw.match(/^\[(\d+(?:\.\d+)?)px\]$/)
    if (bracket) return Number(bracket[1])
    const sm = raw.match(/^\[var\(--space-(sm|md|lg)\)\]$/)
    if (sm) return { sm: 8, md: 16, lg: 24 }[sm[1]]
    if (/^\d+(\.\d+)?$/.test(raw)) return Number(raw) * 4
    return null
  }
  /** クラス並びから、その種類（p / py / mt / space-y / -mx …）の値を px で取り出す */
  const jqOf = (className, kind) => {
    const m = (className ?? '').match(new RegExp(`(?:^|\\s)${kind}-((?:\\[[^\\]]+\\])|[\\d.]+)(?:\\s|$)`))
    return m ? jqPx(m[1]) : null
  }
  /** border（太さの指定が無ければ1px）。border-2 等なら その値 */
  const jqBorder = (className) => {
    if (!/(?:^|\s)border(?:-\d+)?(?:\s|$)/.test(className ?? '')) return 0
    const m = (className ?? '').match(/(?:^|\s)border-(\d+)(?:\s|$)/)
    return m ? Number(m[1]) : 1
  }
  /**
   * from 以降にある目印を探し、その目印の**手前（before）／後ろ（after）で
   * いちばん近い className="..."** を拾う。行番号にも並び順にも依らない
   */
  const jqClassNear = (from, marker, dir, kind) => {
    const at = jqSrc.indexOf(marker, from)
    if (at < 0) return null
    const near = dir === 'after' ? jqSrc.slice(at, at + 600) : jqSrc.slice(Math.max(0, at - 600), at)
    const all = [...near.matchAll(/className="([^"]*)"/g)].map((m) => m[1])
    // 目印にいちばん近い順に見て、探している種類の間隔を持つものを選ぶ
    // （入れ子の内側の要素＝間隔を持たない span などを取り違えない）
    const ordered = dir === 'after' ? all : [...all].reverse()
    if (kind) return ordered.find((c) => jqOf(c, kind) !== null) ?? null
    return ordered[0] ?? null
  }

  // 1品ぶんを組む関数（renderRow）と、それを並べる関数（renderSlotEditor）の範囲を取る
  // 引数を1行ずつ書いている方＝献立の1品ぶんを組む関数（同名の関数が食費の表にもあるので、
  // 「const renderRow = (」だけで探すとそちらに当たる）
  const jqRowAt = jqSrc.indexOf('const renderRow = (\n')
  const jqEditorAt = jqSrc.indexOf('const renderSlotEditor = (')
  eq('JQ-1 前提: 1品ぶんを組む関数と、それを並べる関数を見つけられた', jqRowAt > 0 && jqEditorAt > jqRowAt, true)

  // ①1品の中＝操作の段（役割ラベルを出している段）に付いている上の余白
  const jqInnerClass = jqClassNear(jqRowAt, 'ja.mealPlan.role[role]', 'before', 'mt')
  const jqInner = jqOf(jqInnerClass, 'mt')
  eq('JQ-1 前提: 1品の中の間隔を読めた', typeof jqInner === 'number' && jqInner > 0, true)

  // ②品と品の間＝品を並べている入れ物の space-y
  const jqListClass = jqClassNear(jqEditorAt, 'roleRows.map(', 'before', 'space-y')
  const jqBetween = jqOf(jqListClass, 'space-y')
  eq('JQ-1 前提: 品と品の間の間隔を読めた', typeof jqBetween === 'number' && jqBetween > 0, true)

  // ③1品ぶんの囲み（plan-row そのもの）
  const jqBoxClass = jqClassNear(jqRowAt, 'data-testid="plan-row"', 'after')
  const jqBoxPad = jqOf(jqBoxClass, 'p')
  const jqBoxBorder = jqBorder(jqBoxClass)
  eq('JQ-2 前提: 1品ぶんの囲みの書き方を読めた', typeof jqBoxClass === 'string' && jqBoxClass.length > 0, true)

  // --- JQ-1: 近いほうが同じ品（数字ではなく関係で見る） ---
  // 品と品の間は、囲みの内側の余白と線のぶんだけさらに開く（上の品の操作の段の下端から
  // 次の品のカードの上端まで＝space-y ＋ (余白＋線)×2）
  const jqBetweenSeen = jqBetween + (jqBoxPad ?? 0) * 2 + jqBoxBorder * 2
  eq(
    `JQ-1 1品の中(${jqInner}px)より、品と品の間(${jqBetweenSeen}px)のほうが広い`,
    jqBetweenSeen > jqInner,
    true,
  )
  // 便IZ が「上の品の×と下の品のカードの押し間違え」を理由に広げた値なので、縮めて直したことにしない
  eq('JQ-1 1品の中は12px以上のまま（押し間違えない間隔を縮めていない）', jqInner >= 12, true)

  // --- JQ-2: 囲みがあり、線は並ぶカード用の濃い線を使う ---
  eq('JQ-2 1品ぶんが囲みで囲まれている（線がある）', jqBoxBorder > 0, true)
  eq(
    'JQ-2 囲みの線は並ぶカードと同じ濃い線（border-edge-card＝--border-card）を使う',
    /(?:^|\s)border-edge-card(?:\s|$)/.test(jqBoxClass ?? ''),
    true,
  )
  eq('JQ-2 囲みの角丸は並ぶカードと同じ（rounded-card）', /(?:^|\s)rounded-card(?:\s|$)/.test(jqBoxClass ?? ''), true)

  // --- JQ-3: 囲みのぶんは外へ逃がす＝料理名の幅を1pxも削らない ---
  // 囲みを普通に足すと、内側の余白と線のぶんだけ中の料理カードが細る。
  // それを打ち消すために、品を並べる入れ物に同じだけの負の余白を付けてある。
  // 釣り合いが崩れた瞬間に料理名が細るので、**等しいこと**を見張る
  const jqPull = jqOf(jqListClass, '-mx')
  eq('JQ-3 前提: 囲みを外へ逃がす負の余白を読めた', typeof jqPull === 'number', true)
  eq(
    `JQ-3 囲み(余白${jqBoxPad}px＋線${jqBoxBorder}px)と同じだけ外へ逃がしている＝料理名の幅を削らない`,
    jqPull,
    (jqBoxPad ?? 0) + jqBoxBorder,
  )
  // 逃がしすぎると、囲みが1つ外の枠（朝食/昼食/夕食の枠＝余白 --space-sm）の線に重なる
  eq('JQ-3 逃がす量が、1つ外の枠の余白(8px)を食い破っていない', jqPull < 8, true)
}


// ==========================================================================================
// 便KD: 電子レンジの二重予約（2026-08-23・影響範囲テストC「時間が無い人」の実データ30品）
//
// 起きていたこと（画面から書き写した実際の段取り）:
//   [16-22] 600Wのレンジで6分加熱し、ラップをしたまま2分おく
//   [16-18] ラップをかけて2分レンチンし、水けをきる      ← 同じ16分から同時に始まる
// レンジは1台なので、この段取りではどちらかが作れない。
// レンジを使う17品の全136組で18〜22組（13〜16%）に出ていた。
//
// 原因は「**台所を離れてよいか**（手を戻す締め切り＝waitUrgency）」で
// 「**器具をふさぐか**」まで決めていたこと。レンジ加熱の文が「〜2分おく」「〜粗熱を取ります」で
// 終わると、最後に当たった語で relaxed に倒れ、レンジが動いているのに空いている扱いになっていた。
//
// 測るのは**利用者が確かめたいこと**＝「1台しかない器具を、2品が同時に使う段取りを出さないこと」。
// 工程がいくつに割れたか・何番目に出たかは見ない（段取りが伸びても縮んでも同じ判定になる形）。
// ==========================================================================================
{
  const kdRecipe = (id, title, dishType, steps) => ({
    id,
    title,
    dishType,
    servings: 2,
    ingredients: [],
    steps: steps.map(([text, minutes]) => (minutes == null ? { text } : { text, minutes })),
  })

  // 実データの本文をそのまま使う（作り話の手順では再現しない）
  const kdMizoreni = kdRecipe(9001, '鶏むね肉ときのこのレンチンみぞれ煮', 'main', [
    ['鶏肉はキッチンペーパーで水気をふきとり、一口大に切る。ビニール袋に鶏肉、マヨネーズを入れて揉み込む。'],
    ['しめじは根元を切り落とし、手でほぐす。大根は皮を厚めにむき、すりおろして軽く水気を切る(大根おろし)。'],
    ['耐熱容器に☆、1を入れて混ぜ、しめじ、大根おろしをのせてふんわりとラップをし、600Wのレンジで6分加熱し、ラップをしたまま2分おく。', 6],
    ['器に盛り、細ねぎをちらす。'],
  ])
  const kdNorigoma = kdRecipe(9002, 'キャベツののりごまあえ', 'side', [
    ['キャベツは3～4cm四方に切って耐熱ボウルに入れ、ラップをかけて2分レンチンし、水けをきる。', 2],
    ['焼きのりは細かくちぎり、白すりごま大さじ1、しょうゆ小さじ2、砂糖小さじ1/2とともに１に加えてあえる。'],
  ])
  const kdEnoki = kdRecipe(9003, 'えのきとしめじの塩昆布和え', 'side', [
    ['えのき、しめじは石づきを切り落としておきます。'],
    ['えのきは半分に切ってほぐします。'],
    ['しめじは小房にほぐします。'],
    ['耐熱ボウルに1、2を入れ、ふんわりとラップをかけ、600Wの電子レンジで2分程加熱します。水気を切り、粗熱を取ります。', 2],
    ['ボウルに3、塩昆布、(A)を入れて和えます。'],
    ['器に盛り付けて完成です。'],
  ])
  const kdOyako = kdRecipe(9004, 'レンジで手軽に親子丼', 'main', [
    ['玉ねぎは薄切りにします。'],
    ['鶏むね肉は一口大に切ります。'],
    ['ボウルに(A)を入れて混ぜ合わせます。'],
    ['耐熱皿に1、2を順に入れ、3を流し入れます。ラップをかけ、600Wの電子レンジで4分程加熱します。', 4],
    ['一度取り出して溶き卵を流し入れます。再びラップをかけ、鶏むね肉に火が通るまで600Wの電子レンジで2分加熱します。', 2],
    ['器にごはんをよそい、5を盛り付け、のりをのせて完成です。'],
  ])

  /**
   * その段取りで、器具の台数を超えて同時に使っている瞬間があるか。
   * 同じ品の中の重なりは「同じ鍋の続き」なので、**同時に使っている品数**で数える。
   */
  const kdOverCapacity = (items, kitchen) => {
    const over = []
    for (const key of APPLIANCE_KEYS) {
      const capacity = applianceCapacity(kitchen, key)
      const uses = items
        // 持っていない器具の工程はコンロ1口として数える（設定と同じ読み方）
        .map((it) => ({ key: stepApplianceFor(it.text, kitchen), start: it.startMin, end: it.endMin, title: it.recipeTitle }))
        .filter((u) => u.key === key && u.end > u.start)
      for (const at of new Set(uses.map((u) => u.start))) {
        const busy = new Set(uses.filter((u) => u.start <= at && u.end > at).map((u) => u.title))
        if (busy.size > capacity) over.push(`${key} ${at}分 ${[...busy].join(' / ')}`)
      }
    }
    return over
  }

  for (const [label, recipes] of [
    ['みぞれ煮 ＋ のりごまあえ', [kdMizoreni, kdNorigoma]],
    ['みぞれ煮 ＋ 塩昆布和え', [kdMizoreni, kdEnoki]],
    ['親子丼 ＋ 塩昆布和え', [kdOyako, kdEnoki]],
    ['のりごまあえ ＋ 塩昆布和え', [kdNorigoma, kdEnoki]],
    ['親子丼 ＋ のりごまあえ ＋ 塩昆布和え（3品）', [kdOyako, kdNorigoma, kdEnoki]],
  ]) {
    const over = kdOverCapacity(buildCookPlan(recipes, DEFAULT_KITCHEN).items, DEFAULT_KITCHEN)
    eq(`KD-1 1台しかない器具を2品が同時に使う段取りを出さない: ${label}（${over.join(' / ') || '重なりなし'}）`, over.length, 0)
  }

  // レンジが1台も無い台所では、レンジの工程はコンロ1口として数える。
  // 2口あるので同時に2品まで＝ここでも定員を超えない
  {
    const kdNoMicrowave = { burners: 2, microwave: false, grill: true, toaster: true }
    const over = kdOverCapacity(
      buildCookPlan([kdMizoreni, kdNorigoma], kdNoMicrowave).items,
      kdNoMicrowave,
    )
    eq(`KD-1 レンジの無い台所でも器具の台数を超えない（${over.join(' / ') || '重なりなし'}）`, over.length, 0)
  }

  // ---- KD-2: 器具が動いている待ちは、文の終わり方に関係なくふさぐ ----
  // 「〜2分おく」「〜粗熱を取ります」で終わっても、その分数はレンジが回っている時間
  for (const [label, text] of [
    ['600Wのレンジで6分加熱し、ラップをしたまま2分おく', '耐熱容器に☆、1を入れて混ぜ、しめじ、大根おろしをのせてふんわりとラップをし、600Wのレンジで6分加熱し、ラップをしたまま2分おく。'],
    ['600Wの電子レンジで2分程加熱します。水気を切り、粗熱を取ります', '耐熱ボウルに1、2を入れ、ふんわりとラップをかけ、600Wの電子レンジで2分程加熱します。水気を切り、粗熱を取ります。'],
    ['ラップをかけて2分レンチンし、水けをきる', 'キャベツは3～4cm四方に切って耐熱ボウルに入れ、ラップをかけて2分レンチンし、水けをきる。'],
    ['電子レンジ(600W)で加熱して水切りする', '木綿豆腐はキッチンペーパーに包んで耐熱皿にのせ、電子レンジ(600W)で加熱して水切りする。'],
    ['弱火で5分ほど煮て味をなじませたら器に盛る', '豆腐を加え、弱火で5分ほど煮て味をなじませたら器に盛る。'],
    ['ブロッコリーは別に2分塩ゆでしておく', '具材を一口大に切る。ブロッコリーは別に2分塩ゆでしておく。'],
  ]) {
    eq(`KD-2 器具が動いている待ちは器具をふさぐ: ${label}`, waitKeepsAppliance({ text }), true)
  }

  // ---- KD-2: 器具から下りたあとの置き時間まで数えない（多く数えすぎない） ----
  for (const [label, text] of [
    ['火を止めてそのまま10分おき、味をしみ込ませる', '火を止めてそのまま10分おき、味をしみ込ませる。'],
    ['火を止め、そのまま10分おいて味を含ませます', '大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。'],
    ['粗熱が取れたら冷蔵庫で30分冷やす', '粗熱が取れたら冷蔵庫で30分冷やす。'],
  ]) {
    eq(`KD-2 器具から下りたあとの待ちはふさがない: ${label}`, waitKeepsAppliance({ text }), false)
  }

  // ---- KD-3: 「台所を離れてよいか」と「器具をふさぐか」は別の軸のまま ----
  // 器具をふさぐようにしたからといって、手を戻す締め切りまで厳しくしていない
  // （厳しくすると、差し込める手作業が減って段取りが縮まなくなる）
  {
    const kdRestAfterHeat = { text: '600Wのレンジで6分加熱し、ラップをしたまま2分おく。', minutes: 6 }
    eq('KD-3 レンジの待ちは器具をふさぐ', waitKeepsAppliance(kdRestAfterHeat), true)
    eq(
      'KD-3 手を戻す締め切りの厳しさ（台所を離れてよいか）は別に決まる',
      waitUrgency(kdRestAfterHeat),
      'relaxed',
    )
    eq(
      'KD-3 締め切りの猶予も従来どおり（器具の話で締め切りを縮めていない）',
      waitOverrunAllowance(kdRestAfterHeat, 6),
      Number.POSITIVE_INFINITY,
    )
  }

  // ---- KD-4: ワンパンのレシピに、存在しない「湯を沸かす」を足さない ----
  // 実データ「ワンパンミートソースパスタ」は、フライパン1つでソースの中にパスタを入れて煮る。
  // 別鍋で湯を沸かす工程は無いのに、ナビが5分の湯沸かしを差し込んでいた。
  // 測るのは「ナビが足した工程が段取りに出るかどうか」だけ（工程の数や並びは見ない）
  {
    const kdAddedByNavi = (steps) =>
      buildPlanSteps(steps.map(([text, minutes]) => (minutes == null ? { text } : { text, minutes })))
        .filter((p) => p.addedByNavi)
        .map((p) => p.step.text)

    const kdOnePan = kdAddedByNavi([
      ['玉ねぎはみじん切りにする。にんにくは縦半分に切って芯を取り除き、みじん切りにする。'],
      ['フライパンにオリーブオイル、にんにくを入れて香りが立つまで弱火で加熱し、合いびき肉を加えて肉の色が変わるまで中火で炒める。'],
      ['玉ねぎを加えてしんなりするで炒める。'],
      ['カットトマト缶、水、☆を加えて混ぜ、パスタを半分に折り入れて混ぜる。煮立ったらふたをし、中火で時々混ぜながら袋の表示時間より1分長くゆでる。', 1],
      ['水気をとばしながら強めの中火で炒め、オリーブオイルを加えて混ぜる。'],
      ['器に盛り、粉チーズをかける。'],
    ])
    eq(
      `KD-4 ワンパン（同じ器で煮る）のレシピに湯沸かしを足さない（足したもの=${kdOnePan.join('/') || 'なし'}）`,
      kdOnePan.length,
      0,
    )

    // 湯だけを別に沸かす書き方では、今までどおり足す（足りない工程を消してしまわない）
    const kdSeparatePot = kdAddedByNavi([
      ['玉ねぎは薄切りにする。'],
      ['スパゲッティを袋の表示より1分長めにゆでる。'],
      ['フライパンで具材を炒め、ゆでたスパゲッティを加えて混ぜる。'],
    ])
    eq(
      'KD-4 湯だけを別に沸かすレシピには、今までどおり湯沸かしを足す',
      kdSeparatePot.length > 0,
      true,
    )

    // 別の鍋の「煮立ったら」で、本物の湯沸かしを消さない（同梱 梅おろしぶっかけうどん）
    const kdUdon = kdAddedByNavi([
      ['梅干しは種を取り除き、包丁でたたいてペースト状にする。'],
      ['小鍋にだし汁・しょうゆ・みりんを入れて中火にかけ、煮立ったら火を止める。', 2],
      ['つゆの粗熱を取り、冷蔵庫でよく冷やす。'],
      ['鍋にたっぷりの湯を沸かし、冷凍うどんを袋の表示に沿って茹でる。茹で上がったら流水でぬめりを洗い流し、氷水でしっかり締める。'],
    ])
    eq(
      `KD-4 別の鍋の「煮立ったら」で、本文にある湯沸かしまで消さない（足したもの=${kdUdon.join('/') || 'なし'}）`,
      kdUdon.some((t) => t.includes('沸か')),
      true,
    )
  }
}


// ==========================================================================================
// KF-1〜KF-7(2026-08-23 便KF): 影響範囲テストB「健康を気にする人」の実データ30品で見つかった、
// 栄養の数字が減塩の判断に使えなくなる穴。
//
// 実データの再現（直す前の実測）: 30品中24品(80%)で材料が一部落ち、のべ49件
// （成分データ無し26件・単位を換算できない11件・適量少々12件）。塩分の数字だけで判断すると
// 誤る品が11/30品(37%)。とくに「塩分の源が丸ごと落ちて 0.0g と出る」品が2品あった。
//
// ここで見張るのは「利用者が確かめたいこと」＝**減塩したい人が数字を見て判断できるか**。
// ==========================================================================================
{
  const {
    computeRecipeNutrition,
    hasMaterialGap,
    hasSaltSourceGap,
    saltSourceGaps,
    matchNutritionFood,
    convertToGrams,
  } = await import('../../src/logic/nutrition.ts')
  const { resolveImportedServings } = await import('../../src/logic/servings.ts')

  /** 実データの1行をそのまま材料にした1品を作る（保存されている形をそのまま渡す） */
  const dish = (servings, ingredients) => computeRecipeNutrition({ servings, ingredients })

  // ---------- KF-1: 塩分を持つ調味料が丸ごと落ちたときは、他の材料が落ちたときより強く知らせる ----------
  // 実データ139「トマトと大葉のだしマリネ」: 唯一の塩分源『白だし 大さじ1』が落ちて塩分0.0g。
  // 実データ132「キノコのマリネサラダ」: 塩が『適量』・酸味が『白ワインビネガー』で塩分0.0g。
  // どちらも出るのは他の材料が落ちたときと同じ1文だけだった。
  {
    const saltGone = dish(2, [
      { name: 'トマト', amount: '2', unit: '個' },
      { name: '秘伝の合わせだし', amount: '1', unit: '大さじ' },
    ])
    eq('KF-1 塩分を持つ調味料が落ちた品を見分けられる', hasSaltSourceGap(saltGone), true)
    eq('KF-1 落ちた調味料の名前を返す', saltSourceGaps(saltGone).map((e) => e.name), ['秘伝の合わせだし'])
    // 「塩 適量」だけが落ちた品も塩分の源が落ちている（reasonがamountでも見逃さない）。
    // 従来の hasMaterialGap は food/unit しか見ないので、この品には警告が1つも出なかった
    const saltAmountOnly = dish(2, [
      { name: 'しめじ', amount: '1', unit: 'パック' },
      { name: '塩', amount: '適量', unit: '' },
    ])
    eq('KF-1 「塩 適量」で塩分が落ちた品も見分けられる', hasSaltSourceGap(saltAmountOnly), true)
    eq('KF-1 従来の判定(hasMaterialGap)ではこの品を拾えない', hasMaterialGap(saltAmountOnly), false)
    // サイト側のまとめ行（実データ118「塩、酒、みりん、しょうゆ」・119「みそ、水 各」）
    const bundledRow = dish(2, [
      { name: 'たら', amount: '2', unit: '切れ' },
      { name: '塩、酒、みりん、しょうゆ', amount: '', unit: '' },
    ])
    eq('KF-1 サイトのまとめ行「塩、酒、みりん、しょうゆ」も塩分の源として拾う', hasSaltSourceGap(bundledRow), true)
    // 塩分を持たない材料しか落ちていない品では出さない（毎回出ると読まれなくなる）
    const noSalt = dish(2, [
      { name: '鶏もも肉', amount: '250', unit: 'g' },
      { name: '白いりごま', amount: '適量', unit: '' },
      { name: 'ドライパセリ', amount: '少々', unit: '' },
    ])
    eq('KF-1 塩分を持たない材料しか落ちていない品では出さない', hasSaltSourceGap(noSalt), false)
    // 下ごしらえ用の塩(prep・洗い流す)は塩分の源として数えない
    const prepSalt = dish(2, [
      { name: 'きゅうり', amount: '2', unit: '本' },
      { name: '塩', amount: '1/4', unit: '小さじ', memo: 'きゅうりの塩もみ用' },
    ])
    eq('KF-1 下ごしらえ用の塩(洗い流す)では出さない', hasSaltSourceGap(prepSalt), false)
    // 味つけが計算できている品で『塩 少々』が落ちただけでは出さない（毎回出る注意は読まれなくなる）。
    // 同梱109品で試すと、この歯止めが無いと「塩こしょう 少々」だけで8品に出ていた
    const seasonedEnough = dish(2, [
      { name: 'ほうれん草', amount: '1', unit: '束' },
      { name: 'しょうゆ', amount: '2', unit: '大さじ' },
      { name: '塩', amount: '適量', unit: '' },
    ])
    eq('KF-1 味つけが計算できている品で「塩 適量」が落ちても出さない', hasSaltSourceGap(seasonedEnough), false)
    // 「お好みで」は食べるかどうかを本人が決める分なので数えない（仮の量の線引きと同じ）
    const optional = dish(2, [
      { name: 'しめじ', amount: '1', unit: 'パック' },
      { name: '塩', amount: '少々(お好みで)', unit: '' },
    ])
    eq('KF-1 「お好みで」の調味料では出さない', hasSaltSourceGap(optional), false)
    // 「無塩」「塩不使用」「食塩不使用」と名乗る名前は塩分の手掛かりではない(2026-09-02 便NA・便MTの申し送り)。
    // 直す前の実測: 「無塩バター 適量」「塩不使用ミックスナッツ」で強い注意が出ていた
    // (名前の「塩」の字だけを見て、打ち消しの言い方を読んでいなかった)
    const unsaltedButter = dish(2, [
      { name: 'じゃがいも', amount: '2', unit: '個' },
      { name: '無塩バター', amount: '適量', unit: '' },
    ])
    eq('KF-1 「無塩バター 適量」では出さない(塩を使わないと名乗る名前)', hasSaltSourceGap(unsaltedButter), false)
    const saltFreeButter = dish(2, [
      { name: 'じゃがいも', amount: '2', unit: '個' },
      { name: '食塩不使用バター', amount: '適量', unit: '' },
    ])
    eq('KF-1 「食塩不使用バター 適量」でも出さない', hasSaltSourceGap(saltFreeButter), false)
    const saltFreeNuts = dish(2, [
      { name: 'じゃがいも', amount: '2', unit: '個' },
      { name: '塩不使用ミックスナッツ', amount: '30', unit: 'g' },
    ])
    eq('KF-1 「塩不使用ミックスナッツ」(成分データ無しで落ちる)でも出さない', hasSaltSourceGap(saltFreeNuts), false)
    // 外すのは打ち消しの言い方だけ。有塩バターは塩分を持つので、当たりすぎる側に倒す線は変えない
    const saltedButter = dish(2, [
      { name: 'じゃがいも', amount: '2', unit: '個' },
      { name: '有塩バター', amount: '適量', unit: '' },
    ])
    eq('KF-1 「有塩バター 適量」では今までどおり出す', hasSaltSourceGap(saltedButter), true)
  }

  // ---------- KF-8: 塩分の強い注意が、同梱109品では1品も出ない ----------
  // 注意は「めったに出ないから読まれる」。同梱の基本レシピで出るようなら、
  // 判定が当たりすぎている（薬味・果物にまで出ていた形を実際に作り込んだ）。
  {
    const { starterDefs } = await import('../../src/db/starters.ts')
    const noisy = starterDefs
      .filter((d) => hasSaltSourceGap(computeRecipeNutrition(d)))
      .map((d) => d.title)
    eq('KF-8 同梱の基本レシピでは塩分の注意が1品も出ない', noisy, [])
  }

  // ---------- KF-2: 単位の1文字違いで主材料が丸ごと落ちない ----------
  // 実データ138「鮭の南蛮漬け」: 『生鮭 2切』が単位換算できず、主菜なのに1人分たんぱく質1.0g。
  // 実データ135「豚汁」: 『こんにゃく 1/2個』（成分表は「枚」だけ）。
  // 実データ120・118: 『しょうがのみじん切り 1かけ分』（成分表は「かけ」だけ）。
  {
    const salmon = matchNutritionFood('生鮭')
    eq('KF-2 前提: 生鮭は成分表の鮭に名寄せできている', salmon?.label, '鮭')
    eq('KF-2 「切」は「切れ」と同じ重さに換算できる', convertToGrams(2, '切', salmon), convertToGrams(2, '切れ', salmon))
    const konnyaku = matchNutritionFood('こんにゃく')
    eq('KF-2 こんにゃくの「個」は「枚」と同じ重さに換算できる', convertToGrams(1, '個', konnyaku), convertToGrams(1, '枚', konnyaku))
    const ginger = matchNutritionFood('しょうが')
    eq('KF-2 「かけ分」は「かけ」と同じ重さに換算できる', convertToGrams(1, 'かけ分', ginger), convertToGrams(1, 'かけ', ginger))
    const garlic = matchNutritionFood('にんにく')
    eq('KF-2 にんにくの「かけ分」も換算できる', convertToGrams(1, 'かけ分', garlic), convertToGrams(1, 'かけ', garlic))
    // 「1本分」「1個分」のように「◯◯分」と書かれた単位は、いつでも元の単位として読む
    const negi = matchNutritionFood('長ねぎ')
    eq('KF-2 「本分」は「本」と同じ重さに換算できる', convertToGrams(1, '本分', negi), convertToGrams(1, '本', negi))
    // 元の単位が成分表に無いときは、換算できないまま（勝手な数字を作らない）
    eq('KF-2 元の単位が無い「房分」は換算できないまま', convertToGrams(1, '房分', negi), null)
    // 実データ110「鮭のちゃんちゃん焼き風」: 『塩鮭 2切れ』が成分データ無しで1人分72kcal
    const shiozake = matchNutritionFood('塩鮭')
    eq('KF-2 塩鮭に成分データがある', shiozake?.label, '塩鮭')
    eq('KF-2 塩鮭は塩分を持つ（生鮭と同じ値にしない）', (shiozake?.per100g.saltG ?? 0) > 1, true)
    // 実データ129「五目豆」: 『大豆 150g』が成分データ無しでたんぱく質1.4g
    eq('KF-2 素の「大豆」に成分データがある', matchNutritionFood('大豆')?.id, '04028')
    // 主材料が落ちなくなったことを、品として測る（1人分のたんぱく質で見る）
    const nanbanzuke = dish(4, [
      { name: '生鮭', amount: '2', unit: '切' },
      { name: 'ピーマン', amount: '4', unit: '個' },
      { name: '玉ねぎ', amount: '1/4', unit: '個' },
    ])
    eq('KF-2 「生鮭 2切」の主菜が主材料を落とさない(1人分たんぱく質8g超・旧1.0g)', nanbanzuke.perServing.proteinG > 8, true)
  }

  // ---------- KF-3: 合わせ調味料の印(◎◯☆★)が材料名に残らない ----------
  // 実データ122〜126・138(つくおき): 『◎酒 大1』『◎白だし 大1.5』のように、分量が「大1」形式で
  // 単位欄が空の行だけ、行頭の印が名前に残っていた（印を剥がす処理の**取りこぼし側**）。
  {
    eq('KF-3 「◎酒 大1」の印が名前に残らない', normalizeImportedIngredient('◎酒', '大1').name, '酒')
    eq('KF-3 剥がした印は控えとして返る', normalizeImportedIngredient('◎酒', '大1').mark, '◎')
    eq('KF-3 分量はそのまま残る', normalizeImportedIngredient('◎酒', '大1').amount, '大1')
    eq('KF-3 「◯酒」(白丸)も同じ', normalizeImportedIngredient('◯酒', '大2').name, '酒')
    eq('KF-3 「◎白だし」も同じ', normalizeImportedIngredient('◎白だし', '大1.5').name, '白だし')
    eq('KF-3 「☆みりん」も同じ', normalizeImportedIngredient('☆みりん', '大2').name, 'みりん')
    // 印が付いていない行は1文字も変えない
    eq('KF-3 印が無い行は変えない', normalizeImportedIngredient('醤油', '大2').name, '醤油')
    // 印を剥がした結果、栄養の名寄せが通る（落ちていた理由そのもの）
    eq('KF-3 印を剥がすと栄養の名寄せが通る', matchNutritionFood(normalizeImportedIngredient('◎酒', '大1').name)?.label, '酒')
  }

  // ---------- KF-4: 人数分が読み取れないときに黙って既定の人数にしない ----------
  // 実データ21(=128 切り干し大根とひじきのごま煮): ページに「(4人分)」と書いてあるのに2人分で保存され、
  // 1人分の塩分が2倍(4.9g)に出た。対象外0件なので注意書きは1つも出なかった。
  {
    eq('KF-4 人数分が読めたらそのまま入れる', resolveImportedServings(4, 2), { servings: 4, unread: false })
    eq('KF-4 人数分が無いときは今の人数のまま「読めなかった」印を立てる', resolveImportedServings(undefined, 2), { servings: 2, unread: true })
    eq('KF-4 0人分・壊れた値も「読めなかった」扱い', resolveImportedServings(0, 2), { servings: 2, unread: true })
    eq('KF-4 範囲外(24人分)は範囲に収めたうえで読めた扱い', resolveImportedServings(24, 2), { servings: 20, unread: false })
  }

  // ---------- KF-5: 素の「ねぎ」が名寄せできる（野菜量が0gにならない） ----------
  // 実データ136・137: 『ねぎ 1/2本』『ねぎ 1/4本』が成分データ無しで落ち、137は野菜量0g。
  {
    eq('KF-5 素の「ねぎ」が長ねぎに名寄せできる', matchNutritionFood('ねぎ')?.label, '長ねぎ')
    // 書き分けてある別のねぎは、これまでどおりそれぞれの食品のまま（誤爆させない）
    eq('KF-5 「青ねぎ」は青ねぎのまま', matchNutritionFood('青ねぎ')?.label, '青ねぎ')
    eq('KF-5 「小ねぎ」は小ねぎのまま', matchNutritionFood('小ねぎ')?.label, '小ねぎ')
    eq('KF-5 「万能ねぎ」は小ねぎのまま', matchNutritionFood('万能ねぎ')?.label, '小ねぎ')
    eq('KF-5 「玉ねぎ」は玉ねぎのまま', matchNutritionFood('玉ねぎ')?.label, '玉ねぎ')
    eq('KF-5 「長ねぎ」は長ねぎのまま', matchNutritionFood('長ねぎ')?.label, '長ねぎ')
  }

  // ---------- KF-6: 塩分そのものの調味料が名寄せできる（0.0gの嘘の安心を作らない） ----------
  // 実データ: 白だし3件・固形スープの素・丸鶏がらスープが成分データ無しで落ちていた。
  {
    eq('KF-6 白だしに成分データがある', matchNutritionFood('白だし')?.label, '白だし')
    eq('KF-6 商品名付きの「香り白だし」も名寄せできる', matchNutritionFood('キッコーマン旨みひろがる 香り白だし')?.label, '白だし')
    eq('KF-6 固形スープの素はコンソメ(固形ブイヨン)に名寄せできる', matchNutritionFood('固形スープの素')?.label, 'コンソメ')
    eq('KF-6 「丸鶏がらスープ」は鶏がらスープの素に名寄せできる', matchNutritionFood('「丸鶏がらスープ™」')?.label, '鶏がらスープの素')
    // 塩分が実際に計算へ入ることまで見る（名寄せできても0gなら意味がない）
    const dashiMarine = dish(2, [
      { name: 'トマト', amount: '2', unit: '個' },
      { name: '白だし', amount: '1', unit: '大さじ' },
    ])
    eq('KF-6 白だし大さじ1で1人分の塩分が0.5g以上になる(旧: 0.0g)', dashiMarine.perServing.saltG >= 0.5, true)
    eq('KF-6 白だししか塩分源が無い品で、塩分の警告は出ない(計算に入ったため)', hasSaltSourceGap(dashiMarine), false)
    // 「しょう油」(かなと漢字の混ぜ書き)。読み仮名辞書では「油」が「あぶら」になるため名寄せできず、
    // 実データC「豚バラ大根」で大さじ2(食塩相当量約5.2g)が落ち、1人分の塩分が0.15gと出ていた
    eq('KF-6 「しょう油」もしょうゆに名寄せできる', matchNutritionFood('しょう油')?.label, 'しょうゆ')
    eq('KF-6 「薄口しょう油」は薄口しょうゆのまま', matchNutritionFood('薄口しょう油')?.label, '薄口しょうゆ')
  }

  // ---------- KF-7: 足した別名が別の食材に誤爆していない ----------
  // 名寄せを足すときにいちばん怖いのは「当たってはいけないものに当たる」こと。
  // 似た名前・部分一致で巻き込みやすいものを名指しで見張る。
  {
    const label = (name) => matchNutritionFood(name)?.label ?? null
    eq('KF-7 「大豆もやし」は大豆(水煮)に化けない', label('大豆もやし') !== '大豆（水煮）', true)
    eq('KF-7 「大豆油」は大豆(水煮)に化けない', label('大豆油') !== '大豆（水煮）', true)
    eq('KF-7 「蒸し大豆」は蒸し大豆のまま', label('蒸し大豆'), '蒸し大豆')
    eq('KF-7 「きな粉」はきな粉のまま', label('きな粉'), 'きな粉')
    eq('KF-7 「鮭」は生の鮭のまま(塩鮭に化けない)', label('鮭'), '鮭')
    eq('KF-7 「生鮭」は生の鮭のまま', label('生鮭'), '鮭')
    eq('KF-7 「酒」は酒のまま(鮭に化けない)', label('酒'), '酒')
    eq('KF-7 「塩」は塩のまま', label('塩'), '塩')
    eq('KF-7 「塩昆布」は塩昆布のまま', label('塩昆布'), '塩昆布')
    eq('KF-7 「だし汁」はだし汁のまま(白だしに化けない)', label('だし汁'), 'だし汁')
    eq('KF-7 「めんつゆ」はめんつゆのまま', label('めんつゆ'), 'めんつゆ（2倍濃縮）')
    eq('KF-7 「鶏がらスープの素」は鶏がらスープの素のまま', label('鶏がらスープの素'), '鶏がらスープの素')
    eq('KF-7 「和風だしの素」は和風だしの素のまま', label('だしの素'), '和風だしの素')
    eq('KF-7 「コンソメ」はコンソメのまま', label('コンソメ'), 'コンソメ')
    eq('KF-7 「こんにゃく」はこんにゃくのまま', label('こんにゃく'), 'こんにゃく')
    eq('KF-7 「しらたき」はしらたきのまま', label('しらたき'), 'しらたき')
    eq('KF-7 「米酢」は米酢のまま(ワインビネガーに化けない)', label('米酢'), '米酢')
    eq('KF-7 「酢」は酢のまま', label('酢'), '酢')
  }
}



// ==========================================================================================
// KG: 取り込んだレシピが献立を壊す件（2026-08-23 便KG・影響範囲テストA/B/C 90品の実測）
//
// 3体のペルソナが独立に同じ壊れ方を報告した。ここで見張るのは「利用者が確かめたいこと」＝
// 取り込んだ品が献立の中で正しい役割に入るか・書いてある事実が消えないか。
// ==========================================================================================

// ---------- KG-1: 料理の種別が主菜に倒れる（実データ90品で19〜24品が主菜） ----------
// 測定元: 影響範囲テスト A_節約の人 30品 / B_健康の人 30品 / C_時短の人 30品。
// 料理名・材料は取り込んだ実データの原文（先頭3件だけ使う＝pickIconKey が見る範囲と同じ）。
{
  const dish = (title, names = []) =>
    guessDishType({ title, tags: [], ingredients: names.map((name) => ({ name })) })

  // (a) 料理名に役割そのものが書いてある品は、その役割にする（書いてある事実の転記）
  eq(
    'KG-1 「ボリューム副菜！大豆・小松菜の卵炒め」は副菜（料理名に「副菜」と書いてある）',
    dish('ボリューム副菜！大豆・小松菜の卵炒め', ['大豆の水煮', '小松菜', '卵']),
    'side',
  )
  eq(
    'KG-1 「【節約副菜】厚揚げとキャベツのすき焼き風」は副菜',
    dish('【節約副菜】厚揚げとキャベツのすき焼き風', ['厚揚げ', '新玉ねぎ', 'キャベツ']),
    'side',
  )
  eq(
    'KG-1 「常備菜 鶏そぼろのひじき煮」は副菜（鶏ひき肉で主菜に倒れていた）',
    dish('常備菜 鶏そぼろのひじき煮', ['鶏ひき肉', 'さやいんげん', '乾燥ひじき']),
    'side',
  )

  // (b) 材料に入っている「だし」の調味料で汁物にしない（実データ: にんじんしりしりが汁物）
  eq(
    'KG-1 「ズボラ常備菜 にんじんしりしり」は汁物ではない',
    dish('ズボラ常備菜 にんじんしりしり', ['にんじん（中）', 'ごま油', 'だしの素']),
    'side',
  )
  eq(
    'KG-1 材料の「白だし」だけで汁物にしない',
    dish('鶏むね肉のさっぱり煮', ['鶏むね肉', '白だし', '酢']),
    'main',
  )

  // (c) 料理名の「お鍋に」は道具の言い方で、鍋料理ではない（実データB: 蒸し鶏が汁物になった）
  eq(
    'KG-1 「お鍋に放置でできる蒸し鶏」は主菜（鍋料理ではない）',
    dish('鶏むね肉しっとり お鍋に放置でできる蒸し鶏', ['鶏むね肉', 'はちみつ', '料理酒']),
    'main',
  )

  // (d) あえ物・サラダ・漬物は、たんぱく源の材料より先に「副菜」と決める
  //     （実データC: さばマヨ水菜サラダが3回とも主菜の枠に入った）
  eq(
    'KG-1 「切って混ぜるだけ♪ さばマヨ水菜サラダ」は副菜（さばより「サラダ」が役割を決める）',
    dish('切って混ぜるだけ♪ さばマヨ水菜サラダ', ['水菜', 'さばのみそ煮缶', 'マヨネーズ']),
    'side',
  )
  eq(
    'KG-1 「トマトと大葉のだしマリネ」は副菜（「だし」で汁物にしない）',
    dish('汁まで飲みほす美味しさ♡トマトと大葉のだしマリネ', ['トマト', '大葉（千切り）', '白だし']),
    'side',
  )
  eq(
    'KG-1 「厚揚げと小松菜の煮浸し」は副菜',
    dish('簡単！厚揚げと小松菜の煮浸し', ['厚揚げ', '小松菜', '醤油']),
    'side',
  )

  // (e) 直してはいけないもの（副菜に倒れすぎない）。実データで主菜のまま正しかった品
  eq('KG-1 「鶏むね照り焼き」は主菜のまま', dish('外さない定番レシピ！ 鶏むね照り焼き', ['鶏むね肉', '塩こしょう', '片栗粉']), 'main')
  eq(
    'KG-1 「日持ちする作り置きおかず【鶏むね肉の柔らか甘辛煮】」は主菜のまま（「作り置き」は役割の語ではない）',
    dish('日持ちする作り置きおかず【鶏むね肉の柔らか甘辛煮】', ['鶏むね肉(またはもも肉)', '薄力粉', '酒']),
    'main',
  )
  eq('KG-1 「具だくさん♪基本の豚汁」は汁物のまま', dish('具だくさん♪基本の豚汁', ['豚バラ肉', 'ごぼう', '水']), 'soup')
  eq('KG-1 「我が家の具だくさん減塩味噌汁」は汁物のまま', dish('我が家の具だくさん減塩味噌汁', ['大根', '玉ねぎ', '油揚げ']), 'soup')
  eq('KG-1 「鮭の西京みそ漬け」は主菜のまま（「漬け」だけでは漬物にしない）', dish('鮭の西京みそ漬け', ['生鮭', '西京みそ']), 'main')
}

// ---------- KG-1b: 読み取れないものは「保留」にする（機械の推測値を書き込まない） ----------
// 登録フォームは suggestDishType の値を保存する。読み取れないときは undefined を返し、
// チップを未選択のまま出して利用者に選んでもらう（ja.form.dishTypeNotGuessedHint）。
// 献立・検索が使う guessDishType は、未設定のレシピにも役割を当てて動く必要があるので
// 従来どおり主菜へ落とす（この主菜はデータには書き込まない内部の当て推量）。
{
  const suggest = (title, names = []) =>
    suggestDishType({ title, tags: [], ingredients: names.map((name) => ({ name })) })
  eq(
    'KG-1b 「つくおきのパリパリきゅうり」は保留（きゅうりだけでは役割が読み取れない）',
    suggest('つくおきのパリパリきゅうり', ['きゅうり', '砂糖', '醤油']),
    undefined,
  )
  eq(
    'KG-1b 「レンジで簡単10分！火を使わない絶品無限ナス」は保留',
    suggest('レンジで簡単10分！火を使わない絶品無限ナス', ['なす', '白いりごま', '細ねぎ(刻み)']),
    undefined,
  )
  eq('KG-1b 読み取れた品は保留にしない', suggest('鮭の塩焼き', ['鮭', '塩']), 'main')
  eq(
    'KG-1b 献立・検索が使う側は、保留でも主菜に落として動く（データには書かない）',
    guessDishType({ title: 'つくおきのパリパリきゅうり', tags: [], ingredients: [{ name: 'きゅうり' }] }),
    'main',
  )
}

// ---------- KG-2: 同梱109品で誤爆が0件（人が確定させた種別と食い違う品を増やさない） ----------
// 同梱レシピの dishType はオーナー裁定で確定済み（starters.ts / sets/*.ts）。自動判定を直すときに
// いちばん怖いのは「いま合っている品を外すこと」なので、食い違う品の一覧そのものを見張る。
{
  const mismatched = starterDefs
    .filter(
      (def) =>
        guessDishType({ title: def.title, tags: def.tags ?? [], ingredients: def.ingredients }) !==
        def.dishType,
    )
    .map((def) => def.title)
  // 2026-08-23 便KG 実測。これらは「人でも割れる品」で、データ側の裁定を正としている
  const known = [
    'だし巻き卵', '寄せ鍋', 'クリームシチュー', '漬けるだけ味玉', '卯の花(おからの炒り煮)',
    '高野豆腐の含め煮', '手作り鮭フレーク', '冷やし茶碗蒸し', '梅しそ冷奴', '冷しゃぶサラダ',
    '冷や汁', 'ゴーヤチャンプルー', 'だしのとり方',
  ]
  eq('KG-2 同梱109品で、人が確定させた種別と食い違う品が増えていない', mismatched.filter((t) => !known.includes(t)), [])
  eq('KG-2 同梱109品との一致は96品以上', starterDefs.length - mismatched.length >= 96, true)
}


// ============================================================================
// LG-03: レシピ登録画面（2026-08-26 便LG・オーナーの書き溜め）
// ============================================================================
{
  const lgRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lgForm = readFileSync(path.join(lgRoot, 'src/pages/RecipeFormPage.tsx'), 'utf-8')
  const lgToast = readFileSync(path.join(lgRoot, 'src/components/Toast.tsx'), 'utf-8')

  // ---- (c) 手順・材料の削除は、確認の窓をやめて「元に戻す」つきのトーストにする ----
  // オーナー原文「手順の削除をするたびに「この行を消します」の確認が出るのはテンポが悪い。
  //   削除しました（元に戻す）トーストでちょうどいい。」
  eq(
    'LG-03 1行削除の確認の文言は ja.ts から消えている',
    ['confirmRemoveRow', 'confirmRemoveRowOk'].filter((key) => key in ja.form),
    [],
  )
  eq(
    'LG-03 画面も1行削除で確認の窓を出していない',
    lgForm.includes('confirmRemoveRow()'),
    false,
  )
  eq('LG-03 代わりに出すトーストの文言がある', typeof ja.form.rowRemovedToast, 'string')
  eq(
    'LG-03 材料と手順のどちらの削除でも同じトーストを出す（同じ操作を2通りにしない）',
    (lgForm.match(/showRemovedToast\(\{[\s\S]{0,200}ja\.form\.rowRemovedToast/g) ?? []).length,
    2,
  )
  eq(
    'LG-03 消す前の並びをまるごと控えて戻す（1行でもまとめてでも同じ戻し方）',
    [lgForm.includes('undoRemovedRows'), lgForm.includes('actionLabel={undoRemoveActive')],
    [true, true],
  )

  // ---- (d) 材料の「選んで削除」 ----
  // オーナー原文「手順もそのまま一緒に選べるように見えるので、他は押せなくして
  //   グレーアウトみたいに選択できないことがわかる見た目にして。」
  eq(
    'LG-03 材料を選んでいる間は、手順の枠ごと薄くして触れなくする',
    /inert=\{ingredientOrganizing \|\| undefined\}/.test(lgForm) &&
      /ingredientOrganizing \? 'pointer-events-none opacity-40' : ''/.test(lgForm),
    true,
  )
  // オーナー原文「「選んだ材料◯件を削除」を押したら削除しました（元に戻す）旨のトースト出して。
  //   黙って消える。消えたのかも心配になる。」
  eq(
    'LG-03 まとめて削除のトーストの文言がある（件数入り）',
    typeof ja.form.ingredientOrganizeRemovedToast === 'string' &&
      ja.form.ingredientOrganizeRemovedToast.includes('{n}'),
    true,
  )
  eq(
    'LG-03 まとめて削除の確認から「元に戻せません」は落ちている（戻せるようになったため）',
    [ja.form.ingredientOrganizeConfirm, ja.form.ingredientOrganizeConfirmAll].some((t) =>
      t.includes('元に戻せません'),
    ),
    false,
  )
  eq(
    'LG-03 「残るもの」は今までどおり書いてある（規約F）',
    [
      ja.form.ingredientOrganizeConfirm.includes('残ります'),
      ja.form.ingredientOrganizeConfirmAll.includes('残ります'),
    ],
    [true, true],
  )
  // オーナー原文「「完了」を押したら黙って選択が外れる。消せたのかもと思う。」
  eq(
    'LG-03 「完了」の知らせは、消していないことを言い切る',
    typeof ja.form.ingredientOrganizeDoneToast === 'string' &&
      ja.form.ingredientOrganizeDoneToast.includes('削除していません'),
    true,
  )
  eq(
    'LG-03 「完了」の知らせは、選んでいたときだけ出す（何も選ばずに押したら黙る）',
    /const hadSelection = selectedIngredientIndexes\.length > 0/.test(lgForm) &&
      /if \(leaving && hadSelection\)/.test(lgForm),
    true,
  )

  // ---- (e) メモは「メモを追加」で開く ----
  // オーナー原文「材料メモ、手順メモは、「メモを追加」押下で初めて出る（自動などで既に入力が
  //   ある場合には開いておく）ようにして。材料が多いとスクロールが長くなるので。」
  eq('LG-03 「メモを追加」の文言がある', ja.form.addMemo, 'メモを追加')
  eq(
    'LG-03 すでに文字が入っている行は開く（取り込みで入ったメモが隠れない）',
    /const ingredientMemoOpen = \(index: number\) =>\s*\n\s*\(ingredients\[index\]\?\.memo \?\? ''\) !== '' \|\| openIngredientMemos\.includes\(index\)/.test(
      lgForm,
    ),
    true,
  )
  eq(
    'LG-03 手順も同じ決め方（片方だけ違う開き方にしない）',
    /const stepMemoOpen = \(index: number\) =>\s*\n\s*\(steps\[index\]\?\.memo \?\? ''\) !== '' \|\| openStepMemos\.includes\(index\)/.test(
      lgForm,
    ),
    true,
  )
  // オーナー原文「手順は時間の入力欄を短くすれば入るはず。」
  eq(
    'LG-03 手順の分の入力欄は、余りを全部取る書き方をやめている',
    lgForm.includes('className="w-[4.5rem] shrink-0 rounded-sm border border-edge bg-app px-2 py-2'),
    true,
  )

  // ---- (f) 「見える範囲を調整」は画像の直下 ----
  // オーナー原文「画像の「見える範囲を調整」は、画像の直ぐ下にして。」
  eq(
    'LG-03 「見える範囲を調整」は、カメラ・アルバム・アイコンの3つより前に出す',
    lgForm.indexOf('data-testid="photo-focus-open-form"') <
      lgForm.indexOf('{ja.form.photoTake}'),
    true,
  )

  // ---- (g)(h) 「前回保存した内容に戻す」の窓を作り直す ----
  // オーナー原文「「保存を押すまで保存済みのレシピは変わりません」が「変わらないもの」に
  //   書いてあるのはどういう意味？」
  eq(
    'LG-03 「変わらないもの」に画面の話とDBの話を混ぜていない',
    ja.form.resetConfirmKeptStarter.includes('保存'),
    false,
  )
  eq(
    'LG-03 DBの話は補足として別に持つ',
    typeof ja.form.resetConfirmSaveNote === 'string' &&
      ja.form.resetConfirmSaveNote.includes('保存する'),
    true,
  )
  eq(
    'LG-03 古い「戻るもの」「変わらないもの: 料理名と写真。保存を押すまで〜」は消えている',
    ['resetConfirmBack', 'resetConfirmBackLabel', 'resetConfirmKept'].filter((k) => k in ja.form),
    [],
  )
  eq(
    'LG-03 自作レシピでは「変わらないもの」を並べ立てない（規約Fの例外・ボタン名が言い切っている）',
    /resetVariant === 'own'\s*\n\s*\? undefined\s*\n\s*: \[\{ label: ja\.form\.resetConfirmKeptLabel/.test(
      lgForm,
    ),
    true,
  )
  eq(
    'LG-03 料理名と写真も前回保存した内容へ戻す（applyResetTarget＋resetToOwn）',
    [
      lgForm.includes('setTitle(target.title)'),
      /const resetToOwn = \(\) => \{[\s\S]{0,2000}setPhoto\(loadedRecipe\.photo\)[\s\S]{0,120}setPhotoFocus\(loadedRecipe\.photoFocus\)/.test(
        lgForm,
      ),
    ],
    [true, true],
  )

  // ---- トーストは操作を2つまで置ける（元に戻す＋行き先） ----
  eq(
    'LG-03 トーストは操作を2つ置ける（2つ並ぶときはボタンを次の行へ回す）',
    [lgToast.includes('linkLabel'), lgToast.includes('const stacked = hasAction && hasLink')],
    [true, true],
  )
}

// ---------- 便MW（2026-09-01・オーナー裁定★2）: 個で数える品の開き方と名札 ----------
// 司令部裁定1: 個の品は「食数の設定」（householdServings）を無視して登録の個数で開く
// （設定=3人の人が「8個」のシフォンを開くと「3個分」で開き、材料が3/8に化ける穴をふさぐ）。
// 人の品は今までどおり defaultMealServings と同じ値＝後方互換。
{
  const { detailOpenServings, isPieceUnit, servingsUnitText } = await import(
    '../../src/logic/servingsUnit.ts'
  )
  // 個の品: 設定があっても登録の個数で開く
  eq('MW-4 個の品は食数の設定(3人)を無視して8個で開く', detailOpenServings('piece', 3, 8), 8)
  eq('MW-4 個の品は設定なしでも登録の個数', detailOpenServings('piece', undefined, 8), 8)
  // 人の品（未設定含む）: 今までどおり設定が勝つ
  eq('MW-4 人の品は食数の設定(3人)で開く(従来どおり)', detailOpenServings(undefined, 3, 8), 3)
  eq('MW-4 person明示でも同じ', detailOpenServings('person', 3, 8), 3)
  eq('MW-4 人の品・設定なしは登録の人数', detailOpenServings(undefined, undefined, 4), 4)
  eq('MW-4 壊れた登録数は下限1に寄せる(defaultMealServingsと同じ)', detailOpenServings('piece', 3, 0), 1)
  // 未設定＝人（既存データの読み方）
  eq('MW-4 未設定は人扱い', isPieceUnit(undefined), false)
  eq('MW-4 pieceだけが個扱い', [isPieceUnit('piece'), isPieceUnit('person')], [true, false])

  // フォームの名札: 個の品は欄の名前が「個数」・単位が「個分」・範囲ガードも個の言い方
  eq('MW-5 フォームの欄の名前(人)', servingsUnitText(undefined).formLabel, ja.form.servingsLabel)
  eq('MW-5 フォームの欄の名前(個)は「個数」', servingsUnitText('piece').formLabel, '個数')
  eq('MW-5 フォームの単位(個)は「個分」', servingsUnitText('piece').formSuffix, '個分')
  eq('MW-5 範囲ガード(個)は個の言い方', servingsUnitText('piece').formOutOfRange.includes('個数は1〜20個分'), true)
  eq('MW-5 範囲ガード(人)は従来の文言のまま', servingsUnitText(undefined).formOutOfRange, ja.form.servingsOutOfRange)
  // 未確認の注意は、欄の呼び名（「個数」）と同じ語で場所を言う（規約H: 画面名・欄名で言う）
  eq('MW-5 未確認の注意(個)が欄の呼び名と同じ語を使う', servingsUnitText('piece').servingsUnreadNote.includes('「個数」'), true)
  eq('MW-5 取り込みの注意(個)も個の言い方', servingsUnitText('piece').formNotReadNote.includes('個分'), true)
}

// ---------- 便NB（2026-09-02・便MV申し送り「写真URLの再デコード22回」）: 一覧カードの写真URLの使い回し ----------
// Dexieのライブ購読は届くたびに新しいBlobを作る（cache 'cloned'）ので、素の usePhotoUrl だと
// 一覧に戻るたびに全カードの写真URLが作り直され、<img>が同じ写真を取得・デコードし直していた
// （実測: CPU4倍・140品・写真22品で、1往復あたり22回）。使い回しの入れ物の約束をここで見る:
//  ①同じレシピ・同じ判 → 同じURL（Blobの参照が毎回変わっても）＝<img>のsrcが変わらず再デコードしない
//  ②判が変わった（写真の差し替え）→ 新しいURL。**前のURLはその場で破棄**（解放漏れなし）
//  ③外した（drop）→ 破棄して入れ物からも消える
//  ④上限（MAX_CACHED_PHOTO_URLS）を超えたら一番使っていないものから破棄、使ったものは残る
// 破棄の確認は「そのURLで中身が読めなくなったか」を fetch で実測する（NodeはblobのURLを
// fetchでき、revoke後は必ず失敗する＝解放漏れを言葉でなく動きで観測する）
{
  const {
    acquireCachedPhotoUrl,
    peekCachedPhotoUrl,
    dropCachedPhotoUrl,
    cachedPhotoUrlCount,
    MAX_CACHED_PHOTO_URLS,
  } = await import('../../src/components/usePhotoUrl.ts')
  const nbPhoto = (text) => new Blob([text], { type: 'image/jpeg' })
  const nbReadable = async (url) => {
    try {
      await fetch(url)
      return true
    } catch {
      return false
    }
  }

  // ① 同じレシピ・同じ判なら、Blobの参照が変わっても同じURLが返る
  const nbU1 = acquireCachedPhotoUrl('nbtest:1', '100:5', nbPhoto('写真1'))
  eq(
    'NB-1 同じ鍵・同じ判は、別のBlob(Dexieの再配達)でも同じURLを返す',
    acquireCachedPhotoUrl('nbtest:1', '100:5', nbPhoto('写真1の再配達')),
    nbU1,
  )
  eq('NB-1 peekでも同じURLが見える(初回描画用)', peekCachedPhotoUrl('nbtest:1', '100:5'), nbU1)
  eq('NB-1 判が違うpeekは空(古い写真を出さない)', peekCachedPhotoUrl('nbtest:1', '999:5'), undefined)
  eq('NB-1 URLは生きている(中身が読める)', await nbReadable(nbU1), true)

  // ② 写真の差し替え(判が変わる): 新しいURLになり、前のURLはその場で破棄される
  const nbU2 = acquireCachedPhotoUrl('nbtest:1', '200:7', nbPhoto('差し替えた写真'))
  neq('NB-2 差し替えでURLが変わる(新しい写真が出る)', nbU2, nbU1)
  eq('NB-2 前のURLは破棄済み(解放漏れなし)', await nbReadable(nbU1), false)
  eq('NB-2 新しいURLは生きている', await nbReadable(nbU2), true)

  // ③ 写真を外したら破棄して入れ物からも消える
  dropCachedPhotoUrl('nbtest:1')
  eq('NB-3 dropで入れ物から消える', peekCachedPhotoUrl('nbtest:1', '200:7'), undefined)
  eq('NB-3 dropでURLも破棄される', await nbReadable(nbU2), false)

  // ④ 上限: 上限+2件入れると一番古い2件から破棄され、入れ物は上限で頭打ち
  const nbUrls = []
  for (let i = 0; i < MAX_CACHED_PHOTO_URLS + 2; i++) {
    nbUrls.push(acquireCachedPhotoUrl(`nbtest:cap${i}`, '1:1', nbPhoto(`x${i}`)))
  }
  eq('NB-4 入れ物は上限で頭打ち(写真を増やしても溜まり続けない)', cachedPhotoUrlCount(), MAX_CACHED_PHOTO_URLS)
  eq('NB-4 一番古いものから押し出される', peekCachedPhotoUrl('nbtest:cap0', '1:1'), undefined)
  eq('NB-4 押し出されたURLは破棄済み(解放漏れなし)', await nbReadable(nbUrls[0]), false)
  eq('NB-4 新しいものは生きている', await nbReadable(nbUrls[MAX_CACHED_PHOTO_URLS + 1]), true)
  // 使ったものは残る(LRU): いま一番古い cap2 を使ってから1件足すと、押し出されるのは cap3 の方
  acquireCachedPhotoUrl('nbtest:cap2', '1:1', nbPhoto('x2'))
  acquireCachedPhotoUrl('nbtest:capNew', '1:1', nbPhoto('xNew'))
  eq('NB-4 直前に使ったものは押し出されない', peekCachedPhotoUrl('nbtest:cap2', '1:1') !== undefined, true)
  eq('NB-4 代わりに一番使っていないものが押し出される', peekCachedPhotoUrl('nbtest:cap3', '1:1'), undefined)
}
