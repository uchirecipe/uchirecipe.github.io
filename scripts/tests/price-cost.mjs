// 価格と原価（価格マスタ・単位換算・目安価格の更新）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import { scaleAmount } from '../../src/logic/amount.ts'
import { resolveCalcAmount } from '../../src/logic/amount.ts'
import { parseRecipeText, isImportGomiLine } from '../../src/logic/parseRecipeText.ts'
import { toHiragana } from '../../src/logic/kana.ts'
import { READINGS_VERSION } from '../../src/logic/ingredientReadings.ts'
import { convertToGrams } from '../../src/logic/nutrition.ts'
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
import {
  PRICE_DEFAULTS_VERSION as PRICE_DEFAULTS_VERSION_FOR_JG,
  PRICE_DEFAULT_MERGES as PRICE_DEFAULT_MERGES_FOR_JG,
} from '../../src/data/priceDefaults.ts'
// 便JI: 「最新の目安価格に更新する」の計画づくり（画面にもDexieにも触らない純ロジック）
import {
  planPriceRefresh,
  priceRefreshConfirm,
  normalizePriceName,
} from '../../src/logic/priceRefresh.ts'
import { buildShoppingCandidates } from '../../src/logic/shopping.ts'
import { NUTRITION_DATA } from '../../src/logic/nutritionData.ts'
import {
  buildPriceIndex,
  matchPriceEntry,
  estimateIngredientYen,
  estimateRecipeCost,
  estimateIngredientRowCost,
  sumMealPlanEntriesCost,
  pricelessIngredientNames,
  pricelessIngredientNamesOfRecipes,
  sumCookedRecipesCost,
  normalizeIngredientNameForPrice,
  recipeCostConfidence,
} from '../../src/logic/priceEstimate.ts'
import * as priceEstimateModule from '../../src/logic/priceEstimate.ts'
import {
  splitRangeByToday,
  rangeBasisParts,
  summarizeRangeIntake,
  rangeIntakeRecipes,
  dayIntakeMap,
} from '../../src/logic/rangeSummary.ts'
import { vegetableGrams } from '../../src/logic/nutritionBalance.ts'
import { normalizeUnit, parseUnitQuantity } from '../../src/logic/unitGrams.ts'
import { KNOWN_UNITS, OTHER_UNIT, decomposeUnit, composeUnit } from '../../src/logic/unitForm.ts'
import { pickDisplayIngredientChips } from '../../src/logic/mainIngredients.ts'
import { starterDefs } from '../../src/db/starters.ts'
import { splitTermDescription, termDescriptionLines } from '../../src/logic/termSplit.ts'
import { COOKING_TERMS } from '../../src/data/cookingTerms.ts'
import {
  splitIngredientAmount,
  normalizeInstructions,
} from '../../workers/recipe-import/src/normalize.ts'
import { buildImportedIngredientRows } from '../../src/logic/urlImportRows.ts'
import { ja } from '../../src/i18n/ja.ts'
import { confirmContentText } from '../../src/logic/confirmContent.ts'
// 便JK: 写真の見える範囲（2026-08-22 オーナー「ゆーざーが見える範囲を微調整
// （トリミングっぽい感じ）できたら嬉しい」）
import {
  PHOTO_FOCUS_CENTER,
  clampPhotoFocus,
  isPhotoFocusCentered,
  movePhotoFocus,
  photoObjectPosition,
  photoVisibleRect,
  toStoredPhotoFocus,
} from '../../src/logic/photoFocus.ts'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'

// ---------- 食材価格マスタのフォールバック計算(docs/20 §3・2026-07-12) ----------
eq('normalizeIngredientNameForPrice 括弧除去', normalizeIngredientNameForPrice('甘塩鮭（切り身）'), '甘塩鮭')
eq('normalizeIngredientNameForPrice 前後空白除去', normalizeIngredientNameForPrice(' 玉ねぎ '), '玉ねぎ')

{
  const index = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
    { name: '鶏もも肉', pricePerUnit: 130, unit: '100g' },
  ])
  eq(
    'matchPriceEntry 括弧付き材料名の完全一致',
    matchPriceEntry('玉ねぎ（みじん切り）', index)?.normalizedName,
    '玉ねぎ',
  )
  eq(
    'matchPriceEntry 前方一致(材料名がマスタ名で始まる)',
    matchPriceEntry('玉ねぎ薄切り', index)?.normalizedName,
    '玉ねぎ',
  )
  eq('matchPriceEntry 一致なし', matchPriceEntry('謎の食材', index), undefined)

  // isDefault未指定はbuildPriceIndexで安全側(false='user')に丸められる(2026-07-13追加)
  eq(
    'estimateIngredientYen 数量・単位が噛み合えば按分(300g/100gあたり130円→390円)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '300', unit: 'g' }, index),
    { yen: 390, rawYen: 390, source: 'user' },
  )
  eq(
    'estimateIngredientYen 個数系も按分(2個/1個あたり50円→100円)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '2', unit: '個' }, index),
    { yen: 100, rawYen: 100, source: 'user' },
  )
  // 2026-08-23 便KE: 販売単位(100g)で登録した食材は、分量が読めないときに金額を出さない
  // （満額＝買ってきた100gぶんを1行に乗せると桁で外れるため。「価格が分からない材料」に数える）
  eq(
    'estimateIngredientYen 非数値の分量(少々)は、販売単位のマスタなら金額を出さない(便KE)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '少々', unit: 'g' }, index),
    undefined,
  )
  eq(
    'estimateIngredientYen 単位が噛み合わない場合はマスタの金額をそのまま使う',
    estimateIngredientYen({ name: '玉ねぎ', amount: '200', unit: 'g' }, index),
    { yen: 50, rawYen: 50, source: 'user' },
  )
  eq(
    'estimateIngredientYen マスタに無い食材はundefined',
    estimateIngredientYen({ name: '謎の食材', amount: '1', unit: '個' }, index),
    undefined,
  )

  eq(
    'estimateRecipeCost 優先度: 個別入力>マスタ>なし',
    estimateRecipeCost(
      [
        { name: '玉ねぎ', amount: '1', unit: '個', price: 80 }, // 個別入力(80円)がマスタ(50円)より優先
        { name: '鶏もも肉', amount: '200', unit: 'g' }, // 未入力→マスタで按分(130*2=260円)
        { name: '謎の食材', amount: '1', unit: '個' }, // マスタにも無いので計算対象外
      ],
      index,
    ),
    { total: 340, fromMasterCount: 1, hasAnyPriceInfo: true },
  )
  eq(
    'estimateRecipeCost 価格情報が1件も無ければhasAnyPriceInfo=false',
    estimateRecipeCost([{ name: '謎の食材', amount: '1', unit: '個' }], index),
    { total: 0, fromMasterCount: 0, hasAnyPriceInfo: false },
  )

  // estimateIngredientRowCost(2026-07-20 便AJ「原価ビュー」再改修・docs/45): 材料行の
  // 「1食あたりの按分原価」(estimateIngredientYen(全量)÷servingsを四捨五入)
  eq(
    'estimateIngredientRowCost マスタ一致(300g/100gあたり130円→390円)を4人分で割る(97.5→98円)',
    estimateIngredientRowCost({ name: '鶏もも肉', amount: '300', unit: 'g' }, index, 4),
    { totalYen: 390, perServingYen: 98, shownYen: 390 },
  )
  eq(
    'estimateIngredientRowCost 個別入力(ing.price)はマスタより優先される',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個', price: 80 }, index, 2),
    { totalYen: 80, perServingYen: 40, shownYen: 80 },
  )
  eq(
    'estimateIngredientRowCost 四捨五入で1円未満(0.5円未満)は0円(呼び出し側が「1円未満」表示する契機)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '2', unit: '個' }, index, 250),
    { totalYen: 100, perServingYen: 0, shownYen: 100 }, // 100÷250=0.4→0
  )
  eq(
    'estimateIngredientRowCost 0.5円ちょうどは四捨五入で1円(境界値)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個' }, index, 100),
    { totalYen: 50, perServingYen: 1, shownYen: 50 }, // 50÷100=0.5→1
  )
  eq(
    'estimateIngredientRowCost マスタにも個別入力にも無い材料はundefined',
    estimateIngredientRowCost({ name: '謎の食材', amount: '1', unit: '個' }, index, 2),
    undefined,
  )
  eq(
    'estimateIngredientRowCost servings=0はtotalYenをそのまま返す(0除算回避)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個' }, index, 0),
    { totalYen: 50, perServingYen: 50, shownYen: 50 },
  )

  // COST-02(2026-07-28 便BY): 「価格なし」と「1円未満」の混線を解消する。
  // マスタに価格があるのに按分額が0.5円未満へ丸まる材料まで undefined を返しており、
  // UIが「価格なし ＋登録」と出していた(登録済みの砂糖・塩に対する誤ったシグナル。同梱103品で14行)
  {
    const seasoningIndex = buildPriceIndex([
      { name: '砂糖', pricePerUnit: 2, unit: '大さじ1' },
      { name: '塩', pricePerUnit: 1, unit: '小さじ1' },
    ])
    eq(
      'COST-02: 砂糖 小さじ1/2(=0.33円)はundefinedではなく0円で返す(呼び出し側が「1円未満」を出す)',
      estimateIngredientRowCost({ name: '砂糖', amount: '1/2', unit: '小さじ' }, seasoningIndex, 2),
      { totalYen: 0, perServingYen: 0, shownYen: 0 },
    )
    eq(
      'COST-02: 塩 小さじ1/4(=0.25円)も同じく0円で返す',
      estimateIngredientRowCost({ name: '塩', amount: '1/4', unit: '小さじ' }, seasoningIndex, 2),
      { totalYen: 0, perServingYen: 0, shownYen: 0 },
    )
    eq(
      'COST-02: マスタに無い材料は従来どおりundefined(=「価格なし」のまま)',
      estimateIngredientRowCost({ name: '水', amount: '300', unit: 'ml' }, seasoningIndex, 2),
      undefined,
    )
    // 二重丸めの解消: 従来は estimateIngredientYen で円に丸めてから servings で割っていた
    eq(
      'COST-02: 二重丸めをやめる(0.33円を2人で割っても合計は丸め前から計算する)',
      estimateIngredientRowCost({ name: '砂糖', amount: '1', unit: '小さじ' }, seasoningIndex, 2),
      { totalYen: 1, perServingYen: 0, shownYen: 1 }, // 0.667円→合計1円・1食あたり0.33円→0(1円未満)
    )
    // 合計金額(estimateRecipeCost)は1円も変わらないこと
    eq(
      'COST-02: 合計計算は従来どおり四捨五入後のyenを使う(表示金額を動かさない)',
      estimateRecipeCost([{ name: '砂糖', amount: '1/2', unit: '小さじ' }], seasoningIndex).total,
      0,
    )
  }

  // sumMealPlanEntriesCost(2026-07-17 便AB・docs/35 §5「期間の食費」): 週の概算食費と
  // 期間の食費が共通で使う、mealPlansエントリ群の合算ロジック。
  // 2026-07-28 便CAで personalTotal(1人分の合計)と dishCount(品数)を追加したため、
  // 期待値オブジェクトにその2項目を足している。
  // 2026-08-03 便DKで total が「作る食数ぶん」になり servingsTotal(数えた食数の合計)が増えたが、
  // 食数を1つも触らず「ふだん作る人数」も渡さない下の各ケースの total は従来と同じ値のまま
  // (＝後方互換の見張り。値が動いたらここが落ちる)
  {
    const recipeById = new Map([
      [1, { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 }], // 全量50円
      [2, { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 }], // 全量260円
      [3, { ingredients: [{ name: '謎の食材', amount: '1', unit: '個' }], servings: 2 }], // 計算対象外(0円)
      [4, { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }], // servings未指定=1人分扱い
    ])
    eq(
      'sumMealPlanEntriesCost: 複数エントリ(同じレシピの重複含む)を合算する',
      sumMealPlanEntriesCost(
        [{ recipeId: 1 }, { recipeId: 2 }, { recipeId: 1 }],
        recipeById,
        index,
      ),
      {
        total: 50 + 260 + 50,
        fromMasterCount: 3,
        servingsTotal: 6,
        personalTotal: 25 + 130 + 25,
        dishCount: 3,
      },
    )
    eq(
      'sumMealPlanEntriesCost: 価格情報のないレシピは0円扱いで合計に影響しない',
      sumMealPlanEntriesCost([{ recipeId: 3 }], recipeById, index),
      { total: 0, fromMasterCount: 0, servingsTotal: 2, personalTotal: 0, dishCount: 1 },
    )
    eq(
      'sumMealPlanEntriesCost: recipeByIdに無いエントリ(削除済みレシピ等の孤児行)はスキップする',
      sumMealPlanEntriesCost([{ recipeId: 999 }, { recipeId: 1 }], recipeById, index),
      { total: 50, fromMasterCount: 1, servingsTotal: 2, personalTotal: 25, dishCount: 1 },
    )
    eq('sumMealPlanEntriesCost: エントリ0件は0円', sumMealPlanEntriesCost([], recipeById, index), {
      total: 0,
      fromMasterCount: 0,
      servingsTotal: 0,
      personalTotal: 0,
      dishCount: 0,
    })
    eq(
      'sumMealPlanEntriesCost(便CA): 1人分は「全量÷登録人数」を1品1回だけ足す(何食分作るかでは増えない)',
      sumMealPlanEntriesCost([{ recipeId: 1 }], recipeById, index).personalTotal,
      25,
    )
    eq(
      'sumMealPlanEntriesCost(便CA): 登録人数が分からないレシピは1人分として扱う',
      sumMealPlanEntriesCost([{ recipeId: 4 }], recipeById, index).personalTotal,
      50,
    )

    // ---- 2026-08-03 便DK: 概算食費の食数連動 ----
    // オーナー確定「3人家族なら予算や買い物メモは3人分で計算した数値が必要。栄養は1人当たりのみで十分」。
    // 再発防止の要点は3つ: ①後方互換(未設定なら1円も変わらない) ②優先順位(枠>設定>レシピ)
    // ③1人分(personalTotal)は食数で動かない(栄養と対の数字なので連動させない)
    eq(
      'DK-COST 後方互換: 食数もふだん作る人数も無ければ従来と同じ金額(登録人数分)',
      sumMealPlanEntriesCost([{ recipeId: 1 }, { recipeId: 2 }], recipeById, index, undefined).total,
      50 + 260,
    )
    eq(
      'DK-COST ふだん作る人数3人分＝1人分の単価×3で数える(登録2人分の玉ねぎ50円→75円)',
      sumMealPlanEntriesCost([{ recipeId: 1 }], recipeById, index, 3).total,
      75,
    )
    eq(
      'DK-COST 枠ごとに決めた食数はふだん作る人数より優先する(4人分なら100円)',
      sumMealPlanEntriesCost([{ recipeId: 1, servings: 4 }], recipeById, index, 3).total,
      100,
    )
    eq(
      'DK-COST 数えた食数の合計も返す(枠4人分+既定3人分=7人分)',
      sumMealPlanEntriesCost([{ recipeId: 1, servings: 4 }, { recipeId: 2 }], recipeById, index, 3)
        .servingsTotal,
      7,
    )
    eq(
      'DK-COST 1人分(personalTotal)は食数を変えても動かない(栄養と対の数字)',
      sumMealPlanEntriesCost([{ recipeId: 1, servings: 8 }], recipeById, index, 5).personalTotal,
      25,
    )
    eq(
      'DK-COST 登録人数が分からないレシピも1人分単価×ふだん作る人数で数える(50円×3)',
      sumMealPlanEntriesCost([{ recipeId: 4 }], recipeById, index, 3).total,
      150,
    )
    eq(
      'DK-COST 端数は最後に一度だけ丸める(260円÷2人×3人=390円)',
      sumMealPlanEntriesCost([{ recipeId: 2 }], recipeById, index, 3).total,
      390,
    )

    // pricelessIngredientNames(2026-07-29 便CD/MP-11): 概算食費に1円も入っていない材料を数え、
    // 「価格が分からない材料◯件を除いた概算です」と正直に添えるために使う
    eq(
      'pricelessIngredientNames: 価格が分からない材料だけを返す',
      pricelessIngredientNames([{ recipeId: 1 }, { recipeId: 3 }], recipeById, index),
      ['謎の食材'],
    )
    eq(
      'pricelessIngredientNames: 同じ材料が何品に出ても1件として数える',
      pricelessIngredientNames([{ recipeId: 3 }, { recipeId: 3 }], recipeById, index),
      ['謎の食材'],
    )
    eq(
      'pricelessIngredientNames: 全部に価格があれば0件(注記を出さない)',
      pricelessIngredientNames([{ recipeId: 1 }, { recipeId: 2 }], recipeById, index),
      [],
    )
    eq(
      'pricelessIngredientNames: recipeByIdに無い孤児行はスキップする',
      pricelessIngredientNames([{ recipeId: 999 }], recipeById, index),
      [],
    )
    // 2026-07-30 便CH/C2: 四捨五入後(yen)で判定していたため、マスタに載っているのに
    // 小口按分で0円に丸まる材料(塩 小さじ1など)が「価格が分からない材料」に数えられ、
    // 注記の件数が実態より多く出ていた。丸め前(rawYen)で判定する
    {
      const smallIndex = buildPriceIndex([{ name: '塩', pricePerUnit: 100, unit: '1000g' }])
      eq(
        'pricelessIngredientNamesOfRecipes(便CH/C2): 0.5円未満に丸まる材料は「価格が分からない」に数えない',
        pricelessIngredientNamesOfRecipes(
          [{ ingredients: [{ name: '塩', amount: '1', unit: 'g' }] }],
          smallIndex,
        ),
        [],
      )
      eq(
        'pricelessIngredientNamesOfRecipes(便CH/C2): マスタにも個別入力にも無い材料だけを数える',
        pricelessIngredientNamesOfRecipes(
          [
            {
              ingredients: [
                { name: '塩', amount: '1', unit: 'g' },
                { name: '秘伝のタレ', amount: '100', unit: 'g' },
              ],
            },
          ],
          smallIndex,
        ),
        ['秘伝のタレ'],
      )
      eq(
        'pricelessIngredientNamesOfRecipes(便CH/C2): 個別入力の価格があれば数えない',
        pricelessIngredientNamesOfRecipes(
          [{ ingredients: [{ name: '秘伝のタレ', amount: '100', unit: 'g', price: 1 }] }],
          smallIndex,
        ),
        [],
      )
      // 2026-07-30 便CK/③-1: 水・湯・氷は栄養側(isZeroIngredient)で「計算上ゼロ扱い・対象外件数にも
      // 数えない」と決めているのに、この関数だけ適用漏れで数えていた。同梱109品のうち22品で
      // 「価格が分からない材料1件を除いた概算です」＋「食材と価格を編集する」が常時出るが、
      // 水の価格は登録できない(PriceEditModalはprice>0必須)ためユーザーには解消できなかった
      eq(
        'pricelessIngredientNamesOfRecipes(便CK/③-1): 水は「価格が分からない材料」に数えない',
        pricelessIngredientNamesOfRecipes(
          [{ ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }, { name: '水', amount: '200', unit: 'ml' }] }],
          index,
        ),
        [],
      )
      eq(
        'pricelessIngredientNamesOfRecipes(便CK/③-1): 括弧書き付きの「水(水溶き片栗粉用)」も数えない',
        pricelessIngredientNamesOfRecipes(
          [{ ingredients: [{ name: '水(水溶き片栗粉用)', amount: '2', unit: '大さじ' }] }],
          index,
        ),
        [],
      )
      eq(
        'pricelessIngredientNamesOfRecipes(便CK/③-1): ぬるま湯・お湯・熱湯・氷も同じ扱い',
        pricelessIngredientNamesOfRecipes(
          [
            {
              ingredients: [
                { name: 'ぬるま湯', amount: '100', unit: 'ml' },
                { name: 'お湯', amount: '100', unit: 'ml' },
                { name: '熱湯', amount: '100', unit: 'ml' },
                { name: '氷', amount: '3', unit: '個' },
              ],
            },
          ],
          index,
        ),
        [],
      )
      eq(
        'pricelessIngredientNamesOfRecipes(便CK/③-1): 水を除外しても本当に価格が無い材料は数える',
        pricelessIngredientNamesOfRecipes(
          [{ ingredients: [{ name: '水', amount: '200', unit: 'ml' }, { name: '秘伝のタレ', amount: '100', unit: 'g' }] }],
          index,
        ),
        ['秘伝のタレ'],
      )
    }

    // sumCookedRecipesCost(2026-07-24 便BH-3・タスク9「期間の食費・実績ベース」): 作った記録群の
    // 実績原価合計と食数。2026-07-28 便BY/RANGE-01で「食数=記録件数」から「食数=延べ人数(1人1食)」へ
    // 直した。従来は2人分レシピ全量を1食として割っていたため「1食あたり」が約2倍に出ており、
    // 同じカードの「摂取できた栄養(1食あたり)」(1人分基準)と単位が食い違っていた。
    // 2026-07-28 便CA: 「1人が食べた分」を出す personalTotal / dishCount を追加。
    // total(全体金額)とcount(延べ食数)はオーナー指示で残すため値は据え置き＝期待値も従来どおり
    const onion2 = { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 } // 全量50円
    const chicken2 = { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 } // 全量260円
    eq(
      'sumCookedRecipesCost: 2人分レシピ2件は食数4(延べ人数)・全体310円・1人分は155円(2品)',
      sumCookedRecipesCost([{ recipe: onion2 }, { recipe: chicken2 }], index),
      { total: 50 + 260, count: 4, personalTotal: 25 + 130, dishCount: 2 },
    )
    eq(
      'sumCookedRecipesCost: 記録時の人数(log.servings)が登録人数と違えば金額もその比でスケールする(2人分レシピを4人分で作った=倍量)',
      sumCookedRecipesCost([{ recipe: onion2, log: { servings: 4 } }], index),
      { total: 100, count: 4, personalTotal: 25, dishCount: 1 },
    )
    eq(
      'sumCookedRecipesCost(便CA): 4人分作っても「1人が食べた分」は1人分のまま(25円)',
      sumCookedRecipesCost([{ recipe: onion2, log: { servings: 4 } }], index).personalTotal,
      25,
    )
    eq(
      'sumCookedRecipesCost: 記録時の人数が1人なら金額も半分・食数1(2人分レシピの半量)',
      sumCookedRecipesCost([{ recipe: onion2, log: { servings: 1 } }], index),
      { total: 25, count: 1, personalTotal: 25, dishCount: 1 },
    )
    eq(
      'sumCookedRecipesCost: 記録時の人数が無い古い記録(2026-07-12以前)は登録人数で代替する',
      sumCookedRecipesCost([{ recipe: onion2, log: {} }], index),
      { total: 50, count: 2, personalTotal: 25, dishCount: 1 },
    )
    eq(
      'sumCookedRecipesCost: 同じレシピ2回は食数4・合計100・1人分は50円(2品)',
      sumCookedRecipesCost([{ recipe: onion2 }, { recipe: onion2 }], index),
      { total: 100, count: 4, personalTotal: 50, dishCount: 2 },
    )
    eq(
      'sumCookedRecipesCost: 価格情報の無いレシピも食数・品数には数える',
      sumCookedRecipesCost(
        [{ recipe: { ingredients: [{ name: '謎の食材', amount: '1', unit: '個' }], servings: 2 } }],
        index,
      ),
      { total: 0, count: 2, personalTotal: 0, dishCount: 1 },
    )
    eq(
      'sumCookedRecipesCost: 登録人数が不正(0)なら1人分として扱う',
      sumCookedRecipesCost(
        [{ recipe: { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 0 } }],
        index,
      ),
      { total: 50, count: 1, personalTotal: 50, dishCount: 1 },
    )
    eq('sumCookedRecipesCost: 0件は0円・食数0', sumCookedRecipesCost([], index), {
      total: 0,
      count: 0,
      personalTotal: 0,
      dishCount: 0,
    })
  }

  // ===== 期間の集計(rangeSummary・2026-07-28 便CA・オーナー確定仕様) =====
  // オーナー原文(2026-07-27):
  //  ・期間指定の栄養と価格は平均ではなく「1人が期間内に摂取した食事の合計」を表示したい
  //  ・選択した期間が過去の場合は実績のみ、未来の場合は予定の献立で計算。過去の予定ベース計算は表示なし
  // ここでは①過去/今日以降の切り分け ②1人分の期間合計 ③二重計上しないこと を検証する
  {
    const TODAY = '2026-07-15'
    const onion2 = { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 } // 全量50円→1人分25円
    const chicken2 = { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 } // 全量260円→1人分130円

    // --- splitRangeByToday: 期間を「実績で数える日」と「予定で数える日」に分ける ---
    eq(
      'splitRangeByToday: 全部過去の期間は実績だけ(予定はnull=過去の予定ベース計算は出さない)',
      splitRangeByToday('2026-07-01', '2026-07-14', TODAY),
      { actual: { start: '2026-07-01', end: '2026-07-14' }, plan: null },
    )
    eq(
      'splitRangeByToday: 全部今日以降の期間は予定だけ',
      splitRangeByToday('2026-07-20', '2026-07-25', TODAY),
      { actual: null, plan: { start: '2026-07-20', end: '2026-07-25' } },
    )
    // 2026-08-08 便EA(オーナー指摘): 今日は記録・予定の両方の範囲に入る
    // (「作った記録があるものは記録・まだのものは予定」。二重計上は品の側で防ぐ)
    eq(
      'EA-TODAY splitRangeByToday: 今日が始まりの期間は、今日が記録側にも入る',
      splitRangeByToday(TODAY, '2026-07-31', TODAY),
      { actual: { start: TODAY, end: TODAY }, plan: { start: TODAY, end: '2026-07-31' } },
    )
    eq(
      'EA-TODAY splitRangeByToday: またぐ期間は「開始〜今日」が記録・「今日〜終了」が予定',
      splitRangeByToday('2026-07-01', '2026-07-31', TODAY),
      {
        actual: { start: '2026-07-01', end: TODAY },
        plan: { start: TODAY, end: '2026-07-31' },
      },
    )
    eq(
      'EA-TODAY splitRangeByToday: 月をまたぐ期間でも今日が両方の境界になる',
      splitRangeByToday('2026-06-25', '2026-07-05', '2026-07-01'),
      {
        actual: { start: '2026-06-25', end: '2026-07-01' },
        plan: { start: '2026-07-01', end: '2026-07-05' },
      },
    )
    eq(
      'EA-TODAY splitRangeByToday: 期間が今日1日だけなら、記録・予定とも今日だけ',
      splitRangeByToday(TODAY, TODAY, TODAY),
      { actual: { start: TODAY, end: TODAY }, plan: { start: TODAY, end: TODAY } },
    )
    // 基準行(画面の1行)の材料: 過去・未来・今日を分けて持つ
    eq(
      'EA-TODAY rangeBasisParts: またぐ期間は過去・未来・今日の3つに分かれる',
      rangeBasisParts('2026-07-01', '2026-07-31', TODAY),
      {
        past: { start: '2026-07-01', end: '2026-07-14' },
        future: { start: '2026-07-16', end: '2026-07-31' },
        includesToday: true,
      },
    )
    eq(
      'EA-TODAY rangeBasisParts: 全部過去の期間に今日は入らない',
      rangeBasisParts('2026-07-01', '2026-07-14', TODAY),
      { past: { start: '2026-07-01', end: '2026-07-14' }, future: null, includesToday: false },
    )
    eq(
      'EA-TODAY rangeBasisParts: 全部未来の期間に今日は入らない',
      rangeBasisParts('2026-07-20', '2026-07-25', TODAY),
      { past: null, future: { start: '2026-07-20', end: '2026-07-25' }, includesToday: false },
    )
    eq(
      'EA-TODAY rangeBasisParts: 今日1日だけの期間は過去も未来も無い',
      rangeBasisParts(TODAY, TODAY, TODAY),
      { past: null, future: null, includesToday: true },
    )
    eq(
      'splitRangeByToday: 単日(今日より前)は実績だけ',
      splitRangeByToday('2026-07-14', '2026-07-14', TODAY),
      { actual: { start: '2026-07-14', end: '2026-07-14' }, plan: null },
    )

    // --- summarizeRangeIntake ---
    // 過去(7/10)に肉2件を作った記録、今日以降(7/20)に玉ねぎの予定が1件ある月を想定する。
    // 過去日にも予定を、今日以降にも記録を置いて「使われない側」が混ざらないことを確かめる
    const cooked = [
      { date: '2026-07-10', recipe: onion2 },
      { date: '2026-07-10', recipe: chicken2 },
      { date: '2026-07-20', recipe: chicken2 }, // 今日以降の記録=予定基準なので数えない
    ]
    const planned = [
      { date: '2026-07-10', recipe: chicken2 }, // 過去の予定=オーナー指示で数えない
      { date: '2026-07-20', recipe: onion2 },
    ]
    const wholeMonth = summarizeRangeIntake({
      start: '2026-07-01',
      end: '2026-07-31',
      today: TODAY,
      cooked,
      planned,
      priceIndex: index,
    })
    eq(
      'summarizeRangeIntake: 過去分は作った記録だけを数える(過去の予定は無視)',
      { dishCount: wholeMonth.actual.dishCount, yen: wholeMonth.actual.personalYen },
      { dishCount: 2, yen: 25 + 130 },
    )
    eq(
      'summarizeRangeIntake: 今日以降は登録した献立だけを数える(今日以降の作った記録は無視)',
      { dishCount: wholeMonth.plan.dishCount, yen: wholeMonth.plan.personalYen },
      { dishCount: 1, yen: 25 },
    )
    eq(
      'summarizeRangeIntake: 1人分の食費は実績+予定の単純合計(平均ではない)',
      wholeMonth.personalYen,
      25 + 130 + 25,
    )
    eq(
      'summarizeRangeIntake: 栄養も1人分を品ごとに1回だけ足す(実績2品+予定1品=3品)',
      wholeMonth.nutrition.dishCount,
      3,
    )
    eq(
      'summarizeRangeIntake: 「作った食数の合算(全体食費)」は残す(全体310円・延べ4食)',
      { yen: wholeMonth.cookedHouseholdYen, meals: wholeMonth.cookedMealCount },
      { yen: 310, meals: 4 },
    )
    // 2026-08-03 便DK: 予定側にも「これから作る食数ぶん」の金額を出す。
    // 食数を渡していない(=従来の呼び出し)ときは登録人数どおり＝玉ねぎ全量50円・のべ2食
    eq(
      'DK-RANGE 予定側の「作る食数ぶん」: 食数未指定なら登録人数分(50円・のべ2食)',
      { yen: wholeMonth.planHouseholdYen, meals: wholeMonth.planMealCount },
      { yen: 50, meals: 2 },
    )
    {
      // 同じ予定を「3人分作る」にすると、金額とのべ食数だけが3人分になる。
      // 1人分の食費と栄養(＝栄養は1人当たりのみで十分、というオーナー確定)は動かないこと
      const withServings = summarizeRangeIntake({
        start: '2026-07-01',
        end: '2026-07-31',
        today: TODAY,
        cooked,
        planned: [
          { date: '2026-07-10', recipe: chicken2, servings: 3 },
          { date: '2026-07-20', recipe: onion2, servings: 3 },
        ],
        priceIndex: index,
      })
      eq(
        'DK-RANGE 予定を3人分にすると「作る食数ぶん」は1人分単価×3(25円×3=75円・のべ3食)',
        { yen: withServings.planHouseholdYen, meals: withServings.planMealCount },
        { yen: 75, meals: 3 },
      )
      eq(
        'DK-RANGE 食数を変えても1人分の食費は変わらない(栄養と対の数字)',
        withServings.plan.personalYen,
        25,
      )
      eq(
        'DK-RANGE 食数を変えても栄養の品数(1人分の数え方)は変わらない',
        withServings.nutrition.dishCount,
        wholeMonth.nutrition.dishCount,
      )
      eq(
        'DK-RANGE 実績側(作った記録)は食数設定の影響を受けない',
        {
          yen: withServings.cookedHouseholdYen,
          meals: withServings.cookedMealCount,
        },
        { yen: 310, meals: 4 },
      )
    }
    // 2026-08-03 便DQ: 月タブの食費の表に出す5つの数値が、手計算とそのまま一致すること。
    // オーナー指示「価格は一人分（全ての献立を1食ずつ足した合計）と食数、全員分（実際に作った献立×
    // 食数の合計）と食数、1日あたりの平均食費、を表で出す。予定は合計と一人当たりの合計を下に」。
    // 表の行と1対1で対応させ、画面で「全員分 ÷ 作った記録のある日数 = 1日あたりの平均」を検算できること
    // (規則4)も確かめる。想定する月(today=7/15):
    //   作った記録 7/10 玉ねぎ3人分・7/10 鶏もも(人数の記録なし=登録2人分)・7/12 玉ねぎ2人分・
    //             7/13 玉ねぎ2人分  → 3日ぶんの記録
    //   登録した献立 7/20 鶏もも3人分・7/25 玉ねぎ4人分
    {
      const dqCooked = [
        { date: '2026-07-10', recipe: onion2, log: { servings: 3 } }, // 50円×3/2=75円・3食
        { date: '2026-07-10', recipe: chicken2 }, // 260円×2/2=260円・2食
        { date: '2026-07-12', recipe: onion2, log: { servings: 2 } }, // 50円・2食
        { date: '2026-07-13', recipe: onion2, log: { servings: 2 } }, // 50円・2食
      ]
      const dqPlanned = [
        { date: '2026-07-20', recipe: chicken2, servings: 3 }, // 260円×3/2=390円・3食
        { date: '2026-07-25', recipe: onion2, servings: 4 }, // 50円×4/2=100円・4食
      ]
      const dq = summarizeRangeIntake({
        start: '2026-07-01',
        end: '2026-07-31',
        today: TODAY,
        cooked: dqCooked,
        planned: dqPlanned,
        priceIndex: index,
      })
      eq(
        'DQ-MONTH 表1行目「1人分」: 献立を1食ずつ足した合計(25+130+25+25 + 130+25=360円)と食数6',
        { yen: dq.personalYen, meals: dq.actual.dishCount + dq.plan.dishCount },
        { yen: 360, meals: 6 },
      )
      eq(
        'DQ-MONTH 表2行目「全員分(作った食数ぶん)」: 75+260+50+50=435円・のべ9食',
        { yen: dq.cookedHouseholdYen, meals: dq.cookedMealCount },
        { yen: 435, meals: 9 },
      )
      eq(
        'DQ-MONTH 1日あたりの平均の分母は「作った記録がある日数」(7/10に2品作っても1日)',
        dq.cookedDayCount,
        3,
      )
      eq(
        'DQ-MONTH 表3行目「1日あたりの平均」= 全員分435円 ÷ 作った記録のある3日 = 145円',
        dq.cookedPerDayYen,
        Math.round(435 / 3),
      )
      eq(
        'DQ-MONTH 予定の「合計」: 作る食数ぶん 390+100=490円・のべ7食',
        { yen: dq.planHouseholdYen, meals: dq.planMealCount },
        { yen: 490, meals: 7 },
      )
      eq(
        'DQ-MONTH 予定の「1人分」(オーナー原文の「一人当たりの合計」): 130+25=155円・2品',
        { yen: dq.plan.personalYen, dishes: dq.plan.dishCount },
        { yen: 155, dishes: 2 },
      )
      eq(
        'DQ-MONTH 1人分の合計は「実績の1人分＋予定の1人分」と必ず一致する(表の内訳が割れない)',
        dq.actual.personalYen + dq.plan.personalYen,
        dq.personalYen,
      )
      // 作った記録が1件も無い月(未来の月)は、全員分・1日あたりの行を出さない側に倒す。
      // 0で割った値を出さないこと(分母0→0円と言い切らない=行ごと出さない判断の材料)
      const dqFuture = summarizeRangeIntake({
        start: '2026-07-16',
        end: '2026-07-31',
        today: TODAY,
        cooked: dqCooked,
        planned: dqPlanned,
        priceIndex: index,
      })
      eq(
        'DQ-MONTH 作った記録が無い期間は 記録日数0・1日あたり0(0除算しない)・全員分も0',
        {
          days: dqFuture.cookedDayCount,
          perDay: dqFuture.cookedPerDayYen,
          yen: dqFuture.cookedHouseholdYen,
          meals: dqFuture.cookedMealCount,
        },
        { days: 0, perDay: 0, yen: 0, meals: 0 },
      )
    }
    // 2026-07-30 便CH/C2: 「価格が分からない材料◯件」の注記は合計と同じ料理から数える。
    // rangeIntakeRecipes が summarizeRangeIntake と同じ切り分け(過去=記録・今日以降=予定)を返す
    eq(
      'rangeIntakeRecipes(便CH/C2): 合計に入れた料理だけを返す(実績2品+予定1品=3品)',
      rangeIntakeRecipes({
        start: '2026-07-01',
        end: '2026-07-31',
        today: TODAY,
        cooked,
        planned,
      }).length,
      3,
    )
    eq(
      'rangeIntakeRecipes(便CH/C2): 全部過去の期間は作った記録だけ(過去の予定は数に入れない)',
      rangeIntakeRecipes({
        start: '2026-07-01',
        end: '2026-07-14',
        today: TODAY,
        cooked,
        planned,
      }).length,
      2,
    )
    // 全部過去の期間: 予定は0のまま(過去の予定ベース計算は表示しない)
    const pastOnly = summarizeRangeIntake({
      start: '2026-07-01',
      end: '2026-07-14',
      today: TODAY,
      cooked,
      planned,
      priceIndex: index,
    })
    eq(
      'summarizeRangeIntake: 全部過去の期間は予定側が0品0円(過去の予定ベース計算は廃止)',
      { dishCount: pastOnly.plan.dishCount, yen: pastOnly.plan.personalYen, range: pastOnly.plan.range },
      { dishCount: 0, yen: 0, range: null },
    )
    // 全部未来の期間: 実績は0のまま
    const futureOnly = summarizeRangeIntake({
      start: '2026-07-16',
      end: '2026-07-31',
      today: TODAY,
      cooked,
      planned,
      priceIndex: index,
    })
    eq(
      'summarizeRangeIntake: 全部未来の期間は実績側が0品0円',
      { dishCount: futureOnly.actual.dishCount, yen: futureOnly.actual.personalYen },
      { dishCount: 0, yen: 0 },
    )
    eq(
      'summarizeRangeIntake: 未来の期間でも「1人分の合計」は予定から出る',
      futureOnly.personalYen,
      25,
    )
    // 記録も予定も無い期間
    const emptyRange = summarizeRangeIntake({
      start: '2026-07-02',
      end: '2026-07-03',
      today: TODAY,
      cooked,
      planned,
      priceIndex: index,
    })
    eq(
      'summarizeRangeIntake: 記録も予定も無い期間は0品0円',
      {
        a: emptyRange.actual.dishCount,
        p: emptyRange.plan.dishCount,
        yen: emptyRange.personalYen,
        kcal: emptyRange.nutrition.total.kcal,
      },
      { a: 0, p: 0, yen: 0, kcal: 0 },
    )

    // --- dayIntakeMap: カレンダーのセルに出す「その日1人分」 ---
    const stats = dayIntakeMap({
      dates: ['2026-07-10', '2026-07-14', '2026-07-20'],
      today: TODAY,
      cooked,
      planned,
      priceIndex: index,
    })
    eq(
      'dayIntakeMap: 過去日は作った記録の1人分合計(玉ねぎ25+鶏130=155円)・基準はactual',
      { yen: stats.get('2026-07-10')?.yen, basis: stats.get('2026-07-10')?.basis },
      { yen: 155, basis: 'actual' },
    )
    eq(
      'dayIntakeMap: 今日以降は登録した献立の1人分合計(玉ねぎ25円)・基準はplan',
      { yen: stats.get('2026-07-20')?.yen, basis: stats.get('2026-07-20')?.basis },
      { yen: 25, basis: 'plan' },
    )
    eq(
      'dayIntakeMap: 記録も予定も無い日はMapに入れない(セルは数字なしで表示する)',
      stats.has('2026-07-14'),
      false,
    )
    eq('dayIntakeMap: 数字を出す日だけが入る(2日分)', stats.size, 2)
  }

  // 由来種別(default/user)の出し分け(2026-07-13 UIペルソナQA: 詳細の価格注記「目安」表記の分岐に使う)
  const sourceIndex = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個', isDefault: true },
    { name: 'にんじん', pricePerUnit: 40, unit: '1本', isDefault: false },
  ])
  eq(
    '由来種別: マスタ行が投入時の目安のままならsource=default',
    estimateIngredientYen({ name: '玉ねぎ', amount: '1', unit: '個' }, sourceIndex),
    { yen: 50, rawYen: 50, source: 'default' },
  )
  eq(
    '由来種別: ユーザーが上書きした価格ならsource=user',
    estimateIngredientYen({ name: 'にんじん', amount: '1', unit: '本' }, sourceIndex),
    { yen: 40, rawYen: 40, source: 'user' },
  )
}

