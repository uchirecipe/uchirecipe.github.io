import { useEffect } from 'react'

/**
 * 「取り消しの確認」を画面の中の窓で聞く（2026-08-14 便GL・利用者テスト
 * 「アプリの中で急に素のポップアップが出るのは違和感があります」）。
 *
 * 2026-08-12 便FX が「完成！」でブラウザの確認（OK／キャンセル）をやめて
 * 画面の中の窓（CookFinishModal）に直したのと**同じ作法**にそろえたもの。
 * 見た目・重なりの高さ・閉じ方をそちらに合わせてあるので、2つの窓が別物に見えない。
 *
 * 作りで守っていること（CookFinishModal と同じ）:
 *  - 本文は改行をそのまま出す（規約F の「消えるもの／残るもの」を行で分けて書けるように）
 *  - **履歴は積まない**（useOverlayDismiss を使わない）。この窓は全画面の調理中モードの上にも
 *    重なりうるが、全画面は自前で履歴を1つ積んでいて、その戻り先で全画面を閉じる作りになっている。
 *    ここでも積むと、窓を閉じたときの history.back() を全画面側が「戻る操作」と受け取ってしまう
 *  - Escape・窓の外のタップは「やめる」と同じ扱い（何も起きない側に倒す）
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  testId,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  /** 何が消えて何が残るか（規約F）。改行はそのまま出る */
  body: string
  confirmLabel: string
  cancelLabel: string
  /** 窓に付ける data-testid（確認は `-ok`、やめるは `-cancel` が付く） */
  testId: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
        className="max-h-[85vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <p className="ja-phrase text-lg font-bold">{title}</p>
        <p className="ja-phrase mt-[var(--space-sm)] whitespace-pre-line text-sm text-ink-muted">
          {body.trim()}
        </p>
        <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          <button
            type="button"
            data-testid={`${testId}-ok`}
            onClick={onConfirm}
            className="w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            data-testid={`${testId}-cancel`}
            onClick={onCancel}
            className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
