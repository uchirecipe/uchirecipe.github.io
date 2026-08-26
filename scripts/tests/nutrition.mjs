// 栄養（計算・名寄せ・栄養バランス献立・目的モード）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import { canUseRecipeImportTools } from '../../src/logic/freeLimit.ts'
import { convertToGrams } from '../../src/logic/nutrition.ts'
import {
  planWeekFill,
  preservedItemCount,
  chooseBalancedPair,
  PURPOSE_REDRAW_ATTEMPTS,
} from '../../src/logic/mealPlan.ts'
// 便KO（2026-08-25）: 取り込みで入らない項目と、1品に複数料理が入った品の見分け
import { recipeGenreTag, tagsWithGenre } from '../../src/logic/importFieldGaps.ts'
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
// 便KP: 成分表の版番号（scripts/nutrition-foods.mjs で管理し、nutritionData.ts に焼き込まれる）
import { NUTRITION_DATA as NUTRITION_DATA_FOR_KP } from '../../src/logic/nutritionData.ts'
import {
  PRICE_DEFAULTS_VERSION as PRICE_DEFAULTS_VERSION_FOR_JG,
} from '../../src/data/priceDefaults.ts'
import { waitSignaledByAppliance } from '../../src/logic/cookNavi.ts'
import {
  sortResults,
  defaultSortDirection,
  buildCostSortValues,
  isNutrientSortOption,
  isFreeSortOption,
} from '../../src/logic/recipeSort.ts'
import {
  buildPriceIndex,
  estimateIngredientYen,
  estimateRecipeCost,
  sumMealPlanEntriesCost,
  pricelessIngredientNamesOfRecipes,
  recipeCostConfidence,
} from '../../src/logic/priceEstimate.ts'
import {
  DAILY_GUIDES,
  RANGE_EXCLUDED_RATIO_LIMIT,
  PURPOSE_NUTRIENT_KEY,
  canCompareDay,
  canCompareRange,
  dayBalanceMap,
  guideForDays,
  isMorePurpose,
  purposeAxisValue,
  purposePenalty,
  RICE_SERVING_RECIPE,
  reviewPurposeDays,
  riceServingGrams,
  riceServingRecipes,
  riceSlotKeysOf,
  riceServingsByDate,
  slotBalances,
  sumBalance,
  summarizeWeekBalance,
  vegetableGrams,
} from '../../src/logic/nutritionBalance.ts'
import { LESS_MEAL_PURPOSES, MEAL_PURPOSES, MORE_MEAL_PURPOSES } from '../../src/db/types.ts'
import { parseViewReturn, serializeViewReturn } from '../../src/logic/navMemory.ts'
import {
  COOK_NAVI_TRIAL_LIMIT,
  MONTH_TRIAL_LIMIT,
  MONTH_TRIAL_MIN_COOKED,
  NUTRITION_TRIAL_LIMIT,
  canUseCookNaviTrial,
  canUseMonthTrial,
  canUseNutritionTrial,
  consumeCookNaviTrial,
  cookNaviTrialRemaining,
  isCookNaviTrialExhausted,
  isMonthTrialReady,
  isNutritionTrialExhausted,
} from '../../src/logic/proTrial.ts'
import { buildShareText } from '../../src/logic/share.ts'
import { starterDefs, buildUpdatedStarterRecipe } from '../../src/db/starters.ts'
import { replaceConfirmTargets, needsReplaceConfirm } from '../../src/logic/replaceConfirm.ts'
import { ja } from '../../src/i18n/ja.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

const NUTRITION_DB_VERSION_FOR_KP = NUTRITION_DATA_FOR_KP.dbVersion

// ---------- 栄養概算: 少々・適量の仮定値計上(2026-07-11) ----------
{
  const { computeRecipeNutrition } = await import('../../src/logic/nutrition.ts')
  const recipe = {
    servings: 2,
    ingredients: [
      { name: '塩こしょう', amount: '少々', unit: '', memo: '1食あたり約0.25gが目安' },
      { name: 'サラダ油', amount: '適量', unit: '', memo: '大さじ1/2〜1が目安' },
      { name: '白ごま', amount: 'お好みで', unit: '' },
      { name: '塩', amount: '少々', unit: '', memo: 'きゅうりの塩もみ用' },
    ],
  }
  const r = computeRecipeNutrition(recipe)
  eq('塩こしょう少々はmemoの0.25g/食で計上', Math.abs(r.perServing.saltG - 0.25) < 0.02, true)
  eq('油の適量は仮定3g/食でkcal計上', r.perServing.kcal > 20, true)
  eq('仮定計上が2件記録される', r.assumed.length, 2)
  eq('お好みでは計算対象外のまま', r.excluded.some((e) => e.name === '白ごま'), true)
  eq('塩もみ用の塩はprep除外のまま', r.excluded.some((e) => e.reason === 'prep'), true)
}

// ---------- 栄養名寄せ: 塩昆布は素干し昆布ではなく専用食品(09022)へ名寄せ(2026-07-23 オーナー実機報告) ----------
// 従来は「塩昆布」が素干し昆布(09017・食塩相当量6.6g/100g)への部分一致に流れ、食塩相当量を過小評価していた。
{
  const { matchNutritionFood, computeRecipeNutrition } = await import('../../src/logic/nutrition.ts')
  const food = matchNutritionFood('塩昆布')
  eq('塩昆布は塩昆布(09022)に名寄せ(素干し昆布09017に流れない)', food?.id, '09022')
  // 八訂09022 塩昆布の食塩相当量(18.0g/100g)→ 3gで約0.54g。タスク基準「約0.5g程度」を満たす
  const saltFor3g = food ? (3 * food.per100g.saltG) / 100 : null
  eq('塩昆布3gの食塩相当量が約0.5g(0.4〜0.7の範囲)', saltFor3g !== null && saltFor3g >= 0.4 && saltFor3g <= 0.7, true)
  // 実レシピ「キャベツの塩昆布あえ」(塩昆布10g・2人分)の1人分食塩相当量が0.9g前後へ是正される
  // (素干し昆布に流れていた頃は0.33g/人分だった)
  const dish = computeRecipeNutrition({
    servings: 2,
    ingredients: [
      { name: 'キャベツ', amount: '1/4', unit: '個' },
      { name: '塩', amount: '1/4', unit: '小さじ', memo: 'キャベツの塩もみ用。1個あたり約6gが目安' },
      { name: '塩昆布', amount: '10', unit: 'g' },
      { name: 'ごま油', amount: '1', unit: '小さじ' },
    ],
  })
  eq('塩昆布あえ1人分の食塩相当量が0.9g前後へ是正(旧0.33g)', Math.abs(dish.perServing.saltG - 0.9) < 0.05, true)
}

// ---------- NUT-01/NUT-02(2026-07-28 便BY): 部分欠落の判定と、計算対象外の理由・分量テキスト ----------
{
  const { computeRecipeNutrition, hasMaterialGap, sumPersonalNutrition } = await import(
    '../../src/logic/nutrition.ts'
  )
  // 「適量」「少々」の薬味しか外れていないケース → 警告は出さない(誤警告を増やさない)
  const garnishOnly = computeRecipeNutrition({
    servings: 2,
    ingredients: [
      { name: '鶏もも肉', amount: '250', unit: 'g' },
      { name: '白いりごま', amount: '適量(お好みで)', unit: '' },
    ],
  })
  eq('hasMaterialGap: 薬味(適量)だけの対象外では警告しない', hasMaterialGap(garnishOnly), false)
  eq('hasMaterialGap: 対象外0件でも警告しない', hasMaterialGap({ excluded: [] }), false)
  // 量は書いてあるのに成分データが無い(food) → 警告する
  const unknownFood = computeRecipeNutrition({
    servings: 2,
    ingredients: [
      { name: '牛肉', amount: '300', unit: 'g' },
      { name: 'ご飯', amount: '2', unit: '杯' },
    ],
  })
  eq('hasMaterialGap: 量が書いてあるのに成分データが無い材料(food)は警告する', hasMaterialGap(unknownFood), true)
  eq('hasMaterialGap: reasonはfood', unknownFood.excluded[0]?.reason, 'food')
  // 量は書いてあるのに単位を換算できない(unit) → 警告する
  const unknownUnit = computeRecipeNutrition({
    servings: 2,
    ingredients: [
      { name: '米', amount: '360', unit: 'cc' },
      { name: '卵', amount: '2', unit: '個' },
    ],
  })
  eq('hasMaterialGap: 単位をgに換算できない材料(unit)は警告する', hasMaterialGap(unknownUnit), true)
  eq('hasMaterialGap: reasonはunit', unknownUnit.excluded[0]?.reason, 'unit')
  // 塩もみ用の塩(prep)は警告しない
  const prepSalt = computeRecipeNutrition({
    servings: 2,
    ingredients: [
      { name: 'きゅうり', amount: '2', unit: '本' },
      { name: '塩', amount: '1/4', unit: '小さじ', memo: 'きゅうりの塩もみ用' },
    ],
  })
  eq('hasMaterialGap: 下ごしらえ用の塩(prep)では警告しない', hasMaterialGap(prepSalt), false)

  // NUT-02: 計算対象外の材料に、保存されている分量テキストを添える
  eq('excluded.amountText: 保存されている分量テキストを持つ', garnishOnly.excluded[0]?.amountText, '適量(お好みで)')
  eq('excluded.amountText: 単位付きも連結して持つ', unknownUnit.excluded[0]?.amountText, '360cc')
  const emptyAmount = computeRecipeNutrition({
    servings: 1,
    ingredients: [{ name: '秘伝のタレ', amount: '', unit: '' }],
  })
  eq('excluded.amountText: 分量が空ならundefined(空文字を出さない)', emptyAmount.excluded[0]?.amountText, undefined)

  // NUT-01 横展開: 期間の合計でも「一部だけ計算できなかった品数」を数える。
  // 2026-07-28 便CAで averagePerMealNutrition(平均・延べ人数)を廃止したため、
  // 期待値も「延べ人数」から「品数(料理1品=1)」に書き換えている
  const sum = sumPersonalNutrition([
    { servings: 2, ingredients: [{ name: '牛肉', amount: '300', unit: 'g' }, { name: 'ご飯', amount: '2', unit: '杯' }] },
    { servings: 2, ingredients: [{ name: '鶏もも肉', amount: '250', unit: 'g' }] },
  ])
  eq('sumPersonalNutrition: partialDishCountは部分欠落レシピの品数', sum.partialDishCount, 1)
  eq('sumPersonalNutrition: 合計に入れた品数は2品(人数では数えない)', sum.dishCount, 2)
  const noPartial = sumPersonalNutrition([
    { servings: 2, ingredients: [{ name: '鶏もも肉', amount: '250', unit: 'g' }] },
  ])
  eq('sumPersonalNutrition: 部分欠落が無ければpartialDishCount=0', noPartial.partialDishCount, 0)
}

// ---------- NUT-01: シェア文の栄養行に「一部の材料を除く」を添える(2026-07-28 便BY) ----------
{
  const recipe = {
    title: 'テスト',
    servings: 2,
    ingredients: [{ name: '牛肉', amount: '300', unit: 'g' }],
    steps: [],
    tags: [],
  }
  const base = {
    image: false, cookMinutes: false, cost: false, nutrition: true, allIngredients: false,
    kcalPerServing: 100, saltPerServing: 1.2,
  }
  const normal = buildShareText(recipe, { ...base })
  eq('シェア: 部分欠落が無ければ従来どおりの栄養行', normal.includes('1食あたり 約100kcal・塩分 約1.2g（概算）'), true)
  const partial = buildShareText(recipe, { ...base, nutritionHasGap: true })
  eq('シェア: 部分欠落があれば「一部の材料を除く」を添える', partial.includes('（概算・一部の材料を除く）'), true)

  // 2026-08-01 線引きB': 塩分はPro側の項目。無料(saltPerServing未指定)ではカロリーだけの行にする
  // (従来はkcalとsaltが揃わないと栄養行そのものが出なかった)
  const freeLine = buildShareText(recipe, { ...base, saltPerServing: undefined })
  eq('シェア(B\'): 塩分なし(無料)はカロリーだけの栄養行', freeLine.includes('1食あたり 約100kcal（概算）'), true)
  eq('シェア(B\'): 塩分なし(無料)の栄養行に塩分が出ない', freeLine.includes('塩分'), false)
  const freePartial = buildShareText(recipe, {
    ...base,
    saltPerServing: undefined,
    nutritionHasGap: true,
  })
  eq(
    'シェア(B\'): 塩分なし+部分欠落は「一部の材料を除く」を添える',
    freePartial.includes('1食あたり 約100kcal（概算・一部の材料を除く）'),
    true,
  )
}

