import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Clock,
  Dices,
  Heart,
  History,
  Search,
  HardDriveDownload,
  Refrigerator,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  CalendarDays,
  Megaphone,
  X,
} from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import { useSettings, updateSettings } from '../db/settings'
import { fetchNews, isNewsSuppressed, isNewsVisibleFor, type NewsItem } from '../logic/news'
import { usePantryItems } from '../db/pantry'
import { pantryAvailableNames } from '../logic/pantry'
import { useTodayList } from '../db/todayList'
import { backupOverdue } from '../logic/backup'
import { cookedWithinDays } from '../logic/cooked'
import { currentSeason } from '../logic/season'
import { DISH_TYPE_OPTIONS, suggestionCandidates } from '../logic/homeSuggest'
import { todayListPickedIds, excludeYesterdayPlanRecipes, MEAL_SLOTS } from '../logic/mealPlan'
import { useMealPlanRange } from '../db/mealPlan'
import { todayString } from '../logic/date'
import { makePantryMatcher } from '../logic/pantry'
import type { CookedLog, DishType, HomeWidgetKey, MealSlot, Recipe } from '../db/types'
import { defaultHomeWidgets } from '../db/types'
import Collapse from '../components/Collapse'
import HomeScreenNotice from '../components/HomeScreenNotice'
import { shouldShowHomeScreenNoticeNow } from '../logic/homeScreenNotice'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import CookedLogDetailModal, {
  type CookedLogDetailTarget,
} from '../components/CookedLogDetailModal'
import { useScrollRestore } from '../components/useScrollRestore'
import { settingsLinkWithBack } from '../logic/backLink'
import {
  HOME_RETURN_KEY,
  parseViewReturn,
  readSessionItem,
  removeSessionItem,
  serializeViewReturn,
  writeSessionItem,
} from '../logic/navMemory'
import { ja } from '../i18n/ja'

// バックアップ浮遊バナーの「×で閉じたらセッション中は再表示しない」用キー(2026-07-16 便S)。
// sessionStorageなのでタブ/アプリを閉じれば消え、次回起動時はまた条件を満たせば出る
const BACKUP_REMINDER_DISMISSED_KEY = 'uchirecipe:backupReminderDismissed'

type SuggestCondition = 'any' | 'notRecent' | 'favorite' | 'quick'

const conditions: { value: SuggestCondition; label: string }[] = [
  { value: 'any', label: ja.home.condAll },
  { value: 'notRecent', label: ja.home.condNotRecent },
  { value: 'favorite', label: ja.home.condFavorite },
  // condQuickは '{n}分以内' テンプレート。{n}には選択中の分数が入る(2026-07-24 便BN・タスク7)
  { value: 'quick', label: ja.home.condQuick },
]

// 「◯分以内」で選べる分数(2026-07-24 便BN・タスク7)。既定は先頭の10分
const QUICK_MINUTES_OPTIONS = [10, 15, 20, 30] as const

/**
 * 「今日なに作る？」で選べる料理の種別の既定(2026-08-03 便DH・オーナー指示)。
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
            <Heart size={14} className="text-accent-ink" fill="currentColor" aria-hidden />
          )}
        </div>
      </div>
    </Link>
  )
}

/**
 * ホーム「今日の献立」ウィジェットの1行（献立タブTodayListRowと同様の小サムネを表示。
 * 2026-07-16 便W-④）。usePhotoUrlはループ内で直接呼べないため専用コンポーネントに分離
 */
