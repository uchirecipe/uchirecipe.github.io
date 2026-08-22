/**
 * 画面を離れる前の「引き止め」の受け口（2026-08-23 便JO）。
 *
 * オーナー原文（レシピを編集）:
 *   「編集終わりのつもりでそのまま保存をせずにページを離れそう。一時保存はされるが、
 *     反映されていないことに気づきにくい。」
 *
 * 直す前の実測: 料理名を書き換えたあと上の「戻る」を押すと、何も出ないままレシピ詳細へ移り、
 * 見出しは元の料理名のまま（＝編集がレシピに入っていない）。下の並びのタブでも同じだった。
 * ブラウザを閉じる・読み込み直すときの確認（beforeunload）は前からあるが、
 * **アプリの中の移動では鳴らない**（ページを読み込み直していないため）ので届いていなかった。
 *
 * なぜ受け口を1つ置くか:
 * このアプリのルーティングは HashRouter + Routes（`src/App.tsx`）で、react-router の
 * 移動を止める仕掛け（useBlocker）は使えない。止められる場所は
 * 「アプリが自分で用意した移動の入口」＝上の「戻る」（components/BackHeader）と
 * 下の並び（components/TabBar）の2つなので、その2つが**同じ1つの受け口**を見る形にする。
 * 画面ごとに別々の止め方を書くと、片方だけ直った状態が生まれる。
 *
 * 決めごと:
 *  ・登録できる引き止めは**一度に1つ**（画面は1つしか開いていない）。
 *    新しく登録したら古いほうは聞かれない＝前の画面の引き止めが二重に出ない
 *  ・画面を離れるとき（アンマウント）に `setLeaveGuard(null)` で必ず解除する。
 *    解除を忘れると、関係のない画面で引き止めが出てしまう
 *  ・引き止めの中で何かが壊れても**通す側に倒す**。聞けなかったことを理由に
 *    画面から出られなくなるのが、いちばん困る壊れ方なので
 *
 * 見張りは scripts/test-logic.mjs の JO-1（この4つの決めごとをそのまま測る）と、
 * scripts/e2e-smoke.mjs の JOLEAVE-02（実際の画面で「戻る」とタブの両方から測る）。
 */

/** 離れてよいか聞く関数。true＝離れてよい／false＝離れない */
type LeaveGuard = () => boolean | Promise<boolean>

let currentGuard: LeaveGuard | null = null

/** 引き止めを登録する（null で解除）。画面を離れるときは必ず null を渡すこと */
export function setLeaveGuard(guard: LeaveGuard | null): void {
  currentGuard = guard
}

/** いま引き止めが登録されているか（呼び出し側が「止める必要があるか」を先に見るため） */
export function hasLeaveGuard(): boolean {
  return currentGuard !== null
}

/** 離れてよいか聞く。引き止めが無ければ、そのまま離れてよい（true） */
export async function askBeforeLeave(): Promise<boolean> {
  const guard = currentGuard
  if (!guard) return true
  try {
    return await guard()
  } catch {
    // 聞けなかったときは通す（画面から出られなくなるのを避ける）
    return true
  }
}
