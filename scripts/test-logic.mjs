// L1: 純ロジックの単体回帰テスト(docs/10 3章のL1追加候補①③⑤の常設化)。
// DOM・Dexie不要のロジックだけを対象にする。実行: npx tsx scripts/test-logic.mjs
// 新しいバグを直したら、必ずここに再発防止のケースを1行足すこと(PDCAの蓄積点)。
import {
  scaleAmount,
  formatAmountUnit,
  normalizeDigits,
  normalizeAmountInput,
  expandMixedFraction,
} from '../src/logic/amount.ts'
import { leadingRangeAmount } from '../src/logic/amount.ts'
import { isHttpUrl } from '../src/logic/url.ts'
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
  toTagKey,
  toPantryKey,
  titleKanaKey,
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
import {
  isAtFreeLimit,
  isNearFreeLimit,
  isInWarningRange,
  freeLimitRemaining,
  FREE_LIMIT,
  FREE_LIMIT_WARNING_THRESHOLD,
} from '../src/logic/freeLimit.ts'
import { parseAmountNumber, convertToGrams, computeRecipeNutrition } from '../src/logic/nutrition.ts'
import { isNewsSuppressed } from '../src/logic/news.ts'
import {
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  isPastDate,
  shiftDate,
  dowIndex,
  sortMealSlots,
  excludeYesterdayPlanRecipes,
  normalizeDateRange,
  rangeDayCount,
  isOneDish,
  proteinSourceOf,
  preferredProteinSources,
  chooseBalancedPair,
  PURPOSE_REDRAW_ATTEMPTS,
  isSlipperyDish,
  dishAvoidKeys,
  detectGenreMix,
  isMainDish,
  recipeGenre,
  cookedPlanEntryIds,
  mealOccasionCount,
  planRoleAssign,
} from '../src/logic/mealPlan.ts'
import { preferSeasonWithFallback, SEASON_MIN_CANDIDATES } from '../src/logic/season.ts'
import { guessDishType } from '../src/logic/dishTypeGuess.ts'
import { PRICE_DEFAULTS } from '../src/data/priceDefaults.ts'
import {
  buildShoppingCandidates,
  sortShoppingByAisle,
  combineAmountTexts,
  parseRecipeIdsParam,
} from '../src/logic/shopping.ts'
import { selectPantryDowngrades } from '../src/logic/pantry.ts'
import {
  categorizePantryName,
  resolvePantryGroup,
  groupPantryItems,
  categorizedFoodLabels,
  normalizeAisleOrder,
  moveAisleGroup,
  isDefaultAisleOrder,
  SHOPPING_AISLE_ORDER,
} from '../src/logic/pantryGroups.ts'
import {
  summarizeRecipeDeleteImpact,
  buildBulkDeleteConfirmText,
  isRestorableStarter,
} from '../src/logic/recipeDelete.ts'
import { NUTRITION_DATA } from '../src/logic/nutritionData.ts'
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
  buildReplaceSettings,
  mergeTableRows,
  mergeRowKeys,
  resolveMergeRecipeAction,
  mergeRecipeUserData,
  remapBackupRecipeRefs,
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
  isFreeSortOption,
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  PRO_NUTRIENT_SORT_OPTIONS,
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
  pricelessIngredientNames,
  pricelessIngredientNamesOfRecipes,
  sumCookedRecipesCost,
  normalizeIngredientNameForPrice,
} from '../src/logic/priceEstimate.ts'
import {
  splitRangeByToday,
  summarizeRangeIntake,
  rangeIntakeRecipes,
  dayIntakeMap,
} from '../src/logic/rangeSummary.ts'
import {
  DAILY_GUIDES,
  RANGE_EXCLUDED_RATIO_LIMIT,
  PURPOSE_NUTRIENT_KEY,
  canCompareDay,
  canCompareRange,
  dayBalanceMap,
  guideForDays,
  purposeAxisValue,
  purposePenalty,
  RICE_SERVING_RECIPE,
  reviewPurposeDays,
  riceServingGrams,
  riceServingRecipes,
  slotBalances,
  sumBalance,
  summarizeWeekBalance,
  vegetableGrams,
} from '../src/logic/nutritionBalance.ts'
import {
  COOK_NAVI_TRIAL_LIMIT,
  MONTH_TRIAL_LIMIT,
  MONTH_TRIAL_MIN_COOKED,
  canUseCookNaviTrial,
  canUseMonthTrial,
  consumeCookNaviTrial,
  cookNaviTrialRemaining,
  isCookNaviTrialExhausted,
  isMonthTrialReady,
} from '../src/logic/proTrial.ts'
import { normalizeUnit, parseUnitQuantity } from '../src/logic/unitGrams.ts'
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
import { cookedWithinDays } from '../src/logic/cooked.ts'
import {
  ARCHIVE_KIND,
  ArchiveFileError,
  archiveCutoffDate,
  archiveFileName,
  archiveIdsForRecipe,
  buildArchiveFile,
  collectArchiveTargets,
  countArchiveTargets,
  formatArchiveDate,
  mergeArchiveLogs,
  parseArchiveFile,
} from '../src/logic/cookedArchive.ts'
import { buildImageProxyUrl, isImageContentType } from '../src/logic/urlImportImage.ts'
import { resolveImportErrorReason } from '../src/logic/urlImportReason.ts'
import {
  buildImportedIngredientRows,
  filterImportedSteps,
  seasoningGroupFromLetter,
  countAmountlessRows,
} from '../src/logic/urlImportRows.ts'
import { MIN_SERVINGS, MAX_SERVINGS, clampServings, isServingsInRange } from '../src/logic/servings.ts'
import {
  photoReplacePlan,
  replaceConfirmTargets,
  needsReplaceConfirm,
} from '../src/logic/replaceConfirm.ts'
import { matchVoiceCommand } from '../src/logic/voiceCommand.ts'
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

