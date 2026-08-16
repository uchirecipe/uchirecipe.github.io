import { db } from '../db/db'
import { getSettings, updateSettings } from '../db/settings'
import {
  defaultSettings,
  type CookedLog,
  type DayNote,
  type DetachedCookedRecord,
  type MealPlanEntry,
  type MealPlanLock,
  type MealTemplate,
  type PantryItem,
  type PriceEntry,
  type Recipe,
  type SetExclusion,
  type Settings,
  type ShoppingItem,
  type TodayListItem,
} from '../db/types'
import { buildSearchWords } from './kana'
import { backupFileName } from './fileSave'
import { formatFileSize } from './fileSize'
import type { ConfirmContent } from './confirmContent'
import { clearCookNaviSession } from './cookNaviSession'
import { mergeCookedLogLists } from './detachedLogs'
import { reattachDetachedLogs } from '../db/detachedLogs'
import { ja } from '../i18n/ja'

/**
 * バックアップ: 全データ（レシピ・写真・作った記録・設定・在庫・買い物メモ・週献立・
 * 今日の献立・食材価格マスタ）を1つのJSONファイルに書き出し／読み込みする。
 * 写真はBase64（画像を文字にした形式）で埋め込む。
 * 「作った記録」の写真（cookedLogs[].photo）はファイル肥大を避けるため既定では含めない
 * （2026-07-12写真添付・docs/20 §4。exportBackup/downloadBackupの引数で明示的にONにできる）。
 *
 * settings（Pro・追加レシピパックの解錠コード=proCode/recipePackCode込み）は個人のバックアップ
 * には常に含まれる（exportBackupがgetSettings()の全項目をそのまま入れるため）。復元は
 * replace（settings全体を置き換え）・merge（mergeUnlockCodes参照。解錠コードだけを
 * 「バックアップにあれば設定、無ければ既存を保持」で復元）の両方に対応する
 * （2026-07-17バックアップ改修 修正1・オーナー実害「ブラウザデータ消去→復元しても購入状態が
 * 戻らない」の再発防止）。配布用のレシピセット（importRecipeSet）は別経路でsettingsを
 * 一切参照しないため、配布物に購入コードが混入する余地はない
 *
 * merge（「今のデータに追加」）は非破壊マージ（2026-07-30 便CJ/C1）。今あるデータは1件も
 * 消さず・上書きせず、「今のデータに無いもの」だけを足す。対象はレシピ本体だけでなく、
 * 在庫・買い物メモ・週献立・今日の献立・食材価格マスタ・日付メモ・マイ献立テンプレの7テーブルと、
 * 既にあるレシピに紐づく「作った記録」・お気に入り・写真も含む（mergeTableRows /
 * mergeRecipeUserData / resolveMergeRecipeAction 参照）。以前はレシピ本体と解錠コードしか
 * 見ておらず、まっさらな端末（同梱の基本レシピが必ずID衝突する）へ読み込むと基本レシピの
 * 記録・写真・お気に入りと7テーブルが1件も戻らないまま「追加◯件・スキップ◯件」と
 * 成功風に表示されていた
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

/**
 * レシピを削除しても残した「作った記録」のまとまり（2026-08-16 便GZ）。
 * idは復元先で振り直すため含めない（他のテーブルと同じ流儀）。
 * recipeUid（レシピを一意に指す印）を必ず持ち回るのが要点で、これがファイルに入っているから
 * 「同じレシピを入れ直したらつながりが戻る」が成り立つ。
 */
interface BackupDetachedRecord extends Omit<DetachedCookedRecord, 'id' | 'logs'> {
  logs: BackupCookedLog[]
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
  /**
   * 日付メモ（2026-07-29 便CB-1・docs/59 A-2）。他のテーブルと違い主キーが日付そのものなので、
   * idを外さずそのまま入れる。これも任意項目＝この項目が無い古いバックアップも従来どおり復元できる
   */
  dayNotes?: DayNote[]
  /**
   * マイ献立テンプレ（2026-07-29 便CB-2・docs/59 A-1＋B-2）。端末内保存なので、端末移行で
   * 失わせないためにバックアップへ含める（日付メモ＝便CB-1と同じ扱い）。idは復元先で
   * 採番し直すため含めない。これも任意項目＝この項目が無い古いバックアップも従来どおり復元できる
   */
  mealTemplates?: Omit<MealTemplate, 'id'>[]
  /**
   * 献立のロック（2026-08-08 便DX）。端末内保存なので、端末移行で鍵が全部外れないように
   * バックアップへ含める（日付メモ＝便CB-1と同じ扱い）。主キーが '日付|食事' の文字列
   * そのものなので、idを外さずそのまま入れる。これも任意項目＝この項目が無い古いバックアップも
   * 従来どおり復元できる
   */
  mealPlanLocks?: MealPlanLock[]
  /**
   * レシピを削除しても残した「作った記録」（2026-08-16 便GZ）。端末内保存なので、
   * 端末移行でこれだけが失われないようバックアップへ含める（日付メモ＝便CB-1と同じ扱い）。
   * これも任意項目＝この項目が無い古いバックアップも従来どおり復元できる。
   * 記録の写真は cookedLogs と同じく includeCookedLogPhotos が true のときだけ入れる
   * （ファイルが重くなるのを避ける既定を、残した記録でも変えない）
   */
  detachedLogs?: BackupDetachedRecord[]
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

/** 「作った記録」1件をバックアップの形（写真はBase64）に変換する */
async function toBackupCookedLogs(
  logs: readonly CookedLog[],
  includeCookedLogPhotos: boolean,
): Promise<BackupCookedLog[]> {
  return Promise.all(
    logs.map(async ({ photo: logPhoto, ...logRest }) => ({
      ...logRest,
      photoBase64: includeCookedLogPhotos && logPhoto ? await blobToBase64(logPhoto) : undefined,
      photoType: includeCookedLogPhotos && logPhoto ? logPhoto.type || undefined : undefined,
    })),
  )
}

/** レシピ1品をバックアップの形（写真はBase64）に変換する。全体・選択どちらの書き出しでも使う */
async function toBackupRecipe(recipe: Recipe, includeCookedLogPhotos: boolean): Promise<BackupRecipe> {
  const { photo, cookedLogs, ...rest } = recipe
  return {
    ...rest,
    photoBase64: photo ? await blobToBase64(photo) : undefined,
    photoType: photo?.type || undefined,
    cookedLogs: await toBackupCookedLogs(cookedLogs, includeCookedLogPhotos),
  }
}

/** 「レシピの無い記録」1まとまりをバックアップの形にする（2026-08-16 便GZ） */
async function toBackupDetached(
  record: DetachedCookedRecord,
  includeCookedLogPhotos: boolean,
): Promise<BackupDetachedRecord> {
  const { id: _unused, logs, ...rest } = record
  return { ...rest, logs: await toBackupCookedLogs(logs, includeCookedLogPhotos) }
}

/** バックアップの形の「レシピの無い記録」を端末に保存する形（写真はBlob）へ戻す */
function toDetachedRecord(backup: BackupDetachedRecord): Omit<DetachedCookedRecord, 'id'> {
  return {
    ...backup,
    logs: backup.logs.map(({ photoBase64, photoType, ...logRest }) => {
      const log: CookedLog = { ...logRest }
      if (photoBase64) log.photo = base64ToBlob(photoBase64, photoType || 'image/jpeg')
      return log
    }),
  }
}

/**
 * 手で編集されたファイル・別経路で作られたファイルにも耐えるよう、
 * 「レシピの無い記録」の行を正規化する（日付の形をしていない記録・料理名の無い行は捨てる）。
 * 捨てた分は復元件数に出ないだけで、他の行の復元は従来どおり続く。
 */
function normalizeBackupDetached(
  rows: readonly BackupDetachedRecord[] | undefined,
): Omit<DetachedCookedRecord, 'id'>[] {
  if (!rows) return []
  const out: Omit<DetachedCookedRecord, 'id'>[] = []
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue
    const title = typeof row.title === 'string' ? row.title.trim() : ''
    if (!title || !Array.isArray(row.logs)) continue
    const record = toDetachedRecord(row)
    const logs = record.logs.filter((log) => /^\d{4}-\d{2}-\d{2}$/.test(log?.date ?? ''))
    if (logs.length === 0) continue
    out.push({
      ...record,
      title,
      recipeUid: typeof row.recipeUid === 'string' && row.recipeUid ? row.recipeUid : undefined,
      detachedAt: typeof row.detachedAt === 'number' ? row.detachedAt : Date.now(),
      logs,
    })
  }
  return out
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
  // 日付メモ（便CB-1）。主キーが日付そのものなのでidを外す処理は無く、そのまま入れる
  const dayNotes = await db.dayNotes.toArray()
  // マイ献立テンプレ（便CB-2）。他のテーブルと同じくidを除いて保存する（復元先で振り直す）
  const mealTemplates = (await db.mealTemplates.toArray()).map(({ id: _unused, ...rest }) => rest)
  // 献立のロック（便DX）。日付メモと同じく主キーが文字列そのものなので、そのまま入れる
  const mealPlanLocks = await db.mealPlanLocks.toArray()
  // レシピを削除しても残した「作った記録」（便GZ）。ここを含めないと、レシピを消したあとの
  // 記録だけが端末移行で失われる。記録の写真の扱いはレシピ側の記録と同じ既定にそろえる
  const detachedLogs = await Promise.all(
    (await db.detachedLogs.toArray()).map((r) => toBackupDetached(r, includeCookedLogPhotos)),
  )
  const backupRecipes: BackupRecipe[] = await Promise.all(
    recipes.map((recipe) => toBackupRecipe(recipe, includeCookedLogPhotos)),
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
    dayNotes,
    mealTemplates,
    mealPlanLocks,
    detachedLogs,
  }
  return JSON.stringify(file)
}

