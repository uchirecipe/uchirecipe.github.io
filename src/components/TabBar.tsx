import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { BookOpen, CalendarDays, Refrigerator, Settings } from 'lucide-react'
import { ja } from '../i18n/ja'
// 覚えるキーと「覚えを捨てる」操作は logic/navMemory.ts に置いてある
// （捨てる側＝献立タブからも同じキーを触るため。2026-08-07 便DT-2）
import { LAST_RECIPES_PATH_KEY, MEAL_PLAN_TAB_TAP_KEY, writeSessionItem } from '../logic/navMemory'

/**
 * 「レシピ」の後ろに並べる行き先（2026-08-17 便HG）。
 * レシピだけは直前に見ていた場所を覚える特別扱いがあるので、この表には入れず個別に書く。
 */
const tabsAfterRecipes = [
  { to: '/shopping', label: ja.nav.shopping, Icon: Refrigerator },
  { to: '/settings', label: ja.nav.settings, Icon: Settings },
] as const

/**
 * 画面下部に固定する行き先の並び（献立 / レシピ / 食材 / 設定）。
 *
 * 2026-08-17 便HG（オーナー決定「先にホーム画面なくします。タブの順番は、献立＞レシピ＞食材＞設定」）:
 * ホームを廃止して4つにした。ホームが担っていた役目（アプリを開いた直後に着く画面）は
 * 献立の「日」が引き継ぐので、先頭も献立にする。
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
          to="/meal-plan"
          /* 押したことを献立の画面へ伝える（2026-08-17 便HI・オーナー実機
             「週や月の献立を表示中に献立タブをタップしたら、日に戻るようにして」）。
             日/週/月は献立の画面の中の状態なので、すでに献立にいると行き先が同じで
             何も起きなかった。合図の置き場所と理由は logic/navMemory.ts */
          onClick={() => writeSessionItem(MEAL_PLAN_TAB_TAP_KEY, '1')}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-[var(--space-sm)] text-xs ${
              isActive ? 'font-bold text-accent-ink' : 'text-ink-muted'
            }`
          }
        >
          <CalendarDays size={24} aria-hidden />
          {ja.nav.mealPlan}
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

        {tabsAfterRecipes.map(({ to, label, Icon }) => (
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
