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
  GripVertical,
  ListChecks,
  CheckCircle2,
  Trash2,
  ClipboardPaste,
  RotateCcw,
  Globe,
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
import { parseRecipeText, normalizeImportedIngredient, autoSplitAmountUnit, looksPoorlyParsed } from '../logic/parseRecipeText'
import { importRecipeFromUrl, isUrlImportEnabled, UrlImportError, IMPORT_ENDPOINT } from '../logic/urlImport'
import type { ImportErrorReason } from '../logic/urlImport'
import { fetchImportedPhoto } from '../logic/urlImportImage'
import { buildImportedIngredientRows, countAmountlessRows, filterImportedSteps } from '../logic/urlImportRows'
import { pickIconKey, iconKeyOrder } from '../logic/icon'
import { guessDishType } from '../logic/dishTypeGuess'
import { toTagKey } from '../logic/kana'
import {
  MAX_SEASONING_GROUP,
  nextSeasoningGroup,
  seasoningGroupColorToken,
} from '../logic/seasoningGroup'
import { normalizeAmountInput, normalizeDigits } from '../logic/amount'
import { isHttpUrl } from '../logic/url'
import { MAX_SERVINGS, MIN_SERVINGS, clampServings, isServingsInRange } from '../logic/servings'
import { needsReplaceConfirm, photoReplacePlan, replaceConfirmTargets } from '../logic/replaceConfirm'
import type { PhotoReplacePlan } from '../logic/replaceConfirm'
import { usePhotoUrl } from '../components/usePhotoUrl'
import BackHeader from '../components/BackHeader'
import Toast from '../components/Toast'
import { RecipeIcon } from '../components/RecipeCard'
import { starterDefs } from '../db/starters'
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

/**
 * URL取り込みの失敗理由ごとの案内文(2026-07-28 便BX/C04・C05・C10)。
 * 「時間をおいて試すか、貼り付けをお使いください」1本に、URLの打ち間違い・ページ消失・
 * サイト側の拒否・一時的な通信不調が全部潰れており、404では絶対に解決しない案内が
 * 出ていた(実機QA)。理由ごとに「次に何をすればよいか」が変わるので文言を分ける。
 */
const URL_IMPORT_ERROR_MESSAGE: Record<ImportErrorReason, string> = {
  invalid_url: ja.urlImport.errorInvalidUrl,
  not_found: ja.urlImport.errorNotFound,
  blocked: ja.urlImport.errorBlocked,
  no_recipe: ja.urlImport.errorNoRecipe,
  fetch_failed: ja.urlImport.errorFetchFailed,
}

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

/**
 * 下書きの保存先(2026-07-28 便BW/C-16)。
 * 旧: sessionStorage = タブを閉じる・別タブで開くと復元できず、ホーム画面PWAでOSがタブを
 * 破棄すると書きかけが失われていた(QA S2)。新: localStorage に保存し、保存した時刻を一緒に
 * 持たせて DRAFT_MAX_AGE_MS を過ぎた古い下書きは読まずに捨てる(いつまでも「復元しますか？」が
 * 出続けないようにする)。旧版の sessionStorage に残っている下書きも一度だけ読んで引き継ぐ。
 */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** 下書きの保存形式(中身のJSON文字列 + 保存時刻)。draft は FormDraft をJSON化した文字列 */
type DraftEnvelope = { savedAt: number; draft: string }

/**
 * 「復元しますか？」を出している間の退避先キー(2026-07-28 便BW/C-01)。
 * 以前は復元するか決めるまで自動保存を止めていたため、バナーを無視して書き続けた内容が
 * 画面移動で丸ごと消えていた。開いた時点の下書きをこの退避キーへ移しておくことで、
 * バナー表示中も「いまの入力」を通常どおり自動保存できる。
 */
function heldDraftKey(key: string): string {
  return `${key}:held`
}

function readDraftEnvelope(key: string): DraftEnvelope | null {
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DraftEnvelope>
      if (typeof parsed?.draft !== 'string') return null
      const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
      if (Date.now() - savedAt > DRAFT_MAX_AGE_MS) {
        localStorage.removeItem(key)
        return null
      }
      return { savedAt, draft: parsed.draft }
    }
    // 旧版(sessionStorage・時刻なし)からの引き継ぎ。中身はFormDraftのJSONそのもの
    const legacy = sessionStorage.getItem(key)
    if (!legacy) return null
    return { savedAt: Date.now(), draft: legacy }
  } catch {
    return null
  }
}

function writeDraftEnvelope(key: string, draft: string, savedAt = Date.now()): void {
  try {
    localStorage.setItem(key, JSON.stringify({ savedAt, draft } satisfies DraftEnvelope))
  } catch {
    /* 保存領域の容量超過などは黙って諦める(入力自体は失われない) */
  }
}

/** 書きかけ(本体キー)だけを消す。退避中の下書き(held)には触らない */
function removeMainDraft(key: string): void {
  try {
    localStorage.removeItem(key)
    sessionStorage.removeItem(key)
  } catch {
    /* 無視 */
  }
}

/** 本体・退避の両方を消す(保存・削除・キャンセルで完了したとき) */
function removeAllDrafts(key: string): void {
  removeMainDraft(key)
  try {
    localStorage.removeItem(heldDraftKey(key))
  } catch {
    /* 無視 */
  }
}

