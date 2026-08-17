import { useEffect, type ReactNode } from 'react'
import { useScrollLock } from './useScrollLock'
import {
  DIALOG_ACTIONS_CLS,
  DIALOG_BACKDROP_CLS,
  DIALOG_CANCEL_BUTTON_CLS,
  DIALOG_CARD_CLS,
  DIALOG_CHOICE_BUTTON_CLS,
  DIALOG_PRIMARY_BUTTON_CLS,
  DIALOG_TITLE_CLS,
} from './dialogStyle'

/**
 * 「このあとどうするか」を選ぶ窓（2026-08-17 便HJ・オーナー実機フィードバック
 * 「選択ボタン押下→レシピ選択→選択終了→複数のボタンからレシピをどうするのか選ぶ、
 * という流れはどうか」）。
 *
 * 見た目・重なりの高さ・閉じ方は確認の窓（ConfirmDialog／2026-08-15 便GWでアプリ全体を
 * そろえたもの）と**同じ作法**にそろえてある（クラス名は components/dialogStyle.ts で共有）。
 * 新しい見た目は作らない。違うのは中身だけ:
 *  - 確認の窓＝「する／やめる」の2択
 *  - この窓＝ 選んだものに対してできることを**複数**並べ、その中から1つ選ぶ
 *
 * 作りで守っていること（ConfirmDialog と同じ）:
 *  - **履歴は積まない**（useOverlayDismiss を使わない）。全画面の調理中モードの上にも
 *    重なりうるが、全画面は自前で履歴を1つ積んでいて、その戻り先で全画面を閉じる作りのため
 *  - 「押した直後」を保つ: 各ボタンの onClick の中で呼び出し側の処理が走るので、
 *    保存先を選ぶ画面（showSaveFilePicker）のように利用者の操作の直後でないと開けないものも通る
 *
 * 閉じ方は2通りに分けてある:
 *  - onClose（窓の外のタップ・Escape）＝**まだ何も決めていない**。選んだ状態はそのまま残す
 *  - onCancel（下の「やめる」のボタン）＝名前どおりの操作を行う（呼び出し側が決める）
 *
 * 2026-08-18 便HO（オーナー実機フィードバック「選択したレシピをどうするかの窓に、キャンセルで
 * 選択の続きに戻れるようにしたい。選択をやめる、で選択したレシピもリセットされてしまう」）:
 * まだ何も決めずに閉じる道（onClose）は、窓の外のタップとEscapeにしか無く、
 * **押せる場所として見えていなかった**。backLabel を渡すと、その道をボタンとしても出す。
 * ボタンの中身は onClose そのものなので、窓の外のタップ・Escape・このボタンの3つは
 * 必ず同じ結果になる（別々に書かない＝あとから片方だけ動きが変わることが起きない）。
 */
export type ChoiceOption = {
  label: string
  /** ボタンに付ける data-testid */
  testId: string
  /** 行頭に置く絵（任意） */
  icon?: ReactNode
  /** いちばんの道は塗りつぶしで出す（確認の窓の「確認」と同じ見た目） */
  primary?: boolean
  disabled?: boolean
  onSelect: () => void
}

export default function ChoiceDialog({
  open,
  title,
  hint,
  options,
  backLabel,
  backTestId,
  cancelLabel,
  cancelTestId,
  testId,
  onCancel,
  onClose,
}: {
  open: boolean
  title: string
  /** 見出しの下に置く補足（任意） */
  hint?: string
  options: readonly ChoiceOption[]
  /**
   * 「まだ決めない」で閉じる道を、押せるボタンとしても出す（任意）。
   * 押したときに起きることは窓の外のタップ・Escape と同じ（onClose）
   */
  backLabel?: string
  backTestId?: string
  cancelLabel: string
  cancelTestId: string
  /** 窓に付ける data-testid */
  testId: string
  /** 下の「やめる」を押した */
  onCancel: () => void
  /** 窓の外のタップ・Escape で閉じた（何も決めていない） */
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  // 開いているあいだ、後ろの画面は動かさない（重なった数を数える形なので二重に効いても壊れない）
  useScrollLock(open)
  if (!open) return null
  return (
    <div className={DIALOG_BACKDROP_CLS} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
        className={DIALOG_CARD_CLS}
      >
        <p className={DIALOG_TITLE_CLS}>{title}</p>
        {hint && (
          <p className="ja-phrase mt-[var(--space-sm)] text-sm text-ink-muted">{hint}</p>
        )}
        <div className={DIALOG_ACTIONS_CLS}>
          {options.map((option) => (
            <button
              key={option.testId}
              type="button"
              data-testid={option.testId}
              disabled={option.disabled}
              onClick={option.onSelect}
              className={`${
                option.primary ? DIALOG_PRIMARY_BUTTON_CLS : DIALOG_CHOICE_BUTTON_CLS
              } flex items-center justify-center gap-2 disabled:opacity-40`}
            >
              {option.icon}
              {option.label}
            </button>
          ))}
          {/* 窓から出る道は2つ。どちらも同じ見た目で並べ、違いは名前だけで読ませる
              （上＝選んだものを残したまま戻る／下＝選んだものを外す）。
              残る側を上に置くのは、選択肢の並びと同じ考え方（消えない方を上に） */}
          {backLabel && (
            <button
              type="button"
              data-testid={backTestId}
              onClick={onClose}
              className={DIALOG_CANCEL_BUTTON_CLS}
            >
              {backLabel}
            </button>
          )}
          <button
            type="button"
            data-testid={cancelTestId}
            onClick={onCancel}
            className={DIALOG_CANCEL_BUTTON_CLS}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
