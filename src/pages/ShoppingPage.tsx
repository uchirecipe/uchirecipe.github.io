import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
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
import Collapse from '../components/Collapse'
import SwapLabel from '../components/SwapLabel'
import { listRecipes } from '../db/recipes'
import { updateSettings, useSettings } from '../db/settings'
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
  groupShoppingByAisle,
  resolveShoppingSources,
  parseRecipeIdsParam,
  parseServingsParam,
  splitCheckedShoppingItems,
  type ShoppingCandidate,
  type ShoppingSourceResult,
} from '../logic/shopping'
import { sortResults, type RecipeSortOption } from '../logic/recipeSort'
import type { SearchResult } from '../logic/search'
import type { Ingredient, Recipe, ShoppingItem } from '../db/types'
import PantryBoard from '../components/PantryBoard'
import RecipeCard from '../components/RecipeCard'
import Toast from '../components/Toast'
import { useConfirm } from '../components/ConfirmProvider'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { useScrollLock } from '../components/useScrollLock'
import { settingsLinkWithBack } from '../logic/backLink'
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

type ShoppingDraft = {
  candidates: CandidateRow[]
  lastPickerCounts: Record<number, number>
  /**
   * 献立から作った下書きの「どの範囲から作ったか」（2026-08-08 便EA）。
   * 献立の週タブが組み立てた1行をそのまま持つ。レシピを手で選んで作った下書きには無い。
   */
  rangeLabel?: string
}

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
      rangeLabel: typeof draft.rangeLabel === 'string' ? draft.rangeLabel : undefined,
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
  const confirm = useConfirm()
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

  // recipeId → レシピ(名前と材料)。食材名タップの出所の小窓に使う。
  // 材料まで持つのは、出所の分量を持たない古い行でレシピの材料欄から読み直すため
  // (2026-07-24 実機FB #10 → 2026-08-08 オーナー実機フィードバック②で買い物メモにも拡張)
  const recipeById = useMemo(() => {
    const map = new Map<number, { title: string; ingredients: Ingredient[] }>()
    for (const r of recipes ?? []) {
      if (r.id != null) map.set(r.id, { title: r.title, ingredients: r.ingredients })
    }
    return map
  }, [recipes])

  // recipeId → レシピそのもの。出所の小窓の行を共通のレシピカードで描くために使う
  // （2026-08-19 便HW。上の recipeById は名前と材料だけの軽い写しなのでカードには渡せない）
  const fullRecipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    for (const r of recipes ?? []) {
      if (r.id != null) map.set(r.id, r)
    }
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
  // どの範囲の献立から作った下書きか(2026-08-08 便EA)。献立から来たときだけ入る
  const [candidateRangeLabel, setCandidateRangeLabel] = useState<string | undefined>(
    restoredDraft?.rangeLabel,
  )
  // 生成した下書きへ自動スクロールする(2026-07-24 実機FB #13)。候補がDOMに乗ってから実行するため
  // フラグ+useEffectで1テンポ遅らせる
  const candidatesRef = useRef<HTMLElement>(null)
  const [scrollToCandidates, setScrollToCandidates] = useState(false)
  // 食材名タップで出す「全文＋出所のレシピ」ポップ。下書き(2026-07-24 実機FB #10)に加え、
  // 確定した買い物メモの行からも開けるようにした(2026-08-08 オーナー実機フィードバック②)。
  // 開くときに出所を解決して持たせる＝下書き/メモのどちらから開いても同じ見た目になる
  const [namePopup, setNamePopup] = useState<
    ({ name: string; kind: 'draft' | 'memo' } & ShoppingSourceResult) | null
  >(null)
  const openSourcePopup = (
    kind: 'draft' | 'memo',
    item: {
      name: string
      sources?: readonly { recipeId: number; amount?: string }[]
      recipeIds?: readonly number[]
      manualAdded?: boolean
    },
  ) => {
    setNamePopup({ name: item.name, kind, ...resolveShoppingSources(item, recipeById) })
  }

  // 献立プランナーの「この週の買い物リストを作る」から来た場合（?recipeIds=1x2,3）は
  // ピッカーを介さず自動で候補を作る。
  // 2026-07-29 便CC/C10: 従来は献立に同じ料理が何回入っていても1回分（scale=1固定）でしか
  // 計算せず、週に2回作る料理の材料が足りない量で出ていた。「1x2」=その週に2回ぶん、として
  // 回数を倍率に使う。C18: 渡ったレシピが1件も見つからないときは無言で終わらず理由を出す
  const [searchParams, setSearchParams] = useSearchParams()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  useEffect(() => {
    const raw = searchParams.get('recipeIds')
    if (raw == null || !recipes) return
    const requested = parseRecipeIdsParam(raw)
    // 献立で枠ごとに決めた食数の合計(2026-08-03 便DJ)。無ければ従来どおり
    // 「回数 × レシピの登録人数」で数える(食数を1つも触っていない献立では同じ値になる)
    const servingsParam = searchParams.get('servings')
    const servingsById = servingsParam ? parseServingsParam(servingsParam) : null
    const chosen = requested
      .map(({ id, times }) => ({ recipe: recipes.find((r) => r.id === id), times }))
      .filter((x): x is { recipe: (typeof recipes)[number]; times: number } => x.recipe != null)
      .map(({ recipe, times }) => {
        const base = recipe.servings > 0 ? recipe.servings : 1
        const totalServings = servingsById?.get(recipe.id!) ?? base * times
        return { recipe, totalServings, scale: totalServings / base }
      })
    if (chosen.length > 0) {
      const built = buildShoppingCandidates(
        chosen.map(({ recipe, scale }) => ({
          id: recipe.id!,
          ingredients: recipe.ingredients,
          scale,
        })),
        haveNames,
      )
      setCandidates(built.map((c) => ({ ...c, checked: !c.isSeasoningLike })))
      // どの範囲の献立から作ったか(2026-08-08 便EA)。献立側が組み立てた1行をそのまま出す
      setCandidateRangeLabel(searchParams.get('range') ?? undefined)
      // 「レシピを選び直す」で復元できるよう選択を覚えておく(#8)。献立由来は
      // 献立で決めた食数の合計(未設定なら「登録人数 × 献立に入っている回数」)を初期の食数にする
      setLastPickerCounts(
        Object.fromEntries(chosen.map(({ recipe, totalServings }) => [recipe.id!, totalServings])),
      )
      // 献立プランナーの「この週の買い物リストを作る」から来た場合は、候補が乗る
      // 「買い物メモ」タブを開いた状態で迎える(在庫タブのまま候補が見えない事故を防ぐ)
      setActiveTab('memo')
    } else if (requested.length > 0) {
      showToast(ja.shopping.fromMealPlanNotFoundToast)
    }
    // 値が空(?recipeIds=)でもURLからは必ず消す(従来は早期returnでパラメータが残り続けていた)。
    // 食数(?servings=)も対で消す
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('recipeIds')
        next.delete('servings')
        next.delete('range')
        return next
      },
      { replace: true },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipes, searchParams])

  // 下書きの保存/破棄(2026-07-29 便CC/C2)。画面を離れてもリロードしても残るようにする。
  // 確定・キャンセルで candidates が null になったら保存も消す
  useEffect(() => {
    if (candidates && candidates.length > 0)
      writeShoppingDraft({ candidates, lastPickerCounts, rangeLabel: candidateRangeLabel })
    else clearShoppingDraft()
  }, [candidates, lastPickerCounts, candidateRangeLabel])

  const makeCandidates = async () => {
    // 既に下書きがあるときの作り直しは、手で直した分量が自動計算に戻るので先に一言確認する
    // (2026-07-29 便CC/C2。規約F=何が消えて何が残るかを両方書く)
    if (candidates && candidates.length > 0) {
      const ok = await confirm({
        title: ja.shopping.remakeConfirmTitle.replace('{n}', String(candidates.length)),
        body: ja.shopping.remakeConfirm,
        confirmLabel: ja.shopping.remakeConfirmOk,
      })
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
    // 手でレシピを選び直した下書きなので、献立から来た「範囲」の1行は外す(嘘になるため)
    setCandidateRangeLabel(undefined)
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
    await addConfirmedItems(
      chosen.map(({ name, amount, recipeIds, sources }) => ({ name, amount, recipeIds, sources })),
    )
    setCandidates(null)
    setCandidateRangeLabel(undefined)
    showToast(ja.shopping.addedToMemoToast.replace('{n}', String(chosen.length)))
  }

  // 下書きの取り消し(2026-07-29 便CC/C2)。従来は確認ゼロで即消えていた
  const discardCandidates = async () => {
    if (!candidates) return
    const ok = await confirm({
      title: ja.shopping.discardConfirmTitle.replace('{n}', String(candidates.length)),
      body: ja.shopping.discardConfirm,
      confirmLabel: ja.shopping.discardConfirmOk,
    })
    if (!ok) return
    setCandidates(null)
    setCandidateRangeLabel(undefined)
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

  // 買い物メモは売り場順に自動整列する(2026-07-24 実機FB #11)。表示専用の並べ替えで、
  // DBの保存順(order)は書き換えない。並び順は設定「買い物メモの売り場順」で入れ替えられる
  // (2026-08-02 便CT/C15)。未設定なら従来どおりの既定順
  const aisleOrder = settings?.shoppingAisleOrder
  // 売り場ごとのブロック表示(2026-08-08 オーナー実機フィードバック①)。
  // 中身が0件の売り場は出さない
  const memoGroups = useMemo(
    () => groupShoppingByAisle(shoppingItems ?? [], aisleOrder),
    [shoppingItems, aisleOrder],
  )
  // まとめてチェック・買い物完了など「メモ全体」を見る処理用の平らな並び。
  // ブロックを順につないだもの＝従来の sortShoppingByAisle と同じ
  const memoItems = useMemo(() => memoGroups.flatMap((group) => group.items), [memoGroups])
  // まとめてチェック/解除(2026-07-23 #6)
  const allChecked = memoItems.length > 0 && memoItems.every((i) => i.isChecked)
  /**
   * チェックした食材を下にまとめるスイッチ(2026-08-08 オーナー実機フィードバック)。
   * 既定はOFF＝従来どおり売り場ブロックの中に残る。ONのときだけ、売り場ブロックには
   * 未チェックだけを残し、チェック済みを下の1ブロックに集める。
   * 表示の切り替えだけなので、買い物メモ全体を見る処理(まとめてチェック・買い物完了)は
   * 上の memoItems をそのまま使い、スイッチの状態に左右されない。
   */
  const checkedAtBottom = !!settings?.shoppingCheckedAtBottom
  const memoView = useMemo(
    () =>
      checkedAtBottom
        ? splitCheckedShoppingItems(memoGroups)
        : { groups: memoGroups, checked: [] as ShoppingItem[] },
    [checkedAtBottom, memoGroups],
  )

  // 買い物完了(2026-07-23 #7: 下部インラインパネル→作った!と同じ中央モーダルに変更)
  const [completeOpen, setCompleteOpen] = useState(false)
  const checkedItems = memoItems.filter((i) => i.isChecked)
  // Escape と端末の「戻る」で、この窓だけを閉じる（2026-08-18 便HQ・軸3。
  // 自前のEscapeだけだった頃は、窓を開けたまま「戻る」を押すと買い物メモの画面ごと離脱していた）
  useOverlayDismiss(completeOpen, () => setCompleteOpen(false))

  // 生成した下書きへ自動スクロール(2026-07-24 実機FB #13)。候補がDOMに乗った次の描画で1回だけ実行する
  useEffect(() => {
    if (scrollToCandidates && candidates && candidatesRef.current) {
      candidatesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setScrollToCandidates(false)
    }
  }, [scrollToCandidates, candidates])

  // 食材名ポップはEscでも閉じる(2026-07-24 実機FB #10。他モーダルと同じ作法)。
  // 2026-08-18 便HQ・軸3: 端末の「戻る」でも窓だけが閉じるよう共通の仕組みへ寄せた
  useOverlayDismiss(namePopup != null, () => setNamePopup(null))

  // 窓が開いているあいだ、後ろの買い物メモは動かさない（2026-08-16 便HE）。
  // 閉じたら、メモのどこまで見ていたかはそのまま
  useScrollLock(completeOpen)
  useScrollLock(namePopup != null)
  useScrollLock(pickerOpen)

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

  /**
   * 買い物メモの1行（2026-08-08 オーナー実機フィードバック⑤で売り場ブロックと
   * 「チェック済み」ブロックの2か所から描くようになったので、1か所にまとめた）。
   * 見た目・操作は従来のまま＝チェックの丸・食材名(出所の小窓)・✕の削除の3つ。
   */
  const renderMemoRow = (item: ShoppingItem) => (
    <li key={item.id} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
      <button
        type="button"
        onClick={() => void toggleShoppingChecked(item.id!)}
        aria-pressed={item.isChecked}
        aria-label={ja.shopping.toggleCheck}
        data-testid="memo-check"
        className={`tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
          item.isChecked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
        }`}
      >
        <CheckCircle2 size={18} aria-hidden />
      </button>
      {/* 食材名タップで出所の小窓(2026-08-08 オーナー実機フィードバック②)。
          チェックの丸と✕は別ボタンのままなので、消し込みの操作は変わらない */}
      <button
        type="button"
        onClick={() =>
          openSourcePopup('memo', {
            name: item.name,
            sources: item.fromRecipes,
            recipeIds: item.fromRecipeIds,
            manualAdded: item.manualAdded,
          })
        }
        aria-label={`${item.name} ${ja.shopping.memoSourceOpen}`}
        className={`min-w-0 flex-1 px-2 py-1 text-left ${
          item.isChecked ? 'text-ink-muted line-through' : ''
        }`}
      >
        <span className="font-bold underline decoration-dotted decoration-ink-muted/40 underline-offset-4">
          {item.name}
        </span>
        {item.amount && <span className="ml-2 text-sm">{item.amount}</span>}
      </button>
      {/* 料理中・買い物中に片手で触るので44px確保(2026-07-29 便CC/C19。旧34px) */}
      <button
        type="button"
        onClick={() => void removeMemoItem(item)}
        aria-label={ja.shopping.remove}
        className="tap-target flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-muted"
      >
        <X size={18} aria-hidden />
      </button>
    </li>
  )

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-lg)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.nav.shopping}</h1>

      {/* タブ切り替え: 食材の在庫／買い物メモ(2026-07-16 UI総点検B-9)。SettingsPageのタブバーと
          同じパターン(sticky+backdrop-blur)。タブ状態はページローカルで保存しない */}
      <div
        data-app-top-bar
        className="pantry-tabbar sticky top-0 z-10 -mx-[var(--space-md)] mt-[var(--space-sm)] bg-page/95 px-[var(--space-md)] py-2 backdrop-blur"
      >
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
              className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm"
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
              {/* まとめてチェック/解除(2026-07-23 #6)と、売り場順の設定への控えめな入口
                  (2026-08-02 便CT/C15。並びが自動整列であることと、変えられることが
                  買い物メモの画面から辿れるようにする) */}
              <div className="mt-[var(--space-md)] flex items-center justify-between gap-2">
                <Link
                  to={settingsLinkWithBack('/settings?section=aisle', location.pathname + location.search)}
                  className="min-w-0 truncate text-sm text-ink-muted underline decoration-dotted underline-offset-4"
                >
                  {ja.shopping.aisleOrderLink}
                </Link>
                <button
                  type="button"
                  onClick={() => void setAllShoppingChecked(!allChecked)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
                >
                  <CheckCheck size={16} aria-hidden />
                  {/* 「全部チェック」⇔「チェックを外す」で幅が変わり、左隣のリンクが
                      切れていた（2026-08-09 便EO）。長い方の幅で固定する */}
                  <SwapLabel
                    current={allChecked ? ja.shopping.uncheckAll : ja.shopping.checkAll}
                    labels={[ja.shopping.checkAll, ja.shopping.uncheckAll]}
                  />
                </button>
              </div>
              {/* チェックした食材を下にまとめるスイッチ(2026-08-08 オーナー実機フィードバック)。
                  既定はOFF。設定に保存するので、次に買い物メモを開いたときも同じ見え方になる */}
              <label className="mt-[var(--space-sm)] flex items-center justify-between gap-2">
                <span className="min-w-0 text-sm text-ink-muted">
                  {ja.shopping.checkedAtBottomLabel}
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checkedAtBottom}
                  aria-label={ja.shopping.checkedAtBottomLabel}
                  onClick={() =>
                    void updateSettings({ shoppingCheckedAtBottom: !checkedAtBottom })
                  }
                  className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                    checkedAtBottom ? 'bg-accent' : 'bg-edge'
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                      checkedAtBottom ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </label>
              {/* 並び順は売り場順の自動整列に一本化したため、手動の上下矢印UIは廃止(2026-07-24 実機FB #11・#12)。
                  2026-08-08 オーナー実機フィードバック①: 一列の羅列をやめ、売り場ごとの見出し(件数つき)で
                  ブロックに分ける。並び自体は従来と同じで、区切りを入れただけ */}
              <div className="mt-[var(--space-sm)] space-y-[var(--space-md)]">
                {memoView.groups.map((group) => (
                  <div key={group.key}>
                    <h3 className="flex items-baseline justify-between gap-2 px-1 text-sm font-bold text-ink-muted">
                      <span className="min-w-0 truncate">{ja.pantry.group[group.key]}</span>
                      <span className="shrink-0 tabular-nums">
                        {ja.shopping.aisleGroupCount.replace('{n}', String(group.items.length))}
                      </span>
                    </h3>
                    <ul className="mt-1 divide-y divide-edge rounded-md border border-edge bg-app">
                      {group.items.map(renderMemoRow)}
                    </ul>
                  </div>
                ))}
                {/* スイッチONのときだけ出る、チェック済みをまとめたブロック。
                    売り場ブロックと同じ見出し・同じ行の作りにして、消し込み(チェックの丸)も
                    ✕の削除も同じように使えるようにする(下へ移っても操作が変わらない) */}
                {memoView.checked.length > 0 && (
                  <div data-testid="memo-checked-block">
                    <h3 className="flex items-baseline justify-between gap-2 px-1 text-sm font-bold text-ink-muted">
                      <span className="min-w-0 truncate">{ja.shopping.checkedAtBottomTitle}</span>
                      <span className="shrink-0 tabular-nums">
                        {ja.shopping.aisleGroupCount.replace(
                          '{n}',
                          String(memoView.checked.length),
                        )}
                      </span>
                    </h3>
                    <ul className="mt-1 divide-y divide-edge rounded-md border border-edge bg-app">
                      {memoView.checked.map(renderMemoRow)}
                    </ul>
                  </div>
                )}
              </div>
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
                className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-4 py-3 font-bold text-accent-ink shadow-sm"
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
            <Collapse open={showCandidateDescription}>
              <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateDescription}</p>
            </Collapse>
            {/* どの範囲の献立から作ったか(2026-08-08 便EA)。献立の週タブで日付・食事を選べる
                ようにしたので、下書きを見たときに範囲が分かるようにする。
                レシピを手で選んで作った下書きには出ない */}
            {candidateRangeLabel && (
              <p className="mt-1 text-sm text-ink-muted" data-testid="candidate-range">
                {candidateRangeLabel}
              </p>
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
                      className={`tap-target flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${
                        c.checked ? 'border-accent bg-accent text-on-accent' : 'border-edge text-ink-muted'
                      }`}
                    >
                      <CheckCircle2 size={18} aria-hidden />
                    </button>
                    {/* 食材名タップで全文＋使うレシピ名をポップ表示(2026-07-24 実機FB #10)。
                        名前は truncate で省略されるので、タップで確認できるようにする */}
                    <button
                      type="button"
                      onClick={() => openSourcePopup('draft', c)}
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
                  className="flex-1 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
                >
                  {ja.shopping.repickRecipes}
                </button>
                <button
                  type="button"
                  onClick={() => void discardCandidates()}
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
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* 件数を明示する(2026-07-29 便CC/C7・規約F: 何が消えて何が残るかを件数つきで)。
                2026-08-08 オーナー実機フィードバック「『買い物終了』後の文章が読みづらい」:
                1段落に詰めるのをやめ、ボタンごと・結果ごとに1行ずつ並べる(規約H) */}
            <ul className="mt-[var(--space-sm)] space-y-1 text-sm text-ink-muted">
              {ja.shopping.completeConfirmLines.map((line) => (
                <li key={line} className="flex gap-1.5">
                  <span aria-hidden>・</span>
                  <span className="min-w-0">
                    {line
                      .replace(/\{n\}/g, String(checkedItems.length))
                      .replace('{m}', String(memoItems.length - checkedItems.length))}
                  </span>
                </li>
              ))}
            </ul>
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
                  2026-08-08 オーナー実機フィードバック「あとにする＝キャンセルだから処理を
                  しないということ？」: 押したとき何が起きるか(＝買い物メモも在庫も変わらない)と、
                  あとで反映する手順を、押すボタンの名前で書き分ける */}
              <button
                type="button"
                onClick={completeLater}
                className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
              >
                {ja.shopping.completeLater}
              </button>
              <ul className="space-y-1 text-xs text-ink-muted">
                {ja.shopping.completeLaterLines.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <span aria-hidden>・</span>
                    <span className="min-w-0">
                      {line.replace(/\{n\}/g, String(checkedItems.length))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 食材名タップで出す「全文＋出所のレシピ」ポップ(2026-07-24 実機FB #10 →
          2026-08-08 オーナー実機フィードバック②で買い物メモの行からも開けるようにした)。
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
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>
            {/* 下書きは「まだ入れる前」なので従来どおり「使うレシピ」、確定した買い物メモは
                「どのレシピから入ったか」を答える見出しにする。
                手で足しただけの行はレシピが1件も無いので、見出しごと出さない */}
            {namePopup.recipes.length > 0 && (
              <p className="mt-[var(--space-sm)] text-sm font-bold text-ink-muted">
                {namePopup.kind === 'memo'
                  ? ja.shopping.memoSourceTitle
                  : ja.shopping.candidateUsedInRecipes}
              </p>
            )}
            {namePopup.recipes.length > 0 && (
              // レシピ名を押すとそのレシピ詳細へ（既存の遷移作法＝Linkで /recipes/:id）。
              // 右側にそのレシピでの分量を並べる
              /* 2026-08-19 便HW: 料理名だけの行をやめ、献立の枠と同じ「小」のカードにそろえた。
                 そのレシピでの分量は行の右端に添える（出ていた情報はそのまま） */
              <ul className="mt-1 space-y-1">
                {namePopup.recipes.map((source, i) => {
                  const recipe = fullRecipeById.get(source.recipeId)
                  return (
                    <li key={`${source.recipeId}-${i}`}>
                      {recipe ? (
                        <RecipeCard
                          recipe={recipe}
                          density="small"
                          place="planSlot"
                          // 設定「食べられない食材」の警告（2026-08-19 便IE）。ここに並ぶのは
                          // これから作る品なので、献立の枠と同じように警告を出す
                          ngIngredients={settings?.ngIngredients ?? []}
                          onNavigate={() => setNamePopup(null)}
                          meta={source.amount || undefined}
                        />
                      ) : (
                        // レシピが端末から消えている行（カードにする絵も押す先も無い）
                        <Link
                          to={`/recipes/${source.recipeId}`}
                          onClick={() => setNamePopup(null)}
                          className="flex items-center gap-2 rounded-sm border border-edge bg-app px-[var(--space-sm)] py-3"
                        >
                          <span className="min-w-0 flex-1 break-words text-sm font-bold text-accent-ink underline decoration-dotted underline-offset-4">
                            {source.title}
                          </span>
                          {source.amount && (
                            <span className="shrink-0 text-sm text-ink-muted">{source.amount}</span>
                          )}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {/* 手で足した分は正直に出す(レシピ由来が0件のときも、レシピ由来に足したときも) */}
            {namePopup.manual && (
              <p className="mt-[var(--space-sm)] text-sm text-ink">{ja.shopping.memoSourceManual}</p>
            )}
            {/* 記録は残っているのにレシピが見つからない＝そのレシピが削除されている */}
            {namePopup.missing > 0 && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.shopping.memoSourceMissing.replace('{n}', String(namePopup.missing))}
              </p>
            )}
            {namePopup.recipes.length === 0 && !namePopup.manual && namePopup.missing === 0 && (
              <p className="mt-1 text-sm text-ink-muted">{ja.shopping.candidateUsedInNoRecipe}</p>
            )}
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
              aria-label={ja.common.close}
              className="tap-target rounded-full p-2 text-ink-muted"
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
          <div className="mt-[var(--space-sm)] flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-[var(--space-md)]">
            {filteredRecipes.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              <ul className="space-y-[var(--space-sm)]">
                {filteredRecipes.map((recipe) => {
                  const count = pickerCounts[recipe.id!] ?? 0
                  const selected = count >= 1
                  return (
                    <li
                      key={recipe.id}
                      className={`flex items-center gap-2 rounded-md ${
                        selected ? 'bg-accent/5' : ''
                      }`}
                    >
                      {/* 品目名下の「◯人分レシピ」表記は削除(2026-07-24 実機FB #9) */}
                      {/* 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）:
                          料理名だけの行をやめ、レシピ一覧の一覧表示と同じ「標準」のカードに寄せた。
                          レシピを探して選ぶ場所（献立のレシピ選び・献立テンプレの差し替え）と同じ形になり、
                          写真で見分けられるようになる。似た名前を2行まで折り返す作法
                          (2026-07-29 便CC/C20)は「標準」の料理名がそのまま引き継いでいる */}
                      <div className="min-w-0 flex-1">
                        {/* 設定「食べられない食材」の警告（2026-08-19 便IE）。献立の枠のレシピ選び・
                            献立テンプレの差し替えと同じ「1品を選ぶ」場所なので、同じ印を出す */}
                        <RecipeCard
                          recipe={recipe}
                          density="standard"
                          place="recipePicker"
                          ngIngredients={settings?.ngIngredients ?? []}
                          readOnly
                        />
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
                            selected ? 'border-accent bg-accent text-on-accent' : 'border-edge text-accent-ink'
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
              onClick={() => void makeCandidates()}
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
