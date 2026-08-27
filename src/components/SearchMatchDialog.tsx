// ==========================================================================================
// 打った言葉がレシピのどこに一致したかを出す窓（2026-08-20 便IH・②）。
// 2026-08-27 便LN で src/pages/RecipesPage.tsx から切り出した。
// **見た目も動きも1つも変えていない**（どのファイルに書いてあるかだけを変えた）。
//
// 切り出した理由: 同じ窓を「レシピから追加」の選択画面にも出すため。
// 書き写すと、同じ窓が画面ごとに違う中身・違う閉じ方になる。
// ==========================================================================================
import { useScrollLock } from './useScrollLock'
import {
  DIALOG_ACTIONS_CLS,
  DIALOG_BACKDROP_CLS,
  DIALOG_CANCEL_BUTTON_CLS,
  DIALOG_CARD_CLS,
  DIALOG_TITLE_CLS,
} from './dialogStyle'
import { searchMatchRowText, type SearchMatchSummary } from '../logic/search'
import { ja } from '../i18n/ja'

export type SearchMatchDialogProps = {
  /** 検索まどに打った言葉（見出しに入れる） */
  query: string
  summary: SearchMatchSummary
  onClose: () => void
}

export default function SearchMatchDialog({ query, summary, onClose }: SearchMatchDialogProps) {
  // 開いているあいだ、後ろの画面は動かさない（アプリの他の窓と同じ作法・components/useScrollLock.ts）。
  // この部品は開いているときだけ描かれるので true でよい
  useScrollLock(true)
  const title = ja.search.matchDialogTitle.replace('{q}', query.trim())
  return (
    <div className={DIALOG_BACKDROP_CLS} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        data-testid="search-match-dialog"
        className={DIALOG_CARD_CLS}
      >
        <p className={DIALOG_TITLE_CLS}>{title}</p>
        <p className="ja-phrase mt-[var(--space-sm)] text-sm text-ink-muted">
          {ja.search.matchDialogHint}
        </p>
        <ul className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          {summary.rows.map((row) => (
            <li
              key={`${row.field} ${row.word ?? ''}`}
              data-testid="search-match-word"
              className="ja-phrase rounded-sm border border-edge px-3 py-2 text-sm"
            >
              {searchMatchRowText(row)}
            </li>
          ))}
        </ul>
        {summary.hiddenCount > 0 && (
          <p data-testid="search-match-more" className="mt-[var(--space-sm)] text-sm text-ink-muted">
            {ja.search.matchMore.replace('{n}', String(summary.hiddenCount))}
          </p>
        )}
        <div className={DIALOG_ACTIONS_CLS}>
          <button
            type="button"
            data-testid="search-match-close"
            onClick={onClose}
            className={DIALOG_CANCEL_BUTTON_CLS}
          >
            {ja.common.close}
          </button>
        </div>
      </div>
    </div>
  )
}
