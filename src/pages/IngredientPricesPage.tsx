import { useMemo, useState } from 'react'
import { Plus, RotateCcw, Search, X } from 'lucide-react'
import {
  usePriceEntries,
  addPriceEntry,
  updatePriceEntry,
  removePriceEntry,
  resetPriceEntryToDefault,
} from '../db/prices'
import { toHiragana } from '../logic/kana'
import BackHeader from '../components/BackHeader'
import { ja } from '../i18n/ja'
import type { PriceEntry } from '../db/types'

const inputCls =
  'min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60'

/** blurで保存 or Enterキーでも即保存できるようにする(Enterはネイティブのblurを誘発させる) */
const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur()
}

/**
 * 「食材と価格」= 食材価格マスタの一覧・一括インライン編集・追加・削除。
 * ここで登録した目安価格は、レシピの「材料ごとの価格入力」が無い材料だけを補う
 * フォールバックとして、詳細画面・献立プランナーの概算食費に使われる（docs/20 §3）。
 *
 * 2026-07-12 UX改修: 編集モーダル（タップ→別窓で編集→保存）をやめ、一覧の各行の
 * 価格・単位を直接書き換えられる形にした（オーナー実機フィードバック: 「編集が面倒」）。
 * 各入力はuncontrolled(defaultValue)にして、確定した値が変わったときだけ
 * key(id-値)を変えて再マウントすることで、他の行の編集中に値が飛ばないようにしている
 */
export default function IngredientPricesPage() {
  const entries = usePriceEntries()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!entries) return entries
    const normalizedQuery = toHiragana(query.trim())
    if (!normalizedQuery) return entries
    return entries.filter((entry) => toHiragana(entry.name).includes(normalizedQuery))
  }, [entries, query])

  const commitPrice = async (id: number, raw: string) => {
    const value = Number(raw)
    if (!(value > 0)) return
    await updatePriceEntry(id, { pricePerUnit: value })
  }
  const commitUnit = async (id: number, raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    await updatePriceEntry(id, { unit: trimmed })
  }

  // 新規追加
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newUnit, setNewUnit] = useState('')
  const addNew = async () => {
    await addPriceEntry(newName, Number(newPrice) || 0, newUnit)
    setNewName('')
    setNewPrice('')
    setNewUnit('')
  }

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader fallback="/settings" title={ja.priceMaster.title} />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        <p className="rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-ink-muted">
          {ja.priceMaster.disclaimer}
        </p>

        {entries && entries.length === 0 && (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.priceMaster.empty}</p>
        )}

        {entries && entries.length > 0 && (
          <>
            <div className="relative mt-[var(--space-md)]">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ja.priceMaster.searchPlaceholder}
                aria-label={ja.priceMaster.searchLabel}
                className="w-full rounded-md border border-edge bg-surface py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>

            {filtered && filtered.length === 0 && (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.priceMaster.searchEmpty}</p>
            )}

            {filtered && filtered.length > 0 && (
              <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface">
                {filtered.map((entry) => (
                  <PriceRow
                    key={entry.id}
                    entry={entry}
                    onCommitPrice={commitPrice}
                    onCommitUnit={commitUnit}
                    onReset={() => void resetPriceEntryToDefault(entry.id!)}
                    onRemove={() => void removePriceEntry(entry.id!)}
                  />
                ))}
              </ul>
            )}
          </>
        )}

        {/* 新規追加 */}
        <div className="mt-[var(--space-md)] space-y-2 rounded-md border border-edge bg-surface p-[var(--space-sm)]">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={ja.priceMaster.namePlaceholder}
            aria-label={ja.priceMaster.nameLabel}
            className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder={ja.priceMaster.pricePlaceholder}
              aria-label={ja.priceMaster.priceLabel}
              className={inputCls}
            />
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder={ja.priceMaster.unitPlaceholder}
              aria-label={ja.priceMaster.unitLabel}
              className={inputCls}
            />
          </div>
          <button
            type="button"
            onClick={() => void addNew()}
            disabled={!newName.trim() || !newUnit.trim() || !(Number(newPrice) > 0)}
            className="flex w-full items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
            {ja.priceMaster.add}
          </button>
        </div>
      </div>
    </div>
  )
}

/** 一覧の1行分。価格・単位はその場でインライン編集でき、blur(またはEnter)で即保存する */
function PriceRow({
  entry,
  onCommitPrice,
  onCommitUnit,
  onReset,
  onRemove,
}: {
  entry: PriceEntry
  onCommitPrice: (id: number, raw: string) => void
  onCommitUnit: (id: number, raw: string) => void
  onReset: () => void
  onRemove: () => void
}) {
  const isDefault = entry.isDefault === true
  const canReset = !isDefault && entry.defaultPricePerUnit != null && entry.defaultUnit != null

  return (
    <li className="flex items-center gap-2 px-[var(--space-sm)] py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{entry.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {isDefault ? (
            <span className="rounded-sm border border-edge px-1.5 py-0.5 text-xs text-ink-muted">
              {ja.priceMaster.badgeDefault}
            </span>
          ) : (
            <span
              className="rounded-sm px-1.5 py-0.5 text-xs text-accent"
              style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
            >
              {ja.priceMaster.badgeCustom}
            </span>
          )}
          {canReset && (
            <button
              type="button"
              onClick={onReset}
              aria-label={ja.priceMaster.resetToDefaultAria.replace('{name}', entry.name)}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-accent underline"
            >
              <RotateCcw size={12} aria-hidden />
              {ja.priceMaster.resetToDefault}
            </button>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <input
          key={`price-${entry.id}-${entry.pricePerUnit}`}
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={entry.pricePerUnit}
          onBlur={(e) => onCommitPrice(entry.id!, e.target.value)}
          onKeyDown={blurOnEnter}
          aria-label={ja.priceMaster.entryPriceAria.replace('{name}', entry.name)}
          className="w-16 rounded-sm border border-edge bg-app px-2 py-2 text-right text-base text-ink"
        />
        <span className="text-sm text-ink-muted">{ja.priceMaster.priceYen}/</span>
        <input
          key={`unit-${entry.id}-${entry.unit}`}
          type="text"
          defaultValue={entry.unit}
          onBlur={(e) => onCommitUnit(entry.id!, e.target.value)}
          onKeyDown={blurOnEnter}
          aria-label={ja.priceMaster.entryUnitAria.replace('{name}', entry.name)}
          className="w-16 rounded-sm border border-edge bg-app px-2 py-2 text-base text-ink"
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ja.priceMaster.remove}
        className="shrink-0 rounded-full p-2 text-ink-muted"
      >
        <X size={18} aria-hidden />
      </button>
    </li>
  )
}
