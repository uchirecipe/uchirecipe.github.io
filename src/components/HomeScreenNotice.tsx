import { useLocation } from 'react-router-dom'
import { ja } from '../i18n/ja'
import { markHomeScreenNoticeSeen } from '../logic/homeScreenNotice'
import { aboutLinkWithReturn } from '../logic/backLink'
import NoticeDialog from './NoticeDialog'

/**
 * ホーム画面への追加を案内する初回のお知らせ（2026-08-10 便EW）。
 *
 * 出す・出さないの判定は logic/homeScreenNotice.ts、呼び出しは pages/HomePage.tsx。
 * この窓は「出ると決まったあと」の中身だけを持つ。窓そのもの（カード・✕・閉じ方の3通り）は
 * NoticeDialog.tsx が持つ（2026-08-13 便GEで、2つ目のお知らせと共通化した）。
 *
 * 作りで気をつけていること:
 *  - 閉じ方は4通り（✕・カード外のタップ・Escape/端末の戻る・「このまま使う」）。
 *    どれで閉じても markHomeScreenNoticeSeen() を通り、次からは出ない
 *  - 「追加する方法を見る」は手順ページへの素のリンク。押した時点で見た記録を残してから
 *    ページごと移るので、React側は閉じない（閉じてから移ると、useOverlayDismissの
 *    後片付けと画面遷移が同時に走る）
 *  - 別窓(target="_blank")にしない: iOSのホーム画面追加アプリはSafariとストレージが別
 *    （SettingsPageの /about/ 配下へのリンクと同じ理由）
 *  - 2026-08-28 便LW: 同じ窓で移るので、手順ページから元の画面へ帰れるように ?from= を載せる
 *    （受け取り側は public/about/app-return.js）。この窓は献立の「日」から出るが、
 *    出る場所が変わっても帰り先が合うように、決め打ちではなく現在地を載せる
 */
export default function HomeScreenNotice({ onClose }: { onClose: () => void }) {
  const location = useLocation()
  const close = () => {
    markHomeScreenNoticeSeen()
    onClose()
  }

  return (
    <NoticeDialog title={ja.homeScreenNotice.title} testId="home-screen-notice" onClose={close}>
      <p className="mt-1 text-sm text-ink-muted">{ja.homeScreenNotice.body}</p>

      {/* 図は scripts/shots-app-figures.mjs で描いている（自作・幅340CSSpxの2倍で書き出し）。
          背景を透かしてあるので、スマートフォンの形の外はカード面がそのまま見える
          ＝ライトでもダークでも、明るい板が貼り付いたようには見えない */}
      <img
        src="/img/home-screen-icon.webp"
        width={680}
        height={434}
        alt={ja.homeScreenNotice.figureAlt}
        className="mx-auto mt-[var(--space-sm)] block w-full max-w-[340px]"
      />

      <a
        href={aboutLinkWithReturn('/about/install.html', location.pathname + location.search)}
        onClick={markHomeScreenNoticeSeen}
        data-testid="home-screen-notice-guide"
        className="mt-[var(--space-md)] block rounded-md bg-accent py-3 text-center font-bold text-on-accent shadow-sm"
      >
        {ja.homeScreenNotice.guideButton}
      </a>
      <button
        type="button"
        onClick={close}
        data-testid="home-screen-notice-dismiss"
        className="mt-[var(--space-sm)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
      >
        {ja.homeScreenNotice.dismissButton}
      </button>
      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.homeScreenNotice.laterNote}</p>
    </NoticeDialog>
  )
}
