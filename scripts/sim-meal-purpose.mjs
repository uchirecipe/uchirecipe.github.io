/**
 * L3: 目的モード（docs/62 決定②・docs/60 第2段の引き直し方式）の回帰シミュレーション。
 * 2026-08-02 便CP-2 で新設。実行:
 *   export PATH="$HOME/.local/node/bin:$PATH" && npx tsx scripts/sim-meal-purpose.mjs
 *   RUNS=400 npx tsx scripts/sim-meal-purpose.mjs   （既定400週。増やすと誤差が減る）
 *
 * 目的:
 *  ① 目的を指定していない状態（＝既定）で、提案の挙動が**1ミリも変わっていない**ことを確かめる
 *     （chooseBalancedPair は k=1 で1回目をそのまま返すので、構造上も変わらないはず）。
 *  ② 目的を指定したとき、docs/60 §4-2 の「維持しなければならない回帰指標」を割らないことを確かめる。
 *     - ジャンル一致率 100%（1件でも混在が出たら不合格＝ロールバック）
 *     - 一品ものの出現率 20〜30%（素の抽選から大きく外れない＝カレー・丼を締め出していない）
 *     - 上位10品が占める割合 45%以下（「振り直しても代わり映えしない」への逆走を防ぐ多様性の指標）
 *     - 提案が0件になった枠が増えていない（0件回避が壊れていない）
 *  ③ 指定した軸が実際に動いているか（たんぱく質が増える／塩分が下がる）を実測で示す。
 *
 * ※ docs/60 §4-2 の「提案の採用率 82.7%」は人がペルソナQAで採否を付けて測った値で、
 *    このスクリプトでは再現できない。ここでは機械で測れる代理指標（多様性・一品もの率・0件率）で
 *    「採用率が大きく落ちる兆候が出ていないか」を見る。
 *
 * 条件は docs/60 §2-1 の実測とそろえる: 7日×夕食・季節フィルタあり・NGなし・時短オフ・ジャンル指定なし。
 * アプリのコードは読むだけで、エンジン（suggestForSlot / suggestPairForSlot）には一切触れない。
 */
import { starterDefs } from '../src/db/starters.ts'
import {
  suggestPairForSlot,
  chooseBalancedPair,
  preferredProteinSources,
  proteinSourceOf,
  recipeGenre,
  isOneDish,
  PURPOSE_REDRAW_ATTEMPTS,
} from '../src/logic/mealPlan.ts'
import { purposePenalty } from '../src/logic/nutritionBalance.ts'
import { computeRecipeNutrition } from '../src/logic/nutrition.ts'

const RUNS = Number(process.env.RUNS ?? 400)
const SEASON = process.env.SEASON ?? 'summer'
const DAYS = 7

/**
 * 同梱109品を「登録済みレシピ」の形にする（idと、DB側で必ず入る空配列だけを足す）。
 * cookedLogs は「最近作ってない品を優先」の判定（logic/cooked.ts）が読むので、
 * 新規ユーザー相当の空配列を入れる＝1品も作っていない状態でのシミュレーション。
 */
const recipes = starterDefs.map((def, i) => ({
  ...def,
  id: i + 1,
  isStarter: true,
  cookedLogs: [],
  favorite: false,
}))

/** 1人分の栄養キャッシュ（アプリ側と同じくレシピ1件につき1回だけ計算する） */
const perServingCache = new Map()
const perServingOf = (recipe) => {
  const hit = perServingCache.get(recipe.id)
  if (hit) return hit
  const value = computeRecipeNutrition(recipe).perServing
  perServingCache.set(recipe.id, value)
  return value
}

/** 1週間（7日×夕食）を組む。purpose=undefined なら現行どおり1回引くだけ */
function fillWeek(purpose) {
  const usedRecipeIds = []
  const proteinCounts = { 肉: 0, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }
  const days = []
  for (let d = 0; d < DAYS; d++) {
    const options = {
      quickOnly: false,
      excludeNg: true,
      ngIngredients: [],
      usedRecipeIds,
      slot: 'dinner',
      season: SEASON,
      preferProteinSources: preferredProteinSources(proteinCounts),
    }
    const draw = () => suggestPairForSlot(recipes, options)
    const pair = purpose
      ? chooseBalancedPair(
          draw,
          (p) =>
            purposePenalty(
              purpose,
              [p.main, p.side].filter(Boolean).map(perServingOf),
            ),
          PURPOSE_REDRAW_ATTEMPTS,
        )
      : draw()
    if (pair.main) {
      usedRecipeIds.push(pair.main.id)
      proteinCounts[proteinSourceOf(pair.main)] += 1
    }
    if (pair.side) usedRecipeIds.push(pair.side.id)
    days.push(pair)
  }
  return days
}

