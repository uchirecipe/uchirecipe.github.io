import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Lock,
  Route,
  Hourglass,
  Hand,
  Timer as TimerIcon,
  Pause,
  Check,
  ChevronRight,
  ChevronDown,
  Info,
  ListChecks,
  ChefHat,
} from 'lucide-react'
import BackHeader from '../components/BackHeader'
import Collapse from '../components/Collapse'
import SwapLabel from '../components/SwapLabel'
import StepBadge from '../components/StepBadge'
import TimeText from '../components/TimeText'
import { MemoText } from '../components/MemoText'
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
import { useWakeLock } from '../components/useWakeLock'
import { deriveDoneLabel } from '../logic/timerLabel'
import { findRunningStepTimer, stepTimerKey, timerRemainingSeconds } from '../logic/timerOrder'
import { formatRemaining } from '../logic/time'
import {
  buildCookPlan,
  hasFillableWorkDuringWait,
  recipeStepLabel,
  showsWaitTimerButton,
  type TimelineItem,
} from '../logic/cookNavi'
import { NAVI_RECIPE_COLORS } from '../logic/naviColors'
import {
  clearCookNaviSession,
  endCookNaviTrial,
  loadCookNaviRestore,
  loadCookNaviSessionOpen,
  saveCookNaviSession,
  saveCookNaviSessionOpen,
  saveCookNaviScroll,
  takeCookNaviScroll,
  reconcileSelectedIdsForSession,
  pickDefaultSelectedIds,
  resolveCookNaviSelection,
  COOK_NAVI_MIN_RECIPES,
  COOK_NAVI_MAX_RECIPES,
} from '../logic/cookNaviSession'
import CookSessionOverlay from '../components/CookSessionOverlay'
import { revealExpanded } from '../logic/revealExpanded'
import CustomTimerModal from '../components/CustomTimerModal'
import CookFinishModal from '../components/CookFinishModal'
import {
  applyStepPulls,
  findCursorIndex,
  resumeCursor,
  type CookCursor,
  type StepPull,
} from '../logic/cookSession'
import { naviStepText } from '../logic/naviStepText'
import {
  recipeIngredientList,
  stepIngredientAmounts,
  type NaviIngredientAmount,
} from '../logic/naviIngredients'
import {
  assignRecipeNotes,
  recipeNoteStepKey,
  type RecipeNote,
  type RecipeNoteSource,
} from '../logic/naviRecipeNotes'
import NaviRecipeNotes from '../components/NaviRecipeNotes'
import { buildIngredientNames } from '../logic/ingredientSpans'
import { renderJaUnits } from '../components/jaUnits'
import { seasoningGroupLineStyle } from '../logic/seasoningGroup'
import { markRecipesCooked, undoTodayListCooked } from '../db/todayList'
import Toast from '../components/Toast'
import { effectiveMealServings } from '../logic/servings'
import type { Recipe } from '../db/types'
import { settingsLinkWithBack } from '../logic/backLink'
import { kitchenFromSettings } from '../logic/cookAppliance'
import { ja } from '../i18n/ja'

/** レシピの色分け（最大3品）。常駐タイマーと同じ定義を使う（logic/naviColors.ts） */
const RECIPE_COLORS = NAVI_RECIPE_COLORS
/** 一度に組み合わせられる品数の上限（選び直しの規則と同じ値を使う） */
const MAX_SELECT = COOK_NAVI_MAX_RECIPES

/**
 * そのレシピ内の手順番号（2026-08-09 便EH・オーナー実機報告
 * 「レシピごとの手順番号（丸数字）が小さくて潰れて読めない」）。
 *
 * 便EGでは料理名のピルの頭に丸数字（①②③）を置いていたが、ピルの文字寸法（12px）では
 * 丸数字の中の数字が潰れて読めなかった。オーナー案どおり**番号だけを分けて**、
 * 全体の通し番号と同じ丸バッジを**そのレシピの色**で、一回り小さく描く。
 */
