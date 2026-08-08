export interface NewsItem {
  id: string
  date: string
  title: string
  body: string
  link?: string
  /**
   * Pro版を解錠済みの人には出さないお知らせか（2026-08-04 便DV-10・オーナー指摘）。
   * 「Pro版の販売を開始しました」は、買った人にとってはもう用の無い案内なのに出続けていた。
   * 販売・解錠に関わるお知らせだけこの印を付ける（機能追加のお知らせは全員に出す）。
   */
  hideWhenPro?: boolean
}

/**
 * このお知らせを表示してよいか（2026-08-04 便DV-10）。
 * hideWhenPro の印が付いたお知らせは、Pro版を解錠済みの人には出さない。
 */
export function isNewsVisibleFor(item: NewsItem, isPro: boolean): boolean {
  return !(item.hideWhenPro === true && isPro)
}

/** 初回起動からお知らせバナーを出さない期間（初見ユーザーのファーストビューを塞がないため） */
const NEWS_QUIET_MS = 24 * 60 * 60 * 1000

/**
 * お知らせバナーを抑制すべきか。
 * 初回起動から24時間は表示しない。firstLaunchAt が未記録（起動直後の一瞬）も
 * 初回起動直後とみなして出さない。既存ユーザーには 0 が入っているので抑制されない。
 */
export function isNewsSuppressed(firstLaunchAt: number | undefined, now: number): boolean {
  if (firstLaunchAt === undefined) return true
  return now - firstLaunchAt < NEWS_QUIET_MS
}

/**
 * public/news.json を同一オリジンから取得する。
 * オフライン・取得失敗時は静かに空配列を返す（console.errorを出さない）。
 * 新しい順（配列の先頭が最新）で書くこと。
 */
export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch('/news.json')
    if (!res.ok) return []
    const data: unknown = await res.json()
    return Array.isArray(data) ? (data as NewsItem[]) : []
  } catch {
    return []
  }
}
