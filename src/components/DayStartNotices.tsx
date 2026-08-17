import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDriveDownload, Megaphone, X } from 'lucide-react'
import { updateSettings } from '../db/settings'
import { backupOverdue } from '../logic/backup'
import { fetchNews, isNewsSuppressed, isNewsVisibleFor, type NewsItem } from '../logic/news'
import { settingsLinkWithBack } from '../logic/backLink'
import type { Recipe, Settings } from '../db/types'
import { ja } from '../i18n/ja'

// バックアップの案内の「×で閉じたらセッション中は再表示しない」用キー(2026-07-16 便S)。
// sessionStorageなのでタブ/アプリを閉じれば消え、次回起動時はまた条件を満たせば出る
const BACKUP_REMINDER_DISMISSED_KEY = 'uchirecipe:backupReminderDismissed'

/**
 * アプリを開いた直後に読ませたい2つの案内（バックアップのうながし・アプリ内のお知らせ）。
 *
 * 2026-08-17 便HG: どちらもホーム画面＝アプリを開いて最初に着く画面に置かれていたもの。
 * ホーム画面を廃止し、その役目を献立の「日」が引き継いだので、案内もそのまま連れてきた
 * （置き場所を移さないと、バックアップのうながしもお知らせも誰の目にも触れなくなる）。
 *
 * ホームでは画面上部に浮かせた帯だったが、ここでは本文の中に置く。
 * 献立の画面は「日／週／月」の帯が画面上部に貼り付く作りなので、浮かせるとその帯の下に
 * 潜り込んで読めないか、上に重ねれば「日／週／月」を隠してしまうため。
 * 出す条件・閉じ方・閉じたあと出さない期間は、ホームにあったときから変えていない。
 */
export default function DayStartNotices({
  settings,
  allRecipes,
  /** いまの画面のパス（設定へ飛んだあとここへ帰るために持たせる） */
  currentPath,
}: {
  settings: Settings | undefined
  allRecipes: Recipe[] | undefined
  currentPath: string
}) {
  // 自分のレシピが1件以上あり、30日以上（または一度も）バックアップしていないとき
  const showBackupReminder =
    settings !== undefined &&
    (allRecipes?.some((r) => !r.isStarter) ?? false) &&
    backupOverdue(settings.lastBackupAt)
  const [backupReminderDismissed, setBackupReminderDismissed] = useState(
    () => sessionStorage.getItem(BACKUP_REMINDER_DISMISSED_KEY) === '1',
  )
  const dismissBackupReminder = () => {
    sessionStorage.setItem(BACKUP_REMINDER_DISMISSED_KEY, '1')
    setBackupReminderDismissed(true)
  }

  // アプリ内お知らせ: 起動時に同一オリジンで取得し、最新1件だけを未読なら表示する
  const [news, setNews] = useState<NewsItem[]>([])
  useEffect(() => {
    void fetchNews().then(setNews)
  }, [])
  const latestNews = news[0]
  // 初見ユーザーのファーストビューをお知らせで塞がない: 初回起動から24時間は出さない。
  // 2026-08-04 便DV-10(オーナー指摘): Pro版を解錠済みの人には、販売のお知らせは出さない
  const showNews =
    settings !== undefined &&
    latestNews !== undefined &&
    latestNews.id !== settings.lastSeenNewsId &&
    isNewsVisibleFor(latestNews, !!settings.proCode) &&
    !isNewsSuppressed(settings.firstLaunchAt, Date.now())
  const dismissNews = () => {
    if (latestNews) void updateSettings({ lastSeenNewsId: latestNews.id })
  }

  if (!showNews && !(showBackupReminder && !backupReminderDismissed)) return null

  return (
    <div className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
      {/* バックアップの控えめなうながし(2026-07-16 便S)。タップで設定のバックアップの節へ。
          ×は行内にネストした role="button" でタップ伝播を止めて閉じるだけにする */}
      {showBackupReminder && !backupReminderDismissed && (
        <Link
          to={settingsLinkWithBack('/settings?section=backup', currentPath)}
          data-testid="backup-reminder"
          className="flex items-center gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm text-ink-muted shadow-sm"
        >
          <HardDriveDownload size={16} className="shrink-0 text-accent-ink" aria-hidden />
          <span className="min-w-0 flex-1">{ja.dayStart.backupReminder}</span>
          <span className="shrink-0 font-bold text-accent-ink">{ja.dayStart.backupReminderLink}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              dismissBackupReminder()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                e.stopPropagation()
                dismissBackupReminder()
              }
            }}
            aria-label={ja.common.close}
            className="-m-2 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </span>
        </Link>
      )}

      {/* アプリ内お知らせ（最新1件・未読のときだけ）。
          2026-08-04 便DV-10(オーナー指摘): 紹介ページの「無料で使ってみる」から来た人の
          ファーストビューでいちばん目立つのが有料版の案内では押し売りに見える。
          カード(bg-surface+影+アクセント色のアイコン)をやめ、ページ地の上の控えめな囲みにする */}
      {showNews && latestNews && (
        <div
          data-testid="app-news"
          className="flex items-start gap-2 rounded-md border border-edge bg-app px-[var(--space-md)] py-2 text-sm"
        >
          <Megaphone size={16} className="mt-0.5 shrink-0 text-ink-muted" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-ink">{latestNews.title}</p>
            <p className="text-ink-muted">{latestNews.body}</p>
            {latestNews.link && (
              // アプリ内のリンク(#/…)も外部リンクも同じタブで開く(PWAとしては別タブより自然)
              <a href={latestNews.link} className="text-ink-muted underline">
                {ja.dayStart.newsLinkLabel}
              </a>
            )}
          </div>
          {/* -m-2 + p-3.5: ×の見た目は16pxのまま、タップ領域を44px四方に広げる(帯の高さは増やさない) */}
          <button
            type="button"
            onClick={dismissNews}
            aria-label={ja.common.close}
            className="-m-2 shrink-0 rounded-full p-3.5 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
