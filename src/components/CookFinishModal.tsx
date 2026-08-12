import { Check, ChevronLeft, X } from 'lucide-react'
import { useOverlayDismiss } from './useOverlayDismiss'
import { ja } from '../i18n/ja'

/**
 * 段取りの最後の手順で「完成！」を押したときの窓（2026-08-12 便FX・オーナー実機
 * 「完成！を押した後の記録をつけますか？でOKとキャンセルしかない。
 * もとの完成！を押す直前の手順最終画面に戻る方法がない」）。
 *
 * それまではブラウザの確認（OK／キャンセル）で聞いていたので、行き先が2つしか作れず、
 * 「キャンセル」は**全画面を閉じて段取りの一覧へ戻る**に割り当てられていた
 * （2026-08-10 便EZ のオーナー指示「完成後、画面の戻り位置は『まとめて作った！』まで
 * スクロール」がここに乗っていたため）。押し間違えても、まだ確かめたいことがあっても、
 * 手順の画面には帰れなかった。
 *
 * 画面の中の窓にして行き先を3つにする:
 *   ①記録をつける ②調理を続ける（手順の画面がそのまま戻る）③記録をつけずに閉じる
 * ②を足しても①③は今までと同じ動きなので、便EZ の戻り位置もそのまま残る。
 *
 * 本文（何件に記録が付き、何が残るか＝規約F）は「まとめて作った！」ボタンの確認と
 * **同じ文字列**を受け取って出す（記録の中身の説明を2か所に書かない）。
 */
export default function CookFinishModal({
  open,
  body,
  onRecord,
  onBack,
  onClose,
}: {
  open: boolean
  /** 記録の中身の説明（呼び出し側が「まとめて作った！」と同じ組み立てで作る） */
  body: string
  onRecord: () => void
  /** 手順の画面へ帰る（何も起きない＝窓を閉じるだけ） */
  onBack: () => void
  /** 記録をつけずに全画面を閉じる */
  onClose: () => void
}) {
  // Escape・端末の「戻る」は「調理を続ける」と同じ扱い（何も起きない側に倒す）
  useOverlayDismiss(open, onBack)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onBack}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.cookNavi.sessionFinishTitle}
        onClick={(e) => e.stopPropagation()}
        data-testid="cook-finish-modal"
        className="max-h-[85vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <p className="text-lg font-bold">{ja.cookNavi.sessionFinishTitle}</p>
        {/* 本文は改行をそのまま出す（「まとめて作った！」の確認と同じ文面） */}
        <p
          data-testid="cook-finish-modal-body"
          className="ja-phrase mt-[var(--space-sm)] whitespace-pre-line text-sm text-ink-muted"
        >
          {body.trim()}
        </p>
        <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          <button
            type="button"
            data-testid="cook-finish-record"
            onClick={onRecord}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            <Check size={20} aria-hidden />
            {ja.cookNavi.sessionFinishRecord}
          </button>
          <button
            type="button"
            data-testid="cook-finish-back"
            onClick={onBack}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-accent bg-surface py-3 font-bold text-accent-ink shadow-sm"
          >
            <ChevronLeft size={18} aria-hidden />
            {ja.cookNavi.sessionFinishBack}
          </button>
          <button
            type="button"
            data-testid="cook-finish-close"
            onClick={onClose}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
          >
            <X size={18} aria-hidden />
            {ja.cookNavi.sessionFinishClose}
          </button>
        </div>
      </div>
    </div>
  )
}
