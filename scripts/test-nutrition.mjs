// 栄養価概算(M6-1)の回帰スモークテスト。
// 実行: npx tsx scripts/test-nutrition.mjs           … 検証（スナップショットと照合）
//       npx tsx scripts/test-nutrition.mjs --update  … スナップショットを作り直す
// (nutrition.ts等の拡張子なしimportをNodeネイティブでは解決できないため、tsx経由で実行すること)
//
// 対象（回帰スモークセット）: 同梱の基本レシピ51品 ＋ 配布セット全パック
// （「筋トレ・高たんぱく」10品 ＋「和食の作り置き・お弁当」10品）。
// - データの健全性（値の範囲・alias衝突なし）
// - 全レシピが例外なく計算でき、1人分kcalが常識的な範囲に収まる
// - 名寄せカバー率が100%であること（未カバり=1件でも失敗。2026-07-13オーナー指示で必須化）
// - 前回スナップショット(scripts/data/nutrition-smoke-snapshot.json)と数値が一致する
//   （公式データ・対応表・換算ロジックのどれかが変わると差分で気づける）
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = path.join(__dirname, 'data', 'nutrition-smoke-snapshot.json')

const { NUTRITION_DATA } = await import('../src/logic/nutritionData.ts')
const { computeRecipeNutrition, matchNutritionFood, roundNutrient } = await import(
  '../src/logic/nutrition.ts'
)
const { starterDefs } = await import('../src/db/starters.ts')
const kintore = await import('../src/sets/kintore.ts')
const bento = await import('../src/sets/pack07.ts')

let failures = 0
function check(ok, message) {
  if (!ok) {
    failures++
    console.error(`✗ ${message}`)
  }
}

// ---------- 1. データ健全性 ----------
for (const food of NUTRITION_DATA.foods) {
  const { kcal, proteinG, fatG, carbG, saltG } = food.per100g
  check(kcal >= 0 && kcal <= 900, `${food.label}: kcalが範囲外 (${kcal})`)
  check(proteinG >= 0 && proteinG <= 100, `${food.label}: たんぱく質が範囲外 (${proteinG})`)
  check(fatG >= 0 && fatG <= 100, `${food.label}: 脂質が範囲外 (${fatG})`)
  check(carbG >= 0 && carbG <= 100, `${food.label}: 炭水化物が範囲外 (${carbG})`)
  check(saltG >= 0 && saltG <= 100, `${food.label}: 食塩相当量が範囲外 (${saltG})`)
  for (const [unit, grams] of Object.entries(food.unitGrams ?? {})) {
    check(grams > 0 && grams <= 2000, `${food.label}: 単位${unit}の重量が不自然 (${grams}g)`)
  }
}
console.log(`データ健全性: ${NUTRITION_DATA.foods.length}食品を確認`)

// 個別の名寄せ確認（衝突しやすい代表例）
const expectMatches = [
  ['玉ねぎ', '玉ねぎ'], ['タマネギ', '玉ねぎ'], ['玉葱', '玉ねぎ'], ['新玉ねぎ', '玉ねぎ'],
  ['鶏胸肉', '鶏むね肉'], ['鶏むね肉（皮なし）', '鶏むね肉'],
  ['酒', '酒'], ['料理酒', '酒'], ['鮭', '鮭'], ['さば(切り身)', 'さば'],
  ['めんつゆ（2倍濃縮）', 'めんつゆ（2倍濃縮）'], ['めんつゆ(3倍濃縮)', 'めんつゆ（3倍濃縮）'],
  ['めんつゆ', 'めんつゆ（2倍濃縮）'],
  ['塩こしょう', '塩'], ['水またはだし汁', 'だし汁'],
  ['カットトマト缶', 'トマト缶'], ['サバ水煮缶', 'サバ水煮缶'],
  ['木綿豆腐', '木綿豆腐'], ['豆腐', '木綿豆腐'], ['絹ごし豆腐', '絹ごし豆腐'],
  ['刻みねぎ', '青ねぎ'], ['万能ねぎ', '小ねぎ'], ['長ねぎ', '長ねぎ'],
  ['すりごま', 'いりごま'], ['白ごま', 'いりごま'],
  // 2026-07-13 データ整備で対応(以前は「誤マッチしてはいけないもの」扱いだったが、専用食品を
  // 追加したことで正しく一致するようになった。以下は退行検知用)
  ['シチュールー', 'シチュールー'], ['揚げ油', 'サラダ油'],
  ['高野豆腐（こうやどうふ）', '高野豆腐'], ['切り干し大根', '切り干し大根'],
  ['牛薄切り肉', '牛こま切れ肉'], ['刻みのり', '焼きのり'],
]
for (const [input, expected] of expectMatches) {
  const hit = matchNutritionFood(input)
  check(hit?.label === expected, `名寄せ: "${input}" → 期待:${expected} 実際:${hit?.label ?? '(不一致)'}`)
}
// 誤マッチしてはいけないもの(実在しない/未対応の材料が、部分一致で無関係な食品に化けないことの確認)
for (const name of ['付属のソース']) {
  const hit = matchNutritionFood(name)
  check(hit === null, `名寄せ: "${name}" は対象外のはずが ${hit?.label} に一致`)
}
console.log(`名寄せ確認: ${expectMatches.length + 1}件`)

