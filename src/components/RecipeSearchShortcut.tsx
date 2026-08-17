import { useNavigate } from 'react-router-dom'
import { Search, Refrigerator } from 'lucide-react'
import { ja } from '../i18n/ja'

/**
 * レシピを探す入口（2026-08-02 オーナー実機FB・司令部裁定）。
 *
 * 検索そのものはレシピ一覧1か所にまとめてあるので、ここには「レシピ一覧で探せる」と伝える
 * 導線だけを置く（入口を消すと発見性が落ちるため、集約と発見性を両立させる）。
 *
 * 2026-08-17 便HG: ホーム画面の廃止にともない、置き場所をホームから献立の「日」へ移した。
 * 出すのはその日の献立が決まっていないときだけ（判定は pages/MealPlanPage.tsx）。
 */
export default function RecipeSearchShortcut({ pantryNames }: { pantryNames: string[] }) {
  const navigate = useNavigate()
  return (
    <section className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
      <p className="text-sm text-ink-muted">{ja.dayStart.searchShortcutDescription}</p>
      <button
        type="button"
        onClick={() => navigate('/recipes?focus=search')}
        className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md bg-accent py-3 font-bold text-on-accent shadow-sm"
      >
        <Search size={20} aria-hidden />
        {ja.dayStart.searchShortcutButton}
      </button>
      {/* 在庫から探す導線は「在庫の食材で絞る」をONにした状態でレシピ一覧へ渡す(絞り込み付きの遷移)。
          在庫が1件も無いときは押しても結果が変わらないので出さない */}
      {pantryNames.length > 0 && (
        <button
          type="button"
          onClick={() => navigate('/recipes?pantry=1')}
          className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
        >
          <Refrigerator size={20} aria-hidden />
          {ja.dayStart.searchShortcutPantry}
        </button>
      )}
    </section>
  )
}
