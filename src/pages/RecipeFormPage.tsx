import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Camera,
  Image as ImageIcon,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import type { EffortLevel, RecipeInput } from '../db/types'
import { createRecipe, deleteRecipe, getRecipe, updateRecipe } from '../db/recipes'
import { resizePhoto } from '../logic/image'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { ja } from '../i18n/ja'

/* フォーム内部で扱う行の形（入力中は数値も文字列で持つ） */
type IngredientRow = { name: string; amount: string; unit: string; price: string }
type StepRow = { text: string; minutes: string }

const emptyIngredient: IngredientRow = { name: '', amount: '', unit: '', price: '' }
const emptyStep: StepRow = { text: '', minutes: '' }

const effortLevels: EffortLevel[] = ['easy', 'normal', 'fancy']

const inputCls =
  'mt-1 block w-full rounded-sm border border-edge bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-muted/60'
const labelCls = 'block text-sm font-bold text-ink-muted'
const iconBtnCls =
  'flex h-10 w-10 items-center justify-center rounded-sm border border-edge bg-surface text-ink-muted'

/** 配列の要素を上下に入れ替える */
function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/** レシピ登録・編集画面（/recipes/new と /recipes/:id/edit の両方で使う） */
export default function RecipeFormPage() {
  const params = useParams()
  const navigate = useNavigate()
  const editId = params.id ? Number(params.id) : undefined
  const isEdit = editId !== undefined

  const [title, setTitle] = useState('')
  const [photo, setPhoto] = useState<Blob>()
  const [servings, setServings] = useState(2)
  const [cookMinutes, setCookMinutes] = useState('')
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('normal')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...emptyIngredient }])
  const [steps, setSteps] = useState<StepRow[]>([{ ...emptyStep }])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [memo, setMemo] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const photoUrl = usePhotoUrl(photo)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  // 編集モード: 既存レシピを読み込んでフォームに反映
  useEffect(() => {
    if (editId === undefined || Number.isNaN(editId)) return
    let cancelled = false
    getRecipe(editId).then((recipe) => {
      if (!recipe || cancelled) return
      setTitle(recipe.title)
      setPhoto(recipe.photo)
      setServings(recipe.servings)
      setCookMinutes(recipe.cookMinutes != null ? String(recipe.cookMinutes) : '')
      setEffortLevel(recipe.effortLevel)
      setIngredients(
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((i) => ({
              name: i.name,
              amount: i.amount,
              unit: i.unit,
              price: i.price != null ? String(i.price) : '',
            }))
          : [{ ...emptyIngredient }],
      )
      setSteps(
        recipe.steps.length > 0
          ? recipe.steps.map((s) => ({
              text: s.text,
              minutes: s.minutes != null ? String(s.minutes) : '',
            }))
          : [{ ...emptyStep }],
      )
      setTags(recipe.tags)
      setMemo(recipe.memo ?? '')
      setSourceUrl(recipe.sourceUrl ?? '')
    })
    return () => {
      cancelled = true
    }
  }, [editId])

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhoto(await resizePhoto(file))
      setError('')
    } catch {
      setError(ja.form.photoError)
    }
  }

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) => {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  const updateStep = (index: number, patch: Partial<StepRow>) => {
    setSteps((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const save = async () => {
    if (!title.trim()) {
      setError(ja.form.nameRequired)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      const input: RecipeInput = {
        title,
        photo,
        servings,
        cookMinutes: cookMinutes.trim() ? Number(cookMinutes) : undefined,
        effortLevel,
        tags,
        ingredients: ingredients.map((row) => ({
          name: row.name,
          amount: row.amount.trim(),
          unit: row.unit.trim(),
          price: row.price.trim() ? Number(row.price) : undefined,
        })),
        steps: steps.map((row) => ({
          text: row.text,
          minutes: row.minutes.trim() ? Number(row.minutes) : undefined,
        })),
        sourceUrl: sourceUrl.trim() || undefined,
        memo: memo.trim() || undefined,
      }
      let id = editId
      if (isEdit && editId !== undefined) {
        await updateRecipe(editId, input)
      } else {
        id = await createRecipe(input)
      }
      navigate(`/recipes/${id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (editId === undefined) return
    if (!window.confirm(ja.form.confirmDelete)) return
    await deleteRecipe(editId)
    navigate('/recipes', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{isEdit ? ja.form.editTitle : ja.form.newTitle}</h1>

      {error && (
        <p className="mt-[var(--space-sm)] rounded-sm border border-warning px-3 py-2 font-bold text-warning">
          {error}
        </p>
      )}

      {/* 料理名 */}
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
        {ja.form.nameLabel}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={ja.form.namePlaceholder}
          className={inputCls}
        />
      </label>

      {/* 写真（カメラ / アルバム） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.photoLabel}</span>
        {photoUrl && (
          <img
            src={photoUrl}
            alt={title || ja.form.photoLabel}
            className="mt-1 aspect-video w-full rounded-md object-cover shadow-sm"
          />
        )}
        <div className="mt-2 flex gap-2">
          {/* capture="environment" 付き → スマホでカメラが直接開く */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPhotoSelected(e.target.files?.[0])}
          />
          <input
            ref={albumInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPhotoSelected(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold shadow-sm"
          >
            <Camera size={20} className="text-accent" aria-hidden />
            {ja.form.photoTake}
          </button>
          <button
            type="button"
            onClick={() => albumInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold shadow-sm"
          >
            <ImageIcon size={20} className="text-accent" aria-hidden />
            {ja.form.photoPick}
          </button>
        </div>
        {photo && (
          <button
            type="button"
            onClick={() => setPhoto(undefined)}
            className="mt-2 text-sm text-warning underline"
          >
            {ja.form.photoRemove}
          </button>
        )}
      </div>

      {/* 人数分・調理時間 */}
      <div className="mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)]">
        <label className={labelCls}>
          {ja.form.servingsLabel}
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setServings((n) => Math.max(1, n - 1))}
              className={iconBtnCls}
              aria-label={ja.detail.servingsDown}
            >
              −
            </button>
            <span className="min-w-14 text-center text-lg font-bold text-ink">
              {servings}
              {ja.form.servingsUnit}
            </span>
            <button
              type="button"
              onClick={() => setServings((n) => n + 1)}
              className={iconBtnCls}
              aria-label={ja.detail.servingsUp}
            >
              ＋
            </button>
          </div>
        </label>
        <label className={labelCls}>
          {ja.form.cookMinutesLabel}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={cookMinutes}
            onChange={(e) => setCookMinutes(e.target.value)}
            placeholder={ja.form.cookMinutesPlaceholder}
            className={inputCls}
          />
        </label>
      </div>

      {/* 手間レベル（3段階） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.effortLabel}</span>
        <div className="mt-1 grid grid-cols-3 gap-[var(--space-sm)]">
          {effortLevels.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setEffortLevel(level)}
              className={`rounded-md border py-3 font-bold shadow-sm ${
                effortLevel === level
                  ? 'border-accent bg-accent text-app'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.effort[level]}
            </button>
          ))}
        </div>
      </div>

      {/* 材料（追加・削除・並べ替え） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.ingredientsLabel}</span>
        <div className="mt-1 space-y-[var(--space-sm)]">
          {ingredients.map((row, index) => (
            <div
              key={index}
              className="rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
            >
              <div className="flex gap-[var(--space-sm)]">
                <input
                  type="text"
                  value={row.name}
                  onChange={(e) => updateIngredient(index, { name: e.target.value })}
                  placeholder={ja.form.ingredientNamePlaceholder}
                  aria-label={ja.form.ingredientName}
                  className="min-w-0 flex-[2] rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
                <input
                  type="text"
                  value={row.amount}
                  onChange={(e) => updateIngredient(index, { amount: e.target.value })}
                  placeholder={ja.form.ingredientAmountPlaceholder}
                  aria-label={ja.form.ingredientAmount}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                  placeholder={ja.form.ingredientUnitPlaceholder}
                  aria-label={ja.form.ingredientUnit}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
              </div>
              <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-sm)]">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.price}
                  onChange={(e) => updateIngredient(index, { price: e.target.value })}
                  placeholder={ja.form.ingredientPricePlaceholder}
                  aria-label={ja.form.ingredientPrice}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
                />
                <button
                  type="button"
                  onClick={() => setIngredients((rows) => move(rows, index, index - 1))}
                  aria-label={ja.form.moveUp}
                  className={iconBtnCls}
                >
                  <ChevronUp size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setIngredients((rows) => move(rows, index, index + 1))}
                  aria-label={ja.form.moveDown}
                  className={iconBtnCls}
                >
                  <ChevronDown size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setIngredients((rows) =>
                      rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ ...emptyIngredient }],
                    )
                  }
                  aria-label={ja.form.removeRow}
                  className={`${iconBtnCls} text-warning`}
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIngredients((rows) => [...rows, { ...emptyIngredient }])}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-edge py-3 font-bold text-accent"
        >
          <Plus size={18} aria-hidden />
          {ja.form.addIngredient}
        </button>
      </div>

      {/* 手順（追加・削除・並べ替え） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.stepsLabel}</span>
        <div className="mt-1 space-y-[var(--space-sm)]">
          {steps.map((row, index) => (
            <div
              key={index}
              className="rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
            >
              <div className="flex gap-[var(--space-sm)]">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-app">
                  {index + 1}
                </span>
                <textarea
                  value={row.text}
                  onChange={(e) => updateStep(index, { text: e.target.value })}
                  placeholder={ja.form.stepTextPlaceholder}
                  rows={2}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
                />
              </div>
              <div className="mt-[var(--space-sm)] flex items-center gap-[var(--space-sm)]">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={row.minutes}
                  onChange={(e) => updateStep(index, { minutes: e.target.value })}
                  placeholder={ja.form.stepMinutesPlaceholder}
                  aria-label={ja.form.stepMinutes}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
                />
                <span className="text-sm text-ink-muted">{ja.form.stepMinutes}</span>
                <button
                  type="button"
                  onClick={() => setSteps((rows) => move(rows, index, index - 1))}
                  aria-label={ja.form.moveUp}
                  className={iconBtnCls}
                >
                  <ChevronUp size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setSteps((rows) => move(rows, index, index + 1))}
                  aria-label={ja.form.moveDown}
                  className={iconBtnCls}
                >
                  <ChevronDown size={20} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSteps((rows) =>
                      rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ ...emptyStep }],
                    )
                  }
                  aria-label={ja.form.removeRow}
                  className={`${iconBtnCls} text-warning`}
                >
                  <X size={20} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSteps((rows) => [...rows, { ...emptyStep }])}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-edge py-3 font-bold text-accent"
        >
          <Plus size={18} aria-hidden />
          {ja.form.addStep}
        </button>
      </div>

      {/* タグ（自由追加） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.tagsLabel}</span>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm text-accent"
                style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  aria-label={ja.form.removeTag}
                >
                  <X size={14} aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 flex gap-[var(--space-sm)]">
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder={ja.form.tagPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-edge bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
          />
          <button
            type="button"
            onClick={addTag}
            className="rounded-sm border border-edge bg-surface px-4 font-bold text-accent shadow-sm"
          >
            {ja.form.addTag}
          </button>
        </div>
      </div>

      {/* メモ・参照元URL */}
      <label className={`mt-[var(--space-lg)] ${labelCls}`}>
        {ja.form.memoLabel}
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={ja.form.memoPlaceholder}
          rows={3}
          className={inputCls}
        />
      </label>
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
        {ja.form.sourceUrlLabel}
        <input
          type="url"
          inputMode="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder={ja.form.sourceUrlPlaceholder}
          className={inputCls}
        />
      </label>

      {/* 保存・キャンセル */}
      <div className="mt-[var(--space-lg)] flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-md bg-accent py-4 text-lg font-bold text-app shadow-md disabled:opacity-60"
        >
          {saving ? ja.form.saving : ja.form.save}
        </button>
        <Link
          to={isEdit ? `/recipes/${editId}` : '/recipes'}
          className="flex items-center rounded-md border border-edge bg-surface px-5 py-4 text-ink-muted shadow-sm"
        >
          {ja.form.cancel}
        </Link>
      </div>

      {/* 削除（編集時のみ） */}
      {isEdit && (
        <button
          type="button"
          onClick={remove}
          className="mt-[var(--space-lg)] flex w-full items-center justify-center gap-2 rounded-md border border-warning py-3 font-bold text-warning"
        >
          <Trash2 size={18} aria-hidden />
          {ja.form.deleteRecipe}
        </button>
      )}
    </div>
  )
}
