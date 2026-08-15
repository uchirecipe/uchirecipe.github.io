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
 *
 * 2026-08-15 便GV: bullets／notes を足した（オーナー実機「文章が長い。箇条書きや太字で
 * 読みやすくして」）。どちらも任意なので、body だけを渡している既存の呼び出し元は
 * 見た目も文言も変わらない。長い確認文を「見出し＋箇条書き＋小さめの補足」に分けるための器で、
 * 規約H の「長文は分割・折りたたみ・表で構成する」をこの窓の中でやるための道具。
 */
export default function ConfirmDialog({
  open,
  title,
  body,
  bullets,
  notes,
  confirmLabel,
  cancelLabel,
  testId,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  /** 何が消えて何が残るか（規約F）。改行はそのまま出る。bullets を使うときは前置きの1行に使う */
  body: string
  /** 箇条書き（任意）。label は太字の見出しとして行頭に出る */
  bullets?: readonly { label: string; text: string }[]
  /** 補足（任意）。箇条書きの下に小さめの文字で1行ずつ出る */
  notes?: readonly string[]
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
        {body.trim() !== '' && (
          <p className="ja-phrase mt-[var(--space-sm)] whitespace-pre-line text-sm text-ink-muted">
            {body.trim()}
          </p>
        )}
        {bullets && bullets.length > 0 && (
          <ul className="mt-[var(--space-sm)] list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {bullets.map((bullet) => (
              <li key={bullet.label} className="ja-phrase">
                <span className="font-bold text-ink">{bullet.label}</span>: {bullet.text}
              </li>
            ))}
          </ul>
        )}
        {notes && notes.length > 0 && (
          <div className="mt-[var(--space-sm)] space-y-0.5">
            {notes.map((note) => (
              <p key={note} className="ja-phrase text-xs text-ink-muted">
                {note}
              </p>
            ))}
          </div>
        )}
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