// ---------- 栄養バランス第1段: 野菜量・日別集計・対象外混在(2026-07-30 便CL・docs/60 第1段) ----------
{
  // (1) 野菜量: docs/60 §4-3 で固定した代表品の期待値(1人分)。109品で再計算しても同値。
  // 「野菜＝八訂の食品群06だけ」の定義が守られているかの見張り役として、
  // ポテトサラダ(じゃがいも540g)と肉じゃが(じゃがいも405g)を必ず入れる(いも類は野菜に数えない)
  const starterByTitle = (title) => {
    const hit = starterDefs.find((r) => r.title === title)
    if (!hit) throw new Error(`test-logic: 基本レシピ「${title}」が見つからない`)
    return hit
  }
  const vegOf = (title) => Math.round(vegetableGrams(starterByTitle(title)))
  eq('CL-VEG 野菜炒め(1人分)の野菜量', vegOf('野菜炒め'), 178)
  eq('CL-VEG コールスロー(1人分)の野菜量', vegOf('コールスロー'), 142)
  eq('CL-VEG ペペロンチーノ(1人分)の野菜量(にんにく・唐辛子だけ)', vegOf('ペペロンチーノ'), 6)
  eq('CL-VEG 鮭の塩焼き(1人分)の野菜量は0g', vegOf('鮭の塩焼き'), 0)
  eq('CL-VEG ポテトサラダ(1人分)はじゃがいもを野菜に数えない', vegOf('ポテトサラダ'), 36)
  eq('CL-VEG 肉じゃが(1人分)もじゃがいもを野菜に数えない', vegOf('肉じゃが'), 134)

  // (2) 食品群の線引き: いも・豆・きのこ・海藻・果物は野菜に入れない
  const one = (name, amount, unit) => ({ servings: 1, ingredients: [{ name, amount, unit }] })
  eq('CL-VEG キャベツ100gは野菜100g', Math.round(vegetableGrams(one('キャベツ', '100', 'g'))), 100)
  eq('CL-VEG じゃがいも100gは野菜0g(いも類02)', vegetableGrams(one('じゃがいも', '100', 'g')), 0)
  eq('CL-VEG しめじ100gは野菜0g(きのこ類08)', vegetableGrams(one('しめじ', '100', 'g')), 0)
  eq('CL-VEG 木綿豆腐100gは野菜0g(豆類04)', vegetableGrams(one('木綿豆腐', '100', 'g')), 0)
  // 名寄せできなかった材料は数えない=野菜量は必ず少なめ(下限側)に出る
  eq('CL-VEG 成分データが無い材料は野菜量に入らない', vegetableGrams(one('クヌルプ', '100', 'g')), 0)
  // 人数で割った1人分になっていること(全量ではない)
  eq(
    'CL-VEG 4人分レシピの野菜量は1人分に割ってから返す',
    vegetableGrams({ servings: 4, ingredients: [{ name: 'キャベツ', amount: '400', unit: 'g' }] }),
    100,
  )

  // (3) 日別集計: 過去日=作った記録・未来日=登録した献立・今日は「作った記録があるものは記録、
  // まだのものは登録した献立」(便CA以降の統一規則＋2026-08-08 便EA。1日を両方で数えない)
  const cabbage = one('キャベツ', '100', 'g')
  const carrot = one('にんじん', '50', 'g')
  const clDates = ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']
  const clMap = dayBalanceMap({
    dates: clDates,
    today: '2026-07-30',
    cooked: [
      { date: '2026-07-28', recipe: cabbage },
      // 今日の作った記録も数える(2026-08-09 便EK。以前は予定側だけを見ていて記録が落ちていた)
      { date: '2026-07-30', recipe: carrot, matchKey: 'r:carrot' },
    ],
    planned: [
      // 過去日の予定は数えない(過去は実績だけ)
      { date: '2026-07-28', recipe: carrot },
      { date: '2026-07-30', recipe: cabbage, matchKey: 'r:cabbage' },
      { date: '2026-07-31', recipe: cabbage },
    ],
  })
  eq('CL-DAY 記録も予定も無い日はMapに入れない', clMap.has('2026-07-29'), false)
  eq('CL-DAY 過去日は作った記録で数える(基準)', clMap.get('2026-07-28').basis, 'actual')
  eq(
    'CL-DAY 過去日は作った記録だけ=同じ日の予定は足さない',
    Math.round(clMap.get('2026-07-28').balance.vegetableG),
    100,
  )
  eq(
    'CL-DAY 過去日は全品が「どの食事か分からない品」(記録に食事の情報が無い)',
    clMap.get('2026-07-28').slotUnknownDishCount,
    1,
  )
  eq('CL-DAY 今日に記録と献立が両方あれば基準はmixed', clMap.get('2026-07-30').basis, 'mixed')
  eq(
    'CL-DAY 今日は「作った記録＋まだ作っていない献立」を足す(記録を落とさない)',
    Math.round(clMap.get('2026-07-30').balance.vegetableG),
    150,
  )
  eq('CL-DAY 未来日も予定で数える', clMap.get('2026-07-31').basis, 'plan')
  eq('CL-DAY 未来日に「食事の分からない品」は無い', clMap.get('2026-07-31').slotUnknownDishCount, 0)
  eq('CL-DAY 数えた日数は記録/予定がある日だけ', summarizeWeekBalance(clMap.values()).countedDays, 3)
  eq(
    'CL-DAY 週まとめは各日の1人分を足した値',
    Math.round(summarizeWeekBalance(clMap.values()).balance.vegetableG),
    350,
  )
  eq(
    'CL-DAY 週まとめの品数も各日の合算',
    summarizeWeekBalance(clMap.values()).balance.nutrition.dishCount,
    4,
  )

  // (3a) 2026-08-09 便EK: 今日の二重計上ゼロ。同じ料理を記録と献立の両方で数えない
  // (数え方は logic/rangeSummary.ts の期間集計＝便EAで直したものと同じ規則)
  {
    const todayOf = (cooked, planned) =>
      dayBalanceMap({ dates: ['2026-07-30'], today: '2026-07-30', cooked, planned }).get('2026-07-30')
    // 予定どおり作った日: 記録と献立に同じ料理が並んでも1品だけ数える
    const done = todayOf(
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }],
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }],
    )
    eq('CL-TODAY 予定どおり作った品は1回だけ数える(二重計上ゼロ)', done.balance.nutrition.dishCount, 1)
    eq('CL-TODAY 予定どおり作った品の野菜量も1品ぶん', Math.round(done.balance.vegetableG), 100)
    eq('CL-TODAY 献立が全部記録に変わった日の基準はactual', done.basis, 'actual')
    eq('CL-TODAY 記録が献立の中の料理なら食事は分かる(小計を出せる)', done.slotUnknownDishCount, 0)
    // 2品の予定のうち1品だけ作った日: 記録1品＋まだの献立1品＝2品
    const half = todayOf(
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }],
      [
        { date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' },
        { date: '2026-07-30', recipe: carrot, matchKey: 'r:2' },
      ],
    )
    eq('CL-TODAY 作った分は記録・まだの分は献立で、合わせて2品', half.balance.nutrition.dishCount, 2)
    eq('CL-TODAY 半分作った日の基準はmixed', half.basis, 'mixed')
    eq('CL-TODAY 半分作った日も食事は全部分かる', half.slotUnknownDishCount, 0)
    // 同じ料理を2枠に予定して1回だけ作った日: 記録1枠ぶんだけを記録に振り替える
    const twice = todayOf(
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }],
      [
        { date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' },
        { date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' },
      ],
    )
    eq('CL-TODAY 同じ料理を2枠に予定して1回作った日は2品のまま', twice.balance.nutrition.dishCount, 2)
    eq('CL-TODAY 記録1件につき献立1枠だけを消費する', twice.basis, 'mixed')
    // 予定に無いものを作った日: 合計には入るが、どの食事のものかは分からない
    const extra = todayOf(
      [{ date: '2026-07-30', recipe: carrot, matchKey: 'r:9' }],
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }],
    )
    eq('CL-TODAY 献立に無い料理の記録も合計に入る', extra.balance.nutrition.dishCount, 2)
    eq('CL-TODAY 献立に無い記録は「食事の分からない品」に数える', extra.slotUnknownDishCount, 1)
    // 照合キーが無い品(ごはんのようにレシピIDを持たない品)は落とさない=従来どおり両方に残る。
    // 画面側(MealPlanPage)はごはんにも専用キーを渡して二重計上を防いでいる
    const rice = todayOf(
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'rice' }],
      [{ date: '2026-07-30', recipe: cabbage, matchKey: 'rice' }],
    )
    eq('CL-TODAY レシピID以外のキー(ごはん)でも二重計上しない', rice.balance.nutrition.dishCount, 1)
    const noKey = todayOf(
      [{ date: '2026-07-30', recipe: cabbage }],
      [{ date: '2026-07-30', recipe: cabbage }],
    )
    eq('CL-TODAY 照合キーが無ければ突き合わせない(記録と献立で2品)', noKey.balance.nutrition.dishCount, 2)
    // 記録だけの今日: 献立が空でも数字が出る(便EK以前は今日の記録が丸ごと落ちていた)
    const cookedOnly = todayOf([{ date: '2026-07-30', recipe: cabbage, matchKey: 'r:1' }], [])
    eq('CL-TODAY 献立が無くても今日の記録だけで数字が出る', cookedOnly.balance.nutrition.dishCount, 1)
    eq('CL-TODAY 記録だけの今日の基準はactual', cookedOnly.basis, 'actual')
    eq('CL-TODAY 献立に無い記録なので食事は分からない', cookedOnly.slotUnknownDishCount, 1)
  }

  // (3b) 食事ごとの小計(2026-08-02 便CW-6。Pro表示の「食事ごとの内訳」)。
  // 並びは朝食→昼食→夕食に固定・料理が無い食事は返さない・数え方は1日の合計と同じ
  const clSlots = slotBalances([
    { slot: 'dinner', recipe: cabbage },
    { slot: 'breakfast', recipe: carrot },
    { slot: 'dinner', recipe: carrot },
  ])
  eq('CL-SLOT 料理のある食事だけを返す', clSlots.length, 2)
  eq(
    'CL-SLOT 並びは朝食→昼食→夕食に固定する',
    clSlots.map((s) => s.slot).join(','),
    'breakfast,dinner',
  )
  eq('CL-SLOT 朝食の小計は朝食の料理だけ', Math.round(clSlots[0].balance.vegetableG), 50)
  eq('CL-SLOT 夕食の小計は同じ食事の2品を足す', Math.round(clSlots[1].balance.vegetableG), 150)
  eq(
    'CL-SLOT 小計の合計は1日の合計と一致する',
    Math.round(clSlots.reduce((sum, s) => sum + s.balance.vegetableG, 0)),
    Math.round(sumBalance([cabbage, carrot, carrot]).vegetableG),
  )
  eq('CL-SLOT 献立が1件も無ければ空', slotBalances([]).length, 0)

  // (3c) ごはんを含めて計算する(2026-08-02 便CW-10)。量・成分値・金額はすべてマスタ参照で、
  // アプリ側に数字を書き写していないこと(成分表を直せばここも自動で変わる)を見張る
  eq('CL-RICE ごはん1杯は成分表の「杯=150g」から引く', riceServingGrams(), 150)
  const riceSum = sumBalance([RICE_SERVING_RECIPE])
  eq('CL-RICE ごはん1杯は1品として数える', riceSum.nutrition.dishCount, 1)
  eq('CL-RICE ごはん1杯のエネルギー(成分表 01088 の156kcal/100g×1.5)', Math.round(riceSum.nutrition.total.kcal), 234)
  eq('CL-RICE ごはんは野菜量に入らない', Math.round(riceSum.vegetableG), 0)
  eq('CL-RICE 杯数ぶんの品を作る', riceServingRecipes(3).length, 3)
  eq('CL-RICE 0杯なら1品も作らない(OFFのときは何も足さない)', riceServingRecipes(0).length, 0)
  eq(
    'CL-RICE 2杯足すとエネルギーも2杯ぶん',
    Math.round(sumBalance(riceServingRecipes(2)).nutrition.total.kcal),
    468,
  )
  eq(
    'CL-RICE ごはん1杯の金額は食材価格マスタから引く',
    estimateRecipeCost(RICE_SERVING_RECIPE.ingredients, buildPriceIndex(PRICE_DEFAULTS)).total,
    30,
  )

  // (3d) 何杯足すかの数え方(2026-08-09 便EN)。オーナー質問「昼食と夕食がおかずのみになって
  // いても1杯のみの追加で計算している?」への回答＝**1日1杯ではなく食事の数だけ**をここで固定する。
  // 一品もの(丼・麺・カレー・鍋)が主菜の食事だけを外す規則も同時に見張る
  const riceDay = '2026-08-09'
  const riceCount = (slots) => riceServingsByDate(riceSlotKeysOf(slots)).get(riceDay) ?? 0
  eq(
    'EN-RICE 昼食と夕食がおかずだけの日は2杯(1杯ではない)',
    riceCount([
      { date: riceDay, slot: 'lunch', oneDishMain: false },
      { date: riceDay, slot: 'dinner', oneDishMain: false },
    ]),
    2,
  )
  eq(
    'EN-RICE 朝・昼・夕の3食に献立があれば3杯',
    riceCount([
      { date: riceDay, slot: 'breakfast', oneDishMain: false },
      { date: riceDay, slot: 'lunch', oneDishMain: false },
      { date: riceDay, slot: 'dinner', oneDishMain: false },
    ]),
    3,
  )
  eq(
    'EN-RICE 夕食だけの日は1杯',
    riceCount([{ date: riceDay, slot: 'dinner', oneDishMain: false }]),
    1,
  )
  eq(
    'EN-RICE 一品もの(丼・麺・カレー・鍋)が主菜の食事には足さない',
    riceCount([
      { date: riceDay, slot: 'lunch', oneDishMain: true },
      { date: riceDay, slot: 'dinner', oneDishMain: false },
    ]),
    1,
  )
  eq(
    'EN-RICE 全部の食事が一品ものなら0杯',
    riceCount([
      { date: riceDay, slot: 'lunch', oneDishMain: true },
      { date: riceDay, slot: 'dinner', oneDishMain: true },
    ]),
    0,
  )
  eq('EN-RICE 献立が無い日は数えない', riceServingsByDate(riceSlotKeysOf([])).size, 0)
  eq(
    'EN-RICE 同じ食事に主菜と副菜が並んでも1食は1杯(食事ごとに1回だけ数える)',
    riceCount([
      { date: riceDay, slot: 'dinner', oneDishMain: false },
      { date: riceDay, slot: 'dinner', oneDishMain: false },
    ]),
    1,
  )
  eq(
    'EN-RICE 日付ごとに数える(別の日の食事は混ざらない)',
    riceServingsByDate(
      riceSlotKeysOf([
        { date: riceDay, slot: 'dinner', oneDishMain: false },
        { date: '2026-08-10', slot: 'lunch', oneDishMain: false },
        { date: '2026-08-10', slot: 'dinner', oneDishMain: false },
      ]),
    ).get('2026-08-10'),
    2,
  )

  // (4) 計算対象外が混ざる日の作法(docs/60 §5)。1品でもあれば「目安との並置」を出さない
  const unknownOnly = one('クヌルプ', '100', 'g') // 1品も計算できない
  const partial = {
    servings: 1,
    ingredients: [
      { name: 'キャベツ', amount: '100', unit: 'g' },
      { name: 'クヌルプ', amount: '100', unit: 'g' }, // 量は書いてあるのに計算できない
    ],
  }
  const seasoningOnly = {
    servings: 1,
    ingredients: [
      { name: 'キャベツ', amount: '100', unit: 'g' },
      { name: 'こしょう', amount: '少々', unit: '' }, // 「少々」だけの除外は警告扱いにしない
    ],
  }
  const cleanSum = sumBalance([cabbage, carrot])
  eq('CL-MIX 全部計算できた日は目安を並置できる', canCompareDay(cleanSum.nutrition), true)
  eq('CL-MIX 1品も無い日は並置しない', canCompareDay(sumBalance([]).nutrition), false)
  const excludedSum = sumBalance([cabbage, unknownOnly])
  eq('CL-MIX 1品も計算できない料理を数える', excludedSum.nutrition.excludedDishCount, 1)
  eq('CL-MIX 計算できない料理が混ざる日は並置しない', canCompareDay(excludedSum.nutrition), false)
  eq(
    'CL-MIX 計算できない料理があっても計算できた分の野菜量は出す',
    Math.round(excludedSum.vegetableG),
    100,
  )
  const partialSum = sumBalance([cabbage, partial])
  eq('CL-MIX 一部の材料が計算できない料理を数える', partialSum.nutrition.partialDishCount, 1)
  eq('CL-MIX 一部だけ計算できない日も並置しない', canCompareDay(partialSum.nutrition), false)
  const seasoningSum = sumBalance([seasoningOnly])
  eq(
    'CL-MIX 「少々」だけが外れている日は並置を止めない(誤警告を増やさない)',
    canCompareDay(seasoningSum.nutrition),
    true,
  )

  // (5) 期間(週・月)は2割で切る(docs/60 §5-4・§7 未決#8=(a))
  eq('CL-MIX 期間の打ち切り割合は2割', RANGE_EXCLUDED_RATIO_LIMIT, 0.2)
  eq(
    'CL-MIX 期間は5品中1品(2割ちょうど)なら並置する',
    canCompareRange(sumBalance([cabbage, cabbage, cabbage, cabbage, unknownOnly]).nutrition),
    true,
  )
  eq(
    'CL-MIX 期間は4品中1品(2割超)なら並置しない',
    canCompareRange(sumBalance([cabbage, cabbage, cabbage, unknownOnly]).nutrition),
    false,
  )
  eq(
    'CL-MIX 期間は一部だけ計算できない品があっても並置する(件数を明示して出す)',
    canCompareRange(sumBalance([cabbage, partial]).nutrition),
    true,
  )
  eq('CL-MIX 1品も無い期間は並置しない', canCompareRange(sumBalance([]).nutrition), false)

  // (6) 目安の定数: 値と出典が必ず対で入っていること(出典なしの数値をコードに入れさせない)
  eq('CL-GUIDE 食塩相当量の目安(男性)', DAILY_GUIDES.saltG.male, 7.5)
  eq('CL-GUIDE 食塩相当量の目安(女性)', DAILY_GUIDES.saltG.female, 6.5)
  eq('CL-GUIDE 野菜の目安', DAILY_GUIDES.vegetableG.perDayG, 350)
  for (const [key, guide] of Object.entries(DAILY_GUIDES)) {
    eq(`CL-GUIDE ${key}に出典名がある`, typeof guide.source === 'string' && guide.source.length > 0, true)
    eq(
      `CL-GUIDE ${key}に出典URLがある`,
      typeof guide.sourceUrl === 'string' && guide.sourceUrl.startsWith('https://'),
      true,
    )
  }
  // 目安は1日ぶん×日数に伸ばす(週まとめ。7日固定では掛けない)
  eq('CL-GUIDE 3日ぶんの塩分目安(男性)', guideForDays(DAILY_GUIDES.saltG.male, 3), 22.5)
  eq('CL-GUIDE 3日ぶんの野菜目安', guideForDays(DAILY_GUIDES.vegetableG.perDayG, 3), 1050)
}