/**
 * 選んだレシピだけをJSON文字列にまとめる（2026-08-09 便EM。2026-08-02 オーナー決定
 * 「バックアップの内容分割は見送り・選択レシピの書き出しが代替」の実装）。
 *
 * 書式はバックアップと同じ（BackupFile）なので、設定の「バックアップを読み込む」から
 * そのまま読み込める。全体のバックアップと違うのは中身の範囲だけ:
 * - recipes … 選んだ品だけ。レシピの写真は含める（exportBackup と同じ作法）。
 *   「作った記録」はレシピに埋め込まれた配列なのでそのまま入り、記録の写真は既定で含めない
 *   （includeCookedLogPhotos。ファイルが重くなるのを避ける既定も exportBackup と同じ）
 * - settings … **含めない**。全体のバックアップではないので個人設定の器を持たせない。
 *   Pro解錠コードを持ち出さないという配布用レシピセット（importRecipeSet）と同じ考え方
 * - 在庫・買い物メモ・献立・価格・日付メモ・テンプレ・ロック … 含めない（項目自体を置かない）。
 *   tablesToReplace が「項目が無ければ触らない」を保証するので、このファイルを
 *   「データを上書き」で読んでも、これらのテーブルは1件も消えない
 *
 * 存在しないID（選んだ直後に別の場所で消された等）は黙って飛ばし、実際に入った品数を返す。
 */
export async function exportSelectedRecipes(
  ids: readonly number[],
  includeCookedLogPhotos = false,
): Promise<{ json: string; count: number }> {
  const found = (await db.recipes.bulkGet([...ids])).filter((r): r is Recipe => r != null)
  const recipes = await Promise.all(found.map((r) => toBackupRecipe(r, includeCookedLogPhotos)))
  const file: BackupFile = {
    app: 'uchi-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes,
  }
  return { json: JSON.stringify(file), count: recipes.length }
}

/** 確認の窓に出す箇条書き1行（labelは太字の見出し、textはその中身） */
export interface ExportConfirmBullet {
  label: string
  text: string
}

/** 「選択したレシピの書き出し」の確認の中身（見出し・箇条書き・補足） */
export interface SelectedRecipesExportConfirm {
  title: string
  bullets: ExportConfirmBullet[]
  /** 箇条書きの下に小さめの文字で出す補足 */
  notes: string[]
}

/**
 * 「選択したレシピの書き出し」の確認の中身（純ロジック・DB非依存。2026-08-09 便EM →
 * 2026-08-15 便GVで素のダイアログから画面の中の窓へ移し、箇条書きの形にした）。
 *
 * 規約F: 何が入り、何が入らないかを件数つきで両方書く。文言そのものは src/i18n/ja.ts が持ち、
 * ここは件数・大きさの差し込みと、保存先の言い分けだけを行う（scripts/test-logic.mjs で固定する）。
 *
 * bytes は**実際に作ったJSONのバイト数**を渡すこと（見積りを渡さない）。
 * canPickLocation は保存先を選べる端末か（logic/fileSave.ts の supportsSaveFilePicker の結果）。
 * 選べない端末（iPhone・iPad・Firefox等）で「選べます」と書かないための分岐で、
 * 設定のバックアップ書き出しが完了の知らせを経路ごとに分けているのと同じ作法。
 */
export function buildSelectedRecipesExportConfirm(params: {
  selected: number
  remaining: number
  bytes: number
  canPickLocation: boolean
}): SelectedRecipesExportConfirm {
  const t = ja.recipes
  return {
    title: t.exportSelectedConfirmTitle.replace('{r}', String(params.selected)),
    bullets: [
      { label: t.exportSelectedConfirmIncludeLabel, text: t.exportSelectedConfirmIncludeText },
      {
        label: t.exportSelectedConfirmExcludeLabel,
        text: t.exportSelectedConfirmExcludeText.replace('{rest}', String(params.remaining)),
      },
      {
        label: t.exportSelectedConfirmSizeLabel,
        text: t.exportSelectedConfirmSizeText.replace('{size}', formatFileSize(params.bytes)),
      },
      {
        label: t.exportSelectedConfirmSaveToLabel,
        text: params.canPickLocation
          ? t.exportSelectedConfirmSaveToPick
          : t.exportSelectedConfirmSaveToDownload,
      },
    ],
    notes: [
      t.exportSelectedConfirmNoteKept,
      t.exportSelectedConfirmNoteShare,
      t.exportSelectedConfirmNoteRestore,
    ],
  }
}

