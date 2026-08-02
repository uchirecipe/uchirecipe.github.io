import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
  ListChecks,
  CheckCircle2,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, deleteRecipes, countRecipesDeleteImpact } from '../db/recipes'
import { buildBulkDeleteConfirmText } from '../logic/recipeDelete'
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
  isFreeSortOption,
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_FIELD,
  type NutrientSortOption,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
import { isNutritionUnlocked, roundNutrient } from '../logic/nutrition'
import { countFreeLimitRecipes, isNearFreeLimit, freeLimitRemaining } from '../logic/freeLimit'
import { splitValues } from '../logic/textSplit'
import RecipeCard from '../components/RecipeCard'
import ChipInput from '../components/ChipInput'
import Toast from '../components/Toast'
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
  // ホーム画面から ?q=... / ?ing=... 付きで来たときは、その条件で開く。
  // どちらも無ければ（詳細から戻ってきた等の「素の /recipes」）sessionStorageの保存値から復元する
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  // ホームの「レシピを探す」ショートカットからの遷移(2026-08-02 オーナー実機FB)。
  // ?focus=search = 検索欄にフォーカスした状態で開く / ?pantry=1 = 「在庫の食材で絞る」をONで開く。
  // どちらも「明示的な新規検索」なので、?q=・?ing= と同じくsessionStorageの保存状態は復元しない
  // (前回の検索語が残ったまま検索欄にフォーカスすると、何を打てばいいのか分からなくなるため)。
  // 初回マウント時のURLだけを見る(下のURL同期でパラメータを消すので、以後は再発火しない)
  const [entry] = useState(() => ({
    focusSearch: searchParams.get('focus') === 'search',
    pantry: searchParams.get('pantry') === '1',
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
        // ホームからの一度きりの指示(2026-08-02)はURLに残さない。残すと、詳細から戻るたびに
        // 検索欄へフォーカスが飛んだり在庫の絞り込みが復活したりする
        next.delete('focus')
        next.delete('pantry')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, ingredients])

  // ホームの「レシピを探す」から来たときだけ検索欄にフォーカスする(2026-08-02)。
  // 初回マウント時に1回だけ。スマホではここでキーボードが開き、すぐ打ち始められる
  useEffect(() => {
    if (!entry.focusSearch) return
    searchInputRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [time, setTime] = useState<TimeFilter>(saved?.time ?? 'all')
  const [effort, setEffort] = useState<EffortFilter>(saved?.effort ?? 'all')
  const [tag, setTag] = useState<TagFilter>(saved?.tag ?? 'all')
  const [favoriteOnly, setFavoriteOnly] = useState(saved?.favoriteOnly ?? false)
  const [excludeNg, setExcludeNg] = useState(saved?.excludeNg ?? false)
  const [quickOnly, setQuickOnly] = useState(saved?.quickOnly ?? false)
  // 在庫(ある/少ない)の食材を使うレシピだけに絞る(2026-07-24 便BN・司令部追加)。
  // ホームの「在庫の食材から探す」(?pantry=1)から来たときは最初からONで開く(2026-08-02)
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
      pantryOnly,
      pantryNames,
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
    favoriteOnly ||
    excludeNg ||
    quickOnly ||
    pantryOnly
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
  const [selecting, setSelecting] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)

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
    }
  }, [selecting, recipes])

  const toggleSelecting = () => {
    setSelecting((v) => !v)
    setSelectedIds([])
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
      if (!window.confirm(buildBulkDeleteConfirmText(impact))) return
      const removed = await deleteRecipes(selectedIds)
      setSelectedIds([])
      setMessage(ja.recipes.bulkDeletedToast.replace('{r}', String(removed)))
    } finally {
      setDeleting(false)
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
    setFavoriteOnly(false)
    setExcludeNg(false)
    setQuickOnly(false)
    setPantryOnly(false)
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
      {/* 見出し行に選択モードの出入り口を置く(食材の在庫の「整理」ボタンと同じ位置づけ)。
          レシピが1品も無いうちは選ぶものが無いので出さない */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{ja.recipes.title}</h1>
        {recipes && recipes.length > 0 && (
          <button
            type="button"
            onClick={toggleSelecting}
            aria-pressed={selecting}
            className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
              selecting ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            <ListChecks size={14} aria-hidden />
            {selecting ? ja.recipes.selectDone : ja.recipes.selectToggle}
          </button>
        )}
      </div>

      {recipes && isNearFreeLimit(countFreeLimitRecipes(recipes), !!settings?.proCode) && (
        <p className="mt-[var(--space-sm)] rounded-sm bg-surface px-3 py-2 text-sm text-ink-muted">
          {ja.recipes.freeLimitNearBanner.replace(
            '{n}',
            String(freeLimitRemaining(countFreeLimitRecipes(recipes))),
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

          {/* 昇順/降順(2026-08-02 オーナー指示・便DF: 件数表記の横に常設していた独立ボタンを
              やめ、並べ替えパネルの中に入れた)。上で選んだ並べ替えの向きを変えるものなので、
              選択肢のすぐ下・決定ボタンの上に置く */}
          <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
            {ja.search.sortDirectionTitle}
          </p>
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
              className="text-sm font-bold text-accent-ink underline"
            >
              {ja.search.clear}
            </button>
          )}

          {/* よく使うタグ(2026-07-24 便BN・タスク3: 絞り込みパネルの上部へ移動。よく使う「作り置き・
              お弁当」の切替を最初に見せる) */}
          <p
            className={`text-sm font-bold text-ink-muted ${anyConditionActive ? 'mt-[var(--space-md)]' : ''}`}
          >
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
            {/* 在庫の食材で絞る(2026-07-24 便BN・司令部追加)。在庫(ある/少ない)が1件以上あるときだけ出す */}
            {pantryNames.length > 0 && (
              <button
                type="button"
                onClick={() => setPantryOnly((v) => !v)}
                aria-pressed={pantryOnly}
                className={`inline-flex items-center gap-1 ${chipCls(pantryOnly)}`}
              >
                <Refrigerator size={16} aria-hidden />
                {ja.search.pantryFilter}
              </button>
            )}
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
              <p className="mt-1 text-sm">{ja.recipes.emptyHint}</p>
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

      {/* 選択モードの操作パネル(2026-08-02 便CT)。食材の在庫の整理モードと同じ並びで、
          案内文→全選択/選択解除→「選択したレシピ◯品を削除」をカードのすぐ上に置く
          (下までスクロールしなくても全選択・削除に手が届くように) */}
      {selecting && results && results.length > 0 && (
        <div className="mt-[var(--space-sm)] flex flex-col gap-2">
          <p className="text-sm text-ink-muted">{ja.recipes.selectHint}</p>
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
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void deleteSelected()}
              disabled={deleting}
              className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              {ja.recipes.deleteSelected.replace('{r}', String(selectedIds.length))}
            </button>
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
        {results?.map(({ recipe, usedCount, wantedCount }) => {
          const selected = recipe.id != null && selectedIds.includes(recipe.id)
          return (
            <div
              key={recipe.id}
              className="relative"
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
                layout={recipeListLayout}
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

      {/* 新規登録ボタン（親指が届く右下に固定、タブナビの上）。
          選択モード中は「消す」作業の最中なので出さない(誤タップで登録画面に飛ばない) */}
      {!selecting && (
        <Link
          to="/recipes/new"
          aria-label={ja.recipes.addRecipe}
          className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-md"
        >
          <Plus size={30} aria-hidden />
        </Link>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}