// ---------- 目的モード: 引き直し方式・目的の軸・答え合わせ(2026-08-02 便CP-2・docs/62 決定② / docs/60 第2段) ----------
{
  // --- (1) chooseBalancedPair: 引き直しの規則(エンジン本体は無改造。この関数だけが選び直す) ---
  // ペアは「主菜・副菜」の器だけ見ればよいので、テストからは素の物体を渡す
  const dish = (title, tags = []) => ({ title, tags })
  const curry = dish('カレーライス') // ONE_DISH_TITLE_WORDS でも一品もの判定になる
  const donburi = dish('親子丼', ['ご飯もの'])
  // penalty はペアに載せた score をそのまま返す(引き直しの規則だけを検査するため)
  const scored = (main, side, score) => ({ main, side, score })
  const scoreOf = (pair) => (pair.score == null ? 999 : pair.score)
  const drawsOf = (list) => {
    let i = 0
    const calls = []
    const draw = () => {
      const next = list[Math.min(i, list.length - 1)]
      i++
      calls.push(next)
      return next
    }
    return { draw, count: () => i, calls }
  }

  eq('CP2-K k=3が引き直しの既定回数(docs/60 §3-2-3)', PURPOSE_REDRAW_ATTEMPTS, 3)

  {
    // k=1 は1回目をそのまま返す = 現行と完全に等価(いつでも無効化できる)
    const d = drawsOf([scored(dish('A'), dish('a'), 5), scored(dish('B'), dish('b'), 1)])
    const picked = chooseBalancedPair(d.draw, scoreOf, 1)
    eq('CP2-K k=1は1回目をそのまま返す', picked.main.title, 'A')
    eq('CP2-K k=1は1回しか引かない', d.count(), 1)
  }
  {
    // k回引いて penalty 最小を返す
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(dish('B'), dish('b'), 2),
      scored(dish('C'), dish('c'), 3),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K k回引いて最小のペアを採る', picked.main.title, 'B')
    eq('CP2-K k回きっちり引く', d.count(), 3)
  }
  {
    // penalty<=0(理想)が出たらそこで打ち切る
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(dish('B'), dish('b'), 0),
      scored(dish('C'), dish('c'), -1),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K ペナルティ0で打ち切る', picked.main.title, 'B')
    eq('CP2-K 打ち切ったら3回目は引かない', d.count(), 2)
  }
  {
    // 1回目のペナルティが最初から0なら1回で終わる
    const d = drawsOf([scored(dish('A'), dish('a'), 0), scored(dish('B'), dish('b'), -5)])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 1回目が理想なら引き直さない', picked.main.title, 'A')
    eq('CP2-K 1回目が理想なら1回しか引かない', d.count(), 1)
  }
  {
    // 一品ものガード①: 1回目が一品ものなら引き直さない(カレー・丼の日を締め出さない)
    const d = drawsOf([scored(curry, undefined, 9), scored(dish('B'), dish('b'), 1)])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 1回目が一品ものならそのまま採る', picked.main.title, 'カレーライス')
    eq('CP2-K 1回目が一品ものなら引き直さない', d.count(), 1)
  }
  {
    // 一品ものガード②: 2回目以降に出た一品ものは(どんなに軸に沿っても)捨てる
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(donburi, undefined, -100),
      scored(dish('C'), dish('c'), 4),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 2回目以降の一品ものは捨てる', picked.main.title, 'C')
  }
  {
    // 構成ガード①: 主菜が引けなかった枠は引き直さない(候補0件は引き直しても同じ)
    const d = drawsOf([scored(undefined, dish('a'), 5), scored(dish('B'), dish('b'), 1)])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 主菜が無い1回目はそのまま返す', picked.side.title, 'a')
    eq('CP2-K 主菜が無い1回目では引き直さない', d.count(), 1)
  }
  {
    // 構成ガード②: 2回目以降の「主菜なし」は候補にしない
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(undefined, undefined, -100),
      scored(dish('C'), dish('c'), 4),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 2回目以降の主菜なしは候補にしない', picked.main.title, 'C')
  }
  {
    // 構成ガード③: 副菜を削って軸を稼がない(「塩分をひかえめに」で品数の少ないペアが勝つのを防ぐ)
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(dish('B'), undefined, -100),
      scored(dish('C'), dish('c'), 4),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 1回目に副菜があるなら副菜なしのペアは採らない', picked.main.title, 'C')
  }
  {
    // 全部の引き直しが捨てられたら1回目を返す(0件回避=提案が消えない)
    const d = drawsOf([
      scored(dish('A'), dish('a'), 5),
      scored(curry, undefined, -100),
      scored(donburi, undefined, -100),
    ])
    const picked = chooseBalancedPair(d.draw, scoreOf, 3)
    eq('CP2-K 引き直しが全部捨てられたら1回目を採る', picked.main.title, 'A')
  }

  // --- (2) 目的の軸: 何を比べているか(目安からの距離ではなく、候補どうしの比較) ---
  const totals = (proteinG, saltG) => ({ proteinG, saltG })
  eq('CP2-AXIS たんぱく質軸の項目は proteinG', PURPOSE_NUTRIENT_KEY.protein, 'proteinG')
  eq('CP2-AXIS 塩分軸の項目は saltG', PURPOSE_NUTRIENT_KEY.lowSalt, 'saltG')

  // --- (2b) 便DT-9(2026-08-07 オーナー指示): 目的の軸を8つへ拡張した ---
  // 多め=たんぱく質・食物繊維・鉄・カルシウム / ひかえめ=エネルギー・脂質・炭水化物・塩分。
  // 見る項目はすべて既存の NutrientTotals のキーで、新しい栄養計算は足していない。
  eq('DT9-AXIS 目的は8つ', MEAL_PURPOSES.length, 8)
  eq('DT9-AXIS 並びは「多め」4つ→「ひかえめ」4つ', MEAL_PURPOSES, [
    'protein', 'fiber', 'iron', 'calcium', 'lowEnergy', 'lowFat', 'lowCarb', 'lowSalt',
  ])
  eq('DT9-AXIS 多めの目的は4つ', [...MORE_MEAL_PURPOSES], ['protein', 'fiber', 'iron', 'calcium'])
  eq('DT9-AXIS ひかえめの目的は4つ', [...LESS_MEAL_PURPOSES], ['lowEnergy', 'lowFat', 'lowCarb', 'lowSalt'])
  eq('DT9-AXIS 「多め」と「ひかえめ」は重ならず、8つで全目的を覆う', new Set([...MORE_MEAL_PURPOSES, ...LESS_MEAL_PURPOSES]).size, 8)
  // 軸→栄養項目の対応（表示の項目名・単位もこの対応から引くので、ずれると画面の単位が嘘になる）
  eq('DT9-AXIS 食物繊維軸は fiberG', PURPOSE_NUTRIENT_KEY.fiber, 'fiberG')
  eq('DT9-AXIS 鉄軸は ironMg', PURPOSE_NUTRIENT_KEY.iron, 'ironMg')
  eq('DT9-AXIS カルシウム軸は calciumMg', PURPOSE_NUTRIENT_KEY.calcium, 'calciumMg')
  eq('DT9-AXIS エネルギー軸は kcal', PURPOSE_NUTRIENT_KEY.lowEnergy, 'kcal')
  eq('DT9-AXIS 脂質軸は fatG', PURPOSE_NUTRIENT_KEY.lowFat, 'fatG')
  eq('DT9-AXIS 炭水化物軸は carbG', PURPOSE_NUTRIENT_KEY.lowCarb, 'carbG')
  eq(
    'DT9-AXIS すべての目的に栄養項目が対応している(足し忘れが無い)',
    MEAL_PURPOSES.every((p) => typeof PURPOSE_NUTRIENT_KEY[p] === 'string'),
    true,
  )
  eq(
    'DT9-AXIS 多め/ひかえめの向きは isMorePurpose が唯一の正',
    MEAL_PURPOSES.map((p) => isMorePurpose(p)),
    [true, true, true, true, false, false, false, false],
  )
  {
    // 軸の値は主菜+副菜の1人分の合計（どの軸でも数え方は同じ）
    const full = (over) => ({
      kcal: 0, proteinG: 0, fatG: 0, carbG: 0, saltG: 0, fiberG: 0, ironMg: 0, calciumMg: 0, ...over,
    })
    eq('DT9-AXIS 食物繊維の軸も合計', purposeAxisValue('fiber', [full({ fiberG: 3.2 }), full({ fiberG: 1.8 })]), 5)
    eq('DT9-AXIS 鉄の軸も合計', purposeAxisValue('iron', [full({ ironMg: 1.5 }), full({ ironMg: 0.5 })]), 2)
    eq('DT9-AXIS エネルギーの軸も合計', purposeAxisValue('lowEnergy', [full({ kcal: 300 }), full({ kcal: 120 })]), 420)
    // 「多め」の4軸: 多いほどペナルティが小さい・必ず正(打ち切り点を作らない)
    for (const [purpose, key] of [
      ['protein', 'proteinG'], ['fiber', 'fiberG'], ['iron', 'ironMg'], ['calcium', 'calciumMg'],
    ]) {
      eq(
        `DT9-AXIS ${purpose}: 多いほうがペナルティが小さい`,
        purposePenalty(purpose, [full({ [key]: 30 })]) < purposePenalty(purpose, [full({ [key]: 10 })]),
        true,
      )
      eq(
        `DT9-AXIS ${purpose}: ペナルティは必ず正(満たすべき線を作らない)`,
        purposePenalty(purpose, [full({ [key]: 9999 })]) > 0,
        true,
      )
    }
    // 「ひかえめ」の4軸: 少ないほどペナルティが小さい・0のときだけ打ち切る
    for (const [purpose, key] of [
      ['lowEnergy', 'kcal'], ['lowFat', 'fatG'], ['lowCarb', 'carbG'], ['lowSalt', 'saltG'],
    ]) {
      eq(
        `DT9-AXIS ${purpose}: 少ないほうがペナルティが小さい`,
        purposePenalty(purpose, [full({ [key]: 10 })]) < purposePenalty(purpose, [full({ [key]: 30 })]),
        true,
      )
      eq(`DT9-AXIS ${purpose}: ペナルティは軸の値そのもの`, purposePenalty(purpose, [full({ [key]: 12.5 })]), 12.5)
      eq(`DT9-AXIS ${purpose}: 0だけが打ち切り点`, purposePenalty(purpose, [full({ [key]: 0 })]), 0)
    }
    // 既存の2軸(protein/lowSalt)の値は1ミリも変わっていない＝保存済みの目的の挙動は不変
    eq('DT9-AXIS 既存のたんぱく質軸の式は不変', purposePenalty('protein', [full({ proteinG: 24 })]), 1 / 25)
    eq('DT9-AXIS 既存の塩分軸の式は不変', purposePenalty('lowSalt', [full({ saltG: 2.5 })]), 2.5)
    // 項目が欠けた物体を渡しても NaN にしない(0として数える)
    eq('DT9-AXIS 項目が無ければ0として数える(NaNにしない)', purposeAxisValue('iron', [{}, { ironMg: 2 }]), 2)
  }
  eq(
    'CP2-AXIS 軸の値は主菜+副菜の1人分の合計',
    purposeAxisValue('protein', [totals(20, 1), totals(5, 0.5)]),
    25,
  )
  eq('CP2-AXIS 塩分の軸も合計', purposeAxisValue('lowSalt', [totals(20, 1), totals(5, 0.5)]), 1.5)
  eq('CP2-AXIS 品が無ければ0', purposeAxisValue('lowSalt', []), 0)
  eq(
    'CP2-AXIS たんぱく質は多いほうがペナルティが小さい',
    purposePenalty('protein', [totals(30, 2)]) < purposePenalty('protein', [totals(10, 2)]),
    true,
  )
  eq(
    'CP2-AXIS たんぱく質のペナルティは必ず正(満たすべき線を作らない=打ち切り点が無い)',
    purposePenalty('protein', [totals(999, 0)]) > 0,
    true,
  )
  eq(
    'CP2-AXIS 塩分は少ないほうがペナルティが小さい',
    purposePenalty('lowSalt', [totals(10, 1.2)]) < purposePenalty('lowSalt', [totals(10, 3.4)]),
    true,
  )
  eq('CP2-AXIS 塩分のペナルティは塩分そのもの', purposePenalty('lowSalt', [totals(10, 2.5)]), 2.5)
  eq('CP2-AXIS 塩分0gだけが打ち切り点', purposePenalty('lowSalt', [totals(10, 0)]), 0)

  // --- (3) 答え合わせ: 日数と1日あたりの数字だけ(達成/未達の判定はしない) ---
  const dayOf = (date, proteinG, saltG, dishCount = 1) => ({
    date,
    basis: 'plan',
    balance: {
      nutrition: {
        total: { kcal: 0, proteinG, fatG: 0, carbG: 0, saltG, fiberG: 0, ironMg: 0, calciumMg: 0 },
        dishCount,
        excludedDishCount: 0,
        partialDishCount: 0,
      },
      vegetableG: 0,
    },
    comparable: true,
  })
  {
    const days = [
      dayOf('2026-08-03', 70, 3),
      dayOf('2026-08-04', 60, 3),
      dayOf('2026-08-05', 40, 3),
      dayOf('2026-08-06', 20, 3),
    ]
    const purposeByDate = new Map([
      ['2026-08-03', 'protein'],
      ['2026-08-04', 'protein'],
    ])
    const review = reviewPurposeDays(days, purposeByDate)
    eq('CP2-REV 目的の指定が無い軸は出さない', review.length, 1)
    eq('CP2-REV 目的から組んだ日数', review[0].days, 2)
    eq('CP2-REV 分母は数字が出た日数', review[0].totalDays, 4)
    eq('CP2-REV 目的から組んだ日の1日あたり', review[0].averageWith, 65)
    eq('CP2-REV ほかの日の1日あたり', review[0].averageWithout, 30)
  }
  {
    // 1品も計算できなかった日(dishCount=0)は、日数にも平均にも入れない(0gの日で平均を薄めない)
    const days = [dayOf('2026-08-03', 70, 3), dayOf('2026-08-04', 0, 0, 0)]
    const review = reviewPurposeDays(
      days,
      new Map([
        ['2026-08-03', 'protein'],
        ['2026-08-04', 'protein'],
      ]),
    )
    eq('CP2-REV 計算できなかった日は数えない', review[0].days, 1)
    eq('CP2-REV 計算できなかった日は分母にも入れない', review[0].totalDays, 1)
    eq('CP2-REV ほかの日が無ければ並置しない', review[0].averageWithout, null)
  }
  {
    // 目的を一度も指定していない期間には何も出さない(節ごと出さない)
    eq('CP2-REV 目的の記録が無ければ空', reviewPurposeDays([dayOf('2026-08-03', 70, 3)], new Map()), [])
  }
  {
    // 2つの目的が混ざった月は、目的ごとに1件ずつ出す(並びは MEAL_PURPOSES の順)
    const days = [dayOf('2026-08-03', 70, 4), dayOf('2026-08-04', 30, 1), dayOf('2026-08-05', 50, 2)]
    const review = reviewPurposeDays(
      days,
      new Map([
        ['2026-08-03', 'protein'],
        ['2026-08-04', 'lowSalt'],
      ]),
    )
    eq('CP2-REV 目的ごとに1件ずつ', review.map((r) => r.purpose), ['protein', 'lowSalt'])
    eq('CP2-REV 塩分軸は塩分の数字を見る', review[1].averageWith, 1)
    eq('CP2-REV 塩分軸の「ほかの日」は残り2日の平均', review[1].averageWithout, 3)
  }
}

// ---------- 恒常のお試し2種: 端末内カウント(2026-08-02 便CP-2・docs/62 決定③) ----------
{
  eq('CP2-TRIAL 並行調理ナビのお試しは3回', COOK_NAVI_TRIAL_LIMIT, 3)
  eq('CP2-TRIAL 月間献立のお試しは1回', MONTH_TRIAL_LIMIT, 1)
  // 未設定(この項目導入前の既存ユーザーを含む)は0回使用として扱う
  eq('CP2-TRIAL 未設定なら残り3回', cookNaviTrialRemaining(undefined), 3)
  eq('CP2-TRIAL 1回使ったら残り2回', cookNaviTrialRemaining(1), 2)
  eq('CP2-TRIAL 3回使ったら残り0回', cookNaviTrialRemaining(3), 0)
  eq('CP2-TRIAL 記録が上限を超えていても負にしない', cookNaviTrialRemaining(9), 0)
  eq('CP2-TRIAL 壊れた値(NaN)は0回使用として扱う', cookNaviTrialRemaining(NaN), 3)
  eq('CP2-TRIAL 負の値も0回使用として扱う', cookNaviTrialRemaining(-2), 3)
  eq('CP2-TRIAL 未設定なら使える', canUseCookNaviTrial(undefined), true)
  eq('CP2-TRIAL 2回目までは使える', canUseCookNaviTrial(2), true)
  eq('CP2-TRIAL 3回使ったら使えない', canUseCookNaviTrial(3), false)
  eq('CP2-TRIAL 3回使ったら「終了」表示', isCookNaviTrialExhausted(3), true)
  eq('CP2-TRIAL 途中は「終了」表示にしない', isCookNaviTrialExhausted(2), false)
  // 消費: 上限を超えて増やさない(何度押しても3で止まる)
  eq('CP2-TRIAL 未設定から1回使う', consumeCookNaviTrial(undefined), 1)
  eq('CP2-TRIAL 2→3', consumeCookNaviTrial(2), 3)
  eq('CP2-TRIAL 上限を超えて増やさない', consumeCookNaviTrial(3), 3)
  // 月間献立は1回だけのフラグ
  eq('CP2-TRIAL 月間は未設定ならまだ使える', canUseMonthTrial(undefined), true)
  eq('CP2-TRIAL 月間はfalseでもまだ使える', canUseMonthTrial(false), true)
  eq('CP2-TRIAL 月間は1回使ったら使えない', canUseMonthTrial(true), false)
  // 2026-08-02 オーナー指摘: 「作った記録」が少ないうちは、1回きりのお試しを使っても
  // ほぼ空のカレンダーしか見えない。5件たまるまでは入口を出さない(時期をずらすだけ)
  eq('月間お試し: 記録の件数のしきい値は5件', MONTH_TRIAL_MIN_COOKED, 5)
  eq('月間お試し: 記録0件では出さない', isMonthTrialReady(0), false)
  eq('月間お試し: 記録4件でもまだ出さない', isMonthTrialReady(4), false)
  eq('月間お試し: 記録5件で出す', isMonthTrialReady(5), true)
  eq('月間お試し: 記録が多ければもちろん出す', isMonthTrialReady(40), true)
  eq('月間お試し: 未定義は0件として扱う(落ちない)', isMonthTrialReady(undefined), false)

  // 栄養8項目のお試し(2026-08-08 便DZ・オーナー決定)。月間献立と同じ「1回だけ」の作法。
  // 使い切ったあとは入口を出さず「ご利用済みです」に差し替える(表示側の判定はこの関数で決める)
  eq('DZ-TRIAL 栄養8項目のお試しは1回', NUTRITION_TRIAL_LIMIT, 1)
  eq('DZ-TRIAL 未設定ならまだ使える', canUseNutritionTrial(undefined), true)
  eq('DZ-TRIAL falseでもまだ使える', canUseNutritionTrial(false), true)
  eq('DZ-TRIAL 1回使ったら使えない', canUseNutritionTrial(true), false)
  eq('DZ-TRIAL 未設定は「ご利用済み」にしない', isNutritionTrialExhausted(undefined), false)
  eq('DZ-TRIAL 1回使ったら「ご利用済み」', isNutritionTrialExhausted(true), true)
}

// ---------- 便FD(2026-08-10 オーナー実機フィードバック)の再発防止 ----------
{
  // (1) その日の合計に足したごはんの杯数（DayBalance.riceServings）。
  //     オーナー「合計何杯分のご飯が計算に入るか入れて」に対して画面へ出す数字なので、
  //     **合計の中身と必ず一致すること**をここで固定する（数え直しの実装に戻さないための見張り）。
  const fdRice = (date) => ({ date, recipe: RICE_SERVING_RECIPE, matchKey: 'rice' })
  const fdDish = (date, key) => ({
    date,
    recipe: { servings: 1, ingredients: [{ name: '鶏もも肉', amount: '100', unit: 'g' }] },
    matchKey: key,
  })
  const fdKcalOfRice = Math.round(sumBalance(riceServingRecipes(1)).nutrition.total.kcal)

  // 先の日（登録した献立で数える）: 2食ぶんのごはん＝2杯
  const fdPlanDay = dayBalanceMap({
    dates: ['2026-08-20'],
    today: '2026-08-10',
    cooked: [],
    planned: [fdRice('2026-08-20'), fdRice('2026-08-20')],
  }).get('2026-08-20')
  eq('FD-RICE 先の日は献立ぶんの杯数を返す', fdPlanDay.riceServings, 2)
  eq(
    'FD-RICE 出す杯数と合計の中身が一致する（合計のエネルギー＝1杯ぶん×杯数）',
    Math.round(fdPlanDay.balance.nutrition.total.kcal),
    fdKcalOfRice * 2,
  )

  // 過ぎた日（作った記録で数える）
  const fdActualDay = dayBalanceMap({
    dates: ['2026-08-01'],
    today: '2026-08-10',
    cooked: [fdRice('2026-08-01')],
    planned: [fdRice('2026-08-01'), fdRice('2026-08-01')],
  }).get('2026-08-01')
  eq('FD-RICE 過ぎた日は記録ぶんだけ数える（献立ぶんは足さない）', fdActualDay.riceServings, 1)

  // 今日（記録と献立が同居する日）: 二重計上を落としたあとの杯数になる
  const fdTodayDay = dayBalanceMap({
    dates: ['2026-08-10'],
    today: '2026-08-10',
    cooked: [fdRice('2026-08-10')],
    planned: [fdRice('2026-08-10'), fdRice('2026-08-10')],
  }).get('2026-08-10')
  eq('FD-RICE 今日は二重計上を落としたあとの杯数（記録1＋残った献立1＝2）', fdTodayDay.riceServings, 2)
  eq(
    'FD-RICE 今日も出す杯数と合計の中身が一致する',
    Math.round(fdTodayDay.balance.nutrition.total.kcal),
    fdKcalOfRice * 2,
  )

  // ごはんを含めない日（チェックOFF）は0杯＝注釈そのものを出さない
  const fdNoRice = dayBalanceMap({
    dates: ['2026-08-20'],
    today: '2026-08-10',
    cooked: [],
    planned: [fdDish('2026-08-20', 'r:1')],
  }).get('2026-08-20')
  eq('FD-RICE ごはんを足していない日は0杯', fdNoRice.riceServings, 0)

  // 週まとめは日ごとの杯数の合計
  eq(
    'FD-RICE 週まとめの杯数は日ごとの合計',
    summarizeWeekBalance([fdPlanDay, fdActualDay, fdTodayDay]).riceServings,
    5,
  )

  // (2) 「レシピを見る」から同じ画面へ帰るための覚え書き（月タブは日の窓も開き直す）
  eq(
    'FD-NAV 開いていた日の窓の日付も覚えて読み戻せる',
    parseViewReturn(
      serializeViewReturn({ anchor: '2026-08-01', scrollY: 320, openDate: '2026-08-10' }),
    ),
    { anchor: '2026-08-01', scrollY: 320, openDate: '2026-08-10' },
  )
  eq(
    'FD-NAV 窓を開いていなければ覚えない（以前の版と同じ形のまま）',
    parseViewReturn(serializeViewReturn({ anchor: '2026-08-01', scrollY: 320 })),
    { anchor: '2026-08-01', scrollY: 320 },
  )
  eq(
    'FD-NAV 日付の形でない目印は捨てる（窓は開き直さない）',
    parseViewReturn('{"anchor":"","scrollY":10,"openDate":"きのう"}'),
    { anchor: '', scrollY: 10 },
  )
}

