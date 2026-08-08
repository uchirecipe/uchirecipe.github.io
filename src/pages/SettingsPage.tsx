import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  X,
  ChevronLeft,
  Download,
  Save,
  Upload,
  Link2,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Info,
  Coins,
  RefreshCw,
  TriangleAlert,
  HardDriveDownload,
  Copy,
  Check,
  Eye,
  Volume2,
} from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import { listRecipes, deleteArchivedCookedLogs } from '../db/recipes'
import { usePriceEntries } from '../db/prices'
import { reloadStarterRecipes, starterCount } from '../db/starters'
import {
  exportBackup,
  downloadBackup,
  importBackup,
  parseBackup,
  fetchRecipeSet,
  importRecipeSet,
  RecipeSetFetchError,
  countReplaceImpact,
  savePreImportSnapshot,
  restorePreImportSnapshot,
  daysSinceBackup,
  type ReplaceImpactCounts,
  type MergeImportDetail,
} from '../logic/backup'
import { hasNgIngredient } from '../logic/ng'
import { clampServings, MIN_SERVINGS, MAX_SERVINGS } from '../logic/servings'
import { restoreHomeWidget } from '../logic/homeWidgets'
import { resolveBackTarget } from '../logic/backLink'
import { refreshApp } from '../logic/appRefresh'
import {
  supportsSaveFilePicker,
  saveWithPicker,
  saveJsonWithPicker,
  downloadJson,
  overwriteSavedFile,
  hasSavedFileHandle,
  savedFileHandleName,
  backupFileName,
  isAbortError,
} from '../logic/fileSave'
import {
  ARCHIVE_MONTH_OPTIONS,
  DEFAULT_ARCHIVE_MONTHS,
  archiveCutoffDate,
  archiveFileName,
  buildArchiveFile,
  collectArchiveTargets,
  countArchiveTargets,
  formatArchiveDate,
  mergeArchiveLogs,
  parseArchiveFile,
  toArchivedLogs,
  ArchiveFileError,
  type ArchivedCookedLog,
} from '../logic/cookedArchive'
import {
  totalCookedLogPhotoBytes,
  isOverCookedPhotoLimit,
  bytesToMB,
} from '../logic/cookedPhotoStorage'
import {
  isValidProCode,
  normalizeProCode,
  detectCodeKind,
  maskUnlockCode,
  PRO_PURCHASE_URL,
} from '../logic/pro'
import {
  normalizeAisleOrder,
  moveAisleGroup,
  isDefaultAisleOrder,
  SHOPPING_AISLE_ORDER,
} from '../logic/pantryGroups'
import type {
  HomeWidgetKey,
  ThemeSetting,
  TimerSoundLength,
  TimerSoundVolume,
} from '../db/types'
import { defaultHomeWidgets } from '../db/types'
import {
  TIMER_SOUND_LENGTHS,
  TIMER_SOUND_VOLUMES,
  timerSoundSeconds,
} from '../logic/timerSound'
import { playTimerChime } from '../components/TimerProvider'
import {
  shouldShowPermissionHelp,
  shouldShowUnsupportedNote,
  probeAudioPermission,
  probeWakeLockPermission,
  wakeLockSupported,
  audioSupported,
  type CapabilityPermission,
} from '../logic/cookingSupport'
import { ja } from '../i18n/ja'
import Toast from '../components/Toast'
import ArchiveViewerModal from '../components/ArchiveViewerModal'

/** タイマー音の音量の選択肢(2026-08-08 オーナー実機フィードバック③)。未設定＝'normal'＝従来の音 */
const timerVolumeLabels: Record<TimerSoundVolume, string> = {
  low: ja.settings.timerSoundVolumeLow,
  normal: ja.settings.timerSoundVolumeNormal,
  high: ja.settings.timerSoundVolumeHigh,
}

/** 鳴る長さの選択肢。段階名ではなく秒数で見せる＝押す前にどれだけ鳴るか分かるようにする */
const timerLengthLabel = (length: TimerSoundLength): string =>
  ja.settings.timerSoundLengthOption.replace('{n}', String(timerSoundSeconds(length)))

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'auto', label: ja.settings.themeAuto },
  { value: 'light', label: ja.settings.themeLight },
  { value: 'dark', label: ja.settings.themeDark },
  { value: 'brown', label: ja.settings.themeBrown },
  { value: 'green', label: ja.settings.themeGreen },
]

const allHomeWidgets: HomeWidgetKey[] = [
  'mealPlan',
  'suggestion',
  'ingredientSearch',
  'history',
]

const homeWidgetLabels: Record<HomeWidgetKey, string> = {
  mealPlan: ja.home.mealPlanTitle,
  suggestion: ja.home.suggestTitle,
  // キーは'ingredientSearch'のままだが、中身は2026-08-02にレシピタブへのショートカットへ置き換えた
  // (保存済みの並び順・表示設定を壊さないためキー名は変えていない)
  ingredientSearch: ja.home.searchShortcutTitle,
  history: ja.home.historyTitle,
}

const sectionCls =
  'mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm'

// 「ふだん作る人数」の選択肢(2026-08-03 便DK)。範囲はレシピの人数分と同じ1〜20
// (logic/servings.ts。手で作れない人数がここからだけ入る、という穴を作らない)
const householdServingsOptions = Array.from(
  { length: MAX_SERVINGS - MIN_SERVINGS + 1 },
  (_, i) => MIN_SERVINGS + i,
)

// パーソナライズ節の小見出し(2026-07-16 UI総点検B-2: 9カードフラット並列を4グループに整理)。
// 既存のセクション見出しパターン(RecipesPageの絞り込みパネル等)に合わせ、小さめの text-sm font-bold
const groupHeadingCls = 'mt-[var(--space-lg)] text-sm font-bold text-ink-muted'

// ブラウザが「画面を暗くしない」「タイマー音」に対応しているか(logic/cookingSupport.ts)。
// 対応可否はブラウザ機能そのものの話なのでセッション中は変わらない。
// 対応していないときだけ注記を出す＝対応ブラウザに「対応ブラウザのみ」と書き続けない(便DV-6)
const wakeLockIsSupported = wakeLockSupported()
const audioIsSupported = audioSupported()

// File System Access API対応ブラウザ(Chrome/Edge等)かどうか(2026-07-17バックアップ改修
// 修正2+3)。対応環境のみ保存先選択・「前回の場所に上書き」を出し、非対応(Safari/Firefox)は
// 従来どおりの自動ダウンロードのままにする(ブラウザ機能自体の対応可否なのでセッション中は不変)
const fileSaveSupported = supportsSaveFilePicker()

/**
 * 設定画面は1本スクロール(2026-07-17オーナー採用決定。旧: 上部タブ4分割2026-07-12〜)。
 * 縦に長い設定を使う頻度の高い順に並べ、各節を見出し+アンカーで区切る。
 * ページ上部には節へ飛ぶ目次チップ(sticky)を置き、タップで該当節へスクロールする。
 * 各節の内訳:
 * パーソナライズ=見た目(テーマカラー/ホーム)/食材と価格(NG食材/価格マスタ/週の食費予算/売り場順)/料理中(画面/タイマー)
 * レシピ=基本レシピ/レシピセットを読み込む（テーマ一覧は2026-07-23のテーマ全廃で撤去）
 * バックアップ=バックアップ一式
 * Pro=Pro版(有料の機能解錠。収録レシピは全て無料・有料はPro機能のみ)
 * うちレシピについて=バージョン・データ件数・紹介ページ・利用規約・ご意見箱
 *
 * 2026-08-02 オーナー指示: 以前は「その他」グループ(＝アプリについて)が全般節の途中にあり、
 * そのあとにレシピ・バックアップ・Proが続いていた。「その他」は普通いちばん最後に来る名前なので、
 * ページの途中に出ると「ここで終わり」と読めてしまう。中身は数日〜数か月に一度しか開かない
 * 読み物(バージョン・利用規約・ご意見箱)なので、グループごとページ最後の独立した節に移した。
 * 節の並び自体(パーソナライズ→レシピ→バックアップ→Pro)は使用頻度の高い順なので変えていない。
 *
 * 目次チップは5つになるので、最後の節だけ短いラベル(tocAbout「アプリ」)を使う
 * (節の見出しは「うちレシピについて」のまま。390px幅で5列に収める)。
 */
const settingsSections: { id: string; label: string }[] = [
  { id: 'section-basic', label: ja.settings.tabBasic },
  { id: 'section-recipe', label: ja.settings.tabRecipe },
  { id: 'section-backup', label: ja.settings.tabBackup },
  { id: 'section-pro', label: ja.settings.tabPro },
  { id: 'section-about', label: ja.settings.tocAbout },
]

// ?section=pro / ?section=backup / ?section=recipe の直リンクが、どの要素まで自動スクロールするか。
// 1本スクロール化で「該当タブを開く」から「該当節へ自動スクロール」へ読み替えた(unlock.html・
// NutritionTeaser・ホーム「しばらくバックアップしていません」等の既存導線を維持する)。
// backupは2026-07-16 ホームリンクの遷移先として追加。値は該当節内のアンカー要素id。
// テーマ全廃(2026-07-23)で ?section=themes は廃止したが、旧リンクで来ても無害に着地させるため
// 「レシピ」節へ読み替える（recipe/themes のどちらでもレシピ節の先頭へ飛ぶ）
// budgetは2026-07-29 便CD/MP-11: 献立タブの概算食費「週の食費予算を登録する」の遷移先。
// 従来は「設定画面で登録すると比較できます」という案内文だけで行き止まりだった
const sectionDeepLinks: Record<string, string> = {
  // 2026-08-03 便DH: 「全般」→「パーソナライズ」への改名にあわせて、この節にも名前で飛べる値を
  // 用意した(?section=personalize)。DOM側のid('section-basic')は既存の目次チップ・スクロール監視が
  // 参照しているのでそのまま。既存の?section=値(pro/backup/recipe/themes/budget/aisle/about)の
  // 行き先は変えていない
  personalize: 'section-basic',
  pro: 'pro-section',
  backup: 'backup-section',
  recipe: 'section-recipe',
  themes: 'section-recipe',
  budget: 'budget-section',
  // householdは2026-08-03 便DK: 設定「ふだん作る人数」へ名前で飛べる値(?section=household)。
  // 献立の食数・買い物メモの分量・概算食費の既定がどこで決まっているかを案内するときの行き先
  household: 'household-section',
  // aisleは2026-08-02 便CT/C15: 買い物メモの「売り場順を変える」の遷移先。
  // 並びの由来と変え方が、買い物メモの画面から辿れるようにする
  aisle: 'aisle-section',
  // aboutは2026-08-02: 「アプリについて」を全般節の途中からページ最後の独立した節へ移した際に追加。
  // 既存の?section=値(pro/backup/recipe/themes/budget/aisle)の行き先は変えていない
  about: 'section-about',
}

// 各節の見出し(パーソナライズ/レシピ/バックアップ/Pro)の共通スタイル。節の区切りとして本文カードより一回り
// 大きくする(スクロール位置の調整=scroll-mt-24は節ラッパーの<section>側に付ける)
const nodeHeadingCls = 'text-lg font-bold'

/**
 * importRecipeSetの結果メッセージを組み立てる。更新（内容が変わっていた再取込）が
 * 1件以上あるときだけ「{a}件追加・{u}件更新しました」系にし、無いときは従来文言のまま
 * （u=0のときまで新文言を出すと冗長なため・2026-07-12）。
 * 削除済み（再取込除外の記録あり）のため取り込まなかった品があるときだけ
 * 「（削除済みの除外中{e}件）」を末尾に付ける（0件なら出さない・2026-07-13トゥームストーン）
 */
