import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  ChevronRight,
  Dices,
  X,
  Search,
  ShoppingCart,
  CheckCircle2,
  Sparkles,
  Clock,
  TriangleAlert,
  Lock,
  Route,
} from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { useMealPlanRange, assignMeal, clearMeal } from '../db/mealPlan'
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  markAllTodayListCooked,
  importRecipeIdsToTodayList,
} from '../db/todayList'
import {
  MEAL_SLOTS,
  weekDates,
  shiftWeek,
  monthDates,
  shiftMonth,
  monthLeadingBlanks,
  suggestForSlot,
  todayPlanMismatch,
} from '../logic/mealPlan'
import { todayString } from '../logic/date'
import { hasNgIngredient } from '../logic/ng'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import type { MealSlot, Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/** 今日の献立の1行（小サムネ＋名前＋作った/×） */
function TodayListRow({
  recipe,
  onCooked,
  onRemove,
}: {
  recipe: Recipe
  onCooked: () => void
  onRemove: () => void
}) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <li className="flex items-center gap-2 px-[var(--space-sm)] py-2">
      <Link to={`/recipes/${recipe.id}`} className="h-10 w-10 shrink-0 overflow-hidden rounded-sm">
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} iconSize={20} />
        )}
      </Link>
      <Link to={`/recipes/${recipe.id}`} className="min-w-0 flex-1 truncate font-bold">
        {recipe.title}
      </Link>
      <button
        type="button"
        onClick={onCooked}
        aria-label={ja.mealPlan.todayMarkCooked}
        className="rounded-full p-2 text-accent"
      >
        <CheckCircle2 size={20} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ja.mealPlan.todayRemove}
        className="rounded-full p-2 text-ink-muted"
      >
        <X size={20} aria-hidden />
      </button>
    </li>
  )
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

  // 月間の献立ビュー（Pro機能）
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')
  const [monthAnchor, setMonthAnchor] = useState(() => todayString())
  const isPro = !!settings?.proCode
  const monthDatesList = useMemo(
    () => monthDates(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  const monthLeading = useMemo(
    () => monthLeadingBlanks(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  const monthEntries = useMealPlanRange(
    monthDatesList[0],
    monthDatesList[monthDatesList.length - 1],
  )
  const monthDaysWithPlan = useMemo(() => {
    const set = new Set<string>()
    monthEntries?.forEach((e) => set.add(e.date))
    return set
  }, [monthEntries])
  const goToWeekOf = (date: string) => {
    setWeekStart(weekDates(new Date(`${date}T00:00:00`))[0])
    setViewMode('week')
  }
  const entryMap = useMemo(() => {
    const map = new Map<string, { id: number; recipeId: number }>()
    entries?.forEach((e) => map.set(`${e.date}|${e.slot}`, { id: e.id!, recipeId: e.recipeId }))
    return map
  }, [entries])

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // 表示する食事帯（未設定なら朝昼夜すべて）
  const visibleSlots = settings?.visibleMealSlots ?? [...MEAL_SLOTS]
  const toggleSlot = (slot: MealSlot) => {
    const next = visibleSlots.includes(slot)
      ? visibleSlots.filter((s) => s !== slot)
      : [...visibleSlots, slot]
    // 全部外すことはできない（何も見えなくなるため）
    if (next.length === 0) return
    void updateSettings({ visibleMealSlots: next })
  }
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    visibleRecipes.forEach((r) => map.set(r.id!, r))
    return map
  }, [visibleRecipes])

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）
  const todayList = useTodayList()
  const todayListRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])

  // 今週の献立のうち「今日」の枠(表示中の食事帯のみ)に入っているレシピID（取り込みボタン用）
  const todayFromPlanIds = useMemo(() => {
    const ids = new Set<number>()
    entries?.forEach((e) => {
      if (e.date === today && visibleSlots.includes(e.slot)) ids.add(e.recipeId)
    })
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, today, settings?.visibleMealSlots])

  // 「今日の献立」にあるのに、今日の週プラン枠には入っていないレシピ
  // (週プランを使っていない=今日の枠が0件のときは食い違い扱いにしない)
  const mismatchRecipes = useMemo(() => {
    const todayListIds = todayList?.map((item) => item.recipeId) ?? []
    const mismatchIds = todayPlanMismatch(todayListIds, todayFromPlanIds)
    return mismatchIds
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, todayFromPlanIds, recipeById])

  // 献立タブを開いたときの初期表示位置(2026-07-12オーナー指示): 今日の献立に入力があれば
  // 先頭(今日の献立セクションが最上部なので何もしなくてよい)／今日は空だが今週の献立に
  // 入力があれば「今週の献立」見出しまでスクロール／どちらも空なら先頭のまま。
  // todayList・entriesが両方確定してから一度だけ判定する(liveQueryの再評価のたびに
  // 動かないよう、初回1回のみに固定するためinitialScrollRefで守る)
  const weekHeadingRef = useRef<HTMLHeadingElement | null>(null)
  const initialScrollRef = useRef(false)
  useEffect(() => {
    if (initialScrollRef.current) return
    if (todayList === undefined || entries === undefined) return // データ確定待ち
    initialScrollRef.current = true
    if (todayList.length > 0) return // 今日の献立あり→先頭(今日の献立セクション)のまま
    if (entries.length === 0) return // 今週の献立も空→先頭のまま
    // 今日は空・今週には入力がある→「今週の献立」見出しまでスクロール
    // (レイアウト確定を待つため2フレーム分遅らせる。一覧の復元と同じ対策)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        weekHeadingRef.current?.scrollIntoView({ block: 'start' })
      })
    })
  }, [todayList, entries])

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
      slot,
    })
    if (!picked) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    await assignMeal(date, slot, picked.id!)
  }

  /** 週の空いている枠(表示中の食事帯のみ)すべてに自動提案で埋める。埋まっている枠は触らない */
  const fillWeek = async () => {
    if (!recipes) return
    setMessage('')
    const usedRecipeIds = (entries ?? []).map((e) => e.recipeId)
    for (const date of dates) {
      for (const slot of visibleSlots) {
        if (entryMap.has(`${date}|${slot}`)) continue
        const picked = suggestForSlot(visibleRecipes, {
          quickOnly,
          excludeNg: true,
          ngIngredients: settings?.ngIngredients ?? [],
          usedRecipeIds,
          slot,
        })
        if (!picked) continue
        await assignMeal(date, slot, picked.id!)
        usedRecipeIds.push(picked.id!)
      }
    }
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

  // 材料に価格が1件も入力されていなければ「週の概算食費」セクションごと非表示にする
  // (価格入力していない人には無意味な表示のため。2026-07-10 オーナー要望)
  const hasPricedRecipe = useMemo(
    () => (recipes ?? []).some((r) => r.ingredients.some((i) => (i.price ?? 0) > 0)),
    [recipes],
  )

  const weekRecipeIds = useMemo(() => {
    const ids = new Set<number>()
    entries?.forEach((e) => {
      if (visibleSlots.includes(e.slot)) ids.add(e.recipeId)
    })
    // 「今日の献立」(今日つくるリスト)の分も買い物候補に含める。
    // 週の表を使わず今日の献立だけで運用する人の材料が漏れないように
    // (2026-07-09 ペルソナテスト第1波)。重複は既存の合算ロジックがまとめる
    todayList?.forEach((item) => ids.add(item.recipeId))
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, settings?.visibleMealSlots, todayList])

  const goShopping = () => {
    if (weekRecipeIds.length === 0) return
    navigate(`/shopping?recipeIds=${weekRecipeIds.join(',')}`)
  }

  const dowLabels = ja.mealPlan.dow

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 今日の献立（週間プランナーとは別の「今日これ作る」リスト） */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="text-xl font-bold">{ja.mealPlan.todayTitle}</h2>

        {todayListRecipes && todayListRecipes.length > 0 ? (
          <>
            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
              {todayListRecipes.map((recipe) => (
                <TodayListRow
                  key={recipe.id}
                  recipe={recipe}
                  onCooked={() => void markTodayListCooked(recipe.id!)}
                  onRemove={() => void removeFromTodayList(recipe.id!)}
                />
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void markAllTodayListCooked(todayListRecipes.map((r) => r.id!))}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-app shadow-sm"
            >
              <CheckCircle2 size={18} aria-hidden />
              {ja.mealPlan.todayMarkAllCooked}
            </button>

            {todayListRecipes.length >= 2 && (
              <Link
                to="/cook-navi"
                className="mt-[var(--space-sm)] flex w-full items-center gap-2 rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
              >
                <Route size={20} className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-accent">{ja.mealPlan.cookNaviEntry}</span>
                  <span className="block text-xs text-ink-muted">{ja.mealPlan.cookNaviEntrySub}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
              </Link>
            )}

            {mismatchRecipes.length > 0 && (
              <div className="mt-[var(--space-sm)] rounded-md border border-warning bg-surface p-[var(--space-sm)]">
                <p className="flex items-center gap-1 text-sm font-bold text-warning">
                  <TriangleAlert size={16} aria-hidden />
                  {ja.mealPlan.planMismatchNotice}
                </p>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.planMismatchDescription}</p>
                <div className="mt-[var(--space-sm)] space-y-2">
                  {mismatchRecipes.map((recipe) => (
                    <div key={recipe.id}>
                      <p className="truncate text-sm font-bold">{recipe.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {visibleSlots.map((slot) => {
                          const currentEntry = entryMap.get(`${today}|${slot}`)
                          const currentTitle = currentEntry
                            ? recipeById.get(currentEntry.recipeId)?.title
                            : undefined
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => void assignMeal(today, slot, recipe.id!)}
                              className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                            >
                              {ja.mealPlan.slot[slot]}
                              <span className="ml-1 font-normal text-ink-muted">
                                (
                                {currentTitle
                                  ? ja.mealPlan.planMismatchCurrent.replace('{title}', currentTitle)
                                  : ja.mealPlan.planMismatchEmpty}
                                )
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-[var(--space-sm)]">
            <p className="text-sm text-ink-muted">{ja.mealPlan.todayEmpty}</p>
            {todayFromPlanIds.length > 0 && (
              <button
                type="button"
                onClick={() => void importRecipeIdsToTodayList(todayFromPlanIds)}
                className="mt-[var(--space-sm)] w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
              >
                {ja.mealPlan.todayImport.replace('{n}', String(todayFromPlanIds.length))}
              </button>
            )}
          </div>
        )}
      </section>

      {/* 週／月の切り替え */}
      <div className="mt-[var(--space-lg)] flex gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setViewMode('week')}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'week'
              ? 'border-accent bg-accent text-app'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewWeek}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('month')}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'month'
              ? 'border-accent bg-accent text-app'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewMonth}
        </button>
      </div>

      {viewMode === 'month' &&
        (isPro ? (
          <div className="mt-[var(--space-md)]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, -1))}
                aria-label={ja.mealPlan.prevMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor(todayString())}
                className="text-sm font-bold text-ink-muted"
              >
                {monthAnchor.slice(0, 4)}/{monthAnchor.slice(5, 7)}
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, 1))}
                aria-label={ja.mealPlan.nextMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            <div className="mt-[var(--space-sm)] grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-muted">
              {ja.mealPlan.dow.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: monthLeading }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {monthDatesList.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => goToWeekOf(date)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-sm border text-sm ${
                    date === today
                      ? 'border-accent bg-accent text-app font-bold'
                      : 'border-edge bg-surface text-ink'
                  }`}
                >
                  <span>{Number(date.slice(8, 10))}</span>
                  {monthDaysWithPlan.has(date) && (
                    <span
                      aria-label={ja.mealPlan.monthDayHasPlan}
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        date === today ? 'bg-app' : 'bg-accent'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center shadow-sm">
            <Lock size={28} className="mx-auto text-ink-muted" aria-hidden />
            <p className="mt-[var(--space-sm)] font-bold">{ja.mealPlan.monthProGateTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.monthProGateDescription}</p>
            <Link
              to="/settings?section=pro"
              className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent underline"
            >
              {ja.mealPlan.monthProGateLink}
            </Link>
          </div>
        ))}

      {viewMode === 'week' && (
      <>
      {/* 今週の献立 */}
      <h2 ref={weekHeadingRef} className="mt-[var(--space-lg)] text-xl font-bold">
        {ja.mealPlan.weekTitle}
      </h2>

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

      {/* 表示する食事帯 */}
      <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
        {ja.mealPlan.slotFilterTitle}
      </p>
      <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => toggleSlot(slot)}
            className={`rounded-sm border px-3 py-2 text-sm font-bold ${
              visibleSlots.includes(slot)
                ? 'border-accent bg-accent text-app'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.mealPlan.slot[slot]}
          </button>
        ))}
      </div>

      {/* 自動提案の条件 */}
      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setQuickOnly((v) => !v)}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            quickOnly ? 'border-accent bg-accent text-app' : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.quickOnlyToggle}
        </button>
        <button
          type="button"
          onClick={() => void fillWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
        >
          <Sparkles size={14} aria-hidden />
          {ja.mealPlan.fillWeek}
        </button>
      </div>

      {message && (
        <p className="mt-[var(--space-sm)] rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-ink-muted">
          {message}
        </p>
      )}

      {/* 週の概算食費（材料に価格を1件も入力していない場合はセクションごと非表示） */}
      {hasPricedRecipe && (
        <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <h2 className="font-bold">{ja.mealPlan.weekCostTitle}</h2>
          <p className="mt-1 text-2xl font-bold text-accent">約{weekCost.toLocaleString()}円</p>
          <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostNote}</p>
          <Link to="/recipes" className="mt-1 inline-block text-sm font-bold text-accent underline">
            {ja.mealPlan.weekCostNoteLink}
          </Link>
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
      )}

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
              {visibleSlots.map((slot) => {
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
                      className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm border border-edge bg-app px-2 py-2 text-left text-sm"
                    >
                      {recipe && hasNgIngredient(recipe, settings?.ngIngredients ?? []) && (
                        <TriangleAlert
                          size={14}
                          className="shrink-0 text-warning"
                          aria-label={ja.detail.ngWarning}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate">
                        {recipe ? recipe.title : <span className="text-ink-muted">{ja.mealPlan.empty}</span>}
                      </span>
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
      </>
      )}

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
                      className="flex w-full items-center gap-2 px-[var(--space-md)] py-3 text-left"
                    >
                      {hasNgIngredient(recipe, settings?.ngIngredients ?? []) && (
                        <TriangleAlert
                          size={16}
                          className="shrink-0 text-warning"
                          aria-label={ja.detail.ngWarning}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                        {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock size={12} aria-hidden />
                            {recipe.cookMinutes}
                            {ja.recipes.minutesSuffix}
                          </span>
                        )}
                        <span className="rounded-sm border border-edge px-1.5 py-0.5">
                          {ja.effort[recipe.effortLevel]}
                        </span>
                      </span>
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
