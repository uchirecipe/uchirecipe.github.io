import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  SlidersHorizontal,
  Refrigerator,
  LayoutGrid,
  List,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import type { RecipeListLayout } from '../db/types'
import { usePantryItems } from '../db/pantry'
import { useTodayList } from '../db/todayList'
import { pantryAvailableNames } from '../logic/pantry'
import {
  searchRecipes,
  type EffortFilter,
  type TagFilter,
  type TimeFilter,
} from '../logic/search'
import {
  sortResults,
  defaultSortDirection,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
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
 * 一覧の状態（検索・絞り込み・並べ替え・スクロール位置）の保存・復元用キー（sessionStorage）。
 *
 * 【2026-07-12 深夜フィードバックの再調査で原因判明・再設計】
 * 前回(77a473d)はスクロール位置(y)と、それが有効かどうかを判定するfiltersKeyだけを保存していた。
 * しかし詳細の「戻る」は常に素の "/recipes"（クエリ文字列なし）へ新規pushする実装
 * （BackHeaderのalwaysFallback。2026-07-10オーナー指示「常に一覧へ」）のため、RecipesPageは
 * 毎回まっさらな初期状態（query=''・sort='updated'等すべて既定値）で再マウントされていた。
 * 検索語や並べ替えなど何か1つでも条件を変えていた場合、離脱時に保存したfiltersKeyと
 * 復元時（既定値に戻った状態）のfiltersKeyが一致しなくなり、「条件が変わった＝先頭表示」という
 * “想定どおりの安全装置” が働いて復元が黙ってスキップされていた。スクロールだけでなく検索条件
 * ごと消えていたのが正体で、時間経過そのものは無関係（詳細で0秒待っても再現した）。
 * オーナーが「長く滞在すると起きる」と感じたのは、絞り込んで探すほど長時間読む対象に
 * たどり着きやすい、という行動側の相関だったと考えられる（PC Chromeでも同様に再現した）。
 *
 * 対策: スクロール位置だけでなく検索語・絞り込み・並べ替えの全項目をこのキーに保存し、
 * URLにクエリが無い「素の /recipes」で開いたとき（＝詳細から戻ってきた・タブバーで戻ってきた
 * 等、明示的な新規検索ではない場合）はここから初期状態を復元する。検索語・使いたい食材は
 * 従来どおりURLの ?q= / ?ing= が指定されていればそちらを優先する（ホームの検索・食材リンク等、
 * 意図的な新規検索は先頭表示のまま、という既存の使用感を維持するため）。
 */
const RECIPES_LIST_STATE_KEY = 'uchirecipe:recipesListState'

type SavedListState = {
  filtersKey: string
  y: number
  query: string
  ingredients: string[]
  time: TimeFilter
  effort: EffortFilter
  tag: TagFilter
  favoriteOnly: boolean
  excludeNg: boolean
  quickOnly: boolean
  sort: RecipeSortOption
  /** 並べ替えの昇順/降順（2026-07-13 UI改善。旧セッションの保存値には無いので任意項目） */
  sortDirection?: SortDirection
}

function readSavedListState(): SavedListState | null {
  const raw = sessionStorage.getItem(RECIPES_LIST_STATE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SavedListState
  } catch {
    return null // 壊れた保存値は無視
  }
}

/** レシピ一覧: 検索・フィルタ＋写真カードのグリッド＋右下の「＋」ボタン */
export default function RecipesPage() {
  // ホーム画面から ?q=... / ?ing=... 付きで来たときは、その条件で開く。
  // どちらも無ければ（詳細から戻ってきた等の「素の /recipes」）sessionStorageの保存値から復元する
  const [searchParams, setSearchParams] = useSearchParams()
  const [saved] = useState(() => readSavedListState())
  const [query, setQuery] = useState(() => searchParams.get('q') ?? saved?.query ?? '')
  const [ingredients, setIngredients] = useState<string[]>(() => {
    const ingParam = searchParams.get('ing')
    if (ingParam !== null) return splitValues(ingParam)
    return saved?.ingredients ?? []
  })
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
  const [time, setTime] = useState<TimeFilter>(saved?.time ?? 'all')
  const [effort, setEffort] = useState<EffortFilter>(saved?.effort ?? 'all')
  const [tag, setTag] = useState<TagFilter>(saved?.tag ?? 'all')
  const [favoriteOnly, setFavoriteOnly] = useState(saved?.favoriteOnly ?? false)
  const [excludeNg, setExcludeNg] = useState(saved?.excludeNg ?? false)
  const [quickOnly, setQuickOnly] = useState(saved?.quickOnly ?? false)
  const [sort, setSort] = useState<RecipeSortOption>(saved?.sort ?? 'updated')
  // 並べ替えの昇順/降順(2026-07-13 UI改善)。並べ替えの種類自体を変えたときは
  // その種類の既定方向にリセットする(選ぶ側のonClickで一緒にsetする。下記sortOptions参照)
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    saved?.sortDirection ?? defaultSortDirection[saved?.sort ?? 'updated'],
  )

  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const ngIngredients = settings?.ngIngredients
  // 一覧の表示形式(グリッド/リスト。2026-07-13 UI改善)。設定に保存し再訪でも維持する
  const recipeListLayout: RecipeListLayout = settings?.recipeListLayout ?? 'grid'
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  const todayList = useTodayList()
  const todayRecipeIds = useMemo(
    () => new Set(todayList?.map((item) => item.recipeId) ?? []),
    [todayList],
  )

  const hideStarters = settings?.hideStarters ?? false

  // 絞り込み無しでも常に見える総件数(2026-07-13 UI改善)。「基本レシピを表示しない」設定は
  // 一覧の表示そのものに反映される設定なのでここにも反映し、検索語等の絞り込みは反映しない
  const totalCount = useMemo(() => {
    if (!recipes) return undefined
    return hideStarters ? recipes.filter((r) => !r.isStarter).length : recipes.length
  }, [recipes, hideStarters])

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
    return sortResults(found, sort, pantryNames, sortDirection)
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
    sortDirection,
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
    sort !== 'updated' ||
    sortDirection !== defaultSortDirection[sort]

  // 一覧の状態（検索語・絞り込み・並べ替え・スクロール位置）の保存・復元。
  // filtersKeyは「保存時と復元時で条件一式が一致しているか」の判定にのみ使う
  // （URLにq/ingが明示されていて上のsavedを上書きした場合はここで不一致になり、
  // 復元しない＝先頭表示のまま、という新規検索時の挙動を維持する）
  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        query,
        ingredients,
        time,
        effort,
        tag,
        favoriteOnly,
        excludeNg,
        quickOnly,
        sort,
        sortDirection,
      }),
    [query, ingredients, time, effort, tag, favoriteOnly, excludeNg, quickOnly, sort, sortDirection],
  )
  const restoredRef = useRef(false)
  useEffect(() => {
    if (restoredRef.current) return
    if (!results) return // クエリ未解決の間は待つ
    // レシピ一覧はDexieからの非同期ロードのため、初回起動直後(基本レシピのシード完了前)は
    // recipesが一瞬「空配列」で解決することがある。この空の状態で復元すると、
    // まだ縦に何も無く高さが足りないためscrollToがクランプされ0に固定されてしまう
    // (iPhone SE2実機で再現。2026-07-11オーナー実機フィードバック)。
    // recipes(絞り込み前の生データ。基本レシピが必ず含まれるため通常0件にはならない)が
    // 実際に読み込まれる(非空になる)まで復元を待つ
    if (!recipes || recipes.length === 0) return
    restoredRef.current = true
    if (!saved) return
    if (saved.filtersKey !== filtersKey) return
    // データが読み込まれた直後でも、カード画像等のレイアウト確定が1フレーム遅れることがあるため、
    // 描画・レイアウトの反映を2フレーム分待ってからスクロールする(iPhone実機で有効だった対策)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.y)
      })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, recipes])
  // カードタップ等で詳細へ遷移する瞬間、ページの中身が一覧から詳細へ切り替わって縦の高さが縮むと、
  // ブラウザがwindow.scrollYを0付近に強制的にクランプし、その結果として非同期に発火する
  // scrollイベントを(unmount途中でまだ生きている、またはReactのeffectクリーンアップと
  // 競合して間に合わない)このページのscrollリスナーが拾って「0」を保存してしまう
  // (iPhone実機で復元されなかった本当の原因。2026-07-11)。
  // leavingRef はナビゲーション用リンクをタップした瞬間(クリックのcaptureフェーズ=
  // 遷移が始まる前)にtrueにし、以降のscroll保存を(クリーンアップのタイミングに関わらず)
  // 確実にブロックすることで、上書きされる隙を無くす
  const leavingRef = useRef(false)
  const saveListState = (y: number) => {
    if (leavingRef.current) return
    const blob: SavedListState = {
      filtersKey,
      y,
      query,
      ingredients,
      time,
      effort,
      tag,
      favoriteOnly,
      excludeNg,
      quickOnly,
      sort,
      sortDirection,
    }
    sessionStorage.setItem(RECIPES_LIST_STATE_KEY, JSON.stringify(blob))
  }
  // 検索語・絞り込み・並べ替えのいずれかを変えたら、その場でも保存する(スクロールしなくても
  // 条件だけ変えて詳細を経由せずタブを行き来した場合にも復元できるようにするため)。
  // マウント直後の1回目は「何も変えていない」ので保存をスキップする
  // (復元前にy=0で上書きしてしまわないようにするため。復元自体はsavedの凍結値を使うので
  // 実害は無いが、紛らわしい中間状態を作らないための予防)
  const filtersMountedRef = useRef(false)
  useEffect(() => {
    if (!filtersMountedRef.current) {
      filtersMountedRef.current = true
      return
    }
    saveListState(window.scrollY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])
  useEffect(() => {
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        saveListState(window.scrollY)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [filtersKey])
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!(e.target instanceof Element) || !e.target.closest('a')) return // リンク以外の操作では固定しない
    saveListState(window.scrollY) // 遷移で高さが縮む前の、正しい位置を確定保存する
    leavingRef.current = true
  }

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
    setSortDirection(defaultSortDirection.updated)
  }

  const subLabelFor = (usedCount: number, wantedCount: number) => {
    if (wantedCount === 0) return undefined
    if (usedCount === wantedCount) return ja.search.usedAll
    return ja.search.usedSome
      .replace('{m}', String(usedCount))
      .replace('{t}', String(wantedCount))
  }

  return (
    <div
      className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]"
      onClickCapture={onClickCapture}
    >
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
        {/* 一覧の表示形式(グリッド/リスト)切替。押すたびに逆の表示へ切り替わる(2026-07-13 UI改善) */}
        <button
          type="button"
          onClick={() =>
            updateSettings({ recipeListLayout: recipeListLayout === 'grid' ? 'list' : 'grid' })
          }
          aria-label={
            recipeListLayout === 'grid' ? ja.search.layoutToggleToList : ja.search.layoutToggleToGrid
          }
          className="flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border border-edge bg-surface text-ink-muted shadow-sm"
        >
          {recipeListLayout === 'grid' ? (
            <List size={22} aria-hidden />
          ) : (
            <LayoutGrid size={22} aria-hidden />
          )}
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
                onClick={() => {
                  setSort(option.value)
                  // 並べ替えの種類を変えたら、その種類の既定方向に戻す(2026-07-13 UI改善。
                  // 例: 「あいうえお順」は常にあ→んから始まる、というこれまでの見え方を保つ)
                  setSortDirection(defaultSortDirection[option.value])
                }}
                className={chipCls(sort === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* 昇順/降順トグル(2026-07-13 UI改善) */}
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setSortDirection('asc')}
              className={chipCls(sortDirection === 'asc')}
            >
              <ArrowUpNarrowWide size={14} className="-mt-0.5 mr-1 inline" aria-hidden />
              {ja.search.sortAsc}
            </button>
            <button
              type="button"
              onClick={() => setSortDirection('desc')}
              className={chipCls(sortDirection === 'desc')}
            >
              <ArrowDownWideNarrow size={14} className="-mt-0.5 mr-1 inline" aria-hidden />
              {ja.search.sortDesc}
            </button>
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

      {/* 件数: 絞り込み無しでも総件数を常に表示する(2026-07-13 UI改善)。絞り込み中は
          既存の結果件数表示を維持しつつ「◯件 / 全◯件」の形にまとめる */}
      {results && totalCount !== undefined && (
        <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
          {filtersActive
            ? ja.search.resultCountWithTotal
                .replace('{n}', String(results.length))
                .replace('{t}', String(totalCount))
            : ja.search.totalCount.replace('{n}', String(totalCount))}
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

      {/* カードのグリッド／リスト(2026-07-13 UI改善: 表示形式トグルで切替) */}
      <div
        className={
          recipeListLayout === 'list'
            ? 'mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]'
            : 'mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)]'
        }
      >
        {results?.map(({ recipe, usedCount, wantedCount }) => (
          <RecipeCard
            key={recipe.id}
            recipe={recipe}
            layout={recipeListLayout}
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
