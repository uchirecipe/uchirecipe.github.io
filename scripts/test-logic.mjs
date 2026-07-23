// L1: 純ロジックの単体回帰テスト(docs/10 3章のL1追加候補①③⑤の常設化)。
// DOM・Dexie不要のロジックだけを対象にする。実行: npx tsx scripts/test-logic.mjs
// 新しいバグを直したら、必ずここに再発防止のケースを1行足すこと(PDCAの蓄積点)。
import {
  scaleAmount,
  formatAmountUnit,
  normalizeDigits,
  normalizeAmountInput,
} from '../src/logic/amount.ts'
import {
  parseRecipeText,
  splitQuantity,
  autoSplitAmountUnit,
  looksPoorlyParsed,
  preprocessPastedLines,
  normalizeImportedIngredient,
} from '../src/logic/parseRecipeText.ts'
import {
  buildSearchWords,
  toHiragana,
  searchIndexNeedsRebuild,
  SEARCH_INDEX_VERSION,
} from '../src/logic/kana.ts'
import { READINGS_VERSION } from '../src/logic/ingredientReadings.ts'
import { formatMinutesSecondsLabel } from '../src/logic/time.ts'
import {
  normalizeProCode,
  isValidProCode,
  detectCodeKind,
  maskUnlockCode,
} from '../src/logic/pro.ts'
import { isAtFreeLimit, isNearFreeLimit } from '../src/logic/freeLimit.ts'
import { parseAmountNumber, convertToGrams, computeRecipeNutrition } from '../src/logic/nutrition.ts'
import { isNewsSuppressed } from '../src/logic/news.ts'
import {
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  isPastDate,
  shiftDate,
  excludeYesterdayPlanRecipes,
  normalizeDateRange,
  rangeDayCount,
  isOneDish,
  proteinSourceOf,
  detectGenreMix,
  isMainDish,
  recipeGenre,
} from '../src/logic/mealPlan.ts'
import { guessDishType } from '../src/logic/dishTypeGuess.ts'
import { PRICE_DEFAULTS } from '../src/data/priceDefaults.ts'
import { buildShoppingCandidates } from '../src/logic/shopping.ts'
import { hasLaterHandsOnStep, classifyStep, resolveStepMinutes, buildCookTimeline } from '../src/logic/cookNavi.ts'
import {
  resolveDuplicateTitleAction,
  buildUpdatedSetRecipe,
  exclusionRecordFor,
  buildExclusionTitleSet,
  tablesToReplace,
  mergeUnlockCodes,
  countReplaceImpact,
  daysSinceBackup,
} from '../src/logic/backup.ts'
import {
  supportsSaveFilePicker,
  backupFileName,
  isAbortError,
} from '../src/logic/fileSave.ts'
import {
  sortResults,
  defaultSortDirection,
  buildNutrientSortValues,
  isNutrientSortOption,
  NUTRIENT_SORT_OPTIONS,
} from '../src/logic/recipeSort.ts'
import {
  totalCookedLogPhotoBytes,
  isOverCookedPhotoLimit,
  bytesToMB,
  COOKED_PHOTO_WARNING_BYTES,
} from '../src/logic/cookedPhotoStorage.ts'
import {
  buildPriceIndex,
  matchPriceEntry,
  estimateIngredientYen,
  estimateRecipeCost,
  estimateIngredientRowCost,
  sumMealPlanEntriesCost,
  normalizeIngredientNameForPrice,
  normalizeUnit,
  parseUnitQuantity,
} from '../src/logic/priceEstimate.ts'
import { KNOWN_UNITS, OTHER_UNIT, decomposeUnit, composeUnit } from '../src/logic/unitForm.ts'
import {
  pickMainIngredients,
  normalizeIngredientChipLabel,
  pickDisplayIngredientChips,
} from '../src/logic/mainIngredients.ts'
import { searchRecipes } from '../src/logic/search.ts'
import { buildShareText } from '../src/logic/share.ts'
import { ingredientColorToken } from '../src/logic/ingredientColor.ts'
import { pickIconKey } from '../src/logic/icon.ts'
import {
  starterDefs,
  buildUpdatedStarterRecipe,
  planStarterReload,
  planFlattenedStarterTopUp,
} from '../src/db/starters.ts'
import { isDashiIngredientName, DASHI_RECIPE_TITLE } from '../src/logic/dashiLink.ts'
import {
  extractRecipeFromHtml,
  extractServings,
  parseIso8601DurationToMinutes,
  extractImageUrl,
  splitIngredientAmount,
  normalizeIngredients,
  normalizeInstructions,
} from '../workers/recipe-import/src/normalize.ts'
import { buildImageProxyUrl, isImageContentType } from '../src/logic/urlImportImage.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'

let passed = 0
const failures = []
function eq(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failures.push(`${label}: 実際=${a} 期待=${e}`)
  }
}

// ---------- scaleAmount(丸め表 = M1-5確定仕様) ----------
eq('本2.67相当は0.5刻み+帯分数', scaleAmount('2', 3, 4, '本'), '2と1/2') // 2.67→2.5
eq('g 83相当は5刻み', scaleAmount('50', 3, 5, 'g'), '85') // 83.3→85
eq('g 100以上は10刻み', scaleAmount('150', 2, 3, 'ml'), '230') // 225→230
eq('大さじ0.25刻み+帯分数', scaleAmount('1.5', 2, 5, '大さじ'), '3と3/4') // 3.75
eq('小さじ 分数入力', scaleAmount('1/2', 2, 5, '小さじ'), '1と1/4') // 1.25
eq('整数に割り切れたら帯なし', scaleAmount('1/2', 2, 4, '小さじ'), '1')
eq('個数系 整数部0は分数のみ', scaleAmount('1', 4, 2, '本'), '1/2')
eq('非数値(少々)は素通し', scaleAmount('少々', 2, 5, 'g'), '少々')
eq('非数値(適量)は素通し', scaleAmount('適量', 2, 5), '適量')
// B8: g/ml/ccの最小値フロア(0より大きい値が0g表示にならない)
eq('B8 gフロア', scaleAmount('1', 4, 2, 'g'), '1') // 0.5→1
// 2026-07-09ペルソナ第1波: 単位「節」(れんこん等)が個数系として扱われる
eq('節は0.5刻み+分数表示', scaleAmount('1', 4, 2, '節'), '1/2')
eq('節の増量', scaleAmount('1/2', 2, 4, '節'), '1')
// 2026-07-08バグ: 全角数字の分量が人数変更で反応しない
eq('全角数字のスケール', scaleAmount('２', 2, 5, '本'), '5')
eq('全角分数のスケール', scaleAmount('１／２', 2, 4, '個'), '1')
eq('全角は基準人数でも半角化', scaleAmount('２', 2, 2, '本'), '2')
// 2026-07-21 全角入力の自動正規化: 単位欄が全角(「ｇ」等)でも、半角と同じ丸め幅・帯分数表示になること
eq('全角単位「ｇ」でも半角gと同じ5刻みの丸めになる', scaleAmount('50', 3, 5, 'ｇ'), scaleAmount('50', 3, 5, 'g'))
eq('全角単位「ｍｌ」でも半角mlと同じ10刻みの丸めになる', scaleAmount('150', 2, 3, 'ｍｌ'), scaleAmount('150', 2, 3, 'ml'))

// ---------- scaleAmount: 大さじ/小さじの略記「大2」「小1」(2026-07-21分量表記拡充) ----------
// 表示は「大」「小」の略記のまま・数値だけ大さじ/小さじと同じ0.25刻みで更新する(原文尊重)
eq('略記「大2」を2倍(2→4人分)', scaleAmount('大2', 2, 4, ''), '大4')
eq('略記「小1」を半分(2→1人分)', scaleAmount('小1', 2, 1, ''), '小1/2')
eq('略記「小1/2」を2倍(2→4人分)', scaleAmount('小1/2', 2, 4, ''), '小1')
eq('略記は単位欄が入力済みなら対象外(通常の数値パースに落ちて素通し)', scaleAmount('大2', 2, 4, '個'), '大2')
// 範囲(「大1〜1.5」)は既存の範囲分量の方針(人数換算しない)のまま素通し
eq('略記の範囲「大1〜1.5」は人数換算しない(既存の範囲方針)', scaleAmount('大1〜1.5', 2, 4, ''), '大1〜1.5')
// 「大1個」のようにサイズ修飾語+助数詞が続く形(docs/43実測)は大さじ略記と誤認しない
eq('「大1個」は略記と誤認しない(単位欄「個」があるので通常の数値パース)', scaleAmount('大1個', 2, 4, '個'), '大1個')

// ---------- scaleAmount: 和語の個数詞「ひとかけ」「一房」等(2026-07-21分量表記拡充) ----------
// スケール後は「1」の意味が崩れるため、通常の個数表記(数値+単位)に切り替える
eq('「ひとかけ」を2倍(2→4人分)は数値表記に切り替え', scaleAmount('ひとかけ', 2, 4, ''), '2かけ')
eq('「ひとかけ」を半分(2→1人分)は分数表記', scaleAmount('ひとかけ', 2, 1, ''), '1/2かけ')
eq('「一房」の1.5倍(2→3人分)は帯分数', scaleAmount('ひと房', 2, 3, ''), '1と1/2房')
eq('未収録の「ひと丁」は通常どおり素通し(不自然な言い回しのため非対応)', scaleAmount('ひと丁', 2, 4, ''), 'ひと丁')

// ---------- formatAmountUnit(表示順 = 大さじ/小さじ/カップは単位が先) ----------
eq('大さじは単位が先', formatAmountUnit('2', '大さじ'), '大さじ2')
eq('gは数量が先', formatAmountUnit('200', 'g'), '200g')
eq('単位なし', formatAmountUnit('適量', ''), '適量')
eq('分量なし', formatAmountUnit('', '本'), '本')

// ---------- normalizeDigits ----------
eq('全角数字', normalizeDigits('２００'), '200')
eq('全角スラッシュ・ピリオド', normalizeDigits('１／２と１．５'), '1/2と1.5')
eq('半角はそのまま', normalizeDigits('1.5'), '1.5')

// ---------- normalizeAmountInput(2026-07-21 全角入力の自動正規化。オーナー実機報告:
// 「アサリ 300ｇ」の全角ｇだと栄養計算に反映されない・数量も全角で入力できてしまう。
// normalizeDigitsは全角数字・／・．のみで単位側の全角英字を変換できなかったため、
// より広い範囲をNFKCで正規化する分量・単位共通の解釈入口として新設) ----------
eq('全角数字→半角', normalizeAmountInput('３００'), '300')
eq('全角英字の単位→半角(ｇ→g)', normalizeAmountInput('ｇ'), 'g')
eq('全角英字の単位→半角(ｍｌ→ml)', normalizeAmountInput('ｍｌ'), 'ml')
eq('全角英字の単位→半角(ｋｇ→kg)', normalizeAmountInput('ｋｇ'), 'kg')
eq('全角スラッシュ→半角', normalizeAmountInput('１／２'), '1/2')
eq('全角スペース→半角', normalizeAmountInput('３００　ｇ'), '300 g')
eq('全角カタカナは全角カタカナのまま(意味を変えない)', normalizeAmountInput('オオサジ'), 'オオサジ')
eq('半角カナは全角カナになる(実害なし・意図した挙動)', normalizeAmountInput('ｵｵｻｼﾞ'), 'オオサジ')
eq('漢字・ひらがなは不変', normalizeAmountInput('大さじ'), '大さじ')
eq('半角はそのまま(冪等)', normalizeAmountInput('300g'), '300g')

// ---------- parseAmountNumber(栄養価計算の分量解釈) ----------
eq('栄養: 分数', parseAmountNumber('1/2'), 0.5)
eq('栄養: 全角(2026-07-08バグ)', parseAmountNumber('２'), 2)
eq('栄養: 非数値はnull', parseAmountNumber('少々'), null)

// ---------- convertToGrams(2026-07-21全角対応: 単位欄が全角でも半角と同じ食品データに一致する) ----------
eq('convertToGrams 半角g', convertToGrams(300, 'g', {}), 300)
eq('convertToGrams 全角ｇも半角gと同じ(本バグの直接の再発防止ケース)', convertToGrams(300, 'ｇ', {}), 300)
eq('convertToGrams 全角ｋｇ', convertToGrams(1, 'ｋｇ', {}), 1000)
eq(
  'convertToGrams 全角ｍｌ(gramsPerMl経由)は半角mlと同じ',
  convertToGrams(200, 'ｍｌ', { gramsPerMl: 1.03 }),
  convertToGrams(200, 'ml', { gramsPerMl: 1.03 }),
)
eq('convertToGrams 換算できない単位はnull(全角でも同様)', convertToGrams(1, 'ｘｘ', {}), null)

// ---------- computeRecipeNutrition: 全角「アサリ 300ｇ」の栄養計算(2026-07-21全角対応・
// オーナー実機報告の再現ケース。修正前は単位「ｇ」が半角gと一致せず計算対象外になっていた) ----------
{
  const halfWidth = computeRecipeNutrition({
    ingredients: [{ name: 'アサリ', amount: '300', unit: 'g' }],
    servings: 1,
  })
  const fullWidth = computeRecipeNutrition({
    ingredients: [{ name: 'アサリ', amount: '３００', unit: 'ｇ' }],
    servings: 1,
  })
  eq('全角「アサリ ３００ｇ」は計算対象外にならない(本バグの再発防止)', fullWidth.excluded.length, 0)
  eq('全角「３００ｇ」は半角「300g」と同じ1人分の栄養価になる', fullWidth.perServing, halfWidth.perServing)
  eq('全角「３００ｇ」は半角「300g」と同じグラム数で計算される', fullWidth.items[0]?.grams, halfWidth.items[0]?.grams)
}

// ---------- splitQuantity ----------
eq('大さじ前置形', splitQuantity('大さじ2'), { amount: '2', unit: '大さじ' })
eq('数字前置形', splitQuantity('200g'), { amount: '200', unit: 'g' })
eq('分数', splitQuantity('1/2個'), { amount: '1/2', unit: '個' })
eq('適量', splitQuantity('適量'), { amount: '適量', unit: '' })
eq('全角数字', splitQuantity('２００ｇ'), { amount: '200', unit: 'g' })

// 2026-07-20 URL取り込み品質監査(docs/43)で実測: 「大さじ1と1/2」(オレンジページ・DELISH KITCHEN・
// macaroni)「大さじ1・1/2」(ハウス食品)のような帯分数(整数+と/・+分数)は、pre/post正規表現が
// 数字パターンとして認識できず単位分離ごと失敗していた(amountに文字列全体が残りunitが空になる)。
// collapseMixedFractionで小数へ畳んでから既存の分離処理に渡すことで解消する
eq('帯分数(と): 大さじ前置', splitQuantity('大さじ1と1/2'), { amount: '1.5', unit: '大さじ' })
eq('帯分数(・): 大さじ前置', splitQuantity('大さじ1・1/2'), { amount: '1.5', unit: '大さじ' })
eq('帯分数(と): 数字後置', splitQuantity('1と1/2個'), { amount: '1.5', unit: '個' })
eq('帯分数: 整数部が2桁でも解釈', splitQuantity('大さじ2と3/4'), { amount: '2.75', unit: '大さじ' })
// 「1/2」単体(帯分数ではない普通の分数)は従来どおり壊さない(誤爆防止の回帰)
eq('帯分数っぽくない単なる分数は従来どおり', splitQuantity('1/2個'), { amount: '1/2', unit: '個' })
// macaroni実測:「大さじ2杯」のように大さじ/小さじの後ろに冗長な助数詞「杯」が付くと、
// 末尾を$固定していたpre正規表現が丸ごと不一致になり単位分離できていなかった
eq('末尾「杯」付きの大さじ表記も単位分離できる(macaroni実測)', splitQuantity('大さじ2杯'), { amount: '2', unit: '大さじ' })
eq('末尾「杯」+帯分数の組み合わせ', splitQuantity('大さじ1と1/2杯'), { amount: '1.5', unit: '大さじ' })

// ---------- autoSplitAmountUnit(手入力の分量欄「大さじ3」等を保存時に分離・2026-07-09ペルソナ第1波) ----------
// 分量欄に単位ごと書くと人数変更が効かないバグの再発防止
eq('保存時分離: 大さじ3', autoSplitAmountUnit('大さじ3', ''), { amount: '3', unit: '大さじ' })
eq('保存時分離: 1/2本', autoSplitAmountUnit('1/2本', ''), { amount: '1/2', unit: '本' })
eq('保存時分離: 200g', autoSplitAmountUnit('200g', ''), { amount: '200', unit: 'g' })
eq('保存時分離: 少々はそのまま', autoSplitAmountUnit('少々', ''), { amount: '少々', unit: '' })
eq('保存時分離: 適量はそのまま', autoSplitAmountUnit('適量', ''), { amount: '適量', unit: '' })
eq('保存時分離: 数字だけはそのまま', autoSplitAmountUnit('3', ''), { amount: '3', unit: '' })
eq('保存時分離: 単位入力済みなら触らない', autoSplitAmountUnit('大さじ3', '個'), { amount: '大さじ3', unit: '個' })
eq('保存時分離: 全角もOK', autoSplitAmountUnit('大さじ３', ''), { amount: '3', unit: '大さじ' })

// ---------- parseRecipeText(理想フォーマット+ゆらぎのコーパス) ----------
const ideal = `肉じゃが

材料（2人分）
・じゃがいも　3個
・牛こま切れ肉　200g
・しょうゆ　大さじ2

作り方
1. じゃがいもを切る
2. 鍋で煮る`
{
  const r = parseRecipeText(ideal)
  eq('理想形: タイトル', r.title, '肉じゃが')
  eq('理想形: 人数', r.servings, 2)
  eq('理想形: 材料数', r.ingredients.length, 3)
  eq('理想形: 材料1', r.ingredients[0], { name: 'じゃがいも', amount: '3', unit: '個' })
  eq('理想形: 大さじ分離', r.ingredients[2], { name: 'しょうゆ', amount: '2', unit: '大さじ' })
  eq('理想形: 手順数', r.steps.length, 2)
}
{
  const r = parseRecipeText('材料\nにんじん…1本\n豚肉：200g\n①炒める\n②煮る')
  eq('三点リーダー・コロン区切り', r.ingredients.length, 2)
  eq('丸数字手順', r.steps, ['炒める', '煮る'])
}
{
  const r = parseRecipeText('材料（４人分）\n・豚肉２００ｇ\n・ねぎ　１本')
  eq('全角人数', r.servings, 4)
  eq('全角くっつき形', r.ingredients[0], { name: '豚肉', amount: '200', unit: 'g' })
}

// ---------- 貼り付け解析: コツ・ポイントの手順混入対策(2026-07-09ペルソナ第1波) ----------
{
  const r = parseRecipeText(`肉じゃが
材料（2人分）
・じゃがいも　3個
作り方
1. 切る
2. 煮る
コツ・ポイント
じゃがいもはメークインが煮崩れしにくい
甘めが好きなら砂糖を増やす`)
  eq('コツ以降は手順に入らない', r.steps, ['切る', '煮る'])
  eq('コツはmemoへ連結', r.memo, 'じゃがいもはメークインが煮崩れしにくい\n甘めが好きなら砂糖を増やす')
}
{
  const r = parseRecipeText('作り方\n1. 焼く\n【ポイント】\n・強火で一気に')
  eq('ポイント見出し(飾り付き)もmemoへ', r.memo, '強火で一気に')
  eq('ポイントの行が手順に混ざらない', r.steps, ['焼く'])
}
{
  const r = parseRecipeText('作り方\n1. 焼く\nメモ: 冷蔵で2日もつ')
  eq('メモ見出しの同一行内容もmemoへ', r.memo, '冷蔵で2日もつ')
}
{
  // 「ポイントは〜」のような手順内の普通の文は見出し扱いしない
  const r = parseRecipeText('作り方\n1. ポイントは強火で一気に炒めること')
  eq('文中のポイントは手順のまま', r.steps, ['ポイントは強火で一気に炒めること'])
  eq('memoは作られない', r.memo, undefined)
}

// ---------- 貼り付け解析: 単位末尾の括弧をmemoへ分離(「1枚（250g）」対策・2026-07-09ペルソナ第1波) ----------
eq('括弧付き分量(全角)', splitQuantity('1枚（250g）'), { amount: '1', unit: '枚', memo: '250g' })
eq('括弧付き分量(半角)', splitQuantity('2個(小さめ)'), { amount: '2', unit: '個', memo: '小さめ' })
eq('括弧なしは従来どおり', splitQuantity('1枚'), { amount: '1', unit: '枚' })
// 大さじ/小さじ前置形+末尾の括弧グラム併記(おいしい健康 https://oishi-kenko.com/recipes/22619 実測)。
// 数字後置形と同じくグラム併記はmemoへ分離し、amountは「小さじ1/3」系を採用する(2026-07-23 URL取り込み経路統一)
eq('前置形+括弧グラム併記', splitQuantity('小さじ1/3 (1 g)'), { amount: '1/3', unit: '小さじ', memo: '1 g' })
eq('前置形+括弧グラム併記(全角括弧)', splitQuantity('大さじ1（15g）'), { amount: '1', unit: '大さじ', memo: '15g' })
eq('前置形+括弧なしは従来どおり(memoなし)', splitQuantity('小さじ1/2'), { amount: '1/2', unit: '小さじ' })
{
  const r = parseRecipeText('材料\n・鶏もも肉…1枚（250g）')
  eq('材料行の括弧はmemoとして返る', r.ingredients[0], { name: '鶏もも肉', amount: '1', unit: '枚', memo: '250g' })
}
// 手入力の分量欄でも括弧がunitに混入せずmemoに分離される
eq('保存時分離: 括弧はmemoへ', autoSplitAmountUnit('1枚（250g）', ''), { amount: '1', unit: '枚', memo: '250g' })

// ---------- 貼り付け解析: 調理時間行をcookMinutesへ(2026-07-09ペルソナ第2波) ----------
{
  const r = parseRecipeText('肉じゃが\n調理時間: 20分\n材料（2人分）\n・じゃがいも　3個\n作り方\n1. 切る\n2. 煮る')
  eq('調理時間行はcookMinutesへ', r.cookMinutes, 20)
  eq('調理時間行が手順に入らない', r.steps, ['切る', '煮る'])
  eq('調理時間行があってもタイトルは維持', r.title, '肉じゃが')
}
{
  const r = parseRecipeText('材料\n・にんじん…1本\n調理時間 20分\n作り方\n1. 炒める')
  eq('コロンなしの調理時間行も拾う', r.cookMinutes, 20)
  eq('コロンなし調理時間行が材料・手順に入らない', r.ingredients.length, 1)
  eq('コロンなし調理時間行の手順', r.steps, ['炒める'])
}
{
  const r = parseRecipeText('所要時間: 15分\n材料\n・豚肉…200g\n作り方\n1. 焼く')
  eq('所要時間もcookMinutesへ', r.cookMinutes, 15)
}
eq('全角の調理時間行', parseRecipeText('調理時間：２０分\n材料\n・ねぎ…1本').cookMinutes, 20)
{
  // 手順の文中に出てくる「調理時間20分」は手順のまま(単独のメタ情報行だけを拾う)
  const r = parseRecipeText('作り方\n1. 調理時間20分を目安に弱火で煮る')
  eq('手順文中の調理時間は手順のまま', r.steps, ['調理時間20分を目安に弱火で煮る'])
  eq('手順文からはcookMinutesを取らない', r.cookMinutes, undefined)
}
{
  // 準備時間はcookMinutesに入れないが、材料・手順にも混入させない
  const r = parseRecipeText('準備時間: 5分\n調理時間: 20分\n材料\n・ねぎ…1本')
  eq('準備時間は読み飛ばして調理時間を採用', r.cookMinutes, 20)
  eq('準備時間行が材料に混入しない', r.ingredients.map((i) => i.name), ['ねぎ'])
}

// ---------- 貼り付け解析: 材料内の小見出し行を材料にしない(2026-07-09ペルソナ第2波) ----------
{
  const r = parseRecipeText('材料\n・豚肉…200g\n【タレ】\n・しょうゆ…大さじ2\n※タレ\n(合わせ調味料)\n・みそ…大さじ1')
  eq('小見出し・装飾行は材料に入らない', r.ingredients.map((i) => i.name), ['豚肉', 'しょうゆ', 'みそ'])
}
eq(
  '「タレ:」のような見出し行も材料にしない',
  parseRecipeText('材料\n・豚肉…200g\nタレ:\n・みそ…大さじ1').ingredients.map((i) => i.name),
  ['豚肉', 'みそ'],
)
eq(
  '内容付きの「〈タレ〉しょうゆ」は従来どおり名前だけの材料として拾う',
  parseRecipeText('材料\n・豚肉…200g\n〈タレ〉しょうゆ').ingredients.map((i) => i.name),
  ['豚肉', '〈タレ〉しょうゆ'],
)

// ---------- 貼り付け解析: F1(番号+空白の剥がし)・F3(範囲分量)・looksPoorlyParsed(docs/29 Fable裁定 2026-07-15) ----------

// ---- F3: splitQuantity 範囲分量(単体) ----
eq('範囲: 大さじ前置', splitQuantity('大さじ2〜3'), { amount: '2〜3', unit: '大さじ' })
eq('範囲: 数字後置', splitQuantity('2〜3個'), { amount: '2〜3', unit: '個' })
eq('範囲: 全角数字後置', splitQuantity('２〜３本'), { amount: '2〜3', unit: '本' })

