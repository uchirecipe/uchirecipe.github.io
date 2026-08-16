import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { ja } from '../i18n/ja'
import { useOverlayDismiss } from './useOverlayDismiss'
import { useScrollLock } from './useScrollLock'

/**
 * 「初回だけ出すお知らせ」の窓（2026-08-13 便GE）。
 *
 * 2026-08-10のホーム画面追加のお知らせ（HomeScreenNotice.tsx）で決めた作り方を、
 * 2つ目のお知らせ（FirstSetupNotice.tsx）を足すにあたって1か所にまとめたもの。
 * 中身（本文・ボタン）は呼び出し側が置き、この窓は見た目と閉じ方だけを持つ。
 *
 * 作りで守っていること:
 *  - 見た目は他の重ね窓（TodaySlotModal・CookedLogModal 等）と同じ作法に揃える
 *    ＝中央寄せの角丸カード・枠線・shadow-md・カード内のタップでは閉じない。
 *    エラーや警告に見える要素（赤・記号・全面の黒地）は使わない。オーナー指摘
 *    「条件反射で閉じたくなる画面」を作らないための一番の要
 *  - 閉じ方は3通り（✕・カード外のタップ・Escape/端末の戻る）。どれも同じ onClose を通る。
 *    呼び出し側は「見た記録を残してから閉じる」関数を渡すこと＝どの閉じ方でも次から出ない
 *
 * @param testId カードに付ける data-testid（✕には `-close` を足した値が付く）
 */
export default function NoticeDialog({
  title,
  testId,
  onClose,
  children,
}: {
  title: string
  testId: string
  onClose: () => void
  children: ReactNode
}) {
  useOverlayDismiss(true, onClose)
  useScrollLock(true)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={title}
        data-testid={testId}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            data-testid={`${testId}-close`}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
