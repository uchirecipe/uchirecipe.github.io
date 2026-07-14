// 手順本文中の材料名を最長一致で探し、控えめな実線下線spanで包むためのマッチング
// (2026-07-12・docs/20 §7オーナー提案「材料にある食材は、手順で下線があると読みやすいかも。色はぬらない」)。
// Reactに依存しない純粋関数にして scripts/test-logic.mjs から直接検証できるようにする(termSplit.tsと同方針)。
//
// 用語辞書スパン・タイマーspanと重なる部分は、上位レイヤー(TermText→TimeText)が先に地の文から
// 切り出す。ここへは「辞書語でもタイマーでもない残りのテキスト」だけが渡るため、
// 「重なりはそちら優先・材料下線は残り部分だけ」という仕様は合成順で自然に満たされる。
//
// v2(2026-07-12・オーナー実機iPhoneSE2フィードバックで3点改良):
// 1. 誤検出防止: 「卵液」「卵焼き器」のように材料名が複合語の内部に埋もれる場合は
//    EXCLUSION_RULESでスキップする(下記isExcludedMatch)。
// 2. 検出漏れ対策(修飾語つき材料): 材料名から既知の修飾接頭語を剥がした別名を
//    deriveAliasesで登録する(「むきえび」→「えび」等)。
// 3. 検出漏れ対策(肉の部位): 「豚|鶏|牛」で始まり「肉」で終わる材料名は総称の別名
//    (「豚肉」等)をderiveAliasesで登録する。
// いずれも別名を候補一覧に追加するだけで、最長一致優先(buildIngredientNamesの長さ降順)は
// そのまま働く(本文に「木綿豆腐」があればそちらを優先し「豆腐」止まりにはしない)。
//
// v3(2026-07-15・オーナー実機フィードバックで追加):
// 4. 修飾接頭語「プレーン」をMODIFIER_PREFIXESに追加(「プレーンヨーグルト」→「ヨーグルト」)。
// 5. 汎用ルールでは導出できない個別別名をNAME_ALIAS_OVERRIDESに登録
//    (「合い挽き肉」→「ひき肉」、「生だら」→「たら」=連濁で濁点が戻らないケース)。
import { normalizeIngredientChipLabel } from './mainIngredients'

export interface IngredientMatch {
  /** マッチした材料名(正規化済み) */
  text: string
  start: number
  end: number
}

/**
 * 材料名が複合語の内部に埋もれている場合は下線を付けない除外規則(誤検出防止)。
 * 例:「卵液」「卵黄」「卵白」の「卵」、調理器具「卵焼き器」の「卵」(卵そのものではない)。
 * 拡張時はこの配列に1件追記する(nameは材料名・別名のどちらでも指定可):
 * - blockedNextChars: マッチ直後の1文字がこれに含まれればスキップ(短い接尾語向け)
 * - blockedWords: マッチがこの単語の一部になればスキップ(次の1文字では表せない複合語向け)
 */
interface ExclusionRule {
  name: string
  blockedNextChars?: readonly string[]
  blockedWords?: readonly string[]
}

const EXCLUSION_RULES: readonly ExclusionRule[] = [
  {
    name: '卵',
    blockedNextChars: ['液', '黄', '白'],
    blockedWords: ['卵焼き器'],
  },
]

const exclusionRuleByName = new Map(EXCLUSION_RULES.map((rule) => [rule.name, rule]))

function isExcludedMatch(text: string, name: string, start: number): boolean {
  const rule = exclusionRuleByName.get(name)
  if (!rule) return false
  const end = start + name.length
  if (rule.blockedNextChars?.includes(text[end] ?? '')) return true
  if (rule.blockedWords) {
    for (const word of rule.blockedWords) {
      const offset = word.indexOf(name)
      if (offset === -1) continue
      const wordStart = start - offset
      if (wordStart >= 0 && text.slice(wordStart, wordStart + word.length) === word) return true
    }
  }
  return false
}

/**
 * 材料名に付きがちな修飾接頭語。手順本文では剥がした素の名前で出てくることが多いため、
 * 下線マッチの別名として登録する(例:「むきえび」→「えび」、「干ししいたけ」→「しいたけ」、
 * 「木綿豆腐」→「豆腐」)。複数の接頭語が重なる名前は繰り返し剥がす。
 */
const MODIFIER_PREFIXES = [
  'むき',
  '干し',
  '刻み',
  '木綿',
  '絹ごし',
  '生',
  '冷凍',
  '甘塩',
  '蒸し',
  'ゆで',
  'プレーン',
] as const

