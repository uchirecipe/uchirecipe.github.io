import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { settingsLinkWithBack } from '../logic/backLink'
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
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { usePriceEntries } from '../db/prices'
import { usePantryItems } from '../db/pantry'
import { pantryAvailableNames } from '../logic/pantry'
import { searchRecipes, topTagsByUsage, type TimeFilter, type EffortFilter, type TagFilter } from '../logic/search'
import { sortResults, type RecipeSortOption } from '../logic/recipeSort'
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
} from '../db/mealPlan'
import { useDayNoteRange, saveDayNote } from '../db/dayNotes'
import { useMealPlanLocks, toLockKeySet, applyMealLockToggle } from '../db/mealPlanLocks'
import { useMealTemplates, saveMealTemplate, deleteMealTemplate } from '../db/mealTemplates'
import {
  buildTemplateItems,
  planTemplateFill,
  templateDowCounts,
  ALL_DOWS,
  TEMPLATE_NAME_MAX_LENGTH,
} from '../logic/mealTemplate'
import { buildPlanSheet, type PlanSheet } from '../logic/planSheet'
import { sharePlanSheetImage } from '../logic/planSheetImage'
import Toast from '../components/Toast'
import { useConfirm } from '../components/ConfirmProvider'
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  undoTodayListCooked,
  markAllTodayListCooked,
  importRecipeIdsToTodayList,
  removeStaleFromPlanTodayList,
  restoreTodayListItems,
} from '../db/todayList'
import {
  MEAL_SLOTS,
  MEAL_GENRES,
  toggleMealGenre,
  normalizePlanGenres,
  weekDates,
  dowIndex,
  sortMealSlots,
  shiftWeek,
  shiftDate,
  isPastDate,
  planDefaultFoldedDates,
  monthDates,
  shiftMonth,
  monthLeadingBlanks,
  suggestCandidates,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  todayListPickedIds,
  showsCookedPlanRowToday,
  normalizeDateRange,
  rangeDayCount,
  isOneDish,
  recipeGenre,
  detectGenreMix,
  isMainDish,
  proteinSourceOf,
  preferredProteinSources,
  dishAvoidKeys,
  cookedPlanEntryIds,
  mealOccasionCount,
  mealRoleForRecipe,
  chooseBalancedPair,
  PURPOSE_REDRAW_ATTEMPTS,
  isMealSlotLocked,
  isMealEditBlocked,
  isDayMealLocked,
  planDayLockToggle,
  planSlotLockToggle,
  planAllLockToggle,
  planClearMealSlots,
  planShowWeekLock,
  planToggleDayEdit,
  planViewRows,
  WEEK_GROUP_DEFAULT_OPEN,
  PLAN_QUICK_MINUTES_OPTIONS,
  DEFAULT_PLAN_QUICK_MINUTES,
} from '../logic/mealPlan'
import type {
  FillWeekPlan,
  MealGenre,
  MealSlotEdit,
  ProteinSource,
  SuggestPairResult,
} from '../logic/mealPlan'
// 食数の範囲ガード(1〜20)はレシピの人数分と同じものを使う(2026-08-03 便DJ)。
// 実効食数・既定の食数の判定も同じ場所に集約してある(2026-08-03 便DK)
import { clampServings, effectiveMealServings, defaultMealServings } from '../logic/servings'
// 買い物リストの範囲えらび(2026-08-08 便EA)。集計に入れる枠の判定と、範囲の言い表しは
// logic/shopping.ts の純関数に置いてある(scripts/test-logic.mjs で固定)
import {
  filterShoppingEntries,
  formatShoppingRangeDates,
  formatShoppingRangeLabel,
  isShoppingRangeNarrowed,
  shoppingRangeIncludesTodayList,
  type ShoppingRange,
} from '../logic/shopping'
import { todayString } from '../logic/date'
import {
  clearCookNaviSession,
  hasCookNaviTimeline,
  loadCookNaviSession,
  reconcileSelectedIds,
  COOK_NAVI_MIN_RECIPES,
} from '../logic/cookNaviSession'
// 日本語入力の変換確定Enterの判定(2026-08-09 便EI → 便EKで献立タブの2欄にも適用)。
// Enterで何かを確定する入力欄は、必ずこの判定で変換確定のEnterを除外する
import { isImeConfirmKey } from '../logic/imeKey'
import {
  buildPriceIndex,
  estimateRecipeCost,
  sumMealPlanEntriesCost,
  pricelessIngredientNames,
  pricelessIngredientNamesOfRecipes,
} from '../logic/priceEstimate'
import {
  computeRecipeNutrition,
  roundNutrient,
  isNutritionUnlocked,
  nutritionSourceName,
  nutritionLabelFor,
  nutritionUnitFor,
  resolveNutritionDisplayKey,
  NUTRITION_DISPLAY_KEYS,
  type NutrientTotals,
} from '../logic/nutrition'
import {
  summarizeRangeIntake,
  rangeIntakeRecipes,
  dayIntakeMap,
  type DayIntake,
  type RangeCookedDish,
  type RangeIntakeSummary,
  type RangePlannedDish,
} from '../logic/rangeSummary'
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
} from '../logic/nutritionBalance'
import { canUseMonthTrial, isMonthTrialReady, MONTH_TRIAL_MIN_COOKED } from '../logic/proTrial'
import { pickDayCoverPhoto, setDayCoverChoice } from '../logic/monthCover'
import { diffDayEdit, type DayEditDiff } from '../logic/dayEdit'
import type { MonthDemoData } from '../logic/monthDemo'
import Collapse from '../components/Collapse'
import SwapLabel from '../components/SwapLabel'
import NutritionBalancePanel from '../components/NutritionBalancePanel'
import RecipeCard from '../components/RecipeCard'
import { SwipeRevealRow } from '../components/SwipeRevealRow'
import { usePhotoUrl } from '../components/usePhotoUrl'
import {
  DIALOG_ACTIONS_CLS,
  DIALOG_BACKDROP_CLS,
  DIALOG_CARD_CLS,
  DIALOG_PRIMARY_BUTTON_CLS,
} from '../components/dialogStyle'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { useScrollLock } from '../components/useScrollLock'
import type {
  CookedLog,
  DayNote,
  MealPlanEntry,
  MealPurpose,
  MealRole,
  MealSlot,
  MonthCellMode,
  Recipe,
  Settings,
  TodayListItem,
} from '../db/types'
import { LESS_MEAL_PURPOSES, MEAL_ROLES, MORE_MEAL_PURPOSES } from '../db/types'
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
} from '../logic/navMemory'
import CookedLogDetailModal, {
  type CookedLogDetailTarget,
} from '../components/CookedLogDetailModal'
import {
  useDetachedLogEntries,
  type DetachedLogEntry,
} from '../components/useDetachedLogEntries'
// ホーム画面の廃止（2026-08-17 便HG）で、ホームにあった部品を献立の「日」へ移した。
// どれも中身は変えていない（置き場所と、出す/出さないの判定だけが変わっている）
import TodaySuggestPanel from '../components/TodaySuggestPanel'
// 食事の枠を選ぶ窓（2026-07-17 便Z-1）。レシピ詳細・レシピ一覧とまったく同じ部品を使う
// ＝おまかせで組んだ献立を入れるときも、新しい見た目を作らない（2026-08-17 便HI）
import TodaySlotModal from '../components/TodaySlotModal'
import RecentCookedList from '../components/RecentCookedList'
import DayStartNotices from '../components/DayStartNotices'
import HomeScreenNotice from '../components/HomeScreenNotice'
import { shouldShowHomeScreenNoticeNow } from '../logic/homeScreenNotice'
import { ja } from '../i18n/ja'

/** 献立タブの3タブ構成（2026-07-16 便U-1: 現行の「今日セクション+週/月切替」をタブへ再構成） */
type MealPlanViewMode = 'day' | 'week' | 'month'

/**
 * 週タブからレシピ詳細を開くときに持ち回る出所（2026-08-07 便DT-2・オーナー指示）。
 * 詳細画面の「戻る」は、今日の献立と同じ例外としてここへ帰る（RecipeDetailPage）。
 * `restore=1` が付いているときだけ、週タブは覚えた週とスクロール位置を復元する。
 */
