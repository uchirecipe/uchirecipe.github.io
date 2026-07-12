import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Heart,
  Clock,
  Minus,
  Plus,
  Pencil,
  CheckCircle2,
  ExternalLink,
  TriangleAlert,
  Timer as TimerIcon,
  Share2,
  Image as ImageIcon,
  MessageSquareText,
  Maximize2,
  CalendarPlus,
} from 'lucide-react'
import { db } from '../db/db'
import { addCookedLog, toggleFavorite, updateCookedLog } from '../db/recipes'
import { useSettings } from '../db/settings'
import { useTodayList, addToTodayList, removeFromTodayList } from '../db/todayList'
import { scaleAmount, formatAmountUnit } from '../logic/amount'
import { ngMatchedIndices } from '../logic/ng'
import { seasoningGroupColorToken } from '../logic/seasoningGroup'
import { shareText, shareImageCard } from '../logic/share'
import { deriveDoneLabel } from '../logic/timerLabel'
import { isMinutesShownInText } from '../logic/time'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { MemoText } from '../components/MemoText'
import { useTimers } from '../components/TimerProvider'
import { useWakeLock } from '../components/useWakeLock'
import BackHeader from '../components/BackHeader'
import CookedLogModal from '../components/CookedLogModal'
import FocusMode from '../components/FocusMode'
import NutritionTeaser from '../components/NutritionTeaser'
import { RecipePlaceholder, seasonIcons } from '../components/RecipeCard'
import StepBadge from '../components/StepBadge'
import TimeText from '../components/TimeText'
import TermText from '../components/TermText'
import { collectUniqueTerms } from '../logic/termSplit'
import TermPopover, { useTermPopover } from '../components/TermPopover'
import { todayString } from '../logic/date'
import { ja } from '../i18n/ja'

