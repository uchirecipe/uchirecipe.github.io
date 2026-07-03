import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Heart,
  Clock,
  Minus,
  Plus,
  Pencil,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { db } from '../db/db'
import { addCookedLog, toggleFavorite } from '../db/recipes'
import { scaleAmount } from '../logic/amount'
import { usePhotoUrl } from '../components/usePhotoUrl'
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

  // undefined = 読み込み中 / null = 該当レシピなし、を区別する
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id])
  const photoUrl = usePhotoUrl(recipe?.photo)

  // 人数分の表示用（変更していない間はレシピ登録時の人数）
  const [servingsOverride, setServingsOverride] = useState<number>()
  const servings = servingsOverride ?? recipe?.servings ?? 1

  // 「作った！」記録の入力欄
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayString)
  const [logNote, setLogNote] = useState('')

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

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      {/* 写真 */}
      {photoUrl && (
        <img src={photoUrl} alt={recipe.title} className="aspect-video w-full object-cover" />
      )}

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        {/* タイトル行＋お気に入り */}
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold leading-snug">{recipe.title}</h1>
          <button
            type="button"
            onClick={() => toggleFavorite(id)}
            aria-label={recipe.isFavorite ? ja.detail.favoriteOff : ja.detail.favoriteOn}
            className="rounded-full p-3 text-accent"
          >
            <Heart size={28} fill={recipe.isFavorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
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
          {totalPrice > 0 && (
            <span>
              {ja.detail.priceAbout}
              {scaledPrice.toLocaleString()}
              {ja.detail.priceYen}
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
            {recipe.ingredients.map((ing, index) => (
              <li key={index} className="flex items-baseline justify-between gap-2 px-[var(--space-md)] py-3 text-lg">
                <span>{ing.name}</span>
                <span className="shrink-0 font-bold">
                  {scaleAmount(ing.amount, recipe.servings, servings)}
                  {ing.unit}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 手順 */}
        <section className="mt-[var(--space-lg)]">
          <h2 className="text-xl font-bold">{ja.detail.steps}</h2>
          <ol className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
            {recipe.steps.map((step, index) => (
              <li
                key={index}
                className="flex gap-3 rounded-md border border-edge bg-surface p-[var(--space-md)] text-lg leading-relaxed shadow-sm"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-app">
                  {index + 1}
                </span>
                <div>
                  <p>{step.text}</p>
                  {step.minutes != null && step.minutes > 0 && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-sm border border-edge px-2 py-0.5 text-sm text-ink-muted">
                      <Clock size={14} aria-hidden />
                      {step.minutes}
                      {ja.detail.minutesSuffix}
                    </span>
                  )}
                </div>
              </li>
            ))}
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

        {/* 下部の大ボタン: 作った！ / 編集 */}
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
          <Link
            to={`/recipes/${id}/edit`}
            className="flex items-center justify-center gap-2 rounded-md border border-edge bg-surface px-5 py-4 font-bold text-ink shadow-sm"
          >
            <Pencil size={20} aria-hidden />
            {ja.detail.edit}
          </Link>
        </div>
      </div>
    </div>
  )
}
