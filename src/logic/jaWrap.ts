// 日本語の折返し位置を文節のまとまりに揃える(BudouX・2026-07-11オーナー要望)。
// さらに結合ルール(2026-07-12第3版・iPad/iPhoneSE2実機のオーナー指摘11件を規則化):
//  ・「◯分」等の時間トークンの直後では折り返さない(「2分/塩ゆで」→「2分塩ゆでしておく」)
//  ・格助詞等(を/に/へ/と/や/で/の/が)で終わる文節は次と結合。ただし上限10文字
//    (12文字まで許すと「唐辛子をじっくり香りが」のような句をまたぐ過結合が起きる)
//  ・2文字以下の短い文節は前後に吸収する
//  ・「、」「。」の直後は常に折返し可能(BudouXが「加え、とろみが」のように句読点を
//    セグメント中央に残しても、句読点の直後で必ず単位を切る)
//  ・「・」の食材列挙は「・」を次の項目の先頭に付けて折り返す(「オリーブオイル・/薄切り…」
//    ではなく「オリーブオイル/・薄切り…」。行頭の・は列挙の続きとして自然に読めるため)
//  ・BudouXが語中で切る既知語(じゃがいも/だしの素等)は境界を除去して1語に戻す
//  ・結合後の単位は最大12文字(超えると狭い画面で強制折返しが起きるため)
// 使い方: wrapJaPhrases()で単位境界にゼロ幅スペースを挿し、表示側の要素に
// .ja-phrase クラス(word-break: keep-all + overflow-wrap: anywhere)を付ける。
// 注意: keep-allの下では inline-block/inline-flex 等のatomic inlineの前後が
// 無条件の改行点になる(WebKit/Chromium共通・2026-07-12プローブで確認)。
// タイマー・用語のボタン類はこの性質を前提に、TimeText/TermTextで境界を制御している。
import { loadDefaultJapaneseParser } from 'budoux'

const parser = loadDefaultJapaneseParser()

export const ZWSP = '\u200b'

const TIME_END = /\d+(分|時間|秒)半?$/
const BOND_END = /[をにへとやでのが]$/
// 係助詞「は/も」で終わる文節(2026-07-16 改行監査A-3。BOND_ENDに無条件で加えると
// 「大葉もせん切りにする」が新たに「大葉もせん」/「切りにする」に分断される退行が
// シミュレーションで確認されたため、BOND_ENDには入れず下記の狭い条件専用に分離する)
const TOPIC_PARTICLE_END = /[はも]$/
const PUNCT_END = /[、。」』）)]$/
// 後方吸収してよい短い文節は補助動詞類のみ(「〜して|おく」「せん切りに|する」等)。
// 任意の2文字を吸収するとBudouXの誤分割(「塩も|みする」)を巻き込み単語内で切れる。
// 「見る」(漢字表記)も対象に追加(2026-07-16改行監査A-2: 「味を/見る」の泣き別れ対策)
const AUX_SHORT = /^(おく|いく|くる|みる|見る|よい|する|して|こと)[、。]?$/
const MAX_UNIT = 12
const BOND_MAX = 10

// BudouXが語中で切ることが実機で確認された語。境界がこの語の内部に落ちたら除去する
// (「じゃが|いも」「だしの|素」「い|ちょう|切り」「ささが|き」「麺とゆで|汁」の実例・2026-07-12)
const KNOWN_WORDS = [
  'じゃがいも',
  'だしの素',
  'ゆで汁',
  'いちょう切り',
  'ささがき',
  '小口切り',
  'こんにゃく',
  '白いりごま',
  '一口大',
  '水溶き片栗粉',
  '両面焼きグリル',
  '片面焼きグリル',
  '転がしながら',
  // 2026-07-16 改行監査A-1: 949項目の機械監査で発見された誤分割語(副作用0件を確認済み)
  'しょうゆ',
  'ゴムべら',
  'タイプ',
  'せん切り',
]

