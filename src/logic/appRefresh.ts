/**
 * 「アプリを更新する（表示の不具合を直す）」ボタンの処理本体(2026-07-16新設)。
 *
 * 目的: 古いService Worker/Cache Storageが原因の表示不具合(レシピが追加できない・
 * アイコンが出ない等)を、ブラウザの「Cookieと他のサイトデータ」削除のような
 * 大掛かりな操作を経ずに、アプリ内のボタン1つで直せるようにする。
 *
 * 絶対条件: IndexedDB(レシピ・価格・設定・購入コード等の実データ)には一切触れない。
 * このファイルはDexie/`../db`配下を一切importしない(触れないことをコード上でも保証する)。
 * 消すのはService WorkerとCache Storage(＝再ビルドすれば作り直せる一時ファイル)のみ。
 *
 * 各Web APIは未対応ブラウザで例外を投げて処理が止まらないよう、存在チェック＋
 * try/catchで個別にガードする。途中でどれかが失敗しても、最後のreloadだけは必ず実行する。
 */
export async function refreshApp(): Promise<void> {
  // (a) Service Workerの登録をすべて解除する
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
  } catch {
    // 未対応・失敗しても(b)(c)は続行する
  }

  // (b) Cache Storageの中身をすべて削除する(IndexedDBとは別物。ここでは触れない)
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    // 未対応・失敗しても(c)は続行する
  }

  // (c) ページを再読み込みする。ここまでの(a)(b)がどれだけ失敗していても必ず実行する
  if (typeof window !== 'undefined' && window.location) {
    window.location.reload()
  }
}
