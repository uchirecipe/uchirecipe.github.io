import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Dices,
  X,
  Search,
  ShoppingCart,
  CheckCircle2,
  Clock,
  TriangleAlert,
  Lock,
  Route,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { usePriceEntries } from '../db/prices'
import {
  useMealPlanRange,
  addMealEntry,
  updateMealEntryRecipe,
  removeMealEntry,
  setMainMeal,
  clearMealSlotInRange,
} from '../db/mealPlan'
import Toast from '../components/Toast'
import {
  useTodayList,
  removeFromTodayList,
  markTodayListCooked,
  markAllTodayListCooked,
  importRecipeIdsToTodayList,
} from '../db/todayList'
import {
  MEAL_SLOTS,
  MEAL_GENRES,
  weekDates,
  shiftWeek,
  monthDates,
  shiftMonth,
  monthLeadingBlanks,
  suggestForSlot,
  suggestPairForSlot,
  todayPlanMismatch,
} from '../logic/mealPlan'
import type { MealGenre } from '../logic/mealPlan'
import { todayString } from '../logic/date'
import { hasNgIngredient } from '../logic/ng'
import { buildPriceIndex, estimateRecipeCost } from '../logic/priceEstimate'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import type { MealPlanEntry, MealRole, MealSlot, Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/** 献立タブの3タブ構成（2026-07-16 便U-1: 現行の「今日セクション+週/月切替」をタブへ再構成） */
type MealPlanViewMode = 'day' | 'week' | 'month'

/** 今日の献立の1行（小サムネ＋名前＋作った/×） */
function TodayListRow({
  recipe,
  onCooked,
  onRemove,
}: {
  recipe: Recipe
  onCooked: () => void
  onRemove: () => void
}) {
  const photoUrl = usePhotoUrl(recipe.photo)
  // state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
  // RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(献立タブ)へ
  // 戻るために参照する（2026-07-12オーナー指示）。
  // ?focus=today を付けて「今日の献立から戻ってきた」ことをMealPlanPageに伝える。
  // これが付いていると、日タブを必ず選択した状態に固定する
  // （2026-07-15オーナー実機フィードバック: 今日の献立からレシピを開いて戻ると
  // 今週の献立に飛ばされる、の恒久対策。2026-07-16便U-1でタブ構成に再設計後もこの
  // 「戻ったら必ず日タブ」という保証は維持する）
  const fromState = { from: 'todayList' as const, fromPath: '/meal-plan?focus=today' }
  return (
    <li className="flex items-center gap-2 px-[var(--space-sm)] py-2">
      <Link
        to={`/recipes/${recipe.id}`}
        state={fromState}
        className="h-10 w-10 shrink-0 overflow-hidden rounded-sm"
      >
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} iconSize={20} />
        )}
      </Link>
      <Link to={`/recipes/${recipe.id}`} state={fromState} className="min-w-0 flex-1 truncate font-bold">
        {recipe.title}
      </Link>
      <button
        type="button"
        onClick={onCooked}
        aria-label={ja.mealPlan.todayMarkCooked}
        className="rounded-full p-2 text-accent"
      >
        <CheckCircle2 size={20} aria-hidden />
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ja.mealPlan.todayRemove}
        className="rounded-full p-2 text-ink-muted"
      >
        <X size={20} aria-hidden />
      </button>
    </li>
  )
}

/** 献立の1枠内の1行分（主菜/副菜の実データ行、または未割り当てのプレースホルダー行） */
type MealPlanRow =
  | { kind: 'entry'; entry: MealPlanEntry }
  | { kind: 'empty'; removable: boolean; extraLocalId?: string }

/** 「＋枠を追加」で増やした、まだレシピが割り当てられていない行（DBには保存しないUIだけの状態） */
interface ExtraRow {
  localId: string
  role: MealRole
}

/** ある日×枠の役割(主菜/副菜)ごとに表示する行を組み立てる。
 * 実データが1件もない役割は「未定」の行を1つ必ず表示し、+ボタンで増やした分を後ろに続ける */
function buildRoleRows(slotEntries: MealPlanEntry[], role: MealRole, extra: ExtraRow[]): MealPlanRow[] {
  const roleEntries = slotEntries.filter((e) => (e.role ?? 'main') === role)
  const rows: MealPlanRow[] = roleEntries.map((entry) => ({ kind: 'entry', entry }))
  if (roleEntries.length === 0) {
    rows.push({ kind: 'empty', removable: false })
  }
  extra
    .filter((x) => x.role === role)
    .forEach((x) => {
      rows.push({ kind: 'empty', removable: true, extraLocalId: x.localId })
    })
  return rows
}

/** 日×枠キーで束ねられたエントリ配列を、日付をキーに持つ配列からMap化する共通ヘルパー */
function groupBySlot(entries: MealPlanEntry[] | undefined): Map<MealSlot, MealPlanEntry[]> {
  const map = new Map<MealSlot, MealPlanEntry[]>()
  entries?.forEach((e) => {
    const list = map.get(e.slot)
    if (list) list.push(e)
    else map.set(e.slot, [e])
  })
  return map
}

