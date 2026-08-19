import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import type { CookedLog, Recipe } from '../db/types'
import BackHeader from '../components/BackHeader'
import CookedLogDetailModal, {
  type CookedLogDetailTarget,
} from '../components/CookedLogDetailModal'
import { useDetachedLogEntries } from '../components/useDetachedLogEntries'
import RecipeCard from '../components/RecipeCard'
import { ja } from '../i18n/ja'

/** 1回に描く件数（2026-07-29 便CI/C03）。「もっと見る」で同じ数ずつ増やす */
const PAGE_SIZE = 30

/**
 * 履歴1行（2026-07-29 便CI/C04）。
 * サムネは記録に添付された写真を優先し、無ければレシピ写真→アイコンにフォールバックする。
 * 同じ記録なのに履歴だけ文字だけで、「名前を忘れた料理を写真から探す」動線が成立していなかった。
 *
 * 2026-08-09 便EQ（オーナー実機）: 行を押すとレシピ詳細へ移っていたが、一覧から見たいのは
 * 記録そのものだったので、押すと記録の中身の小窓が開くようにした
 * （写真の拡大・ひとことメモ・何人分もここで読める。レシピ詳細へは小窓の中から行ける）。
 *
 * 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）: 自前で組んでいた行を
 * 共通のレシピカードの「標準」に寄せた。献立の「日」の「最近作ったもの」
 * （components/RecentCookedList）と**同じ役目・同じ形**になる。
 * 補助情報の行は、レシピの属性（時間・手間・季節）ではなく**その記録の情報**
 * （ひとことメモ・削除済みの断り）に差し替える。作った日と何人分は行の右端に置く。
 */
