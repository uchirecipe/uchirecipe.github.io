import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, X, Download, Upload, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import { listRecipes } from '../db/recipes'
import { reloadStarterRecipes, starterCount } from '../db/starters'
import { downloadBackup, importBackup, parseBackup } from '../logic/backup'
import { hasNgIngredient } from '../logic/ng'
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

/** 設定: NG食材 / 画面を暗くしない / テーマ */
export default function SettingsPage() {
  const settings = useSettings()
  const recipes = useLiveQuery(listRecipes, [])
  const [ngInput, setNgInput] = useState('')
  const [message, setMessage] = useState('')
  const importFileRef = useRef<HTMLInputElement>(null)
  const importModeRef = useRef<'replace' | 'merge'>('merge')

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
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold">{ja.settings.screenTitle}</h2>
            <p className="mt-1 text-sm text-ink-muted">{ja.settings.screenDescription}</p>
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
        </div>
      </section>

      {/* タイマー音 */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between gap-3">
          <div>
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
        </div>
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
        <div className="mt-[var(--space-sm)] flex items-center justify-between gap-3">
          <span className="text-sm font-bold text-ink-muted">{ja.settings.starterHide}</span>
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
        </div>
        <button
          type="button"
          onClick={reloadStarters}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
        >
          <RotateCcw size={18} aria-hidden />
          {ja.settings.starterReload}
        </button>
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
    </div>
  )
}