/** 献立タブ: 「日」「週」「月」の3タブでレシピを割り当てる（2026-07-16 便U再構成） */
export default function MealPlanPage() {
  const navigate = useNavigate()
  const recipes = useLiveQuery(listRecipes, [])
  const [searchParams, setSearchParams] = useSearchParams()
  const settings = useSettings()
  // 食材価格マスタ（未入力の材料だけ目安価格で補うフォールバック。docs/20 §3）
  const priceEntries = usePriceEntries()
  const priceIndex = useMemo(() => buildPriceIndex(priceEntries ?? []), [priceEntries])
  const today = useMemo(todayString, [])
  const [weekStart, setWeekStart] = useState(() => weekDates(new Date())[0])
  const dates = useMemo(() => weekDates(new Date(`${weekStart}T00:00:00`)), [weekStart])
  // 今、当週を見ているか(Fix1: 中央チップの「今週へ戻る」ラベル/アイコンは当週以外のときだけ出す)
  const isAtCurrentWeek = dates[0] === weekDates(new Date())[0]

  const entries = useMealPlanRange(dates[0], dates[6])
  // 「今日」の週プラン登録は、週タブで表示中の週(weekStart)に依存させない
  // （2026-07-16 便U: 日タブが週タブから独立した別タブになったため。以前はentries(週タブの
  // 表示中の週)からtoday部分を抜き出していたが、週タブで別の週へ移動した状態のまま
  // 日タブを開くと「今日」の分が拾えなくなる結合があった。今日の日付だけを別途取得して解消する）
  const todayEntries = useMealPlanRange(today, today)

  // 3タブ（日/週/月。月はPro機能・既存ゲート維持）。既定は「日」タブ
  const [viewMode, setViewMode] = useState<MealPlanViewMode>('day')
  const [monthAnchor, setMonthAnchor] = useState(() => todayString())
  const isPro = !!settings?.proCode
  const monthDatesList = useMemo(
    () => monthDates(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  const monthLeading = useMemo(
    () => monthLeadingBlanks(new Date(`${monthAnchor}T00:00:00`)),
    [monthAnchor],
  )
  // 今、当月を見ているか(Fix2: 中央チップの「今月へ戻る」ラベル/アイコンは当月以外のときだけ出す)
  const isAtCurrentMonth = monthAnchor.slice(0, 7) === todayString().slice(0, 7)
  const monthEntries = useMealPlanRange(
    monthDatesList[0],
    monthDatesList[monthDatesList.length - 1],
  )
  const monthDaysWithPlan = useMemo(() => {
    const set = new Set<string>()
    monthEntries?.forEach((e) => set.add(e.date))
    return set
  }, [monthEntries])
  // 月タブ: 日タップで開くその日の献立モーダル（便U-5。従来の即週ジャンプはモーダル内の
  // ボタンへ移動）。nullなら非表示
  const [dayModalDate, setDayModalDate] = useState<string | null>(null)
  const goToWeekOf = (date: string) => {
    setWeekStart(weekDates(new Date(`${date}T00:00:00`))[0])
    setViewMode('week')
  }
  // 日×枠キー("date|slot")ごとの全エントリ（主菜+副菜など複数件を保持する。2026-07-13対応）
  const entriesByDateSlot = useMemo(() => {
    const map = new Map<string, MealPlanEntry[]>()
    entries?.forEach((e) => {
      const key = `${e.date}|${e.slot}`
      const list = map.get(key)
      if (list) list.push(e)
      else map.set(key, [e])
    })
    return map
  }, [entries])
  // 「今日」だけの枠別マップ（食い違い検出UI用。todayEntries由来でweekStartに依存しない）
  const todayEntriesBySlot = useMemo(() => groupBySlot(todayEntries), [todayEntries])
  // 月タブの日タップモーダル用（monthEntries由来なので表示帯フィルタに関係なく朝昼夕すべてを見せる）
  const dayModalEntries = useMemo(() => {
    if (!dayModalDate) return []
    return (monthEntries ?? []).filter((e) => e.date === dayModalDate)
  }, [monthEntries, dayModalDate])
  const dayModalBySlot = useMemo(() => groupBySlot(dayModalEntries), [dayModalEntries])
  const dayModalTitle = dayModalDate
    ? ja.mealPlan.monthDayModalTitle
        .replace('{m}', String(Number(dayModalDate.slice(5, 7))))
        .replace('{d}', String(Number(dayModalDate.slice(8, 10))))
    : ''

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // 表示する食事帯（未設定なら朝昼夜すべて。実際の既定値は起動時のresolveVisibleMealSlotsIfNeededが
  // 新規ユーザー=夕食のみ/既存ユーザー=3枠のどちらかに決めて保存する。ここでの[...MEAL_SLOTS]は
  // その保存が終わるまでの一瞬だけ使われるフォールバック）。日タブ・週タブの両方で同じ設定値を使う
  const visibleSlots = settings?.visibleMealSlots ?? [...MEAL_SLOTS]
  const toggleSlot = (slot: MealSlot) => {
    const next = visibleSlots.includes(slot)
      ? visibleSlots.filter((s) => s !== slot)
      : [...visibleSlots, slot]
    // 全部外すことはできない（何も見えなくなるため）。以前は無反応だっただけだったが、
    // 何も起きない理由が伝わらないとの指摘(第4波ペルソナPDCA Fix6)を受け、トーストで説明する
    if (next.length === 0) {
      setMessage(ja.mealPlan.slotFilterKeepOne)
      return
    }
    void updateSettings({ visibleMealSlots: next })
  }
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    visibleRecipes.forEach((r) => map.set(r.id!, r))
    return map
  }, [visibleRecipes])

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）
  const todayList = useTodayList()
  const todayListRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])

  // 今日の日付の週プラン登録のうち「表示中の食事帯」に入っているレシピID
  // （手動取り込みボタン・自動取り込み(便U-3)・食い違い検出の3つで共通利用。todayEntries由来
  // なので週タブでどの週を見ているか(weekStart)に関係なく常に「今日」を指す）
  const todayFromPlanIds = useMemo(() => {
    const ids = new Set<number>()
    todayEntries?.forEach((e) => {
      if (visibleSlots.includes(e.slot)) ids.add(e.recipeId)
    })
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayEntries, settings?.visibleMealSlots])

  // 「今日の献立」にあるのに、今日の週プラン枠には入っていないレシピ
  // (週プランを使っていない=今日の枠が0件のときは食い違い扱いにしない)
  const mismatchRecipes = useMemo(() => {
    const todayListIds = todayList?.map((item) => item.recipeId) ?? []
    const mismatchIds = todayPlanMismatch(todayListIds, todayFromPlanIds)
    return mismatchIds
      .map((id) => recipeById.get(id))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, todayFromPlanIds, recipeById])

  // 献立タブを開いたときの初期タブ(2026-07-16 便U-1でタブ構成に再設計): 既定は「日」タブ。
  // ?focus=today が付いている場合(今日の献立からレシピを開いて戻ってきた場合)は、明示的に
  // 「日」タブへ固定し最上部へスクロールする（2026-07-15オーナー実機フィードバック対策を維持）。
  // パラメータは消費したら消す(次の「素の献立タブ開き」で通常の既定=日タブに戻すため)。
  // 初回1回だけ処理する(liveQueryの再評価のたびに動かないようinitialFocusRefで守る)
  const initialFocusRef = useRef(false)
  useEffect(() => {
    if (initialFocusRef.current) return
    initialFocusRef.current = true
    if (searchParams.get('focus') === 'today') {
      setViewMode('day')
      window.scrollTo(0, 0)
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('focus')
          return next
        },
        { replace: true },
      )
    }
  }, [searchParams, setSearchParams])

  // 自動取り込み(便U-3・設計確定): 日タブを開いたとき、今日の日付の週プラン登録
  // (表示中の食事帯のみ)を今日の献立へ自動取り込みする。既存の手動取り込みボタンと同じ
  // importRecipeIdsToTodayList(重複はスキップ)をそのまま使うため、何度呼んでも重複追加は
  // されない=冪等。ただし「同じ日付につき1回だけ」自動実行する歯止めとして
  // settings.lastAutoImportDateを使う：既に今日の日付が保存されていれば即return(=何もしない)。
  // これにより、ユーザーが取り込み後にその品を消しても、同じ日のうちに日タブを開き直した
  // だけでは再取り込みされない(=再出現しない)。
  // 日付の記録は「取り込み対象が1件以上あったとき」だけ行う：対象0件の空振りでも記録して
  // しまうと、「朝に日タブを見る(まだ計画なし)→週タブで今日の分を計画→日タブへ戻る」という
  // ごく自然な初回動線で、その日はもう自動取り込みが効かなくなるため。空振り時は何も書かない。
  // それでも「消した品の再出現」は起きない：消せる品が今日の献立にあった=取り込みが実行済み
  // =日付記録済み、なのでその日のうちの再実行は必ずスキップされる
  useEffect(() => {
    if (viewMode !== 'day') return
    if (settings === undefined || todayEntries === undefined) return
    if (settings.lastAutoImportDate === today) return
    if (todayFromPlanIds.length === 0) return
    void (async () => {
      await importRecipeIdsToTodayList(todayFromPlanIds)
      await updateSettings({ lastAutoImportDate: today })
    })()
  }, [viewMode, settings, todayEntries, todayFromPlanIds, today])

  const [quickOnly, setQuickOnly] = useState(false)
  // 自動提案の条件UI(2026-07-13追加): ジャンル優先(指定なしも含め単一選択)・高たんぱく優先
  const [genreFilter, setGenreFilter] = useState<MealGenre | undefined>(undefined)
  const [preferHighProtein, setPreferHighProtein] = useState(false)
  // 提案条件6ボタンの折りたたみ(2026-07-16 UI総点検A-3)。既定閉
  const [suggestConditionsOpen, setSuggestConditionsOpen] = useState(false)
  const [message, setMessage] = useState('')

  // 「＋枠を追加」でUI上だけ増やした未割り当て行（date|slotキー→役割つきの一覧）。
  // レシピが割り当てられた時点でDBの実エントリに置き換わるため、ここからは取り除く
  const [extraRows, setExtraRows] = useState<Record<string, ExtraRow[]>>({})
  const extraRowSeq = useRef(0)
  const addExtraRow = (date: string, slot: MealSlot, role: MealRole) => {
    extraRowSeq.current += 1
    const localId = `extra-${extraRowSeq.current}`
    const key = `${date}|${slot}`
    setExtraRows((prev) => ({ ...prev, [key]: [...(prev[key] ?? []), { localId, role }] }))
  }
  const removeExtraRowState = (date: string, slot: MealSlot, localId: string) => {
    const key = `${date}|${slot}`
    setExtraRows((prev) => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((r) => r.localId !== localId),
    }))
  }
  // 「＋枠を追加」タップ後、主菜/副菜どちらを足すか選ぶ小さなメニューの開閉(date|slotキー。同時に1つだけ)
  const [addMenuFor, setAddMenuFor] = useState<string | null>(null)

  // レシピ選択ピッカー（どの日・枠・役割・行を対象にしているか。entryIdがあれば既存行の差し替え、
  // 無ければ新規追加。extraLocalIdは「＋枠を追加」で増やした未割り当て行に割り当てたときの後始末用）
  const [pickerTarget, setPickerTarget] = useState<{
    date: string
    slot: MealSlot
    role: MealRole
    entryId?: number
    extraLocalId?: string
  } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')
  const filteredRecipes = useMemo(() => {
    const q = pickerQuery.trim()
    if (!q) return visibleRecipes
    return visibleRecipes.filter((r) => r.title.includes(q))
  }, [visibleRecipes, pickerQuery])
  // 今開いている行に現在割り当て済みのレシピID(Fix4: 埋まった行を開いても他の候補と
  // 同じ見た目で無確認上書きしてしまう問題の対策で、先頭固定＋選択中バッジに使う)
  const currentPickerRecipeId = useMemo(() => {
    if (pickerTarget?.entryId == null) return undefined
    return entries?.find((e) => e.id === pickerTarget.entryId)?.recipeId
  }, [pickerTarget, entries])
  // 表示用リスト: 現在割り当て済みのレシピが絞り込み結果に含まれるときだけ先頭に固定する。
  // 検索で絞り込まれて対象外になった場合は並べ替えない(＝バッジも出ない)
  const displayedRecipes = useMemo(() => {
    if (currentPickerRecipeId == null) return filteredRecipes
    const idx = filteredRecipes.findIndex((r) => r.id === currentPickerRecipeId)
    if (idx <= 0) return filteredRecipes
    const current = filteredRecipes[idx]
    return [current, ...filteredRecipes.slice(0, idx), ...filteredRecipes.slice(idx + 1)]
  }, [filteredRecipes, currentPickerRecipeId])

  const openPicker = (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    setPickerTarget({ date, slot, role, entryId, extraLocalId })
    setPickerQuery('')
  }

  const pickRecipe = async (recipeId: number) => {
    if (!pickerTarget) return
    const { date, slot, role, entryId, extraLocalId } = pickerTarget
    if (entryId != null) {
      await updateMealEntryRecipe(entryId, recipeId)
    } else {
      await addMealEntry(date, slot, recipeId, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
    }
    setPickerTarget(null)
  }

  /** 行の「×」: 既存の割り当てなら削除、追加しただけの未割り当て行ならUI上から取り消す */
  const clearRow = async (date: string, slot: MealSlot, entryId?: number, extraLocalId?: string) => {
    if (entryId != null) {
      await removeMealEntry(entryId)
    } else if (extraLocalId) {
      removeExtraRowState(date, slot, extraLocalId)
    }
  }

  /**
   * 行の「サイコロ」: その行だけに自動提案を適用する。ただし対象の枠(主菜・副菜とも)が
   * 丸ごと空のときだけは、主菜+副菜のペアで一度に埋める(Fable設計2026-07-13: 「献立を
   * 決めたい」という主目的に沿わせるため、片方だけでなく両方を1タップで提案する)
   */
  const suggestRow = async (
    date: string,
    slot: MealSlot,
    role: MealRole,
    entryId?: number,
    extraLocalId?: string,
  ) => {
    if (!recipes) return
    setMessage('')
    const slotEntries = entriesByDateSlot.get(`${date}|${slot}`) ?? []
    const isSlotEmpty = slotEntries.length === 0
    const usedRecipeIds = (entries ?? []).filter((e) => e.id !== entryId).map((e) => e.recipeId)
    const baseOptions = {
      quickOnly,
      excludeNg: true,
      ngIngredients: settings?.ngIngredients ?? [],
      usedRecipeIds,
      slot,
      genre: genreFilter,
      preferHighProtein,
    }
    if (isSlotEmpty && entryId == null) {
      const { main, side } = suggestPairForSlot(visibleRecipes, baseOptions)
      if (!main && !side) {
        setMessage(ja.mealPlan.noSuggestion)
        return
      }
      if (main) await addMealEntry(date, slot, main.id!, 'main')
      if (side) await addMealEntry(date, slot, side.id!, 'side')
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
      return
    }
    const picked = suggestForSlot(visibleRecipes, { ...baseOptions, role })
    if (!picked) {
      setMessage(ja.mealPlan.noSuggestion)
      return
    }
    if (entryId != null) {
      await updateMealEntryRecipe(entryId, picked.id!)
    } else {
      await addMealEntry(date, slot, picked.id!, role)
      if (extraLocalId) removeExtraRowState(date, slot, extraLocalId)
    }
  }

  /**
   * 週の表示中の食事帯すべてを、押すたびに新しい提案で埋め直す(再抽選)。
   * 以前は空いている枠だけを埋める仕様だったため、埋まった後の2回目以降のタップが
   * 無反応になっていた(2026-07-14オーナー実機フィードバック)。この対策として、
   * 表示中の全枠(手動で選んだ枠も含む)の既存割り当てを一旦クリアしてから、
   * suggestPairForSlotの既存のランダム性を使って主菜+副菜のペアで再提案する。
   * 「まとめて立てる」という一括操作の性質上、手動で選んだ枠も上書きされる挙動は
   * 妥当と判断した(Fable設計2026-07-14)。
   * 表示中の食事帯に含まれない枠(例: 朝食を非表示にしている状態で夕食だけ埋め直す場合の朝食)
   * の既存レシピは、重複を避けるための除外対象として引き続き使う。
   */
  const fillWeek = async () => {
    if (!recipes) return
    setMessage('')
    const touchedKeys = new Set(
      dates.flatMap((date) => visibleSlots.map((slot) => `${date}|${slot}`)),
    )
    const usedRecipeIds = (entries ?? [])
      .filter((e) => !touchedKeys.has(`${e.date}|${e.slot}`))
      .map((e) => e.recipeId)
    for (const date of dates) {
      for (const slot of visibleSlots) {
        const slotEntries = entriesByDateSlot.get(`${date}|${slot}`) ?? []
        for (const entry of slotEntries) {
          await removeMealEntry(entry.id!)
        }
        const { main, side } = suggestPairForSlot(visibleRecipes, {
          quickOnly,
          excludeNg: true,
          ngIngredients: settings?.ngIngredients ?? [],
          usedRecipeIds,
          slot,
          genre: genreFilter,
          preferHighProtein,
        })
        if (main) {
          await addMealEntry(date, slot, main.id!, 'main')
          usedRecipeIds.push(main.id!)
        }
        if (side) {
          await addMealEntry(date, slot, side.id!, 'side')
          usedRecipeIds.push(side.id!)
        }
      }
    }
  }

  // 週タブ「この帯の今週分を空にする」(便U-4 Fable設計: 「朝のみ削除したい」への回答)。
  // 帯を1つ選び、確認ダイアログを経てから、表示中の週(dates[0]〜dates[6]。週タブで
  // 前後移動している場合はその週)のうちその帯のエントリだけをまとめて削除する。
  // 概算食費(weekCostEstimate)はentries(全帯)を集計対象にしており、visibleSlotsで
  // フィルタしていないため、この削除で自動的に反映される(「登録されている献立全部」の
  // 集計のまま変えない、という仕様どおり)
  const [clearSlotTarget, setClearSlotTarget] = useState<MealSlot>('dinner')
  const clearWeekSlot = async () => {
    const label = ja.mealPlan.slot[clearSlotTarget]
    if (!window.confirm(ja.mealPlan.clearWeekSlotConfirm.replace('{slot}', label))) return
    await clearMealSlotInRange(dates[0], dates[6], clearSlotTarget)
    setMessage(ja.mealPlan.clearWeekSlotDone.replace('{slot}', label))
  }

  // 週の概算食費（材料ごとの価格入力を優先し、未入力の材料は食材価格マスタで補う。docs/20 §3）
  const weekCostEstimate = useMemo(() => {
    if (!entries) return { total: 0, fromMasterCount: 0 }
    return entries.reduce(
      (acc, e) => {
        const recipe = recipeById.get(e.recipeId)
        if (!recipe) return acc
        const estimate = estimateRecipeCost(recipe.ingredients, priceIndex)
        return {
          total: acc.total + estimate.total,
          fromMasterCount: acc.fromMasterCount + estimate.fromMasterCount,
        }
      },
      { total: 0, fromMasterCount: 0 },
    )
  }, [entries, recipeById, priceIndex])
  const weekCost = weekCostEstimate.total

  const weeklyBudget = settings?.weeklyBudget
  const budgetDiff = weeklyBudget != null ? weeklyBudget - weekCost : undefined

  // 価格情報（個別入力・マスタ一致のどちらか）が1件も無ければ「週の概算食費」セクションごと非表示にする
  // (価格情報が無い人には無意味な表示のため。2026-07-10 オーナー要望・docs/20 §3でマスタ一致も対象に追加)
  const hasPricedRecipe = useMemo(
    () => (recipes ?? []).some((r) => estimateRecipeCost(r.ingredients, priceIndex).hasAnyPriceInfo),
    [recipes, priceIndex],
  )

  const weekRecipeIds = useMemo(() => {
    const ids = new Set<number>()
    entries?.forEach((e) => {
      if (visibleSlots.includes(e.slot)) ids.add(e.recipeId)
    })
    // 「今日の献立」(今日つくるリスト)の分も買い物候補に含める。
    // 週の表を使わず今日の献立だけで運用する人の材料が漏れないように
    // (2026-07-09 ペルソナテスト第1波)。重複は既存の合算ロジックがまとめる
    todayList?.forEach((item) => ids.add(item.recipeId))
    return Array.from(ids)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, settings?.visibleMealSlots, todayList])

  const goShopping = () => {
    if (weekRecipeIds.length === 0) return
    navigate(`/shopping?recipeIds=${weekRecipeIds.join(',')}`)
  }

  const dowLabels = ja.mealPlan.dow

  /** 1行分のUI（役割ラベル＋レシピ名ボタン＋サイコロ＋×） */
  const renderRow = (date: string, slot: MealSlot, role: MealRole, row: MealPlanRow, key: string) => {
    const recipe = row.kind === 'entry' ? recipeById.get(row.entry.recipeId) : undefined
    const entryId = row.kind === 'entry' ? row.entry.id : undefined
    const extraLocalId = row.kind === 'empty' ? row.extraLocalId : undefined
    const showRemove = row.kind === 'entry' || row.removable
    return (
      <div key={key} className="flex items-center gap-2">
        <span className="w-10 shrink-0 text-xs font-bold text-ink-muted">{ja.mealPlan.role[role]}</span>
        <button
          type="button"
          onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}
          className="flex min-w-0 flex-1 items-center gap-1 truncate rounded-sm border border-edge bg-app px-2 py-2 text-left text-sm"
        >
          {recipe && hasNgIngredient(recipe, settings?.ngIngredients ?? []) && (
            <TriangleAlert
              size={14}
              className="shrink-0 text-warning"
              aria-label={ja.detail.ngWarning}
            />
          )}
          <span className="min-w-0 flex-1 truncate">
            {recipe ? recipe.title : <span className="text-ink-muted">{ja.mealPlan.empty}</span>}
          </span>
        </button>
        <button
          type="button"
          onClick={() => void suggestRow(date, slot, role, entryId, extraLocalId)}
          aria-label={ja.mealPlan.suggestAria}
          className="rounded-full p-2 text-accent"
        >
          <Dices size={18} aria-hidden />
        </button>
        {showRemove && (
          <button
            type="button"
            onClick={() => void clearRow(date, slot, entryId, extraLocalId)}
            aria-label={row.kind === 'entry' ? ja.mealPlan.clear : ja.mealPlan.removeExtraRow}
            className="rounded-full p-2 text-ink-muted"
          >
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
    )
  }

  // 提案条件が既定値から変わっていれば、畳んだトグルのラベルにも現在値を出す
  // (2026-07-16 UI総点検A-3: 「提案の条件: 和食」のように)
  const activeConditionSummaries: (string | undefined)[] = [
    quickOnly ? ja.mealPlan.quickOnlySummary : undefined,
    genreFilter,
    preferHighProtein ? ja.mealPlan.preferHighProteinToggle : undefined,
  ]
  const conditionsSummary = activeConditionSummaries.filter((v): v is string => Boolean(v)).join('・')

  /** 表示する食事帯トグル（日タブ・週タブで共用。便U-2: 既存visibleMealSlotsを日タブにも適用） */
  const renderSlotFilter = () => (
    <>
      <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.slotFilterTitle}</p>
      <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
        {MEAL_SLOTS.map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => toggleSlot(slot)}
            aria-pressed={visibleSlots.includes(slot)}
            className={`rounded-sm border px-3 py-2 text-sm font-bold ${
              visibleSlots.includes(slot)
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.mealPlan.slot[slot]}
          </button>
        ))}
      </div>
    </>
  )

  // 月タブの日タップモーダルはEscapeキーでも閉じる(CookedLogModalと同じ作法)
  useEffect(() => {
    if (!dayModalDate) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDayModalDate(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dayModalDate])

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.mealPlan.title}</h1>

      {/* 日／週／月の3タブ(便U-1) */}
      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setViewMode('day')}
          aria-pressed={viewMode === 'day'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'day'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewDay}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('week')}
          aria-pressed={viewMode === 'week'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'week'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewWeek}
        </button>
        <button
          type="button"
          onClick={() => setViewMode('month')}
          aria-pressed={viewMode === 'month'}
          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
            viewMode === 'month'
              ? 'border-accent bg-accent text-on-accent'
              : 'border-edge bg-surface text-ink-muted'
          }`}
        >
          {ja.mealPlan.viewMonth}
        </button>
      </div>

      <Toast message={message} onClose={() => setMessage('')} />

      {viewMode === 'day' && (
        <>
          {/* 今日の献立（週間プランナーとは別の「今日これ作る」リスト） */}
          <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
            <h2 className="text-xl font-bold">{ja.mealPlan.todayTitle}</h2>

            {todayListRecipes && todayListRecipes.length > 0 ? (
              <>
                <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
                  {todayListRecipes.map((recipe) => (
                    <TodayListRow
                      key={recipe.id}
                      recipe={recipe}
                      onCooked={() => {
                        void markTodayListCooked(recipe.id!)
                        // 2026-07-16 UI総点検A-4: 行が消えるだけの無言完了だったのでトーストで明示
                        setMessage(ja.mealPlan.todayCookedToast)
                      }}
                      onRemove={() => void removeFromTodayList(recipe.id!)}
                    />
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => void markAllTodayListCooked(todayListRecipes.map((r) => r.id!))}
                  className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                >
                  <CheckCircle2 size={18} aria-hidden />
                  {ja.mealPlan.todayMarkAllCooked}
                </button>

                {todayListRecipes.length >= 2 && (
                  <Link
                    to="/cook-navi"
                    className="mt-[var(--space-sm)] flex w-full items-center gap-2 rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
                  >
                    <Route size={20} className="shrink-0 text-accent" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-accent">{ja.mealPlan.cookNaviEntry}</span>
                      <span className="block text-xs text-ink-muted">{ja.mealPlan.cookNaviEntrySub}</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-ink-muted" aria-hidden />
                  </Link>
                )}

                {mismatchRecipes.length > 0 && (
                  <div className="mt-[var(--space-sm)] rounded-md border border-warning bg-surface p-[var(--space-sm)]">
                    <p className="flex items-center gap-1 text-sm font-bold text-warning">
                      <TriangleAlert size={16} aria-hidden />
                      {ja.mealPlan.planMismatchNotice}
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.planMismatchDescription}</p>
                    <div className="mt-[var(--space-sm)] space-y-2">
                      {mismatchRecipes.map((recipe) => (
                        <div key={recipe.id}>
                          <p className="truncate text-sm font-bold">{recipe.title}</p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {visibleSlots.map((slot) => {
                              const slotEntries = todayEntriesBySlot.get(slot) ?? []
                              const mainEntry = slotEntries.find((e) => (e.role ?? 'main') === 'main')
                              const currentTitle = mainEntry
                                ? recipeById.get(mainEntry.recipeId)?.title
                                : undefined
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => void setMainMeal(today, slot, recipe.id!)}
                                  className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                                >
                                  {ja.mealPlan.slot[slot]}
                                  <span className="ml-1 font-normal text-ink-muted">
                                    (
                                    {currentTitle
                                      ? ja.mealPlan.planMismatchCurrent.replace('{title}', currentTitle)
                                      : ja.mealPlan.planMismatchEmpty}
                                    )
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-[var(--space-sm)]">
                <p className="text-sm text-ink-muted">{ja.mealPlan.todayEmpty}</p>
                {todayFromPlanIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void importRecipeIdsToTodayList(todayFromPlanIds)}
                    className="mt-[var(--space-sm)] w-full rounded-sm border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm"
                  >
                    {ja.mealPlan.todayImport.replace('{n}', String(todayFromPlanIds.length))}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* 表示する食事帯（便U-2。今日の献立への自動取り込み(便U-3)がここで選んだ帯だけを対象にする） */}
          <div className="mt-[var(--space-md)]">
            {renderSlotFilter()}
            <p className="mt-1 text-xs text-ink-muted">{ja.mealPlan.daySlotFilterHint}</p>
          </div>
        </>
      )}

      {viewMode === 'month' &&
        (isPro ? (
          <div className="mt-[var(--space-md)]">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, -1))}
                aria-label={ja.mealPlan.prevMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
              >
                <ChevronLeft size={20} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor(todayString())}
                aria-label={isAtCurrentMonth ? undefined : ja.mealPlan.thisMonth}
                className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
              >
                {!isAtCurrentMonth && <RotateCcw size={14} className="text-accent" aria-hidden />}
                {monthAnchor.slice(0, 4)}/{monthAnchor.slice(5, 7)}
              </button>
              <button
                type="button"
                onClick={() => setMonthAnchor((d) => shiftMonth(d, 1))}
                aria-label={ja.mealPlan.nextMonth}
                className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
              >
                <ChevronRight size={20} aria-hidden />
              </button>
            </div>
            <div className="mt-[var(--space-sm)] grid grid-cols-7 gap-1 text-center text-xs font-bold text-ink-muted">
              {ja.mealPlan.dow.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: monthLeading }, (_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {monthDatesList.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setDayModalDate(date)}
                  className={`flex aspect-square flex-col items-center justify-center rounded-sm border text-sm ${
                    date === today
                      ? 'border-accent bg-accent text-on-accent font-bold'
                      : 'border-edge bg-surface text-ink'
                  }`}
                >
                  <span>{Number(date.slice(8, 10))}</span>
                  {monthDaysWithPlan.has(date) && (
                    <span
                      aria-label={ja.mealPlan.monthDayHasPlan}
                      className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                        date === today ? 'bg-app' : 'bg-accent'
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center shadow-sm">
            <Lock size={28} className="mx-auto text-ink-muted" aria-hidden />
            <p className="mt-[var(--space-sm)] font-bold">{ja.mealPlan.monthProGateTitle}</p>
            <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.monthProGateDescription}</p>
            <Link
              to="/settings?section=pro"
              className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent underline"
            >
              {ja.mealPlan.monthProGateLink}
            </Link>
          </div>
        ))}

      {viewMode === 'week' && (
      <>
      {/* 週の移動 */}
      <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, -1))}
          aria-label={ja.mealPlan.prevWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(weekDates(new Date())[0])}
          aria-label={isAtCurrentWeek ? undefined : ja.mealPlan.thisWeek}
          className="flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
        >
          {!isAtCurrentWeek && <RotateCcw size={14} className="text-accent" aria-hidden />}
          {dates[0].replaceAll('-', '/')} 〜 {dates[6].replaceAll('-', '/')}
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((d) => shiftWeek(d, 1))}
          aria-label={ja.mealPlan.nextWeek}
          className="rounded-full border border-edge bg-surface p-2 text-accent shadow-sm"
        >
          <ChevronRight size={20} aria-hidden />
        </button>
      </div>

      {/* 表示する食事帯 */}
      <div className="mt-[var(--space-md)]">{renderSlotFilter()}</div>

      {/* この帯の今週分を空にする(便U-4)。表示帯フィルタのすぐ近くに配置 */}
      <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-sm)]">
        <p className="text-sm font-bold text-ink-muted">{ja.mealPlan.clearWeekSlotTitle}</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setClearSlotTarget(slot)}
              aria-pressed={clearSlotTarget === slot}
              aria-label={ja.mealPlan.clearWeekSlotTargetAria.replace('{slot}', ja.mealPlan.slot[slot])}
              className={`rounded-sm border px-3 py-1.5 text-sm font-bold ${
                clearSlotTarget === slot
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-app text-ink-muted'
              }`}
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void clearWeekSlot()}
          className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-warning underline"
        >
          <Trash2 size={14} aria-hidden />
          {ja.mealPlan.clearWeekSlotButton}
        </button>
      </div>

      {/* 自動提案の条件: 時短優先・ジャンル(指定なし/和食/洋食/中華・単一選択)・高たんぱく優先。
          既定は折りたたみ(2026-07-16 UI総点検A-3: 常時全展開がP1/P2一致のゴチャつき指摘だったため)。
          畳んだ状態でも既定値から変わっていればラベルに現在値を出す */}
      <div className="mt-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => setSuggestConditionsOpen((v) => !v)}
          aria-expanded={suggestConditionsOpen}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
        >
          {ja.mealPlan.suggestConditionsToggle}
          {!suggestConditionsOpen && conditionsSummary ? `: ${conditionsSummary}` : ''}
          {suggestConditionsOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
        </button>

        {suggestConditionsOpen && (
          <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => setQuickOnly((v) => !v)}
              aria-pressed={quickOnly}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                quickOnly ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.quickOnlyToggle}
            </button>
            <button
              type="button"
              onClick={() => setGenreFilter(undefined)}
              aria-pressed={genreFilter === undefined}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                genreFilter === undefined
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.genreAny}
            </button>
            {MEAL_GENRES.map((genre) => (
              <button
                key={genre}
                type="button"
                onClick={() => setGenreFilter(genre)}
                aria-pressed={genreFilter === genre}
                className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                  genreFilter === genre
                    ? 'border-accent bg-accent text-on-accent'
                    : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                {genre}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPreferHighProtein((v) => !v)}
              aria-pressed={preferHighProtein}
              className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                preferHighProtein
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              {ja.mealPlan.preferHighProteinToggle}
            </button>
          </div>
        )}
      </div>

      <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => void fillWeek()}
          className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
        >
          <Dices size={14} aria-hidden />
          {ja.mealPlan.fillWeek}
        </button>
      </div>

      {/* 週の概算食費（材料に価格を1件も入力していない場合、または何も割り当てていない
          場合(weekCost===0)はセクションごと非表示。マスタ初期値由来の「約0円」ノイズを消す。
          第4波ペルソナPDCA Fix3） */}
      {hasPricedRecipe && weekCost > 0 && (
        <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <h2 className="font-bold">{ja.mealPlan.weekCostTitle}</h2>
          <p className="mt-1 text-2xl font-bold text-accent">約{weekCost.toLocaleString()}円</p>
          <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.weekCostNote}</p>
          <Link to="/prices" className="mt-1 inline-block text-sm font-bold text-accent underline">
            {ja.mealPlan.weekCostNoteLink}
          </Link>
          {weeklyBudget != null && budgetDiff != null ? (
            <p className="mt-1 text-sm font-bold text-ink-muted">
              {budgetDiff >= 0
                ? ja.mealPlan.budgetCompareUnder.replace('{n}', String(budgetDiff.toLocaleString()))
                : ja.mealPlan.budgetCompareOver.replace('{n}', String(Math.abs(budgetDiff).toLocaleString()))}
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-muted">{ja.mealPlan.budgetNotSet}</p>
          )}
        </section>
      )}

      {/* 7日分のカード */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
        {dates.map((date, dayIndex) => (
          <section
            key={date}
            className={`rounded-md border p-[var(--space-md)] shadow-sm ${
              date === today ? 'border-accent bg-surface' : 'border-edge bg-surface'
            }`}
          >
            <h2 className="font-bold">
              {dowLabels[dayIndex]} {date.replaceAll('-', '/')}
              {date === today && <span className="ml-2 text-sm text-accent">{ja.mealPlan.todayBadge}</span>}
            </h2>
            <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
              {visibleSlots.map((slot) => {
                const slotKey = `${date}|${slot}`
                const slotEntries = entriesByDateSlot.get(slotKey) ?? []
                const extra = extraRows[slotKey] ?? []
                const mainRows = buildRoleRows(slotEntries, 'main', extra)
                const sideRows = buildRoleRows(slotEntries, 'side', extra)
                const isAddMenuOpen = addMenuFor === slotKey
                return (
                  <div key={slot}>
                    <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                    <div className="mt-1 space-y-1">
                      {mainRows.map((row, i) =>
                        renderRow(date, slot, 'main', row, `main-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`),
                      )}
                      {sideRows.map((row, i) =>
                        renderRow(date, slot, 'side', row, `side-${i}-${row.kind === 'entry' ? row.entry.id : row.extraLocalId ?? 'default'}`),
                      )}
                    </div>
                    {isAddMenuOpen ? (
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            addExtraRow(date, slot, 'main')
                            setAddMenuFor(null)
                          }}
                          className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                        >
                          {ja.mealPlan.role.main}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            addExtraRow(date, slot, 'side')
                            setAddMenuFor(null)
                          }}
                          className="rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent"
                        >
                          {ja.mealPlan.role.side}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddMenuFor(null)}
                          aria-label={ja.focus.close}
                          className="rounded-full p-1 text-ink-muted"
                        >
                          <X size={14} aria-hidden />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddMenuFor(slotKey)}
                        className="mt-1 text-xs font-bold text-accent"
                      >
                        {ja.mealPlan.addRow}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      {/* この週の買い物リストを作る */}
      <button
        type="button"
        onClick={goShopping}
        disabled={weekRecipeIds.length === 0}
        className="mt-[var(--space-md)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
      >
        <ShoppingCart size={20} aria-hidden />
        {ja.mealPlan.goToShopping}
      </button>
      {weekRecipeIds.length === 0 && (
        <p className="mt-1 text-center text-sm text-ink-muted">{ja.mealPlan.goToShoppingEmpty}</p>
      )}

      <Link
        to="/history"
        className="mt-[var(--space-md)] block text-center text-sm font-bold text-accent underline"
      >
        {ja.mealPlan.historyLink}
      </Link>
      </>
      )}

      {/* レシピ選択ピッカー */}
      {pickerTarget && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.mealPlan.pickTitle}</h2>
            <button
              type="button"
              onClick={() => setPickerTarget(null)}
              aria-label={ja.focus.close}
              className="rounded-full p-2 text-ink-muted"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="px-[var(--space-md)]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={ja.mealPlan.pickSearchPlaceholder}
                className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-y-auto px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {displayedRecipes.map((recipe) => {
                  const isCurrentPick = recipe.id === currentPickerRecipeId
                  return (
                  <li key={recipe.id} className={isCurrentPick ? 'bg-accent/10' : undefined}>
                    <button
                      type="button"
                      onClick={() => void pickRecipe(recipe.id!)}
                      className="flex w-full items-center gap-2 px-[var(--space-md)] py-3 text-left"
                    >
                      {hasNgIngredient(recipe, settings?.ngIngredients ?? []) && (
                        <TriangleAlert
                          size={16}
                          className="shrink-0 text-warning"
                          aria-label={ja.detail.ngWarning}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                      {isCurrentPick && (
                        <span className="shrink-0 rounded-sm border border-accent px-1.5 py-0.5 text-xs font-bold text-accent">
                          {ja.mealPlan.pickCurrentBadge}
                        </span>
                      )}
                      <span className="flex shrink-0 items-center gap-2 text-xs text-ink-muted">
                        {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
                          <span className="inline-flex items-center gap-0.5">
                            <Clock size={12} aria-hidden />
                            {recipe.cookMinutes}
                            {ja.recipes.minutesSuffix}
                          </span>
                        )}
                        <span className="rounded-sm border border-edge px-1.5 py-0.5">
                          {ja.effort[recipe.effortLevel]}
                        </span>
                      </span>
                    </button>
                  </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* 月タブ: 日タップでその日の献立を窓表示(便U-5)。朝昼夕・レシピ名・タップで詳細へ、
          +「この週を開く」ボタン。従来の即週ジャンプはこのボタンへ移動した。
          献立の無い日は「献立はありません」+「この週を開く」を表示する */}
      {dayModalDate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setDayModalDate(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={dayModalTitle}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{dayModalTitle}</h3>
              <button
                type="button"
                onClick={() => setDayModalDate(null)}
                aria-label={ja.common.close}
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {dayModalEntries.length === 0 ? (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">{ja.mealPlan.monthDayModalEmpty}</p>
            ) : (
              <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {MEAL_SLOTS.filter((slot) => (dayModalBySlot.get(slot)?.length ?? 0) > 0).map((slot) => (
                  <div key={slot}>
                    <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.slot[slot]}</p>
                    <ul className="mt-1 space-y-1">
                      {(dayModalBySlot.get(slot) ?? []).map((entry) => {
                        const recipe = recipeById.get(entry.recipeId)
                        if (!recipe) return null
                        return (
                          <li key={entry.id}>
                            <Link
                              to={`/recipes/${recipe.id}`}
                              onClick={() => setDayModalDate(null)}
                              className="block truncate rounded-sm border border-edge bg-app px-2 py-2 text-sm font-bold text-accent"
                            >
                              {recipe.title}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (dayModalDate) goToWeekOf(dayModalDate)
                setDayModalDate(null)
              }}
              className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-app py-3 text-sm font-bold text-accent shadow-sm"
            >
              {ja.mealPlan.monthDayModalOpenWeek}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
