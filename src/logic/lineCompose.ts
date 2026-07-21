// 読点優先・幅実測の行組みエンジン(2026-07-21 p9/line-compose・p10/compose-refine)。
//
// 【なぜ作るか】従来の改行は wrapJaPhrases() が文節境界にゼロ幅スペースを挿し、
// どこで折るかはブラウザ任せだった。この方式はブラウザが「詰め込み最優先」でしか
// 折れず、「読点で行を終える」美観を作れない・実機iOS Safariと検証用WebKitで折り位置が
// 食い違う、という原理的限界に達した(docs/32 §8)。そこで折り位置そのものを自前で決める。
//
// 【設計】DOM非依存の純ロジック。入力=アトム列 + 最大幅 + 幅測定関数。出力=行ごとのアトム列。
// アトム = テキスト(可分割) | atom(タイマーボタン・用語スパン等の分割不能な箱、実測幅つき)。
// アルゴリズム(句優先グリーディ + 長句だけ罰則DP):
//   1. テキストを「、」「。」の直後で句(clause)に割る(句読点は句の末尾に残す)。改行\nは強制改行。
//      さらに「中身が12字超の長い括弧書き」の開き括弧「（」の直前も句境界にする(要件D)。
//   2. 句が丸ごと行に載るなら載せる(1行に複数句可)。残り幅に入らない句は、新しい行に丸ごと
//      入るなら改行してから置く(=詰め込まない。これが読点優先の本体)。
//   3. 句がまるまる1行にも入らない長さのときだけ、句の内部を wrapJaPhrases() の文節ユニットで
//      充填する。原則グリーディ(従来の見た目=オーナー確認済みを保つ)だが、グリーディが末尾に
//      4字以下の切れ端行を作るときだけ、文法採点付きDP(均等割り+良い切れ目優先)に差し替える
//      (要件A/F)。溢れ句の充填は、現在行が「、」「。」で終わっているときは新しい行から始める(要件B)。
//   4. ・列挙(「・みりん」等)は句内部充填時に wrapJaPhrases のユニットのまま扱う。
// タイマーボタン(直前後の結合文節ごと箱にする)や用語スパンは分割不能な atom として扱い、
// 箱の中身・結合規則(splitAroundTimeToken 等)には一切手を入れない。行への割り付けだけを決める。
import { wrapJaPhrases, ZWSP } from './jaWrap'

/** 行組みエンジンを使うか。false にすると呼び出し側は従来の ZWSP 描画にフォールバックする */
export const LINE_COMPOSE_ENABLED = true

/** 入力アトム。text=可分割テキスト / atom=分割不能な箱(width は実測px、text は復元・検証用) */
export type ComposeAtom =
  | { kind: 'text'; text: string }
  | { kind: 'atom'; id: string; width: number; text?: string }

/** テキスト1本の描画幅を返す測定関数(canvas measureText 等) */
export type MeasureText = (text: string) => number

/** 出力: 行を構成する断片。text=テキストラン / atom=箱(id で実ノードを引く) */
export type LinePiece =
  | { kind: 'text'; text: string }
  | { kind: 'atom'; id: string; text?: string }

export type ComposeOptions = {
  /** 測定誤差の許容(px)。テストでは 0 を渡して 1文字=1幅 の整数判定にする */
  eps?: number
}

type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'atom'; id: string; width: number; text?: string }

type Clause = { pieces: Piece[]; hardBreakBefore: boolean }

// 折返しの最小単位。文節境界と文節境界の間の1まとまり。テキストと箱が混在しうる
// (例: 「こんにゃく+[2分ほど]」や「[下茹で]+して」が1ユニットになりうる)。
type Unit = { parts: LinePiece[]; width: number }

/** 括弧の中身の長さ(閉じ括弧までの文字数。閉じ括弧が無ければ文末まで)。要件Dの長短判定に使う */
const LONG_PAREN_CONTENT = 12

/**
 * 「中身が12字超の長い括弧書き」の開き括弧「（」「(」の全文中オフセット集合。
 * ここを句境界にすると、開き括弧が必ず句の先頭に来る=行頭に置かれ、「（」が行末に
 * ぶら下がる/連体修飾の途中で長い注記が始まる問題(要件D)を防ぐ。短い自己完結括弧
 * (「（約170度）」等・中身12字以下)は対象外=従来どおり句内に留める(jaWrap の nowrap 保護と整合)。
 */
