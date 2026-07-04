import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Clock,
  Dices,
  Heart,
  History,
  Search,
  Carrot,
  HardDriveDownload,
  Refrigerator,
  ChevronRight,
  CalendarDays,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import { usePantryItems } from '../db/pantry'
import { pantryAvailableNames } from '../logic/pantry'
import { useMealPlanRange } from '../db/mealPlan'
import { MEAL_SLOTS } from '../logic/mealPlan'
import { backupOverdue } from '../logic/backup'
import { cookedWithinDays } from '../logic/cooked'
import { currentSeason, preferSeason } from '../logic/season'
import { toHiragana } from '../logic/kana'
import type { HomeWidgetKey, Recipe } from '../db/types'
import { defaultHomeWidgets } from '../db/types'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import ChipInput from '../components/ChipInput'
import { ja } from '../i18n/ja'

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

const conditions: { value: SuggestCondition; label: string }[] = [
  { value: 'any', label: ja.home.condAll },
  { value: 'notRecent', label: ja.home.condNotRecent },
  { value: 'favorite', label: ja.home.condFavorite },
  { value: 'quick', label: ja.home.condQuick },
]

function matchesCondition(recipe: Recipe, condition: SuggestCondition): boolean {
  if (condition === 'notRecent') return !cookedWithinDays(recipe, 14)
  if (condition === 'favorite') return recipe.isFavorite
  if (condition === 'quick')
    return recipe.cookMinutes != null && recipe.cookMinutes > 0 && recipe.cookMinutes <= 10
  return true
}

function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 提案カード（写真サムネイル＋名前で詳細へ） */
function SuggestionCard({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="mt-[var(--space-sm)] flex items-center gap-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm">
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} iconSize={32} />
        )}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 text-lg font-bold leading-snug">{recipe.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={14} aria-hidden />
              {recipe.cookMinutes}
              {ja.recipes.minutesSuffix}
            </span>
          )}
          <span>{ja.effort[recipe.effortLevel]}</span>
          {recipe.isFavorite && (
            <Heart size={14} className="text-accent" fill="currentColor" aria-hidden />
          )}
        </div>
      </div>
    </Link>
  )
}

