import { useEffect } from 'react'
import { X } from 'lucide-react'
import { COOK_FONT_SCALES, cookFontSize } from '../logic/cookFontScale'
import { ja } from '../i18n/ja'
import { useScrollLock } from './useScrollLock'

/** 倍率ごとの呼び名（COOK_FONT_SCALES と同じ並び） */
const LABELS = [
  ja.focus.textSizeSmall,
  ja.focus.textSizeNormal,
  ja.focus.textSizeLarge,
  ja.focus.textSizeExtraLarge,
]

/**
 * 調理中モードの手順の文字の大きさを選ぶ窓（2026-08-12 便FX・オーナー実機
 * 「調理中モードの文字の大きさは、ユーザーが自由に変更できない？」）。
 *
 * 1品の調理中モード（FocusMode）と並行調理ナビの調理中モード（CookSessionOverlay）で
 * 同じ窓・同じ設定値を使う＝画面ごとに別の大きさにならない。
 * 選んだ大きさは端末に残す（settings.cookStepFontScale）ので、次に開いたときも同じ。
 *
 * 選択肢の文字は**その大きさそのもの**で描く（「大きめ」がどのくらいかを押す前に見せる）。
 */
export default function CookTextSizeModal({
  open,
  scale,
  onChange,
  onClose,
}: {
  open: boolean
  scale: number
  onChange: (next: number) => void
  onClose: () => void
}) {
  /**
   * Escape で閉じる。**履歴は積まない**（全画面の調理中モードが自前で積んだ履歴と
   * ぶつかり、窓を閉じただけで調理中モードごと閉じてしまうため。CookFinishModal と同じ理由）
   */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useScrollLock(open)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.focus.textSizeTitle}
        onClick={(e) => e.stopPropagation()}
        data-testid="cook-text-size-modal"
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold">{ja.focus.textSizeTitle}</p>
            <p className="ja-phrase mt-0.5 text-xs text-ink-muted">{ja.focus.textSizeHint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="tap-target shrink-0 rounded-full p-1 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <div className="mt-[var(--space-md)] grid grid-cols-4 gap-[var(--space-sm)]">
          {COOK_FONT_SCALES.map((value, i) => (
            <button
              key={value}
              type="button"
              data-testid="cook-text-size-option"
              aria-pressed={scale === value}
              onClick={() => onChange(value)}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-md border py-2 shadow-sm ${
                scale === value
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-surface text-accent-ink'
              }`}
            >
              {/* 大きさの見本。押したときに手順本文がどのくらいになるかを、そのまま出す */}
              <span className="font-bold leading-none" style={{ fontSize: cookFontSize(1.25, value) }}>
                あ
              </span>
              <span className="text-[10px] font-bold leading-none">{LABELS[i]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