// ---- コーパスA_標準(見出し+人数+番号手順・数字+空白) ----
const corpusA = `肉じゃがロール
材料（2人分）
・じゃがいも 3個
・牛こま切れ肉 200g
・しょうゆ 大さじ2
作り方
1 じゃがいもを切る
2 牛肉を炒める
3 鍋で煮る`
{
  const r = parseRecipeText(corpusA)
  eq('A_標準: タイトル', r.title, '肉じゃがロール')
  eq('A_標準: 人数', r.servings, 2)
  eq('A_標準: 材料完全一致', r.ingredients, [
    { name: 'じゃがいも', amount: '3', unit: '個' },
    { name: '牛こま切れ肉', amount: '200', unit: 'g' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
  ])
  eq('A_標準: 手順件数+行頭に数字/空白が残らない', r.steps, [
    'じゃがいもを切る',
    '牛肉を炒める',
    '鍋で煮る',
  ])
  eq('A_標準: looksPoorlyParsedはfalse', looksPoorlyParsed(corpusA, r), false)
}

// ---- コーパスB_見出しなし(材料先頭+読点番号) ----
{
  const r = parseRecipeText('じゃがいも 3個\n豚こま切れ肉 200g\nしょうゆ 大さじ2\n1、じゃがいもを切る\n2、豚肉を炒める\n3、しょうゆを加えて煮る')
  eq('B_見出しなし: title未取得', r.title, undefined)
  eq('B_見出しなし: 材料完全一致', r.ingredients, [
    { name: 'じゃがいも', amount: '3', unit: '個' },
    { name: '豚こま切れ肉', amount: '200', unit: 'g' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
  ])
  eq('B_見出しなし: 手順完全一致', r.steps, ['じゃがいもを切る', '豚肉を炒める', 'しょうゆを加えて煮る'])
}

// ---- コーパスC_地の文(一段落) ----
const corpusC =
  'このハンバーグは材料を全部混ぜてから丸めて焼くだけの簡単レシピです。合いびき肉と玉ねぎと卵とパン粉を使って、よくこねてから中火でじっくり焼き上げると失敗しにくいです。'
{
  const r = parseRecipeText(corpusC)
  eq('C_地の文: 材料0件', r.ingredients.length, 0)
  eq('C_地の文: 手順1件(段落ほぼ全文)', r.steps.length, 1)
  eq('C_地の文: 手順の中身が段落全文', r.steps[0], corpusC)
  eq('C_地の文: looksPoorlyParsedはtrue', looksPoorlyParsed(corpusC, r), true)
}

// ---- コーパスD_グループ(区切り記号混在+〈煮汁〉小見出し+丸数字) ----
{
  const r = parseRecipeText(
    '筑前煮\n材料（4人分）\n・鶏もも肉…300g\n・れんこん：150g\n〈煮汁〉\n・だし　200ml\n・しょうゆ　大さじ2\n作り方\n①鶏肉を炒める\n②野菜を加える\n③煮汁を加えて煮る',
  )
  eq('D_グループ: 人数', r.servings, 4)
  eq('D_グループ: 小見出し混入なし+区切り記号完全一致', r.ingredients, [
    { name: '鶏もも肉', amount: '300', unit: 'g' },
    { name: 'れんこん', amount: '150', unit: 'g' },
    { name: 'だし', amount: '200', unit: 'ml' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
  ])
  eq('D_グループ: 丸数字剥がし完全一致', r.steps, ['鶏肉を炒める', '野菜を加える', '煮汁を加えて煮る'])
}

// ---- コーパスE_中黒手順 ----
{
  const r = parseRecipeText('チャーハン\n材料\n・ごはん　300g\n・卵　2個\n作り方\n・卵を溶く\n・ごはんと混ぜて炒める\n・塩こしょうで味付けする')
  eq('E_中黒手順: 材料完全一致', r.ingredients, [
    { name: 'ごはん', amount: '300', unit: 'g' },
    { name: '卵', amount: '2', unit: '個' },
  ])
  eq('E_中黒手順: 中黒剥がし全行一致', r.steps, ['卵を溶く', 'ごはんと混ぜて炒める', '塩こしょうで味付けする'])
}

// ---- コーパスF_分量ゆれ(範囲・くっつき・単位前置) ----
{
  const r = parseRecipeText('筑前煮\n材料\n・にんじん 2〜3本\n・じゃがいも200g\n・砂糖 大さじ2〜3\n作り方\n1 材料を切る\n2 煮る')
  eq('F_分量ゆれ: 材料完全一致(範囲・くっつき・単位前置)', r.ingredients, [
    { name: 'にんじん', amount: '2〜3', unit: '本' },
    { name: 'じゃがいも', amount: '200', unit: 'g' },
    { name: '砂糖', amount: '2〜3', unit: '大さじ' },
  ])
  eq('F_分量ゆれ: 手順完全一致', r.steps, ['材料を切る', '煮る'])
}

// ---- コーパスG_タイトルなし ----
{
  const r = parseRecipeText('材料（2人分）\n・鶏むね肉 300g\n・玉ねぎ 1個\n作り方\n1 鶏肉を切る\n2 炒める\n3 味付けする')
  eq('G_タイトルなし: title未取得', r.title, undefined)
  eq('G_タイトルなし: 材料完全一致', r.ingredients, [
    { name: '鶏むね肉', amount: '300', unit: 'g' },
    { name: '玉ねぎ', amount: '1', unit: '個' },
  ])
  eq('G_タイトルなし: 手順完全一致', r.steps, ['鶏肉を切る', '炒める', '味付けする'])
}

// ---- コーパスH_コツ付き(コツ見出し→memo) ----
{
  const r = parseRecipeText(
    'チキンソテー\n材料（2人分）\n・鶏もも肉 2枚\n・塩 少々\n作り方\n1 鶏肉に塩を振る\n2 皮目から焼く\n3 裏返して火を通す\nコツ・ポイント\n皮はしっかり乾かしてから焼くとパリッと仕上がる\n焼き加減は中火をキープする',
  )
  eq('H_コツ付き: 材料完全一致', r.ingredients, [
    { name: '鶏もも肉', amount: '2', unit: '枚' },
    { name: '塩', amount: '少々', unit: '' },
  ])
  eq('H_コツ付き: 番号剥がれ完全一致', r.steps, ['鶏肉に塩を振る', '皮目から焼く', '裏返して火を通す'])
  eq(
    'H_コツ付き: memo一致',
    r.memo,
    '皮はしっかり乾かしてから焼くとパリッと仕上がる\n焼き加減は中火をキープする',
  )
}

// ---- F1ガード: 負例テスト(誤爆防止・再発防止必須) ----
eq('負例: 材料\\n1 本 は手順0件', parseRecipeText('材料\n1 本').steps.length, 0)
eq('負例: 材料\\n1 200g は手順0件', parseRecipeText('材料\n1 200g').steps.length, 0)
eq('負例: 材料\\n2 大さじ1 は手順0件', parseRecipeText('材料\n2 大さじ1').steps.length, 0)
eq(
  '負例: 連番材料(1 玉ねぎ 1個/2 にんじん 1本)は手順0件',
  parseRecipeText('材料\n1 玉ねぎ 1個\n2 にんじん 1本').steps.length,
  0,
)
{
  const r = parseRecipeText('作り方\n1 鶏むね肉を切る\n2 水200mlを加える')
  eq('負例: 見出しあり数字+空白手順は2件・番号なし', r.steps, ['鶏むね肉を切る', '水200mlを加える'])
}
{
  const r = parseRecipeText('1 切る\n2 煮る')
  eq('負例: 見出しなし連番は手順2件', r.steps, ['切る', '煮る'])
}
eq(
  '負例: 単発「1 何かの文」(連番なし)はmode切替なし=手順0件',
  parseRecipeText('1 何かの文').steps.length,
  0,
)

// ---------- 貼り付け解析 第2弾: M2〜M8微修正(docs/29 P7第2弾Fable裁定 2026-07-15) ----------

// ---- M2: 人数のみの行(「3人分」「(2人分)」「3〜4人分」)は材料に混ざらず読み飛ばす ----
{
  const r = parseRecipeText('材料\n3人分\n・卵 1個')
  eq('M2: 「3人分」単独行のservings', r.servings, 3)
  eq('M2: 「3人分」単独行が材料に混入しない', r.ingredients, [{ name: '卵', amount: '1', unit: '個' }])
}
{
  const r = parseRecipeText('材料\n(2人分)\n・卵 1個')
  eq('M2: 「(2人分)」括弧付きのservings', r.servings, 2)
  eq('M2: 「(2人分)」が材料に混入しない', r.ingredients, [{ name: '卵', amount: '1', unit: '個' }])
}
eq('M2: 範囲人数「3〜4人分」は4を採用(許容仕様)', parseRecipeText('材料\n3〜4人分\n・卵 1個').servings, 4)

// ---- M3: isIngredientSubheading拡張((A)ソース/グループ語exact/複合＊行) ----
eq(
  'M3(a): 「（A）ソース」は小見出しとして除外',
  parseRecipeText('材料\n・しょうゆ 大さじ1\n（A）ソース\n・砂糖 小さじ1').ingredients.map((i) => i.name),
  ['しょうゆ', '砂糖'],
)
eq(
  'M3(b): 「☆調味料」はBULLET剥落後グループ語として除外',
  parseRecipeText('材料\n・豚肉 200g\n☆調味料\n・しょうゆ 大さじ1').ingredients.map((i) => i.name),
  ['豚肉', 'しょうゆ'],
)
eq(
  'M3(c): 「【トッピング】＊お好みで」複合行は小見出しとして除外',
  parseRecipeText('材料\n・豚肉 200g\n【トッピング】＊お好みで\n・ねぎ 少々').ingredients.map((i) => i.name),
  ['豚肉', 'ねぎ'],
)

// ---- M4: 番号+格助詞始まりは手順参照とみなし番号を剥がさない ----
{
  const r = parseRecipeText('作り方\n1. 生地を作る\n2.を3cmの厚さに伸ばす')
  eq('M4: 「2.を」は参照ガードで番号剥がれない', r.steps, ['生地を作る', '2.を3cmの厚さに伸ばす'])
}
{
  const r = parseRecipeText('作り方\n1. 生地を作る\n（1）の生地を伸ばす')
  eq('M4: 「（1）の」も参照ガードで番号剥がれない', r.steps, ['生地を作る', '（1）の生地を伸ばす'])
}

// ---- M5: COOK_TIME_LINEの区切りに「/」「／」も追加 ----
eq('M5: 「調理時間 ／20分」もcookMinutesへ', parseRecipeText('調理時間 ／20分\n材料\n・卵 1個').cookMinutes, 20)

// ---- M6: MEMO_HEADER装飾に「!」「！」も追加 ----
{
  const r = parseRecipeText('作り方\n1. 焼く\n! ポイント\n強火で焼く')
  eq('M6: 「! ポイント」もコツ・ポイント見出しとして扱う', r.memo, '強火で焼く')
  eq('M6: ポイント行が手順に混ざらない', r.steps, ['焼く'])
}

// ---- M7: タイトル整形(末尾の「レシピ・作り方」等を除去) ----
eq(
  'M7: 「簡単 卵とハムのサラダ　レシピ・作り方」→サフィックス除去',
  parseRecipeText('簡単 卵とハムのサラダ　レシピ・作り方\n材料\n・卵 1個').title,
  '簡単 卵とハムのサラダ',
)
eq(
  'M7: 除去すると空になる場合は元のまま',
  parseRecipeText('レシピ\n材料\n・卵 1個').title,
  'レシピ',
)
// 2026-07-16 SMK-02回帰: 空白なしで語末が「レシピ」の料理名は剥がさない(空白区切りの接尾辞のみ剥がす)
eq(
  'M7: 空白なしの語末「レシピ」は料理名の一部として残す',
  parseRecipeText('E2Eスモーク試験用レシピ\n材料\n・にんじん 1本').title,
  'E2Eスモーク試験用レシピ',
)
eq(
  'M7: 空白区切りの末尾「レシピ」接尾辞は剥がす',
  parseRecipeText('母さんの唐揚げ レシピ\n材料\n・鶏もも 300g').title,
  '母さんの唐揚げ',
)

// ---- M8/F8: parseIngredientLineのくっつき拡張 ----
eq(
  'M8(1): 単位前置くっつき「みりん大さじ2」',
  parseRecipeText('材料\nみりん大さじ2').ingredients[0],
  { name: 'みりん', amount: '2', unit: '大さじ' },
)
eq(
  'M8(2): 「そうめん4ワ（200g）」→unit=ワ+memo=200g',
  parseRecipeText('材料\nそうめん4ワ（200g）').ingredients[0],
  { name: 'そうめん', amount: '4', unit: 'ワ', memo: '200g' },
)
eq(
  'M8(2): 範囲+分「レタス2〜3枚分」',
  parseRecipeText('材料\nレタス2〜3枚分').ingredients[0],
  { name: 'レタス', amount: '2〜3', unit: '枚分' },
)
eq(
  'M8(2): 名前中の丸括弧注記は剥がさない「紫たまねぎ（薄切り）1/2コ分」',
  parseRecipeText('材料\n紫たまねぎ（薄切り）1/2コ分').ingredients[0],
  { name: '紫たまねぎ（薄切り）', amount: '1/2', unit: 'コ分' },
)

// ---------- H-1(2026-07-16 Fable品質監査再発防止): 見出しなし入力で「材料を〜」始まりの
// 手順文が材料欄を全滅させない(classifyHeaderのING誤検知ガード) ----------
{
  // A1: 実際の回帰報告そのもの(修正前は材料0件・旧は2件だった)
  const r = parseRecipeText(
    '肉じゃが\nじゃがいも 3個\n豚こま切れ肉 200g\n材料をすべて鍋に入れて炒める\n水を加えて15分煮る',
  )
  eq('H-1(A1): タイトル', r.title, '肉じゃが')
  eq('H-1(A1): 材料2件(見出し誤検知でpre領域ごと全滅しない・主症状の再発防止)', r.ingredients, [
    { name: 'じゃがいも', amount: '3', unit: '個' },
    { name: '豚こま切れ肉', amount: '200', unit: 'g' },
  ])
  // 「材料をすべて鍋に入れて炒める」自体は、main loop側の(意図的に触っていない)ING_HEADER.test
  // に今回も一致し続けるため見出し扱いで読み捨てられ、手順としては残らない(Fable裁定の対処範囲は
  // classifyHeaderのみで、main loop側のING_HEADER.testは既存挙動のまま=対象外)。
  // 主症状だった「材料0件」は解消し、手順も0件から1件に回復する
  eq('H-1(A1): 手順1件(材料欄は全滅しない。手順文自体がING_HEADER誤爆で読み捨てられるのは対象外の既存挙動)', r.steps, [
    '水を加えて15分煮る',
  ])
}
{
  // A2: STEP_HEADER側の見出し語(下ごしらえ)で始まる手順文の回帰確認。STEP_HEADERは既に
  // 「≤15字」の長さガードがあり(Fable裁定でING_HEADERのみ追加ガード対象)、現実的な長さの
  // 手順文なら既存ガードだけで十分誤検知しないことを確認する(このケース自体は今回の修正対象外)
  const r = parseRecipeText(
    'カレー\nじゃがいも 2個\n人参 1本\n下ごしらえした玉ねぎを飴色になるまで炒める\nルーを加えて煮込む',
  )
  eq('H-1(A2): タイトル', r.title, 'カレー')
  eq('H-1(A2): 材料2件', r.ingredients, [
    { name: 'じゃがいも', amount: '2', unit: '個' },
    { name: '人参', amount: '1', unit: '本' },
  ])
  eq('H-1(A2): 手順2件', r.steps, [
    '下ごしらえした玉ねぎを飴色になるまで炒める',
    'ルーを加えて煮込む',
  ])
}

// ============================================================================
// 貼り付け解析 第2弾: 実サイト形式コーパスR1〜R8(docs/29 P7第2弾Fable裁定§7)
// 実物(オーナー提供の生コピペ)と構造同型・内容は創作。生コピペそのものはコミットしない。
// ============================================================================

// ---- R1(P1型)F5+F6+F7: 別行系材料+単独番号手順+ゴミ(つくれぽ/@ハンドル/保存/共有/印刷) ----
{
  const r1 = `鶏肉とキャベツのピリ辛炒め
はじめてのつくれぽをする
はるみ３２
はるみ３２ @cook_12345678
やみつきになる一品です♪
レシピを保存
共有
印刷
材料
鶏もも肉
200g
・塩こしょう
少々
・片栗粉
適量
キャベツ（ざく切り）
2枚
にんじん（薄切り）
1/3本
◎しょうゆ
大さじ１
◎酢
大さじ１
◎砂糖
小さじ１
◎豆板醤
適量
にんにく・しょうがみじんぎり
各一かけ分
ごま油
適量
作り方
1
フライパンにごま油を熱しにんにくしょうがを炒め香りが出たら鶏肉を入れ塩こしょう片栗粉を上からまぶす。
2
キャベツとにんじんも加えて炒めしんなりしたら◎の合わせ調味料を加えて混ぜ合わせたら出来上がり。`
  const r = parseRecipeText(r1)
  eq('R1: タイトル', r.title, '鶏肉とキャベツのピリ辛炒め')
  eq('R1: 材料11件・名前+分量完全ペア・◎剥落', r.ingredients, [
    { name: '鶏もも肉', amount: '200', unit: 'g' },
    { name: '塩こしょう', amount: '少々', unit: '' },
    { name: '片栗粉', amount: '適量', unit: '' },
    { name: 'キャベツ（ざく切り）', amount: '2', unit: '枚' },
    { name: 'にんじん（薄切り）', amount: '1/3', unit: '本' },
    { name: 'しょうゆ', amount: '1', unit: '大さじ' },
    { name: '酢', amount: '1', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '小さじ' },
    { name: '豆板醤', amount: '適量', unit: '' },
    { name: 'にんにく・しょうがみじんぎり', amount: '各一かけ分', unit: '' },
    { name: 'ごま油', amount: '適量', unit: '' },
  ])
  eq('R1: 手順2件(番号なし本文)', r.steps, [
    'フライパンにごま油を熱しにんにくしょうがを炒め香りが出たら鶏肉を入れ塩こしょう片栗粉を上からまぶす。',
    'キャベツとにんじんも加えて炒めしんなりしたら◎の合わせ調味料を加えて混ぜ合わせたら出来上がり。',
  ])
}

// ---- R2(P2型)F5+F6+F7: servings単独行+【】小見出し+写真キャプション+コツ末尾 ----
{
  const r2 = `【トリュフ香る親子丼】
はじめてのつくれぽをする
たまきの台所 @cook_98765432
庭のトリュフ塩で仕上げる贅沢親子丼です♪
#親子丼#トリュフ塩#簡単親子丼
レシピを保存
共有
印刷
材料
3人分
【鶏むね肉下処理】
鶏むね肉
1枚
塩、こしょう
各、少々
【具材】
卵
4個
玉ねぎ
1/2
生しいたけ
中3枚
だしと水
合わせて400cc
砂糖
大1〜2
みりん
大1〜2
青ねぎ
10本くらい
トリュフ塩
適宜
作り方
1
鶏むね肉の下処理をします。ザルに上げて絞ります。
【トリュフ香る親子丼】作り方1写真
2
玉ねぎの下処理をします。5分ほどおきます。
3
片栗粉を揉み込んで熱湯を掛けて上下返してザルに打上げます。
4
フライパンにダシ、水、その他調味料を入れて沸かし鶏肉を並べて加熱。
5
卵を粗めに溶いて2回に分けて卵とじにします。余熱で仕上げます。
6
刻み青ねぎとトリュフ塩で仕上げます。
コツ・ポイント
フライパンで多めに作るので、お弁当に利用する時は完全に火を通します。`
  const r = parseRecipeText(r2)
  eq('R2: servings', r.servings, 3)
  eq('R2: 材料10件・【】混入なし', r.ingredients, [
    { name: '鶏むね肉', amount: '1', unit: '枚' },
    { name: '塩、こしょう', amount: '各、少々', unit: '' },
    { name: '卵', amount: '4', unit: '個' },
    { name: '玉ねぎ', amount: '1/2', unit: '' },
    { name: '生しいたけ', amount: '中3枚', unit: '' },
    { name: 'だしと水', amount: '合わせて400cc', unit: '' },
    { name: '砂糖', amount: '大1〜2', unit: '' },
    { name: 'みりん', amount: '大1〜2', unit: '' },
    { name: '青ねぎ', amount: '10', unit: '本くらい' },
    { name: 'トリュフ塩', amount: '適宜', unit: '' },
  ])
  eq('R2: 手順6件・写真キャプション混入なし', r.steps, [
    '鶏むね肉の下処理をします。ザルに上げて絞ります。',
    '玉ねぎの下処理をします。5分ほどおきます。',
    '片栗粉を揉み込んで熱湯を掛けて上下返してザルに打上げます。',
    'フライパンにダシ、水、その他調味料を入れて沸かし鶏肉を並べて加熱。',
    '卵を粗めに溶いて2回に分けて卵とじにします。余熱で仕上げます。',
    '刻み青ねぎとトリュフ塩で仕上げます。',
  ])
  eq('R2: memo一致', r.memo, 'フライパンで多めに作るので、お弁当に利用する時は完全に火を通します。')
}

// ---- R3(P3型)F5+F6+F7+M7: タイトルサフィックス除去+分量の調整/単独番号/人前+(A)/トッピング ----
{
  const r3 = `簡単ふわとろオムレツ丼　レシピ・作り方
調理時間
5分
費用目安
150円
保存
材料（2人前）
分量の調整
2
人前
卵 (Mサイズ)
4個
カニカマ
6本
(A)
しょうゆ
小さじ2
みりん
小さじ2
サラダ油
大さじ1
トッピング
青のり
適量
手順
1
カニカマは手でほぐします。
2
ボウルに卵、(A)を入れて溶きほぐします。1を加えて混ぜ合わせます。
3
フライパンにサラダ油をひいて強火で熱し、2を流し入れます。
4
お皿に盛り付け、青のりをのせて完成です。
コツ・ポイント
今回は直径18cmのフライパンを使用しました。
ご高齢の方や、乳幼児には卵の生食を避けてください。`
  const r = parseRecipeText(r3)
  eq('R3: タイトルサフィックス除去', r.title, '簡単ふわとろオムレツ丼')
  eq('R3: cookMinutes', r.cookMinutes, 5)
  eq('R3: servings', r.servings, 2)
  eq('R3: 材料6件・(A)/トッピング/分量の調整/単独2/人前が消える', r.ingredients, [
    { name: '卵 (Mサイズ)', amount: '4', unit: '個' },
    { name: 'カニカマ', amount: '6', unit: '本' },
    { name: 'しょうゆ', amount: '2', unit: '小さじ' },
    { name: 'みりん', amount: '2', unit: '小さじ' },
    { name: 'サラダ油', amount: '1', unit: '大さじ' },
    { name: '青のり', amount: '適量', unit: '' },
  ])
  eq('R3: 手順4件', r.steps, [
    'カニカマは手でほぐします。',
    'ボウルに卵、(A)を入れて溶きほぐします。1を加えて混ぜ合わせます。',
    'フライパンにサラダ油をひいて強火で熱し、2を流し入れます。',
    'お皿に盛り付け、青のりをのせて完成です。',
  ])
  eq(
    'R3: memo2行',
    r.memo,
    '今回は直径18cmのフライパンを使用しました。\nご高齢の方や、乳幼児には卵の生食を避けてください。',
  )
}

// ---- R4(P4型)F5+F7+M3(a)+M4: 栄養ペア+タグ行+(A)ソース+手順内(1)(2)参照 ----
{
  const r4 = `豆乳担々風カルボナーラ
マイレシピ登録（20件まで）
登録済一覧
調理時間
20分
エネルギー
520kcal
塩分
2.0g
たんぱく質
23.5g
（栄養ずらり）
ウインナーソーセージ
卵
スパゲッティ・パスタ
20分以内
材料（2人分）
ウインナソーセージ
4本
卵
2個
オリーブオイル
少々
塩（ゆで用）
大さじ1
スパゲッティ
160g
黒こしょう（粗びき）
適宜
粉チーズ
適宜
（A）ソース
粉チーズ
大さじ3
豆乳
1/4カップ
牛乳
1/4カップ
つくり方
1
ソーセージは斜めに1cm幅に切る。卵液のボウルに加えて混ぜる。
2
鍋に2Lの湯を沸かして手早く混ぜる。
3
（1）のフライパンに（2）を入れて黒こしょうと粉チーズをふる。`
  const r = parseRecipeText(r4)
  eq('R4: cookMinutes', r.cookMinutes, 20)
  eq('R4: 材料10件・栄養ペア0・タグ行0・(A)ソース除去', r.ingredients, [
    { name: 'ウインナソーセージ', amount: '4', unit: '本' },
    { name: '卵', amount: '2', unit: '個' },
    { name: 'オリーブオイル', amount: '少々', unit: '' },
    { name: '塩（ゆで用）', amount: '1', unit: '大さじ' },
    { name: 'スパゲッティ', amount: '160', unit: 'g' },
    { name: '黒こしょう（粗びき）', amount: '適宜', unit: '' },
    { name: '粉チーズ', amount: '適宜', unit: '' },
    { name: '粉チーズ', amount: '3', unit: '大さじ' },
    { name: '豆乳', amount: '1/4', unit: 'カップ' },
    { name: '牛乳', amount: '1/4', unit: 'カップ' },
  ])
  eq('R4: 手順3件・手順3の(1)(2)参照残る', r.steps, [
    'ソーセージは斜めに1cm幅に切る。卵液のボウルに加えて混ぜる。',
    '鍋に2Lの湯を沸かして手早く混ぜる。',
    '（1）のフライパンに（2）を入れて黒こしょうと粉チーズをふる。',
  ])
}

// ---- R5(P5型)F8+F9+F10: くっつき単位・＊注記除外・インラインポイント欠番 ----
{
  const r5 = `まるごと野菜の香味あえそうめん
料理研究家
講師
マイレシピ登録する(0)
エネルギー ／600 kcal
＊1人分
塩分／2.8 g
調理時間 ／20分
材料
(2人分)
【鶏そぼろ】
・桜えび （乾）10g
＊あれば香りと味わいが強い干しあみえびがおすすめ。
・鶏ひき肉250g
【A】
・みりん大さじ2
・しょうゆ小さじ2
・塩小さじ1/2
・こしょう小さじ1/2
・そうめん4ワ（200g）
【トッピング野菜】＊好みの野菜でよい。
・紫たまねぎ （薄切り）1/2コ分
・レタス （せん切り）2～3枚分
・セロリ （斜め薄切り）1/2本分
つくり方
1
桜えびは紙タオルの上で粗く刻む。
2
直径26cmのフライパンにひき肉を広げ入れ、強めの中火で2～3分間焼く。
! ポイント
調味料にもしっかり火を入れると香りがたち、仕上がりが水っぽくならず味がよくなじむ。
5
そうめんはたっぷりの熱湯で袋の表示どおりにゆでて冷水にとる。`
  const r = parseRecipeText(r5)
  eq('R5: cookMinutes', r.cookMinutes, 20)
  eq('R5: servings', r.servings, 2)
  eq('R5: 材料10件・みりん大さじ2分離・4ワ→unit=ワ+memo=200g・＊行が材料に入らない', r.ingredients, [
    { name: '桜えび （乾）', amount: '10', unit: 'g' },
    { name: '鶏ひき肉', amount: '250', unit: 'g' },
    { name: 'みりん', amount: '2', unit: '大さじ' },
    { name: 'しょうゆ', amount: '2', unit: '小さじ' },
    { name: '塩', amount: '1/2', unit: '小さじ' },
    { name: 'こしょう', amount: '1/2', unit: '小さじ' },
    { name: 'そうめん', amount: '4', unit: 'ワ', memo: '200g' },
    { name: '紫たまねぎ （薄切り）', amount: '1/2', unit: 'コ分' },
    { name: 'レタス （せん切り）', amount: '2〜3', unit: '枚分' },
    { name: 'セロリ （斜め薄切り）', amount: '1/2', unit: '本分' },
  ])
  eq('R5: 手順3件(1,2,5欠番OK)', r.steps, [
    '桜えびは紙タオルの上で粗く刻む。',
    '直径26cmのフライパンにひき肉を広げ入れ、強めの中火で2～3分間焼く。',
    'そうめんはたっぷりの熱湯で袋の表示どおりにゆでて冷水にとる。',
  ])
  eq(
    'R5: memo=ポイント文',
    r.memo,
    '調味料にもしっかり火を入れると香りがたち、仕上がりが水っぽくならず味がよくなじむ。',
  )
}

// ---- R6(P6型)F11+F12+M4: タブ区切り+A./B.名前保持+メタくっつき調理時間+番号なし手順 ----
{
  const r6 = `米粉と豆腐のもちもちドーナツ
印刷するレシピを携帯・PCに送る
調理時間50分カロリー310kcal塩分0.5g脂質12.0g
※ カロリー・塩分・脂質は1人分の値
材料（12個分）
おから\t50g
コーン(缶詰)\t50g
A.米粉\t115g
A.ベーキングパウダー\t小さじ1
A.塩\t小さじ1/4
B.砂糖\t40g
B.卵\t1個
B.牛乳\t大さじ1
無塩バター\t20g
揚げ油\t適宜
作り方
簡単！
50分料理！
おからは耐熱容器に平らに入れ、ラップをかけずに冷ましておく。コーンは水気をきっておく。
ふるいにかけたAとおからをボウルに入れ、混ぜてから20分休ませる。
2.を3cmくらいの大きさに丸め、160度の油できつね色に揚げる。
料理上手のワンポイント
ドーナツは大き過ぎると火の通りが悪くなるので、小さめに丸めるとよい。`
  const r = parseRecipeText(r6)
  eq('R6: cookMinutes(メタくっつき行から救済)', r.cookMinutes, 50)
  eq('R6: 材料10件・タブ区切り・A./B.名前保持', r.ingredients, [
    { name: 'おから', amount: '50', unit: 'g' },
    { name: 'コーン(缶詰)', amount: '50', unit: 'g' },
    { name: 'A.米粉', amount: '115', unit: 'g' },
    { name: 'A.ベーキングパウダー', amount: '1', unit: '小さじ' },
    { name: 'A.塩', amount: '1/4', unit: '小さじ' },
    { name: 'B.砂糖', amount: '40', unit: 'g' },
    { name: 'B.卵', amount: '1', unit: '個' },
    { name: 'B.牛乳', amount: '1', unit: '大さじ' },
    { name: '無塩バター', amount: '20', unit: 'g' },
    { name: '揚げ油', amount: '適宜', unit: '' },
  ])
  eq('R6: 手順3件・簡単！/50分料理！消滅・「2.を…」番号剥がれない', r.steps, [
    'おからは耐熱容器に平らに入れ、ラップをかけずに冷ましておく。コーンは水気をきっておく。',
    'ふるいにかけたAとおからをボウルに入れ、混ぜてから20分休ませる。',
    '2.を3cmくらいの大きさに丸め、160度の油できつね色に揚げる。',
  ])
  eq('R6: memo=ワンポイント文', r.memo, 'ドーナツは大き過ぎると火の通りが悪くなるので、小さめに丸めるとよい。')
}

// ---- R7(P7型)F5+F6+F7: ハッシュタグ/撮影/費用目安ペア/調理ステップN/〈〉/範囲servings ----
{
  const r7 = `#主食 #洋食 #お手軽ディナー
牛肉と彩り野菜のトマトチーズパエリヤ
撮影 やまだたろう
費用目安
約380円
カロリー
600kcal
塩分
2.5g
※費用や栄養素はあくまで目安です。
保存
印刷
共有
おすすめの献立
クックモード
画面が暗くなりません
安全に調理していただくために食品衛生にご注意ください
買い物リストに入れる
材料コピー
材料（3～4人分）
〈たね〉
牛ひき肉
300g
玉ねぎ（みじん切り）
1個
パン粉
大さじ3
〈スープ〉
トマト缶
1缶
コンソメ
1個
チーズ
適量
作り方
調理
1
牛ひき肉と玉ねぎ、パン粉をよく混ぜてたねを作る。
調理ステップ2
2
鍋にスープの材料を入れて煮立たせる。
3
たねを丸めてスープに加え、チーズをのせて煮込む。`
  const r = parseRecipeText(r7)
  eq('R7: servings(範囲人数は4を採用)', r.servings, 4)
  eq('R7: 材料6件・〈〉除去', r.ingredients, [
    { name: '牛ひき肉', amount: '300', unit: 'g' },
    { name: '玉ねぎ（みじん切り）', amount: '1', unit: '個' },
    { name: 'パン粉', amount: '3', unit: '大さじ' },
    { name: 'トマト缶', amount: '1', unit: '缶' },
    { name: 'コンソメ', amount: '1', unit: '個' },
    { name: 'チーズ', amount: '適量', unit: '' },
  ])
  eq('R7: 手順3件・ハッシュタグ/撮影/費用目安ペア/調理ステップN/調理単独行が混入しない', r.steps, [
    '牛ひき肉と玉ねぎ、パン粉をよく混ぜてたねを作る。',
    '鍋にスープの材料を入れて煮立たせる。',
    'たねを丸めてスープに加え、チーズをのせて煮込む。',
  ])
}

// ---- R8(P8型)F5+F6+F7+M3(b): 3品合算1ページ+☆★グループ+Play Video+インラインポイント ----
{
  const r8 = `豚キムチ春雨と副菜2品の献立
お気に入りに追加
料理を楽しむにあたって、安全な調理を心がけましょう
炭水化物
2.5g
糖質
1.8g
材料（2人分）
☆調味料
・しょうゆ 大さじ1
・みそ 小さじ2
豚バラ肉
150g
春雨
30g
作り方
Play Video
1
豚バラ肉を炒め、春雨を加えて炒め合わせる。
2
☆の調味料を加えて味を調える。
ポイント
春雨は戻さずそのまま加えると水っぽくならない。
3
器に盛り付けて完成。
材料
大根（各5cm）
2切れ
にんじん（各1個）
1本
作り方
Play Video
1
大根とにんじんをせん切りにする。
2
ポン酢で和えて完成。
材料
★調味料
・ごま油 小さじ1
・塩 少々
ねぎ
1本
かにかま
2本
作り方
Play Video
1
ねぎとかにかまを刻む。
2
★の調味料で和えて完成。`
  const r = parseRecipeText(r8)
  eq('R8: 3品合算材料10件・☆★除去', r.ingredients, [
    { name: 'しょうゆ', amount: '1', unit: '大さじ' },
    { name: 'みそ', amount: '2', unit: '小さじ' },
    { name: '豚バラ肉', amount: '150', unit: 'g' },
    { name: '春雨', amount: '30', unit: 'g' },
    { name: '大根（各5cm）', amount: '2', unit: '切れ' },
    { name: 'にんじん（各1個）', amount: '1', unit: '本' },
    { name: 'ごま油', amount: '1', unit: '小さじ' },
    { name: '塩', amount: '少々', unit: '' },
    { name: 'ねぎ', amount: '1', unit: '本' },
    { name: 'かにかま', amount: '2', unit: '本' },
  ])
  eq('R8: 3品合算手順7件・Play Video0・裸番号手順0', r.steps, [
    '豚バラ肉を炒め、春雨を加えて炒め合わせる。',
    '☆の調味料を加えて味を調える。',
    '器に盛り付けて完成。',
    '大根とにんじんをせん切りにする。',
    'ポン酢で和えて完成。',
    'ねぎとかにかまを刻む。',
    '★の調味料で和えて完成。',
  ])
  eq('R8: インラインポイント→memo', r.memo, '春雨は戻さずそのまま加えると水っぽくならない。')
  eq('R8: looksPoorlyParsedはfalse', looksPoorlyParsed(r8, r), false)
}

// ---- 負例(§7必須・F5/F6/F7ガード再発防止) ----
eq(
  '負例F5: 〈タレ〉しょうゆはペアリングせず従来どおり名前だけの材料',
  parseRecipeText('材料\n・豚肉…200g\n〈タレ〉しょうゆ').ingredients.map((i) => i.name),
  ['豚肉', '〈タレ〉しょうゆ'],
)
eq(
  '負例F5: 空行を挟んだら結合しない・孤児分量はgarbageにならず消える',
  parseRecipeText('材料\n卵\n\n2個').ingredients,
  [{ name: '卵', amount: '', unit: '' }],
)
eq(
  '負例F5: 「各大さじ1」はペアリングされる',
  parseRecipeText('材料\nしょうゆ\nみりん\n各大さじ1').ingredients,
  [
    { name: 'しょうゆ', amount: '', unit: '' },
    { name: 'みりん', amount: '各大さじ1', unit: '' },
  ],
)
eq(
  '負例F7: 「共有スペースへ」は部分一致で消えない',
  parseRecipeText('作り方\n1. 共有スペースへ移してから冷蔵する').steps,
  ['共有スペースへ移してから冷蔵する'],
)
eq(
  '負例F7: 「印刷用シート…1枚」は部分一致で消えない',
  parseRecipeText('作り方\n1. 印刷用シートを1枚敷いておく').steps,
  ['印刷用シートを1枚敷いておく'],
)
eq(
  '負例F7: memo「冷蔵で2日保存」は部分一致で消えず残る',
  parseRecipeText('作り方\n1. 焼く\nコツ・ポイント\n冷蔵で2日保存できます').memo,
  '冷蔵で2日保存できます',
)
eq(
  '負例F7: 見出し語を含む「#コツ」はハッシュタグ除去せずメモ見出しとして扱う',
  parseRecipeText('作り方\n1. 焼く\n#コツ\n強火で焼く').memo,
  '強火で焼く',
)
eq(
  '負例M-4(2026-07-16 Fable品質監査再発防止): memo領域の「人数に合わせて量を調整してください」は消えず残る',
  parseRecipeText('作り方\n1. 焼く\nコツ・ポイント\n人数に合わせて量を調整してください').memo,
  '人数に合わせて量を調整してください',
)
eq(
  '負例M-4: steps領域の「人数に合わせて量を調整してください」は従来どおり除去される',
  parseRecipeText('作り方\n1. 焼く\n人数に合わせて量を調整してください\n2. 盛り付ける').steps,
  ['焼く', '盛り付ける'],
)
{
  const r = parseRecipeText('作り方\n1. 生地を作る\n2.と3.を合わせる')
  eq('負例M4: 「1. 2.と3.を合わせる」参照ガード', r.steps, ['生地を作る', '2.と3.を合わせる'])
}
eq(
  '負例preprocessPastedLines: 見出しなし(B)は単体で無変化',
  preprocessPastedLines(
    'じゃがいも 3個\n豚こま切れ肉 200g\nしょうゆ 大さじ2\n1、じゃがいもを切る\n2、豚肉を炒める\n3、しょうゆを加えて煮る',
  ),
  [
    'じゃがいも 3個',
    '豚こま切れ肉 200g',
    'しょうゆ 大さじ2',
    '1、じゃがいもを切る',
    '2、豚肉を炒める',
    '3、しょうゆを加えて煮る',
  ],
)
{
  const corpusCText =
    'このハンバーグは材料を全部混ぜてから丸めて焼くだけの簡単レシピです。合いびき肉と玉ねぎと卵とパン粉を使って、よくこねてから中火でじっくり焼き上げると失敗しにくいです。'
  eq('負例preprocessPastedLines: 見出しなし(C)は単体で無変化', preprocessPastedLines(corpusCText), [
    corpusCText,
  ])
}
eq(
  '負例preprocessPastedLines: 見出しなし(G、タイトルなし)は単体で無変化',
  preprocessPastedLines(
    '材料（2人分）\n・鶏むね肉 300g\n・玉ねぎ 1個\n作り方\n1 鶏肉を切る\n2 炒める\n3 味付けする',
  ),
  [
    '材料（2人分）',
    '・鶏むね肉 300g',
    '・玉ねぎ 1個',
    '作り方',
    '1 鶏肉を切る',
    '2 炒める',
    '3 味付けする',
  ],
)

// ---------- buildSearchWords(「鮭」検索が調味料「酒」に誤ヒットする回帰・2026-07-09ペルソナ第1波) ----------
{
  // さばの味噌煮の実データ相当(酒50ml=単位付きでも、鮭(さけ)で引っかからないこと)
  const words = buildSearchWords(
    'さばの味噌煮',
    [
      { name: 'さば(切り身)', amount: '2', unit: '切れ' },
      { name: 'しょうが', amount: '1', unit: 'かけ' },
      { name: '味噌', amount: '2', unit: '大さじ' },
      { name: '酒', amount: '50', unit: 'ml' },
    ],
    ['和食', '魚'],
  )
  const salmonKey = toHiragana('鮭')
  eq('鮭検索が調味料の酒にヒットしない', words.some((w) => w.includes(salmonKey)), false)
  eq('タイトルの味噌は引き続きヒット', words.some((w) => w.includes(toHiragana('味噌'))), true)
  eq('タグ(魚)は引き続きヒット', words.some((w) => w.includes(toHiragana('魚'))), true)
  eq('主材料(さば)は引き続きヒット', words.some((w) => w.includes('さば')), true)
  // 調味料(大さじ)の酒も検索語に含めない
  const words2 = buildSearchWords(
    '豚の生姜焼き',
    [
      { name: '豚ロース薄切り', amount: '250', unit: 'g' },
      { name: '酒', amount: '1', unit: '大さじ' },
    ],
    ['和食'],
  )
  eq('大さじの酒も検索語から除外', words2.some((w) => w.includes(salmonKey)), false)
  eq('主材料(豚)は引き続きヒット', words2.some((w) => w.includes(toHiragana('豚'))), true)
}

// ---------- buildSearchWords: きのこカテゴリ語の追加(検索欄で「しめじ」「えのき」等でも
// 「きのこ」でも同じレシピにヒットしてほしい・2026-07-12オーナー実機フィードバック) ----------
{
  const mushroomKey = toHiragana('きのこ')
  const shimeji = buildSearchWords(
    'きのこの味噌汁',
    [{ name: 'しめじ', amount: '1', unit: 'パック' }],
    [],
  )
  eq('しめじで検索語「きのこ」が追加される', shimeji.some((w) => w.includes(mushroomKey)), true)

  const enoki = buildSearchWords('えのきのバター炒め', [{ name: 'えのき', amount: '1', unit: '袋' }], [])
  eq('えのきで検索語「きのこ」が追加される', enoki.some((w) => w.includes(mushroomKey)), true)

  // 漢字表記(椎茸・舞茸)でもカテゴリ語が追加されること(toHiragana変換後の一致確認)
  const shiitake = buildSearchWords('椎茸の炊き込みご飯', [{ name: '椎茸', amount: '4', unit: '枚' }], [])
  eq('椎茸(漢字)でも検索語「きのこ」が追加される', shiitake.some((w) => w.includes(mushroomKey)), true)

  // きのこ類を含まないレシピには追加されない(誤爆しないこと)
  const noMushroom = buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], [])
  eq('きのこを含まないレシピには「きのこ」が追加されない', noMushroom.some((w) => w.includes(mushroomKey)), false)
}

// ---------- buildSearchWords: keywords(検索キーワード欄・任意)がタイトル/材料/タグに
// 無い語でも検索にヒットするよう合流する(2026-07-12バッチ「検索キーワード欄」実装) ----------
{
  const aliasKey = toHiragana('チンジャオロース')
  const withKeyword = buildSearchWords(
    '青椒肉絲',
    [{ name: '豚肉', amount: '150', unit: 'g' }],
    ['中華'],
    ['チンジャオロース'],
  )
  eq(
    'keywordsの語がひらがな化されて検索語に合流する',
    withKeyword.some((w) => w.includes(aliasKey)),
    true,
  )
  // keywords省略(3引数呼び出し)でも従来どおり動く(既存呼び出し元・starters.ts等との後方互換)
  const withoutKeyword = buildSearchWords(
    '青椒肉絲',
    [{ name: '豚肉', amount: '150', unit: 'g' }],
    ['中華'],
  )
  eq(
    'keywords省略時はその語を含まない(既存データ=変化なしの確認)',
    withoutKeyword.some((w) => w.includes(aliasKey)),
    false,
  )
  // 空文字・空白だけのkeywordsはノイズを増やさない(trimして空になる語は無視)
  const baseline = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
  )
  const emptyKeyword = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    ['', '  '],
  )
  eq('空文字・空白だけのkeywordsは検索語を増やさない', emptyKeyword.length, baseline.length)
}

// ---------- searchIndexNeedsRebuild: 検索インデックス移行の判定(既存レシピのsearchWordsに
// きのこカテゴリ語等を反映させる一回きりの移行。2026-07-12) ----------
{
  const upToDate = { ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: SEARCH_INDEX_VERSION }
  eq('両方最新なら再構築不要', searchIndexNeedsRebuild(upToDate), false)
  eq('searchIndexVersionだけ古ければ再構築が必要', searchIndexNeedsRebuild({ ...upToDate, searchIndexVersion: 0 }), true)
  eq(
    'ingredientReadingsVersionだけ古くても再構築が必要',
    searchIndexNeedsRebuild({ ...upToDate, ingredientReadingsVersion: 0 }),
    true,
  )
  eq('未導入ユーザー(両方0)は再構築が必要', searchIndexNeedsRebuild({ ingredientReadingsVersion: 0, searchIndexVersion: 0 }), true)
}

// ---------- pro.ts(コード正規化) ----------
eq('Pro: 全角・小文字・空白ゆらぎ', normalizeProCode(' ｕｒ-ab12-cd34 '), 'UR-AB12-CD34')

// ---------- detectCodeKind(2026-07-17設定ゼロベース裁定#7の種別判定→2026-07-22全無料化でPro(UR-)のみ) ----------
// 2026-07-22: 収録レシピは全て無料になり、追加レシピパック(UP-)は製品廃止。有効なコードはPro(UR-)のみ。
eq('種別判定: UR-はpro', detectCodeKind('UR-AB12-CD34'), 'pro')
eq('種別判定: 廃止したUP-はunknown(2026-07-22全無料化でパック廃止)', detectCodeKind('UP-AB12-CD34'), 'unknown')
eq('種別判定: 全角・小文字ゆらぎでも判定できる(normalizeProCode経由)', detectCodeKind(' ｕｒ-ab12-cd34 '), 'pro')
eq('種別判定: どちらでもないprefixはunknown', detectCodeKind('XX-AB12-CD34'), 'unknown')
eq('種別判定: 空文字はunknown', detectCodeKind(''), 'unknown')
eq('種別判定: prefixのみ(ハイフン無し)はunknown', detectCodeKind('URXXXX'), 'unknown')

// ---------- maskUnlockCode(2026-07-17設定ゼロベース裁定#4: 解錠コードのマスク表示+コピー) ----------
// prefix非依存の純粋な文字列マスク(Proコードのマスク表示に使う)
eq('マスク: 標準形式は末尾4文字だけ見せる', maskUnlockCode('UR-AB12-CD34'), 'UR-****CD34')
eq('マスク: 4-4形式は末尾4文字だけ見せる', maskUnlockCode('UR-1234-5678'), 'UR-****5678')
eq('マスク: 残り4文字以下は全部隠す', maskUnlockCode('UR-AB'), 'UR-**')
eq('マスク: ハイフンが無いコードはそのまま返す', maskUnlockCode('URABCDEFGH'), 'URABCDEFGH')

// ---------- isNewsSuppressed(初回起動24時間はお知らせを出さない・2026-07-09ペルソナ第1波) ----------
const HOUR = 60 * 60 * 1000
eq('news: 初回起動直後は抑制', isNewsSuppressed(1000, 1000 + HOUR), true)
eq('news: 23時間後も抑制', isNewsSuppressed(1000, 1000 + 23 * HOUR), true)
eq('news: 24時間経過で表示', isNewsSuppressed(1000, 1000 + 25 * HOUR), false)
eq('news: 既存ユーザー(0)は抑制しない', isNewsSuppressed(0, Date.now()), false)
eq('news: 未記録(起動直後の一瞬)は抑制', isNewsSuppressed(undefined, Date.now()), true)

