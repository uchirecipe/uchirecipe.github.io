import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Clock,
  Dices,
  Heart,
  History,
  Carrot,
  HardDriveDownload,
  Refrigerator,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  Megaphone,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { fetchNews, isNewsSuppressed, type NewsItem } from '../logic/news'
import { usePantryItems } from '../db/pantry'
import { pantryAvailableNames } from '../logic/pantry'
import { useTodayList } from '../db/todayList'
import { backupOverdue } from '../logic/backup'
import { cookedWithinDays } from '../logic/cooked'
import { currentSeason, preferSeason } from '../logic/season'
import { toHiragana } from '../logic/kana'
import type { HomeWidgetKey, Recipe } from '../db/types'
import { defaultHomeWidgets } from '../db/types'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import ChipInput from '../components/ChipInput'
import { ja } from '../i18n/ja'

// バックアップ浮遊バナーの「×で閉じたらセッション中は再表示しない」用キー(2026-07-16 便S)。
// sessionStorageなのでタブ/アプリを閉じれば消え、次回起動時はまた条件を満たせば出る
const BACKUP_REMINDER_DISMISSED_KEY = 'uchirecipe:backupReminderDismissed'

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

const conditions: { value: SuggestCondition; label: string }[] = [
  { value: 'any', label: ja.home.condAll },
  { value: 'notRecent', label: ja.home.condNotRecent },
  { value: 'favorite', label: ja.home.condFavorite },
  { value: 'quick', label: ja.home.condQuick },
]

function matchesCondition(recipe: Recipe, condition: SuggestCondition): boolean {
  if (condition === 'notRecent') return !cookedWithinDays(recipe, 14)
  if (condition === 'favorite') return recipe.isFavorite
  if (condition === 'quick')
    return recipe.cookMinutes != null && recipe.cookMinutes > 0 && recipe.cookMinutes <= 10
  return true
}

