import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChefHat, Search, ChevronUp, ChevronDown, X, Plus, CheckCircle2 } from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import { usePantryItems } from '../db/pantry'
import { pantryHaveNames } from '../logic/pantry'
import {
  useShoppingItems,
  addShoppingItem,
  addConfirmedItems,
  toggleShoppingChecked,
  removeShoppingItem,
  moveShoppingItem,
  completeShopping,
} from '../db/shopping'
import { buildShoppingCandidates, type ShoppingCandidate } from '../logic/shopping'
import PantryBoard from '../components/PantryBoard'
import { ja } from '../i18n/ja'

type CandidateRow = ShoppingCandidate & { checked: boolean }

/** 買い物タブ: レシピからの候補づくり→確定した買い物メモ＋在庫ボード */
export default function ShoppingPage() {
  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const pantryItems = usePantryItems()
  const haveNames = useMemo(() => pantryHaveNames(pantryItems ?? []), [pantryItems])
  const shoppingItems = useShoppingItems()

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // レシピ選択ピッカー
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const filteredRecipes = useMemo(() => {
    const q = pickerQuery.trim()
    if (!q) return visibleRecipes
    return visibleRecipes.filter((r) => r.title.includes(q))
  }, [visibleRecipes, pickerQuery])

  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }

  // 買い物候補（下書き。確定するまでDBには保存しない）
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(null)

  // 献立プランナーの「この週の買い物リストを作る」から来た場合（?recipeIds=1,2,3）は
  // ピッカーを介さず自動で候補を作る
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const raw = searchParams.get('recipeIds')
    if (!raw || !recipes) return
    const ids = raw
      .split(',')
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n))
    const chosen = recipes.filter((r) => ids.includes(r.id!))
    if (chosen.length > 0) {
      const built = buildShoppingCandidates(
        chosen.map((r) => ({ id: r.id!, ingredients: r.ingredients })),
        haveNames,
      )
      setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('recipeIds')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, searchParams])

  const makeCandidates = () => {
    const chosen = visibleRecipes.filter((r) => selectedIds.includes(r.id!))
    const built = buildShoppingCandidates(
      chosen.map((r) => ({ id: r.id!, ingredients: r.ingredients })),
      haveNames,
    )
    setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
    setPickerOpen(false)
    setSelectedIds([])
    setPickerQuery('')
  }

  const addConfirmed = async () => {
    if (!candidates) return
    const chosen = candidates.filter((c) => c.checked)
    await addConfirmedItems(chosen.map(({ name, amount, recipeIds }) => ({ name, amount, recipeIds })))
    setCandidates(null)
  }

  // 手動追加
  const [manualName, setManualName] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const addManual = async () => {
    if (!manualName.trim()) return
    await addShoppingItem(manualName, manualAmount)
    setManualName('')
    setManualAmount('')
  }

  // 買い物完了
  const [completeOpen, setCompleteOpen] = useState(false)
  const checkedItems = (shoppingItems ?? []).filter((i) => i.isChecked)
  const runComplete = async (reflect: boolean) => {
    await completeShopping(checkedItems, reflect)
    setCompleteOpen(false)
  }

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.nav.shopping}</h1>

      {/* 買い物メモ */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{ja.shopping.memoTitle}</h2>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
          >
            <ChefHat size={16} aria-hidden />
            {ja.shopping.fromRecipeTitle}
          </button>
        </div>

        {shoppingItems && shoppingItems.length === 0 && !candidates && (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.shopping.memoEmpty}</p>
        )}

        {shoppingItems && shoppingItems.length > 0 && (
          <ul className="mt-[var(--space-md)] divide-y divide-edge rounded-md border border-edge bg-app">
            {shoppingItems.map((item, index) => (
              <li key={item.id} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
                <button
                  type="button"
                  onClick={() => void toggleShoppingChecked(item.id!)}
                  aria-pressed={item.isChecked}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                    item.isChecked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                  }`}
                >
                  <CheckCircle2 size={18} aria-hidden />
                </button>
                <div className={`min-w-0 flex-1 px-2 ${item.isChecked ? 'text-ink-muted line-through' : ''}`}>
                  <span className="font-bold">{item.name}</span>
                  {item.amount && <span className="ml-2 text-sm">{item.amount}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => void moveShoppingItem(shoppingItems, index, -1)}
                  disabled={index === 0}
                  aria-label={ja.form.moveUp}
                  className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                >
                  <ChevronUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void moveShoppingItem(shoppingItems, index, 1)}
                  disabled={index === shoppingItems.length - 1}
                  aria-label={ja.form.moveDown}
                  className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                >
                  <ChevronDown size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void removeShoppingItem(item.id!)}
                  aria-label={ja.shopping.remove}
                  className="rounded-full p-2 text-ink-muted"
                >
                  <X size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* 手動追加 */}
        <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder={ja.shopping.manualPlaceholder}
            className="min-w-0 flex-[2] rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
          />
          <input
            type="text"
            value={manualAmount}
            onChange={(e) => setManualAmount(e.target.value)}
            placeholder={ja.shopping.manualAmountPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
          />
          <button
            type="button"
            onClick={() => void addManual()}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent shadow-sm"
          >
            <Plus size={18} aria-hidden />
            {ja.shopping.manualAdd}
          </button>
        </div>

        {/* 買い物完了 */}
        {checkedItems.length > 0 && (
          <button
            type="button"
            onClick={() => setCompleteOpen(true)}
            className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 text-lg font-bold text-on-accent shadow-sm"
          >
            {ja.shopping.complete}
          </button>
        )}

        {completeOpen && (
          <div className="mt-[var(--space-md)] rounded-md border border-edge bg-app p-[var(--space-md)] shadow-md">
            <h3 className="font-bold">{ja.shopping.completeConfirmTitle}</h3>
            <p className="mt-1 text-sm text-ink-muted">{ja.shopping.completeConfirmDescription}</p>
            <div className="mt-[var(--space-md)] flex gap-2">
              <button
                type="button"
                onClick={() => void runComplete(true)}
                className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
              >
                {ja.shopping.completeYes}
              </button>
              <button
                type="button"
                onClick={() => void runComplete(false)}
                className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
              >
                {ja.shopping.completeNo}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* 買い物候補（下書き） */}
      {candidates && (
        <section className="mt-[var(--space-md)] rounded-md border border-accent bg-surface p-[var(--space-md)] shadow-sm">
          <h2 className="text-xl font-bold">{ja.shopping.candidateTitle}</h2>
          <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateDescription}</p>

          {candidates.length === 0 ? (
            <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.shopping.candidateEmpty}</p>
          ) : (
            <ul className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
              {candidates.map((c, index) => (
                <li key={c.name} className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setCandidates((prev) =>
                        prev
                          ? prev.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row))
                          : prev,
                      )
                    }
                    aria-pressed={c.checked}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                      c.checked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                    }`}
                  >
                    <CheckCircle2 size={18} aria-hidden />
                  </button>
                  <span className="min-w-0 flex-1 truncate pt-2 font-bold">{c.name}</span>
                  <textarea
                    ref={(el) => {
                      if (el) {
                        el.style.height = 'auto'
                        el.style.height = `${el.scrollHeight}px`
                      }
                    }}
                    value={c.amount}
                    onChange={(e) => {
                      const value = e.target.value
                      setCandidates((prev) =>
                        prev ? prev.map((row, i) => (i === index ? { ...row, amount: value } : row)) : prev,
                      )
                      e.currentTarget.style.height = 'auto'
                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                    }}
                    placeholder={ja.shopping.amountPlaceholder}
                    rows={1}
                    className="w-24 shrink-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-sm border border-edge bg-app px-2 py-2 text-sm text-ink leading-snug"
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="mt-[var(--space-md)] flex gap-2">
            {candidates.length > 0 && (
              <button
                type="button"
                onClick={() => void addConfirmed()}
                className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
              >
                {ja.shopping.addConfirmed}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCandidates(null)}
              className="rounded-md border border-edge bg-surface px-4 py-3 font-bold text-ink-muted shadow-sm"
            >
              {ja.shopping.discardCandidates}
            </button>
          </div>
        </section>
      )}

      <PantryBoard />

      {/* レシピ選択ピッカー */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.shopping.pickRecipes}</h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label={ja.focus.close}
              className="rounded-full p-2 text-ink-muted"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="px-[var(--space-md)]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={ja.shopping.pickerSearchPlaceholder}
                className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-y-auto px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.shopping.pickerEmpty : ja.shopping.pickerNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {filteredRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <label className="flex items-center gap-3 px-[var(--space-md)] py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(recipe.id!)}
                        onChange={() => toggleSelected(recipe.id!)}
                        className="h-5 w-5 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="px-[var(--space-md)] pb-[calc(var(--space-md)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]">
            <button
              type="button"
              onClick={makeCandidates}
              disabled={selectedIds.length === 0}
              className="w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
            >
              {ja.shopping.makeCandidates}
              {selectedIds.length > 0 ? `（${selectedIds.length}）` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
