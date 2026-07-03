import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeFormPage from './pages/RecipeFormPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import SettingsPage from './pages/SettingsPage'
import TabBar from './components/TabBar'

/**
 * アプリ全体の骨組み。
 * HashRouter（URLが #/recipes のようになる方式）を採用:
 * GitHub Pages はページの再読み込みに弱いが、この方式なら安全に動く。
 */
function App() {
  return (
    <HashRouter>
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
      <TabBar />
    </HashRouter>
  )
}

export default App
