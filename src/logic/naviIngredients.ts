/**
 * 並行調理ナビで「材料と分量」を出すためのロジック（2026-08-08 便EB・オーナー実機報告
 * 「ナビを選択すると、分量が消えるので計量できない。だからと言って全て表示すると面積とるし邪魔になる」）。
 *
 * 出し方は2つあり、目的が違う（オーナー指摘で両方とも必須）:
 *   ②手順の中に出す（stepIngredientAmounts）
 *      その手順の文に出てくる材料の分量だけを、手順のすぐ下に小さく添える。
 *      **採用理由＝同じ材料を別のレシピに使ってしまう事故を防ぐため**。3品を並行で作ると
 *      材料欄は3品ぶん混ざるので、「いま手に取る玉ねぎはどの料理のどれだけ分か」を
 *      その場で示す必要がある。
 *   ③レシピごとの材料一覧（recipeIngredientList）
 *      選んだ品ごとの全材料と分量。**あらかじめ計量したい人・使う材料を先に把握したい人**が
 *      段取りを作った直後（調理を始める前）に開く。②だけでは全体像が分からない。
 *
 * 突き合わせ（手順文と材料名）は AI を使わず、既存の材料下線マッチ（logic/ingredientSpans.ts）を
 * そのまま流用する。表記ゆれ（「豚バラ薄切り肉」→本文の「豚バラ肉」「豚肉」、「むきえび」→「えび」）は
 * 同ファイルの別名生成が吸収する。
 *
 * **誤検出は出さない方に倒す**（嘘の分量を出さない）。具体的には:
 *   - 1つの表記に材料欄の複数行が当たるとき（「片栗粉(肉だね用)」と「片栗粉(あん用)」）は出さない
 *   - 1文字の材料名（水・塩・油・酒など）は、直後が助詞のときだけ拾う
 *     （「水気を絞る」「塩ゆでする」の“水”“塩”は計量する材料ではない）
 *   - 材料名が別の意味で使われる定型句（流水・冷水・水にさらす 等）は名指しで除外する
 */
import type { Ingredient } from '../db/types'
import { buildIngredientNames, findIngredientMatches } from './ingredientSpans'
import { normalizeIngredientChipLabel } from './mainIngredients'
import { formatAmountUnit, scaleAmount } from './amount'

/** ナビに出す材料1行分（表示用に組み立て済み） */
export interface NaviIngredientAmount {
  /** 材料欄の名前（原文のまま。括弧の注記も残す＝どの材料か取り違えないため） */
  name: string
  /** 分量＋単位（人数換算済み。例:「200g」「大さじ1」「適量」）。分量が空なら空文字 */
  amount: string
  /**
   * 合わせ調味料のグループ番号（1〜4。無ければ undefined）。
   * 2026-08-08 便ED・オーナー実機フィードバック「合わせ調味料のまとめて計量表示がナビに無い」。
   * レシピ詳細の材料欄と同じ色の線で示し、先にまとめて計量してよい材料を見分けられるようにする。
   */
  seasoningGroup?: number
}

/**
 * 1文字の材料名を拾ってよい直後の文字（助詞・区切り）。
 * 「水を加える」は拾い、「水気を絞る」「塩ゆで」は拾わない、を分けるための最小限の規則。
 */
const PARTICLE_AFTER = /[をはがともにでやか、。・）)　 ]/

/**
 * 材料名が「その材料そのもの」を指していない定型句。ここに当たる範囲のマッチは捨てる。
 * 拡張時はこの配列に1件追記する（name＝正規化後の材料名、words＝その語を含む定型句）。
 */
const CONFUSABLE_PHRASES: { name: string; words: readonly string[] }[] = [
  {
    name: '水',
    words: ['水気', '水分', '流水', '冷水', '熱水', '水洗い', '水にさらす', '水にさらし', '水切り', '水きり', '打ち水'],
  },
  { name: '油', words: ['油揚げ', '油分', '油通し'] },
  { name: '塩', words: ['塩ゆで', '塩茹で', '塩水', '塩気', '塩加減'] },
]

const confusableByName = new Map(CONFUSABLE_PHRASES.map((rule) => [rule.name, rule.words]))

