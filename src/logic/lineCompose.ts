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
import { wrapJaPhrases, normalizedSegments, ZWSP } from './jaWrap'

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
  /**
   * 要件4(便BA): 行末の「、」「。」を枠外にぶら下げる hanging-punctuation:allow-end が効く
   * ブラウザ(WebKit系)で true。true のとき、行末が「、」「。」の候補行は、その1字分の幅を
   * 差し引いて収まり判定する(実際は入る行を句読点1字で諦めるのを防ぐ)。Chromium は非対応なので
   * 呼び出し側(ComposedStepText)が CSS.supports で false を渡し、従来どおりはみ出し防止側に倒す。
   */
  hangingPunct?: boolean
}

type Piece =
  | { kind: 'text'; text: string }
  | { kind: 'atom'; id: string; width: number; text?: string }

type Clause = { pieces: Piece[]; hardBreakBefore: boolean }

// 折返しの最小単位。文節境界と文節境界の間の1まとまり。テキストと箱が混在しうる
// (例: 「こんにゃく+[2分ほど]」や「[下茹で]+して」が1ユニットになりうる)。
// bunchBreakBefore: 指摘1(便BB)の「連続格助詞『を』の過結合を解した」境界で始まるユニット。
// このユニットの直前は、句が1行に収まらず折り返すときは必ず改行する(「白菜と豚肉を / 切り口を…」)。
type Unit = { parts: LinePiece[]; width: number; bunchBreakBefore?: boolean }

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
      // 要件1(便BA): 箱のtext(bondNextに読点/句点が入った「10分煮て、」等)が「、」「。」で
      // 終わるときは、その箱の直後を句境界にする。従来は text ピースの句読点しか見ておらず、
      // 箱内の読点が句を閉じないため「煮て、」の後に次句「煮えた」を詰め込んでいた(寄せ鍋の実機バグ)。
      const bt = pieceText(atom)
      const bc = bt[bt.length - 1]
      if (bc === '、' || bc === '。') flush()
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
  // 要件2(便BA): タイマー箱の直後を必ずユニット境界にする。splitAroundTimeToken は箱に密着させたい
  // 文節を既に bondPrev/bondNext として箱の中へ取り込んでいるので、箱の後ろのテキスト(post)は
  // 独立した文節。ところが clauseUnits は句の全文に wrapJaPhrases をかけ直すため、時間トークン直後は
  // 折り返さない規則で「油で[1分]二度揚げすると」のように後続の長い文節まで1ユニットへ再結合され、
  // 巨大な分割不能ユニットが「の / 油で」の泣き別れを生む(からあげの実機)。箱の末尾に境界を足して
  // 後続文節を切り離す(境界を足すだけ=折り返しを許すだけで、悪い切れ目なら罰則DP/借用が抑える)。
  // ただし箱が「〜」で終わる範囲つなぎ(冷蔵庫で30分〜|1時間…)は割ってはいけないので除外する(要件9)。
  // さらに、箱の直後が別の箱(用語「下茹で」等)のときは境界を足さない: タイマー+直後の用語は
  // 「2分ほど下茹で(で2分ゆでる)」のように時間が直後の動作を修飾する自然な組で、オーナー承認済みの
  // こんにゃく基準1「こんにゃくを[2分ほど]下茹でして」を割ってはいけない。地の文が続くとき(からあげ
  // 「[1分]二度揚げすると」・水ようかん「[2分ほど]しっかり」)だけ、後続文節を切り離す。
  for (let ri = 0; ri < ranges.length; ri++) {
    const r = ranges[ri]
    if (r.piece.kind !== 'atom') continue
    const t = r.piece.text ?? ''
    if (!/\d\s*(分|時間|秒)/.test(t) || t.endsWith('〜')) continue
    const nextPiece = ranges[ri + 1]?.piece
    if (nextPiece && nextPiece.kind === 'atom') continue // 直後が箱(用語)=タイマーの動作。割らない
    // 箱直後の文節(=r.end から次の wrapJaPhrases 境界まで)が「、」「。」で終わるなら境界を足さない:
    // それは時間トークンの動作の言い切り(「[3分]加熱し、」)で、箱に続けたまま1ユニットにするのが自然
    // (割ると「[3分] / 加熱し、」のように短い言い切りが孤立する。バンバンジーの実機退行を防ぐ)。
    // 「二度揚げすると」「しっかり」のような言い切りでない後続文節だけ切り離す。
    let nb = full.length
    for (const bb of boundaries) if (bb > r.end && bb < nb) nb = bb
    const nextSeg = full.slice(r.end, nb)
    if (/[、。]$/.test(nextSeg)) continue
    boundaries.add(r.end)
  }

  // 指摘1(便BB): 連続する格助詞「を」句の過結合を解す境界を足す。jaWrap は「白菜と豚肉を」+
  // 「切り口を」を1ユニット「白菜と豚肉を切り口を」に結合するため、1行に「を」止まり文節が2つ
  // 詰まる(オーナー実機・白菜と豚しゃぶ手順3)。結合前の細分節(normalizedSegments)を使い、
  // マージ済みユニット内に「を」止まり文節が2つ以上あるものだけ、内部の「を」境界(末尾以外)を
  // ユニット境界へ昇格し、そこで始まるユニットに bunchBreakBefore 印を付ける。句が1行に収まる幅なら
  // 従来どおり1行に置く(印は折り返し時のみ効く=過剰分割しない)。折り返すときだけ、印の直前で必ず
  // 改行して連続格助詞を分ける(greedy/DP が構造的に強制。px 実測では slack² が支配的でコスト罰則は
  // 効かないため構造で実現)。箱(タイマー/用語)に重なる
  // ユニットは対象外(格助詞分割は地の文だけ)。「を」止まり文節が1つのユニット(「鮭の皮目を下にして」
  // 等)は非対象=借用パスの承認済み挙動を壊さない。
  // woSplitOffsets: ここで昇格した「を」境界のオフセット集合。ここで始まるユニットは、句が折り返す
  // ときに必ず改行する(「白菜と豚肉を」の直後で切る)。自然に隣り合っただけの2つの「を」句
  // (「しょうがを」|「混ぜ合わせてたれを」=間に動詞。過結合ではない)には印を付けない=巻き添えを防ぐ。
  const woSplitOffsets = new Set<number>()
  {
    const fineEnds: { start: number; end: number; isWo: boolean }[] = []
    let fo = 0
    for (const s of normalizedSegments(full)) {
      const start = fo
      fo += s.length
      fineEnds.push({ start, end: fo, isWo: /を$/.test(s) })
    }
    const atomRanges = ranges.filter((r) => r.piece.kind === 'atom')
    const sortedB = [...boundaries].sort((a, b) => a - b)
    for (let bi = 0; bi < sortedB.length - 1; bi++) {
      const a = sortedB[bi]
      const b = sortedB[bi + 1]
      if (atomRanges.some((r) => r.start < b && r.end > a)) continue
      const woInUnit = fineEnds.filter((f) => f.start >= a && f.end <= b && f.isWo)
      if (woInUnit.length < 2) continue
      for (const f of woInUnit) if (f.end < b) { boundaries.add(f.end); woSplitOffsets.add(f.end) } // 末尾以外の「を」境界を昇格
    }
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
    // 「を」バンチ分割で昇格した境界 a で始まるユニットは、折り返し時に必ずその手前で改行する(指摘1)
    if (parts.length > 0) units.push({ parts, width, bunchBreakBefore: woSplitOffsets.has(a) })
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
// うち「強い切れ目」= 目的語/主題の助詞(を/は/も)・句読点・閉じ括弧。文の大きな区切りで、
// 借用パス(F-2)はまずこの強い切れ目までの借用を優先する(を=強 と の/に=弱 を区別。
// 「下にして」を「下に|して」で割らず「鮭の皮目を|下にして焼く。」で止めるための序列)。
const STRONG_BREAK_END = /[をはも、。」』）)]$/
// 良い切れ目の語彙判定(2026-07-22 便BA・要件7)。GOOD_BREAK_END は末尾1文字しか見ないため、
// 副助詞・程度表現「ほど/まで/くらい/ぐらい/など/ずつ」で終わる文節を悪い切れ目扱いしていた
// (「1〜2分ほど|しっかり…」で「ほど」の後を悪い切れ目と誤判定→「しっかり|煮て」を割る水ようかんの実機)。
// これらの語尾で終わる行末も良い切れ目として認める。1文字判定と両立させるため末尾語彙で追加照合する。
const GOOD_BREAK_SUFFIX = /(ほど|まで|くらい|ぐらい|など|ずつ)$/
/** 行末テキストが「良い切れ目」で終わるか(1文字の助詞・句読点・閉じ括弧、または程度副助詞の語尾) */
function isGoodBreakEndText(text: string): boolean {
  if (text === '') return true
  return GOOD_BREAK_END.test(text) || GOOD_BREAK_SUFFIX.test(text)
}
/** 文末(句点「。」)で終わるか。要件3で「。」止まりの最終行を切れ端(runt)から除外するのに使う */
function endsWithPeriod(text: string): boolean {
  return /。$/.test(text)
}
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
 * corr は要件4のぶら下げ補正: 行末になるユニットが「、」「。」で終わるとき、その1字分の幅を
 * 判定から差し引く(hanging-punctuation:allow-end 対応ブラウザで枠外にぶら下がるため)。
 */