function HomeTodayListItem({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  return (
    <li>
      {/* state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
          RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(ホーム)へ
          戻るために参照する（2026-07-12オーナー指示） */}
      <Link
        to={`/recipes/${recipe.id}`}
        state={{ from: 'todayList', fromPath: '/' }}
        className="flex items-center gap-2 px-[var(--space-md)] py-2"
      >
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <RecipePlaceholder recipe={recipe} iconSize={20} />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
      </Link>
    </li>
  )
}

/**
 * 「最近作ったもの」の1件（2026-07-16 便W-②③）。
 * ③サムネは記録に添付された写真を優先し、無ければレシピ写真→アイコンにフォールバック。
 * usePhotoUrlはループ内で直接呼べないため専用コンポーネントに分離
 *
 * 2026-08-09 便EQ（オーナー実機）: 料理名を押すとレシピ詳細へ移っていたが、見たいのは
 * その日の記録そのものだったため、押すと「作った記録」の小窓が開くようにした
 * （小窓の中からレシピ詳細と記録の編集へ行ける）。
 */
function HistoryCard({
  recipe,
  log,
  onOpen,
}: {
  recipe: Recipe
  log: CookedLog
  onOpen: () => void
}) {
  const logPhotoUrl = usePhotoUrl(log.photo)
  const recipePhotoUrl = usePhotoUrl(recipe.photo)
  const photoUrl = logPhotoUrl ?? recipePhotoUrl
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-label={ja.cookedDetail.openAria.replace('{title}', recipe.title)}
        className="flex w-full items-center gap-[var(--space-sm)] px-[var(--space-md)] py-3 text-left"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm">
          {photoUrl ? (
            <img src={photoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <RecipePlaceholder recipe={recipe} iconSize={20} />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
        <span className="shrink-0 text-sm text-ink-muted">{log.date.replaceAll('-', '/')}</span>
      </button>
    </li>
  )
}

/**
 * ホーム: 表示パーツは設定でオン・オフ＆並べ替えできる。
 * 検索窓は2026-07-16 便Sでホームから削除し、2026-08-02（便CR）に残っていた食材の検索欄も撤去した。
 * 探す操作はレシピタブ1か所にまとめ、ホームにはそこへ渡すショートカットだけを置く
 */
export default function HomePage() {
  const navigate = useNavigate()
  // Pro案内・設定への入口から飛んだあと、この画面へ帰れるようにするための現在地(2026-08-02 便DF)
  const location = useLocation()
  const allRecipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()

  /**
   * 「作った記録の一覧」へ移る直前に、ホームの縦スクロール位置を覚える（2026-08-09 便EQ）。
   * 一覧の「戻る」は `/?restore=1` へ帰ってくるので、下の復元処理が同じ場所まで戻す。
   * 覚えるのは sessionStorage だけ＝端末に残るユーザーデータには何も書かない。
   */
  const rememberHomeReturn = () => {
    writeSessionItem(HOME_RETURN_KEY, serializeViewReturn({ anchor: '', scrollY: window.scrollY }))
  }

  // 一覧から帰ってきたときだけ、覚えた縦位置まで戻す(便EQ)。復元に使ったクエリはURLから消す
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(null)
  const restoreCheckedRef = useRef(false)
  useEffect(() => {
    if (restoreCheckedRef.current) return
    restoreCheckedRef.current = true
    if (searchParams.get('restore') !== '1') return
    const point = parseViewReturn(readSessionItem(HOME_RETURN_KEY))
    removeSessionItem(HOME_RETURN_KEY)
    if (point) setPendingScrollY(point.scrollY)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('restore')
        return next
      },
      { replace: true },
    )
  }, [searchParams, setSearchParams])
  useScrollRestore(pendingScrollY, true, () => setPendingScrollY(null))

  const [condition, setCondition] = useState<SuggestCondition>('any')
  // 条件チップ4つの折りたたみ(2026-07-16 UI総点検B-5: 常時全展開がゴチャつきの一因。既定閉。
  // MealPlanPage「提案の条件」と同じパターン)
  const [conditionsOpen, setConditionsOpen] = useState(false)
  // 「今日なに作る?」の種別しぼり(2026-07-23 便BH-2「主菜」トグル → 2026-08-03 便DHで4区分の
  // 複数選択へ)。既定は主菜だけ=献立の中心になる主菜(肉・魚・卵・豆腐が主役)を提案し、
  // 「1品ランダムに副菜が出てがっかり」を防ぐ。副菜・汁物・その他も足して選べる。
  // 選んだ種別に合う品が0件になる場合は0件回避で全体から選ぶ
  const [dishTypes, setDishTypes] = useState<DishType[]>(DEFAULT_DISH_TYPES)
  const toggleDishType = (type: DishType) =>
    setDishTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  const [pantryOnly, setPantryOnly] = useState(false)
  const [seed, setSeed] = useState(() => Math.random())
  // 「ほかの候補を見る」で直近に出した候補(2026-07-29 便CD/MP-12)。押すたびに積んで、
  // その分は次の抽選から外す＝同じ料理が続けて出るのを防ぐ
  const [recentSuggestedIds, setRecentSuggestedIds] = useState<number[]>([])
  // 「◯分以内」で選んだ分数(2026-07-24 便BN・タスク7)。設定に記憶し、未設定は10分扱い
  const quickMinutes = settings?.homeQuickMinutes ?? 10
  // 「◯分以内」チップのラベルは選択中の分数を差し込む。他の条件はそのままのラベルを使う
  const conditionLabel = (value: SuggestCondition): string => {
    const base = conditions.find((c) => c.value === value)?.label ?? ''
    return value === 'quick' ? base.replace('{n}', String(quickMinutes)) : base
  }
  const pantryItems = usePantryItems()
  const pantryNames = useMemo(() => pantryAvailableNames(pantryItems ?? []), [pantryItems])

  // 「基本レシピを表示しない」設定を反映
  const recipes = useMemo(() => {
    if (!allRecipes) return undefined
    return settings?.hideStarters ? allRecipes.filter((r) => !r.isStarter) : allRecipes
  }, [allRecipes, settings?.hideStarters])

  // 登録済みの「今日の献立」を引き当てる表は全レシピから作る(2026-07-30 便CH/C7)。
  // hideStartersを反映すると、設定をONにした瞬間に今日の献立に入れた基本レシピが
  // 画面から消える(登録は残っているのに無かったことになる)。設定は一覧・提案の話なので、
  // 「選ぶ対象」(下のrecipes)にだけ効かせる
  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    allRecipes?.forEach((r) => map.set(r.id!, r))
    return map
  }, [allRecipes])

  // 今日の献立（週間プランナーとは別の「今日これ作る」リスト）
  const todayList = useTodayList()
  const todayListRecipes = useMemo(() => {
    if (!todayList) return undefined
    return todayList
      .map((item) => recipeById.get(item.recipeId))
      .filter((r): r is Recipe => r !== undefined)
  }, [todayList, recipeById])

  /**
   * ホームの「今日の献立」を2つの内訳に分けて出す（2026-08-03 便DH・オーナー指示。
   * 2026-08-02 便DE-1の「todayListを朝昼夜に振り分ける」形を差し替え）。
   *
   *   ①「レシピ一覧から選択中」… todayList のうち今日の週の予定に無い分（食事は決めない）
   *   ②「今週の献立の予定」    … 今日の週の予定そのもの（朝食・昼食・夕食）
   *
   * 両方をそれぞれ折りたたみ可能にして**両方とも**並べる（従来はtodayList側しか出ていなかった）。
   * 既定は①だけを開き、①が0品のときは②を開く＝開いた先が空になるのを避ける。
   * 日タブの自動取り込み（便U-3）で今日の予定は todayList にも入るため、todayList から
   * 予定ぶんを引いたものが①になる（logic/mealPlan.ts の todayListPickedIds）。
   */
  const today = useMemo(() => todayString(), [])
  const todayPlanEntries = useMealPlanRange(today, today)
  const todayPlanRecipeIds = useMemo(
    () => Array.from(new Set((todayPlanEntries ?? []).map((e) => e.recipeId))),
    [todayPlanEntries],
  )
  const pickedRecipes = useMemo(() => {
    if (!todayListRecipes) return []
    const pickedIds = todayListPickedIds(
      todayListRecipes.map((r) => r.id!),
      todayPlanRecipeIds,
    )
    return todayListRecipes.filter((r) => pickedIds.includes(r.id!))
  }, [todayListRecipes, todayPlanRecipeIds])
  /**
   * 今日の予定を朝食→昼食→夕食の順にまとめる。
   * 「表示する食事」の設定では絞らない（2026-07-30 便CH/C7と同じ切り分け＝設定は
   * 「選ぶ・提案する対象」に効かせ、登録済みの予定は隠さない）。
   */
  const plannedGroups = useMemo(() => {
    const bySlot = new Map<MealSlot, Recipe[]>()
    todayPlanEntries?.forEach((e) => {
      const recipe = recipeById.get(e.recipeId)
      if (!recipe) return
      const list = bySlot.get(e.slot)
      if (list) {
        if (!list.some((r) => r.id === recipe.id)) list.push(recipe)
      } else bySlot.set(e.slot, [recipe])
    })
    return MEAL_SLOTS.map((slot) => ({ slot, recipes: bySlot.get(slot) ?? [] })).filter(
      (g) => g.recipes.length > 0,
    )
  }, [todayPlanEntries, recipeById])

  // 折りたたみの開閉。nullのあいだは上のルール(①を開く・①が0品なら②)で決まり、
  // ユーザーが一度でも押したらその選択を優先する
  const [pickedOpenState, setPickedOpenState] = useState<boolean | null>(null)
  const [plannedOpenState, setPlannedOpenState] = useState<boolean | null>(null)
  const hasPicked = pickedRecipes.length > 0
  const pickedOpen = pickedOpenState ?? hasPicked
  const plannedOpen = plannedOpenState ?? !hasPicked
  // 「今日の献立」ウィジェットが出るか(どちらかに1品以上)
  const hasTodayPlanOrPick = hasPicked || plannedGroups.length > 0
  /**
   * 「今日なに作る?」を出すか（2026-08-03 便DH・オーナー指示）。
   * 判定材料を「今日の献立(todayList)が空か」から「**今週の献立に今日の予定があるか**」へ変えた。
   * 予定が立っている日は作るものが決まっているので提案を重ねない。予定が無ければ、
   * レシピ一覧から選択中の品があっても提案は出す（1品決めただけで提案が消えていた）。
   * 設定で「常に表示」を選んでいるときは予定があっても出す。
   */
  const showSuggestion = settings?.homeSuggestionAlways === true || todayPlanRecipeIds.length === 0

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
  // 初見ユーザーのファーストビューをお知らせで塞がない: 初回起動から24時間は出さない。
  // 2026-08-04 便DV-10(オーナー指摘): Pro版を解錠済みの人には、販売のお知らせは出さない
  const showNews =
    settings !== undefined &&
    latestNews !== undefined &&
    latestNews.id !== settings.lastSeenNewsId &&
    isNewsVisibleFor(latestNews, !!settings.proCode) &&
    !isNewsSuppressed(settings.firstLaunchAt, Date.now())
  const dismissNews = () => {
    if (latestNews) void updateSettings({ lastSeenNewsId: latestNews.id })
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

  // 直前に出た候補を「ほかの候補を見る」の対象から外す(2026-07-29 便CD/MP-12)。
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
  // 「ほかの候補を見る」: 今出ている候補を直近リストへ積んでから振り直す
  const shuffleSuggestion = () => {
    if (suggestion?.id != null) {
      const shownId = suggestion.id
      setRecentSuggestedIds((prev) =>
        [shownId, ...prev.filter((id) => id !== shownId)].slice(0, RECENT_SUGGEST_KEEP),
      )
    }
    setSeed(Math.random())
  }

  // 最近作ったもの: 全レシピの「作った記録」を新しい順に5件。
  // logIndex（recipe.cookedLogs の何番目か）も持ち回る＝小窓から記録の編集へ渡すため(便EQ)
  const history = useMemo(() => {
    if (!recipes) return []
    return recipes
      .flatMap((recipe) => recipe.cookedLogs.map((log, logIndex) => ({ recipe, log, logIndex })))
      .sort((a, b) => b.log.date.localeCompare(a.log.date))
      .slice(0, 5)
  }, [recipes])

  // 押した記録の中身を出す小窓(2026-08-09 便EQ)。null なら閉じている
  const [logDetail, setLogDetail] = useState<CookedLogDetailTarget | null>(null)

  /**
   * ホーム画面への追加を案内する初回のお知らせ(2026-08-10 便EW)。
   * 出す条件（指で操作する端末のブラウザ・アイコン起動でない・この端末で未表示）は
   * logic/homeScreenNotice.ts が持つ。ここでは画面に着いた時点で1度だけ判定する
   * ＝この画面を開いている間に判定が揺れて出たり消えたりしない。
   * 見た記録はlocalStorage(端末内のみ)で、閉じ方によらず窓側で残す
   */
  const [showHomeScreenNotice, setShowHomeScreenNotice] = useState(shouldShowHomeScreenNoticeNow)

  const widgetSections: Record<HomeWidgetKey, ReactNode> = {
    // 選択中も今日の予定も0品なら非表示(2026-07-16 便S。直近実装の「1行に薄く」表示を置き換え。
    // 読み込み中も同様に何も出さない)
    mealPlan:
      hasTodayPlanOrPick ? (
        <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <h2 className="flex items-center gap-2 font-bold">
            <CalendarDays size={20} className="text-accent-ink" aria-hidden />
            {ja.home.mealPlanTitle}
          </h2>

          {/* ①レシピ一覧から選択中(2026-08-03 便DH)。食事は決めない＝朝昼夜に分けない */}
          {hasPicked && (
            <div className="mt-[var(--space-sm)]">
              <button
                type="button"
                data-testid="home-today-picked-toggle"
                onClick={() => setPickedOpenState(!pickedOpen)}
                aria-expanded={pickedOpen}
                className="flex w-full items-center gap-1 py-1 text-left text-sm font-bold text-ink-muted"
              >
                <span className="min-w-0 flex-1">
                  {ja.mealPlan.todayPickedLabel}（{pickedRecipes.length}）
                </span>
                {pickedOpen ? (
                  <ChevronUp size={16} className="shrink-0" aria-hidden />
                ) : (
                  <ChevronDown size={16} className="shrink-0" aria-hidden />
                )}
              </button>
              <Collapse open={pickedOpen}>
                <ul className="divide-y divide-edge rounded-md border border-edge bg-app">
                  {pickedRecipes.map((recipe) => (
                    <HomeTodayListItem key={recipe.id} recipe={recipe} />
                  ))}
                </ul>
              </Collapse>
            </div>
          )}

          {/* ②今週の献立の予定(2026-08-02 便DE-1 → 便DHで折りたたみの中へ)。
              食事の見出しを押すと「週」タブのその日まで送る */}
          {plannedGroups.length > 0 && (
            <div className="mt-[var(--space-sm)]">
              <button
                type="button"
                data-testid="home-today-planned-toggle"
                onClick={() => setPlannedOpenState(!plannedOpen)}
                aria-expanded={plannedOpen}
                className="flex w-full items-center gap-1 py-1 text-left text-sm font-bold text-ink-muted"
              >
                <span className="min-w-0 flex-1">{ja.mealPlan.todayPlannedLabel}</span>
                {plannedOpen ? (
                  <ChevronUp size={16} className="shrink-0" aria-hidden />
                ) : (
                  <ChevronDown size={16} className="shrink-0" aria-hidden />
                )}
              </button>
              <Collapse open={plannedOpen}>
                {plannedGroups.map(({ slot, recipes: slotRecipes }) => (
                  <div key={slot} className="mt-1">
                    <button
                      type="button"
                      data-testid="home-today-slot"
                      onClick={() => navigate(`/meal-plan?focus=week&date=${today}`)}
                      aria-label={ja.home.todaySlotOpenWeek.replace('{slot}', ja.mealPlan.slot[slot])}
                      className="flex w-full items-center gap-1 py-1 text-left text-sm font-bold text-accent-ink"
                    >
                      <span className="min-w-0 flex-1">{ja.mealPlan.slot[slot]}</span>
                      <ChevronRight size={16} className="shrink-0" aria-hidden />
                    </button>
                    <ul className="divide-y divide-edge rounded-md border border-edge bg-app">
                      {slotRecipes.map((recipe) => (
                        <HomeTodayListItem key={recipe.id} recipe={recipe} />
                      ))}
                    </ul>
                  </div>
                ))}
              </Collapse>
            </div>
          )}

          {/* 献立の画面への行き先(2026-08-10 便FF・オーナー指示「今日の献立の下に、
              献立ページへ移動リンクをつけたい。ボタンだと無駄に目立ってしまう」)。
              「最近作ったもの」の「作った記録の一覧」と同じ、下線つきの文字リンクで出す
              ＝ウィジェットの中で行き先を示す形をそろえる。日の献立を見に行くので
              「日」の表示で開く(?focus=today。献立の画面が既定で開くのと同じ表示) */}
          <div className="mt-[var(--space-sm)] flex justify-end">
            <Link
              to="/meal-plan?focus=today"
              data-testid="home-mealplan-link"
              className="inline-flex items-center gap-0.5 text-sm font-bold text-accent-ink underline"
            >
              {ja.home.mealPlanMore}
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
        </section>
      ) : null,
    // 今週の献立に今日の予定があるときは非表示(2026-08-03 便DH・オーナー指示)。
    // 設定「常に表示」を選んでいれば予定があっても出す
    suggestion: showSuggestion ? (
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
                      <p className="text-xs text-ink-muted">{ja.home.quickMinutesLabel}</p>
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
                            {ja.home.condQuick.replace('{n}', String(m))}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* 料理の種別(2026-08-03 便DH・オーナー指示)。旧「主菜」トグル1つを
                      レシピ登録と同じ4区分の複数選択にし、置き場所も「条件をしぼる」の中へ移した */}
                  <div className="mt-[var(--space-sm)]">
                    <p className="text-xs text-ink-muted">{ja.home.dishTypeLabel}</p>
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
                在庫にある食材を使うレシピに絞る(在庫が1件以上あるときだけ出す)。
                2026-08-03 便DH: 隣にあった「主菜」は「条件をしぼる」の中の種別チップへ移した */}
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
                  {ja.home.pantryOnlyToggle}
                </button>
              )}
            </div>

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

            {/* 2026-08-03 便DH(オーナー指示): 「ほかの候補を見る」→「ランダムで選ぶ」に改名し、
                既存のCTAと同じオレンジ地・白字(bg-accent/text-on-accent)にする */}
            <button
              type="button"
              onClick={shuffleSuggestion}
              className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
            >
              <Dices size={20} aria-hidden />
              {ja.home.shuffle}
            </button>
            {/* いま候補が何品あるか(2026-08-02 便DE-5・オーナー指示)。候補が少ない条件では
                振り直しても同じ料理が続けて出るので、その理由が数字で分かるようにする */}
            <p className="mt-1 text-center text-xs text-ink-muted">
              {ja.common.candidateCount.replace('{n}', String(finalCandidates.length))}
            </p>
          </>
        )}
      </section>
    ) : null,
    // レシピを探すショートカット(2026-08-02 オーナー実機FB・司令部裁定)。
    // 旧「使いたい食材から探す」の検索欄(ChipInput+この食材で探す)はここから撤去し、
    // 検索の入口はレシピタブ1か所にまとめた。ホームには「レシピタブで探せる」と伝える
    // 導線だけを残す(入口を消すと発見性が落ちるため、集約と発見性を両立させる)。
    // ウィジェットのキーは既存の'ingredientSearch'のまま＝保存済みの並び順・表示設定を壊さない
    ingredientSearch: (
      <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <p className="text-sm text-ink-muted">{ja.home.searchShortcutDescription}</p>
        <button
          type="button"
          onClick={() => navigate('/recipes?focus=search')}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
        >
          <Search size={20} aria-hidden />
          {ja.home.searchShortcutButton}
        </button>
        {/* 在庫から探す導線は「在庫の食材で絞る」をONにした状態でレシピタブへ渡す(絞り込み付きの遷移)。
            在庫が1件も無いときは押しても結果が変わらないので出さない */}
        {pantryNames.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/recipes?pantry=1')}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
          >
            <Refrigerator size={20} aria-hidden />
            {ja.home.searchShortcutPantry}
          </button>
        )}
      </section>
    ),
    history:
      history.length > 0 ? (
        <section>
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-bold">
              <History size={20} className="text-accent-ink" aria-hidden />
              {ja.home.historyTitle}
            </h2>
            {/* 一覧へ移る直前にホームの縦位置を覚え、一覧の「戻る」で同じ場所へ帰す(便EQ) */}
            <Link
              to="/history?back=home"
              onClick={rememberHomeReturn}
              className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-accent-ink underline"
            >
              {ja.home.historyMore}
              <ChevronRight size={16} aria-hidden />
            </Link>
          </div>
          <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
            {history.map(({ recipe, log, logIndex }, index) => (
              <HistoryCard
                key={index}
                recipe={recipe}
                log={log}
                onOpen={() => setLogDetail({ recipe, log, logIndex })}
              />
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
          data-app-top-bar
          className="fixed inset-x-0 z-10"
          style={{ top: 'calc(var(--space-sm) + env(safe-area-inset-top))' }}
        >
          <div className="mx-auto max-w-md px-[var(--space-md)]">
            <Link
              to={settingsLinkWithBack('/settings?section=backup', location.pathname + location.search)}
              className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm text-ink-muted shadow-md"
            >
              <HardDriveDownload size={16} className="shrink-0 text-accent-ink" aria-hidden />
              <span className="min-w-0 flex-1">{ja.home.backupReminder}</span>
              <span className="shrink-0 font-bold text-accent-ink">{ja.home.backupReminderLink}</span>
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

      {/* アプリ内お知らせ（最新1件・未読のときだけ）。
          2026-08-04 便DV-10(オーナー指摘): 紹介ページの「無料で使ってみる」から来た人の
          ファーストビューでいちばん目立つのが有料版の案内では押し売りに見える。
          カード(bg-surface+影+アクセント色のアイコン)をやめ、ページ地の上の控えめな囲みにする */}
      {showNews && latestNews && (
        <div className="mt-[var(--space-sm)] flex items-start gap-2 rounded-md border border-edge bg-app px-[var(--space-md)] py-2 text-sm">
          <Megaphone size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{latestNews.title}</p>
            <p className="text-ink-muted">{latestNews.body}</p>
            {latestNews.link && (
              // アプリ内のリンク(#/…)も外部リンクも同じタブで開く(PWAとしては別タブより自然)
              <a href={latestNews.link} className="text-ink-muted underline">
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

      {/* 「最近作ったもの」の料理名を押したときに開く記録の小窓(2026-08-09 便EQ)。
          レシピ詳細へ移るときは、戻ってきたらホームへ帰す出所を持たせる(便W-②と同じ仕組み) */}
      {logDetail && (
        <CookedLogDetailModal
          target={logDetail}
          onClose={() => setLogDetail(null)}
          linkState={{ from: 'home', fromPath: '/' }}
          onNavigate={() => setLogDetail(null)}
        />
      )}

      {/* ホーム画面への追加の案内(2026-08-10 便EW)。紹介ページ側の割り込みを廃し、
          ホーム画面に着いた直後の1回だけここで出す */}
      {showHomeScreenNotice && (
        <HomeScreenNotice onClose={() => setShowHomeScreenNotice(false)} />
      )}
    </div>
  )
}
