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
 * **誤検出は出さない方に倒す**（嘘の分量を出さない）。1文字の材料名の扱い（「水を加える」は拾い
 * 「水気を絞る」は拾わない）や、材料名が別の意味で使われる定型句（流水・水溶き・甘酢 等）の除外は
 * すべて logic/ingredientSpans.ts の findIngredientMatches に集約してある。
 *
 * **下線と分量は必ず一致させる**（2026-08-08 便EG・オーナー実機報告
 * 「手順文の下線は出るのに、オリーブオイルとハーブの分量だけ出ない」）。
 * 同じ突き合わせ結果（findIngredientMatches）を両方の根拠にし、片方だけ当たる状態を作らない。
 * 1つの表記に材料欄の複数行が当たるとき（「オリーブオイル(下味用)」と「オリーブオイル(焼く用)」）は、
 * どちらか一方を機械が選ぶと嘘の分量になりうるので、**当たった行を全部、括弧の注記つきの名前で並べる**
 * （分量を出さずに黙るのは、下線だけが浮くのでやらない）。
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
 * 材料名の括弧の中身から、用途を表す語を取り出す（「オリーブオイル(下味用)」→「下味」）。
 * 末尾の「用」は落とす＝手順文には「下味だれを作る」「焼き色がつくまで焼く」のように
 * 用途の語だけが出てくるため。用途に読めない注記（「すりおろし」「1かけ=約5g」等）も
 * そのまま返すが、手順文に出てこなければ使われない。
 */
function usageNoteOf(name: string): string {
  const inner = name.match(/[（(]([^）)]*)[）)]/)?.[1]?.trim() ?? ''
  return inner.replace(/用$/, '')
}

/**
 * 同じ表記に材料欄の複数行が当たったとき、手順文に用途が書いてあれば1行に絞る。
 *
 * レシピの書き手は「片栗粉(あん用)」「だし汁(卵液用)」のように、**材料欄と手順文の両方に**
 * 同じ用途の語を書く。手順文に出てくる用途がちょうど1行ぶんだけなら、それがその手順で使う行。
 * 2行とも当たる／1行も当たらないときは絞り込まない（機械が選ぶと嘘の分量になるため）。
 */
function narrowByUsage(rows: readonly Ingredient[], stepText: string): readonly Ingredient[] {
  const hit = rows.filter((ing) => {
    const usage = usageNoteOf(ing.name)
    return usage.length > 0 && stepText.includes(usage)
  })
  return hit.length === 1 ? hit : rows
}

/**
 * ②手順の文に出てくる材料だけを、分量つきで拾う。
 *
 * 手順本文に出てこない材料は返さない。返す順は手順文に出てきた順
 * （読みながら手に取る順と一致させる）。
 *
 * 拾う語は手順本文の下線とまったく同じ（findIngredientMatches の結果をそのまま使う）。
 * 1つの表記に材料欄の複数行が当たるときは、まず手順文に書かれた用途で絞り、
 * それでも決まらなければ当たった行を材料欄の並び順で全部返す
 * （名前には括弧の注記が残るので、どちらの分量かは読んで見分けられる）。
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
    if (!rows) continue
    for (const ing of rows.length > 1 ? narrowByUsage(rows, stepText) : rows) {
      if (!picked.includes(ing)) picked.push(ing)
    }
  }
  return picked.map((ing) => formatNaviIngredient(ing, baseServings, targetServings))
}

/** 材料名の正規化（呼び出し側の見分け用に再輸出。ingredientSpans と同じ規則） */
export { normalizeIngredientChipLabel }