function longParenOpenOffsets(fullText: string): Set<number> {
  const offs = new Set<number>()
  for (let i = 0; i < fullText.length; i++) {
    const ch = fullText[i]
    if (ch !== '（' && ch !== '(') continue
    let j = i + 1
    while (j < fullText.length && fullText[j] !== '）' && fullText[j] !== ')') j++
    // 中身 = 開き括弧の次〜閉じ括弧の手前(閉じ括弧が無ければ文末まで)
    if (j - (i + 1) > LONG_PAREN_CONTENT) offs.add(i)
  }
  return offs
}

/**
 * アトム列を句(clause)へ割る。「、」「。」の直後が句の切れ目・\n は強制改行。
 * さらに「中身12字超の長い括弧」の開き括弧の直前も句の切れ目にする(要件D)。
 * atom(箱)は句の切れ目にはならず、その時点の句に属する(タイマーは句の途中に居られる)。
 */
function toClauses(atoms: ComposeAtom[]): Clause[] {
  const pieceText = (a: ComposeAtom) => (a.kind === 'text' ? a.text : (a.text ?? ''))
  const fullText = atoms.map(pieceText).join('')
  const parenBreaks = longParenOpenOffsets(fullText)
  const clauses: Clause[] = []
  let cur: Piece[] = []
  let pendingHardBreak = false
  let gOff = 0 // 全文中の現在オフセット(code unit)。parenBreaks 照合用
  const flush = () => {
    if (cur.length > 0) {
      clauses.push({ pieces: cur, hardBreakBefore: pendingHardBreak })
      cur = []
      pendingHardBreak = false
    }
  }
  for (const atom of atoms) {
    if (atom.kind === 'atom') {
      // 箱(タイマー・用語)は必ず「（」以外なので括弧境界の起点にはならない。句へそのまま追加
      cur.push({ kind: 'atom', id: atom.id, width: atom.width, text: atom.text })
      gOff += pieceText(atom).length
      continue
    }
    let buf = ''
    for (const ch of atom.text) {
      // D: 長い括弧の開き括弧の直前で句を切る(「（」を次の句の先頭にする)
      if (parenBreaks.has(gOff)) {
        if (buf) {
          cur.push({ kind: 'text', text: buf })
          buf = ''
        }
        flush()
      }
      if (ch === '\n') {
        if (buf) {
          cur.push({ kind: 'text', text: buf })
          buf = ''
        }
        flush()
        pendingHardBreak = true
        gOff += ch.length
        continue
      }
      buf += ch
      if (ch === '、' || ch === '。') {
        cur.push({ kind: 'text', text: buf })
        buf = ''
        flush()
      }
      gOff += ch.length
    }
    if (buf) cur.push({ kind: 'text', text: buf })
  }
  flush()
  return clauses
}

/**
 * 句を文節ユニット列に展開する。
 * 文節境界は「句の全文(箱の中身も込みで連結した文字列)」に wrapJaPhrases をかけて求める。
 * こうすると、用語スパンやタイマーが句の途中に挟まっても「下茹でして」のような文節の
 * まとまりが失われない(箱ごとに wrapJaPhrases を分割呼び出しすると、直後の「して」が
 * 次の文節へ吸収されて泣き別れる。実測で確認済み・受け入れ基準1の要)。
 * そのうえで箱(atom)の内部に落ちた境界だけ取り除き、箱を割らないようにする。
 * 各ユニットはテキスト片と箱片が混在しうる(例: 「こんにゃく」+「[2分ほど]」)。
 */
function clauseUnits(clause: Clause, measure: MeasureText): Unit[] {
  const pieceText = (p: Piece) => (p.kind === 'text' ? p.text : (p.text ?? ''))
  const full = clause.pieces.map(pieceText).join('')
  if (full === '') return []

  // 1) 句の全文に対する文節境界(char offset)の集合
  const boundaries = new Set<number>([0, full.length])
  let off = 0
  for (const u of wrapJaPhrases(full).split(ZWSP)) {
    off += u.length
    boundaries.add(off)
  }

  // 2) 各ピースの char 範囲を求め、箱の内部に落ちた境界は取り除く(箱を割らない)
  const ranges: { piece: Piece; start: number; end: number }[] = []
  let cursor = 0
  for (const p of clause.pieces) {
    const len = pieceText(p).length
    ranges.push({ piece: p, start: cursor, end: cursor + len })
    cursor += len
  }
  for (const r of ranges) {
    if (r.piece.kind !== 'atom') continue
    for (const b of [...boundaries]) if (b > r.start && b < r.end) boundaries.delete(b)
  }

  // 3) 隣り合う境界の間を1ユニットにする。各ユニットは重なるピース片(テキスト/箱)を順に持つ
  const sorted = [...boundaries].sort((a, b) => a - b)
  const units: Unit[] = []
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (b <= a) continue
    const parts: LinePiece[] = []
    let width = 0
    for (const r of ranges) {
      const s = Math.max(a, r.start)
      const e = Math.min(b, r.end)
      if (s >= e) continue
      if (r.piece.kind === 'atom') {
        parts.push({ kind: 'atom', id: r.piece.id, text: r.piece.text })
        width += r.piece.width
      } else {
        const txt = full.slice(s, e)
        parts.push({ kind: 'text', text: txt })
        width += measure(txt)
      }
    }
    if (parts.length > 0) units.push({ parts, width })
  }
  return units
}

