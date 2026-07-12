import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CookingTerm } from '../data/cookingTerms'
import { MemoText } from './MemoText'
import { ja } from '../i18n/ja'

export type OpenTerm = (term: CookingTerm, anchor: HTMLElement) => void

export interface TermPopoverState {
  term: CookingTerm
  anchor: HTMLElement
}

/**
 * 用語タップのポップオーバー開閉状態を管理するフック。
 * ページ単位で1つ持ち、TermText/MemoTextへ openTerm を渡す。
 */
export function useTermPopover() {
  const [state, setState] = useState<TermPopoverState | null>(null)
  const open: OpenTerm = (term, anchor) => setState({ term, anchor })
  const close = () => setState(null)
  return { state, open, close }
}

const MARGIN = 8

/**
 * 用語+説明を表示するミニポップオーバー(2026-07-11 用語タップ辞書)。
 * ・タップした語の近くに表示し、画面端では自動的に位置をずらす
 * ・ポップオーバーの内側・外側どちらをタップしても閉じる(全面オーバーレイのonClickで一括処理)
 */
export default function TermPopover({
  state,
  onClose,
}: {
  state: TermPopoverState | null
  onClose: () => void
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!state || !boxRef.current) {
      setPos(null)
      return
    }
    const anchorRect = state.anchor.getBoundingClientRect()
    const boxRect = boxRef.current.getBoundingClientRect()
    let left = anchorRect.left + anchorRect.width / 2 - boxRect.width / 2
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - boxRect.width - MARGIN)
    let top = anchorRect.bottom + MARGIN
    if (top + boxRect.height > window.innerHeight - MARGIN) {
      top = anchorRect.top - boxRect.height - MARGIN
    }
    top = Math.max(top, MARGIN)
    setPos({ top, left })
  }, [state])

  // スクロールで語とポップオーバーの位置がずれるため、開いている間にスクロールされたら閉じる。
  // 開いた直後は、タップしたボタンにフォーカスが移る際のブラウザ自動スクロール(数px程度)を
  // 誤検知してしまうため、リスナーの登録を1フレーム遅らせる(2026-07-11 実機/E2Eで発覚)。
  useEffect(() => {
    if (!state) return
    const handle = () => onClose()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const raf = requestAnimationFrame(() => {
      window.addEventListener('scroll', handle, { capture: true, passive: true })
      window.addEventListener('keydown', onKey)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', handle, { capture: true })
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  if (!state) return null

  return (
    <div className="fixed inset-0 z-[70]" onClick={onClose} role="presentation">
      <div
        ref={boxRef}
        role="dialog"
        aria-label={state.term.term}
        onClick={onClose}
        className="fixed max-w-[80vw] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
        style={{
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          visibility: pos ? 'visible' : 'hidden',
        }}
      >
        <p className="font-bold text-accent">{state.term.term}</p>
        {/* 「｜」は説明文内の改行(MemoTextの行に変換され「・」の箇条書きも効く)。
            ▽折りたたみの長い詳細を小窓の中で読みやすくするため(2026-07-12オーナー要望) */}
        <div className="mt-1 max-w-[70vw] text-sm leading-relaxed text-ink">
          <MemoText text={state.term.description.replace(/｜/g, '\n')} />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={ja.term.closeAria}
          className="mt-2 text-xs font-bold text-ink-muted underline"
        >
          {ja.common.close}
        </button>
      </div>
    </div>
  )
}