// ---------- H-2(2026-07-16 Fable品質監査再発防止): かな表記ゆれの照合統一 ----------
// db/prices.tsの重複チェック(normalizeForDuplicateCheck=toHiragana込み)と同じ正規化を
// matchPriceEntryの照合キーにも使うことで、「たまねぎ」で登録した価格が材料名「玉ねぎ」の
// レシピにも一致するようにする(逆にトウフ⇄とうふ等も同様)。修正前は登録時はかな正規化で
// 重複ブロックされるのに照合時は一致しない袋小路だった。
{
  const hiraganaIndex = buildPriceIndex([{ name: 'たまねぎ', pricePerUnit: 50, unit: '1個' }])
  eq(
    'H-2: ひらがな登録(たまねぎ)が漢字表記(玉ねぎ)の材料に一致する',
    matchPriceEntry('玉ねぎ', hiraganaIndex)?.pricePerUnit,
    50,
  )
  const katakanaIndex = buildPriceIndex([{ name: 'トウフ', pricePerUnit: 40, unit: '1丁' }])
  eq(
    'H-2: カタカナ登録(トウフ)がひらがな表記(とうふ)の材料に一致する',
    matchPriceEntry('とうふ', katakanaIndex)?.pricePerUnit,
    40,
  )
  const kanjiIndex = buildPriceIndex([{ name: '玉ねぎ', pricePerUnit: 50, unit: '1個' }])
  eq(
    'H-2: 漢字登録(玉ねぎ)がひらがな表記(たまねぎ)の材料に一致する(袋小路の解消)',
    matchPriceEntry('たまねぎ', kanjiIndex)?.pricePerUnit,
    50,
  )
}

// ---------- 単位正規化(docs/20 §3拡張・2026-07-14: kg/g・L/ml・大さじ/小さじ等が混在しても
// 正しく按分できるようにする。オーナー要望「kgが混ざっても平気か不安/明らかに間違った値段が
// 出ることがある」の根治。Fable設計確定: normalizeUnitで次元(mass/volume/count)ごとに正規化) ----------
{
  eq('normalizeUnit 質量g', normalizeUnit(100, 'g'), { dim: 'mass', base: 100 })
  eq('normalizeUnit 質量kg→g換算', normalizeUnit(0.3, 'kg'), { dim: 'mass', base: 300 })
  eq('normalizeUnit 質量mg→g換算', normalizeUnit(500, 'mg'), { dim: 'mass', base: 0.5 })
  eq('normalizeUnit 体積ml', normalizeUnit(200, 'ml'), { dim: 'volume', base: 200 })
  eq('normalizeUnit 体積L→ml換算', normalizeUnit(1, 'L'), { dim: 'volume', base: 1000 })
  eq('normalizeUnit 体積大さじ→ml換算', normalizeUnit(1, '大さじ'), { dim: 'volume', base: 15 })
  eq('normalizeUnit 体積小さじ→ml換算', normalizeUnit(1, '小さじ'), { dim: 'volume', base: 5 })
  eq('normalizeUnit 体積カップ→ml換算', normalizeUnit(1, 'カップ'), { dim: 'volume', base: 200 })
  eq('normalizeUnit 個数(単位名を保持)', normalizeUnit(2, '個'), { dim: 'count', unit: '個', base: 2 })
  eq('normalizeUnit 個数(本は個と別単位名)', normalizeUnit(1, '本'), { dim: 'count', unit: '本', base: 1 })
  eq('normalizeUnit 解釈不能(少々)はnull', normalizeUnit(1, '少々'), null)
  eq('normalizeUnit 数量0以下はnull', normalizeUnit(0, 'g'), null)
  // 2026-07-21全角対応: 単位が全角(「ｇ」「ｍｌ」等)でも半角と同じ次元・基準量に正規化できる
  eq('normalizeUnit 全角質量「ｇ」も半角gと同じ', normalizeUnit(100, 'ｇ'), { dim: 'mass', base: 100 })
  eq('normalizeUnit 全角体積「ｍｌ」も半角mlと同じ', normalizeUnit(200, 'ｍｌ'), { dim: 'volume', base: 200 })
  eq('parseUnitQuantity 全角「３００ｇ」を半角と同じ形に分解できる', parseUnitQuantity('３００ｇ'), { qty: 300, baseUnit: 'g' })

  // 豚肉: マスタ200円/100g × レシピ「0.3 kg」→ kg→g換算で按分(300/100*200=600円)
  const meatIndex = buildPriceIndex([{ name: '豚肉', pricePerUnit: 200, unit: '100g' }])
  eq(
    'estimateIngredientYen kg混在でも按分できる(200円/100g×0.3kg→600円)',
    estimateIngredientYen({ name: '豚肉', amount: '0.3', unit: 'kg' }, meatIndex),
    { yen: 600, rawYen: 600, source: 'user' },
  )

  // しょうゆ: マスタ15円/大さじ1 × レシピ「小さじ1」→ 大さじ=小さじ3で体積換算(15÷3=5円)
  const soySauceIndex = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 15, unit: '大さじ1' }])
  eq(
    'estimateIngredientYen 大さじ/小さじ混在でも按分できる(15円/大さじ1×小さじ1→5円)',
    estimateIngredientYen({ name: 'しょうゆ', amount: '1', unit: '小さじ' }, soySauceIndex),
    { yen: 5, rawYen: 5, source: 'user' },
  )

  // 牛乳: マスタ200円/1L × レシピ「200 ml」→ L→ml換算で按分(200/1000*200=40円)
  const milkIndex = buildPriceIndex([{ name: '牛乳', pricePerUnit: 200, unit: '1L' }])
  eq(
    'estimateIngredientYen L/ml混在でも按分できる(200円/1L×200ml→40円)',
    estimateIngredientYen({ name: '牛乳', amount: '200', unit: 'ml' }, milkIndex),
    { yen: 40, rawYen: 40, source: 'user' },
  )

  // ---------- 1Lボトル→大さじ按分の実証テスト(2026-07-21 単位換算監査・docs/48・オーナー指示) ----------
  // オーナーが「食材と価格」で醤油を1Lボトル(1000ml・400円)で登録し、レシピで大さじ1(15ml)を
  // 使うケースが2人分レシピの1食あたりで正しく按分されるかを、登録〜1食あたり金額まで
  // 端から端まで確認する(estimateIngredientRowCostは原価ビューが実際に表示に使う関数)。
  // 期待値: 400円 × 15ml/1000ml ÷ 2人分 = 3円
  {
    const soySauceBottleIndex = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 400, unit: '1000ml' }])
    eq(
      '1Lボトル按分: しょうゆ1000ml400円×大さじ1(15ml)の全量(400*15/1000=6円)',
      estimateIngredientYen({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, soySauceBottleIndex),
      { yen: 6, rawYen: 6, source: 'user' },
    )
    eq(
      '1Lボトル按分: 2人分レシピの1食あたり(6円÷2=3円。オーナー指示の検証ケース)',
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, soySauceBottleIndex, 2),
      { totalYen: 6, perServingYen: 3, shownYen: 6 },
    )
  }

  // 同じ1Lボトル(400円)の登録表記ゆれ(「1000ml」「1L」「1L」小文字「1リットル」)が
  // すべて同じ結果(大さじ1→2人分1食あたり3円)になることを確認する(オーナー指示: 表記ゆれ受理確認)
  for (const unitText of ['1000ml', '1L', '1l', '1リットル']) {
    const idx = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 400, unit: unitText }])
    eq(
      `1Lボトル登録表記ゆれ「${unitText}」でも大さじ1×2人分=3円になる`,
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, idx, 2),
      { totalYen: 6, perServingYen: 3, shownYen: 6 },
    )
  }
  // 500mlボトル(半量・半額の200円)でも単価は同じなので同じ結果になることを確認
  {
    const halfBottleIndex = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 200, unit: '500ml' }])
    eq(
      '500mlボトル(200円)でも単価が同じなら大さじ1×2人分=3円になる',
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, halfBottleIndex, 2),
      { totalYen: 6, perServingYen: 3, shownYen: 6 },
    )
  }
  // UIの数量+単位入力(unitForm.ts)でも同じ文字列が扱えること(登録フォームの往復確認)。
  // 「1リットル」はKNOWN_UNITSのドロップダウンには無い(Lで代表)ため「その他」自由入力側になるが、
  // 保存文字列としては解釈できるので上のestimateIngredientRowCostの結果には影響しない。
  eq('decomposeUnit 「1000ml」はml単位として分解できる', decomposeUnit('1000ml'), { qty: '1000', unitKind: 'ml', freeText: '' })
  eq('decomposeUnit 「1L」はL単位として分解できる', decomposeUnit('1L'), { qty: '1', unitKind: 'L', freeText: '' })
  eq('decomposeUnit 「1リットル」はKNOWN_UNITSに無いため「その他」自由入力になる(保存文字列としては解釈可能)', decomposeUnit('1リットル'), { qty: '', unitKind: OTHER_UNIT, freeText: '1リットル' })
  eq('composeUnit 数量1000+ml単位→「1000ml」に合成', composeUnit({ qty: '1000', unitKind: 'ml', freeText: '' }), '1000ml')
  eq('composeUnit 数量1+L単位→「1L」に合成', composeUnit({ qty: '1', unitKind: 'L', freeText: '' }), '1L')

  // ---------- 大さじ/小さじの略記「大2」「小1」でも原価按分できる(2026-07-21分量表記拡充) ----------
  // オーナー実機報告: URL取り込みレシピの分量が「大2」「小1」の略記のままだと、単位欄が空になるため
  // 従来はestimateIngredientYenのingUnit/amountNumが噛み合わず按分できなかった(マスタ価格そのまま)。
  // resolveCalcAmount(src/logic/amount.ts)で「大さじ」「小さじ」に解決してから按分するよう修正した
  {
    const oilIndex = buildPriceIndex([{ name: 'オリーブオイル', pricePerUnit: 30, unit: '大さじ1' }])
    eq(
      '略記按分: オリーブオイル「大2」(大さじ1=30円→大さじ2=60円)',
      estimateIngredientYen({ name: 'オリーブオイル', amount: '大2', unit: '' }, oilIndex),
      { yen: 60, rawYen: 60, source: 'user' },
    )
    const soySauceBottleIndex2 = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 400, unit: '1000ml' }])
    eq(
      '略記按分: しょうゆ「小1」(1000ml400円×小さじ1(5ml)=2円)',
      estimateIngredientYen({ name: 'しょうゆ', amount: '小1', unit: '' }, soySauceBottleIndex2),
      { yen: 2, rawYen: 2, source: 'user' },
    )
    // 分数「小1/2」の解決確認(体積↔体積の同じ次元同士。大さじ換算のマスタで按分)。
    // 塩は通常g登録が多いが、按分ロジック自体(質量↔質量・体積↔体積のみ按分可=docs/48の既存仕様)の
    // 確認が目的のため、大さじ登録のマスタで揃える(g登録だと次元不一致でフォールバックし、
    // 分数解決自体の確認にならない)
    const saltIndex = buildPriceIndex([{ name: '塩', pricePerUnit: 30, unit: '大さじ1' }])
    eq(
      '略記按分: 塩「小1/2」(大さじ1=30円→小さじ0.5(2.5ml/15ml)=5円)',
      estimateIngredientYen({ name: '塩', amount: '小1/2', unit: '' }, saltIndex),
      { yen: 5, rawYen: 5, source: 'user' },
    )
    // 単位欄が入力済みなら略記解釈しない(従来どおり単位不一致でマスタ価格そのまま)
    eq(
      '略記按分: 単位欄が入力済みの「大2」は略記解釈せずフォールバック(マスタ価格そのまま)',
      estimateIngredientYen({ name: 'オリーブオイル', amount: '大2', unit: '個' }, oilIndex),
      { yen: 30, rawYen: 30, source: 'user' },
    )
  }

  // 玉ねぎ: マスタ50円/1個 × レシピ「2 個」→ count同一単位で按分(既存の按分の回帰確認)
  const onionIndex = buildPriceIndex([{ name: '玉ねぎ', pricePerUnit: 50, unit: '1個' }])
  eq(
    'estimateIngredientYen 個数系(同一単位)は按分が回帰しない(50円/1個×2個→100円)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '2', unit: '個' }, onionIndex),
    { yen: 100, rawYen: 100, source: 'user' },
  )
  // 個数不一致(個 vs 本): 単位名が違い、栄養側にも「本」の目安量が無いので量が決まらない。
  // 2026-08-23 便KE で、販売単位(1個)のマスタでは金額を出さない扱いに変えた
  eq(
    'estimateIngredientYen 個数系は単位名が違うと金額を出さない(50円/1個×1本。便KE)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '1', unit: '本' }, onionIndex),
    undefined,
  )
  // 解釈不能(少々)も同じ: 販売単位(1個)なら金額を出さない(便KE)
  eq(
    'estimateIngredientYen 解釈不能な分量(少々)は販売単位のマスタでは金額を出さない(便KE)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '少々', unit: '個' }, onionIndex),
    undefined,
  )
  // 逆に、登録単位そのものが「1回に使う量」なら従来どおり満額を使う(便KEで残した側)
  eq(
    'estimateIngredientYen 登録単位が「少々」なら分量が読めなくても満額を使う(便KE)',
    estimateIngredientYen(
      { name: '塩こしょう', amount: '少々', unit: '' },
      buildPriceIndex([{ name: '塩こしょう', pricePerUnit: 5, unit: '少々' }]),
    ),
    { yen: 5, rawYen: 5, source: 'user' },
  )

  // 既存の同一単位(100g×200g等)の按分が回帰しないこと(質量side・従来からの主要ケース)
  const chickenIndex = buildPriceIndex([{ name: '鶏もも肉', pricePerUnit: 130, unit: '100g' }])
  eq(
    'estimateIngredientYen 既存の同一単位(g×g)の按分は回帰しない(130円/100g×300g→390円)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '300', unit: 'g' }, chickenIndex),
    { yen: 390, rawYen: 390, source: 'user' },
  )
  // 2026-07-21全角対応: 分量・単位が全角(「３００」「ｇ」)でも半角と同じ按分結果になること
  eq(
    'estimateIngredientYen 全角「３００ｇ」でも半角「300g」と同じ按分結果(130円/100g×300g→390円)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '３００', unit: 'ｇ' }, chickenIndex),
    { yen: 390, rawYen: 390, source: 'user' },
  )

  // 後方互換: mass/volume/countの対応表に無い単位(「1杯」等)でも、文字列として完全一致するなら
  // 従来どおり按分する(既存の"完全一致で按分"を正規化が包含するための保険。実データ:
  // public/sets/data/review8.jsonの「冷や汁」がご飯2杯を使う)
  const riceIndex = buildPriceIndex([{ name: 'ご飯', pricePerUnit: 30, unit: '1杯' }])
  eq(
    'estimateIngredientYen 対応表に無い単位でも文字列完全一致なら按分(従来互換。30円/1杯×2杯→60円)',
    estimateIngredientYen({ name: 'ご飯', amount: '2', unit: '杯' }, riceIndex),
    { yen: 60, rawYen: 60, source: 'user' },
  )
  // マスタが「単位+数量」書式(例:大さじ1)でも、末尾の数量を正しく解釈できること
  const misoIndex = buildPriceIndex([{ name: 'みそ', pricePerUnit: 15, unit: '大さじ1' }])
  eq(
    'estimateIngredientYen マスタが「単位+数量」書式(大さじ1)でも按分できる(15円/大さじ1×大さじ2→30円)',
    estimateIngredientYen({ name: 'みそ', amount: '2', unit: '大さじ' }, misoIndex),
    { yen: 30, rawYen: 30, source: 'user' },
  )
}