/** レシピ詳細＝料理中に見るメイン画面。文字・ボタンは大きめ */
export default function RecipeDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()

  // 戻る先の決定（2026-07-12オーナー指示）:
  // 「今日の献立」（ホームのmealPlanウィジェット・献立タブの今日の献立セクション）から
  // 開いた場合はそこへ、それ以外（一覧・検索結果・提案カード・履歴・タイマー通知等、
  // 従来どおり）は常にレシピ一覧へ（2026-07-10オーナー指示は据え置き）。
  // 出所はLinkのstate（{from:'todayList', fromPath}）で受け渡す。ブラウザの実際の戻る操作
  // （履歴のpop）は、この画面へ遷移してきた直前の画面へそのまま戻るため、上記の出所と
  // 基本的に一致し乖離しない（今日の献立からのリンクはpush遷移のため、実際の1つ前の
  // 履歴エントリも呼び出し元と同じになる）
  const navState = location.state as { from?: string; fromPath?: string } | null
  const backFallback =
    navState?.from === 'todayList' ? (navState.fromPath ?? '/meal-plan') : '/recipes'

  // undefined = 読み込み中 / null = 該当レシピなし、を区別する
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id])
  const photoUrl = usePhotoUrl(recipe?.photo)
  const settings = useSettings()
  const { startTimer, timers } = useTimers()
  const todayList = useTodayList()
  const isInTodayList = todayList?.some((item) => item.recipeId === id) ?? false

  // 一覧からの遷移でスクロール位置が引き継がれることがあるため、詳細を開いたら必ず先頭から
  // 表示する（2026-07-11 オーナー実機フィードバック）。?step= の自動スクロールより先に効くよう
  // 描画前（useLayoutEffect）で同期的に行う
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  // 常駐タイマー・完了ポップアップからのタップ（?step=手順番号）で該当手順へスクロール＆一時ハイライト
  const stepRefs = useRef<(HTMLLIElement | null)[]>([])
  const [highlightStepIndex, setHighlightStepIndex] = useState<number | null>(null)
  useEffect(() => {
    const stepParam = searchParams.get('step')
    if (!stepParam || !recipe) return
    const index = Number(stepParam) - 1
    const el = stepRefs.current[index]
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightStepIndex(index)
    const highlightTimeout = setTimeout(() => setHighlightStepIndex(null), 2000)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('step')
        return next
      },
      { replace: true },
    )
    return () => clearTimeout(highlightTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, recipe])

  // 「画面を暗くしない」設定がオンなら、この画面を開いている間だけ画面の自動消灯を防ぐ
  const keepScreenOn = settings?.keepScreenOn ?? false
  useWakeLock(keepScreenOn)

  // 人数分の表示用（変更していない間はレシピ登録時の人数）
  const [servingsOverride, setServingsOverride] = useState<number>()
  const servings = servingsOverride ?? recipe?.servings ?? 1

  // 「作った！」記録の入力欄(2026-07-12: 窓表示化。中央固定のモーダルなので、
  // 開いたときにページ側をスクロールさせる必要がなくなった＝スクロール位置は動かない)
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayString)
  const [logNote, setLogNote] = useState('')

  // 過去の記録を後から編集する
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null)
  const [editingLogDate, setEditingLogDate] = useState('')
  const [editingLogNote, setEditingLogNote] = useState('')

  // シェア
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [sharing, setSharing] = useState(false)

  // 調理中モード（1手順ずつ大きく表示）
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusStep, setFocusStep] = useState(0)

  // 時短モード（レンジ活用など、通常より手早い代替手順がある料理だけ切り替えを表示。表示中だけの一時的な選択）
  const [quickMode, setQuickMode] = useState(false)

  // 用語タップ辞書(2026-07-11): ポップオーバーの開閉はページ単位で1つ持つ
  const { state: termPopoverState, open: openTerm, close: closeTermPopover } = useTermPopover()

  if (recipe === undefined) {
    // 読み込み中(undefined)は何も出さない。id が存在しない場合は下の分岐へ
    return null
  }
  if (recipe === null || Number.isNaN(id)) {
    return (
      <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
        <p className="text-ink-muted">{ja.detail.notFound}</p>
        <Link to="/recipes" className="mt-2 inline-block font-bold text-accent">
          {ja.detail.backToList}
        </Link>
      </div>
    )
  }

  // NG食材（アレルギー・苦手）に引っかかる材料の行番号
  const ngIndices = ngMatchedIndices(recipe.ingredients, settings?.ngIngredients ?? [])

  const totalPrice = recipe.ingredients.reduce(
    (sum, i) => sum + (i.price ?? 0),
    0,
  )
  const scaledPrice =
    recipe.servings > 0
      ? Math.round((totalPrice * servings) / recipe.servings)
      : totalPrice

  const saveLog = async () => {
    if (!logDate) return
    await addCookedLog(id, { date: logDate, note: logNote.trim() || undefined })
    // 今日の献立に入っていれば、記録と同時に外す
    if (isInTodayList) await removeFromTodayList(id)
    setLogOpen(false)
    setLogNote('')
  }

  const openEditLog = (index: number, date: string, note: string | undefined) => {
    setEditingLogIndex(index)
    setEditingLogDate(date)
    setEditingLogNote(note ?? '')
  }

  const saveEditingLog = async () => {
    if (editingLogIndex === null || !editingLogDate) return
    await updateCookedLog(id, editingLogIndex, {
      date: editingLogDate,
      note: editingLogNote.trim() || undefined,
    })
    setEditingLogIndex(null)
  }

  /** テキスト or 画像カードでシェア（非対応環境ではコピー/保存に切替） */
  const runShare = async (kind: 'text' | 'image') => {
    setSharing(true)
    setShareMessage(kind === 'image' ? ja.share.generating : '')
    try {
      if (kind === 'text') {
        const result = await shareText(recipe)
        setShareMessage(result === 'copied' ? ja.share.copied : '')
      } else {
        const result = await shareImageCard(recipe)
        setShareMessage(result === 'downloaded' ? ja.share.downloaded : '')
      }
      if (navigator.share !== undefined) setShareOpen(false)
    } catch {
      setShareMessage(ja.share.failed)
    } finally {
      setSharing(false)
    }
  }

  const showPhoto = photoUrl && !recipe.showIconInsteadOfPhoto

  // 時短版の手順があるレシピだけ切り替えを表示する
  const hasQuickVariant = (recipe.quickSteps?.length ?? 0) > 0
  const useQuick = quickMode && hasQuickVariant
  const displaySteps = useQuick ? recipe.quickSteps! : recipe.steps
  const displayCookMinutes = useQuick
    ? recipe.quickCookMinutes ?? recipe.cookMinutes
    : recipe.cookMinutes
  // 通常/時短タブに調理時間を併記する（2026-07-11 オーナー実機フィードバック:
  // どちらが早いか見た目で分かるように）。時間が無い場合はモード名だけのラベルにする
  const quickModeMinutes = recipe.quickCookMinutes ?? recipe.cookMinutes
  const normalModeLabel =
    recipe.cookMinutes != null && recipe.cookMinutes > 0
      ? ja.detail.modeLabelWithMinutes
          .replace('{mode}', ja.detail.normalMode)
          .replace('{n}', String(recipe.cookMinutes))
      : ja.detail.normalMode
  const quickModeLabel =
    quickModeMinutes != null && quickModeMinutes > 0
      ? ja.detail.modeLabelWithMinutes
          .replace('{mode}', ja.detail.quickMode)
          .replace('{n}', String(quickModeMinutes))
      : ja.detail.quickMode
  // 調理中モードには手順・時間だけ差し替えたレシピを渡す(FocusMode側の変更は不要)
  const focusRecipe = useQuick
    ? { ...recipe, steps: recipe.quickSteps!, cookMinutes: displayCookMinutes }
    : recipe

  return (
    <div className={`mx-auto w-full max-w-md ${timers.length > 0 ? 'pb-48' : 'pb-[var(--space-lg)]'}`}>
      <BackHeader
        fallback={backFallback}
        alwaysFallback
        title={recipe.title}
        onTitleClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        right={
          <div className="flex shrink-0 items-center gap-1">
            <Link
              to={`/recipes/${id}/edit`}
              aria-label={ja.detail.edit}
              className="rounded-full p-3 text-ink-muted"
            >
              <Pencil size={22} aria-hidden />
            </Link>
            <button
              type="button"
              onClick={() => toggleFavorite(id)}
              aria-label={recipe.isFavorite ? ja.detail.favoriteOff : ja.detail.favoriteOn}
              className="rounded-full p-3 text-accent"
            >
              <Heart size={22} fill={recipe.isFavorite ? 'currentColor' : 'none'} aria-hidden />
            </button>
          </div>
        }
      />

      {/* 写真（無い場合・アイコン優先の場合はプレースホルダー） */}
      {showPhoto ? (
        <img src={photoUrl} alt={recipe.title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="aspect-video w-full">
          <RecipePlaceholder recipe={recipe} iconSize={56} />
        </div>
      )}

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        {/* タイトル（編集・お気に入りは上部のsticky ヘッダーに常時表示） */}
        <h1 className="text-2xl font-bold leading-snug">{recipe.title}</h1>

        {/* 時間・手間・概算価格 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
          {displayCookMinutes != null && displayCookMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={16} aria-hidden />
              {displayCookMinutes}
              {ja.detail.minutesSuffix}
            </span>
          )}
          <span className="rounded-sm border border-edge px-2 py-0.5 text-sm">
            {ja.effort[recipe.effortLevel]}
          </span>
          {recipe.season && recipe.season !== 'all' && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-edge px-2 py-0.5 text-sm">
              {(() => {
                const SeasonIcon = seasonIcons[recipe.season]
                return <SeasonIcon size={14} aria-hidden />
              })()}
              {ja.season[recipe.season]}
            </span>
          )}
          {totalPrice > 0 && (
            <span>
              {ja.detail.priceAbout}
              {scaledPrice.toLocaleString()}
              {ja.detail.priceYen}
            </span>
          )}
          {ngIndices.size > 0 && (
            <span className="inline-flex items-center gap-1 rounded-sm border border-warning px-2 py-0.5 text-sm font-bold text-warning">
              <TriangleAlert size={14} aria-hidden />
              {ja.detail.ngWarning}
            </span>
          )}
        </div>

        {/* タグ */}
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm px-2 py-0.5 text-sm text-accent"
                style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 今日つくる（今日の献立への追加・解除）: 材料を見るより前に判断材料として提示 */}
        <button
          type="button"
          onClick={() =>
            isInTodayList ? void removeFromTodayList(id) : void addToTodayList(id)
          }
          className={`mt-[var(--space-lg)] flex w-full items-center justify-center gap-2 rounded-md border py-3 font-bold shadow-sm ${
            isInTodayList
              ? 'border-accent bg-accent text-app'
              : 'border-edge bg-surface text-accent'
          }`}
        >
          <CalendarPlus size={20} aria-hidden />
          {isInTodayList ? `${ja.detail.todayAdded} ✓` : ja.detail.todayAdd}
        </button>

        {/* 材料（人数分の変更で自動換算） */}
        <section className="mt-[var(--space-lg)]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">{ja.detail.ingredients}</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setServingsOverride(Math.max(1, servings - 1))}
                aria-label={ja.detail.servingsDown}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
              >
                <Minus size={22} aria-hidden />
              </button>
              <span className="min-w-14 text-center text-lg font-bold">
                {servings}
                {ja.detail.servingsUnit}
              </span>
              <button
                type="button"
                onClick={() => setServingsOverride(servings + 1)}
                aria-label={ja.detail.servingsUp}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent shadow-sm"
              >
                <Plus size={22} aria-hidden />
              </button>
            </div>
          </div>
          {recipe.ingredients.some((ing) => ing.seasoningGroup) && (
            <p className="mt-1 text-sm text-ink-muted">{ja.detail.seasoningGroupHint}</p>
          )}
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {recipe.ingredients.map((ing, index) => {
              const isNg = ngIndices.has(index)
              return (
                <li
                  key={index}
                  className="px-[var(--space-md)] py-3 text-lg"
                  style={
                    ing.seasoningGroup
                      ? { borderLeft: `4px solid var(${seasoningGroupColorToken(ing.seasoningGroup)})` }
                      : undefined
                  }
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={
                        isNg ? 'inline-flex items-center gap-1 font-bold text-warning' : undefined
                      }
                    >
                      {isNg && <TriangleAlert size={18} aria-label={ja.detail.ngWarning} />}
                      {ing.name}
                    </span>
                    <span className="shrink-0 font-bold">
                      {formatAmountUnit(
                        scaleAmount(ing.amount, recipe.servings, servings, ing.unit),
                        ing.unit,
                      )}
                    </span>
                  </div>
                  {ing.memo && (
                    <MemoText
                      text={ing.memo}
                      className="mt-0.5 text-sm text-ink-muted"
                      onOpenTerm={openTerm}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        {/* 栄養価のめやす（M6-1）: 公開前はティーザー、公開後は未解錠ゲート/実表示(③) */}
        <NutritionTeaser isPro={!!settings?.proCode} recipe={recipe} servings={servings} />

        {/* 手順 */}
        <section className="mt-[var(--space-lg)]">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold">{ja.detail.steps}</h2>
            <div className="shrink-0 text-right">
              <button
                type="button"
                onClick={() => {
                  setFocusStep(0)
                  setFocusOpen(true)
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge px-3 py-2 text-sm font-bold text-accent"
              >
                <Maximize2 size={16} aria-hidden />
                {ja.focus.open}
              </button>
              {/* 初見でも何が起きるボタンか分かるように一言添える(名称自体は変えない) */}
              <p className="mt-0.5 text-xs text-ink-muted">{ja.focus.openHint}</p>
            </div>
          </div>
          {hasQuickVariant && (
            <div className="mt-[var(--space-sm)] inline-flex rounded-sm border border-edge p-0.5">
              <button
                type="button"
                onClick={() => setQuickMode(false)}
                className={`rounded-sm px-3 py-1 text-sm font-bold ${
                  !quickMode ? 'bg-accent text-app' : 'text-ink-muted'
                }`}
              >
                {normalModeLabel}
              </button>
              <button
                type="button"
                onClick={() => setQuickMode(true)}
                className={`rounded-sm px-3 py-1 text-sm font-bold ${
                  quickMode ? 'bg-accent text-app' : 'text-ink-muted'
                }`}
              >
                {quickModeLabel}
              </button>
            </div>
          )}
          <ol className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
            {displaySteps.map((step, index) => {
              const stepNumber = index + 1
              const isHighlighted = highlightStepIndex === index
              // 用語タップ辞書: 同じ手順内(本文+memo)では同じ語は最初の1回だけタップ可能にする
              // memo側の既出用語=手順本文に出た語(純粋導出。共有セットの書き換えはStrictModeで壊れるため廃止)
              const stepTermSeen = new Set(collectUniqueTerms(step.text).map((c) => c.term))
              return (
                <li
                  key={index}
                  ref={(el) => {
                    stepRefs.current[index] = el
                  }}
                  className={`flex gap-3 rounded-md border p-[var(--space-md)] text-lg leading-relaxed shadow-sm transition-colors ${
                    isHighlighted ? 'border-accent bg-accent/10' : 'border-edge bg-surface'
                  }`}
                >
                  <StepBadge number={stepNumber} />
                  <div className="min-w-0 flex-1">
                    {/* 文中の「10分」などはタップでタイマー開始、辞書語はタップで説明 */}
                    <p className="ja-phrase">
                      <TermText
                        text={step.text}
                        onOpenTerm={openTerm}
                        renderPlain={(t) => (
                          <TimeText
                            text={t}
                            onStart={(_tokenText, seconds) =>
                              startTimer({
                                key: `${id}-${index}-${seconds}`,
                                label: recipe.title,
                                doneLabel: deriveDoneLabel(step.text),
                                seconds,
                                recipeId: id,
                                stepNumber,
                              })
                            }
                          />
                        )}
                      />
                    </p>
                    {step.memo && (
                      <MemoText
                        text={step.memo}
                        className="mt-0.5 text-sm text-ink-muted"
                        onOpenTerm={openTerm}
                        seen={stepTermSeen}
                      />
                    )}
                    {step.minutes != null &&
                      step.minutes > 0 &&
                      !isMinutesShownInText(step.text, step.minutes) && (
                      <button
                        type="button"
                        onClick={() =>
                          startTimer({
                            key: `${id}-${index}-${(step.minutes ?? 0) * 60}`,
                            label: recipe.title,
                            doneLabel: deriveDoneLabel(step.text),
                            seconds: (step.minutes ?? 0) * 60,
                            recipeId: id,
                            stepNumber,
                          })
                        }
                        aria-label={ja.timer.start}
                        className="mt-1 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-bold text-accent underline underline-offset-2"
                        style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
                      >
                        <TimerIcon size={14} aria-hidden />
                        {step.minutes}
                        {ja.detail.minutesStandaloneSuffix}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        {/* メモ・参照元 */}
        {recipe.memo && (
          <section className="mt-[var(--space-lg)]">
            <h2 className="text-xl font-bold">{ja.detail.memo}</h2>
            <MemoText
              text={recipe.memo}
              className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
              onOpenTerm={openTerm}
            />
          </section>
        )}
        {recipe.sourceUrl && (
          <p className="mt-[var(--space-md)]">
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent underline"
            >
              <ExternalLink size={16} aria-hidden />
              {ja.detail.source}
            </a>
          </p>
        )}

        {/* 作った記録 */}
        {recipe.cookedLogs.length > 0 && (
          <section className="mt-[var(--space-lg)]">
            <h2 className="text-xl font-bold">
              {ja.detail.cookedLogsTitle}（{recipe.cookedLogs.length}
              {ja.detail.cookedCountSuffix}）
            </h2>
            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
              {recipe.cookedLogs.slice(0, 5).map((log, index) => (
                <li key={index} className="px-[var(--space-md)] py-2">
                  {editingLogIndex === index ? (
                    <div className="space-y-2">
                      <input
                        type="date"
                        value={editingLogDate}
                        onChange={(e) => setEditingLogDate(e.target.value)}
                        className="block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink"
                      />
                      <input
                        type="text"
                        value={editingLogNote}
                        onChange={(e) => setEditingLogNote(e.target.value)}
                        placeholder={ja.detail.cookedLogNotePlaceholder}
                        className="block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void saveEditingLog()}
                          className="flex-1 rounded-sm bg-accent py-2 text-sm font-bold text-app shadow-sm"
                        >
                          {ja.detail.cookedLogSave}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingLogIndex(null)}
                          className="rounded-sm border border-edge px-3 py-2 text-sm text-ink-muted"
                        >
                          {ja.detail.cookedLogCancel}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm text-ink-muted">
                          {log.date.replaceAll('-', '/')}
                        </span>
                        {log.note && <p className="mt-0.5">{log.note}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => openEditLog(index, log.date, log.note)}
                        aria-label={ja.detail.cookedLogEdit}
                        className="shrink-0 rounded-full p-2 text-ink-muted"
                      >
                        <Pencil size={16} aria-hidden />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* シェア（テキスト / 画像カード） */}
        {shareOpen && (
          <div className="mt-[var(--space-lg)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={sharing}
                onClick={() => runShare('text')}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm disabled:opacity-60"
              >
                <MessageSquareText size={20} aria-hidden />
                {ja.share.textOption}
              </button>
              <button
                type="button"
                disabled={sharing}
                onClick={() => runShare('image')}
                className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm disabled:opacity-60"
              >
                <ImageIcon size={20} aria-hidden />
                {ja.share.imageOption}
              </button>
            </div>
            {shareMessage && (
              <p className="mt-[var(--space-sm)] text-sm font-bold text-accent">{shareMessage}</p>
            )}
          </div>
        )}

        {/* 下部の大ボタン: 作った！ / シェア（編集はタイトル付近に移動済み） */}
        <div className="mt-[var(--space-sm)] flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLogDate(todayString())
              setLogOpen(true)
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md"
          >
            <CheckCircle2 size={22} aria-hidden />
            {ja.detail.cooked}
          </button>
          <button
            type="button"
            onClick={() => {
              setShareMessage('')
              setShareOpen((open) => !open)
            }}
            aria-expanded={shareOpen}
            aria-label={ja.share.button}
            className="flex items-center justify-center rounded-md border border-edge bg-surface px-4 py-4 font-bold text-accent shadow-sm"
          >
            <Share2 size={22} aria-hidden />
          </button>
        </div>
      </div>

      {focusOpen && (
        <FocusMode
          recipe={focusRecipe}
          recipeId={id}
          initialStep={focusStep}
          onClose={() => setFocusOpen(false)}
          onComplete={() => {
            // 完成！→ そのまま「作った！」の記録フォームを開く(達成感と記録導線をつなぐ)
            setFocusOpen(false)
            setLogDate(todayString())
            setLogOpen(true)
          }}
        />
      )}
      <TermPopover state={termPopoverState} onClose={closeTermPopover} />
      <CookedLogModal
        open={logOpen}
        date={logDate}
        note={logNote}
        onDateChange={setLogDate}
        onNoteChange={setLogNote}
        onSave={saveLog}
        onClose={() => setLogOpen(false)}
      />
    </div>
  )
}
