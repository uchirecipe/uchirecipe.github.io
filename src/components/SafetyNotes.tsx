import { ShieldAlert } from 'lucide-react'
import { MemoText } from './MemoText'
import type { SafetyNote } from '../logic/safetyNotes'
import { ja } from '../i18n/ja'

/**
 * 安全のめやすの枠（2026-08-22 便JH）。
 *
 * レシピ詳細と調理中モードで**同じ部品**を使う。片方だけ言い回し・見た目が変わることを
 * 構造的に起こさないため（同じ考えで作られている NaviRecipeNotes と同じ作法）。
 *
 * 見出しを必ず付けるのは、**利用者が書いた文とアプリが添えた文を混ぜないため**。
 * 取り込んだレシピの手順の下に地の文で足すと、元のページに書いてあった注意だと読まれる。
 */
export default function SafetyNotes({
  notes,
  /** 'step'=その手順の下 / 'recipe'=レシピ全体（メモと同じ並び） */
  place,
  testId,
  className,
}: {
  notes: readonly SafetyNote[]
  place: 'step' | 'recipe'
  testId: string
  className?: string
}) {
  if (notes.length === 0) return null
  const isRecipe = place === 'recipe'
  return (
    <div
      data-testid={testId}
      className={`rounded-sm border border-edge ${isRecipe ? 'bg-surface p-[var(--space-md)]' : 'px-2 py-1.5'} text-left ${className ?? ''}`}
    >
      <p className={`flex items-center gap-1 font-bold text-accent-ink ${isRecipe ? 'text-sm' : 'text-xs'}`}>
        <ShieldAlert size={isRecipe ? 16 : 14} aria-hidden />
        {ja.safety.title}
      </p>
      {/* 本文は1文字も変えずに渡す（レシピ詳細のメモと同じ組み方になる） */}
      <MemoText
        text={notes.map((note) => note.text).join('\n')}
        className={`mt-0.5 ${isRecipe ? 'text-sm' : 'text-sm text-ink-muted'}`}
      />
      {isRecipe && <p className="mt-1 text-xs text-ink-muted">{ja.safety.source}</p>}
    </div>
  )
}
