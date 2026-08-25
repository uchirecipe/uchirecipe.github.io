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
  Maximize2,
  CalendarPlus,
  JapaneseYen,
  ChevronRight,
  X,
} from 'lucide-react'
import { db } from '../db/db'
import { addCookedLog, toggleFavorite, updatePhotoFocus } from '../db/recipes'
import { lowerPantryLevelsForCooked } from '../db/pantry'
import { useSettings, updateSettings } from '../db/settings'
import {
  useTodayList,
  addToTodayList,
  removeFromTodayList,
  restoreTodayListItems,
} from '../db/todayList'
import {
  addMealEntryIfAbsent,
  removeMealEntry,
  restoreMealEntries,
  useMealPlanRange,
  type MealPlanEntry,
} from '../db/mealPlan'
import { useMealPlanLocks, toLockKeySet } from '../db/mealPlanLocks'
import { mealRoleForRecipe, isRecipeInToday, isMealEditBlocked } from '../logic/mealPlan'
import { usePriceEntries } from '../db/prices'
import { scaleAmount, formatAmountUnit } from '../logic/amount'
import { ngMatchedIndices } from '../logic/ng'
// 表示人数の既定（設定「ふだん作る人数」→レシピの登録人数分）は献立の実効食数と同じ判定を使う
import { defaultMealServings } from '../logic/servings'
import {
  buildPriceIndex,
  matchPriceEntry,
  estimateRecipeCost,
  estimateIngredientRowCost,
  normalizeIngredientNameForPrice,
  recipeCostConfidence,
} from '../logic/priceEstimate'
import { seasoningGroupColorToken } from '../logic/seasoningGroup'
import { shareText, shareImageCard, type ShareOptions } from '../logic/share'
import {
  NUTRITION_TEASER_ENABLED,
  computeRecipeNutrition,
  isNutritionUnlocked,
  roundNutrient,
  hasMaterialGap,
} from '../logic/nutrition'
import { deriveDoneLabel } from '../logic/timerLabel'
import { stepTimerKey } from '../logic/timerOrder'
import { isHttpUrl } from '../logic/url'
import { isMinutesShownInText } from '../logic/time'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { MemoText } from '../components/MemoText'
import { renderJaUnits } from '../components/jaUnits'
import { useTimers } from '../components/TimerProvider'
import { useWakeLock } from '../components/useWakeLock'
import BackHeader from '../components/BackHeader'
import Toast from '../components/Toast'
import CookedLogModal from '../components/CookedLogModal'
import CookedLogEditor from '../components/CookedLogEditor'
import TodaySlotModal from '../components/TodaySlotModal'
import ShareModal, { type ShareSelection } from '../components/ShareModal'
import PhotoFocusModal from '../components/PhotoFocusModal'
import CustomTimerModal from '../components/CustomTimerModal'
import FocusMode from '../components/FocusMode'
import SafetyNotes from '../components/SafetyNotes'
// 安全のめやす（2026-08-22 便JH）。レシピのデータには書き込まず、開くたびに材料と手順から組み立てる
import { safetyNotesFor, stepSafetyNotes, wholeRecipeSafetyNotes } from '../logic/safetyNotes'
import NutritionTeaser from '../components/NutritionTeaser'
import FirstSetupNotice from '../components/FirstSetupNotice'
import {
  hasChosenFirstSetup,
  hasSeenFirstSetupNotice,
  shouldShowFirstSetupNotice,
} from '../logic/firstSetupNotice'
import PriceEditModal, { type PriceEditTarget } from '../components/PriceEditModal'
import { RecipeHeroPhoto, seasonIcons } from '../components/RecipeCard'
import { useRevealOnOpen } from '../components/useRevealOnOpen'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { useScrollLock } from '../components/useScrollLock'
import StepBadge from '../components/StepBadge'
import ComposedStepText from '../components/ComposedStepText'
import { collectUniqueTerms } from '../logic/termSplit'
import { buildIngredientNames } from '../logic/ingredientSpans'
import { isDashiIngredientName, DASHI_RECIPE_TITLE } from '../logic/dashiLink'
import TermPopover, { useTermPopover } from '../components/TermPopover'
import { todayString } from '../logic/date'
import type { MealSlot } from '../db/types'
import { ja } from '../i18n/ja'