// ---------- suggestForSlot(献立の自動提案の品質・2026-07-09ペルソナ第2波) ----------
{
  const mkRecipe = (id, over = {}) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
  const opts = (over = {}) => ({
    quickOnly: false,
    excludeNg: false,
    ngIngredients: [],
    usedRecipeIds: [],
    slot: 'dinner',
    season: 'summer',
    ...over,
  })
  // (a) 季節外レシピ(8月に冬タグのクリームシチュー等)は提案から除外する
  {
    const recipes = [mkRecipe(1, { season: 'winter' }), mkRecipe(2, { season: 'all' })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('提案: 季節外(冬)は夏に提案されない', picks.every((id) => id === 2), true)
  }
  eq('提案: 季節外しか無ければ提案なし', suggestForSlot([mkRecipe(1, { season: 'winter' })], opts()), undefined)
  eq('提案: 季節一致は提案される', suggestForSlot([mkRecipe(1, { season: 'summer' })], opts())?.id, 1)
  eq('提案: 季節未設定は除外されない', suggestForSlot([mkRecipe(1)], opts())?.id, 1)
  // (b) 夕食・昼食枠は主菜になりうるレシピ(汁物/サラダ/おやつタグ無し)を優先する
  {
    const recipes = [
      mkRecipe(1, { tags: ['汁物'] }),
      mkRecipe(2, { tags: ['サラダ'] }),
      mkRecipe(3, { tags: ['おやつ'] }),
      mkRecipe(4, { tags: ['和食'] }),
    ]
    const dinnerPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('提案: 夕食枠に汁物・サラダ・おやつ単品は出ない', dinnerPicks.every((id) => id === 4), true)
    const lunchPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ slot: 'lunch' }))?.id)
    eq('提案: 昼食枠も主菜を優先', lunchPicks.every((id) => id === 4), true)
  }
  // 主菜候補が足りないときだけ他を許可する(0件にはしない)
  eq('提案: 主菜が無ければ汁物でも提案する', suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts())?.id, 1)
  eq(
    '提案: 朝食枠は汁物等も普通に提案対象',
    suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts({ slot: 'breakfast' }))?.id,
    1,
  )

  // ---- role指定・ジャンル優先・高たんぱく優先・ペア提案(2026-07-13献立の主菜+副菜構成) ----

  // role:'side'は副菜系タグ(汁物/サラダ。「副菜」専用タグは無いため代用。おやつは含めない=
  // 2026-07-13 Fable裁定)の品を優先する
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'side' }))?.id)
    eq('role:side は副菜系タグの品を優先する', picks.every((id) => id === 2), true)
  }
  // 副菜枠におやつは提案しない(夕食の副菜に杏仁豆腐が出るのを防ぐ。2026-07-13 Fable裁定)
  {
    const recipes = [mkRecipe(1, { tags: ['おやつ'] }), mkRecipe(2, { tags: ['サラダ'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'side' }))?.id)
    eq('role:side はおやつを提案しない', picks.every((id) => id === 2), true)
  }
  // role:'main'は副菜系タグを含まない品を優先する(従来のdinner/lunch挙動と同じロジックを流用)
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('role:main は副菜系タグを含まない品を優先する', picks.every((id) => id === 1), true)
  }
  // role省略時は従来どおり(後方互換): dinner/lunch枠だけ主菜優先、それ以外は区別しない
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const dinnerPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('role省略(後方互換): dinner枠は主菜優先のまま', dinnerPicks.every((id) => id === 1), true)
    eq(
      'role省略(後方互換): breakfast枠は汁物タグ品も普通に提案される',
      suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts({ slot: 'breakfast' }))?.id,
      1,
    )
  }
  // ---- dishType優先・タグへのフォールバック(2026-07-13 dishType導入・献立の主菜+副菜提案精度向上) ----

  // dishTypeがあれば最優先で使う: タグに副菜系タグ(汁物)があってもdishType:'main'なら主菜候補になり、
  // 逆にタグは副菜系を含まなくてもdishType:'side'なら主菜候補にならない(旧タグ判定なら結果が逆転する組み合わせ)
  {
    const recipes = [
      mkRecipe(1, { tags: ['汁物'], dishType: 'main' }),
      mkRecipe(2, { tags: ['和食'], dishType: 'side' }),
    ]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('dishType優先: dishTypeがタグより優先される(タグ汁物でもdishType:mainなら主菜候補)', picks.every((id) => id === 1), true)
  }

  // dishType未設定のレシピ(ユーザー自作)は現行のタグヒューリスティックにフォールバックする(既存挙動を維持)
  {
    const recipes = [mkRecipe(1, { tags: ['汁物'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('dishType未設定はタグヒューリスティックにフォールバックする(既存挙動維持)', picks.every((id) => id === 2), true)
  }

  // dishType:'dessert'は主菜からも副菜からも除外される(タグが「定番」のみでdishType側が最終判定になる)
  {
    const mainPickRecipes = [
      mkRecipe(1, { tags: ['定番'], dishType: 'dessert' }),
      mkRecipe(2, { tags: ['和食'], dishType: 'main' }),
    ]
    const mainPicks = Array.from(
      { length: 10 },
      () => suggestForSlot(mainPickRecipes, opts({ role: 'main' }))?.id,
    )
    eq('dishType:dessert は主菜候補から除外される', mainPicks.every((id) => id === 2), true)

    const sidePickRecipes = [
      mkRecipe(1, { tags: ['定番'], dishType: 'dessert' }),
      mkRecipe(3, { tags: ['和食'], dishType: 'side' }),
    ]
    const sidePicks = Array.from(
      { length: 10 },
      () => suggestForSlot(sidePickRecipes, opts({ role: 'side' }))?.id,
    )
    eq('dishType:dessert は副菜候補からも除外される', sidePicks.every((id) => id === 3), true)
  }

  // 本件の眼目: きんぴら等の「作り置き副菜」はタグ(作り置き/お弁当等)だけでは副菜と判別できず
  // 従来は主菜側に混ざっていたが、dishType:'side'を明示すれば副菜枠に提案されるようになる
  {
    const kinpira = mkRecipe(1, {
      title: 'きんぴらごぼう',
      tags: ['和食', '作り置き', 'お弁当'],
      dishType: 'side',
    })
    const mainDish = mkRecipe(2, { tags: ['和食', '定番'], dishType: 'main' })
    const picks = Array.from(
      { length: 10 },
      () => suggestForSlot([kinpira, mainDish], opts({ role: 'side' }))?.id,
    )
    eq('dishType: きんぴら(dishType:side・作り置きタグのみ)が副菜枠に提案される', picks.every((id) => id === 1), true)
  }

  // genre優先: 指定ジャンルのタグを持つ品を優先し、一致が無ければ他ジャンルも許可する
  {
    const recipes = [mkRecipe(1, { tags: ['洋食'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ genre: '和食' }))?.id)
    eq('genre指定: 一致するジャンルの品を優先する', picks.every((id) => id === 2), true)
  }
  eq(
    'genre指定: 一致が無ければ他ジャンルも提案する(0件にしない)',
    suggestForSlot([mkRecipe(1, { tags: ['洋食'] })], opts({ genre: '和食' }))?.id,
    1,
  )
  // 高たんぱく優先: 「高たんぱく」タグ品を優先し、無ければ他も許可する
  {
    const recipes = [mkRecipe(1, { tags: [] }), mkRecipe(2, { tags: ['高たんぱく'] })]
    const picks = Array.from({ length: 10 }, () =>
      suggestForSlot(recipes, opts({ preferHighProtein: true }))?.id,
    )
    eq('高たんぱく優先: タグ品を優先する', picks.every((id) => id === 2), true)
  }
  eq(
    '高たんぱく優先: 該当が無ければ他も提案する(0件にしない)',
    suggestForSlot([mkRecipe(1, { tags: [] })], opts({ preferHighProtein: true }))?.id,
    1,
  )

  // suggestPairForSlot: 主菜+副菜をペアで返し、ジャンル未指定なら主菜と同じジャンルの副菜を優先する
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }), // 和食の主菜候補(側菜タグ無し)
      mkRecipe(2, { tags: ['洋食', 'サラダ'] }), // 洋食の副菜候補
      mkRecipe(3, { tags: ['和食', '汁物'] }), // 和食の副菜候補
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案: 主菜が選ばれる', results.every((r) => r.main?.id === 1), true)
    eq(
      'ペア提案(和洋中の整合): 主菜と同じジャンル(和食)の副菜が優先される',
      results.every((r) => r.side?.id === 3),
      true,
    )
  }
  // ジャンル指定時は主菜・副菜の両方にそのジャンルの優先が適用される
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食'] }),
      mkRecipe(3, { tags: ['和食', '汁物'] }),
      mkRecipe(4, { tags: ['洋食', 'サラダ'] }),
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts({ genre: '洋食' })))
    eq('ペア提案: ジャンル指定時は主菜も指定ジャンルが優先される', results.every((r) => r.main?.id === 2), true)
    eq('ペア提案: ジャンル指定時は副菜も指定ジャンルが優先される', results.every((r) => r.side?.id === 4), true)
  }

  // ---- 便BH-2: 一品もの・副菜純化・たんぱく源分散・ジャンル混在(docs/56) ----

  // 一品もの(丼・麺・鍋・カレー・シチュー)の主菜が選ばれた枠は副菜を空ける(主菜1品で完結)
  {
    // 主菜候補は一品ものだけ(カレー=タイトルで一品もの判定)。副菜候補も用意しておく
    const recipes = [
      mkRecipe(1, { title: 'カレーライス', tags: ['洋食', 'ご飯もの'] }),
      mkRecipe(2, { title: 'ポテトサラダ', tags: ['洋食', 'サラダ'], dishType: 'side' }),
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案(一品もの): カレーが主菜に選ばれる', results.every((r) => r.main?.id === 1), true)
    eq('ペア提案(一品もの): 一品ものの主菜には副菜を付けない', results.every((r) => r.side === undefined), true)
  }

  // 副菜スロットは純粋な副菜(dishType:'side')に寄せる。汁物(dishType:'soup')は副菜より後回し
  {
    const recipes = [
      mkRecipe(1, { title: '味噌汁', tags: ['和食'], dishType: 'soup' }),
      mkRecipe(2, { title: 'ほうれん草のおひたし', tags: ['和食'], dishType: 'side' }),
    ]
    const picks = Array.from({ length: 12 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side' }))?.id,
    )
    eq('副菜純化: preferDishType=side は汁物(soup)より純粋な副菜(side)を優先する', picks.every((id) => id === 2), true)
  }
  // 純粋な副菜が無ければ緩和して汁物も副菜として許す(0件回避)
  eq(
    '副菜純化: 純粋な副菜が無ければ汁物(soup)を副菜として許す',
    suggestForSlot([mkRecipe(1, { title: '味噌汁', tags: ['和食'], dishType: 'soup' })], opts({ role: 'side', preferDishType: 'side' }))?.id,
    1,
  )

  // たんぱく源分散: preferProteinSources に挙げたソースの主菜を優先する(該当0件なら緩和)
  {
    const recipes = [
      mkRecipe(1, { title: '豚の生姜焼き', tags: ['和食'], dishType: 'main' }), // 肉
      mkRecipe(2, { title: '鮭の塩焼き', tags: ['和食'], dishType: 'main' }), // 魚
    ]
    const picks = Array.from({ length: 12 }, () =>
      suggestForSlot(recipes, opts({ role: 'main', preferProteinSources: ['魚'] }))?.id,
    )
    eq('たんぱく源分散: 魚を優先すると魚の主菜が選ばれる', picks.every((id) => id === 2), true)
  }
  eq(
    'たんぱく源分散: 指定ソースの主菜が無ければ緩和して他も提案する(0件にしない)',
    suggestForSlot([mkRecipe(1, { title: '豚の生姜焼き', dishType: 'main' })], opts({ role: 'main', preferProteinSources: ['魚'] }))?.id,
    1,
  )

  // proteinSourceOf: アイコン流用でたんぱく源を判定する(一品ものは主材料スキャン)
  eq('proteinSourceOf: 鮭の塩焼き→魚', proteinSourceOf({ title: '鮭の塩焼き', tags: [], ingredients: [{ name: '生鮭' }] }), '魚')
  eq('proteinSourceOf: だし巻き卵→卵', proteinSourceOf({ title: 'だし巻き卵', tags: [], ingredients: [{ name: '卵' }] }), '卵')
  eq('proteinSourceOf: 麻婆豆腐→豆腐', proteinSourceOf({ title: '麻婆豆腐', tags: [], ingredients: [{ name: '木綿豆腐' }] }), '豆腐')
  eq('proteinSourceOf: 豚の生姜焼き→肉', proteinSourceOf({ title: '豚の生姜焼き', tags: [], ingredients: [{ name: '豚ロース' }] }), '肉')
  eq('proteinSourceOf: 鶏の唐揚げ→肉', proteinSourceOf({ title: '鶏の唐揚げ', tags: [], ingredients: [{ name: '鶏もも肉' }] }), '肉')
  // 一品もの(丼)はアイコンがrice(主食)に寄るので主材料からたんぱく源を拾う
  eq(
    'proteinSourceOf: 牛丼→肉(一品ものは主材料スキャン)',
    proteinSourceOf({ title: '牛丼', tags: ['ご飯もの'], ingredients: [{ name: 'ご飯', amount: '300', unit: 'g' }, { name: '牛薄切り肉', amount: '200', unit: 'g' }] }),
    '肉',
  )
  eq('proteinSourceOf: 野菜中心はその他', proteinSourceOf({ title: 'きんぴらごぼう', tags: [], ingredients: [{ name: 'ごぼう' }] }), 'その他')

  // detectGenreMix: 主菜のジャンルと副菜/汁物のジャンルが食い違うか(混在バッジ用)
  eq(
    'detectGenreMix: 主菜和食+副菜中華は混在',
    detectGenreMix({ tags: ['和食'] }, [{ tags: ['中華'] }]),
    true,
  )
  eq(
    'detectGenreMix: 主菜和食+副菜和食は混在でない',
    detectGenreMix({ tags: ['和食'] }, [{ tags: ['和食'] }]),
    false,
  )
  eq(
    'detectGenreMix: ジャンルタグの無い副菜は万能枠=混在に数えない',
    detectGenreMix({ tags: ['和食'] }, [{ tags: [] }]),
    false,
  )
  eq('detectGenreMix: 主菜が無ければ混在なし', detectGenreMix(undefined, [{ tags: ['中華'] }]), false)
  eq('detectGenreMix: 主菜にジャンルが無ければ混在なし', detectGenreMix({ tags: [] }, [{ tags: ['中華'] }]), false)

  // isMainDish / recipeGenre: 外部公開の主菜判定・ジャンル取得(ホーム「今日なに作る?」等が使う)
  eq('isMainDish: dishType:main は主菜', isMainDish(mkRecipe(1, { dishType: 'main' })), true)
  eq('isMainDish: dishType:side は主菜でない', isMainDish(mkRecipe(1, { dishType: 'side' })), false)
  eq('isMainDish: dishType:dessert は主菜でない', isMainDish(mkRecipe(1, { dishType: 'dessert' })), false)
  eq('isMainDish: dishType未設定はタグヒューリスティック(汁物タグは主菜でない)', isMainDish(mkRecipe(1, { tags: ['汁物'] })), false)
  eq('recipeGenre: 和食タグ→和食', recipeGenre({ tags: ['定番', '和食'] }), '和食')
  eq('recipeGenre: ジャンルタグ無し→undefined', recipeGenre({ tags: ['定番'] }), undefined)

  // ---- ランダム週献立の保護2点(2026-07-16 便W-⑤・オーナー指示2026-07-16夜) ----

  // (a) 過去日不変: isPastDateは今日より前の日付だけtrueを返す(MealPlanPage側のfillWeek/
  // suggestRowはこれで過去日の枠を素通りする＝upsertしない。ここでは判定の純ロジックだけを検証)
  eq('過去日判定: 今日より前はtrue', isPastDate('2026-07-15', '2026-07-16'), true)
  eq('過去日判定: 今日はfalse(対象に含める)', isPastDate('2026-07-16', '2026-07-16'), false)
  eq('過去日判定: 今日より後はfalse', isPastDate('2026-07-17', '2026-07-16'), false)
  eq('shiftDate: 1日前(月またぎ)を正しく計算', shiftDate('2026-08-01', -1), '2026-07-31')
  eq('shiftDate: 1日後(年またぎ)を正しく計算', shiftDate('2025-12-31', 1), '2026-01-01')

  // (b) 昨日除外: 候補から昨日の週プランに入っていたレシピを除外する
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () =>
      suggestForSlot(recipes, opts({ yesterdayRecipeIds: [1] }))?.id,
    )
    eq('昨日除外: 昨日食べたレシピは候補から外れる', picks.every((id) => id === 2), true)
  }
  // 尽きたら解除: 除外すると候補が0件になる場合は除外を解いて提案する(空振りより重複がマシ)
  eq(
    '昨日除外: 候補が尽きる場合は除外を解除して提案する',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts({ yesterdayRecipeIds: [1] }))?.id,
    1,
  )
  // yesterdayRecipeIds未指定(従来呼び出し)は何も除外しない(後方互換)
  eq(
    '昨日除外: yesterdayRecipeIds省略時は従来どおり除外しない',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts())?.id,
    1,
  )
  // excludeYesterdayPlanRecipes単体: 除外0件時はpoolをそのまま返す・id未設定要素は素通し
  {
    const pool = [{ id: 1 }, { id: 2 }, { id: 3 }]
    eq(
      'excludeYesterdayPlanRecipes: 該当を除外する',
      excludeYesterdayPlanRecipes(pool, [2]).map((r) => r.id),
      [1, 3],
    )
    eq(
      'excludeYesterdayPlanRecipes: 全滅する場合はpoolをそのまま返す',
      excludeYesterdayPlanRecipes(pool, [1, 2, 3]).map((r) => r.id),
      [1, 2, 3],
    )
    eq(
      'excludeYesterdayPlanRecipes: yesterdayRecipeIdsが空なら素通し',
      excludeYesterdayPlanRecipes(pool, []).map((r) => r.id),
      [1, 2, 3],
    )
  }
}

// ---------- 期間の食費(2026-07-17 便AB・docs/35 §5): normalizeDateRange/rangeDayCount ----------
eq(
  'normalizeDateRange: 開始<=終了はそのまま',
  normalizeDateRange('2026-07-03', '2026-07-08'),
  ['2026-07-03', '2026-07-08'],
)
eq(
  'normalizeDateRange: 終了<開始は自動で入れ替え',
  normalizeDateRange('2026-07-08', '2026-07-03'),
  ['2026-07-03', '2026-07-08'],
)
eq(
  'normalizeDateRange: 同日を2回タップしても1日の範囲になる',
  normalizeDateRange('2026-07-05', '2026-07-05'),
  ['2026-07-05', '2026-07-05'],
)
eq('rangeDayCount: 同日は1日', rangeDayCount('2026-07-05', '2026-07-05'), 1)
eq('rangeDayCount: 3日〜8日は6日間(両端含む)', rangeDayCount('2026-07-03', '2026-07-08'), 6)
eq('rangeDayCount: 月をまたぐ計算も正しい', rangeDayCount('2026-06-28', '2026-07-02'), 5)

