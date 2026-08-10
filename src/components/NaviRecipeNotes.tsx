import { Info } from 'lucide-react'
import { MemoText } from './MemoText'
import type { RecipeNote } from '../logic/naviRecipeNotes'
import { ja } from '../i18n/ja'

/**
 * レシピ本体のメモを、段取り・調理中モードの手順に出す枠（2026-08-11 便FM）。
 *
 * 手順ごとの注意書き（`item.memo`）は見出しを付けずに本文の下へ続けているが、
 * こちらは**その手順の話ではなくレシピ全体の話**なので、どこから来た文なのかが
 * 分かるように見出しを1行だけ置く。行の中身・改行はレシピ詳細と同じ描き方
 * （MemoText）にそろえ、2つの画面で同じ文が同じ見た目で出るようにする。
 *
 * 2画面で1つの部品を共有するのは、片方だけ言い回しや並びが変わることを
 * 構造的に起こさないため（段取りの一覧と調理中モードの食い違いは実際に起きている）。
 */
export default function NaviRecipeNotes({
  notes,
  testId,
  className,
}: {
  notes: readonly RecipeNote[]
  testId: string
  className?: string
}) {
  if (notes.length === 0) return null
  return (
    <div
      data-testid={testId}
      className={`rounded-sm border border-edge px-2 py-1.5 text-left ${className ?? ''}`}
    >
      <p className="flex items-center gap-1 text-xs font-bold text-accent-ink">
        <Info size={14} aria-hidden />
        {ja.cookNavi.recipeNotesTitle}
      </p>
      {/* 本文は1文字も変えずに渡す（「・」の箇条書きも改行もレシピ詳細と同じ組み方になる） */}
      <MemoText text={notes.map((note) => note.text).join('\n')} className="mt-0.5 text-sm" />
    </div>
  )
}