function greedyGroups(units: Unit[], maxWidth: number, startUsed: number, eps: number, corr: (u: Unit) => number): Unit[][] {
  const groups: Unit[][] = []
  let line: Unit[] = []
  let used = startUsed
  for (const u of units) {
    // 指摘1(便BB): 過結合を解した「を」境界で始まるユニット(bunchBreakBefore)は、幅に余裕が
    // あっても改行して連続格助詞を同じ行に詰めない(「白菜と豚肉を / 切り口を…」)。実DOMは px 実測で
    // slack² が大きく、コスト罰則では均等割り(=詰め込み)に負けるため、構造的な強制改行で実現する。
    // clauseUnits の「を」分割が顕在化した境界だけが対象=自然に隣接しただけの「を」句は巻き込まない。
    if (line.length > 0 && (u.bunchBreakBefore || used + u.width - corr(u) > maxWidth + eps)) {
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
function penaltyGroups(units: Unit[], maxWidth: number, startUsed: number, corr: (u: Unit) => number): Unit[][] {
  const n = units.length
  if (n === 0) return []
  const w = units.map((u) => u.width)
  const chars = units.map((u) => unitChars(u))
  const cor = units.map((u) => corr(u)) // 要件4: 行末が「、」「。」のときのぶら下げ補正(px)
  const bbb = units.map((u) => u.bunchBreakBefore === true) // 指摘1: 「を」バンチ分割で始まるユニット
  // 要件3: 句点「。」で終わる最終行は切れ端とみなさない(runt罰則を科さない)。
  const lastEndsPeriod = endsWithPeriod(unitText(units[n - 1]))
  const dp = new Array(n + 1).fill(Infinity)
  const nxt = new Array(n + 1).fill(-1)
  dp[n] = 0
  for (let i = n - 1; i >= 0; i--) {
    let lineW = 0
    let lineCh = 0
    for (let j = i + 1; j <= n; j++) {
      lineW += w[j - 1]
      lineCh += chars[j - 1]
      // 指摘1(便BB): 「を」バンチ分割で始まるユニット(bbb)を行の途中に含む分割は不可。行を
      // その手前で閉じさせる。グリーディと同じ「連続する『を』句を同じ行に詰めない」規則を DP でも
      // 構造的に守る(px 実測では slack² が支配的でコスト罰則が効かないため、実現可能集合から外す)。
      if (j - 1 > i && bbb[j - 1]) break
      // 行末ユニット(j-1)が「、」「。」で終わるならその1字分を差し引いた実効幅で slack を測る(要件4)
      const totalW = (i === 0 ? startUsed : 0) + lineW - cor[j - 1]
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
      // 悪い切れ目罰則: 直後で改行する行末が良い切れ目でないとき。行末ユニット=units[j-1]、
      // 次行先頭=units[j](!isLast なので必ず存在)を見て、タイマー箱+直後箱の隣接割りも抑える(要件7)。
      if (!isLast && !breakGood(units[j - 1], units[j])) c += BREAK_PENALTY
      if (isLast && lineCh <= RUNT_MAX && !lastEndsPeriod) c += RUNT_PENALTY
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

/** 行(=ユニット群)の合計幅 */
function groupWidth(group: Unit[]): number {
  return group.reduce((s, u) => s + u.width, 0)
}
/** 行末ユニットのテキスト(要件3の「。」止まり判定用) */
function groupTrailingText(group: Unit[]): string {
  for (let k = group.length - 1; k >= 0; k--) {
    const t = unitText(group[k])
    if (t.length > 0) return t
  }
  return ''
}
/** ユニットが全て text 片(箱=タイマー/用語を含まない)か。借用元にできるのは text ユニットだけ */
function isTextUnit(u: Unit): boolean {
  return u.parts.every((p) => p.kind === 'text')
}
/** LinePiece がタイマー箱(時間トークンを含む分割不能な箱)か。用語箱・テキストは false */
function isTimerBoxPart(p: LinePiece): boolean {
  return p.kind === 'atom' && /\d\s*(分|時間|秒)/.test(p.text ?? '')
}
/**
 * ユニット u で行を終える(=直後で改行する)のが良い切れ目か(要件2/7)。nextUnit は次行の先頭ユニット。
 * ・末尾がタイマー箱なら基本は良い切れ目: タイマーは自己完結した箱で、その直後で行を切るのは自然
 *   (「くらい（約180度）の油で[1分]」で行を終え「二度揚げすると…」を次行へ送るのはオーナー期待どおり)。
 *   「分/時間/秒」という活用外の語尾を一律に悪い切れ目扱いすると罰則DPが「の / 油で」等へ寄せてしまう。
 * ・ただし直後のユニットが箱で始まるとき(こんにゃく「[2分ほど]下茹で」の 用語箱)は、タイマーに密着した
 *   直後の動作を割ることになるので悪い切れ目扱いにする。これでオーナー承認済みの
 *   「こんにゃくを[2分ほど]下茹でして」を罰則DPが割らない(基準1の非退行)。しっかり等の地の文が続く
 *   水ようかんは直後が箱でないので良い切れ目のまま=DPで「[2分ほど] / しっかり煮て…」に直せる。
 * ・末尾がタイマー箱でなければ従来どおり語尾語彙で判定。
 */
function breakGood(u: Unit, nextUnit: Unit | undefined): boolean {
  const last = u.parts[u.parts.length - 1]
  if (last && isTimerBoxPart(last)) {
    const nextFirst = nextUnit?.parts[0]
    return !(nextFirst && nextFirst.kind === 'atom')
  }
  return isGoodBreakEndText(unitText(u))
}
/** 行(=ユニット群)の末尾/先頭の非空ユニット */
function groupLastUnit(group: Unit[]): Unit | undefined {
  for (let k = group.length - 1; k >= 0; k--) if (group[k].parts.length > 0) return group[k]
  return undefined
}
function groupFirstUnit(group: Unit[]): Unit | undefined {
  for (let k = 0; k < group.length; k++) if (group[k].parts.length > 0) return group[k]
  return undefined
}
/** 行 group の末尾で改行するのが良い切れ目か(nextGroup=次行) */
function groupBreakGood(group: Unit[], nextGroup: Unit[] | undefined): boolean {
  const last = groupLastUnit(group)
  if (!last) return true
  return breakGood(last, nextGroup ? groupFirstUnit(nextGroup) : undefined)
}

/**
 * 「良い切れ目までの借用」パス(2026-07-21 便AZ・要件F-2)。充填結果(貪欲/DP)の各改行位置で、
 * 行末が悪い切れ目(良い切れ目リストの外)のとき、次行先頭の text ユニットの細分節
 * (normalizedSegments)を先頭から借りて現在行末を良い切れ目に直す。
 *  条件: (a)借用後も行幅≤maxWidth (b)借りた最後の細分節が良い切れ目で終わる
 *        (c)借用後の次行(残り細分節+次行の残りユニット)が4字以下の切れ端にならない
 *  満たすkのうち最大のkを採用。箱ユニットからは借用しない・先頭ユニットは空にしない(leftover必須)。
 * jaWrap の結合ロジックは触らず、結合前の細分節境界を行組み側で使うだけ(F-2の裁定範囲)。
 */
function borrowPass(groups: Unit[][], maxWidth: number, measure: MeasureText, eps: number, corrText: (t: string) => number): Unit[][] {
  for (let i = 0; i < groups.length - 1; i++) {
    const cur = groups[i]
    const next = groups[i + 1]
    if (cur.length === 0 || next.length === 0) continue
    if (groupBreakGood(cur, next)) continue // 既に良い切れ目(語尾語彙・タイマー箱終わり含む) → 借用不要
    const head = next[0]
    if (!isTextUnit(head)) continue // 箱(タイマー/用語)からは借用しない
    // 次行先頭が「・」列挙(しょうゆ・みりん・砂糖…の続き)なら借用しない。jaWrapは列挙の「・」を
    // 行頭に置く設計で、行末が名詞(みりん等)で終わるのは列挙の自然な切れ目=悪い切れ目ではない。
    // 借用すると「・」が行頭から中へ移り列挙の見た目が崩れる(基準2の非退行)。
    if (/^・/.test(unitText(head))) continue
    const segs = normalizedSegments(unitText(head))
    if (segs.length < 2) continue // これ以上分割できない
    const curW = groupWidth(cur)
    const restNextChars = next.slice(1).reduce((s, u) => s + unitChars(u), 0)
    // 強い切れ目まで借りられるならそれを最優先(その中では最大k)。無ければ弱い良い切れ目の最大k。
    // (弱い切れ目まで貪欲に借りると「下に|して」のように句を割るので、強弱の二段で止める)
    let strong = null as { borrow: string; leftover: string } | null
    let weak = null as { borrow: string; leftover: string } | null
    // k は先頭ユニットを空にしない範囲(1..segs.length-1)。幅は k で単調増なので (a) 超過で打ち切り
    for (let k = 1; k < segs.length; k++) {
      const borrow = segs.slice(0, k).join('')
      const borrowW = measure(borrow)
      // (a) 借用後の現在行が maxWidth を超えない。借用末尾が「、」「。」ならぶら下げ補正(要件4)
      if (curW + borrowW - corrText(borrow) > maxWidth + eps) break
      if (!isGoodBreakEndText(segs[k - 1])) continue // (b) 良い切れ目で終わる(語尾語彙含む)
      const leftover = segs.slice(k).join('')
      if ([...leftover].length + restNextChars <= RUNT_MAX) continue // (c) 新たな切れ端を作らない
      weak = { borrow, leftover } // 良い切れ目の中では最大kが残る
      if (STRONG_BREAK_END.test(segs[k - 1])) strong = { borrow, leftover } // 強い切れ目の中でも最大k
    }
    const pick = strong ?? weak
    if (pick) {
      cur.push({ parts: [{ kind: 'text', text: pick.borrow }], width: measure(pick.borrow) })
      next[0] = { parts: [{ kind: 'text', text: pick.leftover }], width: measure(pick.leftover) }
    }
  }
  return groups
}

/** 行群中の「悪い切れ目で終わる非最終行」の本数(要件7のDP採否判定に使う) */
function countBadBreaks(groups: Unit[][]): number {
  let n = 0
  for (let i = 0; i < groups.length - 1; i++) {
    if (!groupBreakGood(groups[i], groups[i + 1])) n++
  }
  return n
}
/**
 * 末尾に切れ端行があるか。切れ端 = 4字以下の最終行。ただし要件3で「。」止まりの最終行は
 * 切れ端とみなさない(大学芋「…揚げる。」を均等割りしないための除外。オーナー実機で確定)。
 */
function hasRunt(groups: Unit[][]): boolean {
  if (groups.length < 2) return false
  const last = groups[groups.length - 1]
  return groupChars(last) <= RUNT_MAX && !endsWithPeriod(groupTrailingText(last))
}

/**
 * 1行にも入らない長句を充填する行群を返す。原則グリーディ(オーナー確認済みの見た目を保つ)だが、
 * グリーディが末尾に切れ端行(≤4字・「。」止まりを除く)を作るときは、文法採点付きDPに差し替える(要件A/F/3)。
 * さらに要件7: 切れ端は無いが「悪い切れ目終わりの行」があるときもDPを試し、悪い切れ目の行数が減り・
 * 新たな切れ端を作らず・行数も増えない場合だけDPを採る(承認済みレンダリングを壊さない安全弁)。
 * 最後に「良い切れ目までの借用」パス(要件F-2)で悪い切れ目を可能な範囲で解消する。
 */
function fillLongClause(
  units: Unit[],
  maxWidth: number,
  startUsed: number,
  eps: number,
  measure: MeasureText,
  corrText: (t: string) => number,
): Unit[][] {
  const corr = (u: Unit) => corrText(unitText(u))
  const greedy = greedyGroups(units, maxWidth, startUsed, eps, corr)
  let chosen = greedy
  if (hasRunt(greedy)) {
    chosen = penaltyGroups(units, maxWidth, startUsed, corr)
  } else if (greedy.length >= 2 && countBadBreaks(greedy) > 0) {
    const dp = penaltyGroups(units, maxWidth, startUsed, corr)
    // 要件7: DP採用は「悪い切れ目が減り・新runtなし・行数が増えない」に加えて、最終行を貪欲より
    // 短くしないこと(DPが均等割りで「…とろみを / 付ける。」のような孤立した「。」行を新設するのを防ぐ。
    // 水ようかんは逆に最終行が伸びる=「しっかり煮て寒天を溶かす。」なので通る)。
    const greedyLastCh = groupChars(greedy[greedy.length - 1])
    const dpLastCh = groupChars(dp[dp.length - 1])
    if (
      countBadBreaks(dp) < countBadBreaks(greedy) &&
      !hasRunt(dp) &&
      dp.length <= greedy.length &&
      dpLastCh >= greedyLastCh
    ) {
      chosen = dp
    }
  }
  return borrowPass(chosen, maxWidth, measure, eps, corrText)
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
  const hang = opts.hangingPunct ?? false
  const clauses = toClauses(atoms)

  // 要件4: 行末が「、」「。」で終わるときのぶら下げ補正幅(px)。hang が false のときは常に 0
  // (Chromium 等・従来どおり句読点も1字として数える=はみ出し防止側)。
  const corrText = (t: string): number => {
    if (!hang || t.length === 0) return 0
    const c = t[t.length - 1]
    return c === '、' || c === '。' ? measure(c) : 0
  }

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
    // 句末(=行末になる)ユニットが「、」「。」で終わるなら、その1字分を差し引いた実効幅で収まり判定(要件4)
    const cwEff = cw - corrText(unitText(units[units.length - 1]))

    if (clause.hardBreakBefore && lastLine().length > 0) newLine()

    const lineHasContent = lastLine().length > 0
    const remaining = maxWidth - cur

    if (lineHasContent && cwEff <= remaining + eps) {
      // 句が現在行の残り幅に丸ごと収まる → そのまま同じ行に足す(複数句1行)
      for (const u of units) push(u)
    } else if (cwEff <= maxWidth + eps) {
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
      const groups = fillLongClause(units, maxWidth, startUsed, eps, measure, corrText)
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