/** JSONをファイルとしてダウンロードし、最終バックアップ日時を記録する */
export async function downloadBackup(includeCookedLogPhotos = false): Promise<void> {
  const json = await exportBackup(includeCookedLogPhotos)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = backupFileName()
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
  dayNotes: boolean
  mealTemplates: boolean
  mealPlanLocks: boolean
  detachedLogs: boolean
} {
  return {
    pantryItems: file.pantryItems !== undefined,
    shoppingItems: file.shoppingItems !== undefined,
    mealPlans: file.mealPlans !== undefined,
    todayList: file.todayList !== undefined,
    prices: file.prices !== undefined,
    // 日付メモ（2026-07-29 便CB-1）。この項目を持たない古いバックアップ（=undefined）は
    // 復元時にdayNotesテーブルへ一切触らない＝既存のメモを消さない（他テーブルと同じ後方互換）
    dayNotes: file.dayNotes !== undefined,
    // マイ献立テンプレ（2026-07-29 便CB-2）。日付メモと同じ後方互換のルール
    mealTemplates: file.mealTemplates !== undefined,
    // 献立のロック（2026-08-08 便DX）。日付メモと同じ後方互換のルール
    mealPlanLocks: file.mealPlanLocks !== undefined,
    // レシピを削除しても残した「作った記録」（2026-08-16 便GZ）。日付メモと同じ後方互換のルール。
    // **この項目を持たない古いバックアップを上書きで読んでも、残した記録は1件も消えない**
    // （項目が無い＝そのテーブルに触らない）。古いファイルに「記録が入っていないから」という
    // 理由で今の端末の記録を消すのは、バックアップの目的そのものを壊すため
    detachedLogs: file.detachedLogs !== undefined,
  }
}

/**
 * 「データを上書き」（旧「読み込む（今のデータと置き換え）」）で消える件数（純ロジック・DB非依存。
 * 2026-07-17設定ゼロベース裁定#6a）。確認文に「今のレシピ◯件・作った記録◯件・価格◯件が
 * 消えます」と具体的な件数を明示するために使う（app/CLAUDE.md規約F: 破壊的操作の確認文は
 * 何が消えるかを具体的に書く）。作った記録はレシピに埋め込み配列なので、全レシピの
 * cookedLogs.lengthを合算する
 */
export interface ReplaceImpactCounts {
  recipes: number
  cookedLogs: number
  prices: number
}

export function countReplaceImpact(
  recipes: Pick<Recipe, 'cookedLogs'>[],
  priceCount: number,
  /**
   * レシピを削除しても残っている「作った記録」（2026-08-16 便GZ）。上書きではこれも
   * ファイルの内容へ置き換わるので、確認文の「消える記録の件数」に必ず足す
   * （数え漏らすと、画面が言った件数より多く消える＝規約Fが守れない）
   */
  detachedRecords: readonly { logs: readonly unknown[] }[] = [],
): ReplaceImpactCounts {
  return {
    recipes: recipes.length,
    cookedLogs:
      recipes.reduce((sum, r) => sum + r.cookedLogs.length, 0) +
      detachedRecords.reduce((sum, r) => sum + r.logs.length, 0),
    prices: priceCount,
  }
}

/**
 * 「消えるもの」の末尾に、並行調理ナビの段取りを足す（純ロジック・DB非依存。2026-08-15 便GP）。
 * 覚え書きが残っていない（selectedCount=0）ときは何も足さない＝消えないものを「消えます」と
 * 書かない（docs/69「捨てたときは失うものがある場合だけ知らせる」）
 */
function fillCookNaviNote(text: string, cookNaviSelectedCount: number): string {
  return text.replace(
    '{navi}',
    cookNaviSelectedCount > 0
      ? ja.settings.replaceCookNaviNote.replace('{n}', String(cookNaviSelectedCount))
      : '',
  )
}

/**
 * 「データを上書き」の確認の中身（純ロジック・DB非依存。2026-07-17設定ゼロベース裁定#6a →
 * 2026-08-15 便GPで消えるものを数え直し、便GWで画面の中の窓の形にした）。
 * ファイル選択を開く前(pickImportFile)・ファイル選択後の最終確認(onImportFile)の両方で
 * 同じ中身を使い整合させる。cookNaviSelectedCount=並行調理ナビで選んでいる品数（0なら段取りは出ない）
 */
export function buildReplaceConfirm(
  impact: ReplaceImpactCounts,
  cookNaviSelectedCount = 0,
): ConfirmContent {
  const t = ja.settings
  return {
    title: t.backupImportReplaceTitle,
    bullets: [
      {
        label: t.backupImportReplaceGoneLabel,
        text: fillCookNaviNote(
          t.backupImportReplaceGone
            .replace('{r}', String(impact.recipes))
            .replace('{c}', String(impact.cookedLogs))
            .replace('{p}', String(impact.prices)),
          cookNaviSelectedCount,
        ),
      },
      { label: t.backupImportReplaceSwapLabel, text: t.backupImportReplaceSwap },
      { label: t.backupImportReplaceKeptLabel, text: t.backupImportReplaceKept },
    ],
    notes: [t.backupImportReplaceNote],
    confirmLabel: t.backupImportReplaceOk,
  }
}

/** 「今のデータに追加」の確認の中身（非破壊マージ。2026-07-30 便CJ/C1・C12 → 便GWで窓の形に） */
export function buildMergeConfirm(): ConfirmContent {
  const t = ja.settings
  return {
    title: t.backupImportMergeTitle,
    bullets: [
      { label: t.backupImportMergeAddLabel, text: t.backupImportMergeAdd },
      { label: t.backupImportMergeKeptLabel, text: t.backupImportMergeKept },
    ],
    confirmLabel: t.backupImportMergeOk,
  }
}

/**
 * 「元に戻す」（上書き前の控えへ戻す）の確認の中身（純ロジック・DB非依存。2026-08-15 便GP・規約F）。
 * 事故から戻すためのボタンなので、消えるもの・残るものを1項目ずつの短さにする
 */
export function buildUndoReplaceConfirm(
  impact: ReplaceImpactCounts,
  cookNaviSelectedCount = 0,
): ConfirmContent {
  const t = ja.settings
  return {
    title: t.replaceUndoTitle,
    bullets: [
      {
        label: t.replaceUndoGoneLabel,
        text: fillCookNaviNote(
          t.replaceUndoGone
            .replace('{r}', String(impact.recipes))
            .replace('{c}', String(impact.cookedLogs)),
          cookNaviSelectedCount,
        ),
      },
      { label: t.replaceUndoKeptLabel, text: t.replaceUndoKept },
    ],
    confirmLabel: t.replaceUndoOk,
  }
}

/** Pro・追加レシピパックの解錠コード関連フィールドだけを抜き出した型（merge復元専用） */
type UnlockCodeFields = Pick<
  Settings,
  'proCode' | 'proActivatedAt' | 'recipePackCode' | 'recipePackActivatedAt'
>

/**
 * merge復元（'今のデータに追加'）で解錠コード（Pro・追加レシピパック）をどう扱うかを決める
 * （純ロジック・DB非依存。2026-07-17バックアップ改修 修正1・オーナー実害の再発防止）。
 *
 * 「ブラウザデータ消去→バックアップ読み込み」でPro/パックの購入状態が戻らない事故があった。
 * 原因はimportBackupのmergeモードがsettings自体に一切触れていなかったこと（レシピ・
 * 再取込除外の記録しか見ていなかった）。replaceモードは元々settings全体を置き換えるため
 * バックアップにコードが含まれていれば自然に復元されるが、merge（今のデータに追加＝
 * 今のデータを消さない設計）は同じやり方（全置き換え）はできない。
 *
 * replace（置き換え）側も2026-07-30 便CJ/C2から同じルールを使う（buildReplaceSettings）。
 * 「バックアップにコードが含まれていれば自然に復元される」ことに任せていたため、コードを含まない
 * ファイル（購入前に取った自分のバックアップ・settings自体を持たない配布セット形式）を
 * 置き換えで復元すると購入状態が消えていた。
 *
 * ルール（Fable裁定）: 「バックアップ側にコードがあれば設定、無ければ既存を保持」
 * （空で上書きしない）。proCode/recipePackCodeそれぞれ独立に判定する（Pro解錠済みの状態で
 * パックだけを含む古いバックアップをmergeしてもPro状態は消えない、等）。
 * バックアップにfile.settings自体が無い場合（settingsを持たない配布セット形式や、
 * 万一の欠損）は既存をそのまま保持する＝何も変えない
 */
