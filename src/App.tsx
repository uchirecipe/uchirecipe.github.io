import { useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import RecipesPage from './pages/RecipesPage'
import RecipeFormPage from './pages/RecipeFormPage'
import RecipeDetailPage from './pages/RecipeDetailPage'
import MealPlanPage from './pages/MealPlanPage'
import MealTemplatesPage from './pages/MealTemplatesPage'
import MonthDemoPage from './pages/MonthDemoPage'
import CookNaviPage from './pages/CookNaviPage'
import ShoppingPage from './pages/ShoppingPage'
import HistoryPage from './pages/HistoryPage'
import SettingsPage from './pages/SettingsPage'
import IngredientPricesPage from './pages/IngredientPricesPage'
import TabBar from './components/TabBar'
import TimerBar from './components/TimerBar'
import AppUpdateBanner from './components/AppUpdateBanner'
import { TimerProvider } from './components/TimerProvider'
import { ConfirmProvider } from './components/ConfirmProvider'
import { startAppUpdateWatch } from './logic/appUpdate'
import { watchBottomBarInset } from './logic/bottomBarInset'
import { useSettings, recordFirstLaunchIfNeeded, resolveVisibleMealSlotsIfNeeded } from './db/settings'
import { seedStartersIfNeeded, topUpFlattenedStartersIfNeeded } from './db/starters'
import { seedPantryPresetIfNeeded } from './db/pantry'
import { seedPriceDefaultsIfNeeded } from './db/prices'
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
  // 初回起動時だけ、同梱の基本レシピ109品と在庫ボードのプリセットをデータベースに入れる。
  // 既にシード済みの既存ユーザーには、旧テーマ全廃(2026-07-23)で基本レシピに合流した分を
  // 起動時に「不足分だけ」1回投入する（過去に?set=取込済み・削除済みの品は二重投入・復活させない）。
  // 食材名の読み仮名辞書が更新されていれば、既存レシピのsearchWordsも作り直す。
  // 初回起動日時の記録は「基本レシピ投入済みか」で既存ユーザーを見分けるため、投入より先に行う
  useEffect(() => {
    void (async () => {
      await recordFirstLaunchIfNeeded()
      await seedStartersIfNeeded()
      await topUpFlattenedStartersIfNeeded()
      await seedPantryPresetIfNeeded()
      await seedPriceDefaultsIfNeeded()
      await rebuildSearchWordsIfNeeded()
      // 表示食事帯の既定値を初回だけ決める（新規ユーザーは夕食のみ・既存ユーザーは
      // 朝食/昼食を使っていれば3枠を維持。2026-07-13献立の主菜+副菜構成対応と同時導入）
      await resolveVisibleMealSlotsIfNeeded()
    })()
  }, [])

  // Service Workerを登録し、新しいバージョンが入ったら画面下の帯で知らせる(2026-08-09 便ER)。
  // 登録そのものは以前からvite-plugin-pwaが自動で差し込むスクリプトが行っていた。
  // アプリ側で受け取るようにしたのは、勝手に画面を読み込み直させないため(src/logic/appUpdate.ts)
  useEffect(() => {
    startAppUpdateWatch()
  }, [])

  // 画面下に固定される帯（タブナビ・タイマー・お知らせ）の高さを測り続け、
  // ページの下余白がそれに追随するようにする（2026-08-11 便FN・logic/bottomBarInset.ts）。
  // タイマーの本数・お知らせの有無で帯の高さは変わるので、固定値では隠れる日が出る
  useEffect(() => watchBottomBarInset(), [])

  return (
    <TimerProvider>
      {/* HashRouterのルーティングは #以降で完結するため、公開パス(ルート/)の
          影響を受けない。basenameを付けると #/ がどのルートにも一致せず白画面になる */}
      <HashRouter>
        <ThemeSync />
        {/* 確認の窓（2026-08-15 便GW）。ブラウザの素のダイアログをやめて、どの画面の確認も
            同じ見た目の窓（components/ConfirmDialog）で出す。いちばん外側に置くので、
            全画面の調理中モードやタブナビの上にも重なる */}
        <ConfirmProvider>
          {/* 下部に固定される帯（タブナビ・タイマー・お知らせ）に中身が隠れないよう、
              実測した高さ（--app-bottom-inset）ぶんの余白を空ける。既定値は index.css */}
          <main className="min-h-dvh pb-[calc(var(--app-bottom-inset)+var(--space-lg))]">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/recipes" element={<RecipesPage />} />
              <Route path="/recipes/new" element={<RecipeFormPage />} />
              <Route path="/recipes/:id" element={<RecipeDetailPage />} />
              <Route path="/recipes/:id/edit" element={<RecipeFormPage />} />
              <Route path="/meal-plan" element={<MealPlanPage />} />
              {/* 献立テンプレの中身を見る・直す(2026-08-02 便DE-9)。献立の「週」タブから開く */}
              <Route path="/meal-templates" element={<MealTemplatesPage />} />
              {/* 月間画面のサンプルデモ(2026-08-02 便DC)。月タブ・設定のPro紹介・LP/説明書からここへ来る */}
              <Route path="/month-demo" element={<MonthDemoPage />} />
              <Route path="/cook-navi" element={<CookNaviPage />} />
              <Route path="/shopping" element={<ShoppingPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/prices" element={<IngredientPricesPage />} />
            </Routes>
          </main>
          <TimerBar />
          {/* 新しいバージョンのお知らせ(2026-08-09 便ER)。押したときだけ画面を読み込み直す */}
          <AppUpdateBanner />
          <TabBar />
        </ConfirmProvider>
      </HashRouter>
    </TimerProvider>
  )
}

export default App