// ---------- COST-01/XREF-01(2026-07-28 便BY): 単位の次元が食い違う組をグラム換算で按分し、
// 「適量」「少々」は1回の使用量で按分する。従来はどちらもマスタ金額の満額が1行に乗っており、
// 原価が過大(サラダ油「適量」=1Lボトル400円)・過小(鶏むね肉「1枚」=100g分90円)の両方向に壊れていた ----------
{
  // (1) 個数 vs 質量: 栄養側の目安量(鶏むね肉 1枚=250g)でグラムに寄せて按分する
  const breastIndex = buildPriceIndex([{ name: '鶏むね肉', pricePerUnit: 90, unit: '100g' }])
  eq(
    'g換算按分: 鶏むね肉1枚(=250g)は100g90円のマスタから225円(従来は満額90円=実勢の約1/2)',
    estimateIngredientYen({ name: '鶏むね肉', amount: '1', unit: '枚' }, breastIndex),
    { yen: 225, rawYen: 225, source: 'user' },
  )
  const thighIndex = buildPriceIndex([{ name: '鶏もも肉', pricePerUnit: 130, unit: '100g' }])
  eq(
    'g換算按分: 鶏もも肉2枚(=500g)は650円(従来は満額130円=実勢の約1/5)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '2', unit: '枚' }, thighIndex),
    { yen: 650, rawYen: 650, source: 'user' },
  )
  // (2) 個数 vs 個数(単位名が違う): レタス4枚(=120g) ÷ 1個(=300g)
  const lettuceIndex = buildPriceIndex([{ name: 'レタス', pricePerUnit: 150, unit: '1個' }])
  eq(
    'g換算按分: レタス4枚(=120g)は1個150円のマスタから60円(従来は満額150円)',
    estimateIngredientYen({ name: 'レタス', amount: '4', unit: '枚' }, lettuceIndex),
    { yen: 60, rawYen: 60, source: 'user' },
  )
  // (3) 長さ単位(cm)も栄養側の目安量にあれば通る: 長ねぎ10cm(=30g) ÷ 1本(=100g)
  const negiIndex = buildPriceIndex([{ name: '長ねぎ', pricePerUnit: 100, unit: '1本' }])
  eq(
    'g換算按分: 長ねぎ10cm(=30g)は1本100円のマスタから30円(従来は満額100円)',
    estimateIngredientYen({ name: '長ねぎ', amount: '10', unit: 'cm' }, negiIndex),
    { yen: 30, rawYen: 30, source: 'user' },
  )
  // (4) 栄養側に目安量が無い組は勝手な換算を作らない。2026-08-23 便KE から、
  //     販売単位(1枚)で登録されたマスタでは金額そのものを出さない(価格が分からない材料に数える)
  const konnyakuIndex = buildPriceIndex([{ name: 'こんにゃく', pricePerUnit: 60, unit: '1枚' }])
  eq(
    'g換算按分: 換算の根拠が無い組(こんにゃく1袋 vs マスタ1枚)は金額を出さない(便KE)',
    estimateIngredientYen({ name: 'こんにゃく', amount: '1', unit: '袋' }, konnyakuIndex),
    undefined,
  )
  // (5) 「適量」「少々」を1回の使用量で按分する(サラダ油=大さじ1・ごま油=小さじ1・
  //     オリーブオイル=大さじ1。同梱レシピが分量を数値で書いているときの最頻値)
  const saladOilIndex = buildPriceIndex([{ name: 'サラダ油', pricePerUnit: 400, unit: '1L' }])
  eq(
    '1回使用量で按分: サラダ油「適量」は大さじ1(15ml)ぶんの6円(従来は1Lボトル満額400円)',
    estimateIngredientYen({ name: 'サラダ油', amount: '適量', unit: '' }, saladOilIndex),
    { yen: 6, rawYen: 6, source: 'user' },
  )
  eq(
    '1回使用量で按分: サラダ油「少々」も同じ扱い(従来は満額400円)',
    estimateIngredientYen({ name: 'サラダ油', amount: '少々', unit: '' }, saladOilIndex),
    { yen: 6, rawYen: 6, source: 'user' },
  )
  const sesameOilIndex = buildPriceIndex([{ name: 'ごま油', pricePerUnit: 1200, unit: '1L' }])
  eq(
    '1回使用量で按分: ごま油「少々(お好みで)」は小さじ1(5ml)ぶんの6円(従来は満額1200円)',
    estimateIngredientYen({ name: 'ごま油', amount: '少々(お好みで)', unit: '' }, sesameOilIndex),
    { yen: 6, rawYen: 6, source: 'user' },
  )
  const oliveOilIndex = buildPriceIndex([{ name: 'オリーブオイル', pricePerUnit: 1400, unit: '1L' }])
  eq(
    '1回使用量で按分: オリーブオイル「適量」は大さじ1ぶんの21円(従来は満額1400円)',
    estimateIngredientYen({ name: 'オリーブオイル', amount: '適量', unit: '' }, oliveOilIndex),
    { yen: 21, rawYen: 21, source: 'user' },
  )
  // 分量が数値で書いてあれば従来どおり按分が優先される(1回使用量は使わない)
  eq(
    '1回使用量: 分量が数値で書いてあるときは従来どおり按分が優先(オリーブオイル大さじ2→42円)',
    estimateIngredientYen({ name: 'オリーブオイル', amount: '2', unit: '大さじ' }, oliveOilIndex),
    { yen: 42, rawYen: 42, source: 'user' },
  )
  // 1回使用量を持たない薬味は、docs/49 §7では「満額でも過大にならない」として満額表示のままだった。
  // 2026-08-23 便KE で見直した: 小ねぎの登録単位はその後100g(=1束まるごと)になっており、
  // 薬味ひとつまみの行に80円が乗っていた(中華風卵スープ 2人分で1食82円のうち40円が小ねぎ)。
  // 販売単位のマスタでは金額を出さない
  const komeIndex = buildPriceIndex([{ name: '小ねぎ', pricePerUnit: 80, unit: '1袋' }])
  eq(
    '1回使用量: 持たない食材(小ねぎ「適量(お好みで)」)は金額を出さない(便KEでdocs/49 §7を見直し)',
    estimateIngredientYen({ name: '小ねぎ', amount: '適量(お好みで)', unit: '' }, komeIndex),
    undefined,
  )
  // (6) parseUnitQuantityの分数対応: マスタ「1/4個」を数量0.25として読む。
  //     従来は{qty:1, baseUnit:'/4個'}になり、レシピ側にどんな分量を書いても按分できなかった
  eq('parseUnitQuantity 分数「1/4個」を数量0.25として読む', parseUnitQuantity('1/4個'), { qty: 0.25, baseUnit: '個' })
  eq('parseUnitQuantity 分数「1/2本」を数量0.5として読む', parseUnitQuantity('1/2本'), { qty: 0.5, baseUnit: '本' })
  eq('parseUnitQuantity 分数でない従来書式は変わらない(100g)', parseUnitQuantity('100g'), { qty: 100, baseUnit: 'g' })
  const cabbageIndex = buildPriceIndex([{ name: 'キャベツ', pricePerUnit: 130, unit: '1/4個' }])
  eq(
    '分数マスタ: キャベツ1/4個は同量なので130円のまま(表示が変わらないことの確認)',
    estimateIngredientYen({ name: 'キャベツ', amount: '1/4', unit: '個' }, cabbageIndex),
    { yen: 130, rawYen: 130, source: 'user' },
  )
  eq(
    '分数マスタ: キャベツ1/2個は倍量なので260円(従来はどんな分量でも130円だった)',
    estimateIngredientYen({ name: 'キャベツ', amount: '1/2', unit: '個' }, cabbageIndex),
    { yen: 260, rawYen: 260, source: 'user' },
  )
  eq(
    '分数マスタ: キャベツ2枚(=100g)は1/4個(=250g)から52円(グラム換算按分と併用)',
    estimateIngredientYen({ name: 'キャベツ', amount: '2', unit: '枚' }, cabbageIndex),
    { yen: 52, rawYen: 52, source: 'user' },
  )
  const radishIndex = buildPriceIndex([{ name: '大根', pricePerUnit: 100, unit: '1/2本' }])
  eq(
    '分数マスタ: 大根1/4本は1/2本100円のマスタから50円(従来はどんな分量でも100円だった)',
    estimateIngredientYen({ name: '大根', amount: '1/4', unit: '本' }, radishIndex),
    { yen: 50, rawYen: 50, source: 'user' },
  )
  // (7) マスタ単位の換算可能化(にんにく1個→1玉ほか)。栄養側の目安量に無い単位名だと
  //     グラム換算に持ち込めないため、単位表記そのものを換算できる形に直したぶんの確認
  {
    const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
    eq('PRICE_DEFAULTS にんにくの単位は「1玉」(栄養側の目安量が玉=45g・かけ=6gを持つため)', byName.get('にんにく')?.unit, '1玉')
    eq('PRICE_DEFAULTS 大葉の単位は「10枚」', byName.get('大葉')?.unit, '10枚')
    eq('PRICE_DEFAULTS 青じその単位は「10枚」', byName.get('青じそ')?.unit, '10枚')
    eq('PRICE_DEFAULTS ハムの単位は「4枚」', byName.get('ハム')?.unit, '4枚')
    eq('PRICE_DEFAULTS ベーコンの単位は「4枚」', byName.get('ベーコン')?.unit, '4枚')
    const garlicIndex = buildPriceIndex([{ name: 'にんにく', pricePerUnit: 60, unit: '1玉' }])
    eq(
      'マスタ単位の換算可能化: にんにく1かけ(=6g)は1玉(=45g)60円から8円(従来は満額60円)',
      estimateIngredientYen({ name: 'にんにく', amount: '1', unit: 'かけ' }, garlicIndex),
      { yen: 8, rawYen: 8, source: 'user' },
    )
  }
  // (7-b) 「1パック丸ごと」を使った分に直した項目(2026-08-10 便EY・docs/49 2026-08-10節)。
  //       マスタの単位が「1パック」「1袋」だと、レシピが個数・枚数・本数で書いていても
  //       次元も単位名も噛み合わず、グラム換算にも持ち込めない(パック/袋は栄養側の目安量に無い)
  //       ため、1行にパック1つ分の金額がそのまま乗っていた。単位を「1パックの中身」の実数量
  //       (出典つき)へ書き換えて按分できるようにしたぶんの回帰固定。価格(円)は据え置き。
  {
    const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
    eq('PRICE_DEFAULTS いちごの単位は「280g」(1パック250〜300g・代表値280g)', byName.get('いちご')?.unit, '280g')
    eq('PRICE_DEFAULTS 生しいたけの単位は「6枚」(1パック6個前後)', byName.get('生しいたけ')?.unit, '6枚')
    eq('PRICE_DEFAULTS オクラの単位は「10本」(1袋10本前後・100g前後)', byName.get('オクラ')?.unit, '10本')
    eq('PRICE_DEFAULTS 小ねぎの単位は「100g」(1袋100g前後)', byName.get('小ねぎ')?.unit, '100g')
    eq('PRICE_DEFAULTS 粉寒天の単位は「4g」(分包1本=4g)', byName.get('粉寒天')?.unit, '4g')
    eq('PRICE_DEFAULTS ブルーベリーの単位は「100g」(1パック100g前後)', byName.get('ブルーベリー')?.unit, '100g')
    // 価格(円)は1件も変えていない=「いくらか」ではなく「その金額が何に対する値段か」だけを直した
    eq('単位だけの修正でいちごの価格は据え置き', byName.get('いちご')?.pricePerUnit, 400)
        // 2026-08-26 便LF: 生しいたけの目安価格を実勢に合わせて100→280円/6枚にしたので、期待値もそろえた。
    // **便EYが直したのは単位だけ**で、値段を動かしたのは便LFの調べ直しのほう
    // （280円の根拠は src/data/priceDefaults.ts の生しいたけの行のコメント）
    eq('生しいたけの価格は245円（便EYの単位の直しでは動かしていない。便LFが実勢に合わせた）', byName.get('生しいたけ')?.pricePerUnit, 245)
    eq('単位だけの修正でオクラの価格は据え置き', byName.get('オクラ')?.pricePerUnit, 130)
    eq('単位だけの修正で小ねぎの価格は据え置き', byName.get('小ねぎ')?.pricePerUnit, 80)

    const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    eq(
      'パック按分: いちご6個(=90g)は280g400円のマスタから129円(従来は1パック満額400円)',
      estimateIngredientYen({ name: 'いちご', amount: '6', unit: '個' }, idx)?.yen,
      129,
    )
    eq(
      'パック按分: 生しいたけ2枚は6枚245円のマスタから82円(従来は1パック満額。便LFの前は33円)',
      estimateIngredientYen({ name: '生しいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      82,
    )
    eq(
      'パック按分: 生しいたけ5枚は204円(従来は1パック満額。便LFの前は83円)',
      estimateIngredientYen({ name: '生しいたけ', amount: '5', unit: '枚' }, idx)?.yen,
      204,
    )
    eq(
      'パック按分: オクラ8本は10本130円のマスタから104円(従来は1袋満額130円)',
      estimateIngredientYen({ name: 'オクラ', amount: '8', unit: '本' }, idx)?.yen,
      104,
    )
    eq(
      'パック按分: 小ねぎ2本(=10g)は100g80円のマスタから8円(従来は1袋満額80円)',
      estimateIngredientYen({ name: '小ねぎ', amount: '2', unit: '本' }, idx)?.yen,
      8,
    )
    // 粉寒天は「1袋=4g」で中身と分量が元から一致していたため金額は変わらない(単位表記だけを
    // 換算できる形にして、4g以外の分量を書いたときも按分が通るようにした)
    eq(
      'パック按分: 粉寒天4gは4g50円のマスタから50円(金額は従来と同じ)',
      estimateIngredientYen({ name: '粉寒天', amount: '4', unit: 'g' }, idx)?.yen,
      50,
    )
    eq(
      'パック按分: 粉寒天2gは25円(従来は1袋満額50円で分量に追従しなかった)',
      estimateIngredientYen({ name: '粉寒天', amount: '2', unit: 'g' }, idx)?.yen,
      25,
    )
    // レタスは元から按分できていた(マスタ「1個」=栄養側300g・4枚=120g)。今回の対象ではない証明
    eq(
      'レタス4枚は76円(マスタ1個190円からグラム換算で按分。便LFで150→190円にする前は60円)',
      estimateIngredientYen({ name: 'レタス', amount: '4', unit: '枚' }, idx)?.yen,
      76,
    )
    // 「適量」「少々」の薬味は、2026-08-23 便KE から金額を出さない(登録単位が100g=販売単位のため)
    eq(
      '小ねぎ「適量(お好みで)」は金額を出さない(便KE。登録単位100gの満額80円が乗っていた)',
      estimateIngredientYen({ name: '小ねぎ', amount: '適量(お好みで)', unit: '' }, idx)?.yen ?? null,
      null,
    )
  }
  // (8) 同梱109品の合計原価のピン留め(この数字が動いたら按分の前提が変わったということ)
  {
    const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    let grand = 0
    for (const def of starterDefs) grand += estimateRecipeCost(def.ingredients, idx).total
    // 2026-07-29 副菜6品追加で36,780→38,622円(+1,842円=6品ぶん。既存103品の値は不変)
    // 2026-08-10 便EY「1パック丸ごと計上」の修正で38,622→38,047円(-575円)。
    // 下がったのは7品・7材料行(いちご6個/しいたけ4枚/生しいたけ5枚・2枚/オクラ8本/小ねぎ2本×2)
    // 2026-08-10 便FA「しいたけ」の名寄せで38,047→38,014円(-33円)。動いたのは寄せ鍋1品だけで、
    // 「しいたけ4枚」が旧150円/6枚のマスタ(100円)ではなく生しいたけ100円/6枚(67円)で計算される
    // 2026-08-22 便JG「分量が書かれていないこしょう」の修正で38,014→37,934円(-80円)。
    // 動いたのは10行だけ(こしょう「少々」7行・粗びき黒こしょう「少々」3行)で、
    // 登録単位の小さじ1杯まるごと(10円)から「少々」の実量0.3g相当(2円)へ下がった。
    // 塩こしょう(5円/少々)は登録単位が「少々」なので1円も動いていない
    // 2026-08-22 便JI「実勢とずれていた目安価格」の修正で37,934→37,951円(+17円)。
    // バター250→600円/200gで上がったぶんと、小麦粉10→2円・片栗粉10→5円・きな粉15→7円で
    // 下がったぶんの差し引き(同梱109品はバターを使う品が少なく、粉物のほうが多い)
    // 2026-08-23 便KE「単位が噛み合わないときの満額フォールバックをやめる」で37,951→35,826円(-2,125円)。
    // 下がったのは、販売単位(1袋・100g・1本・1株…)で登録された食材の「適量」「お好みで」の行に
    // 買ってきた1つぶんの金額が乗っていた55行(小ねぎ80円×5・かつお節15円×3・パセリ50円×2・
    // グラノーラ500円・ブルーベリー300円・大根おろし100円 ほか)。
    // 登録単位が「1回に使う量」(大さじ1・小さじ1・少々・1かけ・1個分・使用分)の行は1円も動いていない
    // 2026-08-25 便KX「白みそを実測の帯の中へ」で35,826→35,814円(-12円)。動いたのは白みそ大さじ3を使う
    // 西京焼き2品(鮭の西京みそ漬け・さわらの西京焼き)の各1行だけで、45円→39円。
    // 便KXの前方一致の直しでは1円も動いていない(同梱109品の材料は全部、成分表で身元が分かる)
    // 2026-08-26 便LF「価格マスタの調べ直し（第1弾: 乾物・海藻・乳製品・鶏）」で35,814→37,015円(+1,201円)。
    // ヤオコーネットスーパーと東急ストアネットスーパーの税込・家庭用の袋で測り直したところ、
    // **乾物と海藻がそろって実勢の1/3〜1/9で入っていた**（乾燥わかめ/カットわかめ 15→270円/10g・
    // 乾燥芽ひじき 25→220円/10g・昆布 400→1,200円/100g・塩昆布 30→75円/10g・
    // 切り干し大根 130→460円/50g・高野豆腐 150→220円/5枚・しらたき 80→200円/1袋・
    // ピザ用チーズ 300→530円/200g・生クリーム 300→500円/200ml・鶏ささみ 40→65円/1本）。
    // 上がったのは12品で、いちばん大きいのは「ひじきの煮物」50→196円/1食（乾燥芽ひじき15g）。
    // 1件ずつの店名・商品名・容量・税込・調べた日は src/data/priceDefaults.ts の各行のコメント。
    // 2026-08-26 便LF 第2弾（肉の加工品・練り物・乾物）で37,015→37,802円(+787円)。
    // 2026-08-26 便LF 第3弾（豆腐・大豆加工品・乳製品）で37,802→38,121円(+319円)。
    // 2026-08-26 便LF 第4弾（野菜・きのこ・薬味）で38,121→39,777円(+1,656円)。直したのは14件
    // （生しいたけ 100→280円/6枚・にんにく 60→190円/1玉・にら 100→165円/1束・
    //   ブロッコリー 200→280円/1株・さつまいも 100→245円/1本・ゴーヤ 130→245円/1本・
    //   レタス 150→180円/1個・豆苗 100→125円/1パック・ミニトマト 210→310円/200g・
    //   赤パプリカ 200→245円/1個・みつば 100→155円/1束・青じそと大葉 100→125円/10枚・
    //   みょうが 30→65円/1個）で、動いたのは37品。にんにくが17行で使われているので効きが大きい。
    // 2026-08-26 便LF 第5弾（油）で39,777→40,051円(+274円)。
    // 2026-08-26 便LF 第6弾（司令部の差し戻し）で40,051→39,124円(-927円)。
    // 産地で3〜6倍ちがう5件（乾燥わかめ・カットわかめ・乾燥芽ひじき・切り干し大根・にんにく）を
    // **司令部の判断待ちとして元の値に戻した**（国産の並と輸入の並の両方を行のコメントに書き残した）。
    // 2026-08-26 便LF 第7弾（残り全部を「並のグレード」で測り直し）で39,124→38,147円(-977円)。
    // 下がったのは、棚の商品を全部並べた中央値ではなく**各店の標準品を1つずつ**で採り直したため。
    // 2026-08-26 便LF 第8弾（オーナー裁定「産地は輸入の並」）で38,147→38,932円(+785円)。
    // 乾燥わかめ・カットわかめ 15→68円/10g・乾燥芽ひじき 25→96円/10g・切り干し大根 130→118円/50g・
    // にんにく 60→107円/1玉・牛こま切れ肉/牛薄切り肉/牛切り落とし肉 200→253円/100g（3行そろえて）。直したのは3件
    // （ごま油 1,200→1,700円/1L・オリーブオイル 1,400→2,100円/1L・米油 600→880円/1L）で、
    // 動いたのは36品。油はどの店もグラム表示なので、1L＝920g（食用油のふつうの重さ）で直した。
    // 直したのは6件（こんにゃく 60→185円/1枚・油揚げ 20→30円/1枚・生おから 80→130円/300g・
    // 蒸し大豆 80→115円/1パック・プレーンヨーグルト 50→60円/100g）で、動いたのは8品。
    // 直したのは10件（豚ひき肉 120→180円/100g・鶏ひき肉 100→150円/100g・ウインナー 25→35円/1本・
    // ちくわ 25→30円/1本・春雨 120→200円/100g・パン粉 30→55円/50g・オートミール 80→120円/100g・
    // かつお節 15→25円/1袋・干ししいたけ 400→700円/30g）で、動いたのは14品。
    eq('同梱109品の概算食費の合計(便LF第8弾後。便LF第7弾後は38,147円/便LF第6弾後は39,124円/便LF第5弾後は40,051円/便LF第4弾後は39,777円/便LF第3弾後は38,121円/便LF第2弾後は37,802円/便LF第1弾後は37,015円/便KX後は35,814円/便KE後は35,826円/便JI後は37,951円/便JG後は37,934円/便BY修正前は48,377円)', grand, 38932)
    const nabe = starterDefs.find((d) => d.title === '寄せ鍋')
    eq(
      '寄せ鍋 1食あたり(便EY後226円→便FAのしいたけ名寄せで217円→便LFの生しいたけ調べ直しで241円)',
      Math.round(estimateRecipeCost(nabe.ingredients, idx).total / nabe.servings),
      241,
    )
    const soup = starterDefs.find((d) => d.title.includes('中華風卵スープ'))
    // 2026-08-22 便JI: 片栗粉10→5円/大さじ1(実勢600円/kg)で85→82円
    // 2026-08-23 便KE: 「小ねぎ 適量(お好みで)」に小ねぎ100g(1束まるごと)の80円が乗っていた分が抜け82→42円
    // 2026-08-26 便LF: ごま油を1,200→1,700円/1Lにしたので42→44円になった。この節が見張っているのは
    // 「『少々』にボトル1本ぶんの金額が乗らないこと」で、682円のような桁ちがいが出ないこと
    eq('中華風卵スープ 1食あたり(便LF後43円。便KE後42円・便JI後82円・修正前682円はごま油「少々」に1Lボトル満額)', Math.round(estimateRecipeCost(soup.ingredients, idx).total / soup.servings), 43)
    const steamed = starterDefs.find((d) => d.title.includes('レンジ蒸し鶏'))
    eq('レンジ蒸し鶏 1食あたり(修正前48円・鶏むね肉1枚が100g分の90円だった)', Math.round(estimateRecipeCost(steamed.ingredients, idx).total / steamed.servings), 115)
    const teriyaki = starterDefs.find((d) => d.title === '鶏の照り焼き')
    eq('鶏の照り焼き 1食あたり(修正前280円・鶏もも肉2枚が100g分の130円だった)', Math.round(estimateRecipeCost(teriyaki.ingredients, idx).total / teriyaki.servings), 343)
  }
}

// ---------- buildPriceIndex: idの素通し(2026-07-16 裁定1「原価ビュー」全面改修で
// PriceIndexEntryにid追加。原価ビューの価格チップがどのマスタ行を編集すべきか特定するのに使う) ----------
{
  const idx = buildPriceIndex([{ id: 7, name: '玉ねぎ', pricePerUnit: 50, unit: '1個', isDefault: true }])
  eq('buildPriceIndex idを素通しする', idx[0]?.id, 7)
  const idxNoId = buildPriceIndex([{ name: 'にんじん', pricePerUnit: 40, unit: '1本' }])
  eq('buildPriceIndex idが無くてもundefinedのまま動く(後方互換。PRICE_DEFAULTS等idを持たない入力)', idxNoId[0]?.id, undefined)
}

// ---------- unitForm.ts: 単位UI共通化(2026-07-16 裁定1でIngredientPricesPage.tsxから切り出し、
// 原価ビューの価格編集モーダル(PriceEditModal)と共用する。挙動変更ゼロが前提の回帰確認) ----------
{
  eq('decomposeUnit 数量+単位(100g)を分解できる', decomposeUnit('100g'), { qty: '100', unitKind: 'g', freeText: '' })
  eq('decomposeUnit 個数(1個)を分解できる', decomposeUnit('1個'), { qty: '1', unitKind: '個', freeText: '' })
  // 2026-07-21全角対応: 全角の数量+単位(「３００ｇ」)も半角と同じ形に分解できる(副次効果)
  eq(
    'decomposeUnit 全角「３００ｇ」も半角「300g」と同じ形に分解できる',
    decomposeUnit('３００ｇ'),
    { qty: '300', unitKind: 'g', freeText: '' },
  )
  eq(
    'decomposeUnit 単位が先の書式(大さじ1)も分解できる',
    decomposeUnit('大さじ1'),
    { qty: '1', unitKind: '大さじ', freeText: '' },
  )
  eq(
    'decomposeUnit 選択肢に無い単位(1杯)はその他+自由入力にフォールバック',
    decomposeUnit('1杯'),
    { qty: '', unitKind: OTHER_UNIT, freeText: '1杯' },
  )
  eq(
    'decomposeUnit 分解できない書式(少々)もその他+自由入力にフォールバック',
    decomposeUnit('少々'),
    { qty: '', unitKind: OTHER_UNIT, freeText: '少々' },
  )
  eq('composeUnit 数量+単位を合成(100+g→100g)', composeUnit({ qty: '100', unitKind: 'g', freeText: '' }), '100g')
  eq(
    'composeUnit 単位が先の書式で合成(1+大さじ→大さじ1)',
    composeUnit({ qty: '1', unitKind: '大さじ', freeText: '' }),
    '大さじ1',
  )
  eq(
    'composeUnit その他選択時は自由入力をそのまま使う',
    composeUnit({ qty: '', unitKind: OTHER_UNIT, freeText: '1/4個' }),
    '1/4個',
  )
  eq('composeUnit 数量が0以下ならundefined', composeUnit({ qty: '0', unitKind: 'g', freeText: '' }), undefined)
  eq(
    'composeUnit その他選択で自由入力が空(空白のみ)ならundefined',
    composeUnit({ qty: '', unitKind: OTHER_UNIT, freeText: '  ' }),
    undefined,
  )
  // PRICE_DEFAULTS表記と完全一致する制約の回帰(往復でPRICE_DEFAULTSの主要書式が保たれること。
  // updatePriceEntryのisDefault再判定が文字列比較のため崩れるとデフォルト復元機能が壊れる)
  eq('decompose→compose往復(100g)', composeUnit(decomposeUnit('100g')), '100g')
  eq('decompose→compose往復(1個)', composeUnit(decomposeUnit('1個')), '1個')
  eq('decompose→compose往復(大さじ1)', composeUnit(decomposeUnit('大さじ1')), '大さじ1')
  // KNOWN_UNITS一覧(順序込み)がIngredientPricesPageの既存2026-07-15仕様から変わっていないことのピン留め
  eq('KNOWN_UNITS一覧(順序込み)は既存仕様のまま', [...KNOWN_UNITS], [
    'g', 'kg', '個', '本', '枚', 'ml', 'L', '大さじ', '小さじ', 'カップ',
    '玉', '束', 'パック', 'かけ', '片', '株', '尾', '切れ', '丁', '袋', '缶', '房', '節',
  ])
}

// ---------- missingDefaults: 価格マスタのバージョン付きトップアップ移行(2026-07-16再発防止) ----------
// 背景: 初回だけPRICE_DEFAULTSを投入する仕組みのため、古い時期にマスタを作った既存ユーザーは
// その後追加されたPRICE_DEFAULTSが反映されず「価格なし」が多発していた。db/prices.tsの
// seedPriceDefaultsIfNeededは、PRICE_DEFAULTS_VERSIONが上がったときだけmissingDefaultsで
// 「まだ無い項目だけ」を追加する(既存の行やユーザーの上書き価格は一切触らない)
{
  const { missingDefaults } = await import('../../src/db/prices.ts')
  const defaults = [
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
    { name: 'にんじん', pricePerUnit: 40, unit: '1本' },
    { name: 'じゃがいも', pricePerUnit: 40, unit: '1個' },
  ]
  // 既存マスタには「玉ねぎ」だけ入っている(価格をユーザーが80円に上書き済み想定)
  // → 不足分(にんじん・じゃがいも)だけが返り、玉ねぎの上書き価格には触れない(結果に含まれない)
  const existing = [{ name: '玉ねぎ', pricePerUnit: 80, unit: '1個' }]
  const missing = missingDefaults(existing, defaults)
  eq(
    'missingDefaults 既存マスタに一部だけある状態で不足分だけを返す',
    missing.map((d) => d.name).sort(),
    ['じゃがいも', 'にんじん'],
  )
  eq(
    'missingDefaults 既存の上書き価格(玉ねぎ)は結果に含まれない=上書きされない',
    missing.some((d) => d.name === '玉ねぎ'),
    false,
  )
  // かな表記ゆれ(カタカナ⇄ひらがな)がある既存項目も「既にある」とみなし、重複追加しない
  eq(
    'missingDefaults かな表記ゆれ(カタカナ)の既存項目は不足扱いにしない',
    missingDefaults(
      [{ name: 'ニンジン', pricePerUnit: 45, unit: '1本' }],
      [{ name: 'にんじん', pricePerUnit: 40, unit: '1本' }],
    ).length,
    0,
  )
  // 既存マスタが空なら全件が不足扱い(初回相当)
  eq(
    'missingDefaults 既存が空なら全件返す',
    missingDefaults([], defaults).map((d) => d.name),
    defaults.map((d) => d.name),
  )
  // 既存マスタに全項目が揃っていれば何も返さない
  eq('missingDefaults 既存に全項目があれば空配列', missingDefaults(defaults, defaults), [])
}

// ---------- unitFixesToApply: 「単位だけを直す」1回限りの移行(2026-08-10 便EY) ----------
// 背景: マスタの単位が「1パック」「1袋」だと按分の受け皿にならず、レシピが「6個」「2枚」と
// 書いていてもパック1つ分の金額が1行にまるごと乗っていた。PRICE_DEFAULTSの単位を直しても
// 既存ユーザーの行は古い単位のままなので、既定のままの行だけを新単位へ揃える移行を足した。
// ユーザーが手を入れた行(価格を変えた・単位を変えた・自分で追加した)は1件も触らないこと。
{
  const { unitFixesToApply } = await import('../../src/db/prices.ts')
  const { PRICE_DEFAULT_UNIT_FIXES } = await import('../../src/data/priceDefaults.ts')
  const fixes = [{ name: 'いちご', pricePerUnit: 400, fromUnit: '1パック', toUnit: '280g' }]
  const untouched = {
    id: 1, name: 'いちご', pricePerUnit: 400, unit: '1パック',
    isDefault: true, defaultPricePerUnit: 400, defaultUnit: '1パック',
  }
  eq(
    'unitFixesToApply 目安のままの行(isDefault=true・価格も単位も旧既定)は新単位へ',
    unitFixesToApply([untouched], fixes),
    [{ id: 1, name: 'いちご', fromUnit: '1パック', toUnit: '280g' }],
  )
  eq(
    'unitFixesToApply 自分で価格を書き換えた行(isDefault=false)は対象外＝上書きしない',
    unitFixesToApply([{ ...untouched, pricePerUnit: 600, isDefault: false }], fixes),
    [],
  )
  eq(
    'unitFixesToApply 価格だけ旧既定と違う行も対象外(isDefaultの取りこぼし対策の二重チェック)',
    unitFixesToApply([{ ...untouched, pricePerUnit: 600 }], fixes),
    [],
  )
  eq(
    'unitFixesToApply 自分で単位を変えた行は対象外',
    unitFixesToApply([{ ...untouched, unit: '1箱', isDefault: false }], fixes),
    [],
  )
  eq(
    'unitFixesToApply 既に新単位になっている行(新規インストール)は何もしない',
    unitFixesToApply([{ ...untouched, unit: '280g', defaultUnit: '280g' }], fixes),
    [],
  )
  eq(
    'unitFixesToApply 対象外の食材(玉ねぎ)には触れない',
    unitFixesToApply(
      [{ id: 2, name: '玉ねぎ', pricePerUnit: 50, unit: '1個', isDefault: true, defaultPricePerUnit: 50, defaultUnit: '1個' }],
      fixes,
    ),
    [],
  )
  eq(
    'unitFixesToApply 消した食材(行が無い)は勝手に復活させない',
    unitFixesToApply([], fixes),
    [],
  )
  // かな表記ゆれ(カタカナ「イチゴ」で持っている行)も同じ1件として扱う
  eq(
    'unitFixesToApply かな表記ゆれ(イチゴ)の行も対象になる',
    unitFixesToApply([{ ...untouched, name: 'イチゴ' }], fixes).length,
    1,
  )
  // 実データ側: 今回の対象7件が漏れなく載っていること(価格は据え置き=旧既定と同じ値)
  eq(
    'PRICE_DEFAULT_UNIT_FIXES 対象は7件',
    PRICE_DEFAULT_UNIT_FIXES.map((f) => f.name),
    ['いちご', 'しいたけ', '生しいたけ', 'オクラ', '小ねぎ', '粉寒天', 'ブルーベリー'],
  )
  {
    const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
    const UNIT_FIX_PRICE_REVISED = new Set(['生しいたけ'])
    for (const fix of PRICE_DEFAULT_UNIT_FIXES) {
      // 「しいたけ」は2026-08-10 便FAで「生しいたけ」へ名寄せしたためPRICE_DEFAULTSには無い
      // (畳む側の行は版7の PRICE_DEFAULT_MERGES が先に処理する)。記録として配列には残す
      if (fix.name === 'しいたけ') continue
      const current = byName.get(fix.name)
      eq(`PRICE_DEFAULT_UNIT_FIXES ${fix.name}のtoUnitが現行のPRICE_DEFAULTSと一致`, current?.unit, fix.toUnit)
      // 2026-08-26 便LF: 目安価格の調べ直しで、この配列の価格と今の目安価格がずれる行が出た
      // （生しいたけ 100→280円/6枚）。**この配列の数字は直さないこと**——ここの価格は
      // 「移行の対象にする旧い行を見分けるための目印」であって、今の目安価格ではない
      // （db/prices.ts の unitFixesToApply が「価格も単位も旧既定と一致する行」だけを対象にする）。
      // あとから目安価格を直した行はこの一覧に足し、なぜ直したかを priceDefaults.ts の行に書く
      if (UNIT_FIX_PRICE_REVISED.has(fix.name)) {
        eq(
          `PRICE_DEFAULT_UNIT_FIXES ${fix.name}は目安価格をあとから直したので、この配列の価格(旧値)とは違う`,
          current?.pricePerUnit !== fix.pricePerUnit,
          true,
        )
      } else {
        eq(`PRICE_DEFAULT_UNIT_FIXES ${fix.name}の価格は据え置き(移行で金額を動かさない)`, current?.pricePerUnit, fix.pricePerUnit)
      }
    }
  }
}

// ---------- 便FA: しいたけの名寄せ(生／干しを名前で区別する。2026-08-10 オーナー裁定) ----------
// 価格マスタに「しいたけ 150円/6枚」と「生しいたけ 100円/6枚」が別項目で並び、同じ食材なのに
// 値段が違っていた。生の側を「生しいたけ 100円」1本へ寄せ(オーナー指定「どちらかなら生しいたけ」)、
// 乾燥は価格帯が全く違うため別項目として持つ。
// 2026-08-10 便FB: その乾燥側の項目名を「乾燥しいたけ」→「干ししいたけ 400円/30g」に統一した
// (オーナー指示。一般的な表記で、成分表・公開ページの食品名とも揃う)。値段と単位は変えていない。
{
  const { PRICE_DEFAULTS, PRICE_DEFAULTS_VERSION, PRICE_DEFAULT_MERGES } = await import(
    '../../src/data/priceDefaults.ts'
  )
  const { nameMergesToApply } = await import('../../src/db/prices.ts')
  const { buildPriceIndex, estimateIngredientYen, matchPriceEntry } = await import(
    '../../src/logic/priceEstimate.ts'
  )
  const { toHiragana } = await import('../../src/logic/kana.ts')

  const names = PRICE_DEFAULTS.map((d) => d.name)
  eq('FA マスタに素の「しいたけ」項目はもう無い(生しいたけへ名寄せ済み)', names.includes('しいたけ'), false)
  eq('FA マスタの生の項目名は「生しいたけ」', names.includes('生しいたけ'), true)
  eq('FB マスタの乾燥の項目名は「干ししいたけ」(便FBで「乾燥しいたけ」から統一)', names.includes('干ししいたけ'), true)
  eq('FB マスタに旧名「乾燥しいたけ」の項目はもう無い', names.includes('乾燥しいたけ'), false)
  const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
  // 2026-08-26 便LF: 100→280円/6枚に直したので期待値もそろえた。便FAが決めたのは
  // 「生の項目を1つに寄せること」で、値段そのものはあとから実勢に合わせてよい
  eq('FA 生しいたけは1項目で245円/6枚(便FAで名寄せ・2026-08-26 便LFで実勢に合わせた)', {
    yen: byName.get('生しいたけ')?.pricePerUnit,
    unit: byName.get('生しいたけ')?.unit,
  }, { yen: 245, unit: '6枚' })
  // 2026-08-26 便LF: 400→700円/30g に直したので、期待値もそろえた。
  // **便FBが見ているのは「呼び名を変えても値段は変わらない」ことで、値そのものではない**
  // （この節は「乾燥しいたけ」→「干ししいたけ」の改名が価格を巻き込んでいないかの見張り）。
  // 700円の根拠（総務省の基本銘柄「こうしん，国産品，並」に合う6件の中央値712円/30g・
  // 調べた日 2026-08-26）は src/data/priceDefaults.ts の干ししいたけの行のコメント
  eq('FB 干ししいたけは700円/30g(2026-08-26 便LFで実勢に合わせた。呼び名の統一では動かしていない)', {
    yen: byName.get('干ししいたけ')?.pricePerUnit,
    unit: byName.get('干ししいたけ')?.unit,
  }, { yen: 700, unit: '30g' })
  // 2026-08-21 司令部: 版番号は「配るたびに上げる」ものなので、値を書き写して固定すると
  // 足すたびにここが赤くなる（禁じ手③）。**8以上であること**だけを見る
  // （8＝呼び名の統一と移行を配った回。それより下がったら移行が配られない）
  eq('FB 呼び名の統一と移行を配るため版番号を8以上にしている', PRICE_DEFAULTS_VERSION >= 8, true)

  // 名寄せ: 表記が違っても同じ1件に解決する / 生と乾燥は別々の1件に解決する
  {
    const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    for (const written of ['しいたけ', '椎茸', 'シイタケ', '生しいたけ', '生椎茸']) {
      eq(
        `FA 材料名「${written}」は生しいたけ1件に価格解決する`,
        matchPriceEntry(written, idx)?.normalizedName,
        '生しいたけ',
      )
    }
    // 便FBで採用した別名の一覧。旧名「乾燥しいたけ」を含め、どの書き方でも同じ1件に当たること
    for (const written of [
      '干ししいたけ',
      '乾燥しいたけ',
      '干し椎茸',
      '乾しいたけ',
      'ほししいたけ',
      '乾燥椎茸',
      'ほし椎茸',
      'ホシシイタケ',
    ]) {
      eq(
        `FB 材料名「${written}」は干ししいたけ1件に価格解決する(生の値段が当たらない)`,
        matchPriceEntry(written, idx)?.normalizedName,
        '干ししいたけ',
      )
    }
    eq(
      'FA 素の「しいたけ4枚」も生しいたけの行から出る(245円/6枚で163円。便LFの前は67円)',
      estimateIngredientYen({ name: 'しいたけ', amount: '4', unit: '枚' }, idx)?.yen,
      163,
    )
    eq(
      'FA 生しいたけ2枚は82円(便EYの按分の仕方は変えていない。便LFの前は33円)',
      estimateIngredientYen({ name: '生しいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      82,
    )
    eq(
      'FB 干ししいたけ2枚(=6g)は700円/30gから140円(栄養側の1枚=3gでグラムに寄せて按分。便LFの前は80円)',
      estimateIngredientYen({ name: '干ししいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      140,
    )
    eq(
      'FB 旧名「乾燥しいたけ」4枚(=12g)も同じ280円(呼び名を変えても値段は変わらない。便LFの前は160円)',
      estimateIngredientYen({ name: '乾燥しいたけ', amount: '4', unit: '枚' }, idx)?.yen,
      280,
    )
    eq(
      'FB 「干し椎茸」4枚も同じ280円(表記ゆれでも同じ値段になる。便LFの前は160円)',
      estimateIngredientYen({ name: '干し椎茸', amount: '4', unit: '枚' }, idx)?.yen,
      280,
    )
    // 生と干しが同じ照合キーに潰れていないことを直接確かめる(潰れると値段が取り違う)
    eq('FA 生と干しの照合キーは別物', toHiragana('生しいたけ') === toHiragana('干ししいたけ'), false)
    eq('FB 旧名「乾燥しいたけ」も生の照合キーには落ちない', toHiragana('生しいたけ') === toHiragana('乾燥しいたけ'), false)
    // 別名は全部同じ照合キーに収束する(価格・栄養・検索がこのキーで揃う)
    eq(
      'FB 採用した別名はすべて同じ照合キー「ほししいたけ」になる',
      [...new Set(
        ['干ししいたけ', '乾燥しいたけ', '干し椎茸', '乾しいたけ', 'ほししいたけ', '乾燥椎茸', 'ほし椎茸'].map(
          (n) => toHiragana(n),
        ),
      )],
      ['ほししいたけ'],
    )
    // 表示名と五十音順の並び位置を揃えたことの固定(便FB)。読み仮名が「かんそう〜」のままだと
    // 「食材と価格」で「干ししいたけ」が「か」の位置に出て、名前を見て探せない
    eq('FB 読み仮名は表示名と揃える(「か」ではなく「ほ」の位置に並ぶ)', toHiragana('干ししいたけ').startsWith('ほ'), true)
    // 「しいたけ（生）／しいたけ（乾燥）」案を採らなかった理由の回帰: 括弧書きは照合の前に
    // 落とされるため、この命名だと2項目が同じキーになり、どちらの値段が当たるか決まらない
    const parenIdx = buildPriceIndex([
      { name: 'しいたけ（生）', pricePerUnit: 100, unit: '6枚' },
      { name: 'しいたけ（乾燥）', pricePerUnit: 400, unit: '30g' },
    ])
    eq(
      'FA 括弧で分ける命名は照合キーが同じになる(この案を採らなかった根拠)',
      parenIdx[0].matchKey === parenIdx[1].matchKey,
      true,
    )
  }

  // 既存端末の重複行を1行に畳む移行(規約F: 何が変わって何が残るか)
  {
    const merges = PRICE_DEFAULT_MERGES
    const v6Old = {
      id: 1,
      name: 'しいたけ',
      pricePerUnit: 150,
      unit: '6枚',
      isDefault: true,
    }
    const v6New = {
      id: 2,
      name: '生しいたけ',
      pricePerUnit: 100,
      unit: '6枚',
      isDefault: true,
    }
    eq(
      'nameMergesToApply 版6の端末: 目安のままの「しいたけ」を消して「生しいたけ」に寄せる',
      nameMergesToApply([v6Old, v6New], merges, PRICE_DEFAULTS),
      [{ kind: 'delete', id: 1, name: 'しいたけ', toName: '生しいたけ' }],
    )
    eq(
      'nameMergesToApply 版5の端末(単位が1パックのまま)も同じように畳める',
      nameMergesToApply(
        [
          { ...v6Old, unit: '1パック' },
          { ...v6New, unit: '1パック' },
        ],
        merges,
        PRICE_DEFAULTS,
      ),
      [{ kind: 'delete', id: 1, name: 'しいたけ', toName: '生しいたけ' }],
    )
    eq(
      'nameMergesToApply 自分で価格を入れた行(isDefault=false)は消さない',
      nameMergesToApply([{ ...v6Old, pricePerUnit: 999, isDefault: false }, v6New], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'nameMergesToApply 価格だけ旧既定と違う行も対象外(isDefaultの取りこぼし対策の二重チェック)',
      nameMergesToApply([{ ...v6Old, pricePerUnit: 999 }, v6New], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'nameMergesToApply 自分で単位を変えた行は対象外',
      nameMergesToApply([{ ...v6Old, unit: '1kg' }, v6New], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'nameMergesToApply 統合先を自分で消していたら、畳む側を「生しいたけ」に書き換える(行を失わせない)',
      nameMergesToApply([v6Old], merges, PRICE_DEFAULTS),
      // 2026-08-26 便LF: 書き換え先の値は「いまのPRICE_DEFAULTS」から取る作りなので、
      // 生しいたけを100→280円にしたぶん、ここも280円になる（FBの干ししいたけと同じ）
      [{ kind: 'rename', id: 1, name: 'しいたけ', toName: '生しいたけ', pricePerUnit: 245, unit: '6枚' }],
    )
    eq(
      'nameMergesToApply 新規インストール(生しいたけだけ)は何もしない',
      nameMergesToApply([v6New], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'nameMergesToApply 「しいたけ」を自分で消していたら何もしない(勝手に復活させない)',
      nameMergesToApply([], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'nameMergesToApply 統合先が自分の価格でも、畳む側(目安のまま)だけを消す＝自分の値は残る',
      nameMergesToApply([v6Old, { ...v6New, pricePerUnit: 120, isDefault: false }], merges, PRICE_DEFAULTS),
      [{ kind: 'delete', id: 1, name: 'しいたけ', toName: '生しいたけ' }],
    )
    eq(
      'nameMergesToApply 関係ない食材(玉ねぎ)には触れない',
      nameMergesToApply(
        [{ id: 9, name: '玉ねぎ', pricePerUnit: 50, unit: '1個', isDefault: true }],
        merges,
        PRICE_DEFAULTS,
      ),
      [],
    )
    // 畳む側と統合先はどちらも同じ読み仮名キーになる。ここを normalizeForDuplicateCheck で
    // 判定すると「生しいたけ」の行まで畳む側と誤認するので、素の名前で見ていることを固定する
    eq(
      'nameMergesToApply 統合先「生しいたけ」の行そのものは絶対に畳まない',
      nameMergesToApply(
        [{ ...v6New, pricePerUnit: 150, unit: '6枚' }],
        merges,
        PRICE_DEFAULTS,
      ),
      [],
    )

    // ---- 便FB: 版7の端末（「乾燥しいたけ 400円/30g」を受け取り済み）からの移行 ----
    // 版7は本番に約30分だけ出ていたので、この行を持つ端末が実在する。
    // 「干ししいたけ」の行はまだ無いので kind は rename になる＝行が増えも減りもしない
    const v7Dry = {
      id: 3,
      name: '乾燥しいたけ',
      pricePerUnit: 400,
      unit: '30g',
      isDefault: true,
    }
    eq(
      'FB nameMergesToApply 版7の端末: 目安のままの「乾燥しいたけ」は「干ししいたけ」に畳まれる',
      nameMergesToApply([v6New, v7Dry], merges, PRICE_DEFAULTS),
      [
        {
          kind: 'rename',
          id: 3,
          name: '乾燥しいたけ',
          toName: '干ししいたけ',
          pricePerUnit: 700,
          unit: '30g',
        },
      ],
    )
    // 2026-08-26 便LF: 期待値を400→700円にそろえた。**書き換え先の値は「いまのPRICE_DEFAULTS」から
    // 取る**作り（db/prices.ts の nameMergesToApply が defaultByName から引く）なので、
    // 目安価格を直せばここも一緒に動くのが正しい。旧題は「1円も動かない」だったが、
    // それは当時の目安が旧値と同じ400円だったから成り立っていただけで、
    // **この節が見張っているのは「呼び名の統一が、目安のままの行だけを対象にすること」**のほう
    eq(
      'FB nameMergesToApply 版7の端末: 畳んだ行は、いまの目安価格(700円/30g)になる',
      nameMergesToApply([v7Dry], merges, PRICE_DEFAULTS).map((p) => ({
        yen: p.pricePerUnit,
        unit: p.unit,
      })),
      [{ yen: 700, unit: '30g' }],
    )
    eq(
      'FB nameMergesToApply 自分で価格を入れた「乾燥しいたけ」の行は触らない(自分の値が残る)',
      nameMergesToApply([{ ...v7Dry, pricePerUnit: 250, isDefault: false }], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'FB nameMergesToApply 価格だけ旧既定と違う行も対象外(isDefaultの取りこぼし対策の二重チェック)',
      nameMergesToApply([{ ...v7Dry, pricePerUnit: 250 }], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'FB nameMergesToApply 自分で単位を変えた「乾燥しいたけ」の行も対象外',
      nameMergesToApply([{ ...v7Dry, unit: '100g' }], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'FB nameMergesToApply 版5・版6の端末は「乾燥しいたけ」の行を持たない＝空振りする',
      nameMergesToApply([v6New], merges, PRICE_DEFAULTS),
      [],
    )
    eq(
      'FB nameMergesToApply 「干ししいたけ」を既に持つ端末では旧名の目安行を消す(二重に増やさない)',
      nameMergesToApply(
        [{ id: 4, name: '干ししいたけ', pricePerUnit: 400, unit: '30g', isDefault: true }, v7Dry],
        merges,
        PRICE_DEFAULTS,
      ),
      [{ kind: 'delete', id: 3, name: '乾燥しいたけ', toName: '干ししいたけ' }],
    )
    eq(
      'FB nameMergesToApply 統合先「干ししいたけ」の行そのものは絶対に畳まない',
      nameMergesToApply(
        [{ id: 4, name: '干ししいたけ', pricePerUnit: 400, unit: '30g', isDefault: true }],
        merges,
        PRICE_DEFAULTS,
      ),
      [],
    )
    // 版5・版6・版7のどこから上がっても最後は同じ姿になること（移行→トップアップの順で確かめる）
    {
      const { missingDefaults } = await import('../../src/db/prices.ts')
      const shiitakeNames = (rows) => {
        const plans = nameMergesToApply(rows, merges, PRICE_DEFAULTS)
        const removed = new Set(plans.filter((p) => p.kind === 'delete').map((p) => p.id))
        const renamed = new Map(plans.filter((p) => p.kind === 'rename').map((p) => [p.id, p.toName]))
        const after = rows
          .filter((r) => !removed.has(r.id))
          .map((r) => ({ ...r, name: renamed.get(r.id) ?? r.name }))
        const added = missingDefaults(after, PRICE_DEFAULTS)
        return [...after.map((r) => r.name), ...added.map((d) => d.name)]
          .filter((n) => n.includes('しいたけ'))
          .sort()
      }
      const goal = ['干ししいたけ', '生しいたけ']
      eq(
        'FB 版5の端末(しいたけ150円/1パック＋生しいたけ100円/1パック)からでも同じ2行になる',
        shiitakeNames([
          { ...v6Old, unit: '1パック' },
          { ...v6New, unit: '1パック' },
        ]),
        goal,
      )
      eq(
        'FB 版6の端末(しいたけ150円/6枚＋生しいたけ100円/6枚)からでも同じ2行になる',
        shiitakeNames([v6Old, v6New]),
        goal,
      )
      eq(
        'FB 版7の端末(生しいたけ＋乾燥しいたけ)からでも同じ2行になる',
        shiitakeNames([v6New, v7Dry]),
        goal,
      )
      eq(
        'FB 新規インストール相当(行が無い)でも同じ2行になる',
        shiitakeNames([]),
        goal,
      )
      // 自分で値段を入れた行は残す＝その端末だけ旧名の行が1行多く残る（規約F: 何が残るか）
      eq(
        'FB 自分で編集した「乾燥しいたけ」がある端末は、その行が残ったうえで干ししいたけが増える',
        shiitakeNames([v6New, { ...v7Dry, pricePerUnit: 250, isDefault: false }]),
        ['乾燥しいたけ', '生しいたけ'],
      )
    }
  }

  // 名寄せで同じ照合キーの行が2つ残る端末（自分で「しいたけ」を編集していた場合）では、
  // 自分で入れた値段のほうを使う。移行は編集済みの行を消さないので、この優先順位が要る
  {
    const mixed = buildPriceIndex([
      { id: 1, name: '生しいたけ', pricePerUnit: 100, unit: '6枚', isDefault: true },
      { id: 2, name: 'しいたけ', pricePerUnit: 240, unit: '6枚', isDefault: false },
    ])
    eq(
      'FA 同じ照合キーの行が2つあるときは自分で入れた値段が勝つ',
      estimateIngredientYen({ name: 'しいたけ', amount: '6', unit: '枚' }, mixed),
      { yen: 240, rawYen: 240, source: 'user' },
    )
    eq(
      'FA 並び順が逆でも結果は同じ(索引の作り方で決めている)',
      estimateIngredientYen(
        { name: '生しいたけ', amount: '6', unit: '枚' },
        buildPriceIndex([
          { id: 2, name: 'しいたけ', pricePerUnit: 240, unit: '6枚', isDefault: false },
          { id: 1, name: '生しいたけ', pricePerUnit: 100, unit: '6枚', isDefault: true },
        ]),
      ),
      { yen: 240, rawYen: 240, source: 'user' },
    )
  }

  // 名寄せしても栄養側は生／乾燥を取り違えない(成分が10倍違うので致命的)
  {
    const { matchNutritionFood } = await import('../../src/logic/nutrition.ts')
    eq('FA 栄養: 「しいたけ」は生しいたけの食品', matchNutritionFood('しいたけ')?.label, 'しいたけ')
    eq('FA 栄養: 「生しいたけ」も生しいたけの食品', matchNutritionFood('生しいたけ')?.label, 'しいたけ')
    eq('FA 栄養: 「乾燥しいたけ」は干ししいたけの食品(名寄せ前は生に当たっていた)', matchNutritionFood('乾燥しいたけ')?.label, '干ししいたけ')
    eq('FA 栄養: 「干ししいたけ」も干ししいたけの食品', matchNutritionFood('干ししいたけ')?.label, '干ししいたけ')
    // 便FB: 価格マスタの項目名と成分表の食品名が同じ文字列になったこと。
    // ここが食い違っていたため、公開ページ public/about/foods.html だけが「干ししいたけ」で
    // 出ていて、アプリの「食材と価格」は「乾燥しいたけ」という状態になっていた
    eq(
      'FB 価格マスタの項目名と栄養データの食品名が一致する(公開ページとの食い違いの解消)',
      matchNutritionFood('干ししいたけ')?.label,
      PRICE_DEFAULTS.find((d) => d.name === '干ししいたけ')?.name,
    )
    eq(
      'FB 成分表側の別名にも旧名「乾燥しいたけ」が入っている(公開ページの別名欄に出る)',
      matchNutritionFood('干ししいたけ')?.aliases.includes('乾燥しいたけ'),
      true,
    )
  }

  // 検索: 名寄せ後も「しいたけ」で引ける(searchWordsは読み仮名の形で入る)
  {
    const { buildSearchWords } = await import('../../src/logic/kana.ts')
    const words = buildSearchWords('きのこ炒め', [{ name: '生しいたけ', amount: '3', unit: '枚' }], [])
    eq(
      'FA 検索: 材料「生しいたけ」のレシピは「しいたけ」でも引ける',
      words.some((w) => w.includes(toHiragana('しいたけ'))),
      true,
    )
    eq(
      'FA 検索: カテゴリ語「きのこ」も従来どおり付く',
      words.some((w) => w.includes(toHiragana('きのこ'))),
      true,
    )
    const dried = buildSearchWords('煮物', [{ name: '乾燥しいたけ', amount: '4', unit: '枚' }], [])
    eq(
      'FA 検索: 「乾燥しいたけ」のレシピもカテゴリ語「きのこ」で引ける',
      dried.some((w) => w.includes(toHiragana('きのこ'))),
      true,
    )
  }
}

// ---------- 便CX: 公開ページ「食品と目安価格の一覧」がマスタと一致していること ----------
// public/about/foods.html は scripts/gen-food-price-page.mjs がマスタ2本(栄養=nutritionData.ts /
// 価格=priceDefaults.ts)から機械生成する。マスタを直したのに再生成し忘れると、公開ページだけ
// 古い数値が残る＝対外的に事実と違う表が出たままになる。ここで生成物とマスタを突き合わせる
// (落ちたら `npm run gen:foods` で再生成する)。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const html = readFileSync(path.join(appRoot, 'public/about/foods.html'), 'utf-8')
  const allRows = html.match(/<tr><th scope="row"[\s\S]*?<\/tr>/g) ?? []
  const foodRows = allRows.filter((r) => r.includes('class="src"'))
  const aliasRows = allRows.filter((r) => r.includes('class="ref"'))
  const nameOf = (row) => row.match(/<th scope="row" class="nm">([^<]*)/)?.[1] ?? ''
  const cellsOf = (row) => Array.from(row.matchAll(/<td[^>]*>([^<]*)<\/td>/g)).map((m) => m[1])
  // 価格マスタの照合キー(logic/priceEstimate.tsと同じ「括弧を落としてかな正規化」)
  const priceKey = (name) => toHiragana(name.replace(/[（(][^）)]*[）)]/g, '').trim())

  // (1) 行数がマスタ件数と一致する
  eq('CX foods.html 食品の行数=栄養マスタの件数', foodRows.length, NUTRITION_DATA.foods.length)
  const listedFoods = foodRows.map(nameOf)
  eq('CX foods.html 食品名の重複なし', new Set(listedFoods).size, listedFoods.length)
  eq(
    'CX foods.html 載っていない食品0件',
    NUTRITION_DATA.foods.filter((f) => !listedFoods.includes(f.label)).map((f) => f.label),
    [],
  )

  // (2) 価格マスタは1件残らずページのどこかに出る
  //     (食品の行に目安価格として出るか、末尾の「別の名前でも登録している目安価格」に出るか)
  const pricedFoodKeys = new Set(
    foodRows.filter((r) => !cellsOf(r)[0].includes('価格なし')).map((r) => priceKey(nameOf(r))),
  )
  const aliasNames = new Set(aliasRows.map(nameOf))
  eq(
    'CX foods.html 一覧に出ていない目安価格0件',
    PRICE_DEFAULTS.filter((p) => !aliasNames.has(p.name) && !pricedFoodKeys.has(priceKey(p.name))).map(
      (p) => p.name,
    ),
    [],
  )
  eq(
    'CX foods.html 食品行に出した価格の種類+別名の行数=価格マスタの件数',
    pricedFoodKeys.size + aliasRows.length,
    PRICE_DEFAULTS.length,
  )

  // (3) 抜き取り3品の値がマスタと一字一句一致する(桁の丸め・列の並びの取り違えを検知)
  const dec1 = (v) => (Math.round(v * 10) / 10).toFixed(1)
  // 2026-08-26 便LF: 抜き取りに「昆布」を足した。それまでの3品はどれも便LFで値を直していない品で、
  // **目安価格を直したのにページを再生成し忘れても、この検査は素通りしていた**（(2)は名前が
  // 出ているかしか見ていない）。値を直した品を1つ入れておくと、次に値を直した便が気づける
  for (const label of ['玉ねぎ', '鶏もも肉', 'しょうゆ', '昆布']) {
    const food = NUTRITION_DATA.foods.find((f) => f.label === label)
    const master = PRICE_DEFAULTS.find((p) => priceKey(p.name) === priceKey(label))
    const cells = cellsOf(foodRows.find((r) => nameOf(r) === label) ?? '')
    eq(`CX foods.html ${label}の目安価格`, cells[0], `${master.pricePerUnit}円 / ${master.unit}`)
    eq(`CX foods.html ${label}の成分値(8項目)`, cells.slice(1, 9), [
      String(Math.round(food.per100g.kcal)),
      dec1(food.per100g.proteinG),
      dec1(food.per100g.fatG),
      dec1(food.per100g.carbG),
      dec1(food.per100g.fiberG),
      dec1(food.per100g.saltG),
      dec1(food.per100g.ironMg),
      String(Math.round(food.per100g.calciumMg)),
    ])
    eq(`CX foods.html ${label}の成分表の収載名`, cells[9], food.mextName)
  }
}

// ---------- 便JG: 原価の数字が嘘をついている（2026-08-22 オーナーの書き溜め） ----------
// オーナー原文（抜粋）:
//   「食材の原価で、一般的によく使うのに元から設定がない材料が多い」
//   「カルボナーラ・スパゲティが原価なし。ペペロンチーノにはあったのに。表記揺れ？」
//   「ティラミス・卵黄と卵白がそれぞれ約１円は明らかに間違い」
//   「ハヤシライス・塩コショウサラダ油は分量なし。こしょう５円…って高い」
//   「原価が、人数分の表示に合わせて計算されていない。人数の増減で数値が変わらない」
//   「『価格なし』が複数ある場合には、目安とはいえ実際と大きく異なることを記号でお知らせして欲しい」
//
// ここで見張るのは、オーナーの実データ31品で実測した「そのとき出ていた数字」そのもの。
// 直す前はすべて赤になることを確認してから直している。
{
  const jgIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const jgHit = (name) => matchPriceEntry(name, jgIndex)?.normalizedName ?? 'なし'
  const jgYen = (name, amount, unit) =>
    estimateIngredientYen({ name, amount, unit }, jgIndex)?.yen ?? null

  // --- JG-1: 同じ食材の書き方ちがいで価格が当たらない（スパゲティ／スパゲッティ型の表記ゆれ） ---
  // オーナーの31品に実在する書き方。左が材料名、右が当たってほしい食材価格マスタの項目名
  for (const [written, expected] of [
    ['スパゲティ', 'スパゲッティ'], // カルボナーラ（ペペロンチーノは「スパゲッティ1.6mm」で当たっていた）
    ['マカロニ', 'スパゲッティ'],
    ['薄力粉', '小麦粉'],
    ['上白糖', '砂糖'],
    ['白ネギ（あれば）', '長ねぎ'],
    ['溶き卵', '卵'],
    ['全卵', '卵'],
    ['温泉卵', '卵'],
    ['有塩バター', 'バター'],
    ['料理酒', '酒'],
    ['すりおろしニンニク', 'おろしにんにく'],
    ['エビ', 'むきえび'],
    ['海老', 'むきえび'],
    ['豚こま切れ', '豚こま切れ肉'],
    ['合挽き肉', '合いびき肉'],
    ['温かいご飯', 'ご飯'],
    ['水溶き片栗粉', '片栗粉'],
    ['唐辛子(輪切り)', '赤唐辛子'],
    ['赤ピーマン', '赤パプリカ'],
    ['ドライパセリ', 'パセリ'],
  ]) {
    eq(`JG-1 「${written}」が価格マスタの「${expected}」に当たる`, jgHit(written), expected)
  }

  // --- JG-2: 前方一致で別の食材に当たってしまう（値段が桁で違う誤爆） ---
  for (const [written, expected] of [
    ['トマトケチャップ', 'ケチャップ'], // 旧: トマト1個60円が丸ごと乗っていた
    ['トマト水煮缶（カット）', 'カットトマト缶'], // 旧: トマト1個60円
    ['昆布だし', 'だし汁'], // 旧: 昆布100g 400円
    ['塩鮭', '塩鮭'], // 旧: 塩 小さじ1 = 1円（2切れで1円）
    ['甘塩鮭', '塩鮭'],
  ]) {
    eq(`JG-2 「${written}」が「${expected}」に当たる（別の食材に当たらない）`, jgHit(written), expected)
  }

  // --- JG-3: 卵黄・卵白が「卵1個ぶんの満額」になっていた ---
  // 旧実測（ティラミス）: 卵黄「2個分」→ 25円（卵1個の満額）／卵白「2個分」→ 25円。
  // 卵1個(25円)を可食部の重さの比（卵黄1：卵白2）で分けた値にする＝両方使うレシピでは
  // 合計が卵の値段と一致する（卵黄2個分16円＋卵白2個分34円＝50円＝卵2個）
  eq('JG-3 卵黄は卵の行に当たらない', jgHit('卵黄'), '卵黄')
  eq('JG-3 卵白は卵の行に当たらない', jgHit('卵白'), '卵白')
  eq('JG-3 卵黄2個分は16円（8円×2）', jgYen('卵黄', '2', '個分'), 16)
  eq('JG-3 卵白2個分は34円（17円×2）', jgYen('卵白', '2', '個分'), 34)
  eq('JG-3 卵黄1個分＋卵白1個分＝卵1個の値段', jgYen('卵黄', '1', '個分') + jgYen('卵白', '1', '個分'), 25)

  // --- JG-4: 分量が書かれていない材料に、登録単位まるごとの金額が乗っていた ---
  // 旧実測（ハヤシライス・2人分）: こしょう(分量なし) → 小さじ1杯まるごとの10円が1行に乗り、
  // 1食あたり5円と表示されていた。「少々」の実量は栄養側が既に持っている値（こしょう0.3g）を使う
  eq('JG-4 分量なしのこしょうは小さじ1杯まるごと(10円)にならない', jgYen('こしょう', '', '') !== 10, true)
  eq('JG-4 分量なしのこしょうは約2円（0.3g÷小さじ1=2g×10円）', jgYen('こしょう', '', ''), 2)
  eq('JG-4 「少々」と書いたこしょうも同じ', jgYen('こしょう', '少々', ''), 2)
  eq('JG-4 黒こしょうも同じ', jgYen('黒こしょう', '少々', ''), 2)
  // 分量が数値で書いてあるときは今までどおり按分する（仮の量に置き換えない）
  eq('JG-4 こしょう小さじ1/2は5円のまま', jgYen('こしょう', '1/2', '小さじ'), 5)
  // サラダ油は同梱109品の最頻値「大さじ1」のまま（400円/1L×15ml=6円）＝変えていない
  eq('JG-4 分量なしのサラダ油は大さじ1ぶんの6円のまま', jgYen('サラダ油', '', ''), 6)

  // --- JG-5: 原価の行が、画面に出ている人数分の分量に追随していなかった ---
  // 旧実測（シフォンケーキ・登録17人分を2人分で表示）: 材料は「卵 1/2個」と出るのに、
  // 原価の行は「約6円」（100円÷17人分）で、半分の卵の値段（約12円）と合っていなかった
  {
    const egg = { name: '卵', amount: '4', unit: '個' }
    const row17 = estimateIngredientRowCost(egg, jgIndex, 17, 17)
    const row2 = estimateIngredientRowCost(egg, jgIndex, 17, 2)
    const row4 = estimateIngredientRowCost(egg, jgIndex, 17, 4)
    eq('JG-5 登録人数のままなら全量ぶん(卵4個=100円)', row17?.shownYen, 100)
    eq('JG-5 2人分にすると2/17ぶん(約12円)になる', row2?.shownYen, 12)
    eq('JG-5 人数を増やすと金額も増える', row4?.shownYen, 24)
    eq('JG-5 1食あたりの値は今までどおり登録人数で割った値', row2?.perServingYen, 6)
  }

  // --- JG-6: 「価格なし」があることを知らせる判定 ---
  // オーナー原文（2026-08-22 便JG）「『価格なし』が複数（１つだったとしても金額によっては
  // 大きいが）ある場合には、目安とはいえ実際と大きく異なることを記号でお知らせして欲しい」
  // 「ティラミスとか、１食４円なわけない。チーズがたくさん」。判定そのものを純ロジックとして持たせる。
  //
  // 【2026-08-25 便KS・⑤ オーナー指示で条件を変えた】原文:
  // 「価格なし材料が１つでもあるのに※表記がない（２つ以上だと※がつくのに）と、何を基準に
  //  表記しているのかユーザーとしては不安になります。やはり１つでも価格なしになったら表記しましょう」
  //   旧: 2件以上 または（1件でもそれが主材料）→ 知らせる
  //   新: 1件でも知らせる
  // 旧条件では「主材料かどうか」を機械が決めていたので、同じ「価格が分からない材料1件」でも
  // 材料の書き方次第で印が出たり出なかったりし、画面からは基準が読めなかった。
  eq('JG-6 知らせるかどうかの判定が logic/priceEstimate.ts にある', typeof priceEstimateModule.recipeCostConfidence, 'function')
  {
    const conf = (ings) => priceEstimateModule.recipeCostConfidence(ings, jgIndex)
    // 同梱109品は全材料に価格があるので1品も知らせない（実測: 109品中0品。条件を緩めても0品）
    let starterWarn = 0
    for (const def of starterDefs) if (conf(def.ingredients).shouldWarn) starterWarn++
    eq('JG-6 同梱109品では1品も知らせない（価格が全部そろっているため）', starterWarn, 0)
    // 2026-08-25 便KS・⑤: 調味料1件でも知らせる（旧: 知らせない）
    eq(
      'JG-6 分からないのが調味料1件だけでも知らせる（2026-08-25 オーナー指示で条件を変えた）',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '架空の調味料', amount: '少々', unit: '' },
      ]).shouldWarn,
      true,
    )
    // 件数は印の意味の1行（ja.detail.costPricelessNote「価格が分からない材料{n}件を除いた概算です」）に
    // そのまま出る。印が出る条件と、そこに出る件数が食い違わないことを数で押さえる
    eq(
      'JG-6 知らせるときの件数は、価格が分からない材料の数と一致する',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '架空の調味料', amount: '少々', unit: '' },
      ]).pricelessCount,
      1,
    )
    // 価格がすべてそろっていれば、今までどおり知らせない（印が常時出る形にはしない）
    eq(
      'JG-6 価格が全部そろっていれば知らせない',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: 'にんじん', amount: '1/2', unit: '本' },
      ]).shouldWarn,
      false,
    )
    // 1件でも主材料なら知らせる（オーナー「１つだったとしても金額によっては大きい」）
    // 2026-08-26 便LF: 例を「マスカルポーネチーズ 250g」から「架空の主材料 250g」に差し替えた。
    // オーナーが挙げた実例（ティラミス）はマスカルポーネだったが、便LFでチーズ6種の目安価格を
    // 足したので、**マスカルポーネはもう「価格が分からない材料」ではなくなった**（280円/100g）。
    // この節が見ているのは「分からないのが主材料1件でも知らせるか」という判定のほうなので、
    // 材料名を、値段の付いていない名前に置き換えて同じ形を保つ
    //（この節の他の例と同じ「架空の…」の書き方にそろえた）。
    eq(
      'JG-6 分からないのが主材料1件なら知らせる（ティラミスのマスカルポーネチーズ 250g と同じ形）',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '架空の主材料', amount: '250', unit: 'g' },
      ]).shouldWarn,
      true,
    )
    // 調味料でも2件以上なら知らせる（オーナー「『価格なし』が複数ある場合」）
    eq(
      'JG-6 分からないのが2件以上なら、調味料でも知らせる',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '架空の調味料', amount: '少々', unit: '' },
        { name: '架空の香辛料', amount: '少々', unit: '' },
      ]).shouldWarn,
      true,
    )
    // 水・湯・氷水・ゆで汁は価格を付ける対象ではないので数えない
    eq(
      'JG-6 水・氷水・ゆで汁は「価格が分からない材料」に数えない',
      conf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '水', amount: '300', unit: 'ml' },
        { name: '氷水', amount: '適量', unit: '' },
        { name: 'ゆで汁', amount: '90', unit: 'cc' },
      ]),
      { pricelessCount: 0, hasPricelessMainIngredient: false, shouldWarn: false },
    )
  }

  // --- JG-7: 足した既定価格が入っていること（値は各行の根拠つきコメントを参照） ---
  for (const [name, pricePerUnit, unit] of [
    ['卵黄', 8, '1個分'],
    ['卵白', 17, '1個分'],
    // 2026-08-26 便LF: 300→500円/200ml。乳脂肪35%の生クリームを200ml換算でそろえた実売の中央値。
    // ヤオコーのネットスーパーは生クリームを扱っていないため、実売は東急ストアの3件
    // （タカナシ特選35% 200ml 462円／明治おいしい生クリーム 200ml 516円／
    //   タカナシ北海道純生35% 100ml 279円＝558円/200ml。中央516円）。調べた日 2026-08-26。
    // 帯・調べた日・なぜ変えたかは src/data/priceDefaults.ts の行のコメントに書いてある
    ['生クリーム', 490, '200ml'],
    ['赤ワイン', 600, '1L'],
    ['ローリエ', 5, '1枚'],
    ['えんどう豆', 250, '200g'],
    ['ホットケーキミックス', 300, '600g'],
    ['無塩バター', 600, '200g'],
    ['マッシュルーム', 180, '100g'],
    ['粉砂糖', 15, '大さじ1'],
    ['青ねぎ', 80, '100g'],
    ['塩鮭', 150, '1切れ'],
    ['黒こしょう', 10, '小さじ1'], // 「粗びき黒こしょう」からの改名（価格・単位は据え置き）
  ]) {
    const entry = PRICE_DEFAULTS.find((d) => d.name === name)
    eq(`JG-7 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, entry && [entry.pricePerUnit, entry.unit], [pricePerUnit, unit])
  }
  // 改名した旧名は残っていないこと（同じ食材が2行になるのを防ぐ）
  eq('JG-7 旧名「粗びき黒こしょう」の行は残っていない', PRICE_DEFAULTS.some((d) => d.name === '粗びき黒こしょう'), false)
  eq('JG-7 旧名で書いたレシピも「黒こしょう」の1件に解決する', jgHit('粗びき黒こしょう'), '黒こしょう')
  // 既存端末の行を改名する移行が入っていること
  eq(
    'JG-7 「粗びき黒こしょう」→「黒こしょう」の改名が PRICE_DEFAULT_MERGES にある',
    PRICE_DEFAULT_MERGES_FOR_JG.some((m) => m.fromName === '粗びき黒こしょう' && m.toName === '黒こしょう'),
    true,
  )
  // 2026-08-22 便JIで11へ上げたので、ここは「便JGの時点まで上がっている」ことだけを見る
  eq('JG-7 版番号を上げてある（上げないと既存の端末に新しい行が届かない）', PRICE_DEFAULTS_VERSION_FOR_JG >= 10, true)
  eq('JG-7 読み仮名辞書の版番号も上げてある', READINGS_VERSION >= 7, true)
}

// ---------- 便JI: 目安価格が古いまま取り残される（2026-08-22 オーナー裁定「１A ２A」） ----------
// 背景（src/data/priceDefaults.ts 冒頭に元から書いてあった限界）:
//   「このトップアップ機構は『名前がまだ無い項目の追加』専用であり、既存項目の価格・単位の
//     『更新』には使われない…『デフォルトに戻す』操作でも、旧デフォルト値に戻るだけで新値には
//     ならない…既存ユーザー全員に新値を反映する専用の再シード処理は今回は実装していない」
// オーナー裁定:
//   1＝A案「再投入の仕組みを作る。『食材と価格』に『最新の目安値に更新する』を置き、
//           自分で直した値は上書きしない（既定のままの行だけ入れ替える）」
//   2＝A案「test-price.mjs のピン留めを解いて、実勢に合わせる」
//
// ここで測るのは「利用者が確かめたいこと」:
//   ①古い目安のままの端末で押したら、新しい目安価格に変わる
//   ②自分で直した価格・自分で追加した食材は1件も変わらない
//   ③そのあと「デフォルトに戻す」を押しても新しい値に戻る（＝戻り先も追随している）
//   ④押す前に「変わるもの／変わらないもの」が件数つきで読める（規約F）
//   ⑤実勢と桁で食い違っていた目安価格が直っている
{
  const jiByName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
  /** 一覧の1行を作る（省いたものは「投入時の目安のまま」の姿になる） */
  const jiRow = (id, name, pricePerUnit, unit, extra = {}) => ({
    id,
    name,
    pricePerUnit,
    unit,
    isDefault: true,
    defaultPricePerUnit: pricePerUnit,
    defaultUnit: unit,
    ...extra,
  })

  // --- JI-1: 実勢と食い違っていた目安価格を直す（値の根拠は priceDefaults.ts の各行のコメント） ---
  // 便JGの実測: 小麦粉・片栗粉は10円/大さじ1（＝1,111円/kg）で実勢の約4倍、バターは250円/200gで約半分
  for (const [name, pricePerUnit, unit] of [
    ['小麦粉', 2, '大さじ1'],
    ['片栗粉', 5, '大さじ1'],
    ['きな粉', 7, '大さじ1'],
    ['バター', 600, '200g'],
  ]) {
    const entry = jiByName.get(name)
    eq(`JI-1 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, entry && [entry.pricePerUnit, entry.unit], [pricePerUnit, unit])
  }
  // 洗って「据え置き」にしたものも、勝手に動かないよう留めておく（根拠は報告と各行のコメント）
  for (const [name, pricePerUnit] of [
    ['白いりごま', 15],
    ['黒いりごま', 15],
    ['すりごま', 15],
    // 2026-08-25 便KX で 15→13円。便JIは「西京白みそ500g 362〜399円」だけを見て据え置いたが、
    // 便KWが**他のみそと同じ測り方(同じ容量帯・店舗別購入価格)でそろえて測り直す**と
    // 500g帯の実売は597〜798円/kg＝10.8〜14.4円/大さじ1で、15円(833円/kg)は帯の外(上)だった。
    // 帯の中央697.5円/kg＝12.6円/大さじ1を四捨五入して13円(722円/kg)。根拠は priceDefaults.ts の行
    ['白みそ', 13],
    ['レモン汁', 15],
    ['粉砂糖', 15],
    ['みそ', 11],
  ]) {
    eq(`JI-1 「${name}」は実勢を調べたうえで${pricePerUnit}円のまま`, jiByName.get(name)?.pricePerUnit, pricePerUnit)
  }
  // 金額として出たときに実勢どおりか（利用者が見るのは1行の金額なので、そこで測る）
  {
    const jiIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    const jiYen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, jiIndex)?.yen ?? null
    // 目安は「2円/大さじ1」で持つので、100g換算では 2円÷9g×100g=22円（実勢25円に対して丸めのぶん低い。
    // 単位を「1kg」等の重さにするとレシピの大さじ書きと次元が食い違うため、docs/49 §4と同じく体積で持つ）
    eq('JI-1 小麦粉100gは22円（実勢250円/kg＝25円に丸めのぶんだけ届かない）', jiYen('小麦粉', '100', 'g'), 22)
    eq('JI-1 薄力粉と書いても同じ22円', jiYen('薄力粉', '100', 'g'), 22)
    eq('JI-1 片栗粉大さじ1は5円（実勢600円/kg）', jiYen('片栗粉', '1', '大さじ'), 5)
    eq('JI-1 バター10gは30円（実勢600円/200g）', jiYen('バター', '10', 'g'), 30)
    eq('JI-1 有塩バターと書いても同じ30円', jiYen('有塩バター', '10', 'g'), 30)
  }
  // 2026-08-23 便KE で厚揚げ・小松菜・豆苗・大豆水煮・キムチを足したので版12、
  // 2026-08-25 便KP で減塩しょうゆ・減塩みそ・水菜ほか15件を足したので版13。
  // ここは「下がっていないこと」を見る（上げるのは正しい変更なので、足すたびに赤くしない）
  eq('JI-1 版番号を上げてある（上げないと新しい行が既存の端末に届かない）', PRICE_DEFAULTS_VERSION_FOR_JG >= 12, true)

  // --- JI-2: 古い目安のままの行だけを新しい目安価格に入れ替える ---
  {
    const rows = [
      jiRow(1, '小麦粉', 10, '大さじ1'), // 古い目安のまま → 入れ替える
      jiRow(2, 'バター', 250, '200g'), // 古い目安のまま → 入れ替える
      jiRow(3, '玉ねぎ', 50, '1個'), // 既に今の目安と同じ → 触らない
    ]
    const plan = planPriceRefresh(rows, PRICE_DEFAULTS)
    eq(
      'JI-2 古い目安のままの2件だけが入れ替えの対象になる',
      plan.targets.map((t) => [t.name, t.fromPricePerUnit, t.toPricePerUnit]),
      [
        ['小麦粉', 10, 2],
        ['バター', 250, 600],
      ],
    )
    eq('JI-2 単位も新しい既定に合わせる', plan.targets.map((t) => [t.fromUnit, t.toUnit]), [
      ['大さじ1', '大さじ1'],
      ['200g', '200g'],
    ])
    eq('JI-2 既に最新の行は数えるだけで触らない', [plan.keptByUser, plan.alreadyCurrent], [0, 1])
    // 2回目は0件（押しても押しても同じ姿＝二度押しで壊れない）
    const after = rows.map((r) => {
      const t = plan.targets.find((x) => x.id === r.id)
      return t ? { ...r, pricePerUnit: t.toPricePerUnit, unit: t.toUnit, defaultPricePerUnit: t.toPricePerUnit, defaultUnit: t.toUnit } : r
    })
    eq('JI-2 もう一度計画しても0件（最新になった端末では何も起きない）', planPriceRefresh(after, PRICE_DEFAULTS).targets.length, 0)
  }

  // --- JI-3: 自分で直した価格・自分で追加した食材は1件も触らない（オーナー裁定の核心） ---
  {
    const rows = [
      // 自分で価格を直した行（isDefault=false）。中身が古い既定でも触らない
      jiRow(1, '小麦粉', 30, '大さじ1', { isDefault: false, defaultPricePerUnit: 10, defaultUnit: '大さじ1' }),
      // 自分で単位まで変えた行
      jiRow(2, 'バター', 250, '1箱', { isDefault: false, defaultPricePerUnit: 250, defaultUnit: '200g' }),
      // 自分で追加した食材（投入時の目安を持たない）
      { id: 3, name: 'マスカルポーネチーズ', pricePerUnit: 400, unit: '100g', isDefault: false },
      // isDefaultが未設定の古い行（「自分の価格」として安全側に扱う既存の作法に合わせる）
      { id: 4, name: '片栗粉', pricePerUnit: 10, unit: '大さじ1' },
    ]
    const plan = planPriceRefresh(rows, PRICE_DEFAULTS)
    eq('JI-3 自分で直した行・自分で追加した行は1件も入れ替えない', plan.targets, [])
    eq('JI-3 触らない件数として全件を数える（画面が「変わらないもの」を言えるように）', plan.keptByUser, 4)
  }

  // --- JI-4: 「デフォルトに戻す」の戻り先も新しい値に追随する（②の後半） ---
  // 追随させないと、更新したあとに自分で直して「デフォルトに戻す」を押すと古い値に戻ってしまう
  {
    const rows = [jiRow(1, '小麦粉', 10, '大さじ1')]
    const targets = planPriceRefresh(rows, PRICE_DEFAULTS).targets
    eq('JI-4 入れ替え後の値が今の既定と一致する', targets.map((t) => [t.toPricePerUnit, t.toUnit]), [[2, '大さじ1']])
    // 画面（db/prices.ts）はこの計画を使って price/unit と default 側を同じ値で書く。
    // 計画そのものが「戻り先に入れる値」を持っていることを固定する（別の値を作らない）
    eq(
      'JI-4 計画は戻り先に入れる値を持っている（別の値を作らない）',
      targets.map((t) => t.toPricePerUnit),
      [jiByName.get('小麦粉')?.pricePerUnit],
    )
  }

  // --- JI-5: 押す前に「変わるもの／変わらないもの」が件数つきで読める（規約F） ---
  {
    const rows = [
      jiRow(1, '小麦粉', 10, '大さじ1'),
      jiRow(2, '片栗粉', 10, '大さじ1'),
      jiRow(3, 'きな粉', 15, '大さじ1'),
      jiRow(4, 'バター', 250, '200g'),
      jiRow(5, '玉ねぎ', 99, '1個', { isDefault: false, defaultPricePerUnit: 50, defaultUnit: '1個' }),
    ]
    const plan = planPriceRefresh(rows, PRICE_DEFAULTS)
    const content = priceRefreshConfirm(plan)
    const text = confirmContentText(content).replaceAll('​', '')
    eq('JI-5 何件変わるかが確認に出る', text.includes('4件'), true)
    eq('JI-5 変わらないものの件数も出る', text.includes('1件'), true)
    eq('JI-5 「よろしいですか？」だけにしない（変わるもの・変わらないものを両方書く）', [
      text.includes(ja.priceMaster.refreshChangedLabel),
      text.includes(ja.priceMaster.refreshKeptLabel),
    ], [true, true])
    eq('JI-5 何が変わるのかを名前でも見せる', text.includes('小麦粉'), true)
    eq('JI-5 実行側のボタンは何が起きるか分かる動詞にする', content.confirmLabel, ja.priceMaster.refreshConfirmAction)
    eq('JI-5 取り消せることを添える', text.includes(ja.common.undo), true)
    // 名前は多くても3件まで（確認の窓が長文にならないように・規約H）
    const many = Array.from({ length: 20 }, (_, i) => jiRow(i + 1, PRICE_DEFAULTS[i].name, 1, 'x'))
    const manyText = confirmContentText(priceRefreshConfirm(planPriceRefresh(many, PRICE_DEFAULTS)))
    eq('JI-5 対象が多くても名前は3件まで＋「ほか」', manyText.includes(ja.priceMaster.refreshMoreNames), true)
    eq('JI-5 対象が多くても確認の文は200字以内', confirmContentText(priceRefreshConfirm(planPriceRefresh(many, PRICE_DEFAULTS))).length <= 200, true)
  }

  // --- JI-6: 名前の突き合わせは、かな表記ゆれ込みで既存の作法と同じ ---
  eq('JI-6 カタカナで持っている行も同じ食材として突き合わせる', normalizePriceName('バター'), normalizePriceName('ばたー'))
  eq('JI-6 括弧書き・前後の空白は落とす', normalizePriceName('  小麦粉（薄力）  '), normalizePriceName('小麦粉'))
  {
    const plan = planPriceRefresh([jiRow(1, 'バター（有塩）', 250, '200g')], PRICE_DEFAULTS)
    eq('JI-6 括弧書きで持っている行も入れ替えの対象になる', plan.targets.map((t) => t.toPricePerUnit), [600])
  }
}

