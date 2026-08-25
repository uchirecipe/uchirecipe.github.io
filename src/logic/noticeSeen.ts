/**
 * 「初回だけ出すお知らせ」の見た記録（2026-08-13 便GE）。
 *
 * 2026-08-10のホーム画面追加のお知らせ（logic/homeScreenNotice.ts）で決めた作法を、
 * 2つ目のお知らせ（logic/firstSetupNotice.ts）を足すにあたって1か所にまとめたもの。
 * 同じ判断を書き写すと、片方だけ直したときに作法がずれる。
 *
 * 決めてあること:
 *  - 保存先は localStorage（**端末内のみ**・サーバーには送らない）
 *  - 設定（Dexieのsettings）には置かない。設定はバックアップの中身に入るため、
 *    書き出したファイルに「案内を見たかどうか」が混ざる。案内を見たかは端末ごとの事情で、
 *    別の端末に復元したら、その端末ではまだ見ていない＝出るのが正しい
 *  - 読めない環境（プライベートブラウズ等）は「見た」扱いにして**出さない**。
 *    記録を残せない端末では毎回出てしまい、閉じても閉じても現れる窓になる
 *  - 書けなくても黙って諦める（案内が次も出るだけで、失われるものはない）
 */

/** この端末でそのお知らせを見たことがあるか（記録を読めない環境は「見た」扱い） */
export function hasSeenNotice(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1'
  } catch {
    return true
  }
}

/** 見た記録を残す（閉じ方によらず、一度出したら次からは出さない） */
export function markNoticeSeen(key: string): void {
  try {
    window.localStorage.setItem(key, '1')
  } catch {
    // プライベートブラウズ等で書けなくても、案内が出るだけなので黙って諦める
  }
}

/**
 * 見た記録を消す（もう一度出す。2026-08-25 便KO）。
 *
 * 「今後表示しない」を押したあとに**戻せる場所**が要る（設定から出し直せる）。
 * 押した瞬間に二度と出せない形にしないための道で、消せなくても黙って諦める
 * （出し直せないだけで、失われるものはない）。
 */
export function forgetNoticeSeen(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // 書けない端末では出し直せないだけなので、黙って諦める
  }
}
