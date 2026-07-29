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
  Copy,
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
  dowIndex,
  sortMealSlots,
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
  preferredProteinSources,
  dishAvoidKeys,
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
  pricelessIngredientNames,
} from '../logic/priceEstimate'
import {
  roundNutrient,
  isNutritionUnlocked,
  nutritionSourceName,
  type NutrientTotals,
} from '../logic/nutrition'
import {
  summarizeRangeIntake,
  dayIntakeMap,
  type DayIntake,
  type RangeCookedDish,
  type RangePlannedDish,
} from '../logic/rangeSummary'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import type {
  CookedLog,
  MealPlanEntry,
  MealRole,
  MealSlot,
  MonthCellMode,
  Recipe,
} from '../db/types'
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

/**
 * 期間の集計「期間内に摂取できた栄養（1人分）」の表示行（8項目。NutritionTeaserと同じ並び）。
 * 2026-07-24 便BS・タスク3で新設し、2026-07-28 便CAで「1食あたりの平均」から
 * 「1人が期間内に食べた分の合計」へ意味を変えた（行の並び自体は据え置き）。
 */
const PERIOD_NUTRIENT_ROWS: { key: keyof NutrientTotals; label: string }[] = [
  { key: 'kcal', label: ja.nutrition.kcalLabel },
  { key: 'proteinG', label: ja.nutrition.proteinLabel },
  { key: 'fatG', label: ja.nutrition.fatLabel },
  { key: 'carbG', label: ja.nutrition.carbLabel },
  { key: 'fiberG', label: ja.nutrition.fiberLabel },
  { key: 'ironMg', label: ja.nutrition.ironLabel },
  { key: 'calciumMg', label: ja.nutrition.calciumLabel },
  { key: 'saltG', label: ja.nutrition.saltLabel },
]
/** YYYY-MM-DD を「7/3」の形にする（期間の集計カードの「どの日をどちらの基準で数えたか」の表示用） */
const formatMonthDay = (date: string): string =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`

/** 月カレンダーのセルに出す情報の切り替え(2026-07-28 便CA・タスク2・オーナー指示)。既定は写真 */
const MONTH_CELL_MODES: { value: MonthCellMode; label: string }[] = [
  { value: 'photo', label: ja.mealPlan.monthCellModePhoto },
  { value: 'nutrition', label: ja.mealPlan.monthCellModeNutrition },
  { value: 'cost', label: ja.mealPlan.monthCellModeCost },
]
const formatNutrient = (key: keyof NutrientTotals, value: number): string => {
  const n = roundNutrient(key, value).toLocaleString()
  if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
  if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
  return `${n} ${ja.nutrition.gramUnit}`
}

/** 未解錠プレビューのサンプルカレンダー(便BS・タスク6)。実データではなく雰囲気を伝えるための飾り。
 * 先頭を2つ空け、写真枠(accentの淡色ブロック)と予定ドットを散らして「写真の残る月間献立」を示す */
const LOCK_SAMPLE_BLANKS = 2
const LOCK_SAMPLE_TODAY_DAY = 15
const LOCK_SAMPLE_PHOTO_DAYS = new Set([3, 6, 10, 13, 15, 19, 22, 27])
const LOCK_SAMPLE_PLAN_DAYS = new Set([2, 8, 16, 20, 24, 29])

/**
 * 月カレンダーの1日分のセル(2026-07-24 便BS・タスク4/5)。その日に「作った記録」があれば写真サムネを
 * セル全面に敷き(日記のように写真で振り返れる)、日付を左上の小バッジに出す。写真の無い記録は従来の
 * 「記録あり」チェックで表す。予定(献立あり)は showPlanDot が true の日(今日・未来日)だけ出し、
 * 2026-07-25 便BU・S-1(docs/59)で点から主菜名(無ければ件数)のプレビューへ強化した
 * (過去日の未達成予定はカレンダーからも消す=便BS・タスク2の方針。mealPlansデータは非破壊で残す)。
 * S-2(docs/59): 予定も記録も無い未来日(isEmptyFuture)は控えめな点線枠で「まだ決めていない日」を可視化する。
 * usePhotoUrlはループ内で直接呼べないため、親でBlobを解決してこのセル単位で1回だけ呼ぶ。
 *
 * 2026-07-28 便CA・タスク2(オーナー指示): mode で表示内容を切り替える。
 *  'photo'   = 既定。従来どおり写真＞献立プレビュー。
 *  'nutrition'/'cost' = その日に1人が食べる分のエネルギー／食費を数字で出す(stat)。
 * 数字モードでは写真を敷かない(小さい文字が写真に埋もれて読めないため・視認性優先)。
 * 数字の色で基準を見分けられるようにする: 実績(作った記録)=accent、予定(登録した献立)=控えめな文字色。
 */
function MonthDayCell({
  date,
  dayNum,
  isToday,
  inRange,
  mode,
  stat,
  showPlanDot,
  planPreview,
  isEmptyFuture,
  hasLog,
  coverPhoto,
  onClick,
}: {
  /** YYYY-MM-DD。e2eからセルを一意に掴むための data-date にも使う */
  date: string
  dayNum: number
  isToday: boolean
  inRange: boolean
  /** セルに出す情報(便CA・タスク2)。既定は 'photo' */
  mode: MonthCellMode
  /** 'nutrition'/'cost' のときに出す、その日の1人分の数字(無い日はundefined) */
  stat?: DayIntake
  showPlanDot: boolean
  /** S-1(docs/59): 今日・未来日の予定プレビュー（主菜名／無ければ「◯件」）。showPlanDotのときだけ出す */
  planPreview?: string
  /** S-2(docs/59): 予定も記録も無い未来日か（＝まだ献立を決めていない日。控えめな点線枠で可視化する） */
  isEmptyFuture: boolean
  hasLog: boolean
  coverPhoto: Blob | undefined
  onClick: () => void
}) {
  const photoUrl = usePhotoUrl(coverPhoto)
  const base =
    'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm border text-sm'

  // 栄養／食費モード: その日の1人分の数字を主役にする(写真は敷かない=視認性優先)
  if (mode !== 'photo') {
    // 7列のセルは375px幅で約46px。「498kcal」は入りきらず途中で切れてしまったため、
    // 栄養モードのセルは数字だけを出し、単位(kcal)は下の凡例と読み上げ(aria-label)で補う。
    // 「314円」は収まるので食費モードは単位を付けたまま(数字だけだと金額に見えないため)
    const cellText = stat
      ? mode === 'nutrition'
        ? Math.round(stat.kcal).toLocaleString()
        : ja.mealPlan.monthCellYen.replace('{n}', stat.yen.toLocaleString())
      : null
    const value = stat
      ? mode === 'nutrition'
        ? ja.mealPlan.monthCellKcal.replace('{n}', Math.round(stat.kcal).toLocaleString())
        : ja.mealPlan.monthCellYen.replace('{n}', stat.yen.toLocaleString())
      : null
    const ariaTemplate = !stat
      ? ja.mealPlan.monthDayStatAriaEmpty
      : stat.basis === 'actual'
        ? ja.mealPlan.monthDayStatAriaActual
        : ja.mealPlan.monthDayStatAriaPlan
    const tone = isToday
      ? 'border-accent bg-accent/20 text-ink'
      : inRange
        ? 'border-accent bg-accent/20 text-ink'
        : stat
          ? 'border-edge bg-surface text-ink'
          : 'border-dashed border-edge bg-surface text-ink-muted'
    return (
      <button
        type="button"
        data-date={date}
        onClick={onClick}
        aria-label={ariaTemplate.replace('{d}', String(dayNum)).replace('{v}', value ?? '')}
        // baseのjustify-centerとぶつからないよう、数字セルはここで独立したクラス列を組む
        className={`relative flex aspect-square flex-col items-center justify-between overflow-hidden rounded-sm border py-1 text-sm ${tone}`}
      >
        {isToday && (
          <span className="absolute inset-0 rounded-sm ring-2 ring-inset ring-accent" aria-hidden />
        )}
        <span
          aria-hidden
          className={`text-[10px] leading-none ${isToday ? 'font-bold text-accent' : 'text-ink-muted'}`}
        >
          {dayNum}
        </span>
        {cellText && (
          <span
            aria-hidden
            className={`w-full truncate px-0.5 text-center text-[10px] font-bold leading-tight tabular-nums ${
              stat?.basis === 'actual' ? 'text-accent' : 'text-ink-muted'
            }`}
          >
            {cellText}
          </span>
        )}
      </button>
    )
  }

  if (photoUrl) {
    // 写真あり: 全面に写真、日付は左上の小バッジ(スクリムで可読性確保)。「記録あり」のaria-labelは維持する
    return (
      <button
        type="button"
        data-date={date}
        onClick={onClick}
        aria-label={ja.mealPlan.monthDayHasLog}
        className={`${base} ${isToday ? 'border-accent' : 'border-edge'}`}
      >
        <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {inRange && <span className="absolute inset-0 bg-accent/40" aria-hidden />}
        {isToday && (
          <span className="absolute inset-0 rounded-sm ring-2 ring-inset ring-accent" aria-hidden />
        )}
        <span
          className={`absolute left-0.5 top-0.5 rounded-sm px-1 text-xs font-bold ${
            isToday ? 'bg-accent text-on-accent' : 'bg-black/55 text-white'
          }`}
        >
          {dayNum}
        </span>
      </button>
    )
  }
  const tone = isToday
    ? 'border-accent bg-accent text-on-accent font-bold'
    : inRange
      ? 'border-accent bg-accent/20 text-ink'
      : isEmptyFuture
        ? // S-2(docs/59): 予定も記録も無い未来日は「まだ決めていない日」が一目で分かる控えめな点線枠＋
          // 淡い数字にする（押し付けがましいバッジは付けない＝規約H）
          'border-dashed border-edge bg-surface text-ink-muted'
        : 'border-edge bg-surface text-ink'
  return (
    <button type="button" data-date={date} onClick={onClick} className={`${base} ${tone}`}>
      <span className="leading-none">{dayNum}</span>
      {/* S-1(docs/59): 今日・未来日の予定は、点ではなく主菜名（無ければ「◯件」）でプレビューし、
          先の予定を月表で読めるようにする（過去日の写真日記＝上の分岐には出さない）。
          従来の点の「献立あり」ラベルはこのプレビューへ引き継ぐ */}
      {showPlanDot && planPreview && (
        <span
          aria-label={ja.mealPlan.monthDayHasPlan}
          className={`mt-0.5 w-full truncate px-0.5 text-center text-[9px] leading-tight ${
            isToday ? 'text-on-accent' : 'text-ink-muted'
          }`}
        >
          {planPreview}
        </span>
      )}
      {hasLog && (
        <span
          aria-label={ja.mealPlan.monthDayHasLog}
          className={`mt-0.5 ${isToday ? 'text-on-accent' : 'text-accent'}`}
        >
          <Check size={10} strokeWidth={3} aria-hidden />
        </span>
      )}
    </button>
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
  // 表示中の週のうち「今日以降」の予定だけ(2026-07-29 便CD/MP-07)。
  // 便BS(2026-07-24)で過去日の予定は週タブの表示から消した(記録だけ残す)が、概算食費と
  // 買い物リストは entries をそのまま集計していたため、画面のどこにも出ていない過去日の献立が
  // 金額と買い物メモに入り、ユーザーは何を消せば減るのか辿れなかった。集計側も
  // 「過去=実績(月タブの期間の集計が担当)・週タブ=これから作る予定」に揃える。
  // データは非破壊(表示と集計から外すだけ)
  const activeEntries = useMemo(
    () => (entries ?? []).filter((e) => !isPastDate(e.date, today)),
    [entries, today],
  )
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
  // 月カレンダーの各日の代表写真(2026-07-24 便BS・タスク4): その日の最初の記録の写真(無ければ
  // そのレシピの写真)をBlobで解決してMap化する。複数記録があっても視認性優先で先頭1枚。
  // usePhotoUrlはセル(MonthDayCell)内で1回だけ呼ぶため、ここではBlobまで(URL化しない)。表示中の月の分だけ
  const monthDayCoverPhoto = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const map = new Map<string, Blob>()
    cookedLogsByDate.forEach((list, date) => {
      if (!date.startsWith(prefix) || list.length === 0) return
      const first = list[0]
      const photo = first.log.photo ?? first.recipe.photo
      if (photo) map.set(date, photo)
    })
    return map
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
  // S-3 先週の献立をコピー(2026-07-25 便BU・docs/59): 表示中の週の1週間前(各日を7日戻した同じ曜日)の
  // 献立を引くためのインデックス。datesを丸ごと-7日した範囲をliveQueryで取得し、date|slotキーでまとめる。
  // ローリング表示・週区切り表示のどちらでも「同じ曜日の1週間前」を指す(shiftDate(-7)が常に週差になるため)
  const prevWeekDates = useMemo(() => dates.map((d) => shiftDate(d, -7)), [dates])
  const prevWeekEntries = useMealPlanRange(prevWeekDates[0], prevWeekDates[6])
  const prevEntriesByDateSlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>()
    prevWeekEntries?.forEach((e) => {
      const key = `${e.date}|${e.slot}`
      const list = map.get(key)
      if (list) list.push(e)
      else map.set(key, [e])
    })
    return map
  }, [prevWeekEntries])

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
  // 過去日は予定(献立)を表示から消し、作った記録だけを日記のように見せる(便BS・タスク2。非破壊)
  const dayModalIsPast = dayModalDate ? isPastDate(dayModalDate, today) : false
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
  // 2026-07-29 便CD/MP-10: 保存されている順(押した順)ではなく必ず 朝食→昼食→夕食 の順にする。
  // 保存時にも並べ直すが、既に「夕食→朝食→昼食」の順で保存済みの端末をその場で直すために
  // 読み出し側でも通す(マイグレーション不要)。各日カードの並び・自動取り込み順・fillWeekの
  // 割り当て順がすべてこの配列を見ているので、ここ1か所で揃う
  const visibleSlots = useMemo(
    () => sortMealSlots(settings?.visibleMealSlots ?? [...MEAL_SLOTS]),
    [settings?.visibleMealSlots],
  )
  const toggleSlot = (slot: MealSlot) => {
    const next = visibleSlots.includes(slot)
      ? visibleSlots.filter((s) => s !== slot)
      : sortMealSlots([...visibleSlots, slot])
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

  // S-1 月セルの未来日プレビュー(2026-07-25 便BU・docs/59): 日付→その日の予定を表す短い文字列。
  // 代表の主菜名(夕食を優先→他の帯の主菜)を出し、主菜が特定できない日は「◯件」に倒す。
  // recipeByIdはhideStarters反映済みなので、隠したレシピ由来の枠は件数側に倒れる。
  // 実際に出すのは呼び出し側でshowPlanDot(今日・未来日)の日だけ＝過去日の写真日記(便BS)は触らない
  const monthDayPreview = useMemo(() => {
    const byDate = new Map<string, MealPlanEntry[]>()
    monthEntries?.forEach((e) => {
      const list = byDate.get(e.date)
      if (list) list.push(e)
      else byDate.set(e.date, [e])
    })
    const map = new Map<string, string>()
    byDate.forEach((dayEntries, date) => {
      const mains = dayEntries.filter((e) => (e.role ?? 'main') === 'main')
      const rep = mains.find((e) => e.slot === 'dinner') ?? mains[0]
      const title = rep ? recipeById.get(rep.recipeId)?.title : undefined
      map.set(date, title ?? `${dayEntries.length}件`)
    })
    return map
  }, [monthEntries, recipeById])

  // 期間の食費(便AB): ハイライト表示用の範囲(開始日のみ選択中は単日をそのまま範囲として扱う)。
  // 結果カードは rangeStart/rangeEnd が両方そろって初めて出す(こちらはハイライト専用)
  const rangeHighlightBounds = useMemo(() => {
    if (rangeStart == null) return null
    return rangeEnd == null ? { start: rangeStart, end: rangeStart } : { start: rangeStart, end: rangeEnd }
  }, [rangeStart, rangeEnd])
  const rangeDays = rangeStart != null && rangeEnd != null ? rangeDayCount(rangeStart, rangeEnd) : 0
  // 表示中の月の「作った記録」と「登録した献立」を、期間集計・セル表示の共通入力の形に整える
  // (2026-07-28 便CA)。monthEntries(表示中の月のカレンダー内)から作るため「月をまたぐ期間は
  // 月表示範囲内に限定してよい」の仕様を自然に満たす(月をまたぐ選択自体はmonthAnchor変更時の
  // リセットで防止済み)。記録側はhideStartersに関わらず全レシピ(実際に作った履歴のため)、
  // 予定側はrecipeById(hideStarters反映済み)を使う=従来の集計と同じ対象範囲
  const monthCookedDishes = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const out: RangeCookedDish[] = []
    cookedLogsByDate.forEach((list, date) => {
      if (!date.startsWith(prefix)) return
      list.forEach(({ recipe, log }) => out.push({ date, recipe, log }))
    })
    return out
  }, [cookedLogsByDate, monthAnchor])
  const monthPlannedDishes = useMemo(() => {
    const out: RangePlannedDish[] = []
    monthEntries?.forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (recipe) out.push({ date: e.date, recipe })
    })
    return out
  }, [monthEntries, recipeById])
  /**
   * 期間の集計(2026-07-28 便CA・オーナー確定仕様)。
   * ①平均をやめ「1人が期間内に食べた分の合計」を出す ②過去日は作った記録・今日以降は登録した献立
   * だけで数える(過去の予定ベース表示は廃止)。詳細な理由は logic/rangeSummary.ts のコメント。
   */
  const rangeSummary = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return null
    return summarizeRangeIntake({
      start: rangeStart,
      end: rangeEnd,
      today,
      cooked: monthCookedDishes,
      planned: monthPlannedDishes,
      priceIndex,
    })
  }, [rangeStart, rangeEnd, today, monthCookedDishes, monthPlannedDishes, priceIndex])
  // 1人あたり1日の食費(便CA): 期間の1人分合計を日数で割る。従来の「1日あたり」は予定ベースの
  // 全体金額÷日数だったが、予定が今日以降だけになったので「1人分の合計÷日数」に置き換えた
  const rangePersonalPerDay =
    rangeSummary != null && rangeDays > 0 ? Math.round(rangeSummary.personalYen / rangeDays) : 0

  // 月カレンダーのセル表示(便CA・タスク2): 既定は写真。栄養/食費モードのときだけ日ごとの1人分を計算する
  const monthCellMode: MonthCellMode = settings?.monthCellMode ?? 'photo'
  const monthDayStats = useMemo(() => {
    if (monthCellMode === 'photo') return new Map<string, DayIntake>()
    return dayIntakeMap({
      dates: monthDatesList,
      today,
      cooked: monthCookedDishes,
      planned: monthPlannedDishes,
      priceIndex,
    })
  }, [monthCellMode, monthDatesList, today, monthCookedDishes, monthPlannedDishes, priceIndex])

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
    // 副菜行のサイコロにも、ペア提案(suggestPairForSlot)・まとめて献立と同じ条件を効かせる
    // (2026-07-29 便CD/MP-05)。従来この非ペア経路だけが role しか渡しておらず、
    // 「副菜を純粋な副菜に寄せる(preferDishType)」も「主菜のジャンルに揃える(genre)」も
    // 効いていなかったため、8割が別ジャンル・2割が汁物になっていた。最も使われる動線が
    // 最も手当てされていなかった箇所。あわせて主菜との食材・食感の重複回避も渡す(MP-04)。
    // 一品ものの主菜でもここでは提案する(ユーザーが明示的に押した行を無反応にしない)
    const slotMainRecipe =
      role === 'side'
        ? slotEntries
            .filter((e) => (e.role ?? 'main') === 'main')
            .map((e) => recipeById.get(e.recipeId))
            .find((r): r is Recipe => !!r)
        : undefined
    const picked = suggestForSlot(
      visibleRecipes,
      role === 'side'
        ? {
            ...baseOptions,
            role,
            preferDishType: 'side' as const,
            genre: genreFilter ?? (slotMainRecipe ? recipeGenre(slotMainRecipe) : undefined),
            avoidKeys: slotMainRecipe ? dishAvoidKeys(slotMainRecipe) : undefined,
            excludeRecipeIds: slotMainRecipe?.id != null ? [slotMainRecipe.id] : undefined,
          }
        : { ...baseOptions, role },
    )
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
    // 「今週まだ少ないたんぱく源」の算出は logic/mealPlan.ts の純関数に切り出した
    // (2026-07-29 便CD/MP-03。テストで守れるようにするため。'その他'の主菜が構造的に
    // 出なくなっていた欠陥と、主菜プールが強制ローテーションになる副作用の修正も同関数側)
    const preferProteinSources = (): ProteinSource[] => preferredProteinSources(proteinCounts)

    const baseOpts = {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      genre: genreFilter,
      preferHighProtein,
      yesterdayRecipeIds,
    }

    // 実際にDBへ追加した品数(2026-07-29 便CD/MP-06)。結果メッセージはこの実数で出す。
    // plan.slotsToFill.length で判定してはいけない(一品ものスキップ・候補0件で0品追加になる)
    let added = 0

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
        added++
      }
      if (side) {
        await addMealEntry(date, slot, side.id!, 'side', true)
        usedRecipeIds.push(side.id!)
        added++
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
          // 手動で入れた主菜とも食材・食感を重ねない(2026-07-29 便CD/MP-04)
          avoidKeys: mainRecipe ? dishAvoidKeys(mainRecipe) : undefined,
          excludeRecipeIds: mainRecipe?.id != null ? [mainRecipe.id] : undefined,
        })
        if (side) {
          await addMealEntry(date, slot, side.id!, 'side', true)
          usedRecipeIds.push(side.id!)
          added++
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
          added++
        }
      }
    }

    // 結果メッセージ(2026-07-29 便CD/MP-06で正直な出し分けに修正)。
    // 従来は「残す枠が1つでもあれば」だけを見て「空いていた枠に献立を立てました」と言っていたため、
    // 1品も追加していない(行のサイコロで全部埋めた後など)ときにも「立てました」と嘘を言っていた。
    // 実際に追加した品数(added)で分岐し、0品なら0品と伝える
    const messages: string[] = []
    const preserved = plan.preservedSlotKeys.size
    if (added > 0) {
      if (preserved > 0) {
        messages.push(
          ja.mealPlan.fillWeekKeptManual
            .replace('{n}', String(preserved))
            .replace('{a}', String(added)),
        )
      }
    } else if (preserved > 0) {
      messages.push(ja.mealPlan.fillWeekNoRoom.replace('{n}', String(preserved)))
    } else {
      messages.push(ja.mealPlan.fillWeekNoAdded)
    }
    // 今日を含む週で「今日の献立」(日タブ)がどうなるかの案内(2026-07-22 便BE・タスク2 →
    // 2026-07-29 便CD/MP-01で出し分けを修正)。自動取り込みは「同じ日につき1回だけ」なので、
    // まだ今日の取り込みが済んでいなければ、次に日タブを開いた時点で今日の分が取り込まれる。
    // 済んでいれば自動では変わらない。日/週の同期モデル自体(週=計画・日=当日・1日1回取り込み)は
    // 現行設計のまま維持し、案内文だけを実挙動に合わせる
    const todayRefilled =
      plan.slotsToFill.some((s) => s.date === today) || plan.partialFills.some((s) => s.date === today)
    if (todayRefilled && (todayList?.length ?? 0) > 0) {
      messages.push(
        settings?.lastAutoImportDate === today
          ? ja.mealPlan.fillWeekTodayNotice
          : ja.mealPlan.fillWeekTodayWillImport,
      )
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

  /**
   * S-3 先週の献立をコピー(2026-07-25 便BU・docs/59)。
   * 表示中の週の各日(今日・未来日のみ)へ、その1週間前の同じ曜日の献立を「空いている枠だけ」複製する。
   * - 既にある枠(手動配置・自動提案由来のどちらも)は上書きしない＝非破壊。空き枠にだけ入れる設計。
   * - コピーした枠は手動配置(auto=false)として保存する：ユーザーが意図して「先週を写した」枠なので、
   *   次の「まとめて献立を立てる」で再抽選(上書き)されないよう保護側に倒す(既存のauto/手動保護と整合)。
   * - 過去日・非表示帯は対象外(週タブの編集グリッドと同じ範囲)。
   * 確認文は規約F準拠で「入る件数」と「今ある献立は上書きされず残る」を明示する(消える予定は無い)。
   */
  const copyLastWeek = async () => {
    setMessage('')
    const ops: { date: string; slot: MealSlot; recipeId: number; role: MealRole }[] = []
    let sourceTotal = 0
    for (const date of dates) {
      if (isPastDate(date, today)) continue
      const src = shiftDate(date, -7)
      for (const slot of visibleSlots) {
        const srcEntries = prevEntriesByDateSlot.get(`${src}|${slot}`) ?? []
        sourceTotal += srcEntries.length
        // 既にある枠は上書きしない(手動・自動とも残す)。空いている枠にだけ先週の分を入れる
        if ((entriesByDateSlot.get(`${date}|${slot}`) ?? []).length > 0) continue
        srcEntries.forEach((e) => {
          ops.push({ date, slot, recipeId: e.recipeId, role: e.role ?? 'main' })
        })
      }
    }
    if (ops.length === 0) {
      // 先週にそもそも献立が無い場合と、空き枠が無い(全部埋まっている)場合を出し分ける
      setMessage(sourceTotal === 0 ? ja.mealPlan.copyLastWeekNoSource : ja.mealPlan.copyLastWeekNoRoom)
      return
    }
    if (!window.confirm(ja.mealPlan.copyLastWeekConfirm.replace('{n}', String(ops.length)))) return
    // auto=false(既定)で追加＝手動配置として保護される
    for (const op of ops) {
      await addMealEntry(op.date, op.slot, op.recipeId, op.role)
    }
    setMessage(ja.mealPlan.copyLastWeekDone.replace('{n}', String(ops.length)))
  }

  // 週タブ「この帯の今週分を空にする」(便U-4 Fable設計: 「朝のみ削除したい」への回答)。
  // 帯を1つ選び、確認ダイアログを経てから、表示中の週(dates[0]〜dates[6]。週タブで
  // 前後移動している場合はその週)のうちその帯のエントリだけをまとめて削除する。
  // 概算食費(weekCostEstimate)は表示帯(visibleSlots)では絞らず「登録されている献立全部」を
  // 集計する仕様のままなので、この削除は自動的に金額へ反映される。
  // ただし過去日は集計から外している(2026-07-29 便CD/MP-07。表示から消えている予定が
  // 金額に入っていると何を消せば減るのか辿れないため)
  const [clearSlotTarget, setClearSlotTarget] = useState<MealSlot>('dinner')
  const clearWeekSlot = async () => {
    const label = ja.mealPlan.slot[clearSlotTarget]
    // 規約F(2026-07-29 便CD/MP-19): 「何が消えるか(件数つき)」と「何が残るか」を両方書く。
    // clearMealSlotInRangeは表示中の週の全日(過去日を含む)を消すので、件数も同じ範囲で数える
    const targetCount = (entries ?? []).filter((e) => e.slot === clearSlotTarget).length
    if (targetCount === 0) {
      setMessage(ja.mealPlan.clearWeekSlotEmpty.replace('{slot}', label))
      return
    }
    if (
      !window.confirm(
        ja.mealPlan.clearWeekSlotConfirm
          .replace('{slot}', label)
          .replace('{n}', String(targetCount)),
      )
    )
      return
    await clearMealSlotInRange(dates[0], dates[6], clearSlotTarget)
    setMessage(
      ja.mealPlan.clearWeekSlotDone.replace('{slot}', label).replace('{n}', String(targetCount)),
    )
  }

  // 週の概算食費（材料ごとの価格入力を優先し、未入力の材料は食材価格マスタで補う。docs/20 §3）
  // 集計対象は activeEntries(今日以降)。過去日は週タブに表示されないので金額から辿れない
  // (2026-07-29 便CD/MP-07)。過ぎた分の実績は月タブの「期間の栄養と食費」が担当する
  const weekCostEstimate = useMemo(
    () => sumMealPlanEntriesCost(activeEntries, recipeById, priceIndex),
    [activeEntries, recipeById, priceIndex],
  )
  const weekCost = weekCostEstimate.total
  // 概算食費の食数(=食事の回数。主菜+副菜が並ぶ枠も1食。2026-07-24 便BH-3・タスク8「◯食分」併記)
  const weekMealCount = useMemo(() => mealOccasionCount(activeEntries), [activeEntries])
  // 価格が分からない材料の種類数(2026-07-29 便CD/MP-11)。この分は合計に1円も入っていない
  const weekPricelessCount = useMemo(
    () => pricelessIngredientNames(activeEntries, recipeById, priceIndex).length,
    [activeEntries, recipeById, priceIndex],
  )
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

  /**
   * 買い物リストに渡すレシピと、その週に作る回数（2026-07-29 便CC/C10）。
   * 従来はレシピIDの重複を捨てていたため、同じ料理が週に2回入っていても材料は1回分しか
   * 出ず、買い物メモが実際の必要量に足りていなかった。回数を数えて倍率として渡す。
   */
  const weekRecipeCounts = useMemo(() => {
    const counts = new Map<number, number>()
    // 過ぎた日の材料は買わせない(2026-07-29 便CD/MP-07): 集計対象は activeEntries(今日以降)
    activeEntries.forEach((e) => {
      if (visibleSlots.includes(e.slot)) counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1)
    })
    // 「今日の献立」(今日つくるリスト)の分も買い物候補に含める。
    // 週の表を使わず今日の献立だけで運用する人の材料が漏れないように
    // (2026-07-09 ペルソナテスト第1波)。週の表に既にある品は回数を増やさない
    // (同じ食事を週の表と今日の献立で二重に数えないため)
    todayList?.forEach((item) => {
      if (!counts.has(item.recipeId)) counts.set(item.recipeId, 1)
    })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntries, settings?.visibleMealSlots, todayList])

  const weekRecipeIds = useMemo(() => Array.from(weekRecipeCounts.keys()), [weekRecipeCounts])

  const goShopping = () => {
    if (weekRecipeCounts.size === 0) return
    // 「id」または「idx回数」の並び（買い物側は logic/shopping.ts parseRecipeIdsParam で読む）
    const param = Array.from(weekRecipeCounts, ([id, times]) =>
      times > 1 ? `${id}x${times}` : String(id),
    ).join(',')
    navigate(`/shopping?recipeIds=${param}`)
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
                  {/* 週タブの「まとめて献立を立てる」との違いを一言で示す
                      (2026-07-29 便CD/MP-15。名前が近く区別が付かないという指摘) */}
                  <p className="-mt-1 text-xs text-ink-muted">{ja.mealPlan.todaySuggestHint}</p>
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

            {/* カレンダーに出す情報の切り替え(2026-07-28 便CA・タスク2・オーナー指示)。
                既定は写真＞献立プレビュー。栄養/食費に切り替えると各セルにその日の1人分の数字が出る。
                選択は設定に記憶する(次に月タブを開いても同じ表示) */}
            <div
              role="group"
              aria-label={ja.mealPlan.monthCellModeLabel}
              className="mt-[var(--space-sm)] flex gap-1"
            >
              {MONTH_CELL_MODES.filter(
                (m) => m.value !== 'nutrition' || isNutritionUnlocked(isPro),
              ).map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => void updateSettings({ monthCellMode: m.value })}
                  aria-pressed={monthCellMode === m.value}
                  className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    monthCellMode === m.value
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* 期間の栄養と食費モード(2026-07-17 便AB・docs/35 §5 → 2026-07-28 便CAで改訂)。
                押すたびにON/OFFを切り替え、切り替え時は選択もリセットする(再度押せば選び直せる) */}
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
                // 予定プレビュー(主菜名/件数・S-1)は今日・未来日だけ。過去日の未達成予定はカレンダーからも
                // 消す(便BS・タスク2。作った記録は写真/チェックで別途出す=非破壊)。
                // S-2: 予定も記録も無い未来日(今日より後)は控えめな点線枠で「まだ決めていない日」を可視化する
                const isEmptyFuture =
                  date > today && !monthDaysWithPlan.has(date) && !monthDaysWithLog.has(date)
                return (
                  <MonthDayCell
                    key={date}
                    date={date}
                    dayNum={Number(date.slice(8, 10))}
                    isToday={date === today}
                    inRange={!!inRange}
                    mode={monthCellMode}
                    stat={monthDayStats.get(date)}
                    showPlanDot={monthDaysWithPlan.has(date) && !isPastDate(date, today)}
                    planPreview={monthDayPreview.get(date)}
                    isEmptyFuture={isEmptyFuture}
                    hasLog={monthDaysWithLog.has(date)}
                    coverPhoto={monthDayCoverPhoto.get(date)}
                    onClick={() =>
                      costMode ? handleRangeDayTap(date) : setDayModalDate(date)
                    }
                  />
                )
              })}
            </div>
            {/* 数字モードの読み方(便CA・タスク2): 単位と、どの日をどちらの基準で数えているかを添える。
                セル内に単位まで入れると小さすぎて読めないため、凡例で補う(視認性優先) */}
            {monthCellMode !== 'photo' && (
              <p className="mt-1 text-xs text-ink-muted">
                {monthCellMode === 'nutrition'
                  ? ja.mealPlan.monthCellNutritionLegend
                  : ja.mealPlan.monthCellCostLegend}
              </p>
            )}

            {/* 期間の栄養と食費の結果カード(便AB → 2026-07-28 便CAでオーナー確定仕様に改訂)。
                開始日・終了日の両方が選ばれたら表示。
                ①「1人が期間内に食べた分の合計」を主役にする(平均は出さない)
                ②過去日は作った記録・今日以降は登録した献立だけで数える(過去の予定ベース表示は廃止)
                ③オーナー指示で「作った食数の合算(全体食費)」は残す */}
            {costMode && rangeStart != null && rangeEnd != null && rangeSummary != null && (
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
                {/* どの日をどちらの基準で数えたかを必ず明示する(混在する期間＝当月などのため) */}
                <p className="mt-0.5 text-xs text-ink-muted">
                  {rangeSummary.actual.range && rangeSummary.plan.range
                    ? ja.mealPlan.rangeBasisBoth
                        .replace('{ps}', formatMonthDay(rangeSummary.actual.range.start))
                        .replace('{pe}', formatMonthDay(rangeSummary.actual.range.end))
                        .replace('{fs}', formatMonthDay(rangeSummary.plan.range.start))
                        .replace('{fe}', formatMonthDay(rangeSummary.plan.range.end))
                    : rangeSummary.actual.range
                      ? ja.mealPlan.rangeBasisActualOnly
                      : ja.mealPlan.rangeBasisPlanOnly}
                </p>

                {rangeSummary.actual.dishCount + rangeSummary.plan.dishCount === 0 ? (
                  <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                    {ja.mealPlan.rangeIntakeEmpty}
                  </p>
                ) : (
                  <>
                    {/* 期間内に摂取できた栄養(1人分・便CA): 期間内の料理を1食ずつ足した合計。
                        既存のPro8項目計算を流用し「めやす／概算」表記を厳守する。
                        栄養フラグ&&Pro(isNutritionUnlocked)かつ計算できた品数>0のときだけ出す */}
                    {isNutritionUnlocked(isPro) && rangeSummary.nutrition.dishCount > 0 && (
                      <div className="mt-[var(--space-sm)]">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-ink-muted">
                            {ja.mealPlan.rangeIntakeNutritionLabel}
                          </p>
                          <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
                            {ja.nutrition.estimateBadge}
                          </span>
                        </div>
                        <div
                          className="mt-1 rounded-md border border-edge p-[var(--space-sm)]"
                          style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
                        >
                          {/* 期間合計は1食分より桁が大きく(1か月で数万kcal)、ラベルと値を横並びにすると
                              375px幅で「エネルギー」が途中改行される。項目名の上に値を置く2段組にして
                              桁が伸びても崩れないようにする(2026-07-28 便CA・視認性優先) */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                            {PERIOD_NUTRIENT_ROWS.map(({ key, label }) => (
                              <div key={key} className="flex flex-col">
                                <span className="text-xs text-ink-muted">{label}</span>
                                <span className="text-sm font-bold text-accent tabular-nums">
                                  {formatNutrient(key, rangeSummary.nutrition.total[key])}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <p className="mt-1 text-xs text-ink-muted">
                          {(rangeSummary.actual.nutrition.dishCount > 0 &&
                          rangeSummary.plan.nutrition.dishCount > 0
                            ? ja.mealPlan.rangeIntakeNutritionCountBoth
                            : rangeSummary.actual.nutrition.dishCount > 0
                              ? ja.mealPlan.rangeIntakeNutritionCountActual
                              : ja.mealPlan.rangeIntakeNutritionCountPlan
                          )
                            .replace('{a}', String(rangeSummary.actual.nutrition.dishCount))
                            .replace('{p}', String(rangeSummary.plan.nutrition.dishCount))}
                        </p>
                        {rangeSummary.nutrition.excludedDishCount > 0 && (
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {ja.mealPlan.rangeIntakeNutritionExcluded.replace(
                              '{n}',
                              String(rangeSummary.nutrition.excludedDishCount),
                            )}
                          </p>
                        )}
                        {/* 量が書いてあるのに計算できなかった材料があるレシピは、合計を静かに下げる。
                            既にある「除いた品数」の明示と同じ作法で件数を出す(2026-07-28 便BY/NUT-01) */}
                        {rangeSummary.nutrition.partialDishCount > 0 && (
                          <p className="mt-0.5 text-xs font-bold text-warning">
                            {ja.mealPlan.rangeIntakeNutritionPartial.replace(
                              '{n}',
                              String(rangeSummary.nutrition.partialDishCount),
                            )}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {ja.nutrition.sourcePrefix}
                          {nutritionSourceName()}
                          {'　'}
                          {ja.nutrition.sourceCommercialNote}
                        </p>
                      </div>
                    )}

                    {/* 期間内の食費(1人分・便CA): 栄養と同じ数え方＝料理1品につき1人分の金額を1回足す */}
                    <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                      {ja.mealPlan.rangeIntakePersonalCostLabel}
                    </p>
                    <p className="mt-0.5 text-2xl font-bold text-accent">
                      約{rangeSummary.personalYen.toLocaleString()}円
                    </p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {ja.mealPlan.rangeIntakePersonalCostPerDay.replace(
                        '{n}',
                        rangePersonalPerDay.toLocaleString(),
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {ja.mealPlan.rangeIntakeCostBreakdown
                        .replace('{a}', rangeSummary.actual.personalYen.toLocaleString())
                        .replace('{an}', String(rangeSummary.actual.dishCount))
                        .replace('{p}', rangeSummary.plan.personalYen.toLocaleString())
                        .replace('{pn}', String(rangeSummary.plan.dishCount))}
                    </p>

                    {/* 作った食数の合算(全体食費)はオーナー指示で残す。家族全員分の金額と延べ食数 */}
                    {rangeSummary.cookedMealCount > 0 && (
                      <>
                        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                          {ja.mealPlan.rangeIntakeHouseholdLabel}
                        </p>
                        <p className="mt-0.5 text-lg font-bold text-accent">
                          {ja.mealPlan.rangeIntakeHouseholdResult
                            .replace('{yen}', rangeSummary.cookedHouseholdYen.toLocaleString())
                            .replace('{n}', String(rangeSummary.cookedMealCount))}
                        </p>
                      </>
                    )}
                  </>
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
          // 未解錠ユーザーへの鍵付きプレビュー(2026-07-24 便BS・タスク6・規約H準拠)。月タブを完全に
          // 隠さず、ぼかしたサンプルカレンダーの上に、機能の性質を素直に説明するロック案内を重ねる
          // (卑下しない・購入圧を強くしない)。サンプルは飾りなのでaria-hidden
          <div className="mt-[var(--space-md)]">
            <div className="relative overflow-hidden rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
              <div
                aria-hidden
                className="pointer-events-none select-none opacity-70 blur-[3px]"
              >
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-muted">
                  {ja.mealPlan.dow.map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>
                <div className="mt-1 grid grid-cols-7 gap-1">
                  {Array.from({ length: 35 }, (_, i) => {
                    const dayNum = i - LOCK_SAMPLE_BLANKS + 1
                    const inMonth = dayNum >= 1 && dayNum <= 31
                    const isSampleToday = dayNum === LOCK_SAMPLE_TODAY_DAY
                    const hasPhoto = inMonth && LOCK_SAMPLE_PHOTO_DAYS.has(dayNum)
                    const hasPlan = inMonth && LOCK_SAMPLE_PLAN_DAYS.has(dayNum)
                    return (
                      <div
                        key={i}
                        className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm border text-xs ${
                          isSampleToday
                            ? 'border-accent bg-accent font-bold text-on-accent'
                            : 'border-edge bg-app text-ink-muted'
                        }`}
                      >
                        {hasPhoto && !isSampleToday && (
                          <span
                            className="absolute inset-0"
                            style={{ background: 'color-mix(in oklab, var(--accent) 35%, var(--bg))' }}
                          />
                        )}
                        <span className="relative">{inMonth ? dayNum : ''}</span>
                        {hasPlan && !hasPhoto && !isSampleToday && (
                          <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
              {/* ロックの案内(機能の性質を素直に説明・購入圧を強くしすぎない) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-app/40 p-[var(--space-md)] text-center backdrop-blur-[1px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-surface px-3 py-1 text-sm font-bold text-accent shadow-sm">
                  <Lock size={14} aria-hidden />
                  {ja.mealPlan.monthLockedBadge}
                </span>
                <p className="mt-1 font-bold">{ja.mealPlan.monthLockedTitle}</p>
                <p className="text-sm text-ink-muted">{ja.mealPlan.monthLockedDescription}</p>
                <Link
                  to="/settings?section=pro"
                  className="mt-1 inline-block text-sm font-bold text-accent underline"
                >
                  {ja.mealPlan.monthProGateLink}
                </Link>
              </div>
            </div>
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
      {/* 2つの表示の違いを一言で示す(2026-07-29 便CD/MP-14)。名前だけでは意味が分からず
          3体が切替自体を触っていなかった */}
      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.weekLayoutHint}</p>


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
        {/* S-3(docs/59): 先週の献立を空き枠だけにコピー。上書きはしない=非破壊(確認文で件数と「残る」を明示) */}
        <button
          type="button"
          onClick={() => void copyLastWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
        >
          <Copy size={14} aria-hidden />
          {ja.mealPlan.copyLastWeek}
        </button>
      </div>
      {/* 「おまかせで提案」(日タブ)との違いが名前から分からないという指摘への1行説明
          (2026-07-29 便CD/MP-15) */}
      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.fillWeekHint}</p>


      {/* 7日分のカード */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
        {dates.map((date) => (
          <section
            key={date}
            ref={date === today ? todaySectionRef : undefined}
            className={`scroll-mt-[var(--space-md)] rounded-md border p-[var(--space-md)] shadow-sm ${
              date === today ? 'border-accent bg-surface' : 'border-edge bg-surface'
            }`}
          >
            <h2 className="font-bold">
              {/* 曜日は必ず日付から引く(2026-07-29 便CD/MP-02)。並び順(配列インデックス)で
                  引いていたため、「今日から7日間」表示では今日が月曜の日以外は全行の曜日が
                  日付と食い違っていた(水曜に「月 2026/07/29 今日」と出る) */}
              {dowLabels[dowIndex(date)]} {date.replaceAll('-', '/')}
              {date === today && <span className="ml-2 text-sm text-accent">{ja.mealPlan.todayBadge}</span>}
            </h2>
            {/* 今日・未来日は編集可能な予定グリッド。過去日は予定を表示から消し、下の「作った記録」
                だけを日記のように見せる(便BS・タスク2。mealPlansデータは非破壊で残す) */}
            {!isPastDate(date, today) && (
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
                // 一品もの(丼・麺・カレー・鍋)の日は副菜を意図的に空ける(docs/56 §3-8)。
                // その理由が画面に一切出ず「提案が1品だけ失敗した」ように見えていたので、
                // 副菜が空のときだけ1行で理由を添える(2026-07-29 便CD/MP-18)。
                // 「足したい人」も選べることを併記して、足す/足さないの好みの割れに両対応する
                const showOneDishNote =
                  !!slotMainRecipe && isOneDish(slotMainRecipe) && slotSideRecipes.length === 0
                return (
                  <div key={slot}>
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                      {/* 2026-07-29 便CD/MP-08: 説明がtitle属性(ホバー)にしかなく、スマホでは
                          物理的に到達できなかった。タップで説明をトーストに出すボタンにする
                          (静止時の見た目は従来と同じ＝docs/56 §3-10「うるさくしない」を維持) */}
                      {genreMixed && (
                        <button
                          type="button"
                          title={ja.mealPlan.genreMixedHint}
                          aria-label={ja.mealPlan.genreMixedAria}
                          onClick={() => setMessage(ja.mealPlan.genreMixedHint)}
                          className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] font-bold text-ink-muted"
                        >
                          {ja.mealPlan.genreMixedBadge}
                        </button>
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
                    {showOneDishNote && (
                      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.oneDishNote}</p>
                    )}
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
            )}
            {/* 過去日の振り返り(2026-07-17 便Z-2・docs/35 §3・便BSで「記録だけ残す」へ強化):
                その日の「作った記録」(cookedLogs日付一致)を写真付きの薄いカードで表示する。
                達成しなかった予定は上のグリッドごと消えているので、ここが過去日の主役になる。
                記録が無い過去日は控えめな空案内だけ出す */}
            {isPastDate(date, today) &&
              ((cookedLogsByDate.get(date)?.length ?? 0) > 0 ? (
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
              ) : (
                <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                  {ja.mealPlan.pastNoRecord}
                </p>
              ))}
            {/* 過ぎた日は「予定を消した」のではなく「表示していないだけ」を明示する
                (2026-07-29 便CD/MP-07。枠が突然出てこないことに一瞬止まる、への対応) */}
            {isPastDate(date, today) && (
              <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.pastPlanHidden}</p>
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
              {/* どの範囲を数えているか(2026-07-29 便CD/MP-07)。過ぎた日は集計から外したので、
                  黙って数字だけ変えずに範囲を明記する */}
              <p className="mt-1 text-sm text-ink-muted">
                {ja.mealPlan.weekCostRange
                  // 先の週を見ているときは その週の初日 が起点。当週なら今日が起点
                  .replace('{start}', (dates[0] > today ? dates[0] : today).replaceAll('-', '/'))
                  .replace('{end}', dates[6].replaceAll('-', '/'))}
              </p>
              <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostNote}</p>
              {/* 価格が分からない材料の分は1円も入っていない＝数字の信頼度を明示する
                  (2026-07-29 便CD/MP-11) */}
              {weekPricelessCount > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  {ja.mealPlan.weekCostPriceless.replace('{n}', String(weekPricelessCount))}
                </p>
              )}
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
                // 「設定画面で登録すると比較できます」だけでは行き止まりだったので、
                // 予算の入力欄へ直接移動できるボタンを添える(2026-07-29 便CD/MP-11)
                <div className="mt-1">
                  <p className="text-sm text-ink-muted">{ja.mealPlan.budgetNotSet}</p>
                  <Link
                    to="/settings?section=budget"
                    className="mt-1 inline-block rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent shadow-sm"
                  >
                    {ja.mealPlan.budgetSetLink}
                  </Link>
                </div>
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
            {dayModalIsPast ? (
              // 過去日: 予定は表示から消す(便BS・タスク2)。記録が無ければ空案内だけ出す(記録があれば下の
              // 「作った記録」ブロックが主役になる)。mealPlansデータは削除しない=非破壊
              dayModalLogs.length === 0 ? (
                <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.mealPlan.pastNoRecord}</p>
              ) : null
            ) : dayModalEntries.length === 0 ? (
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
