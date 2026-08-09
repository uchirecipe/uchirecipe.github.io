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
import { isMinutesShownInText } from '../logic/time'
import {
  buildCookPlan,
  hasLaterHandsOnStep,
  recipeStepLabel,
  type TimelineItem,
} from '../logic/cookNavi'
import { NAVI_RECIPE_COLORS } from '../logic/naviColors'
import {
  clearCookNaviSession,
  loadCookNaviSession,
  saveCookNaviSession,
  saveCookNaviScroll,
  takeCookNaviScroll,
  reconcileSelectedIdsForSession,
  COOK_NAVI_MIN_RECIPES,
} from '../logic/cookNaviSession'
import CookSessionOverlay from '../components/CookSessionOverlay'
import CustomTimerModal from '../components/CustomTimerModal'
import { findCursorIndex, startCursor, type CookCursor } from '../logic/cookSession'
import {
  recipeIngredientList,
  stepIngredientAmounts,
  type NaviIngredientAmount,
} from '../logic/naviIngredients'
import { buildIngredientNames } from '../logic/ingredientSpans'
import { seasoningGroupLineStyle } from '../logic/seasoningGroup'
import { markRecipesCooked, undoTodayListCooked } from '../db/todayList'
import Toast from '../components/Toast'
import { effectiveMealServings } from '../logic/servings'
import type { Recipe } from '../db/types'
import { settingsLinkWithBack } from '../logic/backLink'
import { ja } from '../i18n/ja'

