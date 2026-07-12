import type { ReactNode } from 'react'
import { wrapJaPhrases, ZWSP } from '../logic/jaWrap'

/**
 * ZWSP区切り済み文字列(wrapJaPhrasesの出力)を描画ノードにする。
 * 「（」で始まる単位はnowrapスパンで包む: WebKitはword-break:keep-allの下でも
 * 全角開き括弧の直後を改行可能として扱うため、「〜にする（/レンジ600Wで…」のように
 * 開き括弧が行末に取り残される(行末禁則違反)。ZWSP・WORD JOINERでは防げないことを
 * プローブで確認済み(2026-07-12・Chromiumは正しく括弧の前で折る)。
 * nowrapスパン(atomic inline)は前後が改行点になるが、単位境界はもともと改行点なので無害。
 */
export function wrappedToNodes(wrapped: string): ReactNode {
  // 開き括弧を「含む」単位すべてが対象: WebKitはkeep-allの下でも括弧の直後を
  // 改行可能として扱うため、「すだち(またはレモン)を」のような結合済み単位の
  // 内部でも折れてしまう(2026-07-12実機で確認)。12文字以下ならまるごとnowrapで守る
  const needsSpan = (u: string) => /[（(]/.test(u) && u.length <= 12
  if (!wrapped.split(ZWSP).some(needsSpan)) return wrapped
  const nodes: ReactNode[] = []
  wrapped.split(ZWSP).forEach((u, i) => {
    if (i > 0) nodes.push(ZWSP)
    nodes.push(
      needsSpan(u) ? (
        <span key={i} className="whitespace-nowrap">
          {u}
        </span>
      ) : (
        u
      ),
    )
  })
  return nodes
}

/** テキストを文節折返し済みの描画ノードにする(wrapJaPhrases+wrappedToNodes) */
export function renderJaUnits(text: string): ReactNode {
  return wrappedToNodes(wrapJaPhrases(text))
}
