import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Plus,
  X,
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
} from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import { listRecipes, deleteRecipesBySourceSet } from '../db/recipes'
import { listSetExclusions, clearSetExclusions } from '../db/setExclusions'
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
} from '../logic/backup'
import { hasNgIngredient } from '../logic/ng'
import { refreshApp } from '../logic/appRefresh'
import {
  supportsSaveFilePicker,
  saveWithPicker,
  overwriteSavedFile,
  hasSavedFileHandle,
  backupFileName,
  isAbortError,
} from '../logic/fileSave'
import {
  totalCookedLogPhotoBytes,
  isOverCookedPhotoLimit,
  bytesToMB,
} from '../logic/cookedPhotoStorage'
import {
  isValidProCode,
  normalizeProCode,
  isValidPackCode,
  normalizePackCode,
  hasPaidRecipeAccess,
  detectCodeKind,
  maskUnlockCode,
} from '../logic/pro'
import { fetchThemeManifest, type ThemeManifestEntry } from '../logic/themeManifest'
import type { HomeWidgetKey, ThemeSetting } from '../db/types'
import { ja } from '../i18n/ja'
import Toast from '../components/Toast'

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
  ingredientSearch: ja.home.ingShortcutTitle,
  history: ja.home.historyTitle,
}

const sectionCls =
  'mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm'

// 全般タブの小見出し(2026-07-16 UI総点検B-2: 9カードフラット並列を4グループに整理)。
// 既存のセクション見出しパターン(RecipesPageの絞り込みパネル等)に合わせ、小さめの text-sm font-bold
const groupHeadingCls = 'mt-[var(--space-lg)] text-sm font-bold text-ink-muted'

// Wake Lock API非対応環境（'wakeLock' in navigator が false）かどうか。
// 画面が消えない系トグルの説明の下に注記を出すために使う(useWakeLock.tsのロジック自体は変更しない)
const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

// File System Access API対応ブラウザ(Chrome/Edge等)かどうか(2026-07-17バックアップ改修
// 修正2+3)。対応環境のみ保存先選択・「前回の場所に上書き」を出し、非対応(Safari/Firefox)は
// 従来どおりの自動ダウンロードのままにする(ブラウザ機能自体の対応可否なのでセッション中は不変)
const fileSaveSupported = supportsSaveFilePicker()

/**
 * 設定画面のタブ分割(2026-07-12オーナー実機フィードバック)。
 * 縦に長大化した設定画面を上部タブ4つに分割する。区分はFable裁定どおり:
 * 基本=NG食材/画面暗くしない系/タイマー音/テーマ/週の食費予算/ホームのカスタマイズ
 *   (+ 未指定だった「アプリについて」もここに置く。最も汎用的なタブの末尾が収まりが良いため)
 * レシピ=基本レシピ/レシピセットを読み込む/テーマ一覧/食材と価格へのリンク
 * バックアップ=バックアップ一式
 * Pro・パック=Pro版/追加レシピパック
 * タブ状態の持ち方(URL or ローカルstate)は指示側の2択(規約C)。ローカルstateを選択（理由:
 * 既存の?section=/?set=クエリと絡めてタブ用の?tabまで増やすと分岐が複雑になり規約C②
 * 「既存機能を妨げない」に反しやすいため。ローカルstateなら?section=/?set=の処理は
 * 「見つけたら該当タブへ切り替える」の1箇所追加だけで済む）
 */
type SettingsTab = 'basic' | 'recipe' | 'backup' | 'pro'

const settingsTabs: { id: SettingsTab; label: string }[] = [
  { id: 'basic', label: ja.settings.tabBasic },
  { id: 'recipe', label: ja.settings.tabRecipe },
  { id: 'backup', label: ja.settings.tabBackup },
  { id: 'pro', label: ja.settings.tabProPack },
]

