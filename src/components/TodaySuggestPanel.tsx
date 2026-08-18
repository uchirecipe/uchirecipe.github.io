import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dices,
  ChevronDown,
  ChevronUp,
  Plus,
  Refrigerator,
  UtensilsCrossed,
} from 'lucide-react'
import { updateSettings } from '../db/settings'
import { cookedWithinDays } from '../logic/cooked'
import { currentSeason } from '../logic/season'
import { DISH_TYPE_OPTIONS, suggestionCandidates } from '../logic/homeSuggest'
import { excludeYesterdayPlanRecipes } from '../logic/mealPlan'
import { makePantryMatcher } from '../logic/pantry'
import type { DishType, MealRole, Recipe, Settings } from '../db/types'
import Collapse from './Collapse'
import RecipeCard from './RecipeCard'
import { ja } from '../i18n/ja'

/**
 * 「今日なに作る？」（1品だけその場で決めるための提案）。
 *
 * 2026-08-17 便HG（オーナー決定「先にホーム画面なくします」）でホーム画面から
 * 献立の「日」へ移した。**提案のしくみは一切変えていない**（条件・種別・季節の優先・
 * 在庫での絞り・振り直しの除外は、ホームにあったときのコードをそのまま持ってきている）。
 * 変わったのは置き場所と、出る条件（その日の献立が無いときだけ出す）の判定を
 * 呼び出し側（pages/MealPlanPage.tsx）が持つようになったことだけ。
 *
 * 2026-08-17 便HH（オーナー承認済み）: 「決めてもらう」操作をこの節に集めた。
 * `planAction` に渡されたボタン（「おまかせで献立を組む」）を、この節のいちばん下に並べる。
 * **提案のしくみ（条件・種別・季節の優先・在庫での絞り・振り直しの除外）は変えていない。**
 * 置き場所を下端にしたのは、この節の上半分（「条件をしぼる」「在庫の食材から」→候補カード→
 * 「ランダムで1品出す」→候補数）が**1品側の絞り込みと結果でひとつながり**になっているため。
 * その途中に別のしくみで動くボタンを差し込むと、上の絞り込みがそちらにも効くように読める。
 *
 * 2026-08-17 便HI（オーナー指示）で足したのは次の2つ。**くじの引き方そのものは変えていない**:
 *  ・`collapsible`… 見出しを押して開け閉めできるようにする。その日の献立が決まっている日は
 *    畳んだ状態で出す。畳んでも節の名前は「今日なに作る？」のままにする＝同じものを
 *    日によって違う名前で呼ばない（旧「もう1品さがす」の小さいリンクを置き換えた）
 *  ・`pinnedRecipeId`… 候補カードからレシピ詳細へ行って戻ってきた1回だけ、
 *    さっき見に行った料理をそのまま出す（引き直さない）。詳細は logic/navMemory.ts
 *
 * 2026-08-18 便HM（オーナー実機「『ランダムで1品出す』と『おまかせで献立を組む』は
 * 同じボタンにまとめ、『1品』↔️『献立』に切り替えスイッチにしませんか？見た目は1品の画面に
 * 寄せたい。今日の献立にれるボタンを1品にも適用えきるし」「『おまかせで献立を組む』の候補が
 * 下に出るのわかりづらい」）で、この節を**1つの流れ**にまとめた:
 *
 *  ・見出しのすぐ下に「1品」／「献立」の切り替えを置き、**決めてもらうボタンは1つ**にする
 *    （名前と絵は選んでいる側で入れ替わる）。切り替えの状態は設定に覚える
 *    （db/types.ts dayStartSuggestMode）
 *  ・**出てきたものは、どちらを選んでいてもボタンの「上」に出す**。
 *    直す前は1品の候補がボタンの上、おまかせで組んだ献立がボタンの下に出ており、
 *    同じ節の中で結果の出る向きが逆だった（390×667の画面では、押した直後に
 *    「今日の献立に入れる」が画面の外へ落ちていた）
 *  ・献立の主菜・副菜も、1品の候補と**同じカード**（写真＋料理名）で出す。
 *    違いは料理名の上に付く「主菜」「副菜」の小さな字だけ
 *  ・「今日の献立に入れる」は**どちらを選んでいても**出す（食事の枠を選ぶ窓は
 *    レシピ詳細と同じ TodaySlotModal。新しい窓は作らない）
 *  ・「条件をしぼる」「在庫の食材から」は**「1品」を選んでいるときだけ**出す。
 *    この絞り込みは1品のくじにしか効かないうえ、「料理の種別」は主菜＋副菜を組む側には
 *    そもそも当てられない（主菜だけに絞ると献立が組めなくなる）ため、
 *    効かない側では出さない＝「効くように見えるのに効かない」を作らない
 *
 * 2026-08-19 便HT（オーナー原文「基本を献立表示にして、1品にする時のみスイッチ押すように
 * した方が良いかも」）: 切り替えの**未設定時の既定を「献立」に**した（設定 dayStartSuggestMode）。
 *
 * このとき「はじめて開いた人には『条件をしぼる』が見えない」ことになるが、
 * **便HMの決め（効かない側には出さない）はそのまま**にしてある。理由は3つ:
 *  ① 既定を変えても、あの絞り込みが献立を組むエンジンに効くようにはならない。
 *     献立側に出せば「効くように見えて効かない」を新しく作るだけになる
 *  ② 絞り込みへの道は消えていない。「1品」は節のいちばん上にあって、押せば
 *     「条件をしぼる」がその場に出る＝隠したのではなく「1品を選ぶと出る」
 *  ③ 献立側に効く条件は別にある（週の「提案の条件」＝調理時間・和洋中・栄養から組む。
 *     pages/MealPlanPage.tsx の renderSuggestConditions）。同じ条件をこの節にも置くと、
 *     同じものを変える場所が2か所になって食い違う
 */

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