/** レシピ詳細＝料理中に見るメイン画面。文字・ボタンは大きめ */
export default function RecipeDetailPage() {
  const params = useParams()
  const id = Number(params.id)
  const [searchParams, setSearchParams] = useSearchParams()

  // 戻る先(2026-08-02 オーナー指示・同日追補): 今日の献立から開いたときだけ
  // 元の画面へ帰す例外(2026-07-12・2026-07-16)を残し、それ以外＝出所のstateが無い・
  // 不明なときは必ずレシピ一覧へ。以前は不明時の戻り先が場面によってレシピ一覧に
  // ならないことがあり(一覧へ行く手段が消える)、いったん全て一覧固定にしたが、
  // 「今日の献立発の例外は残す・不明時は一覧」が確定形。
  // 2026-08-17 便HG: ホーム画面の廃止で 'home' を出す画面が無くなったので外した
  // (ホームが持っていた例外は、行き先の 'mealPlan'＝献立の「日」がそのまま引き継いでいる)。
  // 2026-08-07 便DT-2(オーナー指示): 献立タブの週('mealPlanWeek')を**同じ仕組みの例外**として
  // 足した。週の各日にある「作った記録」からレシピを開くと、戻ったときに週の並びを
  // 探し直すことになっていたため(スクロール位置の復元はMealPlanPage側が持つ)。
  const location = useLocation()
  const backState = location.state as { from?: string; fromPath?: string } | null
  // 2026-08-08 便EG(オーナー実機報告「レシピ詳細リンクから戻ると、ナビの末尾に戻りたい。
  // 現在は別の場所に戻る」): 並行調理ナビ('cookNavi')も同じ仕組みの例外に足した。
  // 段取りの下にあるレシピ名を開いて戻ると、レシピ一覧に飛ばされて段取りを開き直していた
  // (スクロール位置の復元はCookNaviPage側が持つ)
  // 2026-08-09 便EQ: 'mealPlan' を追加。作った記録の小窓からレシピ詳細・記録の編集へ来たとき、
  // 献立の日タブ・月タブへも同じ仕組みで帰せるようにした（週は従来の 'mealPlanWeek' のまま）
  const BACK_TO_ORIGIN_FROM = ['todayList', 'mealPlan', 'mealPlanWeek', 'cookNavi']
  const backFallback =
    backState?.from && BACK_TO_ORIGIN_FROM.includes(backState.from) && backState.fromPath
      ? backState.fromPath
      : '/recipes'

  // undefined = 読み込み中 / null = 該当レシピなし、を区別する
  const recipe = useLiveQuery(async () => (await db.recipes.get(id)) ?? null, [id])
  // だし紐づけ(2026-07-23): 材料「だし汁」の行から収録レシピ「だしのとり方」へ飛べるようにする。
  // ユーザーが「だしのとり方」を削除済みなら見つからない(=リンクを出さない)
  const dashiRecipe = useLiveQuery(
    async () => (await db.recipes.where('title').equals(DASHI_RECIPE_TITLE).first()) ?? null,
    [],
  )
  const settings = useSettings()
  const { startTimer } = useTimers()
  /** 今日の日付（今日の予定を読むのに使う。1回だけ決める＝描き直しで日付が動かない） */
  const today = useMemo(() => todayString(), [])
  const todayList = useTodayList()
  /**
   * 「今日の献立に追加済み」の判定（2026-08-21 便IU・⑦）。
   *
   * オーナー原文:
   *   「・週で献立組む→今日の献立にレシピが表示される→レシピ詳細も「今日の献立に追加済み」に
   *     して。はずすと週の献立ごと編集されるようにしたい。」
   *
   * 直している穴: ここは「今日の献立」の表（todayList）だけを見ていた。**週で組んだ予定が
   * その表へ写るのは、献立の「日」を開いたときの自動取り込み1本だけ**なので、
   * 週タブで組んだあとレシピ詳細を開いても「追加済み」にならなかった。
   * 献立の「日」は①今日の献立の表 ②今日の予定 の両方を並べているのに、ここだけ①しか
   * 見ていなかった＝同じ「今日つくるもの」を、画面によって違う数え方をしていた。
   * 判定は logic/mealPlan.ts の isRecipeInToday 1か所に置く。
   */
  const todayPlanEntries = useMealPlanRange(today, today)
  /** その料理が入っている今日の予定の行（外すときはこの行ごと消す＝日タブの×と同じ範囲） */
  const todayPlanRows = useMemo(
    () => (todayPlanEntries ?? []).filter((e) => e.recipeId === id),
    [todayPlanEntries, id],
  )
  /** その料理を今日すでに作ったか（作った品は日タブでも予定の行が消えるので、判定にも渡す） */
  const cookedToday = (recipe?.cookedLogs ?? []).some((log) => log.date === today)
  const isInTodayList = isRecipeInToday(
    id,
    (todayList ?? []).map((item) => item.recipeId),
    todayPlanRows.map((e) => e.recipeId),
    cookedToday,
  )
  const mealPlanLocks = useMealPlanLocks()
  const lockedKeys = useMemo(() => toLockKeySet(mealPlanLocks), [mealPlanLocks])
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
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('step')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, recipe])

  /**
   * ハイライトを2秒で消す（2026-08-08 便ED・オーナー実機フィードバック③
   * 「タイマーを止めて消しても、調理手順の色が変わったまま戻らない」の修正）。
   * 上の副作用の中で setTimeout を張ると、その場で ?step= を消した結果として副作用が
   * 再実行され、**前回の後片付け（clearTimeout）が先に走って**色が消えなくなっていた。
   */
  useEffect(() => {
    if (highlightStepIndex == null) return
    const timeout = setTimeout(() => setHighlightStepIndex(null), 2000)
    return () => clearTimeout(timeout)
  }, [highlightStepIndex])

  // 「画面を暗くしない」設定がオンなら、この画面を開いている間だけ画面の自動消灯を防ぐ
  const keepScreenOn = settings?.keepScreenOn ?? false
  useWakeLock(keepScreenOn)

  /**
   * 人数分の表示用。
   * 変更していない間は「ふだん作る人数」(設定・2026-08-03 便DK オーナー決定)で開き、
   * 未設定なら従来どおりレシピ登録時の人数で開く。判定は献立の実効食数と同じ
   * logic/servings.ts に集約してある（画面ごとに既定を書き分けない）。
   * ＋−で手で変えたらこの画面の中ではそちらが優先（従来どおり）。
   * 材料の分量・原価の見え方はこの表示人数に連動する既存の仕組みのままで、
   * 栄養の「1人分」表示は何人分にしても変わらない。
   */
  const [servingsOverride, setServingsOverride] = useState<number>()
  const servings =
    servingsOverride ?? defaultMealServings(settings?.householdServings, recipe?.servings)

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
   *
   * 2026-08-11 便FN（利用者テストのバグ修正）: 今日すでに作った品は「すでに入っています」で
   * 断らない。週の予定の行は記録をつけても残るため、断ると**その日はもうその料理を
   * 献立に戻せなくなる**（日タブは空なのに追加を拒む）。行は増やさず今日の献立に戻し、
   * 記録が残ることを添えて知らせる（判断は logic/mealPlan.ts todaySlotAddPlan）。
   * 2026-08-12 便FS-1: 戻した品は、日タブでも選んだ食事の行として出る
   *（logic/mealPlan.ts showsCookedPlanRowToday）。「今日の夕食に戻しました」と言いながら
   * 食事の決まっていない行に並べていたのを、言葉どおりの場所に直した。
   *
   * 2026-08-11 便FP（利用者テスト④「おひたしも味噌汁も主菜になっていた」）: 予定の行の役割を
   * 'main' で決め打ちしていたのをやめ、レシピの「料理の種別」から決める
   * （logic/mealPlan.ts mealRoleForRecipe）。
   */
  const pickTodaySlot = async (slot: MealSlot) => {
    if (!recipe) return
    const cookedToday = recipe.cookedLogs.some((log) => log.date === todayString())
    const result = await addMealEntryIfAbsent(
      todayString(),
      slot,
      id,
      mealRoleForRecipe(recipe),
      cookedToday,
    )
    setSlotModalOpen(false)
    if (result === 'duplicate') {
      setMessage(ja.detail.todaySlotDuplicateToast.replace('{slot}', ja.mealPlan.slot[slot]))
      return
    }
    await addToTodayList(id)
    setMessage(
      (result === 'restore'
        ? ja.detail.todaySlotRestoredToast
        : ja.detail.todaySlotAddedToast
      ).replace('{slot}', ja.mealPlan.slot[slot]),
    )
  }

  /**
   * 「今日の献立に追加済み」を押して外す（2026-08-21 便IU・⑦）。
   *
   * オーナー原文: 「はずすと週の献立ごと編集されるようにしたい。」
   * 献立の「日」の×（todayPlannedRemove）と**まったく同じ範囲**にそろえる＝
   * 今日の献立の表からも、今週の献立の予定（今日の枠）からも外す。
   * 直したのは、押す入口によって結果が違っていたところ（ここは今日の献立からしか
   * 外さないので、外したはずの品が週の予定に残り、翌日また今日の献立へ戻ってきていた）。
   *
   * 鍵の掛かった食事は手でも消せない（2026-08-08 便DX）ので、押しても止まる。
   * 消える操作なので、押したあとは範囲を書いた知らせと「元に戻す」を必ず出す（規約F）。
   */
  const removeFromToday = async () => {
    if (todayPlanRows.some((e) => isMealEditBlocked(lockedKeys, today, e.slot, 'remove'))) {
      setMessage(ja.mealPlan.lockedEditBlocked)
      return
    }
    // 消す前の姿をそのまま控える（日タブの×と同じ作法。id・日付・食事・役割・食数まで持つので、
    // 「元に戻す」で同じ枠へそのまま戻る）
    const removedEntries = todayPlanRows.filter((e) => e.id != null)
    const removedTodayItems = (todayList ?? []).filter((item) => item.recipeId === id)
    for (const entry of removedEntries) {
      await removeMealEntry(entry.id!)
    }
    await removeFromTodayList(id)
    const title = recipe?.title ?? ''
    // 外れた範囲をそのまま言う＝週の予定にも入っていたときだけ「今日と今週」になる。
    // 文言は日タブの×と同じものを使う（同じ操作を画面ごとに違う言葉で呼ばない）
    const toast = (
      removedEntries.length > 0
        ? ja.mealPlan.todayPlannedRemovedToast
        : ja.mealPlan.todayRemovedToast
    ).replace('{title}', title)
    setMessage(toast)
    setUndoRemove({
      entries: removedEntries,
      todayItems: removedTodayItems,
      message: toast,
      undoneMessage: (
        removedEntries.length > 0
          ? ja.mealPlan.todayPlannedRemoveUndoneToast
          : ja.mealPlan.todayRemoveUndoneToast
      ).replace('{title}', title),
    })
  }

  /**
   * 外したものを戻す（2026-08-21 便IU・⑦）。献立の日タブの「元に戻す」と同じ作法で、
   * 出したトーストの文言まで一緒に持つ＝別の操作でトーストが差し替わったら、この取り消しも消える
   */
  const [undoRemove, setUndoRemove] = useState<{
    entries: MealPlanEntry[]
    todayItems: { id?: number; recipeId: number; addedAt: number; fromPlan?: boolean }[]
    message: string
    undoneMessage: string
  } | null>(null)
  const undoRemoveActive = undoRemove != null && undoRemove.message === message
  const runUndoRemove = async () => {
    if (!undoRemove) return
    await restoreMealEntries(undoRemove.entries)
    await restoreTodayListItems(undoRemove.todayItems)
    setUndoRemove(null)
    setMessage(undoRemove.undoneMessage)
  }

  /**
   * 窓で「朝食・昼食・夕食を決めずに今日の献立に追加」を選んだ: 今日の献立へ直接追加（今週の予定には入れない）。
   * 2026-08-11 便FP: 押しても何も言わずに窓が閉じるだけだったので、朝食/昼食/夕食を選んだときと
   * 同じように結果を知らせる（利用者テスト③「押すと献立に入るのか入らないのか読み取れなかった」）
   */
  const pickTodayUndecided = async () => {
    await addToTodayList(id)
    setSlotModalOpen(false)
    setMessage(ja.detail.todaySlotUndecidedAddedToast)
  }

  // 「作った！」記録の入力欄(2026-07-12: 窓表示化。中央固定のモーダルなので、
  // 開いたときにページ側をスクロールさせる必要がなくなった＝スクロール位置は動かない)
  const [logOpen, setLogOpen] = useState(false)
  const [logDate, setLogDate] = useState(todayString)
  const [logNote, setLogNote] = useState('')
  // 記録写真(任意・2026-07-12写真添付)。窓を開いた時点の表示人数(スケール後)も一緒に記録する
  const [logPhoto, setLogPhoto] = useState<Blob>()
  const [logServings, setLogServings] = useState<number>()

  // 過去の記録を後から編集する（入力欄そのものは共通部品 CookedLogEditor が持つ。
  // ここが覚えるのは「どの記録の欄を開いているか」だけ。2026-08-10 便FD）
  const [editingLogIndex, setEditingLogIndex] = useState<number | null>(null)
  const logEditRef = useRevealOnOpen<HTMLDivElement>(editingLogIndex !== null)

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
  // Escape と端末の「戻る」で、この窓だけを閉じる（2026-08-18 便HQ・軸3）。
  // 写真を大きく見ているときに「戻る」を押すと、写真が閉じるのではなくレシピ詳細ごと
  // 前の画面へ戻っていた
  useOverlayDismiss(viewingLogPhoto != null, () => setViewingLogPhoto(undefined))
  // 写真を大きく見ているあいだ、後ろのレシピ詳細は動かさない（2026-08-16 便HE）
  useScrollLock(viewingLogPhoto != null)

  /**
   * 写真の見える範囲を決める窓（2026-08-22 便JK）。オーナー原文
   * 「ゆーざーが見える範囲を微調整（トリミングっぽい感じ）できたら嬉しい」。
   * 決めた値はその場でレシピに書く＝編集画面を通さずに直せる（お気に入りと同じ）。
   */
  const [photoFocusOpen, setPhotoFocusOpen] = useState(false)

  // シェア(2026-07-16 裁定3: インライン2ボタン→選択モーダルに変更)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareMessage, setShareMessage] = useState('')
  const [sharing, setSharing] = useState(false)

  // 調理中モード（1手順ずつ大きく表示）
  const [focusOpen, setFocusOpen] = useState(false)
  // 閉じた時点の手順位置を覚えておき、開き直したらそこから再開する（2026-07-28 機能④診断C3）。
  // 調理中モードには材料一覧が無いので「分量を確認しにいったん閉じる」は例外操作ではなく
  // 常用の動線であり、そのたびに手順1へ戻るのは進捗を丸ごと失うのと同じだった。
  const [focusStep, setFocusStep] = useState(0)
  // 詳細内リンク（「だしのとり方」など）や常駐タイマーのタップでidだけ変わる場合、
  // このページは作り直されないため前のレシピの状態が残る。レシピが変わったら必ずリセットする。
  // 2026-07-29 便CI/C07: 手順位置に加えて「表示人数」と「記録メモの下書き」も残っており、
  // だし巻き卵を6人分にしてからリンクで「だしのとり方」へ移ると6人分表示のまま材料が3倍になり、
  // そのまま記録すると誤った人数が保存されていた（実績食費の分母に効く）
  useEffect(() => {
    setFocusStep(0)
    setServingsOverride(undefined) // 前のレシピの表示人数が残ると材料が誤スケールし記録にも漏れる
    setLogNote('') // 前のレシピ用の記録メモ下書きがプリフィルされるのを防ぐ
  }, [id])

  // 「調理中モードで見る」の初回ヒント(2026-07-23 便BJ・docs/55 CEO提案1-5)。
  // このアプリ最強の機能が初見で気づかれにくいため、レシピ詳細を初めて開いたときだけ
  // ボタンを控えめにハイライトし一言添える。表示と同時に「見せた」フラグを保存し、
  // 以降は二度と出さない(常時アニメ・派手な演出はしない=落ち着いたトーン維持)。
  const [showCookHint, setShowCookHint] = useState(false)
  const cookHintHandled = useRef(false)
  useEffect(() => {
    if (cookHintHandled.current) return
    if (!recipe || settings === undefined) return // レシピ・設定の読み込み待ち
    if (recipe.steps.length === 0) return // ボタン自体が出ないレシピではヒントも出さない
    cookHintHandled.current = true
    if (!settings.cookModeHintSeen) {
      setShowCookHint(true)
      void updateSettings({ cookModeHintSeen: true })
    }
  }, [recipe, settings])

  // 時短モード（レンジ活用など、通常より手早い代替手順がある料理だけ切り替えを表示。表示中だけの一時的な選択）
  const [quickMode, setQuickMode] = useState(false)

  // 自由な時間のタイマー（ja.timer.customLabel「タイマー」。2026-07-12タイマー自由設定・入口A。
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

  /** 過去の記録の編集フォームを開く（下の記録一覧の鉛筆ボタンと、?editLog= からの遷移で使う） */
  const openEditLog = (index: number) => {
    setEditingLogIndex(index)
  }

  /**
   * 「作った記録」の小窓の「この記録を編集する」から来たとき（?editLog=何番目）、
   * その記録の編集フォームを開いた状態でこの画面を出す（2026-08-09 便EQ）。
   * 記録を直す入力欄はこの画面のものが唯一で、小窓の側には作らない（同じ欄を2つ持たない）。
   * 使い終わったクエリはURLから消す＝再読み込みや「戻る」で勝手に開き直さない。
   * フックは早期returnより前に置く（レンダーのたびに同じ順で呼ぶ必要があるため）。
   */
  useEffect(() => {
    const editLogParam = searchParams.get('editLog')
    if (editLogParam == null || !recipe) return
    const index = Number(editLogParam)
    const log = Number.isInteger(index) && index >= 0 ? recipe.cookedLogs[index] : undefined
    if (log) openEditLog(index)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('editLog')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, recipe])

  /**
   * 「食数の設定」「台所の器具」の初回の案内（2026-08-13 便GE・docs/65 A-4）。
   * 出す条件（この端末で未表示・2つの設定をどれも自分で決めていない・レシピが表示されている・
   * 用事があって開いた画面ではない）は logic/firstSetupNotice.ts が持つ。
   *
   * 判定は**この画面に着いてから1度だけ**行う（decidedRef）。設定が読み込まれた時点で決め、
   * 以降は開いている間ずっと同じ＝読み込みの途中や設定の変更で出たり消えたりしない。
   * 用事の有無は最初の描画時のクエリで見る（?step= と ?editLog= は、使い終わると
   * すぐURLから消える作りなので、消えたあとに読むと「用事なし」に見えてしまう）。
   */
  const [showFirstSetupNotice, setShowFirstSetupNotice] = useState(false)
  const firstSetupDecidedRef = useRef(false)
  const openedForTaskRef = useRef(searchParams.has('step') || searchParams.has('editLog'))
  useEffect(() => {
    if (firstSetupDecidedRef.current) return
    // レシピか設定がまだ無いうちは判定しない。読み込み中(undefined)と見つからない(null)を
    // まとめて待つ＝初回起動で基本レシピの投入が終わる前にレシピ詳細のURLを直接開いても、
    // 「見つからない」を見て「出さない」と決めてしまわない（投入後に出る）
    if (!settings || recipe == null) return
    firstSetupDecidedRef.current = true
    setShowFirstSetupNotice(
      shouldShowFirstSetupNotice({
        settingsLoaded: true,
        recipeShown: true,
        openedForTask: openedForTaskRef.current,
        seen: hasSeenFirstSetupNotice(),
        settingsChosen: hasChosenFirstSetup(settings),
      }),
    )
  }, [settings, recipe])

  if (recipe === undefined) {
    // 読み込み中(undefined)は何も出さない。id が存在しない場合は下の分岐へ
    return null
  }
  if (recipe === null || Number.isNaN(id)) {
    return (
      <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
        <p className="text-ink-muted">{ja.detail.notFound}</p>
        <Link to="/recipes" className="mt-2 inline-block font-bold text-accent-ink">
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
  // 価格が分からない材料の分は合計に1円も入っていない＝この金額は必ず実際より安く出る。
  // 知らせる条件はlogic/priceEstimate.tsのrecipeCostConfidenceに集約(2026-08-22 便JG)
  const costConfidence = recipeCostConfidence(recipe.ingredients, priceIndex)

  const saveLog = async () => {
    if (!logDate) return
    await addCookedLog(id, {
      date: logDate,
      note: logNote.trim() || undefined,
      photo: logPhoto,
      servings: logServings,
    })
    // 在庫反映スイッチON時(2026-07-23 オーナー実機FB #11): 使った食材の在庫を1段階下げる
    // (調味料系は対象外・登録済みチップの範囲だけ)。既定OFF・選択はsettingsに記憶している
    if (recipe && settings?.cookedReflectPantry) {
      await lowerPantryLevelsForCooked(recipe.ingredients)
    }
    // 今日の献立に入っていれば、記録と同時に外す
    if (isInTodayList) await removeFromTodayList(id)
    setLogOpen(false)
    setLogNote('')
    setLogPhoto(undefined)
    // 2026-07-16 UI総点検A-4: 窓が閉じるだけの無言完了だったのでトーストで明示
    setMessage(ja.detail.cookedRecordedToast)
  }

  // 自由な時間のタイマー（入口A: BackHeaderのタイマーアイコン）。詳細画面はFocusModeと違い
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
      isCustom: true,
    })
    setCustomTimerOpen(false)
  }

  // シェアの選択式(2026-07-16 裁定3)のグレーアウト判定。モーダルを開いた時点の値で確定する
  const shareCookMinutesAvailable = recipe.cookMinutes != null && recipe.cookMinutes > 0
  const shareCostAvailable = totalPrice > 0
  const shareNutritionAvailable = (shareNutrition?.items.length ?? 0) > 0
  // シェア文に塩分を入れてよいのはPro解錠済みのときだけ(2026-08-01 線引きB')。
  // 画面(栄養パネル)に出していない値が、シェア文からだけ外に出るのを防ぐ
  const shareNutritionSalt = isNutritionUnlocked(!!settings?.proCode)

  /** テキスト or 画像カードでシェア（非対応環境ではコピー/保存に切替）。
   *  selection(モーダルの選択)に、原価・栄養の実数値を詰めてshare.tsへ渡す
   *  (share.tsは純ロジック=Dexie/priceIndex持ち込み禁止のため、値はこちらで確定させる)。
   *  原価・1人分とも登録人数(recipe.servings)基準=原価ビュー(裁定1)と同値 */
  const runShare = async (kind: 'text' | 'image', selection: ShareSelection) => {
    setSharing(true)
    setShareMessage(kind === 'image' ? ja.share.generating : '')
    const opts: ShareOptions = {
      ...selection,
      // 画面で見えている人数の分量で共有する(2026-07-29 便CI/C18)。
      // 金額の「全量」も同じ人数に合わせる(1人分は人数によらず同じなので登録人数基準のまま)
      servings,
      costTotalYen: shareCostAvailable ? scaledPrice : undefined,
      costPerServingYen: shareCostAvailable ? costPerServingRegistered : undefined,
      kcalPerServing: shareNutritionAvailable
        ? roundNutrient('kcal', shareNutrition!.perServing.kcal)
        : undefined,
      saltPerServing:
        shareNutritionAvailable && shareNutritionSalt
          ? roundNutrient('saltG', shareNutrition!.perServing.saltG)
          : undefined,
      // 主材料が計算できていないまま数値だけシェアされるのを防ぐ(2026-07-28 便BY/NUT-01)
      nutritionHasGap: shareNutrition != null && hasMaterialGap(shareNutrition),
    }
    try {
      const result =
        kind === 'text' ? await shareText(recipe, opts) : await shareImageCard(recipe, opts)
      if (result === 'copied') setShareMessage(ja.share.copied)
      else if (result === 'downloaded') setShareMessage(ja.share.downloaded)
      else setShareMessage('')
      // 共有シートでキャンセルしたときは何も起きていないので窓は閉じない
      // (閉じてしまうと「やめたのに画面だけ変わる」になる。2026-07-29 便CI/C17)
      if (navigator.share !== undefined && result !== 'cancelled') setShareOpen(false)
    } catch {
      setShareMessage(ja.share.failed)
    } finally {
      setSharing(false)
    }
  }

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

  // 安全のめやす（2026-08-22 便JH）。**いま画面に出している手順**に対して組み立てる
  // （時短版を見ているときは時短版の手順を見る）。設定で切っていれば1件も出さない。
  // 同梱の基本レシピは原稿に注記が入っているので safetyNotesFor 側で弾いている
  const safetyNotes = settings?.safetyNotesOff
    ? []
    : safetyNotesFor({ ...recipe, steps: displaySteps })
  const recipeSafetyNotes = wholeRecipeSafetyNotes(safetyNotes)

  return (
    // 下余白はページ全体を包む main が実測ぶん空ける（2026-08-11 便FN）
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
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
              className="rounded-full p-3 text-accent-ink"
            >
              <Heart size={22} fill={recipe.isFavorite ? 'currentColor' : 'none'} aria-hidden />
            </button>
            {/* 自由な時間のタイマー入口A（2026-07-12タイマー自由設定・Fable設計docs/20 §6）:
                料理名横に常設の入口を置く。フローティングボタンは不採用（オーナー裁定） */}
            <button
              type="button"
              onClick={openCustomTimer}
              aria-label={ja.timer.customOpenAria}
              className="rounded-full p-3 text-accent-ink"
            >
              <TimerIcon size={22} aria-hidden />
            </button>
          </div>
        }
      />

      {/* 写真（無い場合・アイコン優先の場合はプレースホルダー）。
          出し分けは共通部品（components/RecipeCard の RecipeHeroPhoto）に置いてある
          ＝アプリ全体で「写真か代わり絵か」の決め方が1か所（2026-08-19 便HW） */}
      <RecipeHeroPhoto
        recipe={recipe}
        // 入口は写真の中（右下）に重ねる＝下に並ぶ料理名・材料の位置は動かない。
        // 写真が無い／アイコン優先のレシピでは共通部品側が出さない（2026-08-22 便JK）
        onAdjustPhoto={() => setPhotoFocusOpen(true)}
      />

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
              {/* 価格が分からない材料があるときの印(2026-08-22 便JG)。NG食材は枠付きの札で
                  この行に並ぶので、こちらは金額の文字に添えるだけにして場所を取り合わない。
                  印の意味は下の1行で書くので、読み上げでは重複させない */}
              {costConfidence.shouldWarn && (
                <span aria-hidden className="font-bold text-accent-ink">
                  {ja.detail.costRoughMark}
                </span>
              )}
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
            1食分の目安も見たい。表示中のservingsに追従)。
            2026-08-25 便KN: 人数分の併記をやめた（材料の見出し行の人数ステッパーと
            「登録: ◯人分」に出ているので、この行で3回目を言わない） */}
        {totalPrice > 0 && (
          <p className="mt-0.5 text-sm text-ink-muted">
            {ja.detail.pricePerServing.replace('{n}', perServingPrice.toLocaleString())}
          </p>
        )}

        {/* 上の印の意味(2026-08-22 便JG・オーナー原文「目安とはいえ実際と大きく異なることを
            記号でお知らせして欲しい」「ティラミスとか、１食４円なわけない。チーズがたくさん」)。
            金額のすぐ下に置く＝どの数字の話かが場所で分かる */}
        {totalPrice > 0 && costConfidence.shouldWarn && (
          <p className="mt-0.5 text-sm text-ink-muted">
            {ja.detail.costRoughMark}
            {ja.detail.costPricelessNote.replace('{n}', String(costConfidence.pricelessCount))}
          </p>
        )}

        {/* タグ */}
        {recipe.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-sm px-2 py-0.5 text-sm text-accent-ink"
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
          data-testid="detail-today-toggle"
          onClick={() => (isInTodayList ? void removeFromToday() : setSlotModalOpen(true))}
          className={`mt-[var(--space-lg)] flex w-full items-center justify-center gap-2 rounded-md border py-3 font-bold shadow-sm ${
            isInTodayList
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-accent-ink'
          }`}
        >
          <CalendarPlus size={20} aria-hidden />
          {isInTodayList ? `${ja.detail.todayAdded} ✓` : ja.detail.todayAdd}
        </button>
        {/* 規約F: 押すと何が外れるかを、押す前に読める場所に書く（2026-08-21 便IU・⑦）。
            今週の献立にも入っているときだけ出す＝今日の献立にしか入っていない品では、
            押しても今日の献立から外れるだけで驚くことがない */}
        {isInTodayList && todayPlanRows.length > 0 && (
          <p data-testid="detail-today-remove-hint" className="mt-1 text-xs text-ink-muted">
            {ja.detail.todayRemoveHint}
          </p>
        )}

        {/* 材料（人数分の変更で自動換算） */}
        <section className="mt-[var(--space-lg)]">
          {/* 見出し＋原価ボタン＋人数ステッパーの1行。390px幅(iPhone 12〜15相当)で「原価を見る」を
              ONにすると横に収まらず、「人数を増やす」＋ボタンが画面外に出ていた(2026-07-28 便BY/UI-01)。
              折り返しを許可し、原価ボタン群と人数ステッパーをそれぞれ塊のまま次の行へ送る */}
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <h2 className="shrink-0 text-xl font-bold">{ja.detail.ingredients}</h2>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {/* 原価ビュー切り替えチップ(2026-07-15 オーナー要望「どの食材が値段に反映されて
                  いるか分からない」への対応。常時表示は「うるさい」で廃止済みのためトグル方式。
                  既定は非表示・状態はページローカル)。2026-07-20 便AJ(docs/45)で「原価を見る」
                  (閲覧=1食あたり按分)と「原価を編集」(単価編集)の2ボタンに改修。
                  2026-07-21 オーナー実機FB: 横並びの独立トグルをやめ、「見る」を押すと
                  「編集」ボタンが出現する階層構造に変更。
                  2026-08-03 オーナー指示: 押しても位置が動かない・押した状態から戻り方が分かる
                  トグルにする。①ラベルを開閉で入れ替える(原価を見る⇔材料に戻す。右端そろえの行なので
                  文字数が変わるとボタンがずれる。戻す側も同じ5文字にして幅を変えない)
                  ②「原価を編集」は同じ行に足すとこのボタンと人数ステッパーを押しのけるため、
                  見出し行から外して下の行に出す(この行の中身は開閉で変わらない) */}
              <button
                type="button"
                onClick={() => setCostMode((m) => (m === 'hidden' ? 'view' : 'hidden'))}
                aria-pressed={costMode !== 'hidden'}
                className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-sm font-bold shadow-sm ${
                  costMode !== 'hidden'
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-accent-ink'
                }`}
              >
                <JapaneseYen size={16} aria-hidden />
                {costMode !== 'hidden' ? ja.detail.priceViewHide : ja.detail.priceViewShow}
              </button>
              <span className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setServingsOverride(Math.max(1, servings - 1))}
                aria-label={ja.detail.servingsDown}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent-ink shadow-sm"
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
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-surface text-accent-ink shadow-sm"
              >
                <Plus size={22} aria-hidden />
              </button>
              </span>
            </div>
          </div>
          {/* 「原価を編集」と、元のレシピが何人分で書かれているかの併記を**同じ1行**に置く。
              2026-08-23 便JO（オーナー原文「「原価を編集」ボタンのせいで、材料の文字が下に動くのが
              気になる。ボタンの場所変えたい。下でもいいが不便になる。」）:
              直す前の実測（390×844）＝材料の1行目は 629px。「原価を見る」で 675px（**46px下がる**）、
              続けて「原価を編集」で 723px（**さらに48px**）。合わせて94px＝材料3行ぶんずれていた。
              下へ移すのはオーナーが消極的（「下でもいいが不便になる」）なので採らず、
              **いつも同じ場所にある行に先に高さを取っておく**手にした（便IAが窓の中で採ったのと同じ手）。
              この行は登録人数の併記でもとから常にあるので、増える余白は最小で済む。
              ・行の高さは押せる大きさ（44px・--tap-min）で固定＝ボタンが出ても消えても1pxも動かない
              ・登録人数の併記（2026-08-03 便DK・オーナー決定）は右端のまま。
                設定「ふだん作る人数」を入れていると最初からその人数で開くので、登録人数を消さない */}
          <div className="mt-1 flex min-h-11 items-center justify-between gap-2">
            {costMode !== 'hidden' ? (
              <button
                type="button"
                onClick={() => setCostMode((m) => (m === 'edit' ? 'view' : 'edit'))}
                aria-pressed={costMode === 'edit'}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-3 py-2 text-sm font-bold shadow-sm ${
                  costMode === 'edit'
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-accent-ink'
                }`}
              >
                <Pencil size={16} aria-hidden />
                {ja.detail.priceEditShow}
              </button>
            ) : (
              <span aria-hidden />
            )}
            {recipe.servings > 0 && (
              <span className="text-right text-xs text-ink-muted">
                {ja.detail.servingsRegisteredNote.replace('{n}', String(recipe.servings))}
              </span>
            )}
          </div>
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
              // 「原価を見る」時だけ計算する、その行の分量ぶんの金額(2026-08-22 便JG)。
              // 2026-07-20 便AJ(docs/45)では「1食あたり＝登録人数で割った固定値」を出しており、
              // 表示人数を変えても金額だけ動かなかった。同じ行の分量(scaleAmount)は表示人数に
              // 追随するので、登録17人分のシフォンケーキを2人分で見ると「卵 1/2個」の行に
              // 「約6円」(100円÷17人分)が出て、半分の卵の値段(約12円)と合っていなかった
              // (オーナー原文「原価が、人数分の表示に合わせて計算されていない。人数の増減で
              // 数値が変わらない。何人分を表示しているの？」「卵が半量で６円」)。
              // 分量と同じ人数分を指す金額(shownYen)を出す＝「その量でいくらか」が読める
              const rowCost =
                costMode === 'view'
                  ? estimateIngredientRowCost(ing, priceIndex, recipe.servings, servings)
                  : undefined
              return (
                <li
                  key={index}
                  data-testid="detail-ingredient"
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
                            className="inline-flex items-center gap-1 rounded-full border border-edge bg-app px-2.5 py-1 text-sm font-bold text-accent-ink shadow-sm"
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
                            <span className="font-bold text-accent-ink">＋{ja.detail.costAddPrice}</span>
                          </button>
                        )}
                      </span>
                    ) : costMode === 'view' ? (
                      /* 原価を見るモード: 計量表記の位置に、その分量ぶんの金額を出す
                         (2026-07-20 便AJ・docs/45で新設し、2026-08-22 便JGで表示人数に追随させた。
                         編集導線は無い=タップ不可の静的テキスト。価格情報が無い材料は「価格なし」、
                         四捨五入で0円になる材料は「1円未満」を出す) */
                      <span className="shrink-0 font-bold">
                        {rowCost ? (
                          rowCost.shownYen > 0 ? (
                            <>
                              {ja.detail.priceAbout}
                              {rowCost.shownYen.toLocaleString()}
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
                  {/* だし紐づけ(2026-07-23): 「だし汁」系の材料から収録レシピ「だしのとり方」の詳細へ。
                      収録レシピが端末にあり(=ユーザーが未削除)、自分自身でないときだけ出す */}
                  {dashiRecipe &&
                    dashiRecipe.id != null &&
                    dashiRecipe.id !== recipe.id &&
                    isDashiIngredientName(ing.name) && (
                      <Link
                        to={`/recipes/${dashiRecipe.id}`}
                        className="mt-0.5 inline-flex items-center gap-0.5 text-sm font-bold text-accent-ink"
                      >
                        {ja.detail.dashiRecipeLink}
                        <ChevronRight size={14} aria-hidden />
                      </Link>
                    )}
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
          {/* 原価サマリーカード(2026-07-16 裁定1で新設)は2026-07-20 便AJ(docs/45)で丸ごと削除
              (オーナー指示。上部メタ行の概算食費「約◯円」「1食あたり 約◯円」は不変のため重複していた)。
              代わりに「原価を編集」モードの説明を1文だけ出す。
              2026-08-23 便JO: 置き場所を材料の一覧の**上から下へ**移した。上に出していたときは、
              「原価を編集」を押すたびにこの1文（実測48px＝2行）が挟まって材料の文字が下へずれていた。
              下なら出ても消えても材料の行は1pxも動かず、単価を直したあとに
              「どこへ保存されたのか」を読む順番としても自然になる */}
          {costMode === 'edit' && (
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.detail.priceEditNote}</p>
          )}
        </section>

        {/* 栄養価のめやす（M6-1）: 公開前はティーザー、公開後は未解錠ゲート/実表示(③)。
            key={id}: レシピを移ったら作り直す。1回だけのお試し表示(2026-08-08 便DZ)を
            開いたまま別のレシピへ移ると、そのレシピでも8項目が出たままになるため */}
        <NutritionTeaser key={id} isPro={!!settings?.proCode} recipe={recipe} servings={servings} />

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
                    setShowCookHint(false)
                    setFocusOpen(true)
                  }}
                  className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold text-accent-ink ${
                    showCookHint ? 'border-accent ring-2 ring-accent/30' : 'border-edge'
                  }`}
                >
                  <Maximize2 size={16} aria-hidden />
                  {ja.focus.open}
                </button>
                {/* 初回のみ・1回だけの控えめなヒント(docs/55 CEO提案1-5)。表示済みフラグで再表示しない */}
                {showCookHint && (
                  <div className="mt-1 flex items-center justify-end gap-1">
                    <span className="rounded-sm border border-accent bg-accent/10 px-2 py-1 text-xs font-bold text-accent-ink">
                      {ja.focus.firstHint}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowCookHint(false)}
                      aria-label={ja.common.close}
                      className="tap-target shrink-0 rounded-full p-1 text-ink-muted"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          {/* 初見でも何ができるボタンか分かるように一言添える(名称自体は変えない)。
              2026-07-28 機能④診断C16で読み上げ・声の操作・タイマーまで書き足したので、
              ボタンと同じ shrink-0 の箱に入れると375px幅でページごと横あふれする。
              見出し行の外に出して、折り返せる全幅の1行として置く */}
          {recipe.steps.length > 0 && (
            <p className="mt-0.5 text-right text-xs text-ink-muted">{ja.focus.openHint}</p>
          )}
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
                    {/* 文中の「10分」などはタップでタイマー開始、辞書語はタップで説明。
                        行組みは読点優先・幅実測の自前エンジン(ComposedStepText)が決める(2026-07-21) */}
                    <p className="ja-phrase">
                      <ComposedStepText
                        text={step.text}
                        ingredientNames={ingredientNames}
                        onOpenTerm={openTerm}
                        onStartTimer={(_tokenText, seconds) =>
                          startTimer({
                            key: stepTimerKey(id, index, seconds),
                            label: recipe.title,
                            doneLabel: deriveDoneLabel(step.text),
                            seconds,
                            recipeId: id,
                            stepNumber,
                          })
                        }
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
                    {/* 安全のめやす（便JH）。手順の本文・利用者のメモは1文字も変えず、その下に別の枠で添える */}
                    <SafetyNotes
                      notes={stepSafetyNotes(safetyNotes, index)}
                      place="step"
                      testId={`safety-step-${index}`}
                      className="mt-[var(--space-sm)]"
                    />
                    {step.minutes != null &&
                      step.minutes > 0 &&
                      !isMinutesShownInText(step.text, step.minutes) && (
                      <button
                        type="button"
                        onClick={() =>
                          startTimer({
                            key: stepTimerKey(id, index, (step.minutes ?? 0) * 60),
                            label: recipe.title,
                            doneLabel: deriveDoneLabel(step.text),
                            seconds: (step.minutes ?? 0) * 60,
                            recipeId: id,
                            stepNumber,
                          })
                        }
                        aria-label={ja.timer.start}
                        className="mt-1 inline-flex items-center gap-1 rounded-sm px-2 py-1 text-sm font-bold text-accent-ink underline underline-offset-2"
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
              className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)]"
              onOpenTerm={openTerm}
            />
          </section>
        )}
        {recipe.memo && (
          <section className="mt-[var(--space-lg)]">
            <h2 className="text-xl font-bold">{ja.detail.memo}</h2>
            <MemoText
              text={recipe.memo}
              className="mt-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-md)]"
              onOpenTerm={openTerm}
            />
          </section>
        )}
        {/* 安全のめやす（便JH）。保存・再加熱・対象者の案内はレシピ全体の話なのでメモの並びに置く（D-④の置き場所） */}
        {recipeSafetyNotes.length > 0 && (
          <section className="mt-[var(--space-lg)]">
            <SafetyNotes notes={recipeSafetyNotes} place="recipe" testId="safety-recipe" />
          </section>
        )}
        {/* 参照元(2026-07-28 便BW/C-19): http/https のときだけリンクにする。
            それ以外(「javascript:…」や URL でない文字列)は押しても何も起きないリンクになるため、
            リンクにはせず入力された文字をそのまま見せる(勝手に消さない) */}
        {recipe.sourceUrl && (
          <p className="mt-[var(--space-md)]">
            {isHttpUrl(recipe.sourceUrl) ? (
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent-ink underline"
              >
                <ExternalLink size={16} aria-hidden />
                {ja.detail.source}
              </a>
            ) : (
              <span className="text-sm break-all text-ink-muted">
                {ja.detail.source}: {recipe.sourceUrl}
              </span>
            )}
          </p>
        )}

        {/* 作った記録 */}
        {recipe.cookedLogs.length > 0 && (
          <section className="mt-[var(--space-lg)]">
            {/* 見出しの横に、残りの記録へ行ける導線を置く(2026-07-29 便CI/C03)。
                ここは直近5件しか出さないのに「(50回)」とだけ出ていて、残り45件へ辿る手段が
                アプリのどこにも無かった。飛び先は履歴ページのこのレシピだけの絞り込み表示 */}
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-xl font-bold">
                {ja.detail.cookedLogsTitle}（{recipe.cookedLogs.length}
                {ja.detail.cookedCountSuffix}）
              </h2>
              {recipe.cookedLogs.length > 5 && (
                <Link
                  to={`/history?recipe=${id}`}
                  className="shrink-0 text-sm font-bold text-accent-ink underline"
                >
                  {ja.detail.cookedLogsSeeAll.replace('{n}', String(recipe.cookedLogs.length - 5))}
                </Link>
              )}
            </div>
            {/* 出すのは直近5件まで（残りは一覧へ）。ただし「作った記録の一覧」の小窓から
                6件目より古い記録の編集に来たとき(?editLog=・2026-08-09 便EQ)は、
                その記録までを描かないと開いた編集フォームが画面に無いことになるため伸ばす */}
            <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
              {recipe.cookedLogs.slice(0, Math.max(5, (editingLogIndex ?? -1) + 1)).map((log, index) => {
                const logPhoto = log.photo
                return (
                  <li key={index} className="px-[var(--space-md)] py-2">
                    {editingLogIndex === index ? (
                      // 押した行が画面の外へ見切れないよう、開いてから位置を合わせる
                      // （2026-08-09 便EO・オーナー実機「編集ボタンを押しても編集画面が
                      //   画面外に見切れてしまう」）
                      // 入力欄そのものは共通部品（2026-08-10 便FD で切り出し）。
                      // 記録の小窓（カレンダーなど）からも同じ欄を開く＝同じ欄を2つ書かない
                      <div ref={logEditRef}>
                        <CookedLogEditor
                          recipeId={id}
                          logIndex={index}
                          log={log}
                          fallbackServings={recipe.servings}
                          totalLogCount={recipe.cookedLogs.length}
                          onSaved={() => setEditingLogIndex(null)}
                          onCancel={() => setEditingLogIndex(null)}
                          onDeleted={() => {
                            setEditingLogIndex(null)
                            setMessage(ja.detail.cookedLogDeletedToast)
                          }}
                        />
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
                              {/* 記録した人数を見えるようにする(2026-07-29 便CI/C05) */}
                              {log.servings != null && (
                                <>
                                  {'　'}
                                  {ja.detail.cookedServingsValue.replace(
                                    '{n}',
                                    String(log.servings),
                                  )}
                                </>
                              )}
                            </span>
                            {log.note && <p className="mt-0.5">{log.note}</p>}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            openEditLog(index)
                          }
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
            className="flex items-center justify-center rounded-md border border-edge bg-surface px-4 py-4 font-bold text-accent-ink shadow-sm"
          >
            <Share2 size={22} aria-hidden />
          </button>
        </div>
      </div>

      {focusOpen && (
        <FocusMode
          recipe={focusRecipe}
          recipeId={id}
          // 時短版への切り替えや別レシピへの移動で手順数が減ることがあるため、
          // 覚えている位置は必ず今の手順数に収める(範囲外だと開いても何も出ない)
          initialStep={Math.max(0, Math.min(focusStep, focusRecipe.steps.length - 1))}
          onClose={(lastStep) => {
            setFocusStep(lastStep ?? 0)
            setFocusOpen(false)
          }}
          onComplete={() => {
            // 完成！→ そのまま「作った！」の記録フォームを開く(達成感と記録導線をつなぐ)
            setFocusOpen(false)
            // 作り終えたので次に開くときは手順1から
            setFocusStep(0)
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
        // 何人分作ったかを見せて直せるようにする(2026-07-29 便CI/C05)
        servings={logServings ?? servings}
        onServingsChange={setLogServings}
        onDateChange={setLogDate}
        onNoteChange={setLogNote}
        onPhotoChange={setLogPhoto}
        onSave={saveLog}
        onClose={() => {
          setLogOpen(false)
          setLogPhoto(undefined)
          // 「やめる」で写真だけ消えてメモが残るのは不揃い＝書きかけを捨てたつもりのメモが
          // 次の記録に混ざっていた(2026-07-29 便CI/C19)。保存時(saveLog)と同じく必ず空に戻す
          setLogNote('')
        }}
        // 在庫反映スイッチ(2026-07-23 #11): settingsを直接の真実の源にして即永続化＝選択を記憶する
        reflectPantry={settings?.cookedReflectPantry ?? false}
        onReflectPantryChange={(value) => void updateSettings({ cookedReflectPantry: value })}
        inTodayList={isInTodayList}
      />
      {/* シェアの選択式モーダル(2026-07-16 裁定3)。栄養行はNUTRITION_TEASER_ENABLED=falseなら
          行ごと非表示(緊急停止フラグと連動)。選択は開くたび既定値に初期化・永続化しない */}
      <ShareModal
        open={shareOpen}
        servings={servings}
        cookMinutesAvailable={shareCookMinutesAvailable}
        costAvailable={shareCostAvailable}
        nutritionRowVisible={NUTRITION_TEASER_ENABLED}
        nutritionAvailable={shareNutritionAvailable}
        nutritionIncludesSalt={shareNutritionSalt}
        sharing={sharing}
        message={shareMessage}
        onShare={(kind, selection) => void runShare(kind, selection)}
        onClose={() => setShareOpen(false)}
      />
      {/* 写真の見える範囲（2026-08-22 便JK）。写真そのものは書き換えず、
          「どこを見せるか」だけをレシピに覚える＝何度でも直せる・中央にも戻せる */}
      <PhotoFocusModal
        open={photoFocusOpen}
        photo={recipe.photo}
        title={recipe.title}
        focus={recipe.photoFocus}
        onApply={(next) => {
          void updatePhotoFocus(id, next)
          setPhotoFocusOpen(false)
        }}
        onClose={() => setPhotoFocusOpen(false)}
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
      {/* 消える操作の直後だけ「元に戻す」を添える（2026-08-21 便IU・⑦。献立の日タブと同じ形） */}
      <Toast
        message={message}
        onClose={() => {
          setMessage('')
          setUndoRemove(null)
        }}
        actionLabel={undoRemoveActive ? ja.common.undo : undefined}
        onAction={undoRemoveActive ? () => void runUndoRemove() : undefined}
      />
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
              className="tap-target absolute -right-2 -top-2 rounded-full border border-edge bg-surface p-1.5 text-ink-muted shadow-sm"
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

      {/* 「食数の設定」「台所の器具」の初回の案内（2026-08-13 便GE）。
          レシピ詳細を初めて開いたときに1回だけ出す（判定は上の副作用） */}
      {showFirstSetupNotice && (
        <FirstSetupNotice onClose={() => setShowFirstSetupNotice(false)} />
      )}
    </div>
  )
}