// ---------- JP-2: 栄養を計算できなかった料理を「どれか」まで返す ----------
//
// オーナー原文: 「② 計算できない料理が表示されるようになりましたが、どれが計算できなかったのか
//   わかりません。折りたたみ開いたらレシピ名（カードでなく文字だけ。そのままリンクになっている）
//   出して欲しいです。」
//
// 画面はいままで**件数しか受け取っていなかった**（PersonalNutritionSum は数だけを返していた）。
// 数え方はそのままに、**その品のレシピIDと料理名**を一緒に返す＝画面が名前を出せるようにする。
// 何品と数えるか（excludedDishCount / partialDishCount）は1文字も変えない。
{
  const jpNut = await import('../../src/logic/nutrition.ts')
  eq(
    'JP-2 計算できなかった料理の一覧を作る道具がある（無ければ以下は測れていない）',
    typeof jpNut.gapDishList,
    'function',
  )
  const jpIng = (name, amount, unit) => ({ name, amount, unit })
  // 全部計算できる品／量が書いてあるのに落ちる材料がある品／1品も計算できない品
  const jpOk = { id: 1, title: 'ごはんだけ', servings: 1, ingredients: [jpIng('米', '150', 'g')] }
  const jpPartial = {
    id: 2,
    title: '一部が落ちる品',
    servings: 1,
    ingredients: [jpIng('米', '150', 'g'), jpIng('うちレシピ架空調味料', '100', 'g')],
  }
  const jpExcluded = {
    id: 3,
    title: '1品も計算できない品',
    servings: 1,
    ingredients: [jpIng('うちレシピ架空調味料', '100', 'g')],
  }
  const jpSum = jpNut.sumPersonalNutrition([jpOk, jpPartial, jpExcluded])
  eq('JP-2 数え方は変えていない（合計に入れた品数）', jpSum.dishCount, 2)
  eq('JP-2 数え方は変えていない（1品も計算できない品数）', jpSum.excludedDishCount, 1)
  eq('JP-2 数え方は変えていない（一部が落ちた品数）', jpSum.partialDishCount, 1)
  eq(
    'JP-2 計算できなかった品を、レシピIDと料理名で返す',
    (jpSum.gapDishes ?? []).map((d) => `${d.kind}:${d.id}:${d.title}`),
    ['partial:2:一部が落ちる品', 'excluded:3:1品も計算できない品'],
  )
  eq(
    'JP-2 ぜんぶ計算できた品は一覧に入れない',
    (jpSum.gapDishes ?? []).some((d) => d.id === 1),
    false,
  )
  // 期間の合計は日ごとの合計を足して作る＝同じ料理が何日も出る。名前は1回だけ出す
  const jpMerged = jpNut.addPersonalNutritionSum(
    jpNut.sumPersonalNutrition([jpPartial, jpExcluded]),
    jpNut.sumPersonalNutrition([jpPartial]),
  )
  eq('JP-2 足しても件数は延べで数える（2日ぶんの「一部が落ちた品」は2品）', jpMerged.partialDishCount, 2)
  if (typeof jpNut.gapDishList === 'function') {
    eq(
      'JP-2 同じ料理が何日も出ても、名前の一覧では1回だけにする',
      jpNut.gapDishList(jpMerged).map((d) => d.title),
      ['一部が落ちる品', '1品も計算できない品'],
    )
    eq(
      'JP-2 一覧は「1品も計算できない品」と「一部が落ちた品」を分けて取り出せる',
      [
        jpNut.gapDishList(jpMerged, 'excluded').map((d) => d.title),
        jpNut.gapDishList(jpMerged, 'partial').map((d) => d.title),
      ],
      [['1品も計算できない品'], ['一部が落ちる品']],
    )
    // ごはん（便CW-10で足す1杯）はレシピIDを持たない擬似レシピ。名前もリンク先も無いので一覧に入れない
    const jpBalance = await import('../../src/logic/nutritionBalance.ts')
    const jpRice = jpNut.sumPersonalNutrition([jpBalance.RICE_SERVING_RECIPE])
    eq(
      'JP-2 レシピIDを持たない品（足したごはん）は名前の一覧に入れない',
      jpNut.gapDishList(jpRice).length,
      0,
    )
  }
}

// ---------- 便KP: 成分表に食品そのものが無くて落ちていた材料／価格マスタに無い材料 ----------
// 影響範囲テストA・B・Cの実データ90品(2026-08-23)で、**成分表に食品が無くて丸ごと落ちていた材料**を
// 全部洗い出した結果を見張る。直す前はここに並べた値がすべて赤になることを確認してから直している。
//   ・レンジで簡単！鶏むね肉と豆苗のレンジ蒸し … 『豆苗 1袋』が成分表に無く**1品まるごと野菜量0g**。
//     価格マスタには「豆苗 100円/1パック」があるのに、成分表に無いせいで原価も按分できず1食124円
//   ・切って混ぜるだけ♪さばマヨ水菜サラダ … 『さばのみそ煮缶 1缶』が落ちて1人分92kcal・
//     たんぱく質1.3g。しかも原価側は前方一致で「さば 100円/1切れ」(生の切り身)に当たっていた
//   ・豚肉とキャベツの蒸ししゃぶ … 『豚バラしゃぶしゃぶ用肉 150g』が書き方ちがいで落ち、1人分68kcal
//   ・簡単！節約！もやし入り豚キムチ … 『キムチ 200g』が落ちて**1人分の食塩相当量が1.3g**
//     （キムチは100gあたり2.9gの塩分を持つ主役級。落ちると「塩分が少ない品」という逆の読みになる）
//   ・基本のきんぴらごぼう ほか6品 … 合わせ調味料の印が付いた『◎酒』『★酒』『〇酒』『a. 酒』が、
//     酒そのものは成分表にあるのに頭の印だけで落ちていた（原価側は既に印を落としていた＝食い違い）
// 成分値は1つも手で書かず、すべて公式Excelから機械抽出したまま（scripts/build-nutrition.mjs）。
// **八訂に実収載が無いもの（塩麹・つけてみそかけてみそ・ウェイパー等）は足さず、
//   「分からない」と出したままにしてある**＝KP-6でそれも見張る。
{
  const kpIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const { matchNutritionFood: kpFood, computeRecipeNutrition: kpNut } = await import(
    '../../src/logic/nutrition.ts'
  )
  const kpYen = (name, amount, unit) =>
    estimateIngredientYen({ name, amount, unit }, kpIndex)?.yen ?? null
  const kpGramsOf = (value, unit, name) => convertToGrams(value, unit, kpFood(name) ?? {})
  const kpId = (name) => kpFood(name)?.id ?? null
  const kpSalt = (name) => kpFood(name)?.per100g.saltG ?? null

  // --- KP-1: 実データで落ちていた食品を、八訂の実収載に当てる（番号は公式Excelで照合済み） ---
  eq('KP-1 豆苗は06329「トウミョウ 芽ばえ」', kpId('豆苗'), '06329')
  eq('KP-1 豆苗の「1パック」は根を落とした可食部100g', kpGramsOf(1, 'パック', '豆苗'), 100)
  eq('KP-1 「1袋」も同じ（同じものの言い方ちがい）', kpGramsOf(1, '袋', '豆苗'), kpGramsOf(1, 'パック', '豆苗'))
  // 司令部の指示は「10164のみそ煮版」だったが、10164は**水煮**でみそ煮は10165（公式Excelで確認）
  eq('KP-1 さばのみそ煮缶は10165（10164は水煮なので別）', kpId('さばのみそ煮缶'), '10165')
  eq('KP-1 水煮の缶は今までどおり10164のまま', kpId('さば水煮缶'), '10164')
  eq('KP-1 みそ煮は水煮より食塩相当量が多い', [kpSalt('さばのみそ煮缶'), kpSalt('さば水煮缶')], [1.1, 0.9])
  eq('KP-1 みそ煮缶の「1缶」は水煮缶と同じ190g', kpGramsOf(1, '缶', 'さばのみそ煮缶'), kpGramsOf(1, '缶', 'さば水煮缶'))
  eq('KP-1 米油は14003「米ぬか油」', kpId('米油'), '14003')
  eq('KP-1 「こめ油」でも同じ食品', kpId('こめ油'), '14003')
  eq('KP-1 キムチは06236「はくさい 漬物 キムチ」', kpId('キムチ'), '06236')
  eq('KP-1 キムチの食塩相当量は八訂の値そのまま（2.9g/100g）', kpSalt('キムチ'), 2.9)
  eq('KP-1 菜の花は06201「和種なばな」', kpId('菜の花'), '06201')
  eq('KP-1 サラダ菜は06313', kpId('サラダ菜'), '06313')
  eq('KP-1 グリーンリーフは06314「リーフレタス」', kpId('グリーンリーフ'), '06314')
  eq('KP-1 香菜は06385「コリアンダー 葉」', [kpId('香菜'), kpId('パクチー')], ['06385', '06385'])
  eq('KP-1 三温糖は03004（上白糖03003とは別）', [kpId('三温糖'), kpId('砂糖')], ['03004', '03003'])
  eq('KP-1 三温糖の大さじは上白糖と同じ重さ', kpGramsOf(1, '大さじ', '三温糖'), kpGramsOf(1, '大さじ', '砂糖'))
  eq('KP-1 練りからしは17058「からし 練り」', kpId('練りからし'), '17058')
  eq('KP-1 練りからしの食塩相当量は7.4g/100g', kpSalt('練りからし'), 7.4)
  eq('KP-1 粒マスタードは17060「粒入りマスタード」', kpId('粒マスタード'), '17060')

  // --- KP-2: 足したことで新しい取り違えを作っていないこと ---
  eq('KP-2 「からし菜」は練りからしに寄らない（野菜と調味料を取り違えない）', kpFood('からし菜'), null)
  eq('KP-2 「キムチの素」はキムチと別の食品（塩分が3倍以上ちがう）', [kpId('キムチの素'), kpSalt('キムチの素')], ['17136', 9.3])
  eq('KP-2 素の「コリアンダー」は香菜に寄らない（香辛料の粉は八訂に無いので分からないまま）', kpFood('コリアンダー'), null)
  eq('KP-2 「豚バラベーコン」はベーコンのまま', kpId('豚バラベーコン'), '11183')
  eq('KP-2 「ごま油」は今までどおりごま油', kpId('ごま油'), '14002')
  eq('KP-2 「米」は今までどおり米（米油に引きずられない）', kpId('米'), '01083')

  // --- KP-3: 書き方ちがいを、既にある食品へ寄せる（新しい成分値は作っていない） ---
  eq('KP-3 「豚バラしゃぶしゃぶ用肉」「豚バラブロック肉」は豚バラ肉', [
    kpId('豚バラしゃぶしゃぶ用肉'), kpId('豚バラブロック肉'), kpId('豚バラ肉'),
  ], ['11129', '11129', '11129'])
  eq('KP-3 何も付かない「ごま」はいりごま', kpId('ごま'), kpId('いりごま'))
  eq('KP-3 「ごま（白）」も同じ（括弧書きを外して拾う）', kpId('ごま（白）'), kpId('いりごま'))
  eq('KP-3 「ツナ水煮」は水煮のツナ缶', kpId('ツナ水煮'), kpId('ツナ水煮缶'))
  eq('KP-3 「小口ねぎ」は小ねぎ', kpId('小口ねぎ'), kpId('小ねぎ'))
  eq('KP-3 「炒め油」はサラダ油（「揚げ油」と同じ扱い）', kpId('炒め油'), kpId('揚げ油'))
  eq('KP-3 商品名の「瀬戸のほんじお」は食塩', kpId('「瀬戸のほんじお®」'), kpId('塩'))

  // --- KP-4: 合わせ調味料の印を、栄養側も原価側と同じに落とす ---
  // 原価側は2026-08-23 便KEで落とすようになったのに栄養側だけ落とせず、
  // **同じ材料が原価では計算できて栄養では対象外**という食い違いが残っていた
  eq('KP-4 「◎酒」「◯酒」「★酒」「〇酒」「a. 酒」はすべて酒', [
    kpId('◎酒'), kpId('◯酒'), kpId('★酒'), kpId('〇酒'), kpId('a. 酒'),
  ], ['16001', '16001', '16001', '16001', '16001'])
  eq('KP-4 「◎白だし」も白だし', kpId('◎白だし'), kpId('白だし'))
  eq('KP-4 印を落としても何も残らない行は、無理に食品に当てない', kpFood('◎'), null)
  eq('KP-4 印が付いていない材料の結果は変わらない', [kpId('酒'), kpId('しょうゆ')], ['16001', '17007'])

  // --- KP-5: 実データの品で、栄養と原価の両方に効く（前後の実測値をそのまま留める） ---
  // 実データC「レンジで簡単！鶏むね肉と豆苗のレンジ蒸し」の材料そのまま（2人分）
  const kpToumyou = [
    { name: '鶏むね肉', amount: '1', unit: '枚' },
    { name: '豆苗', amount: '1', unit: '袋' },
    { name: '塩', amount: '少々', unit: '' },
    { name: '酒', amount: '1', unit: '小さじ' },
    { name: '砂糖', amount: '1', unit: '小さじ' },
    { name: 'しょうゆ', amount: '1', unit: '大さじ' },
    { name: 'ごま油', amount: '1/2', unit: '大さじ' },
    { name: '白いりごま', amount: '1', unit: '小さじ' },
  ]
  eq('KP-5 豆苗の品の野菜量は50g（旧0g＝1品まるごと0だった）', Math.round(vegetableGrams({ ingredients: kpToumyou, servings: 2 })), 50)
    // 2026-08-26 便LF: 豆苗を100→125円/1パックにしたので期待値もそろえた。
  // 便KPが見ているのは「豆苗に値段が付くこと」で、値そのものではない
  eq('KP-5 豆苗1袋は原価も125円（旧: 価格が分からない材料。便LFの前は100円）', kpYen('豆苗', '1', '袋'), 125)
  eq('KP-5 豆苗の品に「価格が分からない材料」は残らない', pricelessIngredientNamesOfRecipes([{ ingredients: kpToumyou }], kpIndex), [])

  // 実データC「切って混ぜるだけ♪さばマヨ水菜サラダ」の材料そのまま（2人分）
  const kpSabaSalad = [
    { name: '水菜', amount: '1/2', unit: '袋' },
    { name: 'さばのみそ煮缶', amount: '1', unit: '缶' },
    { name: 'マヨネーズ', amount: '2', unit: '大さじ' },
    { name: '粒マスタード', amount: '1', unit: '小さじ' },
  ]
  {
    const n = kpNut({ ingredients: kpSabaSalad, servings: 2 })
    eq('KP-5 さばマヨの対象外は0件（旧: さばのみそ煮缶・粒マスタードの2件）', n.excluded.map((e) => e.name), [])
    eq('KP-5 さばマヨは1人分のたんぱく質が16g超（旧1.3g）', n.perServing.proteinG > 16, true)
    eq('KP-5 さばマヨの1人分の食塩相当量は1g超（旧0.3g）', n.perServing.saltG > 1, true)
  }
  eq(
    'KP-5 さばのみそ煮缶に、生の切り身「さば 100円/1切れ」の値段が当たらない',
    kpYen('さばのみそ煮缶', '1', '缶') !== kpYen('さば', '1', '切れ'),
    true,
  )

  // 実データC「豚肉とキャベツの蒸ししゃぶ」の材料そのまま（2人分）
  const kpShabu = [
    { name: '豚バラしゃぶしゃぶ用肉', amount: '150', unit: 'g' },
    { name: 'キャベツ', amount: '1/5', unit: '個' },
    { name: 'トマト', amount: '1', unit: '個' },
    { name: 'ポン酢じょうゆ', amount: '2.5', unit: '大さじ' },
    { name: '砂糖、ごま油 各', amount: '1', unit: '小さじ' },
  ]
  {
    const n = kpNut({ ingredients: kpShabu, servings: 2 })
    eq(
      'KP-5 しゃぶしゃぶ用の豚バラが「成分表に無い」で落ちない',
      n.excluded.filter((e) => e.reason === 'food').map((e) => e.name),
      [],
    )
    eq('KP-5 1人分は300kcal超（旧68kcal＝主材料の肉が丸ごと落ちていた）', n.perServing.kcal > 300, true)
  }
  eq('KP-5 豚バラしゃぶしゃぶ用肉150gは原価も豚バラ肉と同じ', kpYen('豚バラしゃぶしゃぶ用肉', '150', 'g'), kpYen('豚バラ肉', '150', 'g'))

  // 実データA「簡単！節約！もやし入り豚キムチ」の材料そのまま（3人分）
  const kpButaKimchi = [
    { name: '豚バラ肉', amount: '300', unit: 'g' },
    { name: 'キムチ', amount: '200', unit: 'g' },
    { name: 'もやし', amount: '1', unit: '袋' },
    { name: '〇醤油', amount: '1', unit: '大さじ' },
    { name: '〇酒', amount: '1', unit: '大さじ' },
    { name: '〇コチュジャン（なくてもOK）', amount: '1', unit: '大さじ' },
    { name: 'ごま油', amount: '適量', unit: '' },
    { name: '白ごま', amount: '適量', unit: '' },
  ]
  {
    const n = kpNut({ ingredients: kpButaKimchi, servings: 3 })
    eq(
      'KP-5 豚キムチで成分表に無くて落ちる材料は0件（旧: 〇酒・キムチ）',
      n.excluded.filter((e) => e.reason === 'food').map((e) => e.name),
      [],
    )
    eq('KP-5 豚キムチの1人分の食塩相当量は3.3g（旧1.3g＝キムチの塩分が丸ごと抜けていた）', Number(n.perServing.saltG.toFixed(1)), 3.3)
    eq('KP-5 豚キムチの野菜量は133g（旧67g）', Math.round(vegetableGrams({ ingredients: kpButaKimchi, servings: 3 })), 133)
  }

  // --- KP-6: 八訂に実収載が無いものは足さない（「たぶんこれくらい」を作らない） ---
  // 分からないものは分からないまま対象外にして、画面には「対象外の材料があります」と出す
  eq('KP-6 塩麹は足していない（八訂に収載が無い）', kpFood('塩麹'), null)
  eq('KP-6 つけてみそかけてみそは足していない（同上）', kpFood('つけてみそかけてみそ'), null)
  eq('KP-6 ウェイパーは足していない（顆粒中華だしとは形が違う）', kpFood('ウェイパー'), null)
  eq('KP-6 「レモン」は足していない（果汁07156か全果07155か材料名だけでは決まらない）', kpFood('レモン'), null)
  eq('KP-6 「レモン汁」と書けば今までどおり計算できる', kpId('レモン汁'), '07156')

  // --- KP-7: 価格マスタに無かった材料（司令部の指示の3件） ---
  // 減塩しょうゆ・減塩みそは 2026-08-25 便KLで別の食品にしたことで「価格が分からない材料」に回っていた。
  // 水菜は栄養は直っていたのに価格マスタに1件も無かった
  eq('KP-7 減塩しょうゆに目安価格がある（大さじ1で9円）', kpYen('減塩しょうゆ', '1', '大さじ'), 9)
  eq('KP-7 普通のしょうゆより高い（実勢どおり。1Lで570円 vs 400円）', kpYen('減塩しょうゆ', '1', '大さじ') > kpYen('しょうゆ', '1', '大さじ'), true)
  eq('KP-7 減塩みそに目安価格がある（普通のみそと同額＝新しい相場を作らない）', [
    kpYen('減塩みそ', '1', '大さじ'), kpYen('みそ', '1', '大さじ'),
  ], [11, 11])
  eq('KP-7 水菜に目安価格がある（1袋150円）', [kpYen('水菜', '1', '袋'), kpYen('水菜', '1/2', '袋')], [150, 75])
  eq('KP-7 水菜は「1束」でも同じ（成分表が袋=束=200gを持っているため）', kpYen('水菜', '1', '束'), kpYen('水菜', '1', '袋'))

  // --- KP-8: 実データ90品で価格が出ていなかった材料のうち、よく使うもの ---
  // おろししょうがは**7品に出てくる最多の抜け**。書き方が5通りあっても1件の目安価格に寄る
  eq('KP-8 おろししょうがの書き方ちがいは、全部同じ目安価格に寄る', [
    kpYen('おろししょうが', '1', '小さじ'),
    kpYen('おろし生姜', '1', '小さじ'),
    kpYen('すりおろし生姜', '1', '小さじ'),
    kpYen('しょうがチューブ', '1', '小さじ'),
    kpYen('生姜チューブ', '1', '小さじ'),
  ], [13, 13, 13, 13, 13])
  eq('KP-8 生の「しょうが 1かけ」とは別の値段のまま（チューブと生を混ぜない）', kpYen('しょうが', '1', 'かけ'), 20)
  eq('KP-8 白だしに目安価格がある（大さじ1で9円）', kpYen('白だし', '1', '大さじ'), 9)
  eq('KP-8 印つき・商品名つきの白だしも同じ値段に寄る', [
    kpYen('◎白だし', '大1.5', ''), kpYen('キッコーマン旨みひろがる 香り白だし', '1', '大さじ'),
  ], [14, 9])
    // 2026-08-26 便LF: ミニトマトを200gあたり210→310円にしたので期待値もそろえた
  eq('KP-8 ミニトマト2個は47円（トマト1個60円とは別の行。便LFの前は32円）', kpYen('ミニトマト', '2', '個'), 47)
  eq('KP-8 さばのみそ煮缶1缶は260円', kpYen('さばのみそ煮缶', '1', '缶'), 260)
  eq('KP-8 ぶり2切れは608円（政府統計の380円/100g × 成分表の1切れ80g）', kpYen('ぶり', '2', '切れ'), 608)
  eq('KP-8 赤味噌 大さじ1/2は6円', kpYen('赤味噌', '1/2', '大さじ'), 6)
  eq('KP-8 三温糖は砂糖と同じ値段（大さじ1で2円）', kpYen('三温糖', '1', '大さじ'), kpYen('砂糖', '1', '大さじ'))
  eq('KP-8 粒マスタード小さじ1は16円', kpYen('粒マスタード', '1', '小さじ'), 16)
  eq('KP-8 練りからし小さじ1/2は9円', kpYen('練りからし', '1/2', '小さじ'), 9)
  eq('KP-8 ホールコーン130gは152円（コーン缶の行に寄る）', kpYen('ホールコーン', '130', 'g'), 152)
  // 2026-08-26 便LF: 米油を600→880円/1Lにしたので9→13円になった。
  // 便KPが見張っているのは「米油が『米 60円/1合』ではなく自分の行に当たること」で、値そのものではない
  eq('KP-8 米油に目安価格がある（大さじ1で13円。旧: 前方一致で「米 60円/1合」に当たっていた）', kpYen('米油', '1', '大さじ'), 13)
  eq('KP-8 粉チーズ10gは78円', kpYen('粉チーズ', '10', 'g'), 78)

  // --- KP-9: 量が読めないものに、袋・ボトルまるごとの金額を乗せない（便KEの線を守る） ---
  // 分からないものは「価格が分からない材料」に数えて、利用者が自分の相場を入れられるようにする
  eq('KP-9 「米油 適量」は金額を出さない（登録単位が1L＝販売単位のため）', kpYen('米油', '適量', ''), null)
  eq('KP-9 「粉チーズ 適量」も金額を出さない（登録単位が80g＝販売単位のため）', kpYen('粉チーズ', '適量', ''), null)
  eq('KP-9 「しょうがチューブ 3cm」も金額を出さない（cmを重さに換算できない）', kpYen('しょうがチューブ', '3', 'cm'), null)

  // --- KP-10: 版番号を上げてある（上げないと新しい行が既存の端末に届かない） ---
  eq('KP-10 価格マスタの版番号は13以上', PRICE_DEFAULTS_VERSION_FOR_JG >= 13, true)
  eq('KP-10 成分表の版番号は9以上', NUTRITION_DB_VERSION_FOR_KP >= 9, true)
}


