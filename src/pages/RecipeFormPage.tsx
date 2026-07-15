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
  RotateCcw,
} from 'lucide-react'
import type {
  DishType,
  EffortLevel,
  IconKey,
  Ingredient,
  MealSlot,
  RecipeInput,
  Season,
  Step,
} from '../db/types'
import { createRecipe, deleteRecipe, getRecipe, listRecipes, updateRecipe } from '../db/recipes'
import { useSettings } from '../db/settings'
import { countFreeLimitRecipes, isAtFreeLimit } from '../logic/freeLimit'
import { resizePhoto } from '../logic/image'
import { parseRecipeText, autoSplitAmountUnit, looksPoorlyParsed } from '../logic/parseRecipeText'
import { pickIconKey, iconKeyOrder } from '../logic/icon'
import { nextSeasoningGroup, seasoningGroupColorToken } from '../logic/seasoningGroup'
import { normalizeDigits } from '../logic/amount'
import { usePhotoUrl } from '../components/usePhotoUrl'
import BackHeader from '../components/BackHeader'
import { iconComponents } from '../components/RecipeCard'
import { starterDefs } from '../db/starters'
import { fetchRecipeSet } from '../logic/backup'
import { ja } from '../i18n/ja'

/* フォーム内部で扱う行の形（入力中は数値も文字列で持つ）。
 * 価格(price)はレシピ編集画面から撤去し「食材と価格」ページに一元化した
 * (2026-07-14 オーナー要望)ため、このフォーム内部の行データには持たない。
 * ただしIngredient.price自体の型・保存済みデータ・estimateRecipeCostの
 * 「個別price優先→マスタ」ロジックは変更していない(既存レシピの個別価格は温存)。 */
type IngredientRow = {
  name: string
  amount: string
  unit: string
  memo: string
  group: number | undefined
}
type StepRow = { text: string; minutes: string; memo: string }

const emptyIngredient: IngredientRow = {
  name: '',
  amount: '',
  unit: '',
  memo: '',
  group: undefined,
}
const emptyStep: StepRow = { text: '', minutes: '', memo: '' }

/** Ingredient[]（DB形）→ IngredientRow[]（フォーム形）。既存レシピの読み込み・
 * 「デフォルトに戻す」の3分岐すべてで使う共通の変換（重複を避けるため2026-07-15に切り出し） */
function toIngredientRows(ingredients: Ingredient[]): IngredientRow[] {
  return ingredients.length > 0
    ? ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        memo: i.memo ?? '',
        group: i.seasoningGroup,
      }))
    : [{ ...emptyIngredient }]
}

/** Step[]（DB形）→ StepRow[]（フォーム形）。toIngredientRowsと同じ理由で共通化 */
function toStepRows(steps: Step[]): StepRow[] {
  return steps.length > 0
    ? steps.map((s) => ({
        text: s.text,
        minutes: s.minutes != null ? String(s.minutes) : '',
        memo: s.memo ?? '',
      }))
    : [{ ...emptyStep }]
}

/**
 * 入力途中の内容をsessionStorageに自動保存する下書きの形。
 * 写真(Blob)はサイズが大きくJSON化できないため下書きには含めない。
 */
