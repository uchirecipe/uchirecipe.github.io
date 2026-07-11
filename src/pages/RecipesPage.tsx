import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, SlidersHorizontal, Refrigerator } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { usePantryItems } from '../db/pantry'
import { useTodayList } from '../db/todayList'
import { pantryAvailableNames } from '../logic/pantry'
import {
  searchRecipes,
  type EffortFilter,
  type TagFilter,
  type TimeFilter,
} from '../logic/search'
import { sortResults, type RecipeSortOption } from '../logic/recipeSort'
import { countFreeLimitRecipes, isNearFreeLimit, FREE_LIMIT } from '../logic/freeLimit'
import { splitValues } from '../logic/textSplit'
import RecipeCard from '../components/RecipeCard'
import ChipInput from '../components/ChipInput'
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

/**
 * よく使う用途タグの絞り込み。タグは自由入力だが、ここでは既存レシピで使用実績のある少数だけをチップ化する。
 * 「時短」タグは調理時間の絞り込みと役割が重なり内容も薄くなるため廃止した（2026-07-05）
 */
const tagOptions: { value: TagFilter; label: string }[] = [
  { value: 'all', label: ja.search.tagAll },
  { value: '作り置き', label: '作り置き' },
  { value: 'お弁当', label: 'お弁当' },
]

const sortOptions: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
]

const chipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
    active ? 'border-accent bg-accent text-app' : 'border-edge bg-surface text-ink-muted'
  }`

/**
 * 一覧のスクロール位置の保存・復元用キー（sessionStorage）。
 * 検索・絞り込み条件（filtersKey）ごと保存し、詳細から戻ってきたとき条件が
 * 変わっていない場合だけ復元する（2026-07-11 オーナー実機フィードバック）。
 */
const RECIPES_SCROLL_KEY = 'uchirecipe:recipesScroll'

/** レシピ一覧: 検索・フィルタ＋写真カードのグリッド＋右下の「＋」ボタン */
export default function RecipesPage() {
  // ホーム画面から ?q=... / ?ing=... 付きで来たときは、その条件で開く
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [ingredients, setIngredients] = useState<string[]>(() =>
    splitValues(searchParams.get('ing') ?? ''),
  )
  const [panelOpen, setPanelOpen] = useState(searchParams.get('ing') !== null)

  // 検索中の内容をURLにも反映しておく。こうすると、タイマー等で別レシピに
  // 移動した後に「戻る」で帰ってきたとき、検索していた内容がそのまま復元される
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (query.trim()) next.set('q', query)
        else next.delete('q')
        if (ingredients.length > 0) next.set('ing', ingredients.join(' '))
        else next.delete('ing')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ingredients])
  const [time, setTime] = useState<TimeFilter>('all')
  const [effort, setEffort] = useState<EffortFilter>('all')
  const [tag, setTag] = useState<TagFilter>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [excludeNg, setExcludeNg] = useState(false)
  const [quickOnly, setQuickOnly] = useState(false)
  const [sort, setSort] = useState<RecipeSortOption>('updated')

  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const ngIngredients = settings?.ngIngredients
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  const todayList = useTodayList()
  const todayRecipeIds = useMemo(
    () => new Set(todayList?.map((item) => item.recipeId) ?? []),
    [todayList],
  )

  const hideStarters = settings?.hideStarters ?? false

  const results = useMemo(() => {
    if (!recipes) return undefined
    // 「基本レシピを表示しない」設定を反映してから検索する
    const visible = hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
    const found = searchRecipes(visible, {
      query,
      ingredients: ingredients.join(' '),
      time,
      effort,
      tag,
      favoriteOnly,
      excludeNg,
      quickOnly,
      ngIngredients: ngIngredients ?? [],
    })
    return sortResults(found, sort, pantryNames)
  }, [
    recipes,
    hideStarters,
    query,
    ingredients,
    time,
    effort,
    tag,
    favoriteOnly,
    excludeNg,
    quickOnly,
    ngIngredients,
    sort,
    pantryNames,
  ])

  const filtersActive =
    query !== '' ||
    ingredients.length > 0 ||
    time !== 'all' ||
    effort !== 'all' ||
    tag !== 'all' ||
    favoriteOnly ||
    excludeNg ||
    quickOnly ||
    sort !== 'updated'

  // 一覧のスクロール位置の保存・復元(検索・絞り込み条件が変わっていないときだけ復元する)。
  // 条件が変わっていれば復元しない(=先頭表示のまま)ことで、詳細=常に先頭/一覧=復元、を両立する
  const filtersKey = useMemo(
    () => JSON.stringify({ query, ingredients, time, effort, tag, favoriteOnly, excludeNg, quickOnly, sort }),
    [query, ingredients, time, effort, tag, favoriteOnly, excludeNg, quickOnly, sort],
  )
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (!results) return // 結果がまだ描画されていない間は復元しない(高さ不足でクランプされるため)
    restoredRef.current = true
    const raw = sessionStorage.getItem(RECIPES_SCROLL_KEY)
    if (!raw) return
    try {
      const saved = JSON.parse(raw) as { filtersKey: string; y: number }
      if (saved.filtersKey === filtersKey) window.scrollTo(0, saved.y)
    } catch {
      // 壊れた保存値は無視
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results])
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        sessionStorage.setItem(RECIPES_SCROLL_KEY, JSON.stringify({ filtersKey, y: window.scrollY }))
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [filtersKey])

  const clearFilters = () => {
    setQuery('')
    setIngredients([])
    setTime('all')
    setEffort('all')
    setTag('all')
    setFavoriteOnly(false)
    setExcludeNg(false)
    setQuickOnly(false)
    setSort('updated')
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

      {recipes && isNearFreeLimit(countFreeLimitRecipes(recipes), !!settings?.proCode) && (
        <p className="mt-[var(--space-sm)] rounded-sm bg-surface px-3 py-2 text-sm text-ink-muted">
          {ja.recipes.freeLimitNearBanner.replace(
            '{n}',
            String(FREE_LIMIT - countFreeLimitRecipes(recipes)),
          )}
        </p>
      )}

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
          {/* 並べ替え */}
          <p className="text-sm font-bold text-ink-muted">{ja.search.sortTitle}</p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            {sortOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSort(option.value)}
                className={chipCls(sort === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* 使いたい食材 */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.ingredientTitle}
          </p>
          <div className="mt-1">
            <ChipInput
              values={ingredients}
              onChange={setIngredients}
              placeholder={ja.search.ingredientPlaceholder}
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
          </div>

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
            {/* 時短版の手順(quickSteps)があるレシピだけに絞る。有効な間は一覧カードの
                調理時間表示もquickCookMinutesに切り替わる(2026-07-11 オーナー実機フィードバック) */}
            <button
              type="button"
              onClick={() => setQuickOnly((v) => !v)}
              className={chipCls(quickOnly)}
            >
              {ja.search.quickOnly}
            </button>
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

          {/* よく使うタグ */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.tagTitle}
          </p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            {tagOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTag(option.value)}
                className={chipCls(tag === option.value)}
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
            <button
              type="button"
              onClick={() => updateSettings({ hideStarters: !hideStarters })}
              className={chipCls(hideStarters)}
            >
              {ja.search.myRecipesOnly}
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

          {/* 条件は開いた瞬間から即時反映されるので、このボタンは閉じるだけ */}
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-app shadow-sm"
          >
            {ja.search.apply}
          </button>
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
            <>
              <p className="font-bold">{ja.search.noResult}</p>
              <p className="mt-1 text-sm">{ja.search.noResultHint}</p>
              {/* 配布テーマへの控えめな発見導線（探し物が無かった人に別の入り口を示す） */}
              <Link
                to="/settings?section=themes"
                className="mt-2 inline-block text-sm font-bold text-accent underline"
              >
                {ja.recipes.themeShortcut}
              </Link>
            </>
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
            inTodayList={todayRecipeIds.has(recipe.id!)}
            showQuickTime={quickOnly}
          />
        ))}
      </div>

      {/* 一覧最下部の控えめな発見導線（設定のテーマ一覧へ） */}
      {results && results.length > 0 && (
        <Link
          to="/settings?section=themes"
          className="mt-[var(--space-lg)] block text-center text-sm font-bold text-accent underline"
        >
          {ja.recipes.themeShortcut}
        </Link>
      )}

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
