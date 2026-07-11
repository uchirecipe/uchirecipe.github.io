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
      prev.length + seg.length <= MAX_UNIT &&
      (TIME_END.test(prev) || BOND_END.test(prev) || prev.length <= 2 || AUX_SHORT.test(seg))
    if (canMerge) {
      units[units.length - 1] = prev + seg
    } else {
      units.push(seg)
    }
  }
  return units.join(ZWSP)
}
