/**
 * 献立の画面の「状態と手続き」（2026-08-27 便LQ・docs/74 第4手）。
 *
 * MealPlanPage.tsx が8,931行あり、便が全員その真ん中を触っていたので、
 * 画面の本体から**そのまま**取り出した。中身は1文字も変えていない
 * ＝見た目も動きも変わらない。変わったのは「どのファイルに書いてあるか」だけ。
 * 変えたのは import の書き方（相対パスが1つ深くなる）と、末尾の return だけ。
 *
 * ここには **JSX が1つも無い**（画面に出す形＝render* 関数と JSX は MealPlanPage.tsx に
 * 残してある）。だからこのファイルは .tsx ではなく .ts で足りる＝
 * 「見た目はあちら・状態と手続きはこちら」の線が、拡張子そのもので保たれる。
 *
 * **早期returnが1つも無い**画面なので、フックの呼び順は取り出す前と同じ並びのまま
 * （211個の呼び出しが、元のファイルと同じ順に、同じ位置で並んでいる）。
 * 呼び順が変わらないので、React から見ると取り出す前とまったく同じ画面になる。
 *
 * 画面を日／週／月に分けるときは、子に `ctx: ReturnType<typeof useMealPlanState>` を
 * 渡せばよく、props の型を手で書き写さずに済む。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes, addCookedLog, removeOneTapCookedLog, deleteCookedLog } from '../../db/recipes'
import { useSettings, updateSettings } from '../../db/settings'
import { usePriceEntries } from '../../db/prices'
import { usePantryItems } from '../../db/pantry'
import { pantryAvailableNames } from '../../logic/pantry'
import {
  searchRecipes,
  topTagsByUsage,
  type TimeFilter,
  type EffortFilter,
  type TagFilter,
} from '../../logic/search'
import { sortResults, type RecipeSortOption } from '../../logic/recipeSort'
import {
  useMealPlanRange,
  addMealEntry,
  updateMealEntryRecipe,
  removeMealEntry,
  assignMealEntryByRole,
  removeMealEntries,
  updateMealEntryServings,
  restoreDayMealPlan,
  restoreMealEntries,
  addRecipesToToday,
} from '../../db/mealPlan'
import { useDayNoteRange, saveDayNote } from '../../db/dayNotes'
import { deleteDetachedLogWithSnapshot, restoreDetachedRecord } from '../../db/detachedLogs'
import { useMealPlanLocks, toLockKeySet, applyMealLockToggle } from '../../db/mealPlanLocks'
import { useMealTemplates, saveMealTemplate, deleteMealTemplate } from '../../db/mealTemplates'
import { buildTemplateItems, planTemplateFill, ALL_DOWS } from '../../logic/mealTemplate'
import { buildPlanSheet, type PlanSheet } from '../../logic/planSheet'
import { sharePlanSheetImage } from '../../logic/planSheetImage'
import { useConfirm } from '../../components/ConfirmProvider'
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  undoTodayListCooked,
  markAllTodayListCooked,
  importRecipeIdsToTodayList,
  removeStaleFromPlanTodayList,
  restoreTodayListItems,
} from '../../db/todayList'
import {
  MEAL_SLOTS,
  MEAL_GENRES,
  toggleMealGenre,
  normalizePlanGenres,
  weekDates,
  weekStartForDate,
  sortMealSlots,
  shiftDate,
  isPastDate,
  planDefaultFoldedDates,
  monthDates,
  monthLeadingBlanks,
  suggestCandidates,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  preservedItemCount,
  todayListPickedIds,
  showsCookedPlanRowToday,
  normalizeDateRange,
  rangeDates,
  rangeDayCount,
  isOneDish,
  recipeGenre,
  isMainDish,
  proteinSourceOf,
  preferredProteinSources,
  dishAvoidKeys,
  cookedPlanEntryIds,
  mealOccasionCount,
  mealRoleForRecipe,
  chooseBalancedPair,
  PURPOSE_REDRAW_ATTEMPTS,
  isMealEditBlocked,
  isDayMealLocked,
  planClearMealSlots,
  normalizePlanFillMode,
  monthDayWindowView,
  WEEK_GROUP_DEFAULT_OPEN,
  PLAN_QUICK_MINUTES_OPTIONS,
  DEFAULT_PLAN_QUICK_MINUTES,
} from '../../logic/mealPlan'
import type {
  FillWeekPlan,
  MealGenre,
  MealSlotEdit,
  PlanFillMode,
  ProteinSource,
  SuggestPairResult,
} from '../../logic/mealPlan'
import { effectiveMealServings, defaultMealServings } from '../../logic/servings'
import { hasOneTapCookedLog } from '../../logic/cooked'
import {
  filterShoppingEntries,
  formatShoppingRangeLabel,
  isShoppingRangeNarrowed,
  shoppingRangeIncludesTodayList,
  type ShoppingRange,
} from '../../logic/shopping'
import { todayString } from '../../logic/date'
import {
  clearCookNaviSession,
  hasCookNaviTimeline,
  loadCookNaviSession,
  reconcileSelectedIds,
  COOK_NAVI_MIN_RECIPES,
} from '../../logic/cookNaviSession'
import {
  buildPriceIndex,
  estimateRecipeCost,
  sumMealPlanEntriesCost,
  pricelessIngredientNames,
  pricelessIngredientNamesOfRecipes,
} from '../../logic/priceEstimate'
import {
  computeRecipeNutrition,
  resolveNutritionDisplayKey,
  type NutrientTotals,
} from '../../logic/nutrition'
import {
  summarizeRangeIntake,
  rangeIntakeRecipes,
  dayIntakeMap,
  type DayIntake,
  type RangeCookedDish,
  type RangePlannedDish,
} from '../../logic/rangeSummary'
import {
  dayBalanceMap,
  slotBalances,
  summarizeWeekBalance,
  purposePenalty,
  riceServingRecipes,
  riceSlotKey,
  riceSlotKeysOf,
  riceServingsByDate,
  type RiceSlotInput,
  RICE_SERVING_RECIPE,
  type BalanceDish,
  type BalanceRecipeLike,
  type SlotBalance,
} from '../../logic/nutritionBalance'
import { canUseMonthTrial, isMonthTrialReady } from '../../logic/proTrial'
import { pickDayCoverPhoto, setDayCoverChoice } from '../../logic/monthCover'
import { diffDayEdit, type DayEditDiff } from '../../logic/dayEdit'
import type { MonthDemoData } from '../../logic/monthDemo'
import { useOverlayDismiss } from '../../components/useOverlayDismiss'
import { useScrollLock } from '../../components/useScrollLock'
import type {
  CookedLog,
  DayNote,
  DetachedCookedRecord,
  MealPlanEntry,
  MealPurpose,
  MealRole,
  MealSlot,
  MonthCellMode,
  Recipe,
  Settings,
  TodayListItem,
} from '../../db/types'
import {
  DAY_RETURN_KEY,
  DAY_SUGGEST_PIN_KEY,
  MEAL_PLAN_TAB_TAP_KEY,
  MONTH_RETURN_KEY,
  WEEK_RETURN_KEY,
  WEEK_RETURN_PARAM,
  type ReturnAnchor,
  forgetRecipesTabPath,
  parseSuggestionPin,
  parseSuggestionPlanPin,
  parseViewReturn,
  parseWeekReturn,
  pickReturnAnchor,
  readSessionItem,
  removeSessionItem,
  scrollTargetForAnchor,
  serializeSuggestionPin,
  serializeViewReturn,
  serializeWeekReturn,
  writeSessionItem,
} from '../../logic/navMemory'
import { type CookedLogDetailTarget } from '../../components/CookedLogDetailModal'
import {
  useDetachedLogEntries,
  type DetachedLogEntry,
} from '../../components/useDetachedLogEntries'
import { shouldShowHomeScreenNoticeNow } from '../../logic/homeScreenNotice'
// Pro案内から設定へ飛ぶときの帰り道（2026-08-27 便LU）
import { settingsLinkWithBack } from '../../logic/backLink'
import { ja } from '../../i18n/ja'

/** 献立タブの3タブ構成（2026-07-16 便U-1: 現行の「今日セクション+週/月切替」をタブへ再構成） */
type MealPlanViewMode = 'day' | 'week' | 'month'

/**
 * 週タブからレシピ詳細を開くときに持ち回る出所（2026-08-07 便DT-2・オーナー指示）。
 * 詳細画面の「戻る」は、今日の献立と同じ例外としてここへ帰る（RecipeDetailPage）。
 * `restore=1` が付いているときだけ、週タブは覚えた週とスクロール位置を復元する。
 */
export const WEEK_RETURN_LINK_STATE = {
  from: 'mealPlanWeek',
  fromPath: `/meal-plan?focus=week&${WEEK_RETURN_PARAM}=1`,
} as const

/**
 * 「栄養から組む」（2026-08-02 便CP-2 → 2026-08-07 便DT-9で8軸へ。旧称「目的」）の表示ラベル。
 * 数値の項目名（たんぱく質/塩分相当量）とは別物。軸が増えたら型エラーになるよう
 * Record で全件を書き切る（if の連鎖にすると足し忘れが黙って通る）。
 */
const PURPOSE_LABEL: Record<MealPurpose, string> = {
  protein: ja.mealPlan.purposeProtein,
  fiber: ja.mealPlan.purposeFiber,
  iron: ja.mealPlan.purposeIron,
  calcium: ja.mealPlan.purposeCalcium,
  lowEnergy: ja.mealPlan.purposeLowEnergy,
  lowFat: ja.mealPlan.purposeLowFat,
  lowCarb: ja.mealPlan.purposeLowCarb,
  lowSalt: ja.mealPlan.purposeLowSalt,
}
const purposeLabelOf = (purpose: MealPurpose): string => PURPOSE_LABEL[purpose]