function parseDraft(serialized: string | null): FormDraft | null {
  if (!serialized) return null
  try {
    const parsed = JSON.parse(serialized) as FormDraft
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * 画面を開いた時点の下書きを取り出し、退避キーへ移す(C-01)。
 * 本体キーを空けることで、この後の自動保存は「いまの入力」を普通に書き込める。
 * 2回呼ばれても(React StrictModeの二重実行)結果が変わらないよう、本体が空なら退避側を読む。
 */
function takePendingDraft(key: string): FormDraft | null {
  const envelope = readDraftEnvelope(key) ?? readDraftEnvelope(heldDraftKey(key))
  removeMainDraft(key)
  if (envelope) writeDraftEnvelope(heldDraftKey(key), envelope.draft, envelope.savedAt)
  else {
    try {
      localStorage.removeItem(heldDraftKey(key))
    } catch {
      /* 無視 */
    }
  }
  return parseDraft(envelope?.draft ?? null)
}

/** 料理名の上限(2026-07-28 便BW)。超えると詳細ページの見出しが画面をほぼ占有するため保存前に指摘する */
const MAX_TITLE_LENGTH = 60
// 人数分の下限・上限(便BW)とクランプは logic/servings.ts へ移した(2026-07-30 便CK/①-1)。
// ±ボタンのonClickにしかクランプが無く、URL取り込み・貼り付け・下書き復元は素通りしていたため、
// setServingsを呼ぶ全経路が同じ関数を通る形に揃える

/** 「30」「0」のような0以上の数字だけを受け付ける(「-30」「abc」を弾く。便BW/C-20) */
function isNonNegativeNumber(value: string): boolean {
  const n = Number(value.trim())
  return Number.isFinite(n) && n >= 0
}

const effortLevels: EffortLevel[] = ['easy', 'normal', 'fancy']
const seasons: Exclude<Season, 'all'>[] = ['spring', 'summer', 'autumn', 'winter']
const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner']
const dishTypes: DishType[] = ['main', 'side', 'soup', 'dessert']

const inputCls =
  'mt-1 block w-full rounded-sm border border-edge bg-surface px-3 py-3 text-base text-ink placeholder:text-ink-muted/60'
const labelCls = 'block text-sm font-bold text-ink-muted'
// 「くわしく」タブの区分見出し(2026-07-28 便BW/C-10)。項目名(labelCls)より一段強く、
// 上に区切り線を置いて「ここから別の区分」と分かるようにする
const sectionHeadingCls =
  'mt-[var(--space-lg)] border-t border-edge pt-[var(--space-md)] text-base font-bold text-ink'
const iconBtnCls =
  'flex h-10 w-10 items-center justify-center rounded-sm border border-edge bg-surface text-ink-muted'

/**
 * URL取り込み・貼り付けが成功したときだけ、結果メッセージの下に出す価格の案内
 * （2026-08-02 オーナー指示・便DF）。取り込んだレシピにはしょうゆ・みりんのような調味料まで
 * 材料として並ぶが、「食材と価格」に価格の無い食材は概算食費に入らない。
 * 取り込んだ直後にその場から登録先へ行けるようにする（自動での価格設定はしない）。
 * 合わせ調味料の色分け（seasoningGroup）は概算の数値に影響しないため、この案内には含めない。
 */
function ImportPriceGuide() {
  return (
    <div className="mt-[var(--space-sm)]">
      <p className="text-sm text-ink-muted">{ja.form.importPriceGuide}</p>
      <Link to="/prices" className="mt-0.5 inline-block text-sm font-bold text-accent-ink underline">
        {ja.form.ingredientPriceGuideLink}
      </Link>
    </div>
  )
}

/**
 * 押されたEnterが「日本語入力の変換を確定するEnter」かどうか（2026-08-02 オーナー実機FB
 * 「エンターで行が増えて注力しづらい」の対策）。変換中のEnterで材料行・タグを作ってしまうと、
 * 変換を確定しただけのつもりが勝手に行が増える。
 * isComposing が本命で、keyCode 229 は compositionend が keydown より先に来る環境向けの保険
 */
function isImeConfirmKey(e: React.KeyboardEvent<HTMLInputElement>): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229
}

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
  // 材料の「まとめて入力」欄(2026-07-28 便BW/C-07)。入力途中の文字はフォームの値ではないので
  // 下書き(FormDraft)には含めない=「追加」を押した時点で材料行になる
  const [quickIngredient, setQuickIngredient] = useState('')
  // 材料行の整理(複数選択→まとめて削除。2026-08-02 オーナー実機FB)。食材の在庫の整理モードに倣う。
  // 選択は行の位置(index)で持つため、整理中は上下移動・1行ずつの削除を隠して位置がずれないようにし、
  // 行が増える操作(まとめて入力・材料を追加)では選択をいったん解除する
  const [ingredientOrganizing, setIngredientOrganizing] = useState(false)
  const [selectedIngredientIndexes, setSelectedIngredientIndexes] = useState<number[]>([])
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
  // 種別チップをユーザーが一度でも手で押したか(2026-07-23 便BH-1)。押すまでは料理名からの
  // 自動提案(guessDishType)を初期選択として表示し、押したら追従を止める(iconKeyの自動追従と同じ流儀)。
  const [dishTypeTouched, setDishTypeTouched] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // dishType の初期値提案(2026-07-23 便BH-1・docs/56 §3-2/§3-3): 料理名・タグ・材料から役割を推定する。
  const suggestedDishType = useMemo(
    () => guessDishType({ title, tags, ingredients: ingredients.map((r) => ({ name: r.name })) }),
    [title, tags, ingredients],
  )
  // 新規登録で、ユーザーがまだ種別チップを触っておらず・種別が未設定で・料理名が入っているときだけ
  // 提案を初期選択として見せる。既存レシピの編集では提案しない(既存の dishType を書き換えないため)。
  const showDishTypeSuggestion =
    !isEdit && !dishTypeTouched && dishType === undefined && title.trim() !== ''
  // 実際に「選択中」として扱う種別。未設定でも提案表示中なら提案値を使い、保存時もこの値を採用する。
  const effectiveDishType = dishType ?? (showDishTypeSuggestion ? suggestedDishType : undefined)

  // 「かんたん / くわしく」タブ(2026-07-16 Fable裁定docs/26・案A)。ページローカルの表示状態のみで、
  // 保存対象にも下書き対象にもしない(URLにも載せない)。新規・編集とも初期表示は常に「かんたん」
  const [activeTab, setActiveTab] = useState<'simple' | 'detail'>('simple')

  // URLから取り込む(エンドポイント未設定ならUI自体を表示しない。urlImport.tsのisUrlImportEnabled参照)
  const [urlImportOpen, setUrlImportOpen] = useState(false)
  const [urlImportValue, setUrlImportValue] = useState('')
  const [urlImportMessage, setUrlImportMessage] = useState('')
  // 結果メッセージの見た目(2026-07-28 便BW/C-02)。失敗・片側だけの取り込みは警告色+role="alert"で出し、
  // 成功と同じ顔にしない(件数だけを見て中身未確認のまま保存されるのを防ぐ)
  const [urlImportMessageTone, setUrlImportMessageTone] = useState<'info' | 'warn'>('info')
  const [urlImportLoading, setUrlImportLoading] = useState(false)
  // 「写真も取り込む」チェック(2026-07-21 オーナー指示)。ページローカルのその場限りの状態で、
  // 保存も設定への永続化もしない(このフォームを開くたび毎回既定ON)。OFFならapplyUrlImportが
  // importPhotoFromUrl(Worker画像プロキシ経由のfetchImportedPhoto)を呼ばない
  const [urlImportFetchPhoto, setUrlImportFetchPhoto] = useState(true)
  // 「写真も取り込む」がONで写真だけ取れなかったときの控えめな通知(2026-07-28 便BX/C01)。
  // レシピ本体の結果メッセージ(パネル内)とは別枠で、画面下のトーストとして数秒だけ出す
  const [urlImportToast, setUrlImportToast] = useState('')
  // 取り込みで分量が読み取れなかった材料の名前(2026-07-28 便BX/C09)。
  // 「どこを直せばよいか分からない」への最小限の答えで、大掛かりなプレビューUIは作らない。
  // 名前で覚えるので、行を並べ替えても印が付いたままになり、分量を入れれば自然に消える
  const [amountlessImportedNames, setAmountlessImportedNames] = useState<string[]>([])
  /**
   * URL取り込みの世代番号(2026-07-30 便CK/②-2・②-3)。「読み込む」を押すたび、
   * およびこの画面を離れるときに繰り上げる。取り込みの途中で解決した処理は、自分の世代が
   * まだ最新かを確かめてからフォームへ書き込む。
   * これが無かったため、①連続して取り込むと前のURLの写真が後から現在の内容の上に着弾し
   * (材料は新しいレシピ・写真は前のレシピ)「写真も取り込みました」も二重に付き、
   * ②画面を離れた後に「入力済みの材料1件・手順1件は…置き換わって消えます」の確認ダイアログが
   * 無関係な画面へ割り込んでいた(いま見ているレシピが壊されると誤解させる文面)
   */
  const urlImportGenerationRef = useRef(0)
  useEffect(
    () => () => {
      // 画面を離れたら、走っている取り込みの結果はすべて捨てる
      urlImportGenerationRef.current++
    },
    [],
  )

  // テキスト貼り付けで自動入力
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteMessage, setPasteMessage] = useState('')
  const [pasteMessageTone, setPasteMessageTone] = useState<'info' | 'warn'>('info')

  /** 取り込み時に分量が読み取れず、まだ空のままの行か(便BX/C09の控えめな印の表示条件) */
  const isImportedAmountless = (row: IngredientRow): boolean =>
    !row.amount.trim() &&
    !row.unit.trim() &&
    !!row.name.trim() &&
    amountlessImportedNames.includes(row.name.trim())

  const showPasteMessage = (message: string, tone: 'info' | 'warn') => {
    setPasteMessage(message)
    setPasteMessageTone(tone)
  }
  // 取り込み結果・エラーの表示欄はパネルの内側にしか無いため、読み込み中にパネルを閉じられると
  // 結果もエラーも一度も出ないまま終わっていた(2026-07-28 便BX/C03・QA S2)。
  // メッセージを出すときは必ずパネルを開き直し、どの経路でも結果が目に入るようにする
  const showUrlImportMessage = (message: string, tone: 'info' | 'warn') => {
    setUrlImportMessage(message)
    setUrlImportMessageTone(tone)
    setUrlImportOpen(true)
  }

  /**
   * 貼り付け・URL取り込みで入力済みの内容が置き換わるときの確認(規約F・2026-07-28 便BW/C-04)。
   * 置き換え先が実際に埋まっているときだけ確認を出し、消えるもの(件数)と残るものを両方伝える。
   * 続けてよければ true。1行削除に確認を出しているのに全行の置き換えが無警告だった不整合の解消。
   *
   * 2026-07-30 便CK/②-1(S1): 判定に写真を加えた。URL取り込みは既存の写真も無条件に差し替えるのに、
   * 確認文の「消えるもの」にも「残るもの」にも写真が無く、残るものを列挙しているぶん
   * 「写真は触られない」と読めてしまっていた(写真は端末内にしか無く、保存したら復元できない)。
   * photoPlanが'replace'なら、材料・手順が空でも確認を出す(料理名と写真だけのレシピを守るため)。
   */
  const confirmReplaceExisting = (
    itemsTemplate: string,
    parsedIngredientCount: number,
    parsedStepCount: number,
    /**
     * URL取り込み経路だけが渡す。写真の扱い(消える/残る)と「そのまま残るもの」の1文を
     * 確認文の後ろに足す。渡さない貼り付け経路は写真に触らないため、
     * テンプレート1本(末尾に残るものを含む形)で従来どおり完結する
     */
    photoPlan?: PhotoReplacePlan,
  ): boolean => {
    const filledIngredients = ingredients.filter(
      (row) => row.name.trim() || row.amount.trim() || row.unit.trim() || row.memo.trim(),
    ).length
    const filledSteps = steps.filter(
      (row) => row.text.trim() || row.minutes.trim() || row.memo.trim(),
    ).length
    const targets = replaceConfirmTargets({
      filledIngredients,
      filledSteps,
      parsedIngredients: parsedIngredientCount,
      parsedSteps: parsedStepCount,
      photoPlan: photoPlan ?? 'none',
    })
    if (!needsReplaceConfirm(targets)) return true
    const items: string[] = []
    if (targets.ingredients) {
      items.push(ja.paste.replaceItemIngredients.replace('{n}', String(filledIngredients)))
    }
    if (targets.steps) {
      items.push(ja.paste.replaceItemSteps.replace('{n}', String(filledSteps)))
    }
    // 「消えるもの」→ 写真の扱い →「残るもの」の順に並べる(規約F)
    const itemsText =
      items.length > 0
        ? itemsTemplate.replace('{items}', items.join(ja.paste.replaceItemSeparator))
        : ''
    // 貼り付け経路は写真に触らないので、従来どおりテンプレート1本で完結する(末尾に残るものを含む)
    if (photoPlan === undefined) return window.confirm(itemsText)
    const photoText = targets.photo ? ja.urlImport.confirmPhotoReplace : ''
    const keptText =
      photoPlan === 'kept' ? ja.urlImport.confirmReplaceKeptWithPhoto : ja.urlImport.confirmReplaceKept
    return window.confirm(`${itemsText}${photoText}${keptText}`)
  }

  const photoUrl = usePhotoUrl(photo)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  // 「アイコンから選ぶ」の折りたたみ開閉(2026-07-16 Fable裁定docs/30 裁定2)。保存stateにも
  // 下書きにも含めないUIローカルの表示状態のみ(下書き復元/リセット/貼り付けでは触らない)
  const [iconPickerOpen, setIconPickerOpen] = useState(false)

  // ---- 入力の全損防止: 下書きの自動保存と復元 ----
  const draftKey = draftStorageKey(editId)
  // 開いた時点で残っていた下書き(復元するか破棄するかをユーザーが選ぶまで保持)。
  // 取り出しと同時に退避キーへ移すので、バナー表示中も「いまの入力」の自動保存は止まらない(C-01)
  const [pendingDraft, setPendingDraft] = useState<FormDraft | null>(() => takePendingDraft(draftKey))
  // 「変更なし」とみなす基準のスナップショット(新規=空フォーム、編集=読み込んだレシピ)
  const baselineRef = useRef<string | null>(null)
  // 下書きを復元した場合、あとから届く既存レシピの読み込みで上書きしない(写真だけ引き継ぐ)
  const draftRestoredRef = useRef(false)

  // 編集モード: 既存レシピを読み込んでフォームに反映。
  // useLiveQueryで反応的に取得することで、アプリ起動直後の基本レシピ投入
  // (非同期)がまだ終わっていないタイミングでこの画面を直接開いても、
  // 投入完了後に自動で正しく読み込まれる（以前は読み込みが一度きりで、
  // 投入前に空振りすると空欄のまま固まる不具合があった）
  // 「まだ読み込み中」と「読み込んだが見つからなかった」を区別するため、結果を1枚くるんで返す
  // (2026-07-30 便CK/①-2)。useLiveQueryは未解決のあいだも undefined を返すので、素の
  // undefined では削除済み・存在しないIDの編集URLを見分けられず、案内も出せなかった
  const loadedRecipeResult = useLiveQuery(
    async () => ({
      recipe:
        editId !== undefined && !Number.isNaN(editId) ? await getRecipe(editId) : undefined,
    }),
    [editId],
  )
  const loadedRecipe = loadedRecipeResult?.recipe
  /** 編集URLのレシピが存在しない(削除済み・IDまちがい)ことが確定した状態 */
  const recipeMissing = isEdit && loadedRecipeResult !== undefined && loadedRecipeResult.recipe === undefined
  const settings = useSettings()
  const allRecipes = useLiveQuery(listRecipes, [])

  // タグ入力の候補(2026-07-24 便BN・タスク5): これまで登録した全レシピのタグを集計し、入力中の
  // 文字にマッチする既存タグをサジェストする。タップでそのまま採用でき、同じ意味のタグの表記ゆれ
  // (作り置き/作りおき 等)を防ぐ。使用回数の多い順→同数はかな順で安定させる
  const allExistingTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const r of allRecipes ?? []) {
      for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ja'))
      .map(([t]) => t)
  }, [allRecipes])
  // 入力中の文字にかな正規化で部分一致する既存タグ(既に付けたタグ・完全一致は除く)を最大8件。
  // 2026-07-28 便BW・QA S3: 漢字タグの読みにも対応する(「なつ」→「夏」、「つく」→「作り置き」)。
  // 従来はカタカナ⇄ひらがなと食材名辞書だけで、読みからは既存タグに辿り着けなかった
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim()
    if (!q) return []
    const qKey = toTagKey(q)
    return allExistingTags
      .filter((t) => !tags.includes(t) && t !== q && toTagKey(t).includes(qKey))
      .slice(0, 8)
  }, [allExistingTags, tagInput, tags])

  const hydratedRef = useRef(false)
  useEffect(() => {
    const recipe = loadedRecipe
    if (!recipe || hydratedRef.current) return
    hydratedRef.current = true
    // 「変更なし」の基準は、下書きを先に復元していても既存レシピ(保存済みの内容)にする。
    // 2026-07-30 便CK/①-2: 以前はこの分岐で baselineRef を設定せずに抜けており、null のままだと
    // 下書きの自動保存・離脱警告・キャンセル確認が3つまとめて無効になっていた
    // (復元後に書き足した内容が、警告も下書きも無いまま丸ごと失われる)
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
    if (draftRestoredRef.current) {
      // 下書きを先に復元済み: フォームは下書きの内容を優先し、
      // 下書きに含まれない写真だけ既存レシピから引き継ぐ。
      // 基準は上で保存済みレシピの内容にしてあるので、復元した内容は
      // 「未保存の変更」として正しく扱われる(自動保存も離脱警告も効く)
      setPhoto(recipe.photo)
      return
    }
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

  // 新規登録は「空フォーム」が基準(これと同じ内容なら未入力=保存しない)。
  // 2026-07-30 便CK/①-2: 編集モードでも同じ初期値を入れる。編集の基準は本来「読み込んだレシピ」で、
  // 読み込みが終われば上のhydrateが上書きするが、それまで(と、レシピが見つからなかったとき)
  // baselineRefがnullのままだと自動保存・離脱警告・キャンセル確認がまとめて止まっていた。
  // 読み込み中は空フォームと同じ内容なので「変更なし」の判定は変わらない
  useEffect(() => {
    baselineRef.current = currentSerialized
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 入力が変わるたびに下書きを自動保存する(基準と同じ内容なら消す)。
  // 復元バナーの表示中も止めない: 開いた時点の下書きは退避キーへ移してあるので上書きは起きない(C-01)
  useEffect(() => {
    if (baselineRef.current === null) return
    if (currentSerialized === baselineRef.current) removeMainDraft(draftKey)
    else writeDraftEnvelope(draftKey, currentSerialized)
  }, [currentSerialized, draftKey])

  // ブラウザを閉じる・再読み込みするとき、未保存の入力があれば標準の確認を出す。
  // 復元バナーの表示中も対象にする(以前はバナー中だけ離脱警告も無効だった。C-01)
  const dirtyRef = useRef(false)
  dirtyRef.current = baselineRef.current !== null && currentSerialized !== baselineRef.current
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // 保存前の指摘(「料理名を入力してください」等)は、入力を直した時点で消す(2026-07-28 便BW・QA S3)。
  // 以前は次に保存を押すまで赤いエラーが残り続け、直したのに直っていないように見えていた
  useEffect(() => {
    setError((current) => (current ? '' : current))
  }, [currentSerialized])

  /** 下書きをフォームに反映する(写真は下書きに含まれないため、編集では既存レシピの写真を引き継ぐ) */
  const restoreDraft = () => {
    const d = pendingDraft
    if (!d) return
    // バナーを無視して書き続けた内容がある場合は、無警告で置き換えない(規約F・C-01)
    if (
      baselineRef.current !== null &&
      currentSerialized !== baselineRef.current &&
      !window.confirm(ja.form.draftRestoreConfirm)
    ) {
      return
    }
    draftRestoredRef.current = true
    setTitle(d.title ?? '')
    setIntro(d.intro ?? '')
    // 下書きの人数分も範囲に収める(便CK/①-1)。以前は素通しで、servings:99 の下書きを復元すると
    // 99人分になり、そのまま保存できていた
    setServings(clampServings(d.servings ?? 2))
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
    // 退避しておいた下書きは役目を終える(この後は復元した内容が本体キーへ自動保存される)
    removeAllDrafts(draftKey)
    setPendingDraft(null)
  }

  /** 残っていた下書きだけを捨てる(いま入力中の内容はそのまま自動保存を続ける) */
  const discardDraft = () => {
    try {
      localStorage.removeItem(heldDraftKey(draftKey))
    } catch {
      /* 無視 */
    }
    setPendingDraft(null)
  }

  /** 書きかけ・退避の両方を消す(保存・削除・キャンセルで用が済んだとき) */
  const clearDraft = () => {
    removeAllDrafts(draftKey)
  }

  /**
   * URL取り込みで見つかった写真(imageUrl)をベストエフォートで取得してフォームへセットする
   * (2026-07-21 オーナー要望・Fable設計)。Worker側の画像プロキシ(/image?url=)経由で取得し、
   * 既存のresizePhoto(写真選択時と同じ圧縮パラメータ)にかけてからセットする。
   * 失敗してもレシピ本体の取り込みは成功のままにするため、ここでの失敗はエラー表示せず静かに諦める
   * (写真だけ無し=従来どおりアイコン表示)。applyUrlImportからはawaitせずに呼ぶ想定
   * (取り込み結果メッセージは先に確定させ、写真は後から差し込まれてもよい)。
   * 呼び出し元(applyUrlImport)で「写真も取り込む」チェックがONのときだけ呼ばれる
   * (2026-07-21 オーナー指示のスイッチ。OFFならこの関数自体を呼ばない)。
   */
  const importPhotoFromUrl = async (imageUrl: string, generation: number, hadPhoto: boolean) => {
    const blob = await fetchImportedPhoto(IMPORT_ENDPOINT, imageUrl)
    // 自分より後に始まった取り込みがあれば、この写真はもう「前のURLの写真」なので捨てる(便CK/②-2)。
    // 画面を離れた場合(unmount)もここで止まる
    if (generation !== urlImportGenerationRef.current) return
    // 2026-07-28 便BX/C01: 取れなかったときも完全な無言はやめる。レシピ本体は取り込めているので
    // 成功メッセージ(パネル内)はそのままにし、写真だけ入らなかったことをトーストで控えめに伝える
    if (!blob) {
      setUrlImportToast(ja.urlImport.photoNotImported)
      return
    }
    try {
      const resized = await resizePhoto(blob)
      if (generation !== urlImportGenerationRef.current) return
      setPhoto(resized)
      // 写真を新しく取得できたら、それまでアイコン優先だったとしても取り込んだ写真を見せる
      // (onPhotoSelectedと同じ扱い。2026-07-16 Fable裁定docs/30 裁定2の状態対応を踏襲)
      setShowIconInsteadOfPhoto(false)
      // 元から写真があった場合は「置き換わった」と書く(便CK/②-1。「写真も取り込みました」は
      // 足しただけのように読めるため)
      const note = hadPhoto ? ja.urlImport.photoReplaced : ja.urlImport.photoImported
      setUrlImportMessage((prev) => (prev ? `${prev} ${note}` : prev))
    } catch {
      // resizePhotoの失敗(壊れた画像等)もベストエフォート。取り込みは止めないが、
      // 「写真も取り込む」がONだった以上は結果を黙らせない(便BX/C01)
      if (generation !== urlImportGenerationRef.current) return
      setUrlImportToast(ja.urlImport.photoNotImported)
    }
  }

  /**
   * URLを取り込んでフォームに流し込む（結果はユーザーが修正できる。applyPasteと同じ流し込み先を再利用する）。
   * ingredients は Worker側で name+amount(単位くっつき)までしか分けていないため、ここで貼り付け経路と
   * 同じ normalizeImportedIngredient(parseIngredientLineと同一資産)に通して name/amount/unit/memo へ
   * 分解する。Worker側の分割はコロン書式「木綿豆腐: 75 g」や括弧グラム併記「小さじ1/3 (1 g)」で
   * name に分量が食い込むため、元の1行に組み直して貼り付け側と同一ロジックで解釈し直す(経路統一)。
   */
  const applyUrlImport = async () => {
    const target = urlImportValue.trim()
    if (!target) {
      showUrlImportMessage(ja.urlImport.empty, 'warn')
      return
    }
    // この取り込みの世代番号(便CK/②-2・②-3)。読み込むを押すたびに繰り上がり、
    // 画面を離れるときにも繰り上がる。以降の処理は「自分がまだ最新か」を確認してから画面へ書く。
    // 従来は連続して取り込むと、前のURLの写真が後から現在の内容の上に着弾し(材料は新しい
    // レシピ・写真は前のレシピ)、画面を離れた後でも古い件数のままの確認ダイアログが割り込んでいた
    const generation = ++urlImportGenerationRef.current
    setUrlImportLoading(true)
    setUrlImportMessage('')
    setUrlImportToast('')
    try {
      const result = await importRecipeFromUrl(target)
      // 待っているあいだに画面を離れた・別のURLで取り込み直したなら、ここで静かに終わる。
      // window.confirmは「いま見ている画面」を止めてしまうので、必ず出す前に確認する(便CK/②-3)
      if (generation !== urlImportGenerationRef.current) return
      // 貼り付け経路と同じゴミ行判定を通し、グループ見出しをグループ色へ引き継ぐ(便BX/C07・C08)。
      // 以降の件数(確認文・結果メッセージ)はすべてこの整形後の件数で数える
      const importedRows = buildImportedIngredientRows(result.ingredients)
      const importedSteps = filterImportedSteps(result.steps)
      // 写真がどうなるかを先に決める(便CK/②-1)。「写真も取り込む」がONで、いま写真があるなら
      // 置き換わって消える=確認文にそう書く。OFFなら残ることを書く
      const hadPhoto = photo !== undefined
      const photoPlan = photoReplacePlan(hadPhoto, urlImportFetchPhoto && !!result.imageUrl)
      // 入力済みの材料・手順・写真を置き換える前に確認する(規約F・C-04。貼り付け経路と同じ扱い)
      if (
        !confirmReplaceExisting(
          ja.urlImport.confirmReplace,
          importedRows.length,
          importedSteps.length,
          photoPlan,
        )
      ) {
        // 中止したことを必ず返事する(2026-07-28 便BX/C16・QA S3)。
        // 従来は冒頭で消したメッセージ欄が空のまま戻り、押した結果が一切分からなかった
        showUrlImportMessage(ja.urlImport.canceled, 'warn')
        return
      }
      // 材料・手順以外にも黙って置き換わる項目(人数分・調理時間・参照元URL)があるので、
      // 実際に値が変わったものだけを後で結果メッセージに書き添える(便BX/C02・ペルソナ5/5一致)
      const alsoApplied: string[] = []
      // 範囲に収めた後の値で見る(便CK/①-1。48人分→20人分のように丸めた結果、実際には
      // 人数分が変わらないこともある)
      const nextServings = result.servings ? clampServings(result.servings) : undefined
      if (nextServings !== undefined && nextServings !== servings) {
        alsoApplied.push(ja.urlImport.alsoAppliedServings)
      }
      if (result.cookMinutes && String(result.cookMinutes) !== cookMinutes.trim()) {
        alsoApplied.push(ja.urlImport.alsoAppliedCookMinutes)
      }
      const nextSourceUrl = result.sourceUrl || target
      if (sourceUrl.trim() && sourceUrl.trim() !== nextSourceUrl) {
        alsoApplied.push(ja.urlImport.alsoAppliedSourceUrl)
      }
      const alsoAppliedNote =
        alsoApplied.length > 0
          ? `。${ja.urlImport.alsoApplied.replace(
              '{items}',
              alsoApplied.join(ja.urlImport.alsoAppliedSeparator),
            )}`
          : ''
      if (result.title && !title.trim()) setTitle(result.title)
      // 取り込んだ人数分も範囲(1〜20)に収める(便CK/①-1)。Worker側のextractServingsに上限が無く、
      // 「24 cookies」等の表記から20超が入りうるが、手入力では作れない値なので保存させない
      if (nextServings !== undefined) setServings(nextServings)
      if (result.cookMinutes) setCookMinutes(String(result.cookMinutes))
      if (importedRows.length > 0) setIngredients(importedRows)
      // 分量が読み取れなかった行に印を付ける(便BX/C09)。取り込むたびに入れ替える
      setAmountlessImportedNames(
        importedRows.filter((row) => !row.amount.trim() && !row.unit.trim()).map((row) => row.name),
      )
      if (importedSteps.length > 0) {
        setSteps(importedSteps.map((text) => ({ text, minutes: '', memo: '' })))
      }
      setSourceUrl(nextSourceUrl)
      // 取り込んだ内容から役割(dishType)を自動推定して初期値にする(2026-07-23 便BH-1・docs/56 §3-4)。
      // 新規登録では料理名からの自動提案に任せる(applyPasteと同じ理由・便BW)。
      // 編集中のレシピで種別が未設定のときだけ、ここで初期値を入れる。
      if (isEdit && dishType === undefined) {
        const guessedTitle = title.trim() || result.title || ''
        const guessedIngredients =
          importedRows.length > 0
            ? importedRows.map((row) => ({ name: row.name }))
            : ingredients.map((r) => ({ name: r.name }))
        if (guessedTitle) {
          setDishType(guessDishType({ title: guessedTitle, tags, ingredients: guessedIngredients }))
        }
      }
      // 片側だけ読み込めたときは警告トーンで正直に伝える(便BW/C-02。貼り付け経路と同じ扱い)。
      // どの結果文にも、材料・手順以外で置き換わった項目(便BX/C02)を書き添える
      if (importedRows.length === 0) {
        showUrlImportMessage(
          ja.urlImport.resultNoIngredients.replace('{s}', String(importedSteps.length)) + alsoAppliedNote,
          'warn',
        )
      } else if (importedSteps.length === 0) {
        showUrlImportMessage(
          ja.urlImport.resultNoSteps.replace('{i}', String(importedRows.length)) + alsoAppliedNote,
          'warn',
        )
      } else {
        // 件数だけでは「どこを直せばよいか」が分からないという5体一致の指摘への最小限の答え
        // (便BX/C09ライト版)。分量を読み取れなかった件数だけ内訳として添える
        const amountless = countAmountlessRows(importedRows)
        showUrlImportMessage(
          ja.urlImport.resultSummary
            .replace('{i}', String(importedRows.length))
            .replace(
              '{a}',
              amountless > 0
                ? ja.urlImport.resultAmountless.replace('{n}', String(amountless))
                : '',
            )
            .replace('{s}', String(importedSteps.length)) + alsoAppliedNote,
          'info',
        )
      }
      // 写真はベストエフォート(Worker経由の取得・変換は非同期で後から差し込まれてもよい)。
      // await しない: 材料・手順の取り込み結果メッセージをここで即座に確定させるため。
      // 「写真も取り込む」チェックがOFFのときは取得自体を行わない(2026-07-21 オーナー指示のスイッチ)
      if (result.imageUrl && urlImportFetchPhoto) {
        void importPhotoFromUrl(result.imageUrl, generation, hadPhoto)
      }
    } catch (e) {
      // 画面を離れた後・取り込み直した後のエラーは出さない(便CK/②-3)
      if (generation !== urlImportGenerationRef.current) return
      const reason = e instanceof UrlImportError ? e.reason : 'fetch_failed'
      showUrlImportMessage(URL_IMPORT_ERROR_MESSAGE[reason] ?? ja.urlImport.errorFetchFailed, 'warn')
    } finally {
      if (generation === urlImportGenerationRef.current) setUrlImportLoading(false)
    }
  }

  /** 貼り付けた文章を解析してフォームに流し込む（結果はユーザーが修正できる） */
  const applyPaste = () => {
    if (!pasteText.trim()) {
      showPasteMessage(ja.paste.empty, 'warn')
      return
    }
    const parsed = parseRecipeText(pasteText)
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      showPasteMessage(ja.paste.resultNone, 'warn')
      return
    }
    // 入力済みの材料・手順を置き換える前に確認する(規約F・C-04)
    if (!confirmReplaceExisting(ja.paste.confirmReplace, parsed.ingredients.length, parsed.steps.length)) {
      return
    }
    if (parsed.title && !title.trim()) setTitle(parsed.title)
    // 貼り付けた「50人分」も範囲に収める(便CK/①-1。手では21人分以上を作れないのに素通りしていた)
    if (parsed.servings) setServings(clampServings(parsed.servings))
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
    // 取り込んだ内容から役割(dishType)を自動推定して初期値にする(2026-07-23 便BH-1・docs/56 §3-4)。
    // 新規登録では料理名からの自動提案(showDishTypeSuggestion)が同じ推定を担うので、ここでは値を
    // 書き込まない: 書き込むと「料理名から自動でえらびました」の説明だけが出ないままになるため
    // (2026-07-28 便BW・QA S3。手入力経路と貼り付け経路で見え方を揃える)。
    // 編集中のレシピで種別が未設定のときだけ、従来どおりここで初期値を入れる。
    if (isEdit && dishType === undefined) {
      const guessedTitle = title.trim() || parsed.title || ''
      const guessedIngredients =
        parsed.ingredients.length > 0
          ? parsed.ingredients.map((row) => ({ name: row.name }))
          : ingredients.map((r) => ({ name: r.name }))
      if (guessedTitle) {
        setDishType(guessDishType({ title: guessedTitle, tags, ingredients: guessedIngredients }))
      }
    }
    // 材料・手順のどちらもほぼ拾えなかった(段落丸ごと1文になった等)場合は、
    // 読み取れた分はフォームへ流し込んだ上で、うまく振り分けられなかった旨を正直に案内する
    if (looksPoorlyParsed(pasteText, parsed)) {
      showPasteMessage(ja.paste.resultPoor, 'warn')
      return
    }
    // 片側だけ読み取れたときは件数だけを出さず、読み取れなかった側を名指しして警告トーンで出す
    // (2026-07-28 便BW/C-02: 「材料0件・手順3件」が成功と同じ顔で出ていた)
    if (parsed.ingredients.length === 0) {
      showPasteMessage(ja.paste.resultNoIngredients.replace('{s}', String(parsed.steps.length)), 'warn')
      return
    }
    if (parsed.steps.length === 0) {
      showPasteMessage(ja.paste.resultNoSteps.replace('{i}', String(parsed.ingredients.length)), 'warn')
      return
    }
    showPasteMessage(
      ja.paste.resultSummary
        .replace('{i}', String(parsed.ingredients.length))
        .replace('{s}', String(parsed.steps.length)),
      'info',
    )
  }

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhoto(await resizePhoto(file))
      // 写真を新しく取得できたら、それまでアイコン優先(showIconInsteadOfPhoto)だったとしても
      // 撮った/選んだ写真を見せる(2026-07-16 Fable裁定docs/30 裁定2の状態対応)
      setShowIconInsteadOfPhoto(false)
      setError('')
    } catch {
      setError(ja.form.photoError)
    }
  }

  /** アイコン(自動含む)をタップしたときの処理。選択の反映に加えて、写真が既に設定済みなら
   * 「アイコンを画像として使う」(showIconInsteadOfPhoto)を自動でONにする(2026-07-16 Fable裁定
   * docs/30 裁定2 = アイコンから選ぶことは「画像」の3択の1つという扱い)。写真が無いときはこの
   * フラグを触らない(そもそも表示はアイコンのまま)。くわしくタブの手動トグルは引き続き上書き可能 */
  const handleIconTap = (key: IconKey | undefined) => {
    setIconKey(key)
    if (photo) setShowIconInsteadOfPhoto(true)
  }

  const updateIngredient = (index: number, patch: Partial<IngredientRow>) => {
    setIngredients((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  /**
   * 材料の「まとめて入力」(2026-07-28 便BW/C-07)。
   * 「豚こま 200g」のように1行で書いた材料を、名前/分量/単位に分けて1行追加する。
   * 分解には貼り付け取込と同じロジック(normalizeImportedIngredient→parseIngredientLine)を使い、
   * 分けられなかったときは名前の欄にそのまま入れる(黙って捨てない)。
   * 3マスの入力欄は従来どおり残し、こちらは速記の入口として足すだけ。
   */
  const addQuickIngredient = () => {
    const text = quickIngredient.trim()
    if (!text) return
    const parsed = normalizeImportedIngredient(text)
    const row: IngredientRow = {
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      memo: parsed.memo ?? '',
      group: undefined,
    }
    setIngredients((rows) => {
      const last = rows[rows.length - 1]
      const lastIsEmpty =
        last && !last.name.trim() && !last.amount.trim() && !last.unit.trim() && !last.memo.trim()
      return lastIsEmpty ? [...rows.slice(0, -1), row] : [...rows, row]
    })
    // 整理中に行が増えると、位置で持っている選択がずれる(最後の空行が差し替わる場合がある)。
    // 消す行を取り違えないよう、選択はいったん解除する
    setSelectedIngredientIndexes([])
    setQuickIngredient('')
  }

  /** 材料の「整理」モードの出入り。抜けるときは選択を空にする（次に入ったとき選択が残っていない） */
  const toggleIngredientOrganizing = () => {
    setIngredientOrganizing((on) => !on)
    setSelectedIngredientIndexes([])
  }
  const toggleIngredientSelected = (index: number) => {
    setSelectedIngredientIndexes((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    )
  }
  const selectAllIngredients = () => setSelectedIngredientIndexes(ingredients.map((_, i) => i))
  const clearIngredientSelection = () => setSelectedIngredientIndexes([])
  /**
   * 選んだ材料行をまとめて削除する（2026-08-02 オーナー実機FB）。
   * 規約F: 何が消えて何が残るかを件数つきで両方書いてから消す。
   * すべて選んだときは行が0になるので、1行ずつの削除と同じく空の1行を残す
   */
  const removeSelectedIngredients = () => {
    const count = selectedIngredientIndexes.length
    if (count === 0) return
    const remaining = ingredients.length - count
    const message =
      remaining > 0
        ? ja.form.ingredientOrganizeConfirm
            .replace('{n}', String(count))
            .replace('{m}', String(remaining))
        : ja.form.ingredientOrganizeConfirmAll.replace('{n}', String(count))
    if (!window.confirm(message)) return
    const drop = new Set(selectedIngredientIndexes)
    setIngredients((rows) => {
      const kept = rows.filter((_, i) => !drop.has(i))
      return kept.length > 0 ? kept : [{ ...emptyIngredient }]
    })
    setSelectedIngredientIndexes([])
    // 1行になったら整理することが無くなるので、そのまま通常の入力に戻す
    if (remaining <= 1) setIngredientOrganizing(false)
  }
  /**
   * 材料の数量欄・単位欄のblurで、全角入力を自動でNFKC半角化する(2026-07-21全角対応。
   * オーナー実機報告:「アサリ 300ｇ」の全角ｇだと栄養計算に反映されない・数量も全角で入力できて
   * しまう)。onChangeではなくonBlurでだけ発火するため、IME変換中(compositionstart〜end)には
   * 介入しない(blurは常にIMEのcompositionend後に発火するため、確定前の文字が正規化で壊れることはない)。
   * 値が実際に変わるときだけ更新し(無変化の再レンダーを避ける)、他のフィールドと同じ
   * updateIngredientで反映する
   */
  const normalizeIngredientFieldOnBlur =
    (index: number, field: 'amount' | 'unit') => (e: React.FocusEvent<HTMLInputElement>) => {
      const normalized = normalizeAmountInput(e.target.value)
      if (normalized !== e.target.value) updateIngredient(index, { [field]: normalized })
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

  const addTagValue = (value: string) => {
    const tag = value.trim()
    if (tag && !tags.includes(tag)) setTags([...tags, tag])
    setTagInput('')
  }
  const addTag = () => addTagValue(tagInput)

  const addKeyword = () => {
    const keyword = keywordInput.trim()
    if (keyword && !keywords.includes(keyword)) setKeywords([...keywords, keyword])
    setKeywordInput('')
  }

  /**
   * 保存前の指摘(2026-07-28 便BW)。入力は消さずにその場に残したまま、直すべき場所を伝えて止める。
   * 指摘した項目が隠れたタブにあるままにならないよう、該当するタブへ切り替えて先頭までスクロールする
   * (料理名未入力で「かんたん」へ戻す既存の扱い=Fable裁定docs/26 論点4 と同じ考え方)
   */
  const failValidation = (message: string, tab: 'simple' | 'detail') => {
    setError(message)
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const save = async () => {
    // 編集しようとしたレシピが無いのに保存を続けると、updateRecipeが何も書き換えないまま
    // 「レシピが見つかりませんでした」の画面へ飛び、書いた内容が無言で消える(便CK/①-2)。
    // 保存を押す前から画面にも出しているが、ここでも最後の網として止める
    if (recipeMissing) {
      failValidation(ja.form.recipeNotFound, 'simple')
      return
    }
    if (!title.trim()) {
      failValidation(ja.form.nameRequired, 'simple')
      return
    }
    if (title.trim().length > MAX_TITLE_LENGTH) {
      failValidation(ja.form.nameTooLong.replace('{n}', String(title.trim().length)), 'simple')
      return
    }
    // 名前が空で分量・単位・メモだけの材料行は保存されない(db/recipes.tsのcleanInput)。
    // 黙って消さず、行を残したまま指摘する(C-17)
    const namelessIngredient = ingredients.findIndex(
      (row) =>
        !row.name.trim() && (row.amount.trim() || row.unit.trim() || row.memo.trim()),
    )
    if (namelessIngredient >= 0) {
      failValidation(
        ja.form.ingredientNameRequired.replace('{n}', String(namelessIngredient + 1)),
        'simple',
      )
      return
    }
    const textlessStep = steps.findIndex(
      (row) => !row.text.trim() && (row.minutes.trim() || row.memo.trim()),
    )
    if (textlessStep >= 0) {
      failValidation(ja.form.stepTextRequired.replace('{n}', String(textlessStep + 1)), 'simple')
      return
    }
    // 負の値・数字でない値のガード(C-20)。保存はできるのに表示されない値を作らない
    if (cookMinutes.trim() && !isNonNegativeNumber(cookMinutes)) {
      failValidation(ja.form.cookMinutesInvalid, 'detail')
      return
    }
    const invalidStepMinutes = steps.findIndex(
      (row) => row.minutes.trim() && !isNonNegativeNumber(row.minutes),
    )
    if (invalidStepMinutes >= 0) {
      failValidation(
        ja.form.stepMinutesInvalid.replace('{n}', String(invalidStepMinutes + 1)),
        'simple',
      )
      return
    }
    // 参照元URLはhttp/httpsのみ(C-19)。押しても何も起きないリンクを作らない
    if (sourceUrl.trim() && !isHttpUrl(sourceUrl)) {
      failValidation(ja.form.sourceUrlInvalid, 'detail')
      return
    }
    // 人数分の範囲(1〜20)は取り込み・貼り付け・下書き復元でも丸めるようにしたので、通常ここは通る。
    // 保存前の最後の網として見ておく(便CK/①-1)。ただし、この対応より前に範囲外で保存されていた
    // レシピをそのまま編集・保存できるよう、読み込んだレシピ自身の人数分は通す
    if (!isServingsInRange(servings) && servings !== loadedRecipe?.servings) {
      failValidation(ja.form.servingsOutOfRange.replace('{n}', String(servings)), 'simple')
      return
    }
    if (!isEdit && isAtFreeLimit(countFreeLimitRecipes(allRecipes ?? []), !!settings?.proCode)) {
      setError(ja.form.freeLimitBlocked)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setSaving(true)
    try {
      // タグ・キーワードは「追加」を押したものだけを保存する(2026-07-28 便BW・QA S3)。
      // 以前は打ちかけの文字も保存時に自動でタグ化していたため、候補を見るために打ってやめた
      // 文字列までタグになっていた。押し忘れ対策は入力中に出す案内(tagPending)で行う
      const effectiveTags = tags
      const effectiveKeywords = keywords

      const input: RecipeInput = {
        title,
        intro: intro.trim() || undefined,
        photo,
        servings,
        cookMinutes: cookMinutes.trim() ? Number(cookMinutes) : undefined,
        effortLevel,
        tags: effectiveTags,
        // 未設定でも新規登録なら自動提案値を初期値として保存する(effectiveDishType)。
        // 既存レシピの編集では dishType(=既存値 or 未設定)がそのまま入り、勝手に付与しない。
        dishType: effectiveDishType,
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

  /**
   * キャンセルで抜ける(2026-07-28 便BW/C-16)。
   * 以前はリンクで戻るだけで下書きが残り、次に新規登録を開くたび「復元しますか？」が出ていた
   * （取りやめの意図と食い違う）。書きかけがあるときだけ確認を出し、確認できたら下書きも消す。
   */
  const handleCancel = () => {
    if (dirtyRef.current && !window.confirm(ja.form.confirmCancel)) return
    clearDraft()
    dirtyRef.current = false
    navigate(isEdit && editId !== undefined ? `/recipes/${editId}` : '/recipes')
  }

  const remove = async () => {
    if (editId === undefined) return
    // 削除で巻き添えになるもの(作った記録・記録写真)の件数を確認文に入れる(規約F・便CI/C01)。
    // cookedLogsはRecipe埋め込み配列なのでloadedRecipeから同期的に数えられる
    const logs = loadedRecipe?.cookedLogs ?? []
    const confirmText = ja.form.confirmDelete
      .replace('{n}', String(logs.length))
      .replace('{p}', String(logs.filter((log) => log.photo).length))
    if (!window.confirm(confirmText)) return
    await deleteRecipe(editId)
    clearDraft()
    dirtyRef.current = false
    navigate('/recipes', { replace: true })
  }

  // ---- 「デフォルトに戻す」(2026-07-15 オーナー要望・編集モードのみ) ----
  // DBへは書き込まず、フォームの入力値だけを差し替える（保存を押すまで確定しない安全設計）。
  // 戻し先は2分岐: 自作レシピ=前回保存値(loadedRecipe自身) / 基本レシピ=starterDefsの原本。
  // テーマ全廃(2026-07-23)で旧配布セット由来の品も starterDefs に合流したため、isStarterなら
  // 料理名一致でstarterDefsの原本を探せる（旧: 配布セット由来は/sets/data/<setId>.jsonをfetchしていた）。
  // どちらの分岐も「フォームに現れるフィールド」だけを対象にし、title・photo・iconKey・
  // showIconInsteadOfPhotoは常にloadedRecipe(既存の保存値)側から取る（reloadStarterRecipesの
  // 入れ直しが「表示設定はユーザーのものを保持する」のと同じ考え方。自作レシピ分岐ではこれも
  // loadedRecipe由来なので実質「全部を前回保存値に戻す」になる）
  const resetVariant: 'own' | 'starter' | undefined = !loadedRecipe
    ? undefined
    : loadedRecipe.isStarter
      ? 'starter'
      : 'own'

  const [resetArmed, setResetArmed] = useState(false)
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

  const performReset = () => {
    if (resetVariant === 'own') resetToOwn()
    else if (resetVariant === 'starter') resetToStarter()
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

      {/* 編集しようとしたレシピが無いとき(削除済み・IDまちがい)は、保存を押す前に伝える
          (2026-07-30 便CK/①-2)。以前は何の案内も出ないまま入力でき、「保存する」を押すと
          無言で「レシピが見つかりませんでした」の画面へ飛び、1件も保存されていなかった */}
      {recipeMissing && error !== ja.form.recipeNotFound && (
        <p
          role="alert"
          className="mt-[var(--space-sm)] rounded-sm border border-warning px-3 py-2 font-bold text-warning"
        >
          {ja.form.recipeNotFound}
        </p>
      )}

      {/* 書きかけの下書きがあれば復元を提案(誤操作による入力全損の防止) */}
      {pendingDraft && (
        <div className="mt-[var(--space-sm)] rounded-md border border-accent bg-surface p-[var(--space-md)] shadow-sm">
          <p className="font-bold text-ink">{ja.form.draftFound}</p>
          <p className="mt-1 text-sm text-ink-muted">{ja.form.draftFoundNote}</p>
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

      {/* URLから取り込む(エンドポイント未設定=Workerデプロイ前はUI自体を表示しない) */}
      {isUrlImportEnabled() && (
        <>
          <button
            type="button"
            onClick={() => setUrlImportOpen((open) => !open)}
            aria-expanded={urlImportOpen}
            className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent py-3 font-bold text-accent-ink"
          >
            <Globe size={20} aria-hidden />
            {ja.urlImport.open}
          </button>
          {urlImportOpen && (
            <div className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
              <p className="text-sm text-ink-muted">{ja.urlImport.description}</p>
              <input
                type="url"
                inputMode="url"
                value={urlImportValue}
                onChange={(e) => setUrlImportValue(e.target.value)}
                placeholder={ja.urlImport.placeholder}
                className="mt-[var(--space-sm)] block w-full rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60"
              />
              <label className="mt-[var(--space-sm)] flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={urlImportFetchPhoto}
                  onChange={(e) => setUrlImportFetchPhoto(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
                />
                <span>
                  {ja.urlImport.fetchPhoto}
                  <span className="mt-0.5 block text-xs text-ink-muted">{ja.urlImport.fetchPhotoNote}</span>
                </span>
              </label>
              {/* 取り込み結果は成功時もスクリーンリーダーへ伝える(2026-07-28 便BX/C17・QA S3)。
                  失敗・片側だけの警告は従来どおり role="alert" で割り込ませ、成功は
                  role="status" + aria-live="polite" で邪魔をせず読み上げる */}
              {urlImportMessage && (
                <p
                  role={urlImportMessageTone === 'warn' ? 'alert' : 'status'}
                  aria-live={urlImportMessageTone === 'warn' ? undefined : 'polite'}
                  className={
                    urlImportMessageTone === 'warn'
                      ? 'mt-[var(--space-sm)] rounded-sm border border-warning px-3 py-2 text-sm font-bold text-warning'
                      : 'mt-[var(--space-sm)] text-sm font-bold text-accent-ink'
                  }
                >
                  {urlImportMessage}
                </p>
              )}
              {/* 取り込めたときだけ出す価格の案内(2026-08-02 オーナー指示・便DF)。
                  取り込んだレシピには調味料まで材料に並ぶが、「食材と価格」に価格が無い食材は
                  概算食費に入らない。結果メッセージ(info=成功時のみ)の下に1行＋登録先への近道を置く */}
              {urlImportMessage && urlImportMessageTone === 'info' && <ImportPriceGuide />}
              <div className="mt-[var(--space-sm)] flex gap-2">
                <button
                  type="button"
                  onClick={() => void applyUrlImport()}
                  disabled={urlImportLoading}
                  aria-busy={urlImportLoading}
                  className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm disabled:opacity-60"
                >
                  {urlImportLoading ? ja.urlImport.loading : ja.urlImport.apply}
                </button>
                {/* 読み込み中は閉じられないようにする(2026-07-28 便BX/C03・QA S2)。
                    閉じると結果もエラーも出ないままフォームだけが置き換わっていた。
                    待ち時間はWorker側のFETCH_TIMEOUT_MS(8秒)で上限が担保されている */}
                <button
                  type="button"
                  onClick={() => setUrlImportOpen(false)}
                  disabled={urlImportLoading}
                  className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted disabled:opacity-60"
                >
                  {ja.urlImport.close}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* テキスト貼り付けで自動入力 */}
      <button
        type="button"
        onClick={() => setPasteOpen((open) => !open)}
        aria-expanded={pasteOpen}
        className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-accent py-3 font-bold text-accent-ink"
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
            <p
              role={pasteMessageTone === 'warn' ? 'alert' : undefined}
              className={
                pasteMessageTone === 'warn'
                  ? 'mt-[var(--space-sm)] rounded-sm border border-warning px-3 py-2 text-sm font-bold text-warning'
                  : 'mt-[var(--space-sm)] text-sm font-bold text-accent-ink'
              }
            >
              {pasteMessage}
            </p>
          )}
          {/* 貼り付け経路にも同じ案内を出す(2026-08-02 オーナー指示・便DF。URL取り込みと同じ扱い) */}
          {pasteMessage && pasteMessageTone === 'info' && <ImportPriceGuide />}
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
            activeTab === 'simple' ? 'border-accent text-accent-ink' : 'border-transparent text-ink-muted'
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
            activeTab === 'detail' ? 'border-accent text-accent-ink' : 'border-transparent text-ink-muted'
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
      {/* ●の意味を画面上でも示す(2026-07-28 便BW/C-10)。●が出ている間だけの控えめな1行 */}
      {hasDetailInput && (
        <p className="mt-1 text-xs text-ink-muted">{ja.form.formTabDetailFilledLegend}</p>
      )}

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
            {/* 下限(1人分)・上限(20人分)に達したらボタン自体を無効にする(2026-07-28 便BW・QA S3:
                下限でも押せて無反応・上限がなく31人分まで増やせた) */}
            <button
              type="button"
              onClick={() => setServings((n) => Math.max(MIN_SERVINGS, n - 1))}
              disabled={servings <= MIN_SERVINGS}
              className={`${iconBtnCls} disabled:opacity-40`}
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
              onClick={() => setServings((n) => Math.min(MAX_SERVINGS, n + 1))}
              disabled={servings >= MAX_SERVINGS}
              className={`${iconBtnCls} disabled:opacity-40`}
              aria-label={ja.detail.servingsUp}
            >
              ＋
            </button>
          </div>
        </label>
      </div>

      {/* 料理の種別（2026-07-28 便BW/C-05）。「くわしく」タブと同じ選択をここにも出す。
          実機QAでは麦茶・ぬか漬け・みそ汁などが自動で「主菜」に決まったまま保存され、
          献立プランナーの提案に効いていた。自動で決まった値が見えて、1タップで直せるようにする
          （state は detail タブ側と共有。どちらで押しても同じ値が変わる） */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.dishTypeShortLabel}</span>
        <div className="mt-1 grid grid-cols-4 gap-[var(--space-sm)]">
          {dishTypes.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDishTypeTouched(true)
                setDishType((current) => (current === value ? undefined : value))
              }}
              className={`rounded-md border py-2.5 text-sm font-bold shadow-sm ${
                effectiveDishType === value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.dishType[value]}
            </button>
          ))}
        </div>
        {showDishTypeSuggestion && effectiveDishType !== undefined && (
          <p className="mt-1 text-sm text-ink-muted">{ja.form.dishTypeAutoHint}</p>
        )}
      </div>

      {/* 材料（追加・削除・並べ替え） */}
      <div className="mt-[var(--space-lg)]">
        {/* 「整理」= 複数選択してまとめて削除するモード(2026-08-02 オーナー実機FB。
            食材の在庫の整理モードと同じ様式)。1行しかないときは選ぶ意味がないので出さないが、
            整理中は必ず出す(「完了」で戻れなくなるのを防ぐ) */}
        <div className="flex items-center justify-between gap-2">
          <span className={labelCls}>{ja.form.ingredientsLabel}</span>
          {(ingredients.length > 1 || ingredientOrganizing) && (
            <button
              type="button"
              onClick={toggleIngredientOrganizing}
              aria-pressed={ingredientOrganizing}
              className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                ingredientOrganizing
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              <ListChecks size={14} aria-hidden />
              {ingredientOrganizing
                ? ja.form.ingredientOrganizeDone
                : ja.form.ingredientOrganizeToggle}
            </button>
          )}
        </div>
        {/* 合わせ調味料の色分けの使い方。整理中は色ボタン自体を隠していて、丸いボタン＝
            「選ぶ」チェックに変わるため、説明と食い違わないようこの案内も隠す
            (食材の在庫の整理モードと同じ扱い) */}
        {!ingredientOrganizing && (
          <p className="mt-1 text-sm text-ink-muted">
            {ja.form.ingredientGroupHint.replace('{last}', String(MAX_SEASONING_GROUP))}
          </p>
        )}
        {/* 価格管理は「食材と価格」ページに一元化(2026-07-14 オーナー要望)。
            この画面には材料ごとの価格入力欄を置かず、案内だけ表示する */}
        <p className="mt-1 text-sm text-ink-muted">{ja.form.ingredientPriceGuide}</p>
        <Link to="/prices" className="mt-0.5 inline-block text-sm font-bold text-accent-ink underline">
          {ja.form.ingredientPriceGuideLink}
        </Link>

        {/* まとめて入力(2026-07-28 便BW/C-07): 「豚こま 200g」と1行で書いて材料を足せる速記欄。
            分解は貼り付け取込と同じロジック。3マスの入力欄はそのまま残している */}
        <div className="mt-[var(--space-sm)] rounded-md border border-dashed border-edge p-[var(--space-sm)]">
          <span className="text-sm font-bold text-ink-muted">{ja.form.quickIngredientLabel}</span>
          {/* 書き方の注意(2026-08-02 オーナー実機FB)。欄のすぐ上に1行だけ置く */}
          <p className="mt-0.5 text-xs font-bold text-ink-muted">
            {ja.form.quickIngredientSpaceHint}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">{ja.form.quickIngredientDescription}</p>
          <div className="mt-1 flex gap-[var(--space-sm)]">
            <input
              type="text"
              value={quickIngredient}
              onChange={(e) => setQuickIngredient(e.target.value)}
              onKeyDown={(e) => {
                // 日本語入力の変換確定のEnterでは行を足さない(2026-08-02 オーナー実機FB
                // 「エンターで行が増えて注力しづらい」の原因)。IMEで変換中に押したEnterは
                // 「変換を確定するEnter」なので、そのときは何もしない。確定後にもう一度
                // Enterを押したときだけ材料行になる。
                // keyCode 229 はcompositionendがkeydownより先に来る環境向けの保険
                if (e.key === 'Enter' && !isImeConfirmKey(e)) {
                  e.preventDefault()
                  addQuickIngredient()
                }
              }}
              placeholder={ja.form.quickIngredientPlaceholder}
              aria-label={ja.form.quickIngredientLabel}
              className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
            />
            <button
              type="button"
              onClick={addQuickIngredient}
              className="shrink-0 rounded-sm border border-edge bg-surface px-4 font-bold text-accent-ink shadow-sm"
            >
              {ja.form.quickIngredientAdd}
            </button>
          </div>
        </div>

        {/* 整理モードの操作(全選択・選択解除・まとめて削除)。案内文のすぐ下・材料行の上に置き、
            下までスクロールしなくても選べるようにする(食材の在庫の整理モードと同じ配置) */}
        {ingredientOrganizing && (
          <div className="mt-[var(--space-sm)] flex flex-col gap-2">
            <p className="text-sm text-ink-muted">{ja.form.ingredientOrganizeHint}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={selectAllIngredients}
                disabled={selectedIngredientIndexes.length === ingredients.length}
                className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
              >
                {ja.form.ingredientOrganizeSelectAll}
              </button>
              <button
                type="button"
                onClick={clearIngredientSelection}
                disabled={selectedIngredientIndexes.length === 0}
                className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-ink-muted shadow-sm disabled:opacity-40"
              >
                {ja.form.ingredientOrganizeClearSelection}
              </button>
            </div>
            {selectedIngredientIndexes.length > 0 && (
              <button
                type="button"
                onClick={removeSelectedIngredients}
                className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-warning shadow-sm"
              >
                {ja.form.ingredientOrganizeDeleteSelected.replace(
                  '{n}',
                  String(selectedIngredientIndexes.length),
                )}
              </button>
            )}
          </div>
        )}

        <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
          {ingredients.map((row, index) => {
            const rowSelected = selectedIngredientIndexes.includes(index)
            return (
            <div
              key={index}
              className={`rounded-md border bg-surface p-[var(--space-sm)] shadow-sm ${
                rowSelected ? 'border-accent ring-2 ring-accent' : 'border-edge'
              }`}
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
                  onBlur={normalizeIngredientFieldOnBlur(index, 'amount')}
                  placeholder={ja.form.ingredientAmountPlaceholder}
                  aria-label={ja.form.ingredientAmount}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
                <input
                  type="text"
                  value={row.unit}
                  onChange={(e) => updateIngredient(index, { unit: e.target.value })}
                  onBlur={normalizeIngredientFieldOnBlur(index, 'unit')}
                  placeholder={ja.form.ingredientUnitPlaceholder}
                  aria-label={ja.form.ingredientUnit}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
              </div>
              {/* 取り込みで分量が読み取れなかった行の控えめな印(2026-07-28 便BX/C09)。
                  自分で分量を入れると消える(印は「まだ空のまま」を指すため) */}
              {isImportedAmountless(row) && (
                <p className="mt-1 text-xs text-ink-muted">{ja.form.importedAmountlessHint}</p>
              )}
              <div className="mt-[var(--space-sm)] flex items-center justify-between gap-[var(--space-sm)]">
                <div className="flex items-center gap-[var(--space-sm)]">
                  {/* 整理モードのチェック(2026-08-02)。付けた行が「選んだ材料◯行を削除」の対象になる */}
                  {ingredientOrganizing && (
                    <button
                      type="button"
                      onClick={() => toggleIngredientSelected(index)}
                      aria-pressed={rowSelected}
                      aria-label={ja.form.ingredientOrganizeSelectRow}
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${
                        rowSelected
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-edge text-ink-muted'
                      }`}
                    >
                      <CheckCircle2 size={20} aria-hidden />
                    </button>
                  )}
                  {/* 合わせ調味料グループの色ボタン。整理中は隠す: 丸いボタンが2つ並ぶと
                      どちらが「選ぶ」なのか紛らわしく、色を変える操作も選択中には要らない */}
                  {!ingredientOrganizing && (
                    <button
                      type="button"
                      onClick={() =>
                        updateIngredient(index, { group: nextSeasoningGroup(row.group) })
                      }
                      aria-label={
                        row.group
                          ? ja.form.ingredientGroupSet
                              .replace('{n}', String(row.group))
                              .replace('{last}', String(MAX_SEASONING_GROUP))
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
                  )}
                </div>
                {/* 整理中は上下移動・1行ずつの削除を隠す。行の位置で選択を持っているため、
                    選んだ後に並びが変わると消す行を取り違えるおそれがあるため */}
                {!ingredientOrganizing && (
                  <div className="flex items-center gap-[var(--space-sm)]">
                    {/* 並び替えのつまみ(2026-08-02 オーナー実機FB: 上下矢印だけだと分量の数値調整に
                        見える。買い物メモで先に採った様式=GripVerticalのつまみ+枠でくくる にそろえ、
                        「順番の入れ替え」だと分かる見た目にする)。
                        先頭行の「上へ」・末尾行の「下へ」は押しても動かないため無効にする(便BW・QA S3) */}
                    <div
                      className="flex shrink-0 items-center rounded-sm border border-edge text-ink-muted"
                      role="group"
                      aria-label={ja.form.reorderHandle}
                    >
                      <GripVertical size={14} className="ml-0.5 opacity-50" aria-hidden />
                      <button
                        type="button"
                        onClick={() => setIngredients((rows) => move(rows, index, index - 1))}
                        disabled={index === 0}
                        aria-label={ja.form.moveUp}
                        className="flex h-10 w-9 items-center justify-center disabled:opacity-30"
                      >
                        <ChevronUp size={20} aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIngredients((rows) => move(rows, index, index + 1))}
                        disabled={index === ingredients.length - 1}
                        aria-label={ja.form.moveDown}
                        className="flex h-10 w-9 items-center justify-center disabled:opacity-30"
                      >
                        <ChevronDown size={20} aria-hidden />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeIngredientRow(index)}
                      aria-label={ja.form.removeRow}
                      className={`${iconBtnCls} text-warning`}
                    >
                      <X size={20} aria-hidden />
                    </button>
                  </div>
                )}
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
            )
          })}
        </div>
        <button
          type="button"
          onClick={() => {
            setIngredients((rows) => [...rows, { ...emptyIngredient }])
            // 整理中に行が増えたときは、位置で持っている選択をいったん解除する(addQuickIngredientと同じ)
            setSelectedIngredientIndexes([])
          }}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-edge py-3 font-bold text-accent-ink"
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
                {/* 材料行と同じ並び替えのつまみ(2026-08-02)。手順行も「分」の数値欄の真横に
                    上下矢印が並んでいて、分数の増減ボタンに見えるため様式をそろえる */}
                <div
                  className="flex shrink-0 items-center rounded-sm border border-edge text-ink-muted"
                  role="group"
                  aria-label={ja.form.reorderHandle}
                >
                  <GripVertical size={14} className="ml-0.5 opacity-50" aria-hidden />
                  <button
                    type="button"
                    onClick={() => setSteps((rows) => move(rows, index, index - 1))}
                    disabled={index === 0}
                    aria-label={ja.form.moveUp}
                    className="flex h-10 w-9 items-center justify-center disabled:opacity-30"
                  >
                    <ChevronUp size={20} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSteps((rows) => move(rows, index, index + 1))}
                    disabled={index === steps.length - 1}
                    aria-label={ja.form.moveDown}
                    className="flex h-10 w-9 items-center justify-center disabled:opacity-30"
                  >
                    <ChevronDown size={20} aria-hidden />
                  </button>
                </div>
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
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-edge py-3 font-bold text-accent-ink"
        >
          <Plus size={18} aria-hidden />
          {ja.form.addStep}
        </button>
      </div>

      {/* 画像（写真 / アイコン の3択に統合。2026-07-16 Fable裁定docs/30 裁定2【画像の3択】。
          「写真ではなくアイコンを表示」の手動上書きトグルはくわしくタブに残す(同stateで整合) */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.photoLabel}</span>
        {/* プレビュー: 写真があり、かつアイコン優先でなければ写真。それ以外(写真なし/アイコン優先)は
            一覧・詳細と同じ--icon-tile背景+RecipeIconのプレースホルダーを出し、3択の結果を即見せる */}
        {photo && !showIconInsteadOfPhoto ? (
          <img
            src={photoUrl}
            alt={title || ja.form.photoLabel}
            className="mt-1 aspect-video w-full rounded-md object-cover shadow-sm"
          />
        ) : (
          <div
            className="mt-1 flex aspect-video w-full items-center justify-center rounded-md shadow-sm"
            style={{ background: 'var(--icon-tile)' }}
          >
            <RecipeIcon iconKey={iconKey ?? pickIconKey({ title, tags, ingredients })} size={64} />
          </div>
        )}
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
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 text-xs font-bold shadow-sm"
          >
            <Camera size={20} className="text-accent-ink" aria-hidden />
            {ja.form.photoTake}
          </button>
          <button
            type="button"
            onClick={() => albumInputRef.current?.click()}
            className="flex flex-col items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 text-xs font-bold shadow-sm"
          >
            <ImageIcon size={20} className="text-accent-ink" aria-hidden />
            {ja.form.photoPick}
          </button>
          {/* アイコンから選ぶ: 折りたたみの開閉ボタン。ボタン内アイコンは現在の選択(手動指定 or
              自動判定)をそのまま表示するので、閉じたままでも今どのアイコンが選ばれているか分かる */}
          <button
            type="button"
            onClick={() => setIconPickerOpen((open) => !open)}
            aria-expanded={iconPickerOpen}
            className="flex flex-col items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 text-xs font-bold shadow-sm"
          >
            <RecipeIcon
              iconKey={iconKey ?? pickIconKey({ title, tags, ingredients })}
              size={20}
              color="var(--accent)"
            />
            <span className="flex items-center gap-0.5">
              {ja.form.iconPickOpen}
              {iconPickerOpen ? (
                <ChevronUp size={14} aria-hidden />
              ) : (
                <ChevronDown size={14} aria-hidden />
              )}
            </span>
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

        {/* アイコングリッド(折りたたみ配下。旧・独立「アイコン」セクションをここへ移設) */}
        {iconPickerOpen && (
          <div className="mt-2">
            <p className="text-sm text-ink-muted">{ja.form.iconDescription}</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handleIconTap(undefined)}
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
                const isAutoPick =
                  iconKey === undefined && pickIconKey({ title, tags, ingredients }) === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleIconTap(key)}
                    className={`flex flex-col items-center justify-center gap-1 rounded-md border py-2 text-xs font-bold shadow-sm ${
                      iconKey === key
                        ? 'border-accent bg-accent text-on-accent'
                        : isAutoPick
                          ? 'border-accent bg-accent/10 text-accent-ink'
                          : 'border-edge bg-surface text-ink-muted'
                    }`}
                  >
                    <RecipeIcon
                      iconKey={key}
                      size={20}
                      color={
                        iconKey === key
                          ? 'var(--on-accent)'
                          : isAutoPick
                            ? 'var(--accent)'
                            : 'var(--text-muted)'
                      }
                    />
                    {ja.icon[key]}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
      </div>

      <div hidden={activeTab !== 'detail'}>
      {/* セクション見出し(2026-07-28 便BW/C-10): 任意項目が縦に長く並ぶため、
          「このレシピについて」「献立・検索に使う」「書き残す」の3区分に分ける。
          欄そのものの統合・並べ替えはしていない(既存の入力・保存ロジックは不変) */}
      <h2 className={sectionHeadingCls}>{ja.form.detailSectionAbout}</h2>

      {/* 紹介文（ひとこと説明。任意。2026-07-13） */}
      <label className={`mt-[var(--space-md)] ${labelCls}`}>
        {ja.form.introLabel}
        <span className="ml-1 font-normal text-ink-muted">（{ja.form.introDescription}）</span>
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

      <h2 className={sectionHeadingCls}>{ja.form.detailSectionPlanning}</h2>

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

      {/* 料理の種別（任意・もう一度押すと解除。献立プランナーの主菜/副菜提案に使う）。
          同じ選択は「かんたん」タブにも出している(2026-07-28 便BW/C-05)。stateは共通 */}
      <div className="mt-[var(--space-md)]">
        <span className={labelCls}>{ja.form.dishTypeLabel}</span>
        <p className="mt-1 text-sm text-ink-muted">{ja.form.dishTypeDescription}</p>
        <div className="mt-1 grid grid-cols-4 gap-[var(--space-sm)]">
          {dishTypes.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setDishTypeTouched(true)
                setDishType((current) => (current === value ? undefined : value))
              }}
              className={`rounded-md border py-3 font-bold shadow-sm ${
                effectiveDishType === value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.dishType[value]}
            </button>
          ))}
        </div>
        {showDishTypeSuggestion && effectiveDishType !== undefined && (
          <p className="mt-1 text-sm text-ink-muted">{ja.form.dishTypeAutoHint}</p>
        )}
      </div>

      {/* タグ（自由追加） */}
      <div className="mt-[var(--space-lg)]">
        <span className={labelCls}>{ja.form.tagsLabel}</span>
        {/* タグ=画面に出る / キーワード=検索だけに効く、の書き分け(2026-07-28 便BW/C-11) */}
        <p className="mt-1 text-sm text-ink-muted">{ja.form.tagsDescription}</p>
        {tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {/* 「タグを外す」は14x14pxしかなく、料理中に使う前提のタップ領域として小さかったため
                44px級に拡大(2026-07-28 便BW・QA S3。キーワード側も同じ) */}
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-sm py-1 pl-3 text-sm text-accent-ink"
                style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
              >
                {tag}
                <button
                  type="button"
                  onClick={() => setTags(tags.filter((t) => t !== tag))}
                  aria-label={ja.form.removeTag}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <X size={18} aria-hidden />
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
              // 変換確定のEnterではタグを作らない(まとめて入力と同じ理由。2026-08-02)
              if (e.key === 'Enter' && !isImeConfirmKey(e)) {
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
            className="rounded-sm border border-edge bg-surface px-4 font-bold text-accent-ink shadow-sm"
          >
            {ja.form.addTag}
          </button>
        </div>
        {/* 打ちかけの文字は保存してもタグにならない(2026-07-28 便BW・QA S3)。
            黙って消えるのを避けるため、入力中はその場で案内する */}
        {tagInput.trim() && <p className="mt-1 text-xs text-ink-muted">{ja.form.tagPending}</p>}
        {/* 既存タグのサジェスト(2026-07-24 便BN・タスク5): 入力中だけ出し、タップで採用する */}
        {tagSuggestions.length > 0 && (
          <div className="mt-[var(--space-sm)]">
            <p className="text-xs text-ink-muted">{ja.form.tagSuggestLabel}</p>
            <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
              {tagSuggestions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTagValue(t)}
                  className="rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        )}
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
                className="inline-flex items-center gap-1 rounded-sm py-1 pl-3 text-sm text-accent-ink"
                style={{ background: 'color-mix(in oklab, var(--accent) 12%, var(--bg))' }}
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => setKeywords(keywords.filter((k) => k !== keyword))}
                  aria-label={ja.form.removeKeyword}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <X size={18} aria-hidden />
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
              // 変換確定のEnterではキーワードを作らない(まとめて入力と同じ理由。2026-08-02)
              if (e.key === 'Enter' && !isImeConfirmKey(e)) {
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
            className="rounded-sm border border-edge bg-surface px-4 font-bold text-accent-ink shadow-sm"
          >
            {ja.form.addKeyword}
          </button>
        </div>
        {keywordInput.trim() && (
          <p className="mt-1 text-xs text-ink-muted">{ja.form.keywordPending}</p>
        )}
      </div>

      <h2 className={sectionHeadingCls}>{ja.form.detailSectionNotes}</h2>

      {/* ワンポイント・メモ・参照元URL（2026-07 メモ2区画化: ワンポイント=こつ・知識、メモ=保存方法・注意書き・安全）。
          2026-07-28 便BW/C-08: ワンポイント側にもメモと同じ常設の説明を付け、入力後も役割が画面に残るようにした */}
      <label className={`mt-[var(--space-lg)] ${labelCls}`}>
        {ja.form.onePointLabel}
        <span className="ml-1 font-normal text-ink-muted">（{ja.form.onePointDescription}）</span>
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

      {/* 保存・キャンセル。URL取り込みの読み込み中は両方とも押せないようにする
          (2026-07-30 便CK/②-3)。押せてしまうと、遷移した先の画面に「入力済みの材料◯件・手順◯件は
          置き換わって消えます」の確認ダイアログが後から割り込み、いま見ている保存済みレシピが
          壊されると誤解させたうえ、取り込み結果もどこにも出ないまま消えていた。
          待ち時間はWorker側のFETCH_TIMEOUT_MS(8秒)で上限が担保されている */}
      {urlImportLoading && (
        <p role="status" className="mt-[var(--space-lg)] text-sm font-bold text-ink-muted">
          {ja.form.urlImportBlocksSave}
        </p>
      )}
      <div className={`${urlImportLoading ? 'mt-[var(--space-sm)]' : 'mt-[var(--space-lg)]'} flex gap-2`}>
        <button
          type="button"
          onClick={save}
          disabled={saving || urlImportLoading}
          className="flex-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-60"
        >
          {saving ? ja.form.saving : ja.form.save}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={urlImportLoading}
          className="flex items-center rounded-md border border-edge bg-surface px-5 py-4 text-ink-muted shadow-sm disabled:opacity-60"
        >
          {ja.form.cancel}
        </button>
      </div>

      {/* デフォルトに戻す（編集時のみ・2026-07-15 オーナー要望）。DBには書き込まず、
          フォームの入力値だけを差し替える。押し間違えない距離・控えめな色にするため
          保存/キャンセルのすぐ下、削除ボタンとは離して配置する */}
      {isEdit && resetVariant && (
        <div className="mt-[var(--space-md)]">
          <button
            type="button"
            onClick={handleResetClick}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-60"
          >
            <RotateCcw size={18} aria-hidden />
            {resetArmed
              ? ja.form.resetConfirmLabel
              : resetVariant === 'own'
                ? ja.form.resetToSavedLabel
                : ja.form.resetToDefaultLabel}
          </button>
          {resetMessage && (
            <p className="mt-1 text-center text-sm font-bold text-accent-ink">{resetMessage}</p>
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
      {/* URL取り込みの補足通知(2026-07-28 便BX/C01)。既存のToast+setMessageパターンを流用 */}
      <Toast message={urlImportToast} onClose={() => setUrlImportToast('')} />
    </div>
  )
}
