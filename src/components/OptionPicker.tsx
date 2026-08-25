import type { ReactNode } from 'react'

/**
 * 「いくつかの中から押して選ぶ」並び（2026-08-25 便KO）。
 *
 * レシピ登録画面の季節・向いている時間帯・料理の種別・手間レベルが、同じ見た目・同じ操作の
 * ボタンの並びを4か所に書き写していた。取り込みの直後にも同じ選択を出すことになったので、
 * 書き写しをやめて1つの部品にした（**見た目・当たり判定・押したときの色は今までと同じ**）。
 *
 * 決めごと:
 *  ・選んでいるかどうかは色だけでなく aria-pressed でも伝える（読み上げにも届く。便KG と同じ）
 *  ・同じものをもう一度押したときに外すかどうかは、呼ぶ側が onPick で決める
 *    （季節・種別は外せる、手間レベルは3つのどれかに必ず入る）
 */
export interface OptionPickerItem<T extends string> {
  value: T
  label: string
}

export default function OptionPicker<T extends string>({
  label,
  description,
  options,
  cols,
  isPicked,
  onPick,
  hint,
  testId,
  compact = false,
  className = 'mt-[var(--space-md)]',
}: {
  /** 項目名（読み上げのまとまりの名前にも使う） */
  label: string
  /** 項目名の下の説明（任意） */
  description?: string
  options: readonly OptionPickerItem<T>[]
  /** 1行に並べる数 */
  cols: 3 | 4
  isPicked: (value: T) => boolean
  onPick: (value: T) => void
  /** 並びの下に添える一文（任意） */
  hint?: ReactNode
  testId?: string
  /** 詰めた大きさ（レシピ登録の「かんたん」タブの種別だけが従来からこの大きさ） */
  compact?: boolean
  className?: string
}) {
  return (
    <div className={className} data-testid={testId}>
      <span className="block text-sm font-bold text-ink-muted">{label}</span>
      {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
      <div
        role="group"
        aria-label={label}
        className={`mt-1 grid gap-[var(--space-sm)] ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={isPicked(option.value)}
            onClick={() => onPick(option.value)}
            className={`rounded-md border font-bold shadow-sm ${
              compact ? 'py-2.5 text-sm' : 'py-3'
            } ${
              isPicked(option.value)
                ? 'border-accent bg-accent text-on-accent'
                : 'border-edge bg-surface text-ink-muted'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {hint}
    </div>
  )
}
