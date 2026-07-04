import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import BackHeader from '../components/BackHeader'
import { ja } from '../i18n/ja'

/** 「作った記録」の全履歴。全レシピのcookedLogsを日付降順・月区切りで一覧表示する */
export default function HistoryPage() {
  const recipes = useLiveQuery(listRecipes, [])

  const groups = useMemo(() => {
    if (!recipes) return undefined
    const all = recipes
      .flatMap((recipe) => recipe.cookedLogs.map((log) => ({ recipe, log })))
      .sort((a, b) => b.log.date.localeCompare(a.log.date))

    const map = new Map<string, typeof all>()
    for (const entry of all) {
      const monthKey = entry.log.date.slice(0, 7) // YYYY-MM
      const list = map.get(monthKey)
      if (list) list.push(entry)
      else map.set(monthKey, [entry])
    }
    return Array.from(map.entries())
  }, [recipes])

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader fallback="/" title={ja.history.title} />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        {groups && groups.length === 0 && (
          <p className="text-center text-ink-muted">{ja.history.empty}</p>
        )}
        {groups?.map(([monthKey, entries]) => {
          const [y, m] = monthKey.split('-')
          return (
            <section key={monthKey} className="mt-[var(--space-md)] first:mt-0">
              <h2 className="font-bold text-ink-muted">
                {ja.history.monthFormat.replace('{y}', y).replace('{m}', String(Number(m)))}
              </h2>
              <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {entries.map(({ recipe, log }, index) => (
                  <li key={index}>
                    <Link
                      to={`/recipes/${recipe.id}`}
                      className="flex items-center justify-between gap-2 px-[var(--space-md)] py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{recipe.title}</p>
                        {log.note && <p className="mt-0.5 truncate text-sm text-ink-muted">{log.note}</p>}
                      </div>
                      <span className="shrink-0 text-sm text-ink-muted">
                        {log.date.replaceAll('-', '/')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}