const WEEK_RETURN_LINK_STATE = {
  from: 'mealPlanWeek',
  fromPath: `/meal-plan?focus=week&${WEEK_RETURN_PARAM}=1`,
} as const

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
const PICKER_EFFORT_OPTIONS: { value: EffortFilter; label: string }[] = [
  { value: 'all', label: ja.search.effortAll },
  { value: 'easy', label: ja.effort.easy },
  { value: 'normal', label: ja.effort.normal },
  { value: 'fancy', label: ja.effort.fancy },
]
const pickerChipCls = (active: boolean) =>
  `rounded-sm border px-3 py-1.5 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

/**
 * 今日の献立の1品（2026-08-19 便HW・A案＝2段）。
 *
 * 2026-08-03 便DH: 日タブを「レシピ一覧から選択中」と「今週の献立の予定」の縦一列に分けた。
 * footer には行の下に置く操作（レシピ一覧から選んだ品を今日の予定へ入れるボタン）を渡す。
 *
 * 2026-08-20 便IG・①（オーナー原文「「作った！」と×が邪魔。作った！をつけるときには
 * モード切り替えするようにしたら解決できる？全て作った！も含めて。」）:
 * ×は「今日の献立」の**整理モードのあいだだけ**出す（呼び出し側が onRemove を渡さなければ出ない）。
 *
 * 2026-08-20 便II・⑥（オーナーが実機を見て便IGの裁定をひっくり返した。原文
 *   「整理に作った！も入れたい。作った！が気軽にできないよりも、献立を１画面で確認できない方が
 *     問題では？」）:
 * **「作った！」も整理モードのあいだだけ**出す（onCooked を渡さなければ出ない）。
 * 整理モードでないときは「作った！」と×が消え、**料理名の行だけ**になる
 * ＝今日の献立を1画面で見渡せる。
 *
 * ただし footer（「◯食に入れる」）は**モードの外にも出したまま**にする（同便の裁定）。
 * 「整理」は減らす・終わらせる操作の集まりで、これから決める操作は性質が違う。
 * 「レシピ一覧から選択中」はレシピを選んだ直後の一時的な状態なので、次にやることを
 * モードの奥へ入れると、選んだ直後に手が止まる（流れの途中に行き止まりを作らない）。
 *
 * 2026-08-19 便HW（オーナー原文「場所や機能ごとにレシピカードの形や内容が変わっているのが
 * みづらい」／司令部の裁定「日タブの行はA案＝2段」）:
 * 自前で組んでいた「40pxサムネ＋料理名＋作った！＋×」の**1行**をやめ、
 *   1段目 … 共通のレシピカードの「標準」（レシピ一覧の一覧表示と同じ形。押すとレシピ詳細へ）
 *   2段目 … その料理に対する操作（「作った！」「×」と、今日の予定へ入れるボタン）
 * の2段にした。直った問題: 料理名とボタンが横一列だったため、料理名が
 * 「チンゲン菜としいたけの…」のように途中で切れていた（2段にすると名前が幅いっぱい使える）。
 * 押せる大きさ（「作った！」44px・×の tap-target）は変えていない。
 */
function TodayListRow({
  recipe,
  ngIngredients,
  onCooked,
  onRemove,
  removeLabel,
  footer,
  swipeOpen,
  onSwipeOpenChange,
  onSwipeRemove,
}: {
  recipe: Recipe
  /**
   * 設定「食べられない食材」（2026-08-19 便IA）。引っかかる品にはカードが警告の印を出す。
   * レシピ一覧・献立の枠・「レシピを選ぶ」画面には最初から出ていたのに、ここと
   * 「今日なに作る？」の候補だけ渡し忘れていて、**今日これを作ると決めた品**について
   * 何も言わない画面になっていた。
   */
  ngIngredients: string[]
  /** 「作った！」（2026-08-20 便II・⑥。整理モードのあいだだけ渡す＝渡さなければ出ない） */
  onCooked?: () => void
  onRemove?: () => void
  /**
   * ×の読み上げ名（2026-08-17 便HI）。既定は「この献立から外す」＝今日の献立からだけ外す。
   * 「今週の献立の予定」の行は今日と今週の両方から外れるので、呼び出し側が別の名前を渡す
   * （同じ形の×で違うことが起きるのを、読み上げでも見分けられるようにする）。
   */
  removeLabel?: string
  footer?: ReactNode
  /**
   * 行を左へ払うと右から出る「外す」（2026-08-21 便IQ。オーナー原文
   * 「横にスワイプして消せるのが楽なんですけどね。」）。
   *
   * **整理モードの外でも効かせる**＝モードに入らずに外せることが「楽」の中身。
   * 出るのはボタンだけで、**押して初めて外れる**（払い切っただけでは何も起きない）。
   * 開いている行は同時に1つだけなので、開いている行の合図は画面側が持つ。
   * onSwipeRemove を渡さなければ、その行は払っても何も出ない。
   */
  swipeOpen?: boolean
  onSwipeOpenChange?: (open: boolean) => void
  onSwipeRemove?: () => void
}) {
  // state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
  // RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(献立タブ)へ
  // 戻るために参照する（2026-07-12オーナー指示）。
  // ?focus=today を付けて「今日の献立から戻ってきた」ことをMealPlanPageに伝える。
  // これが付いていると、日タブを必ず選択した状態に固定する
  // （2026-07-15オーナー実機フィードバック: 今日の献立からレシピを開いて戻ると
  // 今週の献立に飛ばされる、の恒久対策。2026-07-16便U-1でタブ構成に再設計後もこの
  // 「戻ったら必ず日タブ」という保証は維持する）
  const fromState = { from: 'todayList' as const, fromPath: '/meal-plan?focus=today' }
  const card = (
    <RecipeCard
      recipe={recipe}
      density="standard"
      place="todayPlan"
      ngIngredients={ngIngredients}
      // 検査用の目印（2026-08-19 便HY・CARDPARTS-01）。「今日なに作る？」の候補と
      // 同じレシピのカードを見比べて、場所ごとに載せる情報が違うことを機械で見張る
      testId="day-plan-card"
      titleTestId="day-plan-card-title"
      linkState={fromState}
      /* 2026-08-20 便II・⑥: 操作が1つも無いとき（＝整理モードでないとき）は2段目そのものを
         作らない＝料理名の行だけになる */
      actions={
        onCooked || onRemove || footer ? (
          <>
            {/* 「作った！」と×は**行の右へ寄せる**（2026-08-21 便IU・②。オーナー原文
                「・整理画面の「作った！」と×は右に寄せて。」）。
                2つをひと塊にして ml-auto で右端まで送る＝左に空きができ、料理名の下が
                すっきりする。押せる大きさ（「作った！」44px・×の tap-target）は変えていない。
                「◯食に入れる」（footer）は w-full なので、これまでどおり次の行に回る＝
                右へ寄るのはオーナーが名指しした2つだけ。
                **2つの間隔（gap）は必ず残す**（2026-08-22 司令部）: 塊にする前は外側の行の
                gap-[var(--space-sm)] と ×の ml-2 が足されて16px空いていた。塊にした時点で
                外側のgapが効かなくなり8pxまで詰まる＝「作った！」(記録が残る)と×(確認なしで消える)が
                密着する。2026-07-29 便CD/MP-21で広げたのと同じ穴なので、内側にも同じgapを置く */}
            {(onCooked || onRemove) && (
              <div className="ml-auto flex shrink-0 items-center gap-[var(--space-sm)]">
                {/* 2026-08-03 便DP-3(オーナー指示): ☑アイコンだけでは操作できるものに見えなかったので、
                    枠・地色・文字ラベルの付いたボタンにした。高さは44px(min-h-11)＝従来のp-3のアイコン
                    ボタンと同じ当たり判定を下回らないようにする。
                    2026-08-18 便HN（オーナー指摘「『作った！』と『全て作った！』など、同じような機能は
                    色を同じにした方が、パッとみてわかりやすい」）: 記録をつけるボタンはアプリ全体で
                    6か所あり、多数側＝アクセントの塗りに合わせている */}
                {onCooked && (
                  <button
                    type="button"
                    onClick={onCooked}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm bg-accent px-2.5 py-2 text-sm font-bold text-on-accent shadow-sm"
                  >
                    <CheckCircle2 size={16} aria-hidden />
                    {ja.mealPlan.todayMarkCooked}
                  </button>
                )}
                {/* 2026-07-29 便CD/MP-21: 「作った」(記録が残る)と「この献立から外す」(確認なしで消える)は
                    破壊度が違うのに36px・間隔8pxで密着していた。両方44px(p-3)にし、間の余白も広げて
                    押し間違いを減らす */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={onRemove}
                    aria-label={removeLabel ?? ja.mealPlan.todayRemove}
                    className="tap-target ml-2 shrink-0 rounded-full p-3 text-ink-muted"
                  >
                    <X size={20} aria-hidden />
                  </button>
                )}
              </div>
            )}
            {footer}
          </>
        ) : undefined
      }
    />
  )
  // 払っても何も出さない行（onSwipeRemove を渡していない場所）は、これまでどおりそのまま出す
  if (!onSwipeRemove) return <li>{card}</li>
  return (
    <li>
      <SwipeRevealRow
        testId="day-swipe-row"
        open={swipeOpen ?? false}
        onOpenChange={(next) => onSwipeOpenChange?.(next)}
        actionLabel={ja.mealPlan.todaySwipeRemove}
        /* 読み上げの名前は×とそろえる＝同じ「外す」でも、外れる範囲が違うことが耳でも分かる
           （「この献立から外す」／「今日と今週の献立から外す」） */
        actionAriaLabel={removeLabel ?? ja.mealPlan.todayRemove}
        actionTestId="day-swipe-remove"
        onAction={onSwipeRemove}
      >
        {card}
      </SwipeRevealRow>
    </li>
  )
}

/**
 * 過去振り返り(2026-07-17 便Z-2・docs/35 §3)の「作った記録」1件分の薄いカード。
 * 週タブの過去日の枠と、月タブの日モーダルの両方で使う。
 * 予定(エントリ)との視覚区別: ✓マーク+淡い表示(薄いカード)。
 * サムネは記録に添付された写真を優先し、無ければレシピ写真→アイコンにフォールバックする。
 *
 * 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）: 自前で組んでいた
 * 「32pxサムネ＋料理名＋✓」の行をやめ、共通のレシピカードの「小」に寄せた。
 * すぐ上に並ぶ**献立の枠と同じ形**になり、淡い表示（muted）で予定と記録を見分ける。
 */
function CookedLogCard({
  recipe,
  log,
  onNavigate,
  linkState,
  readOnly = false,
  onOpenDetail,
  detailAs = 'card',
}: {
  recipe: Recipe
  log: CookedLog
  onNavigate?: () => void
  /**
   * レシピ詳細へ持ち回る出所（2026-08-07 便DT-2）。週タブから開いたときだけ渡し、
   * 詳細画面の「戻る」が週タブへ帰るようにする（RecipeDetailPage の backFallback）。
   */
  linkState?: { from: string; fromPath: string }
  /**
   * レシピ詳細へのリンクにしない（2026-08-02 便DC）。サンプルデモの記録はメモリ上の見本で、
   * 端末に無いレシピを指すため、押せる見た目にすると行き止まりになる
   */
  readOnly?: boolean
  /**
   * 「作った記録」の中身の小窓を開く（2026-08-09 便EQ・オーナー実機
   * 「献立名をタップで整理された記録（記録、日付、食数など、入力した情報全て）を見られるように」）。
   */
  onOpenDetail?: () => void
  /**
   * 小窓の開き方。
   *  'card'  … カードそのものを押すと小窓が開く（月タブの日の窓）
   *  'below' … カードはレシピ詳細へのリンクのまま、すぐ下に小窓を開く1行を足す（週タブの過去日）
   */
  detailAs?: 'card' | 'below'
}) {
  const openDetailAria = ja.cookedDetail.openAria.replace('{title}', recipe.title)
  const asButton = !readOnly && onOpenDetail != null && detailAs === 'card'
  return (
    <li>
      <RecipeCard
        recipe={recipe}
        density="small"
        place="planSlot"
        muted
        photoOverride={log.photo}
        readOnly={readOnly}
        // 2026-08-09 便EQ: 料理名を押すと、その記録の中身（日付・何人分・メモ・写真）が開く
        onSelect={asButton ? onOpenDetail : undefined}
        selectAriaLabel={asButton ? openDetailAria : undefined}
        linkState={linkState}
        onNavigate={onNavigate}
        titleBadges={<CheckCircle2 size={16} className="text-accent-ink" aria-hidden />}
      />
      {/* カードの押下にレシピ詳細という別の役割があるところ（週タブの過去日）では、
          記録の中身への入口を1行足す（2026-08-09 便EQ） */}
      {!readOnly && onOpenDetail && detailAs === 'below' && (
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={openDetailAria}
          className="mt-0.5 ml-12 inline-flex items-center gap-0.5 text-xs font-bold text-accent-ink underline"
        >
          {ja.cookedDetail.openFromPlan}
          <ChevronRight size={14} aria-hidden />
        </button>
      )}
    </li>
  )
}

/**
 * 「カレンダーに出す写真」の候補1枚（2026-08-07 便DU・オーナー指示
 * 「カレンダーのサムネに使うレシピを日ごとに選べるように」）。
 * その日に写真の候補が2つ以上あるときだけ、月タブの日の窓に並べる。
 * usePhotoUrl（フック）を呼ぶため、並べる側から切り出した部品にしている。
 */
function DayCoverOption({
  title,
  photo,
  selected,
  onSelect,
}: {
  title: string
  photo: Blob
  selected: boolean
  onSelect: () => void
}) {
  const photoUrl = usePhotoUrl(photo)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={ja.mealPlan.monthDayCoverOptionAria.replace('{title}', title)}
      className={`w-20 shrink-0 rounded-sm border p-1 text-left ${
        selected ? 'border-accent bg-accent/15' : 'border-edge bg-app'
      }`}
    >
      <span className="block h-14 w-full overflow-hidden rounded-sm bg-surface">
        {photoUrl && <img src={photoUrl} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="mt-0.5 block truncate text-[10px] leading-tight text-ink-muted">
        {title}
      </span>
    </button>
  )
}

/** 日付メモの上限文字数（1行メモの想定。「外食」「実家に行く」等が十分入る長さ） */
const DAY_NOTE_MAX_LENGTH = 40

/**
 * 日付メモの入力欄（2026-07-29 便CB-1・docs/59 A-2）。
 * 週タブの各日カードと月タブの日モーダルの両方で同じものを使う。
 *
 * 保存の考え方: 「保存」ボタンを置かず、入力欄から離れた時点（blur）で保存する。
 * 週タブには7日分の入力欄が並ぶため、日ごとにボタンを増やすと画面が重くなるのと、
 * 1行メモは書いたらすぐ他へ移る使い方が自然なため。ただし黙って保存すると保存されたか
 * 分からないので、保存・削除のどちらをしたかは呼び出し側でトーストに出す。
 * Escapeキー等でblurを経ずに窓が閉じる経路でも書きかけを落とさないよう、
 * アンマウント時にも差分があれば保存する。
 */
function DayNoteEditor({
  date,
  note,
  onSave,
}: {
  /** YYYY-MM-DD */
  date: string
  /** 保存済みのメモ（無ければundefined） */
  note: DayNote | undefined
  /** 保存の実行（トーストの出し分けは呼び出し側） */
  onSave: (date: string, text: string) => void
}) {
  const saved = note?.text ?? ''
  const [draft, setDraft] = useState(saved)
  // 保存済みの内容が外から変わったら入力欄も追従する（バックアップ復元・別の窓での編集）。
  // 入力中は保存済みの値が変わらないので、打っている途中で消えることはない
  useEffect(() => setDraft(saved), [saved])
  // アンマウント時の取りこぼし保存用に、最新の値をrefへ写す（依存配列に入れて再購読させない）
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedRef = useRef(saved)
  savedRef.current = saved
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  useEffect(
    () => () => {
      if (draftRef.current.trim() !== savedRef.current) onSaveRef.current(date, draftRef.current)
    },
    [date],
  )
  const commit = () => {
    if (draft.trim() === saved) return
    onSave(date, draft)
  }
  return (
    <div>
      <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.dayNoteLabel}</p>
      <input
        type="text"
        value={draft}
        maxLength={DAY_NOTE_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enterでも確定できるようにする（フォーム送信は無いのでblurで保存経路にそろえる）。
          // 日本語入力の変換を確定しただけのEnterでは閉じない（2026-08-09 便EK・便EIと同じ判定）
          if (e.key === 'Enter' && !isImeConfirmKey(e)) e.currentTarget.blur()
        }}
        placeholder={ja.mealPlan.dayNotePlaceholder}
        aria-label={ja.mealPlan.dayNoteAria
          .replace('{m}', String(Number(date.slice(5, 7))))
          .replace('{d}', String(Number(date.slice(8, 10))))}
        className="mt-1 w-full rounded-sm border border-edge bg-app px-2 py-2 text-sm text-ink placeholder:text-ink-muted/60"
      />
    </div>
  )
}

/**
 * 献立表（2026-07-29 便CB-2・docs/59 A-4）の1枚分の中身。
 * 画面のプレビュー（.plan-sheet-preview）と、印刷用にbody直下へポータルで置く1枚
 * （.plan-sheet-print）の両方がこの同じ中身を描く。何を載せるかは純ロジック
 * logic/planSheet.ts が決めるので、画像保存（logic/planSheetImage.ts）とも内容がずれない。
 *
 * 印刷時は index.css 側で文字色を黒・背景を白に固定する（ダークテーマのまま紙に出すと
 * 白地に白文字になって読めないため）。ここでは画面用のテーマ色だけを指定する。
 */
function PlanSheetView({ sheet }: { sheet: PlanSheet }) {
  /**
   * 1行分。左から「食事のラベル／役割のラベル／本文」の3列で、ラベルは本文より小さく薄くする
   * （2026-08-02 オーナー指示: 「朝食」「主菜」が料理名と同じ大きさで数珠つなぎになっていた）。
   * 料理は1品につき1行にし、同じ食事の2品目以降はラベルの列を空けたまま料理名の位置をそろえる。
   * 画像（logic/planSheetImage.ts）も planSheetLines を通して同じ3列で描く。
   */
  const row = (key: string, label: string, role: string, body: ReactNode, note = false) => (
    <div key={key} className={`sheet-row mt-0.5 flex gap-2 pl-2 ${note ? 'text-xs' : 'text-sm'}`}>
      <span className="sheet-row-label w-16 shrink-0 pt-[3px] text-[10px] leading-tight text-ink-muted">
        {label}
      </span>
      <span className="sheet-role w-8 shrink-0 pt-[3px] text-[10px] leading-tight text-ink-muted">
        {role}
      </span>
      <span className="min-w-0 flex-1">{body}</span>
    </div>
  )
  return (
    <>
      <h3 className="sheet-title text-lg font-bold">{sheet.title}</h3>
      <p className="sheet-basis mt-0.5 text-[10px] text-ink-muted">{ja.mealPlan.planSheetBasisNote}</p>
      <ul className="mt-[var(--space-sm)] divide-y divide-edge">
        {sheet.days.map((day) => (
          <li key={day.date} className="sheet-day py-1.5">
            <p className="sheet-day-label text-sm font-bold text-accent-ink">{day.label}</p>
            {day.slots.map((slotRow) =>
              slotRow.dishes.map((dish, i) =>
                row(
                  `${slotRow.slot}-${i}`,
                  i === 0 ? slotRow.label : '',
                  ja.mealPlan.role[dish.role],
                  dish.title,
                ),
              ),
            )}
            {day.cookedTitles.map((title, i) =>
              row(`cooked-${i}`, i === 0 ? ja.mealPlan.pastCookedTitle : '', '', title),
            )}
            {day.note && row('note', ja.mealPlan.dayNoteLabel, '', day.note, true)}
          </li>
        ))}
      </ul>
      <p className="mt-[var(--space-sm)] text-[10px] text-ink-muted">
        {ja.app.name}｜{ja.app.url}
      </p>
    </>
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
/**
 * 栄養の日ごと集計で「記録と献立が同じ料理か」を突き合わせるキー（2026-08-09 便EK）。
 * 今日は記録と献立が同居しうるので、同じ料理を両方で数えないための鍵になる。
 * ごはん（便CW-10で足す1杯）はレシピIDを持たないため、専用のキーを1つ用意する。
 */
const RICE_BALANCE_MATCH_KEY = 'rice'
const balanceMatchKey = (recipeId: number | undefined): string | undefined =>
  recipeId == null ? undefined : `recipe:${recipeId}`

const formatNutrient = (key: keyof NutrientTotals, value: number): string => {
  const n = roundNutrient(key, value).toLocaleString()
  if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
  if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
  return `${n} ${ja.nutrition.gramUnit}`
}

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

/**
 * 栄養（1人分・8項目）のパネル（2026-07-28 便CAの表示をそのまま部品化）。
 * 期間を選んで見る集計カードと、2026-07-29 便CB-1・docs/59 B-3で常設にした月間サマリーの
 * 両方から使う（同じ数え方・同じ「めやす／概算」表記を1か所で守るため）。
 * 呼び出し側で「栄養が解錠されているか(isNutritionUnlocked)」と「計算できた品数>0」を判定してから使う。
 * 何を集計した数字なのかは呼び出し側の見出しが言い切るので、パネル自身は見出しを持たない
 * （2026-08-03 便DQで月タブ・便DRで期間カードの見出しへ集約した）。
 */
function IntakeNutritionPanel({
  summary,
  notes = 'full',
}: {
  summary: RangeIntakeSummary
  /**
   * 添える注記の量（2026-08-03 便DQ・規約H「長文は折りたたみ・表で構成する」）。
   * 'full'=算出方法＋概算の但し書き＋出典まで。
   * 'brief'=数と警告だけ。長い但し書きと出典は呼び出し側の折りたたみ（NutritionSourceNotes）へ移す
   */
  notes?: 'full' | 'brief'
}) {
  return (
    <div>
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
              <span className="text-sm font-bold text-accent-ink tabular-nums">
                {formatNutrient(key, summary.nutrition.total[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {(summary.actual.nutrition.dishCount > 0 && summary.plan.nutrition.dishCount > 0
          ? ja.mealPlan.rangeIntakeNutritionCountBoth
          : summary.actual.nutrition.dishCount > 0
            ? ja.mealPlan.rangeIntakeNutritionCountActual
            : ja.mealPlan.rangeIntakeNutritionCountPlan
        )
          .replace('{a}', String(summary.actual.nutrition.dishCount))
          .replace('{p}', String(summary.plan.nutrition.dishCount))}
      </p>
      {summary.nutrition.excludedDishCount > 0 && (
        <p className="mt-0.5 text-xs text-ink-muted">
          {ja.mealPlan.rangeIntakeNutritionExcluded.replace(
            '{n}',
            String(summary.nutrition.excludedDishCount),
          )}
        </p>
      )}
      {/* 量が書いてあるのに計算できなかった材料があるレシピは、合計を静かに下げる。
          既にある「除いた品数」の明示と同じ作法で件数を出す(2026-07-28 便BY/NUT-01) */}
      {summary.nutrition.partialDishCount > 0 && (
        <p className="mt-0.5 text-xs font-bold text-warning">
          {ja.mealPlan.rangeIntakeNutritionPartial.replace(
            '{n}',
            String(summary.nutrition.partialDishCount),
          )}
        </p>
      )}
      {notes === 'full' && <NutritionSourceNotes />}
    </div>
  )
}

/**
 * 栄養の数字の但し書きと出典（2026-08-03 便DQで部品化）。
 * 期間の集計カードは従来どおり数値のすぐ下に置き、月タブの栄養カードは折りたたみの中に置く
 * （オーナー指示「文字が多すぎ。ここでユーザーが見たいのは数値です」・規約H）。
 * どちらの置き場所でも文面は同じで、出典を落とすことはしない。
 */
function NutritionSourceNotes() {
  return (
    <>
      <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
        {'　'}
        {ja.nutrition.sourceCommercialNote}
      </p>
    </>
  )
}

/**
 * 食費の表の1行（2026-08-03 便DQで月タブに導入 → 便DRで期間カードと共用の部品にした）。
 * 見出しは「label＝何の数字か」「note＝数え方」の2段。meals を省く/nullにすると食数の列は空になる
 * （割り算で出した平均のように、食数を持たない行のため）。
 */
type IntakeCostRow = {
  label: string
  /** 数え方。「◯÷◯」を含む文は割り算の記号で折り返す(390px幅で「日」だけが次行に落ちないように) */
  note: string
  yen: number
  meals?: string | null
}

/**
 * 食費の表（2026-08-03 便DR）。月タブの常設カードと、期間を選んで見る集計カードで共用する。
 * オーナー指示「ここでユーザーが見たいのは数値です」(便DQ)の体裁＝項目/金額/食数の3列を1か所で守り、
 * どの行を出すかだけを呼び出し側が決める（月＝その月ぜんぶ・期間＝選んだ範囲で行の中身が違うため）。
 *
 * 2026-08-19 便HV（オーナー書き溜め⑧⑨「過去と未来に分けない表示のみでいいのでは？
 * 過去の数値が知りたい人は過去の期間のみで絞り込みするし、これからの予算が知りたい人も然り。
 * その方が表示がシンプルでわかりやすいと思う」）: 表の下段に分けていた
 * 「これから作る予定」をやめ、行は1組だけにした。金額も食数も、作った記録ぶんと
 * これから作る予定ぶんを足した1つの数字を出す（logic/rangeSummary.ts の householdYen/mealCount）。
 */
function IntakeCostTable({
  testId,
  rows,
}: {
  testId: string
  rows: IntakeCostRow[]
}) {
  const renderRow = (row: IntakeCostRow) => {
    const divided = row.note.split('÷')
    return (
      <tr key={`${row.label}-${row.note}`} className="border-b border-edge">
        <th scope="row" className="py-1.5 text-left align-top font-normal">
          <span className="block font-bold">{row.label}</span>
          <span className="block text-xs text-ink-muted">
            {divided.length === 2 ? (
              <>
                <span className="whitespace-nowrap">{divided[0]}÷</span>
                <span className="whitespace-nowrap">{divided[1]}</span>
              </>
            ) : (
              row.note
            )}
          </span>
        </th>
        <td className="py-1.5 pl-2 text-right align-top font-bold whitespace-nowrap text-accent-ink tabular-nums">
          {ja.mealPlan.intakeCostYen.replace('{n}', row.yen.toLocaleString())}
        </td>
        {row.meals != null ? (
          <td className="py-1.5 pl-2 text-right align-top whitespace-nowrap tabular-nums">
            {row.meals}
          </td>
        ) : (
          <td className="py-1.5 pl-2 text-right align-top" />
        )}
      </tr>
    )
  }
  return (
    <table
      data-testid={testId}
      className="mt-[var(--space-sm)] w-full border-collapse text-sm"
    >
      <thead>
        <tr className="border-b border-edge text-xs text-ink-muted">
          <th scope="col" className="pb-1 text-left font-normal">
            {ja.mealPlan.intakeCostColItem}
          </th>
          <th scope="col" className="pb-1 pl-2 text-right font-normal">
            {ja.mealPlan.intakeCostColYen}
          </th>
          <th scope="col" className="pb-1 pl-2 text-right font-normal">
            {ja.mealPlan.intakeCostColMeals}
          </th>
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  )
}

/**
 * 折りたたみの開閉ボタン（2026-08-03 便DR）。月タブの食費・栄養カードと期間カードで、
 * 「畳んである中身がある」ことの見え方を1か所にそろえる（規約H・長文は折りたたみへ）。
 */
function IntakeDisclosureButton({
  open,
  onToggle,
  openLabel,
  closeLabel,
}: {
  open: boolean
  onToggle: () => void
  /** 畳んでいるときに出す文言（押すと開く） */
  openLabel: string
  /** 開いているときに出す文言（押すと閉じる） */
  closeLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
    >
      {/* 「内訳を見る」⇔「内訳を閉じる」で文字数が変わってもボタンの幅は動かさない（便EO） */}
      <SwapLabel current={open ? closeLabel : openLabel} labels={[openLabel, closeLabel]} />
      {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
    </button>
  )
}

/**
 * 月タブの常設カード（食費・栄養）の見出し兼開閉ボタン（2026-08-07 便DU・オーナー指示
 * 「食費・栄養をそれぞれ折りたたみ可能に」）。
 *
 * 見出しは畳んでいても出したままにして、そこに何があるのかを畳んだ状態でも読めるようにする。
 * 「概算」バッジも見出しと一緒に常に見せる（数字を開く前に、これが概算だと分かるようにする）。
 */
/**
 * 月カード（食費・栄養）の見出し行。
 *
 * 2026-08-20 便IG・⑬（オーナー原文「◯月の食費・栄養の折りたたみで表示される数値は、
 * ◯月の食費（栄養）の横に表示して。縦長にしない。」）:
 * 畳んでいるときの数値（figure）を**この見出しの中**に置く。直す前は見出しの下に
 * 別の枠（名前を値の上に置く2段組み）で出していたため、畳んでいるのにカードが縦に伸びていた。
 *
 * 「縦長にしない」を守るための作り:
 *  ・数値は右端（ml-auto）に置き、縮まない（shrink-0）＝桁が増えても折り返さない
 *  ・見出しの文字だけが縮む（min-w-0 truncate）＝どんな桁数でも1行に収まる
 *  ・出すのは**数値だけ**で、行の名前（「全員分」「エネルギー」）は開いたときの表・パネルに任せる
 *    （390px幅では名前まで並べると1行に入らず、折り返して縦長に戻ってしまう）
 */
function MonthCardHeader({
  title,
  open,
  onToggle,
  figure,
  figureTestId,
}: {
  title: string
  open: boolean
  onToggle: () => void
  /** 畳んでいるときだけ見出しの横に出す数値（開いているときは表・パネルが出すので渡さない） */
  figure?: string
  figureTestId?: string
}) {
  return (
    <h2>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-left font-bold"
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs font-normal text-ink-muted">
          {ja.nutrition.estimateBadge}
        </span>
        {figure && (
          <span
            data-testid={figureTestId}
            className="ml-auto shrink-0 whitespace-nowrap text-sm text-accent-ink tabular-nums"
          >
            {figure}
          </span>
        )}
        <span className={`shrink-0 text-ink-muted ${figure ? '' : 'ml-auto'}`}>
          {open ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
        </span>
      </button>
    </h2>
  )
}

/**
 * 食費の折りたたみの中身（2026-08-03 便DR）。表の「1人分」を実績ぶんと予定ぶんに割った内訳と、
 * この金額に何が入っていないか（価格が分からない材料）の注記。月タブと期間カードで共用する。
 */
function IntakeCostDetails({
  summary,
  pricelessCount,
}: {
  summary: RangeIntakeSummary
  pricelessCount: number
}) {
  return (
    <div className="mt-[var(--space-sm)]">
      <p className="text-xs text-ink-muted">
        {ja.mealPlan.rangeIntakeCostBreakdown
          .replace('{a}', summary.actual.personalYen.toLocaleString())
          .replace('{an}', String(summary.actual.dishCount))
          .replace('{p}', summary.plan.personalYen.toLocaleString())
          .replace('{pn}', String(summary.plan.dishCount))}
      </p>
      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.mealPlan.weekCostNote}</p>
      {/* 価格が分からない材料の分は1円も入っていない＝この金額の信頼度を必ず添える
          (2026-07-30 便CH/C2。週の概算食費にだけ入っていた注記を揃えた) */}
      {pricelessCount > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          {ja.mealPlan.weekCostPriceless.replace('{n}', String(pricelessCount))}
        </p>
      )}
      <Link to="/prices" className="mt-1 inline-block text-xs font-bold text-accent-ink underline">
        {ja.mealPlan.weekCostNoteLink}
      </Link>
    </div>
  )
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
 *
 * 2026-07-29 便CB-1・docs/59 A-2: 日付メモのある日は右上に小さな点だけを出す(hasNote)。
 * 写真モードの主役は写真なので、文字は出さず点1つ＝写真の邪魔をしない大きさに留める。
 */
function MonthDayCell({
  date,
  dayNum,
  isToday,
  inRange,
  mode,
  nutrient,
  stat,
  showPlanDot,
  planPreview,
  isEmptyFuture,
  hasLog,
  hasNote,
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
  /** 'nutrition' のときにマスへ出す栄養の項目(2026-08-19 便HV・⑥。既定はエネルギー) */
  nutrient: keyof NutrientTotals
  /** 'nutrition'/'cost' のときに出す、その日の1人分の数字(無い日はundefined) */
  stat?: DayIntake
  showPlanDot: boolean
  /** S-1(docs/59): 今日・未来日の予定プレビュー（主菜名／無ければ「◯件」）。showPlanDotのときだけ出す */
  planPreview?: string
  /** S-2(docs/59): 予定も記録も無い未来日か（＝まだ献立を決めていない日。控えめな点線枠で可視化する） */
  isEmptyFuture: boolean
  hasLog: boolean
  /** A-2(docs/59): その日に日付メモがあるか（右上の小さな点で控えめに示す） */
  hasNote: boolean
  coverPhoto: Blob | undefined
  onClick: () => void
}) {
  const photoUrl = usePhotoUrl(coverPhoto)
  const base =
    'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-sm border text-sm'
  // メモありの印(A-2)。どの表示モード・写真の有無に関わらず同じ位置(右上)に同じ大きさの点を出す。
  // 写真の上でも沈まないよう周りに細い縁を付ける。今日のセルだけは背景がアクセント色で塗り
  // つぶされている(点が同色で消える)ため、色を反転させる
  const noteMark = (onAccentFill = false) =>
    hasNote ? (
      <span
        aria-label={ja.mealPlan.monthDayHasNote}
        className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ring-1 ${
          onAccentFill ? 'bg-on-accent ring-accent' : 'bg-accent ring-app'
        }`}
      />
    ) : null

  // 栄養／食費モード: その日の1人分の数字を主役にする(写真は敷かない=視認性優先)
  if (mode !== 'photo') {
    // 7列のセルは375px幅で約46px。「498kcal」を1行に入れると途中で切れるので、
    // 数字の下に単位だけを小さく置く(2026-08-08 便EA・オーナー「なんの栄養価かわからない」)。
    // 項目名(エネルギー/たんぱく質…)は幅に入らないので、ボタンのすぐ下の凡例と
    // 読み上げ(aria-label)が言う。
    // 2026-08-19 便HV・⑥: 出す栄養の項目を選べるようにしたので、丸め方も単位も項目から引く
    // (栄養カードの formatNutrient / 並び替えの単位とまったく同じ1か所から取る)
    const cellText = stat
      ? mode === 'nutrition'
        ? roundNutrient(nutrient, stat.nutrition[nutrient]).toLocaleString()
        : stat.yen.toLocaleString()
      : null
    const cellUnit =
      mode === 'nutrition' ? nutritionUnitFor(nutrient) : ja.mealPlan.monthCellYenUnit
    const value = stat
      ? mode === 'nutrition'
        ? formatNutrient(nutrient, stat.nutrition[nutrient])
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
    // 2026-07-30 便CH/C3: 「作った記録あり」の印は表示モードに関わらず出す。
    // 写真モードだけに出していたため、食費/栄養に切り替えると印が消え、今日のように
    // 数字が予定側で計算される日は「記録が無かったこと」になって見えていた
    const ariaLabel = `${ariaTemplate.replace('{d}', String(dayNum)).replace('{v}', value ?? '')}${
      hasLog ? ` ${ja.mealPlan.monthDayStatAriaLogged}` : ''
    }`
    return (
      <button
        type="button"
        data-date={date}
        onClick={onClick}
        aria-label={ariaLabel}
        // baseのjustify-centerとぶつからないよう、数字セルはここで独立したクラス列を組む
        className={`relative flex aspect-square flex-col items-center justify-between overflow-hidden rounded-sm border py-1 text-sm ${tone}`}
      >
        {isToday && (
          <span className="absolute inset-0 rounded-sm ring-2 ring-inset ring-accent" aria-hidden />
        )}
        {/* 作った記録の印(便CH/C3)。メモの点と同じ「小さな印」の作法で、位置だけ左上に分ける */}
        {hasLog && (
          <span aria-hidden className="absolute left-0.5 top-0.5 text-accent-ink">
            <Check size={10} strokeWidth={3} aria-hidden />
          </span>
        )}
        <span
          aria-hidden
          className={`text-[10px] leading-none ${isToday ? 'font-bold text-accent-ink' : 'text-ink-muted'}`}
        >
          {dayNum}
        </span>
        {cellText && (
          <span
            aria-hidden
            className={`flex w-full flex-col items-center px-0.5 ${
              stat?.basis === 'actual' ? 'text-accent-ink' : 'text-ink-muted'
            }`}
          >
            <span className="w-full truncate text-center text-[10px] font-bold leading-tight tabular-nums">
              {cellText}
            </span>
            <span className="text-[8px] leading-none">{cellUnit}</span>
          </span>
        )}
        {noteMark()}
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
        {noteMark()}
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
          className={`mt-0.5 ${isToday ? 'text-on-accent' : 'text-accent-ink'}`}
        >
          <Check size={10} strokeWidth={3} aria-hidden />
        </span>
      )}
      {noteMark(isToday)}
    </button>
  )
}

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

