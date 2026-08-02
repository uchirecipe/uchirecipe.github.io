import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import type { CookedLog, Recipe } from '../db/types'
import BackHeader from '../components/BackHeader'
import { RecipePlaceholder } from '../components/RecipeCard'
import { usePhotoUrl } from '../components/usePhotoUrl'
import { ja } from '../i18n/ja'

/** 1回に描く件数（2026-07-29 便CI/C03）。「もっと見る」で同じ数ずつ増やす */
const PAGE_SIZE = 30

/**
 * 履歴1行（2026-07-29 便CI/C04）。
 * ホームの「最近作ったもの」（HomePage の HistoryCard）と同じく、記録の写真→レシピ写真→
 * アイコンの順にフォールバックしてサムネイルを出す。同じ記録なのに履歴だけ文字だけで、
 * 「名前を忘れた料理を写真から探す」動線が成立していなかった。
 * usePhotoUrl はループ内で直接呼べないため行コンポーネントに分離し、
 * 画像は loading="lazy" にして画面外の分をデコードさせない（記録は件数無制限のため）。
 */
function HistoryRow({ recipe, log }: { recipe: Recipe; log: CookedLog }) {
  const logPhotoUrl = usePhotoUrl(log.photo)
  const recipePhotoUrl = usePhotoUrl(recipe.photo)
  const photoUrl = logPhotoUrl ?? recipePhotoUrl
  return (
    <li>
      <Link
        to={`/recipes/${recipe.id}`}
        className="flex items-center gap-[var(--space-sm)] px-[var(--space-md)] py-3"
      >
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm">
          {photoUrl ? (
            <img src={photoUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <RecipePlaceholder recipe={recipe} iconSize={20} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{recipe.title}</p>
          {log.note && <p className="mt-0.5 truncate text-sm text-ink-muted">{log.note}</p>}
        </div>
        <span className="shrink-0 text-right text-sm text-ink-muted">
          {log.date.replaceAll('-', '/')}
          {/* 記録した人数(2026-07-29 便CI/C05)。献立の「作った記録の食費」の分母になる値 */}
          {log.servings != null && (
            <span className="block">
              {ja.detail.cookedServingsValue.replace('{n}', String(log.servings))}
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

/** 「作った記録」の全履歴。全レシピのcookedLogsを日付降順・月区切りで一覧表示する */
/**
 * 呼び出し元へ戻すための行き先（2026-08-02 便DE-11・オーナー指示）。
 * 献立の週タブ／月タブから開いたときは ?back=week / ?back=month が付いてくる。
 * これが無いときは従来どおり（ブラウザ履歴があれば1つ戻る・無ければホーム）。
 *
 * 直った問題: 週タブの「過去の記録を見る」→ 記録一覧 → 戻る、で献立タブの「日」に落ちていた。
 * 履歴を1つ戻るだけでは献立タブのタブ状態（日/週/月）までは戻らないため、
 * 開いた場所を持ち回って、そのタブを指定して戻す。
 */
function backTargetOf(back: string | null): string | null {
  if (back === 'week') return '/meal-plan?focus=week'
  if (back === 'month') return '/meal-plan?focus=month'
  return null
}

export default function HistoryPage() {
  const recipes = useLiveQuery(listRecipes, [])
  // レシピ詳細の「すべて見る（他◯件）」からの絞り込み(2026-07-29 便CI/C03)
  const [searchParams] = useSearchParams()
  const backTarget = backTargetOf(searchParams.get('back'))
  const filterRecipeId = Number(searchParams.get('recipe'))
  const hasFilter = Number.isFinite(filterRecipeId) && searchParams.get('recipe') !== null
  const filterRecipe = hasFilter ? recipes?.find((r) => r.id === filterRecipeId) : undefined

  const [shownCount, setShownCount] = useState(PAGE_SIZE)

  const entries = useMemo(() => {
    if (!recipes) return undefined
    const target = hasFilter ? recipes.filter((r) => r.id === filterRecipeId) : recipes
    return target
      .flatMap((recipe) => recipe.cookedLogs.map((log) => ({ recipe, log })))
      .sort((a, b) => b.log.date.localeCompare(a.log.date))
  }, [recipes, hasFilter, filterRecipeId])

  // 表示する分だけを月区切りにまとめる（残りは「もっと見る」で足す）
  const groups = useMemo(() => {
    if (!entries) return undefined
    const map = new Map<string, typeof entries>()
    for (const entry of entries.slice(0, shownCount)) {
      const monthKey = entry.log.date.slice(0, 7) // YYYY-MM
      const list = map.get(monthKey)
      if (list) list.push(entry)
      else map.set(monthKey, [entry])
    }
    return Array.from(map.entries())
  }, [entries, shownCount])

  const remaining = entries ? Math.max(0, entries.length - shownCount) : 0

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader
        fallback={backTarget ?? '/'}
        alwaysFallback={backTarget != null}
        title={ja.history.title}
      />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        {/* 絞り込み中であることと、その外し方を必ず出す(便CI/C03) */}
        {hasFilter && (
          <div className="mb-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm">
            <p className="text-sm font-bold">
              {filterRecipe
                ? ja.history.filteredBy.replace('{title}', filterRecipe.title)
                : ja.history.filteredNotFound}
            </p>
            <Link to="/history" className="mt-1 inline-block text-sm font-bold text-accent-ink underline">
              {ja.history.filteredClear}
            </Link>
          </div>
        )}

        {entries && entries.length > 0 && (
          <p className="text-sm text-ink-muted">
            {ja.history.countLabel.replace('{n}', String(entries.length))}
          </p>
        )}
        {groups && groups.length === 0 && (
          <p className="text-center text-ink-muted">{ja.history.empty}</p>
        )}
        {groups?.map(([monthKey, monthEntries]) => {
          const [y, m] = monthKey.split('-')
          return (
            <section key={monthKey} className="mt-[var(--space-md)] first:mt-0">
              <h2 className="font-bold text-ink-muted">
                {ja.history.monthFormat.replace('{y}', y).replace('{m}', String(Number(m)))}
              </h2>
              <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {monthEntries.map(({ recipe, log }, index) => (
                  <HistoryRow key={`${recipe.id}-${log.date}-${index}`} recipe={recipe} log={log} />
                ))}
              </ul>
            </section>
          )
        })}
        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setShownCount((n) => n + PAGE_SIZE)}
            className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
          >
            {ja.history.more.replace('{n}', String(remaining))}
          </button>
        )}
      </div>
    </div>
  )
}