// ---------- planWeekFill(「まとめて献立を立てる」の計画・2026-07-22 便BE) ----------
// 外部レビューで見つかった「手動配置を無警告で上書きする」欠陥の再発防止。
// 手動配置(auto以外)がある枠は残し、空き枠・自動提案由来の枠だけを埋め直す。過去日・非表示帯は対象外。
{
  const week = [
    '2026-07-20', // 月
    '2026-07-21', // 火
    '2026-07-22', // 水
    '2026-07-23', // 木
    '2026-07-24', // 金
    '2026-07-25', // 土
    '2026-07-26', // 日
  ]
  const mkEntry = (id, date, recipeId, over = {}) => ({ id, date, slot: 'dinner', recipeId, role: 'main', ...over })
  const keysOf = (slots) => slots.map((s) => `${s.date}|${s.slot}`)
  const sortedNums = (a) => [...a].sort((x, y) => x - y)
  const sortedStrs = (set) => Array.from(set).sort()

  // (1) まっさらな週(空): 表示中の全枠が埋め対象になる。手動保護なし・削除なし(MEALPLAN-04 1回目相当)
  {
    const plan = planWeekFill([], week, ['dinner'], '2026-07-20')
    eq('planWeekFill(空の週): 7日分の夕食すべてが埋め対象', keysOf(plan.slotsToFill), [
      '2026-07-20|dinner', '2026-07-21|dinner', '2026-07-22|dinner', '2026-07-23|dinner',
      '2026-07-24|dinner', '2026-07-25|dinner', '2026-07-26|dinner',
    ])
    eq('planWeekFill(空の週): 残す手動枠は0', plan.preservedSlotKeys.size, 0)
    eq('planWeekFill(空の週): 削除対象なし', plan.autoEntryIdsToRemove, [])
    eq('planWeekFill(空の週): used除外なし', plan.usedRecipeIds, [])
  }

  // (2) 全枠が自動提案由来: 2回目のタップでも全枠を埋め直す(再抽選)＝手動保護は邪魔しない
  //     (MEALPLAN-04 2回目相当: 自動枠は削除→再作成される)
  {
    const entries = week.map((date, i) => mkEntry(i + 1, date, 10 + i, { auto: true }))
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(全自動枠): 全7枠が埋め直し対象', plan.slotsToFill.length, 7)
    eq('planWeekFill(全自動枠): 自動行は全件削除対象', sortedNums(plan.autoEntryIdsToRemove), [1, 2, 3, 4, 5, 6, 7])
    eq('planWeekFill(全自動枠): 残す手動枠は0(再抽選できる)', plan.preservedSlotKeys.size, 0)
  }

  // (3) 手動配置は残し、空き枠だけ埋める。手動枠は埋め対象にも削除対象にもならない(タスク1の核心)
  {
    const entries = [
      mkEntry(1, '2026-07-20', 11), // 月・手動(auto未設定)
      mkEntry(2, '2026-07-21', 12, { auto: true }), // 火・自動
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(手動保護): 月の手動枠は残す枠に入る', sortedStrs(plan.preservedSlotKeys), ['2026-07-20|dinner'])
    eq(
      'planWeekFill(手動保護): 月(手動)は埋め対象から外れ、火〜日だけ埋める',
      keysOf(plan.slotsToFill),
      ['2026-07-21|dinner', '2026-07-22|dinner', '2026-07-23|dinner', '2026-07-24|dinner', '2026-07-25|dinner', '2026-07-26|dinner'],
    )
    eq('planWeekFill(手動保護): 手動行(id=1)は削除されず、火の自動行(id=2)だけ削除', plan.autoEntryIdsToRemove, [2])
    eq('planWeekFill(手動保護): 手動枠のレシピ(11)は重複回避のusedに入る', plan.usedRecipeIds.includes(11), true)
    // 便BH-2(役割粒度): 手動で主菜だけ入れた月曜は、主菜を残したまま副菜だけを追加で埋める
    eq(
      'planWeekFill(役割粒度): 手動主菜だけの月曜は副菜だけを追加で埋める(partialFills)',
      plan.partialFills.map((p) => `${p.date}|${p.slot}|${p.fillRole}`),
      ['2026-07-20|dinner|side'],
    )
  }

  // (3b) 便BH-2(役割粒度): 手動で副菜だけ入れ、同じ枠に自動主菜がある場合。
  //      副菜(手動)は残し、自動主菜は削除して主菜だけを埋め直す
  {
    const entries = [
      mkEntry(1, '2026-07-20', 21, { role: 'side' }), // 月・手動副菜
      mkEntry(2, '2026-07-20', 22, { role: 'main', auto: true }), // 月・自動主菜
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(役割粒度): 手動副菜のある月曜は残す枠に入る', sortedStrs(plan.preservedSlotKeys), ['2026-07-20|dinner'])
    eq('planWeekFill(役割粒度): 自動主菜(id=2)は削除して主菜だけ埋め直す', plan.autoEntryIdsToRemove.includes(2), true)
    eq('planWeekFill(役割粒度): 手動副菜(id=1)は削除されない', plan.autoEntryIdsToRemove.includes(1), false)
    eq(
      'planWeekFill(役割粒度): 月曜は主菜だけ埋める(partialFills=main)',
      plan.partialFills.find((p) => p.date === '2026-07-20')?.fillRole,
      'main',
    )
    eq('planWeekFill(役割粒度): 手動副菜のレシピ(21)は重複回避のusedに入る', plan.usedRecipeIds.includes(21), true)
  }

  // (4) 過去日・今日の手動・非表示帯・手動と自動が同居する枠、の複合ケース
  {
    const entries = [
      mkEntry(1, '2026-07-20', 100), // 月=過去日(today=水): 対象外→触らない・usedに入る
      mkEntry(2, '2026-07-22', 200), // 水=今日・手動→残す
      mkEntry(3, '2026-07-23', 300, { auto: true }), // 木・自動→削除して埋め直す
      mkEntry(4, '2026-07-24', 400, { auto: true }), // 金・自動 …だが同じ枠に手動(id=5)があるので枠ごと残す
      mkEntry(5, '2026-07-24', 401), // 金・手動→金の枠を残す
      mkEntry(6, '2026-07-25', 500, { slot: 'lunch' }), // 土・昼食(非表示帯)→対象外・usedに入る
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-22')
    eq('planWeekFill(複合): 残す枠は今日(水)と金の2枠', sortedStrs(plan.preservedSlotKeys), ['2026-07-22|dinner', '2026-07-24|dinner'])
    eq('planWeekFill(複合): 埋めるのは木・土・日の夕食', keysOf(plan.slotsToFill), [
      '2026-07-23|dinner', '2026-07-25|dinner', '2026-07-26|dinner',
    ])
    eq('planWeekFill(複合): 削除は木の自動(id=3)のみ。金の自動(id=4)は枠ごと残すので消さない', plan.autoEntryIdsToRemove, [3])
    eq('planWeekFill(複合): 過去日・非表示帯・残す枠の全レシピがusedに入る', sortedNums(plan.usedRecipeIds), [100, 200, 400, 401, 500])
    // 便BH-2(役割粒度): 手動主菜だけの水(今日)・金は、副菜だけを追加で埋める
    eq(
      'planWeekFill(複合・役割粒度): 水と金は副菜だけを追加で埋める(partialFills)',
      plan.partialFills.map((p) => `${p.date}|${p.slot}|${p.fillRole}`).sort(),
      ['2026-07-22|dinner|side', '2026-07-24|dinner|side'],
    )
  }
}

// ---------- buildShoppingCandidates(「水」がチェック済みで入る・2026-07-09ペルソナ第2波) ----------
{
  const recipes = [
    {
      id: 1,
      ingredients: [
        { name: '水', amount: '600', unit: 'ml' },
        { name: 'お湯', amount: '200', unit: 'ml' },
        { name: '湯', amount: '400', unit: 'ml' },
        { name: 'だし汁', amount: '300', unit: 'ml' },
        { name: '鶏むね肉', amount: '1', unit: '枚' },
        { name: 'しょうゆ', amount: '2', unit: '大さじ' },
      ],
    },
  ]
  const candidates = buildShoppingCandidates(recipes, [])
  const byName = new Map(candidates.map((c) => [c.name, c]))
  eq('買い物候補: 水はデフォルト未チェック側', byName.get('水')?.isSeasoningLike, true)
  eq('買い物候補: お湯もデフォルト未チェック側', byName.get('お湯')?.isSeasoningLike, true)
  eq('買い物候補: 湯もデフォルト未チェック側', byName.get('湯')?.isSeasoningLike, true)
  eq('買い物候補: だし汁は通常どおりチェック側', byName.get('だし汁')?.isSeasoningLike, false)
  eq('買い物候補: 主材料はチェック側のまま', byName.get('鶏むね肉')?.isSeasoningLike, false)
  eq('買い物候補: 調味料は従来どおり未チェック側', byName.get('しょうゆ')?.isSeasoningLike, true)
}

// ---------- hasLaterHandsOnStep(並行調理ナビ: 最後の待ち工程に「この間に〜」を出さない・2026-07-09ペルソナ第2波) ----------
{
  const items = [
    { kind: 'active' },
    { kind: 'wait' }, // 後ろに手作業がある待ち → ヒントを出す
    { kind: 'active' },
    { kind: 'wait' }, // 最後の待ち(後続の手作業なし) → ヒントを出さない
  ]
  eq('ナビ: 後続に手作業がある待ちはヒントあり', hasLaterHandsOnStep(items, 1), true)
  eq('ナビ: 最後の待ちはヒントなし', hasLaterHandsOnStep(items, 3), false)
  eq('ナビ: 後続が待ちだけでもヒントなし', hasLaterHandsOnStep([{ kind: 'active' }, { kind: 'wait' }, { kind: 'wait' }], 1), false)
}

// ---------- classifyStep(並行調理ナビ: フライパンの「焼く」は目を離せないので手作業系のまま。
// 素の/焼/を待ち系から外し、蒸し焼き・グリル・オーブン・レンジだけ待ち系にする。2026-07-14 Fable/Codexレビュー) ----------
{
  eq(
    'ナビ分類: 素の「焼く」は手作業系(焦げ付き事故防止のため待ちにしない)',
    classifyStep({ text: '5分焼く', minutes: 5 }),
    'active',
  )
  eq(
    'ナビ分類: 「蒸し焼き」は待ち系(フタして基本放置でよい)',
    classifyStep({ text: '8分蒸し焼きにする', minutes: 8 }),
    'wait',
  )
  eq(
    'ナビ分類: 「グリルで焼く」は待ち系(点火後は基本放置)',
    classifyStep({ text: 'グリルで10分焼く', minutes: 10 }),
    'wait',
  )
  eq(
    'ナビ分類: 「オーブンで焼く」は待ち系(既存挙動の回帰確認)',
    classifyStep({ text: 'オーブンで15分焼く', minutes: 15 }),
    'wait',
  )
  eq(
    'ナビ分類: 「炒める」は従来どおり手作業系(回帰確認)',
    classifyStep({ text: '3分炒める', minutes: 3 }),
    'active',
  )
}

// ---------- classifyStep / resolveStepMinutes(並行調理ナビ: step.minutesが空でも本文の時間表記から
// 待ち分数を推定して分類する。2026-07-23 便BI・Fable裁定。貼り付け/URL取り込みのレシピはminutesが
// 空になる実態への対応。安全側=待ち動詞ホワイトリスト維持・迷ったら手作業・明示minutes最優先) ----------
{
  // 本文から待ち分数を推定して待ち系に分類する(minutes未設定=貼り付け相当)
  eq('ナビ推定: 「鍋で15分煮る」(minutes無)は待ち系', classifyStep({ text: '鍋で15分煮る' }), 'wait')
  eq('ナビ推定: 「弱火で20分煮込む」(minutes無)は待ち系', classifyStep({ text: '弱火で20分煮込む' }), 'wait')
  eq('ナビ推定: 「10分蒸らす」(minutes無)は待ち系', classifyStep({ text: '10分蒸らす' }), 'wait')
  eq('ナビ推定: 「そのまま10分おく」(minutes無)は待ち系', classifyStep({ text: 'そのまま10分おく' }), 'wait')
  eq('ナビ推定: 「600Wで3分加熱する」(minutes無)は待ち系(レンジ出力ワット数)', classifyStep({ text: '600Wで3分加熱する' }), 'wait')
  // 安全側: 待ち動詞でない工程は本文に時間があっても手作業系のまま
  eq('ナビ推定: 「5分炒める」(minutes無)は手作業系(炒めは目を離せない)', classifyStep({ text: '5分炒める' }), 'active')
  eq('ナビ推定: 「フライパンで3分焼く」(minutes無)は手作業系(素の焼く)', classifyStep({ text: 'フライパンで3分焼く' }), 'active')
  // 安全側: 1分未満(秒だけ)の待ちは並行の実益が無いので手作業系に倒す
  eq('ナビ推定: 「30秒茹でる」(minutes無)は手作業系(秒だけの待ちは並行しない)', classifyStep({ text: '30秒茹でる' }), 'active')
  // 安全側: 待ち動詞でも分数の手掛かりが全く無ければ手作業系に倒す
  eq('ナビ推定: 「じっくり煮込む」(時間表記なし)は手作業系(分数不明)', classifyStep({ text: 'じっくり煮込む' }), 'active')
  // 待ち動詞も時間も無いふつうの工程は手作業系
  eq('ナビ推定: 「材料を切る」は手作業系', classifyStep({ text: '材料を切る' }), 'active')

  // resolveStepMinutes: 明示minutesが本文推定より優先される(明示データ>推定)
  eq('ナビ推定: 明示minutesは本文の時間より優先(15分本文でもminutes:20を採用)', resolveStepMinutes({ text: '15分煮る', minutes: 20 }), 20)
  eq('ナビ推定: minutes無なら本文の15分を採用', resolveStepMinutes({ text: '鍋で15分煮る' }), 15)
  eq('ナビ推定: 複数の時間表記があれば最長を採用(10分煮て5分蒸らす→10)', resolveStepMinutes({ text: '10分煮て5分蒸らす' }), 10)
  eq('ナビ推定: 秒だけ(30秒)は推定対象外(undefined)', resolveStepMinutes({ text: '30秒茹でる' }), undefined)
  eq('ナビ推定: 時間表記が無ければundefined', resolveStepMinutes({ text: 'じっくり煮込む' }), undefined)

  // タイムライン: 貼り付け相当(minutes無)でも長い待ちが認識され、隙間に別レシピの手作業が入る
  const timeline = buildCookTimeline([
    { id: 1, title: '煮物', steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const simmer = timeline.items.find((it) => it.text === '鍋で15分煮る')
  eq('ナビ組立: minutes無の「15分煮る」が待ち系として計上される', simmer?.kind, 'wait')
  eq('ナビ組立: minutes無でも待ち分数が本文から15分として入る', simmer?.waitMinutes, 15)
  // 待ち(order 2)の直後に別レシピ(サラダ)の手作業が差し込まれている=並行化されている
  const simmerOrder = simmer?.order ?? 0
  const nextItem = timeline.items.find((it) => it.order === simmerOrder + 1)
  eq('ナビ組立: 15分の待ちの隙間に別レシピの手作業が差し込まれる', nextItem?.recipeTitle, 'サラダ')
}

// ---------- buildCookTimeline(並行調理ナビ: フライパン焼き中に他レシピを差し込ませない。
// 2026-07-14 Fable/Codexレビュー) ----------
{
  const recipes = [
    {
      id: 1,
      title: '鮭のムニエル',
      steps: [
        { text: '下味をつける' },
        { text: 'フライパンで5分焼く', minutes: 5 },
        { text: '盛り付ける' },
      ],
    },
    {
      id: 2,
      title: 'サラダ',
      steps: [{ text: '野菜を切る' }, { text: 'ドレッシングを和える' }],
    },
  ]
  const timeline = buildCookTimeline(recipes)
  const yakuStep = timeline.items.find((it) => it.text === 'フライパンで5分焼く')
  eq('ナビ組立: 「焼く」は手作業系として計上される', yakuStep?.kind, 'active')
  eq('ナビ組立: 「焼く」は待ち扱いにならない(waitMinutes=0)', yakuStep?.waitMinutes, 0)
}

// ---------- resolveDuplicateTitleAction(配布セット再取込: kintoreテーマ改名で旧名称バッジが
// 残ってしまった不具合の再発防止。バッチH-1 2026-07-10) ----------
eq(
  '同一セット由来の再取込は重複させずセット名だけ更新',
  resolveDuplicateTitleAction('kintore', 'kintore'),
  'updateName',
)
eq(
  '別セット由来の同名料理はスキップのみ(既存を優先)',
  resolveDuplicateTitleAction('other-set', 'kintore'),
  'skip',
)
eq(
  '個人登録(sourceSetIdなし)と同名の取込はスキップのみ',
  resolveDuplicateTitleAction(undefined, 'kintore'),
  'skip',
)
eq(
  '取込元のsetIdが無い(通常バックアップ相当)場合は常にスキップ',
  resolveDuplicateTitleAction('kintore', undefined),
  'skip',
)

// ---------- buildUpdatedSetRecipe(レシピセットの再取込で内容を更新できるように・2026-07-12
// オーナー実機フィードバック「review中セットに修正を配信する手段が無い」の対策) ----------
{
  const existingSetRecipe = {
    id: 42,
    title: 'レンジ蒸し鶏',
    photo: 'FAKE_PHOTO_BLOB',
    servings: 2,
    cookMinutes: 15,
    effortLevel: 'easy',
    tags: ['高たんぱく'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '鶏むね肉', amount: '300', unit: 'g' }],
    steps: [{ text: '鶏むね肉をレンジで加熱する' }],
    quickSteps: undefined,
    memo: '旧メモ',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: ['old'],
    isStarter: true,
    sourceSetId: 'kintore',
    sourceSetName: '筋トレ・高たんぱくセット',
    createdAt: 1000,
    updatedAt: 1000,
  }

  // (1) 内容が変わっていれば更新される(修正版JSONの再取込で中身が反映されること)
  const changedContent = {
    servings: 2,
    cookMinutes: 12,
    effortLevel: 'easy',
    tags: ['高たんぱく', '時短'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [
      { name: '鶏むね肉', amount: '300', unit: 'g' },
      { name: '塩こうじ', amount: '1', unit: '大さじ' },
    ],
    steps: [{ text: '鶏むね肉に塩こうじを揉み込みレンジで加熱する' }],
    quickSteps: undefined,
    memo: '新メモ:レンジ加熱時間を修正',
    sourceUrl: undefined,
  }
  const updated = buildUpdatedSetRecipe(existingSetRecipe, changedContent, existingSetRecipe.sourceSetName, 5000)
  eq('内容が変わっていれば更新結果が返る(null以外)', updated !== null, true)
  eq('更新: cookMinutesが反映される', updated?.cookMinutes, 12)
  eq('更新: memoが反映される', updated?.memo, '新メモ:レンジ加熱時間を修正')
  eq('更新: ingredientsが反映される', updated?.ingredients, changedContent.ingredients)
  eq('更新: tagsが反映される', updated?.tags, changedContent.tags)
  eq('更新: updatedAtが今回渡した時刻になる', updated?.updatedAt, 5000)
  eq(
    '更新: searchWordsが新しい材料で再構築される',
    updated?.searchWords,
    buildSearchWords(existingSetRecipe.title, changedContent.ingredients, changedContent.tags),
  )

  // (2) ユーザーデータ(id・createdAt・favorite・cookedLogs・photo・isStarter)は保持される
  eq('保持: idは既存のまま', updated?.id, existingSetRecipe.id)
  eq('保持: createdAtは既存のまま', updated?.createdAt, existingSetRecipe.createdAt)
  eq('保持: favoriteは既存のまま', updated?.isFavorite, existingSetRecipe.isFavorite)
  eq('保持: cookedLogsは既存のまま', updated?.cookedLogs, existingSetRecipe.cookedLogs)
  eq('保持: photoは既存のまま', updated?.photo, existingSetRecipe.photo)
  eq('保持: isStarterは既存のまま', updated?.isStarter, existingSetRecipe.isStarter)

  // (3) 内容が完全に同一(セット名込み)ならnull=スキップ扱い(毎回「更新しました」と出るノイズを防ぐ)
  const sameContent = {
    servings: existingSetRecipe.servings,
    cookMinutes: existingSetRecipe.cookMinutes,
    effortLevel: existingSetRecipe.effortLevel,
    tags: [...existingSetRecipe.tags],
    season: existingSetRecipe.season,
    suitableFor: existingSetRecipe.suitableFor,
    ingredients: existingSetRecipe.ingredients.map((i) => ({ ...i })),
    steps: existingSetRecipe.steps.map((s) => ({ ...s })),
    quickSteps: existingSetRecipe.quickSteps,
    memo: existingSetRecipe.memo,
    sourceUrl: existingSetRecipe.sourceUrl,
  }
  eq(
    '内容が完全に同一ならnull(スキップ扱い)',
    buildUpdatedSetRecipe(existingSetRecipe, sameContent, existingSetRecipe.sourceSetName, 5000),
    null,
  )

  // セット名だけ変わっている(テーマ改名)場合も更新扱いになり、sourceSetNameに反映される
  // (バッチH-1で対応した挙動が、内容更新の仕組みに統合された後も保たれることの確認)
  const renamed = buildUpdatedSetRecipe(existingSetRecipe, sameContent, '新テーマ名', 5000)
  eq('セット名だけの変更でも更新扱いになる(null以外)', renamed !== null, true)
  eq('更新後のsourceSetNameが新名称になる', renamed?.sourceSetName, '新テーマ名')
}

// ---------- buildUpdatedSetRecipe: intro・quickCookMinutesも更新対象フィールドに含まれる
// (2026-07バグ修正: 前回dishTypeを追加したのと同型。これが無いと配布側でintro/
// quickCookMinutesだけを直しても再取込で既存ユーザーへ届かなかった) ----------
{
  const base = {
    id: 101,
    title: 'よだれ鶏',
    photo: undefined,
    intro: '旧イントロ',
    servings: 2,
    cookMinutes: 20,
    quickCookMinutes: 10,
    effortLevel: 'normal',
    tags: ['中華'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '鶏むね肉', amount: '300', unit: 'g' }],
    steps: [{ text: '鶏むね肉を茹でる' }],
    quickSteps: [{ text: 'レンジで加熱する' }],
    memo: '',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: [],
    isStarter: true,
    sourceSetId: 'chuka',
    sourceSetName: '中華セット',
    keywords: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }

  // introだけが違う場合も「内容の更新」として扱われる(dishType導入時と同じ確認パターン)
  const introOnly = { ...base, intro: '新イントロ' }
  const updatedIntro = buildUpdatedSetRecipe(base, introOnly, base.sourceSetName, 6000)
  eq('introだけの差分でも更新される(nullでない)', updatedIntro !== null, true)
  eq('更新結果にintroが反映される', updatedIntro?.intro, '新イントロ')
  eq('intro更新でもお気に入りは保持される', updatedIntro?.isFavorite, true)

  // quickCookMinutesだけが違う場合も「内容の更新」として扱われる
  const quickCookOnly = { ...base, quickCookMinutes: 8 }
  const updatedQuickCook = buildUpdatedSetRecipe(base, quickCookOnly, base.sourceSetName, 6000)
  eq('quickCookMinutesだけの差分でも更新される(nullでない)', updatedQuickCook !== null, true)
  eq('更新結果にquickCookMinutesが反映される', updatedQuickCook?.quickCookMinutes, 8)
  eq(
    'quickCookMinutes更新でもユーザーデータ(作った記録)は保持される',
    updatedQuickCook?.cookedLogs,
    base.cookedLogs,
  )

  // onePointだけが違う場合も「内容の更新」として扱われる(2026-07メモ2区画化で追加。
  // introやquickCookMinutesと同じ理由: これが無いと配布側でonePointだけを直しても
  // 再取込で既存ユーザーへ届かない)
  const onePointOnly = { ...base, onePoint: '新ワンポイント' }
  const updatedOnePoint = buildUpdatedSetRecipe(base, onePointOnly, base.sourceSetName, 6000)
  eq('onePointだけの差分でも更新される(nullでない)', updatedOnePoint !== null, true)
  eq('更新結果にonePointが反映される', updatedOnePoint?.onePoint, '新ワンポイント')
  eq('onePoint更新でもお気に入りは保持される', updatedOnePoint?.isFavorite, true)
}

// ---------- buildUpdatedSetRecipe: keywordsも更新対象フィールドに含まれる(検索キーワード欄
// 2026-07-12バッチ。公式レシピへの語彙付与ルールをセット再配信で反映できるようにする) ----------
{
  const base = {
    id: 99,
    title: 'ホイコーロー',
    photo: undefined,
    servings: 2,
    cookMinutes: 20,
    effortLevel: 'normal',
    tags: ['中華'],
    season: 'all',
    suitableFor: undefined,
    ingredients: [{ name: '豚バラ肉', amount: '200', unit: 'g' }],
    steps: [{ text: '豚バラ肉を炒める' }],
    quickSteps: undefined,
    memo: '',
    sourceUrl: undefined,
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    isStarter: true,
    sourceSetId: 'chuka',
    sourceSetName: '中華セット',
    keywords: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }
  const withKeyword = { ...base, keywords: ['回鍋肉'] }
  const updated = buildUpdatedSetRecipe(base, withKeyword, base.sourceSetName, 6000)
  eq('keywordsが増えただけでも更新扱いになる(null以外)', updated !== null, true)
  eq('更新: keywordsが反映される', updated?.keywords, ['回鍋肉'])
  eq(
    '更新: searchWordsにkeywordsが合流する',
    updated?.searchWords.some((w) => w.includes(toHiragana('回鍋肉'))),
    true,
  )
}

// ---------- buildUpdatedStarterRecipe / planStarterReload(基本レシピの入れ直しでユーザーデータを
// 保持できるように・2026-07-13 Fable設計。buildUpdatedSetRecipeと同じ考え方を移植し、
// 削除→再追加で消えていたお気に入り・作った記録・写真・編集を保持できるようにした) ----------
{
  const existingStarter = {
    id: 7,
    title: 'E2Eテスト用肉じゃが',
    photo: 'FAKE_PHOTO_BLOB',
    servings: 2,
    cookMinutes: 35,
    effortLevel: 'normal',
    tags: ['和食'],
    season: 'all',
    suitableFor: ['dinner'],
    ingredients: [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    steps: [{ text: '旧手順' }],
    quickSteps: undefined,
    memo: '旧メモ',
    sourceUrl: undefined,
    isFavorite: true,
    cookedLogs: [{ date: '2026-07-01' }],
    searchWords: ['old'],
    isStarter: true,
    sourceSetId: undefined,
    createdAt: 1000,
    updatedAt: 1000,
  }

  // (1) 内容は新版(starterDefs)に置き換わる
  const newDef = {
    title: 'E2Eテスト用肉じゃが',
    servings: 2,
    cookMinutes: 30,
    effortLevel: 'normal',
    tags: ['和食', '定番'],
    season: 'all',
    suitableFor: ['dinner'],
    ingredients: [
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: '牛こま切れ肉', amount: '200', unit: 'g' },
    ],
    steps: [{ text: '新手順' }],
    quickSteps: undefined,
    memo: '新メモ',
    sourceUrl: undefined,
  }
  const updated = buildUpdatedStarterRecipe(existingStarter, newDef, 5000)
  eq('内容が変わっていれば更新結果が返る(null以外)', updated !== null, true)
  eq('更新: 内容は新版に置き換わる(cookMinutes)', updated?.cookMinutes, 30)
  eq('更新: 内容は新版に置き換わる(steps)', updated?.steps, newDef.steps)
  eq('更新: 内容は新版に置き換わる(ingredients)', updated?.ingredients, newDef.ingredients)
  eq('更新: updatedAtが今回渡した時刻になる', updated?.updatedAt, 5000)

  // (2) お気に入り・作った記録・写真・id・createdAtが保持される
  eq('保持: お気に入りが保持される', updated?.isFavorite, true)
  eq('保持: 作った記録が保持される', updated?.cookedLogs, existingStarter.cookedLogs)
  eq('保持: 写真が保持される', updated?.photo, existingStarter.photo)
  eq('保持: idは既存のまま', updated?.id, existingStarter.id)
  eq('保持: createdAtは既存のまま', updated?.createdAt, existingStarter.createdAt)

  // (3) 内容が完全に同一なら同一内容はスキップ(null)
  const sameDef = {
    title: existingStarter.title,
    servings: existingStarter.servings,
    cookMinutes: existingStarter.cookMinutes,
    effortLevel: existingStarter.effortLevel,
    tags: [...existingStarter.tags],
    season: existingStarter.season,
    suitableFor: existingStarter.suitableFor,
    ingredients: existingStarter.ingredients.map((i) => ({ ...i })),
    steps: existingStarter.steps.map((s) => ({ ...s })),
    quickSteps: existingStarter.quickSteps,
    memo: existingStarter.memo,
    sourceUrl: existingStarter.sourceUrl,
  }
  eq('同一内容はスキップ(null)', buildUpdatedStarterRecipe(existingStarter, sameDef, 5000), null)

  // (3b) dishTypeだけが違う場合も「内容の更新」として扱う(dishType導入(2026-07-13)の配布が
  // 入れ直しで既存ユーザーへ届くことの保証。これが無いと同一内容扱いでスキップされる)
  {
    const withDishType = { ...sameDef, dishType: 'side' }
    const updatedByDishType = buildUpdatedStarterRecipe(existingStarter, withDishType, 6000)
    eq('dishTypeだけの差分でも更新される(nullでない)', updatedByDishType !== null, true)
    eq('更新結果にdishTypeが入る', updatedByDishType?.dishType, 'side')
    eq('dishType更新でもお気に入りは保持される', updatedByDishType?.isFavorite, true)
  }

  // (3c) intro・quickCookMinutesだけが違う場合も「内容の更新」として扱う(2026-07バグ修正:
  // 前回dishTypeを足したのと同型。これが無いと「基本レシピを入れ直す」でintro/
  // quickCookMinutesだけの配布側修正が既存ユーザーへ届かなかった)
  {
    const withIntro = { ...sameDef, intro: '新イントロ' }
    const updatedByIntro = buildUpdatedStarterRecipe(existingStarter, withIntro, 6000)
    eq('introだけの差分でも更新される(nullでない)', updatedByIntro !== null, true)
    eq('更新結果にintroが入る', updatedByIntro?.intro, '新イントロ')
    eq('intro更新でもお気に入りは保持される', updatedByIntro?.isFavorite, true)

    const withQuickCook = { ...sameDef, quickCookMinutes: 15 }
    const updatedByQuickCook = buildUpdatedStarterRecipe(existingStarter, withQuickCook, 6000)
    eq('quickCookMinutesだけの差分でも更新される(nullでない)', updatedByQuickCook !== null, true)
    eq('更新結果にquickCookMinutesが入る', updatedByQuickCook?.quickCookMinutes, 15)
    eq(
      'quickCookMinutes更新でも作った記録は保持される',
      updatedByQuickCook?.cookedLogs,
      existingStarter.cookedLogs,
    )

    // onePointだけが違う場合も「内容の更新」として扱う(2026-07メモ2区画化: intro等と同型)
    const withOnePoint = { ...sameDef, onePoint: '新ワンポイント' }
    const updatedByOnePoint = buildUpdatedStarterRecipe(existingStarter, withOnePoint, 6000)
    eq('onePointだけの差分でも更新される(nullでない)', updatedByOnePoint !== null, true)
    eq('更新結果にonePointが入る', updatedByOnePoint?.onePoint, '新ワンポイント')
    eq(
      'onePoint更新でも作った記録は保持される',
      updatedByOnePoint?.cookedLogs,
      existingStarter.cookedLogs,
    )
  }

  // (4) planStarterReload: 新規追加・更新・削除の仕分け。旧title品(starterDefsに無いtitle。
  // 旧版の品・ユーザーがタイトルを変えた品)は削除される
  const otherExisting = {
    id: 8,
    title: '旧版だけにあった品',
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    isStarter: true,
    sourceSetId: undefined,
    createdAt: 500,
    updatedAt: 500,
  }
  const defs = [newDef, { ...newDef, title: '新版で追加された品' }]
  const plan = planStarterReload([existingStarter, otherExisting], defs, 9000)
  eq('planStarterReload: 新規titleは追加対象になる', plan.toAdd.map((d) => d.title), [
    '新版で追加された品',
  ])
  eq('planStarterReload: 内容が変わった既存titleは更新対象になる', plan.toUpdate.length, 1)
  eq('planStarterReload: 更新対象のidは既存のまま', plan.toUpdate[0]?.id, existingStarter.id)
  eq('旧title品は削除される(starterDefsに無いtitle)', plan.toDeleteIds, [otherExisting.id])

  // (5) 二重投入ガード・トゥームストーン尊重(2026-07-23テーマ全廃)。planStarterReloadに
  // allTitles(端末上の全料理名)・excludedTitles(削除済み記録)を渡すと、基本レシピに同名が無くても
  // 端末に同名レシピがある/削除済みの品は新規追加しない
  {
    const addDefs = [
      { ...newDef, title: 'ゼロから新規の品' },
      { ...newDef, title: '?set=で取込済みの品' },
      { ...newDef, title: '削除済みの品' },
    ]
    const allTitles = new Set(['E2Eテスト用肉じゃが', '?set=で取込済みの品'])
    const excludedTitles = new Set(['削除済みの品'])
    const plan2 = planStarterReload([existingStarter], addDefs, 9000, allTitles, excludedTitles)
    eq(
      'planStarterReload: 端末に無く未削除の品だけ追加される(二重投入・復活を防ぐ)',
      plan2.toAdd.map((d) => d.title),
      ['ゼロから新規の品'],
    )
  }
}

// ---------- planFlattenedStarterTopUp(既存ユーザーへの差分投入。テーマ全廃2026-07-23) ----------
{
  const setDefs = [
    { title: '高たんぱく品A' },
    { title: '和食品B' },
    { title: '冷凍品C' },
    { title: 'ダイエット品D' },
  ]
  // 端末に既にB(自作or?set=取込済み)があり、Cは過去に削除済み(トゥームストーン)
  const existingTitles = ['肉じゃが', '和食品B']
  const exclusionTitles = ['冷凍品C']
  const toAdd = planFlattenedStarterTopUp(existingTitles, exclusionTitles, setDefs)
  eq(
    '差分投入: 端末に無く削除もされていない品だけ追加(既存品と削除品は除外)',
    toAdd.map((d) => d.title),
    ['高たんぱく品A', 'ダイエット品D'],
  )
  eq(
    '差分投入: 端末が空・削除記録も無ければ全部追加',
    planFlattenedStarterTopUp([], [], setDefs).length,
    4,
  )
  eq(
    '差分投入: 前後空白を無視して料理名照合する',
    planFlattenedStarterTopUp(['  高たんぱく品A '], [], setDefs).map((d) => d.title),
    ['和食品B', '冷凍品C', 'ダイエット品D'],
  )
}

// ---------- 全品同梱の健全性(テーマ全廃2026-07-23: 収録103品・料理名は一意) ----------
{
  eq('starterDefsは103品(基本51+旧テーマ52)', starterDefs.length, 103)
  const titles = starterDefs.map((d) => d.title.trim())
  eq('starterDefsの料理名はカタログ全体で一意', new Set(titles).size, titles.length)
  eq(
    '収録レシピ「だしのとり方」が同梱に含まれる(だし紐づけの飛び先)',
    titles.includes(DASHI_RECIPE_TITLE),
    true,
  )
}

// ---------- だし紐づけ: 材料名が「だし汁」系か判定(2026-07-23) ----------
{
  eq('だし汁はだし系', isDashiIngredientName('だし汁'), true)
  eq('だしはだし系', isDashiIngredientName('だし'), true)
  eq('和風だしはだし系', isDashiIngredientName('和風だし'), true)
  eq('かつおだしはだし系', isDashiIngredientName('かつおだし'), true)
  eq('用途の丸括弧補足付きも拾う(だし汁(つゆ用))', isDashiIngredientName('だし汁(つゆ用)'), true)
  eq('全角丸括弧の補足も拾う(だし汁（卵液用）)', isDashiIngredientName('だし汁（卵液用）'), true)
  eq('だしの素は対象外(調味料でありだし汁ではない)', isDashiIngredientName('だしの素'), false)
  eq('複合表記「水またはだし汁」は対象外(保守的)', isDashiIngredientName('水またはだし汁'), false)
  eq('無関係な材料は対象外', isDashiIngredientName('しょうゆ'), false)
}

// ---------- 栄養並び替え(2026-07-13 Fable設計: カロリー/たんぱく質(1食)。
// 2026-07-16 便T-4で塩分・脂質・糖質を追加しPro機能化。算出不能は常に末尾) ----------
{
  const mkRecipe = (id, title, ingredients, updatedAt) => ({
    id,
    title,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients,
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: updatedAt,
    updatedAt,
  })
  // 砂糖100g / 砂糖10g / 名寄せできない材料のみ(自作レシピ相当) の3件
  const rHigh = mkRecipe(1, '高カロリー', [{ name: '砂糖', amount: '100', unit: 'g' }], 100)
  const rLow = mkRecipe(2, '低カロリー', [{ name: '砂糖', amount: '10', unit: 'g' }], 200)
  const rUnknown = mkRecipe(3, '算出不能', [{ name: '謎のたべもの', amount: '適量', unit: '' }], 300)
  const values = buildNutrientSortValues([rHigh, rLow, rUnknown])
  eq('栄養並び替え値: 名寄せできないレシピはnull(算出不能・5項目とも)', values.get(3), {
    kcal: null,
    proteinG: null,
    fatG: null,
    carbG: null,
    saltG: null,
  })
  eq('栄養並び替え値: 計算できるレシピは正の数値', values.get(2).kcal > 0, true)
  eq(
    '栄養並び替え値: 1食あたり(servingsで割った値)である',
    Math.abs(values.get(1).kcal - values.get(2).kcal * 10) < 1e-6,
    true,
  )
  const results = [rUnknown, rHigh, rLow].map((recipe) => ({
    recipe,
    usedCount: 0,
    wantedCount: 0,
  }))
  eq(
    'カロリー昇順: 低→高で、算出不能は末尾',
    sortResults(results, 'kcal', [], 'asc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq(
    'カロリー降順: 高→低でも算出不能は末尾のまま',
    sortResults(results, 'kcal', [], 'desc', values).map((r) => r.recipe.id),
    [1, 2, 3],
  )
  eq(
    'たんぱく質降順: 同値(砂糖はたんぱく質ほぼ0)なら更新順(新しい順)で安定し、算出不能は末尾',
    sortResults(results, 'protein', [], 'desc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq(
    '糖質昇順: 砂糖10g<100gなので低→高、算出不能は末尾(便T-4で追加)',
    sortResults(results, 'carb', [], 'asc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq('カロリーの既定方向は昇順(低い方から)', defaultSortDirection.kcal, 'asc')
  eq('たんぱく質の既定方向は降順(多い方から)', defaultSortDirection.protein, 'desc')
  eq('糖質の既定方向は昇順(便T-4)', defaultSortDirection.carb, 'asc')
  eq('塩分の既定方向は昇順(便T-4)', defaultSortDirection.salt, 'asc')
  eq('脂質の既定方向は昇順(便T-4)', defaultSortDirection.fat, 'asc')

  // 塩(saltG高) / サラダ油(fatGのみ高)で塩分・脂質のsortResultsも検算する(便T-4)
  const rSalty = mkRecipe(4, 'しょっぱい', [{ name: '塩', amount: '100', unit: 'g' }], 400)
  const rMild = mkRecipe(5, 'うすあじ', [{ name: '塩', amount: '10', unit: 'g' }], 500)
  const rOily = mkRecipe(6, 'あぶらっこい', [{ name: 'サラダ油', amount: '100', unit: 'g' }], 600)
  const rLight = mkRecipe(7, 'あっさり', [{ name: 'サラダ油', amount: '10', unit: 'g' }], 700)
  const saltFatValues = buildNutrientSortValues([rSalty, rMild, rOily, rLight])
  const saltResults = [rMild, rSalty].map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
  eq(
    '塩分昇順: 塩10g<100gなので低→高(便T-4で追加)',
    sortResults(saltResults, 'salt', [], 'asc', saltFatValues).map((r) => r.recipe.id),
    [5, 4],
  )
  const fatResults = [rLight, rOily].map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
  eq(
    '脂質昇順: サラダ油10g<100gなので低→高(便T-4で追加)',
    sortResults(fatResults, 'fat', [], 'asc', saltFatValues).map((r) => r.recipe.id),
    [7, 6],
  )

  // 並べ替えオプションの分類(便T-4: 5項目まとめてPro機能化)
  eq('NUTRIENT_SORT_OPTIONS: 5項目(カロリー/たんぱく質/塩分/脂質/糖質)', [...NUTRIENT_SORT_OPTIONS], [
    'kcal',
    'protein',
    'salt',
    'fat',
    'carb',
  ])
  eq('isNutrientSortOption: kcalは栄養並び替え', isNutrientSortOption('kcal'), true)
  eq('isNutrientSortOption: updatedは栄養並び替えでない', isNutrientSortOption('updated'), false)
}

// ---------- 「基本レシピ順」並び替え(2026-07-17オーナー指示で「テーマごと」として新設。
// 2026-07-20 便AMで第◯弾/テーマの括りを廃止し「①基本レシピ(公式全部)→②自作レシピ」の
// 2区分に単純化。配布テーマ取り込み品(sourceSetNameあり)もisStarterのため①側にまとまる。
// 昇順は①基本レシピ(公式全部・区分内は既定順=更新順=新しい順)→②自作レシピ(既定順=新しい順)。
// 降順トグルは①②の並び自体を反転するが、既存の全並び替え共通の仕様どおり「同区分内の順序は
// 常に更新順(新しい順)を維持し方向トグルの影響を受けない」ため、単純な配列reverseとは
// 一致しない(区分間の前後だけが反転する) ----------
{
  const mkThemeRecipe = (id, title, updatedAt, extra) => ({
    id,
    title,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: updatedAt,
    updatedAt,
    ...extra,
  })
  // 基本レシピ2件(sourceSetNameなし・isStarter)・配布テーマ取り込み品3件(あいうえお×2, いろは×1。
  // いずれもsourceSetNameあり・isStarterも true=①基本レシピ側にまとまる)・自作2件
  // (sourceSetNameなし・isStarterなし=通常のユーザー登録レシピ相当・②側)
  const rOwnOld = mkThemeRecipe(1, '自作B', 100)
  const rOwnNew = mkThemeRecipe(2, '自作A', 200)
  const rBaseOld = mkThemeRecipe(3, '基本1', 50, { isStarter: true })
  const rBaseNew = mkThemeRecipe(4, '基本2', 150, { isStarter: true })
  const rThemeIroha = mkThemeRecipe(5, 'テーマい', 300, {
    isStarter: true,
    sourceSetName: 'いろは',
  })
  const rThemeAiOld = mkThemeRecipe(6, 'テーマあ古', 10, {
    isStarter: true,
    sourceSetName: 'あいうえお',
  })
  const rThemeAiNew = mkThemeRecipe(7, 'テーマあ新', 500, {
    isStarter: true,
    sourceSetName: 'あいうえお',
  })
  const themeResults = [rThemeIroha, rOwnOld, rBaseOld, rThemeAiOld, rOwnNew, rThemeAiNew, rBaseNew].map(
    (recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }),
  )
  eq('基本レシピ順の既定方向は昇順', defaultSortDirection.theme, 'asc')
  eq(
    '基本レシピ順昇順: ①基本レシピ(公式全部・sourceSetNameの有無を問わず新しい順にまとまる)→②自作(新しい順)',
    sortResults(themeResults, 'theme', []).map((r) => r.recipe.id),
    [7, 5, 4, 3, 6, 2, 1],
  )
  eq(
    '基本レシピ順降順: 区分順(自作→基本)が反転するが、区分内は常に新しい順のまま(方向トグルの影響を受けない・既存仕様どおり)',
    sortResults(themeResults, 'theme', [], 'desc').map((r) => r.recipe.id),
    [2, 1, 7, 5, 4, 3, 6],
  )
}

// ---------- 削除したセット品の再取込除外(トゥームストーン・2026-07-13 Fable設計) ----------
{
  // 削除時の記録: 配布セット由来なら(setId, title)を記録し、自作レシピは記録しない
  eq(
    '除外記録: セット由来レシピは(setId, title)を記録する',
    exclusionRecordFor({ sourceSetId: 'kintore', title: ' 漬けるだけ味玉 ' }),
    { setId: 'kintore', title: '漬けるだけ味玉' },
  )
  eq('除外記録: 自作レシピ(sourceSetIdなし)は記録しない', exclusionRecordFor({ title: '味玉' }), null)

  // 取込時の照合: 記録に一致する品はスキップ(importRecipeSetが追加直前にこの集合で判定する)
  const exclusions = [{ setId: 'kintore', title: '漬けるだけ味玉' }]
  eq(
    '取込時: 除外記録に一致する品はスキップされる',
    buildExclusionTitleSet(exclusions, 'kintore').has('漬けるだけ味玉'),
    true,
  )
  eq(
    '取込時: 別セットの同名品は除外しない(setIdまで一致した場合だけ)',
    buildExclusionTitleSet(exclusions, 'bento').has('漬けるだけ味玉'),
    false,
  )
  eq(
    '取込時: setIdの無いファイル(個人バックアップ形式)は除外対象なし',
    buildExclusionTitleSet(exclusions, undefined).size,
    0,
  )
  // 解除(「すべて戻す」で記録を消す)→再取込で復活する
  eq(
    '解除後(記録を消した後)は再取込で復活する(除外されない)',
    buildExclusionTitleSet([], 'kintore').has('漬けるだけ味玉'),
    false,
  )
}

// ---------- tablesToReplace(バックアップの全ユーザーデータ対応・2026-07-13
// データ堅牢性強化: 在庫・買い物メモ・週献立・今日の献立・食材価格マスタの復元判定)。
// undefined(=項目自体が無い古いバックアップ)と空配列[](=空にする意図)を区別できることが
// 後方互換の要(fake-indexeddb等が無い環境のためDB本体でのclear非実行はE2Eで別途担保する。
// ここでは判定ロジックそのものを純ロジックとして固定する) ----------
{
  const baseFile = { app: 'uchi-recipe', version: 1, exportedAt: '', recipes: [] }
  eq(
    '全フィールドが無い(この対応より前の古いバックアップ)場合はすべて置き換え対象外',
    tablesToReplace(baseFile),
    { pantryItems: false, shoppingItems: false, mealPlans: false, todayList: false, prices: false },
  )
  eq(
    '空配列(テーブルを空にする意図)は置き換え対象になる(undefinedとの区別)',
    tablesToReplace({ ...baseFile, pantryItems: [], prices: [] }),
    { pantryItems: true, shoppingItems: false, mealPlans: false, todayList: false, prices: true },
  )
  eq(
    '中身入りの配列も置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      mealPlans: [{ date: '2026-07-20', slot: 'dinner', recipeId: 1, role: 'main' }],
      todayList: [{ recipeId: 1, addedAt: 1000 }],
    }),
    { pantryItems: false, shoppingItems: false, mealPlans: true, todayList: true, prices: false },
  )
  eq(
    '全フィールドが有る(空配列込み)場合はすべて置き換え対象',
    tablesToReplace({
      ...baseFile,
      pantryItems: [],
      shoppingItems: [],
      mealPlans: [],
      todayList: [],
      prices: [],
    }),
    { pantryItems: true, shoppingItems: true, mealPlans: true, todayList: true, prices: true },
  )
}

// ---------- mergeUnlockCodes(バックアップ修正1・2026-07-17: merge復元でPro・追加レシピ
// パックの解錠コードを「バックアップ側にあれば設定、無ければ既存を保持」で戻す。
// オーナー実害「ブラウザデータ消去→復元しても購入状態が戻らない」の再発防止。
// 空文字列/undefinedで既存コードを上書きしない=旧形式(コード無し)バックアップの
// 後方互換の要 ----------
{
  const noCode = {
    proCode: undefined,
    proActivatedAt: undefined,
    recipePackCode: undefined,
    recipePackActivatedAt: undefined,
  }
  const withProCode = {
    proCode: 'UR-AAAA-AAAA',
    proActivatedAt: 1000,
    recipePackCode: undefined,
    recipePackActivatedAt: undefined,
  }
  const withPackCode = {
    proCode: undefined,
    proActivatedAt: undefined,
    recipePackCode: 'UP-BBBB-BBBB',
    recipePackActivatedAt: 2000,
  }

  eq(
    'コード往復: 既存コード無し+バックアップにコード有り→採用する',
    mergeUnlockCodes(noCode, withProCode),
    withProCode,
  )
  eq(
    '既存コード有り+バックアップ側が旧形式(settings自体が無い=undefined)→既存を保持(消さない)',
    mergeUnlockCodes(withProCode, undefined),
    withProCode,
  )
  eq(
    '既存コード有り+バックアップのsettingsはあるがコード欄が無い(空)→既存を消さない(空で上書きしない)',
    mergeUnlockCodes(withProCode, noCode),
    withProCode,
  )
  eq(
    '既存Pro解錠済み+バックアップに別のPro解錠コード→バックアップ側を採用する(コードがあれば設定)',
    mergeUnlockCodes(withProCode, { ...noCode, proCode: 'UR-ZZZZ-ZZZZ', proActivatedAt: 9999 }),
    { proCode: 'UR-ZZZZ-ZZZZ', proActivatedAt: 9999, recipePackCode: undefined, recipePackActivatedAt: undefined },
  )
  eq(
    'proCodeとrecipePackCodeは独立に判定される(Pro解錠済みの状態でパックだけ含む古いバックアップをmerge)',
    mergeUnlockCodes(withProCode, withPackCode),
    { proCode: 'UR-AAAA-AAAA', proActivatedAt: 1000, recipePackCode: 'UP-BBBB-BBBB', recipePackActivatedAt: 2000 },
  )
  eq(
    '両方コード無しどうし→両方とも既存(undefined)のまま・エラーにならない',
    mergeUnlockCodes(noCode, noCode),
    noCode,
  )
}

// ---------- countReplaceImpact(2026-07-17設定ゼロベース裁定#6a: 置き換え確認文の件数表示) ----------
{
  eq('退避件数: レシピ0件・記録0件・価格0件', countReplaceImpact([], 0), { recipes: 0, cookedLogs: 0, prices: 0 })
  eq(
    '退避件数: レシピ件数はそのまま・作った記録は全レシピの合算',
    countReplaceImpact(
      [{ cookedLogs: [{ date: '2026-01-01' }, { date: '2026-01-02' }] }, { cookedLogs: [] }, { cookedLogs: [{ date: '2026-01-03' }] }],
      5,
    ),
    { recipes: 3, cookedLogs: 3, prices: 5 },
  )
}

// ---------- daysSinceBackup(2026-07-17設定ゼロベース裁定#1: バックアップ状態バナー) ----------
{
  const now = Date.parse('2026-07-17T12:00:00+09:00')
  eq('経過日数: 未実施はnull', daysSinceBackup(undefined, now), null)
  eq('経過日数: 今日(同時刻)は0日前', daysSinceBackup(now, now), 0)
  eq('経過日数: 5日前', daysSinceBackup(now - 5 * 24 * 60 * 60 * 1000, now), 5)
  eq('経過日数: 31日前(要警告)', daysSinceBackup(now - 31 * 24 * 60 * 60 * 1000, now), 31)
  eq('経過日数: 23時間59分前は端数切り捨てで0日前', daysSinceBackup(now - (24 * 60 * 60 * 1000 - 60000), now), 0)
}

// ---------- fileSave(バックアップ修正2+3・2026-07-17: 保存先選択+前回に上書き) ----------
{
  eq(
    'supportsSaveFilePicker: window自体が無いNode環境ではfalse(未対応ブラウザ相当)',
    supportsSaveFilePicker(),
    false,
  )
  eq(
    'backupFileName: 日付から yyyy-mm-dd 形式のファイル名を組み立てる',
    backupFileName(new Date(2026, 6, 5)), // 月は0始まり(6=7月)
    'uchi-recipe-backup-2026-07-05.json',
  )
  eq(
    'backupFileName: 1桁の月日も0埋めする',
    backupFileName(new Date(2026, 0, 9)),
    'uchi-recipe-backup-2026-01-09.json',
  )
  eq('isAbortError: DOMExceptionでもAbortError以外はfalse', isAbortError(new DOMException('x', 'NotFoundError')), false)
  eq('isAbortError: DOMException以外(普通のError)はfalse', isAbortError(new Error('x')), false)
  eq(
    'isAbortError: name=AbortErrorのDOMExceptionはtrue(ユーザーがピッカーをキャンセルした扱い)',
    isAbortError(new DOMException('x', 'AbortError')),
    true,
  )
}

// ---------- freeLimit(本番はフラグOFF=絶対にブロックしない不変条件) ----------
eq('フラグOFF: 50件でもブロックしない', isAtFreeLimit(50, false), false)
eq('フラグOFF: 予告バナーも出ない', isNearFreeLimit(45, false), false)

// ---------- pickMainIngredients(一覧カードの主要食材=調味料・水・油・粉類・だし系・薬味少量
// の名前辞書で除外。UI改善バッチ 2026-07-11 オーナー実機フィードバック「メインをはる材料に絞って」) ----------
{
  // こんにゃくの炒り煮(review.jsonの実データ)相当: 赤唐辛子(1/2本)は数値化できてしまうため
  // 分量・単位ベースのisSeasoningLikeだけでは除外できない=名前辞書が必要なことの再発防止ケース
  const konnyaku = [
    { name: 'こんにゃく', amount: '1', unit: '枚' },
    { name: '赤唐辛子', amount: '1/2', unit: '本' },
    { name: 'ごま油', amount: '1', unit: '大さじ' },
    { name: 'しょうゆ', amount: '1.5', unit: '大さじ' },
    { name: 'みりん', amount: '1.5', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '大さじ' },
    { name: 'かつお節', amount: '1', unit: '袋' },
  ]
  eq(
    '主要食材: こんにゃくの炒り煮は赤唐辛子が出ない',
    pickMainIngredients(konnyaku).map((i) => i.name),
    ['こんにゃく'],
  )

  // 手作り鮭フレーク(review.jsonの実データ)相当: 主材料の鮭は残り、酒・塩(お好みで)は出ない
  const sakeFlake = [
    { name: '甘塩鮭（切り身）', amount: '2', unit: '切れ' },
    { name: '酒', amount: '1', unit: '大さじ' },
    { name: '塩', amount: '少々(お好みで)', unit: '' },
  ]
  eq(
    '主要食材: 鮭フレークは鮭の切り身が残る',
    pickMainIngredients(sakeFlake).map((i) => i.name),
    ['甘塩鮭（切り身）'],
  )

  // 「お好みで」は数値と同居していてもisSeasoningLikeの非数値判定をすり抜けるため、
  // 名前辞書に無い食材でも isOptionalAmount 単独で除外できることの確認
  const optional = [
    { name: '鶏むね肉', amount: '1', unit: '枚' },
    { name: 'くるみ', amount: '2(お好みで)', unit: '個' },
  ]
  eq(
    '主要食材: 数値付き「お好みで」も除外される',
    pickMainIngredients(optional).map((i) => i.name),
    ['鶏むね肉'],
  )

  // 先頭から最大3件(水増ししない・4件目以降は出ない)
  const many = [
    { name: 'じゃがいも', amount: '3', unit: '個' },
    { name: '玉ねぎ', amount: '1', unit: '個' },
    { name: '人参', amount: '1', unit: '本' },
    { name: '牛こま切れ肉', amount: '200', unit: 'g' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
  ]
  eq(
    '主要食材: 先頭から最大3件',
    pickMainIngredients(many).map((i) => i.name),
    ['じゃがいも', '玉ねぎ', '人参'],
  )
}

// ---------- normalizeIngredientChipLabel / pickDisplayIngredientChips(一覧カードの食材チップを
// スッキリさせる・2026-07-12オーナー実機フィードバック「生鮭、甘塩鮭は鮭に統一。括弧は付けない」) ----------
{
  eq('括弧書き(半角)を除去', normalizeIngredientChipLabel('さば(切り身)'), 'さば')
  eq('括弧書き(全角)を除去', normalizeIngredientChipLabel('甜麺醤（テンメンジャン）'), '甜麺醤')
  eq('括弧書き(倍率表記)を除去', normalizeIngredientChipLabel('めんつゆ(3倍濃縮)'), 'めんつゆ')
  eq('括弧が複数あってもすべて除去', normalizeIngredientChipLabel('甘塩鮭(または生鮭)(切り身)'), '鮭')
  eq('括弧が半角開き・全角閉じの混在でも除去', normalizeIngredientChipLabel('しょうが(すりおろし）'), 'しょうが')
  eq('括弧の無い名前はそのまま', normalizeIngredientChipLabel('鶏むね肉'), '鶏むね肉')
  eq('生鮭は鮭に統一', normalizeIngredientChipLabel('生鮭'), '鮭')
  eq('甘塩鮭は鮭に統一', normalizeIngredientChipLabel('甘塩鮭'), '鮭')
  eq('生鮭(切り身)も鮭に統一(括弧除去+別名統一の組み合わせ)', normalizeIngredientChipLabel('生鮭(切り身)'), '鮭')

  // 切り方の注記除去(2026-07-12オーナー実機フィードバック: チップ「豚バラ薄切り肉」→「豚バラ肉」)
  eq('薄切りを除去', normalizeIngredientChipLabel('豚バラ薄切り肉'), '豚バラ肉')
  eq('厚切りを除去', normalizeIngredientChipLabel('ベーコン厚切り'), 'ベーコン')
  eq(
    '薄切り除去後も色分け(ingredientColorToken)は肉カテゴリのまま',
    ingredientColorToken(normalizeIngredientChipLabel('豚バラ薄切り肉')),
    '--chip-food-meat',
  )

  // 同カード内で正規化後に重複したら1つにまとめる(生鮭と甘塩鮭が両方並んでも「鮭」チップは1つだけ)
  const twoSalmonKinds = [
    { name: '生鮭(切り身)', amount: '2', unit: '切れ' },
    { name: '甘塩鮭', amount: '1', unit: '切れ' },
    { name: 'じゃがいも', amount: '2', unit: '個' },
  ]
  eq(
    '重複ラベルは1チップにまとめる',
    pickDisplayIngredientChips(twoSalmonKinds).map((c) => c.name),
    ['鮭', 'じゃがいも'],
  )

  // 表示ラベルは正規化されても、色分け判定(ingredientColorToken)は従来どおり効く
  eq('正規化後の「鮭」も魚介カテゴリ', ingredientColorToken('鮭'), '--chip-food-seafood')
  eq('正規化後の「牛乳」は肉カテゴリに誤分類されない', ingredientColorToken(normalizeIngredientChipLabel('牛乳')), '--chip-neutral')
}

// ---------- searchRecipes: 「時短」絞り込み(quickStepsを持つレシピだけに絞る。
// UI改善バッチ 2026-07-11) ----------
{
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const recipes = [
    { id: 1, title: '通常のみ', tags: [], searchWords: [], ingredients: [], quickSteps: undefined },
    { id: 2, title: '時短あり', tags: [], searchWords: [], ingredients: [], quickSteps: [{ text: 'レンジで加熱する' }] },
  ]
  eq(
    '時短絞り込みOFFは全件',
    searchRecipes(recipes, baseOptions).map((r) => r.recipe.id),
    [1, 2],
  )
  eq(
    '時短絞り込みONはquickStepsありのみ',
    searchRecipes(recipes, { ...baseOptions, quickOnly: true }).map((r) => r.recipe.id),
    [2],
  )
}

// ---------- jaWrap: 文節折返し(BudouX・2026-07-11) ----------
{
  const { wrapJaPhrases, ZWSP } = await import('../src/logic/jaWrap.ts')
  const sample = '火を止めてかつお節を加えて混ぜ合わせ、器に盛る'
  const wrapped = wrapJaPhrases(sample)
  eq('ZWSPを除くと原文と一致(データ不変)', wrapped.split(ZWSP).join(''), sample)
  const segments = wrapped.split(ZWSP)
  eq('文節に分割されている(3つ以上)', segments.length >= 3, true)
  eq('句読点が文節の先頭に来ない', segments.some((s) => s.startsWith('、') || s.startsWith('。')), false)
  eq('短い文字列は素通し', wrapJaPhrases('混ぜる'), '混ぜる')
  // 2026-07-11第2版(オーナー実例): 時間トークン直後・並列「と」・格助詞では折り返さない
  const stew = wrapJaPhrases('火を止めてルーを溶かし、牛乳を加えて弱火で5分とろみを付ける').split(ZWSP)
  eq('「牛乳を」が単独文節にならない', stew.includes('牛乳を'), false)
  eq('「5分」の直後で切れない(弱火で5分とろみを付ける)', stew.includes('弱火で5分とろみを付ける'), true)
  const potato = wrapJaPhrases('湯を切って粉ふきにし、熱いうちにつぶして酢と塩こしょうを混ぜる').split(ZWSP)
  eq('「酢と」が単独文節にならない', potato.includes('酢と'), false)
  // 2026-07-12第3版: 格助詞結合の上限を10文字に絞ったため「混ぜる」は次の単位でよい。
  // オーナー指摘の本体は「酢と/塩こしょう」の分断防止(=「酢と塩こしょうを」が一体)
  eq('酢と塩こしょうがまとまる', potato.some((u) => u.startsWith('酢と塩こしょうを')), true)
  const broc = wrapJaPhrases('具材を一口大に切る。ブロッコリーは別に2分塩ゆでしておく').split(ZWSP)
  eq('「2分」の直後で切れない(別に2分塩ゆでしておく)', broc.includes('別に2分塩ゆでしておく'), true)
  eq('主題の「ブロッコリーは」では切れてよい', broc.includes('ブロッコリーは'), true)
  // 2026-07-11第3版(オーナー実例スマホ確認より)
  const arrow = wrapJaPhrases('鍋にごま油を熱し、豚肉→根菜→ちぎったこんにゃくの順に炒める。').split(ZWSP)
  // 2026-07-12第3.3版: 矢印列は「→x」の項目単位(2本目以降の→の頭で折り返せる)。
  // 本体の保証は「項目の中で切れない」こと(ちぎった|こんにゃく の分断防止)
  eq('矢印項目の中で切れない(豚汁)', arrow.some((u) => u.startsWith('→ちぎったこんにゃくの')), true)
  eq('最初の→は前の項目に密着(豚肉→根菜)', arrow.includes('豚肉→根菜'), true)
  const arrow2 = wrapJaPhrases('強火でごま油を熱し、溶き卵→すぐにご飯を入れて木べらで切るように混ぜる。').split(ZWSP)
  eq('矢印列は項目の言い切りまで一体(チャーハン)', arrow2.includes('溶き卵→すぐにご飯を入れて'), true)
  // 2026-07-15(オーナー実機・ミートボール): BudouXが「転がしながら」を「転が|しながら」と
  // 語中で誤分割し、格助詞結合で「ミートボールを転が」まで繋がって語の途中で折り返していた。
  // KNOWN_WORDSに「転がしながら」を追加して1語に戻す
  const korogashi = wrapJaPhrases(
    'フライパンにサラダ油を中火で熱し、ミートボールを転がしながら揚げ焼きにする。',
  ).split(ZWSP)
  eq('「転がしながら」が語中で切れない(BudouX誤分割対策)', korogashi.includes('転がしながら'), true)
  eq('「転が」で終わる文節が出ない', korogashi.some((u) => u.endsWith('転が')), false)
  const kakko = wrapJaPhrases('菜箸を入れて細かい泡がシュワッと出るくらい（約170度）の油で4分揚げる。').split(ZWSP)
  // 2026-07-12第3版: 「出るくらい+（約170度）の」は13文字で上限超のため旧版でも密着せず、
  // 「（約170度）の」が単独ユニットだった。第3版は「の」の格助詞結合で修飾先の
  // 「油で」と一体になる(括弧が宙に浮かない)。括弧の中で切れないことも確認
  eq('括弧が修飾先の語と一体(（約170度）の油で)', kakko.includes('（約170度）の油で'), true)
  eq('括弧の中で切れない', kakko.some((u) => u.includes('（') && !u.includes('）')), false)
  // タイマーボタン前後の結合(「中火で15分煮る」を一体化)
  const { splitAroundTimeToken } = await import('../src/logic/jaWrap.ts')
  const nagara = splitAroundTimeToken('あくを取りながら', '煮て、煮えたものから食べる。')
  eq('「取りながら」はボタン前に結合しない', nagara.bondPrev, '')
  const chuubi = splitAroundTimeToken('ごま油で野菜を中火で', '炒める。')
  eq('「中火で」はボタン前に結合する', chuubi.bondPrev, '中火で')

  const bond = splitAroundTimeToken('水としょうゆ・みりん・砂糖を入れ、落としぶたをして中火で', '煮る。')
  eq('「中火で」がボタン前に結合', bond.bondPrev, '中火で')
  eq('「煮る。」がボタン後に結合', bond.bondNext, '煮る。')
  const bond2 = splitAroundTimeToken('じゃがいもを柔らかくなるまでゆでる。ゆで上がりの', '前に、にんじんを同じ鍋に加える。')
  eq('句読点止まりの直前は結合しない仕様の確認(ゆで上がりの=5文字は結合)', bond2.bondPrev, 'ゆで上がりの')

  // ---- 2026-07-12第3版: iPad/iPhoneSE2実機のオーナー改行訂正11件の規則化 ----
  const u = (t) => wrapJaPhrases(t).split(ZWSP)
  // 句読点はセグメント中央に残っても必ず直後で切れる(鯖の味噌煮)
  const saba2 = u('煮汁で味噌を溶いて加え、とろみが付くまで5分煮からめる。')
  eq('「加え、」の直後で切れる(セグメント中央の句読点)', saba2.includes('加え、'), true)
  // 「の」「が」も格助詞結合の対象(親子丼・豆腐わかめの味噌汁・ペペロン)
  const oyako = u('小さめのフライパンにめんつゆと水を入れ、鶏肉と玉ねぎを中火で7分煮る。')
  eq('「小さめの+フライパンに」が一体', oyako.includes('小さめのフライパンに'), true)
  eq('「めんつゆと+水を入れ、」が一体', oyako.includes('めんつゆと水を入れ、'), true)
  const misoshiru = u('鍋に水とだしの素を入れて火にかける。')
  eq('「だしの素」が語中で切れない(既知語の境界修復)', misoshiru[0], '鍋に水とだしの素を')
  // 中黒の食材列挙は「・」を次項目の先頭に付けて折り返す(ペペロン)
  const pepe = u('弱火のフライパンでオリーブオイル・薄切りにんにく・種を除いた唐辛子をじっくり香りが出るまで温める。')
  eq('「弱火の+フライパンで」が一体', pepe.includes('弱火のフライパンで'), true)
  eq('「・」が行末に残らない(・は次項目の先頭)', pepe.some((s) => s.endsWith('・')), false)
  eq('「・薄切りにんにく」が項目として一体', pepe.includes('・薄切りにんにく'), true)
  eq('句をまたぐ過結合をしない(唐辛子を|じっくり)', pepe.includes('唐辛子をじっくり香りが'), false)
  // 既知語の境界修復(豚汁・ナポリタン・ポテサラ)
  const tonjiru = u('野菜は薄めのいちょう切り、ごぼうはささがきにして水にさらす。ねぎは小口切りにする。')
  eq('「いちょう切り」が語中で切れない', tonjiru.includes('薄めのいちょう切り、'), true)
  eq('「ささがき」が語中で切れない', tonjiru.includes('ささがきにして'), true)
  eq('「小口切りにする。」が一体(AUXする吸収)', tonjiru.includes('小口切りにする。'), true)
  const napoli = u('ゆで上がった麺とゆで汁を少量加え、全体を絡めて塩こしょうで調える。')
  eq('「ゆで汁」が語中で切れない', napoli.includes('麺とゆで汁を'), true)
  eq('じゃがいもが語中で切れない', u('じゃがいもを12分ほどゆでる。')[0].startsWith('じゃがいも'), true)
  // 開きっぱなしの長い括弧は直前に密着しない=括弧の前で折り返せる(ツナキャベツ丼)
  const tuna = u('キャベツをせん切りにする（レンジ600Wで1分半ほど加熱すると時短になる）。')
  eq('長い括弧の直前で折り返せる(せん切りにする|（レンジ…)', tuna.includes('キャベツをせん切りにする'), true)
  // タイマー結合の第3版: が止まりの遡り+幅ガード+「ほど」密着
  const saba2t = splitAroundTimeToken('煮汁で味噌を溶いて加え、とろみが付くまで', '煮からめる。', 2)
  eq('「とろみが付くまで」がボタン前に結合(が止まりの遡り)', saba2t.bondPrev, 'とろみが付くまで')
  const potatoT = splitAroundTimeToken('じゃがいもを柔らかくなるまで', 'ほどゆでる。ゆで上がりの', 3)
  eq('幅ガード: 前結合を解いて「ほどゆでる。」を密着', potatoT.bondPrev === '' && potatoT.bondNext === 'ほどゆでる。', true)
  const tunaT = splitAroundTimeToken('キャベツをせん切りにする（レンジ600Wで', 'ほど加熱すると時短になる）。', 3)
  eq('「ほど」はトークンに必ず密着', tunaT.bondNext.startsWith('ほど'), true)

  // ---- 2026-07-12第3.2版: 42品チェック第3陣(オーナー実機)の規則化 ----
  const mb = u('肉だねを一口大（直径3cmほど）に丸める。')
  eq('「一口大」が語中で切れない(既知語)', mb[0], '肉だねを一口大')
  const hrsm = u('ハム(またはカニカマ)を加えてあえ、器に盛る。')
  eq('短い括弧の中で折り返さない(またはカニカマ)', hrsm.some((s) => s.includes('(またはカニカマ)')), true)
  const sptl = u('途中で水が減ったら少量足すこと（空焚き防止）。')
  eq('単体の開き括弧が前の行末に残らない(こと（|空焚き)', sptl.includes('（空焚き防止）。'), true)
  // 「〜」の前後で折り返さない(2026-07-12第3.4版)
  const tilde = u('清潔な保存容器に入れ、冷蔵庫で2〜3日を目安に使い切ること。')
  eq('「〜」の直後で切れない(2〜|3日)', tilde.some((s) => s.endsWith('〜')), false)
  eq('「〜」の直前で切れない(|〜3日)', tilde.some((s) => s.startsWith('〜')), false)

  // ---- 2026-07-16 改行監査A分類(docs/32。949項目シミュレーションで副作用0件を確認済み) ----
  // A-1 KNOWN_WORDS追加: しょうゆ/ゴムべら/タイプ/せん切り(いずれも実際のレシピ文言で確認)
  const soySauce = u(
    '耐熱ボウルに玉ねぎ・牛肉・水・しょうゆ・みりん・砂糖をすべて入れて軽く混ぜ、ふんわりラップをかけて電子レンジ600Wで5分加熱する。',
  )
  eq('「しょうゆ」が語中で切れない(牛丼quickSteps)', soySauce.some((s) => s.includes('しょうゆ')), true)
  eq('「し」で終わる単独ユニットが出ない(しょうゆの誤分割なし)', soySauce.includes('・水・し'), false)
  const rubberSpatula = u('中火にかけ、木べらやゴムべらで絶えず混ぜながら加熱する。')
  eq('「ゴムべら」が語中で切れない(牛乳もちsteps)', rubberSpatula.includes('木べらやゴムべらで'), true)
  const tunaType = u(
    '水煮タイプのツナ缶と蒸し大豆を使うので、脂質を抑えながらたんぱく質がしっかり摂れる。',
  )
  eq('「タイプ」が語中で切れない(kintore onePoint)', tunaType.includes('水煮タイプのツナ缶と'), true)
  // せん切り: BudouXの生分割が前の文脈依存で不安定(docs/32記載の4パターン)なことをKNOWN_WORDS化で解消
  eq('せん切り単独でも切れない', u('せん切りにする。').includes('せん切りにする。'), true)
  eq('「大葉も」の直後でも切れない', u('大葉もせん切りにする。').includes('せん切りにする。'), true)
  eq('「大葉は」の直後でも切れない', u('大葉はせん切りにする。').includes('せん切りにする。'), true)
  eq(
    '「きゅうりは」の直後でも切れない',
    u('きゅうりはせん切りにする。').includes('せん切りにする。'),
    true,
  )
  // A-2 AUX_SHORTに漢字「見る」を追加: 「味を/見る」の泣き別れ解消(手作り鮭フレーク実文)
  const tasteCheck = u(
    'すでに塩気があるので、塩を足さずにまず味を見る（そのままで足りることが多い）。',
  )
  eq('「味を見る」が一体(見る単独ユニットが出ない)', tasteCheck.includes('見る'), false)
  eq('「塩を足さずにまず味を見る」が一体', tasteCheck.includes('塩を足さずにまず味を見る'), true)
  // A-3 「は/も」+1文字孤立ユニットの狭い吸収: 「小分けにして冷凍も可」(作り置き系11品で共通)
  const freezeOk = u('・小分けにして冷凍も可(約2〜3週間が目安)。')
  eq('「冷凍も」「可」が泣き別れしない', freezeOk.includes('冷凍も可'), true)
  eq('「冷凍も」単独ユニットが出ない', freezeOk.includes('冷凍も'), false)
  // 退行確認: 広い条件(「も」を無条件BOND_END化)で起きた「せん切り」分断がこの狭い条件では再現しない
  eq(
    '退行確認: 大葉もせん切りが分断されない(広い条件で起きた退行が狭い条件では出ない)',
    u('大葉もせん切りにする。').some((s) => s === '大葉もせん' || s.startsWith('切りに')),
    false,
  )

  // ---- 2026-07-20 便AK(オーナー実機指摘): 改行の過剰分割・短行空白の解消 ----
  // 再現例(docs/45): 「とうもろこしは/ 半分削ぎ切りに/して、/ 半分は/ ラップに/包んで/
  // 600W 3分/してから/ 5㎝幅輪切りから/ 縦に/4等分し/ます。」のように行が細切れになっていた。
  // カタログには同型の実文言がない(help/setsをgrepしても不在)ため、指示どおり同型の合成文を使う。
  const cornBefore = 'とうもろこしは半分削ぎ切りにして、半分はラップに包んで600W '
  const cornAfter = 'してから5㎝幅輪切りから縦に4等分します。'
  const corn = splitAroundTimeToken(cornBefore, cornAfter, '3分'.length)
  // 原因: 「600W」は助詞を伴わない裸の数値+単位表記のため、既存ので/に/の/が止まり限定の
  // 遡り結合(bondPrev)にひっかからず、タイマーボタン直前で単独ユニットとして取り残されていた。
  eq('「600W」がタイマーボタンに密着する(泣き別れ解消)', corn.bondPrev, '600W ')
  eq('「600W」がpre側の単独ユニットとして残らない', corn.pre.split(ZWSP).includes('600W'), false)
  eq(
    'データ不変(pre+bondPrev+トークン+bondNext+postを連結すると原文と一致)',
    corn.pre.split(ZWSP).join('') + corn.bondPrev + '3分' + corn.bondNext + corn.post.split(ZWSP).join(''),
    cornBefore + '3分' + cornAfter,
  )
  // 目標の目安(完全一致は求めない): 「半分は」「ラップに包んで」は自然な粒度のまま残ってよい
  // (格助詞なしで数値+単位が並ぶケースの個別対応であり、係助詞「は」の結合条件は今回変更していない)
  eq('「半分は」は単体のまま(過剰結合しない)', corn.pre.split(ZWSP).includes('半分は'), true)

  // ---- 2026-07-21 便P8(オーナー実機・改行第3弾): 読点終わり文節の孤児防止先読み ----
  // 再現例(bento.json「こんにゃくの炒り煮」steps[1].text): 実機スクショで
  // 「鍋にたっぷりの湯を」/「沸かし、」の短い2行に分かれ右側に不自然な空白が残っていた。
  // 原因: greedy結合が「鍋にたっぷりの(7)+湯を(2)=9字」と左に偏り、「沸かし、」(4字)が
  // 9+4=13字でどの上限にも届かず孤児化していた。
  // 対策: 結合を増やす(読点特例で上限12〜14字)案は実DOM検証で棄却(実測の1行は
  // 320pxでChromium≈11.7字/WebKit≈12.6字しかなく、13字以上のユニットは行頭で
  // overflow-wrap:anywhereが発動し「沸か|し、」と語中分断される。12字上限でも
  // 照り焼きsteps[2]が390pxで2行→3行に退行)。代わりに「湯を」の前方吸収を見送り
  // 「鍋にたっぷりの(7)|湯を沸かし、(6)」に均す先読みを実装(折返し候補を減らさない
  // ため語中分断リスクを増やさない)。
  const konnyakuTail = u('鍋にたっぷりの湯を沸かし、こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。')
  eq('先読みで「鍋にたっぷりの」に均される', konnyakuTail.includes('鍋にたっぷりの'), true)
  eq('「湯を沸かし、」が孤児にならず結合される', konnyakuTail.includes('湯を沸かし、'), true)
  eq('左に偏った「鍋にたっぷりの湯を」は作らない', konnyakuTail.includes('鍋にたっぷりの湯を'), false)
  eq(
    '13字の1ユニット(鍋にたっぷりの湯を沸かし、)は作らない(320px実測11.7字/行で語中分断するため)',
    konnyakuTail.includes('鍋にたっぷりの湯を沸かし、'),
    false,
  )
  eq(
    'ZWSPを除いた本文は不変(roundtrip)',
    konnyakuTail.join(''),
    '鍋にたっぷりの湯を沸かし、こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。',
  )

  // 先読みは「3文節の合計がMAX_UNIT(12字)超」の句だけに発動する。合計12字以内の句は
  // 狭い画面でも1行に収まりうるため現状維持が安全(実測: 照り焼きsteps[2]計11字へ
  // 発動させるとWebKit/390pxで「焼く。」が孤立し2行→3行に退行した)
  const teriyaki = u('フライパンにサラダ油を中火で熱し、鶏肉の皮目を下にして焼く。')
  eq('合計11字の句は現状維持(サラダ油を中火で)', teriyaki.includes('サラダ油を中火で'), true)
  eq('合計11字の句は現状維持(熱し、は従来どおり単独)', teriyaki.includes('熱し、'), true)
  const kurimu = u('鍋で鶏肉と野菜を炒め、水を加えて中火で15分煮る。')
  eq('合計11字の句は現状維持(鍋で鶏肉と野菜を)', kurimu.includes('鍋で鶏肉と野菜を'), true)
  eq('合計11字の句は現状維持(炒め、は従来どおり単独)', kurimu.includes('炒め、'), true)
  // 短いprev(4字未満)は見送らない(新しい孤児を作らないガード):
  // 「麺と(2)」の後の「ゆで汁を」は従来どおり前方吸収され「麺とゆで汁を」を保つ
  // (上のnapoliテストで検証済み)

  // と/や止まりのprevには発動しない(名詞列挙の途中で切らない・カレーライスsteps[1]実文言)
  const curry = u('厚手の鍋で肉と玉ねぎを炒め、残りの野菜も加えて油をなじませる。')
  eq('「肉と|玉ねぎを」の列挙分断を作らない', curry.includes('厚手の鍋で肉と玉ねぎを'), true)
  // 均しが厳密に改善しない発動はしない(もやしのナムルquickSteps[0].memo実文言:
  // 見送ると「透明感が(4)|出てしんなりすれば、(10)」と逆に偏るため現状維持)
  const moyashi = u('透明感が出てしんなりすれば、おおよそ加熱できている。')
  eq('偏りを悪化させる見送りはしない(透明感が出て)', moyashi.includes('透明感が出て'), true)
  // 先読み導入で露出したBudouX誤分割はKNOWN_WORDSで固定(2026-07-21追加分)
  const dekoboko = u('切るよりちぎった方が表面がでこぼこになり、味がよくからむ。')
  eq('「でこぼこ」が語中で切れない', dekoboko.includes('でこぼこになり、'), true)
  const torigara = u('鍋に水と鶏がらスープの素を入れて中火にかけ、煮立たせる。')
  eq('「鶏がらスープの素」が語中で切れない', torigara.includes('鶏がらスープの素を'), true)
  // 実際に均される好例: 肉じゃがquickSteps[2](タイマー数値が読点側に寄る)
  const nikujaga = u('電子レンジ600Wで6分加熱し、一度取り出して全体を混ぜる。')
  eq('「6分加熱し、」が孤児にならず結合される', nikujaga.includes('6分加熱し、'), true)
}

// ---------- termSplit: 用語タップ辞書の最長一致分割(2026-07-11) ----------
{
  const { findTermMatches, splitByTerms, collectUniqueTerms } = await import(
    '../src/logic/termSplit.ts'
  )

  // 最長一致: 「さいの目切り」は辞書のterm本体(6文字)であり、alias「さいの目」(4文字)より
  // 優先してマッチすること(短い方でマッチして「切り」が地の文に取り残されないか確認)
  const saiNoMe = findTermMatches('大根はさいの目切りにする')
  eq('最長一致でさいの目切り全体が1マッチになる', saiNoMe.length === 1 && saiNoMe[0].text, 'さいの目切り')

  // ひらがな表記ゆれ(alias)経由でもマッチする(「アク」のalias「あく」)
  const akuAlias = findTermMatches('あくを取り除く')
  eq('ひらがな表記ゆれ(あく)もアクの用語としてマッチ', akuAlias.length === 1 && akuAlias[0].term.term, 'アク')

  // 同じ語は最初の1回だけタップ可能。splitByTermsは純粋関数化(2026-07-11)されたため、
  // 本文→memoの既出共有は呼び出し側が明示的にセットへ追加して行う
  const seen = new Set()
  const inText = splitByTerms('小口切りにしてから炒める。', seen)
  for (const s of inText) if (s.type === 'term') seen.add(s.match.term.term)
  const inMemo = splitByTerms('小口切りは端から薄く切ること。', seen)
  const firstTermSeg = inText.find((s) => s.type === 'term')
  const secondTermSeg = inMemo.find((s) => s.type === 'term')
  eq('1回目の小口切りはタップ可能', firstTermSeg?.tappable, true)
  eq('2回目(memo側)の小口切りはタップ不可', secondTermSeg?.tappable, false)

  // 辞書語を含まないテキストはそのまま1つのtextセグメントで素通しする(データ改変なし)
  const plain = '特に辞書語を含まない普通の文章です'
  eq('非用語テキストは無加工で素通し', splitByTerms(plain, new Set()), [{ type: 'text', text: plain }])

  // 調理中モードのチップ欄: text+memo両方から辞書語をユニークに集める
  const uniqueTerms = collectUniqueTerms('小口切りにしたきゅうりを板ずりする。', '小口切りは飾り用。')
  eq(
    'text+memo横断でユニークな用語一覧(順序維持・重複なし)',
    uniqueTerms.map((t) => t.term),
    ['小口切り', '板ずり'],
  )
}

// ---------- 栄養概算: 少々・適量の仮定値計上(2026-07-11) ----------
{
  const { computeRecipeNutrition } = await import('../src/logic/nutrition.ts')
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
  const { matchNutritionFood, computeRecipeNutrition } = await import('../src/logic/nutrition.ts')
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

// ---------- termSplit: 純粋性(StrictMode二重実行の再発防止・2026-07-11) ----------
{
  const { splitByTerms } = await import('../src/logic/termSplit.ts')
  const text = '玉ねぎはくし形に切る。'
  const seen = new Set()
  const first = splitByTerms(text, seen)
  eq('splitByTermsは入力セットを書き換えない', seen.size, 0)
  const second = splitByTerms(text, seen)
  const tappable = (segs) => segs.filter((s) => s.type === 'term' && s.tappable).length
  eq('2回呼んでも1回目と同じ結果(二重実行安全)', tappable(second), tappable(first))
  eq('くし形がタップ可能', tappable(first) >= 1, true)
}

// ---------- ingredientColorToken: 食材カテゴリ別チップ色(2026-07-11オーナー実機フィードバック) ----------
eq('鶏もも肉は肉カテゴリ', ingredientColorToken('鶏もも肉'), '--chip-food-meat')
eq('豚バラ薄切り肉は肉カテゴリ(読み辞書変換後も一致)', ingredientColorToken('豚バラ薄切り肉'), '--chip-food-meat')
eq('牛こま切れ肉は肉カテゴリ(読み辞書変換後も一致)', ingredientColorToken('牛こま切れ肉'), '--chip-food-meat')
// 牛乳はtoHiragana()で「ぎゅうにゅう」に変換されるため、肉カテゴリの「ぎゅう」に
// 誤ヒットしないことを確認する回帰ケース(実装時に発覚した衝突)
eq('牛乳は肉カテゴリに誤分類されない', ingredientColorToken('牛乳'), '--chip-neutral')
eq('生鮭(切り身)は魚介カテゴリ(読み辞書変換後も一致)', ingredientColorToken('生鮭(切り身)'), '--chip-food-seafood')
eq('むきえびは魚介カテゴリ', ingredientColorToken('むきえび'), '--chip-food-seafood')
eq('玉ねぎは根菜カテゴリ(茶)', ingredientColorToken('玉ねぎ'), '--chip-food-root')
eq('しめじは根菜カテゴリ(きのこ)', ingredientColorToken('しめじ'), '--chip-food-root')
eq('長ねぎは野菜カテゴリ(玉ねぎと違い根菜にはしない)', ingredientColorToken('長ねぎ'), '--chip-food-vegetable')
eq('キャベツは野菜カテゴリ', ingredientColorToken('キャベツ'), '--chip-food-vegetable')
eq('豆腐はカテゴリ外でニュートラル', ingredientColorToken('豆腐'), '--chip-neutral')
// 2026-07-12深夜フィードバック: にんじん・トマト系=オレンジ/卵=黄/なす=紫の3色を追加
eq('にんじんは根菜カテゴリ(茶)ではなくオレンジに移動', ingredientColorToken('にんじん'), '--chip-food-orange')
eq('人参(漢字・読み辞書変換後)もオレンジ', ingredientColorToken('人参'), '--chip-food-orange')
eq('トマトはオレンジ', ingredientColorToken('トマト'), '--chip-food-orange')
eq('ミニトマトもオレンジ(部分一致)', ingredientColorToken('ミニトマト'), '--chip-food-orange')
eq('赤パプリカはオレンジ(色を明記した場合のみ)', ingredientColorToken('赤パプリカ'), '--chip-food-orange')
eq('パプリカ(色未指定)は迷ったら野菜カテゴリのまま(赤系のみオレンジという裁定)', ingredientColorToken('パプリカ'), '--chip-food-vegetable')
eq('黄パプリカも野菜カテゴリのまま', ingredientColorToken('黄パプリカ'), '--chip-food-vegetable')
eq('卵は黄カテゴリ(ニュートラルではなくなった)', ingredientColorToken('卵'), '--chip-food-yellow')
eq('卵黄(読み辞書変換後も一致)も黄カテゴリ', ingredientColorToken('卵黄'), '--chip-food-yellow')
eq('たまご(かな表記)も黄カテゴリ', ingredientColorToken('たまご'), '--chip-food-yellow')
eq('なすは紫カテゴリ', ingredientColorToken('なす'), '--chip-food-purple')
eq('茄子(漢字・読み辞書変換後)も紫カテゴリ', ingredientColorToken('茄子'), '--chip-food-purple')
eq('紫キャベツは紫カテゴリ(キャベツの野菜カテゴリより優先)', ingredientColorToken('紫キャベツ'), '--chip-food-purple')

// ---------- pickIconKey: 自動判定アイコンの全品スナップショット(2026-07-12 全面改修時の監査。
// 2026-07-15 アイコン分類改訂[docs/28]でpasta/vegetable/tofu新設に伴い19件を再ベースライン) ----------
// starters全品(51) + public/sets/data/*.json全品(bento/kintore/diet/summer/freezer)の
// title→期待キーを丸ごと並べる。今後の規則調整で意図せず判定が変わったらここで落ちる。
// (このテストが失敗しても即バグとは限らない。意図した変更ならこの期待表を更新すること)
const iconKeyExpected = {
  '肉じゃが': 'meat',
  'カレーライス': 'rice',
  '豆腐とわかめの味噌汁': 'soup',
  '豚の生姜焼き': 'meat',
  'ツナキャベツ丼': 'rice',
  '野菜炒め': 'vegetable', // 2026-07-15 vegetable新設(defaultだった野菜の副菜の受け皿)
  '親子丼': 'rice',
  'ハンバーグ': 'meat',
  '鶏の唐揚げ': 'chicken',
  '五目炊き込みご飯': 'rice',
  'ナポリタン': 'pasta', // 2026-07-15 pasta新設で洋麺をnoodleから切り出し
  'ペペロンチーノ': 'pasta', // 2026-07-15 pasta新設で洋麺をnoodleから切り出し
  'だし巻き卵': 'egg',
  '豚汁': 'soup',
  '寄せ鍋': 'soup',
  'チャーハン': 'rice',
  'ポテトサラダ': 'salad',
  'きんぴらごぼう': 'vegetable', // 2026-07-15 vegetable新設
  'さばの味噌煮': 'fish',
  'クリームシチュー': 'soup',
  '牛丼': 'rice',
  'ほうれん草のおひたし': 'salad',
  '麻婆豆腐': 'tofu', // 2026-07-15 tofu新設(豆腐がmeatより先に取る)
  '鮭の塩焼き': 'fish',
  '肉うどん': 'noodle', // 2026-07-12 Fable裁定: 主食(麺)が料理の類型を決めるので主食優先
  'ひじきの煮物': 'vegetable', // 2026-07-15 vegetable新設
  'もやしのナムル': 'salad',
  '白和え': 'salad',
  'コールスロー': 'salad',
  'ニラ玉': 'egg',
  '中華風卵スープ': 'soup', // 2026-07-12 Fable裁定: 「◯◯スープはsoup」
  '大学芋': 'dessert',
  'さんまの塩焼き': 'fish',
  '肉豆腐': 'tofu', // 2026-07-15 tofu新設(豆腐がmeatより先に取る)
  '鶏そぼろ丼': 'rice',
  '鮭のホイル焼き': 'fish',
  'なめこと豆腐の味噌汁': 'soup',
  'さつまいもの甘辛煮': 'vegetable', // 2026-07-15 vegetable新設
  'きゅうりとわかめの酢の物': 'salad',
  'オムライス': 'egg',
  'コンソメ野菜スープ': 'soup',
  '春雨サラダ': 'salad',
  '大根とツナのサラダ': 'salad',
  'キャベツの塩昆布あえ': 'salad',
  '蒸しなすの香味だれ': 'vegetable', // 2026-07-15 vegetable新設
  'バンバンジー': 'chicken',
  '牛乳もち': 'dessert',
  'フレンチトースト': 'bread',
  '家庭で作る杏仁豆腐': 'dessert',
  '鶏の照り焼き': 'chicken',
  '回鍋肉(ホイコーロー)': 'meat',
  'ミートボールの甘酢あん': 'meat',
  '卯の花(おからの炒り煮)': 'tofu', // 2026-07-15 tofu新設
  '切り干し大根のハリハリ漬け': 'vegetable', // 2026-07-15 vegetable新設
  '肉巻きおにぎり': 'rice',
  'れんこんのきんぴら': 'vegetable', // 2026-07-15 vegetable新設
  '高野豆腐の含め煮': 'tofu', // 2026-07-15 tofu新設
  'ちくわときゅうりの土佐酢あえ': 'salad',
  '甘辛手羽先の照り焼き': 'chicken',
  'こんにゃくの炒り煮': 'vegetable', // 2026-07-15 vegetable新設
  '手作り鮭フレーク': 'fish',
  'レンジ蒸し鶏（自家製サラダチキン）': 'chicken',
  '鶏むねのガーリック照り焼き': 'chicken',
  'ささみとブロッコリーのごま和え': 'salad',
  'サバ缶とトマトの煮込み': 'fish',
  '鶏ひき肉の豆腐ハンバーグ': 'tofu', // 2026-07-15 tofu新設。オーナー可逆判断(docs/28): chicken希望ならexclude追加で戻せる
  '漬けるだけ味玉': 'egg',
  'オートミール卵雑炊': 'rice',
  'エビとブロッコリーの卵炒め': 'fish',
  '鶏団子スープ': 'soup',
  'ツナと蒸し大豆の香味サラダ': 'salad',
  '鶏もも肉のタンドリー風': 'chicken',
  '豚肉のケチャップ炒め': 'meat',
  '鮭のハーブレモン焼き': 'fish',
  '鶏むね肉のオイスター炒め': 'chicken',
  '牛肉のプルコギ風': 'meat',
  '鶏もも肉のガーリックハーブ焼き': 'chicken',
  'えびのガーリックオイル炒め': 'fish',
  '豚肉の甜麺醤炒め': 'meat',
  '鶏むね肉のレモンペッパー炒め': 'chicken',
  '鮭の西京みそ漬け': 'fish',
  'さわらの西京焼き': 'fish',
  '豆腐ときのこの和風あんかけ': 'tofu', // 2026-07-15 tofu新設
  '鶏ささみの梅しそレンジ蒸し': 'chicken',
  'しらたきのチャプチェ風': 'noodle',
  'きのこの和風マリネ': 'salad',
  '白菜と豚しゃぶのレンジ蒸し': 'meat',
  '豆腐グラタン': 'tofu', // 2026-07-15 tofu新設
  'フルーツヨーグルトバーク': 'dessert',
  'たらの香味レンジ蒸し': 'fish',
  'よだれ鶏': 'chicken',
  '豆乳担々スープ': 'soup',
  '冷やし茶碗蒸し': 'egg',
  '梅しそ冷奴': 'tofu', // 2026-07-15 tofu新設
  'えびと薬味の香味だれそうめん': 'noodle', // 2026-07-12 Fable裁定: 主食(麺)が料理の類型を決めるので主食優先
  '冷しゃぶサラダ': 'salad',
  '冷や汁': 'soup',
  '冷やしトマトの浅漬け': 'salad',
  'オクラと長芋の梅肉あえ': 'salad',
  'ゴーヤチャンプルー': 'vegetable', // 2026-07-15 vegetable新設
  '梅おろしぶっかけうどん': 'noodle',
  '水ようかん': 'dessert',
  'だしのとり方': 'soup',
}

{
  // 収録全103品(基本+旧テーマ由来)はstarterDefsが連結済み。旧public/sets/data/*.jsonは
  // テーマ全廃(2026-07-23)で撤去したため読まない(starterDefsだけで全品を網羅する)
  const iconEntries = []
  for (const def of starterDefs) {
    iconEntries.push({ source: 'starters.ts', recipe: def })
  }

  const seenTitles = new Set()
  for (const { source, recipe } of iconEntries) {
    seenTitles.add(recipe.title)
    const expected = iconKeyExpected[recipe.title]
    if (expected === undefined) {
      failures.push(`pickIconKey期待表に無いタイトル(${source}): ${recipe.title}`)
      continue
    }
    eq(`アイコン自動判定[${source}]: ${recipe.title}`, recipe.iconKey ?? pickIconKey(recipe), expected)
  }
  eq('アイコン期待表の品数は全品数と一致', Object.keys(iconKeyExpected).length, iconEntries.length)
  eq('アイコン期待表に無い余剰キーは無い', Object.keys(iconKeyExpected).every((t) => seenTitles.has(t)), true)

  // 2026-07-15 アイコン分類改訂(docs/28): カタログ全品でpickIconKeyがdefaultに
  // 落ちるものが無いこと(誤爆防止の核=たんぱく源が野菜の調理法語より先に取ること)。
  const defaultCount = iconEntries.filter(({ recipe }) => pickIconKey(recipe) === 'default').length
  eq('カタログ全品でpickIconKeyがdefaultになるものは0件', defaultCount, 0)
}

// ---------- guessDishType: 役割の自動判定(2026-07-23 便BH-1・docs/56 §3-2) ----------
{
  // (a) guessDishType は pickIconKey の結果を役割へ写像するだけ。全カタログ103品で、期待アイコン
  //     (iconKeyExpected)から導いた役割と一致することを確認する(docs/56の63/71一致検証を流用)。
  const iconToRole = (icon) => {
    switch (icon) {
      case 'soup': return 'soup'
      case 'salad': case 'vegetable': return 'side'
      case 'dessert': case 'drink': case 'bread': return 'dessert'
      default: return 'main' // fish/egg/tofu/chicken/meat/rice/pasta/noodle/default はすべて主菜
    }
  }
  for (const def of starterDefs) {
    const expectedIcon = iconKeyExpected[def.title]
    if (expectedIcon === undefined) continue
    eq(`guessDishType[${def.title}]`, guessDishType(def), iconToRole(expectedIcon))
  }

  // (b) 代表ケースの固定(docs/56 §4-1)。既知の限界(卵の小鉢→main)も含めて挙動を明示する。
  eq('guessDishType: 野菜炒め→side(野菜が主役)', guessDishType({ title: '野菜炒め', tags: [], ingredients: [{ name: 'キャベツ' }] }), 'side')
  eq('guessDishType: 親子丼→main(主食)', guessDishType({ title: '親子丼', tags: [], ingredients: [{ name: '鶏もも肉' }] }), 'main')
  eq('guessDishType: 味噌汁→soup', guessDishType({ title: '豆腐とわかめの味噌汁', tags: [], ingredients: [{ name: '豆腐' }] }), 'soup')
  eq('guessDishType: ポテトサラダ→side', guessDishType({ title: 'ポテトサラダ', tags: [], ingredients: [{ name: 'じゃがいも' }] }), 'side')
  eq('guessDishType: 大学芋→dessert(その他)', guessDishType({ title: '大学芋', tags: [], ingredients: [{ name: 'さつまいも' }] }), 'dessert')
  eq('guessDishType: さばの味噌煮→main(魚)', guessDishType({ title: 'さばの味噌煮', tags: [], ingredients: [{ name: 'さば' }] }), 'main')
  eq('guessDishType: だし巻き卵→main(既知の限界:卵→main。データ側は裁定でside)', guessDishType({ title: 'だし巻き卵', tags: [], ingredients: [{ name: '卵' }] }), 'main')
  eq('guessDishType: 該当語なし→main(default)', guessDishType({ title: 'なぞの料理', tags: [], ingredients: [{ name: 'なにか' }] }), 'main')

  // (c) オーナー裁定8品の同梱データ(dishType)ピン留め(2026-07-23確定・docs/56 §2-3)。
  const byTitle = new Map(starterDefs.map((d) => [d.title, d]))
  const rulings = [
    ['野菜炒め', 'side'],
    ['だし巻き卵', 'side'],
    ['漬けるだけ味玉', 'side'],
    ['卯の花(おからの炒り煮)', 'side'],
    ['高野豆腐の含め煮', 'side'],
    ['寄せ鍋', 'main'],
    ['クリームシチュー', 'main'],
    ['手作り鮭フレーク', 'dessert'],
  ]
  for (const [title, expected] of rulings) {
    eq(`dishType裁定ピン留め: ${title}`, byTitle.get(title)?.dishType, expected)
  }
  // ジャンルタグ欠落品への付与(docs/56 §2-3 B)
  eq('野菜炒めに中華タグを付与', byTitle.get('野菜炒め')?.tags.includes('中華'), true)
  eq('レンジ蒸し鶏に和食タグを付与', byTitle.get('レンジ蒸し鶏（自家製サラダチキン）')?.tags.includes('和食'), true)

  // (d) isOneDish: 一品もの(丼・麺・鍋・カレー・シチュー)判定(docs/56 §3-8)
  eq('isOneDish: 寄せ鍋(鍋タグ)', isOneDish(byTitle.get('寄せ鍋')), true)
  eq('isOneDish: クリームシチュー(タイトル語・鍋/ご飯ものタグ無し)', isOneDish(byTitle.get('クリームシチュー')), true)
  eq('isOneDish: カレーライス(ご飯もの)', isOneDish(byTitle.get('カレーライス')), true)
  eq('isOneDish: 肉うどん(麺)', isOneDish(byTitle.get('肉うどん')), true)
  eq('isOneDish: 冷や汁(ご飯もの)', isOneDish(byTitle.get('冷や汁')), true)
  eq('isOneDish: 肉じゃが(該当なし)', isOneDish(byTitle.get('肉じゃが')), false)
  eq('isOneDish: 野菜炒め(該当なし)', isOneDish(byTitle.get('野菜炒め')), false)
  eq('isOneDish: だし巻き卵(該当なし)', isOneDish(byTitle.get('だし巻き卵')), false)
}

// ---------- 三つ葉/みつばの名寄せ統合(2026-07-23 便BH-1) ----------
{
  const mitsuba = PRICE_DEFAULTS.filter((d) => d.name === '三つ葉' || d.name === 'みつば')
  eq('三つ葉/みつばはPRICE_DEFAULTSに1件だけ(二重登録の解消)', mitsuba.length, 1)
  eq('統合先の名前はみつば', mitsuba[0]?.name, 'みつば')
  eq('統合先の価格は100円(docs/49の出典側)', mitsuba[0]?.pricePerUnit, 100)
  eq('統合先の単位は1束', mitsuba[0]?.unit, '1束')
  const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  eq('材料「三つ葉(または刻みのり)」が価格解決する(旧表記のエイリアス)', matchPriceEntry('三つ葉(または刻みのり)', idx)?.pricePerUnit, 100)
  eq('材料「みつば(または小ねぎ)」が価格解決する', matchPriceEntry('みつば(または小ねぎ)', idx)?.pricePerUnit, 100)
  eq('三つ葉とみつばは同じ価格エントリに解決する', matchPriceEntry('三つ葉', idx)?.pricePerUnit, matchPriceEntry('みつば', idx)?.pricePerUnit)
}

// ---------- pickIconKey: 将来入力の代表ケース(2026-07-15 アイコン分類改訂・docs/28 §5) ----------
// タイトルのみ(タグ・材料は空)で判定させ、新優先順位表(rice→pasta→noodle→dessert→drink→
// fish→soup→egg→salad→tofu→chicken→meat→bread→vegetable)が意図どおり機能するかを確認する。
// 1つでも外れたら優先順位表の語順・exclude・段の位置をdocs/28と突き合わせて直すこと。
const futureIconCases = [
  ['肉野菜炒め', 'meat'],
  ['野菜炒め', 'vegetable'],
  ['カレーうどん', 'noodle'],
  ['マカロニサラダ', 'salad'],
  ['スパゲッティサラダ', 'salad'],
  ['杏仁豆腐', 'dessert'],
  ['茶碗蒸し', 'egg'],
  ['蒸しパン', 'bread'],
  ['焼きそば', 'noodle'],
  ['冷やし中華', 'noodle'],
  ['そうめん', 'noodle'],
  ['ナポリタン', 'pasta'],
  ['ペペロンチーノ', 'pasta'],
  ['カルボナーラ', 'pasta'],
  ['麻婆豆腐', 'tofu'],
  ['豆腐グラタン', 'tofu'],
  ['冷奴', 'tofu'],
  ['厚揚げの煮物', 'tofu'],
  ['ゴーヤチャンプルー', 'vegetable'],
  ['こんにゃくの炒り煮', 'vegetable'],
  ['きんぴられんこん', 'vegetable'],
  ['肉うどん', 'noodle'],
  ['さばの味噌煮', 'fish'],
  ['鶏の唐揚げ', 'chicken'],
  ['肉じゃが', 'meat'],
  // M-1(2026-07-16 Fable品質監査再発防止): drinkワードを含んでいても煮込み・肉料理は
  // drinkに誤爆しない(exclude: ['煮','豚','鍋'])
  ['紅茶豚', 'meat'],
  ['豚肉の紅茶煮', 'meat'],
  ['手羽元のオレンジジュース煮', 'chicken'],
]
for (const [title, expected] of futureIconCases) {
  eq(`pickIconKey将来入力: ${title}`, pickIconKey({ title, tags: [], ingredients: [] }), expected)
}

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
    { yen: 390, source: 'user' },
  )
  eq(
    'estimateIngredientYen 個数系も按分(2個/1個あたり50円→100円)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '2', unit: '個' }, index),
    { yen: 100, source: 'user' },
  )
  eq(
    'estimateIngredientYen 非数値の分量(少々)はマスタの金額をそのまま使う',
    estimateIngredientYen({ name: '鶏もも肉', amount: '少々', unit: 'g' }, index),
    { yen: 130, source: 'user' },
  )
  eq(
    'estimateIngredientYen 単位が噛み合わない場合はマスタの金額をそのまま使う',
    estimateIngredientYen({ name: '玉ねぎ', amount: '200', unit: 'g' }, index),
    { yen: 50, source: 'user' },
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
    { totalYen: 390, perServingYen: 98 },
  )
  eq(
    'estimateIngredientRowCost 個別入力(ing.price)はマスタより優先される',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個', price: 80 }, index, 2),
    { totalYen: 80, perServingYen: 40 },
  )
  eq(
    'estimateIngredientRowCost 四捨五入で1円未満(0.5円未満)は0円(呼び出し側が「1円未満」表示する契機)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '2', unit: '個' }, index, 250),
    { totalYen: 100, perServingYen: 0 }, // 100÷250=0.4→0
  )
  eq(
    'estimateIngredientRowCost 0.5円ちょうどは四捨五入で1円(境界値)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個' }, index, 100),
    { totalYen: 50, perServingYen: 1 }, // 50÷100=0.5→1
  )
  eq(
    'estimateIngredientRowCost マスタにも個別入力にも無い材料はundefined',
    estimateIngredientRowCost({ name: '謎の食材', amount: '1', unit: '個' }, index, 2),
    undefined,
  )
  eq(
    'estimateIngredientRowCost servings=0はtotalYenをそのまま返す(0除算回避)',
    estimateIngredientRowCost({ name: '玉ねぎ', amount: '1', unit: '個' }, index, 0),
    { totalYen: 50, perServingYen: 50 },
  )

  // sumMealPlanEntriesCost(2026-07-17 便AB・docs/35 §5「期間の食費」): 週の概算食費と
  // 期間の食費が共通で使う、mealPlansエントリ群の合算ロジック
  {
    const recipeById = new Map([
      [1, { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }], // マスタ一致50円
      [2, { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }] }], // マスタ按分260円
      [3, { ingredients: [{ name: '謎の食材', amount: '1', unit: '個' }] }], // 計算対象外(0円)
    ])
    eq(
      'sumMealPlanEntriesCost: 複数エントリ(同じレシピの重複含む)を合算する',
      sumMealPlanEntriesCost(
        [{ recipeId: 1 }, { recipeId: 2 }, { recipeId: 1 }],
        recipeById,
        index,
      ),
      { total: 50 + 260 + 50, fromMasterCount: 3 },
    )
    eq(
      'sumMealPlanEntriesCost: 価格情報のないレシピは0円扱いで合計に影響しない',
      sumMealPlanEntriesCost([{ recipeId: 3 }], recipeById, index),
      { total: 0, fromMasterCount: 0 },
    )
    eq(
      'sumMealPlanEntriesCost: recipeByIdに無いエントリ(削除済みレシピ等の孤児行)はスキップする',
      sumMealPlanEntriesCost([{ recipeId: 999 }, { recipeId: 1 }], recipeById, index),
      { total: 50, fromMasterCount: 1 },
    )
    eq('sumMealPlanEntriesCost: エントリ0件は0円', sumMealPlanEntriesCost([], recipeById, index), {
      total: 0,
      fromMasterCount: 0,
    })
  }

  // 由来種別(default/user)の出し分け(2026-07-13 UIペルソナQA: 詳細の価格注記「目安」表記の分岐に使う)
  const sourceIndex = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個', isDefault: true },
    { name: 'にんじん', pricePerUnit: 40, unit: '1本', isDefault: false },
  ])
  eq(
    '由来種別: マスタ行が投入時の目安のままならsource=default',
    estimateIngredientYen({ name: '玉ねぎ', amount: '1', unit: '個' }, sourceIndex),
    { yen: 50, source: 'default' },
  )
  eq(
    '由来種別: ユーザーが上書きした価格ならsource=user',
    estimateIngredientYen({ name: 'にんじん', amount: '1', unit: '本' }, sourceIndex),
    { yen: 40, source: 'user' },
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
    { yen: 600, source: 'user' },
  )

  // しょうゆ: マスタ15円/大さじ1 × レシピ「小さじ1」→ 大さじ=小さじ3で体積換算(15÷3=5円)
  const soySauceIndex = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 15, unit: '大さじ1' }])
  eq(
    'estimateIngredientYen 大さじ/小さじ混在でも按分できる(15円/大さじ1×小さじ1→5円)',
    estimateIngredientYen({ name: 'しょうゆ', amount: '1', unit: '小さじ' }, soySauceIndex),
    { yen: 5, source: 'user' },
  )

  // 牛乳: マスタ200円/1L × レシピ「200 ml」→ L→ml換算で按分(200/1000*200=40円)
  const milkIndex = buildPriceIndex([{ name: '牛乳', pricePerUnit: 200, unit: '1L' }])
  eq(
    'estimateIngredientYen L/ml混在でも按分できる(200円/1L×200ml→40円)',
    estimateIngredientYen({ name: '牛乳', amount: '200', unit: 'ml' }, milkIndex),
    { yen: 40, source: 'user' },
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
      { yen: 6, source: 'user' },
    )
    eq(
      '1Lボトル按分: 2人分レシピの1食あたり(6円÷2=3円。オーナー指示の検証ケース)',
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, soySauceBottleIndex, 2),
      { totalYen: 6, perServingYen: 3 },
    )
  }

  // 同じ1Lボトル(400円)の登録表記ゆれ(「1000ml」「1L」「1L」小文字「1リットル」)が
  // すべて同じ結果(大さじ1→2人分1食あたり3円)になることを確認する(オーナー指示: 表記ゆれ受理確認)
  for (const unitText of ['1000ml', '1L', '1l', '1リットル']) {
    const idx = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 400, unit: unitText }])
    eq(
      `1Lボトル登録表記ゆれ「${unitText}」でも大さじ1×2人分=3円になる`,
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, idx, 2),
      { totalYen: 6, perServingYen: 3 },
    )
  }
  // 500mlボトル(半量・半額の200円)でも単価は同じなので同じ結果になることを確認
  {
    const halfBottleIndex = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 200, unit: '500ml' }])
    eq(
      '500mlボトル(200円)でも単価が同じなら大さじ1×2人分=3円になる',
      estimateIngredientRowCost({ name: 'しょうゆ', amount: '1', unit: '大さじ' }, halfBottleIndex, 2),
      { totalYen: 6, perServingYen: 3 },
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
      { yen: 60, source: 'user' },
    )
    const soySauceBottleIndex2 = buildPriceIndex([{ name: 'しょうゆ', pricePerUnit: 400, unit: '1000ml' }])
    eq(
      '略記按分: しょうゆ「小1」(1000ml400円×小さじ1(5ml)=2円)',
      estimateIngredientYen({ name: 'しょうゆ', amount: '小1', unit: '' }, soySauceBottleIndex2),
      { yen: 2, source: 'user' },
    )
    // 分数「小1/2」の解決確認(体積↔体積の同じ次元同士。大さじ換算のマスタで按分)。
    // 塩は通常g登録が多いが、按分ロジック自体(質量↔質量・体積↔体積のみ按分可=docs/48の既存仕様)の
    // 確認が目的のため、大さじ登録のマスタで揃える(g登録だと次元不一致でフォールバックし、
    // 分数解決自体の確認にならない)
    const saltIndex = buildPriceIndex([{ name: '塩', pricePerUnit: 30, unit: '大さじ1' }])
    eq(
      '略記按分: 塩「小1/2」(大さじ1=30円→小さじ0.5(2.5ml/15ml)=5円)',
      estimateIngredientYen({ name: '塩', amount: '小1/2', unit: '' }, saltIndex),
      { yen: 5, source: 'user' },
    )
    // 単位欄が入力済みなら略記解釈しない(従来どおり単位不一致でマスタ価格そのまま)
    eq(
      '略記按分: 単位欄が入力済みの「大2」は略記解釈せずフォールバック(マスタ価格そのまま)',
      estimateIngredientYen({ name: 'オリーブオイル', amount: '大2', unit: '個' }, oilIndex),
      { yen: 30, source: 'user' },
    )
  }

  // 玉ねぎ: マスタ50円/1個 × レシピ「2 個」→ count同一単位で按分(既存の按分の回帰確認)
  const onionIndex = buildPriceIndex([{ name: '玉ねぎ', pricePerUnit: 50, unit: '1個' }])
  eq(
    'estimateIngredientYen 個数系(同一単位)は按分が回帰しない(50円/1個×2個→100円)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '2', unit: '個' }, onionIndex),
    { yen: 100, source: 'user' },
  )
  // 個数不一致(個 vs 本): 単位名が違うので換算せずフォールバック(マスタ価格そのまま)
  eq(
    'estimateIngredientYen 個数系は単位名が違うと按分せずフォールバック(50円/1個×1本→50円のまま)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '1', unit: '本' }, onionIndex),
    { yen: 50, source: 'user' },
  )
  // 解釈不能(少々): 従来どおりマスタ価格そのままのフォールバック
  eq(
    'estimateIngredientYen 解釈不能な分量(少々)は従来どおりフォールバック',
    estimateIngredientYen({ name: '玉ねぎ', amount: '少々', unit: '個' }, onionIndex),
    { yen: 50, source: 'user' },
  )

  // 既存の同一単位(100g×200g等)の按分が回帰しないこと(質量side・従来からの主要ケース)
  const chickenIndex = buildPriceIndex([{ name: '鶏もも肉', pricePerUnit: 130, unit: '100g' }])
  eq(
    'estimateIngredientYen 既存の同一単位(g×g)の按分は回帰しない(130円/100g×300g→390円)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '300', unit: 'g' }, chickenIndex),
    { yen: 390, source: 'user' },
  )
  // 2026-07-21全角対応: 分量・単位が全角(「３００」「ｇ」)でも半角と同じ按分結果になること
  eq(
    'estimateIngredientYen 全角「３００ｇ」でも半角「300g」と同じ按分結果(130円/100g×300g→390円)',
    estimateIngredientYen({ name: '鶏もも肉', amount: '３００', unit: 'ｇ' }, chickenIndex),
    { yen: 390, source: 'user' },
  )

  // 後方互換: mass/volume/countの対応表に無い単位(「1杯」等)でも、文字列として完全一致するなら
  // 従来どおり按分する(既存の"完全一致で按分"を正規化が包含するための保険。実データ:
  // public/sets/data/review8.jsonの「冷や汁」がご飯2杯を使う)
  const riceIndex = buildPriceIndex([{ name: 'ご飯', pricePerUnit: 30, unit: '1杯' }])
  eq(
    'estimateIngredientYen 対応表に無い単位でも文字列完全一致なら按分(従来互換。30円/1杯×2杯→60円)',
    estimateIngredientYen({ name: 'ご飯', amount: '2', unit: '杯' }, riceIndex),
    { yen: 60, source: 'user' },
  )
  // マスタが「単位+数量」書式(例:大さじ1)でも、末尾の数量を正しく解釈できること
  const misoIndex = buildPriceIndex([{ name: 'みそ', pricePerUnit: 15, unit: '大さじ1' }])
  eq(
    'estimateIngredientYen マスタが「単位+数量」書式(大さじ1)でも按分できる(15円/大さじ1×大さじ2→30円)',
    estimateIngredientYen({ name: 'みそ', amount: '2', unit: '大さじ' }, misoIndex),
    { yen: 30, source: 'user' },
  )
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
  const { missingDefaults } = await import('../src/db/prices.ts')
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

