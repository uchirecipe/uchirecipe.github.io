// 栄養価概算(M6-1)の回帰スモークテスト。
// 実行: npx tsx scripts/test-nutrition.mjs           … 検証（スナップショットと照合）
//       npx tsx scripts/test-nutrition.mjs --update  … スナップショットを作り直す
// (nutrition.ts等の拡張子なしimportをNodeネイティブでは解決できないため、tsx経由で実行すること)
//
// 対象（回帰スモークセット）: 同梱の基本レシピ51品 ＋ 配布セット全パック(kintore/bento、src/sets/*.ts)
// ＋ 発売スコープ確定済みの残り3パック(review2/8/16=public/sets/data/配下のJSON。docs/33の
// 「5パック52品」のうちsrc/sets/*.ts化されていない分。2026-07-21 栄養カバレッジ監査(便AL)で追加)。
// 基本51+配布5パック52=合計103品が「全カタログ」(docs/47参照)。
// - データの健全性（値の範囲・alias衝突なし）
// - 全レシピが例外なく計算でき、1人分kcalが常識的な範囲に収まる
// - 名寄せカバー率が100%であること（未カバり=1件でも失敗。2026-07-13オーナー指示で必須化。
//   ただし八訂に収載が無く出典を捏造できないと判断した既知の2件はKNOWN_UNCOVEREDで明示許可=
//   docs/47「出典の検証」節の誠実性ルールに従い、値をでっち上げるより「対象外のまま」を選んだもの）
// - 前回スナップショット(scripts/data/nutrition-smoke-snapshot.json)と数値が一致する
//   （公式データ・対応表・換算ロジックのどれかが変わると差分で気づける）
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SNAPSHOT_PATH = path.join(__dirname, 'data', 'nutrition-smoke-snapshot.json')

const { NUTRITION_DATA } = await import('../src/logic/nutritionData.ts')
const { computeRecipeNutrition, matchNutritionFood, roundNutrient } = await import(
  '../src/logic/nutrition.ts'
)
const { starterDefs } = await import('../src/db/starters.ts')
const kintore = await import('../src/sets/kintore.ts')
const bento = await import('../src/sets/pack07.ts')

// 発売スコープ確定済み・src/sets/*.ts未実装の3パック(承認導線は別だが、docs/33で発売スコープ確定済み。
// lint-recipes.mjsと同じ読み込み範囲)
const reviewPacks = []
for (const [file, label] of [
  ['review8.json', 'review8'],
  ['review2.json', 'review2'],
  ['review16.json', 'review16'],
]) {
  const reviewPath = path.join(__dirname, '..', 'public', 'sets', 'data', file)
  if (existsSync(reviewPath)) {
    const parsed = JSON.parse(readFileSync(reviewPath, 'utf-8'))
    reviewPacks.push({ set: label, recipes: parsed.recipes })
  }
}

// 八訂(2023増補)に収載が無く、出典を捏造しない方針(docs/47「出典の検証」節)により
// 対象外のまま据え置いている材料(2026-07-21カバレッジ監査で確認・オーナー方針待ち)
const KNOWN_UNCOVERED = new Set(['グラノーラ', 'コチュジャン'])

let failures = 0
function check(ok, message) {
  if (!ok) {
    failures++
    console.error(`✗ ${message}`)
  }
}

// ---------- 1. データ健全性 ----------
for (const food of NUTRITION_DATA.foods) {
  const { kcal, proteinG, fatG, carbG, saltG, fiberG, ironMg, calciumMg } = food.per100g
  check(kcal >= 0 && kcal <= 900, `${food.label}: kcalが範囲外 (${kcal})`)
  check(proteinG >= 0 && proteinG <= 100, `${food.label}: たんぱく質が範囲外 (${proteinG})`)
  check(fatG >= 0 && fatG <= 100, `${food.label}: 脂質が範囲外 (${fatG})`)
  check(carbG >= 0 && carbG <= 100, `${food.label}: 炭水化物が範囲外 (${carbG})`)
  check(saltG >= 0 && saltG <= 100, `${food.label}: 食塩相当量が範囲外 (${saltG})`)
  // 2026-07-13 第2弾: 食物繊維・鉄・カルシウム。「全食品に3項目が存在する」ことを必須とする
  // (undefinedだと範囲チェックがすり抜けるため、まず数値であることをNumber.isFiniteで確認)。
  // 範囲の上限は収載最大値(食物繊維=粉寒天79g・カルシウム=いりごま1200mg)を少し超える程度の
  // 緩い健全性チェック。鉄・カルシウムは2026-07-21に乾燥ハーブ(バジル粉・鉄120mg/カルシウム2800mg)を
  // 追加した際、乾燥・粉末の香辛料類は可食部100gあたりが極端に濃縮された値になる(実際の1回使用量は
  // 小さじ1杯=1g程度でごく少量)ことが分かったため上限を広げた(青のり77mg・いりごま1200mgはそれでも
  // 参考値として残る)
  check(Number.isFinite(fiberG), `${food.label}: 食物繊維(fiberG)が数値でない (${fiberG})`)
  check(Number.isFinite(ironMg), `${food.label}: 鉄(ironMg)が数値でない (${ironMg})`)
  check(Number.isFinite(calciumMg), `${food.label}: カルシウム(calciumMg)が数値でない (${calciumMg})`)
  check(fiberG >= 0 && fiberG <= 100, `${food.label}: 食物繊維が範囲外 (${fiberG})`)
  check(ironMg >= 0 && ironMg <= 150, `${food.label}: 鉄が範囲外 (${ironMg})`)
  check(calciumMg >= 0 && calciumMg <= 3000, `${food.label}: カルシウムが範囲外 (${calciumMg})`)
  for (const [unit, grams] of Object.entries(food.unitGrams ?? {})) {
    check(grams > 0 && grams <= 2000, `${food.label}: 単位${unit}の重量が不自然 (${grams}g)`)
  }
}
console.log(`データ健全性: ${NUTRITION_DATA.foods.length}食品を確認（食物繊維・鉄・カルシウム含む8成分）`)

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
  // 2026-07-21 栄養カバレッジ監査(便AL)で対応。docs/47参照
  ['白みそ', '白味噌'], ['生だら', 'たら'], ['さわら(切り身)', 'さわら'],
  ['豆乳(無調整)', '豆乳'], ['いちご', 'いちご'], ['キウイ', 'キウイ'], ['ブルーベリー', 'ブルーベリー'],
  ['乾燥ハーブ(オレガノまたはバジル)', '乾燥ハーブ'], ['乾燥ハーブ(オレガノまたはローズマリー)', '乾燥ハーブ'],
]
for (const [input, expected] of expectMatches) {
  const hit = matchNutritionFood(input)
  check(hit?.label === expected, `名寄せ: "${input}" → 期待:${expected} 実際:${hit?.label ?? '(不一致)'}`)
}
// 誤マッチしてはいけないもの(実在しない/未対応の材料が、部分一致で無関係な食品に化けないことの確認)
// コチュジャン・グラノーラは八訂(2023増補)に収載が無く、出典を捏造しない方針により未対応のまま
// (2026-07-21カバレッジ監査・docs/47参照。KNOWN_UNCOVEREDと同じ2件)
for (const name of ['付属のソース', 'コチュジャン', 'グラノーラ']) {
  const hit = matchNutritionFood(name)
  check(hit === null, `名寄せ: "${name}" は対象外のはずが ${hit?.label} に一致`)
}
console.log(`名寄せ確認: ${expectMatches.length + 3}件`)