// ============================================================================
// JJ: 2026-08-22 便JJ（オーナーがテスト用データ31品を一ユーザーとして見た書き溜め）
// ============================================================================
{
  // --- JJ-1: 取り込み元が記号（○☆★◎●◇）で合わせ調味料の組を示していたら、色が付く ---
  //
  // オーナー原文:「一緒に量る材料の色分けができていないものがあった。できてるものもあるので、
  //   違いは何？」「お店みたいな回鍋肉 ・調味料の色分けなし。『◯調味料を合わせておく』手順が
  //   あるが、材料に印がない。」
  //
  // 実測（2026-08-22）: 元ページ（楽天レシピ 1180017436）の Recipe 書式には
  //   "○醤油 大さじ1" … "○おろしニンニク（チューブ） 1-2センチ" と**印が入っている**のに、
  //   取り込んだ結果は「醤油」「味噌」…と印も組も消えていた。
  //   原因は Worker 側（workers/recipe-import/src/normalize.ts の BULLET_PREFIX）が
  //   ○☆★◎●◇ を「行頭の飾り」としてまとめて捨てていたこと。アプリ側の組の判定
  //   （parseRecipeText の assignSeasoningGroupsByMark）は印を見て組を作れるのに、
  //   その印が届く前に消えていた。英字（A/B）は group として持ち回っていたので
  //   味の素パークの「手づくり回鍋肉」だけ色が付いていた＝これが「違いは何？」の答え。
  const jjRakutenIngredients = [
    '豚こま切れ 150-200g',
    'キャベツ 4-5枚',
    'ピーマン 大2-3個',
    '白ネギ（あれば） 2分の1',
    'ごま油 大さじ1',
    '○醤油 大さじ1',
    '○味噌 大さじ1',
    '○酒 大さじ1',
    '○豆板醤 小さじ1-2',
    '○砂糖 小さじ2',
    '○水 大さじ2',
    '○片栗粉 小さじ1',
    '○おろしニンニク（チューブ） 1-2センチ',
  ]
  const jjRows = buildImportedIngredientRows(jjRakutenIngredients.map((line) => splitIngredientAmount(line)))
  eq(
    'JJ-1 ○の付いた材料が1つの組になる（元ページに印があるのに色が付かない、を再発させない）',
    jjRows.filter((r) => r.group === 1).map((r) => r.name),
    ['醤油', '味噌', '酒', '豆板醤', '砂糖', '水', '片栗粉', 'おろしニンニク（チューブ）'],
  )
  eq(
    'JJ-1 印の付いていない材料は組に入らない',
    jjRows.filter((r) => r.group != null).length,
    8,
  )
  eq('JJ-1 印は材料名には戻さない（栄養・原価の名前照合を壊さない）', jjRows[5].name, '醤油')
  eq('JJ-1 どの印だったかはメモに残る', jjRows[5].memo.includes('○'), true)
  // 行頭のただの飾り（・）は今までどおり落とす＝組にはしない
  eq(
    'JJ-1 中黒だけの飾りは組にしない',
    buildImportedIngredientRows(
      ['・豚こま切れ 150g', '・キャベツ 4枚', '・醤油 大さじ1'].map((l) => splitIngredientAmount(l)),
    ).every((r) => r.group == null),
    true,
  )
  // 全部の材料に同じ印が付いているときは飾り＝組にしない（assignSeasoningGroupsByMark の規則）
  eq(
    'JJ-1 全部に同じ印が付いていたら飾りとみなして組にしない',
    buildImportedIngredientRows(
      ['○豚こま切れ 150g', '○キャベツ 4枚', '○醤油 大さじ1'].map((l) => splitIngredientAmount(l)),
    ).every((r) => r.group == null),
    true,
  )
  eq('JJ-1 印だけの行は材料にしない', splitIngredientAmount('○').name, '')

  // --- JJ-2: 一覧カードの食材チップに調味料を出さない ---
  //
  // オーナー原文:「しっかり食感プリン ・レシピ一覧から見た表示の一番上が「上白糖」
  //   （材料は卵３個＝60g×３個なので、上白糖計130gや牛乳150mlよりも多いはず）。」
  //
  // 実測（2026-08-22・テスト用データ31品）: 辞書（seasoningDictionary）は名前の完全一致だけを
  // 見ていたので、同じ物でも書き方が違うと素通りしていた。素通りしていた実例:
  //   上白糖（プリン・チップの1番目）／ゆで汁（ペペロンチーノ・2番目）／
  //   マンジョウ米麹こだわり仕込み本みりん（ぶり大根・3番目）／
  //   トマトケチャップ（ハヤシライス・3番目）／うま味調味料（丸ごと無限ピーマン・3番目）
  const jjChip = (name, amount, unit) =>
    pickDisplayIngredientChips([{ name, amount, unit }], 3).map((c) => c.name)
  eq('JJ-2 上白糖は食材チップに出さない', jjChip('上白糖', '100', 'g'), [])
  eq('JJ-2 グラニュー糖も出さない', jjChip('グラニュー糖', '30', 'g'), [])
  eq('JJ-2 粉砂糖も出さない', jjChip('粉砂糖', '10', 'g'), [])
  eq('JJ-2 ゆで汁は出さない', jjChip('ゆで汁', '90', 'cc'), [])
  eq(
    'JJ-2 商品名が頭に付いたみりんも出さない',
    jjChip('マンジョウ米麹こだわり仕込み本みりん', '1/4', 'カップ'),
    [],
  )
  eq('JJ-2 トマトケチャップは出さない', jjChip('トマトケチャップ', '120', 'g'), [])
  eq('JJ-2 うま味調味料は出さない', jjChip('うま味調味料', '3', '振り'), [])
  eq('JJ-2 昆布だしは出さない', jjChip('昆布だし', '200', 'ml'), [])
  // 本物の食材は今までどおり出る（除外を広げすぎていないことの歯止め）
  eq('JJ-2 肉・魚・野菜は今までどおり出る', [
    jjChip('豚こま切れ', '150', 'g'),
    jjChip('生鮭', '3', '切'),
    jjChip('キャベツ', '4', '枚'),
    jjChip('マカロニ', '60', 'g'),
    jjChip('卵', '4', '個'),
  ], [['豚こま切れ'], ['鮭'], ['キャベツ'], ['マカロニ'], ['卵']])

  // --- JJ-3: 設定「困ったとき」「古い記録の書き出し」の文言（オーナー指示どおり） ---
  eq('JJ-3 消えるものは言い切らない（「だけです」を付けない）', ja.settings.refreshAppWhatIsCleared, '消えるもの: 画面の一時ファイル')
  eq(
    'JJ-3 残るものは「画面の一時ファイル以外のすべてのデータ」と書く',
    ja.settings.refreshAppWhatRemains,
    '残るもの: レシピ・価格・設定・解錠コードなど、画面の一時ファイル以外のすべてのデータ',
  )
  eq(
    'JJ-3 更新との使い分けは「お使いください」で終える',
    ja.settings.refreshAppVsUpdateNote,
    '新しいバージョンにしたいだけなら、「アプリの更新」の「最新の状態にする」をお使いください',
  )
  eq('JJ-3 古い記録の書き出しは、アーカイブと同じものだと分かる名前にする', ja.settings.archiveTitle, '古い記録の書き出し（アーカイブ）')

  // --- JJ-4: 「優先されます」と書かない（実装は除外なので、文言を実装に合わせる） ---
  //
  // オーナー原文:「『優先されます』→優先ということは、他に候補がなければ、季節や時間帯の設定が
  //   ない（もしくは選択とは違う設定の）レシピが選ばれることがあるの？」
  //
  // 実測（2026-08-22・logic/mealPlan.ts suggestCandidates 859行 / logic/season.ts
  // preferSeasonWithFallback 47行）: 季節は**候補から外している**（献立の自動提案は
  // 緩和の分岐が無く、季節外しか無ければ0件のまま返す）。時間帯も、未設定のレシピが
  // 1品でも残っていれば緩和の分岐は動かない＝選んだ時間帯以外には出ない。
  // 同じ食い違いは「調理時間◯分以内を優先」で一度裁定済みで、そのときも文言を実装に合わせた。
  eq('JJ-4 季節の説明に「優先」と書かない', /優先/.test(ja.form.seasonDescription), false)
  eq('JJ-4 時間帯の説明に「優先」と書かない', /優先/.test(ja.form.suitableForDescription), false)
  eq('JJ-4 区画の見出しは「献立提案・検索に必要な設定」', ja.form.detailSectionPlanning, '献立提案・検索に必要な設定')
  eq(
    'JJ-4 検索キーワードの説明から「検索したときだけ効きます」を外す（大前提なので書かない）',
    /検索したときだけ効きます/.test(ja.form.keywordsDescription),
    false,
  )
  eq(
    'JJ-4 検索キーワードの説明は「検索で見つけやすくなります」で終える',
    ja.form.keywordsDescription,
    '一覧や詳細には表示されません。別の呼び方・言いかえを入れておくと、検索で見つけやすくなります',
  )

  // --- JJ-5: レシピ詳細の原価トグルの戻り側 ---
  // オーナー原文:「『材料に戻す』→『材料を表示』」
  eq('JJ-5 原価を閉じる側のボタンは「材料を表示」', ja.detail.priceViewHide, '材料を表示')
  eq(
    'JJ-5 押す前と押したあとでボタンの文字数を変えない（右端そろえの行なので幅が動く）',
    ja.detail.priceViewShow.length,
    ja.detail.priceViewHide.length,
  )

  // --- JJ-6: 元ページの手順番号が本文に残らない（【１】（１）の形） ---
  //
  // オーナー原文:「３つのスパイスバターチキンカレー ・元の文の手順番号がそのまま残ってる」
  // 実測（2026-08-22・直す前）:
  //   S&B    「【１】ポリ袋に鶏肉、スティックスパイスを入れて…」→ 【１】が残る
  //   味の素 「（１）豚肉はひと口大に切る。…」→ （１）が残る
  // アプリは手順番号を自分で振るので、残ると「1 【１】ポリ袋に…」と二重に並ぶ。
  eq('JJ-6 【1】の形の手順番号を落とす', normalizeInstructions([
    '【１】ポリ袋に鶏肉、スティックスパイスを入れてよくもみ込みます。',
  ]), ['ポリ袋に鶏肉、スティックスパイスを入れてよくもみ込みます。'])
  eq('JJ-6 （1）の形の手順番号を落とす', normalizeInstructions([
    '（１）豚肉はひと口大に切る。',
  ]), ['豚肉はひと口大に切る。'])
  eq('JJ-6 前の手順を指す番号は本文に残す（消すと文が壊れる）', normalizeInstructions([
    '（２）の豚肉・ねぎを戻し入れて合わせる。',
  ]), ['（２）の豚肉・ねぎを戻し入れて合わせる。'])
  eq('JJ-6 本文の中の番号は消さない', normalizeInstructions([
    '【２】フライパンにバターを熱し、さらに【１】を汁ごと加え、炒めます。',
  ]), ['フライパンにバターを熱し、さらに【１】を汁ごと加え、炒めます。'])
  eq('JJ-6 合わせ調味料の【Ａ】は番号ではないので落とさない', normalizeInstructions([
    '【Ａ】を加えてもみ込みます。',
  ]), ['【Ａ】を加えてもみ込みます。'])

  // --- JJ-7: 「動画をご覧ください」だけの手順を残さない ---
  //
  // オーナー原文:「丸ごとピーマン ・手順１がいきなり「動画をご覧ください」。これは省けないのか」
  // 実測（2026-08-22・直す前）: 貼り付け取り込みの手順1件目が
  //   「詳しい作り方は動画をご覧ください。」だけで、作り方が1文字も書かれていなかった。
  eq('JJ-7 作り方が書かれていない「動画をご覧ください」の行は落とす', [
    isImportGomiLine('詳しい作り方は動画をご覧ください。'),
    isImportGomiLine('作り方は動画をご覧ください'),
    isImportGomiLine('動画をご覧ください。'),
  ], [true, true, true])
  eq(
    'JJ-7 作り方が一緒に書いてある行は落とさない（手順が黙って消えるほうが実害が大きい）',
    isImportGomiLine('焼き加減は動画をご覧ください。フライパンで両面を焼く'),
    false,
  )
  {
    const jjPasted = [
      '丸ごと無限ピーマン',
      '材料',
      'ピーマン 3-4個',
      'ツナ缶 1/2缶',
      '作り方',
      '詳しい作り方は動画をご覧ください。',
      'ピーマン3〜4個を容器にいれラップし600w4分チン',
    ].join('\n')
    eq('JJ-7 貼り付け取り込みでも1件目に残らない', parseRecipeText(jjPasted).steps, [
      'ピーマン3〜4個を容器にいれラップし600w4分チン',
    ])
  }

  // --- JJ-8: 用語の説明の箇条書きが、どの画面でも同じように行に分かれる ---
  //
  // オーナー原文（レンジ温泉卵）:「電子レンジとか、調理中モードでの説明が、箇条書きの内容なのに
  //   箇条書きの改行がされていない。読みづらい。文字の塊にしか見えないので、私がユーザーなら
  //   絶対読まない。」
  // 実測（2026-08-22・直す前）: 用語の小窓（components/TermPopover）は「｜」を改行に直してから
  // 箇条書きとして描いていたのに、調理中モード（components/FocusMode）は説明文をそのまま
  // 1行で描いていた（「｜」がそのまま文字として出て、5項目が1つの塊になっていた）。
  {
    const jjMicrowave = COOKING_TERMS.find((t) => t.term === '電子レンジ')
    eq('JJ-8 前提: 用語「電子レンジ」の説明は箇条書き（「｜」区切り）で持っている', jjMicrowave?.description.includes('｜'), true)
    const jjSplit = splitTermDescription(jjMicrowave.description)
    eq('JJ-8 最初の一文と、その下の箇条書きに分かれる', [
      jjSplit.lead.includes('｜'),
      jjSplit.details.split('\n').length,
      jjSplit.details.split('\n').every((line) => line.startsWith('・')),
    ], [false, 4, true])
    eq(
      'JJ-8 まるごと渡す形（用語の小窓）でも「｜」は1つも残らない',
      termDescriptionLines(jjMicrowave.description).includes('｜'),
      false,
    )
    eq(
      'JJ-8 事実は1つも落ちていない（分けても中身は元の説明と同じ）',
      termDescriptionLines(jjMicrowave.description).split('\n').join('｜'),
      jjMicrowave.description,
    )
    // 箇条書きを持たない用語は今までどおり1行のまま
    eq('JJ-8 箇条書きの無い用語は分けない', splitTermDescription('油をひかずに炒って水分を飛ばすこと'), {
      lead: '油をひかずに炒って水分を飛ばすこと',
      details: '',
    })
    // 辞書全体で「｜」が本文に残らないこと（新しい用語を足したときの取りこぼし防止）
    eq(
      'JJ-8 辞書のどの用語も「｜」が本文に残らない形で描ける',
      COOKING_TERMS.filter((t) => termDescriptionLines(t.description).includes('｜')).map((t) => t.term),
      [],
    )
    // 説明文を「｜」の分け方を通さずに画面へ流している場所が無いか（この見張りが、
    // 調理中モードだけ1行のままだった形をそのまま掴む）。新しい画面が同じ書き方を
    // 増やしたときにも赤くなる
    {
      const jjRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
      const jjFiles = []
      for (const dir of ['src/components', 'src/pages']) {
        // 2026-08-25 便KZ で src/pages/mealPlan/ ができたので、下の階層まで走査する
        for (const name of readdirSync(path.join(jjRoot, dir), { recursive: true })) {
          if (name.endsWith('.tsx')) jjFiles.push(path.join(dir, name))
        }
      }
      const jjRaw = jjFiles.filter((rel) => {
        const src = readFileSync(path.join(jjRoot, rel), 'utf-8')
        // 「term.description」を、splitTermDescription / termDescriptionLines を通さずに描いている
        return /\{\s*(?:renderJaUnits\()?\w*[Tt]erm\.description\)?\s*\}/.test(src)
      })
      eq('JJ-8 用語の説明を、分け方を通さずにそのまま描いている画面が無い', jjRaw, [])
      eq('JJ-8 見張りが対象のファイルを掴めている', jjFiles.length > 20, true)
    }
  }
}

