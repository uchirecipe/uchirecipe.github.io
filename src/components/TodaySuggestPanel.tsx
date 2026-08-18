import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  Dices,
  Heart,
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
import { RecipePlaceholder } from './RecipeCard'
import { usePhotoUrl } from './usePhotoUrl'
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

/** 提案カード（写真サムネイル＋名前で詳細へ） */
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
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      data-testid="day-suggest-result"
      // 2026-07-16オーナー決定: 候補カードから詳細を開いて戻ったときは、開いた画面へ戻す
      // (「今日の献立」と同じ扱い。RecipeDetailPageのbackFallback参照)
      state={linkState}
      onClick={() => {
        if (recipe.id != null) onOpen(recipe.id)
      }}
      className="mt-[var(--space-sm)] flex items-center gap-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
    >
      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-sm">
        {photoUrl ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} iconSize={32} />
        )}
      </div>
      <div className="min-w-0">
        {roleLabel && <p className="text-xs text-ink-muted">{roleLabel}</p>}
        <p
          data-testid="day-suggest-result-title"
          className="line-clamp-2 text-lg font-bold leading-snug"
        >
          {recipe.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={14} aria-hidden />
              {recipe.cookMinutes}
              {ja.recipes.minutesSuffix}
            </span>
          )}
          <span>{ja.effort[recipe.effortLevel]}</span>
          {recipe.isFavorite && (
            <Heart size={14} className="text-accent-ink" fill="currentColor" aria-hidden />
          )}
        </div>
      </div>
    </Link>
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
  /** 「おまかせで献立を組む」がいまくじを引いている主菜の候補数 */
  planCandidateCount: number
  /**
   * 献立を1組引き直す。`auto` は「献立」に切り替えた直後の1回（利用者が押したのではない）で、
   * 呼び出し側が出しているお知らせを消さないための目印
   */
  onDrawPlan: (options?: { auto?: boolean }) => void
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
   * 未設定（はじめて使う人・これまでの利用者）は「1品」＝これまでどおりの見え方から始まる。
   * 覚えるのは切り替えだけで、出ている候補そのものは覚えない（開くたびに引き直す）。
   */
  const mode: SuggestMode = settings?.dayStartSuggestMode === 'plan' ? 'plan' : 'one'
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
   * 引くのは切り替えたとき（畳んでいる日は開いたとき）の1回だけ。
   * `planDrawTried` を先に立ててから引くので、
   * 「今日の献立に入れる」で組んだ献立が空になっても勝手に引き直さない
   * （入れた直後にお知らせを消して別の献立を出す、をしない）。
   */
  const [planDrawTried, setPlanDrawTried] = useState(false)
  const planPairCount = planPair.length
  useEffect(() => {
    if (!shown || mode !== 'plan') {
      if (planDrawTried) setPlanDrawTried(false)
      return
    }
    if (planDrawTried) return
    setPlanDrawTried(true)
    if (planPairCount === 0) onDrawPlan({ auto: true })
  }, [shown, mode, planDrawTried, planPairCount, onDrawPlan])

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

          {/* 「条件をしぼる」と「在庫の食材から」は「1品」を選んでいるときだけ出す
              (2026-08-18 便HM)。この絞り込みは1品のくじにしか効かず、中の「料理の種別」は
              主菜＋副菜を組む側には当てようがない(主菜だけに絞ると献立が組めない)。
              効かない側に出しておくと「効くように見えて効かない」だけなので、出さない */}
          {mode === 'one' && (
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
                    レシピ登録と同じ4区分の複数選択にし、置き場所も「条件をしぼる」の中へ移した */}
                <div className="mt-[var(--space-sm)]">
                  <p className="text-xs text-ink-muted">{ja.dayStart.dishTypeLabel}</p>
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
                </div>
              </Collapse>
            </div>

            {/* 「在庫の食材から」トグル(2026-07-23 便BH-2・2026-07-24 便BN・タスク6)。
                在庫にある食材を使うレシピに絞る(在庫が1件以上あるときだけ出す) */}
            <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
              {pantryNames.length > 0 && (
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
              )}
            </div>

            {pantryFallback && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.dayStart.pantryOnlyFallback}
              </p>
            )}
            </>
          )}

          {/* 出てきたもの。**どちらを選んでいてもボタンの上**に出す(2026-08-18 便HM)。
              直す前は1品の候補がボタンの上、組んだ献立がボタンの下で、同じ節の中で
              結果の出る向きが逆だった(オーナー「候補が下に出るのわかりづらい」)。
              献立の主菜・副菜も1品とまったく同じカードで出し、違いは料理名の上に付く
              「主菜」「副菜」の小さな字だけにする(オーナー「見た目は1品の画面に寄せたい」) */}
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
                 ＝これから引くのに「ありませんでした」と先に言わない */
              planDrawTried && (
                <p className="mt-[var(--space-sm)] text-ink-muted">
                  {ja.mealPlan.todaySuggestNoPair}
                </p>
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

          {/* 「決めてもらう」ボタン。置き場所は1つで、名前と絵が切り替えで入れ替わる
              (2026-08-18 便HM・オーナー指示「同じボタンにまとめ」)。
              地色・字色・大きさは「ランダムで1品出す」のものをそのまま使う
              (2026-08-03 便DH。オーナー「見た目は1品の画面に寄せたい」) */}
          <button
            type="button"
            data-testid="day-suggest-draw"
            onClick={mode === 'plan' ? () => onDrawPlan() : shuffleSuggestion}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            {mode === 'plan' ? (
              <UtensilsCrossed size={20} aria-hidden />
            ) : (
              <Dices size={20} aria-hidden />
            )}
            {mode === 'plan' ? ja.mealPlan.todaySuggestButton : ja.dayStart.shuffle}
          </button>
          {/* ボタンの下の1行。いま候補が何品あるか(2026-08-02 便DE-5・オーナー指示)を出す＝
              候補が少ない条件では振り直しても同じ料理が続けて出るので、その理由が数字で分かる。
              数える母集団が1品側と献立側で違う(献立は主菜だけ・「条件をしぼる」は効かない)ので、
              言い方も分けてある(2026-08-17 便HH)。献立のときは、週タブの「まとめて献立を入力」との
              違い(今日の分だけ・2品)を先に書いてから候補数を添える(2026-07-29 便CD/MP-15) */}
          <p className="mt-1 text-center text-xs text-ink-muted">
            {mode === 'plan'
              ? `${ja.mealPlan.todaySuggestHint}（${ja.mealPlan.todaySuggestCandidateCount.replace(
                  '{n}',
                  String(planCandidateCount),
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
