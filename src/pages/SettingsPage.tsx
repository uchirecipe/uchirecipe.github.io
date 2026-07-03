import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import type { ThemeSetting } from '../db/types'
import { ja } from '../i18n/ja'

const themeOptions: { value: ThemeSetting; label: string }[] = [
  { value: 'auto', label: ja.settings.themeAuto },
  { value: 'light', label: ja.settings.themeLight },
  { value: 'dark', label: ja.settings.themeDark },
]

const sectionCls =
  'mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm'

/** 設定: NG食材 / 画面を暗くしない / テーマ */
export default function SettingsPage() {
  const settings = useSettings()
  const [ngInput, setNgInput] = useState('')

  if (!settings) return null // 読み込み中

  const addNg = async () => {
    const value = ngInput.trim()
    if (!value || settings.ngIngredients.includes(value)) {
      setNgInput('')
      return
    }
    await updateSettings({ ngIngredients: [...settings.ngIngredients, value] })
    setNgInput('')
  }

  const removeNg = async (value: string) => {
    await updateSettings({
      ngIngredients: settings.ngIngredients.filter((ng) => ng !== value),
    })
  }

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.settings.title}</h1>

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

      {/* テーマ */}
      <section className={sectionCls}>
        <h2 className="font-bold">{ja.settings.themeTitle}</h2>
        <div className="mt-[var(--space-sm)] grid grid-cols-3 gap-[var(--space-sm)]">
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
    </div>
  )
}
