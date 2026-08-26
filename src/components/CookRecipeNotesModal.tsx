import { useEffect } from 'react'
import { X, Info } from 'lucide-react'
import { MemoText } from './MemoText'
import type { RecipeNote } from '../logic/naviRecipeNotes'
import { ja } from '../i18n/ja'
import { useScrollLock } from './useScrollLock'

type Props = {
  open: boolean
  /** その手順に割り当てたレシピ本体のメモ（2026-08-11 便FM の割り当てをそのまま使う） */
  notes: readonly RecipeNote[]
  /** どのレシピのメモかを見出しの下に出す（段取りには複数のレシピが混ざるため） */
  recipeTitle: string
  /** その品の色（段取りの一覧・調理中の画面と同じ色） */
  color: string
  onClose: () => void
}

/**
 * レシピのメモを読む窓（2026-08-26 便LG・オーナー原文「レシピのメモがスクロール付きの細い
 * スペースにあるが、スクロールするよりはタップで窓出した方が読みやすい。手順ないには
 * 「レシピのメモ」だけ表示。」）。
 *
 * 直したこと: 調理中モードの手順カードの中に、高さ24vh（390×844の実機で約202px）の
 * 細いスクロール欄としてレシピのメモを埋め込んでいた。手順本文の下にあって場所を取るうえ、
 * 中を送らないと最後まで読めない＝**読む欄なのに読み切れない**形だった。
 * 手順の中には見出しだけを置き、読むときはこの窓を開く。
 *
 * 閉じ方は3つ（見出し横の✕・背景のタップ・下の大きなボタン）＝タイマーの手順を見る窓
 * （CookStepPeekModal）と同じ作法にそろえる。**現在地は動かさない**・端末には何も残さない。
 */
export default function CookRecipeNotesModal({ open, notes, recipeTitle, color, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useScrollLock(open)
  if (!open || notes.length === 0) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.cookNavi.recipeNotesTitle}
        data-testid="cook-session-recipe-memo-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-1 font-bold">
            <Info size={16} aria-hidden />
            {ja.cookNavi.recipeNotesTitle}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* どのレシピのメモかを、段取りの一覧・調理中の画面と同じ色の帯で言う */}
        <p className="mt-[var(--space-sm)]">
          <span
            className="ja-phrase inline-block min-w-0 rounded-full px-2 py-0.5 text-xs font-bold leading-snug"
            style={{ backgroundColor: color, color: 'var(--chip-ink)' }}
          >
            {recipeTitle}
          </span>
        </p>
        {/* 長いメモでも窓が画面からはみ出さないよう、読む面だけを送れるようにする */}
        <div className="mt-[var(--space-sm)] max-h-[52vh] overflow-x-hidden overflow-y-auto overscroll-contain rounded-sm bg-app px-2 py-1.5">
          {/* 本文は1文字も変えずに渡す（「・」の箇条書きも改行もレシピ詳細と同じ組み方になる） */}
          <MemoText
            text={notes.map((note) => note.text).join('\n')}
            className="text-base leading-relaxed"
          />
        </div>
        <button
          type="button"
          data-testid="cook-session-recipe-memo-close"
          onClick={onClose}
          className="mt-[var(--space-md)] w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
        >
          {ja.common.close}
        </button>
      </div>
    </div>
  )
}
