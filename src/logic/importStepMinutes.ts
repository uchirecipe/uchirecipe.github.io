import { findTimeTokens } from './time'

/**
 * 取り込んだ手順の本文に書かれている時間を、フォームの「分」の欄に入れる値にする
 * （2026-08-08 便ED・docs/68 打ち手#2）。
 *
 * URL取り込み・貼り付け取り込みで作ったレシピは、手順の分数欄が必ず空になる
 * （取り込み処理が手順を文章だけで流し込むため）。そのため本文に「20分煮る」と書いてあっても
 * 分数欄は空のままで、並行調理ナビの待ち時間もタイマーも、その時間を使えていなかった。
 *
 * **本文に書いてある事実の転記だけを行う。機械の推測値は入れない。**
 * 本文に時間表記が無い手順は空のまま（ここで調理法から分数を当てることはしない。
 * ナビが内部で使う既定分数（cookNavi.resolveWaitMinutes）はレシピのデータには書き込まない）。
 *
 * - 複数の時間表記がある手順は**いちばん長いもの**を採る（ナビの待ち分数の解決と同じ規則）
 * - 1分未満（「30秒」だけ）の手順は空のままにする。分の欄に入れると0分や1分に化けるため
 * - 取り込んだ結果は保存前にユーザーが画面で確認でき、直すことも消すこともできる
 */
export function stepMinutesFromText(text: string): number | undefined {
  const tokens = findTimeTokens(text)
  if (tokens.length === 0) return undefined
  // 幅のある書き方（「12〜15分」）は長いほう＝本文が最後に示している時間を写す
  // （タイマーを短いほうで鳴らすのは別の話。2026-08-14 便GK・logic/time.ts）
  const maxSeconds = Math.max(...tokens.map((t) => t.maxSeconds))
  if (maxSeconds < 60) return undefined
  return Math.round(maxSeconds / 60)
}

/** 取り込んだ手順の並びに対して、本文から読み取れた分数（読み取れない手順は undefined）を返す */
export function importedStepMinutes(texts: readonly string[]): (number | undefined)[] {
  return texts.map((text) => stepMinutesFromText(text))
}
