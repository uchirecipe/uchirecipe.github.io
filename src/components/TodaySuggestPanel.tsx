import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Dices,
  ChevronDown,
  ChevronUp,
  Plus,
  Refrigerator,
  SlidersHorizontal,
  UtensilsCrossed,
  X,
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
import { DIALOG_BACKDROP_CLS, DIALOG_CARD_CLS, DIALOG_PRIMARY_BUTTON_CLS } from './dialogStyle'
import { useOverlayDismiss } from './useOverlayDismiss'
import { useScrollLock } from './useScrollLock'
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
 * した方が良いかも」「献立にも1品と同じように条件を絞る機能つければいいのでは？」）:
 *  ・切り替えの**未設定時の既定を「献立」に**した（設定 dayStartSuggestMode）
 *  ・便HMが献立側で隠していた「条件をしぼる」「在庫の食材から」を**どちらの側でも出し、
 *    献立エンジンにも効かせる**ようにした（planAllowedIds）。当てはめられない
 *    「料理の種別」だけは、並びの代わりに効かない理由の1行に置き換える
 *
 * 2026-08-19 便HY（オーナー原文「『在庫の食材から』をON/OFFするたびに献立の表示が
 * 切り替わらないようにして。変わるのは『おまかせで組む』押下後」）:
 * 献立側は**どの条件を変えても、押すまで組み直さない**。効くのは「おまかせで献立を組む」を
 * 押したときだけで、条件を変えた直後は「変えた条件は…押すと反映されます」の1行を
 * ボタンのすぐ下に出す（詳しい理由は下の planDrawnKey まわり）。
 * 在庫だけを据え置きにしないのは、同じ並びに置いた絞り込みの作法を1つだけ変えないため。
 * **1品側は据え置きにしない**＝条件を変えるとその場で候補が入れ替わる（1品は「引き直す」
 * ことそのものが目的の道具で、押す前と押した後を見比べる献立とは性質が違う）。
 */

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

/** 「1品」を出すか、「献立」（主菜＋副菜）を組むか（2026-08-18 便HM） */
type SuggestMode = 'one' | 'plan'

/**
 * 「条件をしぼる」の窓に並べる絞り込み（2026-08-19 便IA）。
 *
 * 「◯分以内」を**分数のぶんだけ最初から並べる**形にした（下の QUICK_MINUTES_OPTIONS）。
 * 便BN以来「◯分以内」はチップ1つで、押してはじめて分数の並びが下に現れていたが、
 * それがオーナー実機の「条件を絞るボタンをぽちぽち色々試すたびに、追加の選択肢が出現して
 * ボタンや献立のレシピカードの場所が変わる」のいちばんの原因だった
 * （390px幅の実測で、押すと下のものが112px下がっていた）。
 * 分数を最初から並べれば、どれを押しても**並びの数も高さも変わらない**。
 */
const conditions: { value: Exclude<SuggestCondition, 'quick'>; label: string }[] = [
  { value: 'any', label: ja.dayStart.condAll },
  { value: 'notRecent', label: ja.dayStart.condNotRecent },
  { value: 'favorite', label: ja.dayStart.condFavorite },
]

// 「◯分以内」で選べる分数(2026-07-24 便BN・タスク7)。既定は先頭の10分
const QUICK_MINUTES_OPTIONS = [10, 15, 20, 30] as const

/**
 * 「条件をしぼる」の窓に並ぶチップの見た目（2026-08-19 便IA）。
 * 条件・分数・料理の種別・在庫の4つの並びで同じ見た目にするため、1か所で持つ
 * （選んでいるものは塗る＝アプリの他の絞り込みチップと同じ言い方）。
 */
const conditionChipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

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
  ngIngredients,
  linkState,
  onOpen,
  roleLabel,
}: {
  recipe: Recipe
  /**
   * 設定「食べられない食材」（2026-08-19 便IA）。ここに引っかかる品には警告の印が付く。
   * **提案してくる場所にこそ要る**ので渡す——レシピ一覧・献立の枠・今日の献立には最初から
   * 出ていたのに、この節が出す候補と「今日の献立」の1品だけ渡し忘れていて、
   * 食べられない品を勧めておいて何も言わない画面になっていた。
   */
  ngIngredients: string[]
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
        ngIngredients={ngIngredients}
        // 2026-08-19 便HY（オーナー原文「『今日なに作る？』だったら『基本レシピ』と
        // 食材表記はいらないように感じました」）: 形はレシピ一覧と同じ「標準」のまま、
        // 載せる情報だけをこの場所ぶんに絞る（表は src/logic/cardParts.ts）
        place="todaySuggest"
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
  onShownOneChange,
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
   * いま「1品」側に出ている料理の知らせ（2026-08-21 便IP・①）。出ていなければ null。
   * 呼び出し側がこの画面を離れるときの覚えに使う（献立の組と対にして持つ）。
   */
  onShownOneChange?: (recipeId: number | null) => void
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
  /**
   * 「条件をしぼる」の窓が開いているか（2026-08-19 便IA・オーナー実機
   * 「今日なに作るで、条件を絞るボタンをぽちぽち色々試すたびに、説明文や追加の選択肢が出現して
   *   ボタンや献立のレシピカードの場所が変わるので見づらく感じる」）。
   *
   * 直す前は折りたたみ（Collapse）で、開くと下が押し下がり、さらに中の選択肢を押すと
   * 分数の並びが現れて下がまたずれていた（390px幅の実測: 開くと決めてもらうボタンが
   * 299px→451pxへ152px下がり、「◯分以内」を押すとさらに112px下がる）。
   * **窓にすれば、開いても中で何を押しても後ろの画面は1pxも動かない**。
   * 窓の作りはアプリ共通のもの（外タップ・✕・端末の「戻る」で閉じる useOverlayDismiss、
   * 後ろの画面を止める useScrollLock、見た目は dialogStyle）をそのまま使う＝新しく作らない。
   */
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const closeConditions = useCallback(() => setConditionsOpen(false), [])
  // 端末の「戻る」とEscapeで、この窓だけを閉じる／開いているあいだ後ろの画面を止める。
  // どちらもアプリ共通の仕組みをそのまま使う（新しい窓の作りを発明しない）
  useOverlayDismiss(conditionsOpen, closeConditions)
  useScrollLock(conditionsOpen)
  // 種別のしぼり(2026-07-23 便BH-2「主菜」トグル → 2026-08-03 便DHで4区分の複数選択へ)。
  // 既定は主菜だけ=献立の中心になる主菜(肉・魚・卵・豆腐が主役)を提案し、
  // 「1品ランダムに副菜が出てがっかり」を防ぐ。副菜・汁物・その他も足して選べる。
  // 選んだ種別に合う品が0件になる場合は0件回避で全体から選ぶ
  const [dishTypes, setDishTypes] = useState<DishType[]>(DEFAULT_DISH_TYPES)
  const [pantryOnly, setPantryOnly] = useState(false)
  /**
   * レシピ詳細から戻ってきたときに、そのまま出しておく候補（2026-08-17 便HI）。
   * 「おまかせで1品出す」を押したときに外れる＝「戻ってきた1回だけ」に閉じる。
   * 2026-08-19 便IA: **条件を変えただけでは外さない**（条件を変えても出ているものは変えない）。
   */
  const [pinnedId, setPinnedId] = useState<number | null>(pinnedRecipeId)
  // 「◯分以内」で選んだ分数(2026-07-24 便BN・タスク7)。設定に記憶し、未設定は10分扱い
  const quickMinutes = settings?.homeQuickMinutes ?? 10
  /**
   * 絞り込みを変える（2026-08-19 便IA・オーナー実機「1品も条件ぽちぽち帰るたびに候補が
   * 変わらないようにして」）。**変えるのは条件だけで、出ているものには触らない**
   * ＝1品も献立も「おまかせで…」を押したときだけ入れ替わる。
   */
  const toggleDishType = (type: DishType) =>
    setDishTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  const changeCondition = (value: SuggestCondition) => setCondition(value)
  /**
   * 「◯分以内」の分数を選ぶ。選んだ時点で条件も「◯分以内」にそろえる
   * ＝分数を最初から並べても「押しても効かないボタン」を作らない（2026-08-19 便IA）。
   */
  const changeQuickMinutes = (minutes: number) => {
    if (condition !== 'quick') setCondition('quick')
    if (minutes !== quickMinutes) void updateSettings({ homeQuickMinutes: minutes })
  }
  const togglePantryOnly = () => setPantryOnly((v) => !v)
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
    setCondition('any')
    setDishTypes(DEFAULT_DISH_TYPES)
    setPantryOnly(false)
  }
  // 「おまかせで1品出す」で直近に出した候補(2026-07-29 便CD/MP-12)。押すたびに積んで、
  // その分は次の抽選から外す＝同じ料理が続けて出るのを防ぐ
  const [recentSuggestedIds, setRecentSuggestedIds] = useState<number[]>([])
  /** 「条件をしぼる」のボタンに添える、いま選んでいる条件の名前（「◯分以内」は分数を差し込む） */
  const currentConditionLabel =
    condition === 'quick'
      ? ja.dayStart.condQuick.replace('{n}', String(quickMinutes))
      : (conditions.find((c) => c.value === condition)?.label ?? '')

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

  /**
   * 「在庫の食材から」で絞った結果が0品だったので、絞りを解いた（1品側・献立側で同じ知らせ）。
   * 2026-08-19 便IA: 出す場所を「条件をしぼる」の窓の中（在庫のボタンのすぐ下）へ移した。
   * 直す前は決めてもらうボタンの**上**に出ていたので、在庫を押すたびにボタンごと下がっていた。
   */
  const pantryFallbackShown = mode === 'plan' ? planPantryFallback : pantryFallback

  /**
   * いま出ている1品（2026-08-19 便IA・オーナー実機「1品も条件ぽちぽち帰るたびに候補が
   * 変わらないようにして」）。
   *
   * 直す前は、条件から毎回その場で引き当てていた（くじの種＋いまの候補一覧）ので、
   * 条件を1つ触るだけで候補が入れ替わっていた。2026-08-18の裁定では「1品は引き直すことが
   * 目的なのでそれでよい」としたが、オーナーが実機で見て逆の判断をしたので、
   * **献立側と同じく「引いた結果を覚えておく」**形にそろえた。
   * こうすると、条件を変えても出ているものは動かず、押したときだけ入れ替わる。
   */
  const [drawnOneId, setDrawnOneId] = useState<number | null>(null)
  /**
   * 覚えていた候補があればそれを出す（2026-08-17 便HI）。
   * 見つからないとき（そのレシピを消した・条件から外れた等）は、黙ってふつうのくじに戻す
   * ＝「戻ったら空だった」を作らない。
   */
  const pinned = pinnedId != null ? (recipes ?? []).find((r) => r.id === pinnedId) : undefined
  const drawnOne = drawnOneId != null ? (recipes ?? []).find((r) => r.id === drawnOneId) : undefined
  const suggestion = pinned ?? drawnOne
  /**
   * いま「1品」側に出ている料理を、呼び出し側へ知らせる（2026-08-21 便IP・①）。
   *
   * 呼び出し側（pages/MealPlanPage.tsx）は、この画面を離れたときに「離れる前に出ていたもの」を
   * 覚えておく。**献立の組は呼び出し側が持っているのに、1品はこの節の中にしかない**ので、
   * 知らせないと片側だけが組み直る（＝作った記録の一覧へ行って戻ると、献立は残るのに
   * 1品だけ別の料理に変わる）。
   *
   * 出ているものが変わったときだけ知らせる。渡すのは値を受け取るだけの関数
   * （useState の更新関数）なので、知らせが次の描画を呼んでこの節が組み直る道は無い。
   */
  const shownOneId = suggestion?.id ?? null
  useEffect(() => {
    onShownOneChange?.(shownOneId)
  }, [shownOneId, onShownOneChange])
  /**
   * 1品を引く（2026-08-19 便IA）。**押した時点の絞り込み**（finalCandidates）から選ぶ。
   * 直前に出した数品は次の抽選から外す（2026-07-29 便CD/MP-12。候補が尽きるなら除外を解く
   * ＝空振りより重複がマシ。献立エンジンの excludeYesterdayPlanRecipes と同じ作法・同じ関数）。
   *
   * `auto` は開いた直後・「1品」に切り替えた直後の1回で、そのときは
   * いま出ているものを「直近に出した」に積まない（まだ誰も見ていないため）。
   */
  const drawOne = useCallback(
    (options?: { auto?: boolean }) => {
      const shownId = suggestion?.id ?? null
      const nextRecent =
        options?.auto || shownId == null
          ? recentSuggestedIds
          : [shownId, ...recentSuggestedIds.filter((id) => id !== shownId)].slice(
              0,
              RECENT_SUGGEST_KEEP,
            )
      if (nextRecent !== recentSuggestedIds) setRecentSuggestedIds(nextRecent)
      setPinnedId(null)
      const pool = excludeYesterdayPlanRecipes(finalCandidates, nextRecent)
      const picked = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : undefined
      setDrawnOneId(picked?.id ?? null)
    },
    [suggestion, recentSuggestedIds, finalCandidates],
  )

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
   * 2026-08-19 便HT: **レシピが届くまでは引かない**。この節が既定で「献立」になったので、
   * アプリを開いた直後にここが必ず通る。レシピはliveQueryで後から届くため、届く前に引くと
   * 候補0品で「この条件で組める献立がありませんでした」とだけ言って引いた印が立ち、
   * そのあとレシピが届いても組み直さない画面になっていた。
   *
   * 2026-08-19 便HY（オーナー原文「『在庫の食材から』をON/OFFするたびに献立の表示が
   * 切り替わらないようにして。変わるのは『おまかせで組む』押下後」）:
   * **条件を変えても組み直さない**。便HTは逆に「条件を変えたら押さなくても組み直す」に
   * していたが、勝手に組み替わるほうが驚く、というのがオーナーの指摘。
   *
   * 据え置きにするのは**在庫だけではなく、この節の絞り込み全部**（条件チップ・分数・
   * 在庫の食材から）。在庫だけ据え置きにすると、同じ並びに置かれた絞り込みの作法が
   * 1つだけ違うことになる。**組み直すのは「おまかせで献立を組む」を押したときだけ**。
   *
   * そのため引いた印（planDrawnKey）から条件を外し、「この節で献立を出しているか」だけを
   * 覚える。条件は別に drawnConditionKey として覚えておき、**いま選んでいる条件と
   * 食い違っているあいだ**はボタンのすぐ下に1行出す（下の planConditionChanged）
   * ＝画面が変わらない理由と、変えた条件がいつ効くのかを、押すボタンの側で言う。
   *
   * 1品側は今までどおり、条件を変えるとその場で候補が入れ替わる（1品は「引き直す」こと
   * そのものが目的の道具なので、性質が違う）。
   *
   * レシピ詳細から戻ってきて組が復元されているときも引き直さない（②の要）。
   */
  const planPairCount = planPair.length
  const recipesReady = recipes != null && recipes.length > 0
  /**
   * いま選んでいる絞り込み（2026-08-19 便HY）。献立側に効く条件だけを並べる
   * ＝料理の種別は献立に当てはめられないので入れない（planAllowedIds と同じ材料）。
   */
  const conditionKey = `${condition}|${quickMinutes}|${pantryOnly ? 'pantry' : 'all'}`
  /**
   * この節で献立を出しているあいだ立つ印（null＝出していない）。
   * 2026-08-19 便HY で**条件を含めるのをやめた**＝条件を変えても組み直さない。
   */
  const [planDrawnKey, setPlanDrawnKey] = useState<string | null>(null)
  /** 最後に組んだときの絞り込み。いまの conditionKey と違えば「変えたけどまだ組んでいない」 */
  const [drawnConditionKey, setDrawnConditionKey] = useState<string | null>(null)
  const planDrawKey = shown && mode === 'plan' && recipesReady ? 'plan' : null
  useEffect(() => {
    if (planDrawKey == null) {
      if (planDrawnKey != null) setPlanDrawnKey(null)
      return
    }
    if (planDrawnKey === planDrawKey) return
    const first = planDrawnKey == null
    setPlanDrawnKey(planDrawKey)
    // 最初の1回だけ、すでに組んであるもの（戻ってきたときの覚え・「1品」から戻したとき）を
    // そのまま出す。覚えが無いときだけ、いまの条件で組んだことにする
    // （ここで毎回上書きすると、「1品」へ寄り道して戻るだけで「条件を変えた」印が消える）
    if (first && planPairCount > 0) {
      if (drawnConditionKey == null) setDrawnConditionKey(conditionKey)
      return
    }
    setDrawnConditionKey(conditionKey)
    onDrawPlan({ auto: true, allowedRecipeIds: planAllowedIds })
  }, [
    planDrawKey,
    planDrawnKey,
    planPairCount,
    planAllowedIds,
    conditionKey,
    drawnConditionKey,
    onDrawPlan,
  ])
  /** 「おまかせで献立を組む」を押したとき。組んだ時点の条件を覚え直す */
  const drawPlanNow = () => {
    setDrawnConditionKey(conditionKey)
    onDrawPlan({ allowedRecipeIds: planAllowedIds })
  }
  /**
   * 決めてもらうボタンを押したとき（2026-08-20 便II・③）。
   * 畳んだままでも押せるようにしたので、**押したら節を開く**＝出てきたものが必ず見える。
   * （週タブの「まとめて献立を入力」は結果が下の曜日カードに出るので開かない。
   *   こちらは結果がこの節の中にしか出ないので、開かないと押しても何も見えない）
   */
  const drawNow = () => {
    if (collapsible && !open) setOpen(true)
    if (mode === 'plan') drawPlanNow()
    else drawOneNow()
  }
  /**
   * 絞り込みを変えたあと、まだ組み直していない（＝出ている献立が前の条件のもの）。
   * 献立を出しているあいだだけ見る値
   */
  const planConditionChanged =
    mode === 'plan' && planDrawnKey != null && drawnConditionKey != null && drawnConditionKey !== conditionKey

  /**
   * 1品側の「押すまで変えない」（2026-08-19 便IA）。**献立側とまったく同じ作りにする**
   * ＝同じ節に並ぶ2つの側が、条件を変えたときに違う動き方をしないようにするため。
   * 違うのは、1品側では**料理の種別も効く**ので、覚えておく条件にそれも入るところだけ。
   */
  const oneConditionKey = `${condition}|${quickMinutes}|${pantryOnly ? 'pantry' : 'all'}|${[
    ...dishTypes,
  ]
    .sort()
    .join(',')}`
  /** この節で1品を出しているあいだ立つ印（null＝出していない） */
  const [oneDrawnKey, setOneDrawnKey] = useState<string | null>(null)
  /** 最後に引いたときの絞り込み。いまの oneConditionKey と違えば「変えたけどまだ引いていない」 */
  const [drawnOneConditionKey, setDrawnOneConditionKey] = useState<string | null>(null)
  const oneDrawKey = shown && mode === 'one' && recipesReady ? 'one' : null
  useEffect(() => {
    if (oneDrawKey == null) {
      if (oneDrawnKey != null) setOneDrawnKey(null)
      return
    }
    if (oneDrawnKey === oneDrawKey) return
    const first = oneDrawnKey == null
    setOneDrawnKey(oneDrawKey)
    // 最初の1回だけ、すでに出ているもの（レシピ詳細から戻ってきた覚え・「献立」から戻したとき）を
    // そのまま出す。覚えが無いときだけ、いまの条件で引いたことにする
    if (first && (pinnedId != null || drawnOneId != null)) {
      if (drawnOneConditionKey == null) setDrawnOneConditionKey(oneConditionKey)
      return
    }
    setDrawnOneConditionKey(oneConditionKey)
    drawOne({ auto: true })
  }, [
    oneDrawKey,
    oneDrawnKey,
    pinnedId,
    drawnOneId,
    oneConditionKey,
    drawnOneConditionKey,
    drawOne,
  ])
  /** 「おまかせで1品出す」を押したとき。引いた時点の条件を覚え直す */
  const drawOneNow = () => {
    setDrawnOneConditionKey(oneConditionKey)
    drawOne()
  }
  /** 絞り込みを変えたあと、まだ引き直していない（＝出ている1品が前の条件のもの） */
  const oneConditionChanged =
    mode === 'one' &&
    oneDrawnKey != null &&
    drawnOneConditionKey != null &&
    drawnOneConditionKey !== oneConditionKey
  /** 出ているものが「前の条件のもの」になっているか（1品と献立で同じ扱い） */
  const conditionChanged = mode === 'plan' ? planConditionChanged : oneConditionChanged

  /** いま出ているもの（「今日の献立に入れる」に渡す中身） */
  const shownRecipes =
    mode === 'plan' ? planPair.map((item) => item.recipe) : suggestion ? [suggestion] : []

  /**
   * 中身を3つに分ける（2026-08-20 便II・③）。オーナー原文
   *   「折りたたんだ状態で「まとめて献立を入力」ボタンほしい。アプリ全体で、折りたたみを一切
   *     開かなくても、最低限一通りすべての機能を触れる（使いこなすために開く）ようにしたい。」
   *
   * 決めてもらうボタンだけを折りたたみの**外**に出し、その上（切り替え・条件）と
   * 下（結果・候補数・「今日の献立に入れる」）を別々の折りたたみに入れる。
   * こうすると、**開いているときの並びは今までと1つも変わらず**、畳んだときだけ
   * 見出しのすぐ下に決めてもらうボタンが残る。週タブの「献立を提案」も同じ形にしてある。
   */
  /** レシピが1件も無い（＝引くものが無い）とき。決めてもらうボタンも出さない */
  const noRecipes = recipes != null && recipes.length === 0
  const emptyBody = (
    <div className="mt-[var(--space-sm)] text-center">
      <p className="text-ink-muted">{ja.dayStart.empty}</p>
      <Link
        to="/recipes/new"
        className="mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-on-accent shadow-sm"
      >
        {ja.recipes.addRecipe}
      </Link>
    </div>
  )
  const bodyTop = (
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

          {/* 「条件をしぼる」（2026-08-19 便IA）。**押すと窓が開く**だけの1つのボタンにした。
              直す前はここが折りたたみで、開くと下が押し下がり、中の選択肢を押すたびに
              分数の並びや説明文が現れてまたずれていた（オーナー実機の指摘そのもの）。
              いま選んでいる条件は、押さなくても分かるようにボタンの名前に添える
              （幅は変わるが高さは変わらない＝下のものは動かない）。
              何か絞り込んでいるあいだは枠と字をアクセント色にする＝窓を開かなくても
              「絞り込み中かどうか」が分かる（レシピを選ぶ画面の絞り込みボタンと同じ言い方）。
              「在庫の食材から」もこの窓の中に入れた: 同じ絞り込みなのに片方だけ外に残すと、
              押したときの動き方（後ろが動く／動かない）が2つに割れるため */}
          <div className="mt-[var(--space-sm)]">
            <button
              type="button"
              data-testid="day-conditions-open"
              onClick={() => setConditionsOpen(true)}
              className={`inline-flex items-center gap-1 rounded-sm border bg-surface px-3 py-2 text-sm font-bold shadow-sm ${
                anyConditionActive ? 'border-accent text-accent-ink' : 'border-edge text-ink-muted'
              }`}
            >
              <SlidersHorizontal size={16} aria-hidden />
              {ja.dayStart.conditionsToggle}
              {condition !== 'any' ? `: ${currentConditionLabel}` : ''}
            </button>
          </div>

        </>
  )

  /**
   * 「決めてもらう」ボタン。置き場所は1つで、名前と絵が切り替えで入れ替わる
   * （2026-08-18 便HM・オーナー指示「同じボタンにまとめ」）。
   * 地色・字色・大きさは「ランダムで1品出す」のものをそのまま使う
   * （2026-08-03 便DH。オーナー「見た目は1品の画面に寄せたい」）。
   *
   * 2026-08-19 便HT（オーナー実機「ランダムボタンが下だと品数によってボタン位置が変わり、
   * 連続タップで誤タップします。上に持ってくるか、ボタン位置がずれないようにするかして」）:
   * **結果より上**にある。ここから上に出るものは切り替えと「条件をしぼる」だけで、
   * どちらも1品と献立で同じ数だけ出る＝**出た品数でも、切り替えでも、連続して押しても、
   * このボタンは1pxも動かない**。
   * 「結果の場所の高さを固定する」案は採らなかった: 1品のときも献立2品ぶんの空きを
   * 抱えることになり、390×667の画面では「今日の献立に入れる」が画面の外へ落ちる。
   *
   * 2026-08-20 便II・③: 折りたたみの**外**へ出した。開いているときの並び（切り替え→条件→
   * このボタン→結果）は1つも変わらず、畳んだときだけ見出しのすぐ下に残る。
   */
  const drawButton = (
    <button
      type="button"
      data-testid="day-suggest-draw"
      onClick={drawNow}
      className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
    >
      {mode === 'plan' ? <UtensilsCrossed size={20} aria-hidden /> : <Dices size={20} aria-hidden />}
      {mode === 'plan' ? ja.mealPlan.todaySuggestButton : ja.dayStart.shuffle}
    </button>
  )

  const bodyBottom = (
        <>

          {/* 絞り込みを変えたのに画面が変わらない理由（2026-08-19 便HY＝献立／便IA＝1品）。
              **置き場所はボタンの「下」**にする: 上に置くと、条件を触るたびにボタンが下へずれて、
              便HTがオーナー実機の指摘（「ランダムボタンが下だと品数によってボタン位置が変わり、
              連続タップで誤タップします」）に応えて固定した位置がまた動く。

              2026-08-19 便IA: **この1行の場所を先に確保する**（出ていないあいだも同じ高さを取る）。
              出たり消えたりで場所を取ると、下に並ぶ候補カードが40px動く（390px幅で実測）。
              オーナー実機の指摘は「説明文が出現してボタンや献立のレシピカードの場所が変わる」
              なので、カードのほうも動かしてはいけない。
              空の箱に決め打ちの高さを入れるのではなく**同じ文をそのまま置いて見えなくする**のは、
              端末の幅や文字の大きさで折り返しが変わっても、確保する高さがいつも実際の高さと
              一致するため（決め打ちの高さは、折り返した瞬間にずれる）。
              目印（data-testid）は出ているときだけ付ける＝「出ているか」を機械が数で見分けられる。
              1品側と献立側で文が違うのは、押すボタンの名前が違うため（規約H: 場所は指示語でなく
              ボタン名で言う） */}
          <p
            {...(conditionChanged
              ? {
                  'data-testid':
                    mode === 'plan' ? 'day-plan-condition-changed' : 'day-one-condition-changed',
                }
              : { 'aria-hidden': true })}
            className={`mt-[var(--space-sm)] text-center text-xs text-ink-muted ${
              conditionChanged ? '' : 'invisible'
            }`}
          >
            {mode === 'plan'
              ? ja.mealPlan.todaySuggestConditionChanged
              : ja.dayStart.conditionChanged}
          </p>

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
                    ngIngredients={settings?.ngIngredients ?? []}
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
                 「条件をクリア」も添える（0件の理由が条件のときに、その場で外せる）。
                 2026-08-19 便IA: 便HYはここを「条件を変えたら消す」にしていたが、消すと
                 出ているものの場所が動く（オーナー実機「条件を絞るたびにレシピカードの場所が
                 変わる」）。**出ているものは押すまで丸ごと据え置く**方にそろえた——
                 「この条件で」が指しているのは最後に押したときの条件で、変えた条件がまだ
                 効いていないことは、すぐ上の1行が言っている */
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
              ngIngredients={settings?.ngIngredients ?? []}
              linkState={linkState}
              onOpen={(recipeId) => onOpenSuggestion?.(recipeId)}
            />
          ) : (
            /* 条件で0件の型（2026-08-18 便HS・軸8）: 「条件に合う◯◯が見つかりません」＋
               「条件をクリア」。直す前は文だけで、どの条件が効いているのかも、
               どこで外せるのかも、この場からは分からなかった。
               2026-08-19 便IA: 引く前（切り替えた直後の1フレーム）は何も出さない
               ＝これから引くのに「見つかりません」と先に言わない（献立側と同じ作法） */
            oneDrawnKey != null && (
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
            )
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
    <section className="rounded-md border border-edge bg-surface p-[var(--space-md)]">
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

      {/* 2026-08-20 便II・③: 決めてもらうボタンだけを折りたたみの外に出し、その上と下を
          別々の折りたたみに入れる。開いているときの並びは今までと同じで、畳むと
          見出し＋決めてもらうボタンだけが残る。
          下側の折りたたみは開き切ったあとの位置合わせをしない（reveal={false}）＝
          1回の開閉で画面が2回動かない（上側だけが今までどおり位置を合わせる） */}
      {noRecipes ? (
        collapsible ? <Collapse open={shown}>{emptyBody}</Collapse> : emptyBody
      ) : (
        <>
          {collapsible ? <Collapse open={shown}>{bodyTop}</Collapse> : bodyTop}
          {drawButton}
          {collapsible ? (
            <Collapse open={shown} reveal={false}>
              {bodyBottom}
            </Collapse>
          ) : (
            bodyBottom
          )}
        </>
      )}

      {/* 「条件をしぼる」の窓（2026-08-19 便IA）。
          折りたたみ（Collapse）の**外**に置く: 折りたたみは開閉のあいだ中身を切り取るので、
          その中に窓を置くと、閉じるときに窓ごと切り取られてしまう。
          後ろの画面を止める・端末の「戻る」で閉じる・外タップで閉じる・見た目、の4つは
          アプリ共通のもの（useScrollLock / useOverlayDismiss / dialogStyle）をそのまま使う。

          **窓の中も動かない形にしてある**（オーナー実機「条件を絞るボタンをぽちぽち色々
          試すたびに、説明文や追加の選択肢が出現して…場所が変わる」）:
           ・「◯分以内」の分数（10/15/20/30）を最初から並べる＝押しても選択肢が増えない
           ・「在庫の食材から」で候補が0品になったときの1行は、**出ていないあいだも場所を取る**
             （見えなくするだけ。文をそのまま置くので、折り返しが変わっても高さが合う）
           ・「条件をクリア」も同じやり方で場所を先に取る
          この窓は真ん中に出るので、中身が1行でも増えると**窓ごと上下に動く**＝
          並びの途中だけでなく、出したり消したりするもの全部が場所を先に取る必要がある */}
      {conditionsOpen && (
        <div className={DIALOG_BACKDROP_CLS} onClick={closeConditions} role="presentation">
          <div
            role="dialog"
            aria-label={ja.dayStart.conditionsToggle}
            data-testid="day-conditions-modal"
            onClick={(e) => e.stopPropagation()}
            className={DIALOG_CARD_CLS}
          >
            {/* 見出しの行に「条件をクリア」を小さく置く（2026-08-20 便II・②。オーナー原文
                「「条件をクリア」は上に小さく文字だけでいい（レシピ絞り込みと同じ）下に大きくあると、
                  誤認して決定のつもりで押しそう。」）。
                形はレシピ一覧の絞り込みパネルの「条件をクリア」と同じ＝**パネルの上端・小さい字・
                下線のリンク**（pages/RecipesPage.tsx）。週タブの「提案の条件」の窓も同じにしてある
                ＝同じ操作を画面ごとに違う場所・違う大きさで出さない。
                条件を1つも選んでいないあいだも場所は先に取る（見えなくするだけ）＝
                窓の中身が伸び縮みして下の選択肢が動くことがない（便IAと同じ手） */}
            <div className="flex items-center justify-between gap-2">
              <h3 className="min-w-0 flex-1 font-bold">{ja.dayStart.conditionsToggle}</h3>
              <button
                type="button"
                data-testid="day-conditions-clear"
                onClick={clearConditions}
                aria-hidden={!anyConditionActive}
                className={`shrink-0 py-2 text-sm font-bold text-accent-ink underline ${
                  anyConditionActive ? '' : 'invisible'
                }`}
              >
                {ja.search.clear}
              </button>
              <button
                type="button"
                onClick={closeConditions}
                aria-label={ja.common.close}
                className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            {/* どのレシピから選ぶか。「すべて」「最近作ってない」「お気に入り」に続けて、
                「◯分以内」を分数のぶんだけ並べる（1つだけ選ぶ） */}
            <p className="mt-[var(--space-md)] text-xs text-ink-muted">
              {ja.dayStart.conditionLabel}
            </p>
            <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
              {conditions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => changeCondition(option.value)}
                  aria-pressed={condition === option.value}
                  className={conditionChipCls(condition === option.value)}
                >
                  {option.label}
                </button>
              ))}
              {QUICK_MINUTES_OPTIONS.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  onClick={() => changeQuickMinutes(minutes)}
                  aria-pressed={condition === 'quick' && minutes === quickMinutes}
                  className={conditionChipCls(condition === 'quick' && minutes === quickMinutes)}
                >
                  {ja.dayStart.condQuick.replace('{n}', String(minutes))}
                </button>
              ))}
            </div>

            {/* 料理の種別(2026-08-03 便DH・オーナー指示)。旧「主菜」トグル1つを
                レシピ登録と同じ4区分の複数選択にした。
                2026-08-19 便HT: 献立を出しているあいだは、並びの代わりに効かない理由を出す
                （切り替えはこの窓の外にあるので、開いているあいだに入れ替わることはない） */}
            <p className="mt-[var(--space-md)] text-xs text-ink-muted">
              {ja.dayStart.dishTypeLabel}
            </p>
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
                    className={conditionChipCls(dishTypes.includes(type))}
                  >
                    {ja.dishType[type]}
                  </button>
                ))}
              </div>
            )}

            {/* 「在庫の食材から」(2026-07-23 便BH-2・2026-07-24 便BN・タスク6)。
                在庫にある食材を使うレシピに絞る(在庫が1件以上あるときだけ出す)。
                絞った結果が0品で解いたときの1行は、出ていないあいだも場所を取る */}
            {pantryNames.length > 0 && (
              <>
                <div className="mt-[var(--space-md)] flex flex-wrap gap-[var(--space-sm)]">
                  <button
                    type="button"
                    onClick={togglePantryOnly}
                    aria-pressed={pantryOnly}
                    className={`inline-flex items-center gap-1 ${conditionChipCls(pantryOnly)}`}
                  >
                    <Refrigerator size={14} aria-hidden />
                    {ja.dayStart.pantryOnlyToggle}
                  </button>
                </div>
                <p
                  aria-hidden={!pantryFallbackShown}
                  className={`mt-1 text-xs text-ink-muted ${pantryFallbackShown ? '' : 'invisible'}`}
                >
                  {ja.dayStart.pantryOnlyFallback}
                </p>
              </>
            )}

            {/* 2026-08-20 便II・②: ここにあった「条件をクリア」は見出しの行へ移した
                （下に大きく置くと「決定」と読み違えて押される）。残るのは「閉じる」だけ */}
            <div className={`mt-[var(--space-md)] space-y-[var(--space-sm)]`}>
              {/* 窓の中身は縦に長くなるので、下端にも大きな「閉じる」を置く
                  （下まで送ると右上の✕が画面の外に出るため）。名前は同じ ja.common.close */}
              <button
                type="button"
                data-testid="day-conditions-close"
                onClick={closeConditions}
                className={DIALOG_PRIMARY_BUTTON_CLS}
              >
                {ja.common.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
