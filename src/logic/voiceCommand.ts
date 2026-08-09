/**
 * 調理中モードの「声で操作」のコマンド判定（2026-07-30 便CK/④-1）。
 *
 * もとは FocusMode.tsx の onresult の中に正規表現を直書きしていたため、
 * 「もう一回」（漢数字）と「もういっかい」が読み上げのパターンから漏れていても
 * 誰も気づけなかった（案内文 ja.focus.micHint はまさにその「もう一回」で案内しており、
 * 発話しても読み上げも「聞き取りました」の手応えも出ない完全無反応だった）。
 *
 * 判定を純ロジックとして切り出し、scripts/test-logic.mjs で語形ごとに固定する。
 * 分岐の優先順位は従来のif-elseの順番をそのまま保つ（「次へ」→「戻って」→読み上げ→
 * ストップ→タイマー）。
 */
export type VoiceCommand = 'next' | 'prev' | 'repeat' | 'stop' | 'timer'

/**
 * 聞き取れた文字列（空白は呼び出し側で除去済み）からコマンドを判定する。
 * どれにも当てはまらなければ undefined（画面側は手応えも出さない＝従来どおり）。
 */
export function matchVoiceCommand(transcript: string): VoiceCommand | undefined {
  if (/次|つぎ/.test(transcript)) return 'next'
  if (/戻|もど|前へ|まえ/.test(transcript)) return 'prev'
  // 「1」だけを見ていたため「もう一回」(漢数字)「もういっかい」が漏れていた(便CK/④-1)。
  // 音声認識は同じ発話を「もう一回」「もう1回」「もういっかい」のどれでも返しうるので、
  // 数字は半角・全角・漢数字を、読みはかなも受け付ける
  if (/もう[1１一]?[回度]|もういっかい|もういちど/.test(transcript)) return 'repeat'
  // 2026-08-10 便EZ（オーナー実機「『ストップ』は聞き取れていてもタイマーとまらない」）:
  // ここは元から 'stop' を返せていた＝聞き取りは合っていた。効かなかったのは画面側で
  // 'stop' を読み上げの停止にしか繋いでいなかったため。かなで返る端末（「すとっぷ」）と、
  // 「タイマーストップ」のようにタイマーの語と一緒に言う形も受ける
  // （タイマーの語より先に判定するので、「タイマーストップ」は新規起動にならない）
  if (/ストップ|すとっぷ|とめて|止めて|停止/.test(transcript)) return 'stop'
  if (/タイマー/.test(transcript)) return 'timer'
  return undefined
}

/** 「ストップ」でどのタイマーを止めるかを決めるのに要る最小限の形（ActiveTimer はこれを満たす） */
export interface VoiceStopTimer {
  done: boolean
  endsAt: number
  recipeId: number
  /** 一時停止中の残り（ミリ秒）。値が入っていれば既に止まっている */
  pausedRemainingMs?: number
}

/**
 * 声の「ストップ」で一時停止するタイマーを1本選ぶ（2026-08-10 便EZ）。
 *
 * **複数のタイマーが動いているとき、どれを止めるのかを決めておく**（推測で実装しない）。
 *   1. 動いているタイマーだけが対象。終わったもの・すでに止めてあるものは選ばない
 *      （終わった行を片付けるのは削除＝取り消せないので、声では受けない。docs/69「音声の規律」）
 *   2. **いま画面に大きく出している料理**のタイマーを最優先で選ぶ。声で操作できるのは
 *      調理中モードと並行調理ナビの調理中画面だけで、どちらも「いま見ている1手順」が必ずある。
 *      話し手が見ているものと止まるものを一致させるのが、台所でいちばん外れにくい
 *   3. その料理のものが無ければ、**残りがいちばん短い**もの＝次に鳴る1本を選ぶ。
 *      手が離せずに「ストップ」と言う相手は、たいてい今まさに鳴りかけているタイマーになる
 *   4. 同じ料理の中に複数あるときも、残りがいちばん短いものを選ぶ
 *
 * 選び違えても**一時停止**なので、言い直すか画面の「再開」で元に戻せる（可逆・非破壊）。
 */
export function pickVoiceStopTarget<T extends VoiceStopTimer>(
  timers: readonly T[],
  currentRecipeId?: number,
): T | undefined {
  const running = timers.filter((t) => !t.done && t.pausedRemainingMs == null)
  if (running.length === 0) return undefined
  const soonest = (list: readonly T[]) =>
    list.reduce((best, t) => (t.endsAt < best.endsAt ? t : best))
  const mine = currentRecipeId == null ? [] : running.filter((t) => t.recipeId === currentRecipeId)
  return soonest(mine.length > 0 ? mine : running)
}

/**
 * 「タイマー」と言われたときに何秒ではかるかを決める（2026-08-03 便DS/実機FB⑤）。
 * ①発話の中の「◯分」→②その手順に設定された分数→③手順の文章の最初の時間表記、の順に探す。
 * どれも無ければ undefined を返す＝時間を決められない。画面側はこのときに
 * 言い方の案内（ja.focus.micTimerHint）を出す。
 * 以前はこの判定が画面に直書きされていて、undefined のときに何も起こらず黙って終わっていた。
 */
export function resolveVoiceTimerSeconds(
  transcript: string,
  stepMinutes: number | undefined,
  fallbackSeconds: number | undefined,
): number | undefined {
  const minuteMatch = transcript.match(/(\d+)分/)
  if (minuteMatch) {
    const seconds = Number(minuteMatch[1]) * 60
    // 「0分タイマー」は時間として使えないので、下の候補に譲る
    if (seconds > 0) return seconds
  }
  if (stepMinutes && stepMinutes > 0) return stepMinutes * 60
  if (fallbackSeconds && fallbackSeconds > 0) return fallbackSeconds
  return undefined
}
