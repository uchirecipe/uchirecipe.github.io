import { Refrigerator, Sparkles } from 'lucide-react'
import type { Recipe } from '../db/types'
import RecipeCard from './RecipeCard'

/**
 * レシピ一覧の上の横スクロールの区画（2026-09-05 便ND。便NFで2つ目の区画と共用に）。
 * 「最近作っていないレシピ」（kind="notRecent"）と「在庫の食材を使うレシピ」
 * （kind="pantry"）の2か所で使う。
 *
 * どの品を並べるか（自作優先・14日・在庫との一致・上位10件・日替わりの種）は
 * logic/recipeShelf が決め、ここは受け取った並びをそのまま描くだけ。
 * 出す・出さない（選択モード中・絞り込み中・並べ替え中・0件）も呼び出し側（RecipesPage）が
 * 持つ＝この部品は「0件なら何も描かない」だけを受け持つ。
 *
 * 一般化は title と kind の2つだけ（便NF・司令部指定）:
 *  ・見出しの文字は title で受ける（ja.ts から呼び出し側が渡す）
 *  ・アイコンと data-shelf は kind から**部品側で**引く。ReactNode・関数の props は
 *    渡さない（React.memo が素通りするため。下のカードと同じ理由）
 *  ・data-testid="recipe-shelf" は**両方の区画で共有**する。既存e2eの5ファイル9か所が
 *    この印で「一覧のカードから区画を除く」除外をしており、別の印にすると除外を
 *    すり抜けて一覧の数が10枚増える。区画どうしの見分けは data-shelf 属性で行う
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

/** 区画の種類から引く飾り: 見出しのアイコンと、区画を見分ける data-shelf の値 */
const SHELF_PARTS = {
  notRecent: { Icon: Sparkles, dataShelf: 'not-recent' },
  pantry: { Icon: Refrigerator, dataShelf: 'pantry' },
} as const

export default function RecipeShelf({
  recipes,
  title,
  kind,
  ngIngredients,
  todayRecipeIds,
}: {
  /** 並べる品（logic/recipeShelf の pickShelfRecipes / pickPantryShelfRecipes が選んだ順のまま） */
  recipes: Recipe[]
  /** 見出しの文字（ja.recipes.shelfNotRecentTitle / shelfPantryTitle を呼び出し側が渡す） */
  title: string
  /** 区画の種類。アイコン（Sparkles/Refrigerator）と data-shelf をここから引く */
  kind: 'notRecent' | 'pantry'
  /** NG食材（一覧のカードと同じ警告を出す。安全に関わるのでここでも削らない） */
  ngIngredients?: string[]
  /** 「今日の献立に追加済み」の印を出す品（一覧のカードと同じ判定をそのまま使う） */
  todayRecipeIds?: ReadonlySet<number>
}) {
  if (recipes.length === 0) return null
  const { Icon, dataShelf } = SHELF_PARTS[kind]
  return (
    <section data-testid="recipe-shelf" data-shelf={dataShelf} className="mt-[var(--space-md)]">
      <h2 className="flex items-center gap-2 font-bold">
        <Icon size={20} className="text-accent-ink" aria-hidden />
        {title}
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
