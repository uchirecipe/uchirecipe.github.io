import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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
  BookmarkPlus,
  LayoutTemplate,
  Printer,
  ImageDown,
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
  assignMealEntryByRole,
  clearMealSlotInRange,
} from '../db/mealPlan'
import { useDayNoteRange, saveDayNote } from '../db/dayNotes'
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
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  undoTodayListCooked,
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
  suggestCandidates,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  todayPlanMismatch,
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
  chooseBalancedPair,
  PURPOSE_REDRAW_ATTEMPTS,
} from '../logic/mealPlan'
import type { FillWeekPlan, MealGenre, ProteinSource, SuggestPairResult } from '../logic/mealPlan'
import { todayString } from '../logic/date'
import { hasNgIngredient } from '../logic/ng'
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
  reviewPurposeDays,
  riceServingRecipes,
  PURPOSE_NUTRIENT_KEY,
  RICE_SERVING_RECIPE,
  type BalanceDish,
  type BalanceRecipeLike,
  type SlotBalance,
} from '../logic/nutritionBalance'
import { canUseMonthTrial, isMonthTrialReady, MONTH_TRIAL_MIN_COOKED } from '../logic/proTrial'
import type { MonthDemoData } from '../logic/monthDemo'
import NutritionBalancePanel from '../components/NutritionBalancePanel'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
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
} from '../db/types'
import { MEAL_PURPOSES, MEAL_ROLES } from '../db/types'
import { ja } from '../i18n/ja'

/** 献立タブの3タブ構成（2026-07-16 便U-1: 現行の「今日セクション+週/月切替」をタブへ再構成） */
type MealPlanViewMode = 'day' | 'week' | 'month'

/** 目的（2026-08-02 便CP-2）の表示ラベル。数値の項目名（たんぱく質/塩分相当量）とは別物 */
const purposeLabelOf = (purpose: MealPurpose): string =>
  purpose === 'protein' ? ja.mealPlan.purposeProtein : ja.mealPlan.purposeLowSalt