// ---------- toSpeechText: 調理中モード読み上げの用語辞書reading適用(docs/20 §2・2026-07-12) ----------
{
  const { toSpeechText } = await import('../src/logic/toSpeechText.ts')

  eq(
    '誤読しやすい語(粉ふき→こなふき)がreadingで置換される',
    toSpeechText('粉ふきいもにする。'),
    'こなふきいもにする。',
  )
  eq('小口切り→こぐちぎり', toSpeechText('小口切りにする。'), 'こぐちぎりにする。')
  eq(
    '最長一致: さいの目切りは全体がreadingに置換される(短いalias「さいの目」止まりで「切り」が残らない)',
    toSpeechText('大根はさいの目切りにする。'),
    '大根はさいのめぎりにする。',
  )
  eq(
    '1文に複数の辞書語があれば両方置換される',
    toSpeechText('小口切りにして塩もみする。'),
    'こぐちぎりにしてしおもみする。',
  )
  eq(
    'readingが未設定の語(ガク)はそのまま素通し(表示同様、読みに迷いが無い語は無変換でよい)',
    toSpeechText('ガクを切り落とす。'),
    'ガクを切り落とす。',
  )
  eq('食材名の辞書収載語も読みへ変換(甜麺醤=2026-07-12にFableが辞書へ追加)', toSpeechText('甜麺醤を加える。'), 'テンメンジャンを加える。')
  eq('辞書語を含まないテキストは無加工で返る', toSpeechText('よく混ぜ合わせる。'), 'よく混ぜ合わせる。')
}