/** レシピの色分け（最大3品）。常駐タイマーと同じ定義を使う（logic/naviColors.ts） */
const RECIPE_COLORS = NAVI_RECIPE_COLORS
const MAX_SELECT = 3

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
  showFillHint,
  isRecipeLast,
  highlighted,
  onStartTimer,
}: {
  item: TimelineItem
  /** この手順の文に出てくる材料と分量（2026-08-08 便EB。無ければ空配列＝何も出さない） */
  ingredients: NaviIngredientAmount[]
  /** 手順本文の材料名に下線を引くための名前一覧（レシピ詳細と同じ流儀。2026-08-08 便ED） */
  ingredientNames: readonly string[]
  /** 待ちブロックに「この間に、次の手作業を進められます」を出すか（後続に手作業があるときだけ） */
  showFillHint: boolean
  /** そのレシピの最後の手順か（「完成」を出す。2026-08-08 便EG） */
  isRecipeLast: boolean
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
      <p className="ja-phrase mt-[var(--space-sm)] leading-relaxed">
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

      {/* この手順で使う材料と分量（2026-08-08 便EB）。
          3品を並行で作ると材料欄が混ざるため、同じ材料を別のレシピに使ってしまう事故を
          その場で防ぐ。どのレシピの材料かは左の色の線で示す
          （2026-08-08 便ED: 料理名は手順番号の横にあるので、ここでは繰り返さない） */}
      {ingredients.length > 0 && (
        <div
          data-testid="navi-step-ingredients"
          className="mt-[var(--space-sm)] rounded-sm border-l-2 pl-2"
          style={{ borderLeftColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length] }}
        >
          <p className="ja-phrase text-sm">
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
              {/* ナビが足した湯沸かしは分数を出さない（2026-08-09 便ES・オーナー指示D-3。
                  計算には約5分を使うが、コンロと湯量で大きく変わるので言い切らない） */}
              {item.addedByNavi
                ? ja.cookNavi.waitBlockBoil
                : ja.cookNavi.waitBlockTitle.replace('{n}', String(item.waitMinutes))}
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
          「最後の手順は右下に色付きで完成と出して」）。色はそのレシピの色 */}
      {isRecipeLast && (
        <p className="mt-[var(--space-sm)] text-right">
          <span
            data-testid="navi-recipe-done"
            className="inline-block rounded-full px-3 py-0.5 text-sm font-bold"
            style={{
              backgroundColor: RECIPE_COLORS[item.colorIndex % RECIPE_COLORS.length],
              color: 'var(--chip-ink)',
            }}
          >
            {ja.cookNavi.recipeDone}
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
                  <Collapse open={isOpen}>
                    {recipe.items.length === 0 ? (
                      <p className="pb-1 text-sm text-ink-muted">{ja.cookNavi.ingredientsEmpty}</p>
                    ) : (
                      <>
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
                        {recipe.items.some((ing) => ing.seasoningGroup) && (
                          <p
                            data-testid="navi-seasoning-group-hint"
                            className="pb-1 text-xs text-ink-muted"
                          >
                            {ja.cookNavi.seasoningGroupHint}
                          </p>
                        )}
                      </>
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
   * 恒常のお試し（2026-08-02 便CP-2・docs/62 決定③）。未解錠でも期限なしで3回まで、
   * 本物のナビをそのまま使える。1回目は操作を覚えて終わることが多く、価値が分かるのは
   * 2〜3回目なので回数制にしている（時限だと試す前に失効する）。
   *
   * 回数は「お試しを開始したとき」に1回消費する（その画面を開いている間は何度でも組み直せる）。
   * 2026-08-08 便ED: 作りかけの段取りを覚えるようにしたので、お試し中かどうかも一緒に覚える。
   * これが無いと、他のタブへ行って戻るたびにお試しの回数を1回ずつ失う。
   */
  const trialRemaining = cookNaviTrialRemaining(settings?.cookNaviTrialCount)
  const [trialActive, setTrialActive] = useState(() => loadCookNaviSession()?.trialActive ?? false)
  const canUseNavi = isProUnlocked || trialActive
  const recipes = useLiveQuery(listRecipes, [])
  const todayList = useTodayList()
  const { startTimer, timers } = useTimers()
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
    const pickedIds = todayListPickedIds(
      todayList.map((item) => item.recipeId),
      planIds,
    )
    return [...pickedIds, ...planIds]
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
      .filter((r) => !r.cookedLogs.some((log) => log.date === today))
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
   * 消えるのは「戻る」を押したときと「まとめて作った！」で記録したときだけ。
   */
  const restoredSession = useRef(loadCookNaviSession())
  const [selectedIds, setSelectedIds] = useState<number[]>(
    () => restoredSession.current?.selectedIds ?? [],
  )
  const [showTimeline, setShowTimeline] = useState(
    () => restoredSession.current?.showTimeline ?? false,
  )
  const initializedRef = useRef(restoredSession.current != null)
  /**
   * 調理中の手順（2026-08-09 便EL・docs/69 第1段）。**書ける調理の状態はこの1つだけ**。
   * これが入っていれば全画面の調理中セッションを開いている、という決め方にして、
   * 「開いているかどうか」を別のフラグで二重に持たない（片方だけ更新される瞬間を作らない）。
   */
  const [current, setCurrent] = useState<CookCursor | undefined>(
    () => restoredSession.current?.current,
  )
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

  // 選択・表示状態が変わるたびに覚え直す（保存するのは選択・表示中かどうか・調理中の手順だけ。
  // 段取りそのもの・進み具合・済んだ手順の一覧は保存せず、開くたびに組み直して導く）。
  // 1品も選んでいない状態は覚えない＝選択を全部外したら、次に開いたときは今日の献立から選び直す
  useEffect(() => {
    if (selectedIds.length === 0) {
      clearCookNaviSession()
      return
    }
    saveCookNaviSession({ selectedIds, showTimeline, trialActive, current })
  }, [selectedIds, showTimeline, trialActive, current])

  // 常駐タイマーバーの「完了タイマー」タップからの着地（?focusStep=レシピID-手順番号）。
  // ナビ実行中はタップで単品レシピ詳細へ離脱させず、ナビ内の該当手順カードへスクロール＆
  // 一時ハイライトしてナビ文脈に留める（2026-07-23便BI。バグ修正: 完了タイマーのタップが
  // ナビから単品詳細へ飛ばしていた）。RecipeDetailPage の ?step= と同じ流儀で、着地後に
  // パラメータを消して同じ手順に何度でも飛べるようにする。
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  const [highlightKey, setHighlightKey] = useState<string | null>(null)
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
    if (!focus) return
    // 調理中の画面を開いている間は、背景の一覧をスクロールしても見えない。
    // その手順そのものへカーソルを移す（2026-08-09 便ES・オーナー指示
    // 「タイマーのバー→調整画面→レシピ名タップ→該当手順へ移動」と同じ着地にそろえる）
    if (current && timeline) {
      const [focusRecipeId, focusStepNumber] = focus.split('-').map(Number)
      const target = timeline.items.find(
        (item) => item.recipeId === focusRecipeId && item.stepNumber === focusStepNumber,
      )
      if (target) {
        setCurrent({ recipeId: target.recipeId, stepIndex: target.stepIndex })
        clearFocusStep()
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

  // 初回に今日の献立から先頭2〜3品をあらかじめ選んでおく（すぐ試せるように）
  useEffect(() => {
    if (initializedRef.current) return
    if (!todayRecipes || todayRecipes.length === 0) return
    initializedRef.current = true
    setSelectedIds(todayRecipes.slice(0, MAX_SELECT).map((r) => r.id!))
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
   */
  useEffect(() => {
    // 候補がまだ読めていない間は突き合わせない（2026-08-09 便ES。
    // reconcileSelectedIdsForSession 側でも undefined は何も落とさないようにしてある）
    if (!todayRecipes) return
    // 調理中（全画面のセッションを開いている間）は、記録を段取りへ逆流させない
    // ＝作りかけの段取りが目の前で組み替わらない（2026-08-09 便EL・docs/69「記録は一方通行」）
    const next = reconcileSelectedIdsForSession(
      selectedIds,
      todayRecipes.map((r) => r.id!),
      current != null,
    )
    if (next.length === selectedIds.length) return
    setSelectedIds(next)
    // 段取りを表示中だったなら、残りで組み直せるかどうかで知らせ方を変える
    const canRebuild = showTimeline && next.length >= COOK_NAVI_MIN_RECIPES
    if (showTimeline && !canRebuild) setShowTimeline(false)
    setDroppedNotice(
      canRebuild
        ? ja.cookNavi.selectionDroppedRebuilt.replace('{n}', String(next.length))
        : ja.cookNavi.selectionDropped,
    )
  }, [todayRecipes, selectedIds, showTimeline, current])

  const toggleSelect = (id: number) => {
    setDroppedNotice('')
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
  const timeline = useMemo(
    () => (showTimeline && selectedRecipes.length >= 2 ? buildCookPlan(selectedRecipes) : null),
    [showTimeline, selectedRecipes],
  )
  const isSequential = timeline?.mode === 'sequential'

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
    if (timeline && findCursorIndex(timeline.items, current) !== -1) return
    setCurrent(undefined)
    setSessionLostNotice(true)
  }, [current, recipes, timeline, showTimeline])

  /** 段取りを畳んだ・選び直した・記録した、のいずれでも調理中の位置は残さない */
  useEffect(() => {
    if (!showTimeline && current) setCurrent(undefined)
  }, [showTimeline, current])

  /** 調理中の位置が段取りの何番目か（途中でやめるときの確認文に出す件数に使う） */
  const currentIndex = timeline ? findCursorIndex(timeline.items, current) : -1

  /**
   * その品の最後の手順（＝そこで完成する手順）の位置。段取りの並びで最後に出てくるものを採る
   * （2026-08-08 便EG・オーナー指示「最後の手順は右下に色付きで完成と出して」）。
   */
  const lastIndexByRecipeId = useMemo(() => {
    const map = new Map<number, number>()
    timeline?.items.forEach((item, index) => map.set(item.recipeId, index))
    return map
  }, [timeline])

  /**
   * レシピ詳細から戻ってきたときに、見ていた位置へ帰す（2026-08-08 便EG・実機フィードバック⑧）。
   * 段取りが描き上がってからでないと高さが足りずスクロールできないので、timeline を依存に入れる。
   */
  const scrollRestoredRef = useRef(false)
  useEffect(() => {
    if (scrollRestoredRef.current || !timeline) return
    const y = takeCookNaviScroll()
    if (y == null) {
      scrollRestoredRef.current = true
      return
    }
    scrollRestoredRef.current = true
    // 描画直後は本文の高さが確定していないことがあるので、1フレーム置いてから戻す
    requestAnimationFrame(() => window.scrollTo({ top: y }))
  }, [timeline])

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

  /**
   * 「段取りを作る」（2026-08-09 便EH）。すでに段取りが出ているときは状態が変わらず、
   * 押しても何も起きないように見えていた（オーナー報告「押しても無反応で押せない」）。
   * 表示中なら段取りの先頭まで送る。
   */
  const timelineRef = useRef<HTMLElement | null>(null)
  const buildTimeline = () => {
    setDroppedNotice('')
    setSessionLostNotice(false)
    if (showTimeline) {
      timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    setShowTimeline(true)
  }

  /**
   * 調理中セッション（2026-08-09 便EL・docs/69 第1段）。
   * 「調理をはじめる」＝段取りの先頭にカーソルを置くだけ。全画面を開いているかどうかは
   * **カーソルが入っているかどうかで決まる**ので、開閉のフラグを別に持たない
   * （2つ持つと、片方だけ更新される瞬間が必ずできる）。
   */
  const startSession = () => {
    if (!timeline) return
    setSessionLostNotice(false)
    setCurrent(startCursor(timeline.items))
  }
  /** 調理を終える（調理中の位置だけを消す。選んだ品・段取り・作った記録には触らない） */
  const finishSession = () => setCurrent(undefined)
  /**
   * 段取りの途中でやめるとき（規約F: 何が消えて何が残るかを両方書く）。
   * 最後の手順まで進んだあとの「調理を終える」は確認しない（そこで失うものが無いため）。
   */
  const exitSession = () => {
    if (!timeline) {
      finishSession()
      return
    }
    const ok = window.confirm(
      ja.cookNavi.sessionFinishConfirm
        .replace('{n}', String(currentIndex + 1))
        .replace('{t}', String(timeline.items.length))
        .replace('{m}', String(timeline.recipes.length)),
    )
    if (!ok) return
    finishSession()
  }

  const startStepTimer = (item: TimelineItem, seconds: number) => {
    if (seconds <= 0) return
    startTimer({
      key: `${item.recipeId}-${item.stepIndex}-${seconds}`,
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
  const markAllCooked = async () => {
    const targets = selectedRecipes.filter((r) => r.id != null)
    if (targets.length === 0) return
    const confirmText =
      ja.cookNavi.markAllCookedConfirm
        .replaceAll('{n}', String(targets.length))
        .replace('{titles}', targets.map((r) => r.title).join('・')) +
      (settings?.cookedReflectPantry ? ja.cookNavi.markAllCookedConfirmPantry : '') +
      ja.cookNavi.markAllCookedConfirmAsk
    if (!window.confirm(confirmText)) return
    // 記録できたのは何件かを受け取る（すでに今日の記録がある品は二重に付けない。2026-08-09 便EH）
    const recordedIds = await markRecipesCooked(targets.map((r) => r.id!))
    clearCookNaviSession()
    setSelectedIds([])
    setShowTimeline(false)
    setCurrent(undefined)
    setDroppedNotice('')
    setUndoCooked(recordedIds.map((recipeId) => ({ recipeId })))
    setToast(ja.cookNavi.markAllCookedToast.replace('{n}', String(recordedIds.length)))
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
    <div className={`mx-auto w-full max-w-md ${timers.length > 0 ? 'pb-48' : 'pb-[var(--space-lg)]'}`}>
      {/* 「戻る」は画面を移るだけ。作りかけの段取りは残す（2026-08-09 便ES・オーナー実機報告
          「段取りを作る→戻る→今日の献立画面（再開ボタンが出ない）→並行調理ナビ→段取りが消えている」）。
          便ED では戻るで段取りを終わらせていたが、戻るは台所で最も押す移動の操作で、
          押すたびに段取りが消えるとナビを組み直すことになる。段取りを終える操作は
          「レシピを選び直す」と「まとめて作った！」の2つに集約した */}
      <BackHeader
        fallback="/meal-plan"
        title={ja.cookNavi.title}
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
                      <div className="mt-[var(--space-sm)] flex flex-wrap gap-2">
                        {timeline.recipes.map((r) => (
                          <RecipePill key={r.id} title={r.title} colorIndex={r.colorIndex} />
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
                      <p className="mt-1 text-xs text-ink-muted">
                        {isSequential ? ja.cookNavi.sequentialOrderNote : ja.cookNavi.orderNote}
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
                          {ja.cookNavi.noParallelNote.replace(
                            '{n}',
                            String(timeline.recipes.length),
                          )}
                        </p>
                        <p className="ja-phrase mt-[var(--space-sm)] text-sm text-ink-muted">
                          {ja.cookNavi.noParallelHint}
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
                      data-testid="cook-session-start"
                      onClick={startSession}
                      className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
                    >
                      <ChefHat size={20} aria-hidden />
                      {ja.cookNavi.sessionStart}
                    </button>
                    <p className="ja-phrase mt-1 text-center text-xs text-ink-muted">
                      {ja.cookNavi.sessionStartHint}
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

                    <ol className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                      {timeline.items.map((item, index) => (
                        <TimelineCard
                          key={`${item.recipeId}-${item.stepIndex}`}
                          item={item}
                          ingredients={stepIngredientsByKey.get(`${item.recipeId}-${item.stepIndex}`) ?? []}
                          ingredientNames={ingredientNamesByRecipeId.get(item.recipeId) ?? []}
                          /* 1品ずつ作る順番のときは「この間に、次の手作業を進められます」を出さない
                             （次の手順は同じ品の続きで、待ち終わってからやる作業のため） */
                          showFillHint={!isSequential && hasLaterHandsOnStep(timeline.items, index)}
                          isRecipeLast={lastIndexByRecipeId.get(item.recipeId) === index}
                          highlighted={highlightKey === `${item.recipeId}-${item.stepNumber}`}
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
                      data-testid="navi-mark-all-cooked"
                      onClick={() => void markAllCooked()}
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
      {canUseNavi && current && timeline && (
        <CookSessionOverlay
          items={timeline.items}
          recipes={timeline.recipes}
          cursor={current}
          stepIngredients={stepIngredientsByKey}
          ingredientNamesByRecipeId={ingredientNamesByRecipeId}
          onMove={setCurrent}
          onExit={exitSession}
          onFinish={finishSession}
          onStartTimer={startStepTimer}
        />
      )}
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