/** 「1品」を出すか、「献立」（主菜＋副菜）を組むか（2026-08-18 便HM） */
type SuggestMode = 'one' | 'plan'

const conditions: { value: SuggestCondition; label: string }[] = [
  { value: 'any', label: ja.dayStart.condAll },
  { value: 'notRecent', label: ja.dayStart.condNotRecent },
  { value: 'favorite', label: ja.dayStart.condFavorite },
  // condQuickは '{n}分以内' テンプレート。{n}には選択中の分数が入る(2026-07-24 便BN・タスク7)
  { value: 'quick', label: ja.dayStart.condQuick },
]

// 「◯分以内」で選べる分数(2026-07-24 便BN・タスク7)。既定は先頭の10分
const QUICK_MINUTES_OPTIONS = [10, 15, 20, 30] as const

/**
 * 選べる料理の種別の既定(2026-08-03 便DH・オーナー指示)。
 * 選択肢そのもの(DISH_TYPE_OPTIONS)と候補の作り方は logic/homeSuggest.ts。
 * 既定は主菜だけON(従来の「主菜」トグルON相当)で、献立の中心になる主菜が出るようにする
 */
const DEFAULT_DISH_TYPES: DishType[] = ['main']

/**
 * 「ほかの候補を見る」で直近に出した候補を何件まで覚えておくか(2026-07-29 便CD/MP-12)。
 * この件数ぶんは次の抽選から外し、同じ料理が続けて出るのを防ぐ。多くしすぎると
 * 候補が尽きて除外が毎回解けてしまうので、連続を切れる最小限の3件にする
 */
const RECENT_SUGGEST_KEEP = 3

function matchesCondition(
  recipe: Recipe,
  condition: SuggestCondition,
  quickMinutes: number,
): boolean {
  if (condition === 'notRecent') return !cookedWithinDays(recipe, 14)
  if (condition === 'favorite') return recipe.isFavorite
  if (condition === 'quick')
    return recipe.cookMinutes != null && recipe.cookMinutes > 0 && recipe.cookMinutes <= quickMinutes
  return true
}

/**
 * 提案カード（サムネ＋名前＋時間・手間で詳細へ）。
 *
 * 2026-08-19 便HW（オーナー原文「場所や機能ごとにレシピカードの形や内容が変わっているのが
 * みづらい」、司令部裁定「候補カードは『標準』に寄せる」）: 自前で組んでいた
 * 「80pxサムネ＋大きな料理名」をやめ、共通のレシピカードの「標準」に寄せた。
 * レシピ一覧の一覧表示と同じ形になり、季節・主要食材・お気に入りの付け外しも同じ位置に出る。
 */
function SuggestionCard({
  recipe,
  linkState,
  onOpen,
  roleLabel,
}: {
  recipe: Recipe
  linkState: unknown
  /** 詳細へ移る直前に呼ぶ（戻ってきたときに同じ候補を出すため。2026-08-17 便HI） */
  onOpen: (recipeId: number) => void
  /**
   * 「主菜」「副菜」の別（2026-08-18 便HM）。献立を組んでいるときだけ渡す。
   * 1品のときは渡さない＝カードの形は同じで、付く字だけが違う
   */
  roleLabel?: string
}) {
  return (
    <div className="mt-[var(--space-sm)]">
      <RecipeCard
        recipe={recipe}
        density="standard"
        testId="day-suggest-result"
        titleTestId="day-suggest-result-title"
        // 2026-07-16オーナー決定: 候補カードから詳細を開いて戻ったときは、開いた画面へ戻す
        // (「今日の献立」と同じ扱い。RecipeDetailPageのbackFallback参照)
        linkState={linkState}
        onNavigate={() => {
          if (recipe.id != null) onOpen(recipe.id)
        }}
        titleBadges={
          roleLabel ? <span className="text-xs text-ink-muted">{roleLabel}</span> : undefined
        }
      />
    </div>
  )
}

