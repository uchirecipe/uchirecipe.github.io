import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import {
  searchRecipes,
  type EffortFilter,
  type TimeFilter,
} from '../logic/search'
import RecipeCard from '../components/RecipeCard'
import { ja } from '../i18n/ja'

const timeOptions: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: ja.search.timeAll },
  { value: 'under10', label: ja.search.timeUnder10 },
  { value: 'under30', label: ja.search.timeUnder30 },
  { value: 'over30', label: ja.search.timeOver30 },
]

const effortOptions: { value: EffortFilter; label: string }[] = [
  { value: 'all', label: ja.search.effortAll },
  { value: 'easy', label: ja.effort.easy },
  { value: 'normal', label: ja.effort.normal },
  { value: 'fancy', label: ja.effort.fancy },
]

const chipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
    active ? 'border-accent bg-accent text-app' : 'border-edge bg-surface text-ink-muted'
  }`

/** レシピ一覧: 検索・フィルタ＋写真カードのグリッド＋右下の「＋」ボタン */
export default function RecipesPage() {
  // ホーム画面から ?q=... / ?ing=... 付きで来たときは、その条件で開く
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [ingredients, setIngredients] = useState(searchParams.get('ing') ?? '')
  const [panelOpen, setPanelOpen] = useState(searchParams.get('ing') !== null)
  const [time, setTime] = useState<TimeFilter>('all')
  const [effort, setEffort] = useState<EffortFilter>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [excludeNg, setExcludeNg] = useState(false)

  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const ngIngredients = settings?.ngIngredients

  const results = useMemo(() => {
    if (!recipes) return undefined
    return searchRecipes(recipes, {
      query,
      ingredients,
      time,
      effort,
      favoriteOnly,
      excludeNg,
      ngIngredients: ngIngredients ?? [],
    })
  }, [recipes, query, ingredients, time, effort, favoriteOnly, excludeNg, ngIngredients])

  const filtersActive =
    query !== '' ||
    ingredients !== '' ||
    time !== 'all' ||
    effort !== 'all' ||
    favoriteOnly ||
    excludeNg

  const clearFilters = () => {
    setQuery('')
    setIngredients('')
    setTime('all')
    setEffort('all')
    setFavoriteOnly(false)
    setExcludeNg(false)
  }

  const subLabelFor = (usedCount: number, wantedCount: number) => {
    if (wantedCount === 0) return undefined
    if (usedCount === wantedCount) return ja.search.usedAll
    return ja.search.usedSome
      .replace('{m}', String(usedCount))
      .replace('{t}', String(wantedCount))
  }

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.recipes.title}</h1>

      {/* 検索バー＋絞り込みボタン */}
      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
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
            placeholder={ja.search.placeholder}
            className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label={ja.search.filterToggle}
          className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
            panelOpen || filtersActive
              ? 'border-accent text-accent'
              : 'border-edge text-ink-muted'
          }`}
        >
          <SlidersHorizontal size={22} aria-hidden />
        </button>
      </div>

      {/* 絞り込みパネル */}
      {panelOpen && (
        <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          {/* 使いたい食材 */}
          <label className="block text-sm font-bold text-ink-muted">
            {ja.search.ingredientTitle}
            <input
              type="text"
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder={ja.search.ingredientPlaceholder}
              className="mt-1 block w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
            />
          </label>

          {/* 調理時間 */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.timeTitle}
          </p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            {timeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTime(option.value)}
                className={chipCls(time === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 手間レベル */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.effortTitle}
          </p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            {effortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setEffort(option.value)}
                className={chipCls(effort === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* お気に入り / NG除外 */}
          <div className="mt-[var(--space-md)] flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setFavoriteOnly((v) => !v)}
              className={chipCls(favoriteOnly)}
            >
              {ja.search.favoriteOnly}
            </button>
            <button
              type="button"
              onClick={() => setExcludeNg((v) => !v)}
              className={chipCls(excludeNg)}
            >
              {ja.search.excludeNg}
            </button>
          </div>

          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-[var(--space-md)] text-sm font-bold text-accent underline"
            >
              {ja.search.clear}
            </button>
          )}
        </div>
      )}

      {/* 件数 */}
      {results && filtersActive && (
        <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
          {ja.search.resultCount.replace('{n}', String(results.length))}
        </p>
      )}

      {/* 空の状態 */}
      {results && results.length === 0 && (
        <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center text-ink-muted shadow-sm">
          {recipes && recipes.length === 0 ? (
            <>
              <p className="font-bold">{ja.recipes.empty}</p>
              <p className="mt-1 text-sm">{ja.recipes.emptyHint}</p>
            </>
          ) : (
            <p className="font-bold">{ja.search.noResult}</p>
          )}
        </div>
      )}

      {/* カードのグリッド */}
      <div className="mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)]">
        {results?.map(({ recipe, usedCount, wantedCount }) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            ngIngredients={ngIngredients}
            subLabel={subLabelFor(usedCount, wantedCount)}
          />
        ))}
      </div>

      {/* 新規登録ボタン（親指が届く右下に固定、タブナビの上） */}
      <Link
        to="/recipes/new"
        aria-label={ja.recipes.addRecipe}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-app shadow-md"
      >
        <Plus size={30} aria-hidden />
      </Link>
    </div>
  )
}