// ==========================================================================================
// ==========================================================================================
// 便KS（2026-08-25 オーナー書き溜め・レシピの登録画面／詳細画面／原価）
//
// オーナー原文（該当箇所）:
//   「・レシピ登録には和洋中を設定する場所がないけど、タグに手入力するの？献立で絞り込み設定の
//     専用ボタンがあるなら、レシピ登録でも専用に設定する場所があった方がわかりやすい
//    ・原価で並び替えもほしい
//    ・レシピ詳細の材料下段「登録：◯人分」がここに書いてあると、材料の原価などがその人数分で
//      あるかのように見える。削除。知りたかったら編集で確認できるし。
//    ・出汁の取り方「この分量で、〜」→作る量によって変わるので変更。だし◯ｍｌなら〜。
//      １食あたり７０円とあるが、出汁だけで１食とは言わない。
//    ・価格なし材料が１つでもあるのに※表記がない…やはり１つでも価格なしになったら表記しましょう」
//   差し戻しA「せめて手段を狭めてURLとコピペができないようにし、手動編集は残します」
//   差し戻しC「URL取り込みで期待するのは、URLからの情報のみです。余計な情報が残ることは
//             むしろマイナス」
// ==========================================================================================
{
  const ksRoot = path.dirname(fileURLToPath(scriptFileUrl))
  const ksRead = (rel) => readFileSync(path.join(ksRoot, '..', rel), 'utf-8')
  const ksForm = ksRead('src/pages/RecipeFormPage.tsx')
  const ksDetail = ksRead('src/pages/RecipeDetailPage.tsx')
  const ksList = ksRead('src/pages/RecipesPage.tsx')
  const ksManual = ksRead('public/about/manual.html')

  // ---------- KS-1: 「くわしく」にも料理のジャンルを置く ----------
  // 取り込み直後の欄（便KO）にはジャンルのボタンがあるのに、登録画面の「くわしく」には無く、
  // 和洋中はタグ欄に手で打つしかなかった。同じ項目なので同じ部品・同じstateで出す。
  {
    eq('KS-1 「くわしく」にジャンルの欄名がある', typeof ja.form.genreLabel, 'string')
    eq('KS-1 欄名は取り込み側と同じ言い方', ja.form.genreLabel.startsWith(ja.form.importGapField.genre), true)
    eq('KS-1 他の任意項目と同じく「（任意）」が付く', ja.form.genreLabel.includes('（任意）'), true)
    // 画面: 取り込み直後の欄（import-gap-genre）と「くわしく」（detail-genre）の2か所に出す
    eq('KS-1 取り込み直後の欄にジャンルが出ている', ksForm.includes('testId="import-gap-genre"'), true)
    eq('KS-1 「くわしく」にもジャンルが出ている', ksForm.includes('testId="detail-genre"'), true)
    // 両方とも同じ関数を使う（片方だけ別の持ち方にすると、選び直しで食い違う）
    eq('KS-1 ジャンルの読み書きは1か所（tagsWithGenre / recipeGenreTag）', [
      ksForm.split('pickGenre').length - 1 >= 2,
      ksForm.split('recipeGenreTag(tags)').length - 1 >= 2,
    ], [true, true])
    // タグと二重にならない: 中身はタグそのものなので、選ぶ＝タグが1つ入る／
    // タグ欄で消す＝ボタンの選択も外れる（同じ配列を見ているため）
    eq('KS-1 選ぶとタグに1つだけ入る', tagsWithGenre(['定番'], '和食'), ['定番', '和食'])
    eq('KS-1 別のジャンルを選ぶと入れ替わる（2つ付かない）', tagsWithGenre(['定番', '和食'], '洋食'), ['定番', '洋食'])
    eq('KS-1 同じものをもう一度押すと外れる', tagsWithGenre(['定番', '和食'], '和食'), ['定番'])
    // タグ欄で手入力・削除したときも、ボタンの選択はタグから引き直す＝二重に持たない
    eq('KS-1 タグ欄で「和食」を消せばボタンの選択も外れる', recipeGenreTag(['定番']), undefined)
    eq('KS-1 タグ欄に手で「中華」と打てばボタンも選ばれた状態になる', recipeGenreTag(['中華']), '中華')
  }

  // ---------- KS-2: 1食あたりの原価で並べ替える ----------
  // オーナー「原価で並び替えもほしい」。**無料で使える**（原価の表示自体が無料の機能なので、
  // 並べ替えだけを有料にする理由が無い）。
  // 価格が分からない材料がある品は金額が必ず実際より安く出るので、「安い順」の先頭に置かない。
  {
    eq('KS-2 原価順は無料で選べる', isFreeSortOption('cost'), true)
    eq('KS-2 原価順は栄養並び替えの区分に入っていない', isNutrientSortOption('cost'), false)
    eq('KS-2 既定は安い順（昇順）', defaultSortDirection.cost, 'asc')
    eq('KS-2 並べ替えの名前と、並び方の1行がある', [
      typeof ja.search.sortCost,
      typeof ja.search.sortCostHint,
    ], ['string', 'string'])
    eq('KS-2 名前に「1食あたり」を入れて、何を比べた順か言い切る', ja.search.sortCost.includes('1食あたり'), true)
    eq('KS-2 レシピ一覧の並べ替えに原価順が並んでいる', ksList.includes("value: 'cost'"), true)
    eq('KS-2 無料/Proで出し分ける栄養の並びには足していない', ksList.includes('nutrientSortOptions'), true)

    const ksIndex = buildPriceIndex([
      { id: 1, name: 'たまねぎ', pricePerUnit: 50, unit: '1個' },
      { id: 2, name: '牛こま切れ肉', pricePerUnit: 300, unit: '100g' },
    ])
    const ksRecipe = (id, ingredients, servings = 2) => ({
      id,
      title: `KS${id}`,
      servings,
      effortLevel: 'normal',
      tags: [],
      ingredients,
      steps: [],
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 0,
      updatedAt: id,
    })
    // ①金額がそろっている安い品 ②金額がそろっている高い品
    // ③一部の材料の価格が分からない品（合計は安く出る＝そのままなら先頭に来てしまう）
    // ④金額が1円も分からない品
    const ksCheap = ksRecipe(1, [{ name: 'たまねぎ', amount: '1', unit: '個' }])
    const ksPricey = ksRecipe(2, [{ name: '牛こま切れ肉', amount: '200', unit: 'g' }])
    const ksPartial = ksRecipe(3, [
      { name: 'たまねぎ', amount: '1', unit: '個' },
      { name: '架空の高級食材', amount: '300', unit: 'g' },
    ])
    const ksUnknown = ksRecipe(4, [{ name: '架空の高級食材', amount: '300', unit: 'g' }])
    const ksAll = [ksCheap, ksPricey, ksPartial, ksUnknown]
    const ksValues = buildCostSortValues(ksAll, ksIndex)
    eq('KS-2 1食あたりの金額は登録人数で割った値（たまねぎ1個50円÷2人分＝25円）', ksValues.get(1).perServingYen, 25)
    eq('KS-2 価格が全部そろっていれば「そろっている」印が立つ', ksValues.get(1).complete, true)
    eq('KS-2 価格が分からない材料が1件でもあれば印は立たない（レシピ詳細の※と同じ判定）', ksValues.get(3).complete, false)
    eq('KS-2 金額が1円も分からない品は値を持たない', ksValues.get(4).perServingYen, null)

    const ksResults = ksAll.map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
    const ksOrder = (direction) =>
      sortResults(ksResults, 'cost', [], direction, undefined, ksValues).map((r) => r.recipe.id)
    // 安い順: 金額がそろっている品(1→2) → 一部が分からない品(3) → 金額が分からない品(4)
    eq('KS-2 安い順でも、価格が分からない材料がある品を先頭に出さない', ksOrder('asc'), [1, 2, 3, 4])
    // 高い順: まとまりの順は変えず、まとまりの中だけを反転する
    eq('KS-2 高い順ではまとまりの中だけ反転する（まとまりの順は変わらない）', ksOrder('desc'), [2, 1, 3, 4])
    // 実際の金額そのものは、レシピ詳細の原価と同じ資産で計算している（値の食い違いを作らない）
    eq(
      'KS-2 並べ替えに使う金額はレシピ詳細の原価と同じ計算',
      ksValues.get(2).perServingYen,
      Math.round(estimateRecipeCost(ksPricey.ingredients, ksIndex).total / ksPricey.servings),
    )
  }

  // ---------- KS-3: レシピ詳細の「登録: ◯人分」を消す（見張りは KN-1 に統合） ----------
  // KN-1 が「1食あたりが何人分の1食か画面から読めること」を見張っている。
  // ここでは、消したことで**行そのものが消えていない**ことだけを見る（消すと材料が48pxずれる）
  eq('KS-3 「登録: ◯人分」の文言は無い', 'servingsRegisteredNote' in ja.detail, false)

  // ---------- KS-4: 「1食」に分けて食べる品ではないレシピの金額 ----------
  // オーナー「１食あたり７０円とあるが、出汁だけで１食とは言わない」。
  // 料理名での特別扱いにはせず、レシピが持つ印（wholeBatch）で言い方を変える
  {
    const ksDashi = starterDefs.find((def) => def.title === 'だしのとり方')
    eq('KS-4 だしのとり方に「1食に分けない」印が付いている', ksDashi?.wholeBatch, true)
    eq(
      'KS-4 印が付いているのはだしのとり方だけ（他の品の金額の言い方は変わらない）',
      starterDefs.filter((def) => def.wholeBatch === true).map((def) => def.title),
      ['だしのとり方'],
    )
    eq('KS-4 でき上がり全体の言い方がある', typeof ja.detail.priceWholeBatch, 'string')
    eq('KS-4 でき上がり全体の言い方に金額が入る', ja.detail.priceWholeBatch.includes('{n}'), true)
    eq('KS-4 レシピ詳細が印を見て言い方を変えている', ksDetail.includes('recipe.wholeBatch'), true)
    eq('KS-4 印が付いた品では1食あたりの行を出さない', ksDetail.includes('!recipe.wholeBatch'), true)
    // 料理名での分岐にしない（だし・下ごしらえ・作り置きのもとは今後も増えうる）。
    // レシピ詳細には材料「だし汁」から飛ぶリンク（便DASHI）があるので、ファイル全体ではなく
    // **金額の言い方を決めているところ**に料理名が出てこないことを見る
    eq('KS-4 金額の言い方は印だけで決める（料理名で分けない）', (() => {
      const at = ksDetail.indexOf('ja.detail.priceWholeBatch')
      return at > 0 && !ksDetail.slice(at - 800, at + 800).includes('だしのとり方')
    })(), true)
    eq('KS-4 印はレシピが持つ任意項目（どの品にも付けられる）', ksRead('src/db/types.ts').includes('wholeBatch?: boolean'), true)
    // 「基本レシピを入れ直す」で既存の端末にも届くこと（配る内容の一覧に入っていないと、
    // 印が付くのは新しく入れた端末だけになる）
    {
      const ksOld = { ...ksDashi, wholeBatch: undefined, title: 'だしのとり方', isFavorite: true, cookedLogs: [], searchWords: [], createdAt: 1, updatedAt: 1, id: 99 }
      const ksNew = buildUpdatedStarterRecipe(ksOld, ksDashi, 1000)
      eq('KS-4 入れ直しで印が届く', ksNew?.wholeBatch, true)
      eq('KS-4 入れ直しでも作った記録・お気に入りは残る', [ksNew?.isFavorite, ksNew?.id], [true, 99])
    }
    // 本文の「この分量で、500mlほどのだしができる」も、人数を変えると嘘になるので比で言い直した
    eq('KS-4 でき上がる量を「この分量で」と言わない', ksDashi?.onePoint.includes('この分量で'), false)
    eq('KS-4 でき上がる量は水に対する割合で言う', ksDashi?.onePoint.includes('使った水のおよそ8割'), true)
  }

  // ---------- KS-5: 価格が分からない材料が1件でも知らせる（判定は JG-6 で固定） ----------
  // ここでは同梱109品の実測（1品も印が出ない）を、条件を変えたあとの数で持っておく
  {
    const ksPriceIndex = buildPriceIndex(
      PRICE_DEFAULTS.map((d, i) => ({ id: i + 1, ...d, isDefault: true })),
    )
    const ksWarned = starterDefs.filter(
      (def) => recipeCostConfidence(def.ingredients, ksPriceIndex).shouldWarn,
    )
    eq('KS-5 条件を「1件でも」にしても、同梱109品では1品も印が出ない', ksWarned.length, 0)
    eq('KS-5 見ている品数は109品', starterDefs.length, 109)
  }

  // ---------- KS-6: 基本レシピの編集では、まるごと入れ替える手段を出さない ----------
  // オーナー差し戻しA「せめて手段を狭めてURLとコピペができないようにし、手動編集は残します」
  {
    eq('KS-6 基本レシピの編集では取り込みを出さない', canUseRecipeImportTools({ isEdit: true, isStarter: true }), false)
    eq('KS-6 自分で登録したレシピの編集では今までどおり使える', canUseRecipeImportTools({ isEdit: true, isStarter: false }), true)
    eq('KS-6 新規登録では今までどおり使える', canUseRecipeImportTools({ isEdit: false, isStarter: undefined }), true)
    // 読み込み中（isStarterがまだ分からない）は止めない＝自作レシピの編集を一瞬止めない
    eq('KS-6 読み込み中は止めない', canUseRecipeImportTools({ isEdit: true, isStarter: undefined }), true)
    // 画面: 出さないときは理由の1行を置く（黙って2つのボタンが消えない）
    eq('KS-6 出さない理由の1行がある', typeof ja.form.starterImportBlocked, 'string')
    eq('KS-6 使える手段も1行で書く', ja.form.starterImportBlockedHint.includes('手で書き直せます'), true)
    eq('KS-6 内部の事情（無料枠）はUIに書かない', [
      ja.form.starterImportBlocked.includes('無料'),
      ja.form.starterImportBlockedHint.includes('無料'),
      ja.form.starterImportBlocked.includes('上限'),
    ], [false, false, false])
    eq('KS-6 登録画面が判定を使っている', ksForm.includes('canUseRecipeImportTools'), true)
    eq('KS-6 出さないときの1行を画面に置いている', ksForm.includes('starter-import-blocked'), true)
    // 手動編集の道は1つも塞がない（「デフォルトに戻す」・写真・アイコンは今までどおり）
    eq('KS-6 「デフォルトに戻す」は残っている', ksForm.includes('resetVariant'), true)
    eq('KS-6 写真の入口は残っている', ksForm.includes('cameraInputRef'), true)
    eq('KS-6 アイコンの入口は残っている', ksForm.includes('iconPickerOpen'), true)
  }

  // ---------- KS-7: 読み取れた内容ですべて置き換える ----------
  // オーナー差し戻しC「URL取り込みで期待するのは、URLからの情報のみです。余計な情報が残ることは
  // むしろマイナス」。従来は料理名・ひとこと説明・メモを「残るもの」として触っていなかった。
  //
  // 【料理名だけ、読み取れなかったときに消さない理由（実測）】
  // ・URL取り込み: 料理名・材料・手順のどれかが空なら取り込み自体が成立しない
  //   （workers/recipe-import/src/normalize.ts）＝成功した取り込みでは料理名が必ず入る
  // ・貼り付け: 解析コーパス108件のうち料理名を読み取れたのは50件（46%）。読み取れなかった58件は
  //   「材料」「作り方」で始まる断片＝ページの材料・作り方だけをコピーした形で、
  //   アプリ自身が案内している貼り付け方（urlImport.errorBlocked）でもある。
  //   ここで空にすると、代わりに入る情報が無いまま手で入れた料理名だけが失われ、
  //   料理名は保存に必須なので保存もできなくなる
  {
    const ksBase = {
      filledTitle: true,
      filledIntro: true,
      filledMemo: true,
      filledIngredients: 3,
      filledSteps: 2,
      parsedTitle: true,
      parsedIngredients: 4,
      parsedSteps: 5,
      photoPlan: 'none',
    }
    eq('KS-7 料理名・ひとこと説明・メモも置き換えの対象になる', replaceConfirmTargets(ksBase), {
      title: true,
      intro: true,
      memo: true,
      ingredients: true,
      steps: true,
      photo: false,
    })
    eq(
      'KS-7 料理名を読み取れなかったときは、手で入れた料理名を消さない',
      replaceConfirmTargets({ ...ksBase, parsedTitle: false }).title,
      false,
    )
    eq(
      'KS-7 ひとこと説明とメモは、読み取れなくても空にする（前の料理の説明を残さない）',
      [
        replaceConfirmTargets({ ...ksBase, parsedTitle: false }).intro,
        replaceConfirmTargets({ ...ksBase, parsedTitle: false }).memo,
      ],
      [true, true],
    )
    eq(
      'KS-7 空の登録画面に取り込むときは確認を出さない（今までどおり）',
      needsReplaceConfirm(
        replaceConfirmTargets({
          filledTitle: false,
          filledIntro: false,
          filledMemo: false,
          filledIngredients: 0,
          filledSteps: 0,
          parsedTitle: true,
          parsedIngredients: 3,
          parsedSteps: 3,
          photoPlan: 'none',
        }),
      ),
      false,
    )
    eq(
      'KS-7 料理名だけ入力済みなら、それだけで確認を出す',
      needsReplaceConfirm(
        replaceConfirmTargets({
          filledTitle: true,
          filledIntro: false,
          filledMemo: false,
          filledIngredients: 0,
          filledSteps: 0,
          parsedTitle: true,
          parsedIngredients: 3,
          parsedSteps: 3,
          photoPlan: 'none',
        }),
      ),
      true,
    )
    // 確認の窓（規約F）: 消えるものに3項目が並び、残るものは「取り込みが触らないもの」になる
    eq('KS-7 消えるものの言い方がある', [
      ja.paste.replaceItemTitle,
      ja.paste.replaceItemIntro,
      ja.paste.replaceItemMemo,
    ], ['料理名', 'ひとこと説明', 'メモ'])
    eq('KS-7 「残るもの」から料理名・ひとこと説明・メモが消えている', [
      ja.paste.confirmReplaceKept.includes('料理名'),
      ja.urlImport.confirmReplaceKept.includes('料理名'),
      ja.urlImport.confirmReplaceKeptWithPhoto.includes('メモ'),
    ], [false, false, false])
    // 規約F: 残るものが空にならない（取り込みが触らない項目を書く）
    eq('KS-7 「残るもの」には取り込みが触らない項目が入っている', [
      ja.paste.confirmReplaceKept.includes('タグ'),
      ja.urlImport.confirmReplaceKept.includes('タグ'),
    ], [true, true])
    eq('KS-7 写真が残る経路では写真も書く', [
      ja.paste.confirmReplaceKeptWithPhoto.includes('写真'),
      ja.urlImport.confirmReplaceKeptWithPhoto.includes('写真'),
    ], [true, true])
    // 画面: 読み取れた料理名で上書きし、ひとこと説明は空にする
    eq('KS-7 「空のときだけ入れる」書き方が残っていない', [
      ksForm.includes("!title.trim()) setTitle"),
      ksForm.includes("!memo.trim()) setMemo"),
    ], [false, false])
    eq('KS-7 ひとこと説明を空にしている', ksForm.split("setIntro('')").length - 1 >= 2, true)
  }

  // ---------- KS-8: 取り込みの結果と、入らない項目の欄 ----------
  // オーナー「登録後の赤文字も箇条書きにして改行入れて読みやすくして。注意書きなのに読みにくい。」
  // 「取り込みで入らない項目は、「くわしく」から設定できることを「今後表示しない」の近くに書いて。」
  // 「「取り込みで入らない項目」→「取り込みで自動入力されない項目」」
  {
    eq('KS-8 欄の名前を「取り込みで自動入力されない項目」にした', ja.form.importGapTitle, '取り込みで自動入力されない項目')
    // 使い方ページの同じ節も同じ名前で呼ぶ（同じものを2つの名前で呼ばない）
    eq('KS-8 使い方ページも同じ名前で書いてある', ksManual.includes('取り込みで自動入力されない項目'), true)
    eq('KS-8 使い方ページに古い名前が残っていない', ksManual.includes('取り込みで入らない項目'), false)
    // 「くわしく」から設定できることを「今後表示しない」の近くに書く。「タブ」の語は使わない
    eq('KS-8 あとから設定できる場所を書いてある', ja.form.importGapNoticeDetailField.includes('「くわしく」の入力欄'), true)
    eq('KS-8 「タブ」の語は使わない（2026-08-10 オーナー指示）', ja.form.importGapNoticeDetailField.includes('タブ'), false)
    eq('KS-8 「今後表示しない」と同じまとまりに置いている', (() => {
      const at = ksForm.indexOf('ja.form.importGapNoticeDetailField')
      const hide = ksForm.indexOf('ja.form.importGapNoticeHide')
      return at > 0 && hide > at && hide - at < 900
    })(), true)
    // 「決定」は作らない（オーナー「決定押した時点でレシピ登録終わった気分になるので注が必要」）。
    // 代わりに、欄の中に保存がまだであることを常に出す
    eq('KS-8 保存がまだであることを言う1行がある', ja.form.importGapSaveNote.includes('保存する'), true)
    eq('KS-8 その1行は欄の中に常に出る（説明を消しても残る）', (() => {
      const note = ksForm.indexOf('import-gap-save-note')
      const notice = ksForm.indexOf('importGapNoticeOpen && (')
      return note > 0 && notice > note
    })(), true)
    // 結果の文は「1つの知らせ＝1行」。文言そのものに印（・）は書き込まない
    eq('KS-8 結果は行の並びで持つ', ksForm.includes('function ImportResultMessage'), true)
    eq('KS-8 印は画面が付け、読み上げには渡さない', (() => {
      const at = ksForm.indexOf('function ImportResultMessage')
      return ksForm.slice(at, at + 1600).includes('<span aria-hidden>・</span>')
    })(), true)
    const ksResultLines = [
      ja.paste.resultSummary,
      ja.paste.notImported,
      ja.urlImport.resultSummary,
      ja.urlImport.notImported,
      ja.form.stepNotesMoved,
      ja.urlImport.photoImported,
      ja.urlImport.photoReplaced,
    ]
    eq(
      'KS-8 結果の文言に「・」を書き込んでいない',
      ksResultLines.filter((line) => line.includes('・') && !line.includes('手順')),
      [],
    )
  }
  // ---------- KW-1: 取り込みの結果は「短く・読みやすく」 ----------
  // オーナー原文（2026-08-25 夜）「画像はレシピの取り込み文章です。改行や内容を絞って短く
  // 読みやすくしてください。」オーナーが見た実物は1つづきの6文（実測 URL経路 5行141字・高さ196px）。
  // 便KS・⑧で改行（箇条書き）は入っていたので、便KWは**内容を絞る**ほうを担当した。
  // 実測（390px・材料6件/手順7件/人数分なし/調理時間なし/手順1件に時間/写真あり）:
  //   URL   5行141字 196px → 3行67字 88px
  //   貼付  4行131字 172px → 2行52字 64px
  {
    // ① 同じ性質のもの（取り込み元に無くて欄が埋まらなかったもの）は1行にまとめる
    eq('KW-1 読み取れなかったものは1行にまとめる形を持つ', [
      ja.paste.notImported.includes('{items}'),
      ja.urlImport.notImported.includes('{items}'),
    ], [true, true])
    eq('KW-1 2つの経路で同じ文言にする（経路で説明の形が違わない）', ja.paste.notImported, ja.urlImport.notImported)
    eq('KW-1 人数分と調理時間を並べた1行が40字未満に収まる', (() => {
      const items = [ja.urlImport.itemServings, ja.urlImport.itemCookMinutes].join(ja.urlImport.itemSeparator)
      return ja.urlImport.notImported.replace('{items}', items).length
    })() < 40, true)
    // 旧: 経路ごとに「貼り付けた文章に書かれていなかったので」「取り込んだページに書かれて
    //     いなかったので」を繰り返す2行だった。同じ言い回しの繰り返しを残さない
    eq('KW-1 「書かれていなかったので」の繰り返しを残さない', [
      ja.paste.notImported.includes('書かれていなかったので'),
      ja.urlImport.notImported.includes('書かれていなかったので'),
    ], [false, false])
    // ② 手順の「分」を入れた件数は、結果の並びから外した（手順ごとの印がその場に出るため）。
    //    黙って落としたのではない＝印の文言が残っていることをここで見張る（規約B）
    eq('KW-1 手順の分を入れた印は、手順のその場に残っている', ja.form.stepMinutesAuto.includes('時間'), true)
    eq('KW-1 結果の並びに件数の一言を作り直していない', 'stepMinutesFilled' in ja.form, false)
    eq('KW-1 画面も件数の一言を組み立てていない', ksForm.includes('stepMinutesFilled'), false)
    // ③ 「手順の写真は取り込みません」は、取り込む前に読む説明（チェックの下）へ移した。
    //    2026-08-02 オーナー指示（手順の写真まで入ったと受け取られない）はそちらが担う
    eq('KW-1 取り込む範囲は、取り込む前の説明に書いてある', ja.urlImport.fetchPhotoNote.includes('手順の写真は取り込みません'), true)
    eq('KW-1 結果の写真の行は但し書きを繰り返さない', [
      ja.urlImport.photoImported.includes('手順の写真'),
      ja.urlImport.photoReplaced.includes('手順の写真'),
    ], [false, false])
    eq('KW-1 結果の写真の行は「1枚」を言い切ったまま', [
      ja.urlImport.photoImported.includes('1枚'),
      ja.urlImport.photoReplaced.includes('1枚'),
    ], [true, true])
    // ④ 手順の件数が取り込み元より減る唯一の場面（注記をメモへ寄せた）は落とさない（規約B）。
    //    手順の側には印が出ないので、ここでしか言えない
    eq('KW-1 注記をメモへ寄せた知らせは残す', ja.form.stepNotesMoved.includes('メモ'), true)
    eq('KW-1 画面も注記の知らせを組み立てている', ksForm.includes('stepNotesMoved'), true)
    // ⑤ 並びの中の1行なので、行末に句点は付けない（1つの知らせ＝1行）
    eq('KW-1 結果の各行は行末に句点を付けない', [
      ja.paste.notImported.endsWith('。'),
      ja.urlImport.notImported.endsWith('。'),
      ja.paste.alsoApplied.endsWith('。'),
      ja.urlImport.alsoApplied.endsWith('。'),
      ja.form.stepNotesMoved.endsWith('。'),
      ja.urlImport.photoImported.endsWith('。'),
      ja.urlImport.photoReplaced.endsWith('。'),
    ], [false, false, false, false, false, false, false])
    // ⑥ 項目名は1か所だけで持つ（同じ文字を再定義しない＝CLAUDE.md コーディング規約）
    eq('KW-1 項目名は「も合わせました」と「読み取れませんでした」で共用する', [
      'alsoAppliedServings' in ja.urlImport,
      'alsoAppliedCookMinutes' in ja.urlImport,
      'alsoAppliedServings' in ja.paste,
    ], [false, false, false])
  }

  // ---------- KS-9: 「1食」に分けて食べる品ではないレシピの、栄養とシェアの言い方 ----------
  // 2026-08-25 便KS・④の続き（司令部の裁定「栄養パネルの『1食あたり』も wholeBatch を効かせる」）。
  // オーナー原文「１食あたり７０円とあるが、出汁だけで１食とは言わない」＝引っかかっているのは
  // 金額ではなく**「1食」という数え方そのもの**なので、金額と同じ印で栄養・シェアもそろえる。
  {
    // --- 栄養パネル（レシピ詳細）---
    eq('KS-9 でき上がり全体の言い方を持っている', [
      typeof ja.nutrition.summaryLabelWholeBatch,
      typeof ja.nutrition.wholeBatchHeader,
    ], ['string', 'string'])
    eq('KS-9 でき上がり全体の要約に「1食」と書かない', ja.nutrition.summaryLabelWholeBatch.includes('1食'), false)
    const ksTeaser = ksRead('src/components/NutritionTeaser.tsx')
    eq('KS-9 栄養パネルが印を見て言い方を変えている', ksTeaser.includes('summaryLabelWholeBatch'), true)
    eq('KS-9 栄養パネルは印をレシピから受け取る', ksTeaser.includes("'wholeBatch'"), true)
    // 数値の表は1人分の列を出さず、でき上がり全体の1列にする
    eq('KS-9 表の列も印で切り替える', ksTeaser.includes('wholeBatchHeader'), true)
    eq('KS-9 表の列数も切り替える', ksTeaser.includes("wholeBatch ? 'grid-cols-[1fr_auto]'"), true)

    // --- シェア文（アプリの外へ出るので、画面と同じ言い方でなければならない）---
    const ksShareBase = {
      image: false, cookMinutes: false, cost: false, nutrition: true, allIngredients: false,
      kcalPerServing: 100, saltPerServing: 1.2,
    }
    // シェア文の検査用（別の節の shareRecipe は節の中の変数なので、ここで最小の形を作る）
    const ksNormalRecipe = {
      title: 'KSだしのとり方',
      servings: 2,
      effortLevel: 'normal',
      tags: [],
      ingredients: [{ name: '昆布', amount: '10', unit: 'g' }],
      steps: [{ text: '煮る' }],
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 0,
      updatedAt: 0,
    }
    const ksBatchRecipe = { ...ksNormalRecipe, wholeBatch: true }
    eq(
      'KS-9 ふつうの品のシェア文は今までどおり「1食あたり」',
      buildShareText(ksNormalRecipe, ksShareBase).includes('1食あたり 約100kcal・塩分 約1.2g（概算）'),
      true,
    )
    eq(
      'KS-9 1食に分けない品は「でき上がり全体で」（数値も全体ぶん＝1人分×人数）',
      buildShareText(ksBatchRecipe, ksShareBase).includes('でき上がり全体で 約200kcal・塩分 約2.4g（概算）'),
      true,
    )
    eq(
      'KS-9 1食に分けない品のシェア文に「1食あたり」が出ない',
      buildShareText(ksBatchRecipe, ksShareBase).includes('1食あたり'),
      false,
    )
    const ksCostOpts = { ...ksShareBase, nutrition: false, cost: true, costPerServingYen: 70, costTotalYen: 140 }
    eq(
      'KS-9 ふつうの品の原価行は今までどおり1人分と全量',
      buildShareText(ksNormalRecipe, ksCostOpts).includes('原価 1人分 約70円／全量（2人分） 約140円'),
      true,
    )
    eq(
      'KS-9 1食に分けない品の原価行はでき上がり全体だけ',
      buildShareText(ksBatchRecipe, ksCostOpts).includes('原価 でき上がり全体 約140円'),
      true,
    )
    eq(
      'KS-9 1食に分けない品の原価行に「1人分」が出ない',
      buildShareText(ksBatchRecipe, ksCostOpts).includes('1人分 約70円'),
      false,
    )
    // 選ぶときの名前も、出る文と同じ言い方にする（チェック欄と結果が食い違わない）
    eq('KS-9 シェアの選択肢もでき上がり全体で言う', [
      ja.share.optNutritionWholeBatch.includes('でき上がり全体'),
      ja.share.optNutritionKcalOnlyWholeBatch.includes('でき上がり全体'),
      ksRead('src/components/ShareModal.tsx').includes('optNutritionWholeBatch'),
    ], [true, true, true])
    // 文の形は1つだけ持つ（同じ文を2通り書き分けない＝片方だけ直して言い方が割れるのを防ぐ）
    eq('KS-9 栄養行の雛形は「何あたりか」を差し込む形になっている', [
      ja.share.lineNutrition.includes('{scope}'),
      ja.share.lineNutritionKcalOnly.includes('{scope}'),
      ja.share.lineNutritionPartial.includes('{scope}'),
      ja.share.lineNutritionKcalOnlyPartial.includes('{scope}'),
    ], [true, true, true, true])

    // --- レシピ一覧の「1食あたりの原価順」---
    // 1食あたりの物差しに乗らない品なので、並びの最後のまとまりに置き、
    // カードにはでき上がり全体の金額を出す（一覧に「1食あたり 約70円」を残さない）
    {
      const ksIndex2 = buildPriceIndex([{ id: 1, name: 'たまねぎ', pricePerUnit: 50, unit: '1個' }])
      const ksMake = (id, wholeBatch) => ({
        id, title: `KS9-${id}`, servings: 2, effortLevel: 'normal', tags: [],
        ingredients: [{ name: 'たまねぎ', amount: '1', unit: '個' }],
        steps: [], isFavorite: false, cookedLogs: [], searchWords: [],
        createdAt: 0, updatedAt: id, ...(wholeBatch ? { wholeBatch: true } : {}),
      })
      const ksNormal = ksMake(1, false)
      const ksBatch = ksMake(2, true)
      const ksVals = buildCostSortValues([ksNormal, ksBatch], ksIndex2)
      eq('KS-9 ふつうの品は1食あたりの金額を持つ', ksVals.get(1).perServingYen, 25)
      eq('KS-9 1食に分けない品は1食あたりの金額を持たない', ksVals.get(2).perServingYen, null)
      eq('KS-9 1食に分けない品はでき上がり全体の金額を持つ', ksVals.get(2).wholeBatchYen, 50)
      const ksSorted = (dir) =>
        sortResults(
          [ksBatch, ksNormal].map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 })),
          'cost', [], dir, undefined, ksVals,
        ).map((r) => r.recipe.id)
      eq('KS-9 安い順でも1食に分けない品は最後', ksSorted('asc'), [1, 2])
      eq('KS-9 高い順でも1食に分けない品は最後', ksSorted('desc'), [1, 2])
    }

    // --- 献立に入れたときの合計（数え方は変えていないことを固定する）---
    // 司令部の問い「『でき上がり全体』を1食として合計に足していたら辻褄が合わなくなる」への答え:
    // 献立の合計は**どの品も「登録人数で割った1人分」を1回足す**規則で、印では変えていない
    // （logic/nutrition.ts の sumPersonalNutrition / logic/priceEstimate.ts の
    //  sumMealPlanEntriesCost）。だしのとり方（2人分・140円）を1食分入れた日は70円が乗る＝
    // 「でき上がりの半分を使った」という意味になり、レシピ詳細の「でき上がり全体で 約140円」と
    // 矛盾しない（全体を使えば2食分＝140円）。**1食あたりを画面に出さないのは詳細画面の話で、
    // 合計の数え方そのものは変えていない**
    {
      const ksIndex3 = buildPriceIndex([{ id: 1, name: 'たまねぎ', pricePerUnit: 50, unit: '1個' }])
      const ksBatchRecipe2 = {
        ingredients: [{ name: 'たまねぎ', amount: '2', unit: '個' }],
        servings: 2,
        wholeBatch: true,
      }
      const ksSum = sumMealPlanEntriesCost(
        [{ recipeId: 1, servings: 1 }],
        new Map([[1, ksBatchRecipe2]]),
        ksIndex3,
      )
      eq('KS-9 献立の合計は1人分ずつ数える（印では変えていない）', [ksSum.total, ksSum.personalTotal], [50, 50])
      const ksSumWhole = sumMealPlanEntriesCost(
        [{ recipeId: 1, servings: 2 }],
        new Map([[1, ksBatchRecipe2]]),
        ksIndex3,
      )
      eq('KS-9 2食分ぶん入れればでき上がり全体の金額になる', ksSumWhole.total, 100)
    }
  }
}