/** 「同じであってはいけない」検査(名寄せキーが別食材どうしでぶつかっていないか等) */
function neq(label, actual, notExpected) {
  if (JSON.stringify(actual) !== JSON.stringify(notExpected)) {
    passed++
  } else {
    failures.push(`${label}: 実際=${JSON.stringify(actual)} 期待=これ以外`)
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

// ---------- scaleAmount: 帯分数「1と1/2」(2026-07-28 便BW/C-18) ----------
// 実機QA: 「水 1と1/2 カップ」だけ人数変更で倍にならず据え置かれていた。アプリ自身が人数変更後の
// 表示に帯分数を使う(formatFraction)ため、その表示を保存して開き直すと解釈できない往復の穴だった
eq('帯分数「1と1/2」を2倍(2→4人分)', scaleAmount('1と1/2', 2, 4, 'カップ'), '3')
eq('帯分数「1と1/2」を半分(2→1人分)', scaleAmount('1と1/2', 2, 1, 'カップ'), '3/4')
eq('帯分数「1と1/2」(単位=本)を2倍', scaleAmount('1と1/2', 2, 4, '本'), '3')
eq('中黒の帯分数「1・1/2」も同じ', scaleAmount('1・1/2', 2, 4, 'カップ'), '3')
eq('全角の帯分数「１と１／２」も同じ', scaleAmount('１と１／２', 2, 4, 'カップ'), '3')
eq('帯分数はg単位でも倍になる', scaleAmount('1と1/2', 2, 4, 'g'), '3')
eq('帯分数の展開(解釈専用)', expandMixedFraction('1と1/2'), '1.5')
eq('帯分数でない文字列は素通し', expandMixedFraction('少々'), '少々')
// 帯分数が栄養計算の対象外にならないこと(同じ書き方が計算にも乗る)
eq('栄養: 帯分数「1と1/2」', parseAmountNumber('1と1/2'), 1.5)

// ---------- ひらがな単位「おおさじ」「こさじ」(2026-07-28 便BW・QA S3) ----------
// 「おおさじ2」と入力すると単位が後ろに回り「2おおさじ」と表示されていた。
// 表記は原文のまま尊重し、並び順と丸め幅だけを大さじ/小さじと揃える
eq('おおさじは単位が先', formatAmountUnit('2', 'おおさじ'), 'おおさじ2')
eq('こさじは単位が先', formatAmountUnit('1/2', 'こさじ'), 'こさじ1/2')
eq('おおさじも0.25刻み+帯分数でスケールする', scaleAmount('1', 2, 5, 'おおさじ'), '2と1/2')

// ---------- formatAmountUnit(表示順 = 大さじ/小さじ/カップは単位が先) ----------
eq('大さじは単位が先', formatAmountUnit('2', '大さじ'), '大さじ2')
eq('gは数量が先', formatAmountUnit('200', 'g'), '200g')
eq('単位なし', formatAmountUnit('適量', ''), '適量')
eq('分量なし', formatAmountUnit('', '本'), '本')

// ---------- isHttpUrl(参照元URLの検証。2026-07-28 便BW/C-19) ----------
// 実機QA: 「javascript:alert(1)」や「これはURLではない」が保存でき、押しても何も起きない
// 「参照元」リンクが詳細ページに出ていた。保存前の指摘と詳細ページのリンク化で同じ判定を使う
eq('http URL', isHttpUrl('http://example.com/recipe'), true)
eq('https URL', isHttpUrl('https://uchirecipe.com/'), true)
eq('前後の空白は無視', isHttpUrl('  https://example.com  '), true)
eq('javascript: は不可', isHttpUrl('javascript:alert(1)'), false)
eq('data: は不可', isHttpUrl('data:text/html,<script>alert(1)</script>'), false)
eq('URLでない文字列は不可', isHttpUrl('これはURLではない'), false)
eq('スキームなしは不可', isHttpUrl('example.com'), false)
eq('空文字は不可', isHttpUrl(''), false)

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
  // 2026-07-28 便BX/C06: カタカナ助数詞「ワ」(把)は計算側(栄養・原価・人数スケール)が
  // 知らない表記のため、既知の「束」へ寄せる(旧期待値は unit='ワ' でそのまま計算対象外だった)
  'M8(2): 「そうめん4ワ（200g）」→unit=束(ワの正規化)+memo=200g',
  parseRecipeText('材料\nそうめん4ワ（200g）').ingredients[0],
  { name: 'そうめん', amount: '4', unit: '束', memo: '200g' },
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

// ---------- 材料の「まとめて入力」(2026-07-28 便BW/C-07) ----------
// 「豚こま 200g」と1行で書いて材料を足せる速記欄。分解は貼り付け取込と同じ資産
// (normalizeImportedIngredient→parseIngredientLine)を使い、分けられなければ名前欄に入れる
{
  eq('C-07: 「豚こま 200g」を名前/分量/単位に分ける', normalizeImportedIngredient('豚こま 200g'), {
    name: '豚こま',
    amount: '200',
    unit: 'g',
  })
  eq('C-07: 単位が前に来る「しょうゆ 大さじ2」', normalizeImportedIngredient('しょうゆ 大さじ2'), {
    name: 'しょうゆ',
    amount: '2',
    unit: '大さじ',
  })
  eq('C-07: 「塩 少々」', normalizeImportedIngredient('塩 少々'), {
    name: '塩',
    amount: '少々',
    unit: '',
  })
  eq('C-07: くっつき表記「玉ねぎ1個」', normalizeImportedIngredient('玉ねぎ1個'), {
    name: '玉ねぎ',
    amount: '1',
    unit: '個',
  })
  eq('C-07: 分けられない入力は名前欄へ(黙って捨てない)', normalizeImportedIngredient('あまったお肉'), {
    name: 'あまったお肉',
    amount: '',
    unit: '',
  })
}

// ---------- 貼り付け解析 第3弾: 走り書きノート・SNS投稿(2026-07-28 便BW/C-03・C-06) ----------
// 実機QA+ペルソナ5体診断の再発防止。診断の主症状は3つ:
//  (1) 「・材料名...分量」の点区切りが分離されず材料名に「...」が残る
//  (2) 走り書き(1行に複数材料・句点で終わる手順)で材料↔手順が丸ごと入れ替わる
//  (3) SNS投稿で感想文が料理名として採用され、本当の料理名は前処理で捨てられる
{
  // (1) 点区切り(半角ピリオド・中黒の連続)。三点リーダー「…」は従来から対応済み
  const r = parseRecipeText(
    '【材料】(2人分)\n・スパゲッティ...200g\n・ツナ缶...1缶\n・塩こしょう...少々\n・しょうゆ 適宜\n・塩 少し',
  )
  eq('C-03: 半角ピリオド区切りで材料名に「...」が残らない', r.ingredients, [
    { name: 'スパゲッティ', amount: '200', unit: 'g' },
    { name: 'ツナ缶', amount: '1', unit: '缶' },
    { name: '塩こしょう', amount: '少々', unit: '' },
    { name: 'しょうゆ', amount: '適宜', unit: '' },
    { name: '塩', amount: '少し', unit: '' },
  ])
  const r2 = parseRecipeText('【材料】\n・にんじん・・・1本\n・玉ねぎ・・・1/2個')
  eq('C-03: 中黒の連続も区切りとして扱う', r2.ingredients, [
    { name: 'にんじん', amount: '1', unit: '本' },
    { name: '玉ねぎ', amount: '1/2', unit: '個' },
  ])
  // 単独の中黒は材料名の一部として保つ(「A・B調味料」を壊さない)
  const r3 = parseRecipeText('【材料】\nゆず胡椒・柚子皮 少々')
  eq('C-03: 単独の中黒は材料名のまま', r3.ingredients, [
    { name: 'ゆず胡椒・柚子皮', amount: '少々', unit: '' },
  ])
}
{
  // (2) 走り書き: 1行に材料を複数書く形と、句点で終わる手順文
  const r = parseRecipeText(
    'ぶり大根\nぶり2切れ 大根1/3 しょうが少し\n大根は下ゆで。ぶりは霜降り。\n煮汁を沸かして20分煮る',
  )
  eq('C-03: 走り書きの料理名', r.title, 'ぶり大根')
  eq('C-03: 1行に複数の材料を書いた走り書きを材料として拾う', r.ingredients, [
    { name: 'ぶり', amount: '2', unit: '切れ' },
    { name: '大根', amount: '1/3', unit: '' },
    { name: 'しょうが', amount: '少し', unit: '' },
  ])
  eq('C-03: 句点で終わる走り書きの文は手順に入る(材料に化けない)', r.steps, [
    '大根は下ゆで。ぶりは霜降り。',
    '煮汁を沸かして20分煮る',
  ])
  // 連用形終わりの手順文(「〜を〜炒め」)も手順として扱う。格助詞「を」が無い材料名は巻き込まない
  const r2 = parseRecipeText('材料\n玉ねぎ 1個\nにんじんの千切り\n作り方\n玉ねぎをあめ色になるまで炒め')
  eq('C-03: 「にんじんの千切り」は材料のまま', r2.ingredients, [
    { name: '玉ねぎ', amount: '1', unit: '個' },
    { name: 'にんじんの千切り', amount: '', unit: '' },
  ])
  eq('C-03: 連用形で終わる手順文は手順', r2.steps, ['玉ねぎをあめ色になるまで炒め'])
}
{
  // (3) SNS投稿: 感想が先・料理名が後。従来は感想が料理名になり、料理名の行は捨てられていた
  const sns = `やばい、これ本当に簡単でびっくりした
鶏むね肉のやわらか照り焼き
材料（2人分）
鶏むね肉\t1枚
しょうゆ\t大さじ2
作り方
1. 鶏むね肉をそぎ切りにする
2. フライパンで焼く`
  const r = parseRecipeText(sns)
  eq('C-06: 感想文ではなく料理名がタイトルになる', r.title, '鶏むね肉のやわらか照り焼き')
  eq('C-06: 材料は従来どおり2件', r.ingredients.length, 2)
  // 体言止めのキャッチコピーなど、句読点も丁寧語も無い行は従来どおりタイトル候補のまま
  const r2 = parseRecipeText('【簡単すぎる】無限ピーマン\n材料\nピーマン 4個\n作り方\n1. 切る')
  eq('C-06: 記号つきの短い料理名は従来どおり採用', r2.title, '【簡単すぎる】無限ピーマン')
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
    // 2026-07-28 便BW/C-03: 単位の後ろの「くらい」は単位の一部として保存しない
    // (「本くらい」のままだと栄養・原価の集計から静かに外れるため。旧期待値は unit='本くらい')
    { name: '青ねぎ', amount: '10', unit: '本' },
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
  eq('R5: 材料10件・みりん大さじ2分離・4ワ→unit=束(正規化)+memo=200g・＊行が材料に入らない', r.ingredients, [
    { name: '桜えび （乾）', amount: '10', unit: 'g' },
    { name: '鶏ひき肉', amount: '250', unit: 'g' },
    { name: 'みりん', amount: '2', unit: '大さじ' },
    { name: 'しょうゆ', amount: '2', unit: '小さじ' },
    { name: '塩', amount: '1/2', unit: '小さじ' },
    { name: 'こしょう', amount: '1/2', unit: '小さじ' },
    { name: 'そうめん', amount: '4', unit: '束', memo: '200g' },
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
// F7(2026-07-23 便BJ): 行全体がURLだけの行は手順に化けず除去される(共有テキスト末尾の入口URLや
// レシピサイトからの貼り付けに混ざるリンク対策)。URLを含むだけの手順文(部分一致)は消えない
eq(
  'F7: 末尾のURL単独行(共有テキストの入口URL)は手順に混ざらない',
  parseRecipeText('作り方\n1. 焼く\n2. 盛る\n\n#うちレシピ\nhttps://uchirecipe.com/').steps,
  ['焼く', '盛る'],
)
eq(
  '負例F7: URLを含むだけの手順文(行全体がURLでない)は消えない',
  parseRecipeText('作り方\n1. https://example.com を参考に飾り付ける').steps,
  ['https://example.com を参考に飾り付ける'],
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

// ---------- toTagKey(タグ候補のかな検索。2026-07-28 便BW・QA S3) ----------
// 実機QA: 既存タグに「夏」「作り置き」があるのに「なつ」「つく」と打っても候補が出なかった
// (読み仮名辞書は食材名だけで、タグ語の読みを持っていなかった)
{
  const suggest = (query, existing) =>
    existing.filter((t) => t !== query && toTagKey(t).includes(toTagKey(query)))
  const existingTags = ['夏', '作り置き', '和食', 'サラダ', '子ども']
  eq('タグ候補: 「なつ」→夏', suggest('なつ', existingTags), ['夏'])
  eq('タグ候補: 「つく」→作り置き', suggest('つく', existingTags), ['作り置き'])
  eq('タグ候補: 「わ」→和食', suggest('わ', existingTags), ['和食'])
  eq('タグ候補: 半角カナ「ｻﾗﾀﾞ」→サラダ(既存の挙動を維持)', suggest('ｻﾗﾀﾞ', existingTags), ['サラダ'])
  eq('タグ候補: 「こども」→子ども', suggest('こども', existingTags), ['子ども'])
  eq('タグ読み: 夏', toTagKey('夏'), 'なつ')
  eq('タグ読み: 作り置き', toTagKey('作り置き'), 'つくりおき')
  eq('タグ読み: 辞書にない語はそのまま', toTagKey('ぬか床'), 'ぬか床')
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
  // ---- 2026-07-29 便CD: PDCA2周目・献立診断の再発防止 ----

  // MP-02 曜日ラベル: 曜日は必ず日付から引く(月曜始まり 0=月 … 6=日)。
  // 以前は7日カードの並び順(配列インデックス)で引いており、「今日から7日間」表示では
  // 今日が月曜の日以外は全行の曜日が嘘になっていた
  eq('dowIndex: 2026-07-27(月)→0', dowIndex('2026-07-27'), 0)
  eq('dowIndex: 2026-07-29(水)→2', dowIndex('2026-07-29'), 2)
  eq('dowIndex: 2026-08-02(日)→6', dowIndex('2026-08-02'), 6)
  eq('dowIndex: 月をまたいでも日付から引ける(2026-08-01=土)', dowIndex('2026-08-01'), 5)
  {
    // 「今日から7日間」の再現: 水曜起点で7日並べると 水木金土日月火 になる(並び順とは一致しない)
    const rolling = Array.from({ length: 7 }, (_, i) => dowIndex(shiftDate('2026-07-29', i)))
    eq('dowIndex: 今日(水)起点の7日間は 水木金土日月火 の順になる', rolling, [2, 3, 4, 5, 6, 0, 1])
    eq('dowIndex: 並び順インデックスとは一致しない(旧実装の再発防止)', rolling.every((d, i) => d === i), false)
  }

  // MP-10 食事帯の並び: 押した順ではなく必ず 朝食→昼食→夕食 の順にする
  eq('sortMealSlots: 押した順(夕→朝→昼)でも朝昼夕に並べ直す', sortMealSlots(['dinner', 'breakfast', 'lunch']), ['breakfast', 'lunch', 'dinner'])
  eq('sortMealSlots: 既に正しい順はそのまま', sortMealSlots(['breakfast', 'dinner']), ['breakfast', 'dinner'])
  eq('sortMealSlots: 1件でも壊れない', sortMealSlots(['dinner']), ['dinner'])
  {
    const original = ['dinner', 'breakfast']
    sortMealSlots(original)
    eq('sortMealSlots: 元の配列を書き換えない(設定値を壊さない)', original, ['dinner', 'breakfast'])
  }

  // MP-03 たんぱく源分散の絞り込み: 'その他'を候補に入れ、「最少ちょうど」から「最少+1まで」に緩める。
  // 以前は'その他'が抜けていたため、たんぱく源が'その他'と判定される主菜8品
  // (ツナキャベツ丼・ペペロンチーノ・寄せ鍋・クリームシチュー等)が まとめて献立 から
  // 構造的に出なくなっていた(0/100枠)。docs/56 §3-6「軽く優先・厳格化しない」への復帰
  eq(
    'preferredProteinSources: 「その他」が候補から消えない(まとめて献立で出なくなる欠陥の再発防止)',
    preferredProteinSources({ 肉: 0, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }).includes('その他'),
    true,
  )
  eq(
    'preferredProteinSources: 最少+1までを候補にする(強制ローテーションにしない)',
    preferredProteinSources({ 肉: 2, 魚: 1, 卵: 0, 豆腐: 3, その他: 1 }),
    ['魚', '卵', 'その他'],
  )
  eq(
    'preferredProteinSources: 使用数が並んでいれば全ソースが候補',
    preferredProteinSources({ 肉: 1, 魚: 1, 卵: 1, 豆腐: 1, その他: 1 }),
    ['肉', '魚', '卵', '豆腐', 'その他'],
  )
  eq(
    'preferredProteinSources: 肉に偏っていれば肉は候補から外れる(分散機能は死なない)',
    preferredProteinSources({ 肉: 5, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }).includes('肉'),
    false,
  )

  // MP-04 同じ食事の中での食材・食感の重複回避。差し替え理由の69%がこのクラスタだった
  eq('isSlipperyDish: しらたきはつるっと系', isSlipperyDish({ title: 'しらたきのチャプチェ風', ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: 春雨はつるっと系', isSlipperyDish({ title: '春雨サラダ', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: こんにゃくはつるっと系', isSlipperyDish({ title: 'こんにゃくの炒り煮', ingredients: [{ name: 'こんにゃく', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: 普通の副菜はつるっと系でない', isSlipperyDish({ title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草', amount: '100', unit: 'g' }] }), false)
  eq(
    'dishAvoidKeys: 主菜のたんぱく源と食感がキーになる',
    dishAvoidKeys({ title: 'しらたきのチャプチェ風', tags: ['中華'], ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }, { name: '牛切り落とし肉', amount: '100', unit: 'g' }] }),
    ['protein:肉', 'texture:つるっと'],
  )
  eq(
    'dishAvoidKeys: 「その他」(野菜が主役)はキーにしない(副菜がほぼ全滅して絞り込みにならないため)',
    dishAvoidKeys({ title: 'きんぴらごぼう', tags: ['和食'], ingredients: [{ name: 'ごぼう', amount: '100', unit: 'g' }] }),
    [],
  )
  {
    // 中華の副菜3品を再現し、つるっと系(春雨サラダ)が後回しになることを確認する
    const recipes = [
      mkRecipe(1, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '野菜炒め', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
      mkRecipe(3, { title: '蒸しなすの香味だれ', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'なす', amount: '100', unit: 'g' }] }),
    ]
    const picks = Array.from({ length: 20 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side', avoidKeys: ['protein:肉', 'texture:つるっと'] }))?.id,
    )
    eq('avoidKeys: つるっと系の主菜のとき、つるっと系の副菜(春雨サラダ)は出ない', picks.includes(1), false)
    eq('avoidKeys: 残り2品からは提案される(0件にはしない)', picks.every((id) => id === 2 || id === 3), true)
  }
  {
    // 主菜がえび(魚)のとき、ツナ副菜(魚)を後回しにする
    const recipes = [
      mkRecipe(1, { title: 'ツナと蒸し大豆の香味サラダ', tags: ['洋食'], dishType: 'side', ingredients: [{ name: 'ツナ缶', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: 'コールスロー', tags: ['洋食'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
    ]
    const picks = Array.from({ length: 20 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side', avoidKeys: ['protein:魚'] }))?.id,
    )
    eq('avoidKeys: 魚の主菜のとき、魚の副菜(ツナ)は出ない', picks.every((id) => id === 2), true)
  }
  eq(
    'avoidKeys: 一致しない候補が0件なら緩和して提案する(0件にしない)',
    suggestForSlot(
      [mkRecipe(1, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] })],
      opts({ role: 'side', preferDishType: 'side', avoidKeys: ['texture:つるっと'] }),
    )?.id,
    1,
  )
  {
    // ペア提案の実地: つるっと系の主菜には、つるっとしていない副菜が付く
    const recipes = [
      mkRecipe(1, { title: 'しらたきのチャプチェ風', tags: ['中華'], dishType: 'main', ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }, { name: '牛切り落とし肉', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }),
      mkRecipe(3, { title: '野菜炒め', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
    ]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案(MP-04): 主菜はしらたきのチャプチェ風', results.every((r) => r.main?.id === 1), true)
    eq('ペア提案(MP-04): つるっと系が重ならない副菜が選ばれる(春雨サラダは出ない)', results.every((r) => r.side?.id === 3), true)
  }

  // MP-09 デザートが副菜に出る/同じ料理が同じ枠に2回入る
  {
    // 「肉じゃが(main)」「水ようかん(dessert)」の2品しかない状態
    const recipes = [
      mkRecipe(1, { title: '肉じゃが', tags: ['和食'], dishType: 'main', ingredients: [{ name: '牛こま切れ肉', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '水ようかん', tags: ['和食'], dishType: 'dessert', ingredients: [{ name: 'こしあん', amount: '100', unit: 'g' }] }),
    ]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('MP-09: 副菜候補が0件でもデザートは副菜にしない(副菜なしにする)', results.every((r) => r.side === undefined), true)
    eq('MP-09: 主菜は肉じゃがのまま提案される', results.every((r) => r.main?.id === 1), true)
  }
  {
    // 主菜になりうる品が1品しかない状態でも、同じ料理が主菜と副菜の両方に入らない
    const recipes = [mkRecipe(1, { title: '肉じゃが', tags: ['和食'], dishType: 'main', ingredients: [{ name: '牛こま切れ肉', amount: '100', unit: 'g' }] })]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('MP-09: 同じ枠の主菜と副菜に同じ料理は入らない', results.every((r) => r.main?.id === 1 && r.side === undefined), true)
  }
  eq(
    'excludeRecipeIds: 指定したレシピは段階的緩和でも復活しない(ハード除外)',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts({ excludeRecipeIds: [1] })),
    undefined,
  )
  eq(
    'MP-09: 主菜候補が0件でもデザートは主菜にしない',
    suggestForSlot([mkRecipe(1, { title: '水ようかん', dishType: 'dessert' })], opts({ role: 'main' })),
    undefined,
  )
  eq(
    'MP-09: dishType未設定でも「おやつ」タグは副菜の緩和段で除外される',
    suggestForSlot([mkRecipe(1, { tags: ['おやつ'] })], opts({ role: 'side' })),
    undefined,
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

// ---------- preferSeasonWithFallback(ホームの候補が季節で痩せる問題・2026-07-29 便CD/MP-12) ----------
// 季節ぴったりの品が少ないときは通年・季節指定なしの品も自動で混ぜる。同梱の夏タグは5品しかなく、
// 従来のpreferSeasonは「1品でもあればその季節の品だけ」に絞るため、何度振り直しても同じ5品しか出なかった。
{
  const mk = (id, season) => ({
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
    ...(season ? { season } : {}),
  })
  // 夏5品＋通年20品 = 従来なら夏5品だけ。閾値(10)未満なので通年も混ぜて25品にする
  {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => mk(i + 1, 'summer')),
      ...Array.from({ length: 20 }, (_, i) => mk(100 + i, 'all')),
    ]
    const got = preferSeasonWithFallback(pool, 'summer')
    eq('preferSeasonWithFallback: 季節の品が少なければ通年も混ぜる(夏5品固定の解消)', got.length, 25)
    eq('preferSeasonWithFallback: 季節の品は必ず残る', got.filter((r) => r.season === 'summer').length, 5)
  }
  // 季節の品が十分あれば従来どおり季節優先のまま(季節感を捨てない)
  {
    const pool = [
      ...Array.from({ length: SEASON_MIN_CANDIDATES, }, (_, i) => mk(i + 1, 'summer')),
      ...Array.from({ length: 20 }, (_, i) => mk(100 + i, 'all')),
    ]
    const got = preferSeasonWithFallback(pool, 'summer')
    eq('preferSeasonWithFallback: 季節の品が十分あれば季節優先のまま', got.length, SEASON_MIN_CANDIDATES)
  }
  // 季節外しか無ければ0件にはしない(そのまま返す)
  eq(
    'preferSeasonWithFallback: 季節外しか無ければ0件にせずそのまま返す',
    preferSeasonWithFallback([mk(1, 'winter')], 'summer').length,
    1,
  )
  eq('preferSeasonWithFallback: 空配列はそのまま', preferSeasonWithFallback([], 'summer').length, 0)
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

  // (5) A-5 月の空日を一括提案(2026-07-29 便CB-2・docs/59)。同じ planWeekFill を
  // 日付の配列だけ「その月の全日」に広げて使う＝週と月で埋め方(手動保護・autoの再抽選・
  // 過去日の除外)が食い違わないことを固定する
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    const entries = [
      mkEntry(1, '2026-08-02', 100), // 過去日(today=8/5)→対象外
      mkEntry(2, '2026-08-10', 200), // 手動の主菜→枠ごと残し、副菜だけ足す
      mkEntry(3, '2026-08-11', 300, { auto: true }), // 自動→消して埋め直す(再抽選)
    ]
    const plan = planWeekFill(entries, august, ['dinner'], '2026-08-05')
    eq(
      'planWeekFill(月レンジ): 過去日(8/1〜8/4)は対象外',
      plan.slotsToFill.every((s) => s.date >= '2026-08-05'),
      true,
    )
    eq(
      'planWeekFill(月レンジ): 手動のある日を除いた未来日をペアで埋める(8/5〜8/31の26日分)',
      plan.slotsToFill.length,
      26,
    )
    eq(
      'planWeekFill(月レンジ): 手動主菜の日は枠ごと残し、副菜だけ足す',
      [sortedStrs(plan.preservedSlotKeys), plan.partialFills.map((p) => `${p.date}|${p.fillRole}`)],
      [['2026-08-10|dinner'], ['2026-08-10|side']],
    )
    eq(
      'planWeekFill(月レンジ): 自動提案由来の行だけを消して振り直す(手動は消さない)',
      plan.autoEntryIdsToRemove,
      [3],
    )
    eq(
      'planWeekFill(月レンジ): 過去日と残す枠のレシピは重複回避のusedに入る',
      sortedNums(plan.usedRecipeIds),
      [100, 200],
    )
  }

  // (6) 便CH/C1(2026-07-30): 月の「未定の日をまとめて提案」は keepAuto=true で呼ぶ。
  // 自動提案で入った献立も保護し、2回目に押しても1品も消さない・入れ替えない
  // （確認文「今ある献立と作った記録は消えません」が事実になる。週タブの再抽選は既定値falseで不変）。
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    // 1回目で全日を自動配置し終えた状態（主菜+副菜が auto で入っている）
    const filled = august.flatMap((date, i) => [
      mkEntry(i * 2 + 1, date, 100 + i, { auto: true }),
      mkEntry(i * 2 + 2, date, 200 + i, { role: 'side', auto: true }),
    ])
    const again = planWeekFill(filled, august, ['dinner'], '2026-08-01', { keepAuto: true })
    eq(
      'planWeekFill(便CH/C1): 2回目は埋める枠が0（総入れ替えが起きない）',
      [again.slotsToFill.length, again.partialFills.length],
      [0, 0],
    )
    eq('planWeekFill(便CH/C1): 削除する行は0件（自動配置分も消さない）', again.autoEntryIdsToRemove, [])
    eq(
      'planWeekFill(便CH/C1): 全31日が「すでに決まっている」枠として数えられる',
      again.preservedSlotKeys.size,
      31,
    )
    // 空き枠は従来どおり埋まる（保護しただけで機能は殺していない）
    const partial = planWeekFill(filled.slice(0, 4), august, ['dinner'], '2026-08-01', {
      keepAuto: true,
    })
    eq(
      'planWeekFill(便CH/C1): 自動で埋まっている2日を残し、残り29日は今までどおり埋める',
      [partial.preservedSlotKeys.size, partial.slotsToFill.length],
      [2, 29],
    )
    // 週タブ（既定値）は2026-07-14の再抽選仕様のまま＝自動枠は振り直す
    const weekDefault = planWeekFill(filled.slice(0, 2), august, ['dinner'], '2026-08-01')
    eq(
      'planWeekFill(便CH/C1): 既定(keepAuto無し)は従来どおり自動枠を振り直す＝週タブは不変',
      [weekDefault.preservedSlotKeys.size, sortedNums(weekDefault.autoEntryIdsToRemove)],
      [0, [1, 2]],
    )
  }

  // (7) 便CH/C10(2026-07-30): その日のメモ（外食・実家に帰る 等）を書いた日は一括提案の対象外。
  // メモは「この日は献立が要らない」を表せる唯一の手段なのに、一括提案が無視して埋めており、
  // 外食の日の分まで月の食費・栄養に乗っていた
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    const plan = planWeekFill([mkEntry(1, '2026-08-20', 300)], august, ['dinner'], '2026-08-01', {
      keepAuto: true,
      skipDates: ['2026-08-15', '2026-08-16', '2026-07-31'], // 月の外・過去日の指定は無視される
    })
    eq(
      'planWeekFill(便CH/C10): メモを書いた日には献立を入れない',
      plan.slotsToFill.some((s) => s.date === '2026-08-15' || s.date === '2026-08-16'),
      false,
    )
    eq(
      'planWeekFill(便CH/C10): 外した日は確認文に件数を書けるよう返す(範囲外・過去日は数えない)',
      plan.skippedDates,
      ['2026-08-15', '2026-08-16'],
    )
    eq(
      'planWeekFill(便CH/C10): 外したのは2日だけで、ほかの空き日はこれまでどおり埋める',
      plan.slotsToFill.length,
      31 - 2 - 1, // メモ2日と、手動配置のある1日(こちらはpartialFillsで副菜だけ足す)
    )
    // メモの日に既に献立があっても触らない（消さない）。重複回避のusedにだけ入る
    const withNoteEntry = planWeekFill(
      [mkEntry(9, '2026-08-15', 777, { auto: true })],
      august,
      ['dinner'],
      '2026-08-01',
      { keepAuto: true, skipDates: ['2026-08-15'] },
    )
    eq(
      'planWeekFill(便CH/C10): メモの日に入っている献立は消さない(非破壊)',
      withNoteEntry.autoEntryIdsToRemove,
      [],
    )
    eq(
      'planWeekFill(便CH/C10): メモの日のレシピは重複回避のusedに入る',
      withNoteEntry.usedRecipeIds,
      [777],
    )
  }
}

// ---------- cookedPlanEntryIds(週ビューの「作った見た目」対応付け・2026-07-24 便BH-3・タスク2) ----------
// 記録の食数だけ枠順(朝→昼→夕・主菜→副菜・id昇順)に先着で消費する。同名複数の枠は記録件数の分だけ・
// 非破壊(エントリは消さない=表示のみ)。「同名複数に注意」の中核。
{
  const mk = (id, slot, role, recipeId) => ({ id, slot, role, recipeId })
  const sortedSet = (set) => Array.from(set).sort((a, b) => a - b)

  // (1) 記録0件なら何も作った見た目にしない
  eq(
    'cookedPlanEntryIds: 記録0件なら空集合',
    sortedSet(cookedPlanEntryIds([mk(1, 'dinner', 'main', 10)], new Map())),
    [],
  )
  // (2) 記録のあるレシピの枠が作った見た目になる
  eq(
    'cookedPlanEntryIds: 記録のあるレシピの枠が対象',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'dinner', 'side', 20)],
        new Map([[10, 1]]),
      ),
    ),
    [1],
  )
  // (3) 同名(同一レシピ)が2枠あり記録1件 → 枠順(朝→昼→夕)で先着の1枠だけ
  eq(
    'cookedPlanEntryIds: 同名2枠・記録1件は枠順で先着の1枠だけ',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'lunch', 'main', 10)],
        new Map([[10, 1]]),
      ),
    ),
    [2], // 昼(lunch)が夕(dinner)より前=先着
  )
  // (4) 同名2枠・記録2件 → 両方
  eq(
    'cookedPlanEntryIds: 同名2枠・記録2件は両方',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'lunch', 'main', 10)],
        new Map([[10, 2]]),
      ),
    ),
    [1, 2],
  )
  // (5) 同枠内は主菜→副菜→id順で先着(同一レシピが主菜と副菜に入る変則ケースでも決定的)
  eq(
    'cookedPlanEntryIds: 同枠内は主菜が副菜より先着',
    sortedSet(
      cookedPlanEntryIds(
        [mk(5, 'dinner', 'side', 10), mk(3, 'dinner', 'main', 10)],
        new Map([[10, 1]]),
      ),
    ),
    [3], // 主菜(id=3)が副菜(id=5)より先着
  )
}

// ---------- mealOccasionCount(概算食費・期間の食費の「◯食分」・2026-07-24 便BH-3・タスク8/9) ----------
{
  eq('mealOccasionCount: 0件は0食', mealOccasionCount([]), 0)
  eq(
    'mealOccasionCount: 同じ日×枠に主菜+副菜が並んでも1食',
    mealOccasionCount([
      { date: '2026-07-24', slot: 'dinner' },
      { date: '2026-07-24', slot: 'dinner' },
    ]),
    1,
  )
  eq(
    'mealOccasionCount: 別の枠・別の日はそれぞれ1食',
    mealOccasionCount([
      { date: '2026-07-24', slot: 'dinner' },
      { date: '2026-07-24', slot: 'lunch' },
      { date: '2026-07-25', slot: 'dinner' },
    ]),
    3,
  )
}

// ---------- planRoleAssign(日タブ「食い違い」チップの役割粒度・2026-07-29 便CB-1)。
// 便CD報告の不具合の再発防止: 副菜の料理を押しても「その枠の主菜」を置き換えていたため、
// 夕食の主菜(肉じゃが)が副菜(きんぴら)に化けて消えていた。役割ごとに何をするかをここで固定する ----------
{
  const main1 = { id: 1, recipeId: 10, role: 'main' }
  const side1 = { id: 2, recipeId: 20, role: 'side' }
  eq(
    '再発防止: 副菜の料理は既存の主菜を置き換えず追加する(主菜が消えない)',
    planRoleAssign([main1], 30, 'side'),
    { kind: 'add' },
  )
  eq(
    '再発防止: 副菜の料理は既存の副菜も置き換えず追加する(副菜も消えない)',
    planRoleAssign([main1, side1], 30, 'side'),
    { kind: 'add' },
  )
  eq(
    '主菜の料理は、その枠の主菜を差し替える(従来どおりの主菜の挙動)',
    planRoleAssign([main1, side1], 30, 'main'),
    { kind: 'replace', entryId: 1 },
  )
  eq(
    '主菜の料理でも、その枠に主菜が無ければ追加する',
    planRoleAssign([side1], 30, 'main'),
    { kind: 'add' },
  )
  eq('空の枠はどちらの役割でも追加になる', planRoleAssign([], 30, 'main'), { kind: 'add' })
  eq(
    '同じ料理が既にその枠にあれば何もしない(同じ料理を2行に増やさない)',
    planRoleAssign([main1, side1], 20, 'side'),
    { kind: 'duplicate' },
  )
  eq(
    '同じ料理が主菜として入っている枠に、主菜として押しても何もしない',
    planRoleAssign([main1], 10, 'main'),
    { kind: 'duplicate' },
  )
  eq(
    'role未設定の既存データ(2026-07-13より前)は主菜として扱い、主菜の料理で差し替える',
    planRoleAssign([{ id: 5, recipeId: 11 }], 30, 'main'),
    { kind: 'replace', entryId: 5 },
  )
  eq(
    'role未設定の既存データがあっても、副菜の料理は追加(既存を消さない)',
    planRoleAssign([{ id: 5, recipeId: 11 }], 30, 'side'),
    { kind: 'add' },
  )
}