function formatRecipeSetResult(result: {
  added: number
  updated: number
  skipped: number
  excluded: number
}): string {
  const base =
    result.updated > 0
      ? ja.settings.recipeSetResultWithUpdate
          .replace('{a}', String(result.added))
          .replace('{u}', String(result.updated))
          .replace('{s}', String(result.skipped))
      : ja.settings.recipeSetResult
          .replace('{a}', String(result.added))
          .replace('{s}', String(result.skipped))
  if (result.excluded > 0) {
    return base + ja.settings.recipeSetResultExcluded.replace('{e}', String(result.excluded))
  }
  return base
}

/**
 * 「今のデータに追加」の結果の内訳を組み立てる（2026-07-30 便CJ/C1(d)・C11・C12）。
 * 足したものを項目ごとに1行ずつ返し、0件の行は出さない（「作った記録0件・写真0枚を足しました」
 * のような無意味な行を並べない）。復元したつもりで実は戻っていない、という誤認を防ぐのが目的なので、
 * 何も足さなかった場合もその旨を1行返す（無言で終わらせない）
 */
function buildMergeResultLines(detail: MergeImportDetail): string[] {
  const lines = [
    ja.settings.backupImportMergeResult
      .replace('{a}', String(detail.recipesAdded))
      .replace('{s}', String(detail.recipesMatched)),
  ]
  if (detail.recipesRenumbered > 0) {
    lines.push(
      ja.settings.backupImportMergeResultRenumbered.replace('{n}', String(detail.recipesRenumbered)),
    )
  }
  const addedToExisting = [
    detail.cookedLogsAdded > 0 &&
      ja.settings.backupImportMergeResultLogsCooked.replace('{c}', String(detail.cookedLogsAdded)),
    detail.favoritesAdded > 0 &&
      ja.settings.backupImportMergeResultLogsFavorite.replace('{f}', String(detail.favoritesAdded)),
    detail.photosAdded > 0 &&
      ja.settings.backupImportMergeResultLogsPhoto.replace('{p}', String(detail.photosAdded)),
  ].filter((item): item is string => !!item)
  if (addedToExisting.length > 0) {
    lines.push(ja.settings.backupImportMergeResultLogs.replace('{items}', addedToExisting.join('・')))
  }
  if (detail.tableRowsAdded > 0) {
    lines.push(
      ja.settings.backupImportMergeResultTables.replace('{t}', String(detail.tableRowsAdded)),
    )
  }
  if (detail.recipesAdded === 0 && addedToExisting.length === 0 && detail.tableRowsAdded === 0) {
    lines.push(ja.settings.backupImportMergeResultNothing)
  }
  return lines
}

/**
 * 「データを上書き」の確認文を件数入りで組み立てる
 * （2026-07-17設定ゼロベース裁定#6a）。ファイル選択を開く前(pickImportFile)・
 * ファイル選択後の最終確認(onImportFile)の両方で同じ文言を使い整合させる
 */
function buildReplaceConfirmText(impact: ReplaceImpactCounts): string {
  return ja.settings.backupImportReplaceConfirm
    .replace('{r}', String(impact.recipes))
    .replace('{c}', String(impact.cookedLogs))
    .replace('{p}', String(impact.prices))
}

/**
 * 解錠コードの控え表示+コピー（2026-07-17設定ゼロベース裁定#4。機種変更時の「購入の復元」用）。
 * 既定はマスク表示（例: UR-****CD34）で、タップすると生のコードに切り替わる（マスク解除表示）。
 * コピーボタンは常にマスクの有無に関わらず生のコードをクリップボードへコピーする
 * （画面には隠していても、機種変更で貼り付ける先は本人の新しい端末なので生のコードで問題ない）
 */
function UnlockCodeDisplay({ code }: { code: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // クリップボードAPI非対応・権限拒否時は何もしない（コード自体は画面表示済みなので手動選択でコピーできる）
    }
  }

  return (
    <div className="mt-1 flex items-center gap-2">
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-label={ja.settings.unlockCodeToggleAria}
        className="rounded-sm font-mono text-xs text-ink-muted underline decoration-dotted underline-offset-2"
      >
        {revealed ? code : maskUnlockCode(code)}
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge px-2 py-1 text-xs font-bold text-accent-ink shadow-sm"
      >
        {copied ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
        {copied ? ja.settings.unlockCodeCopied : ja.settings.unlockCodeCopy}
      </button>
    </div>
  )
}