/** 目的の軸になっている栄養素の表示名（月タブの答え合わせで数値に添える） */
const purposeNutrientLabelOf = (purpose: MealPurpose): string =>
  purpose === 'protein' ? ja.nutrition.proteinLabel : ja.nutrition.saltLabel

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
      {/* 2026-07-29 便CD/MP-21: 「作った」(記録が残る)と「この献立から外す」(確認なしで消える)は
          破壊度が違うのに36px・間隔8pxで密着していた。両方44px(p-3)にし、間の余白も広げて
          押し間違いを減らす(アイコンの大きさ・aria-labelは据え置き) */}
      <button
        type="button"
        onClick={onCooked}
        aria-label={ja.mealPlan.todayMarkCooked}
        className="shrink-0 rounded-full p-3 text-accent-ink"
      >
        <CheckCircle2 size={20} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ja.mealPlan.todayRemove}
        className="ml-[var(--space-sm)] shrink-0 rounded-full p-3 text-ink-muted"
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
  readOnly = false,
}: {
  recipe: Recipe
  log: CookedLog
  onNavigate?: () => void
  /**
   * レシピ詳細へのリンクにしない（2026-08-02 便DC）。サンプルデモの記録はメモリ上の見本で、
   * 端末に無いレシピを指すため、押せる見た目にすると行き止まりになる
   */
  readOnly?: boolean
}) {
  const logPhotoUrl = usePhotoUrl(log.photo)
  const recipePhotoUrl = usePhotoUrl(recipe.photo)
  const photoUrl = logPhotoUrl ?? recipePhotoUrl
  const inner = (
    <>
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
      <CheckCircle2 size={16} className="shrink-0 text-accent-ink" aria-hidden />
    </>
  )
  const cls = 'flex items-center gap-2 rounded-sm border border-edge bg-app/60 px-2 py-1.5 opacity-80'
  return (
    <li>
      {readOnly ? (
        <div className={cls}>{inner}</div>
      ) : (
        <Link to={`/recipes/${recipe.id}`} onClick={onNavigate} className={cls}>
          {inner}
        </Link>
      )}
    </li>
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
          // Enterでも確定できるようにする（フォーム送信は無いのでblurで保存経路にそろえる）
          if (e.key === 'Enter') e.currentTarget.blur()
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
const formatNutrient = (key: keyof NutrientTotals, value: number): string => {
  const n = roundNutrient(key, value).toLocaleString()
  if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
  if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
  return `${n} ${ja.nutrition.gramUnit}`
}

/**
 * 「どの日をどちらの基準で数えたか」の1行（便CA・規則2）。過去日=作った記録・今日以降=登録した献立で、
 * 混在する期間は両方の範囲を出す。期間の集計カードと月間サマリー(便CB-1・B-3)で同じ文言を使う。
 */
const intakeBasisText = (summary: RangeIntakeSummary): string =>
  summary.actual.range && summary.plan.range
    ? ja.mealPlan.rangeBasisBoth
        .replace('{ps}', formatMonthDay(summary.actual.range.start))
        .replace('{pe}', formatMonthDay(summary.actual.range.end))
        .replace('{fs}', formatMonthDay(summary.plan.range.start))
        .replace('{fe}', formatMonthDay(summary.plan.range.end))
    : summary.actual.range
      ? ja.mealPlan.rangeBasisActualOnly
      : ja.mealPlan.rangeBasisPlanOnly

/**
 * 「期間内に摂取できた栄養（1人分）」の8項目パネル（2026-07-28 便CAの表示をそのまま部品化）。
 * 期間を選んで見る集計カードと、2026-07-29 便CB-1・docs/59 B-3で常設にした月間サマリーの
 * 両方から使う（同じ数え方・同じ「めやす／概算」表記を1か所で守るため）。
 * 呼び出し側で「栄養が解錠されているか(isNutritionUnlocked)」と「計算できた品数>0」を判定してから使う。
 * 見出しだけは呼び出し側で差し替える（期間を選んで見るカードは「期間内に」、月間サマリーは「この月に」。
 * 中身の数え方は同じでも、何を集計した数字なのかは画面ごとに言い切る＝規約H）。
 */
function IntakeNutritionPanel({
  summary,
  label = ja.mealPlan.rangeIntakeNutritionLabel,
}: {
  summary: RangeIntakeSummary
  label?: string
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-bold text-ink-muted">{label}</p>
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
      <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
        {'　'}
        {ja.nutrition.sourceCommercialNote}
      </p>
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
            className={`w-full truncate px-0.5 text-center text-[10px] font-bold leading-tight tabular-nums ${
              stat?.basis === 'actual' ? 'text-accent-ink' : 'text-ink-muted'
            }`}
          >
            {cellText}
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
 */
const SLOT_TONE: Record<MealSlot, { bar: string; bg: string }> = {
  breakfast: { bar: 'var(--slot-bar-breakfast)', bg: 'var(--slot-bg-breakfast)' },
  lunch: { bar: 'var(--slot-bar-lunch)', bg: 'var(--slot-bg-lunch)' },
  dinner: { bar: 'var(--slot-bar-dinner)', bg: 'var(--slot-bg-dinner)' },
}

/**
 * 週・月の予定1行の先頭に出す小さなサムネ（2026-08-02 便CW-4・オーナー実機フィードバック:
 * 週の予定が文字だけで、どの料理か掴みにくい）。写真があれば写真・無ければ料理アイコン。
 * usePhotoUrl（フック）を呼ぶため、行の描画関数から切り出した部品にしている。
 */
function RowThumb({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    // 2026-08-02 便DE-6: 入っている行を厚く見せる（空き行との密度差）ため、少し大きくする
    <span data-testid="row-thumb" className="h-8 w-8 shrink-0 overflow-hidden rounded-sm">
      {photoUrl ? (
        <img src={photoUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <RecipePlaceholder recipe={recipe} iconSize={18} />
      )}
    </span>
  )
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
  /** サンプルデモとして開いているか（データの差し替えと、書き込み操作を出さない判定に使う） */
  const isDemo = demo != null
  const navigate = useNavigate()
  const dbRecipes = useLiveQuery(listRecipes, [])
  const recipes = isDemo ? demo.recipes : dbRecipes
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
  // 日×枠キー("date|slot")ごとの全エントリ（主菜+副菜など複数件を保持する。2026-07-13対応）。
  // 表示中の週の分だけ（先週コピーの空き枠判定など、週タブの範囲に閉じた処理で使う）
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
  const monthPersonalPerDay = Math.round(monthSummary.personalYen / monthDatesList.length)
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
        cooked: monthCookedDishes,
        planned: monthPlannedDishes,
      }),
      priceIndex,
    ).length
  }, [rangeStart, rangeEnd, today, monthCookedDishes, monthPlannedDishes, priceIndex])
  // 内訳(8項目の栄養・実績/予定の分解・作った記録の全体食費)は既定で畳んでおく。
  // 常設カードが画面上部を占領してカレンダーを押し下げないようにするため(数字自体は畳んでも見える)
  const [monthSummaryOpen, setMonthSummaryOpen] = useState(false)

  /**
   * 月タブの「答え合わせ」（2026-08-02 便CP-2・docs/62 決定②）。
   * 目的を指定して組んだ日が、この月に何日あったか＝献立エントリに残した purpose から数える。
   * 同じ日に複数の目的が混ざることは通常ないが、混ざったら最後に入った枠の目的を採る
   * （日単位の事実表示なので1日1つに決める。どちらでも「その日は目的から組んだ」ことに変わりはない）。
   */
  const monthPurposeByDate = useMemo(() => {
    const map = new Map<string, MealPurpose>()
    monthEntries?.forEach((e) => {
      if (e.purpose) map.set(e.date, e.purpose)
    })
    return map
  }, [monthEntries])
  // 日ごとの合計は週タブと同じ dayBalanceMap（過去日=作った記録・今日以降=登録した献立）で出す
  const monthBalanceCooked = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    const prefix = monthAnchor.slice(0, 7)
    cookedLogsByDate.forEach((logs, date) => {
      if (!date.startsWith(prefix)) return
      logs.forEach(({ recipe }) => list.push({ date, recipe }))
    })
    return list
  }, [cookedLogsByDate, monthAnchor])
  const monthBalancePlanned = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    monthEntries?.forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (recipe) list.push({ date: e.date, recipe })
    })
    return list
  }, [monthEntries, recipeById])
  const monthPurposeReviews = useMemo(() => {
    if (monthPurposeByDate.size === 0) return []
    const byDate = dayBalanceMap({
      dates: monthDatesList,
      today,
      cooked: monthBalanceCooked,
      planned: monthBalancePlanned,
    })
    return reviewPurposeDays(byDate.values(), monthPurposeByDate)
  }, [monthPurposeByDate, monthDatesList, today, monthBalanceCooked, monthBalancePlanned])

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
  /**
   * 週タブを開いたあとにスクロールして見せる日（2026-08-02 便DE-1/DE-11）。
   * ?focus=week&date=YYYY-MM-DD で開いたときだけ入り、その日のカードまで送ってから空にする。
   */
  const [pendingScrollDate, setPendingScrollDate] = useState<string | null>(null)
  useEffect(() => {
    if (initialFocusRef.current) return
    initialFocusRef.current = true
    const focus = searchParams.get('focus')
    if (focus == null) return
    // 2026-08-02 便DE-1/DE-11: 開くタブを指定して戻ってこられるようにした。
    //  today … 今日の献立(日タブ)へ。従来からの動き
    //  week  … 週タブへ。date が付いていればその日のカードまでスクロールする
    //          (ホームの「今日の献立」の食事ごとの見出しから来る)
    //  month … 月タブへ(「作った記録」の一覧から月タブへ戻るときに使う)
    if (focus === 'today') {
      setViewMode('day')
      window.scrollTo(0, 0)
    } else if (focus === 'week') {
      const date = searchParams.get('date')
      if (date) {
        // 「今日から7日間」表示ならその日を先頭に、週区切り表示ならその日を含む週を出す
        setWeekStart(
          settings?.weekStartsToday ? date : weekDates(new Date(`${date}T00:00:00`))[0],
        )
        setPendingScrollDate(date)
      }
      setViewMode('week')
    } else if (focus === 'month') {
      setViewMode('month')
      window.scrollTo(0, 0)
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('focus')
        next.delete('date')
        return next
      },
      { replace: true },
    )
    // settings は初回描画では未取得のことがある。参照するのは「今日から7日間」表示かどうかだけで、
    // その場合も weekModeInitRef の初期化が今日を先頭に寄せるため、依存に足して再実行はさせない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])

  // 指定された日のカードまでスクロールする（週タブに切り替わり、7日分が描かれたあとに1回だけ）
  useEffect(() => {
    if (pendingScrollDate == null || viewMode !== 'week') return
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document
          .querySelector(`section[data-date="${pendingScrollDate}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setPendingScrollDate(null)
      }),
    )
    return () => cancelAnimationFrame(frame)
  }, [pendingScrollDate, viewMode])

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
      await importRecipeIdsToTodayList(todayFromPlanIds)
      await updateSettings({ lastAutoImportDate: today })
    })()
  }, [isDemo, viewMode, settings, todayEntries, todayFromPlanIds, today])

  const [quickOnly, setQuickOnly] = useState(false)
  // 自動提案の条件UI(2026-07-13追加): ジャンル優先(指定なしも含め単一選択)・高たんぱく優先
  const [genreFilter, setGenreFilter] = useState<MealGenre | undefined>(undefined)
  const [preferHighProtein, setPreferHighProtein] = useState(false)
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
  // 提案条件6ボタンの折りたたみ(2026-07-16 UI総点検A-3)。既定閉
  const [suggestConditionsOpen, setSuggestConditionsOpen] = useState(false)
  const [message, setMessage] = useState('')
  /**
   * 直前の「作った」を戻すための控え（2026-08-02 便DE-3）。トーストに「元に戻す」を出すのは、
   * いま出ているトーストがその記録のものであるときだけにしたいので、対象のレシピと
   * 一緒にそのときの文言も持っておく（別の操作でトーストが差し替わったら操作ごと消える）。
   */
  const [undoCooked, setUndoCooked] = useState<{ recipeId: number; message: string } | null>(null)
  const undoCookedActive = undoCooked != null && undoCooked.message === message
  const runUndoCooked = async () => {
    if (!undoCooked) return
    const done = await undoTodayListCooked(undoCooked.recipeId)
    setUndoCooked(null)
    if (!done) {
      setMessage(ja.mealPlan.todayCookedUndoNothing)
      return
    }
    // 在庫を1段階下げる設定がONのときは、戻していないものを黙らずに添える
    setMessage(
      settings?.cookedReflectPantry
        ? `${ja.mealPlan.todayCookedUndone} ${ja.mealPlan.todayCookedUndoPantryNote}`
        : ja.mealPlan.todayCookedUndone,
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
  const handleSaveDayNote = async (date: string, text: string) => {
    const result = await saveDayNote(date, text)
    setMessage(result === 'removed' ? ja.mealPlan.dayNoteRemoved : ja.mealPlan.dayNoteSaved)
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
  // (2026-07-29 便CB-1・A-3: 月タブの日モーダルから開いた行も対象にするため、週+月の合算から引く)
  const currentPickerRecipeId = useMemo(() => {
    if (pickerTarget?.entryId == null) return undefined
    return allPlanEntries.find((e) => e.id === pickerTarget.entryId)?.recipeId
  }, [pickerTarget, allPlanEntries])
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
  const drawPair = (options: Parameters<typeof suggestPairForSlot>[1]): SuggestPairResult => {
    const draw = () => suggestPairForSlot(visibleRecipes, options)
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
   * 「おまかせで提案」がいまくじを引いている候補の数（2026-08-02 便DE-5・オーナー指示）。
   * 候補が2品しかない条件では、振り直しても同じ料理が出続けて壊れているように見えるため、
   * 数字を画面に出して理由が分かるようにする。数えるのは主菜の候補
   * （ペア提案は主菜を引いてから、その主菜に合わせて副菜を引くので、変わり映えの元は主菜側）。
   */
  const suggestCandidateCount = useMemo(() => {
    const slot: MealSlot = visibleSlots.includes('dinner') ? 'dinner' : visibleSlots[0] ?? 'dinner'
    return suggestCandidates(visibleRecipes, {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds: [],
      slot,
      genre: genreFilter,
      preferHighProtein,
      yesterdayRecipeIds,
      role: 'main',
    }).length
  }, [
    visibleRecipes,
    quickOnly,
    settings?.ngIngredients,
    visibleSlots,
    genreFilter,
    preferHighProtein,
    yesterdayRecipeIds,
  ])

  // 主菜+副菜のペアを1組計算する(タスク1/2共用)。提案元の枠は「表示中の食事帯に夕食があれば
  // 夕食、無ければ先頭の帯」を使う。excludeIdsに渡したレシピは候補から外す(振り直しで直前の提案を
  // 避けるために使う)。候補が0件のときはundefinedを返す
  const computeSuggestionIds = (excludeIds: number[]): number[] | undefined => {
    if (!recipes) return undefined
    const slot: MealSlot = visibleSlots.includes('dinner') ? 'dinner' : visibleSlots[0] ?? 'dinner'
    // 「おまかせで提案」も目的モードの引き直しを通す（docs/62 決定②のオーナー指示）
    const { main, side } = drawPair({
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

  /**
   * 「今日の献立と今週の予定が食い違っています」の食事ボタン: その料理を今日のその食事へ登録する
   * （2026-07-29 便CB-1・便CD報告の不具合修正）。
   *
   * 直った点: 以前は料理の種類を見ずに必ず「その枠の主菜」を置き換えていたため、副菜（きんぴら等）を
   * 押すと夕食の主菜（肉じゃが）が消えていた。主菜になる料理は主菜として、副菜になる料理は副菜として
   * 入れる（副菜は既存の主菜を消さない）。主菜/副菜の判定は献立エンジンと同じ isMainDish
   * （dishType優先・未設定はタグから推定）を使い、判定と書き込みは assignMealEntryByRole が担う。
   * 何が起きたか（どの役割に入ったか・すでに入っていたか）は必ずトーストで伝える。
   */
  const assignMismatchRecipe = async (slot: MealSlot, recipe: Recipe) => {
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
    if (entryId != null) {
      showDefaultRow(date, slot, role)
      await removeMealEntry(entryId)
    } else if (extraLocalId) {
      removeExtraRowState(date, slot, extraLocalId)
    } else {
      hideDefaultRow(date, slot, role)
    }
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
    setMessage('')
    const slotEntries = entriesByDateSlotAll.get(`${date}|${slot}`) ?? []
    const isSlotEmpty = slotEntries.length === 0
    const scopeEntries = viewMode === 'month' ? (monthEntries ?? []) : (entries ?? [])
    const usedRecipeIds = scopeEntries.filter((e) => e.id !== entryId).map((e) => e.recipeId)
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
    // 枠が丸ごと空のときのペア提案は主菜・副菜の行から押したときだけ（2026-08-02 便DE-4）。
    // 汁物・その他の行のサイコロで主菜＋副菜が生えると、押した行と結果が食い違う
    if (isSlotEmpty && entryId == null && (role === 'main' || role === 'side')) {
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
  ): Promise<number> => {
    // 埋め直す役割に残っている自動提案由来の行だけを削除(手動配置は plan で除外済み＝残る)
    for (const id of plan.autoEntryIdsToRemove) {
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
        await addMealEntry(date, slot, main.id!, 'main', true, planPurpose)
        usedRecipeIds.push(main.id!)
        bumpProtein(main)
        added++
      }
      if (side) {
        await addMealEntry(date, slot, side.id!, 'side', true, planPurpose)
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
            !(e.id != null && plan.autoEntryIdsToRemove.includes(e.id)),
        )
        const mainRecipe = existingMain ? recipeById.get(existingMain.recipeId) : undefined
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

    return added
  }

  /**
   * 週の表示中の食事帯を、自動提案でまとめて埋める（結果メッセージ・今日の枠へのスクロールまで）。
   * 埋め方そのものは executeFill が担う（便CB-2で月タブの一括提案と共通化した）。
   */
  const fillWeek = async () => {
    if (!recipes) return
    setMessage('')
    // レシピが1件も無いときは無反応にしない(2026-07-29 便CD/MP-20)。
    // 「おまかせで提案」も行のサイコロも同じ案内を出すのに、ここだけ何も起きなかった
    if (visibleRecipes.length === 0) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    const plan = planWeekFill(entries ?? [], dates, visibleSlots, today)
    const added = await executeFill(plan, entries ?? [])

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
            !(e.id != null && rawPlan.autoEntryIdsToRemove.includes(e.id)),
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
    // トーストは既存の作法どおり半角スペースでつなぐ（確認文は文中に差し込むので noteSkipped をそのまま使う）
    const withNoteSkipped = (text: string) => (noteSkipped ? `${text} ${noteSkipped}` : text)
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
    const confirmText = (
      preserved > 0 ? ja.mealPlan.fillMonthConfirm : ja.mealPlan.fillMonthConfirmNoKept
    )
      .replace('{d}', String(targetDayCount))
      .replace('{s}', String(targetSlots.length))
      .replace('{k}', String(preserved))
      .replace('{note}', noteSkipped)
    if (!window.confirm(confirmText)) return
    const added = await executeFill(plan, monthEntries ?? [])
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
    })
    if (plan.ops.length === 0) {
      // 入らなかった理由を3つに言い分ける(2026-07-30 便CH/C14で「表示していない食事」を追加)。
      // 従来は表示していない食事のテンプレを流し込むと「選んだ曜日には、このテンプレの献立が
      // ありません」と出ていたが、同じ窓の曜日チップには「木 1品」と出ており矛盾していた
      setMessage(
        plan.keptSlotCount > 0
          ? ja.mealPlan.templateApplyNoRoom.replace('{n}', String(plan.keptSlotCount))
          : plan.hiddenSlots.length > 0
            ? ja.mealPlan.templateApplyHiddenSlots.replaceAll(
                '{slots}',
                plan.hiddenSlots.map((s) => ja.mealPlan.slot[s]).join('・'),
              )
            : ja.mealPlan.templateApplyNoItems,
      )
      return
    }
    // 規約F: 何品がどこに入るかと、何が消えないかを件数つきで両方書く
    const confirmText = (
      plan.keptSlotCount > 0
        ? ja.mealPlan.templateApplyConfirm
        : ja.mealPlan.templateApplyConfirmNoKept
    )
      .replace('{name}', template.name)
      .replace('{n}', String(plan.ops.length))
      .replace('{d}', String(plan.fillSlotCount))
      .replace('{k}', String(plan.keptSlotCount))
    if (!window.confirm(confirmText)) return
    // auto=false(既定)で追加＝手動配置として保護される（ユーザーが意図して入れた献立のため）
    for (const op of plan.ops) {
      await addMealEntry(op.date, op.slot, op.recipeId, op.role)
    }
    setTemplateApplyScope(null)
    setMessage(
      ja.mealPlan.templateApplyDone
        .replace('{name}', template.name)
        .replace('{n}', String(plan.ops.length)),
    )
  }
  const removeTemplate = async (id: number, name: string, itemCount: number) => {
    if (
      !window.confirm(
        ja.mealPlan.templateDeleteConfirm.replace('{name}', name).replace('{n}', String(itemCount)),
      )
    )
      return
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
    cookedLogsByDate.forEach((list, date) => {
      map.set(
        date,
        list.map(({ recipe }) => recipe.title),
      )
    })
    return map
  }, [cookedLogsByDate])
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
      {planSheetOpen && (
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
              <div className="mt-[var(--space-sm)] max-h-[60vh] overflow-y-auto">
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
      )}
    </section>
  )

  // 週タブ「この帯の今週分を空にする」(便U-4 Fable設計: 「朝のみ削除したい」への回答)。
  // 帯を1つ選び、確認ダイアログを経てから、表示中の週(dates[0]〜dates[6]。週タブで
  // 前後移動している場合はその週)のうちその帯のエントリだけをまとめて削除する。
  // 概算食費(weekCostEstimate)は表示帯(visibleSlots)では絞らず「登録されている献立全部」を
  // 集計する仕様のままなので、この削除は自動的に金額へ反映される。
  // ただし過去日は集計から外している(2026-07-29 便CD/MP-07。表示から消えている予定が
  // 金額に入っていると何を消せば減るのか辿れないため)
  const [clearSlotTarget, setClearSlotTarget] = useState<MealSlot>('dinner')
  // 2026-08-02 便CW-3: 既定閉の折りたたみ(週タブのいちばん下)。普段は目に入らない位置に置く
  const [clearWeekSlotOpen, setClearWeekSlotOpen] = useState(false)
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
    const keys = new Set<string>()
    if (!includeRice) return keys
    const bySlotKey = new Map<string, MealPlanEntry[]>()
    ;(entries ?? []).forEach((e) => {
      const key = `${e.date}|${e.slot}`
      const list = bySlotKey.get(key)
      if (list) list.push(e)
      else bySlotKey.set(key, [e])
    })
    bySlotKey.forEach((slotEntries, key) => {
      const mainRecipe = slotEntries
        .filter((e) => (e.role ?? 'main') === 'main')
        .map((e) => recipeById.get(e.recipeId))
        .find((r): r is Recipe => !!r)
      // 一品もの(丼・麺・カレー・鍋)が主菜の食事は、主食が重なるので足さない
      if (mainRecipe && isOneDish(mainRecipe)) return
      keys.add(key)
    })
    return keys
  }, [includeRice, entries, recipeById])
  /** 日付→その日に足すごはんの杯数 */
  const ricePlanServingsByDate = useMemo(() => {
    const counts = new Map<string, number>()
    riceSlotKeys.forEach((key) => {
      const date = key.split('|')[0]
      counts.set(date, (counts.get(date) ?? 0) + 1)
    })
    return counts
  }, [riceSlotKeys])
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
  // (2026-07-29 便CD/MP-07)。過ぎた分の実績は月タブの「期間の栄養と食費」が担当する
  const weekCostEstimate = useMemo(
    () => sumMealPlanEntriesCost(activeEntries, recipeById, priceIndex),
    [activeEntries, recipeById, priceIndex],
  )
  /** ごはん1杯ぶんの金額(食材価格マスタから引く。マスタに価格が無ければ0円=足さない) */
  const riceYen = useMemo(
    () => estimateRecipeCost(RICE_SERVING_RECIPE.ingredients, priceIndex).total,
    [priceIndex],
  )
  /**
   * 週の概算食費に足すごはんの杯数。金額の集計範囲(activeEntries=今日以降)に合わせて数える
   * ＝画面に出ている予定と金額が一致する(2026-07-29 便CD/MP-07と同じ考え方)。
   */
  const riceCostServings = useMemo(() => {
    if (!includeRice) return 0
    let total = 0
    ricePlanServingsByDate.forEach((n, date) => {
      if (!isPastDate(date, today)) total += n
    })
    return total
  }, [includeRice, ricePlanServingsByDate, today])
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
   * 数える基準は便CA以降の統一規則: **過去日=作った記録・今日以降=登録した献立**
   * (rangeSummaryのdayIntakeMap・月カレンダーのセル表示と同じ。1日を両方で数えない)。
   * 食費(weekCostEstimate)は「これから作る予定」だけを対象にするので activeEntries を見るが、
   * こちらは過去日も対象に含める: 週タブの過去日には「作った記録」カードが出ているので、
   * その日の数字がどこから来たのか画面から辿れる。
   * 食事帯(visibleSlots)では絞らない(1日の合計は、その日に登録されている献立ぜんぶで数える)。
   */
  const weekBalanceCooked = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    dates.forEach((date) => {
      cookedLogsByDate.get(date)?.forEach(({ recipe }) => list.push({ date, recipe }))
      // 「ごはんを含めて計算する」がONのときだけ、その日のごはんを1品として足す(便CW-10)
      riceServingRecipes(riceActualServingsByDate.get(date) ?? 0).forEach((recipe) =>
        list.push({ date, recipe }),
      )
    })
    return list
  }, [dates, cookedLogsByDate, riceActualServingsByDate])
  const weekBalancePlanned = useMemo<BalanceDish[]>(() => {
    const list: BalanceDish[] = []
    ;(entries ?? []).forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (recipe) list.push({ date: e.date, recipe })
    })
    ricePlanServingsByDate.forEach((n, date) => {
      riceServingRecipes(n).forEach((recipe) => list.push({ date, recipe }))
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
   * 過ぎた日(basis='actual'の日)には出さない。2つ以上の食事に献立がある日だけMapに入れる
   * （1食だけの日は1日の合計と同じ数字がもう一度並ぶだけになるため）。
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
      if (weekBalanceByDate.get(date)?.basis !== 'plan') return
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
    const isCooked = entryId != null && cookedPlanEntryIdSet.has(entryId)
    return (
      <div key={key} className="flex items-center gap-2">
        <span
          className={`w-10 shrink-0 text-ink-muted ${
            isEmpty ? 'text-[10px]' : 'text-xs font-bold'
          }`}
        >
          {ja.mealPlan.role[role]}
        </span>
        <button
          type="button"
          onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
          // 2026-08-02 便DE-6(オーナー指示): 入っている行と空いている行の見分けをさらに強くする。
          // 色（面を塗る／塗らない）・文字サイズ（16px／12px）・密度（高い行／低い行）の3つで差を付ける。
          // 空き行の「押せる」見た目（破線＋Plusアイコン＋アクセント色。便BH-3タスク5）は維持し、
          // 食事ごとの地色（SLOT_TONE・便CW-1）にも手を入れない
          className={`flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm border px-2 text-left ${
            isEmpty
              ? 'border-dashed border-accent/40 py-1.5 text-xs font-bold text-accent-ink'
              : isCooked
                ? // タスク2: 作った見た目(記録カードに合わせて淡い表示＋✓)
                  'border-edge bg-app/60 py-2.5 text-base font-bold text-ink-muted opacity-80'
                : 'border-edge bg-surface py-2.5 text-base font-bold text-ink shadow-sm'
          }`}
        >
          {isEmpty ? (
            <>
              <Plus size={16} className="shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{ja.mealPlan.emptyAssign}</span>
            </>
          ) : (
            <>
              {/* 2026-08-02 便CW-4: 文字だけの行に小さなサムネ(写真か料理アイコン)を足す */}
              <RowThumb recipe={recipe!} />
              {isCooked && (
                <CheckCircle2 size={14} className="shrink-0 text-accent-ink" aria-hidden />
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
            className="rounded-full p-2 text-ink-muted"
          >
            <X size={18} aria-hidden />
          </button>
        )}
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
    return (
      // 2026-08-02 便CW-1: 朝食/昼食/夕食を1日のカードの中で見分けられるように、
      // 食事ごとに囲みを付け、左の帯と地色をトークンで段階的に変える(SLOT_TONE)
      <div
        key={slot}
        data-testid="slot-block"
        data-slot={slot}
        className="rounded-md border border-l-4 p-[var(--space-sm)]"
        style={{
          background: SLOT_TONE[slot].bg,
          borderColor: 'var(--border)',
          borderLeftColor: SLOT_TONE[slot].bar,
        }}
      >
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
          {roleRows.map(([role, rows]) =>
            rows.map((row, i) =>
              renderRow(
                date,
                slot,
                role,
                row,
                `${role}-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`,
              ),
            ),
          )}
        </div>
        {showOneDishNote && <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.oneDishNote}</p>}
        {isAddMenuOpen ? (
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
    quickOnly ? ja.mealPlan.quickOnlySummary : undefined,
    genreFilter,
    preferHighProtein ? ja.mealPlan.preferHighProteinToggle : undefined,
    // 目的は「まとめて献立」の結果を最も大きく変える条件なので、畳んだラベルにも必ず出す
    planPurpose ? purposeLabelOf(planPurpose) : undefined,
  ]
  const conditionsSummary = activeConditionSummaries.filter((v): v is string => Boolean(v)).join('・')

  /**
   * 自動提案の条件（時短優先・ジャンル・高たんぱく優先）の折りたたみ。
   * 2026-07-30 便CH/C11: 週タブの中にしか無かったが、この3つの条件は月タブの
   * 「未定の日をまとめて提案」にも100%効いている（executeFillが同じ値を読む）。
   * 月から条件が見えず変えられないため、「なぜ月が全部中華になったのか」が画面から分からなかった。
   * 同じ部品を週・月の両方で出す＝どちらから見ても今の条件が分かり、その場で変えられる。
   */
  const renderSuggestConditions = () => (
    <div className="mt-[var(--space-sm)]">
      <button
        type="button"
        onClick={() => setSuggestConditionsOpen((v) => !v)}
        aria-expanded={suggestConditionsOpen}
        className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
      >
        {ja.mealPlan.suggestConditionsToggle}
        {!suggestConditionsOpen && conditionsSummary ? `: ${conditionsSummary}` : ''}
        {suggestConditionsOpen ? (
          <ChevronUp size={16} aria-hidden />
        ) : (
          <ChevronDown size={16} aria-hidden />
        )}
      </button>

      {suggestConditionsOpen && (
        <>
        <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => setQuickOnly((v) => !v)}
            aria-pressed={quickOnly}
            className={`rounded-sm border px-3 py-2 text-sm font-bold ${
              quickOnly
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
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
        {/* 2026-08-02 便DE-7: 「調理時間15分以内を優先」が何を見ているか(全レシピの調理時間)と、
            自分で登録したレシピも対象になる条件を1行で添える */}
        <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.quickOnlyHint}</p>
        </>
      )}

      {/* 目的（2026-08-02 便CP-2・docs/62 決定②。Pro機能）。
          解錠済み: 3択で選ぶ（他の条件と同じく折りたたみの中）。
          未解錠: 控えめな鍵付き1行を**折りたたみの外に常設**し、押すとPro案内へ行く
          （docs/62「売り場を変える」＝設定の奥ではなく無料の献立画面に入口を置く。
          既定で閉じている折りたたみの中に入れると、結局その入口は誰にも見えない）。
          押し売りはしない＝1行の控えめな鍵付き行にとどめる（規約H） */}
      {isPro ? (
        suggestConditionsOpen && (
          <div className="mt-[var(--space-md)]" data-testid="purpose-picker">
            <p className="flex items-center gap-1 text-sm font-bold text-ink-muted">
              {ja.mealPlan.purposeLabel}
              <span className="rounded-full border border-accent px-2 py-0.5 text-xs text-accent-ink">
                {ja.mealPlan.purposeProTag}
              </span>
            </p>
            <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
              <button
                type="button"
                onClick={() => void changePurpose(undefined)}
                aria-pressed={planPurpose === undefined}
                className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                  planPurpose === undefined
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                {ja.mealPlan.purposeNone}
              </button>
              {MEAL_PURPOSES.map((purpose) => (
                <button
                  key={purpose}
                  type="button"
                  onClick={() => void changePurpose(purpose)}
                  aria-pressed={planPurpose === purpose}
                  className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                    planPurpose === purpose
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {purposeLabelOf(purpose)}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.purposeHint}</p>
          </div>
        )
      ) : (
        <Link
          to="/settings?section=pro"
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
      )}
    </div>
  )

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

  // 重ね窓はEscapeキーと端末の「戻る」で1枚ずつ閉じる(2026-07-30 便CH/C13)。
  // 日モーダルはEscapeだけ対応済みだったので戻るにも広げ、便CB-1/CB-2で増えた
  // ピッカー・テンプレの窓（どちらも未対応で、戻るとレシピ一覧へ離脱していた）も同じ作法に揃える
  useOverlayDismiss(dayModalDate != null, () => setDayModalDate(null))
  useOverlayDismiss(pickerOpen, () => closePicker())
  useOverlayDismiss(templateSaveOpen, () => setTemplateSaveOpen(false))
  useOverlayDismiss(templateApplyScope != null, () => setTemplateApplyScope(null))

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 日／週／月の3タブ(便U-1)。サンプルデモは月の画面だけを見せるので出さない */}
      {!isDemo && (
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
      )}

      {/* 「作った」の直後だけ「元に戻す」を添える(2026-08-02 便DE-3。買い物メモ・食材価格と同じ形) */}
      <Toast
        message={message}
        onClose={() => {
          setMessage('')
          setUndoCooked(null)
        }}
        actionLabel={undoCookedActive ? ja.common.undo : undefined}
        onAction={undoCookedActive ? () => void runUndoCooked() : undefined}
      />

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
                        void (async () => {
                          await markTodayListCooked(recipe.id!)
                          // 2026-07-16 UI総点検A-4: 行が消えるだけの無言完了だったのでトーストで明示。
                          // 2026-08-02 便DE-3: そのトーストから「元に戻す」で取り消せるようにする
                          setMessage(ja.mealPlan.todayCookedToast)
                          setUndoCooked({
                            recipeId: recipe.id!,
                            message: ja.mealPlan.todayCookedToast,
                          })
                        })()
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
                    className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                  >
                    <Dices size={18} aria-hidden />
                    {ja.mealPlan.todayReroll}
                  </button>
                )}
                {/* いま候補が何品あるか(2026-08-02 便DE-5)。少ない条件では振り直しても
                    同じ料理が出続けるので、その理由が数字で分かるようにする */}
                {lastSuggestedIds.length > 0 && (
                  <p className="mt-1 text-center text-xs text-ink-muted">
                    {ja.common.candidateCount.replace('{n}', String(suggestCandidateCount))}
                  </p>
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
                    <Route size={20} className="shrink-0 text-accent-ink" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-accent-ink">{ja.mealPlan.cookNaviEntry}</span>
                      <span className="block text-xs text-ink-muted">{ja.mealPlan.cookNaviEntrySub}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
                  </Link>
                )}

                {/* 「今日の献立」と「今週の予定」の並列表示(2026-08-02 便DE-2・オーナー指示)。
                    警告と長い説明文をやめ、2つの中身を左右に並べて見比べられるようにした。
                    左の品は今週の予定に入っていないので、その場で入れられるボタンを下に置く
                    (入る役割の判定は assignMismatchRecipe＝主菜になる料理は主菜・それ以外は副菜) */}
                {mismatchRecipes.length > 0 && (
                  <div
                    data-testid="plan-mismatch"
                    className="mt-[var(--space-sm)] rounded-md border border-edge bg-app p-[var(--space-sm)]"
                  >
                    <div className="grid grid-cols-2 gap-[var(--space-sm)]">
                      <div>
                        <p className="text-xs font-bold text-ink-muted">
                          {ja.mealPlan.planMismatchListLabel}
                        </p>
                        <ul className="mt-1 space-y-[var(--space-sm)]">
                          {mismatchRecipes.map((recipe) => (
                            <li key={recipe.id}>
                              <p className="text-sm font-bold">{recipe.title}</p>
                              <div className="mt-1 flex flex-col gap-1">
                                {visibleSlots.map((slot) => (
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
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-ink-muted">
                          {ja.mealPlan.planMismatchPlanLabel}
                        </p>
                        <ul className="mt-1 space-y-[var(--space-sm)]">
                          {visibleSlots.map((slot) => {
                            const titles = (todayEntriesBySlot.get(slot) ?? [])
                              .map((e) => recipeById.get(e.recipeId)?.title)
                              .filter((t): t is string => !!t)
                            return (
                              <li key={slot}>
                                <p className="text-xs text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                                <p className="text-sm font-bold">
                                  {titles.length > 0
                                    ? titles.join('・')
                                    : ja.mealPlan.planMismatchPlanEmpty}
                                </p>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
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
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                  >
                    <Dices size={18} aria-hidden />
                    {ja.mealPlan.todaySuggestButton}
                  </button>
                  {/* 週タブの「まとめて献立を立てる」との違いを一言で示す
                      (2026-07-29 便CD/MP-15。名前が近く区別が付かないという指摘) */}
                  <p className="-mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.todaySuggestHint}（
                    {ja.common.candidateCount.replace('{n}', String(suggestCandidateCount))}）
                  </p>
                  {todayFromPlanIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void importRecipeIdsToTodayList(todayFromPlanIds)}
                      className="w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-accent-ink shadow-sm"
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
                className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
              >
                {!isAtCurrentMonth && <RotateCcw size={14} className="text-accent-ink" aria-hidden />}
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

            {/* 月間サマリー(2026-07-29 便CB-1・docs/59 B-3・常設)。期間を選ばなくても、
                表示中の月の「1人が食べる分」の食費と栄養(エネルギー)がここに常に出る。
                数え方は下の「期間の栄養と食費」と同一(過ぎた日=作った記録・今日から先=登録した献立)で、
                栄養はPro解錠時のみ(既存のゲートと同じisNutritionUnlocked判定)。
                内訳(8項目・実績/予定の分解・作った記録の全体食費)は既定で畳み、カレンダーを押し下げない */}
            <section className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
              <h2 className="font-bold">
                {ja.mealPlan.monthSummaryTitle.replace(
                  '{m}',
                  String(Number(monthAnchor.slice(5, 7))),
                )}
              </h2>
              {monthSummaryDishCount === 0 ? (
                // 2026-07-30 便CH/C3: 合計が0品でも「作った記録も献立もまだありません」と
                // 言い切れるのは、その月に作った記録が1件も無いときだけ。今日の記録だけがある月は
                // カレンダーに記録の印が出ているので、集計に入っていない理由を正直に出す
                <p className="mt-1 text-sm text-ink-muted">
                  {monthCookedDishes.length > 0
                    ? ja.mealPlan.monthSummaryTodayOnly
                    : ja.mealPlan.monthSummaryEmpty}
                </p>
              ) : (
                <>
                  <div className="mt-1 flex flex-wrap items-end gap-x-[var(--space-md)] gap-y-1">
                    <div>
                      <p className="text-xs text-ink-muted">{ja.mealPlan.monthSummaryCostLabel}</p>
                      <p className="text-2xl font-bold text-accent-ink tabular-nums">
                        約{monthSummary.personalYen.toLocaleString()}円
                      </p>
                    </div>
                    {isNutritionUnlocked(monthUnlocked) && monthSummary.nutrition.dishCount > 0 && (
                      <div>
                        <p className="text-xs text-ink-muted">{ja.nutrition.kcalLabel}</p>
                        <p className="text-2xl font-bold text-accent-ink tabular-nums">
                          {formatNutrient('kcal', monthSummary.nutrition.total.kcal)}
                        </p>
                      </div>
                    )}
                    <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
                      {ja.nutrition.estimateBadge}
                    </span>
                  </div>
                  {/* 1人あたり1日の分母は「月の日数」。期間カードと違って日数の文脈が無いので、
                      月では何日で割ったかを文言で言い切る(2026-07-30 便CH/C4) */}
                  <p className="mt-1 text-sm text-ink-muted">
                    {ja.mealPlan.monthSummaryPersonalCostPerDay
                      .replace('{m}', String(Number(monthAnchor.slice(5, 7))))
                      .replace('{d}', String(monthDatesList.length))
                      .replace('{n}', monthPersonalPerDay.toLocaleString())}
                  </p>
                  {/* 家族の実支出にあたる「作った記録の全体食費」は内訳に畳まず1行だけ常設で出す
                      (2026-07-30 便CH/C8)。1人分の見出しと並ぶので、いつの分か・何人分かを言い切る */}
                  {monthSummary.cookedMealCount > 0 && (
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {ja.mealPlan.monthSummaryHousehold
                        .replace('{yen}', monthSummary.cookedHouseholdYen.toLocaleString())
                        .replace('{n}', String(monthSummary.cookedMealCount))}
                    </p>
                  )}
                  {/* どの日をどちらの基準で数えたかは、期間の集計カードと同じ文言で必ず出す */}
                  <p className="mt-0.5 text-xs text-ink-muted">{intakeBasisText(monthSummary)}</p>
                  {/* 数字の前提(何をもとにしためやすか)も同じ場所に置く(2026-07-30 便CH/C12) */}
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {ja.mealPlan.monthSummaryEstimateNote}
                  </p>

                  {/* 目的モードの「答え合わせ」(2026-08-02 便CP-2・docs/62 決定②)。
                      目的を指定して組んだ日がこの月に1日もなければ、この節ごと出さない。
                      出すのは事実だけ＝日数と、1日あたりの数字の並置。達成/未達の判定はせず、
                      色分けもしない(docs/60 §1-3 の文言規律。「多い方がよい」とも言わない) */}
                  {isNutritionUnlocked(monthUnlocked) && monthPurposeReviews.length > 0 && (
                    <section
                      data-testid="purpose-review"
                      className="mt-[var(--space-sm)] rounded-sm border border-edge bg-app p-[var(--space-sm)]"
                    >
                      <h3 className="text-sm font-bold">{ja.mealPlan.purposeReviewTitle}</h3>
                      {monthPurposeReviews.map((review) => {
                        const key = PURPOSE_NUTRIENT_KEY[review.purpose]
                        const nutrient = purposeNutrientLabelOf(review.purpose)
                        return (
                          <div key={review.purpose} className="mt-1">
                            <p className="text-sm tabular-nums">
                              {ja.mealPlan.purposeReviewDays
                                .replace('{purpose}', purposeLabelOf(review.purpose))
                                .replace('{n}', String(review.days))
                                .replace('{total}', String(review.totalDays))}
                            </p>
                            {review.averageWith != null && (
                              <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                                {review.averageWithout != null
                                  ? ja.mealPlan.purposeReviewAverage
                                      .replace('{nutrient}', nutrient)
                                      .replace('{a}', String(roundNutrient(key, review.averageWith)))
                                      .replace(
                                        '{b}',
                                        String(roundNutrient(key, review.averageWithout)),
                                      )
                                      .replaceAll('{unit}', ja.nutrition.gramUnit)
                                  : ja.mealPlan.purposeReviewAverageOnly
                                      .replace('{nutrient}', nutrient)
                                      .replace('{a}', String(roundNutrient(key, review.averageWith)))
                                      .replaceAll('{unit}', ja.nutrition.gramUnit)}
                              </p>
                            )}
                          </div>
                        )
                      })}
                      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.purposeReviewNote}</p>
                    </section>
                  )}
                  <button
                    type="button"
                    onClick={() => setMonthSummaryOpen((v) => !v)}
                    aria-expanded={monthSummaryOpen}
                    className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                  >
                    {monthSummaryOpen
                      ? ja.mealPlan.monthSummaryDetailsClose
                      : ja.mealPlan.monthSummaryDetailsOpen}
                    {monthSummaryOpen ? (
                      <ChevronUp size={16} aria-hidden />
                    ) : (
                      <ChevronDown size={16} aria-hidden />
                    )}
                  </button>
                  {monthSummaryOpen && (
                    <div className="mt-[var(--space-sm)]">
                      {isNutritionUnlocked(monthUnlocked) && monthSummary.nutrition.dishCount > 0 && (
                        <IntakeNutritionPanel
                          summary={monthSummary}
                          label={ja.mealPlan.monthSummaryNutritionLabel}
                        />
                      )}
                      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                        {ja.mealPlan.rangeIntakeCostBreakdown
                          .replace('{a}', monthSummary.actual.personalYen.toLocaleString())
                          .replace('{an}', String(monthSummary.actual.dishCount))
                          .replace('{p}', monthSummary.plan.personalYen.toLocaleString())
                          .replace('{pn}', String(monthSummary.plan.dishCount))}
                      </p>
                      {/* 作った食数の合算(全体食費)はオーナー指示で残す。2026-07-30 便CH/C8で
                          カード上部の常設1行へ昇格させたので、内訳では重ねて出さない */}
                      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
                        {ja.mealPlan.weekCostNote}
                      </p>
                      {/* 価格が分からない材料の分は1円も入っていない＝この金額の信頼度を月にも出す
                          (2026-07-30 便CH/C2。週の概算食費にだけ入っていた注記を揃えた) */}
                      {monthPricelessCount > 0 && (
                        <p className="mt-1 text-xs text-ink-muted">
                          {ja.mealPlan.weekCostPriceless.replace(
                            '{n}',
                            String(monthPricelessCount),
                          )}
                        </p>
                      )}
                      <Link
                        to="/prices"
                        className="mt-1 inline-block text-xs font-bold text-accent-ink underline"
                      >
                        {ja.mealPlan.weekCostNoteLink}
                      </Link>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* カレンダーに出す情報の切り替え(2026-07-28 便CA・タスク2・オーナー指示)。
                既定は写真＞献立プレビュー。栄養/食費に切り替えると各セルにその日の1人分の数字が出る。
                選択は設定に記憶する(次に月タブを開いても同じ表示) */}
            <div
              role="group"
              aria-label={ja.mealPlan.monthCellModeLabel}
              className="mt-[var(--space-sm)] flex gap-1"
            >
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

            {/* 自動提案の条件(2026-07-30 便CH/C11)。この条件は月の「未定の日をまとめて提案」にも
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
                <p className="text-sm font-bold text-accent-ink">
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
                    hasNote={monthDayNoteByDate.has(date)}
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
                <p className="mt-0.5 text-xs text-ink-muted">{intakeBasisText(rangeSummary)}</p>

                {rangeSummary.actual.dishCount + rangeSummary.plan.dishCount === 0 ? (
                  <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                    {ja.mealPlan.rangeIntakeEmpty}
                  </p>
                ) : (
                  <>
                    {/* 期間内に摂取できた栄養(1人分・便CA): 期間内の料理を1食ずつ足した合計。
                        既存のPro8項目計算を流用し「めやす／概算」表記を厳守する。
                        栄養フラグ&&Pro(isNutritionUnlocked)かつ計算できた品数>0のときだけ出す */}
                    {isNutritionUnlocked(monthUnlocked) && rangeSummary.nutrition.dishCount > 0 && (
                      <div className="mt-[var(--space-sm)]">
                        <IntakeNutritionPanel summary={rangeSummary} />
                      </div>
                    )}

                    {/* 期間内の食費(1人分・便CA): 栄養と同じ数え方＝料理1品につき1人分の金額を1回足す */}
                    <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
                      {ja.mealPlan.rangeIntakePersonalCostLabel}
                    </p>
                    <p className="mt-0.5 text-2xl font-bold text-accent-ink">
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
                        <p className="mt-0.5 text-lg font-bold text-accent-ink">
                          {ja.mealPlan.rangeIntakeHouseholdResult
                            .replace('{yen}', rangeSummary.cookedHouseholdYen.toLocaleString())
                            .replace('{n}', String(rangeSummary.cookedMealCount))}
                        </p>
                      </>
                    )}
                  </>
                )}

                <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.mealPlan.weekCostNote}</p>
                {/* 期間カードにも同じ信頼度の注記を出す(2026-07-30 便CH/C2) */}
                {rangePricelessCount > 0 && (
                  <p className="mt-1 text-xs text-ink-muted">
                    {ja.mealPlan.weekCostPriceless.replace('{n}', String(rangePricelessCount))}
                  </p>
                )}
                <Link
                  to="/prices"
                  className="mt-1 inline-block text-xs font-bold text-accent-ink underline"
                >
                  {ja.mealPlan.weekCostNoteLink}
                </Link>
              </div>
            )}

            {/* A-4 献立表(印刷・画像で保存)。この月の分を1枚にまとめる(2026-07-29 便CB-2・docs/59) */}
            {renderPlanSheetSection(monthPlanSheet)}

            {/* 「作った記録」の一覧への入口(2026-08-02 便DE-11・オーナー指示)。
                週タブにしか無かったので月からも開けるようにし、戻るはこの月タブへ返す(?back=month) */}
            {!isDemo && (
              <Link
                to="/history?back=month"
                className="mt-[var(--space-md)] block text-center text-sm font-bold text-accent-ink underline"
              >
                {ja.mealPlan.historyLink}
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
                  to="/settings?section=pro"
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
          並びは 週の移動 → 表示のしかた → 自動で献立を入れる → 献立テンプレ。
          週の移動だけは「いまどの週を見ているか」で、ほかのグループ全部の前提になるので先頭に置く */}

      {/* 週の移動 */}
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
          className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
        >
          {!isAtCurrentWeek && <RotateCcw size={14} className="text-accent-ink" aria-hidden />}
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

      {/* グループ1: 表示のしかた(週の並べ方・出す食事)。献立そのものは1件も変わらない操作だけを入れる */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
        <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.weekGroupDisplayTitle}</p>
      {/* 週の表示起点の切替(2026-07-24 便BH-3・タスク3): 従来の週区切り⇄今日を先頭に7日間。
          既定は週区切り・選択は記憶する */}
      <div className="mt-[var(--space-sm)] flex gap-[var(--space-sm)]">
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

      {/* 表示する食事帯 */}
      <div className="mt-[var(--space-sm)]">{renderSlotFilter()}</div>
      </section>

      {/* グループ2: 自動で献立を入れる(条件＋実行ボタン)。押すと献立が増える操作をここに集める */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
        <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.weekGroupAutoTitle}</p>
      {/* 自動提案の条件: 時短優先・ジャンル(指定なし/和食/洋食/中華・単一選択)・高たんぱく優先。
          既定は折りたたみ(2026-07-16 UI総点検A-3: 常時全展開がP1/P2一致のゴチャつき指摘だったため)。
          畳んだ状態でも既定値から変わっていればラベルに現在値を出す。
          2026-07-30 便CH/C11: 同じ部品を月タブにも出す(renderSuggestConditions) */}
      {renderSuggestConditions()}

      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => void fillWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
        >
          <Dices size={14} aria-hidden />
          {ja.mealPlan.fillWeek}
        </button>
        {/* S-3(docs/59): 先週の献立を空き枠だけにコピー。上書きはしない=非破壊(確認文で件数と「残る」を明示) */}
        <button
          type="button"
          onClick={() => void copyLastWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
        >
          <Copy size={14} aria-hidden />
          {ja.mealPlan.copyLastWeek}
        </button>
      </div>
      {/* 「おまかせで提案」(日タブ)との違いが名前から分からないという指摘への1行説明
          (2026-07-29 便CD/MP-15) */}
      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.fillWeekHint}</p>
      </section>

      {/* グループ3: 献立テンプレ(2026-07-29 便CB-2・docs/59 A-1＋B-2)。
          保存＝表示中の週を曜日ごと覚える／入れる＝空いているところにだけ入れる(非破壊) */}
      <section className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]">
        <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.weekGroupTemplateTitle}</p>
      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={openTemplateSave}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
        >
          <BookmarkPlus size={14} aria-hidden />
          {ja.mealPlan.templateSave}
        </button>
        <button
          type="button"
          onClick={() => openTemplateApply('week')}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
        >
          <LayoutTemplate size={14} aria-hidden />
          {ja.mealPlan.templateApplyWeek}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.templateSaveDescription}</p>
      {/* テンプレの中身を見る・直す画面への入口(2026-08-02 便DE-9・オーナー指示)。
          保存したあと中身を確かめる手段が無く、直すには保存し直すしかなかった */}
      <Link
        to="/meal-templates"
        className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent-ink underline"
      >
        {ja.mealPlan.templateManageLink}
      </Link>
      </section>

      {/* 7日分のカード */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
        {dates.map((date) => (
          <section
            key={date}
            data-date={date}
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
              {date === today && <span className="ml-2 text-sm text-accent-ink">{ja.mealPlan.todayBadge}</span>}
            </h2>
            {/* 今日・未来日は編集可能な予定グリッド。過去日は予定を表示から消し、下の「作った記録」
                だけを日記のように見せる(便BS・タスク2。mealPlansデータは非破壊で残す) */}
            {!isPastDate(date, today) && (
              <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {visibleSlots.map((slot) => renderSlotEditor(date, slot))}
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
                    <CheckCircle2 size={14} className="text-accent-ink" aria-hidden />
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
                    dateLabel={date.replaceAll('-', '/')}
                    isPro={isPro}
                    balance={dayBalance.balance}
                    includeRice={includeRice}
                    onToggleIncludeRice={(next) => void updateSettings({ includeRice: next })}
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
          </section>
        ))}
      </div>

      {/* 週まとめ: この週の献立ぶんの栄養と野菜量(2026-07-30 便CL・docs/60 第1段)。
          各日カードと同じ部品・同じ数え方で、期間の合計だけを1人分で出す。
          めやすは「1日のめやす × 献立や記録がある日数」で並べる(週まとめ側だけ日数の注記を添える)。
          概算食費カードの隣(すぐ上)に置く: どちらも「この週ぜんぶを振り返る数字」なので同じ場所に集める */}
      {weekBalance.countedDays > 0 && (
        <div className="mt-[var(--space-md)]">
          <NutritionBalancePanel
            scope="week"
            isPro={isPro}
            balance={weekBalance.balance}
            includeRice={includeRice}
            onToggleIncludeRice={(next) => void updateSettings({ includeRice: next })}
          />
        </div>
      )}

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
              <ChevronUp size={18} className="shrink-0 text-accent-ink" aria-hidden />
            ) : (
              <ChevronDown size={18} className="shrink-0 text-accent-ink" aria-hidden />
            )}
          </button>
          {weekCostOpen && (
            <div className="px-[var(--space-md)] pb-[var(--space-md)]">
              <p className="text-2xl font-bold text-accent-ink">
                約{weekCost.toLocaleString()}円
                <span className="ml-2 text-sm font-bold text-ink-muted">
                  （{ja.mealPlan.weekCostMealCount.replace('{n}', String(weekMealCount))}）
                </span>
              </p>
              {/* 何人ぶんの金額かを言い切る(2026-07-30 便CH/C8。月間サマリーの「1人分」と対にする) */}
              <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostWholeNote}</p>
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
          )}
        </section>
      )}

      {/* A-4 献立表(印刷・画像で保存)。この週の分を1枚にまとめる(2026-07-29 便CB-2・docs/59) */}
      {renderPlanSheetSection(weekPlanSheet)}

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

      {/* 2026-08-02 便DE-11(オーナー指示): ここから開いた「作った記録」の戻るは、
          呼び出し元の週タブへ返す(?back=week)。従来はブラウザの戻りで献立タブに戻るだけで、
          タブの状態は既定の「日」に落ちていた */}
      <Link
        to="/history?back=week"
        className="mt-[var(--space-md)] block text-center text-sm font-bold text-accent-ink underline"
      >
        {ja.mealPlan.historyLink}
      </Link>

      {/* 食事を選んでこの週の予定をまとめて消す(便U-4 → 2026-08-02 便CW-3で改名・折りたたみ・移動)。
          自動提案で入った予定も手で入れた予定も区別なく消える実挙動に合わせて名前を付け直し、
          普段は目に入らないよう既定閉の折りたたみにして週タブのいちばん下へ移した
          (従来は「表示する食事」のすぐ下＝毎回目に入る位置に開いたまま置いていた)。
          確認文は規約Fのまま(何が消えるか・何が残るかを件数つきで両方書く) */}
      <section className="mt-[var(--space-lg)] rounded-md border border-edge bg-surface shadow-sm">
        <button
          type="button"
          onClick={() => setClearWeekSlotOpen((v) => !v)}
          aria-expanded={clearWeekSlotOpen}
          className="flex w-full items-center justify-between gap-2 p-[var(--space-md)] text-left"
        >
          <span className="text-sm font-bold text-ink-muted">
            {ja.mealPlan.clearWeekSlotTitle.replace(
              '{slot}',
              ja.mealPlan.slot[clearSlotTarget],
            )}
          </span>
          {clearWeekSlotOpen ? (
            <ChevronUp size={18} className="shrink-0 text-ink-muted" aria-hidden />
          ) : (
            <ChevronDown size={18} className="shrink-0 text-ink-muted" aria-hidden />
          )}
        </button>
        {clearWeekSlotOpen && (
          <div className="px-[var(--space-md)] pb-[var(--space-md)]">
            <div className="flex flex-wrap gap-2">
              {MEAL_SLOTS.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setClearSlotTarget(slot)}
                  aria-pressed={clearSlotTarget === slot}
                  aria-label={ja.mealPlan.clearWeekSlotTargetAria.replace(
                    '{slot}',
                    ja.mealPlan.slot[slot],
                  )}
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
        )}
      </section>
      </>
      )}

      {/* レシピ選択ピッカー(週・月の枠に入れる)。
          z-[60]は月タブの日モーダル(z-50)より上・トースト(z-[70])より下に重ねるため
          (2026-07-29 便CB-1・A-3: 日モーダルを開いたままピッカーを出せるようにした。
          選び終わるとピッカーだけが閉じ、下の日モーダルがそのまま残って続けて編集できる) */}
      {pickerOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-app">
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
                    ? 'border-accent text-accent-ink'
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
                        <span className="shrink-0 rounded-sm border border-accent px-1.5 py-0.5 text-xs font-bold text-accent-ink">
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
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
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
                  if (e.key === 'Enter') void submitTemplateSave()
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
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.mealPlan.templateApply}</h3>
              <button
                type="button"
                onClick={() => setTemplateApplyScope(null)}
                aria-label={ja.common.close}
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
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
                        <span className="ml-0.5 text-[10px] font-normal">{count}</span>
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
                        <li
                          key={entry.id}
                          className="flex items-center gap-2 rounded-sm border border-edge bg-app px-2 py-1.5"
                        >
                          <RowThumb recipe={recipe} />
                          <span className="shrink-0 text-xs text-ink-muted">
                            {ja.mealPlan.slot[entry.slot]}・{ja.mealPlan.role[entry.role ?? 'main']}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">
                            {recipe.title}
                          </span>
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
                  {dayModalLogs.map(({ recipe, log }, i) => (
                    <CookedLogCard
                      key={`${recipe.id}-${i}`}
                      recipe={recipe}
                      log={log}
                      readOnly={isDemo}
                      onNavigate={() => setDayModalDate(null)}
                    />
                  ))}
                </ul>
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
          </div>
        </div>
      )}
    </div>
  )
}
