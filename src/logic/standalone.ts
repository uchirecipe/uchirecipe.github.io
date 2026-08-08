/**
 * ホーム画面のアイコンから起動しているか（PWAの表示モード）の判定。
 *
 * 設定の「ホーム画面への追加方法」への導線は、すでにホーム画面から起動している人には出さない
 * （2026-08-09 便EI）。判定材料は2つあり、どちらか一方でも真ならアイコン起動とみなす:
 *  - `window.matchMedia('(display-mode: standalone)')`: Android(Chrome)・パソコンはこれで分かる
 *  - `navigator.standalone`: iOS(Safari)の非標準プロパティ。iOSは古い版でdisplay-modeを
 *    返さないことがあるため、こちらも見る
 *
 * ブラウザ依存の読み取りは readDisplayModeEnv に閉じ込め、判定そのものは純関数
 * (isStandaloneDisplay) にしてある（単体テストで固定するため）。
 */

/** 表示モードの判定材料（ブラウザから読み取った生の値） */
export interface DisplayModeEnv {
  /** matchMedia('(display-mode: standalone)').matches の値。読めない環境では false */
  displayModeStandalone: boolean
  /** navigator.standalone（iOS Safari のみ存在する非標準プロパティ）の値。無ければ false */
  navigatorStandalone: boolean
}

/** アイコン起動（standalone表示）かどうか。どちらか一方でも真なら true */
export function isStandaloneDisplay(env: DisplayModeEnv): boolean {
  return env.displayModeStandalone || env.navigatorStandalone
}

/** 現在のブラウザから判定材料を読み取る（値が読めない環境ではすべて false 扱い） */
export function readDisplayModeEnv(): DisplayModeEnv {
  const displayModeStandalone =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(display-mode: standalone)').matches
      : false
  const navigatorStandalone =
    typeof navigator !== 'undefined' &&
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  return { displayModeStandalone, navigatorStandalone }
}

/** ホーム画面のアイコンから起動しているか（実行環境を見て判定する入口） */
export function isLaunchedFromHomeScreen(): boolean {
  return isStandaloneDisplay(readDisplayModeEnv())
}