/** BudouXの素分割に、句読点・中黒・既知語の補正をかけたセグメント列を返す */
function normalizedSegments(text: string): string[] {
  // 1) 境界オフセット集合を作る
  const raw = parser.parse(text)
  const boundaries = new Set<number>()
  let pos = 0
  for (const seg of raw) {
    pos += seg.length
    boundaries.add(pos)
  }
  // 2) 既知語の内部に落ちた境界を除去
  for (const w of KNOWN_WORDS) {
    let idx = text.indexOf(w)
    while (idx !== -1) {
      for (let k = idx + 1; k < idx + w.length; k++) boundaries.delete(k)
      idx = text.indexOf(w, idx + 1)
    }
  }
  // 3) 「、」「。」の直後は必ず境界(セグメント中央の句読点で切る)。
  //    「・」の直前も境界(列挙の・は次項目の先頭に付ける)。
  //    開き括弧の直前も境界: 括弧をセグメント中央に残すと単位が「こと（オーブンで」の形になり、
  //    renderJaUnitsのnowrap保護(先頭が括弧の単位だけ包む)が効かず、WebKitが括弧の直後で
  //    折り返してしまう(2026-07-12オーナー実機のメモ括弧バグの残り)
  for (let i = 0; i < text.length; i++) {
    if ((text[i] === '、' || text[i] === '。') && i + 1 < text.length) boundaries.add(i + 1)
    if ((text[i] === '・' || text[i] === '（' || text[i] === '(' || text[i] === '→') && i > 0)
      boundaries.add(i)
  }
  // 4.5) 「〜」(範囲)の前後で折り返さない(「2〜/3日」「1分〜/1分30秒」の泣き別れ防止・
  //      2026-07-12オーナー指摘: 改行が「〜」で途切れがち)
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '〜') {
      boundaries.delete(i)
      boundaries.delete(i + 1)
    }
  }
  // 5) 12文字以下の自己完結した括弧の内部に境界を残さない(「(または|カニカマ)」のように
  //    括弧の中で折り返すと注記が泣き別れる。長い括弧は内部で折れてよい)
  for (const m of text.matchAll(/[（(][^（()）]{1,10}[）)]/g)) {
    const start = m.index ?? 0
    for (let k = start + 1; k < start + m[0].length; k++) boundaries.delete(k)
  }
  boundaries.add(text.length)
  // 4) セグメント列へ復元
  const out: string[] = []
  let start = 0
  for (const b of [...boundaries].sort((a, z) => a - z)) {
    if (b <= start) continue
    out.push(text.slice(start, b))
    start = b
  }
  return out
}

/** 文節境界にゼロ幅スペースを挿入する(見た目・検索データは不変。表示専用) */
export function wrapJaPhrases(text: string): string {
  if (!text) return text
  const units: string[] = []
  for (const seg of normalizedSegments(text)) {
    const prev = units[units.length - 1]
    let canMerge = false
    if (prev !== undefined && /^[）)]/.test(seg)) {
      // 閉じ括弧で始まるセグメントは行頭禁則(」や）を行頭に置かない)を優先し、
      // 長さ上限に関わらず必ず前の単位へ密着させる(「ひいて|)中火で」の実例・2026-07-12)
      canMerge = true
    } else if (prev !== undefined && /^[（(]/.test(seg)) {
      // 開き括弧で始まるセグメントは、閉じ括弧まで含む自己完結の短い括弧だけ前に密着
      // (「出るくらい（約170度）の」等)。「（」単体や開きっぱなしの括弧は前に付けない:
      // 直前が「と」等で終わると格助詞結合が誤発火し「少量足すこと（」のように
      // 開き括弧が行末に残る実バグがあった(2026-07-12)。単体の「（」は次のセグメントが
      // 2文字以下ルールで後ろに結合され「（空焚き防止）。」の形に自然にまとまる
      canMerge = !PUNCT_END.test(prev) && /[）)]/.test(seg) && prev.length + seg.length <= MAX_UNIT
    } else if (prev !== undefined && !PUNCT_END.test(prev)) {
      const total = prev.length + seg.length
      if (/^→/.test(seg)) {
        // 矢印列は「→x」を項目単位にする(2026-07-12第3.3版)。最初の「→」だけは
        // 前の項目に密着させ(「豚肉→根菜」)、2本目以降は項目の頭で折り返せるようにする
        // (「（焼く→ふたで火を通す/→あんをからめる）」・ミートボールのオーナー訂正)
        canMerge = !prev.includes('→') && total <= 16
      } else if (
        prev.includes('→') &&
        !/[て、。]$/.test(prev) &&
        !/[）)]/.test(prev.slice(prev.indexOf('→')))
      ) {
        // 項目の続き(「→ちぎった+こんにゃくの」)は言い切り(て/、/。/閉じ括弧)まで結合を続ける
        // (「ちぎった|こんにゃく」「ご飯を|入れて」で切れる実バグへの対応・2026-07-12)。上限16文字
        canMerge = total <= 16
      } else if (
        TIME_END.test(prev) ||
        prev.length <= 2 ||
        AUX_SHORT.test(seg)
      ) {
        canMerge = total <= MAX_UNIT
      } else if (BOND_END.test(prev)) {
        // 時間トークンが絡む結合は12文字まで許す(「別に2分塩ゆでしておく」
        // 「弱火で5分とろみを付ける」等、◯分の前後を切らない規則が優先)。
        // 並列の「と」は名詞列挙の途中で切れると不自然なため11文字まで許す
        // (「かつお節と|白いりごまを」の分断防止・2026-07-12オーナー指摘)
        const hasTime = /\d+(分|時間|秒)/.test(prev) || /^\d+(分|時間|秒)/.test(seg)
        const cap = hasTime ? MAX_UNIT : /と$/.test(prev) ? 11 : BOND_MAX
        canMerge = total <= cap
      } else if (
        TOPIC_PARTICLE_END.test(prev) &&
        seg.length === 1 &&
        !PUNCT_END.test(seg) &&
        seg !== '・'
      ) {
        // 「は/も」で終わる文節+直後が句読点でも「・」でもない1文字だけの孤立ユニットのときだけ
        // 前に吸収する(「小分けにして冷凍も|可」の泣き別れ対策・2026-07-16改行監査A-3)。
        // 「・」除外は食材列挙で次項目の先頭に付ける設計を壊さないため
        canMerge = total <= MAX_UNIT
      }
    }
    if (canMerge) {
      units[units.length - 1] = prev + seg
    } else {
      units.push(seg)
    }
  }
  return units.join(ZWSP)
}