// ==========================================================================================
// 便KT: 2026-08-25 オーナー書き溜め（並行調理ナビの節）の再発防止
// ==========================================================================================
{
  const ktDir = path.dirname(fileURLToPath(scriptFileUrl))
  const ktRead = (rel) => readFileSync(path.join(ktDir, '..', rel), 'utf-8')

  // ---- KT-1: レシピごとの番号「1-1」を、レシピ名が長くても折り返さない ----
  // オーナー原文「並行調理のレシピごとの番号「1−1」などが、レシピ名が長いと改行されてしまう。」
  // 真因は**バッジを包んでいる span が横並びの中で縮む側だった**こと（中の StepBadge は
  // shrink-0 を持っていたが、外側が縮むので中の文字がハイフンで折り返していた）。
  // 実際の見え方（390px/320px）は e2e が測る。ここでは「縮まない側」に戻っていないかを見る
  {
    const naviSrc = ktRead('src/pages/CookNaviPage.tsx')
    const overlaySrc = ktRead('src/components/CookSessionOverlay.tsx')
    const badgeSrc = ktRead('src/components/StepBadge.tsx')
    eq(
      'KT-1 段取りの一覧: 品ごとの番号のバッジを包む span が縮まない（shrink-0）',
      /data-testid="navi-recipe-step-number" className="shrink-0"/.test(naviSrc),
      true,
    )
    eq(
      'KT-1 調理中モード: 品ごとの番号のバッジを包む span も縮まない',
      /<span aria-hidden className="shrink-0">\s*<StepBadge number=\{currentStepLabel\}/.test(overlaySrc),
      true,
    )
    eq(
      'KT-1 番号そのものが折り返せない（「3-1」がハイフンで割れない）',
      badgeSrc.includes('whitespace-nowrap'),
      true,
    )
    eq(
      'KT-1 縮むのは料理名の札のほう（truncate で省略する）',
      /RecipePill[\s\S]{0,400}min-w-0 max-w-full truncate/.test(naviSrc),
      true,
    )
  }

  // ---- KT-4: 器具そのものが知らせる待ちに、アプリのタイマーを出さない ----
  // オーナー原文「レンジでは、レンジのタイマーを使います。レンジに関するタイマーは削除できない？
  //             絶対使わないのに出てると、アプリが安っぽく感じる。」
  // 段取りの計算（分数・器具の占有）は変えない＝**表示するボタンだけ**を決める判定
  {
    const wait = (text, over = {}) => ({ kind: 'wait', longRest: false, waitMinutes: 3, text, ...over })
    eq(
      'KT-4 電子レンジの待ちはアプリのタイマーを出さない',
      waitSignaledByAppliance(wait('ふんわりとラップをかけ、電子レンジ(600W)で3分加熱する。')),
      'microwave',
    )
    eq(
      'KT-4 トースターの待ちも出さない（つまみが時間で回り、終わると鳴る）',
      waitSignaledByAppliance(wait('トースターでチーズに焼き色がつくまで7分焼く。')),
      'toaster',
    )
    eq(
      'KT-4 コンロの待ちには出す（沸くまで・煮るは器具が何も知らせない）',
      [
        waitSignaledByAppliance(wait('落としぶたをして中火で15分煮る。', { waitMinutes: 15 })),
        waitSignaledByAppliance(wait('火にかけたまま、沸くのを待つ', { addedByNavi: true, waitMinutes: 5 })),
      ],
      [null, null],
    )
    eq(
      'KT-4 魚焼きグリルにも出す（タイマーの無い機種があり、外れたときの被害が大きい）',
      waitSignaledByAppliance(wait('魚焼きグリルで12分焼く。', { waitMinutes: 12 })),
      null,
    )
    eq(
      'KT-4 炊飯のあとの蒸らしにも出す（炊飯器は器具として数えていない＝知らせる合図もない）',
      waitSignaledByAppliance(wait('炊飯器で普通に炊き、炊き上がったら10分蒸らす。', { waitMinutes: 10 })),
      null,
    )
    eq(
      'KT-4 レンジを持っていない台所では出す（その工程はコンロに読み替わるため）',
      waitSignaledByAppliance(wait('電子レンジ(600W)で3分加熱する。'), {
        burners: 2, microwave: false, grill: true, toaster: true,
      }),
      null,
    )
    eq(
      'KT-4 待ちでない手順・長い待ちには元から出ない（判定を二重にしない）',
      [
        waitSignaledByAppliance({ kind: 'active', longRest: false, waitMinutes: 0, text: '電子レンジで温める' }),
        waitSignaledByAppliance({ kind: 'wait', longRest: true, waitMinutes: 0, text: '電子レンジで温める' }),
      ],
      [null, null],
    )
    // 画面（段取りの一覧・調理中モード）が同じ判定を使っていること＝1つの段取りを2通りに見せない
    for (const [where, src] of [
      ['段取りの一覧', ktRead('src/pages/CookNaviPage.tsx')],
      ['調理中モード', ktRead('src/components/CookSessionOverlay.tsx')],
    ]) {
      eq(
        `KT-4 ${where}のタイマーのボタンは、この判定で出し分けている`,
        /showsWaitTimerButton\(item\) && applianceTimer == null/.test(src),
        true,
      )
      eq(
        `KT-4 ${where}は、ボタンの代わりに何ではかるのかを書く（黙って消さない）`,
        src.includes('ja.cookNavi.waitApplianceTimerNote'),
        true,
      )
    }
    eq(
      'KT-4 その一文は器具の名前を差し込む（「器具」とだけ書かない）',
      ja.cookNavi.waitApplianceTimerNote.includes('{appliance}'),
      true,
    )
    // 押す手立てが無い待ちを「タイマーを押していません」と急かさない
    {
      const { timerNoticeOnAdvance } = await import('../../src/logic/cookTimerNotice.ts')
      const mk = (stepIndex, text, kind = 'wait') => ({
        recipeId: 1, stepIndex, kind, longRest: false, waitMinutes: kind === 'wait' ? 3 : 0,
        text, stepNumber: stepIndex + 1, order: stepIndex + 1,
      })
      const cur = (stepIndex) => ({ recipeId: 1, stepIndex })
      eq(
        'KT-4 進んだときの一言も、器具が知らせる待ちでは出さない',
        timerNoticeOnAdvance(
          [mk(0, 'ふんわりとラップをかけ、電子レンジ(600W)で3分加熱する。'), mk(1, '器に盛る。', 'active')],
          cur(0), cur(1), [],
        ),
        null,
      )
      eq(
        'KT-4 コンロの待ちでは今までどおり言う（押せるボタンがあるので急かす意味がある）',
        timerNoticeOnAdvance(
          [mk(0, '落としぶたをして中火で3分煮る。'), mk(1, '器に盛る。', 'active')],
          cur(0), cur(1), [],
        ),
        { kind: 'notStarted', recipeId: 1, stepIndex: 0 },
      )
    }
  }

  // ---- KT-7: 「調理中だった手順」をやめ、画面の名前（調理中モード）で言う ----
  // オーナー原文「自動で組んだ並びに戻します「調理中だった手順」とは？」
  {
    const stale = Object.entries(ja.cookNavi)
      .filter(([, v]) => typeof v === 'string' && v.includes('調理中だった手順'))
      .map(([k]) => k)
    eq('KT-7 「調理中だった手順」という言い方が残っていない', stale, [])
    eq(
      'KT-7 言い直した先は、画面に出ているモードの名前で言う',
      [
        ja.cookNavi.sessionLost.includes('調理中モードで開いていた手順'),
        ja.cookNavi.reorderUndoAllConfirm.includes('調理中モードで開いている手順'),
        ja.cookNavi.restoreExpiredByDateCooking.includes('調理中モードで開いていた手順'),
      ],
      [true, true, true],
    )
  }

  // ---- KT-8: 「段取りを消す」の確認は2行だけ（規約Fの例外） ----
  // オーナー原文（差し戻しD）「文章が長くわかりづらいので。消える側は「段取りを消す」したら
  // 当然消えるとわかる範囲では？むしろ確認で説明が入った方が煩わしいかと」
  {
    const naviSrc = ktRead('src/pages/CookNaviPage.tsx')
    eq(
      'KT-8 消える側・残る側の並べ立ては ja.ts から消えている',
      ['discardTimelineGone', 'discardTimelineGoneLabel', 'discardTimelineKept', 'discardTimelineKeptLabel']
        .filter((k) => k in ja.cookNavi),
      [],
    )
    eq('KT-8 残すのはタイマーの一言だけ', ja.cookNavi.discardTimelineTimerNote, '動いているタイマーは残ります')
    eq(
      'KT-8 確認の窓は見出しとその一言だけ（箇条書きを渡していない）',
      /title: ja\.cookNavi\.discardTimelineConfirmTitle,\s*\n\s*body: ja\.cookNavi\.discardTimelineTimerNote,/.test(
        naviSrc,
      ),
      true,
    )
  }

  // ---- KT-6: まとめて献立を入力したときの数字を、すべて「品」でそろえる ----
  /*
   * オーナー原文:
   *   「昼と夕が埋まっている状態で朝昼夕表示の空いた枠だけまとめて献立を入力すると、
   *     「すでに決まっている１４食をそのままに１４食を〜」と間違った数字が表示された。
   *     すでに決まっているのは昼と夕28食（1品なしで）になるはずですよね？」
   *
   * 数字はどちらも正しかった（前者＝残す食事の数14、後者＝新しく入れた品数14）。
   * **単位の違う数が同じ文に並んでいた**のが原因なので、両方とも品で数える。
   * ここでは**枠の数と品数がわざと食い違う状況**を作り、出る文の数字が両方とも品数になることを見る。
   */
  {
    const week = ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']
    // 昼と夕に主菜＋副菜を手で入れてある＝14食事・28品。朝は空
    const entries = []
    let id = 1
    for (const date of week) {
      for (const slot of ['lunch', 'dinner']) {
        entries.push({ id: id++, date, slot, recipeId: id, role: 'main' })
        entries.push({ id: id++, date, slot, recipeId: id, role: 'side' })
      }
    }
    const plan = planWeekFill(entries, week, ['breakfast', 'lunch', 'dinner'], '2026-07-20', {
      keepAuto: true,
    })
    eq('KT-6 前提: 手つかずで残る食事は14（昼7＋夕7）', plan.preservedSlotKeys.size, 14)
    eq('KT-6 前提: 埋めるのは朝の7食事', plan.slotsToFill.length, 7)
    eq(
      'KT-6 「すでに入っている」は品で数える＝オーナーが数えた28がそのまま出る',
      preservedItemCount(plan, entries),
      28,
    )
    // 実際に入るのは主菜＋副菜で14品。文の中の2つの数字が「28品」「14品」になること
    const added = 14
    const toast = ja.mealPlan.fillWeekKeptManual
      .replace('{n}', String(preservedItemCount(plan, entries)))
      .replace('{a}', String(added))
    eq('KT-6 週タブの結果は「28品」「14品」（14と14が並ばない）', toast, 'すでに入っている28品はそのままにして、14品を新しく入れました')
    eq(
      'KT-6 その文に「食分」が混ざっていない（単位の違う数を並べない）',
      [ja.mealPlan.fillWeekKeptManual, ja.mealPlan.fillWeekNoRoom,
       ja.mealPlan.fillMonthKeptManual, ja.mealPlan.fillMonthNoRoom,
       ja.mealPlan.fillMonthConfirm, ja.mealPlan.fillMonthConfirmTitle,
       ja.mealPlan.templateApplyConfirm, ja.mealPlan.templateApplyConfirmTitle,
       ja.mealPlan.templateApplyNoRoom].filter((t) => t.includes('食分')),
      [],
    )
    /*
     * これから消して入れ直す行は「すでに入っている」に数えない。
     * 夕食に「手で入れた主菜」＋「自動で入った副菜」がある週で、副菜だけを振り直す形を作る
     *（週タブの再抽選＝keepAuto なし）。主菜7品は残り、副菜7品は消して入れ直すので、
     * 「すでに入っている」は7品。ここを entries の数（14）で数えると、消える品まで
     * 「そのままにします」と言うことになる
     */
    const mixed = []
    let mid = 500
    for (const date of week) {
      mixed.push({ id: mid++, date, slot: 'dinner', recipeId: mid, role: 'main' })
      mixed.push({ id: mid++, date, slot: 'dinner', recipeId: mid, role: 'side', auto: true })
    }
    const replan = planWeekFill(mixed, week, ['dinner'], '2026-07-20')
    eq('KT-6 前提: 自動で入った副菜7品は消して入れ直す', replan.entryIdsToRemove.length, 7)
    eq(
      'KT-6 これから消して入れ直す行は「すでに入っている」に数えない',
      preservedItemCount(replan, mixed),
      7, // 手で入れた主菜7品だけ
    )
    // 月タブ・テンプレも同じ数え方（片方だけ直すと週と月で数え方が違う混乱になる）
    eq(
      'KT-6 月タブの結果も同じ言い方',
      ja.mealPlan.fillMonthKeptManual.replace('{n}', '28').replace('{a}', '14'),
      'すでに入っている28品はそのままにして、14品を新しく入れました',
    )
    eq(
      'KT-6 画面が品で数える関数を使っている（枠の数をそのまま出していない）',
      [
        /const preserved = preservedItemCount\(plan, entries \?\? \[\]\)/.test(ktRead('src/pages/MealPlanPage.tsx')),
        /const preserved = preservedItemCount\(plan, monthEntries \?\? \[\]\)/.test(ktRead('src/pages/MealPlanPage.tsx')),
        ktRead('src/pages/MealPlanPage.tsx').includes('plan.keptItemCount'),
      ],
      [true, true, true],
    )
  }

  /* ---- KT-10: 「先にできた品が待つことになる」警告は、分数抜きで残す（司令部裁定）----
   *
   * 便KQが直前に、熱い品が1つだけの組の放置を 15組→7組 に減らした。残る7組は
   * **熱い品が2つあって物理的に避けられない**組で、そこでは実際に置いたままになる。
   * オーナーの削除理由（「個人の手のスピードや状況によってすぐに変わる」）は
   * **分数の予測**への指摘であって、この事実には当たらない。
   *
   * ここが見張るのは2つ:
   *   ①分数を書いていない（差し込み口も、分の言い回しも持たない）＝数字を戻す便を止める
   *   ②開きが大きい組では出て、そうでない組・冷たい品が先の組では出ない
   */
  {
    const naviSrc = ktRead('src/pages/CookNaviPage.tsx')
    eq(
      'KT-10 警告に分数を書かない（差し込み口を持たない）',
      /\{n\}|分/.test(ja.cookNavi.finishWaitNote),
      false,
    )
    eq(
      'KT-10 どの品がどの品を待つのかは名前で書く（「その間」だけにしない）',
      ja.cookNavi.finishWaitNote.includes('{first}') && ja.cookNavi.finishWaitNote.includes('{last}'),
      true,
    )
    eq(
      'KT-10 消した「約◯分あきます」の言い方は戻っていない',
      Object.values(ja.cookNavi).filter((v) => typeof v === 'string' && v.includes('あきます')),
      [],
    )
    // 出す条件は docs/72 N1 と同じ物差し（logic/cookFinish.ts）から取っていること
    eq(
      'KT-10 出す条件はロジック側の線（isFinishSpreadWide）で決めている',
      naviSrc.includes('isFinishSpreadWide(gap.minutes, timeline.totalMinutes)'),
      true,
    )
    eq(
      'KT-10 先にできる品が冷たいまま出す品なら出さない（そう組んでいるので咎めない）',
      /gap\.first\.cold\) return null/.test(naviSrc),
      true,
    )
    // 線そのものの通り方（全体30分・開き20分＝大きい／開き5分＝大きくない）
    const { isFinishSpreadWide: ktWide, finishSpread: ktSpread } = await import('../../src/logic/cookFinish.ts')
    const ktHotPair = [
      { recipeId: 1, minutes: 10, cold: false },
      { recipeId: 2, minutes: 30, cold: false },
    ]
    eq(
      'KT-10 熱い品が2つで開きが大きい組は「出す」側になる（便KQで残る7組の形）',
      ktWide(ktSpread(ktHotPair).minutes, 30) && !ktSpread(ktHotPair).first.cold,
      true,
    )
    eq(
      'KT-10 開きが小さい組は出さない（全部の組に出すと読まれなくなる）',
      ktWide(
        ktSpread([
          { recipeId: 1, minutes: 27, cold: false },
          { recipeId: 2, minutes: 30, cold: false },
        ]).minutes,
        30,
      ),
      false,
    )
    eq(
      'KT-10 先にできるのが冷たい品なら、開きが大きくても出さない',
      ktSpread([
        { recipeId: 1, minutes: 10, cold: true },
        { recipeId: 2, minutes: 30, cold: false },
      ]).first.cold,
      true,
    )
  }

  // ---- KT-9: 使い方ページが、アプリに無い文言を説明していない ----
  {
    const manual = ktRead('public/about/manual.html')
    eq(
      'KT-9 消した文言が使い方ページに残っていない',
      ['できあがりの目安', '1品だけなら約', '一致しません', 'あと◯回', 'すでに決まっている◯食分'].filter((t) =>
        manual.includes(t),
      ),
      [],
    )
    eq('KT-9 新しい言い方に差し替わっている', manual.includes('単品で約◯分'), true)
  }
}


