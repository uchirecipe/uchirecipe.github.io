import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Lock,
  Route,
  Hourglass,
  Hand,
  Timer as TimerIcon,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  ListChecks,
} from 'lucide-react'
import BackHeader from '../components/BackHeader'
import StepBadge from '../components/StepBadge'
import TimeText from '../components/TimeText'
import { listRecipes } from '../db/recipes'
import { useTodayList } from '../db/todayList'
import { useMealPlanRange } from '../db/mealPlan'
import { MEAL_SLOTS, todayListPickedIds } from '../logic/mealPlan'
import { todayString } from '../logic/date'
import { useSettings, updateSettings } from '../db/settings'
import {
  canUseCookNaviTrial,
  consumeCookNaviTrial,
  cookNaviTrialRemaining,
} from '../logic/proTrial'
import { useTimers } from '../components/TimerProvider'
import { deriveDoneLabel } from '../logic/timerLabel'
import { isMinutesShownInText } from '../logic/time'
import { buildCookTimeline, hasLaterHandsOnStep, type TimelineItem } from '../logic/cookNavi'
import {
  recipeIngredientList,
  stepIngredientAmounts,
  type NaviIngredientAmount,
} from '../logic/naviIngredients'
import { effectiveMealServings } from '../logic/servings'
import type { Recipe } from '../db/types'
import { settingsLinkWithBack } from '../logic/backLink'
import { ja } from '../i18n/ja'

/** レシピの色分け（最大3品）。デザイントークンのチップ色を流用する */
const RECIPE_COLORS = ['var(--chip-blue)', 'var(--chip-green)', 'var(--chip-pink)']
const MAX_SELECT = 3

/** レシピ名の色付きピル（どのレシピの手順かを一目で分かるようにする） */
function RecipePill({ title, colorIndex }: { title: string; colorIndex: number }) {
  return (
    <span
      className="inline-block max-w-full truncate rounded-full px-2 py-0.5 text-xs font-bold"
      style={{ backgroundColor: RECIPE_COLORS[colorIndex % RECIPE_COLORS.length], color: 'var(--chip-ink)' }}
    >
      {title}
    </span>
  )
}

/**
 * タイムライン上の手順カードのDOM id（常駐タイマーバーの完了タップからの着地点に使う）。
 * この形式は TimerBar.tsx の goToStep も参照するので、変えるときは両方を揃えること。
 */
function naviStepDomId(recipeId: number, stepNumber: number): string {
  return `navi-step-${recipeId}-${stepNumber}`
}

/** レシピの色の丸印（どのレシピの材料かを一目で分かるようにする） */
function RecipeDot({ colorIndex }: { colorIndex: number }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: RECIPE_COLORS[colorIndex % RECIPE_COLORS.length] }}
      aria-hidden
    />
  )
}

