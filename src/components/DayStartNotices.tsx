import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HardDriveDownload, Megaphone, X } from 'lucide-react'
import { updateSettings } from '../db/settings'
import { backupNoticeKind } from '../logic/backup'
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
  // 自分のレシピが1品以上あるときだけ見る（守るものが無い人には出さない）。
  // 出す時と言い方は logic/backup.ts の backupNoticeKind が決める:
  //   'overdue' … 前回の書き出しから30日以上
  //   'first'   … 一度も書き出していない人（使い始めから7日たってから・言い方を変える）
  const backupNotice =
    settings !== undefined && (allRecipes?.some((r) => !r.isStarter) ?? false)
      ? backupNoticeKind(settings.lastBackupAt, settings.firstLaunchAt)
      : 'none'
  const showBackupReminder = backupNotice !== 'none'
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
          ×は行内にネストした role="button" でタップ伝播を止めて閉じるだけにする。

          2026-08-27 便LS（オーナー指示）:
          ・並びを左右から上下にした。オーナー原文「この窓の中身は、説明文と『設定のバックアップへ』を
            左右じゃなくて上下に並べた方が読みやすそう。バックアップへは右下に」。
            実測（説明文・行き先・×を1行に押し込んでいた形）: 320px幅で帯の高さが198pxまで伸び、
            説明文が細い柱のように折り返していた
          ・一度も書き出していない人（backupNotice === 'first'）には、**すすめと説明**を出す。
            オーナー追記「初回のみ、バックアップのすすめと説明にすべき→お知らせの文章に」。
            2026-08-26 に便LIが設定の書き出しカードへ置いた1行の行き先がここに移った
            （設定の側からは外した＝オーナー原文「場所が中途半端で目立たない」）。
            31日以上空けた人への うながし（backupReminder）は今までどおり1文のまま */}
      {showBackupReminder && !backupReminderDismissed && (
        <Link
          to={settingsLinkWithBack('/settings?section=backup', currentPath)}
          data-testid="backup-reminder"
          className="block rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-sm text-ink-muted shadow-sm"
        >
          <span className="flex items-start gap-2">
            <HardDriveDownload size={16} className="mt-0.5 shrink-0 text-accent-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block">
                {backupNotice === 'first'
                  ? ja.dayStart.backupReminderFirst
                  : ja.dayStart.backupReminder}
              </span>
              {backupNotice === 'first' && (
                <span data-testid="backup-reminder-first-note" className="mt-0.5 block">
                  {ja.dayStart.backupReminderFirstNote}
                </span>
              )}
            </span>
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
              className="tap-target -m-2 shrink-0 rounded-full p-2 text-ink-muted"
            >
              <X size={16} aria-hidden />
            </span>
          </span>
          {/* 行き先は右下（オーナー指示）。×と同じ行に置くと、閉じるつもりで押してしまう */}
          <span className="mt-1 block text-right font-bold text-accent-ink">
            {ja.dayStart.backupReminderLink}
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
            className="tap-target -m-2 shrink-0 rounded-full p-3.5 text-ink-muted"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      )}
    </div>
  )
}
