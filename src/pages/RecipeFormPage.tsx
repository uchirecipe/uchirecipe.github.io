import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Camera,
  Image as ImageIcon,
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  ClipboardPaste,
} from 'lucide-react'
import type { EffortLevel, IconKey, MealSlot, RecipeInput, Season } from '../db/types'
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from '../db/recipes'
import { useSettings } from '../db/settings'
import { countFreeLimitRecipes, isAtFreeLimit } from '../logic/freeLimit'
import { resizePhoto } from '../logic/image'
import { parseRecipeText, autoSplitAmountUnit } from '../logic/parseRecipeText'
import { pickIconKey, iconKeyOrder } from '../logic/icon'
import { nextSeasoningGroup, seasoningGroupColorToken } from '../logic/seasoningGroup'
import { normalizeDigits } from '../logic/amount'
import { usePhotoUrl } from '../components/usePhotoUrl'
import BackHeader from '../components/BackHeader'
import { iconComponents } from '../components/RecipeCard'
import { ja } from '../i18n/ja'

/* フォーム内部で扱う行の形（入力中は数値も文字列で持つ） */
type IngredientRow = {
  name: string
  amount: string
  unit: string
  price: string
  memo: string
  group: number | undefined
}
type StepRow = { text: string; minutes: string; memo: string }

const emptyIngredient: IngredientRow = {
  name: '',
  amount: '',
  unit: '',
  price: '',
  memo: '',
  group: undefined,
}
const emptyStep: StepRow = { text: '', minutes: '', memo: '' }

/**
 * 入力途中の内容をsessionStorageに自動保存する下書きの形。
 * 写真(Blob)はサイズが大きくJSON化できないため下書きには含めない。
 */
type FormDraft = {
  title: string
  servings: number
  cookMinutes: string
  effortLevel: EffortLevel
  ingredients: IngredientRow[]
  steps: StepRow[]
  tags: string[]
  tagInput: string
  memo: string
  sourceUrl: string
  iconKey?: IconKey
  showIconInsteadOfPhoto: boolean
  season?: Season
  suitableFor: MealSlot[]
}

/** 新規と編集で下書きを分ける(編集はレシピごとに分ける) */
function draftStorageKey(editId: number | undefined): string {
  return editId !== undefined ? `uchirecipe:draft:edit:${editId}` : 'uchirecipe:draft:new'
}

function readDraft(key: string): FormDraft | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FormDraft
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

const effortLevels: EffortLevel[] = ['easy', 'normal', 'fancy']
const seasons: Exclude<Season, 'all'>[] = ['spring', 'summer', 'autumn', 'winter']
const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner']

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

/**
 * レシピ登録・編集画面（/recipes/new と /recipes/:id/edit の両方で使う）。
 * 新規⇄編集を直接行き来してもReactが同じ画面を使い回さないよう、
 * レシピIDをkeyにして毎回まっさらに作り直す（使い回されると、
 * 入力欄の中身や下書きの読み込みが前のページのまま残ってしまう）
 */
export default function RecipeFormPage() {
  const params = useParams()
  return <RecipeFormInner key={params.id ?? 'new'} />
}