// ---------- 2. 回帰スモークセット（同梱51品＋筋トレ10品＋お弁当10品） ----------
const recipes = [
  ...starterDefs.map((d) => ({ set: 'starter', title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ...kintore.recipes.map((d) => ({ set: 'kintore', title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ...bento.recipes.map((d) => ({ set: 'bento', title: d.title, servings: d.servings, ingredients: d.ingredients })),
]
check(recipes.length === 71, `レシピ数が想定外: ${recipes.length}（同梱51+高たんぱく10+お弁当10=71のはず。2026-07-13データ整備で「全パック」カバーのためbento(パック7)をスコープに追加）`)

let totalIngredients = 0
let matchedIngredients = 0
const uncovered = new Map() // 名寄せカバー率100%に届かない材料の一覧(退行検知用の詳細)
const snapshot = {}
for (const r of recipes) {
  const result = computeRecipeNutrition(r)
  const p = result.perServing
  const kcal = roundNutrient('kcal', p.kcal)
  check(Number.isFinite(kcal), `${r.title}: kcalが数値でない`)
  check(kcal >= 20 && kcal <= 1500, `${r.title}: 1人分${kcal}kcalは常識的範囲(20〜1500)の外`)
  for (const ex of result.excluded) {
    check(['food', 'unit', 'amount', 'prep'].includes(ex.reason), `${r.title}: 不明な対象外理由 ${ex.reason}`)
    if (ex.reason === 'food') {
      if (!uncovered.has(ex.name)) uncovered.set(ex.name, new Set())
      uncovered.get(ex.name).add(`${r.set}:${r.title}`)
    }
  }
  const zeroCount = r.ingredients.filter((i) => ['水', 'お湯', '湯', '熱湯'].includes(i.name.trim())).length
  const counted = r.ingredients.length - zeroCount
  totalIngredients += counted
  matchedIngredients += result.items.length + result.excluded.filter((e) => e.reason !== 'food').length
  snapshot[`${r.set}:${r.title}`] = {
    servings: result.servings,
    perServing: {
      kcal,
      proteinG: roundNutrient('proteinG', p.proteinG),
      fatG: roundNutrient('fatG', p.fatG),
      carbG: roundNutrient('carbG', p.carbG),
      saltG: roundNutrient('saltG', p.saltG),
    },
    excluded: result.excluded.map((e) => `${e.name}(${e.reason})`).sort(),
  }
}

const coverage = matchedIngredients / totalIngredients
console.log(`名寄せカバー率: ${(coverage * 100).toFixed(1)}%（${matchedIngredients}/${totalIngredients}材料）`)
if (uncovered.size > 0) {
  console.error('未カバー材料一覧:')
  for (const [name, recipeSet] of [...uncovered.entries()].sort()) {
    console.error(`  - "${name}" ← ${[...recipeSet].join(', ')}`)
  }
}
// 公式レシピ(基本51+全パック)は全食材が名寄せできていること。1件でも未カバーなら失敗させる
// （2026-07-13オーナー指示: 「公式レシピなのに対応していない数値があるのはおかしい」の回帰固定）
check(uncovered.size === 0, `名寄せカバー率が100%でない（未カバー${uncovered.size}種）。上の一覧を scripts/nutrition-foods.mjs に追加すること`)
check(coverage === 1, `名寄せカバー率が100%でない (${(coverage * 100).toFixed(1)}%)`)

// 1人分の見当合わせ（代表レシピの期待レンジ。大きく外れたら換算表の退行を疑う）
const spotChecks = [
  ['starter:肉じゃが', 300, 700],
  ['starter:カレーライス', 500, 900],
  ['starter:豆腐とわかめの味噌汁', 20, 120],
  ['kintore:レンジ蒸し鶏（自家製サラダチキン）', 100, 400],
]
for (const [key, min, max] of spotChecks) {
  const s = snapshot[key]
  check(!!s, `スポットチェック対象が見つからない: ${key}`)
  if (s) check(s.perServing.kcal >= min && s.perServing.kcal <= max,
    `${key}: 1人分${s.perServing.kcal}kcalが期待レンジ${min}〜${max}の外`)
}

// ---------- 3. スナップショット照合 ----------
const updateMode = process.argv.includes('--update')
if (updateMode) {
  await writeFile(SNAPSHOT_PATH, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(`スナップショット更新: ${path.relative(process.cwd(), SNAPSHOT_PATH)}`)
} else {
  let previous = null
  try {
    previous = JSON.parse(await readFile(SNAPSHOT_PATH, 'utf8'))
  } catch {
    failures++
    console.error('✗ スナップショットがありません。初回は --update で作成してください')
  }
  if (previous) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(snapshot)])
    for (const key of keys) {
      const a = JSON.stringify(previous[key])
      const b = JSON.stringify(snapshot[key])
      check(a === b, `スナップショット差分: ${key}\n  前回: ${a}\n  今回: ${b}`)
    }
    if (failures === 0) console.log(`スナップショット照合: ${keys.size}レシピ一致`)
  }
}

// ---------- 結果 ----------
if (failures > 0) {
  console.error(`\n失敗: ${failures}件`)
  process.exit(1)
}
console.log('\nすべてのスモークテストに合格')
