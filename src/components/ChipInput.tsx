import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { splitValues } from '../logic/textSplit'
import { ja } from '../i18n/ja'

type Props = {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  /** 追加ボタンの文言（省略時はプラスアイコンのみ） */
  addLabel?: string
  /** チップ削除ボタンの aria-label（省略時は共通文言） */
  removeLabel?: string
}

/**
 * 1つ入力するごとにチップ（✗で削除できる丸いラベル）として追加していく入力欄。
 * NG食材の入力欄と同じ操作方式を、食材検索など他の画面でも使い回すための共通部品。
 */
export default function ChipInput({ values, onChange, placeholder, addLabel, removeLabel }: Props) {
  const [text, setText] = useState('')

  // スペース・カンマ・読点区切りで複数まとめて入力しても、それぞれ別のチップになる
  const add = () => {
    const parsed = splitValues(text)
    if (parsed.length === 0) {
      setText('')
      return
    }
    const merged = [...values]
    for (const value of parsed) {
      if (!merged.includes(value)) merged.push(value)
    }
    onChange(merged)
    setText('')
  }

  const remove = (value: string) => {
    onChange(values.filter((v) => v !== value))
  }

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-[var(--space-sm)] flex flex-wrap gap-1">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-bold text-accent"
              style={{ background: 'color-mix(in oklab, var(--accent) 14%, var(--bg))' }}
            >
              {value}
              <button type="button" onClick={() => remove(value)} aria-label={removeLabel ?? ja.chip.remove}>
                <X size={14} aria-hidden />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-[var(--space-sm)]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
        />
        <button
          type="button"
          onClick={add}
          disabled={text.trim() === ''}
          // 2026-07-16 UI総点検A-7: 空欄タップで無反応だったのをdisabled化(既存のdisabled:opacity-50を踏襲)。
          // ChipInputはHomePage/RecipesPage共通の部品で、空欄クリックが無意味なのはどちらでも同じため
          // コンポーネント側で対応する
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent shadow-sm disabled:opacity-50"
        >
          <Plus size={18} aria-hidden />
          {addLabel}
        </button>
      </div>
    </div>
  )
}