// ---- 長句の内部充填(グリーディ + 文法採点付きDP) ----

/** ユニットの連結テキスト(採点・切れ端判定用) */
function unitText(u: Unit): string {
  return u.parts.map((p) => (p.kind === 'text' ? p.text : (p.text ?? ''))).join('')
}
/** ユニットの文字数(切れ端「4字以下」判定は px でなく文字数で見る) */
function unitChars(u: Unit): number {
  return [...unitText(u)].length
}
/** ユニット群(=1行)の文字数合計 */
function groupChars(group: Unit[]): number {
  return group.reduce((s, u) => s + unitChars(u), 0)
}

// 行末が「良い切れ目」= 助詞(を/に/へ/と/や/で/の/が/は/も)・句読点・閉じ括弧で終わる。
// これで終わる行末は自然で、それ以外(活用形「〜った/〜て/〜く」・名詞裸など)は
// 連体修飾や語幹の泣き別れになりやすいので罰則を科す(要件F)。
const GOOD_BREAK_END = /[をにへとやでのがはも、。」』）)]$/
// 罰則DPの重み(単体テスト A/F と、こんにゃく非退行で調整・便AZ 2026-07-21)。
// ・BREAK_PENALTY=49: 悪い切れ目 ≈ 7字分の slack² 相当。良い切れ目を優先させるが、
//   末尾切れ端(RUNT)や複数ユニットの溢れよりは軽い。
// ・RUNT_PENALTY: 句の最終行が RUNT_MAX(4)字以下になる分割は事実上禁止(要件Aの「加えて、」対策)。
// ・OVERFLOW_MULT: 単一ユニットが maxWidth を超える不可避な溢れは重めに(複数ユニットの溢れは別途禁止)。
const BREAK_PENALTY = 49
const RUNT_MAX = 4
const RUNT_PENALTY = 10000
const OVERFLOW_MULT = 4

/**
 * グリーディ充填。現在行が startUsed だけ使用済みの状態から、ユニットを順に詰める。
 * 戻り値は行(=ユニット群)の配列。先頭群は「現在行の続き」として呼び出し側が今の行へ足す。
 */
function greedyGroups(units: Unit[], maxWidth: number, startUsed: number, eps: number): Unit[][] {
  const groups: Unit[][] = []
  let line: Unit[] = []
  let used = startUsed
  for (const u of units) {
    if (line.length > 0 && used + u.width > maxWidth + eps) {
      groups.push(line)
      line = []
      used = 0
    }
    line.push(u)
    used += u.width
  }
  if (line.length > 0) groups.push(line)
  return groups
}

/**
 * 文法採点付きDPで充填(要件A/F)。コスト = Σ(行 slack²) + Σ(非最終行の切れ目罰則) +
 * (最終行が4字以下なら特大罰則)。O(n²)・ユニット数は高々30程度なので軽い。
 * startUsed は先頭行(index 0 の行)が既に使っている幅。
 */
function penaltyGroups(units: Unit[], maxWidth: number, startUsed: number): Unit[][] {
  const n = units.length
  if (n === 0) return []
  const w = units.map((u) => u.width)
  const chars = units.map((u) => unitChars(u))
  const goodEnd = units.map((u) => GOOD_BREAK_END.test(unitText(u)))
  const dp = new Array(n + 1).fill(Infinity)
  const nxt = new Array(n + 1).fill(-1)
  dp[n] = 0
  for (let i = n - 1; i >= 0; i--) {
    let lineW = 0
    let lineCh = 0
    for (let j = i + 1; j <= n; j++) {
      lineW += w[j - 1]
      lineCh += chars[j - 1]
      const totalW = (i === 0 ? startUsed : 0) + lineW
      const slack = maxWidth - totalW
      let c: number
      if (slack < 0) {
        // 溢れ: 複数ユニットで溢れる分割は禁止(単体テスト・実DOMで overflow-wrap を誘発しない)。
        // 単一ユニットが maxWidth を超える不可避な溢れだけ、重めのコストで許容する。
        if (j - i > 1) break
        c = slack * slack * OVERFLOW_MULT
      } else {
        c = slack * slack
      }
      const isLast = j === n
      if (!isLast && !goodEnd[j - 1]) c += BREAK_PENALTY
      if (isLast && lineCh <= RUNT_MAX) c += RUNT_PENALTY
      const total = c + dp[j]
      if (total < dp[i]) {
        dp[i] = total
        nxt[i] = j
      }
    }
  }
  const groups: Unit[][] = []
  let i = 0
  while (i < n && nxt[i] > i) {
    groups.push(units.slice(i, nxt[i]))
    i = nxt[i]
  }
  // 保険: 万一 nxt が張れなかった残りは1ユニット=1行で吐く(理論上到達しないが安全側)
  while (i < n) {
    groups.push([units[i]])
    i++
  }
  return groups
}

