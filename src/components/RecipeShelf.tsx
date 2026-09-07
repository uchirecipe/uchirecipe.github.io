import { Link } from 'react-router-dom'
import { ChevronRight, History, Refrigerator, Sparkles } from 'lucide-react'
import type { Recipe } from '../db/types'
import RecipeCard from './RecipeCard'

/**
 * 献立の「日」の下側にある横スクロールの区画（棚）（2026-09-05 便ND。便NFで2つ目と共用に）。
 * 2026-09-06 便NH: 置き場所がレシピ一覧の上から献立の「日」へ引っ越し、3段になった。
 * 「最近作ったもの」（kind="recentCooked"・旧 components/RecentCookedList の置き換え）、
 * 「しばらく作っていないレシピ」（kind="notRecent"）、「在庫の食材を使うレシピ」
 * （kind="pantry"）の3か所で使う。
 *
 * どの品を並べるか（記録の新しい順・自作優先・14日・在庫との一致・上限・日替わりの種）は
 * logic/recipeShelf が決め、ここは受け取った並びをそのまま描くだけ。
 * 出す・出さない（0件）は「0件なら何も描かない」でこの部品が受け持つ
 * （一覧にあったころの「選択モード中・絞り込み中・並べ替え中は隠す」は、日タブに
 * その概念が無いので呼び出し側の条件ごと消えた）。
 *
 * 一般化は title と kind の2つだけ（便NF・司令部指定）:
 *  ・見出しの文字は title で受ける（ja.ts から呼び出し側が渡す）
 *  ・アイコンと data-shelf は kind から**部品側で**引く。ReactNode・関数の props は
 *    渡さない（React.memo が素通りするため。下のカードと同じ理由）
 *  ・data-testid="recipe-shelf" は**全部の区画で共有**する。既存e2eの5ファイル9か所が
 *    この印で「一覧のカードから区画を除く」除外をしており、別の印にすると除外を
 *    すり抜けて数がずれる。区画どうしの見分けは data-shelf 属性で行う
 *
 * 「レシピ一覧で見る」（2026-09-06 便NH・オーナー確定）: 各棚の見出しの右に、
 * その棚と同じ物差しの並び替えを設定済みのレシピ一覧へのリンクを置く。
 * 行き先（?sort=・?dir=）は呼び出し側が listHref で渡す＝どの並びで開くかは
 * 棚の中身を決めた側（MealPlanPage）が1か所で持つ。
 *
 * 作りは「最近作ったもの」（旧 RecentCookedList）の先例に従う:
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
  // 「最近作ったもの」の History は旧 RecentCookedList の見出しと同じ印（見た目を引き継ぐ）
  recentCooked: { Icon: History, dataShelf: 'recent-cooked' },
  notRecent: { Icon: Sparkles, dataShelf: 'not-recent' },
  pantry: { Icon: Refrigerator, dataShelf: 'pantry' },
} as const

export default function RecipeShelf({
  recipes,
  title,
  kind,
  listHref,
  listLabel,
  ngIngredients,
  todayRecipeIds,
}: {
  /** 並べる品（logic/recipeShelf の pick◯◯ShelfRecipes が選んだ順のまま） */
  recipes: Recipe[]
  /** 見出しの文字（ja.dayStart.historyTitle / ja.recipes.shelfNotRecentTitle /
   *  shelfPantryTitle を呼び出し側が渡す） */
  title: string
  /** 区画の種類。アイコン（History/Sparkles/Refrigerator）と data-shelf をここから引く */
  kind: 'recentCooked' | 'notRecent' | 'pantry'
  /** 「レシピ一覧で見る」の行き先（並び替え設定済みの一覧。/recipes?sort=◯◯&dir=◯◯） */
  listHref: string
  /** 「レシピ一覧で見る」の文字（ja.recipes.shelfListLink を呼び出し側が渡す） */
  listLabel: string
  /** NG食材（一覧のカードと同じ警告を出す。安全に関わるのでここでも削らない） */
  ngIngredients?: string[]
  /** 「今日の献立に追加済み」の印を出す品（日タブに実際に並ぶ品＝dayRecipeIds から作る） */
  todayRecipeIds?: ReadonlySet<number>
}) {
  if (recipes.length === 0) return null
  const { Icon, dataShelf } = SHELF_PARTS[kind]
  return (
    <section data-testid="recipe-shelf" data-shelf={dataShelf} className="mt-[var(--space-md)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">
          <Icon size={20} className="text-accent-ink" aria-hidden />
          {title}
        </h2>
        {/* 見た目は「作った記録の一覧」（MealPlanPage の historyLink）と同じ下線リンク。
            見出しの右に置く＝棚の品数が0〜10で変わってもリンクの位置は動かない */}
        <Link
          to={listHref}
          className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-accent-ink underline"
        >
          {listLabel}
          <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      {/* pb-1 はスクロールバーが出る環境でカードの影と重ならないための逃げ幅。

          px-1 -mx-1 / pt-1 mt-[…-4px]（2026-09-07 便NL）: カードの枠が外側の outline の環
          （.card-frame）になったので、overflow-x-auto のこの<ul>がそのままだと、いちばん上と
          左右の端で環（2px）が切れる（スクロールの入れ物は自分の縁で描画も切るため）。
          端に4pxの padding を足し、同じ4pxを負のマージンで返す＝**カードの見た目の位置は
          1pxも動かさず**、環のぶんだけ描ける余白を入れ物の内側に作る。
          負のマージンは4pxだけ＝ページの余白16pxの中に収まる（「画面端まで広げない」の
          決めごと（上の注記）はそのまま。1pxも横にあふれない） */}
      <ul className="-mx-1 mt-[calc(var(--space-sm)_-_4px)] flex gap-[var(--space-sm)] overflow-x-auto px-1 pt-1 pb-1">
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
