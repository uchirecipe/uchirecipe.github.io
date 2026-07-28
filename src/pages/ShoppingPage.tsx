import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  ChefHat,
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Plus,
  Minus,
  CheckCircle2,
  CheckCheck,
  HelpCircle,
} from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import { usePantryItems } from '../db/pantry'
import { pantryHaveNames, pantryAvailableNames } from '../logic/pantry'
import {
  useShoppingItems,
  addShoppingItem,
  addConfirmedItems,
  toggleShoppingChecked,
  setAllShoppingChecked,
  removeShoppingItem,
  restoreShoppingItem,
  completeShopping,
} from '../db/shopping'
import {
  buildShoppingCandidates,
  sortShoppingByAisle,
  parseRecipeIdsParam,
  type ShoppingCandidate,
} from '../logic/shopping'
import { sortResults, type RecipeSortOption } from '../logic/recipeSort'
import type { SearchResult } from '../logic/search'
import type { ShoppingItem } from '../db/types'
import PantryBoard from '../components/PantryBoard'
import Toast from '../components/Toast'
import { ja } from '../i18n/ja'

type CandidateRow = ShoppingCandidate & { checked: boolean }

type ShoppingTab = 'pantry' | 'memo'

/**
 * 買い物メモの下書きの保存先（2026-07-29 便CC/C2）。
 *
 * 従来はコンポーネントのstateだけだったため、他のページへ移動・リロード・「キャンセル」で
 * 手で直した分量ごと無警告で消えていた（QA S2。「下書き」という名前が実装と食い違っていた）。
 * レシピの書きかけと同じ作法に揃える＝localStorage に「保存した時刻＋中身」で持ち、
 * 期限を過ぎた古い下書きは読まずに捨てる（sessionStorage はホーム画面PWAでOSがタブを
 * 破棄すると消えるため使わない。2026-07-28 便BW/C-16で却下済み）。
 * 期限はレシピの書きかけと同じ7日（買い物は当日〜数日の行動なので十分に長い）。
 */
const SHOPPING_DRAFT_KEY = 'uchirecipe:draft:shopping'
const SHOPPING_DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

type ShoppingDraft = { candidates: CandidateRow[]; lastPickerCounts: Record<number, number> }

function readShoppingDraft(): ShoppingDraft | null {
  try {
    const raw = localStorage.getItem(SHOPPING_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { savedAt?: unknown; draft?: unknown }
    const savedAt = typeof parsed.savedAt === 'number' ? parsed.savedAt : 0
    if (Date.now() - savedAt > SHOPPING_DRAFT_MAX_AGE_MS) {
      localStorage.removeItem(SHOPPING_DRAFT_KEY)
      return null
    }
    if (typeof parsed.draft !== 'string') return null
    const draft = JSON.parse(parsed.draft) as Partial<ShoppingDraft>
    if (!Array.isArray(draft.candidates) || draft.candidates.length === 0) return null
    return {
      candidates: draft.candidates,
      lastPickerCounts:
        draft.lastPickerCounts && typeof draft.lastPickerCounts === 'object'
          ? draft.lastPickerCounts
          : {},
    }
  } catch {
    return null
  }
}

function writeShoppingDraft(draft: ShoppingDraft): void {
  try {
    localStorage.setItem(
      SHOPPING_DRAFT_KEY,
      JSON.stringify({ savedAt: Date.now(), draft: JSON.stringify(draft) }),
    )
  } catch {
    /* 保存領域の容量超過などは黙って諦める(画面上の下書きは失われない) */
  }
}

function clearShoppingDraft(): void {
  try {
    localStorage.removeItem(SHOPPING_DRAFT_KEY)
  } catch {
    /* 無視 */
  }
}

/** レシピピッカーの並び替え(2026-07-23 #2: 一覧の並び替え機構=recipeSortを流用。栄養並び替えは
 * Pro機能なので除き、無料で使える4種に絞る。ラベルはレシピ一覧のもの=ja.searchを共用する) */
const PICKER_SORT_OPTIONS: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
]

/** 食材タブ: 「食材の在庫」（在庫ボード）／「買い物メモ」（レシピからの候補づくり＋確定した
 * 買い物メモ）の2タブ構成(2026-07-16 UI総点検B-9: 買い物メモが最上部を占有しヘビーユーザーの
 * 壁になっていた所見への対応)。既定タブは「食材の在庫」。タブ状態はページローカルで保存しない */
