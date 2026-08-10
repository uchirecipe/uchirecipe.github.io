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
import { NAVI_COLOR_SPEECH } from './naviColors'

export type VoiceCommand = 'next' | 'prev' | 'repeat' | 'stop' | 'resume' | 'timer'

/**
 * 聞き取れた文字列（空白は呼び出し側で除去済み）からコマンドを判定する。
 * どれにも当てはまらなければ undefined（画面側は手応えも出さない＝従来どおり）。
 *
 * 判定の順番（前から順に当てる）:
 *   次へ → 戻って → 再開 → ストップ → 読み上げ → タイマー
 * 「タイマー」を最後にするのは、「タイマーストップ」「タイマー再開」を新規起動にしないため。
 * 2026-08-10 便FC: **ストップを読み上げより先**にした。読み上げの語を「読み上げ」に変えた
 * （下記）ことで、「読み上げストップ」と続けて言われる形が生まれるため。
 */
export function matchVoiceCommand(transcript: string): VoiceCommand | undefined {
  if (/次|つぎ/.test(transcript)) return 'next'
  if (/戻|もど|前へ|まえ/.test(transcript)) return 'prev'
  // 2026-08-10 便FC（オーナー実機「一時停止の後に音声操作で再開できない」）:
  // 止める声（ストップ）はあるのに、動かし直す声が無かった。
  // **主に受ける言い方は「再開」**＝画面のボタンと同じ語にそろえる（案内文どおりの語が
  // 判定から漏れていた便CK/④-1と同型の事故を防ぐ）。オーナー案の「スタート」も受ける。
  // かなで返る端末（「さいかい」「すたーと」）も同じ扱い
  if (/再開|さいかい|スタート|すたーと/.test(transcript)) return 'resume'
  // 2026-08-10 便EZ（オーナー実機「『ストップ』は聞き取れていてもタイマーとまらない」）:
  // ここは元から 'stop' を返せていた＝聞き取りは合っていた。効かなかったのは画面側で
  // 'stop' を読み上げの停止にしか繋いでいなかったため。かなで返る端末（「すとっぷ」）と、
  // 「タイマーストップ」のようにタイマーの語と一緒に言う形も受ける。
  // 「一時停止」（2026-08-10 便FCで画面のボタンをこの語に変えた）もここに当たる
  if (/ストップ|すとっぷ|とめて|止めて|停止/.test(transcript)) return 'stop'
  // 「1」だけを見ていたため「もう一回」(漢数字)「もういっかい」が漏れていた(便CK/④-1)。
  // 音声認識は同じ発話を「もう一回」「もう1回」「もういっかい」のどれでも返しうるので、
  // 数字は半角・全角・漢数字を、読みはかなも受け付ける。
  // 2026-08-10 便FC（オーナー実機「『もう一度』で読み上げは、1回目からになるので
  // 『読み上げ』に変更」）: **主に受ける言い方は「読み上げ」**＝画面のボタン名と同じ語。
  // 「もう一回」系は今までどおり受ける（言い慣れた人が黙らされないため）
  if (/読み上げ|よみあげ/.test(transcript)) return 'repeat'
  if (/もう[1１一]?[回度]|もういっかい|もういちど/.test(transcript)) return 'repeat'
  if (/タイマー/.test(transcript)) return 'timer'
  return undefined
}

/**
 * 色の言葉（「青」「緑」「ピンク」）を、レシピ色の添字（0/1/2）に変える
 * （2026-08-10 便FI・docs/69 第3段「色で実行を引き寄せる」）。
 *
 * **`matchVoiceCommand` には入れない**。色は判定順のいちばん最後＝上のコマンドが1つも
 * 当たらなかったときにだけ試す（呼び出し側 useVoiceCommands がその順で呼ぶ）。
 * 「タイマーストップ」のような複合の言い方が先に決まってから色を見る形にしておくと、
 * 語を足したときに順番が崩れない。
 *
 * **当てるのは「発話まるごとが色の名前と一致したとき」だけ**。部分一致にすると
 * 「青ねぎを切る」「緑黄色野菜を加える」「ピンクペッパーをふる」で手順が飛んでしまう
 * （台所では、なぜ画面が変わったのか分からない事故になる）。
 * 端末が付ける句読点だけは落としてから比べる。
 */
export function matchVoiceColor(transcript: string): number | undefined {
  const word = transcript.replace(/[\s。、．，.!！?？]/g, '')
  if (!word) return undefined
  const index = NAVI_COLOR_SPEECH.findIndex((forms) => forms.includes(word))
  return index === -1 ? undefined : index
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
 * 声の「再開」で動かし直すタイマーを1本選ぶ（2026-08-10 便FC）。
 *
 * 選び方は `pickVoiceStopTarget` の裏返しにそろえる。
 *   1. **一時停止中のタイマーだけ**が対象（動いているもの・終わったものは選ばない）
 *   2. いま画面に大きく出している料理のものを最優先
 *   3. 無ければ**残りがいちばん短い**もの＝動かせばいちばん先に鳴る1本
 *
 * 残りの比べ方だけは止めるときと違う。一時停止中は時計が止まっていて `endsAt` が
 * 過去のまま固まっているので、**残りは `pausedRemainingMs` で比べる**（`endsAt` で比べると
 * 止めた順に選んでしまい、「次に鳴るはずだった1本」から外れる）。
 *
 * 選び違えても、もう一度「ストップ」と言えば止め直せる（可逆・非破壊。docs/69「音声の規律」）。
 */
export function pickVoiceResumeTarget<T extends VoiceStopTimer>(
  timers: readonly T[],
  currentRecipeId?: number,
): T | undefined {
  const paused = timers.filter((t) => !t.done && t.pausedRemainingMs != null)
  if (paused.length === 0) return undefined
  const shortest = (list: readonly T[]) =>
    list.reduce((best, t) => ((t.pausedRemainingMs ?? 0) < (best.pausedRemainingMs ?? 0) ? t : best))
  const mine = currentRecipeId == null ? [] : paused.filter((t) => t.recipeId === currentRecipeId)
  return shortest(mine.length > 0 ? mine : paused)
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