// ---------- 2. 回帰スモークセット（全カタログ103品=基本51+配布5パック52） ----------
const recipes = [
  ...starterDefs.map((d) => ({ set: 'starter', title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ...kintore.recipes.map((d) => ({ set: 'kintore', title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ...bento.recipes.map((d) => ({ set: 'bento', title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ...reviewPacks.flatMap((p) =>
    p.recipes.map((d) => ({ set: p.set, title: d.title, servings: d.servings, ingredients: d.ingredients })),
  ),
]
check(recipes.length === 103, `レシピ数が想定外: ${recipes.length}（基本51+配布5パック(kintore10+bento10+review8 11+review2 10+review16 11)=103のはず。2026-07-21栄養カバレッジ監査(便AL)でreview2/8/16をスコープに追加）`)

let totalIngredients = 0
let matchedIngredients = 0
let knownUncoveredOccurrences = 0
const uncovered = new Map() // 名寄せカバー率100%に届かない材料の一覧(退行検知用の詳細。KNOWN_UNCOVEREDは別集計)
const knownUncoveredSeen = new Set()
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
      if (KNOWN_UNCOVERED.has(ex.name)) {
        knownUncoveredSeen.add(ex.name)
        knownUncoveredOccurrences++
        continue
      }
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
      // 2026-07-13 第2弾で追加した3項目もスナップショット照合の対象にする
      fiberG: roundNutrient('fiberG', p.fiberG),
      ironMg: roundNutrient('ironMg', p.ironMg),
      calciumMg: roundNutrient('calciumMg', p.calciumMg),
    },
    excluded: result.excluded.map((e) => `${e.name}(${e.reason})`).sort(),
  }
}

const coverage = matchedIngredients / totalIngredients
// KNOWN_UNCOVERED分を除いた「対応可能な範囲での」カバー率(八訂に無い2件は分母からも除く)
const adjustedTotal = totalIngredients - knownUncoveredOccurrences
const adjustedCoverage = adjustedTotal > 0 ? matchedIngredients / adjustedTotal : 1
console.log(`名寄せカバー率: ${(coverage * 100).toFixed(1)}%（${matchedIngredients}/${totalIngredients}材料。既知の対象外${knownUncoveredOccurrences}件を除くと${(adjustedCoverage * 100).toFixed(1)}%）`)
if (uncovered.size > 0) {
  console.error('未カバー材料一覧:')
  for (const [name, recipeSet] of [...uncovered.entries()].sort()) {
    console.error(`  - "${name}" ← ${[...recipeSet].join(', ')}`)
  }
}
// 公式レシピ(基本51+全パック)は、KNOWN_UNCOVERED(出典が捏造できないため意図的に対象外のもの。
// docs/47参照)を除いて全食材が名寄せできていること。1件でも想定外の未カバーがあれば失敗させる
// （2026-07-13オーナー指示: 「公式レシピなのに対応していない数値があるのはおかしい」の回帰固定）
check(uncovered.size === 0, `名寄せカバー率が100%でない（想定外の未カバー${uncovered.size}種）。上の一覧を scripts/nutrition-foods.mjs に追加するか、意図的なものならKNOWN_UNCOVEREDに追加すること`)
check(adjustedCoverage === 1, `KNOWN_UNCOVERED以外の名寄せカバー率が100%でない (${(adjustedCoverage * 100).toFixed(1)}%)`)
check(
  knownUncoveredSeen.size === KNOWN_UNCOVERED.size,
  `KNOWN_UNCOVEREDの想定と実際が食い違う（想定:${[...KNOWN_UNCOVERED].join(',')} 実際に検出:${[...knownUncoveredSeen].join(',')}）。`
    + 'どちらか解消済みならKNOWN_UNCOVEREDから削除、新たに増えたなら理由をdocs/47に書いてから追加すること',
)

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
