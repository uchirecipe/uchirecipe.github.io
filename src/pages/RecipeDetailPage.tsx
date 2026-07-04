import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
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
} from 'lucide-react'
import { db } from '../db/db'
import { addCookedLog, toggleFavorite } from '../db/recipes'
import { useSettings } from '../db/settings'
import { scaleAmount } from '../logic/amount'
import { ngMatchedIndices } from '../logic/ng'
import { shareText, shareImageCard } from '../logic/share'
import { deriveDoneLabel } from '../logic/timerLabel'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { useTimers } from '../components/TimerProvider'
import BackHeader from '../components/BackHeader'
import FocusMode from '../components/FocusMode'
import { RecipePlaceholder, seasonIcons } from '../components/RecipeCard'
import TimeText from '../components/TimeText'
import { ja } from '../i18n/ja'

function todayString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** レシピ詳細＝料理中に見るメイン画面。文字・ボタンは大きめ */
export default function RecipeDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [searchParams, setSearchParams] = useSearchParams()

  // undefined = 読み込み中 / null = 該当レシピなし、を区別する
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id])
  const photoUrl = usePhotoUrl(recipe?.photo)
  const settings = useSettings()
  const { startTimer } = useTimers()

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

  // 「画面を暗くしない」設定がオンなら、この画面を開いている間だけ
  // 画面の自動消灯を防ぐ（Wake Lock API。非対応ブラウザでは何もしない）
  const keepScreenOn = settings?.keepScreenOn ?? false
  useEffect(() => {
    if (!keepScreenOn || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        /* 非対応・省電力モードなどで失敗したら静かに無視 */
      }
    }
    // 他アプリから戻ってきたときに取得し直す
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) void acquire()
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [keepScreenOn])

  // 人数分の表示用（変更していない間はレシピ登録時の人数）
  const [servingsOverride, setServingsOverride] = useState<number>()
  const servings = servingsOverride ?? recipe?.servings ?? 1

  // 「作った！」記録の入力欄
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayString)
  const [logNote, setLogNote] = useState('')

  // シェア
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [sharing, setSharing] = useState(false)

  // フォーカスモード（1手順ずつ大きく表示）
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusStep, setFocusStep] = useState(0)

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
    setLogOpen(false)
    setLogNote('')
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

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader fallback="/recipes" />

      {/* 写真（無い場合・アイコン優先の場合はプレースホルダー） */}
      {showPhoto ? (
        <img src={photoUrl} alt={recipe.title} className="aspect-video w-full object-cover" />
      ) : (
        <div className="aspect-video w-full">
          <RecipePlaceholder recipe={recipe} iconSize={56} />
        </div>
      )}

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        {/* タイトル行＋編集・お気に入り（編集ボタンはタイトル付近＝一番上のエリアに配置） */}
        <div className="flex items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 text-2xl font-bold leading-snug">{recipe.title}</h1>
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
              <Heart size={28} fill={recipe.isFavorite ? 'currentColor' : 'none'} aria-hidden />
            </button>
          </div>
        </div>

        {/* 時間・手間・概算価格 */}
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-ink-muted">
          {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock size={16} aria-hidden />
              {recipe.cookMinutes}
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
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {recipe.ingredients.map((ing, index) => {
              const isNg = ngIndices.has(index)
              return (
                <li key={index} className="px-[var(--space-md)] py-3 text-lg">
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
                      {scaleAmount(ing.amount, recipe.servings, servings)}
                      {ing.unit}
                    </span>
                  </div>
                  {ing.memo && <p className="mt-0.5 text-sm text-ink-muted">{ing.memo}</p>}
                </li>
              )
            })}
          </ul>
        </section>

        {/* 手順 */}
        <section className="mt-[var(--space-lg)]">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{ja.detail.steps}</h2>
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
          </div>
          <ol className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
            {recipe.steps.map((step, index) => {
              const stepNumber = index + 1
              const isHighlighted = highlightStepIndex === index
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
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-app">
                    {stepNumber}
                  </span>
                  <div>
                    {/* 文中の「10分」などはタップでタイマー開始 */}
                    <p>
                      <TimeText
                        text={step.text}
                        onStart={(_tokenText, seconds) =>
                          startTimer({
                            key: `${id}-${index}-${seconds}`,
                            label: `${recipe.title}・${ja.timer.stepLabel.replace('{n}', String(stepNumber))}`,
                            doneLabel: deriveDoneLabel(step.text),
                            seconds,
                            recipeId: id,
                            stepNumber,
                          })
                        }
                      />
                    </p>
                    {step.memo && <p className="mt-0.5 text-sm text-ink-muted">{step.memo}</p>}
                    {step.minutes != null && step.minutes > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          startTimer({
                            key: `${id}-${index}-${(step.minutes ?? 0) * 60}`,
                            label: `${recipe.title}・${ja.timer.stepLabel.replace('{n}', String(stepNumber))}`,
                            doneLabel: deriveDoneLabel(step.text),
                            seconds: (step.minutes ?? 0) * 60,
                            recipeId: id,
                            stepNumber,
                          })
                        }
                        aria-label={ja.timer.start}
                        className="mt-1 inline-flex items-center gap-1 rounded-sm border border-edge px-2 py-1 text-sm font-bold text-accent"
                      >
                        <TimerIcon size={14} aria-hidden />
                        {step.minutes}
                        {ja.detail.minutesSuffix}
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
            <p className="mt-[var(--space-sm)] whitespace-pre-wrap rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
              {recipe.memo}
            </p>
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
                  <span className="text-sm text-ink-muted">{log.date.replaceAll('-', '/')}</span>
                  {log.note && <p className="mt-0.5">{log.note}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 記録の入力欄（「作った！」を押すと開く） */}
        {logOpen && (
          <div className="mt-[var(--space-lg)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md">
            <h3 className="font-bold">{ja.detail.cookedDialogTitle}</h3>
            <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
              {ja.detail.cookedDate}
              <input
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="mt-1 block w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink"
              />
            </label>
            <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
              {ja.detail.cookedNote}
              <input
                type="text"
                value={logNote}
                onChange={(e) => setLogNote(e.target.value)}
                placeholder={ja.detail.cookedNotePlaceholder}
                className="mt-1 block w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink"
              />
            </label>
            <div className="mt-[var(--space-md)] flex gap-2">
              <button
                type="button"
                onClick={saveLog}
                className="flex-1 rounded-md bg-accent py-3 text-lg font-bold text-app shadow-sm"
              >
                {ja.detail.cookedSave}
              </button>
              <button
                type="button"
                onClick={() => setLogOpen(false)}
                className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted"
              >
                {ja.detail.cookedCancel}
              </button>
            </div>
          </div>
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
        <div className="mt-[var(--space-lg)] flex gap-2">
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
          recipe={recipe}
          recipeId={id}
          initialStep={focusStep}
          onClose={() => setFocusOpen(false)}
        />
      )}
    </div>
  )
}
