import { useEffect } from 'react'
import { X } from 'lucide-react'
import { ja } from '../i18n/ja'
import { MEAL_SLOTS } from '../logic/mealPlan'
import type { MealSlot } from '../db/types'

type Props = {
  open: boolean
  /** 朝食/昼食/夕食のどれかを選んだ（週プランの今日のその枠+今日の献立へ） */
  onPickSlot: (slot: MealSlot) => void
  /** 食事を決めずに選んだ（今日の献立へ直接・今週の予定には入れない） */
  onPickUndecided: () => void
  onClose: () => void
  /**
   * 窓の見出し（任意）。省略するとレシピ1品ぶんの「どの食事に入れますか？」。
   * まとめて入れるときは品数を含む見出しに差し替える（2026-08-11 便FP）
   */
  title?: string
}

/**
 * 「今日の献立に追加」のスロット振り分け窓（2026-07-17 便Z-1・docs/35 §2 Fable設計）。
 * レシピ詳細のボタン押下で開き、「どの食事に入れますか？」として
 * [朝食] [昼食] [夕食] と、食事を決めずに入れる選択肢を出す。
 * 窓の作法はCookedLogModal踏襲: 中央寄せの角丸カード・枠線・shadow-md、
 * 背景タップ・×ボタン・Escapeで閉じる。カード内部のタップでは閉じない。
 *
 * 2026-08-11 便FP（利用者テスト③）の変更2点:
 * 1. 「決めない」だけでは、押すと献立に入るのか入らないのかが読めなかった。
 *    何が起きるかをボタン名と1行の説明で言う（この操作は今日の献立には入る）。
 * 2. 夕食だけをアクセント色で塗っていたが、この配色はアプリの他の画面では
 *    「選択中」を表す（一覧の並び替え・絞り込みの☑リスト等）。そのため
 *    「もう夕食が選ばれている」のか「おすすめ」のか読めないという報告になった。
 *    実装上も時間帯で既定を変えているわけではなく、3つはまったく同格なので、
 *    3つとも同じ見た目にして「まだ何も選ばれていない」ことを見た目で言い切る。
 *    採らなかった案: 時計を見て今の時間帯の枠を勧める（説明の1行が要り、
 *    夜食・作り置きのように「今の時間＝入れたい枠」でない使い方を外すため）。
 */
export default function TodaySlotModal({
  open,
  onPickSlot,
  onPickUndecided,
  onClose,
  title,
}: Props) {
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
        aria-label={title ?? ja.detail.todaySlotDialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{title ?? ja.detail.todaySlotDialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* 3つは同格＝まだ何も選ばれていないことが見た目で分かるように、同じ見た目にする */}
        <div className="mt-[var(--space-md)] grid grid-cols-3 gap-2">
          {MEAL_SLOTS.map((slot) => (
            <button
              key={slot}
              type="button"
              data-testid="today-slot-button"
              onClick={() => onPickSlot(slot)}
              className="rounded-md border border-edge bg-app py-3 font-bold text-accent-ink shadow-sm"
            >
              {ja.mealPlan.slot[slot]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">{ja.detail.todaySlotDialogHint}</p>
        <button
          type="button"
          onClick={onPickUndecided}
          className="mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 text-sm font-bold text-accent-ink shadow-sm"
        >
          {ja.detail.todaySlotUndecided}
        </button>
        <p className="mt-1 text-xs text-ink-muted">{ja.detail.todaySlotUndecidedHint}</p>
      </div>
    </div>
  )
}
