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
  if (/ストップ|とめて|止めて/.test(transcript)) return 'stop'
  if (/タイマー/.test(transcript)) return 'timer'
  return undefined
}
