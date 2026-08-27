import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChefHat,
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  X,
  Plus,
  Minus,
  CheckCircle2,
  CheckCheck,
  HelpCircle,
  ArrowDownUp,
  SlidersHorizontal,
} from 'lucide-react'
import Collapse from '../components/Collapse'
import SwapLabel from '../components/SwapLabel'
import { listRecipes } from '../db/recipes'
import { updateSettings, useSettings } from '../db/settings'
import { usePantryItems } from '../db/pantry'
import { pantryHaveNames, pantryAvailableNames } from '../logic/pantry'
import {
  useShoppingItems,
  addShoppingItem,
  addConfirmedItems,
  toggleShoppingChecked,
  setAllShoppingChecked,
  removeShoppingItem,
  restoreShoppingItem,
  completeShopping,
} from '../db/shopping'
import {
  buildShoppingCandidates,
  groupShoppingByAisle,
  resolveShoppingSources,
  parseRecipeIdsParam,
  parseServingsParam,
  splitCheckedShoppingItems,
  type ShoppingCandidate,
  type ShoppingSourceResult,
} from '../logic/shopping'
import {
  sortResults,
  defaultSortDirection,
  buildNutrientSortValues,
  buildCostSortValues,
  isNutrientSortOption,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
import {
  searchRecipes,
  searchMatchSummary,
  splitTerms,
  tagChipOptions,
  savedTagChipOptions,
  MATCH_WORD_LIMIT,
  TAG_CHIP_LIMIT,
} from '../logic/search'
// レシピ一覧と同じ並び替え／絞り込みのパネル（2026-08-27 便LM が共有部品に切り出したもの）
import RecipeSortPanel from '../components/RecipeSortPanel'
import RecipeFilterPanel, {
  EMPTY_RECIPE_FILTER_VALUES,
  type RecipeFilterValues,
} from '../components/RecipeFilterPanel'
import { usePanelMaxHeight, useOutsidePanelClose } from '../components/recipePanelParts'
import SearchMatchDialog from '../components/SearchMatchDialog'
import { isNutritionUnlocked } from '../logic/nutrition'
import { usePriceEntries } from '../db/prices'
import { buildPriceIndex } from '../logic/priceEstimate'
import { savedSearchesWithout, buildSavedSearchRemoveConfirm } from '../logic/tagRegister'
import type { Ingredient, Recipe, ShoppingItem } from '../db/types'
import PantryBoard from '../components/PantryBoard'
import RecipeCard from '../components/RecipeCard'
import Toast from '../components/Toast'
import { useConfirm } from '../components/ConfirmProvider'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { lockedScrollY, useScrollLock } from '../components/useScrollLock'
import { resolveBackTarget, settingsLinkWithBack } from '../logic/backLink'
// 設定の「Pro版について見る」から帰ってきたときに、離れる前の縦位置へ戻す（2026-08-27 便LU）
import { useScreenReturn, useSettingsDetour } from '../components/useScreenReturn'
import {
  SHOPPING_RETURN_KEY,
  WEEK_RETURN_PARAM,
  forgetRecipesTabPath,
  parseShoppingReturn,
  readSessionItem,
  removeSessionItem,
  serializeShoppingReturn,
  writeSessionItem,
  type ShoppingReturnPoint,
} from '../logic/navMemory'
import { ja } from '../i18n/ja'

type CandidateRow = ShoppingCandidate & { checked: boolean }

type ShoppingTab = 'pantry' | 'memo'

/**
 * 買い物メモの「食材の窓」からレシピ詳細を開くときに持ち回る出所（2026-08-25 便KU）。
 * 詳細画面の「戻る」は、献立の週・月と同じ例外としてここへ帰る（RecipeDetailPage）。
 * `restore=1` が付いているときだけ、買い物メモは覚えたタブ・食材の窓・縦位置を戻す。
 */
const SHOPPING_RETURN_LINK_STATE = {
  from: 'shopping',
  fromPath: `/shopping?${WEEK_RETURN_PARAM}=1`,
} as const

/**
 * 買い物メモの下書きの保存先（2026-07-29 便CC/C2）。
 *
 * 従来はコンポーネントのstateだけだったため、他のページへ移動・リロード・「キャンセル」で
 * 手で直した分量ごと無警告で消えていた（QA S2。「下書き」という名前が実装と食い違っていた）。
 * レシピの書きかけと同じ作法に揃える＝localStorage に「保存した時刻＋中身」で持ち、
 * 期限を過ぎた古い下書きは読まずに捨てる（sessionStorage はホーム画面PWAでOSがタブを
 * 破棄すると消えるため使わない。2026-07-28 便BW/C-16で却下済み）。
 * 期限はレシピの書きかけと同じ7日（買い物は当日〜数日の行動なので十分に長い）。
 */
const SHOPPING_DRAFT_KEY = 'uchirecipe:draft:shopping'
const SHOPPING_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type ShoppingDraft = {
  candidates: CandidateRow[]
  lastPickerCounts: Record<number, number>
  /**
   * 献立から作った下書きの「どの範囲から作ったか」（2026-08-08 便EA）。
   * 献立の週タブが組み立てた1行をそのまま持つ。レシピを手で選んで作った下書きには無い。
   */
  rangeLabel?: string
  /**
   * 下書きを作った画面へ帰る道（2026-08-27 便LU・オーナー原文
   * 「下書き画面から直前の画面まで戻ってくる手段がない。」）。
   * 献立の週タブが載せてきた `?back=` をそのまま持つ。下書きと一緒に残すのは、
   * 読み込み直しても帰り道が消えないようにするため（下書きは7日間残る）。
   * レシピを手で選んで作った下書きには無い＝そのときは押したボタンのすぐ下に下書きが出る。
   */
  backTo?: string
}

function readShoppingDraft(): ShoppingDraft | null {
  try {
    const raw = localStorage.getItem(SHOPPING_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: unknown; draft?: unknown }
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
    if (Date.now() - savedAt > SHOPPING_DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(SHOPPING_DRAFT_KEY)
      return null
    }
    if (typeof parsed.draft !== 'string') return null
    const draft = JSON.parse(parsed.draft) as Partial<ShoppingDraft>
    if (!Array.isArray(draft.candidates) || draft.candidates.length === 0) return null
    return {
      candidates: draft.candidates,
      lastPickerCounts:
        draft.lastPickerCounts && typeof draft.lastPickerCounts === 'object'
          ? draft.lastPickerCounts
          : {},
      rangeLabel: typeof draft.rangeLabel === 'string' ? draft.rangeLabel : undefined,
      backTo: typeof draft.backTo === 'string' ? draft.backTo : undefined,
    }
  } catch {
    return null
  }
}

function writeShoppingDraft(draft: ShoppingDraft): void {
  try {
    localStorage.setItem(
      SHOPPING_DRAFT_KEY,
      JSON.stringify({ savedAt: Date.now(), draft: JSON.stringify(draft) }),
    )
  } catch {
    /* 保存領域の容量超過などは黙って諦める(画面上の下書きは失われない) */
  }
}

function clearShoppingDraft(): void {
  try {
    localStorage.removeItem(SHOPPING_DRAFT_KEY)
  } catch {
    /* 無視 */
  }
}

/* レシピを選ぶ画面の並び替えの顔ぶれは、2026-08-27 便LN で
   components/RecipeSortPanel.tsx（レシピ一覧と同じパネル）に一本化した。
   それまでは無料で使える4種だけを並べたプルダウンをこの画面が自前で持っていた */

/** 食材タブ: 「食材の在庫」（在庫ボード）／「買い物メモ」（レシピからの候補づくり＋確定した
 * 買い物メモ）の2タブ構成(2026-07-16 UI総点検B-9: 買い物メモが最上部を占有しヘビーユーザーの
 * 壁になっていた所見への対応)。既定タブは「食材の在庫」。タブ状態はページローカルで保存しない */
export default function ShoppingPage() {
  const confirm = useConfirm()
  // 保存してある下書きを初回描画時に1度だけ読む(2026-07-29 便CC/C2)。
  // 期限切れはここで破棄される。競合する入力状態が無いので「復元しますか？」は出さず黙って戻す
  const [restoredDraft] = useState(readShoppingDraft)
  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const pantryItems = usePantryItems()
  const haveNames = useMemo(() => pantryHaveNames(pantryItems ?? []), [pantryItems])
  // ピッカーの「在庫で作れる順」用(「ある」「少ない」を在庫ありとみなす。在庫一致順の既存定義に合わせる)
  const availableNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  const shoppingItems = useShoppingItems()
  // 下書きが残っていたら、それが見える「買い物メモ」タブで迎える(既定は「食材の在庫」)
  const [activeTab, setActiveTab] = useState<ShoppingTab>(restoredDraft ? 'memo' : 'pantry')

  // 操作結果のトースト(2026-07-23 #4/#9。既存のToast+setMessageパターンを流用)
  const [message, setMessage] = useState('')
  // ✕で消した項目の取り消し(2026-07-29 便CC/C19)。次のトーストが出たら取り消しは無効にする
  const [undoRemoved, setUndoRemoved] = useState<ShoppingItem | null>(null)
  const showToast = (text: string) => {
    setUndoRemoved(null)
    setMessage(text)
  }

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // recipeId → レシピ(名前と材料)。食材名タップの出所の小窓に使う。
  // 材料まで持つのは、出所の分量を持たない古い行でレシピの材料欄から読み直すため
  // (2026-07-24 実機FB #10 → 2026-08-08 オーナー実機フィードバック②で買い物メモにも拡張)
  const recipeById = useMemo(() => {
    const map = new Map<number, { title: string; ingredients: Ingredient[] }>()
    for (const r of recipes ?? []) {
      if (r.id != null) map.set(r.id, { title: r.title, ingredients: r.ingredients })
    }
    return map
  }, [recipes])

  // recipeId → レシピそのもの。出所の小窓の行を共通のレシピカードで描くために使う
  // （2026-08-19 便HW。上の recipeById は名前と材料だけの軽い写しなのでカードには渡せない）
  const fullRecipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    for (const r of recipes ?? []) {
      if (r.id != null) map.set(r.id, r)
    }
    return map
  }, [recipes])

  // レシピ選択ピッカー
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerSort, setPickerSort] = useState<RecipeSortOption>('updated')
  const [pickerSortDirection, setPickerSortDirection] = useState<SortDirection>(
    defaultSortDirection.updated,
  )
  /**
   * 絞り込みの条件（2026-08-27 便LN・オーナー原文「レシピから追加のレシピ選択画面は、
   * 検索と絞り込み、並び替えの使い勝手をレシピタブと同じにしたい」）。
   *
   * レシピ一覧は条件を1つずつ useState で持ち、そのまま sessionStorage への保存・
   * URLへの反映・復元に使っている。この画面は**開くたびに何も絞っていない状態から始める**ので、
   * その持ち回りは要らない＝共有部品が受け取る形（RecipeFilterValues）のまま1本で持つ。
   * 検索まどの言葉と同じで、窓を開くたびに初期値へ戻す（前に選んだ条件が残っていると、
   * 「レシピが出てこない」の原因が窓の外から読めなくなる）
   */
  const [pickerFilters, setPickerFilters] = useState<RecipeFilterValues>(EMPTY_RECIPE_FILTER_VALUES)
  const setPickerFilterValues = (patch: Partial<RecipeFilterValues>) => {
    setPickerFilters((prev) => ({ ...prev, ...patch }))
  }
  // 並び替え／絞り込みパネルの開閉（レシピ一覧と同じで、片方を開くともう片方は閉じる）
  const [pickerSortPanelOpen, setPickerSortPanelOpen] = useState(false)
  const [pickerFilterPanelOpen, setPickerFilterPanelOpen] = useState(false)
  const togglePickerSortPanel = () => {
    setPickerSortPanelOpen((open) => !open)
    setPickerFilterPanelOpen(false)
  }
  const togglePickerFilterPanel = () => {
    setPickerFilterPanelOpen((open) => !open)
    setPickerSortPanelOpen(false)
  }
  const closePickerPanels = () => {
    setPickerSortPanelOpen(false)
    setPickerFilterPanelOpen(false)
  }
  const pickerPanelOpen = pickerSortPanelOpen || pickerFilterPanelOpen
  /** 検索まどの帯（パネルの上端）と、下の「下書きを作る」の帯（パネルの下端）。高さの上限を実測する */
  const pickerBarRef = useRef<HTMLDivElement>(null)
  const pickerFooterRef = useRef<HTMLDivElement>(null)
  const pickerPanelWrapRef = useRef<HTMLDivElement>(null)
  const pickerPanelMaxHeight = usePanelMaxHeight(pickerPanelOpen, pickerBarRef, pickerFooterRef)
  useOutsidePanelClose(pickerPanelOpen, pickerPanelWrapRef, closePickerPanels)
  // 食数の+/-方式(2026-07-23 #3): recipeId → 食数。1食以上で「選択」扱い(既定0=未選択)
  const [pickerCounts, setPickerCounts] = useState<Record<number, number>>({})
  // 直前のレシピ選択(食数)を覚えておき、「レシピを選び直す」でそのまま復元する(2026-07-24 実機FB #8)
  const [lastPickerCounts, setLastPickerCounts] = useState<Record<number, number>>(
    restoredDraft?.lastPickerCounts ?? {},
  )

  /**
   * 栄養の並び替えが使えるか（2026-08-01 線引きB'）。無料はカロリー順まで・8項目はPro。
   * レシピ一覧とまったく同じ判定を使う＝画面によって選べる並びが違う、ということが起きない
   */
  const pickerNutritionUnlocked = isNutritionUnlocked(!!settings?.proCode)
  // 栄養順・原価順を選んでいるあいだだけ、全レシピ分の値をまとめて1回計算する（レシピ一覧と同じ作り）
  const pickerNutrientSortValues = useMemo(() => {
    if (!recipes || !pickerOpen || !isNutrientSortOption(pickerSort)) return undefined
    return buildNutrientSortValues(recipes)
  }, [recipes, pickerOpen, pickerSort])
  const priceEntries = usePriceEntries()
  const pickerCostSortValues = useMemo(() => {
    if (!recipes || !pickerOpen || pickerSort !== 'cost') return undefined
    return buildCostSortValues(recipes, buildPriceIndex(priceEntries ?? []))
  }, [recipes, pickerOpen, pickerSort, priceEntries])

  /**
   * 選択画面に並べるレシピ（2026-08-27 便LN）。
   * 検索は logic/search.ts の searchRecipes をそのまま使う＝レシピタブと同じ当たり方
   * （かなの正規化・別名・材料/手順/メモ/タグまで見る）。この画面だけの検索は持たない
   */
  const pickerResults = useMemo(
    () =>
      sortResults(
        searchRecipes(visibleRecipes, {
          query: pickerQuery,
          ingredients: pickerFilters.ingredients.join(' '),
          time: pickerFilters.time,
          effort: pickerFilters.effort,
          tags: pickerFilters.tags,
          keywords: pickerFilters.keywords,
          tagMatch: pickerFilters.tagMatch,
          dishTypes: pickerFilters.dishTypes,
          favoriteOnly: pickerFilters.favoriteOnly,
          excludeNg: pickerFilters.excludeNg,
          quickOnly: pickerFilters.quickOnly,
          pantryOnly: pickerFilters.pantryOnly,
          pantryNames: availableNames,
          ngIngredients: settings?.ngIngredients ?? [],
        }),
        pickerSort,
        availableNames,
        pickerSortDirection,
        pickerNutrientSortValues,
        pickerCostSortValues,
      ),
    [
      visibleRecipes,
      pickerQuery,
      pickerFilters,
      availableNames,
      settings?.ngIngredients,
      pickerSort,
      pickerSortDirection,
      pickerNutrientSortValues,
      pickerCostSortValues,
    ],
  )
  const filteredRecipes = useMemo(() => pickerResults.map((r) => r.recipe), [pickerResults])

  /**
   * 検索まどに打った言葉が、レシピのどこに一致したか（2026-08-20 便IH・②）。
   * 数える相手はいま並んでいる品そのものなので、画面の数字と並びが食い違わない
   */
  const pickerQueryTerms = useMemo(() => splitTerms(pickerQuery), [pickerQuery])
  const pickerMatchSummary = useMemo(
    () => searchMatchSummary(filteredRecipes, pickerQueryTerms, MATCH_WORD_LIMIT),
    [filteredRecipes, pickerQueryTerms],
  )
  const [pickerMatchOpen, setPickerMatchOpen] = useState(false)
  useEffect(() => {
    if (pickerMatchSummary.rows.length === 0) setPickerMatchOpen(false)
  }, [pickerMatchSummary])

  /** 絞り込みのタグのチップ。数え方はレシピ一覧と同じ1か所（logic/search.ts） */
  const savedSearches = useMemo(() => settings?.savedSearches ?? [], [settings?.savedSearches])
  const pickerTagOptions = useMemo(
    () => tagChipOptions(visibleRecipes, pickerFilters.tags, TAG_CHIP_LIMIT),
    [visibleRecipes, pickerFilters.tags],
  )
  const pickerSavedTagOptions = useMemo(
    () => savedTagChipOptions(visibleRecipes, savedSearches),
    [visibleRecipes, savedSearches],
  )
  const [tagBusy, setTagBusy] = useState(false)
  /**
   * 自分で登録したタグを消す（レシピ一覧の同じチップと同じ操作）。
   * 消えるのは絞り込みに並ぶタグだけで、レシピは1品も変わらない（規約Fで両方書く＝共通の窓を使う）
   */
  const removeSavedSearch = async (name: string) => {
    if (tagBusy) return
    setTagBusy(true)
    try {
      const ok = await confirm(
        buildSavedSearchRemoveConfirm({ name, recipeCount: recipes?.length ?? 0 }),
      )
      if (!ok) return
      await updateSettings({ savedSearches: savedSearchesWithout(settings?.savedSearches, name) })
      // そのタグで絞り込んでいたら外す（押して外すチップごと消えるため）
      setPickerFilters((prev) => ({
        ...prev,
        keywords: prev.keywords.filter((value) => value !== name),
      }))
      showToast(ja.search.savedSearchRemovedToast.replace('{name}', name))
    } finally {
      setTagBusy(false)
    }
  }

  // 2026-07-16 便T-1と同じ分け方: 絞り込みが効いているか／並び替えが既定から動いているか
  const pickerFilterActive =
    pickerQuery !== '' ||
    pickerFilters.ingredients.length > 0 ||
    pickerFilters.time !== 'all' ||
    pickerFilters.effort !== 'all' ||
    pickerFilters.tags.length > 0 ||
    pickerFilters.keywords.length > 0 ||
    pickerFilters.dishTypes.length > 0 ||
    pickerFilters.favoriteOnly ||
    pickerFilters.excludeNg ||
    pickerFilters.quickOnly ||
    pickerFilters.pantryOnly
  const pickerSortActive =
    pickerSort !== 'updated' || pickerSortDirection !== defaultSortDirection[pickerSort]
  const pickerAnyConditionActive =
    pickerFilterActive || pickerSortActive || (settings?.hideStarters ?? false)
  const clearPickerFilters = () => {
    setPickerQuery('')
    setPickerFilters(EMPTY_RECIPE_FILTER_VALUES)
    setPickerSort('updated')
    setPickerSortDirection(defaultSortDirection.updated)
    // 「自分で登録したレシピのみ」も一緒に戻す（2026-08-03 オーナー指示。レシピ一覧と同じ）
    if (settings?.hideStarters) void updateSettings({ hideStarters: false })
  }
  /** 窓を開くたびに、検索・絞り込み・並び替えを何も掛けていない状態へ戻す */
  const resetPickerConditions = () => {
    setPickerQuery('')
    setPickerFilters(EMPTY_RECIPE_FILTER_VALUES)
    setPickerSort('updated')
    setPickerSortDirection(defaultSortDirection.updated)
    closePickerPanels()
    setPickerMatchOpen(false)
  }

  const setCount = (id: number, next: number) => {
    setPickerCounts((prev) => ({ ...prev, [id]: Math.max(0, next) }))
  }
  const selectedRecipeCount = useMemo(
    () => Object.values(pickerCounts).filter((n) => n >= 1).length,
    [pickerCounts],
  )

  const openPicker = () => {
    setPickerCounts({})
    resetPickerConditions()
    setPickerOpen(true)
  }
  // レシピを選び直す(2026-07-24 実機FB #8): 直前の選択(食数)を保ったままピッカーを開き直す。
  // 下書き自体は消さず、「下書きを作る」を再度押したときに作り直す
  const repickRecipes = () => {
    setPickerCounts(lastPickerCounts)
    resetPickerConditions()
    setPickerOpen(true)
  }

  // 買い物候補（下書き。確定するまでDBには保存しない。画面を離れても消えないよう
  // localStorageに保存する＝2026-07-29 便CC/C2）
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(restoredDraft?.candidates ?? null)
  // 下書きが0行になった理由が「選んだレシピに材料が1件も無い」かどうか（2026-08-22 便IX）。
  // 手書きの「冷蔵庫のあまりもの炒め」のように料理名と手順だけのレシピを選ぶと0行になるが、
  // 従来はどの場合も「食材の在庫で『ある』に登録済みのようです」と出ていた＝事実と違う。
  // 判定は下書きを作ったときの選択（lastPickerCounts）から引く＝下書きに新しい保存項目を足さない
  const draftHasNoIngredients = useMemo(() => {
    if (!recipes) return false
    const picked = Object.entries(lastPickerCounts)
      .filter(([, count]) => count >= 1)
      .map(([id]) => recipes.find((r) => r.id === Number(id)))
      .filter((r): r is (typeof recipes)[number] => r != null)
    return picked.length > 0 && picked.every((r) => r.ingredients.length === 0)
  }, [recipes, lastPickerCounts])
  // どの範囲の献立から作った下書きか(2026-08-08 便EA)。献立から来たときだけ入る
  const [candidateRangeLabel, setCandidateRangeLabel] = useState<string | undefined>(
    restoredDraft?.rangeLabel,
  )
  /**
   * 下書きを作った画面への帰り道（2026-08-27 便LU）。献立の「買い物メモを作る」が
   * `?back=` で渡してくる。読み込み直しても消えないよう、下書きと一緒に持つ。
   * 行き先の名前は logic/backLink.ts が決める＝設定画面の「◯◯に戻る」と同じ道具。
   */
  const [candidateBackTo, setCandidateBackTo] = useState<string | undefined>(
    restoredDraft?.backTo,
  )
  const candidateBackTarget = useMemo(
    () => resolveBackTarget(candidateBackTo),
    [candidateBackTo],
  )
  // 生成した下書きへ自動スクロールする(2026-07-24 実機FB #13)。候補がDOMに乗ってから実行するため
  // フラグ+useEffectで1テンポ遅らせる
  const candidatesRef = useRef<HTMLElement>(null)
  const [scrollToCandidates, setScrollToCandidates] = useState(false)
  // 食材名タップで出す「全文＋出所のレシピ」ポップ。下書き(2026-07-24 実機FB #10)に加え、
  // 確定した買い物メモの行からも開けるようにした(2026-08-08 オーナー実機フィードバック②)。
  // 開くときに出所を解決して持たせる＝下書き/メモのどちらから開いても同じ見た目になる
  const [namePopup, setNamePopup] = useState<
    ({ name: string; kind: 'draft' | 'memo' } & ShoppingSourceResult) | null
  >(null)
  const openSourcePopup = (
    kind: 'draft' | 'memo',
    item: {
      name: string
      sources?: readonly { recipeId: number; amount?: string }[]
      recipeIds?: readonly number[]
      manualAdded?: boolean
    },
  ) => {
    setNamePopup({ name: item.name, kind, ...resolveShoppingSources(item, recipeById) })
  }
  /**
   * 食材の窓の中のレシピからレシピ詳細へ移る直前に、帰り道を覚える（2026-08-25 便KU・
   * オーナー原文「材料→窓のレシピ→レシピ詳細→戻る→買い物メモの窓まで戻して表示」）。
   * 覚えるのは「どのタブの・どの食材の窓か」と縦位置だけ（窓の中身は帰ってから作り直す）。
   * 窓は閉じない＝離れる時点の画面をそのまま覚えておき、帰ってきたら同じ形に開き直す。
   */
  const rememberSourcePopupReturn = () => {
    if (!namePopup) return
    writeSessionItem(
      SHOPPING_RETURN_KEY,
      serializeShoppingReturn({
        tab: activeTab,
        kind: namePopup.kind,
        name: namePopup.name,
        // 窓が開いているあいだ後ろの画面は固定してある（useScrollLock）ので、
        // window.scrollY ではなく固定する前に控えた位置を読む必要がある。
        // body に当てている top（-位置px）がその値そのものなので、そこから戻す
        scrollY: lockedScrollY(),
      }),
    )
  }

  // 献立プランナーの「この週の買い物リストを作る」から来た場合（?recipeIds=1x2,3）は
  // ピッカーを介さず自動で候補を作る。
  // 2026-07-29 便CC/C10: 従来は献立に同じ料理が何回入っていても1回分（scale=1固定）でしか
  // 計算せず、週に2回作る料理の材料が足りない量で出ていた。「1x2」=その週に2回ぶん、として
  // 回数を倍率に使う。C18: 渡ったレシピが1件も見つからないときは無言で終わらず理由を出す
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  // 下書きの「◯◯に戻る」で、作った画面へ帰る(2026-08-27 便LU)
  const navigate = useNavigate()
  /**
   * レシピを選ぶ窓の並び替えパネルにあるPro案内から、設定へ寄り道して帰ってくる道
   * （2026-08-27 便LU）。窓が開いているあいだ後ろの画面は固定してあるので、
   * 覚える縦位置は window.scrollY ではなく固定する前に控えた位置を渡す（lockedScrollY）。
   */
  const { linkTo: detourLinkTo, remember: rememberDetour } = useSettingsDetour()
  useScreenReturn()
  useEffect(() => {
    const raw = searchParams.get('recipeIds')
    if (raw == null || !recipes) return
    const requested = parseRecipeIdsParam(raw)
    // 献立で枠ごとに決めた食数の合計(2026-08-03 便DJ)。無ければ従来どおり
    // 「回数 × レシピの登録人数」で数える(食数を1つも触っていない献立では同じ値になる)
    const servingsParam = searchParams.get('servings')
    const servingsById = servingsParam ? parseServingsParam(servingsParam) : null
    const chosen = requested
      .map(({ id, times }) => ({ recipe: recipes.find((r) => r.id === id), times }))
      .filter((x): x is { recipe: (typeof recipes)[number]; times: number } => x.recipe != null)
      .map(({ recipe, times }) => {
        const base = recipe.servings > 0 ? recipe.servings : 1
        const totalServings = servingsById?.get(recipe.id!) ?? base * times
        return { recipe, totalServings, scale: totalServings / base }
      })
    if (chosen.length > 0) {
      const built = buildShoppingCandidates(
        chosen.map(({ recipe, scale }) => ({
          id: recipe.id!,
          ingredients: recipe.ingredients,
          scale,
        })),
        haveNames,
      )
      setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
      // どの範囲の献立から作ったか(2026-08-08 便EA)。献立側が組み立てた1行をそのまま出す
      setCandidateRangeLabel(searchParams.get('range') ?? undefined)
      // 作った画面へ帰る道と、いま何が起きたのかの案内(2026-08-27 便LU)。
      // 画面が入れ替わっただけでは、下書きができたことも次に押すものも分からない
      setCandidateBackTo(searchParams.get('back') ?? undefined)
      showToast(ja.shopping.fromMealPlanDraftToast)
      // 「レシピを選び直す」で復元できるよう選択を覚えておく(#8)。献立由来は
      // 献立で決めた食数の合計(未設定なら「登録人数 × 献立に入っている回数」)を初期の食数にする
      setLastPickerCounts(
        Object.fromEntries(chosen.map(({ recipe, totalServings }) => [recipe.id!, totalServings])),
      )
      // 献立プランナーの「この週の買い物リストを作る」から来た場合は、候補が乗る
      // 「買い物メモ」タブを開いた状態で迎える(在庫タブのまま候補が見えない事故を防ぐ)
      setActiveTab('memo')
    } else if (requested.length > 0) {
      showToast(ja.shopping.fromMealPlanNotFoundToast)
    }
    // 値が空(?recipeIds=)でもURLからは必ず消す(従来は早期returnでパラメータが残り続けていた)。
    // 食数(?servings=)も対で消す
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('recipeIds')
        next.delete('servings')
        next.delete('range')
        next.delete('back')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, searchParams])

  // 下書きの保存/破棄(2026-07-29 便CC/C2)。画面を離れてもリロードしても残るようにする。
  // 確定・キャンセルで candidates が null になったら保存も消す
  useEffect(() => {
    if (candidates && candidates.length > 0)
      writeShoppingDraft({
        candidates,
        lastPickerCounts,
        rangeLabel: candidateRangeLabel,
        backTo: candidateBackTo,
      })
    else clearShoppingDraft()
  }, [candidates, lastPickerCounts, candidateRangeLabel, candidateBackTo])

  const makeCandidates = async () => {
    // 既に下書きがあるときの作り直しは、手で直した分量が自動計算に戻るので先に一言確認する
    // (2026-07-29 便CC/C2。規約F=何が消えて何が残るかを両方書く)
    if (candidates && candidates.length > 0) {
      const ok = await confirm({
        title: ja.shopping.remakeConfirmTitle.replace('{n}', String(candidates.length)),
        body: ja.shopping.remakeConfirm,
        confirmLabel: ja.shopping.remakeConfirmOk,
      })
      if (!ok) return
    }
    // 食数≥1のレシピだけを対象にし、指定食数で分量をスケールする(scale=食数÷登録人数。2026-07-23 #3)
    const chosen = visibleRecipes
      .filter((r) => (pickerCounts[r.id!] ?? 0) >= 1)
      .map((r) => ({
        id: r.id!,
        ingredients: r.ingredients,
        scale: (pickerCounts[r.id!] ?? r.servings) / (r.servings > 0 ? r.servings : 1),
      }))
    const built = buildShoppingCandidates(chosen, haveNames)
    setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
    // 手でレシピを選び直した下書きなので、献立から来た「範囲」の1行は外す(嘘になるため)
    setCandidateRangeLabel(undefined)
    // 帰り道も同じ理由で外す(2026-08-27 便LU)。この下書きは献立から来たものではない
    setCandidateBackTo(undefined)
    setLastPickerCounts(pickerCounts) // 「レシピを選び直す」で復元できるよう、直前の選択を覚えておく(#8)
    setPickerOpen(false)
    setPickerCounts({})
    resetPickerConditions()
    showToast(ja.shopping.candidatesMadeToast)
    setScrollToCandidates(true) // 生成した下書きへ自動スクロール(#13)
  }

  // チェック0件で確定すると「0件を買い物メモに追加しました」と出て下書きだけが消えていた
  // (2026-07-29 便CC/C13)。ボタンを押せない状態にし、下書きは残す
  const checkedCandidateCount = candidates?.filter((c) => c.checked).length ?? 0

  const addConfirmed = async () => {
    if (!candidates) return
    const chosen = candidates.filter((c) => c.checked)
    if (chosen.length === 0) return
    await addConfirmedItems(
      chosen.map(({ name, amount, recipeIds, sources }) => ({ name, amount, recipeIds, sources })),
    )
    setCandidates(null)
    setCandidateRangeLabel(undefined)
    setCandidateBackTo(undefined)
    showToast(ja.shopping.addedToMemoToast.replace('{n}', String(chosen.length)))
  }

  // 下書きの取り消し(2026-07-29 便CC/C2)。従来は確認ゼロで即消えていた
  const discardCandidates = async () => {
    if (!candidates) return
    const ok = await confirm({
      title: ja.shopping.discardConfirmTitle.replace('{n}', String(candidates.length)),
      body: ja.shopping.discardConfirm,
      confirmLabel: ja.shopping.discardConfirmOk,
    })
    if (!ok) return
    setCandidates(null)
    setCandidateRangeLabel(undefined)
    setCandidateBackTo(undefined)
    showToast(ja.shopping.discardedToast)
  }

  // ✕の削除(2026-07-29 便CC/C19): 確認で止めず、消してから取り消せるようにする
  // (買い物中に片手・カートを押しながら触る画面なので、毎回の確認は邪魔になる)
  const removeMemoItem = async (item: ShoppingItem) => {
    await removeShoppingItem(item.id!)
    setUndoRemoved(item)
    setMessage(ja.shopping.removedToast.replace('{name}', item.name))
  }
  const undoRemoveMemoItem = async () => {
    if (!undoRemoved) return
    const restored = undoRemoved
    setUndoRemoved(null)
    await restoreShoppingItem(restored)
    setMessage(ja.shopping.restoredToast.replace('{name}', restored.name))
  }

  // 手動追加
  const [manualName, setManualName] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const addManual = async () => {
    if (!manualName.trim()) return
    await addShoppingItem(manualName, manualAmount)
    setManualName('')
    setManualAmount('')
  }

  // 買い物メモは売り場順に自動整列する(2026-07-24 実機FB #11)。表示専用の並べ替えで、
  // DBの保存順(order)は書き換えない。並び順は設定「買い物メモの売り場順」で入れ替えられる
  // (2026-08-02 便CT/C15)。未設定なら従来どおりの既定順
  const aisleOrder = settings?.shoppingAisleOrder
  // 売り場ごとのブロック表示(2026-08-08 オーナー実機フィードバック①)。
  // 中身が0件の売り場は出さない
  const memoGroups = useMemo(
    () => groupShoppingByAisle(shoppingItems ?? [], aisleOrder),
    [shoppingItems, aisleOrder],
  )
  // まとめてチェック・買い物完了など「メモ全体」を見る処理用の平らな並び。
  // ブロックを順につないだもの＝従来の sortShoppingByAisle と同じ
  const memoItems = useMemo(() => memoGroups.flatMap((group) => group.items), [memoGroups])
  // まとめてチェック/解除(2026-07-23 #6)
  const allChecked = memoItems.length > 0 && memoItems.every((i) => i.isChecked)
  /**
   * チェックした食材を下にまとめるスイッチ(2026-08-08 オーナー実機フィードバック)。
   * 既定はOFF＝従来どおり売り場ブロックの中に残る。ONのときだけ、売り場ブロックには
   * 未チェックだけを残し、チェック済みを下の1ブロックに集める。
   * 表示の切り替えだけなので、買い物メモ全体を見る処理(まとめてチェック・買い物完了)は
   * 上の memoItems をそのまま使い、スイッチの状態に左右されない。
   */
  const checkedAtBottom = !!settings?.shoppingCheckedAtBottom
  const memoView = useMemo(
    () =>
      checkedAtBottom
        ? splitCheckedShoppingItems(memoGroups)
        : { groups: memoGroups, checked: [] as ShoppingItem[] },
    [checkedAtBottom, memoGroups],
  )

  /**
   * レシピ詳細から帰ってきたときに開き直す「食材の窓」（2026-08-25 便KU）。
   * `?restore=1` が付いているときだけ入り、**買い物メモが端末から届いてから**開いて空にする
   * （届く前に開くと、出所のレシピが1件も無い窓が出る＝直後にアプリ自身が作り直すことになる）。
   */
  const [pendingSourcePopup, setPendingSourcePopup] = useState<ShoppingReturnPoint | null>(null)
  const shoppingRestoreRef = useRef(false)
  useEffect(() => {
    if (shoppingRestoreRef.current) return
    shoppingRestoreRef.current = true
    if (searchParams.get(WEEK_RETURN_PARAM) !== '1') return
    const point = parseShoppingReturn(readSessionItem(SHOPPING_RETURN_KEY))
    removeSessionItem(SHOPPING_RETURN_KEY)
    // 「戻る」を押した時点でその詳細は見終わっているので、「レシピ」タブが覚えている
    // 行き先も捨てる＝次にレシピタブを押すと一覧が開く（献立タブと同じ後始末）
    forgetRecipesTabPath()
    if (point) {
      setActiveTab(point.tab)
      setPendingSourcePopup(point)
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(WEEK_RETURN_PARAM)
        return next
      },
      { replace: true },
    )
    // 画面に着いた直後の1回だけ（shoppingRestoreRef）。消した ?restore= をもう一度読ませない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])
  useEffect(() => {
    if (!pendingSourcePopup) return
    // 出所のレシピ名を出すのに recipes が要る。買い物メモの行は shoppingItems が要る。
    // どちらも liveQuery で後から届くので、届くまでは何もしない（禁じ手⑤）
    if (recipes == null) return
    const point = pendingSourcePopup
    if (point.kind === 'memo') {
      if (shoppingItems == null) return
      const item = memoItems.find((i) => i.name === point.name)
      setPendingSourcePopup(null)
      // 離れているあいだに消された食材は、窓を開かずに画面だけ戻す
      if (!item) return
      window.scrollTo(0, point.scrollY)
      openSourcePopup('memo', {
        name: item.name,
        sources: item.fromRecipes,
        recipeIds: item.fromRecipeIds,
        manualAdded: item.manualAdded,
      })
      return
    }
    const row = candidates?.find((c) => c.name === point.name)
    setPendingSourcePopup(null)
    if (!row) return
    window.scrollTo(0, point.scrollY)
    openSourcePopup('draft', row)
    // openSourcePopup は毎描画で作り直される関数なので依存に入れない（入れると開いた直後に開き直す）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSourcePopup, recipes, shoppingItems, memoItems, candidates])

  // 買い物完了(2026-07-23 #7: 下部インラインパネル→作った!と同じ中央モーダルに変更)
  const [completeOpen, setCompleteOpen] = useState(false)
  const checkedItems = memoItems.filter((i) => i.isChecked)
  // Escape と端末の「戻る」で、この窓だけを閉じる（2026-08-18 便HQ・軸3。
  // 自前のEscapeだけだった頃は、窓を開けたまま「戻る」を押すと買い物メモの画面ごと離脱していた）
  useOverlayDismiss(completeOpen, () => setCompleteOpen(false))

  // 生成した下書きへ自動スクロール(2026-07-24 実機FB #13)。候補がDOMに乗った次の描画で1回だけ実行する
  useEffect(() => {
    if (scrollToCandidates && candidates && candidatesRef.current) {
      candidatesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToCandidates(false)
    }
  }, [scrollToCandidates, candidates])

  // 食材名ポップはEscでも閉じる(2026-07-24 実機FB #10。他モーダルと同じ作法)。
  // 2026-08-18 便HQ・軸3: 端末の「戻る」でも窓だけが閉じるよう共通の仕組みへ寄せた
  useOverlayDismiss(namePopup != null, () => setNamePopup(null))

  // 窓が開いているあいだ、後ろの買い物メモは動かさない（2026-08-16 便HE）。
  // 閉じたら、メモのどこまで見ていたかはそのまま
  useScrollLock(completeOpen)
  useScrollLock(namePopup != null)
  useScrollLock(pickerOpen)

  // 「あとにする」(2026-07-29 便CC/C7): 何も消さずにモーダルを閉じる。
  // 背景タップ・Escでも閉じられるが、それが分かる導線がボタンとして無かった
  const completeLater = () => {
    setCompleteOpen(false)
    showToast(ja.shopping.completeLaterToast)
  }

  const runComplete = async (reflect: boolean) => {
    await completeShopping(checkedItems, reflect)
    setCompleteOpen(false)
    // 反映する/しないどちらでもトースト(2026-07-23 #9)
    showToast(reflect ? ja.shopping.completeReflectedToast : ja.shopping.completeDoneToast)
  }

  // 買い物候補の説明文の折りたたみ(2026-07-16 UI総点検B-5)。既定は閉
  const [showCandidateDescription, setShowCandidateDescription] = useState(false)

  /**
   * 買い物メモの1行（2026-08-08 オーナー実機フィードバック⑤で売り場ブロックと
   * 「チェック済み」ブロックの2か所から描くようになったので、1か所にまとめた）。
   * 見た目・操作は従来のまま＝チェックの丸・食材名(出所の小窓)・✕の削除の3つ。
   */
  const renderMemoRow = (item: ShoppingItem) => (
    <li key={item.id} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
      <button
        type="button"
        onClick={() => void toggleShoppingChecked(item.id!)}
        aria-pressed={item.isChecked}
        aria-label={ja.shopping.toggleCheck}
        data-testid="memo-check"
        className={`tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          item.isChecked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
        }`}
      >
        <CheckCircle2 size={18} aria-hidden />
      </button>
      {/* 食材名タップで出所の小窓(2026-08-08 オーナー実機フィードバック②)。
          チェックの丸と✕は別ボタンのままなので、消し込みの操作は変わらない */}
      <button
        type="button"
        onClick={() =>
          openSourcePopup('memo', {
            name: item.name,
            sources: item.fromRecipes,
            recipeIds: item.fromRecipeIds,
            manualAdded: item.manualAdded,
          })
        }
        aria-label={`${item.name} ${ja.shopping.memoSourceOpen}`}
        className={`min-w-0 flex-1 px-2 py-1 text-left ${
          item.isChecked ? 'text-ink-muted line-through' : ''
        }`}
      >
        <span className="font-bold underline decoration-dotted decoration-ink-muted/40 underline-offset-4">
          {item.name}
        </span>
        {item.amount && <span className="ml-2 text-sm">{item.amount}</span>}
      </button>
      {/* 料理中・買い物中に片手で触るので44px確保(2026-07-29 便CC/C19。旧34px) */}
      <button
        type="button"
        onClick={() => void removeMemoItem(item)}
        aria-label={ja.shopping.remove}
        className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
      >
        <X size={18} aria-hidden />
      </button>
    </li>
  )

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.nav.shopping}</h1>

      {/* タブ切り替え: 食材の在庫／買い物メモ(2026-07-16 UI総点検B-9)。SettingsPageのタブバーと
          同じパターン(sticky+backdrop-blur)。タブ状態はページローカルで保存しない */}
      <div
        data-app-top-bar
        className="pantry-tabbar sticky top-0 z-10 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur"
      >
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pantry')}
            aria-pressed={activeTab === 'pantry'}
            className={`rounded-md border py-[13px] text-sm font-bold shadow-sm ${
              activeTab === 'pantry'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.shopping.tabInventory}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('memo')}
            aria-pressed={activeTab === 'memo'}
            className={`rounded-md border py-[13px] text-sm font-bold shadow-sm ${
              activeTab === 'memo'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.shopping.tabMemo}
          </button>
        </div>
      </div>

      {activeTab === 'pantry' && <PantryBoard />}

      {activeTab === 'memo' && (
        <>
        {/* 買い物メモ */}
        <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{ja.shopping.memoTitle}</h2>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
            >
              <ChefHat size={16} aria-hidden />
              {ja.shopping.fromRecipeTitle}
            </button>
          </div>

          {memoItems.length === 0 && !candidates && (
            <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.shopping.memoEmpty}</p>
          )}

          {memoItems.length > 0 && (
            <>
              {/* まとめてチェック/解除(2026-07-23 #6)と、売り場順の設定への控えめな入口
                  (2026-08-02 便CT/C15。並びが自動整列であることと、変えられることが
                  買い物メモの画面から辿れるようにする) */}
              <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
                <Link
                  to={settingsLinkWithBack('/settings?section=aisle', location.pathname + location.search)}
                  className="min-w-0 truncate text-sm text-ink-muted underline decoration-dotted underline-offset-4"
                >
                  {ja.shopping.aisleOrderLink}
                </Link>
                <button
                  type="button"
                  onClick={() => void setAllShoppingChecked(!allChecked)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
                >
                  <CheckCheck size={16} aria-hidden />
                  {/* 「全部チェック」⇔「チェックを外す」で幅が変わり、左隣のリンクが
                      切れていた（2026-08-09 便EO）。長い方の幅で固定する */}
                  <SwapLabel
                    current={allChecked ? ja.shopping.uncheckAll : ja.shopping.checkAll}
                    labels={[ja.shopping.checkAll, ja.shopping.uncheckAll]}
                  />
                </button>
              </div>
              {/* チェックした食材を下にまとめるスイッチ(2026-08-08 オーナー実機フィードバック)。
                  既定はOFF。設定に保存するので、次に買い物メモを開いたときも同じ見え方になる */}
              <label className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-ink-muted">
                  {ja.shopping.checkedAtBottomLabel}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checkedAtBottom}
                  aria-label={ja.shopping.checkedAtBottomLabel}
                  onClick={() =>
                    void updateSettings({ shoppingCheckedAtBottom: !checkedAtBottom })
                  }
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                    checkedAtBottom ? 'bg-accent' : 'bg-edge'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                      checkedAtBottom ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </label>
              {/* 並び順は売り場順の自動整列に一本化したため、手動の上下矢印UIは廃止(2026-07-24 実機FB #11・#12)。
                  2026-08-08 オーナー実機フィードバック①: 一列の羅列をやめ、売り場ごとの見出し(件数つき)で
                  ブロックに分ける。並び自体は従来と同じで、区切りを入れただけ */}
              <div className="mt-[var(--space-sm)] space-y-[var(--space-md)]">
                {memoView.groups.map((group) => (
                  <div key={group.key}>
                    <h3 className="flex items-baseline justify-between gap-2 px-1 text-sm font-bold text-ink-muted">
                      <span className="min-w-0 truncate">{ja.pantry.group[group.key]}</span>
                      <span className="shrink-0 tabular-nums">
                        {ja.shopping.aisleGroupCount.replace('{n}', String(group.items.length))}
                      </span>
                    </h3>
                    <ul className="mt-1 divide-y divide-edge rounded-md border border-edge bg-app">
                      {group.items.map(renderMemoRow)}
                    </ul>
                  </div>
                ))}
                {/* スイッチONのときだけ出る、チェック済みをまとめたブロック。
                    売り場ブロックと同じ見出し・同じ行の作りにして、消し込み(チェックの丸)も
                    ✕の削除も同じように使えるようにする(下へ移っても操作が変わらない) */}
                {memoView.checked.length > 0 && (
                  <div data-testid="memo-checked-block">
                    <h3 className="flex items-baseline justify-between gap-2 px-1 text-sm font-bold text-ink-muted">
                      <span className="min-w-0 truncate">{ja.shopping.checkedAtBottomTitle}</span>
                      <span className="shrink-0 tabular-nums">
                        {ja.shopping.aisleGroupCount.replace(
                          '{n}',
                          String(memoView.checked.length),
                        )}
                      </span>
                    </h3>
                    <ul className="mt-1 divide-y divide-edge rounded-md border border-edge bg-app">
                      {memoView.checked.map(renderMemoRow)}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}

          {/* 手動追加。1行に3つ並べると390px幅で分量欄が約94pxしか取れず
              プレースホルダが「分量（任」で切れていたため2行に分ける(2026-07-29 便CC/C20) */}
          <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder={ja.shopping.manualPlaceholder}
              className="w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
            />
            <div className="flex gap-[var(--space-sm)]">
              <input
                type="text"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder={ja.shopping.manualAmountPlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => void addManual()}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-4 py-3 font-bold text-accent-ink shadow-sm"
              >
                <Plus size={18} aria-hidden />
                {ja.shopping.manualAdd}
              </button>
            </div>
          </div>

          {/* 買い物完了 */}
          {checkedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 text-lg font-bold text-on-accent shadow-sm"
            >
              {ja.shopping.complete}
            </button>
          )}
        </section>

        {/* 買い物メモ（下書き。2026-07-24 実機FB #14で改称） */}
        {candidates && (
          <section
            ref={candidatesRef}
            className="mt-[var(--space-md)] scroll-mt-[var(--space-md)] rounded-md border border-accent bg-surface p-[var(--space-md)] shadow-sm"
          >
            {/* 下書きを作った画面への帰り道（2026-08-27 便LU・オーナー原文
                「下書き画面から直前の画面まで戻ってくる手段がない。」）。
                献立の「買い物メモを作る」で来たときだけ出す。行き先の名前も見た目も、
                設定画面の「◯◯に戻る」と同じ道具（logic/backLink.ts）にそろえる */}
            {candidateBackTarget && (
              <button
                type="button"
                data-testid="candidate-back"
                onClick={() => navigate(candidateBackTarget.to)}
                className="mb-1 flex items-center gap-1 rounded-sm py-1 font-bold text-accent-ink"
              >
                <ChevronLeft size={22} aria-hidden />
                {candidateBackTarget.label}
              </button>
            )}
            <h2 className="text-xl font-bold">{ja.shopping.candidateTitle}</h2>
            <button
              type="button"
              onClick={() => setShowCandidateDescription((v) => !v)}
              aria-expanded={showCandidateDescription}
              className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted"
            >
              <HelpCircle size={14} aria-hidden />
              {ja.common.usageHint}
              {showCandidateDescription ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
            <Collapse open={showCandidateDescription}>
              {/* 2026-08-25 便KN・オーナー指示（長い説明は箇条書きに）: 113字の1段落を3行に分け、
                  文頭に「・」を付ける（この画面の「買い物終了」の窓と同じ形）。
                  印は飾りなので読み上げには渡さない（aria-hidden） */}
              <ul className="mt-1 space-y-1 text-sm text-ink-muted">
                {ja.shopping.candidateDescriptionLines.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <span aria-hidden>・</span>
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </Collapse>
            {/* どの範囲の献立から作ったか(2026-08-08 便EA)。献立の週タブで日付・食事を選べる
                ようにしたので、下書きを見たときに範囲が分かるようにする。
                レシピを手で選んで作った下書きには出ない */}
            {candidateRangeLabel && (
              <p className="mt-1 text-sm text-ink-muted" data-testid="candidate-range">
                {candidateRangeLabel}
              </p>
            )}

            {candidates.length === 0 ? (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">
                {draftHasNoIngredients
                  ? ja.shopping.candidateEmptyNoIngredients
                  : ja.shopping.candidateEmpty}
              </p>
            ) : (
              <ul className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                {candidates.map((c, index) => (
                  <li key={c.name} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCandidates((prev) =>
                          prev
                            ? prev.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row))
                            : prev,
                        )
                      }
                      aria-pressed={c.checked}
                      className={`tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        c.checked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                      }`}
                    >
                      <CheckCircle2 size={18} aria-hidden />
                    </button>
                    {/* 食材名タップで全文＋使うレシピ名をポップ表示(2026-07-24 実機FB #10)。
                        名前は truncate で省略されるので、タップで確認できるようにする */}
                    <button
                      type="button"
                      onClick={() => openSourcePopup('draft', c)}
                      className="min-w-0 flex-1 truncate pt-2 text-left font-bold underline decoration-dotted decoration-ink-muted/40 underline-offset-4"
                    >
                      {c.name}
                    </button>
                    <textarea
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }
                      }}
                      value={c.amount}
                      onChange={(e) => {
                        const value = e.target.value
                        setCandidates((prev) =>
                          prev ? prev.map((row, i) => (i === index ? { ...row, amount: value } : row)) : prev,
                        )
                        e.currentTarget.style.height = 'auto'
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                      }}
                      placeholder={ja.shopping.amountPlaceholder}
                      rows={1}
                      className="w-24 shrink-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-sm border border-edge bg-app px-2 py-2 text-sm text-ink leading-snug"
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* 確定/やり直し/取り消し(2026-07-24 実機FB #8)。確定は主ボタンで上に、
                「レシピを選び直す」(選択を保持して開き直す)と「キャンセル」は下段に並べる */}
            <div className="mt-[var(--space-md)] flex flex-col gap-2">
              {candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => void addConfirmed()}
                    disabled={checkedCandidateCount === 0}
                    className="w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm disabled:opacity-40"
                  >
                    {ja.shopping.addConfirmed}
                  </button>
                  {/* 押せない理由を添える(2026-07-29 便CC/C13。無言の死にボタンにしない) */}
                  {checkedCandidateCount === 0 && (
                    <p className="text-center text-sm text-ink-muted">
                      {ja.shopping.addConfirmedNoneHint}
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={repickRecipes}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                >
                  {ja.shopping.repickRecipes}
                </button>
                <button
                  type="button"
                  onClick={() => void discardCandidates()}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
                >
                  {ja.shopping.discardCandidates}
                </button>
              </div>
            </div>
          </section>
        )}
        </>
      )}

      {/* 買い物完了の確認モーダル(2026-07-23 #7: 作った!と同じ中央カード様式)。
          背景タップ・Escで閉じる。反映する/反映せず完了の2択はどちらでもトースト(#9) */}
      {completeOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setCompleteOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.shopping.completeConfirmTitle}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.shopping.completeConfirmTitle}</h3>
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* 件数を明示する(2026-07-29 便CC/C7・規約F: 何が消えて何が残るかを件数つきで)。
                2026-08-08 オーナー実機フィードバック「『買い物終了』後の文章が読みづらい」:
                1段落に詰めるのをやめ、ボタンごと・結果ごとに1行ずつ並べる(規約H) */}
            <ul className="mt-[var(--space-sm)] space-y-1 text-sm text-ink-muted">
              {ja.shopping.completeConfirmLines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span aria-hidden>・</span>
                  <span className="min-w-0">
                    {line
                      .replace(/\{n\}/g, String(checkedItems.length))
                      .replace('{m}', String(memoItems.length - checkedItems.length))}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-[var(--space-md)] flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void runComplete(true)}
                  className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                >
                  {ja.shopping.completeYes}
                </button>
                <button
                  type="button"
                  onClick={() => void runComplete(false)}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
                >
                  {ja.shopping.completeNo}
                </button>
              </div>
              {/* 後回しの導線(2026-07-29 便CC/C7)。レジ前でその場の判断を強いない。
                  2026-08-26 オーナー指示(書き溜め0826)「ボタンの名前で意味がわかるため、
                  説明文２つも削除」: ボタンの下に出していた説明の2行を ja.ts ごと外した。
                  押しても買い物メモも在庫も書き換えないので、消えるものを並べる必要が無い
                  (押したあとは completeLaterToast が結果を言う) */}
              <button
                type="button"
                onClick={completeLater}
                className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
              >
                {ja.shopping.completeLater}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 食材名タップで出す「全文＋出所のレシピ」ポップ(2026-07-24 実機FB #10 →
          2026-08-08 オーナー実機フィードバック②で買い物メモの行からも開けるようにした)。
          背景タップ・X・Escで閉じる(他モーダルと同じ作法) */}
      {namePopup && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setNamePopup(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={namePopup.name}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 break-words font-bold">{namePopup.name}</h3>
              <button
                type="button"
                onClick={() => setNamePopup(null)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* 下書きは「まだ入れる前」なので従来どおり「使うレシピ」、確定した買い物メモは
                「どのレシピから入ったか」を答える見出しにする。
                手で足しただけの行はレシピが1件も無いので、見出しごと出さない */}
            {namePopup.recipes.length > 0 && (
              <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
                {namePopup.kind === 'memo'
                  ? ja.shopping.memoSourceTitle
                  : ja.shopping.candidateUsedInRecipes}
              </p>
            )}
            {namePopup.recipes.length > 0 && (
              // レシピ名を押すとそのレシピ詳細へ（既存の遷移作法＝Linkで /recipes/:id）。
              // 右側にそのレシピでの分量を並べる
              /* 2026-08-19 便HW: 料理名だけの行をやめ、献立の枠と同じ「小」のカードにそろえた。
                 そのレシピでの分量は行の右端に添える（出ていた情報はそのまま） */
              <ul className="mt-1 space-y-1">
                {namePopup.recipes.map((source, i) => {
                  const recipe = fullRecipeById.get(source.recipeId)
                  return (
                    <li key={`${source.recipeId}-${i}`}>
                      {recipe ? (
                        <RecipeCard
                          recipe={recipe}
                          density="small"
                          place="planSlot"
                          // 設定「食べられない食材」の警告（2026-08-19 便IE）。ここに並ぶのは
                          // これから作る品なので、献立の枠と同じように警告を出す
                          ngIngredients={settings?.ngIngredients ?? []}
                          // 2026-08-25 便KU: 戻ってきたときに、この窓ごと同じ場所へ帰す。
                          // 窓は閉じない（閉じると「何を見ていたか」が画面から消える）
                          linkState={SHOPPING_RETURN_LINK_STATE}
                          onNavigate={rememberSourcePopupReturn}
                          // 検査用の目印（2026-08-25 便KU）。この窓から「レシピ詳細へ移って
                          // 戻る」道を機械で見張る
                          testId="shopping-source-recipe"
                          meta={source.amount || undefined}
                        />
                      ) : (
                        // レシピが端末から消えている行（カードにする絵も押す先も無い）
                        <Link
                          to={`/recipes/${source.recipeId}`}
                          state={SHOPPING_RETURN_LINK_STATE}
                          onClick={rememberSourcePopupReturn}
                          className="flex items-center gap-2 rounded-sm border border-edge bg-app px-[var(--space-sm)] py-3"
                        >
                          <span className="min-w-0 flex-1 break-words text-sm font-bold text-accent-ink underline decoration-dotted underline-offset-4">
                            {source.title}
                          </span>
                          {source.amount && (
                            <span className="shrink-0 text-sm text-ink-muted">{source.amount}</span>
                          )}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {/* 手で足した分は正直に出す(レシピ由来が0件のときも、レシピ由来に足したときも) */}
            {namePopup.manual && (
              <p className="mt-[var(--space-sm)] text-sm text-ink">{ja.shopping.memoSourceManual}</p>
            )}
            {/* 記録は残っているのにレシピが見つからない＝そのレシピが削除されている */}
            {namePopup.missing > 0 && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.shopping.memoSourceMissing.replace('{n}', String(namePopup.missing))}
              </p>
            )}
            {namePopup.recipes.length === 0 && !namePopup.manual && namePopup.missing === 0 && (
              <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateUsedInNoRecipe}</p>
            )}
          </div>
        </div>
      )}

      {/* レシピ選択ピッカー */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.shopping.pickRecipes}</h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label={ja.common.close}
              className="tap-target rounded-full p-2 text-ink-muted"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          {/* 検索まど＋並び替え／絞り込みのボタン（2026-08-27 便LN・オーナー原文
              「レシピから追加のレシピ選択画面は、検索と絞り込み、並び替えの使い勝手を
              レシピタブと同じにしたい」）。並び・見た目・押す順番までレシピタブと同じにしてある。

              relative: パネルはこの帯の真下に**重ねて**出す（レシピ一覧と同じ作り。
              一覧の高さを1pxも変えないので、開いても閉じても縦位置が動かない）。
              z-10: 重ねたパネルを、下のレシピの並びより手前に置く */}
          <div ref={pickerBarRef} className="relative z-10 px-[var(--space-md)]">
            <div className="flex gap-[var(--space-sm)]">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                  aria-hidden
                />
                <input
                  type="search"
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={ja.search.placeholder}
                  className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
                />
              </div>
              <button
                type="button"
                onClick={togglePickerSortPanel}
                data-panel-toggle
                aria-expanded={pickerSortPanelOpen}
                aria-label={ja.search.sortToggle}
                className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
                  pickerSortPanelOpen || pickerSortActive
                    ? 'border-accent text-accent-ink'
                    : 'border-edge text-ink-muted'
                }`}
              >
                <ArrowDownUp size={22} aria-hidden />
              </button>
              <button
                type="button"
                onClick={togglePickerFilterPanel}
                data-panel-toggle
                aria-expanded={pickerFilterPanelOpen}
                aria-label={ja.search.filterToggle}
                className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
                  pickerFilterPanelOpen || pickerFilterActive
                    ? 'border-accent text-accent-ink'
                    : 'border-edge text-ink-muted'
                }`}
              >
                <SlidersHorizontal size={22} aria-hidden />
              </button>
            </div>

            {/* 品数と「一致した場所」の入口（レシピ一覧の件数の行と同じ形・同じ並び）。
                絞り込みパネルの中にも同じ数字は出ているが、パネルを閉じているあいだも
                いま何品に絞れているかが読めるように、1行だけ常に出す */}
            <div className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
              <p className="shrink-0 whitespace-nowrap text-sm text-ink-muted">
                {pickerFilterActive
                  ? ja.search.resultCountWithTotal
                      .replace('{n}', String(filteredRecipes.length))
                      .replace('{t}', String(visibleRecipes.length))
                  : ja.search.totalCount.replace('{n}', String(visibleRecipes.length))}
              </p>
              {pickerMatchSummary.rows.length > 0 && (
                <button
                  type="button"
                  data-testid="picker-match-open"
                  onClick={() => setPickerMatchOpen(true)}
                  className="tap-target inline-flex min-w-0 items-center rounded-sm border border-edge bg-surface px-1 py-1 text-[10px] text-ink-muted"
                >
                  <span className="min-w-0 truncate">{ja.search.matchEntry}</span>
                </button>
              )}
            </div>

            {/* 並び替え／絞り込みのパネルを、レシピの並びの上に重ねて出す入れ物
                （レシピ一覧と同じ作り・同じ部品）。pointer-events-none/auto は、
                パネルの外側の余白でレシピのタップを奪わないため */}
            <div
              ref={pickerPanelWrapRef}
              className="pointer-events-none absolute inset-x-0 top-full px-[var(--space-md)]"
            >
              <RecipeSortPanel
                open={pickerSortPanelOpen}
                maxHeight={pickerPanelMaxHeight}
                sort={pickerSort}
                sortDirection={pickerSortDirection}
                onSortChange={(next) => {
                  setPickerSort(next)
                  // 種類を変えたらその種類の既定方向に戻す（レシピ一覧と同じ・2026-07-13 UI改善）
                  setPickerSortDirection(defaultSortDirection[next])
                }}
                onSortDirectionChange={setPickerSortDirection}
                nutritionUnlocked={pickerNutritionUnlocked}
                proLinkTo={detourLinkTo('/settings?section=pro')}
                onProLinkClick={() => rememberDetour([], lockedScrollY())}
                onClose={closePickerPanels}
              />
              <RecipeFilterPanel
                open={pickerFilterPanelOpen}
                maxHeight={pickerPanelMaxHeight}
                values={pickerFilters}
                onChange={setPickerFilterValues}
                anyConditionActive={pickerAnyConditionActive}
                onClear={clearPickerFilters}
                filterActive={pickerFilterActive}
                resultCount={filteredRecipes.length}
                totalCount={visibleRecipes.length}
                hideStarters={settings?.hideStarters ?? false}
                onToggleHideStarters={() =>
                  void updateSettings({ hideStarters: !(settings?.hideStarters ?? false) })
                }
                tagOptions={pickerTagOptions}
                savedTagOptions={pickerSavedTagOptions}
                onRemoveSavedSearch={(name) => void removeSavedSearch(name)}
                tagBusy={tagBusy}
                pantryNames={availableNames}
                onClose={closePickerPanels}
              />
            </div>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <div className="mt-[var(--space-md)] text-center text-ink-muted">
                <p>{visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}</p>
                {/* 0品の原因が条件のときは、その場で外せるようにする（レシピ一覧と同じ作法・
                    2026-07-29 便CI/C20。パネルを開き直さないと「条件をクリア」に届かない、を作らない） */}
                {visibleRecipes.length > 0 && pickerAnyConditionActive && (
                  <>
                    <p className="mt-1 text-sm">{ja.search.noResultFilteredHint}</p>
                    <button
                      type="button"
                      data-testid="picker-clear"
                      onClick={clearPickerFilters}
                      className="mt-[var(--space-sm)] rounded-md border border-accent bg-surface px-4 py-2 text-sm font-bold text-accent-ink shadow-sm"
                    >
                      {ja.search.clear}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <ul className="space-y-[var(--space-sm)]">
                {filteredRecipes.map((recipe) => {
                  const count = pickerCounts[recipe.id!] ?? 0
                  const selected = count >= 1
                  return (
                    <li
                      key={recipe.id}
                      className={`flex items-center gap-2 rounded-md ${
                        selected ? 'bg-accent/5' : ''
                      }`}
                    >
                      {/* 品目名下の「◯人分レシピ」表記は削除(2026-07-24 実機FB #9) */}
                      {/* 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）:
                          料理名だけの行をやめ、レシピ一覧の一覧表示と同じ「標準」のカードに寄せた。
                          レシピを探して選ぶ場所（献立のレシピ選び・献立テンプレの差し替え）と同じ形になり、
                          写真で見分けられるようになる。似た名前を2行まで折り返す作法
                          (2026-07-29 便CC/C20)は「標準」の料理名がそのまま引き継いでいる */}
                      <div className="min-w-0 flex-1">
                        {/* 設定「食べられない食材」の警告（2026-08-19 便IE）。献立の枠のレシピ選び・
                            献立テンプレの差し替えと同じ「1品を選ぶ」場所なので、同じ印を出す */}
                        <RecipeCard
                          recipe={recipe}
                          density="standard"
                          place="recipePicker"
                          ngIngredients={settings?.ngIngredients ?? []}
                          readOnly
                        />
                      </div>
                      {/* 食数の+/-ステッパー(2026-07-23 #3)。1食以上で選択扱い・指定食数で候補生成 */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCount(recipe.id!, count - 1)}
                          disabled={count === 0}
                          aria-label={ja.shopping.pickerServingDown}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted disabled:opacity-30"
                        >
                          <Minus size={16} aria-hidden />
                        </button>
                        <span className="w-12 text-center text-sm font-bold tabular-nums">
                          {count}
                          {ja.shopping.pickerServingUnit}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCount(recipe.id!, count + 1)}
                          aria-label={ja.shopping.pickerServingUp}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                            selected ? 'border-accent bg-accent text-on-accent' : 'border-edge text-accent-ink'
                          }`}
                        >
                          <Plus size={16} aria-hidden />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {/* 下の帯（パネルの高さの上限を測る下端でもある＝パネルがこのボタンに潜り込まない） */}
          <div
            ref={pickerFooterRef}
            className="px-[var(--space-md)] pb-[calc(var(--space-md)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]"
          >
            <button
              type="button"
              onClick={() => void makeCandidates()}
              disabled={selectedRecipeCount === 0}
              className="w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
            >
              {ja.shopping.makeCandidates}
              {selectedRecipeCount > 0 ? `（${selectedRecipeCount}）` : ''}
            </button>
          </div>

          {/* 打った言葉がレシピのどこに一致したか（レシピ一覧と同じ窓・components/SearchMatchDialog.tsx）。
              この窓は選択画面（z-50）より上（z-70）に出る */}
          {pickerMatchOpen && (
            <SearchMatchDialog
              query={pickerQuery}
              summary={pickerMatchSummary}
              onClose={() => setPickerMatchOpen(false)}
            />
          )}
        </div>
      )}

      <Toast
        message={message}
        onClose={() => {
          setMessage('')
          setUndoRemoved(null)
        }}
        actionLabel={undoRemoved ? ja.common.undo : undefined}
        onAction={undoRemoved ? () => void undoRemoveMemoItem() : undefined}
      />
    </div>
  )
}
