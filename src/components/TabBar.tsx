import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { House, BookOpen, CalendarDays, Refrigerator, Settings } from 'lucide-react'
import { ja } from '../i18n/ja'
// 覚えるキーと「覚えを捨てる」操作は logic/navMemory.ts に置いてある
// （捨てる側＝献立タブからも同じキーを触るため。2026-08-07 便DT-2）
import { LAST_RECIPES_PATH_KEY } from '../logic/navMemory'

const otherTabs = [
  { to: '/meal-plan', label: ja.nav.mealPlan, Icon: CalendarDays },
  { to: '/shopping', label: ja.nav.shopping, Icon: Refrigerator },
  { to: '/settings', label: ja.nav.settings, Icon: Settings },
] as const

/**
 * 画面下部に固定するタブナビゲーション（ホーム / レシピ / 献立 / 買い物 / 設定）。
 *
 * 「レシピ」タブだけは特別扱い: 一覧・詳細・編集のどこにいたかを覚えておき、
 * 他のタブを経由してから戻ってきたとき、直前に見ていたレシピにそのまま戻れるようにする
 * （一覧に戻されると「今見ていたレシピ」を探し直す手間が生まれるため）。
 * ただし今いる場所が/recipes配下のときは一覧(/recipes)へ向ける: 覚えたパス＝現在地になり
 * タップしても何も起きなくなるため（詳細を開いたままリロードすると「タブが効かない」ように
 * 見えるバグの原因だった。2026-07-09ペルソナテスト第2波）。
 * アクティブ表示（タブが光る条件）は覚えた個別パスに関わらず「/recipes配下ならすべて」で判定する。
 */
export default function TabBar() {
  const location = useLocation()

  useEffect(() => {
    if (location.pathname.startsWith('/recipes')) {
      sessionStorage.setItem(LAST_RECIPES_PATH_KEY, location.pathname)
    }
  }, [location.pathname])

  const isRecipesActive = location.pathname.startsWith('/recipes')
  const recipesTarget = isRecipesActive
    ? '/recipes'
    : sessionStorage.getItem(LAST_RECIPES_PATH_KEY) || '/recipes'

  return (
    <nav
      data-app-bottom-bar
      className="fixed inset-x-0 bottom-0 border-t border-edge bg-surface shadow-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-md">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-[var(--space-sm)] text-xs ${
              isActive ? 'font-bold text-accent-ink' : 'text-ink-muted'
            }`
          }
        >
          <House size={24} aria-hidden />
          {ja.nav.home}
        </NavLink>

        <Link
          to={recipesTarget}
          className={`flex flex-1 flex-col items-center gap-1 py-[var(--space-sm)] text-xs ${
            isRecipesActive ? 'font-bold text-accent-ink' : 'text-ink-muted'
          }`}
        >
          <BookOpen size={24} aria-hidden />
          {ja.nav.recipes}
        </Link>

        {otherTabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-[var(--space-sm)] text-xs ${
                isActive ? 'font-bold text-accent-ink' : 'text-ink-muted'
              }`
            }
          >
            <Icon size={24} aria-hidden />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
