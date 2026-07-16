import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ja } from '../i18n/ja'
import { MEAL_SLOTS } from '../logic/mealPlan'
import type { MealSlot } from '../db/types'

type Props = {
  open: boolean
  /** 朝食/昼食/夕食のどれかを選んだ（週プランの今日のその枠+今日の献立へ） */
  onPickSlot: (slot: MealSlot) => void
  /** 「決めない」を選んだ（従来どおり今日の献立へ直接・枠なし） */
  onPickUndecided: () => void
  onClose: () => void
}

/**
 * 「今日の献立に追加」のスロット振り分け窓（2026-07-17 便Z-1・docs/35 §2 Fable設計）。
 * レシピ詳細のボタン押下で開き、「どの食事に入れますか？」として
 * [朝食] [昼食] [夕食(既定・目立たせる)] [決めない] の4択を出す。
 * 窓の作法はCookedLogModal踏襲: 中央寄せの角丸カード・枠線・shadow-md、
 * 背景タップ・×ボタン・Escapeで閉じる。カード内部のタップでは閉じない。
 */
export default function TodaySlotModal({ open, onPickSlot, onPickUndecided, onClose }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.detail.todaySlotDialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{ja.detail.todaySlotDialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* 夕食が既定＝いちばん使う枠なのでaccent塗りで目立たせる(仕様指定)。他はアウトライン */}
        <div className="mt-[var(--space-md)] grid grid-cols-3 gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onPickSlot(slot)}
              className={`rounded-md border py-3 font-bold shadow-sm ${
                slot === 'dinner'
                  ? 'border-accent bg-accent text-on-accent'
                  : 'border-edge bg-app text-accent'
              }`}
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{ja.detail.todaySlotDialogHint}</p>
        <button
          type="button"
          onClick={onPickUndecided}
          className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
        >
          {ja.detail.todaySlotUndecided}
        </button>
      </div>
    </div>
  )
}