// ---------- マイ献立テンプレ(A-1)＋曜日固定の定番(B-2)・2026-07-29 便CB-2・docs/59 ----------
// テンプレは日付ではなく曜日で持つ。全曜日を選べばA-1(1週間まるごと)・1曜日だけ選べばB-2
// (毎週◯曜はカレー)になる、という統合設計をここで固定する。入るのは空いているところだけ(非破壊)
{
  const { buildTemplateItems, planTemplateFill, templateDowCounts } = await import(
    '../src/logic/mealTemplate.ts'
  )
  // 2026-07-27(月)〜08-02(日)の週
  const weekDatesArr = [
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
  ]
  const weekEntries = [
    { id: 1, date: '2026-07-27', slot: 'dinner', recipeId: 10, role: 'main' }, // 月
    { id: 2, date: '2026-07-27', slot: 'dinner', recipeId: 20, role: 'side' },
    { id: 3, date: '2026-07-31', slot: 'dinner', recipeId: 30, role: 'main' }, // 金＝カレー
    { id: 4, date: '2026-08-05', slot: 'dinner', recipeId: 99, role: 'main' }, // 週の外(取得範囲の重なり)
  ]
  const items = buildTemplateItems(weekEntries, weekDatesArr)
  eq('テンプレ保存: 表示中の週の献立だけを覚える(週の外の日は入れない)', items.length, 3)
  eq(
    'テンプレ保存: 日付ではなく曜日(0=月…6=日)で持つ',
    items.map((i) => [i.dow, i.slot, i.role, i.recipeId]),
    [
      [0, 'dinner', 'main', 10],
      [0, 'dinner', 'side', 20],
      [4, 'dinner', 'main', 30],
    ],
  )
  eq(
    'テンプレ保存: role未設定の既存データは主菜として覚える(後方互換)',
    buildTemplateItems([{ date: '2026-07-27', slot: 'dinner', recipeId: 10 }], weekDatesArr)[0].role,
    'main',
  )
  eq('曜日ごとの品数を数えられる(曜日チップの表示用)', templateDowCounts(items), [2, 0, 0, 0, 1, 0, 0])

  // A-1: 翌週(8/3(月)〜8/9(日))へ丸ごと流し込む
  const nextWeek = [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
  ]
  const applyAll = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    'A-1: 全曜日を選ぶと、同じ曜日の同じ食事に丸ごと入る',
    applyAll.ops.map((o) => [o.date, o.slot, o.role, o.recipeId]),
    [
      ['2026-08-03', 'dinner', 'main', 10],
      ['2026-08-03', 'dinner', 'side', 20],
      ['2026-08-07', 'dinner', 'main', 30],
    ],
  )
  eq('A-1: 埋まる食事の数と対象日数を数える(確認文の件数)', [applyAll.fillSlotCount, applyAll.targetDayCount, applyAll.keptSlotCount], [2, 2, 0])

  // 非破壊: すでに献立が入っている食事には入れない(手動・自動を問わず残す)
  const applyOverlap = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [{ date: '2026-08-03', slot: 'dinner' }],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    '非破壊: すでに献立がある食事は上書きせず飛ばす(残った数も数える)',
    [applyOverlap.ops.length, applyOverlap.fillSlotCount, applyOverlap.keptSlotCount],
    [1, 1, 1],
  )
  eq('非破壊: 飛ばすのはその食事だけで、空いている金曜には入る', applyOverlap.ops[0].date, '2026-08-07')

  // 過去日は対象外(便W-⑤a以来の共通ルール)
  const applyPast = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-08-05',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq('過去日(今日より前)には入れない', applyPast.ops.map((o) => o.date), ['2026-08-07'])

  // 表示していない食事には入れない(画面に出ない献立が黙って増えない)
  const applyHidden = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast'],
  })
  eq('表示していない食事(夕食を隠している)には入れない', applyHidden.ops.length, 0)
  // 2026-07-30 便CH/C14: 1品も入らなかった理由を言い分けるため、
  // 「テンプレに中身はあるが表示していない食事」を返す(従来は「選んだ曜日には献立がありません」
  // という事実と違う理由が出ていた。窓の曜日チップには「木 1品」と出ているのに)
  eq(
    'C14: 入らなかった理由が「表示していない食事」だと分かる(夕食を隠している)',
    applyHidden.hiddenSlots,
    ['dinner'],
  )
  eq(
    'C14: 表示している食事だけのテンプレなら hiddenSlots は空(理由の取り違えを起こさない)',
    applyAll.hiddenSlots,
    [],
  )

  // B-2: 金曜だけを選ぶ → 8月の毎週金曜(7/14/21/28)に同じ献立が入る
  const augustDates = Array.from(
    { length: 31 },
    (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
  )
  const applyFriday = planTemplateFill({
    items,
    dates: augustDates,
    entries: [],
    today: '2026-08-01',
    allowedDows: [4],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    'B-2: 金曜だけを選ぶと、その月の毎週金曜に同じ献立が入る(毎週◯曜はカレー)',
    applyFriday.ops.map((o) => `${o.date}:${o.recipeId}`),
    ['2026-08-07:30', '2026-08-14:30', '2026-08-21:30', '2026-08-28:30'],
  )
  eq('B-2: 月曜のぶん(2品)は入らない=選んだ曜日だけ', applyFriday.ops.every((o) => o.recipeId === 30), true)
  const applyNoDow = planTemplateFill({
    items,
    dates: augustDates,
    entries: [],
    today: '2026-08-01',
    allowedDows: [1],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq('テンプレに中身の無い曜日を選ぶと0件(呼び出し側が案内を出す)', [applyNoDow.ops.length, applyNoDow.targetDayCount], [0, 0])
}

// ---------- 献立表(A-4 印刷／画像化)・2026-07-29 便CB-2・docs/59 ----------
// 紙(印刷HTML)・画面・画像(Canvas)の3つが同じこの結果を読む＝内容がずれないことをここで固定する。
// 何を載せるかの規則はアプリの他の画面と同じ: 過ぎた日=作った記録・今日から先=登録した献立(＋日付メモ)
{
  const { buildPlanSheet, planSheetLines, formatSheetDayLabel } = await import(
    '../src/logic/planSheet.ts'
  )
  const titles = { 10: '肉じゃが', 20: 'きんぴらごぼう', 30: 'カレー' }
  const sheet = buildPlanSheet({
    title: '7/28〜7/30の献立',
    dates: ['2026-07-28', '2026-07-29', '2026-07-30'],
    today: '2026-07-29',
    visibleSlots: ['breakfast', 'dinner'],
    // 2026-08-02 オーナー指示で既定は「登録のない日を省く」。この一式は3日とも中身があるので
    // 省いても日数は変わらない(省く挙動そのものは下の専用ケースで固定する)
    entries: [
      { date: '2026-07-28', slot: 'dinner', role: 'main', recipeId: 30 }, // 過去日の未達成予定
      { date: '2026-07-29', slot: 'dinner', role: 'side', recipeId: 20 },
      { date: '2026-07-29', slot: 'dinner', role: 'main', recipeId: 10 },
      { date: '2026-07-30', slot: 'lunch', role: 'main', recipeId: 10 }, // 表示していない食事
    ],
    titleOf: (id) => titles[id],
    notes: new Map([['2026-07-30', '外食']]),
    cookedTitlesByDate: new Map([['2026-07-28', ['カレー']]]),
  })
  eq('献立表: 日付見出しは「7/29（水）」の形', formatSheetDayLabel('2026-07-29'), '7/29（水）')
  eq(
    '献立表: 過ぎた日は予定を載せず、作った記録だけを載せる(画面の扱いと同じ)',
    [sheet.days[0].slots.length, sheet.days[0].cookedTitles],
    [0, ['カレー']],
  )
  eq(
    '献立表: 今日以降は登録した献立を主菜→副菜の順に載せる',
    sheet.days[1].slots.map((s) => [s.slot, s.dishes.map((d) => `${d.role}:${d.title}`)]),
    [['dinner', ['main:肉じゃが', 'side:きんぴらごぼう']]],
  )
  eq('献立表: 表示していない食事(昼食)は紙にも出さない', sheet.days[2].slots.length, 0)
  eq('献立表: 日付メモも一緒に載せる', sheet.days[2].note, '外食')
  eq(
    '献立表: 見つからないレシピ(隠している等)は載せない',
    buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      today: '2026-07-29',
      visibleSlots: ['dinner'],
      entries: [{ date: '2026-07-30', slot: 'dinner', role: 'main', recipeId: 999 }],
      titleOf: () => undefined,
      notes: new Map(),
      cookedTitlesByDate: new Map(),
      // 孤児行そのものが載らないことを見たいので、空の日を省く既定は切って日を残す
      includeEmptyDays: true,
    }).days[0].slots.length,
    0,
  )
  eq('献立表: 献立も記録もメモも無ければ白紙と分かる(呼び出し側が案内を出す)', sheet.isEmpty, false)
  eq(
    '献立表: 空の期間は isEmpty=true',
    buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      today: '2026-07-29',
      visibleSlots: ['dinner'],
      entries: [],
      titleOf: () => undefined,
      notes: new Map(),
      cookedTitlesByDate: new Map(),
    }).isEmpty,
    true,
  )
  const lines = planSheetLines(sheet)
  // 2026-08-02 オーナー指示: 行頭ラベル(夕食・作った記録・この日のメモ)は本文と別に持つ。
  // 画像・画面・紙のいずれでも、ラベルだけを小さく薄く別の位置に描けるようにするため
  eq(
    '献立表(画像化): 日付見出し→中身→メモの順に平らにする(料理は1品1行・ラベルは本文と分けて持つ)',
    lines.map((l) => `${l.kind}:${l.label ?? ''}:${l.role ?? ''}:${l.text}`),
    [
      'day:::7/28（火）',
      'dish:作った記録::カレー',
      'day:::7/29（水）',
      'dish:夕食:主菜:肉じゃが',
      'dish::副菜:きんぴらごぼう',
      'day:::7/30（木）',
      'note:この日のメモ::外食',
    ],
  )

  // 2026-08-02 オーナー指示: 献立も作った記録も日付メモも無い日は既定で載せない。
  // 以前は日付だけの行が並び、夕食しか登録していない月では書いてある日を探しにくかった。
  // チェックを入れれば元どおり全日出る(可逆・非破壊)
  {
    const sparseArgs = {
      title: 'x',
      dates: ['2026-07-28', '2026-07-29', '2026-07-30'],
      today: '2026-07-28',
      visibleSlots: ['dinner'],
      entries: [{ date: '2026-07-29', slot: 'dinner', role: 'main', recipeId: 10 }],
      titleOf: (id) => titles[id],
      notes: new Map(),
      cookedTitlesByDate: new Map(),
    }
    eq(
      '献立表: 既定では登録のない日を載せない(2026-08-02)',
      buildPlanSheet(sparseArgs).days.map((d) => d.date),
      ['2026-07-29'],
    )
    eq(
      '献立表: includeEmptyDays=trueなら従来どおり全日載せる',
      buildPlanSheet({ ...sparseArgs, includeEmptyDays: true }).days.map((d) => d.date),
      ['2026-07-28', '2026-07-29', '2026-07-30'],
    )
    eq(
      '献立表: 省いた結果0日でも「白紙」判定は省く前の全日で決める(案内文が変わらない)',
      buildPlanSheet({ ...sparseArgs, entries: [] }).isEmpty,
      true,
    )
    eq(
      '献立表: 中身のある日が1日でもあれば isEmpty=false のまま',
      buildPlanSheet(sparseArgs).isEmpty,
      false,
    )
    eq(
      '献立表(画像化): 省いた日は行にも出ない',
      planSheetLines(buildPlanSheet(sparseArgs)).map((l) => `${l.kind}:${l.text}`),
      ['day:7/29（水）', 'dish:肉じゃが'],
    )
  }

  // 2026-07-30 便CH/C6: 画像だけ料理名が「…」で切り捨てられていた(画面プレビューと印刷には
  // 出ているので、家族に送った先で初めて欠ける)。料理名の行を3行まで許して直したので、
  // 収録レシピで一番長くなる組み合わせ(主菜1+副菜2)がその枠に収まることを固定する。
  // 今後レシピ名が伸びて枠を超えたらここで落ちる＝また黙って欠けるのを防ぐ
  {
    const { MAX_WRAP_LINES, IMAGE_WIDE_CHARS_PER_LINE } = await import(
      '../src/logic/planSheetImage.ts'
    )
    const longSheet = buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      today: '2026-07-29',
      visibleSlots: ['dinner'],
      entries: [
        { date: '2026-07-30', slot: 'dinner', role: 'main', recipeId: 1 },
        { date: '2026-07-30', slot: 'dinner', role: 'side', recipeId: 2 },
        { date: '2026-07-30', slot: 'dinner', role: 'side', recipeId: 3 },
      ],
      titleOf: (id) =>
        ({
          1: '鶏もも肉のガーリックハーブ焼き',
          2: 'ブロッコリーとにんじんのハーブマリネ',
          3: '白菜とにんじんの中華とろみ煮',
        })[id],
      notes: new Map(),
      cookedTitlesByDate: new Map(),
    })
    // 2026-08-02: 料理を1品1行にしたので、1行に載るのは料理名1つだけになった。
    // 便CH/C6の趣旨（画像だけ料理名が「…」で欠けるのを防ぐ）は、いちばん長い料理名が
    // 行数上限に収まることで守る。ラベル2列ぶん本文幅が狭くなっている点も一緒に見張る
    const longLines = planSheetLines(longSheet).filter((l) => l.kind === 'dish')
    const longestDish = Math.max(...longLines.map((l) => l.text.length))
    eq(
      '献立表(画像化・便CH/C6): 収録レシピで最長級の料理名が、画像の行数上限に収まる',
      longestDish <= MAX_WRAP_LINES.dish * IMAGE_WIDE_CHARS_PER_LINE,
      true,
    )
    eq(
      '献立表(画像化・2026-08-02): 主菜1+副菜2は3行(1品1行)になる',
      longLines.length,
      3,
    )
    eq(
      '献立表(画像化・2026-08-02): ラベル2列を引いた本文幅の文字数めやすで測っている',
      IMAGE_WIDE_CHARS_PER_LINE,
      19,
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

// ---------- buildShoppingCandidates: 食数スケール(2026-07-23 オーナー実機FB #3「食数の+/-」方式) ----------
{
  // 2人分レシピを「4食」ぶん(scale=2)作ると、数値化できる分量は2倍になる
  const c = buildShoppingCandidates(
    [
      {
        id: 1,
        ingredients: [
          { name: '玉ねぎ', amount: '1', unit: '個' },
          { name: '牛乳', amount: '100', unit: 'ml' },
          { name: '塩', amount: '少々', unit: '' }, // 数値化できない分量は原文のまま(スケールしない)
        ],
        scale: 2,
      },
    ],
    [],
  )
  const byName = new Map(c.map((x) => [x.name, x]))
  eq('食数スケール: 玉ねぎ1個×2=2個', byName.get('玉ねぎ')?.amount, '2個')
  eq('食数スケール: 牛乳100ml×2=200ml', byName.get('牛乳')?.amount, '200ml')
  eq('食数スケール: 少々はスケールしない', byName.get('塩')?.amount, '少々')
}
{
  // scale未指定は等倍(既存呼び出し=献立の「この週の買い物リストを作る」等を壊さない)
  const c = buildShoppingCandidates([{ id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }], [])
  eq('食数スケール: scale未指定は等倍', c[0]?.amount, '1個')
  // 別々のscaleを持つ同じ食材は、スケール後の数値で合算する(1個×2 + 1個×3 = 5個)
  const c2 = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 2 },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 3 },
    ],
    [],
  )
  eq('食数スケール: 別scaleの同一食材はスケール後に合算(5個)', c2[0]?.amount, '5個')
}

// ---------- buildShoppingCandidates: 分数分量(2026-07-29 便CC/C1。S1: 分母を無視して2〜4倍になっていた) ----------
{
  const amountOf = (ingredients, scale, have = []) =>
    buildShoppingCandidates([{ id: 1, ingredients, scale }], have)[0]?.amount

  // 等倍(食数=登録人数)は原文をそのまま見せる(レシピ詳細の表示と一致させる・C11)
  eq('買い物候補(分数): 1/2本 等倍→1/2本', amountOf([{ name: 'にんじん', amount: '1/2', unit: '本' }], 1), '1/2本')
  eq('買い物候補(分数): 大さじ1/2 等倍→大さじ1/2', amountOf([{ name: 'みりん', amount: '1/2', unit: '大さじ' }], 1), '大さじ1/2')
  eq(
    '買い物候補(分数): 帯分数「1と1/2個」等倍→原文のまま',
    amountOf([{ name: '玉ねぎ', amount: '1と1/2', unit: '個' }], 1),
    '1と1/2個',
  )
  // 2レシピぶんの合算は分母を解釈してから足す(1/2個 + 1/2個 = 1個)
  const half2 = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1/2', unit: '個' }] },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '1/2', unit: '個' }] },
    ],
    [],
  )
  eq('買い物候補(分数): 1/2個+1/2個=1個', half2[0]?.amount, '1個')
  // カレールー1/2箱を4人分レシピ→3食(scale=0.75)。レシピ詳細と同じ「1/2箱」になる
  eq(
    '買い物候補(分数): カレールー1/2箱×0.75→1/2箱(レシピ詳細と一致)',
    amountOf([{ name: 'カレールー', amount: '1/2', unit: '箱' }], 0.75),
    '1/2箱',
  )
  eq(
    '買い物候補(分数): 豆腐1/2丁×1.5→1丁',
    amountOf([{ name: '豆腐', amount: '1/2', unit: '丁' }], 1.5),
    '1丁',
  )
}

// ---------- buildShoppingCandidates: 単位ごとの丸め(2026-07-29 便CC/C11。62.5g・0.3本など買えない粒度) ----------
{
  const amountOf = (ingredients, scale) =>
    buildShoppingCandidates([{ id: 1, ingredients, scale }], [])[0]?.amount
  eq('買い物候補(丸め): 250g×0.25→65g(5刻み)', amountOf([{ name: '豚こま切れ肉', amount: '250', unit: 'g' }], 0.25), '65g')
  eq('買い物候補(丸め): 700ml×0.25→180ml(10刻み)', amountOf([{ name: '水', amount: '700', unit: 'ml' }], 0.25), '180ml')
  eq('買い物候補(丸め): 1本×0.25→1/2本(個数系は0.5刻み・0にしない)', amountOf([{ name: 'にんじん', amount: '1', unit: '本' }], 0.25), '1/2本')
  eq('買い物候補(丸め): 1箱×0.25→1/2箱', amountOf([{ name: 'カレールー', amount: '1', unit: '箱' }], 0.25), '1/2箱')
}

// ---------- buildShoppingCandidates: 単位が混ざる/略記(2026-07-29 便CC/C12。数値側までスケールが落ちていた) ----------
{
  // 同じ単位グループに「少々」が混ざっても、数値側はスケールして合算する
  const mixed = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '塩', amount: '少々', unit: '' }], scale: 2 },
      { id: 2, ingredients: [{ name: '塩', amount: '2', unit: '' }], scale: 2 },
    ],
    [],
  )
  eq('買い物候補(混在): 数値側は2×2=4にスケールし「少々」は原文で併記', mixed[0]?.amount, '4・少々')
  // 「大2」「小1」の略記も大さじ/小さじとして解釈してスケールする
  const abbrev = buildShoppingCandidates(
    [{ id: 1, ingredients: [{ name: 'しょうゆ', amount: '大2', unit: '' }], scale: 2 }],
    [],
  )
  eq('買い物候補(略記): 大2×2→大さじ4', abbrev[0]?.amount, '大さじ4')
  // 範囲分量は人数スケールに非対応(レシピ詳細と同じ)。原文のまま残す
  const range = buildShoppingCandidates(
    [{ id: 1, ingredients: [{ name: '牛こま切れ肉', amount: '200〜250', unit: 'g' }] }],
    [],
  )
  eq('買い物候補(範囲): 200〜250gは原文のまま', range[0]?.amount, '200〜250g')
}

// ---------- combineAmountTexts(2026-07-29 便CC/C14。買い物メモの重複行の合算) ----------
{
  eq('メモ合算: 1束+2束=3束', combineAmountTexts(['1束', '2束']), '3束')
  eq('メモ合算: 200g+150g=350g', combineAmountTexts(['200g', '150g']), '350g')
  eq('メモ合算: 大さじ1+大さじ2=大さじ3', combineAmountTexts(['大さじ1', '大さじ2']), '大さじ3')
  eq('メモ合算: 1/2本+1/2本=1本', combineAmountTexts(['1/2本', '1/2本']), '1本')
  eq('メモ合算: 単位違いは「・」で並べる', combineAmountTexts(['1本', '100g']), '1本・100g')
  eq('メモ合算: 数値化できない分量は原文のまま並べる', combineAmountTexts(['少々', '1つまみ']), '少々・1つまみ')
  eq('メモ合算: 片方が空なら残りをそのまま', combineAmountTexts(['1袋', undefined]), '1袋')
  eq('メモ合算: 両方空なら空文字', combineAmountTexts([undefined, '']), '')
  eq('メモ合算: 範囲分量は原文のまま', combineAmountTexts(['200〜250g', undefined]), '200〜250g')
}

// ---------- parseRecipeIdsParam(2026-07-29 便CC/C10。献立経路に回数=倍率を乗せる) ----------
{
  eq('献立経路: 単純なID列は各1回分', parseRecipeIdsParam('1,2,3'), [
    { id: 1, times: 1 },
    { id: 2, times: 1 },
    { id: 3, times: 1 },
  ])
  eq('献立経路: 「1x3」は3回分', parseRecipeIdsParam('1x3,2'), [
    { id: 1, times: 3 },
    { id: 2, times: 1 },
  ])
  eq('献立経路: 同じIDの重複は回数として足す', parseRecipeIdsParam('5,5,7'), [
    { id: 5, times: 2 },
    { id: 7, times: 1 },
  ])
  eq('献立経路: 空文字・数値でない要素は無視', parseRecipeIdsParam('1,,abc,2'), [
    { id: 1, times: 1 },
    { id: 2, times: 1 },
  ])
  eq('献立経路: 空パラメータは0件', parseRecipeIdsParam(''), [])
}

// ---------- toPantryKey(2026-07-29 便CC/C4。在庫照合の名寄せキーを1本化) ----------
{
  eq('在庫キー: 括弧書きを落とす', toPantryKey('長ねぎ（白い部分）'), toPantryKey('長ねぎ'))
  eq('在庫キー: 半角括弧も落とす', toPantryKey('片栗粉(あん用)'), toPantryKey('片栗粉'))
  eq('在庫キー: 空白・中黒のゆれを吸収', toPantryKey('オリーブ・オイル'), toPantryKey('オリーブオイル'))
  eq('在庫キー: かな/漢字の表記ゆれを吸収', toPantryKey('とりにく'), toPantryKey('鶏肉'))
  // 別食材どうしがぶつからないこと(部分一致に寄せないための歯止め)
  neq('在庫キー: 豆腐と高野豆腐は別物', toPantryKey('豆腐'), toPantryKey('高野豆腐'))
  neq('在庫キー: 卵と砂糖(卵用)は別物', toPantryKey('卵'), toPantryKey('砂糖（卵用）'))
  neq('在庫キー: ねぎと玉ねぎは別物', toPantryKey('ねぎ'), toPantryKey('玉ねぎ'))
}

// ---------- 買い物候補の除外: 括弧付き材料も在庫「ある」で除外される(便CC/C4) ----------
{
  const c = buildShoppingCandidates(
    [
      {
        id: 1,
        ingredients: [
          { name: '長ねぎ（白い部分）', amount: '1/2', unit: '本' },
          { name: 'にんじん', amount: '1', unit: '本' },
        ],
      },
    ],
    ['長ねぎ'],
  )
  eq('買い物候補: 在庫「長ねぎ」ありなら「長ねぎ（白い部分）」も除外される', c.map((x) => x.name), ['にんじん'])
}