/** タイムラインの1手順カード */
function TimelineCard({
  item,
  ingredients,
  showFillHint,
  highlighted,
  onStartTimer,
}: {
  item: TimelineItem
  /** この手順の文に出てくる材料と分量（2026-08-08 便EB。無ければ空配列＝何も出さない） */
  ingredients: NaviIngredientAmount[]
  /** 待ちブロックに「この間に、次の手作業を進められます」を出すか（後続に手作業があるときだけ） */
  showFillHint: boolean
  /** 常駐タイマーバーの完了タップから飛んできた直後の一時ハイライト対象か */
  highlighted: boolean
  onStartTimer: (item: TimelineItem, seconds: number) => void
}) {
  const isWait = item.kind === 'wait'
  const showWaitTimerButton =
    isWait && item.minutes != null && item.minutes > 0 && !isMinutesShownInText(item.text, item.minutes)
  return (
    <li
      id={naviStepDomId(item.recipeId, item.stepNumber)}
      className={`rounded-md border bg-surface p-[var(--space-md)] shadow-sm transition-shadow ${
        highlighted ? 'border-accent ring-2 ring-accent' : 'border-edge'
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length] }}
    >
      <div className="flex items-center gap-2">
        <StepBadge number={item.order} size={28} />
        <RecipePill title={item.recipeTitle} colorIndex={item.colorIndex} />
        <span
          className={`ml-auto inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${
            isWait ? 'border-accent text-accent-ink' : 'border-edge text-ink-muted'
          }`}
        >
          {isWait ? <Hourglass size={12} aria-hidden /> : <Hand size={12} aria-hidden />}
          {isWait ? ja.cookNavi.kindWait : ja.cookNavi.kindActive}
        </span>
      </div>

      <p className="ja-phrase mt-[var(--space-sm)] leading-relaxed">
        <span className="mr-1 text-xs font-bold text-ink-muted">
          {ja.cookNavi.stepNumberLabel.replace('{n}', String(item.stepNumber))}
        </span>
        <TimeText text={item.text} onStart={(_t, seconds) => onStartTimer(item, seconds)} />
      </p>
      {item.memo && <p className="mt-1 text-sm text-ink-muted">{item.memo}</p>}

      {/* この手順で使う材料と分量（2026-08-08 便EB）。
          3品を並行で作ると材料欄が混ざるため、同じ材料を別のレシピに使ってしまう事故を
          その場で防ぐ。どのレシピの材料かは色の丸印＋料理名で示す */}
      {ingredients.length > 0 && (
        <div
          data-testid="navi-step-ingredients"
          className="mt-[var(--space-sm)] rounded-sm border-l-2 pl-2"
          style={{ borderLeftColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length] }}
        >
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <RecipeDot colorIndex={item.colorIndex} />
            {ja.cookNavi.stepIngredientsLabel.replace('{title}', item.recipeTitle)}
          </p>
          <p className="ja-phrase mt-0.5 text-sm">
            {ingredients.map((ing, i) => (
              <span key={`${ing.name}-${i}`} className="mr-3 inline-block whitespace-nowrap">
                {ing.name}
                {ing.amount && <span className="ml-1 font-bold">{ing.amount}</span>}
              </span>
            ))}
          </p>
        </div>
      )}

      {isWait && (
        <div
          className="mt-[var(--space-sm)] rounded-sm p-[var(--space-sm)]"
          style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-accent-ink">
              <Hourglass size={16} aria-hidden />
              {ja.cookNavi.waitBlockTitle.replace('{n}', String(item.waitMinutes))}
            </span>
            {showWaitTimerButton && (
              <button
                type="button"
                onClick={() => onStartTimer(item, item.waitMinutes * 60)}
                className="inline-flex items-center gap-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm font-bold text-accent-ink shadow-sm"
              >
                <TimerIcon size={16} aria-hidden />
                {ja.cookNavi.startTimer}
              </button>
            )}
          </div>
          {showFillHint && (
            <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.waitFillHint}</p>
          )}
        </div>
      )}
    </li>
  )
}

/** 材料一覧に出す1品分 */
interface NaviRecipeIngredients {
  recipeId: number
  title: string
  colorIndex: number
  servings: number
  items: NaviIngredientAmount[]
}

/**
 * ③レシピごとの材料一覧（2026-08-08 便EB・オーナー指摘「あらかじめ計量したい人、
 * 使用する材料を把握したい人に不親切。レシピごとに一覧表示は必要」）。
 * 段取りを作った直後（調理を始める前）から開けるよう、タイムラインの先頭に置く。
 * 面積を取らないよう既定は閉じておき、開くとレシピごとに折りたためる形にする。
 */
function IngredientsPanel({ recipes }: { recipes: NaviRecipeIngredients[] }) {
  const [open, setOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<number[]>([])
  const toggleRecipe = (id: number) =>
    setCollapsed((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  return (
    <div className="mt-[var(--space-sm)]">
      <button
        type="button"
        data-testid="navi-ingredients-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-accent bg-surface py-3 font-bold text-accent-ink shadow-sm"
      >
        <ListChecks size={18} aria-hidden />
        {open ? ja.cookNavi.ingredientsClose : ja.cookNavi.ingredientsOpen}
        <ChevronDown
          size={16}
          aria-hidden
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
      {open && (
        <div
          data-testid="navi-ingredients-panel"
          className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
        >
          <p className="text-sm font-bold text-ink-muted">
            {ja.cookNavi.ingredientsPanelTitle.replace('{n}', String(recipes.length))}
          </p>
          <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
            {recipes.map((recipe) => {
              const isOpen = !collapsed.includes(recipe.recipeId)
              return (
                <li
                  key={recipe.recipeId}
                  className="rounded-sm border-l-4 border-edge pl-2"
                  style={{
                    borderLeftColor: RECIPE_COLORS[recipe.colorIndex % RECIPE_COLORS.length],
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleRecipe(recipe.recipeId)}
                    className="flex w-full items-center gap-2 py-1 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {ja.cookNavi.ingredientsServings.replace('{n}', String(recipe.servings))}
                    </span>
                    <ChevronDown
                      size={16}
                      aria-hidden
                      className={isOpen ? 'shrink-0 rotate-180' : 'shrink-0'}
                    />
                  </button>
                  {isOpen &&
                    (recipe.items.length === 0 ? (
                      <p className="pb-1 text-sm text-ink-muted">{ja.cookNavi.ingredientsEmpty}</p>
                    ) : (
                      <ul className="pb-1">
                        {recipe.items.map((ing, i) => (
                          <li
                            key={`${ing.name}-${i}`}
                            className="flex items-baseline justify-between gap-2 py-0.5 text-sm"
                          >
                            <span className="ja-phrase min-w-0">{ing.name}</span>
                            <span className="shrink-0 font-bold">{ing.amount}</span>
                          </li>
                        ))}
                      </ul>
                    ))}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function CookNaviPage() {
  const settings = useSettings()
  const isProUnlocked = !!settings?.proCode
  /**
   * 恒常のお試し（2026-08-02 便CP-2・docs/62 決定③）。未解錠でも期限なしで3回まで、
   * 本物のナビをそのまま使える。1回目は操作を覚えて終わることが多く、価値が分かるのは
   * 2〜3回目なので回数制にしている（時限だと試す前に失効する）。
   *
   * 回数は「お試しを開始したとき」に1回消費する（その画面を開いている間は何度でも組み直せる）。
   * trialActive はこの画面の状態なので、画面を離れれば消える＝次に開くと残り回数の案内に戻る。
   */
  const trialRemaining = cookNaviTrialRemaining(settings?.cookNaviTrialCount)
  const [trialActive, setTrialActive] = useState(false)
  const canUseNavi = isProUnlocked || trialActive
  const recipes = useLiveQuery(listRecipes, [])
  const todayList = useTodayList()
  const { startTimer, timers } = useTimers()

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    recipes?.forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  /**
   * 段取りを組む候補（2026-08-03 便DH・オーナー指示「両方から複数選択して並行調理ナビに渡せる」）。
   *
   * 献立タブの日タブと同じ順・同じ中身にする:
   *   ①「レシピ一覧から選択中」＝今日の献立のうち今日の週プランに無い分（登録順）
   *   ②「今週の献立の予定」    ＝今日の週プランを朝食→昼食→夕食の順に
   * 従来は①（今日の献立）しか候補に出せず、週タブで組んだ予定のうち「表示する食事」から
   * 外した帯の品はナビに渡せなかった。どちらから選んでも段取りを組めるようにする。
   * 今日すでに作った品は候補から外す（日タブと同じ＝作った後は予定でなく記録）。
   */
  const today = useMemo(() => todayString(), [])
  const todayPlanEntries = useMealPlanRange(today, today)
  const todayRecipes = useMemo(() => {
    if (!todayList) return undefined
    const planIds: number[] = []
    // MEAL_SLOTS は朝食→昼食→夕食の順で定義されている
    MEAL_SLOTS.forEach((slot) =>
      todayPlanEntries
        ?.filter((e) => e.slot === slot)
        .forEach((e) => {
          if (!planIds.includes(e.recipeId)) planIds.push(e.recipeId)
        }),
    )
    const pickedIds = todayListPickedIds(
      todayList.map((item) => item.recipeId),
      planIds,
    )
    return [...pickedIds, ...planIds]
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
      .filter((r) => !r.cookedLogs.some((log) => log.date === today))
  }, [todayList, todayPlanEntries, recipeById, today])

  /**
   * お試しを開始する（2026-08-02 便CP-2）。
   * **段取りを組める献立が無いとき（今日の献立が2品未満）は回数を減らさない**:
   * 画面は本物のナビをそのまま開くが、この状態では「今日の献立にレシピがありません」の案内しか
   * 受け取れない＝価値を受け取っていないのに3回のうち1回を失うことになるため
   * （献立タブのナビ入口は2品以上のときにしか出ないので、通常はここに来ない経路の保険）。
   */
  const startTrial = async () => {
    if (!canUseCookNaviTrial(settings?.cookNaviTrialCount)) return
    setTrialActive(true)
    if ((todayRecipes?.length ?? 0) < 2) return
    await updateSettings({ cookNaviTrialCount: consumeCookNaviTrial(settings?.cookNaviTrialCount) })
  }

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showTimeline, setShowTimeline] = useState(false)
  const initializedRef = useRef(false)

  // 常駐タイマーバーの「完了タイマー」タップからの着地（?focusStep=レシピID-手順番号）。
  // ナビ実行中はタップで単品レシピ詳細へ離脱させず、ナビ内の該当手順カードへスクロール＆
  // 一時ハイライトしてナビ文脈に留める（2026-07-23便BI。バグ修正: 完了タイマーのタップが
  // ナビから単品詳細へ飛ばしていた）。RecipeDetailPage の ?step= と同じ流儀で、着地後に
  // パラメータを消して同じ手順に何度でも飛べるようにする。
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  useEffect(() => {
    const focus = searchParams.get('focusStep')
    if (!focus) return
    const el = document.getElementById(`navi-step-${focus}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      setHighlightKey(focus)
    }
    const timeout = setTimeout(() => setHighlightKey(null), 2000)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('focusStep')
        return next
      },
      { replace: true },
    )
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // 初回に今日の献立から先頭2〜3品をあらかじめ選んでおく（すぐ試せるように）
  useEffect(() => {
    if (initializedRef.current) return
    if (!todayRecipes || todayRecipes.length === 0) return
    initializedRef.current = true
    setSelectedIds(todayRecipes.slice(0, MAX_SELECT).map((r) => r.id!))
  }, [todayRecipes])

  const toggleSelect = (id: number) => {
    setShowTimeline(false)
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECT) return prev // v1は最大3品まで
      return [...prev, id]
    })
  }

  const selectedRecipes = useMemo(
    () =>
      selectedIds
        .map((id) => recipeById.get(id))
        .filter((r): r is Recipe => r !== undefined),
    [selectedIds, recipeById],
  )

  const timeline = useMemo(
    () => (showTimeline && selectedRecipes.length >= 2 ? buildCookTimeline(selectedRecipes) : null),
    [showTimeline, selectedRecipes],
  )

  /**
   * 各レシピを何人分として扱うか（2026-08-08 便EB）。分量は「作る量」なので、
   * 買い物メモ・概算食費と同じ優先順（枠の食数＞設定「ふだん作る人数」＞レシピの登録人数）で
   * そろえる（logic/servings.ts effectiveMealServings）。画面ごとに違う分量を出さないため。
   */
  const servingsByRecipeId = useMemo(() => {
    const map = new Map<number, number>()
    selectedRecipes.forEach((recipe) => {
      const entry = todayPlanEntries?.find((e) => e.recipeId === recipe.id)
      map.set(
        recipe.id!,
        effectiveMealServings(entry?.servings, settings?.householdServings, recipe.servings),
      )
    })
    return map
  }, [selectedRecipes, todayPlanEntries, settings?.householdServings])

  /** ③レシピごとの材料一覧（段取りを作った直後から開ける） */
  const ingredientsByRecipe = useMemo<NaviRecipeIngredients[]>(() => {
    if (!timeline) return []
    return timeline.recipes.map((r) => {
      const recipe = recipeById.get(r.id)
      const target = servingsByRecipeId.get(r.id) ?? recipe?.servings ?? 1
      return {
        recipeId: r.id,
        title: r.title,
        colorIndex: r.colorIndex,
        servings: target,
        items: recipe
          ? recipeIngredientList(recipe.ingredients, recipe.servings, target)
          : [],
      }
    })
  }, [timeline, recipeById, servingsByRecipeId])

  /** ②手順ごとの材料と分量（手順の文に出てくるものだけ） */
  const stepIngredientsByKey = useMemo(() => {
    const map = new Map<string, NaviIngredientAmount[]>()
    if (!timeline) return map
    timeline.items.forEach((item) => {
      const recipe = recipeById.get(item.recipeId)
      if (!recipe) return
      const target = servingsByRecipeId.get(item.recipeId) ?? recipe.servings
      map.set(
        `${item.recipeId}-${item.stepIndex}`,
        stepIngredientAmounts(item.text, recipe.ingredients, recipe.servings, target),
      )
    })
    return map
  }, [timeline, recipeById, servingsByRecipeId])

  const startStepTimer = (item: TimelineItem, seconds: number) => {
    if (seconds <= 0) return
    startTimer({
      key: `${item.recipeId}-${item.stepIndex}-${seconds}`,
      label: item.recipeTitle,
      doneLabel: deriveDoneLabel(item.text),
      seconds,
      recipeId: item.recipeId,
      stepNumber: item.stepNumber,
    })
  }

  return (
    <div className={`mx-auto w-full max-w-md ${timers.length > 0 ? 'pb-48' : 'pb-[var(--space-lg)]'}`}>
      <BackHeader fallback="/meal-plan" title={ja.cookNavi.title} />
      <div className="px-[var(--space-md)]">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Route size={24} className="text-accent-ink" aria-hidden />
          {ja.cookNavi.title}
        </h1>

        {/* Pro未解錠ゲート（M3-1の月間ビューと同じパターン）。
            2026-08-02 便CP-2・docs/62 決定③: お試しが残っていれば、鍵の代わりに
            「お試しで使ってみる（あと{n}回）」を出す。使い切ったあとは終了の一言＋鍵表示に戻る */}
        {!canUseNavi ? (
          <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center shadow-sm">
            <Lock size={28} className="mx-auto text-ink-muted" aria-hidden />
            <p className="mt-[var(--space-sm)] font-bold">{ja.cookNavi.gateTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">{ja.cookNavi.gateDescription}</p>
            {trialRemaining > 0 ? (
              <button
                type="button"
                data-testid="cook-navi-trial-start"
                onClick={() => void startTrial()}
                className="mt-[var(--space-sm)] inline-flex items-center justify-center rounded-md bg-accent px-4 py-3 font-bold text-on-accent shadow-sm"
              >
                {ja.cookNavi.trialButton.replace('{n}', String(trialRemaining))}
              </button>
            ) : (
              <p
                data-testid="cook-navi-trial-exhausted"
                className="mt-[var(--space-sm)] text-sm font-bold"
              >
                {ja.cookNavi.trialExhausted}
              </p>
            )}
            <Link
              to={settingsLinkWithBack('/settings?section=pro', location.pathname + location.search)}
              className="mt-[var(--space-sm)] block text-sm font-bold text-accent-ink underline"
            >
              {ja.cookNavi.gateLink}
            </Link>
          </div>
        ) : (
          <>
            {/* お試しで使っている間だけ、いまの状態と残り回数を控えめに出す（機能は制限しない） */}
            {!isProUnlocked && (
              <p
                data-testid="cook-navi-trial-active"
                className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface px-3 py-2 text-sm text-ink-muted"
              >
                {trialRemaining > 0
                  ? ja.cookNavi.trialActiveNote.replace('{n}', String(trialRemaining))
                  : ja.cookNavi.trialActiveLastNote}
              </p>
            )}
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.cookNavi.intro}</p>

            {/* 使い方の注記（2026-08-08 便EB: 言い訳めいた言い回しを削り、短く言い切る1文にした） */}
            <div className="mt-[var(--space-sm)] flex items-start gap-2 rounded-md border border-edge bg-surface p-[var(--space-sm)]">
              <Info size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
              <p className="text-xs text-ink-muted">{ja.cookNavi.disclaimer}</p>
            </div>

            {todayRecipes === undefined ? null : todayRecipes.length === 0 ? (
              <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] text-center shadow-sm">
                <p className="text-sm text-ink-muted">{ja.cookNavi.emptyToday}</p>
                <Link
                  to="/meal-plan"
                  className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent-ink underline"
                >
                  {ja.cookNavi.goToday}
                </Link>
              </div>
            ) : (
              <>
                {/* レシピ選択 */}
                <section className="mt-[var(--space-md)]">
                  <h2 className="font-bold">{ja.cookNavi.selectTitle}</h2>
                  <p className="mt-0.5 text-xs text-ink-muted">{ja.cookNavi.selectHint}</p>
                  {todayRecipes.length === 1 && (
                    <p className="mt-[var(--space-sm)] rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-ink-muted">
                      {ja.cookNavi.onlyOneToday}
                    </p>
                  )}
                  <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                    {todayRecipes.map((recipe) => {
                      const selected = selectedIds.includes(recipe.id!)
                      const selectionIndex = selectedIds.indexOf(recipe.id!)
                      const atMax = !selected && selectedIds.length >= MAX_SELECT
                      return (
                        <li key={recipe.id}>
                          <button
                            type="button"
                            onClick={() => toggleSelect(recipe.id!)}
                            disabled={atMax}
                            aria-pressed={selected}
                            className={`flex w-full items-center gap-2 rounded-md border p-[var(--space-sm)] text-left shadow-sm ${
                              selected ? 'border-accent bg-surface' : 'border-edge bg-surface'
                            } ${atMax ? 'opacity-40' : ''}`}
                          >
                            <span
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                selected ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                              }`}
                            >
                              {selected && <Check size={16} aria-hidden />}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                            {selected && (
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: RECIPE_COLORS[selectionIndex % RECIPE_COLORS.length] }}
                                aria-hidden
                              />
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>

                  <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                    {ja.cookNavi.selectedCount.replace('{n}', String(selectedIds.length))}
                    {selectedIds.length >= MAX_SELECT && (
                      <span className="ml-1 text-xs">（{ja.cookNavi.maxThree}）</span>
                    )}
                  </p>

                  <button
                    type="button"
                    onClick={() => setShowTimeline(true)}
                    disabled={selectedRecipes.length < 2}
                    className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
                  >
                    <Route size={20} aria-hidden />
                    {ja.cookNavi.build}
                  </button>
                  {selectedRecipes.length < 2 && (
                    <p className="mt-1 text-center text-sm text-ink-muted">{ja.cookNavi.needTwo}</p>
                  )}
                </section>

                {/* タイムライン */}
                {timeline && (
                  <section className="mt-[var(--space-lg)]">
                    {/* 凡例 */}
                    <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
                      <p className="text-sm font-bold text-ink-muted">
                        {ja.cookNavi.legendTitle.replace('{n}', String(timeline.recipes.length))}
                      </p>
                      <div className="mt-[var(--space-sm)] flex flex-wrap gap-2">
                        {timeline.recipes.map((r) => (
                          <RecipePill key={r.id} title={r.title} colorIndex={r.colorIndex} />
                        ))}
                      </div>
                      <p className="mt-[var(--space-md)] text-2xl font-bold text-accent-ink">
                        {ja.cookNavi.totalEstimate.replace('{n}', String(timeline.totalMinutes))}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.totalNote}</p>
                      <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.orderNote}</p>
                    </div>

                    {/* 材料一覧の入口。調理を始める前に先に計量したい人がここから開く */}
                    <IngredientsPanel recipes={ingredientsByRecipe} />

                    <ol className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                      {timeline.items.map((item, index) => (
                        <TimelineCard
                          key={`${item.recipeId}-${item.stepIndex}`}
                          item={item}
                          ingredients={stepIngredientsByKey.get(`${item.recipeId}-${item.stepIndex}`) ?? []}
                          showFillHint={hasLaterHandsOnStep(timeline.items, index)}
                          highlighted={highlightKey === `${item.recipeId}-${item.stepNumber}`}
                          onStartTimer={startStepTimer}
                        />
                      ))}
                    </ol>

                    <div className="mt-[var(--space-md)] flex flex-wrap gap-2">
                      {timeline.recipes.map((r) => (
                        <Link
                          key={r.id}
                          to={`/recipes/${r.id}`}
                          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                        >
                          {r.title}
                          <ChevronRight size={16} aria-hidden />
                        </Link>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTimeline(false)}
                      className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                    >
                      {ja.cookNavi.rebuild}
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
