import { db } from '../db/db'
import { getSettings, updateSettings } from '../db/settings'
import {
  defaultSettings,
  type CookedLog,
  type MealPlanEntry,
  type PantryItem,
  type PriceEntry,
  type Recipe,
  type SetExclusion,
  type Settings,
  type ShoppingItem,
  type TodayListItem,
} from '../db/types'
import { buildSearchWords } from './kana'

/**
 * バックアップ: 全データ（レシピ・写真・作った記録・設定・在庫・買い物メモ・週献立・
 * 今日の献立・食材価格マスタ）を1つのJSONファイルに書き出し／読み込みする。
 * 写真はBase64（画像を文字にした形式）で埋め込む。
 * 「作った記録」の写真（cookedLogs[].photo）はファイル肥大を避けるため既定では含めない
 * （2026-07-12写真添付・docs/20 §4。exportBackup/downloadBackupの引数で明示的にONにできる）。
 */

interface BackupCookedLog extends Omit<CookedLog, 'photo'> {
  photoBase64?: string
  photoType?: string
}

interface BackupRecipe extends Omit<Recipe, 'photo' | 'cookedLogs'> {
  photoBase64?: string
  photoType?: string
  cookedLogs: BackupCookedLog[]
}

export interface BackupFile {
  app: 'uchi-recipe'
  version: 1
  exportedAt: string
  /** 配布用のレシピセットにはsettingsを含めない（個人設定の器を配布物に持たせないため） */
  settings?: Settings
  recipes: BackupRecipe[]
  /**
   * 削除した配布セット品の再取込除外記録（トゥームストーン。2026-07-13）。
   * 個人のバックアップにのみ含め、復元で除外状態も戻す。
   * この項目が無い古いバックアップも従来どおり復元できる（任意項目）
   */
  setExclusions?: Omit<SetExclusion, 'id'>[]
  /** 配布レシピセットのID・表示名・版番号（個人のバックアップファイルには無い） */
  setId?: string
  setName?: string
  setVersion?: number
  /**
   * 在庫ボード・買い物メモ・週献立・今日の献立・食材価格マスタ（2026-07-13 データ堅牢性強化）。
   * すべて任意項目＝この項目が無い古いバックアップ（この対応より前に書き出したファイル）も
   * 従来どおり復元できる（後方互換）。idは復元先で採番し直すため含めない（setExclusionsと同じ流儀）。
   * 写真（Blob）を持たないテーブルなのでrecipesのようなBase64変換は不要
   */
  pantryItems?: Omit<PantryItem, 'id'>[]
  shoppingItems?: Omit<ShoppingItem, 'id'>[]
  mealPlans?: Omit<MealPlanEntry, 'id'>[]
  todayList?: Omit<TodayListItem, 'id'>[]
  prices?: Omit<PriceEntry, 'id'>[]
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/**
 * 全データをJSON文字列にまとめる。
 * includeCookedLogPhotos: 「作った記録」の写真も含めるか（既定false。設定画面のチェックボックスで指定）
 */
export async function exportBackup(includeCookedLogPhotos = false): Promise<string> {
  const recipes = await db.recipes.toArray()
  const settings = await getSettings()
  // 再取込除外の記録（トゥームストーン）も含める（復元で除外状態も戻る。2026-07-13）。
  // idは復元先で採番し直すため含めない
  const setExclusions = (await db.setExclusions.toArray()).map(({ id: _unused, ...rest }) => rest)
  // 在庫ボード・買い物メモ・週献立・今日の献立・食材価格マスタ（2026-07-13 データ堅牢性強化）。
  // 端末移行でこれらが失われていた問題への対応。いずれもidを除いて保存する（復元先で振り直す）
  const pantryItems = (await db.pantryItems.toArray()).map(({ id: _unused, ...rest }) => rest)
  const shoppingItems = (await db.shoppingItems.toArray()).map(({ id: _unused, ...rest }) => rest)
  const mealPlans = (await db.mealPlans.toArray()).map(({ id: _unused, ...rest }) => rest)
  const todayList = (await db.todayList.toArray()).map(({ id: _unused, ...rest }) => rest)
  const prices = (await db.prices.toArray()).map(({ id: _unused, ...rest }) => rest)
  const backupRecipes: BackupRecipe[] = await Promise.all(
    recipes.map(async ({ photo, cookedLogs, ...rest }) => ({
      ...rest,
      photoBase64: photo ? await blobToBase64(photo) : undefined,
      photoType: photo?.type || undefined,
      cookedLogs: await Promise.all(
        cookedLogs.map(async ({ photo: logPhoto, ...logRest }) => ({
          ...logRest,
          photoBase64:
            includeCookedLogPhotos && logPhoto ? await blobToBase64(logPhoto) : undefined,
          photoType: includeCookedLogPhotos && logPhoto ? logPhoto.type || undefined : undefined,
        })),
      ),
    })),
  )
  const file: BackupFile = {
    app: 'uchi-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    settings,
    recipes: backupRecipes,
    setExclusions,
    pantryItems,
    shoppingItems,
    mealPlans,
    todayList,
    prices,
  }
  return JSON.stringify(file)
}

/** JSONをファイルとしてダウンロードし、最終バックアップ日時を記録する */
export async function downloadBackup(includeCookedLogPhotos = false): Promise<void> {
  const json = await exportBackup(includeCookedLogPhotos)
  const date = new Date()
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `uchi-recipe-backup-${stamp}.json`
  anchor.click()
  URL.revokeObjectURL(url)
  await updateSettings({ lastBackupAt: Date.now() })
}

/** バックアップファイルを検証して読み込む。壊れていたら例外 */
export function parseBackup(json: string): BackupFile {
  const data = JSON.parse(json) as Partial<BackupFile>
  if (data.app !== 'uchi-recipe' || !Array.isArray(data.recipes)) {
    throw new Error('invalid backup file')
  }
  return data as BackupFile
}

/**
 * バックアップに在庫・買い物メモ・週献立・今日の献立・食材価格マスタの各フィールドが
 * 「有るか（=復元時に置き換え対象か）」を判定する（純ロジック・DB非依存。2026-07-13）。
 * undefined（この対応より前の古いバックアップ。項目自体が無い）は false＝そのテーブルは
 * 復元時に一切触らない（clearしない）のが後方互換の要。空配列[]（テーブルを空にする意図）は
 * true＝置き換え対象として扱う。この区別がないと「空配列」と「未対応の古い形式」を混同し、
 * 古いバックアップを復元しただけで在庫等が消えてしまう事故になる
 */
export function tablesToReplace(file: BackupFile): {
  pantryItems: boolean
  shoppingItems: boolean
  mealPlans: boolean
  todayList: boolean
  prices: boolean
} {
  return {
    pantryItems: file.pantryItems !== undefined,
    shoppingItems: file.shoppingItems !== undefined,
    mealPlans: file.mealPlans !== undefined,
    todayList: file.todayList !== undefined,
    prices: file.prices !== undefined,
  }
}

/** 'replace' 用: id を振り直さず、そのままの内容で取り込む */
function toRecipe(backup: BackupRecipe): Recipe {
  const { photoBase64, photoType, cookedLogs, ...rest } = backup
  const recipe: Recipe = {
    ...rest,
    cookedLogs: cookedLogs.map(({ photoBase64: logBase64, photoType: logType, ...logRest }) => {
      const log: CookedLog = { ...logRest }
      if (logBase64) log.photo = base64ToBlob(logBase64, logType || 'image/jpeg')
      return log
    }),
  }
  if (photoBase64) {
    recipe.photo = base64ToBlob(photoBase64, photoType || 'image/jpeg')
  }
  return recipe
}

export interface ImportResult {
  /** 新規に追加したレシピ数 */
  added: number
  /**
   * 内容を更新したレシピ数（同一セットの再取込で中身が変わっていた分。
   * importBackupでは常に0=更新の概念が無い。2026-07-12）
   */
  updated: number
  /** 既存と重複していたため取り込まなかったレシピ数（merge時のみ発生） */
  skipped: number
  /**
   * 削除済み（再取込除外の記録あり）のため取り込まなかったレシピ数
   * （importRecipeSetのみ発生。importBackupでは常に0。2026-07-13トゥームストーン）
   */
  excluded: number
}

/**
 * バックアップを取り込む。
 * mode 'replace': 今のデータを全部消してから復元（引っ越し・復旧向け）
 * mode 'merge'  : 今のデータは残し、バックアップのレシピを id で照合して取り込む。
 *   - 同一ID・同一内容 → スキップ（すでに入っている）
 *   - 同一ID・内容が違う → 取り込まずスキップ（今のデータを優先。上書きしない）
 *   - 新規ID → 追加
 */
export async function importBackup(
  file: BackupFile,
  mode: 'replace' | 'merge',
): Promise<ImportResult> {
  const recipes = file.recipes.map(toRecipe)

  // バックアップ内の再取込除外記録（トゥームストーン。2026-07-13）。無い古いバックアップは空扱い。
  // 手作業で編集されたファイルにも耐えるよう、setId/titleの無い行は捨てて正規化する
  const backupExclusions: SetExclusion[] = (file.setExclusions ?? [])
    .filter((e) => !!e && typeof e.setId === 'string' && !!e.setId && typeof e.title === 'string' && !!e.title)
    .map((e) => ({ setId: e.setId, title: e.title, excludedAt: e.excludedAt ?? Date.now() }))

  if (mode === 'replace') {
    // 在庫・買い物メモ・週献立・今日の献立・食材価格マスタ（2026-07-13 データ堅牢性強化）。
    // フィールドが無い古いバックアップを復元してもそのテーブルは触らない（clearしない）のが
    // 後方互換の要。tablesToReplaceがundefined(=無い)と空配列[](=空にする意図)を区別する
    const replace = tablesToReplace(file)
    await db.transaction(
      'rw',
      [
        db.recipes,
        db.settings,
        db.setExclusions,
        db.pantryItems,
        db.shoppingItems,
        db.mealPlans,
        db.todayList,
        db.prices,
      ],
      async () => {
        await db.recipes.clear()
        // 設定も復元。基本レシピの二重投入を防ぐため starterSeeded は必ず true にする
        await db.settings.put({
          ...defaultSettings,
          ...file.settings,
          id: 1,
          starterSeeded: true,
        })
        await db.recipes.bulkAdd(recipes)
        // 再取込除外の記録も置き換える（復元で除外状態も戻る。
        // 記録の無い古いバックアップでは空になるだけで、復元自体は従来どおり成功する）
        await db.setExclusions.clear()
        if (backupExclusions.length > 0) await db.setExclusions.bulkAdd(backupExclusions)

        if (replace.pantryItems) {
          await db.pantryItems.clear()
          if (file.pantryItems!.length > 0) await db.pantryItems.bulkAdd(file.pantryItems!)
        }
        if (replace.shoppingItems) {
          await db.shoppingItems.clear()
          if (file.shoppingItems!.length > 0) await db.shoppingItems.bulkAdd(file.shoppingItems!)
        }
        if (replace.mealPlans) {
          await db.mealPlans.clear()
          if (file.mealPlans!.length > 0) await db.mealPlans.bulkAdd(file.mealPlans!)
        }
        if (replace.todayList) {
          await db.todayList.clear()
          if (file.todayList!.length > 0) await db.todayList.bulkAdd(file.todayList!)
        }
        if (replace.prices) {
          await db.prices.clear()
          if (file.prices!.length > 0) await db.prices.bulkAdd(file.prices!)
        }
      },
    )
    return { added: recipes.length, updated: 0, skipped: 0, excluded: 0 }
  }

  // merge: 1件ずつ id で照合する
  let added = 0
  let skipped = 0
  await db.transaction('rw', db.recipes, db.setExclusions, async () => {
    for (const recipe of recipes) {
      if (recipe.id == null) {
        // 古い形式などIDが無い場合は照合できないので新規として追加
        const { id: _unused, ...rest } = recipe
        await db.recipes.add(rest as Recipe)
        added++
        continue
      }
      const existing = await db.recipes.get(recipe.id)
      if (!existing) {
        await db.recipes.add(recipe) // 同じIDのまま追加（次回以降も照合できるように）
        added++
      } else {
        // 同一IDが既にある: 内容が同じでも違ってもスキップ（今のデータを優先）
        skipped++
      }
    }
    // 再取込除外の記録は (setId, title) で照合し、無いものだけ追加する（今の記録は消さない）
    if (backupExclusions.length > 0) {
      const existingKeys = new Set(
        (await db.setExclusions.toArray()).map((e) => `${e.setId}\n${e.title}`),
      )
      for (const exclusion of backupExclusions) {
        const key = `${exclusion.setId}\n${exclusion.title}`
        if (existingKeys.has(key)) continue
        existingKeys.add(key)
        await db.setExclusions.add(exclusion)
      }
    }
  })
  return { added, updated: 0, skipped, excluded: 0 }
}

/** URLが見つからない・壊れている場合の理由を、呼び出し側が文言を出し分けられるよう表す */
export class RecipeSetFetchError extends Error {
  reason: 'not_found' | 'invalid'
  constructor(reason: 'not_found' | 'invalid') {
    super(reason)
    this.reason = reason
  }
}

/** URLからレシピセットのJSON（バックアップと同形式）を取得する。配布元がCORSに対応していないと失敗する */
export async function fetchRecipeSet(url: string): Promise<BackupFile> {
  const res = await fetch(url)
  if (!res.ok) throw new RecipeSetFetchError('not_found')
  const text = await res.text()
  try {
    return parseBackup(text)
  } catch {
    // 開発サーバー(Vite)はSPAのため、存在しないURLでも200＋アプリ本体のHTMLを返す
    // （実在しないset=IDを開いたときに気づきにくい・2026-07-12オーナー実機報告で発覚）。
    // 本文がHTMLなら「見つからない」寄りの文言、それ以外は「壊れている」寄りの文言にする
    throw new RecipeSetFetchError(text.trim().startsWith('<') ? 'not_found' : 'invalid')
  }
}

/**
 * レシピ削除時に残す「再取込除外」の記録（トゥームストーン）を作る（純ロジック・DB非依存。
 * 2026-07-13 Fable設計）。配布セット由来（sourceSetIdあり）のレシピだけが対象で、
 * 自作レシピなど sourceSetId の無いレシピは null（記録しない）
 */
export function exclusionRecordFor(
  recipe: Pick<Recipe, 'sourceSetId' | 'title'>,
): Pick<SetExclusion, 'setId' | 'title'> | null {
  if (!recipe.sourceSetId) return null
  return { setId: recipe.sourceSetId, title: recipe.title.trim() }
}

/**
 * 除外記録の一覧から「このセットで取り込まない料理名」の集合を作る（純ロジック・DB非依存）。
 * importRecipeSet が新規追加の直前に照合する。setId の無いファイル（個人バックアップ形式など）は
 * 除外の対象外＝空集合。記録を消した後（「すべて戻す」後）は集合に入らないので、次の取込で復活する
 */
export function buildExclusionTitleSet(
  exclusions: readonly Pick<SetExclusion, 'setId' | 'title'>[],
  setId: string | undefined,
): Set<string> {
  if (!setId) return new Set()
  return new Set(exclusions.filter((e) => e.setId === setId).map((e) => e.title.trim()))
}

/**
 * 配布セット取り込み時、料理名が既存レシピと重複した場合にどう扱うか決める（純ロジック・DB非依存）。
 * - 既存レシピが「同じ配布セット」由来（sourceSetIdが一致）→ 'updateName'
 *   （セット側の表示名（テーマ名）が変わっていたら、レシピを増やさずsourceSetNameだけ追従させる。
 *   バッチH-1: kintoreテーマ改名時、旧名称バッジのまま残ってしまう不具合の再発防止）
 * - それ以外（個人登録・別セット由来・setId不明）→ 'skip'（既存を優先し何もしない。従来どおり）
 */
export function resolveDuplicateTitleAction(
  existingSourceSetId: string | undefined,
  incomingSetId: string | undefined,
): 'skip' | 'updateName' {
  if (incomingSetId !== undefined && existingSourceSetId === incomingSetId) return 'updateName'
  return 'skip'
}

/** importRecipeSetの更新（再取込）で書き換える「セットの中身」フィールド */
type RecipeSetContent = Pick<
  Recipe,
  | 'servings'
  | 'cookMinutes'
  | 'effortLevel'
  | 'tags'
  | 'dishType'
  | 'season'
  | 'suitableFor'
  | 'ingredients'
  | 'steps'
  | 'quickSteps'
  | 'memo'
  | 'sourceUrl'
  | 'keywords'
>

/**
 * 同一セット由来の再取込（resolveDuplicateTitleActionが'updateName'を返すケース）で、
 * 既存レシピの内容を更新した結果を返す（純ロジック・DB非依存）。
 * 更新: servings/cookMinutes/effortLevel/tags/dishType/season/suitableFor/ingredients/steps/
 *       quickSteps/memo/sourceUrl/keywords/sourceSetName + searchWords・updatedAt
 * 保持: 上記以外すべて（id・createdAt・isFavorite・cookedLogs・photo・isStarter・iconKey等の
 *       ユーザーデータ・表示設定。existingをベースに更新フィールドだけ上書きするため自動的に保持される）
 * 内容が完全に同一（sourceSetName込み）なら null を返す（呼び出し側はスキップ扱いにする。
 * 修正の無い再取込のたびに「更新しました」と出るノイズを防ぐため）
 */
export function buildUpdatedSetRecipe(
  existing: Recipe,
  incoming: RecipeSetContent,
  setName: string | undefined,
  now: number = Date.now(),
): Recipe | null {
  const content = (source: RecipeSetContent, sourceSetName: string | undefined) =>
    JSON.stringify({
      servings: source.servings,
      cookMinutes: source.cookMinutes,
      effortLevel: source.effortLevel,
      tags: source.tags,
      dishType: source.dishType,
      season: source.season,
      suitableFor: source.suitableFor,
      ingredients: source.ingredients,
      steps: source.steps,
      quickSteps: source.quickSteps,
      memo: source.memo,
      sourceUrl: source.sourceUrl,
      keywords: source.keywords,
      sourceSetName,
    })
  if (content(existing, existing.sourceSetName) === content(incoming, setName)) return null

  return {
    ...existing,
    servings: incoming.servings,
    cookMinutes: incoming.cookMinutes,
    effortLevel: incoming.effortLevel,
    tags: incoming.tags,
    dishType: incoming.dishType,
    season: incoming.season,
    suitableFor: incoming.suitableFor,
    ingredients: incoming.ingredients,
    steps: incoming.steps,
    quickSteps: incoming.quickSteps,
    memo: incoming.memo,
    sourceUrl: incoming.sourceUrl,
    keywords: incoming.keywords,
    sourceSetName: setName,
    searchWords: buildSearchWords(existing.title, incoming.ingredients, incoming.tags, incoming.keywords),
    updatedAt: now,
  }
}

/**
 * 配布されているレシピセット（バックアップと同形式のJSON）を追加で読み込む。
 * 個人のバックアップ復元(importBackup)とは別物:
 * - idは信用せず振り直す（配布元と自分のIDが衝突する可能性があるため）
 * - 読み込んだレシピはisStarter扱いにする（無料版の件数制限に含めない）
 * - 重複判定はidではなく料理名（完全一致）で行う
 * - settingsは取り込まない（配布元の設定で自分の設定を上書きしないため）
 * - 同一セットの再取込（修正版JSONの配信・テーマ改名など）では重複させず、既存レシピの内容を
 *   更新する（resolveDuplicateTitleAction参照。buildUpdatedSetRecipeでユーザーデータを保持）
 * - ユーザーが削除した品（setExclusionsに記録あり）は追加しない（再取込で復活させない。
 *   excludedカウントで件数を返す。2026-07-13トゥームストーン）
 */
export async function importRecipeSet(file: BackupFile): Promise<ImportResult> {
  let added = 0
  let updated = 0
  let skipped = 0
  let excluded = 0
  await db.transaction('rw', db.recipes, db.setExclusions, async () => {
    const existingByTitle = new Map(
      (await db.recipes.toArray()).map((r) => [r.title.trim(), r] as const),
    )
    // 削除済みの品（トゥームストーン）は再取込で復活させない（2026-07-13 Fable設計）
    const excludedTitles = buildExclusionTitleSet(await db.setExclusions.toArray(), file.setId)
    for (const backupRecipe of file.recipes) {
      const { id: _unused, ...rest } = toRecipe(backupRecipe)
      const title = rest.title.trim()
      const existing = existingByTitle.get(title)
      if (existing) {
        const action = resolveDuplicateTitleAction(existing.sourceSetId, file.setId)
        if (action === 'updateName') {
          const mergedRecipe = buildUpdatedSetRecipe(existing, rest, file.setName)
          if (mergedRecipe) {
            // 内容を丸ごと差し替えるため.update()の部分更新ではなく.put()で置き換える
            // (Dexieの.update()はUpdateSpec<Recipe>型の推論がフルのRecipeオブジェクトだと
            // 通らないTS上の制約もあるが、意味的にも「内容を丸ごと更新」には.putが適切)
            await db.recipes.put(mergedRecipe)
            existingByTitle.set(title, mergedRecipe)
            updated++
            continue
          }
        }
        skipped++
        continue
      }
      if (excludedTitles.has(title)) {
        // ユーザーが削除した品。新規追加だけをブロックする（既存レシピの更新・スキップには影響しない）
        excluded++
        continue
      }
      const now = Date.now()
      const newRecipe: Recipe = {
        ...rest,
        isStarter: true,
        sourceSetId: file.setId,
        sourceSetName: file.setName,
        searchWords: buildSearchWords(rest.title, rest.ingredients, rest.tags, rest.keywords),
        createdAt: now,
        updatedAt: now,
      }
      await db.recipes.add(newRecipe)
      existingByTitle.set(title, newRecipe)
      added++
    }
  })
  return { added, updated, skipped, excluded }
}

/** 30日以上バックアップしていない（または一度もしていない）か */
export function backupOverdue(lastBackupAt: number | undefined): boolean {
  if (lastBackupAt === undefined) return true
  return Date.now() - lastBackupAt > 30 * 24 * 60 * 60 * 1000
}
