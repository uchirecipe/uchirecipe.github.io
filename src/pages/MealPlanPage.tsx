import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Dices, X, Search, ShoppingCart } from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import { useMealPlanRange, assignMeal, clearMeal } from '../db/mealPlan'
import { MEAL_SLOTS, weekDates, shiftWeek, suggestForSlot } from '../logic/mealPlan'
import type { MealSlot, Recipe } from '../db/types'
import { ja } from '../i18n/ja'

function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 献立タブ: 週カレンダー（月〜日 × 朝昼夜）にレシピを割り当てる */
export default function MealPlanPage() {
  const navigate = useNavigate()
  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const today = useMemo(todayString, [])
  const [weekStart, setWeekStart] = useState(() => weekDates(new Date())[0])
  const dates = useMemo(() => weekDates(new Date(`${weekStart}T00:00:00`)), [weekStart])

  const entries = useMealPlanRange(dates[0], dates[6])
  const entryMap = useMemo(() => {
    const map = new Map<string, { id: number; recipeId: number }>()
    entries?.forEach((e) => map.set(`${e.date}|${e.slot}`, { id: e.id!, recipeId: e.recipeId }))
    return map
  }, [entries])

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    visibleRecipes.forEach((r) => map.set(r.id!, r))
    return map
  }, [visibleRecipes])

  const [quickOnly, setQuickOnly] = useState(false)
  const [message, setMessage] = useState('')

  // レシピ選択ピッカー（どの日・枠に割り当てるか）
  const [pickerTarget, setPickerTarget] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const filteredRecipes = useMemo(() => {
    const q = pickerQuery.trim()
    if (!q) return visibleRecipes
    return visibleRecipes.filter((r) => r.title.includes(q))
  }, [visibleRecipes, pickerQuery])

  const suggest = async (date: string, slot: MealSlot) => {
    if (!recipes) return
    setMessage('')
    const usedRecipeIds = (entries ?? [])
      .filter((e) => !(e.date === date && e.slot === slot))
      .map((e) => e.recipeId)
    const picked = suggestForSlot(visibleRecipes, {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds,
    })
    if (!picked) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    await assignMeal(date, slot, picked.id!)
  }

  const openPicker = (date: string, slot: MealSlot) => {
    setPickerTarget({ date, slot })
    setPickerQuery('')
  }

  const pickRecipe = async (recipeId: number) => {
    if (!pickerTarget) return
    await assignMeal(pickerTarget.date, pickerTarget.slot, recipeId)
    setPickerTarget(null)
  }

  // 週の概算食費（材料に価格を入れたレシピだけ計算対象）
  const weekCost = useMemo(() => {
    if (!entries) return 0
    return entries.reduce((sum, e) => {
      const recipe = recipeById.get(e.recipeId)
      if (!recipe) return sum
      return sum + recipe.ingredients.reduce((s, i) => s + (i.price ?? 0), 0)
    }, 0)
  }, [entries, recipeById])

  const weeklyBudget = settings?.weeklyBudget
  const budgetDiff = weeklyBudget != null ? weeklyBudget - weekCost : undefined

  const weekRecipeIds = useMemo(() => {
    const ids = new Set<number>()
    entries?.forEach((e) => ids.add(e.recipeId))
    return Array.from(ids)
  }, [entries])

  const goShopping = () => {
    if (weekRecipeIds.length === 0) return
    navigate(`/shopping?recipeIds=${weekRecipeIds.join(',')}`)
  }

  const dowLabels = ja.mealPlan.dow

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 週の移動 */}
      <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, -1))}
          aria-label={ja.mealPlan.prevWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(weekDates(new Date())[0])}
          className="text-sm font-bold text-ink-muted"
        >
          {dates[0].replaceAll('-', '/')} 〜 {dates[6].replaceAll('-', '/')}
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, 1))}
          aria-label={ja.mealPlan.nextWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {/* 自動提案の条件 */}
      <button
        type="button"
        onClick={() => setQuickOnly((v) => !v)}
        className={`mt-[var(--space-sm)] rounded-sm border px-3 py-2 text-sm font-bold ${
          quickOnly ? 'border-accent bg-accent text-app' : 'border-edge bg-surface text-ink-muted'
        }`}
      >
        {ja.mealPlan.quickOnlyToggle}
      </button>

      {message && (
        <p className="mt-[var(--space-sm)] rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-ink-muted">
          {message}
        </p>
      )}

      {/* 週の概算食費 */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="font-bold">{ja.mealPlan.weekCostTitle}</h2>
        <p className="mt-1 text-2xl font-bold text-accent">約{weekCost.toLocaleString()}円</p>
        <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostNote}</p>
        {weeklyBudget != null && budgetDiff != null ? (
          <p className="mt-1 text-sm font-bold text-ink-muted">
            {budgetDiff >= 0
              ? ja.mealPlan.budgetCompareUnder.replace('{n}', String(budgetDiff.toLocaleString()))
              : ja.mealPlan.budgetCompareOver.replace('{n}', String(Math.abs(budgetDiff).toLocaleString()))}
          </p>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.budgetNotSet}</p>
        )}
      </section>

      {/* 7日分のカード */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
        {dates.map((date, dayIndex) => (
          <section
            key={date}
            className={`rounded-md border p-[var(--space-md)] shadow-sm ${
              date === today ? 'border-accent bg-surface' : 'border-edge bg-surface'
            }`}
          >
            <h2 className="font-bold">
              {dowLabels[dayIndex]} {date.replaceAll('-', '/')}
              {date === today && <span className="ml-2 text-sm text-accent">{ja.mealPlan.thisWeek}</span>}
            </h2>
            <div className="mt-[var(--space-sm)] space-y-1">
              {MEAL_SLOTS.map((slot) => {
                const entry = entryMap.get(`${date}|${slot}`)
                const recipe = entry ? recipeById.get(entry.recipeId) : undefined
                return (
                  <div key={slot} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-sm font-bold text-ink-muted">
                      {ja.mealPlan.slot[slot]}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPicker(date, slot)}
                      className="min-w-0 flex-1 truncate rounded-sm border border-edge bg-app px-2 py-2 text-left text-sm"
                    >
                      {recipe ? recipe.title : <span className="text-ink-muted">{ja.mealPlan.empty}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => void suggest(date, slot)}
                      aria-label={ja.mealPlan.suggestAria}
                      className="rounded-full p-2 text-accent"
                    >
                      <Dices size={18} aria-hidden />
                    </button>
                    {entry && (
                      <button
                        type="button"
                        onClick={() => void clearMeal(date, slot)}
                        aria-label={ja.mealPlan.clear}
                        className="rounded-full p-2 text-ink-muted"
                      >
                        <X size={18} aria-hidden />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* この週の買い物リストを作る */}
      <button
        type="button"
        onClick={goShopping}
        disabled={weekRecipeIds.length === 0}
        className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md disabled:opacity-40"
      >
        <ShoppingCart size={20} aria-hidden />
        {ja.mealPlan.goToShopping}
      </button>
      {weekRecipeIds.length === 0 && (
        <p className="mt-1 text-center text-sm text-ink-muted">{ja.mealPlan.goToShoppingEmpty}</p>
      )}

      <Link
        to="/history"
        className="mt-[var(--space-md)] block text-center text-sm font-bold text-accent underline"
      >
        {ja.mealPlan.historyLink}
      </Link>

      {/* レシピ選択ピッカー */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.mealPlan.pickTitle}</h2>
            <button
              type="button"
              onClick={() => setPickerTarget(null)}
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
                placeholder={ja.mealPlan.pickSearchPlaceholder}
                className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-y-auto px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {filteredRecipes.map((recipe) => (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      onClick={() => void pickRecipe(recipe.id!)}
                      className="flex w-full items-center px-[var(--space-md)] py-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