/**
 * 1行にも入らない長句を充填する行群を返す。原則グリーディ(オーナー確認済みの見た目を保つ)だが、
 * グリーディが末尾に4字以下の切れ端行を作るときだけ、文法採点付きDPに差し替える(要件A/F)。
 */
function fillLongClause(units: Unit[], maxWidth: number, startUsed: number, eps: number): Unit[][] {
  const greedy = greedyGroups(units, maxWidth, startUsed, eps)
  const last = greedy[greedy.length - 1]
  if (greedy.length >= 2 && last && groupChars(last) <= RUNT_MAX) {
    return penaltyGroups(units, maxWidth, startUsed)
  }
  return greedy
}

/**
 * アトム列を最大幅 maxWidth に収まる行の列へ組む。measure はテキストの実幅を返す。
 * 戻り値は行ごとの LinePiece 列。DOM 非依存・純関数。
 */
export function composeLines(
  atoms: ComposeAtom[],
  maxWidth: number,
  measure: MeasureText,
  opts: ComposeOptions = {},
): LinePiece[][] {
  const eps = opts.eps ?? 0.5
  const clauses = toClauses(atoms)

  const lines: LinePiece[][] = [[]]
  let cur = 0 // 現在行の使用幅

  const lastLine = () => lines[lines.length - 1]
  const newLine = () => {
    lines.push([])
    cur = 0
  }
  const push = (u: Unit) => {
    for (const part of u.parts) lastLine().push(part)
    cur += u.width
  }
  // 現在行の末尾テキストが「、」「。」で終わっているか(要件B: 句読点で終わった行に
  // 次の溢れ句の先頭をぶら下げない)。箱(text)も含めた最後のテキスト片の末尾で判定。
  const lineEndsWithPunct = (): boolean => {
    const line = lastLine()
    for (let k = line.length - 1; k >= 0; k--) {
      const piece = line[k]
      const t = piece.kind === 'text' ? piece.text : (piece.text ?? '')
      if (t.length === 0) continue
      const c = t[t.length - 1]
      return c === '、' || c === '。'
    }
    return false
  }

  for (const clause of clauses) {
    const units = clauseUnits(clause, measure)
    if (units.length === 0) continue
    const cw = units.reduce((s, u) => s + u.width, 0)

    if (clause.hardBreakBefore && lastLine().length > 0) newLine()

    const lineHasContent = lastLine().length > 0
    const remaining = maxWidth - cur

    if (lineHasContent && cw <= remaining + eps) {
      // 句が現在行の残り幅に丸ごと収まる → そのまま同じ行に足す(複数句1行)
      for (const u of units) push(u)
    } else if (cw <= maxWidth + eps) {
      // 残りには入らないが、新しい行になら丸ごと入る → 詰め込まず改行してから置く(読点優先の本体)
      if (lineHasContent) newLine()
      for (const u of units) push(u)
    } else {
      // 1行にも入らない長い句 → 文節ユニットで充填する。
      // 要件B: 現在行が「、」「。」で終わっているなら、充填は新しい行から始める。
      // (句読点終わりでない残置断片=「魚焼きグリル」等の後ろには続けて充填し、
      //  孤立行を作らない。F前半の回帰ガード)。先頭ユニットが残り幅に入らないときも改行する。
      if (lineHasContent && (lineEndsWithPunct() || units[0].width > remaining + eps)) {
        newLine()
      }
      const startUsed = cur // B/残り不足で改行した場合は 0
      const groups = fillLongClause(units, maxWidth, startUsed, eps)
      groups.forEach((group, gi) => {
        if (gi > 0) newLine()
        for (const u of group) push(u)
      })
    }
  }

  if (lines.length > 1 && lastLine().length === 0) lines.pop()
  return lines
}

/** 1行(LinePiece列)を文字列へ復元する(テスト・コピー用途。atom は text を使う) */
export function lineToText(line: LinePiece[]): string {
  return line.map((p) => (p.kind === 'text' ? p.text : (p.text ?? ''))).join('')
}
