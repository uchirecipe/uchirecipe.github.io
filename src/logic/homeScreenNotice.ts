/**
 * ホーム画面への追加を案内する「初回のお知らせ」を出すかどうかの判定（2026-08-10 便EW）。
 *
 * 背景: 以前は紹介ページ(public/about/index.html)の「無料で使ってみる」を押した直後に
 * 割り込みの2択を出していた。オーナー実機の指摘「条件反射で閉じたくなる画面」を受け、
 * 紹介ページ側の割り込みは廃止し、アプリのホーム画面に着いた直後の案内に作り直した。
 *
 * 出す条件は3つとも満たしたときだけ:
 *  ①指で操作する端末（スマートフォン・タブレット）のブラウザで開いている
 *  ②まだホーム画面のアイコンから開いていない（logic/standalone.ts）
 *  ③この端末でまだ見ていない
 *
 * ①をユーザーエージェント文字列で判定していない理由:
 * UA文字列は各ブラウザが互換性のために別の端末を名乗ることがあり（iPadOSのSafariが
 * 既定でMacintoshを名乗る等）、端末を言い当てる用途では外れる。ここで知りたいのは
 * 「端末名」ではなく「ホーム画面にアイコンを置ける操作環境か」なので、入力装置の性質を
 * 直接見る。判定材料は次の3つで、すべて真のときだけ true にする:
 *  - `(pointer: coarse)` … 主な操作装置が指（マウスなら fine）
 *  - `(hover: none)`     … 主な操作装置でカーソルを重ねられない（マウスなら hover）
 *  - `navigator.maxTouchPoints > 0` … タッチ入力そのものがある
 * タッチ画面つきのノートパソコンは maxTouchPoints は正でも、主な操作装置がマウスなので
 * pointer は fine・hover は hover になり、除外される（パソコンには出さない、というオーナーの
 * 意向どおりになる）。逆にタブレットは画面が広くても3つとも満たすので案内が出る＝
 * 画面の幅では判定しない（幅で切ると大型タブレットを取りこぼす）。
 *
 * 見た記録は localStorage（端末内のみ・サーバーには送らない）。設定(Dexieのsettings)に
 * 置かないのは、設定がバックアップの中身に含まれるため。案内を見たかどうかは端末ごとの
 * 事情で、書き出したファイルに混ぜるものではない（別の端末に復元したら、その端末では
 * まだ案内を見ていない＝出るのが正しい）。
 */

import { isLaunchedFromHomeScreen } from './standalone'

/** 見た記録の保存キー（localStorage・端末内のみ） */
export const HOME_SCREEN_NOTICE_SEEN_KEY = 'uchirecipe:homeScreenNoticeSeen'

/** 判定材料（ブラウザから読み取った生の値） */
export interface HomeScreenNoticeEnv {
  /** 指で操作する端末か（スマートフォン・タブレット） */
  touchPrimary: boolean
  /** すでにホーム画面のアイコンから開いているか */
  launchedFromHomeScreen: boolean
  /** この端末でこのお知らせを見たことがあるか */
  seen: boolean
}

/** 初回のお知らせを出すか（3条件すべてを満たしたときだけ true） */
export function shouldShowHomeScreenNotice(env: HomeScreenNoticeEnv): boolean {
  return env.touchPrimary && !env.launchedFromHomeScreen && !env.seen
}

/** 主な操作装置が指か（マウスのパソコンでは false。上のコメントの3材料をすべて見る） */
export function readTouchPrimary(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const noHover = window.matchMedia('(hover: none)').matches
  const touchPoints = typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0
  return coarsePointer && noHover && touchPoints > 0
}

/** この端末でお知らせを見たことがあるか（localStorageが使えない環境では「見た」扱いにして出さない） */
export function hasSeenHomeScreenNotice(): boolean {
  try {
    return window.localStorage.getItem(HOME_SCREEN_NOTICE_SEEN_KEY) === '1'
  } catch {
    return true
  }
}

/** 見た記録を残す（閉じ方によらず、一度出したら次からは出さない） */
export function markHomeScreenNoticeSeen(): void {
  try {
    window.localStorage.setItem(HOME_SCREEN_NOTICE_SEEN_KEY, '1')
  } catch {
    // プライベートブラウズ等で書けなくても、案内が出るだけなので黙って諦める
  }
}

/** 実行環境を見て、初回のお知らせを出すか決める（画面側の入口） */
export function shouldShowHomeScreenNoticeNow(): boolean {
  return shouldShowHomeScreenNotice({
    touchPrimary: readTouchPrimary(),
    launchedFromHomeScreen: isLaunchedFromHomeScreen(),
    seen: hasSeenHomeScreenNotice(),
  })
}
