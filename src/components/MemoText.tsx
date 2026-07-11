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

import { wrapJaPhrases } from '../logic/jaWrap'
import TermText from './TermText'
import { findTermMatches } from '../logic/termSplit'
import type { OpenTerm } from './TermPopover'

type Props = {
  text: string
  className?: string
  /** 用語タップ辞書(2026-07-11)。渡すとmemo内の辞書語がタップ可能になる */
  onOpenTerm?: OpenTerm
  /** 手順の本文と用語の既出集合を共有したいとき(同一手順内は1回だけタップ可能にする)に渡す */
  seen?: Set<string>
}

export function MemoText({ text, className, onOpenTerm, seen }: Props) {
  const lines = text.split('\n')
  // 呼び出しごとに1つの集合を使い回し、この関数内(=このmemo1つ分)で用語の既出判定を揃える
  // この実行内で新規作成するコピー(propsのSetは書き換えない=StrictMode二重実行対策)
  const localSeen = new Set(seen)
  const renderSentence = (s: string, key: number) => {
    if (!onOpenTerm) return wrapJaPhrases(s)
    const node = <TermText key={key} text={s} seen={localSeen} onOpenTerm={onOpenTerm} />
    // 次の文のために、この文に含まれる用語を既出へ(splitByTermsは純粋化済みのため自前で更新)
    for (const m of findTermMatches(s)) localSeen.add(m.term.term)
    return node
  }
  return (
    <div className={className ? `ja-phrase ${className}` : 'ja-phrase'}>
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
                  {renderSentence(s, j)}
                </span>
              ))}
            </span>
          </p>
        ) : (
          <p key={i}>
            {splitSentences(line).map((s, j) => (
              <span key={j} className="block">
                {renderSentence(s, j)}
              </span>
            ))}
          </p>
        ),
      )}
    </div>
  )
}