export function mergeUnlockCodes(
  current: UnlockCodeFields,
  backupSettings: Partial<UnlockCodeFields> | undefined,
): UnlockCodeFields {
  if (!backupSettings) return current
  return {
    proCode: backupSettings.proCode || current.proCode,
    proActivatedAt: backupSettings.proCode
      ? (backupSettings.proActivatedAt ?? current.proActivatedAt)
      : current.proActivatedAt,
    recipePackCode: backupSettings.recipePackCode || current.recipePackCode,
    recipePackActivatedAt: backupSettings.recipePackCode
      ? (backupSettings.recipePackActivatedAt ?? current.recipePackActivatedAt)
      : current.recipePackActivatedAt,
  }
}

/**
 * replace復元（「今のデータと置き換え」）で settings に書き込む内容を決める
 * （純ロジック・DB非依存。2026-07-30 便CJ/C2）。
 *
 * 直していること: 以前は `{ ...defaultSettings, ...file.settings }` だったため、
 * settingsを持たないJSON（配布レシピセット形式・レビュー用の書き出し・手編集ファイル）を
 * 置き換えで読むと、スプレッドが何も上書きせず既定値がそのまま書かれ、解錠コード・NG食材・
 * 週の食費予算・テーマがまるごと初期化されていた。さらに settings はあっても proCode を
 * 含まないファイル（購入前に取った自分のバックアップ）を置き換えで復元すると、
 * Pro解錠が消えていた（2026-07-17のオーナー実害と同じクラスの取りこぼしがreplace側に残っていた）。
 *
 * ルール:
 * - 土台は「今の設定」（ファイルに無い項目は今の値を保つ＝tablesToReplaceの
 *   「項目が無ければ触らない」という後方互換の考え方と揃える）
 * - ファイルにある項目はファイルの内容で置き換える（置き換えの意味は保つ）
 * - 解錠コードだけは mergeUnlockCodes と同じ「空で上書きしない」（＝購入状態は消さない）
 * - starterSeeded は必ず true（基本レシピの二重投入を防ぐ既存の理由）
 *
 * 付随する挙動: 解錠コードを含むファイルで置き換えたあと「元に戻す」を押しても、解錠コードは
 * 外れない（控えにコードが無くても既存を保持するルールのため）。購入状態は消さない側に倒す
 * 既存方針（mergeUnlockCodes）と揃えた結果で、意図した挙動
 */
export function buildReplaceSettings(
  current: Partial<Settings> | undefined,
  fileSettings: Settings | undefined,
): Settings {
  const base: Settings = { ...defaultSettings, ...current }
  return {
    ...base,
    ...fileSettings,
    ...mergeUnlockCodes(base, fileSettings),
    id: 1,
    starterSeeded: true,
  }
}

/**
 * merge復元（「今のデータに追加」）で、テーブルの行のうち「今のデータに無い行」だけを選ぶ
 * （純ロジック・DB非依存。2026-07-30 便CJ/C1）。
 *
 * 既存の行は1件も消さず・上書きもしない（clearを一切使わない）ので、項目自体を持たない古い
 * バックアップでも安全＝replace側のtablesToReplaceのような undefined/[] の区別は要らない
 * （呼び出し側で「ファイルにその項目が有るときだけ実行する」だけでよい）。
 * ファイル内に同じキーの行が複数あった場合も1件だけ足す。
 * keyOf は既存行・ファイル側の行の両方を受け取れる形（共通の項目だけを見る）で渡す
 */
export function mergeTableRows<E, I>(
  existing: readonly E[],
  incoming: readonly I[],
  keyOf: (row: E | I) => string,
): I[] {
  const keys = new Set<string>(existing.map((row) => keyOf(row)))
  const rows: I[] = []
  for (const row of incoming) {
    const key = keyOf(row)
    if (keys.has(key)) continue
    keys.add(key)
    rows.push(row)
  }
  return rows
}

/**
 * merge復元で各テーブルの「同じ行かどうか」を判定する照合キー（2026-07-30 便CJ/C1）。
 * idは復元先で振り直す＝ファイル側と一致しないため使えない。テーブルごとに
 * 「ユーザーから見て同じ1件」を表す項目を組み合わせる
 * （在庫・買い物メモ・価格・テンプレ=名前、週献立=日付+食事帯+レシピ、
 * 今日の献立=レシピ、日付メモ=日付（主キーそのもの・1日1件））
 */
export const mergeRowKeys = {
  pantryItems: (row: { name: string }) => row.name.trim(),
  shoppingItems: (row: { name: string }) => row.name.trim(),
  mealPlans: (row: { date: string; slot: string; recipeId: number }) =>
    `${row.date}\n${row.slot}\n${row.recipeId}`,
  todayList: (row: { recipeId: number }) => String(row.recipeId),
  prices: (row: { name: string }) => row.name.trim(),
  dayNotes: (row: { date: string }) => row.date,
  mealTemplates: (row: { name: string }) => row.name.trim(),
  // 献立のロック（便DX）＝日付+食事（主キーそのもの・1食1件）
  mealPlanLocks: (row: { key: string }) => row.key,
  /**
   * レシピを削除しても残した「作った記録」のまとまり（2026-08-16 便GZ）。
   * 印（recipeUid）があればそれが「同じまとまり」の唯一の手掛かり。**料理名では突き合わせない**
   * （似た名前の違うレシピの記録が1つに混ざるのを防ぐ）。印を持たないまとまりは、
   * 突き合わせる根拠が無いので料理名＋削除日時で「まったく同じ行」だけを重複と見なす
   * ＝判断がつかないものは足す側（記録を失わない側）に倒す
   */
  detachedLogs: (row: { recipeUid?: string; title: string; detachedAt: number }) =>
    row.recipeUid ? `u\n${row.recipeUid}` : `t\n${row.title.trim()}\n${row.detachedAt}`,
}

