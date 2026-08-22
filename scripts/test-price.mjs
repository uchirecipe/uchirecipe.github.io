// 食材価格マスタ(M2-3)の回帰スモークテスト。
// 実行: npx tsx scripts/test-price.mjs
//
// 対象: 同梱の全基本レシピ109品(従来の基本51品＋2026-07-29追加の副菜6品＋旧配布テーマ由来52品。2026-07-23のテーマ全廃で
// starterDefsに合流)。全材料が食材価格マスタ(PRICE_DEFAULTS)で名前解決できることを確認する
// (2026-07-13オーナー指示: 「公式レシピなのに対応していない数値があるのはおかしい」の回帰固定。
// test-nutrition.mjsの名寄せカバー率100%チェックの価格版)。
//
// 「水」等ゼロ扱いの材料はnutrition.tsのisZeroIngredientと同じ基準で対象外とする(価格が付かない
// のが正しい挙動のため)。それ以外は「少々」「お好みで」のような分量でも、estimateIngredientYen
// が按分なしでマスタ価格をそのまま使う設計(logic/priceEstimate.ts)なので、対象外にはしない。
//
// 併せて、既存30件の目安価格が変更されていないことも確認する
// (E2E PRICE-01が「玉ねぎ1個50円」に依存。データ整備で既存行の値を書き換えないためのピン留め)。
// 例外: しょうゆ・みそは2026-07-21の調味料既定価格改定(docs/49_調味料既定価格調査.md。
// オーナー指摘「酒・塩・醤油の原価が高く感じる」への対応で実勢価格の中央値に更新)により
// このピン留め値自体を新値に更新した(E2E PRICE-01は玉ねぎのみに依存するため無関係)。
// 2026-08-22 便JI: バターも同じ扱いでピン留め値を250→600円に更新した
// (オーナー裁定「２＝A案: test-price.mjs のピン留めを解いて、実勢に合わせる」)。
// **ピン留めの仕組みそのものは残す**——勝手に値が動かないための見張りなので、
// 実勢に合わせて動かすときだけ、ここの数字を根拠つきで書き換える(根拠は
// src/data/priceDefaults.ts のバターの行のコメント)。
import { PRICE_DEFAULTS } from '../src/data/priceDefaults.ts'
import { buildPriceIndex, matchPriceEntry } from '../src/logic/priceEstimate.ts'
import { isZeroIngredient } from '../src/logic/nutrition.ts'
import { toHiragana } from '../src/logic/kana.ts'
import { starterDefs } from '../src/db/starters.ts'

let failures = 0
function check(ok, message) {
  if (!ok) {
    failures++
    console.error(`✗ ${message}`)
  }
}

// ---------- 1. 既存30件のピン留め(値を変更していないことの確認) ----------
// 2026-07-13データ整備より前からある初期30件。ここに列挙した(name, pricePerUnit, unit)が
// 1件でもずれたら、既存ユーザー・E2E(PRICE-01)への影響があるため即座に気づけるようにする。
const ORIGINAL_30 = [
  ['玉ねぎ', 50, '1個'], ['にんじん', 40, '1本'], ['じゃがいも', 40, '1個'],
  ['キャベツ', 130, '1/4個'], ['白菜', 150, '1/4個'], ['大根', 100, '1/2本'],
  ['もやし', 30, '1袋'], ['きゅうり', 40, '1本'], ['トマト', 60, '1個'],
  ['ピーマン', 30, '1個'], ['なす', 50, '1本'], ['ねぎ', 100, '1本'],
  ['ほうれん草', 100, '1束'], ['しめじ', 100, '1パック'], ['えのき', 80, '1袋'],
  ['鶏もも肉', 130, '100g'], ['鶏むね肉', 90, '100g'], ['豚バラ肉', 150, '100g'],
  ['豚こま切れ肉', 110, '100g'], ['牛こま切れ肉', 200, '100g'], ['合いびき肉', 130, '100g'],
  ['鮭', 120, '1切れ'], ['さば', 100, '1切れ'],
  ['卵', 25, '1個'], ['牛乳', 200, '1L'], ['バター', 600, '200g'], ['豆腐', 40, '1丁'],
  ['米', 60, '1合'], ['しょうゆ', 400, '1L'], ['みそ', 11, '大さじ1'],
]
check(PRICE_DEFAULTS.length >= ORIGINAL_30.length, `PRICE_DEFAULTSが既存30件を下回っている: ${PRICE_DEFAULTS.length}件`)
const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
for (const [name, pricePerUnit, unit] of ORIGINAL_30) {
  const entry = byName.get(name)
  check(!!entry, `既存項目が消えている: ${name}`)
  if (entry) {
    check(entry.pricePerUnit === pricePerUnit, `${name}: 価格が変更されている(${pricePerUnit}→${entry.pricePerUnit})。既存30件は変更禁止`)
    check(entry.unit === unit, `${name}: 単位が変更されている(${unit}→${entry.unit})。既存30件は変更禁止`)
  }
}
console.log(`既存30件のピン留め: ${ORIGINAL_30.length}件確認`)

// 名前の重複が無いこと(同名2行があると意図しない方が先にマッチして事故る)
const nameCounts = new Map()
for (const d of PRICE_DEFAULTS) nameCounts.set(d.name, (nameCounts.get(d.name) ?? 0) + 1)
for (const [name, count] of nameCounts) {
  check(count === 1, `PRICE_DEFAULTSに同名が${count}件: ${name}`)
}