function RecipeFormInner() {
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
  const [iconKey, setIconKey] = useState<IconKey>()
  const [showIconInsteadOfPhoto, setShowIconInsteadOfPhoto] = useState(false)
  const [season, setSeason] = useState<Season>()
  const [suitableFor, setSuitableFor] = useState<MealSlot[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // テキスト貼り付けで自動入力
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')

  const photoUrl = usePhotoUrl(photo)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  // ---- 入力の全損防止: 下書きの自動保存と復元 ----
  const draftKey = draftStorageKey(editId)
  // 開いた時点で残っていた下書き(復元するか破棄するかをユーザーが選ぶまで保持)
  const [pendingDraft, setPendingDraft] = useState<FormDraft | null>(() => readDraft(draftKey))
  // 「変更なし」とみなす基準のスナップショット(新規=空フォーム、編集=読み込んだレシピ)
  const baselineRef = useRef<string | null>(null)
  // 下書きを復元した場合、あとから届く既存レシピの読み込みで上書きしない(写真だけ引き継ぐ)
  const draftRestoredRef = useRef(false)

  // 編集モード: 既存レシピを読み込んでフォームに反映。
  // useLiveQueryで反応的に取得することで、アプリ起動直後の基本レシピ投入
  // (非同期)がまだ終わっていないタイミングでこの画面を直接開いても、
  // 投入完了後に自動で正しく読み込まれる（以前は読み込みが一度きりで、
  // 投入前に空振りすると空欄のまま固まる不具合があった）
  const loadedRecipe = useLiveQuery(
    () => (editId !== undefined && !Number.isNaN(editId) ? getRecipe(editId) : undefined),
    [editId],
  )
  const settings = useSettings()
  const allRecipes = useLiveQuery(listRecipes, [])
  const hydratedRef = useRef(false)
  useEffect(() => {
    const recipe = loadedRecipe
    if (!recipe || hydratedRef.current) return
    hydratedRef.current = true
    if (draftRestoredRef.current) {
      // 下書きを先に復元済み: フォームは下書きの内容を優先し、
      // 下書きに含まれない写真だけ既存レシピから引き継ぐ
      setPhoto(recipe.photo)
      return
    }
    baselineRef.current = JSON.stringify({
      title: recipe.title,
      servings: recipe.servings,
      cookMinutes: recipe.cookMinutes != null ? String(recipe.cookMinutes) : '',
      effortLevel: recipe.effortLevel,
      ingredients:
        recipe.ingredients.length > 0
          ? recipe.ingredients.map((i) => ({
              name: i.name,
              amount: i.amount,
              unit: i.unit,
              price: i.price != null ? String(i.price) : '',
              memo: i.memo ?? '',
              group: i.seasoningGroup,
            }))
          : [{ ...emptyIngredient }],
      steps:
        recipe.steps.length > 0
          ? recipe.steps.map((s) => ({
              text: s.text,
              minutes: s.minutes != null ? String(s.minutes) : '',
              memo: s.memo ?? '',
            }))
          : [{ ...emptyStep }],
      tags: recipe.tags,
      tagInput: '',
      memo: recipe.memo ?? '',
      sourceUrl: recipe.sourceUrl ?? '',
      iconKey: recipe.iconKey,
      showIconInsteadOfPhoto: recipe.showIconInsteadOfPhoto ?? false,
      season: recipe.season,
      suitableFor: recipe.suitableFor ?? [],
    } satisfies FormDraft)
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
            memo: i.memo ?? '',
            group: i.seasoningGroup,
          }))
        : [{ ...emptyIngredient }],
    )
    setSteps(
      recipe.steps.length > 0
        ? recipe.steps.map((s) => ({
            text: s.text,
            minutes: s.minutes != null ? String(s.minutes) : '',
            memo: s.memo ?? '',
          }))
        : [{ ...emptyStep }],
    )
    setTags(recipe.tags)
    setMemo(recipe.memo ?? '')
    setSourceUrl(recipe.sourceUrl ?? '')
    setIconKey(recipe.iconKey)
    setShowIconInsteadOfPhoto(recipe.showIconInsteadOfPhoto ?? false)
    setSeason(recipe.season)
    setSuitableFor(recipe.suitableFor ?? [])
  }, [loadedRecipe])

  // 現在の入力内容(下書きに保存する形)。1文字変わるたびに再計算される
  const currentSerialized = useMemo(
    () =>
      JSON.stringify({
        title,
        servings,
        cookMinutes,
        effortLevel,
        ingredients,
        steps,
        tags,
        tagInput,
        memo,
        sourceUrl,
        iconKey,
        showIconInsteadOfPhoto,
        season,
        suitableFor,
      } satisfies FormDraft),
    [
      title,
      servings,
      cookMinutes,
      effortLevel,
      ingredients,
      steps,
      tags,
      tagInput,
      memo,
      sourceUrl,
      iconKey,
      showIconInsteadOfPhoto,
      season,
      suitableFor,
    ],
  )

  // 新規登録は「空フォーム」が基準(これと同じ内容なら未入力=保存しない)
  useEffect(() => {
    if (!isEdit) baselineRef.current = currentSerialized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 入力が変わるたびに下書きを自動保存する(基準と同じ内容なら消す)
  useEffect(() => {
    if (pendingDraft) return // 復元するか決める前に、残っている下書きを上書きしない
    if (baselineRef.current === null) return
    try {
      if (currentSerialized === baselineRef.current) {
        sessionStorage.removeItem(draftKey)
      } else {
        sessionStorage.setItem(draftKey, currentSerialized)
      }
    } catch {
      /* 保存領域の容量超過などは黙って諦める(入力自体は失われない) */
    }
  }, [currentSerialized, pendingDraft, draftKey])

  // ブラウザを閉じる・再読み込みするとき、未保存の入力があれば標準の確認を出す
  const dirtyRef = useRef(false)
  dirtyRef.current =
    pendingDraft === null &&
    baselineRef.current !== null &&
    currentSerialized !== baselineRef.current
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  /** 下書きをフォームに反映する(写真は下書きに含まれないため、編集では既存レシピの写真を引き継ぐ) */
  const restoreDraft = () => {
    const d = pendingDraft
    if (!d) return
    draftRestoredRef.current = true
    setTitle(d.title ?? '')
    setServings(d.servings ?? 2)
    setCookMinutes(d.cookMinutes ?? '')
    setEffortLevel(d.effortLevel ?? 'normal')
    setIngredients(d.ingredients?.length ? d.ingredients : [{ ...emptyIngredient }])
    setSteps(d.steps?.length ? d.steps : [{ ...emptyStep }])
    setTags(d.tags ?? [])
    setTagInput(d.tagInput ?? '')
    setMemo(d.memo ?? '')
    setSourceUrl(d.sourceUrl ?? '')
    setIconKey(d.iconKey)
    setShowIconInsteadOfPhoto(d.showIconInsteadOfPhoto ?? false)
    setSeason(d.season)
    setSuitableFor(d.suitableFor ?? [])
    setPendingDraft(null)
  }

  const discardDraft = () => {
    try {
      sessionStorage.removeItem(draftKey)
    } catch {
      /* 無視 */
    }
    setPendingDraft(null)
  }

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(draftKey)
    } catch {
      /* 無視 */
    }
  }

  /** 貼り付けた文章を解析してフォームに流し込む（結果はユーザーが修正できる） */
  const applyPaste = () => {
    if (!pasteText.trim()) {
      setPasteMessage(ja.paste.empty)
      return
    }
    const parsed = parseRecipeText(pasteText)
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      setPasteMessage(ja.paste.resultNone)
      return
    }
    if (parsed.title && !title.trim()) setTitle(parsed.title)
    if (parsed.servings) setServings(parsed.servings)
    if (parsed.ingredients.length > 0) {
      setIngredients(
        parsed.ingredients.map((row) => ({
          name: row.name,
          amount: row.amount,
          unit: row.unit,
          price: '',
          // 「1枚（250g）」の括弧書きは材料メモ欄へ
          memo: row.memo ?? '',
          group: undefined,
        })),
      )
    }
    if (parsed.steps.length > 0) {
      setSteps(parsed.steps.map((text) => ({ text, minutes: '', memo: '' })))
    }
    // 「コツ」「ポイント」「メモ」見出し以降の文章は、メモ欄が空ならそこへ流し込む
    if (parsed.memo && !memo.trim()) setMemo(parsed.memo)
    setPasteMessage(
      ja.paste.resultSummary
        .replace('{i}', String(parsed.ingredients.length))
        .replace('{s}', String(parsed.steps.length)),
    )
  }

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
    if (!isEdit && isAtFreeLimit(countFreeLimitRecipes(allRecipes ?? []), !!settings?.proCode)) {
      setError(ja.form.freeLimitBlocked)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      // タグ欄に入力したまま「追加」を押し忘れていても、保存時に取り込む
      // （押し忘れたら無言でタグが消えるのは実質的なデータロス扱いのため）
      const pendingTag = tagInput.trim()
      const effectiveTags =
        pendingTag && !tags.includes(pendingTag) ? [...tags, pendingTag] : tags

      const input: RecipeInput = {
        title,
        photo,
        servings,
        cookMinutes: cookMinutes.trim() ? Number(cookMinutes) : undefined,
        effortLevel,
        tags: effectiveTags,
        ingredients: ingredients.map((row) => {
          // 単位欄が空のまま分量欄に「大さじ3」等と書かれていたら自動で分ける
          // (そのままだと人数変更が効かないため。「少々」「適量」はそのまま)。
          // 「1枚（250g）」の括弧書きは消さずに材料メモへ移す
          const split = autoSplitAmountUnit(normalizeDigits(row.amount.trim()), row.unit)
          const memoText = [row.memo.trim(), split.memo].filter(Boolean).join('・')
          return {
            name: row.name,
            amount: split.amount,
            unit: split.unit,
            price: row.price.trim() ? Number(row.price) : undefined,
            memo: memoText || undefined,
            seasoningGroup: row.group,
          }
        }),
        steps: steps.map((row) => ({
          text: row.text,
          minutes: row.minutes.trim() ? Number(row.minutes) : undefined,
          memo: row.memo.trim() || undefined,
        })),
        sourceUrl: sourceUrl.trim() || undefined,
        memo: memo.trim() || undefined,
        iconKey,
        showIconInsteadOfPhoto,
        season,
        suitableFor: suitableFor.length > 0 ? suitableFor : undefined,
      }
      let id = editId
      if (isEdit && editId !== undefined) {
        await updateRecipe(editId, input)
      } else {
        id = await createRecipe(input)
      }
      // 保存に成功したら下書きは不要(残すと次回また「復元しますか？」が出てしまう)
      clearDraft()
      dirtyRef.current = false
      navigate(`/recipes/${id}`, { replace: true })
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (editId === undefined) return
    if (!window.confirm(ja.form.confirmDelete)) return
    await deleteRecipe(editId)
    clearDraft()
    dirtyRef.current = false
    navigate('/recipes', { replace: true })
  }

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader fallback={isEdit && editId !== undefined ? `/recipes/${editId}` : '/recipes'} />
      <div className="px-[var(--space-md)]">
      <h1 className="text-2xl font-bold">{isEdit ? ja.form.editTitle : ja.form.newTitle}</h1>

      {error && (
        <p className="mt-[var(--space-sm)] rounded-sm border border-warning px-3 py-2 font-bold text-warning">
          {error}
        </p>
      )}

      {/* 書きかけの下書きがあれば復元を提案(誤操作による入力全損の防止) */}
      {pendingDraft && (
        <div className="mt-[var(--space-sm)] rounded-md border border-accent bg-surface p-[var(--space-md)] shadow-sm">
          <p className="font-bold text-ink">{ja.form.draftFound}</p>
          <div className="mt-[var(--space-sm)] flex gap-2">
            <button
              type="button"
              onClick={restoreDraft}
              className="flex-1 rounded-md bg-accent py-3 font-bold text-app shadow-sm"
            >
              {ja.form.draftRestore}
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted"
            >
              {ja.form.draftDiscard}
            </button>
          </div>
        </div>
      )}

      {/* テキスト貼り付けで自動入力 */}
      <button
        type="button"
        onClick={() => setPasteOpen((open) => !open)}
        aria-expanded={pasteOpen}
        className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent py-3 font-bold text-accent"
      >
        <ClipboardPaste size={20} aria-hidden />
        {ja.paste.open}
      </button>
      {pasteOpen && (
        <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <p className="text-sm text-ink-muted">{ja.paste.description}</p>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={ja.paste.placeholder}
            rows={6}
            className="mt-[var(--space-sm)] block w-full rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
          />
          {pasteMessage && (
            <p className="mt-[var(--space-sm)] text-sm font-bold text-accent">{pasteMessage}</p>
          )}
          <div className="mt-[var(--space-sm)] flex gap-2">
            <button
              type="button"
              onClick={applyPaste}
              className="flex-1 rounded-md bg-accent py-3 font-bold text-app shadow-sm"
            >
              {ja.paste.apply}
            </button>
            <button
              type="button"
              onClick={() => setPasteOpen(false)}
              className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted"
            >
              {ja.paste.close}
            </button>
          </div>
        </div>
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

      {/* アイコン（一覧・詳細で写真の代わりに使うプレースホルダー） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.iconLabel}</span>
        <p className="mt-0.5 text-sm text-ink-muted">{ja.form.iconDescription}</p>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => setIconKey(undefined)}
            className={`flex flex-col items-center justify-center gap-1 rounded-md border py-2 text-xs font-bold shadow-sm ${
              iconKey === undefined
                ? 'border-accent bg-accent text-app'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            <ImageIcon size={20} aria-hidden />
            {ja.form.iconAuto}
          </button>
          {iconKeyOrder.map((key) => {
            const Icon = iconComponents[key]
            const isAutoPick = iconKey === undefined && pickIconKey({ title, tags, ingredients }) === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setIconKey(key)}
                className={`flex flex-col items-center justify-center gap-1 rounded-md border py-2 text-xs font-bold shadow-sm ${
                  iconKey === key
                    ? 'border-accent bg-accent text-app'
                    : isAutoPick
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                <Icon size={20} aria-hidden />
                {ja.icon[key]}
              </button>
            )
          })}
        </div>
        {photo && (
          <label className="mt-[var(--space-sm)] flex items-center justify-between gap-3 rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm">
            <span className="text-sm font-bold text-ink-muted">
              {ja.form.iconShowInsteadOfPhoto}
              <span className="mt-0.5 block text-xs font-normal text-ink-muted">
                {ja.form.iconShowInsteadOfPhotoDescription}
              </span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={showIconInsteadOfPhoto}
              onClick={() => setShowIconInsteadOfPhoto((v) => !v)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                showIconInsteadOfPhoto ? 'bg-accent' : 'bg-edge'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                  showIconInsteadOfPhoto ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </label>
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

      {/* 季節（任意・もう一度押すと解除） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.seasonLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.seasonDescription}</p>
        <div className="mt-1 grid grid-cols-4 gap-[var(--space-sm)]">
          {seasons.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeason((current) => (current === value ? undefined : value))}
              className={`rounded-md border py-3 font-bold shadow-sm ${
                season === value
                  ? 'border-accent bg-accent text-app'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.season[value]}
            </button>
          ))}
        </div>
      </div>

      {/* 向いている時間帯（任意・複数選択可） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.suitableForLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.suitableForDescription}</p>
        <div className="mt-1 grid grid-cols-3 gap-[var(--space-sm)]">
          {mealSlots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() =>
                setSuitableFor((current) =>
                  current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot],
                )
              }
              className={`rounded-md border py-3 font-bold shadow-sm ${
                suitableFor.includes(slot)
                  ? 'border-accent bg-accent text-app'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
      </div>

      {/* 材料（追加・削除・並べ替え） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.ingredientsLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.ingredientGroupHint}</p>
        <div className="mt-1 space-y-[var(--space-sm)]">
          {ingredients.map((row, index) => (
            <div
              key={index}
              className="rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
              style={
                row.group
                  ? { borderLeft: `4px solid var(${seasoningGroupColorToken(row.group)})` }
                  : undefined
              }
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
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink-muted">
                  <span className="shrink-0">{ja.form.ingredientPrice}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={row.price}
                    onChange={(e) => updateIngredient(index, { price: e.target.value })}
                    placeholder={ja.form.ingredientPricePlaceholder}
                    className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => updateIngredient(index, { group: nextSeasoningGroup(row.group) })}
                  aria-label={
                    row.group
                      ? ja.form.ingredientGroupSet.replace('{n}', String(row.group))
                      : ja.form.ingredientGroupNone
                  }
                  className={iconBtnCls}
                >
                  <span
                    className={`h-5 w-5 rounded-full border-2 ${row.group ? '' : 'border-dashed border-edge'}`}
                    style={
                      row.group
                        ? {
                            borderColor: `var(${seasoningGroupColorToken(row.group)})`,
                            background: `var(${seasoningGroupColorToken(row.group)})`,
                          }
                        : undefined
                    }
                  />
                </button>
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
              <input
                type="text"
                value={row.memo}
                onChange={(e) => updateIngredient(index, { memo: e.target.value })}
                placeholder={ja.form.ingredientMemoPlaceholder}
                aria-label={ja.form.ingredientMemoPlaceholder}
                className="mt-[var(--space-sm)] block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink-muted placeholder:text-ink-muted/60"
              />
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
              <input
                type="text"
                value={row.memo}
                onChange={(e) => updateStep(index, { memo: e.target.value })}
                placeholder={ja.form.stepMemoPlaceholder}
                aria-label={ja.form.stepMemoPlaceholder}
                className="mt-[var(--space-sm)] block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink-muted placeholder:text-ink-muted/60"
              />
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
    </div>
  )
}
