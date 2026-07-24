import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Dices,
  X,
  Search,
  ShoppingCart,
  Check,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Lock,
  Route,
  RotateCcw,
  Trash2,
  Plus,
  SlidersHorizontal,
} from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { usePriceEntries } from '../db/prices'
import { usePantryItems } from '../db/pantry'
import { pantryAvailableNames } from '../logic/pantry'
import { searchRecipes, type TimeFilter, type EffortFilter, type TagFilter } from '../logic/search'
import { sortResults, type RecipeSortOption } from '../logic/recipeSort'
import {
  useMealPlanRange,
  addMealEntry,
  updateMealEntryRecipe,
  removeMealEntry,
  setMainMeal,
  clearMealSlotInRange,
} from '../db/mealPlan'
import Toast from '../components/Toast'
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  markAllTodayListCooked,
  importRecipeIdsToTodayList,
} from '../db/todayList'
import {
  MEAL_SLOTS,
  MEAL_GENRES,
  weekDates,
  shiftWeek,
  shiftDate,
  isPastDate,
  monthDates,
  shiftMonth,
  monthLeadingBlanks,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  todayPlanMismatch,
  normalizeDateRange,
  rangeDayCount,
  isOneDish,
  recipeGenre,
  detectGenreMix,
  proteinSourceOf,
  cookedPlanEntryIds,
  mealOccasionCount,
} from '../logic/mealPlan'
import type { MealGenre, ProteinSource } from '../logic/mealPlan'
import { todayString } from '../logic/date'
import { hasNgIngredient } from '../logic/ng'
import {
  buildPriceIndex,
  estimateRecipeCost,
  sumMealPlanEntriesCost,
  sumCookedRecipesCost,
} from '../logic/priceEstimate'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import type { CookedLog, MealPlanEntry, MealRole, MealSlot, Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/** 献立タブの3タブ構成（2026-07-16 便U-1: 現行の「今日セクション+週/月切替」をタブへ再構成） */
type MealPlanViewMode = 'day' | 'week' | 'month'

/** レシピ選択ピッカーの絞り込み・並び替え（2026-07-24 便BH-3・タスク6: 一覧画面の機構を流用）。
 * 栄養並び替え（Pro機能）は複雑なのでピッカーには出さず、基本の並び替えだけを提供する */
const PICKER_SORT_OPTIONS: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
]
const PICKER_TIME_OPTIONS: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: ja.search.timeAll },
  { value: 'under10', label: ja.search.timeUnder10 },
  { value: 'under30', label: ja.search.timeUnder30 },
  { value: 'over30', label: ja.search.timeOver30 },
]
const PICKER_EFFORT_OPTIONS: { value: EffortFilter; label: string }[] = [
  { value: 'all', label: ja.search.effortAll },
  { value: 'easy', label: ja.effort.easy },
  { value: 'normal', label: ja.effort.normal },
  { value: 'fancy', label: ja.effort.fancy },
]
const PICKER_TAG_OPTIONS: { value: TagFilter; label: string }[] = [
  { value: 'all', label: ja.search.tagAll },
  { value: '作り置き', label: '作り置き' },
  { value: 'お弁当', label: 'お弁当' },
]
const pickerChipCls = (active: boolean) =>
  `rounded-sm border px-3 py-1.5 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

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
  // state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
  // RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(献立タブ)へ
  // 戻るために参照する（2026-07-12オーナー指示）。
  // ?focus=today を付けて「今日の献立から戻ってきた」ことをMealPlanPageに伝える。
  // これが付いていると、日タブを必ず選択した状態に固定する
  // （2026-07-15オーナー実機フィードバック: 今日の献立からレシピを開いて戻ると
  // 今週の献立に飛ばされる、の恒久対策。2026-07-16便U-1でタブ構成に再設計後もこの
  // 「戻ったら必ず日タブ」という保証は維持する）
  const fromState = { from: 'todayList' as const, fromPath: '/meal-plan?focus=today' }
  return (
    <li className="flex items-center gap-2 px-[var(--space-sm)] py-2">
      <Link
        to={`/recipes/${recipe.id}`}
        state={fromState}
        className="h-10 w-10 shrink-0 overflow-hidden rounded-sm"
      >
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} iconSize={20} />
        )}
      </Link>
      <Link to={`/recipes/${recipe.id}`} state={fromState} className="min-w-0 flex-1 truncate font-bold">
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

/**
 * 過去振り返り(2026-07-17 便Z-2・docs/35 §3)の「作った記録」1件分の薄いカード。
 * 週タブの過去日の枠と、月タブの日モーダルの両方で使う。
 * 予定(エントリ)との視覚区別: ✓マーク+淡い表示(薄いカード)。
 * サムネは記録に添付された写真を優先し、無ければレシピ写真→アイコンにフォールバック
 * (ホームの「最近作ったもの」HistoryCardと同じ方針)。
 * usePhotoUrlはループ内で直接呼べないため専用コンポーネントに分離
 */
function CookedLogCard({
  recipe,
  log,
  onNavigate,
}: {
  recipe: Recipe
  log: CookedLog
  onNavigate?: () => void
}) {
  const logPhotoUrl = usePhotoUrl(log.photo)
  const recipePhotoUrl = usePhotoUrl(recipe.photo)
  const photoUrl = logPhotoUrl ?? recipePhotoUrl
  return (
    <li>
      <Link
        to={`/recipes/${recipe.id}`}
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-sm border border-edge bg-app/60 px-2 py-1.5 opacity-80"
      >
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-sm">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <RecipePlaceholder recipe={recipe} iconSize={16} />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-bold text-ink-muted">
          {recipe.title}
        </span>
        <CheckCircle2 size={16} className="shrink-0 text-accent" aria-hidden />
      </Link>
    </li>
  )
}

/** 献立の1枠内の1行分（主菜/副菜の実データ行、または未割り当てのプレースホルダー行） */
type MealPlanRow =
  | { kind: 'entry'; entry: MealPlanEntry }
  | { kind: 'empty'; removable: boolean; extraLocalId?: string }

/** 「＋枠を追加」で増やした、まだレシピが割り当てられていない行（DBには保存しないUIだけの状態） */
interface ExtraRow {
  localId: string
  role: MealRole
}

/** ある日×枠の役割(主菜/副菜)ごとに表示する行を組み立てる。
 * 実データが1件もない役割は「未定」の行を1つ必ず表示し、+ボタンで増やした分を後ろに続ける */
function buildRoleRows(slotEntries: MealPlanEntry[], role: MealRole, extra: ExtraRow[]): MealPlanRow[] {
  const roleEntries = slotEntries.filter((e) => (e.role ?? 'main') === role)
  const rows: MealPlanRow[] = roleEntries.map((entry) => ({ kind: 'entry', entry }))
  if (roleEntries.length === 0) {
    rows.push({ kind: 'empty', removable: false })
  }
  extra
    .filter((x) => x.role === role)
    .forEach((x) => {
      rows.push({ kind: 'empty', removable: true, extraLocalId: x.localId })
    })
  return rows
}

/** 日×枠キーで束ねられたエントリ配列を、日付をキーに持つ配列からMap化する共通ヘルパー */
function groupBySlot(entries: MealPlanEntry[] | undefined): Map<MealSlot, MealPlanEntry[]> {
  const map = new Map<MealSlot, MealPlanEntry[]>()
  entries?.forEach((e) => {
    const list = map.get(e.slot)
    if (list) list.push(e)
    else map.set(e.slot, [e])
  })
  return map
}

/** 献立タブ: 「日」「週」「月」の3タブでレシピを割り当てる（2026-07-16 便U再構成） */
export default function MealPlanPage() {
  const navigate = useNavigate()
  const recipes = useLiveQuery(listRecipes, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const settings = useSettings()
  // 食材価格マスタ（未入力の材料だけ目安価格で補うフォールバック。docs/20 §3）
  const priceEntries = usePriceEntries()
  const priceIndex = useMemo(() => buildPriceIndex(priceEntries ?? []), [priceEntries])
  // レシピ選択ピッカーの並び替え「在庫一致順」用の在庫食材名（2026-07-24 便BH-3・タスク6・
  // 一覧画面の並び替え機構を流用）
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  const today = useMemo(todayString, [])
  const [weekStart, setWeekStart] = useState(() => weekDates(new Date())[0])
  // 週タブの表示起点(2026-07-24 便BH-3・タスク3): 従来の週区切り(月曜始まり)⇄今日を先頭に7日間。
  // 既定は従来(週区切り)・選択は設定に記憶。ローリング表示はweekStartを起点に7日連続で並べる
  const rollingWeek = settings?.weekStartsToday === true
  const dates = useMemo(
    () =>
      rollingWeek
        ? Array.from({ length: 7 }, (_, i) => shiftDate(weekStart, i))
        : weekDates(new Date(`${weekStart}T00:00:00`)),
    [weekStart, rollingWeek],
  )
  // 「今日を先頭に7日間」表示が設定されている端末では、初回ロード時にweekStartを今日へ合わせる
  // (weekStartの初期値は従来表示前提の月曜始まりのため。ここで1回だけ今日起点へ寄せる)
  const weekModeInitRef = useRef(false)
  useEffect(() => {
    if (weekModeInitRef.current) return
    if (settings === undefined) return
    weekModeInitRef.current = true
    if (settings.weekStartsToday) setWeekStart(today)
  }, [settings, today])
  // 週タブの表示起点を切り替える(選択を設定に記憶し、weekStartを各モードの「現在」に合わせ直す)
  const setWeekLayout = (rolling: boolean) => {
    void updateSettings({ weekStartsToday: rolling })
    setWeekStart(rolling ? today : weekDates(new Date())[0])
  }
  // 今、当週(=各モードの「現在」)を見ているか(Fix1: 中央チップの「戻る」ラベル/アイコンは
  // 現在以外のときだけ出す)。従来表示=当週の月曜、今日起点表示=今日、が「現在」の起点
  const currentWeekAnchor = rollingWeek ? today : weekDates(new Date())[0]
  const isAtCurrentWeek = dates[0] === currentWeekAnchor

  const entries = useMealPlanRange(dates[0], dates[6])
  // 「今日」の週プラン登録は、週タブで表示中の週(weekStart)に依存させない
  // （2026-07-16 便U: 日タブが週タブから独立した別タブになったため。以前はentries(週タブの
  // 表示中の週)からtoday部分を抜き出していたが、週タブで別の週へ移動した状態のまま
  // 日タブを開くと「今日」の分が拾えなくなる結合があった。今日の日付だけを別途取得して解消する）
  const todayEntries = useMealPlanRange(today, today)
  // 昨日の週プラン(表示中の週:weekStartに関係なく常に「今日の前日」を指す。todayEntriesと同じ設計）。
  // ランダム週献立(「まとめて献立」「サイコロ」)の候補から「昨日食べた(予定の)レシピ」を除外し、
  // 直近の繰り返しを防ぐために使う(2026-07-16 便W-⑤b)
  const yesterday = useMemo(() => shiftDate(today, -1), [today])
  const yesterdayEntries = useMealPlanRange(yesterday, yesterday)
  const yesterdayRecipeIds = useMemo(
    () => Array.from(new Set((yesterdayEntries ?? []).map((e) => e.recipeId))),
    [yesterdayEntries],
  )

  // 3タブ（日/週/月。月はPro機能・既存ゲート維持）。既定は「日」タブ
  const [viewMode, setViewMode] = useState<MealPlanViewMode>('day')
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
  // 今、当月を見ているか(Fix2: 中央チップの「今月へ戻る」ラベル/アイコンは当月以外のときだけ出す)
  const isAtCurrentMonth = monthAnchor.slice(0, 7) === todayString().slice(0, 7)
  const monthEntries = useMealPlanRange(
    monthDatesList[0],
    monthDatesList[monthDatesList.length - 1],
  )
  const monthDaysWithPlan = useMemo(() => {
    const set = new Set<string>()
    monthEntries?.forEach((e) => set.add(e.date))
    return set
  }, [monthEntries])
  // 過去振り返り(2026-07-17 便Z-2・docs/35 §3): 日付→その日の「作った記録」のインデックス。
  // 全レシピのcookedLogsを1回の走査でMap化する(記録件数が多い場合に日付ごとのfilterを
  // 繰り返さないための仕様指定のuseMemoインデックス)。hideStarters設定に関わらず全レシピを
  // 対象にする(「実際に作った」履歴のため。HistoryPage・ホームの最近作ったものと同じ方針)
  const cookedLogsByDate = useMemo(() => {
    const map = new Map<string, { recipe: Recipe; log: CookedLog }[]>()
    recipes?.forEach((recipe) => {
      recipe.cookedLogs.forEach((log) => {
        const list = map.get(log.date)
        if (list) list.push({ recipe, log })
        else map.set(log.date, [{ recipe, log }])
      })
    })
    return map
  }, [recipes])
  // 週ビューの「作った見た目」対応付け(2026-07-24 便BH-3・タスク2): 表示中の週の各エントリのうち、
  // その日の「作った記録」に対応する枠のidを集合で持つ(cookedPlanEntryIdsで日ごとに先着消費。
  // 同名複数の枠は記録件数の分だけ・非破壊=表示のみ)。日タブで「作った!」を押して記録が付くと、
  // 週側の該当枠がここに入り、renderRowで作った見た目に変わる
  const cookedWeekEntryIds = useMemo(() => {
    const result = new Set<number>()
    const byDate = new Map<string, MealPlanEntry[]>()
    ;(entries ?? []).forEach((e) => {
      const list = byDate.get(e.date)
      if (list) list.push(e)
      else byDate.set(e.date, [e])
    })
    byDate.forEach((dayEntries, date) => {
      const logs = cookedLogsByDate.get(date)
      if (!logs || logs.length === 0) return
      const counts = new Map<number, number>()
      logs.forEach(({ recipe }) => {
        if (recipe.id != null) counts.set(recipe.id, (counts.get(recipe.id) ?? 0) + 1)
      })
      cookedPlanEntryIds(dayEntries, counts).forEach((id) => result.add(id))
    })
    return result
  }, [entries, cookedLogsByDate])
  // 月タブ: 「記録あり」小マーク(✓)を出す日の集合(便Z-2。表示中の月の分だけ)
  const monthDaysWithLog = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const set = new Set<string>()
    cookedLogsByDate.forEach((_, date) => {
      if (date.startsWith(prefix)) set.add(date)
    })
    return set
  }, [cookedLogsByDate, monthAnchor])
  // 月タブ: 日タップで開くその日の献立モーダル（便U-5。従来の即週ジャンプはモーダル内の
  // ボタンへ移動）。nullなら非表示
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const goToWeekOf = (date: string) => {
    setWeekStart(weekDates(new Date(`${date}T00:00:00`))[0])
    setViewMode('week')
  }

  // 期間の食費(2026-07-17 便AB・オーナー決定・docs/35 §5): 月タブの「期間の食費」モード。
  // costMode中は日タップがこの範囲選択に使われ、日モーダル(dayModalDate)は抑止する。
  // rangeStart/rangeEndは共に非nullになった時点で常に開始<=終了へ正規化済み(normalizeDateRange)
  const [costMode, setCostMode] = useState(false)
  const [rangeStart, setRangeStart] = useState<string | null>(null)
  const [rangeEnd, setRangeEnd] = useState<string | null>(null)
  // モードボタンをもう一度押すと解除し、選択もリセットする(再度押せば再選択できる)
  const toggleCostMode = () => {
    setCostMode((v) => !v)
    setRangeStart(null)
    setRangeEnd(null)
  }
  // 月を移動すると選択を無効化する(段階1は「表示中の月のカレンダー内で完結」の仕様のため、
  // 月をまたいだ範囲を組めないようにする。表示中の月が変われば選び直してもらう)
  useEffect(() => {
    setRangeStart(null)
    setRangeEnd(null)
  }, [monthAnchor])
  // 日タップ時の範囲選択ロジック。未選択→開始日。開始日のみ→終了日(自動で開始<=終了に正規化)。
  // 両方選択済み(結果カード表示中)にさらにタップ→そのタップを新しい開始日として選び直す
  const handleRangeDayTap = (date: string) => {
    if (rangeStart == null || rangeEnd != null) {
      setRangeStart(date)
      setRangeEnd(null)
    } else {
      const [start, end] = normalizeDateRange(rangeStart, date)
      setRangeStart(start)
      setRangeEnd(end)
    }
  }
  // 日×枠キー("date|slot")ごとの全エントリ（主菜+副菜など複数件を保持する。2026-07-13対応）
  const entriesByDateSlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>()
    entries?.forEach((e) => {
      const key = `${e.date}|${e.slot}`
      const list = map.get(key)
      if (list) list.push(e)
      else map.set(key, [e])
    })
    return map
  }, [entries])
  // 「今日」だけの枠別マップ（食い違い検出UI用。todayEntries由来でweekStartに依存しない）
  const todayEntriesBySlot = useMemo(() => groupBySlot(todayEntries), [todayEntries])
  // 月タブの日タップモーダル用（monthEntries由来なので表示帯フィルタに関係なく朝昼夕すべてを見せる）
  const dayModalEntries = useMemo(() => {
    if (!dayModalDate) return []
    return (monthEntries ?? []).filter((e) => e.date === dayModalDate)
  }, [monthEntries, dayModalDate])
  const dayModalBySlot = useMemo(() => groupBySlot(dayModalEntries), [dayModalEntries])
  // 月タブの日モーダルに出す、その日の「作った記録」(便Z-2)
  const dayModalLogs = dayModalDate ? (cookedLogsByDate.get(dayModalDate) ?? []) : []
  const dayModalTitle = dayModalDate
    ? ja.mealPlan.monthDayModalTitle
        .replace('{m}', String(Number(dayModalDate.slice(5, 7))))
        .replace('{d}', String(Number(dayModalDate.slice(8, 10))))
    : ''

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // 表示する食事帯（未設定なら朝昼夜すべて。実際の既定値は起動時のresolveVisibleMealSlotsIfNeededが
  // 新規ユーザー=夕食のみ/既存ユーザー=3枠のどちらかに決めて保存する。ここでの[...MEAL_SLOTS]は
  // その保存が終わるまでの一瞬だけ使われるフォールバック）。日タブ・週タブの両方で同じ設定値を使う
  const visibleSlots = settings?.visibleMealSlots ?? [...MEAL_SLOTS]
  const toggleSlot = (slot: MealSlot) => {
    const next = visibleSlots.includes(slot)
      ? visibleSlots.filter((s) => s !== slot)
      : [...visibleSlots, slot]
    // 全部外すことはできない（何も見えなくなるため）。以前は無反応だっただけだったが、
    // 何も起きない理由が伝わらないとの指摘(第4波ペルソナPDCA Fix6)を受け、トーストで説明する
    if (next.length === 0) {
      setMessage(ja.mealPlan.slotFilterKeepOne)
      return
    }
    void updateSettings({ visibleMealSlots: next })
  }
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    visibleRecipes.forEach((r) => map.set(r.id!, r))
    return map
  }, [visibleRecipes])

  // 期間の食費(便AB): ハイライト表示用の範囲(開始日のみ選択中は単日をそのまま範囲として扱う)。
  // 結果カードは rangeStart/rangeEnd が両方そろって初めて出す(こちらはハイライト専用)
  const rangeHighlightBounds = useMemo(() => {
    if (rangeStart == null) return null
    return rangeEnd == null ? { start: rangeStart, end: rangeStart } : { start: rangeStart, end: rangeEnd }
  }, [rangeStart, rangeEnd])
  // 期間内(両端含む)のmealPlansエントリ。monthEntries(表示中の月のカレンダー内)から絞り込むため、
  // 「月をまたぐ期間は月表示範囲内に限定してよい」の仕様を自然に満たす(月をまたぐ選択自体は
  // monthAnchor変更時のリセットで防止済み)
  const rangeCostEntries = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return []
    return (monthEntries ?? []).filter((e) => e.date >= rangeStart && e.date <= rangeEnd)
  }, [monthEntries, rangeStart, rangeEnd])
  // 期間の献立原価合計(既存の週の概算食費と同じsumMealPlanEntriesCost・登録人数基準で算出)
  const rangeCostEstimate = useMemo(
    () => sumMealPlanEntriesCost(rangeCostEntries, recipeById, priceIndex),
    [rangeCostEntries, recipeById, priceIndex],
  )
  const rangeDays = rangeStart != null && rangeEnd != null ? rangeDayCount(rangeStart, rangeEnd) : 0
  const rangeAverageCost = rangeDays > 0 ? Math.round(rangeCostEstimate.total / rangeDays) : 0
  // 期間の食費(予定ベース)の食数(=食事の回数。主菜+副菜が並ぶ枠も1食。2026-07-24 便BH-3・タスク9)
  const rangePlanMealCount = useMemo(() => mealOccasionCount(rangeCostEntries), [rangeCostEntries])
  // 期間の食費(実績ベース・2026-07-24 便BH-3・タスク9): 期間内の「作った記録」から実績原価と食数を出す。
  // 予定(mealPlansエントリ)ではなく実際に作った記録が基準。記録件数=食数、合計÷食数で「1食あたり」を出す
  const rangeCookedRecipes = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return []
    const out: Recipe[] = []
    cookedLogsByDate.forEach((list, date) => {
      if (date >= rangeStart && date <= rangeEnd) list.forEach(({ recipe }) => out.push(recipe))
    })
    return out
  }, [cookedLogsByDate, rangeStart, rangeEnd])
  const rangeActualCost = useMemo(
    () => sumCookedRecipesCost(rangeCookedRecipes, priceIndex),
    [rangeCookedRecipes, priceIndex],
  )
  const rangeActualPerMeal =
    rangeActualCost.count > 0 ? Math.round(rangeActualCost.total / rangeActualCost.count) : 0

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）
  const todayList = useTodayList()
  const todayListRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])

  // 今日の日付の週プラン登録のうち「表示中の食事帯」に入っているレシピID
  // （手動取り込みボタン・自動取り込み(便U-3)・食い違い検出の3つで共通利用。todayEntries由来
  // なので週タブでどの週を見ているか(weekStart)に関係なく常に「今日」を指す）
  const todayFromPlanIds = useMemo(() => {
    const ids = new Set<number>()
    todayEntries?.forEach((e) => {
      if (visibleSlots.includes(e.slot)) ids.add(e.recipeId)
    })
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntries, settings?.visibleMealSlots])

  // 「今日の献立」にあるのに、今日の週プラン枠には入っていないレシピ
  // (週プランを使っていない=今日の枠が0件のときは食い違い扱いにしない)
  const mismatchRecipes = useMemo(() => {
    const todayListIds = todayList?.map((item) => item.recipeId) ?? []
    const mismatchIds = todayPlanMismatch(todayListIds, todayFromPlanIds)
    return mismatchIds
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, todayFromPlanIds, recipeById])

  // 献立タブを開いたときの初期タブ(2026-07-16 便U-1でタブ構成に再設計): 既定は「日」タブ。
  // ?focus=today が付いている場合(今日の献立からレシピを開いて戻ってきた場合)は、明示的に
  // 「日」タブへ固定し最上部へスクロールする（2026-07-15オーナー実機フィードバック対策を維持）。
  // パラメータは消費したら消す(次の「素の献立タブ開き」で通常の既定=日タブに戻すため)。
  // 初回1回だけ処理する(liveQueryの再評価のたびに動かないようinitialFocusRefで守る)
  const initialFocusRef = useRef(false)
  useEffect(() => {
    if (initialFocusRef.current) return
    initialFocusRef.current = true
    if (searchParams.get('focus') === 'today') {
      setViewMode('day')
      window.scrollTo(0, 0)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('focus')
          return next
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  // 自動取り込み(便U-3・設計確定): 日タブを開いたとき、今日の日付の週プラン登録
  // (表示中の食事帯のみ)を今日の献立へ自動取り込みする。既存の手動取り込みボタンと同じ
  // importRecipeIdsToTodayList(重複はスキップ)をそのまま使うため、何度呼んでも重複追加は
  // されない=冪等。ただし「同じ日付につき1回だけ」自動実行する歯止めとして
  // settings.lastAutoImportDateを使う：既に今日の日付が保存されていれば即return(=何もしない)。
  // これにより、ユーザーが取り込み後にその品を消しても、同じ日のうちに日タブを開き直した
  // だけでは再取り込みされない(=再出現しない)。
  // 日付の記録は「取り込み対象が1件以上あったとき」だけ行う：対象0件の空振りでも記録して
  // しまうと、「朝に日タブを見る(まだ計画なし)→週タブで今日の分を計画→日タブへ戻る」という
  // ごく自然な初回動線で、その日はもう自動取り込みが効かなくなるため。空振り時は何も書かない。
  // それでも「消した品の再出現」は起きない：消せる品が今日の献立にあった=取り込みが実行済み
  // =日付記録済み、なのでその日のうちの再実行は必ずスキップされる
  useEffect(() => {
    if (viewMode !== 'day') return
    if (settings === undefined || todayEntries === undefined) return
    if (settings.lastAutoImportDate === today) return
    if (todayFromPlanIds.length === 0) return
    void (async () => {
      await importRecipeIdsToTodayList(todayFromPlanIds)
      await updateSettings({ lastAutoImportDate: today })
    })()
  }, [viewMode, settings, todayEntries, todayFromPlanIds, today])

  const [quickOnly, setQuickOnly] = useState(false)
  // 自動提案の条件UI(2026-07-13追加): ジャンル優先(指定なしも含め単一選択)・高たんぱく優先
  const [genreFilter, setGenreFilter] = useState<MealGenre | undefined>(undefined)
  const [preferHighProtein, setPreferHighProtein] = useState(false)
  // 提案条件6ボタンの折りたたみ(2026-07-16 UI総点検A-3)。既定閉
  const [suggestConditionsOpen, setSuggestConditionsOpen] = useState(false)
  const [message, setMessage] = useState('')

  // 「＋枠を追加」でUI上だけ増やした未割り当て行（date|slotキー→役割つきの一覧）。
  // レシピが割り当てられた時点でDBの実エントリに置き換わるため、ここからは取り除く
  const [extraRows, setExtraRows] = useState<Record<string, ExtraRow[]>>({})
  const extraRowSeq = useRef(0)
  const addExtraRow = (date: string, slot: MealSlot, role: MealRole) => {
    extraRowSeq.current += 1
    const localId = `extra-${extraRowSeq.current}`
    const key = `${date}|${slot}`
    setExtraRows((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), { localId, role }] }))
  }
  const removeExtraRowState = (date: string, slot: MealSlot, localId: string) => {
    const key = `${date}|${slot}`
    setExtraRows((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((r) => r.localId !== localId),
    }))
  }
  // 「＋枠を追加」タップ後、主菜/副菜どちらを足すか選ぶ小さなメニューの開閉(date|slotキー。同時に1つだけ)
  const [addMenuFor, setAddMenuFor] = useState<string | null>(null)

  // レシピ選択ピッカー（どの日・枠・役割・行を対象にしているか。entryIdがあれば既存行の差し替え、
  // 無ければ新規追加。extraLocalIdは「＋枠を追加」で増やした未割り当て行に割り当てたときの後始末用）
  const [pickerTarget, setPickerTarget] = useState<{
    date: string
    slot: MealSlot
    role: MealRole
    entryId?: number
    extraLocalId?: string
  } | null>(null)
  // ピッカーは週の枠(pickerTarget)への割り当て専用。空状態の「今日の献立を選ぶ」は2026-07-24
  // 便BN・タスク1でレシピ一覧タブへの遷移に変更したため、旧「今日の献立ピッカー」モードは廃止した
  const pickerOpen = pickerTarget != null
  // 「おまかせで提案」で今日の献立に入れた分のレシピID(2026-07-24 便BN・タスク2)。
  // これがある間だけ「振り直す」ボタンを出し、押されたらこの分を入れ替えて再提案する
  const [lastSuggestedIds, setLastSuggestedIds] = useState<number[]>([])
  const [pickerQuery, setPickerQuery] = useState('')
  // ピッカーの絞り込み・並び替え(2026-07-24 便BH-3・タスク6・一覧画面の機構を流用)。
  // 開閉は既定閉。パネル外の検索窓(pickerQuery)と合わせてsearchRecipes/sortResultsに渡す
  const [pickerControlsOpen, setPickerControlsOpen] = useState(false)
  const [pickerSort, setPickerSort] = useState<RecipeSortOption>('updated')
  const [pickerTime, setPickerTime] = useState<TimeFilter>('all')
  const [pickerEffort, setPickerEffort] = useState<EffortFilter>('all')
  const [pickerTag, setPickerTag] = useState<TagFilter>('all')
  const [pickerFavoriteOnly, setPickerFavoriteOnly] = useState(false)
  // 絞り込み+並び替えを適用した候補（一覧画面と同じsearchRecipes→sortResults。栄養並び替えは
  // Pro機能なのでピッカーには出さない＝基本の並び替えのみ）
  const pickerResults = useMemo(() => {
    const found = searchRecipes(visibleRecipes, {
      query: pickerQuery,
      ingredients: '',
      time: pickerTime,
      effort: pickerEffort,
      tag: pickerTag,
      favoriteOnly: pickerFavoriteOnly,
      excludeNg: false,
      quickOnly: false,
      ngIngredients: settings?.ngIngredients ?? [],
    })
    return sortResults(found, pickerSort, pantryNames)
  }, [
    visibleRecipes,
    pickerQuery,
    pickerTime,
    pickerEffort,
    pickerTag,
    pickerFavoriteOnly,
    pickerSort,
    pantryNames,
    settings?.ngIngredients,
  ])
  const filteredRecipes = useMemo(() => pickerResults.map((r) => r.recipe), [pickerResults])
  const pickerFilterActive =
    pickerTime !== 'all' || pickerEffort !== 'all' || pickerTag !== 'all' || pickerFavoriteOnly
  // 今開いている行に現在割り当て済みのレシピID(Fix4: 埋まった行を開いても他の候補と
  // 同じ見た目で無確認上書きしてしまう問題の対策で、先頭固定＋選択中バッジに使う)
  const currentPickerRecipeId = useMemo(() => {
    if (pickerTarget?.entryId == null) return undefined
    return entries?.find((e) => e.id === pickerTarget.entryId)?.recipeId
  }, [pickerTarget, entries])
  // 表示用リスト: 現在割り当て済みのレシピが絞り込み結果に含まれるときだけ先頭に固定する。
  // 検索で絞り込まれて対象外になった場合は並べ替えない(＝バッジも出ない)
  const displayedRecipes = useMemo(() => {
    if (currentPickerRecipeId == null) return filteredRecipes
    const idx = filteredRecipes.findIndex((r) => r.id === currentPickerRecipeId)
    if (idx <= 0) return filteredRecipes
    const current = filteredRecipes[idx]
    return [current, ...filteredRecipes.slice(0, idx), ...filteredRecipes.slice(idx + 1)]
  }, [filteredRecipes, currentPickerRecipeId])

  const closePicker = () => {
    setPickerTarget(null)
  }

  const openPicker = (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    setPickerTarget({ date, slot, role, entryId, extraLocalId })
    setPickerQuery('')
  }

  const pickRecipe = async (recipeId: number) => {
    if (!pickerTarget) return
    const { date, slot, role, entryId, extraLocalId } = pickerTarget
    if (entryId != null) {
      await updateMealEntryRecipe(entryId, recipeId)
    } else {
      await addMealEntry(date, slot, recipeId, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
    }
    setPickerTarget(null)
  }

  // 主菜+副菜のペアを1組計算する(タスク1/2共用)。提案元の枠は「表示中の食事帯に夕食があれば
  // 夕食、無ければ先頭の帯」を使う。excludeIdsに渡したレシピは候補から外す(振り直しで直前の提案を
  // 避けるために使う)。候補が0件のときはundefinedを返す
  const computeSuggestionIds = (excludeIds: number[]): number[] | undefined => {
    if (!recipes) return undefined
    const slot: MealSlot = visibleSlots.includes('dinner') ? 'dinner' : visibleSlots[0] ?? 'dinner'
    const { main, side } = suggestPairForSlot(visibleRecipes, {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds: excludeIds,
      slot,
      genre: genreFilter,
      preferHighProtein,
      yesterdayRecipeIds,
    })
    const ids = [main?.id, side?.id].filter((x): x is number => x != null)
    return ids.length === 0 ? undefined : ids
  }

  // 「おまかせで提案」(タスク1): 主菜+副菜のペアを提案して今日の献立へ入れる
  const suggestTodayList = async () => {
    setMessage('')
    const ids = computeSuggestionIds([])
    if (!ids) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    await importRecipeIdsToTodayList(ids)
    setLastSuggestedIds(ids)
    setMessage(ja.mealPlan.todaySuggestDone.replace('{n}', String(ids.length)))
  }

  // 「おまかせを振り直す」(タスク2): 直前のおまかせ分を入れ替えて別の主菜+副菜を提案し直す。
  // 直前の分を候補から外して先に新しい組を計算し、取れたときだけ入れ替える(取れなければ元のまま)
  const rerollTodayList = async () => {
    setMessage('')
    const prev = lastSuggestedIds
    const ids = computeSuggestionIds(prev)
    if (!ids) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    for (const id of prev) await removeFromTodayList(id)
    await importRecipeIdsToTodayList(ids)
    setLastSuggestedIds(ids)
    setMessage(ja.mealPlan.todaySuggestDone.replace('{n}', String(ids.length)))
  }

  /** 行の「×」: 既存の割り当てなら削除、追加しただけの未割り当て行ならUI上から取り消す */
  const clearRow = async (date: string, slot: MealSlot, entryId?: number, extraLocalId?: string) => {
    if (entryId != null) {
      await removeMealEntry(entryId)
    } else if (extraLocalId) {
      removeExtraRowState(date, slot, extraLocalId)
    }
  }

  /**
   * 行の「サイコロ」: その行だけに自動提案を適用する。ただし対象の枠(主菜・副菜とも)が
   * 丸ごと空のときだけは、主菜+副菜のペアで一度に埋める(Fable設計2026-07-13: 「献立を
   * 決めたい」という主目的に沿わせるため、片方だけでなく両方を1タップで提案する)。
   * 過去日(今日より前)の枠は対象外(2026-07-16 便W-⑤a・上書きも新規埋めもしない。
   * UI側(renderRow)でも過去日はサイコロのボタン自体を出さないが、二重の安全側としてここでも guard する
   */
  const suggestRow = async (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    if (!recipes) return
    if (isPastDate(date, today)) return
    setMessage('')
    const slotEntries = entriesByDateSlot.get(`${date}|${slot}`) ?? []
    const isSlotEmpty = slotEntries.length === 0
    const usedRecipeIds = (entries ?? []).filter((e) => e.id !== entryId).map((e) => e.recipeId)
    const baseOptions = {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds,
      slot,
      genre: genreFilter,
      preferHighProtein,
      yesterdayRecipeIds,
    }
    if (isSlotEmpty && entryId == null) {
      const { main, side } = suggestPairForSlot(visibleRecipes, baseOptions)
      if (!main && !side) {
        setMessage(ja.mealPlan.noSuggestion)
        return
      }
      if (main) await addMealEntry(date, slot, main.id!, 'main')
      if (side) await addMealEntry(date, slot, side.id!, 'side')
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
      return
    }
    const picked = suggestForSlot(visibleRecipes, { ...baseOptions, role })
    if (!picked) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    if (entryId != null) {
      await updateMealEntryRecipe(entryId, picked.id!)
    } else {
      await addMealEntry(date, slot, picked.id!, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
    }
  }

  /**
   * 週の表示中の食事帯を、自動提案でまとめて埋める。
   *
   * 2026-07-22 便BE(外部レビューで見つかった欠陥の修正): 以前は表示中の全枠(手動で選んだ枠も含む)を
   * 一旦クリアしてから再提案していたため、手動で入れた献立が無警告で上書きされて消えていた。
   * これをやめ、planWeekFill(logic/mealPlan.ts)で枠を仕分けする:
   *   - 手動配置(auto以外)がある枠 → 丸ごと残す(上書きしない)
   *   - 空き枠・自動提案由来だけの枠 → 自動行を消してから主菜+副菜のペアで埋め直す
   * これにより「手動配置の保護」と「押すたびの再抽選(2026-07-14仕様。自動枠に限って維持)」を両立する。
   * 埋める枠にはauto=trueを付け、次回もこの枠だけが再抽選対象になるようにする。
   * 過去日・非表示帯の枠は対象外で、重複回避の除外対象としてのみ使う(planWeekFill内で処理)。
   * 手動枠を残した場合は結果メッセージで明示する(空き枠だけ埋めたことも伝わる)。
   */
  const fillWeek = async () => {
    if (!recipes) return
    setMessage('')
    const plan = planWeekFill(entries ?? [], dates, visibleSlots, today)
    // 埋め直す役割に残っている自動提案由来の行だけを削除(手動配置は plan で除外済み＝残る)
    for (const id of plan.autoEntryIdsToRemove) {
      await removeMealEntry(id)
    }
    const usedRecipeIds = [...plan.usedRecipeIds]

    // たんぱく源の週内分散(docs/56 §3-6): 今週まだ少ない主菜のソース(肉/魚/卵/豆腐)を軽く優先し、
    // 肉→肉→肉と連続で偏るのを防ぐ。残る手動主菜も集計に入れる。'その他'は分散対象にしない
    const proteinCounts: Record<ProteinSource, number> = { 肉: 0, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }
    const bumpProtein = (r: Recipe) => {
      proteinCounts[proteinSourceOf(r)] += 1
    }
    for (const e of entries ?? []) {
      if ((e.role ?? 'main') !== 'main') continue
      if (e.id != null && plan.autoEntryIdsToRemove.includes(e.id)) continue // これから消える主菜は数えない
      const r = recipeById.get(e.recipeId)
      if (r) bumpProtein(r)
    }
    const preferProteinSources = (): ProteinSource[] => {
      const sources: ProteinSource[] = ['肉', '魚', '卵', '豆腐']
      const min = Math.min(...sources.map((s) => proteinCounts[s]))
      return sources.filter((s) => proteinCounts[s] === min)
    }

    const baseOpts = {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      genre: genreFilter,
      preferHighProtein,
      yesterdayRecipeIds,
    }

    // 両役割が空 or 自動だけの枠: 主菜+副菜のペアで埋める(一品ものの主菜なら副菜は付かない=空く)
    for (const { date, slot } of plan.slotsToFill) {
      const { main, side } = suggestPairForSlot(visibleRecipes, {
        ...baseOpts,
        slot,
        usedRecipeIds,
        preferProteinSources: preferProteinSources(),
      })
      if (main) {
        await addMealEntry(date, slot, main.id!, 'main', true)
        usedRecipeIds.push(main.id!)
        bumpProtein(main)
      }
      if (side) {
        await addMealEntry(date, slot, side.id!, 'side', true)
        usedRecipeIds.push(side.id!)
      }
    }

    // 片方の役割だけ空の枠(便BH-2・役割粒度の保護): 手動で入っている役割は触らず、空いた役割だけ埋める。
    // 手動主菜だけの枠には主菜のジャンルに揃えた副菜を足す(主菜が一品ものなら副菜は足さない)。
    for (const { date, slot, fillRole } of plan.partialFills) {
      if (fillRole === 'side') {
        const manualMain = (entries ?? []).find(
          (e) => e.date === date && e.slot === slot && (e.role ?? 'main') === 'main' && !e.auto,
        )
        const mainRecipe = manualMain ? recipeById.get(manualMain.recipeId) : undefined
        if (mainRecipe && isOneDish(mainRecipe)) continue // 一品ものの主菜には副菜を足さない
        const side = suggestForSlot(visibleRecipes, {
          ...baseOpts,
          slot,
          role: 'side',
          preferDishType: 'side',
          usedRecipeIds,
          genre: genreFilter ?? (mainRecipe ? recipeGenre(mainRecipe) : undefined),
        })
        if (side) {
          await addMealEntry(date, slot, side.id!, 'side', true)
          usedRecipeIds.push(side.id!)
        }
      } else {
        const main = suggestForSlot(visibleRecipes, {
          ...baseOpts,
          slot,
          role: 'main',
          usedRecipeIds,
          preferProteinSources: preferProteinSources(),
        })
        if (main) {
          await addMealEntry(date, slot, main.id!, 'main', true)
          usedRecipeIds.push(main.id!)
          bumpProtein(main)
        }
      }
    }

    // 結果メッセージ。手動枠を残した場合と、今日を含む週で「今日の献立」(日タブ)が
    // 自動では変わらない場合(タスク2の混乱対策)を、状況に応じて出す
    const messages: string[] = []
    if (plan.preservedSlotKeys.size > 0) {
      messages.push(ja.mealPlan.fillWeekKeptManual.replace('{n}', String(plan.preservedSlotKeys.size)))
    }
    const todayRefilled =
      plan.slotsToFill.some((s) => s.date === today) || plan.partialFills.some((s) => s.date === today)
    if (todayRefilled && (todayList?.length ?? 0) > 0) {
      messages.push(ja.mealPlan.fillWeekTodayNotice)
    }
    if (messages.length > 0) setMessage(messages.join(' '))

    // まとめて献立の直後、今日の枠へ自動スクロール(2026-07-24 便BH-3・タスク7: 埋まったのが
    // 画面外で無反応に見える問題への対応)。今日が表示中の週に含まれるとき(refがある)だけ動く。
    // liveQueryの再描画・レイアウト確定を2フレーム待ってからスクロールする
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        todaySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }),
    )
  }
  // 週タブの「今日」のカード(feature 7のスクロール先)。今日が表示中の週に無ければnullのまま
  const todaySectionRef = useRef<HTMLElement | null>(null)

  // 週タブ「この帯の今週分を空にする」(便U-4 Fable設計: 「朝のみ削除したい」への回答)。
  // 帯を1つ選び、確認ダイアログを経てから、表示中の週(dates[0]〜dates[6]。週タブで
  // 前後移動している場合はその週)のうちその帯のエントリだけをまとめて削除する。
  // 概算食費(weekCostEstimate)はentries(全帯)を集計対象にしており、visibleSlotsで
  // フィルタしていないため、この削除で自動的に反映される(「登録されている献立全部」の
  // 集計のまま変えない、という仕様どおり)
  const [clearSlotTarget, setClearSlotTarget] = useState<MealSlot>('dinner')
  const clearWeekSlot = async () => {
    const label = ja.mealPlan.slot[clearSlotTarget]
    if (!window.confirm(ja.mealPlan.clearWeekSlotConfirm.replace('{slot}', label))) return
    await clearMealSlotInRange(dates[0], dates[6], clearSlotTarget)
    setMessage(ja.mealPlan.clearWeekSlotDone.replace('{slot}', label))
  }

  // 週の概算食費（材料ごとの価格入力を優先し、未入力の材料は食材価格マスタで補う。docs/20 §3）
  const weekCostEstimate = useMemo(
    () => sumMealPlanEntriesCost(entries ?? [], recipeById, priceIndex),
    [entries, recipeById, priceIndex],
  )
  const weekCost = weekCostEstimate.total
  // 概算食費の食数(=食事の回数。主菜+副菜が並ぶ枠も1食。2026-07-24 便BH-3・タスク8「◯食分」併記)
  const weekMealCount = useMemo(() => mealOccasionCount(entries ?? []), [entries])
  // 概算食費の折りたたみ(2026-07-24 便BH-3・タスク4: 「まとめて献立」直後にいきなり金額が出る
  // 違和感への対応。既定閉・配置も7日分カードの下=邪魔にならない位置へ移動)
  const [weekCostOpen, setWeekCostOpen] = useState(false)

  const weeklyBudget = settings?.weeklyBudget
  const budgetDiff = weeklyBudget != null ? weeklyBudget - weekCost : undefined

  // 価格情報（個別入力・マスタ一致のどちらか）が1件も無ければ「週の概算食費」セクションごと非表示にする
  // (価格情報が無い人には無意味な表示のため。2026-07-10 オーナー要望・docs/20 §3でマスタ一致も対象に追加)
  const hasPricedRecipe = useMemo(
    () => (recipes ?? []).some((r) => estimateRecipeCost(r.ingredients, priceIndex).hasAnyPriceInfo),
    [recipes, priceIndex],
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

  /** 1行分のUI（役割ラベル＋レシピ名ボタン＋サイコロ＋×） */
  const renderRow = (date: string, slot: MealSlot, role: MealRole, row: MealPlanRow, key: string) => {
    const recipe = row.kind === 'entry' ? recipeById.get(row.entry.recipeId) : undefined
    const entryId = row.kind === 'entry' ? row.entry.id : undefined
    const extraLocalId = row.kind === 'empty' ? row.extraLocalId : undefined
    const showRemove = row.kind === 'entry' || row.removable
    const isEmpty = !recipe
    // 「作った見た目」対応付け(タスク2): この枠が「作った記録」に対応していれば作った見た目に変える
    const isCooked = entryId != null && cookedWeekEntryIds.has(entryId)
    return (
      <div key={key} className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs font-bold text-ink-muted">{ja.mealPlan.role[role]}</span>
        <button
          type="button"
          onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
          className={`flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm border px-2 py-2 text-left text-sm ${
            isEmpty
              ? // タスク5: 空き枠は「＋ レシピを選ぶ」のボタン然とした見た目に(押せると分かるよう
                // アクセント色＋Plusアイコン。従来は淡色「未定」で押せると分からない指摘への対応)
                'border-dashed border-accent/50 bg-surface font-bold text-accent'
              : isCooked
                ? // タスク2: 作った見た目(記録カードに合わせて淡い表示＋✓)
                  'border-edge bg-app/60 text-ink-muted opacity-80'
                : 'border-edge bg-app'
          }`}
        >
          {isEmpty ? (
            <>
              <Plus size={16} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{ja.mealPlan.emptyAssign}</span>
            </>
          ) : (
            <>
              {isCooked && (
                <CheckCircle2 size={14} className="shrink-0 text-accent" aria-hidden />
              )}
              {recipe && hasNgIngredient(recipe, settings?.ngIngredients ?? []) && (
                <TriangleAlert
                  size={14}
                  className="shrink-0 text-warning"
                  aria-label={ja.detail.ngWarning}
                />
              )}
              <span className="min-w-0 flex-1 truncate">{recipe!.title}</span>
            </>
          )}
        </button>
        {/* 過去日(今日より前)・作った記録のある枠はサイコロ非表示(2026-07-16 便W-⑤a: ランダム提案の
            対象外。過去/作った献立は振り返る対象であり、上書きも新規埋めもしない) */}
        {!isPastDate(date, today) && !isCooked && (
          <button
            type="button"
            onClick={() => void suggestRow(date, slot, role, entryId, extraLocalId)}
            aria-label={ja.mealPlan.suggestAria}
            className="rounded-full p-2 text-accent"
          >
            <Dices size={18} aria-hidden />
          </button>
        )}
        {showRemove && (
          <button
            type="button"
            onClick={() => void clearRow(date, slot, entryId, extraLocalId)}
            aria-label={row.kind === 'entry' ? ja.mealPlan.clear : ja.mealPlan.removeExtraRow}
            className="rounded-full p-2 text-ink-muted"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
    )
  }

  // 提案条件が既定値から変わっていれば、畳んだトグルのラベルにも現在値を出す
  // (2026-07-16 UI総点検A-3: 「提案の条件: 和食」のように)
  const activeConditionSummaries: (string | undefined)[] = [
    quickOnly ? ja.mealPlan.quickOnlySummary : undefined,
    genreFilter,
    preferHighProtein ? ja.mealPlan.preferHighProteinToggle : undefined,
  ]
  const conditionsSummary = activeConditionSummaries.filter((v): v is string => Boolean(v)).join('・')

  /** 表示する食事帯トグル（日タブ・週タブで共用。便U-2: 既存visibleMealSlotsを日タブにも適用） */
  const renderSlotFilter = () => (
    <>
      <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.slotFilterTitle}</p>
      <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => toggleSlot(slot)}
            aria-pressed={visibleSlots.includes(slot)}
            className={`rounded-sm border px-3 py-2 text-sm font-bold ${
              visibleSlots.includes(slot)
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.mealPlan.slot[slot]}
          </button>
        ))}
      </div>
    </>
  )

  // 月タブの日タップモーダルはEscapeキーでも閉じる(CookedLogModalと同じ作法)
  useEffect(() => {
    if (!dayModalDate) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDayModalDate(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dayModalDate])

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 日／週／月の3タブ(便U-1) */}
      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setViewMode('day')}
          aria-pressed={viewMode === 'day'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'day'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewDay}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('week')}
          aria-pressed={viewMode === 'week'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'week'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewWeek}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('month')}
          aria-pressed={viewMode === 'month'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'month'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewMonth}
        </button>
      </div>

      <Toast message={message} onClose={() => setMessage('')} />

      {viewMode === 'day' && (
        <>
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
                      onCooked={() => {
                        void markTodayListCooked(recipe.id!)
                        // 2026-07-16 UI総点検A-4: 行が消えるだけの無言完了だったのでトーストで明示
                        setMessage(ja.mealPlan.todayCookedToast)
                      }}
                      onRemove={() => void removeFromTodayList(recipe.id!)}
                    />
                  ))}
                </ul>
                {/* 「おまかせで提案」の直後だけ出す振り直し(2026-07-24 便BN・タスク2)。
                    前回のおまかせ分を入れ替えて別の主菜+副菜を提案し直す */}
                {lastSuggestedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void rerollTodayList()}
                    className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
                  >
                    <Dices size={18} aria-hidden />
                    {ja.mealPlan.todayReroll}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void markAllTodayListCooked(todayListRecipes.map((r) => r.id!))}
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
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
                              const slotEntries = todayEntriesBySlot.get(slot) ?? []
                              const mainEntry = slotEntries.find((e) => (e.role ?? 'main') === 'main')
                              const currentTitle = mainEntry
                                ? recipeById.get(mainEntry.recipeId)?.title
                                : undefined
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => void setMainMeal(today, slot, recipe.id!)}
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
              // 空状態の案内+ボタン(2026-07-24 便BH-3・タスク1: 何をすべきか分かるように。
              // 便BN・タスク1: 「今日の献立を選ぶ」はレシピ一覧タブへ移動する(一覧の「今日の献立に
              // 追加」で足す動線・オーナー指定))
              <div className="mt-[var(--space-sm)]">
                <p className="text-sm text-ink-muted">{ja.mealPlan.todayEmpty}</p>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.todayEmptyGuide}</p>
                <div className="mt-[var(--space-sm)] flex flex-col gap-[var(--space-sm)]">
                  <button
                    type="button"
                    onClick={() => navigate('/recipes')}
                    className="flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                  >
                    <Plus size={18} aria-hidden />
                    {ja.mealPlan.todayChooseButton}
                  </button>
                  <button
                    type="button"
                    onClick={() => void suggestTodayList()}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
                  >
                    <Dices size={18} aria-hidden />
                    {ja.mealPlan.todaySuggestButton}
                  </button>
                  {todayFromPlanIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void importRecipeIdsToTodayList(todayFromPlanIds)}
                      className="w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
                    >
                      {ja.mealPlan.todayImport.replace('{n}', String(todayFromPlanIds.length))}
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>

          {/* 表示する食事帯（便U-2。今日の献立への自動取り込み(便U-3)がここで選んだ帯だけを対象にする） */}
          <div className="mt-[var(--space-md)]">
            {renderSlotFilter()}
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.daySlotFilterHint}</p>
          </div>
        </>
      )}

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
                aria-label={isAtCurrentMonth ? undefined : ja.mealPlan.thisMonth}
                className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
              >
                {!isAtCurrentMonth && <RotateCcw size={14} className="text-accent" aria-hidden />}
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

            {/* 期間の食費モード(2026-07-17 便AB・docs/35 §5)。押すたびにON/OFFを切り替え、
                切り替え時は選択もリセットする(再度押せば選び直せる) */}
            <div className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={toggleCostMode}
                aria-pressed={costMode}
                className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                  costMode
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                {ja.mealPlan.rangeCostToggle}
              </button>
              {costMode && (rangeStart == null || rangeEnd == null) && (
                <p className="text-sm font-bold text-accent">
                  {rangeStart == null ? ja.mealPlan.rangeCostGuideStart : ja.mealPlan.rangeCostGuideEnd}
                </p>
              )}
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
              {monthDatesList.map((date) => {
                // 期間の食費モード中は日タップ=範囲選択に使う(便AB・日モーダルは抑止)
                const inRange =
                  costMode &&
                  rangeHighlightBounds != null &&
                  date >= rangeHighlightBounds.start &&
                  date <= rangeHighlightBounds.end
                return (
                <button
                  key={date}
                  type="button"
                  onClick={() => (costMode ? handleRangeDayTap(date) : setDayModalDate(date))}
                  className={`flex aspect-square flex-col items-center justify-center rounded-sm border text-sm ${
                    date === today
                      ? 'border-accent bg-accent text-on-accent font-bold'
                      : inRange
                        ? 'border-accent bg-accent/20 text-ink'
                        : 'border-edge bg-surface text-ink'
                  }`}
                >
                  <span>{Number(date.slice(8, 10))}</span>
                  {(monthDaysWithPlan.has(date) || monthDaysWithLog.has(date)) && (
                    <span className="mt-0.5 flex items-center gap-0.5">
                      {monthDaysWithPlan.has(date) && (
                        <span
                          aria-label={ja.mealPlan.monthDayHasPlan}
                          className={`h-1.5 w-1.5 rounded-full ${
                            date === today ? 'bg-app' : 'bg-accent'
                          }`}
                        />
                      )}
                      {/* 「記録あり」の小マーク(2026-07-17 便Z-2。「献立あり」ドットと併記できる) */}
                      {monthDaysWithLog.has(date) && (
                        <span
                          aria-label={ja.mealPlan.monthDayHasLog}
                          className={date === today ? 'text-on-accent' : 'text-accent'}
                        >
                          <Check size={10} strokeWidth={3} aria-hidden />
                        </span>
                      )}
                    </span>
                  )}
                </button>
                )
              })}
            </div>

            {/* 期間の食費の結果カード(便AB): 開始日・終了日の両方が選ばれたら表示。
                2026-07-24 便BH-3・タスク9で基準を明示: 「予定ベース(登録した献立)」と
                「実績ベース(作った記録)」を分けて出す。予定ベースは従来どおり登録人数基準の
                原価合計・1日あたり平均・食数。実績ベースは期間内の記録から実績原価・食数・1食あたりを出す */}
            {costMode && rangeStart != null && rangeEnd != null && (
              <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
                <h2 className="font-bold">{ja.mealPlan.rangeCostResultTitle}</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {ja.mealPlan.rangeCostResultRange
                    .replace('{sm}', String(Number(rangeStart.slice(5, 7))))
                    .replace('{sd}', String(Number(rangeStart.slice(8, 10))))
                    .replace('{em}', String(Number(rangeEnd.slice(5, 7))))
                    .replace('{ed}', String(Number(rangeEnd.slice(8, 10))))
                    .replace('{n}', String(rangeDays))}
                </p>

                {/* 予定ベース */}
                <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
                  {ja.mealPlan.rangeCostPlanLabel}
                </p>
                <p className="mt-0.5 text-2xl font-bold text-accent">
                  約{rangeCostEstimate.total.toLocaleString()}円
                  <span className="ml-2 text-sm font-bold text-ink-muted">
                    （{ja.mealPlan.rangeCostMealCount.replace('{n}', String(rangePlanMealCount))}）
                  </span>
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  {ja.mealPlan.rangeCostResultAverage.replace('{n}', rangeAverageCost.toLocaleString())}
                </p>

                {/* 実績ベース(作った記録) */}
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                  {ja.mealPlan.rangeCostActualLabel}
                </p>
                {rangeActualCost.count > 0 ? (
                  <p className="mt-0.5 text-lg font-bold text-accent">
                    {ja.mealPlan.rangeCostActualResult
                      .replace('{yen}', rangeActualCost.total.toLocaleString())
                      .replace('{n}', String(rangeActualCost.count))
                      .replace('{per}', rangeActualPerMeal.toLocaleString())}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-ink-muted">{ja.mealPlan.rangeCostActualEmpty}</p>
                )}

                <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.mealPlan.weekCostNote}</p>
                <Link
                  to="/prices"
                  className="mt-1 inline-block text-xs font-bold text-accent underline"
                >
                  {ja.mealPlan.weekCostNoteLink}
                </Link>
              </div>
            )}
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
      {/* 週の表示起点の切替(2026-07-24 便BH-3・タスク3): 従来の週区切り⇄今日を先頭に7日間。
          既定は週区切り・選択は記憶する */}
      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setWeekLayout(false)}
          aria-pressed={!rollingWeek}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            !rollingWeek
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.weekLayoutCalendar}
        </button>
        <button
          type="button"
          onClick={() => setWeekLayout(true)}
          aria-pressed={rollingWeek}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            rollingWeek
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.weekLayoutRolling}
        </button>
      </div>

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
          onClick={() => setWeekStart(currentWeekAnchor)}
          aria-label={
            isAtCurrentWeek ? undefined : rollingWeek ? ja.mealPlan.thisWeekRolling : ja.mealPlan.thisWeek
          }
          className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
        >
          {!isAtCurrentWeek && <RotateCcw size={14} className="text-accent" aria-hidden />}
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
      <div className="mt-[var(--space-md)]">{renderSlotFilter()}</div>

      {/* この帯の今週分を空にする(便U-4)。表示帯フィルタのすぐ近くに配置 */}
      <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-sm)]">
        <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.clearWeekSlotTitle}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setClearSlotTarget(slot)}
              aria-pressed={clearSlotTarget === slot}
              aria-label={ja.mealPlan.clearWeekSlotTargetAria.replace('{slot}', ja.mealPlan.slot[slot])}
              className={`rounded-sm border px-3 py-1.5 text-sm font-bold ${
                clearSlotTarget === slot
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-app text-ink-muted'
              }`}
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void clearWeekSlot()}
          className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-warning underline"
        >
          <Trash2 size={14} aria-hidden />
          {ja.mealPlan.clearWeekSlotButton}
        </button>
      </div>

      {/* 自動提案の条件: 時短優先・ジャンル(指定なし/和食/洋食/中華・単一選択)・高たんぱく優先。
          既定は折りたたみ(2026-07-16 UI総点検A-3: 常時全展開がP1/P2一致のゴチャつき指摘だったため)。
          畳んだ状態でも既定値から変わっていればラベルに現在値を出す */}
      <div className="mt-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setSuggestConditionsOpen((v) => !v)}
          aria-expanded={suggestConditionsOpen}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
        >
          {ja.mealPlan.suggestConditionsToggle}
          {!suggestConditionsOpen && conditionsSummary ? `: ${conditionsSummary}` : ''}
          {suggestConditionsOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
        </button>

        {suggestConditionsOpen && (
          <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setQuickOnly((v) => !v)}
              aria-pressed={quickOnly}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                quickOnly ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.quickOnlyToggle}
            </button>
            <button
              type="button"
              onClick={() => setGenreFilter(undefined)}
              aria-pressed={genreFilter === undefined}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                genreFilter === undefined
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.genreAny}
            </button>
            {MEAL_GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setGenreFilter(genre)}
                aria-pressed={genreFilter === genre}
                className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                  genreFilter === genre
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                {genre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreferHighProtein((v) => !v)}
              aria-pressed={preferHighProtein}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                preferHighProtein
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.preferHighProteinToggle}
            </button>
          </div>
        )}
      </div>

      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => void fillWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
        >
          <Dices size={14} aria-hidden />
          {ja.mealPlan.fillWeek}
        </button>
      </div>

      {/* 7日分のカード */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
        {dates.map((date, dayIndex) => (
          <section
            key={date}
            ref={date === today ? todaySectionRef : undefined}
            className={`scroll-mt-[var(--space-md)] rounded-md border p-[var(--space-md)] shadow-sm ${
              date === today ? 'border-accent bg-surface' : 'border-edge bg-surface'
            }`}
          >
            <h2 className="font-bold">
              {dowLabels[dayIndex]} {date.replaceAll('-', '/')}
              {date === today && <span className="ml-2 text-sm text-accent">{ja.mealPlan.todayBadge}</span>}
            </h2>
            <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
              {visibleSlots.map((slot) => {
                const slotKey = `${date}|${slot}`
                const slotEntries = entriesByDateSlot.get(slotKey) ?? []
                const extra = extraRows[slotKey] ?? []
                const mainRows = buildRoleRows(slotEntries, 'main', extra)
                const sideRows = buildRoleRows(slotEntries, 'side', extra)
                const isAddMenuOpen = addMenuFor === slotKey
                // ジャンル混在の控えめ表示(便BH-2・docs/56 §3-10): 主菜のジャンルに対して
                // 副菜が別ジャンルのとき「ジャンル混在」バッジを出す(揃っている枠は無表示)
                const slotMainRecipe = slotEntries
                  .filter((e) => (e.role ?? 'main') === 'main')
                  .map((e) => recipeById.get(e.recipeId))
                  .find((r): r is Recipe => !!r)
                const slotSideRecipes = slotEntries
                  .filter((e) => (e.role ?? 'main') === 'side')
                  .map((e) => recipeById.get(e.recipeId))
                  .filter((r): r is Recipe => !!r)
                const genreMixed = detectGenreMix(slotMainRecipe, slotSideRecipes)
                return (
                  <div key={slot}>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                      {genreMixed && (
                        <span
                          title={ja.mealPlan.genreMixedHint}
                          className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] font-bold text-ink-muted"
                        >
                          {ja.mealPlan.genreMixedBadge}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-1">
                      {mainRows.map((row, i) =>
                        renderRow(date, slot, 'main', row, `main-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`),
                      )}
                      {sideRows.map((row, i) =>
                        renderRow(date, slot, 'side', row, `side-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`),
                      )}
                    </div>
                    {isAddMenuOpen ? (
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            addExtraRow(date, slot, 'main')
                            setAddMenuFor(null)
                          }}
                          className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                        >
                          {ja.mealPlan.role.main}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addExtraRow(date, slot, 'side')
                            setAddMenuFor(null)
                          }}
                          className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                        >
                          {ja.mealPlan.role.side}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMenuFor(null)}
                          aria-label={ja.focus.close}
                          className="rounded-full p-1 text-ink-muted"
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddMenuFor(slotKey)}
                        className="mt-1 text-xs font-bold text-accent"
                      >
                        {ja.mealPlan.addRow}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
            {/* 過去日の振り返り(2026-07-17 便Z-2・docs/35 §3): その日の「作った記録」
                (cookedLogs日付一致)を、予定(エントリ)と視覚区別した薄いカードで表示する。
                予定が実際に作られたか一目で分かる */}
            {isPastDate(date, today) && (cookedLogsByDate.get(date)?.length ?? 0) > 0 && (
              <div className="mt-[var(--space-sm)]">
                <p className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                  <CheckCircle2 size={14} className="text-accent" aria-hidden />
                  {ja.mealPlan.pastCookedTitle}
                </p>
                <ul className="mt-1 space-y-1">
                  {(cookedLogsByDate.get(date) ?? []).map(({ recipe, log }, i) => (
                    <CookedLogCard key={`${recipe.id}-${i}`} recipe={recipe} log={log} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>

      {/* 週の概算食費（2026-07-24 便BH-3・タスク4: 「まとめて献立」直後にいきなり金額が出る違和感を
          解消するため、7日分カードの下=邪魔にならない位置へ移動し、小さな折りたたみ(既定閉)にした。
          価格情報が1件も無い/何も割り当てていない(weekCost===0)ときはセクションごと非表示のまま。
          タスク8: 展開時に「◯食分」も併記する） */}
      {hasPricedRecipe && weekCost > 0 && (
        <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface shadow-sm">
          <button
            type="button"
            onClick={() => setWeekCostOpen((v) => !v)}
            aria-expanded={weekCostOpen}
            className="flex w-full items-center justify-between gap-2 p-[var(--space-md)] text-left"
          >
            <span className="font-bold">{ja.mealPlan.weekCostTitle}</span>
            {weekCostOpen ? (
              <ChevronUp size={18} className="shrink-0 text-accent" aria-hidden />
            ) : (
              <ChevronDown size={18} className="shrink-0 text-accent" aria-hidden />
            )}
          </button>
          {weekCostOpen && (
            <div className="px-[var(--space-md)] pb-[var(--space-md)]">
              <p className="text-2xl font-bold text-accent">
                約{weekCost.toLocaleString()}円
                <span className="ml-2 text-sm font-bold text-ink-muted">
                  （{ja.mealPlan.weekCostMealCount.replace('{n}', String(weekMealCount))}）
                </span>
              </p>
              <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostNote}</p>
              <Link to="/prices" className="mt-1 inline-block text-sm font-bold text-accent underline">
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
            </div>
          )}
        </section>
      )}

      {/* この週の買い物リストを作る */}
      <button
        type="button"
        onClick={goShopping}
        disabled={weekRecipeIds.length === 0}
        className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
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

      {/* レシピ選択ピッカー(週の枠に入れる) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.mealPlan.pickTitle}</h2>
            <button
              type="button"
              onClick={closePicker}
              aria-label={ja.focus.close}
              className="rounded-full p-2 text-ink-muted"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="px-[var(--space-md)]">
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
                  placeholder={ja.mealPlan.pickSearchPlaceholder}
                  className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
                />
              </div>
              {/* 絞り込み・並び替え(タスク6・一覧画面の機構を流用)。既定閉 */}
              <button
                type="button"
                onClick={() => setPickerControlsOpen((v) => !v)}
                aria-expanded={pickerControlsOpen}
                aria-label={ja.search.filterToggle}
                className={`flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-md border bg-surface shadow-sm ${
                  pickerControlsOpen || pickerFilterActive || pickerSort !== 'updated'
                    ? 'border-accent text-accent'
                    : 'border-edge text-ink-muted'
                }`}
              >
                <SlidersHorizontal size={22} aria-hidden />
              </button>
            </div>
          </div>
          {pickerControlsOpen && (
            <div className="mt-[var(--space-sm)] max-h-[40vh] overflow-y-auto px-[var(--space-md)]">
              <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
                <p className="text-sm font-bold text-ink-muted">{ja.search.sortTitle}</p>
                <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                  {PICKER_SORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPickerSort(o.value)}
                      aria-pressed={pickerSort === o.value}
                      className={pickerChipCls(pickerSort === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">{ja.search.timeTitle}</p>
                <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                  {PICKER_TIME_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPickerTime(o.value)}
                      aria-pressed={pickerTime === o.value}
                      className={pickerChipCls(pickerTime === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">{ja.search.effortTitle}</p>
                <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                  {PICKER_EFFORT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPickerEffort(o.value)}
                      aria-pressed={pickerEffort === o.value}
                      className={pickerChipCls(pickerEffort === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">{ja.search.tagTitle}</p>
                <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                  {PICKER_TAG_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setPickerTag(o.value)}
                      aria-pressed={pickerTag === o.value}
                      className={pickerChipCls(pickerTag === o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPickerFavoriteOnly((v) => !v)}
                    aria-pressed={pickerFavoriteOnly}
                    className={pickerChipCls(pickerFavoriteOnly)}
                  >
                    {ja.search.favoriteOnly}
                  </button>
                </div>
              </div>
            </div>
          )}
          <div className="mt-[var(--space-sm)] flex-1 overflow-y-auto px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {displayedRecipes.map((recipe) => {
                  const isSelected = recipe.id === currentPickerRecipeId
                  return (
                  <li key={recipe.id} className={isSelected ? 'bg-accent/10' : undefined}>
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
                      {isSelected && (
                        <span className="shrink-0 rounded-sm border border-accent px-1.5 py-0.5 text-xs font-bold text-accent">
                          {ja.mealPlan.pickCurrentBadge}
                        </span>
                      )}
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
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 月タブ: 日タップでその日の献立を窓表示(便U-5)。朝昼夕・レシピ名・タップで詳細へ、
          +「この週を開く」ボタン。従来の即週ジャンプはこのボタンへ移動した。
          献立の無い日は「献立はありません」+「この週を開く」を表示する */}
      {dayModalDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setDayModalDate(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={dayModalTitle}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{dayModalTitle}</h3>
              <button
                type="button"
                onClick={() => setDayModalDate(null)}
                aria-label={ja.common.close}
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {dayModalEntries.length === 0 ? (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.mealPlan.monthDayModalEmpty}</p>
            ) : (
              <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {MEAL_SLOTS.filter((slot) => (dayModalBySlot.get(slot)?.length ?? 0) > 0).map((slot) => (
                  <div key={slot}>
                    <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                    <ul className="mt-1 space-y-1">
                      {(dayModalBySlot.get(slot) ?? []).map((entry) => {
                        const recipe = recipeById.get(entry.recipeId)
                        if (!recipe) return null
                        return (
                          <li key={entry.id}>
                            <Link
                              to={`/recipes/${recipe.id}`}
                              onClick={() => setDayModalDate(null)}
                              className="block truncate rounded-sm border border-edge bg-app px-2 py-2 text-sm font-bold text-accent"
                            >
                              {recipe.title}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            {/* その日の「作った記録」(2026-07-17 便Z-2・docs/35 §3。画像付き)。
                月間献立への機能追加はPro v2まで凍結が既定だったが、オーナー指示により
                解除してこの表示と「記録あり」マークを実装(README決定ログに記録) */}
            {dayModalLogs.length > 0 && (
              <div className="mt-[var(--space-sm)]">
                <p className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                  <CheckCircle2 size={14} className="text-accent" aria-hidden />
                  {ja.mealPlan.pastCookedTitle}
                </p>
                <ul className="mt-1 space-y-1">
                  {dayModalLogs.map(({ recipe, log }, i) => (
                    <CookedLogCard
                      key={`${recipe.id}-${i}`}
                      recipe={recipe}
                      log={log}
                      onNavigate={() => setDayModalDate(null)}
                    />
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (dayModalDate) goToWeekOf(dayModalDate)
                setDayModalDate(null)
              }}
              className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-app py-3 text-sm font-bold text-accent shadow-sm"
            >
              {ja.mealPlan.monthDayModalOpenWeek}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