// ==========================================================================================
// JK-1〜JK-5: 写真の見える範囲（2026-08-22 便JK）
//
// オーナー原文（最初の指摘）:
//   「画像の中心がずれている。設定からも直せない。一覧よりも詳細画面が気になりやすいが、
//     一覧もよくみたらちゃんとずれてる。」
// それを踏まえた返答（これが作るものの指示）:
//   「画像の中心ズレについて、画像のサイズの真ん中ではなく、画像の中で被写体が真ん中に
//     写っていない、ということです。これは自動ではどうにもできない部分だと思うので、
//     ゆーざーが見える範囲を微調整（トリミングっぽい感じ）できたら嬉しい、ということです。」
//
// 直す前の状態: 切り抜き位置は写真つき22品すべて中央（50% 50%）で、位置を動かすコードは
// 1行も無かった。つまり「被写体が中央に写っていない写真」は、利用者にはどうにもできなかった。
//
// 何を見張るか:
//   JK-1 … 見える範囲の計算が、ブラウザの object-fit: cover と同じ答えを出すこと
//          （実データ22品の実寸で確かめる。詳細＝16:9、レシピ一覧のマス＝1:1）
//   JK-2 … 保存する値の作法（中央なら値を持たない・範囲外は端で止まる・小数は整数に丸める）
//   JK-3 … 書き出し／読み込みが、レシピの項目を丸ごと持っていく形のままであること
//          （持っていく項目を並べる形に変えると、新しい項目が黙って落ちる）
//   JK-4 … 見え方の値を作っているのは logic/photoFocus.ts だけ（画面での直書きが無い）
//   JK-5 … 共通のカード部品では、写真を切って出す <img> がもれなく見える範囲を受け取ること
//          （**レシピ一覧の絵と詳細の大きな絵の両方**がこの部品にあるので、片方だけ効く形にならない）
// ==========================================================================================
{
  // ---- JK-1: 見える範囲の計算 ------------------------------------------------------------
  const round4 = (r) => ({
    left: Math.round(r.left * 10000) / 10000,
    top: Math.round(r.top * 10000) / 10000,
    width: Math.round(r.width * 10000) / 10000,
    height: Math.round(r.height * 10000) / 10000,
  })
  const DETAIL = 16 / 9 // レシピ詳細の大きな絵
  const LIST = 1 // レシピ一覧のマス

  // 縦写真（実データ: 900x1600）。詳細では高さの31.6%しか見えない＝上下が68.4%落ちる
  eq(
    'JK-1 縦写真は詳細（16:9）で上下が落ち、中央では落ちる分が上下に半分ずつ',
    round4(photoVisibleRect(900, 1600, DETAIL, undefined)),
    { left: 0, top: 0.3418, width: 1, height: 0.3164 },
  )
  eq(
    'JK-1 いちばん上を見せると、見える範囲は写真の上端から始まる',
    round4(photoVisibleRect(900, 1600, DETAIL, { x: 50, y: 0 })).top,
    0,
  )
  eq(
    'JK-1 いちばん下を見せると、見える範囲の下端が写真の下端にそろう',
    round4(photoVisibleRect(900, 1600, DETAIL, { x: 50, y: 100 })),
    { left: 0, top: 0.6836, width: 1, height: 0.3164 },
  )
  // 横写真（実データ: 1200x630）。レシピ一覧のマスでは幅の52.5%しか見えない＝左右が47.5%落ちる
  eq(
    'JK-1 横写真はレシピ一覧のマス（1:1）で左右が落ちる',
    round4(photoVisibleRect(1200, 630, LIST, undefined)),
    { left: 0.2375, top: 0, width: 0.525, height: 1 },
  )
  eq(
    'JK-1 いちばん左を見せると、見える範囲は写真の左端から始まる',
    round4(photoVisibleRect(1200, 630, LIST, { x: 0, y: 50 })).left,
    0,
  )
  // 正方形（実データ: 400x400 ほか11品）。一覧では1ドットも落ちない＝横に動かしても何も変わらない
  eq(
    'JK-1 正方形の写真はレシピ一覧のマスでは落ちない',
    round4(photoVisibleRect(400, 400, LIST, undefined)),
    { left: 0, top: 0, width: 1, height: 1 },
  )
  eq(
    'JK-1 落ちる分が無い向きは、値を変えても見える範囲が動かない',
    round4(photoVisibleRect(400, 400, LIST, { x: 0, y: 100 })),
    round4(photoVisibleRect(400, 400, LIST, { x: 100, y: 0 })),
  )
  eq(
    'JK-1 正方形の写真は詳細（16:9）では上下が43.8%落ちる',
    round4(photoVisibleRect(400, 400, DETAIL, undefined)).height,
    0.5625,
  )
  // ちょうど16:9の写真（実データ: 880x495）はどちらの向きにも落ちない
  eq(
    'JK-1 ちょうど16:9の写真は詳細で1ドットも落ちない',
    round4(photoVisibleRect(880, 495, DETAIL, { x: 0, y: 100 })),
    { left: 0, top: 0, width: 1, height: 1 },
  )
  // 壊れた値（写真の寸法が読めない等）でも写真全体を返す＝画面が真っ白にならない
  eq('JK-1 寸法が読めないときは写真全体を見える範囲にする', round4(photoVisibleRect(0, 0, DETAIL, { x: 10, y: 10 })), {
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  })

  // ---- JK-2: 保存する値の作法 ------------------------------------------------------------
  eq('JK-2 未設定は中央として読む', clampPhotoFocus(undefined), PHOTO_FOCUS_CENTER)
  eq('JK-2 未設定の見え方は中央（既存のレシピの見え方を変えない）', photoObjectPosition(undefined), '50% 50%')
  eq('JK-2 中央のままなら値を持たせない', toStoredPhotoFocus({ x: 50, y: 50 }), undefined)
  eq('JK-2 調整したら値を持つ', toStoredPhotoFocus({ x: 50, y: 18 }), { x: 50, y: 18 })
  eq('JK-2 範囲の外は端で止まる', clampPhotoFocus({ x: -40, y: 180 }), { x: 0, y: 100 })
  eq('JK-2 小数は整数に丸める（保存する値を1%刻みにそろえる）', clampPhotoFocus({ x: 33.4, y: 66.6 }), { x: 33, y: 67 })
  eq('JK-2 数でない値が入っても中央に倒す', clampPhotoFocus({ x: Number.NaN, y: Number.NaN }), PHOTO_FOCUS_CENTER)
  eq('JK-2 中央かどうかを見分けられる', [isPhotoFocusCentered(undefined), isPhotoFocusCentered({ x: 50, y: 49 })], [true, false])
  eq('JK-2 矢印キーぶん動かしても範囲の外には出ない', movePhotoFocus({ x: 1, y: 99 }, -2, 2), { x: 0, y: 100 })
  eq('JK-2 見え方の文字列は割合で出す', photoObjectPosition({ x: 20, y: 80 }), '20% 80%')

  // ---- JK-3: 書き出し／読み込みが項目を丸ごと持っていく形のままか --------------------------
  // 実際に値が往復することは e2e（JKPHOTO-03）で本物のファイルを書き出して確かめている。
  // ここでは「持っていく項目を並べる形（allow-list）に書き換えられていないか」を見張る
  // ＝新しい項目を足した人が backup.ts を直し忘れても、黙って落ちることが起きない形を守る
  {
    const jkRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const jkBackup = readFileSync(path.join(jkRoot, 'src/logic/backup.ts'), 'utf-8')
    eq(
      'JK-3 書き出しは写真と記録以外を丸ごと持っていく（項目を並べる形になっていない）',
      jkBackup.includes('const { photo, cookedLogs, ...rest } = recipe'),
      true,
    )
    eq(
      'JK-3 読み込みも写真と記録以外を丸ごと戻す',
      jkBackup.includes('const { photoBase64, photoType, cookedLogs, ...rest } = backup'),
      true,
    )
  }

  // ---- JK-4: 見え方の値を作るのは1か所だけ ------------------------------------------------
  {
    const jkRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const jkSrc = path.join(jkRoot, 'src')
    const listFiles = (dir) => {
      const out = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...listFiles(full))
        else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) out.push(full)
      }
      return out.sort()
    }
    const jkFiles = listFiles(jkSrc).map((full) => ({
      rel: path.relative(jkRoot, full).split(path.sep).join('/'),
      src: readFileSync(full, 'utf-8'),
    }))
    eq('JK-4 走査できたファイルがある（0件なら見張りが壊れている）', jkFiles.length > 50, true)
    // object-position を使う画面は、必ず logic/photoFocus.ts の値を通す
    // （「50% 20%」のような直書きが増えると、レシピごとの調整が効かない場所が生まれる）
    const jkDirect = jkFiles
      .filter(({ rel, src }) => rel !== 'src/logic/photoFocus.ts' && /objectPosition\s*:/.test(src))
      .filter(({ src }) => !src.includes("from '../logic/photoFocus'"))
      .map(({ rel }) => rel)
    eq('JK-4 見え方の値を画面で直書きしているところが無い', jkDirect, [])
    const jkUsers = jkFiles.filter(({ src }) => /objectPosition\s*:/.test(src)).map(({ rel }) => rel)
    eq('JK-4 見え方を渡している画面を掴めている（0件なら見張りが壊れている）', jkUsers.length > 0, true)
  }

  // ---- JK-5: 共通のカード部品では、切って出す写真がもれなく見える範囲を受け取る --------------
  // レシピ一覧の絵（thumb）と詳細の大きな絵（RecipeHeroPhoto）はどちらもこの1つの部品にある。
  // 片方だけに付いている状態＝「詳細では直せるのに一覧は中央のまま」を赤にする
  {
    const jkRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const cardSrc = readFileSync(path.join(jkRoot, 'src/components/RecipeCard.tsx'), 'utf-8')
    const imgTags = []
    let at = cardSrc.indexOf('<img')
    while (at >= 0) {
      const end = cardSrc.indexOf('/>', at)
      if (end < 0) break
      imgTags.push(cardSrc.slice(at, end + 2))
      at = cardSrc.indexOf('<img', end)
    }
    eq('JK-5 カード部品の写真を掴めている（0件なら見張りが壊れている）', imgTags.length >= 2, true)
    const cropped = imgTags.filter((tag) => tag.includes('object-cover'))
    eq('JK-5 切って出している写真が2つ以上ある（一覧の絵と詳細の大きな絵）', cropped.length >= 2, true)
    const missing = cropped.filter((tag) => !tag.includes('objectPosition')).length
    eq('JK-5 切って出す写真はすべて見える範囲を受け取っている', missing, 0)
  }
}