/** 設定: NG食材 / 画面を暗くしない / テーマ */
export default function SettingsPage() {
  const settings = useSettings()
  const recipes = useLiveQuery(listRecipes, [])
  // 食材価格マスタ(2026-07-17設定ゼロベース裁定#6a: 置き換え確認文の件数表示に使う)
  const prices = usePriceEntries()
  const [ngInput, setNgInput] = useState('')
  const [message, setMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  const importModeRef = useRef<'replace' | 'merge'>('merge')
  const [recipeSetUrl, setRecipeSetUrl] = useState('')
  const [recipeSetLoading, setRecipeSetLoading] = useState(false)
  // 「レシピセットを読み込む」欄の「URLから読み込む」「ファイルから読み込む」の結果メッセージ
  // (2026-07-14 オーナー実機フィードバック: 以前は下部トーストのみだったため、縦に長い
  // ページでは気づきにくかった)。この2つのボタン操作に限り、読み込み欄の上部にも
  // テキストで表示し、下部トースト(setMessage)は呼ばない(二重表示しない)。
  // set=クエリの直リンク取り込み(配布ページの外部リンクから来る一発取り込み)は、
  // 下部トーストがタップで閉じられる既存の挙動としてテスト済みのため対象外(変更しない)。
  // 他の操作(テーマ追加・バックアップ等)のトーストも変更しない
  const [recipeSetMessage, setRecipeSetMessage] = useState('')
  const recipeSetFileRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  // 元のページへの帰り道(2026-08-02 オーナー指示・便DF)。各ページのPro版の説明などから
  // ?back=<元のパス> 付きで飛んできたときだけ、目次チップの上に「◯◯に戻る」を出す。
  // 直接この画面を開いた場合(タブから等)は元のページが無いので出さない
  const backTarget = useMemo(() => resolveBackTarget(searchParams.get('back')), [searchParams])
  // 「購入と解錠」1画面統合(2026-07-17設定ゼロベース裁定#7)。入力欄1つでPro・追加レシピパック
  // 両方のコードを受け付け、種類(UR-/UP-)はdetectCodeKindが自動判定する
  const [unlockCodeInput, setUnlockCodeInput] = useState('')
  const [unlockChecking, setUnlockChecking] = useState(false)
  const [unlockError, setUnlockError] = useState('')
  // 「作った記録」の写真をバックアップに含めるか(2026-07-12写真添付・docs/20 §4。既定OFF)
  const [includeCookedPhotos, setIncludeCookedPhotos] = useState(false)
  // 前回選んだ保存先ハンドルの記録があるか(2026-07-17バックアップ改修 修正2+3。
  // File System Access API対応ブラウザのみ意味を持つ。「前回の場所に上書き」ボタンの表示判定)
  const [savedHandleExists, setSavedHandleExists] = useState(false)
  // 記録している保存先のファイル名(2026-07-30 便CJ/C10。「前回の場所に上書き」の注記に出す。
  // 名前が取れない古い記録では空のままで、ファイル名なしの注記にフォールバックする)
  const [savedHandleName, setSavedHandleName] = useState('')
  const [exportBusy, setExportBusy] = useState(false)
  // バックアップ読み込み中の進捗表示+二重操作防止(2026-07-30 便CJ/C15。書き出し側のexportBusyと
  // 揃える。写真の多いファイルは端末によって数秒〜十数秒かかり、その間ボタンが押せたままだった)
  const [importBusy, setImportBusy] = useState(false)
  // 読み込み結果の内訳(2026-07-30 便CJ/C1(d)・C11・C12)。トーストは数秒で消えてしまい
  // 「本当に戻ったか」を確かめる手段にならないため、「バックアップを読み込む」カード内に
  // テキストとして残す(レシピセット読み込み欄の先例と同じ流儀。二重表示しないのでトーストは出さない)
  const [importResultLines, setImportResultLines] = useState<string[]>([])
  // 目次チップの現在地ハイライト用(1本スクロール化)。スクロール監視で表示中の節idを保持する
  const [activeSection, setActiveSection] = useState<string>('section-basic')
  // 置き換え直後1回だけ出す「元に戻す」バナー(2026-07-17設定ゼロベース裁定#6c・三重の網の(c))。
  // タブを切り替える(=画面遷移)と消える(下のuseEffect参照)
  const [replaceUndoAvailable, setReplaceUndoAvailable] = useState(false)
  // バックアップタブ「機種変更するときは」の折りたたみ開閉(2026-07-17設定ゼロベース裁定#5)
  const [moveGuideOpen, setMoveGuideOpen] = useState(false)

  /**
   * 「料理中」の設定が実際に働くか（2026-08-04 便DV-7・オーナー指示）。
   * ブラウザが対応していても、端末の低電力モードやサイトごとの音の許可で止められていると働かない。
   * 画面を開いたときと、スイッチをONにした直後に一度だけ試して、失敗したときだけ案内を出す。
   * 試すだけで、取得した画面ロックはすぐ解放する（設定画面が画面を占有し続けない）。
   */
  const [wakeLockPermission, setWakeLockPermission] = useState<CapabilityPermission>('unknown')
  const [audioPermission, setAudioPermission] = useState<CapabilityPermission>('unknown')
  const checkWakeLockPermission = () => {
    void probeWakeLockPermission().then(setWakeLockPermission)
  }
  const checkAudioPermission = () => {
    void probeAudioPermission().then(setAudioPermission)
  }
  useEffect(() => {
    void probeWakeLockPermission().then(setWakeLockPermission)
    void probeAudioPermission().then(setAudioPermission)
  }, [])

  // ===== 古い記録の書き出し(2026-08-02 オーナー採用。端末容量の軽量化) =====
  // 「◯ヶ月より前」の選択(既定1ヶ月)。設定には保存しない(書き出しのたびに選び直す一度きりの指定で、
  // 覚えておくと「前に6ヶ月にしたまま1ヶ月分だけ消すつもりで押す」取り違えが起きるため)
  const [archiveMonths, setArchiveMonths] = useState<number>(DEFAULT_ARCHIVE_MONTHS)
  // 追記型: 前回のアーカイブファイルを選んだときの中身(選ばなければnull=新規作成)
  const [archiveBaseLogs, setArchiveBaseLogs] = useState<ArchivedCookedLog[] | null>(null)
  const [archiveBusy, setArchiveBusy] = useState(false)
  const [archiveMessage, setArchiveMessage] = useState('')
  // 書き出しが済んだ結果。これがある間だけ「書き出した記録を端末から消す」を出す
  // (書き出しと削除を1ボタンにしない＝ファイル保存に失敗したときの全損を防ぐ)
  const [archiveExported, setArchiveExported] = useState<{
    ids: string[]
    logs: number
    photos: number
    cutoff: string
  } | null>(null)
  // 「アーカイブを見る」で開く一時閲覧の窓(IndexedDBには書かない・閉じたら端末に残らない)
  const [archiveViewLogs, setArchiveViewLogs] = useState<ArchivedCookedLog[] | null>(null)
  const [archiveViewBroken, setArchiveViewBroken] = useState(0)
  const archiveAppendFileRef = useRef<HTMLInputElement>(null)
  const archiveViewFileRef = useRef<HTMLInputElement>(null)

  // 前回の保存先ハンドルの記録有無を起動時に1回確認する(2026-07-17バックアップ改修 修正2+3。
  // 非対応ブラウザでは常にfalseのまま=ボタン自体を出さない)
  useEffect(() => {
    if (!fileSaveSupported) return
    let cancelled = false
    void hasSavedFileHandle().then((exists) => {
      if (!cancelled) setSavedHandleExists(exists)
    })
    // 記録している保存先のファイル名も読む(便CJ/C10)
    void savedFileHandleName().then((name) => {
      if (!cancelled && name) setSavedHandleName(name)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // 旧・配布テーマの ?set=<setId> 直リンク（#/settings?set=kintore 等）で来たときの後始末。
  // テーマ全廃(2026-07-23)で取り込み処理は撤去した。エラーにはせず、URLの set パラメータだけを
  // 静かに取り除いて設定画面へ無害に着地させる（旧配布ページ・旧ブックマークからの流入対策）
  useEffect(() => {
    if (!searchParams.get('set')) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('set')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])

  // セクションへの直接リンク(例: /settings?section=pro、?section=backup)から開いたとき、
  // 該当節のアンカー要素まで自動スクロールする(1本スクロール化。旧: 該当タブへ切り替え→スクロール)。
  // 1本スクロールなので対象要素は常にDOMにあるが、settings読み込み前はコンポーネントがnullを返す
  // (下記)ため要素がまだ無く、settingsが揃ってから試す。1マウントにつき1回だけ実行するようRefで防ぐ
  const scrolledToSectionRef = useRef(false)
  useEffect(() => {
    if (scrolledToSectionRef.current) return
    const elementId = sectionDeepLinks[searchParams.get('section') ?? '']
    if (!elementId) return
    if (!settings) return
    scrolledToSectionRef.current = true
    requestAnimationFrame(() => {
      document.getElementById(elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [searchParams, settings])

  /**
   * バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)のタップ/ボタン先。
   * バックアップ節の①バックアップを取るカードまで自動スクロールする(実際の保存はユーザーが
   * 写真込みチェック等を確認してから「ファイルに書き出す」を押す形を維持する。バナーの小ボタンから
   * 確認なしに即ファイル保存を開始しない)。1本スクロール化でタブ切り替えが不要になったため、
   * 単純にbackup-sectionへスクロールする
   */
  const goToBackupExport = () => {
    document.getElementById('backup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /** 目次チップのタップ: 該当節の見出しへスクロールし、チップのハイライトを即時に切り替える */
  const scrollToSection = (id: string) => {
    setActiveSection(id)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // 目次チップの現在地ハイライト(1本スクロール化)。スクロールに応じて表示中の節を追従表示する。
  // sticky目次チップの少し下(140px)に判定ラインを引き、それを越えた最後の節をactiveにする。
  // 最後尾のPro節は高さが足りず先頭が判定ラインまで届かない(=最下部で止まる)ため、ページ最下部に
  // 達したら最後の節を明示的にactiveにする(そうしないとPro表示中もバックアップが光ったままになる)
  useEffect(() => {
    if (!settings) return
    let ticking = false
    const compute = () => {
      ticking = false
      const atBottom =
        window.innerHeight + Math.ceil(window.scrollY) >= document.documentElement.scrollHeight - 4
      if (atBottom) {
        setActiveSection(settingsSections[settingsSections.length - 1].id)
        return
      }
      let current = settingsSections[0].id
      for (const s of settingsSections) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= 140) current = s.id
      }
      setActiveSection(current)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(compute)
    }
    compute() // 初期反映
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [settings])

  if (!settings) return null // 読み込み中

  /** 現在の入力欄の文字が今の時点で何件のレシピに一致するか（登録前のその場プレビュー） */
  const ngPreviewCount =
    ngInput.trim() && recipes
      ? recipes.filter((r) => hasNgIngredient(r, [ngInput.trim()])).length
      : undefined

  // 「作った記録」写真の容量ガード（2026-07-12写真添付・docs/20 §4。自動削除はしない、促すバナーのみ）
  const cookedPhotoBytes = recipes ? totalCookedLogPhotoBytes(recipes) : 0
  const showCookedPhotoLimitBanner = isOverCookedPhotoLimit(cookedPhotoBytes)

  // レシピ件数・作った記録の合計件数・価格マスタ件数(2026-07-17設定ゼロベース裁定#3のデータ件数表示・
  // #6aの置き換え確認文の件数表示の両方で使う共通値)
  const dataCounts = countReplaceImpact(recipes ?? [], prices?.length ?? 0)

  /**
   * 書き出し完了の知らせ(2026-07-30 便CJ/C6)。経路ごとに言えることが違うので文言を分ける。
   * 'picked'=保存先を選んで書き込んだ / 'overwritten'=前回と同じファイルへ上書きした /
   * 'downloaded'=ブラウザの自動ダウンロード(結果を観測できないため「確認のお願い」にする)
   */
  const exportDoneMessage = (route: 'picked' | 'overwritten' | 'downloaded') => {
    const template =
      route === 'picked'
        ? ja.settings.backupExportDonePicked
        : route === 'overwritten'
          ? ja.settings.backupExportDoneOverwritten
          : ja.settings.backupExportDoneDownloaded
    return template.replace('{n}', String(dataCounts.recipes))
  }

  /**
   * 「ファイルに書き出す」(2026-07-17バックアップ改修 修正2+3)。
   * File System Access API対応ブラウザ(Chrome/Edge等)では保存先選択ダイアログ
   * (showSaveFilePicker)を開き、選んだ場所へ書き込む。選んだハンドルはIndexedDBに記録し、
   * 次回以降「前回の場所に上書き」ボタン(handleExportOverwrite)で使う。
   * 非対応ブラウザ(Safari/Firefox)は従来どおりの自動ダウンロード(downloadBackup)のまま
   * （挙動を変えない）。ユーザーがピッカーをキャンセルした場合(AbortError)はエラー表示しない
   */
  const handleExportPick = async () => {
    if (!fileSaveSupported) {
      await downloadBackup(includeCookedPhotos) // 非対応ブラウザは従来どおりの自動ダウンロード
      setMessage(exportDoneMessage('downloaded'))
      return
    }
    setExportBusy(true)
    try {
      const json = await exportBackup(includeCookedPhotos)
      const savedName = await saveWithPicker(json, backupFileName())
      await updateSettings({ lastBackupAt: Date.now() })
      setSavedHandleExists(true)
      if (savedName) setSavedHandleName(savedName) // 便CJ/C10: 次回の上書き先を注記に出す
      setMessage(exportDoneMessage('picked'))
    } catch (err) {
      // ユーザーのキャンセル(AbortError)は何もしない。それ以外(権限拒否・headless等で
      // ピッカー自体が使えない環境)は、エラーで終わらせず従来の自動ダウンロードへ
      // フォールバックする(バックアップが取れないままになるのが最悪のため)
      if (!isAbortError(err)) {
        try {
          await downloadBackup(includeCookedPhotos)
          await updateSettings({ lastBackupAt: Date.now() })
          setMessage(exportDoneMessage('downloaded'))
        } catch {
          setMessage(ja.settings.backupSaveError)
        }
      }
    } finally {
      setExportBusy(false)
    }
  }

  /**
   * 「前回の場所に上書き」(2026-07-17バックアップ改修 修正2+3)。権限確認
   * (requestPermission)→書き込み。拒否・ハンドル失効時は保存先選択(handleExportPick)へ
   * フォールバックする(overwriteSavedFileが例外を投げるので、そのcatchでフォールバックする)
   */
  const handleExportOverwrite = async () => {
    setExportBusy(true)
    try {
      const json = await exportBackup(includeCookedPhotos)
      await overwriteSavedFile(json)
      await updateSettings({ lastBackupAt: Date.now() })
    } catch {
      setExportBusy(false)
      await handleExportPick()
      return
    }
    setExportBusy(false)
    setMessage(exportDoneMessage('overwritten'))
  }

  /**
   * バックアップの読み込み: モードを選んでからファイルを開く。
   * 置き換え(replace)は、押した瞬間に確認なしでファイル選択ダイアログが開いてしまっていた穴を
   * 塞ぐため、ファイル選択を開く前に一段確認を挟む(2026-07-16 データ消失事故の再発防止・P6所見)。
   * キャンセルなら何もしない(ファイル選択自体を開かない)。ファイル選択後にonImportFileで出る
   * 確認(backupImportReplaceConfirm)と同じ、件数入りの文言を使って整合させる
   * (2026-07-17設定ゼロベース裁定#6a)
   */
  const pickImportFile = (mode: 'replace' | 'merge') => {
    if (importBusy) return // 読み込み中の二重操作を防ぐ(ボタンのdisabledと二重の歯止め・便CJ/C15)
    if (mode === 'replace' && !window.confirm(buildReplaceConfirmText(dataCounts))) return
    importModeRef.current = mode
    importFileRef.current?.click()
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    const mode = importModeRef.current
    const confirmText =
      mode === 'replace' ? buildReplaceConfirmText(dataCounts) : ja.settings.backupImportMergeConfirm
    if (!window.confirm(confirmText)) return
    // 前回の結果を消してから始める(古い結果が新しい操作の結果に見えないように)。
    // 読み込み中は「追加」「置き換え」を押せなくする(二重操作防止・便CJ/C15)
    setImportResultLines([])
    setImportBusy(true)
    try {
      const backup = parseBackup(await file.text())
      // 三重の網の(b): 置き換え実行前に現在の全データを内部へ自動退避する(2026-07-17設定
      // ゼロベース裁定#6b)。退避に失敗しても置き換え自体は止めない(退避はあくまで安全網の追加分で、
      // 従来どおりのバックアップ/復元フローを妨げてはいけないため)。この場合は「元に戻す」を
      // 出さない(退避が無ければ復元できないため)
      let snapshotSaved = false
      if (mode === 'replace') {
        try {
          await savePreImportSnapshot()
          snapshotSaved = true
        } catch {
          snapshotSaved = false
        }
      }
      const result = await importBackup(backup, mode)
      if (mode === 'replace' && snapshotSaved) setReplaceUndoAvailable(true)
      const lines =
        mode === 'replace'
          ? [ja.settings.backupImportDone.replace('{n}', String(result.added))]
          : result.mergeDetail
            ? buildMergeResultLines(result.mergeDetail)
            : []
      // 控えが取れなかったときは黙らずに伝える(2026-07-30 便CJ/C16)。確認文で「元に戻せます」と
      // 約束しているので、成立しなかった事実を出さないと約束を破ったままになる
      if (mode === 'replace' && !snapshotSaved) lines.push(ja.settings.replaceSnapshotFailed)
      setImportResultLines(lines)
    } catch {
      setImportResultLines([ja.settings.backupImportError])
    } finally {
      setImportBusy(false)
    }
  }

  /**
   * 三重の網の(c): 置き換え直後に1回だけ出す「元に戻す」(2026-07-17設定ゼロベース裁定#6c)。
   * savePreImportSnapshotで退避したデータへ復元する
   */
  const handleUndoReplace = async () => {
    const restored = await restorePreImportSnapshot()
    setReplaceUndoAvailable(false)
    // 置き換えの結果表示は戻したあとは事実と違うので消す（便CJ/C11）
    setImportResultLines([])
    setMessage(restored ? ja.settings.replaceUndoDone : ja.settings.replaceUndoError)
  }

  // ===== 古い記録の書き出し(2026-08-02) =====
  // 「◯ヶ月より前」の境目と、その対象になる記録。recipesが更新されれば自動で数え直される
  const archiveCutoff = archiveCutoffDate(archiveMonths)
  const archiveTargets = collectArchiveTargets(recipes ?? [], archiveCutoff)
  const archiveCounts = countArchiveTargets(archiveTargets)

  /** 読み込んだアーカイブファイルのエラーを、理由別の文言にする(バックアップと取り違えた場合を言い分ける) */
  const archiveFileErrorMessage = (err: unknown): string =>
    err instanceof ArchiveFileError && err.reason === 'backup'
      ? ja.settings.archiveFileErrorBackup
      : ja.settings.archiveFileErrorInvalid

  /** 追記型: 前回のアーカイブファイルを選ぶ(中身を読むだけ。端末には書かない) */
  const onArchiveAppendFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseArchiveFile(await file.text())
      setArchiveBaseLogs(parsed.logs)
      // 読み込めた件数はボタンの位置に出る（archiveAppendLoaded）ので、ここでは繰り返さない。
      // 読めなかった記録があるときだけ、その事実を出す（黙って減らさない）
      setArchiveMessage(
        parsed.brokenCount > 0
          ? ja.settings.archiveViewBroken.replace('{n}', String(parsed.brokenCount))
          : '',
      )
    } catch (err) {
      setArchiveBaseLogs(null)
      setArchiveMessage(archiveFileErrorMessage(err))
    }
  }

  /**
   * 「ファイルに書き出す」(古い記録)。前回のファイルを選んでいれば中身を引き継いで統合し、
   * 1つのファイルとして出す。書き出しただけでは端末の記録は消さない(削除は別ボタン)。
   * 保存経路はバックアップと同じ考え方(保存先を選べる端末はピッカー・それ以外はダウンロード)だが、
   * バックアップの「前回の場所」は記録し直さない(saveJsonWithPicker)
   */
  const handleArchiveExport = async () => {
    if (archiveBusy || archiveTargets.length === 0) return
    setArchiveBusy(true)
    setArchiveMessage('')
    try {
      const incoming = await toArchivedLogs(archiveTargets)
      const logs = mergeArchiveLogs(archiveBaseLogs ?? [], incoming)
      const json = JSON.stringify(buildArchiveFile(logs))
      const name = archiveFileName()
      let picked = false
      if (fileSaveSupported) {
        try {
          await saveJsonWithPicker(json, name)
          picked = true
        } catch (err) {
          if (isAbortError(err)) return // ユーザーが保存先選択を閉じた: 何も起きなかった扱い
          downloadJson(json, name) // 権限拒否・ピッカーが使えない環境はダウンロードへ切り替える
        }
      } else {
        downloadJson(json, name)
      }
      // 消せるのは「今回ファイルに入れた端末側の記録」だけ(前回のファイルから引き継いだ分は
      // もう端末に無い)。IDで指定するので、書き出したあとに足した記録を巻き込むことはない
      setArchiveExported({
        ids: archiveTargets.map((t) => t.id),
        logs: archiveCounts.logs,
        photos: archiveCounts.photos,
        cutoff: archiveCutoff,
      })
      setArchiveMessage(
        (picked
          ? ja.settings.archiveExportDonePicked
          : ja.settings.archiveExportDoneDownloaded
        )
          .replace('{c}', String(archiveCounts.logs))
          .replace('{p}', String(archiveCounts.photos)),
      )
    } catch {
      setArchiveMessage(ja.settings.archiveExportError)
    } finally {
      setArchiveBusy(false)
    }
  }

  /**
   * 「書き出した記録を端末から消す」(2段階の2段目)。書き出しが済んだ直後だけ出るボタンで、
   * 確認文は規約F(消えるもの・残るものを件数つきで両方書く)
   */
  const handleArchiveDelete = async () => {
    if (!archiveExported) return
    const confirmText = ja.settings.archiveDeleteConfirm
      .replace('{c}', String(archiveExported.logs))
      .replace('{p}', String(archiveExported.photos))
      .replace('{date}', formatArchiveDate(archiveExported.cutoff))
    if (!window.confirm(confirmText)) return
    setArchiveBusy(true)
    try {
      const removed = await deleteArchivedCookedLogs(archiveExported.ids)
      setArchiveExported(null)
      setArchiveMessage(
        removed.logs === 0
          ? ja.settings.archiveDeleteNothing
          : ja.settings.archiveDeleteDone
              .replace('{c}', String(removed.logs))
              .replace('{p}', String(removed.photos)),
      )
    } finally {
      setArchiveBusy(false)
    }
  }

  /** 「アーカイブを見る」: 選んだファイルの中身をその場で読むだけ(端末には保存しない) */
  const onArchiveViewFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = parseArchiveFile(await file.text())
      setArchiveViewLogs(parsed.logs)
      setArchiveViewBroken(parsed.brokenCount)
    } catch (err) {
      setArchiveMessage(archiveFileErrorMessage(err))
    }
  }

  // 「レシピセットを読み込む」欄の「URLから読み込む」「ファイルから読み込む」専用
  // (2026-07-14 オーナー実機フィードバック)。結果を読み込み欄の上部テキスト(recipeSetMessage)
  // で出す。下部トーストとの二重表示はしない
  const showRecipeSetResultInline = (result: {
    added: number
    updated: number
    skipped: number
    excluded: number
  }) => {
    setRecipeSetMessage(formatRecipeSetResult(result))
  }
  const showRecipeSetFetchErrorInline = (err: unknown) => {
    setRecipeSetMessage(
      err instanceof RecipeSetFetchError && err.reason === 'not_found'
        ? ja.settings.recipeSetNotFound
        : ja.settings.recipeSetError,
    )
  }

  const loadRecipeSetFromUrl = async () => {
    const url = recipeSetUrl.trim()
    if (!url) return
    setRecipeSetLoading(true)
    setRecipeSetMessage('')
    try {
      const file = await fetchRecipeSet(url)
      showRecipeSetResultInline(await importRecipeSet(file))
      setRecipeSetUrl('')
    } catch (err) {
      showRecipeSetFetchErrorInline(err)
    } finally {
      setRecipeSetLoading(false)
    }
  }

  const loadRecipeSetFromFile = async (file: File | undefined) => {
    if (!file) return
    setRecipeSetLoading(true)
    setRecipeSetMessage('')
    try {
      const parsed = parseBackup(await file.text())
      showRecipeSetResultInline(await importRecipeSet(parsed))
    } catch {
      setRecipeSetMessage(ja.settings.recipeSetError)
    } finally {
      setRecipeSetLoading(false)
    }
  }

  const reloadStarters = async () => {
    if (!window.confirm(ja.settings.starterReloadConfirm)) return
    await reloadStarterRecipes()
    setMessage(ja.settings.starterReloadDone)
  }

  const addNg = async () => {
    const value = ngInput.trim()
    if (!value || settings.ngIngredients.includes(value)) {
      setNgInput('')
      return
    }
    await updateSettings({ ngIngredients: [...settings.ngIngredients, value] })
    const matchCount = recipes ? recipes.filter((r) => hasNgIngredient(r, [value])).length : 0
    setMessage(
      ja.settings.ngAddedFeedback.replace('{ng}', value).replace('{n}', String(matchCount)),
    )
    setNgInput('')
  }

  const removeNg = async (value: string) => {
    await updateSettings({
      ngIngredients: settings.ngIngredients.filter((ng) => ng !== value),
    })
  }

  const formatDate = (ms: number) => {
    const date = new Date(ms)
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  /**
   * 「購入と解錠」のコード解錠(2026-07-17設定ゼロベース裁定#7の統合入力を継承)。
   * 2026-07-22の全無料化で追加レシピパック(UP-)は製品廃止したため、受け付ける解錠コードは
   * Pro(UR-)のみ。detectCodeKindがUR-以外を'unknown'として弾き、コード形式エラーを出す。
   */
  const activateUnlock = async () => {
    setUnlockChecking(true)
    setUnlockError('')
    try {
      const kind = detectCodeKind(unlockCodeInput)
      if (kind === 'pro') {
        const valid = await isValidProCode(unlockCodeInput)
        if (!valid) {
          setUnlockError(ja.settings.proInvalidCode)
          return
        }
        await updateSettings({
          proCode: normalizeProCode(unlockCodeInput),
          proActivatedAt: Date.now(),
        })
        setUnlockCodeInput('')
      } else {
        setUnlockError(ja.settings.unlockUnknownCode)
      }
    } finally {
      setUnlockChecking(false)
    }
  }

  const homeWidgets = settings.homeWidgets
  const hiddenHomeWidgets = allHomeWidgets.filter((key) => !homeWidgets.includes(key))

  // 2026-08-03 便DH(オーナー指示): 「表示しない」から戻したパーツは末尾ではなく標準の並びの
  // 位置へ返す(従来は必ずホームのいちばん下に出ていた)。入れ先の計算は logic/homeWidgets.ts
  const showHomeWidget = (key: HomeWidgetKey) => {
    void updateSettings({ homeWidgets: restoreHomeWidget(homeWidgets, key) })
  }
  const hideHomeWidget = (key: HomeWidgetKey) => {
    void updateSettings({ homeWidgets: homeWidgets.filter((w) => w !== key) })
  }
  const moveHomeWidget = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= homeWidgets.length) return
    const next = [...homeWidgets]
    ;[next[index], next[target]] = [next[target], next[index]]
    void updateSettings({ homeWidgets: next })
  }

  // 買い物メモの売り場順(2026-08-02 便CT/C15)。保存値は必ず normalizeAisleOrder を通し、
  // 未設定・欠け・未知のキーがあっても6グループ揃った並びとして扱う
  const aisleOrder = normalizeAisleOrder(settings.shoppingAisleOrder)
  const aisleOrderIsDefault = isDefaultAisleOrder(settings.shoppingAisleOrder)
  const moveAisle = (index: number, direction: -1 | 1) => {
    void updateSettings({ shoppingAisleOrder: moveAisleGroup(aisleOrder, index, direction) })
  }
  // 2026-08-04 便DV-3(オーナー指示): 並びを変えていないうちも押せるボタンとして出し、
  // 何が戻って何が変わらないかを確認文で言い切る(規約F)
  const resetAisleOrder = () => {
    if (!window.confirm(ja.settings.aisleOrderResetConfirm)) return
    void updateSettings({ shoppingAisleOrder: [...SHOPPING_AISLE_ORDER] })
    setMessage(ja.settings.aisleOrderResetDone)
  }

  /**
   * ホーム画面のカスタマイズを初期設定に戻す(2026-08-04 便DV-3・オーナー指示)。
   * 戻す対象は「表示するパーツ」「並び順」「『今日なに作る？』を出すとき」の3つ＝この
   * カードの中で変えられるものだけ。レシピ・献立・記録などのデータには触らない(規約F)
   */
  const resetHomeWidgets = () => {
    if (!window.confirm(ja.settings.homeWidgetsResetConfirm)) return
    void updateSettings({
      homeWidgets: [...defaultHomeWidgets],
      homeSuggestionAlways: false,
    })
    setMessage(ja.settings.homeWidgetsResetDone)
  }

  // バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)。30日超(または未実施)で警告色にする
  const backupDaysAgo = daysSinceBackup(settings.lastBackupAt)
  const backupBannerWarning = backupDaysAgo === null || backupDaysAgo > 30
  const backupBannerText =
    backupDaysAgo === null
      ? ja.settings.backupNever
      : backupDaysAgo === 0
        ? ja.settings.bannerLastBackupToday
        : ja.settings.bannerLastBackupDaysAgo.replace('{n}', String(backupDaysAgo))

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.settings.title}</h1>

      {/* 目次チップ(2026-07-17オーナー採用決定で設定を1本スクロール化。旧: 上部タブ4分割2026-07-12〜)。
          パーソナライズ/レシピ/バックアップ/Proの各節へタップでスクロールし、スクロール監視で表示中の節を
          ハイライトする。スクロールしても上部に固定(sticky)。settings-tabbarクラスはindex.cssで
          is-ipad(マルチタスクボタン対策)の上余白をback-header同様に追加している。
          タップ領域は44px相当(py-[13px]・2026-07-16 UI総点検A-5から踏襲) */}
      <div className="settings-tabbar sticky top-0 z-10 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur">
        {/* 元のページへの帰り道(2026-08-02 オーナー指示・便DF)。Pro版の説明などから
            設定の該当欄へ飛んできたときだけ出す。目次チップと同じ固定領域に置くので、
            節へ自動スクロールした後でも画面から消えない */}
        {backTarget && (
          <button
            type="button"
            data-testid="settings-back"
            onClick={() => navigate(backTarget.to)}
            className="mb-2 flex items-center gap-1 rounded-sm py-1 font-bold text-accent-ink"
          >
            <ChevronLeft size={22} aria-hidden />
            {backTarget.label}
          </button>
        )}
        <nav aria-label={ja.settings.tocLabel}>
          {/* 2026-08-02: 「アプリについて」を独立した節にしたのでチップは5つ。390px幅では
              1枡およそ68pxになり、text-xs(12px)だと「バックアップ」の6文字が折り返して
              チップの高さが揃わなくなるため、1px小さくし、字間も詰めて折り返しを止める
              (端末のフォントが少し広くても2行にならないよう whitespace-nowrap も付ける) */}
          <div className="grid grid-cols-5 gap-1">
            {settingsSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                aria-current={activeSection === section.id ? 'true' : undefined}
                className={`overflow-hidden whitespace-nowrap rounded-md border py-[13px] text-[11px] font-bold tracking-tight shadow-sm ${
                  activeSection === section.id
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)。目次チップの下・全節共通の常設
          バナー。タップ/[書き出しへ]ボタンのどちらも「バックアップ節の書き出しへ」導く
          (バナー自体は即ファイル保存を実行しない。写真込みチェック等を確認してから
          「ファイルに書き出す」を押す既存の流れを維持するため)。30日超(または未実施)は警告色。
          ボタン文言は2026-07-30 便CJ/C7で「今すぐ保存」から改名(保存しないのに保存を名乗っていた) */}
      <div
        className={`mt-[var(--space-sm)] flex items-center gap-2 rounded-md border px-[var(--space-sm)] py-2 shadow-sm ${
          backupBannerWarning ? 'border-warning' : 'border-edge'
        }`}
      >
        <HardDriveDownload
          size={16}
          className={`shrink-0 ${backupBannerWarning ? 'text-warning' : 'text-ink-muted'}`}
          aria-hidden
        />
        <button
          type="button"
          onClick={goToBackupExport}
          className={`min-w-0 flex-1 truncate text-left text-sm font-bold ${
            backupBannerWarning ? 'text-warning' : 'text-ink-muted'
          }`}
        >
          {backupBannerText}
        </button>
        <button
          type="button"
          onClick={goToBackupExport}
          className={`shrink-0 rounded-sm border px-2 py-1 text-xs font-bold shadow-sm ${
            backupBannerWarning ? 'border-warning text-warning' : 'border-edge text-accent-ink'
          }`}
        >
          {ja.settings.bannerSaveNow}
        </button>
      </div>

      {/* ===== パーソナライズ 節(旧「全般」・2026-08-03 便DHで改名) ===== */}
      <section id="section-basic" aria-labelledby="section-basic-heading" className="scroll-mt-24">
        <h2 id="section-basic-heading" className={`${nodeHeadingCls} mt-[var(--space-lg)]`}>
          {ja.settings.tabBasic}
        </h2>
        <>
          {/* 見た目(2026-07-16 UI総点検B-2: 9カードフラット並列を4グループに整理。
              テーマカラーを全般節の最上部へ移動。並びとグループ見出しのみでカードの中身は変更しない) */}
          <p className={groupHeadingCls}>{ja.settings.groupAppearanceTitle}</p>

          {/* テーマカラー(旧「テーマ」。2026-07-16 UI総点検B-1: レシピ側「テーマ一覧」との用語衝突のため改名) */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.themeTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.themeDescription}</p>
            <div className="mt-[var(--space-sm)] grid grid-cols-4 gap-[var(--space-sm)]">
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateSettings({ theme: option.value })}
                  className={`rounded-md border py-3 font-bold shadow-sm ${
                    settings.theme === option.value
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* ホーム画面のカスタマイズ */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.homeWidgetsTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.homeWidgetsDescription}</p>
            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
              {homeWidgets.map((key, index) => (
                <li key={key} className="px-[var(--space-sm)] py-2">
                  <div className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 font-bold">{homeWidgetLabels[key]}</span>
                    <button
                      type="button"
                      onClick={() => moveHomeWidget(index, -1)}
                      disabled={index === 0}
                      aria-label={ja.settings.homeWidgetMoveUp}
                      className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                    >
                      <ChevronUp size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveHomeWidget(index, 1)}
                      disabled={index === homeWidgets.length - 1}
                      aria-label={ja.settings.homeWidgetMoveDown}
                      className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                    >
                      <ChevronDown size={18} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => hideHomeWidget(key)}
                      className="rounded-sm border border-edge px-2 py-1 text-xs font-bold text-ink-muted"
                    >
                      {ja.settings.homeWidgetHide}
                    </button>
                  </div>
                  {/* 「今日なに作る？」だけは、いつ出すかも選べる(2026-08-03 便DH・オーナー指示)。
                      既定は今週の献立に今日の予定がない日だけ・「常に表示」で予定があっても出す */}
                  {key === 'suggestion' && (
                    <div className="mt-1">
                      <p className="text-xs text-ink-muted">
                        {ja.settings.homeSuggestionWhenTitle}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {[
                          { always: false, label: ja.settings.homeSuggestionWhenPlanEmpty },
                          { always: true, label: ja.settings.homeSuggestionWhenAlways },
                        ].map((option) => (
                          <button
                            key={option.label}
                            type="button"
                            onClick={() =>
                              void updateSettings({ homeSuggestionAlways: option.always })
                            }
                            aria-pressed={
                              (settings.homeSuggestionAlways === true) === option.always
                            }
                            className={`rounded-sm border px-2 py-1.5 text-xs font-bold ${
                              (settings.homeSuggestionAlways === true) === option.always
                                ? 'border-accent bg-accent text-on-accent'
                                : 'border-edge bg-surface text-ink-muted'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              ))}
              {hiddenHomeWidgets.map((key) => (
                <li key={key} className="flex items-center gap-2 px-[var(--space-sm)] py-2 opacity-60">
                  <span className="min-w-0 flex-1 font-bold">{homeWidgetLabels[key]}</span>
                  <button
                    type="button"
                    onClick={() => showHomeWidget(key)}
                    className="rounded-sm border border-accent px-2 py-1 text-xs font-bold text-accent-ink"
                  >
                    {ja.settings.homeWidgetShow}
                  </button>
                </li>
              ))}
            </ul>
            {/* 初期設定に戻す(2026-08-04 便DV-3・オーナー指示)。売り場順と同じ名前・同じ体裁 */}
            <button
              type="button"
              onClick={resetHomeWidgets}
              className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
            >
              <RotateCcw size={16} aria-hidden />
              {ja.settings.homeWidgetsReset}
            </button>
          </section>

          {/* 食材と価格 */}
          <p className={groupHeadingCls}>{ja.settings.groupIngredientsTitle}</p>

          {/* 食数の設定（2026-08-03 便DK・オーナー指示。名前は2026-08-04 便DVで「ふだん作る人数」から改名）。
              献立に入れた料理を最初からこの人数分として扱う＝買い物メモの分量と、これから作る予定の
              概算食費に効く。未設定なら従来どおりレシピに登録されている人数分。栄養は1人分のまま動かさない。
              2026-08-04 便DV-4(オーナー指示): 並びを 食数の設定→NG食材→予算→食材と価格→売り場順 にした。
              id は直リンク(?section=household)の着地点 */}
          <section id="household-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.householdServingsTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {ja.settings.householdServingsDescription}
            </p>
            <select
              value={settings.householdServings ?? ''}
              onChange={(e) => {
                const value = e.target.value
                void updateSettings({
                  householdServings: value === '' ? undefined : clampServings(Number(value)),
                })
              }}
              aria-label={ja.settings.householdServingsTitle}
              className="mt-[var(--space-sm)] w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink"
            >
              <option value="">{ja.settings.householdServingsNone}</option>
              {householdServingsOptions.map((n) => (
                <option key={n} value={n}>
                  {ja.settings.householdServingsOption.replace('{n}', String(n))}
                </option>
              ))}
            </select>
          </section>

          {/* NG食材。見出し行に件数を常時表示する(2026-07-17設定ゼロベース裁定#2。
              未登録は「未設定」で登録を促す) */}
          <section className={sectionCls}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{ja.settings.ngTitle}</h2>
              <span className="shrink-0 text-sm font-bold text-ink-muted">
                {settings.ngIngredients.length > 0
                  ? ja.settings.ngCount.replace('{n}', String(settings.ngIngredients.length))
                  : ja.settings.ngCountEmpty}
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.ngDescription}</p>
            {settings.ngIngredients.length === 0 ? (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.settings.ngEmpty}
              </p>
            ) : (
              <div className="mt-[var(--space-sm)] flex flex-wrap gap-1">
                {settings.ngIngredients.map((ng) => (
                  <span
                    key={ng}
                    className="inline-flex items-center gap-1 rounded-sm border border-warning px-2 py-1 text-sm font-bold text-warning"
                  >
                    {ng}
                    <button
                      type="button"
                      onClick={() => removeNg(ng)}
                      aria-label={ja.settings.ngRemove}
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              <input
                type="text"
                value={ngInput}
                onChange={(e) => setNgInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addNg()
                  }
                }}
                placeholder={ja.settings.ngPlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={addNg}
                className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-4 font-bold text-accent-ink shadow-sm"
              >
                <Plus size={18} aria-hidden />
                {ja.settings.ngAdd}
              </button>
            </div>
            {/* 登録前でも「効いている」と分かるその場プレビュー */}
            {ngPreviewCount !== undefined && (
              <p className="mt-1 text-sm text-ink-muted">
                {ja.settings.ngMatchPreview.replace('{n}', String(ngPreviewCount))}
              </p>
            )}
          </section>

          {/* 週の食費予算。2026-07-13 UI改善: NG食材の直下（食材と価格の次）に移動。
              id は献立タブの概算食費からの直リンク(?section=budget)の着地点(2026-07-29 便CD/MP-11) */}
          <section id="budget-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.weeklyBudgetTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.weeklyBudgetDescription}</p>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={settings.weeklyBudget ?? ''}
              onChange={(e) => {
                const value = e.target.value
                void updateSettings({ weeklyBudget: value === '' ? undefined : Number(value) })
              }}
              placeholder={ja.settings.weeklyBudgetPlaceholder}
              className="mt-[var(--space-sm)] w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
            />
          </section>

          {/* 食材と価格（食材価格マスタ。詳細・献立の概算食費のフォールバックに使う）。
              2026-07-13 UI改善: 「レシピ」タブからNG食材の直下に移動 */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.priceMasterTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.priceMasterDescription}</p>
            <Link
              to="/prices"
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              <Coins size={18} aria-hidden />
              {ja.settings.priceMasterLink}
            </Link>
          </section>

          {/* 買い物メモの売り場順(2026-08-02 便CT/C15 オーナー承認)。回る順番は店ごとに違うので、
              6グループの並び順だけ入れ替えられるようにする(グループの中身=食材の振り分けは変えない)。
              操作方法はホーム画面のカスタマイズと同じ上下移動に揃える。
              id は買い物メモからの直リンク(?section=aisle)の着地点 */}
          <section id="aisle-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.aisleOrderTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.aisleOrderDescription}</p>
            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
              {aisleOrder.map((key, index) => (
                <li key={key} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
                  <span className="w-6 shrink-0 text-sm font-bold tabular-nums text-ink-muted">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 font-bold">{ja.pantry.group[key]}</span>
                  <button
                    type="button"
                    onClick={() => moveAisle(index, -1)}
                    disabled={index === 0}
                    aria-label={ja.settings.aisleOrderMoveUp}
                    className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                  >
                    <ChevronUp size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveAisle(index, 1)}
                    disabled={index === aisleOrder.length - 1}
                    aria-label={ja.settings.aisleOrderMoveDown}
                    className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                  >
                    <ChevronDown size={18} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
            {aisleOrderIsDefault && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.settings.aisleOrderDefaultNote}
              </p>
            )}
            <button
              type="button"
              onClick={resetAisleOrder}
              className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
            >
              <RotateCcw size={16} aria-hidden />
              {ja.settings.aisleOrderReset}
            </button>
          </section>

          {/* 料理中 */}
          <p className={groupHeadingCls}>{ja.settings.groupCookingTitle}</p>

          {/* 画面を暗くしない。非対応のときだけ「対応していません」・スイッチONで許可が
              下りていないときだけ許可の取り方を出す(2026-08-04 便DV-6/7) */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{ja.settings.screenTitle}</h2>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.screenDescription}</p>
                {shouldShowUnsupportedNote(wakeLockIsSupported) && (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.wakeLockUnsupportedNote}</p>
                )}
                {shouldShowPermissionHelp(
                  settings.keepScreenOn,
                  wakeLockIsSupported,
                  wakeLockPermission,
                ) && (
                  <p className="mt-1 text-sm text-warning">{ja.settings.wakeLockBlockedNote}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.keepScreenOn}
                aria-label={ja.settings.screenTitle}
                onClick={() => {
                  const next = !settings.keepScreenOn
                  void updateSettings({ keepScreenOn: next })
                  if (next) checkWakeLockPermission()
                }}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  settings.keepScreenOn ? 'bg-accent' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                    settings.keepScreenOn ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </section>

          {/* タイマー中は画面を暗くしない（「画面を暗くしない」系の設定をタイマー音より先にまとめる） */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{ja.settings.timerWakeLockTitle}</h2>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.timerWakeLockDescription}</p>
                {shouldShowUnsupportedNote(wakeLockIsSupported) && (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.wakeLockUnsupportedNote}</p>
                )}
                {shouldShowPermissionHelp(
                  settings.timerWakeLockEnabled,
                  wakeLockIsSupported,
                  wakeLockPermission,
                ) && (
                  <p className="mt-1 text-sm text-warning">{ja.settings.wakeLockBlockedNote}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.timerWakeLockEnabled}
                aria-label={ja.settings.timerWakeLockTitle}
                onClick={() => {
                  const next = !settings.timerWakeLockEnabled
                  void updateSettings({ timerWakeLockEnabled: next })
                  if (next) checkWakeLockPermission()
                }}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  settings.timerWakeLockEnabled ? 'bg-accent' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                    settings.timerWakeLockEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </section>

          {/* タイマー音 */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{ja.settings.timerSoundTitle}</h2>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.timerSoundDescription}</p>
                {shouldShowPermissionHelp(
                  settings.timerSoundEnabled,
                  audioIsSupported,
                  audioPermission,
                ) && (
                  <p className="mt-1 text-sm text-warning">{ja.settings.timerSoundBlockedNote}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.timerSoundEnabled}
                aria-label={ja.settings.timerSoundTitle}
                onClick={() => {
                  const next = !settings.timerSoundEnabled
                  void updateSettings({ timerSoundEnabled: next })
                  if (next) checkAudioPermission()
                }}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  settings.timerSoundEnabled ? 'bg-accent' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                    settings.timerSoundEnabled ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>

            {/* 音量と鳴る長さ(2026-08-08 オーナー実機フィードバック③)。
                「調整や確認できるように」なので、その場で鳴らして確かめるボタンを必ず添える。
                タイマー音がOFFのあいだは押せない状態にし、理由を1行で書く */}
            {/* 画面には出したまま押せなくする（存在ごと消すと「音量を変えられる」こと自体が
                見えなくなるため）。読み上げからも隠さない＝aria-hiddenは付けない */}
            <div
              className={`mt-[var(--space-md)] ${
                settings.timerSoundEnabled ? '' : 'opacity-40'
              }`}
            >
              <p className="text-sm font-bold text-ink-muted">{ja.settings.timerSoundVolumeLabel}</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {TIMER_SOUND_VOLUMES.map((value) => {
                  const selected = (settings.timerSoundVolume ?? 'normal') === value
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!settings.timerSoundEnabled}
                      aria-pressed={selected}
                      onClick={() => {
                        void updateSettings({ timerSoundVolume: value })
                        // 選んだ音をその場で鳴らす（押した瞬間＝ユーザー操作中なので音が出せる）
                        playTimerChime(undefined, { volume: value, length: settings.timerSoundLength })
                      }}
                      className={`rounded-sm border py-2 text-sm font-bold shadow-sm ${
                        selected
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-edge bg-surface text-ink-muted'
                      }`}
                    >
                      {timerVolumeLabels[value]}
                    </button>
                  )
                })}
              </div>

              <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
                {ja.settings.timerSoundLengthLabel}
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {TIMER_SOUND_LENGTHS.map((value) => {
                  const selected = (settings.timerSoundLength ?? 'short') === value
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={!settings.timerSoundEnabled}
                      aria-pressed={selected}
                      onClick={() => {
                        void updateSettings({ timerSoundLength: value })
                        playTimerChime(undefined, { volume: settings.timerSoundVolume, length: value })
                      }}
                      className={`rounded-sm border py-2 text-sm font-bold tabular-nums shadow-sm ${
                        selected
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-edge bg-surface text-ink-muted'
                      }`}
                    >
                      {timerLengthLabel(value)}
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                disabled={!settings.timerSoundEnabled}
                onClick={() => {
                  playTimerChime(undefined, {
                    volume: settings.timerSoundVolume,
                    length: settings.timerSoundLength,
                  })
                  checkAudioPermission()
                }}
                className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
              >
                <Volume2 size={18} aria-hidden />
                {ja.settings.timerSoundPreview}
              </button>
            </div>
            {!settings.timerSoundEnabled && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.settings.timerSoundOffNote}
              </p>
            )}
          </section>

        </>
      </section>

      {/* ===== レシピ 節 ===== */}
      <section id="section-recipe" aria-labelledby="section-recipe-heading" className="scroll-mt-24">
        <h2
          id="section-recipe-heading"
          className={`${nodeHeadingCls} mt-[var(--space-lg)] border-t border-edge pt-[var(--space-lg)]`}
        >
          {ja.settings.tabRecipe}
        </h2>
        <>
          {/* 基本レシピ */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.starterTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {ja.settings.starterDescription.replace('{n}', String(starterCount))}
            </p>
            <label className="mt-[var(--space-sm)] flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm font-bold text-ink-muted">{ja.settings.starterHide}</span>
              <button
                type="button"
                role="switch"
                aria-checked={settings.hideStarters}
                aria-label={ja.settings.starterHide}
                onClick={() => updateSettings({ hideStarters: !settings.hideStarters })}
                className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  settings.hideStarters ? 'bg-accent' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                    settings.hideStarters ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
            <button
              type="button"
              onClick={reloadStarters}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              <RotateCcw size={18} aria-hidden />
              {ja.settings.starterReload}
            </button>
          </section>

          {/* レシピセットの読み込み */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.recipeSetTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.recipeSetDescription}</p>
            {/* 読み込み結果は読み込み欄の上部にテキストで表示する(2026-07-14 オーナー実機
                フィードバック: 以前は下部トーストのみで、縦に長いページでは気づきにくかった。
                この機能に限り上部テキストにし、下部トーストとの二重表示はしない) */}
            {recipeSetMessage && (
              <p
                role="status"
                className="mt-[var(--space-sm)] rounded-sm border border-accent bg-app px-3 py-2 text-sm font-bold text-accent-ink"
              >
                {recipeSetMessage}
              </p>
            )}
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              <input
                type="url"
                inputMode="url"
                value={recipeSetUrl}
                onChange={(e) => setRecipeSetUrl(e.target.value)}
                placeholder={ja.settings.recipeSetUrlPlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => void loadRecipeSetFromUrl()}
                disabled={recipeSetLoading || !recipeSetUrl.trim()}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent-ink shadow-sm disabled:opacity-40"
              >
                <Link2 size={18} aria-hidden />
                {ja.settings.recipeSetUrlLoad}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-muted">{ja.settings.recipeSetUrlHint}</p>
            <input
              ref={recipeSetFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void loadRecipeSetFromFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => recipeSetFileRef.current?.click()}
              disabled={recipeSetLoading}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              <Upload size={18} aria-hidden />
              {recipeSetLoading ? ja.settings.recipeSetLoading : ja.settings.recipeSetFileLoad}
            </button>
          </section>
        </>
      </section>

      {/* ===== バックアップ 節 ===== */}
      <section id="section-backup" aria-labelledby="section-backup-heading" className="scroll-mt-24">
        <h2
          id="section-backup-heading"
          className={`${nodeHeadingCls} mt-[var(--space-lg)] border-t border-edge pt-[var(--space-lg)]`}
        >
          {ja.settings.tabBackup}
        </h2>
        <>
          {/* ①バックアップを取る(2026-07-17バックアップ改修 修正5でカード再構成。
              修正2+3: File System Access API対応ブラウザは保存先選択+前回の場所に上書きボタンを併設) */}
          <section id="backup-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.backupTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.backupDescription}</p>
            {/* 修正1: バックアップに購入コードが含まれることの注意喚起 */}
            <p className="mt-[var(--space-sm)] flex items-start gap-1 text-xs text-ink-muted">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              {ja.settings.backupContainsCodeNotice}
            </p>
            <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
              {settings.lastBackupAt
                ? ja.settings.backupLastDate.replace('{date}', formatDate(settings.lastBackupAt))
                : ja.settings.backupNever}
            </p>
            {showCookedPhotoLimitBanner && (
              <p className="mt-[var(--space-sm)] rounded-sm bg-app px-3 py-2 text-sm text-ink-muted">
                {ja.settings.cookedPhotoOverLimitBanner.replace('{n}', String(bytesToMB(cookedPhotoBytes)))}
              </p>
            )}
            <label className="mt-[var(--space-sm)] flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeCookedPhotos}
                onChange={(e) => setIncludeCookedPhotos(e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              <span>
                {ja.settings.backupIncludeCookedPhotos}
                <span className="mt-0.5 block text-xs text-ink-muted">
                  {ja.settings.backupIncludeCookedPhotosNote}
                </span>
              </span>
            </label>
            <button
              type="button"
              disabled={exportBusy}
              onClick={() => void handleExportPick()}
              className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm disabled:opacity-60"
            >
              <Download size={18} aria-hidden />
              {ja.settings.backupExport}
            </button>
            {/* 「前回の場所に上書き」: File System Access API対応ブラウザで、一度でも保存先を
                選んだことがある場合だけ併設で出す(2026-07-17修正2+3) */}
            {fileSaveSupported && savedHandleExists && (
              <>
                <button
                  type="button"
                  disabled={exportBusy}
                  onClick={() => void handleExportOverwrite()}
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-60"
                >
                  <Save size={18} aria-hidden />
                  {ja.settings.backupOverwrite}
                </button>
                {/* 便CJ/C10: 上書き先のファイル名が分かるときは出す(どのファイルに上書きされるのか
                    画面から確認できなかった。フォルダの場所はブラウザから取得できない) */}
                <p className="mt-1 text-xs text-ink-muted">
                  {savedHandleName
                    ? ja.settings.backupOverwriteNoteWithName.replace('{name}', savedHandleName)
                    : ja.settings.backupOverwriteNote}
                </p>
              </>
            )}
          </section>

          {/* ②バックアップを読み込む: 「今のデータに追加」「データを上書き」を並べて配置し、
              それぞれに説明キャプションを付ける(2026-07-17修正5。以前は縦積みで上書きだけ警告色が
              浮いて見えていたのを解消。ボタン文言は2026-08-02 オーナー指示で短くした) */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.backupRestoreTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.backupRestoreDescription}</p>
            <input
              ref={importFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onImportFile(e.target.files?.[0])
                e.target.value = '' // 同じファイルをもう一度選べるように
              }}
            />
            <div className="mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)]">
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => pickImportFile('merge')}
                  className="flex h-full min-h-14 items-center justify-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-3 text-center text-sm font-bold text-accent-ink shadow-sm disabled:opacity-60"
                >
                  <Upload size={18} className="shrink-0" aria-hidden />
                  <span>{ja.settings.backupImportMerge}</span>
                </button>
                <p className="mt-1 text-xs text-ink-muted">{ja.settings.backupImportMergeNote}</p>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  disabled={importBusy}
                  onClick={() => pickImportFile('replace')}
                  className="flex h-full min-h-14 items-center justify-center gap-1.5 rounded-md border border-warning px-2 py-3 text-center text-sm font-bold text-warning disabled:opacity-60"
                >
                  <Upload size={18} className="shrink-0" aria-hidden />
                  <span>{ja.settings.backupImportReplace}</span>
                </button>
                <p className="mt-1 flex items-start gap-1 text-xs font-bold text-warning">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                  {ja.settings.importReplaceCaption}
                </p>
              </div>
            </div>
            {/* 読み込み中の進捗表示(便CJ/C15)と、読み込み結果の内訳(便CJ/C1(d)・C11・C12)。
                結果はトーストと違って消えないので、あとから「本当に戻ったか」を確かめられる */}
            {importBusy && (
              <p className="mt-[var(--space-md)] text-sm font-bold text-accent-ink" role="status" aria-live="polite">
                {ja.settings.backupImportLoading}
              </p>
            )}
            {!importBusy && importResultLines.length > 0 && (
              <ul
                className="mt-[var(--space-md)] space-y-1 rounded-sm bg-app px-3 py-2 text-sm font-bold text-accent-ink"
                role="status"
                aria-live="polite"
              >
                {importResultLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>

          {/* ③古い記録の書き出し(2026-08-02 オーナー採用「1ヶ月だけ端末に残して古い記録は外へ」)。
              目的は端末容量の軽量化。書き出し→(ファイルを確かめてから)削除の2段階で、
              1つのボタンにまとめない(保存に失敗したまま消えると控えが無くなるため) */}
          <section id="archive-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.archiveTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.archiveDescription}</p>

            {/* 「◯ヶ月より前」の選択(既定1ヶ月)。切り替えたら書き出し済みの状態は消す
                (別の範囲で書き出したファイルに対する削除ボタンが残ると取り違えるため) */}
            <fieldset className="mt-[var(--space-md)]">
              <legend className="text-sm font-bold">{ja.settings.archivePeriodLabel}</legend>
              <div className="mt-[var(--space-sm)] grid grid-cols-3 gap-[var(--space-sm)]">
                {ARCHIVE_MONTH_OPTIONS.map((months) => (
                  <button
                    key={months}
                    type="button"
                    aria-pressed={archiveMonths === months}
                    onClick={() => {
                      setArchiveMonths(months)
                      setArchiveExported(null)
                      setArchiveMessage('')
                    }}
                    className={`rounded-md border py-3 text-sm font-bold shadow-sm ${
                      archiveMonths === months
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge bg-app text-accent-ink'
                    }`}
                  >
                    {ja.settings.archivePeriodOption.replace('{n}', String(months))}
                  </button>
                ))}
              </div>
            </fieldset>

            <p
              data-testid="archive-target-count"
              className="mt-[var(--space-md)] text-sm font-bold text-accent-ink"
            >
              {archiveCounts.logs === 0
                ? ja.settings.archiveTargetNone.replace('{n}', String(archiveMonths))
                : ja.settings.archiveTargetCount
                    .replace('{n}', String(archiveMonths))
                    .replace('{c}', String(archiveCounts.logs))
                    .replace('{p}', String(archiveCounts.photos))}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {ja.settings.archiveKeepNote.replace('{date}', formatArchiveDate(archiveCutoff))}
            </p>

            {/* 対象が0件のときは書き出しボタン自体を出さない(押せないボタンを置かない) */}
            {archiveCounts.logs > 0 && (
              <>
                <input
                  ref={archiveAppendFileRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    void onArchiveAppendFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                {archiveBaseLogs ? (
                  <div className="mt-[var(--space-md)] flex items-start gap-2 rounded-sm bg-app px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 font-bold text-accent-ink">
                      {ja.settings.archiveAppendLoaded.replace(
                        '{n}',
                        String(archiveBaseLogs.length),
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setArchiveBaseLogs(null)
                        setArchiveMessage('')
                      }}
                      className="shrink-0 rounded-sm border border-edge px-2 py-1 text-xs font-bold text-accent-ink"
                    >
                      {ja.settings.archiveAppendClear}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={archiveBusy}
                    onClick={() => archiveAppendFileRef.current?.click()}
                    className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-60"
                  >
                    <Upload size={18} aria-hidden />
                    {ja.settings.archiveAppendButton}
                  </button>
                )}
                <p className="mt-1 text-xs text-ink-muted">{ja.settings.archiveAppendNote}</p>
                <button
                  type="button"
                  disabled={archiveBusy}
                  onClick={() => void handleArchiveExport()}
                  className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm disabled:opacity-60"
                >
                  <HardDriveDownload size={18} aria-hidden />
                  {archiveBusy ? ja.settings.archiveExportBusy : ja.settings.archiveExportButton}
                </button>
              </>
            )}

            {/* 2段目: 書き出しが済んで初めて出す削除ボタン */}
            {archiveExported && (
              <>
                <button
                  type="button"
                  disabled={archiveBusy}
                  onClick={() => void handleArchiveDelete()}
                  className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-warning py-3 font-bold text-warning disabled:opacity-60"
                >
                  <TriangleAlert size={18} aria-hidden />
                  {ja.settings.archiveDeleteButton}
                </button>
                <p className="mt-1 text-xs font-bold text-warning">
                  {ja.settings.archiveDeleteNote}
                </p>
              </>
            )}

            {archiveMessage && (
              <p
                data-testid="archive-message"
                className="mt-[var(--space-md)] rounded-sm bg-app px-3 py-2 text-sm font-bold text-accent-ink"
                role="status"
                aria-live="polite"
              >
                {archiveMessage}
              </p>
            )}

            {/* 通常のバックアップとの関係(端末から消した記録はバックアップに入らない) */}
            <p className="mt-[var(--space-md)] flex items-start gap-1 text-xs text-ink-muted">
              <Info size={14} className="mt-0.5 shrink-0" aria-hidden />
              {ja.settings.archiveBackupNote}
            </p>

            {/* アーカイブを見る: 読み込み専用の一時閲覧(端末には保存しない) */}
            <input
              ref={archiveViewFileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                void onArchiveViewFile(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => archiveViewFileRef.current?.click()}
              className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              <Eye size={18} aria-hidden />
              {ja.settings.archiveViewButton}
            </button>
            <p className="mt-1 text-xs text-ink-muted">{ja.settings.archiveViewNote}</p>
          </section>

          {/* 機種変更・引っ越しガイド(2026-07-17設定ゼロベース裁定#5)。折りたたみ式で、
              普段は畳んでおき機種変更のときだけ開く想定 */}
          <section className={sectionCls}>
            {/* 開閉ボタンのタップ領域を44px級にする(py-[10px]+行の高さ24px。2026-07-30 便CJ/C14。
                同じ節の他のボタンは全て40px以上あるのにここだけ24pxで、
                「スマホ縦画面基準・ボタン大きめ」の方針から外れていた。上下の余白は
                -my-[10px]で打ち消し、カードの見た目は変えない) */}
            <button
              type="button"
              onClick={() => setMoveGuideOpen((v) => !v)}
              aria-expanded={moveGuideOpen}
              className="-my-[10px] flex w-full items-center justify-between gap-2 py-[10px] text-left font-bold"
            >
              {ja.settings.moveGuideToggle}
              <ChevronDown
                size={18}
                className={`shrink-0 text-ink-muted transition-transform ${moveGuideOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {moveGuideOpen && (
              <div className="mt-[var(--space-md)]">
                <ol className="space-y-1 text-sm text-ink-muted">
                  <li>{ja.settings.moveGuideStep1}</li>
                  <li>{ja.settings.moveGuideStep2}</li>
                  <li>{ja.settings.moveGuideStep3}</li>
                  <li>{ja.settings.moveGuideStep4}</li>
                </ol>
                <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                  {ja.settings.moveGuideTransferNote}
                </p>
                <a
                  href="/about/manual.html#backup"
                  className="mt-1 inline-block text-xs font-bold text-accent-ink underline"
                >
                  {ja.settings.moveGuideTransferLink}
                </a>
                <p className="mt-[var(--space-sm)] flex items-start gap-1 text-xs font-bold text-warning">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
                  {ja.settings.moveGuideNote}
                </p>
              </div>
            )}
          </section>

          {/* ③困ったとき: SWとキャッシュだけ消してリロードする安全な機能(2026-07-16新設。
              2026-07-17修正4でボタン文言・説明文を全面改訂)。
              レシピ・価格・購入コード等のIndexedDBデータには一切触れない(src/logic/appRefresh.ts参照) */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.refreshAppTitle}</h2>
            <ul className="mt-1 space-y-1 text-sm text-ink-muted">
              <li>{ja.settings.refreshAppWhenToUse}</li>
              <li>{ja.settings.refreshAppWhatIsCleared}</li>
              <li>{ja.settings.refreshAppWhatRemains}</li>
            </ul>
            <button
              type="button"
              onClick={() => {
                if (window.confirm(ja.settings.refreshAppConfirm)) {
                  void refreshApp().then((result) => {
                    if (result === 'offline') window.alert(ja.settings.refreshAppOffline)
                  })
                }
              }}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              <RefreshCw size={18} aria-hidden />
              {ja.settings.refreshAppButton}
            </button>
            {/* 修正4: ブラウザ自体のキャッシュクリア機能を使う場合の注意
                (「Cookieと他のサイトデータ」を消すとIndexedDBごと消える事故の再発防止) */}
            <p className="mt-[var(--space-md)] flex items-start gap-1 text-xs font-bold text-warning">
              <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
              {ja.settings.refreshAppCacheClearWarning}
            </p>
          </section>

          {/* 三重の網の(c): 置き換え直後に1回だけ出す「元に戻す」バナー
              (2026-07-17設定ゼロベース裁定#6c)。画面固定表示で、[元に戻す]/×で閉じるか
              設定画面を離れる(アンマウント)と消える(1本スクロール化でタブ切り替えは無くなった) */}
          {replaceUndoAvailable && (
            <div
              className="fixed inset-x-0 z-[70] flex justify-center px-[var(--space-md)]"
              style={{ bottom: 'calc(160px + env(safe-area-inset-bottom))' }}
              role="status"
            >
              <div className="flex w-full max-w-sm items-start gap-2 rounded-md border border-accent bg-surface px-4 py-3 shadow-md motion-safe:animate-toast-in">
                <span className="min-w-0 flex-1 text-sm font-bold text-accent-ink">
                  {ja.settings.replaceUndoMessage}
                </span>
                <button
                  type="button"
                  onClick={() => void handleUndoReplace()}
                  className="shrink-0 rounded-sm border border-accent px-2 py-1 text-xs font-bold text-accent-ink"
                >
                  {ja.settings.replaceUndoButton}
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceUndoAvailable(false)}
                  aria-label={ja.settings.replaceUndoDismiss}
                  className="shrink-0"
                >
                  <X size={16} className="text-accent-ink" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      </section>

      {/* ===== Pro 節 ===== */}
      <section id="section-pro" aria-labelledby="section-pro-heading" className="scroll-mt-24">
        <h2
          id="section-pro-heading"
          className={`${nodeHeadingCls} mt-[var(--space-lg)] border-t border-edge pt-[var(--space-lg)]`}
        >
          {ja.settings.tabPro}
        </h2>
        <>
          {/* 購入と解錠。2026-07-22の全無料化で収録レシピ(基本+全テーマ)は全て無料になり、
              有料は買い切りProの機能解錠(登録無制限・栄養8項目と栄養並び替え・月間献立)のみ。
              2026-08-01 線引きB': 栄養8項目には食塩相当量を含み、栄養並び替えのうちカロリー順だけは
              無料でも使える(無料で見えるのはエネルギーと野菜量)。
              追加レシピパック(UP-)は製品廃止したため、この画面はPro(UR-)の解錠だけを扱う。
              解錠済みコードはマスク表示+コピー(2026-07-17設定ゼロベース裁定#4)を添える */}
          <section id="pro-section" className={`${sectionCls} scroll-mt-24`}>
            <h2 className="font-bold">{ja.settings.unlockTitle}</h2>

            {settings.proCode ? (
              /* ===== 解錠済み(2026-08-03 便DNの再構成では触っていない) ===== */
              <>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.unlockDescription}</p>

                {/* 精度開示(2026-08-02 便CP-2・docs/62 決定④)。解錠済みの人にも出し続ける
                    （買ったあとに前提が消えるのは不誠実なので隠さない） */}
                <p
                  data-testid="pro-accuracy-notice"
                  className="mt-[var(--space-sm)] text-xs text-ink-muted"
                >
                  {ja.settings.unlockAccuracyNotice}
                </p>

                <ul className="mt-[var(--space-sm)] rounded-md border border-edge bg-app">
                  {/* Pro版の行 */}
                  <li className="px-[var(--space-sm)] py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold">{ja.settings.proTitle}</span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-accent-ink">{ja.settings.proActivatedTitle}</p>
                    {settings.proActivatedAt && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ja.settings.proActivatedDate.replace('{date}', formatDate(settings.proActivatedAt))}
                      </p>
                    )}
                    <UnlockCodeDisplay code={settings.proCode} />
                  </li>
                </ul>

                {/* Pro解錠直後に「何が使えるようになったか」を控えめに案内する(2026-07-09ペルソナ第2波)。
                    解錠中ずっと表示され続ける(2026-07-13 UI改善) */}
                <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-app p-[var(--space-sm)]">
                  <p className="text-sm font-bold">{ja.settings.proActivatedFeaturesTitle}</p>
                  {/* 機能名だけでなく「どこを開けば見られるか」と、その画面への入口を添える
                      (2026-07-28 便BY/DISC-01。8項目表・期間の集計は数手先にあり到達しにくかった) */}
                  <ul className="mt-1 space-y-2 text-sm">
                    {ja.settings.proActivatedFeatures.map((feature) => (
                      <li key={feature.label}>
                        <p className="font-bold">・{feature.label}</p>
                        <p className="text-sm text-ink-muted">{feature.hint}</p>
                        {feature.to && feature.linkLabel && (
                          <Link to={feature.to} className="text-sm font-bold text-accent-ink underline">
                            {feature.linkLabel}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              /* ===== 未解錠(2026-08-03 オーナー指示・便DNで1枠に再構成) =====
                 指示: 「解錠コードの入力欄がわかりづらい。購入とコード入力欄は隣り合わせにして。
                 機能説明は最低限にして一つの枠内に収める」。
                 並びは (1)Pro版の一言 (2)精度開示 (3)購入ボタン (4)解錠コード入力欄 (5)購入後の手順
                 (6)説明リンク。(3)と(4)の間には何も挟まない＝「買う→すぐ下に入力」の動線。
                 機能の詳しい説明と月間サンプルの入口は、この枠の外へ下げた(下記) */
              <>
                <p className="mt-1 text-sm">{ja.settings.proLead}</p>

                {/* 精度開示(2026-08-02 便CP-2・docs/62 決定④)。「購入ボタンの上」と
                    「解錠コード入力欄の直上」の両方を満たす位置に1つだけ置く
                    (購入ボタンと入力欄が隣り合わせになったため、同じ文を2回出すと
                     枠の中で同じ段落が続けて並んでしまう) */}
                <p
                  data-testid="pro-accuracy-notice"
                  className="mt-[var(--space-sm)] text-xs text-ink-muted"
                >
                  {ja.settings.unlockAccuracyNotice}
                </p>

                {/* 早期価格の注記(2026-08-03 オーナー指示)。購入ボタンのすぐ上に1行だけ置く
                    (ボタンと入力欄の間には何も挟まないため、注記は上側)。
                    正式版の金額はアプリには書かない＝対外表記は早期価格のみ */}
                <p
                  data-testid="pro-early-price-note"
                  className="mt-[var(--space-sm)] text-xs text-ink-muted"
                >
                  {ja.settings.proEarlyPriceNote}
                </p>

                {/* 購入導線(2026-08-02 便DD・発売と同時)。決済ページ(Stripe)は別サイトなので
                    新しいタブで開く(アプリを閉じずに戻ってこられる) */}
                <a
                  href={PRO_PURCHASE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="pro-buy-link"
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center rounded-md bg-accent px-4 py-3 text-center font-bold text-on-accent shadow-sm"
                >
                  {ja.settings.proBuyLabel}
                </a>

                {/* 解錠コード入力欄。購入ボタンの直後に置く(間に要素を入れない・便DN) */}
                <div data-testid="unlock-code-row" className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
                  <input
                    type="text"
                    value={unlockCodeInput}
                    onChange={(e) => {
                      setUnlockCodeInput(e.target.value)
                      setUnlockError('')
                    }}
                    placeholder={ja.settings.unlockCodePlaceholder}
                    className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                  />
                  <button
                    type="button"
                    onClick={() => void activateUnlock()}
                    disabled={unlockChecking || !unlockCodeInput.trim()}
                    className="inline-flex shrink-0 items-center rounded-sm bg-accent px-4 font-bold text-on-accent disabled:opacity-40"
                  >
                    {unlockChecking ? ja.settings.unlockActivating : ja.settings.unlockActivate}
                  </button>
                </div>
                {unlockError && <p className="mt-1 text-sm font-bold text-warning">{unlockError}</p>}

                <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.settings.proBuyNote}</p>

                {/* 説明リンク1本と特商法表記(特商法表記は購入ボタンと同じ枠内に置く) */}
                <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-x-[var(--space-md)] gap-y-1">
                  <a
                    href="/about/manual.html#pro"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-testid="pro-detail-link"
                    className="text-sm font-bold text-accent-ink underline"
                  >
                    {ja.settings.proDetailLink}
                  </a>
                  <a
                    href="/about/tokushoho.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-ink-muted underline"
                  >
                    {ja.settings.proBuyLegalLink}
                  </a>
                </div>
              </>
            )}
          </section>

          {/* 機能説明とお試しの入口は枠の外・小さく(2026-08-03 オーナー指示・便DN)。
              「月間の献立をサンプルで見る」が枠の中でアクセント枠のボタンとして出ていたため、
              解錠コードの入力欄より目立ってしまっていた。機能は消さずに、
              説明は折りたたみ・サンプルの入口は文字リンクへ格下げする */}
          {!settings.proCode && (
            <div className="mt-[var(--space-sm)] px-[var(--space-md)]">
              <details data-testid="pro-features-details">
                <summary className="cursor-pointer text-sm text-ink-muted">
                  {ja.settings.proFeaturesToggle}
                </summary>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.proDescription}</p>
              </details>
              <p className="mt-[var(--space-sm)]">
                <Link
                  to="/month-demo?back=%2Fsettings%3Fsection%3Dpro"
                  data-testid="settings-month-demo-link"
                  className="text-sm text-accent-ink underline"
                >
                  {ja.settings.monthDemoLink}
                </Link>
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{ja.mealPlan.monthDemoLinkNote}</p>
            </div>
          )}
        </>
      </section>

      {/* ===== うちレシピについて 節 =====
          2026-08-02 オーナー指示: 旧「全般」節の中の「その他」グループをページ最後の独立した節に
          移した。中身(バージョン・データ件数・紹介ページ・利用規約・ご意見箱)は変えていない。
          節の見出しがカードの見出しを兼ねるので、カード側のh2は置かない */}
      <section id="section-about" aria-labelledby="section-about-heading" className="scroll-mt-24">
        <h2
          id="section-about-heading"
          className={`${nodeHeadingCls} mt-[var(--space-lg)] border-t border-edge pt-[var(--space-lg)]`}
        >
          {ja.settings.aboutTitle}
        </h2>
        <section className={sectionCls}>
          {/* バージョン+データ件数(2026-07-17設定ゼロベース裁定#3。問い合わせ対応に必須) */}
          <p className="text-sm text-ink-muted">
            {ja.settings.aboutVersion.replace('{v}', __APP_VERSION__)}
          </p>
          <p className="text-sm text-ink-muted">
            {ja.settings.aboutDataCount
              .replace('{r}', String(dataCounts.recipes))
              .replace('{c}', String(dataCounts.cookedLogs))}
          </p>
          {/* 別窓(target="_blank")にしない: iOSのホーム画面追加アプリはSafariとストレージが別のため */}
          <a
            href="/about/"
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
          >
            <Info size={18} aria-hidden />
            {ja.settings.aboutPageLink}
          </a>
          <a
            href="/about/terms.html"
            className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent-ink underline"
          >
            {ja.settings.termsLink}
          </a>
          {/* ご意見箱はGoogleフォーム(外部サイト)なので別窓でよい */}
          <a
            href={ja.settings.feedbackFormUrl}
            target="_blank"
            rel="noopener"
            className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent-ink underline"
          >
            {ja.settings.feedbackLink}
          </a>
        </section>
      </section>

      {/* アーカイブファイルの一時閲覧(2026-08-02)。開いている間だけ中身をメモリに持ち、
          閉じると何も残らない(IndexedDBには一切書かない) */}
      <ArchiveViewerModal
        open={archiveViewLogs !== null}
        logs={archiveViewLogs ?? []}
        brokenCount={archiveViewBroken}
        onClose={() => {
          setArchiveViewLogs(null)
          setArchiveViewBroken(0)
        }}
      />

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}