// ---------- 材料名の下線マッチ(docs/20 §7・手順本文中の材料名に控えめな下線・2026-07-12) ----------
{
  const { buildIngredientNames, findIngredientMatches } = await import(
    '../src/logic/ingredientSpans.ts'
  )
  const { splitByTerms } = await import('../src/logic/termSplit.ts')

  // 括弧除去(表示チップと同じ正規化)・重複除去・長さ降順で名前一覧を作る
  // (鶏もも肉は肉の部位パターンで別名「鶏肉」も追加登録される。v2・2026-07-12)
  eq(
    '材料名は括弧除去・重複除去して長さ降順(生鮭/甘塩鮭はどちらも鮭で1件に・鶏もも肉は鶏肉も別名登録)',
    buildIngredientNames([
      { name: '玉ねぎ（みじん切り）' },
      { name: '鶏もも肉' },
      { name: '生鮭' },
      { name: '甘塩鮭' },
    ]),
    ['鶏もも肉', '玉ねぎ', '鶏肉', '鮭'],
  )

  // 最長一致: 「玉」と「玉ねぎ」の両方が材料でも、その位置で最も長い「玉ねぎ」を採る
  const names = buildIngredientNames([{ name: '玉' }, { name: '玉ねぎ' }])
  eq(
    '最長一致で玉ねぎ全体を1マッチにする(玉で分断しない)',
    findIngredientMatches('玉ねぎを切る', names),
    [{ text: '玉ねぎ', start: 0, end: 3 }],
  )

  // 括弧書きの材料でも、正規化後の名前で手順本文にマッチする
  eq(
    '括弧書きの材料(玉ねぎ(1/2個))も正規化後の玉ねぎで手順にマッチ',
    findIngredientMatches('玉ねぎを加える', buildIngredientNames([{ name: '玉ねぎ(1/2個)' }])).map(
      (m) => m.text,
    ),
    ['玉ねぎ'],
  )

  // v2(2026-07-12・オーナー実機iPhoneSE2フィードバック): 肉の部位パターンで別名「豚肉」を
  // 登録するため、材料「豚ロース薄切り肉」でも手順の「豚肉」を拾えるようになった
  eq(
    '肉の部位別名: 豚ロース薄切り肉は手順の豚肉も拾う',
    findIngredientMatches('豚肉を炒める', buildIngredientNames([{ name: '豚ロース薄切り肉' }])).map(
      (m) => m.text,
    ),
    ['豚肉'],
  )
  // 最長一致は維持: 本文に材料名そのもの(豚こま切れ肉)があれば別名(豚肉)ではなくそちらを採る
  eq(
    '最長一致優先: 本文に材料名そのものがあれば別名より長い方を採る',
    findIngredientMatches(
      '豚こま切れ肉を炒める',
      buildIngredientNames([{ name: '豚こま切れ肉' }]),
    ).map((m) => m.text),
    ['豚こま切れ肉'],
  )

  // 同じ材料が2回出たら2箇所とも(重なりを作らずに)マッチする
  eq(
    '同一材料の複数出現は非重複で全てマッチ',
    findIngredientMatches('玉ねぎと玉ねぎを', buildIngredientNames([{ name: '玉ねぎ' }])).map(
      (m) => m.start,
    ),
    [0, 4],
  )

  // 用語との重なり優先: 材料下線はTermTextが用語スパンを切り出した後の「地の文」だけに掛かる。
  // 「玉ねぎを小口切りにする」→ 用語「小口切り」は別レイヤーが処理し、材料は地の文の玉ねぎだけ。
  const overlapNames = buildIngredientNames([{ name: '玉ねぎ' }])
  const overlapHits = splitByTerms('玉ねぎを小口切りにする', new Set())
    .filter((s) => s.type === 'text')
    .flatMap((s) => findIngredientMatches(s.text, overlapNames).map((m) => m.text))
  eq('用語スパンを除いた地の文だけで材料名がマッチ(小口切りは用語優先)', overlapHits, ['玉ねぎ'])

  // 材料名が用語スパンをまたぐ場合は拾わない(用語が先に切り出され、材料は残り断片しか見ないため)
  const straddleNames = buildIngredientNames([{ name: 'ねぎ小口' }])
  const straddleHits = splitByTerms('長ねぎ小口切りにする', new Set())
    .filter((s) => s.type === 'text')
    .flatMap((s) => findIngredientMatches(s.text, straddleNames).map((m) => m.text))
  eq('用語をまたぐ材料名は地の文に無いので拾わない', straddleHits, [])

  // ---- v2-1: 誤検出防止(複合語の内部では下線を付けない。オーナー実機報告) ----
  const eggNames = buildIngredientNames([{ name: '卵' }])
  eq(
    '「卵液を注ぐ」は卵液の卵にマッチしない(除外規則)',
    findIngredientMatches('卵液を注ぐ', eggNames),
    [],
  )
  eq('「卵黄」も除外(次の文字ブロックリスト)', findIngredientMatches('卵黄を溶く', eggNames), [])
  eq('「卵白」も除外(次の文字ブロックリスト)', findIngredientMatches('卵白を泡立てる', eggNames), [])
  eq(
    '「卵を割る」は通常どおりマッチする(除外規則は複合語限定)',
    findIngredientMatches('卵を割る', eggNames).map((m) => m.text),
    ['卵'],
  )
  eq(
    '「卵焼き器」は卵にマッチしない(単語ブロックリスト)',
    findIngredientMatches('卵焼き器を用意する', eggNames),
    [],
  )
  eq(
    '卵焼き器のあとに続く卵は通常どおりマッチする(ブロックリストは該当単語だけ)',
    findIngredientMatches('卵焼き器で卵を焼く', eggNames).map((m) => m.text),
    ['卵'],
  )

  // ---- v2-2: 検出漏れ対策(修飾接頭語を剥がした別名。オーナー実機報告) ----
  eq(
    '別名導出: むきえび→えびも手順で拾う',
    findIngredientMatches('えびの背わたを取る', buildIngredientNames([{ name: 'むきえび' }])).map(
      (m) => m.text,
    ),
    ['えび'],
  )
  eq(
    '別名導出: 干ししいたけ→しいたけも手順で拾う',
    findIngredientMatches(
      'しいたけを戻して薄切りにする',
      buildIngredientNames([{ name: '干ししいたけ' }]),
    ).map((m) => m.text),
    ['しいたけ'],
  )
  eq(
    '別名導出: 木綿豆腐→豆腐も手順で拾う',
    findIngredientMatches('豆腐を手でくずす', buildIngredientNames([{ name: '木綿豆腐' }])).map(
      (m) => m.text,
    ),
    ['豆腐'],
  )
  eq(
    '最長一致優先: 本文に「木綿豆腐」があれば別名「豆腐」ではなくそちらを1マッチで採る',
    findIngredientMatches('木綿豆腐を手でくずす', buildIngredientNames([{ name: '木綿豆腐' }])).map(
      (m) => m.text,
    ),
    ['木綿豆腐'],
  )

  // ---- v2-3: 検出漏れ対策(肉の部位パターン。オーナー実機報告) ----
  eq(
    '肉の部位別名: 豚バラ薄切り肉→豚肉',
    findIngredientMatches('豚肉を炒める', buildIngredientNames([{ name: '豚バラ薄切り肉' }])).map(
      (m) => m.text,
    ),
    ['豚肉'],
  )
  eq(
    '肉の部位別名: 豚こま切れ肉→豚肉',
    findIngredientMatches('豚肉に下味をつける', buildIngredientNames([{ name: '豚こま切れ肉' }])).map(
      (m) => m.text,
    ),
    ['豚肉'],
  )
  eq(
    '肉の部位別名: 鶏もも肉→鶏肉',
    findIngredientMatches('鶏肉を一口大に切る', buildIngredientNames([{ name: '鶏もも肉' }])).map(
      (m) => m.text,
    ),
    ['鶏肉'],
  )

  // ---- v3: 個別別名・修飾接頭語追加(2026-07-15オーナー実機フィードバック) ----
  eq(
    '個別別名: 合い挽き肉→ひき肉も手順で拾う',
    findIngredientMatches('ひき肉を炒める', buildIngredientNames([{ name: '合い挽き肉' }])).map(
      (m) => m.text,
    ),
    ['ひき肉'],
  )
  eq(
    '別名導出: プレーンヨーグルト(無糖)→ヨーグルトも手順で拾う(括弧除去後に修飾接頭語プレーンを剥がす)',
    findIngredientMatches(
      'ヨーグルトを加える',
      buildIngredientNames([{ name: 'プレーンヨーグルト(無糖)' }]),
    ).map((m) => m.text),
    ['ヨーグルト'],
  )
  eq(
    '個別別名: 生だら→たら(接頭語「生」剥がしだけでは連濁の濁点が戻らないため個別登録)',
    findIngredientMatches('たらに塩をふる', buildIngredientNames([{ name: '生だら' }])).map(
      (m) => m.text,
    ),
    ['たら'],
  )
}

// ---------- 記録写真の容量ガード(docs/20 §4写真添付・自動削除はせず促すバナーのみ) ----------
{
  const blob = (bytes) => new Blob([new Uint8Array(bytes)])
  const recipesWithPhotos = [
    { cookedLogs: [{ date: '2026-01-01', photo: blob(10) }, { date: '2026-01-02' }] },
    { cookedLogs: [{ date: '2026-01-03', photo: blob(20) }] },
  ]
  eq('全レシピの記録写真バイト数を合算する', totalCookedLogPhotoBytes(recipesWithPhotos), 30)
  eq('記録写真が無ければ0', totalCookedLogPhotoBytes([{ cookedLogs: [{ date: '2026-01-01' }] }]), 0)
  eq('空配列は0', totalCookedLogPhotoBytes([]), 0)
  eq('閾値ちょうどは超過扱いにしない', isOverCookedPhotoLimit(COOKED_PHOTO_WARNING_BYTES), false)
  eq('閾値を1バイトでも超えたら超過', isOverCookedPhotoLimit(COOKED_PHOTO_WARNING_BYTES + 1), true)
  eq('閾値未満は超過ではない', isOverCookedPhotoLimit(1024), false)
  eq('MB換算は小数第1位に丸める', bytesToMB(52_450_000), 50)
  eq('MB換算の丸め(52.6MB相当)', bytesToMB(55_000_000), 52.5)
}

// ---------- じぶんタイマーの秒刻み表示(formatMinutesSecondsLabel。2026-07-12秒刻み対応) ----------
eq('分のみ(秒0)は「3分」', formatMinutesSecondsLabel(180), '3分')
eq('分+秒は「3分30秒」', formatMinutesSecondsLabel(210), '3分30秒')
eq('1分未満は秒のみ「45秒」', formatMinutesSecondsLabel(45), '45秒')
eq('負数は0扱いで「0秒」', formatMinutesSecondsLabel(-5), '0秒')
eq('端数は丸める', formatMinutesSecondsLabel(60.4), '1分')

// ---------- SHA-256純JSフォールバック(2026-07-13 insecure context対応) ----------
// crypto.subtleはsecure context(https://またはlocalhost)でしか使えず、開発中LAN実機テスト
// (http://192.168.x.x:5173等)ではundefinedになりPro/パックのコード検証が動かなくなっていた。
// src/logic/sha256.ts の純JS実装がNIST既知ベクトル・Node crypto.subtleの出力と完全一致すること、
// および実際のコード検証(isValidProCode/isValidPackCode)がcrypto.subtle経由・フォールバック強制
// (第2引数forceFallback)の両経路で同じ結果になることを確認する。
{
  const { sha256Hex } = await import('../src/logic/sha256.ts')
  const { webcrypto } = await import('node:crypto')

  const subtleHex = async (bytesOrText) => {
    const bytes = typeof bytesOrText === 'string' ? new TextEncoder().encode(bytesOrText) : bytesOrText
    const digest = await webcrypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // NIST既知ベクトル(値はNode crypto.createHashで再検証済み)
  eq('SHA-256 空文字列', sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  eq('SHA-256 "abc"', sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  eq(
    'SHA-256 2ブロック境界の既知ベクトル(56byte)',
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  )
  eq(
    'SHA-256 "a"を100万回繰り返す長文ベクトル(複数ブロック)',
    sha256Hex('a'.repeat(1_000_000)),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  )

  // Node crypto.subtleとの一致比較(パディング境界の長さを中心に数十ケース+ランダム長)
  const randomStr = (len) => {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおアイウエオ漢字🍙'
    let s = ''
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }
  const boundaryLengths = [
    0, 1, 2, 15, 31, 32, 54, 55, 56, 57, 63, 64, 65, 100, 119, 120, 127, 128, 200, 300, 500,
  ]
  for (const len of boundaryLengths) {
    const s = randomStr(len)
    eq(`SHA-256 crypto.subtle一致(境界長さ${len})`, sha256Hex(s), await subtleHex(s))
  }
  for (let i = 0; i < 20; i++) {
    const s = randomStr(Math.floor(Math.random() * 400))
    eq(`SHA-256 crypto.subtle一致(ランダム${i})`, sha256Hex(s), await subtleHex(s))
  }
  // Uint8Array直接入力(文字列を経由しない生バイト列)でも一致すること
  for (const len of [0, 1, 55, 56, 64, 200]) {
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256)
    eq(`SHA-256 Uint8Array直接入力一致(長さ${len})`, sha256Hex(bytes), await subtleHex(bytes))
  }

  // isValidProCode: crypto.subtle経由(既定)とフォールバック強制の両方で同じ判定になること。
  // テスト用コードはdocs/22の実機確認チェックリストに記載のもの(販売用ではなく、既に
  // PRO_CODE_HASHESにハッシュが含まれている)。2026-07-22の全無料化で追加レシピパック(UP-)は
  // 製品廃止したため、isValidPackCodeのケースは削除した(コード検証はPro=UR-のみになった)。
  const validProCode = 'UR-96QS-2VSZ'

  eq('isValidProCode 正規コード(crypto.subtle)', await isValidProCode(validProCode), true)
  eq('isValidProCode 正規コード(フォールバック強制)', await isValidProCode(validProCode, true), true)
  eq(
    'isValidProCode 小文字+前後空白ゆらぎ(crypto.subtle)',
    await isValidProCode(' ur-96qs-2vsz '),
    true,
  )
  eq(
    'isValidProCode 小文字+前後空白ゆらぎ(フォールバック強制)',
    await isValidProCode(' ur-96qs-2vsz ', true),
    true,
  )
  eq('isValidProCode 不正コード(crypto.subtle)', await isValidProCode('UR-0000-0000'), false)
  eq('isValidProCode 不正コード(フォールバック強制)', await isValidProCode('UR-0000-0000', true), false)
  eq('isValidProCode 空文字列(crypto.subtle)', await isValidProCode(''), false)
  eq('isValidProCode 空文字列(フォールバック強制)', await isValidProCode('', true), false)
}

// ---------- appRefresh: 「アプリを更新する」ボタンの処理本体(2026-07-16新設) ----------
// SWとキャッシュストレージだけ消してreloadする安全な機能。ブラウザの「Cookieと他のサイトデータ」
// 削除でレシピ・購入コードを失った事故の再発防止として追加したため、IndexedDBには絶対に
// 触れないことをここで固定する。
{
  const { refreshApp } = await import('../src/logic/appRefresh.ts')

  // ソースコードにIndexedDB/Dexie関連の文字列が一切現れないこと(触れないことの静的な担保)
  const appRefreshSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/logic/appRefresh.ts'),
    'utf-8',
  )
  eq(
    'appRefreshはindexedDB/Dexie/db配下を一切importせず、indexedDBのプロパティアクセスもしない',
    /from ['"]dexie['"]|from ['"]\.\.\/db|indexeddb\.\w/i.test(appRefreshSrc),
    false,
  )

  // ケース1: Service Worker/Cache Storage/window未対応環境(素のNode)でも例外を投げず完了する
  {
    let threw = false
    try {
      await refreshApp()
    } catch {
      threw = true
    }
    eq('未対応環境でも例外を投げない', threw, false)
  }

  // ケース2: SW登録2件・キャッシュ2件がある環境で、両方とも解除・削除されreloadが呼ばれること。
  // IndexedDBには絶対に触れないことも、呼んだら即例外を投げるダミーを仕込んで検証する
  {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const unregisterCalls = []
    const registrations = [
      {
        unregister: async () => {
          unregisterCalls.push('reg1')
          return true
        },
      },
      {
        unregister: async () => {
          unregisterCalls.push('reg2')
          return true
        },
      },
    ]
    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: { getRegistrations: async () => registrations } },
      configurable: true,
    })

    const deleteCalls = []
    globalThis.caches = {
      keys: async () => ['cache-a', 'cache-b'],
      delete: async (key) => {
        deleteCalls.push(key)
        return true
      },
    }

    let reloadCalls = 0
    globalThis.window = { location: { reload: () => { reloadCalls++ } } }

    globalThis.indexedDB = {
      open: () => {
        throw new Error('indexedDBに触れてはいけない(open)')
      },
      deleteDatabase: () => {
        throw new Error('indexedDBに触れてはいけない(deleteDatabase)')
      },
    }

    let threw = false
    let result
    try {
      result = await refreshApp()
    } catch {
      threw = true
    }

    eq('SW/キャッシュ削除・reloadで例外を投げない', threw, false)
    eq('SW登録が全て解除される', unregisterCalls.sort(), ['reg1', 'reg2'])
    eq('キャッシュが全て削除される', deleteCalls.sort(), ['cache-a', 'cache-b'])
    eq('reloadが呼ばれる', reloadCalls, 1)
    eq('オンライン時は\'done\'を返す', result, 'done')

    delete globalThis.caches
    delete globalThis.window
    delete globalThis.indexedDB
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  }

  // ケース3(M-2 2026-07-16 Fable品質監査再発防止): オフライン時はSW一覧取得・キャッシュ削除・
  // reloadのいずれも実行せず'offline'を返すこと。古いSW/Cacheを消してreloadすると、
  // オフラインでは新しいファイルを取得できず白画面になってしまうため、呼び出し前の早期returnを
  // 「削除APIが1回も呼ばれないこと」まで含めて確認する
  {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    let getRegistrationsCalls = 0
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: false,
        serviceWorker: {
          getRegistrations: async () => {
            getRegistrationsCalls++
            return []
          },
        },
      },
      configurable: true,
    })

    let cachesKeysCalls = 0
    globalThis.caches = {
      keys: async () => {
        cachesKeysCalls++
        return []
      },
      delete: async () => true,
    }

    let reloadCalls = 0
    globalThis.window = { location: { reload: () => { reloadCalls++ } } }

    const result = await refreshApp()

    eq("オフライン時は'offline'を返す", result, 'offline')
    eq('オフライン時はSW一覧取得すら呼ばれない', getRegistrationsCalls, 0)
    eq('オフライン時はキャッシュ一覧取得すら呼ばれない', cachesKeysCalls, 0)
    eq('オフライン時はreloadが呼ばれない', reloadCalls, 0)

    delete globalThis.caches
    delete globalThis.window
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  }
}