/** text の [start,end) のマッチが、紛らわしい定型句の一部になっていないか */
function isConfusableUse(text: string, name: string, start: number): boolean {
  const words = confusableByName.get(name)
  if (!words) return false
  for (const word of words) {
    const offset = word.indexOf(name)
    if (offset === -1) continue
    const wordStart = start - offset
    if (wordStart >= 0 && text.slice(wordStart, wordStart + word.length) === word) return true
  }
  return false
}

/**
 * 材料1行を「名前＋分量」の表示形にする。人数換算は詳細画面と同じ scaleAmount を通す
 * （画面ごとに違う分量が出ないようにするため）。
 */
export function formatNaviIngredient(
  ingredient: Ingredient,
  baseServings: number,
  targetServings: number,
): NaviIngredientAmount {
  const scaled =
    baseServings > 0 && targetServings > 0
      ? scaleAmount(ingredient.amount ?? '', baseServings, targetServings, ingredient.unit)
      : (ingredient.amount ?? '')
  return {
    name: ingredient.name,
    amount: formatAmountUnit(scaled, ingredient.unit),
    seasoningGroup: ingredient.seasoningGroup,
  }
}

/**
 * ③レシピごとの材料一覧。材料欄をそのままの並びで、人数換算した分量つきで返す。
 * 名前が空の行だけ落とす（区切り行対策）。
 */
export function recipeIngredientList(
  ingredients: readonly Ingredient[],
  baseServings: number,
  targetServings: number,
): NaviIngredientAmount[] {
  return ingredients
    .filter((ing) => (ing.name ?? '').trim() !== '')
    .map((ing) => formatNaviIngredient(ing, baseServings, targetServings))
}

/** 材料名（別名も含む）→ 材料欄の行、の対応表を作る */
function buildNameToIngredients(
  ingredients: readonly Ingredient[],
): Map<string, Ingredient[]> {
  const map = new Map<string, Ingredient[]>()
  for (const ing of ingredients) {
    if ((ing.name ?? '').trim() === '') continue
    // buildIngredientNames と同じ正規化・別名生成を1件ずつ通し、どの行から来た名前かを覚える
    for (const name of buildIngredientNames([ing])) {
      const rows = map.get(name)
      if (rows) {
        if (!rows.includes(ing)) rows.push(ing)
      } else {
        map.set(name, [ing])
      }
    }
  }
  return map
}

/**
 * ②手順の文に出てくる材料だけを、分量つきで拾う。
 *
 * 出てこない材料は返さない。取り違えのおそれがあるものも返さない（出さない方に倒す）。
 * 返す順は手順文に出てきた順（読みながら手に取る順と一致させる）。
 */
export function stepIngredientAmounts(
  stepText: string,
  ingredients: readonly Ingredient[],
  baseServings: number,
  targetServings: number,
): NaviIngredientAmount[] {
  if (!stepText || ingredients.length === 0) return []
  const nameToIngredients = buildNameToIngredients(ingredients)
  const names = [...nameToIngredients.keys()].sort((a, b) => b.length - a.length)
  const matches = findIngredientMatches(stepText, names)

  const picked: Ingredient[] = []
  for (const match of matches) {
    const rows = nameToIngredients.get(match.text)
    // 1つの表記に材料欄の複数行が当たる（「片栗粉(肉だね用)」と「片栗粉(あん用)」）＝
    // どちらの分量か決められないので出さない
    if (!rows || rows.length !== 1) continue
    const ing = rows[0]
    if (picked.includes(ing)) continue
    // 1文字の材料名は、直後が助詞・区切りのときだけ（「水を」は拾い「水気」は拾わない）
    if (match.text.length === 1) {
      const next = stepText[match.end] ?? '。'
      if (!PARTICLE_AFTER.test(next)) continue
    }
    if (isConfusableUse(stepText, match.text, match.start)) continue
    picked.push(ing)
  }
  return picked.map((ing) => formatNaviIngredient(ing, baseServings, targetServings))
}

/** 材料名の正規化（呼び出し側の見分け用に再輸出。ingredientSpans と同じ規則） */
export { normalizeIngredientChipLabel }
