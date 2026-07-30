import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ja } from '../i18n/ja'

type Props = {
  message: string
  onClose: () => void
  /**
   * 取り消しなど、トーストから直接行える操作（任意・2026-07-29 便CC/C19）。
   * 省略すると従来どおり「どこをタップしても閉じるだけ」のトーストになる。
   */
  actionLabel?: string
  onAction?: () => void
}

// 自動で消えるまでの時間(ミリ秒)。「◯件追加・◯件更新しました（重複◯件はスキップ）」のような
// やや長い文言も読み切れるよう、他の一時的なフィードバックより長めに取る。
// 4.5秒→6秒(2026-07-13 UIペルソナQA: 読み切る前に消えるとの指摘)
const AUTO_DISMISS_MS = 6000

/**
 * 設定画面の操作結果メッセージ(セット読み込み・バックアップ結果・NG食材追加 等)を表示するトースト
 * (2026-07-12オーナー実機フィードバック)。以前はページ最上部に固定テキストとして出していたが、
 * 縦に長いページでは上部が見えないという指摘を受け、画面下部(タブナビのすぐ上)に固定表示する
 * 方式に変更した。「CookedLogModal様式の小窓」か「トースト」の2択はトーストを選択（理由:
 * 一時的な状態通知には、明示的な×操作を要求する中央モーダルより、自動で消え既存の操作を
 * 妨げないトーストの方が向くため。CLAUDE.md規約C: ①可逆・非破壊 ②既存機能を妨げない、の両方を満たす）。
 * 数秒で自動的に消える + タップでも閉じられる。
 * 出現時は軽いスライドイン(下から10px+フェードイン。motion-safe:でprefers-reduced-motionを尊重。
 * 2026-07-13 UIペルソナQA)。
 */
export default function Toast({ message, onClose, actionLabel, onAction }: Props) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [message, onClose])

  if (!message) return null

  const hasAction = !!actionLabel && !!onAction

  return (
    <div
      className="fixed inset-x-0 z-[70] flex justify-center px-[var(--space-md)]"
      style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm items-start gap-2 rounded-md border border-accent bg-surface px-4 py-3 text-left shadow-md motion-safe:animate-toast-in">
        <button
          type="button"
          onClick={onClose}
          className="flex min-w-0 flex-1 items-start gap-2 text-left"
        >
          <span className="min-w-0 flex-1 text-sm font-bold text-accent-ink">{message}</span>
          {!hasAction && <X size={16} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />}
        </button>
        {hasAction && (
          <>
            <button
              type="button"
              onClick={onAction}
              className="shrink-0 rounded-sm border border-accent px-3 py-1 text-sm font-bold text-accent-ink"
            >
              {actionLabel}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={ja.common.close}
              className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-accent-ink"
            >
              <X size={16} aria-hidden />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