/** 「＋枠を追加」で増やした、まだレシピが割り当てられていない行（DBには保存しないUIだけの状態） */
interface ExtraRow {
  localId: string
  role: MealRole
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
  useEffect(() => {
    if (weekModeInitRef.current) return
    if (settings === undefined) return
    weekModeInitRef.current = true
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
  /**
   * 表示している週で、鍵（ロック）のボタンを出すか（2026-08-19 便IF・⑪。オーナー原文
   * 「過去の日付の１週間表示では、ロック機能使いませんよね？残しておく意味ある？」）。
   * 判断は logic/mealPlan.ts の planShowWeekLock（過ぎた日しか無い週では出さない）。
   */
  const showWeekLock = planShowWeekLock(dates, today)

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
    const done = locking
      ? (scope === 'all' ? ja.mealPlan.lockAllDone : ja.mealPlan.lockDone).replace(
          '{effect}',
          ja.mealPlan.lockEffectNote,
        )
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
   * （曜日・月替わりの前提を置かない）。並べる7日は週タブと同じ計算（weekDates）で出す。
   */
  const goToWeekOf = (date: string) => {
    const weekOfDate = weekDates(new Date(`${date}T00:00:00`))
    setWeekStart(weekOfDate[0])
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
  const monthSummaryDishCount = monthSummary.actual.dishCount + monthSummary.plan.dishCount
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
        // 「今日から7日間」表示ならその日を先頭に、週区切り表示ならその日を含む週を出す
        setWeekStart(
          settings?.weekStartsToday ? date : weekDates(new Date(`${date}T00:00:00`))[0],
        )
        // 2026-08-21 便IO: 「今日から7日間」表示の初期化（weekModeInitRef）は、あとから設定を
        // 読み終えた時点で週を今日へ寄せ直す。ここで済み扱いにしないと、日付を指定して開いた週が
        // 一瞬で今日の週に戻っていた（月タブの「この週を開く」・買い物メモからの「その日を見る」・
        // 別の週から入れたあとの戻り先が、すべて今日の週に着地していた）。
        // 下の WEEK_RETURN_PARAM の枝は同じ手当てを先にしてある
        weekModeInitRef.current = true
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
    // settings は初回描画では未取得のことがある。参照するのは「今日から7日間」表示かどうかだけで、
    // その場合も weekModeInitRef の初期化が今日を先頭に寄せるため、依存に足して再実行はさせない
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

  const [quickOnly, setQuickOnly] = useState(false)
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
    setQuickOnly(false)
    // ジャンルは**保存も消す**（画面だけ戻って保存が残る、を作らない。2026-08-22 便IY）。
    // 未設定＝3つとも選んだ状態なので、消せばそのまま「指定なし」に戻る。
    // 栄養から組む(planPurpose)は解錠済みで選んでいるときだけ消す＝未解錠の端末で
    // Proの保存値を巻き添えにしない（直す前と同じ扱い）。書き込みは1回にまとめる
    saveSettings(
      planPurpose != null
        ? { planGenres: undefined, planPurpose: undefined }
        : { planGenres: undefined },
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
    if (!quickOnly) setQuickOnly(true)
    if (minutes !== quickMinutes) saveSettings({ planQuickMinutes: minutes })
  }
  const [message, setMessage] = useState('')
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
  // ピッカーは週の枠(pickerTarget)への割り当て専用。空状態の「今日の献立を探す」は2026-07-24
  // 便BN・タスク1でレシピ一覧タブへの遷移に変更したため、旧「今日の献立ピッカー」モードは廃止した
  const pickerOpen = pickerTarget != null
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
  }

  /**
   * 「レシピ一覧から選択中」の行の食事ボタン: その料理を今日のその食事へ登録する
   * （2026-07-29 便CB-1・便CD報告の不具合修正）。
   *
   * 直った点: 以前は料理の種類を見ずに必ず「その枠の主菜」を置き換えていたため、副菜（きんぴら等）を
   * 押すと夕食の主菜（肉じゃが）が消えていた。主菜になる料理は主菜として、副菜になる料理は副菜として
   * 入れる（副菜は既存の主菜を消さない）。主菜/副菜の判定は献立エンジンと同じ isMainDish
   * （dishType優先・未設定はタグから推定）を使い、判定と書き込みは assignMealEntryByRole が担う。
   * 何が起きたか（どの役割に入ったか・すでに入っていたか）は必ずトーストで伝える。
   */
  const assignMismatchRecipe = async (slot: MealSlot, recipe: Recipe) => {
    // 日タブの「◯食に入れる」も、鍵の掛かった食事には入れない(2026-08-08 便EA)
    if (blockedByLock(today, slot, 'add')) return
    const role: MealRole = isMainDish(recipe) ? 'main' : 'side'
    const result = await assignMealEntryByRole(today, slot, recipe.id!, role)
    setMessage(
      (result === 'duplicate'
        ? ja.mealPlan.planMismatchAlready
        : ja.mealPlan.planMismatchAssigned
      )
        .replace('{slot}', ja.mealPlan.slot[slot])
        .replace('{role}', ja.mealPlan.role[role])
        .replace('{title}', recipe.title),
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
  /** トーストへ一文を足す（既存の作法どおり半角スペースでつなぐ。空文字なら足さない） */
  const withNotice = (text: string, notice: string) => (notice ? `${text} ${notice}` : text)

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
          notes: lockNotice ? [lockNotice] : [],
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
    const preserved = plan.preservedSlotKeys.size
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
    const toast = messages.join(' ')
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
    const rawPlan = planWeekFill(monthEntries ?? [], monthDatesList, visibleSlots, today, {
      keepAuto: true,
      // 鍵の掛かった食事は触らない（2026-08-08 便DX）
      lockedKeys,
      // メモを書いた日（外食・実家に帰る 等）は埋めない（2026-07-30 便CH/C10）。
      // 日付メモは「この日は献立が要らない」を表せる唯一の手段なのに一括提案が無視しており、
      // 外食の日の分まで月の食費・栄養に乗っていた
      skipDates: (monthDayNotes ?? []).map((n) => n.date),
    })
    // 一品もの（カレー・丼・麺）の主菜が残る枠は副菜を足さない＝はじめから対象に数えない
    // （2026-07-30 便CH/C1。executeFill側は元から足さないので、確認文だけが「◯食分に入れます」と
    //  多めの数を言っていた。keepAutoで自動配置の主菜も残るようになり、2回目のタップで
    //  この食い違いが必ず表に出るため、数える段階でそろえる＝規約Fの件数を実態に合わせる）
    const plan = {
      ...rawPlan,
      partialFills: rawPlan.partialFills.filter((p) => {
        if (p.fillRole !== 'side') return true
        const keptMain = (monthEntries ?? []).find(
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
    const preserved = plan.preservedSlotKeys.size
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
      title: ja.mealPlan.fillMonthConfirmTitle
        .replace('{d}', String(targetDayCount))
        .replace('{s}', String(targetSlots.length)),
      body: (preserved > 0
        ? ja.mealPlan.fillMonthConfirm
        : ja.mealPlan.fillMonthConfirmNoKept
      ).replace('{k}', String(preserved)),
      // メモを書いた日・ロック中の食事は「対象から外した」お知らせなので、補足の行に置く
      notes: [noteSkipped, lockNotice].filter((line) => line !== ''),
      confirmLabel: ja.mealPlan.fillMonthConfirmOk,
    })
    if (!ok) return
    const { added } = await executeFill(plan, monthEntries ?? [])
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
    const targetDates = templateApplyScope === 'month' ? monthDatesList : dates
    const targetEntries = templateApplyScope === 'month' ? (monthEntries ?? []) : (entries ?? [])
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
            ? ja.mealPlan.templateApplyNoRoom.replace('{n}', String(plan.keptSlotCount))
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
        .replace('{n}', String(plan.ops.length))
        .replace('{d}', String(plan.fillSlotCount)),
      body: (plan.keptSlotCount > 0
        ? ja.mealPlan.templateApplyConfirm
        : ja.mealPlan.templateApplyConfirmNoKept
      ).replace('{k}', String(plan.keptSlotCount)),
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
   * 週または月の献立を1枚に整形し、①ブラウザ印刷（index.css の @media print が .plan-sheet だけを
   * 紙に出す）②画像保存（既存のレシピ画像カードと同じCanvas機構を流用）の2通りで外に出せるようにする。
   * 冷蔵庫に貼る・家族に見せる用途で、アカウントも同期も要らない共有手段になる（docs/59 C-2の代替）。
   * 載せる中身の規則はアプリの他の画面と同じ（過ぎた日＝作った記録・今日から先＝登録した献立）＋日付メモ。
   */
  const [planSheetOpen, setPlanSheetOpen] = useState(false)
  /**
   * 献立も記録もメモも無い日を載せるか（2026-08-02 オーナー指示）。既定は載せない。
   * 夕食だけを登録している月では日付だけの行が20行以上並び、書いてある日を探しにくかったため。
   * 「1か月の抜けも一覧したい」使い方のために、チェック1つで元の見え方に戻せるようにしている
   * （この画面を離れると既定＝省くに戻る。設定として保存はしない）。
   */
  const [planSheetIncludeEmptyDays, setPlanSheetIncludeEmptyDays] = useState(false)
  // 日付→その日の「作った記録」の料理名（献立表の過去日の行に使う）
  const cookedTitlesByDate = useMemo(() => {
    const map = new Map<string, string[]>()
    // 削除済みレシピの記録も料理名として載せる(2026-08-16 便GZ)。献立表は「その日に何を作ったか」の
    // 控えなので、レシピを消したかどうかで載る・載らないが変わると控えとして使えない
    const dates = new Set([...cookedLogsByDate.keys(), ...detachedLogsByDate.keys()])
    dates.forEach((date) => {
      map.set(
        date,
        [
          ...(cookedLogsByDate.get(date) ?? []).map(({ recipe }) => recipe.title),
          ...(detachedLogsByDate.get(date) ?? []).map((entry) => entry.recipe.title),
        ],
      )
    })
    return map
  }, [cookedLogsByDate, detachedLogsByDate])
  const sheetTitleOf = useMemo(
    () => (recipeId: number) => recipeById.get(recipeId)?.title,
    [recipeById],
  )
  const weekPlanSheet = useMemo(
    () =>
      buildPlanSheet({
        title: ja.mealPlan.planSheetWeekHeading
          .replace('{start}', formatMonthDay(dates[0]))
          .replace('{end}', formatMonthDay(dates[6])),
        dates,
        today,
        visibleSlots,
        entries: entries ?? [],
        titleOf: sheetTitleOf,
        notes: new Map((weekDayNotes ?? []).map((n) => [n.date, n.text])),
        cookedTitlesByDate,
        includeEmptyDays: planSheetIncludeEmptyDays,
      }),
    [
      dates,
      today,
      visibleSlots,
      entries,
      sheetTitleOf,
      weekDayNotes,
      cookedTitlesByDate,
      planSheetIncludeEmptyDays,
    ],
  )
  const monthPlanSheet = useMemo(
    () =>
      buildPlanSheet({
        title: ja.mealPlan.planSheetMonthHeading
          .replace('{y}', monthAnchor.slice(0, 4))
          .replace('{m}', String(Number(monthAnchor.slice(5, 7)))),
        dates: monthDatesList,
        today,
        visibleSlots,
        entries: monthEntries ?? [],
        titleOf: sheetTitleOf,
        notes: new Map((monthDayNotes ?? []).map((n) => [n.date, n.text])),
        cookedTitlesByDate,
        includeEmptyDays: planSheetIncludeEmptyDays,
      }),
    [
      monthAnchor,
      monthDatesList,
      today,
      visibleSlots,
      monthEntries,
      sheetTitleOf,
      monthDayNotes,
      cookedTitlesByDate,
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
   * 献立表の折りたたみ（週タブ・月タブで同じものを使う）。開いている間だけ .plan-sheet が
   * 画面とDOMに存在し、その状態で「印刷する」を押す＝紙に出るのは必ず今見えている1枚になる。
   *
   * surfaceCls は面の見た目だけを呼び出し側から差し替えるためのもの（2026-08-03 便DP-8）。
   * 週タブは7日分のカード（面＋影）のすぐ下に並ぶので、面を塗らず枠だけにして
   * 「曜日カードがもう1枚ある」ように見えるのを避ける。月タブは従来のまま。
   */
  const renderPlanSheetSection = (sheet: PlanSheet, surfaceCls = 'bg-surface shadow-sm') => (
    <section
      className={`mt-[var(--space-md)] rounded-md border border-edge ${surfaceCls}`.trimEnd()}
    >
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
          {sheet.isEmpty ? (
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
              {ja.mealPlan.planSheetEmpty}
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
   * 画面を離れると既定に戻す＝消す側の選択を黙って覚えない。
   */
  const [fillMode, setFillMode] = useState<'fillEmpty' | 'replaceAll'>('fillEmpty')


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
  // 違和感への対応。既定閉・配置も7日分カードの下=邪魔にならない位置へ移動)
  const [weekCostOpen, setWeekCostOpen] = useState(false)

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
  const [shopRangeOpen, setShopRangeOpen] = useState(false)
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
    navigate(`/shopping?recipeIds=${param}&servings=${servingsParam}${rangeParam}`)
  }

  /**
   * 「この週の買い物リストを作る」の範囲えらび（2026-08-08 便EA）。
   * 既定は閉じていて、開かなければ従来どおり表示中の週ぜんぶから作る。
   * チップの見た目は「表示する食事」のボタン（renderSlotFilter）と同じ作法にそろえる。
   */
  const renderShopRange = () => (
    <div className="mt-[var(--space-md)] rounded-md border border-edge">
      <button
        type="button"
        data-testid="shop-range-toggle"
        onClick={() => setShopRangeOpen((v) => !v)}
        aria-expanded={shopRangeOpen}
        className="flex w-full items-center justify-between gap-2 p-[var(--space-sm)] text-left"
      >
        <span className="text-sm font-bold">{ja.mealPlan.shopRangeToggle}</span>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate text-xs text-ink-muted" data-testid="shop-range-summary">
            {shopRangeNarrowed
              ? ja.mealPlan.shopRangeSummaryPicked
                  .replace('{dates}', formatShoppingRangeDates(shopRangeDates))
                  .replace('{slots}', shopRangeSlots.map((s) => ja.mealPlan.slot[s]).join('・'))
              : ja.mealPlan.shopRangeSummaryAll}
          </span>
          {shopRangeOpen ? (
            <ChevronUp size={16} className="shrink-0 text-ink-muted" aria-hidden />
          ) : (
            <ChevronDown size={16} className="shrink-0 text-ink-muted" aria-hidden />
          )}
        </span>
      </button>
      <Collapse open={shopRangeOpen}>
        <div className="px-[var(--space-sm)] pb-[var(--space-sm)]">
          <p className="text-xs text-ink-muted">{ja.mealPlan.shopRangeNote}</p>
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
    </div>
  )

  const dowLabels = ja.mealPlan.dow

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
      <div key={key} data-testid="plan-row" data-date={date} data-slot={slot} data-role={role}>
      <div className="flex items-center gap-2">
        {/* 役割ラベルの列。入っている行では、その下に食数(何人分作るか)のボタンを重ねて置く
            (2026-08-03 便DJ・オーナー指示)。横に足すと料理名の幅を削ってしまうため縦に積む */}
        <div className="w-10 shrink-0">
          <span
            className={`block text-ink-muted ${isEmpty ? 'text-[10px]' : 'text-xs font-bold'}`}
          >
            {ja.mealPlan.role[role]}
          </span>
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
              className={`mt-0.5 block text-[10px] font-bold text-accent-ink underline ${
                locked ? 'opacity-40' : ''
              }`}
            >
              {ja.mealPlan.servingsChip.replace('{n}', String(rowServings))}
            </button>
          )}
        </div>
        {isEmpty ? (
          <button
            type="button"
            disabled={locked}
            onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
            // 2026-08-02 便DE-6(オーナー指示): 入っている行と空いている行の見分けをさらに強くする。
            // 色（面を塗る／塗らない）・文字サイズ（16px／12px）・密度（高い行／低い行）の3つで差を付ける。
            // 空き行の「押せる」見た目（破線＋Plusアイコン＋アクセント色。便BH-3タスク5）は維持し、
            // 食事ごとの地色（SLOT_TONE・便CW-1）にも手を入れない
            className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm border border-dashed border-accent/40 px-2 py-1.5 text-left text-xs font-bold text-accent-ink"
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
          <div className="min-w-0 flex-1">
            <RecipeCard
              recipe={recipe!}
              density="small"
              place="planSlot"
              muted={isCooked}
              disabled={locked}
              onSelect={() => openPicker(date, slot, role, entryId, extraLocalId)}
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
        {/* 過去日(今日より前)・作った記録のある枠はサイコロ非表示(2026-07-16 便W-⑤a: ランダム提案の
            対象外。過去/作った献立は振り返る対象であり、上書きも新規埋めもしない) */}
        {!isPastDate(date, today) && !isCooked && !locked && (
          <button
            type="button"
            onClick={() => void suggestRow(date, slot, role, entryId, extraLocalId)}
            aria-label={ja.mealPlan.suggestAria}
            className="rounded-full p-2 text-accent-ink"
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
            className={`tap-target rounded-full p-2 text-ink-muted ${locked ? 'opacity-40' : ''}`}
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
      {/* 枠に入っているレシピの詳細へ行く1行（2026-08-10 便EZ・オーナー実機
          「献立カードで選択中のレシピからレシピ詳細に移る手段がない」）。
          この枠の押下は「レシピを選び直す」に割り当ててあり(便DP-5の司令部裁定。間違えて
          記録した枠を直せなくなる方が害が大きい)、週・月のカードにはレシピ詳細への入口が
          1つも無かった＝材料や手順を見たいときに一覧から探し直すしかなかった。
          押す場所を奪わずに、記録の入口（下の「作った記録を見る」）と同じ作りで下に添える */}
      {recipe?.id != null && (
        <div className="mt-0.5 ml-12 flex flex-wrap items-center gap-x-3">
          <Link
            to={`/recipes/${recipe.id}`}
            state={logDetailLinkState}
            onClick={rememberLogDetailReturn}
            data-testid="slot-open-recipe"
            aria-label={ja.mealPlan.openRecipeAria.replace('{title}', recipe.title)}
            className="inline-flex items-center gap-0.5 text-xs font-bold text-accent-ink underline"
          >
            {ja.mealPlan.openRecipe}
            <ChevronRight size={14} aria-hidden />
          </Link>
          {/* 作った！済みで薄くなっている枠から、その記録の中身を開く1行(2026-08-09 便EQ・オーナー実機
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
              className="inline-flex items-center gap-0.5 text-xs font-bold text-accent-ink underline"
            >
              {ja.cookedDetail.openFromPlan}
              <ChevronRight size={14} aria-hidden />
            </button>
          )}
        </div>
      )}
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
        // モードを切り替えても、どの食事の枠かの見分け方が変わらないようにする
        className="rounded-md border border-l-4 p-[var(--space-sm)]"
        style={{
          background: slotLocked ? SLOT_TONE[slot].lockedBg : SLOT_TONE[slot].bg,
          borderColor: slotLocked ? 'var(--accent)' : 'var(--border)',
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
        className="rounded-md border border-l-4 p-[var(--space-sm)]"
        style={{
          // ロック中は地色を薄め、囲みをアクセント色にする(便DX・オーナー指示
          // 「鍵アイコン+わずかな面の差」)。薄くする向きなので、地色に載る補足文字の
          // コントラストは元の実測値より上がる(index.css の --slot-bg-locked-* 参照)
          background: slotLocked ? SLOT_TONE[slot].lockedBg : SLOT_TONE[slot].bg,
          borderColor: slotLocked ? 'var(--accent)' : 'var(--border)',
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
              className="rounded-sm border border-edge px-1.5 py-0.5 text-[10px] font-bold text-ink-muted"
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
            className={`ml-auto shrink-0 rounded-full p-1.5 ${
              slotLocked ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted'
            }`}
          >
            {slotLocked ? <Lock size={16} aria-hidden /> : <LockOpen size={16} aria-hidden />}
          </button>
        </div>
        <div className="mt-1 space-y-1">
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
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {MEAL_ROLES.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => {
                  addOrRestoreRow(date, slot, role)
                  setAddMenuFor(null)
                }}
                className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent-ink"
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
            className="mt-1 text-xs font-bold text-accent-ink"
          >
            {ja.mealPlan.addRow}
          </button>
        )}
      </div>
    )
  }

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
      to={settingsLinkWithBack('/settings?section=pro', location.pathname + location.search)}
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
      <button
        type="button"
        data-testid="plan-conditions-open"
        disabled={disabled}
        onClick={() => setSuggestConditionsOpen(true)}
        className={`inline-flex items-center gap-1 rounded-sm border bg-surface px-3 py-2 text-sm font-bold shadow-sm ${
          conditionsSummary ? 'border-accent text-accent-ink' : 'border-edge text-ink-muted'
        }`}
      >
        <SlidersHorizontal size={16} aria-hidden />
        {ja.mealPlan.suggestConditionsToggle}:{' '}
        {conditionsSummary || ja.mealPlan.suggestConditionsNone}
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
  ) => {
    const open = weekGroupOpen[key]
    return (
      <div
        className={`flex items-center gap-x-2 gap-y-1 ${wrap ? 'flex-wrap' : 'flex-nowrap'}`}
      >
        <button
          type="button"
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
        }}
        actionLabel={
          undoCookedActive || undoPickActive || undoRemoveActive || undoSuggestActive
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
                  : undefined
        }
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
            <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
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
            <div className="flex items-center justify-between gap-2">
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

            {/* カレンダーに出す情報の切り替え(2026-07-28 便CA・タスク2・オーナー指示)。
                既定は写真＞献立プレビュー。栄養/食費に切り替えると各セルにその日の1人分の数字が出る。
                選択は設定に記憶する(次に月タブを開いても同じ表示)。
                2026-08-07 便DU(オーナー指示): ①月タブを開いてすぐカレンダーが見えるように、
                この切り替えごとカレンダーの直前へ移した ②「説明がなく何のボタンか分からない。
                特に栄養と食費が何の数値か」への対応として、見出しを目に見える形で出し、
                選んだモードでカレンダーに何が出るのかをボタンのすぐ下に1行で添える
                (従来はカレンダーの下に、数字モードのときだけ凡例を出していた) */}
            <div className="mt-[var(--space-md)]">
              <p id="month-cell-mode-label" className="text-xs font-bold text-ink-muted">
                {ja.mealPlan.monthCellModeLabel}
              </p>
              <div role="group" aria-labelledby="month-cell-mode-label" className="mt-1 flex gap-1">
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
              {monthCellMode === 'photo' && (
                <div className="mt-[var(--space-sm)]">
                  <button
                    type="button"
                    data-testid="month-hide-recipe-photo"
                    onClick={() => saveSettings({ monthHideRecipePhoto: !monthHideRecipePhoto })}
                    aria-pressed={monthHideRecipePhoto}
                    className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                      monthHideRecipePhoto
                        ? 'border-accent bg-accent text-on-accent'
                        : 'border-edge bg-surface text-ink-muted'
                    }`}
                  >
                    {ja.mealPlan.monthHideRecipePhotoToggle}
                  </button>
                  <p className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.monthHideRecipePhotoNote}
                  </p>
                </div>
              )}
            </div>

            {/* 期間の食費と栄養モード(2026-07-17 便AB・docs/35 §5 → 2026-07-28 便CAで改訂)。
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

            {/* 期間の食費と栄養の結果カード(便AB → 2026-07-28 便CAでオーナー確定仕様に改訂
                → 2026-08-03 便DRで月タブと同じ「食費→栄養」の並び・同じ体裁に揃えた)。
                開始日・終了日の両方が選ばれたら表示。
                ①「1人が期間内に食べた分の合計」を主役にする(1食あたりの平均は出さない)
                ②過去日は作った記録・今日以降は登録した献立だけで数える(過去の予定ベース表示は廃止)
                ③オーナー指示で「作った食数の合算(全体食費)」は残す
                月タブとの違いは行の中身だけ＝この期間は範囲選択が主役なので、
                日数の分母は「選んだ◯日」で、上の月カードの表(分母=作った記録のある日数)とは別物 */}
            {costMode && rangeStart != null && rangeEnd != null && rangeSummary != null && (
              <div
                data-testid="range-result-card"
                className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
              >
                <h2 className="text-xs font-bold text-ink-muted">
                  {ja.mealPlan.rangeCostResultTitle}
                </h2>
                {/* 2026-08-08 便EA(オーナー指示「選んだ期間の文字を大きく」): いま何日ぶんを
                    見ているかがこのカードの主役なので、見出しより大きく出す */}
                <p
                  data-testid="range-selected-period"
                  className="mt-0.5 text-xl font-bold text-accent-ink"
                >
                  {ja.mealPlan.rangeCostResultRange
                    .replace('{sm}', String(Number(rangeStart.slice(5, 7))))
                    .replace('{sd}', String(Number(rangeStart.slice(8, 10))))
                    .replace('{em}', String(Number(rangeEnd.slice(5, 7))))
                    .replace('{ed}', String(Number(rangeEnd.slice(8, 10))))
                    .replace('{n}', String(rangeDays))}
                </p>
                {/* どの日をどちらの基準で数えたかを必ず明示する(混在する期間＝当月などのため) */}
                <p className="mt-0.5 text-xs text-ink-muted">{intakeBasisText(rangeSummary)}</p>

                {rangeSummary.actual.dishCount + rangeSummary.plan.dishCount === 0 ? (
                  <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                    {ja.mealPlan.rangeIntakeEmpty}
                  </p>
                ) : (
                  <>
                    {/* 食費(先に出す・月タブと同じ並び)。行は月の表と同じ「1人分／全員分」の語彙で、
                        中身だけ選んだ期間のもの。1人分＝料理1品につき1人分の金額を1回足した合計 */}
                    <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{ja.mealPlan.rangeCostSectionTitle}</h3>
                      <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
                        {ja.nutrition.estimateBadge}
                      </span>
                    </div>
                    {/* 2026-08-19 便HV・⑧: 過去と未来で行を分けない。
                        「全員分」は作った食数ぶんと作る食数ぶんを足した1つの金額 */}
                    <IntakeCostTable
                      testId="range-cost-table"
                      rows={[
                        {
                          label: ja.mealPlan.intakeCostRowPersonal,
                          note: ja.mealPlan.intakeCostRowPersonalNote,
                          yen: rangeSummary.personalYen,
                          meals: ja.mealPlan.intakeCostMeals.replace(
                            '{n}',
                            String(rangeSummary.actual.dishCount + rangeSummary.plan.dishCount),
                          ),
                        },
                        {
                          // 1つ上の「1人分」を、選んだ日数で割った値。月の表の同じ行は
                          // 「全員分÷記録か献立のある日数」なので、分母を書いて別物だと分かるようにする
                          label: ja.mealPlan.intakeCostRowPerDay,
                          note: ja.mealPlan.rangeCostRowPerDayNote.replace('{d}', String(rangeDays)),
                          yen: rangePersonalPerDay,
                          meals: null,
                        },
                        ...(rangeSummary.mealCount > 0
                          ? [
                              {
                                label: ja.mealPlan.intakeCostRowHousehold,
                                note: ja.mealPlan.intakeCostRowHouseholdNote,
                                yen: rangeSummary.householdYen,
                                meals: ja.mealPlan.intakeCostMealsTotal.replace(
                                  '{n}',
                                  String(rangeSummary.mealCount),
                                ),
                              },
                            ]
                          : []),
                      ]}
                    />
                    {/* 数字の前提(何をもとにした概算か)は月タブと同じ場所・同じ文言で出す */}
                    <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                      {ja.mealPlan.intakeCostEstimateNote}
                    </p>
                    <IntakeDisclosureButton
                      open={rangeSummaryOpen}
                      onToggle={() => setRangeSummaryOpen((v) => !v)}
                      openLabel={ja.mealPlan.intakeCostDetailsOpen}
                      closeLabel={ja.mealPlan.intakeCostDetailsClose}
                    />
                    <Collapse open={rangeSummaryOpen}>
                      <IntakeCostDetails
                        summary={rangeSummary}
                        pricelessCount={rangePricelessCount}
                      />
                    </Collapse>

                    {/* 栄養(食費のあと・月タブと同じ並び)。8項目の数値は畳まずに出し、
                        長い但し書きと出典だけを折りたたみへ回す(規約H)。
                        栄養フラグ&&Pro(isNutritionUnlocked)かつ計算できた品数>0のときだけ出す */}
                    {isNutritionUnlocked(monthUnlocked) && rangeSummary.nutrition.dishCount > 0 && (
                      <>
                        <div className="mt-[var(--space-md)] flex flex-wrap items-center gap-2">
                          <h3 className="font-bold">{ja.mealPlan.rangeNutritionSectionTitle}</h3>
                          <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
                            {ja.nutrition.estimateBadge}
                          </span>
                        </div>
                        <div className="mt-[var(--space-sm)]">
                          <IntakeNutritionPanel summary={rangeSummary} notes="brief" />
                        </div>
                        <IntakeDisclosureButton
                          open={rangeNutritionNotesOpen}
                          onToggle={() => setRangeNutritionNotesOpen((v) => !v)}
                          openLabel={ja.mealPlan.intakeNutritionNotesOpen}
                          closeLabel={ja.mealPlan.intakeNutritionNotesClose}
                        />
                        <Collapse open={rangeNutritionNotesOpen}>
                          <div className="mt-[var(--space-sm)]">
                            <NutritionSourceNotes />
                          </div>
                        </Collapse>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 月の食費(2026-08-03 便DQ・オーナー指示「食費と栄養は完全に分けて表示したい。
                文字が多すぎ。ここでユーザーが見たいのは数値です」)。
                食費と栄養を別のカードに分け、食費は表で数値を主役にする。順序は食費→栄養。
                数え方は上の「期間の食費と栄養」と同一(過ぎた日=作った記録・今日から先=登録した献立)。
                価格の但し書きと1人分の内訳はカードの中でさらに畳む。
                2026-08-07 便DU(オーナー指示): カレンダーの下へ移し、カード自体を折りたたみにした
                (既定は畳む。理由は monthCostCardOpen の宣言部) */}
            <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
              {/* 畳んでいるときに出すのは食費の合計1つだけ(2026-08-19 便HV・⑨・オーナー原文
                  「折りたたんだ時に表示する内容も、食費：全部の合計、栄養：カロリーの合計のみにし、
                  現在折りたたみでも見えている部分（と内訳と注記出典）が開いた時に出てくるだけで
                  情報は十分」)。出す金額は開いたときの表の「全員分」とまったく同じ値で、
                  1人分・1日あたりの平均・数え方の但し書き・内訳は開いたときに回す。
                  2026-08-20 便IG・⑬: その数値を見出しの横へ移した(縦に伸ばさない) */}
              <MonthCardHeader
                title={ja.mealPlan.monthCostTitle.replace(
                  '{m}',
                  String(Number(monthAnchor.slice(5, 7))),
                )}
                open={monthCostCardOpen}
                onToggle={() => setMonthCostCardOpen((v) => !v)}
                figure={
                  !monthCostCardOpen && monthSummaryDishCount > 0
                    ? ja.mealPlan.intakeCostYen.replace(
                        '{n}',
                        monthSummary.householdYen.toLocaleString(),
                      )
                    : undefined
                }
                figureTestId="month-cost-folded"
              />
              {/* 数える対象が1品も無い月は、金額の代わりに理由を1行で置く(畳んだままでも読める) */}
              {!monthCostCardOpen && monthSummaryDishCount === 0 && (
                <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.monthSummaryEmpty}</p>
              )}
              <Collapse open={monthCostCardOpen}>
                {monthSummaryDishCount === 0 ? (
                // 2026-08-08 便EA: 今日の作った記録も合計に入るようになったので、
                // 「今日の記録だけがある月」は0品にならない＝ここは本当に何も無い月だけになった
                // （従来はその場合に monthSummaryTodayOnly を出していた）
                <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.monthSummaryEmpty}</p>
              ) : (
                <>
                  {/* 行の見出し＝何の数字か、その下の小さい字＝数え方。
                      「1人分」は月ぜんぶ(過ぎた日の記録＋今日から先の献立)を1食ずつ足した合計、
                      「全員分」は作った食数・これから作る食数ぶん＝実際に出ていく食費、と
                      対象が違うので必ず書く。
                      「1日あたりの平均」は1つ上の「全員分」を、記録か献立のある日数で割った値で、
                      分母を行に書いて画面の上だけで検算できるようにする
                      (暦日数で割らない理由はrangeSummary規則4)。
                      2026-08-19 便HV・⑨: 過去と未来で行を分けない(下段の「これから作る予定」を廃止)。
                      記録も献立も無い月は、割り算の行だけを出さない(0で割らない) */}
                  <IntakeCostTable
                    testId="month-cost-table"
                    rows={[
                      {
                        label: ja.mealPlan.intakeCostRowPersonal,
                        note: ja.mealPlan.intakeCostRowPersonalNote,
                        yen: monthSummary.personalYen,
                        meals: ja.mealPlan.intakeCostMeals.replace(
                          '{n}',
                          String(monthSummaryDishCount),
                        ),
                      },
                      ...(monthSummary.mealCount > 0
                        ? [
                            {
                              label: ja.mealPlan.intakeCostRowHousehold,
                              note: ja.mealPlan.intakeCostRowHouseholdNote,
                              yen: monthSummary.householdYen,
                              meals: ja.mealPlan.intakeCostMealsTotal.replace(
                                '{n}',
                                String(monthSummary.mealCount),
                              ),
                            },
                          ]
                        : []),
                      ...(monthSummary.dayCount > 0
                        ? [
                            {
                              label: ja.mealPlan.intakeCostRowPerDay,
                              note: ja.mealPlan.monthCostRowPerDayNote.replace(
                                '{d}',
                                String(monthSummary.dayCount),
                              ),
                              yen: monthSummary.perDayYen,
                              meals: null,
                            },
                          ]
                        : []),
                    ]}
                  />
                  {/* どの日をどちらの基準で数えたかは、期間の集計カードと同じ文言で必ず出す */}
                  <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                    {intakeBasisText(monthSummary)}
                  </p>
                  {/* 数字の前提(何をもとにした概算か)も同じ場所に置く(2026-07-30 便CH/C12) */}
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {ja.mealPlan.intakeCostEstimateNote}
                  </p>
                  <IntakeDisclosureButton
                    open={monthSummaryOpen}
                    onToggle={() => setMonthSummaryOpen((v) => !v)}
                    openLabel={ja.mealPlan.intakeCostDetailsOpen}
                    closeLabel={ja.mealPlan.intakeCostDetailsClose}
                  />
                  <Collapse open={monthSummaryOpen}>
                    <IntakeCostDetails
                      summary={monthSummary}
                      pricelessCount={monthPricelessCount}
                    />
                  </Collapse>
                </>
                )}
              </Collapse>
            </section>

            {/* 月の栄養(2026-08-03 便DQで食費と分離)。8項目の数値はカードを開けば畳まずに出し、
                長い但し書きと出典だけをさらに折りたたみへ回す(規約H)。
                Pro解錠時のみ(既存のゲートと同じisNutritionUnlocked判定)。
                2026-08-07 便DU(オーナー指示): カレンダーの下へ移し、カード自体を折りたたみにした。
                2026-08-19 便HV・⑨(オーナー原文「『この月の栄養から組む』もいらない」):
                目的モードの「答え合わせ」をこのカードから外した(下の削除メモ参照) */}
            {isNutritionUnlocked(monthUnlocked) && monthSummary.nutrition.dishCount > 0 && (
                <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
                  {/* 畳んでいるときに出すのはエネルギーの合計1つだけ(2026-08-19 便HV・⑨・
                      オーナー原文「栄養：カロリーの合計のみにし」)。残る7項目・計算できた品数の
                      注記・出典は、カードを開いたときに出る。
                      2026-08-20 便IG・⑬: その数値を見出しの横へ移した(縦に伸ばさない) */}
                  <MonthCardHeader
                    title={ja.mealPlan.monthNutritionTitle.replace(
                      '{m}',
                      String(Number(monthAnchor.slice(5, 7))),
                    )}
                    open={monthNutritionCardOpen}
                    onToggle={() => setMonthNutritionCardOpen((v) => !v)}
                    figure={
                      !monthNutritionCardOpen
                        ? formatNutrient('kcal', monthSummary.nutrition.total.kcal)
                        : undefined
                    }
                    figureTestId="month-nutrition-folded"
                  />
                  <Collapse open={monthNutritionCardOpen}>
                  <>
                  {monthSummary.nutrition.dishCount > 0 && (
                    <div className="mt-[var(--space-sm)]" data-testid="month-nutrition-panel">
                      <IntakeNutritionPanel summary={monthSummary} notes="brief" />
                    </div>
                  )}

                  {/* 目的モードの「答え合わせ」(旧「この月の『栄養から組む』」・2026-08-02 便CP-2・
                      docs/62 決定②)は、2026-08-19 便HV・⑨のオーナー指示で削除した。
                      失われるのは**この月の振り返りの表示だけ**で、「栄養から組む」の機能そのもの
                      (提案が選んだ栄養に沿う組み方・献立の枠に purpose を残すこと)は変えていない。
                      集計そのもの(logic/nutritionBalance.ts の reviewPurposeDays)は他から呼ばれて
                      いないため、この画面を消せば表示は完全に無くなる(データは残る) */}
                  <IntakeDisclosureButton
                    open={monthNutritionNotesOpen}
                    onToggle={() => setMonthNutritionNotesOpen((v) => !v)}
                    openLabel={ja.mealPlan.intakeNutritionNotesOpen}
                    closeLabel={ja.mealPlan.intakeNutritionNotesClose}
                  />
                  <Collapse open={monthNutritionNotesOpen}>
                    <div className="mt-[var(--space-sm)]">
                      <NutritionSourceNotes />
                    </div>
                  </Collapse>
                  </>
                  </Collapse>
                </section>
              )}

            {/* 自動提案の条件(2026-07-30 便CH/C11)。この条件は月の「献立をまとめて提案」にも
                そのまま効く(週タブでしか変えられず、月が全部同じジャンルになる理由が
                画面から分からなかった)。週タブと同じ部品・同じ状態を共有する。
                サンプルデモには献立を書き換える操作を出さないので、その条件も出さない */}
            {!isDemo && renderSuggestConditions()}

            {/* 月タブの操作(2026-07-29 便CB-2・docs/59)。
                A-5: この月のまだ決まっていない日に、主菜と副菜をまとめて入れる（実行前に確認）
                A-1＋B-2: 保存したテンプレを、表示中の月の空いているところへ流し込む
                （曜日を絞れば「毎週金曜はカレー」になる） */}
            {!isDemo && (
              <>
                <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                  <button
                    type="button"
                    onClick={() => void fillMonth()}
                    className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    <Dices size={14} aria-hidden />
                    {ja.mealPlan.fillMonth}
                  </button>
                  <button
                    type="button"
                    onClick={() => openTemplateApply('month')}
                    className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    <LayoutTemplate size={14} aria-hidden />
                    {ja.mealPlan.templateApplyMonth}
                  </button>
                </div>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.fillMonthHint}</p>
              </>
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
                <p className="text-sm text-ink-muted">{ja.mealPlan.monthLockedDescription}</p>
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
                  to="/month-demo?back=/meal-plan"
                  data-testid="month-demo-link"
                  className="mt-[var(--space-sm)] inline-flex items-center justify-center rounded-md border border-accent bg-surface px-4 py-3 font-bold text-accent-ink shadow-sm"
                >
                  {ja.mealPlan.monthDemoLink}
                </Link>
                <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.monthDemoLinkNote}</p>
                <Link
                  to={settingsLinkWithBack('/settings?section=pro', location.pathname + location.search)}
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
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
        {renderWeekGroupHeader(
          'display',
          ja.mealPlan.weekGroupDisplayTitle,
          renderSlotFilter(),
        )}
        <Collapse open={weekGroupOpen.display}>
          <>
            {/* 週の表示起点の切替(2026-07-24 便BH-3・タスク3): 従来の週区切り⇄今日を先頭に7日間。
                既定は週区切り・選択は記憶する */}
            <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
              <button
                type="button"
                onClick={() => setWeekLayout(false)}
                aria-pressed={!rollingWeek}
                className={chipClass(!rollingWeek)}
                style={chipStyle(!rollingWeek)}
              >
                <ChipCheck on={!rollingWeek} />
                {ja.mealPlan.weekLayoutCalendar}
              </button>
              <button
                type="button"
                onClick={() => setWeekLayout(true)}
                aria-pressed={rollingWeek}
                className={chipClass(rollingWeek)}
                style={chipStyle(rollingWeek)}
              >
                <ChipCheck on={rollingWeek} />
                {ja.mealPlan.weekLayoutRolling}
              </button>
            </div>
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
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
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
                  onChange={(e) => setFillMode(e.target.value as 'fillEmpty' | 'replaceAll')}
                  className="select-control mt-1 w-full"
                >
                  <option value="fillEmpty">{ja.mealPlan.fillModeFillEmpty}</option>
                  <option value="replaceAll">{ja.mealPlan.fillModeReplaceAll}</option>
                </select>
              </label>
              {/* 押すと何が起きるかの1行（2026-08-19 便IF・④）。
                  同じことを2か所で言わない＝旧 fillWeekHint はここに畳んだ。
                  2026-08-21 便IO: 別の週から入れる道はこの節から出したので、
                  ここが言うのは「おまかせ×入れかた」の2通りだけになった */}
              <p data-testid="fill-hint" className="mt-1 text-xs text-ink-muted">
                {fillMode === 'replaceAll'
                  ? ja.mealPlan.fillModeReplaceAllHint
                  : ja.mealPlan.fillModeFillEmptyHint}
              </p>
            </div>

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
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
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
                保存したあと中身を確かめる手段が無く、直すには保存し直すしかなかった */}
            <Link
              to="/meal-templates"
              className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent-ink underline"
            >
              {ja.mealPlan.templateManageLink}
            </Link>
          </>
        </Collapse>
      </section>

      {/* 週の移動。2026-08-07 便DT-3(オーナー指示)で、画面のいちばん上から
          「すべて畳む」の上へ移した＝7日分のカードのすぐ手前に置く */}
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
            2026-08-19 便IF・⑪: 過去だけの週では出さない（判断は logic/mealPlan.ts の
            planShowWeekLock。機能そのものは消していない） */}
        {showWeekLock && (
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
        )}
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
      <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
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
           * この日を編集モードで出すか（2026-08-22 便IV）。
           * 過ぎた日は予定そのものを出さない画面なので、編集モードにも入れない
           * （切り替えボタンも出さない＝押しても何も変わらないボタンを置かない）。
           */
          const dayEditable = !isPastDate(date, today)
          const dayEditing = dayEditable && weekEditDate === date
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
            className={`scroll-mt-16 rounded-md p-[var(--space-md)] shadow-sm ${
              date === today
                ? 'border-2 border-accent bg-surface'
                : 'border border-edge bg-surface'
            }`}
          >
            {/* 2026-08-08 便DX(オーナー指示「献立日付の右」): 日付の行に日ごとのロックを置く。
                折りたたみボタンの入れ子にはできないので、見出しの行を flex にして
                「折りたたみボタン＋鍵」を横に並べる(便DT-6のグループ見出しと同じ作法) */}
            <h2 className="flex items-center gap-1 font-bold">
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
                className="flex min-w-0 flex-1 items-center justify-between gap-2 py-1 text-left"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0">
                    {dowLabels[dowIndex(date)]} {date.replaceAll('-', '/')}
                    {date === today && (
                      <span className="ml-2 text-sm text-accent-ink">{ja.mealPlan.todayBadge}</span>
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
                      <CheckCircle2 size={14} className="text-accent-ink" aria-hidden />
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
              {dayEditable && !dayCollapsed && (
                <button
                  type="button"
                  data-testid="week-day-edit"
                  data-date={date}
                  onClick={() => setWeekEditDate((prev) => planToggleDayEdit(prev, date))}
                  aria-pressed={dayEditing}
                  aria-label={(dayEditing
                    ? ja.mealPlan.weekDayEditOffAria
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
                  2026-08-19 便IF・⑪: 過去だけの週では出さない（「すべてロック」と同じ判断）。
                  今週のように過去日と未来日が混ざる週では、過ぎた日のカードにも出したまま
                  ＝同じ週の中で日によって鍵が消える／現れることをしない */}
              {showWeekLock && (
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
                /* 掛かっているときは塗りつぶし（2026-08-09 便EN。時間帯ごとの鍵と同じ作法） */
                className={`shrink-0 rounded-full p-1.5 ${
                  dayLocked ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted'
                }`}
              >
                {dayLocked ? <Lock size={18} aria-hidden /> : <LockOpen size={18} aria-hidden />}
              </button>
              )}
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
            {dayEditable && (
              <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
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
            {isPastDate(date, today) &&
              (shownLogsOf(date).length > 0 ? (
                <div className="mt-[var(--space-sm)]">
                  <p className="flex items-center gap-1 text-xs font-bold text-ink-muted">
                    <CheckCircle2 size={14} className="text-accent-ink" aria-hidden />
                    {ja.mealPlan.pastCookedTitle}
                  </p>
                  <ul className="mt-1 space-y-1">
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

      {/* この週ぜんぶをまとめて見る3つ（栄養価・概算食費・献立表の印刷）。
          2026-08-03 便DP-8(オーナー指摘「曜日カードと紛れる」): 曜日カードと同じ「白い面＋影」の
          折りたたみが同じ間隔で続いていて、7日目の下にもう1日あるように見えていた。
          ①7日分との間を1段広く空けて区切り線を引く ②3つは面を塗らず枠だけにする
          （面＋影＝日ごとのカード／枠だけ＝まとめ、と役割で見た目を分ける）。
          栄養価パネルは元から枠だけの見た目なので、残る2つをそれに揃えた */}
      <div className="mt-[var(--space-lg)] border-t border-edge pt-[var(--space-sm)]">

      {/* 週まとめ: この週の献立ぶんの栄養と野菜量(2026-07-30 便CL・docs/60 第1段)。
          各日カードと同じ部品・同じ数え方で、期間の合計だけを1人分で出す。
          めやすは「1日のめやす × 献立や記録がある日数」で並べる(週まとめ側だけ日数の注記を添える)。
          概算食費カードの隣(すぐ上)に置く: どちらも「この週ぜんぶを振り返る数字」なので同じ場所に集める */}
      {weekBalance.countedDays > 0 && (
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
          />
        </div>
      )}

      {/* 週の概算食費（2026-07-24 便BH-3・タスク4: 「まとめて献立」直後にいきなり金額が出る違和感を
          解消するため、7日分カードの下=邪魔にならない位置へ移動し、小さな折りたたみ(既定閉)にした。
          価格情報が1件も無い/何も割り当てていない(weekCost===0)ときはセクションごと非表示のまま。
          タスク8: 展開時に「◯食分」も併記する） */}
      {hasPricedRecipe && weekCost > 0 && (
        <section className="mt-[var(--space-md)] rounded-md border border-edge">
          <button
            type="button"
            onClick={() => setWeekCostOpen((v) => !v)}
            aria-expanded={weekCostOpen}
            className="flex w-full items-center justify-between gap-2 p-[var(--space-md)] text-left"
          >
            <span className="font-bold">{ja.mealPlan.weekCostTitle}</span>
            {weekCostOpen ? (
              <ChevronUp size={18} className="shrink-0 text-accent-ink" aria-hidden />
            ) : (
              <ChevronDown size={18} className="shrink-0 text-accent-ink" aria-hidden />
            )}
          </button>
          <Collapse open={weekCostOpen}>
            <div className="px-[var(--space-md)] pb-[var(--space-md)]">
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
                    to="/settings?section=budget"
                    className="mt-1 inline-block rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    {ja.mealPlan.budgetSetLink}
                  </Link>
                </div>
              )}
            </div>
          </Collapse>
        </section>
      )}

      {/* A-4 献立表(印刷・画像で保存)。この週の分を1枚にまとめる(2026-07-29 便CB-2・docs/59)。
          週タブでは面を塗らない見た目にする(便DP-8。曜日カードと紛れないため) */}
      {renderPlanSheetSection(weekPlanSheet, '')}

      </div>

      {/* この週の買い物リストを作る。2026-08-08 便EA: 日付と食事を選んでから作れるようにした
          （既定は表示中の週ぜんぶ＝従来どおり）。範囲を絞ったときはボタン名も言い換える */}
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
                    className={isSelected ? 'rounded-md bg-accent/10' : undefined}
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
              {templateApplyScope === 'month'
                ? ja.mealPlan.templateApplyRangeMonth
                    .replace('{y}', monthAnchor.slice(0, 4))
                    .replace('{m}', String(Number(monthAnchor.slice(5, 7))))
                : ja.mealPlan.templateApplyRangeWeek
                    .replace('{start}', formatMonthDay(dates[0]))
                    .replace('{end}', formatMonthDay(dates[6]))}
            </p>
            {(mealTemplates?.length ?? 0) === 0 ? (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">
                {ja.mealPlan.templateApplyNone}
              </p>
            ) : (
              <>
                <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                  {ja.mealPlan.templateApplyPick}
                </p>
                <ul className="mt-1 space-y-1">
                  {(mealTemplates ?? []).map((t) => {
                    const isSelected = selectedTemplate?.id === t.id
                    return (
                      <li key={t.id} className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedTemplateId(t.id ?? null)}
                          aria-pressed={isSelected}
                          className={`flex min-w-0 flex-1 items-center gap-2 rounded-sm border px-3 py-2 text-left text-sm font-bold ${
                            isSelected
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-edge bg-app text-ink'
                          }`}
                        >
                          <span className="min-w-0 flex-1 truncate">{t.name}</span>
                          <span
                            className={`shrink-0 text-xs font-normal ${
                              isSelected ? 'text-on-accent' : 'text-ink-muted'
                            }`}
                          >
                            {ja.mealPlan.templateItemCount.replace('{n}', String(t.items.length))}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeTemplate(t.id!, t.name, t.items.length)}
                          aria-label={ja.mealPlan.templateDelete}
                          className="shrink-0 rounded-full p-2 text-ink-muted"
                        >
                          <Trash2 size={16} aria-hidden />
                        </button>
                      </li>
                    )
                  })}
                </ul>

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
                {/* 入れる前に中身を確かめたいときの入口(2026-08-02 便DE-9) */}
                <Link
                  to="/meal-templates"
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
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{dayModalTitle}</h3>
              <button
                type="button"
                onClick={() => setDayModalDate(null)}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {dayModalIsPast ? (
              // 過去日: 予定は表示から消す(便BS・タスク2)。記録が無ければ空案内だけ出す(記録があれば下の
              // 「作った記録」ブロックが主役になる)。mealPlansデータは削除しない=非破壊。
              // 過去日は週タブと同じく編集グリッドも出さない(過ぎた日の献立は振り返る対象)
              dayModalLogs.length === 0 ? (
                <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.mealPlan.pastNoRecord}</p>
              ) : null
            ) : isDemo ? (
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
              // 入っている食事は必ず出す(月から見たときにデータが見えなくならないように)
              <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {dayModalEntries.length === 0 && (
                  <p className="text-sm text-ink-muted">{ja.mealPlan.monthDayModalEmpty}</p>
                )}
                {MEAL_SLOTS.filter(
                  (slot) => visibleSlots.includes(slot) || (dayModalBySlot.get(slot)?.length ?? 0) > 0,
                ).map((slot) => renderSlotEditor(dayModalDate, slot))}
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
                <ul className="mt-1 space-y-1">
                  {dayModalLogs.map((entry, i) => (
                    <CookedLogCard
                      key={`${entry.recipe.id ?? `d${entry.detachedRecordId}`}-${i}`}
                      recipe={entry.recipe}
                      log={entry.log}
                      readOnly={isDemo}
                      onNavigate={() => setDayModalDate(null)}
                      // 2026-08-09 便EQ(オーナー実機「月献立の作った記録から献立名をタップで
                      // 整理された記録を見たい」): 料理名を押すと記録の中身の小窓が開く
                      onOpenDetail={() => setLogDetail(entry)}
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
            {!isDemo && dayModalCoverOptions.length >= 2 && (
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
                <button
                  type="button"
                  data-testid="day-modal-close"
                  onClick={() => setDayModalDate(null)}
                  className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
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
