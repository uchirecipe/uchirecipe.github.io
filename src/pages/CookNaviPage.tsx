import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Lock,
  Route,
  Hourglass,
  Hand,
  Timer as TimerIcon,
  Check,
  ChevronRight,
  Info,
} from 'lucide-react'
import BackHeader from '../components/BackHeader'
import StepBadge from '../components/StepBadge'
import TimeText from '../components/TimeText'
import { listRecipes } from '../db/recipes'
import { useTodayList } from '../db/todayList'
import { useSettings } from '../db/settings'
import { useTimers } from '../components/TimerProvider'
import { deriveDoneLabel } from '../logic/timerLabel'
import { isMinutesShownInText } from '../logic/time'
import { buildCookTimeline, hasLaterHandsOnStep, type TimelineItem } from '../logic/cookNavi'
import type { Recipe } from '../db/types'
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

/** タイムラインの1手順カード */
function TimelineCard({
  item,
  showFillHint,
  highlighted,
  onStartTimer,
}: {
  item: TimelineItem
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
            isWait ? 'border-accent text-accent' : 'border-edge text-ink-muted'
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

      {isWait && (
        <div
          className="mt-[var(--space-sm)] rounded-sm p-[var(--space-sm)]"
          style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-accent">
              <Hourglass size={16} aria-hidden />
              {ja.cookNavi.waitBlockTitle.replace('{n}', String(item.waitMinutes))}
            </span>
            {showWaitTimerButton && (
              <button
                type="button"
                onClick={() => onStartTimer(item, item.waitMinutes * 60)}
                className="inline-flex items-center gap-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm font-bold text-accent shadow-sm"
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

export default function CookNaviPage() {
  const settings = useSettings()
  const isPro = !!settings?.proCode
  const recipes = useLiveQuery(listRecipes, [])
  const todayList = useTodayList()
  const { startTimer, timers } = useTimers()

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    recipes?.forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  // 今日の献立のレシピ（登録順）
  const todayRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])

  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [showTimeline, setShowTimeline] = useState(false)
  const initializedRef = useRef(false)

  // 常駐タイマーバーの「完了タイマー」タップからの着地（?focusStep=レシピID-手順番号）。
  // ナビ実行中はタップで単品レシピ詳細へ離脱させず、ナビ内の該当手順カードへスクロール＆
  // 一時ハイライトしてナビ文脈に留める（2026-07-23便BI。バグ修正: 完了タイマーのタップが
  // ナビから単品詳細へ飛ばしていた）。RecipeDetailPage の ?step= と同じ流儀で、着地後に
  // パラメータを消して同じ手順に何度でも飛べるようにする。
  const [searchParams, setSearchParams] = useSearchParams()
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
          <Route size={24} className="text-accent" aria-hidden />
          {ja.cookNavi.title}
        </h1>

        {/* Pro未解錠ゲート（M3-1の月間ビューと同じパターン） */}
        {!isPro ? (
          <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center shadow-sm">
            <Lock size={28} className="mx-auto text-ink-muted" aria-hidden />
            <p className="mt-[var(--space-sm)] font-bold">{ja.cookNavi.gateTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">{ja.cookNavi.gateDescription}</p>
            <Link
              to="/settings?section=pro"
              className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent underline"
            >
              {ja.cookNavi.gateLink}
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.cookNavi.intro}</p>

            {/* 叩き台であることの控えめな注記（過信させない） */}
            <div className="mt-[var(--space-sm)] flex items-start gap-2 rounded-md border border-edge bg-surface p-[var(--space-sm)]">
              <Info size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
              <p className="text-xs text-ink-muted">{ja.cookNavi.disclaimer}</p>
            </div>

            {todayRecipes === undefined ? null : todayRecipes.length === 0 ? (
              <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] text-center shadow-sm">
                <p className="text-sm text-ink-muted">{ja.cookNavi.emptyToday}</p>
                <Link
                  to="/meal-plan"
                  className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent underline"
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
                      <p className="mt-[var(--space-md)] text-2xl font-bold text-accent">
                        {ja.cookNavi.totalEstimate.replace('{n}', String(timeline.totalMinutes))}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.totalNote}</p>
                      <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.orderNote}</p>
                    </div>

                    <ol className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                      {timeline.items.map((item, index) => (
                        <TimelineCard
                          key={`${item.recipeId}-${item.stepIndex}`}
                          item={item}
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
                          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
                        >
                          {r.title}
                          <ChevronRight size={16} aria-hidden />
                        </Link>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowTimeline(false)}
                      className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
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