// ---------- buildShareText(シェアの選択式・2026-07-16 Fable裁定docs/30裁定3) ----------
// 回帰の狙い: opts省略時の出力を従来形式(2026-07-17時点)に固定する。固定部分(料理名・人数分・
// 材料8件+…ほか・#アプリ名・URL)は従来とバイト単位で同一。「作り方は全◯ステップ」行だけは
// 裁定3の字義解釈(オーナーの固定項目列挙に無い)で意図的に削除済み＝期待値にも含めない。
{
  const shareRecipe = {
    id: 1,
    title: '肉じゃが',
    servings: 2,
    cookMinutes: 30,
    effortLevel: 'normal',
    tags: [],
    ingredients: [
      { name: '牛こま切れ肉', amount: '200', unit: 'g' },
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: '玉ねぎ', amount: '1', unit: '個' },
      { name: 'にんじん', amount: '1', unit: '本' },
      { name: 'しらたき', amount: '1', unit: '袋' },
      { name: 'サラダ油', amount: '1', unit: '大さじ' },
      { name: '砂糖', amount: '2', unit: '大さじ' },
      { name: 'しょうゆ', amount: '3', unit: '大さじ' },
      { name: '水', amount: '300', unit: 'ml' },
    ],
    steps: [{ text: '切る' }, { text: '炒める' }, { text: '煮る' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  }

  const expectedDefault = [
    '肉じゃが（2人分）',
    '',
    '【材料】',
    '・牛こま切れ肉 200g',
    '・じゃがいも 3個',
    '・玉ねぎ 1個',
    '・にんじん 1本',
    '・しらたき 1袋',
    '・サラダ油 大さじ1',
    '・砂糖 大さじ2',
    '・しょうゆ 大さじ3',
    '…ほか',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: opts省略は従来出力と一致(材料8件+…ほか・ステップ行なし)', buildShareText(shareRecipe), expectedDefault)

  // 全項目OFF(既定はテキストに任意行なし)のoptsを渡してもopts省略と同じ出力になる。
  // 「レシピ画像」は画像カード専用オプションで、テキスト出力には一切影響しない(仕様の※併記)
  const offOpts = { image: false, cookMinutes: false, cost: false, nutrition: false, allIngredients: false }
  eq('share: 全OFFのoptsはopts省略と同一', buildShareText(shareRecipe, offOpts), expectedDefault)
  eq('share: 画像ONはテキストに影響しない(画像カード専用)', buildShareText(shareRecipe, { ...offOpts, image: true }), expectedDefault)

  // 組合せ1: 調理時間ON → 料理名行の直後に「調理時間 約◯分」が入る
  const expectedWithCook = expectedDefault.replace(
    '肉じゃが（2人分）\n\n【材料】',
    '肉じゃが（2人分）\n調理時間 約30分\n\n【材料】',
  )
  eq('share: 調理時間ONで行が入る', buildShareText(shareRecipe, { ...offOpts, cookMinutes: true }), expectedWithCook)
  // 調理時間のデータが無いレシピではONを渡しても行が出ない(グレーアウトの防波堤)
  eq(
    'share: 調理時間なしレシピはONでも行なし',
    buildShareText({ ...shareRecipe, cookMinutes: undefined }, { ...offOpts, cookMinutes: true }),
    expectedDefault,
  )

  // 組合せ2: 原価ON → 登録人数基準の1人分/全量(実数値はRecipeDetailPage側が渡す)
  const expectedWithCost = expectedDefault.replace(
    '肉じゃが（2人分）\n\n【材料】',
    '肉じゃが（2人分）\n原価 1人分 約210円／全量（2人分） 約420円\n\n【材料】',
  )
  eq(
    'share: 原価ONで1人分/全量の行が入る',
    buildShareText(shareRecipe, { ...offOpts, cost: true, costPerServingYen: 210, costTotalYen: 420 }),
    expectedWithCost,
  )
  // 実数値が渡されなければ(合計0円等)ONでも行が出ない
  eq('share: 原価の実数値なしはONでも行なし', buildShareText(shareRecipe, { ...offOpts, cost: true }), expectedDefault)

  // 組合せ3: 栄養ON → カロリー・塩分の2項目のみ+「めやす」表記必須
  const expectedWithNutrition = expectedDefault.replace(
    '肉じゃが（2人分）\n\n【材料】',
    '肉じゃが（2人分）\n1食あたり 約498kcal・塩分 約4.1g（めやす）\n\n【材料】',
  )
  eq(
    'share: 栄養ONでカロリー・塩分(めやす)の行が入る',
    buildShareText(shareRecipe, { ...offOpts, nutrition: true, kcalPerServing: 498, saltPerServing: 4.1 }),
    expectedWithNutrition,
  )
  eq('share: 栄養の実数値なしはONでも行なし', buildShareText(shareRecipe, { ...offOpts, nutrition: true }), expectedDefault)

  // 組合せ4: 材料をすべて載せる → 9件全部が並び「…ほか」は消える
  const expectedAll = [
    '肉じゃが（2人分）',
    '',
    '【材料】',
    '・牛こま切れ肉 200g',
    '・じゃがいも 3個',
    '・玉ねぎ 1個',
    '・にんじん 1本',
    '・しらたき 1袋',
    '・サラダ油 大さじ1',
    '・砂糖 大さじ2',
    '・しょうゆ 大さじ3',
    '・水 300ml',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: 材料をすべて載せる', buildShareText(shareRecipe, { ...offOpts, allIngredients: true }), expectedAll)

  // 全部ON: 任意行の順序は 調理時間→原価→栄養(仕様のモーダル並び順と同じ)
  const expectedFull = expectedAll.replace(
    '肉じゃが（2人分）\n\n【材料】',
    '肉じゃが（2人分）\n調理時間 約30分\n原価 1人分 約210円／全量（2人分） 約420円\n1食あたり 約498kcal・塩分 約4.1g（めやす）\n\n【材料】',
  )
  eq(
    'share: 全部ONの行順は調理時間→原価→栄養',
    buildShareText(shareRecipe, {
      image: true,
      cookMinutes: true,
      cost: true,
      nutrition: true,
      allIngredients: true,
      costPerServingYen: 210,
      costTotalYen: 420,
      kcalPerServing: 498,
      saltPerServing: 4.1,
    }),
    expectedFull,
  )
}

// ============================================================================
// URLから取り込む(workers/recipe-import/src/normalize.ts)。docs/39検証で確認した実世界の
// ばらつき(schema.org/Recipe JSON-LDの@graph/配列/HowToStep/HowToSection/文字列instructions/
// ISO8601 duration/recipeYield表記ゆれ)を、実サイトHTMLの丸写しではなく構造を模した合成
// JSON-LDフィクスチャで網羅する。Workerからもこのファイルからも同じロジックを使う(共有資産)。
// ============================================================================

// ---- extractServings: recipeYieldの表記ゆれ ----
eq('servings: 「2人前」', extractServings('2人前'), 2)
eq('servings: 「4人分」', extractServings('4人分'), 4)
eq('servings: 全角「２人分」', extractServings('２人分'), 2)
eq('servings: 「4 servings」', extractServings('4 servings'), 4)
eq('servings: 「4(servings)」', extractServings('4(servings)'), 4)
eq('servings: 数字のみ「2」', extractServings('2'), 2)
// 「人分/人前」が無い裸の範囲(rakutenレシピの実例「2~3」相当)には人分直前ルールが使えないため、
// 単純に最初の数字(範囲の下限)を採用する(「人分」付きの範囲とは挙動が異なる。次のケースと対比)
eq('servings: 「人分」なし裸の範囲「2〜3」は最初の数字(下限)を採用', extractServings('2〜3'), 2)
eq('servings: 範囲「3〜4人分」は人分直前の数字を採用', extractServings('3〜4人分'), 4)
eq('servings: 数字なし「その他」はundefined(必須項目にしない)', extractServings('その他'), undefined)
eq('servings: 配列なら先頭要素', extractServings(['4人分', '4 servings']), 4)
eq('servings: undefined入力はundefined', extractServings(undefined), undefined)
// 2026-07-20 URL取り込み品質監査(docs/43)で実測: recipeYieldがJSON上の素の数値(文字列でない)の
// サイトがある(macaroni)。firstStringが数値を文字列化しないと丸ごと欠落していた
eq('servings: JSON数値そのもの(macaroni実測)', extractServings(2), 2)
// クックパッド「鶏もも肉600gで作る分量」→600人分、DELISH KITCHEN「26個分」→26人分のような
// 誤爆を実測(重量・個数の数字を人数と取り違える)。直後に重量・個数単位が続く数字は人数の
// フォールバック対象から除外し、他に使える数字が無ければundefinedを返す
eq('servings: 重量表記(600g)を人数と誤認しない', extractServings('鶏もも肉600gで作る分量'), undefined)
eq('servings: 「26個分」を人数と誤認しない', extractServings('26個分'), undefined)
eq(
  'servings: 重量の数字(先頭)を飛ばして後続の裸の数字を拾う',
  extractServings('600g / 3'),
  3,
)

// ---- parseIso8601DurationToMinutes: 分表記・秒表記の両対応(docs/39 DELISH KITCHENの秒表記対策) ----
eq('duration: 「PT30M」→30分', parseIso8601DurationToMinutes('PT30M'), 30)
eq('duration: 「PT1800S」(秒表記)→30分', parseIso8601DurationToMinutes('PT1800S'), 30)
eq('duration: 「PT1H」→60分', parseIso8601DurationToMinutes('PT1H'), 60)
eq('duration: 「PT1H15M」→75分', parseIso8601DurationToMinutes('PT1H15M'), 75)
eq('duration: 不正な文字列はundefined', parseIso8601DurationToMinutes('約30分'), undefined)
eq('duration: undefined入力はundefined', parseIso8601DurationToMinutes(undefined), undefined)

// ---- extractImageUrl: 文字列/配列/オブジェクト/オブジェクト配列 ----
eq('image: 文字列', extractImageUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg')
eq('image: 文字列配列は先頭', extractImageUrl(['https://example.com/a.jpg', 'https://example.com/b.jpg']), 'https://example.com/a.jpg')
eq('image: {url}オブジェクト', extractImageUrl({ url: 'https://example.com/c.jpg' }), 'https://example.com/c.jpg')
eq('image: {@id}オブジェクト(ImageObjectの@id形式)', extractImageUrl({ '@id': 'https://example.com/id.jpg' }), 'https://example.com/id.jpg')
eq('image: {url}オブジェクトの配列', extractImageUrl([{ url: 'https://example.com/d.jpg' }]), 'https://example.com/d.jpg')
eq('image: undefinedはundefined', extractImageUrl(undefined), undefined)
// 2026-07-21 画像取り込み対応: 相対URLはbaseUrl(sourceUrl)を基準に絶対URL化する
eq(
  'image: 相対URL(ルート相対)をbaseUrlで絶対URL化',
  extractImageUrl('/img/recipe/123.jpg', 'https://cookpad.example.com/recipes/1'),
  'https://cookpad.example.com/img/recipe/123.jpg',
)
eq(
  'image: 相対URL(パス相対)をbaseUrlで絶対URL化',
  extractImageUrl('recipe123.jpg', 'https://example.com/recipes/'),
  'https://example.com/recipes/recipe123.jpg',
)
eq(
  'image: プロトコル相対URL(//)をbaseUrlのスキームで絶対URL化',
  extractImageUrl('//cdn.example.com/a.jpg', 'https://example.com/recipes/1'),
  'https://cdn.example.com/a.jpg',
)
eq(
  'image: 既に絶対URLならbaseUrlと違うドメインでもそのまま',
  extractImageUrl('https://cdn.other.com/a.jpg', 'https://example.com/recipes/1'),
  'https://cdn.other.com/a.jpg',
)
eq(
  'image: {url}オブジェクトの相対URLも絶対URL化される',
  extractImageUrl({ url: '/img/e.jpg' }, 'https://example.com/recipes/1'),
  'https://example.com/img/e.jpg',
)
eq('image: baseUrl未指定なら相対URLのまま返す(従来挙動を保つ)', extractImageUrl('/img/f.jpg'), '/img/f.jpg')
eq(
  'image: baseUrl自体が壊れていても元の文字列をそのまま返す',
  extractImageUrl('/img/g.jpg', 'not-a-url'),
  '/img/g.jpg',
)

// ---- splitIngredientAmount: name+amountの分離(unit分解はapp側splitQuantityに委ねる) ----
eq('ingredient: 空白区切り「しょうゆ 大さじ2」', splitIngredientAmount('しょうゆ 大さじ2'), { name: 'しょうゆ', amount: '大さじ2' })
eq('ingredient: 全角空白区切り「豚肉　200g」', splitIngredientAmount('豚肉　200g'), { name: '豚肉', amount: '200g' })
eq('ingredient: 全角数字「にんじん　１本」→半角化', splitIngredientAmount('にんじん　１本'), { name: 'にんじん', amount: '1本' })
eq('ingredient: くっつき(区切りなし)「そうめん4ワ」', splitIngredientAmount('そうめん4ワ'), { name: 'そうめん', amount: '4ワ' })
eq('ingredient: 三点リーダー区切り「じゃがいも…2個」', splitIngredientAmount('じゃがいも…2個'), { name: 'じゃがいも', amount: '2個' })
eq('ingredient: 分量なしのグループ見出し「合わせ調味料」', splitIngredientAmount('合わせ調味料'), { name: '合わせ調味料' })
eq('ingredient: 括弧付き分量「じゃがいも 3個(450g)」', splitIngredientAmount('じゃがいも 3個(450g)'), { name: 'じゃがいも', amount: '3個(450g)' })
eq('ingredient: 先頭の中黒を除去「・鶏もも肉 200g」', splitIngredientAmount('・鶏もも肉 200g'), { name: '鶏もも肉', amount: '200g' })
// 2026-07-20 URL取り込み品質監査(docs/43)で実測: 味の素パークは合わせ調味料のグループ記号(A/B)が
// 区切りなしで名前の先頭にくっつく(「Ａ水」「Bみりん」「A「ほんだし®」」)。オレンジページは
// グループ記号だけの行(「A」)が単独の配列要素として存在する
eq('ingredient: グループ記号の連結を除去「Ａ水　2カップ」', splitIngredientAmount('Ａ水　2カップ'), { name: '水', amount: '2カップ' })
eq('ingredient: グループ記号の連結を除去(半角)「B砂糖 大さじ1」', splitIngredientAmount('B砂糖 大さじ1'), { name: '砂糖', amount: '大さじ1' })
eq(
  'ingredient: グループ記号+括弧書き商品名「A「ほんだし®」 小さじ1」',
  splitIngredientAmount('A「ほんだし®」 小さじ1'),
  { name: '「ほんだし®」', amount: '小さじ1' },
)
eq('ingredient: グループ記号のみの行は空扱い(呼び出し側で除外)', splitIngredientAmount('A'), { name: '' })
eq('ingredient: グループ記号のみ(全角)も空扱い', splitIngredientAmount('Ｂ'), { name: '' })
// レタスクラブ実測:「大さじ2　1/2」(整数と分数の間に区切りの空白)が入ると、素朴な「末尾の空白で
// 名前/分量を分ける」ロジックが整数側まで名前に取り込んでしまう不具合。整数+分数を先に1個の
// 小数トークンへ畳んでから分離することで正しく分かれる
eq(
  'ingredient: 空白区切りの帯分数「しょうゆ…大さじ2　1/2」を正しく分離',
  splitIngredientAmount('しょうゆ…大さじ2　1/2'),
  { name: 'しょうゆ', amount: '大さじ2.5' },
)

// ---- normalizeIngredients: 配列のまとめ処理(空要素・文字列以外は無視) ----
eq(
  'ingredients: 配列一括',
  normalizeIngredients(['じゃがいも 3個', 'しょうゆ 大さじ2', '塩　少々']),
  [
    { name: 'じゃがいも', amount: '3個' },
    { name: 'しょうゆ', amount: '大さじ2' },
    { name: '塩', amount: '少々' },
  ],
)
eq('ingredients: undefinedは空配列', normalizeIngredients(undefined), [])

// ---- normalizeImportedIngredient: URL取り込み(Worker側 name+amount)を貼り付け経路と同一資産で正規化 ----
// 経路統一の要(2026-07-23)。Worker側は「末尾の空白で名前と分量を切る」ため、コロン書式・括弧グラム
// 併記だとname側に分量が食い込む。normalizeImportedIngredientはname+amountを元の1行に組み直し、
// 貼り付け側のparseIngredientLine(コロン/全半角スペース/末尾括弧グラム併記対応)で解釈し直す。
eq('取り込み正規化: 既に正しく分かれている「鶏もも肉」+「300g」', normalizeImportedIngredient('鶏もも肉', '300g'), { name: '鶏もも肉', amount: '300', unit: 'g' })
eq('取り込み正規化: 前置単位「しょうゆ」+「大さじ2」', normalizeImportedIngredient('しょうゆ', '大さじ2'), { name: 'しょうゆ', amount: '2', unit: '大さじ' })
eq('取り込み正規化: コロン書式でnameに分量が食い込んだWorker出力「木綿豆腐: 75」+「g」', normalizeImportedIngredient('木綿豆腐: 75', 'g'), { name: '木綿豆腐', amount: '75', unit: 'g' })
eq('取り込み正規化: 括弧グラム併記(小さじ)「白ごま: 小さじ1/3 (1」+「g)」', normalizeImportedIngredient('白ごま: 小さじ1/3 (1', 'g)'), { name: '白ごま', amount: '1/3', unit: '小さじ', memo: '1 g' })
eq('取り込み正規化: 全角スペース区切り相当「木綿豆腐」+「75g」', normalizeImportedIngredient('木綿豆腐', '75g'), { name: '木綿豆腐', amount: '75', unit: 'g' })
eq('取り込み正規化: 分量なしのグループ見出しは名前だけ残す', normalizeImportedIngredient('合わせ調味料', undefined), { name: '合わせ調味料', amount: '', unit: '' })

// ---- 崩れ実例の再現(おいしい健康 https://oishi-kenko.com/recipes/22619)。schema.orgの材料文字列群を
// Worker splitIngredientAmount → client normalizeImportedIngredient のフルパイプラインに通し、
// 「木綿豆腐/75/g」「白ごま/小さじ1/3」「ごま油/小さじ1/2」に分解され、栄養計算対象外が0件になることを固定 ----
{
  const rawSchemaIngredients = ['木綿豆腐: 75 g', '白ごま: 小さじ1/3 (1 g)', 'ごま油: 小さじ1/2 (2 g)']
  const parsed = rawSchemaIngredients.map((raw) => {
    const w = splitIngredientAmount(raw) // Worker側の name+amount 分割(現状の実装のまま=コロン/括弧gに弱い)
    return normalizeImportedIngredient(w.name, w.amount) // client側で経路統一の正規化をかけて修復する
  })
  eq('URL崩れ再現: 木綿豆腐→75/g', parsed[0], { name: '木綿豆腐', amount: '75', unit: 'g' })
  eq('URL崩れ再現: 白ごま→小さじ1/3(括弧gはmemoへ)', parsed[1], { name: '白ごま', amount: '1/3', unit: '小さじ', memo: '1 g' })
  eq('URL崩れ再現: ごま油→小さじ1/2(括弧gはmemoへ)', parsed[2], { name: 'ごま油', amount: '1/2', unit: '小さじ', memo: '2 g' })
  const nut = computeRecipeNutrition({
    servings: 2,
    ingredients: parsed.map((p) => ({ name: p.name, amount: p.amount, unit: p.unit, memo: p.memo ?? '' })),
  })
  eq('URL崩れ再現: 栄養計算対象外が0件(白ごま・ごま油が数値化できる)', nut.excluded.length, 0)
  eq('URL崩れ再現: 3材料すべて栄養計算に含まれる', nut.items.length, 3)
}

// ---- normalizeInstructions: 文字列配列/HowToStep配列/HowToSection入れ子/単一長文字列 ----
eq(
  'instructions: 文字列配列',
  normalizeInstructions(['じゃがいもを切る', '鍋で煮る']),
  ['じゃがいもを切る', '鍋で煮る'],
)
eq(
  'instructions: HowToStep配列',
  normalizeInstructions([
    { '@type': 'HowToStep', text: 'じゃがいもを切る' },
    { '@type': 'HowToStep', text: '鍋で煮る' },
  ]),
  ['じゃがいもを切る', '鍋で煮る'],
)
eq(
  'instructions: HowToSection入れ子(itemListElementを展開)',
  normalizeInstructions([
    {
      '@type': 'HowToSection',
      name: '下ごしらえ',
      itemListElement: [
        { '@type': 'HowToStep', text: '野菜を切る' },
        { '@type': 'HowToStep', text: '肉を切る' },
      ],
    },
    { '@type': 'HowToStep', text: '炒める' },
  ]),
  ['野菜を切る', '肉を切る', '炒める'],
)
eq(
  'instructions: 単一長文字列を番号で分割(E・レシピ形式)',
  normalizeInstructions('作り方1. じゃがいもの皮をむいて切る。2. 鍋に入れて煮る。3. 味付けする。'),
  ['じゃがいもの皮をむいて切る。', '鍋に入れて煮る。', '味付けする。'],
)
eq(
  'instructions: HTMLタグ・実体参照を除去(nadia形式のリンク混入対策)',
  normalizeInstructions(['にんじんは<a href="/wordlist/乱切り">乱切り</a>にする&amp;混ぜる']),
  ['にんじんは乱切りにする&混ぜる'],
)
eq('instructions: undefinedは空配列', normalizeInstructions(undefined), [])

// 2026-07-20 URL取り込み品質監査(docs/43)で実測: ミツカンはHowToStepが1個しかなく、その中に
// 「[1]…[2]…」のように複数手順が角括弧番号でまとめて詰め込まれている。HowToStepが1個だけに
// なった結果へ番号分割を再適用することで正しく複数手順に割り直す(通常の複数HowToStep配列は
// これまでどおり触らない)
eq(
  'instructions: HowToStep1個に複数手順が角括弧番号でまとまっている場合は分割する(ミツカン形式)',
  normalizeInstructions([
    { '@type': 'HowToStep', text: '[1]野菜を切る。[2]鍋に油を熱し、[1]の野菜を炒める。[3]煮汁を加えて煮る。' },
  ]),
  ['野菜を切る。', '鍋に油を熱し、[1]の野菜を炒める。', '煮汁を加えて煮る。'],
)
// 「[2]鍋に油を熱し、[1]の野菜を炒める。」の中の「[1]の」は前の手順への参照であって新しい手順の
// 開始ではない(番号直後が助詞「の」で始まるため分割しない=STEP_MARKER_FOLLOWED_BY_PARTICLE)。
// 上のテストで手順2に「[1]の野菜を炒める」がそのまま残っていることが、参照ガードが効いている証拠
eq(
  'instructions: 角括弧番号は全角数字でも認識する',
  normalizeInstructions([{ '@type': 'HowToStep', text: '［１］下ごしらえをする。［２］焼く。' }]),
  ['下ごしらえをする。', '焼く。'],
)
// E・レシピ実測:「作り方1. …作り方2. …」のようにラベル語が番号ごとに繰り返されると、末尾の
// 「作り方」が前の手順の末尾に残ってしまっていた不具合(番号側にラベルがくっついていれば
// マーカーとしてまるごと消費する)
eq(
  'instructions: 番号ごとに繰り返されるラベル語が手順末尾に残らない(E・レシピ形式)',
  normalizeInstructions('作り方1. 材料を切る。 作り方2. 炒める。 作り方3. 盛り付ける。'),
  ['材料を切る。', '炒める。', '盛り付ける。'],
)
// E・レシピ実測:「(1)のタネを大さじ1位のせ」のような前の手順への参照を、新しい手順番号と
// 誤認して余計な空ステップ(「(」だけの手順)を作らないことの回帰確認
eq(
  'instructions: 「(1)の」参照は新しい手順として分割しない',
  normalizeInstructions('作り方1. 皮でタネを包む。 作り方2. (1)の生地を焼く。'),
  ['皮でタネを包む。', '(1)の生地を焼く。'],
)

// ---- extractRecipeFromHtml: JSON-LD抽出パイプライン全体(合成HTML) ----
function ldJsonHtml(json) {
  return `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`
}

{
  // 基本形: 単体Recipeオブジェクト・recipeYield「2人前」・cookTime分表記
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個', '牛こま切れ肉 200g', 'しょうゆ 大さじ2'],
    recipeInstructions: ['じゃがいもを切る', '鍋で煮る'],
    recipeYield: '2人前',
    cookTime: 'PT30M',
    image: 'https://example.com/nikujaga.jpg',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/1')
  eq('extractRecipeFromHtml: 基本形タイトル', r?.title, '肉じゃが')
  eq('extractRecipeFromHtml: 基本形材料3件', r?.ingredients, [
    { name: 'じゃがいも', amount: '3個' },
    { name: '牛こま切れ肉', amount: '200g' },
    { name: 'しょうゆ', amount: '大さじ2' },
  ])
  eq('extractRecipeFromHtml: 基本形手順2件', r?.steps, ['じゃがいもを切る', '鍋で煮る'])
  eq('extractRecipeFromHtml: 基本形servings', r?.servings, 2)
  eq('extractRecipeFromHtml: 基本形cookMinutes', r?.cookMinutes, 30)
  eq('extractRecipeFromHtml: 基本形imageUrl', r?.imageUrl, 'https://example.com/nikujaga.jpg')
  eq('extractRecipeFromHtml: 基本形sourceUrlは引数のURL', r?.sourceUrl, 'https://example.com/recipe/1')
}

{
  // @graph形式: WebSite等のノードに混ざってRecipeが入っている
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'サンプルレシピサイト' },
      {
        '@type': ['Recipe'],
        name: 'カレーライス',
        recipeIngredient: ['じゃがいも 2個', 'カレールー 1箱'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: '野菜を切る' },
          { '@type': 'HowToStep', text: '煮込む' },
        ],
        recipeYield: '4 servings',
      },
    ],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/2')
  eq('extractRecipeFromHtml: @graph形式でもRecipeを発見', r?.title, 'カレーライス')
  eq('extractRecipeFromHtml: @graph形式・@typeが配列でも検出', r?.steps, ['野菜を切る', '煮込む'])
  eq('extractRecipeFromHtml: @graph形式のrecipeYield「4 servings」', r?.servings, 4)
}

{
  // 配列ルート形式
  const html = ldJsonHtml([
    { '@type': 'Organization', name: 'サンプル' },
    {
      '@type': 'Recipe',
      name: '親子丼',
      recipeIngredient: ['卵 2個', '鶏もも肉 100g'],
      recipeInstructions: '作り方1. 鶏肉を煮る。2. 卵でとじる。',
      cookTime: 'PT1800S',
    },
  ])
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/3')
  eq('extractRecipeFromHtml: 配列ルート形式でもRecipeを発見', r?.title, '親子丼')
  eq('extractRecipeFromHtml: 単一長文字列instructionsも番号分割', r?.steps, ['鶏肉を煮る。', '卵でとじる。'])
  eq('extractRecipeFromHtml: cookTime秒表記(PT1800S)→30分', r?.cookMinutes, 30)
}

{
  // JSON-LD内に生の制御文字(改行)が文字列リテラル中に混入するケース(ミツカン実例の再現)。
  // JSON.stringifyでは作れないため、素朴なJSON.parseが失敗する壊れたJSON-LD文字列を直接組み立てる
  const brokenJsonLd =
    '{"@context":"https://schema.org","@type":"Recipe","name":"筑前煮",' +
    '"recipeIngredient":["れんこん 150g","鶏もも肉 300g"],' +
    '"recipeInstructions":["野菜を\n炒める","煮込む"]}'
  const html = `<!doctype html><html><head><script type="application/ld+json">${brokenJsonLd}</script></head><body></body></html>`
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/4')
  eq('extractRecipeFromHtml: 制御文字混入JSON-LDもサニタイズして復旧', r?.title, '筑前煮')
  // サニタイズでJSON.parse自体は復旧する。埋め込まれていた改行はcleanTextの空白正規化で
  // 半角スペース1つにまとまる(手順文を1行の読みやすい文として扱う設計。改行の保持が目的ではない)
  eq('extractRecipeFromHtml: サニタイズ後も手順が読める(改行は空白に正規化)', r?.steps, ['野菜を 炒める', '煮込む'])
}

{
  // Recipe型のJSON-LDが存在しない(白ごはん.com・S&B相当) → no_recipeとして扱うためundefinedを返す
  const html = ldJsonHtml({ '@context': 'https://schema.org', '@type': 'Article', headline: 'コラム記事' })
  const r = extractRecipeFromHtml(html, 'https://example.com/article')
  eq('extractRecipeFromHtml: Recipe型が無ければundefined(no_recipe)', r, undefined)
}

{
  // JSON-LD自体が存在しない
  const html = '<!doctype html><html><head></head><body>レシピはありません</body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/none')
  eq('extractRecipeFromHtml: JSON-LDが無ければundefined', r, undefined)
}

{
  // Recipe型はあるが中核3項目(材料・手順)が空 → undefined(name/ingredients/stepsが必須)
  const html = ldJsonHtml({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'タイトルのみ' })
  const r = extractRecipeFromHtml(html, 'https://example.com/incomplete')
  eq('extractRecipeFromHtml: 材料・手順が空ならundefined', r, undefined)
}