/** ホーム: 表示パーツは設定でオン・オフ＆並べ替えできる（検索バーは常時表示） */
export default function HomePage() {
  const navigate = useNavigate()
  const allRecipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()

  const [condition, setCondition] = useState<SuggestCondition>('any')
  const [pantryOnly, setPantryOnly] = useState(false)
  const [seed, setSeed] = useState(() => Math.random())
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState<string[]>([])
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])

  const today = useMemo(todayString, [])
  const todayMeals = useMealPlanRange(today, today)

  // 「基本レシピを表示しない」設定を反映
  const recipes = useMemo(() => {
    if (!allRecipes) return undefined
    return settings?.hideStarters ? allRecipes.filter((r) => !r.isStarter) : allRecipes
  }, [allRecipes, settings?.hideStarters])

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    recipes?.forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  // 自分のレシピが1件以上あり、30日以上（または一度も）バックアップしていないとき
  const showBackupReminder =
    settings !== undefined &&
    (allRecipes?.some((r) => !r.isStarter) ?? false) &&
    backupOverdue(settings.lastBackupAt)

  // 条件で絞り込んだ上で、今の季節に合うものを優先する
  const candidates = useMemo(() => {
    const byCondition = (recipes ?? []).filter((r) => matchesCondition(r, condition))
    return preferSeason(byCondition, currentSeason())
  }, [recipes, condition])

  // 「在庫の食材で」がONのとき、在庫(ある/少ない)の食材を1つ以上使うレシピに絞る。
  // 0件ならズレの不満を防ぐため通常候補にフォールバックし、その旨を表示する
  const { list: finalCandidates, fallback: pantryFallback } = useMemo(() => {
    if (!pantryOnly || pantryNames.length === 0) return { list: candidates, fallback: false }
    const wantedKeys = pantryNames.map(toHiragana)
    const filtered = candidates.filter((r) =>
      r.ingredients.some((i) => wantedKeys.some((k) => toHiragana(i.name).includes(k))),
    )
    return filtered.length > 0
      ? { list: filtered, fallback: false }
      : { list: candidates, fallback: true }
  }, [candidates, pantryOnly, pantryNames])

  const suggestion =
    finalCandidates.length > 0
      ? finalCandidates[Math.floor(seed * finalCandidates.length) % finalCandidates.length]
      : undefined

  // 最近作ったもの: 全レシピの「作った記録」を新しい順に5件
  const history = useMemo(() => {
    if (!recipes) return []
    return recipes
      .flatMap((recipe) => recipe.cookedLogs.map((log) => ({ recipe, log })))
      .sort((a, b) => b.log.date.localeCompare(a.log.date))
      .slice(0, 5)
  }, [recipes])

  const submitSearch = () => {
    navigate(query.trim() ? `/recipes?q=${encodeURIComponent(query.trim())}` : '/recipes')
  }
  const submitIngredients = () => {
    if (ingredients.length === 0) return
    navigate(`/recipes?ing=${encodeURIComponent(ingredients.join(' '))}`)
  }

  const widgetSections: Record<HomeWidgetKey, ReactNode> = {
    mealPlan: (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <CalendarDays size={20} className="text-accent" aria-hidden />
          {ja.home.mealPlanTitle}
        </h2>
        {todayMeals && todayMeals.length > 0 ? (
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
            {MEAL_SLOTS.filter((slot) => todayMeals.some((e) => e.slot === slot)).map((slot) => {
              const entry = todayMeals.find((e) => e.slot === slot)!
              const recipe = recipeById.get(entry.recipeId)
              return (
                <li key={slot}>
                  <Link
                    to={recipe ? `/recipes/${recipe.id}` : '/meal-plan'}
                    className="flex items-center gap-2 px-[var(--space-md)] py-2"
                  >
                    <span className="w-14 shrink-0 text-sm text-ink-muted">{ja.mealPlan.slot[slot]}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">
                      {recipe?.title ?? ja.mealPlan.empty}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="mt-[var(--space-sm)] text-center">
            <p className="text-sm text-ink-muted">{ja.home.mealPlanEmpty}</p>
            <Link to="/meal-plan" className="mt-2 inline-block text-sm font-bold text-accent underline">
              {ja.home.mealPlanGoTo}
            </Link>
          </div>
        )}
      </section>
    ),
    suggestion: (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="text-xl font-bold">{ja.home.suggestTitle}</h2>

        {recipes && recipes.length === 0 ? (
          <div className="mt-[var(--space-sm)] text-center">
            <p className="text-ink-muted">{ja.home.empty}</p>
            <Link
              to="/recipes/new"
              className="mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-app shadow-sm"
            >
              {ja.home.goRegister}
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
              {conditions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCondition(option.value)}
                  className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                    condition === option.value
                      ? 'border-accent bg-accent text-app'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
              {pantryNames.length > 0 && (
                <button
                  type="button"
                  onClick={() => setPantryOnly((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    pantryOnly
                      ? 'border-accent bg-accent text-app'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  <Refrigerator size={14} aria-hidden />
                  {ja.home.pantryOnlyToggle}
                </button>
              )}
            </div>

            {pantryFallback && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.home.pantryOnlyFallback}
              </p>
            )}

            {suggestion ? (
              <SuggestionCard recipe={suggestion} />
            ) : (
              <p className="mt-[var(--space-sm)] text-ink-muted">{ja.home.noCandidate}</p>
            )}

            <button
              type="button"
              onClick={() => setSeed(Math.random())}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
            >
              <Dices size={20} aria-hidden />
              {ja.home.shuffle}
            </button>
          </>
        )}
      </section>
    ),
    ingredientSearch: (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <Carrot size={20} className="text-accent" aria-hidden />
          {ja.home.ingShortcutTitle}
        </h2>
        <div className="mt-[var(--space-sm)]">
          <ChipInput
            values={ingredients}
            onChange={setIngredients}
            placeholder={ja.home.ingPlaceholder}
            addLabel={ja.home.ingAdd}
          />
          {pantryNames.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) => Array.from(new Set([...prev, ...pantryNames])))
              }
              className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
            >
              <Refrigerator size={16} aria-hidden />
              {ja.pantry.addToSearch}
            </button>
          )}
          <button
            type="button"
            onClick={submitIngredients}
            disabled={ingredients.length === 0}
            className="mt-[var(--space-sm)] w-full shrink-0 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-50"
          >
            {ja.home.ingButton}
          </button>
        </div>
      </section>
    ),
    pantry: (
      <Link
        to="/shopping"
        className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-3 text-sm shadow-sm"
      >
        <Refrigerator size={18} className="shrink-0 text-accent" aria-hidden />
        <span className="min-w-0 flex-1 font-bold">{ja.home.pantryShortcut}</span>
        <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    ),
    history:
      history.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              <History size={20} className="text-accent" aria-hidden />
              {ja.home.historyTitle}
            </h2>
            <Link to="/history" className="text-sm font-bold text-accent underline">
              {ja.home.historyMore}
            </Link>
          </div>
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {history.map(({ recipe, log }, index) => (
              <li key={index}>
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center justify-between gap-2 px-[var(--space-md)] py-3"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                  <span className="shrink-0 text-sm text-ink-muted">
                    {log.date.replaceAll('-', '/')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null,
  }

  const homeWidgets = settings?.homeWidgets ?? defaultHomeWidgets

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)] pb-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.app.name}</h1>

      {/* バックアップの控えめなリマインド */}
      {showBackupReminder && (
        <Link
          to="/settings"
          className="mt-[var(--space-sm)] flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm text-ink-muted shadow-sm"
        >
          <HardDriveDownload size={16} className="shrink-0 text-accent" aria-hidden />
          <span className="min-w-0 flex-1">{ja.home.backupReminder}</span>
          <span className="shrink-0 font-bold text-accent">{ja.home.backupReminderLink}</span>
        </Link>
      )}

      {/* 検索バー（常時表示） */}
      <form
        className="mt-[var(--space-md)] flex gap-[var(--space-sm)]"
        onSubmit={(e) => {
          e.preventDefault()
          submitSearch()
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ja.home.searchPlaceholder}
            className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
          />
        </div>
        <button
          type="submit"
          className="shrink-0 rounded-md bg-accent px-4 font-bold text-app shadow-sm"
        >
          {ja.home.searchButton}
        </button>
      </form>

      {/* カスタマイズ可能なパーツ（設定でオン・オフ＆並べ替え） */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-md)]">
        {homeWidgets.map((key) => (
          <div key={key}>{widgetSections[key]}</div>
        ))}
      </div>
    </div>
  )
}
