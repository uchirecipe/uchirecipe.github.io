import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Search,
  SlidersHorizontal,
  ArrowDownUp,
  ArrowRight,
  Refrigerator,
  LayoutGrid,
  List,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  SquareCheck,
  Square,
  Lock,
  ListChecks,
  CheckCircle2,
  CalendarPlus,
  Download,
  Trash2,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, deleteRecipes, countRecipesDeleteImpact } from '../db/recipes'
import { buildBulkDeleteConfirm } from '../logic/recipeDelete'
import { useSelectedRecipesExport } from '../components/useSelectedRecipesExport'
import ChoiceDialog from '../components/ChoiceDialog'
import { useSettings, updateSettings } from '../db/settings'
import { addRecipesToToday } from '../db/mealPlan'
import { todayString } from '../logic/date'
import TodaySlotModal from '../components/TodaySlotModal'
import type { MealSlot, RecipeListLayout } from '../db/types'
import { densityForListLayout } from '../logic/cardDensity'
import { usePantryItems } from '../db/pantry'
import { useTodayList } from '../db/todayList'
import { pantryAvailableNames } from '../logic/pantry'
import {
  searchRecipes,
  tagUsageCounts,
  type DishTypeFilter,
  type EffortFilter,
  type TagFilter,
  type TimeFilter,
} from '../logic/search'
import { DISH_TYPE_OPTIONS } from '../logic/homeSuggest'
import {
  sortResults,
  defaultSortDirection,
  buildNutrientSortValues,
  isNutrientSortOption,
  isFreeSortOption,
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_FIELD,
  type NutrientSortOption,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
import { isNutritionUnlocked, roundNutrient } from '../logic/nutrition'
import {
  countFreeLimitRecipes,
  freeLimitNoticeFor,
  freeLimitRemaining,
  FREE_LIMIT,
  FREE_LIMIT_ENABLED,
} from '../logic/freeLimit'
import { splitValues } from '../logic/textSplit'
import Collapse from '../components/Collapse'
import RecipeCard from '../components/RecipeCard'
import ChipInput from '../components/ChipInput'
import Toast from '../components/Toast'
import { useConfirm } from '../components/ConfirmProvider'
import { settingsLinkWithBack } from '../logic/backLink'
import { ja } from '../i18n/ja'

/**
 * 長押しで選択モードに入るまでの時間（ミリ秒）。
 * 料理中に片手で触る画面なので、スクロールの押し始めと区別できるだけの長さを取る
 * （短すぎるとスクロール開始が選択に化ける）。指が動いたら長押しは取り消す
 */
const LONG_PRESS_MS = 550
/** 長押し判定を取り消す指の移動量（px） */
const LONG_PRESS_MOVE_TOLERANCE = 10

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
 * 料理の種別の絞り込み（2026-08-10 便FF・オーナー要望「主菜副菜などでも絞り込みしたい」）。
 * 区分と並びはレシピ登録の「料理の種別」・献立の「今日なに作る？」と同じ4つを使う
 * （logic/homeSuggest.ts DISH_TYPE_OPTIONS）。4区分は互いに重ならず、合わせると全レシピを覆う
 */
const dishTypeOptions: { value: DishTypeFilter; label: string }[] = [
  { value: 'all', label: ja.search.dishTypeAll },
  ...DISH_TYPE_OPTIONS.map((value) => ({
    value: value as DishTypeFilter,
    label: ja.dishType[value],
  })),
]

/**
 * タグのチップに出す最大件数（「すべて」は別枠）。
 * 2026-08-10 便FF: チップに件数を併記した分だけ1つが横に広がるので8→6に減らし、
 * スマホ縦画面（390px）で2行に収まる範囲を保つ
 */
const TAG_CHIP_LIMIT = 6

const baseSortOptions: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
  // 最近作った順(2026-08-03 オーナー指示)。回数で数える「よく使う順」の隣に置く
  { value: 'recentCooked', label: ja.search.sortRecentCooked },
  // 「基本レシピ順」は2026-07-24 便BN・タスク4で廃止(配布テーマ全廃で無意味化)
]

/** 栄養並び替え5項目のラベル（2026-07-16 便T-4: カロリー・たんぱく質・塩分・脂質・糖質） */
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
/** 無料版で選べる栄養並び替え（2026-08-01 線引きB': カロリー順のみ） */
const freeNutrientSortOptions: { value: RecipeSortOption; label: string }[] =
  FREE_NUTRIENT_SORT_OPTIONS.map((value) => ({ value, label: nutrientSortLabels[value] }))

/**
 * 並び替え／絞り込みパネルの箱（2026-08-10 便FF）。
 *
 * 一覧の上に重ねて出すので、
 *  - pointer-events-auto: 親の入れ物で切ったタップをパネルの中だけ戻す
 *  - bg-surface: 下の一覧が透けないよう不透明にする（重ねる以上、透けると読めない）
 *  - overflow-y-auto: 画面からはみ出す長さのときはパネルの中だけをスクロールさせる
 *    （高さは下の usePanelMaxHeight が実測して入れる。calc の値は測り終わるまでの控え）
 *  - overscroll-contain: パネルの端まで送っても、後ろの一覧が動かないようにする
 *    ＝開いている間にスクロール位置が変わらない
 */
const PANEL_CLS =
  'pointer-events-auto mt-[var(--space-sm)] max-h-[calc(100dvh-14rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface px-[var(--space-md)] pb-[var(--space-md)] shadow-md'

/** パネルと画面の縁（貼り付く検索バー・下のタブナビ）のあいだに残す余白（px） */
const PANEL_EDGE_GAP = 8
/** これ以上は縮めない高さ（px）。極端に低い画面でもパネルが潰れて読めなくならないように */
const PANEL_MIN_HEIGHT = 240

/**
 * 重ねて出すパネルの高さの上限を実測する（2026-08-10 便FF）。
 *
 * パネルの上端は検索バーの下端。検索バーは画面上部に貼り付くので、上端の位置は
 * 「一覧のどこを見ているか」で変わる（先頭では見出しのぶん下、スクロール中は画面の上）。
 * さらにレシピの登録件数の案内が出ている日は検索バーがもう一段下がる。
 * そのため固定値では決められず、開いている間だけ実際の位置を測って上限を入れる。
 * 下はタブナビ・タイマーの浮遊バー（`data-app-bottom-bar`）の手前で止める。
 */
function usePanelMaxHeight(open: boolean, barRef: RefObject<HTMLDivElement | null>) {
  const [maxHeight, setMaxHeight] = useState<number>()
  useEffect(() => {
    if (!open) return
    const update = () => {
      const bar = barRef.current
      if (!bar) return
      const top = bar.getBoundingClientRect().bottom + PANEL_EDGE_GAP
      let bottomInset = 0
      for (const el of document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]')) {
        const r = el.getBoundingClientRect()
        if (r.height > 0 && r.top < window.innerHeight)
          bottomInset = Math.max(bottomInset, window.innerHeight - r.top)
      }
      const bottom = window.innerHeight - bottomInset - PANEL_EDGE_GAP
      setMaxHeight(Math.max(PANEL_MIN_HEIGHT, Math.round(bottom - top)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [open, barRef])
  return maxHeight
}

/**
 * 画面下に固定する帯を、すでに下にいる帯（タブナビ・タイマー・新しい版のお知らせ）の
 * 上に積むための下端位置を測る（2026-08-15 便GU）。
 *
 * 高さが固定値ではないので px を決め打ちできない（タイマーは本数で伸びる）。
 * logic/bottomBarInset.ts と同じく `[data-app-bottom-bar]` を測るが、自分自身は数えない
 * （自分を含めると「自分の高さぶん自分が上がる」の繰り返しになる）。
 */
function useStackedBottomOffset(active: boolean, selfRef: RefObject<HTMLElement | null>) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (!active) return
    const others = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]')).filter(
        (bar) => bar !== selfRef.current && !selfRef.current?.contains(bar),
      )
    let observed: HTMLElement[] = []
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null
    function update() {
      const bars = others()
      if (
        resizeObserver &&
        (bars.length !== observed.length || bars.some((bar, i) => bar !== observed[i]))
      ) {
        resizeObserver.disconnect()
        for (const bar of bars) resizeObserver.observe(bar)
        observed = bars
      }
      const vh = window.innerHeight
      let next = 0
      for (const bar of bars) {
        const r = bar.getBoundingClientRect()
        if (r.height > 0 && r.top < vh) next = Math.max(next, vh - r.top)
      }
      setOffset(Math.round(next))
    }
    update()
    const mutationObserver = new MutationObserver(() => update())
    mutationObserver.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', update)
    window.addEventListener('orientationchange', update)
    return () => {
      resizeObserver?.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('orientationchange', update)
    }
  }, [active, selfRef])
  return offset
}

const chipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
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
 * 従来どおりURLの ?q= / ?ing= が指定されていればそちらを優先する（献立の「日」の検索の入口等、
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
  /** 料理の種別で絞る（2026-08-10 便FF。旧セッションの保存値には無いので任意項目） */
  dishType?: DishTypeFilter
  favoriteOnly: boolean
  excludeNg: boolean
  quickOnly: boolean
  /** 在庫の食材で絞る（2026-07-24 便BN・司令部追加。旧セッションの保存値には無いので任意項目） */
  pantryOnly?: boolean
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
  const confirm = useConfirm()
  // 他の画面から ?q=... / ?ing=... 付きで来たときは、その条件で開く。
  // どちらも無ければ（詳細から戻ってきた等の「素の /recipes」）sessionStorageの保存値から復元する
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  const navigate = useNavigate()
  // 「レシピを探す」の入口からの遷移(2026-08-02 オーナー実機FB。2026-08-17 便HGで献立の「日」へ移設)。
  // ?focus=search = 検索欄にフォーカスした状態で開く / ?pantry=1 = 「在庫の食材で絞る」をONで開く。
  // 2026-08-17 便HH: この2つを押すボタンはアプリの画面から外した(行き先がレシピ一覧・
  // 絞り込みの「在庫の食材で絞る」と重なっていたため)。URLで開いたときの動きはそのまま残す
  // ＝古いブックマークやリンクを開いても、これまでと同じ状態のレシピ一覧に着く。
  // どちらも「明示的な新規検索」なので、?q=・?ing= と同じくsessionStorageの保存状態は復元しない
  // (前回の検索語が残ったまま検索欄にフォーカスすると、何を打てばいいのか分からなくなるため)。
  // 初回マウント時のURLだけを見る(下のURL同期でパラメータを消すので、以後は再発火しない)
  // ?select=today = 献立の「＋ 今日の献立を探す」から来た(2026-08-11 便FP)。選択モードで開き、
  // 何を選んでいる最中なのかを画面に出す。絞り込み・検索の保存状態はそのまま復元する
  // (前に見ていた条件のまま選び始めたいので、ここでは条件を消さない)
  const [entry] = useState(() => ({
    focusSearch: searchParams.get('focus') === 'search',
    pantry: searchParams.get('pantry') === '1',
    selectForToday: searchParams.get('select') === 'today',
  }))
  const [saved] = useState(() =>
    entry.focusSearch || entry.pantry ? null : readSavedListState(),
  )
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState(() => searchParams.get('q') ?? saved?.query ?? '')
  const [ingredients, setIngredients] = useState<string[]>(() => {
    const ingParam = searchParams.get('ing')
    if (ingParam !== null) return splitValues(ingParam)
    return saved?.ingredients ?? []
  })
  // 並び替え/絞り込みパネル(2026-07-16 便T: 従来は1つのpanelOpenで両方を出し分けていたが、
  // ボタンを分離したのに合わせて開閉状態も分離する。片方を開くともう片方は閉じる(同時に出さない)
  const [filterPanelOpen, setFilterPanelOpen] = useState(
    searchParams.get('ing') !== null || entry.pantry,
  )
  const [sortPanelOpen, setSortPanelOpen] = useState(false)
  const toggleFilterPanel = () => {
    setFilterPanelOpen((open) => !open)
    setSortPanelOpen(false)
  }
  const toggleSortPanel = () => {
    setSortPanelOpen((open) => !open)
    setFilterPanelOpen(false)
  }
  // 一覧の上に重ねて出すパネルの高さの上限(2026-08-10 便FF)。貼り付く検索バーの下端と
  // 下の固定バーの位置から実測する
  const topBarRef = useRef<HTMLDivElement>(null)
  const panelMaxHeight = usePanelMaxHeight(sortPanelOpen || filterPanelOpen, topBarRef)

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
        // 呼び出し元からの一度きりの指示(2026-08-02)はURLに残さない。残すと、詳細から戻るたびに
        // 検索欄へフォーカスが飛んだり在庫の絞り込みが復活したりする
        next.delete('focus')
        next.delete('pantry')
        next.delete('select')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ingredients])

  // 「レシピを探す」から来たときだけ検索欄にフォーカスする(2026-08-02)。
  // 初回マウント時に1回だけ。スマホではここでキーボードが開き、すぐ打ち始められる
  useEffect(() => {
    if (!entry.focusSearch) return
    searchInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [time, setTime] = useState<TimeFilter>(saved?.time ?? 'all')
  const [effort, setEffort] = useState<EffortFilter>(saved?.effort ?? 'all')
  const [tag, setTag] = useState<TagFilter>(saved?.tag ?? 'all')
  // 料理の種別(主菜・副菜・汁物・その他)で絞る(2026-08-10 便FF)
  const [dishType, setDishType] = useState<DishTypeFilter>(saved?.dishType ?? 'all')
  const [favoriteOnly, setFavoriteOnly] = useState(saved?.favoriteOnly ?? false)
  const [excludeNg, setExcludeNg] = useState(saved?.excludeNg ?? false)
  const [quickOnly, setQuickOnly] = useState(saved?.quickOnly ?? false)
  // 在庫(ある/少ない)の食材を使うレシピだけに絞る(2026-07-24 便BN・司令部追加)。
  // 「在庫の食材から探す」(?pantry=1)から来たときは最初からONで開く(2026-08-02)
  const [pantryOnly, setPantryOnly] = useState(entry.pantry || (saved?.pantryOnly ?? false))
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

  // 栄養並び替え(2026-07-13 Fable設計→2026-07-16 便T-4で5項目まとめてPro機能化→
  // 2026-08-01 線引きB'でカロリー順のみ無料に開放。たんぱく質・塩分・脂質・糖質はPro維持)
  const nutritionUnlocked = isNutritionUnlocked(!!settings?.proCode)

  // 栄養並び替え用の値(1食あたり)。計算が重いので栄養並び替えを選んでいる間だけ、
  // 全レシピ分をまとめて1回計算する(毎レンダー再計算しない)
  const nutrientSortActive = isNutrientSortOption(sort)
  const nutrientSortValues = useMemo(() => {
    if (!recipes || !nutrientSortActive) return undefined
    return buildNutrientSortValues(recipes)
  }, [recipes, nutrientSortActive])

  // 「基本レシピを表示しない」設定を反映した、この一覧が扱う全レシピ。
  // 総件数・検索対象・よく使うタグの集計をすべてこの同じ集合から作る(食い違いを作らない)
  const visibleRecipes = useMemo(() => {
    if (!recipes) return undefined
    return hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, hideStarters])

  // 絞り込み無しでも常に見える総件数(2026-07-13 UI改善)。「基本レシピを表示しない」設定は
  // 一覧の表示そのものに反映される設定なのでここにも反映し、検索語等の絞り込みは反映しない
  const totalCount = visibleRecipes?.length

  /**
   * 無料版の登録件数まわり(2026-08-08 便DZ)。
   * - 件数表記の横に出す「自分で登録 ◯/30品」: 上限に数えるのは自分で登録したレシピだけなので、
   *   総件数(基本レシピを含む)とは別に数える。解錠済みは上限が無いので出さない
   * - 節目の案内: 登録し終えた時点の件数が20件目・27件目・30件目だったときだけ、
   *   RecipeFormPageが settings.freeLimitNoticeCount に控える。閉じたら0に戻して再表示しない
   */
  const isPro = !!settings?.proCode
  const freeLimitCount = recipes ? countFreeLimitRecipes(recipes) : undefined
  const freeLimitNotice = freeLimitNoticeFor(settings?.freeLimitNoticeCount, isPro)
  const dismissFreeLimitNotice = () => {
    void updateSettings({ freeLimitNoticeCount: 0 })
  }

  /**
   * タグのチップ(2026-08-03 オーナー指示 → 2026-08-10 便FFで件数を併記)。
   *
   * いま一覧に出ているレシピのタグを数え、そのタグが付いているレシピの多い順に出す。
   * チップに件数を出すのは、並びの規則を画面から読めるようにするため
   * (オーナー「現状は勝手にこちらできめた『よく使いようなタグ』をとにかく並べただけ」)。
   * 数える対象は一覧と同じ集合なので、「自分で登録したレシピのみ」をONにすれば
   * 自分のタグだけが数え直される。
   * 選択中のタグは、件数の変動で上位から外れても必ず残す(外す手段が消えないように)
   */
  const tagOptions = useMemo(() => {
    const usages = tagUsageCounts(visibleRecipes ?? [], TAG_CHIP_LIMIT)
    if (tag !== 'all' && !usages.some((u) => u.tag === tag)) {
      const count = (visibleRecipes ?? []).filter((r) => r.tags.includes(tag)).length
      usages.push({ tag, count })
    }
    return [
      { value: 'all' as TagFilter, label: ja.search.tagAll },
      ...usages.map(({ tag: value, count }) => ({
        value: value as TagFilter,
        label: ja.search.tagChip.replace('{name}', value).replace('{n}', String(count)),
      })),
    ]
  }, [visibleRecipes, tag])

  const results = useMemo(() => {
    if (!visibleRecipes) return undefined
    const found = searchRecipes(visibleRecipes, {
      query,
      ingredients: ingredients.join(' '),
      time,
      effort,
      tag,
      dishType,
      favoriteOnly,
      excludeNg,
      quickOnly,
      pantryOnly,
      pantryNames,
      ngIngredients: ngIngredients ?? [],
    })
    return sortResults(found, sort, pantryNames, sortDirection, nutrientSortValues)
  }, [
    visibleRecipes,
    query,
    ingredients,
    time,
    effort,
    tag,
    dishType,
    favoriteOnly,
    excludeNg,
    quickOnly,
    pantryOnly,
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
    dishType !== 'all' ||
    favoriteOnly ||
    excludeNg ||
    quickOnly ||
    pantryOnly
  const sortActive = sort !== 'updated' || sortDirection !== defaultSortDirection[sort]
  // 「自分で登録したレシピのみ」(hideStarters)は絞り込みパネルのチップだが、実体は設定に
  // 保存する項目なのでfilterActive(件数表記の出し分けに使う)には入れない。
  // 2026-08-03 オーナー指示: これだけがONのときも「条件をクリア」が出るようにする
  // (従来はクリアの導線が出ず、どこで戻すのか分からなかった)
  const anyConditionActive = filterActive || sortActive || hideStarters

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
        dishType,
        favoriteOnly,
        excludeNg,
        quickOnly,
        pantryOnly,
        sort,
        sortDirection,
      }),
    [
      query,
      ingredients,
      time,
      effort,
      tag,
      dishType,
      favoriteOnly,
      excludeNg,
      quickOnly,
      pantryOnly,
      sort,
      sortDirection,
    ],
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
      dishType,
      favoriteOnly,
      excludeNg,
      quickOnly,
      pantryOnly,
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
  // ---- まとめて削除の選択モード(2026-08-02 便CT・オーナー承認) ----
  // 作法は食材の在庫の「整理」モード(components/PantryBoard.tsx)の先例に倣う:
  // 見出し横のボタンで入る／抜ける・全選択／選択解除・「選択した◯品を削除」を選択操作のすぐ下に置く。
  // 入口は「選択」ボタンとカードの長押しの2つ(長押しは在庫チップには無いが、一覧は
  // 「消したい1品を見つけた流れでそのまま片づけ始める」動きが自然なため足した)
  const [selecting, setSelecting] = useState(entry.selectForToday)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  /**
   * 他の画面から「結果を伝えたうえでレシピ一覧へ戻す」ときのトースト（2026-08-18 便HS・軸4）。
   * レシピ編集で1品削除すると、削除元の画面ごと消えてこの一覧へ移るので、
   * 知らせは移った先で出す（献立へ戻すときの MealPlanPage と同じやり方）。
   * 一度出したら履歴から消す＝ブラウザの戻る/進むで同じ知らせが再び出ないようにする
   */
  useEffect(() => {
    const handedOver = (location.state as { toast?: string } | null)?.toast
    if (!handedOver) return
    setMessage(handedOver)
    navigate(location.pathname + location.search, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])
  const [deleting, setDeleting] = useState(false)
  // 献立の「＋ 今日の献立を探す」から来た選択モードか(2026-08-11 便FP)。
  // trueの間は「今日の献立に入れるレシピを選んでいます」と決定ボタンを出し、
  // 書き出し・削除は出さない(入れに来た操作の隣に、消す操作を並べない)
  const [selectingForToday, setSelectingForToday] = useState(entry.selectForToday)
  /**
   * 選び終わったあとに出す「選んだ◯品をどうしますか？」の窓(2026-08-17 便HJ)。
   * 献立から来た選択モード(selectingForToday)は行き先が決まっているので出さない。
   */
  const [actionsOpen, setActionsOpen] = useState(false)
  // まとめて入れるときの食事の振り分け窓(1品ずつのときと同じ部品・同じ選択肢)
  const [bulkSlotModalOpen, setBulkSlotModalOpen] = useState(false)
  const [addingToToday, setAddingToToday] = useState(false)
  // 選択モードの操作の帯(2026-08-15 便GU)。すでに下にいる帯の上に積む
  const selectionBarRef = useRef<HTMLDivElement>(null)
  const selectionBarOffset = useStackedBottomOffset(selecting, selectionBarRef)
  // 測り終わるまでの控えはタブナビ1本ぶん(タイマーの帯と同じ値)。--app-bottom-inset は
  // この帯自身の高さも含むので、控えに使うと「自分の高さぶん自分が上がる」が起きうる
  const selectionBarBottom =
    selectionBarOffset > 0
      ? `${selectionBarOffset}px`
      : 'calc(72px + env(safe-area-inset-bottom))'

  const visibleIds = useMemo(
    () => (results ?? []).map((r) => r.recipe.id).filter((id): id is number => id != null),
    [results],
  )
  // 選択中に絞り込み・検索を変えたら、画面から消えた品の選択は落とす。
  // 「選択したレシピ◯品を削除」の◯が、いま見えているカードの選択数と必ず一致するようにする
  // (見えないところで選ばれたままの品を巻き込んで消さないための歯止め)
  useEffect(() => {
    if (!selecting) return
    setSelectedIds((prev) => {
      const visible = new Set(visibleIds)
      const next = prev.filter((id) => visible.has(id))
      return next.length === prev.length ? prev : next
    })
  }, [selecting, visibleIds])
  // 一覧が0件になったら選択モードから自動で抜ける(PantryBoardと同じ理由: 0件だと
  // 選択できるものが無いまま、抜ける導線だけが分かりにくい状態が残るため)
  useEffect(() => {
    if (selecting && recipes && recipes.length === 0) {
      setSelecting(false)
      setSelectedIds([])
      setSelectingForToday(false)
      setActionsOpen(false)
    }
  }, [selecting, recipes])

  const startSelecting = () => {
    setSelecting(true)
    setSelectedIds([])
    // 見出し横のボタンで入り直した選択モードは、献立からの「今日の献立に入れる用」ではない
    setSelectingForToday(false)
  }
  /**
   * 選択モードを抜ける(2026-08-15 便GU)。選んだレシピは外れ、ふだんの一覧に戻る。
   * 献立の「＋ 今日の献立を探す」から来ていたときは献立へ帰す
   * (何も入れずに抜けたとき、来た画面へ戻れないと行き止まりになる。便FPと同じ考え方)。
   *
   * 2026-08-17 便HJ: 入口の「選択」と同じ場所のボタンからも、選び終わったあとの窓の
   * 「選択をやめる」からも、ここへ来る(どちらから抜けても同じ結果になる)
   */
  const exitSelecting = () => {
    setSelecting(false)
    setSelectedIds([])
    setActionsOpen(false)
    if (selectingForToday) {
      setSelectingForToday(false)
      navigate('/meal-plan')
    }
  }
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }
  const selectAllVisible = () => setSelectedIds(visibleIds)
  const clearSelection = () => setSelectedIds([])
  const allVisibleSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length

  // 長押しで選択モードに入る。押した指が動いたら(スクロール)取り消し、成立したら
  // 直後のクリック(=カードのリンク遷移)を1回だけ握りつぶす
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const longPressFiredRef = useRef(false)
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null)
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    }
  }, [])
  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = undefined
    longPressOriginRef.current = null
  }
  const onCardPointerDown = (e: ReactPointerEvent, id: number | undefined) => {
    // 前回の長押しの後始末(クリックが来ずに終わった場合)。持ち越すと次の1タップを飲み込む
    longPressFiredRef.current = false
    if (selecting || id == null) return
    // 右クリック等は対象外(スマホ縦画面での長押しだけを拾う)
    if (e.button !== 0 && e.pointerType === 'mouse') return
    longPressOriginRef.current = { x: e.clientX, y: e.clientY }
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true
      setSelecting(true)
      setSelectedIds([id])
    }, LONG_PRESS_MS)
  }
  /**
   * 長押しの最中だけ、ブラウザ標準の長押しメニュー（Androidのコンテキストメニュー等）を抑える。
   * 常に抑えるとPCの右クリック（新しいタブで開く等）まで奪ってしまうので、
   * 長押し判定が動いている間に限定する（右クリックはpointerdownで対象外にしているため通る）
   */
  const onCardContextMenu = (e: ReactMouseEvent) => {
    if (longPressTimerRef.current || longPressFiredRef.current) e.preventDefault()
  }
  const onCardPointerMove = (e: ReactPointerEvent) => {
    const origin = longPressOriginRef.current
    if (!origin) return
    if (
      Math.abs(e.clientX - origin.x) > LONG_PRESS_MOVE_TOLERANCE ||
      Math.abs(e.clientY - origin.y) > LONG_PRESS_MOVE_TOLERANCE
    ) {
      cancelLongPress()
    }
  }
  const onCardClickCapture = (e: ReactMouseEvent) => {
    if (!longPressFiredRef.current) return
    longPressFiredRef.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  // 選んだレシピをファイルに書き出す一式(2026-08-15 便GVで切り出し・2026-08-17 便HJでフックに)。
  // 保存先を選ぶ画面・確認の窓・ファイルの大きさの計算がこの中に入っている
  const selectedExport = useSelectedRecipesExport({
    selectedIds,
    totalCount: recipes?.length ?? selectedIds.length,
    onMessage: setMessage,
  })

  // 選択したレシピをまとめて削除する。確認文は規約F(何が消えて何が残るかを件数つきで
  // 両方書く)＝1品削除(RecipeFormPageのconfirmDelete・便CI/C01)と同じ範囲を数える。
  // 実行後も選択モードは維持し、選択だけ解除する(在庫の整理モードと同じ。片づけの途中で
  // モードから追い出されると、続けて消したいときに毎回入り直すことになるため)
  const deleteSelected = async () => {
    if (selectedIds.length === 0 || deleting) return
    setDeleting(true)
    try {
      const impact = await countRecipesDeleteImpact(selectedIds)
      if (impact.recipes === 0) return
      if (!(await confirm(buildBulkDeleteConfirm(impact)))) return
      const removed = await deleteRecipes(selectedIds)
      setSelectedIds([])
      setMessage(ja.recipes.bulkDeletedToast.replace('{r}', String(removed)))
    } finally {
      setDeleting(false)
    }
  }

  /**
   * 選んだレシピをまとめて今日の献立に入れる（2026-08-11 便FP・利用者テスト①②）。
   * 食事（朝食/昼食/夕食）は品ごとではなく1回だけ選ぶ＝3品入れるのに窓が3回出たりしない。
   * 中身の判断は1品ずつの経路と同じ（db/mealPlan.ts addRecipesToToday）。
   *
   * 献立の「＋ 今日の献立を探す」から来ていたときは、入れ終わったら献立へ戻る
   * （押した本人が見たいのは「入った献立」なので、行き止まりにしない）。
   * 一覧の「選択」から自分で入れたときは一覧に留まり、結果をトーストで知らせる。
   */
  const addSelectedToToday = async (slot?: MealSlot) => {
    if (selectedIds.length === 0 || addingToToday) return
    setBulkSlotModalOpen(false)
    setAddingToToday(true)
    try {
      const { added, already } = await addRecipesToToday(todayString(), selectedIds, slot)
      const toast =
        added === 0
          ? ja.recipes.addSelectedToTodayAllAlreadyToast.replace('{m}', String(already))
          : (slot
              ? ja.recipes.addSelectedToTodayDoneToast
                  .replace('{slot}', ja.mealPlan.slot[slot])
                  .replace('{n}', String(added))
              : ja.recipes.addSelectedToTodayDoneUndecidedToast.replace('{n}', String(added))) +
            (already > 0
              ? ja.recipes.addSelectedToTodayAlreadySuffix.replace('{m}', String(already))
              : '')
      setSelectedIds([])
      if (selectingForToday) {
        setSelecting(false)
        setSelectingForToday(false)
        navigate('/meal-plan', { state: { toast } })
        return
      }
      setMessage(toast)
    } finally {
      setAddingToToday(false)
    }
  }

  const onClickCapture = (e: ReactMouseEvent) => {
    if (!(e.target instanceof Element)) return
    // 長押しで選択モードに入った直後のクリックと、選択モード中のカードのタップは詳細へ
    // 遷移しない(2026-08-02 便CT)。ここでleavingRefを立ててしまうと、遷移していないのに
    // 以降のスクロール位置保存が止まる
    if (longPressFiredRef.current || selecting) return
    // カード内のボタン(お気に入りトグル・2026-07-29 便CI/C15)は遷移しないので、
    // 「離脱する」扱いにしない(leavingRefを立てると以降のスクロール位置保存が止まってしまう)
    if (e.target.closest('button')) return
    if (!e.target.closest('a')) return // リンク以外の操作では固定しない
    saveListState(window.scrollY) // 遷移で高さが縮む前の、正しい位置を確定保存する
    leavingRef.current = true
  }

  const clearFilters = () => {
    setQuery('')
    setIngredients([])
    setTime('all')
    setEffort('all')
    setTag('all')
    setDishType('all')
    setFavoriteOnly(false)
    setExcludeNg(false)
    setQuickOnly(false)
    setPantryOnly(false)
    setSort('updated')
    setSortDirection(defaultSortDirection.updated)
    // 「自分で登録したレシピのみ」も一緒に戻す(2026-08-03 オーナー指示。これがONのときも
    // クリアが出る以上、押して残っていては条件をクリアしたことにならない)。
    // 設定に保存する項目なので、ONのときだけ書き込む
    if (hideStarters) void updateSettings({ hideStarters: false })
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
   * 表示しない(undefinedを返し、RecipeCard側でバッジ自体を出さない)。
   * 2026-08-01 線引きB': 無料で選べるカロリー順のときは無料でも値を出し、
   * Pro側の項目(たんぱく質・塩分・脂質・糖質)はPro解錠時だけ出す
   * (無料の画面に塩分の数値が出ないようにするための表示ゲート)。
   * 2026-07-16オーナー指示: 「たんぱく質: 24g」のように並び替え項目のラベルを値の前に付ける
   * (ラベルはnutrientSortLabels=並び替えパネルの項目名と同じものを流用する)
   */
  const nutrientBadgeTextFor = (recipeId: number | undefined): string | undefined => {
    if (!nutrientSortActive || !isNutrientSortOption(sort)) return undefined
    if (!nutritionUnlocked && !isFreeSortOption(sort)) return undefined
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
      {/* 見出し行に選択モードの入口を置く(食材の在庫の「整理」ボタンと同じ位置づけ)。
          レシピが1品も無いうちは選ぶものが無いので出さない。

          2026-08-17 便HJ(オーナー実機「『選択』ボタン押下したら選択をやめるボタンに変化する
          ようにして。場所が変わると戻る時に迷子になる」): 入口と出口を**同じ場所の1つのボタン**にする。
          押しても上端・右端は動かず、名前と絵だけが変わる(幅は名前の長さで変わる)。
          2026-08-15 便GUは抜ける操作を画面下の帯へ移していたが、押した指の位置と戻り先が
          離れてしまうので、抜ける操作をここへ戻した(帯には「選び終わる」だけを置く)。

          献立の「＋ 今日の献立を探す」から来たとき(selectingForToday)は出さない: この画面で
          「選択」を押していないので戻る場所が無く、抜ける先も一覧ではなく献立になるため
          (その操作は「入れずに献立に戻る」として下の帯にある) */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{ja.recipes.title}</h1>
        {recipes && recipes.length > 0 && !selectingForToday && (
          <button
            type="button"
            data-testid={selecting ? 'selection-exit' : 'select-toggle'}
            onClick={selecting ? exitSelecting : startSelecting}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted"
          >
            {selecting ? <X size={14} aria-hidden /> : <ListChecks size={14} aria-hidden />}
            {selecting ? ja.recipes.selectExit : ja.recipes.selectToggle}
          </button>
        )}
      </div>

      {/* 登録件数の節目の案内(2026-08-08 便DZ・オーナー指示「２０件目、２７件目、３０件目の
          登録完了時といった感じで」)。従来は40件以上なら一覧を開くたびに常時出していたが、
          同じ案内が毎回出るのを避け、節目ちょうどで登録し終えたときだけ1回出して×で閉じられる形にした。
          上限に達したときだけPro版への導線を添える(予告のうちは案内文だけにする) */}
      {freeLimitNotice && settings?.freeLimitNoticeCount !== undefined && (
        <div
          data-testid="free-limit-notice"
          className="mt-[var(--space-sm)] flex items-start gap-2 rounded-sm bg-surface px-3 py-2 text-sm text-ink-muted"
        >
          <div className="min-w-0 flex-1">
            <p>
              {freeLimitNotice === 'reached'
                ? ja.recipes.freeLimitReachedNotice
                : ja.recipes.freeLimitNearNotice.replace(
                    '{n}',
                    String(freeLimitRemaining(settings.freeLimitNoticeCount)),
                  )}
            </p>
            {freeLimitNotice === 'reached' && (
              <Link
                to={settingsLinkWithBack('/settings?section=pro', location.pathname + location.search)}
                className="mt-0.5 inline-block font-bold text-accent-ink underline"
              >
                {ja.recipes.freeLimitProLink}
              </Link>
            )}
          </div>
          {/* -m-2 + p-3.5: ×の見た目は16pxのまま、タップ領域を44px四方に広げる(アプリ内のお知らせと同じ) */}
          <button
            type="button"
            onClick={dismissFreeLimitNotice}
            aria-label={ja.common.close}
            className="tap-target -m-2 shrink-0 rounded-full p-3.5 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* 検索バー＋並び替え/絞り込みボタン(2026-07-16 便T-1: 従来は絞り込みボタン1つに両方の
          パネルが入っていたが、別ボタンに分離した。列表示切替は件数表記の横へ移動(下記参照))。

          2026-08-09 便ET(オーナー実機「レシピ一覧の検索まど…は上に固定したい」):
          スクロールしても画面上部に残す(sticky)。作りは設定画面の目次チップ・食材タブの
          タブバーと同じ(sticky top-0 + bg-page/95 + backdrop-blur + 横いっぱいに広げる
          -mx/px)。recipes-searchbar クラスは index.css で iPad のマルチタスク操作ボタン
          よけの上余白を足すためのもの。
          data-app-top-bar: 「押したら伸びた部分を画面内に入れる」共通処理(logic/revealExpanded)に
          この帯の高さを知らせる目印。付けないと、並び替え/絞り込みパネルを開いたときに
          パネルの頭がこの帯の下に潜り込む。
          z-20: 選択モードでカードに重ねる選択ボタン(z-10)より上に置き、帯が透けないようにする */}
      <div
        ref={topBarRef}
        data-app-top-bar
        className="recipes-searchbar sticky top-0 z-20 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur"
      >
      <div className="flex gap-[var(--space-sm)]">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden
          />
          <input
            ref={searchInputRef}
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
              ? 'border-accent text-accent-ink'
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
              ? 'border-accent text-accent-ink'
              : 'border-edge text-ink-muted'
          }`}
        >
          <SlidersHorizontal size={22} aria-hidden />
        </button>
      </div>

      {/* 並び替え／絞り込みのパネルを、一覧の上に重ねて出す入れ物(2026-08-10 便FF・
          オーナー「並べ替えと絞り込みは、スクロール途中で開いても上に戻されないようにして。
          一覧の上に重ねて出現させる感じ？」)。

          直した挙動: パネルはこれまで検索バーの**下に流れる中身**として置いていた。
          検索バーは画面上部に貼り付く(sticky)ので、一覧を下までスクロールしていると
          パネル本体は画面のはるか上にある。そこで開くと「伸びた部分を画面内へ入れる」共通処理
          (logic/revealExpanded・便EO)が働き、ページごと先頭付近まで戻っていた。

          直し方: パネルを貼り付く帯の中に入れ、absolute で帯の真下に重ねる。
          一覧の高さは1pxも変わらないので、開いても閉じてもスクロール位置は動かない。
          revealExpanded は使わない(reveal={false})＝便EO・便ETの位置合わせと干渉しない。
          pointer-events-none/auto: 閉じているときも開いているときも、パネルの外側の余白で
          一覧のタップを奪わないようにする */}
      <div className="pointer-events-none absolute inset-x-0 top-full px-[var(--space-md)]">
      {/* 並び替えパネル(2026-07-16 便T-1で絞り込みパネルから分離) */}
      <Collapse open={sortPanelOpen} reveal={false}>
        <div
          data-testid="recipes-sort-panel"
          // 絞り込みパネルは上端に貼り付く行(件数)が上余白を持つので、PANEL_CLS には上余白を
          // 入れていない。並べ替えパネルにはその行が無いのでここで足す
          className={`${PANEL_CLS} pt-[var(--space-md)]`}
          style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined}
        >
          {/* 昇順/降順(2026-08-02 便DFで件数表記の横からこのパネル内へ移動 → 2026-08-03
              オーナー指示でパネルの一番上へ。従来はパネル末尾(栄養価の区分より下)にあり、
              スクロールしないと見えなかった) */}
          <p className="text-sm font-bold text-ink-muted">{ja.search.sortDirectionTitle}</p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setSortDirection('asc')}
              aria-pressed={sortDirection === 'asc'}
              className={`inline-flex items-center gap-1 ${chipCls(sortDirection === 'asc')}`}
            >
              <ArrowUpNarrowWide size={16} aria-hidden />
              {ja.search.sortAsc}
            </button>
            <button
              type="button"
              onClick={() => setSortDirection('desc')}
              aria-pressed={sortDirection === 'desc'}
              className={`inline-flex items-center gap-1 ${chipCls(sortDirection === 'desc')}`}
            >
              <ArrowDownWideNarrow size={16} aria-hidden />
              {ja.search.sortDesc}
            </button>
          </div>

          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.sortTitle}
          </p>
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
          {/* 「よく使う順」が何を数えた順かを一言で示す(2026-07-29 便CI/C13) */}
          <p className="mt-1 text-xs text-ink-muted">{ja.search.sortCookedHint}</p>

          {/* 栄養価並び替え(便T-4で5項目をPro機能化 → 2026-08-01 線引きB'でカロリー順のみ無料開放)。
              無料版は「カロリー」だけを選べる欄＋残り4項目のグレーのティーザー行を出し、
              タップで既存のProゲート表現(Lock+ミュート色)からPro案内へ送る */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.sortNutritionTitle}
          </p>
          {/* 何のために並べ替えるのか(用途)を1行添える(2026-07-28 便BY/見せ方(c))。
              無料版は使えるのがカロリー順だけなので、用途の言葉もカロリーの話にする */}
          <p className="text-xs text-ink-muted">
            {nutritionUnlocked ? ja.search.sortNutritionHint : ja.search.sortNutritionFreeHint}
          </p>
          <CheckList
            options={nutritionUnlocked ? nutrientSortOptions : freeNutrientSortOptions}
            value={sort}
            onSelect={(next) => {
              setSort(next)
              setSortDirection(defaultSortDirection[next])
            }}
          />
          {!nutritionUnlocked && (
            <Link
              to={settingsLinkWithBack('/settings?section=pro', location.pathname + location.search)}
              className="mt-[var(--space-sm)] flex w-full items-start gap-2 rounded-md border border-edge bg-app px-3 py-2.5 text-left text-sm text-ink-muted opacity-60"
            >
              <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>
                <span className="font-bold">{ja.search.sortNutritionGate}</span>
                <span className="block text-xs">{ja.search.sortNutritionGateHint}</span>
              </span>
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
      </Collapse>

      {/* 絞り込みパネル(2026-07-16 便T-3: 「条件をクリア」を欄の上方に移動) */}
      <Collapse open={filterPanelOpen} reveal={false}>
        <div
          data-testid="recipes-filter-panel"
          className={PANEL_CLS}
          style={panelMaxHeight != null ? { maxHeight: panelMaxHeight } : undefined}
        >
          {/* パネルの上端に貼り付く行(2026-08-10 便FF)。一覧の上に重ねて出すようになり、
              一覧の上に常設している件数の行がパネルに隠れるため、いま何件になっているかを
              パネルの中でも見られるようにする。条件を変えるたびに動く数字なので、
              パネルを下まで送っても見えるよう上端に貼り付ける。
              「条件をクリア」は2026-07-16 便T-3で欄の上方へ置いたものを、この行にまとめた */}
          <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-surface px-4 pb-2 pt-4">
            {anyConditionActive ? (
              <button
                type="button"
                onClick={clearFilters}
                className="text-sm font-bold text-accent-ink underline"
              >
                {ja.search.clear}
              </button>
            ) : (
              <span />
            )}
            {results && totalCount !== undefined && (
              <span data-testid="filter-panel-count" className="shrink-0 text-sm text-ink-muted">
                {filterActive
                  ? ja.search.resultCountWithTotal
                      .replace('{n}', String(results.length))
                      .replace('{t}', String(totalCount))
                  : ja.search.totalCount.replace('{n}', String(totalCount))}
              </span>
            )}
          </div>

          {/* --- 区分①「どのレシピから探すか」 ---
              2026-08-03 オーナー指示でパネルの最上段に置いた区分(「お気に入り」など毎回使う
              条件が一番下にあって見えていなかったため)。位置はそのまま。
              2026-08-10 便FF(オーナー「在庫の食材、NG食材隠しのタグ、登録したレシピのみ、が
              同列で並んでいるのもわかりにくくしている」): 性質の違う「在庫の食材で絞る」を
              区分③「食材で絞り込む」へ移し、ここは『一覧に出すレシピの母集団を決める』3つだけにした */}
          <p className="text-sm font-bold text-ink-muted">{ja.search.shownRecipesTitle}</p>
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setFavoriteOnly((v) => !v)}
              aria-pressed={favoriteOnly}
              className={chipCls(favoriteOnly)}
            >
              {ja.search.favoriteOnly}
            </button>
            <button
              type="button"
              onClick={() => setExcludeNg((v) => !v)}
              aria-pressed={excludeNg}
              className={chipCls(excludeNg)}
            >
              {ja.search.excludeNg}
            </button>
            <button
              type="button"
              onClick={() => updateSettings({ hideStarters: !hideStarters })}
              aria-pressed={hideStarters}
              className={chipCls(hideStarters)}
            >
              {ja.search.myRecipesOnly}
            </button>
          </div>

          {/* --- 区分②「料理の種別」(2026-08-10 便FF・オーナー要望
              「主菜副菜などでも絞り込みしたい（タグ）」) ---
              主菜/副菜はタグではなくレシピの項目(dishType)なので、タグのチップに混ぜず
              専用の区分にする。区分名と選択肢はレシピ登録の「料理の種別」と同じ4つ。
              調理時間・手間レベルと同じ☑付きの単一選択リストで出す(同じ「1つだけ選ぶ」操作を
              画面の中で別々の見た目にしない) */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.dishTypeTitle}
          </p>
          <CheckList options={dishTypeOptions} value={dishType} onSelect={setDishType} />

          {/* --- 区分③「タグ」(2026-07-24 便BN・タスク3で絞り込みパネルの上部へ移動 →
              2026-08-03 使用件数の集計に変更 → 2026-08-10 便FFで件数を併記・見出しを改称) ---
              チップに「和食 48」のようにレシピの件数を出し、並びの規則(件数の多い順)が
              画面から読めるようにする。
              タグが1つも付いていないときは「すべて」だけの空の欄になるので、区分ごと出さない */}
          {tagOptions.length > 1 && (
            <>
              <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                {ja.search.tagTitle}
              </p>
              <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                {tagOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    data-testid="recipes-tag-chip"
                    onClick={() => setTag(option.value)}
                    aria-pressed={tag === option.value}
                    className={chipCls(tag === option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* --- 区分④「食材で絞り込む」 ---
              2026-08-10 便FF: 「在庫の食材で絞る」を区分①からここへ移した。
              どちらも食材で一覧を絞る操作で、「食材の在庫から入れる」とも隣り合う */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.ingredientTitle}
          </p>
          {/* 在庫の食材で絞る(2026-07-24 便BN・司令部追加)。在庫(ある/少ない)が1件以上あるときだけ出す */}
          {pantryNames.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
              <button
                type="button"
                onClick={() => setPantryOnly((v) => !v)}
                aria-pressed={pantryOnly}
                className={`inline-flex items-center gap-1 ${chipCls(pantryOnly)}`}
              >
                <Refrigerator size={16} aria-hidden />
                {ja.search.pantryFilter}
              </button>
            </div>
          )}
          <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
            {ja.search.ingredientSubTitle}
          </p>
          <div className="mt-1">
            <ChipInput
              values={ingredients}
              onChange={setIngredients}
              placeholder={ja.search.ingredientPlaceholder}
              addLabel={ja.search.ingredientAdd}
            />
            {/* 食材の在庫にある食材を、この欄へ1タップで入れる(2026-08-02 オーナー指示・便DF)。
                従来も同じボタンがあったが、①文言が「在庫から追加」で何がどこへ入るのか読めず
                ②「ある/少ない」が1件も無いと消えていて、押せない理由も分からなかった。
                ボタンは常に出し、入れられる食材が無いときは押せない状態＋理由を1行で示す */}
            <button
              type="button"
              onClick={() => setIngredients((prev) => Array.from(new Set([...prev, ...pantryNames])))}
              disabled={pantryNames.length === 0}
              className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              <Refrigerator size={16} aria-hidden />
              {ja.search.pantryToIngredients}
            </button>
            {pantryNames.length === 0 && (
              <p className="mt-1 text-xs text-ink-muted">{ja.search.pantryToIngredientsEmpty}</p>
            )}
          </div>

          {/* --- 区分⑤「調理時間」(2026-07-16 UI総点検B-7: ☑付き単一選択リストに変更) --- */}
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

          {/* --- 区分⑥「手間レベル」(2026-07-16 UI総点検B-7: ☑付き単一選択リストに変更) --- */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.effortTitle}
          </p>
          <CheckList options={effortOptions} value={effort} onSelect={setEffort} />

          {/* 条件は開いた瞬間から即時反映されるので、このボタンは閉じるだけ */}
          <button
            type="button"
            onClick={() => setFilterPanelOpen(false)}
            className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            {ja.search.apply}
          </button>
        </div>
      </Collapse>
      </div>
      </div>

      {/* 件数: 絞り込み無しでも総件数を常に表示する(2026-07-13 UI改善)。絞り込み中は
          既存の結果件数表示を維持しつつ「◯件 / 全◯件」の形にまとめる(件数が変わるのは絞り込みのみ・
          並べ替えでは変わらないのでfilterActiveで判定する)。
          昇順/降順は2026-08-02 オーナー指示(便DF)で並べ替えパネルの中へ移した(2026-07-16
          UI総点検B-7でここに出していたものを取りやめ)。列表示切替(グリッド/一覧)は
          便T-2からこの行のまま: 全◯件 | 列切替 の並び */}
      {results && totalCount !== undefined && (
        <div className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm text-ink-muted">
            {filterActive
              ? ja.search.resultCountWithTotal
                  .replace('{n}', String(results.length))
                  .replace('{t}', String(totalCount))
              : ja.search.totalCount.replace('{n}', String(totalCount))}
            {/* 無料版の登録件数(2026-08-08 便DZ・オーナー要望「利用者がどう確認できるか」)。
                レシピを登録する場所で残りが分かるよう、総件数の横に「自分で登録 ◯/30品」を出す。
                総件数には基本レシピが入るが上限には数えないので、別の数として並べる。
                解錠済みは上限が無いので出さない */}
            {FREE_LIMIT_ENABLED && !isPro && freeLimitCount !== undefined && (
              <span data-testid="free-limit-count" className="ml-2 whitespace-nowrap">
                {ja.recipes.freeLimitCount
                  .replace('{n}', String(freeLimitCount))
                  .replace('{max}', String(FREE_LIMIT))}
              </span>
            )}
          </p>
          <div className="flex shrink-0 items-center gap-1">
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
              {/* 空の型（2026-08-18 便HS・軸8）: 「◯◯がありません」＋ボタン1つ。
                  直す前は「右下の「＋」から最初のレシピを登録しましょう」と＋の場所を
                  文章で説明するだけで、この枠から押せるものが1つも無かった。
                  行き先は右下の「＋」と同じなので、名前も同じ（ja.recipes.addRecipe）にする */}
              <Link
                to="/recipes/new"
                className="tap-target mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-on-accent shadow-sm"
              >
                {ja.recipes.addRecipe}
              </Link>
            </>
          ) : (
            <>
              <p className="font-bold">{ja.search.noResult}</p>
              {/* 条件がかかっているなら、原因は絞り込みなので、その場で外せるようにする
                  (2026-07-29 便CI/C20。従来は絞り込みパネルを開かないと「条件をクリア」に届かず、
                  全件あるのに新規登録を勧める文面だけが出ていた) */}
              {anyConditionActive ? (
                <>
                  <p className="mt-1 text-sm">{ja.search.noResultFilteredHint}</p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="mt-[var(--space-sm)] rounded-md border border-accent bg-surface px-4 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    {ja.search.clear}
                  </button>
                </>
              ) : (
                <p className="mt-1 text-sm">{ja.search.noResultHint}</p>
              )}
            </>
          )}
        </div>
      )}

      {/* 献立の「＋ 今日の献立を探す」から来たときは、何を選んでいる最中なのかを言う
          (2026-08-11 便FP・利用者テスト②「ただのレシピ一覧に飛んで止まった」)。
          前回の絞り込みが残っていて0件のときも、この案内だけは出す
          (何をしに来た画面なのか分からないまま行き止まりにしないため) */}
      {selecting && selectingForToday && (
        <div
          data-testid="select-for-today-banner"
          className="mt-[var(--space-sm)] rounded-md border border-accent bg-surface px-3 py-2"
        >
          <p className="text-sm font-bold text-accent-ink">{ja.recipes.selectForTodayTitle}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{ja.recipes.selectForTodayHint}</p>
        </div>
      )}

      {/* 選択モードの案内と全選択/選択解除(2026-08-02 便CT)。
          選んだあとの操作(今日の献立に入れる・書き出す・削除)は2026-08-17 便HJで
          「選び終わる」の窓へ、選択モードを抜ける操作は見出し行のボタンへ移した。
          全選択・選択解除は選び始める前に使う操作なので、カードの手前のここに残す
          (帯に入れると帯が伸びてカードの見える高さを削るため)。
          案内は2行とも1行ずつに収めてある＝小さい画面でカードに使える高さを削らない */}
      {selecting && results && results.length > 0 && (
        <div className="mt-[var(--space-sm)] flex flex-col gap-2">
          {/* 案内の2行は隙間を空けずに重ねる。1行ぶんの高さがそのままレシピのカードの
              見える高さを削るため(2026-08-17 便HJ) */}
          <div>
            <p data-testid="select-hint" className="text-xs text-ink-muted">
              {ja.recipes.selectHint}
            </p>
            {/* 選択モードで何ができるかを、1品も選んでいないうちから出す(利用者テスト①) */}
            {!selectingForToday && (
              <p data-testid="select-actions-hint" className="mt-0.5 text-xs text-ink-muted">
                {ja.recipes.selectActionsHint}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAllVisible}
              disabled={allVisibleSelected}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              {ja.recipes.selectAll}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-ink-muted shadow-sm disabled:opacity-40"
            >
              {ja.recipes.clearSelection}
            </button>
          </div>
        </div>
      )}

      {/* カードのグリッド／リスト(2026-07-13 UI改善: 表示形式トグルで切替)。
          グリッドの [grid-auto-rows:1fr] は全カードの高さを揃えるためのもの
          (2026-08-09 オーナー実機「レシピカードの大きさがレシピ名の長さによって変わる」)。
          料理名の枠は RecipeCard 側で2行ぶんに固定してあるので通常はこれだけで揃うが、
          調理時間・手間・季節のバッジが2行に折り返す名前の長い組み合わせでも、
          行の高さが一番高いカードに揃うので「1枚だけ背が違う」状態にならない
          (バッジを隠して揃えるのではなく、揃えた高さの中に全部を出す) */}
      <div
        className={
          recipeListLayout === 'list'
            ? 'mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]'
            : 'mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)] [grid-auto-rows:1fr]'
        }
      >
        {results?.map(({ recipe, usedCount, wantedCount }) => {
          const selected = recipe.id != null && selectedIds.includes(recipe.id)
          return (
            <div
              key={recipe.id}
              // isolate: 選択モードでカードに重ねるボタン(下の z-10)の重ね順を、このカードの中だけの
              // 話に閉じ込める(2026-08-15 便GU・オーナー実機「複数選択している時に他のタブを押しても、
              // タブの下のレシピカードをクリックしてしまう」)。
              // 真因: 下部のタブナビは position:fixed だが z-index を持たない(auto)ため、
              // z-10 を持つこのボタンの方が上に描かれ、当たり判定もそちらが取っていた
              // (390px幅で実測: タブ5つのうち中心がカードに重なる4つで document.elementFromPoint が
              // タブではなくカードの選択ボタンを返し、タブを押しても移動せずカードが選ばれた)。
              // isolate を付けるとこの div が重ね合わせの文脈を作り、中の z-10 は外の帯と競わなくなる
              className="relative isolate"
              // 長押しで選択モードに入る(2026-08-02 便CT)。iOS Safariの長押しメニュー
              // (リンクのプレビュー・コピー)が割り込むと選択に入れないので、この一覧では出さない
              style={{ WebkitTouchCallout: 'none' }}
              onPointerDown={(e) => onCardPointerDown(e, recipe.id)}
              onPointerMove={onCardPointerMove}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onClickCapture={onCardClickCapture}
              onContextMenu={onCardContextMenu}
            >
              <RecipeCard
                recipe={recipe}
                // 設定に保存している表示形式('grid'|'list')を、共通カードの「密度」に写して渡す
                // (2026-08-18 便HN)。写し方は logic/cardDensity.ts の1か所だけに置く
                density={densityForListLayout(recipeListLayout)}
                ngIngredients={ngIngredients}
                subLabel={subLabelFor(usedCount, wantedCount)}
                inTodayList={todayRecipeIds.has(recipe.id!)}
                showQuickTime={quickOnly}
                nutrientBadgeText={nutrientBadgeTextFor(recipe.id)}
              />
              {/* 選択モード中はカード全面を選択ボタンで覆い、詳細への遷移の代わりに選択の
                  ON/OFFにする(カード自体は<Link>なので、覆って遷移させない方が確実)。
                  選択の印はカードの寸法を変えないよう角に重ねる(在庫チップと同じ作法) */}
              {selecting && recipe.id != null && (
                <button
                  type="button"
                  data-testid="select-card"
                  onClick={() => toggleSelected(recipe.id!)}
                  aria-pressed={selected}
                  aria-label={recipe.title}
                  className={`absolute inset-0 z-10 rounded-md border-2 ${
                    selected ? 'border-accent bg-accent/15' : 'border-transparent bg-transparent'
                  }`}
                >
                  {selected && (
                    <CheckCircle2
                      size={22}
                      className="absolute left-1 top-1 rounded-full bg-surface text-accent-ink"
                      aria-hidden
                    />
                  )}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* 新規登録ボタン（親指が届く右下に固定、下部の帯の上）。
          選択モード中は「消す」作業の最中なので出さない(誤タップで登録画面に飛ばない)。
          高さは実測した帯のぶんに追随させる（2026-08-11 便FN。固定の bottom-24 では
          タイマーの帯が2本出た時点で裏に隠れて押せなかった） */}
      {!selecting && (
        <Link
          to="/recipes/new"
          aria-label={ja.recipes.addRecipe}
          style={{ bottom: 'calc(var(--app-bottom-inset) + var(--space-sm))' }}
          className="fixed right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-md"
        >
          <Plus size={30} aria-hidden />
        </Link>
      )}

      {/* 選択モードの帯(2026-08-15 便GU → 2026-08-17 便HJで中身を1行にした)。

          便GUで解いた問題(そのまま維持): 抜ける操作が画面のいちばん上にしか無く、一覧を下まで
          送ってから選ぶと操作までが遠かった。＝一覧のどこまで送っても同じ場所に操作がある。

          便HJで解いた問題(オーナー実機「画面が小さいと、レシピ選択中に出る選択肢ボタンで
          画面の半分が見えなくなる」): 選んだ瞬間に「今日の献立に入れる」「書き出す」「削除」の
          3つが帯に積み上がり、375x667の実機では帯だけで画面の4割強(280px)を占めて、
          レシピのカードが1枚も丸ごと見えなくなっていた。
          帯に残すのは【いま何品選んでいるか】と【選び終わる】の1行だけにし、
          「どうするか」は窓(下の ChoiceDialog)の中で選ぶ。

          献立の「＋ 今日の献立を探す」から来たとき(selectingForToday)は行き先が決まっていて
          選ぶ道が1つしかないので、窓を挟まず決定ボタンをそのまま出す(2026-08-11 便FPのまま)。

          下端は他の帯(タブナビ・タイマー・新しい版のお知らせ)の上に積む(useStackedBottomOffset)。
          data-app-bottom-bar を付けてあるので、一覧の下余白(--app-bottom-inset)もこの帯を
          見込んだ高さに追随し、最後のカードが帯の裏に隠れない */}
      {selecting && (
        <div
          ref={selectionBarRef}
          data-app-bottom-bar
          data-testid="selection-bar"
          className="fixed inset-x-0 z-20 border-t border-edge bg-surface shadow-md"
          style={{ bottom: selectionBarBottom }}
        >
          <div className="mx-auto flex max-w-md flex-col gap-2 px-[var(--space-md)] py-[var(--space-sm)]">
            <div className="flex items-center justify-between gap-[var(--space-sm)]">
              <p className="min-w-0 flex-1 text-sm font-bold text-ink-muted">
                {selectedIds.length === 0
                  ? ja.recipes.selectingNone
                  : ja.recipes.selectingCount.replace('{n}', String(selectedIds.length))}
              </p>
              {selectingForToday ? (
                <button
                  type="button"
                  data-testid="selection-exit"
                  onClick={exitSelecting}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
                >
                  <X size={16} aria-hidden />
                  {ja.recipes.selectExitToMealPlan}
                </button>
              ) : (
                /* 選び終わって、選んだレシピをどうするかの窓を開く。1品も選んでいないうちは
                   決める中身が無いので押せない(抜けるのは見出し行の「選択をやめる」) */
                <button
                  type="button"
                  data-testid="selection-finish"
                  onClick={() => setActionsOpen(true)}
                  disabled={selectedIds.length === 0}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-4 py-2.5 font-bold text-on-accent shadow-sm disabled:opacity-40"
                >
                  {ja.recipes.selectFinish}
                  <ArrowRight size={18} aria-hidden />
                </button>
              )}
            </div>
            {/* まとめて今日の献立に入れる(2026-08-11 便FP)。献立から来たときは1品も選んで
                いなくても押せない見た目で出し続け、決定ボタンが無いまま迷子にならないようにする */}
            {selectingForToday && (
              <button
                type="button"
                data-testid="add-selected-to-today"
                onClick={() => setBulkSlotModalOpen(true)}
                disabled={selectedIds.length === 0 || addingToToday}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-2.5 font-bold text-on-accent shadow-sm disabled:opacity-40"
              >
                <CalendarPlus size={16} aria-hidden />
                {selectedIds.length === 0
                  ? ja.recipes.addSelectedToTodayEmpty
                  : ja.recipes.addSelectedToToday.replace('{r}', String(selectedIds.length))}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 選び終わったあとに出す「選んだ◯品をどうしますか？」の窓(2026-08-17 便HJ・オーナー実機
          「選択ボタン押下→レシピ選択→選択終了→複数のボタンからレシピをどうするのか選ぶ、
          という流れはどうか」)。

          見た目・閉じ方は確認の窓(ConfirmDialog・2026-08-15 便GWでアプリ全体34か所をそろえたもの)と
          同じ作法にそろえてある(components/dialogStyle.ts を共有)。新しい見た目は作らない。

          並びは書き出し→削除の順(取り出してから片づける流れ。押し間違いで削除に当たらないよう、
          消えない操作を上に置く。2026-08-09 便EM)。
          窓の外・Escapeで閉じたときは選んだレシピをそのまま残す＝押し間違えても選び直せる。
          下の「選択をやめる」は見出し行のボタンと同じ操作(選んだレシピを外して一覧に戻る)なので、
          名前も同じにしてある。

          2026-08-18 便HO(オーナー実機フィードバック「選択したレシピをどうするかの窓に、
          キャンセルで選択の続きに戻れるようにしたい。選択をやめる、で選択したレシピも
          リセットされてしまう」): 選んだレシピを残したまま閉じる道は便HJの時点でもあったが、
          窓の外のタップとEscapeにしか無く、押せる場所として見えていなかった。
          同じ道を「選択を続ける」のボタンとして「選択をやめる」の上に出す
          (backLabel は onClose を呼ぶので、3つの閉じ方の結果が食い違うことはない)。
          献立から来た選択モード(selectingForToday)はこの窓を出さないので、そちらは変わらない */}
      <ChoiceDialog
        open={actionsOpen && !selectingForToday}
        title={ja.recipes.selectActionsTitle.replace('{n}', String(selectedIds.length))}
        testId="selection-actions"
        options={[
          {
            label: ja.recipes.selectActionToToday,
            testId: 'selection-actions-today',
            icon: <CalendarPlus size={18} aria-hidden />,
            primary: true,
            disabled: addingToToday,
            onSelect: () => {
              setActionsOpen(false)
              setBulkSlotModalOpen(true)
            },
          },
          {
            label: ja.recipes.selectActionExport,
            testId: 'selection-actions-export',
            icon: <Download size={18} aria-hidden />,
            disabled: selectedExport.busy,
            onSelect: () => {
              setActionsOpen(false)
              selectedExport.start()
            },
          },
          {
            label: ja.recipes.selectActionDelete,
            testId: 'selection-actions-delete',
            icon: <Trash2 size={18} aria-hidden />,
            disabled: deleting,
            onSelect: () => {
              setActionsOpen(false)
              void deleteSelected()
            },
          },
        ]}
        backLabel={ja.recipes.selectContinue}
        backTestId="selection-actions-continue"
        cancelLabel={ja.recipes.selectExit}
        cancelTestId="selection-actions-cancel"
        onCancel={exitSelecting}
        onClose={() => setActionsOpen(false)}
      />
      {selectedExport.dialog}

      {/* まとめて入れるときの食事の振り分け窓。1品ずつのとき(レシピ詳細)と同じ部品・
          同じ選択肢を使い、見出しだけ品数の入るものに差し替える(2026-08-11 便FP) */}
      <TodaySlotModal
        open={bulkSlotModalOpen}
        title={ja.recipes.addSelectedToTodayDialogTitle.replace(
          '{n}',
          String(selectedIds.length),
        )}
        onPickSlot={(slot) => void addSelectedToToday(slot)}
        onPickUndecided={() => void addSelectedToToday()}
        onClose={() => setBulkSlotModalOpen(false)}
      />

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}
