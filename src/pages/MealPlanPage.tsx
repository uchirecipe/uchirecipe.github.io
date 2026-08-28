import { type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { settingsLinkWithBack } from '../logic/backLink'
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
  Copy,
  Lock,
  LockOpen,
  Route,
  RotateCcw,
  Trash2,
  Plus,
  Minus,
  Pencil,
  SlidersHorizontal,
  BookmarkPlus,
  LayoutTemplate,
  ListChecks,
  Printer,
  ImageDown,
} from 'lucide-react'
import { updateSettings } from '../db/settings'
import { type TimeFilter, type EffortFilter } from '../logic/search'
import { type RecipeSortOption } from '../logic/recipeSort'
import { templateDowCounts, TEMPLATE_NAME_MAX_LENGTH } from '../logic/mealTemplate'
import { type PlanSheet } from '../logic/planSheet'
import Toast from '../components/Toast'
import {
  MEAL_SLOTS,
  MEAL_GENRES,
  dowIndex,
  shiftWeek,
  isPastDate,
  shiftMonth,
  isOneDish,
  detectGenreMix,
  isMealSlotLocked,
  isDayMealLocked,
  planDayLockToggle,
  planSlotLockToggle,
  planAllLockToggle,
  planToggleDayEdit,
  planDayEditKind,
  planViewRows,
  planDayCardPadClass,
  PLAN_QUICK_MINUTES_OPTIONS,
} from '../logic/mealPlan'
import type { PlanFillMode } from '../logic/mealPlan'
import { clampServings, effectiveMealServings, defaultMealServings } from '../logic/servings'
import { formatShoppingRangeDates } from '../logic/shopping'
import { isImeConfirmKey } from '../logic/imeKey'
import {
  isNutritionUnlocked,
  nutritionLabelFor,
  nutritionUnitFor,
  resolveNutritionDisplayKey,
  NUTRITION_DISPLAY_KEYS,
} from '../logic/nutrition'
import { type RangeIntakeSummary } from '../logic/rangeSummary'
import { MONTH_TRIAL_MIN_COOKED } from '../logic/proTrial'
import type { MonthDemoData } from '../logic/monthDemo'
import Collapse from '../components/Collapse'
import SwapLabel from '../components/SwapLabel'
import NutritionBalancePanel from '../components/NutritionBalancePanel'
import { EFFORT_FILTER_LEVELS } from '../logic/effort'
import RecipeCard from '../components/RecipeCard'
import {
  DIALOG_ACTIONS_CLS,
  DIALOG_BACKDROP_CLS,
  DIALOG_CANCEL_BUTTON_CLS,
  DIALOG_CARD_CLS,
  DIALOG_PRIMARY_BUTTON_CLS,
} from '../components/dialogStyle'
import type {
  MealPlanEntry,
  MealPurpose,
  MealRole,
  MealSlot,
  MonthCellMode,
  Recipe,
} from '../db/types'
import { LESS_MEAL_PURPOSES, MEAL_ROLES, MORE_MEAL_PURPOSES } from '../db/types'
import CookedLogDetailModal from '../components/CookedLogDetailModal'
import TodaySuggestPanel from '../components/TodaySuggestPanel'
import TodaySlotModal from '../components/TodaySlotModal'
import RecentCookedList from '../components/RecentCookedList'
import DayStartNotices from '../components/DayStartNotices'
import HomeScreenNotice from '../components/HomeScreenNotice'
import {
  CookedLogCard,
  DayCoverOption,
  DayNoteEditor,
  PlanSheetView,
  TodayListRow,
} from './mealPlan/DayParts'
import {
  formatNutrient,
  IntakeCostDetails,
  IntakeCostTable,
  IntakeDisclosureButton,
  IntakeNutritionPanel,
  NutritionSourceNotes,
} from './mealPlan/IntakeParts'
import { MonthCardHeader, MonthDayCell } from './mealPlan/MonthParts'
import { ja } from '../i18n/ja'
import {
  useMealPlanState,
  type ExtraRow,
  WEEK_RETURN_LINK_STATE,
  formatMonthDay,
} from './mealPlan/useMealPlanState'

/**
 * 「日」からレシピ詳細を開くときに持ち回る出所（2026-08-17 便HG）。
 * 「今日なに作る？」の候補カードが使う。ホームにあったころと同じで、戻ると画面の先頭から
 * 見せる（`restore=1` を付けない＝覚えた縦位置は使わない）。
 */
const DAY_LINK_STATE = {
  from: 'mealPlan',
  fromPath: '/meal-plan?focus=today',
} as const

/**
 * 「選ぶボタン」と「実行ボタン」を見た目で分ける（2026-08-09 便EN・オーナー実機
 * 「ボタンの見た目が全て同じため、選択と実行の区別がつかない。選択と実行はわかりやすくしたい」）。
 *
 * 従来はどちらも「アクセント色で塗りつぶした角丸の四角」だったため、条件を選んだだけで
 * 実行し終えたように見えていた（「まとめて献立を入力」を押す必要に気づけない）。
 *  - 選ぶボタン（条件・表示の切り替え・対象の選択）＝**丸い枠のチップ**。選んでいるあいだも
 *    面は塗らず、アクセント色の薄い地・アクセント色の枠と文字・チェック印で示す。
 *  - 実行ボタン（押すと献立が変わるもの）＝**アクセント色で塗りつぶした角丸の四角**。
 * 塗りつぶしを使うのは実行ボタンだけにする＝塗ってあるものは押すと何かが起きる、と
 * 見た目だけで読み取れるようにする。
 */
const chipClass = (on: boolean): string =>
  `inline-flex items-center gap-1 rounded-full border px-3 py-2 text-sm font-bold ${
    on ? 'border-accent text-accent-ink' : 'border-edge bg-surface text-ink-muted'
  }`
/** 選択中のチップの地色。アクセント色から作る＝色を直書きしない（コーディング規約） */
const chipStyle = (on: boolean): { background: string } | undefined =>
  on ? { background: 'color-mix(in oklab, var(--accent) 14%, var(--bg))' } : undefined
/**
 * 選択中のチップの先頭に置くチェック印（色だけでなく形でも選択が分かるようにする）。
 *
 * 2026-08-09 便EO（オーナー実機「ボタンも押下後にサイズが変わって場所がズレるので、
 * 誤操作や見失いの元になってる。基本的にサイズと位置は変えないで」）:
 * 選んだときだけ印を差し込むと、チップの幅が18px（印14px＋間隔4px）伸びて、
 * 右隣のチップが全部ずれる（行があふれれば折り返して縦にも動く）。
 * **選んでいないときも同じ大きさの場所を空けておく**＝押しても1pxも動かない。
 */
const ChipCheck = ({ on }: { on: boolean }) => (
  <Check size={14} className={`shrink-0 ${on ? '' : 'invisible'}`} aria-hidden />
)
/**
 * 「栄養から組む」のプルダウンの中に並べる名前（2026-08-19 便ID・⑤）。
 *
 * オーナー原文「栄養から組むの選択肢は、多めとひかえめでグループ分けされている→個別に
 * 『〇〇多め』『〇〇ひかえめ』とついているとくどく感じる。しかし、『提案の条件：〇〇』に
 * 入れる場合は『〇〇多め』の方が見やすい。両立できない？」。
 *
 * **表示名を2つ持てば両立する**。プルダウンの中は「多め」「ひかえめ」の区分（optgroup）の下に
 * 並ぶので項目名だけでよく（こちら）、条件のボタンに出す要約は区分から離れて1つで読まれるので
 * 「たんぱく質多め」のまま（上の PURPOSE_LABEL）。内部キーも提案の効き方も変えていない。
 * 2つがずれると「選んだ名前と要約の名前が別物」になるので、
 * scripts/test-logic.mjs の ID-5 が「選択肢名＋区分名＝要約の名前」で結んで見張る。
 */
const PURPOSE_OPTION_LABEL: Record<MealPurpose, string> = {
  protein: ja.mealPlan.purposeOption.protein,
  fiber: ja.mealPlan.purposeOption.fiber,
  iron: ja.mealPlan.purposeOption.iron,
  calcium: ja.mealPlan.purposeOption.calcium,
  lowEnergy: ja.mealPlan.purposeOption.lowEnergy,
  lowFat: ja.mealPlan.purposeOption.lowFat,
  lowCarb: ja.mealPlan.purposeOption.lowCarb,
  lowSalt: ja.mealPlan.purposeOption.lowSalt,
}
const purposeOptionLabelOf = (purpose: MealPurpose): string => PURPOSE_OPTION_LABEL[purpose]

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
/* レシピを選ぶ画面の手間レベルも、レシピ一覧と同じ顔ぶれにする（2026-08-23 便JP・②追補）。
   選べる手間は logic/effort.ts の EFFORT_FILTER_LEVELS が1か所で決める */
