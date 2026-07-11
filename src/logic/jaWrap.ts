// 日本語の折返し位置を文節のまとまりに揃える(BudouX・2026-07-11オーナー要望)。
// さらに結合ルール(2026-07-11第2版・スマホ実機のオーナー指摘):
//  ・「◯分」等の時間トークンの直後では折り返さない(「2分/塩ゆで」→「2分塩ゆでしておく」)
//  ・格助詞・並列助詞(を/に/へ/と/や/で)で終わる文節は次と結合(「酢と/塩こしょう」→「酢と塩こしょうを」)
//  ・2文字以下の短い文節は前後に吸収する
//  ・「、」「。」の直後は常に折返し可能(結合しない)
//  ・結合後の単位は最大12文字(超えると狭い画面で強制折返しが起きるため)
// 使い方: wrapJaPhrases()で単位境界にゼロ幅スペースを挿し、表示側の要素に
// .ja-phrase クラス(word-break: keep-all + overflow-wrap: anywhere)を付ける。
import { loadDefaultJapaneseParser } from 'budoux'

const parser = loadDefaultJapaneseParser()

export const ZWSP = '\u200b'

const TIME_END = /\d+(分|時間|秒)半?$/
const BOND_END = /[をにへとやで]$/
const PUNCT_END = /[、。」』）)]$/
// 後方吸収してよい短い文節は補助動詞類のみ(「〜して|おく」等)。
// 任意の2文字を吸収するとBudouXの誤分割(「塩も|みする」)を巻き込み単語内で切れる
const AUX_SHORT = /^(おく|いく|くる|みる|よい)$/
const MAX_UNIT = 12

/** 文節境界にゼロ幅スペースを挿入する(見た目・検索データは不変。表示専用) */
export function wrapJaPhrases(text: string): string {
  if (!text || text.length < 8) return text
  const units: string[] = []
  for (const seg of parser.parse(text)) {
    const prev = units[units.length - 1]
    const canMerge =
      prev !== undefined &&
      !PUNCT_END.test(prev) &&
      // 「豚肉→根菜→…」の矢印列は、列の最後の項目が言い終わるまで結合を続ける
      // (「ちぎった|こんにゃく」「ご飯を|入れて」で切れる実バグへの対応・2026-07-12)。
      // 連用形「て」か句読点で項目列の言い切りとみなして止める。上限16文字
      ((prev.includes('→') && !/[て、。]$/.test(prev)
        ? prev.length + seg.length <= 16
        : prev.length + seg.length <= MAX_UNIT &&
          (TIME_END.test(prev) ||
            BOND_END.test(prev) ||
            prev.length <= 2 ||
            AUX_SHORT.test(seg) ||
            // 「出るくらい（約170度）」等: 括弧は直前の語に密着させる(括弧の前で折り返さない)
            seg.startsWith('（') ||
            seg.startsWith('('))))
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
 * 「中火で15分煮る」のように、直前の短い文節(中火で/別に/レンジで等)と
 * 直後の文節はボタンとひとかたまりにし、その境界では折り返さない(2026-07-11オーナー指摘)。
 * 一体化の上限: 前=5文字、前後合計=9文字(超えると狭い画面で横はみ出しするため)。
 */
export function splitAroundTimeToken(
  before: string,
  after: string,
): { pre: string; bondPrev: string; bondNext: string; post: string } {
  const afterUnits = after ? wrapJaPhrases(after).split(ZWSP) : []

  // 前側の結合はrawの文節単位で「中火で」「レンジで」「◯◯の」型だけを拾う
  // (「取りながら」のような動詞の連用形は前の句に付くため結合しない・2026-07-11オーナー指摘の傾向反映)
  let bondPrev = ''
  let beforeRest = before
  if (before) {
    const raw = parser.parse(before)
    // 末尾がで/に/の止まりのときだけ、7文字を上限にraw文節を末尾から蓄積して結合
    // (「ゆで|上がりの」のようにBudouXが語中で切っても「ゆで上がりの」ごと拾えるように)
    if (raw.length > 0 && /[でにの]$/.test(raw[raw.length - 1]) && !PUNCT_END.test(raw[raw.length - 1])) {
      let acc = ''
      for (let i = raw.length - 1; i >= 0; i--) {
        // 遡って取り込むのは修飾のまとまり(で/に/の止まり)だけ。「野菜を」「〜して」で止める
        if (acc && !/[でにの]$/.test(raw[i])) break
        const candidate = raw[i] + acc
        if (candidate.length > 7 || PUNCT_END.test(raw[i])) break
        acc = candidate
      }
      if (acc) {
        bondPrev = acc
        beforeRest = before.slice(0, before.length - acc.length)
      }
    }
  }
  const beforeUnits = beforeRest ? wrapJaPhrases(beforeRest).split(ZWSP) : []
  let bondNext = ''
  const first = afterUnits[0]
  if (first && first.length <= 7 && bondPrev.length + first.length <= 9) {
    bondNext = first
    afterUnits.shift()
  }
  return {
    pre: beforeUnits.join(ZWSP),
    bondPrev,
    bondNext,
    post: afterUnits.join(ZWSP),
  }
}
