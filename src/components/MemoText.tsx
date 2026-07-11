/**
 * memo本文の表示用コンポーネント(R12・2026-07-11)。
 * ・改行で行に分け、「・」で始まる行は箇条書き(ぶら下げインデント)として描画する
 * ・各行はさらに「。」ごとに改行して表示する(2026-07-11オーナー要望:
 *   「手順のメモも、内容ごとか『。』で改行するように」。括弧内の「。」では切らない)
 * ・をテキストに直置きすると日本語の折り返し規則(・の直後で改行可)により
 * 「・」だけが行末に取り残されることがあるため、行頭記号は独立したboxにしている。
 */
function splitSentences(line: string): string[] {
  const parts: string[] = []
  let depth = 0
  let buf = ''
  for (const ch of line) {
    buf += ch
    if (ch === '（' || ch === '(') depth++
    else if (ch === '）' || ch === ')') depth--
    else if (ch === '。' && depth <= 0) {
      parts.push(buf)
      buf = ''
    }
  }
  if (buf.trim()) parts.push(buf)
  return parts.length > 0 ? parts : [line]
}

export function MemoText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className}>
      {lines.map((line, i) =>
        line.startsWith('・') ? (
          // 中央揃えの文脈(調理中モード)でも箇条書きは左揃えで読ませる
          <p key={i} className="flex text-left">
            <span aria-hidden="true" className="shrink-0">
              ・
            </span>
            <span className="min-w-0 flex-1">
              {splitSentences(line.slice(1)).map((s, j) => (
                <span key={j} className="block">
                  {s}
                </span>
              ))}
            </span>
          </p>
        ) : (
          <p key={i}>
            {splitSentences(line).map((s, j) => (
              <span key={j} className="block">
                {s}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