const PICKER_EFFORT_OPTIONS: { value: EffortFilter; label: string }[] = [
  { value: 'all', label: ja.search.effortAll },
  ...EFFORT_FILTER_LEVELS.map((level) => ({ value: level, label: ja.effort[level] })),
]
const pickerChipCls = (active: boolean) =>
  `rounded-sm border px-3 py-1.5 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

/** 月カレンダーのセルに出す情報の切り替え(2026-07-28 便CA・タスク2・オーナー指示)。既定は写真 */
const MONTH_CELL_MODES: { value: MonthCellMode; label: string }[] = [
  { value: 'photo', label: ja.mealPlan.monthCellModePhoto },
  { value: 'nutrition', label: ja.mealPlan.monthCellModeNutrition },
  { value: 'cost', label: ja.mealPlan.monthCellModeCost },
]

/**
 * 「どの日をどちらの基準で数えたか」の1行（便CA・規則2）。
 * 過去日=作った記録・未来日=登録した献立で、混在する期間は両方の範囲を出す。
 * 期間の集計カードと月間サマリー(便CB-1・B-3)で同じ文言を使う。
 *
 * 2026-08-08 便EA（オーナー指摘）: 今日は「作った分は記録・まだの分は献立」で数えるように直したので、
 * 今日を含む期間ではその1文を必ず添える（従来は今日が予定側に丸ごと入った文面のままだった）。
 */
const intakeBasisText = (summary: RangeIntakeSummary): string => {
  const { past, future, includesToday } = summary.basis
  const lines: string[] = []
  if (past && future) {
    lines.push(
      ja.mealPlan.rangeBasisBoth
        .replace('{ps}', formatMonthDay(past.start))
        .replace('{pe}', formatMonthDay(past.end))
        .replace('{fs}', formatMonthDay(future.start))
        .replace('{fe}', formatMonthDay(future.end)),
    )
  } else if (past) {
    lines.push(
      includesToday
        ? ja.mealPlan.rangeBasisPastRange
            .replace('{ps}', formatMonthDay(past.start))
            .replace('{pe}', formatMonthDay(past.end))
        : ja.mealPlan.rangeBasisActualOnly,
    )
  } else if (future) {
    lines.push(
      includesToday
        ? ja.mealPlan.rangeBasisFutureRange
            .replace('{fs}', formatMonthDay(future.start))
            .replace('{fe}', formatMonthDay(future.end))
        : ja.mealPlan.rangeBasisPlanOnly,
    )
  }
  if (includesToday) lines.push(ja.mealPlan.rangeBasisToday)
  return lines.join('。')
}

/** 未解錠プレビューのサンプルカレンダー(便BS・タスク6)。実データではなく雰囲気を伝えるための飾り。
 * 先頭を2つ空け、写真枠(accentの淡色ブロック)と予定ドットを散らして「写真の残る月間献立」を示す */
const LOCK_SAMPLE_BLANKS = 2
const LOCK_SAMPLE_TODAY_DAY = 15
const LOCK_SAMPLE_PHOTO_DAYS = new Set([3, 6, 10, 13, 15, 19, 22, 27])
const LOCK_SAMPLE_PLAN_DAYS = new Set([2, 8, 16, 20, 24, 29])

/**
 * 時間帯（朝食/昼食/夕食）ごとの区分色（2026-08-02 便CW-1・オーナー実機フィードバック:
 * 1日のブロックの中で朝・昼・夕の切り替わりが分からない）。
 * 値は src/index.css のデザイントークン（テーマごとに --accent / --surface から作られる）。
 * bar=ブロック左の帯・bg=ブロックの地色。色の濃さだけで区別し、新しい色相は増やさない。
 * lockedBg=ロック中（2026-08-08 便DX）の地色。bgのアクセント混合比を半分にした薄い面で、
 * 「自動では触らない食事」を鍵アイコンに加えて面でも示す。
 */
const SLOT_TONE: Record<MealSlot, { bar: string; bg: string; lockedBg: string }> = {
  breakfast: {
    bar: 'var(--slot-bar-breakfast)',
    bg: 'var(--slot-bg-breakfast)',
    lockedBg: 'var(--slot-bg-locked-breakfast)',
  },
  lunch: {
    bar: 'var(--slot-bar-lunch)',
    bg: 'var(--slot-bg-lunch)',
    lockedBg: 'var(--slot-bg-locked-lunch)',
  },
  dinner: {
    bar: 'var(--slot-bar-dinner)',
    bg: 'var(--slot-bg-dinner)',
    lockedBg: 'var(--slot-bg-locked-dinner)',
  },
}

/** 献立の1枠内の1行分（主菜/副菜の実データ行、または未割り当てのプレースホルダー行） */
type MealPlanRow =
  | { kind: 'entry'; entry: MealPlanEntry }
  | {
      kind: 'empty'
      removable: boolean
      extraLocalId?: string
      /** 主菜/副菜が1品も入っていないときに既定で出る空欄行（「＋料理を追加」で増やした行と区別する） */
      isDefault?: boolean
    }

/** ある日×枠の役割(主菜/副菜/汁物/その他)ごとに表示する行を組み立てる。
 * 実データが1件もない役割は「未定」の行を1つ表示し、+ボタンで増やした分を後ろに続ける。
 *
 * 2026-08-02 便CW-2: その既定の空欄行も×で畳めるようにした（hiddenRoles に入っている役割は
 * 空欄行を出さない）。戻すのは「＋料理を追加」→主菜/副菜 の既存の入口（addOrRestoreRow）。
 *
 * 2026-08-02 便DE-4: 汁物・その他を足した。**空欄行を既定で出すのは主菜と副菜だけ**にする
 * （4つとも空欄行を出すと、1日の1食に空行が4本並んで週タブが読めなくなる）。
 * 汁物・その他は、料理が入っているか「＋料理を追加」で足したときだけ行が出る。 */
function buildRoleRows(
  slotEntries: MealPlanEntry[],
  role: MealRole,
  extra: ExtraRow[],
  hiddenRoles: MealRole[],
): MealPlanRow[] {
  const roleEntries = slotEntries.filter((e) => (e.role ?? 'main') === role)
  const rows: MealPlanRow[] = roleEntries.map((entry) => ({ kind: 'entry', entry }))
  const showsDefaultEmptyRow = role === 'main' || role === 'side'
  if (showsDefaultEmptyRow && roleEntries.length === 0 && !hiddenRoles.includes(role)) {
    rows.push({ kind: 'empty', removable: true, isDefault: true })
  }
  extra
    .filter((x) => x.role === role)
    .forEach((x) => {
      rows.push({ kind: 'empty', removable: true, extraLocalId: x.localId })
    })
  return rows
}

/**
 * 献立タブ: 「日」「週」「月」の3タブでレシピを割り当てる（2026-07-16 便U再構成）。
 *
 * demo を渡すと「月間画面のサンプルデモ」になる（2026-08-02 便DC・pages/MonthDemoPage.tsx）。
 * デモ用の作り物の画面を別に作るのではなく、この本物の画面にサンプル1か月分を流し込む
 * （＝実物と食い違わない）。デモのときは次の3つだけが変わる:
 *   1. データの出どころが IndexedDB ではなく渡された見本データになる（読み込みも書き込みもしない）
 *   2. 月タブ固定で開き、Pro のゲートはデモの中だけ開く（端末に保存している解錠状態は読まないし変えない）
 *   3. 予定を書き換える操作（まとめて提案・テンプレの流し込み・日の窓での追加/変更・メモの保存）は出さない
 *      ＝サンプルは見て確かめるためのもので、書き込み先が無い
 */
export default function MealPlanPage({ demo }: { demo?: MonthDemoData }) {
  // 状態と手続きは src/pages/mealPlan/useMealPlanState.ts にある（2026-08-27 便LQ・docs/74 第4手）。
  // 名前は取り出す前と同じ。ここに残したのは render* 関数と JSX だけ。
  const {
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
    fillTargetSlots, sheetTargetSlots, toggleFillSlot, toggleSheetSlot,
    weekFillTargetSlots, toggleWeekFillSlot,
    monthPlanSheet, savePlanSheetImage, servingsEditor, setServingsEditor, submitServings,
    setDayFoldOverrides, weekEditDate, setWeekEditDate, datesWithPlan, isDayFolded,
    setAllDaysFolded, allDaysCollapsed, allDaysLocked, rememberWeekReturn, rememberMonthReturn,
    rememberDayReturn, logDetailLinkState, rememberLogDetailReturn, proGateDetour, historyToastActive,
    openHistoryFromToast, weekGroupOpen, setWeekGroupOpen, fillMode, setFillMode, clearSlotTargets,
    nutritionPanelOpen, nutritionPanelName, setNutritionPanelExpanded,
    toggleClearSlotTarget, clearSlotLabel, clearWeekSlot, includeRice, weekCostEstimate, riceYen,
    riceCostServings, weekCost, weekMealCount, weekPricelessCount, weekBalanceByDate, weekBalance,
    weekSlotBalanceByDate, weeklyBudget, budgetDiff, hasPricedRecipe, shopSelectableDates,
    shopRangeNarrowed, shopRangeDates, shopRangeSlots, toggleShopDate, toggleShopSlot,
    resetShopRange, weekRecipeIds, goShopping, dowLabels, conditionsSummary,
  } = useMealPlanState(demo)

  /**
   * 「計算できなかった料理」の名前から開いたレシピ詳細の帰り道（2026-08-28 便MA）。
   *
   * オーナー原文「選んだ期間の栄養など、計算できなかった材料があるレシピ名をタップした後の
   * レシピ詳細から、戻るで同じ画面に戻るようにして。レシピ一覧に飛んでしまう。」。
   * 献立の中の他のレシピへの入口（曜日カード・日の窓・記録の小窓）がすでに使っている
   * 2つ（見ていたタブへ帰す出所 logDetailLinkState ／ 押した瞬間に居場所を覚える
   * rememberLogDetailReturn）を、そのまま栄養のパネルにも渡す＝新しい仕組みを増やさない。
   */
  const gapDishLink = {
    linkState: logDetailLinkState,
    onNavigate: rememberLogDetailReturn,
  }

  /**
   * 献立表の折りたたみ（週タブ・月タブで同じものを使う）。開いている間だけ .plan-sheet が
   * 画面とDOMに存在し、その状態で「印刷する」を押す＝紙に出るのは必ず今見えている1枚になる。
   *
   * 2026-08-26 便LH: 置き場所が月タブだけになったので、面の見た目を呼び出し側から
   * 差し替える引数（旧 surfaceCls・2026-08-03 便DP-8で週タブ用に足したもの）は落とした。
   */
  const renderPlanSheetSection = (sheet: PlanSheet) => (
    <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface shadow-sm">
      <button
        type="button"
        onClick={() => setPlanSheetOpen((v) => !v)}
        aria-expanded={planSheetOpen}
        className="flex w-full items-center justify-between gap-2 p-[var(--space-md)] text-left"
      >
        <span className="font-bold">{ja.mealPlan.planSheetTitle}</span>
        {planSheetOpen ? (
          <ChevronUp size={18} className="shrink-0 text-accent-ink" aria-hidden />
        ) : (
          <ChevronDown size={18} className="shrink-0 text-accent-ink" aria-hidden />
        )}
      </button>
      <Collapse open={planSheetOpen}>
        <div className="px-[var(--space-md)] pb-[var(--space-md)]">
          <p className="text-xs text-ink-muted">{ja.mealPlan.planSheetHint}</p>
          {/* 載せる食事（2026-08-28 便MD）。押さなければ表示する食事ぜんぶ＝今までと同じ1枚。
              **白紙のときも必ず出す**＝絞ったせいで空になった人が、同じ場所で絞りを戻せる
              （中身のある側にだけ置くと、空にした瞬間にチップごと消えて行き止まりになる） */}
          {renderSlotPicker(
            ja.mealPlan.sheetSlotPickLabel,
            ja.mealPlan.sheetSlotPickAria,
            'plan-sheet-slot',
            sheetTargetSlots,
            toggleSheetSlot,
          )}
          {sheet.isEmpty ? (
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
              {/* 絞って空になったのか、そもそも何も無いのかで案内を分ける（戻せることが伝わるように） */}
              {sheetTargetSlots.length < visibleSlots.length
                ? ja.mealPlan.planSheetEmptyPicked
                : ja.mealPlan.planSheetEmpty}
            </p>
          ) : (
            <>
              <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1 rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                >
                  <Printer size={14} aria-hidden />
                  {ja.mealPlan.planSheetPrint}
                </button>
                <button
                  type="button"
                  onClick={() => void savePlanSheetImage(sheet)}
                  className="inline-flex items-center gap-1 rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                >
                  <ImageDown size={14} aria-hidden />
                  {ja.mealPlan.planSheetImage}
                </button>
              </div>
              {/* 登録のない日の扱い(2026-08-02 オーナー指示)。既定は省き、
                  1か月の抜けも一覧したいときだけチェックで戻す */}
              <label className="mt-[var(--space-sm)] flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid="plan-sheet-include-empty"
                  checked={planSheetIncludeEmptyDays}
                  onChange={(e) => setPlanSheetIncludeEmptyDays(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span>{ja.mealPlan.planSheetIncludeEmptyDays}</span>
              </label>
              {/* 画面のプレビュー。長い月の表が画面を占領しないよう高さを抑える */}
              <div className="mt-[var(--space-sm)] max-h-[60vh] overflow-x-hidden overflow-y-auto overscroll-contain">
                <div className="plan-sheet-preview rounded-sm border border-edge bg-app p-[var(--space-md)]">
                  <PlanSheetView sheet={sheet} />
                </div>
              </div>
              {/* 印刷用の1枚。body直下へ出す（＝印刷時にアプリ本体をまるごと消せるので、
                  献立表のあとに真っ白なページが続かない。詳細は index.css の @media print） */}
              {createPortal(
                <div className="plan-sheet-print">
                  <PlanSheetView sheet={sheet} />
                </div>,
                document.body,
              )}
            </>
          )}
        </div>
      </Collapse>
    </section>
  )

  /**
   * 「この週の買い物リストを作る」の範囲えらび（2026-08-08 便EA）。
   * 既定は閉じていて、開かなければ従来どおり表示中の週ぜんぶから作る。
   * チップの見た目は「表示する食事」のボタン（renderSlotFilter）と同じ作法にそろえる。
   */
  /**
   * いま買い物メモの対象になっている範囲の要約（2026-08-25 便KU）。
   * 「買い物メモ」の節を畳んでいても、見出しの横に出したままにする
   * ＝開かなくても、いま何を対象にしているかが読める。
   */
  const renderShopRangeSummary = () => (
    <span className="min-w-0 truncate text-xs text-ink-muted" data-testid="shop-range-summary">
      {shopRangeNarrowed
        ? ja.mealPlan.shopRangeSummaryPicked
            .replace('{dates}', formatShoppingRangeDates(shopRangeDates))
            .replace('{slots}', shopRangeSlots.map((s) => ja.mealPlan.slot[s]).join('・'))
        : ja.mealPlan.shopRangeSummaryAll}
    </span>
  )
  /**
   * 買い物メモの範囲えらびの中身（2026-08-08 便EA）。
   * 2026-08-25 便KU: 自前の開閉ボタンをやめ、「買い物メモ」の節の折りたたみに乗せた。
   * `<Collapse>` はこの中に置いたままにする＝「畳むと消える範囲」を
   * scripts/test-logic.mjs の COLLAPSE-1 が規則で掃けるようにするため
   * （呼び出し側で包むと、掃く側から中身が Collapse の外に見える）。
   */
  const renderShopRange = () => (
    <Collapse open={weekGroupOpen.shopping}>
        <div className="mt-[var(--space-sm)]">
          <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.shopRangeToggle}</p>
          <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.shopRangeNote}</p>
          <p className="mt-[var(--space-sm)] text-xs font-bold text-ink-muted">
            {ja.mealPlan.shopRangeDateLabel}
          </p>
          <div
            role="group"
            aria-label={ja.mealPlan.shopRangeDateAria}
            className="mt-1 flex flex-wrap gap-1"
          >
            {shopSelectableDates.map((date) => {
              const picked = shopRangeDates.includes(date)
              return (
                <button
                  key={date}
                  type="button"
                  data-testid="shop-range-date"
                  data-date={date}
                  onClick={() => toggleShopDate(date)}
                  aria-pressed={picked}
                  className={`rounded-sm border px-2 py-2 text-xs font-bold ${
                    picked
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {dowLabels[dowIndex(date)]} {formatShoppingRangeDates([date])}
                </button>
              )
            })}
          </div>
          {shopRangeDates.length === 0 && (
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.shopRangeEmptyDates}</p>
          )}
          <p className="mt-[var(--space-sm)] text-xs font-bold text-ink-muted">
            {ja.mealPlan.shopRangeSlotLabel}
          </p>
          <div
            role="group"
            aria-label={ja.mealPlan.shopRangeSlotAria}
            className="mt-1 flex flex-wrap gap-1"
          >
            {visibleSlots.map((slot) => {
              const picked = shopRangeSlots.includes(slot)
              return (
                <button
                  key={slot}
                  type="button"
                  data-testid="shop-range-slot"
                  data-slot={slot}
                  onClick={() => toggleShopSlot(slot)}
                  aria-pressed={picked}
                  className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                    picked
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {ja.mealPlan.slot[slot]}
                </button>
              )
            })}
          </div>
          {shopRangeSlots.length === 0 && (
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.shopRangeEmptySlots}</p>
          )}
          {shopRangeNarrowed && (
            <button
              type="button"
              onClick={resetShopRange}
              className="mt-[var(--space-sm)] rounded-sm border border-edge bg-surface px-3 py-2 text-xs font-bold text-accent-ink shadow-sm"
            >
              {ja.mealPlan.shopRangeReset}
            </button>
          )}
        </div>
    </Collapse>
  )

  /**
   * 1行分のUI（役割ラベル＋レシピ名ボタン＋サイコロ＋×）。
   * 2026-08-08 便EA: 鍵が掛かっている食事では、行の操作（食数・差し替え・サイコロ・×）を
   * 押せない見た目にする。理由は枠の下の1行（lockedSlotNote）で言う。
   */
  const renderRow = (
    date: string,
    slot: MealSlot,
    role: MealRole,
    row: MealPlanRow,
    key: string,
    locked = false,
  ) => {
    const recipe = row.kind === 'entry' ? recipeById.get(row.entry.recipeId) : undefined
    const entryId = row.kind === 'entry' ? row.entry.id : undefined
    const extraLocalId = row.kind === 'empty' ? row.extraLocalId : undefined
    const showRemove = row.kind === 'entry' || row.removable
    const isEmpty = !recipe
    // 「作った見た目」対応付け(タスク2): この枠が「作った記録」に対応していれば作った見た目に変える
    const isCooked = entryId != null && cookedPlanEntryIdSet.has(entryId)
    // 食数(何人分作るか。2026-08-03 便DJ)。枠に決めていなければ設定「ふだん作る人数」、
    // それも無ければレシピの登録人数分(便DK。優先順位は logic/servings.ts に集約)
    const rowServings = effectiveMealServings(
      row.kind === 'entry' ? row.entry.servings : undefined,
      householdServings,
      recipe?.servings,
    )
    // 作った！済みの枠に対応する記録(2026-08-09 便EQ)。あれば行の下に記録への入口を出す
    const cookedLogRow = isCooked ? cookedLogForEntry(date, recipe?.id) : undefined
    return (
      // data-date / data-slot / data-role: 検査用（この行が「いつの・どの食事の・どの役割」の行か）。
      // 2026-08-11 便FP で「今日の献立に追加」から入れた品が全部主菜の行になっていた不具合を直したので、
      // その再発を機械で見張る。2026-08-19 便IA で日付と食事も足した＝週・月には同じ形の行が
      // 何十個も並ぶので、**並び順ではなく「いつのどの枠か」で掴める**ようにするため
      // （並びが変わると落ちる掴み方を作らない）
      /* 2026-08-23 便JQ（オーナー原文「編集の主菜や◯人分、削除などの列が、どのレシピについて
         いるのかわからない。上下のレシピで距離が同じ」）: 1品ぶん（料理カードの段＋操作の段）を
         **1つの囲み**に入れる。便IZ が操作を2段目へ移したとき、1品の中も品と品の間も同じ12pxに
         してしまい、操作の段が上の品のものか下の品のものかを**距離から読めなくした**。
         囲みの線は --border-card（border-edge-card）＝便JE が濃くした線をそのまま使う。

         **料理名の幅は1pxも削っていない**（司令部の指示）。囲みを普通に足すと内側の余白と線のぶん
         カードが細るので、**囲みの余白（4px）と線（1px）を、この段を包む枠（slot-block）の
         余白8pxから借りる**（下の -mx-[5px]）。結果、カードの左右の位置は直す前と同じままで、
         囲みだけが外側へ出る＝390pxでの料理名の幅は251pxのまま変わらない。 */
      <div
        key={key}
        data-testid="plan-row"
        data-date={date}
        data-slot={slot}
        data-role={role}
        className="rounded-card border border-edge-card p-1"
      >
      {/* 2026-08-22 便IZ: 1行を**2段**にした（1段目＝料理カード・2段目＝この1品への操作）。
          直す前は 役割の列(40px)＋カード＋サイコロ(34px)＋×(34px) が同じ横1行に並んでおり、
          料理名に残る幅は **390pxで119px＝7文字**（320pxでは49px＝3文字。「肉じゃが」すら切れる）だった。
          これはオーナーが最初に挙げた困りごと（「「豆腐ときの…」「レンジ蒸し…」「鶏胸肉の…」だと
          なんなのかわからない」）そのもので、便IVは通常表示（251px＝15文字）だけを直し、
          **編集モードには直す前の数字がそのまま残っていた**。
          編集モードは「気になるところのレシピを変更する」ための画面なので、
          どの料理を差し替えようとしているのかが読めないと用をなさない。
          カードを行の幅いっぱいにして通常表示と同じ読みやすさに戻し、操作は下の段へ移した
          （＝料理名の幅を削って操作を置く、をやめた）。
          あわせて、同じ段に押しにくさが集まっていたのも解いた（実測: サイコロ34px角・
          食数27×15px・「レシピを見る」高さ16px、サイコロと×の間隔3px＝押し間違える）。
          この段の押せるものは 44px（--tap-min）以上・間隔12px以上で並べる */}
      {isEmpty ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
            // 2026-08-02 便DE-6(オーナー指示): 入っている行と空いている行の見分けをさらに強くする。
            // 色（面を塗る／塗らない）・文字サイズ（16px／12px）・密度（高い行／低い行）の3つで差を付ける。
            // 空き行の「押せる」見た目（破線＋Plusアイコン＋アクセント色。便BH-3タスク5）は維持し、
            // 食事ごとの地色（SLOT_TONE・便CW-1）にも手を入れない
            /* 2026-08-22 便JE: 空いている行は、埋まっている行のレシピカード（小）と
               同じ並びに出るので、角丸も同じ --radius-card にそろえる */
            className="flex min-h-11 w-full min-w-0 items-center gap-1 truncate rounded-card border border-dashed border-accent/40 px-2 py-1.5 text-left text-xs font-bold text-accent-ink"
          >
            <Plus size={16} className="shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{ja.mealPlan.emptyAssign}</span>
          </button>
        ) : (
          /* 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）: 自前で組んでいた
             「サムネ＋バッジ＋料理名」の行をやめ、共通のレシピカードの「小」に寄せた。
             押すと従来どおりレシピを選び直す（枠の押下の役割は変えていない・便DP-5の司令部裁定）。
             作った記録が付いた枠の淡い表示（muted）と「作った」バッジ、NG食材の印、
             鍵の掛かった食事で押せなくなること（disabled）も、そのままカード側の口で表す */
          <div className="min-w-0 w-full">
            {/* 2026-08-25 便KU（オーナー原文「編集画面、ここだけレシピカードをタップで
                レシピ詳細に行かない。他はレシピカードから必ずレシピ詳細に行くので
                揃えるべきでは。「レシピを見る」→「レシピを変更」」）:
                編集モードでも**カードの押下はレシピ詳細**にした。アプリの他のレシピカード
                （通常表示の週・月、レシピ一覧、買い物メモの窓、作った記録）はすべて
                押すとレシピ詳細なので、ここだけ別の行き先だった。
                差し替えは下の段の「レシピを変更」が受け持つ（便DP-5の裁定＝
                「間違えて記録した枠を選び直せなくなる方が害が大きい」は、差し替えの口を
                同じ行に残すことで満たしている。無くしたのではなく名前の付いたボタンに移した）。
                鍵が掛かっていてもレシピを読むことは止めない＝止めるのは変更と削除
                （通常表示のカードも鍵に関わらずレシピ詳細へ行く。モードで振る舞いを変えない） */}
            <RecipeCard
              recipe={recipe!}
              density="small"
              place="planSlot"
              muted={isCooked}
              linkState={logDetailLinkState}
              onNavigate={rememberLogDetailReturn}
              ngIngredients={settings?.ngIngredients ?? []}
              thumbTestId="row-thumb"
              // 検査用の目印(2026-08-19 便HX)。鍵を掛けたときにこのカード=料理名の差し替えが
              // 押せなくなることを機械で見張る。以前はクラス名(flex-1)で拾っていたが、
              // それは自前で組んでいた行の内部の書き方で、共通カードに寄せた時点で当たらなくなった
              testId="row-recipe"
              titleTestId="row-title"
              titleBadges={
                isCooked ? (
                  // 2026-08-03 便DP-5(オーナー「予定と記録がわかりづらい」): 面と文字を落としたうえで
                  // 「作った」バッジで言い切る
                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink">
                    <CheckCircle2 size={11} aria-hidden />
                    {ja.mealPlan.cookedEntryBadge}
                  </span>
                ) : undefined
              }
            />
          </div>
        )}
      {/* 2段目＝この1品への操作（2026-08-22 便IZ）。
          並びは「何の枠か（役割）→ 何人分 → レシピを見る／記録を見る → （右へ）引き直し・外す」。
          手を離せない操作（引き直し・外す）を右端にまとめるのは、日タブの整理モードで
          「作った！」と×を右へ寄せた作法（2026-08-21 便IU・②）と同じ。
          間隔は 12px（gap-3）で揃える＝押し間違いが起きる近さ（直す前はサイコロと×が3px）を作らない。
          入り切らない画面（320px）では折り返すので、縦の間隔も同じ12pxにしてある */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold text-ink-muted">{ja.mealPlan.role[role]}</span>
        {row.kind === 'entry' && recipe && (
          <button
            type="button"
            onClick={() =>
              setServingsEditor({
                entryId: row.entry.id!,
                date,
                slot,
                title: recipe.title,
                recipeServings: recipe.servings > 0 ? recipe.servings : 1,
                defaultServings: defaultMealServings(householdServings, recipe.servings),
                value: rowServings,
                isCustom: row.entry.servings != null,
              })
            }
            disabled={locked}
            aria-label={ja.mealPlan.servingsEditAria.replace('{n}', String(rowServings))}
            /* 直す前は 27×15px（役割ラベルの下に潜り込ませた10pxの字）で、指では狙えなかった */
            className={`inline-flex min-h-11 items-center rounded-sm px-2 text-xs font-bold text-accent-ink underline ${
              locked ? 'opacity-40' : ''
            }`}
          >
            {ja.mealPlan.servingsChip.replace('{n}', String(rowServings))}
          </button>
        )}
        {/* この枠を別のレシピに差し替える入口（2026-08-25 便KU）。
            直す前はここが「レシピを見る」で、差し替えは**カードの押下**に割り当たっていた。
            オーナー指示でカードの押下をレシピ詳細にそろえたので、差し替えを名前の付いた
            ボタンにしてこの段へ置く（操作の段の並びは変えていない）。
            鍵の掛かった食事では押せなくする＝止め方は同じ段の×・食数とまったく同じ */}
        {recipe?.id != null && (
          <button
            type="button"
            data-testid="slot-change-recipe"
            onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
            disabled={locked}
            aria-label={ja.mealPlan.changeRecipeAria.replace('{title}', recipe.title)}
            className={`inline-flex min-h-11 items-center gap-0.5 text-xs font-bold text-accent-ink underline ${
              locked ? 'opacity-40' : ''
            }`}
          >
            {ja.mealPlan.changeRecipe}
            <ChevronRight size={14} aria-hidden />
          </button>
        )}
        {/* 作った！済みで薄くなっている枠から、その記録の中身を開く(2026-08-09 便EQ・オーナー実機
            「作った！して表示が薄くなっているレシピをタップ→記録を見たい」)。
            開く小窓は他の3か所と同じもの */}
        {cookedLogRow && (
          <button
            type="button"
            onClick={() =>
              setLogDetail({
                recipe: cookedLogRow.recipe,
                log: cookedLogRow.log,
                logIndex: cookedLogRow.logIndex,
              })
            }
            aria-label={ja.cookedDetail.openAria.replace('{title}', cookedLogRow.recipe.title)}
            className="inline-flex min-h-11 items-center gap-0.5 text-xs font-bold text-accent-ink underline"
          >
            {ja.cookedDetail.openFromPlan}
            <ChevronRight size={14} aria-hidden />
          </button>
        )}
        <span className="ml-auto flex items-center gap-3">
          {/* 過去日(今日より前)・作った記録のある枠はサイコロ非表示(2026-07-16 便W-⑤a: ランダム提案の
              対象外。過去/作った献立は振り返る対象であり、上書きも新規埋めもしない) */}
          {!isPastDate(date, today) && !isCooked && !locked && (
            <button
              type="button"
              onClick={() => void suggestRow(date, slot, role, entryId, extraLocalId)}
              aria-label={ja.mealPlan.suggestAria}
              /* 直す前は p-2 だけの34px角。同じ役目の×には器(.tap-target)が着いていたのに
                 こちらだけ素通りしていた＝片方だけ直した跡（便HQ-3が測るのはXとチェックの丸だけ） */
              className="tap-target flex h-11 w-11 items-center justify-center rounded-full text-accent-ink"
            >
              <Dices size={18} aria-hidden />
            </button>
          )}
          {showRemove && (
            <button
              type="button"
              onClick={() => void clearRow(date, slot, role, entryId, extraLocalId)}
              aria-label={
                row.kind === 'entry'
                  ? ja.mealPlan.clear
                  : row.isDefault
                    ? // 2026-08-02 便CW-2: 既定の空欄行を畳む×。何が起きるかを読み上げでも言い分ける
                      ja.mealPlan.hideEmptyRow.replace('{role}', ja.mealPlan.role[role])
                    : ja.mealPlan.removeExtraRow
              }
              disabled={locked}
              className={`tap-target flex h-11 w-11 items-center justify-center rounded-full text-ink-muted ${
                locked ? 'opacity-40' : ''
              }`}
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </span>
      </div>
      </div>
    )
  }

  /**
   * 1日×1つの食事帯の**通常表示**（2026-08-22 便IV）。週タブの曜日カードだけで使う。
   *
   * オーナー原文:
   *   「週のレシピカードが小さすぎてレシピ名で表示できる字数が少なぎる。
   *     「豆腐ときの…」「レンジ蒸し…」「鶏胸肉の…」だとなんなのかわからない。
   *     週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ
   *     （タップでレシピ詳細画面につながる）。」
   *
   * 出すのは**入っている品だけ**（空き枠は出さない）。1品につき絵と料理名だけのカードで、
   * 押すとレシピ詳細へ移る。役割（主菜/副菜）・人数・「主菜と別ジャンル」の印・引き直し・
   * 外す・追加・「レシピを見る」は、この表示には出さず**編集モード（renderSlotEditor）へ移した**。
   * 直す前は同じ1行に 役割の列(40px)＋カード＋サイコロ(34px)＋×(34px) が並び、料理名に
   * 残る幅は390px幅の実測で119px＝7文字しか読めなかった（オーナーが挙げた「豆腐ときの…」）。
   *
   * **例外は鍵の印だけ**（司令部裁定）。鍵の掛かった食事は「まとめて献立を入力」で
   * 書き換わらないので、掛けたことが通常表示から読めないと、動かない理由が分からなくなる。
   * 印は場所を取らない小さなものにして、料理名の幅は削らない。
   *
   * 空でも鍵が掛かっている食事は枠ごと出す（同じ理由＝自動で埋まらない理由が読めるように）。
   * それ以外の空の食事は、枠ごと出さない。
   */
  const renderSlotView = (date: string, slot: MealSlot) => {
    const slotKey = `${date}|${slot}`
    const rows = planViewRows(entriesByDateSlotAll.get(slotKey) ?? [])
    const slotLocked = isMealSlotLocked(lockedKeys, date, slot)
    if (rows.length === 0 && !slotLocked) return null
    return (
      <div
        key={slot}
        data-testid="slot-block"
        data-slot={slot}
        data-locked={slotLocked ? 'true' : undefined}
        // 囲み・地色・左の帯は編集モードとまったく同じ（便CW-1のSLOT_TONE）。
        // モードを切り替えても、どの食事の枠かの見分け方が変わらないようにする。
        // 2026-08-22 便JE（オーナー指示「外側の『夕食』などのカードも同様に」）:
        // 外側の曜日カードと同じ --radius-card にそろえる＝外より中のほうが丸い状態を作らない
        // 2026-08-25 便KU: 囲みの線を --border-card にした（理由は renderSlotEditor 側に）
        className="rounded-card border border-l-4 p-[var(--space-sm)]"
        style={{
          background: slotLocked ? SLOT_TONE[slot].lockedBg : SLOT_TONE[slot].bg,
          borderColor: slotLocked ? 'var(--accent)' : 'var(--border-card)',
          borderLeftColor: SLOT_TONE[slot].bar,
        }}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
          {slotLocked && (
            <span
              data-testid="slot-lock-mark"
              data-date={date}
              data-slot={slot}
              role="img"
              aria-label={ja.mealPlan.lockedSlotNote}
              /* 掛かっている鍵は塗りつぶし（便ENの作法をそのまま。押せる鍵は編集モードに在る） */
              className="ml-auto inline-flex shrink-0 items-center rounded-full bg-accent p-1 text-on-accent shadow-sm"
            >
              <Lock size={14} aria-hidden />
            </span>
          )}
        </div>
        <ul className="mt-1 space-y-1">
          {rows.map((entry) => {
            const recipe = recipeById.get(entry.recipeId)
            if (!recipe) return null
            const isCooked = entry.id != null && cookedPlanEntryIdSet.has(entry.id)
            return (
              <li
                key={entry.id}
                // 検査用の目印は編集モードと同じ（この行が「いつの・どの食事の・どの役割」か）。
                // モードで目印が変わると、同じことを見ている検査が2通りの掴み方を持つことになる
                data-testid="plan-row"
                data-date={date}
                data-slot={slot}
                data-role={entry.role ?? 'main'}
              >
                <RecipeCard
                  recipe={recipe}
                  density="small"
                  place="planSlot"
                  // 作り終えた品は淡い表示にする（便DP-5の「面と文字を落とす」側だけを残した。
                  // 「作った」バッジは幅を実測62px使い、料理名が4文字ぶん削れるので通常表示では出さない）
                  muted={isCooked}
                  // 押すとレシピ詳細へ（オーナー原文「タップでレシピ詳細画面につながる」）。
                  // 戻ったときに同じ週・同じ縦位置へ帰すのは「レシピを見る」と同じ仕組み
                  linkState={logDetailLinkState}
                  onNavigate={rememberLogDetailReturn}
                  ngIngredients={settings?.ngIngredients ?? []}
                  testId="row-recipe"
                  titleTestId="row-title"
                  thumbTestId="row-thumb"
                />
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  /**
   * 1日×1つの食事帯（例: 7/30の夕食）の編集ブロック（食事帯ラベル＋主菜/副菜の行＋「＋料理を追加」）。
   * 2026-07-29 便CB-1・docs/59 A-3で、週タブの各日カードから切り出して月タブの日モーダルと
   * 共用できるようにした（月から週へ飛ばずに、その場で 枠追加/差し替え/削除 が完結する）。
   * 参照する献立は週+月の合算（entriesByDateSlotAll）なので、表示中の週の外の日でも同じに動く。
   */
  const renderSlotEditor = (date: string, slot: MealSlot) => {
    const slotKey = `${date}|${slot}`
    const slotEntries = entriesByDateSlotAll.get(slotKey) ?? []
    const extra = extraRows[slotKey] ?? []
    const hiddenRoles = hiddenDefaultRows[slotKey] ?? []
    // 2026-08-02 便DE-4: 主菜・副菜に汁物・その他を足した4区分(レシピ登録の「料理の種別」と同じ)。
    // 空欄行を既定で出すのは主菜・副菜だけ(buildRoleRows)なので、行が4本並ぶのは自分で足したときだけ
    const roleRows = MEAL_ROLES.map(
      (role) => [role, buildRoleRows(slotEntries, role, extra, hiddenRoles)] as const,
    )
    const isAddMenuOpen = addMenuFor === slotKey
    // ジャンル混在の控えめ表示(便BH-2・docs/56 §3-10): 主菜のジャンルに対して
    // 副菜が別ジャンルのとき「ジャンル混在」バッジを出す(揃っている枠は無表示)
    const slotMainRecipe = slotEntries
      .filter((e) => (e.role ?? 'main') === 'main')
      .map((e) => recipeById.get(e.recipeId))
      .find((r): r is Recipe => !!r)
    // 主菜以外の品（副菜・汁物・その他）をまとめて見る＝ジャンル混在の判定と
    // 「一品ものの日は副菜が空く」の説明の対象を、区分を足しても取りこぼさない
    const slotSideRecipes = slotEntries
      .filter((e) => (e.role ?? 'main') !== 'main')
      .map((e) => recipeById.get(e.recipeId))
      .filter((r): r is Recipe => !!r)
    const genreMixed = detectGenreMix(slotMainRecipe, slotSideRecipes)
    // 一品もの(丼・麺・カレー・鍋)の日は副菜を意図的に空ける(docs/56 §3-8)。
    // その理由が画面に一切出ず「提案が1品だけ失敗した」ように見えていたので、
    // 副菜が空のときだけ1行で理由を添える(2026-07-29 便CD/MP-18)。
    // 「足したい人」も選べることを併記して、足す/足さないの好みの割れに両対応する
    const showOneDishNote =
      !!slotMainRecipe && isOneDish(slotMainRecipe) && slotSideRecipes.length === 0
    // 2026-08-08 便DX(オーナー指示): 時間帯ごとのロック。鍵が掛かっている食事は、
    // 自動でまとめて動かす操作の対象から外れる（手での編集は今までどおりできる）
    const slotLocked = isMealSlotLocked(lockedKeys, date, slot)
    return (
      // 2026-08-02 便CW-1: 朝食/昼食/夕食を1日のカードの中で見分けられるように、
      // 食事ごとに囲みを付け、左の帯と地色をトークンで段階的に変える(SLOT_TONE)
      <div
        key={slot}
        data-testid="slot-block"
        data-slot={slot}
        data-locked={slotLocked ? 'true' : undefined}
        // 2026-08-22 便JE: 角丸は通常表示の枠と同じ --radius-card（入れ子でそろえる）
        /* 2026-08-25 便KU（オーナー原文「操作の段がレシピごとに囲まれているのはわかるが、
           もともとの色が朝昼夕で似通っている上に距離が近いため、境目が認識しづらい。
           ダークでも同様」）:
            ・囲みの線を --border（面との差が実測1.15〜1.25:1）から **--border-card** に替えた。
              便JEが「並ぶカードが何枚あるか線から読み取れない」を直すために作った線で、
              図形の輪郭の下限とされる 3:1 を5テーマとも超える濃さを持つ。
              朝昼夕の地色の差（実測 1.04:1・ダーク1.05:1）に見分けを頼るのをやめ、
              **境目そのものを線で引く**
            ・食事どうしの間を 8px → 16px（--space-md）にした。1品の中(12px)より広い
              ＝距離でも切れ目が読める（便JQ が1品で作った関係を、食事の単位にも通す）
           色は直接書かずトークンのまま＝5テーマとも自動で追従する */
        className="rounded-card border border-l-4 p-[var(--space-sm)]"
        style={{
          // ロック中は地色を薄め、囲みをアクセント色にする(便DX・オーナー指示
          // 「鍵アイコン+わずかな面の差」)。薄くする向きなので、地色に載る補足文字の
          // コントラストは元の実測値より上がる(index.css の --slot-bg-locked-* 参照)
          background: slotLocked ? SLOT_TONE[slot].lockedBg : SLOT_TONE[slot].bg,
          borderColor: slotLocked ? 'var(--accent)' : 'var(--border-card)',
          borderLeftColor: SLOT_TONE[slot].bar,
        }}
      >
        <div className="flex items-center gap-2">
          {/* 2026-08-07 便DT-10(オーナー指示): 提案結果の「朝食」「昼食」「夕食」を少し大きくする
              (12px→14px)。1日のカードの中で、どの食事の枠を見ているかの目印になる文字なので、
              周りの補助文字と同じ大きさだと見つけにくかった */}
          <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
          {/* 2026-07-29 便CD/MP-08: 説明がtitle属性(ホバー)にしかなく、スマホでは
              物理的に到達できなかった。タップで説明をトーストに出すボタンにする
              (静止時の見た目は従来と同じ＝docs/56 §3-10「うるさくしない」を維持) */}
          {genreMixed && (
            <button
              type="button"
              title={ja.mealPlan.genreMixedHint}
              aria-label={ja.mealPlan.genreMixedAria}
              onClick={() => setMessage(ja.mealPlan.genreMixedHint)}
              /* 2026-08-22 便IZ: 実測93×21pxで、隣の料理カードとの間隔が7pxしかなかった
                 （押し間違えると差し替えの窓が開く）。当たり判定だけ44pxに広げる
                 ＝見た目（控えめなバッジ・docs/56 §3-10「うるさくしない」）は変えない */
              className="tap-target rounded-sm border border-edge px-1.5 py-0.5 text-[10px] font-bold text-ink-muted"
            >
              {ja.mealPlan.genreMixedBadge}
            </button>
          )}
          {/* 時間帯ごとのロック(2026-08-08 便DX・オーナー指示「献立カードの右上」)。
              押すたびに掛ける⇄外すが入れ替わる。開いた鍵＝掛かっていない */}
          <button
            type="button"
            data-testid="slot-lock"
            data-date={date}
            data-slot={slot}
            onClick={() => void toggleMealLock(planSlotLockToggle(lockedKeys, date, slot), 'one')}
            aria-pressed={slotLocked}
            aria-label={(slotLocked ? ja.mealPlan.unlockSlotAria : ja.mealPlan.lockSlotAria)
              .replace('{date}', date.replaceAll('-', '/'))
              .replace('{slot}', ja.mealPlan.slot[slot])}
            /* 2026-08-09 便EN(オーナー実機「今はどちらも細い線の記号なので、パッと見て
               違いが分かりづらい」): 掛かっているときはアクセント色で塗りつぶした丸にし、
               外れているときは線だけの開いた鍵にする＝塗りの有無で一目で見分けられるようにする */
            /* 2026-08-22 便IZ: 実測28px角で、指で押せる大きさ(44px・--tap-min)を下回っていた。
               器(.tap-target)で当たり判定だけ広げる＝丸の見た目・塗りの有無は1pxも変えない */
            className={`ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              slotLocked ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted'
            }`}
          >
            {slotLocked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}
          </button>
        </div>
        {/* 2026-08-22 便IZ: 1品どうしの間も12pxにする（直す前は4px）。
            1品が「カードの段＋操作の段」の2段になったので、間が詰まっていると
            上の品の×と下の品のカードを押し間違える。
            2026-08-23 便JQ: 12px→16px（--space-md）。1品の中は12pxのまま（便IZ が
            「上の品の×と下の品のカードの押し間違え」を理由に広げた値なので縮めない）＝
            **1品の中(12px) < 品と品の間(16px)** の関係を作り、距離でも品の切れ目が読めるようにする。
            -mx-[5px]: 1品ずつの囲み（border 1px ＋ 内側の余白 4px）を、この枠の余白8pxから借りて
            外へ出すための埋め合わせ。これで**カードの幅は囲みを足す前と1pxも変わらない**
            （囲みは左右へ5pxずつ出るので、枠の線との間には3px残る） */}
        <div className="mt-3 -mx-[5px] space-y-4">
          {roleRows.map(([role, rows]) =>
            rows.map((row, i) =>
              renderRow(
                date,
                slot,
                role,
                row,
                `${role}-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`,
                slotLocked,
              ),
            ),
          )}
        </div>
        {showOneDishNote && <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.oneDishNote}</p>}
        {/* 2026-08-08 便EA(オーナー指示「削除と変更ができない事がわかる一文にして」):
            鍵の掛かった枠では操作のボタンを押せない見た目にし、その理由をこの1行で言う。
            「＋料理を追加」は押しても何もできないので出さない */}
        {slotLocked ? (
          <p data-testid="slot-lock-note" className="mt-1 text-xs text-ink-muted">
            {ja.mealPlan.lockedSlotNote}
          </p>
        ) : isAddMenuOpen ? (
          // 2026-08-02 便DE-4: 足せる区分は主菜・副菜・汁物・その他の4つ(レシピ登録と同じ区分)
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {MEAL_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  addOrRestoreRow(date, slot, role)
                  setAddMenuFor(null)
                }}
                /* 2026-08-22 便IZ: 押せる高さを44px（--tap-min）に。区分は4つ横に並ぶので、
                   間隔も12pxにして隣の区分を押し間違えないようにする */
                className="inline-flex min-h-11 items-center rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent-ink"
              >
                {ja.mealPlan.role[role]}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setAddMenuFor(null)}
              aria-label={ja.common.close}
              className="tap-target rounded-full p-1 text-ink-muted"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddMenuFor(slotKey)}
            /* 2026-08-22 便IZ: 実測72×16pxで、真上の「レシピを見る」との間隔が6pxだった。
               押せる高さを44px（--tap-min）にして、間隔も取れるようにする */
            className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-accent-ink"
          >
            {ja.mealPlan.addRow}
          </button>
        )}
      </div>
    )
  }

  /**
   * 未解錠ユーザー向けの「栄養から組む（Pro）」の鍵付き1行（docs/62 決定②「売り場を変える」＝
   * 設定の奥ではなく無料の献立画面に入口を置く）。押し売りはしない＝控えめな1行にとどめる。
   *
   * 2026-08-09 便EN: 週タブの「献立を提案」グループを既定で畳んだ（オーナー指示）ため、
   * この行をグループの中に置いたままだと、畳んだ画面から入口が消えてしまう。
   * 週タブでは折りたたみの外へ出して同じ深さのまま残す（月タブは折りたたみが無いので中のまま）。
   */
  const renderPurposeLockedRow = () => (
    <Link
      /* 2026-08-27 便LU: 現在地のパスだけを帰り道に載せていたので、設定から戻ると
         日タブ・畳んだ状態・先頭で開き直していた。見ていたタブと場所ごと帰す */
      {...proGateDetour}
      data-testid="purpose-locked-row"
      className="mt-[var(--space-sm)] flex w-full items-center gap-2 rounded-sm border border-edge bg-surface px-3 py-2 shadow-sm"
    >
      <Lock size={16} className="shrink-0 text-ink-muted" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-ink-muted">
          {ja.mealPlan.purposeLockedRow}
        </span>
        <span className="block text-xs text-ink-muted">{ja.mealPlan.purposeLockedRowSub}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
    </Link>
  )

  /**
   * 自動提案の条件（時短優先・ジャンル）の折りたたみ。
   * 2026-07-30 便CH/C11: 週タブの中にしか無かったが、この3つの条件は月タブの
   * 「献立をまとめて提案」にも100%効いている（executeFillが同じ値を読む）。
   * 月から条件が見えず変えられないため、「なぜ月が全部中華になったのか」が画面から分からなかった。
   * 同じ部品を週・月の両方で出す＝どちらから見ても今の条件が分かり、その場で変えられる。
   *
   * 2026-08-07 便DT-7: disabled を足した。週タブの「先週の献立をコピー」がONのあいだは
   * この条件がひとつも効かないので、押せない見た目（グレーアウト）にして触れなくする。
   * 月タブからの呼び出しは引数なし＝従来どおり常に有効。
   *
   * 2026-08-09 便EN: showLockedRow を足した。週タブは「献立を提案」グループごと畳むので、
   * 未解錠の鍵付き行だけは呼び出し側（折りたたみの外）で出していた。
   *
   * 2026-08-19 便IF・②（オーナー原文「無料版でpro機能の案内が折りたたみでも表示されていて邪魔。
   * しまって。」）: 鍵付き行は**この窓の中**（下の renderSuggestConditionsModal）へ移した。
   * 消したのではなく、解錠済みのときに「栄養から組む」が出るのと同じ場所へ入れただけ
   * ＝入口は残り、週タブ・月タブを開いただけでは案内が場所を取らない。
   * 週タブ・月タブのどちらから開いても同じ窓なので、showLockedRow の出し分けは不要になった。
   */
  const renderSuggestConditions = (disabled = false) => (
    <div
      className={`mt-[var(--space-sm)] ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      aria-disabled={disabled || undefined}
    >
      {/* 2026-08-19 便ID・③④（オーナー原文
          「『提案の条件：〇〇』→『現在の条件：〇〇』。実際に〇〇に入っているのは現在の条件のはず。」
          「『提案の条件：〇〇』をタップした時に期待する挙動は、そのままこの枠のプルダウン。
            実際は下にスペースが伸びるので、ちょっとびっくりする。」→ オーナーはA案＝窓で開くを選択）:
          ・名前を「現在の条件」にした（ここに出ているのは、いま効いている条件そのもの）
          ・押すと**窓**が開く。折りたたみをやめたので、押しても下の内容は1pxも動かない
          ・条件を1つも選んでいないときは「: 指定なし」と書く（コロンの後ろを空にしない＝
            「読み取れなかった」のか「選んでいない」のかが分かるようにする）
          何か絞り込んでいるあいだは枠と字をアクセント色にする＝窓を開かなくても
          「絞り込み中かどうか」が分かる（日タブの「条件をしぼる」と同じ言い方） */}
      {/* 2026-08-27 便LT（オーナー原文「「現在の条件」→サブタイ「条件設定」と「指定する」ボタンに
          分けるなどしないと、ここで設定できることに気づけない。入れかたの方が目立っているので
          存在感がない。」）: 困りごとは「ここで設定できることに気づけない」こと。
          **すぐ上の「入れかた」とまったく同じ形**（太字の小見出し＋横いっぱい・44pxの操作）にした。
          直す前は、名前も値も1つのボタンの中に詰めた 180×38px の小さな枠で、
          横いっぱいのプルダウンである「入れかた」の脇に埋もれていた。
          名前は小見出しへ出し、ボタンには**いま効いている条件だけ**を残す＝
          「入れかた: 空いた枠だけ」と同じ読み方（名前→値）になり、値を変えられる欄だと分かる。
          読み上げ名は名前と値をつないで持つ（値だけのボタンは、音だけでは何の値か分からない） */}
      <span className="block text-sm font-bold text-ink-muted">
        {ja.mealPlan.suggestConditionsToggle}
      </span>
      <button
        type="button"
        data-testid="plan-conditions-open"
        disabled={disabled}
        onClick={() => setSuggestConditionsOpen(true)}
        aria-label={`${ja.mealPlan.suggestConditionsToggle}: ${
          conditionsSummary || ja.mealPlan.suggestConditionsNone
        }`}
        className={`mt-1 flex min-h-11 w-full items-center gap-2 rounded-sm border bg-surface px-3 py-2 text-left text-sm font-bold shadow-sm ${
          conditionsSummary ? 'border-accent text-accent-ink' : 'border-edge text-ink-muted'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">
          {conditionsSummary || ja.mealPlan.suggestConditionsNone}
        </span>
        <SlidersHorizontal size={16} className="shrink-0" aria-hidden />
      </button>

    </div>
  )

  /**
   * 「現在の条件」を押すと開く窓（2026-08-19 便ID・④。オーナーはA案＝窓を選択）。
   *
   * 直す前はこの中身が折りたたみで、開くと下の内容が押し下がり、さらに中の「調理時間◯分以内を優先」を
   * 押すと分数のプルダウンと説明が現れて下がまたずれていた（オーナー原文「実際は下にスペースが
   * 伸びるので、ちょっとびっくりする」）。窓にすれば、開いても中で何を押しても後ろの画面は動かない。
   *
   * **窓の作りは日タブの「条件をしぼる」（2026-08-19 便IA）とまったく同じものを使う**＝
   * 外タップ・✕・端末の「戻る」で閉じる（useOverlayDismiss）／開いているあいだ後ろの画面を止める
   * （useScrollLock）／見た目は dialogStyle。新しい窓の作りは発明しない。
   *
   * **窓の中も動かない形にしてある**（便IAと同じ手）:
   *  ・分数のプルダウンを最初から出す（押してはじめて現れる選択肢を作らない）。
   *    分数を選んだ時点で「調理時間◯分以内を優先」もONにする＝押しても効かない欄を置かない
   *  ・「調理時間◯分以内を優先」の説明の1行は、出ていないあいだも同じ場所を取る（見えなくするだけ）
   *  この窓は真ん中に出るので、中身が1行増えると窓ごと上下に動く＝出したり消したりするものは
   *  すべて場所を先に取る必要がある。
   *
   * 週タブと月タブが同じ窓を共有する（条件そのものが共有＝executeFillが同じ値を読むため）。
   * 描くのは画面に1つだけ（折りたたみの中に置くと、閉じるときに窓ごと切り取られる）。
   */
  const renderSuggestConditionsModal = () =>
    suggestConditionsOpen && (
      <div className={DIALOG_BACKDROP_CLS} onClick={closeSuggestConditions} role="presentation">
        <div
          role="dialog"
          aria-label={ja.mealPlan.suggestConditionsTitle}
          data-testid="plan-conditions-modal"
          onClick={(e) => e.stopPropagation()}
          className={DIALOG_CARD_CLS}
        >
          {/* 見出しの行に「条件をクリア」を小さく置く（2026-08-20 便II・②。オーナー原文
              「「条件をクリア」は上に小さく文字だけでいい（レシピ絞り込みと同じ）下に大きくあると、
                誤認して決定のつもりで押しそう。」）。
              形はレシピ一覧の絞り込みパネルの「条件をクリア」と同じ＝**パネルの上端・小さい字・
              下線のリンク**（pages/RecipesPage.tsx）。下端の大きな枠ボタンだったものを、
              押し間違えても取り返しのつく上端の小さな文字にする。
              条件を1つも選んでいないあいだも場所は先に取る（見えなくするだけ）＝
              窓の中身が伸び縮みして下のプルダウンが動くことがない（便IDと同じ手）。
              押せる高さは、同じ行にある✕（tap-target・44px）が受け持つ＝行の高さは変わらない */}
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 font-bold">{ja.mealPlan.suggestConditionsTitle}</h3>
            <button
              type="button"
              data-testid="plan-conditions-clear"
              onClick={clearSuggestConditions}
              aria-hidden={!anyPlanConditionActive}
              className={`shrink-0 py-2 text-sm font-bold text-accent-ink underline ${
                anyPlanConditionActive ? '' : 'invisible'
              }`}
            >
              {ja.search.clear}
            </button>
            <button
              type="button"
              onClick={closeSuggestConditions}
              aria-label={ja.common.close}
              className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          {/* 調理時間（2026-08-20 便II・①。オーナー原文「「何分以内を優先する？」→指定した時間より
              長いレシピも選ばれるということ？表記も長いし、ここだけ疑問系なのが気になる。
              シンプルに「時間」でいいと思う」）。
              直したこと:
               ・**「優先」をやめた**。実装（logic/mealPlan.ts の suggestCandidates）は選んだ分数より
                 長いレシピを候補から外していて、優先度を上げているのではなかった＝文言が嘘だった
               ・ON/OFFのボタン＋分数のプルダウンの2つをやめ、**プルダウン1つ**にした
                 （「料理のジャンル」と同じ形。「指定なし」で条件が外れる）
               ・欄の名前は疑問形をやめて「調理時間」（オーナーの言う「時間」は、この画面に
                 朝食・昼食・夕食が同時に出ているため食事の時間帯と読める。規約Hで言い換えた） */}
          <label className="mt-[var(--space-md)] block">
            <span className="block text-sm font-bold text-ink-muted">
              {ja.mealPlan.quickMinutesLabel}
            </span>
            <select
              data-testid="plan-quick-minutes"
              value={quickOnly ? String(quickMinutes) : ''}
              onChange={(e) => changeQuickMinutes(e.target.value)}
              className="select-control mt-1 w-full"
            >
              <option value="">{ja.mealPlan.quickMinutesNone}</option>
              {PLAN_QUICK_MINUTES_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {ja.mealPlan.quickMinutesOption.replace('{n}', String(m))}
                </option>
              ))}
            </select>
          </label>
          {/* 条件の説明は、その条件を選んでいるあいだだけ見せる（2026-08-09 便EN・オーナー実機
              「『調理時間15分以内を優先』を選んでいないのに説明文が出る」＝選ばなくても
              優先されているように読めた）。
              2026-08-19 便ID: 見えないあいだも**同じ場所を取る**（消すと窓の中身が伸び縮みする）。
              読み上げにも乗せない（aria-hidden） */}
          <p
            data-testid="plan-quick-hint"
            aria-hidden={!quickOnly}
            className={`mt-1 text-xs text-ink-muted ${quickOnly ? '' : 'invisible'}`}
          >
            {ja.mealPlan.quickOnlyHint.replace('{n}', String(quickMinutes))}
          </p>
          {/* 料理のジャンル（2026-08-22 便IY・オーナー原文「週献立は、「料理のジャンル」は
              複数選択のほうがいいかも。１つしか選べないと、１週間中華だけ、という献立しか
              組めない。全てを選ぶと、中華は入れたくないけど和洋食は混在させたい、ができない。」）。

              2026-08-19 便HTでプルダウン1つにまとめたが、**複数選ぶにはプルダウンでは足りない**
              （<select multiple> はスマホで一覧がそのまま縦に伸びて窓の中が動き、指で複数を
              選ぶ操作にもならない）。390×844の実測で3つのジャンルは横1行に収まるので、
              **選べるジャンルを並べて選ぶ/外す**形にした＝窓の高さは1行ぶんしか増えず、
              便ID・便IAの「窓の中も動かない」を保てる。
              見た目は日タブの「条件をしぼる」の並びと同じ（選んでいるものは塗る）。
              押せる高さは --tap-min（44px）＝直す前のプルダウンと同じだけの当たり判定を持たせる。

              **最後の1つは外せない**（logic/mealPlan.ts の toggleMealGenre）。1つも選んでいない
              状態にすると候補が無くなり「提案できません」で終わるだけなので作らせない。
              全部から選び直すのは見出しの行の「条件をクリア」。
              最後の1つに aria-disabled は付けない——見た目は他の選んだジャンルと同じままなので、
              読み上げだけ「使えない」と言うと食い違う。外せないことは下の1行で言う */}
          <div className="mt-[var(--space-md)]">
            <span className="block text-sm font-bold text-ink-muted">{ja.mealPlan.genreLabel}</span>
            <div
              role="group"
              aria-label={ja.mealPlan.genreLabel}
              data-testid="plan-genre"
              className="mt-1 flex flex-wrap gap-[var(--space-sm)]"
            >
              {MEAL_GENRES.map((genre) => {
                const picked = genreFilters.includes(genre)
                return (
                  <button
                    key={genre}
                    type="button"
                    data-testid="plan-genre-chip"
                    data-genre={genre}
                    aria-pressed={picked}
                    onClick={() => toggleGenreFilter(genre)}
                    className={`inline-flex min-h-[var(--tap-min)] items-center rounded-sm border px-3 text-sm font-bold ${
                      picked
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge bg-surface text-ink-muted'
                    }`}
                  >
                    {genre}
                  </button>
                )
              })}
            </div>
            {/* この並びが「1つだけ選ぶもの」ではないことと、最後の1つは外せないことを1行で言う。
                出したり消したりしない＝窓の中身が伸び縮みして下のものが動くことがない */}
            <p data-testid="plan-genre-hint" className="mt-1 text-xs text-ink-muted">
              {ja.mealPlan.genreHint}
            </p>
          </div>

          {/* 栄養から組む（Pro機能）。解錠済みのときだけ、この窓の中で選べる */}
          {isPro && (
            <div className="mt-[var(--space-md)]" data-testid="purpose-picker">
              <p className="flex items-center gap-1 text-sm font-bold text-ink-muted">
                {ja.mealPlan.purposeLabel}
                <span className="rounded-full border border-accent px-2 py-0.5 text-xs text-accent-ink">
                  {ja.mealPlan.purposeProTag}
                </span>
              </p>
              {/* 2026-08-19 便HT（オーナー原文「栄養から組むのボタンは、プルダウンにしたい。
                  ボタンがたくさん並ぶとごちゃつき感がある。」）: チップ9個（指定なし＋8つの軸）を
                  プルダウン1つにした。
                  2026-08-07 便DT-9でオーナーが決めた「多め」「ひかえめ」の2群分けは、
                  プルダウンの中の区分（optgroup）としてそのまま残す。
                  2026-08-19 便ID・⑤（オーナー原文「個別に『〇〇多め』『〇〇ひかえめ』と
                  ついているとくどく感じる。しかし、『提案の条件：〇〇』に入れる場合は
                  『〇〇多め』の方が見やすい。両立できない？」）: **表示名を2つ持って両立させる**。
                  区分の中に並ぶこの選択肢は項目名だけ（PURPOSE_OPTION_LABEL）、
                  区分から離れて1つで読まれる条件のボタンの要約は「たんぱく質多め」
                  （PURPOSE_LABEL）。中身（内部キー・提案の効き方）は何も変えていない */}
              <select
                data-testid="plan-purpose"
                aria-label={ja.mealPlan.purposeLabel}
                value={planPurpose ?? ''}
                onChange={(e) => void changePurpose((e.target.value || undefined) as MealPurpose | undefined)}
                className="select-control mt-1 w-full"
              >
                <option value="">{ja.mealPlan.purposeNone}</option>
                {(
                  [
                    [ja.mealPlan.purposeGroupMore, MORE_MEAL_PURPOSES],
                    [ja.mealPlan.purposeGroupLess, LESS_MEAL_PURPOSES],
                  ] as const
                ).map(([groupLabel, purposes]) => (
                  <optgroup key={groupLabel} label={groupLabel}>
                    {purposes.map((purpose) => (
                      <option key={purpose} value={purpose}>
                        {purposeOptionLabelOf(purpose)}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.purposeHint}</p>
            </div>
          )}

          {/* 目的（2026-08-02 便CP-2・docs/62 決定②。Pro機能）の入口。
              2026-08-19 便IF・②: 未解錠のときの鍵付き1行を、この窓の中へ移した。
              解錠すると同じ場所が上の「栄養から組む」のプルダウンに変わる
              ＝解錠の前後で入口の場所が動かない。押し売りはしない＝1行にとどめる（規約H） */}
          {!isPro && renderPurposeLockedRow()}

          {/* 窓の中身は縦に長くなるので、下端にも大きな「閉じる」を置く
              （下まで送ると右上の✕が画面の外に出るため）。名前は同じ ja.common.close */}
          {/* 2026-08-20 便II・②: ここにあった「条件をクリア」は見出しの行へ移した
              （下に大きく置くと「決定」と読み違えて押される）。残るのは「閉じる」だけ */}
          <div className={DIALOG_ACTIONS_CLS}>
            <button
              type="button"
              data-testid="plan-conditions-close"
              onClick={closeSuggestConditions}
              className={DIALOG_PRIMARY_BUTTON_CLS}
            >
              {ja.common.close}
            </button>
          </div>
        </div>
      </div>
    )

  /**
   * 週タブの操作グループ（表示のしかた／自動で献立を提案／献立テンプレート）の見出し＝折りたたみボタン
   * （2026-08-03 便DJ・オーナー指示）。3つが常に全部開いていて縦に長く、下の7日分カードまで
   * 遠かったため、それぞれ畳めるようにした。既定で開くのは「自動で献立を提案」だけ。
   */
  // py-1.5 は指で押す当たり判定を広げるため（文字だけの高さでは料理中に押しにくい）
  //
  // 2026-08-07 便DT-6（オーナー指示）: 畳んでいても操作できるボタンは、グループの見出しの
  // 「横」に置いて1か所に集める。以前は折りたたみの外に別の行として置いていたため、
  // 畳んだときに見出しの行とボタンの行で2段になり、どのグループのものか読み取りづらかった。
  // 見出しの折りたたみボタンの中には入れない（ボタンの入れ子は押し分けられなくなる）ので、
  // 見出しの行を flex にして「折りたたみボタン＋常設の操作」を横に並べる。
  //
  // 2026-08-22 便IV（オーナー原文「「まとめて献立てを入力」ボタンは「献立を提案」の横にして、
  // １列におさめて。」）: 横に置くものが1つのボタンだけの節は**折り返さない**（wrap=false）。
  // 「表示のしかた」の食事のチップは3つ並ぶので今までどおり折り返す。
  const renderWeekGroupHeader = (
    key: keyof typeof weekGroupOpen,
    title: string,
    alwaysVisible?: ReactNode,
    wrap = true,
    /** 検査用の目印（開閉ボタンに付く）。節を増やしても掴み方が並び順に依らないようにするため */
    testId?: string,
    /**
     * 畳んでいるときだけ見出しの横に出す数値（2026-08-26 便LH・オーナー原文
     * 「それぞれ折りたたみ状態で数値を１列表示。」）。開いたら中の表・パネルが同じ数字を
     * 受け持つので出さない＝同じ数字を2か所に並べない（月タブのMonthCardHeaderと同じ作法）
     */
    foldedFigure?: string,
    foldedFigureTestId?: string,
  ) => {
    const open = weekGroupOpen[key]
    return (
      <div
        className={`flex items-center gap-x-2 gap-y-1 ${wrap ? 'flex-wrap' : 'flex-nowrap'}`}
      >
        <button
          type="button"
          data-testid={testId}
          onClick={() => setWeekGroupOpen((prev) => ({ ...prev, [key]: !prev[key] }))}
          aria-expanded={open}
          aria-label={(open
            ? ja.mealPlan.weekGroupToggleCloseAria
            : ja.mealPlan.weekGroupToggleOpenAria
          ).replace('{group}', title)}
          className="flex shrink-0 items-center gap-1 py-1.5 text-left"
        >
          <span className="text-xs font-bold text-ink-muted">{title}</span>
          {open ? (
            <ChevronUp size={18} className="shrink-0 text-ink-muted" aria-hidden />
          ) : (
            <ChevronDown size={18} className="shrink-0 text-ink-muted" aria-hidden />
          )}
        </button>
        {alwaysVisible}
        {!open && foldedFigure && (
          <span
            data-testid={foldedFigureTestId}
            className="ml-auto shrink-0 whitespace-nowrap text-sm font-bold text-accent-ink tabular-nums"
          >
            {foldedFigure}
          </span>
        )}
      </div>
    )
  }

  /**
   * 表示する食事帯トグル（週タブ「表示のしかた」グループの中。便U-2で入り、
   * 便DHで日タブからは外れた）。
   *
   * 2026-08-03 便DP-6（オーナー指示）: グループを畳んでいるときは見出しの文字を出さず、
   * ボタン群だけを残す。畳んだ状態では見出し「表示のしかた」がすぐ上にあり、
   * 「表示する食事」の文字が重なって2段の見出しに見えていた。
   * 見出しを出さないときも、読み上げでは何のボタン群かが分かるようグループ名を付ける。
   *
   * 2026-08-07 便DT-6（オーナー指示）: 「表示のしかた」の見出しの横へ移し、開閉に関わらず
   * 常に同じ場所に出す。見出しがすぐ左にあるので文字の見出しは持たない
   * （読み上げ用のグループ名は role/aria-label で残す）。
   */
  const renderSlotFilter = () => (
    <div
      role="group"
      aria-label={ja.mealPlan.slotFilterTitle}
      className="flex flex-wrap gap-[var(--space-sm)]"
    >
      {MEAL_SLOTS.map((slot) => (
        <button
          key={slot}
          type="button"
          onClick={() => toggleSlot(slot)}
          aria-pressed={visibleSlots.includes(slot)}
          className={chipClass(visibleSlots.includes(slot))}
          style={chipStyle(visibleSlots.includes(slot))}
        >
          <ChipCheck on={visibleSlots.includes(slot)} />
          {ja.mealPlan.slot[slot]}
        </button>
      ))}
    </div>
  )

  /**
   * 食事を選ぶチップ（2026-08-28 便MD。オーナー原文2件
   * 「献立をまとめて提案に、朝昼夕の選択がない」「献立表：… 朝昼夕の選択がない。
   * 夕食だけの献立表を作成などできるように。」）。
   * 月タブの「入れる食事」「載せる食事」と、週タブの「入れる食事」（2026-08-29 便MK）で使う。
   *
   * 形は**アプリに既にある選び方に合わせる**: 複数を選ぶものはチップ（表示する食事・
   * 買い物メモの範囲えらび）、1つだけ選ぶものはプルダウン（週の区切り）という
   * 2026-08-22 便JF・⑤の分け方に従う。ここは複数選ぶのでチップ。
   * 見た目は「選ぶボタン」の作法（chipClass＋ChipCheck・2026-08-09 便EN）で、
   * 隣に並ぶ実行ボタン（塗りつぶし）と押し間違えない。
   *
   * 並べるのは設定「表示する食事」に出している食事だけ＝画面に出ない献立が黙って増えたり、
   * 画面に出ない食事を紙にだけ載せたりしない（logic/mealTemplate.ts と同じ線）。
   * 2つの絞りを分けて持つのは、片方が「どこへ入れるか」（書き込む操作）で、
   * もう片方が「どこを載せるか」（読むだけの操作）だから。1つにまとめると
   * 「夕食だけの紙を作りたい」が「夕食にだけ献立を入れる」まで変えてしまう。
   * 週と月を分けて持つのも同じ理由で、週の絞りは表示している7日間だけに効く。
   */
  const renderSlotPicker = (
    label: string,
    aria: string,
    testId: string,
    picked: MealSlot[],
    onToggle: (slot: MealSlot) => void,
  ) => (
    <div className="mt-[var(--space-sm)]">
      <p className="text-xs font-bold text-ink-muted">{label}</p>
      <div role="group" aria-label={aria} className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
        {visibleSlots.map((slot) => (
          <button
            key={slot}
            type="button"
            data-testid={testId}
            data-slot={slot}
            onClick={() => onToggle(slot)}
            aria-pressed={picked.includes(slot)}
            className={chipClass(picked.includes(slot))}
            style={chipStyle(picked.includes(slot))}
          >
            <ChipCheck on={picked.includes(slot)} />
            {ja.mealPlan.slot[slot]}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 日／週／月の3タブ(便U-1)。サンプルデモは月の画面だけを見せるので出さない。
          2026-08-03 便DJ(オーナー指示): 3つを画面の幅いっぱいに広げる(flex-1で等分)。
          左に小さく寄っていて、タブの切替だと気づきにくく指も当てにくかった。

          2026-08-09 便ET(オーナー実機「献立タブの日週月ボタンは上に固定したい」):
          スクロールしても画面上部に残す(sticky)。作りは設定画面の目次チップ・食材タブの
          タブバー・レシピ一覧の検索まどと同じ。meal-plan-tabbar クラスは index.css で
          iPad のマルチタスク操作ボタンよけの上余白を足すためのもの。
          data-app-top-bar は「押したら伸びた部分を画面内に入れる」共通処理
          (logic/revealExpanded)にこの帯の高さを知らせる目印。
          z-20: 献立の枠に重なる要素より上、重ね窓(z-[60]以上)より下に置く */}
      {!isDemo && (
      <div
        data-app-top-bar
        className="meal-plan-tabbar sticky top-0 z-20 -mx-[var(--space-md)] mt-[var(--space-sm)] flex gap-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur"
      >
        <button
          type="button"
          onClick={() => setViewMode('day')}
          aria-pressed={viewMode === 'day'}
          className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold ${
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
          className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold ${
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
          className={`flex-1 rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'month'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewMonth}
        </button>
      </div>
      )}

      {/* 「作った」の直後だけ「元に戻す」を添える(2026-08-02 便DE-3。買い物メモ・食材価格と同じ形)。
          2026-08-10 便FD: レシピを選び直した直後にも同じ「元に戻す」を添える。
          2026-08-18 便HQ: 献立の×（日タブの2種・週/月タブの行）にも同じ形で添えた。
          2026-08-19 便IA: 週/月の行のサイコロ（自動提案）にも同じ形で添えた。
          消える操作ほど戻せない状態だったのを、いちばん軽い「作った！」と同じ守りに揃える */}
      <Toast
        message={message}
        onClose={() => {
          setMessage('')
          setUndoCooked(null)
          setUndoPick(null)
          setUndoRemove(null)
          setUndoSuggest(null)
          setUndoAssign(null)
          setUndoRecord(null)
          setUndoRecordDelete(null)
          setHistoryToast('')
        }}
        actionLabel={
          undoCookedActive ||
          undoPickActive ||
          undoRemoveActive ||
          undoSuggestActive ||
          undoAssignActive ||
          undoRecordActive ||
          undoRecordDeleteActive
            ? ja.common.undo
            : undefined
        }
        onAction={
          undoCookedActive
            ? () => void runUndoCooked()
            : undoPickActive
              ? () => void runUndoPick()
              : undoRemoveActive
                ? () => void runUndoRemove()
                : undoSuggestActive
                  ? () => void runUndoSuggest()
                  : undoAssignActive
                    ? () => void runUndoAssign()
                    : undoRecordActive
                      ? () => void runUndoRecord()
                      : undoRecordDeleteActive
                        ? () => void runUndoRecordDelete()
                        : undefined
        }
        /* 記録を付けた直後だけ、内容を足しに行ける場所を添える（2026-08-26 便LJ・
           並行調理ナビの「まとめて作った！」と同じ形） */
        linkLabel={historyToastActive ? ja.common.cookedHistoryLink : undefined}
        onLink={historyToastActive ? openHistoryFromToast : undefined}
      />

      {viewMode === 'day' && (
        <>
          {/* アプリを開いた直後に読ませたい案内（バックアップのうながし・アプリ内のお知らせ）。
              2026-08-17 便HG: ホーム画面の廃止でここが最初に着く画面になったので連れてきた */}
          <DayStartNotices
            settings={settings}
            allRecipes={recipes}
            currentPath={location.pathname + location.search}
          />

          {/* 作りかけの段取りに戻る（2026-08-08 便EG・オーナー実機報告「タブ移動しても
              並行調理が維持されているが、再開したい時に迷う。今日の献立タブの目立つ位置に
              再開ボタン欲しい」）。段取りが残っているときだけ、今日の献立の上に出す */}
          {naviInProgress && (
            <Link
              to="/cook-navi"
              data-testid="navi-resume"
              /* 2026-08-09 便EH・オーナー指示「白地にオレンジ文字でオレンジで囲って。
                 ボタンはもう気持ち大きく」。塗りボタンだと下の「全て作った！」と見分けが付かず、
                 献立の操作と紛れていた */
              className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border-2 border-accent bg-surface py-5 text-xl font-bold text-accent-ink shadow-md"
            >
              <Route size={24} aria-hidden />
              {ja.mealPlan.cookNaviResume}
            </Link>
          )}

          {/* 今日の献立（週間プランナーとは別の「今日これ作る」リスト）。
              2026-08-17 便HI（オーナー実機「『今日の献立』がない時には表示しない」）:
              空の日は**見出しも枠も出さない**。空状態の案内文と、そこにあった
              「今日の献立を探す」は下（「今日なに作る？」の下）へ移してある＝
              空のときの唯一の入口を失わせない */}
          {dayHasPlan && (
            <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)]">
              {/* 見出しの横に「整理」（2026-08-20 便IG・①）。作法は食材の在庫の
                  「整理」ボタン（components/PantryBoard）にそろえる＝同じ位置（見出しの右）・
                  同じ名前（整理／完了）・同じ見た目（ONで塗り・OFFで枠）。
                  押せる高さは44px（min-h-11）を下回らせない */}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-bold">{ja.mealPlan.todayTitle}</h2>
                <button
                  type="button"
                  data-testid="day-organize"
                  onClick={() => setDayOrganizing((v) => !v)}
                  aria-pressed={dayOrganizing}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    dayOrganizing
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  <ListChecks size={14} aria-hidden />
                  {dayOrganizing ? ja.mealPlan.todayOrganizeDone : ja.mealPlan.todayOrganizeToggle}
                </button>
              </div>

              {/* 2026-08-03 便DH(オーナー指示): 便DEの左右2列をやめ、縦一列で
                  「レシピ一覧から選択中」→「今週の献立の予定(朝食・昼食・夕食)」の順に並べる */}

              {/* 各行のボタンが何をするものかの1行説明(2026-08-03 便DP-3・規約H)。
                  リストの上に1回だけ置く(行ごとに繰り返さない)。
                  2026-08-20 便II・⑥: 「作った！」も×も整理モードの中にしか無くなったので、
                  この説明も**整理モードのあいだだけ**出す（出ていない操作の説明を先に読ませない）。
                  在庫・並行調理ナビの1行も「作った！」を押す前に読ませるためのものなので同じ扱い */}
              {dayOrganizing && (
                <p className="mt-1 text-xs text-ink-muted">
                  {ja.mealPlan.todayMarkCookedHint}
                  {/* ×が何をするものかを1行で添える（2026-08-20 便IG・①・規約H）。
                      「整理」の2文字だけでは何ができるのか読み取れないため */}
                  <span data-testid="day-organize-hint" className="block">
                    {ja.mealPlan.todayOrganizeHint}
                  </span>
                  {/* 段取りを組んでいる間だけ、1品の記録が段取りに与える影響を先に伝える
                      （2026-08-09 便EH・規約F） */}
                  {naviInProgress && (
                    <span data-testid="day-navi-cooked-hint" className="block">
                      {ja.mealPlan.todayMarkCookedNaviHint}
                    </span>
                  )}
                  {/* 在庫を減らす設定がONのときだけ、押す前に読める場所に書く
                      （1品ずつの「作った！」で確認の小窓は出さない・2026-08-12 便FW・規約F） */}
                  {settings?.cookedReflectPantry && (
                    <span data-testid="day-pantry-cooked-hint" className="block">
                      {ja.mealPlan.todayMarkCookedPantryHint}
                    </span>
                  )}
                </p>
              )}

              {/* ①レシピ一覧から選択中。この×は今日の献立からだけ外す。
                  今日の予定へ入れたいときは行の下の「◯食に入れる」から
                  (入る役割の判定は assignMismatchRecipe＝主菜になる料理は主菜・それ以外は副菜)。
                  2026-08-20 便IG・①: ×は整理モードのあいだだけ出す(onRemoveを渡さない＝出ない) */}
              {pickedRecipes.length > 0 && (
                <div data-testid="day-picked" className="mt-[var(--space-sm)]">
                  <p className="text-sm font-bold text-ink-muted">
                    {ja.mealPlan.todayPickedLabel}
                  </p>
                  <ul className="mt-1 space-y-[var(--space-sm)]">
                    {pickedRecipes.map((recipe) => (
                      <TodayListRow
                        key={recipe.id}
                        recipe={recipe}
                        ngIngredients={settings?.ngIngredients ?? []}
                        onCooked={
                          dayOrganizing ? () => markDayRecipeCooked(recipe) : undefined
                        }
                        onRemove={
                          dayOrganizing ? () => void removeTodayPickedRecipe(recipe) : undefined
                        }
                        /* 行を左へ払うと出る「外す」（2026-08-21 便IQ）。整理モードの外でも効く。
                           押したときの中身は×とまったく同じ＝外れるのは今日の献立の行だけ */
                        swipeOpen={daySwipeOpenKey === `picked:${recipe.id}`}
                        onSwipeOpenChange={(next) =>
                          setDaySwipeOpenKey(next ? `picked:${recipe.id}` : null)
                        }
                        onSwipeRemove={() => void removeTodayPickedRecipe(recipe)}
                        /* 「◯食に入れる」は整理モードの**外にも出したまま**にする
                           （2026-08-20 便II・⑥の裁定）。「整理」は減らす・終わらせる操作
                           （「作った！」「×」）の集まりで、**これから決める操作は性質が違う**。
                           しかも「レシピ一覧から選択中」はレシピを選んだ直後の一時的な状態で、
                           **次にやることがこの3つのボタン**なので、モードの奥に入れると
                           選んだ直後に手が止まる（流れの途中に行き止まりを作らない）。
                           ⑥のねらい（今日の献立を1画面で見渡せる）は、毎行に付く「作った！」と
                           「×」を隠すことで足りている＝選択中の行は常にあるものではない */
                        footer={
                          <div className="flex w-full flex-wrap gap-1">
                            {MEAL_SLOTS.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => void assignMismatchRecipe(slot, recipe)}
                                className="rounded-sm border border-edge bg-surface px-2 py-1.5 text-xs font-bold text-accent-ink"
                              >
                                {ja.mealPlan.planMismatchAddToSlot.replace(
                                  '{slot}',
                                  ja.mealPlan.slot[slot],
                                )}
                              </button>
                            ))}
                          </div>
                        }
                      />
                    ))}
                  </ul>
                </div>
              )}

              {/* ②今週の献立の予定。
                  2026-08-17 便HI（オーナー実機「『今日の献立』のメニューに×つけて、
                  週と連動して削除できるようにして」）: ここにも×を出す。
                  押すと**今週の献立の予定そのものを消す**ので、日からも週からも消える。
                  ①の×（今日の献立からしか外さない）とは結果が違うので、読み上げの名前
                  （todayPlannedRemove）と押す前の説明（todayPlannedRemoveHint）を分けてある。
                  鍵の掛かった食事は手でも消せない（2026-08-08 便EA）ので、押しても止まる */}
              {plannedGroups.length > 0 && (
                <div data-testid="day-planned" className="mt-[var(--space-md)]">
                  <p className="text-sm font-bold text-ink-muted">
                    {ja.mealPlan.todayPlannedLabel}
                  </p>
                  {/* 規約F: ×が何を消して何を残すかを、押す前に読める場所に書く。
                      2026-08-20 便IG・①: ×が出ているとき＝整理モードのあいだだけ出す
                      （出ていない操作の説明を先に読ませない） */}
                  {dayOrganizing && (
                    <p data-testid="day-planned-remove-hint" className="text-xs text-ink-muted">
                      {ja.mealPlan.todayPlannedRemoveHint}
                    </p>
                  )}
                  {plannedGroups.map(({ slot, recipes: slotRecipes }) => (
                    <div key={slot} className="mt-1">
                      <p className="text-xs text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                      <ul className="mt-1 space-y-[var(--space-sm)]">
                        {slotRecipes.map((recipe) => (
                          <TodayListRow
                            key={recipe.id}
                            recipe={recipe}
                            ngIngredients={settings?.ngIngredients ?? []}
                            onCooked={
                              dayOrganizing ? () => markDayRecipeCooked(recipe) : undefined
                            }
                            onRemove={
                              dayOrganizing
                                ? () => void removeTodayPlannedRecipe(slot, recipe)
                                : undefined
                            }
                            removeLabel={ja.mealPlan.todayPlannedRemove}
                            /* 行を左へ払うと出る「外す」（2026-08-21 便IQ）。整理モードの外でも効く。
                               押したときの中身は×とまったく同じ＝今日と今週の両方から外れるので、
                               読み上げの名前（removeLabel）も押したあとのお知らせも×と同じものを使う */
                            swipeOpen={daySwipeOpenKey === `planned:${slot}:${recipe.id}`}
                            onSwipeOpenChange={(next) =>
                              setDaySwipeOpenKey(next ? `planned:${slot}:${recipe.id}` : null)
                            }
                            onSwipeRemove={() => void removeTodayPlannedRecipe(slot, recipe)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              {/* もう1品足す入口(2026-08-11 便FP)。「今日の献立を探す」は空のときにしか
                  出ないため、1品でも入った時点で、献立の画面からまとめて足す道が消えていた。
                  飛び先は空のときと同じ＝選択モードのレシピ一覧 */}
              <button
                type="button"
                data-testid="today-add-more"
                onClick={() => navigate('/recipes?select=today')}
                className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
              >
                <Plus size={18} aria-hidden />
                {ja.mealPlan.todayAddMoreButton}
              </button>
              {/* 2026-08-17 便HI: 「別の提案を見る」（入れたあとの振り直し）は無くした。
                  組み合わせを見比べるのは**入れる前**にできるようになった（「今日なに作る？」の
                  「おまかせで献立を組む」を何度でも押せる）。入れたあとの振り直しは
                  今週の献立に入れた分を外せず、押すと画面とデータが食い違う操作だった */}
              {/* 「全て作った！」はいま日タブに並んでいる品すべて(①+②)を記録する。
                  2026-08-03 便DP-1: 押す前に件数つきの確認(規約F)、押したあとは件数つきの
                  トーストと「元に戻す」を出す。
                  2026-08-20 便II・⑥（オーナー原文「整理に作った！も入れたい。（略）全て作った！も
                  含めて。」＝便IGの原文で名指しされていた）: 行の「作った！」と一緒に
                  **整理モードの中**へ入れる。整理モードでないときは、この節は料理名の行と
                  「レシピ一覧から追加」だけになる */}
              {dayOrganizing && (
                <button
                  type="button"
                  onClick={() => void markAllDayRecipesCooked()}
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                >
                  <CheckCircle2 size={18} aria-hidden />
                  {ja.mealPlan.todayMarkAllCooked}
                </button>
              )}

              {/* 並行調理ナビは①②の両方を渡す(2026-08-03 便DH)。どの品で段取りを組むかは
                  ナビの画面で選ぶ(最大3品) */}
              {dayRecipeIds.length >= 2 && (
                <Link
                  to="/cook-navi"
                  className="mt-[var(--space-sm)] flex w-full items-center gap-2 rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
                >
                  <Route size={20} className="shrink-0 text-accent-ink" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-accent-ink">{ja.mealPlan.cookNaviEntry}</span>
                    <span className="block text-xs text-ink-muted">{ja.mealPlan.cookNaviEntrySub}</span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
                </Link>
              )}
            </section>
          )}
          {/* 2026-08-03 便DH(オーナー指示): 日タブの「表示する食事」は削除した。
              日タブは今日の予定を朝食・昼食・夕食すべて並べるようになり、絞る意味が無くなったため
              (設定そのもの=visibleMealSlots は週タブに残り、自動取り込みの対象もそちらで決まる) */}

          {/* ここから下が、2026-08-17 便HG でホーム画面から移してきた部分。
              「最近作ったもの」はその日の献立があってもなくても常に出す（オーナー指示）。

              2026-08-17 便HH（オーナー承認済み）で、押せるボタンの重なりを解いた:
               ・「レシピを探す」を外した。行き先(レシピ一覧)は下の並びの「レシピ」と
                 「今日の献立を探す」で着き、検索欄は一覧の上端に貼り付いて常に見えている
               ・「在庫の食材から探す」を外した。在庫で絞る操作は、この画面の
                 「今日なに作る？」の「在庫の食材から」と、レシピ一覧の絞り込み
                 「在庫の食材で絞る」に残っている
               ・「おまかせで献立を組む」を「今日なに作る？」の中へ移した
                 ＝**決めてもらう操作を1か所にまとめる**（planAction）

              2026-08-17 便HI（オーナー指示）で決まった並び:
               ・「今日なに作る？」は**どの日にも常に出す**。献立が決まっている日は
                 **畳んだ状態**（見出しを押すと開く）。便HHの小さいリンク「もう1品さがす」は
                 やめた＝同じ節を日によって違う名前で呼ばない
               ・「今日の献立を探す」は**「今日なに作る？」の下**（オーナー指定の位置）。
                 献立が決まっている日は出さない＝同じ操作を2か所に作らない
                 （決まっている日は「今日の献立」の中の「レシピ一覧から追加」が同じ行き先）

              2026-08-18 便HM（オーナー実機）で、この節の中身を1つの流れにまとめた。
              「ランダムで1品出す」と「おまかせで献立を組む」は**1つのボタン**になり、
              見出しの下の「1品」／「献立」の切り替えで中身が入れ替わる（components/TodaySuggestPanel）。
              おまかせを**献立が決まっている日にも出す**ようにしたのは、便HHで隠していた理由
              （「押すとさらに2品入ってしまう」）が便HIで消えたため——いまは押しても入らず、
              「今日の献立に入れる」で食事を選んだときだけ入る。決まっている日でも
              「レシピ一覧から追加」で何品でも足せるので、おまかせだけを隠す理由が無い。
              切り替えの片側が日によって消えると、覚えている選び方（設定 dayStartSuggestMode）が
              黙って無視されることにもなる */}
          <div className="mt-[var(--space-md)]">
            <TodaySuggestPanel
              recipes={ownRecipes}
              pantryNames={pantryNames}
              settings={settings}
              linkState={DAY_LINK_STATE}
              collapsible={dayHasPlan}
              pinnedRecipeId={returnedSuggestionId}
              onOpenSuggestion={rememberSuggestionForReturn}
              onShownOneChange={setShownSuggestionOneId}
              planPair={suggestPairRecipes}
              planCandidateCount={suggestCandidateCount}
              onDrawPlan={drawSuggestPair}
              onAddToToday={(picked, mode) =>
                setTodaySlotPick({
                  ids: picked.map((r) => r.id).filter((id): id is number => id != null),
                  from: mode === 'plan' ? 'plan' : 'one',
                  title: picked[0]?.title ?? '',
                })
              }
            />
          </div>

          {/* 「今日の献立を探す」（レシピ一覧を選択モードで開く）。
              2026-08-17 便HI（オーナー指示）で「今日なに作る？」の下へ移した。
              献立が決まっている日は出さない＝同じ行き先のボタンを2つ並べない
              （決まっている日は「今日の献立」の中の「レシピ一覧から追加」がこの行き先を持つ）。
              2026-08-11 便FP: 飛び先は ?select=today ＝レシピ一覧を**選択モードで**開く。
              向こうの画面が「今日の献立に入れるレシピを選んでいます」と名乗る */}
          {!dayHasPlan && (
            <button
              type="button"
              data-testid="day-choose"
              onClick={() => navigate('/recipes?select=today')}
              className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
            >
              <Plus size={18} aria-hidden />
              {ja.mealPlan.todayChooseButton}
            </button>
          )}

          {/* 「最近作ったもの」は、その日の献立があってもなくても常に出す（オーナー指示） */}
          <RecentCookedList
            recipes={ownRecipes}
            detachedEntries={detachedEntries}
            onOpen={setLogDetail}
          />

          {/* 作った記録の一覧への入口(2026-08-09 便EQ・オーナー「記録一覧への正規の行き方がわからない」)。
              週・月にはあったが、献立を開くと最初に出るこの日タブには無かった。
              日・週・月で同じ文言にそろえ、どこからでも同じ名前で辿れるようにする。
              「最近作ったもの」の中には同じ行き先を置かない（近くに同じリンクを2つ並べない） */}
          <Link
            to="/history?back=day"
            onClick={rememberDayReturn}
            className="mt-[var(--space-md)] flex items-center justify-center gap-0.5 text-center text-sm font-bold text-accent-ink underline"
          >
            {ja.mealPlan.historyLink}
            <ChevronRight size={16} aria-hidden />
          </Link>
        </>
      )}

      {viewMode === 'month' &&
        (monthUnlocked ? (
          <div className="mt-[var(--space-md)]">
            {/* お試し表示中の控えめな一言(2026-08-02 便CP-2・docs/62 決定③)。
                いま見ているものが何なのかと、解錠すると何が変わるのかを1行だけ添える */}
            {monthTrialActive && (
              <p
                data-testid="month-trial-active"
                className="mb-[var(--space-sm)] rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink-muted"
              >
                {ja.mealPlan.monthTrialActiveNote}
              </p>
            )}
            {/* カレンダーの表示のしかたの切り替え(2026-07-28 便CA・タスク2・オーナー指示)。
                既定は写真＞献立プレビュー。栄養/食費に切り替えると各セルにその日の1人分の数字が出る。
                選択は設定に記憶する(次に月タブを開いても同じ表示)。
                2026-08-07 便DU(オーナー指示): ①月タブを開いてすぐカレンダーが見えるように、
                この切り替えごとカレンダーの直前へ移した ②「説明がなく何のボタンか分からない。
                特に栄養と食費が何の数値か」への対応として、見出しを目に見える形で出し、
                選んだモードでカレンダーに何が出るのかをボタンのすぐ下に1行で添える
                (従来はカレンダーの下に、数字モードのときだけ凡例を出していた) */}
            {/* 2026-08-22 便JE・②（オーナー確定「①：面でまとめる。月も同じように。」）:
                月の設定パート（カレンダーの表示のしかたの選択／レシピの写真は使わない／期間で絞る）を
                1枚の面（.setup-panel）にまとめ、中は仕切り線で分ける。
                直す前は入れ物が無く、操作が地の上に直接並んでいたので、どこまでが設定で
                どこからがカレンダーなのかが読み取れなかった。
                **月の移動（前の月／今月へ戻る／次の月）はこの面に入れていない**＝
                カレンダーそのものを動かす操作なので、週タブの「週の移動」と同じくカレンダー側に置く。
                曜日の見出しとカレンダー本体もページの地の上のままなので、
                面が終わるところがそのまま境目になる */}
            <div className="setup-panel mt-[var(--space-md)]">
            <div className="p-[var(--space-sm)]">
              <p id="month-cell-mode-label" className="text-xs font-bold text-ink-muted">
                {ja.mealPlan.monthCellModeLabel}
              </p>
              {/* 2026-08-28 オーナー原文「週の『表示のしかた』に合わせた表記への修正でした。」:
                  名札（月の「カレンダーの表示のしかた」）が受け持つ範囲を、週タブの節と同じく
                  **この面の表示の設定ぜんぶ**にした。直す前は名札の下（role="group"）に
                  3つのモードのボタンしか入っておらず、同じ表示の設定である
                  「レシピの写真は使わない」と「マスに出す栄養」が名札の外に落ちていた */}
              <div role="group" aria-labelledby="month-cell-mode-label">
              <div className="mt-1 flex gap-1">
                {MONTH_CELL_MODES.filter(
                  (m) => m.value !== 'nutrition' || isNutritionUnlocked(monthUnlocked),
                ).map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => saveSettings({ monthCellMode: m.value })}
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
              {/* 選んだモードの説明(便DU)。
                  2026-08-19 便HV・⑩(オーナー原文「カレンダー自体が過去は記録のみ、未来は予定のみ、
                  当日は両方を表示しています。説明が長いので、数値が概算であることと1日分の
                  数値であることの説明のみで良いのでは？」): 数え方の説明はカレンダーそのものが
                  示しているので落とし、概算であることと「その日に1人が食べる分」だけを言う */}
              <p className="mt-1 text-xs text-ink-muted">
                {monthCellMode === 'nutrition'
                  ? ja.mealPlan.monthCellNutritionLegend
                      .replace('{name}', nutritionLabelFor(monthCellNutrient))
                      .replace('{unit}', nutritionUnitFor(monthCellNutrient))
                  : monthCellMode === 'cost'
                    ? ja.mealPlan.monthCellCostLegend
                    : ja.mealPlan.monthCellModePhotoLegend}
              </p>
              {/* マスに出す栄養の項目(2026-08-19 便HV・⑥・オーナー指示「カレンダーに移す情報が
                  栄養の時、基本はカロリーのまま、他の栄養表示も選択で見られるようにして」)。
                  既定は従来どおりエネルギー。顔ぶれ・並び・名前は栄養価の表示と同じ1か所
                  (NUTRITION_DISPLAY_KEYS)から引く＝便HU・⑯でそろえた並び替えとも同じになる。
                  無料/Proの線引きは動かしていない: この「栄養」モード自体が栄養の解錠済み
                  (isNutritionUnlocked)のときしか出ないので、無料のままでは8項目のどれも見えない。
                  写真モードの「レシピの写真は使わない」と同じ位置・同じ作りで置く */}
              {monthCellMode === 'nutrition' && (
                <label className="mt-[var(--space-sm)] block">
                  <span className="block text-xs font-bold text-ink-muted">
                    {ja.mealPlan.monthCellNutrientLabel}
                  </span>
                  <select
                    data-testid="month-cell-nutrient"
                    value={monthCellNutrient}
                    onChange={(e) =>
                      saveSettings({
                        monthCellNutrient: resolveNutritionDisplayKey(e.target.value),
                      })
                    }
                    className="select-control mt-1 w-full"
                  >
                    {NUTRITION_DISPLAY_KEYS.map((key) => (
                      <option key={key} value={key}>
                        {nutritionLabelFor(key)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {/* 写真の出どころの切り替え(2026-08-07 便DU・オーナー指示)。
                  カレンダーの写真は「作った記録の写真 ＞ レシピに登録した写真」の順で選ぶが、
                  レシピの写真を代用に使いたくない人のために、使わない選択肢を置く。
                  写真モードのときだけ出す(栄養/食費モードでは写真を敷かないため) */}
              {/* 2026-08-28 オーナー原文「『レシピの写真は使わない』など、ONOFFするタイプの
                  ボタンはスイッチ（またはチェック入れるタイプ）にしてください。（アプリ全体）」:
                  押すと settings に残る入切なのでスイッチにした。作りはアプリに既にある
                  ON/OFFスイッチ（設定の「ごはんを含める」・レシピ一覧の「すべてのタグを含む」等）と
                  同じ作法にそろえる——role="switch" + aria-checked、名前の右にスイッチ、
                  押せる面は tap-target。**新しい形は作らない**。
                  絞り込みのチップ（複数選べる・その場だけのもの）はチップのまま残す */}
              {monthCellMode === 'photo' && (
                <div className="mt-[var(--space-sm)]">
                  <label className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-sm font-bold text-ink-muted">
                      {ja.mealPlan.monthHideRecipePhotoToggle}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      data-testid="month-hide-recipe-photo"
                      aria-checked={monthHideRecipePhoto}
                      aria-label={ja.mealPlan.monthHideRecipePhotoToggle}
                      onClick={() => saveSettings({ monthHideRecipePhoto: !monthHideRecipePhoto })}
                      className={`tap-target relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                        monthHideRecipePhoto ? 'bg-accent' : 'bg-edge'
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                          monthHideRecipePhoto ? 'left-7' : 'left-1'
                        }`}
                      />
                    </button>
                  </label>
                  <p className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.monthHideRecipePhotoNote}
                  </p>
                </div>
              )}
              </div>
            </div>
            </div>

            {/* 月の移動。2026-08-26 便LH（オーナー原文「設定エリアと日付の位置を逆にして
                （週と同じに）。」）: 設定の面の**下**へ移した＝週タブと同じ並び
                （設定の面 → 日付の移動 → 中身）になる。
                面の外に置くのは今までどおり（カレンダーそのものを動かす操作なので） */}
            <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, -1))}
                aria-label={ja.mealPlan.prevMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor(today)}
                aria-label={isAtCurrentMonth ? undefined : ja.mealPlan.thisMonth}
                className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted tabular-nums shadow-sm"
              >
                {/* 今月に戻ると印が消えて幅が18px縮み、左右の送りボタンの見え方がぶれる。
                    場所は空けたままにして押しても動かさない（便EO） */}
                <RotateCcw
                  size={14}
                  className={`text-accent-ink ${isAtCurrentMonth ? 'invisible' : ''}`}
                  aria-hidden
                />
                {monthAnchor.slice(0, 4)}/{monthAnchor.slice(5, 7)}
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, 1))}
                aria-label={ja.mealPlan.nextMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>

            <div className="mt-[var(--space-md)] grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-muted">
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
                    nutrient={monthCellNutrient}
                    stat={monthDayStats.get(date)}
                    showPlanDot={monthDaysWithPlan.has(date) && !isPastDate(date, today)}
                    planPreview={monthDayPreview.get(date)}
                    isEmptyFuture={isEmptyFuture}
                    hasLog={monthDaysWithLog.has(date)}
                    hasNote={monthDayNoteByDate.has(date)}
                    coverPhoto={monthDayCoverPhoto.get(date)}
                    onClick={() => (costMode ? handleRangeDayTap(date) : openDayModal(date))}
                  />
                )
              })}
            </div>

            {/* 「期間で絞る」はカレンダーのすぐ下（2026-08-26 便LH・オーナー原文
                「「期間で絞る」ボタンはカレンダー下へ。」）。日付はカレンダーをタップして選ぶので、
                選ぶ相手のすぐ下に置く。押すたびにON/OFFを切り替え、切り替え時は選択もリセットする。
                ここで期間がそろうと、下の食費・栄養・献立をまとめて提案・テンプレート・献立表が
                そろってその期間を相手にする（monthTargetDates）＝別のカードは増やさない */}
            <div className="mt-[var(--space-md)]">
            <div className="flex items-center justify-between gap-2">
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
                <p className="text-sm font-bold text-accent-ink">
                  {rangeStart == null ? ja.mealPlan.rangeCostGuideStart : ja.mealPlan.rangeCostGuideEnd}
                </p>
              )}
            </div>
            {/* 開始日・終了日の手入力(2026-08-08 便EA・オーナー指示)。
                カレンダーのタップと同じ値を書き換える。月をまたぐ期間もここから組める
                (集計はrangeCookedDishes/rangePlannedDishesが選んだ期間そのものを読む) */}
            <Collapse open={costMode}>
              <div className="mt-[var(--space-sm)] rounded-md border border-edge p-[var(--space-sm)]">
                <p className="text-xs text-ink-muted">{ja.mealPlan.rangeDateInputNote}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                    {ja.mealPlan.rangeDateStartLabel}
                    <input
                      type="date"
                      data-testid="range-date-start"
                      value={rangeStart ?? ''}
                      onChange={(e) => setRangeBound('start', e.target.value)}
                      className="rounded-sm border border-edge bg-surface px-2 py-2 text-sm text-ink"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                    {ja.mealPlan.rangeDateEndLabel}
                    <input
                      type="date"
                      data-testid="range-date-end"
                      value={rangeEnd ?? ''}
                      onChange={(e) => setRangeBound('end', e.target.value)}
                      className="rounded-sm border border-edge bg-surface px-2 py-2 text-sm text-ink"
                    />
                  </label>
                </div>
              </div>
            </Collapse>
            {/* 選んだ期間は、折りたたみを開かなくても読める1行として置く
                （2026-08-08 便EA「選んだ期間の文字を大きく」の扱いは変えない） */}
            {monthRangeActive && rangeStart != null && rangeEnd != null && (
              <>
                <p
                  data-testid="range-selected-period"
                  className="mt-[var(--space-sm)] text-xl font-bold text-accent-ink"
                >
                  {ja.mealPlan.rangeCostResultRange
                    .replace('{sm}', String(Number(rangeStart.slice(5, 7))))
                    .replace('{sd}', String(Number(rangeStart.slice(8, 10))))
                    .replace('{em}', String(Number(rangeEnd.slice(5, 7))))
                    .replace('{ed}', String(Number(rangeEnd.slice(8, 10))))
                    .replace('{n}', String(rangeDays))}
                </p>
                {/* どの日をどちらの基準で数えたかは、数字より先に読めるようにここへ置く */}
                <p className="mt-0.5 text-xs text-ink-muted">
                  {intakeBasisText(monthIntakeSummary)}
                </p>
              </>
            )}
            </div>

            {/* 食費と栄養は1枚の面に2節（2026-08-26 便LH・オーナー原文「食費と栄養はそれぞれ
                折りたたみ１列で１グループにまとめる。期間を絞ったら非表示にする（期間の食費と栄養が
                出るので）。というより。１ヶ月分の内容が、そのまま絞った期間の内容に書き変わるのが
                ベスト。」）: 期間を絞ったときに**別のカードを足すのをやめた**。
                この2節の見出しと中身が、そのまま選んだ期間のものに入れ替わる
                （旧「期間の食費と栄養」カードは廃止）。畳んだときに出す数値も同じ場所のまま */}
            <div
              className="setup-panel mt-[var(--space-md)]"
              data-testid={monthRangeActive ? 'range-result-card' : undefined}
            >
            {/* 節1: 食費(2026-08-03 便DQ・オーナー指示「食費と栄養は完全に分けて表示したい。
                文字が多すぎ。ここでユーザーが見たいのは数値です」)。
                数え方は過ぎた日=作った記録・今日から先=登録した献立。
                畳んでいるときに出すのは合計1つだけ(2026-08-19 便HV・⑨) */}
            <section className="p-[var(--space-sm)]">
              <MonthCardHeader
                title={
                  monthRangeActive
                    ? ja.mealPlan.rangeCostCardTitle
                    : ja.mealPlan.monthCostTitle.replace(
                        '{m}',
                        String(Number(monthAnchor.slice(5, 7))),
                      )
                }
                open={monthCostCardOpen}
                onToggle={() => setMonthCostCardOpen((v) => !v)}
                figure={
                  !monthCostCardOpen && monthIntakeDishCount > 0
                    ? ja.mealPlan.intakeCostYen.replace(
                        '{n}',
                        monthIntakeSummary.householdYen.toLocaleString(),
                      )
                    : undefined
                }
                figureTestId="month-cost-folded"
                toggleTestId="month-cost-toggle"
              />
              {/* 数える対象が1品も無いときは、金額の代わりに理由を1行で置く(畳んだままでも読める) */}
              {!monthCostCardOpen && monthIntakeDishCount === 0 && (
                <p className="mt-1 text-sm text-ink-muted">{monthIntakeEmptyText}</p>
              )}
              <Collapse open={monthCostCardOpen}>
                {monthIntakeDishCount === 0 ? (
                <p className="mt-1 text-sm text-ink-muted">{monthIntakeEmptyText}</p>
              ) : (
                <>
                  {/* 行の見出し＝何の数字か、その下の小さい字＝数え方。
                      「1人分」は範囲ぜんぶ(過ぎた日の記録＋今日から先の献立)を1食ずつ足した合計、
                      「全員分」は作った食数・これから作る食数ぶん＝実際に出ていく食費、と
                      対象が違うので必ず書く。「1日あたりの平均」の分母は月と期間で別物
                      (月＝記録か献立のある日数／期間＝選んだ日数)なので、行に分母を書く */}
                  <IntakeCostTable
                    testId={monthRangeActive ? 'range-cost-table' : 'month-cost-table'}
                    rows={[
                      {
                        label: ja.mealPlan.intakeCostRowPersonal,
                        note: ja.mealPlan.intakeCostRowPersonalNote,
                        yen: monthIntakeSummary.personalYen,
                        meals: ja.mealPlan.intakeCostMeals.replace(
                          '{n}',
                          String(monthIntakeDishCount),
                        ),
                      },
                      // 期間のときだけ、1人分のすぐ下に「選んだ◯日で割った平均」を置く
                      // (月のときは全員分のあとに、別の分母の平均を置く。並びは従来のまま)
                      ...(monthRangeActive
                        ? [
                            {
                              label: ja.mealPlan.intakeCostRowPerDay,
                              note: ja.mealPlan.rangeCostRowPerDayNote.replace(
                                '{d}',
                                String(rangeDays),
                              ),
                              yen: rangePersonalPerDay,
                              meals: null,
                            },
                          ]
                        : []),
                      ...(monthIntakeSummary.mealCount > 0
                        ? [
                            {
                              label: ja.mealPlan.intakeCostRowHousehold,
                              note: ja.mealPlan.intakeCostRowHouseholdNote,
                              yen: monthIntakeSummary.householdYen,
                              meals: ja.mealPlan.intakeCostMealsTotal.replace(
                                '{n}',
                                String(monthIntakeSummary.mealCount),
                              ),
                            },
                          ]
                        : []),
                      ...(!monthRangeActive && monthIntakeSummary.dayCount > 0
                        ? [
                            {
                              label: ja.mealPlan.intakeCostRowPerDay,
                              note: ja.mealPlan.monthCostRowPerDayNote.replace(
                                '{d}',
                                String(monthIntakeSummary.dayCount),
                              ),
                              yen: monthIntakeSummary.perDayYen,
                              meals: null,
                            },
                          ]
                        : []),
                    ]}
                  />
                  {/* どの日をどちらの基準で数えたかを必ず出す
                      (期間のときはカレンダーの下で先に出しているので、ここでは繰り返さない) */}
                  {!monthRangeActive && (
                    <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                      {intakeBasisText(monthIntakeSummary)}
                    </p>
                  )}
                  {/* 数字の前提（食材の目安価格で自動計算していること）は、折りたたみの中の
                      weekCostNote が同じ中身を言っているので、外にもう1行置かない
                      （2026-08-28 オーナー「内訳の中にも同じ内容の文があるため」） */}
                  <IntakeDisclosureButton
                    open={monthCostDetailsOpen}
                    onToggle={() =>
                      monthRangeActive
                        ? setRangeSummaryOpen((v) => !v)
                        : setMonthSummaryOpen((v) => !v)
                    }
                    openLabel={ja.mealPlan.intakeCostDetailsOpen}
                    closeLabel={ja.mealPlan.intakeCostDetailsClose}
                  />
                  <Collapse open={monthCostDetailsOpen}>
                    <IntakeCostDetails
                      summary={monthIntakeSummary}
                      pricelessCount={monthRangeActive ? rangePricelessCount : monthPricelessCount}
                    />
                  </Collapse>
                </>
                )}
              </Collapse>
            </section>

            {/* 節2: 栄養(2026-08-03 便DQで食費と分離)。8項目の数値はカードを開けば畳まずに出し、
                長い但し書きと出典だけをさらに折りたたみへ回す(規約H)。
                Pro解錠時のみ(既存のゲートと同じisNutritionUnlocked判定) */}
            {isNutritionUnlocked(monthUnlocked) && monthIntakeSummary.nutrition.dishCount > 0 && (
                <section className="p-[var(--space-sm)]">
                  {/* 畳んでいるときに出すのはエネルギーの合計1つだけ(2026-08-19 便HV・⑨) */}
                  <MonthCardHeader
                    title={
                      monthRangeActive
                        ? ja.mealPlan.rangeNutritionCardTitle
                        : ja.mealPlan.monthNutritionTitle.replace(
                            '{m}',
                            String(Number(monthAnchor.slice(5, 7))),
                          )
                    }
                    open={monthNutritionCardOpen}
                    onToggle={() => setMonthNutritionCardOpen((v) => !v)}
                    figure={
                      !monthNutritionCardOpen
                        ? formatNutrient('kcal', monthIntakeSummary.nutrition.total.kcal)
                        : undefined
                    }
                    figureTestId="month-nutrition-folded"
                    toggleTestId="month-nutrition-toggle"
                  />
                  <Collapse open={monthNutritionCardOpen}>
                  <>
                  <div className="mt-[var(--space-sm)]" data-testid="month-nutrition-panel">
                    <IntakeNutritionPanel
                      summary={monthIntakeSummary}
                      notes="brief"
                      /* 2026-08-28 便MA: 計算できなかった料理の名前から開いた詳細を、
                         この月タブ（期間で絞っていればその期間）へ帰す */
                      dishLink={gapDishLink}
                    />
                  </div>

                  {/* 目的モードの「答え合わせ」(旧「この月の『栄養から組む』」・2026-08-02 便CP-2・
                      docs/62 決定②)は、2026-08-19 便HV・⑨のオーナー指示で削除した。
                      失われるのは**この月の振り返りの表示だけ**で、「栄養から組む」の機能そのもの
                      (提案が選んだ栄養に沿う組み方・献立の枠に purpose を残すこと)は変えていない */}
                  <IntakeDisclosureButton
                    open={monthNutritionNotesShown}
                    onToggle={() =>
                      monthRangeActive
                        ? setRangeNutritionNotesOpen((v) => !v)
                        : setMonthNutritionNotesOpen((v) => !v)
                    }
                    openLabel={ja.mealPlan.intakeNutritionNotesOpen}
                    closeLabel={ja.mealPlan.intakeNutritionNotesClose}
                  />
                  <Collapse open={monthNutritionNotesShown}>
                    <div className="mt-[var(--space-sm)]">
                      <NutritionSourceNotes />
                    </div>
                  </Collapse>
                  </>
                  </Collapse>
                </section>
              )}

            </div>

            {/* 献立を入れる操作は1グループ（2026-08-26 便LH・オーナー原文「献立関連のボタンが
                バラバラに配置してあるように見えるので、１グループにまとめて。折りたたみの
                見える部分は「献立をまとめて提案」のみ。」）。
                直す前は「現在の条件」「献立をまとめて提案」「テンプレートを適用」の3つが
                面にも囲みにも入らず、地の上に3か所ばらばらに並んでいた。
                畳んでいるときに見えるのは「献立をまとめて提案」のボタンだけで、
                節そのものの名前は開閉ボタンの読み上げ名にだけ使う（画面には文字を出さない）。
                中身の並びは「押すと何が起きるか」→「現在の条件」→「テンプレート」 */}
            {!isDemo && (
              <div className="setup-panel mt-[var(--space-md)]">
                <section className="p-[var(--space-sm)]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      data-testid="month-fill-run"
                      onClick={() => void fillMonth()}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-bold text-on-accent shadow-sm"
                    >
                      <Dices size={18} aria-hidden />
                      {ja.mealPlan.fillMonth}
                    </button>
                    <button
                      type="button"
                      data-testid="month-plan-group-toggle"
                      onClick={() => setMonthPlanGroupOpen((v) => !v)}
                      aria-expanded={monthPlanGroupOpen}
                      aria-label={(monthPlanGroupOpen
                        ? ja.mealPlan.weekGroupToggleCloseAria
                        : ja.mealPlan.weekGroupToggleOpenAria
                      ).replace('{group}', ja.mealPlan.monthPlanGroupTitle)}
                      className="ml-auto flex min-h-11 shrink-0 items-center py-1.5"
                    >
                      {monthPlanGroupOpen ? (
                        <ChevronUp size={18} className="shrink-0 text-ink-muted" aria-hidden />
                      ) : (
                        <ChevronDown size={18} className="shrink-0 text-ink-muted" aria-hidden />
                      )}
                    </button>
                  </div>
                  <Collapse open={monthPlanGroupOpen}>
                    <>
                      {/* 押すと何が入るか。期間で絞っているあいだは入る先も選んだ期間になる */}
                      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                        {monthRangeActive
                          ? ja.mealPlan.fillMonthRangeHint
                          : ja.mealPlan.fillMonthHint}
                      </p>
                      {/* 入れる先の食事（2026-08-28 便MD）。押さなければ表示する食事ぜんぶ＝今までと同じ */}
                      {renderSlotPicker(
                        ja.mealPlan.fillSlotPickLabel,
                        ja.mealPlan.fillSlotPickAria,
                        'month-fill-slot',
                        fillTargetSlots,
                        toggleFillSlot,
                      )}
                      {/* 自動提案の条件(2026-07-30 便CH/C11)。この条件は週タブと共有していて、
                          月の「献立をまとめて提案」にもそのまま効く */}
                      {renderSuggestConditions()}
                      {/* テンプレート(2026-08-26 便LH・オーナー原文「テンプレートは週のみで
                          作成できるの？月にある意味ないのでは？使い方も、どこに入れられるのかも
                          よくわからん。」): ボタン名に**入る先**を入れ、作る場所も1行で言う。
                          月に残すのは、曜日で絞ったテンプレートを何週ぶんもまとめて入れられるのが
                          月だけだから(週タブは1週ずつしか入れられない) */}
                      <div className="mt-[var(--space-sm)]">
                        <button
                          type="button"
                          data-testid="month-template-apply"
                          onClick={() => openTemplateApply('month')}
                          className="tap-target inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                        >
                          <LayoutTemplate size={14} aria-hidden />
                          {monthRangeActive
                            ? ja.mealPlan.templateApplyRange
                            : ja.mealPlan.templateApplyMonth}
                        </button>
                        <p className="mt-1 text-xs text-ink-muted">
                          {ja.mealPlan.templateMonthNote}
                        </p>
                      </div>
                    </>
                  </Collapse>
                </section>
              </div>
            )}

            {/* A-4 献立表(印刷・画像で保存)。この月の分を1枚にまとめる(2026-07-29 便CB-2・docs/59) */}
            {renderPlanSheetSection(monthPlanSheet)}

            {/* 「作った記録」の一覧への入口(2026-08-02 便DE-11・オーナー指示)。
                週タブにしか無かったので月からも開けるようにし、戻るはこの月タブへ返す(?back=month)。
                2026-08-09 便EQ: 離れる直前の月と縦位置も覚えて、戻ったら同じ場所へ返す */}
            {!isDemo && (
              <Link
                to="/history?back=month"
                onClick={rememberMonthReturn}
                className="mt-[var(--space-md)] flex items-center justify-center gap-0.5 text-center text-sm font-bold text-accent-ink underline"
              >
                {ja.mealPlan.historyLink}
                <ChevronRight size={16} aria-hidden />
              </Link>
            )}
          </div>
        ) : (
          // 未解錠ユーザーへの鍵付きプレビュー(2026-07-24 便BS・タスク6・規約H準拠)。月タブを完全に
          // 隠さず、ぼかしたサンプルカレンダーの上に、機能の性質を素直に説明するロック案内を重ねる
          // (卑下しない・購入圧を強くしない)。サンプルは飾りなのでaria-hidden
          <div className="mt-[var(--space-md)]">
            {/* 2026-08-02 便CP-2: お試しの入口を足して案内が縦に伸びたため、重ね方を反転した。
                以前は「ぼかしたサンプル＝高さの基準／案内＝absoluteで中央に重ねる」だったので、
                案内がサンプルより高くなるとバッジとリンクがカードからはみ出して切れていた。
                サンプル（飾り）を絶対配置の背景にし、案内を通常のflowに置く＝案内の高さでカードが伸びる */}
            <div className="relative overflow-hidden rounded-md border border-edge bg-surface shadow-sm">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 select-none p-[var(--space-md)] opacity-70 blur-[3px]"
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
                        className={`relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-card border text-xs ${
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
              {/* サンプルを覆う膜（案内を読みやすくするための薄い幕。飾りなのでaria-hidden） */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-app/40 backdrop-blur-[1px]"
              />
              {/* ロックの案内(機能の性質を素直に説明・購入圧を強くしすぎない) */}
              <div className="relative flex min-h-[16rem] flex-col items-center justify-center gap-1 p-[var(--space-md)] text-center">
                <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-surface px-3 py-1 text-sm font-bold text-accent-ink shadow-sm">
                  <Lock size={14} aria-hidden />
                  {ja.mealPlan.monthLockedBadge}
                </span>
                <p className="mt-1 font-bold">{ja.mealPlan.monthLockedTitle}</p>
                {/* 2026-08-25 便KN・オーナー指示（長い説明は箇条書きに）: 185字の1段落を5行に分け、
                    文頭に「・」を付ける。この枠は中央そろえだが、箇条書きは行頭がそろっていないと
                    印の意味が無いので、この一覧だけ左そろえにする（枠の幅いっぱいは使わず
                    inline-block で中身の幅にとどめる＝枠の中では今までどおり中央に乗る）。
                    印は飾りなので読み上げには渡さない（aria-hidden） */}
                <ul className="mx-auto mt-0.5 inline-block space-y-0.5 text-left text-sm text-ink-muted">
                  {ja.mealPlan.monthLockedDescriptionLines.map((line) => (
                    <li key={line} className="flex gap-1.5">
                      <span aria-hidden>・</span>
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
                {/* 恒常のお試し(2026-08-02 便CP-2・docs/62 決定③)。押すと、この画面のサンプルではなく
                    本人の記録・献立が入った本物の月タブが1回だけフル表示になる（閉じたらここへ戻る）。
                    2026-08-02 オーナー指摘: 「作った記録」が少ないうちは入口を出さず、
                    たまったら使えることだけを控えめに知らせる（1回きりのお試しを、ほぼ空の
                    カレンダーで使い切ってしまう事故を防ぐ）。使用済みの知らせが最優先 */}
                {monthTrialAvailable ? (
                  <button
                    type="button"
                    data-testid="month-trial-start"
                    onClick={() => void startMonthTrial()}
                    className="mt-[var(--space-sm)] inline-flex items-center justify-center rounded-md bg-accent px-4 py-3 font-bold text-on-accent shadow-sm"
                  >
                    {ja.mealPlan.monthTrialButton}
                  </button>
                ) : monthTrialUnused ? (
                  <p data-testid="month-trial-pending" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.monthTrialPendingNote.replace(
                      '{n}',
                      String(MONTH_TRIAL_MIN_COOKED),
                    )}
                  </p>
                ) : (
                  <p data-testid="month-trial-used" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.monthTrialUsedNote}
                  </p>
                )}
                {/* サンプルデモ(2026-08-02 便DC)。1回だけのお試しとは別枠で、記録がまだ少ない人も
                    お試しを使い切った人も、見本の1か月分が入った月の画面をここから何度でも開ける */}
                <Link
                  /* 2026-08-22 便JF・⑦: 戻り先を「/meal-plan」で決め打ちにしていたので、
                     見ていた月やタブの状態を落として献立の初期表示へ帰していた。
                     すぐ下のPro案内と同じく、いま出ている画面のパスをそのまま載せる */
                  to={`/month-demo?back=${encodeURIComponent(location.pathname + location.search)}`}
                  data-testid="month-demo-link"
                  className="mt-[var(--space-sm)] inline-flex items-center justify-center rounded-md border border-accent bg-surface px-4 py-3 font-bold text-accent-ink shadow-sm"
                >
                  {ja.mealPlan.monthDemoLink}
                </Link>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.monthDemoLinkNote}</p>
                <Link
                  /* 2026-08-27 便LU: すぐ上のサンプルデモと同じく、見ていた月・縦位置・
                     開いていた日の窓ごと帰す（現在地のパスだけでは日タブへ着地していた） */
                  {...proGateDetour}
                  className="mt-1 inline-block text-sm font-bold text-accent-ink underline"
                >
                  {ja.mealPlan.monthProGateLink}
                </Link>
              </div>
            </div>
          </div>
        ))}

      {viewMode === 'week' && (
      <>
      {/* 2026-08-02 便DE-10(オーナー指示): 週タブの操作は「色も形も同じボタン」が並んでいて
          グループ分けが曖昧だったため、機能ごとに囲み＋見出しで分けた。
          2026-08-03 便DJ(オーナー指示): 3グループをそれぞれ折りたたみにし、既定で開くのは
          「献立を提案」だけにした。
          2026-08-07 便DT-3/6(オーナー指示): ①日付(週)の切り替え欄を「すべて畳む」の上へ移し、
          7日分のカードのすぐ上に置く（見ている週を変える操作を、カードの並びの直前に置く）
          ②畳んでいても使うボタンは各グループの見出しの横に集める。
          並びは 表示のしかた → 献立を提案 → 献立テンプレート → 週の移動 → すべて畳む → 7日分 */}

      {/* グループ1: 表示のしかた(週の区切り・表示する食事・まとめて空にする)。
          「表示する食事」は見出しの横＝畳んでも常に同じ場所に見える(便DT-6)。
          2026-08-03 便DP-7(オーナー指示): 開いたときの並びは 週の区切り → まとめて空にする
          (表示を決めるものを先に置き、消す操作を最後に離す)。

          2026-08-21 便IN: 「まとめて空にする」を折りたたみの外（この節のいちばん下）へ出した。
          2026-08-22 便IVで**折りたたみの中へ戻した**（オーナー原文「「表示のしかた」の
          折りたたんだ表示には、空にする項目を入れないで」）。便INは「折りたたみを一切開かなくても
          最低限一通りすべての機能を触れる」を全部の操作に当てはめたが、オーナーが同じ書き溜めで
          「折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
          初心者が使わないような機能はしまっておく、という意味合いでした。」と訂正している。
          週の献立をまとめて消すのは、まさに初心者が毎日使う操作ではないので**しまう側**。
          開いているときの並び（週の区切り → まとめて空にする）は今までと変わらない。
          対象の食事のチップも囲みごと中に入るので、畳んでいる間に見出しの横の
          「表示する食事」と同じ形のチップが2組並ぶこともなくなった（便INが避けていた問題）。 */}
      {/* 2026-08-22 便JE・①（オーナー確定「①：面でまとめる。月も同じように。」）:
          設定の3節（表示のしかた／献立を提案／過去の献立・テンプレートから入れる）を
          1枚の面（.setup-panel＝カード面・外枠1本）にまとめ、中は仕切り線で分ける。
          直す前は、3節それぞれが下に並ぶ曜日カードと**同じ形の箱**だったので、
          どこまでが設定でどこからが週の献立なのかが読み取れなかった。
          週の移動から下（すべて畳む・7日分のカード）はページの地の上のままなので、
          面が終わるところがそのまま境目になる。面の作り方は src/index.css の .setup-panel */}
      <div className="setup-panel mt-[var(--space-md)]">
      <section className="p-[var(--space-sm)]">
        {renderWeekGroupHeader(
          'display',
          ja.mealPlan.weekGroupDisplayTitle,
          renderSlotFilter(),
        )}
        <Collapse open={weekGroupOpen.display}>
          <>
            {/* 週の表示起点の切替(2026-07-24 便BH-3・タスク3): 従来の週区切り⇄今日を先頭に7日間。
                既定は週区切り・選択は記憶する。
                2026-08-22 便JF・⑤(オーナー原文「表示のしかたの、週区切りと今日から7日間は、
                プルダウン」): 押し分ける2つのチップをやめてプルダウンにした。
                同じ節の中に「表示する食事」「まとめて空にする」の**押して選ぶチップ**が並んでおり、
                そちらは複数選べる（何個でも押せる）のに、この2つは片方しか選べない。
                同じ形で並べていたので、押してみるまで違いが分からなかった。
                見た目は「献立を提案」のプルダウン(select-control)と同じものを使う */}
            <label className="mt-[var(--space-sm)] block">
              <span className="text-sm font-bold text-ink-muted">{ja.mealPlan.weekLayoutLabel}</span>
              <select
                data-testid="week-layout"
                value={rollingWeek ? 'rolling' : 'calendar'}
                onChange={(e) => setWeekLayout(e.target.value === 'rolling')}
                className="select-control mt-1 w-full"
              >
                <option value="calendar">{ja.mealPlan.weekLayoutCalendar}</option>
                <option value="rolling">{ja.mealPlan.weekLayoutRolling}</option>
              </select>
            </label>
            {/* 2つの表示の違いを一言で示す(2026-07-29 便CD/MP-14)。名前だけでは意味が分からず
                3体が切替自体を触っていなかった */}
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.weekLayoutHint}</p>

            {/* 食事を選んでこの週の予定をまとめて空にする(便U-4 → 便CW-3で改名・折りたたみ →
                2026-08-03 便DJ(オーナー指示)で「表示のしかた」グループの中へ移した →
                2026-08-21 便INで折りたたみの外へ出した → 2026-08-22 便IVで中へ戻した)。
                朝食・昼食・夕食は複数選べる。確認文は規約Fのまま
                (何が消えるか・何が残るかを件数つきで両方書く)。
                中へ戻した理由は上の節の頭に書いてある（オーナーの訂正）。
                対象の食事のチップも囲みも同じ折りたたみの中なので、
                「どの食事が消えるのか」は押す前に必ず同じ場所で読める */}
            <div className="mt-[var(--space-md)] rounded-sm border border-edge bg-app p-[var(--space-sm)]">
              <p className="text-xs font-bold text-ink-muted">
                {clearSlotTargets.length === 0
                  ? ja.mealPlan.clearWeekSlotTitleNone
                  : ja.mealPlan.clearWeekSlotTitle.replace('{slot}', clearSlotLabel)}
              </p>
              <div className="mt-[var(--space-sm)] flex flex-wrap gap-2">
                {MEAL_SLOTS.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => toggleClearSlotTarget(slot)}
                    aria-pressed={clearSlotTargets.includes(slot)}
                    aria-label={ja.mealPlan.clearWeekSlotTargetAria.replace(
                      '{slot}',
                      ja.mealPlan.slot[slot],
                    )}
                    className={chipClass(clearSlotTargets.includes(slot))}
                    style={chipStyle(clearSlotTargets.includes(slot))}
                  >
                    <ChipCheck on={clearSlotTargets.includes(slot)} />
                    {ja.mealPlan.slot[slot]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="week-clear-slot"
                onClick={() => void clearWeekSlot()}
                /* tap-target: 消す操作は指で確実に押せる大きさを保つ
                   （見た目の大きさ・色は変えない。消す操作を目立たせない作りのまま） */
                className="tap-target mt-2 inline-flex items-center gap-1 text-sm font-bold text-warning underline"
              >
                <Trash2 size={14} aria-hidden />
                {ja.mealPlan.clearWeekSlotButton}
              </button>
            </div>
          </>
        </Collapse>
      </section>

      {/* グループ2: 献立を提案。押すと献立が増える操作をここに集める。
          2026-08-03 便DJ(オーナー指示): 3グループを折りたたみにし、既定で開くのはここだけ。

          2026-08-19 便IF・⑥（オーナー原文「日と週で、同じ献立を提案する機能なのに、条件の
          絞り込みなどのボタンの配置がバラバラで、まるで別機能。フォーマット揃えたい。
          週は、日の、できることが増えたバージョン。」）: **日タブの「今日なに作る？」の並びを正**にして、
          この中身をそこへ寄せた。日タブの並びは
            出しかたの切り替え（1品／献立）→ 条件の窓を開くボタン → 決めてもらうボタン（塗り・横いっぱい）
          なので、週も同じ順にする。
            出しかたの切り替え（おまかせ／先週をコピー）→［週だけ］入れかた → 現在の条件 → まとめて献立を入力

          ・「先週の献立をコピー」は、独立した囲みのスイッチ（便DT-7）をやめて出しかたの2択にした。
            ⑤（オーナー原文「『現在の条件』より『先週の献立を〜』が目立っていて、献立を提案の項目で
            一番重要なはずの条件を入れる場所がすぐにわからない」）への答えでもある＝
            先週コピーは切り替えの片側に収まり、条件は押すボタンのすぐ上に来る
          ・実行ボタンは見出しの横（便DT-5/6）から**条件の下**へ移した。日タブと同じ場所・同じ見た目
            （塗りつぶし・横いっぱい）にするため。見出しの横に無くなったので、このグループは既定で開く
          ・入れかたは週にしか無い（＝「できることが増えた版」）。並びは便ID・①のまま入れかたが先 */}
      <section className="p-[var(--space-sm)]">
        {/* 実行ボタンは**見出しの横**（2026-08-22 便IV・オーナー原文「「まとめて献立てを入力」
            ボタンは「献立を提案」の横にして、１列におさめて。」）。
            便DT-5/6が置いていた場所へ戻す。便IF・⑥が「日タブにそろえる」ために条件の下へ移し、
            便II・③が折りたたみの外・節の下端へ出していたが、どちらも見出しとボタンで2段になる。
            見出しの行に横並びで入れると、畳んだときの高さが1行ぶんで済む。
            塗りつぶし（bg-accent）は変えない＝この節でいちばん押すものだと一目で分かる形は保つ。
            横いっぱいをやめたので、日タブの「今日なに作る？」とは横幅だけが違う
            （便IF・⑥がそろえた並び「入れかた→現在の条件→実行」は、開いたときそのまま残る）。 */}
        {renderWeekGroupHeader(
          'auto',
          ja.mealPlan.weekGroupAutoTitle,
          <button
            type="button"
            data-testid="week-fill-run"
            onClick={() => void fillWeek()}
            className="ml-auto inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-bold text-on-accent shadow-sm"
          >
            <Dices size={18} aria-hidden />
            {ja.mealPlan.fillWeek}
          </button>,
          false,
        )}
        <Collapse open={weekGroupOpen.auto}>
          <>
            {/* 入れかた(2026-08-07 便DT-8・オーナー指示)。「まとめて献立を入力」が
                空いている枠だけを埋めるのか、これからの献立を総入れ替えするのかを選ぶ。

                2026-08-19 便ID・①（オーナー原文「献立を提案の並び順：入れ方＞提案の条件」）:
                **入れかたを先、現在の条件を後**にした。

                2026-08-20 便II・④（オーナー原文「『入れかた』２択はプルダウン。見た目をシンプルに。
                条件より目立ってる上に形が違うため。条件が押せるとわかりづらくなる原因にも
                なってると思う。」）: 2つのチップを**プルダウン1つ**にした。同じ画面の
                「コピー元の週」「現在の条件」の中身と同じ形になり、地色のチップが条件より
                目立つこともなくなる。
                **総入れ替えは消える操作なので、確認の窓（規約F）はそのまま残す**
                ＝何が消えて何が残るかは、押したあとの窓が件数つきで言う */}
            <div className="mt-[var(--space-md)]">
              <label className="block">
                <span className="block text-sm font-bold text-ink-muted">
                  {ja.mealPlan.fillModeTitle}
                </span>
                <select
                  data-testid="fill-mode"
                  value={fillMode}
                  onChange={(e) => setFillMode(e.target.value as PlanFillMode)}
                  className="select-control mt-1 w-full"
                >
                  <option value="fillEmpty">{ja.mealPlan.fillModeFillEmpty}</option>
                  <option value="replaceAll">{ja.mealPlan.fillModeReplaceAll}</option>
                </select>
              </label>
              {/* 2026-08-27 便LT: 入れかたの下にあった説明の1行を無くした
                  （理由は i18n/ja.ts の fillModeFillEmpty のところに書いてある）。
                  押すボタンは節の見出しの行に塗りつぶしで出ており、消える側は確認の窓が言う */}
            </div>

            {/* 入れる先の食事(2026-08-29 便MK・司令部の裁定)。押さなければ表示する食事ぜんぶ＝
                今までと同じものが入る。置き場所は月タブと同じ「実行の説明→入れる食事→現在の条件」で、
                週だけ並びを変えない（便ID・①の「入れ方＞条件」もそのまま。入れかたの次に来る） */}
            {renderSlotPicker(
              ja.mealPlan.fillSlotPickLabel,
              ja.mealPlan.fillSlotPickAria,
              'week-fill-slot',
              weekFillTargetSlots,
              toggleWeekFillSlot,
            )}

            {/* 現在の条件: 時短優先・ジャンル・栄養から組む。押すと窓が開く(2026-08-19 便ID・④)。
                2026-07-30 便CH/C11: 同じ部品を月タブにも出す(renderSuggestConditions)。
                2026-08-07 便DT-7: 先週コピーを選んでいるあいだは効かないのでグレーアウトする */}
            {renderSuggestConditions()}
          </>
        </Collapse>
      </section>

      {/* グループ3: 別の週・テンプレートから入れる。
          ・過去の献立をコピー … 週を送って中身を見ながら選ぶ画面へ(2026-08-21 便IO)
          ・テンプレートを適用 … 保存した曜日ごとの雛形を、空いているところにだけ入れる(非破壊)
          ・表示している週をテンプレートとして保存 … 入れ先の週を曜日ごと覚える
            (2026-07-29 便CB-2・docs/59 A-1＋B-2)

          2026-08-21 便IO: オーナー原文「『先週の献立をコピー』は、テンプレート機能の派生として
          まとめて配置した方が自然？」に沿って、別の週から入れる道をこの節へ移した。
          「献立を提案」の出しかたの2択(おまかせ／週をコピー)は無くしてある
          ＝**同じことをする道を2つ置かない**。節の名前も中身に合わせて言い換えた
          (「献立テンプレート」のままだと、過ぎた週をそのまま入れる道が名前の下に隠れる)。

          2026-08-21 便IN: 「保存」と「適用」の2つを折りたたみの外へ出した。
          2026-08-22 便IVで**3つとも中へ戻した**（オーナー原文「テンプレートエリアは
          折りたたみ状態でボタンはなし。」）。同じ書き溜めの
          「まとめてやテンプレートのような初心者が使わないような機能はしまっておく」が
          この節そのものを名指ししている＝畳んだときは見出しだけが残る。
          開いているときの並びは便INの前と同じ（3つのボタン → 説明の1行 → 中身を見る画面への入口）*/}
      <section className="p-[var(--space-sm)]">
        {renderWeekGroupHeader('template', ja.mealPlan.weekGroupTemplateTitle)}
        <Collapse open={weekGroupOpen.template}>
          <>
            <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
              {/* 過去の献立をコピー(2026-08-21 便IO・名前は便IU・⑤)。コピー先は**いま表示している
                  週のまま**なので、その7日間の初日を渡す＝あちらの画面で週を送ってもコピー先は動かない */}
              <Link
                to={`/meal-plan/copy-week?to=${dates[0]}`}
                data-testid="week-copy-pick"
                /* tap-target: 開いてから押す場所でも、当たり判定は44pxを保つ */
                className="tap-target inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
              >
                <Copy size={14} aria-hidden />
                {ja.mealPlan.copyPickTitle}
              </Link>
              <button
                type="button"
                data-testid="week-template-save"
                onClick={openTemplateSave}
                /* tap-target: 開いてから押す場所でも、当たり判定は44pxを保つ */
                className="tap-target inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
              >
                <BookmarkPlus size={14} aria-hidden />
                {ja.mealPlan.templateSave}
              </button>
              <button
                type="button"
                data-testid="week-template-apply"
                onClick={() => openTemplateApply('week')}
                /* tap-target: 開いてから押す場所でも、当たり判定は44pxを保つ */
                className="tap-target inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
              >
                <LayoutTemplate size={14} aria-hidden />
                {ja.mealPlan.templateApplyWeek}
              </button>
            </div>
            <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
              {ja.mealPlan.templateSaveDescription}
            </p>
            {/* テンプレートの中身を見る・直す画面への入口(2026-08-02 便DE-9・オーナー指示)。
                保存したあと中身を確かめる手段が無く、直すには保存し直すしかなかった。
                2026-08-28 便MA: どのタブから開いたかを ?back= で運ぶ＝戻るでこの週へ帰る
                （記録の一覧の入口と同じ作法） */}
            <Link
              to="/meal-templates?back=week"
              onClick={rememberWeekReturn}
              className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent-ink underline"
            >
              {ja.mealPlan.templateManageLink}
            </Link>
          </>
        </Collapse>
      </section>
      </div>

      {/* 週の移動。2026-08-07 便DT-3(オーナー指示)で、画面のいちばん上から
          「すべて畳む」の上へ移した＝7日分のカードのすぐ手前に置く。
          2026-08-22 便JE・①: ここから下はページの地の上＝設定の面が終わる位置が境目になる */}
      <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, -1))}
          aria-label={ja.mealPlan.prevWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(currentWeekAnchor)}
          aria-label={
            isAtCurrentWeek ? undefined : rollingWeek ? ja.mealPlan.thisWeekRolling : ja.mealPlan.thisWeek
          }
          className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted tabular-nums shadow-sm"
        >
          {/* 今週に戻ると印が消えて幅が18px縮むので、場所は空けたままにする（便EO） */}
          <RotateCcw
            size={14}
            className={`text-accent-ink ${isAtCurrentWeek ? 'invisible' : ''}`}
            aria-hidden
          />
          {dates[0].replaceAll('-', '/')} 〜 {dates[6].replaceAll('-', '/')}
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, 1))}
          aria-label={ja.mealPlan.nextWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent-ink shadow-sm"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {/* 7日分のカード。
          2026-08-03 便DJ(オーナー指示): 曜日ごとに日付の行だけへ畳めるようにした
          (7日ぶんが全部開いたままだと、ほかの曜日を探しづらい)。既定は全部開いた状態のままで、
          「すべて畳む」を押すと7日ぶんが一度に日付だけになる */}
      <div className="mt-[var(--space-sm)] flex justify-end gap-[var(--space-sm)]">
        {/* 2026-08-08 便DX(オーナー指示「『すべて畳む』の隣に『すべてロック』ボタンも」)。
            表示中の7日分をまとめて掛け外しする。7日とも3食に鍵が掛かっていれば「すべて解除」になる。
            2026-08-19 便IF・⑪で「過去だけの週では出さない」としていたが、
            2026-08-22 便JF で**どの週でも出す**に巻き戻した（理由は logic/mealPlan.ts の
            planShowWeekLock を消したところに書いてある。オーナー原文「ロックボタンは芯では
            ないだけで、結果としてあることに意味が出ました。」）。
            すぐ左の「まとめて空にする」は表示している週の**全日（過ぎた日を含む）**を
            消す対象にしているので、過去だけの週でこそ鍵が要る */}
        <button
          type="button"
          data-testid="lock-all"
          onClick={() => void toggleMealLock(planAllLockToggle(lockedKeys, dates), 'all')}
          aria-pressed={allDaysLocked}
          className={`inline-flex items-center gap-1 rounded-sm border px-3 py-1.5 text-xs font-bold shadow-sm ${
            allDaysLocked
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-accent-ink'
          }`}
        >
          {allDaysLocked ? <Lock size={14} aria-hidden /> : <LockOpen size={14} aria-hidden />}
          {/* 押すと文言が入れ替わるが、幅は長い方で固定して1pxも動かさない（便EO） */}
          <SwapLabel
            current={allDaysLocked ? ja.mealPlan.lockAllReleaseButton : ja.mealPlan.lockAllButton}
            labels={[ja.mealPlan.lockAllButton, ja.mealPlan.lockAllReleaseButton]}
          />
        </button>
        <button
          type="button"
          onClick={() => setAllDaysFolded(!allDaysCollapsed)}
          className="rounded-sm border border-edge bg-surface px-3 py-1.5 text-xs font-bold text-accent-ink shadow-sm"
        >
          <SwapLabel
            current={allDaysCollapsed ? ja.mealPlan.weekDayExpandAll : ja.mealPlan.weekDayCollapseAll}
            labels={[ja.mealPlan.weekDayCollapseAll, ja.mealPlan.weekDayExpandAll]}
          />
        </button>
      </div>
      {/* 2026-08-22 便JE（オーナー原文「週献立の日ごとカードとレシピ一覧のカードの間隔を
          開けるのも見やすかった。」）: カード同士の間隔（8px）が、カードの中の余白（16px）より
          **狭かった**。近いものほど1つのまとまりに見えるので、これでは7日分が地続きの帯に見える。
          外の間隔を中の余白より広く（--space-lg＝24px）して、1日ぶんずつを塊にする。
          間隔のトークンを差し替えるだけ＝色も影も角丸も足していない */}
      <div className="mt-[var(--space-sm)] space-y-[var(--space-lg)]">
        {dates.map((date) => {
          const dayCollapsed = isDayFolded(date)
          /**
           * 畳んでいる日に出す印（2026-08-19 便ID・⑦。オーナー原文「献立ありで折りたたみに
           * した場合はオレンジ色の「・」などで入力があることがわかるようにして」）。
           * 絵文字は使わない（端末ごとに見た目が変わるため。アプリはアイコンを lucide-react に、
           * 色をデザイントークンに統一している）。
           *  ・今日以降 … 献立が入っていれば丸い点（月タブのカレンダーで「献立が入っている日」に
           *    出している点と同じ形・同じアクセント色＝同じ意味を同じ印で言う）
           *  ・過ぎた日 … 「作った記録」があればチェックの印（過ぎた日のカードは予定を出さず
           *    記録を見せる画面なので、開くと何が読めるのかをそのまま印にする。
           *    この印は過ぎた日のカードの中で「作った記録」の見出しにも使っている）
           */
          const dayMark = isPastDate(date, today)
            ? shownLogsOf(date).length > 0
              ? 'cooked'
              : null
            : datesWithPlan.has(date)
              ? 'plan'
              : null
          const dayLocked = isDayMealLocked(lockedKeys, date)
          /**
           * この日の編集モードで何を触るか（2026-08-22 便IV → 便JF・①で過ぎた日にも広げた）。
           *  ・今日と先の日 … 'plan'  … 献立を組む（便IVからの編集モードそのまま）
           *  ・過ぎた日 …… 'record' … 作った記録を後から足す
           * オーナー原文（便JF・①）「過去の日付の記録も、編集モードで後から記録を追加できるように
           * して。」／同日の訂正「編集モード追加で、普段の見え方をシンプルにするのが芯です」。
           * 足す入口は**編集モードの中だけ**に置く＝過ぎた日の普段の見え方は今までどおり
           * （作った記録のカードが並ぶだけ）。
           */
          const dayEditKind = planDayEditKind(date, today)
          const dayEditing = weekEditDate === date
          return (
          <section
            key={date}
            data-date={date}
            ref={date === today ? todaySectionRef : undefined}
            // 2026-08-03 便DP-8(オーナー指示): 今日のカードの囲み線を太くして、ほかの曜日との
            // 区別を強める(食事ごとの地色=SLOT_TONEによる時間帯の区分はそのまま維持)
            // scroll-mt-16(64px): 日付を指定して開いたとき・「まとめて献立」の直後に、この枠へ
            // 自動でスクロールする(scrollIntoView)。上部固定の日/週/月タブ(実測54px)の裏に
            // 日付の見出しが潜り込まないよう、その分＋わずかな余白を空ける(2026-08-09 便ET)
            // 2026-08-22 便JE（オーナー確定）: ②角丸を --radius-card（4px）に、
            // ⑥読むだけの入れ物なので影を外す
            /* 2026-08-24 便KJ・②（オーナー原文「過去に日付は折りたたみ時の枠を一回り細く
               してほしい。一番下が今日の時にスクロールが長い。」）: 過ぎた日を畳んでいるあいだ
               だけ内側の余白を詰める（16px→8px。1日ぶん 78px→62px・390×844の実測）。
               どの日をどれだけにするかは logic/mealPlan.ts の planDayCardPadClass が持つ
               ＝見張れる形にする。押して開く見出しは min-h-11（44px）のままなので、
               細くしても畳んだ行を押して開ける */
            className={`scroll-mt-16 rounded-card ${planDayCardPadClass({
              folded: dayCollapsed,
              past: isPastDate(date, today),
            })} ${
              date === today
                ? 'border-2 border-accent bg-surface'
                : 'border border-edge bg-surface'
            }`}
            /* 2026-08-22 便JF・③（オーナー原文「過去の日付は、１段階色を変えるとわかりやすいかも。
               押せないように見えないように注意。」）。
               直す前は7日とも同じカード面（実測 rgb(255,253,248)＝--surface）で、過ぎた日か
               これからの日かは日付を読むまで分からなかった。
               ・変えるのは**面の色だけ**（司令部裁定）。文字・アイコン・枠の色はそのまま
                 ＝押せるものは今までと同じ濃さで読める（「押せないように見えない」）
               ・新しい色は増やさず、既にある文字色（--text-muted）をカード面（--surface）へ
                 6%だけ混ぜる。5テーマとも自動で追従する（--slot-bg-* と同じ手）
               ・className の bg-surface は**残す**。カード面の上での文字用アクセントの
                 切り替え（index.css「文字用アクセントの面別スコープ」）がこのクラスで効いており、
                 外すとブラウンだけリンクの色が変わってしまう */
            style={
              dayEditKind === 'record'
                ? { background: 'color-mix(in oklab, var(--text-muted) 6%, var(--surface))' }
                : undefined
            }
          >
            {/* 2026-08-08 便DX(オーナー指示「献立日付の右」): 日付の行に日ごとのロックを置く。
                折りたたみボタンの入れ子にはできないので、見出しの行を flex にして
                「折りたたみボタン＋鍵」を横に並べる(便DT-6のグループ見出しと同じ作法) */}
            {/* 2026-08-22 便IZ: 見出しの行に「畳む／開く」「編集／完了」「鍵」の3つが 4px 間隔で
                並んでいた（実測）。畳むと編集は押し直せばよいだけだが、鍵は押すと
                「まとめて献立を入力」がその日を書き換えなくなる＝結果の違う操作なので、
                押し間違えが起きない間隔（12px）まで離す。
                ただし狭い画面（320px＝古いiPhone SE相当）では、3つを1行に並べたまま12px空けると
                日付が縮められて「2026/08/2」と「2」に割れる（実測）ので、**行を折り返して**
                日付を1行に保つ（折り返した先も同じ12px空ける） */}
            <h2 className="flex flex-wrap items-center gap-3 font-bold">
              {/* 曜日は必ず日付から引く(2026-07-29 便CD/MP-02)。並び順(配列インデックス)で
                  引いていたため、「今日から7日間」表示では今日が月曜の日以外は全行の曜日が
                  日付と食い違っていた(水曜に「月 2026/07/29 今日」と出る) */}
              <button
                type="button"
                data-testid="week-day-toggle"
                data-date={date}
                onClick={() => setDayFoldOverrides((prev) => ({ ...prev, [date]: !dayCollapsed }))}
                aria-expanded={!dayCollapsed}
                aria-label={(dayCollapsed
                  ? ja.mealPlan.weekDayToggleOpenAria
                  : ja.mealPlan.weekDayToggleCloseAria
                ).replace('{date}', date.replaceAll('-', '/'))}
                className="flex min-h-11 min-w-40 flex-1 items-center justify-between gap-2 py-1 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0">
                    {dowLabels[dowIndex(date)]} {date.replaceAll('-', '/')}
                    {date === today && (
                      /* 2026-08-22 便IZ: 320pxで「今」と「日」に割れていたので割らせない */
                      <span className="ml-2 whitespace-nowrap text-sm text-accent-ink">
                        {ja.mealPlan.todayBadge}
                      </span>
                    )}
                  </span>
                  {/* 畳んでいる日に、中身があることを言う印（便ID・⑦）。
                      開いている日には出さない（中身がそのまま見えているため） */}
                  {dayCollapsed && dayMark === 'plan' && (
                    <span
                      data-testid="week-day-mark"
                      data-date={date}
                      data-mark="plan"
                      className="inline-flex shrink-0 items-center"
                    >
                      <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                      <span className="sr-only">{ja.mealPlan.weekDayPlanMark}</span>
                    </span>
                  )}
                  {dayCollapsed && dayMark === 'cooked' && (
                    <span
                      data-testid="week-day-mark"
                      data-date={date}
                      data-mark="cooked"
                      className="inline-flex shrink-0 items-center"
                    >
                      {/* 2026-08-22 便JF・②（オーナー原文「記録がある日のチェックマークを
                          もう少しちょこっっとだけ目立つようにして。」）: 実測14×14px・線の太さ2
                          （lucideの既定）だったものを、16×16px・線の太さ2.5にする。
                          色は変えない＝面とのコントラスト比（ライトで5.73:1）はそのまま
                          ＝「一段階だけ」の範囲に収める */}
                      <CheckCircle2
                        size={16}
                        strokeWidth={2.5}
                        className="text-accent-ink"
                        aria-hidden
                      />
                      <span className="sr-only">{ja.mealPlan.weekDayCookedMark}</span>
                    </span>
                  )}
                </span>
                {dayCollapsed ? (
                  <ChevronDown size={18} className="shrink-0 text-ink-muted" aria-hidden />
                ) : (
                  <ChevronUp size={18} className="shrink-0 text-ink-muted" aria-hidden />
                )}
              </button>
              {/* 1日ずつの編集モードの切り替え（2026-08-22 便IV・オーナー原文
                  「1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、
                    選んだレシピの追加や書き換えができるようにする。」）。
                  見出しの行に置く（司令部裁定）。名前・見た目は日タブの「今日の献立」の
                  整理モードにそろえる＝押している間は塗りつぶし・名前は「完了」に変わる。
                  畳んでいる日には出さない（畳んだ行は日付だけを残す行なので、
                  そこに押しても中身の見えない操作を並べない）。
                  幅は長いほうの字（「完了」）で固定して、押しても1pxも動かさない（便EO） */}
              {/* 2026-08-22 便IZ: 「編集／完了」と「鍵」を1つの組にする。
                  狭い画面で折り返すとき、2つ一緒に次の行へ移って右に揃う
                  （片方だけが次の行の左端に取り残される、をしない） */}
              <span className="ml-auto flex shrink-0 items-center gap-3">
              {!dayCollapsed && (
                <button
                  type="button"
                  data-testid="week-day-edit"
                  data-date={date}
                  onClick={() => setWeekEditDate((prev) => planToggleDayEdit(prev, date))}
                  aria-pressed={dayEditing}
                  /* 読み上げの名前は、その日の編集モードで触るものを言う（便JF・①）。
                     過ぎた日は献立ではなく作った記録を触るので、同じ「編集」でも名乗りを変える */
                  aria-label={(dayEditing
                    ? ja.mealPlan.weekDayEditOffAria
                    : dayEditKind === 'record'
                      ? ja.mealPlan.weekDayRecordEditOnAria
                      : ja.mealPlan.weekDayEditOnAria
                  ).replace('{date}', date.replaceAll('-', '/'))}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    dayEditing
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  <Pencil size={14} aria-hidden />
                  <SwapLabel
                    current={dayEditing ? ja.mealPlan.weekDayEditDone : ja.mealPlan.weekDayEdit}
                    labels={[ja.mealPlan.weekDayEdit, ja.mealPlan.weekDayEditDone]}
                  />
                </button>
              )}
              {/* 日ごとのロック: その日の朝食・昼食・夕食をまとめて掛け外しする。
                  3食とも掛かっているときだけ閉じた鍵になる(表示していない食事も数える)。
                  2026-08-19 便IF・⑪で「過去だけの週では出さない」としていたが、
                  2026-08-22 便JF で**どの週でも出す**に巻き戻した（「すべてロック」と同じ判断。
                  理由は logic/mealPlan.ts の planShowWeekLock を消したところに書いてある）。
                  畳んでいる日にも出す＝日付だけの行からでも、その日が確定済みかを読める */}
              <button
                type="button"
                data-testid="day-lock"
                data-date={date}
                onClick={() => void toggleMealLock(planDayLockToggle(lockedKeys, date), 'one')}
                aria-pressed={dayLocked}
                aria-label={(dayLocked
                  ? ja.mealPlan.unlockDayAria
                  : ja.mealPlan.lockDayAria
                ).replace('{date}', date.replaceAll('-', '/'))}
                /* 掛かっているときは塗りつぶし（2026-08-09 便EN。時間帯ごとの鍵と同じ作法）。
                   2026-08-22 便IZ: 実測30px角で、指で押せる大きさ(44px・--tap-min)を下回っていた。
                   器(.tap-target)で当たり判定だけ広げる（丸の見た目は変えない） */
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  dayLocked ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted'
                }`}
              >
                {dayLocked ? <Lock size={18} aria-hidden /> : <LockOpen size={18} aria-hidden />}
              </button>
              </span>
            </h2>
            {/* 2026-08-10 便FD(オーナー実機「『全て開く』すると、下へスクロールする。
                今日の日づけすらスルーされる」): 曜日カードは開いても画面を動かさない。
                「すべて開く」は7日分を一度に開くので、「伸びた部分を画面へ入れる」(便EO)を
                そのまま働かせると7か所が同時に要求し、最後の7日目に引っぱられて
                ページが下まで飛ぶ。押した日付の見出しはその場に残るので、
                1日だけ開いたときも見失わない */}
            <Collapse open={!dayCollapsed} reveal={false}>
            <>
            {/* 今日・未来日の予定。過去日は予定を表示から消し、下の「作った記録」だけを
                日記のように見せる(便BS・タスク2。mealPlansデータは非破壊で残す)。

                2026-08-22 便IV: 通常表示（renderSlotView＝絵と料理名だけ）と
                編集モード（renderSlotEditor＝今までの1品ごとの操作すべて）を切り替える。
                切り替えは見出しの行の「編集」で、一度に1日だけ（他の日は通常表示のまま）。
                通常表示で献立が1品も無い日は、押す場所の名前を1行で書く
                （空き枠を出さないので、書かないと行き止まりになる） */}
            {dayEditKind === 'plan' && (
              /* 食事どうしの間は16px（2026-08-25 便KU）。1品の中12px・品と品の間16pxという
                 便JQ の関係の上に、食事の切れ目をさらに広く取る＝どこで朝昼夕が変わるかが
                 色だけでなく距離でも読める。月タブの日の窓も同じ値にそろえる */
              <div className="mt-[var(--space-sm)] space-y-[var(--space-md)]">
                {dayEditing ? (
                  visibleSlots.map((slot) => renderSlotEditor(date, slot))
                ) : (
                  <>
                    {visibleSlots.map((slot) => renderSlotView(date, slot))}
                    {!visibleSlots.some(
                      (slot) =>
                        (entriesByDateSlotAll.get(`${date}|${slot}`)?.length ?? 0) > 0 ||
                        isMealSlotLocked(lockedKeys, date, slot),
                    ) && (
                      <p data-testid="week-day-view-empty" className="text-sm text-ink-muted">
                        {ja.mealPlan.weekDayViewEmpty}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {/* 過去日の振り返り(2026-07-17 便Z-2・docs/35 §3・便BSで「記録だけ残す」へ強化):
                その日の「作った記録」(cookedLogs日付一致)を写真付きの薄いカードで表示する。
                達成しなかった予定は上のグリッドごと消えているので、ここが過去日の主役になる。
                記録が無い過去日は控えめな空案内だけ出す */}
            {/* 過ぎた日の編集モードだけに出す「作った記録を追加」（2026-08-22 便JF・①）。
                通常表示には出さない＝過ぎた日のカードは今までどおり
                「作った記録が並ぶだけ」の見え方を保つ（司令部の訂正・オーナー原文
                「編集モード追加で、普段の見え方をシンプルにするのが芯です」）。
                押すと献立の枠と同じレシピ一覧が開き、選んだ料理をその日の記録に足す。
                献立の枠（朝食・昼食・夕食）は編集モードでも出さない＝
                「過ぎた日は作った記録だけが残る」という画面ぜんぶの決めごとを崩さない */}
            {dayEditKind === 'record' && dayEditing && (
              <div className="mt-[var(--space-sm)]">
                <button
                  type="button"
                  data-testid="past-record-add"
                  data-date={date}
                  onClick={() => {
                    setRecordPickDate(date)
                    setPickerQuery('')
                  }}
                  /* 鍵の掛かった日では押せない（2026-08-22 便JF・オーナー原文
                     「鍵をかけたら編集もできなくなるようにして。」）。
                     止め方は鍵の掛かった献立の×・食数・サイコロと同じ＝ボタンは同じ場所に
                     出したまま押せなくする（2026-08-08 便EA）。理由はすぐ下の1行が言う */
                  disabled={dayLocked}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-accent bg-surface py-3 font-bold text-accent-ink shadow-sm ${
                    dayLocked ? 'opacity-40' : ''
                  }`}
                >
                  <Plus size={18} aria-hidden />
                  {ja.mealPlan.pastRecordAdd}
                </button>
                {/* 押せない理由（2026-08-22 便JF）。鍵を外せば元どおりであることまで1行で言う
                    ＝鍵の掛かった献立を触ろうとしたときの案内（lockedEditBlocked）と同じ言い回し */}
                {dayLocked && (
                  <p data-testid="past-record-locked-note" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.pastRecordLockedNote}
                  </p>
                )}
                {/* 在庫を下げる設定がONの人にだけ、押す前に読める場所で違いを書く（規約F）。
                    鍵が掛かっていて足せないときは出さない（起きないことの説明を先に読ませない） */}
                {!dayLocked && settings?.cookedReflectPantry && (
                  <p data-testid="past-record-pantry-note" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.pastRecordPantryNote}
                  </p>
                )}
              </div>
            )}
            {isPastDate(date, today) &&
              (shownLogsOf(date).length > 0 ? (
                <div className="mt-[var(--space-sm)]">
                  <p className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                    <CheckCircle2 size={14} className="text-accent-ink" aria-hidden />
                    {ja.mealPlan.pastCookedTitle}
                  </p>
                  {/* 記録どうしの間は12px（2026-08-25 便KU）。月タブの日の窓とまったく同じ並べ方
                      ＝同じ形のものを2通りに並べない */}
                  <ul className="mt-1 space-y-3">
                    {shownLogsOf(date).map((entry, i) => (
                      <CookedLogCard
                        key={`${entry.recipe.id ?? `d${entry.detachedRecordId}`}-${i}`}
                        recipe={entry.recipe}
                        log={entry.log}
                        // 2026-08-07 便DT-2(オーナー指示): 週タブから開いた詳細の「戻る」は
                        // 週タブへ帰し、離れる直前の週とスクロール位置を復元する
                        linkState={WEEK_RETURN_LINK_STATE}
                        onNavigate={rememberWeekReturn}
                        // 2026-08-09 便EQ: カードはレシピ詳細のまま、記録の中身への入口を下に足す
                        onOpenDetail={() => setLogDetail(entry)}
                        // 記録の削除は**編集モードのときだけ**渡す（2026-08-22 便JF・
                        // オーナー追加指示「削除ボタンも入れて」）。渡さなければボタンは出ない
                        // ＝通常表示は今までどおり、記録のカードが並ぶだけ
                        onDelete={
                          dayEditing && dayEditKind === 'record'
                            ? () => void deletePastCookedRecord(date, entry)
                            : undefined
                        }
                        /* 鍵の掛かった日では消せない（2026-08-22 便JF）。
                           足す側（past-record-add）とまったく同じ止め方・同じ判断（日ごとの鍵） */
                        deleteDisabled={dayLocked}
                        // 削除済みレシピの記録には行き先が無いので、カードそのものを記録の小窓にする
                        // (2026-08-16 便GZ。'below' のままだと押せないレシピ詳細へのリンクになる)
                        detailAs={entry.detachedRecordId != null ? 'card' : 'below'}
                      />
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
            {/* この日の献立ぶんの栄養と野菜量(2026-07-30 便CL・docs/60 第1段)。
                既定は1行の折りたたみ=控えめに置く。数える対象が無い日は何も出ない */}
            {(() => {
              const dayBalance = weekBalanceByDate.get(date)
              if (!dayBalance) return null
              return (
                <div className="mt-[var(--space-sm)]">
                  <NutritionBalancePanel
                    scope="day"
                    basis={dayBalance.basis}
                    // 今日は「作った記録があるものは記録、まだのものは献立」で数えるので、
                    // 数え方の1行を過ぎた日と書き分ける(2026-08-09 便EK)
                    isToday={date === today}
                    dateLabel={date.replaceAll('-', '/')}
                    isPro={isPro}
                    balance={dayBalance.balance}
                    includeRice={includeRice}
                    onToggleIncludeRice={(next) => void updateSettings({ includeRice: next })}
                    // その日の合計に実際に積んだごはんの杯数(2026-08-10 便FD)。
                    // 数え直さず dayBalanceMap が数えた実数を渡す＝数字と合計が必ず一致する
                    riceServings={dayBalance.riceServings}
                    slotBreakdown={weekSlotBalanceByDate.get(date)}
                    // 2026-08-27 便LU: パネルの中の「Pro版について見る」も、
                    // 見ていたタブ・週・場所ごと帰す
                    proDetour={proGateDetour}
                    // 2026-08-28 便MA: 計算できなかった料理の名前も、押した場所へ帰す
                    dishLink={gapDishLink}
                    /* 2026-08-28 便LV: 開閉はこの画面が持つ（帰ってきたときに開き直すため）。
                       名前はその日の日付＝並び順ではなく中身で覚える */
                    expanded={nutritionPanelOpen[nutritionPanelName(date)] === true}
                    onExpandedChange={(next) =>
                      setNutritionPanelExpanded(nutritionPanelName(date), next)
                    }
                  />
                </div>
              )
            })()}
            {/* 日付メモ(2026-07-29 便CB-1・docs/59 A-2)。過去日にも出す
                (「この日は外食だった」と後から書き残せるようにするため) */}
            <div className="mt-[var(--space-sm)]">
              <DayNoteEditor
                date={date}
                note={weekDayNoteByDate.get(date)}
                onSave={(d, text) => void handleSaveDayNote(d, text)}
              />
            </div>
            </>
            </Collapse>
          </section>
          )
        })}
      </div>

      {/* この週ぜんぶをまとめて見る2つ（栄養と食費／買い物メモ）。
          2026-08-03 便DP-8(オーナー指摘「曜日カードと紛れる」): 曜日カードと同じ「白い面＋影」の
          折りたたみが同じ間隔で続いていて、7日目の下にもう1日あるように見えていた。
          7日分との間を1段広く空けて区切り線を引く（面＋影＝日ごとのカード／まとめは別物） */}
      <div className="mt-[var(--space-lg)] border-t border-edge pt-[var(--space-sm)]">

      {/* 2026-08-26 便LH（オーナー原文「栄養、食費で列を分けて、それぞれ折りたたみ状態で
          数値を１列表示。の２つで１グループ。買い物めもはくっつけない。」）:
          便KU（2026-08-25）は「栄養と食費」と「買い物メモ」を**1枚の面**にまとめていたが、
          オーナーの求めは ①栄養と食費を別々の節に割り、畳んだ状態でも数値が1行だけ読めること
          ②買い物メモはその面に入れないこと、の2つ。
          面（.setup-panel）は「栄養」「食費」の2節だけにし、買い物メモは別の面に出す。
          数値の出し方は月タブの2枚（MonthCardHeader の figure）と同じ作法＝
          畳んでいるときだけ見出しの横に1つ出し、開いたら中の表・パネルが受け持つ。
          中身が1品も無いとき（価格が1件も無い／数える献立が無い）は節ごと出さない＝
          開いても何も無い折りたたみを置かない */}
      {(weekBalance.countedDays > 0 || (hasPricedRecipe && weekCost > 0)) && (
      <div className="setup-panel mt-[var(--space-md)]">

      {/* 節1: 栄養（2026-07-30 便CL・docs/60 第1段）。畳んでいるときはエネルギーの合計だけ出す */}
      {weekBalance.countedDays > 0 && (
      <section className="p-[var(--space-sm)]">
        {renderWeekGroupHeader(
          'nutrition',
          ja.mealPlan.weekGroupNutritionTitle,
          undefined,
          false,
          'week-nutrition-toggle',
          formatNutrient('kcal', weekBalance.balance.nutrition.total.kcal),
          'week-nutrition-folded',
        )}
        <Collapse open={weekGroupOpen.nutrition}>
          <div className="mt-[var(--space-md)]">
            <NutritionBalancePanel
              scope="week"
              // 今日を含む週だけ、今日の数え方の1行を足す(2026-08-09 便EK)
              isToday={dates.includes(today)}
              isPro={isPro}
              balance={weekBalance.balance}
              includeRice={includeRice}
              onToggleIncludeRice={(next) => void updateSettings({ includeRice: next })}
              riceServings={weekBalance.riceServings}
              // 2026-08-27 便LU: 上の日カードと同じ帰り道にそろえる
              proDetour={proGateDetour}
              // 2026-08-28 便MA: 計算できなかった料理の名前も、押した場所へ帰す
              dishLink={gapDishLink}
              /* 2026-08-28 便LV: 曜日カードのパネルと同じ扱い。週まとめの名前は 'week' */
              expanded={nutritionPanelOpen[nutritionPanelName('week')] === true}
              onExpandedChange={(next) =>
                setNutritionPanelExpanded(nutritionPanelName('week'), next)
              }
            />
          </div>
        </Collapse>
      </section>
      )}

      {/* 節2: 食費（週の概算食費・便BH-3・タスク4）。畳んでいるときは合計金額だけ出す */}
      {hasPricedRecipe && weekCost > 0 && (
      <section className="p-[var(--space-sm)]">
        {renderWeekGroupHeader(
          'cost',
          ja.mealPlan.weekGroupCostTitle,
          undefined,
          false,
          'week-cost-toggle',
          ja.mealPlan.intakeCostYen.replace('{n}', weekCost.toLocaleString()),
          'week-cost-folded',
        )}
        <Collapse open={weekGroupOpen.cost}>
          <div className="mt-[var(--space-md)]">
            <div>
              <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.weekCostTitle}</p>
              <p className="text-2xl font-bold text-accent-ink">
                約{weekCost.toLocaleString()}円
                <span className="ml-2 text-sm font-bold text-ink-muted">
                  （{ja.mealPlan.weekCostMealCount.replace('{n}', String(weekMealCount))}）
                </span>
              </p>
              {/* 何人ぶんの金額かを言い切る(2026-07-30 便CH/C8。月間サマリーの「1人分」と対にする)。
                  2026-08-03 便DK: 金額が実効食数に連動するようになったので、実際に数えた
                  食数の合計を出す(「登録した人数ぶん」固定の言い方をやめる) */}
              <p className="mt-1 text-sm text-ink-muted">
                {ja.mealPlan.weekCostWholeNote.replace(
                  '{n}',
                  String(weekCostEstimate.servingsTotal),
                )}
              </p>
              {/* ごはんを含めて計算する(便CW-10)がONのとき、金額に何を足したかを必ず書く */}
              {riceCostServings > 0 && riceYen > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  {ja.nutritionBalance.includeRiceCostNote
                    .replace('{n}', String(riceCostServings))
                    .replace('{yen}', (riceCostServings * riceYen).toLocaleString())}
                </p>
              )}
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
              <Link to="/prices" className="mt-1 inline-block text-sm font-bold text-accent-ink underline">
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
                    /* 2026-08-22 便JF・⑦: 飛んだ先の設定に帰り道が無く、下のタブで別の画面へ
                       移るしかなかった（Pro案内と同じ作りへそろえる） */
                    to={settingsLinkWithBack(
                      '/settings?section=budget',
                      location.pathname + location.search,
                    )}
                    className="mt-1 inline-block rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    {ja.mealPlan.budgetSetLink}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </Collapse>
      </section>
      )}

      </div>
      )}

      {/* 買い物メモは「栄養と食費」の面にくっつけない（2026-08-26 便LH・オーナー原文
          「買い物めもはくっつけない。」）。同じ作りの面をもう1枚立てて、別の話だと分かるようにする */}
      <div className="setup-panel mt-[var(--space-md)]">
      {/* 範囲えらび（2026-08-08 便EA）は折りたたみの中、「買い物メモを作る」は外。
          畳んでいても今の範囲が読めるよう、要約は見出しの横に出したままにする
          （2026-08-25 便KU） */}
      <section className="p-[var(--space-sm)]">
        {renderWeekGroupHeader(
          'shopping',
          ja.mealPlan.weekGroupShoppingTitle,
          renderShopRangeSummary(),
          true,
          'shop-range-toggle',
        )}
        {renderShopRange()}
        <button
          type="button"
          onClick={goShopping}
          disabled={weekRecipeIds.length === 0}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
        >
          <ShoppingCart size={20} aria-hidden />
          {shopRangeNarrowed ? ja.mealPlan.goToShoppingPicked : ja.mealPlan.goToShopping}
        </button>
        {weekRecipeIds.length === 0 && (
          <p className="mt-1 text-center text-sm text-ink-muted">
            {shopRangeNarrowed
              ? ja.mealPlan.goToShoppingPickedEmpty
              : ja.mealPlan.goToShoppingEmpty}
          </p>
        )}
      </section>
      </div>

      {/* 2026-08-26 便LH: 献立表(印刷・画像で保存)は月タブの1か所だけにした
          （オーナー原文「献立表は、月と週にあるが、片方におきたい（月がいいかも）。
            月なら期間で絞るがそのまま使える。」）。
          この7日間を1枚にしたいときは、月タブの「期間で絞る」でその7日を選ぶ＝
          見出しも「{start}〜{end}の献立」で、ここに出ていたものと同じ紙が出る */}

      </div>

      {/* 2026-08-02 便DE-11(オーナー指示): ここから開いた「作った記録」の戻るは、
          呼び出し元の週タブへ返す(?back=week)。従来はブラウザの戻りで献立タブに戻るだけで、
          タブの状態は既定の「日」に落ちていた。
          2026-08-09 便EQ: 離れる直前の週と縦位置も覚えて、戻ったら同じ場所へ返す */}
      <Link
        to="/history?back=week"
        onClick={rememberWeekReturn}
        className="mt-[var(--space-md)] flex items-center justify-center gap-0.5 text-center text-sm font-bold text-accent-ink underline"
      >
        {ja.mealPlan.historyLink}
        <ChevronRight size={16} aria-hidden />
      </Link>

      </>
      )}

      {/* レシピ選択ピッカー(週・月の枠に入れる)。
          z-[60]は月タブの日モーダル(z-50)より上・トースト(z-[70])より下に重ねるため
          (2026-07-29 便CB-1・A-3: 日モーダルを開いたままピッカーを出せるようにした。
          選び終わるとピッカーだけが閉じ、下の日モーダルがそのまま残って続けて編集できる) */}
      {pickerOpen && (
        <div data-testid="recipe-picker" className="fixed inset-0 z-[60] flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.mealPlan.pickTitle}</h2>
            <button
              type="button"
              onClick={closePicker}
              aria-label={ja.common.close}
              className="tap-target rounded-full p-2 text-ink-muted"
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
                    ? 'border-accent text-accent-ink'
                    : 'border-edge text-ink-muted'
                }`}
              >
                <SlidersHorizontal size={22} aria-hidden />
              </button>
            </div>
          </div>
          <Collapse open={pickerControlsOpen}>
            <div className="mt-[var(--space-sm)] max-h-[40vh] overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-md)]">
              <div className="rounded-md border border-edge bg-surface p-[var(--space-md)]">
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
                  {pickerTagOptions.map((o) => (
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
          </Collapse>
          <div className="mt-[var(--space-sm)] flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              /* 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）:
                 料理名だけの行をやめ、レシピ一覧の一覧表示と同じ「標準」のカードに寄せた。
                 調理時間・手間・季節・NG食材の印はカード側が同じ位置で出す（出ていた情報は落ちない）。
                 「選択中」「1つ前」の印だけはこの画面ならではの情報なので、料理名の前に添える */
              <ul className="space-y-[var(--space-sm)]">
                {displayedRecipes.map((recipe) => {
                  const isSelected = recipe.id === currentPickerRecipeId
                  // 2026-08-10 便FD: 選び直す前に入っていた料理を「選択中」の次に並べる
                  const isPrevious = !isSelected && recipe.id === previousPickerRecipeId
                  return (
                  <li
                    key={recipe.id}
                    // 検査用の目印（2026-08-19 便IA）。1画面に何品入るかを測るときに、
                    // クラス名や入れ子の段数ではなく、この目印で1品ぶんを掴む
                    data-testid="picker-item"
                    /* 2026-08-22 便JE: 選択中の下敷きの角丸は、上に載るカードと同じ --radius-card */
                    className={isSelected ? 'rounded-card bg-accent/10' : undefined}
                  >
                    <RecipeCard
                      recipe={recipe}
                      density="standard"
                      place="recipePicker"
                      ngIngredients={settings?.ngIngredients ?? []}
                      onSelect={() => void pickRecipe(recipe.id!)}
                      testId={isPrevious ? 'picker-previous' : undefined}
                      titleBadges={
                        isSelected ? (
                          <span className="rounded-sm border border-accent px-1.5 py-0.5 text-xs font-bold text-accent-ink">
                            {ja.mealPlan.pickCurrentBadge}
                          </span>
                        ) : isPrevious ? (
                          /* 「選択中」と同じ形の印にして、色だけ落とす＝いま入っているものと
                             1つ前に入っていたものを一目で区別できるようにする（2026-08-10 便FD） */
                          <span className="rounded-sm border border-edge px-1.5 py-0.5 text-xs font-bold text-ink-muted">
                            {ja.mealPlan.pickPreviousBadge}
                          </span>
                        ) : undefined
                      }
                    />
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 食数(何人分作るか)を決める窓(2026-08-03 便DJ・オーナー指示)。
          既定は設定「ふだん作る人数」(未設定ならレシピに登録されている人数分)で、枠ごとに変えられる。
          変わるのは買い物メモへ渡す材料の分量と、これから作る予定の概算食費(2026-08-03 便DK)。
          栄養の「1人分」の表示は変えない
          (何人分作っても1人が食べる量は1人分のままのため。db/types.ts MealPlanEntry.servings参照) */}
      {servingsEditor && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setServingsEditor(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.mealPlan.servingsTitle}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 flex-1 truncate font-bold">{ja.mealPlan.servingsTitle}</h3>
              <button
                type="button"
                onClick={() => setServingsEditor(null)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {ja.mealPlan.servingsDescription.replace('{title}', servingsEditor.title)}
            </p>
            <div className="mt-[var(--space-md)] flex items-center justify-center gap-[var(--space-md)]">
              <button
                type="button"
                onClick={() =>
                  setServingsEditor((s) =>
                    s ? { ...s, value: clampServings(s.value - 1) } : s,
                  )
                }
                aria-label={ja.mealPlan.servingsDown}
                className="rounded-full border border-edge bg-app p-3 text-accent-ink shadow-sm"
              >
                <Minus size={20} aria-hidden />
              </button>
              <p aria-live="polite" className="min-w-[5rem] text-center text-2xl font-bold">
                {ja.mealPlan.servingsChip.replace('{n}', String(servingsEditor.value))}
              </p>
              <button
                type="button"
                onClick={() =>
                  setServingsEditor((s) =>
                    s ? { ...s, value: clampServings(s.value + 1) } : s,
                  )
                }
                aria-label={ja.mealPlan.servingsUp}
                className="rounded-full border border-edge bg-app p-3 text-accent-ink shadow-sm"
              >
                <Plus size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
              {ja.mealPlan.servingsRecipeNote.replace(
                '{n}',
                String(servingsEditor.recipeServings),
              )}
            </p>
            {/* 設定「ふだん作る人数」を入れているときは、既定がそちらに変わっていることを添える
                (2026-08-03 便DK)。どこで変えられるかは画面名で示す(規約H: 指示語で場所を言わない) */}
            {householdServings != null && (
              <p className="mt-1 text-xs text-ink-muted">
                {ja.mealPlan.servingsHouseholdNote.replace('{n}', String(householdServings))}
              </p>
            )}
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.servingsScopeNote}</p>
            <button
              type="button"
              onClick={() => void submitServings(servingsEditor.value)}
              className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
            >
              {ja.mealPlan.servingsSave}
            </button>
            {servingsEditor.isCustom && (
              <button
                type="button"
                onClick={() => void submitServings(undefined)}
                className="mt-[var(--space-sm)] w-full rounded-md border border-edge bg-app py-3 text-sm font-bold text-accent-ink shadow-sm"
              >
                {ja.mealPlan.servingsReset.replace('{n}', String(servingsEditor.defaultServings))}
              </button>
            )}
          </div>
        </div>
      )}

      {/* A-1 テンプレ保存の窓(2026-07-29 便CB-2)。名前を付けて保存する（複数保存できる）。
          z-[60]は日モーダルより上に重ねるため（週タブからしか開かないが、重なり順をピッカーとそろえる） */}
      {templateSaveOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setTemplateSaveOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.mealPlan.templateSave}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.mealPlan.templateSave}</h3>
              <button
                type="button"
                onClick={() => setTemplateSaveOpen(false)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {ja.mealPlan.templateSaveRange
                .replace('{start}', formatMonthDay(dates[0]))
                .replace('{end}', formatMonthDay(dates[6]))
                .replace('{n}', String(weekTemplateItems.length))}
            </p>
            <label className="mt-[var(--space-md)] block text-sm font-bold text-ink-muted">
              {ja.mealPlan.templateNameLabel}
              <input
                type="text"
                value={templateName}
                maxLength={TEMPLATE_NAME_MAX_LENGTH}
                onChange={(e) => setTemplateName(e.target.value)}
                onKeyDown={(e) => {
                  // 変換確定のEnterでは保存しない（2026-08-09 便EK・便EIと同じ判定）。
                  // テンプレート名は日本語で打つ欄なので、変換の途中で保存されると
                  // 打ちかけの名前がそのまま保存されてしまう
                  if (e.key === 'Enter' && !isImeConfirmKey(e)) void submitTemplateSave()
                }}
                placeholder={ja.mealPlan.templateNamePlaceholder}
                className="mt-1 w-full rounded-sm border border-edge bg-app px-2 py-2 text-base font-normal text-ink placeholder:text-ink-muted/60"
              />
            </label>
            <button
              type="button"
              onClick={() => void submitTemplateSave()}
              className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
            >
              {ja.mealPlan.templateSaveButton}
            </button>
          </div>
        </div>
      )}

      {/* A-1＋B-2 テンプレを流し込む窓(2026-07-29 便CB-2)。
          テンプレを選び、入れる曜日を選んでから流し込む（曜日を絞る＝毎週◯曜はカレー）。
          入るのは空いているところだけで、実行前に規約Fの確認文を必ず出す */}
      {templateApplyScope != null && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setTemplateApplyScope(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.mealPlan.templateApply}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.mealPlan.templateApply}</h3>
              <button
                type="button"
                onClick={() => setTemplateApplyScope(null)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {templateApplyScope === 'month' &&
              monthRangeActive &&
              rangeStart != null &&
              rangeEnd != null
                ? ja.mealPlan.templateApplyRangeDates
                    .replace('{start}', formatMonthDay(rangeStart))
                    .replace('{end}', formatMonthDay(rangeEnd))
                : templateApplyScope === 'month'
                  ? ja.mealPlan.templateApplyRangeMonth
                    .replace('{y}', monthAnchor.slice(0, 4))
                    .replace('{m}', String(Number(monthAnchor.slice(5, 7))))
                  : ja.mealPlan.templateApplyRangeDates
                    .replace('{start}', formatMonthDay(dates[0]))
                    .replace('{end}', formatMonthDay(dates[6]))}
            </p>
            {(mealTemplates?.length ?? 0) === 0 ? (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">
                {ja.mealPlan.templateApplyNone}
              </p>
            ) : (
              <>
                {/* 2026-08-27 便LT（オーナー原文「「テンプレートを適用」「テンプレートの中身を
                    見る・直す」の、作成したテンプレートの選択方法はプルダウンに。多くなったときに
                    スクロール長くなるので。」／「プルダウンではタイトルが一括で確認できて、
                    気になったものの中身を確認→レシピ名を一覧で確認の流れが綺麗ではないのですか？」）:
                    1本ずつ並べる選択をやめ、プルダウン1つにした。
                    テンプレートの名前は**利用者が自分で付けたもの**なので、名前だけで見分けられる。
                    削除はこの窓では1つだけ置く（選んでいるテンプレートに対して効く）＝
                    並びの行ごとにゴミ箱が並んで、選ぶ操作と消す操作が同じ幅で争う形をやめた */}
                {/* 削除は <label> の**外**に置く（中に入れると、押したときに label が
                    プルダウンまで一緒に動かしてしまう） */}
                <div className="mt-[var(--space-md)] flex items-end gap-1">
                  <label className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-ink-muted">
                      {ja.mealPlan.templateApplyPick}
                    </span>
                    <select
                      data-testid="template-apply-pick"
                      value={selectedTemplate?.id ?? ''}
                      onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                      className="select-control mt-1 w-full"
                    >
                      {(mealTemplates ?? []).map((t) => (
                        <option key={t.id} value={t.id}>
                          {`${t.name}（${ja.mealPlan.templateItemCount.replace('{n}', String(t.items.length))}）`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    data-testid="template-apply-delete"
                    onClick={() =>
                      selectedTemplate &&
                      void removeTemplate(
                        selectedTemplate.id!,
                        selectedTemplate.name,
                        selectedTemplate.items.length,
                      )
                    }
                    aria-label={ja.mealPlan.templateDelete}
                    /* tap-target: 消す操作なので、当たり判定は44pxを保つ */
                    className="tap-target shrink-0 rounded-full p-2 text-ink-muted"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </div>

                {/* B-2: 入れる曜日。既定は全曜日＝1週間まるごと。絞ればその曜日だけに入る */}
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                  {ja.mealPlan.templateDowTitle}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {ja.mealPlan.dow.map((label, dow) => {
                    const active = templateDows.includes(dow)
                    const count = selectedTemplate
                      ? templateDowCounts(selectedTemplate.items)[dow]
                      : 0
                    return (
                      <button
                        key={label}
                        type="button"
                        data-dow={dow}
                        onClick={() => toggleTemplateDow(dow)}
                        aria-pressed={active}
                        aria-label={`${label}${ja.mealPlan.templateItemCount.replace('{n}', String(count))}`}
                        className={`min-w-11 rounded-sm border px-2 py-2 text-sm font-bold ${
                          active
                            ? 'border-accent bg-accent text-on-accent'
                            : 'border-edge bg-surface text-ink-muted'
                        }`}
                      >
                        {label}
                        {/* 数字は等幅で出す＝テンプレートを選び直して件数が入れ替わっても
                            7つのボタンの幅が動かない（2026-08-09 便EO） */}
                        <span className="ml-0.5 text-[10px] font-normal tabular-nums">{count}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.templateDowHint}</p>

                <button
                  type="button"
                  onClick={() => void applyTemplate()}
                  className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                >
                  {ja.mealPlan.templateApplyButton}
                </button>
                {/* 入れる前に中身を確かめたいときの入口(2026-08-02 便DE-9)。
                    2026-08-28 便MA（オーナー原文「テンプレートをこの月に入れる→テンプレートの
                    中身を見る→ここから戻るで週に飛んでしまう。」）: この窓は週からも月からも
                    開くので、**開いたタブ**を ?back= で運ぶ。戻るはそのタブへ帰る */}
                <Link
                  to={`/meal-templates?back=${templateApplyScope === 'month' ? 'month' : 'week'}`}
                  onClick={
                    templateApplyScope === 'month' ? rememberMonthReturn : rememberWeekReturn
                  }
                  className="mt-[var(--space-sm)] block text-center text-sm font-bold text-accent-ink underline"
                >
                  {ja.mealPlan.templateManageLink}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* 月タブ: 日タップでその日の献立を窓表示(便U-5。従来の即週ジャンプは「この週を開く」ボタンへ移動)。
          2026-07-29 便CB-1・docs/59 A-3で「閲覧するだけの窓」から「その場で編集できる窓」へ変えた:
          今日・未来日は週タブと同じ編集ブロック(主菜/副菜の行・行サイコロ・＋料理を追加)を出し、
          週へ飛ばずに追加・差し替え・削除ができる。レシピ名は詳細リンクではなく
          「選び直すボタン」になる(週タブの行と同じ機構をそのまま使うため)。
          過去日は従来どおり作った記録だけを見せる(便BS)。
          A-2の日付メモは過去日・未来日のどちらでも編集できる */}
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
            className="max-h-[85vh] w-full max-w-sm overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            {/* 2026-08-23 便JN: 見出しの行に「編集／完了」を置く（週の曜日カードと同じ場所・
                同じ文言・同じ見た目＝押している間は塗りつぶし・名前は「完了」に変わる）。
                狭い画面では折り返して日付を1行に保つ（週の見出しと同じ作法）。
                「編集」と「閉じる」は結果の違う操作なので12px空ける（便IZ） */}
            <div className="flex flex-wrap items-center gap-3">
              <h3 className="min-w-0 flex-1 font-bold">{dayModalTitle}</h3>
              <span className="ml-auto flex shrink-0 items-center gap-3">
                {dayModalWindow.editToggle && (
                  <button
                    type="button"
                    data-testid="day-modal-edit"
                    data-date={dayModalDate}
                    onClick={() =>
                      setMonthEditDate((prev) => planToggleDayEdit(prev, dayModalDate))
                    }
                    aria-pressed={dayModalEditing}
                    /* 読み上げの名前は、その日の編集モードで触るものを言う（便JF・①と同じ）。
                       過ぎた日は献立ではなく作った記録を触るので、同じ「編集」でも名乗りを変える */
                    aria-label={(dayModalEditing
                      ? ja.mealPlan.weekDayEditOffAria
                      : dayModalIsPast
                        ? ja.mealPlan.weekDayRecordEditOnAria
                        : ja.mealPlan.weekDayEditOnAria
                    ).replace('{date}', dayModalDate.replaceAll('-', '/'))}
                    className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                      dayModalEditing
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge bg-surface text-ink-muted'
                    }`}
                  >
                    <Pencil size={14} aria-hidden />
                    <SwapLabel
                      current={dayModalEditing ? ja.mealPlan.weekDayEditDone : ja.mealPlan.weekDayEdit}
                      labels={[ja.mealPlan.weekDayEdit, ja.mealPlan.weekDayEditDone]}
                    />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDayModalDate(null)}
                  aria-label={ja.common.close}
                  className="tap-target -mr-2 shrink-0 rounded-full p-2 text-ink-muted"
                >
                  <X size={20} aria-hidden />
                </button>
              </span>
            </div>
            {/* 過ぎた日の編集モードだけに出す「作った記録を追加」（2026-08-23 便JN。
                週の曜日カード＝便JF・①とまったく同じ入口・同じ止め方）。
                通常表示には出さない＝過ぎた日の窓は今までどおり
                「作った記録が並ぶだけ」の見え方を保つ */}
            {dayModalWindow.recordAdd && (
              <div className="mt-[var(--space-sm)]">
                <button
                  type="button"
                  data-testid="past-record-add"
                  data-date={dayModalDate}
                  onClick={() => {
                    setRecordPickDate(dayModalDate)
                    setPickerQuery('')
                  }}
                  /* 鍵の掛かった日では押せない（便JF・オーナー原文
                     「鍵をかけたら編集もできなくなるようにして。」）。止め方は週と同じ＝
                     ボタンは同じ場所に出したまま押せなくし、理由はすぐ下の1行が言う */
                  disabled={dayModalLocked}
                  className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-accent bg-surface py-3 font-bold text-accent-ink shadow-sm ${
                    dayModalLocked ? 'opacity-40' : ''
                  }`}
                >
                  <Plus size={18} aria-hidden />
                  {ja.mealPlan.pastRecordAdd}
                </button>
                {dayModalLocked && (
                  <p data-testid="past-record-locked-note" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.pastRecordLockedNote}
                  </p>
                )}
                {/* 在庫を下げる設定がONの人にだけ、押す前に読める場所で違いを書く（規約F） */}
                {!dayModalLocked && settings?.cookedReflectPantry && (
                  <p data-testid="past-record-pantry-note" className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.pastRecordPantryNote}
                  </p>
                )}
              </div>
            )}
            {dayModalWindow.plan === 'none' ? (
              // 過去日: 予定は表示から消す(便BS・タスク2)。記録が無ければ空案内だけ出す(記録があれば下の
              // 「作った記録」ブロックが主役になる)。mealPlansデータは削除しない=非破壊。
              // 過去日は週タブと同じく編集グリッドも出さない(過ぎた日の献立は振り返る対象)
              dayModalLogs.length === 0 ? (
                <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.mealPlan.pastNoRecord}</p>
              ) : null
            ) : dayModalWindow.plan === 'demo' ? (
              // サンプルデモ: その日の献立を読むだけにする（書き込み先が無いので編集欄は出さない）
              <div className="mt-[var(--space-sm)]">
                {dayModalEntries.length === 0 ? (
                  <p className="text-sm text-ink-muted">{ja.mealPlan.monthDayModalEmpty}</p>
                ) : (
                  <ul className="space-y-1">
                    {dayModalEntries.map((entry) => {
                      const recipe = recipeById.get(entry.recipeId)
                      if (!recipe) return null
                      return (
                        /* 2026-08-19 便HW: 本物の月タブの枠と同じ「小」のカードにそろえる。
                           サンプルは書き込み先が無いので押せない見本のまま */
                        <li key={entry.id}>
                          <RecipeCard
                            recipe={recipe}
                            density="small"
                            place="planSlot"
                            readOnly
                            titleBadges={
                              <span className="text-xs text-ink-muted">
                                {ja.mealPlan.slot[entry.slot]}・
                                {ja.mealPlan.role[entry.role ?? 'main']}
                              </span>
                            }
                          />
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : (
              // 今日・未来日: 週タブと同じ編集ブロック(2026-07-29 便CB-1・docs/59 A-3)。
              // 週へ飛ばずに この窓のまま レシピの追加・差し替え・削除ができる。
              // 出す食事は「表示する食事」の設定に従いつつ、設定で隠していても既に献立が
              // 入っている食事は必ず出す(月から見たときにデータが見えなくならないように)。
              //
              // 2026-08-23 便JN: ここを週タブと同じ2モードにした。通常表示
              // （renderSlotView＝写真と料理名だけ）と編集モード（renderSlotEditor＝
              // 1品ごとの操作すべて）を、見出しの「編集」で切り替える。
              // 使う部品・並べ方は週タブとまったく同じものをそのまま呼ぶ
              /* 食事どうしの間は週タブとまったく同じ16px（2026-08-25 便KU） */
              <div className="mt-[var(--space-sm)] space-y-[var(--space-md)]">
                {dayModalWindow.plan === 'editor' ? (
                  <>
                    {dayModalEntries.length === 0 && (
                      <p className="text-sm text-ink-muted">{ja.mealPlan.monthDayModalEmpty}</p>
                    )}
                    {MEAL_SLOTS.filter(
                      (slot) =>
                        visibleSlots.includes(slot) || (dayModalBySlot.get(slot)?.length ?? 0) > 0,
                    ).map((slot) => renderSlotEditor(dayModalDate, slot))}
                  </>
                ) : (
                  <>
                    {MEAL_SLOTS.filter(
                      (slot) =>
                        visibleSlots.includes(slot) || (dayModalBySlot.get(slot)?.length ?? 0) > 0,
                    ).map((slot) => renderSlotView(dayModalDate, slot))}
                    {/* 通常表示は空き枠を出さないので、1品も無い日は押す場所の名前を1行で書く
                        （書かないと行き止まりになる）。週タブの通常表示と同じ1行を使う */}
                    {!MEAL_SLOTS.some(
                      (slot) =>
                        (dayModalBySlot.get(slot)?.length ?? 0) > 0 ||
                        isMealSlotLocked(lockedKeys, dayModalDate, slot),
                    ) && (
                      <p data-testid="day-modal-view-empty" className="text-sm text-ink-muted">
                        {ja.mealPlan.weekDayViewEmpty}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
            {/* その日の「作った記録」(2026-07-17 便Z-2・docs/35 §3。画像付き)。
                月間献立への機能追加はPro v2まで凍結が既定だったが、オーナー指示により
                解除してこの表示と「記録あり」マークを実装(README決定ログに記録) */}
            {dayModalLogs.length > 0 && (
              <div className="mt-[var(--space-sm)]">
                <p className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                  <CheckCircle2 size={14} className="text-accent-ink" aria-hidden />
                  {ja.mealPlan.pastCookedTitle}
                </p>
                {/* 記録どうしの間は12px（2026-08-25 便KU）。1件の中（カードと入口の行）は2pxなので、
                    どの入口がどのレシピのものかが距離で読める（便JQ と同じ「中 < 間」の関係） */}
                <ul className="mt-1 space-y-3">
                  {dayModalLogs.map((entry, i) => (
                    <CookedLogCard
                      key={`${entry.recipe.id ?? `d${entry.detachedRecordId}`}-${i}`}
                      recipe={entry.recipe}
                      log={entry.log}
                      readOnly={isDemo}
                      // 2026-08-25 便KU（オーナー原文「窓の記録のレシピからレシピ詳細→戻る→
                      // レシピ一覧に戻ってしまうので、直近の画面に戻して。」）: この記録カードだけ
                      // 出所を渡しておらず、詳細の「戻る」が必ずレシピ一覧へ行っていた。
                      // 同じ窓の中の献立の枠のカードと**同じ帰り道**に乗せる
                      // ＝月と縦位置とこの日の窓ごと開き直す（rememberMonthReturn の openDate）。
                      // 窓は閉じない（閉じると覚える対象の openDate が消える）
                      linkState={logDetailLinkState}
                      onNavigate={rememberLogDetailReturn}
                      // 2026-08-09 便EQ(オーナー実機「月献立の作った記録から献立名をタップで
                      // 整理された記録を見たい」): 料理名を押すと記録の中身の小窓が開く
                      onOpenDetail={() => setLogDetail(entry)}
                      // 記録の削除は**編集モードのときだけ**渡す（2026-08-23 便JN。
                      // 週の曜日カード＝便JFと同じ作法。渡さなければボタンは出ない
                      // ＝通常表示は今までどおり、記録のカードが並ぶだけ）
                      onDelete={
                        dayModalWindow.recordDelete && dayModalDate
                          ? () => void deletePastCookedRecord(dayModalDate, entry)
                          : undefined
                      }
                      /* 鍵の掛かった日では消せない（足す側とまったく同じ判断＝日ごとの鍵） */
                      deleteDisabled={dayModalLocked}
                      // 削除済みレシピの記録には行き先が無いので、カードそのものを記録の小窓にする
                      // (2026-08-16 便GZ。'below' のままだと押せないレシピ詳細へのリンクになる)
                      detailAs={entry.detachedRecordId != null ? 'card' : 'below'}
                    />
                  ))}
                </ul>
              </div>
            )}
            {/* カレンダーに出す写真の指名(2026-08-07 便DU・オーナー指示
                「カレンダーのサムネに使うレシピを日ごとに選べるように」)。
                写真の候補が2つ以上ある日だけ出す(1つしかない日は選ぶ意味がない)。
                選ばない状態が既定＝logic/monthCover.ts の優先順(記録の写真＞レシピの写真)で自動に決まる。
                ここで選ぶのは表示の好みだけで、献立や作った記録のデータには一切触らない */}
            {/* 2026-08-23 便JN: 「普段の見え方をシンプルにする」（オーナー原文）に合わせ、
                この指名は編集モードの中に置く。読むための情報ではなく、
                カレンダーの見た目を決める操作なので、通常表示には並べない */}
            {dayModalWindow.cover && dayModalCoverOptions.length >= 2 && (
              <div className="mt-[var(--space-md)]" data-testid="day-cover-picker">
                <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.monthDayCoverTitle}</p>
                <p className="mt-0.5 text-xs text-ink-muted">{ja.mealPlan.monthDayCoverHint}</p>
                <div className="mt-1 flex gap-2 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => chooseDayCover(undefined)}
                    aria-pressed={dayModalCoverChoice == null}
                    aria-label={ja.mealPlan.monthDayCoverAutoAria}
                    className={`w-20 shrink-0 rounded-sm border p-1 text-center text-xs font-bold ${
                      dayModalCoverChoice == null
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge bg-app text-ink-muted'
                    }`}
                  >
                    {ja.mealPlan.monthDayCoverAuto}
                  </button>
                  {dayModalCoverOptions.map((option) => (
                    <DayCoverOption
                      key={option.recipeId}
                      title={option.title}
                      photo={option.photo}
                      selected={dayModalCoverChoice === option.recipeId}
                      onSelect={() => chooseDayCover(option.recipeId)}
                    />
                  ))}
                </div>
              </div>
            )}
            {/* 過ぎた日は「予定を消した」のではなく「表示していないだけ」を月タブにも書く
                (2026-07-30 便CH/C9(a)。週タブには便CD/MP-07で入っていたが月には無く、
                作らなかった予定が黙って消えたように見えていた。データは非破壊で残っている) */}
            {dayModalIsPast && (
              <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                {ja.mealPlan.pastPlanHidden}
              </p>
            )}
            {/* 日付メモ(2026-07-29 便CB-1・docs/59 A-2)。週タブの各日カードと同じ入力欄。
                過去日にも出す(「この日は外食だった」と後から書き残せるようにするため)。
                サンプルデモは書き込み先が無いので、メモがある日はその中身だけを読む形で出す */}
            {isDemo ? (
              monthDayNoteByDate.get(dayModalDate) && (
                <div className="mt-[var(--space-md)]">
                  <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.dayNoteLabel}</p>
                  <p className="mt-1 rounded-sm border border-edge bg-app px-2 py-1.5 text-sm">
                    {monthDayNoteByDate.get(dayModalDate)?.text}
                  </p>
                </div>
              )
            ) : (
              <>
                <div className="mt-[var(--space-md)]">
                  <DayNoteEditor
                    date={dayModalDate}
                    note={monthDayNoteByDate.get(dayModalDate)}
                    onSave={(d, text) => void handleSaveDayNote(d, text)}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (dayModalDate) goToWeekOf(dayModalDate)
                    setDayModalDate(null)
                  }}
                  className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-app py-3 text-sm font-bold text-accent-ink shadow-sm"
                >
                  {ja.mealPlan.monthDayModalOpenWeek}
                </button>
              </>
            )}
            {/* 窓の下の閉じる導線(2026-08-07 便DU・オーナー指示⑦⑧)。
                窓は縦に長くなることがあり、右上の×まで戻らないと閉じられなかった。
                何も変えていないときは「閉じる」1つ。この画面で献立やメモを変えたときだけ
                「キャンセル」(開いたときの状態へ戻す・確認あり)と「保存」(確定して閉じる)を出す。
                サンプルデモは書き込み先が無いので常に「閉じる」だけ */}
            {/* 「保存」を押さずに窓を閉じても変更は残ることを、ボタンの直前に正直に書く(規約F・便DU)。
                取り消したいときは「キャンセル」を押す、と読める並びにする */}
            {!isDemo && dayModalDiff?.dirty && (
              <p className="mt-[var(--space-md)] text-xs text-ink-muted">
                {ja.mealPlan.monthDayModalDirtyNote}
              </p>
            )}
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              {!isDemo && dayModalDiff?.dirty ? (
                <>
                  <button
                    type="button"
                    data-testid="day-modal-cancel"
                    onClick={() => void cancelDayModal()}
                    className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
                  >
                    {ja.mealPlan.monthDayModalCancel}
                  </button>
                  <button
                    type="button"
                    data-testid="day-modal-save"
                    onClick={() => setDayModalDate(null)}
                    className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                  >
                    {ja.mealPlan.monthDayModalSave}
                  </button>
                </>
              ) : (
                /* 2026-08-24 便KJ・③: 見た目の値をここに書き写したままだと、
                   同じ形にそろえた作った記録の窓（DIALOG_CANCEL_BUTTON_CLS）と
                   片方だけ直したときに別物になる。同じ1本から取る（値は1文字も変えていない） */
                <button
                  type="button"
                  data-testid="day-modal-close"
                  onClick={() => setDayModalDate(null)}
                  className={DIALOG_CANCEL_BUTTON_CLS}
                >
                  {ja.common.close}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 「作った記録」の中身の小窓(2026-08-09 便EQ)。週タブの過去日カード・月タブの日の窓・
          献立の作った！済みの枠、どこから開いても同じ窓が出る。日の窓の上に重なるので、
          Escapeと端末の「戻る」は上の1枚(この窓)だけを閉じる(useOverlayDismissが面倒を見る) */}
      {logDetail && (
        <CookedLogDetailModal
          target={logDetail}
          onClose={() => setLogDetail(null)}
          // 小窓からレシピ詳細・記録の編集へ移ったときも、詳細の「戻る」は
          // いま開いているタブの同じ場所へ帰す(便DT-2の仕組みを日・月にも広げた)
          linkState={logDetailLinkState}
          onNavigate={() => {
            rememberLogDetailReturn()
            setLogDetail(null)
            setDayModalDate(null)
          }}
          // 記録をこの窓の中で直したときの一言（2026-08-10 便FD）
          onMessage={setMessage}
        />
      )}

      {/* 「現在の条件」の窓（2026-08-19 便ID・④）。週タブ・月タブのどちらから開いても同じ窓。
          **折りたたみやタブの中ではなくここに1つだけ**置く: 折りたたみは開閉のあいだ中身を
          切り取るので、その中に窓を置くと閉じるときに窓ごと切り取られる */}
      {renderSuggestConditionsModal()}

      {/* 「今日なに作る？」で出ているものを、どの食事に入れるか選ぶ窓（2026-08-17 便HI）。
          レシピ詳細の「今日の献立に追加」・レシピ一覧のまとめ追加とまったく同じ部品・
          同じ選択肢（朝食/昼食/夕食＋どれも決めずに）を使う＝新しい見た目は作らない。
          2026-08-18 便HM: 「1品」を入れるときもこの窓（オーナー指示）。
          見出しを差し替えるのは献立（2品）のときだけで、1品のときは部品の既定の見出し
          （ja.detail.todaySlotDialogTitle）＝レシピ詳細から1品入れるときとまったく同じ窓になる */}
      <TodaySlotModal
        open={todaySlotPick != null}
        title={
          todaySlotPick?.from === 'plan'
            ? ja.mealPlan.todaySuggestSlotTitle.replace('{n}', String(todaySlotPick.ids.length))
            : undefined
        }
        onPickSlot={(slot) => void applyTodaySlotPick(slot)}
        onPickUndecided={() => void applyTodaySlotPick()}
        onClose={() => setTodaySlotPick(null)}
      />

      {/* ホーム画面への追加の案内(2026-08-10 便EW)。2026-08-17 便HGでホーム画面を廃止し、
          アプリを開いた直後に着くのが「日」になったので、着地の合図もここへ移した。
          出す作法（パソコンには出さない・初回のみ・閉じたら再表示しない）は変えていない */}
      {showHomeScreenNotice && viewMode === 'day' && (
        <HomeScreenNotice onClose={() => setShowHomeScreenNotice(false)} />
      )}
    </div>
  )
}