// ?section=pro / ?section=themes / ?section=backup の直リンクが、タブ化後もどのタブの
// どの要素までスクロールするか(backupは2026-07-16 ホーム「しばらくバックアップしていません」
// リンクの遷移先として追加。既存の?section=直リンクの仕組みをそのまま流用する)
const sectionDeepLinks: Record<string, { tab: SettingsTab; elementId: string }> = {
  pro: { tab: 'pro', elementId: 'pro-section' },
  themes: { tab: 'recipe', elementId: 'theme-list-section' },
  backup: { tab: 'backup', elementId: 'backup-section' },
}

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
 * 「読み込む（今のデータと置き換え）」の確認文を件数入りで組み立てる
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
        className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge px-2 py-1 text-xs font-bold text-accent shadow-sm"
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
  // 再取込除外の記録(トゥームストーン)。テーマ一覧の「除外中◯品・すべて戻す」表示に使う
  const setExclusions = useLiveQuery(listSetExclusions, [])
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
  const [exportBusy, setExportBusy] = useState(false)
  // 設定画面のタブ(2026-07-12オーナー実機フィードバックのタブ分割)
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic')
  // 置き換え直後1回だけ出す「元に戻す」バナー(2026-07-17設定ゼロベース裁定#6c・三重の網の(c))。
  // タブを切り替える(=画面遷移)と消える(下のuseEffect参照)
  const [replaceUndoAvailable, setReplaceUndoAvailable] = useState(false)
  // バックアップタブ「機種変更するときは」の折りたたみ開閉(2026-07-17設定ゼロベース裁定#5)
  const [moveGuideOpen, setMoveGuideOpen] = useState(false)

  // 前回の保存先ハンドルの記録有無を起動時に1回確認する(2026-07-17バックアップ改修 修正2+3。
  // 非対応ブラウザでは常にfalseのまま=ボタン自体を出さない)
  useEffect(() => {
    if (!fileSaveSupported) return
    let cancelled = false
    void hasSavedFileHandle().then((exists) => {
      if (!cancelled) setSavedHandleExists(exists)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // テーマ一覧（配布物マニフェスト）
  const [themes, setThemes] = useState<ThemeManifestEntry[]>([])
  const [themesLoading, setThemesLoading] = useState(true)
  const [themeBusyId, setThemeBusyId] = useState<string | null>(null)
  const [addAllBusy, setAddAllBusy] = useState(false)
  // タップで収録レシピ(品目リスト)を展開しているテーマ。解錠状態と無関係に見られる
  const [expandedThemeIds, setExpandedThemeIds] = useState<string[]>([])
  // 未解錠のまま「追加する」を押したテーマ(そのカード内に解錠が必要な旨を表示する)
  const [blockedThemeId, setBlockedThemeId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const list = await fetchThemeManifest()
      if (!cancelled) {
        setThemes(list)
        setThemesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // 配布ページの「うちレシピに追加する」リンク(#/settings?set=<setId>)からのワンタップ取り込み。
  // 任意URLは受け付けず、同一オリジンの/sets/data/<setId>.jsonだけをfetchする
  useEffect(() => {
    const setId = searchParams.get('set')
    if (!setId || !settings) return
    const clearParam = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('set')
          return next
        },
        { replace: true },
      )
    }
    if (!/^[a-z0-9-]+$/.test(setId)) {
      clearParam()
      return
    }
    // レシピセットの取り込みは「レシピ」タブの内容なので、直リンクで開いたときも自動でそこへ切り替える。
    // このフローは配布ページの外部リンクから来る一発取り込みで、画面下部のトースト表示が
    // 既存の挙動(タップで閉じられる)としてテスト済みのため、修正4の対象(読み込み欄上部の
    // テキスト表示)には含めない(setMessage/下部トーストのまま変更しない)
    setActiveTab('recipe')
    let cancelled = false
    void (async () => {
      try {
        const file = await fetchRecipeSet(`/sets/data/${setId}.json`)
        if (cancelled) return
        if (file.setId && !hasPaidRecipeAccess(settings)) {
          setMessage(ja.settings.recipeSetBlocked)
          return
        }
        const confirmText = ja.settings.recipeSetDeepLinkConfirm
          .replace('{name}', file.setName ?? setId)
          .replace('{n}', String(file.recipes.length))
        if (!window.confirm(confirmText)) return
        const result = await importRecipeSet(file)
        setMessage(formatRecipeSetResult(result))
      } catch (err) {
        if (!cancelled) showRecipeSetFetchError(err)
      } finally {
        clearParam()
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, settings])

  // セクションへの直接リンク(例: /settings?section=pro、?section=themes)から開いたとき、
  // 該当タブへ自動で切り替えた上で該当セクションまで自動スクロールする(2026-07-12タブ分割)。
  // タブ切り替え直後はまだDOMにその要素が無いことがあるため、activeTabが目的のタブと
  // 一致するまでこのエフェクト自体を再実行させる(依存配列にactiveTabを含める)。
  // settings読み込み前はコンポーネントがnullを返す(下記)ため対象要素がまだ無く、
  // settingsが揃ってから改めて試す必要がある(1回だけ実行するようRefで防ぐ)
  const scrolledToSectionRef = useRef(false)
  useEffect(() => {
    if (scrolledToSectionRef.current) return
    const target = sectionDeepLinks[searchParams.get('section') ?? '']
    if (!target) return
    if (!settings) return
    if (activeTab !== target.tab) {
      setActiveTab(target.tab)
      return
    }
    scrolledToSectionRef.current = true
    document.getElementById(target.elementId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [searchParams, settings, activeTab])

  /**
   * タブごとのスクロール位置復元(セッション内・2026-07-13 UI改善)。タブバー自体をsticky化した
   * ため、タブを切り替えると中身の高さが変わりスクロール位置がずれてしまう。タブを押した瞬間の
   * 位置を離脱先のタブに保存しておき、次にそのタブへ戻ったときに復元する。
   * pendingTabScrollRestoreRefは「タブボタンを直接押した」ときだけ立て、?section=/?set=直リンクに
   * よる自動タブ切り替え(上のuseEffect)では復元しない(復元してしまうと直リンクの自動スクロールと
   * 競合するため)
   */
  const tabScrollPositions = useRef<Partial<Record<SettingsTab, number>>>({})
  const pendingTabScrollRestoreRef = useRef(false)
  const selectTab = (tab: SettingsTab) => {
    tabScrollPositions.current[activeTab] = window.scrollY
    pendingTabScrollRestoreRef.current = true
    setActiveTab(tab)
  }
  useEffect(() => {
    if (!pendingTabScrollRestoreRef.current) return
    pendingTabScrollRestoreRef.current = false
    const y = tabScrollPositions.current[activeTab] ?? 0
    requestAnimationFrame(() => window.scrollTo(0, y))
  }, [activeTab])

  /**
   * バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)のタップ/ボタン先。
   * 「バックアップタブの書き出しへ」＝タブを切り替えて①バックアップを取るカードまで自動スクロール
   * する(実際の保存はユーザーが写真込みチェック等を確認してから「ファイルに書き出す」を押す形を
   * 維持する。バナーの小ボタンから確認なしに即ファイル保存を開始しない)。
   * selectTab経由にすると離脱先タブのスクロール位置復元(pendingTabScrollRestoreRef)と競合するため、
   * ?section=直リンクの自動スクロール(上のuseEffect)と同じくsetActiveTabを直接呼ぶ
   */
  const backupBannerScrollPendingRef = useRef(false)
  const goToBackupExport = () => {
    if (activeTab === 'backup') {
      document.getElementById('backup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    backupBannerScrollPendingRef.current = true
    setActiveTab('backup')
  }
  useEffect(() => {
    if (!backupBannerScrollPendingRef.current) return
    if (activeTab !== 'backup') return
    backupBannerScrollPendingRef.current = false
    requestAnimationFrame(() => {
      document.getElementById('backup-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [activeTab])

  // 置き換え直後の「元に戻す」バナー(2026-07-17設定ゼロベース裁定#6c)はタブ切り替え(=画面遷移)で
  // 消えてよい設計のため、activeTabが変わるたびに閉じる
  useEffect(() => {
    setReplaceUndoAvailable(false)
  }, [activeTab])

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
      return
    }
    setExportBusy(true)
    try {
      const json = await exportBackup(includeCookedPhotos)
      await saveWithPicker(json, backupFileName())
      await updateSettings({ lastBackupAt: Date.now() })
      setSavedHandleExists(true)
    } catch (err) {
      // ユーザーのキャンセル(AbortError)は何もしない。それ以外(権限拒否・headless等で
      // ピッカー自体が使えない環境)は、エラーで終わらせず従来の自動ダウンロードへ
      // フォールバックする(バックアップが取れないままになるのが最悪のため)
      if (!isAbortError(err)) {
        try {
          await downloadBackup(includeCookedPhotos)
          await updateSettings({ lastBackupAt: Date.now() })
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
      setMessage(
        mode === 'replace'
          ? ja.settings.backupImportDone.replace('{n}', String(result.added))
          : ja.settings.backupImportMergeResult
              .replace('{a}', String(result.added))
              .replace('{s}', String(result.skipped)),
      )
    } catch {
      setMessage(ja.settings.backupImportError)
    }
  }

  /**
   * 三重の網の(c): 置き換え直後に1回だけ出す「元に戻す」(2026-07-17設定ゼロベース裁定#6c)。
   * savePreImportSnapshotで退避したデータへ復元する
   */
  const handleUndoReplace = async () => {
    const restored = await restorePreImportSnapshot()
    setReplaceUndoAvailable(false)
    setMessage(restored ? ja.settings.replaceUndoDone : ja.settings.replaceUndoError)
  }

  // addTheme(テーマ一覧の1タップ取り込み)・set=直リンク取り込み専用。従来どおり下部トーストのまま変更しない
  const showRecipeSetResult = (result: {
    added: number
    updated: number
    skipped: number
    excluded: number
  }) => {
    setMessage(formatRecipeSetResult(result))
  }

  // fetchRecipeSetの失敗理由(URLが存在しない/中身が壊れている)で文言を出し分ける
  // (2026-07-12実機報告: 存在しないset=IDを開いても「JSONファイルか確認して」としか
  // 出ず、綴りミスに気づきにくかったため)。set=直リンク取り込み専用。従来どおり下部トーストのまま変更しない
  const showRecipeSetFetchError = (err: unknown) => {
    setMessage(
      err instanceof RecipeSetFetchError && err.reason === 'not_found'
        ? ja.settings.recipeSetNotFound
        : ja.settings.recipeSetError,
    )
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
      if (file.setId && !hasPaidRecipeAccess(settings)) {
        setRecipeSetMessage(ja.settings.recipeSetBlocked)
        return
      }
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
      if (parsed.setId && !hasPaidRecipeAccess(settings)) {
        setRecipeSetMessage(ja.settings.recipeSetBlocked)
        return
      }
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
   * 「購入と解錠」1画面統合(2026-07-17設定ゼロベース裁定#7)。入力欄1つでPro・追加レシピパック
   * 両方を受け付け、detectCodeKindで種類(UR-/UP-)を判定してから、既存のisValidProCode/
   * isValidPackCode・updateSettingsのフィールドはそのまま流用する(解錠フロー・検証ロジック
   * 自体は変えない)。旧来の「違う欄に入力してください」という相互誘導ヒントは、
   * そのまま正しい方で解錠する形に発展したため不要になった
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
      } else if (kind === 'pack') {
        const valid = await isValidPackCode(unlockCodeInput)
        if (!valid) {
          setUnlockError(ja.settings.packInvalidCode)
          return
        }
        await updateSettings({
          recipePackCode: normalizePackCode(unlockCodeInput),
          recipePackActivatedAt: Date.now(),
        })
        setUnlockCodeInput('')
      } else {
        setUnlockError(ja.settings.unlockUnknownCode)
      }
    } finally {
      setUnlockChecking(false)
    }
  }

  // テーマごとの取込済み判定: そのテーマ由来(sourceSetId一致)のレシピが1件でも端末にあるか
  const importedThemeIds = new Set((recipes ?? []).map((r) => r.sourceSetId).filter(Boolean))

  // テーマごとの「除外中」(削除済みで再取込しない)品数(トゥームストーン・2026-07-13 Fable設計)
  const exclusionCountByTheme = new Map<string, number>()
  for (const exclusion of setExclusions ?? []) {
    exclusionCountByTheme.set(
      exclusion.setId,
      (exclusionCountByTheme.get(exclusion.setId) ?? 0) + 1,
    )
  }

  /** テーマの除外記録をすべて消す(「除外中◯品・すべて戻す」)。次にそのテーマを取り込むと戻る */
  const restoreThemeExclusions = async (theme: ThemeManifestEntry) => {
    await clearSetExclusions(theme.id)
    setMessage(ja.settings.themeExclusionRestored.replace('{name}', theme.title))
  }

  const addTheme = async (theme: ThemeManifestEntry) => {
    setThemeBusyId(theme.id)
    try {
      const file = await fetchRecipeSet(theme.file)
      showRecipeSetResult(await importRecipeSet(file))
    } catch {
      setMessage(ja.settings.recipeSetError)
    } finally {
      setThemeBusyId(null)
    }
  }

  const addAllThemes = async () => {
    const targets = themes.filter((t) => !importedThemeIds.has(t.id))
    if (targets.length === 0) {
      setMessage(ja.settings.themeAddAllNone)
      return
    }
    setAddAllBusy(true)
    try {
      let added = 0
      for (const theme of targets) {
        try {
          const file = await fetchRecipeSet(theme.file)
          const result = await importRecipeSet(file)
          added += result.added
        } catch {
          // 1テーマの失敗で全体を止めない。次のテーマへ続行する
        }
      }
      setMessage(ja.settings.themeAddAllResult.replace('{n}', String(added)))
    } finally {
      setAddAllBusy(false)
    }
  }

  const deleteTheme = async (theme: ThemeManifestEntry) => {
    const confirmText = ja.settings.themeDeleteConfirm.replace('{name}', theme.title)
    if (!window.confirm(confirmText)) return
    const count = await deleteRecipesBySourceSet(theme.id)
    setMessage(ja.settings.themeDeleteDone.replace('{name}', theme.title).replace('{n}', String(count)))
  }

  const homeWidgets = settings.homeWidgets
  const hiddenHomeWidgets = allHomeWidgets.filter((key) => !homeWidgets.includes(key))

  const showHomeWidget = (key: HomeWidgetKey) => {
    void updateSettings({ homeWidgets: [...homeWidgets, key] })
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

      {/* タブ切り替え(2026-07-12オーナー実機フィードバック: 縦に長大化したため上部タブで分割)。
          2026-07-13 UI改善: スクロールしても上部に固定(sticky)する。settings-tabbarクラスは
          index.cssでis-ipad(マルチタスクボタン対策)の上余白をback-header同様に追加している。
          2026-07-16 UI総点検A-5: タップ領域が38pxしかなかったためpy-2.5→py-[13px]で44px相当に拡大
          (バックアップタブの中身は別便が触っているためこのタブバー部分以外は変更しない) */}
      <div className="settings-tabbar sticky top-0 z-10 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur">
        <div className="grid grid-cols-4 gap-1">
          {settingsTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={`rounded-md border py-[13px] text-xs font-bold shadow-sm ${
                activeTab === tab.id
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* バックアップ状態バナー(2026-07-17設定ゼロベース裁定#1)。タブバーの下・全タブ共通の常設
          バナー。タップ/[今すぐ保存]ボタンのどちらも「バックアップタブの書き出しへ」導く
          (バナー自体は即ファイル保存を実行しない。写真込みチェック等を確認してから
          「ファイルに書き出す」を押す既存の流れを維持するため)。30日超(または未実施)は警告色 */}
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
            backupBannerWarning ? 'border-warning text-warning' : 'border-edge text-accent'
          }`}
        >
          {ja.settings.bannerSaveNow}
        </button>
      </div>

      {activeTab === 'basic' && (
        <>
          {/* 見た目(2026-07-16 UI総点検B-2: 9カードフラット並列を4グループに整理。
              テーマカラーを全般タブの最上部へ移動。並びとグループ見出しのみでカードの中身は変更しない) */}
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
                <li key={key} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
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
                </li>
              ))}
              {hiddenHomeWidgets.map((key) => (
                <li key={key} className="flex items-center gap-2 px-[var(--space-sm)] py-2 opacity-60">
                  <span className="min-w-0 flex-1 font-bold">{homeWidgetLabels[key]}</span>
                  <button
                    type="button"
                    onClick={() => showHomeWidget(key)}
                    className="rounded-sm border border-accent px-2 py-1 text-xs font-bold text-accent"
                  >
                    {ja.settings.homeWidgetShow}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* 食材と価格 */}
          <p className={groupHeadingCls}>{ja.settings.groupIngredientsTitle}</p>

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
                className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-4 font-bold text-accent shadow-sm"
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

          {/* 食材と価格（食材価格マスタ。詳細・献立の概算食費のフォールバックに使う）。
              2026-07-13 UI改善: 「レシピ」タブからNG食材の直下に移動 */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.priceMasterTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.priceMasterDescription}</p>
            <Link
              to="/prices"
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
            >
              <Coins size={18} aria-hidden />
              {ja.settings.priceMasterLink}
            </Link>
          </section>

          {/* 週の食費予算。2026-07-13 UI改善: NG食材の直下（食材と価格の次）に移動 */}
          <section className={sectionCls}>
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

          {/* 料理中 */}
          <p className={groupHeadingCls}>{ja.settings.groupCookingTitle}</p>

          {/* 画面を暗くしない */}
          <section className={sectionCls}>
            <label className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold">{ja.settings.screenTitle}</h2>
                <p className="mt-1 text-sm text-ink-muted">{ja.settings.screenDescription}</p>
                {!wakeLockSupported && (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.wakeLockUnsupportedNote}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.keepScreenOn}
                aria-label={ja.settings.screenTitle}
                onClick={() => updateSettings({ keepScreenOn: !settings.keepScreenOn })}
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
                {!wakeLockSupported && (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.wakeLockUnsupportedNote}</p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.timerWakeLockEnabled}
                aria-label={ja.settings.timerWakeLockTitle}
                onClick={() =>
                  updateSettings({ timerWakeLockEnabled: !settings.timerWakeLockEnabled })
                }
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
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.timerSoundEnabled}
                aria-label={ja.settings.timerSoundTitle}
                onClick={() => updateSettings({ timerSoundEnabled: !settings.timerSoundEnabled })}
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
          </section>

          {/* その他 */}
          <p className={groupHeadingCls}>{ja.settings.groupOtherTitle}</p>

          {/* アプリについて(区分表に明示は無いが、汎用の基本タブ末尾に置く) */}
          <section className={sectionCls}>
            <h2 className="font-bold">{ja.settings.aboutTitle}</h2>
            {/* バージョン+データ件数(2026-07-17設定ゼロベース裁定#3。問い合わせ対応に必須) */}
            <p className="mt-1 text-sm text-ink-muted">
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
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
            >
              <Info size={18} aria-hidden />
              {ja.settings.aboutPageLink}
            </a>
            <a
              href="/about/terms.html"
              className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent underline"
            >
              {ja.settings.termsLink}
            </a>
            {/* ご意見箱はGoogleフォーム(外部サイト)なので別窓でよい */}
            <a
              href={ja.settings.feedbackFormUrl}
              target="_blank"
              rel="noopener"
              className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent underline"
            >
              {ja.settings.feedbackLink}
            </a>
          </section>
        </>
      )}

      {activeTab === 'recipe' && (
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
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
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
                className="mt-[var(--space-sm)] rounded-sm border border-accent bg-app px-3 py-2 text-sm font-bold text-accent"
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
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent shadow-sm disabled:opacity-40"
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
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm disabled:opacity-40"
            >
              <Upload size={18} aria-hidden />
              {recipeSetLoading ? ja.settings.recipeSetLoading : ja.settings.recipeSetFileLoad}
            </button>
            {/* 別窓(target="_blank")にしない: iOSのホーム画面追加アプリはSafariとストレージが別のため、
                別窓で開くと取り込み先が今のアプリとズレてしまう */}
            <a
              href="/sets/"
              className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent underline"
            >
              {ja.settings.recipeSetPageLink}
            </a>
          </section>

          {/* テーマ一覧: 中身は誰でも確認でき、取り込みは追加レシピパック/Pro解錠者ができる */}
          <section id="theme-list-section" className={sectionCls}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-bold">{ja.settings.themeListTitle}</h2>
              {hasPaidRecipeAccess(settings) && themes.length > 0 && (
                <button
                  type="button"
                  onClick={() => void addAllThemes()}
                  disabled={addAllBusy}
                  className="shrink-0 rounded-sm border border-edge bg-surface px-3 py-1.5 text-sm font-bold text-accent shadow-sm disabled:opacity-40"
                >
                  {ja.settings.themeAddAll}
                </button>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.themeListDescription}</p>
            {themesLoading ? (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.settings.themeListLoading}</p>
            ) : themes.length === 0 ? (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.settings.themeListEmpty}</p>
            ) : (
              <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {themes.map((theme) => {
                  const imported = importedThemeIds.has(theme.id)
                  const expanded = expandedThemeIds.includes(theme.id)
                  const items = theme.items ?? []
                  // 削除済みで再取込しない品数(トゥームストーン)。1件以上なら「すべて戻す」を出す
                  const excludedCount = exclusionCountByTheme.get(theme.id) ?? 0
                  return (
                    <li
                      key={theme.id}
                      className="rounded-md border border-edge p-[var(--space-sm)]"
                    >
                      {/* カードのタップで収録レシピを展開表示（解錠状態と無関係に中身を確認できる） */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedThemeIds((prev) =>
                            prev.includes(theme.id)
                              ? prev.filter((id) => id !== theme.id)
                              : [...prev, theme.id],
                          )
                        }
                        aria-expanded={expanded}
                        className="flex w-full items-start gap-2 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">{theme.title}</span>
                          <span className="mt-0.5 block text-sm text-ink-muted">{theme.description}</span>
                        </span>
                        {items.length > 0 && (
                          <ChevronDown
                            size={18}
                            className={`mt-1 shrink-0 text-ink-muted transition-transform ${
                              expanded ? 'rotate-180' : ''
                            }`}
                            aria-hidden
                          />
                        )}
                      </button>
                      {expanded && items.length > 0 && (
                        <div className="mt-[var(--space-sm)]">
                          <p className="text-xs font-bold text-ink-muted">
                            {ja.settings.themeItemsCount.replace('{n}', String(items.length))}
                          </p>
                          <ul className="mt-1 divide-y divide-edge rounded-md border border-edge bg-app">
                            {items.map((item) => (
                              <li
                                key={item.title}
                                className="flex items-baseline justify-between gap-2 px-[var(--space-sm)] py-1.5 text-sm"
                              >
                                <span className="min-w-0 flex-1">{item.title}</span>
                                {item.cookMinutes != null && item.cookMinutes > 0 && (
                                  <span className="shrink-0 text-xs text-ink-muted">
                                    {item.cookMinutes}
                                    {ja.recipes.minutesSuffix}
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="mt-[var(--space-sm)]">
                        {imported ? (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-accent">{ja.settings.themeAdded}</span>
                            <button
                              type="button"
                              onClick={() => void deleteTheme(theme)}
                              className="text-sm font-bold text-warning underline"
                            >
                              {ja.settings.themeDelete}
                            </button>
                          </div>
                        ) : hasPaidRecipeAccess(settings) ? (
                          <button
                            type="button"
                            onClick={() => void addTheme(theme)}
                            disabled={themeBusyId === theme.id}
                            className="w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-40"
                          >
                            {ja.settings.themeAdd}
                          </button>
                        ) : (
                          <>
                            {/* 未解錠でも無反応にせず、タップで「解錠が必要」の説明を返す */}
                            <button
                              type="button"
                              onClick={() => setBlockedThemeId(theme.id)}
                              className="w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-ink-muted shadow-sm"
                            >
                              {ja.settings.themeAdd}
                            </button>
                            {blockedThemeId === theme.id && (
                              <p className="mt-1 rounded-sm border border-accent px-2 py-1.5 text-xs font-bold text-accent">
                                {ja.settings.recipeSetBlocked}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                      {/* 削除済みで再取込しない品(トゥームストーン)があるときだけ「すべて戻す」を出す。
                          タップで除外記録を消し、次にこのテーマを取り込むと戻る(2026-07-13 Fable設計) */}
                      {excludedCount > 0 && (
                        <div className="mt-[var(--space-sm)]">
                          <button
                            type="button"
                            onClick={() => void restoreThemeExclusions(theme)}
                            className="text-sm font-bold text-accent underline"
                          >
                            {ja.settings.themeExclusionRestore.replace('{n}', String(excludedCount))}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </>
      )}

      {activeTab === 'backup' && (
        <>
          {/* ①バックアップを取る(2026-07-17バックアップ改修 修正5でカード再構成。
              修正2+3: File System Access API対応ブラウザは保存先選択+前回の場所に上書きボタンを併設) */}
          <section id="backup-section" className={sectionCls}>
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
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm disabled:opacity-60"
                >
                  <Save size={18} aria-hidden />
                  {ja.settings.backupOverwrite}
                </button>
                <p className="mt-1 text-xs text-ink-muted">{ja.settings.backupOverwriteNote}</p>
              </>
            )}
          </section>

          {/* ②バックアップから戻す: 「追加」「置き換え」を並べて配置し、それぞれに説明キャプションを
              付ける(2026-07-17修正5。以前は縦積みで置き換えだけ警告色が浮いて見えていたのを解消) */}
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
                  onClick={() => pickImportFile('merge')}
                  className="flex h-full min-h-14 items-center justify-center gap-1.5 rounded-md border border-edge bg-surface px-2 py-3 text-center font-bold text-accent shadow-sm"
                >
                  <Upload size={18} className="shrink-0" aria-hidden />
                  <span>{ja.settings.backupImportMerge}</span>
                </button>
                <p className="mt-1 text-xs text-ink-muted">{ja.settings.backupImportMergeNote}</p>
              </div>
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => pickImportFile('replace')}
                  className="flex h-full min-h-14 items-center justify-center gap-1.5 rounded-md border border-warning px-2 py-3 text-center font-bold text-warning"
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
          </section>

          {/* 機種変更・引っ越しガイド(2026-07-17設定ゼロベース裁定#5)。折りたたみ式で、
              普段は畳んでおき機種変更のときだけ開く想定 */}
          <section className={sectionCls}>
            <button
              type="button"
              onClick={() => setMoveGuideOpen((v) => !v)}
              aria-expanded={moveGuideOpen}
              className="flex w-full items-center justify-between gap-2 text-left font-bold"
            >
              {ja.settings.moveGuideToggle}
              <ChevronDown
                size={18}
                className={`shrink-0 text-ink-muted transition-transform ${moveGuideOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
            {moveGuideOpen && (
              <div className="mt-[var(--space-sm)]">
                <ol className="space-y-1 text-sm text-ink-muted">
                  <li>{ja.settings.moveGuideStep1}</li>
                  <li>{ja.settings.moveGuideStep2}</li>
                  <li>{ja.settings.moveGuideStep3}</li>
                </ol>
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
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
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
              (2026-07-17設定ゼロベース裁定#6c)。タブ切り替え(画面遷移)で自動的に消える */}
          {replaceUndoAvailable && (
            <div
              className="fixed inset-x-0 z-[70] flex justify-center px-[var(--space-md)]"
              style={{ bottom: 'calc(160px + env(safe-area-inset-bottom))' }}
              role="status"
            >
              <div className="flex w-full max-w-sm items-start gap-2 rounded-md border border-accent bg-surface px-4 py-3 shadow-md motion-safe:animate-toast-in">
                <span className="min-w-0 flex-1 text-sm font-bold text-accent">
                  {ja.settings.replaceUndoMessage}
                </span>
                <button
                  type="button"
                  onClick={() => void handleUndoReplace()}
                  className="shrink-0 rounded-sm border border-accent px-2 py-1 text-xs font-bold text-accent"
                >
                  {ja.settings.replaceUndoButton}
                </button>
                <button
                  type="button"
                  onClick={() => setReplaceUndoAvailable(false)}
                  aria-label={ja.settings.replaceUndoDismiss}
                  className="shrink-0"
                >
                  <X size={16} className="text-accent" aria-hidden />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'pro' && (
        <>
          {/* 購入と解錠(2026-07-17設定ゼロベース裁定#7: Pro版・追加レシピパックの2カードを
              1カードに統合。入力欄1つでコード種別(UR-/UP-)を自動判定する。解錠状態は両方を
              一覧表示し、解錠済みコードはマスク表示+コピー(#4)を添える) */}
          <section id="pro-section" className={sectionCls}>
            <h2 className="font-bold">{ja.settings.unlockTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.unlockDescription}</p>

            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
              {/* Pro版の行 */}
              <li className="px-[var(--space-sm)] py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{ja.settings.proTitle}</span>
                  {!settings.proCode && (
                    <span className="shrink-0 text-sm text-ink-muted">{ja.settings.unlockStatusInactive}</span>
                  )}
                </div>
                {settings.proCode ? (
                  <>
                    <p className="mt-1 text-sm font-bold text-accent">{ja.settings.proActivatedTitle}</p>
                    {settings.proActivatedAt && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ja.settings.proActivatedDate.replace('{date}', formatDate(settings.proActivatedAt))}
                      </p>
                    )}
                    <UnlockCodeDisplay code={settings.proCode} />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.proDescription}</p>
                )}
              </li>
              {/* 追加レシピパックの行 */}
              <li className="px-[var(--space-sm)] py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold">{ja.settings.packTitle}</span>
                  {!settings.recipePackCode && (
                    <span className="shrink-0 text-sm text-ink-muted">
                      {settings.proCode ? ja.settings.packIncludedInPro : ja.settings.unlockStatusInactive}
                    </span>
                  )}
                </div>
                {settings.recipePackCode ? (
                  <>
                    <p className="mt-1 text-sm font-bold text-accent">{ja.settings.packActivatedTitle}</p>
                    {settings.recipePackActivatedAt && (
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {ja.settings.packActivatedDate.replace(
                          '{date}',
                          formatDate(settings.recipePackActivatedAt),
                        )}
                      </p>
                    )}
                    <UnlockCodeDisplay code={settings.recipePackCode} />
                  </>
                ) : (
                  <p className="mt-1 text-sm text-ink-muted">{ja.settings.packDescription}</p>
                )}
              </li>
            </ul>

            {/* 未解錠(またはパックのみ解錠=将来のPro追加購入に備えて残す)なら統合入力を出す。
                Pro解錠済みならすべて含むため入力欄自体を隠す(旧packNotNeededWithProの後継:
                「入力できるのに無意味」ではなく「そもそも入力の必要が無い」状態にする) */}
            {!settings.proCode && (
              <div className="mt-[var(--space-md)]">
                <div className="flex gap-[var(--space-sm)]">
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
              </div>
            )}

            {/* Pro解錠直後に「何が使えるようになったか」を控えめに案内する(2026-07-09ペルソナ第2波)。
                解錠中ずっと表示され続ける(2026-07-13 UI改善) */}
            {settings.proCode && (
              <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-app p-[var(--space-sm)]">
                <p className="text-sm font-bold">{ja.settings.proActivatedFeaturesTitle}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                  {ja.settings.proActivatedFeatures.map((feature) => (
                    <li key={feature}>・{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}