function stripModifierPrefixes(name: string): string {
  let result = name
  let prefix = MODIFIER_PREFIXES.find((p) => result.startsWith(p) && result.length > p.length)
  while (prefix) {
    result = result.slice(prefix.length)
    prefix = MODIFIER_PREFIXES.find((p) => result.startsWith(p) && result.length > p.length)
  }
  return result
}

/** 「豚」「鶏」「牛」で始まり「肉」で終わる部位名は、総称の別名を追加する(例:「鶏もも肉」→「鶏肉」) */
const MEAT_KIND_PATTERN = /^(豚|鶏|牛)/

function deriveMeatKindAlias(name: string): string | undefined {
  const kind = name.match(MEAT_KIND_PATTERN)?.[1]
  if (!kind || !name.endsWith('肉')) return undefined
  return `${kind}肉`
}

/**
 * 汎用ルール(接頭語剥がし・肉部位総称化)だけでは導出できない個別の別名
 * (2026-07-15オーナー実機フィードバック)。
 * - 「合い挽き肉」→「ひき肉」: 接頭語「合い」を剥がしても残るのは「挽き肉」で、
 *   手順本文でよく使われるひらがな表記「ひき肉」とは一致しないため個別登録する。
 * - 「生だら」→「たら」: 接頭語「生」を剥がすと連濁のまま「だら」が残り、
 *   本来の濁点なし表記「たら」には戻らない(第2弾「たらの香味レンジ蒸し」で発生)。
 *   既存の接頭語除去ルールでは濁点を戻せないため個別登録する。
 * 拡張時はこのRecordに1行追記する(キーは normalizeIngredientChipLabel 適用後の材料名)。
 */
const NAME_ALIAS_OVERRIDES: Record<string, readonly string[]> = {
  合い挽き肉: ['ひき肉'],
  生だら: ['たら'],
}

/**
 * 材料名から下線マッチ用の別名を導出する(修飾接頭語剥がし＋肉の部位パターン＋個別別名)。
 * 1文字の別名は取りこぼしより誤検出のリスクが大きいため登録しない
 * (例:「蒸し鶏」→「鶏」は1文字なので見送り。総称別名が欲しければ「鶏肉」表記側で対応)。
 */
function deriveAliases(name: string): string[] {
  const aliases = new Set<string>()
  const stripped = stripModifierPrefixes(name)
  if (stripped !== name && stripped.length >= 2) aliases.add(stripped)
  const meatAlias = deriveMeatKindAlias(name)
  if (meatAlias && meatAlias !== name) aliases.add(meatAlias)
  for (const alias of NAME_ALIAS_OVERRIDES[name] ?? []) aliases.add(alias)
  return [...aliases]
}

/**
 * レシピの材料名を、下線マッチ用に正規化(括弧除去・切り方注記除去=表示チップと同じ)・
 * 別名展開・重複除去し、長い名前から先に照合できるよう長さ降順で返す。
 * 例:「玉ねぎ(みじん切り)」→「玉ねぎ」。「生鮭」「甘塩鮭」→どちらも「鮭」。
 * 「むきえび」→「むきえび」「えび」の2件、「豚こま切れ肉」→「豚こま切れ肉」「豚肉」の2件
 * (「豚バラ薄切り肉」は正規化の時点で「薄切り」が抜けて「豚バラ肉」になり、そこから「豚肉」も追加)。
 */
export function buildIngredientNames(ingredients: readonly { name: string }[]): string[] {
  const set = new Set<string>()
  for (const ing of ingredients) {
    const name = normalizeIngredientChipLabel(ing.name)
    if (!name) continue
    set.add(name)
    for (const alias of deriveAliases(name)) set.add(alias)
  }
  return [...set].sort((a, b) => b.length - a.length)
}

/**
 * テキスト中の材料名を最長一致・完全一致で走査する(termSplit.findTermMatchesと同じ走法)。
 * 一度マッチした範囲は次の探索開始位置にし、重なりは作らない。namesは長さ降順(buildIngredientNames)前提。
 * EXCLUSION_RULESに該当するマッチ(例:「卵液」の「卵」)は不採用にし、他の候補名・次の文字位置で
 * 探索を続ける(複合語の内部にだけ下線が付くのを防ぐ)。
 */
export function findIngredientMatches(text: string, names: readonly string[]): IngredientMatch[] {
  if (names.length === 0) return []
  const matches: IngredientMatch[] = []
  let i = 0
  while (i < text.length) {
    let matched = false
    for (const name of names) {
      if (text.startsWith(name, i) && !isExcludedMatch(text, name, i)) {
        matches.push({ text: name, start: i, end: i + name.length })
        i += name.length
        matched = true
        break
      }
    }
    if (!matched) i++
  }
  return matches
}
