import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, Download, Upload, Link2, RotateCcw, ChevronUp, ChevronDown, Info } from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import { listRecipes, deleteRecipesBySourceSet } from '../db/recipes'
import { reloadStarterRecipes, starterCount } from '../db/starters'
import {
  downloadBackup,
  importBackup,
  parseBackup,
  fetchRecipeSet,
  importRecipeSet,
} from '../logic/backup'
import { hasNgIngredient } from '../logic/ng'
import {
  isValidProCode,
  normalizeProCode,
  isValidPackCode,
  normalizePackCode,
  hasPaidRecipeAccess,
} from '../logic/pro'
import { fetchThemeManifest, type ThemeManifestEntry } from '../logic/themeManifest'
import type { HomeWidgetKey, ThemeSetting } from '../db/types'
import { ja } from '../i18n/ja'

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'auto', label: ja.settings.themeAuto },
  { value: 'light', label: ja.settings.themeLight },
  { value: 'dark', label: ja.settings.themeDark },
  { value: 'brown', label: ja.settings.themeBrown },
]

const allHomeWidgets: HomeWidgetKey[] = [
  'mealPlan',
  'suggestion',
  'ingredientSearch',
  'pantry',
  'history',
]

const homeWidgetLabels: Record<HomeWidgetKey, string> = {
  mealPlan: ja.home.mealPlanTitle,
  suggestion: ja.home.suggestTitle,
  ingredientSearch: ja.home.ingShortcutTitle,
  pantry: ja.pantry.title,
  history: ja.home.historyTitle,
}

const sectionCls =
  'mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm'

// Wake Lock API非対応環境（'wakeLock' in navigator が false）かどうか。
// 画面が消えない系トグルの説明の下に注記を出すために使う(useWakeLock.tsのロジック自体は変更しない)
const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator

