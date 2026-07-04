import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ja } from '../i18n/ja'

type Props = {
  /** 履歴が無いとき（PWAをホーム画面から起動した直後など）に戻る先 */
  fallback: string
  /** 見出し文言（省略可） */
  title?: string
  /** タイトルをタップしたときの処理（例: ページ先頭へスクロール）。省略時はタップ不可の見出しとして表示 */
  onTitleClick?: () => void
  /** タイトル右側に置く追加の操作（例: お気に入り・編集ボタン） */
  right?: ReactNode
}

/**
 * 階層が深い画面（詳細・編集・設定サブページ等）の上部に置く「← 戻る」ヘッダー。
 * PWAとしてホーム画面から起動するとブラウザの戻るUIが無いため、
 * ブラウザ履歴があればそこへ戻り、無ければ親画面（fallback）へ移動する。
 * sticky表示なので、常に画面上部で「今どのレシピを見ているか」が分かる。
 */
export default function BackHeader({ fallback, title, onTitleClick, right }: Props) {
  const navigate = useNavigate()

  const goBack = () => {
    // react-router(HashRouter)は window.history.state.idx にスタック位置を持つ。
    // idx が 0 より大きい = このアプリ内で遷移してきた履歴がある、とみなせる。
    const idx = (window.history.state as { idx?: number } | null)?.idx
    if (typeof idx === 'number' && idx > 0) {
      navigate(-1)
    } else {
      navigate(fallback, { replace: true })
    }
  }

  return (
    <div className="sticky top-0 z-10 flex items-center gap-1 bg-app/95 px-[var(--space-sm)] py-2 backdrop-blur">
      <button
        type="button"
        onClick={goBack}
        className="flex shrink-0 items-center gap-1 rounded-sm px-2 py-2 font-bold text-accent"
      >
        <ChevronLeft size={22} aria-hidden />
        {ja.common.back}
      </button>
      {title &&
        (onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="min-w-0 flex-1 truncate text-left font-bold"
          >
            {title}
          </button>
        ) : (
          <h1 className="min-w-0 flex-1 truncate font-bold">{title}</h1>
        ))}
      {right}
    </div>
  )
}