// ---------- 1-b. 件数のピン留め(2026-08-09 便EI) ----------
// priceDefaults.tsの冒頭コメントに「172件」と書いてあったが実際は170件で、追加・整理のたびに
// コメントだけが取り残されていた。件数はコメントに書かず、ここで実配列と突き合わせる。
// 意図して増減させたときは、この数を直すこと(直し忘れれば必ずここで落ちる)。
// 2026-08-22 便JG: オーナーの実データ31品で「価格なし」だった常用食材12件を追加して169→181件
// （卵黄・卵白・生クリーム・赤ワイン・ローリエ・えんどう豆・ホットケーキミックス・無塩バター・
//   マッシュルーム・粉砂糖・青ねぎ・塩鮭）。「粗びき黒こしょう」→「黒こしょう」は改名なので増えない
const PRICE_DEFAULTS_COUNT = 181
check(
  PRICE_DEFAULTS.length === PRICE_DEFAULTS_COUNT,
  `PRICE_DEFAULTSの件数が想定と違う: 実際=${PRICE_DEFAULTS.length}件 / 想定=${PRICE_DEFAULTS_COUNT}件。` +
    '意図した増減なら scripts/test-price.mjs の PRICE_DEFAULTS_COUNT を直すこと',
)
console.log(`件数のピン留め: ${PRICE_DEFAULTS.length}件`)

// ---------- 1-c. かな正規化して同じキーになる二重登録が無いこと(2026-08-09 便EI) ----------
// 照合(matchPriceEntry)も重複チェック(db/prices.tsのnormalizeForDuplicateCheck)もかな正規化した
// キーで比べるので、「にんじん」と「人参」のような組は同じ1件として扱われる。両方を載せると
// 片方だけ値を変えたときに、どちらが使われるか分からない不整合になる(値が同じうちは実害が出ず
// 気づけない)。別表記は logic/ingredientReadings.ts の読み辞書に載せて1件へ寄せること。
const kanaGroups = new Map()
for (const d of PRICE_DEFAULTS) {
  const key = toHiragana(d.name)
  if (!kanaGroups.has(key)) kanaGroups.set(key, [])
  kanaGroups.get(key).push(d.name)
}
for (const [key, names] of kanaGroups) {
  check(
    names.length === 1,
    `かな正規化すると同じキー「${key}」になる二重登録: ${names.join('・')}。` +
      '片方に寄せ、別表記は logic/ingredientReadings.ts の読み辞書で吸収すること',
  )
}

// 統合した別表記が、読み辞書経由で今までどおり同じ1件に解決すること(照合が壊れていない証明)
{
  const aliasIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const aliasCases = [
    ['人参', 'にんじん'],
    ['にんじん', 'にんじん'],
    ['ニンジン', 'にんじん'],
    ['味噌', 'みそ'],
    ['みそ', 'みそ'],
    ['ミソ', 'みそ'],
  ]
  for (const [written, expected] of aliasCases) {
    const hit = matchPriceEntry(written, aliasIndex)
    check(
      hit?.normalizedName === expected,
      `「${written}」がマスタの「${expected}」に解決しない(実際=${hit?.normalizedName ?? 'なし'})`,
    )
  }
}

// ---------- 2. 全カタログ109品の価格カバー ----------
// テーマ全廃(2026-07-23)で旧配布テーマ(kintore/bento/diet/summer/freezer)は starterDefs に
// 合流したため、starterDefs(109品)だけで全カタログを網羅する(旧: 基本51+kintore+bentoの71品)。
// 「公式レシピなのに価格が無いのはおかしい」の回帰固定はそのまま全109品へ広げる
const sets = {
  starter: starterDefs,
}
let totalCheckedRecipes = 0
for (const recs of Object.values(sets)) totalCheckedRecipes += recs.length
check(totalCheckedRecipes === 109, `対象レシピ数が想定外: ${totalCheckedRecipes}（全カタログ109品のはず）`)

const index = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
const uncovered = new Map() // 材料名 -> Set(出現レシピ)
let totalIngredients = 0
for (const [setName, recs] of Object.entries(sets)) {
  for (const r of recs) {
    for (const ing of r.ingredients) {
      const name = ing.name.trim()
      if (!name) continue
      if (isZeroIngredient(name)) continue
      totalIngredients++
      const hit = matchPriceEntry(name, index)
      if (!hit) {
        if (!uncovered.has(name)) uncovered.set(name, new Set())
        uncovered.get(name).add(`${setName}:${r.title}`)
      }
    }
  }
}

console.log(`価格マスタ未対応の材料(異なり数): ${uncovered.size}種 / のべ${totalIngredients}材料中`)
if (uncovered.size > 0) {
  console.error('価格マスタ未対応の材料一覧:')
  for (const [name, recipeSet] of [...uncovered.entries()].sort()) {
    console.error(`  - "${name}" ← ${[...recipeSet].join(', ')}`)
  }
}
// 公式レシピ(基本51+全パック)で使う材料は、価格対象なのにマスタに無いものが0であること
// （2026-07-13オーナー指示の回帰固定。空文字列でも「水」等でもない実材料は必ずマスタにあること）
check(uncovered.size === 0, `価格マスタ未対応の材料が${uncovered.size}種ある。上の一覧を src/data/priceDefaults.ts に追加すること`)

// ---------- 結果 ----------
if (failures > 0) {
  console.error(`\n失敗: ${failures}件`)
  process.exit(1)
}
console.log('\nすべての価格マスタテストに合格')