// ==========================================================================================
// JL: 「日付を指定して週の画面を開く」と、いま使っている表示のしかたが食い違わない
// （2026-08-23 便JL。e2e WEEKLOCK-BULK が赤になって見つかった実バグの再発防止）
//
// 何が起きていたか（実測）:
//   「今日から7日間」で使っている端末で「別の週から入れる」を実行して週の画面へ戻ると、
//   戻り先の URL は ?focus=week&date=2026-09-06（＝いま見ていた7日間の初日）なのに、
//   画面に出る7日間が 2026-08-31〜2026-09-06（その日を含む月曜始まりの週）に化けていた。
//   原因は、週の起点を決める処理が**設定を端末から読み終える前**に走り、未取得（undefined）を
//   「週区切り」と決めつけていたこと。しかも同時に「初期化は済み」と印を付けるので、
//   設定が届いても直らなかった。
//   結果、「表示している週の夕食をまとめて空にする」が**見ていた週ではない週**を消していた
//   （見ていた6日は消えず、画面の外の6日が消える）。
// ==========================================================================================
{
  const { weekStartForDate, weekDates } = await import('../../src/logic/mealPlan.ts')

  // --- 週の起点の決め方そのもの（表示のしかた別） ---
  eq(
    'JL-1 今日から7日間: 指定した日がそのまま7日間の初日',
    weekStartForDate('2026-09-06', true),
    '2026-09-06',
  )
  eq(
    'JL-1 週区切り: 指定した日を含む週の月曜が初日',
    weekStartForDate('2026-09-06', false),
    '2026-08-31',
  )
  // 曜日の決め打ちを置かない: その週のどの曜日を渡しても、週区切りの起点は同じ月曜になり、
  // 今日から7日間の起点は渡した日そのものになる（日曜・月曜の境目で読み違えない）
  {
    const week = weekDates(new Date('2026-09-06T00:00:00')) // 2026-08-31(月)〜2026-09-06(日)
    eq('JL-1 前提: 見本の週を7日ぶん作れている', week.length, 7)
    eq(
      'JL-1 週区切り: 週のどの曜日から開いても起点は同じ月曜',
      [...new Set(week.map((d) => weekStartForDate(d, false)))],
      ['2026-08-31'],
    )
    eq(
      'JL-1 今日から7日間: 週のどの曜日から開いてもその日が起点',
      week.map((d) => weekStartForDate(d, true)),
      week,
    )
  }

  // --- 画面側が「設定が届く前に週を決めてしまう」形に戻っていないこと ---
  {
    const jlRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const src = readFileSync(path.join(jlRoot, 'src/pages/MealPlanPage.tsx'), 'utf-8')
    eq(
      'JL-2 前提: ?focus=week&date= の枝を掴めている（0件なら見張りが壊れている）',
      src.includes("const date = searchParams.get('date')"),
      true,
    )
    // 週の起点は純ロジック（weekStartForDate）を通す＝画面側に月曜始まりの計算を書き写さない
    eq(
      'JL-2 週の起点は純ロジックで決めている',
      /setWeekStart\(weekStartForDate\(date, settings\.weekStartsToday === true\)\)/.test(src),
      true,
    )
    eq(
      'JL-2 設定の未取得を「週区切り」と読む書き方が残っていない',
      /settings\?\.weekStartsToday \? date :/.test(src),
      false,
    )
    // 設定が未取得のときは、週を決めずに日付だけ控える（＝あとで決め直せる状態にする）
    const at = src.indexOf('if (settings === undefined) {')
    eq('JL-2 前提: 設定の未取得を分けている枝がある', at >= 0, true)
    const elseAt = src.indexOf('} else {', at)
    eq('JL-2 前提: 設定が届いているときの枝も掴めている', elseAt > at, true)
    const notLoadedBranch = src.slice(at, elseAt)
    const loadedBranch = src.slice(elseAt, src.indexOf('setPendingScrollDate(date)', elseAt))
    eq(
      'JL-2 設定が未取得なら、その日付を控えるだけにする',
      notLoadedBranch.includes('pendingWeekStartDateRef.current = date'),
      true,
    )
    eq(
      'JL-2 設定が未取得のときは「初期化は済み」の印を立てない（届いてから決め直せる）',
      notLoadedBranch.includes('weekModeInitRef.current = true'),
      false,
    )
    eq(
      'JL-2 設定が届いているときは、その場で決めて「初期化は済み」にする（今日の週へ戻さない）',
      loadedBranch.includes('weekModeInitRef.current = true'),
      true,
    )
    // 設定が届いたら、控えた日付で決め直す
    eq(
      'JL-2 設定が届いたら、控えた日付を表示のしかたに合わせて決め直す',
      /const pending = pendingWeekStartDateRef\.current[\s\S]{0,400}setWeekStart\(weekStartForDate\(pending, settings\.weekStartsToday === true\)\)/.test(
        src,
      ),
      true,
    )
    // 月タブの「この週を開く」も同じ決め方を通す（表示のしかたを黙って月曜始まりに変えない）
    eq(
      'JL-3 月の「この週を開く」も、表示のしかたに合わせて7日間を出す',
      /const goToWeekOf = \(date: string\) => \{[\s\S]{0,80}const start = weekStartForDate\(date, rollingWeek\)/.test(
        src,
      ),
      true,
    )
  }
}

// ==========================================================================================
// JM-1 / JM-2（2026-08-23 便JM）: e2e が画面の日本語を**書き写していない**ことの見張り
//
// なぜ要るか: 2026-08-22〜23 の1日で、アプリの文言を直しただけで e2e が6回赤くなった。
// いちばん重いのは**掴む側**（getByRole の name / getByText など）で、文言が変わると
// 要素を掴めず30秒待って**実行が中断**する。2026-08-22 は UI-390-01 でそれが起き、
// 以降の約3,700件が走らないまま「合格96/97件」で終わっていた（緑にも赤にも見えない）。
//
// 測るもの: scripts/e2e-smoke.mjs の中で、**ja.ts にまったく同じ値がある日本語**を
// 直接書いている箇所を、文言ごとに数える。既知の一覧（scripts/data/e2e-ja-copy-known.json）と
// 突き合わせて、
//   ・一覧に無い文言が現れた／一覧より数が増えた → 赤（新しく書き写しを増やせない）
//   ・一覧より数が減った／もう書き写していない  → 赤（直したら一覧から消す）
// の両向きで見張る。一覧は減らしていくためのもので、増やすときは理由を報告に書くこと。
//
// 「ja.ts に同じ値がある」ものだけを数えるのは、テストが自分で作った料理名や材料名
// （「肉じゃが」「玉ねぎ」等）を巻き込まないため＝画面に出る文言だけを対象にする。
// ==========================================================================================
{
  const jmRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  // 2026-08-26 便LC（docs/74 第2手）: e2e は 1ファイルから「入口 + scripts/e2e/ の節のファイル」へ
  // 分かれた。見張る対象は**e2e 全体**なので、入口と scripts/e2e/ の中身を全部見る
  // （節のファイルが増えても、ここを直さなくても対象に入る）。
  const jmFiles = [
    path.join(jmRoot, 'scripts/e2e-smoke.mjs'),
    ...readdirSync(path.join(jmRoot, 'scripts/e2e'))
      .filter((f) => f.endsWith('.mjs'))
      .sort()
      .map((f) => path.join(jmRoot, 'scripts/e2e', f)),
  ]
  const jmSrc = jmFiles.flatMap((f) => readFileSync(f, 'utf-8').split('\n'))

  /** ja.ts に出てくる文言（値）を全部集める */
  const jmValues = new Set()
  const jmWalk = (o) => {
    for (const v of Object.values(o)) {
      if (typeof v === 'string') jmValues.add(v)
      else if (v && typeof v === 'object') jmWalk(v)
    }
  }
  jmWalk(ja)
  eq('JM-1 前提: ja.ts の文言を読めている（0件なら見張りが壊れている）', jmValues.size > 500, true)

  // 掴む側＝これで要素を探している書き方。ここが外れると**実行が中断**する
  const JM_GRAB = [
    /getByRole\(\s*'[^']*'\s*,\s*\{[^}]*?name:\s*'((?:[^'\\])*)'/g,
    /getBy(?:Text|Label|Placeholder|Title)\(\s*'((?:[^'\\])*)'/g,
    /hasText:\s*'((?:[^'\\])*)'/g,
    // 画面の名前を受け取って掴みにいく道具（中で getByRole / selectOption に渡している）。
    // 呼び出し側に書き写すと、道具の中を直しても外れる＝同じ穴なので一緒に数える
    /(?:selectWeekLayout|openWeekGroup)\([^,]*,\s*'((?:[^'\\])*)'/g,
    /selectOption\(\s*\{\s*label:\s*'((?:[^'\\])*)'/g,
  ]
  // 判定側＝出ている文字と見比べている書き方。外れても中断はしないが赤になる
  const JM_JUDGE = [
    /\.(?:includes|startsWith|endsWith)\(\s*'((?:[^'\\])*)'/g,
    /(?:===|!==)\s*'((?:[^'\\])*)'/g,
  ]
  /** 短い語は言い換えが起きにくく、ja.ts のどのキーか決めにくいので判定側は10文字以上だけ見る */
  const JM_JUDGE_MIN = 10
  const jmHasJa = (s) => /[぀-ヿ一-鿿]/.test(s)

  const jmCount = (patterns, minLength) => {
    const out = {}
    for (const line of jmSrc) {
      if (/^\s*\/\//.test(line) || /^\s*\*/.test(line)) continue // コメント行は数えない
      for (const re of patterns) {
        re.lastIndex = 0
        let m
        while ((m = re.exec(line))) {
          const text = m[1]
          if (!jmHasJa(text)) continue
          if (!jmValues.has(text)) continue // 画面に出る文言でないもの（テストが作った名前）は対象外
          if ([...text].length < minLength) continue
          out[text] = (out[text] ?? 0) + 1
        }
      }
    }
    return out
  }

  const jmKnownRaw = JSON.parse(
    readFileSync(path.join(jmRoot, 'scripts/data/e2e-ja-copy-known.json'), 'utf-8'),
  )
  /** 「増えたもの」「減ったもの」を、直し方が分かる文にして返す */
  const jmDiff = (now, known, kind) => {
    const grew = []
    const shrank = []
    for (const [text, n] of Object.entries(now)) {
      const was = known[text] ?? 0
      if (n > was)
        grew.push(
          `${kind}「${text}」が${was}→${n}か所に増えた（ja.ts から読む形にするか、増やす理由を報告に書いて一覧を更新すること）`,
        )
    }
    for (const [text, was] of Object.entries(known)) {
      const n = now[text] ?? 0
      if (n < was)
        shrank.push(`${kind}「${text}」は${was}→${n}か所に減った（一覧から消すか数を直してください）`)
    }
    return { grew, shrank }
  }

  {
    const now = jmCount(JM_GRAB, 1)
    const total = Object.values(now).reduce((a, b) => a + b, 0)
    eq('JM-1 前提: e2e を走査できている（0件なら見張りが壊れている）', jmSrc.length > 1000, true)
    // 「書き写しが1つも見つからない」は、直しきったのか正規表現が壊れたのか区別が付かない。
    // いまは一覧に残りがあるので、見つからなくなったら下の突き合わせが必ず赤にする
    const { grew, shrank } = jmDiff(now, jmKnownRaw['掴む側'] ?? {}, '掴む側')
    eq('JM-1 掴む側（getByRole の name など）に、画面の文言の書き写しが増えていない', grew, [])
    eq('JM-1 掴む側の一覧に、もう書き写していないものが残っていない', shrank, [])
    eq(
      'JM-1 掴む側の残りは一覧どおり（数え方が変わったら気づけるようにする）',
      total,
      Object.values(jmKnownRaw['掴む側'] ?? {}).reduce((a, b) => a + b, 0),
    )
  }
  {
    const now = jmCount(JM_JUDGE, JM_JUDGE_MIN)
    const total = Object.values(now).reduce((a, b) => a + b, 0)
    const { grew, shrank } = jmDiff(now, jmKnownRaw['判定側'] ?? {}, '判定側')
    eq(
      `JM-2 判定側（includes など）に、${JM_JUDGE_MIN}文字以上の文言の書き写しが増えていない`,
      grew,
      [],
    )
    eq('JM-2 判定側の一覧に、もう書き写していないものが残っていない', shrank, [])
    eq(
      'JM-2 判定側の残りは一覧どおり（数え方が変わったら気づけるようにする）',
      total,
      Object.values(jmKnownRaw['判定側'] ?? {}).reduce((a, b) => a + b, 0),
    )
  }

  // ---- JM-3: 照合の前にゼロ幅スペースを外す道具が e2e にあること（禁じ手②の後半） ----
  // BudouX（logic/jaWrap.ts）が折返しのために U+200B を差し込むので、素の includes は
  // 同じ文なのに外れる。しかも「出ていないこと」を測る向きでは外れたまま素通りで合格になる。
  eq(
    'JM-3 e2e に、照合前にゼロ幅スペースを外す道具がある',
    /const stripZwspText = \(s\) => \(s \?\? ''\)\.replaceAll\('\\u200b', ''\)/.test(jmSrc.join('\n')),
    true,
  )

  // ---- JM-5: 曜日を固定して走らせる道具が e2e にあること（禁じ手①の見張り・2026-08-24 便KH） ----
  //
  // 禁じ手①（曜日・月替わりの前提）で赤くなった節は 2026-08-09 以降で5回作り込まれた
  // （LOCK-5・EQ-01・WEEKUI-DT、そして 2026-08-24 の EQ-01 再発）。どれも
  // **その曜日が来るまで気づけない**のが共通で、EQ-01 の再発では実行が中断して
  // 以降の1,700件が走らないまま「合格2322/2325件」で終わっていた。
  // 直したあと「他の曜日でも緑か」を測れるように、e2e に時計を合わせる入口を常設にした。
  //   E2E_FAKE_TODAY=2026-08-24 BASE_URL=... npx tsx scripts/e2e-part.mjs EQ-01
  // ここでは**その入口が消えていないこと**だけを見る（JM-3 と同じ役割の見張り）。
  eq(
    'JM-5 e2e に、曜日を固定して走らせる入口(E2E_FAKE_TODAY)がある',
    /const FAKE_TODAY = process\.env\.E2E_FAKE_TODAY/.test(jmSrc.join('\n')),
    true,
  )
  eq(
    'JM-5 その入口は、ブラウザ側と e2e 側の両方の「今日」を合わせている（片方だけだと仕込む日と画面がずれる）',
    /clock\.install\(\{ time: fixedAt \}\)/.test(jmSrc.join('\n')) &&
      /globalThis\.Date = ShiftedDate/.test(jmSrc.join('\n')),
    true,
  )
  eq(
    'JM-5 既定（環境変数が無いとき）は時計に触らない＝普段の実行に影響しない',
    /if \(FAKE_TODAY\) \{/.test(jmSrc.join('\n')),
    true,
  )

  // ---- JM-4: ja.ts の文言を**ブラウザ側で走る関数の中**に書いていないこと ----
  //
  // page.evaluate / evaluateAll / waitForFunction などに渡す関数は、文字列にしてブラウザへ
  // 送られてから向こうで走る。向こうには ja が無いので、中に ja.xxx と書くと
  // 「ja is not defined」でその節が**実行中断**する（2026-08-23 便JM で WEEKUI-01 に実発。
  // 書き写しを ja.ts へ寄せる作業のいちばん危ない落とし穴なので、見張りを常設にする）。
  // 正しい形は、文言を evaluate の**引数で渡す**こと:
  //   page.evaluate((title) => ..., ja.mealPlan.weekCostTitle)
  //
  // 中身の判定には構文解析が要るので acorn を使う（vite/rollup が必ず連れてくる）。
  // 読み込めないときは黙って素通りさせず、その場で赤にする。
  {
    const jmRequire = createRequire(scriptFileUrl)
    let jmAcorn = null
    try {
      jmAcorn = jmRequire('acorn')
    } catch {
      jmAcorn = null
    }
    eq('JM-4 前提: 構文解析の道具(acorn)を読める（読めないと見張りが素通りする）', jmAcorn !== null, true)
    if (jmAcorn) {
      /** ブラウザ側で走る関数を受け取る呼び出し */
      const JM_BROWSER_FNS = new Set([
        'evaluate',
        'evaluateAll',
        'evaluateHandle',
        '$eval',
        '$$eval',
        'addInitScript',
        'exposeFunction',
        'waitForFunction',
      ])
      const jmWalkAst = (node, fn) => {
        if (!node || typeof node.type !== 'string') return
        fn(node)
        for (const k of Object.keys(node)) {
          if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue
          const v = node[k]
          if (Array.isArray(v)) {
            for (const c of v) if (c && typeof c.type === 'string') jmWalkAst(c, fn)
          } else if (v && typeof v.type === 'string') jmWalkAst(v, fn)
        }
      }
      // 2026-08-26 便LC: e2e が複数のファイルに分かれたので、**1本につないでではなく
      // ファイルごとに**構文解析する（つなぐと、別のファイルの同じ名前の宣言がぶつかって
      // 解析そのものが落ちる。位置(start/end)もファイルごとの数え方なので混ぜられない）。
      let jmBrowserCount = 0
      const jmLeaked = []
      for (const jmFile of jmFiles) {
        const jmAst = jmAcorn.parse(readFileSync(jmFile, 'utf-8'), {
          ecmaVersion: 'latest',
          sourceType: 'module',
          locations: true,
        })
        const jmBrowserRanges = []
        jmWalkAst(jmAst, (n) => {
          if (n.type !== 'CallExpression') return
          const c = n.callee
          const name =
            c && c.type === 'MemberExpression' && c.property && c.property.type === 'Identifier'
              ? c.property.name
              : null
          if (!name || !JM_BROWSER_FNS.has(name)) return
          const arg = n.arguments[0]
          if (!arg) return
          if (arg.type === 'ArrowFunctionExpression' || arg.type === 'FunctionExpression')
            jmBrowserRanges.push({ s: arg.start, e: arg.end, fn: name, line: n.loc.start.line })
        })
        jmBrowserCount += jmBrowserRanges.length
        jmWalkAst(jmAst, (n) => {
          if (n.type !== 'MemberExpression') return
          let root = n
          while (root.object && root.object.type === 'MemberExpression') root = root.object
          if (!root.object || root.object.type !== 'Identifier' || root.object.name !== 'ja') return
          const r = jmBrowserRanges.find((x) => n.start >= x.s && n.end <= x.e)
          if (r)
            jmLeaked.push(
              `${path.basename(jmFile)}:${n.loc.start.line}行目の ja.*** が ${r.fn}(${r.line}行目) の中にある（文言は引数で渡すこと）`,
            )
        })
      }
      eq(
        'JM-4 前提: ブラウザ側で走る関数を見つけられている（0個なら見張りが壊れている）',
        jmBrowserCount > 100,
        true,
      )
      eq('JM-4 ja.ts の文言が、ブラウザ側で走る関数の中に入り込んでいない', [...new Set(jmLeaked)], [])
    }
  }
}

// ---------- 便KE: 節約したい人の実データ30品で、原価と買い物メモが判断に使えない ----------
// 影響範囲テストA「食費を切り詰めたい人」(30品・2026-08-23)で実測した数字をそのまま見張る。
// 直す前はここに並べた値がすべて赤になることを確認してから直している。
//   ・厚揚げニラ玉 1食417円（正しくは約94円）… 醤油「大匙1」に1L1本ぶんの400円が乗っていた
//   ・つくねの照り焼き 1食386円 … 配合比の注記「醤油｜砂糖 みりん 1 1 1」に400円が乗っていた
//   ・もやしのナムル 1食115円 … にんにく「少々」に1玉60円・ねぎ「大1」に1本100円
//   ・鶏胸肉「1｜枚300g」が90円（100gぶん）＝逆に安く出る
// いちばん高く出た2品には「※価格が分からない材料」の印が1つも付かず、
// 「実際はこれより高くなります」という案内が事実と逆になっていた。
{
  const keIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const keYen = (name, amount, unit) =>
    estimateIngredientYen({ name, amount, unit }, keIndex)?.yen ?? null
  const kePerServing = (ingredients, servings) =>
    Math.round(estimateRecipeCost(ingredients, keIndex).total / servings)

  // --- KE-1: 「大匙」「小匙」を大さじ・小さじとして読む ---
  // 「大3」「大さじ3」は読めるのに「大匙3」だけ読めず、原価も買い物メモも別枠に落ちていた
  const keSpoon = (amount) => {
    const r = resolveCalcAmount(amount, '')
    return r ? { value: r.value, unit: r.unit } : null
  }
  eq('KE-1 「大匙1」は大さじ1として読む', keSpoon('大匙1'), { value: 1, unit: '大さじ' })
  eq('KE-1 「小匙2」は小さじ2として読む', keSpoon('小匙2'), { value: 2, unit: '小さじ' })
  eq('KE-1 「大匙1/2」も読む', keSpoon('大匙1/2'), { value: 0.5, unit: '大さじ' })
  eq('KE-1 「大3」の略記は今までどおり読む', keSpoon('大3'), { value: 3, unit: '大さじ' })
  eq('KE-1 分量欄に「大さじ2」と書いてあっても読む', keSpoon('大さじ2'), { value: 2, unit: '大さじ' })
  eq('KE-1 単位欄の「大匙」も体積として読む', normalizeUnit(1, '大匙'), { dim: 'volume', base: 15 })
  eq('KE-1 単位欄の「小匙」も体積として読む', normalizeUnit(1, '小匙'), { dim: 'volume', base: 5 })
  // 表示は原文の書き方（「大匙」）のまま。人数を変えても勝手に「大さじ」へ書き換えない
  eq('KE-1 人数変更しても「大匙」の書き方は変えない', scaleAmount('大匙1', 2, 4, ''), '大匙2')
  // 原価: しょうゆ 400円/1L の大さじ1＝15ml＝6円（1本まるごとの400円ではない）
  eq('KE-1 醤油「大匙1」は6円（旧: 1L1本ぶんの400円）', keYen('醤油', '大匙1', ''), 6)
  eq('KE-1 酒「大匙2」は8円（旧: 1L1本ぶんの260円）', keYen('酒', '大匙2', ''), 8)
  eq('KE-1 オイスターソース「大匙2」は60円（旧: 大さじ1ぶんの30円）', keYen('オイスターソース', '大匙2', ''), 60)
  // 買い物メモ: 「大さじ」と「大匙」が同じ単位として足される
  {
    const c = buildShoppingCandidates(
      [
        { id: 1, ingredients: [{ name: '酒', amount: '大さじ1', unit: '' }] },
        { id: 2, ingredients: [{ name: '酒', amount: '大匙2', unit: '' }] },
      ],
      [],
    )
    eq('KE-1 買い物メモで「大さじ1」と「大匙2」が足される', c[0]?.amount, '大さじ3')
  }

  // --- KE-2: 単位が噛み合わないとき「登録単位ぶんの満額」を乗せない ---
  // 販売単位（1L・1玉・1本・100g…）で登録された食材は、噛み合わなかったときに
  // 満額を乗せると桁で外れる。金額に入れず「価格が分からない材料」として数える
  eq('KE-2 配合比の注記「砂糖 みりん 1 1 1」の醤油は金額に入れない（旧: 400円）', keYen('醤油', '砂糖 みりん 1 1 1', ''), null)
  eq('KE-2 にんにく「少々」は金額に入れない（旧: 1玉60円）', keYen('にんにく', '少々', ''), null)
  eq('KE-2 ねぎ「大1」(=大さじ1)は金額に入れない（旧: 1本100円）', keYen('ねぎ', '大1', ''), null)
  eq('KE-2 鶏胸肉「1｜枚300g」は金額に入れない（旧: 100gぶんの90円）', keYen('鶏胸肉', '1', '枚300g'), null)
  eq('KE-2 「米油 適量」が米に化けて60円にならない', keYen('米油', '適量', ''), null)
  eq('KE-2 材料でない注記行がにんじん40円にならない', keYen('キャベツ、人参は無くてもOK。市販のもやしミックスでもOK！', '', ''), null)
  // 「1回に使う量」で登録された食材は今までどおり（登録単位そのものが1回分なので過大にならない）
  eq('KE-2 塩「少々」は1円のまま（登録単位が小さじ1）', keYen('塩', '少々', ''), 1)
  eq('KE-2 塩こしょう「少々」は5円のまま（登録単位が少々）', keYen('塩こしょう', '少々', ''), 5)
  eq('KE-2 片栗粉「適量」は5円のまま（登録単位が大さじ1）', keYen('片栗粉', '適量', ''), 5)
  eq('KE-2 白いりごま「適量」は15円のまま（登録単位が大さじ1）', keYen('白いりごま', '適量', ''), 15)
  eq('KE-2 揚げ油「適量」は40円のまま（登録単位が使用分）', keYen('揚げ油', '適量', ''), 40)
  eq('KE-2 しょうが「少々」は20円のまま（登録単位が1かけ）', keYen('しょうが', '少々', ''), 20)
  // 便JG・便BYで決めた按分はそのまま（回帰）
  eq('KE-2 分量なしのこしょうは2円のまま（便JG-4）', keYen('こしょう', '', ''), 2)
  eq('KE-2 分量なしのサラダ油は6円のまま（便JG-4）', keYen('サラダ油', '', ''), 6)
  // 2026-08-26 便LF: ごま油を1,200→1,700円/1Lにしたので6→9円になった。
  // 便KEが見張っているのは「『適量』にボトル1本ぶん（1,200円・1,700円）が乗らないこと」のほう
  eq('KE-2 ごま油「適量」は8円（1回に使う量。ボトル1本ぶんが乗らない。便LFの前は6円）', keYen('ごま油', '適量', ''), 8)

  // --- KE-3: 実データの品ぜんぶを、1食あたりの金額で見張る ---
  {
    // 厚揚げニラ玉（2人分・クックパッド。実勢は1食100円前後）
    const niratama = [
      { name: '厚揚げ 二個入りの', amount: '1', unit: '個' },
      { name: 'ニラ', amount: '半束', unit: '' },
      { name: '卵', amount: '1〜2', unit: '個' },
      { name: '小松菜', amount: '2', unit: '、3茎' },
      { name: 'オイスターソース', amount: '大匙2', unit: '' },
      { name: '醤油', amount: '大匙1', unit: '' },
      { name: '酒', amount: '大匙2', unit: '' },
      { name: '中華スープの素', amount: '2', unit: '小さじ' },
    ]
    eq('KE-3 厚揚げニラ玉の1食が417円ではない', kePerServing(niratama, 2) !== 417, true)
    eq('KE-3 厚揚げニラ玉の1食は150円以下', kePerServing(niratama, 2) <= 150, true)
    // つくねの照り焼き（2人分・クックパッド。材料の最後に配合比の注記が1行入っている）
    const tsukune = [
      { name: '鶏ムネ肉', amount: '300', unit: 'g' },
      { name: '玉葱', amount: '1/2', unit: '個' },
      { name: 'すりおろし生姜（チューブＯＫ）', amount: '小1', unit: '' },
      { name: '醤油、ごま油', amount: '各大1/2', unit: '' },
      { name: '酒', amount: '大1', unit: '' },
      { name: '片栗粉', amount: '大2', unit: '' },
      { name: '塩・コショウ', amount: '少々', unit: '' },
      { name: '酒', amount: '大4', unit: '' },
      { name: '醤油', amount: '大3', unit: '' },
      { name: 'みりん', amount: '大3', unit: '' },
      { name: '砂糖', amount: '大2', unit: '' },
      { name: '醤油', amount: '砂糖 みりん 1 1 1', unit: '' },
    ]
    eq('KE-3 つくねの照り焼きの1食が386円ではない', kePerServing(tsukune, 2) !== 386, true)
    eq('KE-3 つくねの照り焼きの1食は250円以下', kePerServing(tsukune, 2) <= 250, true)
    // 一番おかしかった2品には印が1つも付いていなかった。厚揚げニラ玉は主材料の厚揚げ・小松菜が
    // 読めない書き方（「厚揚げ 二個入りの」「小松菜 2｜、3茎」）なので、印が出るのが正しい
    eq('KE-3 厚揚げニラ玉に「価格が分からない材料」の印が出る', recipeCostConfidence(niratama, keIndex).shouldWarn, true)
    // つくねの照り焼きは、配合比の注記行に乗っていた400円が消えて金額そのものが正しくなる。
    // 材料はすべて価格が付くので印は出ない（出ないのが正しい）
    // 2026-08-25 便KP: 186→193円。『すりおろし生姜（チューブＯＫ）小1』が「価格が分からない材料」
    // だったのを、実勢を調べて「おろししょうが 100円/40g」を足したことで13円が乗ったぶん
    // （2人分で7円）。**足りなかった金額が入った変化で、便KEが直した「桁で外れる」話とは別**
    // 2026-08-26 便LF: ごま油の調べ直しで193→194円
  eq('KE-3 つくねの照り焼きの1食は194円（便LFの調味料の調べ直しで193→194円・便KEの直後は186円・直す前は386円）', kePerServing(tsukune, 2), 194)
    // 簡単！もやしのナムル（2人分。薬味の「少々」「大1」に1玉・1本ぶんが乗っていた）
    const namuru = [
      { name: 'もやし', amount: '1', unit: '袋' },
      { name: 'にんにく', amount: '少々', unit: '' },
      { name: '生姜', amount: '少々', unit: '' },
      { name: 'ねぎ', amount: '大1', unit: '' },
      { name: '塩、胡椒', amount: '少々', unit: '' },
      { name: 'ごま油', amount: '大1', unit: '' },
      { name: 'ごま', amount: '少々', unit: '' },
    ]
    eq('KE-3 もやしのナムルの1食が115円ではない', kePerServing(namuru, 2) !== 115, true)
    eq('KE-3 もやしのナムルの1食は60円以下', kePerServing(namuru, 2) <= 60, true)
  }

  // --- KE-4: この層の主力食材が食材価格マスタに無い ---
  // 実測: 厚揚げ7回・小松菜3回・豆苗・大豆の水煮・キムチ が「価格なし」。
  // 厚揚げは30品中8品で使われていて1品も金額に入っていなかった
  for (const [written, expected] of [
    ['厚揚げ', '厚揚げ'],
    ['小松菜', '小松菜'],
    ['豆苗', '豆苗'],
    ['大豆の水煮', '大豆水煮'],
    ['キムチ', 'キムチ'],
    ['白菜キムチ', 'キムチ'],
  ]) {
    eq(`KE-4 「${written}」が価格マスタの「${expected}」に当たる`, matchPriceEntry(written, keIndex)?.normalizedName ?? 'なし', expected)
  }
  eq('KE-4 厚揚げ1枚に値段が付く', keYen('厚揚げ', '1', '枚') > 0, true)
  eq('KE-4 小松菜1束に値段が付く', keYen('小松菜', '1', '束') > 0, true)
  // 誤爆の見張り: 似た名前の別食材を巻き込んでいないか
  eq('KE-4 「油揚げ」は厚揚げに化けない', matchPriceEntry('油揚げ', keIndex)?.normalizedName, '油揚げ')
  eq('KE-4 「豆腐」は豆苗に化けない', matchPriceEntry('豆腐', keIndex)?.normalizedName, '豆腐')
  eq('KE-4 「蒸し大豆」は蒸し大豆のまま', matchPriceEntry('蒸し大豆', keIndex)?.normalizedName, '蒸し大豆')
  eq('KE-4 「小松菜」で「こまつな」以外に当たらない', matchPriceEntry('ほうれん草', keIndex)?.normalizedName, 'ほうれん草')

  // --- KE-5: 買い物メモの名寄せ（合わせ調味料の記号・但し書きが名前に残る） ---
  // 実測: 下書き113行のうち33行(29%)が材料でない行。19組・のべ70行が同じ食材なのに別行だった
  {
    const rows = (ings) =>
      buildShoppingCandidates([{ id: 1, ingredients: ings }], []).map((c) => c.name)
    eq('KE-5 ★〇a.の記号が付いた酒は「酒」1行にまとまる', rows([
      { name: '酒', amount: '大さじ1', unit: '' },
      { name: '★酒', amount: '大さじ1', unit: '' },
      { name: '〇酒', amount: '大さじ1', unit: '' },
      { name: 'a. 酒', amount: '大さじ1', unit: '' },
    ]), ['酒'])
    eq('KE-5 「厚揚げ 二個入りの」は「厚揚げ」にまとまる', rows([
      { name: '厚揚げ', amount: '1', unit: 'パック' },
      { name: '厚揚げ 二個入りの', amount: '1', unit: '個' },
    ]), ['厚揚げ'])
    // 「最後にごま油」のように**食材名の前に手順の言葉が付いた行**は、まだまとまらない
    // （名前の頭が食材名でないため。取り込みの時点で落とすほうが筋なので次の便へ回した）
    eq('KE-5 「★ゴマ油」「ごま油(仕上げ用) 〜」は「ごま油」にまとまる', rows([
      { name: 'ごま油', amount: '小さじ1', unit: '' },
      { name: '★ゴマ油', amount: '大さじ1/2', unit: '' },
      { name: 'ごま油(仕上げ用) 〜', amount: '小さじ1', unit: '' },
    ]), ['ごま油'])
    // 成分表では同じ食品に寄るが、店では別に買うものは分けたまま（名寄せの誤爆を防ぐ見張り）
    for (const [a, b] of [
      ['塩', '塩こしょう'],
      ['白いりごま', '白すりごま'],
      ['焼きのり', '刻みのり'],
      ['鶏もも肉', '鶏ももひき肉'],
      ['だし汁', 'カツオだし（顆粒）'],
      ['しょうが', '紅しょうが'],
      ['赤唐辛子', '一味唐辛子'],
      ['ピザ用チーズ', '粉チーズ'],
      ['卵', '錦糸卵'],
    ]) {
      eq(`KE-5 「${a}」と「${b}」は別行のまま`, rows([
        { name: a, amount: '1', unit: '' },
        { name: b, amount: '1', unit: '' },
      ]).length, 2)
    }
    eq('KE-5 「おろし生姜 なくてもOK」は「おろし生姜」にまとまる', rows([
      { name: 'おろし生姜', amount: '小さじ1', unit: '' },
      { name: 'おろし生姜 なくてもOK', amount: '大さじ3/4', unit: '' },
    ]), ['おろし生姜'])
    eq('KE-5 「お好みで、小ネギ」は「小ねぎ（カット）」にまとまる', rows([
      { name: '小ねぎ（カット）', amount: '10', unit: 'g' },
      { name: 'お好みで、小ネギ', amount: '適量', unit: '' },
    ]).length, 1)
    eq('KE-5 「〇コチュジャン（なくてもOK）」は「コチュジャン」にまとまる', rows([
      { name: 'コチュジャン', amount: '小さじ1/4', unit: '' },
      { name: '〇コチュジャン（なくてもOK）', amount: '大さじ3/4', unit: '' },
    ]), ['コチュジャン'])
    // 名寄せしてはいけない組（別の売り場・別の食材）
    eq('KE-5 「豆腐」と「高野豆腐」は別行のまま', rows([
      { name: '豆腐', amount: '1', unit: '丁' },
      { name: '高野豆腐', amount: '2', unit: '枚' },
    ]).length, 2)
    eq('KE-5 「厚揚げ」と「油揚げ」は別行のまま', rows([
      { name: '厚揚げ', amount: '1', unit: 'パック' },
      { name: '油揚げ', amount: '2', unit: '枚' },
    ]).length, 2)
    eq('KE-5 「卵」と「砂糖（卵用）」は別行のまま', rows([
      { name: '卵', amount: '2', unit: '個' },
      { name: '砂糖（卵用）', amount: '大さじ1', unit: '' },
    ]).length, 2)
  }

  // --- KE-6: 同じ次元の単位は足す／同じ言葉は畳む ---
  // 実測: 36行中12行(33%)が「そのままでは何をいくつ買えばよいか決められない」行だった
  {
    const amountOf = (ings) =>
      buildShoppingCandidates([{ id: 1, ingredients: ings }], [])[0]?.amount
    eq('KE-6 酢 小さじ1＋大さじ1 が足される（旧: 「小さじ1・大さじ1」）',
      amountOf([
        { name: '酢', amount: '1', unit: '小さじ' },
        { name: '酢', amount: '1', unit: '大さじ' },
      ]), '大さじ1と1/4')
    eq('KE-6 サラダ油 大さじ2＋小さじ1 が足される',
      amountOf([
        { name: 'サラダ油', amount: '2', unit: '大さじ' },
        { name: 'サラダ油', amount: '1', unit: '小さじ' },
      ]), '大さじ2と1/4')
    eq('KE-6 g と kg が足される（店頭で読むgに寄せる）',
      amountOf([
        { name: '切り干し大根', amount: '300', unit: 'g' },
        { name: '切り干し大根', amount: '1', unit: 'kg' },
      ]), '1300g')
    // 成分表の目安量（もやし1袋=200g・厚揚げ1枚=150g）があれば、袋・枚とgも足せる
    eq('KE-6 もやし 600g＋4と1/2袋 が「7と1/2袋」になる（旧: 3つ並べて出していた）',
      amountOf([
        { name: 'もやし', amount: '600', unit: 'g' },
        { name: 'もやし', amount: '4.5', unit: '袋' },
      ]), '7と1/2袋')
    eq('KE-6 厚揚げ 300g＋1枚 が「3枚」になる',
      amountOf([
        { name: '厚揚げ', amount: '300', unit: 'g' },
        { name: '厚揚げ', amount: '1', unit: '枚' },
      ]), '3枚')
    eq('KE-6 「少々」が7つ並ばず1つに畳まれる',
      amountOf(Array.from({ length: 7 }, () => ({ name: '塩コショウ', amount: '少々', unit: '' }))), '少々')
    eq('KE-6 「適量」と「少々」は別の言葉なので両方残す',
      amountOf([
        { name: '塩', amount: '適量', unit: '' },
        { name: '塩', amount: '少々', unit: '' },
      ]), '適量・少々')
    // 「個」と「玉」は成分表の玉ねぎがどちらも同じ重さで持っているので足せる
    // （旧: 「1個・1/2玉」と並び、2個買えばよいのか決められなかった）
    eq('KE-6 玉ねぎの「1個」と「1/2玉」は足して「1と1/2個」',
      amountOf([
        { name: '玉ねぎ', amount: '1', unit: '個' },
        { name: '玉ねぎ', amount: '1/2', unit: '玉' },
      ]), '1と1/2個')
  }
}

// ---------- 便KL: 包装単位(パック・袋)が換算できず、原価も栄養も出ない ----------
// 影響範囲テストA・B・C(実データ90品・2026-08-23)で「単位が換算できずに落ちている材料」を
// 全部洗い出した結果を見張る。直す前はここに並べた値がすべて赤になることを確認してから直している。
//   ・簡単！厚揚げと小松菜の煮浸し … 1食8円（実勢の約1/9）。1人分32kcal・たんぱく質0.7g。
//     材料費のほとんどを占める『厚揚げ 1パック』『小松菜 1袋』が、成分表に「パック」「袋」の
//     目安量が無いために原価も栄養も両方まるごと落ちていた
//   ・節約★豚こまニラもやし … 単位欄が「g～」「束～」で主材料の豚こま肉とニラが落ちる。
//     原価側は2026-08-23 便KEで「〜」を落とすようになったのに栄養側だけ落とせず、
//     **同じ材料が原価では計算できて栄養では対象外**という食い違いになっていた
//   ・お弁当に使える♪ ブロッコリー使い切り3選 … 『ブロッコリー 1個』『1個分』で野菜量0g
// 足した目安量は**すべて、その食品が元から持っている単位の値の言い換えか倍数**で、
// 新しい重さの数値は1つも作っていない（根拠は scripts/nutrition-foods.mjs の各noteに1件ずつ）。
{
  const klIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const { matchNutritionFood: klFood, computeRecipeNutrition: klNut } = await import(
    '../../src/logic/nutrition.ts'
  )
  // 材料名から直接グラムを出す。名寄せできない材料でも検査が止まらないように空の食品で受ける
  // （1件の中断で以降が全部走らないまま「合格◯件」で終わるのを防ぐ）
  const klGramsOf = (value, unit, name) => convertToGrams(value, unit, klFood(name) ?? {})
  const klPerServingYen = (ingredients, servings) =>
    Math.round(estimateRecipeCost(ingredients, klIndex).total / servings)

  // --- KL-1: 包装単位を、成分表がすでに持っている単位と同じ重さで読む ---
  // 「新しい重さを作っていない」ことまで見張る＝右辺は必ず既存の単位からの計算にする
  eq('KL-1 厚揚げの「1パック」は2枚入り＝「2枚」と同じ重さ', klGramsOf(1, 'パック', '厚揚げ'), klGramsOf(2, '枚', '厚揚げ'))
  eq('KL-1 厚揚げの「1個」は「1枚」と同じ重さ', klGramsOf(1, '個', '厚揚げ'), klGramsOf(1, '枚', '厚揚げ'))
  eq('KL-1 小松菜の「1袋」は「1束」と同じ重さ', klGramsOf(1, '袋', '小松菜'), klGramsOf(1, '束', '小松菜'))
  eq('KL-1 水菜の「1袋」は「1束」と同じ重さ', klGramsOf(1, '袋', '水菜'), klGramsOf(1, '束', '水菜'))
  eq('KL-1 ニラの「1袋」は「1束」と同じ重さ', klGramsOf(1, '袋', 'ニラ'), klGramsOf(1, '束', 'ニラ'))
  eq('KL-1 糸こんにゃくの「1パック」は「1袋」と同じ重さ', klGramsOf(1, 'パック', '糸こんにゃく'), klGramsOf(1, '袋', '糸こんにゃく'))
  eq('KL-1 ブロッコリーの「1個」は「1株」と同じ重さ', klGramsOf(1, '個', 'ブロッコリー'), klGramsOf(1, '株', 'ブロッコリー'))
  eq('KL-1 「1個分」も同じ（既存の「◯◯分」の読み替えで拾う）', klGramsOf(1, '個分', 'ブロッコリー'), klGramsOf(1, '株', 'ブロッコリー'))
  eq('KL-1 にんにくの「小さじ」はおろしにんにくと同じ重さ', klGramsOf(1, '小さじ', 'にんにく'), klGramsOf(1, '小さじ', 'おろしにんにく'))
  eq('KL-1 にんにくの「大さじ」はおろしにんにくと同じ重さ', klGramsOf(1, '大さじ', 'にんにく'), klGramsOf(1, '大さじ', 'おろしにんにく'))
  eq('KL-1 おろしにんにくの「1片」は生にんにくの「1片」と同じ重さ', klGramsOf(1, '片', 'おろしにんにく'), klGramsOf(1, '片', 'にんにく'))
  // 知らない単位に勝手な重さを当てていないこと（分からないものは分からないまま）
  eq('KL-1 厚揚げの知らない単位は換算しない', klGramsOf(1, '箱', '厚揚げ'), null)
  eq('KL-1 「1/2片強分」の「強」は読み取らない（どれだけ多いか書いた人にしか分からない）', klGramsOf(0.5, '片強分', 'おろしにんにく'), null)

  // --- KL-2: 単位欄に残った範囲の印「〜」を、栄養側も原価側と同じに落とす ---
  eq('KL-2 「100g～」は「100g」と同じ重さ', klGramsOf(100, 'g～', '豚こま肉'), klGramsOf(100, 'g', '豚こま肉'))
  eq('KL-2 全角「～」も半角「~」も同じ', klGramsOf(100, 'g~', '豚こま肉'), klGramsOf(100, 'g', '豚こま肉'))
  eq('KL-2 「束～」も「束」と同じ', klGramsOf(0.5, '束～', 'ニラ'), klGramsOf(0.5, '束', 'ニラ'))
  eq('KL-2 原価側と答えが同じ（同じ材料が片方だけ落ちない）', normalizeUnit(100, 'g～'), normalizeUnit(100, 'g'))

  // --- KL-3: 実データの「厚揚げと小松菜の煮浸し」で、原価と栄養の両方に効く ---
  const klNibitashi = [
    { name: '厚揚げ', amount: '1', unit: 'パック', memo: '正方形2枚' },
    { name: '小松菜', amount: '1', unit: '袋' },
    { name: '醤油', amount: '1.5', unit: '大さじ' },
    { name: 'みりん', amount: '1.5', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '大さじ' },
    { name: 'だしの素', amount: '1', unit: '小さじ' },
    { name: '水', amount: '1', unit: 'カップ' },
  ]
  eq('KL-3 煮浸しは1食75円（旧8円＝実勢の約1/9）', klPerServingYen(klNibitashi, 4), 75)
  eq(
    'KL-3 「価格が分からない材料」が0件になる（旧: 厚揚げ・小松菜の2種）',
    pricelessIngredientNamesOfRecipes([{ ingredients: klNibitashi }], klIndex),
    [],
  )
  {
    const n = klNut({ ingredients: klNibitashi, servings: 4 })
    eq('KL-3 栄養も対象外0件になる（旧: 厚揚げ・小松菜の2件）', n.excluded.map((e) => e.name), [])
    eq('KL-3 1人分147kcal（旧32kcal）', Math.round(n.perServing.kcal), 147)
    eq('KL-3 1人分のたんぱく質は9g超（旧0.7g）', n.perServing.proteinG > 9, true)
    eq('KL-3 野菜量63g（旧0g）', Math.round(vegetableGrams({ ingredients: klNibitashi, servings: 4 })), 63)
  }
  // 原価と栄養が同じ量を見ていること（2エンジンの答えを食い違わせない）
  eq(
    'KL-3 厚揚げ1パックは原価も120円＝マスタ60円/1枚の2枚ぶん',
    estimateIngredientYen({ name: '厚揚げ', amount: '1', unit: 'パック' }, klIndex)?.yen,
    estimateIngredientYen({ name: '厚揚げ', amount: '2', unit: '枚' }, klIndex)?.yen,
  )
  eq(
    'KL-3 小松菜1袋は原価も1束ぶんと同じ',
    estimateIngredientYen({ name: '小松菜', amount: '1', unit: '袋' }, klIndex)?.yen,
    estimateIngredientYen({ name: '小松菜', amount: '1', unit: '束' }, klIndex)?.yen,
  )

  // --- KL-4: 「g～」で主材料が落ちていた品（栄養だけが落ちていた＝原価は変わらない） ---
  const klNiraMoyashi = [
    { name: '豚コマ肉', amount: '100', unit: 'g～' },
    { name: 'ニラ', amount: '1/2', unit: '束～' },
    { name: 'もやし', amount: '1', unit: '袋' },
    { name: 'ゴマ油', amount: '大1', unit: '' },
    { name: '醤油', amount: '2', unit: '小さじ' },
    { name: 'オイスターソース', amount: '1', unit: '小さじ' },
    { name: '砂糖', amount: '1', unit: '小さじ' },
    { name: '塩コショウ', amount: '少々', unit: '' },
  ]
  {
    const n = klNut({ ingredients: klNiraMoyashi, servings: 2 })
    eq('KL-4 豚こま肉とニラが対象外に残らない', n.excluded.map((e) => e.name), [])
    eq('KL-4 1人分のたんぱく質は12g超（旧2.5g）', n.perServing.proteinG > 12, true)
    eq('KL-4 野菜量124g（旧0g）', Math.round(vegetableGrams({ ingredients: klNiraMoyashi, servings: 2 })), 124)
  }

  // --- KL-5: 減塩しょうゆ・減塩みそ（司令部裁定。八訂に実収載があるので根拠が明確） ---
  {
    const genenShoyu = klFood('減塩しょうゆ')
    const shoyu = klFood('しょうゆ')
    eq('KL-5 減塩しょうゆに専用の成分データがある', genenShoyu?.id, '17086')
    eq('KL-5 普通のしょうゆとは別の食品として持つ', genenShoyu?.id !== shoyu?.id, true)
    eq('KL-5 食塩相当量は八訂の値そのまま（8.3g/100g）', genenShoyu?.per100g.saltG, 8.3)
    eq('KL-5 普通のしょうゆより少なく出る（14.5g/100g）', shoyu?.per100g.saltG, 14.5)
    eq('KL-5 「減塩醤油」「塩分カットしょうゆ」も同じ食品に寄る', [
      klFood('減塩醤油')?.id,
      klFood('減塩しょう油')?.id,
      klFood('塩分カットしょうゆ')?.id,
    ], ['17086', '17086', '17086'])
    const genenMiso = klFood('減塩みそ')
    const miso = klFood('味噌')
    eq('KL-5 減塩みそに専用の成分データがある', genenMiso?.id, '17119')
    eq('KL-5 食塩相当量は八訂の値そのまま（10.7g/100g）', genenMiso?.per100g.saltG, 10.7)
    eq('KL-5 代表の味噌より少なく出る（12.4g/100g）', miso?.per100g.saltG, 12.4)
    eq('KL-5 「減塩味噌」「塩分カットみそ」も同じ食品に寄る', [
      klFood('減塩味噌')?.id,
      klFood('塩分カットみそ')?.id,
    ], ['17119', '17119'])
    // 大さじ/小さじの重さは他のみそ類と同じ（新しい数値を作っていない）
    eq('KL-5 減塩みその大さじは他のみそと同じ重さ', klGramsOf(1, '大さじ', '減塩みそ'), klGramsOf(1, '大さじ', '味噌'))
    // --- 誤爆0件: 「減塩」と書いていないしょうゆ・みそを巻き込まない ---
    eq('KL-5 誤爆0件: 「減塩」と書いていないしょうゆ・みそは今までどおり', [
      klFood('しょうゆ')?.id, klFood('醤油')?.id, klFood('濃口醤油')?.id, klFood('こいくちしょうゆ')?.id,
      klFood('薄口しょうゆ')?.id, klFood('だししょうゆ')?.id, klFood('ぽん酢しょうゆ')?.id,
      klFood('みそ')?.id, klFood('味噌')?.id, klFood('合わせ味噌')?.id, klFood('信州味噌')?.id,
      klFood('白味噌')?.id, klFood('赤味噌')?.id,
    // 2026-08-25 便KY: 「だししょうゆ」は 17007（こいくちしょうゆ）から 17087（だししょうゆ）へ。
    // 八訂に実収載があり、食塩相当量が7.3g/100g とこいくちしょうゆ(14.5g)の半分なので、
    // 普通のしょうゆで代表すると塩分が2倍で出ていた。**「減塩」と書いていないものを巻き込まない**という
    // KL-5のねらい（減塩しょうゆ17086に流れないこと）は変わらない
    ], [
      '17007', '17007', '17007', '17007',
      '17008', '17087', '17137',
      '17045', '17045', '17045', '17045',
      '17044', '17046',
    ])
  }
}

// ==========================================================================================
// 便KN（2026-08-25・オーナーの書き溜め3件）
// ==========================================================================================
//
// ①レシピ詳細「◯人分で作るときの1食あたり」→「1食あたり」
// ②「価格がわからない〜これより高くなります」の「これより高くなります」を省く
// ③長い説明のうち、実質箇条書きになっているものを箇条書きにする
{
  const knRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const knRead = (rel) => readFileSync(path.join(knRoot, rel), 'utf-8')

  // ---------- KN-1: 「1食あたり」が何人分の1食なのか、画面から読み取れること ----------
  // オーナー原文（2026-08-25 便KN）:「◯人分で作るときの１食あたり→１食あたり」。
  // 2026-07-28 便BY/COST-03 が「1食あたり」だけだとレシピ全量の値と読まれる、として
  // 人数分を常時添えたが、**人数分は同じ画面の別の場所に出ている**ので、同じ数字を1画面で
  // 3回言うことになっていた。消してよいのは、消しても人数分が画面に残るから。
  //
  // 【2026-08-25 便KS・③で見張るものを1つに絞った】
  // オーナー原文:「レシピ詳細の材料下段「登録：◯人分」がここに書いてあると、材料の原価などが
  // その人数分であるかのように見える。削除。知りたかったら編集で確認できるし。」
  // 便KNの時点では人数分が2か所（①人数ステッパー ②「登録: ◯人分」）に出ていて、この見張りは
  // **どちらかが消えたら赤**にしていた。②を消した今、残る手がかりは①だけなので、
  // 守るべきものは「①が消えないこと」に絞る（②が戻ってこないことも同時に見る＝
  // 消した理由が「同じ人数を何度も読ませない」ことなので、戻ると元の分かりにくさに戻る）。
  //
  // ①は**表示中の人数**（人数ステッパーの数字）で、1食あたりの分母そのもの。
  // 材料の分量・原価もこの人数で動くので、画面の数字はすべて同じ人数を指す。
  {
    eq('KN-1 食費の1食あたりに人数分を繰り返さない', ja.detail.pricePerServing.includes('人分で作るとき'), false)
    eq('KN-1 栄養の1食あたりにも人数分を繰り返さない', ja.nutrition.summaryLabel.includes('人分で作るとき'), false)
    eq('KN-1 食費は「1食あたり」と言う', ja.detail.pricePerServing.includes('1食あたり'), true)
    eq('KN-1 栄養も「1食あたり」と言う', ja.nutrition.summaryLabel.includes('1食あたり'), true)
    // 消してよい根拠＝同じ画面（レシピ詳細）に、1食あたりの分母になる人数が残っていること。
    // 材料の見出し行にある人数ステッパーの数字がそれで、**これが消えたら赤**になる
    // ＝「1食あたり」だけでは何人分の1食か分からない状態に戻る
    const knDetail = knRead('src/pages/RecipeDetailPage.tsx')
    eq('KN-1 レシピ詳細に人数ステッパーの人数が出ている', knDetail.includes('ja.detail.servingsUnit'), true)
    eq('KN-1 人数ステッパーの単位は「人分」', ja.detail.servingsUnit, '人分')
    // 便KS・③で消した「登録: ◯人分」が戻っていないこと（文言も画面も両方見る）
    eq('KN-1 「登録: ◯人分」の文言は持たない', 'servingsRegisteredNote' in ja.detail, false)
    eq('KN-1 レシピ詳細に登録人数の併記を出していない', knDetail.includes('servingsRegisteredNote'), false)
    // 「原価を編集」が出たり消えたりする行の高さは先に取ってある（2026-08-23 便JOの手当て）。
    // 併記を消したときに行ごと消すと、原価を見るたびに材料の1行目が48px下へずれる形に戻る
    eq('KN-1 原価のボタンが出る行は高さを先に取ってある', knDetail.includes('flex min-h-11 items-center justify-between'), true)
  }

  // ---------- KN-2: 「実際はこれより高くなります」とは言い切れない ----------
  // オーナー原文:「塩などは価格はない場合には仮置きして値段が入っていた。
  //               必ずしも高くはならないので、「これより高くなります」は省く。」
  //
  // 「価格が分からない材料」は合計に1円も入らないので、その分だけなら確かに安く出る。
  // だが同じ合計の中には、**書かれた分量を使わずに入れた仮置きの金額**も混ざっている
  // （2026-08-23 便KE が「1回に使う量」で登録した食材＝塩・こしょう・ごま・揚げ油ほか）。
  // 仮置きは多くも少なくも外れるので、合計が実際より高いか安いかは決まらない。
  // ＝「実際はこれより高くなります」は言い切れない、というオーナーの見立てが正しい。
  {
    eq('KN-2 「これより高くなります」と言い切らない', ja.detail.costPricelessNote.includes('高くなります'), false)
    // 月間の献立の同じ注記（mealPlan.weekCostPriceless）と同じ言い方にそろえる。
    // 同じことを画面ごとに違う言い方で出さないため（ja.ts のコメントにも「揃える」とある）
    eq('KN-2 月間の献立の注記と同じ言い方', ja.detail.costPricelessNote, ja.mealPlan.weekCostPriceless)
    eq('KN-2 除いた材料の件数は今までどおり言う', ja.detail.costPricelessNote.includes('{n}件'), true)

    // --- ここから、オーナーの見立てを実装と実データで確かめる ---
    const knIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    // 塩の「少々」は「価格が分からない材料」に数えられず、仮置きの1円が入る（便KE で残した扱い）
    eq('KN-2 塩「少々」には仮置きの金額が入る', estimateIngredientYen({ name: '塩', amount: '少々', unit: '' }, knIndex)?.yen, 1)
    eq('KN-2 塩「少々」は書かれた分量を2倍にしても金額が変わらない',
      estimateIngredientYen({ name: '塩', amount: '少々', unit: '' }, knIndex)?.rawYen ===
        estimateIngredientYen({ name: '塩', amount: '少々少々', unit: '' }, knIndex)?.rawYen, true)
    // 「書かれた分量を2倍にしても金額が動かない」＝その行の金額は分量から出ていない＝仮置き。
    // 同梱109品を実際に数える（2026-08-25 実測: 783行中93行・74品）。
    // 件数そのものはレシピが増えれば動くので、下限だけを見張る（0件になったら前提が崩れる）
    let knRows = 0
    let knAssumedRows = 0
    let knAssumedRecipes = 0
    for (const def of starterDefs) {
      let inRecipe = 0
      for (const ing of def.ingredients ?? []) {
        knRows++
        if (ing.price != null && ing.price > 0) continue
        const one = estimateIngredientYen(ing, knIndex)
        if (one == null || one.rawYen <= 0) continue
        const twice = estimateIngredientYen(
          { ...ing, amount: scaleAmount(ing.amount ?? '', 1, 2, ing.unit ?? '') },
          knIndex,
        )
        if (twice != null && Math.abs(twice.rawYen - one.rawYen) > 1e-9) continue
        inRecipe++
      }
      knAssumedRows += inRecipe
      if (inRecipe > 0) knAssumedRecipes++
    }
    eq('KN-2 材料の行を数えられている（0行なら見張りが壊れている）', knRows > 500, true)
    eq('KN-2 仮置きの金額が入った材料の行が実在する（2026-08-25 実測93行）', knAssumedRows >= 50, true)
    eq('KN-2 仮置きの金額が入った品が実在する（2026-08-25 実測74品）', knAssumedRecipes >= 40, true)
  }

  // ---------- KN-3: 実質箇条書きの見つけ方を残す ----------
  // オーナー原文:「アプリ全体として、長い説明は、箇条書きにできるところは箇条書きにして。
  //               今は実質箇条書きなのに文頭に何もないのでわかりづらい。」
  //
  // 見つけ方（機械的に決める。人の感想で増減させない）:
  //   ・ja.ts の文言のうち 40字以上
  //   ・「。」で切ると3つ以上の文が並ぶ（＝並列が続いている＝実質箇条書き）
  //   ・文頭に印（・①②…）が無く、改行でも行分けされていない（＝続けて読ませている）
  // これに当たるものを scripts/data/ja-bullet-known.json と突き合わせる。
  //   ・一覧に無いものが現れたら赤（＝新しい長い説明を、続けて読ませる形で足せない）
  //   ・一覧にあるのにもう当たらないときも赤（＝直したら一覧から消す）
  // 一覧には**1件ずつ「なぜ箇条書きにしないか」の理由**を書く。理由なしに足さないこと。
  {
    const KN_MIN_LEN = 40
    const KN_MIN_SENTENCES = 3
    const knStrings = []
    const knWalk = (obj, prefix) => {
      for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'string') knStrings.push({ key: full, value })
        else if (value && typeof value === 'object') knWalk(value, full)
      }
    }
    knWalk(ja, '')
    eq('KN-3 ja.ts の文言を読めている（0件なら見張りが壊れている）', knStrings.length > 1000, true)
    const knHits = []
    for (const { key, value } of knStrings) {
      if (value.length < KN_MIN_LEN) continue
      if (/^[\s]*[・①②③④⑤⑥⑦⑧⑨]/.test(value)) continue
      if (value.includes('\n')) continue
      if (value.split('。').filter((part) => part.trim() !== '').length < KN_MIN_SENTENCES) continue
      knHits.push(key)
    }
    const knKnown = JSON.parse(knRead('scripts/data/ja-bullet-known.json'))
    // 「_」で始まる項目は読み手向けの説明。一覧そのものではない
    const knAllowed = Object.keys(knKnown).filter((k) => !k.startsWith('_'))
    eq(
      'KN-3 続けて読ませる長い説明が、一覧に無いところに増えていない',
      knHits.filter((k) => !knAllowed.includes(k)),
      [],
    )
    eq(
      'KN-3 一覧に、もう当てはまらないものが残っていない（直したら消す）',
      knAllowed.filter((k) => !knHits.includes(k)),
      [],
    )
    eq(
      'KN-3 一覧のすべてに、箇条書きにしない理由が書いてある',
      knAllowed.filter((k) => typeof knKnown[k] !== 'string' || knKnown[k].length < 10),
      [],
    )
    // 直したものは、箇条書きの行として持っている（1件でも配列でなくなったら赤）
    eq('KN-3 月タブのロック案内は行で持つ', Array.isArray(ja.mealPlan.monthLockedDescriptionLines), true)
    eq('KN-3 買い物メモの下書きの説明も行で持つ', Array.isArray(ja.shopping.candidateDescriptionLines), true)
    const knLines = [
      ...(Array.isArray(ja.mealPlan.monthLockedDescriptionLines) ? ja.mealPlan.monthLockedDescriptionLines : []),
      ...(Array.isArray(ja.shopping.candidateDescriptionLines) ? ja.shopping.candidateDescriptionLines : []),
    ]
    eq(
      'KN-3 行に分けたものは、1行ずつが40字以上3文の形に戻っていない',
      knLines.filter(
        (line) => line.split('。').filter((part) => part.trim() !== '').length >= KN_MIN_SENTENCES,
      ),
      [],
    )
    // 文頭の印は画面側が付ける（読み上げには渡さない＝aria-hidden）。
    // 印を文言そのものに書き込むと、行を並べ替えたときに印だけ残る
    const knMealPlanPage = knRead('src/pages/MealPlanPage.tsx')
    const knShoppingPage = knRead('src/pages/ShoppingPage.tsx')
    eq('KN-3 月タブのロック案内に文頭の印が付いている', knMealPlanPage.includes('monthLockedDescriptionLines'), true)
    eq('KN-3 買い物メモの下書きの説明に文頭の印が付いている', knShoppingPage.includes('candidateDescriptionLines'), true)
    eq(
      'KN-3 文言そのものに印を書き込んでいない',
      knLines.filter((line) => /^[・①②③④⑤⑥⑦⑧⑨]/.test(line)),
      [],
    )
  }
}


