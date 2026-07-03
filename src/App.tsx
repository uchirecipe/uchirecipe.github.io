import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeFormPage from './pages/RecipeFormPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import SettingsPage from './pages/SettingsPage'
import TabBar from './components/TabBar'
import TimerBar from './components/TimerBar'
import { TimerProvider } from './components/TimerProvider'
import { useSettings } from './db/settings'

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
  return (
    <TimerProvider>
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
