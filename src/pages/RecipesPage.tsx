import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  Refrigerator,
  LayoutGrid,
  List,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  SquareCheck,
  Square,
  Lock,
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
  buildNutrientSortValues,
  isNutrientSortOption,
  NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_FIELD,
  type NutrientSortOption,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
import { isNutritionUnlocked, roundNutrient } from '../logic/nutrition'
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

const baseSortOptions: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
  // テーマごと(2026-07-17オーナー指示で追加)
  { value: 'theme', label: ja.search.sortTheme },
]

/** 栄養並び替え5項目のラベル（2026-07-16 便T-4: カロリー・たんぱく質・塩分・脂質・糖質。Pro機能） */
const nutrientSortLabels: Record<NutrientSortOption, string> = {
  kcal: ja.search.sortKcal,
  protein: ja.search.sortProtein,
  salt: ja.search.sortSalt,
  fat: ja.search.sortFat,
  carb: ja.search.sortCarb,
}
const nutrientSortOptions: { value: RecipeSortOption; label: string }[] = NUTRIENT_SORT_OPTIONS.map(
  (value) => ({ value, label: nutrientSortLabels[value] }),
)

const chipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

// 昇順/降順トグル用(2026-07-16 UI総点検B-7: パネルの外・件数表記の横に常設するため、
// 通常のchipClsより一回り小さいサイズにする)
const dirChipCls = (active: boolean) =>
  `inline-flex shrink-0 items-center rounded-sm border px-2 py-1.5 text-xs font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

/**
 * 並べ替え・調理時間・手間レベルの単一選択UI(2026-07-16 UI総点検B-7オーナー個別指示)。
 * 従来はチップ/ボタン並びだったが、選択中の項目が一目で分かる☑付き縦リストに変更する
 * (radioの見た目を☑にするだけで、複数選択にはしない。AskUserで確認済み)。
 * 選択中の行はアクセント背景+白文字(bg-accent text-on-accent。2026-07-16 便T-6オーナー指示。
 * 行の背景が角からはみ出さないようコンテナにoverflow-hiddenを併せて付ける)
 */
function CheckList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { value: T; label: string }[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <div className="mt-1 divide-y divide-edge overflow-hidden rounded-md border border-edge bg-app">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold ${
              selected ? 'bg-accent text-on-accent' : 'text-ink-muted'
            }`}
          >
            {selected ? (
              <SquareCheck size={18} className="shrink-0" aria-hidden />
            ) : (
              <Square size={18} className="shrink-0 opacity-40" aria-hidden />
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

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
  // 並び替え/絞り込みパネル(2026-07-16 便T: 従来は1つのpanelOpenで両方を出し分けていたが、
  // ボタンを分離したのに合わせて開閉状態も分離する。片方を開くともう片方は閉じる(同時に出さない)
  const [filterPanelOpen, setFilterPanelOpen] = useState(searchParams.get('ing') !== null)
  const [sortPanelOpen, setSortPanelOpen] = useState(false)
  const toggleFilterPanel = () => {
    setFilterPanelOpen((open) => !open)
    setSortPanelOpen(false)
  }
  const toggleSortPanel = () => {
    setSortPanelOpen((open) => !open)
    setFilterPanelOpen(false)
  }

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
  // その種類の既定方向にリセットする(選ぶ側のonClickで一緒にsetする。下記baseSortOptions/
  // nutrientSortOptions参照)
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

  // 栄養並び替え(2026-07-13 Fable設計→2026-07-16 便T-4でカロリー・たんぱく質・塩分・脂質・糖質の
  // 5項目まとめてPro機能化。従来は無料でもカロリー順だけ選べたが、オーナー指示によりPro専用に変更した
  // (アプリ未公開・実ユーザー0のため既存無料機能の有料化には当たらない)
  const nutritionUnlocked = isNutritionUnlocked(!!settings?.proCode)

  // 栄養並び替え用の値(1食あたり)。計算が重いので栄養並び替えを選んでいる間だけ、
  // 全レシピ分をまとめて1回計算する(毎レンダー再計算しない)
  const nutrientSortActive = isNutrientSortOption(sort)
  const nutrientSortValues = useMemo(() => {
    if (!recipes || !nutrientSortActive) return undefined
    return buildNutrientSortValues(recipes)
  }, [recipes, nutrientSortActive])

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
    return sortResults(found, sort, pantryNames, sortDirection, nutrientSortValues)
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
    nutrientSortValues,
  ])

  // 2026-07-16 便T-1: 並び替え/絞り込みがボタンごと分かれたのに合わせて、それぞれのボタンの
  // アクティブ表示・「条件をクリア」表示も分けて判定する
  const filterActive =
    query !== '' ||
    ingredients.length > 0 ||
    time !== 'all' ||
    effort !== 'all' ||
    tag !== 'all' ||
    favoriteOnly ||
    excludeNg ||
    quickOnly
  const sortActive = sort !== 'updated' || sortDirection !== defaultSortDirection[sort]
  const anyConditionActive = filterActive || sortActive

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

  /**
   * 栄養価順のとき、カードに表示する「並び替えに使っている栄養価の値」(便T-7)。
   * カロリー順→「◯kcal」、たんぱく質・塩分・脂質・糖質順→「◯g」。算出不能(null)なレシピは
   * 表示しない(undefinedを返し、RecipeCard側でバッジ自体を出さない)。Pro機能なので
   * nutritionUnlocked(=Pro解錠済み)のときだけ計算する。
   * 2026-07-16オーナー指示: 「たんぱく質: 24g」のように並び替え項目のラベルを値の前に付ける
   * (ラベルはnutrientSortLabels=並び替えパネルの項目名と同じものを流用する)
   */
  const nutrientBadgeTextFor = (recipeId: number | undefined): string | undefined => {
    if (!nutritionUnlocked || !nutrientSortActive || !isNutrientSortOption(sort)) return undefined
    if (recipeId === undefined) return undefined
    const field = NUTRIENT_SORT_FIELD[sort]
    const raw = nutrientSortValues?.get(recipeId)?.[field]
    if (raw == null) return undefined
    const rounded = roundNutrient(field, raw)
    const value =
      field === 'kcal' ? `${rounded}${ja.nutrition.kcalUnit}` : `${rounded}${ja.nutrition.gramUnit}`
    return `${nutrientSortLabels[sort]}${ja.card.nutrientBadgeSeparator}${value}`
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

      {/* 検索バー＋並び替え/絞り込みボタン(2026-07-16 便T-1: 従来は絞り込みボタン1つに両方の
          パネルが入っていたが、別ボタンに分離した。列表示切替は件数表記の横へ移動(下記参照)) */}
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
          onClick={toggleSortPanel}
          aria-expanded={sortPanelOpen}
          aria-label={ja.search.sortToggle}
          className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
            sortPanelOpen || sortActive
              ? 'border-accent text-accent'
              : 'border-edge text-ink-muted'
          }`}
        >
          <ArrowDownUp size={22} aria-hidden />
        </button>
        <button
          type="button"
          onClick={toggleFilterPanel}
          aria-expanded={filterPanelOpen}
          aria-label={ja.search.filterToggle}
          className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
            filterPanelOpen || filterActive
              ? 'border-accent text-accent'
              : 'border-edge text-ink-muted'
          }`}
        >
          <SlidersHorizontal size={22} aria-hidden />
        </button>
      </div>

      {/* 並び替えパネル(2026-07-16 便T-1で絞り込みパネルから分離) */}
      {sortPanelOpen && (
        <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <p className="text-sm font-bold text-ink-muted">{ja.search.sortTitle}</p>
          <CheckList
            options={baseSortOptions}
            value={sort}
            onSelect={(next) => {
              setSort(next)
              // 並べ替えの種類を変えたら、その種類の既定方向に戻す(2026-07-13 UI改善。
              // 例: 「五十音順」は常にあ→んから始まる、というこれまでの見え方を保つ)
              setSortDirection(defaultSortDirection[next])
            }}
          />

          {/* 栄養価並び替え(便T-4: カロリー・たんぱく質・塩分・脂質・糖質の5項目をPro機能化。
              無料版はグレーのティーザー行のみ・タップで既存のProゲート表現(Lock+ミュート色)でPro案内へ) */}
          {nutritionUnlocked ? (
            <>
              <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                {ja.search.sortNutritionTitle}
              </p>
              <CheckList
                options={nutrientSortOptions}
                value={sort}
                onSelect={(next) => {
                  setSort(next)
                  setSortDirection(defaultSortDirection[next])
                }}
              />
            </>
          ) : (
            <Link
              to="/settings?section=pro"
              className="mt-[var(--space-md)] flex w-full items-center gap-2 rounded-md border border-edge bg-app px-3 py-2.5 text-left text-sm font-bold text-ink-muted opacity-60"
            >
              <Lock size={16} className="shrink-0" aria-hidden />
              {ja.search.sortNutritionGate}
            </Link>
          )}

          {/* 条件は開いた瞬間から即時反映されるので、このボタンは閉じるだけ */}
          <button
            type="button"
            onClick={() => setSortPanelOpen(false)}
            className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            {ja.search.apply}
          </button>
        </div>
      )}

      {/* 絞り込みパネル(2026-07-16 便T-3: 「条件をクリア」を欄の上方に移動) */}
      {filterPanelOpen && (
        <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          {anyConditionActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-bold text-accent underline"
            >
              {ja.search.clear}
            </button>
          )}

          {/* 使いたい食材 */}
          <p
            className={`text-sm font-bold text-ink-muted ${anyConditionActive ? 'mt-[var(--space-md)]' : ''}`}
          >
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

          {/* 調理時間(2026-07-16 UI総点検B-7: ☑付き単一選択リストに変更) */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.timeTitle}
          </p>
          <CheckList options={timeOptions} value={time} onSelect={setTime} />
          {/* 時短版の手順(quickSteps)があるレシピだけに絞る独立トグル。単一選択の並べ替え・時間・
              手間とは別枠のON/OFFなのでチップのまま維持する。有効な間は一覧カードの調理時間表示も
              quickCookMinutesに切り替わる(2026-07-11 オーナー実機フィードバック) */}
          <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setQuickOnly((v) => !v)}
              className={chipCls(quickOnly)}
            >
              {ja.search.quickOnly}
            </button>
          </div>

          {/* 手間レベル(2026-07-16 UI総点検B-7: ☑付き単一選択リストに変更) */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.effortTitle}
          </p>
          <CheckList options={effortOptions} value={effort} onSelect={setEffort} />

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

          {/* 条件は開いた瞬間から即時反映されるので、このボタンは閉じるだけ */}
          <button
            type="button"
            onClick={() => setFilterPanelOpen(false)}
            className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            {ja.search.apply}
          </button>
        </div>
      )}

      {/* 件数: 絞り込み無しでも総件数を常に表示する(2026-07-13 UI改善)。絞り込み中は
          既存の結果件数表示を維持しつつ「◯件 / 全◯件」の形にまとめる(件数が変わるのは絞り込みのみ・
          並べ替えでは変わらないのでfilterActiveで判定する)。
          昇順/降順トグルは2026-07-16 UI総点検B-7オーナー個別指示によりパネルの外・この件数表記の
          横に常設する(従来はパネル内にあった)。列表示切替(グリッド/一覧)も便T-2で同じ行に移動した:
          全◯件 | 昇順/降順 | 列切替 の並び */}
      {results && totalCount !== undefined && (
        <div className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-ink-muted">
            {filterActive
              ? ja.search.resultCountWithTotal
                  .replace('{n}', String(results.length))
                  .replace('{t}', String(totalCount))
              : ja.search.totalCount.replace('{n}', String(totalCount))}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => setSortDirection('asc')}
              className={dirChipCls(sortDirection === 'asc')}
            >
              <ArrowUpNarrowWide size={14} className="-mt-0.5 mr-1 inline" aria-hidden />
              {ja.search.sortAsc}
            </button>
            <button
              type="button"
              onClick={() => setSortDirection('desc')}
              className={dirChipCls(sortDirection === 'desc')}
            >
              <ArrowDownWideNarrow size={14} className="-mt-0.5 mr-1 inline" aria-hidden />
              {ja.search.sortDesc}
            </button>
            {/* 一覧の表示形式(グリッド/リスト)切替。押すたびに逆の表示へ切り替わる(2026-07-13 UI改善。
                2026-07-16 便T-2でヘッダーからこの常設列へ移動) */}
            <button
              type="button"
              onClick={() =>
                updateSettings({ recipeListLayout: recipeListLayout === 'grid' ? 'list' : 'grid' })
              }
              aria-label={
                recipeListLayout === 'grid' ? ja.search.layoutToggleToList : ja.search.layoutToggleToGrid
              }
              className="inline-flex shrink-0 items-center justify-center rounded-sm border border-edge bg-surface px-2 py-1.5 text-ink-muted"
            >
              {recipeListLayout === 'grid' ? (
                <List size={14} aria-hidden />
              ) : (
                <LayoutGrid size={14} aria-hidden />
              )}
            </button>
          </div>
        </div>
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
            nutrientBadgeText={nutrientBadgeTextFor(recipe.id)}
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
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-md"
      >
        <Plus size={30} aria-hidden />
      </Link>
    </div>
  )
}