export default function TodaySuggestPanel({
  recipes,
  pantryNames,
  settings,
  linkState,
  collapsible = false,
  pinnedRecipeId = null,
  onOpenSuggestion,
  planPair,
  planCandidateCount,
  onDrawPlan,
  onAddToToday,
}: {
  /** 提案の対象にするレシピ（「基本レシピを表示しない」設定を反映済み。読み込み中は undefined） */
  recipes: Recipe[] | undefined
  /** 在庫にある食材名（「在庫の食材から」の絞り込みに使う） */
  pantryNames: string[]
  settings: Settings | undefined
  /** 候補カードから詳細へ移るときに持たせる出所（戻るでこの画面へ帰るため） */
  linkState: unknown
  /**
   * 見出しを押して開け閉めできるようにする（2026-08-17 便HI）。
   * true にすると**畳んだ状態から始まる**。その日の献立が決まっている日に使う。
   */
  collapsible?: boolean
  /**
   * 引き直さずに出す候補（2026-08-17 便HI）。レシピ詳細から戻ってきた1回だけ渡す。
   * 「ランダムで1品出す」を押す・条件を変えると外れて、ふだんどおりくじを引く。
   */
  pinnedRecipeId?: number | null
  /** 候補カードからレシピ詳細を開いたことの知らせ（呼び出し側が覚える。2026-08-17 便HI） */
  onOpenSuggestion?: (recipeId: number) => void
  /**
   * いま組んである献立（主菜＋副菜。2026-08-18 便HM）。**まだ今日の献立には入っていない**。
   * 組む処理そのものは呼び出し側（pages/MealPlanPage.tsx）が持つ——献立エンジンは
   * 表示中の食事帯・ジャンル・目的・昨日の献立など、この節の外の材料で引くため。
   */
  planPair: { role: MealRole; recipe: Recipe }[]
  /**
   * 「おまかせで献立を組む」がいまくじを引いている主菜の候補数（2026-08-19 便HTで関数にした）。
   * この節の絞り込みが献立側にも効くようになったので、**その絞り込みを通したあとの数**を
   * 出さないと、画面の数字と実際に引いている候補が食い違う。
   */
  planCandidateCount: (allowedRecipeIds?: number[]) => number
  /**
   * 献立を1組引き直す。`auto` は「献立」に切り替えた直後・条件を変えた直後の引き直し
   * （利用者がボタンを押したのではない）で、呼び出し側が出しているお知らせを消さないための目印。
   * `allowedRecipeIds` はこの節の絞り込みを通したレシピ（2026-08-19 便HT・オーナー指示
   * 「献立にも1品と同じように条件を絞る機能つければいいのでは？」）。
   */
  onDrawPlan: (options?: { auto?: boolean; allowedRecipeIds?: number[] }) => void
  /**
   * 「今日の献立に入れる」。渡すのは出ているレシピ（1品なら1つ、献立なら主菜＋副菜）。
   * 食事の枠を選ぶ窓を開くところから先は呼び出し側が受け持つ
   */
  onAddToToday: (recipes: Recipe[], mode: SuggestMode) => void
}) {
  /**
   * 畳める日（その日の献立が決まっている日）に、利用者が見出しを押して開いたか
   * （2026-08-17 便HI）。畳めない日は中身を常に出すので、この値は見ない。
   *
   * 「畳める／畳めない」が変わったときに setOpen で開き方を戻す形は**採らなかった**。
   * 献立とレシピは liveQuery で後から届くので、着地の一瞬だけ「決まっていない日」に見え、
   * そのあと「決まっている日」に変わる。その間に open を動かすと、**データが届いただけ**なのに
   * 折りたたみが「利用者が開いた（閉→開）」と読み、伸びた部分を画面へ入れる位置合わせ
   * （2026-08-09 便EO）を走らせてページを送ってしまう。開き方を状態から**導く**形にすれば、
   * 押していないのに開いた扱いになる道がそもそも無い（2026-08-10 便FDと同じ考え方）。
   */
  const [open, setOpen] = useState(false)
  /** 中身を出すか。畳めない日は常に出す */
  const shown = collapsible ? open : true
  /**
   * 「1品」を出すか「献立」を組むか（2026-08-18 便HM）。
   *
   * 状態は端末に覚える（設定 dayStartSuggestMode）。理由は2つ:
   *  ① この切り替えは「今日はどっち」ではなく**その人の作り方の好み**（1品だけ決めたいのか、
   *     主菜＋副菜をまとめたいのか）で、開くたびに選び直させると毎日2回押させることになる
   *  ② 同じ節の「◯分以内」の分数（homeQuickMinutes）をすでに同じやり方で覚えている
   *
   * 2026-08-19 便HT（オーナー原文「基本を献立表示にして、1品にする時のみスイッチ
   * 押すようにした方が良いかも」）: **未設定のときは「献立」から始める**。
   * 一度でも切り替えた人はその選び方のまま（保存済みの 'one' はこれまでどおり1品）。
   * 覚えるのは切り替えだけで、出ている候補そのものは覚えない（開くたびに引き直す）。
   */
  const mode: SuggestMode = settings?.dayStartSuggestMode === 'one' ? 'one' : 'plan'
  const changeMode = (next: SuggestMode) => {
    if (next === mode) return
    void updateSettings({ dayStartSuggestMode: next })
  }
  const [condition, setCondition] = useState<SuggestCondition>('any')
  // 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5: 常時全展開がゴチャつきの一因。既定閉。
  // MealPlanPage「提案の条件」と同じパターン)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  // 種別のしぼり(2026-07-23 便BH-2「主菜」トグル → 2026-08-03 便DHで4区分の複数選択へ)。
  // 既定は主菜だけ=献立の中心になる主菜(肉・魚・卵・豆腐が主役)を提案し、
  // 「1品ランダムに副菜が出てがっかり」を防ぐ。副菜・汁物・その他も足して選べる。
  // 選んだ種別に合う品が0件になる場合は0件回避で全体から選ぶ
  const [dishTypes, setDishTypes] = useState<DishType[]>(DEFAULT_DISH_TYPES)
  const [pantryOnly, setPantryOnly] = useState(false)
  const [seed, setSeed] = useState(() => Math.random())
  /**
   * レシピ詳細から戻ってきたときに、そのまま出しておく候補（2026-08-17 便HI）。
   * 引き直しの条件が1つでも変わったら外す＝「戻ってきた1回だけ」に閉じる。
   */
  const [pinnedId, setPinnedId] = useState<number | null>(pinnedRecipeId)
  const toggleDishType = (type: DishType) => {
    setPinnedId(null)
    setDishTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }
  const changeCondition = (value: SuggestCondition) => {
    setPinnedId(null)
    setCondition(value)
  }
  const togglePantryOnly = () => {
    setPinnedId(null)
    setPantryOnly((v) => !v)
  }
  /**
   * 絞り込みが1つでも効いているか（2026-08-18 便HS・軸8）。
   * 効いていないのに「条件をクリア」を出すと、押しても何も変わらないボタンになる
   * （レシピ一覧の空状態も、条件がかかっているときだけこのボタンを出している）。
   */
  const anyConditionActive =
    condition !== 'any' ||
    pantryOnly ||
    dishTypes.length !== DEFAULT_DISH_TYPES.length ||
    !DEFAULT_DISH_TYPES.every((t) => dishTypes.includes(t))
  /** 「条件をクリア」: 条件チップ・料理の種別・在庫の絞りを、開いた直後と同じ状態に戻す */
  const clearConditions = () => {
    setPinnedId(null)
    setCondition('any')
    setDishTypes(DEFAULT_DISH_TYPES)
    setPantryOnly(false)
    setSeed(Math.random())
  }
  // 「ランダムで1品出す」で直近に出した候補(2026-07-29 便CD/MP-12)。押すたびに積んで、
  // その分は次の抽選から外す＝同じ料理が続けて出るのを防ぐ
  const [recentSuggestedIds, setRecentSuggestedIds] = useState<number[]>([])
  // 「◯分以内」で選んだ分数(2026-07-24 便BN・タスク7)。設定に記憶し、未設定は10分扱い
  const quickMinutes = settings?.homeQuickMinutes ?? 10
  // 「◯分以内」チップのラベルは選択中の分数を差し込む。他の条件はそのままのラベルを使う
  const conditionLabel = (value: SuggestCondition): string => {
    const base = conditions.find((c) => c.value === value)?.label ?? ''
    return value === 'quick' ? base.replace('{n}', String(quickMinutes)) : base
  }

  // 条件(すべて/最近作っていない/お気に入り/◯分以内)で絞り込んだ上で、選んだ種別ごとに
  // 今の季節を優先した候補を作って合わせる(logic/homeSuggest.ts)。
  // 2026-08-04 便DV-1: 種別を増やすほど候補が減っていたバグを、この関数側で直した
  const candidates = useMemo(() => {
    const byCondition = (recipes ?? []).filter((r) => matchesCondition(r, condition, quickMinutes))
    return suggestionCandidates(byCondition, dishTypes, currentSeason())
  }, [recipes, condition, dishTypes, quickMinutes])

  // 「在庫の食材で」がONのとき、在庫(ある/少ない)の食材を1つ以上使うレシピに絞る。
  // 0件ならズレの不満を防ぐため通常候補にフォールバックし、その旨を表示する
  const { list: finalCandidates, fallback: pantryFallback } = useMemo(() => {
    if (!pantryOnly || pantryNames.length === 0) return { list: candidates, fallback: false }
    // 在庫との照合は logic/pantry.ts の判定器に一本化する(2026-07-29 便CC/C4)
    const matchesPantry = makePantryMatcher(pantryNames)
    const filtered = candidates.filter((r) => r.ingredients.some((i) => matchesPantry(i.name)))
    return filtered.length > 0
      ? { list: filtered, fallback: false }
      : { list: candidates, fallback: true }
  }, [candidates, pantryOnly, pantryNames])

  /**
   * 「献立」を組むときに使えるレシピ（2026-08-19 便HT・オーナー原文
   * 「献立にも1品と同じように条件を絞る機能つければいいのでは？」）。
   *
   * 効かせるもの: 条件チップ（すべて／最近作っていない／お気に入り／◯分以内）と
   * 「在庫の食材から」。**1品側とまったく同じ判定**（matchesCondition と
   * logic/pantry.ts の判定器）を通す＝同じ条件が画面の左右で違う意味にならない。
   *
   * 効かせないもの: **料理の種別**。主菜だけに絞ると副菜が引けず献立が成立しない
   * （汁物だけ・その他だけも同じ）。黙って無視すると「押しても効かない条件」になるので、
   * 献立を出しているあいだは種別の並びを出さず、代わりに理由の1行を出す（下の描画部）。
   *
   * 在庫で0件になったときは1品側と同じく絞りを解く＝「在庫で組めなかった」で
   * 献立そのものが出ない、を作らない（解いたことは pantryFallback の1行で言う）。
   */
  const planAllowedIds = useMemo(() => {
    const byCondition = (recipes ?? []).filter((r) => matchesCondition(r, condition, quickMinutes))
    let pool = byCondition
    if (pantryOnly && pantryNames.length > 0) {
      const matchesPantry = makePantryMatcher(pantryNames)
      const filtered = byCondition.filter((r) => r.ingredients.some((i) => matchesPantry(i.name)))
      if (filtered.length > 0) pool = filtered
    }
    return pool.map((r) => r.id).filter((id): id is number => id != null)
  }, [recipes, condition, quickMinutes, pantryOnly, pantryNames])

  /** 献立側で「在庫の食材から」の絞りを解いたか（1品側の pantryFallback と同じ知らせを出す） */
  const planPantryFallback = useMemo(() => {
    if (!pantryOnly || pantryNames.length === 0) return false
    const byCondition = (recipes ?? []).filter((r) => matchesCondition(r, condition, quickMinutes))
    if (byCondition.length === 0) return false
    const matchesPantry = makePantryMatcher(pantryNames)
    return !byCondition.some((r) => r.ingredients.some((i) => matchesPantry(i.name)))
  }, [recipes, condition, quickMinutes, pantryOnly, pantryNames])

  // 直前に出た候補を「ランダムで1品出す」の対象から外す(2026-07-29 便CD/MP-12)。
  // 候補が尽きるなら除外を解く(空振りより重複がマシ)＝献立エンジンの
  // excludeYesterdayPlanRecipes と同じ作法・同じ関数を使う
  const shufflePool = useMemo(
    () => excludeYesterdayPlanRecipes(finalCandidates, recentSuggestedIds),
    [finalCandidates, recentSuggestedIds],
  )
  const drawn =
    shufflePool.length > 0
      ? shufflePool[Math.floor(seed * shufflePool.length) % shufflePool.length]
      : undefined
  /**
   * 覚えていた候補があればそれを出す（2026-08-17 便HI）。
   * 見つからないとき（そのレシピを消した・条件から外れた等）は、黙ってふつうのくじに戻す
   * ＝「戻ったら空だった」を作らない。
   */
  const pinned = pinnedId != null ? (recipes ?? []).find((r) => r.id === pinnedId) : undefined
  const suggestion = pinned ?? drawn
  // 「ランダムで1品出す」: 今出ている候補を直近リストへ積んでから振り直す
  const shuffleSuggestion = () => {
    if (suggestion?.id != null) {
      const shownId = suggestion.id
      setRecentSuggestedIds((prev) =>
        [shownId, ...prev.filter((id) => id !== shownId)].slice(0, RECENT_SUGGEST_KEEP),
      )
    }
    setPinnedId(null)
    setSeed(Math.random())
  }

  /**
   * 「献立」に切り替えたら、押さなくても1組出しておく（2026-08-18 便HM）。
   *
   * オーナー実機「『おまかせで献立を組む』の候補が下に出るのわかりづらい」への答えの半分。
   * 「1品」の側は開いた時点で候補が1品出ているのに、「献立」の側だけは押すまで何も無く、
   * 押した結果が離れた場所に足されていた。切り替えた時点で結果が出ていれば、
   * **押した結果を探しに行く場面そのものが無くなる**。
   *
   * 引くのは「その条件でまだ組んでいないとき」の1回だけ。何で引いたか（条件の組み合わせ）を
   * `planDrawnKey` に覚えてから引くので、「今日の献立に入れる」で組んだ献立が空になっても
   * 勝手に引き直さない（入れた直後にお知らせを消して別の献立を出す、をしない）。
   *
   * 2026-08-19 便HT で2つ足した:
   *  ・**レシピが届くまでは引かない**。この節が既定で「献立」になったので、アプリを開いた
   *    直後にここが必ず通る。レシピはliveQueryで後から届くため、届く前に引くと候補0品で
   *    「この条件で組める献立がありませんでした」とだけ言って引いた印が立ち、
   *    そのあとレシピが届いても組み直さない画面になっていた
   *  ・**条件を変えたら組み直す**（オーナー指示で絞り込みが献立側にも効くようになったため）。
   *    1品側は条件を変えるとその場で候補が入れ替わるので、献立側だけ「押すまで前の組のまま」
   *    だと、絞ったのに効いていないように見える。覚えるのを真偽値ではなく
   *    「何で引いたか」にしてあるのは、これを引き直しの合図にするため。
   *
   * レシピ詳細から戻ってきて組が復元されているときは引き直さない（②の要）。
   * これは**いちばん最初の1回だけ**の扱いで、そのあと条件を変えれば組み直す。
   */
  const planPairCount = planPair.length
  const recipesReady = recipes != null && recipes.length > 0
  /** いまの条件で引いたか（null＝まだ一度も引いていない）。中身は条件の組み合わせ */
  const [planDrawnKey, setPlanDrawnKey] = useState<string | null>(null)
  const planDrawKey =
    shown && mode === 'plan' && recipesReady
      ? `${condition}|${quickMinutes}|${pantryOnly ? 'pantry' : 'all'}`
      : null
  useEffect(() => {
    if (planDrawKey == null) {
      if (planDrawnKey != null) setPlanDrawnKey(null)
      return
    }
    if (planDrawnKey === planDrawKey) return
    const first = planDrawnKey == null
    setPlanDrawnKey(planDrawKey)
    // 最初の1回だけ、すでに組んであるもの（戻ってきたときの覚え）をそのまま出す
    if (first && planPairCount > 0) return
    onDrawPlan({ auto: true, allowedRecipeIds: planAllowedIds })
  }, [planDrawKey, planDrawnKey, planPairCount, planAllowedIds, onDrawPlan])

  /** いま出ているもの（「今日の献立に入れる」に渡す中身） */
  const shownRecipes =
    mode === 'plan' ? planPair.map((item) => item.recipe) : suggestion ? [suggestion] : []

  const body =
    recipes && recipes.length === 0 ? (
        <div className="mt-[var(--space-sm)] text-center">
          <p className="text-ink-muted">{ja.dayStart.empty}</p>
          <Link
            to="/recipes/new"
            className="mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-on-accent shadow-sm"
          >
            {ja.recipes.addRecipe}
          </Link>
        </div>
      ) : (
        <>
          {/* 「1品」／「献立」の切り替え(2026-08-18 便HM・オーナー指示)。見出しのすぐ下に置き、
              いまどちらを出しているかを地色で言い切る(選択中=塗り。条件チップと同じ言い方)。
              下の「決めてもらう」ボタンは1つで、名前と絵だけがこの切り替えで入れ替わる */}
          <div
            role="group"
            aria-label={ja.dayStart.modeGroupLabel}
            className="mt-[var(--space-sm)] grid grid-cols-2 gap-1 rounded-md border border-edge bg-app p-1"
          >
            {([
              ['one', ja.dayStart.modeOne],
              ['plan', ja.dayStart.modePlan],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                data-testid={value === 'one' ? 'day-mode-one' : 'day-mode-plan'}
                onClick={() => changeMode(value)}
                aria-pressed={mode === value}
                className={`rounded-sm py-3 text-base font-bold ${
                  mode === value ? 'bg-accent text-on-accent shadow-sm' : 'text-ink-muted'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 「条件をしぼる」と「在庫の食材から」は**どちらを選んでいても**出す
              （2026-08-19 便HT・オーナー原文「献立にも1品と同じように条件を絞る機能つければ
              いいのでは？」）。便HMは献立側で丸ごと隠していたが、オーナーの答えは
              「隠すのではなく効くようにしてほしい」だったので、効かせるほうへ倒した。
              効き方は logic の側で1品とそろえてある（planAllowedIds）。
              ただし**料理の種別だけは献立に当てはめられない**（主菜だけに絞ると副菜が引けず、
              献立が成立しない）。黙って無視すると「押しても効かない条件」になるので、
              献立を出しているあいだは種別の並びを出さず、理由の1行に置き換える */}
          <>
            {/* 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5)。既定閉。畳んだ状態でも
                既定値(すべて)から変えていればラベルに現在値を出す(MealPlanPage「提案の条件」と同じパターン) */}
            <div className="mt-[var(--space-sm)]">
              <button
                type="button"
                onClick={() => setConditionsOpen((v) => !v)}
                aria-expanded={conditionsOpen}
                className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-ink-muted shadow-sm"
              >
                {ja.dayStart.conditionsToggle}
                {/* 現在値は開いていても出したままにする（2026-08-09 便EO・オーナー実機
                    「押下後にサイズが変わって場所がズレる」）。畳んだときだけ足すと、
                    押すたびにボタンの幅が変わってシェブロンの位置が動いていた */}
                {condition !== 'any' ? `: ${conditionLabel(condition)}` : ''}
                {conditionsOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </button>
              <Collapse open={conditionsOpen}>
                <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                  {conditions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => changeCondition(option.value)}
                      className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                        condition === option.value
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-edge bg-surface text-ink-muted'
                      }`}
                    >
                      {conditionLabel(option.value)}
                    </button>
                  ))}
                </div>
                {/* 「◯分以内」を選んでいるときだけ、分数(10/15/20/30)を選ぶ(2026-07-24 便BN・タスク7)。
                    選んだ分数は設定に記憶する */}
                {condition === 'quick' && (
                  <div className="mt-[var(--space-sm)]">
                    <p className="text-xs text-ink-muted">{ja.dayStart.quickMinutesLabel}</p>
                    <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                      {QUICK_MINUTES_OPTIONS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => void updateSettings({ homeQuickMinutes: m })}
                          aria-pressed={m === quickMinutes}
                          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                            m === quickMinutes
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-edge bg-surface text-ink-muted'
                          }`}
                        >
                          {ja.dayStart.condQuick.replace('{n}', String(m))}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* 料理の種別(2026-08-03 便DH・オーナー指示)。旧「主菜」トグル1つを
                    レシピ登録と同じ4区分の複数選択にし、置き場所も「条件をしぼる」の中へ移した。
                    2026-08-19 便HT: 献立を出しているあいだは、並びの代わりに効かない理由を出す */}
                <div className="mt-[var(--space-sm)]">
                  <p className="text-xs text-ink-muted">{ja.dayStart.dishTypeLabel}</p>
                  {mode === 'plan' ? (
                    <p data-testid="day-dishtype-plan-note" className="mt-1 text-xs text-ink-muted">
                      {ja.dayStart.dishTypePlanNote}
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
                      {DISH_TYPE_OPTIONS.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => toggleDishType(type)}
                          aria-pressed={dishTypes.includes(type)}
                          className={`rounded-sm border px-3 py-2 text-sm font-bold ${
                            dishTypes.includes(type)
                              ? 'border-accent bg-accent text-on-accent'
                              : 'border-edge bg-surface text-ink-muted'
                          }`}
                        >
                          {ja.dishType[type]}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </Collapse>
            </div>

            {/* 「在庫の食材から」トグル(2026-07-23 便BH-2・2026-07-24 便BN・タスク6)。
                在庫にある食材を使うレシピに絞る(在庫が1件以上あるときだけ出す)。
                2026-08-19 便HT: 献立側にも効く */}
            {/* 2026-08-19 司令部: 在庫が0件のときは、この行そのものを出さない。
                それまでは中身が空でも入れ物だけが残り、上の余白ぶん（8px）を取っていた。
                実測では「今日の献立に入れる」の下端が390×667の画面で671pxまで下がっており、
                空の行のぶんだけ押すものが画面の外へ近づいていた */}
            {pantryNames.length > 0 && (
              <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                <button
                  type="button"
                  onClick={togglePantryOnly}
                  aria-pressed={pantryOnly}
                  className={`inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    pantryOnly
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  <Refrigerator size={14} aria-hidden />
                  {ja.dayStart.pantryOnlyToggle}
                </button>
              </div>
            )}

            {(mode === 'plan' ? planPantryFallback : pantryFallback) && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.dayStart.pantryOnlyFallback}
              </p>
            )}
          </>

          {/* 「決めてもらう」ボタン。置き場所は1つで、名前と絵が切り替えで入れ替わる
              (2026-08-18 便HM・オーナー指示「同じボタンにまとめ」)。
              地色・字色・大きさは「ランダムで1品出す」のものをそのまま使う
              (2026-08-03 便DH。オーナー「見た目は1品の画面に寄せたい」)。

              2026-08-19 便HT（オーナー実機「ランダムボタンが下だと品数によってボタン位置が変わり、
              連続タップで誤タップします。上に持ってくるか、ボタン位置がずれないようにするかして」）:
              **結果より上へ移した**。ここから上に出るものは切り替え・「条件をしぼる」・
              「在庫の食材から」だけで、どれも1品と献立で同じ数だけ出る＝
              **出た品数でも、切り替えでも、連続して押しても、このボタンは1pxも動かない**。
              「結果の場所の高さを固定する」案は採らなかった: 1品のときも献立2品ぶんの空きを
              抱えることになり、390×667の画面では「今日の献立に入れる」が画面の外へ落ちる。
              便HMが「結果が下だと探しに行くことになる」と書いた形に戻るが、あのときの問題は
              **1品は上・献立は下と向きが逆だったこと**と、あいだに説明が2行挟まっていたことで、
              いまはどちらの側も押した指のすぐ下に同じカードで出る（説明はカードの下へ回した） */}
          <button
            type="button"
            data-testid="day-suggest-draw"
            onClick={
              mode === 'plan'
                ? () => onDrawPlan({ allowedRecipeIds: planAllowedIds })
                : shuffleSuggestion
            }
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            {mode === 'plan' ? (
              <UtensilsCrossed size={20} aria-hidden />
            ) : (
              <Dices size={20} aria-hidden />
            )}
            {mode === 'plan' ? ja.mealPlan.todaySuggestButton : ja.dayStart.shuffle}
          </button>

          {/* 出てきたもの。**どちらを選んでいてもボタンのすぐ下**に出す(2026-08-19 便HT)。
              便HMで「どちらも同じカード・同じ向き」にそろえたのはそのまま残し、向きだけを
              下向きに変えた（上の理由）。献立の主菜・副菜も1品とまったく同じカードで出し、
              違いは料理名の上に付く「主菜」「副菜」の小さな字だけ */}
          {mode === 'plan' ? (
            planPair.length > 0 ? (
              <div data-testid="day-suggest-pair">
                {planPair.map(({ role, recipe }) => (
                  <SuggestionCard
                    key={recipe.id}
                    recipe={recipe}
                    linkState={linkState}
                    onOpen={(recipeId) => onOpenSuggestion?.(recipeId)}
                    roleLabel={ja.mealPlan.role[role]}
                  />
                ))}
              </div>
            ) : (
              /* 引いてみて0件だったときだけ言う。切り替えた直後の1フレームでは何も出さない
                 ＝これから引くのに「ありませんでした」と先に言わない。
                 2026-08-19 便HT: 絞り込みが効くようになったので、1品側と同じく
                 「条件をクリア」も添える（0件の理由が条件のときに、その場で外せる） */
              planDrawnKey != null && (
                <div className="mt-[var(--space-sm)] text-center text-ink-muted">
                  <p>{ja.mealPlan.todaySuggestNoPair}</p>
                  {anyConditionActive && (
                    <button
                      type="button"
                      onClick={clearConditions}
                      className="tap-target mt-[var(--space-sm)] rounded-md border border-accent bg-surface px-4 py-2 text-sm font-bold text-accent-ink shadow-sm"
                    >
                      {ja.search.clear}
                    </button>
                  )}
                </div>
              )
            )
          ) : suggestion ? (
            <SuggestionCard
              recipe={suggestion}
              linkState={linkState}
              onOpen={(recipeId) => onOpenSuggestion?.(recipeId)}
            />
          ) : (
            /* 条件で0件の型（2026-08-18 便HS・軸8）: 「条件に合う◯◯が見つかりません」＋
               「条件をクリア」。直す前は文だけで、どの条件が効いているのかも、
               どこで外せるのかも、この場からは分からなかった */
            <div className="mt-[var(--space-sm)] text-center text-ink-muted">
              <p>{ja.dayStart.noCandidate}</p>
              {anyConditionActive && (
                <button
                  type="button"
                  onClick={clearConditions}
                  className="tap-target mt-[var(--space-sm)] rounded-md border border-accent bg-surface px-4 py-2 text-sm font-bold text-accent-ink shadow-sm"
                >
                  {ja.search.clear}
                </button>
              )}
            </div>
          )}

          {/* いま候補が何品あるか(2026-08-02 便DE-5・オーナー指示)を出す＝候補が少ない条件では
              振り直しても同じ料理が続けて出るので、その理由が数字で分かる。
              数える母集団が1品側と献立側で違う(献立は主菜だけ)ので、言い方も分けてある
              (2026-08-17 便HH)。献立のときは、週タブの「まとめて献立を入力」との違い
              (今日の分だけ・2品)を先に書いてから候補数を添える(2026-07-29 便CD/MP-15)。
              2026-08-19 便HT: 置き場所を結果の下にした（ボタンと結果のあいだに説明を挟まない）。
              献立の候補数も、この節の絞り込みを通したあとの数で出す＝画面の数字と実際に
              引いている候補が食い違わない */}
          <p className="mt-1 text-center text-xs text-ink-muted">
            {mode === 'plan'
              ? `${ja.mealPlan.todaySuggestHint}（${ja.mealPlan.todaySuggestCandidateCount.replace(
                  '{n}',
                  String(planCandidateCount(planAllowedIds)),
                )}）`
              : ja.common.candidateCount.replace('{n}', String(finalCandidates.length))}
          </p>

          {/* 「今日の献立に入れる」。1品でも献立でも同じ場所・同じ名前で出す
              (2026-08-18 便HM・オーナー「今日の献立にれるボタンを1品にも適用えきるし」)。
              押すと食事の枠を選ぶ窓(レシピ詳細と同じ TodaySlotModal)が開く。
              決めてもらうボタンと同じ塗りにすると、押すものが2つ並んでどちらが
              「もう一度引く」なのか読めなくなるので、こちらは枠だけにする */}
          {shownRecipes.length > 0 && (
            <button
              type="button"
              data-testid="day-suggest-apply"
              onClick={() => onAddToToday(shownRecipes, mode)}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              <Plus size={18} aria-hidden />
              {ja.mealPlan.todaySuggestApply}
            </button>
          )}
        </>
      )

  return (
    <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
      {/* 見出し。畳める日は見出しそのものが開け閉めのボタンになる（2026-08-17 便HI）。
          畳んでいても節の名前は「今日なに作る？」のまま＝同じものを日によって違う名前で呼ばない
          （旧「もう1品さがす」の小さいリンクを置き換えた） */}
      {collapsible ? (
        <h2 className="text-xl font-bold">
          <button
            type="button"
            data-testid="day-suggest-toggle"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={shown}
            /* 見出しの行がそのまま押す面になる（高さは文字の大きさ＋上下の余白で44px以上） */
            className="flex w-full items-center justify-between gap-2 py-2 text-left"
          >
            {ja.dayStart.suggestTitle}
            {shown ? (
              <ChevronUp size={20} className="shrink-0 text-ink-muted" aria-hidden />
            ) : (
              <ChevronDown size={20} className="shrink-0 text-ink-muted" aria-hidden />
            )}
          </button>
        </h2>
      ) : (
        <h2 className="text-xl font-bold">{ja.dayStart.suggestTitle}</h2>
      )}

      {collapsible ? <Collapse open={shown}>{body}</Collapse> : body}
    </section>
  )
}