function measure(label, purpose) {
  const counts = new Map()
  let dayCount = 0
  let genreMixDays = 0
  let oneDishDays = 0
  let emptyDays = 0
  let sideless = 0
  let proteinSum = 0
  let saltSum = 0
  for (let run = 0; run < RUNS; run++) {
    for (const pair of fillWeek(purpose)) {
      dayCount++
      if (!pair.main && !pair.side) {
        emptyDays++
        continue
      }
      if (pair.main && isOneDish(pair.main)) oneDishDays++
      if (pair.main && !pair.side && !isOneDish(pair.main)) sideless++
      const mainGenre = pair.main ? recipeGenre(pair.main) : undefined
      const sideGenre = pair.side ? recipeGenre(pair.side) : undefined
      if (mainGenre && sideGenre && mainGenre !== sideGenre) genreMixDays++
      for (const r of [pair.main, pair.side]) {
        if (!r) continue
        counts.set(r.title, (counts.get(r.title) ?? 0) + 1)
        const n = perServingOf(r)
        proteinSum += n.proteinG
        saltSum += n.saltG
      }
    }
  }
  const totalDishes = [...counts.values()].reduce((a, b) => a + b, 0)
  const top10 = [...counts.values()].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0)
  return {
    label,
    dayCount,
    genreMixDays,
    genreMatchRate: ((dayCount - genreMixDays) / dayCount) * 100,
    oneDishRate: (oneDishDays / dayCount) * 100,
    emptyDays,
    sideless,
    top10Share: (top10 / totalDishes) * 100,
    proteinPerDay: proteinSum / dayCount,
    saltPerDay: saltSum / dayCount,
  }
}

const results = [
  measure('目的なし（現行・k=1）', undefined),
  measure('たんぱく質を多めに（k=3）', 'protein'),
  measure('塩分をひかえめに（k=3）', 'lowSalt'),
]

console.log(`条件: ${RUNS}週 × ${DAYS}日 × 夕食 / 季節=${SEASON} / 同梱${recipes.length}品 / k=${PURPOSE_REDRAW_ATTEMPTS}`)
console.log('')
for (const r of results) {
  console.log(`■ ${r.label}`)
  console.log(`   ジャンル一致率      : ${r.genreMatchRate.toFixed(1)}%（混在 ${r.genreMixDays}日）`)
  console.log(`   一品ものの出現率    : ${r.oneDishRate.toFixed(1)}%`)
  console.log(`   上位10品が占める割合: ${r.top10Share.toFixed(1)}%`)
  console.log(`   提案0件の枠         : ${r.emptyDays}日 / 副菜が付かなかった枠(一品もの以外): ${r.sideless}日`)
  console.log(`   1日あたり(1人分)    : たんぱく質 ${r.proteinPerDay.toFixed(1)}g ／ 塩分 ${r.saltPerDay.toFixed(2)}g`)
  console.log('')
}

// 合否判定（docs/60 §4-2 のロールバック線）
const failures = []
for (const r of results) {
  if (r.genreMixDays !== 0) failures.push(`${r.label}: ジャンル混在が${r.genreMixDays}日（合格ラインは0日）`)
  if (r.oneDishRate < 20 || r.oneDishRate > 30) failures.push(`${r.label}: 一品もの率 ${r.oneDishRate.toFixed(1)}%（合格ラインは20〜30%）`)
  if (r.top10Share > 45) failures.push(`${r.label}: 上位10品シェア ${r.top10Share.toFixed(1)}%（合格ラインは45%以下）`)
  if (r.emptyDays !== 0) failures.push(`${r.label}: 提案0件の枠が${r.emptyDays}日（合格ラインは0日）`)
}
if (failures.length > 0) {
  console.log('NG（docs/60 §4-2 のロールバック線を割った）:')
  for (const f of failures) console.log(`  - ${f}`)
  process.exit(1)
}
console.log('すべての回帰指標が合格ライン内（docs/60 §4-2）')