// ---------- 便LB（2026-08-26）: 「ピザ用チーズ」をゴーダで代表する（オーナー裁定） ----------
// オーナーの回答（2026-08-26）: 「**ゴーダチーズで**」
//
// 【何が起きていたか】八訂に「ピザ用チーズ」の収載は無く、名前に「チーズ」が入っているだけで
// プロセスチーズ(13040・313kcal・食塩2.8g/100g)の値が使われていた。売り場のピザ用チーズは
// 加熱で溶けるナチュラルチーズのシュレッドで、八訂の同じ形の収載はゴーダ(13036・356kcal)と
// チェダー(13037・390kcal)。どちらで代表するかは判断になるためオーナーに諮り、ゴーダに決まった。
//
// 【動いた品】同梱109品で「ピザ用チーズ」を使うのは**豆腐グラタン1品だけ**（40g・2人分）。
// 1人分: 262→271kcal ／ たんぱく質21.4→22.0g ／ 脂質16.3→16.9g ／ 食塩相当量1.5→1.3g ／
// カルシウム379→389mg（炭水化物13.9g・食物繊維5.4g・鉄4.1mgは変わらず）。
// スナップショット(scripts/data/nutrition-smoke-snapshot.json)を更新した理由は
// scripts/test-nutrition.mjs の「3. スナップショット照合」のコメントにも残してある。
{
  const { matchNutritionFood: lbFood, computeRecipeNutrition: lbNut } = await import(
    '../../src/logic/nutrition.ts'
  )
  const { starterDefs: lbStarters } = await import('../../src/db/starters.ts')
  const { matchPriceEntry: lbMatchPrice } = await import('../../src/logic/priceEstimate.ts')
  const lbIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lbId = (name) => lbFood(name)?.id ?? null
  const lbPrice = (name) => {
    const hit = lbMatchPrice(name, lbIndex)
    return hit ? `${hit.normalizedName} ${hit.pricePerUnit}円/${hit.unit}` : null
  }

  // --- LB-1: 当たり先と、公式Excelから読んだ値そのもの ---
  eq('LB-1 ピザ用チーズは13036「ナチュラルチーズ ゴーダ」', lbId('ピザ用チーズ'), '13036')
  eq('LB-1 収載名も公式のまま', lbFood('ピザ用チーズ')?.mextName.includes('ゴーダ'), true)
  eq('LB-1 ゴーダの値は八訂そのまま（356kcal・食塩2.0g/100g）', [
    lbFood('ピザ用チーズ')?.per100g.kcal, lbFood('ピザ用チーズ')?.per100g.saltG,
  ], [356, 2])
  eq('LB-1 プロセスチーズ(13040)より高カロリーで、塩分は少ない', [
    lbFood('ピザ用チーズ')?.per100g.kcal > lbFood('スライスチーズ')?.per100g.kcal,
    lbFood('ピザ用チーズ')?.per100g.saltG < lbFood('スライスチーズ')?.per100g.saltG,
  ], [true, true])

  // --- LB-2: 同じものを指す書き方が、まとめて同じ食品に当たる ---
  // 直す前はどれもプロセスチーズ(13040)に流れていた（栄養）／価格は「分からない」だった
  eq('LB-2 シュレッド・とろける・ミックス・ピザチーズは同じゴーダ', [
    lbId('シュレッドチーズ'), lbId('とろけるチーズ'), lbId('溶けるチーズ'), lbId('とけるチーズ'),
    lbId('ミックスチーズ'), lbId('ピザチーズ'), lbId('とろけるミックスチーズ'),
  ], ['13036', '13036', '13036', '13036', '13036', '13036', '13036'])
  eq('LB-2 「ゴーダ」「ゴーダチーズ」も同じ（代表ではなく、そのものの名前）', [
    lbId('ゴーダ'), lbId('ゴーダチーズ'),
  ], ['13036', '13036'])
  // スライスは実際にプロセスチーズなので、この当たり方が正しい（末尾の語が先に当たる）
  eq('LB-2 「とろけるスライスチーズ」はプロセスチーズのまま', [
    lbId('とろけるスライスチーズ'), lbId('スライスチーズ'), lbId('チーズ'),
  ], ['13040', '13040', '13040'])
  eq('LB-2 便KYが分けたチーズは巻き込まれていない', [
    lbId('粉チーズ'), lbId('クリームチーズ'), lbId('マスカルポーネ'),
  ], ['13038', '13035', '13055'])
  // 価格側: 成分表の食品名を経由して「ピザ用チーズ」の行に届く（直す前は全部「価格なし」）
  // 2026-08-26 便LF: 目安価格を 300→530円/200g に直したので、期待値もそろえた。
  // 見ているのは「書き方ちがいでも同じ1行に届くこと」なので、値そのものが変わっても検査の意味は同じ。
  // 530円の根拠（2店の棚のシュレッドチーズ10件を200g換算した中央値536円・調べた日 2026-08-26）は
  // src/data/priceDefaults.ts のピザ用チーズの行のコメント
  eq('LB-2 書き方ちがいでも原価が出る', [
    lbPrice('シュレッドチーズ'), lbPrice('とろけるチーズ'), lbPrice('ミックスチーズ'),
  ], ['ピザ用チーズ 530円/200g', 'ピザ用チーズ 530円/200g', 'ピザ用チーズ 530円/200g'])
  eq('LB-2 「粉チーズ」の価格行は別のまま（振りかける粉で別物）', lbPrice('粉チーズ'), '粉チーズ 620円/80g')

  // --- LB-3: 動いた品の数字そのもの（1人分）。ここが変わったらスナップショットも一緒に見る ---
  {
    const gratin = lbStarters.find((d) => d.title === '豆腐グラタン')
    eq('LB-3 豆腐グラタンは同梱レシピにある', gratin != null, true)
    const cheeseRows = lbStarters.filter((d) =>
      (d.ingredients ?? []).some((i) => i.name === 'ピザ用チーズ'),
    )
    eq('LB-3 ピザ用チーズを使う同梱レシピは豆腐グラタン1品だけ', cheeseRows.map((d) => d.title), ['豆腐グラタン'])
    const r = lbNut(gratin)
    const per = r.perServing
    const r1 = (v) => Math.round(v * 10) / 10
    eq('LB-3 1人分のエネルギーは271kcal（旧262kcal）', Math.round(per.kcal), 271)
    eq('LB-3 1人分のたんぱく質は22.0g（旧21.4g）', r1(per.proteinG), 22)
    eq('LB-3 1人分の脂質は16.9g（旧16.3g）', r1(per.fatG), 16.9)
    eq('LB-3 1人分の食塩相当量は1.3g（旧1.5g。ゴーダのほうが塩分が少ない）', r1(per.saltG), 1.3)
    eq('LB-3 1人分のカルシウムは389mg（旧379mg）', Math.round(per.calciumMg), 389)
    eq('LB-3 炭水化物・食物繊維・鉄は動いていない', [
      r1(per.carbG), r1(per.fiberG), r1(per.ironMg),
    ], [13.9, 5.4, 4.1])
    eq('LB-3 計算に含めていない材料は増えていない', r.excluded.map((e) => e.name), [])
  }

  // --- LB-4: ぶどう酒の白と赤（八訂に実収載があるのに「分からない」に落ちていた） ---
  eq('LB-4 白ワインは16010「ぶどう酒 白」', lbId('白ワイン'), '16010')
  eq('LB-4 赤ワインは16011「ぶどう酒 赤」', lbId('赤ワイン'), '16011')
  eq('LB-4 値は八訂そのまま（白75kcal・赤68kcal／どちらも食塩0g）', [
    lbFood('白ワイン')?.per100g.kcal, lbFood('赤ワイン')?.per100g.kcal,
    lbFood('白ワイン')?.per100g.saltG, lbFood('赤ワイン')?.per100g.saltG,
  ], [75, 68, 0, 0])
  eq('LB-4 「白ぶどう酒」は日本酒(16001)ではなく白ワイン', lbId('白ぶどう酒'), '16010')
  eq('LB-4 ワインビネガーは今までどおり果実酢(17017)。ワインに寄らない', [
    lbId('ワインビネガー'), lbId('白ワインビネガー'), lbId('赤ワインビネガー'),
  ], ['17017', '17017', '17017'])
  // 素の「ワイン」は赤と白のどちらか名前だけでは決まらないので、当てない（便KX「みそ汁の素」と同じ筋）
  eq('LB-4 素の「ワイン」はどちらにも寄せない', lbFood('ワイン'), null)
  eq('LB-4 「酒」「料理酒」は今までどおり清酒', [lbId('酒'), lbId('料理酒')], ['16001', '16001'])
}