// ---------- 在庫チップの大分類グループ(2026-07-23 オーナー実機FB #1) ----------
{
  eq('在庫グループ: 玉ねぎ→野菜・きのこ', categorizePantryName('玉ねぎ'), 'vegetable')
  eq('在庫グループ: しめじ→野菜・きのこ', categorizePantryName('しめじ'), 'vegetable')
  eq('在庫グループ: 納豆→豆腐・卵・乳', categorizePantryName('納豆'), 'soyEgg')
  eq('在庫グループ: 卵→豆腐・卵・乳', categorizePantryName('卵'), 'soyEgg')
  eq('在庫グループ: 牛乳→豆腐・卵・乳', categorizePantryName('牛乳'), 'soyEgg')
  eq('在庫グループ: 米→主食・粉', categorizePantryName('米'), 'staple')
  eq('在庫グループ: しょうゆ→調味料', categorizePantryName('しょうゆ'), 'seasoning')
  eq('在庫グループ: 味噌→調味料', categorizePantryName('味噌'), 'seasoning')
  eq('在庫グループ: 鮭→肉・魚介', categorizePantryName('鮭'), 'meatFish')
  // 栄養DBに部位別しか無い総称語はキーワードで救済(#1フォールバック)
  eq('在庫グループ: 豚肉→肉・魚介(総称語フォールバック)', categorizePantryName('豚肉'), 'meatFish')
  eq('在庫グループ: 鶏肉→肉・魚介(総称語フォールバック)', categorizePantryName('鶏肉'), 'meatFish')
  // 未知の食材は その他
  eq('在庫グループ: 未知の食材→その他', categorizePantryName('架空の宇宙食材'), 'other')
  // 手動指定(group)は自動判定より優先
  eq('在庫グループ: 手動指定が自動判定より優先', resolvePantryGroup({ name: '豚肉', group: 'other' }), 'other')
  eq('在庫グループ: 手動指定なしは自動判定', resolvePantryGroup({ name: '玉ねぎ' }), 'vegetable')
}
{
  // カバレッジ: 栄養DBの全食品labelがどれかのグループに分類済み(未分類の取りこぼしを検知)
  const categorized = categorizedFoodLabels()
  const missing = NUTRITION_DATA.foods.map((f) => f.label).filter((label) => !categorized.has(label))
  eq('在庫グループ: 栄養DB全食品が分類済み(未分類0件)', missing, [])
}
{
  // groupPantryItems: PANTRY_GROUP_ORDER順にまとまり、空グループは出ない
  const grouped = groupPantryItems([
    { id: 1, name: 'しょうゆ' },
    { id: 2, name: '豚肉' },
    { id: 3, name: '玉ねぎ' },
  ])
  eq('在庫グループ分け: 肉→野菜→調味料の表示順で空グループは出ない', grouped.map((g) => g.key), [
    'meatFish',
    'vegetable',
    'seasoning',
  ])
}

// ---------- 買い物メモの売り場順(2026-07-24 実機FB #11) ----------
{
  // 在庫の表示順(肉が先)とは別に、買い物は売り場導線=野菜→肉→豆腐卵乳→主食粉→調味料→その他。
  // 同じグループ内は元の並び(既存の追加順)を安定して保つ
  const sorted = sortShoppingByAisle([
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉' }, // 肉・魚介
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん' }, // 野菜・きのこ(玉ねぎより後=既存順を維持する)
    { id: 5, name: '架空の宇宙食材' }, // その他
    { id: 6, name: '卵' }, // 豆腐・卵・乳
    { id: 7, name: '米' }, // 主食・粉
  ])
  eq('買い物売り場順: 野菜→肉→豆腐卵乳→主食粉→調味料→その他の順に並ぶ', sorted.map((s) => s.name), [
    '玉ねぎ',
    'にんじん',
    '豚肉',
    '卵',
    '米',
    'しょうゆ',
    '架空の宇宙食材',
  ])
}

// ---------- selectPantryDowngrades(2026-07-23 オーナー実機FB #11「作った!」の在庫反映) ----------
{
  const items = [
    { id: 1, name: '豚バラ肉', level: 'have', isFrequent: true }, // 使った→ある→少ない
    { id: 2, name: '玉ねぎ', level: 'low', isFrequent: true }, // 使った→少ない→ない
    { id: 3, name: 'しょうゆ', level: 'have', isFrequent: true }, // 調味料→対象外
    { id: 4, name: 'にんじん', level: 'have', isFrequent: true }, // レシピに無い→変化なし
    { id: 5, name: 'キャベツ', level: 'none', isFrequent: true }, // 使ったが既にない→据え置き
  ]
  const ingredients = ['豚バラ肉', '玉ねぎ', 'しょうゆ', 'キャベツ']
  const down = selectPantryDowngrades(items, ingredients)
  const byId = new Map(down.map((d) => [d.id, d.level]))
  eq('在庫反映: 豚バラ肉 ある→少ない', byId.get(1), 'low')
  eq('在庫反映: 玉ねぎ 少ない→ない', byId.get(2), 'none')
  eq('在庫反映: しょうゆ(調味料)は対象外', byId.has(3), false)
  eq('在庫反映: 使っていないにんじんは変化なし', byId.has(4), false)
  eq('在庫反映: 既にない食材は据え置き(変更リストに出ない)', byId.has(5), false)
  eq('在庫反映: 変化するのは2件だけ', down.length, 2)
  // 材料が空なら何も下げない
  eq('在庫反映: 材料が空なら0件', selectPantryDowngrades(items, []).length, 0)
}

// ---------- selectPantryDowngrades: 名寄せの誤爆と不発(2026-07-29 便CC/C3。QA S2) ----------
{
  const down = (chipName, ingredientNames) =>
    selectPantryDowngrades([{ id: 1, name: chipName, level: 'have', isFrequent: true }], ingredientNames)
      .length > 0

  // 誤爆側: 部分一致をやめたので別食材で減らない
  eq('在庫反映(誤爆): 「ねぎ」チップは玉ねぎで減らない', down('ねぎ', ['玉ねぎ']), false)
  eq('在庫反映(誤爆): 「豆腐」チップは高野豆腐で減らない', down('豆腐', ['高野豆腐']), false)
  eq('在庫反映(総称): 「豆腐」チップは絹ごし豆腐で減る', down('豆腐', ['絹ごし豆腐']), true)
  eq('在庫反映(誤爆): 「卵」チップは「砂糖（卵用）」で減らない', down('卵', ['砂糖（卵用）']), false)
  eq('在庫反映(誤爆): 「米」チップは米酢で減らない', down('米', ['米酢']), false)
  eq('在庫反映(誤爆): 「ごま」チップはごま油で減らない', down('ごま', ['ごま油']), false)
  // 不発側: 括弧付きの材料名でも同じ食材として減る
  eq('在庫反映: 「長ねぎ」チップは「長ねぎ（白い部分）」で減る', down('長ねぎ', ['長ねぎ（白い部分）']), true)
  eq('在庫反映: 同名はこれまでどおり減る', down('玉ねぎ', ['玉ねぎ']), true)
  // 不発側: プリセットの総称チップ(豚肉・鶏肉)が部位名の材料で減る
  eq('在庫反映(総称): 「豚肉」チップは豚こま切れ肉で減る', down('豚肉', ['豚こま切れ肉']), true)
  eq('在庫反映(総称): 「鶏肉」チップは鶏もも肉で減る', down('鶏肉', ['鶏もも肉']), true)
  eq('在庫反映(総称): 「牛肉」チップは牛こま切れ肉で減る', down('牛肉', ['牛こま切れ肉']), true)
  // 総称チップの巻き添え防止: 調味料や別の肉では減らない
  eq('在庫反映(総称): 「鶏肉」チップは鶏がらスープの素で減らない', down('鶏肉', ['鶏がらスープの素']), false)
  eq('在庫反映(総称): 「豚肉」チップは鶏もも肉で減らない', down('豚肉', ['鶏もも肉']), false)
}

