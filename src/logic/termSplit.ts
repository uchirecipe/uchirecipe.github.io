// 用語タップ辞書(src/data/cookingTerms.ts)の最長一致分割ロジック(2026-07-11)。
// テキストを「辞書語のスパン」と「それ以外のテキスト」に分割する。
// Reactに依存しない純粋関数にして、scripts/test-logic.mjsから直接検証できるようにしてある。
import { COOKING_TERMS, type CookingTerm } from '../data/cookingTerms'

export interface TermMatch {
  term: CookingTerm
  /** マッチした実際の文字列(termそのもの、またはaliasesのいずれか) */
  text: string
  start: number
  end: number
}

export type TermSegment =
  | { type: 'text'; text: string }
  | { type: 'term'; match: TermMatch; tappable: boolean }

interface TermEntry {
  match: string
  term: CookingTerm
}

let entriesCache: TermEntry[] | null = null

/** term/aliasesを1本のリストに展開し、長い表記から先に照合できるよう長さ降順に並べる */
function getEntries(): TermEntry[] {
  if (entriesCache) return entriesCache
  const list: TermEntry[] = []
  for (const term of COOKING_TERMS) {
    list.push({ match: term.term, term })
    for (const alias of term.aliases ?? []) {
      list.push({ match: alias, term })
    }
  }
  list.sort((a, b) => b.match.length - a.match.length)
  entriesCache = list
  return list
}

/**
 * テキスト中の辞書語を最長一致(その開始位置で最も長くマッチする表記を採用)で走査する。
 * 一度マッチした範囲は次の探索の開始位置として使い、重なりは作らない。
 */
export function findTermMatches(text: string): TermMatch[] {
  const entries = getEntries()
  const matches: TermMatch[] = []
  let i = 0
  while (i < text.length) {
    let matched = false
    for (const entry of entries) {
      if (text.startsWith(entry.match, i)) {
        matches.push({ term: entry.term, text: entry.match, start: i, end: i + entry.match.length })
        i += entry.match.length
        matched = true
        break
      }
    }
    if (!matched) i++
  }
  return matches
}

/**
 * findTermMatchesの結果をテキスト全体のセグメント列に組み立てる。
 * seenは「このブロック(手順・memo等)内で既にタップ可能として出した用語」の集合。
 * 同じ語の2回目以降はtappable:falseにする(ノイズ防止・オーナー仕様)。
 * seenは呼び出し側でブロック単位(例: 1手順のtext+memo)に使い回すことで、
 * ブロックをまたいだ描画順(text→memo)のまま重複判定される。
 */
export function splitByTerms(text: string, seenInput: Set<string>): TermSegment[] {
  // 純粋関数にする: 引数のseenは読み取りのみで書き換えない(2026-07-11修正)。
  // レンダー中にpropsのSetを破壊するとReact StrictModeの二重実行で
  // 2回目に全語が「既出」扱いになり、開発モードでのみタップ不能になる実バグがあった。
  const seen = new Set(seenInput)

  const matches = findTermMatches(text)
  if (matches.length === 0) return [{ type: 'text', text }]

  const segments: TermSegment[] = []
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) {
      segments.push({ type: 'text', text: text.slice(cursor, match.start) })
    }
    const key = match.term.term
    const tappable = !seen.has(key)
    if (tappable) seen.add(key)
    segments.push({ type: 'term', match, tappable })
    cursor = match.end
  }
  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) })
  }
  return segments
}

/** 手順のtext+memoに含まれる辞書語をユニークに列挙する(調理中モードの用語チップ用) */
export function collectUniqueTerms(...texts: (string | undefined)[]): CookingTerm[] {
  const seen = new Set<string>()
  const result: CookingTerm[] = []
  for (const text of texts) {
    if (!text) continue
    for (const match of findTermMatches(text)) {
      if (!seen.has(match.term.term)) {
        seen.add(match.term.term)
        result.push(match.term)
      }
    }
  }
  return result
}
