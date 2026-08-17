import { useMemo } from 'react'
import { History } from 'lucide-react'
import type { CookedLog, Recipe } from '../db/types'
import { RecipePlaceholder } from './RecipeCard'
import { usePhotoUrl } from './usePhotoUrl'
import type { CookedLogDetailTarget } from './CookedLogDetailModal'
import { ja } from '../i18n/ja'

/** 一覧に出す件数（新しい順）。全部見るときは「作った記録の一覧」へ */
const RECENT_COUNT = 5

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
  deleted,
  onOpen,
}: {
  recipe: Recipe
  log: CookedLog
  /** レシピを削除したあとも残っている記録か（2026-08-16 便GZ） */
  deleted?: boolean
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
        <span className="min-w-0 flex-1 truncate">
          <span className="block truncate font-bold">{recipe.title}</span>
          {/* レシピが端末に無いことを一覧の時点で分かるようにする（2026-08-16 便GZ） */}
          {deleted && (
            <span className="block truncate text-sm text-ink-muted">
              {ja.cookedDetail.deletedRecipeLabel}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm text-ink-muted">{log.date.replaceAll('-', '/')}</span>
      </button>
    </li>
  )
}

/**
 * 「最近作ったもの」（新しい順に5件）。
 *
 * 2026-08-17 便HG: ホーム画面の廃止にともない、置き場所をホームから献立の「日」へ移した。
 * オーナー指示により、**その日の献立があってもなくても常に出す**。
 * 記録が1件も無いうちは見出しごと出さない（空の見出しだけが残らないようにする）。
 *
 * 全件を見る入口（「作った記録の一覧」）は献立の「日」がこの下に持っているので、
 * ここには置かない（同じ行き先のリンクを近くに2つ並べない）。
 */
export default function RecentCookedList({
  recipes,
  detachedEntries,
  onOpen,
}: {
  /** 対象のレシピ（「基本レシピを表示しない」設定を反映済み。読み込み中は undefined） */
  recipes: Recipe[] | undefined
  /** レシピを削除しても残っている記録（2026-08-16 便GZ）。読み込み中は undefined */
  detachedEntries: CookedLogDetailTarget[] | undefined
  onOpen: (entry: CookedLogDetailTarget) => void
}) {
  // 全レシピの「作った記録」を新しい順に。logIndex（recipe.cookedLogs の何番目か）も
  // 持ち回る＝小窓から記録の編集へ渡すため(便EQ)
  const history = useMemo(() => {
    if (!recipes) return []
    const own: CookedLogDetailTarget[] = recipes.flatMap((recipe) =>
      recipe.cookedLogs.map((log, logIndex) => ({ recipe, log, logIndex })),
    )
    // レシピを削除したあとも残っている記録も同じ並びに混ぜる（2026-08-16 便GZ）。
    // 混ぜないと、削除した直後に「最近作ったもの」から料理が1つ消えたように見える
    return [...own, ...(detachedEntries ?? [])]
      .sort((a, b) => b.log.date.localeCompare(a.log.date))
      .slice(0, RECENT_COUNT)
  }, [recipes, detachedEntries])

  if (history.length === 0) return null

  return (
    <section className="mt-[var(--space-md)]">
      <h2 className="flex items-center gap-2 font-bold">
        <History size={20} className="text-accent-ink" aria-hidden />
        {ja.dayStart.historyTitle}
      </h2>
      <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
        {history.map((entry, index) => (
          <HistoryCard
            key={index}
            recipe={entry.recipe}
            log={entry.log}
            deleted={entry.detachedRecordId != null}
            onOpen={() => onOpen(entry)}
          />
        ))}
      </ul>
    </section>
  )
}
