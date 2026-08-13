import { Link, useLocation } from 'react-router-dom'
import { ja } from '../i18n/ja'
import { markFirstSetupNoticeSeen } from '../logic/firstSetupNotice'
import { settingsLinkWithBack } from '../logic/backLink'
import NoticeDialog from './NoticeDialog'

/**
 * 「食数の設定」「台所の器具」の初回の案内（2026-08-13 便GE・docs/65 A-4）。
 *
 * 出す・出さないの判定は logic/firstSetupNotice.ts、呼び出しは pages/RecipeDetailPage.tsx。
 * 窓そのもの（カード・✕・閉じ方）は NoticeDialog.tsx（ホーム画面追加のお知らせと同じ作り）。
 *
 * 作りで気をつけていること:
 *  - 閉じ方は4通り（✕・カード外のタップ・Escape/端末の戻る・「このまま使う」）。
 *    どれで閉じても markFirstSetupNoticeSeen() を通り、次からは出ない
 *  - 設定へのリンクは「食数の設定」の位置まで自動で送る（?section=household）。
 *    「台所の器具」はそのすぐ下の欄なので、1回のタップで両方が視界に入る
 *  - ?back= を載せて、設定から今読んでいたレシピへ帰れるようにする（logic/backLink.ts）
 *  - 押した時点で見た記録を残す。移った先で閉じ直す操作は起きないため、
 *    残さずに移ると設定を見た人にだけ次回また出てしまう
 *  - 閉じても情報が消えないよう、あとから変えられる場所を欄の名前のまま最後に書く
 */
export default function FirstSetupNotice({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const close = () => {
    markFirstSetupNoticeSeen()
    onClose()
  }

  return (
    <NoticeDialog title={ja.firstSetupNotice.title} testId="first-setup-notice" onClose={close}>
      <p className="mt-1 text-sm text-ink-muted">{ja.firstSetupNotice.body}</p>

      <Link
        to={settingsLinkWithBack(
          '/settings?section=household',
          location.pathname + location.search,
        )}
        onClick={markFirstSetupNoticeSeen}
        data-testid="first-setup-notice-settings"
        className="mt-[var(--space-md)] block rounded-md bg-accent py-3 text-center font-bold text-on-accent shadow-sm"
      >
        {ja.firstSetupNotice.settingsButton}
      </Link>
      <button
        type="button"
        onClick={close}
        data-testid="first-setup-notice-dismiss"
        className="mt-[var(--space-sm)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
      >
        {ja.firstSetupNotice.dismissButton}
      </button>
      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.firstSetupNotice.laterNote}</p>
    </NoticeDialog>
  )
}