/** YYYY-MM-DD を「7/3」の形にする（期間の集計カードの「どの日をどちらの基準で数えたか」の表示用） */
export const formatMonthDay = (date: string): string =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`
/**
 * 栄養の日ごと集計で「記録と献立が同じ料理か」を突き合わせるキー（2026-08-09 便EK）。
 * 今日は記録と献立が同居しうるので、同じ料理を両方で数えないための鍵になる。
 * ごはん（便CW-10で足す1杯）はレシピIDを持たないため、専用のキーを1つ用意する。
 */
const RICE_BALANCE_MATCH_KEY = 'rice'
const balanceMatchKey = (recipeId: number | undefined): string | undefined =>
  recipeId == null ? undefined : `recipe:${recipeId}`

/** 「＋枠を追加」で増やした、まだレシピが割り当てられていない行（DBには保存しないUIだけの状態） */
export interface ExtraRow {
  localId: string
  role: MealRole
}

/** 参照が変わらない空配列（デモで「端末の予定は使わない」を表すために使う） */
const EMPTY_ENTRIES: MealPlanEntry[] = []
/** 同上。デモ中は「レシピを削除しても残っている記録」も見せない（2026-08-16 便GZ） */
const EMPTY_DETACHED_ENTRIES: DetachedLogEntry[] = []

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

export function useMealPlanState(demo?: MonthDemoData) {
  const confirm = useConfirm()
  /** サンプルデモとして開いているか（データの差し替えと、書き込み操作を出さない判定に使う） */
  const isDemo = demo != null
  const navigate = useNavigate()
  const location = useLocation()
  const dbRecipes = useLiveQuery(listRecipes, [])
  // レシピピッカーの「よく使うタグ」: 便DIのレシピ一覧側と同じ頻度集計に統一
  // (2026-08-03 司令部追随。従来はコード直書きの「作り置き/お弁当」の2択だった)
  const pickerTagOptions = useMemo<{ value: TagFilter; label: string }[]>(
    () => [
      { value: 'all', label: ja.search.tagAll },
      ...topTagsByUsage(dbRecipes ?? [], 8).map((t) => ({ value: t, label: t })),
    ],
    [dbRecipes],
  )
  const recipes = isDemo ? demo.recipes : dbRecipes
  // レシピを削除しても残っている記録（2026-08-16 便GZ）。サンプルデモは端末のデータを見せない
  // 画面なので、デモ中は空にする（recipes を demo.recipes に差し替えているのと同じ扱い）
  const dbDetachedEntries = useDetachedLogEntries()
  const detachedEntries = isDemo ? EMPTY_DETACHED_ENTRIES : dbDetachedEntries
  const [searchParams, setSearchParams] = useSearchParams()
  const dbSettings = useSettings()
  /** デモ中の設定はメモリだけに持つ（カレンダーの表示切替などをその場で試せるようにするため） */
  const [demoSettings, setDemoSettings] = useState<Settings | undefined>(() => demo?.settings)
  const settings = isDemo ? demoSettings : dbSettings
  /**
   * この画面からの設定変更は必ずここを通す。デモ中はメモリ上の設定だけを書き換え、
   * 端末の設定（IndexedDB）には一切触れない
   */
  const saveSettings = (patch: Partial<Omit<Settings, 'id'>>) => {
    if (isDemo) {
      setDemoSettings((current) => (current ? { ...current, ...patch } : current))
      return
    }
    void updateSettings(patch)
  }
  /**
   * 設定「ふだん作る人数」（2026-08-03 便DK・オーナー確定
   * 「3人家族なら予算や買い物メモは3人分で計算した数値が必要。栄養は1人当たりのみで十分」）。
   * 枠ごとに食数を決めていない献立を、最初から何人分として扱うか。未設定＝従来どおり
   * レシピの登録人数分。効く先は買い物メモの分量と、これから作る予定の概算食費だけで、
   * 栄養（1人分）はこの値をいっさい見ない。
   */
  const householdServings = settings?.householdServings
  // 食材価格マスタ（未入力の材料だけ目安価格で補うフォールバック。docs/20 §3）
  const dbPriceEntries = usePriceEntries()
  const priceEntries = isDemo ? demo.priceEntries : dbPriceEntries
  const priceIndex = useMemo(() => buildPriceIndex(priceEntries ?? []), [priceEntries])
  // レシピ選択ピッカーの並び替え「在庫一致順」用の在庫食材名（2026-07-24 便BH-3・タスク6・
  // 一覧画面の並び替え機構を流用）
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  // デモは固定の見本月なので「今日」も見本の日付にする（過ぎた日=記録・今日から先=献立の
  // 切り分けが、実時間で開いた日によって変わらないようにするため）
  const today = useMemo(() => demo?.today ?? todayString(), [demo])
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
  /**
   * 「?focus=week&date=YYYY-MM-DD」で開いたのに、**表示のしかたの設定がまだ端末から
   * 届いていなくて**週の起点を決められなかったときの、その日付（2026-08-23 便JL）。
   * 届いてからこの日付で決め直す＝未取得を「週区切り」と決めつけない。
   */
  const pendingWeekStartDateRef = useRef<string | null>(null)
  useEffect(() => {
    if (weekModeInitRef.current) return
    if (settings === undefined) return
    weekModeInitRef.current = true
    // 日付の指定つきで開かれていたら、その日付を優先する（今日の週へ寄せない）
    const pending = pendingWeekStartDateRef.current
    pendingWeekStartDateRef.current = null
    if (pending) {
      setWeekStart(weekStartForDate(pending, settings.weekStartsToday === true))
      return
    }
    if (settings.weekStartsToday) setWeekStart(today)
  }, [settings, today])
  // 週タブの表示起点を切り替える(選択を設定に記憶し、weekStartを各モードの「現在」に合わせ直す)
  const setWeekLayout = (rolling: boolean) => {
    saveSettings({ weekStartsToday: rolling })
    setWeekStart(rolling ? today : weekDates(new Date())[0])
  }
  // 今、当週(=各モードの「現在」)を見ているか(Fix1: 中央チップの「戻る」ラベル/アイコンは
  // 現在以外のときだけ出す)。従来表示=当週の月曜、今日起点表示=今日、が「現在」の起点
  const currentWeekAnchor = rollingWeek ? today : weekDates(new Date())[0]
  const isAtCurrentWeek = dates[0] === currentWeekAnchor
  // デモでは週タブを出さないので、端末の週の予定は読んでも使わない（見本の月の予定だけで組む）
  const dbEntries = useMealPlanRange(dates[0], dates[6])
  const entries = isDemo ? EMPTY_ENTRIES : dbEntries
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
  /**
   * 献立のロック（2026-08-08 便DX・オーナー指示）。
   * 鍵の掛かっている食事（'日付|食事'）は、自動でまとめて動かす操作
   * （まとめて献立を入力・テンプレートを適用・先週の献立をコピー・まとめて空にする・
   * 月タブの献立をまとめて提案）の対象から外れる。手での追加・差し替え・削除は自由。
   * 期間で切らず全件を読む＝週・月・日の窓のどこから見ても同じ鍵を見るため
   * （1件が数十バイトの小さな表で、掛けた食事のぶんしか行が無い）。
   */
  const mealPlanLocks = useMealPlanLocks()
  const lockedKeys = useMemo(() => toLockKeySet(mealPlanLocks), [mealPlanLocks])
  /** 鍵の掛け外しを1か所に集約する（掛けた/外したの案内もここで出す） */
  const toggleMealLock = async (toggle: { lock: { date: string; slot: MealSlot }[]; unlock: { date: string; slot: MealSlot }[] }, scope: 'one' | 'all') => {
    await applyMealLockToggle(toggle)
    const locking = toggle.lock.length > 0
    // 2026-08-27 便LT: 掛けたときの知らせは「ロックしました。」だけ（i18n/ja.ts の lockDone 参照）。
    // 何ができなくなるかは、枠の「ロック中」と、変えようとした瞬間の lockedEditBlocked が言う
    const done = locking
      ? scope === 'all'
        ? ja.mealPlan.lockAllDone
        : ja.mealPlan.lockDone
      : scope === 'all'
        ? ja.mealPlan.lockAllReleaseDone
        : ja.mealPlan.lockReleaseDone
    setMessage(done)
  }

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

  // 3タブ（日/週/月。月はPro機能・既存ゲート維持）。既定は「日」タブ（デモは月タブ固定で開く）
  const [viewMode, setViewMode] = useState<MealPlanViewMode>(isDemo ? 'month' : 'day')
  const [monthAnchor, setMonthAnchor] = useState(() => demo?.today ?? todayString())
  const isPro = !!settings?.proCode
  /**
   * 月間献立の恒常お試し（2026-08-02 便CP-2・docs/62 決定③）。
   * 未解錠でも1回だけ、**本人の記録・献立が入った本物の月タブ**をフル表示する
   * （空のカレンダーを試用させるのは、いちばん貧しい状態を見せることになるため）。
   * monthTrialActive はこの画面の状態なので、月タブを離れる／画面を離れるとロック表示に戻る。
   * 使ったかどうかだけを settings.monthTrialUsed に残す（端末内の緩いフラグ）。
   */
  const [monthTrialActive, setMonthTrialActive] = useState(false)
  /**
   * 「作った記録」の総件数。記録が少ないうちはお試しの入口を出さないための判定に使う
   * （2026-08-02 オーナー指摘。記録0件で1回きりのお試しを使い切ると、ほぼ空のカレンダーを
   * 見せて終わってしまう）。記録はレシピに埋め込みの配列なので全レシピぶんを合算する
   */
  const cookedLogCount = useMemo(
    () => (recipes ?? []).reduce((sum, r) => sum + r.cookedLogs.length, 0),
    [recipes],
  )
  const monthTrialReady = isMonthTrialReady(cookedLogCount)
  const monthTrialUnused = !isPro && canUseMonthTrial(settings?.monthTrialUsed)
  /** お試しの入口を出してよいか（まだ使っていない＋記録が十分たまっている） */
  const monthTrialAvailable = monthTrialUnused && monthTrialReady
  /** 月タブの中身を出してよいか（解錠済み or お試し表示中）。月タブ配下のPro表示はこれで判定する */
  const monthUnlocked = isPro || monthTrialActive
  const startMonthTrial = () => {
    if (!monthTrialAvailable) return
    setMonthTrialActive(true)
    saveSettings({ monthTrialUsed: true })
  }
  // 「閉じたらロックへ戻る」: 月タブから離れた時点でお試し表示を終える
  useEffect(() => {
    if (viewMode !== 'month') setMonthTrialActive(false)
  }, [viewMode])
  const monthDatesList = useMemo(
    () => monthDates(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  const monthLeading = useMemo(
    () => monthLeadingBlanks(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  // 今、当月を見ているか(Fix2: 中央チップの「今月へ戻る」ラベル/アイコンは当月以外のときだけ出す)
  const isAtCurrentMonth = monthAnchor.slice(0, 7) === today.slice(0, 7)
  const dbMonthEntries = useMealPlanRange(
    monthDatesList[0],
    monthDatesList[monthDatesList.length - 1],
  )
  // デモは見本の献立をそのまま使う（月を移動すると、その月には見本の予定が無いので空になる）
  const demoMonthEntries = useMemo(() => {
    if (!demo) return EMPTY_ENTRIES
    const start = monthDatesList[0]
    const end = monthDatesList[monthDatesList.length - 1]
    return demo.entries.filter((e) => e.date >= start && e.date <= end)
  }, [demo, monthDatesList])
  const monthEntries = isDemo ? demoMonthEntries : dbMonthEntries
  const monthDaysWithPlan = useMemo(() => {
    const set = new Set<string>()
    monthEntries?.forEach((e) => set.add(e.date))
    return set
  }, [monthEntries])
  // 週タブ(entries)と月タブ(monthEntries)の献立を1本に束ねたもの(2026-07-29 便CB-1・docs/59 A-3)。
  // 月タブの日モーダルから直接 追加/差し替え/削除できるようにしたため、行の描画・行サイコロ・
  // 「作った見た目」の対応付けが「表示中の週の外の日」でも同じ結果にならなければならない。
  // 2つの期間は重なりうるので、idをキーにして重複を落としてから1本にする
  const allPlanEntries = useMemo(() => {
    const byId = new Map<number, MealPlanEntry>()
    const collect = (list: MealPlanEntry[] | undefined) =>
      list?.forEach((e) => {
        if (e.id != null) byId.set(e.id, e)
      })
    collect(entries)
    collect(monthEntries)
    return Array.from(byId.values())
  }, [entries, monthEntries])
  // 過去振り返り(2026-07-17 便Z-2・docs/35 §3): 日付→その日の「作った記録」のインデックス。
  // 全レシピのcookedLogsを1回の走査でMap化する(記録件数が多い場合に日付ごとのfilterを
  // 繰り返さないための仕様指定のuseMemoインデックス)。hideStarters設定に関わらず全レシピを
  // 対象にする(「実際に作った」履歴のため。HistoryPage・「最近作ったもの」と同じ方針)
  // logIndex（recipe.cookedLogs の何番目か）も持たせる＝記録の小窓から編集へ渡すため(便EQ)
  const cookedLogsByDate = useMemo(() => {
    const map = new Map<string, { recipe: Recipe; log: CookedLog; logIndex: number }[]>()
    recipes?.forEach((recipe) => {
      recipe.cookedLogs.forEach((log, logIndex) => {
        const list = map.get(log.date)
        if (list) list.push({ recipe, log, logIndex })
        else map.set(log.date, [{ recipe, log, logIndex }])
      })
    })
    return map
  }, [recipes])
  /**
   * レシピを削除したあとも残っている記録（2026-08-16 便GZ・オーナー承認）。日付ごとに引ける形にする。
   *
   * **cookedLogsByDate とは別に持つ**のが要点。cookedLogsByDate は栄養・食費・ごはんの杯数・
   * 献立の枠との突き合わせ（cookedPlanEntryIdSet）の入力にもなっているが、削除済みレシピの記録には
   * 材料が無い（レシピ本体を消しているので、何をどれだけ使ったかが端末に残っていない）。
   * 同じ入れ物に混ぜると「中身が0の料理を1品作った」と数えてしまい、期間の食費・栄養が
   * 実際より低く出る。混ぜるのは**記録として読む場所**（月の✓マーク・カレンダーの写真・
   * 日の窓の一覧・週タブの過去日カード・献立表の料理名）だけにする。
   */
  const detachedLogsByDate = useMemo(() => {
    const map = new Map<string, DetachedLogEntry[]>()
    detachedEntries?.forEach((entry) => {
      const list = map.get(entry.log.date)
      if (list) list.push(entry)
      else map.set(entry.log.date, [entry])
    })
    return map
  }, [detachedEntries])
  /** その日の記録（レシピが残っているもの＋削除済みのもの）。記録として読む場所だけがこれを使う */
  const shownLogsOf = useMemo(
    () =>
      (date: string): (CookedLogDetailTarget & { detachedRecordId?: number })[] => {
        const own = cookedLogsByDate.get(date)
        const detached = detachedLogsByDate.get(date)
        if (!detached) return own ?? []
        return [...(own ?? []), ...detached]
      },
    [cookedLogsByDate, detachedLogsByDate],
  )
  /**
   * 押した記録の中身を出す小窓(2026-08-09 便EQ)。null なら閉じている。
   * 週タブの過去日カード・月タブの日の窓・献立の枠(作った！済み)の3か所から同じ小窓を開く。
   */
  const [logDetail, setLogDetail] = useState<CookedLogDetailTarget | null>(null)
  /**
   * 献立の枠（作った！済みで薄くなっている行）に対応する記録を探す(便EQ)。
   * 枠と記録は「同じ日に同じレシピ」で結び付いている（cookedPlanEntryIdSet と同じ考え方）ので、
   * その日の記録のうち同じレシピの先頭1件を返す。同じ日に同じ料理を2回作った場合は
   * 1件目を開く（枠ごとの取り違えより、開けないことの方が困るため）。
   */
  const cookedLogForEntry = (date: string, recipeId: number | undefined) =>
    recipeId == null
      ? undefined
      : cookedLogsByDate.get(date)?.find(({ recipe }) => recipe.id === recipeId)
  // 「作った見た目」対応付け(2026-07-24 便BH-3・タスク2): 各エントリのうち、その日の
  // 「作った記録」に対応する枠のidを集合で持つ(cookedPlanEntryIdsで日ごとに先着消費。
  // 同名複数の枠は記録件数の分だけ・非破壊=表示のみ)。日タブで「作った!」を押して記録が付くと、
  // 週側の該当枠がここに入り、renderRowで作った見た目に変わる。
  // 2026-07-29 便CB-1・A-3: 対象を週+月の合算(allPlanEntries)にして、月タブの日モーダルの行でも
  // 同じ「作った見た目」になるようにした(週タブの見え方は変わらない=同じ日の同じ枠を数えるため)
  const cookedPlanEntryIdSet = useMemo(() => {
    const result = new Set<number>()
    const byDate = new Map<string, MealPlanEntry[]>()
    allPlanEntries.forEach((e) => {
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
  }, [allPlanEntries, cookedLogsByDate])
  // 月タブ: 「記録あり」小マーク(✓)を出す日の集合(便Z-2。表示中の月の分だけ)
  const monthDaysWithLog = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const set = new Set<string>()
    const add = (_: unknown, date: string) => {
      if (date.startsWith(prefix)) set.add(date)
    }
    cookedLogsByDate.forEach(add)
    // 削除済みレシピの記録がある日にも印を出す（2026-08-16 便GZ）。
    // 出さないと、記録は残っているのにカレンダー上では「作らなかった日」に見える
    detachedLogsByDate.forEach(add)
    return set
  }, [cookedLogsByDate, detachedLogsByDate, monthAnchor])
  // 月カレンダーの各日の代表写真(2026-07-24 便BS・タスク4 → 2026-08-07 便DUで選び方を作り直した)。
  // 選び方そのものは純関数 logic/monthCover.ts の pickDayCoverPhoto に置いてある
  // (作った記録の写真 ＞ レシピの写真／日ごとの指名／レシピの写真を使わない、の3つを1か所で決める)。
  // 便DU以前は「その日の**先頭の記録**の写真 ?? そのレシピの写真」だったため、1品目に写真が無い日は
  // 2品目に写真があってもレシピの写真が出ていた(オーナー指摘「レシピのサムネしか出ない」の真因)。
  // usePhotoUrlはセル(MonthDayCell)内で1回だけ呼ぶため、ここではBlobまで(URL化しない)。表示中の月の分だけ
  const monthHideRecipePhoto = settings?.monthHideRecipePhoto === true
  const monthDayCoverRecipe = settings?.monthDayCoverRecipe
  const monthDayCoverPhoto = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const map = new Map<string, Blob>()
    const dates = new Set([...cookedLogsByDate.keys(), ...detachedLogsByDate.keys()])
    dates.forEach((date) => {
      if (!date.startsWith(prefix)) return
      const own = (cookedLogsByDate.get(date) ?? []).map(({ recipe, log }) => ({
        recipeId: recipe.id ?? -1,
        logPhoto: log.photo,
        recipePhoto: recipe.photo,
      }))
      // 削除済みレシピの記録の写真もカレンダーに出す（2026-08-16 便GZ）。レシピ番号を持たないので、
      // 「この日はどの料理を出すか」の指名（正の番号で覚えている）とぶつからない負の番号を当てる。
      // レシピ側の写真は無い（レシピを消しているため）ので記録の写真だけが候補になる。
      // 並びは残っているレシピの記録が先＝写真の選ばれ方はこれまでと変わらない
      const detached = (detachedLogsByDate.get(date) ?? []).map((entry) => ({
        recipeId: -(entry.detachedRecordId + 1),
        logPhoto: entry.log.photo,
        recipePhoto: undefined,
      }))
      if (own.length === 0 && detached.length === 0) return
      const pick = pickDayCoverPhoto([...own, ...detached], {
        chosenRecipeId: monthDayCoverRecipe?.[date],
        hideRecipePhoto: monthHideRecipePhoto,
      })
      if (pick) map.set(date, pick.photo)
    })
    return map
  }, [cookedLogsByDate, detachedLogsByDate, monthAnchor, monthDayCoverRecipe, monthHideRecipePhoto])
  // 月タブ: 日タップで開くその日の献立モーダル（便U-5。従来の即週ジャンプはモーダル内の
  // ボタンへ移動）。nullなら非表示
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  /**
   * 月タブの日の窓の「編集モード」（2026-08-23 便JN・オーナー原文
   * 「献立／月／・見た目を週に寄せて、編集ボタンをつけて。」）。
   *
   * 覚え方は週タブとまったく同じ（編集している日の日付1つだけ・logic/mealPlan.ts の
   * planToggleDayEdit）。窓は一度に1日ぶんしか開かないので、これで足りる。
   * 別の日の窓を開けばその日付には当たらないので、開き直すたび必ず通常表示から始まる。
   */
  const [monthEditDate, setMonthEditDate] = useState<string | null>(null)
  /**
   * 月タブの日の窓から「この週を開く」（2026-08-20 便IG・⑩。オーナー原文
   * 「月から「この週を開く」したときは、記録がある日は開いた状態、選んだ日付まで
   *   スクロールして表示。」）。
   *
   * 曜日カードの既定は便ID・⑦で「過ぎた日は畳む／献立のある未来の日は開く」になっている。
   * ここはそれとぶつかるので、**月から来たときだけの上書き**として作る＝
   * 人が押して開け閉めした記憶（dayFoldOverrides）に、その週の「記録がある日」を
   * 開いた状態として書き込む。既定そのものは触らないので、週タブを普通に開いたときの
   * 見え方は変わらない（別の週の日付にも当たらない＝キーが日付だから）。
   *
   * 開く日の決め方は「その日に作った記録があるか」だけ＝今日が何曜日でも何日でも通る
   * （曜日・月替わりの前提を置かない）。
   *
   * 並べる7日は**その端末の表示のしかた**（週区切り／今日から7日間）で出す（2026-08-23 便JL。
   * それまでは表示のしかたに関わらず月曜始まりで出しており、「今日から7日間」で使っている人が
   * 押すと、見ている7日間の区切りが黙って月曜始まりに変わっていた）。
   */
  const goToWeekOf = (date: string) => {
    const start = weekStartForDate(date, rollingWeek)
    const weekOfDate = Array.from({ length: 7 }, (_, i) => shiftDate(start, i))
    setWeekStart(start)
    setDayFoldOverrides((prev) => {
      const next = { ...prev }
      for (const d of weekOfDate) {
        if (shownLogsOf(d).length > 0) next[d] = false
      }
      return next
    })
    // 選んだ日のカードまで送る（既にある仕組み＝?focus=week&date= と同じ経路に乗せる）
    setPendingScrollDate(date)
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
  /* 2026-08-08 便EA(オーナーの質問「手入力で日付変更もできるようにすれば月跨ぎでも計算できる?」
     への対応): 月をまたぐ期間を計算できるようにした。
     従来は①月を移動すると選択をリセット ②集計の入力が表示中の月のぶんだけ、の2点で
     月またぎができなかった。①はこの便で廃止し、②は選んだ期間そのものを読む
     （rangeCookedDishes / rangePlannedDishes）に差し替えた。
     開始日・終了日は日付欄への手入力でも変えられる（カレンダーのタップと併用）。 */
  /** 日付欄（手入力）から開始日・終了日を差し替える。両方そろったら開始<=終了に正規化する */
  const setRangeBound = (which: 'start' | 'end', value: string) => {
    const next = value || null
    const start = which === 'start' ? next : rangeStart
    const end = which === 'end' ? next : rangeEnd
    if (start != null && end != null) {
      const [s, e] = normalizeDateRange(start, end)
      setRangeStart(s)
      setRangeEnd(e)
      return
    }
    setRangeStart(start)
    setRangeEnd(end)
  }
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
  // 同じものを週+月の合算で持つ（2026-07-29 便CB-1・A-3）。月タブの日モーダルの行は
  // 表示中の週の外の日を扱うので、行の描画・行サイコロはこちらを見る
  const entriesByDateSlotAll = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>()
    allPlanEntries.forEach((e) => {
      const key = `${e.date}|${e.slot}`
      const list = map.get(key)
      if (list) list.push(e)
      else map.set(key, [e])
    })
    return map
  }, [allPlanEntries])
  // 月タブの日タップモーダル用（monthEntries由来なので表示帯フィルタに関係なく朝昼夕すべてを見せる）
  const dayModalEntries = useMemo(() => {
    if (!dayModalDate) return []
    return (monthEntries ?? []).filter((e) => e.date === dayModalDate)
  }, [monthEntries, dayModalDate])
  const dayModalBySlot = useMemo(() => groupBySlot(dayModalEntries), [dayModalEntries])
  // 月タブの日モーダルに出す、その日の「作った記録」(便Z-2)。
  // 削除済みレシピの記録もここに並べる(2026-08-16 便GZ。写真・ひとことメモは小窓から読める)
  const dayModalLogs = dayModalDate ? shownLogsOf(dayModalDate) : []
  /**
   * 「カレンダーに出す写真」の候補（2026-08-07 便DU・オーナー指示⑥）。
   * その日の記録のうち、実際にカレンダーへ出せる写真を持つものだけを、料理1品につき1つ並べる
   * （押しても何も変わらない選択肢を出さないため。同じレシピを2回作った日は先頭の1つにまとめる）。
   * 「レシピの写真は使わない」を選んでいるときは、記録の写真がある品だけが候補になる。
   */
  const dayModalCoverOptions = useMemo(() => {
    if (!dayModalDate) return []
    const logs = cookedLogsByDate.get(dayModalDate) ?? []
    const seen = new Set<number>()
    const options: { recipeId: number; title: string; photo: Blob }[] = []
    logs.forEach(({ recipe, log }) => {
      const id = recipe.id
      if (id == null || seen.has(id)) return
      const photo = log.photo ?? (monthHideRecipePhoto ? undefined : recipe.photo)
      if (!photo) return
      seen.add(id)
      options.push({ recipeId: id, title: recipe.title, photo })
    })
    return options
  }, [cookedLogsByDate, dayModalDate, monthHideRecipePhoto])
  /** この日に指名されているレシピ（未指名＝自動で選ぶ） */
  const dayModalCoverChoice = dayModalDate ? monthDayCoverRecipe?.[dayModalDate] : undefined
  const chooseDayCover = (recipeId: number | undefined) => {
    if (!dayModalDate) return
    saveSettings({
      monthDayCoverRecipe: setDayCoverChoice(monthDayCoverRecipe, dayModalDate, recipeId),
    })
  }
  // 過去日は予定(献立)を表示から消し、作った記録だけを日記のように見せる(便BS・タスク2。非破壊)
  const dayModalIsPast = dayModalDate ? isPastDate(dayModalDate, today) : false
  /** いま開いている窓が編集モードか（2026-08-23 便JN。週の曜日カードと同じ覚え方） */
  const dayModalEditing = dayModalDate != null && monthEditDate === dayModalDate
  /** その窓に何を出すか（週と共用の決めごと。中身は logic/mealPlan.ts の monthDayWindowView） */
  const dayModalWindow = monthDayWindowView({
    date: dayModalDate ?? today,
    today,
    editing: dayModalEditing,
    isDemo,
  })
  /** 日ごとの鍵。掛かっている日は「編集」は押せるが、中の操作が止まる（2026-08-22 便JFと同じ） */
  const dayModalLocked = dayModalDate != null && isDayMealLocked(lockedKeys, dayModalDate)
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
    saveSettings({ visibleMealSlots: next })
  }
  /**
   * レシピID→レシピ（すでに登録されている献立・記録を「表示する／数える」ための引き当て表）。
   *
   * 2026-07-30 便CH/C7: ここは hideStarters（設定「基本レシピを一覧に表示しない」）を**反映しない**。
   * 反映していたときは、設定をONにすると登録済みの献立が月間サマリー・月セル・献立表・週/日タブ・
   * 概算食費から丸ごと消えていた（記録側は全レシピで引くので残り、同じ画面で扱いが食い違っていた）。
   * 設定の文言は「一覧に表示しない」で、登録済みの予定を消すとは書いていない＝約束を超えた挙動だった。
   * 切り分けは「選ぶ／提案する対象＝visibleRecipes（hideStarters反映）」「登録済みを表示・集計する
   * 対象＝全レシピ」。ピッカー(searchRecipes)と自動提案(suggestForSlot/suggestPairForSlot)は
   * visibleRecipes のままなので、設定の本来の意図（一覧・提案に出さない）は変わらない。
   */
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    ;(recipes ?? []).forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  // S-1 月セルの未来日プレビュー(2026-07-25 便BU・docs/59): 日付→その日の予定を表す短い文字列。
  // 代表の主菜名(夕食を優先→他の帯の主菜)を出し、主菜が特定できない日は「◯件」に倒す。
  // 実際に出すのは呼び出し側でshowPlanDot(今日・未来日)の日だけ＝過去日の写真日記(便BS)は触らない
  const monthDayPreview = useMemo(() => {
    const byDate = new Map<string, MealPlanEntry[]>()
    monthEntries?.forEach((e) => {
      const list = byDate.get(e.date)
      if (list) list.push(e)
      else byDate.set(e.date, [e])
    })
    const map = new Map<string, string>()
    // 代表は「夕食の主菜 → ほかの帯の主菜 → 夕食の品 → その日の最初の品」の順に選ぶ。
    // 2026-07-30 便CH/C15: 主菜が無い日（作り置きの副菜だけ・主菜を消した日）を「◯件」に
    // 倒していたため、月表で先の予定が読めるという狙いがその日だけ効かなくなっていた
    const pickRepresentative = (list: MealPlanEntry[]) =>
      list.find((e) => e.slot === 'dinner') ?? list[0]
    byDate.forEach((dayEntries, date) => {
      const mains = dayEntries.filter((e) => (e.role ?? 'main') === 'main')
      const rep = mains.length > 0 ? pickRepresentative(mains) : pickRepresentative(dayEntries)
      const title = rep ? recipeById.get(rep.recipeId)?.title : undefined
      map.set(date, title ?? ja.mealPlan.monthDayPlanCount.replace('{n}', String(dayEntries.length)))
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
  // リセットで防止済み)。記録側・予定側とも全レシピで引く(2026-07-30 便CH/C7。設定
  // 「基本レシピを一覧に表示しない」で登録済みの予定が集計から消えるのを直した=recipeById参照)
  const monthCookedDishes = useMemo(() => {
    const prefix = monthAnchor.slice(0, 7)
    const out: RangeCookedDish[] = []
    cookedLogsByDate.forEach((list, date) => {
      if (!date.startsWith(prefix)) return
      // recipeId は「今日の記録と今日の予定を二重に数えない」照合キー(2026-08-08 便EA)
      list.forEach(({ recipe, log }) => out.push({ date, recipe, log, recipeId: recipe.id }))
    })
    return out
  }, [cookedLogsByDate, monthAnchor])
  const monthPlannedDishes = useMemo(() => {
    const out: RangePlannedDish[] = []
    monthEntries?.forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      // 実効食数(枠ごとの食数 > ふだん作る人数 > 登録人数分)を添えて渡す(2026-08-03 便DK)。
      // 「これから作る予定の食費(作る食数ぶん)」だけに効き、1人分の食費・栄養は変わらない
      if (recipe)
        out.push({
          date: e.date,
          recipe,
          servings: effectiveMealServings(e.servings, householdServings, recipe.servings),
          recipeId: e.recipeId,
        })
    })
    return out
  }, [monthEntries, recipeById, householdServings])
  /**
   * 期間の集計(2026-07-28 便CA・オーナー確定仕様)。
   * ①平均をやめ「1人が期間内に食べた分の合計」を出す ②過去日は作った記録・今日以降は登録した献立
   * だけで数える(過去の予定ベース表示は廃止)。詳細な理由は logic/rangeSummary.ts のコメント。
   */
  /* 選んだ期間そのものを読む（2026-08-08 便EA）。従来は表示中の月のぶんしか入力に無く、
     月をまたぐ期間を選べても月の外の日が0で計算されてしまうため、期間用に引き直す。
     献立はDBから期間で引き（useMealPlanRange）、作った記録は全レシピ分を持っている
     cookedLogsByDate から期間で絞る。期間を選んでいない間は今日1日ぶんだけを引く（軽い空引き）。 */
  const rangeQueryEntries = useMealPlanRange(rangeStart ?? today, rangeEnd ?? today)
  // 献立表に載せる日付メモも、選んだ期間そのものを引く（2026-08-26 便LH。月をまたぐ期間のため）
  const rangeQueryDayNotes = useDayNoteRange(rangeStart ?? today, rangeEnd ?? today)
  const rangeCookedDishes = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return [] as RangeCookedDish[]
    const out: RangeCookedDish[] = []
    cookedLogsByDate.forEach((list, date) => {
      if (date < rangeStart || date > rangeEnd) return
      list.forEach(({ recipe, log }) => out.push({ date, recipe, log, recipeId: recipe.id }))
    })
    return out
  }, [cookedLogsByDate, rangeStart, rangeEnd])
  const rangePlannedDishes = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return [] as RangePlannedDish[]
    const out: RangePlannedDish[] = []
    ;(rangeQueryEntries ?? []).forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (recipe)
        out.push({
          date: e.date,
          recipe,
          servings: effectiveMealServings(e.servings, householdServings, recipe.servings),
          recipeId: e.recipeId,
        })
    })
    return out
  }, [rangeQueryEntries, rangeStart, rangeEnd, recipeById, householdServings])
  const rangeSummary = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return null
    return summarizeRangeIntake({
      start: rangeStart,
      end: rangeEnd,
      today,
      cooked: rangeCookedDishes,
      planned: rangePlannedDishes,
      priceIndex,
    })
  }, [rangeStart, rangeEnd, today, rangeCookedDishes, rangePlannedDishes, priceIndex])
  // 1人あたり1日の食費(便CA): 期間の1人分合計を日数で割る。従来の「1日あたり」は予定ベースの
  // 全体金額÷日数だったが、予定が今日以降だけになったので「1人分の合計÷日数」に置き換えた
  const rangePersonalPerDay =
    rangeSummary != null && rangeDays > 0 ? Math.round(rangeSummary.personalYen / rangeDays) : 0
  /**
   * 「期間で絞る」で開始日と終了日の両方を選んでいるか（2026-08-26 便LH）。
   * これが true のあいだ、月タブの食費・栄養・献立をまとめて提案・テンプレート・献立表は
   * すべて「表示している月」ではなく「選んだ期間」を相手にする（monthTargetDates）。
   */
  const monthRangeActive = costMode && rangeStart != null && rangeEnd != null

  /**
   * 月間サマリー(2026-07-29 便CB-1・docs/59 B-3): 期間を選ばなくても、表示中の月の
   * 「1人が食べる分」の食費と栄養が最初から見えるようにする常設の集計。
   * 数え方は期間の集計とまったく同じ関数(summarizeRangeIntake)で、範囲を表示中の月の1日〜末日に
   * 固定しただけ＝過去日は作った記録・今日以降は登録した献立という規則も自動的に同じになる。
   * 既存の期間指定UI(rangeCostToggle)はそのまま残す(任意の期間はそちらで見る)
   */
  const monthSummary = useMemo(
    () =>
      summarizeRangeIntake({
        start: monthDatesList[0],
        end: monthDatesList[monthDatesList.length - 1],
        today,
        cooked: monthCookedDishes,
        planned: monthPlannedDishes,
        priceIndex,
      }),
    [monthDatesList, today, monthCookedDishes, monthPlannedDishes, priceIndex],
  )
  /**
   * 「価格が分からない材料◯種類を除いた概算です」の件数（2026-07-30 便CH/C2・C4）。
   * 週の概算食費にだけ入っていた注記（便CD/MP-11）を、月間サマリーと期間カードにも同じ作法で出す
   * ＝どの画面でも「この金額に何が入っていないか」が分かるようにする。
   * 数える対象は合計と同じ料理（rangeIntakeRecipes＝過ぎた日は作った記録・今日から先は登録した献立）。
   */
  const monthPricelessCount = useMemo(
    () =>
      pricelessIngredientNamesOfRecipes(
        rangeIntakeRecipes({
          start: monthDatesList[0],
          end: monthDatesList[monthDatesList.length - 1],
          today,
          cooked: monthCookedDishes,
          planned: monthPlannedDishes,
        }),
        priceIndex,
      ).length,
    [monthDatesList, today, monthCookedDishes, monthPlannedDishes, priceIndex],
  )
  const rangePricelessCount = useMemo(() => {
    if (rangeStart == null || rangeEnd == null) return 0
    return pricelessIngredientNamesOfRecipes(
      rangeIntakeRecipes({
        start: rangeStart,
        end: rangeEnd,
        today,
        cooked: rangeCookedDishes,
        planned: rangePlannedDishes,
      }),
      priceIndex,
    ).length
  }, [rangeStart, rangeEnd, today, rangeCookedDishes, rangePlannedDishes, priceIndex])
  // 食費の内訳(実績/予定の1人分の分解・価格の但し書き)は既定で畳んでおく。
  // 常設カードが画面上部を占領してカレンダーを押し下げないようにするため(表の数値は畳んでも見える)
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false)
  // 栄養の但し書きと出典も同じ理由で畳む(2026-08-03 便DQ・規約H。8項目の数値は常に見える)
  const [monthNutritionNotesOpen, setMonthNutritionNotesOpen] = useState(false)
  // 期間カードの折りたたみ(2026-08-03 便DR)。月タブと同じ密度に揃えるため、内訳と価格の但し書き・
  // 栄養の但し書きと出典を同じ作法で畳む。開閉は月タブと別に持つ(片方を開いても他方は畳んだまま)
  const [rangeSummaryOpen, setRangeSummaryOpen] = useState(false)
  const [rangeNutritionNotesOpen, setRangeNutritionNotesOpen] = useState(false)
  /**
   * 月の食費カード・栄養カードそのものの開閉（2026-08-07 便DU・オーナー指示
   * 「食費・栄養をそれぞれ折りたたみ可能に」）。
   *
   * 既定は両方とも畳む。この便でカレンダーを月タブの先頭へ上げた（同じオーナー指示の1件目）ので、
   * その下の2枚を開いたままにすると、月タブ全体を見渡すのに2画面ぶんスクロールが要る。
   * 見出し（「◯月の食費」「◯月の栄養（1人分）」）は畳んでも出したままなので、
   * 何がそこにあるかは畳んだ状態でも読める。
   * 開閉は画面を離れると既定に戻す（設定には残さない）＝週タブの操作3グループ（便DJ）と同じ作法。
   */
  const [monthCostCardOpen, setMonthCostCardOpen] = useState(false)
  const [monthNutritionCardOpen, setMonthNutritionCardOpen] = useState(false)
  /**
   * 献立を入れる操作の折りたたみ（2026-08-26 便LH・オーナー原文「献立関連のボタンが
   * バラバラに配置してあるように見えるので、１グループにまとめて。折りたたみの見える部分は
   * 「献立をまとめて提案」のみ。」）。既定は畳む＝週タブの操作グループと同じ作法で、
   * 畳んでいても「献立をまとめて提案」だけは折りたたみの外に出したままにする。
   */
  const [monthPlanGroupOpen, setMonthPlanGroupOpen] = useState(false)
  /* ------------------------------------------------------------------
     食費・栄養のカードが見せる中身（2026-08-26 便LH）。
     「期間で絞る」で期間がそろっているあいだは選んだ期間の集計、ふだんは表示している月の集計。
     見出し・表・畳んだときの数値・内訳のすべてがこの1つを読む＝
     月と期間で別のカードを2枚並べない（オーナー原文「１ヶ月分の内容が、そのまま絞った期間の
     内容に書き変わるのがベスト。」）。
     ------------------------------------------------------------------ */
  const monthIntakeSummary =
    monthRangeActive && rangeSummary != null ? rangeSummary : monthSummary
  const monthIntakeDishCount =
    monthIntakeSummary.actual.dishCount + monthIntakeSummary.plan.dishCount
  const monthIntakeEmptyText = monthRangeActive
    ? ja.mealPlan.rangeIntakeEmpty
    : ja.mealPlan.monthSummaryEmpty
  /** 内訳・注記の開閉は月と期間で別々に覚える（片方を開いても他方は畳んだまま・便DRのまま） */
  const monthCostDetailsOpen = monthRangeActive ? rangeSummaryOpen : monthSummaryOpen
  const monthNutritionNotesShown = monthRangeActive
    ? rangeNutritionNotesOpen
    : monthNutritionNotesOpen

  // 月カレンダーのセル表示(便CA・タスク2): 既定は写真。栄養/食費モードのときだけ日ごとの1人分を計算する
  const monthCellMode: MonthCellMode = settings?.monthCellMode ?? 'photo'
  // マスに出す栄養の項目(2026-08-19 便HV・⑥)。未設定・知らない値はエネルギーに落ちる
  const monthCellNutrient = resolveNutritionDisplayKey(settings?.monthCellNutrient)
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

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）。
  // 日タブでの見せ方は pickedRecipes / plannedGroups（2026-08-03 便DH）が決める
  const todayList = useTodayList()

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

  /**
   * 日タブの縦一列の内訳（2026-08-03 便DH・オーナー指示。便DEの左右2列を差し替え）。
   *
   *   pickedRecipes … ①「レシピ一覧から選択中」＝今日の献立のうち②に出ていない分。
   *                    食事(朝昼夜)には分けない（レシピ詳細から直接「作った」を押すのと同じ扱い）
   *   plannedGroups … ②「今週の献立の予定」＝今日の週プランを朝食→昼食→夕食の順に
   *
   * ②は「表示する食事」の設定では絞らない（登録済みの予定を設定で隠さない＝便CH/C7の切り分け）。
   * そのため①の判定にも**全ての食事帯**の今日の予定を使う（表示帯だけで引くと、隠した帯の
   * 予定が①と②の両方に出て二重になる）。
   *
   * 2026-08-11 便FN: ①が引くのは「今日の予定ぜんぶ」ではなく「②にいま出ている分」。
   * ②は今日すでに作った品を出さないので、作り終えた予定の行が①を塞ぐと、
   * 「全て作った！」のあとに同じ品を入れ直しても画面のどこにも出なくなる（利用者テスト報告）。
   *
   * 2026-08-12 便FS-1: 作り終えた品を同じ食事へ入れ直したときは、②のその食事の行として戻す
   * （判定は logic/mealPlan.ts showsCookedPlanRowToday）。①へ回していたため、
   * 「今日の夕食に戻しました」と言われた直後に「夕食に入れる」を選び直す行が出ていた。
   */
  const todayPlanAllRecipeIds = useMemo(
    () => Array.from(new Set((todayEntries ?? []).map((e) => e.recipeId))),
    [todayEntries],
  )
  const todayListRecipeIds = useMemo(
    () => new Set((todayList ?? []).map((item) => item.recipeId)),
    [todayList],
  )
  /**
   * ②の行を消すときに消す予定の行id（2026-08-17 便HI）。
   * 同じ料理が同じ食事に2行あることもあるので、料理ごとに配列で持つ
   * （「その料理を今週の献立から外す」＝その食事にあるその料理の行を全部消す）。
   */
  const plannedEntryIds = useMemo(() => {
    const map = new Map<string, number[]>()
    todayEntries?.forEach((e) => {
      if (e.id == null) return
      const key = `${e.slot}|${e.recipeId}`
      const list = map.get(key)
      if (list) list.push(e.id)
      else map.set(key, [e.id])
    })
    return map
  }, [todayEntries])
  const plannedGroups = useMemo(() => {
    const bySlot = new Map<MealSlot, Recipe[]>()
    todayEntries?.forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (!recipe) return
      // 今日すでに作って、今日の献立からも外れた品は出さない
      //（オーナー「作った後は予定でなく記録」）。①の品は「作った」で今日の献立から
      // 外れて消えるので、②も同じ見え方に揃える。トーストの「元に戻す」で記録を消しても、
      // 作った品を同じ食事へ入れ直しても、この行はそのまま戻る
      if (
        !showsCookedPlanRowToday(
          recipe.cookedLogs.some((log) => log.date === today),
          todayListRecipeIds.has(recipe.id!),
        )
      )
        return
      const list = bySlot.get(e.slot)
      if (list) {
        if (!list.some((r) => r.id === recipe.id)) list.push(recipe)
      } else bySlot.set(e.slot, [recipe])
    })
    return MEAL_SLOTS.map((slot) => ({ slot, recipes: bySlot.get(slot) ?? [] })).filter(
      (g) => g.recipes.length > 0,
    )
  }, [todayEntries, recipeById, today, todayListRecipeIds])
  /**
   * ②にいま出ている予定のレシピID（2026-08-11 便FN）。
   * ①の引き算はこれを相手にする＝②が出していない予定（今日すでに作った品）は①を塞がない。
   */
  const plannedShownRecipeIds = useMemo(
    () => plannedGroups.flatMap((g) => g.recipes.map((r) => r.id!)),
    [plannedGroups],
  )
  const pickedRecipes = useMemo(() => {
    return todayListPickedIds(todayList ?? [], plannedShownRecipeIds, todayPlanAllRecipeIds)
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, plannedShownRecipeIds, todayPlanAllRecipeIds, recipeById])
  /** 日タブに並んでいる全レシピID（①→②の順・重複なし）。まとめて記録・並行調理ナビへ渡す */
  const dayRecipeIds = useMemo(() => {
    const ids = pickedRecipes.map((r) => r.id!)
    plannedGroups.forEach(({ recipes: slotRecipes }) =>
      slotRecipes.forEach((r) => {
        if (!ids.includes(r.id!)) ids.push(r.id!)
      }),
    )
    return ids
  }, [pickedRecipes, plannedGroups])

  /**
   * 「作った！」で記録する食数（2026-08-10 便FF・オーナー指示
   * 「作った！押下時に設定されている食数を記録したい。設定がなければ個人設定に
   * 登録されている食数を自動で反映して」）。
   *
   * 優先順位は買い物メモ・概算食費と同じ（logic/servings.ts effectiveMealServings）:
   * ①今日の予定の枠に決めた食数 ②設定「食数の設定」の人数 ③レシピの登録人数分。
   * 「レシピ一覧から選択中」の品には枠が無いので②③で決まる。
   * 同じ料理が複数の食事に入っているときは、先に見つけた枠の食数を使う。
   */
  const dayCookedServings = useMemo(() => {
    const entryServings = new Map<number, number>()
    todayEntries?.forEach((e) => {
      if (e.servings != null && !entryServings.has(e.recipeId))
        entryServings.set(e.recipeId, e.servings)
    })
    const map = new Map<number, number>()
    dayRecipeIds.forEach((id) => {
      map.set(
        id,
        effectiveMealServings(
          entryServings.get(id),
          householdServings,
          recipeById.get(id)?.servings,
        ),
      )
    })
    return map
  }, [dayRecipeIds, todayEntries, householdServings, recipeById])

  /**
   * 並行調理ナビに作りかけの段取りが残っているか（2026-08-08 便EG・オーナー実機報告
   * 「タブ移動しても並行調理が維持されているが、再開したい時に迷う」）。
   * 端末内の一時的な覚え書き（sessionStorage）なので、この画面を開くたびに読み直す。
   */
  const naviInProgress = hasCookNaviTimeline()

  /**
   * その日に作るものが1つでも決まっているか（2026-08-17 便HG・オーナー指示
   * 「「今日なに作る？」と「レシピを探す」「在庫の食材から探す」は、献立がない時のみに出る。
   * 献立があれば、これまで通りの献立タブにあった「今日の献立」」）。
   * 判定は「日」に並んでいる品（①レシピ一覧から選択中 ＋ ②今週の献立の予定）そのもの＝
   * 画面に1品でも出ていれば「決まっている」。
   */
  const dayHasPlan = dayRecipeIds.length > 0

  /**
   * 「今日の献立」の整理モード（2026-08-20 便IG・①。オーナー原文
   * 「「作った！」と×が邪魔。作った！をつけるときにはモード切り替えするようにしたら
   *   解決できる？全て作った！も含めて。」／司令部の裁定＝A案）。
   *
   * ONのあいだだけ、行に×（献立から外す）を出す。「作った！」「全て作った！」は
   * モードの外に残す＝毎日押す操作を奥へ入れない（A案の理由）。
   * 作法は食材の在庫の「整理」（PantryBoard）に合わせてある（ja.mealPlan.todayOrganizeToggle 参照）。
   *
   * 画面を離れると既定（OFF）に戻す＝設定には残さない。並んでいる品が1つも無くなったら
   * 自動で抜ける（在庫の整理モードと同じ。抜けるボタンごと消えて閉じ込められないように）。
   */
  const [dayOrganizing, setDayOrganizing] = useState(false)
  useEffect(() => {
    if (dayOrganizing && !dayHasPlan) setDayOrganizing(false)
  }, [dayOrganizing, dayHasPlan])

  /**
   * 「今日の献立」の行を左へ払って「外す」を出している行（2026-08-21 便IQ。オーナー原文
   * 「横にスワイプして消せるのが楽なんですけどね。」）。
   *
   * **開くのは同時に1行だけ**にするため、開いている行の合図はここで持つ
   * （行ごとに持たせると、払った行が2つ3つと開いたままになる）。
   * 合図は行の出どころ込みの文字列＝「レシピ一覧から選択中」と「今週の献立の予定」に
   * 同じ料理が並んでも取り違えない。
   *
   * 「日」から離れたら閉じる。整理モードに入る/抜けるときも閉じる
   * （×と「外す」が同時に2つ出ている状態を作らない）。
   */
  const [daySwipeOpenKey, setDaySwipeOpenKey] = useState<string | null>(null)
  useEffect(() => {
    setDaySwipeOpenKey(null)
  }, [viewMode, dayOrganizing])

  /**
   * 「今日なに作る？」の候補カードから開いた料理を覚える／覚えを読む（2026-08-17 便HI・
   * オーナー実機「今日なに作るのレシピ詳細から戻ってきた時だけは、ランダムでレシピが
   * 変わらないようにして」）。
   *
   * 読むのは**レシピ詳細から帰ってきたとき（?focus=today）だけ**。下の並びの「献立」を
   * 押して来たときや、ふつうにアプリを開いたときは読まない＝古い覚えで
   * 「押してもいない料理」が出続けることがない。覚えそのものは画面に着いた時点で必ず捨てる
   * （1回きり）。作りは logic/navMemory.ts。
   *
   * 2026-08-19 便HT（オーナー原文「提案された献立→レシピ詳細→戻る、の流れで、
   * 献立『今日なに作る？』の提案が変更されないようにして。」）: **献立の側も同じ覚えに乗せた**。
   * 新しい仕組みは足していない——読むきっかけ（?focus=today）も、捨てるきっかけ（着いたら1回きり）も
   * 1品側とまったく同じで、覚える記録に「そのとき出ていた主菜・副菜」の項目が増えただけ
   * （logic/navMemory.ts の serializeSuggestionPin / parseSuggestionPlanPin）。
   */
  const [returnedSuggestion] = useState<{ oneId: number | null; planIds: number[] }>(() => {
    const raw = searchParams.get('focus') === 'today' ? readSessionItem(DAY_SUGGEST_PIN_KEY) : null
    return { oneId: parseSuggestionPin(raw), planIds: parseSuggestionPlanPin(raw) }
  })
  const returnedSuggestionId = returnedSuggestion.oneId
  useEffect(() => {
    removeSessionItem(DAY_SUGGEST_PIN_KEY)
  }, [])

  /**
   * 「今日なに作る？」「最近作ったもの」が対象にするレシピ（2026-08-17 便HG）。
   * 設定「基本レシピを表示しない」を反映する＝ホームにあったときと同じ絞り方をそのまま使う。
   * 献立に登録済みの品を引き当てる recipeById 側には効かせない（登録した予定は設定で隠さない）。
   */
  const ownRecipes = useMemo(() => {
    if (!recipes) return undefined
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  /**
   * ホーム画面への追加を案内する初回のお知らせ(2026-08-10 便EW)。
   * 2026-08-17 便HG: ホーム画面を廃止し、アプリを開いた直後に着く画面が献立の「日」に
   * なったので、案内もここで出す（着地の合図をそのまま引き継ぐ）。
   * 出す条件（指で操作する端末のブラウザ・アイコン起動でない・この端末で未表示）は
   * logic/homeScreenNotice.ts が持つ。ここでは画面に着いた時点で1度だけ判定する
   * ＝この画面を開いている間に判定が揺れて出たり消えたりしない。
   * サンプルデモ（月間の見本）は端末の状態を見せる画面ではないので出さない。
   */
  const [showHomeScreenNotice, setShowHomeScreenNotice] = useState(
    () => !isDemo && shouldShowHomeScreenNoticeNow(),
  )

  // 献立タブを開いたときの初期タブ(2026-07-16 便U-1でタブ構成に再設計): 既定は「日」タブ。
  // ?focus=today が付いている場合(今日の献立からレシピを開いて戻ってきた場合)は、明示的に
  // 「日」タブへ固定し最上部へスクロールする（2026-07-15オーナー実機フィードバック対策を維持）。
  // パラメータは消費したら消す(次の「素の献立タブ開き」で通常の既定=日タブに戻すため)。
  // 初回1回だけ処理する(liveQueryの再評価のたびに動かないようinitialFocusRefで守る)
  const initialFocusRef = useRef(false)
  /**
   * 週タブを開いたあとにスクロールして見せる日（2026-08-02 便DE-1/DE-11）。
   * ?focus=week&date=YYYY-MM-DD で開いたときだけ入り、その日のカードまで送ってから空にする。
   */
  const [pendingScrollDate, setPendingScrollDate] = useState<string | null>(null)
  /**
   * レシピ詳細から週タブへ戻ってきたときに復元する縦スクロール位置（2026-08-07 便DT-2）。
   * 日付カードへ送る pendingScrollDate と違い、離れる直前の位置をそのまま復元する。
   */
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null)
  /**
   * その復元で目印にする曜日カード（2026-08-14 便GH）。
   * 縦位置だけでは、離れている間にページの高さが変わったときに別の場所へ着地する。
   * 目印があるときは「このカードを画面の同じ高さに戻す」を優先する（logic/navMemory.ts）。
   */
  const [pendingScrollAnchor, setPendingScrollAnchor] = useState<ReturnAnchor | null>(null)
  /**
   * その復元をどのタブでやるか（2026-08-09 便EQ）。
   * 週タブ専用だった仕組みを、月タブ・日タブ（作った記録の一覧からの戻り）にも広げた。
   */
  const [pendingScrollMode, setPendingScrollMode] = useState<MealPlanViewMode>('week')
  /**
   * 月タブへ戻ってきたときに開き直す「日の窓」の日付（2026-08-10 便FD）。
   * 開き直すのは月の献立が届いてから（窓は開いた時点の中身を控えて「キャンセル」に使うので、
   * 空のまま開くと控えも空になり、キャンセルでその日の献立が消えてしまう）。
   */
  const [pendingDayModal, setPendingDayModal] = useState<string | null>(null)
  useEffect(() => {
    if (initialFocusRef.current) return
    initialFocusRef.current = true
    const focus = searchParams.get('focus')
    // 2026-08-17 便HI（オーナー実機「ページ開いた時に、基本的にページのいちばん上を表示して」）:
    // 行き先の指定なしで開いたとき（アプリを開いた・他のタブから来た）は、必ず先頭から見せる。
    // 単一ページのアプリなので、何もしないと**前の画面で下まで送っていた位置がそのまま残る**
    if (focus == null) {
      window.scrollTo(0, 0)
      return
    }
    // 2026-08-02 便DE-1/DE-11: 開くタブを指定して戻ってこられるようにした。
    //  today … 今日の献立(日タブ)へ。従来からの動き
    //  week  … 週タブへ。date が付いていればその日のカードまでスクロールする
    //  month … 月タブへ(「作った記録」の一覧から月タブへ戻るときに使う)
    if (focus === 'today') {
      setViewMode('day')
      // 2026-08-17 便HI（オーナー実機「日献立にあるレシピからレシピ詳細→戻る→日献立→
      // レシピタブ→レシピ一覧、になるようにして。現状最後がレシピ詳細ままになっている」）:
      // 週タブと同じ後始末をここでも行う。「戻る」を押した時点でその詳細は見終わっているので、
      // 「レシピ」タブが覚えている行き先も捨てる＝次にレシピタブを押すと一覧が開く
      // （便DT-2で作った仕組みを、日タブ・月タブへも同じ形で広げただけ。新しい仕掛けは作っていない）
      forgetRecipesTabPath()
      // 2026-08-09 便EQ: 作った記録の一覧から帰ってきたときだけ、離れる直前の縦位置へ戻す。
      // それ以外（他の画面からの通常の「今日へ」）は従来どおり先頭から見せる
      const dayPoint =
        searchParams.get(WEEK_RETURN_PARAM) === '1'
          ? parseViewReturn(readSessionItem(DAY_RETURN_KEY))
          : null
      removeSessionItem(DAY_RETURN_KEY)
      if (dayPoint) {
        setPendingScrollMode('day')
        setPendingScrollY(dayPoint.scrollY)
      } else {
        window.scrollTo(0, 0)
      }
    } else if (focus === 'week') {
      const date = searchParams.get('date')
      if (date) {
        // 2026-08-21 便IO: 「今日から7日間」表示の初期化（weekModeInitRef）は、あとから設定を
        // 読み終えた時点で週を今日へ寄せ直す。ここで済み扱いにしないと、日付を指定して開いた週が
        // 一瞬で今日の週に戻っていた（月タブの「この週を開く」・買い物メモからの「その日を見る」・
        // 別の週から入れたあとの戻り先が、すべて今日の週に着地していた）。
        // 下の WEEK_RETURN_PARAM の枝は同じ手当てを先にしてある
        //
        // 2026-08-23 便JL: **設定がまだ届いていないときは、ここで週を決めない**。
        // この効果は画面を開いた直後（1回だけ）に走るので、端末から設定を読み終える前のことが
        // ある。未取得を「週区切り」と読むと、「今日から7日間」で使っている人が
        // **見ていた週とは別の週**（その日を含む月曜始まりの週）に着地し、そのまま
        // 「表示している週をまとめて空にする」の対象がずれていた（画面の外の6日が消え、
        // 見ていた週は消えない）。届いてから決めるのが上の weekModeInitRef の効果。
        if (settings === undefined) {
          pendingWeekStartDateRef.current = date
        } else {
          // 「今日から7日間」表示ならその日を先頭に、週区切り表示ならその日を含む週を出す
          setWeekStart(weekStartForDate(date, settings.weekStartsToday === true))
          weekModeInitRef.current = true
        }
        setPendingScrollDate(date)
      } else if (searchParams.get(WEEK_RETURN_PARAM) === '1') {
        // 2026-08-07 便DT-2(オーナー指示): レシピ詳細の「戻る」で帰ってきたときは、
        // 離れる直前に見ていた週と縦スクロール位置をそのまま復元する。
        // あわせて「レシピ」タブが覚えている行き先も捨てる＝次にレシピタブを押すと
        // 一覧が開く(いま閉じた詳細がまた開かない)
        const point = parseWeekReturn(readSessionItem(WEEK_RETURN_KEY))
        removeSessionItem(WEEK_RETURN_KEY)
        forgetRecipesTabPath()
        if (point) {
          setWeekStart(point.weekStart)
          setPendingScrollY(point.scrollY)
          setPendingScrollAnchor(point.anchor ?? null)
          // 開け閉めした曜日カードも離れる前の形に戻す（2026-08-19 便ID・⑦）
          setDayFoldOverrides(point.dayFold ?? {})
          // 「今日を先頭に7日間」表示の初期化(weekModeInitRef)が、あとから設定を読み終えた
          // タイミングで週を今日へ寄せ直してしまうと、復元した週が消える。復元したときは
          // その初期化を済み扱いにする＝覚えていた週をそのまま見せる
          weekModeInitRef.current = true
        }
      }
      setViewMode('week')
    } else if (focus === 'month') {
      setViewMode('month')
      // 2026-08-17 便HI: 日タブと同じ理由で、月タブの「戻る」でも覚えている行き先を捨てる
      forgetRecipesTabPath()
      // 2026-08-09 便EQ: 作った記録の一覧から帰ってきたときは、見ていた月と縦位置を復元する
      const monthPoint =
        searchParams.get(WEEK_RETURN_PARAM) === '1'
          ? parseViewReturn(readSessionItem(MONTH_RETURN_KEY))
          : null
      removeSessionItem(MONTH_RETURN_KEY)
      if (monthPoint) {
        if (monthPoint.anchor) setMonthAnchor(monthPoint.anchor)
        setPendingScrollMode('month')
        setPendingScrollY(monthPoint.scrollY)
        // 2026-08-10 便FD: 離れる前に日の窓を開いていたなら、その窓ごと戻す
        // （開き直すのは月の献立が届いてから。下の pendingDayModal の効果が待つ）
        if (monthPoint.openDate) setPendingDayModal(monthPoint.openDate)
      } else {
        window.scrollTo(0, 0)
      }
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('focus')
        next.delete('date')
        next.delete(WEEK_RETURN_PARAM)
        return next
      },
      { replace: true },
    )
    // この効果は画面を開いた直後の1回だけ（initialFocusRef）。settings は初回描画では未取得の
    // ことがあるが、未取得なら日付を控えて weekModeInitRef の効果（settings を待つ）へ渡すので、
    // 依存に足して再実行はさせない（足すと、消したはずの ?focus= をもう一度読むことになる）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])

  /**
   * 覚えていた縦スクロール位置まで戻す（2026-08-07 便DT-2）。
   *
   * 献立・レシピ・作った記録は liveQuery で後から届くので、描画直後は本文がまだ短く、
   * その時点で scrollTo しても指定の位置まで下がれない。ページの高さが足りるまで
   * 数フレーム待ってから1回だけ動かし、諦める上限（RESTORE_MAX_FRAMES）も置く
   * （データが少ない週では永遠に足りないため）。
   *
   * 2026-08-10 便FD: 「届く高さになった瞬間」に動かしていたため、そのあとページが縮むと
   * 覚えた位置より手前に着地していた（設定が届くまでは表示しない食事帯まで描いていて、
   * 実測で 6243px → 4037px まで縮み、1800px へ戻したはずが 1106px になっていた）。
   * **高さが数フレーム変わらなくなってから**動かす。
   *
   * 2026-08-14 便GH: それでも「離れている間にページの高さが変わる」場合は直せていなかった。
   * 「この日の栄養の概算を詳しく見る」で開いた明細は画面を離れると閉じた状態に戻るため、
   * 帰ってきたページは実測695px短く、同じ縦位置には**別のカード**が来ていた
   * （見ていたカードは画面外へ644px上がっていた）。覚えた目印のカードがあるときは、
   * 縦位置ではなく**そのカードを画面の同じ高さに戻す**（logic/navMemory.ts）。
   */
  useEffect(() => {
    if (pendingScrollY == null || viewMode !== pendingScrollMode) return
    const RESTORE_MAX_FRAMES = 60
    /** 高さが変わらなかったフレームがこれだけ続いたら「描き終わった」とみなす */
    const RESTORE_STABLE_FRAMES = 3
    let frames = 0
    let lastHeight = -1
    let stable = 0
    let raf = 0
    const tick = () => {
      const height = document.documentElement.scrollHeight
      stable = height === lastHeight ? stable + 1 : 0
      lastHeight = height
      const reachable = height - window.innerHeight
      const anchorEl = pendingScrollAnchor
        ? document.querySelector<HTMLElement>(`section[data-date="${pendingScrollAnchor.date}"]`)
        : null
      // 目印のカードが描けていれば「高さが足りるか」は問わない（縮んだ側にも合わせるため）
      const ready =
        stable >= RESTORE_STABLE_FRAMES && (anchorEl != null || reachable >= pendingScrollY)
      if (ready || frames >= RESTORE_MAX_FRAMES) {
        const target =
          anchorEl && pendingScrollAnchor
            ? scrollTargetForAnchor(
                window.scrollY,
                anchorEl.getBoundingClientRect().top,
                pendingScrollAnchor,
              )
            : pendingScrollY
        window.scrollTo(0, Math.min(target, Math.max(0, reachable)))
        setPendingScrollY(null)
        setPendingScrollAnchor(null)
        return
      }
      frames++
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pendingScrollY, viewMode, pendingScrollMode, pendingScrollAnchor])

  /**
   * 指定された日のカードまでスクロールする（週タブに切り替わり、7日分が描かれたあとに1回だけ）。
   *
   * 2026-08-10 便FD: 献立・レシピ・記録は liveQuery で後から届くので、1回きりの scrollIntoView
   * だと、上に並ぶカードが伸びたぶんだけ目当ての日が下へ押し出される
   * （オーナー実機「スクロール先が今日じゃない」）。位置が落ち着くまで数フレーム追いかけ、
   * 上限（ANCHOR_MAX_FRAMES）で諦める。なめらかスクロールはやめて一気に合わせる＝
   * 長い距離を流れる途中で目当ての日を通り過ぎて見えるのを避ける。
   * 寄せる先のカードが表示中の週に無いときは、週タブの先頭から見せる。
   */
  useEffect(() => {
    if (pendingScrollDate == null || viewMode !== 'week') return
    const ANCHOR_MAX_FRAMES = 40
    let frames = 0
    /** 動かす必要が無かったフレームの連続回数（伸び終わったかの判断に使う） */
    let stable = 0
    let raf = 0
    const tick = () => {
      const el = document.querySelector<HTMLElement>(
        `section[data-date="${pendingScrollDate}"]`,
      )
      if (!el) {
        window.scrollTo(0, 0)
        setPendingScrollDate(null)
        return
      }
      const before = Math.round(window.scrollY)
      // scroll-mt-16 が、上部に貼り付く日/週/月タブのぶんの余白を空ける
      el.scrollIntoView({ block: 'start' })
      stable = Math.round(window.scrollY) === before ? stable + 1 : 0
      frames++
      if (stable >= 3 || frames >= ANCHOR_MAX_FRAMES) {
        setPendingScrollDate(null)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pendingScrollDate, viewMode])

  /**
   * 日/週/月を切り替えたら、その画面の先頭から見せる（2026-08-17 便HI・オーナー実機
   * 「ページ開いた時に、基本的にページのいちばん上を表示して。前は文字が多くて見づらかったから
   * 途中から表示にしたけど、今は上からでも十分見える」）。
   *
   * ここで**やめたこと**: 週タブに入ったら今日のカードまで送る（2026-08-10 便FD）。
   * 元は「勝手に下へ送られる」不具合（開いた状態で現れた折りたたみが位置合わせを要求し、
   * 7日目まで飛んでいた）を直したときに、送り先だけを今日のカードへ寄せたもの。
   * 不具合の本体（Collapse の位置合わせ）は便FDで別に直してあるので、寄せるのをやめても
   * 「勝手に下へ送られる」は戻らない。今日のカードへ送る道は残っている:
   *  ・?focus=week&date=YYYY-MM-DD で開く（月タブの日の窓・買い物メモなどからの「その日を見る」）
   *  ・「まとめて献立を入力」の直後（入った枠が画面外だと無反応に見えるため。便BH-3）
   *
   * 覚えた場所へ戻す途中（restore=1・date= 指定）のときは何もしない＝復元を打ち消さない。
   */
  const lastViewModeRef = useRef(viewMode)
  useEffect(() => {
    const prev = lastViewModeRef.current
    lastViewModeRef.current = viewMode
    if (viewMode === prev) return
    if (pendingScrollDate != null || pendingScrollY != null) return
    window.scrollTo(0, 0)
  }, [viewMode, pendingScrollDate, pendingScrollY])

  /**
   * 下の並びの「献立」を押したら、日へ戻して先頭から見せる（2026-08-17 便HI・オーナー実機
   * 「週や月の献立を表示中に献立タブをタップしたら、日に戻るようにして」）。
   *
   * 日/週/月はこの画面の中の状態なので、すでに献立にいると行き先（/meal-plan）が同じで
   * 何も起きなかった。押した合図は TabBar が sessionStorage へ置く（logic/navMemory.ts）。
   * ここで読むのは**画面へ来る操作があったとき**（location.key が変わったとき）だけで、
   * 合図は読んだ時点で必ず捨てる＝1回の操作で1回だけ効く。
   *
   * すでに日にいるときは「日にする」が空振りするので、**先頭へ送る**（オーナーの
   * 「いちばん上を表示して」と同じ動き）。押しても何も起きない、を作らない。
   */
  useEffect(() => {
    // サンプルデモ（月間の見本）は月の画面だけを見せるので、日へは切り替えない
    if (isDemo) return
    if (readSessionItem(MEAL_PLAN_TAB_TAP_KEY) == null) return
    removeSessionItem(MEAL_PLAN_TAB_TAP_KEY)
    setViewMode('day')
    window.scrollTo(0, 0)
  }, [isDemo, location.key])

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
    // デモは日タブを出さない＝ここへは来ないが、端末のデータへ書き込む唯一の自動処理なので明示的に止める
    if (isDemo) return
    if (viewMode !== 'day') return
    if (settings === undefined || todayEntries === undefined) return
    if (settings.lastAutoImportDate === today) return
    if (todayFromPlanIds.length === 0) return
    void (async () => {
      // fromPlan=true: 「予定の写しとして入った品」の印。週の予定を消したときに
      // 下の後始末(便DP-4)が片付ける対象になる
      await importRecipeIdsToTodayList(todayFromPlanIds, { fromPlan: true })
      await updateSettings({ lastAutoImportDate: today })
    })()
  }, [isDemo, viewMode, settings, todayEntries, todayFromPlanIds, today])

  /**
   * 自動取り込みの後始末（2026-08-03 便DP-4・バグ修正）。
   *
   * 直したバグ: 「週の予定を削除したあと、今日の献立に『レシピ一覧から選択中』として残る」。
   * 上の自動取り込み（便U-3）は今日の予定を todayList へ写すが、予定が消えたときに写しを
   * 片付ける経路がどこにも無かった。写しは孤立して「今日の予定に無い品」になり、
   * todayListPickedIds の定義どおり①「レシピ一覧から選択中」として並んでしまっていた。
   *
   * タブに関係なく（週タブで消したその場で消えるように）走らせる。突き合わせる相手は
   * **全ての食事帯**の今日の予定（todayPlanAllRecipeIds）で、表示中の帯だけで判定すると
   * 「朝食を非表示にしただけ」で朝食の写しを消してしまう。
   * 消すのは fromPlan の印が付いた写しだけなので、自分でレシピ一覧から足した品は残る。
   */
  useEffect(() => {
    if (isDemo) return
    // liveQueryの初回はundefined。読めていない状態で突き合わせると全部を「予定が無い」と
    // 誤判定して消してしまうので、両方そろうまで何もしない
    if (todayEntries === undefined || todayList === undefined) return
    void removeStaleFromPlanTodayList(todayPlanAllRecipeIds)
  }, [isDemo, todayEntries, todayList, todayPlanAllRecipeIds])

  /**
   * 「調理時間◯分以内」を効かせているか（2026-08-24 便KJ・①）。
   *
   * 直す前は画面の中だけで持っていた（useState(false)）ので、献立の画面を離れるたびに
   * 「指定なし」へ戻っていた（2026-08-23 の影響範囲テストで見つかった。オーナーの言う
   * 「入れかたがタブ移動で戻る」とまったく同じ型）。分数（planQuickMinutes）は前から
   * 覚えていたのに ON/OFF だけ覚えていなかったので、そこをそろえる。
   */
  const quickOnly = settings?.planQuickOn === true
  const setQuickOnly = (next: boolean) => saveSettings({ planQuickOn: next })
  /**
   * 「調理時間◯分以内を優先」の分数（2026-08-19 便HT・オーナー原文
   * 「調理時間15分いないを優先は、時間だけプルダウンで変更できるようにしたい」）。
   *
   * ON/OFF（quickOnly）は画面を開いているあいだだけの状態のまま、**分数だけを設定に覚える**
   * ＝「今日なに作る？」の「◯分以内」（homeQuickMinutes）と同じ作法。
   * 保存されていない値・選べない値が入っていても15分に倒す（提案が止まらないようにする）。
   */
  const quickMinutes = (PLAN_QUICK_MINUTES_OPTIONS as readonly number[]).includes(
    settings?.planQuickMinutes ?? -1,
  )
    ? (settings?.planQuickMinutes as number)
    : DEFAULT_PLAN_QUICK_MINUTES
  // 自動提案の条件UI(2026-07-13追加): ジャンル優先(指定なしも含め単一選択)
  // 2026-08-09 便EO(オーナー指示): 「高たんぱく優先」の絞り込みは削除した
  // 2026-08-19 便HT(オーナー指示): チップの並び → プルダウン1つ
  /**
   * 選んでいる料理のジャンル(2026-08-22 便IY・オーナー原文
   * 「週献立は、「料理のジャンル」は複数選択のほうがいいかも。１つしか選べないと、
   *   １週間中華だけ、という献立しか組めない。全てを選ぶと、中華は入れたくないけど和洋食は
   *   混在させたい、ができない。」)。
   *
   * 1つだけ選ぶプルダウンをやめ、**選べるジャンルのぶんだけ並べて選ぶ/外す**形にした。
   * 既定(未設定)は3つとも選んだ状態＝「指定なし」(全部から選ぶ＝直す前と同じ振る舞い)。
   * 3つとも選んでいるあいだは提案に何も渡さない(planGenresOption)＝
   * ジャンルタグを持たない品まで候補から落とさない。
   * 最後の1つは外せない(toggleMealGenre)＝候補が無くなる状態を作らせない。
   *
   * **設定に覚える**(2026-08-22 司令部裁定B案)。「うちは中華を作らない」は年単位で続く
   * 家庭の好みなので、開くたびに選び直させない(planPurpose と同じ理由)。
   * 読み出しは normalizePlanGenres を通す＝1つだけ選んでいた頃の保存値も1件として読み、
   * 知らないジャンル名・壊れた値でも候補を0件にしない。
   */
  const genreFilters = normalizePlanGenres(settings?.planGenres)
  /** ジャンルで絞っているか(3つとも選んでいる＝絞っていない) */
  const genreFiltered = genreFilters.length < MEAL_GENRES.length
  /** 提案エンジンへ渡す枠。絞っていなければ渡さない＝「指定なし」と同じ扱いにする */
  const planGenresOption = genreFiltered ? genreFilters : undefined
  const toggleGenreFilter = (genre: MealGenre) =>
    saveSettings({ planGenres: toggleMealGenre(genreFilters, genre) })
  /**
   * 目的モード（2026-08-02 便CP-2・docs/62 決定②。Pro機能）。
   * 時短・ジャンルと違って設定に保存するのは、この指定が「1か月続ける」ためのものだから
   * （画面を開き直すたびに選び直させない）。未解錠のときは保存値があっても効かせない
   * （Pro端末のバックアップを未解錠端末へ復元したときに、条件だけ生き残らないようにする）。
   */
  const planPurpose: MealPurpose | undefined = isPro ? settings?.planPurpose : undefined
  const changePurpose = (next: MealPurpose | undefined) => {
    saveSettings({ planPurpose: next })
  }
  /**
   * 「現在の条件」の窓が開いているか（2026-08-19 便ID・④。オーナーはA案＝窓を選択）。
   * 2026-07-16 UI総点検A-3から折りたたみだったものを窓に替えた。既定は閉じている。
   * 週タブと月タブが同じ状態を共有する（条件そのものを共有しているため）。
   */
  const [suggestConditionsOpen, setSuggestConditionsOpen] = useState(false)
  const closeSuggestConditions = () => setSuggestConditionsOpen(false)
  /**
   * 条件が1つでも効いているか（2026-08-19 便IF・③）。
   * 効いていないのに「条件をクリア」を出すと、押しても何も変わらないボタンになる
   * （日タブの「条件をしぼる」の窓と同じ判断の仕方）。
   * 分数（planQuickMinutes）は「調理時間◯分以内を優先」がOFFなら効いていないので数えない。
   */
  const anyPlanConditionActive = quickOnly || genreFiltered || planPurpose != null
  /**
   * 「条件をクリア」（2026-08-19 便IF・③。オーナー原文「献立を提案の提案の条件に、
   * リセット機能がない」）。日タブと同じで、**選んだ条件だけ**を開いた直後の状態に戻す。
   * 分数そのもの（planQuickMinutes）は覚えたままにする＝日タブの「◯分以内」の分数を
   * クリアで消さないのと同じ作法（次に使うときの好みまでは捨てない）。
   */
  const clearSuggestConditions = () => {
    // ジャンルは**保存も消す**（画面だけ戻って保存が残る、を作らない。2026-08-22 便IY）。
    // 未設定＝3つとも選んだ状態なので、消せばそのまま「指定なし」に戻る。
    // 栄養から組む(planPurpose)は解錠済みで選んでいるときだけ消す＝未解錠の端末で
    // Proの保存値を巻き添えにしない（直す前と同じ扱い）。書き込みは1回にまとめる。
    // 2026-08-24 便KJ・①: 調理時間のON/OFF（planQuickOn）も同じ書き込みで消す
    // ＝画面だけ戻って保存が残る、をこちらにも作らない。分数（planQuickMinutes）は
    // 今までどおり覚えたままにする（次に使うときの好みまでは捨てない）
    saveSettings(
      planPurpose != null
        ? { planGenres: undefined, planPurpose: undefined, planQuickOn: false }
        : { planGenres: undefined, planQuickOn: false },
    )
  }
  /**
   * 調理時間の条件を選ぶ（2026-08-20 便II・①）。
   *
   * ON/OFFのボタン＋分数のプルダウンの2つで1つの条件を言っていたのをやめ、**プルダウン1つ**にした
   * （同じ窓の「料理のジャンル」と同じ形）。空文字＝「指定なし」で条件そのものを外す。
   * 分数を選べばその場で条件が効く＝押しても何も起きない欄を窓の中に置かない
   * （便IDから引き継いだ作法）。分数の覚え（planQuickMinutes）は「指定なし」に戻しても消さない
   * ＝次に使うときの好みまでは捨てない（「条件をクリア」と同じ扱い）。
   */
  const changeQuickMinutes = (value: string) => {
    if (value === '') {
      setQuickOnly(false)
      return
    }
    const minutes = Number(value)
    if (!(PLAN_QUICK_MINUTES_OPTIONS as readonly number[]).includes(minutes)) return
    // 2026-08-24 便KJ・①: ON/OFF も設定に覚えるようになったので、分数と一緒に1回で書く
    // （2回に分けると、片方だけ届いた瞬間の状態が画面に出る）
    saveSettings({ planQuickOn: true, planQuickMinutes: minutes })
  }
  const [message, setMessage] = useState('')
  /**
   * 「作った記録の一覧へ」をトーストに出すかどうかの控え（2026-08-26 便LJ・オーナー原文
   * 「レシピ詳細以外からの「作った！」は内容の入力が省略されています。記録した後に出る
   * トーストに、「作った記録の一覧にいく」選択が欲しいです。」）。
   *
   * 献立の「作った！」は、何人分・ひとこと・写真を聞かずに記録を付ける（聞くのはレシピ詳細だけ）。
   * 足したくなったときの行き先が画面のどこにも無く、タブを渡り歩くしかなかった。
   * 出したトーストの文言そのものを持って見比べる＝別の操作でトーストが差し替わったら
   * 行き先も一緒に消える（「元に戻す」とまったく同じ作法。並行調理ナビも同じ形）。
   */
  const [historyToast, setHistoryToast] = useState('')
  /**
   * 他の画面から「結果を伝えたうえで献立へ戻す」ときのトースト（2026-08-11 便FP）。
   * レシピ一覧でまとめて今日の献立に入れて戻ってきたときに、何品どこへ入ったかを出す。
   * 一度出したら履歴から消す＝ブラウザの戻る/進むで同じ知らせが再び出ないようにする
   */
  useEffect(() => {
    const handedOver = (location.state as { toast?: string } | null)?.toast
    if (!handedOver) return
    setMessage(handedOver)
    navigate(location.pathname + location.search, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state])
  /**
   * 鍵の掛かった食事への手での操作を止める（2026-08-08 便EA・オーナー指示
   * 「ロックしたら、手動削除もできなくして」）。
   * 画面側でもボタンを押せない見た目にするが、実処理の入口でも必ず通す
   * ＝週タブ・月タブの日モーダルなど、どの入口から来ても同じところで止まる。
   */
  const blockedByLock = (date: string, slot: MealSlot, edit: MealSlotEdit): boolean => {
    if (!isMealEditBlocked(lockedKeys, date, slot, edit)) return false
    setMessage(ja.mealPlan.lockedEditBlocked)
    return true
  }
  /**
   * 直前の「作った」を戻すための控え（2026-08-02 便DE-3）。トーストに「元に戻す」を出すのは、
   * いま出ているトーストがその記録のものであるときだけにしたいので、対象のレシピと
   * 一緒にそのときの文言も持っておく（別の操作でトーストが差し替わったら操作ごと消える）。
   */
  // 2026-08-03 便DP-1: 「全て作った！」でも戻せるよう、控えは品ごとの配列で持つ
  // （1品の「作った！」は1件だけの配列。取り消しの処理は複数件と共通）。
  // fromPlan＝記録を付けた時点で「今週の予定の写し」だったかどうか。戻すときに同じ印を
  // 付け直さないと、取り消した品だけが週の予定と切り離される（便DP-4のバグが戻る）
  const [undoCooked, setUndoCooked] = useState<{
    items: { recipeId: number; fromPlan?: boolean }[]
    message: string
  } | null>(null)
  const undoCookedActive = undoCooked != null && undoCooked.message === message
  const runUndoCooked = async () => {
    if (!undoCooked) return
    const requested = undoCooked.items.length
    const undone = await undoTodayListCooked(undoCooked.items)
    setUndoCooked(null)
    if (undone === 0) {
      setMessage(ja.mealPlan.todayCookedUndoNothing)
      return
    }
    // 1品だけのときは件数を出さない（数字が情報を足さない）。複数件は実際に戻した品数を出す
    const base =
      requested === 1
        ? ja.mealPlan.todayCookedUndone
        : ja.mealPlan.todayCookedUndoneMany.replace('{n}', String(undone))
    // 在庫を1段階下げる設定がONのときは、戻していないものを黙らずに添える
    setMessage(
      settings?.cookedReflectPantry
        ? `${base} ${ja.mealPlan.todayCookedUndoPantryNote}`
        : base,
    )
  }

  // 日付メモ(2026-07-29 便CB-1・docs/59 A-2): レシピに紐付かない「その日1行の自由メモ」。
  // 週タブの各日カード・月タブの日モーダルで編集し、月カレンダーのセルには「メモあり」の点を出す。
  // 週用と月用で別々に取るのは、表示中の週と表示中の月がずれていても両方が正しく出るようにするため
  // (週タブで前後の週へ移動している間も、月タブは表示中の月の印を出し続ける)
  const weekDayNotes = useDayNoteRange(dates[0], dates[6])
  const weekDayNoteByDate = useMemo(() => {
    const map = new Map<string, DayNote>()
    weekDayNotes?.forEach((n) => map.set(n.date, n))
    return map
  }, [weekDayNotes])
  const dbMonthDayNotes = useDayNoteRange(
    monthDatesList[0],
    monthDatesList[monthDatesList.length - 1],
  )
  const monthDayNotes = isDemo ? demo.dayNotes : dbMonthDayNotes
  const monthDayNoteByDate = useMemo(() => {
    const map = new Map<string, DayNote>()
    monthDayNotes?.forEach((n) => map.set(n.date, n))
    return map
  }, [monthDayNotes])
  /* ------------------------------------------------------------------
     月タブが相手にする範囲（2026-08-26 便LH・オーナー原文
     「１ヶ月分の内容が、そのまま絞った期間の内容に書き変わるのがベスト。」
     「献立提案も絞った期間内に対応して。」）。

     「期間で絞る」で開始日と終了日の両方を選んだあいだは、月タブの
     食費・栄養・献立をまとめて提案・テンプレート・献立表が、**表示している月ではなく
     選んだ期間**を相手にする。別のカードを増やさず、同じ場所の中身が入れ替わる。
     期間を選んでいないあいだは、今までとまったく同じ（表示している月の全日）。
     ------------------------------------------------------------------ */
  const monthTargetDates = useMemo(
    () =>
      monthRangeActive && rangeStart != null && rangeEnd != null
        ? rangeDates(rangeStart, rangeEnd)
        : monthDatesList,
    [monthRangeActive, rangeStart, rangeEnd, monthDatesList],
  )
  /** 上の範囲に入っている献立の枠。月をまたぐ期間もそのまま引く（期間用のDB問い合わせを使う） */
  const monthTargetEntries = useMemo(() => {
    if (!monthRangeActive || rangeStart == null || rangeEnd == null) return monthEntries ?? []
    // サンプルデモは端末のDBを一切読まないので、見本の献立から期間ぶんを切り出す
    if (isDemo)
      return (demo?.entries ?? []).filter((e) => e.date >= rangeStart && e.date <= rangeEnd)
    return rangeQueryEntries ?? []
  }, [monthRangeActive, rangeStart, rangeEnd, monthEntries, isDemo, demo, rangeQueryEntries])
  /** 上の範囲の日付メモ（献立表に載せる・一括提案で「メモを書いた日」を外すのに使う） */
  const monthTargetNotes = useMemo(() => {
    const list =
      !monthRangeActive || rangeStart == null || rangeEnd == null
        ? (monthDayNotes ?? [])
        : isDemo
          ? (demo?.dayNotes ?? []).filter((n) => n.date >= rangeStart && n.date <= rangeEnd)
          : (rangeQueryDayNotes ?? [])
    return new Map(list.map((n) => [n.date, n.text]))
  }, [monthRangeActive, rangeStart, rangeEnd, monthDayNotes, isDemo, demo, rangeQueryDayNotes])
  // メモの保存(空にして離れたらその日のメモを消す)。黙って保存すると保存されたか分からないので、
  // 保存したのか消したのかをトーストで出し分ける
  /**
   * 「キャンセル」で巻き戻す最中に、閉じていくDayNoteEditorが最後に投げてくる保存を1回だけ無視するための印
   * （2026-08-07 便DU）。DayNoteEditorは書きかけを落とさないよう、外れるときにも差分があれば保存する。
   * キャンセルはその保存より後にメモを書き戻すので、印が無いと取り消したはずのメモが復活する。
   * 日付で持ち、1回使ったら消す＝週タブの別の日のメモ保存には一切影響しない。
   */
  const cancelledNoteDateRef = useRef<string | null>(null)
  const handleSaveDayNote = async (date: string, text: string) => {
    if (cancelledNoteDateRef.current === date) {
      cancelledNoteDateRef.current = null
      return
    }
    const result = await saveDayNote(date, text)
    setMessage(result === 'removed' ? ja.mealPlan.dayNoteRemoved : ja.mealPlan.dayNoteSaved)
  }

  /**
   * 月タブの日の窓を開いたときの控え（2026-08-07 便DU・オーナー指示⑧）。
   * 窓の中の編集はその場でデータへ入る（週タブと同じ編集部品をそのまま使うため）ので、
   * 「キャンセル」はこの控えへ書き戻す操作になる。控えは窓を開くたびに取り直す。
   */
  const [dayModalSnapshot, setDayModalSnapshot] = useState<{
    date: string
    entries: MealPlanEntry[]
    note: string
  } | null>(null)
  const openDayModal = (date: string) => {
    cancelledNoteDateRef.current = null
    // 窓は必ず通常表示から開く（2026-08-23 便JN。週の曜日カードの既定と同じ）
    setMonthEditDate(null)
    setDayModalSnapshot({
      date,
      entries: (monthEntries ?? []).filter((e) => e.date === date).map((e) => ({ ...e })),
      note: monthDayNoteByDate.get(date)?.text ?? '',
    })
    setDayModalDate(date)
  }
  /**
   * レシピ詳細から月タブへ戻ってきたときに、開いていた日の窓を開き直す（2026-08-10 便FD）。
   * 月の献立（monthEntries）が届くまで待つ＝窓が控える「開いたときの中身」が空にならない。
   */
  useEffect(() => {
    if (pendingDayModal == null || viewMode !== 'month' || monthEntries == null) return
    openDayModal(pendingDayModal)
    setPendingDayModal(null)
    // openDayModal は毎描画で作り直される関数なので依存に入れない（入れると開いた直後に開き直す）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDayModal, viewMode, monthEntries])
  /** 窓を開いてから何が変わったか（変わっていなければ dirty=false ＝ 下は「閉じる」1つだけ） */
  const dayModalDiff = useMemo(() => {
    if (!dayModalDate || dayModalSnapshot?.date !== dayModalDate) return null
    return diffDayEdit(
      { entries: dayModalSnapshot.entries, note: dayModalSnapshot.note },
      {
        entries: (monthEntries ?? []).filter((e) => e.date === dayModalDate),
        note: monthDayNoteByDate.get(dayModalDate)?.text ?? '',
      },
    )
  }, [dayModalDate, dayModalSnapshot, monthEntries, monthDayNoteByDate])
  /** 規約F: 何を取り消し、何が戻るのかを件数つきで両方書く（2026-08-15 便GWで窓の形に） */
  const dayModalCancelConfirmRequest = (diff: DayEditDiff, snapshotCount: number) => {
    const changes = [
      diff.added > 0 ? ja.mealPlan.monthDayCancelAdded.replace('{n}', String(diff.added)) : null,
      diff.changed > 0
        ? ja.mealPlan.monthDayCancelChanged.replace('{n}', String(diff.changed))
        : null,
      diff.removed > 0
        ? ja.mealPlan.monthDayCancelRemoved.replace('{n}', String(diff.removed))
        : null,
      diff.noteChanged ? ja.mealPlan.monthDayCancelNoteChanged : null,
    ]
      .filter((v): v is string => v != null)
      .join('・')
    return {
      title: ja.mealPlan.monthDayCancelConfirmTitle,
      bullets: [
        { label: ja.mealPlan.monthDayCancelUndoLabel, text: changes },
        {
          label: ja.mealPlan.monthDayCancelBackLabel,
          text: ja.mealPlan.monthDayCancelBack.replace('{n}', String(snapshotCount)),
        },
      ],
      notes: [ja.mealPlan.monthDayCancelNote],
      confirmLabel: ja.mealPlan.monthDayCancelConfirmOk,
    }
  }
  /** 「キャンセル」＝窓を開いたときの状態へ戻して閉じる（確認あり） */
  const cancelDayModal = async () => {
    const snapshot = dayModalSnapshot
    if (!snapshot || !dayModalDiff?.dirty) {
      setDayModalDate(null)
      return
    }
    if (!(await confirm(dayModalCancelConfirmRequest(dayModalDiff, snapshot.entries.length))))
      return
    // 窓を閉じる前に書き戻す（閉じる過程のメモ保存と競合させない。印は保険）
    cancelledNoteDateRef.current = snapshot.date
    await restoreDayMealPlan(snapshot.date, snapshot.entries)
    await saveDayNote(snapshot.date, snapshot.note)
    setDayModalDate(null)
    setMessage(ja.mealPlan.monthDayCancelDone)
    // 取り消した日にUI上だけ足していた空き行も一緒に片付ける（データではないので残っていても
    // 害はないが、「取り消した」のに空き行だけ増えたままなのは分かりにくい）
    const prefix = `${snapshot.date}|`
    setExtraRows((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))))
    setHiddenDefaultRows((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith(prefix))),
    )
    setTimeout(() => {
      if (cancelledNoteDateRef.current === snapshot.date) cancelledNoteDateRef.current = null
    }, 0)
  }

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
  /**
   * ×で畳んだ「既定の空欄行」（date|slotキー→畳んだ役割の一覧。2026-08-02 便CW-2）。
   * 「まだ何も入っていない主菜/副菜の枠まで常に出ていて邪魔」というオーナー指摘への対応。
   * 「＋料理を追加」で増やした行（extraRows）と同じくUI上だけの状態＝DBには保存しない
   * （献立データは1件も消さない。畳んでいるだけなので、同じ入口から戻せる）。
   */
  const [hiddenDefaultRows, setHiddenDefaultRows] = useState<Record<string, MealRole[]>>({})
  const hideDefaultRow = (date: string, slot: MealSlot, role: MealRole) => {
    const key = `${date}|${slot}`
    setHiddenDefaultRows((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []).filter((r) => r !== role), role],
    }))
  }
  const showDefaultRow = (date: string, slot: MealSlot, role: MealRole) => {
    const key = `${date}|${slot}`
    setHiddenDefaultRows((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((r) => r !== role),
    }))
  }
  /**
   * 「＋料理を追加」→主菜/副菜 の実処理。畳んである既定の空欄行があるときは、それを戻すだけにする
   * （行を2つ出さない）。畳んでいなければ従来どおり行を1つ増やす。
   */
  const addOrRestoreRow = (date: string, slot: MealSlot, role: MealRole) => {
    if (blockedByLock(date, slot, 'add')) return
    const key = `${date}|${slot}`
    const hasEntry = (entriesByDateSlotAll.get(key) ?? []).some((e) => (e.role ?? 'main') === role)
    // 既にその役割の料理が入っている枠では、畳んだ記録があっても空欄行は出ない
    // （＝押しても何も起きない）ので、その場合は従来どおり行を1つ増やす
    if (!hasEntry && (hiddenDefaultRows[key] ?? []).includes(role)) {
      showDefaultRow(date, slot, role)
      return
    }
    addExtraRow(date, slot, role)
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
  /**
   * 過ぎた日の編集モードで開く「作った記録を追加」のレシピ選び（2026-08-22 便JF・①）。
   * 献立の枠へ入れる pickerTarget とは別に持つ＝枠（食事・役割）の無い選び方だから。
   * 出す一覧・絞り込みはまったく同じものを使い回す（選ぶ画面をアプリの中で2つに割らない）。
   */
  const [recordPickDate, setRecordPickDate] = useState<string | null>(null)
  // ピッカーは週の枠(pickerTarget)への割り当てと、過ぎた日の記録(recordPickDate)の2つで使う。
  // 空状態の「今日の献立を探す」は2026-07-24
  // 便BN・タスク1でレシピ一覧タブへの遷移に変更したため、旧「今日の献立ピッカー」モードは廃止した
  const pickerOpen = pickerTarget != null || recordPickDate != null
  /**
   * 「おまかせで献立を組む」でいま組んである献立のレシピID（2026-08-17 便HI）。
   * **まだ今日の献立には入っていない**＝押すたびにここが入れ替わり、見比べられる。
   * 「今日の献立に入れる」で食事を選ぶと入って空になる。
   *
   * 2026-08-19 便HT: レシピ詳細から戻ってきたときだけ、離れる直前に出ていた組から始める
   * （②。1品側の pinnedRecipeId とまったく同じ覚えを読んでいる）。それ以外のときは空
   * ＝ふつうに組み直す。空でなければ TodaySuggestPanel の自動の1回も走らない
   * ＝戻った瞬間に別の組み合わせへ差し替わらない。
   */
  const [suggestPairIds, setSuggestPairIds] = useState<number[]>(returnedSuggestion.planIds)
  /**
   * いま「今日なに作る？」の「1品」側に出ている料理（2026-08-21 便IP・①）。
   * 節の中の状態なので TodaySuggestPanel から知らせてもらう（onShownOneChange）。
   */
  const [shownSuggestionOneId, setShownSuggestionOneId] = useState<number | null>(
    returnedSuggestionId,
  )
  /**
   * 「今日なに作る？」にいま出ているものを、離れてもよいように控えておく（2026-08-21 便IP・①）。
   *
   * 直すバグ（便IIの実測）: **作った記録の一覧へ行って戻るたびに別の献立を組み直していた。**
   * 主菜が一品もの（カレー・丼・麺・鍋）だと副菜のカードが付かないので、節の高さが
   * 156〜170px→74pxに縮み、ページの下端が82px上がる＝画面が跳ねる。
   * オーナーは同じことをレシピ詳細からの戻りについて指摘済み（便HT）で、そこだけが直っていた。
   *
   * 直し方: 出ていくときに1か所ずつ覚えさせるのをやめ、**出ているものをそのまま控え続ける**。
   * 日タブから出ていく道はレシピ詳細・記録の一覧・記録の中身・記録の編集…と複数あり、
   * 道が1本増えるたびに覚え忘れが生まれる（今回がその1本目だった）。
   *
   * 古い提案が残り続けないのは、**読む側と捨てる側で閉じている**から:
   *  ・読むのは `?focus=today` が付いているときだけ＝日タブから開いた画面の「戻る」だけ
   *  ・献立の画面に着いた時点で必ず捨てる（上の removeSessionItem。1回きり）
   * ＝下の並び（タブバー）で自分から離れた人は、次に開いたときふつうに組み直したものを見る。
   * 線引きの理由は logic/navMemory.ts の DAY_SUGGEST_PIN_KEY に書いてある。
   */
  useEffect(() => {
    writeSessionItem(
      DAY_SUGGEST_PIN_KEY,
      serializeSuggestionPin(shownSuggestionOneId, suggestPairIds),
    )
  }, [shownSuggestionOneId, suggestPairIds])
  /**
   * 「今日の献立に入れる」で開く「どの食事に入れますか？」の窓の中身（2026-08-18 便HM）。
   *
   * 「1品」と「献立」のどちらを出しているときも同じボタン・同じ窓を通す
   * （オーナー「今日の献立にれるボタンを1品にも適用えきるし」）。
   * `from` は入れたあとの後片付けと知らせの言い分けにだけ使う
   * （'plan'＝組んである献立を空にする／料理名ではなく品数で言う）。
   */
  const [todaySlotPick, setTodaySlotPick] = useState<{
    ids: number[]
    from: 'one' | 'plan'
    title: string
  } | null>(null)
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
  // (2026-07-29 便CB-1・A-3: 月タブの日モーダルから開いた行も対象にするため、週+月の合算から引く)
  const currentPickerRecipeId = useMemo(() => {
    if (pickerTarget?.entryId == null) return undefined
    return allPlanEntries.find((e) => e.id === pickerTarget.entryId)?.recipeId
  }, [pickerTarget, allPlanEntries])
  /**
   * 選び直す前に入っていたレシピ（2026-08-10 便FD・オーナー実機
   * 「レシピ名タップ→レシピ一覧表示→同じ場所を再度タップ→レシピが変更される、といった流れで
   *   誤操作になる。レシピは一つ前の設定に戻せるようにしたい」）。
   *
   * 枠のid → 直前に入っていたレシピID。この画面を開いているあいだだけ覚える一時的な控えで、
   * 端末に残すデータ（IndexedDB）には何も書かない。同じ枠を何度選び直しても、覚えているのは
   * つねに「1つ前」だけ（オーナーの要望どおり）。
   */
  const [previousRecipeByEntry, setPreviousRecipeByEntry] = useState<Record<number, number>>({})
  /**
   * いま開いている枠の「前回選択」（一覧の上のほうに並べてすぐ選び直せるようにする）。
   * いま入っているレシピと同じになったら出さない（同じ料理が2行並ぶだけになるため）。
   */
  const previousPickerRecipeId = useMemo(() => {
    if (pickerTarget?.entryId == null) return undefined
    const previous = previousRecipeByEntry[pickerTarget.entryId]
    return previous != null && previous !== currentPickerRecipeId ? previous : undefined
  }, [pickerTarget, previousRecipeByEntry, currentPickerRecipeId])
  // 表示用リスト: 現在割り当て済みのレシピ→前回選択していたレシピ の順に先頭へ固定する。
  // 固定するのは絞り込み結果に残っているものだけ＝検索で対象外になったものは並べ替えない
  // （バッジも出ない）
  const displayedRecipes = useMemo(() => {
    const pinnedIds = [currentPickerRecipeId, previousPickerRecipeId].filter(
      (id): id is number => id != null,
    )
    if (pinnedIds.length === 0) return filteredRecipes
    const pinned = pinnedIds
      .map((id) => filteredRecipes.find((r) => r.id === id))
      .filter((r): r is Recipe => r != null)
    if (pinned.length === 0) return filteredRecipes
    const pinnedSet = new Set(pinned.map((r) => r.id))
    return [...pinned, ...filteredRecipes.filter((r) => !pinnedSet.has(r.id))]
  }, [filteredRecipes, currentPickerRecipeId, previousPickerRecipeId])

  const closePicker = () => {
    setPickerTarget(null)
    setRecordPickDate(null)
  }

  const openPicker = (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    // 鍵が掛かっていれば差し替え・新規割り当てとも開かない(2026-08-08 便EA)
    if (blockedByLock(date, slot, 'replace')) return
    setPickerTarget({ date, slot, role, entryId, extraLocalId })
    setPickerQuery('')
  }

  const pickRecipe = async (recipeId: number) => {
    // 過ぎた日の「作った記録を追加」から開いたとき（2026-08-22 便JF・①）
    if (recordPickDate) {
      const date = recordPickDate
      setRecordPickDate(null)
      await addPastCookedRecord(date, recipeId)
      return
    }
    if (!pickerTarget) return
    const { date, slot, role, entryId, extraLocalId } = pickerTarget
    if (entryId != null) {
      // 2026-08-10 便FD: 入れ替えたときは、何が何に変わったかをその場で知らせ、
      // 1回で元へ戻せるようにする（誤って選び直したことに気づけない、への対応）
      const before = allPlanEntries.find((e) => e.id === entryId)?.recipeId
      await updateMealEntryRecipe(entryId, recipeId)
      const beforeTitle = before != null ? recipeById.get(before)?.title : undefined
      const afterTitle = recipeById.get(recipeId)?.title
      if (before != null && before !== recipeId && beforeTitle && afterTitle) {
        setPreviousRecipeByEntry((prev) => ({ ...prev, [entryId]: before }))
        const toast = ja.mealPlan.pickReplacedToast
          .replace('{before}', beforeTitle)
          .replace('{after}', afterTitle)
        setMessage(toast)
        setUndoPick({ entryId, recipeId: before, title: beforeTitle, message: toast })
      }
    } else {
      await addMealEntry(date, slot, recipeId, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
    }
    setPickerTarget(null)
  }

  /**
   * 過ぎた日に「作った記録」を後から足す（2026-08-22 便JF・①）。
   *
   * 記録する食数は、ボタン1回の「作った！」とまったく同じ決め方
   * （logic/servings.ts effectiveMealServings ＝ 設定「食数の設定」の人数、
   * 無ければレシピに登録されている人数分。2026-08-10 便FF）。
   *
   * **食材の在庫には触らない**（設定「作った！で在庫を1段階下げる」がONでも下げない）。
   * 在庫は「いま家にある物」の記録なので、何日も前に作った分をいま引くと、
   * そのあいだに買い足した分まで減らしてしまう。設定がONの人には、押す前に読める場所で
   * そう書いておく（pastRecordPantryNote・規約F）。
   *
   * 同じ日に同じ料理の「ボタン1回の記録」がもう付いているときは足さない
   * （「まとめて作った！」と同じ歯止め＝logic/cooked.ts hasOneTapCookedLog）。
   */
  const fillRecordText = (text: string, date: string, title: string) =>
    text
      .replace('{m}', String(Number(date.slice(5, 7))))
      .replace('{d}', String(Number(date.slice(8, 10))))
      .replace('{title}', title)

  const addPastCookedRecord = async (date: string, recipeId: number) => {
    const recipe = recipeById.get(recipeId)
    if (!recipe) return
    if (hasOneTapCookedLog(recipe.cookedLogs, date)) {
      setMessage(fillRecordText(ja.mealPlan.pastRecordAlready, date, recipe.title))
      return
    }
    await addCookedLog(recipeId, {
      date,
      servings: effectiveMealServings(undefined, householdServings, recipe.servings),
    })
    const toast = fillRecordText(ja.mealPlan.pastRecordAddedToast, date, recipe.title)
    setMessage(toast)
    setUndoRecord({ recipeId, date, title: recipe.title, message: toast })
    // 内容を足しに行ける場所を添える（2026-08-26 便LJ）
    setHistoryToast(toast)
  }

  /**
   * 過ぎた日の記録を1件だけ消す（2026-08-22 便JF・オーナー追加指示「削除ボタンも入れて」）。
   *
   * 消す前に確認の窓を通す（規約F: 何が消えて何が残るかを件数つきで両方書く）。
   * 記録の小窓（「記録を見る」）からの削除は今までどおり残してあり、こちらは
   * **編集モードの中だけ**に出る2本目の道。
   *
   * レシピを消したあとに残っている記録（detachedRecordId 付き）も同じボタンで消せる。
   * 消す前の姿を控えてから消すので、どちらの記録もトーストの「元に戻す」で1回で戻る。
   */
  const deletePastCookedRecord = async (
    date: string,
    entry: CookedLogDetailTarget & { detachedRecordId?: number },
  ) => {
    const title = entry.recipe.title
    const fill = (text: string) => fillRecordText(text, date, title)
    // 「残るもの」の件数は**その日の他の記録**（画面に並んでいるものと同じ数え方）
    const restCount = Math.max(0, shownLogsOf(date).length - 1)
    const ok = await confirm({
      title: fill(ja.mealPlan.pastRecordDeleteTitle),
      bullets: [
        {
          label: ja.mealPlan.pastRecordDeleteGoneLabel,
          text: ja.mealPlan.pastRecordDeleteGone.replace(
            '{p}',
            entry.log.photo ? ja.mealPlan.pastRecordDeleteGonePhoto : '',
          ),
        },
        {
          label: ja.mealPlan.pastRecordDeleteKeptLabel,
          text: ja.mealPlan.pastRecordDeleteKept.replace('{n}', String(restCount)),
        },
      ],
      confirmLabel: ja.mealPlan.pastRecordDeleteOk,
    })
    if (!ok) return
    // 出すトーストの文言は先に決める＝控えとトーストが必ず同じ字になる（ほかの取り消しと同じ作法）
    const toast = fill(ja.mealPlan.pastRecordDeletedToast)
    if (entry.detachedRecordId != null) {
      const snapshot = await deleteDetachedLogWithSnapshot(entry.detachedRecordId, entry.logIndex)
      if (!snapshot) return
      setUndoRecordDelete({ kind: 'detached', record: snapshot, date, title, message: toast })
    } else if (entry.recipe.id != null) {
      // 戻すときに同じ中身（日付・人数・メモ・写真）で入れ直せるよう、消す前の1件を控える
      const removed = entry.log
      await deleteCookedLog(entry.recipe.id, entry.logIndex)
      setUndoRecordDelete({
        kind: 'recipe',
        recipeId: entry.recipe.id,
        log: removed,
        date,
        title,
        message: toast,
      })
    } else {
      return
    }
    setMessage(toast)
  }

  /**
   * 消した記録の取り消し（2026-08-22 便JF）。ほかの取り消しとまったく同じ作法で、
   * 出したトーストの文言まで一緒に持つ（別の操作でトーストが差し替わったら一緒に消える）。
   */
  const [undoRecordDelete, setUndoRecordDelete] = useState<
    | { kind: 'recipe'; recipeId: number; log: CookedLog; date: string; title: string; message: string }
    | { kind: 'detached'; record: DetachedCookedRecord; date: string; title: string; message: string }
    | null
  >(null)
  const undoRecordDeleteActive =
    undoRecordDelete != null && undoRecordDelete.message === message
  const runUndoRecordDelete = async () => {
    if (!undoRecordDelete) return
    if (undoRecordDelete.kind === 'detached') {
      await restoreDetachedRecord(undoRecordDelete.record)
    } else {
      await addCookedLog(undoRecordDelete.recipeId, undoRecordDelete.log)
    }
    setUndoRecordDelete(null)
    setMessage(
      fillRecordText(
        ja.mealPlan.pastRecordDeleteUndoneToast,
        undoRecordDelete.date,
        undoRecordDelete.title,
      ),
    )
  }

  /**
   * 足した記録の取り消し（2026-08-22 便JF・①）。ほかの取り消しと同じ作法で、
   * 出したトーストの文言まで一緒に持つ（別の操作でトーストが差し替わったら一緒に消える）。
   */
  const [undoRecord, setUndoRecord] = useState<{
    recipeId: number
    date: string
    title: string
    message: string
  } | null>(null)
  const undoRecordActive = undoRecord != null && undoRecord.message === message
  const runUndoRecord = async () => {
    if (!undoRecord) return
    await removeOneTapCookedLog(undoRecord.recipeId, undoRecord.date)
    setUndoRecord(null)
    setMessage(
      fillRecordText(ja.mealPlan.pastRecordUndoneToast, undoRecord.date, undoRecord.title),
    )
  }

  /**
   * 「元に戻す」で1つ前のレシピへ戻すための控え（2026-08-10 便FD）。
   * 「作った！」の取り消し（undoCooked）と同じ作法で、出したトーストの文言まで一緒に持つ
   * ＝別の操作でトーストが差し替わったら、この取り消しも一緒に消える。
   */
  const [undoPick, setUndoPick] = useState<{
    entryId: number
    recipeId: number
    title: string
    message: string
  } | null>(null)
  const undoPickActive = undoPick != null && undoPick.message === message
  const runUndoPick = async () => {
    if (!undoPick) return
    await updateMealEntryRecipe(undoPick.entryId, undoPick.recipeId)
    // 戻した時点で「1つ前」はもう無い（いま入っているものがそれ）ので控えを捨てる
    setPreviousRecipeByEntry((prev) => {
      const next = { ...prev }
      delete next[undoPick.entryId]
      return next
    })
    setUndoPick(null)
    setMessage(ja.mealPlan.pickUndoneToast.replace('{title}', undoPick.title))
  }

  /**
   * 1人分の栄養（perServing）のキャッシュ（2026-08-02 便CP-2・docs/60 §3-2-2「栄養値はキャッシュする」）。
   * 目的モードの引き直しは同じレシピを何度も評価するので、computeRecipeNutrition を毎回呼ばない。
   * レシピが更新されたら（useLiveQueryのrecipesが差し替わったら）Mapごと作り直す＝古い値が残らない。
   */
  const perServingCacheRef = useRef(new Map<number, NutrientTotals>())
  useEffect(() => {
    perServingCacheRef.current = new Map()
  }, [recipes])
  const perServingOf = (recipe: Recipe): NutrientTotals => {
    const id = recipe.id
    if (id == null) return computeRecipeNutrition(recipe).perServing
    const cached = perServingCacheRef.current.get(id)
    if (cached) return cached
    const value = computeRecipeNutrition(recipe).perServing
    perServingCacheRef.current.set(id, value)
    return value
  }

  /**
   * 主菜+副菜のペアを1組引く（2026-08-02 便CP-2・docs/62 決定②・docs/60 §3-2-2 案A）。
   *
   * 目的が指定されていなければ suggestPairForSlot を1回呼ぶだけ＝**従来と完全に同じ挙動**。
   * 目的が指定されているときだけ、同じ引数で最大 PURPOSE_REDRAW_ATTEMPTS 回引き直して、
   * 目的の軸に最も沿うペアを採る（エンジン本体は無改造。一品ものガード等は chooseBalancedPair 側）。
   */
  const drawPair = (
    options: Parameters<typeof suggestPairForSlot>[1],
    /** 母集団（2026-08-19 便HT。「今日なに作る？」の絞り込みを通したレシピ。省略で従来どおり全部） */
    pool: Recipe[] = visibleRecipes,
  ): SuggestPairResult => {
    const draw = () => suggestPairForSlot(pool, options)
    const purpose = planPurpose
    if (!purpose) return draw()
    return chooseBalancedPair(
      draw,
      (pair) =>
        purposePenalty(
          purpose,
          [pair.main, pair.side].filter((r): r is Recipe => r != null).map(perServingOf),
        ),
      PURPOSE_REDRAW_ATTEMPTS,
    )
  }

  /**
   * 「今日なに作る？」の絞り込み（条件チップ・在庫の食材から）を献立エンジンにも効かせるための
   * 道具（2026-08-19 便HT・オーナー原文「献立にも1品と同じように条件を絞る機能つければ
   * いいのでは？」）。渡されなければ今までどおり全部が母集団。
   *
   * 絞り込みの判定そのものは節の側（components/TodaySuggestPanel）が持ち、ここへはその結果の
   * レシピIDだけが来る＝**1品と献立で同じ判定を2回書かない**。
   *
   * 絞った結果が0品でも**絞る前には戻さない**。戻すと、条件に合う品が1つも無いときに
   * 条件を無視した献立が黙って出て、「絞ったのに効いていない」に見える（いちばん分かりづらい）。
   * 0品のときは組めないまま返し、節の側が「この条件で組める献立がありませんでした」と
   * 「条件をクリア」を出す＝1品側が0件のときと同じ見せ方になる。
   */
  const restrictToAllowed = (list: Recipe[], allowedRecipeIds?: number[]): Recipe[] => {
    if (!allowedRecipeIds) return list
    const allowed = new Set(allowedRecipeIds)
    return list.filter((r) => r.id != null && allowed.has(r.id))
  }

  /**
   * 「おまかせで献立を組む」がいまくじを引いている候補の数（2026-08-02 便DE-5・オーナー指示）。
   * 候補が2品しかない条件では、振り直しても同じ料理が出続けて壊れているように見えるため、
   * 数字を画面に出して理由が分かるようにする。数えるのは主菜の候補
   * （ペア提案は主菜を引いてから、その主菜に合わせて副菜を引くので、変わり映えの元は主菜側）。
   */
  const suggestCandidateCount = (allowedRecipeIds?: number[]) => {
    const slot: MealSlot = visibleSlots.includes('dinner') ? 'dinner' : visibleSlots[0] ?? 'dinner'
    return suggestCandidates(restrictToAllowed(visibleRecipes, allowedRecipeIds), {
      quickOnly,
      quickMinutes,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds: [],
      slot,
      genres: planGenresOption,
      yesterdayRecipeIds,
      role: 'main',
    }).length
  }

  /**
   * いま組んである献立の中身（2026-08-17 便HI）。並べるときに主菜/副菜の別を添えるので、
   * 役割の判定は献立エンジンと同じ mealRoleForRecipe（料理の種別→タグからの推定）を使う
   * ＝週タブに入るときの役割と、画面に出す役割が食い違わない。
   * 引いた直後にそのレシピを消したときは、その品だけが並びから落ちる（画面が壊れない）。
   */
  const suggestPairRecipes = useMemo(
    () =>
      suggestPairIds
        .map((id) => recipeById.get(id))
        .filter((r): r is Recipe => r !== undefined)
        .map((recipe) => ({ role: mealRoleForRecipe(recipe), recipe })),
    [suggestPairIds, recipeById],
  )

  /**
   * 「今日なに作る？」の候補カードからレシピ詳細へ移るときに、そのとき出ていたものを覚える
   * （2026-08-17 便HI＝1品／2026-08-19 便HT＝献立）。
   *
   * 開いた1品と、そのとき組んであった主菜・副菜を**同じ記録**に書く。どちらを出していたかで
   * 書き分けないのは、戻ったときにどちらを出すかは切り替え（dayStartSuggestMode）が決めるので、
   * 「離れる前に画面に出ていたもの」をそのまま残しておけば、どちらに戻っても見え方が変わらないため。
   *
   * 2026-08-21 便IP・①: 控えそのものは上の useEffect が出しっぱなしにしているので、ここは
   * **「献立」側のカードから開いたときに、1品側の覚えを開いた料理に差し替える**ためだけに残す
   * （主菜を見に行った人が「1品」へ切り替えたら、その主菜が出ている状態にそろえる）。
   */
  const rememberSuggestionForReturn = (recipeId: number) => {
    writeSessionItem(DAY_SUGGEST_PIN_KEY, serializeSuggestionPin(recipeId, suggestPairIds))
  }

  // 主菜+副菜のペアを1組計算する。提案元の枠は「表示中の食事帯に夕食があれば
  // 夕食、無ければ先頭の帯」を使う。excludeIdsに渡したレシピは候補から外す(押し直しで直前の
  // 組み合わせを避けるために使う)。候補が0件のときはundefinedを返す
  const computeSuggestionIds = (
    excludeIds: number[],
    /** 「今日なに作る？」の絞り込みを通したレシピID（2026-08-19 便HT） */
    allowedRecipeIds?: number[],
  ): number[] | undefined => {
    if (!recipes) return undefined
    const slot: MealSlot = visibleSlots.includes('dinner') ? 'dinner' : visibleSlots[0] ?? 'dinner'
    // 「おまかせで献立を組む」も目的モードの引き直しを通す（docs/62 決定②のオーナー指示）
    const { main, side } = drawPair(
      {
        quickOnly,
        quickMinutes,
        excludeNg: true,
        ngIngredients: settings?.ngIngredients ?? [],
        usedRecipeIds: excludeIds,
        slot,
        genres: planGenresOption,
        yesterdayRecipeIds,
      },
      restrictToAllowed(visibleRecipes, allowedRecipeIds),
    )
    const ids = [main?.id, side?.id].filter((x): x is number => x != null)
    return ids.length === 0 ? undefined : ids
  }

  /**
   * 「おまかせで献立を組む」（2026-08-17 便HI・オーナー実機「何回も連続で押下することで
   * 違う組み合わせの献立を表示できるようにして。最後に今日の献立に反映→朝夕夜選択できるといい」）。
   *
   * 変えたこと: 押した瞬間に今日の献立へ入れていたのをやめ、**組んだ結果を画面に出すだけ**にした。
   * いま出ている組を候補から外してから引き直す＝押すたびに違う組み合わせになる
   * （候補が尽きたら除外は自動で緩む＝logic/mealPlan.ts suggestForSlot。押しても無反応にはならない）。
   * 献立に入るのは「今日の献立に入れる」を押して食事を選んだときだけ。
   *
   * 2026-08-18 便HM: 「献立」に切り替えた直後にも1組出すため、押していない呼び出し（auto）が
   * 増えた。そのときは出ているお知らせを消さない＝**利用者が押していないのに、
   * 直前の操作の結果が黙って消える**のを作らない。
   */
  const drawSuggestPair = (options?: { auto?: boolean; allowedRecipeIds?: number[] }) => {
    if (!options?.auto) setMessage('')
    const ids = computeSuggestionIds(suggestPairIds, options?.allowedRecipeIds)
    if (!ids) {
      // 2026-08-19 便HT: 組めなかったときは、いま出ている組も下ろす。
      // 「組める献立がありませんでした」と言いながら前の組が画面に残っていると、
      // その組がいまの条件で出たものだと読めてしまう
      setSuggestPairIds([])
      // レシピが1件も無いときと、条件で候補が尽きたときで言い方を分ける（黙って終わらせない）
      setMessage(
        visibleRecipes.length === 0 ? ja.mealPlan.noSuggestion : ja.mealPlan.todaySuggestNoPair,
      )
      return
    }
    setSuggestPairIds(ids)
  }

  /**
   * 「今日なに作る？」で出ているものを今日の献立に入れる（2026-08-17 便HI → 2026-08-18 便HM）。
   * 食事（朝食/昼食/夕食）を選べば今週の予定の今日の枠にも入り、決めなければ今日の献立だけに入る
   * ＝レシピ詳細・レシピ一覧の「今日の献立に追加」とまったく同じ判断（db/mealPlan.ts
   * addRecipesToToday）を通す。入口ごとに結果が変わらないようにするため。
   *
   * 便HMで「1品」も同じここを通るようになった（オーナー
   * 「今日の献立にれるボタンを1品にも適用えきるし」）。違うのは、
   * 入れ終わったあとに組んである献立を空にするかどうかと、すでに入っていたときの言い方だけ
   * （1品は品数ではなく料理名で言う）。
   */
  const applyTodaySlotPick = async (slot?: MealSlot) => {
    const pick = todaySlotPick
    setTodaySlotPick(null)
    if (!pick || pick.ids.length === 0) return
    // 鍵の掛かった食事には入れない（2026-08-08 便EA。どの入口から来ても同じところで止まる）
    if (slot && blockedByLock(today, slot, 'add')) return
    const { added, already } = await addRecipesToToday(today, pick.ids, slot)
    if (pick.from === 'plan') setSuggestPairIds([])
    if (added === 0) {
      setMessage(
        pick.from === 'plan'
          ? ja.mealPlan.todaySuggestAllAlready.replace('{m}', String(already))
          : ja.mealPlan.todayAddOneAlready.replace('{title}', pick.title),
      )
      return
    }
    setMessage(
      (slot
        ? ja.mealPlan.todaySuggestDone
            .replace('{slot}', ja.mealPlan.slot[slot])
            .replace('{n}', String(added))
        : ja.mealPlan.todaySuggestDoneUndecided.replace('{n}', String(added))) +
        (already > 0 ? ja.mealPlan.todaySuggestAlreadySuffix.replace('{m}', String(already)) : ''),
    )
  }

  /**
   * 献立の×で外したものを1回で戻すための控え（2026-08-18 便HQ・軸1）。
   *
   * 「作った！」（undoCooked）・「レシピを選び直した」（undoPick）とまったく同じ作法で、
   * 出したトーストの文言まで一緒に持つ＝別の操作でトーストが差し替わったら、この取り消しも
   * 一緒に消える（古いトーストの「元に戻す」が残って、押すと関係ない行が戻る事故を防ぐ）。
   *
   * **戻す範囲は、その×が消したものと同じだけ**にしてある。
   * 日タブの「今週の献立の予定」の×は今週の予定の行と今日の献立の行の両方を消すので
   * 両方戻し、「レシピ一覧から選択中」の×は今日の献立の行しか消さないのでそれだけ戻す。
   * 週/月タブの×は献立の枠を1行消すので、その1行を同じ日・同じ食事・同じ役割へ戻す。
   * ここを「ついでに周りも揃える」ようにすると、押した人が見ていない場所まで動いてしまう。
   */
  const [undoRemove, setUndoRemove] = useState<{
    entries: MealPlanEntry[]
    todayItems: TodayListItem[]
    /** 「元に戻す」を添えたトーストの文言（これが今のトーストと違えば、控えはもう無効） */
    message: string
    /** 戻したあとに出す文言 */
    undoneMessage: string
  } | null>(null)
  const undoRemoveActive = undoRemove != null && undoRemove.message === message
  const runUndoRemove = async () => {
    if (!undoRemove) return
    await restoreMealEntries(undoRemove.entries)
    await restoreTodayListItems(undoRemove.todayItems)
    setUndoRemove(null)
    setMessage(undoRemove.undoneMessage)
  }

  /**
   * 「レシピ一覧から選択中」の行の×（2026-08-18 便HQ・軸1/軸4）。
   * 外すのは今日の献立の行だけ（今週の予定には最初から入っていない品なので触るものが無い）。
   * それまでは何も言わずに行が消えるだけだったので、外したことをトーストで伝え、
   * 同じトーストから1回で戻せるようにする。
   */
  const removeTodayPickedRecipe = async (recipe: Recipe) => {
    const removedTodayItems = (todayList ?? []).filter((item) => item.recipeId === recipe.id)
    await removeFromTodayList(recipe.id!)
    const toast = ja.mealPlan.todayRemovedToast.replace('{title}', recipe.title)
    setMessage(toast)
    setUndoRemove({
      entries: [],
      todayItems: removedTodayItems,
      message: toast,
      undoneMessage: ja.mealPlan.todayRemoveUndoneToast.replace('{title}', recipe.title),
    })
  }

  /**
   * 「今週の献立の予定」の行の×（2026-08-17 便HI・オーナー実機「『今日の献立』のメニューに
   * ×つけて、週と連動して削除できるようにして」）。
   *
   * 消すのは**今週の献立の予定そのもの**（その食事にあるその料理の行）と、今日の献立の分。
   * 予定だけを消すと、自分で入れた品（予定の写しの印が付いていない品）が今日の献立に残り、
   * その場で「レシピ一覧から選択中」の行として並び直す＝×を押したのに行が動くだけになる。
   * 作った記録には触らない（規約F: 何が消えて何が残るかを、押す前の説明とトーストで言う）。
   */
  const removeTodayPlannedRecipe = async (slot: MealSlot, recipe: Recipe) => {
    if (blockedByLock(today, slot, 'remove')) return
    const entryIds = plannedEntryIds.get(`${slot}|${recipe.id}`) ?? []
    // 消す前の姿をそのまま控える（2026-08-18 便HQ）。id・日付・食事・役割・食数まで持つので、
    // 「元に戻す」で同じ枠へそのまま戻る
    const removedEntries = (todayEntries ?? []).filter(
      (e) => e.id != null && entryIds.includes(e.id),
    )
    const removedTodayItems = (todayList ?? []).filter((item) => item.recipeId === recipe.id)
    for (const entryId of entryIds) {
      await removeMealEntry(entryId)
    }
    await removeFromTodayList(recipe.id!)
    const toast = ja.mealPlan.todayPlannedRemovedToast.replace('{title}', recipe.title)
    setMessage(toast)
    setUndoRemove({
      entries: removedEntries,
      todayItems: removedTodayItems,
      message: toast,
      undoneMessage: ja.mealPlan.todayPlannedRemoveUndoneToast.replace('{title}', recipe.title),
    })
  }

  /**
   * 日タブの行の「作った」（2026-08-03 便DH）。①レシピ一覧から選択中・②今週の献立の予定の
   * どちらの行からも同じ処理を呼ぶ。今日の日付で記録し、今日の献立に入っていれば外す
   * （②の品は「作った後は予定でなく記録」＝記録が付いた時点でこの行は消える）。
   * トーストの「元に戻す」で直前の1件を取り消せる（便DE-3）。
   */
  /**
   * 「元に戻す」の控えに残す1品ぶんの情報（2026-08-03 便DP-4）。
   * 記録を付けた時点で「今週の予定の写し」だったかを一緒に控える＝今日の予定に入っている品か、
   * 今日の献立に写しの印が付いている品。戻すときに同じ印を付け直すために使う。
   */
  const undoItemOf = (recipeId: number) => ({
    recipeId,
    fromPlan:
      todayPlanAllRecipeIds.includes(recipeId) ||
      (todayList?.some((item) => item.recipeId === recipeId && item.fromPlan) ?? false),
  })

  /**
   * 作りかけの段取りに組んでいる品を1品だけ記録するときの確認（2026-08-09 便EH・
   * オーナー実機報告の重大バグ）。押す前に「その品が段取りから外れること」「残り何品で
   * 組み直すか」を伝える（規約F）。記録を中止したときは false を返す。
   * 段取りの組み直しそのものは並行調理ナビの画面が受け持つ（下のコメント参照）。
   */
  const confirmCookedAgainstNavi = async (recipe: Recipe): Promise<boolean> => {
    const session = loadCookNaviSession()
    if (!session?.selectedIds.includes(recipe.id!)) return true
    // 2026-08-12 便FW（オーナー指摘「日・今日の献立から作った！したとき、並行調理ナビの
    // 段取り（候補）からも外れる旨の説明はいらない（調理ナビで段取りが作成されていない場合）」）:
    // 「段取りを作る」を押していない＝候補として選んであるだけの状態では、記録しても失われる
    // 段取りが無い。何も起きないことを知らせる小窓は出さない。
    // 選択のほうは並行調理ナビの画面が今日の献立と突き合わせて直す（resolveCookNaviSelection）
    if (!session.showTimeline) return true
    const remaining = reconcileSelectedIds(
      session.selectedIds,
      session.selectedIds.filter((id) => id !== recipe.id),
    )
    const ok = await confirm({
      title: ja.mealPlan.todayCookedNaviConfirmTitle.replaceAll('{title}', recipe.title),
      body: (remaining.length >= COOK_NAVI_MIN_RECIPES
        ? ja.mealPlan.todayCookedNaviConfirm
        : ja.mealPlan.todayCookedNaviConfirmEnd
      )
        .replaceAll('{title}', recipe.title)
        .replaceAll('{n}', String(remaining.length)),
      confirmLabel: ja.mealPlan.todayCookedNaviConfirmOk,
    })
    if (!ok) return false
    // 段取りが続くとき（2品以上残る）は、覚えている選択には手を触れない。
    // 組み直しと「何を外したか」の知らせは、並行調理ナビの画面が1か所で受け持つ
    // （どの入口から記録しても同じように直る形にしておく）。
    // 残りが2品未満で段取りが成り立たなくなるときだけ、押せない入口を残さないようここで畳む
    if (remaining.length < COOK_NAVI_MIN_RECIPES) clearCookNaviSession()
    return true
  }

  const markDayRecipeCooked = (recipe: Recipe) => {
    const recipeId = recipe.id!
    const undoItem = undoItemOf(recipeId)
    void (async () => {
      if (!(await confirmCookedAgainstNavi(recipe))) return
      await markTodayListCooked(recipeId, dayCookedServings.get(recipeId))
      // 2026-07-16 UI総点検A-4: 行が消えるだけの無言完了だったのでトーストで明示
      setMessage(ja.mealPlan.todayCookedToast)
      setUndoCooked({ items: [undoItem], message: ja.mealPlan.todayCookedToast })
      // 内容を足しに行ける場所を添える（2026-08-26 便LJ）
      setHistoryToast(ja.mealPlan.todayCookedToast)
    })()
  }

  /**
   * 日タブの「全て作った！」（2026-08-03 便DP-1・オーナー指示）。
   * 押す前に「何件を記録するか・何が消えて何が残るか」を確認し（規約F）、記録したあとは
   * 件数つきのトーストと「元に戻す」を出す（1品の「作った！」と同じ戻し方を複数件へ広げた）。
   * 在庫を1段階下げる設定がONのときは、確認文にもその旨を足す（黙って在庫を動かさない）。
   */
  const markAllDayRecipesCooked = async () => {
    const count = dayRecipeIds.length
    if (count === 0) return
    const ok = await confirm({
      title: ja.mealPlan.todayMarkAllCookedConfirmTitle.replace('{n}', String(count)),
      bullets: [
        {
          label: ja.mealPlan.todayMarkAllCookedGoneLabel,
          text: ja.mealPlan.todayMarkAllCookedGone.replace('{n}', String(count)),
        },
        {
          label: ja.mealPlan.todayMarkAllCookedKeptLabel,
          text: ja.mealPlan.todayMarkAllCookedKept.replace('{n}', String(count)),
        },
        // 記録すると今日の献立が空になり、並行調理ナビは段取りを出せなくなる。
        // 押す前に「段取りも終わる」ことを伝える（2026-08-08 便EG・規約F）
        ...(naviInProgress
          ? [
              {
                label: ja.mealPlan.todayMarkAllCookedConfirmNaviLabel,
                text: ja.mealPlan.todayMarkAllCookedConfirmNavi,
              },
            ]
          : []),
        ...(settings?.cookedReflectPantry
          ? [
              {
                label: ja.mealPlan.todayMarkAllCookedConfirmPantryLabel,
                text: ja.mealPlan.todayMarkAllCookedConfirmPantry,
              },
            ]
          : []),
      ],
      confirmLabel: ja.mealPlan.todayMarkAllCookedConfirmOk,
    })
    if (!ok) return
    const recorded = dayRecipeIds.map(undoItemOf)
    await markAllTodayListCooked(
      recorded.map((item) => item.recipeId),
      dayCookedServings,
    )
    // 予告どおり、作りかけの段取りもここで終える（再開ボタンだけが残る状態にしない）
    if (naviInProgress) clearCookNaviSession()
    const toast = ja.mealPlan.todayMarkAllCookedToast.replace('{n}', String(recorded.length))
    setMessage(toast)
    setUndoCooked({ items: recorded, message: toast })
    // 内容を足しに行ける場所を添える（2026-08-26 便LJ）
    setHistoryToast(toast)
  }

  /**
   * 「レシピ一覧から選択中」の行の食事ボタン: その料理を今日のその食事へ**足す**
   * （2026-07-29 便CB-1 → 2026-08-24 便KI）。
   *
   * 2026-08-24 便KI・オーナー原文:
   *   「レシピ一覧から選択中から『夕食に入れる』した場合、今週の献立にもとからあった夕食の主菜と
   *     入れ替えに消える。もしくは既存レシピと入れ替えになって、全て入らない。追加のみしてください。」
   * 主菜の料理を押したときだけ「その枠の主菜を差し替える」作りだったので、もとからあった
   * 主菜が消え、続けて押すと前に入れた分も消えて最後の1品しか残らなかった。
   * **足すだけに改めた**（判断は logic/mealPlan.ts の planRoleAssign。上限は設けない。
   * 同じ料理を2回入れたときだけ足さずに知らせる）。
   *
   * 入る行の役割は、主菜になる料理は主菜・それ以外は副菜（献立エンジンと同じ isMainDish。
   * dishType優先・未設定はタグから推定）。何が起きたか（どの役割に入ったか・すでに入っていたか）は
   * 必ずトーストで伝える。
   */
  const assignMismatchRecipe = async (slot: MealSlot, recipe: Recipe) => {
    // 日タブの「◯食に入れる」も、鍵の掛かった食事には入れない(2026-08-08 便EA)
    if (blockedByLock(today, slot, 'add')) return
    const role: MealRole = isMainDish(recipe) ? 'main' : 'side'
    // 入れる前のその食事の姿を控える（2026-08-22 便JF・⑥）。
    // 「元に戻す」は、この控えに無い行＝この操作で足った行だけを外す
    const before = (todayEntries ?? [])
      .filter((e) => e.slot === slot && e.id != null)
      .map((e) => ({ id: e.id!, recipeId: e.recipeId }))
    const result = await assignMealEntryByRole(today, slot, recipe.id!, role)
    const toast = (result === 'duplicate'
      ? ja.mealPlan.planMismatchAlready
      : ja.mealPlan.planMismatchAssigned
    )
      .replace('{slot}', ja.mealPlan.slot[slot])
      .replace('{role}', ja.mealPlan.role[role])
      .replace('{title}', recipe.title)
    setMessage(toast)
    // すでに入っていたとき（duplicate）は何も変えていないので、戻すものが無い
    if (result !== 'duplicate') {
      setUndoAssign({ slot, before, title: recipe.title, message: toast })
    }
  }

  /**
   * 「◯食に入れる」の取り消し（2026-08-22 便JF・⑥・オーナー原文
   * 「レシピ一覧から選択中のレシピを「朝食に入れる」などしたあとに戻るトーストがでない。」）。
   *
   * 「作った！」（undoCooked）・「レシピを選び直した」（undoPick）・「×で外した」（undoRemove）・
   * 「サイコロ」（undoSuggest）とまったく同じ作法で、出したトーストの文言まで一緒に持つ
   * ＝別の操作でトーストが差し替わったら、この取り消しも一緒に消える。
   *
   * 戻すのは**今週の献立の予定に入れた分だけ**。「レシピ一覧から選択中」の行（今日の献立）は
   * 触らない＝押す前とまったく同じ「選んであるが、まだどの食事にも入れていない」状態に戻る。
   *
   * 2026-08-24 便KI: 「◯食に入れる」は足すだけになったので、戻すのも「足した行を外す」だけ
   * （もとからあった行は押した時点で1件も動いていない）。
   */
  const [undoAssign, setUndoAssign] = useState<{
    slot: MealSlot
    before: { id: number; recipeId: number }[]
    title: string
    message: string
  } | null>(null)
  const undoAssignActive = undoAssign != null && undoAssign.message === message
  const runUndoAssign = async () => {
    if (!undoAssign) return
    const { slot, before } = undoAssign
    const beforeIds = new Set(before.map((e) => e.id))
    const current = (todayEntries ?? []).filter((e) => e.slot === slot && e.id != null)
    for (const entry of current) {
      // 押す前に無かった行＝この操作で足した行なので外す（もとからあった行には触らない）
      if (!beforeIds.has(entry.id!)) await removeMealEntry(entry.id!)
    }
    setUndoAssign(null)
    setMessage(
      ja.mealPlan.planMismatchAssignUndoneToast
        .replace('{slot}', ja.mealPlan.slot[slot])
        .replace('{title}', undoAssign.title),
    )
  }

  /**
   * 行の「×」: 既存の割り当てなら削除、追加しただけの未割り当て行ならUI上から取り消す。
   * 2026-08-02 便CW-2: 既定の空欄行（entryIdもextraLocalIdも無い行）は、その役割の枠ごと畳む。
   * 料理の入っている行を消したときは、その役割の「畳んだ記録」も消す
   * （空になった枠に「＋レシピを選ぶ」が戻らないと、次に入れる入口が分からなくなるため）。
   */
  const clearRow = async (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    if (blockedByLock(date, slot, 'remove')) return
    if (entryId != null) {
      // 消す前の行を控えてから消す（2026-08-18 便HQ・軸1/軸4）。
      // それまでは料理の入った行が何も言わずに消えていて、押し損ねたのか消えたのかも、
      // どこの枠を消したのかも分からなかった
      const removed = allPlanEntries.find((e) => e.id === entryId)
      const removedTitle = removed ? recipeById.get(removed.recipeId)?.title : undefined
      // 今日の枠を外すと、今日の献立に入っていたその品の行も片付く（removeStaleFromPlanTodayList）。
      // 戻すときに一緒に戻せるよう、今日の枠のときだけ今日の献立の行も控える
      const removedTodayItems =
        date === today && removed
          ? (todayList ?? []).filter((item) => item.recipeId === removed.recipeId)
          : []
      showDefaultRow(date, slot, role)
      await removeMealEntry(entryId)
      // 料理の入っていた行を外したときだけ知らせる（空欄行を畳む×は献立を1件も消さない）
      if (removed && removedTitle) {
        const fill = (text: string) =>
          fillSlotText(text, date, slot).replace('{title}', removedTitle)
        const toast = fill(ja.mealPlan.clearRemovedToast)
        setMessage(toast)
        setUndoRemove({
          entries: [removed],
          todayItems: removedTodayItems,
          message: toast,
          undoneMessage: fill(ja.mealPlan.clearUndoneToast),
        })
      }
    } else if (extraLocalId) {
      removeExtraRowState(date, slot, extraLocalId)
    } else {
      hideDefaultRow(date, slot, role)
    }
  }

  /**
   * 週・月の知らせに「いつの・どの食事の枠か」を差し込む（2026-08-18 便HQ ×／2026-08-19 便IA サイコロ）。
   * 週・月は複数の日が同時に見えていて、料理名だけではどの枠のことか読み取れないため、
   * この2つの知らせは必ず日付と食事から書き出す。
   */
  const fillSlotText = (text: string, date: string, slot: MealSlot) =>
    text
      .replace('{m}', String(Number(date.slice(5, 7))))
      .replace('{d}', String(Number(date.slice(8, 10))))
      .replace('{slot}', ja.mealPlan.slot[slot])

  /**
   * 行の「サイコロ」の取り消し（2026-08-19 便IA・オーナー実機「月や週の献立で、サイコロ押して
   * レシピを変更した後に、元に戻すトースト？出してほしい」）。
   *
   * 「作った！」（undoCooked）・「レシピを選び直した」（undoPick）・「×で外した」（undoRemove）と
   * **まったく同じ作法**で、出したトーストの文言まで一緒に持つ＝別の操作でトーストが差し替わったら
   * この取り消しも一緒に消える（古いトーストの「元に戻す」で関係ない行が動く事故を防ぐ）。
   *
   * サイコロがすることは2通りあるので、戻すことも2通り持つ:
   *  ・入れ替えた（もともと料理が入っていた枠） → **入れ替える前のレシピに戻す**
   *  ・入れた（空いていた枠を埋めた。主菜＋副菜が一度に入ることもある） → 入れた行を外し、
   *    空欄の行を出し直す（外したあとに「＋レシピを選ぶ」が戻らないと、次に入れる入口が消える）
   */
  const [undoSuggest, setUndoSuggest] = useState<{
    /** 入れ替えを戻す（その行を、入れ替える前のレシピへ書き戻す） */
    replace?: { entryId: number; recipeId: number }
    /** 入れたものを外す（増えた行のid） */
    addedEntryIds?: number[]
    /**
     * 消したものを戻す（2026-08-21 便IU・⑥）。「まとめて献立を入力」の総入れ替えは
     * **入れる前に今日以降の献立を消す**ので、入れた行を外すだけでは押す前の姿に戻らない。
     * 消す前の行をそのまま控えておいて、id ごと書き戻す（db/mealPlan.ts restoreMealEntries）
     */
    restoreEntries?: MealPlanEntry[]
    /** 外したあとに空欄の行を出し直す枠 */
    restoreRows?: { date: string; slot: MealSlot; role: MealRole }[]
    /** 「元に戻す」を添えたトーストの文言（これが今のトーストと違えば、控えはもう無効） */
    message: string
    /** 戻したあとに出す文言 */
    undoneMessage: string
  } | null>(null)
  const undoSuggestActive = undoSuggest != null && undoSuggest.message === message
  const runUndoSuggest = async () => {
    if (!undoSuggest) return
    if (undoSuggest.replace) {
      await updateMealEntryRecipe(undoSuggest.replace.entryId, undoSuggest.replace.recipeId)
      // 戻した時点で「1つ前」はもう無い（いま入っているものがそれ）ので控えを捨てる
      const entryId = undoSuggest.replace.entryId
      setPreviousRecipeByEntry((prev) => {
        const next = { ...prev }
        delete next[entryId]
        return next
      })
    }
    for (const entryId of undoSuggest.addedEntryIds ?? []) {
      await removeMealEntry(entryId)
    }
    // 消したものを先に戻さず、入れたものを外してから戻す＝同じ枠に一瞬2品並ばない
    await restoreMealEntries(undoSuggest.restoreEntries ?? [])
    for (const row of undoSuggest.restoreRows ?? []) {
      showDefaultRow(row.date, row.slot, row.role)
    }
    setUndoSuggest(null)
    setMessage(undoSuggest.undoneMessage)
  }

  /**
   * 行の「サイコロ」: その行だけに自動提案を適用する。ただし対象の枠(主菜・副菜とも)が
   * 丸ごと空のときだけは、主菜+副菜のペアで一度に埋める(Fable設計2026-07-13: 「献立を
   * 決めたい」という主目的に沿わせるため、片方だけでなく両方を1タップで提案する)。
   * 過去日(今日より前)の枠は対象外(2026-07-16 便W-⑤a・上書きも新規埋めもしない。
   * UI側(renderRow)でも過去日はサイコロのボタン自体を出さないが、二重の安全側としてここでも guard する
   *
   * 2026-07-29 便CB-1・docs/59 A-3: 月タブの日モーダルからも同じ行UIで呼べるようにした。
   * 「同じ料理を続けない」ための重複回避の母集団(usedRecipeIds)は、押した画面が見ている範囲に
   * 合わせる(週タブ=表示中の週・月タブ=表示中の月)。usedRecipeIdsは候補が尽きたら自動的に
   * 緩和される軟らかい条件(logic/mealPlan.ts suggestForSlot)なので、母集団が広くても
   * 「提案できません」にはならない
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
    if (blockedByLock(date, slot, 'suggest')) return
    setMessage('')
    const slotEntries = entriesByDateSlotAll.get(`${date}|${slot}`) ?? []
    const isSlotEmpty = slotEntries.length === 0
    const scopeEntries = viewMode === 'month' ? (monthEntries ?? []) : (entries ?? [])
    const usedRecipeIds = scopeEntries.filter((e) => e.id !== entryId).map((e) => e.recipeId)
    const baseOptions = {
      quickOnly,
      quickMinutes,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds,
      slot,
      genres: planGenresOption,
      yesterdayRecipeIds,
    }
    // 枠が丸ごと空のときのペア提案は主菜・副菜の行から押したときだけ（2026-08-02 便DE-4）。
    // 汁物・その他の行のサイコロで主菜＋副菜が生えると、押した行と結果が食い違う
    if (isSlotEmpty && entryId == null && (role === 'main' || role === 'side')) {
      const { main, side } = suggestPairForSlot(visibleRecipes, baseOptions)
      if (!main && !side) {
        setMessage(ja.mealPlan.noSuggestion)
        return
      }
      // 入れた行のidを控える（2026-08-19 便IA）。空いていた枠を埋めたときの「元に戻す」は
      // **入れた行を外す**ことなので、どの行が増えたのかを知っている必要がある
      const addedEntryIds: number[] = []
      const restoreRows: { date: string; slot: MealSlot; role: MealRole }[] = []
      if (main) {
        addedEntryIds.push(await addMealEntry(date, slot, main.id!, 'main'))
        restoreRows.push({ date, slot, role: 'main' })
      }
      if (side) {
        addedEntryIds.push(await addMealEntry(date, slot, side.id!, 'side'))
        restoreRows.push({ date, slot, role: 'side' })
      }
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
      const fill = (text: string) => fillSlotText(text, date, slot)
      const toast =
        main && side
          ? fill(ja.mealPlan.suggestAddedPairToast)
              .replace('{main}', main.title)
              .replace('{side}', side.title)
          : fill(ja.mealPlan.suggestAddedToast).replace('{title}', (main ?? side)!.title)
      const undoneMessage =
        main && side
          ? fill(ja.mealPlan.suggestAddPairUndoneToast)
              .replace('{main}', main.title)
              .replace('{side}', side.title)
          : fill(ja.mealPlan.suggestAddUndoneToast).replace('{title}', (main ?? side)!.title)
      setMessage(toast)
      setUndoSuggest({ addedEntryIds, restoreRows, message: toast, undoneMessage })
      return
    }
    // 副菜行のサイコロにも、ペア提案(suggestPairForSlot)・まとめて献立と同じ条件を効かせる
    // (2026-07-29 便CD/MP-05)。従来この非ペア経路だけが role しか渡しておらず、
    // 「副菜を純粋な副菜に寄せる(preferDishType)」も「主菜のジャンルに揃える(genre)」も
    // 効いていなかったため、8割が別ジャンル・2割が汁物になっていた。最も使われる動線が
    // 最も手当てされていなかった箇所。あわせて主菜との食材・食感の重複回避も渡す(MP-04)。
    // 一品ものの主菜でもここでは提案する(ユーザーが明示的に押した行を無反応にしない)
    // 汁物の行(2026-08-02 便DE-4)も副菜と同じ扱いにする＝主菜に合わせて選ぶ。
    // 違いは寄せる種別だけ(副菜=side・汁物=soup。どちらも0件なら自動で緩む)
    const followsMain = role === 'side' || role === 'soup'
    const slotMainRecipe = followsMain
      ? slotEntries
          .filter((e) => (e.role ?? 'main') === 'main')
          .map((e) => recipeById.get(e.recipeId))
          .find((r): r is Recipe => !!r)
      : undefined
    const picked = suggestForSlot(
      visibleRecipes,
      followsMain
        ? {
            ...baseOptions,
            role,
            preferDishType: role === 'soup' ? ('soup' as const) : ('side' as const),
            genre: slotMainRecipe ? recipeGenre(slotMainRecipe) : undefined,
            avoidKeys: slotMainRecipe ? dishAvoidKeys(slotMainRecipe) : undefined,
            excludeRecipeIds: slotMainRecipe?.id != null ? [slotMainRecipe.id] : undefined,
          }
        : { ...baseOptions, role },
    )
    if (!picked) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    const fill = (text: string) => fillSlotText(text, date, slot)
    if (entryId != null) {
      // 入れ替え（2026-08-19 便IA）。**入れ替える前のレシピ**を控えてから書き換える。
      // 控えは「レシピを選ぶ」画面の「前回選択」にも使う＝サイコロで入れ替えたあとに
      // 選び直そうとしたとき、さっきまで入っていた料理が一覧の上のほうに並ぶ
      // （選び直しで入れ替えたとき＝pickRecipe とまったく同じ扱い）
      const before = allPlanEntries.find((e) => e.id === entryId)?.recipeId
      const beforeTitle = before != null ? recipeById.get(before)?.title : undefined
      await updateMealEntryRecipe(entryId, picked.id!)
      if (before != null && before !== picked.id && beforeTitle) {
        setPreviousRecipeByEntry((prev) => ({ ...prev, [entryId]: before }))
        const toast = fill(ja.mealPlan.suggestReplacedToast)
          .replace('{before}', beforeTitle)
          .replace('{after}', picked.title)
        setMessage(toast)
        setUndoSuggest({
          replace: { entryId, recipeId: before },
          message: toast,
          undoneMessage: fill(ja.mealPlan.suggestReplaceUndoneToast).replace(
            '{title}',
            beforeTitle,
          ),
        })
      }
    } else {
      const addedEntryId = await addMealEntry(date, slot, picked.id!, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
      const toast = fill(ja.mealPlan.suggestAddedToast).replace('{title}', picked.title)
      setMessage(toast)
      setUndoSuggest({
        addedEntryIds: [addedEntryId],
        restoreRows: [{ date, slot, role }],
        message: toast,
        undoneMessage: fill(ja.mealPlan.suggestAddUndoneToast).replace('{title}', picked.title),
      })
    }
  }

  /**
   * 確認文・結果に差し込む「ロック中の◯食分は変わりません。」（2026-08-08 便DX・規約F）。
   * 0件のときは空文字＝文が増えない（鍵を1つも使っていない人の文面は今までと同じ）。
   */
  const lockNoticeOf = (count: number) =>
    count > 0 ? ja.mealPlan.lockedSlotNotice.replace('{n}', String(count)) : ''
  /**
   * トーストへ一文を足す（空文字なら足さない）。
   * 2026-08-24 便KI・オーナー原文「トーストの文が長い上に改行もないので読む前に消える」:
   * つなぎ目を半角スペースから**改行**に変えた（トースト側は Toast.tsx が改行をそのまま出す）。
   * 1行に詰めると2文が地続きに見えて、どこまでが1つの知らせなのか読み取れなかった。
   */
  const withNotice = (text: string, notice: string) => (notice ? `${text}\n${notice}` : text)

  /**
   * 「まとめて献立を立てる」の実行本体（2026-07-29 便CB-2・docs/59 A-5で週タブ専用から切り出した）。
   * 計画(planWeekFill)と対象期間の献立を受け取り、自動提案由来の行を消してから提案で埋め直し、
   * **実際にDBへ追加できた品数**を返す。週タブ(fillWeek)と月タブの一括提案(fillMonth)は
   * この1本を共有する＝提案の質(日単位のジャンル統一・たんぱく源の分散・一品ものの扱い)が
   * 週と月で食い違わないようにするため。
   *
   * 2026-07-22 便BE(外部レビューで見つかった欠陥の修正): 以前は表示中の全枠(手動で選んだ枠も含む)を
   * 一旦クリアしてから再提案していたため、手動で入れた献立が無警告で上書きされて消えていた。
   * これをやめ、planWeekFill(logic/mealPlan.ts)で枠を仕分けする:
   *   - 手動配置(auto以外)がある枠 → 丸ごと残す(上書きしない)
   *   - 空き枠・自動提案由来だけの枠 → 自動行を消してから主菜+副菜のペアで埋め直す
   * これにより「手動配置の保護」と「押すたびの再抽選(2026-07-14仕様。自動枠に限って維持)」を両立する。
   * 埋める枠にはauto=trueを付け、次回もこの枠だけが再抽選対象になるようにする。
   * 過去日・非表示帯の枠は対象外で、重複回避の除外対象としてのみ使う(planWeekFill内で処理)。
   */
  const executeFill = async (
    plan: FillWeekPlan,
    rangeEntries: MealPlanEntry[],
  ): Promise<{ added: number; addedEntryIds: number[] }> => {
    // 埋め直す役割に残っている自動提案由来の行だけを削除(手動配置は plan で除外済み＝残る)
    for (const id of plan.entryIdsToRemove) {
      await removeMealEntry(id)
    }
    const usedRecipeIds = [...plan.usedRecipeIds]

    // たんぱく源の分散(docs/56 §3-6): 対象期間でまだ少ない主菜のソース(肉/魚/卵/豆腐)を軽く優先し、
    // 肉→肉→肉と連続で偏るのを防ぐ。残る手動主菜も集計に入れる。'その他'は分散対象にしない
    const proteinCounts: Record<ProteinSource, number> = { 肉: 0, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }
    const bumpProtein = (r: Recipe) => {
      proteinCounts[proteinSourceOf(r)] += 1
    }
    for (const e of rangeEntries) {
      if ((e.role ?? 'main') !== 'main') continue
      if (e.id != null && plan.entryIdsToRemove.includes(e.id)) continue // これから消える主菜は数えない
      const r = recipeById.get(e.recipeId)
      if (r) bumpProtein(r)
    }
    // 「今週まだ少ないたんぱく源」の算出は logic/mealPlan.ts の純関数に切り出した
    // (2026-07-29 便CD/MP-03。テストで守れるようにするため。'その他'の主菜が構造的に
    // 出なくなっていた欠陥と、主菜プールが強制ローテーションになる副作用の修正も同関数側)
    const preferProteinSources = (): ProteinSource[] => preferredProteinSources(proteinCounts)

    const baseOpts = {
      quickOnly,
      quickMinutes,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      genres: planGenresOption,
      yesterdayRecipeIds,
    }

    // 実際にDBへ追加した品数(2026-07-29 便CD/MP-06)。結果メッセージはこの実数で出す。
    // plan.slotsToFill.length で判定してはいけない(一品ものスキップ・候補0件で0品追加になる)
    let added = 0
    // 入れた行のid(2026-08-21 便IU・⑥)。「元に戻す」は**この行だけ**を外す
    // ＝すでに決まっていた献立・鍵の掛かった食事には触らない
    const addedEntryIds: number[] = []

    // 両役割が空 or 自動だけの枠: 主菜+副菜のペアで埋める(一品ものの主菜なら副菜は付かない=空く)。
    // 目的が指定されていれば drawPair が引き直す(2026-08-02 便CP-2)。入れた枠には目的を記録し、
    // 月タブの答え合わせ(「目的から組んだ日」の事実表示)から辿れるようにする
    for (const { date, slot } of plan.slotsToFill) {
      const { main, side } = drawPair({
        ...baseOpts,
        slot,
        usedRecipeIds,
        preferProteinSources: preferProteinSources(),
      })
      if (main) {
        addedEntryIds.push(await addMealEntry(date, slot, main.id!, 'main', true, planPurpose))
        usedRecipeIds.push(main.id!)
        bumpProtein(main)
        added++
      }
      if (side) {
        addedEntryIds.push(await addMealEntry(date, slot, side.id!, 'side', true, planPurpose))
        usedRecipeIds.push(side.id!)
        added++
      }
    }

    // 片方の役割だけ空の枠(便BH-2・役割粒度の保護): 手動で入っている役割は触らず、空いた役割だけ埋める。
    // 手動主菜だけの枠には主菜のジャンルに揃えた副菜を足す(主菜が一品ものなら副菜は足さない)。
    for (const { date, slot, fillRole } of plan.partialFills) {
      if (fillRole === 'side') {
        // その枠に残る主菜（この後も消えないもの）。手動配置だけでなく、keepAuto=trueで
        // 保護される自動配置の主菜も見る（2026-07-30 便CH/C1。月の一括提案を2回目に押したとき、
        // カレー等の一品ものの主菜が自動配置だと「主菜なし」と見なされ、副菜が足されていた）
        const existingMain = rangeEntries.find(
          (e) =>
            e.date === date &&
            e.slot === slot &&
            (e.role ?? 'main') === 'main' &&
            !(e.id != null && plan.entryIdsToRemove.includes(e.id)),
        )
        const mainRecipe = existingMain ? recipeById.get(existingMain.recipeId) : undefined
        if (mainRecipe && isOneDish(mainRecipe)) continue // 一品ものの主菜には副菜を足さない
        const side = suggestForSlot(visibleRecipes, {
          ...baseOpts,
          slot,
          role: 'side',
          preferDishType: 'side',
          usedRecipeIds,
          genre: mainRecipe ? recipeGenre(mainRecipe) : undefined,
          // 手動で入れた主菜とも食材・食感を重ねない(2026-07-29 便CD/MP-04)
          avoidKeys: mainRecipe ? dishAvoidKeys(mainRecipe) : undefined,
          excludeRecipeIds: mainRecipe?.id != null ? [mainRecipe.id] : undefined,
        })
        if (side) {
          addedEntryIds.push(await addMealEntry(date, slot, side.id!, 'side', true))
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
          addedEntryIds.push(await addMealEntry(date, slot, main.id!, 'main', true))
          usedRecipeIds.push(main.id!)
          bumpProtein(main)
          added++
        }
      }
    }

    return { added, addedEntryIds }
  }

  /**
   * 週の表示中の食事帯を、自動提案でまとめて埋める（結果メッセージ・今日の枠へのスクロールまで）。
   * 埋め方そのものは executeFill が担う（便CB-2で月タブの一括提案と共通化した）。
   */
  const fillWeek = async () => {
    // 2026-08-21 便IO: 別の週から入れる道は専用の画面へ移した（pages/MealPlanCopyWeekPage.tsx）。
    // このボタンが実行するのは、おまかせの提案だけになった
    if (!recipes) return
    setMessage('')
    // レシピが1件も無いときは無反応にしない(2026-07-29 便CD/MP-20)。
    // 「おまかせで献立を組む」も行のサイコロも同じ案内を出すのに、ここだけ何も起きなかった
    if (visibleRecipes.length === 0) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    // 2026-08-07 便DT-8(オーナー指示): 入れかたのスイッチで対象を切り替える。
    //  fillEmpty  … keepAuto=true＝すでに入っている献立は自動・手動を問わず1品も消さない
    //  replaceAll … これからの献立を消してから入れ直す。消す前に必ず確認を出す(規約F)
    const replaceAll = fillMode === 'replaceAll'
    // 2026-08-08 便DX(オーナー指示): 鍵の掛かった食事は、総入れ替えでも触らない
    const plan = planWeekFill(entries ?? [], dates, visibleSlots, today, {
      keepAuto: !replaceAll,
      replaceAll,
      lockedKeys,
    })
    const lockNotice = lockNoticeOf(plan.lockedSlotCount)
    if (replaceAll) {
      const removeCount = plan.entryIdsToRemove.length
      const targetSlotCount = plan.slotsToFill.length + plan.partialFills.length
      if (removeCount === 0 && targetSlotCount === 0) {
        setMessage(withNotice(ja.mealPlan.fillModeReplaceAllNothing, lockNotice))
        return
      }
      if (removeCount > 0) {
        const ok = await confirm({
          title: ja.mealPlan.fillModeReplaceAllConfirmTitle,
          bullets: [
            {
              label: ja.mealPlan.fillModeReplaceAllGoneLabel,
              text: ja.mealPlan.fillModeReplaceAllGone
                .replace('{s}', String(targetSlotCount))
                .replace('{n}', String(removeCount)),
            },
            {
              label: ja.mealPlan.fillModeReplaceAllKeptLabel,
              text: ja.mealPlan.fillModeReplaceAllKept,
            },
          ],
          /* 2026-08-27 便LT: 入れ替え先に過ぎた日が混ざっているときだけ「今日以降が対象」を
             1行で添える（見出しの途中に埋めない）。表示している週が全部これからの日付なら、
             実装（isPastDate）は1日も外していないので、書くと余計な条件になる */
          notes: [
            ...(isPastDate(dates[0], today) ? [ja.mealPlan.replaceAllPastNote] : []),
            ...(lockNotice ? [lockNotice] : []),
          ],
          confirmLabel: ja.mealPlan.fillModeReplaceAllConfirmOk,
        })
        if (!ok) return
      }
    }
    // 総入れ替えで消える行を、消す前にそのまま控える（2026-08-21 便IU・⑥）。
    // id・日付・食事・役割・食数まで持つので、「元に戻す」で同じ枠へそのまま戻る
    const removedEntries = (entries ?? []).filter(
      (e) => e.id != null && plan.entryIdsToRemove.includes(e.id),
    )
    const { added, addedEntryIds } = await executeFill(plan, entries ?? [])

    // 結果メッセージ(2026-07-29 便CD/MP-06で正直な出し分けに修正)。
    // 従来は「残す枠が1つでもあれば」だけを見て「空いていた枠に献立を立てました」と言っていたため、
    // 1品も追加していない(行のサイコロで全部埋めた後など)ときにも「立てました」と嘘を言っていた。
    // 実際に追加した品数(added)で分岐し、0品なら0品と伝える
    const messages: string[] = []
    // 「すでに入っている◯品」は**品**で数える（2026-08-25 便KT・オーナー原文
    // 「すでに決まっているのは昼と夕28食（1品なしで）になるはずですよね？」）。
    // 枠の数（preservedSlotKeys.size）を出すと、同じ文の「◯品を新しく入れました」と
    // 単位が違う数が並ぶ＝どちらも14になった実機で「間違った数字」に見えた
    const preserved = preservedItemCount(plan, entries ?? [])
    if (added > 0) {
      if (replaceAll) {
        // 総入れ替えは消す操作なので、終わったことと入った品数を必ず言う(便DT-8)
        messages.push(ja.mealPlan.fillModeReplaceAllDone.replace('{a}', String(added)))
      } else if (preserved > 0) {
        messages.push(
          ja.mealPlan.fillWeekKeptManual
            .replace('{n}', String(preserved))
            .replace('{a}', String(added)),
        )
      } else {
        // まっさらな週に入れたとき（2026-08-21 便IU・⑥）。ここだけ文が1つも出ず、
        // 押しても黙って終わっていた＝「元に戻す」を添える先も無かった
        messages.push(ja.mealPlan.fillWeekDone.replace('{a}', String(added)))
      }
    } else if (preserved > 0) {
      messages.push(ja.mealPlan.fillWeekNoRoom.replace('{n}', String(preserved)))
    } else {
      messages.push(ja.mealPlan.fillWeekNoAdded)
    }
    // 鍵で外した食事があるなら、結果でも必ず言う（黙って飛ばさない。便DX）
    if (lockNotice) messages.push(lockNotice)
    /*
     * 2026-08-24 便KI・オーナー原文:
     *   「総入れ替え→まとめて献立入力した後のトーストの文が長い上に改行もないので読む前に消える。
     *     日の献立は変わらないとでているが、更新されているので不要な文。」
     *
     * ここには「『日』の画面の『今日の献立』は自動では変わらない」（fillWeekTodayNotice）と
     * 「日の画面を開くと取り込みます」（fillWeekTodayWillImport）の2文があったが、両方外した。
     * 実装を読んで確かめたこと: 日タブの「今週の献立の予定」は今日の予定（todayEntries）から
     * その場で組み立てているので、**総入れ替えをした時点で自動的に変わる**（実測でも
     * 押す前と押した後で中身が変わった）。つまり前者は事実の逆で、後者は
     * 「今日の献立」の表への写しという内部の話＝画面の見え方はどちらでも同じ。
     * 残ったのは「入れ替えて◯品を入れました」の1文で、6秒のトーストで読み切れる長さになった。
     */
    const toast = messages.join('\n')
    if (messages.length > 0) setMessage(toast)

    /**
     * 「元に戻す」を添える（2026-08-21 便IU・⑥。オーナー原文
     * 「・「まとめて献立を入力」押したら、元に戻すトースト？も出して」）。
     * ✕・行のサイコロ・削除と**まったく同じ作法**で、出したトーストの文言まで一緒に持つ
     * ＝別の操作でトーストが差し替わったら、この取り消しも一緒に消える。
     *
     * 戻す範囲は**押す直前の姿にまるごと**＝入れた行を外し、総入れ替えで消した行を書き戻す。
     * 何も動いていないとき（0品しか入らず、消してもいない）は添えない＝戻すものが無い。
     */
    if (toast && (addedEntryIds.length > 0 || removedEntries.length > 0)) {
      setUndoSuggest({
        addedEntryIds,
        restoreEntries: removedEntries,
        message: toast,
        undoneMessage:
          removedEntries.length > 0
            ? ja.mealPlan.fillModeReplaceAllUndoneToast
                .replace('{a}', String(added))
                .replace('{n}', String(removedEntries.length))
            : ja.mealPlan.fillWeekUndoneToast.replace('{a}', String(added)),
      })
    }

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
   * A-5 月の空日を一括提案（2026-07-29 便CB-2・docs/59）。
   * 週の「まとめて献立を立てる」と同じ計画・同じ埋め方（planWeekFill＋executeFill）を、
   * 対象範囲だけ表示中の月まるごとに広げたもの。提案の質（日単位のジャンル統一・たんぱく源の分散・
   * 一品ものの日は副菜を空ける）は週と同じロジックを共有するので食い違わない。
   *
   * 週と違うのは3点:
   *  ①一度に数十枠を触るので、実行前に必ず確認を出す（規約F: 何日分・何食分を埋めるか＝入るもの、
   *    すでに決まっている献立と作った記録は消えない＝残るもの、を件数つきで書く）
   *  ②結果は必ず出す。しかも「立てるつもりだった数」ではなく**実際に入れられた品数**で報告する
   *    （便CD/MP-06の正直な完了報告と同じ作法。一品ものスキップ・候補切れで数は必ず減りうる）
   *  ③keepAuto=true（2026-07-30 便CH/C1）。このボタンは「まだ決まっていない日に入れる」としか
   *    約束していないので、自動提案で入った献立も消さない＝完全に非破壊にする。2回目に押すと
   *    埋まっている月は「新しく立てられる日がありませんでした」で終わり、確認文の
   *    「今ある献立と作った記録は消えません」がそのまま真になる。振り直したい人は週タブの
   *    「まとめて献立を立てる」（再抽選・2026-07-14確定仕様）を使う。
   */
  const fillMonth = async () => {
    if (!recipes) return
    setMessage('')
    if (visibleRecipes.length === 0) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    // 2026-08-26 便LH（オーナー原文「献立提案も絞った期間内に対応して。」）:
    // 期間で絞っているあいだは、入る先も選んだ期間の中だけになる（monthTargetDates）
    const rawPlan = planWeekFill(monthTargetEntries, monthTargetDates, visibleSlots, today, {
      keepAuto: true,
      // 鍵の掛かった食事は触らない（2026-08-08 便DX）
      lockedKeys,
      // メモを書いた日（外食・実家に帰る 等）は埋めない（2026-07-30 便CH/C10）。
      // 日付メモは「この日は献立が要らない」を表せる唯一の手段なのに一括提案が無視しており、
      // 外食の日の分まで月の食費・栄養に乗っていた
      skipDates: [...monthTargetNotes.keys()],
    })
    // 一品もの（カレー・丼・麺）の主菜が残る枠は副菜を足さない＝はじめから対象に数えない
    // （2026-07-30 便CH/C1。executeFill側は元から足さないので、確認文だけが「◯食分に入れます」と
    //  多めの数を言っていた。keepAutoで自動配置の主菜も残るようになり、2回目のタップで
    //  この食い違いが必ず表に出るため、数える段階でそろえる＝規約Fの件数を実態に合わせる）
    const plan = {
      ...rawPlan,
      partialFills: rawPlan.partialFills.filter((p) => {
        if (p.fillRole !== 'side') return true
        const keptMain = monthTargetEntries.find(
          (e) =>
            e.date === p.date &&
            e.slot === p.slot &&
            (e.role ?? 'main') === 'main' &&
            !(e.id != null && rawPlan.entryIdsToRemove.includes(e.id)),
        )
        const mainRecipe = keptMain ? recipeById.get(keptMain.recipeId) : undefined
        return !(mainRecipe && isOneDish(mainRecipe))
      }),
    }
    // 週タブと同じ数え方にそろえる（品で数える。2026-08-25 便KT）。
    // 片方だけ直すと、週と月で数え方が違うという新しい混乱になる
    const preserved = preservedItemCount(plan, monthTargetEntries)
    const targetSlots = [...plan.slotsToFill, ...plan.partialFills]
    // メモの日を外したことは、入れる前にも入れた後にも必ず言う（黙って飛ばさない）
    const noteSkipped =
      plan.skippedDates.length > 0
        ? ja.mealPlan.fillMonthNoteSkipped.replace('{n}', String(plan.skippedDates.length))
        : ''
    // 鍵で外した食事の一文（便DX）。確認文にも結果にも同じ文を出す
    const lockNotice = lockNoticeOf(plan.lockedSlotCount)
    // トーストは既存の作法どおり半角スペースでつなぐ（確認文は文中に差し込むので noteSkipped をそのまま使う）
    const withNoteSkipped = (text: string) =>
      withNotice(noteSkipped ? `${text} ${noteSkipped}` : text, lockNotice)
    if (targetSlots.length === 0) {
      setMessage(
        withNoteSkipped(
          preserved > 0
            ? ja.mealPlan.fillMonthNoRoom.replace('{n}', String(preserved))
            : ja.mealPlan.fillMonthNoAdded,
        ),
      )
      return
    }
    const targetDayCount = new Set(targetSlots.map((s) => s.date)).size
    const ok = await confirm({
      // 入る先の数は「日分」だけを言う（2026-08-25 便KT）。空いた食事は**まだ0品**なので
      // 品では数えられず、そこに「◯食分」と書くと結果の「◯品」と単位が食い違う
      title: (monthRangeActive
        ? ja.mealPlan.fillMonthRangeConfirmTitle
        : ja.mealPlan.fillMonthConfirmTitle
      ).replace('{d}', String(targetDayCount)),
      body: (preserved > 0
        ? ja.mealPlan.fillMonthConfirm
        : ja.mealPlan.fillMonthConfirmNoKept
      ).replace('{k}', String(preserved)),
      // メモを書いた日・ロック中の食事は「対象から外した」お知らせなので、補足の行に置く
      notes: [noteSkipped, lockNotice].filter((line) => line !== ''),
      confirmLabel: ja.mealPlan.fillMonthConfirmOk,
    })
    if (!ok) return
    const { added } = await executeFill(plan, monthTargetEntries)
    // 正直な完了報告: 実際にDBへ入った品数で出し分ける
    if (added > 0) {
      setMessage(
        withNoteSkipped(
          preserved > 0
            ? ja.mealPlan.fillMonthKeptManual
                .replace('{n}', String(preserved))
                .replace('{a}', String(added))
            : ja.mealPlan.fillMonthDone.replace('{a}', String(added)),
        ),
      )
    } else {
      setMessage(
        withNoteSkipped(
          preserved > 0
            ? ja.mealPlan.fillMonthNoRoom.replace('{n}', String(preserved))
            : ja.mealPlan.fillMonthNoAdded,
        ),
      )
    }
  }

  /**
   * A-1 マイ献立テンプレ ＋ B-2 曜日固定の定番（2026-07-29 便CB-2・docs/59。統合設計）。
   *
   * 週タブで「この週をテンプレとして保存」すると、表示中の週の献立を**曜日ごと**に覚える
   * （db/types.ts MealTemplateItem）。流し込むときに曜日を絞れるので、
   *  ・全曜日を選ぶ → お気に入りの1週間をそのまま別の週／月へ（A-1）
   *  ・金曜だけを選ぶ → 期間内の毎週金曜に同じ献立が入る（B-2「毎週◯曜はカレー」）
   * が同じ機構で成立する（B-2のために専用の繰り返し設計を足さない）。
   *
   * 入るのは「まだ決まっていないところ（空いている食事）」だけで、今ある献立は手動配置・
   * 自動提案由来のどちらも上書きしない＝非破壊（S-3 先週コピーと同じ作法）。入れた枠は
   * auto を付けない＝手動配置扱いなので、次の「まとめて献立を立てる」でも再抽選されない。
   * 判断は純ロジック（logic/mealTemplate.ts の planTemplateFill）に置き、テストで固定する。
   */
  const mealTemplates = useMealTemplates()
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false)
  const [templateName, setTemplateName] = useState('')
  // 「テンプレを流し込む」窓を、どの範囲へ入れるために開いたか（週タブ＝表示中の週／月タブ＝表示中の月）
  const [templateApplyScope, setTemplateApplyScope] = useState<'week' | 'month' | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  // B-2: 流し込む曜日（0=月 … 6=日）。既定は全曜日＝1週間まるごと
  const [templateDows, setTemplateDows] = useState<number[]>(ALL_DOWS)

  // 保存対象＝表示中の週の献立（曜日×食事×役割へ変換したもの）
  const weekTemplateItems = useMemo(() => buildTemplateItems(entries ?? [], dates), [entries, dates])
  const openTemplateSave = () => {
    if (weekTemplateItems.length === 0) {
      setMessage(ja.mealPlan.templateSaveEmpty)
      return
    }
    setTemplateName('')
    setTemplateSaveOpen(true)
  }
  const submitTemplateSave = async () => {
    const name = templateName.trim()
    if (name === '') {
      setMessage(ja.mealPlan.templateNameRequired)
      return
    }
    await saveMealTemplate(name, weekTemplateItems)
    setTemplateSaveOpen(false)
    setMessage(
      ja.mealPlan.templateSaveDone
        .replace('{name}', name)
        .replace('{n}', String(weekTemplateItems.length)),
    )
  }

  const openTemplateApply = (scope: 'week' | 'month') => {
    setSelectedTemplateId(null)
    setTemplateDows(ALL_DOWS)
    setTemplateApplyScope(scope)
  }
  // 選択中のテンプレ（未選択なら先頭＝保存が一番古いものを既定にする。窓を開いてすぐ流し込める）
  const selectedTemplate = useMemo(() => {
    const list = mealTemplates ?? []
    if (list.length === 0) return undefined
    return list.find((t) => t.id === selectedTemplateId) ?? list[0]
  }, [mealTemplates, selectedTemplateId])
  const toggleTemplateDow = (dow: number) => {
    setTemplateDows((prev) =>
      prev.includes(dow) ? prev.filter((d) => d !== dow) : [...prev, dow].sort((a, b) => a - b),
    )
  }
  const applyTemplate = async () => {
    const template = selectedTemplate
    if (!template || templateApplyScope == null) return
    if (templateDows.length === 0) {
      setMessage(ja.mealPlan.templateDowNone)
      return
    }
    // 2026-08-26 便LH: 月タブで期間を絞っているあいだは、入る先も選んだ期間の中だけになる
    const targetDates = templateApplyScope === 'month' ? monthTargetDates : dates
    const targetEntries = templateApplyScope === 'month' ? monthTargetEntries : (entries ?? [])
    const plan = planTemplateFill({
      items: template.items,
      dates: targetDates,
      entries: targetEntries,
      today,
      allowedDows: templateDows,
      visibleSlots,
      // 鍵の掛かった食事には入れない（2026-08-08 便DX）
      lockedKeys,
    })
    const lockNotice = lockNoticeOf(plan.lockedSlotCount)
    if (plan.ops.length === 0) {
      // 入らなかった理由を3つに言い分ける(2026-07-30 便CH/C14で「表示していない食事」を追加)。
      // 従来は表示していない食事のテンプレを流し込むと「選んだ曜日には、このテンプレの献立が
      // ありません」と出ていたが、同じ窓の曜日チップには「木 1品」と出ており矛盾していた
      setMessage(
        withNotice(
          plan.keptSlotCount > 0
            ? ja.mealPlan.templateApplyNoRoom.replace('{n}', String(plan.keptItemCount))
            : plan.hiddenSlots.length > 0
              ? ja.mealPlan.templateApplyHiddenSlots.replaceAll(
                  '{slots}',
                  plan.hiddenSlots.map((s) => ja.mealPlan.slot[s]).join('・'),
                )
              : ja.mealPlan.templateApplyNoItems,
          lockNotice,
        ),
      )
      return
    }
    // 規約F: 何品がどこに入るかと、何が消えないかを件数つきで両方書く
    const ok = await confirm({
      title: ja.mealPlan.templateApplyConfirmTitle
        .replace('{name}', template.name)
        .replace('{n}', String(plan.ops.length)),
      /* 本文は「今ある献立には触らない」の1つだけ（2026-08-26 便LH・オーナー原文
         「『すでに決まっている◯品と、その他の献立は消えません。』→
           『すでに入っている献立は消えません。』ではないの？どういう意味なのかわからない。」）。
         残る品数（旧 {k}）と、残る枠があるかないかでの言い分けは落とした＝
         入る先は「まだ決まっていない食事」だけなので、今ある献立はどのみち全部残る */
      body: ja.mealPlan.templateApplyConfirm,
      notes: lockNotice ? [lockNotice] : [],
      confirmLabel: ja.mealPlan.templateApplyConfirmOk,
    })
    if (!ok) return
    // auto=false(既定)で追加＝手動配置として保護される（ユーザーが意図して入れた献立のため）
    for (const op of plan.ops) {
      await addMealEntry(op.date, op.slot, op.recipeId, op.role)
    }
    setTemplateApplyScope(null)
    setMessage(
      withNotice(
        ja.mealPlan.templateApplyDone
          .replace('{name}', template.name)
          .replace('{n}', String(plan.ops.length)),
        lockNotice,
      ),
    )
  }
  const removeTemplate = async (id: number, name: string, itemCount: number) => {
    const ok = await confirm({
      title: ja.mealPlan.templateDeleteConfirmTitle
        .replace('{name}', name)
        .replace('{n}', String(itemCount)),
      body: ja.mealPlan.templateDeleteConfirm,
      confirmLabel: ja.mealPlan.templateDeleteConfirmOk,
    })
    if (!ok) return
    await deleteMealTemplate(id)
    if (selectedTemplateId === id) setSelectedTemplateId(null)
    setMessage(ja.mealPlan.templateDeleteDone.replace('{name}', name))
  }

  /**
   * A-4 献立表の印刷／画像化（2026-07-29 便CB-2・docs/59）。
   * 献立を1枚に整形し、①ブラウザ印刷（index.css の @media print が .plan-sheet だけを
   * 紙に出す）②画像保存（既存のレシピ画像カードと同じCanvas機構を流用）の2通りで外に出せるようにする。
   * 冷蔵庫に貼る・家族に見せる用途で、アカウントも同期も要らない共有手段になる（docs/59 C-2の代替）。
   *
   * 2026-08-26 便LH（オーナー原文「献立表は、月と週にあるが、片方におきたい（月がいいかも）。
   * 月なら期間で絞るがそのまま使える。」）: **月タブの1か所だけ**にした。
   * 週タブの7日間を1枚にしたいときは「期間で絞る」で7日を選ぶ＝同じ紙が出る
   * （見出しも「{start}〜{end}の献立」で、週タブが使っていた言い方をそのまま引き継いだ）。
   * 載せる中身は「登録した献立」＋日付メモだけ（過ぎた日も同じ形。logic/planSheet.ts）。
   */
  const [planSheetOpen, setPlanSheetOpen] = useState(false)
  /**
   * 献立も記録もメモも無い日を載せるか（2026-08-02 オーナー指示）。既定は載せない。
   * 夕食だけを登録している月では日付だけの行が20行以上並び、書いてある日を探しにくかったため。
   * 「1か月の抜けも一覧したい」使い方のために、チェック1つで元の見え方に戻せるようにしている
   * （この画面を離れると既定＝省くに戻る。設定として保存はしない）。
   */
  const [planSheetIncludeEmptyDays, setPlanSheetIncludeEmptyDays] = useState(false)
  const sheetTitleOf = useMemo(
    () => (recipeId: number) => recipeById.get(recipeId)?.title,
    [recipeById],
  )
  const monthPlanSheet = useMemo(
    () =>
      buildPlanSheet({
        // 期間で絞っているあいだは、その期間を名乗る（旧・週タブの見出しをそのまま使う）
        title:
          monthRangeActive && rangeStart != null && rangeEnd != null
            ? ja.mealPlan.planSheetRangeHeading
                .replace('{start}', formatMonthDay(rangeStart))
                .replace('{end}', formatMonthDay(rangeEnd))
            : ja.mealPlan.planSheetMonthHeading
                .replace('{y}', monthAnchor.slice(0, 4))
                .replace('{m}', String(Number(monthAnchor.slice(5, 7)))),
        dates: monthTargetDates,
        visibleSlots,
        entries: monthTargetEntries,
        titleOf: sheetTitleOf,
        notes: monthTargetNotes,
        includeEmptyDays: planSheetIncludeEmptyDays,
      }),
    [
      monthRangeActive,
      rangeStart,
      rangeEnd,
      monthAnchor,
      monthTargetDates,
      visibleSlots,
      monthTargetEntries,
      sheetTitleOf,
      monthTargetNotes,
      planSheetIncludeEmptyDays,
    ],
  )
  const savePlanSheetImage = async (sheet: PlanSheet) => {
    try {
      const result = await sharePlanSheetImage(sheet)
      setMessage(
        result === 'shared'
          ? ja.mealPlan.planSheetImageShared
          : result === 'cancelled'
            ? ja.mealPlan.planSheetImageCancelled
            : ja.mealPlan.planSheetImageDone,
      )
    } catch {
      // Canvasが使えない等で作れなかったときに無反応にしない（何が起きたかを必ず伝える）
      setMessage(ja.mealPlan.planSheetImageFailed)
    }
  }

  /**
   * 食数（何人分作るか）を決める窓（2026-08-03 便DJ・オーナー指示）。
   * 開いている枠のid・料理名・レシピに登録されている人数分・既定の食数・いまの値を持つ。
   * isCustom＝その枠に食数を決めてある（＝既定に戻すボタンを出す）。
   * 2026-08-03 便DK: defaultServings＝決めていない枠が使う人数（設定「ふだん作る人数」があれば
   * その人数・無ければレシピの登録人数分）。戻すボタンの文言と実際の戻り先をここで一致させる。
   */
  const [servingsEditor, setServingsEditor] = useState<{
    entryId: number
    /** どの日のどの食事の枠か(2026-08-08 便EA)。鍵が掛かっていれば食数も変えられない */
    date: string
    slot: MealSlot
    title: string
    recipeServings: number
    defaultServings: number
    value: number
    isCustom: boolean
  } | null>(null)
  const submitServings = async (value: number | undefined) => {
    if (!servingsEditor) return
    const { entryId, date, slot, title, defaultServings } = servingsEditor
    if (blockedByLock(date, slot, 'servings')) {
      setServingsEditor(null)
      return
    }
    await updateMealEntryServings(entryId, value)
    setServingsEditor(null)
    setMessage(
      value == null
        ? ja.mealPlan.servingsResetDone
            .replace('{title}', title)
            .replace('{n}', String(defaultServings))
        : ja.mealPlan.servingsDone.replace('{title}', title).replace('{n}', String(value)),
    )
  }

  /**
   * 週タブの曜日カードの開け閉め（2026-08-03 便DJ・オーナー指示。畳むと日付の行だけが残る）。
   *
   * 2026-08-19 便ID・⑦（オーナー原文「デフォルト表示は、過去の日付は折りたたみ（入力があれば
   * ☑️マーク）、献立が空欄の未来の日付も折りたたみ、献立ありの未来の日付は開いて表示にしたい。」）:
   * **既定を「全部開く」から日ごとの判断に変えた**。決め方は logic/mealPlan.ts の
   * planDefaultFoldedDates が持つ（実行日の曜日にも月替わりにも依存しない形）。
   *
   * ここが覚えるのは**人が押して開け閉めしたぶんだけ**（日付→畳んでいるか）。
   * 押していない日は既定に従う＝あとから献立が入れば、その日は押さなくても開く。
   * 週を移動しても持ち越さない（日付をキーにしているので、別の週の日付には当たらない）。
   */
  const [dayFoldOverrides, setDayFoldOverrides] = useState<Record<string, boolean>>({})
  /**
   * 週タブの「1日ずつの編集モード」（2026-08-22 便IV・オーナー原文
   * 「1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、選んだレシピの追加や
   *  書き換えができるようにする。１週間分をざっくりと計画した後に、気になるところは個別に
   *  編集モードでレシピ変更できる、という流れを考えています。」）。
   *
   * 覚えるのは**編集している日の日付1つだけ**（切り替えの決め方は logic/mealPlan.ts の
   * planToggleDayEdit）。他の日は通常表示のまま＝1画面で週を見渡せる状態を崩さない。
   * 週を送れば別の週の日付には当たらないので、自動で通常表示に戻る。
   */
  const [weekEditDate, setWeekEditDate] = useState<string | null>(null)
  /**
   * 献立が1品以上入っている日（表示している食事のぶんだけ数える）。
   * 表示していない食事にしか入っていない日を「献立あり」と数えると、開いても何も無い日が開く。
   */
  const datesWithPlan = useMemo(() => {
    const set = new Set<string>()
    for (const entry of entries ?? []) {
      if (visibleSlots.includes(entry.slot)) set.add(entry.date)
    }
    return set
  }, [entries, visibleSlots])
  const defaultFoldedDates = useMemo(
    () => new Set(planDefaultFoldedDates({ dates, today, datesWithPlan })),
    [dates, today, datesWithPlan],
  )
  const isDayFolded = (date: string) => dayFoldOverrides[date] ?? defaultFoldedDates.has(date)
  const setAllDaysFolded = (folded: boolean) =>
    setDayFoldOverrides((prev) => {
      const next = { ...prev }
      for (const date of dates) next[date] = folded
      return next
    })
  const allDaysCollapsed = dates.every((d) => isDayFolded(d))
  /** 表示中の7日が全部ロック済みか（「すべてロック」ボタンが「すべて解除」に変わる条件） */
  const allDaysLocked = dates.every((d) => isDayMealLocked(lockedKeys, d))

  /**
   * 週タブからレシピ詳細へ移る直前に、いまの居場所（見ている週と縦スクロール位置）を覚える
   * （2026-08-07 便DT-2・オーナー指示）。戻ってきたときに同じ場所へ復元するために使う。
   * 覚えるのは sessionStorage だけ＝端末に残るユーザーデータには何も書かない。
   */
  const rememberWeekReturn = () => {
    // 2026-08-14 便GH: 縦位置に加えて「上端が見えているいちばん上の曜日カード」も覚える。
    // 選び方の理由は logic/navMemory.ts の pickReturnAnchor に書いてある
    const cards = [...document.querySelectorAll<HTMLElement>('section[data-date]')].map((el) => ({
      date: el.dataset.date ?? '',
      top: el.getBoundingClientRect().top,
    }))
    let visibleTop = 0
    for (const bar of document.querySelectorAll<HTMLElement>('[data-app-top-bar]')) {
      const rect = bar.getBoundingClientRect()
      if (rect.height > 0 && rect.top <= 2) visibleTop = Math.max(visibleTop, rect.bottom)
    }
    writeSessionItem(
      WEEK_RETURN_KEY,
      serializeWeekReturn({
        weekStart: dates[0],
        scrollY: window.scrollY,
        anchor: pickReturnAnchor(cards, visibleTop) ?? undefined,
        // 人が開け閉めした曜日カードも一緒に覚える（2026-08-19 便ID・⑦）。
        // 覚えずに戻ると、開いていた日がまた畳まれてページの高さが変わり、
        // 覚えた縦位置に戻しても違う場所へ着く（実測で130pxずれた）
        dayFold: dayFoldOverrides,
      }),
    )
  }

  /**
   * 「作った記録の一覧」へ移る直前に、月タブ・日タブの居場所を覚える（2026-08-09 便EQ・
   * オーナー「戻るのも該当場所のスクロール位置まで」）。一覧の「戻る」は `restore=1` 付きで
   * 帰ってくるので、上の初期化処理が同じ月・同じ縦位置まで戻す。
   */
  const rememberMonthReturn = () => {
    writeSessionItem(
      MONTH_RETURN_KEY,
      serializeViewReturn({
        anchor: monthAnchor,
        scrollY: window.scrollY,
        // 2026-08-10 便FD: 月タブの「レシピを見る」は日の窓の中にあるので、
        // どの日の窓を開いていたかも覚える＝戻ったときに同じ窓へ帰れる
        openDate: dayModalDate ?? undefined,
      }),
    )
  }
  const rememberDayReturn = () => {
    writeSessionItem(DAY_RETURN_KEY, serializeViewReturn({ anchor: '', scrollY: window.scrollY }))
  }

  /**
   * 記録の小窓からレシピ詳細・記録の編集へ移るときの帰り道（2026-08-09 便EQ）。
   * いま開いているタブ（日/週/月）と、そのタブでの居場所へ帰す。
   */
  const logDetailLinkState =
    viewMode === 'week'
      ? WEEK_RETURN_LINK_STATE
      : {
          from: 'mealPlan',
          fromPath: `/meal-plan?focus=${viewMode === 'month' ? 'month' : 'today'}&${WEEK_RETURN_PARAM}=1`,
        }
  const rememberLogDetailReturn = () => {
    if (viewMode === 'week') rememberWeekReturn()
    else if (viewMode === 'month') rememberMonthReturn()
    else rememberDayReturn()
  }

  /**
   * 「Pro版について見る」から設定へ寄り道するときの行き先と、離れる直前の覚え
   * （2026-08-27 便LU・オーナー原文「各種pro版について見るからの戻り先、献立ならすべて日に
   *  戻ってしまう。直前の状態に戻して。折りたたみが閉じてしまう、スクロール場所がズレるのもやめて。」）。
   *
   * 直す前は帰り道が `/meal-plan`（現在地のパスだけ）だった。日/週/月のどれを見ていたかも、
   * 見ていた週も、開いた曜日カードも、縦位置も**URLに乗っていない**ので、設定から帰ると
   * 必ず既定の姿（日タブ・畳んだ状態・先頭）で開き直していた。
   *
   * 新しい仕組みは足していない——**レシピ詳細・作った記録の一覧から帰るときと同じ道**に乗せる
   * （覚えるのは rememberLogDetailReturn、帰り道は logDetailLinkState.fromPath＝
   *   `?focus=<タブ>&restore=1`）。行き先が設定に変わるだけなので、
   *   覚え方・戻し方・捨て方はすでに実測で固めた1つのままになる。
   */
  const proGateDetour = {
    to: settingsLinkWithBack('/settings?section=pro', logDetailLinkState.fromPath),
    onClick: rememberLogDetailReturn,
  }

  /**
   * 記録を付けた直後のトーストから「作った記録の一覧へ」を出すか（2026-08-26 便LJ）。
   * 出した文言そのものを見比べる＝別の操作でトーストが差し替わったら行き先も消える。
   */
  const historyToastActive = historyToast !== '' && historyToast === message
  /**
   * その行き先（2026-08-26 便LJ）。画面の中の「作った記録の一覧」リンクとまったく同じ道を通る
   * ＝いま開いているタブと縦位置を覚えてから移り、一覧の「戻る」で同じ場所へ帰ってくる
   * （日タブ・週タブ・月タブでそれぞれ ?back= が違う。HistoryPage の backTargetOf が受ける）。
   */
  const openHistoryFromToast = () => {
    rememberLogDetailReturn()
    const back = viewMode === 'week' ? 'week' : viewMode === 'month' ? 'month' : 'day'
    navigate(`/history?back=${back}`)
  }

  /**
   * 週タブの操作3グループの開閉（2026-08-03 便DJ・オーナー指示）。
   * 画面を離れると既定に戻る（設定には残さない）。
   *
   * 2026-08-09 便EN（オーナー実機「『献立を提案』も既定で折りたたみに」）: 3つとも畳んだ状態で
   * 始めていた。実行ボタン「まとめて献立を入力」が見出しの横にあり、畳んでいても押せたため
   * （便DT-5/6）操作は失われていなかった。
   *
   * 2026-08-19 便IF・⑤⑥: 「献立を提案」だけ既定で開く（＝便DJでオーナーが決めた既定に戻す）。
   * 理由は2つ。
   *  ・⑥で並びを日タブにそろえ、実行ボタンを条件の下（グループの中）へ移した。
   *    見出しの横に実行ボタンが無くなったので、畳んだままだと押すものが画面から消える
   *  ・⑤「献立を提案の項目で一番重要なはずの条件を入れる場所がすぐにわからない」は、
   *    グループを畳んでいるあいだ「現在の条件」が1つも見えないままでは直らない
   * 便ENが畳んだ理由（中身が縦に長い）は、便IDで条件が窓に移り、便IFで説明を1行にまとめた
   * ことで無くなっている。
   *
   * 2026-08-22 便IV（オーナー原文「でふぉるとで設定３種は、折りたたんだ表示にして」）:
   * **3つとも畳んだ状態から始める**。便IFが「献立を提案」だけ開いていた理由（実行ボタンが
   * グループの中にある）は、同じ書き溜めの「「まとめて献立てを入力」ボタンは「献立を提案」の
   * 横にして、１列におさめて。」で解けている＝実行ボタンは見出しの横に出したままなので、
   * 畳んでいても押すものが画面から消えない。
   * 既定の値そのものは logic/mealPlan.ts の WEEK_GROUP_DEFAULT_OPEN が持つ（見張れる形にする）。
   */
  const [weekGroupOpen, setWeekGroupOpen] = useState<Record<keyof typeof WEEK_GROUP_DEFAULT_OPEN, boolean>>({
    ...WEEK_GROUP_DEFAULT_OPEN,
  })

  /**
   * 「まとめて献立を入力」が何をするか（2026-08-07 便DT-8・オーナー指示）。
   *  - 'fillEmpty'  … まだ決まっていない枠だけ埋める（今ある献立は1品も消さない＝完全に非破壊）
   *  - 'replaceAll' … レシピを総入れ替え（これからの献立を消してから入れ直す。確認文を必ず出す）
   *
   * 既定を 'fillEmpty' にしたのは、可逆・非破壊の側を既定にする運用（規約C）に合わせるため。
   * 従来の「押すたびに自動提案の枠だけ振り直す」（2026-07-14確定）は 'replaceAll' 側に含まれる
   * （総入れ替えは自動・手動を問わず入れ直すので、振り直したい人はこちらを選ぶ）。
   *
   * 2026-08-24 便KJ・①（オーナー原文「提案の入れ方が、タブ移動で「空いた枠だけ」に戻る。
   * 選択保持して。総入れ替えだと確認画面も出るので、総入れ替えに気づかない仕組みには
   * なっていない。」）: **設定に覚える**。直す前は画面を離れると既定へ戻していた（消す側の
   * 選択を黙って覚えない、という判断）が、オーナーは「消える操作は押したあとに必ず確認の窓が
   * 出る」ことまで見たうえで残すよう求めている。覚え先は planPurpose・planGenres と同じ設定。
   * 読み出しは normalizePlanFillMode を通す＝壊れた値でも消える側から始まることが無い。
   */
  const fillMode = normalizePlanFillMode(settings?.planFillMode)
  const setFillMode = (next: PlanFillMode) => saveSettings({ planFillMode: next })


  // 週タブ「この週の◯◯をまとめて空にする」(便U-4 Fable設計: 「朝のみ削除したい」への回答)。
  // 食事を選び、確認ダイアログを経てから、表示中の週(dates[0]〜dates[6]。週タブで
  // 前後移動している場合はその週)のうち、その食事のエントリだけをまとめて削除する。
  // 概算食費(weekCostEstimate)は表示帯(visibleSlots)では絞らず「登録されている献立全部」を
  // 集計する仕様のままなので、この削除は自動的に金額へ反映される。
  // ただし過去日は集計から外している(2026-07-29 便CD/MP-07。表示から消えている予定が
  // 金額に入っていると何を消せば減るのか辿れないため)
  // 2026-08-03 便DJ(オーナー指示): 1つだけだった対象食事を複数選択にした
  // （朝食と昼食をまとめて空にしたい、という使い方に1回で応える）
  const [clearSlotTargets, setClearSlotTargets] = useState<MealSlot[]>(['dinner'])
  const toggleClearSlotTarget = (slot: MealSlot) =>
    setClearSlotTargets((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : MEAL_SLOTS.filter((s) => prev.includes(s) || s === slot),
    )
  /** 選んだ食事を朝→昼→夜の順に「・」で並べた表示名（見出し・確認文・結果で共用） */
  const clearSlotLabel = MEAL_SLOTS.filter((s) => clearSlotTargets.includes(s))
    .map((s) => ja.mealPlan.slot[s])
    .join('・')
  const clearWeekSlot = async () => {
    if (clearSlotTargets.length === 0) {
      setMessage(ja.mealPlan.clearWeekSlotPickSlot)
      return
    }
    const label = clearSlotLabel
    // 規約F(2026-07-29 便CD/MP-19): 「何が消えるか(件数つき)」と「何が残るか」を両方書く。
    // 対象は表示中の週の全日(過去日を含む)。2026-08-08 便DX: どの行を消すかの判断
    // (鍵の掛かった食事は消さない)を純ロジックへ切り出し、テストで固定した
    const weekEntries = entries ?? []
    const clearPlan = planClearMealSlots(weekEntries, clearSlotTargets, lockedKeys)
    const targetCount = clearPlan.targetCount
    const lockNotice = lockNoticeOf(clearPlan.lockedSlotCount)
    if (targetCount === 0) {
      setMessage(withNotice(ja.mealPlan.clearWeekSlotEmpty.replace('{slot}', label), lockNotice))
      return
    }
    // 残る食事とその件数（朝昼夜を全部選んだときは残るほかの食事が無いので専用の文にする）
    const restSlots = MEAL_SLOTS.filter((s) => !clearSlotTargets.includes(s))
    const restCount = weekEntries.filter((e) => restSlots.includes(e.slot)).length
    const allSlots = restSlots.length === 0
    const ok = await confirm({
      title: (allSlots
        ? ja.mealPlan.clearWeekSlotConfirmAllTitle
        : ja.mealPlan.clearWeekSlotConfirmTitle
      )
        .replace('{slot}', label)
        .replace('{n}', String(targetCount)),
      body: allSlots
        ? ja.mealPlan.clearWeekSlotConfirmAll
        : ja.mealPlan.clearWeekSlotConfirm
            .replace('{rest}', restSlots.map((s) => ja.mealPlan.slot[s]).join('・'))
            .replace('{r}', String(restCount)),
      notes: lockNotice ? [lockNotice] : [],
      confirmLabel: ja.mealPlan.clearWeekSlotConfirmOk,
    })
    if (!ok) return
    await removeMealEntries(clearPlan.entryIdsToRemove)
    setMessage(
      withNotice(
        ja.mealPlan.clearWeekSlotDone.replace('{slot}', label).replace('{n}', String(targetCount)),
        lockNotice,
      ),
    )
  }

  /**
   * 「ごはんを含めて計算する」(2026-08-02 便CW-10・オーナー承認。無料・既定OFF)。
   *
   * 献立に登録するのはおかずだけ、という使い方が前提なので、本人が選んだときだけ
   * 各食に「ごはん1杯」を足して栄養と食費を出す。足す条件は次の2つだけ:
   *  ・その食事(朝食/昼食/夕食)に料理が1品でも入っている
   *  ・その食事の主菜が一品もの(丼・麺・カレー・鍋)ではない(主食が重なるため)
   * 数え方は登録した献立と同じで、ごはんの成分値・量・金額は成分表と食材価格マスタから引く
   * (アプリ側に150gや◯kcalを書き写さない)。
   */
  const includeRice = !!settings?.includeRice
  /**
   * ごはんを足す食事の「日付|食事」キー(登録した献立から数える。今日以降の日に使う)。
   * 日ごとの杯数・食事ごとの内訳・週の概算食費は、すべてこの1か所の判定から作る
   * （同じ「どの食事に足すか」の規則を2か所に書かない）。
   */
  const riceSlotKeys = useMemo(() => {
    if (!includeRice) return new Set<string>()
    const bySlotKey = new Map<string, MealPlanEntry[]>()
    ;(entries ?? []).forEach((e) => {
      const key = riceSlotKey(e.date, e.slot)
      const list = bySlotKey.get(key)
      if (list) list.push(e)
      else bySlotKey.set(key, [e])
    })
    // 「どの食事に足すか」の規則そのものは logic/nutritionBalance.ts の純関数が持つ
    // （2026-08-09 便EN。1日1杯ではなく食事ごとに1杯であることを単体テストで固定するため）
    const slots: RiceSlotInput[] = []
    bySlotKey.forEach((slotEntries, key) => {
      const [date, slot] = key.split('|')
      const mainRecipe = slotEntries
        .filter((e) => (e.role ?? 'main') === 'main')
        .map((e) => recipeById.get(e.recipeId))
        .find((r): r is Recipe => !!r)
      slots.push({ date, slot, oneDishMain: !!mainRecipe && isOneDish(mainRecipe) })
    })
    return riceSlotKeysOf(slots)
  }, [includeRice, entries, recipeById])
  /** 日付→その日に足すごはんの杯数（食事の数だけ数える） */
  const ricePlanServingsByDate = useMemo(() => riceServingsByDate(riceSlotKeys), [riceSlotKeys])
  /**
   * 日付→その日に足すごはんの杯数(作った記録から数える。過ぎた日に使う)。
   * 作った記録には食事(朝/昼/夕)の情報が無いため、食事の数では数えられない。
   * 「主菜になる料理1品＝1食」と見なして数える(副菜だけの記録には足さない)。
   */
  const riceActualServingsByDate = useMemo(() => {
    const counts = new Map<string, number>()
    if (!includeRice) return counts
    cookedLogsByDate.forEach((logs, date) => {
      let n = 0
      logs.forEach(({ recipe }) => {
        if (isMainDish(recipe) && !isOneDish(recipe)) n++
      })
      if (n > 0) counts.set(date, n)
    })
    return counts
  }, [includeRice, cookedLogsByDate])

  // 週の概算食費（材料ごとの価格入力を優先し、未入力の材料は食材価格マスタで補う。docs/20 §3）
  // 集計対象は activeEntries(今日以降)。過去日は週タブに表示されないので金額から辿れない
  // (2026-07-29 便CD/MP-07)。過ぎた分の実績は月タブの「期間の食費と栄養」が担当する
  // 2026-08-03 便DK: 金額は「作る食数ぶん」(1人分の単価×実効食数)。食数を1つも触らず
  // 「ふだん作る人数」も未設定なら実効食数＝登録人数分で、従来と1円も変わらない
  const weekCostEstimate = useMemo(
    () => sumMealPlanEntriesCost(activeEntries, recipeById, priceIndex, householdServings),
    [activeEntries, recipeById, priceIndex, householdServings],
  )
  /** ごはん1杯ぶんの金額(食材価格マスタから引く。マスタに価格が無ければ0円=足さない) */
  const riceYen = useMemo(
    () => estimateRecipeCost(RICE_SERVING_RECIPE.ingredients, priceIndex).total,
    [priceIndex],
  )
  /**
   * 週の概算食費に足すごはんの杯数。金額の集計範囲(activeEntries=今日以降)に合わせて数える
   * ＝画面に出ている予定と金額が一致する(2026-07-29 便CD/MP-07と同じ考え方)。
   *
   * 2026-08-03 便DK: 設定「ふだん作る人数」を入れているときは、1食につきその人数ぶんの杯数で
   * 数える(3人家族なら1食3杯)。おかず側が作る食数ぶんの金額になったので、ごはんだけ1杯のままだと
   * 予算と比べる金額が食い違うため。未設定なら従来どおり1食1杯。
   * 栄養側(weekBalanceの ricePlanServingsByDate)は1人分のままで、こちらの倍率は使わない。
   */
  const riceCostServings = useMemo(() => {
    if (!includeRice) return 0
    const perMeal = householdServings != null && householdServings > 0 ? householdServings : 1
    let total = 0
    ricePlanServingsByDate.forEach((n, date) => {
      if (!isPastDate(date, today)) total += n * perMeal
    })
    return total
  }, [includeRice, ricePlanServingsByDate, today, householdServings])
  const weekCost = weekCostEstimate.total + riceCostServings * riceYen
  // 概算食費の食数(=食事の回数。主菜+副菜が並ぶ枠も1食。2026-07-24 便BH-3・タスク8「◯食分」併記)
  const weekMealCount = useMemo(() => mealOccasionCount(activeEntries), [activeEntries])
  // 価格が分からない材料の種類数(2026-07-29 便CD/MP-11)。この分は合計に1円も入っていない
  const weekPricelessCount = useMemo(
    () => pricelessIngredientNames(activeEntries, recipeById, priceIndex).length,
    [activeEntries, recipeById, priceIndex],
  )
  // 概算食費の折りたたみ(2026-07-24 便BH-3・タスク4: 「まとめて献立」直後にいきなり金額が出る
  // 違和感への対応。既定閉・配置も7日分カードの下=邪魔にならない位置へ移動)。
  // 2026-08-25 便KU: 「栄養と食費」の節の折りたたみ(weekGroupOpen.nutritionCost)に一本化した
  // ＝入れ子の折りたたみを作らない（開くのに2回押させない）ので、専用の状態は持たない

  /**
   * 栄養バランスの見える化(2026-07-30 便CL・docs/60 第1段)。
   * 週タブの各日カードと週まとめに「その日/その週の献立ぶん(1人分)」の栄養と野菜量を出す。
   *
   * 数える基準は便CA以降の統一規則: **過去日=作った記録・未来日=登録した献立・
   * 今日は「作った記録があるものは記録、まだのものは登録した献立」**
   * (rangeSummaryのdayIntakeMap・月カレンダーのセル表示と同じ。1日を両方で数えない)。
   * 食費(weekCostEstimate)は「これから作る予定」だけを対象にするので activeEntries を見るが、
   * こちらは過去日も対象に含める: 週タブの過去日には「作った記録」カードが出ているので、
   * その日の数字がどこから来たのか画面から辿れる。
   * 食事帯(visibleSlots)では絞らない(1日の合計は、その日に登録されている献立ぜんぶで数える)。
   *
   * matchKey は「今日の記録と今日の献立で同じ料理を二重に数えない」ための照合キー(2026-08-09 便EK)。
   * ごはん(便CW-10で足す1杯)はレシピIDを持たず記録側・献立側の両方に積まれるので、
   * 専用のキーを与えて同じ料理として突き合わせる。
   */
  const weekBalanceCooked = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    dates.forEach((date) => {
      cookedLogsByDate
        .get(date)
        ?.forEach(({ recipe }) => list.push({ date, recipe, matchKey: balanceMatchKey(recipe.id) }))
      // 「ごはんを含めて計算する」がONのときだけ、その日のごはんを1品として足す(便CW-10)
      riceServingRecipes(riceActualServingsByDate.get(date) ?? 0).forEach((recipe) =>
        list.push({ date, recipe, matchKey: RICE_BALANCE_MATCH_KEY }),
      )
    })
    return list
  }, [dates, cookedLogsByDate, riceActualServingsByDate])
  const weekBalancePlanned = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    ;(entries ?? []).forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (recipe) list.push({ date: e.date, recipe, matchKey: balanceMatchKey(e.recipeId) })
    })
    ricePlanServingsByDate.forEach((n, date) => {
      riceServingRecipes(n).forEach((recipe) =>
        list.push({ date, recipe, matchKey: RICE_BALANCE_MATCH_KEY }),
      )
    })
    return list
  }, [entries, recipeById, ricePlanServingsByDate])
  const weekBalanceByDate = useMemo(
    () =>
      dayBalanceMap({
        dates,
        today,
        cooked: weekBalanceCooked,
        planned: weekBalancePlanned,
      }),
    [dates, today, weekBalanceCooked, weekBalancePlanned],
  )
  const weekBalance = useMemo(
    () => summarizeWeekBalance(weekBalanceByDate.values()),
    [weekBalanceByDate],
  )
  /**
   * 日ごと・食事ごとの栄養の小計（2026-08-02 便CW-6・オーナー要望。Pro解錠時だけ画面に出す）。
   * 元は「登録した献立」だけ＝作った記録には食事(朝/昼/夕)の情報が無いので、
   * 過ぎた日には出さない。2つ以上の食事に献立がある日だけMapに入れる
   * （1食だけの日は1日の合計と同じ数字がもう一度並ぶだけになるため）。
   *
   * 2026-08-09 便EK: 今日を「作った記録があるものは記録」で数えるようにしたので、条件を
   * 「基準が予定の日」から「合計に入れた品が全部どの食事のものか分かる日
   * （slotUnknownDishCount===0）」へ変えた。今日ぶんを記録で数えても、その記録が献立の中の
   * 料理なら合計＝献立ぜんぶなので、小計と1日の合計はぴったり足し算が合う。
   * 献立に無い料理を作った記録がある日だけ、小計を出さない（足し算が合わなくなるため）。
   */
  const weekSlotBalanceByDate = useMemo(() => {
    const byDate = new Map<string, { slot: MealSlot; recipe: BalanceRecipeLike }[]>()
    const push = (date: string, slot: MealSlot, recipe: BalanceRecipeLike) => {
      const list = byDate.get(date)
      if (list) list.push({ slot, recipe })
      else byDate.set(date, [{ slot, recipe }])
    }
    ;(entries ?? []).forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (!recipe) return
      push(e.date, e.slot, recipe)
    })
    // 「ごはんを含めて計算する」がONなら、足す対象の食事にだけごはんを1品として入れる(便CW-10)
    riceSlotKeys.forEach((key) => {
      const [date, slot] = key.split('|')
      push(date, slot as MealSlot, RICE_SERVING_RECIPE)
    })
    const result = new Map<string, SlotBalance[]>()
    byDate.forEach((dishes, date) => {
      const dayBalance = weekBalanceByDate.get(date)
      if (!dayBalance || dayBalance.slotUnknownDishCount > 0) return
      const list = slotBalances(dishes)
      if (list.length > 1) result.set(date, list)
    })
    return result
  }, [entries, recipeById, weekBalanceByDate, riceSlotKeys])

  const weeklyBudget = settings?.weeklyBudget
  const budgetDiff = weeklyBudget != null ? weeklyBudget - weekCost : undefined

  // 価格情報（個別入力・マスタ一致のどちらか）が1件も無ければ「週の概算食費」セクションごと非表示にする
  // (価格情報が無い人には無意味な表示のため。2026-07-10 オーナー要望・docs/20 §3でマスタ一致も対象に追加)
  const hasPricedRecipe = useMemo(
    () => (recipes ?? []).some((r) => estimateRecipeCost(r.ingredients, priceIndex).hasAnyPriceInfo),
    [recipes, priceIndex],
  )

  /* ---- 買い物リストの範囲えらび（2026-08-08 便EA・オーナー要望）----
     オーナー原文「選択した日付や時間帯レシピから買い物リスト作成したい。3日分とか、
     １週間分まとめて買い物とは限らない」。
     null＝絞っていない＝従来どおり表示中の週ぜんぶ（＝開かない人の手数も分量も変わらない）。
     チップを押して全部選び直した状態は null に戻す＝「絞っていない」の意味を1つに保つ。
     献立のロックとは無関係（買い物は献立を読むだけ）。 */
  /* 2026-08-25 便KU: 開閉は「買い物メモ」の節（weekGroupOpen.shopping）が持つようになった。
     ここで別に持つと、同じ折りたたみの状態が2か所に分かれる */
  const [shopDates, setShopDates] = useState<string[] | null>(null)
  const [shopSlots, setShopSlots] = useState<MealSlot[] | null>(null)
  /** 範囲に選べる日付＝週タブで買い物の対象になっている日（過ぎた日は元から対象外） */
  const shopSelectableDates = useMemo(
    () => dates.filter((d) => !isPastDate(d, today)),
    [dates, today],
  )
  // 週を移動したら選択は白紙に戻す（別の週の日付を選んだまま残さない）
  const shopRangeWeekKey = dates[0]
  useEffect(() => {
    setShopDates(null)
  }, [shopRangeWeekKey])
  // 「表示する食事」を変えたら食事の選択も白紙に戻す（表示していない食事を選んだまま残さない）。
  // 監視するのは中身を並べた文字列＝設定の再読み込みで配列の実体だけが変わったときに
  // 選択を巻き戻さないため
  const shopRangeSlotKey = visibleSlots.join(',')
  useEffect(() => {
    setShopSlots(null)
  }, [shopRangeSlotKey])
  const shopRange: ShoppingRange = { dates: shopDates, slots: shopSlots }
  const shopRangeNarrowed = isShoppingRangeNarrowed(shopRange, shopSelectableDates, visibleSlots)
  /** いま集計の対象になっている日付・食事（絞っていなければ「全部」） */
  const shopRangeDates = shopDates ?? shopSelectableDates
  const shopRangeSlots = shopSlots ?? visibleSlots
  const shopIncludesTodayList = shoppingRangeIncludesTodayList(today, shopRange)
  const toggleShopDate = (date: string) => {
    setShopDates((prev) => {
      const base = prev ?? shopSelectableDates
      const next = base.includes(date) ? base.filter((d) => d !== date) : [...base, date]
      const sorted = shopSelectableDates.filter((d) => next.includes(d))
      return sorted.length === shopSelectableDates.length ? null : sorted
    })
  }
  const toggleShopSlot = (slot: MealSlot) => {
    setShopSlots((prev) => {
      const base = prev ?? visibleSlots
      const next = base.includes(slot) ? base.filter((s) => s !== slot) : [...base, slot]
      const sorted = visibleSlots.filter((s) => next.includes(s))
      return sorted.length === visibleSlots.length ? null : sorted
    })
  }
  const resetShopRange = () => {
    setShopDates(null)
    setShopSlots(null)
  }

  /**
   * 買い物リストに渡すレシピと、その週に作る回数（2026-07-29 便CC/C10）。
   * 従来はレシピIDの重複を捨てていたため、同じ料理が週に2回入っていても材料は1回分しか
   * 出ず、買い物メモが実際の必要量に足りていなかった。回数を数えて倍率として渡す。
   *
   * 2026-08-08 便EA: 日付・食事で絞れるようにした（filterShoppingEntries）。
   * 絞っていなければ従来と同じ集計（過ぎた日を除く今日以降 × 表示している食事）。
   */
  const weekRecipeCounts = useMemo(() => {
    const counts = new Map<number, number>()
    // 過ぎた日の材料は買わせない(2026-07-29 便CD/MP-07): 集計対象は activeEntries(今日以降)
    filterShoppingEntries(activeEntries, visibleSlots, shopRange).forEach((e) => {
      counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1)
    })
    // 「今日の献立」(今日つくるリスト)の分も買い物候補に含める。
    // 週の表を使わず今日の献立だけで運用する人の材料が漏れないように
    // (2026-07-09 ペルソナテスト第1波)。週の表に既にある品は回数を増やさない
    // (同じ食事を週の表と今日の献立で二重に数えないため)
    if (shopIncludesTodayList)
      todayList?.forEach((item) => {
        if (!counts.has(item.recipeId)) counts.set(item.recipeId, 1)
      })
    return counts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntries, settings?.visibleMealSlots, todayList, shopDates, shopSlots, shopIncludesTodayList])

  const weekRecipeIds = useMemo(() => Array.from(weekRecipeCounts.keys()), [weekRecipeCounts])

  /**
   * 買い物リストに渡す「この週に作る食数の合計」（2026-08-03 便DJ・食数設定）。
   * 枠ごとに決めた食数（MealPlanEntry.servings）を足し合わせ、決めていない枠は
   * 設定「ふだん作る人数」、それも無ければそのレシピに登録されている人数分で数える
   * （2026-08-03 便DK。優先順位は logic/servings.ts effectiveMealServings に集約）
   * ＝食数を1つも触らず「ふだん作る人数」も未設定なら「回数 × 登録人数」と同じ値になり、
   * 従来と分量が1gも変わらない。
   */
  const weekRecipeServings = useMemo(() => {
    const totals = new Map<number, number>()
    const add = (recipeId: number, servings: number) =>
      totals.set(recipeId, (totals.get(recipeId) ?? 0) + servings)
    filterShoppingEntries(activeEntries, visibleSlots, shopRange).forEach((e) => {
      add(
        e.recipeId,
        effectiveMealServings(e.servings, householdServings, recipeById.get(e.recipeId)?.servings),
      )
    })
    // 週の表に無い「今日の献立」の分は1回分＝既定の食数（weekRecipeCountsと同じ数え方）。
    // こちらには枠ごとの食数を決める場所が無いので、既定＝ふだん作る人数／登録人数分で数える
    if (shopIncludesTodayList)
      todayList?.forEach((item) => {
        if (!totals.has(item.recipeId))
          add(
            item.recipeId,
            defaultMealServings(householdServings, recipeById.get(item.recipeId)?.servings),
          )
      })
    return totals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeEntries,
    settings?.visibleMealSlots,
    todayList,
    recipeById,
    householdServings,
    shopDates,
    shopSlots,
    shopIncludesTodayList,
  ])

  const goShopping = () => {
    if (weekRecipeCounts.size === 0) return
    // 「id」または「idx回数」の並び（買い物側は logic/shopping.ts parseRecipeIdsParam で読む）
    const param = Array.from(weekRecipeCounts, ([id, times]) =>
      times > 1 ? `${id}x${times}` : String(id),
    ).join(',')
    // 食数の合計（便DJ）。「レシピID:合計食数」の並びで、買い物側は parseServingsParam で読む
    const servingsParam = Array.from(weekRecipeServings, ([id, servings]) => `${id}:${servings}`).join(
      ',',
    )
    // どの範囲から作ったか（2026-08-08 便EA）。買い物メモの下書きに1行そのまま出す
    // （出所の内訳=fromRecipes は従来どおり食材ごとに持つので、こちらは「範囲」だけを伝える）
    const rangeLabel = formatShoppingRangeLabel({
      dates: shopRangeDates,
      slots: shopRangeSlots,
      includesTodayList: shopIncludesTodayList && (todayList?.length ?? 0) > 0,
    })
    const rangeParam = rangeLabel ? `&range=${encodeURIComponent(rangeLabel)}` : ''
    /**
     * 下書きの画面から、いま居た献立へ帰る道（2026-08-27 便LU・オーナー原文
     * 「下書き画面から直前の画面まで戻ってくる手段がない。」）。
     * Pro案内の帰り道とまったく同じ道具に乗せる＝離れる直前の週・縦位置・
     * 開いた曜日カードを覚えてから移り、買い物メモの「◯◯に戻る」で同じ場所へ帰る。
     */
    rememberLogDetailReturn()
    const backParam = `&back=${encodeURIComponent(logDetailLinkState.fromPath)}`
    navigate(`/shopping?recipeIds=${param}&servings=${servingsParam}${rangeParam}${backParam}`)
  }

  const dowLabels = ja.mealPlan.dow

  // 提案条件が既定値から変わっていれば、畳んだトグルのラベルにも現在値を出す
  // (2026-07-16 UI総点検A-3: 「提案の条件: 和食」のように)
  const activeConditionSummaries: (string | undefined)[] = [
    quickOnly ? ja.mealPlan.quickOnlySummary.replace('{n}', String(quickMinutes)) : undefined,
    // ジャンルは選んだぶんだけ並べる(2026-08-22 便IY)。3つとも選んでいる＝絞っていないので出さない
    genreFiltered ? genreFilters.join('・') : undefined,
    // 目的は「まとめて献立」の結果を最も大きく変える条件なので、畳んだラベルにも必ず出す
    planPurpose ? purposeLabelOf(planPurpose) : undefined,
  ]
  const conditionsSummary = activeConditionSummaries.filter((v): v is string => Boolean(v)).join('・')

  // 重ね窓はEscapeキーと端末の「戻る」で1枚ずつ閉じる(2026-07-30 便CH/C13)。
  // 日モーダルはEscapeだけ対応済みだったので戻るにも広げ、便CB-1/CB-2で増えた
  // ピッカー・テンプレの窓（どちらも未対応で、戻るとレシピ一覧へ離脱していた）も同じ作法に揃える
  // 「現在の条件」の窓（2026-08-19 便ID・④）。閉じ方も後ろの画面の止め方も、
  // 日タブの「条件をしぼる」（便IA）と同じ共通の仕組みに乗せる
  useOverlayDismiss(suggestConditionsOpen, closeSuggestConditions)
  useScrollLock(suggestConditionsOpen)
  useOverlayDismiss(dayModalDate != null, () => setDayModalDate(null))
  useOverlayDismiss(pickerOpen, () => closePicker())
  useOverlayDismiss(templateSaveOpen, () => setTemplateSaveOpen(false))
  useOverlayDismiss(templateApplyScope != null, () => setTemplateApplyScope(null))
  useOverlayDismiss(servingsEditor != null, () => setServingsEditor(null))
  // 窓が開いているあいだ、後ろの献立表は動かさない（2026-08-16 便HE）。
  // 日の窓の上にピッカーが重なる形（2026-07-29 便CB-1）でも、止め方は重なった数を数えるので、
  // 上のピッカーを閉じただけで下の日の窓ぶんの固定が外れることはない
  useScrollLock(dayModalDate != null)
  useScrollLock(pickerOpen)
  useScrollLock(templateSaveOpen)
  useScrollLock(templateApplyScope != null)
  useScrollLock(servingsEditor != null)

  return {
    isDemo, navigate, location, pickerTagOptions, recipes, detachedEntries, settings, saveSettings,
    householdServings, pantryNames, today, setWeekStart, rollingWeek, dates, setWeekLayout,
    currentWeekAnchor, isAtCurrentWeek, lockedKeys, toggleMealLock, viewMode, setViewMode,
    monthAnchor, setMonthAnchor, isPro, monthTrialActive, monthTrialUnused, monthTrialAvailable,
    monthUnlocked, startMonthTrial, monthDatesList, monthLeading, isAtCurrentMonth,
    monthDaysWithPlan, shownLogsOf, logDetail, setLogDetail, cookedLogForEntry,
    cookedPlanEntryIdSet, monthDaysWithLog, monthHideRecipePhoto, monthDayCoverPhoto, dayModalDate,
    setDayModalDate, setMonthEditDate, goToWeekOf, costMode, rangeStart, rangeEnd, toggleCostMode,
    setRangeBound, handleRangeDayTap, entriesByDateSlotAll, dayModalEntries, dayModalBySlot,
    dayModalLogs, dayModalCoverOptions, dayModalCoverChoice, chooseDayCover, dayModalIsPast,
    dayModalEditing, dayModalWindow, dayModalLocked, dayModalTitle, visibleRecipes, visibleSlots,
    toggleSlot, recipeById, monthDayPreview, rangeHighlightBounds, rangeDays, rangePersonalPerDay,
    monthRangeActive, monthPricelessCount, rangePricelessCount, setMonthSummaryOpen,
    setMonthNutritionNotesOpen, setRangeSummaryOpen, setRangeNutritionNotesOpen, monthCostCardOpen,
    setMonthCostCardOpen, monthNutritionCardOpen, setMonthNutritionCardOpen, monthPlanGroupOpen,
    setMonthPlanGroupOpen, monthIntakeSummary, monthIntakeDishCount, monthIntakeEmptyText,
    monthCostDetailsOpen, monthNutritionNotesShown, monthCellMode, monthCellNutrient, monthDayStats,
    plannedGroups, pickedRecipes, dayRecipeIds, naviInProgress, dayHasPlan, dayOrganizing,
    setDayOrganizing, daySwipeOpenKey, setDaySwipeOpenKey, returnedSuggestionId, ownRecipes,
    showHomeScreenNotice, setShowHomeScreenNotice, quickOnly, quickMinutes, genreFilters,
    toggleGenreFilter, planPurpose, changePurpose, suggestConditionsOpen, setSuggestConditionsOpen,
    closeSuggestConditions, anyPlanConditionActive, clearSuggestConditions, changeQuickMinutes,
    message, setMessage, setHistoryToast, setUndoCooked, undoCookedActive, runUndoCooked,
    weekDayNoteByDate, monthDayNoteByDate, handleSaveDayNote, openDayModal, dayModalDiff,
    cancelDayModal, extraRows, hiddenDefaultRows, addOrRestoreRow, addMenuFor, setAddMenuFor,
    setRecordPickDate, pickerOpen, setShownSuggestionOneId, todaySlotPick, setTodaySlotPick,
    pickerQuery, setPickerQuery, pickerControlsOpen, setPickerControlsOpen, pickerSort,
    setPickerSort, pickerTime, setPickerTime, pickerEffort, setPickerEffort, pickerTag,
    setPickerTag, pickerFavoriteOnly, setPickerFavoriteOnly, filteredRecipes, pickerFilterActive,
    currentPickerRecipeId, previousPickerRecipeId, displayedRecipes, closePicker, openPicker,
    pickRecipe, deletePastCookedRecord, setUndoRecordDelete, undoRecordDeleteActive,
    runUndoRecordDelete, setUndoRecord, undoRecordActive, runUndoRecord, setUndoPick,
    undoPickActive, runUndoPick, suggestCandidateCount, suggestPairRecipes,
    rememberSuggestionForReturn, drawSuggestPair, applyTodaySlotPick, setUndoRemove,
    undoRemoveActive, runUndoRemove, removeTodayPickedRecipe, removeTodayPlannedRecipe,
    markDayRecipeCooked, markAllDayRecipesCooked, assignMismatchRecipe, setUndoAssign,
    undoAssignActive, runUndoAssign, clearRow, setUndoSuggest, undoSuggestActive, runUndoSuggest,
    suggestRow, fillWeek, todaySectionRef, fillMonth, mealTemplates, templateSaveOpen,
    setTemplateSaveOpen, templateName, setTemplateName, templateApplyScope, setTemplateApplyScope,
    setSelectedTemplateId, templateDows, weekTemplateItems, openTemplateSave, submitTemplateSave,
    openTemplateApply, selectedTemplate, toggleTemplateDow, applyTemplate, removeTemplate,
    planSheetOpen, setPlanSheetOpen, planSheetIncludeEmptyDays, setPlanSheetIncludeEmptyDays,
    monthPlanSheet, savePlanSheetImage, servingsEditor, setServingsEditor, submitServings,
    setDayFoldOverrides, weekEditDate, setWeekEditDate, datesWithPlan, isDayFolded,
    setAllDaysFolded, allDaysCollapsed, allDaysLocked, rememberWeekReturn, rememberMonthReturn,
    rememberDayReturn, logDetailLinkState, rememberLogDetailReturn, proGateDetour, historyToastActive,
    openHistoryFromToast, weekGroupOpen, setWeekGroupOpen, fillMode, setFillMode, clearSlotTargets,
    toggleClearSlotTarget, clearSlotLabel, clearWeekSlot, includeRice, weekCostEstimate, riceYen,
    riceCostServings, weekCost, weekMealCount, weekPricelessCount, weekBalanceByDate, weekBalance,
    weekSlotBalanceByDate, weeklyBudget, budgetDiff, hasPricedRecipe, shopSelectableDates,
    shopRangeNarrowed, shopRangeDates, shopRangeSlots, toggleShopDate, toggleShopSlot,
    resetShopRange, weekRecipeIds, goShopping, dowLabels, conditionsSummary,
  }
}
