import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Dices, Heart, ChevronDown, ChevronUp, Refrigerator } from 'lucide-react'
import { updateSettings } from '../db/settings'
import { cookedWithinDays } from '../logic/cooked'
import { currentSeason } from '../logic/season'
import { DISH_TYPE_OPTIONS, suggestionCandidates } from '../logic/homeSuggest'
import { excludeYesterdayPlanRecipes } from '../logic/mealPlan'
import { makePantryMatcher } from '../logic/pantry'
import type { DishType, Recipe, Settings } from '../db/types'
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
 */

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

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
function SuggestionCard({ recipe, linkState }: { recipe: Recipe; linkState: unknown }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      // 2026-07-16オーナー決定: 候補カードから詳細を開いて戻ったときは、開いた画面へ戻す
      // (「今日の献立」と同じ扱い。RecipeDetailPageのbackFallback参照)
      state={linkState}
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
        <p className="line-clamp-2 text-lg font-bold leading-snug">{recipe.title}</p>
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
  planAction,
}: {
  /** 提案の対象にするレシピ（「基本レシピを表示しない」設定を反映済み。読み込み中は undefined） */
  recipes: Recipe[] | undefined
  /** 在庫にある食材名（「在庫の食材から」の絞り込みに使う） */
  pantryNames: string[]
  settings: Settings | undefined
  /** 候補カードから詳細へ移るときに持たせる出所（戻るでこの画面へ帰るため） */
  linkState: unknown
  /**
   * 「決めてもらう」操作のもう1つ（「おまかせで献立を組む」＋その説明）。
   * 渡された日だけ、この節のいちばん下に並べる（2026-08-17 便HH）。
   * その日の献立がまだ決まっていない日にだけ渡す＝すでに決まっている日に、
   * さらに2品入れるボタンを出さない。
   */
  planAction?: ReactNode
}) {
  const [condition, setCondition] = useState<SuggestCondition>('any')
  // 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5: 常時全展開がゴチャつきの一因。既定閉。
  // MealPlanPage「提案の条件」と同じパターン)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  // 種別のしぼり(2026-07-23 便BH-2「主菜」トグル → 2026-08-03 便DHで4区分の複数選択へ)。
  // 既定は主菜だけ=献立の中心になる主菜(肉・魚・卵・豆腐が主役)を提案し、
  // 「1品ランダムに副菜が出てがっかり」を防ぐ。副菜・汁物・その他も足して選べる。
  // 選んだ種別に合う品が0件になる場合は0件回避で全体から選ぶ
  const [dishTypes, setDishTypes] = useState<DishType[]>(DEFAULT_DISH_TYPES)
  const toggleDishType = (type: DishType) =>
    setDishTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  const [pantryOnly, setPantryOnly] = useState(false)
  const [seed, setSeed] = useState(() => Math.random())
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
  const suggestion =
    shufflePool.length > 0
      ? shufflePool[Math.floor(seed * shufflePool.length) % shufflePool.length]
      : undefined
  // 「ランダムで1品出す」: 今出ている候補を直近リストへ積んでから振り直す
  const shuffleSuggestion = () => {
    if (suggestion?.id != null) {
      const shownId = suggestion.id
      setRecentSuggestedIds((prev) =>
        [shownId, ...prev.filter((id) => id !== shownId)].slice(0, RECENT_SUGGEST_KEEP),
      )
    }
    setSeed(Math.random())
  }

  return (
    <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
      <h2 className="text-xl font-bold">{ja.dayStart.suggestTitle}</h2>

      {recipes && recipes.length === 0 ? (
        <div className="mt-[var(--space-sm)] text-center">
          <p className="text-ink-muted">{ja.dayStart.empty}</p>
          <Link
            to="/recipes/new"
            className="mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-on-accent shadow-sm"
          >
            {ja.dayStart.goRegister}
          </Link>
        </div>
      ) : (
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
                    onClick={() => setCondition(option.value)}
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
                onClick={() => setPantryOnly((v) => !v)}
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

          {suggestion ? (
            <SuggestionCard recipe={suggestion} linkState={linkState} />
          ) : (
            <p className="mt-[var(--space-sm)] text-ink-muted">{ja.dayStart.noCandidate}</p>
          )}

          {/* 2026-08-03 便DH(オーナー指示): 「ほかの候補を見る」→「ランダムで選ぶ」に改名し、
              既存のCTAと同じオレンジ地・白字(bg-accent/text-on-accent)にする
              (2026-08-17 便HHで名前だけ「ランダムで1品出す」に。地色・字色・大きさはそのまま) */}
          <button
            type="button"
            onClick={shuffleSuggestion}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
          >
            <Dices size={20} aria-hidden />
            {ja.dayStart.shuffle}
          </button>
          {/* いま候補が何品あるか(2026-08-02 便DE-5・オーナー指示)。候補が少ない条件では
              振り直しても同じ料理が続けて出るので、その理由が数字で分かるようにする */}
          <p className="mt-1 text-center text-xs text-ink-muted">
            {ja.common.candidateCount.replace('{n}', String(finalCandidates.length))}
          </p>

          {/* 「決めてもらう」操作のもう1つ(2026-08-17 便HH)。上の1品側とは別のしくみで動くので、
              細い区切り線で分けたうえで同じ節の中に置く＝決めてもらう操作を1か所にまとめる */}
          {planAction && (
            <div className="mt-[var(--space-md)] border-t border-edge pt-[var(--space-md)]">
              {planAction}
            </div>
          )}
        </>
      )}
    </section>
  )
}
