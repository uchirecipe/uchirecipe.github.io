import { Sparkles } from 'lucide-react'
import type { Recipe } from '../db/types'
import RecipeCard from './RecipeCard'
import { ja } from '../i18n/ja'

/**
 * レシピ一覧の上の横スクロールの区画「最近作っていないレシピ」（2026-09-05 便ND）。
 *
 * どの品を並べるか（自作優先・14日・上位10件・日替わりの種）は logic/recipeShelf が決め、
 * ここは受け取った並びをそのまま描くだけ。出す・出さない（選択モード中・絞り込み中・0件）も
 * 呼び出し側（RecipesPage）が持つ＝この部品は「0件なら何も描かない」だけを受け持つ。
 *
 * 作りは「最近作ったもの」（RecentCookedList）の先例に従う:
 *  ・見出し＋<ul> の独立した区画。0件なら見出しごと出さない
 *  ・カードは共通部品（RecipeCard）を通す。**幅は入れ物の <li> が決める**
 *    （カードに幅・形の口を開けない＝HW-4。グリッドが列で幅を決めているのと同じ形）
 *  ・横スクロールは <ul> の overflow-x-auto。負のマージンで画面端まで広げない
 *    （1pxでも横にあふれるとChromeモバイルがページごとズームアウトする実害があるため、
 *      ページの余白の中だけでスクロールさせる）
 *
 * カードに渡すのは値の props だけ（ReactNode・関数を渡すと React.memo が素通りする）。
 */
export default function RecipeShelf({
  recipes,
  ngIngredients,
  todayRecipeIds,
}: {
  /** 並べる品（logic/recipeShelf の pickShelfRecipes が選んだ順のまま） */
  recipes: Recipe[]
  /** NG食材（一覧のカードと同じ警告を出す。安全に関わるのでここでも削らない） */
  ngIngredients?: string[]
  /** 「今日の献立に追加済み」の印を出す品（一覧のカードと同じ判定をそのまま使う） */
  todayRecipeIds?: ReadonlySet<number>
}) {
  if (recipes.length === 0) return null
  return (
    <section data-testid="recipe-shelf" className="mt-[var(--space-md)]">
      <h2 className="flex items-center gap-2 font-bold">
        <Sparkles size={20} className="text-accent-ink" aria-hidden />
        {ja.recipes.shelfNotRecentTitle}
      </h2>
      {/* pb-1 はスクロールバーが出る環境でカードの影と重ならないための逃げ幅 */}
      <ul className="mt-[var(--space-sm)] flex gap-[var(--space-sm)] overflow-x-auto pb-1">
        {recipes.map((recipe) => (
          <li key={recipe.id} className="w-[140px] shrink-0">
            <RecipeCard
              recipe={recipe}
              density="large"
              place="recipeShelf"
              ngIngredients={ngIngredients}
              inTodayList={recipe.id != null && (todayRecipeIds?.has(recipe.id) ?? false)}
              testId="recipe-shelf-card"
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