// ---------- 便LB（2026-08-26）: 「白ワイン」が価格マスタにも成分表にも無かった ----------
// 便KYの申し送り: 「白ワイン」は価格マスタにも成分表にも項目が無く、価格・栄養とも
// 「分からない」のままだった（赤ワインは 2026-08-22 便JG から価格マスタにだけ 600円/1L があった）。
//
// 【調べた日 2026-08-26・家庭用の720mlペットでそろえた実売（税込）】
//   ・カクヤス「メルシャン ビストロ すっきり白 720mlペット」462円 ＝ 642円/1L
//   ・イオンネットスーパー「トップバリュベストプライス 酸化防止剤無添加のワイン 白 720ml」437.80円 ＝ 608円/1L
//   ・カクヤス「メルシャン おいしい酸化防止剤無添加 白ワイン 720mlペット」528円 ＝ 733円/1L
//   中央は 462円/720ml ＝ 642円/1L。**値は赤ワインと同じ600円/1Lにした**——同じ店・同じ銘柄で
//   赤（カクヤス「メルシャン ビストロ やわらか赤 720mlペット」462円）と白が同額だったため。
//   ここで白だけ640円台にすると、実売には無い「白のほうが高い」差がアプリの中にだけできる。
{
  const lbIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lbHit = (name) => matchPriceEntry(name, lbIndex)?.normalizedName ?? 'なし'
  const lbYen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lbIndex)?.yen ?? null
  const lbEntry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }

  // --- LB-5: 行そのもの（値と単位。赤と同じ測り方でそろえてある） ---
  eq('LB-5 白ワインの目安価格は600円/1L', lbEntry('白ワイン'), [600, '1L'])
  eq('LB-5 赤ワインは据え置き（既存の行は1件も変えていない）', lbEntry('赤ワイン'), [600, '1L'])
  eq('LB-5 赤と白は同じ単位（容量をそろえないと値段のちがいと読み違える）', lbEntry('白ワイン')[1], lbEntry('赤ワイン')[1])
  eq('LB-5 版番号を上げてある（上げないと既存の端末に新しい行が届かない）', PRICE_DEFAULTS_VERSION_FOR_JG >= 17, true)

  // --- LB-6: 材料名からこの行に届く（直す前は「価格が分からない材料」だった） ---
  eq('LB-6 「白ワイン」は白ワインの行に当たる', lbHit('白ワイン'), '白ワイン')
  eq('LB-6 「白ぶどう酒」も白ワイン（直す前は「酒 260円/1L」に当たっていた）', lbHit('白ぶどう酒'), '白ワイン')
  eq('LB-6 「赤ワイン」は今までどおり赤ワイン', lbHit('赤ワイン'), '赤ワイン')
  // ワインとワインビネガーは別物。便KXが塞いだ誤爆を、白の行を足したことで作り直していないこと
  eq('LB-6 ワインビネガーの3つの書き方はワインビネガーの行のまま', [
    lbHit('ワインビネガー'), lbHit('白ワインビネガー'), lbHit('赤ワインビネガー'),
  ], ['ワインビネガー', 'ワインビネガー', 'ワインビネガー'])
  eq('LB-6 「酒」「料理酒」は今までどおり酒の行', [lbHit('酒'), lbHit('料理酒')], ['酒', '酒'])

  // --- LB-7: 実際の分量で按分できる（1L建てのままでも数字が出る） ---
  eq('LB-7 白ワイン100mlは60円', lbYen('白ワイン', '100', 'ml'), 60)
  eq('LB-7 「カップ1/2」(100ml)も同じ60円', lbYen('白ワイン', '1/2', 'カップ'), 60)
  eq('LB-7 大さじ2(30ml)は18円', lbYen('白ワイン', '2', '大さじ'), 18)
  eq('LB-7 赤ワイン100mlも同じ60円（赤と白で数字が食い違わない）', lbYen('赤ワイン', '100', 'ml'), 60)
  eq('LB-7 白ワインビネガー大さじ2は、ワインビネガーの値段で30円', lbYen('白ワインビネガー', '2', '大さじ'), 30)
}


