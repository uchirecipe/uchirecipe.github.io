import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  Camera,
  Maximize2,
  CalendarPlus,
  JapaneseYen,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import { addCookedLog, toggleFavorite, updateCookedLog } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { useTodayList, addToTodayList, removeFromTodayList } from '../db/todayList'
import { addMealEntryIfAbsent } from '../db/mealPlan'
import { usePriceEntries } from '../db/prices'
import { scaleAmount, formatAmountUnit } from '../logic/amount'
import { ngMatchedIndices } from '../logic/ng'
import {
  buildPriceIndex,
  matchPriceEntry,
  estimateRecipeCost,
  estimateIngredientRowCost,
  normalizeIngredientNameForPrice,
} from '../logic/priceEstimate'
import { seasoningGroupColorToken } from '../logic/seasoningGroup'
import { shareText, shareImageCard, type ShareOptions } from '../logic/share'
import {
  NUTRITION_TEASER_ENABLED,
  computeRecipeNutrition,
  roundNutrient,
} from '../logic/nutrition'
import { deriveDoneLabel } from '../logic/timerLabel'
import { isMinutesShownInText } from '../logic/time'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { MemoText } from '../components/MemoText'
import { renderJaUnits } from '../components/jaUnits'
import { useTimers } from '../components/TimerProvider'
import { useWakeLock } from '../components/useWakeLock'
import BackHeader from '../components/BackHeader'
import Toast from '../components/Toast'
import CookedLogModal, { LOG_PHOTO_MAX_EDGE, LOG_PHOTO_QUALITY } from '../components/CookedLogModal'
import TodaySlotModal from '../components/TodaySlotModal'
import ShareModal, { type ShareSelection } from '../components/ShareModal'
import CustomTimerModal from '../components/CustomTimerModal'
import FocusMode from '../components/FocusMode'
import NutritionTeaser from '../components/NutritionTeaser'
import PriceEditModal, { type PriceEditTarget } from '../components/PriceEditModal'
import { RecipePlaceholder, seasonIcons } from '../components/RecipeCard'
import StepBadge from '../components/StepBadge'
import TimeText from '../components/TimeText'
import TermText from '../components/TermText'
import { collectUniqueTerms } from '../logic/termSplit'
import { buildIngredientNames } from '../logic/ingredientSpans'
import TermPopover, { useTermPopover } from '../components/TermPopover'
import { todayString } from '../logic/date'
import { resizePhoto } from '../logic/image'
import type { MealSlot } from '../db/types'
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
  // 履歴エントリも呼び出し元と同じになる）。
  // 2026-07-16オーナー決定: ホームの候補カード発はホームへ(2026-07-10の「常に一覧へ」の例外を追加)。
  // todayList方式をそのまま流用し、from:'home'のときも同様にfromPathへ戻す
  const navState = location.state as { from?: string; fromPath?: string } | null
  const backFallback =
    navState?.from === 'todayList' || navState?.from === 'home'
      ? (navState.fromPath ?? '/meal-plan')
      : '/recipes'

  // undefined = 読み込み中 / null = 該当レシピなし、を区別する
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id])
  const photoUrl = usePhotoUrl(recipe?.photo)
  const settings = useSettings()
  const { startTimer, timers } = useTimers()
  const todayList = useTodayList()
  const isInTodayList = todayList?.some((item) => item.recipeId === id) ?? false
  // 食材価格マスタ（未入力の材料だけ目安価格で補うフォールバック。docs/20 §3）
  const priceEntries = usePriceEntries()

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

  // 材料ごとの原価ビュー切り替え(2026-07-15 オーナー要望「どの食材が値段に反映されているか
  // 分からない」への対応)。常時表示は「うるさい」の理由で2026-07-14に廃止済みなので、
  // 既定は非表示のトグル表示に限定する。ページローカルな一時状態でよい(レシピを離れたらリセット)。
  // 2026-07-20 便AJ(docs/45)で「原価を見る」(閲覧=1食あたり按分)と「原価を編集」(単価編集)の
  // 2モードに分離。3値のunion 1つで管理する。
  // 2026-07-21 オーナー実機FB: 「見る」「編集」を横並びの独立トグルではなく、「見る」を
  // 押すと「編集」ボタンが出現する階層構造に変更(hidden→view→editの一方向段階)。
  // 「見る」ボタンは開閉の親トグルを兼ね、view/edit中に再度押すとhiddenへ両方まとめて解除する
  const [costMode, setCostMode] = useState<'hidden' | 'view' | 'edit'>('hidden')

  // 原価ビューの価格編集モーダル(2026-07-16 裁定1「原価ビュー」全面改修)。
  // entryIdあり=マスタ一致行の編集/なし=「＋登録」からの新規登録。nullで閉じている
  const [priceEdit, setPriceEdit] = useState<PriceEditTarget | null>(null)

  // 完了トースト(2026-07-16 UI総点検A-4: 「記録する」後の無言完了への対応。
  // 既存のToastコンポーネント+setMessageパターン(MealPlanPage等と同じ)を流用)
  const [message, setMessage] = useState('')

  // 「今日の献立に追加」のスロット振り分け窓(2026-07-17 便Z-1・docs/35 §2 Fable設計)。
  // 未追加時のボタン押下は直接追加ではなくこの窓を開く(追加済み時の解除タップは従来どおり)
  const [slotModalOpen, setSlotModalOpen] = useState(false)

  /**
   * 窓で朝食/昼食/夕食を選んだ: 週プランの「今日のその枠」へ追加(addMealEntryIfAbsent)し、
   * あわせて今日の献立(todayList)へも追加する=1操作で両方に反映(docs/35 §2)。
   * 仕様文の反映経路は「日タブの自動取り込み(便U-3)」だが、自動取り込みには
   * 「同じ日付につき1回だけ」の歯止め(settings.lastAutoImportDate)があり、その日すでに
   * 取り込み済みだと当日中は再実行されない。ここはユーザーの明示操作なので、経路任せに
   * せずaddToTodayList(冪等)を直接呼んで「両方に反映」という仕様の結果を必ず保証する。
   * 同枠に同レシピが既にある場合は何も追加せずトーストで案内(仕様)
   */
  const pickTodaySlot = async (slot: MealSlot) => {
    const result = await addMealEntryIfAbsent(todayString(), slot, id, 'main')
    setSlotModalOpen(false)
    if (result === 'duplicate') {
      setMessage(ja.detail.todaySlotDuplicateToast.replace('{slot}', ja.mealPlan.slot[slot]))
      return
    }
    await addToTodayList(id)
    setMessage(ja.detail.todaySlotAddedToast.replace('{slot}', ja.mealPlan.slot[slot]))
  }

  /** 窓で「決めない」を選んだ: 従来どおり今日の献立へ直接追加(枠なし) */
  const pickTodayUndecided = async () => {
    await addToTodayList(id)
    setSlotModalOpen(false)
  }

  // 「作った！」記録の入力欄(2026-07-12: 窓表示化。中央固定のモーダルなので、
  // 開いたときにページ側をスクロールさせる必要がなくなった＝スクロール位置は動かない)
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayString)
  const [logNote, setLogNote] = useState('')
  // 記録写真(任意・2026-07-12写真添付)。窓を開いた時点の表示人数(スケール後)も一緒に記録する
  const [logPhoto, setLogPhoto] = useState<Blob>()
  const [logServings, setLogServings] = useState<number>()

  // 過去の記録を後から編集する
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null)
  const [editingLogDate, setEditingLogDate] = useState('')
  const [editingLogNote, setEditingLogNote] = useState('')
  // 編集中の記録の写真(2026-07-16 便W-①: 追加・差し替え・削除に対応。既存写真で初期化し、
  // 新規選択で差し替え・undefinedにすれば削除。保存時は常にこの値をphotoとして書き戻す
  // (新規作成時=CookedLogModalと同じ保存形式・resizePhotoで圧縮)
  const [editingLogPhoto, setEditingLogPhoto] = useState<Blob>()
  const [editingLogPhotoError, setEditingLogPhotoError] = useState('')
  const editingLogPhotoUrl = usePhotoUrl(editingLogPhoto)
  const editLogCameraInputRef = useRef<HTMLInputElement>(null)
  const editLogAlbumInputRef = useRef<HTMLInputElement>(null)

  // 記録一覧のサムネイル用object URL。usePhotoUrlは1件用のフックのため、複数件のBlobを
  // ループで扱うこの一覧だけは自前でURLを作って後始末する(Reactのフックはループ内で呼べないため)
  const [logPhotoUrls, setLogPhotoUrls] = useState<Record<number, string>>({})
  useEffect(() => {
    const urls: Record<number, string> = {}
    for (const [index, log] of (recipe?.cookedLogs ?? []).entries()) {
      if (log.photo) urls[index] = URL.createObjectURL(log.photo)
    }
    setLogPhotoUrls(urls)
    return () => {
      Object.values(urls).forEach((url) => URL.revokeObjectURL(url))
    }
  }, [recipe?.cookedLogs])

  // タップした記録写真を原寸表示するモーダル
  const [viewingLogPhoto, setViewingLogPhoto] = useState<Blob>()
  const viewingLogPhotoUrl = usePhotoUrl(viewingLogPhoto)
  useEffect(() => {
    if (!viewingLogPhoto) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewingLogPhoto(undefined)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewingLogPhoto])

  // シェア(2026-07-16 裁定3: インライン2ボタン→選択モーダルに変更)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [sharing, setSharing] = useState(false)

  // 調理中モード（1手順ずつ大きく表示）
  const [focusOpen, setFocusOpen] = useState(false)
  const [focusStep, setFocusStep] = useState(0)

  // 時短モード（レンジ活用など、通常より手早い代替手順がある料理だけ切り替えを表示。表示中だけの一時的な選択）
  const [quickMode, setQuickMode] = useState(false)

  // じぶんタイマー（自由な分数で始めるタイマー。2026-07-12タイマー自由設定・入口A。
  // 同日の秒刻み対応でstateは秒単位に統一）の窓
  const [customTimerOpen, setCustomTimerOpen] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(180)

  // 用語タップ辞書(2026-07-11): ポップオーバーの開閉はページ単位で1つ持つ
  const { state: termPopoverState, open: openTerm, close: closeTermPopover } = useTermPopover()

  // 食材価格マスタの照合用索引（未入力の材料の概算・目安価格由来の注記の両方で使う）。
  // 早期returnより前に置く(フックはレンダーのたびに同じ順で呼ぶ必要があるため)
  const priceIndex = useMemo(() => buildPriceIndex(priceEntries ?? []), [priceEntries])

  // シェア選択モーダル用の栄養概算(2026-07-16 裁定3)。モーダルを開いたときだけ計算する。
  // グレーアウト判定(計算対象0件)と、選択時にshare.tsへ渡す実数値の両方に使う
  const shareNutrition = useMemo(
    () => (shareOpen && recipe ? computeRecipeNutrition(recipe) : null),
    [shareOpen, recipe],
  )

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

  // 材料ごとの価格入力を優先し、未入力の材料だけ食材価格マスタで補う（優先度: 個別入力>マスタ>なし）
  const costEstimate = estimateRecipeCost(recipe.ingredients, priceIndex)
  const totalPrice = costEstimate.total
  const scaledPrice =
    recipe.servings > 0
      ? Math.round((totalPrice * servings) / recipe.servings)
      : totalPrice
  // 1食あたりの概算食費(2026-07-14 オーナー実機フィードバック: 合計だけでなく1食分の目安も
  // 見たい。表示中のservings(人数変更に追従)で割る)
  const perServingPrice = servings > 0 ? Math.round(scaledPrice / servings) : scaledPrice
  // 原価サマリーカード用の1人分金額(2026-07-16 裁定1)。上のperServingPriceとは違い、
  // 表示人数(servingsOverride)を追わず常にrecipe.servings(登録人数)で割る
  const costPerServingRegistered =
    recipe.servings > 0 ? Math.round(totalPrice / recipe.servings) : totalPrice

  const saveLog = async () => {
    if (!logDate) return
    await addCookedLog(id, {
      date: logDate,
      note: logNote.trim() || undefined,
      photo: logPhoto,
      servings: logServings,
    })
    // 今日の献立に入っていれば、記録と同時に外す
    if (isInTodayList) await removeFromTodayList(id)
    setLogOpen(false)
    setLogNote('')
    setLogPhoto(undefined)
    // 2026-07-16 UI総点検A-4: 窓が閉じるだけの無言完了だったのでトーストで明示
    setMessage(ja.detail.cookedRecordedToast)
  }

  const openEditLog = (
    index: number,
    date: string,
    note: string | undefined,
    photo: Blob | undefined,
  ) => {
    setEditingLogIndex(index)
    setEditingLogDate(date)
    setEditingLogNote(note ?? '')
    setEditingLogPhoto(photo)
    setEditingLogPhotoError('')
  }

  // 記録編集中の写真選択(新規追加・差し替え共通)。保存形式は新規記録時と同一
  // (長辺1280px・JPEG品質0.8に圧縮。CookedLogModalのonPhotoSelectedと同じロジック)
  const onEditingLogPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    try {
      setEditingLogPhoto(await resizePhoto(file, LOG_PHOTO_MAX_EDGE, LOG_PHOTO_QUALITY))
      setEditingLogPhotoError('')
    } catch {
      setEditingLogPhotoError(ja.form.photoError)
    }
  }

  // じぶんタイマー（入口A: BackHeaderのタイマーアイコン）。詳細画面はFocusModeと違い
  // 「今見ている手順」の概念が無いため、どの手順にも紐付かないタイマーとして起動する。
  // 秒刻み対応(2026-07-12): 新フィールドlastCustomTimerSecondsを優先し、無ければ旧フィールド
  // lastCustomTimerMinutes(分)を秒換算して読む(後方互換)。どちらも無ければ既定3分
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
      key: `custom-${id}-${customSeconds}`,
      label: ja.timer.customLabel,
      seconds: customSeconds,
      recipeId: id,
      stepNumber: 0,
    })
    setCustomTimerOpen(false)
  }

  const saveEditingLog = async () => {
    if (editingLogIndex === null || !editingLogDate) return
    await updateCookedLog(id, editingLogIndex, {
      date: editingLogDate,
      note: editingLogNote.trim() || undefined,
      // 常にeditingLogPhotoを書き戻す(未変更ならもとの写真、選び直せば新しい写真、
      // 削除ならundefined。新規時と同じ保存形式)
      photo: editingLogPhoto,
    })
    setEditingLogIndex(null)
    setEditingLogPhoto(undefined)
    setEditingLogPhotoError('')
  }

  // シェアの選択式(2026-07-16 裁定3)のグレーアウト判定。モーダルを開いた時点の値で確定する
  const shareCookMinutesAvailable = recipe.cookMinutes != null && recipe.cookMinutes > 0
  const shareCostAvailable = totalPrice > 0
  const shareNutritionAvailable = (shareNutrition?.items.length ?? 0) > 0

  /** テキスト or 画像カードでシェア（非対応環境ではコピー/保存に切替）。
   *  selection(モーダルの選択)に、原価・栄養の実数値を詰めてshare.tsへ渡す
   *  (share.tsは純ロジック=Dexie/priceIndex持ち込み禁止のため、値はこちらで確定させる)。
   *  原価・1人分とも登録人数(recipe.servings)基準=原価ビュー(裁定1)と同値 */
  const runShare = async (kind: 'text' | 'image', selection: ShareSelection) => {
    setSharing(true)
    setShareMessage(kind === 'image' ? ja.share.generating : '')
    const opts: ShareOptions = {
      ...selection,
      costTotalYen: shareCostAvailable ? totalPrice : undefined,
      costPerServingYen: shareCostAvailable ? costPerServingRegistered : undefined,
      kcalPerServing: shareNutritionAvailable
        ? roundNutrient('kcal', shareNutrition!.perServing.kcal)
        : undefined,
      saltPerServing: shareNutritionAvailable
        ? roundNutrient('saltG', shareNutrition!.perServing.saltG)
        : undefined,
    }
    try {
      if (kind === 'text') {
        const result = await shareText(recipe, opts)
        setShareMessage(result === 'copied' ? ja.share.copied : '')
      } else {
        const result = await shareImageCard(recipe, opts)
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
  // 手順本文中の材料名に控えめな下線を付けるための名前一覧(正規化・長さ降順。docs/20 §7)
  const ingredientNames = buildIngredientNames(recipe.ingredients)
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
            {/* じぶんタイマー入口A（2026-07-12タイマー自由設定・Fable設計docs/20 §6）:
                料理名横に常設の入口を置く。フローティングボタンは不採用（オーナー裁定） */}
            <button
              type="button"
              onClick={openCustomTimer}
              aria-label={ja.timer.customOpenAria}
              className="rounded-full p-3 text-accent"
            >
              <TimerIcon size={22} aria-hidden />
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

        {/* ひとこと説明（任意。料理名だけでは中身が想像しにくい料理向け。2026-07-13）。
            2026-07-16 UI総点検A-8(改行監査の副次発見): 他フィールドと同じくwrapJaPhrases経由の
            折返し制御(ja-phrase+renderJaUnits)を通す。素のテキスト描画のままZWSP制御が
            効いていなかったため揃えた */}
        {recipe.intro && (
          <p className="ja-phrase mt-1 text-sm text-ink-muted">{renderJaUnits(recipe.intro)}</p>
        )}

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

        {/* 1食あたりの概算食費(2026-07-14 オーナー実機フィードバック: 合計だけでなく
            1食分の目安も見たい。表示中のservingsに追従) */}
        {totalPrice > 0 && (
          <p className="mt-0.5 text-sm text-ink-muted">
            {ja.detail.pricePerServing.replace('{n}', perServingPrice.toLocaleString())}
          </p>
        )}

        {/* タグ */}
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm px-2 py-0.5 text-sm text-accent"
                style={{ background: 'var(--icon-tile)' }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 今日の献立に追加（今日の献立への追加・解除。旧ボタン文言「今日つくる」→2026-07-16改名）:
            材料を見るより前に判断材料として提示。
            未追加時の押下は直接追加ではなくスロット振り分け窓を開く(2026-07-17 便Z-1・docs/35 §2。
            追加済み時の押下=解除は従来どおり直接) */}
        <button
          type="button"
          onClick={() =>
            isInTodayList ? void removeFromTodayList(id) : setSlotModalOpen(true)
          }
          className={`mt-[var(--space-lg)] flex w-full items-center justify-center gap-2 rounded-md border py-3 font-bold shadow-sm ${
            isInTodayList
              ? 'border-accent bg-accent text-on-accent'
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
              {/* 原価ビュー切り替えチップ(2026-07-15 オーナー要望「どの食材が値段に反映されて
                  いるか分からない」への対応。常時表示は「うるさい」で廃止済みのためトグル方式。
                  既定は非表示・状態はページローカル)。2026-07-20 便AJ(docs/45)で「原価を見る」
                  (閲覧=1食あたり按分)と「原価を編集」(単価編集)の2ボタンに改修。
                  2026-07-21 オーナー実機FB: 横並びの独立トグルをやめ、「見る」を押すと
                  「編集」ボタンが出現する階層構造に変更。「見る」はhidden⇔view/editの親トグルを
                  兼ね、開いている間(view/edit)に再度押すと編集ボタンごと非表示に戻る。
                  「編集」はview⇔editの子トグル(見るボタンが閉じられない限り出続ける) */}
              <button
                type="button"
                onClick={() => setCostMode((m) => (m === 'hidden' ? 'view' : 'hidden'))}
                aria-pressed={costMode !== 'hidden'}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-sm font-bold shadow-sm ${
                  costMode !== 'hidden'
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-accent'
                }`}
              >
                <JapaneseYen size={16} aria-hidden />
                {ja.detail.priceViewShow}
              </button>
              {costMode !== 'hidden' && (
                <button
                  type="button"
                  onClick={() => setCostMode((m) => (m === 'edit' ? 'view' : 'edit'))}
                  aria-pressed={costMode === 'edit'}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-sm font-bold shadow-sm ${
                    costMode === 'edit'
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-accent'
                  }`}
                >
                  <Pencil size={16} aria-hidden />
                  {ja.detail.priceEditShow}
                </button>
              )}
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
          {/* 原価サマリーカード(2026-07-16 裁定1で新設)は2026-07-20 便AJ(docs/45)で丸ごと削除
              (オーナー指示。上部メタ行の概算食費「約◯円」「1食あたり 約◯円」は不変のため重複していた)。
              代わりに「原価を編集」モードの説明を1文だけ出す(チップ表の上・編集モード時のみ) */}
          {costMode === 'edit' && (
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.detail.priceEditNote}</p>
          )}
          {recipe.ingredients.some((ing) => ing.seasoningGroup) && (
            <p className="mt-1 text-sm text-ink-muted">{ja.detail.seasoningGroupHint}</p>
          )}
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {recipe.ingredients.map((ing, index) => {
              const isNg = ngIndices.has(index)
              // 非表示時はrecipe.ingredientsの表示に一切手を加えない(1pxも変えない)ため
              // 編集モードのときだけマスタ照合する(チップ表示・タップ編集に使う)
              const matchedEntry = costMode === 'edit' ? matchPriceEntry(ing.name, priceIndex) : undefined
              const hasOwnPrice = ing.price != null && ing.price > 0
              // 「原価を見る」時だけ計算する1食あたりの按分原価(2026-07-20 便AJ・docs/45)。
              // 全量(登録量)の金額を登録人数(recipe.servings)で割った固定値で、表示人数
              // (servingsOverride)には追従させない(仕様書「2食分などの変動値は出さない」)
              const rowCost =
                costMode === 'view'
                  ? estimateIngredientRowCost(ing, priceIndex, recipe.servings)
                  : undefined
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
                    {costMode === 'edit' ? (
                      /* 原価を編集モード: 計量表記の代わりに「登録単位と価格」チップを出す
                         (タップで編集モーダル。2026-07-16 裁定1由来・2026-07-20 便AJで
                         「編集モード」側へ移動)。ing.price(レシピ個別入力)がある行は
                         マスタ編集の対象外なので、チップにせず金額だけの静的表記にする
                         (edge case1: 合計は個別価格優先・按分計算自体は従来どおり不変) */
                      <span className="shrink-0">
                        {hasOwnPrice ? (
                          <span className="text-sm font-bold text-ink-muted">
                            {ja.detail.costRecipeSpecific.replace('{n}', (ing.price ?? 0).toLocaleString())}
                          </span>
                        ) : matchedEntry ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPriceEdit({ name: matchedEntry.normalizedName, entryId: matchedEntry.id })
                            }
                            className="inline-flex items-center gap-1 rounded-full border border-edge bg-app px-2.5 py-1 text-sm font-bold text-accent shadow-sm"
                          >
                            {matchedEntry.pricePerUnit.toLocaleString()}
                            {ja.detail.priceYen}/{matchedEntry.unit}
                            <Pencil size={12} aria-hidden />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setPriceEdit({ name: normalizeIngredientNameForPrice(ing.name) })
                            }
                            className="inline-flex items-center gap-1 text-sm text-ink-muted"
                          >
                            {ja.detail.priceNone}
                            <span className="font-bold text-accent">＋{ja.detail.costAddPrice}</span>
                          </button>
                        )}
                      </span>
                    ) : costMode === 'view' ? (
                      /* 原価を見るモード: 計量表記の位置に1食あたりの按分原価を出す
                         (2026-07-20 便AJ・docs/45。編集導線は無い=タップ不可の静的テキスト。
                         価格情報が無い材料は「価格なし」、四捨五入で0円になる材料は
                         「1円未満」を出す) */
                      <span className="shrink-0 font-bold">
                        {rowCost ? (
                          rowCost.perServingYen > 0 ? (
                            <>
                              {ja.detail.priceAbout}
                              {rowCost.perServingYen.toLocaleString()}
                              {ja.detail.priceYen}
                            </>
                          ) : (
                            ja.detail.costUnderOneYen
                          )
                        ) : (
                          <span className="text-ink-muted">{ja.detail.priceNone}</span>
                        )}
                      </span>
                    ) : (
                      <span className="shrink-0 font-bold">
                        {formatAmountUnit(
                          scaleAmount(ing.amount, recipe.servings, servings, ing.unit),
                          ing.unit,
                        )}
                      </span>
                    )}
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
            {/* 手順が1つも無いレシピでは調理中モードを開くと表示する手順が無くクラッシュするため、
                そもそもボタンを出さない(2026-07バグ修正) */}
            {recipe.steps.length > 0 && (
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
            )}
          </div>
          {hasQuickVariant && (
            <div className="mt-[var(--space-sm)] inline-flex rounded-sm border border-edge p-0.5">
              <button
                type="button"
                onClick={() => setQuickMode(false)}
                className={`rounded-sm px-3 py-1 text-sm font-bold ${
                  !quickMode ? 'bg-accent text-on-accent' : 'text-ink-muted'
                }`}
              >
                {normalModeLabel}
              </button>
              <button
                type="button"
                onClick={() => setQuickMode(true)}
                className={`rounded-sm px-3 py-1 text-sm font-bold ${
                  quickMode ? 'bg-accent text-on-accent' : 'text-ink-muted'
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
                            ingredientNames={ingredientNames}
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
                        {ja.detail.minutesStandalonePrefix}
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

        {/* ワンポイント・メモ・参照元（2026-07 メモ2区画化: ①ワンポイント→②メモの順・オーナー承認済み） */}
        {recipe.onePoint && (
          <section className="mt-[var(--space-lg)]">
            <h2 className="text-xl font-bold">{ja.detail.onePoint}</h2>
            <MemoText
              text={recipe.onePoint}
              className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
              onOpenTerm={openTerm}
            />
          </section>
        )}
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
              {recipe.cookedLogs.slice(0, 5).map((log, index) => {
                const logPhoto = log.photo
                return (
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
                        {/* 記録編集中の写真: 追加・差し替え・削除に対応(2026-07-16 便W-①。
                            新規作成時のCookedLogModalと同じ操作・保存形式) */}
                        <div>
                          {editingLogPhotoUrl && (
                            <img
                              src={editingLogPhotoUrl}
                              alt=""
                              className="h-16 w-16 shrink-0 rounded-sm object-cover shadow-sm"
                            />
                          )}
                          <div className="mt-2 flex gap-2">
                            <input
                              ref={editLogCameraInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                void onEditingLogPhotoSelected(e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                            <input
                              ref={editLogAlbumInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                void onEditingLogPhotoSelected(e.target.files?.[0])
                                e.target.value = ''
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => editLogCameraInputRef.current?.click()}
                              className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold shadow-sm"
                            >
                              <Camera size={16} className="text-accent" aria-hidden />
                              {ja.form.photoTake}
                            </button>
                            <button
                              type="button"
                              onClick={() => editLogAlbumInputRef.current?.click()}
                              className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold shadow-sm"
                            >
                              <ImageIcon size={16} className="text-accent" aria-hidden />
                              {ja.form.photoPick}
                            </button>
                          </div>
                          {editingLogPhoto && (
                            <button
                              type="button"
                              onClick={() => setEditingLogPhoto(undefined)}
                              className="mt-1 text-sm text-warning underline"
                            >
                              {ja.detail.cookedLogPhotoRemove}
                            </button>
                          )}
                          {editingLogPhotoError && (
                            <p className="mt-1 text-sm text-warning">{editingLogPhotoError}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => void saveEditingLog()}
                            className="flex-1 rounded-sm bg-accent py-2 text-sm font-bold text-on-accent shadow-sm"
                          >
                            {ja.detail.cookedLogSave}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingLogIndex(null)
                              setEditingLogPhoto(undefined)
                              setEditingLogPhotoError('')
                            }}
                            className="rounded-sm border border-edge px-3 py-2 text-sm text-ink-muted"
                          >
                            {ja.detail.cookedLogCancel}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-start gap-2">
                          {logPhoto && logPhotoUrls[index] && (
                            <button
                              type="button"
                              onClick={() => setViewingLogPhoto(logPhoto)}
                              aria-label={ja.detail.cookedPhotoView}
                              className="shrink-0"
                            >
                              <img
                                src={logPhotoUrls[index]}
                                alt=""
                                className="h-16 w-16 rounded-sm object-cover shadow-sm"
                              />
                            </button>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-sm text-ink-muted">
                              {log.date.replaceAll('-', '/')}
                            </span>
                            {log.note && <p className="mt-0.5">{log.note}</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openEditLog(index, log.date, log.note, log.photo)}
                          aria-label={ja.detail.cookedLogEdit}
                          className="shrink-0 rounded-full p-2 text-ink-muted"
                        >
                          <Pencil size={16} aria-hidden />
                        </button>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* 下部の大ボタン: 作った！ / シェア（編集はタイトル付近に移動済み）。
            シェアは以前ここにインラインの2ボタンパネルを展開していたが、2026-07-16 裁定3で
            「何を載せるか」を選べる選択モーダル(ShareModal)に変更した */}
        <div className="mt-[var(--space-sm)] flex gap-2">
          <button
            type="button"
            onClick={() => {
              setLogDate(todayString())
              // 記録フォームを開いた時点の表示人数(スケール後)を初期値に記録(2026-07-12人数の自動入力)
              setLogServings(servings)
              setLogOpen(true)
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            <CheckCircle2 size={22} aria-hidden />
            {ja.detail.cooked}
          </button>
          <button
            type="button"
            onClick={() => {
              setShareMessage('')
              setShareOpen(true)
            }}
            aria-haspopup="dialog"
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
            setLogServings(servings)
            setLogOpen(true)
          }}
        />
      )}
      <TermPopover state={termPopoverState} onClose={closeTermPopover} />
      {/* 「今日の献立に追加」のスロット振り分け窓(2026-07-17 便Z-1) */}
      <TodaySlotModal
        open={slotModalOpen}
        onPickSlot={(slot) => void pickTodaySlot(slot)}
        onPickUndecided={() => void pickTodayUndecided()}
        onClose={() => setSlotModalOpen(false)}
      />
      <CookedLogModal
        open={logOpen}
        date={logDate}
        note={logNote}
        photo={logPhoto}
        onDateChange={setLogDate}
        onNoteChange={setLogNote}
        onPhotoChange={setLogPhoto}
        onSave={saveLog}
        onClose={() => {
          setLogOpen(false)
          setLogPhoto(undefined)
        }}
      />
      {/* シェアの選択式モーダル(2026-07-16 裁定3)。栄養行はNUTRITION_TEASER_ENABLED=falseなら
          行ごと非表示(緊急停止フラグと連動)。選択は開くたび既定値に初期化・永続化しない */}
      <ShareModal
        open={shareOpen}
        cookMinutesAvailable={shareCookMinutesAvailable}
        costAvailable={shareCostAvailable}
        nutritionRowVisible={NUTRITION_TEASER_ENABLED}
        nutritionAvailable={shareNutritionAvailable}
        sharing={sharing}
        message={shareMessage}
        onShare={(kind, selection) => void runShare(kind, selection)}
        onClose={() => setShareOpen(false)}
      />
      <CustomTimerModal
        open={customTimerOpen}
        totalSeconds={customSeconds}
        onSecondsChange={setCustomSeconds}
        onStart={startCustomTimer}
        onClose={() => setCustomTimerOpen(false)}
      />
      {/* 原価ビューの価格編集モーダル(2026-07-16 裁定1)。keyをentryId/nameで切ることで、
          duplicate検出→編集モードへの切替(edge case2)を含め、開くたびに/切り替わるたびに
          フォームのローカルstateを確実に初期化し直す(古い入力値が残って混線しないようにする) */}
      {priceEdit && (
        <PriceEditModal
          key={priceEdit.entryId ?? `add-${priceEdit.name}`}
          target={priceEdit}
          entries={priceEntries}
          onChangeTarget={setPriceEdit}
        />
      )}
      <Toast message={message} onClose={() => setMessage('')} />
      {/* 記録写真の原寸表示(2026-07-12写真添付・docs/20 §4「タップで原寸モーダル」)。
          他の窓(CookedLogModal等)と同じ様式(角丸カード・枠線・shadow-md・中央寄せ、
          背景の暗幕は無し)に合わせる */}
      {viewingLogPhotoUrl && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setViewingLogPhoto(undefined)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.detail.cookedPhotoView}
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[85vh] max-w-full rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-md"
          >
            <button
              type="button"
              onClick={() => setViewingLogPhoto(undefined)}
              aria-label={ja.common.close}
              className="absolute -right-2 -top-2 rounded-full border border-edge bg-surface p-1.5 text-ink-muted shadow-sm"
            >
              <X size={18} aria-hidden />
            </button>
            <img
              src={viewingLogPhotoUrl}
              alt=""
              className="max-h-[80vh] max-w-full rounded-sm object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