/**
 * タイマーボタンの前後テキストを「ボタンと一体化する部分/しない部分」に分ける。
 * 「中火で15分煮る」のように、直前の短い文節(中火で/とろみが付くまで等)と
 * 直後の文節はボタンとひとかたまりにし、その境界では折り返さない(2026-07-11オーナー指摘)。
 * 一体化の上限: 前=8文字、前後合計=9文字。さらに前+トークン+後が12文字を超える場合は
 * 前側の結合を諦める(ひとかたまりが狭い画面の1行に収まらなくなるため。後側の
 * 「ほど」等の密着を優先する・2026-07-12)。
 */
export function splitAroundTimeToken(
  before: string,
  after: string,
  tokenLen = 3,
): { pre: string; bondPrev: string; bondNext: string; post: string } {
  // 前側の結合はrawの文節単位で「中火で」「レンジで」「◯◯の」「とろみが」型だけを拾う
  // (「取りながら」のような動詞の連用形は前の句に付くため結合しない・2026-07-11オーナー指摘の傾向反映)
  let bondPrev = ''
  let beforeRest = before
  if (before) {
    const raw = normalizedSegments(before)
    // 末尾がで/に/の/が止まりのときだけ、8文字を上限にraw文節を末尾から蓄積して結合
    // (「ゆで|上がりの」のようにBudouXが語中で切っても「ゆで上がりの」ごと拾えるように)
    if (
      raw.length > 0 &&
      /[でにのが]$/.test(raw[raw.length - 1]) &&
      !PUNCT_END.test(raw[raw.length - 1])
    ) {
      let acc = ''
      for (let i = raw.length - 1; i >= 0; i--) {
        // 遡って取り込むのは修飾のまとまり(で/に/の/が止まり)だけ。「野菜を」「〜して」で止める
        if (acc && !/[でにのが]$/.test(raw[i])) break
        const candidate = raw[i] + acc
        if (candidate.length > 8 || PUNCT_END.test(raw[i])) break
        acc = candidate
      }
      if (acc) {
        bondPrev = acc
        beforeRest = before.slice(0, before.length - acc.length)
      }
    }
  }
  // 後側: 「12分ほど」「1時間くらい」の助数詞尾はトークンに必ず密着させる
  const tailMatch = after.match(/^(ほど|くらい|ぐらい|程度)/)
  let bondNext = tailMatch ? tailMatch[0] : ''
  // 幅ガード: ひとかたまりが12文字を超えるなら前側の結合を先に解く
  // (後側の判定より先に解かないと、解いた分の余裕をbondNextに使えない)
  if (bondPrev && bondPrev.length + tokenLen + bondNext.length > 12) {
    beforeRest = before
    bondPrev = ''
  }
  const afterRest = after.slice(bondNext.length)
  const afterUnits = afterRest ? wrapJaPhrases(afterRest).split(ZWSP) : []
  const first = afterUnits[0]
  if (first && first.length <= 7 && bondPrev.length + bondNext.length + first.length <= 9) {
    bondNext += first
    afterUnits.shift()
  }
  const beforeUnits = beforeRest ? wrapJaPhrases(beforeRest).split(ZWSP) : []
  return {
    pre: beforeUnits.join(ZWSP),
    bondPrev,
    bondNext,
    post: afterUnits.join(ZWSP),
  }
}