function RecipeStepNumber({ item, colorIndex }: { item: TimelineItem; colorIndex: number }) {
  const label = recipeStepLabel(item)
  if (!label) return null
  return (
    <>
      <span className="sr-only">
        {item.splitOf != null && item.splitPart != null
          ? ja.cookNavi.splitStepNumberLabel
              .replace('{n}', String(item.splitOf))
              .replace('{part}', String(item.splitPart))
          : ja.cookNavi.stepNumberLabel.replace('{n}', label)}
      </span>
      <span aria-hidden data-testid="navi-recipe-step-number">
        <StepBadge
          number={label}
          size={24}
          color={RECIPE_COLORS[colorIndex % RECIPE_COLORS.length]}
        />
      </span>
    </>
  )
}

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
  ingredients,
  ingredientNames,
  recipeNotes,
  showFillHint,
  isRecipeLast,
  highlighted,
  runningTimer,
  now,
  onStartTimer,
}: {
  item: TimelineItem
  /** この手順の文に出てくる材料と分量（2026-08-08 便EB。無ければ空配列＝何も出さない） */
  ingredients: NaviIngredientAmount[]
  /** この手順に割り当てたレシピ本体のメモ（2026-08-11 便FM。無ければ空配列＝何も出さない） */
  recipeNotes: readonly RecipeNote[]
  /** 手順本文の材料名に下線を引くための名前一覧（レシピ詳細と同じ流儀。2026-08-08 便ED） */
  ingredientNames: readonly string[]
  /** 待ちブロックに「この間に、次の手作業を進められます」を出すか（後続に手作業があるときだけ） */
  showFillHint: boolean
  /** そのレシピの最後の手順か（「完成」を出す。2026-08-08 便EG） */
  isRecipeLast: boolean
  /** 常駐タイマーバーの完了タップから飛んできた直後の一時ハイライト対象か */
  highlighted: boolean
  /** この手順ではかっているタイマー（2026-08-12 便FS-5。無ければ「タイマーを始める」を出す） */
  runningTimer: { endsAt: number; pausedRemainingMs?: number } | undefined
  /** 残り時間の計算に使う現在時刻（TimerProvider が約0.3秒ごとに進める） */
  now: number
  onStartTimer: (item: TimelineItem, seconds: number) => void
}) {
  const isWait = item.kind === 'wait'
  // 待ちブロックが分数を名乗っていればタイマーのボタンを必ず出す（2026-08-11 便FN。
  // 判定は logic/cookNavi.ts showsWaitTimerButton）。今回の調理では終わらない待ち
  // （「冷蔵庫で半日〜一晩漬ける」）だけは分数を持たないので出さない（同 便FL）
  const showWaitTimerButton = showsWaitTimerButton(item)
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
        {/* そのレシピ内の手順番号は、レシピ色の丸バッジで料理名の手前に置く（2026-08-09 便EH）。
            レシピの1手順を2つに分けた工程は「3-1」「3-2」で分割が分かる（同 便ES） */}
        <RecipeStepNumber item={item} colorIndex={item.colorIndex} />
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

      {/* 2026-08-09 便ES: 「ナビが追加」の札はやめ、手順番号を「3-1」「3-2」にして
          レシピの1手順を分けたことが番号で分かる形にした（オーナー指示D-4） */}
      <p data-testid="navi-step-text" className="ja-phrase mt-[var(--space-sm)] leading-relaxed">
        {/* 手順本文の材料名に控えめな下線（レシピ詳細と同じ・2026-08-08 便ED） */}
        <TimeText
          text={item.text}
          ingredientNames={ingredientNames}
          onStart={(_t, seconds) => onStartTimer(item, seconds)}
        />
      </p>
      {/* 注意書きは改行・箇条書きを保って出す（2026-08-08 便EG・オーナー実機報告
          「メモが箇条書きでも改行されず読みにくい」）。レシピ詳細と同じ描き方にそろえる */}
      {item.memo && (
        <div data-testid="navi-step-memo">
          <MemoText text={item.memo} className="mt-1 text-sm text-ink-muted" />
        </div>
      )}

      {/* レシピ本体のメモ（2026-08-11 便FM）。レシピ詳細では出ていたのに、段取りにも
          調理中モードにも1行も出ていなかった。全手順に出すと邪魔なので、行ごとに
          効く手順1つだけに出す（logic/naviRecipeNotes.ts が割り当てる）。
          手順の但し書き（上の item.memo）の直後に置き、どちらも本文を読んだ流れで読める形にする */}
      <NaviRecipeNotes
        notes={recipeNotes}
        testId="navi-recipe-memo"
        className="mt-[var(--space-sm)]"
      />

      {/* この手順で使う材料と分量（2026-08-08 便EB）。
          3品を並行で作ると材料欄が混ざるため、同じ材料を別のレシピに使ってしまう事故を
          その場で防ぐ。どのレシピの材料かは左の色の線で示す
          （2026-08-08 便ED: 料理名は手順番号の横にあるので、ここでは繰り返さない） */}
      {ingredients.length > 0 && (
        <div
          data-testid="navi-step-ingredients"
          /* 角を丸めない（2026-08-12 便FS-3・利用者テスト「材料の左に、閉じていない『(』だけが
             見える」）。左だけに線を引いた枠に角丸を付けると、上下の角が弧になり、
             材料名の手前に閉じ括弧のない「(」が置かれているように見えていた */
          className="mt-[var(--space-sm)] border-l-2 pl-2"
          style={{ borderLeftColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length] }}
        >
          <p className="ja-phrase text-sm">
            {ingredients.map((ing, i) => (
              <span
                key={`${ing.name}-${i}`}
                className="mr-3 inline-block whitespace-nowrap"
                /* 合わせ調味料は下線で組を示す（2026-08-12 便FU-2）。調理中モードの手順カード
                   （CookSessionOverlay）と同じ引き方にそろえる＝同じ手順が2つの画面で
                   違う顔にならないようにする */
                style={
                  ing.seasoningGroup
                    ? {
                        borderBottom: `2px ${seasoningGroupLineStyle(ing.seasoningGroup)} ${
                          RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length]
                        }`,
                      }
                    : undefined
                }
              >
                {ing.name}
                {ing.amount && <span className="ml-1 font-bold">{ing.amount}</span>}
              </span>
            ))}
          </p>
        </div>
      )}

      {isWait && (
        <div
          data-testid="navi-wait-block"
          className="mt-[var(--space-sm)] rounded-sm p-[var(--space-sm)]"
          style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 font-bold text-accent-ink">
              <Hourglass size={16} aria-hidden />
              {/* ナビが足した湯沸かしは分数を出さない（2026-08-09 便ES・オーナー指示D-3。
                  計算には約5分を使うが、コンロと湯量で大きく変わるので言い切らない） */}
              {item.addedByNavi
                ? ja.cookNavi.waitBlockBoil
                : item.longRest
                  ? ja.cookNavi.waitBlockLongRest
                  : ja.cookNavi.waitBlockTitle.replace('{n}', String(item.waitMinutes))}
            </span>
            {/* タイマーが動いている間はボタンを残さず、残り時間に置き換える（2026-08-12 便FS-5・
                利用者テスト「タイマーが動いていても『タイマーを始める』のまま。もう一度押しても
                何も起きない」）。同じ手順・同じ長さのタイマーは二重に立たない作りなので、
                押しても何も起きないボタンが残っていた */}
            {showWaitTimerButton &&
              (runningTimer ? (
                <span
                  data-testid="navi-wait-timer-running"
                  className="inline-flex items-center gap-1 rounded-md border border-accent bg-surface px-3 py-1.5 text-sm font-bold text-accent-ink"
                >
                  {runningTimer.pausedRemainingMs != null ? (
                    <Pause size={16} aria-hidden />
                  ) : (
                    <TimerIcon size={16} aria-hidden />
                  )}
                  <span className="tabular-nums">
                    {(runningTimer.pausedRemainingMs != null
                      ? ja.cookNavi.waitTimerPaused
                      : ja.cookNavi.waitTimerRunning
                    ).replace('{time}', formatRemaining(timerRemainingSeconds(runningTimer, now)))}
                  </span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onStartTimer(item, item.waitMinutes * 60)}
                  className="inline-flex items-center gap-1 rounded-md border border-edge bg-surface px-3 py-1.5 text-sm font-bold text-accent-ink shadow-sm"
                >
                  <TimerIcon size={16} aria-hidden />
                  {ja.cookNavi.startTimer}
                </button>
              ))}
          </div>
          {showFillHint && !item.longRest && (
            <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.waitFillHint}</p>
          )}
          {/* ナビが足した湯沸かしは分数を出さないので、全体の目安に何分で入っているかを
              ここに書く（2026-08-12 便FX・司令部裁定A案）。見出しの「湯が沸くまでの待ち時間」は
              そのままで、数え方だけを添える＝手順の分を足しても合計に届かない理由が読める */}
          {item.addedByNavi && (
            <p data-testid="navi-boil-note" className="ja-phrase mt-1 text-xs text-ink-muted">
              {ja.cookNavi.waitBlockBoilNote}
            </p>
          )}
          {/* 今回の調理では終わらない待ちは、段取りに残したまま時間の計算から外していることを
              その場で書く（2026-08-11 便FL。黙って外すと「なぜ出てこないのか」になる） */}
          {item.longRest && (
            <p data-testid="navi-long-rest" className="mt-1 text-xs text-ink-muted">
              {ja.cookNavi.longRestNote}
            </p>
          )}
          {/* 手順に時間が書かれていない待ち工程（調理法から当てた分数）はその旨を添える。
              書いてある分数と同じ顔で出さない（2026-08-08 便ED・docs/68 打ち手#1） */}
          {item.waitEstimated && (
            <p data-testid="navi-wait-estimated" className="mt-1 text-xs text-ink-muted">
              {ja.cookNavi.waitEstimatedNote}
            </p>
          )}
        </div>
      )}

      {/* 手作業の目安時間（2026-08-09 便EH・オーナー指示「手順カードの右下（完成ある場合は上）に
          目安時間入れて」）。レシピに書かれた時間と、ナビが当てた見積りは書き分ける。
          待ち系は上の待ちブロックに分数が出るので重ねて出さない */}
      {!isWait && item.activeMinutes > 0 && (
        <p data-testid="navi-active-minutes" className="mt-[var(--space-sm)] text-right text-xs text-ink-muted">
          {(item.activeEstimated ? ja.cookNavi.activeMinutesEstimated : ja.cookNavi.activeMinutes).replace(
            '{n}',
            String(item.activeMinutes),
          )}
        </p>
      )}

      {/* その品がここで出来上がる（2026-08-08 便EG・オーナー指示
          「最後の手順は右下に色付きで完成と出して」）。色はそのレシピの色。
          ただし最後の手順が長い待ちの品は「完成」と言わない（2026-08-11 便FL・司令部裁定）。
          同じカードの「今回の調理では仕上がらない」と食い違うため、手順がここで終わることだけを示す */}
      {isRecipeLast && (
        <p className="mt-[var(--space-sm)] text-right">
          <span
            data-testid={item.longRest ? 'navi-recipe-long-rest-done' : 'navi-recipe-done'}
            className="inline-block rounded-full px-3 py-0.5 text-sm font-bold"
            style={{
              backgroundColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length],
              color: 'var(--chip-ink)',
            }}
          >
            {item.longRest ? ja.cookNavi.recipeDoneLongRest : ja.cookNavi.recipeDone}
          </span>
        </p>
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
        {/* ボタン自体は全幅なので寸法は変わらないが、文字数が変わると左右のアイコンが
            7pxずつ動く。長い方の幅で固定して押しても動かさない（2026-08-09 便EO） */}
        <SwapLabel
          current={open ? ja.cookNavi.ingredientsClose : ja.cookNavi.ingredientsOpen}
          labels={[ja.cookNavi.ingredientsOpen, ja.cookNavi.ingredientsClose]}
        />
        <ChevronDown
          size={16}
          aria-hidden
          className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
        />
      </button>
      <Collapse open={open}>
        <div
          data-testid="navi-ingredients-panel"
          className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
        >
          <p className="text-sm font-bold text-ink-muted">
            {ja.cookNavi.ingredientsPanelTitle.replace('{n}', String(recipes.length))}
          </p>
          {/* 合わせ調味料の線の説明は、材料一覧の中で1回だけ出す（2026-08-12 便FX・オーナー指摘
              「材料の『左に同じ線が〜』は、全体で１箇所に書いてあれば十分」）。
              以前は品ごとに繰り返していたので、3品を開くと同じ文が3回並んでいた。
              線が出てくる前に読める位置（見出しの直下）に置き、組を持つ品が1つでもあれば出す */}
          {recipes.some((recipe) => recipe.items.some((ing) => ing.seasoningGroup)) && (
            <p
              data-testid="navi-seasoning-group-hint"
              className="ja-phrase mt-0.5 text-xs text-ink-muted"
            >
              {ja.cookNavi.seasoningGroupHint}
            </p>
          )}
          <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
            {recipes.map((recipe) => {
              const isOpen = !collapsed.includes(recipe.recipeId)
              return (
                <li
                  key={recipe.recipeId}
                  /* 角を丸めない（同 便FS-3。左だけの線＋角丸は「(」に見える） */
                  className="border-l-4 border-edge pl-2"
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
                  <Collapse open={isOpen}>
                    {recipe.items.length === 0 ? (
                      <p className="pb-1 text-sm text-ink-muted">{ja.cookNavi.ingredientsEmpty}</p>
                    ) : (
                      <ul className="pb-1">
                        {recipe.items.map((ing, i) => (
                          <li
                            key={`${ing.name}-${i}`}
                            className="flex items-baseline justify-between gap-2 py-0.5 pl-2 text-sm"
                            /* 合わせ調味料（先にまとめて計量してよい材料）の線。
                               色は**そのレシピの色**にそろえる（2026-08-09 便EH・オーナー実機報告
                               「なんでこっちに青で描いてるの？って混乱する」）。同じレシピに
                               2組以上あるときだけ線の引き方で分ける */
                            style={
                              ing.seasoningGroup
                                ? {
                                    borderLeft: `4px ${seasoningGroupLineStyle(ing.seasoningGroup)} ${
                                      RECIPE_COLORS[recipe.colorIndex % RECIPE_COLORS.length]
                                    }`,
                                  }
                                : { borderLeft: '4px solid transparent' }
                            }
                          >
                            <span className="ja-phrase min-w-0">{ing.name}</span>
                            <span className="shrink-0 font-bold">{ing.amount}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Collapse>
                </li>
              )
            })}
          </ul>
        </div>
      </Collapse>
    </div>
  )
}

export default function CookNaviPage() {
  const settings = useSettings()
  const isProUnlocked = !!settings?.proCode
  /**
   * 端末に残していた覚え書きを、**捨てる条件にかけてから**受け取る（2026-08-12 便FT・
   * 利用者テスト「アプリを開き直すと、段取りも途中の位置も消える」）。
   * 読むのは画面を開いた1回だけ（logic/cookNaviSession.ts の loadCookNaviRestore が
   * 版・日付・形を見て、続きとして使えるものだけを返す）。
   */
  const [restored] = useState(loadCookNaviRestore)
  const restoredSession = restored.kind === 'ok' ? restored.session : undefined
  /**
   * 恒常のお試し（2026-08-02 便CP-2・docs/62 決定③）。未解錠でも期限なしで3回まで、
   * 本物のナビをそのまま使える。1回目は操作を覚えて終わることが多く、価値が分かるのは
   * 2〜3回目なので回数制にしている（時限だと試す前に失効する）。
   *
   * 回数は「お試しを開始したとき」に1回消費する（その画面を開いている間は何度でも組み直せる）。
   * 2026-08-08 便ED: 作りかけの段取りを覚えるようにしたので、お試し中かどうかも一緒に覚える。
   * これが無いと、他のタブへ行って戻るたびにお試しの回数を1回ずつ失う。
   */
  const trialRemaining = cookNaviTrialRemaining(settings?.cookNaviTrialCount)
  const [trialActive, setTrialActive] = useState(restoredSession?.trialActive ?? false)
  const canUseNavi = isProUnlocked || trialActive
  const recipes = useLiveQuery(listRecipes, [])
  const todayList = useTodayList()
  const { startTimer, timers, now } = useTimers()
  /**
   * 「画面を暗くしない」設定がオンなら、この画面を開いている間だけ画面の自動消灯を防ぐ
   * （2026-08-08 便ED。レシピ詳細・調理中モードと同じ扱い。ナビも手を動かしながら見る画面で、
   * 消灯するたびに解除するのは同じように困るため。設定がオフなら従来どおり何もしない）。
   */
  useWakeLock(settings?.keepScreenOn ?? false)

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
   *
   * 2026-08-11 便FN: 「作った品を外す」を効かせるのは②（今日の予定）だけにした。
   * ①（今日の献立に自分で入れた品）は、作り終えたあとに入れ直した品がここに入るので、
   * 作った記録があることを理由に落とすと**その日はもう段取りを組めない**（利用者テスト報告）。
   * 日タブに並んでいるものと同じ中身にする、という元の約束はこの形でも守られる。
   */
  const today = useMemo(() => todayString(), [])
  const todayPlanEntries = useMealPlanRange(today, today)
  const todayRecipes = useMemo(() => {
    // 3つの読み込みが**すべて**終わるまでは「候補が決まっていない」（undefined）とする。
    // ここを空配列で返すと、下の選択の整合が「今日の献立が空になった」と読み違える（2026-08-09 便EH）。
    //
    // 2026-08-09 便ES（オーナー実機報告の重大バグ「段取りが消える」の根本原因）:
    // 便EHでは今日の献立リスト（todayList）とレシピ本体（recipes）だけを待っていて、
    // **今週の献立の予定（todayPlanEntries）を待っていなかった**。予定は別の読み込みなので、
    // 画面を開いた直後に「リストとレシピは読めたが、予定はまだ」という一瞬が必ずできる。
    // 今日の献立が「今週の献立の予定」だけで組まれている人は、この一瞬に候補がゼロと読まれ、
    // 選択が全部落ち、覚え書きごと消えていた（＝段取りが消え、再開ボタンも出なくなる）。
    if (!todayList || !recipes || !todayPlanEntries) return undefined
    const planIds: number[] = []
    // MEAL_SLOTS は朝食→昼食→夕食の順で定義されている
    MEAL_SLOTS.forEach((slot) =>
      todayPlanEntries
        .filter((e) => e.slot === slot)
        .forEach((e) => {
          if (!planIds.includes(e.recipeId)) planIds.push(e.recipeId)
        }),
    )
    const plannedShownIds = planIds.filter((id) => {
      const recipe = recipeById.get(id)
      return recipe != null && !recipe.cookedLogs.some((log) => log.date === today)
    })
    const pickedIds = todayListPickedIds(todayList, plannedShownIds, planIds)
    return [...pickedIds, ...plannedShownIds]
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipes, todayPlanEntries, recipeById, today])

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

  /**
   * 作りかけの段取り（2026-08-08 便ED・オーナー実機フィードバック①
   * 「戻るかまとめて作った！ボタン押下するまで献立タブに残ったままにしたい。
   * 画面移動するたびに段取りを作るところからやり直しになって面倒」）。
   * 選んだ品と表示中かどうかを端末内に覚え、他のタブへ行って戻っても続きから使える。
   *
   * 2026-08-12 便FT: **アプリを開き直しても、その日のうちは続きから使える**
   * （置き場と寿命は logic/cookNaviSession.ts の冒頭）。終わるのは
   * 「レシピを選び直す」「まとめて作った！」「完成！」と、日付が変わったときだけ。
   */
  const [selectedIds, setSelectedIds] = useState<number[]>(restoredSession?.selectedIds ?? [])
  const [showTimeline, setShowTimeline] = useState(restoredSession?.showTimeline ?? false)
  const initializedRef = useRef(restoredSession != null)
  /**
   * 覚えていた段取りを捨てたことの知らせ（2026-08-12 便FT・規約F）。
   * 黙って消すと 2026-08-09 の「段取りが毎回消える」と同じ見え方になるので、
   * **段取りを出していた覚え書きを捨てたときだけ**、理由を画面に1行出す。
   * 選んだ品しか覚えていなかったとき（段取り前）は失うものが無いので知らせない。
   */
  const [expiredReason, setExpiredReason] = useState<'date' | 'version' | null>(
    restored.kind === 'expired' && restored.hadTimeline ? restored.reason : null,
  )
  /** 捨てた覚え書きが調理の途中だったか（知らせの言い方を分ける） */
  const expiredHadCursor = restored.kind === 'expired' && restored.hadCursor
  /**
   * 調理中の手順（2026-08-09 便EL・docs/69 第1段）。**書ける調理の状態はこの1つだけ**。
   */
  const [current, setCurrent] = useState<CookCursor | undefined>(restoredSession?.current)
  /**
   * 全画面の調理中モードを開いているか（2026-08-10 便FC・オーナー実機
   * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
   *
   * 便ELでは「カーソルが入っている＝開いている」と決め、✕で閉じるときにカーソルを
   * 捨てていたので、開き直すと必ず段取りの先頭からになっていた。
   * **閉じてもカーソルは残す**ようにしたため、位置（current）と開閉（ここ）は別のことになる。
   * docs/69 の「書ける状態は1つだけ」は調理の**位置**についての決まりなので、
   * 位置を2か所に持たないこの分け方なら破らない（開閉は showTimeline と同類の見せ方の状態）。
   *
   * 2026-08-12 便FT: 位置は端末に残す（アプリを開き直しても続く）が、**開閉はタブを閉じるまで**。
   * 読み込み直し（同じタブ）では開いたまま続き、アプリを開き直したときは段取りの一覧に着地して
   * 「調理中モードの続きから見る」を本人が押す＝開き直した直後にいきなり大きな手順を出さない。
   */
  const [sessionOpen, setSessionOpen] = useState(
    () => loadCookNaviSessionOpen() && restoredSession?.current != null,
  )
  /**
   * 色で引き寄せた手順（2026-08-10 便FI・docs/69 第3段）。
   * 「青」「緑」「ピンク」と言われたら、その品の次の手順を**いまの位置へ引き寄せる**。
   *
   * **保存しない**（docs/69「段取り・進捗・済みセットは保存しない」）。持つのは
   * 「どの手順を、どの手順の直前へ動かしたか」の並びだけで、段取りは今までどおり毎回
   * 組み直し、そこへこの並びを当て直す（logic/cookSession.ts の applyStepPulls）。
   * 覚え書き（cookNaviSession）には、この「指示」だけを `current` と同じ扱いで保存する
   * （2026-08-10 司令部裁定）。保存しないと読み込み直したときに並びだけ元へ戻り、
   * カーソルより前の品が「作っていないのに完成」と出る。
   */
  const [pulls, setPulls] = useState<StepPull[]>(restoredSession?.pulls ?? [])
  /**
   * 自分で時間を決めるタイマー（2026-08-09 便ES・オーナー指示D-2）。
   * レシピ詳細と同じ作法で、前回使った秒数を覚えて開く。
   */
  const [customTimerOpen, setCustomTimerOpen] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(180)
  const openCustomTimer = () => {
    setCustomSeconds(
      settings?.lastCustomTimerSeconds ??
        (settings?.lastCustomTimerMinutes != null ? settings.lastCustomTimerMinutes * 60 : 180),
    )
    setCustomTimerOpen(true)
  }
  const startCustomTimer = () => {
    void updateSettings({ lastCustomTimerSeconds: customSeconds })
    startTimer({
      key: `custom-navi-${customSeconds}`,
      label: ja.timer.customLabel,
      seconds: customSeconds,
      // 段取りの品ではないので、どのレシピにも紐付けない（戻り先を持たせない）
      recipeId: 0,
      stepNumber: 0,
      isCustom: true,
    })
    setCustomTimerOpen(false)
  }

  // 記録したあとのトースト（「元に戻す」つき）
  const [toast, setToast] = useState('')
  const [undoCooked, setUndoCooked] = useState<{ recipeId: number }[] | null>(null)
  /**
   * 覚えていた選択のうち、今日の献立から外れた品を落としたことの知らせ（2026-08-09 便EH）。
   * 黙って段取りの中身を変えないための1行。選び直したら消す
   */
  const [droppedNotice, setDroppedNotice] = useState('')
  /**
   * 覚えていた調理中の手順が、組み直した段取りに見つからなかったときの知らせ（2026-08-09 便EL）。
   * 近い手順を当てにいかず、段取りの一覧に戻したことをその場に書く（docs/69「復元」）。
   */
  const [sessionLostNotice, setSessionLostNotice] = useState(false)

  // 選択・表示状態が変わるたびに覚え直す（保存するのは選択・表示中かどうか・調理中の手順と、
  // 色で並べ替えた指示だけ。段取りそのもの・進み具合・済んだ手順の一覧は保存せず、
  // 開くたびに組み直して導く）。
  // 1品も選んでいない状態は覚えない＝選択を全部外したら、次に開いたときは今日の献立から選び直す
  useEffect(() => {
    if (selectedIds.length === 0) {
      clearCookNaviSession()
      return
    }
    saveCookNaviSession({
      selectedIds,
      showTimeline,
      trialActive,
      current,
      // 並べ替えが1つも無いときは項目そのものを書かない（覚え書きの中身を増やさない）
      ...(pulls.length > 0 ? { pulls } : {}),
    })
  }, [selectedIds, showTimeline, trialActive, current, pulls])

  /**
   * 全画面を開いているかどうかだけは別に覚える（2026-08-12 便FT）。
   * 置き場もタブを閉じると消える側（sessionStorage）で、**アプリを開き直すと閉じた状態に戻る**。
   * 位置（current）が無いときは意味を持たないので印も残さない。
   */
  useEffect(() => {
    saveCookNaviSessionOpen(sessionOpen && current != null)
  }, [sessionOpen, current])

  // 常駐タイマーバーの「完了タイマー」タップからの着地（?focusStep=レシピID-手順番号）。
  // ナビ実行中はタップで単品レシピ詳細へ離脱させず、ナビ内の該当手順カードへスクロール＆
  // 一時ハイライトしてナビ文脈に留める（2026-07-23便BI。バグ修正: 完了タイマーのタップが
  // ナビから単品詳細へ飛ばしていた）。RecipeDetailPage の ?step= と同じ流儀で、着地後に
  // パラメータを消して同じ手順に何度でも飛べるようにする。
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
  /**
   * すでに着地させた ?focusStep=（2026-08-10 便FC）。
   * URLの後片付けが何かの拍子に効かなくても、**同じ指定で二度カーソルを引き戻さない**ための札。
   * これが無いと、下の不具合（次へを押しても同じ手順に戻される）が再発しうる。
   */
  const handledFocusRef = useRef<string | null>(null)
  /** ?focusStep= を消す（着地できたときだけ。同じ手順に何度でも飛べるようにする） */
  const clearFocusStep = () => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('focusStep')
        return next
      },
      { replace: true },
    )
  }

  /** ?focusStep= の着地。段取りがまだ描かれていないうちは何もせず、描かれてからやり直す */
  const applyFocusStep = () => {
    const focus = searchParams.get('focusStep')
    // 指定が消えたら札も戻す＝同じタイマーをもう一度押せば、また同じ手順へ飛べる
    if (!focus) {
      handledFocusRef.current = null
      return
    }
    if (handledFocusRef.current === focus) return
    // 調理中の手順を覚えている（＝調理の途中）なら、その手順そのものへカーソルを移し、
    // 全画面の調理中モードを開いて着地する（2026-08-09 便ES・オーナー指示
    // 「タイマーのバー→調整画面→レシピ名タップ→該当手順へ移動」と同じ着地）。
    // 2026-08-10 便FC・オーナー実機「調理中モードでスタートしたタイマーからの戻り先が
    // 調理中モードの手順にしたい」: 閉じている間もカーソルは残るようになったので、
    // タイマーから帰ってきたときは**段取りの一覧ではなく調理中モードへ**戻す。
    // 調理を終えている（カーソルが無い）ときは、従来どおり一覧の該当カードへ送る
    if (current && timeline) {
      const [focusRecipeId, focusStepNumber] = focus.split('-').map(Number)
      const target = planItems.find(
        (item) => item.recipeId === focusRecipeId && item.stepNumber === focusStepNumber,
      )
      if (target) {
        handledFocusRef.current = focus
        setCurrent({ recipeId: target.recipeId, stepIndex: target.stepIndex })
        setSessionOpen(true)
        /**
         * **URLの後片付けは1拍おいてから**（2026-08-10 便FC。ここを直接呼ぶと動かない）。
         *
         * 全画面の調理中モードは、開くときに端末の「戻る」対策として履歴を1つ積む
         * （CookSessionOverlay の `history.pushState`）。これは画面遷移の仕組み
         * （React Router）を通さない生の履歴操作なので、**全画面を開く更新と同じ処理の中で
         * URLを書き換えると、書き換えの間に履歴が1つ積まれ、画面遷移の仕組み側だけが
         * 古いURL（?focusStep= が付いたまま）を握り続ける**。
         * するとカーソルが動くたびにこの処理が呼び直され、そのつど同じ手順へ引き戻される
         * ＝実機では「次へを押しても手順が進まない」。
         * 全画面が開き切った（履歴を積み終えた）あとに片付ければ、この食い違いは起きない。
         */
        setTimeout(clearFocusStep, 0)
        return
      }
    }
    const el = document.getElementById(`navi-step-${focus}`)
    // 別の画面から戻ってきた直後は、レシピの読み込みが終わるまで段取りが描かれていない。
    // ここで諦めて focusStep を消してしまうと二度とハイライトできないので、
    // パラメータを残したまま何もしない（段取りが描けたらこの処理が呼び直される）
    // ＝2026-08-08 便ED・オーナー実機フィードバック②の着地が効かない不具合の修正
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    handledFocusRef.current = focus
    setHighlightKey(focus)
    clearFocusStep()
  }

  /**
   * ハイライトを2秒で消す（2026-08-08 便ED・オーナー実機フィードバック③
   * 「タイマーを止めて消しても、調理手順の色が変わったまま戻らない」の修正）。
   *
   * 原因: 上の副作用の中で setTimeout を張り、その場で focusStep を消していたため、
   * URLが変わって副作用が再実行される→**前回の後片付け（clearTimeout）が先に走る**→
   * 消すはずのタイマーが取り消され、色が付いたまま残っていた。
   * ハイライトの解除は「ハイライトが立ったとき」だけを見る別の副作用に分ける。
   */
  useEffect(() => {
    if (!highlightKey) return
    const timeout = setTimeout(() => setHighlightKey(null), 2000)
    return () => clearTimeout(timeout)
  }, [highlightKey])

  // 初回に今日の献立から先頭2〜3品をあらかじめ選んでおく（すぐ試せるように）。
  // 選び方は logic/cookNaviSession.ts の pickDefaultSelectedIds に置き、
  // 下の「覚えていた選択が1品も残らなかったとき」と同じ規則を使う
  useEffect(() => {
    if (initializedRef.current) return
    if (!todayRecipes || todayRecipes.length === 0) return
    initializedRef.current = true
    setSelectedIds(pickDefaultSelectedIds(todayRecipes.map((r) => r.id!)))
  }, [todayRecipes])

  /**
   * 覚えていた選択を、いま選べる品と突き合わせて整える（2026-08-09 便EH・オーナー実機報告の
   * 重大バグ「並行調理中に献立タブから1品だけ『作った！』すると状態が壊れる」の根本修正）。
   *
   * 起きていたこと: 作った記録が付いた品は候補一覧（todayRecipes）から消えるのに、
   * 覚えていた選択（selectedIds）には残り続けていた。そのため
   *   - 段取りには組み込まれたまま（画面から外す手段が無い）
   *   - 「段取りを作る」を押しても、すでに表示中なので何も起きない
   *   - 「まとめて作った！」でその品にもう一度記録が付く（記録が2件になる）
   * が同時に起きていた。**選択の整合はここ1か所で取る**（作った記録・今日の献立からの削除・
   * 予定の取り消し、どの経路で候補から消えても同じように直る）。
   *
   * 2026-08-12 便FR: 覚えていた選択が**1品も残らなかった**ときは、初めて開いたときと同じく
   * 今日の献立から選び直す（`resolveCookNaviSelection`）。以前はここで0品にするだけで、
   * 初回の自動選択を止める札（initializedRef）は立ったままだったため、その1回だけ0品で開き、
   * 次に開き直すと3品が選ばれる＝同じ画面が来るたびに違う状態になっていた。
   */
  useEffect(() => {
    // 候補がまだ読めていない間は突き合わせない（2026-08-09 便ES。
    // resolveCookNaviSelection 側でも undefined は何も落とさないようにしてある）
    if (!todayRecipes) return
    const availableIds = todayRecipes.map((r) => r.id!)
    /**
     * 調理中（全画面のセッションを**開いている間**）は、記録を段取りへ逆流させない
     * ＝作りかけの段取りが目の前で組み替わらない（2026-08-09 便EL・docs/69「記録は一方通行」）。
     *
     * 2026-08-12 便FT: 判断を「調理中の位置を覚えているか」から
     * **「全画面をいま開いているか」**に戻した。便ELの決まりは文面どおり
     * 「全画面のセッションを開いている間」で、便FCで位置を閉じても残すようにしたときに、
     * 位置が残っている＝調理中、と読める形になっていた。段取りと位置を端末に残す（この便）と、
     * その読み方では**一度でも調理中モードを開いたら、その日いっぱい整合が働かない**。
     * それでは「今日の献立から消えた品が、開き直しても段取りに残り続ける」＝
     * 司令部が最優先に挙げた「間違ったものが残る」に当たる。
     *
     * 全画面を閉じているときに整合が働いても、位置（recipeId＋手順の添字）は組み直した段取りに
     * そのまま残るので、**残った品を調理している人の位置は失われない**。位置を失うのは、
     * 外れた品そのものの手順を開いていたときだけで、その品はもう今日の献立に無い
     * ＝一覧に戻すのが正しい（docs/69「復元できなければ推測せずタイムラインへ」）。
     */
    const cooking = sessionOpen && current != null
    // 今日の献立に残っている品（段取りを組み直せるかはこちらで判断する）
    const kept = reconcileSelectedIdsForSession(selectedIds, availableIds, cooking)
    const next = resolveCookNaviSelection(selectedIds, availableIds, cooking)
    // 中身で比べる（品数が同じまま入れ替わることがある＝選び直したとき）
    const unchanged =
      next.length === selectedIds.length && next.every((id, i) => id === selectedIds[i])
    if (unchanged) return
    setSelectedIds(next)
    // 段取りを表示中だったなら、**残った品**で組み直せるかどうかで知らせ方を変える。
    // 選び直した品はユーザーがまだ選んでいないので、その品で勝手に段取りを組まない
    const canRebuild = showTimeline && kept.length >= COOK_NAVI_MIN_RECIPES
    if (showTimeline && !canRebuild) setShowTimeline(false)
    setDroppedNotice(
      canRebuild
        ? ja.cookNavi.selectionDroppedRebuilt.replace('{n}', String(kept.length))
        : kept.length === 0 && next.length > 0
          ? ja.cookNavi.selectionDroppedReselected.replace('{n}', String(next.length))
          : ja.cookNavi.selectionDropped,
    )
  }, [todayRecipes, selectedIds, showTimeline, current, sessionOpen])

  const toggleSelect = (id: number) => {
    setDroppedNotice('')
    setExpiredReason(null)
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

  /**
   * 段取り。並行の余地が無い（1品ずつ作るのとほとんど変わらない）ときは、
   * 並行に組まず1品ずつ作る順番を出して、待ち時間が見つからなかったことを画面に書く
   * （2026-08-08 便ED・docs/68 打ち手#4）。
   */
  /** 設定した台所の器具（2026-08-13 便GC）。未設定の端末は既定（コンロ2口・3器具あり） */
  const kitchen = useMemo(() => kitchenFromSettings(settings), [settings])
  const timeline = useMemo(
    () =>
      showTimeline && selectedRecipes.length >= 2
        ? buildCookPlan(selectedRecipes, kitchen)
        : null,
    [showTimeline, selectedRecipes, kitchen],
  )
  /** 「コンロ2口で組んだ段取りです。」（持っていない器具があればその並びも出す） */
  const kitchenNote = useMemo(() => {
    const missing = [
      kitchen.microwave ? null : ja.settings.kitchenMicrowave,
      kitchen.grill ? null : ja.settings.kitchenGrill,
      kitchen.toaster ? null : ja.settings.kitchenToaster,
    ].filter((x) => x !== null)
    const burners = String(kitchen.burners)
    return missing.length === 0
      ? ja.cookNavi.kitchenNote.replace('{n}', burners)
      : ja.cookNavi.kitchenNoteMissing
          .replace('{n}', burners)
          .replace('{list}', missing.join('・'))
  }, [kitchen])
  const isSequential = timeline?.mode === 'sequential'

  /**
   * 画面に出す段取り（2026-08-10 便FI）。組み直した段取りに、色で引き寄せた並べ替えを
   * 当て直したもの。**引き寄せが1つも無ければ組み直したそのまま**（＝今までと同じ）。
   *
   * 通し番号は前から振り直す。引き寄せたあとも「段取り 2/9」と画面の丸数字②がそろうように
   * するため（番号だけ元の位置のまま残すと、同じ手順に2つの番号がある状態になる）。
   * 段取りの一覧と調理中モードの両方でこの並びを使う＝1つの段取りを2通りに見せない。
   */
  const planItems = useMemo(() => {
    const base = timeline?.items ?? []
    if (pulls.length === 0) return base
    return applyStepPulls(base, pulls).map((item, index) =>
      item.order === index + 1 ? item : { ...item, order: index + 1 },
    )
  }, [timeline, pulls])

  /**
   * 調理中の手順の復元（2026-08-09 便EL・docs/69）。再読み込みや他タブからの復帰では、
   * 段取りは保存していないので毎回組み直す。**覚えていた手順がその段取りに見つからなければ、
   * 推測せずカーソルを捨てて一覧に戻す**（近い手順を当てにいくと、違う手順を大きく出したまま
   * 作業が進んでしまう）。レシピの読み込みが終わるまでは何もしない。
   */
  useEffect(() => {
    if (!current || !recipes) return
    // 自分で畳んだ・選び直したときは下の後片付けに任せる（知らせは出さない）
    if (!showTimeline) return
    if (timeline && findCursorIndex(planItems, current) !== -1) return
    setCurrent(undefined)
    setSessionLostNotice(true)
  }, [current, recipes, timeline, planItems, showTimeline])

  /** 段取りを畳んだ・選び直した・記録した、のいずれでも調理中の位置は残さない */
  useEffect(() => {
    if (!showTimeline && current) setCurrent(undefined)
    // 色で引き寄せた並べ替えも、その段取りだけのものなので一緒に捨てる（2026-08-10 便FI）
    if (!showTimeline && pulls.length > 0) setPulls([])
  }, [showTimeline, current, pulls])

  /** 調理中の位置が段取りの何番目か（-1＝覚えていない・段取りに無い） */
  const currentIndex = timeline ? findCursorIndex(planItems, current) : -1
  /**
   * 全画面を閉じたあとに残っている「続きの手順」（2026-08-10 便FC）。
   * これがあるときは入口のボタンを「続きから見る」に変え、どの手順から始まるかを添える
   * ＝押した先が段取りの途中でも驚かない。先頭にいるだけのときは普通の入口のままにする。
   */
  const resumeItem =
    !sessionOpen && currentIndex > 0 ? (planItems[currentIndex] ?? undefined) : undefined

  /**
   * その品の最後の手順（＝そこで完成する手順）の位置。段取りの並びで最後に出てくるものを採る
   * （2026-08-08 便EG・オーナー指示「最後の手順は右下に色付きで完成と出して」）。
   */
  const lastIndexByRecipeId = useMemo(() => {
    const map = new Map<number, number>()
    planItems.forEach((item, index) => map.set(item.recipeId, index))
    return map
  }, [planItems])

  /**
   * レシピ詳細から戻ってきたときに、見ていた位置へ帰す（2026-08-08 便EG・実機フィードバック⑧）。
   * 段取りが描き上がってからでないと高さが足りずスクロールできないので、timeline を依存に入れる。
   */
  const scrollRestoredRef = useRef(false)
  /** レシピ詳細から帰ってきた（見ていた位置を復元した）か。復元したときは下の呼び出しを譲る */
  const scrollRestoredFromDetailRef = useRef(false)
  useEffect(() => {
    if (scrollRestoredRef.current || !timeline) return
    const y = takeCookNaviScroll()
    if (y == null) {
      scrollRestoredRef.current = true
      return
    }
    scrollRestoredRef.current = true
    scrollRestoredFromDetailRef.current = true
    // 描画直後は本文の高さが確定していないことがあるので、1フレーム置いてから戻す
    requestAnimationFrame(() => window.scrollTo({ top: y }))
  }, [timeline])

  /**
   * 調理の途中でこの画面に来たときは、続きの入口を画面に入れる（2026-08-11 便FO・利用者テスト
   * 「献立画面の『並行調理ナビを再開』を押しても、調理中モードには戻らず、段取りページの
   * 一番上に戻るだけ。そこから下までスクロールして『調理中モードの続きから見る』を押す必要がある」）。
   *
   * 全画面を勝手に開き直しはしない（✕で閉じたのは本人の操作なので、開くかどうかは本人が決める）。
   * 押す先を画面に入れるところまでをこちらで行う＝押すのは1回で済む。
   * レシピ詳細から帰ってきたときは、見ていた位置の復元が優先（そちらも本人の居場所なので奪わない）。
   */
  const resumeRevealedRef = useRef(false)
  const sessionStartRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (resumeRevealedRef.current || !timeline || !resumeItem) return
    if (!scrollRestoredRef.current) return
    resumeRevealedRef.current = true
    if (scrollRestoredFromDetailRef.current) return
    const timer = setTimeout(() => {
      const el = sessionStartRef.current
      if (el) revealExpanded(el)
    }, 250)
    return () => clearTimeout(timer)
  }, [timeline, resumeItem])

  // ?focusStep= の着地は、段取りの手順カードが描かれてから行う（2026-08-08 便ED）。
  // 常駐タイマーから別の画面 → ナビ、と飛んできたときは、この画面が組み上がるより先に
  // 副作用が走る。手順カードが出るのは「今日の献立（todayRecipes）の読み込みが終わって、
  // かつ段取り（timeline）が組めたとき」なので、その両方を依存に入れて描けた時点でやり直す
  useEffect(() => {
    applyFocusStep()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, timeline, todayRecipes, current])

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

  /** 手順本文の材料名に下線を引くための名前一覧（レシピごと。レシピ詳細と同じ流儀・便ED） */
  const ingredientNamesByRecipeId = useMemo(() => {
    const map = new Map<number, string[]>()
    selectedRecipes.forEach((recipe) => {
      map.set(recipe.id!, buildIngredientNames(recipe.ingredients))
    })
    return map
  }, [selectedRecipes])

  /**
   * レシピ本体のメモを、段取りの中の「効く手順」へ1行ずつ割り当てたもの（2026-08-11 便FM）。
   * キーは手順ごとの材料と同じ `${recipeId}-${stepIndex}`。
   *
   * 割り当ての決め方は logic/naviRecipeNotes.ts（純関数）にあり、段取りの並び順には
   * 依存しない＝色で手順を引き寄せても、同じ行が同じ手順に付いたまま動く。
   */
  const recipeNotesByStep = useMemo(() => {
    if (!timeline) return new Map<string, RecipeNote[]>()
    const sources = new Map<number, RecipeNoteSource>()
    selectedRecipes.forEach((recipe) => {
      if (recipe.id == null) return
      sources.set(recipe.id, { memo: recipe.memo, ingredients: recipe.ingredients })
    })
    return assignRecipeNotes(planItems, sources)
  }, [timeline, planItems, selectedRecipes])

  /** ②手順ごとの材料と分量（手順の文に出てくるものだけ） */
  const stepIngredientsByKey = useMemo(() => {
    const map = new Map<string, NaviIngredientAmount[]>()
    if (!timeline) return map
    planItems.forEach((item) => {
      const recipe = recipeById.get(item.recipeId)
      if (!recipe) return
      const target = servingsByRecipeId.get(item.recipeId) ?? recipe.servings
      map.set(
        `${item.recipeId}-${item.stepIndex}`,
        stepIngredientAmounts(item.text, recipe.ingredients, recipe.servings, target),
      )
    })
    return map
  }, [timeline, planItems, recipeById, servingsByRecipeId])

  /**
   * 「段取りを作る」（2026-08-09 便EH）。すでに段取りが出ているときは状態が変わらず、
   * 押しても何も起きないように見えていた（オーナー報告「押しても無反応で押せない」）。
   * 表示中なら段取りの先頭まで送る。
   */
  const timelineRef = useRef<HTMLElement | null>(null)
  /**
   * 「段取りを作る」を押して**これから**段取りが描かれる（2026-08-11 便FO・利用者テスト
   * 「押しても画面がほぼ変わらない。押した直後の画面は上のボタンのまま。結果は画面のずっと下に
   * できている。押せていないのかと思ってもう一度押しそうになった」）。
   * 表示中に押したときはその場で送っていたのに、**初めて作ったときだけ送っていなかった**。
   * 段取りは描き上がってからでないと高さが無いので、描けた時点で送る。
   */
  const pendingBuildScrollRef = useRef(false)
  const buildTimeline = () => {
    setDroppedNotice('')
    setExpiredReason(null)
    setSessionLostNotice(false)
    // 組み直すときは、色で引き寄せた並べ替えも白紙に戻す（2026-08-10 便FI）
    setPulls([])
    if (showTimeline) {
      timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    pendingBuildScrollRef.current = true
    setShowTimeline(true)
  }
  useEffect(() => {
    if (!pendingBuildScrollRef.current || !timeline) return
    pendingBuildScrollRef.current = false
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [timeline])

  /**
   * 調理中セッション（2026-08-09 便EL・docs/69 第1段）。
   * 「調理中モードで見る」＝段取りの先頭にカーソルを置くだけ。全画面を開いているかどうかは
   * **カーソルが入っているかどうかで決まる**ので、開閉のフラグを別に持たない
   * （2つ持つと、片方だけ更新される瞬間が必ずできる）。
   */
  const startSession = () => {
    if (!timeline) return
    setSessionLostNotice(false)
    // 覚えている手順がまだ段取りにあれば**その続きから**、無ければ先頭から
    // （2026-08-10 便FC。どちらを開くかの判断は logic/cookSession.ts の resumeCursor）
    setCurrent(resumeCursor(planItems, current))
    setSessionOpen(true)
  }
  /**
   * 「まとめて作った！」のボタン（2026-08-10 便EZ・オーナー指示
   * 「完成後、画面の戻り位置は並行ナビ下部『まとめて作った！』までスクロール」）。
   * 最後の手順まで進んで全画面を閉じたあと、次にやること＝記録の入口を画面に入れる。
   */
  const markAllCookedRef = useRef<HTMLButtonElement | null>(null)
  /** 「完成！」で閉じたときだけスクロールする（途中でやめた✕・端末の戻るでは動かさない） */
  const completedRef = useRef(false)
  /**
   * 「完成！」の窓を開いているか（2026-08-12 便FX）。
   * ブラウザの確認（OK／キャンセル）では行き先を2つしか作れず、
   * 「手順の画面に帰る」を選べなかったため、画面の中の窓にした。
   */
  const [finishAsking, setFinishAsking] = useState(false)
  /**
   * 記録の中身の説明（規約F: 何件に記録が付き、何が変わり、何が残るか）。
   * 「まとめて作った！」ボタンの確認と「完成！」の窓で**同じ文字列**を使う
   * ＝記録の説明を2か所に書かない。
   */
  const cookedConfirmText =
    ja.cookNavi.markAllCookedConfirm
      .replaceAll('{n}', String(selectedRecipes.filter((r) => r.id != null).length))
      .replace(
        '{titles}',
        selectedRecipes
          .filter((r) => r.id != null)
          .map((r) => r.title)
          .join('・'),
      ) +
    (settings?.cookedReflectPantry ? ja.cookNavi.markAllCookedConfirmPantry : '') +
    // まとめて付けた記録も、あとから1件ずつ直せる（2026-08-12 便FX・オーナー指摘）
    ja.cookNavi.markAllCookedConfirmEdit

  /**
   * 全画面の調理中モードを閉じる（2026-08-10 便FC・オーナー実機
   * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
   * **調理中の手順は消さない**ので、失うものが無い＝確認は出さない。
   * 選んだ品・段取り・作った記録にも触らない。
   */
  const closeSession = () => setSessionOpen(false)
  /**
   * 色で手順を引き寄せる（2026-08-10 便FI・docs/69 第3段。オーナー要望
   * 「並行調理ナビ調理中モードの、色で手順入れ替えはいつ実装しますか？」）。
   *
   * 言われた品の手順を**いま開いている手順の直前へ**移し、そこへカーソルを送る。
   * 開いていた手順は1つ後ろに下がるだけで残るので、**手順が消えることがない**
   *（カーソルだけ先へ飛ばすと、間の手順が「済んだ手順」に化けて、作っていない品が
   * 「完成」と出てしまう。実機で確認した上でこの形にした）。
   */
  const pullStep = (pull: StepPull) => {
    setPulls((prev) => [...prev, pull])
    setCurrent(pull.target)
  }
  /**
   * 最後の手順の「完成！」（2026-08-10 便EZ・戻り位置を「まとめて作った！」に合わせる）。
   * ここは調理が終わった合図なので、覚えていた手順も消す＝次は先頭から始まる。
   *
   * 2026-08-11 便FO・利用者テスト「14/14まで進めて押したが『作りました』も出ず、段取りの
   * ページに戻っただけ。別に『まとめて作った！』を押す必要があると気づくまで分からなかった」:
   * **押したその場で作った記録の確認を出す**。1品の調理中モードが「完成！→記録フォーム」
   * （RecipeDetailPage）なので、並行でも同じ流れにそろえる。
   * 記録するかどうかは確認で選ぶ＝docs/69「最後まで進んだら自動記録、をしない」は守る。
   * 記録しないを選んだときは、従来どおり全画面を閉じて「まとめて作った！」まで画面を送る。
   */
  const completeSession = () => setFinishAsking(true)
  /**
   * 「完成！」の窓で「記録をつけずに閉じる」を選んだとき（2026-08-12 便FX）。
   * 便EZ の戻り位置（画面を「まとめて作った！」まで送る）はここに残す。
   */
  const closeSessionWithoutRecord = () => {
    setFinishAsking(false)
    completedRef.current = true
    setCurrent(undefined)
    setSessionOpen(false)
    setPulls([])
  }
  /**
   * 全画面を閉じたあとの戻り位置（同）。
   * CookSessionOverlay は閉じるときに積んだ履歴を1つ戻す（端末の戻る対策）ので、
   * その後始末が終わってから測る。位置合わせは logic/revealExpanded.ts に任せる＝
   * 上部に貼り付く帯（便ET）と下部に固定される帯（タブナビ・タイマー）の裏に隠れない。
   */
  useEffect(() => {
    if (current !== undefined || !completedRef.current) return
    completedRef.current = false
    const timer = setTimeout(() => {
      const el = markAllCookedRef.current
      if (el) revealExpanded(el)
    }, 250)
    return () => clearTimeout(timer)
  }, [current])
  const startStepTimer = (item: TimelineItem, seconds: number) => {
    if (seconds <= 0) return
    startTimer({
      key: stepTimerKey(item.recipeId, item.stepIndex, seconds),
      label: item.recipeTitle,
      doneLabel: deriveDoneLabel(item.text),
      seconds,
      recipeId: item.recipeId,
      stepNumber: item.stepNumber,
      // ナビから始めたタイマーの印と色（2026-08-08 便ED・実機フィードバック②⑧）。
      // 別の画面から押してもナビの該当手順へ戻り、常駐バーの左端がこの料理の色になる
      fromNavi: true,
      naviColorIndex: item.colorIndex,
      // 常駐バーの番号は段取りの通し番号にする（2026-08-09 便EH・オーナー実機報告
      // 「タイマーの番号が元のレシピの手順番号のまま」）
      naviOrder: item.order,
      // レシピ内の手順番号も渡す（段取りの番号と両方を出す。2026-08-09 便ES・オーナー指示E-12）
      naviStepLabel: recipeStepLabel(item),
    })
  }

  /**
   * 「まとめて作った！」（2026-08-08 便ED・オーナー実機フィードバック⑨）。
   * 段取りに組んだ品をまとめて今日の記録にする。押す前に何が記録され何が残るかを確認し（規約F）、
   * 記録したあとは件数つきのトーストと「元に戻す」を出す（日タブの「全て作った！」と同じ作法）。
   * 記録したら作りかけの段取りは役目を終えるので、覚えていた選択を消して選び直しの状態に戻す。
   */
  const markAllCooked = async (options?: { confirmed?: boolean }) => {
    const targets = selectedRecipes.filter((r) => r.id != null)
    if (targets.length === 0) return false
    // 「完成！」の窓（CookFinishModal）から来たときは、同じ中身をもう一度聞かない
    if (!options?.confirmed && !window.confirm(cookedConfirmText + ja.cookNavi.markAllCookedConfirmAsk))
      return false
    // 記録できたのは何件かを受け取る（すでに今日の記録がある品は二重に付けない。2026-08-09 便EH）
    // 何人分作ったかも記録する（2026-08-10 便FF）。段取りの分量に使っている食数
    // （枠の食数＞設定「食数の設定」＞レシピの登録人数分）をそのまま記録に残す
    const recordedIds = await markRecipesCooked(
      targets.map((r) => r.id!),
      servingsByRecipeId,
    )
    clearCookNaviSession()
    setSelectedIds([])
    setShowTimeline(false)
    setCurrent(undefined)
    setSessionOpen(false)
    setPulls([])
    setDroppedNotice('')
    setUndoCooked(recordedIds.map((recipeId) => ({ recipeId })))
    setToast(ja.cookNavi.markAllCookedToast.replace('{n}', String(recordedIds.length)))
    return true
  }

  /**
   * 段取りを消す（2026-08-12 便FX・オーナー指摘「段取りを作った後に作った！を押すか
   * 選んだレシピを取り消す以外につくった段取りを削除する方法がない」）。
   *
   * 便FT で「アプリを開き直しても今日のうちは残る」ようにしたので、**自分の手で終わらせる道**を
   * 画面に置く。押すと組み合わせ・段取り・調理中の手順・色で先にした並びを全部捨て、
   * 端末に残していた覚え書きも消す＝次に開いたときは今日の献立から選び直すところから始まる。
   * 作った記録・レシピ・今日の献立・動いているタイマーには触らない。
   */
  const discardTimeline = () => {
    const confirmText = ja.cookNavi.discardTimelineConfirm.replace(
      '{n}',
      String(selectedRecipes.length),
    )
    if (!window.confirm(confirmText)) return
    clearCookNaviSession()
    setSelectedIds([])
    setShowTimeline(false)
    setCurrent(undefined)
    setSessionOpen(false)
    setPulls([])
    setFinishAsking(false)
    setDroppedNotice('')
    setExpiredReason(null)
    setSessionLostNotice(false)
    setUndoCooked(null)
    setToast(ja.cookNavi.discardedTimelineToast)
  }

  /** トーストの「元に戻す」（記録を取り消して今日の献立に戻す。日タブと同じ関数を使う） */
  const runUndoCooked = async () => {
    if (!undoCooked) return
    const undone = await undoTodayListCooked(undoCooked)
    setUndoCooked(null)
    setToast(
      undone === 0
        ? ja.cookNavi.markAllCookedUndoNothing
        : ja.cookNavi.markAllCookedUndone.replace('{n}', String(undone)),
    )
  }

  return (
    // 下余白はページ全体を包む main が実測ぶん空ける（2026-08-11 便FN）。
    // タイマーの本数で当て推量の pb-48 を出し分けるのはやめた
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      {/* 「戻る」は画面を移るだけ。作りかけの段取りは残す（2026-08-09 便ES・オーナー実機報告
          「段取りを作る→戻る→今日の献立画面（再開ボタンが出ない）→並行調理ナビ→段取りが消えている」）。
          便ED では戻るで段取りを終わらせていたが、戻るは台所で最も押す移動の操作で、
          押すたびに段取りが消えるとナビを組み直すことになる。段取りを終える操作は
          「レシピを選び直す」と「まとめて作った！」の2つに集約した */}
      <BackHeader
        fallback="/meal-plan"
        title={ja.cookNavi.title}
        /* お試しの1回ぶんはここで終える（段取りは残す。2026-08-09 便ES）。
           次に開くと残り回数の案内に戻り、お試しを始め直せば段取りの続きから使える */
        onBack={() => {
          setTrialActive(false)
          endCookNaviTrial()
        }}
        right={
          /* 自分で時間を決めるタイマーを、画面の名前の横に常駐させる
             （2026-08-09 便ES・オーナー指示D-2。レシピ詳細の料理名横と同じ置き方にそろえる。
             ナビの手順に無い「湯を沸かす」「つけおき」等をその場ではかれるようにするため） */
          <button
            type="button"
            data-testid="navi-custom-timer"
            onClick={openCustomTimer}
            aria-label={ja.timer.customOpenAria}
            className="rounded-full p-3 text-accent-ink"
          >
            <TimerIcon size={22} aria-hidden />
          </button>
        }
      />
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

            {/* 台所の器具（2026-08-13 便GC・docs/72 第3段）。
                段取りは設定した口数・器具の中で組む。**設定を変えると段取りが変わる**ことが
                画面から分かるように、組んだ前提と設定への行き先を段取りの入口に出す（規約H） */}
            <p
              data-testid="navi-kitchen-note"
              className="mt-[var(--space-sm)] text-xs text-ink-muted"
            >
              {kitchenNote}{' '}
              <Link
                to={settingsLinkWithBack(
                  '/settings?section=kitchen',
                  location.pathname + location.search,
                )}
                className="font-bold text-accent-ink underline"
              >
                {ja.cookNavi.kitchenLink}
              </Link>
            </p>

            {/* 覚えていた段取りを捨てたことの知らせ（2026-08-12 便FT・規約F）。
                今日の献立が空でも読めるよう、候補の有無で分かれる前に置く */}
            {expiredReason && (
              <p
                data-testid="navi-restore-expired"
                className="ja-phrase mt-[var(--space-sm)] rounded-sm border border-accent bg-surface px-3 py-2 text-sm text-accent-ink"
              >
                {/* 文節の切れ目で折り返す（renderJaUnits がゼロ幅スペースを挿す）。
                    素のまま置くと ja-phrase の緊急折返しが働き、行頭に「。」が
                    ひとつだけ落ちる（実DOM 390px で確認） */}
                {renderJaUnits(
                  expiredReason === 'version'
                    ? ja.cookNavi.restoreExpiredByVersion
                    : expiredHadCursor
                      ? ja.cookNavi.restoreExpiredByDateCooking
                      : ja.cookNavi.restoreExpiredByDate,
                )}
              </p>
            )}

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
                  {/* 覚えていた選択から品を落としたことの知らせ（2026-08-09 便EH） */}
                  {droppedNotice && (
                    <p
                      data-testid="navi-selection-dropped"
                      className="ja-phrase mt-[var(--space-sm)] rounded-sm border border-accent bg-surface px-3 py-2 text-sm text-accent-ink"
                    >
                      {droppedNotice}
                    </p>
                  )}
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
                    onClick={buildTimeline}
                    disabled={selectedRecipes.length < COOK_NAVI_MIN_RECIPES}
                    className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
                  >
                    <Route size={20} aria-hidden />
                    {ja.cookNavi.build}
                  </button>
                  {selectedRecipes.length < COOK_NAVI_MIN_RECIPES && (
                    <p className="mt-1 text-center text-sm text-ink-muted">{ja.cookNavi.needTwo}</p>
                  )}
                </section>

                {/* タイムライン */}
                {timeline && (
                  <section ref={timelineRef} className="mt-[var(--space-lg)]">
                    {/* 凡例 */}
                    <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
                      <p className="text-sm font-bold text-ink-muted">
                        {ja.cookNavi.legendTitle.replace('{n}', String(timeline.recipes.length))}
                      </p>
                      {/* 品ごとの目安を料理名の横に置く（2026-08-11 便FN）。
                          下の「1品ずつ作ると約◯分」は、この数字の足し算 */}
                      <div className="mt-[var(--space-sm)] flex flex-wrap gap-x-2 gap-y-1">
                        {timeline.recipes.map((r) => (
                          <span key={r.id} className="inline-flex max-w-full items-center gap-1">
                            <RecipePill title={r.title} colorIndex={r.colorIndex} />
                            {r.soloMinutes != null && r.soloMinutes > 0 && (
                              <span
                                data-testid="navi-legend-minutes"
                                className="shrink-0 text-xs text-ink-muted"
                              >
                                {ja.cookNavi.legendRecipeMinutes.replace(
                                  '{n}',
                                  String(r.soloMinutes),
                                )}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                      <p className="mt-[var(--space-md)] text-2xl font-bold text-accent-ink">
                        {ja.cookNavi.totalEstimate.replace('{n}', String(timeline.totalMinutes))}
                      </p>
                      {/* 同じ物差しでの比べ方（2026-08-09 便ES・オーナー指摘B）。
                          レシピ欄の「調理時間」とは数え方が違うので、ナビ自身が数えた
                          「1品ずつ作った場合」と並べて、何分縮んだのかを読めるようにする */}
                      {timeline.sequentialMinutes > timeline.totalMinutes && (
                        <p data-testid="navi-total-compare" className="ja-phrase mt-1 text-sm">
                          {ja.cookNavi.totalCompare
                            .replace('{s}', String(timeline.sequentialMinutes))
                            .replace('{p}', String(timeline.totalMinutes))}
                          <span className="ml-1 font-bold text-accent-ink">
                            {ja.cookNavi.totalGain.replace(
                              '{n}',
                              String(timeline.sequentialMinutes - timeline.totalMinutes),
                            )}
                          </span>
                        </p>
                      )}
                      {/* 漬ける・冷やすなど台所を離れられる待ちが入っているときだけ添える */}
                      {timeline.awayMinutes > 0 && (
                        <p data-testid="navi-total-away" className="ja-phrase mt-1 text-xs text-ink-muted">
                          {ja.cookNavi.totalAwayNote.replace('{n}', String(timeline.awayMinutes))}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-ink-muted">{ja.cookNavi.totalNote}</p>
                      {/* レシピの一覧に出ている「調理時間」と数え方が違うことを画面に書く
                          （2026-08-11 便FN・利用者テスト「多く出たり少なく出たりするので、
                          どちらを信じてよいか分からない」）。数え方の違いは黙っていると
                          「どちらかが間違っている」に見える */}
                      <p
                        data-testid="navi-total-count-note"
                        className="ja-phrase mt-1 text-xs text-ink-muted"
                      >
                        {ja.cookNavi.totalCountNote}
                      </p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {isSequential ? ja.cookNavi.sequentialOrderNote : ja.cookNavi.orderNote}
                      </p>
                      {/* どこまでが残るのかを、閉じる前に読める場所に置く（2026-08-12 便FT・
                          利用者テスト「料理中に画面が落ちる/切り替わるのは普通にあるので不安です」）。
                          残る条件と捨てる条件を同じ1行に並べる（規約F） */}
                      <p
                        data-testid="navi-restore-keep-note"
                        className="ja-phrase mt-1 text-xs text-ink-muted"
                      >
                        {renderJaUnits(ja.cookNavi.restoreKeepNote)}
                      </p>
                    </div>

                    {/* 並行の余地が無かったときの説明（2026-08-08 便ED・docs/68 打ち手#4）。
                        縮んでいないのに縮んだように見せないため、理由と次の一手を書く */}
                    {isSequential && (
                      <div
                        data-testid="navi-no-parallel"
                        className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
                      >
                        <p className="ja-phrase font-bold">
                          {(timeline.limitedByEquipment
                            ? ja.cookNavi.noParallelByEquipmentNote.replace(
                                '{b}',
                                String(kitchen.burners),
                              )
                            : ja.cookNavi.noParallelNote
                          ).replace('{n}', String(timeline.recipes.length))}
                        </p>
                        <p className="ja-phrase mt-[var(--space-sm)] text-sm text-ink-muted">
                          {timeline.limitedByEquipment
                            ? ja.cookNavi.noParallelByEquipmentHint
                            : ja.cookNavi.noParallelHint}
                        </p>
                      </div>
                    )}

                    {/* 材料一覧の入口。調理を始める前に先に計量したい人がここから開く */}
                    <IngredientsPanel recipes={ingredientsByRecipe} />

                    {/* 調理中の画面へ（2026-08-09 便EL・docs/69 第1段）。
                        段取りの一覧は作る前に読む画面で、手を動かしながら見るには文字が小さい。
                        押すと全画面に切り替わり、いまやる手順だけを大きく出す */}
                    <button
                      type="button"
                      ref={sessionStartRef}
                      data-testid="cook-session-start"
                      onClick={startSession}
                      /* 塗りではなく白地＋オレンジの枠にする（2026-08-09 便ES・オーナー指摘C
                         「並行調理ナビ自体がこのボタンを押すことが必須のように見える。実際は
                         縦長スクロールで読むこともできる」）。塗りボタンは画面の中でいちばん強く、
                         下の段取りへ進む前に必ず押す関門に見えていた。献立タブの「並行調理を再開」で
                         オーナーが選んだのと同じ見せ方にそろえる */
                      className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border-2 border-accent bg-surface py-4 text-lg font-bold text-accent-ink shadow-sm"
                    >
                      <ChefHat size={20} aria-hidden />
                      {resumeItem ? ja.cookNavi.sessionResume : ja.cookNavi.sessionStart}
                    </button>
                    <p
                      data-testid="cook-session-start-hint"
                      className="ja-phrase mt-1 text-center text-xs text-ink-muted"
                    >
                      {resumeItem
                        ? ja.cookNavi.sessionResumeHint.replace(
                            '{n}',
                            naviStepText(resumeItem.order, recipeStepLabel(resumeItem)),
                          )
                        : ja.cookNavi.sessionStartHint}
                    </p>
                    {/* 覚えていた調理中の手順が、組み直した段取りに見つからなかったとき */}
                    {sessionLostNotice && (
                      <p
                        data-testid="cook-session-lost"
                        className="ja-phrase mt-[var(--space-sm)] rounded-sm border border-accent bg-surface px-3 py-2 text-sm text-accent-ink"
                      >
                        {ja.cookNavi.sessionLost}
                      </p>
                    )}

                    {/* 色で移った手順を組み込むと、段取りの通し番号が前から振り直される
                        （2026-08-12 便FS-8・利用者テスト「番号が入れ替わるのに説明が
                        どこにもない」）。並びが変わっている間だけ、その理由をここに置く */}
                    {pulls.length > 0 && (
                      <p
                        data-testid="navi-pull-renumbered"
                        className="ja-phrase mt-[var(--space-sm)] text-xs text-ink-muted"
                      >
                        {ja.cookNavi.pullRenumberedNote}
                      </p>
                    )}

                    <ol className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                      {planItems.map((item, index) => (
                        <TimelineCard
                          key={`${item.recipeId}-${item.stepIndex}`}
                          item={item}
                          ingredients={stepIngredientsByKey.get(`${item.recipeId}-${item.stepIndex}`) ?? []}
                          ingredientNames={ingredientNamesByRecipeId.get(item.recipeId) ?? []}
                          recipeNotes={recipeNotesByStep.get(recipeNoteStepKey(item)) ?? []}
                          /* 1品ずつ作る順番のときは「この間に、次の手作業を進められます」を出さない
                             （次の手順は同じ品の続きで、待ち終わってからやる作業のため）。
                             並行の段取りでも、その待ちの中に入る手作業が無ければ出さない
                             （2026-08-12 便FS-2・logic/cookNavi.ts hasFillableWorkDuringWait） */
                          showFillHint={!isSequential && hasFillableWorkDuringWait(planItems, index)}
                          isRecipeLast={lastIndexByRecipeId.get(item.recipeId) === index}
                          highlighted={highlightKey === `${item.recipeId}-${item.stepNumber}`}
                          runningTimer={findRunningStepTimer(timers, item.recipeId, item.stepIndex)}
                          now={now}
                          onStartTimer={startStepTimer}
                        />
                      ))}
                    </ol>

                    {/* レシピ詳細への入口。戻ったときはナビの見ていた位置に帰す
                        （2026-08-08 便EG・実機フィードバック⑧。従来はレシピ一覧へ飛ばされていた） */}
                    <div className="mt-[var(--space-md)] flex flex-wrap gap-2">
                      {timeline.recipes.map((r) => (
                        <Link
                          key={r.id}
                          to={`/recipes/${r.id}`}
                          state={{ from: 'cookNavi', fromPath: '/cook-navi' }}
                          onClick={() => saveCookNaviScroll(window.scrollY)}
                          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                        >
                          {r.title}
                          <ChevronRight size={16} aria-hidden />
                        </Link>
                      ))}
                    </div>

                    {/* 段取りに組んだ品をまとめて今日の記録にする（2026-08-08 便ED・実機FB⑨）。
                        押すと作りかけの段取りも終わる（＝選び直しの状態に戻る） */}
                    <button
                      type="button"
                      ref={markAllCookedRef}
                      data-testid="navi-mark-all-cooked"
                      onClick={() => void markAllCooked()}
                      /* 「完成！」で記録しなかった人がここへ送られてくる（2026-08-11 便FO） */
                      className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
                    >
                      <ChefHat size={20} aria-hidden />
                      {ja.cookNavi.markAllCooked}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowTimeline(false)}
                      className="mt-[var(--space-sm)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                    >
                      {ja.cookNavi.rebuild}
                    </button>

                    {/* 段取りを消す（2026-08-12 便FX・オーナー指摘「作った！を押すか
                        選んだレシピを取り消す以外につくった段取りを削除する方法がない」）。
                        「レシピを選び直す」は組み合わせを残したまま組み直す操作なので、
                        白紙に戻す道を別に置く。押し間違えると作りかけが消えるので、
                        いちばん下・控えめな見た目にして確認を出す（規約F） */}
                    <button
                      type="button"
                      data-testid="navi-discard-timeline"
                      onClick={discardTimeline}
                      className="mt-[var(--space-sm)] w-full rounded-md border border-edge bg-surface py-3 text-sm font-bold text-ink-muted shadow-sm"
                    >
                      {ja.cookNavi.discardTimeline}
                    </button>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>
      {/* 調理中の画面（2026-08-09 便EL）。カーソルが入っている間だけ全画面で重なる。
          今日の献立の中身が変わっても閉じないよう、画面の分岐の外側に置く
          （＝作りかけの段取りが調理中に消えない） */}
      {canUseNavi && sessionOpen && current && timeline && (
        <CookSessionOverlay
          items={planItems}
          recipes={timeline.recipes}
          cursor={current}
          stepIngredients={stepIngredientsByKey}
          ingredientNamesByRecipeId={ingredientNamesByRecipeId}
          recipeNotes={recipeNotesByStep}
          onMove={setCurrent}
          onPullStep={pullStep}
          onExit={closeSession}
          onFinish={completeSession}
          onStartTimer={startStepTimer}
          sequential={isSequential}
        />
      )}
      {/* 「完成！」の窓（2026-08-12 便FX）。記録をつける／調理を続ける／記録をつけずに閉じる
          の3つから選ぶ。全画面（z-50）より上に重ねる */}
      <CookFinishModal
        open={finishAsking}
        body={cookedConfirmText}
        onRecord={() => {
          setFinishAsking(false)
          void markAllCooked({ confirmed: true })
        }}
        onBack={() => setFinishAsking(false)}
        onClose={closeSessionWithoutRecord}
      />
      <CustomTimerModal
        open={customTimerOpen}
        totalSeconds={customSeconds}
        onSecondsChange={setCustomSeconds}
        onStart={startCustomTimer}
        onClose={() => setCustomTimerOpen(false)}
      />
      <Toast
        message={toast}
        onClose={() => {
          setToast('')
          setUndoCooked(null)
        }}
        actionLabel={undoCooked ? ja.common.undo : undefined}
        onAction={undoCooked ? () => void runUndoCooked() : undefined}
      />
    </div>
  )
}