/**
 * merge復元でファイル側の1品をどう扱うか決める（純ロジック・DB非依存。2026-07-30 便CJ/C1）。
 * - 'enrich': 同じ料理が既にある。本体は上書きせず（今のデータを優先）、記録・お気に入り・写真だけ足す
 * - 'add': そのIDが空いている。従来どおり同じIDのまま追加する（次回以降も照合できるように）
 * - 'addWithNewId': そのIDが「別の料理」に使われている。新しいIDを振って追加する
 *
 * 'addWithNewId' が要る理由（版ズレ対策）: 同梱の基本レシピが増えると以降のIDがずれるため、
 * 増える前に取ったバックアップを今のアプリへmergeすると、ユーザーの自作レシピのIDが
 * 「別の品である新しい基本レシピ」に当たる。以前はこれを内容も見ずにスキップしていたので、
 * 自作レシピが丸ごと取り込まれなかった。IDが埋まっていても料理名で突き合わせ直し、
 * 別料理なら新しいIDで取り込む（ID衝突を理由にレシピを落とさない）
 *
 * **印（Recipe.uid）を見る（2026-08-16 便HC・司令部の裁定）**。便GZまでは料理名／IDだけで
 * 突き合わせていたため、「同名の別レシピが既にある端末」へ書き出したファイルから同じレシピを
 * 入れ直すと、ファイル側のレシピが既存の同名レシピに合流して印が入らず、
 * 「レシピを削除しても残った記録」が結び直せなかった。規則は4つ:
 *  1. 印が一致する品が既にあれば、それを同一とみなす（最優先。料理名もIDも見ない）
 *  2. 印が一致する品が無く、料理名・IDで当たった既存レシピが印を持っていなければ、従来どおり
 *     同一とみなし、**ファイル側の印を引き継ぐ**（adoptUid）。これで記録が結び直せる
 *  3. 両方が印を持っていて印が違うときは、**合流はする（従来どおり）が、印は引き継がない**。
 *     ＝レシピは重複させず、記録は結ばない（結ばれなかった記録は端末に残ったまま）
 *  4. 「追加」は今のデータを1件も消さない（この関数は消す指示を一切返さない）
 *
 * 規則3を「別のレシピとして追加する」にしない理由（2026-08-16 司令部の裁定の訂正）:
 * **レシピの合流と、記録の結び直しは別の話**だから。便GZの移行で端末にある全レシピへ印が付くので、
 * 端末Aで書き出したファイルを端末Bへ「追加」すると、元は同じレシピでも印が食い違う
 * （どちらの端末でも乱数の印が振られているため）。別レシピとして追加すると**同じ料理が2品に増える**
 * ＝「追加」の見え方が今までと変わってしまう。オーナーの懸念は「**記録が似た名前の違うレシピに
 * つながること**」なので、そこは印を引き継がない（＝記録を結ばない）ことだけで守れる。
 * 印が食い違う場面は「同じレシピかどうか判断がつかない」場面なので、記録は残す側に倒す。
 *
 * 印の照合表は任意。渡さなければ「今のレシピは印を持っていない」として扱うので、
 * 合流先の選び方は便GZまでと同じになる（印を持たない古いバックアップファイルからの復元も、
 * ファイル側に印が無いので規則1〜3のどれも働かず、従来どおりの判定になる）。
 */
export type MergeRecipeAction =
  | {
      kind: 'enrich'
      targetId: number
      /** 今のレシピが印を持っていないときに引き継がせる、ファイル側の印（規則2） */
      adoptUid?: string
    }
  | { kind: 'add' }
  | { kind: 'addWithNewId' }

export function resolveMergeRecipeAction(
  incoming: Pick<Recipe, 'id' | 'title' | 'uid'>,
  existingTitleById: ReadonlyMap<number, string>,
  existingIdByTitle: ReadonlyMap<string, number>,
  existingUidById: ReadonlyMap<number, string> = new Map(),
  existingIdByUid: ReadonlyMap<string, number> = new Map(),
): MergeRecipeAction {
  const incomingUid = incoming.uid?.trim() || undefined
  // 規則1: 印が一致する品が既にあれば、それが同じレシピ（番号も料理名も見ない）
  if (incomingUid) {
    const sameUidId = existingIdByUid.get(incomingUid)
    if (sameUidId !== undefined) return { kind: 'enrich', targetId: sameUidId }
  }
  /**
   * 料理名・IDで当たった既存レシピへ合流させる（従来どおり重複は作らない）。
   * 印を引き継ぐのは、今のレシピが印を持っていないときだけ（規則2）。
   * 両方が印を持ち、違うときは引き継がない（規則3）＝記録は結ばれず端末に残る。
   */
  const enrichSameRecipe = (targetId: number): MergeRecipeAction => {
    const existingUid = existingUidById.get(targetId)
    return {
      kind: 'enrich',
      targetId,
      ...(incomingUid && !existingUid ? { adoptUid: incomingUid } : {}),
    }
  }
  // IDが無い古い形式は照合できないので従来どおり新規として追加する
  if (incoming.id == null) return { kind: 'addWithNewId' }
  const existingTitle = existingTitleById.get(incoming.id)
  // そのIDが空いている: 従来どおり同じIDのまま追加する（印もそのまま入るので記録が結び直せる）
  if (existingTitle === undefined) return { kind: 'add' }
  const title = incoming.title.trim()
  if (existingTitle.trim() === title) return enrichSameRecipe(incoming.id)
  // 同じIDが別の料理に使われている（版ズレ）。料理名で突き合わせ直す
  const sameTitleId = existingIdByTitle.get(title)
  if (sameTitleId !== undefined) return enrichSameRecipe(sameTitleId)
  return { kind: 'addWithNewId' }
}

/** 「作った記録」の照合キー（日付＋メモ）。同じ日に複数回作った記録もメモが違えば別件として残る */
function cookedLogKey(log: Pick<CookedLog, 'date' | 'note'>): string {
  return `${log.date}\n${log.note ?? ''}`
}

export interface RecipeUserDataMerge {
  /** 取り込み後のレシピ（変更が無ければ existing と同じ内容） */
  recipe: Recipe
  /** 1つでも足したものがあるか（falseならDBへ書き戻す必要が無い） */
  changed: boolean
  /** 足した「作った記録」の件数 */
  cookedLogsAdded: number
  /** お気に入りを付け直したか（false→true になったときだけ true） */
  favoriteAdded: boolean
  /** 足した写真の枚数（レシピ写真＋記録の写真） */
  photosAdded: number
}

/**
 * merge復元で「同じ料理が既にある」ときに、ファイル側のユーザーデータだけを足す
 * （純ロジック・DB非依存。2026-07-30 便CJ/C1）。
 *
 * 足すもの: 作った記録（日付＋メモで重複排除）／お気に入り（trueを優先）／
 *           写真（今のレシピに無いときだけ。記録の写真も、同じ記録に写真が無いときだけ入れる）
 * 触らないもの: 料理名・材料・手順・メモなどレシピ本体の内容（今のデータを優先＝merge=追加のみ
 *           という既存設計を保つ）。既にある記録・写真・お気に入りを消したり書き換えたりしない
 */
export function mergeRecipeUserData(existing: Recipe, incoming: Recipe): RecipeUserDataMerge {
  let cookedLogsAdded = 0
  let photosAdded = 0
  const logs = existing.cookedLogs.map((log) => ({ ...log }))
  const indexByKey = new Map<string, number>()
  logs.forEach((log, index) => {
    const key = cookedLogKey(log)
    if (!indexByKey.has(key)) indexByKey.set(key, index)
  })
  for (const log of incoming.cookedLogs) {
    const key = cookedLogKey(log)
    const index = indexByKey.get(key)
    if (index === undefined) {
      logs.push({ ...log })
      indexByKey.set(key, logs.length - 1)
      cookedLogsAdded++
      if (log.photo) photosAdded++
      continue
    }
    // 同じ記録が既にある: 写真だけが欠けている場合に限り、ファイル側の写真で埋める
    if (!logs[index].photo && log.photo) {
      logs[index].photo = log.photo
      photosAdded++
    }
  }
  const favoriteAdded = !existing.isFavorite && incoming.isFavorite
  const photoAdded = !existing.photo && !!incoming.photo
  if (photoAdded) photosAdded++
  const changed = cookedLogsAdded > 0 || photosAdded > 0 || favoriteAdded
  const recipe: Recipe = changed
    ? {
        ...existing,
        cookedLogs: logs,
        isFavorite: existing.isFavorite || incoming.isFavorite,
        ...(photoAdded ? { photo: incoming.photo } : {}),
      }
    : existing
  return { recipe, changed, cookedLogsAdded, favoriteAdded, photosAdded }
}