// ---------- 便LF（2026-08-26）: 価格マスタの調べ直し 第1弾（乾物・海藻・乳製品・鶏） ----------
// 司令部が決めた物差し（2026-08-26）に沿って測り直した。使った店は2つだけ:
//   ・ヤオコーネットスーパー https://ns.yaoko-net.com/products?category=<番号>（税込表示）
//   ・東急ストアネットスーパー https://ns.tokyu-bell.jp/shop/c/c<コード>/（「参考税込」の表示を使う）
// 代表値の出し方: その食材そのものの商品（味付け・惣菜・ふりかけは入れない）を2店ぶん並べ、
//   ①総務省 小売物価統計の基本銘柄（kouri-202608.xlsx）が産地や容量を決めている品目はその定義に合うものだけ
//   ②「大容量」「徳用」「業務用」と明記されたもの、等級が上と明記されたもの（一等品など）、
//     銘柄鶏・地鶏・料理店の銘柄は入れない
//   ③3件以上なら中央値、2件なら平均、1件しか無ければ**動かさない**
// 1件ずつの店名・商品名・容量・税込・調べた日は src/data/priceDefaults.ts の各行のコメントに書いてある。
//
// 【ピン留め（scripts/test-price.mjs の ORIGINAL_30）に当たって動かせなかったもの】
//   同じ物差しで測った実勢だけを書き残す（値は変えていない。外すかどうかは司令部が決める）:
//   ・鶏もも肉 130円/100g → 実勢の中央値 171円/100g（ブロイラーの正肉7件）
//   ・牛乳 200円/1L → 実勢の中央値 311円/1L（紙パック1,000mLの成分無調整10件）
//   ・卵 25円/1個 → 実勢の中央値 35円/1個（10個入りパック7件）
//   ・鶏むね肉 90円/100g → 実勢の中央値 106円/100g（差は+18%で、ほかの4件より小さい）
{
  const lfEntry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lfIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lfYen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lfIndex)?.yen ?? null
  const lfPerServing = (title) => {
    const def = starterDefs.find((d) => d.title === title)
    return def ? Math.round(estimateRecipeCost(def.ingredients, lfIndex).total / def.servings) : null
  }

  // --- LF-1: 直した行そのもの（値と単位）。根拠は priceDefaults.ts の同じ行のコメント ---
  for (const [name, pricePerUnit, unit] of [
    // 乾燥わかめ・カットわかめ・乾燥芽ひじき・切り干し大根は、2026-08-26 の司令部の差し戻しで
    // **産地の判断待ち**になり、値を元に戻した（LF-21 が見ている）
    ['昆布', 1100, '100g'],
    ['塩昆布', 50, '10g'],
    ['高野豆腐', 220, '5枚'],
    ['しらたき', 125, '1袋'],
    ['ピザ用チーズ', 430, '200g'],
    ['生クリーム', 490, '200ml'],
    ['鶏ささみ', 70, '1本'],
  ]) {
    eq(`LF-1 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, lfEntry(name), [pricePerUnit, unit])
  }

  // --- LF-2: 調べ直したうえで動かさなかったもの（「実測とずれている」と言って動かさないための留め） ---
  // 鶏手羽先: 使える実売が1件だけ（ヤオコー「国産香味どり手羽先」250g 264.6円 ＝106円/100g）。
  // 1本＝35gで37円になり、いまの40円との差は3円。物差しの「1件しか取れなかったものは動かさない」に従う
  eq('LF-2 鶏手羽先は単一ソースなので40円/1本のまま', lfEntry('鶏手羽先'), [40, '1本'])
  // ピン留めされている4件は、実勢を書き残したうえで**値を動かしていない**
  eq('LF-2 鶏もも肉はピン留めのまま', lfEntry('鶏もも肉'), [130, '100g'])
  eq('LF-2 鶏むね肉はピン留めのまま', lfEntry('鶏むね肉'), [90, '100g'])
  eq('LF-2 牛乳はピン留めのまま', lfEntry('牛乳'), [200, '1L'])
  eq('LF-2 卵はピン留めのまま', lfEntry('卵'), [25, '1個'])

  // --- LF-3: 実際の分量で按分できる（単位を変えていないので、今までどおり数字が出る） ---
  eq('LF-3 昆布10gは110円', lfYen('昆布', '10', 'g'), 110)
  eq('LF-3 高野豆腐3枚は132円', lfYen('高野豆腐', '3', '枚'), 132)
  eq('LF-3 鶏ささみ2本は140円', lfYen('鶏ささみ', '2', '本'), 140)
  eq('LF-3 しらたき1袋は125円', lfYen('しらたき', '1', '袋'), 125)

  // --- LF-4: 同梱109品で動いた品の1食あたり（動いたのは12品だけ） ---
  for (const [title, before, after] of [
    ['ひじきの煮物', 50, 106], // 第6弾でひじきを判断待ちに戻したので、油揚げのぶんだけ残った
    ['きゅうりとわかめの酢の物', 58, 70], // 第6弾でわかめを判断待ちに戻したので元に戻った
    ['切り干し大根のハリハリ漬け', 67, 61], // 第6弾で判断待ちに戻したので元に戻った
    ['しらたきのチャプチェ風', 194, 245], // 第5弾のごま油でさらに上がった
    ['だしのとり方', 70, 139], // 第2弾のかつお節 15→25円/1袋 でさらに上がった
    ['豆腐とわかめの味噌汁', 28, 33], // 第6弾でわかめを判断待ちに戻したので元に戻った
    ['キャベツの塩昆布あえ', 83, 94], // 第5弾のごま油でさらに上がった
    ['高野豆腐の含め煮', 72, 93],
    ['豆腐グラタン', 158, 171],
    ['鶏ささみの梅しそレンジ蒸し', 146, 206], // 第4弾の青じそ 100→125円/10枚 でさらに上がった
    ['ささみとブロッコリーのごま和え', 134, 200], // 第4弾のブロッコリー 200→280円/1株 でさらに上がった
  ]) {
    eq(`LF-4 「${title}」の1食あたりが${before}→${after}円`, lfPerServing(title), after)
  }
  // 動いていない品の代表（乾物・海藻・鶏ささみを使っていない品は1円も動かない）
  // 2026-08-26 便LF 第4弾で生しいたけ（100→280円/6枚）を直したので、寄せ鍋も動くようになった
  eq('LF-4 「寄せ鍋」は第6〜7弾の生しいたけ調べ直しで217→241円', lfPerServing('寄せ鍋'), 241)

  // --- LF-5: 「最新の目安価格に更新する」で利用者に届く（自分で直した行は守られる） ---
  // ここが通らないと、直した値は**新しく入れた端末にしか届かない**（版番号を上げるだけでは
  // 既存の行は入れ替わらない＝priceDefaults.ts 冒頭に書いてある限界）。
  {
    // 2026-08-26 便LF 第6弾: 目安価格そのものを書き写すと、測り直すたびにここが赤くなる（禁じ手③）。
    // **いまのマスタの値を引いて突き合わせる**形にして、見張る中身（何が入れ替わって何が守られるか）
    // だけを残す。旧値は「その端末が持っている古い値」なので、ここでは固定の数字でよい
    const lfNow = (name) => PRICE_DEFAULTS.find((d) => d.name === name)
    const lfOldRows = [
      // 投入時の目安のままの行（＝入れ替わってほしい）
      { id: 1, name: '昆布', pricePerUnit: 400, unit: '100g', isDefault: true, defaultPricePerUnit: 400, defaultUnit: '100g' },
      { id: 2, name: 'ピザ用チーズ', pricePerUnit: 300, unit: '200g', isDefault: true, defaultPricePerUnit: 300, defaultUnit: '200g' },
      // 自分で価格を直した行（＝1円も触られてほしくない）
      { id: 3, name: '切り干し大根', pricePerUnit: 150, unit: '50g', isDefault: false, defaultPricePerUnit: 130, defaultUnit: '50g' },
      // 自分で追加した食材（既定に同じ名前が無い）
      { id: 4, name: 'うちの手作りだし', pricePerUnit: 300, unit: '1L' },
    ]
    const lfPlan = planPriceRefresh(lfOldRows, PRICE_DEFAULTS)
    eq('LF-5 入れ替わるのは目安のままの2行だけ', lfPlan.targets.map((t) => t.name).sort(), ['ピザ用チーズ', '昆布'])
    eq(
      'LF-5 昆布は旧400円から、いまの目安価格になる',
      lfPlan.targets.filter((t) => t.name === '昆布').map((t) => [t.fromPricePerUnit, t.toPricePerUnit]),
      [[400, lfNow('昆布').pricePerUnit]],
    )
    eq(
      'LF-5 ピザ用チーズも旧300円から、いまの目安価格になる',
      lfPlan.targets.filter((t) => t.name === 'ピザ用チーズ').map((t) => [t.fromPricePerUnit, t.toPricePerUnit]),
      [[300, lfNow('ピザ用チーズ').pricePerUnit]],
    )
    eq('LF-5 自分で直した行・自分で足した食材は触らない', lfPlan.keptByUser, 2)
    // すでに今の目安価格になっている端末では、同じ行がもう対象にならない（押しても何も起きない）
    const lfNewRows = [
      { id: 1, name: '昆布', pricePerUnit: lfNow('昆布').pricePerUnit, unit: lfNow('昆布').unit, isDefault: true, defaultPricePerUnit: lfNow('昆布').pricePerUnit, defaultUnit: lfNow('昆布').unit },
    ]
    eq('LF-5 もう新しい値の行は対象にならない', planPriceRefresh(lfNewRows, PRICE_DEFAULTS).targets.length, 0)
    eq('LF-5 もう新しい値の行は「すでに今の目安価格」に数えられる', planPriceRefresh(lfNewRows, PRICE_DEFAULTS).alreadyCurrent, 1)
  }

  // --- LF-6: 根拠のコメントが無い項目を増やさない見張り（司令部の指示・2026-08-26） ---
  // 目安価格は「どこの店の・どの商品を・いつ調べたか」が行のすぐ上に書いてあってはじめて、
  // 次の便が測り直せる。**根拠が書けないものは動かさない**（物差し §3）の裏返しで、
  // 根拠を書かないまま行を足す・値を直すことを塞ぐ。
  // いま根拠のコメントが無いのは下の119件で、これは2026-08-26より前から入っていた行。
  // **この一覧を増やさないこと。**行のすぐ上に根拠を書いたら、その名前をこの一覧から消す
  // （増えても減っても赤になるので、直したら一緒にここも直す）。
  {
    const lfRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
    const lfSrc = readFileSync(path.join(lfRoot, 'src/data/priceDefaults.ts'), 'utf-8')
    const lfBody = lfSrc.slice(lfSrc.indexOf('export const PRICE_DEFAULTS: PriceDefaultItem[] = ['))
    const lfWithoutSource = []
    let lfHasComment = false
    for (const rawLine of lfBody.split('\n')) {
      const line = rawLine.trim()
      const item = line.match(/^\{ name: '(.+?)', pricePerUnit: (\d+), unit: '(.+?)' \},$/)
      if (item) {
        if (!lfHasComment) lfWithoutSource.push(item[1])
        lfHasComment = false
        continue
      }
      if (line.startsWith('//')) lfHasComment = true
      else if (line !== '') lfHasComment = false
    }
    const LF_NO_SOURCE_KNOWN = [
      'にんじん', 'じゃがいも', 'キャベツ', '白菜', '大根', 'もやし', 'きゅうり', 'トマト',
      'ピーマン', 'なす', 'ねぎ', 'ほうれん草', 'しめじ', 'えのき', '鶏むね肉', '豚バラ肉',
      '豚こま切れ肉', '合いびき肉', 'さば', '牛乳', '豆腐', '赤唐辛子', 'しょうが', 'さんま',
      'すだち', '刻みねぎ', '生鮭', 'むきえび', 'サバ水煮缶', '錦糸卵', 'スパゲッティ', '冷凍うどん',
      '食パン', '揚げ油', 'だし汁', '水またはだし汁', '中濃ソース', 'ケチャップ', 'マヨネーズ', 'ポン酢',
      'めんつゆ', 'カレールー', 'シチュールー', '鶏がらスープの素', 'おろしにんにく', '塩', '塩こしょう', 'こしょう',
      '七味唐辛子', '砂糖', '甜麺醤', '豆板醤', '粉山椒', 'ラー油', '紅しょうが', '刻みのり',
      '白ごま', '白すりごま', 'すりごま', '黒いりごま', 'いりごま', '白練りごま', 'カットトマト缶', 'みかん缶',
      'メープルシロップ', '黒みつ', 'アーモンドエッセンス', 'さわら', '生だら', '万能ねぎ', '梅干し', 'そうめん',
      'グラノーラ', 'こしあん', 'キウイ', 'はちみつ', 'オイスターソース', 'コチュジャン', 'カレー粉', '乾燥ハーブ',
      '卵白',
    ]
    eq(
      'LF-6 根拠のコメントが無い目安価格を増やしていない（増えても減っても赤。直したら一覧から消す）',
      lfWithoutSource,
      LF_NO_SOURCE_KNOWN,
    )
    eq('LF-6 一覧に同じ名前を2回書いていない', new Set(LF_NO_SOURCE_KNOWN).size, LF_NO_SOURCE_KNOWN.length)
    // 行の総数と突き合わせる（正規表現が読み落としていたら、ここで気づける）
    const lfParsedCount = (lfBody.match(/^\s*\{ name: '.+?', pricePerUnit: \d+, unit: '.+?' \},$/gm) ?? []).length
    eq('LF-6 見張りが価格マスタの全行を読めている', lfParsedCount, PRICE_DEFAULTS.length)
  }
}


// ---------- 便LF 第2弾（2026-08-26）: 肉の加工品・練り物・乾物 ----------
// 第1弾と同じ物差し。**便LFでは、実勢との差が±20%に届かないものは動かさない**ことにした
// （司令部の既定「差が小さいものは動かさない」を、便の中で1本の線に決めたもの。
//   ±20%は、司令部が渡した「1回目に20%以上ずれていると出た品」の表と同じ線）。
{
  const lf2Entry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lf2Index = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lf2Yen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lf2Index)?.yen ?? null

  // --- LF-7: 直した行そのもの ---
  for (const [name, pricePerUnit, unit] of [
    ['豚ひき肉', 160, '100g'],
    ['鶏ひき肉', 150, '100g'],
    ['ウインナー', 35, '1本'],
    ['ちくわ', 30, '1本'],
    ['春雨', 155, '100g'],
    ['オートミール', 120, '100g'],
    ['かつお節', 25, '1袋'],
    ['干ししいたけ', 700, '30g'],
  ]) {
    eq(`LF-7 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, lf2Entry(name), [pricePerUnit, unit])
  }

  // --- LF-8: 実勢を測ったうえで動かさなかったもの（理由は priceDefaults.ts の行のコメント） ---
  // ①ピン留めされた同じ食材の行があり、動かすと同じ肉が書き方で2倍ちがう表になるもの
  eq('LF-8 豚バラ薄切りは150円/100gのまま（実勢300円・「豚バラ肉」がピン留め）', lf2Entry('豚バラ薄切り'), [150, '100g'])
  // 牛の3行は 2026-08-26 のオーナー裁定で輸入の並253円/100gへそろえた（LF-21が見ている）。
  // ピン留めの「牛こま切れ肉」も一緒に動かしてある＝1行だけ動かさない
  eq('LF-8 豚バラ薄切りはまだ150円/100g（豚バラ肉のピン留めと同じ値）', lf2Entry('豚バラ薄切り'), [150, '100g'])
  // 同じ食材が書き方で値段が変わらないこと（ここが崩れると「豚バラ肉」と「豚バラ薄切り」で原価が食い違う）
  eq('LF-8 豚バラ肉と豚バラ薄切りは同じ値', lf2Entry('豚バラ肉'), lf2Entry('豚バラ薄切り'))
  eq('LF-8 牛こま切れ肉と牛薄切り肉・牛切り落とし肉は同じ値', [lf2Entry('牛薄切り肉'), lf2Entry('牛切り落とし肉')], [lf2Entry('牛こま切れ肉'), lf2Entry('牛こま切れ肉')])
  // ②実勢との差が±20%に届かないもの
  eq('LF-8 豚ロース薄切りは180円/100gのまま（実勢214円＝+19%）', lf2Entry('豚ロース薄切り'), [180, '100g'])
  // 2026-08-26 便LF 第7弾: 並のグレード（各店のPBの4連パック）で測り直したら93円/4枚まで下がり、
  // ±20%を超えたので150→95円に直した。第2弾は棚の9件の中央値（123円）で「-18%だから据え置き」と
  // 書いていたが、その中央値自体が少し良いものに引っ張られていた
  eq('LF-8 ハムは95円/4枚（並のグレードで測り直して150円から下げた）', lf2Entry('ハム'), [95, '4枚'])
  // パン粉は第7弾で55→30円（元の値）に戻した＝並のグレードだと差が+20%に届かない
  eq('LF-8 パン粉は30円/50gに戻した', lf2Entry('パン粉'), [30, '50g'])
  eq('LF-8 ベーコンは200円/4枚のまま（実勢178円＝-11%）', lf2Entry('ベーコン'), [200, '4枚'])
  // ③2店のどちらにも実売が無く、根拠が書けないもの（物差し「根拠が書けないものは動かさない」）
  eq('LF-8 粉寒天は50円/4gのまま（2店とも粉寒天を扱っていない）', lf2Entry('粉寒天'), [50, '4g'])

  // --- LF-9: 実際の分量で按分できる ---
  eq('LF-9 豚ひき肉150gは240円', lf2Yen('豚ひき肉', '150', 'g'), 240)
  eq('LF-9 鶏ひき肉200gは300円', lf2Yen('鶏ひき肉', '200', 'g'), 300)
  eq('LF-9 ウインナー4本は140円', lf2Yen('ウインナー', '4', '本'), 140)
  eq('LF-9 春雨50gは78円', lf2Yen('春雨', '50', 'g'), 78)
  eq('LF-9 パン粉1/2カップ(20g)は12円', lf2Yen('パン粉', '1/2', 'カップ'), 12)
  // かつお節は「1袋」でも「g」でも書かれる。袋＝3g（栄養側の目安量）で換算するので、
  // だしを取る20gは167円＝袋入りの花かつおで買ったときの実費（約140円）と同じところに落ちる
  eq('LF-9 かつお節1袋は25円', lf2Yen('かつお節', '1', '袋'), 25)
  eq('LF-9 かつお節20gは167円', lf2Yen('かつお節', '20', 'g'), 167)
}

// ---------- 便LF 第3弾（2026-08-26）: 豆腐・大豆加工品・乳製品と、便LDから回ってきたチーズ ----------
{
  const lf3Entry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lf3Index = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lf3Hit = (name) => matchPriceEntry(name, lf3Index)?.normalizedName ?? 'なし'
  const lf3Yen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lf3Index)?.yen ?? null

  // --- LF-10: 直した行 ---
  for (const [name, pricePerUnit, unit] of [
    ['こんにゃく', 120, '1枚'],
    ['油揚げ', 30, '1枚'],
    ['生おから', 130, '300g'],
    ['蒸し大豆', 115, '1パック'],
    ['プレーンヨーグルト', 60, '100g'],
  ]) {
    eq(`LF-10 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, lf3Entry(name), [pricePerUnit, unit])
  }

  // --- LF-11: 調べ直したうえで動かさなかったもの ---
  // 豆腐は「豆腐」がピン留め（ORIGINAL_30）なので、同じ食材の3行をそろえて据え置いた。
  // 実勢は138円/1丁（350g換算・13件の中央値）でいまの40円の3.5倍。ピン留めを外すかは司令部の判断
  eq('LF-11 豆腐の3行は40円/1丁でそろっている', [lf3Entry('豆腐'), lf3Entry('木綿豆腐'), lf3Entry('絹ごし豆腐')], [
    [40, '1丁'], [40, '1丁'], [40, '1丁'],
  ])
  eq('LF-11 厚揚げは60円/1枚のまま（実勢54円＝-11%）', lf3Entry('厚揚げ'), [60, '1枚'])
  eq('LF-11 大豆水煮は120円/150gのまま（重さの分かる実売が1件だけ）', lf3Entry('大豆水煮'), [120, '150g'])
  eq('LF-11 豆乳は200円/1Lのまま（実勢230円＝+15%）', lf3Entry('豆乳'), [200, '1L'])
  eq('LF-11 無塩バターは600円/200gのまま（実勢631円＝+5%）', lf3Entry('無塩バター'), [600, '200g'])
  // 2026-08-26 便LF 第7弾: 並のグレードで測り直したら477円/80gまで下がり、±20%を超えたので
  // 620→475円に直した（620円は便KPが2026-08-25に入れた値）
  eq('LF-11 粉チーズは475円/80g（並のグレードで測り直して620円から下げた）', lf3Entry('粉チーズ'), [475, '80g'])

  // --- LF-12: 便LDから回ってきたチーズ（2店で裏を取ってから足したもの） ---
  for (const [name, pricePerUnit, unit] of [
    ['チーズ', 220, '112g'],
    ['クリームチーズ', 525, '200g'],
    ['カッテージチーズ', 565, '200g'],
    ['カマンベール', 400, '90g'],
    ['モッツァレラ', 395, '100g'],
    ['マスカルポーネ', 280, '100g'],
  ]) {
    eq(`LF-12 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, lf3Entry(name), [pricePerUnit, unit])
  }
  // **チェダーの行は作らない**（司令部の指示。家庭用で「チェダー」と書かれた商品には
  // プロセスチーズが混ざっていて、何の値段なのかが定まらない）
  eq('LF-12 チェダーの価格行は作っていない', PRICE_DEFAULTS.some((d) => d.name.includes('チェダー')), false)

  // 書き方ちがいが、それぞれ自分の行に届く（「チーズ」という短い名前を足したので、
  // ほかのチーズが巻き込まれていないことをここで押さえる）
  eq('LF-12 チーズの書き方ちがいが、それぞれの行に届く', [
    lf3Hit('チーズ'), lf3Hit('スライスチーズ'), lf3Hit('プロセスチーズ'),
    lf3Hit('とろけるチーズ'), lf3Hit('シュレッドチーズ'), lf3Hit('粉チーズ'), lf3Hit('パルメザンチーズ'),
    lf3Hit('クリームチーズ'), lf3Hit('カッテージチーズ'),
    lf3Hit('カマンベールチーズ'), lf3Hit('モッツァレラチーズ'), lf3Hit('マスカルポーネチーズ'),
  ], [
    'チーズ', 'チーズ', 'チーズ',
    'ピザ用チーズ', 'ピザ用チーズ', '粉チーズ', '粉チーズ',
    'クリームチーズ', 'カッテージチーズ',
    'カマンベール', 'モッツァレラ', 'マスカルポーネ',
  ])
  // 分量で按分できる
  eq('LF-12 スライスチーズ2枚(36g)は71円', lf3Yen('スライスチーズ', '2', '枚'), 71)
  eq('LF-12 クリームチーズ100gは263円', lf3Yen('クリームチーズ', '100', 'g'), 263)
  eq('LF-12 マスカルポーネ250gは700円', lf3Yen('マスカルポーネ', '250', 'g'), 700)

  // --- LF-13: 「最新の目安価格に更新する」で、足した6行が既存の端末にも届く ---
  // 新しい行は「まだ名前が無い項目の追加」なので版番号のトップアップで届く。**版番号を上げること**
  eq('LF-13 版番号を18以上にしてある（上げないと足した行が既存の端末に届かない）', PRICE_DEFAULTS_VERSION_FOR_JG >= 18, true)
}

// ---------- 便LF 第4弾（2026-08-26）: 野菜・きのこ・薬味 ----------
// 野菜は季節で動くので、**調べた日（2026-08-26）を各行のコメントに必ず書いてある**。
{
  const lf4Entry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lf4Index = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lf4Yen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lf4Index)?.yen ?? null

  // --- LF-14: 直した行 ---
  for (const [name, pricePerUnit, unit] of [
    ['生しいたけ', 245, '6枚'],
    ['にら', 160, '1束'],
    ['ブロッコリー', 280, '1株'],
    ['さつまいも', 245, '1本'],
    ['レタス', 190, '1個'],
    ['ゴーヤ', 245, '1本'],
    ['豆苗', 125, '1パック'],
    ['みつば', 155, '1束'],
  ]) {
    eq(`LF-14 「${name}」の目安価格が ${pricePerUnit}円/${unit}`, lf4Entry(name), [pricePerUnit, unit])
  }
  // 青じそと大葉は同じ食材の呼び名ちがい。**値がずれると、同じ材料なのに書き方で原価が変わる**
  eq('LF-14 青じそと大葉は同じ値', lf4Entry('青じそ'), lf4Entry('大葉'))
  // 2026-08-26 便LF 第7弾: 並のグレードで測り直して元の値に戻した4件
  eq('LF-14 ミニトマトは210円/200gに戻した（東急ストアの1件だけ＝単一ソース）', lf4Entry('ミニトマト'), [210, '200g'])
  eq('LF-14 赤パプリカは200円/1個に戻した（ヤオコーの輸入品1件だけ＝単一ソース）', lf4Entry('赤パプリカ'), [200, '1個'])
  eq('LF-14 青じそ・大葉は100円/10枚に戻した（東急ストアの1件だけ＝単一ソース）', lf4Entry('青じそ'), [100, '10枚'])
  eq('LF-14 みょうがは30円/1個に戻した（1パックの個数が書かれておらず1個に直せない）', lf4Entry('みょうが'), [30, '1個'])

  // --- LF-15: 調べ直したうえで動かさなかったもの（理由は priceDefaults.ts の行のコメント） ---
  // ①1袋・1パックでしか売っておらず、マスタの単位（1本・100g）に直せないもの
  eq('LF-15 ごぼうは150円/1本のまま（1袋に何本かが書かれていない）', lf4Entry('ごぼう'), [150, '1本'])
  eq('LF-15 さやいんげんは200円/100gのまま（重さの表示が無い）', lf4Entry('さやいんげん'), [200, '100g'])
  eq('LF-15 パセリは50円/1束のまま（「1パック」と「1束」で量がそろわない）', lf4Entry('パセリ'), [50, '1束'])
  // ②実売が1件しか取れなかったもの
  eq('LF-15 長芋は80円/100gのまま（重さの分かる実売が1件だけ）', lf4Entry('長芋'), [80, '100g'])
  eq('LF-15 オクラは130円/10本のまま（実売が1件だけ・本数の表示も無い）', lf4Entry('オクラ'), [130, '10本'])
  // ③2店とも産直ブランドしか置いていなかったもの
  eq('LF-15 かぼちゃは200円/1-4個のまま（使える実売が0件）', lf4Entry('かぼちゃ'), [200, '1/4個'])
  // ④実勢との差が±20%に届かないもの
  eq('LF-15 れんこんは200円/1節のまま（実勢225円＝+12%）', lf4Entry('れんこん'), [200, '1節'])
  eq('LF-15 なめこは100円/1袋のまま（実勢107円＝+7%）', lf4Entry('なめこ'), [100, '1袋'])
  eq('LF-15 まいたけは130円/1パックのまま（実勢138円＝+6%）', lf4Entry('まいたけ'), [130, '1パック'])
  eq('LF-15 エリンギは100円/1パックのまま（実勢117円＝+17%）', lf4Entry('エリンギ'), [100, '1パック'])
  eq('LF-15 小松菜は150円/1束のまま（実勢150円＝ぴったり同じ）', lf4Entry('小松菜'), [150, '1束'])
  eq('LF-15 水菜は150円/1袋のまま（実勢139円＝-7%）', lf4Entry('水菜'), [150, '1袋'])
  eq('LF-15 チンゲン菜は70円/1株のまま（実勢69円＝-2%）', lf4Entry('チンゲン菜'), [70, '1株'])
  // ⑤ピン留めされた同じ食材の行があるもの
  eq('LF-15 長ねぎは100円/1本のまま（実勢123円。「ねぎ」がピン留め）', lf4Entry('長ねぎ'), [100, '1本'])
  eq('LF-15 ねぎと長ねぎは同じ値', lf4Entry('ねぎ'), lf4Entry('長ねぎ'))

  // --- LF-16: 実際の分量で按分できる ---
  // にんにくは同梱109品で17行ある（いちばん多く使われている野菜）。1玉=45g・1かけ=6gで按分される。
  // 2026-08-26 の司令部の差し戻しで産地の判断待ちになり、値は元の60円/1玉に戻した（LF-21）
  eq('LF-16 にんにく1かけは14円（輸入の並107円/1玉）', lf4Yen('にんにく', '1', 'かけ'), 14)
  eq('LF-16 にんにく1片も同じ14円（書き方ちがい）', lf4Yen('にんにく', '1', '片'), 14)
  eq('LF-16 生しいたけ4枚は163円', lf4Yen('生しいたけ', '4', '枚'), 163)
  eq('LF-16 ブロッコリー1/2株は140円', lf4Yen('ブロッコリー', '1/2', '株'), 140)
  eq('LF-16 青じそ2枚は20円', lf4Yen('青じそ', '2', '枚'), 20)
  eq('LF-16 大葉2枚も同じ20円', lf4Yen('大葉', '2', '枚'), 20)
}

// ---------- 便LF 第5弾（2026-08-26）: 油 ----------
// 油はどの店も内容量をグラムで書いているので、**1L＝920g**（食用油のふつうの重さ）で
// 1Lあたりに直してから比べた。マスタの単位「1L」は変えていない。
{
  const lf5Entry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lf5Index = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const lf5Yen = (name, amount, unit) => estimateIngredientYen({ name, amount, unit }, lf5Index)?.yen ?? null

  // --- LF-17: 直した行 ---
  eq('LF-17 ごま油の目安価格が1,550円/1L', lf5Entry('ごま油'), [1550, '1L'])
  eq('LF-17 オリーブオイルの目安価格が1,950円/1L', lf5Entry('オリーブオイル'), [1950, '1L'])
  // 第5弾で880円にしたが、並のグレード（各店のPB）で測り直すと663円/1L＝+11%だったので元に戻した
  eq('LF-17 米油は600円/1Lに戻した', lf5Entry('米油'), [600, '1L'])

  // --- LF-18: 調べ直したうえで動かさなかったもの ---
  eq('LF-18 サラダ油は400円/1Lのまま（実勢475円＝+19%）', lf5Entry('サラダ油'), [400, '1L'])
  eq('LF-18 酒は260円/1Lのまま（実勢273円＝+5%）', lf5Entry('酒'), [260, '1L'])
  // ヤオコーは酒類の価格を出していないので、本みりんは東急ストアの1件しか読めなかった
  eq('LF-18 みりんは390円/1Lのまま（読めた実売が1件だけ）', lf5Entry('みりん'), [390, '1L'])
  // 「酢」を穀物酢とみるか米酢まで含めるかで254円/1Lにも423円/1Lにもなる。いまの340円はその間
  // 2026-08-26 便LF 第7弾: 「酢」の並は穀物酢と決めたので、340→230円/1Lに直した
  eq('LF-18 酢は230円/1L（並＝穀物酢でそろえた）', lf5Entry('酢'), [230, '1L'])

  // --- LF-19: 「少々」「適量」にボトル1本ぶんの金額が乗らないこと（便BY・便KEの直しを壊していない） ---
  // ここが崩れると、油を1本まるごと使ったことになって1食が数百円はね上がる（便KEの直す前は682円）
  // 「少々」「適量」に当てる量は食材ごとに決まっている（logic の仮定計算。ごま油は小さじ1・
  // オリーブオイルは大さじ1）。ここで見たいのは**ボトル1本ぶんが乗らないこと**なので、
  // どちらも1回に使う量の金額で収まっていればよい
  eq('LF-19 ごま油「少々」は小さじ1相当の8円', lf5Yen('ごま油', '少々', ''), 8)
  eq('LF-19 ごま油「適量」も同じ8円', lf5Yen('ごま油', '適量', ''), 8)
  eq('LF-19 オリーブオイル「適量」は大さじ1相当の29円', lf5Yen('オリーブオイル', '適量', ''), 29)
  eq('LF-19 ごま油大さじ1は23円', lf5Yen('ごま油', '1', '大さじ'), 23)
  eq('LF-19 オリーブオイル大さじ1は29円', lf5Yen('オリーブオイル', '1', '大さじ'), 29)
}

// ---------- 便LF 第6弾（2026-08-26・司令部の差し戻し）: 「棚の中央値」で採った行を見張る ----------
// 【何が起きたか】第1〜5弾は代表値を「2店の棚に並ぶ商品を全部並べた中央値」で採っていた。
// 棚には標準品と一緒に、生芋こんにゃく・国産大豆の手造り豆腐・三陸産わかめ・有機切干大根のような
// **少し良いもの**が並んでいるので、全部の中央値は標準品ではなく「少し良いもの」の値段になる。
// 司令部が同じ店を開いて確かめ、豆腐138円/1丁（実際はヤオコーの標準品で62〜84円）・
// こんにゃく185円/1枚（実際は85〜107円/220g）などのずれが出た。
//
// 【直した測り方】代表値は**並のグレード**で採る:
//   ・その店の標準品（PB・定番の全国銘柄・「あく抜き不要」のような普通の加工まで）を、**各店1つずつ**
//   ・除く: 生芋・手造り・国産大豆・有機・産直・ブランド産地・さしみ用・特殊加工・少量パックの割高品・
//     徳用/大容量・上位等級（一等品・特選・贅沢）・銘柄鶏/地鶏・料理店の銘柄
//   ・総務省の基本銘柄が「並」「普通品」と書いている品目は、その定義に当てはまる商品だけを材料にする
//   ・**産地で3〜6倍ちがう品は、国産の並と輸入の並の両方を書き残し、値は動かさない**（司令部が決める）
//
// 【LF-20 の見張り】次に測り直す便が同じ間違いをしないよう、
// **便LFが根拠を書いた行は、①店名 ②商品名と容量と税込価格の組 ③どのグレードで採ったか
// （「並」または「標準品」の語）の3つがそろっていること**を機械で見る。
// ③が書けない＝グレードを決めずに採ったということなので、そこで止まる。
{
  const lf6Root = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lf6Src = readFileSync(path.join(lf6Root, 'src/data/priceDefaults.ts'), 'utf-8')
  const lf6Body = lf6Src.slice(lf6Src.indexOf('export const PRICE_DEFAULTS: PriceDefaultItem[] = ['))
  // 行ごとに「直前の連続コメント」を集める
  const lf6Blocks = []
  let lf6Buf = []
  for (const rawLine of lf6Body.split('\n')) {
    const line = rawLine.trim()
    const item = line.match(/^\{ name: '(.+?)', pricePerUnit: (\d+), unit: '(.+?)' \},$/)
    if (item) {
      lf6Blocks.push({ name: item[1], comment: lf6Buf.join('\n') })
      lf6Buf = []
      continue
    }
    if (line.startsWith('//')) lf6Buf.push(line)
    else if (line !== '') lf6Buf = []
  }
  const lf6All = lf6Blocks.filter((b) => b.comment.includes('便LF'))
  // 「同じ食材なので、根拠は『◯◯』の行のコメント」と**別の行を指している**行は、
  // そこに実売を書き写さない（同じ根拠を2か所に置くと、片方だけ直したときに食い違う）。
  // 指し先の名前が価格マスタに在ることだけを見て、①②は指し先の行で見る
  const lf6Names = new Set(PRICE_DEFAULTS.map((d) => d.name))
  const lf6RefOf = (comment) => {
    const m = comment.match(/「(.+?)」の行のコメント/)
    return m && lf6Names.has(m[1]) ? m[1] : null
  }
  const lf6Refs = lf6All.filter((b) => lf6RefOf(b.comment))
  const lf6Mine = lf6All.filter((b) => !lf6RefOf(b.comment))
  eq(
    'LF-20 別の行を指しているコメントは、指し先が価格マスタに在る',
    lf6Refs.filter((b) => !lf6Names.has(lf6RefOf(b.comment))).map((b) => b.name),
    [],
  )
  // 指し先そのものが根拠を持っていること（指し先が根拠なしだと、どこにも根拠が無いことになる）
  eq(
    'LF-20 指し先の行も便LFの根拠を持っている',
    lf6Refs.filter((b) => !lf6Mine.some((x) => x.name === lf6RefOf(b.comment))).map((b) => b.name),
    [],
  )
  // ①店名 ②容量つきの税込価格 ③グレードの言い切り
  const LF6_SHOP = /ヤオコー|東急ストア/
  const LF6_PRICE_WITH_SIZE = /\d+(?:\.\d+)?\s*(?:g|ml|L|枚|本|個|袋|パック|コ|株|束|玉|切|かけ|合|人前)[^\n]{0,40}?[\d,]+(?:\.\d+)?\s*円/
  const LF6_GRADE = /並|標準品/
  const lf6Missing = (test) => lf6Mine.filter((b) => !test.test(b.comment)).map((b) => b.name)

  eq('LF-20 便LFが根拠を書いた行は30件以上ある（見張りが空振りしていない）', lf6Mine.length >= 30, true)
  eq('LF-20 ①どの店で見たかが書いてある', lf6Missing(LF6_SHOP), [])
  eq('LF-20 ②商品の容量と税込価格の組が書いてある', lf6Missing(LF6_PRICE_WITH_SIZE), [])
  // ここが本題。「棚に並ぶものを全部並べた中央値」で採ると、この語が書けない
  eq('LF-20 ③どのグレードで採ったか（並・標準品）が書いてある', lf6Missing(LF6_GRADE), [])

  // --- LF-21: 産地で割れる品は「輸入の並」で置き、国産の並も行に残してある ---
  // 2026-08-26 オーナー裁定「産地は輸入の並で置く」。司令部の言葉「普段その食材を買う人が
  // いつも払う額に寄せる」。**国産の値を消さない**こと（あとで振り直せるように）。
  const lf6Entry = (name) => {
    const e = PRICE_DEFAULTS.find((d) => d.name === name)
    return e ? [e.pricePerUnit, e.unit] : null
  }
  const lf6Comment = (name) => lf6Blocks.find((b) => b.name === name)?.comment ?? ''
  for (const [name, price, unit] of [
    ['乾燥わかめ', 68, '10g'],
    ['カットわかめ', 68, '10g'],
    ['乾燥芽ひじき', 96, '10g'],
    ['切り干し大根', 118, '50g'],
    ['にんにく', 107, '1玉'],
    ['牛薄切り肉', 253, '100g'],
    ['牛切り落とし肉', 253, '100g'],
    ['牛こま切れ肉', 253, '100g'],
  ]) {
    eq(`LF-21 「${name}」は輸入の並の${price}円/${unit}`, lf6Entry(name), [price, unit])
  }
  // **国産の並の値を行から消していないこと**（裁定を振り直すときに測り直さずに済む）
  for (const name of ['乾燥わかめ', '乾燥芽ひじき', '切り干し大根', 'にんにく', '牛薄切り肉']) {
    eq(`LF-21 「${name}」の行に国産の並と輸入の並が両方書いてある`, /国産の並/.test(lf6Comment(name)) && /輸入(?:とPB|・PB)?の並/.test(lf6Comment(name)), true)
  }
  // 2件目が取れなかったものは、その旨が行に書いてあること（物差し §2）
  eq('LF-21 乾燥芽ひじきの輸入は単一ソースだと行に書いてある', /単一ソース/.test(lf6Comment('乾燥芽ひじき')), true)
  eq('LF-21 にんにくの輸入も単一ソースだと行に書いてある', /単一ソース/.test(lf6Comment('にんにく')), true)
  // 同じ食材が書き方で値段が変わらないこと
  eq('LF-21 乾燥わかめとカットわかめは同じ値', lf6Entry('乾燥わかめ'), lf6Entry('カットわかめ'))
  eq('LF-21 牛の3行は同じ値', [lf6Entry('牛薄切り肉'), lf6Entry('牛切り落とし肉')], [lf6Entry('牛こま切れ肉'), lf6Entry('牛こま切れ肉')])
}