/** 設定: NG食材 / 画面を暗くしない / テーマ */
export default function SettingsPage() {
  const settings = useSettings()
  const recipes = useLiveQuery(listRecipes, [])
  const [ngInput, setNgInput] = useState('')
  const [message, setMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  const importModeRef = useRef<'replace' | 'merge'>('merge')
  const [recipeSetUrl, setRecipeSetUrl] = useState('')
  const [recipeSetLoading, setRecipeSetLoading] = useState(false)
  const recipeSetFileRef = useRef<HTMLInputElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const [proCodeInput, setProCodeInput] = useState('')
  const [proChecking, setProChecking] = useState(false)
  const [proError, setProError] = useState('')
  // このセッションでPro解錠に成功した直後だけ「使えるようになった機能」を案内する
  const [proJustActivated, setProJustActivated] = useState(false)
  const [packCodeInput, setPackCodeInput] = useState('')
  const [packChecking, setPackChecking] = useState(false)
  const [packError, setPackError] = useState('')

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
        setMessage(
          ja.settings.recipeSetResult
            .replace('{a}', String(result.added))
            .replace('{s}', String(result.skipped)),
        )
      } catch {
        if (!cancelled) setMessage(ja.settings.recipeSetError)
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
  // 該当セクションまで自動スクロール。settings読み込み前はコンポーネントがnullを返す(下記)ため
  // 対象要素がまだ無く、settingsが揃ってから改めて試す必要がある(1回だけ実行するようRefで防ぐ)
  const scrolledToSectionRef = useRef(false)
  useEffect(() => {
    if (scrolledToSectionRef.current) return
    const sectionIds: Record<string, string> = { pro: 'pro-section', themes: 'theme-list-section' }
    const targetId = sectionIds[searchParams.get('section') ?? '']
    if (!targetId) return
    if (!settings) return
    scrolledToSectionRef.current = true
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [searchParams, settings])

  if (!settings) return null // 読み込み中

  /** 現在の入力欄の文字が今の時点で何件のレシピに一致するか（登録前のその場プレビュー） */
  const ngPreviewCount =
    ngInput.trim() && recipes
      ? recipes.filter((r) => hasNgIngredient(r, [ngInput.trim()])).length
      : undefined

  /** バックアップの読み込み: モードを選んでからファイルを開く */
  const pickImportFile = (mode: 'replace' | 'merge') => {
    importModeRef.current = mode
    importFileRef.current?.click()
  }

  const onImportFile = async (file: File | undefined) => {
    if (!file) return
    const mode = importModeRef.current
    const confirmText =
      mode === 'replace'
        ? ja.settings.backupImportReplaceConfirm
        : ja.settings.backupImportMergeConfirm
    if (!window.confirm(confirmText)) return
    try {
      const backup = parseBackup(await file.text())
      const result = await importBackup(backup, mode)
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

  const showRecipeSetResult = (result: { added: number; skipped: number }) => {
    setMessage(
      ja.settings.recipeSetResult
        .replace('{a}', String(result.added))
        .replace('{s}', String(result.skipped)),
    )
  }

  const loadRecipeSetFromUrl = async () => {
    const url = recipeSetUrl.trim()
    if (!url) return
    setRecipeSetLoading(true)
    try {
      const file = await fetchRecipeSet(url)
      if (file.setId && !hasPaidRecipeAccess(settings)) {
        setMessage(ja.settings.recipeSetBlocked)
        return
      }
      showRecipeSetResult(await importRecipeSet(file))
      setRecipeSetUrl('')
    } catch {
      setMessage(ja.settings.recipeSetError)
    } finally {
      setRecipeSetLoading(false)
    }
  }

  const loadRecipeSetFromFile = async (file: File | undefined) => {
    if (!file) return
    setRecipeSetLoading(true)
    try {
      const parsed = parseBackup(await file.text())
      if (parsed.setId && !hasPaidRecipeAccess(settings)) {
        setMessage(ja.settings.recipeSetBlocked)
        return
      }
      showRecipeSetResult(await importRecipeSet(parsed))
    } catch {
      setMessage(ja.settings.recipeSetError)
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

  const activatePro = async () => {
    setProChecking(true)
    setProError('')
    try {
      // パック用コード(UP-)を間違えてPro欄に入れたときは、正しい欄へ相互誘導する
      if (normalizeProCode(proCodeInput).startsWith('UP-')) {
        setProError(ja.settings.proCodeIsPackCode)
        return
      }
      const valid = await isValidProCode(proCodeInput)
      if (!valid) {
        setProError(ja.settings.proInvalidCode)
        return
      }
      await updateSettings({
        proCode: normalizeProCode(proCodeInput),
        proActivatedAt: Date.now(),
      })
      setProCodeInput('')
      setProJustActivated(true)
    } finally {
      setProChecking(false)
    }
  }

  const activatePack = async () => {
    setPackChecking(true)
    setPackError('')
    try {
      // Pro用コード(UR-)を間違えてパック欄に入れたときは、正しい欄へ相互誘導する
      if (normalizePackCode(packCodeInput).startsWith('UR-')) {
        setPackError(ja.settings.packCodeIsProCode)
        return
      }
      const valid = await isValidPackCode(packCodeInput)
      if (!valid) {
        setPackError(ja.settings.packInvalidCode)
        return
      }
      await updateSettings({
        recipePackCode: normalizePackCode(packCodeInput),
        recipePackActivatedAt: Date.now(),
      })
      setPackCodeInput('')
    } finally {
      setPackChecking(false)
    }
  }

  // テーマごとの取込済み判定: そのテーマ由来(sourceSetId一致)のレシピが1件でも端末にあるか
  const importedThemeIds = new Set((recipes ?? []).map((r) => r.sourceSetId).filter(Boolean))

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

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.settings.title}</h1>

      {message && (
        <p className="mt-[var(--space-sm)] rounded-sm border border-accent px-3 py-2 text-sm font-bold text-accent">
          {message}
        </p>
      )}

      {/* NG食材 */}
      <section className={sectionCls}>
        <h2 className="font-bold">{ja.settings.ngTitle}</h2>
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

      {/* 週の食費予算 */}
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

      {/* テーマ */}
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
                  ? 'border-accent bg-accent text-app'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

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

      {/* バックアップ */}
      <section className={sectionCls}>
        <h2 className="font-bold">{ja.settings.backupTitle}</h2>
        <p className="mt-1 text-sm text-ink-muted">{ja.settings.backupDescription}</p>
        <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
          {settings.lastBackupAt
            ? ja.settings.backupLastDate.replace('{date}', formatDate(settings.lastBackupAt))
            : ja.settings.backupNever}
        </p>
        <button
          type="button"
          onClick={() => downloadBackup()}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-app shadow-sm"
        >
          <Download size={18} aria-hidden />
          {ja.settings.backupExport}
        </button>
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
        <div className="mt-[var(--space-sm)] grid grid-cols-1 gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => pickImportFile('merge')}
            className="flex items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
          >
            <Upload size={18} aria-hidden />
            {ja.settings.backupImportMerge}
          </button>
          <p className="text-xs text-ink-muted">{ja.settings.backupImportMergeNote}</p>
          <button
            type="button"
            onClick={() => pickImportFile('replace')}
            className="flex items-center justify-center gap-2 rounded-md border border-warning py-3 font-bold text-warning"
          >
            <Upload size={18} aria-hidden />
            {ja.settings.backupImportReplace}
          </button>
        </div>
      </section>

      {/* Pro版 */}
      <section id="pro-section" className={sectionCls}>
        <h2 className="font-bold">{ja.settings.proTitle}</h2>
        {settings.proCode ? (
          <>
            <p className="mt-1 text-sm font-bold text-accent">{ja.settings.proActivatedTitle}</p>
            {settings.proActivatedAt && (
              <p className="mt-0.5 text-xs text-ink-muted">
                {ja.settings.proActivatedDate.replace('{date}', formatDate(settings.proActivatedAt))}
              </p>
            )}
            {/* 解錠直後だけ、どこで何が使えるようになったかを控えめに案内する */}
            {proJustActivated && (
              <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-app p-[var(--space-sm)]">
                <p className="text-sm font-bold">{ja.settings.proActivatedFeaturesTitle}</p>
                <ul className="mt-1 space-y-0.5 text-sm text-ink-muted">
                  {ja.settings.proActivatedFeatures.map((feature) => (
                    <li key={feature}>・{feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.proDescription}</p>
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              <input
                type="text"
                value={proCodeInput}
                onChange={(e) => {
                  setProCodeInput(e.target.value)
                  setProError('')
                }}
                placeholder={ja.settings.proCodePlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => void activatePro()}
                disabled={proChecking || !proCodeInput.trim()}
                className="inline-flex shrink-0 items-center rounded-sm bg-accent px-4 font-bold text-app disabled:opacity-40"
              >
                {proChecking ? ja.settings.proActivating : ja.settings.proActivate}
              </button>
            </div>
            {proError && <p className="mt-1 text-sm font-bold text-warning">{proError}</p>}
          </>
        )}
      </section>

      {/* 追加レシピパック */}
      <section className={sectionCls}>
        <h2 className="font-bold">{ja.settings.packTitle}</h2>
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
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.packDescription}</p>
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              <input
                type="text"
                value={packCodeInput}
                onChange={(e) => {
                  setPackCodeInput(e.target.value)
                  setPackError('')
                }}
                placeholder={ja.settings.packCodePlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => void activatePack()}
                disabled={packChecking || !packCodeInput.trim()}
                className="inline-flex shrink-0 items-center rounded-sm bg-accent px-4 font-bold text-app disabled:opacity-40"
              >
                {packChecking ? ja.settings.packActivating : ja.settings.packActivate}
              </button>
            </div>
            {packError && <p className="mt-1 text-sm font-bold text-warning">{packError}</p>}
          </>
        )}
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
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* アプリについて */}
      <section className={sectionCls}>
        <h2 className="font-bold">{ja.settings.aboutTitle}</h2>
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
    </div>
  )
}