// ---------- categorizePantryName: かな書きの総称語(2026-07-29 便CC/C4。QA S3の「とりにく」) ----------
{
  eq('在庫グループ: かな「とりにく」→肉・魚介', categorizePantryName('とりにく'), 'meatFish')
  eq('在庫グループ: かな「ぶたにく」→肉・魚介', categorizePantryName('ぶたにく'), 'meatFish')
  eq('在庫グループ: かな「ぎゅうにく」→肉・魚介', categorizePantryName('ぎゅうにく'), 'meatFish')
  // 「にく」の部分一致に寄せていないこと(にんにくが肉売り場に行かない)
  eq('在庫グループ: 「にんにく」は肉・魚介にしない', categorizePantryName('にんにく') !== 'meatFish', true)
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

// ---------- 全品同梱の健全性(テーマ全廃2026-07-23: 収録109品・料理名は一意) ----------
{
  eq('starterDefsは109品(基本57+旧テーマ52)', starterDefs.length, 109)
  const titles = starterDefs.map((d) => d.title.trim())
  eq('starterDefsの料理名はカタログ全体で一意', new Set(titles).size, titles.length)
  eq(
    '収録レシピ「だしのとり方」が同梱に含まれる(だし紐づけの飛び先)',
    titles.includes(DASHI_RECIPE_TITLE),
    true,
  )

  // 2026-07-29 副菜6品の増枠(docs/61)。6品とも副菜(dishType='side')・通年・昼夜で入っていること
  const SIDE6 = [
    'チンゲン菜としいたけのにんにく炒め',
    '白菜とにんじんの中華とろみ煮',
    'パプリカといんげんのオイスター炒め',
    'かぼちゃのミルク煮',
    'ラタトゥイユ',
    'ブロッコリーとにんじんのハーブマリネ',
  ]
  for (const t of SIDE6) {
    const def = starterDefs.find((d) => d.title === t)
    eq(`増枠副菜が同梱される: ${t}`, def != null, true)
    eq(`増枠副菜の種別は副菜: ${t}`, def?.dishType, 'side')
    eq(`増枠副菜は通年: ${t}`, def?.season, 'all')
    eq(`増枠副菜は昼・夜: ${t}`, def?.suitableFor, ['lunch', 'dinner'])
  }

  // 既存端末(増枠前の103品が入っている)への差分投入: 「基本レシピを入れ直す」で
  // 増枠6品だけが追加され、既存103品は内容が同じなので更新0件・削除0件になること
  // (お気に入り・作った記録などのユーザーデータに触れない = 増枠のたびに全消しされない)
  {
    const before = starterDefs
      .filter((d) => !SIDE6.includes(d.title))
      .map((d, k) => ({ ...d, id: k + 1, isStarter: true, isFavorite: false, cookedLogs: [] }))
    eq('増枠前の端末は103品', before.length, 103)
    const topUp = planStarterReload(before, starterDefs, 9000)
    eq('増枠の差分投入: 追加は増枠6品だけ', topUp.toAdd.map((d) => d.title).sort(), [...SIDE6].sort())
    eq('増枠の差分投入: 既存103品は更新されない(ユーザーデータに触れない)', topUp.toUpdate.length, 0)
    eq('増枠の差分投入: 削除は発生しない', topUp.toDeleteIds.length, 0)
  }
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

  // 2026-08-01 線引きB'(オーナー確定): 栄養並び替えのうちカロリー順だけを無料に開放し、
  // たんぱく質・塩分・脂質・糖質はPro維持。並べ替えの計算自体は無料/Proで同じ
  eq('FREE_NUTRIENT_SORT_OPTIONS: 無料はカロリー順のみ', [...FREE_NUTRIENT_SORT_OPTIONS], ['kcal'])
  eq('PRO_NUTRIENT_SORT_OPTIONS: 残り4項目はPro', [...PRO_NUTRIENT_SORT_OPTIONS], [
    'protein',
    'salt',
    'fat',
    'carb',
  ])
  eq('isFreeSortOption: カロリー順は無料で使える', isFreeSortOption('kcal'), true)
  eq('isFreeSortOption: 塩分順はPro', isFreeSortOption('salt'), false)
  eq('isFreeSortOption: たんぱく質順はPro', isFreeSortOption('protein'), false)
  eq('isFreeSortOption: 栄養以外(更新順)は無料', isFreeSortOption('updated'), true)
  // 無料に開放したのはUIの選択肢だけで、並べ替えの計算(sortResults)には解錠状態が入らない。
  // 上のカロリー昇順・塩分昇順の期待値がそのまま通っていることがその見張りになっている
}

// ---------- 「基本レシピ順」並び替えは2026-07-24 便BN・タスク4で廃止(配布テーマ全廃で
// 区分が無意味化したため。RecipeSortOptionから'theme'ごと削除) ----------

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
    {
      pantryItems: false,
      shoppingItems: false,
      mealPlans: false,
      todayList: false,
      prices: false,
      dayNotes: false,
      mealTemplates: false,
    },
  )
  eq(
    '空配列(テーブルを空にする意図)は置き換え対象になる(undefinedとの区別)',
    tablesToReplace({ ...baseFile, pantryItems: [], prices: [] }),
    {
      pantryItems: true,
      shoppingItems: false,
      mealPlans: false,
      todayList: false,
      prices: true,
      dayNotes: false,
      mealTemplates: false,
    },
  )
  eq(
    '中身入りの配列も置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      mealPlans: [{ date: '2026-07-20', slot: 'dinner', recipeId: 1, role: 'main' }],
      todayList: [{ recipeId: 1, addedAt: 1000 }],
    }),
    {
      pantryItems: false,
      shoppingItems: false,
      mealPlans: true,
      todayList: true,
      prices: false,
      dayNotes: false,
      mealTemplates: false,
    },
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
      dayNotes: [],
      mealTemplates: [],
    }),
    {
      pantryItems: true,
      shoppingItems: true,
      mealPlans: true,
      todayList: true,
      prices: true,
      dayNotes: true,
      mealTemplates: true,
    },
  )
  // 日付メモ(2026-07-29 便CB-1・docs/59 A-2)。新テーブルを足したときの後方互換の要:
  // この項目を持たない古いバックアップ(=undefined)を復元しても、端末に残っているメモを消さない
  eq(
    '日付メモの項目が無い古いバックアップは、復元してもメモのテーブルに触らない',
    tablesToReplace({ ...baseFile, mealPlans: [] }).dayNotes,
    false,
  )
  eq(
    '日付メモが中身入りで入っていれば置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      dayNotes: [{ date: '2026-07-30', text: '外食', updatedAt: 1000 }],
    }).dayNotes,
    true,
  )
  // マイ献立テンプレ(2026-07-29 便CB-2・docs/59 A-1)。日付メモと同じ後方互換のルール:
  // 項目を持たない古いバックアップを復元しても、端末に残っているテンプレを消さない
  eq(
    'テンプレの項目が無い古いバックアップは、復元してもテンプレのテーブルに触らない',
    tablesToReplace({ ...baseFile, mealPlans: [] }).mealTemplates,
    false,
  )
  eq(
    'テンプレが中身入りで入っていれば置き換え対象になる',
    tablesToReplace({
      ...baseFile,
      mealTemplates: [
        { name: '平日の定番', items: [{ dow: 4, slot: 'dinner', role: 'main', recipeId: 1 }], createdAt: 1000 },
      ],
    }).mealTemplates,
    true,
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

// ---------- buildReplaceSettings(2026-07-30 便CJ/C2・S2事故の再発防止)。
// 「置き換え」でsettingsを持たないJSON(配布セット形式・レビュー用の書き出し・手編集)を読むと
// 解錠コード・NG食材・週の食費予算・テーマが既定値へ初期化されていた。
// settingsはあってもproCodeを含まないファイル(購入前に取った自分のバックアップ)でも
// 購入状態が消えていた ----------
{
  const current = {
    id: 1,
    ngIngredients: ['パクチー'],
    theme: 'dark',
    weeklyBudget: 5000,
    proCode: 'UR-AAAA-AAAA',
    proActivatedAt: 1000,
    starterSeeded: true,
  }
  const fromFile = {
    ngIngredients: ['セロリ'],
    theme: 'brown',
    weeklyBudget: 3000,
    proCode: 'UR-BBBB-BBBB',
    proActivatedAt: 2000,
  }
  const replacedWithFile = buildReplaceSettings(current, fromFile)
  eq(
    '置き換えの設定: ファイルに設定があればファイルの内容になる(置き換えの意味は保つ)',
    {
      ng: replacedWithFile.ngIngredients,
      theme: replacedWithFile.theme,
      budget: replacedWithFile.weeklyBudget,
      pro: replacedWithFile.proCode,
    },
    { ng: ['セロリ'], theme: 'brown', budget: 3000, pro: 'UR-BBBB-BBBB' },
  )
  const noSettings = buildReplaceSettings(current, undefined)
  eq(
    '置き換えの設定: settingsを持たないJSON(配布セット形式など)では今の設定を保つ(初期化しない)',
    {
      ng: noSettings.ngIngredients,
      theme: noSettings.theme,
      budget: noSettings.weeklyBudget,
      pro: noSettings.proCode,
    },
    { ng: ['パクチー'], theme: 'dark', budget: 5000, pro: 'UR-AAAA-AAAA' },
  )
  const noCode = buildReplaceSettings(current, { ngIngredients: [], theme: 'light' })
  eq(
    '置き換えの設定: 解錠コードを含まないファイル(購入前に取ったバックアップ)でも購入状態を消さない',
    { pro: noCode.proCode, proAt: noCode.proActivatedAt, ng: noCode.ngIngredients, theme: noCode.theme },
    { pro: 'UR-AAAA-AAAA', proAt: 1000, ng: [], theme: 'light' },
  )
  eq(
    '置き換えの設定: starterSeededは必ずtrue(基本レシピの二重投入を防ぐ既存の理由)',
    buildReplaceSettings({ starterSeeded: false }, { starterSeeded: false }).starterSeeded,
    true,
  )
  eq('置き換えの設定: idは必ず1(設定は1レコードだけ)', buildReplaceSettings(undefined, undefined).id, 1)
  eq(
    '置き換えの設定: 設定が空の端末+設定なしファイルでも既定値で成立する(エラーにならない)',
    buildReplaceSettings(undefined, undefined).ngIngredients,
    [],
  )
}

// ---------- merge復元の非破壊マージ(2026-07-30 便CJ/C1・S1事故の再発防止)。
// 「読み込む(今のデータに追加)」がレシピ本体と解錠コードしか見ておらず、
// 7テーブルと「既にあるレシピの作った記録・写真・お気に入り」を無言で捨てていた。
// さらに同一IDを内容も見ずにスキップしていたため、同梱レシピが増えた版とのズレで
// 自作レシピが丸ごと落ちていた ----------
{
  // --- mergeTableRows: 既存に無い行だけ足す(既存行は消さない・上書きしない) ---
  eq(
    '非破壊マージ: 既存に無い行だけ返す(既存と同じキーの行は足さない)',
    mergeTableRows([{ name: '牛乳' }], [{ name: '牛乳' }, { name: 'にんじん' }], mergeRowKeys.pantryItems),
    [{ name: 'にんじん' }],
  )
  eq(
    '非破壊マージ: 既存が空なら全部足す',
    mergeTableRows([], [{ name: '牛乳' }, { name: 'にんじん' }], mergeRowKeys.pantryItems),
    [{ name: '牛乳' }, { name: 'にんじん' }],
  )
  eq(
    '非破壊マージ: ファイル内に同じキーが重複していても1件だけ足す',
    mergeTableRows([], [{ name: '牛乳' }, { name: '牛乳' }], mergeRowKeys.pantryItems),
    [{ name: '牛乳' }],
  )
  eq(
    '非破壊マージ: 前後の空白は同じ行として扱う(名前の照合)',
    mergeTableRows([{ name: '牛乳' }], [{ name: ' 牛乳 ' }], mergeRowKeys.pantryItems),
    [],
  )
  eq(
    '非破壊マージ: 週献立は日付+食事帯+レシピで照合する(同じ日の別の枠は別行として足す)',
    mergeTableRows(
      [{ date: '2026-08-01', slot: 'dinner', recipeId: 1 }],
      [
        { date: '2026-08-01', slot: 'dinner', recipeId: 1 },
        { date: '2026-08-01', slot: 'dinner', recipeId: 2 },
        { date: '2026-08-01', slot: 'lunch', recipeId: 1 },
      ],
      mergeRowKeys.mealPlans,
    ),
    [
      { date: '2026-08-01', slot: 'dinner', recipeId: 2 },
      { date: '2026-08-01', slot: 'lunch', recipeId: 1 },
    ],
  )
  eq(
    '非破壊マージ: 日付メモは日付(主キー)で照合し、今のメモを上書きしない',
    mergeTableRows(
      [{ date: '2026-08-02', text: '今の端末のメモ', updatedAt: 2 }],
      [
        { date: '2026-08-02', text: 'ファイル側のメモ', updatedAt: 1 },
        { date: '2026-08-03', text: '来客あり', updatedAt: 1 },
      ],
      mergeRowKeys.dayNotes,
    ),
    [{ date: '2026-08-03', text: '来客あり', updatedAt: 1 }],
  )
  eq(
    '非破壊マージ: 今日の献立はレシピで照合する',
    mergeTableRows([{ recipeId: 3, addedAt: 1 }], [{ recipeId: 3, addedAt: 2 }, { recipeId: 4, addedAt: 2 }], mergeRowKeys.todayList),
    [{ recipeId: 4, addedAt: 2 }],
  )

  // --- resolveMergeRecipeAction: ID衝突でレシピを落とさない(版ズレ対策) ---
  const titleById = new Map([
    [1, '肉じゃが'],
    [2, 'カレー'],
  ])
  const idByTitle = new Map([
    ['肉じゃが', 1],
    ['カレー', 2],
  ])
  eq(
    'ID照合: 同じIDに同じ料理名(まっさら端末の同梱レシピ)→本体はそのまま、記録などだけ足す',
    resolveMergeRecipeAction({ id: 1, title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: そのIDが空いている→従来どおり同じIDのまま追加する',
    resolveMergeRecipeAction({ id: 9, title: '自作レシピ' }, titleById, idByTitle),
    { kind: 'add' },
  )
  eq(
    'ID照合(版ズレ): 同じIDが別の料理に使われている+同じ料理名が無い→新しいIDで追加する(自作レシピを落とさない)',
    resolveMergeRecipeAction({ id: 2, title: 'わたしの唐揚げ' }, titleById, idByTitle),
    { kind: 'addWithNewId' },
  )
  eq(
    'ID照合(版ズレ): 同じIDが別の料理+同じ料理名が別のIDにある→そちらへ記録などを足す(二重登録しない)',
    resolveMergeRecipeAction({ id: 2, title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: 同じIDどうしの料理名は前後の空白を無視して同じ料理として扱う',
    resolveMergeRecipeAction({ id: 1, title: ' 肉じゃが ' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合(版ズレ): 料理名の突き合わせも前後の空白を無視する',
    resolveMergeRecipeAction({ id: 2, title: ' 肉じゃが ' }, titleById, idByTitle),
    { kind: 'enrich', targetId: 1 },
  )
  eq(
    'ID照合: IDが無い古い形式は従来どおり新規として追加する',
    resolveMergeRecipeAction({ title: '肉じゃが' }, titleById, idByTitle),
    { kind: 'addWithNewId' },
  )

  // --- mergeRecipeUserData: 既にあるレシピへ記録・お気に入り・写真だけ足す ---
  const photoA = 'photoA' // 実体(Blob)はDOM依存なので、ここでは同一性だけを見る代用値
  const photoB = 'photoB'
  const base = {
    id: 1,
    title: '肉じゃが',
    memo: '今の端末で書いたメモ',
    isFavorite: false,
    cookedLogs: [],
    servings: 2,
  }
  const fromFile = {
    id: 1,
    title: '肉じゃが',
    memo: 'ファイル側のメモ',
    isFavorite: true,
    photo: photoB,
    cookedLogs: [
      { date: '2026-07-01', note: '記録1', photo: photoB },
      { date: '2026-07-20', note: '記録2' },
    ],
    servings: 4,
  }
  const merged = mergeRecipeUserData(base, fromFile)
  eq('記録の取り込み: 件数(作った記録2件・お気に入り1・写真2枚)', {
    changed: merged.changed,
    cookedLogsAdded: merged.cookedLogsAdded,
    favoriteAdded: merged.favoriteAdded,
    photosAdded: merged.photosAdded,
  }, { changed: true, cookedLogsAdded: 2, favoriteAdded: true, photosAdded: 2 })
  eq(
    '記録の取り込み: レシピ本体(メモ・人数・料理名)は今のデータを優先し書き換えない',
    { memo: merged.recipe.memo, servings: merged.recipe.servings, title: merged.recipe.title },
    { memo: '今の端末で書いたメモ', servings: 2, title: '肉じゃが' },
  )
  eq('記録の取り込み: お気に入りはtrueを優先する', merged.recipe.isFavorite, true)
  eq('記録の取り込み: 写真は今のレシピに無いときだけ入れる', merged.recipe.photo, photoB)
  eq(
    '記録の取り込み: 今のレシピに写真があればファイル側で上書きしない',
    mergeRecipeUserData({ ...base, photo: photoA }, fromFile).recipe.photo,
    photoA,
  )
  const dedup = mergeRecipeUserData(
    { ...base, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
    { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
  )
  eq(
    '記録の取り込み: 同じ記録(日付+メモが同じ)は二重に足さない',
    { added: dedup.cookedLogsAdded, total: dedup.recipe.cookedLogs.length },
    { added: 0, total: 1 },
  )
  const fillPhoto = mergeRecipeUserData(
    { ...base, isFavorite: true, cookedLogs: [{ date: '2026-07-01', note: '記録1' }] },
    { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '記録1', photo: photoB }] },
  )
  eq(
    '記録の取り込み: 同じ記録に写真だけが無ければファイル側の写真で埋める(既存の写真は消さない)',
    { photosAdded: fillPhoto.photosAdded, photo: fillPhoto.recipe.cookedLogs[0].photo },
    { photosAdded: 1, photo: photoB },
  )
  eq(
    '記録の取り込み: 同じ日でもメモが違えば別の記録として足す',
    mergeRecipeUserData(
      { ...base, cookedLogs: [{ date: '2026-07-01', note: '1回目' }] },
      { ...fromFile, photo: undefined, cookedLogs: [{ date: '2026-07-01', note: '2回目' }] },
    ).recipe.cookedLogs.length,
    2,
  )
  eq(
    '記録の取り込み: 足すものが何も無ければ changed=false(DBへ書き戻さない)',
    mergeRecipeUserData({ ...base, isFavorite: true, photo: photoA }, { ...base, isFavorite: false, cookedLogs: [] })
      .changed,
    false,
  )

  // --- remapBackupRecipeRefs: 版ズレでIDを振り直したときの参照の付け替え ---
  const remapFile = {
    mealPlans: [{ date: '2026-08-01', slot: 'dinner', recipeId: 104 }],
    todayList: [{ recipeId: 104, addedAt: 1 }],
    shoppingItems: [{ name: 'にんじん', order: 1, isChecked: false, fromRecipeIds: [104, 7] }],
    mealTemplates: [{ name: '平日', items: [{ dow: 0, slot: 'dinner', role: 'main', recipeId: 104 }], createdAt: 1 }],
  }
  eq(
    '参照の付け替え: 振り直したレシピを指す献立・今日の献立・テンプレ・買い物メモが新しいIDを指す',
    remapBackupRecipeRefs(remapFile, new Map([[104, 210]])),
    {
      mealPlans: [{ date: '2026-08-01', slot: 'dinner', recipeId: 210 }],
      todayList: [{ recipeId: 210, addedAt: 1 }],
      shoppingItems: [{ name: 'にんじん', order: 1, isChecked: false, fromRecipeIds: [210, 7] }],
      mealTemplates: [{ name: '平日', items: [{ dow: 0, slot: 'dinner', role: 'main', recipeId: 210 }], createdAt: 1 }],
    },
  )
  eq(
    '参照の付け替え: 振り直しが無ければそのまま返す(項目の有無=undefinedも保つ)',
    remapBackupRecipeRefs({ mealPlans: undefined, todayList: [{ recipeId: 1, addedAt: 1 }] }, new Map()),
    { mealPlans: undefined, todayList: [{ recipeId: 1, addedAt: 1 }] },
  )
  eq(
    '参照の付け替え: 項目自体が無い古いバックアップでもエラーにならない(undefinedのまま)',
    remapBackupRecipeRefs({}, new Map([[1, 2]])),
    { mealPlans: undefined, todayList: undefined, shoppingItems: undefined, mealTemplates: undefined },
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
// 予告閾値を45→40へ引き下げ(2026-07-23 便BJ・docs/55 CEO提案:「40件あたりから静かにあと◯件を
// 表示する。突然壁に当てるのが一番心証が悪い」)。発売時にFREE_LIMIT_ENABLEDをONにしたときの
// 挙動を、フラグOFFの現状でも単体テストで固定する(フラグ非依存のisInWarningRangeで検証)
eq('予告閾値は40件', FREE_LIMIT_WARNING_THRESHOLD, 40)
eq('上限は50件', FREE_LIMIT, 50)
eq('39件はまだ予告域でない', isInWarningRange(39), false)
eq('40件から予告域に入る(最初のバナー)', isInWarningRange(40), true)
eq('49件も予告域', isInWarningRange(49), true)
eq('50件は予告でなくブロック域(予告域からは外れる)', isInWarningRange(50), false)
eq('「あと◯件」: 40件時点はあと10件', freeLimitRemaining(40), 10)
eq('「あと◯件」: 49件時点はあと1件', freeLimitRemaining(49), 1)
eq('「あと◯件」: 50件以上でも負にならない', freeLimitRemaining(51), 0)
// フラグOFFの現状は予告域でもバナーを出さない/Pro解錠済みは(将来ON時も)予告しない=不変条件
eq('フラグOFF: 予告域(40件)でもisNearFreeLimitはfalse', isNearFreeLimit(40, false), false)
eq('Pro解錠済みは予告しない', isNearFreeLimit(45, true), false)

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

// ---------- searchRecipes: 「在庫の食材で絞る」(在庫(ある/少ない)の食材を材料に含むレシピだけ・
// 2026-07-24 便BN・司令部追加。判定は在庫との一致順と同じ部分一致) ----------
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
    {
      id: 1,
      title: '玉ねぎ炒め',
      tags: [],
      searchWords: [],
      ingredients: [{ name: '玉ねぎ' }, { name: 'しょうゆ' }],
    },
    {
      id: 2,
      title: '豆腐サラダ',
      tags: [],
      searchWords: [],
      ingredients: [{ name: '絹ごし豆腐' }, { name: 'トマト' }],
    },
  ]
  eq(
    '在庫絞り込みOFFは全件',
    searchRecipes(recipes, baseOptions).map((r) => r.recipe.id),
    [1, 2],
  )
  eq(
    '在庫絞り込みON: 在庫「玉ねぎ」を使うレシピだけ残る',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: ['玉ねぎ'] }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
  eq(
    // 2026-07-29 便CC/C4: 判定は部分一致から「総称語→具体名」の表に置き換えたが、
    // 在庫「豆腐」で絹ごし豆腐のレシピが出るという意図はそのまま保つ
    '在庫絞り込みON: 総称の「豆腐」が「絹ごし豆腐」にヒットする(在庫一致順と同じ判定)',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: ['豆腐'] }).map(
      (r) => r.recipe.id,
    ),
    [2],
  )
  eq(
    '在庫絞り込みON: 在庫が空なら0件',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: [] }).map(
      (r) => r.recipe.id,
    ),
    [],
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

// ---------- NUT-01/NUT-02(2026-07-28 便BY): 部分欠落の判定と、計算対象外の理由・分量テキスト ----------
{
  const { computeRecipeNutrition, hasMaterialGap, sumPersonalNutrition } = await import(
    '../src/logic/nutrition.ts'
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
  // 2026-07-29 追加の副菜6品(docs/61)。判定結果はdocs/61 §4-7の実測どおり
  // (vegetable5・salad1。defaultに落ちる品はゼロ)
  'チンゲン菜としいたけのにんにく炒め': 'vegetable',
  '白菜とにんじんの中華とろみ煮': 'vegetable',
  'パプリカといんげんのオイスター炒め': 'vegetable',
  'かぼちゃのミルク煮': 'vegetable',
  'ラタトゥイユ': 'vegetable',
  'ブロッコリーとにんじんのハーブマリネ': 'salad',
}

{
  // 収録全109品(基本+旧テーマ由来)はstarterDefsが連結済み。旧public/sets/data/*.jsonは
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
  // (a) guessDishType は pickIconKey の結果を役割へ写像するだけ。全カタログ109品で、期待アイコン
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

  // (b-2) 2026-07-28 便BW/C-05: 実機QAで「全部 主菜(main)で保存される」と実測された6品の再発防止。
  // 5体のペルソナ全員が自動提案をそのまま通すと明言しており、誤った種別はそのままDBに残る。
  const dish = (title, ingredients = []) => guessDishType({ title, tags: [], ingredients })
  eq('C-05: 麦茶→その他(飲み物)', dish('麦茶', [{ name: '麦茶パック' }]), 'dessert')
  eq('C-05: ほうじ茶→その他(飲み物)', dish('ほうじ茶'), 'dessert')
  eq('C-05: 甘酒→その他(飲み物)', dish('甘酒'), 'dessert')
  eq('C-05: ぬか漬け→副菜(漬物)', dish('ぬか漬け', [{ name: 'きゅうり' }]), 'side')
  eq('C-05: きゅうりのピクルス→副菜', dish('きゅうりのピクルス'), 'side')
  eq('C-05: いちごのシャーベット→その他(菓子)', dish('いちごのシャーベット', [{ name: 'いちご' }]), 'dessert')
  eq('C-05: フルーツポンチ→その他(菓子)', dish('フルーツポンチ'), 'dessert')
  eq('C-05: 鮭のみそ汁→汁物(魚より汁物が料理の類型を決める)', dish('鮭のみそ汁', [{ name: '鮭' }]), 'soup')
  eq('C-05: あさりのお吸い物→汁物', dish('あさりのお吸い物', [{ name: 'あさり' }]), 'soup')
  eq('C-05: たらの水炊き→汁物', dish('たらの水炊き', [{ name: 'たら' }]), 'soup')
  // 汁物語を含まない魚料理は従来どおり主菜のまま(soupの前出しで魚料理を巻き込まないこと)
  eq('C-05: 鮭のホイル焼き→主菜(据え置き)', dish('鮭のホイル焼き', [{ name: '鮭' }]), 'main')
  eq('C-05: さばの味噌煮→主菜(据え置き)', dish('さばの味噌煮', [{ name: 'さば' }]), 'main')
  // 茶碗蒸し・お茶漬けは飲み物ではない(「茶」1文字を飲み物語に入れていないことの固定)
  eq('C-05: 茶碗蒸し→主菜(卵。飲み物にしない)', dish('茶碗蒸し', [{ name: '卵' }]), 'main')
  eq('C-05: 鮭のお茶漬け→主菜(ご飯もの。飲み物にしない)', dish('鮭のお茶漬け', [{ name: 'ご飯' }]), 'main')
  // 「◯◯漬け」全般を漬物にしていないこと(肉料理を副菜に巻き込まない)
  eq('C-05: 豚肉の味噌漬け→主菜(据え置き)', dish('豚肉の味噌漬け', [{ name: '豚ロース' }]), 'main')

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
    { yen: 390, rawYen: 390, source: 'user' },
  )
  eq(
    'estimateIngredientYen 個数系も按分(2個/1個あたり50円→100円)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '2', unit: '個' }, index),
    { yen: 100, rawYen: 100, source: 'user' },
  )
  eq(
    'estimateIngredientYen 非数値の分量(少々)はマスタの金額をそのまま使う',
    estimateIngredientYen({ name: '鶏もも肉', amount: '少々', unit: 'g' }, index),
    { yen: 130, rawYen: 130, source: 'user' },
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
      { totalYen: 0, perServingYen: 0 },
    )
    eq(
      'COST-02: 塩 小さじ1/4(=0.25円)も同じく0円で返す',
      estimateIngredientRowCost({ name: '塩', amount: '1/4', unit: '小さじ' }, seasoningIndex, 2),
      { totalYen: 0, perServingYen: 0 },
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
      { totalYen: 1, perServingYen: 0 }, // 0.667円→合計1円・1食あたり0.33円→0(1円未満)
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
  // 期待値オブジェクトにその2項目を足している(total/fromMasterCountの値は据え置き=週の表示は不変)
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
      { total: 50 + 260 + 50, fromMasterCount: 3, personalTotal: 25 + 130 + 25, dishCount: 3 },
    )
    eq(
      'sumMealPlanEntriesCost: 価格情報のないレシピは0円扱いで合計に影響しない',
      sumMealPlanEntriesCost([{ recipeId: 3 }], recipeById, index),
      { total: 0, fromMasterCount: 0, personalTotal: 0, dishCount: 1 },
    )
    eq(
      'sumMealPlanEntriesCost: recipeByIdに無いエントリ(削除済みレシピ等の孤児行)はスキップする',
      sumMealPlanEntriesCost([{ recipeId: 999 }, { recipeId: 1 }], recipeById, index),
      { total: 50, fromMasterCount: 1, personalTotal: 25, dishCount: 1 },
    )
    eq('sumMealPlanEntriesCost: エントリ0件は0円', sumMealPlanEntriesCost([], recipeById, index), {
      total: 0,
      fromMasterCount: 0,
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

    // pricelessIngredientNames(2026-07-29 便CD/MP-11): 概算食費に1円も入っていない材料を数え、
    // 「価格が分からない材料◯種類を除いた概算です」と正直に添えるために使う
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
      // 「価格が分からない材料1種類を除いた概算です」＋「食材と価格を編集する」が常時出るが、
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
    eq(
      'splitRangeByToday: 今日が始まりの期間は全部予定(今日は予定側=カレンダー表示の境界と揃える)',
      splitRangeByToday(TODAY, '2026-07-31', TODAY),
      { actual: null, plan: { start: TODAY, end: '2026-07-31' } },
    )
    eq(
      'splitRangeByToday: またぐ期間は今日の前日までが実績・今日から先が予定(同じ日を二重に数えない)',
      splitRangeByToday('2026-07-01', '2026-07-31', TODAY),
      {
        actual: { start: '2026-07-01', end: '2026-07-14' },
        plan: { start: TODAY, end: '2026-07-31' },
      },
    )
    eq(
      'splitRangeByToday: 月をまたぐ境界(今日が1日)でも前日は前月末になる',
      splitRangeByToday('2026-06-25', '2026-07-05', '2026-07-01'),
      {
        actual: { start: '2026-06-25', end: '2026-06-30' },
        plan: { start: '2026-07-01', end: '2026-07-05' },
      },
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
    // 2026-07-30 便CH/C2: 「価格が分からない材料◯種類」の注記は合計と同じ料理から数える。
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
  // 個数不一致(個 vs 本): 単位名が違うので換算せずフォールバック(マスタ価格そのまま)
  eq(
    'estimateIngredientYen 個数系は単位名が違うと按分せずフォールバック(50円/1個×1本→50円のまま)',
    estimateIngredientYen({ name: '玉ねぎ', amount: '1', unit: '本' }, onionIndex),
    { yen: 50, rawYen: 50, source: 'user' },
  )
  // 解釈不能(少々): 従来どおりマスタ価格そのままのフォールバック
  eq(
    'estimateIngredientYen 解釈不能な分量(少々)は従来どおりフォールバック',
    estimateIngredientYen({ name: '玉ねぎ', amount: '少々', unit: '個' }, onionIndex),
    { yen: 50, rawYen: 50, source: 'user' },
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
  // (4) 栄養側に目安量が無い組は従来どおり満額フォールバック(勝手な換算を作らない)
  const konnyakuIndex = buildPriceIndex([{ name: 'こんにゃく', pricePerUnit: 60, unit: '1枚' }])
  eq(
    'g換算按分: 換算の根拠が無い組(こんにゃく1袋 vs マスタ1枚)は従来どおり満額フォールバック',
    estimateIngredientYen({ name: 'こんにゃく', amount: '1', unit: '袋' }, konnyakuIndex),
    { yen: 60, rawYen: 60, source: 'user' },
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
  // 1回使用量を持たない食材(薬味等・docs/49 §7でオーナー了承済みの満額表示)は従来どおり
  const komeIndex = buildPriceIndex([{ name: '小ねぎ', pricePerUnit: 80, unit: '1袋' }])
  eq(
    '1回使用量: 持たない食材(小ねぎ「適量(お好みで)」)は従来どおり満額のまま(docs/49 §7の既決事項)',
    estimateIngredientYen({ name: '小ねぎ', amount: '適量(お好みで)', unit: '' }, komeIndex),
    { yen: 80, rawYen: 80, source: 'user' },
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
  // (8) 同梱109品の合計原価のピン留め(この数字が動いたら按分の前提が変わったということ)
  {
    const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    let grand = 0
    for (const def of starterDefs) grand += estimateRecipeCost(def.ingredients, idx).total
    // 2026-07-29 副菜6品追加で36,780→38,622円(+1,842円=6品ぶん。既存103品の値は不変)
    eq('同梱109品の概算食費の合計(便BY修正後。修正前は48,377円/103品時点は36,780円)', grand, 38622)
    const soup = starterDefs.find((d) => d.title.includes('中華風卵スープ'))
    eq('中華風卵スープ 1食あたり(修正前682円・ごま油「少々」に1Lボトル満額が乗っていた)', Math.round(estimateRecipeCost(soup.ingredients, idx).total / soup.servings), 85)
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

  // 別表記に見出し語の読みを当てない(2026-07-28 機能④診断)。
  // 以前は「くし形」に「くしがたぎり」(=くし形切り)が当たり「くし形切りに切る」と重複して読まれた
  eq(
    '別表記「くし形」は「くしがた」と読む(見出し語くし形切りの読みを流用しない)',
    toSpeechText('玉ねぎはくし形に切る。'),
    '玉ねぎはくしがたに切る。',
  )
  eq(
    '別表記「さいの目」も同様(さいのめぎりにならない)',
    toSpeechText('豆腐はさいの目に切る。'),
    '豆腐はさいのめに切る。',
  )
  eq(
    '別表記「落とし蓋」は見出し語と同じ読みを明示しているのでそのまま当たる',
    toSpeechText('落とし蓋をして煮る。'),
    'おとしぶたをして煮る。',
  )
  eq(
    '別表記に読みを書いていない語(あく)は表記のまま読み上げる',
    toSpeechText('あくを取る。'),
    'あくを取る。',
  )
  eq(
    '見出し語そのものは従来どおりreadingで置換される(回帰)',
    toSpeechText('玉ねぎはくし形切りにする。'),
    '玉ねぎはくしがたぎりにする。',
  )
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

// ---------- 自由な時間のタイマーの秒刻み表示(formatMinutesSecondsLabel。2026-07-12秒刻み対応) ----------
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
// 2026-07-23 便BJ・docs/55 CEO提案2-1: テキスト共有を「貼り付けで丸ごと取り込める形式」に変更。
// 料理名と人数分を別行にし、作り方(全手順)を【作り方】見出しつきで常に含める。末尾のアプリ名(#)と
// 入口URLは宣伝枠として残しつつ、取り込み時に自動除去される(下の「share往復」テストで実証)。
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
    '肉じゃが',
    '2人分',
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
    '【作り方】',
    '1. 切る',
    '2. 炒める',
    '3. 煮る',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: opts省略は料理名/人数分/材料8件+…ほか/作り方の取り込み可能形式', buildShareText(shareRecipe), expectedDefault)

  // 全項目OFF(既定はテキストに任意行なし)のoptsを渡してもopts省略と同じ出力になる。
  // 「レシピ画像」は画像カード専用オプションで、テキスト出力には一切影響しない(仕様の※併記)
  const offOpts = { image: false, cookMinutes: false, cost: false, nutrition: false, allIngredients: false }
  eq('share: 全OFFのoptsはopts省略と同一', buildShareText(shareRecipe, offOpts), expectedDefault)
  eq('share: 画像ONはテキストに影響しない(画像カード専用)', buildShareText(shareRecipe, { ...offOpts, image: true }), expectedDefault)

  // 組合せ1: 調理時間ON → 人数分の直後に「調理時間 約◯分」が入る
  const expectedWithCook = expectedDefault.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n調理時間 約30分\n【材料】',
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
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n原価 1人分 約210円／全量（2人分） 約420円\n【材料】',
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
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n1食あたり 約498kcal・塩分 約4.1g（概算）\n【材料】',
  )
  eq(
    'share: 栄養ONでカロリー・塩分(めやす)の行が入る',
    buildShareText(shareRecipe, { ...offOpts, nutrition: true, kcalPerServing: 498, saltPerServing: 4.1 }),
    expectedWithNutrition,
  )
  eq('share: 栄養の実数値なしはONでも行なし', buildShareText(shareRecipe, { ...offOpts, nutrition: true }), expectedDefault)

  // 組合せ4: 材料をすべて載せる → 9件全部が並び「…ほか」は消える
  const expectedAll = [
    '肉じゃが',
    '2人分',
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
    '【作り方】',
    '1. 切る',
    '2. 炒める',
    '3. 煮る',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: 材料をすべて載せる', buildShareText(shareRecipe, { ...offOpts, allIngredients: true }), expectedAll)

  // 全部ON: 任意行の順序は 調理時間→原価→栄養(仕様のモーダル並び順と同じ)
  const expectedFull = expectedAll.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n調理時間 約30分\n原価 1人分 約210円／全量（2人分） 約420円\n1食あたり 約498kcal・塩分 約4.1g（概算）\n【材料】',
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

  // share往復(2026-07-23 便BJ・docs/55 CEO提案2-1): コピーした全文をそのまま貼り付けパーサーに
  // 通すと、料理名・人数分・材料・作り方が過不足なく復元される(=見る専用でなく取り込める形式)。
  // 末尾のアプリ名(#)・入口URLは宣伝枠として残るが、取り込み時に手順へ化けず自動除去される。
  {
    const shared = buildShareText(shareRecipe, { ...offOpts, allIngredients: true })
    const parsed = parseRecipeText(shared)
    eq('share往復: 料理名が(人数分の括弧に汚れず)復元', parsed.title, '肉じゃが')
    eq('share往復: 人数分が復元', parsed.servings, 2)
    eq(
      'share往復: 材料名が全件復元',
      parsed.ingredients.map((i) => i.name),
      shareRecipe.ingredients.map((i) => i.name),
    )
    eq(
      'share往復: 材料の分量+単位が復元(大さじの並び順も一致)',
      parsed.ingredients.map((i) => formatAmountUnit(i.amount, i.unit)),
      shareRecipe.ingredients.map((i) => formatAmountUnit(i.amount, i.unit)),
    )
    eq(
      'share往復: 作り方が全手順復元',
      parsed.steps,
      shareRecipe.steps.map((s) => s.text),
    )
    eq('share往復: 末尾のアプリ名(#)・URLは手順に混ざらない', parsed.steps.length, shareRecipe.steps.length)
  }

  // 手順が1つも無いレシピでは【作り方】見出しごと省く(空見出しを残さない)。往復も材料まで成立する
  {
    const noSteps = { ...shareRecipe, steps: [] }
    const text = buildShareText(noSteps, { ...offOpts, allIngredients: true })
    eq('share: 手順なしレシピは【作り方】見出しが出ない', text.includes('【作り方】'), false)
    const parsed = parseRecipeText(text)
    eq('share往復(手順なし): 料理名が復元', parsed.title, '肉じゃが')
    eq(
      'share往復(手順なし): 材料は全件復元',
      parsed.ingredients.map((i) => i.name),
      noSteps.ingredients.map((i) => i.name),
    )
    eq('share往復(手順なし): 作り方は空', parsed.steps, [])
  }
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
// 2026-07-28 便BX/C08: 記号は名前から剥がすが捨てずに group として返す(手順文の「Aを加えて」が
// どの材料を指すのか取り込み後に完全に失われていた。名前は無記号のままなので栄養・原価の照合は不変)
eq('ingredient: グループ記号は名前から剥がしgroupに残す「Ａ水　2カップ」', splitIngredientAmount('Ａ水　2カップ'), { name: '水', amount: '2カップ', group: 'A' })
eq('ingredient: グループ記号(半角)もgroupに残す「B砂糖 大さじ1」', splitIngredientAmount('B砂糖 大さじ1'), { name: '砂糖', amount: '大さじ1', group: 'B' })
eq(
  'ingredient: グループ記号+括弧書き商品名「A「ほんだし®」 小さじ1」',
  splitIngredientAmount('A「ほんだし®」 小さじ1'),
  { name: '「ほんだし®」', amount: '小さじ1', group: 'A' },
)
eq('ingredient: グループ記号が無ければgroupは付かない', splitIngredientAmount('しょうゆ 大さじ2'), { name: 'しょうゆ', amount: '大さじ2' })
// 2026-07-28 便BX/C15(楽天レシピ実測): 材料欄の区切り線が材料1件として取り込まれ、
// 保存後の材料表・買い物リストにも「ーーーーーーーーーー」が残っていた
eq('ingredient/C15: 全角長音符の区切り線は材料にしない', splitIngredientAmount('ーーーーーーーーーーーーーーーーーーー'), { name: '' })
eq('ingredient/C15: 全角イコールの区切り線も材料にしない', splitIngredientAmount('＝＝＝＝＝＝'), { name: '' })
eq('ingredient/C15: 記号2文字までは巻き込まない(実在の材料名を守る)', splitIngredientAmount('ーー'), { name: 'ーー' })
eq('ingredient/C15: 普通の材料名は影響なし', splitIngredientAmount('じゃがいも 3個'), { name: 'じゃがいも', amount: '3個' })
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

// 2026-07-28 便BX/C14(楽天レシピ実測): HowToStep配列の各要素の先頭に元サイトの番号(①②)が
// 付いていると、アプリ側が自前で振る番号と並んで「1 ①じゃがいもは…」の二重表示になる
eq(
  'instructions/C14: 各要素の先頭の丸数字を剥がす(アプリ側の番号と二重にしない)',
  normalizeInstructions([
    { '@type': 'HowToStep', text: '①じゃがいもは4等分し、水にさらす' },
    { '@type': 'HowToStep', text: '②鍋にサラダ油をひき、肉を炒める' },
  ]),
  ['じゃがいもは4等分し、水にさらす', '鍋にサラダ油をひき、肉を炒める'],
)
eq(
  'instructions/C14: 「1.」形式の先頭番号も剥がす',
  normalizeInstructions([{ '@type': 'HowToStep', text: '1. 材料を切る' }]),
  ['材料を切る'],
)
eq(
  'instructions/C14: 先頭以外の番号は本文なので残す',
  normalizeInstructions([{ '@type': 'HowToStep', text: 'フライパンに2を入れて炒める' }]),
  ['フライパンに2を入れて炒める'],
)
// C11: 1要素に複数手順が連結されているときだけ割る。分量表記(「大さじ2、みりん大さじ1」)を
// 手順番号と誤認しないよう、要素内の分割は丸数字・角括弧数字だけを手がかりにする
eq(
  'instructions/C11: 1要素に連結された複数手順(丸数字)を割る',
  normalizeInstructions([{ '@type': 'HowToStep', text: '①野菜を切る。②鍋で煮る。③盛り付ける。' }]),
  ['野菜を切る。', '鍋で煮る。', '盛り付ける。'],
)
eq(
  'instructions/C11: 分量の「大さじ2、」を手順番号と誤認して割らない',
  normalizeInstructions([
    { '@type': 'HowToStep', text: 'しょうゆ大さじ2、みりん大さじ1、砂糖大さじ1を加えて煮る' },
    { '@type': 'HowToStep', text: '器に盛る' },
  ]),
  ['しょうゆ大さじ2、みりん大さじ1、砂糖大さじ1を加えて煮る', '器に盛る'],
)
eq(
  'instructions/C11: マーカーが1個だけなら割らない(先頭剥がしのみ)',
  normalizeInstructions([{ '@type': 'HowToStep', text: '①玉ねぎは1cm幅に切る' }]),
  ['玉ねぎは1cm幅に切る'],
)

// 2026-07-28 便BX/C07(DELISH KITCHEN実測): 媒体そのものの宣伝が料理名に残り、レシピ一覧・
// 献立・買い物リストにまで出ていた。キャッチコピー全般ではなく完全一致リテラルだけを剥がす
{
  const titleOf = (name) =>
    extractRecipeFromHtml(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name,
        recipeIngredient: ['じゃがいも 3個'],
        recipeInstructions: ['煮る'],
      })}</script>`,
      'https://example.com/r',
    ).title
  eq('title/C07: 「作り方が動画でわかる！」を剥がす', titleOf('作り方が動画でわかる！おすすめ具材で作る基本の肉じゃが'), 'おすすめ具材で作る基本の肉じゃが')
  eq('title/C07: レシピごとに違うキャッチコピーは剥がさない', titleOf('牛でも豚でも！ 簡単具材の肉じゃが'), '牛でも豚でも！ 簡単具材の肉じゃが')
  eq('title/C07: 「上品な仕上がり♪」も無傷', titleOf('上品な仕上がり♪ 白だしで作る肉じゃが'), '上品な仕上がり♪ 白だしで作る肉じゃが')
  eq('title/C07: 「簡単！肉じゃが」も無傷', titleOf('簡単！肉じゃが'), '簡単！肉じゃが')
  eq('title/C07: 末尾の定型句の除去は従来どおり', titleOf('肉じゃがの作り方'), '肉じゃが')
}

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

// ---- resolveImportErrorReason(src/logic/urlImportReason.ts、2026-07-28 便BX/C04・C05) ----
// 実機QAで「404・サイト側の拒否・一時的な通信不調・URLの打ち間違い」が全部同じ文言に潰れ、
// 404に対して「時間をおいて試す」という絶対に解決しない案内が出ていた回帰の防止。
eq('reason: 上流404はnot_found(URLを直すべき)', resolveImportErrorReason('fetch_failed', 404), 'not_found')
eq('reason: 上流410(消滅)もnot_found', resolveImportErrorReason('fetch_failed', 410), 'not_found')
eq('reason: 上流403(サイト側の拒否)はblocked', resolveImportErrorReason('fetch_failed', 403), 'blocked')
eq('reason: 上流401もblocked', resolveImportErrorReason('fetch_failed', 401), 'blocked')
eq('reason: 上流451もblocked', resolveImportErrorReason('fetch_failed', 451), 'blocked')
eq('reason: 上流500は一時障害扱いのままfetch_failed', resolveImportErrorReason('fetch_failed', 500), 'fetch_failed')
eq('reason: 上流503も一時障害扱い', resolveImportErrorReason('fetch_failed', 503), 'fetch_failed')
eq('reason: statusが無い(通信例外)ならfetch_failed', resolveImportErrorReason('fetch_failed', undefined), 'fetch_failed')
// invalid_url は「Workerがリクエストを受け付けなかった」判断なので、HTTPステータスで上書きしない
// (Workerは invalid_url を必ずHTTP400で返すため、ここを取り違えると死に文言に戻る)
eq('reason: invalid_urlはstatusに関係なくinvalid_url', resolveImportErrorReason('invalid_url', 400), 'invalid_url')
eq('reason: no_recipeはそのまま', resolveImportErrorReason('no_recipe', 200), 'no_recipe')
eq('reason: 未知のerror値はfetch_failedに落とす', resolveImportErrorReason('something_new', 404), 'not_found')
eq('reason: errorが無くてもfetch_failed', resolveImportErrorReason(undefined, undefined), 'fetch_failed')

// ---- urlImportRows(src/logic/urlImportRows.ts、2026-07-28 便BX/C07・C08・C09) ----
// C07: 貼り付け経路のゴミ行判定をURL取り込み経路にも通す(経路間の非対称の解消)
eq('rows/C07: SNS名だけの手順は落とす', filterImportedSteps(['鶏肉を切る', 'Instagram', '煮込む']), ['鶏肉を切る', '煮込む'])
eq('rows/C07: URLだけの手順は落とす', filterImportedSteps(['鶏肉を切る', 'https://example.com/ad']), ['鶏肉を切る'])
eq('rows/C07: ハッシュタグ行も落とす', filterImportedSteps(['鶏肉を切る', '#簡単レシピ']), ['鶏肉を切る'])
eq('rows/C07: 「関連レシピ」も落とす', filterImportedSteps(['鶏肉を切る', '関連レシピ']), ['鶏肉を切る'])
eq('rows/C07: 普通の手順は1件も落とさない', filterImportedSteps(['鍋に水を入れて沸かす', '弱火で20分煮る']), ['鍋に水を入れて沸かす', '弱火で20分煮る'])
// 安全弁: 判定が全部当たってしまったら疑って元のまま返す(取り込みが丸ごと空になる事故を防ぐ)
eq('rows/C07: 全部ゴミ判定になったら安全弁で元のまま', filterImportedSteps(['Instagram', '広告']), ['Instagram', '広告'])
eq('rows/C07: 空配列はそのまま', filterImportedSteps([]), [])

// C08: グループ記号 → 合わせ調味料グループ番号
eq('rows/C08: Aは1', seasoningGroupFromLetter('A'), 1)
eq('rows/C08: 全角Ａも1', seasoningGroupFromLetter('Ａ'), 1)
eq('rows/C08: Dは4(上限)', seasoningGroupFromLetter('D'), 4)
eq('rows/C08: 上限超え(E)は未設定(色が一周して見分けが付かないため)', seasoningGroupFromLetter('E'), undefined)
eq('rows/C08: 記号なしは未設定', seasoningGroupFromLetter(undefined), undefined)

// C08: 「A水」形式のグループ記号がグループ色+材料メモに引き継がれる(味の素パーク実測形)
eq(
  'rows/C08: グループ記号はグループ色に対応づけ、記号自体はメモに残す(名前は無記号のまま)',
  buildImportedIngredientRows([
    { name: '水', amount: '1.5カップ', group: 'A' },
    { name: '砂糖', amount: '大さじ1', group: 'B' },
    { name: '牛こま切れ肉', amount: '200g' },
  ]),
  [
    { name: '水', amount: '1.5', unit: 'カップ', memo: 'A', group: 1 },
    { name: '砂糖', amount: '1', unit: '大さじ', memo: 'B', group: 2 },
    { name: '牛こま切れ肉', amount: '200', unit: 'g', memo: '', group: undefined },
  ],
)
// C08: 分量を持たない見出し行(「合わせ調味料」等)は材料にせず、以降をひとまとまりにする
eq(
  'rows/C08: グループ見出し行は材料にせず、以降の材料をグループにまとめる',
  buildImportedIngredientRows([
    { name: 'じゃがいも', amount: '3個' },
    { name: '合わせ調味料' },
    { name: 'しょうゆ', amount: '大さじ2' },
    { name: 'みりん', amount: '大さじ2' },
  ]),
  [
    { name: 'じゃがいも', amount: '3', unit: '個', memo: '', group: undefined },
    { name: 'しょうゆ', amount: '2', unit: '大さじ', memo: '', group: 1 },
    { name: 'みりん', amount: '2', unit: '大さじ', memo: '', group: 1 },
  ],
)
eq(
  'rows/C08: 【A】形式の見出し行も同じ扱い',
  buildImportedIngredientRows([{ name: '【A】' }, { name: '酒', amount: '大さじ1' }]),
  [{ name: '酒', amount: '1', unit: '大さじ', memo: '', group: 1 }],
)
// 見出しに見えても分量を持つ行は材料(実材料を誤って消さないための条件)
eq(
  'rows/C08: 分量がある行は見出し語に一致しても材料として残す',
  buildImportedIngredientRows([{ name: '調味料', amount: '大さじ2' }]),
  [{ name: '調味料', amount: '2', unit: '大さじ', memo: '', group: undefined }],
)
eq(
  'rows/C07: 材料側のゴミ行も落とす',
  buildImportedIngredientRows([{ name: '関連レシピ' }, { name: '玉ねぎ', amount: '1個' }]),
  [{ name: '玉ねぎ', amount: '1', unit: '個', memo: '', group: undefined }],
)
// C09: 分量が読み取れなかった材料の件数(取り込み結果の内訳表示に使う)
// ---- C06(2026-07-28 便BX): 分量・単位の破損。本番Worker経由でクラシル/楽天/DELISHを再実測し、
// 実在した破損だけを対象にしている(帯分数・括弧グラム併記は設計どおりで破損ではないことを再確認済み) ----
// (1) カタカナ助数詞: クックパッドは「大きめ6コ」「大1コ」表記が多く、栄養・原価の両方が
//     「コ」を知らないため主材料が黙って計算対象外に落ちていた
eq('C06: 「6コ」→ unit=個に正規化', splitQuantity('6コ'), { amount: '6', unit: '個' })
eq('C06: 「3ヶ」→ unit=個に正規化', splitQuantity('3ヶ'), { amount: '3', unit: '個' })
eq('C06: 「4ワ」→ unit=束に正規化', splitQuantity('4ワ'), { amount: '4', unit: '束' })
eq('C06: 既知の単位はそのまま', splitQuantity('3個'), { amount: '3', unit: '個' })
// (2) 名前に残る大きさ修飾語: 楽天レシピ「にんじん 中1本」でWorkerが name=にんじん / amount=中1本 と
//     返し、1行に組み直すと「にんじん 中」が材料名になっていた
eq(
  'C06: 「にんじん」+「中1本」→ 名前は汚さずメモへ逃がす(楽天レシピ実測)',
  normalizeImportedIngredient('にんじん', '中1本'),
  { name: 'にんじん', amount: '1', unit: '本', memo: '中' },
)
eq(
  'C06: 「じゃがいも」+「中2個」も同じ',
  normalizeImportedIngredient('じゃがいも', '中2個'),
  { name: 'じゃがいも', amount: '2', unit: '個', memo: '中' },
)
eq(
  'C06: 分量が読めない行の末尾語には触らない(名前の一部の可能性を否定できないため)',
  normalizeImportedIngredient('大根 中'),
  { name: '大根 中', amount: '', unit: '' },
)
// (3) 範囲分量: 楽天レシピ「牛こま切れ 200〜250g」が栄養の対象外(reason=amount)に落ちていた。
//     表示・保存は原文のまま、計算だけ先頭値(少なめ側)を使う
eq('C06: 範囲分量の計算値は先頭値', leadingRangeAmount('200〜250'), '200')
eq('C06: 半角チルダの範囲も先頭値', leadingRangeAmount('200~250'), '200')
eq('C06: 全角チルダの範囲も先頭値', leadingRangeAmount('4～5'), '4')
eq('C06: 分数の範囲も先頭値', leadingRangeAmount('1/2〜1'), '1/2')
eq('C06: 範囲でなければそのまま', leadingRangeAmount('200'), '200')
eq('C06: 数値でない分量はそのまま', leadingRangeAmount('適量'), '適量')
eq('C06: 範囲分量が栄養計算で数値化できる(旧: null=対象外)', parseAmountNumber('200〜250'), 200)
eq('C06: 「4〜5」も先頭値', parseAmountNumber('4〜5'), 4)
// 表示・保存・人数スケールは従来どおり範囲のまま(F3の裁定を変えない)
eq('C06: 表示側の範囲は据え置き(人数変更しても原文のまま)', scaleAmount('4〜5', 2, 4, '個'), '4〜5')
eq('C06: splitQuantityは範囲を保持したまま単位だけ分ける', splitQuantity('200〜250g'), { amount: '200〜250', unit: 'g' })

eq(
  'rows/C09: 分量も単位も無い材料の件数を数える',
  countAmountlessRows(
    buildImportedIngredientRows([
      { name: '玉ねぎ', amount: '1個' },
      { name: '塩こしょう' },
      { name: 'サラダ油', amount: '適量' },
    ]),
  ),
  1,
)

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

// ---------- timerOrder: タイマーの表示順と端末内保存の読み戻し(2026-07-28 機能④診断C6/C7) ----------
{
  const { sortTimersForDisplay, parseStoredTimers, RESTORE_GRACE_MS } = await import(
    '../src/logic/timerOrder.ts'
  )

  // C6: 起動順のままだと「先に鳴るもの」が最下段に来ることがあった。
  // 終わったもの→残りが少ない順に並べ替える(元の配列は書き換えない)
  const base = [
    { id: 1, done: false, endsAt: 15_000 }, // 肉じゃが15分(先に起動・一番長い)
    { id: 2, done: false, endsAt: 5_000 }, // カレー5分
    { id: 3, done: false, endsAt: 2_000 }, // 味噌汁2分(最後に起動・一番先に鳴る)
  ]
  eq(
    'C6 起動順に関係なく残りが少ない順に並ぶ',
    sortTimersForDisplay(base).map((t) => t.id),
    [3, 2, 1],
  )
  eq('C6 元の配列(TimerProviderの状態)は並べ替えない', base.map((t) => t.id), [1, 2, 3])
  eq(
    'C6 終わったタイマーは残り時間に関わらず先頭に来る',
    sortTimersForDisplay([
      { id: 1, done: false, endsAt: 2_000 },
      { id: 2, done: true, endsAt: 9_000 },
      { id: 3, done: false, endsAt: 1_000 },
    ]).map((t) => t.id),
    [2, 3, 1],
  )
  eq('C6 0本・1本でも壊れない', sortTimersForDisplay([]).length, 0)

  // C7: リロード・タブ破棄でタイマーが全消滅していた。endsAtは絶対時刻なので保存→読み戻しで続く
  const now = 1_800_000_000_000
  const stored = JSON.stringify([
    {
      id: 7,
      key: '1-2-900',
      label: '肉じゃが',
      doneLabel: '煮込み終わり',
      recipeId: 1,
      stepNumber: 3,
      endsAt: now + 600_000,
      totalSeconds: 900,
      done: false,
      muted: false,
    },
  ])
  const restored = parseStoredTimers(stored, now)
  eq('C7 保存したタイマーが読み戻せる', restored.length, 1)
  eq('C7 終了予定時刻(絶対時刻)がそのまま復元される', restored[0].endsAt, now + 600_000)
  eq('C7 レシピID・手順番号・終了文言も保たれる', [restored[0].recipeId, restored[0].stepNumber, restored[0].doneLabel], [1, 3, '煮込み終わり'])
  eq(
    'C7 読み戻しの時点で終了時刻を過ぎている分は done で戻す(開いた瞬間に鳴らさない)',
    parseStoredTimers(stored, now + 900_000)[0].done,
    true,
  )
  eq(
    'C7 終了から1時間より古いものは捨てる(翌日に古い「終わり」が並ばない)',
    parseStoredTimers(stored, now + 600_000 + RESTORE_GRACE_MS + 1).length,
    0,
  )
  eq('C7 保存が無い・壊れているときは空で始める(起動を妨げない)', [
    parseStoredTimers(null, now).length,
    parseStoredTimers('', now).length,
    parseStoredTimers('{壊れたJSON', now).length,
    parseStoredTimers('{"not":"array"}', now).length,
  ], [0, 0, 0, 0])
  eq(
    'C7 idやendsAtが欠けた行は黙って捨てる',
    parseStoredTimers(JSON.stringify([{ label: 'こわれた行' }, null, 3]), now).length,
    0,
  )
}

// ---------- cookedWithinDays: 「最近作った」判定(2026-07-29 便CI/C08) ----------
// 旧実装は cookedLogs[0] の1件だけを見ており、addCookedLog が日付を見ずに先頭へ積むため、
// 過去の日付を後から記録すると「今日作ったばかりのレシピ」が最近作っていない扱いになっていた
// (ホーム「今日なに作る？」の候補と献立の自動提案が誤って拾う)。全件の最大日付で判定する。
{
  const day = 24 * 60 * 60 * 1000
  const ymd = (offsetDays) => new Date(Date.now() - offsetDays * day).toISOString().slice(0, 10)
  const recipeWith = (dates) => ({ cookedLogs: dates.map((date) => ({ date })) })

  eq('C08 記録が無ければ false', cookedWithinDays(recipeWith([]), 14), false)
  eq('C08 今日の記録だけなら true', cookedWithinDays(recipeWith([ymd(0)]), 14), true)
  eq('C08 30日前の記録だけなら false', cookedWithinDays(recipeWith([ymd(30)]), 14), false)
  eq(
    'C08 今日の記録のあとに過去日を足しても(配列先頭が古くても)true のまま',
    cookedWithinDays(recipeWith([ymd(60), ymd(0)]), 14),
    true,
  )
  eq(
    'C08 並び順に関わらず判定は同じ(全件の最大日付で見る)',
    cookedWithinDays(recipeWith([ymd(0), ymd(60)]), 14),
    cookedWithinDays(recipeWith([ymd(60), ymd(0)]), 14),
  )
  eq(
    'C08 古い記録しか無ければ、何件あっても false',
    cookedWithinDays(recipeWith([ymd(90), ymd(40), ymd(20)]), 14),
    false,
  )
}

// ---------- 古い記録の書き出し(アーカイブ。2026-08-02 オーナー採用) ----------
// 期間の境目・追記型の重複排除・壊れたファイルの読み取りを固定する。
// 事故になるのは①境目がずれて「残すはずの記録」まで書き出して消す
// ②追記で同じ記録が二重に増える／逆に別件が1件に潰れる ③1件壊れているだけで全部読めなくなる、の3つ。
{
  // (1) 期間の境目: 「◯ヶ月より前」はちょうど◯ヶ月前の当日を含まない
  eq('ARCH 1ヶ月前の境目', archiveCutoffDate(1, new Date(2026, 7, 2)), '2026-07-02')
  eq('ARCH 3ヶ月前の境目', archiveCutoffDate(3, new Date(2026, 7, 2)), '2026-05-02')
  eq('ARCH 6ヶ月前の境目(年をまたぐ)', archiveCutoffDate(6, new Date(2026, 2, 15)), '2025-09-15')
  // 月末の丸め: 3/31の1ヶ月前は「2/31」=JSでは3/3になるため、月末へ丸めないと境目が未来へずれる
  eq('ARCH 月末は月末へ丸める(3/31→2/28)', archiveCutoffDate(1, new Date(2026, 2, 31)), '2026-02-28')
  eq('ARCH 月末は月末へ丸める(5/31→4/30)', archiveCutoffDate(1, new Date(2026, 4, 31)), '2026-04-30')

  const archRecipes = [
    {
      id: 1,
      title: '肉じゃが',
      cookedLogs: [
        { date: '2026-08-01', note: '今月の記録' }, // 残る
        { date: '2026-07-02' }, // 境目ちょうど = 残る
        { date: '2026-07-01', note: 'メモあり' }, // 対象
        { date: '2026-06-30' }, // 対象(写真なし)
      ],
    },
    {
      id: 2,
      title: 'カレーライス',
      cookedLogs: [
        { date: '2026-05-05', photo: { size: 1 } }, // 対象(写真あり)
        { date: '2026-05-05' }, // 同じ日・メモ無しの2件目(対象)
      ],
    },
  ]
  const archCutoff = archiveCutoffDate(1, new Date(2026, 7, 2))
  const archTargets = collectArchiveTargets(archRecipes, archCutoff)
  eq(
    'ARCH 境目ちょうどの記録は書き出さない(残す)',
    archTargets.every((t) => t.log.date < '2026-07-02'),
    true,
  )
  eq('ARCH 対象件数', countArchiveTargets(archTargets).logs, 4)
  eq('ARCH 対象の写真枚数', countArchiveTargets(archTargets).photos, 1)
  eq('ARCH 対象のレシピ数', countArchiveTargets(archTargets).recipes, 2)
  eq('ARCH 並びは日付の新しい順', archTargets.map((t) => t.log.date), [
    '2026-07-01',
    '2026-06-30',
    '2026-05-05',
    '2026-05-05',
  ])
  // 同じ料理・同じ日・メモ無しが2件あっても、連番で別件として残る(潰れない)
  const archDupIds = archTargets.filter((t) => t.recipeId === 2).map((t) => t.id)
  eq('ARCH 同じ日の重複記録は連番で別件になる', new Set(archDupIds).size, 2)
  // 端末から消すときも同じIDが作られる(消す対象の取り違え防止)
  eq(
    'ARCH 消すとき用のIDは書き出し時と同じ',
    archiveIdsForRecipe(archRecipes[1]),
    archDupIds,
  )
  // 同じ料理名のレシピを2品登録していても、記録のIDはぶつからない
  // (ぶつかると、ファイルに入っていない方の記録まで「書き出した記録を消す」で消える)
  eq(
    'ARCH 同名レシピが2品あってもIDがぶつからない',
    archiveIdsForRecipe({ id: 10, title: 'カレー', cookedLogs: [{ date: '2026-05-05' }] })[0] ===
      archiveIdsForRecipe({ id: 11, title: 'カレー', cookedLogs: [{ date: '2026-05-05' }] })[0],
    false,
  )

  // (2) 追記型の統合: 同じIDは1件にまとめ、写真は「有る方」を残す
  const archOld = [
    { id: 'a', date: '2026-05-01', recipeTitle: '肉じゃが' },
    { id: 'b', date: '2026-04-01', recipeTitle: 'カレーライス', photoBase64: 'AAA', photoType: 'image/jpeg' },
  ]
  const archNew = [
    { id: 'a', date: '2026-05-01', recipeTitle: '肉じゃが', photoBase64: 'BBB', photoType: 'image/jpeg' },
    { id: 'c', date: '2026-06-01', recipeTitle: '肉豆腐' },
  ]
  const archMerged = mergeArchiveLogs(archOld, archNew)
  eq('ARCH 統合で同じIDは1件にまとまる', archMerged.length, 3)
  eq('ARCH 統合の並びは日付の新しい順', archMerged.map((l) => l.id), ['c', 'a', 'b'])
  eq(
    'ARCH 統合で欠けていた写真は新しい方から埋まる',
    archMerged.find((l) => l.id === 'a').photoBase64,
    'BBB',
  )
  eq(
    'ARCH 統合で既にある写真は消えない',
    archMerged.find((l) => l.id === 'b').photoBase64,
    'AAA',
  )
  eq('ARCH 同じ内容を2回統合しても増えない', mergeArchiveLogs(archMerged, archMerged).length, 3)

  // (3) ファイルの読み取り: 種別マークで区別し、壊れた記録は数えて残りは読む
  const archFileJson = JSON.stringify(buildArchiveFile(archMerged, '2026-08-02T00:00:00.000Z'))
  eq('ARCH 書き出したファイルに種別マークが入る', JSON.parse(archFileJson).kind, ARCHIVE_KIND)
  const archParsed = parseArchiveFile(archFileJson)
  eq('ARCH 書き出し→読み込みで件数が保たれる', archParsed.logs.length, 3)
  eq('ARCH 壊れた記録は0件', archParsed.brokenCount, 0)

  const archBroken = parseArchiveFile(
    JSON.stringify({
      app: 'uchi-recipe',
      kind: ARCHIVE_KIND,
      version: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      logs: [
        { id: 'ok1', date: '2026-05-01', recipeTitle: '肉じゃが' },
        { id: 'ng1', date: '2026-05-02' }, // 料理名が無い
        { id: 'ng2', date: 'こわれた', recipeTitle: 'カレーライス' }, // 日付の形が違う
        null,
        { date: '2026-05-03', recipeTitle: '肉豆腐' }, // IDが無い(手編集)→作り直す
      ],
    }),
  )
  eq('ARCH 壊れたファイルでも読める記録は読む', archBroken.logs.length, 2)
  // 同じIDが二重に入っているファイルでも1件にまとめる(閲覧の件数と引き継ぐ件数を合わせる)
  eq(
    'ARCH 同じIDが二重に入っていても1件にまとめる',
    parseArchiveFile(
      JSON.stringify({
        app: 'uchi-recipe',
        kind: ARCHIVE_KIND,
        version: 1,
        exportedAt: '',
        logs: [
          { id: 'dup', date: '2026-05-01', recipeTitle: '肉じゃが' },
          { id: 'dup', date: '2026-05-01', recipeTitle: '肉じゃが' },
        ],
      }),
    ).logs.length,
    1,
  )
  eq('ARCH 読めなかった記録の件数を数える', archBroken.brokenCount, 3)
  eq(
    'ARCH IDの無い記録はIDを作り直す',
    archBroken.logs.some((l) => l.id.includes('肉豆腐')),
    true,
  )

  const archReason = (json) => {
    try {
      parseArchiveFile(json)
      return 'ok'
    } catch (e) {
      return e instanceof ArchiveFileError ? e.reason : 'other'
    }
  }
  eq(
    'ARCH バックアップファイルは「バックアップです」と言い分ける',
    archReason(JSON.stringify({ app: 'uchi-recipe', version: 1, recipes: [] })),
    'backup',
  )
  eq('ARCH JSONでないファイルは読めない扱い', archReason('これはJSONではない'), 'invalid')
  eq(
    'ARCH 他アプリのJSONは読めない扱い',
    archReason(JSON.stringify({ app: 'other', logs: [] })),
    'invalid',
  )
  eq('ARCH ファイル名にバックアップと同じ名前を使わない', archiveFileName(new Date(2026, 7, 2)), 'uchi-recipe-records-2026-08-02.json')
  eq('ARCH 日付の表示', formatArchiveDate('2026-07-02'), '2026年7月2日')
}

// ---------- 便CI 第3波: 検索の配線(C09/C21/C12/C11/C16) ----------
// 実機QAで「和食66件 / わしょく0件」「作り置き44件 / つくりおき0件」「鶏ひき肉3件 / とりひきにく0件」と、
// 登録時のタグ候補では引ける読みが検索では1件も引けなかった(読み辞書が検索に配線されていなかった)。
{
  // 全109品の基本レシピを実データとして使い、漢字表記とかな表記の件数が一致することを見る
  const ciRecipes = starterDefs.map((def, index) => ({
    id: index + 1,
    title: def.title,
    servings: def.servings ?? 2,
    effortLevel: def.effortLevel ?? 'normal',
    tags: def.tags ?? [],
    ingredients: def.ingredients ?? [],
    steps: def.steps ?? [],
    isFavorite: false,
    cookedLogs: [],
    createdAt: 0,
    updatedAt: index,
    searchWords: buildSearchWords(def.title, def.ingredients ?? [], def.tags ?? [], def.keywords),
  }))
  const ciBase = {
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
  const hits = (query) => searchRecipes(ciRecipes, { ...ciBase, query }).length

  // C09: タグのかな検索(漢字表記でも引けるままであること=既存の検索結果を1件も減らさない)
  for (const [kanji, kana] of [
    ['和食', 'わしょく'],
    ['中華', 'ちゅうか'],
    ['作り置き', 'つくりおき'],
    ['お弁当', 'おべんとう'],
    ['煮物', 'にもの'],
    ['汁物', 'しるもの'],
    ['鍋', 'なべ'],
    ['魚', 'さかな'],
    ['高たんぱく', 'こうたんぱく'],
    ['冷凍ストック', 'れいとうすとっく'],
  ]) {
    const kanjiHits = hits(kanji)
    eq(`C09 タグ「${kanji}」は1件以上ヒットする(従来どおり)`, kanjiHits > 0, true)
    eq(`C09 かな「${kana}」でも同じ件数になる`, hits(kana), kanjiHits)
  }

  // C21: 「鶏ひき肉」など、ひらがな交じりの材料名の読み
  eq('C21 「鶏ひき肉」は1件以上ヒットする', hits('鶏ひき肉') > 0, true)
  eq('C21 「とりひきにく」でも同じ件数', hits('とりひきにく'), hits('鶏ひき肉'))
  eq('C21 「鶏挽肉」(未使用表記)でも同じ件数', hits('鶏挽肉'), hits('鶏ひき肉'))
  eq('C21 「ひきにく」は鶏・豚をまとめて拾う', hits('ひきにく'), hits('ひき肉'))

  // C12: 料理名の読み。同梱レシピは全品が読みに変換できること(基本レシピを増やしたらここが落ちる)
  const unreadable = starterDefs
    .map((def) => def.title)
    .filter((title) => /[^ぁ-ゟーa-z0-9 ]/.test(titleKanaKey(title)))
  eq(`C12 同梱レシピの料理名はすべて読みに変換できる(未登録=${unreadable.join('・')})`, unreadable, [])
  eq('C12 読み: 肉じゃが', titleKanaKey('肉じゃが'), 'にくじゃが')
  eq('C12 読み: 豚汁(ぶたしるにしない)', titleKanaKey('豚汁'), 'とんじる')
  eq('C12 読み: 白和え', titleKanaKey('白和え'), 'しらあえ')
  eq('C12 辞書に無い料理名も、よく出る語の分だけ読みに寄せる', titleKanaKey('大葉の照り焼き'), '大葉のてりやき')
  // 五十音順が実際にあ→ん順になっている(旧実装では漢字始まりが末尾に固まっていた)
  const kanaSorted = sortResults(searchRecipes(ciRecipes, ciBase), 'kana', [], 'asc')
  const kanaKeys = kanaSorted.map((r) => titleKanaKey(r.recipe.title))
  const collatorJa = new Intl.Collator('ja')
  eq(
    'C12 五十音順の並びが読みの昇順になっている',
    kanaKeys.every((key, i) => i === 0 || collatorJa.compare(kanaKeys[i - 1], key) <= 0),
    true,
  )
  eq('C12 五十音順の先頭は「あ」で始まる読み', kanaKeys[0].startsWith('あ'), true)
  eq(
    'C12 漢字始まりの料理名が末尾に固まっていない(肉じゃがは「に」の位置)',
    kanaSorted.findIndex((r) => r.recipe.title === '肉じゃが') < kanaSorted.length - 20,
    true,
  )

  // C11: 「使いたい食材」を入れている間は、ぜんぶ使えるレシピが必ず先頭に出る
  const wanted = searchRecipes(ciRecipes, { ...ciBase, ingredients: 'キャベツ にんじん' })
  const sortedByUpdated = sortResults(wanted, 'updated', [])
  eq(
    'C11 並べ替えが更新順のままでも「ぜんぶ使える」が先頭に来る',
    sortedByUpdated[0].usedCount,
    2,
  )
  eq(
    'C11 usedCountの降順が崩れない(並べ替えの選択は同点内でだけ効く)',
    sortedByUpdated.every((r, i) => i === 0 || sortedByUpdated[i - 1].usedCount >= r.usedCount),
    true,
  )
  eq(
    'C11 五十音順を選んでも「ぜんぶ使える」優先は変わらない',
    sortResults(wanted, 'kana', [], 'asc')[0].usedCount,
    2,
  )
  eq(
    'C11 「使いたい食材」を入れていないときは並べ替えの結果を変えない',
    sortResults(searchRecipes(ciRecipes, ciBase), 'kana', [], 'asc').map((r) => r.recipe.id),
    kanaSorted.map((r) => r.recipe.id),
  )

  // C16: 作った記録のひとことメモも検索対象にする
  const withNote = ciRecipes.map((r) =>
    r.title === '肉じゃが'
      ? { ...r, cookedLogs: [{ date: '2026-07-20', note: '子どもが完食した' }] }
      : r,
  )
  eq(
    'C16 記録メモの言葉で検索するとそのレシピが出る',
    searchRecipes(withNote, { ...ciBase, query: '完食' }).map((r) => r.recipe.title),
    ['肉じゃが'],
  )
  eq(
    'C16 記録メモはレシピ保存を挟まなくても効く(searchWordsに入れない)',
    searchRecipes(ciRecipes, { ...ciBase, query: '完食' }).length,
    0,
  )
}

// ---------- buildShareText: 共有は表示している人数の分量で出す(2026-07-29 便CI/C18) ----------
{
  const c18Recipe = {
    id: 1,
    title: 'さわらの西京焼き',
    servings: 2,
    effortLevel: 'normal',
    tags: [],
    ingredients: [
      { name: 'さわら(切り身)', amount: '2', unit: '切れ' },
      { name: 'みそ', amount: '2', unit: '大さじ' },
    ],
    steps: [{ text: '漬ける' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  }
  const opts = { image: true, cookMinutes: false, cost: false, nutrition: false, allIngredients: true }
  const asRegistered = buildShareText(c18Recipe, opts)
  eq('C18 人数を渡さなければ従来どおり登録人数で出る', asRegistered.includes('\n2人分\n'), true)
  eq('C18 登録人数のままなら分量の表記も変わらない', asRegistered.includes('・さわら(切り身) 2切れ'), true)
  const asShown = buildShareText(c18Recipe, { ...opts, servings: 4 })
  eq('C18 表示人数4人分で共有すると「4人分」になる', asShown.includes('\n4人分\n'), true)
  eq('C18 材料の分量も4人分にスケールする', asShown.includes('・さわら(切り身) 4切れ'), true)
  eq('C18 調味料も一緒にスケールする', asShown.includes('・みそ 大さじ4'), true)
}

// ---------- 人数分の範囲ガード(2026-07-30 便CK/①-1) ----------
// ±ボタンのonClickにしかクランプが無く、URL取り込み(50人分)・貼り付け(50人分)・下書き復元(99人分)は
// 素通りしてそのまま保存できていた(手では21人分以上を作れないのに、詳細ページに
// 「50人分レシピの1食あたり 約24円」が出る状態)。全経路がこのクランプを通る形に直した
{
  eq('便CK/①-1 人数分の範囲は1〜20', [MIN_SERVINGS, MAX_SERVINGS], [1, 20])
  eq('便CK/①-1 範囲内の値はそのまま', clampServings(4), 4)
  eq('便CK/①-1 下限・上限そのものは通る', [clampServings(1), clampServings(20)], [1, 20])
  eq('便CK/①-1 貼り付けの50人分は20人分に収める', clampServings(50), 20)
  eq('便CK/①-1 URL取り込みの48人分は20人分に収める', clampServings(48), 20)
  eq('便CK/①-1 下書きの99人分は20人分に収める', clampServings(99), 20)
  eq('便CK/①-1 0以下は下限に寄せる', [clampServings(0), clampServings(-3)], [1, 1])
  eq('便CK/①-1 小数は切り捨てる(2.5人分は作れない)', clampServings(2.5), 2)
  eq('便CK/①-1 壊れた値(NaN)は下限に寄せる', clampServings(Number.NaN), 1)
  eq(
    '便CK/①-1 保存前の範囲チェック: 範囲外はfalse',
    [isServingsInRange(0), isServingsInRange(21), isServingsInRange(50), isServingsInRange(2.5)],
    [false, false, false, false],
  )
  eq(
    '便CK/①-1 保存前の範囲チェック: 範囲内はtrue',
    [isServingsInRange(1), isServingsInRange(2), isServingsInRange(20)],
    [true, true, true],
  )
}

// ---------- 置き換え確認に写真を含める(2026-07-30 便CK/②-1・S1) ----------
// 写真つきの既存レシピを編集中にURL取り込みすると、確認文にも判定にも写真が無いため
// 確認なく写真が差し替わり、保存すると元の写真は復元できなくなっていた(規約Fの漏れ)
{
  eq('便CK/②-1 写真があり「写真も取り込む」ONなら置き換わる', photoReplacePlan(true, true), 'replace')
  eq('便CK/②-1 写真があってもOFFならそのまま残る', photoReplacePlan(true, false), 'kept')
  eq('便CK/②-1 写真が無ければ写真については何も起きない', photoReplacePlan(false, true), 'none')
  const filled = { filledIngredients: 1, filledSteps: 1, parsedIngredients: 2, parsedSteps: 2 }
  eq(
    '便CK/②-1 材料・手順・写真の3つとも消えるものとして数える',
    replaceConfirmTargets({ ...filled, photoPlan: 'replace' }),
    { ingredients: true, steps: true, photo: true },
  )
  eq(
    '便CK/②-1 写真がOFFで残るなら写真は「消えるもの」ではない',
    replaceConfirmTargets({ ...filled, photoPlan: 'kept' }).photo,
    false,
  )
  // 料理名と写真だけのレシピ(材料・手順が空)でも、写真が置き換わるなら確認を出す
  const photoOnly = {
    filledIngredients: 0,
    filledSteps: 0,
    parsedIngredients: 2,
    parsedSteps: 2,
    photoPlan: 'replace',
  }
  eq(
    '便CK/②-1 材料・手順が空でも写真が置き換わるなら確認する',
    needsReplaceConfirm(replaceConfirmTargets(photoOnly)),
    true,
  )
  eq(
    '便CK/②-1 消えるものが何も無ければ確認は出さない(便BW/C-04の仕様は維持)',
    needsReplaceConfirm(
      replaceConfirmTargets({ ...photoOnly, photoPlan: 'none' }),
    ),
    false,
  )
  eq(
    '便CK/②-1 入力済みでも取り込み側が0件ならその項目は消えない(便BW/C-04の仕様は維持)',
    replaceConfirmTargets({
      filledIngredients: 3,
      filledSteps: 3,
      parsedIngredients: 0,
      parsedSteps: 0,
      photoPlan: 'none',
    }),
    { ingredients: false, steps: false, photo: false },
  )
}

// ---------- 声で操作のコマンド判定(2026-07-30 便CK/④-1) ----------
// 判定が /もう1?回|もういちど|もう一度/ で、「1」が半角数字だったため
// 案内文どおりの「もう一回」(漢数字)と「もういっかい」が完全無反応だった
// (読み上げが起きないだけでなく「聞き取りました」の手応えも出ない)
{
  eq('便CK/④-1 「もう一回」(漢数字)で読み上げ直す', matchVoiceCommand('もう一回'), 'repeat')
  eq('便CK/④-1 「もういっかい」でも読み上げ直す', matchVoiceCommand('もういっかい'), 'repeat')
  eq('便CK/④-1 「もう1回」(半角)は従来どおり動く', matchVoiceCommand('もう1回'), 'repeat')
  eq('便CK/④-1 「もう１回」(全角)も動く', matchVoiceCommand('もう１回'), 'repeat')
  eq('便CK/④-1 「もう一度」は従来どおり動く', matchVoiceCommand('もう一度'), 'repeat')
  eq('便CK/④-1 「もういちど」は従来どおり動く', matchVoiceCommand('もういちど'), 'repeat')
  eq('便CK/④-1 「次へ」は手順を進める', matchVoiceCommand('次へ'), 'next')
  eq('便CK/④-1 「つぎ」も手順を進める', matchVoiceCommand('つぎ'), 'next')
  eq('便CK/④-1 「戻って」は手順を戻す', matchVoiceCommand('戻って'), 'prev')
  eq('便CK/④-1 「まえ」も手順を戻す', matchVoiceCommand('まえ'), 'prev')
  eq('便CK/④-1 「ストップ」は読み上げを止める', matchVoiceCommand('ストップ'), 'stop')
  eq('便CK/④-1 「止めて」も読み上げを止める', matchVoiceCommand('止めて'), 'stop')
  eq('便CK/④-1 「タイマー」はタイマー', matchVoiceCommand('タイマー'), 'timer')
  eq('便CK/④-1 「3分タイマー」もタイマー', matchVoiceCommand('3分タイマー'), 'timer')
  eq('便CK/④-1 どれでもない言葉は無反応(手応えも出さない)', matchVoiceCommand('こんばんは'), undefined)
  // 分岐の優先順位は従来のif-elseの順番どおり(先に「次へ」を見る)
  eq('便CK/④-1 優先順位は従来どおり(「次へ」が先)', matchVoiceCommand('次へもう一回'), 'next')
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

  // (3) 日別集計: 過去日=作った記録・今日以降=登録した献立(便CA以降の統一規則。二重計上しない)
  const cabbage = one('キャベツ', '100', 'g')
  const carrot = one('にんじん', '50', 'g')
  const clDates = ['2026-07-28', '2026-07-29', '2026-07-30', '2026-07-31']
  const clMap = dayBalanceMap({
    dates: clDates,
    today: '2026-07-30',
    cooked: [
      { date: '2026-07-28', recipe: cabbage },
      // 今日の作った記録は「今日以降=予定」の規則により数えない(月タブと同じ境界)
      { date: '2026-07-30', recipe: carrot },
    ],
    planned: [
      // 過去日の予定は数えない(過去は実績だけ)
      { date: '2026-07-28', recipe: carrot },
      { date: '2026-07-30', recipe: cabbage },
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
  eq('CL-DAY 今日は予定で数える(基準)', clMap.get('2026-07-30').basis, 'plan')
  eq(
    'CL-DAY 今日の作った記録は合計に入れない(二重計上しない)',
    Math.round(clMap.get('2026-07-30').balance.vegetableG),
    100,
  )
  eq('CL-DAY 未来日も予定で数える', clMap.get('2026-07-31').basis, 'plan')
  eq('CL-DAY 数えた日数は記録/予定がある日だけ', summarizeWeekBalance(clMap.values()).countedDays, 3)
  eq(
    'CL-DAY 週まとめは各日の1人分を足した値',
    Math.round(summarizeWeekBalance(clMap.values()).balance.vegetableG),
    300,
  )
  eq(
    'CL-DAY 週まとめの品数も各日の合算',
    summarizeWeekBalance(clMap.values()).balance.nutrition.dishCount,
    3,
  )

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

  // (4) 計算対象外が混ざる日の作法(docs/60 §5)。1品でもあれば「めやすとの並置」を出さない
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
  eq('CL-MIX 全部計算できた日はめやすを並置できる', canCompareDay(cleanSum.nutrition), true)
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

  // (6) めやすの定数: 値と出典が必ず対で入っていること(出典なしの数値をコードに入れさせない)
  eq('CL-GUIDE 食塩相当量のめやす(男性)', DAILY_GUIDES.saltG.male, 7.5)
  eq('CL-GUIDE 食塩相当量のめやす(女性)', DAILY_GUIDES.saltG.female, 6.5)
  eq('CL-GUIDE 野菜のめやす', DAILY_GUIDES.vegetableG.perDayG, 350)
  for (const [key, guide] of Object.entries(DAILY_GUIDES)) {
    eq(`CL-GUIDE ${key}に出典名がある`, typeof guide.source === 'string' && guide.source.length > 0, true)
    eq(
      `CL-GUIDE ${key}に出典URLがある`,
      typeof guide.sourceUrl === 'string' && guide.sourceUrl.startsWith('https://'),
      true,
    )
  }
  // めやすは1日ぶん×日数に伸ばす(週まとめ。7日固定では掛けない)
  eq('CL-GUIDE 3日ぶんの塩分めやす(男性)', guideForDays(DAILY_GUIDES.saltG.male, 3), 22.5)
  eq('CL-GUIDE 3日ぶんの野菜めやす', guideForDays(DAILY_GUIDES.vegetableG.perDayG, 3), 1050)
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

  // --- (2) 目的の軸: 何を比べているか(めやすからの距離ではなく、候補どうしの比較) ---
  const totals = (proteinG, saltG) => ({ proteinG, saltG })
  eq('CP2-AXIS たんぱく質軸の項目は proteinG', PURPOSE_NUTRIENT_KEY.protein, 'proteinG')
  eq('CP2-AXIS 塩分軸の項目は saltG', PURPOSE_NUTRIENT_KEY.lowSalt, 'saltG')
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
}

// ---------- 便CT/C15: 買い物メモの売り場順カスタム(2026-08-02 オーナー承認) ----------
{
  // 未設定(既存ユーザー)は従来どおりの既定順のまま
  eq('CT-AISLE 未設定は既定順', normalizeAisleOrder(undefined), [
    'vegetable',
    'meatFish',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 空配列も既定順', normalizeAisleOrder([]), [...SHOPPING_AISLE_ORDER])
  // 保存した並びはそのまま使う
  eq(
    'CT-AISLE 保存した並びをそのまま使う',
    normalizeAisleOrder(['seasoning', 'other', 'staple', 'soyEgg', 'meatFish', 'vegetable']),
    ['seasoning', 'other', 'staple', 'soyEgg', 'meatFish', 'vegetable'],
  )
  // 欠けているグループは既定順で末尾に補う(グループが増えても買い物メモから消えない)
  eq('CT-AISLE 欠けたグループは末尾に補う', normalizeAisleOrder(['seasoning', 'vegetable']), [
    'seasoning',
    'vegetable',
    'meatFish',
    'soyEgg',
    'staple',
    'other',
  ])
  // 壊れた保存値(未知のキー・重複)は黙って捨て、必ず6グループ揃った並びにする
  eq(
    'CT-AISLE 未知のキーは捨てる',
    normalizeAisleOrder(['sweets', 'seasoning', 'vegetable']),
    ['seasoning', 'vegetable', 'meatFish', 'soyEgg', 'staple', 'other'],
  )
  eq(
    'CT-AISLE 重複は最初の1つだけ残す',
    normalizeAisleOrder(['seasoning', 'seasoning', 'vegetable']),
    ['seasoning', 'vegetable', 'meatFish', 'soyEgg', 'staple', 'other'],
  )
  eq('CT-AISLE 常に6グループ揃う', normalizeAisleOrder(['other']).length, 6)

  // 上下移動(設定のホームカスタマイズと同じ入れ替え方式)
  eq('CT-AISLE 下へ移動', moveAisleGroup(SHOPPING_AISLE_ORDER, 0, 1), [
    'meatFish',
    'vegetable',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 上へ移動', moveAisleGroup(SHOPPING_AISLE_ORDER, 1, -1), [
    'meatFish',
    'vegetable',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 先頭を上へ押しても変わらない', moveAisleGroup(SHOPPING_AISLE_ORDER, 0, -1), [
    ...SHOPPING_AISLE_ORDER,
  ])
  eq('CT-AISLE 末尾を下へ押しても変わらない', moveAisleGroup(SHOPPING_AISLE_ORDER, 5, 1), [
    ...SHOPPING_AISLE_ORDER,
  ])
  eq('CT-AISLE 元の配列は書き換えない', SHOPPING_AISLE_ORDER[0], 'vegetable')

  eq('CT-AISLE 未設定は既定扱い', isDefaultAisleOrder(undefined), true)
  eq('CT-AISLE 既定と同じ並びは既定扱い', isDefaultAisleOrder([...SHOPPING_AISLE_ORDER]), true)
  eq(
    'CT-AISLE 入れ替えたら既定ではない',
    isDefaultAisleOrder(moveAisleGroup(SHOPPING_AISLE_ORDER, 0, 1)),
    false,
  )

  // 買い物メモの整列に即反映される(表示専用の並べ替え・同グループ内は追加順を保つ)
  const memo = [
    { name: 'しょうゆ' },
    { name: '玉ねぎ' },
    { name: '豚こま切れ肉' },
    { name: 'にんじん' },
  ]
  eq(
    'CT-AISLE 既定順では野菜→肉→調味料',
    sortShoppingByAisle(memo).map((i) => i.name),
    ['玉ねぎ', 'にんじん', '豚こま切れ肉', 'しょうゆ'],
  )
  eq(
    'CT-AISLE 調味料を先頭にした並びが整列に反映される',
    sortShoppingByAisle(memo, ['seasoning', 'meatFish', 'vegetable', 'soyEgg', 'staple', 'other']).map(
      (i) => i.name,
    ),
    ['しょうゆ', '豚こま切れ肉', '玉ねぎ', 'にんじん'],
  )
  eq(
    'CT-AISLE 欠けた保存値でも整列できる(補完した既定順で並ぶ)',
    sortShoppingByAisle(memo, ['seasoning']).map((i) => i.name),
    ['しょうゆ', '玉ねぎ', 'にんじん', '豚こま切れ肉'],
  )
  eq(
    'CT-AISLE 同じグループ内は元の追加順を保つ',
    sortShoppingByAisle([{ name: 'にんじん' }, { name: '玉ねぎ' }]).map((i) => i.name),
    ['にんじん', '玉ねぎ'],
  )
}

// ---------- 便CT: レシピ一覧のまとめて削除の確認文(規約F。2026-08-02 オーナー承認) ----------
{
  const log = (photo) => (photo ? { date: '2026-08-01', photo: { size: 1 } } : { date: '2026-08-01' })
  // 「入れ直しで戻せる基本レシピ」は同梱の基本レシピだけ。配布セット由来(sourceSetIdあり)は
  // 削除でトゥームストーンが残り入れ直しでも復活しないので、戻せる扱いにしない
  eq('CT-DEL 同梱の基本レシピは戻せる', isRestorableStarter({ isStarter: true }), true)
  eq(
    'CT-DEL 配布セット由来は戻せない',
    isRestorableStarter({ isStarter: true, sourceSetId: 'kintore' }),
    false,
  )
  eq('CT-DEL 自作レシピは戻せない', isRestorableStarter({ isStarter: false }), false)

  const impact = summarizeRecipeDeleteImpact(
    [
      { isStarter: true, cookedLogs: [log(true), log(false)] },
      { isStarter: false, cookedLogs: [log(true)] },
      { isStarter: true, sourceSetId: 'kintore', cookedLogs: [] },
    ],
    { totalRecipes: 109, mealPlanEntries: 4, todayEntries: 2 },
  )
  eq('CT-DEL 削除する品数', impact.recipes, 3)
  eq('CT-DEL 作った記録の合計', impact.cookedLogs, 3)
  eq('CT-DEL 写真つきの枚数', impact.photos, 2)
  eq('CT-DEL 戻せる基本レシピの品数', impact.restorableStarters, 1)
  eq('CT-DEL 献立の予定の件数', impact.mealPlanEntries, 4)
  eq('CT-DEL 今日の献立の件数', impact.todayEntries, 2)
  eq('CT-DEL 残るレシピの品数', impact.remaining, 106)

  const text = buildBulkDeleteConfirmText(impact)
  // 規約F: 何が消えるか・何が残るかを件数つきで両方書く(「よろしいですか？」だけは禁止)
  eq('CT-DEL 確認文に削除する品数が入る', /レシピ3品を削除します/.test(text), true)
  eq('CT-DEL 確認文に作った記録の件数が入る', /作った記録3件/.test(text), true)
  eq('CT-DEL 確認文に写真の枚数が入る', /写真2枚/.test(text), true)
  eq('CT-DEL 確認文に献立の予定の件数が入る', /献立の予定4件/.test(text), true)
  eq('CT-DEL 確認文に今日の献立の件数が入る', /今日の献立2件/.test(text), true)
  eq('CT-DEL 確認文に元に戻せないことが入る', text.includes('元に戻せません'), true)
  eq('CT-DEL 確認文に残るレシピの品数が入る', /ほかのレシピ106品/.test(text), true)
  eq('CT-DEL 確認文に残るものが入る', /買い物メモ・食材の在庫は残ります/.test(text), true)
  eq('CT-DEL 「よろしいですか？」だけで終わらせない', text.includes('よろしいですか'), false)
  // 基本レシピだけは入れ直しで戻せる(ただし記録は戻らない)ことを区別して書く。
  // 規約H: 場所は指示語ではなく画面名・ボタン名で言う
  eq('CT-DEL 基本レシピの戻し方を添える', /基本レシピ1品は、設定画面の「基本レシピを入れ直す」で戻せます/.test(text), true)
  eq('CT-DEL 記録は戻らないことを添える', text.includes('作った記録は戻りません'), true)

  // 基本レシピを含まない選択では、入れ直しの一文を出さない(戻せない品に戻せると言わない)
  const ownOnly = summarizeRecipeDeleteImpact([{ isStarter: false, cookedLogs: [] }], {
    totalRecipes: 5,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 自作だけなら入れ直しの一文は出さない', ownOnly.restorableStarters, 0)
  eq(
    'CT-DEL 自作だけの確認文に入れ直しの案内を出さない',
    buildBulkDeleteConfirmText(ownOnly).includes('基本レシピを入れ直す'),
    false,
  )
  eq(
    'CT-DEL 記録0件でも件数を明示する(0件と書く)',
    /作った記録0件（うち写真0枚）/.test(buildBulkDeleteConfirmText(ownOnly)),
    true,
  )
  // 全部消す選択でも「残り0品」と正直に書く(残るものの行自体は消さない)
  const allGone = summarizeRecipeDeleteImpact([{ isStarter: false }, { isStarter: false }], {
    totalRecipes: 2,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 全件削除なら残りは0品', allGone.remaining, 0)
  eq('CT-DEL 残り0品でも残るものを書く', /ほかのレシピ0品/.test(buildBulkDeleteConfirmText(allGone)), true)
  // 記録の配列が無いレシピ(cookedLogs未設定)でも落ちない
  eq(
    'CT-DEL cookedLogs未設定でも数えられる',
    summarizeRecipeDeleteImpact([{ isStarter: true }], {
      totalRecipes: 1,
      mealPlanEntries: 0,
      todayEntries: 0,
    }).cookedLogs,
    0,
  )
}

// ---------- 便CY: 配色トークンの取りこぼし防止(2026-08-02 オーナー確定の面別アクセント) ----------
// 色は src/index.css と public/about 配下7ファイルが「同じ値を別々に書き写している」構造で、
// 片方だけ直して見た目がずれる事故が実際に起きている(規約E-③)。ここで静的に突き合わせる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const css = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')

  // (1) 4テーマすべてが「面別」の2本を持つこと。1本だけの --accent-ink: <色> の直書きが
  //     残っていると、テーマを足したときに面別の切り替えから漏れる
  const themeBlocks = [
    ['ライト', /:root \{[\s\S]*?\n\}/],
    ['ダーク(端末設定)', /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n {2}\}\n\}/],
    ['ダーク(手動)', /:root\[data-theme="dark"\] \{[\s\S]*?\n\}/],
    ['ブラウン', /:root\[data-theme="brown"\] \{[\s\S]*?\n\}/],
    ['グリーン', /:root\[data-theme="green"\] \{[\s\S]*?\n\}/],
  ]
  for (const [name, re] of themeBlocks) {
    const block = css.match(re)?.[0] ?? ''
    eq(`CY 色 ${name}が--accent-ink-pageを持つ`, /--accent-ink-page:/.test(block), true)
    eq(`CY 色 ${name}が--accent-ink-surfaceを持つ`, /--accent-ink-surface:/.test(block), true)
  }

  // (2) オーナー確定値そのもの(2026-08-02・docs/色調整見本2_ブラウングリーン.html)
  const val = (block, name) => css.match(block)?.[0]?.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]
  eq('CY 色 ライトの塗り--accentは#cc3f01', val(/:root \{[\s\S]*?\n\}/, '--accent'), '#cc3f01')
  eq(
    'CY 色 ブラウンはページ背景用#833a00',
    val(/:root\[data-theme="brown"\] \{[\s\S]*?\n\}/, '--accent-ink-page'),
    '#833a00',
  )
  eq(
    'CY 色 ブラウンはカード面用#ad4e01',
    val(/:root\[data-theme="brown"\] \{[\s\S]*?\n\}/, '--accent-ink-surface'),
    '#ad4e01',
  )
  eq(
    'CY 色 グリーンは両面とも#c25200',
    [
      val(/:root\[data-theme="green"\] \{[\s\S]*?\n\}/, '--accent-ink-page'),
      val(/:root\[data-theme="green"\] \{[\s\S]*?\n\}/, '--accent-ink-surface'),
    ],
    ['#c25200', '#c25200'],
  )

  // (3) カード面で値を差し替えるスコープ規則が消えていないこと
  //     (これが無いとブラウンのカード面が濃すぎる方の色に戻る)
  eq(
    'CY 色 カード面スコープの規則がある',
    /\[class~="bg-surface"\][\s\S]{0,80}--accent-ink: var\(--accent-ink-surface\)/.test(css),
    true,
  )

  // (4) 静的ページ7ファイルが同じ値を書き写していること
  const aboutFiles = [
    'index.html',
    'manual.html',
    'terms.html',
    'unlock.html',
    'column/index.html',
    'column/kondate-kimaranai.html',
    'column/recipe-screenshot-seiri.html',
  ]
  const aboutDir = path.join(appRoot, 'public/about')
  const aboutColors = aboutFiles.map((f) => {
    const src = readFileSync(path.join(aboutDir, f), 'utf-8')
    const pick = (name) => (src.match(new RegExp(`${name}:\\s*([^;]+);`, 'g')) ?? []).map((s) => s.split(':')[1].trim().replace(';', ''))
    return { file: f, accent: pick('--accent'), page: pick('--accent-ink-page'), surface: pick('--accent-ink-surface') }
  })
  eq('CY 色 aboutは7ファイル', aboutColors.length, 7)
  for (const c of aboutColors) {
    // ライト→ダークの順に1回ずつ、計2つ出てくる
    eq(`CY 色 ${c.file} の塗り(ライト/ダーク)`, c.accent, ['#cc3f01', '#ff8a4c'])
    eq(`CY 色 ${c.file} のページ背景用文字色`, c.page, ['#b8380a', '#ff8a4c'])
    eq(`CY 色 ${c.file} のカード面用文字色`, c.surface, ['#b8380a', '#ff8a4c'])
  }
}

// ---------- 結果 ----------
console.log(`合格: ${passed}件 / 失敗: ${failures.length}件`)
for (const f of failures) console.log(`  NG ${f}`)
process.exit(failures.length > 0 ? 1 : 0)