type FormDraft = {
  title: string
  intro: string
  servings: number
  cookMinutes: string
  effortLevel: EffortLevel
  ingredients: IngredientRow[]
  steps: StepRow[]
  tags: string[]
  tagInput: string
  keywords: string[]
  keywordInput: string
  onePoint: string
  memo: string
  sourceUrl: string
  iconKey?: IconKey
  showIconInsteadOfPhoto: boolean
  season?: Season
  suitableFor: MealSlot[]
  dishType?: DishType
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
const dishTypes: DishType[] = ['main', 'side', 'soup', 'dessert']

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

/** 「くわしく」タブ見出しの●表示判定(2026-07-16 Fable裁定docs/26 論点3)。保存stateにはせず、
 * 現在の入力値から毎レンダー導出する(リセット/下書き復元/貼り付けと自動整合するため)。
 * effortLevelは'normal'(既定値)を、showIconInsteadOfPhotoはfalse(既定値)を未入力扱いとする */
function deriveHasDetailInput(fields: {
  intro: string
  cookMinutes: string
  effortLevel: EffortLevel
  season: Season | undefined
  suitableFor: MealSlot[]
  dishType: DishType | undefined
  tags: string[]
  keywords: string[]
  onePoint: string
  memo: string
  sourceUrl: string
  showIconInsteadOfPhoto: boolean
}): boolean {
  return (
    fields.intro.trim() !== '' ||
    fields.cookMinutes.trim() !== '' ||
    fields.effortLevel !== 'normal' ||
    fields.season !== undefined ||
    fields.suitableFor.length > 0 ||
    fields.dishType !== undefined ||
    fields.tags.length > 0 ||
    fields.keywords.length > 0 ||
    fields.onePoint.trim() !== '' ||
    fields.memo.trim() !== '' ||
    fields.sourceUrl.trim() !== '' ||
    fields.showIconInsteadOfPhoto
  )
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
  const [intro, setIntro] = useState('')
  const [photo, setPhoto] = useState<Blob>()
  const [servings, setServings] = useState(2)
  const [cookMinutes, setCookMinutes] = useState('')
  const [effortLevel, setEffortLevel] = useState<EffortLevel>('normal')
  const [ingredients, setIngredients] = useState<IngredientRow[]>([{ ...emptyIngredient }])
  const [steps, setSteps] = useState<StepRow[]>([{ ...emptyStep }])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [onePoint, setOnePoint] = useState('')
  const [memo, setMemo] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [iconKey, setIconKey] = useState<IconKey>()
  const [showIconInsteadOfPhoto, setShowIconInsteadOfPhoto] = useState(false)
  const [season, setSeason] = useState<Season>()
  const [suitableFor, setSuitableFor] = useState<MealSlot[]>([])
  const [dishType, setDishType] = useState<DishType>()
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // 「かんたん / くわしく」タブ(2026-07-16 Fable裁定docs/26・案A)。ページローカルの表示状態のみで、
  // 保存対象にも下書き対象にもしない(URLにも載せない)。新規・編集とも初期表示は常に「かんたん」
  const [activeTab, setActiveTab] = useState<'simple' | 'detail'>('simple')

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
      intro: recipe.intro ?? '',
      servings: recipe.servings,
      cookMinutes: recipe.cookMinutes != null ? String(recipe.cookMinutes) : '',
      effortLevel: recipe.effortLevel,
      ingredients: toIngredientRows(recipe.ingredients),
      steps: toStepRows(recipe.steps),
      tags: recipe.tags,
      tagInput: '',
      keywords: recipe.keywords ?? [],
      keywordInput: '',
      onePoint: recipe.onePoint ?? '',
      memo: recipe.memo ?? '',
      sourceUrl: recipe.sourceUrl ?? '',
      iconKey: recipe.iconKey,
      showIconInsteadOfPhoto: recipe.showIconInsteadOfPhoto ?? false,
      season: recipe.season,
      suitableFor: recipe.suitableFor ?? [],
      dishType: recipe.dishType,
    } satisfies FormDraft)
    setTitle(recipe.title)
    setIntro(recipe.intro ?? '')
    setPhoto(recipe.photo)
    setServings(recipe.servings)
    setCookMinutes(recipe.cookMinutes != null ? String(recipe.cookMinutes) : '')
    setEffortLevel(recipe.effortLevel)
    setIngredients(toIngredientRows(recipe.ingredients))
    setSteps(toStepRows(recipe.steps))
    setTags(recipe.tags)
    setKeywords(recipe.keywords ?? [])
    setOnePoint(recipe.onePoint ?? '')
    setMemo(recipe.memo ?? '')
    setSourceUrl(recipe.sourceUrl ?? '')
    setIconKey(recipe.iconKey)
    setShowIconInsteadOfPhoto(recipe.showIconInsteadOfPhoto ?? false)
    setSeason(recipe.season)
    setSuitableFor(recipe.suitableFor ?? [])
    setDishType(recipe.dishType)
  }, [loadedRecipe])

  // 現在の入力内容(下書きに保存する形)。1文字変わるたびに再計算される
  const currentSerialized = useMemo(
    () =>
      JSON.stringify({
        title,
        intro,
        servings,
        cookMinutes,
        effortLevel,
        ingredients,
        steps,
        tags,
        tagInput,
        keywords,
        keywordInput,
        onePoint,
        memo,
        sourceUrl,
        iconKey,
        showIconInsteadOfPhoto,
        season,
        suitableFor,
        dishType,
      } satisfies FormDraft),
    [
      title,
      intro,
      servings,
      cookMinutes,
      effortLevel,
      ingredients,
      steps,
      tags,
      tagInput,
      keywords,
      keywordInput,
      onePoint,
      memo,
      sourceUrl,
      iconKey,
      showIconInsteadOfPhoto,
      season,
      suitableFor,
      dishType,
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
    setIntro(d.intro ?? '')
    setServings(d.servings ?? 2)
    setCookMinutes(d.cookMinutes ?? '')
    setEffortLevel(d.effortLevel ?? 'normal')
    setIngredients(d.ingredients?.length ? d.ingredients : [{ ...emptyIngredient }])
    setSteps(d.steps?.length ? d.steps : [{ ...emptyStep }])
    setTags(d.tags ?? [])
    setTagInput(d.tagInput ?? '')
    setKeywords(d.keywords ?? [])
    setKeywordInput(d.keywordInput ?? '')
    setOnePoint(d.onePoint ?? '')
    setMemo(d.memo ?? '')
    setSourceUrl(d.sourceUrl ?? '')
    setIconKey(d.iconKey)
    setShowIconInsteadOfPhoto(d.showIconInsteadOfPhoto ?? false)
    setSeason(d.season)
    setSuitableFor(d.suitableFor ?? [])
    setDishType(d.dishType)
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
    // 「調理時間: 20分」のようなメタ情報行から拾った分数はフォームの調理時間欄へ
    if (parsed.cookMinutes) setCookMinutes(String(parsed.cookMinutes))
    if (parsed.ingredients.length > 0) {
      setIngredients(
        parsed.ingredients.map((row) => ({
          name: row.name,
          amount: row.amount,
          unit: row.unit,
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
    // 材料・手順のどちらもほぼ拾えなかった(段落丸ごと1文になった等)場合は、
    // 読み取れた分はフォームへ流し込んだ上で、うまく振り分けられなかった旨を正直に案内する
    if (looksPoorlyParsed(pasteText, parsed)) {
      setPasteMessage(ja.paste.resultPoor)
      return
    }
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

  /** 材料行を削除する（入力内容がある行だけ確認を挟む。空行は従来どおり即削除） */
  const removeIngredientRow = (index: number) => {
    const row = ingredients[index]
    const hasContent = !!(
      row &&
      (row.name.trim() || row.amount.trim() || row.unit.trim() || row.memo.trim())
    )
    if (hasContent && !window.confirm(ja.form.confirmRemoveRow)) return
    setIngredients((rows) =>
      rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ ...emptyIngredient }],
    )
  }

  /** 手順行を削除する（入力内容がある行だけ確認を挟む。空行は従来どおり即削除） */
  const removeStepRow = (index: number) => {
    const row = steps[index]
    const hasContent = !!(row && (row.text.trim() || row.minutes.trim() || row.memo.trim()))
    if (hasContent && !window.confirm(ja.form.confirmRemoveRow)) return
    setSteps((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : [{ ...emptyStep }]))
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }

  const addKeyword = () => {
    const keyword = keywordInput.trim()
    if (keyword && !keywords.includes(keyword)) setKeywords([...keywords, keyword])
    setKeywordInput('')
  }

  const save = async () => {
    if (!title.trim()) {
      setError(ja.form.nameRequired)
      // 「くわしく」タブを見ている間に料理名未入力で保存を押した場合、必須項目が
      // 隠れたタブに残らないよう「かんたん」タブへ自動で戻す(Fable裁定docs/26 論点4)
      setActiveTab('simple')
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
      // キーワード欄も同様に、入力したまま「追加」押し忘れの分を保存時に取り込む
      const pendingKeyword = keywordInput.trim()
      const effectiveKeywords =
        pendingKeyword && !keywords.includes(pendingKeyword) ? [...keywords, pendingKeyword] : keywords

      const input: RecipeInput = {
        title,
        intro: intro.trim() || undefined,
        photo,
        servings,
        cookMinutes: cookMinutes.trim() ? Number(cookMinutes) : undefined,
        effortLevel,
        tags: effectiveTags,
        dishType,
        ingredients: ingredients.map((row) => {
          // 単位欄が空のまま分量欄に「大さじ3」等と書かれていたら自動で分ける
          // (そのままだと人数変更が効かないため。「少々」「適量」はそのまま)。
          // 「1枚（250g）」の括弧書きは消さずに材料メモへ移す
          const split = autoSplitAmountUnit(normalizeDigits(row.amount.trim()), row.unit)
          const memoText = [row.memo.trim(), split.memo].filter(Boolean).join('・')
          // 材料ごとの価格入力欄は撤去済み(価格は「食材と価格」ページで一元管理)。
          // 新規・編集で保存する材料にはpriceを設定しない
          // (既存レシピに残る個別price自体は温存。estimateRecipeCostの優先ロジックは不変)。
          return {
            name: row.name,
            amount: split.amount,
            unit: split.unit,
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
        onePoint: onePoint.trim() || undefined,
        memo: memo.trim() || undefined,
        keywords: effectiveKeywords.length > 0 ? effectiveKeywords : undefined,
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

  // ---- 「デフォルトに戻す」(2026-07-15 オーナー要望・編集モードのみ) ----
  // DBへは書き込まず、フォームの入力値だけを差し替える（保存を押すまで確定しない安全設計）。
  // 戻し先は3分岐: 自作レシピ=前回保存値(loadedRecipe自身) / 基本レシピ=starterDefsの原本 /
  // 配布セット由来=public/sets/data/<setId>.jsonの原本。3分岐とも「フォームに現れるフィールド」
  // だけを対象にし、title・photo・iconKey・showIconInsteadOfPhotoは常にloadedRecipe(既存の保存値)
  // 側から取る（reloadStarterRecipes/importRecipeSetの再取込が「表示設定はユーザーのものを保持する」
  // のと同じ考え方。自作レシピ分岐ではこれもloadedRecipe由来なので実質「全部を前回保存値に戻す」になる）
  const resetVariant: 'own' | 'starter' | 'set' | undefined = !loadedRecipe
    ? undefined
    : loadedRecipe.isStarter
      ? loadedRecipe.sourceSetId
        ? 'set'
        : 'starter'
      : 'own'

  const [resetArmed, setResetArmed] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetMessage, setResetMessage] = useState('')
  const resetArmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => {
    return () => {
      if (resetArmTimerRef.current) clearTimeout(resetArmTimerRef.current)
    }
  }, [])

  /** 差し替え先の値をまとめてフォームへ反映し、この状態を新しい基準点にする
   * （baselineRef更新＋下書き削除。更新しないと直後の自動保存useEffectが
   * 差し替え後の内容を「新しい下書き」としてまたsessionStorageへ書いてしまう） */
  const applyResetTarget = (target: FormDraft) => {
    setTitle(target.title)
    setIntro(target.intro)
    setServings(target.servings)
    setCookMinutes(target.cookMinutes)
    setEffortLevel(target.effortLevel)
    setIngredients(target.ingredients)
    setSteps(target.steps)
    setTags(target.tags)
    setTagInput('')
    setKeywords(target.keywords)
    setKeywordInput('')
    setOnePoint(target.onePoint)
    setMemo(target.memo)
    setSourceUrl(target.sourceUrl)
    setIconKey(target.iconKey)
    setShowIconInsteadOfPhoto(target.showIconInsteadOfPhoto)
    setSeason(target.season)
    setSuitableFor(target.suitableFor)
    setDishType(target.dishType)
    baselineRef.current = JSON.stringify(target)
    clearDraft()
    setError('')
    setResetMessage(ja.form.resetFeedback)
  }

  const resetToOwn = () => {
    if (!loadedRecipe) return
    applyResetTarget({
      title: loadedRecipe.title,
      intro: loadedRecipe.intro ?? '',
      servings: loadedRecipe.servings,
      cookMinutes: loadedRecipe.cookMinutes != null ? String(loadedRecipe.cookMinutes) : '',
      effortLevel: loadedRecipe.effortLevel,
      ingredients: toIngredientRows(loadedRecipe.ingredients),
      steps: toStepRows(loadedRecipe.steps),
      tags: loadedRecipe.tags,
      tagInput: '',
      keywords: loadedRecipe.keywords ?? [],
      keywordInput: '',
      onePoint: loadedRecipe.onePoint ?? '',
      memo: loadedRecipe.memo ?? '',
      sourceUrl: loadedRecipe.sourceUrl ?? '',
      iconKey: loadedRecipe.iconKey,
      showIconInsteadOfPhoto: loadedRecipe.showIconInsteadOfPhoto ?? false,
      season: loadedRecipe.season,
      suitableFor: loadedRecipe.suitableFor ?? [],
      dishType: loadedRecipe.dishType,
    })
    setPhoto(loadedRecipe.photo)
  }

  // 「基本レシピを入れ直す」(reloadStarterRecipes/buildUpdatedStarterRecipe)と同じ対応表を使う:
  // タイトル一致でstarterDefsの原本を探し、内容フィールドだけ差し替える
  // （title・photo・iconKey・showIconInsteadOfPhotoはユーザーの表示設定としてloadedRecipe側を保持）
  const resetToStarter = () => {
    if (!loadedRecipe) return
    const def = starterDefs.find((d) => d.title === loadedRecipe.title)
    if (!def) {
      setError(ja.form.resetStarterNotFound)
      return
    }
    applyResetTarget({
      title: loadedRecipe.title,
      intro: def.intro ?? '',
      servings: def.servings,
      cookMinutes: def.cookMinutes != null ? String(def.cookMinutes) : '',
      effortLevel: def.effortLevel,
      ingredients: toIngredientRows(def.ingredients),
      steps: toStepRows(def.steps),
      tags: def.tags,
      tagInput: '',
      keywords: def.keywords ?? [],
      keywordInput: '',
      onePoint: def.onePoint ?? '',
      memo: def.memo ?? '',
      sourceUrl: def.sourceUrl ?? '',
      iconKey: loadedRecipe.iconKey,
      showIconInsteadOfPhoto: loadedRecipe.showIconInsteadOfPhoto ?? false,
      season: def.season,
      suitableFor: def.suitableFor ?? [],
      dishType: def.dishType,
    })
    setPhoto(loadedRecipe.photo)
  }

  // 配布セット由来: public/sets/data/<setId>.json を同一オリジンfetchし、料理名一致で原本を取得する
  // （importRecipeSet/buildUpdatedSetRecipeと同じ「内容フィールドだけ差し替え、表示設定は保持」の考え方）。
  // fetch失敗・該当レシピなしはエラーメッセージを出すだけで何もしない
  const resetToSet = async () => {
    if (!loadedRecipe || !loadedRecipe.sourceSetId) return
    setResetting(true)
    try {
      const file = await fetchRecipeSet(`/sets/data/${loadedRecipe.sourceSetId}.json`)
      const match = file.recipes.find((r) => r.title.trim() === loadedRecipe.title.trim())
      if (!match) {
        setError(ja.form.resetSetFetchError)
        return
      }
      applyResetTarget({
        title: loadedRecipe.title,
        intro: match.intro ?? '',
        servings: match.servings,
        cookMinutes: match.cookMinutes != null ? String(match.cookMinutes) : '',
        effortLevel: match.effortLevel,
        ingredients: toIngredientRows(match.ingredients),
        steps: toStepRows(match.steps),
        tags: match.tags,
        tagInput: '',
        keywords: match.keywords ?? [],
        keywordInput: '',
        onePoint: match.onePoint ?? '',
        memo: match.memo ?? '',
        sourceUrl: match.sourceUrl ?? '',
        iconKey: loadedRecipe.iconKey,
        showIconInsteadOfPhoto: loadedRecipe.showIconInsteadOfPhoto ?? false,
        season: match.season,
        suitableFor: match.suitableFor ?? [],
        dishType: match.dishType,
      })
      setPhoto(loadedRecipe.photo)
    } catch {
      setError(ja.form.resetSetFetchError)
    } finally {
      setResetting(false)
    }
  }

  const performReset = () => {
    if (resetVariant === 'own') resetToOwn()
    else if (resetVariant === 'starter') resetToStarter()
    else if (resetVariant === 'set') void resetToSet()
  }

  /** window.confirmは使わず、既存の確認UIパターンが無いためもう一度押す方式で誤操作を防ぐ
   * （1回目は確認を促す表示に切り替わるだけで何も変更しない。5秒操作が無ければ元のラベルに戻る） */
  const handleResetClick = () => {
    if (!resetArmed) {
      setResetArmed(true)
      if (resetArmTimerRef.current) clearTimeout(resetArmTimerRef.current)
      resetArmTimerRef.current = setTimeout(() => setResetArmed(false), 5000)
      return
    }
    if (resetArmTimerRef.current) clearTimeout(resetArmTimerRef.current)
    setResetArmed(false)
    performReset()
  }

  // 「くわしく」タブ見出しの●表示(保存stateではなく値から毎レンダー導出。上のderive関数を参照)
  const hasDetailInput = deriveHasDetailInput({
    intro,
    cookMinutes,
    effortLevel,
    season,
    suitableFor,
    dishType,
    tags,
    keywords,
    onePoint,
    memo,
    sourceUrl,
    showIconInsteadOfPhoto,
  })

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
              className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
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
              className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
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

      {/* かんたん / くわしく タブ(2026-07-16 Fable裁定docs/26・案A承認)。DOMは両タブとも常時
          マウントし、非表示は`hidden`属性の切替だけで行う(state消失リスクゼロ)。表示のグルーピング
          だけを変えるもので、フィールドのstate・保存ロジック・下書き自動保存・リセットは不変 */}
      <div className="mt-[var(--space-md)] flex border-b border-edge" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'simple'}
          onClick={() => setActiveTab('simple')}
          className={`flex-1 border-b-2 py-3 text-center font-bold ${
            activeTab === 'simple' ? 'border-accent text-accent' : 'border-transparent text-ink-muted'
          }`}
        >
          {ja.form.formTabSimple}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'detail'}
          onClick={() => setActiveTab('detail')}
          className={`flex-1 border-b-2 py-3 text-center font-bold ${
            activeTab === 'detail' ? 'border-accent text-accent' : 'border-transparent text-ink-muted'
          }`}
        >
          {ja.form.formTabDetail}
          {hasDetailInput && (
            <span
              aria-label={ja.form.formTabDetailFilledHint}
              className="ml-1.5 inline-block h-2 w-2 rounded-full bg-accent align-middle"
            />
          )}
        </button>
      </div>

      <div hidden={activeTab !== 'simple'}>
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

      {/* 人数分 */}
      <div className="mt-[var(--space-md)]">
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
      </div>

      {/* 材料（追加・削除・並べ替え） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.ingredientsLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.ingredientGroupHint}</p>
        {/* 価格管理は「食材と価格」ページに一元化(2026-07-14 オーナー要望)。
            この画面には材料ごとの価格入力欄を置かず、案内だけ表示する */}
        <p className="mt-1 text-sm text-ink-muted">{ja.form.ingredientPriceGuide}</p>
        <Link to="/prices" className="mt-0.5 inline-block text-sm font-bold text-accent underline">
          {ja.form.ingredientPriceGuideLink}
        </Link>
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
              <div className="mt-[var(--space-sm)] flex items-center justify-between gap-[var(--space-sm)]">
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
                <div className="flex items-center gap-[var(--space-sm)]">
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
                    onClick={() => removeIngredientRow(index)}
                    aria-label={ja.form.removeRow}
                    className={`${iconBtnCls} text-warning`}
                  >
                    <X size={20} aria-hidden />
                  </button>
                </div>
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-on-accent">
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
                  onClick={() => removeStepRow(index)}
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

      {/* 見た目（写真＋アイコンをこの1セクションに統合。「写真の代わりにアイコンを表示」の
          細かい設定はくわしくタブへ。2026-07-16 Fable裁定docs/26 論点2） */}
      {/* 写真（カメラ / アルバム） */}
      <div className="mt-[var(--space-lg)]">
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
                ? 'border-accent bg-accent text-on-accent'
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
                    ? 'border-accent bg-accent text-on-accent'
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
      </div>
      </div>

      <div hidden={activeTab !== 'detail'}>
      {/* 紹介文（ひとこと説明。任意。2026-07-13） */}
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
        {ja.form.introLabel}
        <input
          type="text"
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          placeholder={ja.form.introPlaceholder}
          className={inputCls}
        />
      </label>

      {/* 調理時間 */}
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
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
                  ? 'border-accent bg-accent text-on-accent'
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
                  ? 'border-accent bg-accent text-on-accent'
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
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
      </div>

      {/* 料理の種別（任意・もう一度押すと解除。献立プランナーの主菜/副菜提案に使う） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.dishTypeLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.dishTypeDescription}</p>
        <div className="mt-1 grid grid-cols-4 gap-[var(--space-sm)]">
          {dishTypes.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDishType((current) => (current === value ? undefined : value))}
              className={`rounded-md border py-3 font-bold shadow-sm ${
                dishType === value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.dishType[value]}
            </button>
          ))}
        </div>
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

      {/* 検索キーワード（任意・一覧や詳細には表示せず検索のヒット対象にのみ使う） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.keywordsLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.keywordsDescription}</p>
        {keywords.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {keywords.map((keyword) => (
              <span
                key={keyword}
                className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm text-accent"
                style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => setKeywords(keywords.filter((k) => k !== keyword))}
                  aria-label={ja.form.removeKeyword}
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
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKeyword()
              }
            }}
            placeholder={ja.form.keywordPlaceholder}
            className="min-w-0 flex-1 rounded-sm border border-edge bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
          />
          <button
            type="button"
            onClick={addKeyword}
            className="rounded-sm border border-edge bg-surface px-4 font-bold text-accent shadow-sm"
          >
            {ja.form.addKeyword}
          </button>
        </div>
      </div>

      {/* ワンポイント・メモ・参照元URL（2026-07 メモ2区画化: ワンポイント=こつ・知識、メモ=保存方法・注意書き・安全） */}
      <label className={`mt-[var(--space-lg)] ${labelCls}`}>
        {ja.form.onePointLabel}
        <textarea
          value={onePoint}
          onChange={(e) => setOnePoint(e.target.value)}
          placeholder={ja.form.onePointPlaceholder}
          rows={3}
          className={inputCls}
        />
      </label>
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
        {ja.form.memoLabel}
        <span className="ml-1 font-normal text-ink-muted">（{ja.form.memoDescription}）</span>
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

      {/* 写真の代わりにアイコンを表示するトグル(見た目の細かい設定。かんたんタブの「見た目」から
          切り離してこちらへ。2026-07-16 Fable裁定docs/26 論点2) */}
      {photo && (
        <label className="mt-[var(--space-md)] flex items-center justify-between gap-3 rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm">
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

      {/* 保存・キャンセル */}
      <div className="mt-[var(--space-lg)] flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-60"
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

      {/* デフォルトに戻す（編集時のみ・2026-07-15 オーナー要望）。DBには書き込まず、
          フォームの入力値だけを差し替える。押し間違えない距離・控えめな色にするため
          保存/キャンセルのすぐ下、削除ボタンとは離して配置する */}
      {isEdit && resetVariant && (
        <div className="mt-[var(--space-md)]">
          <button
            type="button"
            onClick={handleResetClick}
            disabled={resetting}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm disabled:opacity-60"
          >
            <RotateCcw size={18} aria-hidden />
            {resetting
              ? ja.form.resetting
              : resetArmed
                ? ja.form.resetConfirmLabel
                : resetVariant === 'own'
                  ? ja.form.resetToSavedLabel
                  : ja.form.resetToDefaultLabel}
          </button>
          {resetMessage && (
            <p className="mt-1 text-center text-sm font-bold text-accent">{resetMessage}</p>
          )}
        </div>
      )}

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
