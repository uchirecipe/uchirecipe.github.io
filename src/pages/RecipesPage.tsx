import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listRecipes } from '../db/recipes'
import RecipeCard from '../components/RecipeCard'
import { ja } from '../i18n/ja'

/** レシピ一覧: 写真カードのグリッド＋右下の「＋」ボタン */
export default function RecipesPage() {
  // useLiveQuery: データベースが変わると自動で画面も更新される
  const recipes = useLiveQuery(listRecipes, [])

  return (
    <div className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)]">
      <h1 className="text-2xl font-bold">{ja.recipes.title}</h1>

      {recipes && recipes.length === 0 && (
        <div className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center text-ink-muted shadow-sm">
          <p className="font-bold">{ja.recipes.empty}</p>
          <p className="mt-1 text-sm">{ja.recipes.emptyHint}</p>
        </div>
      )}

      <div className="mt-[var(--space-md)] grid grid-cols-2 gap-[var(--space-sm)]">
        {recipes?.map((recipe) => (
          <RecipeCard key={recipe.id} recipe={recipe} />
        ))}
      </div>

      {/* 新規登録ボタン（親指が届く右下に固定、タブナビの上） */}
      <Link
        to="/recipes/new"
        aria-label={ja.recipes.addRecipe}
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-app shadow-md"
      >
        <Plus size={30} aria-hidden />
      </Link>
    </div>
  )
}