/**
 * 版ズレでレシピのIDを振り直したとき、ファイル側の行が持つレシピ参照を新しいIDへ付け替える
 * （純ロジック・DB非依存。2026-07-30 便CJ/C1）。付け替えないと、取り込んだ週献立・今日の献立・
 * マイ献立テンプレ・買い物メモが「実在しないレシピ」を指してしまう。
 * 振り直しが1件も無ければ元のオブジェクトをそのまま返す（項目の有無＝undefinedも保つ）
 */
export function remapBackupRecipeRefs<
  T extends Pick<BackupFile, 'mealPlans' | 'todayList' | 'shoppingItems' | 'mealTemplates'>,
>(file: T, idRemap: ReadonlyMap<number, number>): Pick<BackupFile, 'mealPlans' | 'todayList' | 'shoppingItems' | 'mealTemplates'> {
  if (idRemap.size === 0) return file
  const ref = (id: number) => idRemap.get(id) ?? id
  return {
    mealPlans: file.mealPlans?.map((row) => ({ ...row, recipeId: ref(row.recipeId) })),
    todayList: file.todayList?.map((row) => ({ ...row, recipeId: ref(row.recipeId) })),
    // 買い物メモは、出所のレシピID(fromRecipeIds)と、レシピごとの内訳(fromRecipes・
    // 2026-08-08 オーナー実機フィードバック②)の両方を付け替える。片方だけ直すと
    // 出所の小窓が実在しないレシピを指す
    shoppingItems: file.shoppingItems?.map((row) => {
      if (!row.fromRecipeIds && !row.fromRecipes) return row
      const next = { ...row }
      if (row.fromRecipeIds) next.fromRecipeIds = row.fromRecipeIds.map(ref)
      if (row.fromRecipes) {
        next.fromRecipes = row.fromRecipes.map((s) => ({ ...s, recipeId: ref(s.recipeId) }))
      }
      return next
    }),
    mealTemplates: file.mealTemplates?.map((template) => ({
      ...template,
      items: template.items.map((item) => ({ ...item, recipeId: ref(item.recipeId) })),
    })),
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

/**
 * merge復元（「今のデータに追加」）で「何が取り込まれ、何が取り込まれなかったか」の内訳
 * （2026-07-30 便CJ/C1(d)・C11・C12）。結果表示に出して、復元したつもりで実際は戻っていない、
 * という誤認（バックアップの本来の目的が無効になる）を防ぐために数える
 */
export interface MergeImportDetail {
  /** 新しく追加したレシピ数（版ズレでIDを振り直した分も含む） */
  recipesAdded: number
  /** そのうち、IDが別の料理に使われていたため新しいIDで追加した数（版ズレ） */
  recipesRenumbered: number
  /** 同じ料理が既にあったため本体を取り込まなかったレシピ数 */
  recipesMatched: number
  /** そのうち、記録・お気に入り・写真を足したレシピ数 */
  recipesEnriched: number
  /** 既にあるレシピへ足した「作った記録」の件数 */
  cookedLogsAdded: number
  /** 既にあるレシピへ足したお気に入りの件数 */
  favoritesAdded: number
  /** 既にあるレシピへ足した写真の枚数（レシピ写真＋記録の写真） */
  photosAdded: number
  /** 足した在庫・買い物メモ・週献立・今日の献立・価格・日付メモ・献立テンプレの合計行数 */
  tableRowsAdded: number
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
  /** merge時のみ: 取り込みの内訳（結果表示に出す。2026-07-30 便CJ/C1） */
  mergeDetail?: MergeImportDetail
}

/**
 * バックアップを取り込む。
 * mode 'replace': 今のデータを全部消してから復元（引っ越し・復旧向け）
 * mode 'merge'  : 今のデータは1件も消さず、バックアップの「今のデータに無いもの」だけを足す
 *   （非破壊マージ。2026-07-30 便CJ/C1）。
 *   - レシピ: 同じ料理が既にある → 本体はスキップ（今のデータを優先）。ただしファイル側の
 *     作った記録・お気に入り・写真は足す（mergeRecipeUserData）
 *   - レシピ: そのIDが空いている → 同じIDのまま追加
 *   - レシピ: そのIDが別の料理に使われている（版ズレ） → 新しいIDを振って追加し、
 *     献立などの参照も付け替える（resolveMergeRecipeAction / remapBackupRecipeRefs）
 *   - 在庫・買い物メモ・週献立・今日の献立・価格・日付メモ・献立テンプレ:
 *     「今のデータに無い行」だけ足す（mergeTableRows。既存行は消さない・上書きしない）
 *   - 設定本体（NG食材・テーマ等）は従来どおり触らない。解錠コードだけ mergeUnlockCodes で復元
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
        db.dayNotes,
        db.mealTemplates,
        db.mealPlanLocks,
        db.detachedLogs,
      ],
      async () => {
        await db.recipes.clear()
        // 設定も復元する（buildReplaceSettings参照。2026-07-30 便CJ/C2で「今の設定を土台にする＋
        // 解錠コードは空で上書きしない」へ変更。以前はsettingsを持たないJSONを置き換えで読むと
        // 解錠コード・NG食材・週の食費予算・テーマが既定値へ初期化されていた）
        await db.settings.put(buildReplaceSettings(await db.settings.get(1), file.settings))
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
        if (replace.dayNotes) {
          await db.dayNotes.clear()
          if (file.dayNotes!.length > 0) await db.dayNotes.bulkAdd(file.dayNotes!)
        }
        if (replace.mealTemplates) {
          await db.mealTemplates.clear()
          if (file.mealTemplates!.length > 0) await db.mealTemplates.bulkAdd(file.mealTemplates!)
        }
        if (replace.mealPlanLocks) {
          await db.mealPlanLocks.clear()
          if (file.mealPlanLocks!.length > 0) await db.mealPlanLocks.bulkAdd(file.mealPlanLocks!)
        }
        if (replace.detachedLogs) {
          await db.detachedLogs.clear()
          const rows = normalizeBackupDetached(file.detachedLogs)
          if (rows.length > 0) await db.detachedLogs.bulkAdd(rows as DetachedCookedRecord[])
        }
      },
    )
    // 端末だけに残る「作りかけの段取り」の覚え書き（localStorage・COOK_NAVI_SESSION_KEY）を捨てる
    // （2026-08-15 便GP）。ここまでで置き換えたのはDexieのテーブルだけなので、捨てないと
    // **復元前に選んでいた品の段取りが同じ日のうちは残る**。中身は入れ替わっているため、
    // 覚えているレシピIDが**同じ番号の別の料理**を指しうる＝「1度も作っていない品が完成と出る」型
    // （docs/69「『消えない』より『間違ったものが残らない』を優先」。この型は2回踏んでいる）。
    // 段取りはその日限りの覚え書きでバックアップにも入れない設計なので、復元せず捨てるだけにする。
    // 「元に戻す」(restorePreImportSnapshot)も同じ置き換え経路を通るので、そちらでも捨てられる
    clearCookNaviSession()
    // 入れ直したレシピと、残っている「レシピの無い記録」のつながりを戻す（2026-08-16 便GZ）。
    // 結ぶのは印（recipeUid）が完全に一致したときだけで、料理名では結ばない。
    // トランザクションの外で呼ぶ（reattachDetachedLogs が自分でトランザクションを開くため）
    await reattachDetachedLogs()
    return { added: recipes.length, updated: 0, skipped: 0, excluded: 0 }
  }

  // merge: 今のデータは1件も消さず、「今のデータに無いもの」だけを足す（非破壊マージ）
  let added = 0
  let skipped = 0
  const detail: MergeImportDetail = {
    recipesAdded: 0,
    recipesRenumbered: 0,
    recipesMatched: 0,
    recipesEnriched: 0,
    cookedLogsAdded: 0,
    favoritesAdded: 0,
    photosAdded: 0,
    tableRowsAdded: 0,
  }
  await db.transaction(
    'rw',
    [
      db.recipes,
      db.setExclusions,
      db.settings,
      db.pantryItems,
      db.shoppingItems,
      db.mealPlans,
      db.todayList,
      db.prices,
      db.dayNotes,
      db.mealTemplates,
      db.mealPlanLocks,
      db.detachedLogs,
    ],
    async () => {
      // 照合表（ID→料理名 / 料理名→ID / ID→印 / 印→ID）。ファイルのIDが別の料理に
      // 当たっていないか、当たっていた場合に同じ料理が別のIDで居ないかを1件ずつ問い合わせずに
      // 判定するため。印の表は2026-08-16 便HC（resolveMergeRecipeAction の規則1・2・3）で追加
      const existingTitleById = new Map<number, string>()
      const existingIdByTitle = new Map<string, number>()
      const existingUidById = new Map<number, string>()
      const existingIdByUid = new Map<string, number>()
      /** 追加したレシピも照合表に載せる（同じファイルの後続の品が二重に入らないように） */
      const indexExisting = (id: number, title: string, uid: string | undefined) => {
        existingTitleById.set(id, title)
        const key = title.trim()
        if (!existingIdByTitle.has(key)) existingIdByTitle.set(key, id)
        if (!uid) return
        existingUidById.set(id, uid)
        // 同じ印が2品にあるときは先に入った方を採る（logic/recipeUid.ts の indexRecipesByUid と同じ）
        if (!existingIdByUid.has(uid)) existingIdByUid.set(uid, id)
      }
      // toArray()ではなくeach()で1件ずつ読む（写真つきのレシピを全件メモリに抱えないため。
      // 台数の多い端末での読み込み中のメモリ増加を避ける）
      await db.recipes.each((existing) => {
        if (existing.id == null) return
        indexExisting(existing.id, existing.title, existing.uid)
      })
      // 版ズレでIDを振り直したレシピ・別IDの同じ料理に合流したレシピの「ファイル側のID→今のID」。
      // 週献立・今日の献立・献立テンプレ・買い物メモの参照を付け替えるのに使う
      const idRemap = new Map<number, number>()

      for (const recipe of recipes) {
        const action = resolveMergeRecipeAction(
          recipe,
          existingTitleById,
          existingIdByTitle,
          existingUidById,
          existingIdByUid,
        )
        if (action.kind === 'enrich') {
          // 同じ料理が既にある: 本体は上書きせず、ファイル側の記録・お気に入り・写真だけ足す
          const target = await db.recipes.get(action.targetId)
          if (target) {
            const merged = mergeRecipeUserData(target, recipe)
            // 印を持っていない今のレシピには、ファイル側の印を引き継ぐ（規則2）。
            // これを書かないと、レシピを削除しても残った記録が結び直せないまま残る
            const adopted = action.adoptUid ? { ...merged.recipe, uid: action.adoptUid } : merged.recipe
            if (merged.changed || action.adoptUid) await db.recipes.put(adopted)
            if (action.adoptUid) indexExisting(action.targetId, target.title, action.adoptUid)
            if (merged.changed) {
              detail.recipesEnriched++
              detail.cookedLogsAdded += merged.cookedLogsAdded
              detail.photosAdded += merged.photosAdded
              if (merged.favoriteAdded) detail.favoritesAdded++
            }
          }
          if (recipe.id != null && recipe.id !== action.targetId) idRemap.set(recipe.id, action.targetId)
          skipped++
          detail.recipesMatched++
          continue
        }
        if (action.kind === 'add') {
          await db.recipes.add(recipe) // 同じIDのまま追加（次回以降も照合できるように）
          indexExisting(recipe.id!, recipe.title, recipe.uid)
          added++
          detail.recipesAdded++
          continue
        }
        // そのIDが別の料理に使われている（版ズレ）／同名でも印が違う別のレシピ／IDが無い古い形式:
        // 新しいIDを振って追加する。ID衝突を理由に取り込まない（＝自作レシピを落とす）ことはしない
        const { id: fileId, ...rest } = recipe
        const newId = (await db.recipes.add(rest as Recipe)) as number
        indexExisting(newId, recipe.title, recipe.uid)
        if (fileId != null) {
          idRemap.set(fileId, newId)
          detail.recipesRenumbered++
        }
        added++
        detail.recipesAdded++
      }

      // 在庫・買い物メモ・週献立・今日の献立・食材価格マスタ・日付メモ・マイ献立テンプレも
      // 非破壊マージする（2026-07-30 便CJ/C1。以前はこのトランザクションが recipes/setExclusions/
      // settings しか開いておらず、7テーブルは1件も戻らなかった）。clearは一切しないので、
      // 項目自体を持たない古いバックアップでも既存データを消さない（ファイルに項目が有るときだけ実行）。
      // レシピのIDを振り直した場合は、参照を新しいIDへ付け替えてから照合する
      const refs = remapBackupRecipeRefs(file, idRemap)
      if (file.pantryItems !== undefined) {
        const rows = mergeTableRows(await db.pantryItems.toArray(), file.pantryItems, mergeRowKeys.pantryItems)
        if (rows.length > 0) await db.pantryItems.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (refs.shoppingItems !== undefined) {
        const rows = mergeTableRows(await db.shoppingItems.toArray(), refs.shoppingItems, mergeRowKeys.shoppingItems)
        if (rows.length > 0) await db.shoppingItems.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (refs.mealPlans !== undefined) {
        const rows = mergeTableRows(await db.mealPlans.toArray(), refs.mealPlans, mergeRowKeys.mealPlans)
        if (rows.length > 0) await db.mealPlans.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (refs.todayList !== undefined) {
        const rows = mergeTableRows(await db.todayList.toArray(), refs.todayList, mergeRowKeys.todayList)
        if (rows.length > 0) await db.todayList.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (file.prices !== undefined) {
        const rows = mergeTableRows(await db.prices.toArray(), file.prices, mergeRowKeys.prices)
        if (rows.length > 0) await db.prices.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (file.dayNotes !== undefined) {
        const rows = mergeTableRows(await db.dayNotes.toArray(), file.dayNotes, mergeRowKeys.dayNotes)
        if (rows.length > 0) await db.dayNotes.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (refs.mealTemplates !== undefined) {
        const rows = mergeTableRows(await db.mealTemplates.toArray(), refs.mealTemplates, mergeRowKeys.mealTemplates)
        if (rows.length > 0) await db.mealTemplates.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      if (file.mealPlanLocks !== undefined) {
        const rows = mergeTableRows(await db.mealPlanLocks.toArray(), file.mealPlanLocks, mergeRowKeys.mealPlanLocks)
        if (rows.length > 0) await db.mealPlanLocks.bulkAdd(rows)
        detail.tableRowsAdded += rows.length
      }
      // レシピを削除しても残した「作った記録」（2026-08-16 便GZ）。
      // 他のテーブルと違い、同じまとまり（同じ印）が両方にある場合は行を捨てず、
      // **中の記録を1件ずつ突き合わせて足りない分だけ足す**（行ごとスキップすると、
      // ファイルにしか無い記録が復元されない＝バックアップの目的が果たせない）
      if (file.detachedLogs !== undefined) {
        const incoming = normalizeBackupDetached(file.detachedLogs)
        const existing = await db.detachedLogs.toArray()
        const byKey = new Map(existing.map((row) => [mergeRowKeys.detachedLogs(row), row] as const))
        for (const row of incoming) {
          const found = byKey.get(mergeRowKeys.detachedLogs(row))
          if (found?.id != null) {
            const merged = mergeCookedLogLists(found.logs, row.logs)
            if (merged.added > 0 || merged.logs.length !== found.logs.length) {
              await db.detachedLogs.update(found.id, { logs: merged.logs })
              detail.cookedLogsAdded += merged.added
            }
            continue
          }
          const id = (await db.detachedLogs.add(row as DetachedCookedRecord)) as number
          byKey.set(mergeRowKeys.detachedLogs(row), { ...row, id })
          detail.cookedLogsAdded += row.logs.length
          detail.tableRowsAdded += 1
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
      // Pro・追加レシピパックの解錠コードも復元する（2026-07-17バックアップ改修 修正1・
      // オーナー実害の再発防止: 「ブラウザデータ消去→バックアップ読み込み」で購入状態が戻らない
      // 事故があった）。mergeUnlockCodesのルールどおり「バックアップ側にコードがあれば設定、
      // 無ければ既存を保持」（空で上書きしない）。他の設定項目（NG食材・テーマ等）は
      // mergeでは従来どおり一切触らない（merge=追加のみという既存設計を尊重する）
      const currentSettings = { ...defaultSettings, ...(await db.settings.get(1)) }
      const unlockCodes = mergeUnlockCodes(currentSettings, file.settings)
      if (
        unlockCodes.proCode !== currentSettings.proCode ||
        unlockCodes.recipePackCode !== currentSettings.recipePackCode
      ) {
        await db.settings.put({ ...currentSettings, ...unlockCodes, id: 1 })
      }
    },
  )
  // 追加で読み込んだレシピにも、残っている記録のつながりを戻す（2026-08-16 便GZ・印の一致のみ）
  await reattachDetachedLogs()
  return { added, updated: 0, skipped, excluded: 0, mergeDetail: detail }
}

/**
 * 「データを上書き」実行前に、現在の全データをIndexedDBの専用ストア
 * （preImportSnapshots）へ1世代だけ退避する（2026-07-17設定ゼロベース裁定#6b。三重の網の(b)）。
 * 置き換え直後に出す「元に戻す」ボタン（SettingsPage側）がここから復元する。写真も含めて
 * 完全に戻せるようincludeCookedLogPhotos=trueで書き出す（この退避はファイルに出さない内部専用の
 * ものなので、サイズより「戻したら本当に元通りになる」ことを優先する）。1件のみ保持し、
 * 次に置き換えを実行するたびに上書きする（id固定=1。fileHandlesと同じ流儀）
 */
export async function savePreImportSnapshot(): Promise<void> {
  const json = await exportBackup(true)
  await db.preImportSnapshots.put({ id: 1, json, savedAt: Date.now() })
}

/**
 * savePreImportSnapshotで退避した直前のデータへ復元する（三重の網の(c)「元に戻す」）。
 * 退避が無ければ何もせずfalseを返す（ボタン自体は置き換え直後にしか出さない設計だが、
 * 呼び出し側の念のためのガードとして戻り値で判定できるようにする）。
 * 復元後は退避データを消す（1世代のみ保持する設計のため、使用済みの退避を残す意味が無い）
 */
export async function restorePreImportSnapshot(): Promise<boolean> {
  const record = await db.preImportSnapshots.get(1)
  if (!record) return false
  const backup = parseBackup(record.json)
  await importBackup(backup, 'replace')
  await db.preImportSnapshots.delete(1)
  return true
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
  | 'intro'
  | 'servings'
  | 'cookMinutes'
  | 'quickCookMinutes'
  | 'effortLevel'
  | 'tags'
  | 'dishType'
  | 'season'
  | 'suitableFor'
  | 'ingredients'
  | 'steps'
  | 'quickSteps'
  | 'onePoint'
  | 'memo'
  | 'sourceUrl'
  | 'keywords'
>

/**
 * 同一セット由来の再取込（resolveDuplicateTitleActionが'updateName'を返すケース）で、
 * 既存レシピの内容を更新した結果を返す（純ロジック・DB非依存）。
 * 更新: intro/servings/cookMinutes/quickCookMinutes/effortLevel/tags/dishType/season/
 *       suitableFor/ingredients/steps/quickSteps/onePoint/memo/sourceUrl/keywords/sourceSetName +
 *       searchWords・updatedAt（2026-07バグ修正: intro/quickCookMinutesが更新対象に
 *       漏れていたため、配布側の修正がこれらのフィールドだけの場合は再取込しても届かなかった。
 *       onePointは2026-07メモ2区画化で追加）
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
      intro: source.intro,
      servings: source.servings,
      cookMinutes: source.cookMinutes,
      quickCookMinutes: source.quickCookMinutes,
      effortLevel: source.effortLevel,
      tags: source.tags,
      dishType: source.dishType,
      season: source.season,
      suitableFor: source.suitableFor,
      ingredients: source.ingredients,
      steps: source.steps,
      quickSteps: source.quickSteps,
      onePoint: source.onePoint,
      memo: source.memo,
      sourceUrl: source.sourceUrl,
      keywords: source.keywords,
      sourceSetName,
    })
  if (content(existing, existing.sourceSetName) === content(incoming, setName)) return null

  return {
    ...existing,
    intro: incoming.intro,
    servings: incoming.servings,
    cookMinutes: incoming.cookMinutes,
    quickCookMinutes: incoming.quickCookMinutes,
    effortLevel: incoming.effortLevel,
    tags: incoming.tags,
    dishType: incoming.dishType,
    season: incoming.season,
    suitableFor: incoming.suitableFor,
    ingredients: incoming.ingredients,
    steps: incoming.steps,
    quickSteps: incoming.quickSteps,
    onePoint: incoming.onePoint,
    memo: incoming.memo,
    sourceUrl: incoming.sourceUrl,
    keywords: incoming.keywords,
    sourceSetName: setName,
    searchWords: buildSearchWords(existing.title, incoming.ingredients, incoming.tags, incoming.keywords, incoming.steps, incoming.dishType),
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
        searchWords: buildSearchWords(rest.title, rest.ingredients, rest.tags, rest.keywords, rest.steps, rest.dishType),
        createdAt: now,
        updatedAt: now,
      }
      await db.recipes.add(newRecipe)
      existingByTitle.set(title, newRecipe)
      added++
    }
  })
  // 配布セットの取り込みでもつながりを戻す（2026-08-16 便GZ・印の一致のみ）
  await reattachDetachedLogs()
  return { added, updated, skipped, excluded }
}

/** 30日以上バックアップしていない（または一度もしていない）か */
export function backupOverdue(lastBackupAt: number | undefined): boolean {
  if (lastBackupAt === undefined) return true
  return Date.now() - lastBackupAt > 30 * 24 * 60 * 60 * 1000
}

/**
 * 最終バックアップから何日経ったか（純ロジック・DB非依存。2026-07-17設定ゼロベース裁定#1）。
 * 設定画面頂点の常設バナー「最終バックアップ: ◯日前」の表示に使う。未実施はnull
 * （呼び出し側で「まだバックアップしていません」に出し分ける）。nowは検証用の注入フック
 * （省略時はDate.now()）
 */
export function daysSinceBackup(
  lastBackupAt: number | undefined,
  now: number = Date.now(),
): number | null {
  if (lastBackupAt === undefined) return null
  return Math.floor((now - lastBackupAt) / (24 * 60 * 60 * 1000))
}