function HistoryRow({
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
  return (
    <li>
      <RecipeCard
        recipe={recipe}
        density="standard"
        // 出すのはレシピの属性ではなく「その記録の情報」（2026-08-19 便HY・cardParts.ts）
        place="cookedLog"
        onSelect={onOpen}
        selectAriaLabel={ja.cookedDetail.openAria.replace('{title}', recipe.title)}
        photoOverride={log.photo}
        meta={
          <>
            {log.date.replaceAll('-', '/')}
            {/* 記録した人数(2026-07-29 便CI/C05)。献立の「作った記録の食費」の分母になる値 */}
            {log.servings != null && (
              <span className="block">
                {ja.detail.cookedServingsValue.replace('{n}', String(log.servings))}
              </span>
            )}
          </>
        }
        infoLine={
          deleted || log.note ? (
            <>
              {/* レシピが端末に無いことを一覧の時点で分かるようにする（2026-08-16 便GZ）。
                  押して開いた小窓でも同じことを書くが、一覧で見分けが付かないと
                  「押してもレシピへ行けない行」を毎回押すことになる */}
              {deleted && (
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  {ja.cookedDetail.deletedRecipeLabel}
                </p>
              )}
              {log.note && <p className="mt-0.5 truncate text-sm text-ink-muted">{log.note}</p>}
            </>
          ) : null
        }
      />
    </li>
  )
}

/** 「作った記録」の全履歴。全レシピのcookedLogsを日付降順・月区切りで一覧表示する */
/**
 * 呼び出し元へ戻すための行き先（2026-08-02 便DE-11・オーナー指示）。
 * 献立の週タブ／月タブから開いたときは ?back=week / ?back=month が付いてくる。
 * これが無いときは従来どおり（ブラウザ履歴があれば1つ戻る・無ければ献立）。
 *
 * 直った問題: 週タブの「過去の記録を見る」→ 記録一覧 → 戻る、で献立タブの「日」に落ちていた。
 * 履歴を1つ戻るだけでは献立タブのタブ状態（日/週/月）までは戻らないため、
 * 開いた場所を持ち回って、そのタブを指定して戻す。
 *
 * 2026-08-09 便EQ（オーナー「戻るのも該当場所のスクロール位置まで」）: 行き先を献立の日タブにも
 * 広げ、帰り道に `restore=1` を付けて、呼び出し元が覚えておいた縦スクロール位置
 * （月・週ならそのとき見ていた月・週も）まで戻せるようにした。覚えは呼び出し元がリンクを
 * 押した時点で sessionStorage に書く。覚えが無いときは復元せず、その画面を普通に開くだけになる。
 */
function backTargetOf(back: string | null): string | null {
  if (back === 'week') return '/meal-plan?focus=week&restore=1'
  if (back === 'month') return '/meal-plan?focus=month&restore=1'
  if (back === 'day') return '/meal-plan?focus=today&restore=1'
  // 2026-08-17 便HG: ホーム画面を廃止したので、ホーム発を名乗るものは献立の「日」へ送る。
  // 古いリンク（?back=home）を開いた人も、新しい入口と同じ場所に着くようにするため残す
  if (back === 'home') return '/meal-plan?focus=today&restore=1'
  return null
}

export default function HistoryPage() {
  const recipes = useLiveQuery(listRecipes, [])
  // レシピを削除しても残っている記録（2026-08-16 便GZ）。同じ一覧に日付順で並べる
  const detachedEntries = useDetachedLogEntries()
  // レシピ詳細の「すべて見る（他◯件）」からの絞り込み(2026-07-29 便CI/C03)
  const [searchParams] = useSearchParams()
  const backTarget = backTargetOf(searchParams.get('back'))
  const filterRecipeId = Number(searchParams.get('recipe'))
  const hasFilter = Number.isFinite(filterRecipeId) && searchParams.get('recipe') !== null
  const filterRecipe = hasFilter ? recipes?.find((r) => r.id === filterRecipeId) : undefined

  const [shownCount, setShownCount] = useState(PAGE_SIZE)
  // 押した記録の中身を出す小窓(2026-08-09 便EQ)。null なら閉じている
  const [logDetail, setLogDetail] = useState<CookedLogDetailTarget | null>(null)

  const entries = useMemo(() => {
    if (!recipes || !detachedEntries) return undefined
    const target = hasFilter ? recipes.filter((r) => r.id === filterRecipeId) : recipes
    // logIndex（recipe.cookedLogs の何番目か）も持ち回る＝小窓から記録の編集へ渡すため(便EQ)
    const own: CookedLogDetailTarget[] = target.flatMap((recipe) =>
      recipe.cookedLogs.map((log, logIndex) => ({ recipe, log, logIndex })),
    )
    // レシピを削除したあとも残っている記録も同じ一覧に並べる（2026-08-16 便GZ・オーナー承認
    // 「記録を見るときに、記録した情報や写真閲覧などはできる」）。
    // レシピを1品に絞って見ているとき（?recipe=<id>）は、そのレシピの記録だけを見に来ているので混ぜない
    return [...own, ...(hasFilter ? [] : detachedEntries)].sort((a, b) =>
      b.log.date.localeCompare(a.log.date),
    )
  }, [recipes, detachedEntries, hasFilter, filterRecipeId])

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
        fallback={backTarget ?? '/meal-plan'}
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
          /* 空の型（2026-08-18 便HS・軸8）。この一覧から1タップで行ける「次の一手」は無い
             （「作った！」はレシピ詳細・献立・並行調理ナビの3か所にある）ので、
             ボタンは置かず、どこを押せば記録が残るかをボタン名で書く */
          <div className="text-center text-ink-muted">
            <p>{ja.history.empty}</p>
            <p className="mt-1 text-sm">{ja.history.emptyHint}</p>
          </div>
        )}
        {groups?.map(([monthKey, monthEntries]) => {
          const [y, m] = monthKey.split('-')
          return (
            <section key={monthKey} className="mt-[var(--space-md)] first:mt-0">
              <h2 className="font-bold text-ink-muted">
                {ja.history.monthFormat.replace('{y}', y).replace('{m}', String(Number(m)))}
              </h2>
              <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
                {monthEntries.map((entry, index) => (
                  <HistoryRow
                    key={`${entry.recipe.id ?? `d${entry.detachedRecordId}`}-${entry.log.date}-${index}`}
                    recipe={entry.recipe}
                    log={entry.log}
                    deleted={entry.detachedRecordId != null}
                    onOpen={() => setLogDetail(entry)}
                  />
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

      {/* 行を押したときに開く記録の小窓(2026-08-09 便EQ)。写真の拡大もここから */}
      {logDetail && (
        <CookedLogDetailModal target={logDetail} onClose={() => setLogDetail(null)} />
      )}
    </div>
  )
}