/** 提案カード（写真サムネイル＋名前で詳細へ） */
function SuggestionCard({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <Link
      to={`/recipes/${recipe.id}`}
      // 2026-07-16オーナー決定: ホームの候補カードから詳細を開いて戻ったときはホームへ戻す
      // (「今日の献立」ウィジェットと同じtodayList方式の拡張。RecipeDetailPageのbackFallback参照)
      state={{ from: 'home', fromPath: '/' }}
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
            <Heart size={14} className="text-accent" fill="currentColor" aria-hidden />
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * ホーム: 表示パーツは設定でオン・オフ＆並べ替えできる。
 * 検索窓は2026-07-16 便Sでホームから削除（検索はレシピタブで行う）
 */
export default function HomePage() {
  const navigate = useNavigate()
  const allRecipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()

  const [condition, setCondition] = useState<SuggestCondition>('any')
  // 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5: 常時全展開がゴチャつきの一因。既定閉。
  // MealPlanPage「提案の条件」と同じパターン)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  const [pantryOnly, setPantryOnly] = useState(false)
  const [seed, setSeed] = useState(() => Math.random())
  const [ingredients, setIngredients] = useState<string[]>([])
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])

  // 「基本レシピを表示しない」設定を反映
  const recipes = useMemo(() => {
    if (!allRecipes) return undefined
    return settings?.hideStarters ? allRecipes.filter((r) => !r.isStarter) : allRecipes
  }, [allRecipes, settings?.hideStarters])

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    recipes?.forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）
  const todayList = useTodayList()
  const todayListRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])
  // 「今日の献立」ウィジェットが出るか(1品以上)。2026-07-16オーナー指示: 「今日なに作る?」
  // ウィジェットと常にどちらか片方だけを表示する（今日の献立が1品以上ならそちらを優先し、
  // 「今日なに作る?」はウィジェットごと非表示にする。読み込み中(undefined)は従来どおり0品扱い）
  const hasTodayList = !!todayListRecipes && todayListRecipes.length > 0

  // 自分のレシピが1件以上あり、30日以上（または一度も）バックアップしていないとき
  const showBackupReminder =
    settings !== undefined &&
    (allRecipes?.some((r) => !r.isStarter) ?? false) &&
    backupOverdue(settings.lastBackupAt)
  // 浮遊バナーの×で閉じたら、そのセッション中(タブを閉じるまで)は再表示しない
  // (2026-07-16 便S: インラインカードから画面上部の浮遊バナーへ変更)
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(
    () => sessionStorage.getItem(BACKUP_REMINDER_DISMISSED_KEY) === '1',
  )
  const dismissBackupReminder = () => {
    sessionStorage.setItem(BACKUP_REMINDER_DISMISSED_KEY, '1')
    setBackupReminderDismissed(true)
  }

  // アプリ内お知らせ: 起動時に同一オリジンで取得し、最新1件だけを未読なら表示する
  const [news, setNews] = useState<NewsItem[]>([])
  useEffect(() => {
    void fetchNews().then(setNews)
  }, [])
  const latestNews = news[0]
  // 初見ユーザーのファーストビューをお知らせで塞がない: 初回起動から24時間は出さない
  const showNews =
    settings !== undefined &&
    latestNews !== undefined &&
    latestNews.id !== settings.lastSeenNewsId &&
    !isNewsSuppressed(settings.firstLaunchAt, Date.now())
  const dismissNews = () => {
    if (latestNews) void updateSettings({ lastSeenNewsId: latestNews.id })
  }

  // 条件で絞り込んだ上で、今の季節に合うものを優先する
  const candidates = useMemo(() => {
    const byCondition = (recipes ?? []).filter((r) => matchesCondition(r, condition))
    return preferSeason(byCondition, currentSeason())
  }, [recipes, condition])

  // 「在庫の食材で」がONのとき、在庫(ある/少ない)の食材を1つ以上使うレシピに絞る。
  // 0件ならズレの不満を防ぐため通常候補にフォールバックし、その旨を表示する
  const { list: finalCandidates, fallback: pantryFallback } = useMemo(() => {
    if (!pantryOnly || pantryNames.length === 0) return { list: candidates, fallback: false }
    const wantedKeys = pantryNames.map(toHiragana)
    const filtered = candidates.filter((r) =>
      r.ingredients.some((i) => wantedKeys.some((k) => toHiragana(i.name).includes(k))),
    )
    return filtered.length > 0
      ? { list: filtered, fallback: false }
      : { list: candidates, fallback: true }
  }, [candidates, pantryOnly, pantryNames])

  const suggestion =
    finalCandidates.length > 0
      ? finalCandidates[Math.floor(seed * finalCandidates.length) % finalCandidates.length]
      : undefined

  // 最近作ったもの: 全レシピの「作った記録」を新しい順に5件
  const history = useMemo(() => {
    if (!recipes) return []
    return recipes
      .flatMap((recipe) => recipe.cookedLogs.map((log) => ({ recipe, log })))
      .sort((a, b) => b.log.date.localeCompare(a.log.date))
      .slice(0, 5)
  }, [recipes])

  const submitIngredients = () => {
    if (ingredients.length === 0) return
    navigate(`/recipes?ing=${encodeURIComponent(ingredients.join(' '))}`)
  }

  const widgetSections: Record<HomeWidgetKey, ReactNode> = {
    // 登録0品なら非表示(2026-07-16 便S。直近実装の「1行に薄く」表示を置き換え。
    // 読み込み中(todayListRecipesがundefined)も同様に何も出さない)
    mealPlan:
      hasTodayList ? (
        <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <h2 className="flex items-center gap-2 font-bold">
            <CalendarDays size={20} className="text-accent" aria-hidden />
            {ja.home.mealPlanTitle}
          </h2>
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-app">
            {/* state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
                RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(ホーム)へ
                戻るために参照する（2026-07-12オーナー指示） */}
            {todayListRecipes.map((recipe) => (
              <li key={recipe.id}>
                <Link
                  to={`/recipes/${recipe.id}`}
                  state={{ from: 'todayList', fromPath: '/' }}
                  className="flex items-center gap-2 px-[var(--space-md)] py-2"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null,
    // 今日の献立が1品以上あるときはウィジェットごと非表示(2026-07-16オーナー指示。
    // mealPlanウィジェットと常に排他=どちらか片方だけが表示される)
    suggestion: !hasTodayList ? (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="text-xl font-bold">{ja.home.suggestTitle}</h2>

        {recipes && recipes.length === 0 ? (
          <div className="mt-[var(--space-sm)] text-center">
            <p className="text-ink-muted">{ja.home.empty}</p>
            <Link
              to="/recipes/new"
              className="mt-[var(--space-md)] inline-block rounded-md bg-accent px-6 py-3 font-bold text-on-accent shadow-sm"
            >
              {ja.home.goRegister}
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
                {ja.home.conditionsToggle}
                {!conditionsOpen && condition !== 'any'
                  ? `: ${conditions.find((c) => c.value === condition)?.label}`
                  : ''}
                {conditionsOpen ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </button>
              {conditionsOpen && (
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
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {pantryNames.length > 0 && (
              <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                <button
                  type="button"
                  onClick={() => setPantryOnly((v) => !v)}
                  className={`inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                    pantryOnly
                      ? 'border-accent bg-accent text-on-accent'
                      : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  <Refrigerator size={14} aria-hidden />
                  {ja.home.pantryOnlyToggle}
                </button>
              </div>
            )}

            {pantryFallback && (
              <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
                {ja.home.pantryOnlyFallback}
              </p>
            )}

            {suggestion ? (
              <SuggestionCard recipe={suggestion} />
            ) : (
              <p className="mt-[var(--space-sm)] text-ink-muted">{ja.home.noCandidate}</p>
            )}

            <button
              type="button"
              onClick={() => setSeed(Math.random())}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
            >
              <Dices size={20} aria-hidden />
              {ja.home.shuffle}
            </button>
          </>
        )}
      </section>
    ) : null,
    ingredientSearch: (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <h2 className="flex items-center gap-2 font-bold">
          <Carrot size={20} className="text-accent" aria-hidden />
          {ja.home.ingShortcutTitle}
        </h2>
        <div className="mt-[var(--space-sm)]">
          <ChipInput
            values={ingredients}
            onChange={setIngredients}
            placeholder={ja.home.ingPlaceholder}
            addLabel={ja.home.ingAdd}
          />
          {pantryNames.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) => Array.from(new Set([...prev, ...pantryNames])))
              }
              className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm"
            >
              <Refrigerator size={16} aria-hidden />
              {ja.pantry.addToSearch}
            </button>
          )}
          <button
            type="button"
            onClick={submitIngredients}
            disabled={ingredients.length === 0}
            className="mt-[var(--space-sm)] w-full shrink-0 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-50"
          >
            {ja.home.ingButton}
          </button>
        </div>
      </section>
    ),
    history:
      history.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              <History size={20} className="text-accent" aria-hidden />
              {ja.home.historyTitle}
            </h2>
            <Link to="/history" className="text-sm font-bold text-accent underline">
              {ja.home.historyMore}
            </Link>
          </div>
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {history.map(({ recipe, log }, index) => (
              <li key={index}>
                <Link
                  to={`/recipes/${recipe.id}`}
                  className="flex items-center justify-between gap-2 px-[var(--space-md)] py-3"
                >
                  <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                  <span className="shrink-0 text-sm text-ink-muted">
                    {log.date.replaceAll('-', '/')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null,
  }

  const homeWidgets = settings?.homeWidgets ?? defaultHomeWidgets

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)] pb-[var(--space-lg)]">
      {/* バックアップの控えめなリマインド(2026-07-16 便S: インラインカードから画面上部の浮遊
          バナーへ変更。TimerBarと同じ「fixed inset-x-0 + mx-auto max-w-md」の浮遊パターンを
          上部に転用。タップで設定のバックアップタブへ(既存遷移流用)・×は行内にネストした
          role="button"(TimerBarの常駐バーの×ボタンと同じ構成)でタップ伝播を止めて閉じるだけにする。
          ×で閉じたらセッション中(sessionStorage)は再表示しない。表示条件(showBackupReminder)は
          従来のまま変更していない */}
      {showBackupReminder && !backupReminderDismissed && (
        <div
          className="fixed inset-x-0 z-10"
          style={{ top: 'calc(var(--space-sm) + env(safe-area-inset-top))' }}
        >
          <div className="mx-auto max-w-md px-[var(--space-md)]">
            <Link
              to="/settings?section=backup"
              className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm text-ink-muted shadow-md"
            >
              <HardDriveDownload size={16} className="shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1">{ja.home.backupReminder}</span>
              <span className="shrink-0 font-bold text-accent">{ja.home.backupReminderLink}</span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  dismissBackupReminder()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    e.stopPropagation()
                    dismissBackupReminder()
                  }
                }}
                aria-label={ja.common.close}
                className="-m-2 shrink-0 rounded-full p-2 text-ink-muted"
              >
                <X size={16} aria-hidden />
              </span>
            </Link>
          </div>
        </div>
      )}

      <h1 className="text-2xl font-bold">{ja.app.name}</h1>

      {/* アプリ内お知らせ（最新1件・未読のときだけ） */}
      {showNews && latestNews && (
        <div className="mt-[var(--space-sm)] flex items-start gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm shadow-sm">
          <Megaphone size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{latestNews.title}</p>
            <p className="text-ink-muted">{latestNews.body}</p>
            {latestNews.link && (
              // アプリ内のリンク(#/…)も外部リンクも同じタブで開く(PWAとしては別タブより自然)
              <a href={latestNews.link} className="font-bold text-accent underline">
                {ja.home.newsLinkLabel}
              </a>
            )}
          </div>
          {/* -m-2 + p-3.5: ×の見た目は16pxのまま、タップ領域を44px四方に広げる(バナーの高さは増やさない) */}
          <button
            type="button"
            onClick={dismissNews}
            aria-label={ja.common.close}
            className="-m-2 shrink-0 rounded-full p-3.5 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}

      {/* カスタマイズ可能なパーツ（設定でオン・オフ＆並べ替え） */}
      <div className="mt-[var(--space-md)] space-y-[var(--space-md)]">
        {homeWidgets.map((key) => (
          <div key={key}>{widgetSections[key]}</div>
        ))}
      </div>
    </div>
  )
}
