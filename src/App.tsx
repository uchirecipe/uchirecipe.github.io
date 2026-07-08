import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeFormPage from './pages/RecipeFormPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import MealPlanPage from './pages/MealPlanPage'
import CookNaviPage from './pages/CookNaviPage'
import ShoppingPage from './pages/ShoppingPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import TabBar from './components/TabBar'
import TimerBar from './components/TimerBar'
import { TimerProvider } from './components/TimerProvider'
import { useSettings, recordFirstLaunchIfNeeded } from './db/settings'
import { seedStartersIfNeeded } from './db/starters'
import { seedPantryPresetIfNeeded } from './db/pantry'
import { rebuildSearchWordsIfNeeded } from './db/recipes'

/**
 * 設定のテーマを画面に反映する。
 * 「自動」なら端末の設定に従い（data-theme を外す）、
 * 「ライト/ダーク」なら <html data-theme="..."> を付けて固定する。
 */
function ThemeSync() {
  const theme = useSettings()?.theme
  useEffect(() => {
    const root = document.documentElement
    if (!theme || theme === 'auto') {
      delete root.dataset.theme
    } else {
      root.dataset.theme = theme
    }
  }, [theme])
  return null
}

/**
 * アプリ全体の骨組み。
 * HashRouter（URLが #/recipes のようになる方式）を採用:
 * GitHub Pages はページの再読み込みに弱いが、この方式なら安全に動く。
 * TimerProvider が全体を包むので、タブを移動してもタイマーは動き続ける。
 */
function App() {
  // 初回起動時だけ、同梱の基本レシピ21品と在庫ボードのプリセットをデータベースに入れる。
  // 食材名の読み仮名辞書が更新されていれば、既存レシピのsearchWordsも作り直す。
  // 初回起動日時の記録は「基本レシピ投入済みか」で既存ユーザーを見分けるため、投入より先に行う
  useEffect(() => {
    void (async () => {
      await recordFirstLaunchIfNeeded()
      await seedStartersIfNeeded()
      await seedPantryPresetIfNeeded()
      await rebuildSearchWordsIfNeeded()
    })()
  }, [])

  return (
    <TimerProvider>
      {/* HashRouterのルーティングは #以降で完結するため、公開パス(ルート/)の
          影響を受けない。basenameを付けると #/ がどのルートにも一致せず白画面になる */}
      <HashRouter>
        <ThemeSync />
        {/* pb-24: 下部の固定タブナビに中身が隠れないよう余白を確保 */}
        <main className="min-h-dvh pb-24">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/recipes" element={<RecipesPage />} />
            <Route path="/recipes/new" element={<RecipeFormPage />} />
            <Route path="/recipes/:id" element={<RecipeDetailPage />} />
            <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
            <Route path="/meal-plan" element={<MealPlanPage />} />
            <Route path="/cook-navi" element={<CookNaviPage />} />
            <Route path="/shopping" element={<ShoppingPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
        <TimerBar />
        <TabBar />
      </HashRouter>
    </TimerProvider>
  )
}

export default App