// ---------- 便LD（2026-08-26）: 八訂の（チーズ類）15品を全部持つ ----------
// 【何が起きていたか】八訂（増補2023）の（チーズ類）は 13031〜13041・13055〜13058 の**15品**。
// アプリが持っていたのは5品（プロセス13040・パルメザン13038・クリーム13035・
// マスカルポーネ13055・ゴーダ13036）だけで、残り10品は次のどちらかになっていた:
//   ①名前に「チーズ」が入っているだけで**プロセスチーズ(13040)の値**が使われる
//     （モッツァレラチーズ・チェダーチーズ・カマンベールチーズ ほか）
//   ②「チーズ」を付けずに書くと当たらず、無言で計算から外れる（モッツァレラ・チェダー ほか）
// **同じチーズでも「チーズ」を付けて書いたかどうかで結果が変わる**のがそもそもおかしい。
// とくにモッツァレラは食塩相当量が 0.2g → 2.8g/100g ＝ **14倍**、
// カッテージチーズはエネルギーが 99 → 313kcal ＝ **3.2倍**で出ていた。
//
// 【直し方】八訂に実収載がある10品を足した（成分値は公式Excelから機械抽出・手打ちなし）。
// 収載が無いもの（さけるチーズ・ベビーチーズ・6Pチーズ・クワルク・チーズフォンデュ用チーズ）は
// **足さない**。プロセスチーズに当たる書き方はそのままにしてある——ベビーチーズ・6Pチーズは
// 実際にプロセスチーズなので、この当たり方が正しい。
//
// 【同梱109品】チーズを使う行は**豆腐グラタンの「ピザ用チーズ 40g」1行だけ**で、
// これは便LBがゴーダに直した分。よってこの便でスナップショットは1品も動いていない。
{
  const { matchNutritionFood: ldFood } = await import('../../src/logic/nutrition.ts')
  const { starterDefs: ldStarters } = await import('../../src/db/starters.ts')
  const { NUTRITION_DATA: ldData } = await import('../../src/logic/nutritionData.ts')
  const { matchPriceEntry: ldMatchPrice } = await import('../../src/logic/priceEstimate.ts')
  const ldIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const ldId = (name) => ldFood(name)?.id ?? null
  const ldKcalSalt = (name) => {
    const f = ldFood(name)
    return f ? [f.per100g.kcal, f.per100g.saltG] : null
  }

  // --- LD-1: 八訂の（チーズ類）を1品残らず持っている ---
  // 番号は公式の収載順（13031〜13041・13055〜13058）。ここが減ったら「分からない」か
  // 「プロセスチーズの値」に逆戻りしたということ
  {
    const cheeseIds = ldData.foods
      .filter((f) => f.mextName.includes('（チーズ類）'))
      .map((f) => f.id)
      .sort()
    eq('LD-1 八訂の（チーズ類）15品をすべて持っている', cheeseIds, [
      '13031', '13032', '13033', '13034', '13035', '13036', '13037', '13038',
      '13039', '13040', '13041', '13055', '13056', '13057', '13058',
    ])
    eq('LD-1 件数は15品', cheeseIds.length, 15)
  }

  // --- LD-2: モッツァレラ（この便の発端。食塩が14倍で出ていた） ---
  eq('LD-2 モッツァレラは13056「ナチュラルチーズ モッツァレラ」', ldId('モッツァレラチーズ'), '13056')
  eq('LD-2 値は八訂そのまま（269kcal・食塩0.2g/100g）', ldKcalSalt('モッツァレラチーズ'), [269, 0.2])
  eq('LD-2 プロセスチーズ(13040)の食塩2.8g/100gではない', ldKcalSalt('プロセスチーズ'), [313, 2.8])
  // 100g使うと食塩相当量が2.6g違う。1日の目標7.5gの3分の1にあたる
  eq('LD-2 100gあたりの食塩の差は2.6g', Math.round((2.8 - 0.2) * 10) / 10, 2.6)
  eq('LD-2 「チーズ」を付けても付けなくても同じ食品に当たる', [
    ldId('モッツァレラ'), ldId('モッツァレラチーズ'),
    ldId('フレッシュモッツァレラ'), ldId('モッツァレラチーズ（生）'),
  ], ['13056', '13056', '13056', '13056'])
  // 小さい「ァ」と大きい「ア」は正規化しても別の読みになるので、別名を分けて持っている
  eq('LD-2 「モッツアレラ」（大きいア）も同じ食品', [
    ldId('モッツアレラ'), ldId('モッツアレラチーズ'),
  ], ['13056', '13056'])

  // --- LD-3: チェダー ---
  eq('LD-3 チェダーは13037「ナチュラルチーズ チェダー」', ldId('チェダーチーズ'), '13037')
  eq('LD-3 値は八訂そのまま（390kcal・食塩2.0g/100g）', ldKcalSalt('チェダーチーズ'), [390, 2])
  eq('LD-3 「チェダー」だけでも当たる', ldId('チェダー'), '13037')
  eq('LD-3 便LBがゴーダで代表した「ピザ用チーズ」とは別の食品', [
    ldId('ピザ用チーズ'), ldId('チェダーチーズ'),
  ], ['13036', '13037'])

  // --- LD-4: 残りの8品も「チーズ」の有無で結果が変わらない ---
  eq('LD-4 カマンベール', [ldId('カマンベール'), ldId('カマンベールチーズ')], ['13034', '13034'])
  eq('LD-4 カマンベールの値（291kcal・食塩2.0g/100g）', ldKcalSalt('カマンベールチーズ'), [291, 2])
  // 八訂の収載名は「カテージ」。売り場の書き方3つとも同じ食品に当てる
  eq('LD-4 カッテージ／カテージ／コテージは同じ13033', [
    ldId('カッテージチーズ'), ldId('カテージチーズ'), ldId('コテージチーズ'),
  ], ['13033', '13033', '13033'])
  // 低脂肪で選ばれるチーズなのに、直す前は3.2倍のカロリーで出ていた
  eq('LD-4 カッテージチーズは99kcal・食塩1.0g/100g', ldKcalSalt('カッテージチーズ'), [99, 1])
  eq('LD-4 ブルーチーズとゴルゴンゾーラは13039', [
    ldId('ブルーチーズ'), ldId('ゴルゴンゾーラ'),
  ], ['13039', '13039'])
  // 八訂のチーズ類でパルメザンと並んでいちばん塩分が高い。直す前は1.0g少なく出ていた
  eq('LD-4 ブルーチーズは326kcal・食塩3.8g/100g', ldKcalSalt('ブルーチーズ'), [326, 3.8])
  eq('LD-4 リコッタ', [ldId('リコッタ'), ldId('リコッタチーズ')], ['13058', '13058'])
  eq('LD-4 リコッタは159kcal・食塩0.4g/100g', ldKcalSalt('リコッタチーズ'), [159, 0.4])
  eq('LD-4 エダム', [ldId('エダム'), ldId('エダムチーズ')], ['13031', '13031'])
  eq('LD-4 エメンタール', [ldId('エメンタール'), ldId('エメンタールチーズ')], ['13032', '13032'])
  eq('LD-4 エメンタールは398kcal・食塩1.3g/100g', ldKcalSalt('エメンタールチーズ'), [398, 1.3])
  eq('LD-4 やぎチーズとシェーヴル', [
    ldId('やぎチーズ'), ldId('シェーヴルチーズ'), ldId('シェーブルチーズ'),
  ], ['13057', '13057', '13057'])
  eq('LD-4 チーズスプレッド', ldId('チーズスプレッド'), '13041')

  // --- LD-5: パルミジャーノ（パルメザンのイタリア語名。八訂の収載は13038だけ） ---
  eq('LD-5 パルミジャーノは13038「ナチュラルチーズ パルメザン」', [
    ldId('パルミジャーノ'), ldId('パルミジャーノレッジャーノ'), ldId('パルミジャーノ・レッジャーノ'),
  ], ['13038', '13038', '13038'])
  eq('LD-5 既存の「粉チーズ」「パルメザン」と同じ行のまま', [
    ldId('粉チーズ'), ldId('パルメザンチーズ'),
  ], ['13038', '13038'])
  eq('LD-5 価格も既存の粉チーズの行に届く', (() => {
    const hit = ldMatchPrice('パルミジャーノ', ldIndex)
    return hit ? `${hit.normalizedName} ${hit.pricePerUnit}円/${hit.unit}` : null
  })(), '粉チーズ 620円/80g')

  // --- LD-6: 八訂に収載が無いものは足さない（「分からない」と出すほうが正しい＝規約） ---
  // ベビーチーズ・6Pチーズ・さけるチーズは商品名で、八訂に同じ名前の収載が無い。
  // プロセスチーズに当たるのは正しい（実際にプロセスチーズ、またはその近縁の加工品）ので触らない
  eq('LD-6 商品名の書き方はプロセスチーズのまま', [
    ldId('ベビーチーズ'), ldId('6Pチーズ'), ldId('さけるチーズ'), ldId('スライスチーズ'), ldId('チーズ'),
  ], ['13040', '13040', '13040', '13040', '13040'])
  // 「とろけるスライスチーズ」は末尾の「スライスチーズ」が先に当たる（便LBの判断のまま）
  eq('LD-6 とろけるスライスチーズはプロセスチーズのまま', ldId('とろけるスライスチーズ'), '13040')
  // クワルクは八訂に収載が無い。作らずに「分からない」のままにする
  eq('LD-6 クワルクは当てない', ldFood('クワルク'), null)

  // --- LD-7: 他の食材を巻き込んでいない ---
  // 「ブルー」を素の別名にすると部分一致で「ブルーベリー」を巻き込むので、入れていない
  eq('LD-7 ブルーベリーは果物のまま', [
    ldId('ブルーベリー'), ldId('ブルーベリージャム'),
  ], ['07124', '07124'])
  eq('LD-7 便KY・便LBが分けたチーズは動いていない', [
    ldId('粉チーズ'), ldId('クリームチーズ'), ldId('マスカルポーネ'), ldId('ピザ用チーズ'),
  ], ['13038', '13035', '13055', '13036'])
  eq('LD-7 チーズと無関係な食材も動いていない', [
    ldId('枝豆'), ldId('牛乳'), ldId('バター'),
  ], ['06015', '13003', '14017'])

  // --- LD-8: 同梱109品は1品も動かない（チーズを使う行が1つしかないため） ---
  {
    const cheeseRows = []
    for (const d of ldStarters) {
      for (const ing of d.ingredients ?? []) {
        if (ing.name.includes('チーズ')) cheeseRows.push(`${d.title}／${ing.name}`)
      }
    }
    eq('LD-8 同梱109品でチーズを使う行は豆腐グラタンの1行だけ', cheeseRows, ['豆腐グラタン／ピザ用チーズ'])
    eq('LD-8 その1行は便LBのピザ用チーズ（この便では動かない）', ldId('ピザ用チーズ'), '13036')
  }

  // --- LD-9: 成分表の版番号を上げた（端末側の作り直しの合図） ---
  eq('LD-9 成分表の版は14', ldData.dbVersion, 14)
}
