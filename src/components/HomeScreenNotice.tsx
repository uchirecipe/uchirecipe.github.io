import { X } from 'lucide-react'
import { ja } from '../i18n/ja'
import { markHomeScreenNoticeSeen } from '../logic/homeScreenNotice'
import { useOverlayDismiss } from './useOverlayDismiss'

/**
 * ホーム画面への追加を案内する初回のお知らせ（2026-08-10 便EW）。
 *
 * 出す・出さないの判定は logic/homeScreenNotice.ts、呼び出しは pages/HomePage.tsx。
 * この窓は「出ると決まったあと」の見た目と閉じ方だけを持つ。
 *
 * 作りで気をつけていること:
 *  - 見た目は他の重ね窓（TodaySlotModal・CookedLogModal 等）と同じ作法に揃える
 *    ＝中央寄せの角丸カード・枠線・shadow-md・カード内のタップでは閉じない。
 *    エラーや警告に見える要素（赤・記号・全面の黒地）は使わない。オーナー指摘
 *    「条件反射で閉じたくなる画面」を作らないための一番の要
 *  - 閉じ方は4通り（✕・カード外のタップ・Escape/端末の戻る・「このまま使う」）。
 *    どれで閉じても markHomeScreenNoticeSeen() を通り、次からは出ない
 *  - 「追加する方法を見る」は手順ページへの素のリンク。押した時点で見た記録を残してから
 *    ページごと移るので、React側は閉じない（閉じてから移ると、useOverlayDismissの
 *    後片付けと画面遷移が同時に走る）
 *  - 別窓(target="_blank")にしない: iOSのホーム画面追加アプリはSafariとストレージが別
 *    （SettingsPageの /about/ 配下へのリンクと同じ理由）
 */
export default function HomeScreenNotice({ onClose }: { onClose: () => void }) {
  const close = () => {
    markHomeScreenNoticeSeen()
    onClose()
  }
  useOverlayDismiss(true, close)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.homeScreenNotice.title}
        data-testid="home-screen-notice"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold">{ja.homeScreenNotice.title}</h2>
          <button
            type="button"
            onClick={close}
            data-testid="home-screen-notice-close"
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

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
          href="/about/install.html"
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
        <p className="mt-[var(--space-sm)] text-xs text-ink-muted">
          {ja.homeScreenNotice.laterNote}
        </p>
      </div>
    </div>
  )
}