{
  // 2026-07-20 URL取り込み品質監査(docs/43)で実測: 山本ゆり(syunkon)は投稿名の末尾に「の作り方」が
  // 付いたままJSON-LDのnameに入っている。貼り付けパーサーM7(src/logic/parseRecipeText.ts)と同じ
  // 末尾整形資産をURL取り込み側にも適用し、末尾の定型句を落とす
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '究極のフライドポテトの作り方',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['切る', '揚げる'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/5')
  eq('extractRecipeFromHtml: タイトル末尾「の作り方」を除去(M7資産の流用)', r?.title, '究極のフライドポテト')
}

{
  // Nadia実測:「定番美味しい！基本の【ハンバーグ】のレシピ」のように、投稿者が定型句として
  // 「〇〇のレシピ」で終わるタイトルを付けるサイトがある。M7は空白区切りの「レシピ」しか
  // 剥がさないため(SMK-02回帰対策)、「の」接続も安全に剥がせる追加ケースとして対応する
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '基本のハンバーグのレシピ',
    recipeIngredient: ['合いびき肉 300g'],
    recipeInstructions: ['こねる', '焼く'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/6')
  eq('extractRecipeFromHtml: タイトル末尾「〇〇のレシピ」(の接続)を除去', r?.title, '基本のハンバーグ')
}

{
  // 2026-07-16 SMK-02回帰(便Iの事故)の再発防止: 空白なし・「の」なしで「レシピ」に連結している
  // 名前(「試験用レシピ」等、料理名の一部としてレシピで終わる名前)は剥がさない
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '試験用レシピ',
    recipeIngredient: ['塩 少々'],
    recipeInstructions: ['混ぜる'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/7')
  eq('extractRecipeFromHtml: SMK-02回帰確認・連結した「レシピ」は剥がさない', r?.title, '試験用レシピ')
}

{
  // 2026-07-20 URL取り込み品質監査(docs/43)で実測: NHK・キッコーマン・味の素パーク・ハウス食品・
  // 楽天レシピ・つくおき等はcookTimeが空でtotalTimeにだけ調理時間が入っている。cookTimeしか
  // 見ていなかった実装では7サイト分のcookMinutesが丸ごと欠落していた
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['煮る'],
    totalTime: 'PT25M',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/8')
  eq('extractRecipeFromHtml: cookTimeが無くてもtotalTimeから調理時間を拾う', r?.cookMinutes, 25)
}

{
  // 2026-07-21 画像取り込み対応: imageがルート相対URLのサイト実測(サイトによってはimageに
  // フルURLではなくパスのみを入れている)を想定し、sourceUrlを基準に絶対URL化されることを確認する
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['煮る'],
    image: '/img/nikujaga.jpg',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/9')
  eq('extractRecipeFromHtml: 相対URLのimageはsourceUrlを基準に絶対URL化される', r?.imageUrl, 'https://example.com/img/nikujaga.jpg')
}

// ---- buildImageProxyUrl / isImageContentType(src/logic/urlImportImage.ts、写真自動取り込み2026-07-21) ----
eq(
  'buildImageProxyUrl: エンドポイント+/image?url=に画像URLをencodeURIComponentして付ける',
  buildImageProxyUrl('https://recipe-import.example.workers.dev', 'https://cdn.example.com/a b.jpg'),
  'https://recipe-import.example.workers.dev/image?url=https%3A%2F%2Fcdn.example.com%2Fa%20b.jpg',
)
eq('isImageContentType: image/jpegはtrue', isImageContentType('image/jpeg'), true)
eq('isImageContentType: セミコロン以降のcharset付きでもtrue', isImageContentType('image/png; charset=binary'), true)
eq('isImageContentType: 大文字混在でもtrue', isImageContentType('Image/WEBP'), true)
eq('isImageContentType: text/htmlはfalse', isImageContentType('text/html'), false)
eq('isImageContentType: nullはfalse', isImageContentType(null), false)
eq('isImageContentType: undefinedはfalse', isImageContentType(undefined), false)
eq('isImageContentType: 空文字はfalse', isImageContentType(''), false)

// ---------- lineCompose: 読点優先・幅実測の行組みエンジン(2026-07-21 p9/line-compose) ----------
// composeLines へ「1文字=1幅」の偽測定関数と、実アトム列(TermText+TimeText 相当の分解結果)を
// 渡し、オーナー3例を幅12/14/17/28 で組んだ期待行を固定する。期待値はアルゴリズムから導出し、
// 受け入れ基準1(こんにゃく文)・基準2(しょうゆ・みりん文)・基準3(PC幅でも詰め込まない)を満たす。
{
  const { composeLines, lineToText } = await import('../src/logic/lineCompose.ts')
  const { ZWSP } = await import('../src/logic/jaWrap.ts')
  const measure = (t) => [...t.replace(new RegExp(ZWSP, 'g'), '')].length
  const box = (id, text) => ({ kind: 'atom', id, text, width: measure(text) })
  const txt = (text) => ({ kind: 'text', text })
  const compose = (atoms, w) => composeLines(atoms, w, measure, { eps: 0 }).map(lineToText)

  // 受け入れ基準1: 「鍋にたっぷりの湯を沸かし、こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。」
  // アトム列: 地文 + [2分ほど](タイマー箱) + [下茹で](用語箱・辞書語) + 地文。
  // splitByTerms が 下茹で を用語として切るため、地文が「…こんにゃくを」「してざる…」に割れる。
  // composeLines は句の全文に wrapJaPhrases をかけ直して文節境界を取るので「下茹でして」が保たれる。
  const ex1 = () => [
    txt('鍋にたっぷりの湯を沸かし、こんにゃくを'),
    box('m0', '2分ほど'),
    box('t0', '下茹で'),
    txt('してざるにあげ、水気を切る。'),
  ]
  eq('lineCompose 基準1 幅12', compose(ex1(), 12), [
    '鍋にたっぷりの',
    '湯を沸かし、',
    'こんにゃくを2分ほど',
    '下茹でしてざるにあげ、',
    '水気を切る。',
  ])
  eq('lineCompose 基準1 幅14', compose(ex1(), 14), [
    '鍋にたっぷりの湯を沸かし、',
    'こんにゃくを2分ほど',
    '下茹でしてざるにあげ、',
    '水気を切る。',
  ])
  // 幅17: オーナー期待の3行「鍋に…沸かし、/ こんにゃくを2分ほど下茹でして / ざるにあげ、水気を切る。」
  eq('lineCompose 基準1 幅17(オーナー期待の3行)', compose(ex1(), 17), [
    '鍋にたっぷりの湯を沸かし、',
    'こんにゃくを2分ほど下茹でして',
    'ざるにあげ、水気を切る。',
  ])
  // 幅28(PC相当): まだ入るのに詰め込まず、最初の読点で行を終える(基準3の思想)
  eq('lineCompose 基準3 幅28(読点で行を終える)', compose(ex1(), 28), [
    '鍋にたっぷりの湯を沸かし、',
    'こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。',
  ])

  // 受け入れ基準2: 「しょうゆ・みりん・砂糖を加えて炒り煮にする。」用語[炒り煮]は2行目先頭側
  const ex2 = () => [txt('しょうゆ・みりん・砂糖を加えて'), box('t0', '炒り煮'), txt('にする。')]
  eq('lineCompose 基準2 幅12', compose(ex2(), 12), ['しょうゆ・みりん', '・砂糖を加えて', '炒り煮にする。'])
  eq('lineCompose 基準2 幅14', compose(ex2(), 14), ['しょうゆ・みりん', '・砂糖を加えて炒り煮にする。'])
  // 幅17: オーナー期待の2行「しょうゆ・みりん・砂糖を加えて / 炒り煮にする。」
  eq('lineCompose 基準2 幅17(オーナー期待の2行)', compose(ex2(), 17), [
    'しょうゆ・みりん・砂糖を加えて',
    '炒り煮にする。',
  ])
  eq('lineCompose 基準2 幅28(1行に収まる)', compose(ex2(), 28), ['しょうゆ・みりん・砂糖を加えて炒り煮にする。'])

  // 整合性: どの幅でも、行を連結すると元テキスト(ZWSP除去)に一致する(文字の欠落・重複なし)
  const joinAll = (atoms) => atoms.map((a) => a.text).join('')
  for (const w of [12, 14, 17, 28, 40]) {
    eq(`lineCompose 整合性 基準1 幅${w}`, compose(ex1(), w).join(''), joinAll(ex1()))
    eq(`lineCompose 整合性 基準2 幅${w}`, compose(ex2(), w).join(''), joinAll(ex2()))
  }
  // 禁則: 行頭に「、」「。」が来ない(読点・句点は必ず行末側)
  for (const w of [10, 12, 14, 17, 20, 28]) {
    const heads = [...compose(ex1(), w), ...compose(ex2(), w)].map((l) => l[0])
    eq(`lineCompose 行頭禁則 幅${w}`, heads.some((c) => c === '、' || c === '。'), false)
  }

  // 一般ケース(テキストのみ・箱なし)
  const c = (text, w) => composeLines([txt(text)], w, measure, { eps: 0 }).map(lineToText)
  eq('lineCompose 短文は1行', c('混ぜる', 20), ['混ぜる'])
  // 各句が丸ごとは入るが2句一緒には入らない幅 → 句ごとに改行(詰め込まない)
  eq('lineCompose 句ごとに改行', c('あいう、えお、かき。', 5), ['あいう、', 'えお、', 'かき。'])
  // 残り幅に入る句は同じ行に足す(1行に複数句)
  eq('lineCompose 複数句を1行に', c('あいう、えお、かき。', 8), ['あいう、えお、', 'かき。'])
  // 改行\nは強制改行
  eq('lineCompose 改行\\nは強制改行', c('あい\nうえ', 20), ['あい', 'うえ'])
}

// ---------- lineCompose 改行第4弾: 罰則DP(A/F)・句読点フレッシュ行(B)・長括弧の句分割(D) ----------
// オーナー実機フィードバック(2026-07-21深夜)の4例を、1文字=1幅の偽測定・幅17〜19相当で固定する。
// アトム列は ComposedStepText(TermText→TimeText)と同じ分解結果を手で並べたもの(用語/タイマー=箱)。
{
  const { composeLines, lineToText } = await import('../src/logic/lineCompose.ts')
  const { ZWSP } = await import('../src/logic/jaWrap.ts')
  const measure = (t) => [...t.replace(new RegExp(ZWSP, 'g'), '')].length
  const box = (id, text) => ({ kind: 'atom', id, text, width: measure(text) })
  const txt = (text) => ({ kind: 'text', text })
  const compose = (atoms, w) => composeLines(atoms, w, measure, { eps: 0 }).map(lineToText)
  const chars = (s) => [...s].length

  // 要件A: 「洗っていない米を③のフライパンに加えて、3分ほど透き通るまで炒めます。」(3分=タイマー)
  // 貪欲だと「洗っていない米を③のフライパンに / 加えて、」で4字の切れ端行「加えて、」が出る。
  // 罰則DPで切れ端を消し(「洗っていない / 米を③のフライパンに加えて、」)、さらに借用パス(F-2)が
  // 行末「洗っていない」(悪い切れ目)を、次ユニット「米を③のフライパンに」の細分節「米を」(強い
  // 切れ目=を)まで借用して「洗っていない米を / ③のフライパンに加えて、」に直す。
  const exA = () => [
    txt('洗っていない米を③のフライパンに加えて、'),
    box('m0', '3分ほど'),
    txt('透き通るまで炒めます。'),
  ]
  for (const w of [17, 18, 19]) {
    eq(`lineCompose 要件A 幅${w}(切れ端なし+行末を良い切れ目に借用)`, compose(exA(), w), [
      '洗っていない米を',
      '③のフライパンに加えて、',
      '3分ほど透き通るまで炒めます。',
    ])
    // 受け入れ: 末尾に4字以下の切れ端行が無い(最終行も含め全行が4字超)
    const lastA = compose(exA(), w).slice(-1)[0]
    eq(`lineCompose 要件A 幅${w}(最終行は4字超)`, chars(lastA) > 4, true)
  }

  // 要件B: 「豚肉は食べやすい大きさに切る。水切りした豆腐は…（またはさいの目に切る）。」
  // (水切り・さいの目=用語)。行1が「切る。」で終わるので、溢れ句の充填を新しい行から始め、
  // 「切る。」の直後に次句先頭[水切り]をぶら下げない。(（またはさいの目に切る）は中身10字=短括弧で句内)
  const exB = () => [
    txt('豚肉は食べやすい大きさに切る。'),
    box('t0', '水切り'),
    txt('した豆腐は食べやすい大きさに手でちぎる（または'),
    box('t1', 'さいの目'),
    txt('に切る）。'),
  ]
  for (const w of [17, 18]) {
    const linesB = compose(exB(), w)
    eq(`lineCompose 要件B 幅${w}(行1は「切る。」で終わり次句を吊るさない)`, linesB[0], '豚肉は食べやすい大きさに切る。')
    // 「。」で終わる行の直後に、その行内で次句先頭が続いていない(=各「。」行は句点で閉じる)
    eq(`lineCompose 要件B 幅${w}(整合性)`, linesB.join(''), '豚肉は食べやすい大きさに切る。水切りした豆腐は食べやすい大きさに手でちぎる（またはさいの目に切る）。')
  }

  // 要件D: 「鮭を加え、袋の上からやさしくなじませる（鮭は身が崩れやすいので、強くもまずに
  // なじませる程度でよい）。冷蔵庫で30分ほど置く。」(30分=タイマー)。中身が長い括弧(>12字)の
  // 開き括弧「（」の直前を句境界にし、「（」が行末に残らない・括弧の開始で行が切り替わるようにする。
  const exD = () => [
    txt('鮭を加え、袋の上からやさしくなじませる（鮭は身が崩れやすいので、強くもまずになじませる程度でよい）。冷蔵庫で'),
    box('m0', '30分ほど'),
    txt('置く。'),
  ]
  eq('lineCompose 要件D 幅19(括弧の開始で行が切り替わる)', compose(exD(), 19), [
    '鮭を加え、袋の上からやさしくなじませる',
    '（鮭は身が崩れやすいので、',
    '強くもまずになじませる程度でよい）。',
    '冷蔵庫で30分ほど置く。',
  ])
  for (const w of [17, 18, 19]) {
    const linesD = compose(exD(), w)
    // 「（」「(」が行末に残らない
    eq(`lineCompose 要件D 幅${w}(「（」が行末に残らない)`, linesD.some((l) => /[（(]$/.test(l)), false)
    // 括弧の開始で行が切り替わる=「（」で始まる行が1つある
    eq(`lineCompose 要件D 幅${w}(「（」で始まる行がある)`, linesD.some((l) => /^[（(]/.test(l)), true)
  }

  // 要件F(借用パスF-2で実現): 「…みそだれを軽くぬぐった鮭の皮目を下にして焼く。」の後半。
  // jaWrap は「鮭の皮目を下にして」を格助詞「を」結合で1ユニットにするが、借用パスは結合前の
  // 細分節[鮭の][皮目を][下に][して]を使える。貪欲=「みそだれを軽くぬぐった / 鮭の皮目を下にして焼く。」
  // (11/12)で行末「ぬぐった」が悪い切れ目のため、次ユニットから強い切れ目「を」まで=「鮭の皮目を」を
  // 借用し「みそだれを軽くぬぐった鮭の皮目を / 下にして焼く。」(16/7)にする。弱い切れ目「下に」(に)は
  // 「下にして」を割るので選ばない(強い切れ目を弱い切れ目より優先)。jaWrap結合ロジックは不変。
  const exF2 = () => [txt('みそだれを軽くぬぐった鮭の皮目を下にして焼く。')]
  for (const w of [17, 18, 19]) {
    eq(`lineCompose 要件F後半 幅${w}(鮭の皮目を/下にして焼く。=16/7)`, compose(exF2(), w), [
      'みそだれを軽くぬぐった鮭の皮目を',
      '下にして焼く。',
    ])
  }

  // 要件F 回帰ガード: 手順4前半「魚焼きグリル（またはフライパンに薄く油をひいたもの）を中火で
  // 熱し、…」。D(長括弧の句分割)適用後も「魚焼きグリル」だけの行・「を中火で」で始まる行を作らない。
  const exF = () => [
    txt('魚焼きグリル（またはフライパンに薄く油をひいたもの）を中火で熱し、みそだれを軽くぬぐった鮭の皮目を下にして焼く。'),
  ]
  for (const w of [17, 18, 19]) {
    const linesF = compose(exF(), w)
    eq(`lineCompose 要件F回帰 幅${w}(「魚焼きグリル」だけの行を作らない)`, linesF.includes('魚焼きグリル'), false)
    eq(`lineCompose 要件F回帰 幅${w}(「を中火で」で始まる行を作らない)`, linesF.some((l) => l.startsWith('を中火で')), false)
  }

  // 非退行(借用パスの安全弁): オーナー確認済み「こんにゃくの炒り煮」基準1の幅17/18は貪欲どおり。
  // 行末「下茹でして」は悪い切れ目なので借用を試みるが、次ユニット「ざるにあげ、」の細分節
  // [ざるに][あげ、]は「ざるに」借用で行幅超過(15+3>17)し(a)で棄却、全部借用も超過で棄却→現状維持。
  // (罰則DPも誤発動しない=貪欲の末尾行「ざるにあげ、」6字>4字)
  const exKon = () => [
    txt('鍋にたっぷりの湯を沸かし、こんにゃくを'),
    box('m0', '2分ほど'),
    box('t0', '下茹で'),
    txt('してざるにあげ、水気を切る。'),
  ]
  for (const w of [17, 18]) {
    eq(`lineCompose 非退行 こんにゃく基準1 幅${w}`, compose(exKon(), w), [
      '鍋にたっぷりの湯を沸かし、',
      'こんにゃくを2分ほど下茹でして',
      'ざるにあげ、水気を切る。',
    ])
  }
}

// ---------- lineCompose 改行第5弾(便BA): タイマー箱結合ルールの新エンジン適応(オーナー実機第2波9件) ----------
// 生テキスト→ComposedStepText.buildAtoms(用語/タイマー分解 + 要件2スリム化 + 要件9〜接着)を再現して
// composeLines へ通す。1文字=1幅の偽測定・幅16〜19字相当。hangingPunct は WebKit(true)/Chromium(false)。
{
  const { composeLines, lineToText } = await import('../src/logic/lineCompose.ts')
  const { splitAroundTimeToken, ZWSP } = await import('../src/logic/jaWrap.ts')
  const { findTimeTokens } = await import('../src/logic/time.ts')
  const { splitByTerms } = await import('../src/logic/termSplit.ts')
  const measure = (t) => [...t.replace(new RegExp(ZWSP, 'g'), '')].length
  // ComposedStepText.buildAtoms のロジック再現(node は測らないので省く。text/width/id だけ作る)。
  const buildAtoms = (text) => {
    const atoms = []
    let n = 0
    const seen = new Set()
    for (const seg of splitByTerms(text, seen)) {
      if (seg.type === 'term' && seg.tappable) {
        atoms.push({ kind: 'atom', id: `t${n++}`, text: seg.match.text })
        continue
      }
      const plain = seg.type === 'text' ? seg.text : seg.match.text
      const tokens = findTimeTokens(plain)
      if (tokens.length === 0) {
        if (plain) atoms.push({ kind: 'text', text: plain })
        continue
      }
      let cursor = 0
      tokens.forEach((token, i) => {
        const before = plain.slice(cursor, token.start)
        const afterEnd = i + 1 < tokens.length ? tokens[i + 1].start : plain.length
        const after = plain.slice(token.start + token.text.length, afterEnd)
        const tt = token.text.trim()
        const { pre, bondPrev, bondNext, post } = splitAroundTimeToken(before, after, tt.length)
        const preRaw = pre.replace(new RegExp(ZWSP, 'g'), '')
        if (preRaw) atoms.push({ kind: 'text', text: preRaw })
        // 要件2スリム化: bondNext の ほど/くらい/ぐらい/程度 接尾より後ろの吸収文節が4字以上・非句読点なら箱から出す
        const suffix = bondNext.match(/^(ほど|くらい|ぐらい|程度)/)?.[0] ?? ''
        const absorbed = bondNext.slice(suffix.length)
        let bn = bondNext
        let pulled = ''
        if (absorbed && [...absorbed].length >= 4 && !/[、。]$/.test(absorbed)) {
          bn = suffix
          pulled = absorbed
        }
        atoms.push({ kind: 'atom', id: `m${n++}`, text: bondPrev + tt + bn })
        const postRaw = pulled + post.replace(new RegExp(ZWSP, 'g'), '')
        if (postRaw) atoms.push({ kind: 'text', text: postRaw })
        cursor = afterEnd
      })
    }
    // 要件9: 箱・「〜」・箱を1アトムに接着
    const merged = []
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i]
      const b = atoms[i + 1]
      const c = atoms[i + 2]
      let left = null
      let mid = ''
      let right = null
      if (a.kind === 'atom' && a.text.endsWith('〜') && b && b.kind === 'atom') {
        left = a
        right = b
      } else if (a.kind === 'atom' && b && b.kind === 'text' && b.text === '〜' && c && c.kind === 'atom') {
        left = a
        mid = b.text
        right = c
      }
      if (left && right) {
        merged.push({ kind: 'atom', id: left.id, text: left.text + mid + right.text })
        i += mid ? 2 : 1
        continue
      }
      merged.push(a)
    }
    return merged.map((a) => (a.kind === 'atom' ? { ...a, width: measure(a.text) } : a))
  }
  const c = (text, w, hang = false) =>
    composeLines(buildAtoms(text), w, measure, { eps: 0, hangingPunct: hang }).map(lineToText)

  // 要件1: タイマー箱のtextが読点で終わると句境界(寄せ鍋「あく[10分]煮て、」で句を閉じる)。
  const yosenabe = 'あくを取りながら10分煮て、煮えたものから食べる。'
  for (const w of [17, 18, 19]) {
    eq(`要件1 寄せ鍋 箱内読点で句を閉じる 幅${w}`, c(yosenabe, w), [
      'あくを取りながら10分煮て、',
      '煮えたものから食べる。',
    ])
  }

  // 要件2: からあげ「くらい（約180度）の油で[1分] / 二度揚げするとカラッと仕上がる。」
  // (箱直後の長い文節「二度揚げすると」を切り離す=「の / 油で」の泣き別れも[1分]直後の泣き別れも無い)。
  const karaage =
    '一度取り出して3分休ませ、菜箸を入れて大きな泡が勢いよく出るくらい（約180度）の油で1分二度揚げするとカラッと仕上がる。'
  for (const w of [17, 18, 19]) {
    const lines = c(karaage, w)
    // 「の」で終わる行の次行が「油で…」で始まらない(の/油で泣き別れが無い)
    for (let i = 0; i < lines.length - 1; i++) {
      const bad = /の$/.test(lines[i]) && /^油で/.test(lines[i + 1])
      eq(`要件2 からあげ の/油で泣き別れ無し 幅${w} 行${i}`, bad, false)
    }
    // 「油で1分」を含む行はその行の末尾がタイマー([1分])で、次行が「二度揚げ」から始まる
    eq(`要件2 からあげ 油で[1分]で行を終える 幅${w}`, lines.some((l) => /油で1分$/.test(l)), true)
  }
  eq('要件2 からあげ 幅17 期待行', c(karaage, 17), [
    '一度取り出して3分休ませ、',
    '菜箸を入れて大きな泡が勢いよく出る',
    'くらい（約180度）の油で1分',
    '二度揚げするとカラッと仕上がる。',
  ])

  // 要件3: 大学芋の句「さつまいもを中まで火が通るまで揚げる。」。「。」止まりの短い最終行は切れ端(runt)と
  // みなさずDPで均等割りしない。※この句のユニット構造は[さつまいもを中まで][火が通るまで揚げる。]で、
  // 幅17の「火が通るまで揚げる。」10字は貪欲どおり(元々DP発動しない=元の形)。オーナー「元の形が良い」に整合。
  const daigaku = 'さつまいもを中まで火が通るまで揚げる。'
  eq('要件3 大学芋 幅17 hang=off(。止まり最終行を均等割りしない)', c(daigaku, 17, false), [
    'さつまいもを中まで',
    '火が通るまで揚げる。',
  ])
  // WebKit(hang=on 幅18): ぶら下げ補正で18字の句がまるごと1行(要件4と併せオーナー期待)
  eq('要件3/4 大学芋 幅18 hang=on(句がまるごと1行)', c(daigaku, 18, true), ['さつまいもを中まで火が通るまで揚げる。'])
  // 非退行: 「、」止まりの短い最終行は従来どおり切れ端扱い→DP発動(「加えて、」対策・要件Aの非退行)。
  eq('要件3 非退行 「、」止まり切れ端はDP発動(洗ってない米) 幅17', c('洗っていない米を③のフライパンに加えて、3分ほど透き通るまで炒めます。', 17), [
    '洗っていない米を',
    '③のフライパンに加えて、',
    '3分ほど透き通るまで炒めます。',
  ])

  // 要件4: 肉じゃが「じゃがいも・にんじんは小さめの一口大、」(19字)は WebKit のぶら下げ補正で1行に。
  const nikujaga = 'じゃがいも・にんじんは小さめの一口大、玉ねぎは薄切りにする（小さく切ると火の通りが早い）。'
  eq('要件4 肉じゃが 幅18 hang=on(句読点ぶら下げで19字句が1行)', c(nikujaga, 18, true)[0], 'じゃがいも・にんじんは小さめの一口大、')
  // Chromium(hang=off)は従来判定=はみ出し防止側(19字は1行に入れず分割)
  eq('要件4 肉じゃが 幅18 hang=off(はみ出し防止で1行にしない)', c(nikujaga, 18, false)[0] !== 'じゃがいも・にんじんは小さめの一口大、', true)

  // 要件5: ひじき「浸してもどし、」が1語(もどしをKNOWN_WORDSに追加。語中分断しない)。
  const hijiki = '乾燥ひじきはたっぷりの水に15分ほど浸してもどし、水気を切る。'
  eq('要件5 ひじき 幅18(浸してもどし、が1行)', c(hijiki, 18), [
    '乾燥ひじきはたっぷりの水に15分ほど',
    '浸してもどし、水気を切る。',
  ])
  // 「浸しても」で終わる行(もどしの語中分断)が無い
  for (const w of [16, 17, 18, 19])
    eq(`要件5 ひじき 語中分断なし 幅${w}`, c(hijiki, w).some((l) => /浸しても$/.test(l)), false)

  // 要件7: 水ようかん「沸騰後も1〜[2分]ほど / しっかり煮て寒天を溶かす。」(しっかり煮てが同じ行)。
  const yokan = '混ぜながら煮立たせ、沸騰後も1〜2分ほどしっかり煮て寒天を溶かす。'
  for (const w of [17, 18, 19]) {
    const lines = c(yokan, w)
    eq(`要件7 水ようかん しっかり煮てが同じ行 幅${w}`, lines.some((l) => /しっかり煮て/.test(l)), true)
    // 「しっかり」で終わる行(しっかり|煮ての分断)が無い
    eq(`要件7 水ようかん しっかり|煮て分断なし 幅${w}`, lines.some((l) => /しっかり$/.test(l)), false)
  }
  eq('要件7 水ようかん 幅17 期待行', c(yokan, 17), [
    '混ぜながら煮立たせ、',
    '沸騰後も1〜2分ほど',
    'しっかり煮て寒天を溶かす。',
  ])

  // 要件9: 冷やしトマト 箱・「〜」・箱を1アトムに接着=「〜」の前後で割れない。
  const tomato = 'トマトを漬け汁に入れ、冷蔵庫で30分〜1時間ほど漬ける。'
  // buildAtoms が2つのタイマー箱を1アトムに接着している(タイマー箱の数=1)
  const tomatoAtoms = buildAtoms(tomato)
  eq('要件9 冷やしトマト 〜で2箱が1アトムに接着', tomatoAtoms.filter((a) => a.kind === 'atom').length, 1)
  for (const w of [17, 18, 19]) {
    const lines = c(tomato, w)
    // 行末が「〜」で終わらない(〜の直後で割れない)
    eq(`要件9 冷やしトマト 行末〜なし 幅${w}`, lines.some((l) => /〜$/.test(l)), false)
    eq(`要件9 冷やしトマト 〜前後同じ行 幅${w}`, lines.some((l) => /30分〜1時間/.test(l)), true)
  }

  // ---- 要件8: オーナー承認済みレンダリング回帰集(本便の全変更後も全通過が統合条件) ----
  // 基準1 こんにゃく(2分ほど下茹でしてが同じ行)
  eq('回帰集 こんにゃく基準1 幅17', c('鍋にたっぷりの湯を沸かし、こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。', 17), [
    '鍋にたっぷりの湯を沸かし、',
    'こんにゃくを2分ほど下茹でして',
    'ざるにあげ、水気を切る。',
  ])
  // しょうゆ・みりん・砂糖を加えて / 炒り煮にする。(炒り煮=用語箱)
  eq('回帰集 しょうゆ・みりん・砂糖 幅17', c('しょうゆ・みりん・砂糖を加えて炒り煮にする。', 17), [
    'しょうゆ・みりん・砂糖を加えて',
    '炒り煮にする。',
  ])
  // タンドリー型: 320px相当(幅16)で「鶏肉を加え、/袋の上から手でよくもみ込んで/下味をなじませ、/冷蔵庫で…」
  eq('回帰集 タンドリー型 幅16', c('鶏肉を加え、袋の上から手でよくもみ込んで下味をなじませ、冷蔵庫で30分ほど置く。', 16), [
    '鶏肉を加え、',
    '袋の上から手でよくもみ込んで',
    '下味をなじませ、',
    '冷蔵庫で30分ほど置く。',
  ])
  // 「もみ込んで」の語中分断が無い(便AZのKNOWN_WORD固定の非退行)
  for (const w of [16, 17, 18, 19])
    eq(`回帰集 タンドリー もみ込んで語中分断なし 幅${w}`, c('鶏肉を加え、袋の上から手でよくもみ込んで下味をなじませ、冷蔵庫で30分ほど置く。', w).some((l) => /も$/.test(l) || /^み込/.test(l)), false)
  // 水切り型: 「…をのせて水切りする。」で行終止(切る系の言い切りが行末)
  eq('回帰集 水切り型 幅17', c('木綿豆腐はキッチンペーパーに包み、重し(皿など)をのせて水切りする。', 17), [
    '木綿豆腐はキッチンペーパーに包み、',
    '重し(皿など)をのせて水切りする。',
  ])

  // 全ケース整合性: どの幅・hangでも行連結が原文(ZWSP除去)に一致(欠落・重複・並べ替え無し)
  const strip = (s) => s.replace(new RegExp(ZWSP, 'g'), '')
  for (const text of [yosenabe, karaage, daigaku, nikujaga, hijiki, yokan, tomato]) {
    for (const w of [16, 17, 18, 19]) {
      for (const hang of [false, true]) {
        eq(`要件整合性 「${text.slice(0, 6)}…」幅${w}hang${hang ? 1 : 0}`, c(text, w, hang).join(''), strip(text))
        // 行頭禁則: 「、」「。」「〜」で始まる行が無い
        eq(`要件行頭禁則 「${text.slice(0, 6)}…」幅${w}hang${hang ? 1 : 0}`, c(text, w, hang).some((l) => /^[、。〜]/.test(l)), false)
      }
    }
  }
}

// ---------- lineCompose 改行第6弾(便BB): 指摘1「連続する格助詞『を』の詰め込み回避」+ メモ用アトム ----------
// 生テキスト→buildAtoms(手順=タイマー/用語/スリム化/接着) と buildMemoAtoms(メモ=用語箱のみ)を再現して
// composeLines へ通す。1文字=1幅の偽測定・幅16〜19字相当。
{
  const { composeLines, lineToText } = await import('../src/logic/lineCompose.ts')
  const { splitAroundTimeToken, ZWSP } = await import('../src/logic/jaWrap.ts')
  const { findTimeTokens } = await import('../src/logic/time.ts')
  const { splitByTerms } = await import('../src/logic/termSplit.ts')
  const measure = (t) => [...t.replace(new RegExp(ZWSP, 'g'), '')].length
  // 手順アトム(第5弾ブロックと同一ロジック)
  const buildStepAtoms = (text) => {
    const atoms = []
    let n = 0
    const seen = new Set()
    for (const seg of splitByTerms(text, seen)) {
      if (seg.type === 'term' && seg.tappable) { atoms.push({ kind: 'atom', id: `t${n++}`, text: seg.match.text }); continue }
      const plain = seg.type === 'text' ? seg.text : seg.match.text
      const tokens = findTimeTokens(plain)
      if (tokens.length === 0) { if (plain) atoms.push({ kind: 'text', text: plain }); continue }
      let cursor = 0
      tokens.forEach((token, i) => {
        const before = plain.slice(cursor, token.start)
        const afterEnd = i + 1 < tokens.length ? tokens[i + 1].start : plain.length
        const after = plain.slice(token.start + token.text.length, afterEnd)
        const tt = token.text.trim()
        const { pre, bondPrev, bondNext, post } = splitAroundTimeToken(before, after, tt.length)
        const preRaw = pre.replace(new RegExp(ZWSP, 'g'), '')
        if (preRaw) atoms.push({ kind: 'text', text: preRaw })
        const suffix = bondNext.match(/^(ほど|くらい|ぐらい|程度)/)?.[0] ?? ''
        const absorbed = bondNext.slice(suffix.length)
        let bn = bondNext, pulled = ''
        if (absorbed && [...absorbed].length >= 4 && !/[、。]$/.test(absorbed)) { bn = suffix; pulled = absorbed }
        atoms.push({ kind: 'atom', id: `m${n++}`, text: bondPrev + tt + bn })
        const postRaw = pulled + post.replace(new RegExp(ZWSP, 'g'), '')
        if (postRaw) atoms.push({ kind: 'text', text: postRaw })
        cursor = afterEnd
      })
    }
    return atoms.map((a) => (a.kind === 'atom' ? { ...a, width: measure(a.text) } : a))
  }
  // メモアトム(ComposedMemoSentence.buildMemoAtoms 再現: 用語箱のみ・タイマー化しない・材料下線しない)
  const buildMemoAtoms = (text) => {
    const atoms = []
    let n = 0
    const seen = new Set()
    for (const seg of splitByTerms(text, seen)) {
      if (seg.type === 'term' && seg.tappable) atoms.push({ kind: 'atom', id: `t${n++}`, text: seg.match.text })
      else { const t = seg.type === 'text' ? seg.text : seg.match.text; if (t) atoms.push({ kind: 'text', text: t }) }
    }
    return atoms.map((a) => (a.kind === 'atom' ? { ...a, width: measure(a.text) } : a))
  }
  const cs = (text, w, hang = false) => composeLines(buildStepAtoms(text), w, measure, { eps: 0, hangingPunct: hang }).map(lineToText)
  const cm = (text, w, hang = false) => composeLines(buildMemoAtoms(text), w, measure, { eps: 0, hangingPunct: hang }).map(lineToText)

  // 指摘1: 「白菜と豚肉を切り口を上にして耐熱皿に並べ、酒を回しかける。」(オーナー実機・白菜と豚しゃぶ手順3)。
  // jaWrap が「白菜と豚肉を」+「切り口を」を1ユニットに過結合するため BASE は「白菜と豚肉を切り口を」で
  // 「を」止まり文節が2つ詰まっていた。「を」バンチ分割+罰則DPで「白菜と豚肉を / 切り口を…」に離す。
  const hakusai = '白菜と豚肉を切り口を上にして耐熱皿に並べ、酒を回しかける。'
  for (const w of [16, 17, 18, 19]) {
    for (const hang of [false, true]) {
      eq(`指摘1 白菜と豚肉を 幅${w}hang${hang ? 1 : 0}(「白菜と豚肉を」で2行目に送る)`, cs(hakusai, w, hang), [
        '白菜と豚肉を',
        '切り口を上にして耐熱皿に並べ、',
        '酒を回しかける。',
      ])
      // 「を」止まり文節が同じ行に2つ詰まらない(隣接『を』ペアの行が無い)
      const lines = cs(hakusai, w, hang)
      const bunched = lines.some((l) => {
        const us = l.replace(new RegExp(ZWSP, 'g'), '')
        return /を.*を$/.test(us) && us.length <= 12 // 1行内に「を」止まり文節が2つ詰まった短い行
      })
      eq(`指摘1 白菜と豚肉を 幅${w}hang${hang ? 1 : 0}(「を」バンチ無し)`, bunched, false)
    }
  }

  // 巻き添え確認(同型・意図した改善): 鶏の照り焼き quickStep「耐熱皿に鶏肉を皮目を上にして並べ、たれをかける。」
  // も「鶏肉を」「皮目を」の連続格助詞バンチ。左「耐熱皿に鶏肉を」(7字)≥5で昇格維持。折り返す幅16で
  // 「耐熱皿に鶏肉を / 皮目を…」に離れる(幅17〜19は句が1行に収まるので分割不要=単一行)。
  eq('指摘1 同型 鶏照り焼きquick 幅16(鶏肉を/皮目を に離す)', cs('耐熱皿に鶏肉を皮目を上にして並べ、たれをかける。', 16), [
    '耐熱皿に鶏肉を',
    '皮目を上にして並べ、',
    'たれをかける。',
  ])
  eq('指摘1 同型 鶏照り焼きquick 幅17(句が1行に収まる)', cs('耐熱皿に鶏肉を皮目を上にして並べ、たれをかける。', 17), [
    '耐熱皿に鶏肉を皮目を上にして並べ、',
    'たれをかける。',
  ])

  // 昇格ガード(便BB追補・司令部裁定): 春雨サラダ steps[0]「鍋にたっぷりの湯を沸かし、春雨を袋の表示時間を
  // 目安に茹でて水気を切り、食べやすい長さに切る。」。「春雨を」(3字<5)は昇格しない=短い格助詞単独行を
  // 作らない。さらに「を」過結合ユニットで終わる行は借用パスが次の良い切れ目(目安に=に)まで伸ばし、
  // 束縛句「表示時間を目安に」を割らない。オーナー明示の受け入れ形(4行・「春雨を袋の表示時間を目安に」が1行)。
  const harusame = '鍋にたっぷりの湯を沸かし、春雨を袋の表示時間を目安に茹でて水気を切り、食べやすい長さに切る。'
  for (const w of [17, 18, 19]) {
    for (const hang of [false, true]) {
      const lines = cs(harusame, w, hang)
      // 受け入れの要: 1行目=読点で終わる沸かし、/ 2行目=「春雨を袋の表示時間を目安に」(束縛句を割らず「目安に」で折る)
      eq(`ガード 春雨 1行目 幅${w}hang${hang ? 1 : 0}`, lines[0], '鍋にたっぷりの湯を沸かし、')
      eq(`ガード 春雨 2行目「春雨を袋の表示時間を目安に」 幅${w}hang${hang ? 1 : 0}`, lines[1], '春雨を袋の表示時間を目安に')
      // 3行目は「茹でて水気を切り、」で始まる(幅19hang=onは末尾句が同行に収まり1行に伸びるのは可)
      eq(`ガード 春雨 3行目は茹でてから 幅${w}hang${hang ? 1 : 0}`, /^茹でて水気を切り、/.test(lines[2] || ''), true)
      // 「春雨を」単独行(3字の格助詞単独行)が出ない
      eq(`ガード 春雨 「春雨を」単独行が出ない 幅${w}hang${hang ? 1 : 0}`, lines.includes('春雨を'), false)
    }
  }
  // 幅16〜18(末尾が同行に収まらない幅)ではオーナー明示の4行形になる
  eq('ガード 春雨 受け入れ4行形 幅17hang=off', cs(harusame, 17, false), [
    '鍋にたっぷりの湯を沸かし、',
    '春雨を袋の表示時間を目安に',
    '茹でて水気を切り、',
    '食べやすい長さに切る。',
  ])

  // 承認済み回帰の非退行(「を」変更後も): 1つの「を」止まり文節は従来どおり(鮭の皮目を型を割らない)。
  eq('指摘1 非退行 鮭の皮目を(単一「を」は割らない)', cs('みそだれを軽くぬぐった鮭の皮目を下にして焼く。', 17), [
    'みそだれを軽くぬぐった鮭の皮目を',
    '下にして焼く。',
  ])
  eq('指摘1 非退行 こんにゃく基準1 幅17', cs('鍋にたっぷりの湯を沸かし、こんにゃくを2分ほど下茹でしてざるにあげ、水気を切る。', 17), [
    '鍋にたっぷりの湯を沸かし、',
    'こんにゃくを2分ほど下茹でして',
    'ざるにあげ、水気を切る。',
  ])
  eq('指摘1 非退行 しょうゆ・みりん・砂糖 幅17', cs('しょうゆ・みりん・砂糖を加えて炒り煮にする。', 17), [
    'しょうゆ・みりん・砂糖を加えて',
    '炒り煮にする。',
  ])

  // ---- メモ用アトム: 用語箱のみ・タイマー化しない・材料下線しない(タスク1) ----
  // 時間表記を含むメモ文はタイマー箱(digit+分/時間/秒 の atom)を作らない=素のテキストのまま組む。
  const memoTimeAtoms = buildMemoAtoms('赤ければ1分ずつ追加で加熱する。')
  eq('メモ 時間表記をタイマー箱化しない', memoTimeAtoms.some((a) => a.kind === 'atom' && /\d\s*(分|時間|秒)/.test(a.text || '')), false)
  eq('メモ 時間表記文の整合性(素テキストで組む) 幅12', cm('赤ければ1分ずつ追加で加熱する。', 12).join(''), '赤ければ1分ずつ追加で加熱する。')
  // 辞書語(用語)はタップ可能な分割不能箱(atom)として残る
  const memoTermAtoms = buildMemoAtoms('こんにゃくを下茹でしてから加える。')
  eq('メモ 用語はタップ箱(atom)として残す', memoTermAtoms.some((a) => a.kind === 'atom' && a.text === '下茹で'), true)
  // 用語箱を含むメモ文が禁則を守って組める(行頭に、。〜が来ない・整合)
  for (const w of [10, 12, 14, 17]) {
    const lines = cm('こんにゃくを下茹でしてから加え、味をなじませる。', w)
    eq(`メモ 用語箱含む文 整合性 幅${w}`, lines.join(''), 'こんにゃくを下茹でしてから加え、味をなじませる。')
    eq(`メモ 用語箱含む文 行頭禁則 幅${w}`, lines.some((l) => /^[、。〜]/.test(l)), false)
  }
  // 用語が無い純テキストのメモ文も読点優先で組める(・箇条書きの1文相当)
  eq('メモ 純テキスト文 読点優先 幅8', cm('あいう、えお、かき。', 8), ['あいう、えお、', 'かき。'])
}

// ---------- 結果 ----------
console.log(`合格: ${passed}件 / 失敗: ${failures.length}件`)
for (const f of failures) console.log(`  NG ${f}`)
process.exit(failures.length > 0 ? 1 : 0)