export default function ShoppingPage() {
  // 保存してある下書きを初回描画時に1度だけ読む(2026-07-29 便CC/C2)。
  // 期限切れはここで破棄される。競合する入力状態が無いので「復元しますか？」は出さず黙って戻す
  const [restoredDraft] = useState(readShoppingDraft)
  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const pantryItems = usePantryItems()
  const haveNames = useMemo(() => pantryHaveNames(pantryItems ?? []), [pantryItems])
  // ピッカーの「在庫で作れる順」用(「ある」「少ない」を在庫ありとみなす。在庫一致順の既存定義に合わせる)
  const availableNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])
  const shoppingItems = useShoppingItems()
  // 下書きが残っていたら、それが見える「買い物メモ」タブで迎える(既定は「食材の在庫」)
  const [activeTab, setActiveTab] = useState<ShoppingTab>(restoredDraft ? 'memo' : 'pantry')

  // 操作結果のトースト(2026-07-23 #4/#9。既存のToast+setMessageパターンを流用)
  const [message, setMessage] = useState('')
  // ✕で消した項目の取り消し(2026-07-29 便CC/C19)。次のトーストが出たら取り消しは無効にする
  const [undoRemoved, setUndoRemoved] = useState<ShoppingItem | null>(null)
  const showToast = (text: string) => {
    setUndoRemoved(null)
    setMessage(text)
  }

  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])

  // recipeId → レシピ名(下書きの食材名タップで「使うレシピ」を出すため。2026-07-24 実機FB #10)
  const recipeTitleById = useMemo(() => {
    const map = new Map<number, string>()
    for (const r of recipes ?? []) if (r.id != null) map.set(r.id, r.title)
    return map
  }, [recipes])

  // レシピ選択ピッカー
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerSort, setPickerSort] = useState<RecipeSortOption>('updated')
  // 食数の+/-方式(2026-07-23 #3): recipeId → 食数。1食以上で「選択」扱い(既定0=未選択)
  const [pickerCounts, setPickerCounts] = useState<Record<number, number>>({})
  // 直前のレシピ選択(食数)を覚えておき、「レシピを選び直す」でそのまま復元する(2026-07-24 実機FB #8)
  const [lastPickerCounts, setLastPickerCounts] = useState<Record<number, number>>(
    restoredDraft?.lastPickerCounts ?? {},
  )

  const filteredRecipes = useMemo(() => {
    const q = pickerQuery.trim()
    const base = q ? visibleRecipes.filter((r) => r.title.includes(q)) : visibleRecipes
    // 一覧の並び替え機構(sortResults)を流用する。SearchResultの形に包んで並べ替え、レシピへ戻す
    const wrapped: SearchResult[] = base.map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
    return sortResults(wrapped, pickerSort, availableNames).map((r) => r.recipe)
  }, [visibleRecipes, pickerQuery, pickerSort, availableNames])

  const setCount = (id: number, next: number) => {
    setPickerCounts((prev) => ({ ...prev, [id]: Math.max(0, next) }))
  }
  const selectedRecipeCount = useMemo(
    () => Object.values(pickerCounts).filter((n) => n >= 1).length,
    [pickerCounts],
  )

  const openPicker = () => {
    setPickerCounts({})
    setPickerQuery('')
    setPickerOpen(true)
  }
  // レシピを選び直す(2026-07-24 実機FB #8): 直前の選択(食数)を保ったままピッカーを開き直す。
  // 下書き自体は消さず、「下書きを作る」を再度押したときに作り直す
  const repickRecipes = () => {
    setPickerCounts(lastPickerCounts)
    setPickerQuery('')
    setPickerOpen(true)
  }

  // 買い物候補（下書き。確定するまでDBには保存しない。画面を離れても消えないよう
  // localStorageに保存する＝2026-07-29 便CC/C2）
  const [candidates, setCandidates] = useState<CandidateRow[] | null>(restoredDraft?.candidates ?? null)
  // 生成した下書きへ自動スクロールする(2026-07-24 実機FB #13)。候補がDOMに乗ってから実行するため
  // フラグ+useEffectで1テンポ遅らせる
  const candidatesRef = useRef<HTMLElement>(null)
  const [scrollToCandidates, setScrollToCandidates] = useState(false)
  // 下書きの食材名タップで出す「全文＋その食材を使うレシピ名」ポップ(2026-07-24 実機FB #10)
  const [namePopup, setNamePopup] = useState<{ name: string; recipeIds: number[] } | null>(null)

  // 献立プランナーの「この週の買い物リストを作る」から来た場合（?recipeIds=1x2,3）は
  // ピッカーを介さず自動で候補を作る。
  // 2026-07-29 便CC/C10: 従来は献立に同じ料理が何回入っていても1回分（scale=1固定）でしか
  // 計算せず、週に2回作る料理の材料が足りない量で出ていた。「1x2」=その週に2回ぶん、として
  // 回数を倍率に使う。C18: 渡ったレシピが1件も見つからないときは無言で終わらず理由を出す
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    const raw = searchParams.get('recipeIds')
    if (raw == null || !recipes) return
    const requested = parseRecipeIdsParam(raw)
    const chosen = requested
      .map(({ id, times }) => ({ recipe: recipes.find((r) => r.id === id), times }))
      .filter((x): x is { recipe: (typeof recipes)[number]; times: number } => x.recipe != null)
    if (chosen.length > 0) {
      const built = buildShoppingCandidates(
        chosen.map(({ recipe, times }) => ({
          id: recipe.id!,
          ingredients: recipe.ingredients,
          scale: times,
        })),
        haveNames,
      )
      setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
      // 「レシピを選び直す」で復元できるよう選択を覚えておく(#8)。献立由来は
      // 「登録人数 × 献立に入っている回数」を初期の食数にする
      setLastPickerCounts(
        Object.fromEntries(chosen.map(({ recipe, times }) => [recipe.id!, recipe.servings * times])),
      )
      // 献立プランナーの「この週の買い物リストを作る」から来た場合は、候補が乗る
      // 「買い物メモ」タブを開いた状態で迎える(在庫タブのまま候補が見えない事故を防ぐ)
      setActiveTab('memo')
    } else if (requested.length > 0) {
      showToast(ja.shopping.fromMealPlanNotFoundToast)
    }
    // 値が空(?recipeIds=)でもURLからは必ず消す(従来は早期returnでパラメータが残り続けていた)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('recipeIds')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, searchParams])

  // 下書きの保存/破棄(2026-07-29 便CC/C2)。画面を離れてもリロードしても残るようにする。
  // 確定・キャンセルで candidates が null になったら保存も消す
  useEffect(() => {
    if (candidates && candidates.length > 0) writeShoppingDraft({ candidates, lastPickerCounts })
    else clearShoppingDraft()
  }, [candidates, lastPickerCounts])

  const makeCandidates = () => {
    // 既に下書きがあるときの作り直しは、手で直した分量が自動計算に戻るので先に一言確認する
    // (2026-07-29 便CC/C2。規約F=何が消えて何が残るかを両方書く)
    if (candidates && candidates.length > 0) {
      const ok = window.confirm(ja.shopping.remakeConfirm.replace('{n}', String(candidates.length)))
      if (!ok) return
    }
    // 食数≥1のレシピだけを対象にし、指定食数で分量をスケールする(scale=食数÷登録人数。2026-07-23 #3)
    const chosen = visibleRecipes
      .filter((r) => (pickerCounts[r.id!] ?? 0) >= 1)
      .map((r) => ({
        id: r.id!,
        ingredients: r.ingredients,
        scale: (pickerCounts[r.id!] ?? r.servings) / (r.servings > 0 ? r.servings : 1),
      }))
    const built = buildShoppingCandidates(chosen, haveNames)
    setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
    setLastPickerCounts(pickerCounts) // 「レシピを選び直す」で復元できるよう、直前の選択を覚えておく(#8)
    setPickerOpen(false)
    setPickerCounts({})
    setPickerQuery('')
    showToast(ja.shopping.candidatesMadeToast)
    setScrollToCandidates(true) // 生成した下書きへ自動スクロール(#13)
  }

  // チェック0件で確定すると「0件を買い物メモに追加しました」と出て下書きだけが消えていた
  // (2026-07-29 便CC/C13)。ボタンを押せない状態にし、下書きは残す
  const checkedCandidateCount = candidates?.filter((c) => c.checked).length ?? 0

  const addConfirmed = async () => {
    if (!candidates) return
    const chosen = candidates.filter((c) => c.checked)
    if (chosen.length === 0) return
    await addConfirmedItems(chosen.map(({ name, amount, recipeIds }) => ({ name, amount, recipeIds })))
    setCandidates(null)
    showToast(ja.shopping.addedToMemoToast.replace('{n}', String(chosen.length)))
  }

  // 下書きの取り消し(2026-07-29 便CC/C2)。従来は確認ゼロで即消えていた
  const discardCandidates = () => {
    if (!candidates) return
    const ok = window.confirm(ja.shopping.discardConfirm.replace('{n}', String(candidates.length)))
    if (!ok) return
    setCandidates(null)
    showToast(ja.shopping.discardedToast)
  }

  // ✕の削除(2026-07-29 便CC/C19): 確認で止めず、消してから取り消せるようにする
  // (買い物中に片手・カートを押しながら触る画面なので、毎回の確認は邪魔になる)
  const removeMemoItem = async (item: ShoppingItem) => {
    await removeShoppingItem(item.id!)
    setUndoRemoved(item)
    setMessage(ja.shopping.removedToast.replace('{name}', item.name))
  }
  const undoRemoveMemoItem = async () => {
    if (!undoRemoved) return
    const restored = undoRemoved
    setUndoRemoved(null)
    await restoreShoppingItem(restored)
    setMessage(ja.shopping.restoredToast.replace('{name}', restored.name))
  }

  // 手動追加
  const [manualName, setManualName] = useState('')
  const [manualAmount, setManualAmount] = useState('')
  const addManual = async () => {
    if (!manualName.trim()) return
    await addShoppingItem(manualName, manualAmount)
    setManualName('')
    setManualAmount('')
  }

  // 買い物メモは一般的なスーパーの売り場順に自動整列する(2026-07-24 実機FB #11)。
  // 表示専用の並べ替えで、DBの保存順(order)は書き換えない
  const memoItems = useMemo(() => sortShoppingByAisle(shoppingItems ?? []), [shoppingItems])
  // まとめてチェック/解除(2026-07-23 #6)
  const allChecked = memoItems.length > 0 && memoItems.every((i) => i.isChecked)

  // 買い物完了(2026-07-23 #7: 下部インラインパネル→作った!と同じ中央モーダルに変更)
  const [completeOpen, setCompleteOpen] = useState(false)
  const checkedItems = memoItems.filter((i) => i.isChecked)
  useEffect(() => {
    if (!completeOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCompleteOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [completeOpen])

  // 生成した下書きへ自動スクロール(2026-07-24 実機FB #13)。候補がDOMに乗った次の描画で1回だけ実行する
  useEffect(() => {
    if (scrollToCandidates && candidates && candidatesRef.current) {
      candidatesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToCandidates(false)
    }
  }, [scrollToCandidates, candidates])

  // 食材名ポップはEscでも閉じる(2026-07-24 実機FB #10。他モーダルと同じ作法)
  useEffect(() => {
    if (!namePopup) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNamePopup(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [namePopup])

  // 「あとにする」(2026-07-29 便CC/C7): 何も消さずにモーダルを閉じる。
  // 背景タップ・Escでも閉じられるが、それが分かる導線がボタンとして無かった
  const completeLater = () => {
    setCompleteOpen(false)
    showToast(ja.shopping.completeLaterToast)
  }

  const runComplete = async (reflect: boolean) => {
    await completeShopping(checkedItems, reflect)
    setCompleteOpen(false)
    // 反映する/しないどちらでもトースト(2026-07-23 #9)
    showToast(reflect ? ja.shopping.completeReflectedToast : ja.shopping.completeDoneToast)
  }

  // 買い物候補の説明文の折りたたみ(2026-07-16 UI総点検B-5)。既定は閉
  const [showCandidateDescription, setShowCandidateDescription] = useState(false)

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.nav.shopping}</h1>

      {/* タブ切り替え: 食材の在庫／買い物メモ(2026-07-16 UI総点検B-9)。SettingsPageのタブバーと
          同じパターン(sticky+backdrop-blur)。タブ状態はページローカルで保存しない */}
      <div className="pantry-tabbar sticky top-0 z-10 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur">
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pantry')}
            aria-pressed={activeTab === 'pantry'}
            className={`rounded-md border py-[13px] text-sm font-bold shadow-sm ${
              activeTab === 'pantry'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.shopping.tabInventory}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('memo')}
            aria-pressed={activeTab === 'memo'}
            className={`rounded-md border py-[13px] text-sm font-bold shadow-sm ${
              activeTab === 'memo'
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {ja.shopping.tabMemo}
          </button>
        </div>
      </div>

      {activeTab === 'pantry' && <PantryBoard />}

      {activeTab === 'memo' && (
        <>
        {/* 買い物メモ */}
        <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold">{ja.shopping.memoTitle}</h2>
            <button
              type="button"
              onClick={openPicker}
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
            >
              <ChefHat size={16} aria-hidden />
              {ja.shopping.fromRecipeTitle}
            </button>
          </div>

          {memoItems.length === 0 && !candidates && (
            <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.shopping.memoEmpty}</p>
          )}

          {memoItems.length > 0 && (
            <>
              {/* まとめてチェック/解除(2026-07-23 #6) */}
              <div className="mt-[var(--space-md)] flex justify-end">
                <button
                  type="button"
                  onClick={() => void setAllShoppingChecked(!allChecked)}
                  className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
                >
                  <CheckCheck size={16} aria-hidden />
                  {allChecked ? ja.shopping.uncheckAll : ja.shopping.checkAll}
                </button>
              </div>
              {/* 並び順は売り場順の自動整列に一本化したため、手動の上下矢印UIは廃止(2026-07-24 実機FB #11・#12) */}
              <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
                {memoItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
                    <button
                      type="button"
                      onClick={() => void toggleShoppingChecked(item.id!)}
                      aria-pressed={item.isChecked}
                      aria-label={ja.shopping.toggleCheck}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        item.isChecked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                      }`}
                    >
                      <CheckCircle2 size={18} aria-hidden />
                    </button>
                    <div className={`min-w-0 flex-1 px-2 ${item.isChecked ? 'text-ink-muted line-through' : ''}`}>
                      <span className="font-bold">{item.name}</span>
                      {item.amount && <span className="ml-2 text-sm">{item.amount}</span>}
                    </div>
                    {/* 料理中・買い物中に片手で触るので44px確保(2026-07-29 便CC/C19。旧34px) */}
                    <button
                      type="button"
                      onClick={() => void removeMemoItem(item)}
                      aria-label={ja.shopping.remove}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
                    >
                      <X size={18} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* 手動追加。1行に3つ並べると390px幅で分量欄が約94pxしか取れず
              プレースホルダが「分量（任」で切れていたため2行に分ける(2026-07-29 便CC/C20) */}
          <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-sm)]">
            <input
              type="text"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
              placeholder={ja.shopping.manualPlaceholder}
              className="w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
            />
            <div className="flex gap-[var(--space-sm)]">
              <input
                type="text"
                value={manualAmount}
                onChange={(e) => setManualAmount(e.target.value)}
                placeholder={ja.shopping.manualAmountPlaceholder}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              />
              <button
                type="button"
                onClick={() => void addManual()}
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-4 py-3 font-bold text-accent shadow-sm"
              >
                <Plus size={18} aria-hidden />
                {ja.shopping.manualAdd}
              </button>
            </div>
          </div>

          {/* 買い物完了 */}
          {checkedItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="mt-[var(--space-md)] w-full rounded-md bg-accent py-3 text-lg font-bold text-on-accent shadow-sm"
            >
              {ja.shopping.complete}
            </button>
          )}
        </section>

        {/* 買い物メモ（下書き。2026-07-24 実機FB #14で改称） */}
        {candidates && (
          <section
            ref={candidatesRef}
            className="mt-[var(--space-md)] scroll-mt-[var(--space-md)] rounded-md border border-accent bg-surface p-[var(--space-md)] shadow-sm"
          >
            <h2 className="text-xl font-bold">{ja.shopping.candidateTitle}</h2>
            <button
              type="button"
              onClick={() => setShowCandidateDescription((v) => !v)}
              aria-expanded={showCandidateDescription}
              className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted"
            >
              <HelpCircle size={14} aria-hidden />
              {ja.common.usageHint}
              {showCandidateDescription ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
            {showCandidateDescription && (
              <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateDescription}</p>
            )}

            {candidates.length === 0 ? (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.shopping.candidateEmpty}</p>
            ) : (
              <ul className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                {candidates.map((c, index) => (
                  <li key={c.name} className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCandidates((prev) =>
                          prev
                            ? prev.map((row, i) => (i === index ? { ...row, checked: !row.checked } : row))
                            : prev,
                        )
                      }
                      aria-pressed={c.checked}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        c.checked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                      }`}
                    >
                      <CheckCircle2 size={18} aria-hidden />
                    </button>
                    {/* 食材名タップで全文＋使うレシピ名をポップ表示(2026-07-24 実機FB #10)。
                        名前は truncate で省略されるので、タップで確認できるようにする */}
                    <button
                      type="button"
                      onClick={() => setNamePopup({ name: c.name, recipeIds: c.recipeIds })}
                      className="min-w-0 flex-1 truncate pt-2 text-left font-bold underline decoration-dotted decoration-ink-muted/40 underline-offset-4"
                    >
                      {c.name}
                    </button>
                    <textarea
                      ref={(el) => {
                        if (el) {
                          el.style.height = 'auto'
                          el.style.height = `${el.scrollHeight}px`
                        }
                      }}
                      value={c.amount}
                      onChange={(e) => {
                        const value = e.target.value
                        setCandidates((prev) =>
                          prev ? prev.map((row, i) => (i === index ? { ...row, amount: value } : row)) : prev,
                        )
                        e.currentTarget.style.height = 'auto'
                        e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`
                      }}
                      placeholder={ja.shopping.amountPlaceholder}
                      rows={1}
                      className="w-24 shrink-0 resize-none overflow-hidden whitespace-pre-wrap break-words rounded-sm border border-edge bg-app px-2 py-2 text-sm text-ink leading-snug"
                    />
                  </li>
                ))}
              </ul>
            )}

            {/* 確定/やり直し/取り消し(2026-07-24 実機FB #8)。確定は主ボタンで上に、
                「レシピを選び直す」(選択を保持して開き直す)と「キャンセル」は下段に並べる */}
            <div className="mt-[var(--space-md)] flex flex-col gap-2">
              {candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => void addConfirmed()}
                    disabled={checkedCandidateCount === 0}
                    className="w-full rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm disabled:opacity-40"
                  >
                    {ja.shopping.addConfirmed}
                  </button>
                  {/* 押せない理由を添える(2026-07-29 便CC/C13。無言の死にボタンにしない) */}
                  {checkedCandidateCount === 0 && (
                    <p className="text-center text-sm text-ink-muted">
                      {ja.shopping.addConfirmedNoneHint}
                    </p>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={repickRecipes}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
                >
                  {ja.shopping.repickRecipes}
                </button>
                <button
                  type="button"
                  onClick={discardCandidates}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
                >
                  {ja.shopping.discardCandidates}
                </button>
              </div>
            </div>
          </section>
        )}
        </>
      )}

      {/* 買い物完了の確認モーダル(2026-07-23 #7: 作った!と同じ中央カード様式)。
          背景タップ・Escで閉じる。反映する/反映せず完了の2択はどちらでもトースト(#9) */}
      {completeOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setCompleteOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={ja.shopping.completeConfirmTitle}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold">{ja.shopping.completeConfirmTitle}</h3>
              <button
                type="button"
                onClick={() => setCompleteOpen(false)}
                aria-label={ja.common.close}
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* 件数を明示する(2026-07-29 便CC/C7・規約F: 何が消えて何が残るかを件数つきで) */}
            <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
              {ja.shopping.completeConfirmDescription
                .replace(/\{n\}/g, String(checkedItems.length))
                .replace('{m}', String(memoItems.length - checkedItems.length))}
            </p>
            <div className="mt-[var(--space-md)] flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void runComplete(true)}
                  className="flex-1 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
                >
                  {ja.shopping.completeYes}
                </button>
                <button
                  type="button"
                  onClick={() => void runComplete(false)}
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
                >
                  {ja.shopping.completeNo}
                </button>
              </div>
              {/* 後回しの導線(2026-07-29 便CC/C7)。レジ前でその場の判断を強いない。
                  チェックは残るので、帰ってから同じ手順で反映できる */}
              <button
                type="button"
                onClick={completeLater}
                className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
              >
                {ja.shopping.completeLater}
              </button>
              <p className="text-xs text-ink-muted">{ja.shopping.completeLaterNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* 下書きの食材名タップで出す「全文＋使うレシピ名」ポップ(2026-07-24 実機FB #10)。
          背景タップ・X・Escで閉じる(他モーダルと同じ作法) */}
      {namePopup && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
          onClick={() => setNamePopup(null)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-label={namePopup.name}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 break-words font-bold">{namePopup.name}</h3>
              <button
                type="button"
                onClick={() => setNamePopup(null)}
                aria-label={ja.common.close}
                className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
              {ja.shopping.candidateUsedInRecipes}
            </p>
            {(() => {
              const titles = namePopup.recipeIds
                .map((id) => recipeTitleById.get(id))
                .filter((t): t is string => !!t)
              return titles.length > 0 ? (
                <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-ink">
                  {titles.map((title, i) => (
                    <li key={i} className="break-words">
                      {title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateUsedInNoRecipe}</p>
              )
            })()}
          </div>
        </div>
      )}

      {/* レシピ選択ピッカー */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.shopping.pickRecipes}</h2>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
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
                placeholder={ja.shopping.pickerSearchPlaceholder}
                className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>
            {/* 並び替え(2026-07-23 #2: 一覧の並び替え機構を流用) */}
            <label className="mt-[var(--space-sm)] flex items-center gap-2 text-sm text-ink-muted">
              <span className="shrink-0">{ja.shopping.pickerSortLabel}</span>
              <select
                value={pickerSort}
                onChange={(e) => setPickerSort(e.target.value as RecipeSortOption)}
                className="min-w-0 flex-1 rounded-sm border border-edge bg-surface px-2 py-2 text-sm text-ink shadow-sm"
              >
                {PICKER_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-y-auto px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.shopping.pickerEmpty : ja.shopping.pickerNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {filteredRecipes.map((recipe) => {
                  const count = pickerCounts[recipe.id!] ?? 0
                  const selected = count >= 1
                  return (
                    <li
                      key={recipe.id}
                      className={`flex items-center gap-2 px-[var(--space-md)] py-3 ${
                        selected ? 'bg-accent/5' : ''
                      }`}
                    >
                      {/* 品目名下の「◯人分レシピ」表記は削除(2026-07-24 実機FB #9) */}
                      {/* 似た名前が「鶏むね肉のレモンペッ…」で切れて区別できないため、
                          2行まで折り返す(2026-07-29 便CC/C20) */}
                      <div className="min-w-0 flex-1">
                        <span
                          className={`block line-clamp-2 break-words font-bold ${
                            selected ? 'text-accent' : ''
                          }`}
                        >
                          {recipe.title}
                        </span>
                      </div>
                      {/* 食数の+/-ステッパー(2026-07-23 #3)。1食以上で選択扱い・指定食数で候補生成 */}
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setCount(recipe.id!, count - 1)}
                          disabled={count === 0}
                          aria-label={ja.shopping.pickerServingDown}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted disabled:opacity-30"
                        >
                          <Minus size={16} aria-hidden />
                        </button>
                        <span className="w-12 text-center text-sm font-bold tabular-nums">
                          {count}
                          {ja.shopping.pickerServingUnit}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCount(recipe.id!, count + 1)}
                          aria-label={ja.shopping.pickerServingUp}
                          className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                            selected ? 'border-accent bg-accent text-on-accent' : 'border-edge text-accent'
                          }`}
                        >
                          <Plus size={16} aria-hidden />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          <div className="px-[var(--space-md)] pb-[calc(var(--space-md)+env(safe-area-inset-bottom))] pt-[var(--space-sm)]">
            <button
              type="button"
              onClick={makeCandidates}
              disabled={selectedRecipeCount === 0}
              className="w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md disabled:opacity-40"
            >
              {ja.shopping.makeCandidates}
              {selectedRecipeCount > 0 ? `（${selectedRecipeCount}）` : ''}
            </button>
          </div>
        </div>
      )}

      <Toast
        message={message}
        onClose={() => {
          setMessage('')
          setUndoRemoved(null)
        }}
        actionLabel={undoRemoved ? ja.common.undo : undefined}
        onAction={undoRemoved ? () => void undoRemoveMemoItem() : undefined}
      />
    </div>
  )
}
