import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Clock, Dices, Heart, History, Search, Carrot } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import type { Recipe } from '../db/types'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { ja } from '../i18n/ja'

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

const conditions: { value: SuggestCondition; label: string }[] = [
  { value: 'any', label: ja.home.condAll },
  { value: 'notRecent', label: ja.home.condNotRecent },
  { value: 'favorite', label: ja.home.condFavorite },
  { value: 'quick', label: ja.home.condQuick },
]

/** 直近14日以内に作っていたら true */
function cookedRecently(recipe: Recipe): boolean {
  const last = recipe.cookedLogs[0]?.date
  if (!last) return false
  const elapsed = Date.now() - new Date(last).getTime()
  return elapsed < 14 * 24 * 60 * 60 * 1000
}

function matchesCondition(recipe: Recipe, condition: SuggestCondition): boolean {
  if (condition === 'notRecent') return !cookedRecently(recipe)
  if (condition === 'favorite') return recipe.isFavorite
  if (condition === 'quick')
    return recipe.cookMinutes != null && recipe.cookMinutes > 0 && recipe.cookMinutes <= 10
  return true
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
          <RecipePlaceholder seed={recipe.tags[0] ?? recipe.title} iconSize={32} />
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

/** ホーム: 今日の提案＋検索＋使いたい食材＋最近の履歴 */
export default function HomePage() {
  const navigate = useNavigate()
  const recipes = useLiveQuery(listRecipes, [])

  const [condition, setCondition] = useState<SuggestCondition>('any')
  const [seed, setSeed] = useState(() => Math.random())
  const [query, setQuery] = useState('')
  const [ingredients, setIngredients] = useState('')

  const candidates = useMemo(
    () => (recipes ?? []).filter((r) => matchesCondition(r, condition)),
    [recipes, condition],
  )
  const suggestion =
    candidates.length > 0
      ? candidates[Math.floor(seed * candidates.length) % candidates.length]
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
    if (!ingredients.trim()) return
    navigate(`/recipes?ing=${encodeURIComponent(ingredients.trim())}`)
  }

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.app.name}</h1>

      {/* 今日なに作る？ */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
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
            </div>

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

      {/* 検索バー */}
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

      {/* 使いたい食材から探す */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <Carrot size={20} className="text-accent" aria-hidden />
          {ja.home.ingShortcutTitle}
        </h2>
        <form
          className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]"
          onSubmit={(e) => {
            e.preventDefault()
            submitIngredients()
          }}
        >
          <input
            type="text"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            placeholder={ja.home.ingPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
          />
          <button
            type="submit"
            className="shrink-0 rounded-sm border border-edge bg-surface px-3 text-sm font-bold text-accent shadow-sm"
          >
            {ja.home.ingButton}
          </button>
        </form>
      </section>

      {/* 最近作ったもの */}
      {history.length > 0 && (
        <section className="mt-[var(--space-md)]">
          <h2 className="flex items-center gap-2 font-bold">
            <History size={20} className="text-accent" aria-hidden />
            {ja.home.historyTitle}
          </h2>
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
      )}
    </div>
  )
}
