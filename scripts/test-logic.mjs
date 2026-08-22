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
import { normalizeQuarterTurns, rotatedSize } from '../src/logic/image.ts'
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
  APPLIANCE_SEARCH_WORDS,
  dishTypeSearchWord,
} from '../src/logic/kana.ts'
import { READINGS_VERSION } from '../src/logic/ingredientReadings.ts'
import { pickDayCoverPhoto, setDayCoverChoice } from '../src/logic/monthCover.ts'
import { diffDayEdit } from '../src/logic/dayEdit.ts'
import { formatMinutesSecondsLabel } from '../src/logic/time.ts'
import {
  normalizeProCode,
  isValidProCode,
  detectCodeKind,
  maskUnlockCode,
} from '../src/logic/pro.ts'
import {
  isAtFreeLimit,
  freeLimitNoticeFor,
  freeLimitRemaining,
  countFreeLimitRecipes,
  FREE_LIMIT,
  FREE_LIMIT_NOTICE_COUNTS,
} from '../src/logic/freeLimit.ts'
import {
  parseAmountNumber,
  convertToGrams,
  computeRecipeNutrition,
  NUTRITION_DISPLAY_KEYS,
  nutritionLabelFor,
} from '../src/logic/nutrition.ts'
import { isNewsSuppressed, isNewsVisibleFor } from '../src/logic/news.ts'
import {
  suggestCandidates,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  isPastDate,
  shiftDate,
  dowIndex,
  sortMealSlots,
  sortMealGenres,
  toggleMealGenre,
  normalizePlanGenres,
  MEAL_GENRES,
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
  todayListPickedIds,
  isRecipeInToday,
  todaySlotAddPlan,
  showsCookedPlanRowToday,
  staleTodayListFromPlanIds,
  recipeDishType,
  mealRoleForRecipe,
} from '../src/logic/mealPlan.ts'
import { suggestionCandidates, DISH_TYPE_OPTIONS } from '../src/logic/homeSuggest.ts'
import {
  shouldShowPermissionHelp,
  shouldShowUnsupportedNote,
  vibrationSupported,
} from '../src/logic/cookingSupport.ts'
import { preferSeasonWithFallback, SEASON_MIN_CANDIDATES } from '../src/logic/season.ts'
import { guessDishType } from '../src/logic/dishTypeGuess.ts'
import { PRICE_DEFAULTS } from '../src/data/priceDefaults.ts'
import {
  buildShoppingCandidates,
  sortShoppingByAisle,
  groupShoppingByAisle,
  resolveShoppingSources,
  combineAmountTexts,
  parseRecipeIdsParam,
  parseServingsParam,
  filterShoppingEntries,
  shoppingRangeIncludesTodayList,
  isShoppingRangeNarrowed,
  formatShoppingRangeDates,
  formatShoppingRangeLabel,
  toRawRiceIngredient,
  splitCheckedShoppingItems,
  COOKED_RICE_TO_RAW_RATIO,
} from '../src/logic/shopping.ts'
import {
  TIMER_SOUND_VOLUMES,
  TIMER_SOUND_LENGTHS,
  timerSoundGain,
  timerSoundBeepCount,
  timerSoundSeconds,
} from '../src/logic/timerSound.ts'
import { selectPantryDowngrades } from '../src/logic/pantry.ts'
import { CARD_DENSITIES, densityForListLayout } from '../src/logic/cardDensity.ts'
import {
  CARD_PART_KEYS,
  CARD_PLACE_PARTS,
  DEFAULT_CARD_PLACE,
  cardPartsFor,
} from '../src/logic/cardParts.ts'
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
  buildBulkDeleteConfirm,
  buildSingleDeleteConfirm,
  isRestorableStarter,
} from '../src/logic/recipeDelete.ts'
import { NUTRITION_DATA } from '../src/logic/nutritionData.ts'
import {
  hasFillableWorkDuringWait,
  classifyStep,
  resolveStepMinutes,
  buildCookTimeline,
  buildCookPlan,
  isHandsOnStep,
  stepCategory,
  cutOrderRank,
  buildPlanSteps,
  isSoakWait,
  isLongRestStep,
  endsWithLongRest,
  showsWaitTimerButton,
  recipeServeTemp,
  estimateActiveMinutes,
  waitUrgency,
  waitOverrunAllowance,
  splitBoilWaterClause,
  splitMixedStep,
  splitWaitFirstStep,
  resolveWaitMinutes,
  recipeStepLabel,
  hasParallelCue,
  stepHeatShift,
  heatOffAtEnd,
  waitTimerSeconds,
  BOIL_WATER_MINUTES,
} from '../src/logic/cookNavi.ts'
import {
  stepAppliance,
  stepApplianceFor,
  kitchenFromSettings,
  clampBurners,
  DEFAULT_KITCHEN,
} from '../src/logic/cookAppliance.ts'
import {
  parseCookNaviSession,
  restoreCookNaviSession,
  serializeCookNaviSession,
  reconcileSelectedIds,
  reconcileSelectedIdsForSession,
  resolveCookNaviSelection,
  pickDefaultSelectedIds,
  saveCookNaviSession,
  loadCookNaviSession,
  clearCookNaviSession,
  COOK_NAVI_MAX_RECIPES,
  COOK_NAVI_SESSION_KEY,
  COOK_NAVI_SESSION_VERSION,
} from '../src/logic/cookNaviSession.ts'
import {
  assignRecipeNotes,
  classifyRecipeNote,
  recipeNoteStepKey,
  splitRecipeNoteLines,
} from '../src/logic/naviRecipeNotes.ts'
import {
  moveStepDownPull,
  moveStepUpPull,
  reorderIssues,
  reorderIssuesByStep,
  reorderStepKey,
} from '../src/logic/cookReorder.ts'
import {
  advanceCursor,
  applyStepPulls,
  backCursor,
  collapseStepText,
  cursorEquals,
  findCursorIndex,
  isCursorAtFirst,
  isCursorAtLast,
  nextStepsByRecipe,
  resolveColorMove,
  resolveCursor,
  resolveTimerStepLanding,
  resumeCursor,
  startCursor,
} from '../src/logic/cookSession.ts'
import {
  stepIngredientAmounts,
  recipeIngredientList,
} from '../src/logic/naviIngredients.ts'
import {
  buildIngredientNames as naviIngredientNames,
  findIngredientMatches as naviIngredientMatches,
} from '../src/logic/ingredientSpans.ts'
import { stepMinutesFromText, importedStepMinutes } from '../src/logic/importStepMinutes.ts'
import {
  parseBackup,
  resolveDuplicateTitleAction,
  buildUpdatedSetRecipe,
  exclusionRecordFor,
  buildExclusionTitleSet,
  tablesToReplace,
  mergeUnlockCodes,
  countReplaceImpact,
  daysSinceBackup,
  backupNoticeKind,
  buildReplaceSettings,
  mergeTableRows,
  mergeRowKeys,
  resolveMergeRecipeAction,
  mergeRecipeUserData,
  remapBackupRecipeRefs,
  buildSelectedRecipesExportConfirm,
  buildReplaceConfirm,
  buildUndoReplaceConfirm,
} from '../src/logic/backup.ts'
import {
  supportsSaveFilePicker,
  backupFileName,
  selectedRecipesFileName,
  isAbortError,
} from '../src/logic/fileSave.ts'
// 同じ料理名の品に番号を付けて入れる道具（2026-08-22 便JA）。名前を1つずつ import せず
// まとめて受け取るのは、**関数が無いときに import ごと落ちて他の節の結果まで消えるのを避ける**ため
// （IZ-1 と同じ「掴めていないことを先に赤で言う」作法。下の JA-0 が有無そのものを測る）
import * as backupLogic from '../src/logic/backup.ts'
import { formatFileSize } from '../src/logic/fileSize.ts'
import {
  sortResults,
  lastCookedDate,
  defaultSortDirection,
  buildNutrientSortValues,
  isNutrientSortOption,
  isFreeSortOption,
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  PRO_NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_LABELS,
  NUTRIENT_SORT_FIELD,
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
  rangeBasisParts,
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
} from '../src/logic/nutritionBalance.ts'
import {
  LESS_MEAL_PURPOSES,
  MEAL_PURPOSES,
  MEAL_ROLES,
  MORE_MEAL_PURPOSES,
} from '../src/db/types.ts'
import {
  WEEK_RETURN_KEY,
  WEEK_RETURN_PARAM,
  LAST_RECIPES_PATH_KEY,
  DAY_RETURN_KEY,
  MONTH_RETURN_KEY,
  MEAL_PLAN_TAB_TAP_KEY,
  DAY_SUGGEST_PIN_KEY,
  parseSuggestionPin,
  parseSuggestionPlanPin,
  parseViewReturn,
  parseWeekReturn,
  pickReturnAnchor,
  scrollTargetForAnchor,
  serializeSuggestionPin,
  serializeViewReturn,
  serializeWeekReturn,
} from '../src/logic/navMemory.ts'
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
} from '../src/logic/proTrial.ts'
import {
  buildMonthDemoData,
  demoRecipeTitles,
  DEMO_PHOTO_KEYS,
  DEMO_TODAY,
} from '../src/logic/monthDemo.ts'
import { normalizeUnit, parseUnitQuantity } from '../src/logic/unitGrams.ts'
import { KNOWN_UNITS, OTHER_UNIT, decomposeUnit, composeUnit } from '../src/logic/unitForm.ts'
import {
  pickMainIngredients,
  normalizeIngredientChipLabel,
  pickDisplayIngredientChips,
} from '../src/logic/mainIngredients.ts'
import {
  searchRecipes,
  topTagsByUsage,
  tagUsageCounts,
  searchMatchReasons,
  searchMatchSummary,
  searchMatchRowText,
  splitTerms,
  defaultSearchOptions,
} from '../src/logic/search.ts'
import { buildShareText } from '../src/logic/share.ts'
import { ingredientColorToken } from '../src/logic/ingredientColor.ts'
import { pickIconKey, resolveIconKey, iconKeyOrder } from '../src/logic/icon.ts'
import {
  starterDefs,
  buildUpdatedStarterRecipe,
  planStarterReload,
  planStarterReloadFor,
  countStarterReloadImpact,
  buildStarterReloadConfirm,
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
import { cookedWithinDays, isOneTapCookedLog } from '../src/logic/cooked.ts'
import {
  ARCHIVE_KIND,
  ArchiveFileError,
  archiveCutoffDate,
  archiveFileName,
  archiveIdsForDetached,
  archiveIdsForRecipe,
  buildArchiveDeleteConfirm,
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
  stripPastedMarkup,
  stripImportedMarkup,
} from '../src/logic/urlImportRows.ts'
import {
  MIN_SERVINGS,
  MAX_SERVINGS,
  clampServings,
  isServingsInRange,
  defaultMealServings,
  effectiveMealServings,
} from '../src/logic/servings.ts'
import {
  photoReplacePlan,
  replaceConfirmTargets,
  needsReplaceConfirm,
} from '../src/logic/replaceConfirm.ts'
import {
  matchVoiceColor,
  matchVoiceCommand,
  pickVoiceResumeTarget,
  pickVoiceStopTarget,
  resolveVoiceTimerSeconds,
} from '../src/logic/voiceCommand.ts'
import {
  NAVI_COLOR_SPEECH,
  NAVI_COLOR_WORDS,
  NAVI_RECIPE_COLORS,
  naviColorWord,
} from '../src/logic/naviColors.ts'
import { ja } from '../src/i18n/ja.ts'
import { confirmContentText } from '../src/logic/confirmContent.ts'
import { settingsLinkWithBack, resolveBackTarget } from '../src/logic/backLink.ts'
import { isStandaloneDisplay } from '../src/logic/standalone.ts'
import { shouldShowHomeScreenNotice } from '../src/logic/homeScreenNotice.ts'
import {
  shouldShowFirstSetupNotice,
  hasChosenFirstSetup,
  FIRST_SETUP_NOTICE_SEEN_KEY,
} from '../src/logic/firstSetupNotice.ts'
import { isImeConfirmKey } from '../src/logic/imeKey.ts'
// 便GZ: レシピを削除しても「作った記録」が残る仕組み（2026-08-16 オーナー承認）
import {
  starterRecipeUid,
  isStarterUid,
  newRecipeUid,
  planRecipeUidBackfill,
} from '../src/logic/recipeUid.ts'
import {
  buildDetachedRecord,
  mergeDetachedRecords,
  planDetachedReattach,
  detachedRecipeStub,
  countDetachedLogs,
  detachedPhotoBytes,
} from '../src/logic/detachedLogs.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// 並行調理ナビの診断が使う「割ってはいけない手順」の判定（2026-08-16 便HA・docs/68 の裁定）。
// 診断そのものは1回15秒かかるので、直接実行されたときだけ走るようになっている
// （`audit-cook-navi.mjs` の RUN_AUDIT）。ここでは判定の関数だけを読む
import { notSplittableReason, isMixedStep } from './audit-cook-navi.mjs'

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
// --- 便FU-3(2026-08-12 利用者テスト): 貼り付けで登録すると「調理時間」が空のまま ---
// 指摘（原文）:「手順ごとの分（10分・15分）は自動で入れてくれたのに、レシピ一覧でも詳細でも
// 私の3品には時間バッジが出ません。URLから取り込んだときは『人数分・調理時間も読み込んだ内容に
// 合わせました』と出たので、貼り付けだけ扱いが違います」
//
// 調べた結果、扱いが違うのは「どこから調理時間を得るか」だった。URL取り込みは
// ページの構造化データ(totalTime)から受け取る。貼り付けは本文に書かれた行を写すしかなく、
// その行の読み取りが「N分」の形だけに限られていた。時間・範囲・「の目安」を写せるようにする。
{
  const withLine = (line) => parseRecipeText(`テスト\n${line}\n材料\n・ねぎ…1本\n作り方\n1. 煮る`)
  eq('FU-3 「調理時間 1時間」を写す', withLine('調理時間 1時間').cookMinutes, 60)
  eq('FU-3 「調理時間 1時間30分」を写す', withLine('調理時間 1時間30分').cookMinutes, 90)
  eq('FU-3 「調理時間 1時間半」を写す', withLine('調理時間 1時間半').cookMinutes, 90)
  eq('FU-3 範囲は長いほうを写す（20〜30分→30）', withLine('調理時間 20〜30分').cookMinutes, 30)
  eq('FU-3 半角チルダの範囲も写す', withLine('調理時間 20~30分').cookMinutes, 30)
  eq('FU-3 「調理時間の目安 25分」も写す', withLine('調理時間の目安 25分').cookMinutes, 25)
  eq('FU-3 「所要時間：約1時間15分」も写す', withLine('所要時間：約1時間15分').cookMinutes, 75)
  // 時間の行は材料・手順に混ざらない（読み飛ばしはこれまでどおり）
  eq('FU-3 時間の行は手順に入らない', withLine('調理時間 1時間30分').steps, ['煮る'])
  eq('FU-3 時間の行は材料に入らない', withLine('調理時間 20〜30分').ingredients.map((i) => i.name), ['ねぎ'])
  // 準備時間は今までどおり採らない（読み飛ばすだけ）
  eq('FU-3 「準備時間 1時間」は調理時間にしない', withLine('準備時間 1時間').cookMinutes, undefined)
  // 時間の話でない行を巻き込まない（メタ行だと誤認して本文を落とさない）
  const notTime = parseRecipeText('テスト\n材料\n・ねぎ…1本\n作り方\n1. 調理時間はお好みで加減する')
  eq('FU-3 「調理時間はお好みで加減する」は手順のまま', notTime.steps, ['調理時間はお好みで加減する'])
  eq('FU-3 「調理時間はお好みで」からは調理時間を取らない', notTime.cookMinutes, undefined)
  // ラベルだけの行＋次の行に値、の2行形式でも時間・範囲を写す
  eq(
    'FU-3 ラベルと値が2行に分かれていても写す（1時間20分）',
    parseRecipeText('テスト\n調理時間\n1時間20分\n材料\n・ねぎ…1本\n作り方\n1. 煮る').cookMinutes,
    80,
  )
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
  // 2026-08-14 便GF: ◎が付いた4件は**同じ合わせ調味料の組**にする(手順2の「◎の合わせ調味料を
  // 加えて」と対応が付くようにするため)。印は名前から外したまま、材料メモの先頭に残す
  eq('R1: 材料11件・名前+分量完全ペア・◎は組になる', r.ingredients, [
    { name: '鶏もも肉', amount: '200', unit: 'g' },
    { name: '塩こしょう', amount: '少々', unit: '' },
    { name: '片栗粉', amount: '適量', unit: '' },
    { name: 'キャベツ（ざく切り）', amount: '2', unit: '枚' },
    { name: 'にんじん（薄切り）', amount: '1/3', unit: '本' },
    { name: 'しょうゆ', amount: '1', unit: '大さじ', memo: '◎', group: 1 },
    { name: '酢', amount: '1', unit: '大さじ', memo: '◎', group: 1 },
    { name: '砂糖', amount: '1', unit: '小さじ', memo: '◎', group: 1 },
    { name: '豆板醤', amount: '適量', unit: '', memo: '◎', group: 1 },
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
  // 2026-08-14 便GF: 「A.」「B.」は組の印なので名前から外して2組に分ける
  // (手順2の「ふるいにかけたAと」と対応が付く。名前に「A.」が残っていると
  //  栄養・原価の名前照合も外れる)。英字は**同じ英字が2件以上**あるときだけ印として扱う
  eq('R6: 材料10件・タブ区切り・A./B.は2組になる', r.ingredients, [
    { name: 'おから', amount: '50', unit: 'g' },
    { name: 'コーン(缶詰)', amount: '50', unit: 'g' },
    { name: '米粉', amount: '115', unit: 'g', memo: 'A', group: 1 },
    { name: 'ベーキングパウダー', amount: '1', unit: '小さじ', memo: 'A', group: 1 },
    { name: '塩', amount: '1/4', unit: '小さじ', memo: 'A', group: 1 },
    { name: '砂糖', amount: '40', unit: 'g', memo: 'B', group: 2 },
    { name: '卵', amount: '1', unit: '個', memo: 'B', group: 2 },
    { name: '牛乳', amount: '1', unit: '大さじ', memo: 'B', group: 2 },
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

  // --- 便FS-6(2026-08-12 利用者テスト): 「電子レンジ」で検索すると0件、「レンジ」なら4件。
  // 手順に「電子レンジ(600W)」と書いてあるのに引けなかった ---
  const hits = (words, query) => words.some((w) => w.includes(toHiragana(query)))
  const renji = buildSearchWords(
    '蒸しなすの香味だれ',
    [{ name: 'なす', amount: '3', unit: '本' }],
    [],
    undefined,
    [{ text: 'なすはラップで包み、電子レンジ(600W)で5分加熱する。' }],
  )
  eq('FS-SEARCH 手順の「電子レンジ」で引ける', hits(renji, '電子レンジ'), true)
  eq('FS-SEARCH 「レンジ」でも引ける（従来の引き方を狭めない）', hits(renji, 'レンジ'), true)
  // 手順本文をまるごと入れない＝台所のどこにでもある道具や、手順の常套句では引かない
  eq('FS-SEARCH 手順の「ラップ」では引かない（手順本文は検索対象にしない）', hits(renji, 'ラップ'), false)
  eq('FS-SEARCH 手順の「加熱」では引かない', hits(renji, '加熱'), false)
  const nabe = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    undefined,
    [{ text: '鍋に油を熱し、フライパンは使わず中火で炒める。' }],
  )
  eq('FS-SEARCH 「フライパン」は器具の一覧に入れない（全体の4割に当たるため）', hits(nabe, 'ふらいぱん'), false)
  // メモは対象外（「温め直しは電子レンジで」はレンジ料理を意味しない）
  const memoOnly = buildSearchWords(
    'ポテトサラダ',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    undefined,
    [{ text: 'じゃがいもをゆでてつぶす。', memo: '温め直すときは電子レンジで' }],
  )
  eq('FS-SEARCH ひとことメモの器具では引かない', hits(memoOnly, '電子レンジ'), false)
  eq(
    'FS-SEARCH 手順を渡さない呼び出しはこれまでと同じ結果',
    buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], []).length,
    baseline.length,
  )
  eq(
    'FS-SEARCH 手順に器具が出てこなければ検索語は増えない',
    buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], [], undefined, [
      { text: '鍋で煮る。' },
    ]).length,
    baseline.length,
  )
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

  // ---- 候補数の表示(2026-08-02 便DE-5) ----
  // suggestCandidates は「suggestForSlot が最後にくじを引く候補の一覧」をそのまま返す。
  // 画面の「候補◯品」がこの関数の件数なので、①絞り込みの結果と一致すること
  // ②suggestForSlot が返す品は必ずこの一覧に入っていること(＝提案の中身を変えていないこと)を固定する
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['汁物'] }),
      mkRecipe(3, { season: 'winter' }),
    ]
    const mainPool = suggestCandidates(recipes, opts({ role: 'main' }))
    eq('候補数: 主菜の候補は季節外・副菜系を除いた1品', mainPool.length, 1)
    eq('候補数: 主菜の候補の中身', mainPool[0].id, 1)
    const sidePool = suggestCandidates(recipes, opts({ role: 'side' }))
    eq('候補数: 副菜の候補は汁物の1品', sidePool.map((r) => r.id).join(','), '2')
    eq('候補数: 季節外しか無ければ0品', suggestCandidates([mkRecipe(9, { season: 'winter' })], opts()).length, 0)
    const poolIds = suggestCandidates(recipes, opts({ role: 'main' })).map((r) => r.id)
    const picked = Array.from({ length: 20 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq(
      '候補数: suggestForSlot は必ず候補一覧の中から選ぶ',
      picked.every((id) => poolIds.includes(id)),
      true,
    )
  }

  // ---- 汁物・その他の区分(2026-08-02 便DE-4) ----
  // 汁物の行は副菜と同じ候補プール(dishType: side/soup)から選び、寄せる種別だけが違う。
  // 「その他」の行は分類の受け皿なので役割で絞らない(デザートも選べる)
  {
    const soup = mkRecipe(1, { title: 'わかめのみそ汁', dishType: 'soup' })
    const side = mkRecipe(2, { title: 'ほうれん草のおひたし', dishType: 'side' })
    const main = mkRecipe(3, { title: '豚の生姜焼き', dishType: 'main' })
    const dessert = mkRecipe(4, { title: '水ようかん', dishType: 'dessert' })
    const pool = [soup, side, main, dessert]
    eq(
      'role:soup は主菜・デザートを候補にしない',
      suggestCandidates(pool, opts({ role: 'soup' })).map((r) => r.id).sort().join(','),
      '1,2',
    )
    eq(
      'role:soup + preferDishType:soup は汁物だけに寄せる',
      suggestCandidates(pool, opts({ role: 'soup', preferDishType: 'soup' })).map((r) => r.id).join(','),
      '1',
    )
    eq(
      'role:other は役割で絞らない(デザートも候補になる)',
      suggestCandidates(pool, opts({ role: 'other' })).length,
      4,
    )
  }

  // ---- role指定・ジャンル優先・ペア提案(2026-07-13献立の主菜+副菜構成) ----

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
  // 高たんぱく優先の削除(2026-08-09 便EO・オーナー指示)の再発防止。
  // 「高たんぱく」タグはレシピ側に残しているが、提案の絞り込みには一切効かせない。
  // 候補の一覧(suggestCandidates)にタグ有り・タグ無しの両方が残ることで確かめる
  // (優先が復活すると、タグ無しの品が候補から落ちて1品だけになる)
  {
    const recipes = [mkRecipe(1, { tags: [] }), mkRecipe(2, { tags: ['高たんぱく'] })]
    eq(
      '高たんぱく: タグの有無で提案の候補を絞り込まない(削除済み)',
      suggestCandidates(recipes, opts()).map((r) => r.id).sort().join(','),
      '1,2',
    )
    eq(
      '高たんぱく: 廃止した preferHighProtein を渡しても候補は変わらない',
      suggestCandidates(recipes, opts({ preferHighProtein: true })).map((r) => r.id).sort().join(','),
      '1,2',
    )
  }

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

  // ---- IY: 料理のジャンルを複数選べるようにする(2026-08-22 便IY) ----
  // オーナー原文「週献立は、「料理のジャンル」は複数選択のほうがいいかも。１つしか選べないと、
  // １週間中華だけ、という献立しか組めない。全てを選ぶと、中華は入れたくないけど和洋食は
  // 混在させたい、ができない。」
  // 測るのは「利用者が確かめたいこと」＝選んだジャンルの中から出るか・1つだけ選んだときは
  // これまでと同じか・0件で終わらないか・1食の中は主菜に寄るか。
  {
    const genreRecipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食'] }),
      mkRecipe(3, { tags: ['中華'] }),
      mkRecipe(4, { tags: [] }), // ジャンルタグの無い品(どのジャンルにも合う万能枠)
    ]
    const idsOf = (list) => list.map((r) => r.id).sort((a, b) => a - b).join(',')
    eq(
      'IY-1 ジャンルを2つ選ぶと、その2つのジャンルの品だけが候補になる',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['和食', '洋食'] }))),
      '1,2',
    )
    eq(
      'IY-2 ジャンルを1つだけ選んだときは、これまでの単一指定(genre)と同じ候補になる',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['中華'] }))),
      idsOf(suggestCandidates(genreRecipes, opts({ genre: '中華' }))),
    )
    eq(
      'IY-3 ジャンルを全部選んだ状態は「指定なし」と同じ(ジャンルタグの無い品も候補に残る)',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['和食', '洋食', '中華'] }))),
      idsOf(suggestCandidates(genreRecipes, opts())),
    )
    eq(
      'IY-4 選んだジャンルの品が1つも無ければ絞り込みを解く(0件で終わらせない)',
      suggestCandidates([mkRecipe(1, { tags: ['洋食'] })], opts({ genres: ['和食', '中華'] })).length,
      1,
    )
    eq(
      'IY-5 選んだジャンルが1つも読み取れない値でも候補は消えない(0件で終わらせない)',
      suggestCandidates(genreRecipes, opts({ genres: [] })).length,
      genreRecipes.length,
    )
  }
  // 1食の中は主菜のジャンルに寄せる(司令部の裁定③: 週の中の混在は止めないが、
  // 主菜と副菜は揃うほうを先に試す。揃わなければ混ざり、「主菜と別ジャンル」の印が知らせる)
  {
    const pairRecipes = [
      mkRecipe(1, { tags: ['和食'] }), // 和食の主菜候補
      mkRecipe(2, { tags: ['和食', '汁物'] }), // 和食の副菜候補
      mkRecipe(3, { tags: ['洋食', 'サラダ'] }), // 洋食の副菜候補
      mkRecipe(4, { tags: ['中華'] }), // 選んでいないジャンルの主菜候補(出てはいけない)
    ]
    // 主菜の候補そのものを見る(抽選の運に左右されない形で「絞り込みが効いたか」を測る)
    eq(
      'IY-6 複数選択でも、主菜の候補は選んだジャンルだけになる(選ばなかった中華は出ない)',
      suggestCandidates(pairRecipes, opts({ genres: ['和食', '洋食'], role: 'main' }))
        .map((r) => r.id)
        .sort((a, b) => a - b)
        .join(','),
      '1',
    )
    const results = Array.from({ length: 10 }, () =>
      suggestPairForSlot(pairRecipes, opts({ genres: ['和食', '洋食'] })),
    )
    eq('IY-6 複数選択でも、主菜は選んだジャンルから出る', results.every((r) => r.main?.id === 1), true)
    eq(
      'IY-6 複数選択でも、1食の中の副菜は主菜と同じジャンルが優先される',
      results.every((r) => r.side?.id === 2),
      true,
    )
  }
  // 主菜のジャンルの副菜が無ければ、選んだ別ジャンルの副菜で埋める(混ぜてでも埋める＝
  // 「主菜と別ジャンル」の印が出る側に倒す。detectGenreMix はこれまでどおり)
  {
    const mixRecipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食', 'サラダ'] }),
    ]
    const pair = suggestPairForSlot(mixRecipes, opts({ genres: ['和食', '洋食'] }))
    eq('IY-7 主菜と同じジャンルの副菜が無ければ、選んだ別ジャンルの副菜で埋める', pair.side?.id, 2)
    eq(
      'IY-7 その枠は「主菜と別ジャンル」と判定される(印はこれまでどおり出る)',
      detectGenreMix(pair.main, pair.side ? [pair.side] : []),
      true,
    )
  }
  // ジャンルの選び方そのもの(画面が使う純関数)。「最後の1つは外せない」はここで守る
  eq('IY-8 ジャンルの並びは押した順ではなく、選べる並び(和食→洋食→中華)にそろう',
    sortMealGenres(['中華', '和食']).join(','), '和食,中華')
  eq('IY-8 同じジャンルが重なっても1つに数える',
    sortMealGenres(['洋食', '洋食']).join(','), '洋食')
  eq('IY-9 選んでいないジャンルを押すと足される',
    toggleMealGenre(['和食'], '中華').join(','), '和食,中華')
  eq('IY-9 選んでいるジャンルを押すと外れる',
    toggleMealGenre([...MEAL_GENRES], '中華').join(','), '和食,洋食')
  eq('IY-9 最後の1つを押しても外れない(1つも選んでいない状態を作らせない)',
    toggleMealGenre(['和食'], '和食').join(','), '和食')
  eq('IY-9 足したあとも並びは選べる並びのまま(押した順に散らからない)',
    toggleMealGenre(['中華'], '和食').join(','), '和食,中華')
  // 保存された設定の読み替え(2026-08-22 便IY・司令部裁定B案)。
  // レシピ一覧のタグ絞り込み(便HZ・③ pages/RecipesPage.tsx)と同じ作法で、
  // **1つだけ選んでいた古い値も1件として読む**。壊れた値で候補を消さないことも見る
  eq('IY-10 保存が無い(これまでの利用者)ときは3つとも選んだ状態＝指定なし',
    normalizePlanGenres(undefined).join(','), MEAL_GENRES.join(','))
  eq('IY-10 1つだけ選んで保存されていた値は、その1つを選んだ状態として読む',
    normalizePlanGenres(['中華']).join(','), '中華')
  eq('IY-10 1つだけの値が配列でなく素の文字で保存されていても、1件として読む',
    normalizePlanGenres('洋食').join(','), '洋食')
  eq('IY-10 知らないジャンル名しか入っていなければ3つとも選んだ状態に倒す(候補を消さない)',
    normalizePlanGenres(['ロシア料理']).join(','), MEAL_GENRES.join(','))
  eq('IY-10 空の配列でも候補を消さない',
    normalizePlanGenres([]).join(','), MEAL_GENRES.join(','))
  eq('IY-10 数値など読み取れない値でも候補を消さない',
    normalizePlanGenres(0).join(','), MEAL_GENRES.join(','))
  eq('IY-10 知っているジャンルと知らない名前が混ざっていたら、知っているほうだけを読む',
    normalizePlanGenres(['ロシア料理', '和食']).join(','), '和食')
  eq('IY-10 保存の並びが崩れていても、選べる並びにそろえて読む',
    normalizePlanGenres(['中華', '和食']).join(','), '和食,中華')

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

  // isMainDish / recipeGenre: 外部公開の主菜判定・ジャンル取得(「今日なに作る?」等が使う)
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

// ---------- preferSeasonWithFallback(提案の候補が季節で痩せる問題・2026-07-29 便CD/MP-12) ----------
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
    eq('planWeekFill(空の週): 削除対象なし', plan.entryIdsToRemove, [])
    eq('planWeekFill(空の週): used除外なし', plan.usedRecipeIds, [])
  }

  // (2) 全枠が自動提案由来: 2回目のタップでも全枠を埋め直す(再抽選)＝手動保護は邪魔しない
  //     (MEALPLAN-04 2回目相当: 自動枠は削除→再作成される)
  {
    const entries = week.map((date, i) => mkEntry(i + 1, date, 10 + i, { auto: true }))
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(全自動枠): 全7枠が埋め直し対象', plan.slotsToFill.length, 7)
    eq('planWeekFill(全自動枠): 自動行は全件削除対象', sortedNums(plan.entryIdsToRemove), [1, 2, 3, 4, 5, 6, 7])
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
    eq('planWeekFill(手動保護): 手動行(id=1)は削除されず、火の自動行(id=2)だけ削除', plan.entryIdsToRemove, [2])
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
    eq('planWeekFill(役割粒度): 自動主菜(id=2)は削除して主菜だけ埋め直す', plan.entryIdsToRemove.includes(2), true)
    eq('planWeekFill(役割粒度): 手動副菜(id=1)は削除されない', plan.entryIdsToRemove.includes(1), false)
    eq(
      'planWeekFill(役割粒度): 月曜は主菜だけ埋める(partialFills=main)',
      plan.partialFills.find((p) => p.date === '2026-07-20')?.fillRole,
      'main',
    )
    eq('planWeekFill(役割粒度): 手動副菜のレシピ(21)は重複回避のusedに入る', plan.usedRecipeIds.includes(21), true)
  }

  // (3c) 便DE-4(汁物・その他の区分): 自動提案が触るのは主菜・副菜だけ。
  //      汁物・その他の行は「消さない・埋め対象にしない・重複回避のusedには数える」。
  //      汁物だけが入っている枠は「まだ決まっていない」扱い＝主菜+副菜のペアで埋める
  {
    const entries = [
      mkEntry(1, '2026-07-20', 31, { role: 'soup' }), // 月・汁物(手で足した行)
      mkEntry(2, '2026-07-21', 32, { role: 'other', auto: true }), // 火・その他(autoが付いていても消さない)
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(便DE-4): 汁物・その他は削除対象にしない', plan.entryIdsToRemove, [])
    eq(
      'planWeekFill(便DE-4): 汁物だけの枠も主菜+副菜のペアで埋める',
      keysOf(plan.slotsToFill).includes('2026-07-20|dinner'),
      true,
    )
    eq('planWeekFill(便DE-4): 汁物・その他のレシピは重複回避のusedに入る', sortedNums(plan.usedRecipeIds), [31, 32])
    eq('planWeekFill(便DE-4): 汁物・その他だけの枠は「残す枠」に数えない', plan.preservedSlotKeys.size, 0)
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
    eq('planWeekFill(複合): 削除は木の自動(id=3)のみ。金の自動(id=4)は枠ごと残すので消さない', plan.entryIdsToRemove, [3])
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
      plan.entryIdsToRemove,
      [3],
    )
    eq(
      'planWeekFill(月レンジ): 過去日と残す枠のレシピは重複回避のusedに入る',
      sortedNums(plan.usedRecipeIds),
      [100, 200],
    )
  }

  // (6) 便CH/C1(2026-07-30): 月の「献立をまとめて提案」は keepAuto=true で呼ぶ。
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
    eq('planWeekFill(便CH/C1): 削除する行は0件（自動配置分も消さない）', again.entryIdsToRemove, [])
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
      [weekDefault.preservedSlotKeys.size, sortedNums(weekDefault.entryIdsToRemove)],
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
      withNoteEntry.entryIdsToRemove,
      [],
    )
    eq(
      'planWeekFill(便CH/C10): メモの日のレシピは重複回避のusedに入る',
      withNoteEntry.usedRecipeIds,
      [777],
    )
  }

  // (8) 便DT-8(2026-08-07 オーナー指示): 週タブ「まとめて献立を入力」の入れかたスイッチ。
  //  fillEmpty  … keepAuto=true と同じ＝1品も消さない(完全に非破壊)
  //  replaceAll … 対象範囲の献立を手動配置も含めて全部消してから入れ直す
  // 総入れ替えでも「過去日・表示していない食事」には触らない＝対象範囲の定義は変えない、が要。
  {
    const entries = [
      mkEntry(1, '2026-07-19', 900), // 過去日(対象外)
      mkEntry(2, '2026-07-20', 100), // 手動(今日)
      mkEntry(3, '2026-07-21', 200, { auto: true }), // 自動
      mkEntry(4, '2026-07-21', 201, { auto: true, role: 'side' }),
      mkEntry(5, '2026-07-22', 300, { role: 'soup' }), // 汁物(自動提案は入れない役割)
      mkEntry(6, '2026-07-23', 400, { slot: 'breakfast' }), // 非表示帯(対象外)
    ]
    // 「まだ決まっていない枠だけ埋める」= keepAuto:true。1品も消さない
    const fillEmpty = planWeekFill(entries, week, ['dinner'], '2026-07-20', { keepAuto: true })
    eq('planWeekFill(便DT-8/空き枠だけ): 削除する行は0件(完全に非破壊)', fillEmpty.entryIdsToRemove, [])
    eq(
      'planWeekFill(便DT-8/空き枠だけ): すでに入っている3日は残す枠に数える',
      sortedStrs(fillEmpty.preservedSlotKeys),
      ['2026-07-20|dinner', '2026-07-21|dinner'],
    )
    eq(
      'planWeekFill(便DT-8/空き枠だけ): 空いている日だけ埋める(7日-すでに入っている2日=5日)',
      fillEmpty.slotsToFill.length,
      5,
    )

    // 「レシピを総入れ替え」= replaceAll:true。対象範囲の行は手動も自動も汁物も消す
    const replaceAll = planWeekFill(entries, week, ['dinner'], '2026-07-20', { replaceAll: true })
    eq(
      'planWeekFill(便DT-8/総入れ替え): 対象範囲の行は手動(2)・自動(3,4)・汁物(5)とも削除対象',
      sortedNums(replaceAll.entryIdsToRemove),
      [2, 3, 4, 5],
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 過去日(id=1)と非表示帯(id=6)は消さない',
      replaceAll.entryIdsToRemove.includes(1) || replaceAll.entryIdsToRemove.includes(6),
      false,
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 残す枠は0＝7日ぜんぶをペアで入れ直す',
      [replaceAll.preservedSlotKeys.size, replaceAll.slotsToFill.length, replaceAll.partialFills.length],
      [0, 7, 0],
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 消す行のレシピは重複回避のusedに入れない(引き直せる)',
      sortedNums(replaceAll.usedRecipeIds),
      [400, 900], // 対象外の過去日・非表示帯だけ
    )
    // keepAuto と同時に指定されても、総入れ替えを優先する（矛盾した指定で「何も起きない」を作らない）
    const bothFlags = planWeekFill(entries, week, ['dinner'], '2026-07-20', {
      keepAuto: true,
      replaceAll: true,
    })
    eq(
      'planWeekFill(便DT-8): keepAutoと同時指定なら総入れ替えを優先する',
      sortedNums(bothFlags.entryIdsToRemove),
      [2, 3, 4, 5],
    )
  }
}

// ---------- navMemory(画面をまたぐ短期の記憶・2026-08-07 便DT-2) ----------
// 週タブからレシピ詳細を開いて戻ってきたとき、同じ週・同じスクロール位置に復元するための覚え書き。
// 壊れた値を読んだときに「変な場所へ飛ぶ」ことがないよう、受け付ける形をここで固定する。
{
  eq('DT2-NAV 覚えるキーは固定(別便が別名で書かない)', [WEEK_RETURN_KEY, LAST_RECIPES_PATH_KEY], [
    'mealPlan:weekReturn',
    'tabbar:lastRecipesPath',
  ])
  eq('DT2-NAV 復元の印は restore', WEEK_RETURN_PARAM, 'restore')
  eq(
    'DT2-NAV 覚えた形をそのまま読み戻せる',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 1234 })),
    { weekStart: '2026-08-03', scrollY: 1234 },
  )
  eq(
    'DT2-NAV スクロール位置は整数に丸めて覚える(小数のpxを持ち回らない)',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 12.7 })).scrollY,
    13,
  )
  eq(
    'DT2-NAV 負のスクロール位置は0に丸める',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: -50 })).scrollY,
    0,
  )
  eq('DT2-NAV 覚えが無ければnull(復元しない)', parseWeekReturn(null), null)
  eq('DT2-NAV 空文字はnull', parseWeekReturn(''), null)
  eq('DT2-NAV JSONでなければnull', parseWeekReturn('{壊れた'), null)
  eq('DT2-NAV 物体でなければnull', parseWeekReturn('123'), null)
  eq('DT2-NAV 日付の形が違えばnull', parseWeekReturn('{"weekStart":"2026/08/03","scrollY":0}'), null)
  eq('DT2-NAV 日付が無ければnull', parseWeekReturn('{"scrollY":10}'), null)
  eq('DT2-NAV スクロール位置が数値でなければnull', parseWeekReturn('{"weekStart":"2026-08-03","scrollY":"10"}'), null)
  eq('DT2-NAV NaNはnull', parseWeekReturn('{"weekStart":"2026-08-03","scrollY":null}'), null)
  // 2026-08-19 便ID・⑦: 人が開け閉めした曜日カードも一緒に覚える。
  // 覚えずに戻ると、開いていた日がまた畳まれてページの高さが変わり、
  // 覚えた縦位置に戻しても違う場所へ着く（e2e WEEKUI-DT で実測130pxずれた）
  eq(
    'ID-7 開け閉めした曜日カードも覚えて読み戻せる',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-03',
        scrollY: 100,
        dayFold: { '2026-08-03': false, '2026-08-04': true },
      }),
    ),
    { weekStart: '2026-08-03', scrollY: 100, dayFold: { '2026-08-03': false, '2026-08-04': true } },
  )
  eq(
    'ID-7 1つも触っていなければ書かない(以前の版と同じ形のまま)',
    serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 100, dayFold: {} }),
    '{"weekStart":"2026-08-03","scrollY":100}',
  )
  eq(
    'ID-7 覚えが古い版で曜日カードの分が無くても、週と縦位置は読み戻せる',
    parseWeekReturn('{"weekStart":"2026-08-03","scrollY":100}'),
    { weekStart: '2026-08-03', scrollY: 100 },
  )
  eq(
    'ID-7 壊れた1件だけを捨てて残りを活かす(日付の形でない鍵・真偽でない値)',
    parseWeekReturn(
      '{"weekStart":"2026-08-03","scrollY":100,"dayFold":{"2026/08/03":true,"2026-08-04":"はい","2026-08-05":true}}',
    ).dayFold,
    { '2026-08-05': true },
  )
  eq(
    'ID-7 曜日カードの分が丸ごと壊れていても、週と縦位置は読み戻せる',
    parseWeekReturn('{"weekStart":"2026-08-03","scrollY":100,"dayFold":"こわれた"}'),
    { weekStart: '2026-08-03', scrollY: 100 },
  )
}

// ---------- navMemory: 見ていた場所の目印(2026-08-14 便GH・再発防止) ----------
// 直したバグ: 週タブ→レシピ詳細→「戻る」で、離れる前と別の場所に着地する(実測695pxのずれ)。
// 覚えていたのがページ先頭からの距離(scrollY)だけで、離れている間にページの高さが変わると
// 同じ距離が別の場所を指すため(「栄養の概算を詳しく見る」で開いた明細は、離れると閉じる)。
{
  // 画面(高さ844)に4枚のカードが並び、上の2枚は上端が画面より上にある状態
  const cards = [
    { date: '2026-08-10', top: -500 },
    { date: '2026-08-11', top: -100 },
    { date: '2026-08-12', top: 300 },
    { date: '2026-08-13', top: 700 },
  ]
  eq('GH-ANCHOR 上端が画面の中から始まるカードのうち、いちばん上を目印にする', pickReturnAnchor(cards), {
    date: '2026-08-12',
    top: 300,
  })
  // 上端が画面より上のカードを目印にしてはいけない: そのカードの中で縮む部分（栄養の明細）も
  // 画面より上にあり、明細が閉じてもカードの上端は動かない＝ずれを打ち消せない（実測 -644px）
  eq(
    'GH-ANCHOR 上端が画面より上のカードは目印にしない(その中の縮む部分も画面の上なので直らない)',
    pickReturnAnchor([
      { date: '2026-08-14', top: -1055 },
      { date: '2026-08-15', top: 70 },
    ]).date,
    '2026-08-15',
  )
  eq(
    'GH-ANCHOR 上に貼り付く帯の下から数える(帯に隠れて上端が見えないカードは目印にしない)',
    pickReturnAnchor(cards, 320),
    { date: '2026-08-13', top: 700 },
  )
  eq(
    'GH-ANCHOR 画面いっぱいに1枚が広がっているときは、画面の下にある次のカードを目印にする',
    pickReturnAnchor([
      { date: '2026-08-14', top: -300 },
      { date: '2026-08-15', top: 1200 },
    ]),
    { date: '2026-08-15', top: 1200 },
  )
  eq(
    'GH-ANCHOR 最後のカードの中まで送っていれば目印なし(従来どおり縦位置だけで戻す)',
    pickReturnAnchor([{ date: '2026-08-10', top: -900 }]),
    null,
  )
  eq('GH-ANCHOR カードが1枚も無ければ目印なし', pickReturnAnchor([]), null)
  eq('GH-ANCHOR 上端は整数に丸める', pickReturnAnchor([{ date: '2026-08-10', top: 12.4 }]).top, 12)
  // 復元の計算: 目印のカードを離れたときと同じ高さに戻す
  eq(
    'GH-ANCHOR 上の中身が695px縮んでいても、目印のカードは同じ高さに戻る',
    // 離れたとき: 縦位置2511でカードの上端は70px。戻ったとき、明細が閉じて上が695px縮み、
    // 同じ縦位置2511ではカードの上端が-625pxまで上がっている
    scrollTargetForAnchor(2511, -625, { date: '2026-08-15', top: 70 }),
    2511 - 695,
  )
  eq(
    'GH-ANCHOR 高さが変わっていなければ、離れたときと同じ縦位置になる',
    scrollTargetForAnchor(1493, 70, { date: '2026-08-11', top: 70 }),
    1493,
  )
  eq(
    'GH-ANCHOR 上が伸びていれば、そのぶん下へ送る',
    scrollTargetForAnchor(1000, 260, { date: '2026-08-11', top: 60 }),
    1200,
  )
  eq(
    'GH-ANCHOR 先頭より手前へは戻さない(負の縦位置を作らない)',
    scrollTargetForAnchor(100, 0, { date: '2026-08-11', top: 500 }),
    0,
  )
  // 覚え書きの形: 目印は任意。付いていない古い覚え書きも、壊れた目印も、週の復元は止めない
  eq(
    'GH-ANCHOR 目印つきの覚え書きをそのまま読み戻せる',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-10',
        scrollY: 2511,
        anchor: { date: '2026-08-15', top: 70.4 },
      }),
    ),
    { weekStart: '2026-08-10', scrollY: 2511, anchor: { date: '2026-08-15', top: 70 } },
  )
  eq(
    'GH-ANCHOR 目印が無い覚え書きは以前と同じ形のまま(古い覚え書きも読める)',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印だけ壊れていたら目印を捨てて週の復元は続ける',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511,"anchor":{"date":"きのう","top":70}}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印の上端が数値でなければ目印を捨てる',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511,"anchor":{"date":"2026-08-15","top":"70"}}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印の上端は0未満に丸めない(画面の外を指す値も位置として意味がある)',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-10',
        scrollY: 2511,
        anchor: { date: '2026-08-15', top: -120 },
      }),
    ).anchor,
    { date: '2026-08-15', top: -120 },
  )
}

// ---------- navMemory: 献立の月タブ/日タブの居場所(2026-08-09 便EQ) ----------
// 「作った記録の一覧」へ行って戻ったとき、離れる直前の場所（月タブなら見ていた月も）へ帰す。
// 週タブと同じく、壊れた値を読んだときは「復元しない」に倒す＝変な場所へ飛ばさない。
{
  // 2026-08-17 便HG: ホーム画面の廃止で 'home:return' は使う画面が無くなったので外した
  eq('EQ-NAV 覚えるキーは固定(別便が別名で書かない)', [MONTH_RETURN_KEY, DAY_RETURN_KEY], [
    'mealPlan:monthReturn',
    'mealPlan:dayReturn',
  ])
  eq(
    'EQ-NAV 覚えた形をそのまま読み戻せる(月タブは見ていた月も一緒に覚える)',
    parseViewReturn(serializeViewReturn({ anchor: '2026-06-01', scrollY: 820 })),
    { anchor: '2026-06-01', scrollY: 820 },
  )
  eq(
    'EQ-NAV 目印が要らない画面(献立の日タブ)は空文字で覚える',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: 40 })),
    { anchor: '', scrollY: 40 },
  )
  eq(
    'EQ-NAV スクロール位置は整数に丸めて覚える',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: 12.7 })).scrollY,
    13,
  )
  eq(
    'EQ-NAV 負のスクロール位置は0に丸める',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: -50 })).scrollY,
    0,
  )
  eq('EQ-NAV 覚えが無ければnull(復元しない)', parseViewReturn(null), null)
  eq('EQ-NAV 空文字はnull', parseViewReturn(''), null)
  eq('EQ-NAV JSONでなければnull', parseViewReturn('{壊れた'), null)
  eq('EQ-NAV 物体でなければnull', parseViewReturn('123'), null)
  eq('EQ-NAV 目印が文字列でなければnull', parseViewReturn('{"anchor":3,"scrollY":10}'), null)
  eq('EQ-NAV 目印が無ければnull', parseViewReturn('{"scrollY":10}'), null)
  eq('EQ-NAV スクロール位置が数値でなければnull', parseViewReturn('{"anchor":"","scrollY":"10"}'), null)
  eq('EQ-NAV NaNはnull', parseViewReturn('{"anchor":"","scrollY":null}'), null)
}

// ---------- navMemory: 「今日なに作る？」の候補を覚える(2026-08-17 便HI・再発防止) ----------
// オーナー実機「今日なに作るのレシピ詳細から戻ってきた時だけは、ランダムでレシピが変わらないように」。
// 候補はくじなので、画面を離れて戻ると引き直されてさっき見に行った料理が消えていた。
// ここで固定するのは「覚える形」と「読めないときは覚えていない扱いにする」の2点
// （読めない値でおかしな料理を出すより、ふつうにくじを引くほうが正しい）。
{
  eq('HI-PIN 覚えるキーは固定(別便が別名で書かない)', [MEAL_PLAN_TAB_TAP_KEY, DAY_SUGGEST_PIN_KEY], [
    'mealPlan:tabTap',
    'mealPlan:daySuggest',
  ])
  eq('HI-PIN 覚えた候補をそのまま読み戻せる', parseSuggestionPin(serializeSuggestionPin(42)), 42)
  eq('HI-PIN 覚えが無ければnull(ふつうにくじを引く)', parseSuggestionPin(null), null)
  eq('HI-PIN 空文字はnull', parseSuggestionPin(''), null)
  eq('HI-PIN JSONでなければnull', parseSuggestionPin('{壊れた'), null)
  eq('HI-PIN 物体でなければnull', parseSuggestionPin('42'), null)
  eq('HI-PIN IDが数値でなければnull', parseSuggestionPin('{"recipeId":"42"}'), null)
  eq('HI-PIN IDが整数でなければnull', parseSuggestionPin('{"recipeId":4.2}'), null)
  eq('HI-PIN IDが0以下ならnull', parseSuggestionPin('{"recipeId":0}'), null)
  eq('HI-PIN IDが無ければnull', parseSuggestionPin('{}'), null)
}

// ---------- navMemory: 「今日なに作る？」の**献立**側も覚える(2026-08-19 便HT・②の再発防止) ----------
// オーナー原文「提案された献立→レシピ詳細→戻る、の流れで、献立『今日なに作る？』の提案が
// 変更されないようにして。」
// 直すバグ: 1品側だけが「戻ってきた1回だけ引き直さない」を持っていて、献立側は画面を離れると
// 組んだ主菜・副菜が消え、戻った瞬間に別の組み合わせが出ていた。
// 新しい仕組みは作らず、1品側とまったく同じ覚え(同じキー・同じ1回きり)の中に項目を足す
// ＝覚える場所が2つに割れない。読めない値は「覚えていない」＝ふつうに引き直す。
{
  eq(
    'HT-PIN 献立の組も一緒に覚えて読み戻せる',
    parseSuggestionPlanPin(serializeSuggestionPin(42, [7, 9])),
    [7, 9],
  )
  eq(
    'HT-PIN 献立の組を足しても1品側の覚えは同じ形のまま読める',
    parseSuggestionPin(serializeSuggestionPin(42, [7, 9])),
    42,
  )
  eq('HT-PIN 献立の組が無ければ空(ふつうに組み直す)', parseSuggestionPlanPin(serializeSuggestionPin(42)), [])
  eq('HT-PIN 覚えが無ければ空', parseSuggestionPlanPin(null), [])
  eq('HT-PIN 空文字は空', parseSuggestionPlanPin(''), [])
  eq('HT-PIN JSONでなければ空', parseSuggestionPlanPin('{壊れた'), [])
  eq('HT-PIN 物体でなければ空', parseSuggestionPlanPin('42'), [])
  eq('HT-PIN 並びでなければ空', parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":7}'), [])
  eq(
    'HT-PIN IDに使えない値が混じっていれば空(中途半端に組を出さない)',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,"9"]}'),
    [],
  )
  eq(
    'HT-PIN IDが整数でなければ空',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,9.5]}'),
    [],
  )
  eq(
    'HT-PIN IDが0以下なら空',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,0]}'),
    [],
  )
}

// ---------- navMemory: レシピ詳細以外へ離れるときも組を控える(2026-08-21 便IP・①の再発防止) --
// 便IIの実測「『今日なに作る？』が戻るたびに別の献立を組み直す。主菜が一品もの（カレー・丼・麺・鍋）
// だと副菜のカードが付かず、節の高さが156〜170px→74px、ページの下端が82px上がる」。
// オーナーの指摘（便HT）はレシピ詳細からの戻りだけが直っていて、**作った記録の一覧からの戻り**は
// 組み直したままだった。
//
// 直しの要は「覚える形」のほうにある: 記録の一覧へ移るときは**開いた1品が無い**ので、
// これまでの覚え方（recipeId 必須）では献立の組だけを控えることができなかった。
// ここで固定するのは次の3つ。
//   ①1品が無くても献立の組を控えられる（recipeId を入れずに書ける）
//   ②その控えを読み戻すと、1品側は「覚えていない」＝ふつうにくじを引く（null）
//   ③どちらも無いときの形（1品も献立も出していない一瞬）でも、読み出しが壊れない
{
  eq(
    'IP-PIN 1品が無くても献立の組を控えられる',
    parseSuggestionPlanPin(serializeSuggestionPin(null, [7, 9])),
    [7, 9],
  )
  eq(
    'IP-PIN 1品を控えていなければ1品側は「覚えていない」（ふつうにくじを引く）',
    parseSuggestionPin(serializeSuggestionPin(null, [7, 9])),
    null,
  )
  eq('IP-PIN どちらも無いときも読み出しが壊れない', parseSuggestionPin(serializeSuggestionPin(null)), null)
  eq('IP-PIN どちらも無いときの組は空', parseSuggestionPlanPin(serializeSuggestionPin(null)), [])
  eq(
    'IP-PIN 1品と組の両方を控えたときは、これまでどおり両方読める',
    [
      parseSuggestionPin(serializeSuggestionPin(3, [7, 9])),
      parseSuggestionPlanPin(serializeSuggestionPin(3, [7, 9])),
    ],
    [3, [7, 9]],
  )
}

// ---------- 提案の条件「調理時間◯分以内を優先」の分数(2026-08-19 便HT・⑤の再発防止) ----------
// オーナー原文「調理時間15分いないを優先は、時間だけプルダウンで変更できるようにしたい。」
// ここで測るのは**選んだ分数が提案の中身に効いているか**であって、画面がプルダウンかどうかではない。
// 分数を渡さない呼び出し(月タブ・買い物メモなど、この条件を持たない場所)は
// これまでどおり15分のまま＝既存の呼び出しの結果を変えない。
{
  const mkQuick = (id, cookMinutes) => ({
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
    cookMinutes,
  })
  const quickOpts = (over = {}) => ({
    quickOnly: true,
    excludeNg: false,
    ngIngredients: [],
    usedRecipeIds: [],
    slot: 'dinner',
    season: 'summer',
    ...over,
  })
  // 10分・15分・20分・30分・40分の5品。境界(ちょうど選んだ分数)は含む
  const quickPool = [mkQuick(10, 10), mkQuick(15, 15), mkQuick(20, 20), mkQuick(30, 30), mkQuick(40, 40)]
  const quickIds = (options) =>
    suggestCandidates(quickPool, options)
      .map((r) => r.id)
      .sort((a, b) => a - b)
  eq('HT-QUICK 分数を渡さなければ従来どおり15分以内', quickIds(quickOpts()), [10, 15])
  eq('HT-QUICK 10分を選ぶと10分以内だけが候補', quickIds(quickOpts({ quickMinutes: 10 })), [10])
  eq('HT-QUICK 20分を選ぶと20分の品まで候補に入る', quickIds(quickOpts({ quickMinutes: 20 })), [10, 15, 20])
  eq(
    'HT-QUICK 30分を選ぶと30分の品まで候補に入る(40分は入らない)',
    quickIds(quickOpts({ quickMinutes: 30 })),
    [10, 15, 20, 30],
  )
  eq(
    'HT-QUICK 優先を切っていれば分数は効かない(全部が候補)',
    quickIds(quickOpts({ quickOnly: false, quickMinutes: 10 })),
    [10, 15, 20, 30, 40],
  )
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
  // 便DE-4(汁物・その他): 主菜以外はどれも「追加」＝既存の行を1件も消さない
  eq(
    '便DE-4: 汁物の料理は既存の主菜・副菜を消さず追加する',
    planRoleAssign([main1, side1], 30, 'soup'),
    { kind: 'add' },
  )
  eq(
    '便DE-4: その他の料理も既存を消さず追加する',
    planRoleAssign([main1, side1], 30, 'other'),
    { kind: 'add' },
  )
}

// ---------- マイ献立テンプレ(A-1)＋曜日固定の定番(B-2)・2026-07-29 便CB-2・docs/59 ----------
// テンプレは日付ではなく曜日で持つ。全曜日を選べばA-1(1週間まるごと)・1曜日だけ選べばB-2
// (毎週◯曜はカレー)になる、という統合設計をここで固定する。入るのは空いているところだけ(非破壊)
{
  const {
    buildTemplateItems,
    planTemplateFill,
    templateDowCounts,
    groupTemplateItems,
    removeTemplateItemAt,
    replaceTemplateItemRecipe,
  } = await import('../src/logic/mealTemplate.ts')
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

  // ---- テンプレの中身を見る・直す(2026-08-02 便DE-9) ----
  // 画面は「曜日→食事→役割」の順に出し、直す対象は元の配列の位置(index)で指す。
  // 位置がずれると別の品を消す/差し替える事故になるので、並べ替えても位置が保たれることを固定する
  {
    const mixed = [
      { dow: 4, slot: 'dinner', role: 'side', recipeId: 41 }, // 金・副菜(あとで足した想定)
      { dow: 0, slot: 'dinner', role: 'side', recipeId: 20 },
      { dow: 0, slot: 'breakfast', role: 'main', recipeId: 11 },
      { dow: 0, slot: 'dinner', role: 'main', recipeId: 10 },
    ]
    const groups = groupTemplateItems(mixed)
    eq('テンプレの中身: 曜日の並びは月→金', groups.map((g) => g.dow), [0, 4])
    eq(
      'テンプレの中身: 同じ曜日は朝食→夕食の順',
      groups[0].slots.map((s) => s.slot),
      ['breakfast', 'dinner'],
    )
    eq(
      'テンプレの中身: 同じ食事は主菜→副菜の順',
      groups[0].slots[1].items.map((v) => v.item.role),
      ['main', 'side'],
    )
    eq(
      'テンプレの中身: 並べ替えても元の位置(index)を保つ',
      groups[0].slots[1].items.map((v) => v.index),
      [3, 1],
    )
    // 取り外し・差し替えは元の配列を変えず、指定した位置だけを直す
    const removed = removeTemplateItemAt(mixed, 3)
    eq('テンプレの中身: 指定した1品だけ外す', removed.map((i) => i.recipeId), [41, 20, 11])
    eq('テンプレの中身: 元の中身は変えない(非破壊)', mixed.length, 4)
    eq('テンプレの中身: 範囲外の位置は何も変えない', removeTemplateItemAt(mixed, 9).length, 4)
    const replaced = replaceTemplateItemRecipe(mixed, 1, 99)
    eq('テンプレの中身: 指定した1品のレシピだけ差し替える', replaced[1].recipeId, 99)
    eq(
      'テンプレの中身: 差し替えても曜日・食事・役割は変えない',
      [replaced[1].dow, replaced[1].slot, replaced[1].role],
      [0, 'dinner', 'side'],
    )
    eq('テンプレの中身: 差し替えでほかの品は変わらない', replaced[0].recipeId, 41)
  }

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
// 2026-08-22 便IX: 水・お湯・湯は「デフォルト未チェックで並べる」から「そもそも出さない」に
// 変わった(オーナーのテスト用データ31品で、買い物メモに「お湯」が並ぶことが分かったため)。
// 残りの3件(だし汁・鶏むね肉・しょうゆ)のチェックの向きは従来のまま
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
  eq('買い物候補: 水は買い物メモに出さない(便IXで未チェック→非表示)', byName.has('水'), false)
  eq('買い物候補: お湯も出さない', byName.has('お湯'), false)
  eq('買い物候補: 湯も出さない', byName.has('湯'), false)
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
  // 2026-08-22 便IX: 「水」は買い物メモに出さなくなったので、丸めの見張りは同じml単位で
  // 店で買うもの(だし汁)に置き換えた。測っているのは10刻みの丸めで、食材名は関係しない
  eq('買い物候補(丸め): 700ml×0.25→180ml(10刻み)', amountOf([{ name: 'だし汁', amount: '700', unit: 'ml' }], 0.25), '180ml')
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

// ---------- parseServingsParam(2026-08-03 便DJ。献立の枠ごとの食数を買い物メモへ渡す) ----------
// 再発防止: 食数を渡す経路が増えても「回数」経路の分量計算を壊さないこと、
// 壊れた値(0・負・数値でない)が分量計算に流れ込まないことを固定する
{
  const toObj = (m) => Object.fromEntries([...m].map(([k, v]) => [String(k), v]))
  eq('食数: 「1:8,3:4」はレシピごとの合計食数', toObj(parseServingsParam('1:8,3:4')), {
    1: 8,
    3: 4,
  })
  eq('食数: 同じIDが並んだら足し合わせる', toObj(parseServingsParam('2:3,2:5')), { 2: 8 })
  eq('食数: 0以下は捨てる(分量が0や負にならない)', toObj(parseServingsParam('1:0,2:-3,3:2')), {
    3: 2,
  })
  eq('食数: 数値でない値・欠けた値は捨てる', toObj(parseServingsParam('1:abc,2,,3:4')), { 3: 4 })
  eq('食数: 空パラメータは0件', toObj(parseServingsParam('')), {})
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

// ---------- DY-1 買い物メモの売り場ブロック(2026-08-08 オーナー実機フィードバック①) ----------
// 「売り場順ごとに食材をブロック分けして表示して。たくさんの食材が羅列していて見づらい」。
// 見出しつきの塊に切り直すだけで、並べ替えの規則(sortShoppingByAisle)は一切変えない
{
  const items = [
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉' }, // 肉・魚介
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん' }, // 野菜・きのこ(玉ねぎより後=既存順を維持する)
    { id: 5, name: '卵', isChecked: true }, // 豆腐・卵・乳(チェック済みでも同じグループに残す)
  ]
  const groups = groupShoppingByAisle(items)
  eq(
    'DY-1 売り場ブロック: 既定順で見出しが並び、中身が0件の売り場(主食・粉/その他)は出さない',
    groups.map((g) => g.key),
    ['vegetable', 'meatFish', 'soyEgg', 'seasoning'],
  )
  eq(
    'DY-1 売り場ブロック: グループ内は元の並び(追加順)を保つ',
    groups.map((g) => g.items.map((i) => i.name)),
    [['玉ねぎ', 'にんじん'], ['豚肉'], ['卵'], ['しょうゆ']],
  )
  eq(
    'DY-1 売り場ブロック: チェック済みも元のグループに残す(買ったものが別枠へ飛ばない)',
    groups.find((g) => g.key === 'soyEgg').items.map((i) => i.isChecked),
    [true],
  )
  // 平らにすると従来の整列と完全に一致する＝並べ替えの既存挙動を壊していないことの担保
  eq(
    'DY-1 売り場ブロック: 平らにすると sortShoppingByAisle と同じ並び',
    groups.flatMap((g) => g.items).map((i) => i.name),
    sortShoppingByAisle(items).map((i) => i.name),
  )
  // 設定のカスタム売り場順にも従う(未知のキー・欠けは normalizeAisleOrder が補う)
  const custom = groupShoppingByAisle(items, ['seasoning', 'soyEgg'])
  eq(
    'DY-1 売り場ブロック: 設定のカスタム順に従い、残りは既定順で続く',
    custom.map((g) => g.key),
    ['seasoning', 'soyEgg', 'vegetable', 'meatFish'],
  )
  eq(
    'DY-1 売り場ブロック: カスタム順でも平らにすれば sortShoppingByAisle と同じ',
    custom.flatMap((g) => g.items).map((i) => i.name),
    sortShoppingByAisle(items, ['seasoning', 'soyEgg']).map((i) => i.name),
  )
  eq('DY-1 売り場ブロック: 空の買い物メモは見出しを1つも出さない', groupShoppingByAisle([]), [])
}

// ---------- EE-2 買い物メモのごはん→お米換算(2026-08-08 オーナー実機フィードバック) ----------
// 「ご飯はお米換算（g）にして欲しい」。レシピの材料は炊きあがりの重さで書くので、
// 買い物メモに入る分だけ生米のグラム(炊きあがり÷2.2)に置き換える
{
  eq('EE-2 炊きあがり→生米の倍率は2.2倍', COOKED_RICE_TO_RAW_RATIO, 2.2)
  // 茶碗1杯=炊きあがり150g(成分表 01088 の unitGrams) → 150÷2.2=68.2g → gの丸め(5g刻み)で70g
  eq('EE-2 「ご飯 1杯」→「米 70g」', toRawRiceIngredient({ name: 'ご飯', amount: '1', unit: '杯' }), {
    name: '米',
    amount: '70',
    unit: 'g',
  })
  // 2杯=300g → 136.4g → 100g以上は10g刻みで140g
  eq('EE-2 「ご飯 2杯」→「米 140g」', toRawRiceIngredient({ name: 'ご飯', amount: '2', unit: '杯' }), {
    name: '米',
    amount: '140',
    unit: 'g',
  })
  eq(
    'EE-2 ひらがな「ごはん」と単位「杯分」でも換算する',
    toRawRiceIngredient({ name: 'ごはん', amount: '2', unit: '杯分' }),
    { name: '米', amount: '140', unit: 'g' },
  )
  eq(
    'EE-2 炊きあがりをgで書いてあっても生米に戻す(300g→140g)',
    toRawRiceIngredient({ name: 'ご飯', amount: '300', unit: 'g' }),
    { name: '米', amount: '140', unit: 'g' },
  )
  // 量を数値にできない行は、買う量を作文せずそのまま出す
  eq(
    'EE-2 「ご飯 適量」は換算せずそのまま',
    toRawRiceIngredient({ name: 'ご飯', amount: '適量', unit: '' }),
    { name: 'ご飯', amount: '適量', unit: '' },
  )
  // 最初から生米で書いてある行・関係ない食材には触らない
  eq('EE-2 「米 2合」はそのまま', toRawRiceIngredient({ name: '米', amount: '2', unit: '合' }), {
    name: '米',
    amount: '2',
    unit: '合',
  })
  eq('EE-2 「玉ねぎ 1個」はそのまま', toRawRiceIngredient({ name: '玉ねぎ', amount: '1', unit: '個' }), {
    name: '玉ねぎ',
    amount: '1',
    unit: '個',
  })
  eq(
    'EE-2 「五目炊き込みご飯」のような料理名は換算しない',
    toRawRiceIngredient({ name: '五目炊き込みご飯', amount: '1', unit: '個' }).name,
    '五目炊き込みご飯',
  )
  // 買い物候補まで通したときの見え方(名前が「米」・分量が「140g」・調味料扱いにならない)
  {
    const built = buildShoppingCandidates(
      [
        {
          id: 1,
          ingredients: [
            { name: 'ご飯', amount: '2', unit: '杯' },
            { name: '卵', amount: '2', unit: '個' },
          ],
        },
      ],
      [],
    )
    eq('EE-2 買い物候補の食材名が「米」になる', built[0].name, '米')
    eq('EE-2 買い物候補の分量が「140g」になる', built[0].amount, '140g')
    eq('EE-2 換算した米は調味料あつかいにしない(既定でチェックが付く)', built[0].isSeasoningLike, false)
    eq(
      'EE-2 出所の内訳にも換算後の分量が入る',
      built[0].sources,
      [{ recipeId: 1, amount: '140g' }],
    )
  }
  // 在庫「ある」の照合は、元の名前(ご飯)と換算後の名前(米)の両方で効く
  {
    const recipes = [{ id: 1, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] }]
    eq('EE-2 在庫に「米」があれば候補に出さない', buildShoppingCandidates(recipes, ['米']), [])
    eq('EE-2 在庫に「ご飯」があれば候補に出さない', buildShoppingCandidates(recipes, ['ご飯']), [])
  }
  // 出所の小窓: 換算後の行(米)も、この変更より前に保存された行(ご飯)も分量が読める
  {
    const recipeById = new Map([
      [1, { title: '牛丼', ingredients: [{ name: 'ご飯', amount: '2', unit: '杯分' }] }],
    ])
    eq(
      'EE-2 出所の小窓: 「米」の行はレシピのご飯を換算した分量を出す',
      resolveShoppingSources({ name: '米', recipeIds: [1] }, recipeById).recipes[0].amount,
      '140g',
    )
    eq(
      'EE-2 出所の小窓: 換算前に保存された「ご飯」の行はレシピのままの分量を出す',
      resolveShoppingSources({ name: 'ご飯', recipeIds: [1] }, recipeById).recipes[0].amount,
      '2杯分',
    )
  }
  // 同じ食材として合算される＝「ご飯」と「米」で2行に割れない
  {
    const built = buildShoppingCandidates(
      [
        { id: 1, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] },
        { id: 2, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] },
      ],
      [],
    )
    eq('EE-2 複数レシピのごはんは「米」1行にまとまる', built.length, 1)
    eq('EE-2 まとまった分量は合算される(140+140=280g)', built[0].amount, '280g')
  }
}

// ---------- EE-5 チェック済みを下にまとめる(2026-08-08 オーナー実機フィードバック) ----------
// 「スイッチで、チェックした商品をまとめてページの下方に表示し、チェックしていない食材だけが
// 上に残るようにしたい」。既定(スイッチOFF)はこの関数を通さない＝従来どおり
{
  const items = [
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉', isChecked: true }, // 肉・魚介(この売り場は全部チェック済みになる)
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん', isChecked: true }, // 野菜・きのこ
    { id: 5, name: '卵', isChecked: true }, // 豆腐・卵・乳(この売り場も全部チェック済み)
  ]
  const groups = groupShoppingByAisle(items)
  const split = splitCheckedShoppingItems(groups)
  eq(
    'EE-5 上に残るのは未チェックだけ',
    split.groups.map((g) => g.items.map((i) => i.name)),
    [['玉ねぎ'], ['しょうゆ']],
  )
  eq(
    'EE-5 中身が全部チェック済みになった売り場は見出しごと消える',
    split.groups.map((g) => g.key),
    ['vegetable', 'seasoning'],
  )
  eq(
    'EE-5 下にまとめたチェック済みは売り場順のまま',
    split.checked.map((i) => i.name),
    ['にんじん', '豚肉', '卵'],
  )
  // 1件も落とさない＝上＋下で元の全件がそろう(買い物メモから食材が消えたように見せない)
  eq(
    'EE-5 上と下を合わせると元の全件がそろう',
    [...split.groups.flatMap((g) => g.items), ...split.checked].map((i) => i.id).sort(),
    [1, 2, 3, 4, 5],
  )
  // 全部チェック済み/1件もチェックしていないときの端
  eq(
    'EE-5 全部チェック済みなら上の売り場ブロックは1つも残らない',
    splitCheckedShoppingItems(groupShoppingByAisle([{ id: 1, name: '卵', isChecked: true }])).groups,
    [],
  )
  eq(
    'EE-5 1件もチェックしていなければ売り場ブロックは元のまま',
    splitCheckedShoppingItems(groupShoppingByAisle([{ id: 1, name: '卵' }])).groups.map((g) => g.key),
    ['soyEgg'],
  )
  eq('EE-5 空の買い物メモでも壊れない', splitCheckedShoppingItems([]), { groups: [], checked: [] })
}

// ---------- DY-2 買い物メモの出所(2026-08-08 オーナー実機フィードバック②) ----------
// 「食材をタップしたら、どのレシピから登録したのか確認できるように小窓出して欲しい」。
// 実装確認の結果、行が持っていたのは fromRecipeIds(レシピIDの並び)だけで分量は持っていなかった。
// 生成時にレシピごとの分量(sources)を持たせ、古い行はレシピの材料欄から読み直す
{
  // 下書きを作った時点で、レシピごとの内訳が食数スケール込みで載る
  const built = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 2 },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '100', unit: 'g' }], scale: 1 },
    ],
    [],
  )
  eq('DY-2 出所: レシピごとの分量を持つ(食数スケール込み)', built[0].sources, [
    { recipeId: 1, amount: '2個' },
    { recipeId: 2, amount: '100g' },
  ])
  eq('DY-2 出所: recipeIds は sources と同じ並びのまま(既存の呼び出しを壊さない)', built[0].recipeIds, [1, 2])
  // 同じレシピが同じ材料を2行書いていたら、そのレシピの内訳の中で合算する
  const dup = buildShoppingCandidates(
    [{ id: 5, ingredients: [{ name: '砂糖', amount: '1', unit: '大さじ' }, { name: '砂糖', amount: '2', unit: '大さじ' }] }],
    [],
  )
  eq('DY-2 出所: 同じレシピ内の重複行は1件にまとめる', dup[0].sources, [{ recipeId: 5, amount: '大さじ3' }])

  const recipeById = new Map([
    [1, { title: '肉じゃが', ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }],
    [2, { title: 'カレーライス', ingredients: [{ name: '玉ねぎ', amount: '100', unit: 'g' }] }],
  ])
  eq(
    'DY-2 出所: sources があればレシピ名と分量をそのまま出す',
    resolveShoppingSources({ name: '玉ねぎ', sources: built[0].sources }, recipeById),
    {
      recipes: [
        { recipeId: 1, title: '肉じゃが', amount: '2個' },
        { recipeId: 2, title: 'カレーライス', amount: '100g' },
      ],
      manual: false,
      missing: 0,
    },
  )
  // 後方互換: この機能より前に作った行は fromRecipeIds しか持たない→レシピの材料欄から分量を読む
  eq(
    'DY-2 出所: 古い行(レシピIDだけ)はレシピの材料欄から分量を読む',
    resolveShoppingSources({ name: '玉ねぎ', recipeIds: [1, 2] }, recipeById),
    {
      recipes: [
        { recipeId: 1, title: '肉じゃが', amount: '1個' },
        { recipeId: 2, title: 'カレーライス', amount: '100g' },
      ],
      manual: false,
      missing: 0,
    },
  )
  eq(
    'DY-2 出所: 手で足した行は「自分で追加」(レシピは0件)',
    resolveShoppingSources({ name: 'ラップ', manualAdded: true }, recipeById),
    { recipes: [], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: 出所の記録が何も無い行も「自分で追加」として扱う',
    resolveShoppingSources({ name: 'ラップ' }, recipeById),
    { recipes: [], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: レシピ由来の行に手で足した分があれば両方出す',
    resolveShoppingSources(
      { name: '玉ねぎ', sources: [{ recipeId: 1, amount: '2個' }], manualAdded: true },
      recipeById,
    ),
    { recipes: [{ recipeId: 1, title: '肉じゃが', amount: '2個' }], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: 削除されたレシピは一覧から落として件数だけ返す',
    resolveShoppingSources({ name: '玉ねぎ', recipeIds: [1, 999] }, recipeById),
    { recipes: [{ recipeId: 1, title: '肉じゃが', amount: '1個' }], manual: false, missing: 1 },
  )
  eq(
    'DY-2 出所: レシピに無い食材(在庫から手で足した等)は分量を作文せず空にする',
    resolveShoppingSources({ name: 'ラップ', recipeIds: [1] }, recipeById).recipes,
    [{ recipeId: 1, title: '肉じゃが', amount: '' }],
  )
}

// ---------- DY-3 タイマー音の音量・長さ(2026-08-08 オーナー実機フィードバック③) ----------
// 「タイマー音量や長さは、設定から調整や確認できるようにしたい」。
// 既定値は必ず従来の音のまま＝設定を触っていない既存ユーザーの音を勝手に変えない
{
  eq('DY-3 タイマー音: 未設定の音量は従来値(0.4)', timerSoundGain(undefined), 0.4)
  eq('DY-3 タイマー音: 未設定の回数は従来値(3回)', timerSoundBeepCount(undefined), 3)
  eq('DY-3 タイマー音: 「ふつう」は未設定と同じ音量', timerSoundGain('normal'), timerSoundGain(undefined))
  eq('DY-3 タイマー音: 「約1秒」は未設定と同じ回数', timerSoundBeepCount('short'), timerSoundBeepCount(undefined))
  eq('DY-3 タイマー音: 音量は小さめ<ふつう<大きめ', [
    timerSoundGain('low') < timerSoundGain('normal'),
    timerSoundGain('normal') < timerSoundGain('high'),
  ], [true, true])
  eq('DY-3 タイマー音: 長さは短い<ふつう<長い', [
    timerSoundBeepCount('short') < timerSoundBeepCount('medium'),
    timerSoundBeepCount('medium') < timerSoundBeepCount('long'),
  ], [true, true])
  eq('DY-3 タイマー音: 選択肢は音量3段階・長さ3段階', [TIMER_SOUND_VOLUMES.length, TIMER_SOUND_LENGTHS.length], [3, 3])
  // 画面に出す秒数(選択肢のラベル)。1回0.4秒+0.45秒間隔で数えた値
  eq('DY-3 タイマー音: 選択肢のラベルは約1秒/約3秒/約5秒', TIMER_SOUND_LENGTHS.map(timerSoundSeconds), [1, 3, 5])
  // 壊れた保存値(将来の型変更・手で書き換えたIndexedDB)でも音が消えない
  eq('DY-3 タイマー音: 知らない値が保存されていても従来の音で鳴らす', [
    timerSoundGain('とんでもない値'),
    timerSoundBeepCount('とんでもない値'),
  ], [0.4, 3])
}

// ---------- EE-7 タイマー音の注意書き(2026-08-08 オーナー実機フィードバック) ----------
// 「音量と長さのボタン押下では音を鳴らさず、『音を鳴らして〜』ボタン押下ではじめて音が
// 鳴るようにする」「ボタン押下で音が鳴る注意書きがない」。
// どのボタンで鳴るかを言い切っているかを機械検査して、書き換えで曖昧に戻るのを止める
{
  eq(
    'EE-7 注意書きが「音量と鳴る長さのボタンでは鳴らない」と言っている',
    ja.settings.timerSoundPreviewNote.includes('音量と鳴る長さのボタンでは音は鳴りません'),
    true,
  )
  eq(
    'EE-7 注意書きが音の鳴るボタンを名前で挙げている',
    ja.settings.timerSoundPreviewNote.includes(ja.settings.timerSoundPreview),
    true,
  )
  // 規約H: 説明文で「ここ」「これ」等の指示語で場所を示さない
  eq(
    'EE-7 注意書きに指示語が入っていない',
    /ここ|これ|それ|そこ|あちら/.test(ja.settings.timerSoundPreviewNote),
    false,
  )
}

// ---------- EE-3/EE-4 買い物完了の確認文(2026-08-08 オーナー実機フィードバック) ----------
// ③「『買い物終了』後の文章が読みづらい」→内容ごとに改行。
// ④「あとにする＝キャンセルだから処理をしないということ？」→実装(何も書き換えない)を
//   そのまま書き、あとで反映する手順を押すボタンの名前で示す
{
  eq('EE-3 買い物完了の確認は4行に分かれている', ja.shopping.completeConfirmLines.length, 4)
  // 規約F: 何が消えて何が残るかを件数つきで両方書く
  eq(
    'EE-3 消える件数({n})と残る件数({m})を両方書いている',
    [
      ja.shopping.completeConfirmLines.some((l) => l.includes('{n}') && l.includes('消えます')),
      ja.shopping.completeConfirmLines.some((l) => l.includes('{m}') && l.includes('残ります')),
    ],
    [true, true],
  )
  // 2つのボタンが何をするかを、どちらも名前で書いている
  for (const label of [ja.shopping.completeYes, ja.shopping.completeNo]) {
    eq(
      `EE-3 確認文が「${label}」を押したときの結果を書いている`,
      ja.shopping.completeConfirmLines.some((l) => l.includes(`「${label}」を押すと`)),
      true,
    )
  }
  eq(
    'EE-4 「あとにする」を押すと何も変わらないと書いている',
    ja.shopping.completeLaterLines[0].includes(`「${ja.shopping.completeLater}」を押すと`) &&
      ja.shopping.completeLaterLines[0].includes('変わりません'),
    true,
  )
  eq(
    'EE-4 あとで反映する手順を、押すボタンの名前で書いている',
    ja.shopping.completeLaterLines.some(
      (l) => l.includes(`「${ja.shopping.complete}」`) && l.includes(`「${ja.shopping.completeYes}」`),
    ),
    true,
  )
  eq(
    'EE-4 手順の説明に指示語が入っていない',
    ja.shopping.completeLaterLines.some((l) => /ここ|これ|それ|そこ|あちら/.test(l)),
    false,
  )
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

// ---------- hasFillableWorkDuringWait(並行調理ナビ: 待ちの「この間に、次の手作業を進められます」を
// 出す条件。最後の待ちに出さない=2026-07-09ペルソナ第2波 / 同じ品の続きの手順に出さない=2026-08-12 便FS-2) ----------
{
  // 段取りの時刻つき（待ちを仕掛けても料理人の時計は進まないので、
  // 待ちの中に入る手作業は待ちが明ける前に始まる）
  const items = [
    { kind: 'active', startMin: 0, endMin: 4 },
    { kind: 'wait', startMin: 4, endMin: 19 }, // 15分の待ち。中に別の品の手作業が入る
    { kind: 'active', startMin: 4, endMin: 8 },
    { kind: 'wait', startMin: 8, endMin: 23 }, // 最後の待ち(後続の手作業なし)
  ]
  eq('ナビ: 待ちの中に入る手作業があればヒントあり', hasFillableWorkDuringWait(items, 1), true)
  eq('ナビ: 最後の待ちはヒントなし', hasFillableWorkDuringWait(items, 3), false)
  eq(
    'ナビ: 後続が待ちだけでもヒントなし',
    hasFillableWorkDuringWait(
      [
        { kind: 'active', startMin: 0, endMin: 4 },
        { kind: 'wait', startMin: 4, endMin: 9 },
        { kind: 'wait', startMin: 4, endMin: 14 },
      ],
      1,
    ),
    false,
  )
  // 便FS-2(2026-08-12 利用者テスト): 「鍋にだし汁…2分ほど煮る」の待ちに
  // 「この間に、次の手作業を進められます」と出るが、次は「火を弱め、みそを溶き入れる」＝
  // 同じ鍋の続き。同じ品の続きは待ちが明けてからしか始まらない（段取りの時刻がそう置く）ので、
  // 「待ちが明ける前に始まる手作業があるか」で判定すれば構造的に出なくなる
  eq(
    'ナビ: 次の手作業が待ちの明けたあと（同じ品の続き）ならヒントなし',
    hasFillableWorkDuringWait(
      [
        { kind: 'wait', startMin: 10, endMin: 12 }, // 味噌汁: 2分煮る
        { kind: 'active', startMin: 12, endMin: 14 }, // 味噌汁: 火を弱めてみそを溶く
      ],
      0,
    ),
    false,
  )
  eq(
    'ナビ: 同じ品の続きの後ろに、待ちの中へ入る別の品の手作業があればヒントあり',
    hasFillableWorkDuringWait(
      [
        { kind: 'wait', startMin: 10, endMin: 25 },
        { kind: 'active', startMin: 10, endMin: 14 },
      ],
      0,
    ),
    true,
  )
  eq('ナビ: 段取りに無い添字なら出さない', hasFillableWorkDuringWait(items, 99), false)
}

// ---------- findRunningStepTimer(手順のタイマーが動いているか・2026-08-12 便FS-5) ----------
{
  const { stepTimerKey, findRunningStepTimer } = await import('../src/logic/timerOrder.ts')
  const t = (key, over) => ({ key, done: false, ...over })
  const timers = [
    t(stepTimerKey(7, 2, 120)), // レシピ7の手順3（stepIndex=2）で2分
    t(stepTimerKey(9, 0, 300)),
    t(stepTimerKey(7, 20, 60)), // 手順21。「7-2-」で拾ってはいけない
  ]
  eq('FS-TIMER その手順で動いていれば見つかる', findRunningStepTimer(timers, 7, 2)?.key, '7-2-120')
  eq('FS-TIMER 手順が違えば見つからない', findRunningStepTimer(timers, 7, 1), undefined)
  eq('FS-TIMER 手順番号の桁違いを取り違えない(7-2 と 7-20)', findRunningStepTimer(timers, 7, 20)?.key, '7-20-60')
  eq('FS-TIMER レシピが違えば見つからない', findRunningStepTimer(timers, 8, 2), undefined)
  eq(
    'FS-TIMER 鳴り終わったタイマーは動作中に数えない(「タイマーを始める」に戻す)',
    findRunningStepTimer([t(stepTimerKey(7, 2, 120), { done: true })], 7, 2),
    undefined,
  )
  eq(
    'FS-TIMER 一時停止中も動作中として扱う(「始める」に戻すと二重に立つ)',
    findRunningStepTimer([t(stepTimerKey(7, 2, 120), { pausedRemainingMs: 5000 })], 7, 2)?.key,
    '7-2-120',
  )
  eq('FS-TIMER 自分で決めた時間のタイマーは手順に紐付けない', findRunningStepTimer([t('custom-navi-180')], 0, 0), undefined)
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
  // 2026-08-08 便ED で仕様変更: 時間の書かれていない待ち工程にも、時間が読める調理法
  // (煮る・ゆでる・蒸す 等)なら既定分数を当てる(docs/68 打ち手#1(a))。「じっくり煮込む」は待ち10分。
  // 表に無い待ち動詞(なじませる 等)は従来どおり手作業系のまま＝汎用フォールバックは置かない
  eq('ナビ推定: 「じっくり煮込む」は待ち系(調理法から既定分数10分)', classifyStep({ text: 'じっくり煮込む' }), 'wait')
  eq(
    'ナビ推定: 「味がなじむまでおく」は手作業系(既定分数の表に無い動詞)',
    classifyStep({ text: '味がなじむまでおく' }),
    'active',
  )
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

// ---------- isHandsOnStep / classifyStep(並行調理ナビ: 目を離せない工程は短くても待ちにしない。
// 2026-08-08 便EB・オーナー実機報告「肉巻きおにぎりの『焦げやすいので』の手順が待ちに分類され、
// 2分しかないのに他レシピの作業が挟まる」) ----------
{
  // 報告された実データそのもの(src/sets/pack07.ts 肉巻きおにぎり 手順5)
  const nikumaki = {
    text: 'しょうゆ・みりん・砂糖を加え、たれを絡めながら照りが出るまで煮からめる。',
    minutes: 2,
    memo: '焦げやすいので、フライパンをゆすりながらたれをからめること。',
  }
  eq('ナビ付きっきり: 肉巻きおにぎりの「煮からめる」は手作業系', classifyStep(nikumaki), 'active')
  eq('ナビ付きっきり: 肉巻きおにぎりの「煮からめる」を目を離せない工程と判定', isHandsOnStep(nikumaki), true)
  // 根拠が本文にある場合/memoにある場合のどちらでも拾う
  eq(
    'ナビ付きっきり: 本文の「煮からめる」だけでも手作業系',
    classifyStep({ text: 'たれを加えて煮からめる。', minutes: 3 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 注意書きの「焦げやすいので」だけでも手作業系',
    classifyStep({ text: 'グリルで3分焼く。', minutes: 3, memo: 'みそだれは焦げやすいので様子を見ること。' }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「絶えず混ぜながら」は手作業系',
    classifyStep({ text: '弱めの中火で2分ほど煮る。', minutes: 2, memo: '絶えず混ぜながら煮ること。' }),
    'active',
  )
  eq('ナビ付きっきり: 「煮詰める」は手作業系', classifyStep({ text: 'とろみが出るまで煮詰める。', minutes: 2 }), 'active')
  eq('ナビ付きっきり: 「炒り煮にする」は手作業系', classifyStep({ text: 'しょうゆを加えて炒り煮にする。', minutes: 4 }), 'active')
  eq('ナビ付きっきり: 「目を離さない」は手作業系', classifyStep({ text: '弱火で5分温める。', minutes: 5, memo: '目を離さないこと。' }), 'active')

  // 本物の待ちを潰さない(条件つきの注意は付きっきりにしない)。ここを緩めると機能価値が落ちる
  eq(
    'ナビ付きっきり: 「焦げないように水を足す」条件つき注意は待ちのまま',
    classifyStep({
      text: '落としぶたをして弱めの中火で15分ほど煮る。',
      minutes: 15,
      memo: '途中で煮汁がなくなりそうなら少量の水を足すこと（焦げつき防止）。',
    }),
    'wait',
  )
  eq(
    'ナビ付きっきり: 「焦げつきそうなら」も待ちのまま(ラタトゥイユ相当)',
    classifyStep({ text: 'ふたをして弱めの中火で煮る。', minutes: 12, memo: '焦げつきそうなら水を大さじ1ずつ足すこと。' }),
    'wait',
  )
  eq(
    'ナビ付きっきり: 「時々上下を返しながら」浸す工程は待ちのまま',
    classifyStep({ text: '食パンを卵液に浸し、時々上下を返しながらしっかり吸わせる。', minutes: 10 }),
    'wait',
  )

  // 待ち動詞より後ろに炒め・揚げが来る手順＝実体は炒め工程(旧実装はフライパンから目を離させていた)
  eq(
    'ナビ付きっきり: 「なじむまで炒める」は手作業系(卯の花)',
    classifyStep({ text: '生おからを加え、全体に油がなじむまで炒める。', minutes: 2 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「漬け汁ごと入れて炒める」は手作業系(えび)',
    classifyStep({ text: 'えびを漬け汁ごと入れて炒める。器に盛る。', minutes: 3 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「炒め、…15分煮る」は待ちのまま(最後の動作が煮る)',
    classifyStep({ text: '鍋で鶏肉と野菜を炒め、水を加えて中火で15分煮る。', minutes: 15 }),
    'wait',
  )
  // 「チン」の誤爆(チンゲン菜・キッチンペーパー)を待ち動詞にしない
  eq(
    'ナビ分類: 「チンゲン菜を1分炒め」は手作業系(「チン」の誤爆を直す)',
    classifyStep({ text: 'チンゲン菜の茎を加えて強めの中火で1分炒める。', minutes: 1 }),
    'active',
  )
  eq(
    'ナビ分類: 「レンジで2分加熱」は従来どおり待ち系',
    classifyStep({ text: 'レンジで2分加熱する。', minutes: 2 }),
    'wait',
  )
  eq(
    'ナビ分類: 「重しをのせて10分水切りする」は待ち系(放置してよい)',
    classifyStep({ text: '木綿豆腐はキッチンペーパーに包み、重しをのせて水切りする。', minutes: 10 }),
    'wait',
  )
}

// ---------- classifyStep(並行調理ナビ: 時間の書かれていない待ち工程に調理法ごとの既定分数を当てる。
// 2026-08-08 便ED・docs/68 6-4。ユーザーが登録したレシピ(取り込み・手入力)は手順の分数欄が空で、
// 本文にも時間が書かれていないため待ちが1つも見つからず、段取りが1品ずつ作るのと同じになっていた。
// 既定分数は「時間が読める調理法」だけに当て、歯止め3つ(位置ルール・「さっと」・「〜ておく」)を必ず添える。
// **推定した分数はナビの計算にだけ使い、レシピのデータには書き込まない** ----------
{
  /**
   * 手順1つだけのレシピを組んで、その手順の判定と待ち分数を実際のタイムラインから読む。
   * ナビが足した工程（ゆでる手順の前の「湯を沸かす」）は読み飛ばす（2026-08-08 便EG）。
   */
  const only = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find((it) => !it.addedByNavi)
  /**
   * その手順の**待ちの工程**を読む。2026-08-13 便GD で、手作業と待ちが同居する手順は
   * 段取りの上で2つに分かれるようになった（「水を入れて｜煮る」）ので、
   * 1工程めだけを見ると待ち分数が読めない。
   */
  const waitOf = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find(
      (it) => !it.addedByNavi && it.kind === 'wait',
    )

  // (a) 既定分数テーブル: 時間の手掛かりが無い待ち工程も、調理法から分かる分だけ待ちにする
  eq('ナビ既定分数: 「水を沸かす」は待ち5分', only({ text: '水を沸かす' }).kind, 'wait')
  eq('ナビ既定分数: 「水を沸かす」の待ちは5分', only({ text: '水を沸かす' }).waitMinutes, 5)
  eq('ナビ既定分数: 「じゃがいもをゆでる」は待ち8分', only({ text: 'じゃがいもをゆでる' }).kind, 'wait')
  eq('ナビ既定分数: 「じゃがいもをゆでる」の待ちは8分', only({ text: 'じゃがいもをゆでる' }).waitMinutes, 8)
  // 「水を入れて煮る」は手作業（水を入れる）と待ち（煮る）が同居する手順なので、
  // 段取りの上では2工程になる（2026-08-13 便GD）。待ちは10分のまま
  eq('ナビ既定分数: 「水を入れて煮る」は待ち10分', waitOf({ text: '水を入れて煮る' }).kind, 'wait')
  eq('ナビ既定分数: 「水を入れて煮る」の待ちは10分', waitOf({ text: '水を入れて煮る' }).waitMinutes, 10)
  eq('ナビ既定分数: 「水を入れて煮る」の手作業も0分にしない', only({ text: '水を入れて煮る' }).activeMinutes > 0, true)

  // (a') 汎用フォールバックは置かない: 表に無い待ち動詞(なじませる)は従来どおり手作業のまま
  eq(
    'ナビ既定分数: 「残りの野菜も加えて油をなじませる」は手作業(表に無い動詞に一律の分数を当てない)',
    classifyStep({ text: '残りの野菜も加えて油をなじませる' }),
    'active',
  )

  // (b) 位置ルール: 手順の最後に来る動作が待ち動詞のときだけ待ちにする
  eq(
    'ナビ位置ルール: 「…中火にかけ、表面全体に焼き色をつけていきます」は手作業',
    classifyStep({ text: 'フライパンを強めの中火にかけ、表面全体に焼き色をつけていきます' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「…煮立ったら浮いてきたアクを取ります」は手作業',
    classifyStep({ text: '大根としょうが、水と調味料をすべて加え、煮立ったら浮いてきたアクを取ります' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「粗熱が取れたら殻をむく」は手作業(むく=手作業動詞)',
    classifyStep({ text: 'ゆで上がったらすぐ冷水にとり、粗熱が取れたら殻をむく。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 分数が入っている手順には位置ルールを当てない(ユーザーの入力を尊重)',
    classifyStep({ text: '落としぶたをして15分煮る。途中でアクを取る。', minutes: 15 }),
    'wait',
  )

  // (c) 除外語: 「さっと」「〜ておく」には既定分数を当てない
  eq('ナビ除外語: 「熱湯でさっとゆでる」は手作業', classifyStep({ text: '熱湯でさっとゆでる' }), 'active')
  eq(
    'ナビ除外語: 「…混ぜ合わせてたれを作っておく」は手作業(〜ておく)',
    classifyStep({ text: 'しょうゆ・みりん・酒・砂糖を混ぜ合わせてたれを作っておく' }),
    'active',
  )
  // 名詞の除外: 「漬け汁」「漬けだれ」を作る工程は漬け込みではない
  eq(
    'ナビ名詞除外: 「…混ぜ、漬け汁を作る」は手作業(「漬」に反応させない)',
    classifyStep({
      text: '保存容器(なければ深さのあるボウルや耐熱皿)にだし汁・しょうゆ・酢・砂糖を混ぜ、漬け汁を作る。',
    }),
    'active',
  )
  eq(
    'ナビ名詞除外: 「漬けだれを合わせる」は手作業',
    classifyStep({ text: 'ボウルに漬けだれの調味料を合わせる。' }),
    'active',
  )
  // 本物の漬け込みは従来どおり待ち
  eq(
    'ナビ名詞除外: 「冷蔵庫で半日〜一晩漬ける」は待ちのまま',
    classifyStep({ text: '保存袋にめんつゆと水、殻をむいた卵を入れて空気を抜き、冷蔵庫で半日〜一晩漬ける。' }),
    'wait',
  )

  // 安全側: 本文に秒だけの時間が書いてあるときは既定分数で上書きしない(1分未満と分かっているため)
  eq('ナビ既定分数: 「30秒茹でる」は手作業のまま(秒だけの時間を8分に化けさせない)', classifyStep({ text: '30秒茹でる' }), 'active')

  // 同梱109品を1件ずつ目視して見つけた4件の直し(2026-08-08 便ED・docs/68 6-3の裁定)
  eq(
    'ナビ既定分数: 「煮立てる」は5分(煮込み10分と同じにしない・さばの味噌煮)',
    // 「材料を入れて｜煮立てる」も同居する手順として2工程に分かれる（2026-08-13 便GD）
    waitOf({ text: '鍋に水・酒・みりん・砂糖・薄切りしょうがを入れて煮立てる。' }).waitMinutes,
    5,
  )
  eq(
    'ナビ名詞除外: 「オーブンシートを敷き」は手作業(オーブン加熱ではない・ヨーグルトバーク)',
    classifyStep({ text: 'バットにオーブンシートを敷き、ヨーグルトを平らに広げる。' }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「沸騰直前まで温めたら火を弱める」は手作業(沸くのを見ている工程・冷しゃぶ)',
    classifyStep({ text: '鍋にたっぷりの湯を沸かし、酒を加えて沸騰直前まで温めたら火を弱める。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「茹で上がったら…洗い流し、氷水でしっかり締める」は手作業(うどんが伸びる)',
    classifyStep({
      text: '鍋にたっぷりの湯を沸かし、冷凍うどんを袋の表示に沿って茹でる。茹で上がったら流水でぬめりを洗い流し、氷水でしっかり締める。',
    }),
    'active',
  )

  // ホールドアウト標本(初見の9品)で見つかった危険側の誤り3件(2026-08-08 便ED)
  eq(
    'ナビ名詞除外: 「しょうゆで味をつける」は手作業(「しょう"ゆで"」を「ゆでる」と読まない)',
    classifyStep({ text: 'しょうゆで味をつける' }),
    'active',
  )
  eq(
    'ナビ名詞除外: 「めんつゆで味をととのえる」は手作業',
    classifyStep({ text: 'めんつゆで味をととのえる' }),
    'active',
  )
  eq('ナビ名詞除外: 「煮干しでだしをとる」は手作業', classifyStep({ text: '煮干しでだしをとる' }), 'active')
  eq('ナビ名詞除外: 「蒸し器にセットする」は手作業', classifyStep({ text: '蒸し器にセットする' }), 'active')
  eq('ナビ名詞除外: 「漬物を器に出す」は手作業', classifyStep({ text: '漬物を器に出す' }), 'active')
  eq(
    'ナビ麺類: 「そうめんをゆでる」は手作業(1〜2分で吹きこぼれる工程に既定8分を当てない)',
    classifyStep({ text: 'そうめんをゆでる' }),
    'active',
  )
  eq('ナビ麺類: 「パスタをゆでる」は手作業', classifyStep({ text: 'パスタをゆでる' }), 'active')
  eq(
    'ナビ麺類: 本文に時間があれば従来どおり待ち(スパゲッティを8分ゆでる)',
    only({ text: 'スパゲッティを8分ゆでる' }).waitMinutes,
    8,
  )
  eq(
    'ナビ麺類: 麺以外の「ゆでる」は既定8分のまま(じゃがいもをゆでる)',
    only({ text: 'じゃがいもをゆでる' }).waitMinutes,
    8,
  )
  // 位置ルールは待ち動詞の「終わり」で比べる: 「蒸し焼き」の中の「焼き」で待ちを消さない
  eq(
    'ナビ位置ルール: 「ふたをし、中火で15分蒸し焼きにします」は待ち(蒸し焼きの中の「焼き」で消さない)',
    classifyStep({ text: 'フライパンに水を1cmほど張り、包みを並べてふたをし、中火で15分蒸し焼きにします。' }),
    'wait',
  )

  // ---- docs/68「残る限界」2件の解消(2026-08-09 便EM) ----
  // (1) 1分の待ちは並行の材料にしない。ゆで上げの1分は鍋の前を離れられない工程で、
  //     ここに別の料理の作業を差し込むと「ゆですぎ」になる(診断で唯一残っていた危険側1件)
  eq(
    'ナビ最短待ち: 「にんじんを1分、ほうれん草を30秒ゆでます」は手作業(1分は並行の材料にしない)',
    classifyStep({ text: '鍋にたっぷりの湯を沸かし、塩を入れてにんじんを1分、ほうれん草を30秒ゆでます。' }),
    'active',
  )
  eq(
    'ナビ最短待ち: 分数欄に1分と入っていても手作業',
    classifyStep({ text: 'にんじんを1分ゆでる。', minutes: 1 }),
    'active',
  )
  eq(
    'ナビ最短待ち: 2分の待ちは従来どおり待ち(下限は2分)',
    classifyStep({ text: '沸いたら豆腐とわかめを入れて2分温める。', minutes: 2 }),
    'wait',
  )
  // (2) ひらがなの「水気をきる」も手作業動詞として位置ルールに載せる。
  //     「水に5分さらして水気をきります」は、末尾が手作業なので待ちにしない
  eq(
    'ナビ位置ルール: 「水に5分さらして水気をきります」は手作業(ひらがなの「きる」)',
    classifyStep({ text: 'ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「10分ゆでて湯をきる」は手作業(ひらがなの「きる」)',
    classifyStep({ text: 'マカロニを10分ゆでて湯をきる。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「水気をきってから冷蔵庫で冷やす」は待ちのまま(最後の動作が待ち)',
    classifyStep({ text: '水気をきってから冷蔵庫で30分冷やす。' }),
    'wait',
  )
}

// ---------- classifyStep(並行調理ナビ: 放置してよい加熱を「待ち」と読む。2026-08-13 便GA・docs/72 第1段)
//
// 直した不具合(docs/71 R3・docs/72 §0): 「魚焼きグリルで15分焼く」が**手作業15分**と判定され、
// 15分ずっと手がふさがる前提で段取りが組まれていた。位置ルール(手順の最後に来る動作が主役)が
// 末尾の「焼く」を拾うためで、**手順に分数が書かれていないときだけ**起きる。同梱109品は分数欄が
// 埋まっていて位置ルールが適用されないので、同梱109品では絶対に見えない誤りだった。
//
// 直し方は2つ。どちらも位置ルール本体は残したまま、**位置ルールが数える「手作業の動作」から
// 外す**形にしてある(位置ルールは「煮立ったらアクを取る」を手作業に保つのに必要なため)。
//   (1) 手を離してよい器具(グリル・オーブン・トースター・電子レンジ)より後ろの「焼く」は、
//       その器具の加熱そのものであって手を動かす動作ではない
//   (2) 「ときどき」「途中で」に導かれる動作は、待ちの最中の一手であって待ちを終わらせる動作ではない
// ----------
{
  const only = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find((it) => !it.addedByNavi)

  // (1) 放置してよい器具の加熱は、分数欄が空でも待ち
  eq(
    'ナビ放置調理: 「魚焼きグリルで15分焼く」は待ち(分数欄が空でも)',
    classifyStep({ text: '魚焼きグリルで15分焼く。' }),
    'wait',
  )
  eq('ナビ放置調理: 「魚焼きグリルで15分焼く」の待ちは15分', only({ text: '魚焼きグリルで15分焼く。' }).waitMinutes, 15)
  eq('ナビ放置調理: 「トースターで5分焼く」は待ち', classifyStep({ text: 'トースターで5分焼く' }), 'wait')
  eq('ナビ放置調理: 「オーブンで20分焼く」は待ち', classifyStep({ text: 'オーブンで20分焼く' }), 'wait')
  eq(
    'ナビ放置調理: 「グリルで両面をこんがり焼く」は待ち(時間が無ければ既定15分)',
    only({ text: 'グリルで両面をこんがり焼く' }).waitMinutes,
    15,
  )
  // 安全側(S1を増やさない): 器具の語が無い「焼く」は従来どおり手作業のまま
  eq(
    'ナビ放置調理: 「フライパンで3分焼く」は手作業のまま(器具の語が無い)',
    classifyStep({ text: 'フライパンで3分焼く' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「…中火にかけ、表面全体に焼き色をつけていきます」は手作業のまま',
    classifyStep({ text: 'フライパンを強めの中火にかけ、表面全体に焼き色をつけていきます' }),
    'active',
  )
  // 安全側: 器具の語があっても、加熱のあとに手を動かす動作が来る手順は手作業のまま
  eq(
    'ナビ放置調理: 「グリルで焼いた鮭を器に盛る」は手作業(加熱の後に盛り付けが来る)',
    classifyStep({ text: 'グリルで焼いた鮭を器に盛る。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「オーブンから取り出して…食べやすく切る」は手作業',
    classifyStep({ text: 'オーブンから取り出して粗熱を取り、食べやすく切る。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「レンジで2分加熱してから全体を混ぜる」は手作業(混ぜるが後ろに来る)',
    classifyStep({ text: 'レンジで2分加熱してから全体を混ぜる。' }),
    'active',
  )

  // (2) 「ときどき」「途中で」の一手は、待ちを終わらせる動作に数えない
  eq(
    'ナビ放置調理: 「25分煮込み、ときどき混ぜながら…」は待ち(ミートソース)',
    classifyStep({ text: 'ふたをせずに弱火で25分煮込み、ときどき混ぜながら水分をとばします。' }),
    'wait',
  )
  eq(
    'ナビ放置調理: 「60分煮ていきます。途中で上下を返すと…」は待ち(煮豚)',
    classifyStep({
      text: '落としぶたをして弱火に落とし、そこから60分ゆっくり煮ていきます。途中で上下を返すと色むらがなくなります。',
    }),
    'wait',
  )
  // 安全側: 「ときどき」が付いても、鍋から離れられない語があれば従来どおり付きっきり
  eq(
    'ナビ放置調理: 「ときどき混ぜながら…煮詰める」は手作業のまま(煮詰めるは鍋から離れられない)',
    classifyStep({ text: 'たれを加え、ときどき混ぜながらとろみが出るまで煮詰める。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「絶えず混ぜながら5分温める」は手作業のまま',
    classifyStep({ text: '絶えず混ぜながら弱火で5分温める。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「ときどき」の付かない「混ぜながら5分煮る」は手作業のまま',
    classifyStep({ text: '弱火にかけ、混ぜながら5分煮る。' }),
    'active',
  )
  // 位置ルール本体は残す(これを外すと危険側の誤判定が戻る)
  eq(
    'ナビ放置調理: 位置ルールは健在「煮立ったら浮いてきたアクを取ります」は手作業',
    classifyStep({ text: '大根としょうが、水と調味料をすべて加え、煮立ったら浮いてきたアクを取ります' }),
    'active',
  )
  eq(
    'ナビ放置調理: 位置ルールは健在「粗熱が取れたら殻をむく」は手作業',
    classifyStep({ text: 'ゆで上がったらすぐ冷水にとり、粗熱が取れたら殻をむく。' }),
    'active',
  )
}

// ---------- 並べ方（2026-08-13 便GB・docs/72 第2段）
//
// 直した不具合3つ。いずれも docs/71 R3（利用者が自分で登録した3品での実操作）で出たもの。
//   (1)「その間に」が読まれない … 利用者が本文に書いた並行の指示が、直前の待ちの**あと**に
//       置かれていた（レシピ内の手順を厳密に順番どおり実行するため、構造上その待ちの中に置けない）
//   (2)「最後に仕上げる」と「最後に着火する」が分かれていない … 冷たい品の仕上げを先にする規則が、
//       温かい品の**着火（長い放置調理の開始）**より上に立ち、グリルの着火が後ろへ送られていた
//   (3) 仕上げが早すぎる … 汁物が完成してから20分以上放置される段取りが出ていた
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  const finishOf = (timeline, title) =>
    timeline.items.reduce((at, it) => (it.recipeTitle === title ? it.endMin : at), 0)

  // ---- (1) 「その間に」を直前の待ちの中に置く ----
  eq('ナビ並行指示: 「その間に」は並行の合図', hasParallelCue('その間に☆を全部混ぜ合わせておく。'), true)
  eq('ナビ並行指示: 「炊いている間に」も並行の合図', hasParallelCue('炊いている間に大根を短冊切りにする。'), true)
  eq('ナビ並行指示: 「漬けている間に」も並行の合図', hasParallelCue('漬けている間にキャベツをせん切りにする。'), true)
  // 「〜ながら」は1つの動作の中の同時（ほぐしながら炒める）が大半なので合図にしない
  eq('ナビ並行指示: 「ほぐしながら炒める」は合図にしない', hasParallelCue('ひき肉をほぐしながら炒めます。'), false)
  eq('ナビ並行指示: ふつうの手順は合図にしない', hasParallelCue('鍋で15分煮る。'), false)

  {
    const t = buildCookTimeline([
      recipe(1, '煮もの', ['鍋に材料とだし汁を入れて15分煮る。', 'その間に小ねぎを小口切りにする。', '器に盛る。']),
    ])
    const wait = t.items.find((it) => it.kind === 'wait')
    const cue = t.items.find((it) => it.text.startsWith('その間に'))
    const after = t.items.find((it) => it.text === '器に盛る。')
    eq('ナビ並行指示: 「その間に」の手順は待ちが明ける前に始まる', cue.startMin < wait.endMin, true)
    eq('ナビ並行指示: その次の手順は待ちが明けてから', after.startMin >= wait.endMin, true)
    // 合図の無い手順は従来どおり待ちの外（レシピ内の順序を守る）
    const plain = buildCookTimeline([
      recipe(2, '煮もの', ['鍋に材料とだし汁を入れて15分煮る。', '小ねぎを小口切りにする。', '器に盛る。']),
    ])
    const plainWait = plain.items.find((it) => it.kind === 'wait')
    const plainNext = plain.items.find((it) => it.text === '小ねぎを小口切りにする。')
    eq('ナビ並行指示: 合図が無ければ従来どおり待ちの外', plainNext.startMin >= plainWait.endMin, true)
  }
  {
    // 直前が待ちでない手順に合図が付いていても、順序は動かさない（合図だけで前へ飛ばさない）
    const t = buildCookTimeline([recipe(1, 'テスト', ['野菜を切る。', 'その間にたれを混ぜる。'])])
    eq('ナビ並行指示: 直前が待ちでなければ順序は変わらない', t.items[0].text, '野菜を切る。')
    eq('ナビ並行指示: 直前が待ちでなければ重ならない', t.items[1].startMin >= t.items[0].endMin, true)
  }

  // ---- (2) 「最後に着火する」を「最後に仕上げる」から切り離す ----
  {
    // 冷たい品の仕上げ（1手順で完結＝いきなり最後の手順）と、
    // 温かい品の「着火の1つ手前」の手順がぶつかる場面。着火を先にする
    const t = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, 'トマトサラダ', ['切ったトマトをドレッシングで和える。']),
    ])
    eq('ナビ着火: 冷たい品の仕上げより、長い放置調理の着火の準備が先', t.items[0].recipeTitle, '鶏のグリル焼き')
    const grill = t.items.find((it) => it.kind === 'wait')
    eq('ナビ着火: グリルは段取りの前半で着火する', grill.startMin * 2 <= t.totalMinutes, true)
  }
  {
    // 着火の予定が無いときは従来どおり＝冷たい品を先に仕上げる（2026-08-08 便EGのオーナー指示）
    const t = buildCookTimeline([
      recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。']),
      recipe(2, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
    ])
    eq('ナビ着火: 長い放置調理が無ければ冷たい品を先に仕上げる', finishOf(t, 'トマトサラダ') < finishOf(t, '野菜炒め'), true)
  }

  // ---- (3) 温かい品・汁物の仕上げを、ほかの品の完成に合わせて後ろへ寄せる ----
  eq(
    'ナビ温度: 汁物は温かい品として扱う（冷めたら作り直せない）',
    recipeServeTemp(recipe(1, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', 'みそを溶いて火を止める。'], { dishType: 'soup' })),
    'hot',
  )
  eq(
    'ナビ温度: 冷たい汁物（冷や汁）は冷たい品のまま',
    recipeServeTemp(recipe(1, '冷や汁', ['だしを作る。', '粗熱を取り、冷蔵庫でよく冷やす。'], { dishType: 'soup' })),
    'cold',
  )
  {
    const t = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', '豆腐をさいの目に切る。', '沸いたら豆腐とわかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
    ])
    const idle = finishOf(t, '鶏のグリル焼き') - finishOf(t, '豆腐とわかめのみそ汁')
    eq('ナビ仕上げ: 汁物が主菜より10分以上早く仕上がらない', idle <= 10, true)
    // 遅らせても全体は伸びない（伸ばして揃えるのでは意味がない）
    eq('ナビ仕上げ: 遅らせても全体の目安は伸びない', t.totalMinutes <= 30, true)
  }
  {
    // 1品だけのときは遅らせない（比べる相手がいない＝ただの空白になる）
    const t = buildCookTimeline([
      recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。']),
    ])
    eq('ナビ仕上げ: 1品だけなら空白を作らない', t.items[t.items.length - 1].startMin, t.items[t.items.length - 2].endMin)
  }
  {
    // 仕上げを後ろへ寄せても全体は伸ばさない。実装中に一度ここで伸ばしてしまい、
    // 同梱109品の平均短縮率が 33.1%→31.9% と合格ライン（32.6%）を割った（歯止めの再発防止）
    const t = buildCookTimeline([
      recipe(1, 'マリネ', ['鶏肉をマリネ液に入れて冷蔵庫で30分漬ける。', 'フライパンで焼く。']),
      recipe(2, '煮物', ['大根を切る。', '鍋で20分煮る。', '器に盛る。']),
    ])
    // 2026-08-13 便GD: 「鶏肉をマリネ液に入れて｜冷蔵庫で30分漬ける」が2工程に分かれ、
    // これまで0分だった「マリネ液に入れる」の1分が段取りに乗るので 38→39 分になる
    // （後ろへ寄せたことで伸びたのではない。ここで見たいのは寄せても伸びないこと）
    eq('ナビ仕上げ: 後ろへ寄せても全体の目安は39分のまま（伸ばして揃えない）', t.totalMinutes, 39)
    // 着地は34分のままだが、**そこへ持っていくやり方が変わった**（2026-08-14 便GG）。
    //   旧: 3分に着火して23分に煮上がり、器に盛るのを34分まで待たせる＝鍋は11分火の上
    //   新: 着火そのものを12分に回し、32分に煮上がってすぐ火を止める＝火にかけたままにしない
    // 利用者の手順「だしを張って火にかけるのはグリルに入れてから」と同じ形。
    eq(
      'ナビ仕上げ: 煮物の仕上げは手の空いた時間の終わりに着地する',
      t.items.find((it) => it.text === '器に盛る。').endMin,
      34,
    )
    eq(
      'ナビ仕上げ: そこへは「着火を後ろへ回して」持っていく（火にかけたまま待たせない）',
      (() => {
        const simmer = t.items.find((it) => it.text === '鍋で20分煮る。')
        const serve = t.items.find((it) => it.text === '器に盛る。')
        return [simmer.startMin > 3, serve.startMin - simmer.endMin <= 3]
      })(),
      [true, true],
    )
  }
}

// ---------- 器具の占有（2026-08-13 便GC・docs/72 第3段）
//
// 直した不具合（docs/71 R2・コンロ1口の家）:
//   「回鍋肉＋味噌汁で段取りを作ったら…⑤鍋で2分煮る（待ち）→⑥フライパンで豚肉を炒める→⑦また鍋
//   →⑧またフライパン。うちは1口なので、この段取りはそもそも成立しません。警告もヒントも一切なし。」
// 段取りが「料理人1人」しか見ておらず、**器具が何台あるか**を見ていなかった。
// ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps: steps.map((text) => ({ text })) })
  const kitchen = (burners, extra) => ({
    burners,
    microwave: true,
    grill: true,
    toaster: true,
    ...extra,
  })

  // ---- (1) 器具の見分け ----
  eq('器具: 魚焼きグリル', stepAppliance('魚焼きグリルで15分焼く。'), 'grill')
  eq('器具: トースター', stepAppliance('トースターでこんがり焼き色がつくまで焼く。'), 'toaster')
  eq('器具: 電子レンジ', stepAppliance('耐熱ボウルに入れてラップをかけ、電子レンジで3分加熱する。'), 'microwave')
  eq('器具: ワット数の表記もレンジ', stepAppliance('ふんわりラップをかけて600Wで2分加熱する。'), 'microwave')
  eq('器具: オーブンはレンジと同じ1台として数える（家庭で多いのはオーブンレンジ）', stepAppliance('200度のオーブンで20分焼く。'), 'microwave')
  eq('器具: 火の言い回しがあればコンロ', stepAppliance('フライパンで豚肉を炒める。'), 'stove')
  eq('器具: 火の語が無くても鍋があればコンロ（安全側）', stepAppliance('鍋にだし汁を入れる。'), 'stove')
  eq('器具: 火から下りていればコンロと数えない', stepAppliance('鍋の中身をボウルに移して冷ます。'), null)
  eq('器具: 火を止める手順も、その時点までは火の上にある', stepAppliance('全体がまとまったら火を止める。'), 'stove')
  eq('器具: 器具を使わない手順', stepAppliance('ボウルに調味料を混ぜ合わせる。'), null)
  // 材料名の取り違え（見分けを間違えると、使っていない口を使っていることにしてしまう）
  eq('器具: 「油揚げ」は揚げ物ではない', stepAppliance('油揚げは短冊切りにする。'), null)
  eq('器具: 「蒸し大豆」は蒸す工程ではない', stepAppliance('ボウルにツナと蒸し大豆を入れてあえる。'), null)
  eq('器具: 「フレンチトースト」はトースターではない', stepAppliance('フレンチトーストの卵液を作る。'), null)
  eq('器具: 「グリルパン」はコンロで使う道具', stepAppliance('グリルパンに油をひく。'), 'stove')
  eq('器具: 「炒りごま」は炒る工程ではない', stepAppliance('すり鉢に炒りごまを入れる。'), null)

  // ---- (2) 持っていない器具はコンロ1口として数える ----
  eq(
    '器具: グリルを持っていない家では、グリルの工程はコンロを使う',
    stepApplianceFor('魚焼きグリルで15分焼く。', kitchen(2, { grill: false })),
    'stove',
  )
  eq(
    '器具: 持っていれば従来どおりグリル',
    stepApplianceFor('魚焼きグリルで15分焼く。', kitchen(2)),
    'grill',
  )

  // ---- (3) 設定の読み取り（未設定の端末は従来どおり） ----
  eq('器具: 既定は2口', DEFAULT_KITCHEN.burners, 2)
  eq('器具: 設定が空なら既定', kitchenFromSettings(undefined), DEFAULT_KITCHEN)
  eq('器具: 未設定の項目は「持っている」', kitchenFromSettings({}), DEFAULT_KITCHEN)
  eq(
    '器具: 「持っていない」だけを保存する形',
    kitchenFromSettings({ kitchenBurners: 1, kitchenNoGrill: true }),
    { burners: 1, microwave: true, grill: false, toaster: true },
  )
  eq('器具: 口数は1〜4に収める', [clampBurners(0), clampBurners(9)], [1, 4])

  // ---- (4) R2の実例。1口では同時に火にかけない ----
  // R2の訴えの形（鍋の煮込みが動いている最中に、フライパンの炒めものを差し込む段取り）
  const nimono = () =>
    recipe(1, '煮もの', ['大根を切る。', '鍋に大根とだし汁を入れて10分煮る。', '器に盛る。'])
  const itamemono = () =>
    recipe(2, '炒めもの', ['キャベツをざく切りにする。', 'フライパンで豚バラ肉を炒める。', '器に盛る。'])
  /** その段取りで、同時に何口のコンロを使っているかの最大 */
  const maxStove = (timeline) => {
    const uses = timeline.items
      .map((it) => ({
        key: stepAppliance(it.text),
        start: it.startMin,
        end: it.endMin,
        span: it.kind === 'wait' ? it.waitMinutes : it.activeMinutes,
        relaxed: it.kind === 'wait' && waitUrgency({ text: it.text }) === 'relaxed',
      }))
      .filter((u) => u.key === 'stove' && u.span > 0 && !u.relaxed && u.end > u.start)
    const events = uses.flatMap((u) => [[u.start, 1], [u.end, -1]])
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let now = 0
    let max = 0
    for (const [, d] of events) {
      now += d
      if (now > max) max = now
    }
    return max
  }
  eq(
    'ナビ器具: コンロ1口の家に、同時に2つ火にかける段取りを出さない',
    maxStove(buildCookTimeline([nimono(), itamemono()], kitchen(1))),
    1,
  )
  eq(
    'ナビ器具: 2口あれば重ねてよい（口数に余裕があるほど同時に進める）',
    maxStove(buildCookTimeline([nimono(), itamemono()], kitchen(2))),
    2,
  )
  eq(
    'ナビ器具: 1口のほうが段取りは長くなる（無理な順番を出さないぶん）',
    buildCookTimeline([nimono(), itamemono()], kitchen(1)).totalMinutes >
      buildCookTimeline([nimono(), itamemono()], kitchen(2)).totalMinutes,
    true,
  )
  eq(
    'ナビ器具: 設定を省くと既定（2口）で組む＝従来どおり',
    buildCookTimeline([nimono(), itamemono()]).totalMinutes,
    buildCookTimeline([nimono(), itamemono()], kitchen(2)).totalMinutes,
  )

  // ---- (4b) 縮まなかった理由を書き分ける（正直表示。序列「安全>正直>短縮効果」） ----
  {
    // どちらもコンロを使う2品。1口では並行の余地が無く、2口なら10分のゆでの中に焼きが入る
    const pair = () => [
      recipe(1, 'ゆで卵', ['鍋に湯を沸かし、卵を10分ゆでる。', '冷水にとって殻をむく。']),
      recipe(2, '照り焼き', ['フライパンで鶏もも肉を焼く。', 'たれをからめる。']),
    ]
    const one = buildCookPlan(pair(), kitchen(1))
    const many = buildCookPlan(pair(), kitchen(2))
    eq('ナビ器具: 1口では並行の余地が無く、1品ずつ作る順番を出す', one.mode, 'sequential')
    eq('ナビ器具: その理由は「待ちが無い」ではなく「口が足りない」と書き分ける', one.limitedByEquipment, true)
    eq('ナビ器具: 口に余裕があるときは並行の段取りになる', many.mode, 'parallel')
    eq('ナビ器具: 並行できたときは器具のせいにしない', many.limitedByEquipment, false)
    // 待ちがそもそも無い品は、口数に関係なく従来どおり「待ち時間が見つからない」側
    const noWait = buildCookPlan(
      [
        recipe(1, 'あえもの', ['きゅうりを薄切りにする。', '調味料と和える。']),
        recipe(2, 'サラダ', ['レタスをちぎる。', 'ドレッシングをかける。']),
      ],
      kitchen(1),
    )
    eq('ナビ器具: 待ちが無いだけのときは器具のせいにしない', noWait.limitedByEquipment, false)
  }

  // ---- (4c) 火にかけた鍋は、火を止めるまで口をふさぎ続ける（2026-08-14 便GI） ----
  // 直した不具合（docs/68 の合格ライン引き直しで見つけた）:
  //   口をふさぐ長さを**その工程の長さ**だけで数えていたため、「中火で15分煮る」が終われば
  //   口が空くことになり、**まだ火にかかっている鍋の上にもう1つ鍋を置く段取り**が出ていた。
  //   コンロ1口の家で、手も口も足りていないのに「できる」と言っている段取り（＝理論下限を
  //   下回る段取り）が9通り。下はその実例（カレーの鍋が29分の時点でまだ火の上にあるのに、
  //   親子丼を火にかけていた）。
  {
    const curry = () => ({
      id: 1,
      title: 'カレー',
      steps: [
        { text: '野菜は食べやすい大きさに切る。玉ねぎは薄切りにすると溶けて甘みが出る。' },
        { text: '厚手の鍋で肉と玉ねぎを炒め、残りの野菜も加えて油をなじませる。' },
        { text: '水を注ぎ、あくを取りながら中火で15分煮る。', minutes: 15 },
        { text: 'いったん火を止めてルーを溶かし、弱火でとろみが付くまで5分煮る。', minutes: 5 },
        { text: 'ご飯にかけて完成。' },
      ],
    })
    const oyako = () => ({
      id: 2,
      title: '親子丼',
      steps: [
        { text: '鶏肉は一口大、玉ねぎは薄切りにする。' },
        { text: '小さめのフライパンにめんつゆと水を入れ、鶏肉と玉ねぎを中火で7分煮る。', minutes: 7 },
        { text: '溶き卵を2回に分けて回し入れ、ふたをして半熟で火を止める。' },
        { text: 'ご飯にのせ、お好みで三つ葉や刻みのりを散らす。' },
      ],
    })
    /** カレーの鍋が火から下りる時刻（この品は最後まで火を止める言葉が出てこない＝終わりまで火の上） */
    const potOffAt = (t) => Math.max(...t.items.filter((it) => it.recipeId === 1).map((it) => it.endMin))
    /** 親子丼を火にかける時刻 */
    const igniteAt = (t) => t.items.find((it) => it.recipeId === 2 && it.text.includes('7分煮る'))?.startMin
    const one = buildCookTimeline([curry(), oyako()], kitchen(1))
    eq(
      'ナビ器具: 1口の家では、火にかけた鍋が火から下りるまで別の品を火にかけない',
      igniteAt(one) >= potOffAt(one),
      true,
    )
    const two = buildCookTimeline([curry(), oyako()], kitchen(2))
    eq(
      'ナビ器具: 2口あれば、鍋を火にかけたままもう1品を火にかけてよい（縮める力を落とさない）',
      igniteAt(two) < potOffAt(two),
      true,
    )
    eq(
      'ナビ器具: 口をふさぎ続けるぶん、1口の段取りは2口より長くなる',
      one.totalMinutes > two.totalMinutes,
      true,
    )
  }

  // ---- (5) 占有しない待ち（漬ける・冷ます・寝かせる）は口をふさがない ----
  {
    const soak = buildCookTimeline(
      [
        recipe(1, 'マリネ', ['鶏肉をマリネ液に漬けて冷蔵庫で30分おく。', '器に盛る。']),
        recipe(2, 'みそ汁', ['鍋にだし汁を入れて火にかける。', '豆腐を入れて2分煮る。']),
      ],
      kitchen(1),
    )
    eq(
      'ナビ器具: 冷蔵庫で漬ける待ちの間も、1口の家でコンロを使える',
      soak.items.some((it) => /火にかける/.test(it.text) && it.startMin < 30),
      true,
    )
  }

  // ---- (6) レンジ・グリル・トースターは同時に1つまで ----
  {
    const twoMicrowave = buildCookTimeline(
      [
        recipe(1, '副菜A', ['耐熱皿に並べ、電子レンジで5分加熱する。', '和える。']),
        recipe(2, '副菜B', ['耐熱皿に並べ、電子レンジで5分加熱する。', '和える。']),
      ],
      kitchen(3),
    )
    const heats = twoMicrowave.items.filter((it) => /電子レンジ/.test(it.text))
    eq(
      'ナビ器具: 電子レンジは口数に関係なく同時に1つまで',
      heats[0].endMin <= heats[1].startMin || heats[1].endMin <= heats[0].startMin,
      true,
    )
  }
}

// ---------- 手作業と待ちの同居（2026-08-13 便GD・docs/72 対象2）
//
// 直した不具合（docs/71 R3）:
//   (1)「皮を取り、フォークで刺し、そぎ切りにする。10分おく」→ **待ち10分だけ**が段取りに乗り、
//       包丁仕事の4〜5分が0分。しかもタイマーを先に押すと漬け時間が5分しか残らない
//   (2)「鍋に水とだしの素を入れて中火にかける」→ **手作業2分だけ**で、沸くまでの4〜5分が0分。
//       「実際にはここで3分立ち尽くします」
//   (3) 待ちが先・手作業が後ろの同居（docs/68 3-3「どちらに倒しても正しくならない」）
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((s) => (typeof s === 'string' ? { text: s } : s)),
    ...extra,
  })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 手作業が先・待ちが後ろ ----
  const r3Step = t('鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。')
  eq('ナビ同居: R3の「そぎ切りにする。10分おく」を2つに分ける', splitMixedStep(r3Step), {
    active: { text: '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。', memo: undefined },
    wait: { text: '塩こしょうと酒をふって10分ほどおく。', minutes: undefined, memo: undefined },
  })
  eq(
    'ナビ同居: 読点の無い「水を入れて煮る」も動詞＋てで切る',
    (() => {
      const s = splitMixedStep(t('水を入れて煮る'))
      return [s.active.text, s.wait.text]
    })(),
    ['水を入れて', '煮る'],
  )
  {
    const plan = buildCookTimeline([recipe(1, '主菜', [r3Step])])
    const act = plan.items[0]
    const wait = plan.items[1]
    eq('ナビ同居: 手を動かす時間が0分でなくなる', act.activeMinutes > 0, true)
    eq('ナビ同居: 待ちの分数は変わらない', wait.waitMinutes, 10)
    // R3の実害そのもの: タイマーは待ちの工程にしか出ないので、手作業の前には押せない
    eq('ナビ同居: タイマーは待ちの工程だけに出る', [showsWaitTimerButton(act), showsWaitTimerButton(wait)], [false, true])
    eq('ナビ同居: 待ちは手作業が終わってから始まる', wait.startMin, act.endMin)
    eq('ナビ同居: 番号は「1-1」「1-2」', [recipeStepLabel(act), recipeStepLabel(wait)], ['1-1', '1-2'])
    // カーソル・タイマー・手順カードのidに使う識別子は必ず別（同じだと「次へ」が戻る）
    eq('ナビ同居: 2つの工程は別の識別子を持つ', act.stepIndex !== wait.stepIndex, true)
  }
  // 分けない側（迷ったら分けない）
  eq('ナビ同居: 分数欄が埋まっている手順は分けない', splitMixedStep(t('水を入れて煮る', 10)), undefined)
  eq('ナビ同居: 前半に手を動かす動詞が無ければ分けない', splitMixedStep(t('弱火で20分煮る。')), undefined)
  eq('ナビ同居: もともと手作業の手順は分けない', splitMixedStep(t('大根と調味料を加え、煮立ったら浮いてきたアクを取ります。')), undefined)
  eq(
    'ナビ同居: 括弧の中の但し書きは切る位置の根拠にしない（「器に盛る」を待ちにしない）',
    splitMixedStep(t('鮭を裏返し、中まで火が通るまで焼いて器に盛る（両面焼きグリルの場合は裏返さずそのまま両面を焼く）。')),
    undefined,
  )
  // 分けても待ちは1分も減らさない（減る書き方なら分けない、という歯止めの確認）
  for (const text of ['ポリ袋に入れてもみ込み、15分おきます。', 'ふたをずらしてのせ、弱めの中火で20分煮ます。', '水を入れて煮る']) {
    const s = splitMixedStep(t(text))
    eq(
      `ナビ同居: 分けても待ちは減らない（${text.slice(0, 12)}）`,
      resolveWaitMinutes(s.wait) >= resolveWaitMinutes(t(text)),
      true,
    )
  }

  // ---- (2) 本文に書かれていない「沸くまでの待ち」 ----
  {
    const soup = buildPlanSteps([
      t('鍋に水とだしの素を入れて中火にかける。'),
      t('豆腐をさいの目に切る。'),
      t('沸いたら豆腐と乾燥わかめを入れる。'),
      t('みそを溶いて火を止める。'),
    ])
    eq('ナビ沸くまで: 工程が1つ増える', soup.length, 5)
    eq('ナビ沸くまで: 「火にかける」の直後に待ちが入る', [soup[1].step.text, soup[1].step.minutes, soup[1].addedByNavi], [
      ja.cookNavi.addedBoilWaitStep,
      BOIL_WATER_MINUTES,
      true,
    ])
    eq('ナビ沸くまで: 番号は「1-1」「1-2」', [recipeStepLabel(soup[0]), recipeStepLabel(soup[1])], ['1-1', '1-2'])
    const plan = buildCookTimeline([recipe(1, 'みそ汁', ['鍋に水とだしの素を入れて中火にかける。', '豆腐をさいの目に切る。', '沸いたら豆腐と乾燥わかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' })])
    const boil = plan.items.find((it) => it.text === ja.cookNavi.addedBoilWaitStep)
    const cut = plan.items.find((it) => it.text === '豆腐をさいの目に切る。')
    eq('ナビ沸くまで: 待ちとして段取りに乗る', [boil.kind, boil.waitMinutes], ['wait', BOIL_WATER_MINUTES])
    eq('ナビ沸くまで: 沸くのを待つ間に次の手順を進められる', cut.startMin < boil.endMin, true)
    // 「沸いたら〜」の手順は沸くのを待つ工程そのもの。待ちの中に置かない
    const after = plan.items.find((it) => it.text === '沸いたら豆腐と乾燥わかめを入れる。')
    eq('ナビ沸くまで: 「沸いたら」の手順は沸いてから', after.startMin >= boil.endMin, true)
  }
  {
    // 「火にかける」の次の手順がいきなり「沸騰したら」のとき、それを待ちの中に置かない
    const plan = buildCookTimeline([
      recipe(1, 'ゆで卵', ['鍋に水を入れて中火にかける。', '沸騰したら卵をそっと入れる。', '冷水にとって殻をむく。']),
    ])
    const boil = plan.items.find((it) => it.text === ja.cookNavi.addedBoilWaitStep)
    const next = plan.items.find((it) => it.text === '沸騰したら卵をそっと入れる。')
    eq('ナビ沸くまで: 次の手順が「沸騰したら」ならその中に置かない', next.startMin >= boil.endMin, true)
  }
  eq(
    'ナビ沸くまで: 後ろに「沸いたら」が無ければ足さない',
    buildPlanSteps([t('フライパンを中火にかける。'), t('肉を入れて焼き色をつける。')]).length,
    2,
  )
  eq(
    'ナビ沸くまで: 同じ手順の中で作業が続く書き方には足さない',
    buildPlanSteps([t('鍋にだし汁を入れて火にかけ、煮立ったら豆腐を加えます。')]).filter((p) => p.addedByNavi).length,
    0,
  )
  eq(
    'ナビ沸くまで: 湯沸かしを足した品には足さない（鍋を二度沸かさない）',
    buildPlanSteps([t('鍋に水を入れて中火にかける。'), t('沸いたらそうめんをゆでる。')]).filter((p) => p.addedByNavi)
      .length,
    1,
  )

  // ---- (3) 待ちが先・手作業が後ろの同居 ----
  eq(
    'ナビ同居: 「水につけてもどし、水気を絞ってざく切りにする」は待ちと手作業に分ける',
    (() => {
      const s = splitWaitFirstStep(t('切り干し大根はたっぷりの水につけてもどし、水気を絞ってざく切りにする'))
      return [s.wait.text, s.active.text]
    })(),
    ['切り干し大根はたっぷりの水につけてもどし、', '水気を絞ってざく切りにする'],
  )
  // 2026-08-09 便EMで危険側1件として潰した形を戻さない（待ちの前に別の作業が2つ埋まっている）
  eq(
    'ナビ同居: 待ちが節をまたぐ手順は分けない（「ささがき、細切りにし、水に5分さらして水気をきる」）',
    splitWaitFirstStep(t('ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります。')),
    undefined,
  )
  eq(
    'ナビ同居: 「煮立ったらアクを取る」は分けない（待ちではなく合図）',
    splitWaitFirstStep(t('大根と調味料をすべて加え、煮立ったら浮いてきたアクを取ります。')),
    undefined,
  )

  // ---- (4) 段取りの比較が一周しない（R3で34→50分に伸びた再発防止） ----
  // 「切る工程どうしだけ最優先」を比較の途中に置くと、3品以上で並べ替えの結果が一周し、
  // 着火（長い放置調理）を控えた品が後ろへ落ちる
  {
    const plan = buildCookTimeline([
      recipe(1, '主菜', ['鶏むね肉をそぎ切りにする。', '塩をふって10分ほどおく。', '魚焼きグリルで15分焼く。', 'パセリをふる。']),
      recipe(2, '副菜', ['ほうれん草を切る。', '電子レンジで3分加熱する。', 'ごまと和える。']),
      recipe(3, '汁物', ['鍋にだしを入れて15分煮る。', 'みそを溶く。'], { dishType: 'soup' }),
    ])
    const grill = plan.items.find((it) => it.text === '魚焼きグリルで15分焼く。')
    eq('ナビ着火: 長い放置調理が段取りの前半で始まる', grill.startMin * 2 <= plan.totalMinutes, true)
    // まな板の順序（野菜→肉・魚）は保つ
    const cuts = plan.items.filter((it) => /切りにする。|を切る。/.test(it.text)).map((it) => it.recipeTitle)
    eq('ナビ切る順: 野菜を先に、肉・魚を後に切る', cuts, ['副菜', '主菜'])
  }
}

// ---------- 火にかけたまま放置しない（2026-08-14 便GG・docs/72 第5段）
//
// 直した不具合（利用者・料理歴20年の原文。docs/72 第5段）:
//   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が
//     挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と
//     書いてあるのに。豆腐は崩れるしわかめは溶けます。#7の後に『火を止める』も『弱火にする』も
//     出てきません。」
//
// 真因: 「遅くともこの時刻までに手を戻す」締め切り（2026-08-09 便EH）は**待ちの工程からしか
// 生まれず、その品の次の手順を出した瞬間に消えていた**。鍋を火にかけたまま次の手順に進む
// 「沸いたら豆腐とわかめを入れる」のような工程は待ちではないので締め切りを持てず、
// さらに「温かい品の仕上げを後ろへ寄せる」（2026-08-13 便GB）が締め切りを見ずに
// 最後の「みそを溶いて火を止める」を18分後ろへ送っていた。
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  /** その品が火にかかったまま、次の工程まで何分空いたかの最大（測り方は audit-cook-navi.mjs のN7と同じ） */
  const heatIdle = (timeline, title) => {
    const list = timeline.items.filter((it) => it.recipeTitle === title)
    // 2026-08-15 便GM: **手でタネを扱う工程（こねる・形を作る）も火から下りている**を足した。
    // 本体（cookNavi.ts の HEAT_OFF_PATTERN）と同じ考え方だが、ここは答え合わせ用に別に持つ
    const off = /火を止め|火をとめ|火を消|火からおろ|火から下ろ|器に盛|皿に盛|椀に|取り出|ざるにあげ|ざるに上げ|湯を切|水にとる|冷ま|粗熱|こね|捏ね|成形|形を作|形を整え/
    let onHeat = false
    let since = 0
    let worst = 0
    for (const it of list) {
      if (onHeat) worst = Math.max(worst, it.startMin - since)
      if (off.test(it.text)) onHeat = false
      else if (stepAppliance(it.text) === 'stove') {
        onHeat = true
        since = it.endMin
      } else if (onHeat) since = Math.max(since, it.endMin)
    }
    return worst
  }

  // ---- (1) 利用者の3品そのもの。豆腐を入れてから火を止めるまでが空かない ----
  {
    const plan = buildCookTimeline([
      recipe(1, '鶏むね肉のみそマヨ焼き', [
        '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
        'その間に☆を全部混ぜ合わせておく。',
        'アルミホイルに①を並べ、②を上から塗る。',
        '魚焼きグリルで15分焼く。',
        '焼けたら乾燥パセリをふる。',
      ]),
      recipe(2, 'ほうれん草とにんじんのごま和え', [
        'ほうれん草は3〜4cmの長さに切り、にんじんは細切りにする。',
        '耐熱ボウルに入れてラップをかけ、電子レンジで3分加熱する。',
        '水気をしぼって◎を加えて和える。',
      ]),
      recipe(3, '豆腐とわかめのみそ汁', [
        '鍋に水とだしの素を入れて中火にかける。',
        '豆腐をさいの目に切る。',
        '沸いたら豆腐と乾燥わかめを入れる。',
        'みそを溶いて火を止める。',
      ], { dishType: 'soup' }),
    ])
    const add = plan.items.find((it) => it.text === '沸いたら豆腐と乾燥わかめを入れる。')
    const stop = plan.items.find((it) => it.text === 'みそを溶いて火を止める。')
    // 利用者の手組みは「豆腐を入れて味噌を溶くのは焼き上がりの3分前」＝3分。猶予も3分に合わせる
    eq('ナビ火の番: 豆腐を入れてから火を止めるまで3分以内', stop.startMin - add.endMin <= 3, true)
    eq('ナビ火の番: 3品どれも火にかけたまま放置しない', [
      heatIdle(plan, '鶏むね肉のみそマヨ焼き') <= 3,
      heatIdle(plan, 'ほうれん草とにんじんのごま和え') <= 3,
      heatIdle(plan, '豆腐とわかめのみそ汁') <= 3,
    ], [true, true, true])
  }

  // ---- (2) 「温かい品の仕上げを後ろへ寄せる」が、火にかけたままの品には効かない ----
  {
    const plan = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', '沸いたら豆腐とわかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
    ])
    eq('ナビ火の番: 火にかけたままの汁物の仕上げを後ろへ寄せない', heatIdle(plan, '豆腐とわかめのみそ汁') <= 3, true)
  }
  // 火から下りている品では、従来どおり仕上げを後ろへ寄せる（便GBの機能を殺していないこと）
  {
    const plan = buildCookTimeline([
      recipe(1, '煮物', ['大根を切る。', '鍋で20分煮る。', '火を止めて器に盛る。']),
      recipe(2, 'ゼリー', ['ゼラチンを溶かす。', '冷蔵庫で30分冷やし固める。', '器に盛る。']),
    ])
    const nimono = plan.items.filter((it) => it.recipeTitle === '煮物')
    eq('ナビ火の番: 火から下りている品は従来どおり（煮上がりの直後に火を止める）', nimono[nimono.length - 1].startMin - nimono[nimono.length - 2].endMin <= 3, true)
  }

  // ---- (3) 火の見分け（引き継ぎの規則） ----
  {
    const plan = buildCookTimeline([recipe(1, '汁物', ['鍋に水を入れて中火にかける。', '沸いたら具を入れる。', 'みそを溶いて火を止める。', '器に盛る。'], { dishType: 'soup' })])
    eq('ナビ火の番: 火を止めた後は締め切りを持たない', plan.items[plan.items.length - 1].text, '器に盛る。')
    eq('ナビ火の番: 1品だけでも段取りは成立する', plan.totalMinutes > 0, true)
  }
  // 火を下ろす語と火にかける語が同居したら、あとに来たほうが主役（位置ルール）
  eq(
    'ナビ火の番: 「水気を絞って鍋に戻し、5分煮る」は火にかける',
    stepHeatShift({ text: '水気を絞って鍋に戻し、5分煮る。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'on',
  )
  eq(
    'ナビ火の番: 「煮汁がなくなったら火を止め、そのまま冷ます」は火から下りる',
    stepHeatShift({ text: '煮汁がなくなったら火を止め、そのまま冷ます。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'off',
  )
  eq(
    'ナビ火の番: 火に触れない手順は直前の状態を引き継ぐ',
    stepHeatShift({ text: '沸いたら豆腐と乾燥わかめを入れる。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'keep',
  )

  // ---- (4) 最後の1口を、火にかけたままの鍋より先に取らせない ----
  // 実測（ホールドアウト標本）: 豚汁の炒めのあと、ほかの品の蒸し焼き15分に2口目を取られ、
  // フライパンが火にかかったまま15分中断していた
  {
    const plan = buildCookTimeline([
      recipe(1, '豚汁', ['野菜を切る。', '鍋にごま油を熱し、豚肉を炒める。', '野菜を加えて炒め合わせる。', 'だし汁を入れて12分煮る。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
      recipe(2, 'ホイル焼き', ['アルミホイルに包む。', 'フライパンに水を張り、ふたをして中火で15分蒸し焼きにする。', '器にのせる。']),
      recipe(3, 'ゆで鶏', ['鶏肉に塩をすり込んで20分おく。', '鍋に湯を沸かして鶏肉を入れ、火を止める。', 'ふたをして40分おく。', '鍋から取り出して薄切りにする。']),
    ])
    eq('ナビ火の番: 3品でも豚汁のフライパンを火にかけたまま中断しない', heatIdle(plan, '豚汁') <= 3, true)
  }

  // ---- (5) 手でタネを扱う工程は火の上ではできない（2026-08-15 便GM・docs/72 第5段の続き） ----
  //
  // 直した不具合: 手順本文に「火を止める」と書いていないレシピ（ハンバーグ）で、
  //   「玉ねぎをみじん切りにして炒める → ひき肉とまぜてこねる → 形を作る → 焼く」
  // の**最初の火が最後まで続いている**ことになっていた。実際にはボウルで肉をこねている間、
  // フライパンは火から下りている。そのため
  //   ①その品が最初から最後までコンロを1口ふさぎ続ける（ほかの品が火にかけられない）
  //   ②火にかかったままとみなされ、仕上げを揃える仕組みが一切効かない
  //   ③こねる・形を作るのあいだの空きを「火にかけたままの放置」に数えてしまう（監査で9件）
  // の3つが同時に起きていた。
  eq('ナビ火の番: 「炒める」は火にかける', stepHeatShift({ text: '玉ねぎをみじん切りにして炒める' }, DEFAULT_KITCHEN), 'on')
  eq(
    'ナビ火の番: 手でこねる工程は火が下りている（中身はボウルの中）',
    stepHeatShift({ text: 'ひき肉とまぜてこねる' }, DEFAULT_KITCHEN),
    'off',
  )
  eq('ナビ火の番: 形を作る工程も火が下りている', stepHeatShift({ text: '形を作る' }, DEFAULT_KITCHEN), 'off')
  eq(
    'ナビ火の番: 位置ルールは健在。「こねてからフライパンで焼く」は火にかける',
    stepHeatShift({ text: 'こねてからフライパンで両面を焼く' }, DEFAULT_KITCHEN),
    'on',
  )
  eq(
    'ナビ火の番: 鍋の中の「混ぜる」は火から下ろさない（取りこぼしを作らない）',
    stepHeatShift({ text: '鍋の中でときどき混ぜながら10分煮る' }, DEFAULT_KITCHEN),
    'on',
  )
  {
    // こねている間にコンロが空くので、ほかの品を待たせなくなる。
    // 見るのは**利用者に見えること**＝どの品も火にかけたまま猶予（3分）を超えて放置されないこと。
    // 直す前はカレーの鍋が5分放置されていた（ハンバーグが最後までコンロを1口占有していたため）
    const trio = buildCookTimeline([
      recipe(1, 'カレー', ['野菜を切る', '肉と野菜を炒める', '水を入れて煮る', 'ルーを入れる', 'ご飯にかける']),
      recipe(2, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
      recipe(3, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' }),
    ])
    eq(
      'ナビ火の番: 3品とも火にかけたまま猶予を超えて放置しない',
      ['カレー', 'ハンバーグ', 'みそ汁'].every((title) => heatIdle(trio, title) <= 3),
      true,
    )
    // 火を下ろせる工程を見分けたぶん段取りは短くなる。伸びていないことの歯止め（上限は保険）
    eq('ナビ火の番: 火の見分けを直しても段取りは伸びない', trio.totalMinutes <= 47, true)
  }
}

// ---------- 別の鍋に移る前に、火を止める／弱火にする（2026-08-15 便GO・docs/72 第7段）
//
// 利用者（料理歴20年）の原文:
//   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。…豆腐とわかめが10分前後ぐつぐつ
//     煮え続けます。**#7の後に「火を止める」も「弱火にする」も出てきません。**」
//
// 便GMの調べで、残っていた放置89件は**すべて「鍋が2つ同時に手を待っている」場面**と分かった。
// 手は1組なので片方は必ず待たされる＝並べ替えでは消えない。実際の台所では、別の鍋に移る前に
// 火を弱めるか止める。それを段取りの一手として出す（レシピ本文は書き換えない＝規約D）。
//
// ここで測るのは**利用者が確かめたいこと**:
//   ①その鍋の火をどうするかが段取りに出てくるか ②どの品の火かが読めるか
//   ③加熱が残っている品に「止める」と言わないか ④要らない場面で出てこないか
//   ⑤足したぶん段取りが伸びないか ⑥レシピ本文が変わらないか
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  // BudouXのゼロ幅スペースを外してから読む（禁じ手②。照合は語の有無で見て、完全一致では見ない）
  const plain = (text) => (text ?? '').replaceAll('​', '')
  /** ナビが足した「火の一手」 */
  const heatBreaks = (timeline, title) =>
    timeline.items.filter(
      (it) => it.recipeTitle === title && it.addedByNavi && /火を止め|弱火/.test(plain(it.text)),
    )
  const allHeatBreaks = (timeline) =>
    timeline.items.filter((it) => it.addedByNavi && /火を止め|弱火/.test(plain(it.text)))
  /** その品の「レシピに書いてある手順」だけ（ナビが足した工程を除く） */
  const ownSteps = (timeline, title) =>
    timeline.items.filter((it) => it.recipeTitle === title && !it.addedByNavi)
  /** その工程は火を必要とするか（工程の終わりに火が下りる書き方も、その間は火の上） */
  const needsFire = (item) =>
    stepHeatShift({ text: plain(item.text), minutes: item.minutes }, DEFAULT_KITCHEN) === 'on' ||
    heatOffAtEnd({ text: plain(item.text), minutes: item.minutes })

  /**
   * どの段取りでも守られていないといけないこと（組み合わせを変えても同じ形で見る）。
   *   ・「火を止める」と言うのは、その品の残りに火が要る工程が1つも無いときだけ
   *     （加熱の途中で止めたら料理が変わる）
   *   ・足すのは猶予（3分）を超える空きの場面だけ（出しすぎない）
   *   ・足した一手は時間を取らない＝全体の目安が伸びない
   */
  const checkRules = (label, timeline) => {
    const breaks = allHeatBreaks(timeline)
    const unsafeStop = breaks.filter((it) => {
      if (!/火を止め/.test(plain(it.text))) return false
      return ownSteps(timeline, it.recipeTitle).some(
        (x) => x.startMin >= it.startMin && needsFire(x),
      )
    })
    eq(`ナビ火の一手(${label}): 加熱が残っている品には止めると言わない`, unsafeStop.length, 0)
    const tooEager = breaks.filter((it) => {
      const list = ownSteps(timeline, it.recipeTitle)
      const prev = list.filter((x) => x.endMin <= it.startMin).pop()
      const next = list.find((x) => x.startMin >= it.startMin)
      return prev == null || next == null || next.startMin - prev.endMin <= 3
    })
    eq(`ナビ火の一手(${label}): 猶予に収まる空きには足さない`, tooEager.length, 0)
    eq(
      `ナビ火の一手(${label}): 足した一手は時間を取らない`,
      breaks.every((it) => it.activeMinutes === 0 && it.endMin === it.startMin),
      true,
    )
    const lastOwn = timeline.items
      .filter((it) => !it.addedByNavi)
      .reduce((max, it) => Math.max(max, it.endMin), 0)
    eq(`ナビ火の一手(${label}): 足しても全体の目安は伸びない`, timeline.totalMinutes, lastOwn)
  }

  // ---- (1) 鍋が2つ同時に手を待つ場面。火をどうするかが段取りに出る ----
  {
    const soup = recipe(1, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' })
    const egg = recipe(2, 'ゆで卵', [
      '鍋に水を入れて沸かす',
      '卵を入れる',
      '好みのかたさになるまでゆでる',
      '冷水につけて殻をむく',
    ])
    const stirFry = recipe(3, '野菜炒め', ['材料を切る', '肉を炒める', '野菜を入れて炒める', '塩こしょうで味をつける', '皿に盛る'])
    const plan = buildCookTimeline([soup, egg, stirFry])
    checkRules('3品', plan)

    const soupBreaks = heatBreaks(plan, 'みそ汁')
    eq('ナビ火の一手: 鍋が2つ手を待つ場面で、火をどうするかが段取りに出る', soupBreaks.length >= 1, true)
    const stop = soupBreaks[0]
    const own = ownSteps(plan, 'みそ汁')
    if (stop) {
      // ②どの品の火かが読める（複数の鍋が動く場面で出る一手なので、取り違えると別の料理が止まる）
      eq('ナビ火の一手: どの品の火かが本文で分かる', plain(stop.text).includes('みそ汁'), true)
      // ③残りが「みそを溶く」だけ＝火の仕事は終わっている → 止めてよい
      eq('ナビ火の一手: 加熱が残っていない品では止める', /火を止め/.test(plain(stop.text)), true)
      // 置く時刻は「その鍋から手が離れた瞬間」＝直前の工程の終わりで、次に戻る前
      const before = own.filter((it) => it.endMin <= stop.startMin).pop()
      const after = own.find((it) => it.startMin >= stop.startMin)
      eq('ナビ火の一手: 手が離れた瞬間に置く', stop.startMin, before?.endMin)
      eq('ナビ火の一手: 次にその品へ戻る前に置く', stop.startMin <= after?.startMin, true)
    }
    // ゆで上がった鍋も同じ（卵を入れっぱなしのゆで湯を放置しない）
    const eggBreaks = heatBreaks(plan, 'ゆで卵')
    eq('ナビ火の一手: ゆで上がった鍋にも火の一手が出る', eggBreaks.length >= 1, true)
    // ⑥レシピ本文は1文字も変わらない（規約D）
    eq('ナビ火の一手: レシピの手順は書き換えない', soup.steps.map((s) => s.text), ['水を沸かす', '具を入れる', 'みそを溶く'])
    eq(
      'ナビ火の一手: 段取りに載る本文もレシピのまま',
      own.every((it) => soup.steps.some((s) => s.text === plain(it.text))),
      true,
    )
  }

  // ---- (2) 1品だけの段取りには出てこない（鍋を放置する場面がそもそも無い） ----
  {
    const solo = buildCookTimeline([
      recipe(1, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' }),
    ])
    eq('ナビ火の一手: 1品だけなら足さない', allHeatBreaks(solo).length, 0)
  }

  // ---- (3) 加熱の途中では止めない（「煮汁が少なくなるまで煮る」型） ----
  // 工程全体としては火が下りる書き方（「煮汁がほとんどなくなったら火を止め、そのまま冷ます」）でも、
  // その工程の**間は火の上**にいる。先に止めると煮詰まらないまま冷ますことになる
  {
    const plan = buildCookTimeline([
      recipe(1, '切り干し大根の煮もの', [
        '鍋にごま油を熱し、切り干し大根とにんじんを炒める',
        'だし汁と調味料を加えてひと煮立ちさせ、落としぶたをして10分煮る',
        '煮汁がほとんどなくなったら火を止め、そのまま冷ます',
      ]),
      recipe(2, '豚肉と大根の煮もの', [
        '大根は半月切りにし、豚バラ肉は食べやすい長さに切る',
        '鍋に油を熱し、豚バラ肉を色が変わるまで炒める',
        '大根と水、調味料を加え、煮立ったらアクを取る',
        'ふたをずらしてのせ、弱めの中火で20分煮ます。',
        '大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。',
      ]),
      recipe(3, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
    ])
    checkRules('煮もの3品', plan)
    const breaks = heatBreaks(plan, '切り干し大根の煮もの')
    eq(
      'ナビ火の一手: 煮詰める工程が残っているうちは止めない',
      breaks.every((it) => !/火を止め/.test(plain(it.text))),
      true,
    )
    /**
     * 2026-08-15 便GR: **件数（>=1）は決め打ちしない**（禁じ手③）。
     * 「火を止め、そのまま10分おいて味を含ませます」を待ちとして数えるようになった結果、
     * この3品では鍋が放置される場面そのものが消え、一手を足す必要がなくなった
     * （docs/68 第7段が「N4を直せば自然に解ける」と書いていたとおり）。
     * **足さないことも正解**なので、見るのは利用者に起きることのほう＝
     * 「煮ている鍋が、火にかかったまま長く空かないこと」。
     * 足して弱火にするか、そもそも空けないかは、どちらでもよい。
     */
    const kiriboshi = ownSteps(plan, '切り干し大根の煮もの')
    const worstGap = kiriboshi.reduce(
      (max, it, i) => (i === 0 ? max : Math.max(max, it.startMin - kiriboshi[i - 1].endMin)),
      0,
    )
    eq('ナビ火の一手: 煮ている鍋を火にかけたまま長く空けない', worstGap <= 5, true)
  }

  // ---- (4) 手でこねる工程の手前には足さない（2026-08-15 便GMの見分けを殺していないこと） ----
  // 「玉ねぎを炒める → ひき肉とまぜてこねる」は、ボウルの中の作業に移った時点で火が下りている。
  // ここに火の一手を出すと、要らない工程で段取りが読みにくくなる
  {
    const plan = buildCookTimeline([
      recipe(1, 'ゆで卵', ['鍋に水を入れて沸かす', '卵を入れる', '好みのかたさになるまでゆでる', '冷水につけて殻をむく']),
      recipe(2, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
    ])
    checkRules('こねる2品', plan)
    eq('ナビ火の一手: 手でこねる工程の手前には足さない', heatBreaks(plan, 'ハンバーグ').length, 0)
  }
}

// ---------- 2026-08-08 便EG・オーナー実機フィードバック（3品を実際に作って見つかった段取りの不備）
// (2)漬け込みの前に切る工程を片付ける (3)ゆでる工程に「湯を沸かす」を差し込む
// (4)冷やす品は先に・熱々の品は最後に仕上げる ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps: steps.map((text) => ({ text })) })

  // ---- (3) 湯を沸かす。レシピ本文は1文字も変えず、段取りの表示にだけ足す ----
  const boil = buildPlanSteps([{ text: 'じゃがいもをゆでる' }, { text: 'つぶす' }])
  eq('ナビ湯沸かし: ゆでる手順の前に1つ足す', boil.length, 3)
  eq('ナビ湯沸かし: 足す位置はゆでる手順の直前', boil[0].step.text, '湯を沸かす')
  eq('ナビ湯沸かし: 足した工程には印が付く', boil[0].addedByNavi, true)
  eq('ナビ湯沸かし: 足した工程は既定5分', boil[0].step.minutes, BOIL_WATER_MINUTES)
  eq('ナビ湯沸かし: 元の手順は番号も本文もそのまま', [boil[1].stepNumber, boil[1].step.text], [1, 'じゃがいもをゆでる'])
  const boiled = buildCookTimeline([recipe(1, 'テスト', ['じゃがいもをゆでる'])]).items[0]
  eq('ナビ湯沸かし: 足した工程は待ち5分として段取りに載る', [boiled.kind, boiled.waitMinutes], ['wait', 5])
  eq('ナビ湯沸かし: 足した工程は手順番号を持たない', boiled.stepNumber, 0)
  eq('ナビ湯沸かし: 足した工程には「目安です」の注記を重ねない（印は1つ）', boiled.waitEstimated, false)
  // すでに湯を沸かす手順があるレシピには足さない
  // 2026-08-09 便EH: 同じ手順の中に湯沸かしが書かれている場合は「足さない」ではなく
  // 「その部分だけ前の工程に切り出す」に変わった（沸かし始めからの時間を段取りに乗せるため）
  eq(
    'ナビ湯沸かし: 「鍋に湯を沸かし…ゆでる」は湯沸かしだけを切り出す',
    buildPlanSteps([{ text: '鍋にたっぷりの湯を沸かし、ほうれん草をゆでる' }]).map((p) => p.step.text),
    ['鍋にたっぷりの湯を沸かす', 'ほうれん草をゆでる'],
  )
  eq(
    // 2026-08-13 便GD: 「鍋に水を入れて｜沸騰させる」は同居する手順として2工程に分かれるので、
    // 工程数ではなく**ナビが足した工程が無いこと**で見る（見たいのは湯沸かしの二重差し込み）
    'ナビ湯沸かし: 前の手順で沸かしていれば足さない',
    buildPlanSteps([{ text: '鍋に水を入れて沸騰させる' }, { text: '卵をゆでる' }]).filter(
      (p) => p.addedByNavi,
    ).length,
    0,
  )
  // ゆで終わったものを指す言い方は湯沸かしの合図にしない
  eq('ナビ湯沸かし: 「ゆで上がったら湯を切る」には足さない', buildPlanSteps([{ text: 'ゆで上がったら湯を切る' }]).length, 1)
  eq('ナビ湯沸かし: 「ゆで卵を切る」には足さない', buildPlanSteps([{ text: 'ゆで卵を切る' }]).length, 1)
  eq('ナビ湯沸かし: 「しょうゆで味をつける」には足さない', buildPlanSteps([{ text: 'しょうゆで味をつける' }]).length, 1)
  eq('ナビ湯沸かし: ゆでる工程が無ければ足さない', buildPlanSteps([{ text: '野菜を炒める' }]).length, 1)
  eq(
    'ナビ湯沸かし: 1レシピにつき1回まで',
    buildPlanSteps([{ text: 'にんじんをゆでる' }, { text: 'ブロッコリーをゆでる' }]).filter(
      (p) => p.addedByNavi,
    ).length,
    1,
  )

  // ---- (2) 漬け込み・寝かせの前に、着手できる切る工程を片付ける ----
  eq('ナビ漬け込み: 「冷蔵庫で30分漬け込む」は漬け込みの待ち', isSoakWait({ text: '鶏肉を入れて冷蔵庫で30分漬け込む。' }), true)
  eq('ナビ漬け込み: 「弱火で15分煮る」は漬け込みではない', isSoakWait({ text: '弱火で15分煮る。' }), false)
  const soak = buildCookTimeline([
    recipe(1, 'マリネ肉', [
      'ボウルにオリーブオイルとレモン汁を混ぜてマリネ液を作る。',
      '鶏肉を入れて冷蔵庫で30分漬け込む。',
      'フライパンで焼く。',
    ]),
    recipe(2, 'サラダ', ['きゅうりとトマトを切る。', 'ドレッシングで和える。']),
  ])
  const soakOrder = soak.items.map((it) => it.text)
  eq(
    // 2026-08-13 便GD: 「鶏肉を入れて｜冷蔵庫で30分漬け込む」が2工程に分かれた。
    // 見たいのは「切る工程が漬け込みより後ろに落ちないこと」なので、
    // 漬け込みを**仕掛ける一手**も切る工程より後ろに来ることまで含めて固定する
    // （生の肉を漬けたあとで野菜を切らせない＝2026-08-08 便EGのオーナー指示）
    'ナビ漬け込み: マリネ液→カット→漬け込み の順になる（切る工程が漬け込みより後ろに落ちない）',
    soakOrder.slice(0, 4),
    [
      'ボウルにオリーブオイルとレモン汁を混ぜてマリネ液を作る。',
      'きゅうりとトマトを切る。',
      '鶏肉を入れて',
      '冷蔵庫で30分漬け込む。',
    ],
  )
  // ふつうの待ち（煮る）は今までどおり最優先で仕掛ける＝切る工程で遅らせない
  const simmer = buildCookTimeline([
    recipe(1, '煮物', ['鍋に材料と水を入れて15分煮る。', '器に盛る。']),
    recipe(2, 'サラダ', ['きゅうりとトマトを切る。', 'ドレッシングで和える。']),
  ])
  // 2026-08-13 便GD: 「鍋に材料と水を入れて｜15分煮る」も2工程に分かれるが、
  // 煮込みは漬け込みと違って**切る工程より先**（仕掛ける一手も含めて）のまま
  eq(
    'ナビ漬け込み: 煮る待ちは切る工程より先に仕掛ける（従来どおり）',
    simmer.items.slice(0, 2).map((it) => it.text),
    ['鍋に材料と水を入れて', '15分煮る。'],
  )

  // ---- (4) 出したい温度の推定と、完成の順番 ----
  eq(
    'ナビ温度: 「冷蔵庫でよく冷やす」がある品は冷やす品',
    recipeServeTemp(recipe(1, '茶碗蒸し', ['卵液を作る。', '蒸す。', '粗熱を取り、冷蔵庫でよく冷やす。'])),
    'cold',
  )
  eq('ナビ温度: 料理名がサラダなら冷やす品', recipeServeTemp(recipe(1, '大根サラダ', ['大根を切る。', '和える。'])), 'cold')
  eq(
    'ナビ温度: 加熱で終わる品は熱々の品',
    recipeServeTemp(recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。'])),
    'hot',
  )
  eq(
    'ナビ温度: 最後の手順に加熱と盛り付けが同居していても熱々の品',
    recipeServeTemp(recipe(1, '豚肉のケチャップ炒め', ['下味だれを作る。', 'フライパンで豚肉を炒める。器に盛る。'])),
    'hot',
  )
  eq(
    'ナビ温度: どちらとも読めない品は現状維持（どちらでもない）',
    recipeServeTemp(recipe(1, 'コールスロー', ['キャベツを塩もみして水気を絞る。'])),
    'neutral',
  )
  // 熱々の品の仕上げは最後、冷やす品の仕上げは先に
  const serve = buildCookTimeline([
    recipe(1, 'オムライス', ['ご飯を炒める。', '卵を焼いて包む。']),
    recipe(2, '鶏の照り焼き', ['鶏肉に下味をつける。', '皮目から焼く。', '裏返して中まで焼く。']),
    recipe(3, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
  ])
  const lastOf = (title) =>
    serve.items.reduce((at, it, i) => (it.recipeTitle === title ? i : at), -1)
  eq('ナビ完成順: 冷やす品を先に仕上げる', lastOf('トマトサラダ') < lastOf('オムライス'), true)
  eq('ナビ完成順: 熱々の品どうしは、他の品の作業が終わってから仕上げる', lastOf('オムライス') > lastOf('トマトサラダ'), true)
  // 1品ずつ作る順番でも同じ（冷やす品→どちらでもない→熱々）
  const seq = buildCookPlan([
    recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。']),
    recipe(2, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
  ])
  eq('ナビ完成順: 1品ずつのときも冷やす品が先', seq.items[0].recipeTitle, 'トマトサラダ')
  eq('ナビ完成順: 1品ずつのときも熱々の品が最後', seq.items[seq.items.length - 1].recipeTitle, '野菜炒め')
}

// ---------- 2026-08-09 便EH・オーナー実機フィードバック
// (1)並行調理中に1品だけ「作った！」したときの選択の整合
// (2)待ち時間に詰め込みすぎない  (3)切る工程をレシピをまたいで隣接させる
// (4)手順に埋もれた「湯を沸かす」を段取り上で分離  (5)手作業の所要時間の見積り ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 1品だけ「作った！」したときに、覚えていた選択から確実に外れる ----
  // 起きていた不具合: 作った記録が付いた品は候補一覧から消えるので画面から外せず、
  // 段取りと「まとめて作った！」の対象にだけ残り続け、記録が二重に付いていた
  eq(
    'ナビ選択整合: 今日の献立から消えた品（作った記録が付いた品）は選択から外れる',
    reconcileSelectedIds([1, 2, 3], [1, 3]),
    [1, 3],
  )
  eq('ナビ選択整合: 残る品の順番（＝色の順）は変えない', reconcileSelectedIds([3, 1, 2], [1, 2, 3]), [3, 1, 2])
  eq('ナビ選択整合: 全部消えたら空になる', reconcileSelectedIds([1, 2], []), [])
  eq('ナビ選択整合: 変化が無ければそのまま', reconcileSelectedIds([1, 2], [1, 2, 5]), [1, 2])

  // ---- (5) 手作業の所要時間の見積り ----
  eq('ナビ所要: 手順に分数があればそれを使う', estimateActiveMinutes(t('鶏肉を焼く', 7)), {
    minutes: 7,
    estimated: false,
  })
  eq('ナビ所要: 短い手順の「3分炒める」は本文の3分をそのまま使う', estimateActiveMinutes(t('強火で3分炒める')), {
    minutes: 3,
    estimated: false,
  })
  eq('ナビ所要: 盛り付けは2分（一律4分をやめた）', estimateActiveMinutes(t('器に盛る')).minutes, 2)
  // 2026-08-09 便ES: 1動作＝3分にそろえ直した（複数動作の手順は節・文ごとに数えて足す）
  eq('ナビ所要: 切る工程は3分', estimateActiveMinutes(t('玉ねぎをみじん切りにする')).minutes, 3)
  eq(
    'ナビ所要: 1手順に複数の動作があれば足し上げる（炒め＋炒め合わせる）',
    estimateActiveMinutes(t('玉ねぎをしんなりするまで炒め、ご飯をほぐしながら炒め合わせる')).minutes,
    5,
  )
  eq(
    'ナビ所要: 3つの動作が並ぶ手順は、いちばん重い動作＋1分ずつ',
    estimateActiveMinutes(t('玉ねぎとにんじんを切り、フライパンで炒め、塩こしょうで味をととのえて器に盛る')).minutes,
    7,
  )
  eq(
    'ナビ所要: 材料の列挙（動作の無い読点）では増えない',
    estimateActiveMinutes(t('しょうゆ、みりん、酒、砂糖をボウルで混ぜる')).minutes,
    3,
  )
  eq('ナビ所要: 炒める工程は5分', estimateActiveMinutes(t('ひき肉を炒める')).minutes, 5)
  eq('ナビ所要: 「鍋に水を入れて火にかける」は準備動作で2分', estimateActiveMinutes(t('鍋に水とだしの素を入れて火にかける。')).minutes, 2)
  eq('ナビ所要: 見積りには印が付く', estimateActiveMinutes(t('器に盛る')).estimated, true)
  // 1段落まるごとが1手順になった取り込みレシピ（診断 docs/68 3-3）は、長さぶん上乗せする
  const paragraph = t(
    'なすを乱切りにして水に5分さらし、水気をふきます。フライパンにサラダ油を熱してなすを入れ、しんなりするまで3分炒めます。豚ひき肉を加えてほぐしながら炒め、色が変わったらしょうゆとみりんを加えて全体にからめます。汁気がなくなったら火を止めて器に盛ります。',
  )
  // 2026-08-09 便ES: 文字数ではなく「文・節ごとの動作の数」で数える形に変えた
  eq('ナビ所要: 1段落まるごとの手順を4分と数えない（動作の数だけ上乗せする）', estimateActiveMinutes(paragraph).minutes, 8)

  // ---- 待ちの「手を戻す締め切り」の厳しさ ----
  eq('ナビ締め切り: ゆでるは時間どおり（超過を許さない）', waitUrgency(t('にんじんを2分茹でる')), 'onTime')
  eq('ナビ締め切り: レンジは時間どおり', waitUrgency(t('600Wで3分加熱する')), 'onTime')
  eq('ナビ締め切り: 煮込みは少しの超過を許す', waitUrgency(t('弱火で15分煮る')), 'simmer')
  eq('ナビ締め切り: 漬け込みは超過を気にしない', waitUrgency(t('冷蔵庫で30分漬ける')), 'relaxed')
  eq('ナビ締め切り: 「火を止めてそのまま冷ます」は冷ますが主役', waitUrgency(t('煮汁がなくなったら火を止め、そのまま冷ます')), 'relaxed')
  eq('ナビ締め切り: ゆでるの猶予は0分', waitOverrunAllowance(t('にんじんを2分茹でる'), 2), 0)
  eq('ナビ締め切り: 15分煮るの猶予は3分（2割・上限5分）', waitOverrunAllowance(t('弱火で15分煮る'), 15), 3)
  eq('ナビ締め切り: 60分煮るの猶予は上限の5分', waitOverrunAllowance(t('弱火で60分煮込む'), 60), 5)
  eq('ナビ締め切り: 漬け込みの猶予は無制限', waitOverrunAllowance(t('冷蔵庫で30分漬ける'), 30), Infinity)

  // ---- (2) 待ち時間に詰め込みすぎない（オーナー実機報告の再現ケース） ----
  // 報告: 「茹で時間＝待ち時間4分想定の手順から、次の手順でザルにあげるまでに、
  // オムライスの鶏肉炒め＋玉ねぎしんなり＋ご飯ケチャップ＋皿に盛り付けまで入っている。無理。不可能」
  const packed = buildCookTimeline([
    recipe(1, 'にんじんのナムル', [
      t('にんじんは細切りにする。'),
      t('鍋にたっぷりの湯を沸かし、にんじんを4分茹でて冷水にとる。'),
      t('ごま油と塩で和える。'),
    ]),
    recipe(2, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('鶏肉を炒める。'),
      t('玉ねぎがしんなりするまで炒める。'),
      t('ご飯を入れてケチャップで炒める。'),
      t('卵を焼いて包み、皿に盛る。'),
    ]),
  ])
  const boilItem = packed.items.find((it) => it.text.startsWith('にんじんを4分'))
  eq('ナビ詰め込み: 4分のゆでが待ちとして載る', [boilItem.kind, boilItem.waitMinutes], ['wait', 4])
  // ゆで上がりまでに差し込まれた手作業の合計が、その4分を越えない
  const inserted = packed.items.filter(
    (it) => it.kind === 'active' && it.startMin >= boilItem.startMin && it.startMin < boilItem.endMin,
  )
  eq(
    'ナビ詰め込み: 4分の待ちに入れる手作業の合計は4分まで',
    inserted.reduce((a, it) => a + it.activeMinutes, 0) <= 4,
    true,
  )
  // ゆで上がったら、その品の次の手順が最優先で来る（ざるに上げるのを後回しにしない）
  const afterBoil = packed.items.find(
    (it) => it.recipeTitle === 'にんじんのナムル' && it.startMin >= boilItem.endMin,
  )
  eq('ナビ詰め込み: ゆで上がりの直後にその品の続きへ戻る', afterBoil.startMin, boilItem.endMin)
  // 3品での再現（司令部の検証e2eで赤になった組み合わせをそのまま単体に固定する）。
  // ゆで上がりまでに差し込まれた手作業の合計が、待ちの4分を超えないこと
  const packed3 = buildCookTimeline([
    recipe(1, 'ナムル', [
      t('にんじんは細切りにする。'),
      t('鍋にたっぷりの湯を沸かし、にんじんを4分茹でて冷水にとる。'),
      t('ごま油と塩で和える。'),
    ]),
    recipe(2, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('鶏肉を炒める。'),
      t('玉ねぎがしんなりするまで炒める。'),
      t('ご飯を入れてケチャップで炒める。', 3),
      t('卵を焼いて包み、皿に盛る。'),
    ]),
    recipe(3, '煮物', [t('大根を切る。'), t('鍋で15分煮る。'), t('器に盛る。')]),
  ])
  const boil3 = packed3.items.findIndex((it) => it.text.startsWith('にんじんを4分'))
  const back3 = packed3.items.findIndex(
    (it, i) => i > boil3 && it.recipeTitle === 'ナムル' && it.kind === 'active',
  )
  eq('ナビ詰め込み(3品): ゆで上がりのあとにその品の続きが来る', boil3 >= 0 && back3 > boil3, true)
  eq(
    'ナビ詰め込み(3品): 4分のゆで待ちに差し込む手作業の合計は4分まで',
    packed3.items
      .slice(boil3 + 1, back3)
      .filter((it) => it.kind === 'active')
      .reduce((a, it) => a + it.activeMinutes, 0) <= 4,
    true,
  )
  // 段取り全体が物理的に成り立つか（手作業どうしが重なっていない）も見ておく
  const activeSpans = packed3.items
    .filter((it) => it.kind === 'active')
    .sort((a, b) => a.startMin - b.startMin)
  eq(
    'ナビ詰め込み(3品): 手作業どうしが時間で重ならない（1人で作れる段取りになっている）',
    activeSpans.every((it, i) => i === 0 || it.startMin >= activeSpans[i - 1].endMin),
    true,
  )

  // 漬け込みの待ちには上限を掛けない（数分の遅れは料理に影響しないため）
  // 2026-08-13 便GB: 煮物に「アクを取り除く」を1つ足した。**この検査が見たいのは
  // 「漬け込みの待ちに手作業を詰められるか」**だが、元の標本で詰められる手作業は
  // 煮物の最後の手順（器に盛る）しかなく、それは便GBで入れた「温かい品の仕上げは
  // ほかの品の完成に合わせて後ろへ寄せる」の対象になり、詰め込みの可否とは別の理由で動く。
  // 途中の手作業を1つ足して、検査したい性質だけを見るようにした
  const soaked = buildCookTimeline([
    recipe(1, 'マリネ', [t('鶏肉をマリネ液に入れて冷蔵庫で30分漬ける。'), t('フライパンで焼く。')]),
    recipe(2, '煮物', [t('大根を切る。'), t('鍋で20分煮る。'), t('アクを取り除く。'), t('器に盛る。')]),
  ])
  eq(
    'ナビ詰め込み: 漬け込み30分の間は今までどおり他の作業を詰められる',
    soaked.items.filter((it) => it.kind === 'active' && it.startMin < 30).length >= 2,
    true,
  )

  // ---- (3) 切る工程をレシピをまたいで隣接させる ----
  // 報告: 「切る手順がまだ後回しになっている。全部レシピ分カットの流れが自然」
  const cutting = buildCookTimeline([
    recipe(1, 'マリネ野菜', [
      t('マリネ用の野菜を切る。'),
      t('マリネ液と和える。'),
      t('冷蔵庫で20分冷やす。'),
    ]),
    recipe(2, '鶏の照り焼き', [
      t('鶏もも肉に切り込みを入れる。'),
      t('下味だれを混ぜ合わせる。'),
      t('鶏もも肉にもみ込んで冷蔵庫で20分おく。'),
      t('皮目から焼く。'),
    ]),
    recipe(3, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('ご飯を炒める。'),
      t('卵を焼いて包む。'),
    ]),
  ])
  const cutPositions = cutting.items
    .map((it, i) => (/切る|切り込み/.test(it.text) ? i : -1))
    .filter((i) => i >= 0)
  eq('ナビ切る工程: 3品とも切る工程が段取りに載る', cutPositions.length, 3)
  eq(
    'ナビ切る工程: 3品の切る工程が途中で分断されずに並ぶ',
    cutPositions[cutPositions.length - 1] - cutPositions[0],
    cutPositions.length - 1,
  )

  // ---- (4) 手順に埋もれた「湯を沸かす」を段取り上で分離する ----
  // 報告: 「茹でるための湯沸かしが手順にない。もとのレシピでひとくくりにされているが、
  // 『沸かす』だけ分離できない?」
  eq('ナビ湯沸かし分離: 読点の直前の「沸かし」で切り、終止形にそろえる', splitBoilWaterClause('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。'), {
    boilWater: '鍋にたっぷりの湯を沸かす',
    rest: 'にんじんを2分茹でる。',
  })
  eq('ナビ湯沸かし分離: 「沸騰させて、」も切れる', splitBoilWaterClause('鍋に水を沸騰させて、卵をゆでる。').boilWater, '鍋に水を沸騰させる')
  eq(
    'ナビ湯沸かし分離: 別の作業が挟まる書き方は切らない（読める文にならないため）',
    splitBoilWaterClause('鍋に湯を沸かして塩を入れ、にんじんをゆでる。'),
    undefined,
  )
  eq(
    'ナビ湯沸かし分離: ゆでる作業が残らない書き方は切らない',
    splitBoilWaterClause('鍋にたっぷりの湯を沸かし、火を止める。'),
    undefined,
  )
  const separated = buildPlanSteps([
    t('にんじんは細切りにする。'),
    t('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。'),
  ])
  eq('ナビ湯沸かし分離: 手順が1つ増える', separated.length, 3)
  eq('ナビ湯沸かし分離: 湯沸かしが前の工程として入る', [separated[1].step.text, separated[1].step.minutes, separated[1].addedByNavi], ['鍋にたっぷりの湯を沸かす', BOIL_WATER_MINUTES, false || true])
  eq('ナビ湯沸かし分離: 残りの手順は元の手順番号を保つ', [separated[2].stepNumber, separated[2].step.text], [2, 'にんじんを2分茹でる。'])
  const separatedPlan = buildCookTimeline([
    recipe(1, 'ナムル', [t('にんじんは細切りにする。'), t('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。')]),
  ])
  eq(
    'ナビ湯沸かし分離: 沸かし始めからの5分が待ちとして段取りに乗る',
    separatedPlan.items.filter((it) => it.kind === 'wait').map((it) => it.waitMinutes),
    [5, 2],
  )
}

// ---------- 2026-08-11 便FL・実画面から見つかった段取りの実害3件 ----------
// (1)「半日〜一晩」が約20分の待ちとして見積りに入る
// (2)括弧内の任意の記述（レンジ加熱の時短）を、その手順の主たる動作（切る）と取り違える
// (3)湯沸かしを切り出すときに、同じ手順の前半にある手作業まで待ちに巻き込む
{
  const recipe = (id, title, steps) => ({ id, title, steps })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 半日・一晩・数時間のように、その日の調理では終わらない待ち ----
  const ajitama = t('保存袋にめんつゆと水、殻をむいた卵を入れて空気を抜き、冷蔵庫で半日〜一晩漬ける。')
  eq('ナビ長い待ち: 「半日〜一晩漬ける」は待ちのまま（手順自体は消さない）', classifyStep(ajitama), 'wait')
  eq('ナビ長い待ち: 「半日〜一晩」を長い待ちと見分ける', isLongRestStep(ajitama), true)
  eq('ナビ長い待ち: 「一晩寝かせる」も長い待ち', isLongRestStep(t('ふたをして冷蔵庫で一晩寝かせる。')), true)
  eq('ナビ長い待ち: 「数時間おく」も長い待ち', isLongRestStep(t('冷蔵庫で数時間おいて味をなじませる。')), true)
  eq('ナビ長い待ち: 「3時間以上冷やし固める」も長い待ち', isLongRestStep(t('冷凍庫で3時間以上、しっかり凍るまで冷やし固める。')), true)
  eq('ナビ長い待ち: 「20分煮る」は長い待ちではない', isLongRestStep(t('落としぶたをして20分煮る。')), false)
  eq('ナビ長い待ち: 「30分漬ける」は長い待ちではない', isLongRestStep(t('冷蔵庫で30分漬ける。')), false)
  const longRestPlan = buildCookTimeline([
    recipe(1, '味玉', [
      t('卵を沸騰したお湯で10分ゆでる。', 10),
      t('冷水にとり、粗熱が取れたら殻をむく。'),
      ajitama,
    ]),
  ])
  const longRestItem = longRestPlan.items[longRestPlan.items.length - 1]
  // 2026-08-13 便GD: 「保存袋に…空気を抜き、｜冷蔵庫で半日〜一晩漬ける。」は
  // 手作業と待ちが同居する手順として2工程に分かれる。**本文はどちらにも残る**（黙って消さない）
  eq(
    'ナビ長い待ち: 段取りには残す（黙って消さない）',
    longRestPlan.items
      .filter((it) => it.recipeId === 1 && it.splitOf === 3)
      .map((it) => it.text)
      .join(''),
    ajitama.text,
  )
  eq('ナビ長い待ち: 待ちの工程は「半日〜一晩漬ける」の側', longRestItem.text, '冷蔵庫で半日〜一晩漬ける。')
  eq('ナビ長い待ち: 長い待ちの印を立てる', longRestItem.longRest, true)
  eq('ナビ長い待ち: 待ち分数を段取りに数えない（約20分と言わない）', longRestItem.waitMinutes, 0)
  eq(
    // 2026-08-13 便GD: 同居する手作業（保存袋に入れて空気を抜く）は数えるようになったので、
    // 「長い待ちの手順を丸ごと外した段取り」とは比べられない。
    // 長い待ちの工程そのものが1分も伸ばしていないことを直接見る
    'ナビ長い待ち: 全体の目安時間に含めない',
    [
      longRestItem.endMin - longRestItem.startMin,
      longRestPlan.totalMinutes - longRestPlan.items[longRestPlan.items.length - 2].endMin,
    ],
    [0, 0],
  )
  eq('ナビ長い待ち: 「目安です」の断りは出さない（分数自体を出さないため）', longRestItem.waitEstimated, false)

  // ---- (2) 括弧内の「やってもやらなくてよい」記述を主たる動作と取り違えない ----
  const tunaCabbage = t('キャベツをせん切りにする（レンジ600Wで1分半ほど加熱すると時短になる）。')
  eq('ナビ任意括弧: 括弧内の時短レンジは待ちにしない（主たる動作は「切る」）', classifyStep(tunaCabbage), 'active')
  eq('ナビ任意括弧: 作業の種類も「切る」になる', stepCategory(tunaCabbage), 'cut')
  eq('ナビ任意括弧: 所要時間も切る工程の目安になる', estimateActiveMinutes(tunaCabbage).minutes, 3)
  eq(
    'ナビ任意括弧: 「好みで」の括弧も主たる動作と取り違えない',
    classifyStep(t('きゅうりを薄切りにする（好みで塩もみして10分おいてもよい）。')),
    'active',
  )
  // 任意の合図が無い括弧（言い換え・道具が無いときの代わり）は今までどおり読む＝本物の待ちを潰さない
  eq(
    'ナビ任意括弧: 「なければ〜」の言い換えは伏せない（トースター/オーブンの待ちを残す）',
    classifyStep(t('トースター(なければオーブンを200度に予熱して10分ほど焼く)でチーズがこんがり焼き色づくまで焼き、そのまま食卓に出す(取り分ける場合は器に盛る)。', 7)),
    'wait',
  )
  eq(
    'ナビ任意括弧: 「〜の場合は」の但し書きも伏せない（グリルの待ちを残す）',
    classifyStep(t('鮭を裏返し、中まで火が通るまで焼いて器に盛る（両面焼きグリルの場合は裏返さずそのまま両面を焼く）。', 4)),
    'wait',
  )

  // ---- (3) 湯沸かしの切り出しで、同じ手順にある手作業を待ちに巻き込まない ----
  eq(
    'ナビ湯沸かし分離: 前の文の手作業（洗う）は湯沸かしに巻き込まない',
    splitBoilWaterClause('ほうれん草は根元の土を流水でよく洗い落とす。鍋にたっぷりの湯を沸かし、根元から入れて1分ほどゆでる。'),
    {
      boilWater: '鍋にたっぷりの湯を沸かす',
      rest: 'ほうれん草は根元の土を流水でよく洗い落とす。根元から入れて1分ほどゆでる。',
    },
  )
  eq(
    'ナビ湯沸かし分離: 同じ文の前半にある手作業も巻き込まない',
    splitBoilWaterClause('ほうれん草を洗い、鍋にたっぷりの湯を沸かし、根元から入れてゆでる。'),
    {
      boilWater: '鍋にたっぷりの湯を沸かす',
      rest: 'ほうれん草を洗い、根元から入れてゆでる。',
    },
  )
  const spinachPlan = buildPlanSteps([
    t('ほうれん草は根元の土を流水でよく洗い落とす。鍋にたっぷりの湯を沸かし、根元から入れて1分ほどゆでる。'),
    t('冷水にとって水気を絞り、4cm長さに切る。'),
  ])
  eq('ナビ湯沸かし分離: 湯沸かしの工程に手作業の文が混ざらない', spinachPlan[0].step.text, '鍋にたっぷりの湯を沸かす')
  eq('ナビ湯沸かし分離: 巻き込まれていた手作業は次の工程に残る', spinachPlan[1].step.text, 'ほうれん草は根元の土を流水でよく洗い落とす。根元から入れて1分ほどゆでる。')
  eq('ナビ湯沸かし分離: 巻き込まれていた手作業は手作業のまま', classifyStep(spinachPlan[1].step), 'active')

  // ---- (4) 長い待ちで終わる品に「完成」を出さない（2026-08-11 便FL・司令部裁定） ----
  // 「今回の調理では仕上がらない」と「完成」が同じカードに並ぶと、画面が自分で矛盾を言う
  const longRestItems = longRestPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest }))
  eq('ナビ完成の印: 最後の手順が長い待ちの品は「完成」にしない', endsWithLongRest(longRestItems, 1), true)
  const normalPlan = buildCookTimeline([
    recipe(2, '煮もの', [t('大根を切る。'), t('鍋に入れて15分煮る。', 15), t('火を止めて器に盛る。')]),
  ])
  eq(
    'ナビ完成の印: 普通の最後の手順は今までどおり「完成」',
    endsWithLongRest(normalPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest })), 2),
    false,
  )
  // 長い待ちが**途中**にある品は、最後まで進めれば本当に出来上がるので「完成」のまま
  const midRestPlan = buildCookTimeline([
    recipe(3, 'ヨーグルトバーク', [
      t('ボウルにヨーグルトとはちみつを入れてよく混ぜる。'),
      t('ラップをかけずに冷凍庫で3時間以上、しっかり凍るまで冷やし固める。'),
      t('凍ったらオーブンシートごと取り出し、手やナイフで食べやすい大きさに割る。'),
    ]),
  ])
  eq(
    'ナビ完成の印: 長い待ちが途中にある品は「完成」のまま',
    endsWithLongRest(midRestPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest })), 3),
    false,
  )
  eq(
    'ナビ完成の印: その途中の手順は長い待ちとして数える（時間は0）',
    midRestPlan.items.filter((it) => it.longRest).map((it) => it.waitMinutes),
    [0],
  )
  eq('ナビ完成の印: 段取りに無い品には印を出さない', endsWithLongRest(longRestItems, 999), false)

  // ---- (5) 待ちブロックの「タイマーを始める」が出たり出なかったりする（2026-08-11 便FN・利用者テスト） ----
  // 実測: 段取りAは手順1にボタンあり・手順9「豆腐とわかめを入れて2分温める」は同じ見た目でボタン無し。
  // 段取りBは待ち5つのうちボタンは1つだけ。ボタンが無いと本文中の小さな「15分」を押すしかない
  eq(
    'FN-WAITBTN 手順に分数が書かれた待ちにはボタンを出す',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 15 }),
    true,
  )
  eq(
    'FN-WAITBTN 本文に同じ分数が書いてあってもボタンを消さない（本文の小さな文字は押せない）',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 2 }),
    true,
  )
  eq(
    'FN-WAITBTN 分数が書かれていない待ち（調理法から当てた分数）にもボタンを出す',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 8 }),
    true,
  )
  eq(
    'FN-WAITBTN 長い待ち（半日〜一晩）は分数を持たないので出さない',
    showsWaitTimerButton({ kind: 'wait', longRest: true, waitMinutes: 0 }),
    false,
  )
  eq(
    'FN-WAITBTN 手作業の手順には出さない',
    showsWaitTimerButton({ kind: 'active', longRest: false, waitMinutes: 0 }),
    false,
  )
  // 実データでの確認: 味噌汁の「豆腐とわかめを入れて2分温める」と、時間の書かれていない
  // 「ふたをして弱火で煮る」の両方にボタンが出る（同じ待ちブロックなら同じ操作ができる）
  const waitBtnPlan = buildCookTimeline([
    recipe(11, 'FN味噌汁', [
      t('鍋にだしを入れて火にかける。'),
      t('豆腐とわかめを入れて2分温める。', 2),
      t('火を止めてみそを溶き入れる。'),
    ]),
    recipe(12, 'FN煮物', [
      t('大根を切る。'),
      t('鍋に入れ、ふたをして弱火で煮る。'),
      t('器に盛る。'),
    ]),
  ])
  eq(
    'FN-WAITBTN 実データ: 待ちと判定された手順は全部ボタンが出る',
    waitBtnPlan.items.filter((it) => it.kind === 'wait').map((it) => showsWaitTimerButton(it)),
    waitBtnPlan.items.filter((it) => it.kind === 'wait').map(() => true),
  )
  eq(
    'FN-WAITBTN 実データ: 待ちの手順が2つ以上ある（判定の前提が崩れていないこと）',
    waitBtnPlan.items.filter((it) => it.kind === 'wait').length >= 2,
    true,
  )
}

// ---------- stepMinutesFromText(取り込み時に手順の「分」の欄を本文から埋める。
// 2026-08-08 便ED・docs/68 打ち手#2。URL取り込み・貼り付け取り込みは分数欄が必ず空になり、
// 本文に「20分煮る」と書いてあってもタイマーにも並行調理ナビにも使えていなかった。
// 入れるのは本文に書いてある時間の転記だけ＝機械の推測値は入れない) ----------
{
  eq('取り込み分数: 「鍋で15分煮る」→15', stepMinutesFromText('鍋で15分煮る'), 15)
  eq('取り込み分数: 「弱火で1時間半煮込む」→90', stepMinutesFromText('弱火で1時間半煮込む'), 90)
  eq('取り込み分数: 「600Wで3分加熱する」→3', stepMinutesFromText('600Wで3分加熱する'), 3)
  eq('取り込み分数: 複数あれば最長(10分煮て5分蒸らす→10)', stepMinutesFromText('10分煮て5分蒸らす'), 10)
  eq('取り込み分数: 秒だけ(30秒ゆでる)は入れない', stepMinutesFromText('30秒ゆでる'), undefined)
  eq('取り込み分数: 時間表記が無ければ入れない', stepMinutesFromText('材料を切る'), undefined)
  // 推測はしない: 待ち動詞があっても本文に時間が無ければ空のまま(ナビの既定分数は保存しない)
  eq('取り込み分数: 「じっくり煮込む」は空のまま(推測値を保存しない)', stepMinutesFromText('じっくり煮込む'), undefined)
  eq(
    '取り込み分数: 手順の並びぶんを返す',
    importedStepMinutes(['材料を切る', '鍋で15分煮る', '器に盛る']).join(','),
    ',15,',
  )
}

// ---------- buildCookPlan(並行調理ナビ: 並行できないときは正直にそう言い、1品ずつ作る順番を出す。
// 2026-08-08 便ED・docs/68 打ち手#4。短縮5%未満で「約◯分」とだけ出すと、縮んでいないのに
// 縮んだように見える) ----------
{
  // 待ちが1つも無い2品=並行の余地なし
  const flat = buildCookPlan([
    { id: 1, title: 'サラダ', steps: [{ text: 'レタスをちぎる' }, { text: 'ドレッシングと和える' }] },
    { id: 2, title: 'あえもの', steps: [{ text: 'きゅうりを切る' }, { text: 'ごまと和える' }] },
  ])
  eq('ナビ正直表示: 待ちが無い2品は1品ずつ作る順番になる', flat.mode, 'sequential')
  eq('ナビ正直表示: 短縮率は0%', Math.round(flat.gainPercent), 0)
  eq('ナビ正直表示: 1品ずつの合計と全体の目安が一致する', flat.totalMinutes, flat.sequentialMinutes)
  // 1品ずつ完結する順番になっている(レシピが途中で入れ替わらない)
  const titles = flat.items.map((it) => it.recipeTitle)
  eq('ナビ正直表示: 1品ずつ完結する並び', titles.join(','), 'サラダ,サラダ,あえもの,あえもの')

  // 加熱で終わる温かい品は最後にまわす
  const warm = buildCookPlan([
    { id: 1, title: '炒めもの', steps: [{ text: '野菜を切る' }, { text: 'フライパンで炒める' }] },
    { id: 2, title: 'あえもの', steps: [{ text: 'きゅうりを切る' }, { text: 'ごまと和える' }] },
  ])
  eq('ナビ正直表示: 並行の余地なし', warm.mode, 'sequential')
  eq('ナビ正直表示: 加熱で終わる品を最後に作る', warm.items[warm.items.length - 1].recipeTitle, '炒めもの')

  // 加熱のあとに味つけ・盛り付けが続く品も「温かい品」として最後にまわす（実機スクショで判明）
  const warm2 = buildCookPlan([
    {
      id: 1,
      title: '野菜炒め',
      steps: [{ text: '材料を切る' }, { text: '肉を炒める' }, { text: '塩こしょうで味をつける' }, { text: '皿に盛る' }],
    },
    { id: 2, title: 'ツナサラダ', steps: [{ text: 'レタスをちぎる' }, { text: 'ドレッシングと和える' }] },
  ])
  eq('ナビ正直表示: 「炒める→味をつける→盛る」も温かい品として最後', warm2.items[0].recipeTitle, 'ツナサラダ')
  eq(
    'ナビ正直表示: 温かい品は最後まで通しで作る',
    warm2.items[warm2.items.length - 1].recipeTitle,
    '野菜炒め',
  )

  // 待ちが活きる組み合わせは従来どおり並行の段取り
  const par = buildCookPlan([
    { id: 1, title: '煮物', steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  eq('ナビ正直表示: 待ちが活きる組み合わせは並行の段取りのまま', par.mode, 'parallel')
  eq('ナビ正直表示: 並行のときは短縮率が5%以上', par.gainPercent >= 5, true)
  eq(
    'ナビ正直表示: 並行の段取りは1品ずつの合計より短い',
    par.totalMinutes < par.sequentialMinutes,
    true,
  )

  // --- 便FN(2026-08-11 利用者テスト): 2つの分数の食い違いを画面で確かめられるようにする ---
  // 指摘「レシピ一覧の所要時間の合計35分に対して段取りは『1品ずつ作ると約41分』。別の3品では
  // 一覧の合計95分に対して80分。多く出たり少なく出たりするので、どちらを信じてよいか分からない」。
  // ナビの分数はレシピ欄の「調理時間」と数え方が違う（一致させられない）ので、代わりに
  // 品ごとの内訳を出して「合計＝この積み上げ」が読めるようにした
  eq(
    'FN-SOLO 品ごとに「1品だけなら約◯分」を持つ',
    par.recipes.every((r) => typeof r.soloMinutes === 'number' && r.soloMinutes > 0),
    true,
  )
  eq(
    'FN-SOLO 品ごとの目安の合計が「1品ずつ作ると約◯分」と一致する',
    par.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
    par.sequentialMinutes,
  )
  eq(
    'FN-SOLO 1品ずつ作る段取りのときも内訳を持つ',
    flat.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
    flat.sequentialMinutes,
  )
  // レシピ欄の「調理時間」(cookMinutes)には一切影響されない＝ナビは自分の数え方だけで数える。
  // ここが混ざると「どちらの数字なのか」がその場その場で変わり、指摘そのものが再発する
  const withCookMinutes = buildCookPlan([
    { id: 1, title: '煮物', cookMinutes: 999, steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', cookMinutes: 1, steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  eq(
    'FN-SOLO レシピ欄の「調理時間」はナビの分数に混ぜない',
    withCookMinutes.recipes.map((r) => r.soloMinutes),
    par.recipes.map((r) => r.soloMinutes),
  )
}

// ---------- buildCookTimeline / buildCookPlan(並行調理ナビ: 画面に出ている数字どうしを合わせる。
// 2026-08-12 便FU-1・利用者テスト(4回中4回再現)) ----------
//
// 指摘（原文）: 「鶏むね肉のみそマヨ焼き 1品だけなら約37分」なのに、同じ画面の手順表示は
// 待ち10分＋3分＋2分＋待ち15分＋4分＝34分。他2品は一致するのに鶏だけ+3分ずれる。
//
// 真因: 待ちを仕掛けた品には「遅くともこの時刻までに手を戻す」締め切り（attendUntil＝
// 待ち終了＋煮込みの猶予2割）が立つ。差し込む手作業がその締め切りを越えないかを見る判定で、
// **その締め切りを立てた本人の手順まで弾いていた**。鍋に戻る作業そのものを鍋の締め切りで
// 止めていたことになり、締め切りの時刻まで何もしない空白が段取りに入る。
// 空白は手順のどこにも出ないので、手順の分数を足した値とヘッダーの合計が食い違う。
//
// 正しいのは手順の側（34分）。空白は料理の都合ではなく計算の産物なので、空白を作らない。
{
  const s = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  /** その手順カードに出る分数（待ちは待ち分数・手作業は目安時間。長い待ちは出さない＝0） */
  const shownMinutes = (it) => (it.kind === 'wait' ? it.waitMinutes : it.activeMinutes)
  const sumShown = (items) => items.reduce((sum, it) => sum + shownMinutes(it), 0)

  const misoMayo = {
    id: 1,
    title: '鶏むね肉のみそマヨ焼き',
    servings: 2,
    ingredients: [],
    steps: [
      s('鶏むね肉に☆をもみ込んで10分おく。', 10),
      s('玉ねぎを薄切りにする。', 3),
      s('天板にアルミホイルを敷く。', 2),
      s('魚焼きグリルの弱火で12〜15分焼く。', 15),
      s('器に盛り、細ねぎを散らす。', 4),
    ],
  }
  const misoMayoTimeline = buildCookTimeline([misoMayo])
  eq(
    'FU-1 手順に出る分数の並びは指摘のとおり（10・3・2・15・4）',
    misoMayoTimeline.items.map(shownMinutes),
    [10, 3, 2, 15, 4],
  )
  eq(
    'FU-1 ヘッダーの合計は、画面に出ている各手順の分数の足し算と一致する',
    misoMayoTimeline.totalMinutes,
    sumShown(misoMayoTimeline.items),
  )
  eq('FU-1 みそマヨ焼きの合計は34分（+3分の空白が入らない）', misoMayoTimeline.totalMinutes, 34)

  // 締め切りのある待ち（ゆで・煮込み）を持つ品を何通りか通しても、空白が入らないことを見張る。
  // 1品だけの段取りには「他にやることが無いので待つ」以外の空白は起こりえない
  const soloShapes = [
    [s('鍋にたっぷりの湯を沸かし、にんじんを4分ゆでる。'), s('ざるにあげて水気をきる。'), s('ごま油とめんつゆで和え、器に盛る。')],
    [s('大根は一口大に切る。'), s('鍋に大根とだしを入れて中火で15分煮る。', 15), s('火を止めて10分おき、器に盛る。', 10)],
    [s('豚肉に下味をもみ込んで20分漬ける。', 20), s('フライパンで両面を3分ずつ焼く。'), s('たれを煮からめ、器に盛る。')],
    [s('じゃがいもを600Wのレンジで5分加熱する。', 5), s('熱いうちにつぶす。'), s('マヨネーズと和えて器に盛る。')],
  ]
  soloShapes.forEach((steps, i) => {
    const t = buildCookTimeline([{ id: 1, title: `型${i + 1}`, servings: 2, ingredients: [], steps }])
    eq(
      `FU-1 1品だけの段取りに空白の分数が入らない（型${i + 1}）`,
      t.totalMinutes,
      sumShown(t.items),
    )
  })

  // 3品を並行に組んでも、品ごとの「1品だけなら約◯分」は、その品の手順に出ている分数の合計と一致する
  // （画面の照らし合わせは、ヘッダーの数字と手順の数字を機械で突き合わせる形で固定する）
  const plan = buildCookPlan([
    misoMayo,
    {
      id: 2,
      title: '豆腐とわかめのみそ汁',
      servings: 2,
      ingredients: [],
      steps: [s('鍋にだし汁を入れて火にかける。', 2), s('豆腐とわかめを加えて2分煮る。', 2), s('みそを溶き入れ、火を止める。', 4)],
    },
    {
      id: 3,
      title: 'ほうれん草のごま和え',
      servings: 2,
      ingredients: [],
      steps: [s('ほうれん草を洗う。', 3), s('鍋にたっぷりの湯を沸かし、1分ゆでる。', 3), s('水気を絞って4cm長さに切る。', 3), s('すりごまと砂糖で和える。', 3)],
    },
  ])
  plan.recipes.forEach((r) => {
    eq(
      `FU-1 「1品だけなら約◯分」＝その品の手順に出ている分数の合計（${r.title}）`,
      r.soloMinutes,
      sumShown(plan.items.filter((it) => it.recipeId === r.id)),
    )
  })
  eq(
    'FU-1 「1品ずつ作ると約◯分」は品ごとの目安の足し算のまま',
    plan.sequentialMinutes,
    plan.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
  )
}

// ---------- stepCategory / buildCookTimeline(並行調理ナビ: 3品全体の流れを整える。
// 2026-08-08 便EB・オーナー要望「野菜を切る工程はまとめたい」「準備→加熱→仕上げの流れ」) ----------
{
  eq('ナビ流れ: 「玉ねぎをみじん切りにする」は切る', stepCategory({ text: '玉ねぎをみじん切りにする。' }), 'cut')
  eq('ナビ流れ: 「フライパンで焼く」は加熱', stepCategory({ text: 'フライパンで焼く。' }), 'heat')
  eq('ナビ流れ: 「器に盛る」は仕上げ', stepCategory({ text: '器に盛る。' }), 'finish')
  eq('ナビ流れ: 「ドレッシングと和える」は下ごしらえ', stepCategory({ text: 'ドレッシングと和える。' }), 'season')
  // 複数の動作が並ぶ手順は「最後に来る動作」がその手順の主役
  eq('ナビ流れ: 「切った野菜を炒める」は加熱(最後の動作)', stepCategory({ text: '切った野菜を炒める。' }), 'heat')
  eq('ナビ流れ: 「焼いた肉を切って器に盛る」は仕上げ', stepCategory({ text: '焼いた肉を切って器に盛る。' }), 'finish')

  // 待ちが無い2品でも、レシピ1品を丸ごと終えてから次に移る組み方にしない
  // (旧実装は残りの待ちが同点だとレシピの選択順で決めていたため、A全部→B全部になっていた)
  const flow = buildCookTimeline([
    { id: 1, title: 'A', steps: [{ text: '野菜を切る' }, { text: 'フライパンで焼く' }, { text: '器に盛る' }] },
    { id: 2, title: 'B', steps: [{ text: 'きゅうりを切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const texts = flow.items.map((it) => it.text)
  eq(
    'ナビ流れ: 「切る」工程が続けて並ぶ(バラけない)',
    texts.indexOf('きゅうりを切る') - texts.indexOf('野菜を切る'),
    1,
  )
  eq('ナビ流れ: 盛り付けは最後にまわる', texts[texts.length - 1], '器に盛る')
  // 加熱は、着手できる「切る」工程を片付けてから（段階の大枠が崩れない）。
  // 「ドレッシングと和える」より後になるとは限らない＝残り時間の長い品を先に進める基準が優先される
  eq(
    'ナビ流れ: 加熱は2品ぶんの「切る」を片付けたあと',
    texts.indexOf('フライパンで焼く') > texts.indexOf('きゅうりを切る'),
    true,
  )

  // 残り時間が長い品を先に進める(流れを整えるために全体の所要時間を延ばさない)
  const span = buildCookTimeline([
    { id: 1, title: '短い', steps: [{ text: 'レタスを切る' }, { text: '器に盛る' }] },
    { id: 2, title: '長い', steps: [{ text: '玉ねぎを切る' }, { text: '弱火で30分煮る', minutes: 30 }, { text: '器に盛る' }] },
  ])
  eq('ナビ流れ: 長い待ちが控えている品の下ごしらえを先に始める', span.items[0].recipeTitle, '長い')
  eq('ナビ流れ: 2番目には30分の待ちを仕掛ける', span.items[1].kind, 'wait')
}

// ---------- cutOrderRank / buildCookTimeline(並行調理ナビ: 切る順番は野菜→肉。
// 2026-08-08 便ED・オーナー指示「切る順番を野菜→肉、肉は最後に」＝まな板の交差汚染を避ける定石) ----------
{
  eq('ナビ切る順: 「玉ねぎを切る」は先に切る側', cutOrderRank({ text: '玉ねぎを薄切りにする' }), 0)
  eq('ナビ切る順: 「鶏もも肉を切る」は最後に切る側', cutOrderRank({ text: '鶏もも肉を一口大に切る' }), 1)
  eq('ナビ切る順: 「豚バラ肉を切る」は最後に切る側', cutOrderRank({ text: '豚バラ薄切り肉を食べやすく切る' }), 1)
  eq('ナビ切る順: 「鮭の切り身」は最後に切る側', cutOrderRank({ text: '鮭の切り身を半分に切る' }), 1)
  // 判断が付かない語は野菜あつかい（余計に並べ替えない）
  eq('ナビ切る順: 「材料を切る」は先に切る側(判断が付かないものは動かさない)', cutOrderRank({ text: '材料を切る' }), 0)

  // 2品の「切る」が同時に着手できるとき、野菜の方が先に来る
  const cutOrder = buildCookTimeline([
    { id: 1, title: '肉料理', steps: [{ text: '鶏もも肉を一口大に切る' }, { text: 'フライパンで焼く' }] },
    { id: 2, title: 'サラダ', steps: [{ text: 'レタスとトマトを切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const cutTexts = cutOrder.items.map((it) => it.text)
  eq(
    'ナビ切る順: 野菜を切る工程が肉を切る工程より先に来る',
    cutTexts.indexOf('レタスとトマトを切る') < cutTexts.indexOf('鶏もも肉を一口大に切る'),
    true,
  )
}

// ---------- parseCookNaviSession(並行調理ナビ: 作りかけの段取りを覚える。
// 2026-08-08 便ED・オーナー実機フィードバック①「画面移動するたびに段取りを作るところからやり直し」) ----------
{
  eq(
    'ナビ状態保持: 保存した内容をそのまま読み戻せる',
    JSON.stringify(parseCookNaviSession('{"selectedIds":[3,7],"showTimeline":true,"trialActive":false}')),
    JSON.stringify({ selectedIds: [3, 7], showTimeline: true, trialActive: false }),
  )
  eq('ナビ状態保持: 空の保存は覚えていない扱い', parseCookNaviSession(null), undefined)
  eq('ナビ状態保持: 壊れた保存は覚えていない扱い', parseCookNaviSession('{壊れ'), undefined)
  eq('ナビ状態保持: 選んだ品が無ければ覚えていない扱い', parseCookNaviSession('{"selectedIds":[]}'), undefined)
  eq(
    'ナビ状態保持: 数字でないIDは捨てる',
    JSON.stringify(parseCookNaviSession('{"selectedIds":[1,"x",null,2]}')?.selectedIds),
    JSON.stringify([1, 2]),
  )
  eq(
    'ナビ状態保持: お試し中かどうかも覚える(戻るたびに回数を失わないため)',
    parseCookNaviSession('{"selectedIds":[1],"trialActive":true}')?.trialActive,
    true,
  )
}

// ---------- stepIngredientAmounts / recipeIngredientList(並行調理ナビ: 段取り中に分量が見える。
// 2026-08-08 便EB・オーナー実機報告「ナビを選択すると、分量が消えるので計量できない」) ----------
{
  // 肉巻きおにぎり(src/sets/pack07.ts)の実データ
  const nikumakiIngredients = [
    { name: '豚バラ薄切り肉', amount: '200', unit: 'g' },
    { name: 'ご飯', amount: '2', unit: '杯分' },
    { name: '片栗粉', amount: '1', unit: '大さじ' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
    { name: 'みりん', amount: '2', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '大さじ' },
    { name: 'サラダ油', amount: '適量', unit: '' },
  ]
  const label = (list) => list.map((x) => `${x.name} ${x.amount}`.trim())
  eq(
    'ナビ材料: 手順に出てくる材料だけを分量つきで拾う',
    label(
      stepIngredientAmounts('豚バラ肉をご飯に巻きつけ、片栗粉を薄くまぶす。', nikumakiIngredients, 2, 2),
    ),
    ['豚バラ薄切り肉 200g', 'ご飯 2杯分', '片栗粉 大さじ1'],
  )
  eq(
    'ナビ材料: 出てこない材料は返さない',
    label(stepIngredientAmounts('転がしながら全体に焼き色をつける。', nikumakiIngredients, 2, 2)),
    [],
  )
  eq(
    'ナビ材料: 人数を倍にすると分量も倍になる(詳細画面と同じ換算)',
    label(stepIngredientAmounts('豚バラ肉を巻きつける。', nikumakiIngredients, 2, 4)),
    ['豚バラ薄切り肉 400g'],
  )
  eq(
    'ナビ材料: 「適量」はそのまま出す',
    label(stepIngredientAmounts('フライパンにサラダ油を中火で熱する。', nikumakiIngredients, 2, 2)),
    ['サラダ油 適量'],
  )

  // 誤検出は出さない方に倒す(嘘の分量を出さない)
  const water = [
    { name: '水', amount: '300', unit: 'ml' },
    { name: '塩', amount: '少々', unit: '' },
  ]
  eq('ナビ材料: 「水を入れる」は水を拾う', label(stepIngredientAmounts('鍋に水を入れる。', water, 2, 2)), ['水 300ml'])
  eq('ナビ材料: 「水気を絞る」の水は拾わない', label(stepIngredientAmounts('水気をしっかり絞る。', water, 2, 2)), [])
  eq('ナビ材料: 「流水で洗う」の水は拾わない', label(stepIngredientAmounts('根元を流水でよく洗う。', water, 2, 2)), [])
  eq('ナビ材料: 「冷水にとる」の水は拾わない', label(stepIngredientAmounts('ざるにあげて冷水にとる。', water, 2, 2)), [])
  eq('ナビ材料: 「塩ゆで」の塩は拾わない', label(stepIngredientAmounts('塩ゆでする。', water, 2, 2)), [])
  eq('ナビ材料: 「塩をふる」の塩は拾う', label(stepIngredientAmounts('塩をふる。', water, 2, 2)), ['塩 少々'])
  // 同じ表記に材料欄の2行が当たるとき(2026-08-08 便EG・オーナー実機報告
  // 「下線は出るのに分量が出ない材料がある」)。黙って出さないと下線だけが浮くので、
  // 手順文に書かれた用途で絞り、決まらなければ括弧の注記つきで両方出す
  const katakuriko = [
    { name: '片栗粉(肉だね用)', amount: '1', unit: '大さじ' },
    { name: '片栗粉(あん用)', amount: '2', unit: '小さじ' },
  ]
  eq(
    'ナビ材料: 同名の材料が2行あり用途が読めないときは両方出す(下線だけ浮かせない)',
    label(stepIngredientAmounts('片栗粉を加えて混ぜる。', katakuriko, 2, 2)),
    ['片栗粉(肉だね用) 大さじ1', '片栗粉(あん用) 小さじ2'],
  )
  eq(
    'ナビ材料: 手順文に用途が書いてあれば1行に絞る(あん用)',
    label(stepIngredientAmounts('別の器に酢と片栗粉(あん用)を混ぜる。', katakuriko, 2, 2)),
    ['片栗粉(あん用) 小さじ2'],
  )
  // オーナー実機の例: 「オリーブオイル(下味用)」「オリーブオイル(焼く用)」
  const oliveOil = [
    { name: 'オリーブオイル(下味用)', amount: '1', unit: '大さじ' },
    { name: 'オリーブオイル(焼く用)', amount: '適量', unit: '' },
  ]
  eq(
    'ナビ材料: 「下味だれを作る」手順では下味用のオリーブオイルだけ出す',
    label(stepIngredientAmounts('袋にオリーブオイル・塩・こしょうを入れて下味だれを作る。', oliveOil, 2, 2)),
    ['オリーブオイル(下味用) 大さじ1'],
  )
  eq(
    'ナビ材料: 「焼く」手順では焼く用のオリーブオイルだけ出す',
    label(stepIngredientAmounts('フライパンにオリーブオイルを熱し、皮目を下にして焼く。', oliveOil, 2, 2)),
    ['オリーブオイル(焼く用) 適量'],
  )
  // 接頭語つきの材料名(2026-08-08 便EG): 材料欄「乾燥ハーブ(…)」・本文「ハーブ」でも拾う
  eq(
    'ナビ材料: 「乾燥ハーブ(オレガノ)」は本文の「ハーブ」で拾う',
    label(
      stepIngredientAmounts(
        '袋にハーブを入れて混ぜる。',
        [{ name: '乾燥ハーブ(オレガノまたはローズマリー)', amount: '1/2', unit: '小さじ' }],
        2,
        2,
      ),
    ),
    ['乾燥ハーブ(オレガノまたはローズマリー) 小さじ1/2'],
  )
  eq(
    'ナビ材料: 「乾燥わかめ」は本文の「わかめ」で拾う',
    label(
      stepIngredientAmounts('豆腐とわかめを加える。', [{ name: '乾燥わかめ', amount: '2', unit: 'g' }], 2, 2),
    ),
    ['乾燥わかめ 2g'],
  )
  // 下線と分量は必ず一致する(片方だけ当たる状態を作らない)。
  // 下線の根拠 findIngredientMatches をそのまま分量の根拠にしているかを、代表例で固定する
  {
    const names = naviIngredientNames(water)
    const cases = [
      '鍋に水を入れる。',
      '水気をしっかり絞る。',
      'ざるにあげて冷水にとる。',
      '水溶き片栗粉を回し入れる。',
      '塩ゆでする。',
      '塩をふる。',
    ]
    const mismatch = cases.filter((text) => {
      const underlined = naviIngredientMatches(text, names).length > 0
      const shown = stepIngredientAmounts(text, water, 2, 2).length > 0
      return underlined !== shown
    })
    eq('ナビ材料: 下線が引かれた語には必ず分量が出る(不一致0件)', mismatch, [])
  }
  // 「卵液」の卵など、既存の除外規則(ingredientSpans)はそのまま効く
  eq(
    'ナビ材料: 「卵液」の卵は拾わない(既存の除外規則を流用)',
    label(stepIngredientAmounts('卵液を流し入れる。', [{ name: '卵', amount: '2', unit: '個' }], 2, 2)),
    [],
  )

  // ③レシピごとの材料一覧(あらかじめ計量したい人向け。人数換算込みで全材料を返す)
  eq(
    'ナビ材料一覧: 全材料を材料欄の並びのまま分量つきで返す',
    label(recipeIngredientList(nikumakiIngredients, 2, 2)),
    [
      '豚バラ薄切り肉 200g',
      'ご飯 2杯分',
      '片栗粉 大さじ1',
      'しょうゆ 大さじ2',
      'みりん 大さじ2',
      '砂糖 大さじ1',
      'サラダ油 適量',
    ],
  )
  eq(
    'ナビ材料一覧: 4人分にすると分量が倍になる',
    label(recipeIngredientList(nikumakiIngredients, 2, 4)),
    [
      '豚バラ薄切り肉 400g',
      'ご飯 4杯分',
      '片栗粉 大さじ2',
      'しょうゆ 大さじ4',
      'みりん 大さじ4',
      '砂糖 大さじ2',
      'サラダ油 適量',
    ],
  )

  // --- 便FU-2(2026-08-12 利用者テスト): 合わせ調味料が段取り・調理中モードに出ない ---
  // 指摘（原文）:「☆の4つ・◎の4つを手で色付けしました（計8タップ）。ところが段取りの手順
  // 「その間に☆を全部混ぜ合わせておく。」には材料が1つも出ません。◎の手順も「しょうゆ 大さじ1」
  // しか出ず、すりごま・砂糖・だしの素は出ません」
  //
  // 画面の案内が「色分けしておくと調理中モードでまとめて表示されます」と約束しているので、
  // ①組の材料が1つでも当たったらその組を全部出す ②手順文の組の印（☆等）でも組を出す
  const misoMayoIngredients = [
    { name: '鶏むね肉', amount: '300', unit: 'g' },
    { name: 'みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: 'マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: '砂糖', amount: '1', unit: '小さじ', seasoningGroup: 1 },
    { name: '酒', amount: '1', unit: '小さじ', seasoningGroup: 1 },
  ]
  eq(
    'FU-2 組の材料が1つでも当たったら、その組を全部出す',
    label(stepIngredientAmounts('みそを混ぜ合わせる。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  eq(
    'FU-2 組の材料は材料欄の並び順で出す（当たった1つが先頭に来ない）',
    label(stepIngredientAmounts('酒をふる。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  eq(
    'FU-2 組に入っていない材料は今までどおり手順に出てくるものだけ',
    label(stepIngredientAmounts('鶏むね肉はそぎ切りにする。', misoMayoIngredients, 2, 2)),
    ['鶏むね肉 300g'],
  )
  eq(
    'FU-2 組がその手順に出てこなければ何も出さない（関係ない手順に持ち込まない）',
    label(stepIngredientAmounts('天板にアルミホイルを敷く。', misoMayoIngredients, 2, 2)),
    [],
  )
  // 組が1つだけのレシピでは、手順文の印（☆）が指す先はその組しかない＝推測にならない
  eq(
    'FU-2 「☆を全部混ぜ合わせておく」でも、組が1つだけならその組を出す',
    label(stepIngredientAmounts('その間に☆を全部混ぜ合わせておく。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  // 材料名の先頭に印が残っているレシピは、組が複数あっても印で見分けられる
  const markedIngredients = [
    { name: '鶏むね肉', amount: '300', unit: 'g' },
    { name: '☆みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: '☆マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: '◎しょうゆ', amount: '1', unit: '大さじ', seasoningGroup: 2 },
    { name: '◎すりごま', amount: '1', unit: '大さじ', seasoningGroup: 2 },
  ]
  eq(
    'FU-2 材料名に印が残っていれば、組が2つでも印で見分けて出す（☆）',
    label(stepIngredientAmounts('その間に☆を全部混ぜ合わせておく。', markedIngredients, 2, 2)),
    ['☆みそ 大さじ1', '☆マヨネーズ 大さじ2'],
  )
  eq(
    'FU-2 材料名に印が残っていれば、組が2つでも印で見分けて出す（◎）',
    label(stepIngredientAmounts('◎を混ぜて回しかける。', markedIngredients, 2, 2)),
    ['◎しょうゆ 大さじ1', '◎すりごま 大さじ1'],
  )
  // 印が材料名に無く、組が2つ以上あるときは、どの組かを機械が決められない＝出さない（嘘を出さない）
  const twoGroups = [
    { name: 'みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: 'マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: 'しょうゆ', amount: '1', unit: '大さじ', seasoningGroup: 2 },
    { name: 'すりごま', amount: '1', unit: '大さじ', seasoningGroup: 2 },
  ]
  eq(
    'FU-2 印の指す先が決められないときは出さない（当てずっぽうの組を出さない）',
    label(stepIngredientAmounts('☆を全部混ぜ合わせておく。', twoGroups, 2, 2)),
    [],
  )
  eq(
    'FU-2 印が無い手順では、組が1つでも勝手に出さない',
    label(stepIngredientAmounts('全体をよく混ぜる。', misoMayoIngredients, 2, 2)),
    [],
  )
  eq(
    'FU-2 出した材料には組の番号が付いている（画面の線の引き分けに使う）',
    stepIngredientAmounts('みそを混ぜ合わせる。', misoMayoIngredients, 2, 2).map((x) => x.seasoningGroup),
    [1, 1, 1, 1],
  )
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

  // (6) 「基本レシピを入れ直す」の確認文(2026-08-15 便GP・規約F)。
  // 旧文は「自分で編集した基本レシピは上書きされます。よろしいですか？」で、実際には
  // **料理名を変えた品が作った記録・写真ごと削除される**ことを伝えていなかった(説明が事実と違う)。
  // planStarterReloadは純関数なので、押す前に予行して件数で言い切れる
  {
    const baseDef = starterDefs[0]
    const asRecipe = (def, id, extra = {}) => ({
      ...def,
      id,
      isStarter: true,
      sourceSetId: undefined,
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 1,
      updatedAt: 1,
      ...extra,
    })
    // 料理名を自分で変えた基本レシピ(作った記録2件・レシピ写真1枚・記録の写真1枚つき)
    const renamed = asRecipe(baseDef, 2, {
      title: `${baseDef.title}（うちの味）`,
      photo: 'FAKE_PHOTO_BLOB',
      isFavorite: true,
      cookedLogs: [{ date: '2026-08-01' }, { date: '2026-08-02', photo: 'FAKE_PHOTO_BLOB' }],
    })
    const kept = asRecipe(baseDef, 1)
    const own = {
      id: 3,
      title: '自分で登録した品',
      isStarter: false,
      sourceSetId: undefined,
      isFavorite: false,
      cookedLogs: [],
      searchWords: [],
      createdAt: 1,
      updatedAt: 1,
    }
    const { plan, existingStarters } = planStarterReloadFor([kept, renamed, own], [], 9000)
    const impact = countStarterReloadImpact(existingStarters, plan)
    eq('STARTER-RELOAD 料理名を変えた基本レシピは消える(上書きではない)', impact.removed, 1)
    eq('STARTER-RELOAD 消える品に付いた作った記録も数える', impact.removedCookedLogs, 2)
    // 2026-08-16 便GZ: 作った記録とその写真は品と一緒には消えず残るので、消える写真は
    // レシピに登録した写真だけになった（記録の写真は「残るもの」側で数える）
    eq('STARTER-RELOAD 記録の写真は残る側で数える', impact.removedCookedPhotos, 1)
    eq('STARTER-RELOAD 消えるのはレシピに登録した写真だけ', impact.removedRecipePhotos, 1)
    eq('STARTER-RELOAD 料理名が一致する品は残る側で数える', impact.kept, 1)
    eq('STARTER-RELOAD 自分で登録したレシピは入れ直しの対象にしない', existingStarters.length, 2)
    eq(
      'STARTER-RELOAD 端末に無い基本レシピは追加される(自分で消した品も含む)',
      impact.added,
      starterDefs.length - 1,
    )

    const text = confirmContentText(buildStarterReloadConfirm(impact))
    eq(
      'STARTER-RELOAD 確認文は消える品数を件数で言う',
      text.includes(ja.settings.starterReloadConfirmRemoved.replace('{d}', String(impact.removed))),
      true,
    )
    eq(
      'STARTER-RELOAD 確認文は消えるレシピの写真の枚数も言う',
      text.includes(
        ja.settings.starterReloadConfirmRemovedData.replace(
          '{p}',
          String(impact.removedRecipePhotos),
        ),
      ),
      true,
    )
    // 0のものを並べない(「写真0枚も消えます」＝消えないものを数える文にしない)
    {
      const noPhoto = confirmContentText(
        buildStarterReloadConfirm({ ...impact, removedRecipePhotos: 0 }),
      )
      eq(
        'STARTER-RELOAD レシピの写真が無い品なら写真の件数は書かない',
        /レシピの写真\d+枚/.test(noPhoto),
        false,
      )
      // 2026-08-16 便GZ: 記録は残るので、記録の話は「残るもの」側に出る
      eq(
        'STARTER-RELOAD レシピの写真が無くても、残る記録の件数は書く',
        /作った記録2件（うち写真1枚）も残り/.test(noPhoto),
        true,
      )
      const noUserData = confirmContentText(
        buildStarterReloadConfirm({ ...impact, removedCookedLogs: 0, removedRecipePhotos: 0 }),
      )
      eq(
        'STARTER-RELOAD 記録も写真も無ければ、その1行ごと出さない',
        /も消えます/.test(noUserData),
        false,
      )
    }
    eq('STARTER-RELOAD 確認文は何が残るかも書く(規約F)', text.includes(ja.settings.starterReloadConfirmStays), true)
    eq('STARTER-RELOAD 確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(text), false)
    eq('STARTER-RELOAD 消える品を「上書き」と言い換えていない', /上書き/.test(text), false)

    // 消える品が0件のときに削除の話を書くと、消えないのに不安にさせる。件数で出し分ける
    const noneImpact = countStarterReloadImpact([kept], planStarterReloadFor([kept], [], 9000).plan)
    const noneText = confirmContentText(buildStarterReloadConfirm(noneImpact))
    eq('STARTER-RELOAD 料理名を変えていなければ消える品は0件', noneImpact.removed, 0)
    eq('STARTER-RELOAD 消える品が0件のときは削除の話を書かない', /削除|消え/.test(noneText), false)
    eq(
      'STARTER-RELOAD 消える品が0件でも、書き替えが元に戻ることは書く',
      noneText.includes(ja.settings.starterReloadConfirm.replace('{k}', String(noneImpact.kept))),
      true,
    )
    eq('STARTER-RELOAD 消える品が0件でも、何が残るかは書く', noneText.includes(ja.settings.starterReloadConfirmStays), true)
    eq('STARTER-RELOAD 件数の差し込み跡が残っていない', /\{[a-z]\}/.test(`${text}${noneText}`), false)

    // 画面の配線: 押す前に予行してから確認文を出す(ja.settings.starterReloadConfirmを直に出さない)
    const settingsSrc = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/SettingsPage.tsx'),
      'utf-8',
    )
    eq(
      'STARTER-RELOAD 画面は押す前に予行して件数入りの確認文を出す',
      /previewStarterReload\(\)[\s\S]{0,200}await confirm\(buildStarterReloadConfirm\(/.test(
        settingsSrc,
      ),
      true,
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
  eq(
    // 2026-08-19 便HU・⑯: 顔ぶれが増えても書き写しが古くならないよう、
    // 「顔ぶれの全項目がnull」という規則で見る
    '栄養並び替え値: 名寄せできないレシピは顔ぶれの全項目がnull(算出不能)',
    NUTRITION_DISPLAY_KEYS.length > 0 &&
      NUTRITION_DISPLAY_KEYS.every((key) => values.get(3)[key] === null),
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

  eq('isNutrientSortOption: kcalは栄養並び替え', isNutrientSortOption('kcal'), true)
  eq('isNutrientSortOption: updatedは栄養並び替えでない', isNutrientSortOption('updated'), false)

  // ---- ⑯ 並び替えの顔ぶれ＝栄養表示の顔ぶれ(2026-08-19 便HU・オーナー
  // 「ラインナップをいつもの栄養価にして。糖質は炭水化物？鉄も入ってない」) ----
  // 顔ぶれを書き写して並べると、項目が増えたときに書き写しの方が古くなって当たらなくなる。
  // ここでは「栄養表示に出している項目の集合」と「並び替えで選べる項目の集合」が
  // 一致することだけを規則で見る(項目が増えても自動で見張りの対象に入る)。
  {
    const sortFields = NUTRIENT_SORT_OPTIONS.map((option) => NUTRIENT_SORT_FIELD[option])
    // 集合が空のまま「一致した」と合格に倒れないよう、先に数え上げが効いていることを確かめる
    eq(
      '⑯ 顔ぶれの照合が空振りしていない(並び替え・表示とも項目がある)',
      sortFields.length > 0 && NUTRITION_DISPLAY_KEYS.length > 0,
      true,
    )
    eq('⑯ 並び替えの顔ぶれに同じ項目が2回出ていない', sortFields.length, new Set(sortFields).size)
    eq(
      '⑯ 並び替えで選べる栄養の顔ぶれが栄養表示の顔ぶれと同じ',
      [...sortFields].sort(),
      [...NUTRITION_DISPLAY_KEYS].sort(),
    )
    // 名前も表示と同じにする(「糖質」と書いてあるのに中身は炭水化物=CHOCDF-、を二度と作らない)
    const labelMismatch = NUTRIENT_SORT_OPTIONS.filter(
      (option) => NUTRIENT_SORT_LABELS[option] !== nutritionLabelFor(NUTRIENT_SORT_FIELD[option]),
    ).map(
      (option) =>
        `${option}: 並び替え「${NUTRIENT_SORT_LABELS[option]}」/ 栄養表示「${nutritionLabelFor(NUTRIENT_SORT_FIELD[option])}」`,
    )
    eq('⑯ 並び替えの項目名が栄養表示の項目名と一致する', labelMismatch, [])
  }

  // 2026-08-01 線引きB'(オーナー確定): 栄養並び替えのうちカロリー(エネルギー)順だけを無料に開放し、
  // 残りはPro維持。並べ替えの計算自体は無料/Proで同じ。
  // 2026-08-19 便HU: 顔ぶれが5→8項目に増えたので、Pro側は「顔ぶれからエネルギーを引いた残り」
  // という規則で見る(顔ぶれが増えても無料側が勝手に増えない、という線引きの見張りになる)
  eq('FREE_NUTRIENT_SORT_OPTIONS: 無料はエネルギー順のみ', [...FREE_NUTRIENT_SORT_OPTIONS], ['kcal'])
  eq(
    "PRO_NUTRIENT_SORT_OPTIONS: 顔ぶれからエネルギーを引いた残り全部がPro(線引きB')",
    [...PRO_NUTRIENT_SORT_OPTIONS],
    NUTRIENT_SORT_OPTIONS.filter((option) => option !== 'kcal'),
  )
  eq('isFreeSortOption: カロリー順は無料で使える', isFreeSortOption('kcal'), true)
  eq('isFreeSortOption: 塩分順はPro', isFreeSortOption('salt'), false)
  eq('isFreeSortOption: たんぱく質順はPro', isFreeSortOption('protein'), false)
  eq('isFreeSortOption: 栄養以外(更新順)は無料', isFreeSortOption('updated'), true)
  // 無料に開放したのはUIの選択肢だけで、並べ替えの計算(sortResults)には解錠状態が入らない。
  // 上のカロリー昇順・塩分昇順の期待値がそのまま通っていることがその見張りになっている
}

// ---------- 「最近作った順」(2026-08-03 オーナー指示・便DI-7) ----------
// 「作った！」の記録の最新日付で並べる。記録が1件も無いレシピは昇順/降順に関わらず末尾。
// 記録は追加した順に入っていて日付順とは限らないので、必ず最大値を取ること(再発防止)
{
  const mkCooked = (id, title, dates, updatedAt) => ({
    id,
    title,
    servings: 2,
    effortLevel: 'normal',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: dates.map((date) => ({ date })),
    searchWords: [],
    createdAt: updatedAt,
    updatedAt,
  })
  // 記録の並びをわざと日付順にしない(2件目の方が古い)
  const rNew = mkCooked(1, 'きのう作った', ['2026-07-01', '2026-08-02'], 100)
  const rOld = mkCooked(2, '先月作った', ['2026-07-05'], 200)
  const rNever = mkCooked(3, '作ったことがない', [], 300)
  eq('最近作った順: 記録の最新日付を拾う(追加順が日付順でなくても)', lastCookedDate(rNew), '2026-08-02')
  eq('最近作った順: 記録が1件なら その日付', lastCookedDate(rOld), '2026-07-05')
  eq('最近作った順: 記録なしはnull', lastCookedDate(rNever), null)
  const cookedResults = [rOld, rNever, rNew].map((recipe) => ({
    recipe,
    usedCount: 0,
    wantedCount: 0,
  }))
  eq(
    '最近作った順(既定=降順): 新しい順に並び、記録なしは末尾',
    sortResults(cookedResults, 'recentCooked', []).map((r) => r.recipe.id),
    [1, 2, 3],
  )
  eq(
    '最近作った順(昇順=しばらく作っていない順): 古い順でも記録なしは末尾のまま',
    sortResults(cookedResults, 'recentCooked', [], 'asc').map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq('最近作った順の既定方向は降順(新しい方から)', defaultSortDirection.recentCooked, 'desc')
  // 回数で数える「よく使う順」とは別物であること(記録2件のrNewが回数では先頭)
  eq(
    'よく使う順は回数順のまま(最近作った順の追加で壊れていない)',
    sortResults(cookedResults, 'cooked', []).map((r) => r.recipe.id),
    [1, 2, 3],
  )
}

// ---------- 「よく使うタグ」チップの使用頻度集計(2026-08-03 オーナー指示・便DI-4) ----------
// 従来は「作り置き」「お弁当」の直書き固定2択で、レシピを増やしても中身が変わらなかった。
// 使用件数の多い順・同数はタグ名の五十音順で安定すること
{
  const withTags = (tags) => ({ tags })
  const tagRecipes = [
    withTags(['作り置き', 'お弁当']),
    withTags(['作り置き']),
    withTags(['作り置き', '朝ごはん']),
    withTags(['お弁当']),
    withTags(['朝ごはん']),
    withTags([]),
  ]
  eq('よく使うタグ: 使用件数の多い順', topTagsByUsage(tagRecipes, 3), ['作り置き', 'お弁当', '朝ごはん'])
  eq('よく使うタグ: limitで打ち切る', topTagsByUsage(tagRecipes, 1), ['作り置き'])
  eq('よく使うタグ: タグが無ければ空', topTagsByUsage([withTags([]), withTags([])], 6), [])
  eq('よく使うタグ: limit0は空', topTagsByUsage(tagRecipes, 0), [])
  eq(
    'よく使うタグ: 同じレシピ内の重複タグは1件と数える',
    topTagsByUsage([withTags(['朝ごはん', '朝ごはん']), withTags(['お弁当']), withTags(['お弁当'])], 1),
    ['お弁当'],
  )
  eq(
    'よく使うタグ: 同数なら五十音順で安定する(開くたびに入れ替わらない)',
    topTagsByUsage([withTags(['たまご', 'あさごはん', 'さかな'])], 3),
    ['あさごはん', 'さかな', 'たまご'],
  )
  eq('よく使うタグ: 空白だけのタグは数えない', topTagsByUsage([withTags(['  ', 'お弁当'])], 6), ['お弁当'])
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
      mealPlanLocks: false,
      detachedLogs: false,
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
      mealPlanLocks: false,
      detachedLogs: false,
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
      mealPlanLocks: false,
      detachedLogs: false,
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
      mealPlanLocks: [],
      detachedLogs: [],
    }),
    {
      pantryItems: true,
      shoppingItems: true,
      mealPlans: true,
      todayList: true,
      prices: true,
      dayNotes: true,
      mealTemplates: true,
      mealPlanLocks: true,
      detachedLogs: true,
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
  // DY-2 再発防止: 出所の内訳(fromRecipes・2026-08-08)も付け替える。
  // 片方だけ直すと、出所の小窓が実在しないレシピを指す
  eq(
    '参照の付け替え: 買い物メモの出所の内訳(fromRecipes)も新しいIDを指す',
    remapBackupRecipeRefs(
      {
        shoppingItems: [
          {
            name: 'にんじん',
            order: 1,
            isChecked: false,
            fromRecipeIds: [104, 7],
            fromRecipes: [
              { recipeId: 104, amount: '1本' },
              { recipeId: 7, amount: '50g' },
            ],
          },
        ],
      },
      new Map([[104, 210]]),
    ).shoppingItems,
    [
      {
        name: 'にんじん',
        order: 1,
        isChecked: false,
        fromRecipeIds: [210, 7],
        fromRecipes: [
          { recipeId: 210, amount: '1本' },
          { recipeId: 7, amount: '50g' },
        ],
      },
    ],
  )
  eq(
    '参照の付け替え: 手で足しただけの行(出所なし)はそのまま返す',
    remapBackupRecipeRefs(
      { shoppingItems: [{ name: 'ラップ', order: 1, isChecked: false, manualAdded: true }] },
      new Map([[104, 210]]),
    ).shoppingItems,
    [{ name: 'ラップ', order: 1, isChecked: false, manualAdded: true }],
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

// ---------- BK-SWAP: 「データを上書き」「元に戻す」の確認文と、置き換えで捨てる覚え書き
// (2026-08-15 便GP・規約F)。(a)上書きの確認文が消えるものを数え落としていた
// (レシピ・作った記録・価格しか書いていないのに、在庫・買い物メモ・献立なども入れ替わる)
// (b)「元に戻す」に確認文が無かった (c)置き換えがDexieしか入れ替えず、並行調理ナビの段取りの
// 覚え書き(localStorage)が同じ日のうち残る＝**同じ番号の別の料理**を指しうる ----------
{
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const backupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const settingsSrc = readFileSync(path.join(scriptDir, '../src/pages/SettingsPage.tsx'), 'utf-8')
  const impact = countReplaceImpact([{ cookedLogs: [{ date: '2026-08-01' }] }, { cookedLogs: [] }], 4)
  const replaceText = confirmContentText(buildReplaceConfirm(impact))

  // (1) 置き換えで中身が入れ替わるテーブルは、1つ残らず確認文の言葉になっている。
  // テーブルを足したのに確認文を直し忘れたら、ここが「言葉が決まっていない」で落ちる
  const replaceBranch = backupSrc.slice(
    backupSrc.indexOf("if (mode === 'replace') {"),
    backupSrc.indexOf('// merge: 今のデータは1件も消さず'),
  )
  const clearedTables = [...new Set([...replaceBranch.matchAll(/db\.(\w+)\.clear\(\)/g)].map((m) => m[1]))]
  const wordForTable = {
    recipes: 'レシピ',
    setExclusions: '削除したレシピ',
    pantryItems: '在庫',
    shoppingItems: '買い物メモ',
    mealPlans: '週の献立',
    todayList: '今日の献立',
    prices: '価格',
    dayNotes: '日付メモ',
    mealTemplates: '献立テンプレート',
    mealPlanLocks: '献立のロック',
    // 2026-08-16 便GZ: レシピを削除しても残っている記録。上書きではこれもファイルの内容に
    // 置き換わるので、「消えるもの」の作った記録の件数（countReplaceImpactが合算する）で伝える
    detachedLogs: '作った記録',
  }
  eq('BK-SWAP 置き換えの分岐を読めている(空振りしていない)', clearedTables.length > 0, true)
  eq(
    'BK-SWAP 置き換えで空にするテーブルは、すべて確認文の言葉が決まっている',
    clearedTables.filter((t) => !(t in wordForTable)),
    [],
  )
  for (const table of clearedTables) {
    eq(
      `BK-SWAP 上書きの確認文が${table}の入れ替えに触れている`,
      replaceText.includes(wordForTable[table] ?? '＿言葉が未定＿'),
      true,
    )
  }
  eq('BK-SWAP 上書きの確認文は設定もファイルの内容になると書く', /設定/.test(replaceText), true)
  eq('BK-SWAP 上書きの確認文は何が残るかも書く(規約F)', /解錠コード[^。]*残り/.test(replaceText), true)
  eq('BK-SWAP 上書きの確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(replaceText), false)
  eq('BK-SWAP 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(replaceText), false)

  // (2) 段取りの1行は、覚え書きが残っているときだけ出す
  // (docs/69「捨てたときは失うものがある場合だけ知らせる」)
  eq(
    'BK-SWAP 段取りが残っていれば、その品数つきで消えると書く',
    confirmContentText(buildReplaceConfirm(impact, 3)).includes(ja.settings.replaceCookNaviNote.replace('{n}', '3')),
    true,
  )
  eq('BK-SWAP 段取りが無いときは段取りの話を書かない', /段取り/.test(replaceText), false)

  // (3) 置き換えのあとに、前の段取りの覚え書きが残らない。
  // localStorageはNodeに無いので、読み書きだけを差し替えて確かめる
  {
    const local = new Map()
    const session = new Map()
    const fake = (store) => ({
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    })
    globalThis.localStorage = fake(local)
    globalThis.sessionStorage = fake(session)
    saveCookNaviSession({
      selectedIds: [11, 12],
      showTimeline: true,
      trialActive: false,
      current: { recipeId: 11, stepIndex: 0 },
    })
    eq('BK-SWAP 前提: 段取りの覚え書きが端末に残っている', loadCookNaviSession()?.selectedIds, [11, 12])
    clearCookNaviSession()
    eq('BK-SWAP 覚え書きを捨てると読み戻せない', loadCookNaviSession(), undefined)
    eq('BK-SWAP 覚え書きの置き場所も空になる', local.has(COOK_NAVI_SESSION_KEY), false)
    delete globalThis.localStorage
    delete globalThis.sessionStorage
  }
  // 置き換え復元(importBackupのreplace)がその後始末を通ること。
  // 実行にはDexieが要るので、ここは配線で見る(この1行が抜けると古い段取りが復活する)
  eq('BK-SWAP 置き換え復元は段取りの覚え書きを捨てる', /clearCookNaviSession\(\)/.test(replaceBranch), true)
  eq(
    'BK-SWAP 「元に戻す」も同じ置き換え経路を通る(段取りの後始末も同じ)',
    /restorePreImportSnapshot[\s\S]{0,400}importBackup\(backup, 'replace'\)/.test(backupSrc),
    true,
  )

  // (4) 「元に戻す」の確認文。事故から戻すためのボタンなので短いまま、消える・残るを両方書く
  const undoText = confirmContentText(buildUndoReplaceConfirm(impact))
  eq(
    'BK-UNDO 確認文はいまのレシピ・作った記録の件数を差し込む',
    undoText.includes(
      ja.settings.replaceUndoGone
        .replace('{r}', String(impact.recipes))
        .replace('{c}', String(impact.cookedLogs))
        .replace('{navi}', ''),
    ),
    true,
  )
  eq('BK-UNDO 確認文は何が消えるかを書く(規約F)', /消え/.test(undoText), true)
  eq('BK-UNDO 確認文は何が残るかを書く(規約F)', /残り/.test(undoText), true)
  eq('BK-UNDO 確認文が「よろしいですか？」だけで終わらない(規約F)', /よろしいですか/.test(undoText), false)
  eq(
    `BK-UNDO 事故から戻すボタンなので長くしない(実測${[...undoText].length}字・上限は保険)`,
    [...undoText].length <= 200,
    true,
  )

  // (5) 画面の配線: 確認してから控えで置き換える(以前は確認なしで置き換えていた)
  const undoHandler = settingsSrc.slice(
    settingsSrc.indexOf('const handleUndoReplace'),
    settingsSrc.indexOf('setMessage(restored'),
  )
  eq(
    'BK-UNDO 画面は確認してから控えで置き換える',
    /await confirm\(buildUndoReplaceConfirm\([\s\S]*restorePreImportSnapshot\(\)/.test(undoHandler),
    true,
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

// ---------- backupNoticeKind(2026-08-21 便IR: バックアップのうながしを出す時と言い方) ----------
// 直した中身: 以前は「一度も書き出していなければ常に出す」だったので、**アプリを触り始めた
// 初日から**「しばらくバックアップしていません」と出ていた（「しばらく」が嘘になる）。
// 出さなくするのではなく、出す時（使い始めから7日）と言い方（別の文言）を分けた。
{
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2026-08-21T12:00:00+09:00')
  // --- 一度も書き出していない人 ---
  eq('うながし: 使い始めた初日には出さない（「しばらく」が嘘になる）', backupNoticeKind(undefined, now, now), 'none')
  eq('うながし: 使い始めから6日目はまだ出さない', backupNoticeKind(undefined, now - 6 * day, now), 'none')
  eq('うながし: 使い始めから7日たったら出す', backupNoticeKind(undefined, now - 7 * day, now), 'first')
  eq('うながし: 使い始めの日時が未記録の一瞬は出さない', backupNoticeKind(undefined, undefined, now), 'none')
  // firstLaunchAt が無い頃から使っている人には 0 が入る（db/settings.ts）。従来どおり出る
  eq('うながし: 既存ユーザー(使い始めの記録が0)には出す', backupNoticeKind(undefined, 0, now), 'first')
  // --- 一度は書き出した人 ---
  eq('うながし: 書き出し済み29日は出さない', backupNoticeKind(now - 29 * day, 0, now), 'none')
  eq('うながし: 書き出し済み31日は「しばらく」で出す', backupNoticeKind(now - 31 * day, 0, now), 'overdue')
  eq(
    'うながし: 一度でも書き出していれば、使い始めの日時では変わらない',
    backupNoticeKind(now - 31 * day, now, now),
    'overdue',
  )

  // --- 文言（規約H: 押した結果が分かる名前・言っていることが本当か） ---
  // 押しても書き出しは始まらず、設定のバックアップの節へ移るだけ。行き先の名前をそのまま名乗る
  eq(
    'うながし: 行き先の名前が、設定の節の名前(ja.settings.tabBackup)を名乗っている',
    ja.dayStart.backupReminderLink.includes(ja.settings.tabBackup) &&
      ja.dayStart.backupReminderLink.includes(ja.settings.title),
    true,
  )
  eq(
    'うながし: 行き先の名前が「バックアップを開く」（ファイルを開くと読める言い方）に戻っていない',
    ja.dayStart.backupReminderLink === `${ja.settings.tabBackup}を開く`,
    false,
  )
  eq(
    'うながし: 一度も書き出していない人には「しばらく」と言わない',
    /しばらく/.test(ja.dayStart.backupReminderFirst),
    false,
  )
  eq('うながし: 30日以上の人には「しばらく」と言う', /しばらく/.test(ja.dayStart.backupReminder), true)
  // 2つの言い方は、どちらも同じ締めくくり（設定の「ファイルに書き出す」）に着地する
  eq(
    'うながし: どちらの言い方も、設定の「ファイルに書き出す」に着地する',
    [ja.dayStart.backupReminder, ja.dayStart.backupReminderFirst].filter(
      (t) => !t.includes(ja.settings.backupExport.replace('す', 'し')),
    ),
    [],
  )

  // 画面側が、2つの言い方を出し分けているか（片方を書いたまま繋ぎ忘れると気づけない）
  const dayStartSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components/DayStartNotices.tsx'),
    'utf-8',
  )
  eq(
    'うながし: 画面が backupNoticeKind の答えで言い方を出し分けている',
    /backupNoticeKind\(settings\.lastBackupAt, settings\.firstLaunchAt\)/.test(dayStartSrc) &&
      /backupNotice === 'first'[\s\S]{0,80}backupReminderFirst/.test(dayStartSrc),
    true,
  )
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
  // 選択したレシピの書き出し(2026-08-09 便EM)。中身の範囲が違うファイルなので、
  // 全体のバックアップ・アーカイブと名前で見分けられること
  eq(
    'selectedRecipesFileName: バックアップと見分けの付く名前になる',
    selectedRecipesFileName(new Date(2026, 6, 5)),
    'uchi-recipe-recipes-2026-07-05.json',
  )
  eq(
    'selectedRecipesFileName: 全体のバックアップと同じ名前にならない',
    selectedRecipesFileName(new Date(2026, 6, 5)) === backupFileName(new Date(2026, 6, 5)),
    false,
  )
  eq('isAbortError: DOMExceptionでもAbortError以外はfalse', isAbortError(new DOMException('x', 'NotFoundError')), false)
  eq('isAbortError: DOMException以外(普通のError)はfalse', isAbortError(new Error('x')), false)
  eq(
    'isAbortError: name=AbortErrorのDOMExceptionはtrue(ユーザーがピッカーをキャンセルした扱い)',
    isAbortError(new DOMException('x', 'AbortError')),
    true,
  )
}

// ---------- freeLimit(2026-08-02 発売便DD: FREE_LIMIT_ENABLED=true) ----------
// 発売と同一リリースでフラグをONにした(docs/08 §2)。ONで変わるのは「新規追加のブロック」と
// 「予告バナー」だけで、既存レシピの閲覧・編集・削除・バックアップ復元は絶対に制限しない
// (それらはisAtFreeLimitを一切呼ばない=RecipeFormPageの新規保存パスだけが呼ぶ)
// 2026-08-08 便DZ(オーナー決定): 宣伝開始前に上限を50→30へ変更。アンケート・LP・説明書・
// お知らせと同じ数字であることが前提なので、上限の値そのものをテストで固定する
eq('上限は30件', FREE_LIMIT, 30)
eq('フラグON: 30件に達したら新規追加はブロックする', isAtFreeLimit(30, false), true)
eq('フラグON: 29件まではブロックしない', isAtFreeLimit(29, false), false)
eq('Pro解錠済みは30件でもブロックしない', isAtFreeLimit(30, true), false)
eq('Pro解錠済みは1000件でもブロックしない', isAtFreeLimit(1000, true), false)
eq('「あと◯件」: 20件時点はあと10件', freeLimitRemaining(20), 10)
eq('「あと◯件」: 27件時点はあと3件', freeLimitRemaining(27), 3)
eq('「あと◯件」: 30件以上でも負にならない', freeLimitRemaining(31), 0)

// 節目の案内(2026-08-08 オーナー指示「２０件目、２７件目、３０件目の登録完了時といった感じで」)。
// 旧仕様の「40件以上なら常時表示」をやめ、登録し終えた件数がちょうど節目のときだけ出す。
// 登録のたびに同じ案内が出ないこと(21件・26件で出ない)が、この変更のいちばんの目的
eq('節目は20件目と27件目', FREE_LIMIT_NOTICE_COUNTS.join(','), '20,27')
eq('19件目では案内を出さない', freeLimitNoticeFor(19, false), undefined)
eq('20件目で予告を出す', freeLimitNoticeFor(20, false), 'near')
eq('21件目では出さない(節目の次の登録では繰り返さない)', freeLimitNoticeFor(21, false), undefined)
eq('26件目では出さない', freeLimitNoticeFor(26, false), undefined)
eq('27件目で予告を出す', freeLimitNoticeFor(27, false), 'near')
eq('28件目では出さない', freeLimitNoticeFor(28, false), undefined)
eq('29件目では出さない', freeLimitNoticeFor(29, false), undefined)
eq('30件目は予告でなく上限到達の案内', freeLimitNoticeFor(30, false), 'reached')
eq('上限を超えた件数(復元等)では案内を出さない', freeLimitNoticeFor(31, false), undefined)
eq('Pro解錠済みには節目でも出さない(20件目)', freeLimitNoticeFor(20, true), undefined)
eq('Pro解錠済みには上限到達の案内も出さない', freeLimitNoticeFor(30, true), undefined)
eq('予約が無い(未設定)なら何も出さない', freeLimitNoticeFor(undefined, false), undefined)
eq('閉じたあとの0では何も出さない', freeLimitNoticeFor(0, false), undefined)
eq('壊れた値(NaN)でも何も出さない', freeLimitNoticeFor(NaN, false), undefined)
// 上限のカウント対象はisStarter=falseだけ(同梱の基本レシピは何品あっても上限に効かない)。
// 発売でフラグをONにしたため、この不変条件が破れると初回起動直後の人がいきなりブロックされる
eq(
  '基本レシピ(isStarter)は上限に数えない',
  countFreeLimitRecipes([
    ...Array.from({ length: 109 }, () => ({ isStarter: true })),
    { isStarter: false },
    {},
  ]),
  2,
)
eq(
  'フラグON: 基本レシピ109品だけならブロックしない',
  isAtFreeLimit(countFreeLimitRecipes(Array.from({ length: 109 }, () => ({ isStarter: true }))), false),
  false,
)

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

// ---------- ⑬ 料理の種別は複数選べる(2026-08-19 便HU・オーナー
// 「料理の種別については複数選択できても良いと思う」) ----------
// 1つも選んでいない＝絞らない。選んだ種別の**どれか**に当たるレシピが残る(和集合)。
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
  const mk = (id, title, dishType) => ({
    id,
    title,
    tags: [],
    searchWords: [],
    ingredients: [],
    dishType,
  })
  const recipes = [
    mk(1, '豚の生姜焼き', 'main'),
    mk(2, 'ほうれん草のおひたし', 'side'),
    mk(3, 'わかめのみそ汁', 'soup'),
    mk(4, '水ようかん', 'dessert'),
  ]
  const ids = (options) => searchRecipes(recipes, { ...baseOptions, ...options }).map((r) => r.recipe.id)
  // 掴めていないまま合格に倒れないよう、まず絞らないときに全品出ることを確かめる
  eq('⑬ 種別を1つも選んでいなければ全品出る', ids({}), [1, 2, 3, 4])
  eq('⑬ 空の配列も「絞らない」と同じ', ids({ dishTypes: [] }), [1, 2, 3, 4])
  eq('⑬ 1つ選べばその種別だけ', ids({ dishTypes: ['main'] }), [1])
  eq('⑬ 2つ選ぶとどちらかに当たる品が出る(和集合)', ids({ dishTypes: ['main', 'soup'] }), [1, 3])
  eq('⑬ 4区分すべてを選ぶと全品出る(区分は重ならず全部を覆う)', ids({ dishTypes: ['main', 'side', 'soup', 'dessert'] }), [1, 2, 3, 4])
}

// ---------- ⑮ 「高たんぱく」は絞り込みのタグ候補に出さない(2026-08-19 便HU・オーナー指示) ----------
// レシピに付いているタグそのものは消さない（データを失う方に倒さない）。
// 候補に出さないだけなので、タグを指定した絞り込み自体は従来どおり効く。
{
  const { filterTagUsageCounts, FILTER_HIDDEN_TAGS } = await import('../src/logic/search.ts')
  const withTags = (id, tags) => ({ id, title: `品${id}`, tags, searchWords: [], ingredients: [] })
  const recipes = [
    withTags(1, ['高たんぱく', '和食']),
    withTags(2, ['高たんぱく', '和食']),
    withTags(3, ['高たんぱく']),
    withTags(4, ['作り置き']),
  ]
  eq('⑮ 隠すタグの一覧に「高たんぱく」が入っている', [...FILTER_HIDDEN_TAGS].includes('高たんぱく'), true)
  // 前提: 生の集計では「高たんぱく」がいちばん多い＝隠さなければ必ず候補の先頭に出る
  eq(
    '⑮ 前提: 生の集計では「高たんぱく」が数えられている',
    tagUsageCounts(recipes, 6).map((u) => u.tag),
    ['高たんぱく', '和食', '作り置き'],
  )
  eq(
    '⑮ 絞り込みの候補からは「高たんぱく」が消える',
    filterTagUsageCounts(recipes, 6).map((u) => u.tag),
    ['和食', '作り置き'],
  )
  eq(
    '⑮ 隠したぶんで候補の枠が減らない(上限まで他のタグが入る)',
    filterTagUsageCounts(recipes, 1).map((u) => u.tag),
    ['和食'],
  )
  // レシピ側のタグは残っている＝データは失っていない
  eq(
    '⑮ レシピの「高たんぱく」タグは残っている(絞り込みの指定は今までどおり効く)',
    searchRecipes(recipes, {
      query: '',
      ingredients: '',
      time: 'all',
      effort: 'all',
      tag: '高たんぱく',
      favoriteOnly: false,
      excludeNg: false,
      quickOnly: false,
      ngIngredients: [],
    }).map((r) => r.recipe.id),
    [1, 2, 3],
  )
}

// ---------- 便HZ・② よく使う検索を「絞り込みのタグ」として登録する ----------
// オーナーの訂正:「検索結果にタグづけは、絞り込んだレシピにタグをつけるのではなく、
// 絞り込み機能の『タグ』に新しいタグを追加する、という意味でした。レシピ自体はいじりません」
// 「よく使うタグを自分で設定する機能です」。
// 以前の版(便HU・⑭)は、押した時点で検索に一致したレシピに実際にタグを書き込んでいた。
//
// 【この節でいちばん測ること】レシピのデータが1件も変わらないこと。
// 登録→押す→削除まで通しでやってから、レシピの配列を丸ごと比べる。
{
  const {
    savedSearchFromQuery,
    savedSearchesWith,
    savedSearchesWithout,
    countRecipesWithTag,
    tagsWithRemoved,
    buildSavedSearchRemoveConfirm,
    buildLegacyTagRemoveConfirm,
    SAVED_SEARCH_MAX_LENGTH,
  } = await import('../src/logic/tagRegister.ts')
  const { confirmContentText } = await import('../src/logic/confirmContent.ts')
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  // 登録できる言葉の作り方(空白の詰め方は検索と同じ＝登録した言葉をそのまま検索欄に戻せる)
  eq('② 前後の空白は落とす', savedSearchFromQuery('  作り置き  '), '作り置き')
  eq('② 語の間の空白は半角1つにまとめる', savedSearchFromQuery('鶏　むね'), '鶏 むね')
  eq('② 空の検索語では登録しない', savedSearchFromQuery('   '), null)
  eq(
    '② チップに収まらない長さは登録しない',
    savedSearchFromQuery('あ'.repeat(SAVED_SEARCH_MAX_LENGTH + 1)),
    null,
  )

  const mk = (id, title, tags) => ({
    id,
    title,
    tags,
    searchWords: [title],
    ingredients: [{ name: title }],
    cookedLogs: [],
  })
  const recipes = [mk(1, 'から揚げ', []), mk(2, 'から揚げ丼', ['和食']), mk(3, '肉じゃが', [])]
  // レシピが1件も変わらないことを測るための控え(通しでやったあとに丸ごと比べる)
  const recipesBefore = JSON.stringify(recipes)

  const hits = searchRecipes(recipes, { ...baseOptions, query: 'から揚げ' }).map((r) => r.recipe.id)
  eq('② 前提: 検索に一致した品が2品ある(空振りしていない)', hits, [1, 2])
  const name = savedSearchFromQuery('から揚げ')

  // 登録: 増えるのは「登録した言葉の控え」だけ
  let saved = savedSearchesWith(undefined, name)
  eq('② 登録すると控えに入る', saved, ['から揚げ'])
  eq('② 同じ言葉を2回登録しても控えは増えない', savedSearchesWith(saved, name), ['から揚げ'])

  // 押す: その検索が呼び戻される(登録したときと同じ結果に戻る)
  eq(
    '② 登録したタグを押すと、登録したときと同じ結果が戻る',
    searchRecipes(recipes, { ...baseOptions, query: name }).map((r) => r.recipe.id),
    hits,
  )
  eq('② 登録してもレシピのタグは1つも増えない', recipes.map((r) => r.tags), [[], ['和食'], []])
  eq(
    '② そのタグが付いた品は1品も無い(レシピには書き込んでいない)',
    countRecipesWithTag(recipes, name),
    0,
  )

  // 削除: 控えから消えるだけ
  saved = savedSearchesWithout(saved, name)
  eq('② 削除すると控えから消える', saved, [])
  eq(
    '② 登録→押す→削除を通してもレシピのデータが1件も変わらない',
    JSON.stringify(recipes),
    recipesBefore,
  )

  // 削除の確認(規約F: 何が消えて何が残るかを両方書く。「よろしいですか？」だけにしない)
  const removeText = confirmContentText(
    buildSavedSearchRemoveConfirm({ name: 'から揚げ', recipeCount: 3 }),
  )
  eq('② 削除の窓に消えるものが出る', removeText.includes('消えるもの'), true)
  eq('② 削除の窓に残るものが出る', removeText.includes('残るもの'), true)
  eq('② 削除の窓にレシピが1品も変わらないことが出る', removeText.includes('レシピ3品'), true)
  eq(
    '② 削除の窓が「よろしいですか？」だけになっていない',
    removeText.includes('よろしいですか'),
    false,
  )

  // 以前の版がレシピ本体に書き込んだタグの後始末。外す道は残す(データを失う方に倒さない)
  const legacy = [mk(1, 'から揚げ', ['から揚げ']), mk(2, 'から揚げ丼', ['和食', 'から揚げ'])]
  eq('② 前提: 以前の版で書き込まれたタグが2品に残っている', countRecipesWithTag(legacy, 'から揚げ'), 2)
  const cleaned = legacy.map((r) => ({ ...r, tags: tagsWithRemoved(r.tags, 'から揚げ') }))
  eq('② 外すとそのタグだけが消える', cleaned.map((r) => r.tags), [[], ['和食']])
  eq('② 外してもレシピそのものは残る', cleaned.map((r) => r.id), [1, 2])
  const legacyText = confirmContentText(buildLegacyTagRemoveConfirm({ tag: 'から揚げ', count: 2 }))
  eq('② 後始末の窓に消えるものが出る', legacyText.includes('消えるもの'), true)
  eq('② 後始末の窓に残るものが出る', legacyText.includes('残るもの'), true)
  eq('② 後始末の窓に何品から外れるかが出る', legacyText.includes('レシピ2品'), true)
}

// ---------- 便HZ・② レシピを書き換える経路が本当に無いことを、コードそのものから見る ----------
// 画面を立ち上げずに measure できる唯一の形。読み取りに失敗したら必ず落ちるようにする
// (ファイルが読めなかった＝合格、に倒れない)。同じ読み方で「在るもの」も読めることを
// 前提として確かめ、正規表現が空振りしているだけの合格を作らない。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  // 説明のコメントに書いた名前(「addTagToRecipes は便HZで削除した」等)を数えないよう、
  // コメントを落としてから読む＝コードとして残っているかどうかだけを見る
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
  const read = (rel) => {
    const text = readFileSync(path.join(appRoot, rel), 'utf-8')
    if (text.length < 200) throw new Error(`${rel} を読み取れていない(長さ=${text.length})`)
    const code = stripComments(text)
    if (code.length < 200) throw new Error(`${rel} のコメントを落としたら中身が残らない`)
    return code
  }
  const page = read('src/pages/RecipesPage.tsx')
  const dbRecipes = read('src/db/recipes.ts')
  const logic = read('src/logic/tagRegister.ts')
  // 前提: 同じ読み方で、いま在るものは「在る」と読める(見張りの空振り防止)
  eq(
    '② 前提: 見張りが空振りしていない(在る名前は読み取れる)',
    /savedSearchesWith/.test(logic) &&
      /savedSearchFromQuery/.test(page) &&
      /removeTagFromRecipes/.test(dbRecipes),
    true,
  )
  eq(
    '② レシピにタグを書き込む関数(addTagToRecipes)がDBから無くなった',
    /addTagToRecipes/.test(dbRecipes),
    false,
  )
  eq('② レシピ一覧からも addTagToRecipes を呼んでいない', /addTagToRecipes/.test(page), false)
  eq(
    '② 登録のロジックにタグを足す道具(tagsWithAdded・recipeIdsMissingTag)が残っていない',
    /tagsWithAdded|recipeIdsMissingTag/.test(logic),
    false,
  )
}

// ---------- 便HZ・③ タグの複数選択と、2つ以上選んだときの選び方の切り替え ----------
// オーナー「タグ検索は、複数選択できるよにして。AND検索OR検索の切り替え機能も欲しい」。
// 件数の決め打ちではなく、**2つ選んだときにANDとORで結果が実際に違う**ことと、
// **AND ⊆ OR** の関係で測る(タグの顔ぶれが増えても意味が変わらない形)。
{
  const { defaultSearchOptions } = await import('../src/logic/search.ts')
  const mk = (id, tags) => ({
    id,
    title: `品${id}`,
    tags,
    searchWords: [],
    ingredients: [],
    cookedLogs: [],
  })
  const recipes = [mk(1, ['和食', '作り置き']), mk(2, ['和食']), mk(3, ['作り置き']), mk(4, ['洋食'])]
  const base = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ids = (tags, tagMatch) =>
    searchRecipes(recipes, { ...base, tags, tagMatch }).map((r) => r.recipe.id)

  eq('③ 1つも選んでいなければ絞らない', ids([], 'any'), [1, 2, 3, 4])
  eq('③ 空の配列も「絞らない」と同じ', ids([], 'all'), [1, 2, 3, 4])
  eq('③ 1つだけ選んだとき(どれかが付いている)', ids(['和食'], 'any'), [1, 2])
  eq('③ 1つだけなら選び方を変えても結果は同じ', ids(['和食'], 'all'), ids(['和食'], 'any'))

  const anyTwo = ids(['和食', '作り置き'], 'any')
  const allTwo = ids(['和食', '作り置き'], 'all')
  eq('③ 前提: 2つ選んだときどちらも空振りしていない', anyTwo.length > 0 && allTwo.length > 0, true)
  neq('③ 2つ選ぶと、選び方で結果が実際に違う', allTwo, anyTwo)
  eq(
    '③ 「すべて付いている」の結果は「どれかが付いている」に必ず含まれる',
    allTwo.every((id) => anyTwo.includes(id)),
    true,
  )
  eq('③ 「すべて付いている」の方が必ず少ない(選ぶほど絞れる)', allTwo.length < anyTwo.length, true)
  eq('③ どれかが付いている＝和集合', anyTwo, [1, 2, 3])
  eq('③ すべて付いている＝両方付いている品だけ', allTwo, [1])
  eq('③ 選び方を渡さないときは「どれかが付いている」として扱う', ids(['和食', '作り置き'], undefined), anyTwo)
  eq('③ 既定値も「どれかが付いている」', defaultSearchOptions.tagMatch, 'any')
  // 既定を「すべて付いている」にしない理由: 候補の上位は和食・洋食のように同時には付かない分類で、
  // 2つ目を押した瞬間に0品になり、壊れて見える
  eq('③ 同時には付かないタグ2つ: すべて付いている＝0品', ids(['和食', '洋食'], 'all'), [])
  eq('③ 同時には付かないタグ2つ: どれかが付いている＝品が出る', ids(['和食', '洋食'], 'any'), [1, 2, 4])
  // 1つだけ選ぶ旧来の指定(献立のレシピ選択ピッカー等)は今までどおり効く
  eq(
    '③ 1つだけ選ぶ旧来の指定(tag)は今までどおり効く',
    searchRecipes(recipes, { ...base, tag: '洋食' }).map((r) => r.recipe.id),
    [4],
  )
  eq(
    '③ 旧来の指定と複数選択は同時に指定しても両方効く',
    searchRecipes(recipes, { ...base, tag: '和食', tags: ['作り置き'], tagMatch: 'any' }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
}

// ---------- 便IB・② 登録したタグも、もとからあるタグと同じ「タグ」の並びで絞り込む ----------
// オーナー実機フィードバック「絞り込みタグは、実質キーワード検索？説明に『タグが付いている
// レシピの品数』とあるので、表現を揃えたい。やりたいことは『好きなキーワードをよく使うタグとして
// 絞り込みに登録したい』」。
//
// 直す前は、同じ「タグ」の欄に性質の違う2つが並んでいた:
//   ・もとからあるタグ = レシピに付いている印。押すと複数選択に入り、選び方(どれか/すべて)が効く
//   ・自分で登録したタグ = 保存した検索の言葉。押すと検索欄に入るだけで、選び方は効かない
// 利用者から見ると同じ「タグ」なのに、押したときの効き方が違っていた。
//
// 【この節で測ること】
//  (1) 登録したタグを押した結果が、その言葉で検索した結果と同じであること
//  (2) 登録したタグも、もとからあるタグと同じ選び方(どれか/すべて)に乗ること
//  (3) チップに出す数字が、そのタグだけで絞り込んだときに実際に出る品数と一致すること
//      (もとからあるタグ・登録したタグの両方で。数字と結果が食い違うと説明文が嘘になる)
//  (4) 登録したタグを使ってもレシピのデータが1件も変わらないこと(A案の一点)
// 件数の決め打ちはせず、同じ関数から取った2つの数の一致で見る。
{
  const { countRecipesMatchingKeyword } = await import('../src/logic/search.ts')
  const mk = (id, title, tags) => ({
    id,
    title,
    tags,
    searchWords: [title],
    ingredients: [{ name: title }],
    cookedLogs: [],
  })
  const recipes = [
    mk(1, 'から揚げ', ['和食']), // 言葉にも当たり、タグも付いている
    mk(2, 'から揚げ丼', []), // 言葉にだけ当たる
    mk(3, '肉じゃが', ['和食']), // タグだけ付いている
    mk(4, 'パスタ', ['洋食']), // どちらでもない
  ]
  const recipesBefore = JSON.stringify(recipes)
  const base = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ids = (options) => searchRecipes(recipes, { ...base, ...options }).map((r) => r.recipe.id)

  // (1) 押したときの結果＝その言葉で検索した結果
  eq('IB② 登録したタグを押した結果は、その言葉の検索と同じ', ids({ keywords: ['から揚げ'] }), ids({ query: 'から揚げ' }))
  eq('IB② 前提: その言葉の検索が0品でも全品でもない', ids({ keywords: ['から揚げ'] }), [1, 2])
  eq('IB② 1つも選んでいなければ絞らない', ids({ keywords: [] }), [1, 2, 3, 4])

  // (2) もとからあるタグと同じ選び方に乗る
  const anyMixed = ids({ tags: ['和食'], keywords: ['から揚げ'], tagMatch: 'any' })
  const allMixed = ids({ tags: ['和食'], keywords: ['から揚げ'], tagMatch: 'all' })
  eq('IB② 前提: 混ぜて選んでもどちらも空振りしていない', anyMixed.length > 0 && allMixed.length > 0, true)
  eq('IB② どれかが当たる＝もとからあるタグと登録したタグの和集合', anyMixed, [1, 2, 3])
  eq('IB② すべて当たる＝両方に当たる品だけ', allMixed, [1])
  eq(
    'IB② 「すべて」の結果は「どれか」に必ず含まれる(混ぜても関係は同じ)',
    allMixed.every((id) => anyMixed.includes(id)),
    true,
  )
  eq('IB② 「すべて」の方が必ず少ない(混ぜても選ぶほど絞れる)', allMixed.length < anyMixed.length, true)
  eq('IB② 登録したタグ同士でも選び方が効く(どれか)', ids({ keywords: ['から揚げ', '肉じゃが'], tagMatch: 'any' }), [1, 2, 3])
  eq('IB② 登録したタグ同士でも選び方が効く(すべて)', ids({ keywords: ['から揚げ', '肉じゃが'], tagMatch: 'all' }), [])

  // (3) チップの数字＝そのタグだけで絞り込んだときに実際に出る品数
  eq('IB② 登録したタグの品数を数える道具がある', typeof countRecipesMatchingKeyword, 'function')
  // 道具がまだ無い版でも、この節の残りが「実行時エラーで止まる」ではなく
  // 「数字が読めない＝不合格」として出るようにする(読み取り失敗を素通り合格にしない)
  const countKeyword =
    typeof countRecipesMatchingKeyword === 'function' ? countRecipesMatchingKeyword : () => null
  const keywordShown = countKeyword(recipes, 'から揚げ')
  eq(
    'IB② 登録したタグ: 画面に出す数字と、押したときに出る品数が一致する',
    keywordShown,
    ids({ keywords: ['から揚げ'] }).length,
  )
  const tagShown = tagUsageCounts(recipes, 10).find((u) => u.tag === '和食')?.count
  eq(
    'IB② もとからあるタグ: 画面に出す数字と、押したときに出る品数が一致する',
    tagShown,
    ids({ tags: ['和食'] }).length,
  )
  eq('IB② 前提: 数字を読み取れている(0や未取得のまま合格にしない)', keywordShown > 0 && tagShown > 0, true)

  // (4) レシピのデータは1件も変わらない(A案: 登録したタグはレシピに書き込まない)
  eq('IB② 登録したタグで絞り込んでもレシピのデータが1件も変わらない', JSON.stringify(recipes), recipesBefore)
  eq('IB② そのタグが付いた品は1品も無い(レシピには書き込んでいない)', tagUsageCounts(recipes, 10).some((u) => u.tag === 'から揚げ'), false)
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

  // ---- 2026-08-15 便GU: 「レシピカードにアイコンも何も表示されていないものがある」の再発防止 ----
  // カードの絵はPNGをCSSマスクで描くので、アプリが絵を持たない種別が入ると
  // 「読めない画像でマスクする＝一切塗られない＝空白のタイル」になる。
  // 描く直前に通す resolveIconKey が、必ず絵のある種別だけを返すことを確かめる。
  // (手で選んだ値はアプリの選択UI以外からも入る: バックアップの読み込み・貼り付け取り込み・
  //  ファイルの手直し。値そのものを信用して描かないための歯止め)
  const hamburg = { title: 'ハンバーグ', tags: [], ingredients: [{ name: '合いびき肉' }] }
  eq(
    '便GU アイコン: 絵を持たない種別が入っていても、絵のある種別に落とす',
    iconKeyOrder.includes(resolveIconKey({ ...hamburg, iconKey: 'gratin' })),
    true,
  )
  eq(
    '便GU アイコン: 空文字が入っていても、絵のある種別に落とす',
    iconKeyOrder.includes(resolveIconKey({ ...hamburg, iconKey: '' })),
    true,
  )
  eq(
    '便GU アイコン: 手で選んだ種別は、絵があるかぎりそのまま使う',
    resolveIconKey({ ...hamburg, iconKey: 'soup' }),
    'soup',
  )
  eq(
    '便GU アイコン: 指定が無ければ自動判定と同じ結果になる',
    resolveIconKey(hamburg),
    pickIconKey(hamburg),
  )
  // カタログ全品も、描く直前の関数を通して必ず絵のある種別になる
  eq(
    '便GU アイコン: カタログ全品が絵のある種別に解決する',
    iconEntries.every(({ recipe }) => iconKeyOrder.includes(resolveIconKey(recipe))),
    true,
  )
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
    eq('単位だけの修正で生しいたけの価格は据え置き', byName.get('生しいたけ')?.pricePerUnit, 100)
    eq('単位だけの修正でオクラの価格は据え置き', byName.get('オクラ')?.pricePerUnit, 130)
    eq('単位だけの修正で小ねぎの価格は据え置き', byName.get('小ねぎ')?.pricePerUnit, 80)

    const idx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    eq(
      'パック按分: いちご6個(=90g)は280g400円のマスタから129円(従来は1パック満額400円)',
      estimateIngredientYen({ name: 'いちご', amount: '6', unit: '個' }, idx)?.yen,
      129,
    )
    eq(
      'パック按分: 生しいたけ2枚は6枚100円のマスタから33円(従来は1パック満額100円)',
      estimateIngredientYen({ name: '生しいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      33,
    )
    eq(
      'パック按分: 生しいたけ5枚は83円(従来は1パック満額100円)',
      estimateIngredientYen({ name: '生しいたけ', amount: '5', unit: '枚' }, idx)?.yen,
      83,
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
      'レタス4枚は従来どおり60円(マスタ1個150円からグラム換算で按分済み。今回の修正対象外)',
      estimateIngredientYen({ name: 'レタス', amount: '4', unit: '枚' }, idx)?.yen,
      60,
    )
    // 「適量」「少々」の薬味は従来どおり満額のまま(docs/49 §7の既決事項。今回変えていない)
    eq(
      '単位修正後も小ねぎ「適量(お好みで)」は従来どおり満額80円(薬味の既決方針は不変)',
      estimateIngredientYen({ name: '小ねぎ', amount: '適量(お好みで)', unit: '' }, idx)?.yen,
      80,
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
    eq('同梱109品の概算食費の合計(便FA名寄せ後。便EY前は38,622円/便BY修正前は48,377円)', grand, 38014)
    const nabe = starterDefs.find((d) => d.title === '寄せ鍋')
    eq(
      '寄せ鍋 1食あたり(便EY後226円→便FAのしいたけ名寄せで217円)',
      Math.round(estimateRecipeCost(nabe.ingredients, idx).total / nabe.servings),
      217,
    )
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

// ---------- unitFixesToApply: 「単位だけを直す」1回限りの移行(2026-08-10 便EY) ----------
// 背景: マスタの単位が「1パック」「1袋」だと按分の受け皿にならず、レシピが「6個」「2枚」と
// 書いていてもパック1つ分の金額が1行にまるごと乗っていた。PRICE_DEFAULTSの単位を直しても
// 既存ユーザーの行は古い単位のままなので、既定のままの行だけを新単位へ揃える移行を足した。
// ユーザーが手を入れた行(価格を変えた・単位を変えた・自分で追加した)は1件も触らないこと。
{
  const { unitFixesToApply } = await import('../src/db/prices.ts')
  const { PRICE_DEFAULT_UNIT_FIXES } = await import('../src/data/priceDefaults.ts')
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
    for (const fix of PRICE_DEFAULT_UNIT_FIXES) {
      // 「しいたけ」は2026-08-10 便FAで「生しいたけ」へ名寄せしたためPRICE_DEFAULTSには無い
      // (畳む側の行は版7の PRICE_DEFAULT_MERGES が先に処理する)。記録として配列には残す
      if (fix.name === 'しいたけ') continue
      const current = byName.get(fix.name)
      eq(`PRICE_DEFAULT_UNIT_FIXES ${fix.name}のtoUnitが現行のPRICE_DEFAULTSと一致`, current?.unit, fix.toUnit)
      eq(`PRICE_DEFAULT_UNIT_FIXES ${fix.name}の価格は据え置き(移行で金額を動かさない)`, current?.pricePerUnit, fix.pricePerUnit)
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
    '../src/data/priceDefaults.ts'
  )
  const { nameMergesToApply } = await import('../src/db/prices.ts')
  const { buildPriceIndex, estimateIngredientYen, matchPriceEntry } = await import(
    '../src/logic/priceEstimate.ts'
  )
  const { toHiragana } = await import('../src/logic/kana.ts')

  const names = PRICE_DEFAULTS.map((d) => d.name)
  eq('FA マスタに素の「しいたけ」項目はもう無い(生しいたけへ名寄せ済み)', names.includes('しいたけ'), false)
  eq('FA マスタの生の項目名は「生しいたけ」', names.includes('生しいたけ'), true)
  eq('FB マスタの乾燥の項目名は「干ししいたけ」(便FBで「乾燥しいたけ」から統一)', names.includes('干ししいたけ'), true)
  eq('FB マスタに旧名「乾燥しいたけ」の項目はもう無い', names.includes('乾燥しいたけ'), false)
  const byName = new Map(PRICE_DEFAULTS.map((d) => [d.name, d]))
  eq('FA 生しいたけは100円/6枚(オーナー指定「どちらかなら生しいたけ」に価格を寄せる)', {
    yen: byName.get('生しいたけ')?.pricePerUnit,
    unit: byName.get('生しいたけ')?.unit,
  }, { yen: 100, unit: '6枚' })
  eq('FB 干ししいたけは400円/30gのまま(呼び名だけ変え、価格・単位・出典は動かさない)', {
    yen: byName.get('干ししいたけ')?.pricePerUnit,
    unit: byName.get('干ししいたけ')?.unit,
  }, { yen: 400, unit: '30g' })
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
      'FA 素の「しいたけ4枚」は生しいたけ100円/6枚から67円(名寄せ前は150円/6枚で100円)',
      estimateIngredientYen({ name: 'しいたけ', amount: '4', unit: '枚' }, idx)?.yen,
      67,
    )
    eq(
      'FA 生しいたけ2枚は33円のまま(便EYの按分は変えていない)',
      estimateIngredientYen({ name: '生しいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      33,
    )
    eq(
      'FB 干ししいたけ2枚(=6g)は400円/30gから80円(栄養側の1枚=3gでグラムに寄せて按分)',
      estimateIngredientYen({ name: '干ししいたけ', amount: '2', unit: '枚' }, idx)?.yen,
      80,
    )
    eq(
      'FB 旧名「乾燥しいたけ」4枚(=12g)も同じ160円(呼び名を変えても値段は変わらない)',
      estimateIngredientYen({ name: '乾燥しいたけ', amount: '4', unit: '枚' }, idx)?.yen,
      160,
    )
    eq(
      'FB 「干し椎茸」4枚も同じ160円(表記ゆれでも同じ値段になる)',
      estimateIngredientYen({ name: '干し椎茸', amount: '4', unit: '枚' }, idx)?.yen,
      160,
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
      [{ kind: 'rename', id: 1, name: 'しいたけ', toName: '生しいたけ', pricePerUnit: 100, unit: '6枚' }],
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
          pricePerUnit: 400,
          unit: '30g',
        },
      ],
    )
    eq(
      'FB nameMergesToApply 版7の端末: 畳んでも価格・単位は1円も動かない(400円/30gのまま)',
      nameMergesToApply([v7Dry], merges, PRICE_DEFAULTS).map((p) => ({
        yen: p.pricePerUnit,
        unit: p.unit,
      })),
      [{ yen: 400, unit: '30g' }],
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
      const { missingDefaults } = await import('../src/db/prices.ts')
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
    const { matchNutritionFood } = await import('../src/logic/nutrition.ts')
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
    const { buildSearchWords } = await import('../src/logic/kana.ts')
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

  // ---------- 2026-08-12 便FX・単位の読み（オーナー実機「『cm』をシーエムと読むくらいに酷い」）
  // 単位は data/unitReadings.ts で読みに置き換える（用語タップ辞書には入れない＝
  // 手順本文の「200g」がタップ対象にならない）。表示テキストは1文字も変えない。
  eq('FX-05 cmはセンチと読む', toSpeechText('4cm長さに切る。'), '4センチ長さに切る。')
  eq('FX-05 mmはミリと読む', toSpeechText('5mm幅の薄切りにする。'), '5ミリ幅の薄切りにする。')
  eq('FX-05 gはグラムと読む', toSpeechText('鶏むね肉300gを使う。'), '鶏むね肉300グラムを使う。')
  eq('FX-05 kgはキロと読む(gより先に当てる)', toSpeechText('野菜が1kg程度まで。'), '野菜が1キロ程度まで。')
  eq('FX-05 mlはミリリットルと読む', toSpeechText('水200mlを注ぐ。'), '水200ミリリットルを注ぐ。')
  eq('FX-05 Lはリットルと読む', toSpeechText('湯1Lに塩を入れる。'), '湯1リットルに塩を入れる。')
  eq('FX-05 ccはシーシーと読む', toSpeechText('だし200ccを加える。'), 'だし200シーシーを加える。')
  eq('FX-05 ℃は度と読む', toSpeechText('180℃に予熱する。'), '180度に予熱する。')
  eq('FX-05 %はパーセントと読む', toSpeechText('塩分2%で漬ける。'), '塩分2パーセントで漬ける。')
  eq('FX-05 大さじ・小さじはひらがなで読む', toSpeechText('大さじ2と小さじ1を混ぜる。'), 'おおさじ2とこさじ1を混ぜる。')
  eq('FX-05 分数は「◯分の◯」と読む', toSpeechText('卵液の1/3を流す。'), '卵液の3分の1を流す。')
  eq(
    'FX-05 単位も辞書語も入っている文は両方効く',
    toSpeechText('小口切りにして5cm幅に切る。'),
    'こぐちぎりにして5センチ幅に切る。',
  )
  // 数字が前に無い英字は触らない（英単語の中の l・g を壊さない）
  eq('FX-05 数字の前に無い英字は読み替えない', toSpeechText('Lサイズの卵を使う。'), 'Lサイズの卵を使う。')
  eq('FX-05 英単語の中は読み替えない', toSpeechText('1グラタン皿に入れる。'), '1グラタン皿に入れる。')
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

// ============================================================================
// 便IT(2026-08-21): テスト用データ作りで見つかった取り込みの不具合。
// ①cotta(タグの外にRecipeを書くサイト) ②型の大きさを人数と読む ④丸数字の参照
// ⑤「◯◯の材料」「◯◯の作り方」の見出し ⑥手順に残る「**1**」
// ============================================================================

// ---- ①(便IT): <script type="application/ld+json"> の外に書かれたRecipeを拾う ----
// cotta実測: schema.org/Recipeの中身はHTMLソースに丸ごと載っているが、
// 「var rich_card_json = {…}」というJavaScriptの変数として書かれており、ページを開いてから
// JavaScriptがld+jsonのタグを作る。タグだけを見ていたWorkerには見つけられなかった。
{
  // (1) cottaのレシピページ相当: 素のJavaScriptの中の変数に丸ごと入っている
  const html =
    '<!doctype html><html><head></head><body>' +
    '<script charset="UTF-8" type="text/javascript">\n' +
    "    const s = document.createElement('script');\n" +
    "    s.setAttribute('type', 'application/ld+json');\n" +
    '\tvar rich_card_json ={"@context":"http:\\/\\/schema.org\\/","@type":"Recipe","name":"基本のマドレーヌ",' +
    '"image":"https:\\/\\/example.com\\/madeleine.jpg","recipeYield":"シェル型6〜9個分",' +
    '"recipeIngredient":["全卵1個分","砂糖50g","薄力粉50g"],' +
    '"recipeInstructions":[{"@type":"HowToStep","text":"卵を割りほぐし、砂糖を入れて混ぜる"},' +
    '{"@type":"HowToStep","text":"型に流して170度で13分焼く"}]};\n' +
    '    s.textContent = JSON.stringify(rich_card_json);\n' +
    '    document.head.appendChild(s);\n' +
    '</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/cotta1')
  eq('IT①: ld+jsonタグの外(JavaScriptの変数)に書かれたRecipeも拾える', r?.title, '基本のマドレーヌ')
  eq('IT①: 外から拾ったRecipeの材料3件', r?.ingredients, [
    { name: '全卵', amount: '1個分' },
    { name: '砂糖', amount: '50g' },
    { name: '薄力粉', amount: '50g' },
  ])
  eq('IT①: 外から拾ったRecipeの手順2件', r?.steps, [
    '卵を割りほぐし、砂糖を入れて混ぜる',
    '型に流して170度で13分焼く',
  ])
  eq('IT①: 外から拾ったRecipeの写真', r?.imageUrl, 'https://example.com/madeleine.jpg')
}

{
  // (2) JSON.stringify({…}) の形で引数に直接書かれている形も同じように拾える
  const html =
    '<!doctype html><html><head></head><body><script type="text/javascript">' +
    'x.textContent = JSON.stringify({"@context":"http:\\/\\/schema.org","@type":"Recipe","name":"かぼちゃの煮物",' +
    '"recipeIngredient":["かぼちゃ 1/4個"],"recipeInstructions":["ひと口大に切る","落としぶたをして煮る"]});' +
    '</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/cotta2')
  eq('IT①: JSON.stringify({…})の形でもRecipeを拾える', r?.title, 'かぼちゃの煮物')
  eq('IT①: JSON.stringify形の手順2件', r?.steps, ['ひと口大に切る', '落としぶたをして煮る'])
}

{
  // (3) 入れ子の中にRecipeがあっても、そのRecipeだけを取り出せる
  const html =
    '<!doctype html><html><body><script>window.__DATA__ = {"page":{"id":12,' +
    '"recipe":{"@type":"Recipe","name":"きんぴらごぼう","recipeIngredient":["ごぼう 1本"],' +
    '"recipeInstructions":["ささがきにする","炒める"]}}};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/nested')
  eq('IT①: 入れ子の中のRecipeも拾える', r?.title, 'きんぴらごぼう')
}

{
  // (4) 拾いすぎない① ld+jsonタグに揃ったRecipeがあるときは、外は見に行かない
  //     (タグの中が正)。外に別のRecipeが転がっていても混ざらない
  const html =
    '<!doctype html><html><head><script type="application/ld+json">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: '肉じゃが',
      recipeIngredient: ['じゃがいも 3個'],
      recipeInstructions: ['煮る'],
    }) +
    '</script></head><body><script>var other = {"@type":"Recipe","name":"よその料理",' +
    '"recipeIngredient":["塩 少々"],"recipeInstructions":["混ぜる"]};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/both')
  eq('IT①: タグの中が揃っていれば、そちらを使う(外のRecipeに乗っ取られない)', r?.title, '肉じゃが')
}

{
  // (5) 拾いすぎない② <script>の外(本文)に同じ字面があっても拾わない
  const html =
    '<!doctype html><html><body><p>このページは {"@type":"Recipe","name":"本文に書いただけ",' +
    '"recipeIngredient":["塩 少々"],"recipeInstructions":["混ぜる"]} という説明の記事です。</p></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/article')
  eq('IT①: <script>の外(本文)に転がっている同じ字面は拾わない', r, undefined)
}

{
  // (6) 拾いすぎない③ 中身が足りないRecipe(cottaの記事ページ実測: 名前と写真だけ)は
  //     これまでどおり no_recipe。貼り付け取り込みへ案内する
  const html =
    '<!doctype html><html><body><script>y.textContent = JSON.stringify({"@context":"http:\\/\\/schema.org",' +
    '"@type":"Recipe","name":"基本のシュークリームレシピ","image":"https://example.com/a.jpg",' +
    '"recipeCategory":"お菓子"});</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/column')
  eq('IT①: 名前だけのRecipe(材料・手順なし)はこれまでどおり取り込まない', r, undefined)
}

{
  // (7) 拾いすぎない④ JSONとして読めない書き方(素のJavaScriptのオブジェクト)は諦める(落ちない)
  const html =
    '<!doctype html><html><body><script>var z = {"@type":"Recipe", name: 基本の何か, ' +
    'recipeIngredient: [塩]};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/broken')
  eq('IT①: JSONとして読めない書き方は拾わない(例外を投げない)', r, undefined)
}

// ---- ②(便IT): 型の大きさ(cm)・「1台分」を人数と読まない ----
// 実測: DELISH KITCHEN「直径17cmのシフォン型1台分」→17人分、macaroni「18cm×18cmの容器1台分」→18人分。
// 1食あたりの原価が約8円になり、数字が明らかに変だった。docs/43で「26個分」は直っているが
// cm表記が残っていた
eq('IT②: 「直径17cmのシフォン型1台分」を人数と読まない', extractServings('直径17cmのシフォン型1台分'), undefined)
eq('IT②: 「18cm×18cmの容器1台分」を人数と読まない', extractServings('18cm×18cmの容器1台分'), undefined)
eq('IT②: 「21cmのパウンド型1台分」も読まない', extractServings('21cmのパウンド型1台分'), undefined)
eq('IT②: 「天板1枚分」も読まない(既存の枚)', extractServings('天板1枚分'), undefined)
// 範囲の後ろに個数の単位が来る形(cotta「シェル型6〜9個分」実測)。範囲の先頭の数字だけを見ていると
// 6人分になっていた
eq('IT②: 「シェル型6〜9個分」を人数と読まない', extractServings('シェル型6〜9個分'), undefined)
eq('IT②: 「200〜250g」も読まない', extractServings('200〜250g'), undefined)
// 既存の挙動は変えない(人数として読めるものは読む)
eq('IT②: 「4人分」はこれまでどおり4', extractServings('4人分'), 4)
eq('IT②: 単位なしの範囲「2〜3」はこれまでどおり2', extractServings('2〜3'), 2)
eq('IT②: 「600g / 3」はこれまでどおり3', extractServings('600g / 3'), 3)

// ---- ⑥(便IT): 手順に残る「**1**」(NHK実測) ----
// みんなのきょうの料理は、前の手順を指す番号を JSON-LD 側で「**1**」と書いている。
// 番号は残し、印(**)だけを落とす。番号ごと落とすと「の野菜類を加える」になって文が壊れる
eq(
  'IT⑥: 手順の「**1**」は印だけ落として番号を残す',
  normalizeInstructions(['ボウルにひき肉、塩を入れてよく練る。**1**の野菜類を加える。']),
  ['ボウルにひき肉、塩を入れてよく練る。1の野菜類を加える。'],
)
eq(
  'IT⑥: 行頭の「**2**の…」も番号を残す(手順番号として剥がさない)',
  normalizeInstructions(['**2**のキャベツの軸をそぎ落とす。', '**4**の巻き終わりを下にして並べる。']),
  ['2のキャベツの軸をそぎ落とす。', '4の巻き終わりを下にして並べる。'],
)
// アプリ側の保険(便IL/①と同じ考え方): アプリはWorkerを差し替えずに更新されうるので、
// 受け取った側でももう一度落とす。印が無い文は1文字も変わらない
eq(
  'IT⑥: アプリ側でも「**1**」の印を落として番号を残す(Workerが出るまでの保険)',
  filterImportedSteps(['ボウルにひき肉を練る。**1**の野菜類を加える。', '**2**を俵形に整える。']),
  ['ボウルにひき肉を練る。1の野菜類を加える。', '2を俵形に整える。'],
)
eq('IT⑥: 印が無い文はアプリ側でも変わらない', stripImportedMarkup('鍋に水を入れて沸かす'), '鍋に水を入れて沸かす')
eq('IT⑥: 3桁以上の数字は強調の印とみなさない', stripImportedMarkup('**170**度で焼く'), '**170**度で焼く')

// ---- ④(便IT): 丸数字の参照が剥がれて手順の文が壊れる(貼り付け) ----
// 白ごはん.com実測「②で準備した野菜を炒めます。」→「で準備した野菜を炒めます。」。
// M4のガードが「(1)」「1.」の形にしか効いておらず、丸数字と「で」が対象外だった
{
  const r = parseRecipeText('鮭の南蛮漬け\n作り方\n①南蛮酢を作る。\n②で準備した野菜を炒めます。\n②の鮭に小麦粉をまぶします。')
  eq('IT④: 丸数字+「で」始まりは前の手順への参照(番号を剥がさない)', r.steps[1], '②で準備した野菜を炒めます。')
  eq('IT④: 丸数字+「の」始まりも参照(番号を剥がさない)', r.steps[2], '②の鮭に小麦粉をまぶします。')
  eq('IT④: ふつうの丸数字手順はこれまでどおり番号を剥がす', r.steps[0], '南蛮酢を作る。')
}
{
  // 誤爆の歯止め: 「に」「で」は食材名の出だしにもなる。直後がひらがななら参照とみなさない
  const r = parseRecipeText('豚汁\n作り方\n①にんじんを切る\n②でんぷんを水で溶く\n③に加えて混ぜる')
  eq('IT④: 「①にんじんを切る」は参照ではない(番号を剥がす)', r.steps[0], 'にんじんを切る')
  eq('IT④: 「②でんぷんを水で溶く」も参照ではない(番号を剥がす)', r.steps[1], 'でんぷんを水で溶く')
  eq('IT④: 「③に加えて混ぜる」は参照(番号を剥がさない)', r.steps[2], '③に加えて混ぜる')
}

// ---- ⑤(便IT): 「◯◯の材料」「◯◯の作り方」が見出しと認識されない(貼り付け) ----
// 白ごはん.com実測: 料理名が「鮭の南蛮漬けの材料 (作りやすい分量)」になり、
// 「揚げずに作る、鮭の南蛮漬けの作り方」「南蛮酢の作り方」が材料の行に混じっていた
{
  const r = parseRecipeText(
    [
      '鮭の南蛮漬けの材料 (作りやすい分量)',
      '【 鮭の南蛮漬けの材料 】',
      '生鮭 … 3切',
      '玉ねぎ … 1/2個',
      '【 南蛮酢の材料 】',
      '酢 … 150ml',
      '揚げずに作る、鮭の南蛮漬けの作り方',
      '南蛮酢の作り方',
      '上記レシピの分量を鍋に合わせ、一度沸騰させて作ります。',
      '鮭の南蛮漬けの作り方（まずは野菜を炒めます）',
      '野菜はそれぞれ食べやすい太さの千切りにしておきます。',
    ].join('\n'),
  )
  eq('IT⑤: 料理名は見出しの「の材料 (…)」を外したもの', r.title, '鮭の南蛮漬け')
  eq('IT⑤: 見出し行が材料に混ざらない', r.ingredients, [
    { name: '生鮭', amount: '3', unit: '切' },
    { name: '玉ねぎ', amount: '1/2', unit: '個' },
    { name: '酢', amount: '150', unit: 'ml' },
  ])
  eq('IT⑤: 見出し行が手順にも混ざらない', r.steps, [
    '上記レシピの分量を鍋に合わせ、一度沸騰させて作ります。',
    '野菜はそれぞれ食べやすい太さの千切りにしておきます。',
  ])
}
{
  // 誤爆の歯止め: 文の途中に「の作り方」が出てくる行は見出しにしない
  const r = parseRecipeText(
    '肉じゃが\nじゃがいも 3個\n作り方\n詳しい南蛮酢の作り方はこちらから。\n水を加えて15分煮る',
  )
  eq('IT⑤: 「〜の作り方はこちらから。」は見出しにしない(手順として残る)', r.steps, [
    '詳しい南蛮酢の作り方はこちらから。',
    '水を加えて15分煮る',
  ])
}
{
  // ⑤の付け合わせ(便IT): 「このレシピの材料」を見出しと読めるようになったぶん、その直下にある
  // 「数量：シェル型6〜9個分」(cotta実測)が材料の1行目に入るようになったので、材料として拾わない
  const r = parseRecipeText('基本のマドレーヌ\nこのレシピの材料\n数量：シェル型6〜9個分\n全卵 1個分\n砂糖 50g')
  eq('IT⑤: 「数量：…」の行は材料にしない', r.ingredients, [
    { name: '全卵', amount: '1', unit: '個分' },
    { name: '砂糖', amount: '50', unit: 'g' },
  ])
  eq('IT⑤: 「数量：…」を落としても料理名は残る', r.title, '基本のマドレーヌ')
}
{
  // 人数が書いてあるときは、値の側だけ残して人数として読む
  const r = parseRecipeText('肉じゃが\nこのレシピの材料\n数量：4人分\nじゃがいも 3個')
  eq('IT⑤: 「数量：4人分」は人数として読む', r.servings, 4)
  eq('IT⑤: 「数量：4人分」は材料に混ざらない', r.ingredients, [{ name: 'じゃがいも', amount: '3', unit: '個' }])
}

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

// ---------- findTimeTokens: 時間の範囲表記(2026-08-12 便FU-5・利用者テスト) ----------
// 指摘（原文）:「『魚焼きグリルの弱火で12〜 ⏱15分 焼く。』— 範囲の『12〜』だけが取り残されて、
// 時間チップと分断表示になります。『1〜 ⏱2分 煮る』も同様」
{
  const { findTimeTokens } = await import('../src/logic/time.ts')
  const shown = (text) => findTimeTokens(text).map((t) => t.text)
  const secs = (text) => findTimeTokens(text).map((t) => t.seconds)

  eq('FU-5 「12〜15分」は1つのまとまりにする', shown('魚焼きグリルの弱火で12〜15分焼く。'), ['12〜15分'])
  eq('FU-5 「1〜2分」も1つ', shown('弱火で1〜2分煮る。'), ['1〜2分'])
  eq('FU-5 半角チルダ・ハイフンの範囲も1つ', [shown('3~4分ゆでる。'), shown('8-10分焼く。')], [['3~4分'], ['8-10分']])
  eq('FU-5 全角数字の範囲も1つ（半角に直して出す）', shown('１２〜１５分焼く。'), ['12〜15分'])
  eq('FU-5 単位が2回書かれる形（12分〜15分）も1つ', shown('12分〜15分煮る。'), ['12分〜15分'])
  // 2026-08-14 便GK: はかる長さを2つに分けた（タイマー＝短いほう seconds／段取りの見積り＝
  // 長いほう maxSeconds）。理由は GK-3 のケースと logic/time.ts の解説にある
  const maxSecs = (text) => findTimeTokens(text).map((t) => t.maxSeconds)
  eq('FU-5 段取りの見積りに使う長さは範囲の長いほうのまま', [maxSecs('12〜15分焼く。'), maxSecs('1〜2分煮る。')], [[900], [120]])
  eq('FU-5 単位が2回の形でも見積りは長いほう', maxSecs('12分〜15分煮る。'), [900])
  // 範囲でないものを巻き込まない
  eq('FU-5 範囲でない時間はそのまま', shown('中火で15分煮る。'), ['15分'])
  eq('FU-5 2つの別々の時間は別々のまま', shown('5分炒めてから、10分煮る。'), ['5分', '10分'])
  eq('FU-5 「1時間半」はこれまでどおり1つ', [shown('1時間半おく。'), secs('1時間半おく。')], [['1時間半'], [5400]])
  eq('FU-5 「5分10秒」は範囲ではないのでまとめない', shown('5分10秒はかる。'), ['5分', '10秒'])
  eq('FU-5 数字が直前にあっても区切りが無ければ取り込まない', shown('600Wで3分加熱する。'), ['3分'])
  eq('FU-5 「3〜4人分」は時間ではないので拾わない', shown('3〜4人分の目安。'), [])
  eq('FU-5 「180-200℃で15分」の温度は巻き込まない', shown('180-200℃で15分焼く。'), ['15分'])
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

  // 2026-08-03 便DS/実機FB②: 自分で時間を決めたタイマーを、手順のタイマーと見分けるための印。
  // 調理中モードから始めると戻り先として手順番号を持つため、番号バッジだけでは区別できず
  // 「どのレシピのどの手順のタイマーか」と誤読されていた。印は保存・読み戻しでも保たれること、
  // 印を持たない古い保存は従来どおり手順のタイマー扱いに落ちることを固定する
  const customStored = JSON.stringify([
    {
      id: 8,
      key: 'custom-1-180',
      label: 'タイマー',
      doneLabel: '終わり',
      recipeId: 1,
      stepNumber: 2,
      endsAt: now + 60_000,
      totalSeconds: 180,
      done: false,
      muted: false,
      isCustom: true,
    },
  ])
  eq('便DS② 自分で決めたタイマーの印が読み戻しでも保たれる', parseStoredTimers(customStored, now)[0].isCustom, true)
  eq(
    '便DS② 印を持ったまま戻り先の手順番号も保たれる(タップで手順へ戻れる)',
    parseStoredTimers(customStored, now)[0].stepNumber,
    2,
  )
  eq('便DS② 印の無い古い保存は手順のタイマー扱い(既存の見た目のまま)', parseStoredTimers(stored, now)[0].isCustom, false)
  eq(
    '便DS② 印が真偽値でない壊れた保存でも手順のタイマー扱いに倒す',
    parseStoredTimers(customStored.replace('"isCustom":true', '"isCustom":"はい"'), now)[0].isCustom,
    false,
  )

  // 2026-08-10 便EZ①: 声の「ストップ」でタイマーを一時停止できるようにしたぶんの回帰。
  // 止まっている間は時計を進めない／読み戻しても「終わり」に化けない／並びの後ろに回る
  const { timerRemainingSeconds } = await import('../src/logic/timerOrder.ts')
  eq(
    '便EZ① 動作中の残りは終了予定時刻から数える',
    timerRemainingSeconds({ endsAt: now + 90_000 }, now),
    90,
  )
  eq(
    '便EZ① 一時停止中は止めた時点の残りを出す(時計が進まない)',
    [
      timerRemainingSeconds({ endsAt: now + 90_000, pausedRemainingMs: 90_000 }, now),
      timerRemainingSeconds({ endsAt: now + 90_000, pausedRemainingMs: 90_000 }, now + 60_000),
    ],
    [90, 90],
  )
  eq('便EZ① 残りが負になっても0で止める', timerRemainingSeconds({ endsAt: now - 5_000 }, now), 0)
  eq(
    '便EZ① 一時停止中のものは動作中より後ろに並ぶ(次に鳴る順を読み違えない)',
    sortTimersForDisplay([
      { id: 1, done: false, endsAt: 1_000, pausedRemainingMs: 1_000 },
      { id: 2, done: false, endsAt: 9_000 },
      { id: 3, done: true, endsAt: 20_000 },
    ]).map((t) => t.id),
    [3, 2, 1],
  )
  const pausedStored = JSON.stringify([
    {
      id: 9,
      key: '1-2-900',
      label: '肉じゃが',
      doneLabel: '煮込み終わり',
      recipeId: 1,
      stepNumber: 3,
      endsAt: now + 300_000,
      totalSeconds: 900,
      done: false,
      muted: false,
      pausedRemainingMs: 300_000,
    },
  ])
  eq(
    '便EZ① 一時停止したまま読み込み直しても、止まったまま残りが保たれる',
    (() => {
      const t = parseStoredTimers(pausedStored, now + 3_600_000 - 1)[0]
      return [t.pausedRemainingMs, t.done, t.endsAt - (now + 3_600_000 - 1)]
    })(),
    [300_000, false, 300_000],
  )
  eq(
    '便EZ① 止めたまま放置して終了予定から1時間過ぎた分は復元しない(翌日に残らない)',
    parseStoredTimers(pausedStored, now + 300_000 + RESTORE_GRACE_MS + 1).length,
    0,
  )
  eq(
    '便EZ① 一時停止の印が壊れている古い保存は、従来どおり動作中として読み戻す',
    (() => {
      const t = parseStoredTimers(pausedStored.replace('"pausedRemainingMs":300000', '"pausedRemainingMs":"はい"'), now)[0]
      return [t.pausedRemainingMs, t.done]
    })(),
    [undefined, false],
  )
}

// ---------- 便EZ②: タイマーが指す手順の呼び方(丸数字＋レシピ内の手順番号) ----------
// オーナー実機「タイマー『段取りの〜を開く』→『手順⑦3-1を開く』、『段取りの7番目』は削除」。
// 画面のバッジは「段取りの通し番号(大きい丸)＋レシピ内の手順番号(小さい丸・料理の色)」の2つで、
// 文字の側だけが「段取りの7番目」と別の呼び方をしていた
{
  const { circledNumber, naviStepText } = await import('../src/logic/naviStepText.ts')
  eq('便EZ② 1〜20は①〜⑳', [circledNumber(1), circledNumber(7), circledNumber(20)], ['①', '⑦', '⑳'])
  eq('便EZ② 21〜35は㉑〜㉟', [circledNumber(21), circledNumber(35)], ['㉑', '㉟'])
  eq('便EZ② 36〜50は㊱〜㊿', [circledNumber(36), circledNumber(50)], ['㊱', '㊿'])
  eq(
    '便EZ② 丸数字の無い範囲はそのままの数字に落とす(表示が消えない)',
    [circledNumber(0), circledNumber(51), circledNumber(1.5)],
    ['0', '51', '1.5'],
  )
  eq('便EZ② 段取り7番目・レシピ内3-1は「⑦（3-1）」', naviStepText(7, '3-1'), '⑦（3-1）')
  eq('便EZ② レシピ内の手順番号が無い工程(湯を沸かす)は丸数字だけ', naviStepText(7), '⑦')
  // --- 便FU-4(2026-08-12 利用者テスト): 丸数字と数字がくっついて読めない ---
  // 指摘（原文）:「『前に開いていた手順⑫5から始まります。』⑫と5がくっついていて読めません。
  // タイマー調整のラベルも『手順③2のタイマーを調整』」
  eq('FU-4 丸数字とレシピ内の手順番号を続けて書かない', naviStepText(12, '5'), '⑫（5）')
  eq('FU-4 レシピ内番号が「3-1」の工程も同じ形', naviStepText(7, '3-1'), '⑦（3-1）')
  eq('FU-4 2桁のレシピ内番号でも区切りが入る', naviStepText(3, '12'), '③（12）')
  eq(
    'FU-4 くっついた形（⑫5・③2）はもう作らない',
    [naviStepText(12, '5'), naviStepText(3, '2')].some((s) => /[①-⑳㉑-㉟㊱-㊿]\d/.test(s)),
    false,
  )
}

// ---------- cookedWithinDays: 「最近作った」判定(2026-07-29 便CI/C08) ----------
// 旧実装は cookedLogs[0] の1件だけを見ており、addCookedLog が日付を見ずに先頭へ積むため、
// 過去の日付を後から記録すると「今日作ったばかりのレシピ」が最近作っていない扱いになっていた
// (「今日なに作る？」の候補と献立の自動提案が誤って拾う)。全件の最大日付で判定する。
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
  // (1) 期間の境目: 「◯か月より前」はちょうど◯か月前の当日を含まない
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
  const archDupIds = archTargets
    .filter((t) => t.source === 'recipe' && t.sourceId === 2)
    .map((t) => t.id)
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
  // 2026-08-20 便IH・④: 名前を uchi-recipe-records- から uchi-recipe-archive- に変えた。
  // 名前そのものの決まりごとは下の IH-4 でまとめて見る
  eq('ARCH ファイル名にバックアップと同じ名前を使わない', archiveFileName(new Date(2026, 7, 2)), 'uchi-recipe-archive-2026-08-02.json')
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

// ---------- 実効食数の優先順位(2026-08-03 便DK・設定「ふだん作る人数」) ----------
// オーナー確定「3人家族なら予算や買い物メモは3人分で計算した数値が必要」。
// 優先順位は ①枠ごとに決めた食数 ②設定「ふだん作る人数」 ③レシピの登録人数分 の順で、
// 買い物メモの分量と概算食費が別々の人数分で計算されないよう、この1本だけを使う。
// 再発防止の要点: ①②とも未設定なら③＝従来とまったく同じ値になること(後方互換)
{
  eq('DK-SERV 枠ごとに決めた食数が最優先(設定より強い)', effectiveMealServings(4, 3, 2), 4)
  eq('DK-SERV 枠が未設定なら設定「ふだん作る人数」', effectiveMealServings(undefined, 3, 2), 3)
  eq(
    'DK-SERV 後方互換: 枠も設定も無ければレシピの登録人数分(従来と同値)',
    effectiveMealServings(undefined, undefined, 2),
    2,
  )
  eq(
    'DK-SERV どれも無い/壊れた値なら1人分',
    [
      effectiveMealServings(undefined, undefined, undefined),
      effectiveMealServings(0, 0, 0),
      effectiveMealServings(undefined, undefined, -3),
    ],
    [1, 1, 1],
  )
  eq('DK-SERV 範囲外の値は1〜20に収める(設定経由でも上限を破らせない)', effectiveMealServings(undefined, 50, 2), 20)
  // 「既定に戻す」の戻り先＝枠の食数を無視した値。ボタンの文言と実際の戻り先を同じ関数から出す
  eq('DK-SERV 既定の食数: 設定があればその人数', defaultMealServings(3, 2), 3)
  eq('DK-SERV 既定の食数: 設定が無ければレシピの登録人数分', defaultMealServings(undefined, 4), 4)
  eq('DK-SERV 既定の食数は枠ごとの食数を見ない', defaultMealServings(undefined, 2), 2)
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
  // 2026-08-15 オーナー指示「全体一致に揃えて」で、「次」は発話まるごとの一致だけになった。
  // その副作用として**「次へ」を含む複合の言い方は通らなくなる**（ここでは読み上げ側に落ちる）。
  // 独り言（「次に塩を入れるんだっけ」）で手順が進む事故を消すほうを取った、という記録
  eq('便CK/④-1 「次へ」を含む複合は、もう「次へ」にはならない', matchVoiceCommand('次へもう一回'), 'repeat')

  // 2026-08-03 便DS/実機FB⑤: 時間の書かれていない手順で「タイマー」とだけ言うと、
  // 聞き取れていても何秒にすればよいか決められず、画面に何も出ないまま終わっていた。
  // 「決められない」ことが呼び出し側に伝わる形(undefined)を固定し、案内を出す道を守る
  eq('便DS⑤ 「3分タイマー」は発話の分数を使う', resolveVoiceTimerSeconds('3分タイマー', undefined, undefined), 180)
  eq(
    '便DS⑤ 発話の分数は手順の分数より優先される',
    resolveVoiceTimerSeconds('10分タイマー', 15, 300),
    600,
  )
  eq('便DS⑤ 「タイマー」だけなら手順に設定された分数を使う', resolveVoiceTimerSeconds('タイマー', 15, undefined), 900)
  eq(
    '便DS⑤ 手順に分数が無ければ本文中の最初の時間表記を使う',
    resolveVoiceTimerSeconds('タイマー', undefined, 300),
    300,
  )
  eq(
    '便DS⑤ 時間の手掛かりが何も無ければ「決められない」を返す(案内を出す合図)',
    resolveVoiceTimerSeconds('タイマー', undefined, undefined),
    undefined,
  )

  // 2026-08-10 便EZ①: オーナー実機「タイマー音声操作→『ストップ』は聞き取れていても
  // タイマーとまらない。他はOK」。**聞き取り(matchVoiceCommand)は元から正しく 'stop' を
  // 返していた**＝真因は画面側で 'stop' を読み上げの停止にしか繋いでいなかったこと。
  // 語形と、複数動いているときにどれを止めるかの決め方を、ここで固定する
  eq('便EZ① 「ストップ」は聞き取れている(判定は元から正しい)', matchVoiceCommand('ストップ'), 'stop')
  eq('便EZ① かなで返る端末の「すとっぷ」も受ける', matchVoiceCommand('すとっぷ'), 'stop')
  eq('便EZ① 「タイマーストップ」はタイマーの新規起動にしない', matchVoiceCommand('タイマーストップ'), 'stop')
  eq('便EZ① 「タイマー止めて」も止める側に倒す', matchVoiceCommand('タイマー止めて'), 'stop')
  eq('便EZ① 「停止」も受ける', matchVoiceCommand('停止'), 'stop')
  eq('便EZ① 「3分タイマー」は従来どおり新規起動のまま', matchVoiceCommand('3分タイマー'), 'timer')

  const stopTimers = [
    // 肉じゃが(recipeId:1)の2本。残りは 5分 と 1分
    { id: 1, done: false, endsAt: 300_000, recipeId: 1 },
    { id: 2, done: false, endsAt: 60_000, recipeId: 1 },
    // 味噌汁(recipeId:2)。残り30秒＝全体でいちばん先に鳴る
    { id: 3, done: false, endsAt: 30_000, recipeId: 2 },
  ]
  eq(
    '便EZ① いま画面に出している料理のタイマーを優先して止める',
    pickVoiceStopTarget(stopTimers, 1)?.id,
    2,
  )
  eq(
    '便EZ① その料理のタイマーが無ければ、次に鳴る1本を止める',
    pickVoiceStopTarget(stopTimers, 3)?.id,
    3,
  )
  eq(
    '便EZ① どの料理を見ているか分からないときも、次に鳴る1本を止める',
    pickVoiceStopTarget(stopTimers)?.id,
    3,
  )
  eq(
    '便EZ① 終わったタイマーは声では触らない(片付け=削除は取り消せないため)',
    pickVoiceStopTarget([{ id: 4, done: true, endsAt: 10, recipeId: 1 }], 1),
    undefined,
  )
  eq(
    '便EZ① すでに止めてあるタイマーは選ばない(「ストップ」で再開しない)',
    pickVoiceStopTarget([{ id: 5, done: false, endsAt: 10, recipeId: 1, pausedRemainingMs: 10 }], 1),
    undefined,
  )
  eq('便EZ① 1本も動いていなければ何も止めない', pickVoiceStopTarget([], 1), undefined)

  // 2026-08-10 便FC: オーナー実機フィードバック3件（タイマー）
  //   ・「いったん止める」→「一時停止」（画面の文言。声でもこの語で止められること）
  //   ・「一時停止の後に音声操作で再開できない」→ 声に「再開」を足す
  //   ・「『もう一度』で読み上げは、1回目からになるので『読み上げ』に変更」
  // 画面のボタン名と声の語がずれると「案内どおり言っても黙る」（便CK/④-1と同型）ので、
  // **画面に出ている語をそのまま言えば効く**ことをここで固定する
  eq('便FC① 画面の「一時停止」をそのまま言っても止まる', matchVoiceCommand('一時停止'), 'stop')
  eq('便FC② 画面の「再開」をそのまま言うと動かし直す', matchVoiceCommand('再開'), 'resume')
  eq('便FC② かなで返る端末の「さいかい」も受ける', matchVoiceCommand('さいかい'), 'resume')
  eq('便FC② オーナー案の「スタート」も受ける', matchVoiceCommand('スタート'), 'resume')
  eq('便FC② かなの「すたーと」も受ける', matchVoiceCommand('すたーと'), 'resume')
  eq('便FC② 「タイマー再開」はタイマーの新規起動にしない', matchVoiceCommand('タイマー再開'), 'resume')
  eq('便FC③ 画面の「読み上げ」で読み上げ直す', matchVoiceCommand('読み上げ'), 'repeat')
  eq('便FC③ かなの「よみあげ」も受ける', matchVoiceCommand('よみあげ'), 'repeat')
  eq('便FC③ 言い慣れた「もう一回」も今までどおり受ける', matchVoiceCommand('もう一回'), 'repeat')
  // 「読み上げ」を語に足したので、「読み上げストップ」と続けて言われる形が生まれた。
  // 止める側を先に判定する（読み上げ直してから止まる、が起きない）。
  // 2026-08-15 便GS でオーナー指示「読み上げをストップする方法が、音声にない」を受け、
  // **「読み上げ」と一緒に言われた止める言葉は読み上げの停止**に変えた（'stop' → 'readStop'）。
  // 「ストップ」単独がタイマーである点（便EZ）は変えていない＝下の便GS②で固定する
  eq('便FC③→GS② 「読み上げストップ」は読み上げを止める', matchVoiceCommand('読み上げストップ'), 'readStop')
  eq('便FC③→GS② 「読み上げ止めて」も読み上げを止める', matchVoiceCommand('読み上げ止めて'), 'readStop')
  eq('便FC 「3分タイマー」は従来どおり新規起動のまま', matchVoiceCommand('3分タイマー'), 'timer')

  // 「再開」でどれを動かすか。止めるとき(pickVoiceStopTarget)の裏返しにそろえる。
  // **残りは pausedRemainingMs で比べる**（止まっている間 endsAt は過去のまま固まるので、
  // endsAt で比べると「止めた順」になり、次に鳴るはずだった1本から外れる）
  const resumeTimers = [
    // 肉じゃが(recipeId:1)の2本。止めた時点の残りは 5分 と 1分
    { id: 1, done: false, endsAt: 1, recipeId: 1, pausedRemainingMs: 300_000 },
    { id: 2, done: false, endsAt: 2, recipeId: 1, pausedRemainingMs: 60_000 },
    // 味噌汁(recipeId:2)。残り30秒＝全体でいちばん先に鳴るはずだった1本
    { id: 3, done: false, endsAt: 3, recipeId: 2, pausedRemainingMs: 30_000 },
  ]
  eq(
    '便FC② いま画面に出している料理の止めたタイマーを優先して動かす',
    pickVoiceResumeTarget(resumeTimers, 1)?.id,
    2,
  )
  eq(
    '便FC② その料理のものが無ければ、動かせばいちばん先に鳴る1本',
    pickVoiceResumeTarget(resumeTimers, 3)?.id,
    3,
  )
  eq(
    '便FC② どの料理を見ているか分からないときも、いちばん先に鳴る1本',
    pickVoiceResumeTarget(resumeTimers)?.id,
    3,
  )
  eq(
    '便FC② 動いているタイマーは「再開」で触らない（止まっているものだけ）',
    pickVoiceResumeTarget([{ id: 4, done: false, endsAt: 10, recipeId: 1 }], 1),
    undefined,
  )
  eq(
    '便FC② 終わったタイマーは動かさない（片付け＝削除は声で受けない）',
    pickVoiceResumeTarget([{ id: 5, done: true, endsAt: 10, recipeId: 1, pausedRemainingMs: 10 }], 1),
    undefined,
  )
  eq('便FC② 1本も止めていなければ何も動かさない', pickVoiceResumeTarget([], 1), undefined)
  eq('便DS⑤ 「0分タイマー」は時間として使わず次の候補へ譲る', resolveVoiceTimerSeconds('0分タイマー', 5, undefined), 300)
  eq(
    '便DS⑤ 手順の分数が0でも「決められない」に落ちる(0秒タイマーを作らない)',
    resolveVoiceTimerSeconds('タイマー', 0, 0),
    undefined,
  )

  // ---------- 2026-08-15 便GS: オーナー実機（iPhone SE2・Chrome）フィードバック2件 ----------
  //   ①「『戻って』『戻る』の他に『前へ』『前』も対応したい（ボタンと同じ表記にも対応したい）」
  //   ②「読み上げをストップする方法が、音声にない。タイマーの停止と混同しそうなので、
  //     片方優先するならタイマー」
  //
  // ①は**部分一致で「前」を足すと「名前」「手前」「この前」で手順が飛ぶ**。色の言葉
  // （matchVoiceColor）と同じ「短い発話の全体一致」で受ける＝発話まるごとが一致したときだけ。
  // 台所で理由の分からない手順飛びが起きると、原因を突き止める手段が利用者にない
  eq('便GS① 漢字1文字の「前」で手順を戻す', matchVoiceCommand('前'), 'prev')
  eq('便GS① かなの「まえ」も従来どおり戻す', matchVoiceCommand('まえ'), 'prev')
  eq('便GS① 「前に」も戻す', matchVoiceCommand('前に'), 'prev')
  eq('便GS① 端末が付ける句点は落としてから比べる', matchVoiceCommand('前。'), 'prev')
  eq('便GS① 画面のボタンどおりの「前へ」は従来どおり戻す', matchVoiceCommand('前へ'), 'prev')
  eq('便GS① かなの「まえへ」も戻す', matchVoiceCommand('まえへ'), 'prev')
  eq('便GS① 「戻る」は従来どおり戻す', matchVoiceCommand('戻る'), 'prev')
  eq('便GS① 「戻って」も従来どおり戻す', matchVoiceCommand('戻って'), 'prev')
  // 誤爆の固定（部分一致に戻したらここが赤になる）
  eq('便GS① 「名前」では戻らない', matchVoiceCommand('名前'), undefined)
  eq('便GS① かなで返る端末の「なまえ」でも戻らない', matchVoiceCommand('なまえ'), undefined)
  eq('便GS① 「手前」では戻らない', matchVoiceCommand('手前'), undefined)
  eq('便GS① かなで返る端末の「てまえ」でも戻らない', matchVoiceCommand('てまえ'), undefined)
  eq('便GS① 「この前」では戻らない', matchVoiceCommand('この前'), undefined)
  eq('便GS① かなで返る端末の「このまえ」でも戻らない', matchVoiceCommand('このまえ'), undefined)
  eq('便GS① 「名前をつけて保存」でも戻らない', matchVoiceCommand('名前をつけて保存'), undefined)
  eq('便GS① 「手前に引く」でも戻らない', matchVoiceCommand('手前に引く'), undefined)
  eq('便GS① 「この前の残り」でも戻らない', matchVoiceCommand('この前の残り'), undefined)

  // ①の続き: 並行調理ナビの調理中モードの左上にある「最初の手順へ」も、ボタンの表記
  // そのままで言えるようにする（オーナー「ボタンと同じ表記にも対応したい」）。
  // 「最初」を部分一致にすると手順文の「最初に玉ねぎを炒める」で飛ぶので、ここも全体一致
  eq('便GS① 画面のボタンどおりの「最初の手順へ」で先頭へ戻る', matchVoiceCommand('最初の手順へ'), 'first')
  eq('便GS① 「最初の手順」でも同じ', matchVoiceCommand('最初の手順'), 'first')
  eq('便GS① 「最初へ」でも同じ', matchVoiceCommand('最初へ'), 'first')
  eq('便GS① 「最初」だけでも同じ', matchVoiceCommand('最初'), 'first')
  eq('便GS① かなで返る端末の「さいしょ」も受ける', matchVoiceCommand('さいしょ'), 'first')
  eq('便GS① かなの「さいしょのてじゅんへ」も受ける', matchVoiceCommand('さいしょのてじゅんへ'), 'first')
  eq('便GS① 手順文の「最初に玉ねぎを炒める」では飛ばない', matchVoiceCommand('最初に玉ねぎを炒める'), undefined)
  eq('便GS① 「最初は弱火で」でも飛ばない', matchVoiceCommand('最初は弱火で'), undefined)

  // ②読み上げを止める声。**「読み上げ」の語と一緒に言われたときだけ**読み上げを止める。
  // オーナー指示「タイマーの停止と混同しそうなので、片方優先するならタイマー」に従い、
  // **「ストップ」単独はタイマーのまま**（2026-08-10 便EZ でオーナー指摘を受けて直した挙動）。
  // ここが今回いちばん壊してはいけない場所
  eq('便GS② 「ストップ」単独は今までどおりタイマー', matchVoiceCommand('ストップ'), 'stop')
  eq('便GS② かなの「すとっぷ」単独もタイマー', matchVoiceCommand('すとっぷ'), 'stop')
  eq('便GS② 「止めて」単独もタイマー', matchVoiceCommand('止めて'), 'stop')
  eq('便GS② 「とめて」単独もタイマー', matchVoiceCommand('とめて'), 'stop')
  eq('便GS② 「停止」単独もタイマー', matchVoiceCommand('停止'), 'stop')
  eq('便GS② 画面の「一時停止」もタイマー', matchVoiceCommand('一時停止'), 'stop')
  eq('便GS② 「タイマーストップ」もタイマー', matchVoiceCommand('タイマーストップ'), 'stop')
  eq('便GS② 「タイマー止めて」もタイマー', matchVoiceCommand('タイマー止めて'), 'stop')
  // 「読み上げ」と一緒に言われたときだけ読み上げが止まる
  eq('便GS② 「読み上げストップ」は読み上げを止める', matchVoiceCommand('読み上げストップ'), 'readStop')
  eq('便GS② 「読み上げ止めて」も読み上げを止める', matchVoiceCommand('読み上げ止めて'), 'readStop')
  eq('便GS② 「読み上げやめて」も読み上げを止める', matchVoiceCommand('読み上げやめて'), 'readStop')
  eq('便GS② 「読み上げをやめて」も受ける', matchVoiceCommand('読み上げをやめて'), 'readStop')
  eq('便GS② 「読み上げ停止」も受ける', matchVoiceCommand('読み上げ停止'), 'readStop')
  eq('便GS② 「読み上げ中止」も受ける', matchVoiceCommand('読み上げ中止'), 'readStop')
  eq('便GS② かなで返る端末の「よみあげすとっぷ」も受ける', matchVoiceCommand('よみあげすとっぷ'), 'readStop')
  eq('便GS② かなの「よみあげやめて」も受ける', matchVoiceCommand('よみあげやめて'), 'readStop')
  // 読み上げ側の従来の言い方は変えていない
  eq('便GS② 「読み上げ」単独は今までどおり読み上げ直す', matchVoiceCommand('読み上げ'), 'repeat')
  eq('便GS② かなの「よみあげ」単独も読み上げ直す', matchVoiceCommand('よみあげ'), 'repeat')
  eq('便GS② 「読み上げて」も読み上げ直す', matchVoiceCommand('読み上げて'), 'repeat')
  eq('便GS② 「もう一回」も今までどおり読み上げ直す', matchVoiceCommand('もう一回'), 'repeat')
  eq('便GS② 「もう一度読み上げて」も読み上げ直す', matchVoiceCommand('もう一度読み上げて'), 'repeat')
  // 判定の順番を変えた（読み上げの組を再開・ストップより前に出した）ので、
  // 先に決まっていたものが動いていないことを確かめる
  // 「次」を全体一致にした（2026-08-15 オーナー指示）ので、複合の言い方は次へにならない
  eq('便GS② 「次へ」単独は進む', matchVoiceCommand('次へ'), 'next')
  eq('便GS② 独り言では進まない（次に塩を…）', matchVoiceCommand('次に塩を入れるんだっけ'), undefined)
  eq('便GS② 独り言では進まない（次の手順が長い）', matchVoiceCommand('次の手順が長いな'), undefined)
  eq('便GS② 「次」単独も進む（オーナーが実機で確認した言い方）', matchVoiceCommand('次'), 'next')
  eq('便GS② 「再開」は従来どおり動かし直す', matchVoiceCommand('再開'), 'resume')
  eq('便GS② 「タイマー再開」も従来どおり', matchVoiceCommand('タイマー再開'), 'resume')
  eq('便GS② 「3分タイマー」は従来どおり新規起動', matchVoiceCommand('3分タイマー'), 'timer')
  eq('便GS② どれでもない言葉は今までどおり無反応', matchVoiceCommand('こんばんは'), undefined)
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

// ---------- 月間画面のサンプルデモの見本データ(2026-08-02 便DC) ----------
{
  // 見本は同梱の基本レシピの名前で組む。レシピ名を変えたらここで気づけるようにする
  const known = new Set(starterDefs.map((d) => d.title))
  const unknown = demoRecipeTitles().filter((t) => !known.has(t))
  eq('DC-DEMO 見本の料理名はすべて基本レシピにある', unknown, [])

  const demo = buildMonthDemoData()
  eq('DC-DEMO 見本の「今日」は固定', demo.today, DEMO_TODAY)
  eq('DC-DEMO デモの中ではPro機能が開く', !!demo.settings.proCode, true)
  // 過ぎた日=作った記録・今日から先=登録した献立、の切り分けが見本データ側で崩れていないこと
  // (崩れると月間サマリーの合計に入らない記録・献立が出て、見本が実物と違う説明になる)
  const logDates = demo.recipes.flatMap((r) => r.cookedLogs.map((l) => l.date))
  eq('DC-DEMO 作った記録はすべて過ぎた日', logDates.every((d) => d < DEMO_TODAY), true)
  eq(
    'DC-DEMO 登録した献立はすべて今日から先',
    demo.entries.every((e) => e.date >= DEMO_TODAY),
    true,
  )
  eq('DC-DEMO 見本は同じ月に収まっている', [...logDates, ...demo.entries.map((e) => e.date)].every((d) => d.slice(0, 7) === DEMO_TODAY.slice(0, 7)), true)
  // 献立エントリのidは重複しない(週+月を束ねるときにidをキーにしているため)
  eq('DC-DEMO 献立のidは重複しない', new Set(demo.entries.map((e) => e.id)).size, demo.entries.length)
  // 写真を渡さなくても組み立てられる(オフライン初回など、写真が読めない環境で落ちない)
  eq('DC-DEMO 写真なしでも組み立てられる', logDates.length > 0, true)
  eq('DC-DEMO 写真なしなら記録に写真は付かない', demo.recipes.every((r) => r.cookedLogs.every((l) => l.photo === undefined)), true)
  // 写真を渡した分だけ付く(キーはpublic/demo/*.webpのファイル名と対応する)
  const photos = new Map(DEMO_PHOTO_KEYS.map((k) => [k, new Blob([k])]))
  const withPhotos = buildMonthDemoData(photos)
  const photoCount = withPhotos.recipes.reduce(
    (sum, r) => sum + r.cookedLogs.filter((l) => l.photo).length,
    0,
  )
  eq('DC-DEMO 写真は用意した枚数ぶん使う', photoCount, DEMO_PHOTO_KEYS.length)
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

  // 上下移動(隣同士の入れ替え方式)
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

  const text = confirmContentText(buildBulkDeleteConfirm(impact))
  // 規約F: 何が消えるか・何が残るかを件数つきで両方書く(「よろしいですか？」だけは禁止)
  eq('CT-DEL 確認文に削除する品数が入る', /レシピ3品を削除します/.test(text), true)
  eq('CT-DEL 確認文に作った記録の件数が入る', /作った記録3件/.test(text), true)
  eq('CT-DEL 確認文に写真の枚数が入る', /写真2枚/.test(text), true)
  eq('CT-DEL 確認文に献立の予定の数が入る', /献立の予定4[品件]/.test(text), true)
  eq('CT-DEL 確認文に今日の献立の数が入る', /今日の献立2[品件]/.test(text), true)
  eq('CT-DEL 確認文に元に戻せないことが入る', text.includes('元に戻せません'), true)
  eq('CT-DEL 確認文に残るレシピの品数が入る', /他のレシピ106品/.test(text), true)
  // 2026-08-15 便GW: 「残るもの」は太字の項目名になったので、項目名と中身の両方を見る
  eq('CT-DEL 確認文に残るものが入る', /残るもの: [^\n]*買い物メモ・食材の在庫/.test(text), true)
  eq('CT-DEL 「よろしいですか？」だけで終わらせない', text.includes('よろしいですか'), false)
  // 基本レシピだけは入れ直しで戻せる(ただし記録は戻らない)ことを区別して書く。
  // 規約H: 場所は指示語ではなく画面名・ボタン名で言う
  eq('CT-DEL 基本レシピの戻し方を添える', /基本レシピ1品は、設定画面の「基本レシピを入れ直す」で戻せます/.test(text), true)
  // 2026-08-16 便GZ: 基本レシピの印は料理名から決まるので、入れ直すと記録もつながり直す
  // （それまでは「作った記録は戻りません」だった）
  eq('CT-DEL 記録もつながり直すことを添える', text.includes('作った記録もつながり直します'), true)

  // 基本レシピを含まない選択では、入れ直しの一文を出さない(戻せない品に戻せると言わない)
  const ownOnly = summarizeRecipeDeleteImpact([{ isStarter: false, cookedLogs: [] }], {
    totalRecipes: 5,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 自作だけなら入れ直しの一文は出さない', ownOnly.restorableStarters, 0)
  eq(
    'CT-DEL 自作だけの確認文に入れ直しの案内を出さない',
    confirmContentText(buildBulkDeleteConfirm(ownOnly)).includes('基本レシピを入れ直す'),
    false,
  )
  eq(
    'CT-DEL 記録0件でも件数を明示する(0件と書く)',
    /作った記録0件（うち写真0枚）/.test(confirmContentText(buildBulkDeleteConfirm(ownOnly))),
    true,
  )
  // 全部消す選択でも「残り0品」と正直に書く(残るものの行自体は消さない)
  const allGone = summarizeRecipeDeleteImpact([{ isStarter: false }, { isStarter: false }], {
    totalRecipes: 2,
    mealPlanEntries: 0,
    todayEntries: 0,
  })
  eq('CT-DEL 全件削除なら残りは0品', allGone.remaining, 0)
  eq('CT-DEL 残り0品でも残るものを書く', /他のレシピ0品/.test(confirmContentText(buildBulkDeleteConfirm(allGone))), true)
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

  // (4) 静的ページ8ファイルが同じ値を書き写していること
  //     (foods.htmlは便CXで追加した機械生成ページ。生成元 scripts/gen-food-price-page.mjs にも
  //      同じ色定義が書いてあるので、色を変えるときは生成スクリプト側を直して再生成する)
  const aboutFiles = [
    'index.html',
    'manual.html',
    'terms.html',
    'unlock.html',
    'foods.html',
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
  eq('CY 色 aboutは8ファイル', aboutColors.length, 8)
  for (const c of aboutColors) {
    // ライト→ダークの順に1回ずつ、計2つ出てくる
    eq(`CY 色 ${c.file} の塗り(ライト/ダーク)`, c.accent, ['#cc3f01', '#ff8a4c'])
    eq(`CY 色 ${c.file} のページ背景用文字色`, c.page, ['#b8380a', '#ff8a4c'])
    eq(`CY 色 ${c.file} のカード面用文字色`, c.surface, ['#b8380a', '#ff8a4c'])
  }
}

// ---------- 便CX: 公開ページ「食品と目安価格の一覧」がマスタと一致していること ----------
// public/about/foods.html は scripts/gen-food-price-page.mjs がマスタ2本(栄養=nutritionData.ts /
// 価格=priceDefaults.ts)から機械生成する。マスタを直したのに再生成し忘れると、公開ページだけ
// 古い数値が残る＝対外的に事実と違う表が出たままになる。ここで生成物とマスタを突き合わせる
// (落ちたら `npm run gen:foods` で再生成する)。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
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
  for (const label of ['玉ねぎ', '鶏もも肉', 'しょうゆ']) {
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

// ---------- 設定画面からの帰り道(2026-08-02 オーナー指示・便DF) ----------
// 各ページのPro版の説明などから設定の該当欄へ飛んだあと、元のページへ戻れるようにする受け渡し。
// 外部URLへ飛ばす踏み台にならないこと・画面名が入った文言になることを固定する
{
  eq(
    'DF-BACK レシピ一覧からのPro案内リンクに戻り先が載る',
    settingsLinkWithBack('/settings?section=pro', '/recipes'),
    '/settings?section=pro&back=%2Frecipes',
  )
  eq(
    'DF-BACK クエリの無い設定リンクでは?で付ける',
    settingsLinkWithBack('/settings', '/shopping'),
    '/settings?back=%2Fshopping',
  )
  eq(
    'DF-BACK 検索条件つきの現在地もそのまま持ち回れる',
    settingsLinkWithBack('/settings?section=pro', '/recipes?q=鶏'),
    '/settings?section=pro&back=%2Frecipes%3Fq%3D%E9%B6%8F',
  )
  eq(
    'DF-BACK アプリ外のURLは戻り先に載せない',
    settingsLinkWithBack('/settings?section=pro', 'https://example.com'),
    '/settings?section=pro',
  )
  eq('DF-BACK 空の現在地は載せない', settingsLinkWithBack('/settings', ''), '/settings')

  eq('DF-BACK ?back=無しでは戻るボタンを出さない(null)', resolveBackTarget(null), null)
  eq('DF-BACK 外部URLは受け付けない', resolveBackTarget('https://example.com'), null)
  eq('DF-BACK //で始まる値(プロトコル相対)も受け付けない', resolveBackTarget('//example.com'), null)
  eq('DF-BACK 知らないパスは受け付けない', resolveBackTarget('/unknown-page'), null)
  eq('DF-BACK レシピ一覧', resolveBackTarget('/recipes'), {
    to: '/recipes',
    label: 'レシピ一覧に戻る',
  })
  eq('DF-BACK レシピ詳細は一覧と区別する', resolveBackTarget('/recipes/12'), {
    to: '/recipes/12',
    label: 'レシピに戻る',
  })
  eq('DF-BACK 献立', resolveBackTarget('/meal-plan'), { to: '/meal-plan', label: '献立に戻る' })
  eq('DF-BACK 並行調理ナビ', resolveBackTarget('/cook-navi'), {
    to: '/cook-navi',
    label: '並行調理ナビに戻る',
  })
  eq('DF-BACK 食材(買い物メモ)', resolveBackTarget('/shopping'), {
    to: '/shopping',
    label: '食材に戻る',
  })
  // 2026-08-17 便HG: ホーム画面を廃止し、「/」は献立へ送るだけの通過点になった。
  // 戻り先としては受け付けない＝「ホームに戻る」というボタンが残らないことを固定する
  eq('DF-BACK 「/」は戻り先として受け付けない(ホーム画面は無い)', resolveBackTarget('/'), null)
  eq('DF-BACK クエリ付きの戻り先はクエリごと戻す', resolveBackTarget('/recipes?q=鶏'), {
    to: '/recipes?q=鶏',
    label: 'レシピ一覧に戻る',
  })
  // 実際の受け渡し(付けて→読む)が往復で壊れないこと
  const roundTrip = new URLSearchParams(
    settingsLinkWithBack('/settings?section=pro', '/recipes?q=鶏 もも').split('?')[1],
  ).get('back')
  eq('DF-BACK 付けた戻り先をそのまま読み戻せる', resolveBackTarget(roundTrip), {
    to: '/recipes?q=鶏 もも',
    label: 'レシピ一覧に戻る',
  })
}

// ---------- 便DH: 献立の「日」の内訳／料理の種別(2026-08-03) ----------
{
  const mk = (id, over = {}) => ({
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

  // todayListPickedIds: 「レシピ一覧から選択中」＝今日の献立から②に出ている予定ぶんを引いた残り
  const tl = (...ids) => ids.map((recipeId) => ({ recipeId }))
  eq('DH-PICK 週プランに無い品だけが残る', todayListPickedIds(tl(1, 2, 3), [2]), [1, 3])
  eq('DH-PICK 並び順は今日の献立の登録順のまま', todayListPickedIds(tl(3, 1, 2), [2]), [3, 1])
  eq('DH-PICK 全部が予定なら空', todayListPickedIds(tl(1, 2), [1, 2]), [])
  // 再発防止(旧todayPlanMismatch): 週プランが空のときに空配列を返してはいけない。
  // 旧関数は「食い違い警告を出さない」ために0件時は空を返していたが、便DHでは同じ結果を
  // 「レシピ一覧から選択中」の見出しの中身として使うため、週プランが空なら全部がこちらに入る
  eq('DH-PICK 週プランが空でも今日の献立はそのまま選択中に入る', todayListPickedIds(tl(1, 2), []), [1, 2])

  // --- 便FN(2026-08-11 利用者テスト): 「全て作った！」のあと同じレシピを今日の献立に戻せない ---
  // ②「今週の献立の予定」は今日すでに作った品を出さない。①がその予定を引き算し続けると、
  // 入れ直した品が①からも②からも消える＝日タブが空のまま何をしても出てこなくなる
  eq(
    'FN-PICK ②に出ていない予定（作り終えた品）は①を塞がない',
    // 今日の予定は 1,2,3。全部作ったので②は0件。自分で1を入れ直した
    todayListPickedIds(tl(1), [], [1, 2, 3]),
    [1],
  )
  eq(
    'FN-PICK ②に出ている予定は今までどおり①に出さない（二重に並べない）',
    todayListPickedIds(tl(1, 2), [1], [1, 2, 3]),
    [2],
  )
  eq(
    'FN-PICK 予定の写し(fromPlan)は、予定が残っているかぎり①へ回さない（便DP-4の退行防止）',
    // 自動取り込みで入った写し。作り終えて②から消えても「レシピ一覧から選択中」にはしない
    todayListPickedIds([{ recipeId: 1, fromPlan: true }], [], [1]),
    [],
  )
  eq(
    'FN-PICK 予定が消えた写しは従来どおり①に残る（片付けは staleTodayListFromPlanIds の仕事）',
    todayListPickedIds([{ recipeId: 9, fromPlan: true }], [], [1]),
    [9],
  )

  // --- 便FS-1(2026-08-12 利用者テスト): 「今日の夕食に戻しました」と言われた品が、
  // 「今週の献立の予定/夕食」ではなく「レシピ一覧から選択中」に並び、
  // 「朝食に入れる／昼食に入れる／夕食に入れる」が未選択のまま付いていた ---
  eq('FS-PLAN 作っていない予定の行は今までどおり出す', showsCookedPlanRowToday(false, false), true)
  eq(
    'FS-PLAN 作って今日の献立から外れた品は出さない（作った後は予定でなく記録）',
    showsCookedPlanRowToday(true, false),
    false,
  )
  eq(
    'FS-PLAN 作ったあと今日の献立へ戻した品は、予定の行としてその食事に出す',
    showsCookedPlanRowToday(true, true),
    true,
  )
  eq(
    'FS-PICK 予定の行として出た品は「レシピ一覧から選択中」に重ねない',
    // 戻した品(1)は②に出るので、①の引き算の相手にも入る＝食事を選び直す行が出ない
    todayListPickedIds(tl(1), [1], [1, 2, 3]),
    [],
  )

  // todaySlotAddPlan: レシピ詳細の「今日の献立に追加」→ 朝食/昼食/夕食
  eq('FN-SLOT その食事にまだ無ければ予定に足す', todaySlotAddPlan([2, 3], 1, false), 'add')
  eq('FN-SLOT 作っていない同じ品が既にあれば二重（何もしない）', todaySlotAddPlan([1, 2], 1, false), 'duplicate')
  eq(
    'FN-SLOT 今日すでに作った品なら、行は増やさず今日の献立へ戻す',
    todaySlotAddPlan([1, 2], 1, true),
    'restore',
  )
  eq(
    'FN-SLOT 作った品でも、その食事に行が無ければ普通に足す',
    todaySlotAddPlan([2], 1, true),
    'add',
  )

  // staleTodayListFromPlanIds: 「週の予定を削除したあと、今日の献立に『レシピ一覧から選択中』
  // として残る」バグの再発防止(2026-08-03 便DP-4)。日タブの自動取り込み(便U-3)で入った写しは
  // fromPlan の印が付き、その予定が消えたら一緒に片付ける。自分で足した品(印なし)は残す
  {
    const item = (recipeId, fromPlan) =>
      fromPlan === undefined ? { recipeId } : { recipeId, fromPlan }
    eq(
      'DP-STALE 予定が消えた写しだけを片付ける',
      staleTodayListFromPlanIds([item(1, true), item(2, true)], [2]),
      [1],
    )
    eq(
      'DP-STALE 自分で足した品は予定に無くても残す(印なしは対象外)',
      staleTodayListFromPlanIds([item(1), item(2, true)], []),
      [2],
    )
    eq(
      'DP-STALE 予定がそのまま残っていれば何も消さない',
      staleTodayListFromPlanIds([item(1, true), item(2, true)], [1, 2]),
      [],
    )
    eq(
      'DP-STALE fromPlan:false も自分で足した扱い(消さない)',
      staleTodayListFromPlanIds([item(1, false)], []),
      [],
    )
    eq('DP-STALE 今日の献立が空なら何も消さない', staleTodayListFromPlanIds([], [1, 2]), [])
    // 週の予定を全部消した直後の再現ケース: 写しが2件とも取り残される
    eq(
      'DP-STALE 週の予定をまとめて空にしたら写しも全部片付ける',
      staleTodayListFromPlanIds([item(1, true), item(2, true), item(3)], []),
      [1, 2],
    )
  }

  // recipeDishType: dishTypeがあれば最優先・無ければ登録時と同じ推定にフォールバック
  eq('DH-TYPE 登録済みのdishTypeをそのまま使う', recipeDishType(mk(1, { dishType: 'soup' })), 'soup')
  eq('DH-TYPE その他(dessert)もそのまま', recipeDishType(mk(2, { dishType: 'dessert' })), 'dessert')
  eq(
    'DH-TYPE 未設定は推定に倒す(みそ汁→汁物)',
    recipeDishType(mk(3, { title: 'わかめのみそ汁' })),
    'soup',
  )
  eq(
    'DH-TYPE 未設定の肉料理は主菜',
    recipeDishType(mk(4, { title: '豚の生姜焼き', ingredients: [{ name: '豚こま' }] })),
    'main',
  )
  // 4区分は重ならない(種別チップは「どれか1つ」に必ず入る前提で並べている)
  eq(
    'DH-TYPE 判定結果は必ず4区分のどれか1つ',
    ['main', 'side', 'soup', 'dessert'].includes(recipeDishType(mk(5, { title: '謎の料理' }))),
    true,
  )

  // mealRoleForRecipe: 「今日の献立に追加」で入れた品が、週タブで全部『主菜』になっていた
  // バグの再発防止(2026-08-11 便FP・利用者テスト④「おひたしも味噌汁も主菜になっていた」)
  eq('FP-ROLE 汁物のレシピは汁物の行', mealRoleForRecipe(mk(1, { dishType: 'soup' })), 'soup')
  eq('FP-ROLE 副菜のレシピは副菜の行', mealRoleForRecipe(mk(2, { dishType: 'side' })), 'side')
  eq('FP-ROLE 主菜のレシピは主菜の行', mealRoleForRecipe(mk(3, { dishType: 'main' })), 'main')
  eq(
    'FP-ROLE 種別の「その他(dessert)」は献立の「その他」の行に読み替える',
    mealRoleForRecipe(mk(4, { dishType: 'dessert' })),
    'other',
  )
  eq(
    'FP-ROLE 種別が未設定なら登録時と同じ推定に倒す(みそ汁→汁物)',
    mealRoleForRecipe(mk(5, { title: 'わかめのみそ汁' })),
    'soup',
  )
  eq(
    'FP-ROLE 役割は必ず献立の4区分のどれか1つ(dessertは残らない)',
    MEAL_ROLES.includes(mealRoleForRecipe(mk(6, { title: '謎の料理' }))),
    true,
  )

}

// ---------- 便HG: 設定「ホーム画面のカスタマイズ」は 2026-08-17 に廃止した ----------
// ホーム画面そのものを無くしたので、「表示するパーツ」「並び順」「戻す」を持つ意味が無くなった。
// 並べ替えの入れ先を決めていた logic/homeWidgets.ts とその検査（旧 DH-HOMEW）も一緒に落としている。
// 保存項目 settings.homeWidgets は、書き出したバックアップを読めるようにするため残してある
// （db/types.ts の HomeWidgetKey のコメント参照）。設定から残骸なく消えたことは e2e の NOHOME-01 が見る。

// ---------- 便DV-1: 「今日なに作る?」の種別しぼり(2026-08-04 オーナー実機報告) ----------
// 再発防止: 「主菜〜その他の全ボタンを選択すると候補が減る」。
// 原因は「種別で絞ってから季節の優先(preferSeasonWithFallback)をかける」順で、季節の優先が
// 「季節の品が10品以上あればその季節だけに絞る」しきい値を持つため、入れる集合が大きいほど
// 出てくる集合が小さくなる逆転が起きていた。
{
  const mk = (id, over = {}) => ({
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
  // 主菜: 夏5品+通年50品 / 副菜: 夏4品+通年5品 / 汁物: 通年3品 / その他: 夏1品+通年2品
  // → 全体の夏はちょうど10品(=SEASON_MIN_CANDIDATES)で、実機で起きた条件と同じ形
  const pool = []
  let nextId = 1
  const add = (dishType, season, count) => {
    for (let i = 0; i < count; i += 1) {
      pool.push(mk(nextId++, { dishType, season }))
    }
  }
  add('main', 'summer', 5)
  add('main', 'all', 50)
  add('side', 'summer', 4)
  add('side', 'all', 5)
  add('soup', 'all', 3)
  add('dessert', 'summer', 1)
  add('dessert', 'all', 2)

  const ids = (list) => list.map((r) => r.id).sort((a, b) => a - b)
  const count = (types) => suggestionCandidates(pool, types, 'summer').length

  eq('DV-SUG 未選択(絞らない)は全レシピが候補', count([]), pool.length)
  eq('DV-SUG 全選択は未選択と同じ件数', count(DISH_TYPE_OPTIONS), count([]))
  eq(
    'DV-SUG 全選択と未選択は候補の中身まで一致する',
    ids(suggestionCandidates(pool, DISH_TYPE_OPTIONS, 'summer')),
    ids(suggestionCandidates(pool, [], 'summer')),
  )
  // 本丸: 種別を足していくと候補は必ず増える(減らない)
  eq('DV-SUG 主菜だけ=主菜の全品', count(['main']), 55)
  eq('DV-SUG 主菜+副菜は主菜だけより多い', count(['main', 'side']) > count(['main']), true)
  eq(
    'DV-SUG 主菜+副菜+汁物はさらに多い',
    count(['main', 'side', 'soup']) > count(['main', 'side']),
    true,
  )
  eq(
    'DV-SUG 全選択が最多(種別を増やして減らない)',
    count(DISH_TYPE_OPTIONS) >= count(['main', 'side', 'soup']),
    true,
  )
  // 種別ごとの候補は、その種別のレシピだけで構成される(混ざらない)
  eq(
    'DV-SUG 汁物だけ選べば汁物しか出ない',
    suggestionCandidates(pool, ['soup'], 'summer').every((r) => r.dishType === 'soup'),
    true,
  )
  // 選ぶ順番を変えても候補の並びは同じ(抽選のブレを作らない)
  eq(
    'DV-SUG 選んだ順番では候補の並びは変わらない',
    suggestionCandidates(pool, ['soup', 'main'], 'summer').map((r) => r.id),
    suggestionCandidates(pool, ['main', 'soup'], 'summer').map((r) => r.id),
  )
  // 季節の優先は種別ごとに効く: その種別に季節の品が10品以上あれば、その種別は季節の品だけになる
  {
    const seasonal = []
    for (let i = 0; i < 12; i += 1) seasonal.push(mk(100 + i, { dishType: 'main', season: 'summer' }))
    for (let i = 0; i < 20; i += 1) seasonal.push(mk(200 + i, { dishType: 'main', season: 'all' }))
    eq(
      'DV-SUG 季節の品が十分あればその種別は季節の品だけに絞る',
      suggestionCandidates(seasonal, ['main'], 'summer').length,
      12,
    )
  }
  // 0件回避(従来どおり): 選んだ種別に1品も無いときだけ、種別を外して全体から選ぶ
  {
    const onlyMain = [mk(1, { dishType: 'main', season: 'all' }), mk(2, { dishType: 'main', season: 'all' })]
    eq('DV-SUG 選んだ種別が0件なら種別を外して全体から選ぶ', suggestionCandidates(onlyMain, ['soup'], 'summer').length, 2)
    eq('DV-SUG 候補が空なら空のまま(0件回避も空)', suggestionCandidates([], ['soup'], 'summer').length, 0)
  }
  // dishType未設定のレシピも4区分のどれかに必ず入る(未選択と全選択が食い違わない担保)
  {
    const guessed = [
      mk(1, { title: 'わかめのみそ汁', season: 'all' }),
      mk(2, { title: '豚の生姜焼き', ingredients: [{ name: '豚こま' }], season: 'all' }),
      mk(3, { title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草' }], season: 'all' }),
    ]
    eq(
      'DV-SUG dishType未設定でも全選択=未選択',
      ids(suggestionCandidates(guessed, DISH_TYPE_OPTIONS, 'summer')),
      ids(suggestionCandidates(guessed, [], 'summer')),
    )
  }
}

// ---------- 便DV-6/7: 「料理中」の設定の注記の出し分け(2026-08-04 オーナー指示) ----------
// 対応ブラウザには「対応ブラウザのみ」を出さない・許可の案内はスイッチONで許可が無いときだけ
{
  eq('DV-CAP 非対応のときだけ「対応していません」を出す', shouldShowUnsupportedNote(false), true)
  eq('DV-CAP 対応ブラウザには注記自体を出さない', shouldShowUnsupportedNote(true), false)

  eq(
    'DV-CAP ONで許可が下りていないときだけ案内を出す',
    shouldShowPermissionHelp(true, true, 'blocked'),
    true,
  )
  eq(
    'DV-CAP OFFのあいだは出さない(常時出す注記にしない)',
    shouldShowPermissionHelp(false, true, 'blocked'),
    false,
  )
  eq('DV-CAP 許可済みなら出さない', shouldShowPermissionHelp(true, true, 'granted'), false)
  eq(
    'DV-CAP まだ調べていない/調べようがないときは出さない',
    shouldShowPermissionHelp(true, true, 'unknown'),
    false,
  )
  eq(
    'DV-CAP 非対応のときは許可の案内ではなく「対応していません」だけを出す',
    shouldShowPermissionHelp(true, false, 'blocked'),
    false,
  )
}

// ---------- 便DW-1: 振動(Vibration API)の対応可否(2026-08-08 オーナー実機報告) ----------
// iPhone(Safari)はVibration APIを持たないので、アプリが何をしても振動しない。
// 「振動しない端末なのか、設定が悪いのか」を切り分けられるよう、非対応のときだけ注記を出す。
// navigator.vibrate の有無だけで判定する＝UserAgent文字列で端末を当てにいかない(偽装・変更に弱い)
{
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const setNav = (value) =>
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
  try {
    setNav({ vibrate: () => true })
    eq('DW-VIB vibrateを持つブラウザは対応と判定する', vibrationSupported(), true)
    eq('DW-VIB 対応ブラウザには注記を出さない', shouldShowUnsupportedNote(vibrationSupported()), false)

    // iOS Safari: navigator はあるが vibrate が無い
    setNav({})
    eq('DW-VIB vibrateが無いブラウザ(iOS Safari)は非対応', vibrationSupported(), false)
    eq('DW-VIB 非対応のときだけ注記を出す', shouldShowUnsupportedNote(vibrationSupported()), true)

    // vibrate という名前のプロパティがあっても関数でなければ呼べない(非対応扱い)
    setNav({ vibrate: true })
    eq('DW-VIB vibrateが関数でなければ非対応扱い', vibrationSupported(), false)
  } finally {
    if (orig) Object.defineProperty(globalThis, 'navigator', orig)
    else delete globalThis.navigator
  }
}

// ---------- 便DV-10: Pro版の販売のお知らせを解錠済みの人に出さない(2026-08-04 オーナー指摘) ----------
{
  const news = (over = {}) => ({ id: 'x', date: '2026-08-02', title: 't', body: 'b', ...over })
  eq(
    'DV-NEWS 販売のお知らせは解錠済みには出さない',
    isNewsVisibleFor(news({ hideWhenPro: true }), true),
    false,
  )
  eq(
    'DV-NEWS 販売のお知らせは未解錠には出す',
    isNewsVisibleFor(news({ hideWhenPro: true }), false),
    true,
  )
  eq('DV-NEWS 印の無いお知らせは解錠済みにも出す', isNewsVisibleFor(news(), true), true)
  eq('DV-NEWS 印の無いお知らせは未解錠にも出す', isNewsVisibleFor(news(), false), true)
  eq(
    'DV-NEWS hideWhenPro:false は印なしと同じ扱い',
    isNewsVisibleFor(news({ hideWhenPro: false }), true),
    true,
  )
  // 配信中の public/news.json 側に印が付いていること（アプリ側だけ直して取りこぼす事故の防止）。
  // 2026-08-21 オーナー指示（A案）: **発売前にPro版のお知らせを出さない**ため、
  // 「Pro版を公開しました」は取り下げた（オーナー原文「まだ正式なユーザーはいません。
  // このような表現は、宣伝をした後になります」）。id を書き写して1件だけを見る形だと、
  // 取り下げた瞬間に赤くなる（禁じ手②）ので、**Pro版に触れるお知らせが在れば印が要る**という
  // 規則で見る。1件も無い今は空振りだが、次に足したときその場で効く
  {
    const items = JSON.parse(readFileSync(new URL('../public/news.json', import.meta.url), 'utf8'))
    // 「Pro版の売り込み」＝Proの案内へ連れて行くお知らせ。既に買った人に見せない印が要る。
    // 機能の紹介文の中で「(Pro版の機能)」と触れるだけのもの（並行調理ナビ等）は売り込みではないので対象外
    const proPitch = items.filter((n) => /section=pro|manual\.html#pro/.test(n.link ?? ''))
    eq(
      'DV-NEWS Proの案内へ連れて行くお知らせには hideWhenPro が付いている',
      proPitch.filter((n) => n.hideWhenPro !== true).map((n) => n.id),
      [],
    )
    eq(
      'DV-NEWS その手のお知らせは解錠済みには表示されない(実データで確認)',
      proPitch.filter((n) => isNewsVisibleFor(n, true)).map((n) => n.id),
      [],
    )
    // 発売前は「Pro版そのもの」を題で知らせない（オーナー指示A案）。発売したら消してよい行
    eq(
      'DV-NEWS 発売前はPro版そのものを題にしたお知らせを配らない',
      items.filter((n) => /Pro版/.test(n.title ?? '')).map((n) => n.id),
      [],
    )
  }
}

// ---------- 便DU: 月カレンダーの写真の選び方(logic/monthCover.ts) ----------
{
  // 写真はBlobでなくても選べる純関数なので、テストでは見分けのつく文字列を入れる
  const cand = (recipeId, logPhoto, recipePhoto) => ({ recipeId, logPhoto, recipePhoto })

  // 再発防止(2026-08-07 便DU・オーナー指摘「カレンダーにレシピのサムネしか出ない」の真因):
  // 旧実装は「その日の**先頭の記録**の写真 ?? そのレシピの写真」だったため、
  // 1品目に記録写真が無く2品目にある日は、自分で撮った写真ではなくレシピの写真が出ていた
  eq(
    'DU-COVER 記録の写真は、その日の何品目にあってもレシピの写真より優先する',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1'), cand(2, 'log2', 'recipe2')]),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER 記録の写真が複数あれば先頭の1枚',
    pickDayCoverPhoto([cand(1, 'log1', 'recipe1'), cand(2, 'log2')]),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER 記録の写真が1枚も無ければレシピの写真に落ちる',
    pickDayCoverPhoto([cand(1, undefined, undefined), cand(2, undefined, 'recipe2')]),
    { photo: 'recipe2', source: 'recipe', recipeId: 2 },
  )
  eq('DU-COVER 写真が1枚も無い日は選ばない', pickDayCoverPhoto([cand(1)]), undefined)
  eq('DU-COVER 記録が無い日も選ばない', pickDayCoverPhoto([]), undefined)

  // 「レシピの写真は使わない」(オーナー指示②)
  eq(
    'DU-COVER レシピの写真を使わない設定では、記録の写真だけを出す',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1'), cand(2, 'log2')], { hideRecipePhoto: true }),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER レシピの写真を使わない設定で記録の写真が無ければ、写真は出さない',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1')], { hideRecipePhoto: true }),
    undefined,
  )

  // 日ごとの指名(オーナー指示③)
  eq(
    'DU-COVER 日ごとに選んだ料理の写真を最優先で出す',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2, 'log2')], { chosenRecipeId: 2 }),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER 選んだ料理に記録の写真が無ければ、その料理のレシピの写真を出す',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2, undefined, 'recipe2')], { chosenRecipeId: 2 }),
    { photo: 'recipe2', source: 'recipe', recipeId: 2 },
  )
  eq(
    'DU-COVER 選んだ料理から1枚も取れないときは既定の優先順に戻す(写真が消えない)',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2)], { chosenRecipeId: 2 }),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER その日に無いレシピが選ばれたまま残っていても既定の優先順に戻す',
    pickDayCoverPhoto([cand(1, 'log1')], { chosenRecipeId: 99 }),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER 同じ料理を1日に2回作った日は、写真のある記録を採る',
    pickDayCoverPhoto([cand(1, undefined), cand(1, 'log1b')], { chosenRecipeId: 1 }),
    { photo: 'log1b', source: 'log', recipeId: 1 },
  )

  // 日ごとの選択の持ち方(設定に日付→レシピidで残す。選ばない日は載せない)
  eq('DU-COVER 選ぶと日付→レシピidで残る', setDayCoverChoice(undefined, '2026-08-07', 3), {
    '2026-08-07': 3,
  })
  eq(
    'DU-COVER 自動に戻すとその日の分だけ消える',
    setDayCoverChoice({ '2026-08-07': 3, '2026-08-08': 4 }, '2026-08-07', undefined),
    { '2026-08-08': 4 },
  )
  eq(
    'DU-COVER 選び直しは上書き(他の日は触らない)',
    setDayCoverChoice({ '2026-08-07': 3, '2026-08-08': 4 }, '2026-08-07', 9),
    { '2026-08-07': 9, '2026-08-08': 4 },
  )
}

// ---------- 便DU: 日の窓で何を変えたか(logic/dayEdit.ts) ----------
{
  const e = (id, recipeId, extra = {}) => ({ id, slot: 'dinner', role: 'main', recipeId, ...extra })
  const state = (entries, note = '') => ({ entries, note })

  eq(
    'DU-DAYEDIT 何も変えていなければ dirty=false(下は「閉じる」1つだけ)',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10)])),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 追加は added',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10), e(2, 11)])),
    { added: 1, removed: 0, changed: 0, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT 外したら removed',
    diffDayEdit(state([e(1, 10), e(2, 11)]), state([e(1, 10)])),
    { added: 0, removed: 1, changed: 0, noteChanged: false, dirty: true },
  )
  // 再発防止: 差し替え(updateMealEntryRecipe)は同じidのままレシピだけ変わる。
  // idで突き合わせないと「1品外して1品足した」に見え、確認文の件数が二重に出る
  eq(
    'DU-DAYEDIT 差し替えは changed 1件(外した+足したにしない)',
    diffDayEdit(state([e(1, 10)]), state([e(1, 12)])),
    { added: 0, removed: 0, changed: 1, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT 食数だけ変えても changed',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10, { servings: 3 })])),
    { added: 0, removed: 0, changed: 1, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT role未設定と主菜は同じ扱い(既存データを「変わった」と誤検知しない)',
    diffDayEdit(state([{ id: 1, slot: 'dinner', recipeId: 10 }]), state([e(1, 10)])),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 日付メモを書いたら noteChanged',
    diffDayEdit(state([e(1, 10)], ''), state([e(1, 10)], '外食')),
    { added: 0, removed: 0, changed: 0, noteChanged: true, dirty: true },
  )
  eq(
    'DU-DAYEDIT メモの前後の空白だけの違いは変更としない(保存側もtrimするため)',
    diffDayEdit(state([e(1, 10)], '外食'), state([e(1, 10)], ' 外食 ')),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 追加・差し替え・外す・メモが混ざっても全部数える',
    diffDayEdit(state([e(1, 10), e(2, 11)], 'もと'), state([e(1, 12), e(3, 13)], 'あと')),
    { added: 1, removed: 1, changed: 1, noteChanged: true, dirty: true },
  )
}

// ---------- 献立のロック(2026-08-08 便DX・オーナー指示) ----------
// 鍵の掛かった食事は「自動でまとめて動かす操作」の対象から外れる。守る経路は5つ:
// ①まとめて献立を入力(空き枠だけ/レシピを総入れ替えの両方) ②テンプレートを適用
// ③先週の献立をコピー ④まとめて空にする ⑤月の献立をまとめて提案。
// 手での編集は鍵が掛かっていても自由(=画面側の話)。
// 保存の粒度は「日付×食事」の1階層で、画面の「日ごと」は3食まとめての掛け外しとして表す
//
// 2026-08-09 便EJ: どの経路も「鍵ありの結果」だけを見ると、そもそも動く対象が無くて
// 何も起きなかっただけでも合格してしまう(実際にe2eのLOCK-5がこの形で素通りしていた)。
// 以後この節の断定は必ず「鍵なしなら動く／鍵ありでは鍵の枠だけが動かない」の対で書き、
// 鍵を掛けていない枠が実際に埋まった・実際に消えたことを同時に固定する
{
  const {
    mealLockKey,
    isMealSlotLocked,
    isDayMealLocked,
    planDayLockToggle,
    planSlotLockToggle,
    planAllLockToggle,
    planCopyLastWeek,
    planClearMealSlots,
  } = await import('../src/logic/mealPlan.ts')
  const { planTemplateFill } = await import('../src/logic/mealTemplate.ts')
  const keys = (...pairs) => new Set(pairs.map(([d, s]) => mealLockKey(d, s)))
  const sortedStrs = (set) => [...set].sort()

  // --- 2階層(日ごと/時間帯ごと)の掛け外し ---
  eq('DX-LOCK キーは 日付|食事', mealLockKey('2026-08-10', 'dinner'), '2026-08-10|dinner')
  eq(
    'DX-LOCK 時間帯ごと: 掛かっていなければ掛ける',
    planSlotLockToggle(new Set(), '2026-08-10', 'dinner'),
    { lock: [{ date: '2026-08-10', slot: 'dinner' }], unlock: [] },
  )
  eq(
    'DX-LOCK 時間帯ごと: 掛かっていれば外す',
    planSlotLockToggle(keys(['2026-08-10', 'dinner']), '2026-08-10', 'dinner'),
    { lock: [], unlock: [{ date: '2026-08-10', slot: 'dinner' }] },
  )
  eq(
    'DX-LOCK 日ごと: 3食とも掛かっているときだけ「日がロック済み」',
    isDayMealLocked(keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch']), '2026-08-10'),
    false,
  )
  eq(
    'DX-LOCK 日ごと: 3食そろえばロック済み',
    isDayMealLocked(
      keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch'], ['2026-08-10', 'dinner']),
      '2026-08-10',
    ),
    true,
  )
  eq(
    'DX-LOCK 日ごと: 掛かっていない食事にだけ掛ける(すでに掛かっている夕食は二重にしない)',
    planDayLockToggle(keys(['2026-08-10', 'dinner']), '2026-08-10'),
    {
      lock: [
        { date: '2026-08-10', slot: 'breakfast' },
        { date: '2026-08-10', slot: 'lunch' },
      ],
      unlock: [],
    },
  )
  eq(
    'DX-LOCK 日ごと: 3食そろっていれば3食とも外す',
    planDayLockToggle(
      keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch'], ['2026-08-10', 'dinner']),
      '2026-08-10',
    ).unlock.length,
    3,
  )
  // 「すべてロック」→ もう一度押すと「すべて解除」(トグル)
  {
    const dates = ['2026-08-10', '2026-08-11']
    const first = planAllLockToggle(new Set(), dates)
    eq('DX-LOCK すべてロック: 2日×3食=6件を掛ける', first.lock.length, 6)
    eq('DX-LOCK すべてロック: 外すものは無い', first.unlock.length, 0)
    const allLocked = new Set(first.lock.map(({ date, slot }) => mealLockKey(date, slot)))
    const second = planAllLockToggle(allLocked, dates)
    eq('DX-LOCK すべて解除: 全部掛かっていれば6件とも外す', second.unlock.length, 6)
    eq('DX-LOCK すべて解除: 掛けるものは無い', second.lock.length, 0)
    // 時間帯ごとに掛けた鍵だけが残っている状態から押すと、まず「全部掛ける」側になる
    const partial = keys(['2026-08-10', 'dinner'])
    eq(
      'DX-LOCK すべてロック: 一部だけ掛かっていれば残り5件を掛ける(解除にはしない)',
      planAllLockToggle(partial, dates).lock.length,
      5,
    )
  }

  // --- ①まとめて献立を入力(planWeekFill) ---
  // 4日ぶんを用意し、鍵あり／鍵なしを必ず対で比べる。
  //  08-10 … 鍵あり・自動の献立が入っている  → 消されないことを見る
  //  08-11 … 鍵あり・空                      → 埋められないことを見る
  //  08-12 … 鍵なし・自動の献立が入っている  → 総入れ替えで実際に消えることを見る
  //  08-13 … 鍵なし・空                      → どちらの入れかたでも実際に埋まることを見る
  {
    const week = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
    const today = '2026-08-10'
    const entries = [
      { id: 1, date: '2026-08-10', slot: 'dinner', recipeId: 11, role: 'main', auto: true },
      { id: 2, date: '2026-08-12', slot: 'dinner', recipeId: 12, role: 'main', auto: true },
    ]
    const locked = keys(['2026-08-10', 'dinner'], ['2026-08-11', 'dinner'])
    const slotDates = (plan) => plan.slotsToFill.map((s) => s.date)

    // 空き枠だけ埋める(keepAuto=true)。鍵が無ければ空いている08-11と08-13が埋まる
    const fillEmptyFree = planWeekFill(entries, week, ['dinner'], today, { keepAuto: true })
    eq(
      'DX-LOCK 一括入力(空き枠だけ・鍵なし): 空いている2日とも埋め対象になる',
      slotDates(fillEmptyFree),
      ['2026-08-11', '2026-08-13'],
    )
    const fillEmpty = planWeekFill(entries, week, ['dinner'], today, { keepAuto: true, lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力(空き枠だけ): ロック枠(空の08-11)だけが埋め対象から外れ、08-13は埋まる',
      slotDates(fillEmpty),
      ['2026-08-13'],
    )
    eq('DX-LOCK 一括入力(空き枠だけ): ロック枠の行は消さない', fillEmpty.entryIdsToRemove, [])
    eq('DX-LOCK 一括入力(空き枠だけ): ロック枠の数を返す', fillEmpty.lockedSlotCount, 2)

    // レシピを総入れ替え(replaceAll=true)でもロック枠は触らない。
    // 鍵が無ければ4日とも入れ直し、入っている2品(id=1,2)とも消える
    const replaceAllFree = planWeekFill(entries, week, ['dinner'], today, { replaceAll: true })
    eq('DX-LOCK 一括入力(総入れ替え・鍵なし): 4日とも入れ直す', slotDates(replaceAllFree), week)
    eq('DX-LOCK 一括入力(総入れ替え・鍵なし): 入っている2品とも消える', replaceAllFree.entryIdsToRemove, [1, 2])
    const replaceAll = planWeekFill(entries, week, ['dinner'], today, { replaceAll: true, lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力(総入れ替え): ロックしていない2日だけ埋め直す',
      replaceAll.slotsToFill.map((s) => `${s.date}|${s.slot}`),
      ['2026-08-12|dinner', '2026-08-13|dinner'],
    )
    eq('DX-LOCK 一括入力(総入れ替え): 消すのはロックしていない行だけ', replaceAll.entryIdsToRemove, [2])
    eq('DX-LOCK 一括入力(総入れ替え): ロック枠の中身は重複回避のusedに入る', replaceAll.usedRecipeIds.includes(11), true)
    eq('DX-LOCK 一括入力(総入れ替え): ロック枠の数を返す', replaceAll.lockedSlotCount, 2)

    // 料理が入っていない空の食事でも、鍵が掛かっていれば埋めない
    const emptyLocked = planWeekFill([], week, ['dinner'], today, { lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力: 空の食事でも鍵が掛かっていれば入れない',
      slotDates(emptyLocked),
      ['2026-08-12', '2026-08-13'],
    )
    eq('DX-LOCK 一括入力: 鍵を使っていなければ従来どおり(件数0)', planWeekFill([], week, ['dinner'], today).lockedSlotCount, 0)
  }

  // --- ②テンプレートを適用(planTemplateFill) ---
  {
    // 2026-08-10(月)・2026-08-11(火)。月=dow0・火=dow1
    const base = {
      items: [
        { dow: 0, slot: 'dinner', role: 'main', recipeId: 21 },
        { dow: 1, slot: 'dinner', role: 'main', recipeId: 22 },
      ],
      dates: ['2026-08-10', '2026-08-11'],
      entries: [],
      today: '2026-08-10',
      allowedDows: [0, 1, 2, 3, 4, 5, 6],
      visibleSlots: ['dinner'],
    }
    // 鍵が無ければ2日とも入る(=鍵ありの結果が「元から入らなかっただけ」ではない証明)
    const free = planTemplateFill(base)
    eq('DX-LOCK テンプレ適用(鍵なし): 2日とも入る', free.ops.length, 2)
    eq('DX-LOCK テンプレ適用(鍵なし): ロック件数は0', free.lockedSlotCount, 0)
    const plan = planTemplateFill({ ...base, lockedKeys: keys(['2026-08-10', 'dinner']) })
    eq('DX-LOCK テンプレ適用: ロック枠には入れない(鍵の無い11日には入る)', plan.ops, [
      { date: '2026-08-11', slot: 'dinner', role: 'main', recipeId: 22 },
    ])
    eq('DX-LOCK テンプレ適用: ロック枠の数を返す', plan.lockedSlotCount, 1)
    eq('DX-LOCK テンプレ適用: ロック枠は「すでに決まっている」とは別に数える', plan.keptSlotCount, 0)
  }

  // --- ③先週の献立をコピー(planCopyLastWeek) ---
  {
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      entries: [],
      prevEntries: [
        { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
        { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
      ],
    }
    const free = planCopyLastWeek(base)
    eq('DX-LOCK 先週コピー(鍵なし): 2日分とも写す', free.ops.length, 2)
    eq('DX-LOCK 先週コピー(鍵なし): ロック件数は0', free.lockedSlotCount, 0)
    const locked = planCopyLastWeek({ ...base, lockedKeys: keys(['2026-08-10', 'dinner']) })
    eq('DX-LOCK 先週コピー: ロック枠には写さない', locked.ops, [
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    eq('DX-LOCK 先週コピー: ロック枠の数を返す', locked.lockedSlotCount, 1)
    eq('DX-LOCK 先週コピー: コピー元の品数は鍵に関わらず数える', locked.sourceTotal, 2)
  }

  // --- ④まとめて空にする(planClearMealSlots) ---
  {
    const entries = [
      { id: 1, date: '2026-08-10', slot: 'dinner', recipeId: 41 },
      { id: 2, date: '2026-08-10', slot: 'dinner', recipeId: 42 },
      { id: 3, date: '2026-08-11', slot: 'dinner', recipeId: 43 },
      { id: 4, date: '2026-08-11', slot: 'breakfast', recipeId: 44 },
    ]
    const plan = planClearMealSlots(entries, ['dinner'], keys(['2026-08-10', 'dinner']))
    eq('DX-LOCK まとめて空にする: ロック枠の行は消さない', plan.entryIdsToRemove, [3])
    eq('DX-LOCK まとめて空にする: 消す品数はロックぶんを引いた数', plan.targetCount, 1)
    eq('DX-LOCK まとめて空にする: 残す品数を返す', plan.lockedEntryCount, 2)
    eq('DX-LOCK まとめて空にする: ロック枠の数(食分)を返す', plan.lockedSlotCount, 1)
    eq(
      'DX-LOCK まとめて空にする: 選んでいない食事は鍵に関わらず触らない',
      planClearMealSlots(entries, ['dinner'], new Set()).entryIdsToRemove,
      [1, 2, 3],
    )
  }

  // --- ⑤月タブ「献立をまとめて提案」(planWeekFill を月の日付範囲＋keepAuto＋skipDatesで呼ぶ) ---
  // 画面側(fillMonth)は週の一括入力と同じ純ロジックを、対象範囲だけ月に広げて使う。
  // メモを書いた日(skipDates)を外す仕組みと鍵が同時に効くことを、鍵なしとの対で固定する
  {
    const month = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
    const today = '2026-08-10'
    const noteDates = ['2026-08-12'] // 「外食」などのメモを書いた日
    const monthArgs = { keepAuto: true, skipDates: noteDates }
    const free = planWeekFill([], month, ['dinner'], today, monthArgs)
    eq(
      'DX-LOCK 月の未定日提案(鍵なし): メモの日だけ外し、残り3日は埋め対象になる',
      free.slotsToFill.map((s) => s.date),
      ['2026-08-10', '2026-08-11', '2026-08-13'],
    )
    const locked = planWeekFill([], month, ['dinner'], today, {
      ...monthArgs,
      lockedKeys: keys(['2026-08-11', 'dinner']),
    })
    eq(
      'DX-LOCK 月の未定日提案: 鍵の日も外れ、鍵もメモも無い2日は実際に埋まる',
      locked.slotsToFill.map((s) => s.date),
      ['2026-08-10', '2026-08-13'],
    )
    eq('DX-LOCK 月の未定日提案: ロック枠の数を返す(確認文の件数に使う)', locked.lockedSlotCount, 1)
    eq('DX-LOCK 月の未定日提案: メモの日は鍵とは別に数える', locked.skippedDates, noteDates)
    eq('DX-LOCK 月の未定日提案: 非破壊(1品も消さない)', locked.entryIdsToRemove, [])
  }

  // 鍵は「その日その食事」だけに効く(隣の日・隣の食事へ漏れない)
  {
    const locked = keys(['2026-08-10', 'dinner'])
    eq('DX-LOCK 鍵は同じ日の別の食事には効かない', isMealSlotLocked(locked, '2026-08-10', 'lunch'), false)
    eq('DX-LOCK 鍵は別の日の同じ食事には効かない', isMealSlotLocked(locked, '2026-08-11', 'dinner'), false)
    eq('DX-LOCK 掛けた食事にだけ効く', sortedStrs(locked), ['2026-08-10|dinner'])
  }
}

// ---------- 便EA: 今日の「作った記録」を集計に入れる(オーナー指摘) ----------
// 従来は「過去日=作った記録／今日以降=登録した献立」で切っていたため、今日すでに作ったものが
// 記録として数えられず予定側で数えられていた。今日は「作った記録があるものは記録・
// まだのものは予定」で数え、同じ料理を二重に数えないことを固定する。
{
  const TODAY = '2026-08-08'
  // 玉ねぎ1個=50円(全量)/2人分 → 1人分25円、鶏もも200g=260円(全量)/2人分 → 1人分130円
  const idx = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
    { name: '鶏もも肉', pricePerUnit: 130, unit: '100g' },
  ])
  const onion = { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 }
  const chicken = { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 }

  // 今日: 肉じゃが(id=1)を予定に入れていて、もう作った。副菜(id=2)はまだ作っていない
  const cooked = [{ date: TODAY, recipe: chicken, recipeId: 1, log: { servings: 2 } }]
  const planned = [
    { date: TODAY, recipe: chicken, recipeId: 1 },
    { date: TODAY, recipe: onion, recipeId: 2 },
  ]
  const sum = summarizeRangeIntake({
    start: TODAY,
    end: TODAY,
    today: TODAY,
    cooked,
    planned,
    priceIndex: idx,
  })
  eq('EA-TODAY 今日の作った記録が記録側に入る(1品)', sum.actual.dishCount, 1)
  eq('EA-TODAY 作ったぶんは今日の予定から外れる(残り1品)', sum.plan.dishCount, 1)
  eq('EA-TODAY 二重計上ゼロ: 1人分の合計は 130 + 25 = 155円', sum.personalYen, 155)
  eq('EA-TODAY 二重計上ゼロ: 栄養も3品ではなく2品で数える', sum.nutrition.dishCount, 2)
  eq('EA-TODAY 今日の記録は「全員分(作った食数ぶん)」にも入る', sum.cookedHouseholdYen, 260)
  eq('EA-TODAY 今日の記録がある日は「記録がある日数」に数える', sum.cookedDayCount, 1)

  // 同じ料理を今日2枠に予定して1回だけ作った日は、片方だけが記録へ移り、もう片方は予定に残る
  {
    const twice = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked,
      planned: [
        { date: TODAY, recipe: chicken, recipeId: 1 },
        { date: TODAY, recipe: chicken, recipeId: 1 },
      ],
      priceIndex: idx,
    })
    eq('EA-TODAY 同じ料理を2枠に予定して1回作った日: 記録1品・予定1品', {
      actual: twice.actual.dishCount,
      plan: twice.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // 予定に無いものを今日作った日は、記録として足されるだけ(予定は減らない)
  {
    const extra = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked: [{ date: TODAY, recipe: onion, recipeId: 9 }],
      planned: [{ date: TODAY, recipe: chicken, recipeId: 1 }],
      priceIndex: idx,
    })
    eq('EA-TODAY 予定に無い品を作った日は、記録1品+予定1品の2品', {
      actual: extra.actual.dishCount,
      plan: extra.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // recipeId を渡さない古い呼び出しでは照合しない(今日の予定はそのまま予定で数える)
  {
    const noId = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked: [{ date: TODAY, recipe: chicken }],
      planned: [{ date: TODAY, recipe: chicken }],
      priceIndex: idx,
    })
    eq('EA-TODAY recipeIdが無ければ照合しない(記録1品+予定1品)', {
      actual: noId.actual.dishCount,
      plan: noId.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // 明日の予定は、今日の記録があっても落とさない
  {
    const tomorrow = summarizeRangeIntake({
      start: TODAY,
      end: '2026-08-09',
      today: TODAY,
      cooked,
      planned: [
        { date: TODAY, recipe: chicken, recipeId: 1 },
        { date: '2026-08-09', recipe: chicken, recipeId: 1 },
      ],
      priceIndex: idx,
    })
    eq('EA-TODAY 明日の同じ料理の予定は落とさない', tomorrow.plan.dishCount, 1)
  }

  // カレンダーのセルも同じ規則(今日のセルが「予定だけ」にならない)
  {
    const cells = dayIntakeMap({
      dates: ['2026-08-07', TODAY, '2026-08-09'],
      today: TODAY,
      cooked: [{ date: '2026-08-07', recipe: onion, recipeId: 5 }, ...cooked],
      planned: [...planned, { date: '2026-08-09', recipe: onion, recipeId: 2 }],
      priceIndex: idx,
    })
    eq('EA-TODAY カレンダー: 今日のセルは記録1品+まだの予定1品の2品', cells.get(TODAY).dishCount, 2)
    eq('EA-TODAY カレンダー: 今日のセルは記録があれば「作った記録」の基準になる', cells.get(TODAY).basis, 'actual')
    eq('EA-TODAY カレンダー: 過去日は従来どおり記録だけ', cells.get('2026-08-07').basis, 'actual')
    eq('EA-TODAY カレンダー: 未来日は従来どおり予定だけ', cells.get('2026-08-09').basis, 'plan')
    eq('EA-TODAY カレンダー: 今日の1人分は 130 + 25 = 155円', cells.get(TODAY).yen, 155)
  }
}

// ---------- 便EA: ロックは手での削除・変更も止める(オーナー指示) ----------
{
  const { mealLockKey, isMealEditBlocked, MEAL_SLOT_EDITS } = await import(
    '../src/logic/mealPlan.ts'
  )
  const keys = new Set([mealLockKey('2026-08-10', 'dinner')])
  for (const edit of MEAL_SLOT_EDITS) {
    eq(
      `EA-LOCK 鍵の掛かった食事では「${edit}」が止まる`,
      isMealEditBlocked(keys, '2026-08-10', 'dinner', edit),
      true,
    )
    eq(
      `EA-LOCK 鍵の無い食事では「${edit}」は止まらない`,
      isMealEditBlocked(keys, '2026-08-10', 'lunch', edit),
      false,
    )
    eq(
      `EA-LOCK 別の日の同じ食事では「${edit}」は止まらない`,
      isMealEditBlocked(keys, '2026-08-11', 'dinner', edit),
      false,
    )
  }
  eq(
    'EA-LOCK 止める操作は 追加・差し替え・削除・食数変更・行のサイコロ の5つ',
    [...MEAL_SLOT_EDITS],
    ['add', 'replace', 'remove', 'servings', 'suggest'],
  )
  eq('EA-LOCK 鍵を外せば元どおり操作できる', isMealEditBlocked(new Set(), '2026-08-10', 'dinner', 'remove'), false)
  // 注意書きは1文(オーナー指示「削除と変更ができない事がわかる一文にして」)
  eq('EA-LOCK 注意書きは1文', ja.mealPlan.lockEffectNote.split('。').filter(Boolean).length, 1)
  eq(
    'EA-LOCK 注意書きが「削除」と「変更」の両方に触れている',
    ja.mealPlan.lockEffectNote.includes('削除') && ja.mealPlan.lockEffectNote.includes('変更'),
    true,
  )
}

// ---------- 便EA: 買い物リストの範囲えらび(オーナー要望「3日分とか」) ----------
// オーナー原文「選択した日付や時間帯レシピから買い物リスト作成したい。3日分とか、
// １週間分まとめて買い物とは限らない」。
// 既定(絞っていない=null)は表示中の週ぜんぶ＝従来と1品も変わらないことを最優先で固定する。
{
  const week = ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11']
  const entries = [
    { date: '2026-08-08', slot: 'breakfast', recipeId: 1 },
    { date: '2026-08-08', slot: 'dinner', recipeId: 2 },
    { date: '2026-08-09', slot: 'lunch', recipeId: 3 },
    { date: '2026-08-09', slot: 'dinner', recipeId: 4 },
    { date: '2026-08-10', slot: 'dinner', recipeId: 5 },
    { date: '2026-08-11', slot: 'breakfast', recipeId: 6 },
  ]
  const all = ['breakfast', 'lunch', 'dinner']
  const ids = (rows) => rows.map((r) => r.recipeId)

  // --- 既定(絞っていない): 表示している食事の枠が全部そのまま入る ---
  eq(
    'EA-RANGE 既定(range無し)は表示中の週ぜんぶ',
    ids(filterShoppingEntries(entries, all)),
    [1, 2, 3, 4, 5, 6],
  )
  eq(
    'EA-RANGE 既定(dates/slotsともnull)も表示中の週ぜんぶ',
    ids(filterShoppingEntries(entries, all, { dates: null, slots: null })),
    [1, 2, 3, 4, 5, 6],
  )
  // 表示していない食事は、絞る前から対象外(従来どおり)
  eq(
    'EA-RANGE 表示していない食事は元から入らない',
    ids(filterShoppingEntries(entries, ['dinner'])),
    [2, 4, 5],
  )

  // --- 日付だけで絞る(オーナーの「3日分とか」) ---
  eq(
    'EA-RANGE 選んだ日付だけが集計される',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-09', '2026-08-10'] })),
    [3, 4, 5],
  )
  eq(
    'EA-RANGE 選んでいない日は1品も入らない',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-11'] })),
    [6],
  )

  // --- 食事だけで絞る(時間帯) ---
  eq(
    'EA-RANGE 選んだ食事だけが集計される',
    ids(filterShoppingEntries(entries, all, { slots: ['dinner'] })),
    [2, 4, 5],
  )

  // --- 日付と食事の両方で絞る(かけ算で効く) ---
  eq(
    'EA-RANGE 日付と食事の両方で絞ると、その交わりだけが集計される',
    ids(
      filterShoppingEntries(entries, all, {
        dates: ['2026-08-08', '2026-08-09'],
        slots: ['dinner'],
      }),
    ),
    [2, 4],
  )
  eq(
    'EA-RANGE 選んだ範囲に献立が無ければ0件',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-10'], slots: ['breakfast'] })),
    [],
  )
  // 表示していない食事は、範囲で選んでも入らない(表示の設定が優先)
  eq(
    'EA-RANGE 表示していない食事は範囲で選んでも入らない',
    ids(filterShoppingEntries(entries, ['dinner'], { slots: ['breakfast', 'dinner'] })),
    [2, 4, 5],
  )

  // --- 「今日の献立」(食事の情報が無いリスト)を足すかの判定 ---
  eq('EA-RANGE 既定では「今日の献立」も足す', shoppingRangeIncludesTodayList('2026-08-08'), true)
  eq(
    'EA-RANGE 今日を含む日付を選んだら「今日の献立」も足す',
    shoppingRangeIncludesTodayList('2026-08-08', { dates: ['2026-08-08', '2026-08-09'] }),
    true,
  )
  eq(
    'EA-RANGE 今日を外したら「今日の献立」は足さない',
    shoppingRangeIncludesTodayList('2026-08-08', { dates: ['2026-08-09'] }),
    false,
  )
  eq(
    'EA-RANGE 食事で絞ったら「今日の献立」は足さない(食事の情報が無く多く買わせるため)',
    shoppingRangeIncludesTodayList('2026-08-08', { slots: ['dinner'] }),
    false,
  )

  // --- 「絞っているか」の判定(全部選び直した状態は絞っていない扱い) ---
  eq('EA-RANGE 未選択は絞っていない', isShoppingRangeNarrowed(undefined, week, all), false)
  eq(
    'EA-RANGE 全部選び直した状態は絞っていない扱い',
    isShoppingRangeNarrowed({ dates: [...week], slots: [...all] }, week, all),
    false,
  )
  eq(
    'EA-RANGE 1日でも外れていれば絞っている',
    isShoppingRangeNarrowed({ dates: week.slice(0, 3) }, week, all),
    true,
  )
  eq(
    'EA-RANGE 食事が1つでも外れていれば絞っている',
    isShoppingRangeNarrowed({ slots: ['dinner'] }, week, all),
    true,
  )

  // --- 範囲の言い表し(買い物メモの下書きに出す1行) ---
  eq('EA-RANGE 日付が連続していれば「8/8〜8/11」', formatShoppingRangeDates(week), '8/8〜8/11')
  eq('EA-RANGE 1日だけなら「8/9」', formatShoppingRangeDates(['2026-08-09']), '8/9')
  eq(
    'EA-RANGE 飛んでいれば「・」で並べる',
    formatShoppingRangeDates(['2026-08-08', '2026-08-10']),
    '8/8・8/10',
  )
  eq('EA-RANGE 月をまたいでも連続なら範囲表記', formatShoppingRangeDates(['2026-08-31', '2026-09-01']), '8/31〜9/1')
  eq('EA-RANGE 日付が0件なら空文字(行を出さない)', formatShoppingRangeDates([]), '')
  eq(
    'EA-RANGE 範囲の1行に日付と食事が入る',
    formatShoppingRangeLabel({
      dates: ['2026-08-08', '2026-08-09'],
      slots: ['dinner'],
      includesTodayList: false,
    }),
    '献立の8/8〜8/9・夕食から作りました',
  )
  eq(
    'EA-RANGE 「今日の献立」を足したときは、その旨も書く',
    formatShoppingRangeLabel({
      dates: ['2026-08-08'],
      slots: ['breakfast', 'lunch', 'dinner'],
      includesTodayList: true,
    }),
    '献立の8/8・朝食・昼食・夕食から作りました（「今日の献立」の分も入れています）',
  )
  eq(
    'EA-RANGE 対象の日が0件なら範囲の行は出さない',
    formatShoppingRangeLabel({ dates: [], slots: ['dinner'], includesTodayList: false }),
    '',
  )
}

// ---------- 便EA: 申し送り2件(Pro機能一覧・「栄養から組む」の効き先)の文言整合 ----------
// 便DWが見つけたアプリ側の食い違い。文言そのものは規約Hで書き直しうるので、
// 「どの機能名が挙がっているか」だけを機械検査して再発を止める。
// 2026-08-09 便EN: オーナー指示で呼称を「目的から組む」→「栄養から組む」に変えたので、
// 検査する語も入れ替える(内部キー protein 等は変えていない)。
{
  // ①Pro機能は5つ(登録数の上限なし・栄養価の8項目表示と並び替え・月間の献立・並行調理ナビ・
  //   栄養から組む)。設定のPro案内3か所すべてに「栄養から組む」が入っていること
  eq('EA-DW1 設定のPro案内(枠内)に「栄養から組む」がある', ja.settings.proLead.includes('栄養から組む'), true)
  eq(
    'EA-DW1 設定の「Pro版でできることを見る」に「栄養から組む」がある',
    ja.settings.proDescription.includes('栄養から組む'),
    true,
  )
  // 2026-08-12 便FW: 機能一覧を「開く画面ごとの束」に組み替えたので、束の中を平らにして見る
  const proActivatedFeatures = ja.settings.proActivatedFeatureGroups.flatMap((g) => g.features)
  eq(
    'EA-DW1 解錠後の「使えるようになった機能」に「栄養から組む」がある',
    proActivatedFeatures.some((f) => f.label.includes('栄養から組む')),
    true,
  )
  // ②効き先は週タブだけではない(月タブの「献立をまとめて提案」も executeFill→drawPair を通る)。
  //   2026-08-09 便EN(オーナー実機「ユーザーにとって関係ないのでは？…だから何？という感想しか
  //   なかった」): 画面の1行説明でボタン名を3つ並べるのはやめ、設定のPro機能一覧の側で
  //   「週」と「月」の両方を案内する形にした。検査もそちらへ移す
  {
    const feature = proActivatedFeatures.find((f) => f.label.includes('栄養から組む'))
    eq('EA-DW2 Pro機能一覧の案内が「週」と「月」の両方を挙げている', !!feature && feature.hint.includes('週') && feature.hint.includes('月'), true)
  }
  //   画面の1行説明は短く保つ(ボタン名の列挙・内部の引き直しの説明を戻さない)
  eq(
    'EA-DW2 「栄養から組む」の1行説明にボタン名を並べない(規約H・余計な一言の禁止)',
    // 2026-08-17 便HH: ボタン名は「おまかせで提案」→「おまかせで献立を組む」。
    // 名前で当てると改名のたびに素通り合格になるので、i18nの値そのもので見る
    !ja.mealPlan.purposeHint.includes(ja.mealPlan.todaySuggestButton) &&
      !ja.mealPlan.purposeHint.includes('引き直') &&
      ja.mealPlan.purposeHint.length <= 60,
    true,
  )
}

// ---------- 便EI-1: ホーム画面から起動しているかの判定(設定の追加案内の出し分け) ----------
// 設定「うちレシピについて」の「ホーム画面への追加方法」は、すでに端末のホーム画面のアイコンから起動している人には
// 出さない。判定材料はAndroid/PC=display-mode、iOS=navigator.standaloneの2本で、
// どちらか一方でも真ならアイコン起動(iOSは古い版でdisplay-modeを返さないことがあるため)。
{
  const env = (displayModeStandalone, navigatorStandalone) => ({ displayModeStandalone, navigatorStandalone })
  eq('EI-1 ブラウザのタブで開いている(両方false)＝案内を出す', isStandaloneDisplay(env(false, false)), false)
  eq('EI-1 display-mode:standalone＝アイコン起動', isStandaloneDisplay(env(true, false)), true)
  eq('EI-1 iOSのnavigator.standalone＝アイコン起動', isStandaloneDisplay(env(false, true)), true)
  eq('EI-1 両方true＝アイコン起動', isStandaloneDisplay(env(true, true)), true)
  // 案内の中身: 手順ページへのリンクと、先に追加したほうがよい理由(iOSでデータが分かれる)
  eq('EI-1 リンク名が手順ページと同じ表記', ja.settings.installPageLink, 'ホーム画面への追加方法')
  eq('EI-1 案内文がiOSのデータ分離に触れている', ja.settings.installPageNote.includes('別々に保存されます'), true)
  eq('EI-1 案内文が「使い始める前に」を伝えている', ja.settings.installPageNote.includes('使い始める前に'), true)
}

// ---------- 便EI-2: 日本語入力の変換確定Enterのガード ----------
// 2026-08-02にレシピ登録画面で直した「変換確定のEnterで行/タグが増える」を、
// ChipInput・在庫ボード・設定のNG食材でも同じ判定で止める(logic/imeKey.tsへ集約)。
// isComposing が本命・keyCode 229 は compositionend が先に来る環境向けの保険。
{
  const key = (isComposing, keyCode = 13) => ({ nativeEvent: { isComposing }, keyCode })
  eq('EI-2 変換中のEnter(isComposing=true)は確定用と判定', isImeConfirmKey(key(true)), true)
  eq('EI-2 確定後のEnterは通常のEnter', isImeConfirmKey(key(false)), false)
  eq('EI-2 keyCode 229(compositionendが先に来る環境)も確定用と判定', isImeConfirmKey(key(false, 229)), true)
  eq('EI-2 変換中かつ229でも確定用', isImeConfirmKey(key(true, 229)), true)
  // Enterで確定する入力欄すべてに当てているか(適用漏れの再発防止)。
  // 「e.key === 'Enter'」で始まる分岐が isImeConfirmKey で守られていることをソースで機械検査する。
  // 対象はテキスト入力欄のEnterだけで、ボタン相当要素のEnter/Space(role=button)は対象外
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  // 2026-08-09 便EK: 献立タブ(日付メモ・献立テンプレートの名前)と、単位の自由入力欄
  // (UnitQuantityFields=レシピ登録・食材と価格の両方が使う)も同じ穴だったので対象に足す。
  // IngredientPricesPage は当て先が数字の欄だけだが、同じ blurOnEnter を持つので一緒に見る
  const imeGuardTargets = [
    'src/components/ChipInput.tsx',
    'src/components/PantryBoard.tsx',
    'src/components/UnitQuantityFields.tsx',
    'src/pages/SettingsPage.tsx',
    'src/pages/RecipeFormPage.tsx',
    'src/pages/MealPlanPage.tsx',
    'src/pages/IngredientPricesPage.tsx',
  ]
  for (const rel of imeGuardTargets) {
    const src = readFileSync(path.join(appRoot, rel), 'utf-8')
    const enterBranches = src.match(/e\.key === 'Enter'[^\n]*/g) ?? []
    const unguarded = enterBranches.filter(
      (line) => !line.includes('isImeConfirmKey') && !line.includes("e.key === ' '"),
    )
    eq(`EI-2 ${rel} に未ガードのEnter分岐が無い`, unguarded, [])
  }
}

// ---------- 便EI-4: 写真1枚あたりの容量表記を1つに揃える ----------
// 「150〜300KB」と「100〜300KB」が混在していた(2026-08-09 便EI)。実測は使い方ページ§12の表
// (scripts/measure-storage.mjs でIndexedDBの増分を実測。レシピの写真 約170KB・
// 「作った記録」の写真 約160KB)で、docs/20 §4 の記録写真の実測も150〜300KB。
// 圧縮設定はレシピ写真=長辺1200px/JPEG0.85(logic/image.ts)、記録写真=長辺1280px/JPEG0.80
// (CookedLogModal.tsx)で、どちらも同じ水準に落ちる。以後は全箇所を同じ範囲で書く。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const PHOTO_SIZE_TEXT = '150〜300KB'
  const targets = ['src/i18n/ja.ts', 'public/about/index.html', 'public/about/manual.html']
  for (const rel of targets) {
    const src = readFileSync(path.join(appRoot, rel), 'utf-8')
    // 「◯〜◯KB」の形で書かれた範囲表記だけを拾う(「約170KB」等の単一値は対象外)
    const ranges = [...new Set(src.match(/\d+〜\d+KB/g) ?? [])]
    eq(`EI-4 ${rel} の写真容量の範囲表記が1種類に揃っている`, ranges, ranges.length ? [PHOTO_SIZE_TEXT] : [])
  }
}

// ---------- 便EM: 選択したレシピの書き出しの確認文(規約F) ----------
// 何が含まれ、何が含まれないかを両方書く。ファイルを作るだけで端末のレシピは減らないので、
// そのことも書く(すぐ下に削除ボタンが並ぶため)。戻し方まで書いて行き止まりにしない。
// 2026-08-15 便GV: 素のダイアログ(window.confirm)から画面の中の窓(ConfirmDialog)へ移し、
// 見出し+箇条書き+補足の3つに分けた。測る中身は同じなので、確認の名前(EM-6/FA-3)は残す。
{
  const confirm = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: true,
  })
  const all = [confirm.title, ...confirm.bullets.map((b) => `${b.label}: ${b.text}`), ...confirm.notes].join('\n')
  const bulletText = (label) => confirm.bullets.find((b) => b.label === label)?.text ?? ''
  eq('EM-6 確認に選んだ品数が入る', confirm.title.includes('レシピ3品'), true)
  eq('EM-6 確認に「入るもの」がある', bulletText('入るもの') !== '', true)
  eq('EM-6 確認に「入らないもの」がある', bulletText('入らないもの') !== '', true)
  eq('EM-6 入らないものに選んでいない品数が入る', bulletText('入らないもの').includes('選んでいないレシピ106品'), true)
  eq('EM-6 記録の写真は入らないと書いてある', bulletText('入らないもの').includes('記録の写真'), true)
  eq('EM-6 アプリの設定は入らないと書いてある', bulletText('入らないもの').includes('設定'), true)
  eq('EM-6 端末のレシピが残ることを書いてある', all.includes('端末のレシピは減りません'), true)
  eq(
    'EM-6 戻し方を画面名・ボタン名で書いてある(規約H: 指示語で場所を示さない)',
    all.includes('設定の「バックアップを読み込む」の「今のデータに追加」'),
    true,
  )
  eq('EM-6 差し込みの取り残しが無い', /\{[a-z]+\}/.test(all), false)
  eq(
    'EM-6 選んでいない品が0でも文が壊れない',
    buildSelectedRecipesExportConfirm({ selected: 109, remaining: 0, bytes: 1024, canPickLocation: true })
      .bullets.find((b) => b.label === '入らないもの')
      ?.text.includes('選んでいないレシピ0品'),
    true,
  )
  // 2026-08-10 便FA(オーナー承認・docs/65 A-2): 書き出したファイルを人に渡すときの一言。
  // 「軽い注意」なので1行だけ。渡すこと自体は止めない（Pro版の解錠コードが入る全体の
  // バックアップとは言うべきことが違う。そちらは settings.backupContainsCodeNotice が
  // 「他の人に渡さないでください」と言い切る）
  eq(
    'FA-3 書き出し時に人へ渡すときの一言がある',
    confirm.notes.some((n) => n.includes('人に渡す・公開するときは中身をご確認ください')),
    true,
  )
  eq('FA-3 選択レシピの書き出しの確認で解錠コードの話はしない(このファイルには入らない)', all.includes('解錠コード'), false)
  eq(
    'FA-3 全体のバックアップは「他の人に渡さないでください」のまま(言うべきことが違う)',
    ja.settings.backupContainsCodeNotice.includes('他の人に渡さないでください'),
    true,
  )
  eq('FA-3 注意は1行に収める(重い警告にしない)', confirm.notes.filter((n) => n.includes('ご確認ください')).length, 1)
}

// ---------- 便EK-1: 週タブの文言に「今週」を使わない ----------
// 週タブは「前の週」「次の週」で当週以外も開けるので、開いている週を指す文言に「今週」と
// 書くと、当週以外を見ているときに画面と食い違う（便EJが総入れ替えの確認文で直した defect と同型）。
// 開いている週を指す言い方は「表示している週」にそろえる。
// 「今週へ戻る」(週移動ボタン)・「今週の献立の予定」(日タブ＝今日の話)のように、
// 本当に当週を指している文言はここに入れない＝機械的な一括置換をしないための一覧でもある。
{
  const weekScopeTexts = {
    weekCostTitle: ja.mealPlan.weekCostTitle,
    // 2026-08-19 便IF・⑥: 旧 fillWeekHint は無くし、出しかた×入れかたの4通りの1行にまとめた
    fillModeFillEmptyHint: ja.mealPlan.fillModeFillEmptyHint,
    // 2026-08-21 便IO: コピーの文言(copyWeek*)はここから外した。別の画面へ移っており、
    // その画面には週が2つある（入れ先と、中身を見ている週）ので「表示している週」では
    // どちらを指すか読めない。あちらは日付で言い切る規律にした＝IO-5 が見る
    fillModeReplaceAllHint: ja.mealPlan.fillModeReplaceAllHint,
    // 2026-08-15 便GW: 確認文を見出し＋項目に割ったので、週を名乗る側(見出し)も見る
    fillModeReplaceAllConfirmTitle: ja.mealPlan.fillModeReplaceAllConfirmTitle,
    fillModeReplaceAllGone: ja.mealPlan.fillModeReplaceAllGone,
    fillModeReplaceAllKept: ja.mealPlan.fillModeReplaceAllKept,
    fillModeReplaceAllDone: ja.mealPlan.fillModeReplaceAllDone,
    clearWeekSlotTitle: ja.mealPlan.clearWeekSlotTitle,
    clearWeekSlotTitleNone: ja.mealPlan.clearWeekSlotTitleNone,
    clearWeekSlotConfirmTitle: ja.mealPlan.clearWeekSlotConfirmTitle,
    clearWeekSlotConfirmAllTitle: ja.mealPlan.clearWeekSlotConfirmAllTitle,
    clearWeekSlotConfirm: ja.mealPlan.clearWeekSlotConfirm,
    clearWeekSlotConfirmAll: ja.mealPlan.clearWeekSlotConfirmAll,
    clearWeekSlotDone: ja.mealPlan.clearWeekSlotDone,
    templateSave: ja.mealPlan.templateSave,
    templateSaveDescription: ja.mealPlan.templateSaveDescription,
    templateApplyNone: ja.mealPlan.templateApplyNone,
    goToShopping: ja.mealPlan.goToShopping,
    lockAllDone: ja.mealPlan.lockAllDone,
    lockAllReleaseDone: ja.mealPlan.lockAllReleaseDone,
    nutritionWeekTitle: ja.nutritionBalance.weekTitle,
  }
  // 2026-08-09 便EM: 週タブの範囲えらび・栄養の開閉ボタン・空メッセージも同じ規律に載せる
  Object.assign(weekScopeTexts, {
    clearWeekSlotEmpty: ja.mealPlan.clearWeekSlotEmpty,
    templateSaveEmpty: ja.mealPlan.templateSaveEmpty,
    shopRangeSummaryAll: ja.mealPlan.shopRangeSummaryAll,
    shopRangeReset: ja.mealPlan.shopRangeReset,
    nutritionWeekToggleExpand: ja.nutritionBalance.weekToggleExpand,
    nutritionWeekToggleCollapse: ja.nutritionBalance.weekToggleCollapse,
  })
  for (const [key, text] of Object.entries(weekScopeTexts)) {
    eq(`EK-1 ${key} が開いている週を「今週」と呼んでいない`, text.includes('今週'), false)
    // 2026-08-09 便EM: 呼び方は1つにそろえる。同じ画面に「この週の献立の栄養」と
    // 「表示している週の概算食費」が隣り合って並び、別々の範囲に読めた(実DOMで確認)。
    // 週を名乗るなら「表示している週」だけを使う(名乗らない文言はそのままでよい)
    eq(`EM-2 ${key} が開いている週を「この週」と呼んでいない`, text.includes('この週'), false)
    // 「表示中の週」も混ぜない(テンプレート保存の説明文だけ第3の言い方になっていた)
    eq(`EM-2 ${key} が開いている週を「表示中の週」と呼んでいない`, text.includes('表示中の週'), false)
  }
  // 例外: 月タブの日モーダルの「この週を開く」は、タップした日を含む週へ移動するボタン。
  // その週はまだ表示されていないので「表示している週」では意味が通らない＝ここだけ残す
  eq('EM-2 月タブの日モーダルは「この週を開く」のまま', ja.mealPlan.monthDayModalOpenWeek, 'この週を開く')
  // 週タブの見出しは削除済み(便EK)。当週以外を開くと嘘になる文言を、未使用のまま残さない
  eq('EK-1 使われていない週タブ見出し(weekTitle)を残していない', 'weekTitle' in ja.mealPlan, false)
  // 使い方ページ・LPは、アプリの見出しと同じ名前で書く（画面を見ながら読めるようにする）
  {
    const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    for (const rel of ['public/about/manual.html', 'public/about/index.html']) {
      const src = readFileSync(path.join(appRoot, rel), 'utf-8')
      eq(`EK-1 ${rel} が概算食費の見出しをアプリと同じ名前で書いている`, src.includes(ja.mealPlan.weekCostTitle), true)
      eq(`EK-1 ${rel} に古い見出し「今週の概算食費」が残っていない`, src.includes('今週の概算食費'), false)
    }
  }
}

// ---------- 便EK-5: 「今日をどう数えるか」の言い方を、期間カードと週タブでそろえる ----------
// 期間カード(便EA)と週タブの栄養パネル(便EK)は同じ規則で数えるので、画面の言い方も1つにする。
// 週まとめの1行に「今日から先は登録した献立」が残っていると、今日の記録を数えている実装と食い違う。
{
  eq(
    'EK-5 今日の数え方の1文が期間カードと同じ',
    ja.nutritionBalance.basisNoteToday,
    ja.mealPlan.rangeBasisToday,
  )
  eq(
    'EK-5 週まとめの1行が今日を予定側に丸ごと入れる言い方をしていない',
    ja.nutritionBalance.weekBasisNote.includes('今日から先'),
    false,
  )
  eq(
    'EK-5 今日の日カードの見出し(記録と献立の両方を足した日)がある',
    ja.nutritionBalance.dayTitleMixed.includes('作った記録') &&
      ja.nutritionBalance.dayTitleMixed.includes('献立'),
    true,
  )
}

// ---------- 便EL: 調理中セッション（並行調理ナビの全画面表示）のカーソル遷移 ----------
// docs/69「状態の持ち方」。書ける状態はカーソル1つだけで、済んだ手順・各品の次手順・段取りは
// すべてここから導く。遷移表を先に固定してから画面を作る（docs/10 3章）。
{
  // 3品を並行に組んだ段取りの縮小版。stepIndex が -1 の行は「ナビが足した工程（湯を沸かす）」
  const plan = [
    { recipeId: 10, stepIndex: 0, text: '玉ねぎをみじん切りにする。' }, // 0
    { recipeId: 20, stepIndex: -1, text: '湯を沸かす' }, //               1
    { recipeId: 20, stepIndex: 0, text: 'にんじんを2分ゆでる。' }, //     2
    { recipeId: 10, stepIndex: 1, text: '鍋で15分煮る。' }, //            3
    { recipeId: 30, stepIndex: 0, text: 'ボウルに調味料を入れて混ぜ、マリネ液を作る。' }, // 4
    { recipeId: 10, stepIndex: 2, text: '器に盛る。' }, //                5
  ]
  const ids = [10, 20, 30]
  const at = (i) => ({ recipeId: plan[i].recipeId, stepIndex: plan[i].stepIndex })

  // 位置の特定（識別子は「レシピID＋レシピ内の手順の添字」。段取りの通し番号では持たない）
  eq('EL-CUR 先頭の位置', findCursorIndex(plan, at(0)), 0)
  eq('EL-CUR ナビが足した工程（添字-1）も指せる', findCursorIndex(plan, at(1)), 1)
  eq('EL-CUR 段取りに無い手順は-1', findCursorIndex(plan, { recipeId: 10, stepIndex: 9 }), -1)
  eq('EL-CUR 別レシピの同じ添字と取り違えない', findCursorIndex(plan, { recipeId: 30, stepIndex: 1 }), -1)
  eq('EL-CUR カーソル未設定は-1', findCursorIndex(plan, undefined), -1)
  eq('EL-CUR 同じ手順の判定', cursorEquals(at(3), { recipeId: 10, stepIndex: 1 }), true)
  eq('EL-CUR レシピが違えば別の手順', cursorEquals(at(3), { recipeId: 20, stepIndex: 1 }), false)
  eq('EL-CUR 片方が未設定なら常にfalse', cursorEquals(undefined, at(0)), false)

  // 開始
  eq('EL-CUR 開始は段取りの先頭', startCursor(plan), { recipeId: 10, stepIndex: 0 })
  eq('EL-CUR 段取りが空なら開始できない', startCursor([]), undefined)

  // 遷移表: 次へ
  eq('EL-CUR 次へ（先頭→2番目）', advanceCursor(plan, at(0)), { recipeId: 20, stepIndex: -1 })
  eq('EL-CUR 次へ（ナビが足した工程→本来の手順）', advanceCursor(plan, at(1)), { recipeId: 20, stepIndex: 0 })
  eq('EL-CUR 次へ（末尾では動かない）', advanceCursor(plan, at(5)), undefined)
  eq('EL-CUR 次へ（段取りに無い手順からは動かない）', advanceCursor(plan, { recipeId: 10, stepIndex: 9 }), undefined)

  // 遷移表: 戻る
  eq('EL-CUR 戻る（2番目→先頭）', backCursor(plan, at(1)), { recipeId: 10, stepIndex: 0 })
  eq('EL-CUR 戻る（先頭では動かない）', backCursor(plan, at(0)), undefined)
  eq('EL-CUR 戻る（段取りに無い手順からは動かない）', backCursor(plan, { recipeId: 99, stepIndex: 0 }), undefined)
  // 「次へ→戻って」で必ず元の手順に帰る（オーナーが挙げた懸念「戻ってと言っても違う手順にとばされる」）
  for (let i = 0; i < plan.length - 1; i++) {
    eq(
      `EL-CUR 次へ→戻るで元の手順に帰る(${i})`,
      backCursor(plan, advanceCursor(plan, at(i))),
      at(i),
    )
  }
  // 「戻って→次へ」も同じ手順に帰る（手順飛ばしが起きない）
  for (let i = 1; i < plan.length; i++) {
    eq(
      `EL-CUR 戻る→次へで元の手順に帰る(${i})`,
      advanceCursor(plan, backCursor(plan, at(i))),
      at(i),
    )
  }

  // 端の判定
  eq('EL-CUR 先頭にいる', isCursorAtFirst(plan, at(0)), true)
  eq('EL-CUR 先頭にいない', isCursorAtFirst(plan, at(1)), false)
  eq('EL-CUR 末尾にいる', isCursorAtLast(plan, at(5)), true)
  eq('EL-CUR 末尾にいない', isCursorAtLast(plan, at(4)), false)
  eq('EL-CUR 段取りに無い手順は末尾扱いにしない', isCursorAtLast(plan, { recipeId: 10, stepIndex: 9 }), false)

  // 復元（再読み込み時）。見つからなければ推測せず undefined＝段取りの一覧表示に戻す
  eq('EL-CUR 復元できる', resolveCursor(plan, { recipeId: 20, stepIndex: 0 }), { recipeId: 20, stepIndex: 0 })
  eq('EL-CUR 復元の失敗（手順が消えた）は推測しない', resolveCursor(plan, { recipeId: 20, stepIndex: 5 }), undefined)
  eq('EL-CUR 復元の失敗（レシピが段取りから外れた）', resolveCursor(plan, { recipeId: 40, stepIndex: 0 }), undefined)
  eq('EL-CUR 覚えていない状態からの復元', resolveCursor(plan, undefined), undefined)

  // 開き直し（2026-08-10 便FC・オーナー実機「一回閉じて再度開くと①に戻ってしまう。
  // 前回閉じた時の手順から再開したい」）。閉じてもカーソルを捨てなくなったので、
  // 「覚えていればそこから・無ければ先頭から」をここで固定する
  eq('FC-CUR 覚えていた手順が段取りにあれば、そこから再開する', resumeCursor(plan, at(3)), at(3))
  eq('FC-CUR ナビが足した工程からでも再開できる', resumeCursor(plan, at(1)), at(1))
  eq('FC-CUR 覚えていなければ先頭から', resumeCursor(plan, undefined), at(0))
  eq(
    'FC-CUR 覚えていた手順が段取りから消えていたら先頭から（近い手順を当てにいかない）',
    resumeCursor(plan, { recipeId: 10, stepIndex: 9 }),
    at(0),
  )
  eq('FC-CUR 段取りが空なら開けない', resumeCursor([], at(0)), undefined)

  // 各品の次の手順＝カーソルの投影（済みセットを持たない）
  eq(
    'EL-NEXT 先頭にいるとき、他2品の次の手順',
    nextStepsByRecipe(plan, at(0), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [20, -1],
      [30, 0],
    ],
  )
  eq(
    'EL-NEXT 進むと投影も進む（20の湯沸かしは済み扱いになる）',
    nextStepsByRecipe(plan, at(1), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [10, 1],
      [30, 0],
    ],
  )
  eq(
    'EL-NEXT 残っていない品は undefined（作り終えた表示にする）',
    nextStepsByRecipe(plan, at(5), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [20, undefined],
      [30, undefined],
    ],
  )
  eq('EL-NEXT いま開いている品は下部に出さない', nextStepsByRecipe(plan, at(0), ids).some((x) => x.recipeId === 10), false)
  eq('EL-NEXT 並びはレシピの色の順で固定', nextStepsByRecipe(plan, at(4), ids).map((x) => x.recipeId), [10, 20])
  eq('EL-NEXT カーソルが段取りに無ければ何も出さない', nextStepsByRecipe(plan, { recipeId: 99, stepIndex: 0 }, ids), [])

  // ---------- 便GQ: タイマーの手順は「見るだけ」＝現在地を動かさない（2026-08-15） ----------
  // オーナー判断A案「タイマーが鳴る手順は、すでに通り過ぎた手順。やりたいのは『その手順を読んで、
  // その一手をやる』ことであって、進捗を戻すことではない」。
  // 便FC〜便GO は、タイマーの窓の「手順◯を開く」でカーソルそのものを動かしていた。
  // このアプリは「済んだ手順＝現在地より前」で数える（docs/69 の不変条件）ので、
  // 現在地が戻ると**通り過ぎた手順がまるごと「まだやっていない」に巻き戻り**、
  // 他の品の「次の手順」の表示もつられて巻き戻っていた（戻す手立ては「次へ」の押し直しだけ）。
  {
    /**
     * 利用者が確かめたいこと＝**タイマーから手順を見たあとも、どこに居るかが変わっていない**。
     * 「どこに居るか」は画面の文字ではなく、この2つの導出で見る:
     *   ①段取りの中の位置（＝済んだ手順がどこまでか）②各品の次の手順（その裏返しの投影）
     */
    const whereAmI = (cursor) => ({
      index: findCursorIndex(plan, cursor),
      next: nextStepsByRecipe(plan, cursor, ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    })
    // 段取りの先頭でタイマーを始め、そこから何回か「次へ」を押して進んだところ
    const timerStep = at(0)
    const cooking = at(4)
    const before = whereAmI(cooking)
    const landing = resolveTimerStepLanding(plan, cooking, timerStep)
    eq('GQ-PEEK 通り過ぎた手順のタイマーは「見るだけ」で開く', landing, {
      kind: 'peek',
      target: timerStep,
    })
    eq('GQ-PEEK 見たあとも、どこに居るかは1つも変わらない', whereAmI(cooking), before)
    // 行き先に「新しい現在地」を含めない＝呼び出し側にカーソルを動かす材料を渡さない
    // （この1行が崩れたら、巻き戻しの不具合を作れる形に戻っている）
    eq('GQ-PEEK 行き先に新しい現在地は含まれない', Object.keys(landing).sort(), ['kind', 'target'])
    // 現在地より**後ろ**の手順のタイマー（段取りの一覧から先の手順のタイマーを始めた場合）も、
    // 同じく見るだけ。前へ飛ばすと、今度は**やっていない手順が「済んだ」に化ける**
    eq('GQ-PEEK 現在地より後ろの手順のタイマーも「見るだけ」（前へも動かさない）', {
      landing: resolveTimerStepLanding(plan, at(1), at(4)),
      where: whereAmI(at(1)),
    }, {
      landing: { kind: 'peek', target: at(4) },
      where: whereAmI(at(1)),
    })
    // いま開いている手順のタイマーでも扱いは同じ（押しても何も動かない＝押し損じが無害）
    eq('GQ-PEEK いま開いている手順のタイマーでも同じ扱い', resolveTimerStepLanding(plan, at(2), at(2)), {
      kind: 'peek',
      target: at(2),
    })
    // 調理していない（カーソルが無い）ときは今までどおり段取りの一覧の該当カードへ送る。
    // 巻き戻す現在地が無いので、こちらの動きは変えない
    eq('GQ-PEEK 調理していないときは段取りの一覧へ送る', resolveTimerStepLanding(plan, undefined, at(0)), {
      kind: 'list',
    })
    // 覚えていた現在地が組み直した段取りから消えていたら、推測せず一覧へ（docs/69「復元」）
    eq(
      'GQ-PEEK 現在地が段取りから消えていたら一覧へ（近い手順を当てにいかない）',
      resolveTimerStepLanding(plan, { recipeId: 10, stepIndex: 9 }, at(0)),
      { kind: 'list' },
    )
    // タイマーの手順のほうが段取りから消えている（レシピを直した等）ときも一覧へ
    eq(
      'GQ-PEEK タイマーの手順が段取りに無ければ一覧へ',
      resolveTimerStepLanding(plan, cooking, { recipeId: 20, stepIndex: 7 }),
      { kind: 'list' },
    )
    eq('GQ-PEEK 手順を指していないタイマーは一覧へ', resolveTimerStepLanding(plan, cooking, undefined), {
      kind: 'list',
    })
    // 段取りのどの位置から、どの手順のタイマーを開いても、現在地は1つも動かない（総当たり）
    for (let i = 0; i < plan.length; i++) {
      for (let j = 0; j < plan.length; j++) {
        const snapshot = whereAmI(at(i))
        resolveTimerStepLanding(plan, at(i), at(j))
        eq(`GQ-PEEK 現在地(${i})から手順(${j})を見ても居場所が動かない`, whereAmI(at(i)), snapshot)
      }
    }
  }

  // 畳んだ1行の書式（2026-08-09 オーナー決定「文頭…文末」）
  eq('EL-FOLD 上限内はそのまま', collapseStepText('玉ねぎをみじん切りにする。', 20), '玉ねぎをみじん切りにする。')
  eq(
    // 2026-08-09 便ES（オーナー指示E-8）: 語の途中で切らず、文節の切れ目でだけ切る。
    // 「オリーブオイル」の途中で切れる代わりに文頭が短くなり、余りは文末側に回す
    'EL-FOLD 長い手順は文節の切れ目で文頭と文末を残して中央を省く',
    collapseStepText('ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。', 20),
    'ボウルに…よく混ぜ、マリネ液を作る。',
  )
  eq(
    'EL-FOLD 文節の切れ目で切る（「みじん切りに」の途中で切らない）',
    collapseStepText('玉ねぎをみじん切りにしてから、フライパンでしんなりするまで炒める。', 20),
    '玉ねぎをみじん切りに…炒める。',
  )
  eq('EL-FOLD 省略しても上限の文字数を超えない', [...collapseStepText('あ'.repeat(80), 20)].length, 20)
  eq('EL-FOLD 前後の空白は落とす', collapseStepText('  器に盛る。  ', 20), '器に盛る。')
  eq('EL-FOLD 文末の残す量は指定できる', collapseStepText('あいうえおかきくけこさしすせそたちつてと', 11, 5), 'あいうえお…たちつてと')
  eq('EL-FOLD 上限ちょうどは省略しない', collapseStepText('あ'.repeat(20), 20), 'あ'.repeat(20))
  eq('EL-FOLD 1文字超えたら省略する', [...collapseStepText('あ'.repeat(21), 20)].join('').includes('…'), true)
}

// ---------- 便EL: 調理中は「作った記録」を段取りへ逆流させない（記録は一方通行） ----------
// docs/69 の不変条件。2026-08-09 に実発した「並行調理中に1品だけ『作った！』すると
// 段取りが崩壊する」と同型の事故を、実行中は母集合を動かさないことで封じる。
{
  eq(
    'EL-ONEWAY 調理中は1品がcookedになっても段取りの母集合が変わらない',
    reconcileSelectedIdsForSession([1, 2, 3], [1, 3], true),
    [1, 2, 3],
  )
  eq(
    'EL-ONEWAY 調理中でなければ従来どおり候補から消えた品を落とす',
    reconcileSelectedIdsForSession([1, 2, 3], [1, 3], false),
    [1, 3],
  )
  eq(
    'EL-ONEWAY 調理中に候補が全部消えても段取りは残る',
    reconcileSelectedIdsForSession([1, 2, 3], [], true),
    [1, 2, 3],
  )
  eq(
    'EL-ONEWAY 調理中でなければ従来の整合と同じ結果になる',
    reconcileSelectedIdsForSession([3, 1, 2], [1, 2, 3], false),
    reconcileSelectedIds([3, 1, 2], [1, 2, 3]),
  )
}

// ---------- 便ES: 候補が「読み込み中」のうちは選択を1品も落とさない ----------
// 2026-08-09 オーナー実機報告の重大バグ「段取りが消える／『今日の献立にない品を、
// 組み合わせから外しました。』が出る」の再発防止。今日の献立の候補は
// 「今日の献立リスト」「今週の献立の予定」「レシピ本体」の3つが揃って初めて決まる。
// 1本でも読み込み中なら候補は"まだ分からない"のであって"ゼロ"ではない。
{
  eq(
    'ES-LOADING 候補が未読込(undefined)なら選択をそのまま残す',
    reconcileSelectedIdsForSession([1, 2, 3], undefined, false),
    [1, 2, 3],
  )
  eq(
    'ES-LOADING 候補が未読込なら調理中でも選択をそのまま残す',
    reconcileSelectedIdsForSession([1, 2, 3], undefined, true),
    [1, 2, 3],
  )
  eq(
    'ES-LOADING 空配列(＝読み終えて候補ゼロ)は従来どおり落とす',
    reconcileSelectedIdsForSession([1, 2, 3], [], false),
    [],
  )
}

// ---------- 便FR: 覚えていた選択が1品も残らなかったら、初めて開いたときと同じ状態にする ----------
// 2026-08-12 利用者テストの実操作再現「今日の献立に3品入れて段取りを作り、3品とも別の品に
// 入れ替えてナビへ戻ると『0品を選択中』で『段取りを作る』が押せない。もう一度どこかへ行って
// 戻ると3品が選ばれて押せる」＝同じ画面が来るたびに違う状態で開いていた。
// 真因: 覚えていた選択があると初回の自動選択を止める札が立ち、覚えていた選択が整合で全部
// 落ちた後も札が立ったままだった（次に開くと覚え書きが消えていて初回扱いになる＝結果が揺れる）。
{
  eq('FR-RESELECT 選べる品数の上限は3品', COOK_NAVI_MAX_RECIPES, 3)
  eq('FR-RESELECT 初期選択は今日の献立の先頭3品', pickDefaultSelectedIds([7, 8, 9, 10]), [7, 8, 9])
  eq('FR-RESELECT 今日の献立が1品なら1品だけ', pickDefaultSelectedIds([7]), [7])
  eq('FR-RESELECT 今日の献立が空なら0品', pickDefaultSelectedIds([]), [])

  eq(
    'FR-RESELECT 1品でも残っていれば、その選択をそのまま使う',
    resolveCookNaviSelection([1, 2, 3], [3, 8, 9], false),
    [3],
  )
  eq(
    'FR-RESELECT 残る品の順番（＝色の順）も変えない',
    resolveCookNaviSelection([3, 1, 2], [1, 2, 3], false),
    [3, 1, 2],
  )
  eq(
    'FR-RESELECT 覚えていた選択が全部落ちたら、今日の献立の先頭3品を選ぶ（本題）',
    resolveCookNaviSelection([1, 2, 3], [7, 8, 9, 10], false),
    [7, 8, 9],
  )
  eq(
    'FR-RESELECT 全部落ちて今日の献立が1品なら1品を選ぶ',
    resolveCookNaviSelection([1, 2, 3], [7], false),
    [7],
  )
  eq(
    'FR-RESELECT 全部落ちて今日の献立も空なら0品のまま',
    resolveCookNaviSelection([1, 2, 3], [], false),
    [],
  )
  eq(
    'FR-RESELECT 自分で全部外した状態は勝手に選び直さない',
    resolveCookNaviSelection([], [7, 8, 9], false),
    [],
  )
  eq(
    'FR-RESELECT 候補が未読込(undefined)のときは選択に触らない',
    resolveCookNaviSelection([1, 2, 3], undefined, false),
    [1, 2, 3],
  )
  eq(
    'FR-RESELECT 候補が未読込で1品も選んでいなければ0品のまま',
    resolveCookNaviSelection([], undefined, false),
    [],
  )
  eq(
    'FR-RESELECT 調理中は1品も落とさない＝選び直しも起きない（docs/69 記録は一方通行）',
    resolveCookNaviSelection([1, 2, 3], [7, 8, 9], true),
    [1, 2, 3],
  )
  eq(
    'FR-RESELECT 一部だけ落ちたときは残りだけ（足して3品にしない）',
    resolveCookNaviSelection([1, 2, 3], [1, 8, 9], false),
    [1],
  )
  // 落ちた品が無ければ結果は入力そのまま＝画面側は「変わっていない」と判断できる
  eq(
    'FR-RESELECT 何も落ちなければ入力のまま',
    resolveCookNaviSelection([1, 2], [1, 2, 3], false),
    [1, 2],
  )
}

// ---------- 便EL: 調理中の手順の覚え書き（sessionStorage の読み取り） ----------
{
  eq(
    'EL-SESSION 調理中の手順を覚えられる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: false, current: { recipeId: 2, stepIndex: 0 } }),
    ),
    {
      selectedIds: [1, 2],
      showTimeline: true,
      trialActive: false,
      current: { recipeId: 2, stepIndex: 0 },
    },
  )
  eq(
    // 2026-08-12 便FT: 全画面を開いていたかどうかは覚え書きに入れない（別の置き場に移した）。
    // 「どこまで進んだか」は端末に残し、「全画面を開いていたか」はアプリを閉じるまで
    // ＝アプリを開き直したときは、必ず段取りの一覧に着地して「続きから見る」で本人が開く
    'FC-SESSION 全画面の開閉は覚え書きに混ぜない（位置だけを覚える）',
    parseCookNaviSession(
      JSON.stringify({
        selectedIds: [1, 2],
        showTimeline: true,
        trialActive: false,
        current: { recipeId: 2, stepIndex: 0 },
        sessionOpen: true,
      }),
    ).sessionOpen,
    undefined,
  )
  eq(
    'FC-SESSION 閉じていても調理中の手順は残る（開き直すと続きから）',
    parseCookNaviSession(
      JSON.stringify({
        selectedIds: [1, 2],
        showTimeline: true,
        trialActive: false,
        current: { recipeId: 2, stepIndex: 3 },
      }),
    )?.current,
    { recipeId: 2, stepIndex: 3 },
  )
  eq(
    'EL-SESSION ナビが足した工程（添字-1）も覚えられる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: false, current: { recipeId: 2, stepIndex: -1 } }),
    )?.current,
    { recipeId: 2, stepIndex: -1 },
  )
  eq(
    'EL-SESSION 壊れたカーソルは覚えていない扱い',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, current: { recipeId: 'x', stepIndex: 0 } }),
    )?.current,
    undefined,
  )
  eq(
    'EL-SESSION 段取りを表示していないのに調理中、という不整合は捨てる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: false, current: { recipeId: 2, stepIndex: 0 } }),
    )?.current,
    undefined,
  )
  eq(
    'EL-SESSION 旧形式（カーソルなし）はそのまま読める',
    parseCookNaviSession(JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: true })),
    { selectedIds: [1, 2], showTimeline: true, trialActive: true },
  )
}

// ---------- 便EN: 記録写真の回転(2026-08-09 オーナー要望「記録した写真を回転させることは可能?」) ----------
// 「4回押すと元の向きに戻る」ことと、90度・270度で縦横が入れ替わることを固定する。
// 実際の描画(canvas)はブラウザ側なのでここでは扱わず、向きと大きさの計算だけを見張る。
{
  eq('EN-ROT 1回押すと90度(1/4回転)', normalizeQuarterTurns(1), 1)
  eq('EN-ROT 4回押すと元の向きに戻る', normalizeQuarterTurns(4), 0)
  eq('EN-ROT 5回押すと1回押したのと同じ', normalizeQuarterTurns(5), 1)
  eq('EN-ROT 8回押しても元の向き', normalizeQuarterTurns(8), 0)
  eq('EN-ROT 左に1回(-1)は右に3回と同じ', normalizeQuarterTurns(-1), 3)
  eq('EN-ROT 90度は縦横が入れ替わる', rotatedSize(1280, 960, 1), { width: 960, height: 1280 })
  eq('EN-ROT 270度も縦横が入れ替わる', rotatedSize(1280, 960, 3), { width: 960, height: 1280 })
  eq('EN-ROT 180度は縦横そのまま', rotatedSize(1280, 960, 2), { width: 1280, height: 960 })
  eq('EN-ROT 4回で元の大きさに戻る', rotatedSize(1280, 960, 4), { width: 1280, height: 960 })
}

// ---------- 便ER: アプリの更新(2026-08-09) ----------
// 更新の仕組みは「Service Workerの入れ替わりを見て、画面を読み込み直す」だけで、
// レシピ・価格・設定・解錠コード(IndexedDB)には触れない。appRefreshと同じく、
// 触れないことをソースの静的検査で固定する(触れる実装に変わったらここで落ちる)。
// また、勝手に画面が作り直されないことの要は onNeedReload を渡していることなので、
// これが外されたら気づけるようにしておく(外すとregisterSWが即座にreloadを呼ぶ)。
{
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const appUpdateSrc = readFileSync(path.join(scriptDir, '../src/logic/appUpdate.ts'), 'utf-8')
  eq(
    'ER-UPDATE appUpdateはdexie/db配下をimportせず、indexedDBのプロパティアクセスもしない',
    /from ['"]dexie['"]|from ['"]\.\.\/db|indexeddb\.\w/i.test(appUpdateSrc),
    false,
  )
  eq(
    'ER-UPDATE registerSWにonNeedReloadを渡している(既定の自動リロードを止める要)',
    appUpdateSrc.includes('onNeedReload'),
    true,
  )
  // 帯を出さない場面の判定は、この2つの入口だけで決まる(調理中・段取り中・入力中)
  const bannerSrc = readFileSync(
    path.join(scriptDir, '../src/components/AppUpdateBanner.tsx'),
    'utf-8',
  )
  eq(
    'ER-UPDATE 帯は「中断されると困る作業」とタイマーの両方を見て出し分ける',
    bannerSrc.includes('isAppBusy') && bannerSrc.includes('timers.length'),
    true,
  )
  for (const [label, file] of [
    ['調理中モード', '../src/components/FocusMode.tsx'],
    ['並行調理ナビの段取り実行中', '../src/components/CookSessionOverlay.tsx'],
    ['レシピを書く画面', '../src/pages/RecipeFormPage.tsx'],
  ]) {
    eq(
      `ER-UPDATE ${label}は「中断されると困る作業」として数える`,
      readFileSync(path.join(scriptDir, file), 'utf-8').includes('useAppBusyWhileMounted()'),
      true,
    )
  }
}

// ---------- HOMENOTICE: ホーム画面への追加の初回お知らせ(2026-08-10 便EW) ----------
{
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const base = { touchPrimary: true, launchedFromHomeScreen: false, seen: false }
  eq('HOMENOTICE 3条件をすべて満たすと出す', shouldShowHomeScreenNotice(base), true)
  eq(
    'HOMENOTICE パソコン(指で操作しない)には出さない',
    shouldShowHomeScreenNotice({ ...base, touchPrimary: false }),
    false,
  )
  eq(
    'HOMENOTICE すでにホーム画面のアイコンから開いているときは出さない',
    shouldShowHomeScreenNotice({ ...base, launchedFromHomeScreen: true }),
    false,
  )
  eq(
    'HOMENOTICE 一度見たら出さない',
    shouldShowHomeScreenNotice({ ...base, seen: true }),
    false,
  )
  eq(
    'HOMENOTICE 見ていてもパソコンでも、条件が2つ欠ければ当然出さない',
    shouldShowHomeScreenNotice({ touchPrimary: false, launchedFromHomeScreen: true, seen: true }),
    false,
  )

  // 端末の判定にユーザーエージェント文字列を使わない(UAは別の端末を名乗ることがある)。
  // 入力装置の性質3つ((pointer:coarse)・(hover:none)・maxTouchPoints)だけで決める
  const noticeSrc = readFileSync(path.join(scriptDir, '../src/logic/homeScreenNotice.ts'), 'utf-8')
  eq(
    'HOMENOTICE 端末の判定にuserAgentを使っていない',
    /navigator\.userAgent|userAgentData/.test(noticeSrc),
    false,
  )
  for (const signal of ['(pointer: coarse)', '(hover: none)', 'maxTouchPoints']) {
    eq(`HOMENOTICE 判定材料に ${signal} を見ている`, noticeSrc.includes(signal), true)
  }

  // 見た記録は端末内(localStorage)だけ。設定(Dexie)に置くとバックアップの中身に混ざる。
  // 読み書き自体は logic/noticeSeen.ts に集約した(2026-08-13 便GE)ので、そちらで見る
  const seenSrc = readFileSync(path.join(scriptDir, '../src/logic/noticeSeen.ts'), 'utf-8')
  eq('HOMENOTICE 見た記録はlocalStorageに置く', seenSrc.includes('window.localStorage'), true)
  eq(
    'HOMENOTICE 見た記録の読み書きは共通の1か所に寄せてある',
    noticeSrc.includes("from './noticeSeen'") &&
      noticeSrc.includes('hasSeenNotice(HOME_SCREEN_NOTICE_SEEN_KEY)') &&
      noticeSrc.includes('markNoticeSeen(HOME_SCREEN_NOTICE_SEEN_KEY)'),
    true,
  )
  eq(
    'HOMENOTICE 記録を読めない端末は「見た」扱い(毎回出る窓にしない)',
    /catch\s*\{\s*return true/.test(seenSrc),
    true,
  )
  const backupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const typesSrc = readFileSync(path.join(scriptDir, '../src/db/types.ts'), 'utf-8')
  eq(
    'HOMENOTICE 見た記録がバックアップ・設定の器に入り込んでいない',
    /homeScreenNotice/i.test(backupSrc) || /homeScreenNotice/i.test(typesSrc),
    false,
  )

  // お知らせの文言(規約H・オーナー確認用にここで固定する)
  eq(
    'HOMENOTICE 見出しは「インストール」「アプリとして」と言わない',
    /インストール|アプリとして/.test(ja.homeScreenNotice.title),
    false,
  )
  eq(
    'HOMENOTICE 「必須」「推奨」「おすすめ」等の押す言葉を使っていない',
    /必須|推奨|おすすめ|してください[^。]*$/.test(
      `${ja.homeScreenNotice.title}${ja.homeScreenNotice.body}${ja.homeScreenNotice.dismissButton}`,
    ),
    false,
  )
  // 2026-08-21 便IR: 一文まるごとの照合をやめた（言い回しを直すたびに、アプリは正常なのに
  // ここだけ赤くなる＝禁じ手②）。見たいのは「アプリストアからのダウンロードではないと
  // 言っているか」なので、その形だけを見る
  eq(
    'HOMENOTICE 本文はアプリストアからのダウンロードではないと伝える(「インストール不要」とは言わない)',
    /アプリストアからのダウンロード[^。]{0,6}(必要ありません|ありません|不要)/.test(ja.homeScreenNotice.body) &&
      !/インストール[^。]{0,12}(不要|いりません)/.test(ja.homeScreenNotice.body),
    true,
  )
  eq(
    'HOMENOTICE あとから見る場所を、設定のリンク名そのままで案内している',
    ja.homeScreenNotice.laterNote.includes(ja.settings.installPageLink),
    true,
  )
  eq(
    'HOMENOTICE 案内文が「ここ」「これ」で場所を示していない',
    /(^|[^そあど])ここ|これ(から)?を?(見|開)/.test(ja.homeScreenNotice.laterNote),
    false,
  )

  // 窓の作り: エラー・警告に見える色を使わない(条件反射で閉じたくなる画面にしない)。
  // 窓そのもの(カード・✕・閉じ方の3通り)は共通の NoticeDialog.tsx に移した(2026-08-13 便GE)
  const noticeUi = readFileSync(
    path.join(scriptDir, '../src/components/HomeScreenNotice.tsx'),
    'utf-8',
  )
  const dialogUi = readFileSync(path.join(scriptDir, '../src/components/NoticeDialog.tsx'), 'utf-8')
  eq(
    'HOMENOTICE 警告色・全面の黒地を使っていない',
    /warning|bg-black|text-red|AlertTriangle/.test(noticeUi + dialogUi),
    false,
  )
  eq(
    'HOMENOTICE 窓は✕・カード外のタップ・端末の戻る(Escape)の3通りで閉じられる',
    dialogUi.includes('useOverlayDismiss(true, onClose)') &&
      dialogUi.split('onClick={onClose}').length - 1 >= 2,
    true,
  )
  eq(
    'HOMENOTICE ✕・カード外のタップ・端末の戻る・「このまま使う」のどれで閉じても見た記録を残す',
    noticeUi.includes('markHomeScreenNoticeSeen()') &&
      noticeUi.includes('onClose={close}') &&
      noticeUi.includes('onClick={close}'),
    true,
  )
}

// ---------- FIRSTSETUP: 「食数の設定」「台所の器具」の初回の案内(2026-08-13 便GE・docs/65 A-4) ----------
{
  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const base = {
    settingsLoaded: true,
    recipeShown: true,
    openedForTask: false,
    seen: false,
    settingsChosen: false,
  }
  eq('FIRSTSETUP 条件をすべて満たすと出す', shouldShowFirstSetupNotice(base), true)
  eq(
    'FIRSTSETUP 設定の読み込みが済むまでは出さない',
    shouldShowFirstSetupNotice({ ...base, settingsLoaded: false }),
    false,
  )
  eq(
    'FIRSTSETUP レシピが表示されていない画面(読み込み中・見つからない)には出さない',
    shouldShowFirstSetupNotice({ ...base, recipeShown: false }),
    false,
  )
  eq(
    'FIRSTSETUP 用事があって開いた画面(タイマーの手順・記録の編集)には割り込まない',
    shouldShowFirstSetupNotice({ ...base, openedForTask: true }),
    false,
  )
  eq('FIRSTSETUP 一度見たら出さない', shouldShowFirstSetupNotice({ ...base, seen: true }), false)
  eq(
    'FIRSTSETUP すでに設定を自分で決めている人には出さない',
    shouldShowFirstSetupNotice({ ...base, settingsChosen: true }),
    false,
  )

  // 「自分で決めている」の見分け(5項目のどれか1つでも決めていれば出さない)
  eq('FIRSTSETUP まっさらな設定は「まだ決めていない」', hasChosenFirstSetup({}), false)
  eq('FIRSTSETUP 設定が読めていないときも「まだ決めていない」', hasChosenFirstSetup(undefined), false)
  for (const [label, patch] of [
    ['食数の設定', { householdServings: 2 }],
    ['コンロの口数', { kitchenBurners: 1 }],
    ['電子レンジ(持っていない)', { kitchenNoMicrowave: true }],
    ['魚焼きグリル(持っていない)', { kitchenNoGrill: true }],
    ['トースター(持っていない)', { kitchenNoToaster: true }],
  ]) {
    eq(`FIRSTSETUP ${label}を決めていたら出さない`, hasChosenFirstSetup(patch), true)
  }
  // 既定と同じ値に戻した場合も「自分で決めた」＝案内は出さない(触った人には用のない窓)
  eq(
    'FIRSTSETUP 既定と同じ値(2口)を選び直した人も「決めた」扱い',
    hasChosenFirstSetup({ kitchenBurners: 2 }),
    true,
  )
  eq(
    'FIRSTSETUP 「持っている」に戻した(false)人も「決めた」扱い',
    hasChosenFirstSetup({ kitchenNoToaster: false }),
    true,
  )

  // 見た記録は端末内(localStorage)だけ。設定(Dexie)＝バックアップの中身には入れない
  const fsSrc = readFileSync(path.join(scriptDir, '../src/logic/firstSetupNotice.ts'), 'utf-8')
  eq(
    'FIRSTSETUP 見た記録は端末内(localStorage)の共通の仕組みに載せる',
    fsSrc.includes("from './noticeSeen'") &&
      fsSrc.includes('hasSeenNotice(FIRST_SETUP_NOTICE_SEEN_KEY)') &&
      fsSrc.includes('markNoticeSeen(FIRST_SETUP_NOTICE_SEEN_KEY)'),
    true,
  )
  eq('FIRSTSETUP 保存キーが他の案内と重なっていない', FIRST_SETUP_NOTICE_SEEN_KEY, 'uchirecipe:firstSetupNoticeSeen')
  const fsBackupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const fsTypesSrc = readFileSync(path.join(scriptDir, '../src/db/types.ts'), 'utf-8')
  eq(
    'FIRSTSETUP 見た記録がバックアップ・設定の器に入り込んでいない',
    /firstSetupNotice/i.test(fsBackupSrc) || /firstSetupNotice/i.test(fsTypesSrc),
    false,
  )

  /**
   * 文言(規約H)。オーナー指示「ここに情報詰めすぎると、読まずに消されるので、
   * 必要最低限の文字数で、的確な場所に案内を出したい」に対して、便GEで上限を決めた。
   * 上限を超えたらここで落ちる＝あとから一言足していく形での肥大化を止める
   */
  const n = (s) => [...s].length
  const fsText = ja.firstSetupNotice
  eq(`FIRSTSETUP 見出しは20字以内(実測${n(fsText.title)}字)`, n(fsText.title) <= 20, true)
  eq(`FIRSTSETUP 本文は45字以内(実測${n(fsText.body)}字)`, n(fsText.body) <= 45, true)
  eq(
    `FIRSTSETUP ボタンは各12字以内(実測${n(fsText.settingsButton)}字/${n(fsText.dismissButton)}字)`,
    n(fsText.settingsButton) <= 12 && n(fsText.dismissButton) <= 12,
    true,
  )
  eq(
    `FIRSTSETUP あとから変える場所の一言は40字以内(実測${n(fsText.laterNote)}字)`,
    n(fsText.laterNote) <= 40,
    true,
  )
  const fsTotal =
    n(fsText.title) +
    n(fsText.body) +
    n(fsText.settingsButton) +
    n(fsText.dismissButton) +
    n(fsText.laterNote)
  eq(`FIRSTSETUP 窓の文字は合計120字以内(実測${fsTotal}字)`, fsTotal <= 120, true)

  eq(
    'FIRSTSETUP 「必須」「推奨」「おすすめ」等の押す言葉を使っていない',
    /必須|推奨|おすすめ|ぜひ|しましょう/.test(
      `${fsText.title}${fsText.body}${fsText.settingsButton}${fsText.dismissButton}${fsText.laterNote}`,
    ),
    false,
  )
  eq(
    'FIRSTSETUP 本文は2つの設定がどこに効くかを言っている',
    fsText.body.includes('分量') && fsText.body.includes('段取り'),
    true,
  )
  eq(
    'FIRSTSETUP あとから変える場所を、設定の欄の名前そのままで案内している',
    fsText.laterNote.includes(ja.settings.householdServingsTitle) &&
      fsText.laterNote.includes(ja.settings.kitchenTitle) &&
      fsText.laterNote.includes(ja.settings.tabBasic),
    true,
  )
  eq(
    'FIRSTSETUP 案内文が「ここ」「これ」で場所を示していない',
    /(^|[^そあど])ここ|これ(から)?を?(見|開)/.test(`${fsText.body}${fsText.laterNote}`),
    false,
  )
  eq(
    'FIRSTSETUP 「タブ」という言い方をしていない(設定は1本スクロール)',
    /タブ/.test(`${fsText.title}${fsText.body}${fsText.laterNote}`),
    false,
  )

  // 窓の作り(端末のホーム画面追加の案内と同じ NoticeDialog に載せる)と、設定への行き先
  const fsUi = readFileSync(path.join(scriptDir, '../src/components/FirstSetupNotice.tsx'), 'utf-8')
  eq(
    'FIRSTSETUP 警告色・全面の黒地を使っていない',
    /warning|bg-black|text-red|AlertTriangle/.test(fsUi),
    false,
  )
  eq(
    'FIRSTSETUP ✕・カード外のタップ・端末の戻る・「このまま使う」のどれで閉じても見た記録を残す',
    fsUi.includes('markFirstSetupNoticeSeen()') &&
      fsUi.includes('onClose={close}') &&
      fsUi.includes('onClick={close}'),
    true,
  )
  eq(
    'FIRSTSETUP 設定へのリンクを押した時点でも見た記録を残す(見た人に次回また出さない)',
    fsUi.includes('onClick={markFirstSetupNoticeSeen}'),
    true,
  )
  eq(
    'FIRSTSETUP 設定への行き先は「食数の設定」の欄(?section=household)',
    fsUi.includes("'/settings?section=household'"),
    true,
  )
  eq(
    'FIRSTSETUP 設定から今読んでいたレシピへ帰れる(?back=を載せている)',
    fsUi.includes('settingsLinkWithBack('),
    true,
  )
  // 1回のタップで両方の欄が視界に入ること＝設定画面で「食数の設定」の次が「台所の器具」であること。
  // 間に別の欄が挟まると、案内した2つのうち片方までしか届かない
  const fsSettingsSrc = readFileSync(path.join(scriptDir, '../src/pages/SettingsPage.tsx'), 'utf-8')
  eq(
    'FIRSTSETUP 設定の直リンク(?section=household)の着地点がある',
    /household:\s*'household-section'/.test(fsSettingsSrc) &&
      fsSettingsSrc.includes('id="household-section"'),
    true,
  )
  const fsHouseholdAt = fsSettingsSrc.indexOf('id="household-section"')
  const fsKitchenAt = fsSettingsSrc.indexOf('id="kitchen-section"')
  eq(
    'FIRSTSETUP 「食数の設定」のすぐ次が「台所の器具」になっている',
    fsHouseholdAt > 0 &&
      fsKitchenAt > fsHouseholdAt &&
      !/id="(?!kitchen-section)[a-z-]+-section"/.test(
        fsSettingsSrc.slice(fsHouseholdAt + 1, fsKitchenAt),
      ),
    true,
  )
  // 出す場所はレシピ詳細だけ(他の画面へ広げない)。docs/65 A-4の決定
  const fsDetailSrc = readFileSync(path.join(scriptDir, '../src/pages/RecipeDetailPage.tsx'), 'utf-8')
  eq('FIRSTSETUP レシピ詳細から呼んでいる', fsDetailSrc.includes('<FirstSetupNotice'), true)
  eq(
    'FIRSTSETUP 用事の有無は最初の描画時のクエリで見る(?step=・?editLog=は使い終わると消えるため)',
    fsDetailSrc.includes(
      "useRef(searchParams.has('step') || searchParams.has('editLog'))",
    ),
    true,
  )
  // 2026-08-17 便HG: HomePage.tsx はホーム画面の廃止で無くなったので外した
  for (const page of ['RecipesPage.tsx', 'MealPlanPage.tsx', 'CookNaviPage.tsx']) {
    eq(
      `FIRSTSETUP ${page} には出していない`,
      readFileSync(path.join(scriptDir, `../src/pages/${page}`), 'utf-8').includes(
        'FirstSetupNotice',
      ),
      false,
    )
  }
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

// ---------- 便FI: 色を言うとその品の手順に移る（docs/69 第3段） ----------
// オーナー要望「並行調理ナビ調理中モードの、色で手順入れ替えはいつ実装しますか？」。
// docs/69 では第3段（色で実行を引き寄せる）を「実機の要望が出るまでやらない」と保留にしていた。
// 実装にあたっての危ないところは2つで、どちらもここで固定する。
//   ①語彙 … 原文の「赤・青・緑」ではなく**画面の実物と同じ 青・緑・ピンク**を使う
//            （画面と語彙が食い違うと「赤と言ったのに青が動く」事故になる）
//   ②誤爆 … 「青ねぎを切る」「緑黄色野菜を加える」で手順が飛ばないこと。
//            そのため色は**判定順のいちばん最後**・**発話まるごとの一致**に限る
{
  // --- ① 画面に出す色名と、声で受ける語が同じところから来ている（ばらけない） ---
  eq('FI-COLOR 色の数と色名の数がそろっている', NAVI_COLOR_WORDS.length, NAVI_RECIPE_COLORS.length)
  eq('FI-COLOR 1品目は青', naviColorWord(0), '青')
  eq('FI-COLOR 2品目は緑', naviColorWord(1), '緑')
  eq('FI-COLOR 3品目はピンク（原文の「赤」ではなく画面の実物に合わせる）', naviColorWord(2), 'ピンク')
  eq('FI-COLOR 声の語形も色ごとに1組ずつある', NAVI_COLOR_SPEECH.length, NAVI_COLOR_WORDS.length)
  eq(
    'FI-COLOR 画面に出す色名は、そのまま言っても通る',
    NAVI_COLOR_WORDS.map((word, i) => NAVI_COLOR_SPEECH[i].includes(word)),
    [true, true, true],
  )
  eq('FI-COLOR 「赤」は語彙に入れない（画面に赤の品が無いため）', matchVoiceColor('赤'), undefined)
  eq('FI-COLOR 「あか」も入れない', matchVoiceColor('あか'), undefined)

  // --- ② 語形（端末が漢字・かな・カナのどれで返しても同じ品に当たる） ---
  eq('FI-VOICE 「青」', matchVoiceColor('青'), 0)
  eq('FI-VOICE 「あお」', matchVoiceColor('あお'), 0)
  eq('FI-VOICE 「アオ」', matchVoiceColor('アオ'), 0)
  eq('FI-VOICE 「青色」', matchVoiceColor('青色'), 0)
  eq('FI-VOICE 「緑」', matchVoiceColor('緑'), 1)
  eq('FI-VOICE 「みどり」', matchVoiceColor('みどり'), 1)
  eq('FI-VOICE 「ミドリ」', matchVoiceColor('ミドリ'), 1)
  eq('FI-VOICE 「緑色」', matchVoiceColor('緑色'), 1)
  eq('FI-VOICE 「ピンク」', matchVoiceColor('ピンク'), 2)
  eq('FI-VOICE 「ぴんく」', matchVoiceColor('ぴんく'), 2)
  eq('FI-VOICE 「ピンク色」', matchVoiceColor('ピンク色'), 2)
  eq('FI-VOICE 端末が付ける句点は落として比べる', matchVoiceColor('青。'), 0)
  eq('FI-VOICE 前後の空白も落として比べる', matchVoiceColor(' 緑 '), 1)
  eq('FI-VOICE 何も聞き取れていないときは当てない', matchVoiceColor(''), undefined)

  // --- ③ 誤爆させない（ここが第3段を保留にしていた理由。全体一致だけに限る） ---
  eq('FI-MISS 「青ねぎ」で手順を飛ばさない', matchVoiceColor('青ねぎ'), undefined)
  eq('FI-MISS 「青ねぎを切る」でも飛ばさない', matchVoiceColor('青ねぎを切る'), undefined)
  eq('FI-MISS 「青ねぎを散らす」でも飛ばさない', matchVoiceColor('青ねぎを散らす'), undefined)
  eq('FI-MISS 「青のり」でも飛ばさない', matchVoiceColor('青のり'), undefined)
  eq('FI-MISS 「緑黄色野菜」で飛ばさない', matchVoiceColor('緑黄色野菜'), undefined)
  eq('FI-MISS 「緑黄色野菜を加える」でも飛ばさない', matchVoiceColor('緑黄色野菜を加える'), undefined)
  eq('FI-MISS 「みどり色の野菜」でも飛ばさない', matchVoiceColor('みどり色の野菜'), undefined)
  eq('FI-MISS 「ピンクペッパーをふる」で飛ばさない', matchVoiceColor('ピンクペッパーをふる'), undefined)
  eq('FI-MISS 「ピンクサーモン」でも飛ばさない', matchVoiceColor('ピンクサーモン'), undefined)
  eq('FI-MISS 手順の読み上げのような長い発話では動かない', matchVoiceColor('青ねぎと緑の野菜を切る'), undefined)

  // --- ④ 判定順（色はいちばん最後）。色の語をコマンド側に混ぜない ---
  eq('FI-ORDER 「青」はコマンドとしては当たらない（色は別で最後に見る）', matchVoiceCommand('青'), undefined)
  eq('FI-ORDER 「みどり」も同じ（「もどって」と取り違えない）', matchVoiceCommand('みどり'), undefined)
  eq('FI-ORDER 「ピンク」も同じ', matchVoiceCommand('ピンク'), undefined)
  // 2026-08-15 オーナー指示で「次」を全体一致にしたため、複合は当たらない＝何も起きない。
  // 何も起きないほうが安全という判断（「ピンクの次へ」が「進む」なのか
  // 「ピンクの手順を開く」なのか、発話からは決められないため）
  eq('FI-ORDER 「ピンクの次へ」は複合なので当たらない', matchVoiceCommand('ピンクの次へ'), undefined)
  eq('FI-ORDER 「戻って」を含む発話も同じ', matchVoiceCommand('青に戻って'), 'prev')
  eq('FI-ORDER 「3分タイマー」は従来どおりタイマーのまま', matchVoiceCommand('3分タイマー'), 'timer')

  // --- ⑤ 行き先（下部にその色で出ている行と同じ手順に移る） ---
  const fiPlan = [
    { recipeId: 10, stepIndex: 0 }, //  0 青
    { recipeId: 20, stepIndex: -1 }, // 1 緑（ナビが足した湯沸かし）
    { recipeId: 20, stepIndex: 0 }, //  2 緑
    { recipeId: 10, stepIndex: 1 }, //  3 青
    { recipeId: 30, stepIndex: 0 }, //  4 ピンク
    { recipeId: 10, stepIndex: 2 }, //  5 青
  ]
  const fiRecipes = [
    { id: 10, title: 'FI肉じゃが', colorIndex: 0 },
    { id: 20, title: 'FIみそ汁', colorIndex: 1 },
    { id: 30, title: 'FIマリネ', colorIndex: 2 },
  ]
  const fiIds = fiRecipes.map((r) => r.id)
  const fiAt = (i) => ({ recipeId: fiPlan[i].recipeId, stepIndex: fiPlan[i].stepIndex })

  eq('FI-MOVE 青の手順から「緑」でその品の次の手順へ', resolveColorMove(fiPlan, fiAt(0), 1, fiRecipes), {
    kind: 'move',
    recipeId: 20,
    cursor: { recipeId: 20, stepIndex: -1 },
  })
  eq('FI-MOVE 「ピンク」でも同じように移れる', resolveColorMove(fiPlan, fiAt(0), 2, fiRecipes), {
    kind: 'move',
    recipeId: 30,
    cursor: { recipeId: 30, stepIndex: 0 },
  })
  eq(
    'FI-MOVE 進んだ先からは、その先にある手順に移る（後戻りはしない）',
    resolveColorMove(fiPlan, fiAt(2), 0, fiRecipes),
    { kind: 'move', recipeId: 10, cursor: { recipeId: 10, stepIndex: 1 } },
  )
  eq(
    'FI-MOVE いま大きく出している品の色は、動かさずに状態を返す',
    resolveColorMove(fiPlan, fiAt(0), 0, fiRecipes),
    { kind: 'current', recipeId: 10 },
  )
  eq(
    'FI-MOVE ナビが足した工程を開いていても、同じ品の色なら動かない',
    resolveColorMove(fiPlan, fiAt(1), 1, fiRecipes),
    { kind: 'current', recipeId: 20 },
  )
  eq(
    'FI-MOVE 残りの手順が無い品（下部に「完成」と出ている品）は、動かさずに完成を返す',
    resolveColorMove(fiPlan, fiAt(5), 1, fiRecipes),
    { kind: 'done', recipeId: 20 },
  )
  eq(
    'FI-MOVE 段取りに無い色（2品で組んでいるのに3色目）は、その旨を返す',
    resolveColorMove(fiPlan, fiAt(0), 2, fiRecipes.slice(0, 2)),
    { kind: 'none' },
  )
  eq(
    'FI-MOVE カーソルが段取りに無いときは行き先を決めない',
    resolveColorMove(fiPlan, { recipeId: 99, stepIndex: 0 }, 1, fiRecipes),
    { kind: 'none' },
  )
  eq(
    'FI-MOVE 覚えていない状態からも行き先を決めない',
    resolveColorMove(fiPlan, undefined, 1, fiRecipes),
    { kind: 'none' },
  )
  // **黙って何も起きない**を作らない。どの言い方でも必ず種類が返る（画面はこれを文言にする）
  eq(
    'FI-MOVE どの位置・どの色でも必ず結果の種類が返る（無反応にならない）',
    fiPlan.every((_, i) =>
      [0, 1, 2].every((color) =>
        ['move', 'current', 'done', 'none'].includes(
          resolveColorMove(fiPlan, fiAt(i), color, fiRecipes).kind,
        ),
      ),
    ),
    true,
  )
  // 行き先は「下部にその色で出ている行」と必ず同じ＝言う前に目で確かめられる
  eq(
    'FI-MOVE 行き先は、下部にその色で出ている行の手順と必ず一致する',
    fiPlan.every((_, i) => {
      const rows = nextStepsByRecipe(fiPlan, fiAt(i), fiIds)
      return fiRecipes.every((recipe) => {
        const result = resolveColorMove(fiPlan, fiAt(i), recipe.colorIndex, fiRecipes)
        const row = rows.find((r) => r.recipeId === recipe.id)
        if (!row) return result.kind === 'current' // 下部に出ないのは、いま開いている品だけ
        if (!row.item) return result.kind === 'done'
        return (
          result.kind === 'move' &&
          result.cursor.recipeId === row.item.recipeId &&
          result.cursor.stepIndex === row.item.stepIndex
        )
      })
    }),
    true,
  )

  // --- ⑥ 引き寄せ（並べ替え）。**カーソルだけ先へ飛ばすと手順が消えるので、そうしない** ---
  // 飛ばす形（カーソルを目的の手順へ動かすだけ）だと、間にある他の品の手順が
  // 「カーソルより前＝済んだ手順」に化ける。実機で確認すると、1度も作っていない品が
  // 「完成」と表示された。引き寄せる形なら手順は1つも消えない。
  const fiKey = (list) => list.map((x) => `${x.recipeId}:${x.stepIndex}`)
  /** 色を言ったときに実際に起きること（並べ替え＋カーソル移動）をまとめて再現する */
  const fiSay = (list, cursor, colorIndex) => {
    const result = resolveColorMove(list, cursor, colorIndex, fiRecipes)
    if (result.kind !== 'move') return { list, cursor, result }
    return {
      list: applyStepPulls(list, [{ before: cursor, target: result.cursor }]),
      cursor: result.cursor,
      result,
    }
  }

  const fiSaidGreen = fiSay(fiPlan, fiAt(0), 1)
  eq(
    'FI-PULL 言われた品の手順が、いま開いていた手順の直前に来る',
    fiKey(fiSaidGreen.list),
    ['20:-1', '10:0', '20:0', '10:1', '30:0', '10:2'],
  )
  eq('FI-PULL 手順の数は変わらない（1つも消えない）', fiSaidGreen.list.length, fiPlan.length)
  eq(
    'FI-PULL 開いていた手順は1つ後ろに残る＝「次へ」で戻れる',
    advanceCursor(fiSaidGreen.list, fiSaidGreen.cursor),
    fiAt(0),
  )
  eq(
    'FI-PULL 引き寄せた手順より前に、まだやっていない手順を作らない（先頭に来る）',
    findCursorIndex(fiSaidGreen.list, fiSaidGreen.cursor),
    0,
  )
  // 遠くの品を引き寄せても、間の手順は「済んだこと」にならない
  const fiSaidPink = fiSay(fiPlan, fiAt(0), 2)
  eq(
    'FI-PULL 離れた手順を引き寄せても、間の手順は後ろに残る',
    fiKey(fiSaidPink.list),
    ['30:0', '10:0', '20:-1', '20:0', '10:1', '10:2'],
  )
  eq(
    'FI-PULL 引き寄せたあとも、その品の残りは「完成」扱いにならない',
    nextStepsByRecipe(fiSaidPink.list, fiSaidPink.cursor, fiIds).every((row) => row.item != null),
    true,
  )
  // 各品の中の順番は絶対に入れ替わらない（先に切ってから煮る、が崩れない）
  const fiInOrder = (list) =>
    fiIds.every((id) => {
      const steps = list.filter((x) => x.recipeId === id).map((x) => x.stepIndex)
      return steps.every((v, i) => i === 0 || steps[i - 1] < v)
    })
  eq('FI-PULL その品の中の手順の順番は変わらない', fiInOrder(fiSaidGreen.list), true)
  eq('FI-PULL 離れた品を引き寄せても同じ', fiInOrder(fiSaidPink.list), true)
  // 続けて言い直しても壊れない
  const fiTwice = fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 2)
  eq('FI-PULL 続けて別の色を言っても手順は減らない', fiTwice.list.length, fiPlan.length)
  eq('FI-PULL 続けて言い直しても品の中の順番は保たれる', fiInOrder(fiTwice.list), true)
  eq(
    'FI-PULL 続けて言い直すと、いちばん新しく言った品が先頭に来る',
    fiKey(fiTwice.list)[0],
    '30:0',
  )
  eq(
    'FI-PULL 直前に引き寄せた手順は、そのすぐ後ろに残る',
    advanceCursor(fiTwice.list, fiTwice.cursor),
    fiAt(1),
  )
  // 並べ替えは保存しないので、組み直した段取りに毎回当て直す。当てられない1件は飛ばす
  eq(
    'FI-PULL 引き寄せが1つも無ければ、組み直した段取りをそのまま使う',
    applyStepPulls(fiPlan, []),
    fiPlan,
  )
  eq(
    'FI-PULL 手順が消えていた引き寄せは飛ばす（段取りは壊さない）',
    fiKey(applyStepPulls(fiPlan, [{ before: fiAt(0), target: { recipeId: 40, stepIndex: 0 } }])),
    fiKey(fiPlan),
  )
  eq(
    'FI-PULL 差し込み先が消えていた引き寄せも飛ばす',
    fiKey(applyStepPulls(fiPlan, [{ before: { recipeId: 40, stepIndex: 0 }, target: fiAt(4) }])),
    fiKey(fiPlan),
  )
  eq(
    'FI-PULL 同じ引き寄せを2回当てても結果は変わらない（毎回当て直しても同じ画面）',
    fiKey(applyStepPulls(fiPlan, [
      { before: fiAt(0), target: fiAt(1) },
      { before: fiAt(0), target: fiAt(1) },
    ])),
    fiKey(fiSaidGreen.list),
  )

  // --- ⑦ 可逆（docs/69「音声は可逆操作のみ」） ---
  eq(
    'FI-BACK 別の色を言えば移り直せる（言い間違えても言い直しで済む）',
    fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 2).result,
    { kind: 'move', recipeId: 30, cursor: { recipeId: 30, stepIndex: 0 } },
  )
  eq(
    'FI-BACK 同じ色をもう一度言っても二重には動かない',
    fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 1).result,
    { kind: 'current', recipeId: 20 },
  )
  eq(
    'FI-BACK 「手順①へ」で必ず段取りの先頭に戻れる（色で並べ替えたあとも）',
    startCursor(fiSaidGreen.list),
    { recipeId: 20, stepIndex: -1 },
  )
  // --- ⑧ 覚え書き（2026-08-10 司令部裁定「引き寄せを保存する」）。
  // 保存するのは**ユーザーが出した指示**だけで、段取りは今までどおり毎回組み直す。
  // 保存しないと、読み込み直したときに並びだけ元へ戻り、作っていない品が「完成」と出る。
  const fiSaved = (session) => parseCookNaviSession(JSON.stringify(session))
  const fiBase = { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: fiAt(0) }
  eq(
    'FI-SAVE 引き寄せの指示を保存して読み戻せる',
    fiSaved({ ...fiBase, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    [{ before: fiAt(0), target: fiAt(1) }],
  )
  eq(
    'FI-SAVE 読み戻した指示を当て直すと、同じ並びになる（往復して壊れない）',
    fiKey(applyStepPulls(fiPlan, fiSaved({ ...fiBase, pulls: [{ before: fiAt(0), target: fiAt(1) }] }).pulls)),
    fiKey(fiSaidGreen.list),
  )
  eq(
    'FI-SAVE 保存された順は変えない（順番が変わると当て直した結果が変わる）',
    fiSaved({
      ...fiBase,
      pulls: [
        { before: fiAt(0), target: fiAt(4) },
        { before: fiAt(4), target: fiAt(1) },
      ],
    })?.pulls,
    [
      { before: fiAt(0), target: fiAt(4) },
      { before: fiAt(4), target: fiAt(1) },
    ],
  )
  eq(
    'FI-SAVE 形の壊れた1件だけを捨てて、残りは当て直す（推測で近い場所に当てない）',
    fiSaved({
      ...fiBase,
      pulls: [
        { before: fiAt(0), target: null },
        { target: fiAt(1) },
        'こわれ',
        { before: fiAt(0), target: fiAt(4) },
      ],
    })?.pulls,
    [{ before: fiAt(0), target: fiAt(4) }],
  )
  // 後方互換: この項目が無い（便FIより前の）覚え書きも今までどおり読める
  eq(
    'FI-SAVE 引き寄せを知らない古い覚え書きも読める（並べ替え無しとして扱う）',
    fiSaved(fiBase)?.pulls,
    undefined,
  )
  eq(
    'FI-SAVE 古い覚え書きの選択・表示・調理中の手順は今までどおり読める',
    { ...fiSaved(fiBase), pulls: undefined },
    { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: fiAt(0), pulls: undefined },
  )
  eq(
    'FI-SAVE 引き寄せが1件も無ければ項目そのものを持たない（覚え書きを太らせない）',
    fiSaved({ ...fiBase, pulls: [] })?.pulls,
    undefined,
  )
  eq(
    'FI-SAVE 段取りを表示していない覚え書きの並べ替えは読まない（調理中の手順と同じ扱い）',
    fiSaved({ selectedIds: [10, 20], showTimeline: false, trialActive: false, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    undefined,
  )
  // 2026-08-14 便GJ で線を1本だけ動かした。段取りの一覧から手で並べ替えられるようになり、
  // **調理中モードを開かずに並べ替える**のが普通の使い方になったため、
  // 並べ替えは「調理中の位置があるか」ではなく「段取りが出ているか」で読む。
  // 便FI の時点では並べ替えの手立てが調理中モードの中にしか無かったので、どちらでも同じだった
  eq(
    'GJ-SAVE 調理中の手順を覚えていなくても、段取りが出ていれば並べ替えは読む',
    fiSaved({ selectedIds: [10, 20], showTimeline: true, trialActive: false, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    [{ before: fiAt(0), target: fiAt(1) }],
  )
  eq(
    'FI-SAVE 並べ替えが配列でない壊れた覚え書きでも、他の項目は読める',
    fiSaved({ ...fiBase, pulls: 'こわれ' })?.current,
    fiAt(0),
  )

  eq(
    'FI-BACK 引き寄せたあとも「次へ→戻って」で元の手順に帰る',
    fiSaidGreen.list.every((_, i) => {
      if (i >= fiSaidGreen.list.length - 1) return true
      const at = { recipeId: fiSaidGreen.list[i].recipeId, stepIndex: fiSaidGreen.list[i].stepIndex }
      return JSON.stringify(backCursor(fiSaidGreen.list, advanceCursor(fiSaidGreen.list, at))) ===
        JSON.stringify(at)
    }),
    true,
  )
}

// ---------- 便GJ: 段取りを手で並べ替える(2026-08-14・docs/71 R3/R4) ----------
// R3「段取りを手で並べ替える手段がない。上下ボタンもドラッグもなし。出てきた順番が
//     気に入らなくても直せません。」
// R4「順番の入れ替えも…できません。前後させると番号が合わなくなり、調理中モードは元の順で
//     進みます。」
//
// 動かす指示は**色で先にしたときと同じ `pulls` 1件**で表す（覚え書きの項目を増やさない＝
// docs/69「書ける状態は cookNaviSession ＋ current ＋ pulls だけ」）。
{
  const gjPlan = [
    { recipeId: 10, stepIndex: 0 }, // 0
    { recipeId: 20, stepIndex: 0 }, // 1
    { recipeId: 10, stepIndex: 1 }, // 2
    { recipeId: 30, stepIndex: 0 }, // 3
  ]
  const gjKey = (list) => list.map((x) => `${x.recipeId}:${x.stepIndex}`)
  const gjMove = (list, index, dir) => {
    const pull = dir === 'up' ? moveStepUpPull(list, index) : moveStepDownPull(list, index)
    return pull ? applyStepPulls(list, [pull]) : list
  }

  // --- ① 1つずつ動かせる ---
  eq('GJ-MOVE 手順を1つ上へ動かせる', gjKey(gjMove(gjPlan, 2, 'up')), [
    '10:0',
    '10:1',
    '20:0',
    '30:0',
  ])
  eq('GJ-MOVE 手順を1つ下へ動かせる', gjKey(gjMove(gjPlan, 1, 'down')), [
    '10:0',
    '10:1',
    '20:0',
    '30:0',
  ])
  eq('GJ-MOVE いちばん上の手順は上へ動かせない', moveStepUpPull(gjPlan, 0), undefined)
  eq(
    'GJ-MOVE いちばん下の手順は下へ動かせない',
    moveStepDownPull(gjPlan, gjPlan.length - 1),
    undefined,
  )
  eq('GJ-MOVE 段取りの外を指しても指示を作らない', moveStepUpPull(gjPlan, 99), undefined)
  eq('GJ-MOVE 手順の数は動かしても変わらない（1つも消えない）', gjMove(gjPlan, 3, 'up').length, 4)
  // 上下は同じ動きの裏表＝押しすぎても同じ数だけ押し返せば戻る（規約F「元に戻せる」）
  eq(
    'GJ-MOVE 上へと下へは同じ動きの裏表（i を上へ ＝ i-1 を下へ）',
    gjKey(gjMove(gjPlan, 2, 'up')),
    gjKey(gjMove(gjPlan, 1, 'down')),
  )
  eq(
    'GJ-MOVE 上へ→下へで元の並びに戻る',
    gjKey(gjMove(gjMove(gjPlan, 2, 'up'), 1, 'down')),
    gjKey(gjPlan),
  )
  eq(
    'GJ-MOVE いちばん下の手順を上へ動かしても壊れない',
    gjKey(gjMove(gjPlan, 3, 'up')),
    ['10:0', '20:0', '30:0', '10:1'],
  )
  // 覚えるのは指示だけ＝読み込み直して当て直しても同じ並びになる
  // 指示は**その場に出ている並び**から作る（画面と同じ）。並べて当て直すと同じ結果になる
  {
    const first = moveStepUpPull(gjPlan, 2)
    const afterFirst = applyStepPulls(gjPlan, [first])
    const second = moveStepDownPull(afterFirst, 0)
    eq(
      'GJ-SAVE 覚えた指示を組み直した段取りへ当て直すと、同じ並びになる',
      gjKey(applyStepPulls(gjPlan, [first, second])),
      gjKey(applyStepPulls(afterFirst, [second])),
    )
    eq(
      'GJ-SAVE 2回動かした結果（読み込み直しても同じ並びに戻る）',
      gjKey(applyStepPulls(gjPlan, [first, second])),
      ['10:1', '10:0', '20:0', '30:0'],
    )
  }
  eq(
    'GJ-SAVE 手順が消えていた指示は飛ばす（推測で近い場所に当てない）',
    gjKey(applyStepPulls(gjPlan, [{ before: { recipeId: 99, stepIndex: 0 }, target: gjPlan[1] }])),
    gjKey(gjPlan),
  )

  // --- ② 動かした結果が「うちの台所では無理」になったとき ---
  // 止めない。**印を出すだけ**（司令部の判断）。自動で組んだ並びを同じやり方で数えた結果を
  // 引き算するので、並びを変えていなければ印は1つも出ない。
  const gjRecipe = (id, title, steps) => ({
    id,
    title,
    steps: steps.map((s) => (typeof s === 'string' ? { text: s } : s)),
  })
  const gjKitchen = (burners) => ({ burners, microwave: true, grill: true, toaster: true })
  const gjRecipes = [
    gjRecipe(1, 'GJ煮物', ['大根を一口大に切る。', '鍋に大根とだしを入れて中火で12分煮る。', '器に盛る。']),
    gjRecipe(2, 'GJ炒めもの', ['にんじんを細切りにする。', 'フライパンで豚肉を炒める。', '器に盛る。']),
  ]
  const gjBase = buildCookPlan(gjRecipes, gjKitchen(2))
  eq(
    'GJ-WARN 並びを変えていなければ印は1つも出ない（自動の段取りの見え方は変わらない）',
    reorderIssues(gjBase.items, gjBase.items, gjKitchen(2)).length,
    0,
  )
  eq(
    'GJ-WARN コンロ1口でも、自動で組んだ並びには印を出さない',
    reorderIssues(
      buildCookPlan(gjRecipes, gjKitchen(1)).items,
      buildCookPlan(gjRecipes, gjKitchen(1)).items,
      gjKitchen(1),
    ).length,
    0,
  )
  // その品の中の順番を逆にすると、必ず印が出る（見積りではなく確かめられる事実）
  const gjSameRecipeIndexes = gjBase.items
    .map((item, index) => ({ item, index }))
    .filter((x) => x.item.recipeId === 1)
  const gjSwapped = applyStepPulls(gjBase.items, [
    { before: gjSameRecipeIndexes[0].item, target: gjSameRecipeIndexes[1].item },
  ])
  const gjSwapIssues = reorderIssues(gjBase.items, gjSwapped, gjKitchen(2))
  eq(
    'GJ-WARN その品の手順をレシピの順より前に出すと印が出る',
    gjSwapIssues.some((i) => i.kind === 'recipeOrder'),
    true,
  )
  eq(
    'GJ-WARN 印が付くのは、前に出したその手順',
    gjSwapIssues.find((i) => i.kind === 'recipeOrder')?.stepIndex,
    gjSameRecipeIndexes[1].item.stepIndex,
  )
  eq(
    'GJ-WARN 動かしても手順は1つも消えない（印を出すだけで段取りは壊さない）',
    gjSwapped.length,
    gjBase.items.length,
  )
  // コンロ1口の家で、煮込みの待ちの中へ別の品の炒めものを入れると口が足りない
  {
    const one = buildCookPlan(gjRecipes, gjKitchen(1))
    const simmer = one.items.findIndex((x) => x.recipeId === 1 && x.kind === 'wait')
    const fry = one.items.findIndex((x) => x.recipeId === 2 && /炒め/.test(x.text))
    if (simmer >= 0 && fry > simmer) {
      const moved = applyStepPulls(one.items, [
        { before: one.items[simmer + 1], target: one.items[fry] },
      ])
      const issues = reorderIssues(one.items, moved, gjKitchen(1))
      eq(
        'GJ-WARN 1口の家で、煮込みの待ちの中へ別の品の炒めものを入れると印が出る',
        issues.some((i) => i.kind === 'appliance' && i.appliance === 'stove'),
        true,
      )
      eq(
        'GJ-WARN 同じ並びを2口で見ると、その印は出ない（設定した台数で判断している）',
        reorderIssues(one.items, moved, gjKitchen(2)).some((i) => i.kind === 'appliance'),
        false,
      )
    }
  }
  // 印は手順ごとにまとめて引ける（画面はこの表を引くだけ）
  eq(
    'GJ-WARN 印は手順ごとにまとめて引ける',
    reorderIssuesByStep(gjSwapIssues).get(reorderStepKey(gjSameRecipeIndexes[1].item))?.length >= 1,
    true,
  )
  eq('GJ-WARN 印が無い段取りの表は空', reorderIssuesByStep([]).size, 0)
}

// ---------- 便FF-2/3/4: レシピタブの絞り込みの作り直し(2026-08-10 オーナー指示) ----------
{
  // (1) タグのチップに出す件数。並びの規則(件数の多い順・同数は五十音順)を数字で示す
  const withTags = (tags) => ({ tags })
  const ffTagRecipes = [
    withTags(['和食', '作り置き']),
    withTags(['和食']),
    withTags(['和食', 'お弁当']),
    withTags(['作り置き']),
    withTags([]),
  ]
  eq('FF-TAG チップは件数つきで多い順に返る', tagUsageCounts(ffTagRecipes, 3), [
    { tag: '和食', count: 3 },
    { tag: '作り置き', count: 2 },
    { tag: 'お弁当', count: 1 },
  ])
  eq('FF-TAG limitで打ち切る', tagUsageCounts(ffTagRecipes, 1), [{ tag: '和食', count: 3 }])
  eq('FF-TAG タグが無ければ空', tagUsageCounts([withTags([])], 6), [])
  eq(
    'FF-TAG 名前だけを返す従来の関数と並びが一致する(献立のレシピ選択が使う)',
    topTagsByUsage(ffTagRecipes, 3),
    tagUsageCounts(ffTagRecipes, 3).map((t) => t.tag),
  )

  // (2) 料理の種別での絞り込み。主菜/副菜はタグではなくレシピの項目(dishType)で、
  //     未設定のレシピは推定に倒す(=4区分で全レシピをちょうど覆う)
  const ffBase = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    dishType: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ffDish = (id, title, dishType, ingredients = []) => ({
    id,
    title,
    tags: [],
    searchWords: [],
    ingredients: ingredients.map((name) => ({ name })),
    cookedLogs: [],
    dishType,
  })
  const ffRecipes = [
    ffDish(1, '鶏の照り焼き', 'main'),
    ffDish(2, 'ほうれん草のおひたし', 'side'),
    ffDish(3, 'わかめのみそ汁', 'soup'),
    ffDish(4, '大学芋', 'dessert'),
    // dishType 未設定＝推定に倒す(材料の豚肉から主菜)
    ffDish(5, '肉じゃが', undefined, ['豚肉', 'じゃがいも']),
  ]
  // 2026-08-19 便HU・⑬: 1つだけ選ぶ形から複数選べる形（dishTypes）に変えた
  const ffIds = (dishTypes) =>
    searchRecipes(ffRecipes, { ...ffBase, dishTypes }).map((r) => r.recipe.id)
  eq('FF-DISH 何も選んでいなければ絞らない', ffIds([]), [1, 2, 3, 4, 5])
  eq('FF-DISH 主菜(未設定は推定で主菜に入る)', ffIds(['main']), [1, 5])
  eq('FF-DISH 副菜', ffIds(['side']), [2])
  eq('FF-DISH 汁物', ffIds(['soup']), [3])
  eq('FF-DISH その他', ffIds(['dessert']), [4])
  eq(
    'FF-DISH 4区分を合わせると全件になる(取りこぼしが出ない)',
    ffIds(['main', 'side', 'soup', 'dessert']),
    [1, 2, 3, 4, 5],
  )
  eq(
    'FF-DISH 項目を渡さない呼び出し側は従来どおり絞らない(献立のレシピ選択・テンプレ画面)',
    searchRecipes(ffRecipes, { ...ffBase, dishTypes: undefined }).map((r) => r.recipe.id),
    [1, 2, 3, 4, 5],
  )
  eq(
    'FF-DISH 他の絞り込みと重ねられる',
    searchRecipes(ffRecipes, { ...ffBase, dishTypes: ['main'], query: '照り焼き' }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
}

// ---------- 便FF-1: 「作った！」で食数を記録する(2026-08-10 オーナー指示) ----------
{
  // 記録する食数の決まり方＝買い物メモ・概算食費とまったく同じ優先順位。
  // ①枠に決めた食数 ②設定「食数の設定」の人数 ③レシピの登録人数分
  eq('FF-COOKSV 枠に決めた食数が最優先', effectiveMealServings(3, 4, 2), 3)
  eq('FF-COOKSV 枠に無ければ設定の人数', effectiveMealServings(undefined, 4, 2), 4)
  eq(
    'FF-COOKSV どちらも無ければレシピの登録人数分',
    effectiveMealServings(undefined, undefined, 2),
    2,
  )
  eq('FF-COOKSV 全部無ければ1人分', effectiveMealServings(undefined, undefined, undefined), 1)
  eq('FF-COOKSV 範囲外の食数は1〜20に収める', effectiveMealServings(99, undefined, 2), 20)

  // ボタン1回の記録の見分け方。**食数を判定材料にしない**のが要点で、
  // 入れてしまうと便FF以降の記録が「元に戻す」で取り消せず、
  // 同じ日に何度でも二重に付く(便EHで直したバグの再発)。
  const today = '2026-08-10'
  eq(
    'FF-ONETAP 食数だけ入った記録はボタン1回の記録として扱う',
    isOneTapCookedLog({ date: today, servings: 4 }, today),
    true,
  )
  eq(
    'FF-ONETAP 食数も無い古い記録も従来どおり対象',
    isOneTapCookedLog({ date: today }, today),
    true,
  )
  eq(
    'FF-ONETAP メモを書いた記録は対象外(手で書いた記録を巻き込まない)',
    isOneTapCookedLog({ date: today, servings: 4, note: '子どもが完食' }, today),
    false,
  )
  eq(
    'FF-ONETAP 写真を付けた記録は対象外',
    isOneTapCookedLog({ date: today, servings: 4, photo: {} }, today),
    false,
  )
  eq(
    'FF-ONETAP 別の日の記録は対象外',
    isOneTapCookedLog({ date: '2026-08-09', servings: 4 }, today),
    false,
  )
}

// ---------- 2026-08-11 便FM・レシピ本体のメモが並行調理ナビに1行も出ていなかった ----------
// 再発防止: レシピ詳細では出ている recipe.memo が、段取り(CookNaviPage)にも
// 調理中モード(CookSessionOverlay)にも描かれていなかった(両画面が出していたのは
// 手順ごとの item.memo だけ)。同梱109品のうち94品が本体のメモを持ち、その多くが
// 交差汚染・火通し・保存の行で、複数の品を同時に進める並行調理でこそ要るもの。
{
  /** レシピ定義から、割り当ての入力になる手順の並びを作る(ナビ追加工程なしの素の並び) */
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const byTitle = (title) => starterDefs.find((d) => d.title === title)
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)

  // ---- (1) 行の種類の見分け ----
  eq(
    'FM 交差汚染の行は raw(保存の語と同居していても洗う話を優先する)',
    classifyRecipeNote(
      '生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。冷蔵庫で1〜2日ほどで食べ切ること。',
    ),
    'raw',
  )
  eq(
    'FM 火通しの行は heat',
    classifyRecipeNote('卵は半熟で仕上げるので、お子様・高齢者・妊娠中の方や体調に不安があるときは、完全に火を通すこと。'),
    'heat',
  )
  eq('FM 保存の行は keep', classifyRecipeNote('・冷蔵で2〜3日を目安に食べ切ること。'), 'keep')
  eq('FM どれでもない行は other', classifyRecipeNote('・お好みのきのこで作ってよい(しいたけ・マッシュルームなど)。'), 'other')

  // ---- (2) 親子丼(オーナー報告の実データ)。洗う行は鶏肉を切る手順、半熟の行は卵の手順 ----
  const oyako = byTitle('親子丼')
  eq('FM 親子丼が同梱カタログにある', oyako != null, true)
  const oyakoSteps = noteSteps(1, oyako)
  const oyakoNotes = assignRecipeNotes(oyakoSteps, new Map([[1, oyako]]))
  // 手順1には交差汚染の行と、2026-08-11 便FQで足したご飯の用意の行(other)が並ぶ
  const OYAKO_RICE = '・ご飯を炊く時間は調理時間に含んでいない。卵をとじたら熱いうちに盛り付けるので、2杯分を先に炊いておくこと。'
  const OYAKO_WASH = '・生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。'
  eq(
    'FM 交差汚染の行は「鶏肉は一口大」の手順(手順1)に出る',
    notesAt(oyakoNotes, 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )
  eq(
    'FM 火通しの行は卵を入れる手順(手順3)に出る',
    notesAt(oyakoNotes, 1, 2),
    ['・卵は半熟で仕上げるので、お子様・高齢者・妊娠中の方や体調に不安があるときは、完全に火を通すこと。'],
  )
  eq('FM 関係のない手順には出さない(手順2)', notesAt(oyakoNotes, 1, 1), [])
  eq('FM 関係のない手順には出さない(手順4)', notesAt(oyakoNotes, 1, 3), [])

  // ---- (3) 段取りの並び替え(色で引き寄せ)や他の品との混在で割り当てが動かない ----
  const hourensou = byTitle('ほうれん草のおひたし')
  const mixed = [...noteSteps(2, hourensou), ...oyakoSteps]
  const mixedNotes = assignRecipeNotes(mixed, new Map([[1, oyako], [2, hourensou]]))
  eq(
    'FM 他の品と混ざった段取りでも同じ手順に付く',
    notesAt(mixedNotes, 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )
  eq(
    'FM 保存の行はその品の最後の手順に出る',
    notesAt(mixedNotes, 2, hourensou.steps.length - 1).length,
    2,
  )
  eq(
    'FM 並びを逆にしても割り当ては変わらない(色で引き寄せても動かない)',
    notesAt(assignRecipeNotes([...mixed].reverse(), new Map([[1, oyako], [2, hourensou]])), 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )

  // ---- (4) ユーザーが自分で登録したレシピでも壊れない ----
  const ownSteps = [
    { recipeId: 9, stepIndex: 0, addedByNavi: false, text: '野菜を切る。' },
    { recipeId: 9, stepIndex: 1, addedByNavi: false, text: '炒めて盛る。' },
  ]
  eq(
    'FM メモが無いレシピには何も出さない',
    assignRecipeNotes(ownSteps, new Map([[9, { ingredients: [] }]])).size,
    0,
  )
  eq(
    'FM メモが空文字のレシピにも何も出さない',
    assignRecipeNotes(ownSteps, new Map([[9, { memo: '\n  \n', ingredients: [] }]])).size,
    0,
  )
  eq(
    'FM 安全の語が無い自作メモは、その品の最初の手順に出す',
    notesAt(
      assignRecipeNotes(ownSteps, new Map([[9, { memo: '母から教わった味。', ingredients: [] }]])),
      9,
      0,
    ),
    ['母から教わった味。'],
  )
  eq(
    'FM 段取りに無いレシピのメモは出さない',
    assignRecipeNotes(ownSteps, new Map([[8, { memo: '冷蔵で2日。', ingredients: [] }]])).size,
    0,
  )

  // ---- (5) ナビが段取りに足した工程(湯を沸かす)には付けない ----
  const withAdded = [
    { recipeId: 3, stepIndex: -1, addedByNavi: true, text: '湯を沸かす' },
    { recipeId: 3, stepIndex: 0, addedByNavi: false, text: '鶏肉を一口大に切る。' },
    { recipeId: 3, stepIndex: 1, addedByNavi: false, text: '10分ゆでて器に盛る。' },
  ]
  const addedNotes = assignRecipeNotes(
    withAdded,
    new Map([
      [
        3,
        {
          memo: '生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。',
          ingredients: [{ name: '鶏もも肉' }],
        },
      ],
    ]),
  )
  eq('FM ナビが足した工程には割り当てない', addedNotes.has('3--1'), false)
  eq('FM 鶏肉を切る手順に割り当てる', notesAt(addedNotes, 3, 0).length, 1)

  // ---- (6) 同梱109品の全数検査。1行も落とさず、同じ行を2か所に出さない ----
  let checkedRecipes = 0
  let lostLines = 0
  let duplicatedLines = 0
  let outOfRange = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo)
    if (lines.length === 0) continue
    checkedRecipes++
    const steps = noteSteps(7, def)
    const map = assignRecipeNotes(steps, new Map([[7, def]]))
    const placed = []
    for (const [key, notes] of map) {
      if (!steps.some((s) => recipeNoteStepKey(s) === key)) outOfRange++
      for (const note of notes) placed.push(note.text)
    }
    for (const line of lines) {
      const count = placed.filter((t) => t === line).length
      if (count === 0) lostLines++
      if (count > 1) duplicatedLines++
    }
    if (placed.length !== lines.length) duplicatedLines++
  }
  // 96品＝便FM時点の94品＋便FQでメモを新設した2品(ツナキャベツ丼・牛丼)
  eq('FM 本体のメモを持つ同梱レシピは96品', checkedRecipes, 96)
  eq('FM 1行も落とさない', lostLines, 0)
  eq('FM 同じ行を2か所に出さない', duplicatedLines, 0)
  eq('FM 割り当て先はその品の手順だけ', outOfRange, 0)

  // ---- (7) 交差汚染の行が「生の肉を触る手順」に付く(材料名と綴りが違う書き方でも) ----
  const curry = byTitle('カレーライス')
  const curryNotes = assignRecipeNotes(noteSteps(4, curry), new Map([[4, curry]]))
  const curryIndex = curry.steps.findIndex((_, i) =>
    notesAt(curryNotes, 4, i).some((t) => t.includes('洗うこと')),
  )
  eq(
    'FM 「生の肉」(材料名は豚こま切れ肉)でも、肉を扱う手順に付く',
    curry.steps[curryIndex].text.includes('肉'),
    true,
  )
  const tara = byTitle('たらの香味レンジ蒸し')
  const taraNotes = assignRecipeNotes(noteSteps(5, tara), new Map([[5, tara]]))
  eq(
    'FM 「生の魚」(材料名は生だら)でも、たらを扱う最初の手順に付く',
    notesAt(taraNotes, 5, 0).length,
    1,
  )
}

// ---------- 2026-08-11 便FQ・ご飯を材料に持つのに、用意する手順が無い品の注意書き ----------
// 発見: テキストペルソナ3体が独立に「ご飯を炊く工程が段取りに無い」と指摘。調べると
// 9品が「ご飯を材料に持つのに、炊く・温める手順が無い」状態で、段取りの所要時間にも
// 入らないため「約21分」で作れるつもりが炊飯を忘れると成立しない。
// オーナー裁定=A案(手順は増やさず、レシピの注意書きに1行足す)。手順数も分数も変えない。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  /** ご飯を炊く時間が調理時間に入っていないことを断る行の見分け方 */
  const isRiceNote = (line) => /ご飯を炊く時間は調理時間に含んでいない。/.test(line)

  // 対象9品(材料にご飯があり、炊く・温める手順が無い品)
  const RICE_DISHES = [
    'カレーライス', 'ツナキャベツ丼', '親子丼', 'チャーハン', '牛丼',
    '鶏そぼろ丼', 'オムライス', '肉巻きおにぎり', '冷や汁',
  ]
  for (const title of RICE_DISHES) {
    const def = starterDefs.find((d) => d.title === title)
    eq(`FQ ${title}が同梱カタログにある`, def != null, true)
    if (!def) continue
    const lines = splitRecipeNoteLines(def.memo)
    const riceLines = lines.filter(isRiceNote)
    eq(`FQ ${title}の注意書きにご飯の用意の行が1行だけある`, riceLines.length, 1)
    // 注意書きなので、手順の本文・分数・手順数は一切変えない(A案の条件)
    eq(
      `FQ ${title}の手順にご飯を炊く工程は足していない`,
      def.steps.some((s) => /炊/.test(s.text)),
      false,
    )
    // 「炊く時間」を書くだけで機種依存の分数は書かない(炊飯器の時間は機種で違う)
    eq(
      `FQ ${title}のご飯の行に炊飯の分数を書かない`,
      /\d+\s*分/.test(riceLines[0] ?? ''),
      false,
    )
    // 段取り・調理中モードでは「その品の最初の手順」に出る(作り始めに読める位置)
    const map = assignRecipeNotes(noteSteps(11, def), new Map([[11, def]]))
    eq(`FQ ${title}のご飯の行は段取りの最初の手順に出る`, notesAt(map, 11, 0).some(isRiceNote), true)
    eq(
      `FQ ${title}のご飯の行は最初の手順以外には出ない`,
      def.steps.slice(1).some((_, i) => notesAt(map, 11, i + 1).some(isRiceNote)),
      false,
    )
  }
  // 品ごとに書き分ける(同じ一文を9品に貼らない)。ご飯の状態・量が品によって違うため
  const riceTexts = RICE_DISHES.map((title) => {
    const def = starterDefs.find((d) => d.title === title)
    return splitRecipeNoteLines(def?.memo).find(isRiceNote) ?? ''
  })
  eq('FQ 9品のご飯の行はすべて別の文言', new Set(riceTexts).size, 9)
  // 掃引の固定: ご飯を材料に持つ品は10品で、炊く手順があるのは五目炊き込みご飯だけ
  const riceIngredientDishes = starterDefs.filter((d) =>
    d.ingredients.some((i) => /^(ご飯|米)/.test(i.name)),
  )
  eq('FQ ご飯・米を材料に持つ同梱レシピは10品', riceIngredientDishes.length, 10)
  eq(
    'FQ そのうち炊く手順を持つのは五目炊き込みご飯だけ',
    riceIngredientDishes.filter((d) => d.steps.some((s) => /炊/.test(s.text))).map((d) => d.title),
    ['五目炊き込みご飯'],
  )
}

// ---------- 2026-08-12 便FR・材料の選び方の行が、段取りの最後に寄っていた ----------
// 利用者テスト「チャーハンの『ご飯は炊きたてか冷蔵保存のものを使い、常温に長く置いたご飯は
// 使わないこと。』が段取りの最後（完成の手順）に出る」。「冷蔵」「常温」に反応して保存の行と
// 判定されていたが、中身は**どのご飯を使うか**＝作り始める前の話なので最初の手順に出す。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  const CHAHAN_PICK = '・ご飯は炊きたてか冷蔵保存のものを使い、常温に長く置いたご飯は使わないこと。'

  // ---- (1) 行の見分け ----
  eq('FR-NOTE 材料の選び方の行は pick(保存の語が入っていても保存にしない)', classifyRecipeNote(CHAHAN_PICK), 'pick')
  eq('FR-NOTE 「使わない」だけでも材料の選び方と読む', classifyRecipeNote('しなびた野菜は使わないこと。'), 'pick')
  eq('FR-NOTE 「〜のものを使う」も材料の選び方', classifyRecipeNote('豆腐は木綿のものを使うとよい。'), 'pick')
  // 保存・交差汚染の行を横取りしない（同梱レシピに実在する言い回しで固定する）
  eq(
    'FR-NOTE 「使い切る」は材料の選び方ではない(保存のまま)',
    classifyRecipeNote('冷蔵庫で保存する場合は2〜3日を目安に使い切ること。'),
    'keep',
  )
  eq(
    'FR-NOTE 「使い捨て手袋」は材料の選び方ではない(交差汚染のまま)',
    classifyRecipeNote('・手に傷があるときは、使い捨て手袋であえると安心。'),
    'raw',
  )
  eq(
    'FR-NOTE 「◯◯を使い〜のため」の保存の行は保存のまま',
    classifyRecipeNote(
      '・生野菜や豆腐を使い冷たいまま食べる汁物のため、食べる直前まで冷蔵庫でよく冷やしておき、作った日のうちに食べ切ること。',
    ),
    'keep',
  )
  eq(
    'FR-NOTE 「◯◯を使っているので」の保存の行も保存のまま',
    classifyRecipeNote(
      '・冷蔵庫で1〜2日を目安に食べ切ること。牛乳を使っているので、粗熱が取れたら小分けにして早めに冷蔵庫へ入れること。',
    ),
    'keep',
  )

  // ---- (2) チャーハンの実データ。最初の手順に出て、最後の手順には出ない ----
  const chahan = starterDefs.find((d) => d.title === 'チャーハン')
  eq('FR-NOTE チャーハンが同梱カタログにある', chahan != null, true)
  const chahanNotes = assignRecipeNotes(noteSteps(12, chahan), new Map([[12, chahan]]))
  eq(
    'FR-NOTE ご飯の選び方の行は最初の手順に出る',
    notesAt(chahanNotes, 12, 0).includes(CHAHAN_PICK),
    true,
  )
  eq(
    'FR-NOTE 完成の手順には出ない(以前はここに出ていた)',
    notesAt(chahanNotes, 12, chahan.steps.length - 1).includes(CHAHAN_PICK),
    false,
  )
  // 便FQで足した「ご飯を炊く時間は…」と並び、メモに書かれた順のまま出る
  eq('FR-NOTE 最初の手順にはメモの順で2行が並ぶ', notesAt(chahanNotes, 12, 0), [
    '・ご飯を炊く時間は調理時間に含んでいない。炒め始めるまでに2杯分を用意しておくこと。',
    CHAHAN_PICK,
  ])

  // ---- (3) 全数の掃引。動いたのはこの1行だけであることを内訳で固定する ----
  const counts = { raw: 0, pick: 0, during: 0, keep: 0, heat: 0, other: 0 }
  let totalLines = 0
  for (const def of starterDefs) {
    for (const line of splitRecipeNoteLines(def.memo)) {
      counts[classifyRecipeNote(line)]++
      totalLines++
    }
  }
  eq('FR-NOTE 同梱109品の本体メモは169行', totalLines, 169)
  // 2026-08-12 便FX: during(調理の途中の話)を足したので、keepが1行だけそちらへ移る
  // (フレンチトーストの「浸けている間は必ず冷蔵庫に入れておくこと。」)
  eq('FR-NOTE 行の種類の内訳(pickは1行だけ＝チャーハン)', counts, {
    raw: 51,
    pick: 1,
    during: 1,
    keep: 94,
    heat: 8,
    other: 14,
  })
  // 材料の選び方と判定された行は、必ずその品の最初の手順に出る
  let pickLines = 0
  let pickAtFirst = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo).filter((l) => classifyRecipeNote(l) === 'pick')
    if (lines.length === 0) continue
    const map = assignRecipeNotes(noteSteps(13, def), new Map([[13, def]]))
    for (const line of lines) {
      pickLines++
      if (notesAt(map, 13, 0).includes(line)) pickAtFirst++
    }
  }
  eq('FR-NOTE 材料の選び方の行はすべて最初の手順に出る', [pickLines, pickAtFirst], [1, 1])
}

// ---------- 2026-08-12 便FX・調理の途中の話が、段取りの最後に寄っていた ----------
// オーナー実機「フレンチトーストの『浸けている間は必ず冷蔵庫に入れておくこと。』が最後の手順に
// 出る（本当に効くのは手順3＝卵液に浸す）」。「冷蔵」に反応して保存の行と読まれていた。
// 「〜ている間は」＝その作業をしている最中の話なので、保存より先に見分けてその手順に出す。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  const FT_DURING = '浸けている間は必ず冷蔵庫に入れておくこと。'

  // ---- (1) 行の見分け ----
  eq('FX-NOTE 「〜ている間は」の行は during(冷蔵の語があっても保存にしない)', classifyRecipeNote(FT_DURING), 'during')
  eq('FX-NOTE 「煮ている間は」も during', classifyRecipeNote('煮ている間は火から離れないこと。'), 'during')
  eq('FX-NOTE 「寝かせておく間は」も during', classifyRecipeNote('寝かせておく間は冷蔵庫に入れること。'), 'during')
  // 「時間は」を巻き込まない（同梱9品の「ご飯を炊く時間は調理時間に含んでいない」を動かさない）
  eq(
    'FX-NOTE 「炊く時間は」は during ではない(作り始めに読む行のまま)',
    classifyRecipeNote('・ご飯を炊く時間は調理時間に含んでいない。炒め始めるまでに2杯分を用意しておくこと。'),
    'other',
  )
  eq(
    'FX-NOTE ふつうの保存の行は保存のまま',
    classifyRecipeNote('・冷蔵で2〜3日を目安に食べ切ること。'),
    'keep',
  )

  // ---- (2) フレンチトーストの実データ。浸す手順に出て、最後の手順には出ない ----
  const frenchToast = starterDefs.find((d) => d.title === 'フレンチトースト')
  eq('FX-NOTE フレンチトーストが同梱カタログにある', frenchToast != null, true)
  const ftNotes = assignRecipeNotes(noteSteps(21, frenchToast), new Map([[21, frenchToast]]))
  const ftSoakIndex = frenchToast.steps.findIndex((s) => s.text.includes('卵液に浸し'))
  eq('FX-NOTE 卵液に浸す手順は3番目', ftSoakIndex, 2)
  eq('FX-NOTE 浸している手順に出る', notesAt(ftNotes, 21, ftSoakIndex).includes(FT_DURING), true)
  eq(
    'FX-NOTE 完成の手順には出ない(以前はここに出ていた)',
    notesAt(ftNotes, 21, frenchToast.steps.length - 1).includes(FT_DURING),
    false,
  )

  // ---- (3) 全数の掃引。169行のうち寄せ先が動いたのはこの1行だけ ----
  let movedLines = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo)
    if (lines.length === 0) continue
    const map = assignRecipeNotes(noteSteps(22, def), new Map([[22, def]]))
    for (const line of lines) {
      if (classifyRecipeNote(line) !== 'during') continue
      movedLines++
      // during と判定された行は、その動作が書かれた手順に出る（見つからなければ最初の手順）
      eq(
        `FX-NOTE during の行が浸す手順に出る(${def.title})`,
        notesAt(map, 22, ftSoakIndex).includes(line),
        true,
      )
    }
  }
  eq('FX-NOTE 同梱109品で during と読む行は1行だけ', movedLines, 1)
}

// ---------- 便FT: 段取りと途中の位置を、アプリを開き直しても残す
// (2026-08-12 利用者テスト「アプリを開き直すと、段取りも途中の位置も消える。
//  タイマーの残り時間は開き直しても続いているのに、段取りだけ消えるのはちぐはぐ」)
//
// この機能でいちばん怖いのは「消えること」ではなく**間違ったものが残ること**なので、
// 残す実装より先に**捨てる条件**をここで固定する。
//   ①覚え書きの形の版が違う ②覚えた日が今日でない ③日付・版が読めない ④形が壊れている
//   ⑤選んだ品が1品も無い ⑥段取りを出していないのに位置だけある
// さらに、読み戻した選択は今日の献立と突き合わせ(resolveCookNaviSelection)、
// 読み戻した位置は組み直した段取りに無ければ捨てる(resolveCursor)＝どちらも迂回しない。
// ----------
{
  const ftToday = '2026-08-12'
  const ftCursor = { recipeId: 20, stepIndex: 1 }
  const ftSession = {
    selectedIds: [10, 20, 30],
    showTimeline: true,
    trialActive: false,
    current: ftCursor,
  }
  const ftSaved = (session = ftSession, date = ftToday) =>
    serializeCookNaviSession(session, date)

  // --- 残す側 ---
  eq(
    'FT-KEEP-01 同じ日に覚えた段取りの元と調理中の位置は、そのまま読み戻せる',
    restoreCookNaviSession(ftSaved(), ftToday),
    { kind: 'ok', session: { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: ftCursor } },
  )
  eq(
    'FT-KEEP-02 保存には覚え書きの版と、覚えた日が入る（この2つで捨てる判断をする）',
    (() => {
      const saved = JSON.parse(ftSaved())
      return [saved.v, saved.date]
    })(),
    [COOK_NAVI_SESSION_VERSION, ftToday],
  )
  eq(
    'FT-KEEP-03 色で引き寄せた指示も、同じ日なら残る（並びだけ元に戻らない）',
    restoreCookNaviSession(
      ftSaved({ ...ftSession, pulls: [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }] }),
      ftToday,
    ).session.pulls,
    [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }],
  )
  eq(
    'FT-KEEP-04 お試しで使っている最中かどうかも残る（開き直すたびに1回失わない）',
    restoreCookNaviSession(ftSaved({ ...ftSession, trialActive: true }), ftToday).session.trialActive,
    true,
  )

  // --- 捨てる側 ---
  const ftExpired = restoreCookNaviSession(ftSaved(ftSession, '2026-08-11'), ftToday)
  eq('FT-DROP-01 覚えた日が今日でなければ捨てる（昨日の段取りが今日出てこない）', ftExpired.kind, 'expired')
  eq('FT-DROP-01 捨てた理由は「日付が変わった」', ftExpired.reason, 'date')
  eq('FT-DROP-01 捨てたときは中身を一切返さない（部分的に残さない）', ftExpired.session, undefined)
  eq(
    'FT-DROP-02 捨てたときも「段取りを出していたか」は返す（黙って消さないための知らせに使う）',
    [ftExpired.hadTimeline, ftExpired.hadCursor],
    [true, true],
  )
  eq(
    'FT-DROP-03 段取りを出していなかった覚え書きは、捨てても知らせない（失うものが無い）',
    (() => {
      const r = restoreCookNaviSession(
        ftSaved({ selectedIds: [10, 20], showTimeline: false, trialActive: false }, '2026-08-11'),
        ftToday,
      )
      return [r.kind, r.hadTimeline, r.hadCursor]
    })(),
    ['expired', false, false],
  )
  eq(
    'FT-DROP-04 覚え書きの形の版が違えば捨てる（古い形の位置を今の段取りに当てない）',
    (() => {
      const r = restoreCookNaviSession(
        JSON.stringify({ ...JSON.parse(ftSaved()), v: COOK_NAVI_SESSION_VERSION + 1 }),
        ftToday,
      )
      return [r.kind, r.reason]
    })(),
    ['expired', 'version'],
  )
  eq(
    'FT-DROP-05 版が入っていない保存は、うちの覚え書きではない扱いで捨てる',
    restoreCookNaviSession(JSON.stringify({ selectedIds: [10, 20], showTimeline: true, date: ftToday }), ftToday).kind,
    'none',
  )
  eq(
    'FT-DROP-06 日付が入っていない保存は捨てる（いつのものか確かめられない）',
    restoreCookNaviSession(
      JSON.stringify({ v: COOK_NAVI_SESSION_VERSION, selectedIds: [10, 20], showTimeline: true }),
      ftToday,
    ).kind,
    'none',
  )
  eq('FT-DROP-07 何も覚えていない・壊れた保存は捨てる', [
    restoreCookNaviSession(null, ftToday).kind,
    restoreCookNaviSession('{こわれ', ftToday).kind,
  ], ['none', 'none'])
  eq(
    'FT-DROP-08 時計が先に進んだ（明日の日付の）覚え書きも、今日と違えば捨てる',
    restoreCookNaviSession(ftSaved(ftSession, '2026-08-13'), ftToday).kind,
    'expired',
  )
  eq(
    'FT-DROP-09 選んだ品が1品も無い覚え書きは残さない',
    restoreCookNaviSession(ftSaved({ selectedIds: [], showTimeline: true, trialActive: false }), ftToday).kind,
    'none',
  )
  eq(
    'FT-DROP-10 段取りを出していないのに位置だけある不整合は、位置と引き寄せを捨てる',
    (() => {
      const r = restoreCookNaviSession(
        ftSaved({
          selectedIds: [10, 20],
          showTimeline: false,
          trialActive: false,
          current: ftCursor,
          pulls: [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }],
        }),
        ftToday,
      )
      return [r.kind, r.session.current, r.session.pulls]
    })(),
    ['ok', undefined, undefined],
  )

  // --- 読み戻したあと（既存の整合を迂回しない） ---
  eq(
    'FT-MIX-01 読み戻した選択は、そのまま使わず今日の献立と突き合わせる',
    resolveCookNaviSelection(
      restoreCookNaviSession(ftSaved(), ftToday).session.selectedIds,
      [20, 30],
      false,
    ),
    [20, 30],
  )
  eq(
    'FT-MIX-02 読み戻した選択が今日の献立に1品も無ければ、今日の献立から選び直す',
    resolveCookNaviSelection(
      restoreCookNaviSession(ftSaved(), ftToday).session.selectedIds,
      [40, 50, 60, 70],
      false,
    ),
    [40, 50, 60],
  )
  eq(
    'FT-MIX-03 読み戻した位置が組み直した段取りに無ければ、推測せず捨てる（一覧に戻す）',
    resolveCursor(
      [
        { recipeId: 10, stepIndex: 0 },
        { recipeId: 30, stepIndex: 0 },
      ],
      restoreCookNaviSession(ftSaved(), ftToday).session.current,
    ),
    undefined,
  )
  eq(
    'FT-MIX-04 読み戻した位置が段取りにあれば、その手順のまま続く',
    resolveCursor(
      [
        { recipeId: 10, stepIndex: 0 },
        { recipeId: 20, stepIndex: 1 },
        { recipeId: 30, stepIndex: 0 },
      ],
      restoreCookNaviSession(ftSaved(), ftToday).session.current,
    ),
    ftCursor,
  )
}

// ---------- 2026-08-12 便FX・調理中モードの手順の文字の大きさ ----------
// オーナー実機「調理中モードの文字の大きさは、ユーザーが自由に変更できない？
// 小さい画面だと表示できなくなるから無理か」。手順の枠は縦にスクロールするので、
// 大きくしても読めなくならない。設定に入っている値は必ず選べる4段のどれかに寄せる。
{
  const { COOK_FONT_SCALES, DEFAULT_COOK_FONT_SCALE, resolveCookFontScale, cookFontSize } =
    await import('../src/logic/cookFontScale.ts')
  eq('FX-09 選べるのは4段', [...COOK_FONT_SCALES], [0.85, 1, 1.25, 1.5])
  eq('FX-09 既定はふつう(1倍)', DEFAULT_COOK_FONT_SCALE, 1)
  eq('FX-09 未設定は既定に寄せる', resolveCookFontScale(undefined), 1)
  eq('FX-09 一覧に無い値は既定に寄せる', resolveCookFontScale(3), 1)
  eq('FX-09 壊れた値も既定に寄せる', [resolveCookFontScale(Number.NaN), resolveCookFontScale(-1)], [1, 1])
  eq('FX-09 選べる値はそのまま返す', COOK_FONT_SCALES.map(resolveCookFontScale), [0.85, 1, 1.25, 1.5])
  // 手順本文は 1.5rem（text-2xl）が標準。倍率をかけた値をCSSに渡す
  eq('FX-09 手順本文の大きさ(標準1.5rem)', COOK_FONT_SCALES.map((s) => cookFontSize(1.5, s)), [
    '1.275rem',
    '1.5rem',
    '1.875rem',
    '2.25rem',
  ])
  eq('FX-09 枠の基準の大きさ(標準1rem)', COOK_FONT_SCALES.map((s) => cookFontSize(1, s)), [
    '0.85rem',
    '1rem',
    '1.25rem',
    '1.5rem',
  ])
}


// ---------- GF-A 「まとめて作った！」の案内文と、実際に起きることを一致させる ----------
// 2026-08-14 便GF・利用者テスト（原文）:
//   「ダイアログに『記録した3件は今日の献立から外れます（レシピと段取りはそのまま残ります）』と
//     書かれている／『記録をつける』を押す／並行調理ナビが『今日の献立にレシピがありません』に
//     なり、段取りが消える。リロードしても戻らない」
//   「実害: 作り終えて記録をつけた直後に『あれ、パセリの前に何やったっけ』と振り返れない。
//     説明文がその場で嘘になっているのが一番まずい」
// 記録したら段取りを終える動き自体はオーナーの整理どおり（2026-08-13）なので、直すのは案内文。
// **動き（消える）と案内文（消えると書いてある）を1つのテストで突き合わせる**＝
// 片方だけ直しても緑にならない形にする。
{
  const store = new Map()
  const shim = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const originalLocal = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  const originalSession = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true, writable: true })
  Object.defineProperty(globalThis, 'sessionStorage', { value: shim, configurable: true, writable: true })
  const { saveCookNaviSession, loadCookNaviSession, clearCookNaviSession } = await import(
    '../src/logic/cookNaviSession.ts'
  )
  saveCookNaviSession({
    selectedIds: [1, 2, 3],
    showTimeline: true,
    trialActive: false,
    current: { recipeId: 1, stepIndex: 0 },
  })
  eq('GF-A 前提: 段取りは端末に残っている', loadCookNaviSession()?.showTimeline, true)
  // 「まとめて作った！」が呼ぶ後始末（CookNaviPage の markAllCooked）
  clearCookNaviSession()
  eq('GF-A 記録をつけたあと、段取りは残らない', loadCookNaviSession(), undefined)
  const confirmText = ja.cookNavi.markAllCookedConfirm
  eq(
    'GF-A 案内文に、段取りが消えることが書いてある',
    confirmText.includes('段取り') && confirmText.includes('消えます'),
    true,
  )
  neq(
    'GF-A 案内文が「段取りは残る」と言っていない（利用者が読んだ嘘の一文）',
    /段取り[^。]*残ります/.test(confirmText),
    true,
  )
  eq(
    'GF-A 案内文に、何が残るかも書いてある（規約F）',
    confirmText.includes('レシピ・作った記録') && confirmText.includes('残ります'),
    true,
  )
  // 記録した直後の並行調理ナビは「今日の献立が空」ではなく「今日の献立を作り終えた」状態。
  // 「レシピがありません」と出ると、そこでも画面が事実と違うことを言うことになる
  eq(
    'GF-A 作り終えたときの案内は、献立が空のときの文言をそのまま使わない',
    ja.cookNavi.emptyTodayCooked.includes('今日の献立にレシピがありません'),
    false,
  )
  eq(
    'GF-A 作り終えたときの案内は、件数と次にできることを書く',
    ja.cookNavi.emptyTodayCooked.includes('{n}品') &&
      ja.cookNavi.emptyTodayCooked.includes('「今日の献立に追加」'),
    true,
  )
  if (originalLocal) Object.defineProperty(globalThis, 'localStorage', originalLocal)
  else delete globalThis.localStorage
  if (originalSession) Object.defineProperty(globalThis, 'sessionStorage', originalSession)
  else delete globalThis.sessionStorage
}

// ---------- GF-B 貼り付けの☆・◎から合わせ調味料の組を自動で作る ----------
// 2026-08-14 便GF・利用者テスト（原文）:
//   「貼り付け後の材料名: 『☆みそ』→『みそ』、『◎すりごま』→『すりごま』。色分け
//    （合わせ調味料グループ）も自動では付かない。一方、手順は『その間に☆を全部混ぜ合わせて
//     おく。』『ボウルで◎を混ぜ、』のまま。結果、『☆ってどれ？』が画面のどこを見ても分からない」
//   「再現: 『☆みそ / ☆マヨネーズ / ◎すりごま / ◎しょうゆ / Aみりん』を貼ると、名前は
//    『みそ / マヨネーズ / すりごま / しょうゆ / Aみりん』。**Aだけ残る**。記号ごとに扱いが
//     違うのも不統一」
// 決めた規則: **印の種類ではなく「同じ印が2件以上あるか」**で組にする（☆も◎もA〜Dも同じ扱い）。
// 全部の材料に付いている印は行頭の飾りなので組にしない。印は名前から外し、材料メモに残す。
{
  const pasted = `ごま和え
材料
☆みそ 大さじ2
☆マヨネーズ 大さじ1
◎すりごま 大さじ2
◎しょうゆ 小さじ1
Aみりん 小さじ1
にんじん 1/3本
作り方
その間に☆を全部混ぜ合わせておく。
ボウルで◎を混ぜ、にんじんを和える。`
  const parsed = parseRecipeText(pasted)
  eq(
    'GF-B ☆の2件と◎の2件が、それぞれ別の組になる',
    parsed.ingredients.map((r) => [r.name, r.group ?? null]),
    [
      ['みそ', 1],
      ['マヨネーズ', 1],
      ['すりごま', 2],
      ['しょうゆ', 2],
      ['Aみりん', null],
      ['にんじん', null],
    ],
  )
  eq(
    'GF-B 印は材料メモに残る（手順文の☆・◎がどれを指すか画面で追える）',
    parsed.ingredients.map((r) => r.memo ?? ''),
    ['☆', '☆', '◎', '◎', '', ''],
  )
  // 1件しかない印は「まとめて計量する組」にならない。英字は語の一部のことがある
  //（「B級〜」）ので、組にならないときは名前もそのままにする＝材料名を壊さない
  eq('GF-B 1件だけの印は組にしない', parsed.ingredients[4], {
    name: 'Aみりん',
    amount: '1',
    unit: '小さじ',
  })
}
{
  // 同じ英字が2件以上あれば、記号と同じように組になる（R6のA./B.が実例）
  const parsed = parseRecipeText(`材料
Aしょうゆ 大さじ1
Aみりん 大さじ1
豚こま 200g`)
  eq(
    'GF-B 英字も2件以上そろえば組になり、名前から外れる',
    parsed.ingredients.map((r) => [r.name, r.group ?? null, r.memo ?? '']),
    [
      ['しょうゆ', 1, 'A'],
      ['みりん', 1, 'A'],
      ['豚こま', null, ''],
    ],
  )
}
{
  // 全部の行に同じ記号が付いているのは「組」ではなく行頭の飾り。1組にまとめると
  // 肉と野菜まで「先にまとめて計量できます」と言うことになる
  const parsed = parseRecipeText(`材料
☆豚こま 200g
☆にんじん 1本
☆しょうゆ 大さじ1`)
  eq(
    'GF-B 全部に付いた記号は飾りとみなして組にしない',
    parsed.ingredients.map((r) => [r.name, r.group ?? null, r.memo ?? '']),
    [
      ['豚こま', null, ''],
      ['にんじん', null, ''],
      ['しょうゆ', null, ''],
    ],
  )
}
{
  // 色は4組までしか見分けが付かないので、5つ目の印は組にしない（色が一周すると別の組と混ざる）
  const parsed = parseRecipeText(`材料
☆しょうゆ 大さじ1
☆酒 大さじ1
◎みそ 大さじ1
◎砂糖 大さじ1
●塩 少々
●こしょう 少々
▲酢 大さじ1
▲油 大さじ1
■水 100ml
■だし 少々`)
  eq(
    'GF-B 組は色の数（4組）まで',
    parsed.ingredients.map((r) => r.group ?? null),
    [1, 1, 2, 2, 3, 3, 4, 4, null, null],
  )
  eq(
    'GF-B 5組目の印も、書いてあった事実は材料メモに残す',
    parsed.ingredients.slice(8).map((r) => r.memo ?? ''),
    ['■', '■'],
  )
}
{
  // 組が付いたら、手順文の記号との対応が並行調理ナビの画面に出る（この対応が付かないと
  // 「☆ってどれ？」が画面のどこを見ても分からないまま）。取り込みは印を材料メモへ移すので、
  // ナビは**名前とメモの両方**を見る
  const ings = [
    { name: 'みそ', amount: '2', unit: '大さじ', memo: '☆', seasoningGroup: 1 },
    { name: 'マヨネーズ', amount: '1', unit: '大さじ', memo: '☆', seasoningGroup: 1 },
    { name: 'すりごま', amount: '2', unit: '大さじ', memo: '◎', seasoningGroup: 2 },
    { name: 'しょうゆ', amount: '1', unit: '小さじ', memo: '◎', seasoningGroup: 2 },
  ]
  eq(
    'GF-B 手順「☆を全部混ぜ合わせておく」に☆の組が出る',
    stepIngredientAmounts('その間に☆を全部混ぜ合わせておく。', ings, 2, 2).map((x) => x.name),
    ['みそ', 'マヨネーズ'],
  )
  eq(
    'GF-B 手順「◎を混ぜ」には◎の組だけが出る（☆と取り違えない）',
    stepIngredientAmounts('ボウルで◎を混ぜ、にんじんを和える。', ings, 2, 2).map((x) => x.name),
    ['すりごま', 'しょうゆ'],
  )
  const letters = [
    { name: 'しょうゆ', amount: '1', unit: '大さじ', memo: 'A', seasoningGroup: 1 },
    { name: 'みりん', amount: '1', unit: '大さじ', memo: 'A', seasoningGroup: 1 },
    { name: '砂糖', amount: '1', unit: '大さじ', memo: 'B', seasoningGroup: 2 },
    { name: '酒', amount: '1', unit: '大さじ', memo: 'B', seasoningGroup: 2 },
  ]
  eq(
    'GF-B 手順「Aを加えて」にAの組が出る',
    stepIngredientAmounts('Aを加えて煮からめる。', letters, 2, 2).map((x) => x.name),
    ['しょうゆ', 'みりん'],
  )
  eq(
    'GF-B 「A5ランクの牛肉」のような英数字はAの印と読まない',
    stepIngredientAmounts('A5ランクの牛肉を焼く。', letters, 2, 2).map((x) => x.name),
    [],
  )
}

// ---------- GF-C 品ごとのできあがりの目安と、その開きを画面に出す ----------
// 2026-08-14 便GF・利用者テスト（原文）:
//   「アプリは合計だけ出して、各品が何分後にできるかは表示しません。開きは最大16分。
//     みそ汁ができてから主菜が焼き上がるまで12分放置になります。平日の夕食は3品同時に
//     出したいので、この開きが出ること自体を画面に出してほしい（今は自分で足し算しないと
//     分からない）」
// 数え方は docs/72 の N1（完成の揃い）と同じにそろえる＝**その品の最後の工程が終わる時刻**、
// 開きは**冷たくして出す品を除いた**最大−最小、線は全体の目安の30%。
{
  const { recipeFinishTimes, finishSpread } = await import('../src/logic/cookFinish.ts')
  const trio = [
    {
      id: 1,
      title: 'GC鶏のグリル焼き',
      steps: [{ text: '鶏むね肉をそぎ切りにする' }, { text: '魚焼きグリルで15分焼く' }, { text: 'パセリをふる' }],
    },
    {
      id: 2,
      title: 'GCみそ汁',
      dishType: 'soup',
      steps: [{ text: '鍋に水とだしの素を入れて中火にかける' }, { text: '豆腐を切る' }, { text: 'みそを溶いて火を止める' }],
    },
    {
      id: 3,
      title: 'GCポテトサラダ',
      steps: [{ text: 'じゃがいもを切る' }, { text: '電子レンジで6分加熱する' }, { text: '冷蔵庫で冷やしてから和える' }],
    },
  ]
  const plan = buildCookPlan(trio)
  const finishes = recipeFinishTimes(plan.items, plan.recipes, (id) => trio.find((r) => r.id === id))
  // 監査（scripts/audit-cook-navi.mjs の finishTimes）と同じ数え方であること。
  // 実装を写すのではなく、段取りの endMin から**独立に**数え直して突き合わせる
  const expected = plan.recipes.map((r) => ({
    recipeId: r.id,
    minutes: plan.items
      .filter((it) => it.recipeId === r.id)
      .reduce((max, it) => Math.max(max, it.endMin), 0),
  }))
  eq(
    'GF-C 品ごとの完成時刻は「その品の最後の工程が終わる時刻」（docs/72 N1と同じ数え方）',
    finishes.map((f) => ({ recipeId: f.recipeId, minutes: f.minutes })),
    expected,
  )
  eq('GF-C 3品ぶんの目安が出る（1品も欠けない）', finishes.length, 3)
  eq(
    'GF-C 冷やしてから出す品は「冷たい品」と読む（開きの計算から外すため）',
    finishes.map((f) => f.cold),
    [false, false, true],
  )
  const gap = finishSpread(finishes)
  // 2026-08-14 便GK: 画面に出す開きは**全部の品**で数える（冷たい品を黙って外すと
  // 「4分は言うのに17分は何も言わない」になる）。段取りを測る N1 の定義は変えていない
  const all = finishes.map((f) => f.minutes)
  eq(
    'GF-C 開きは全部の品の最大−最小（先にできる品が冷たい品かどうかは文言で書き分ける）',
    gap.minutes,
    Math.max(...all) - Math.min(...all),
  )
  eq(
    'GF-C どの2品の開きなのかも返す（画面では品名で書く）',
    [gap.first.recipeId !== gap.last.recipeId, gap.first.minutes <= gap.last.minutes],
    [true, true],
  )
}
{
  const { recipeFinishTimes, finishSpread, isFinishSpreadWide } = await import(
    '../src/logic/cookFinish.ts'
  )
  // 温かい品が1つしかないときは開きを言わない（比べる相手がいない）
  const two = [
    { id: 1, title: 'GC煮物', steps: [{ text: '材料を切る' }, { text: '鍋で20分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'GC冷やしサラダ', steps: [{ text: '野菜を切る' }, { text: '冷蔵庫で冷やしてから和える' }] },
  ]
  const plan = buildCookPlan(two)
  const finishes = recipeFinishTimes(plan.items, plan.recipes, (id) => two.find((r) => r.id === id))
  // 2026-08-14 便GK: 冷たい品も開きの対象にする（先にできる理由は文言側で書き分ける）
  eq(
    'GF-C 冷たい品しか相手がいなくても開きは出す（黙って飛ばさない）',
    finishSpread(finishes).minutes > 0,
    true,
  )
  eq(
    'GF-C 先にできる品が冷たい品かどうかを返す',
    finishSpread(finishes).first.cold,
    true,
  )
  eq('GF-C 品が1つしかなければ開きは0（言わない）', finishSpread([finishes[0]]).minutes, 0)
  // 線は docs/72 N1 と同じ＝全体の30%を「超えた」ら大きいとみなす（ちょうど30%は大きくない）
  eq('GF-C 開きの線は全体の30%（ちょうどは大きくない）', isFinishSpreadWide(30, 100), false)
  eq('GF-C 30%を超えたら大きい', isFinishSpreadWide(31, 100), true)
  eq('GF-C 全体が0分なら大きいと言わない', isFinishSpreadWide(5, 0), false)
  // 利用者の実測（開き16分／12分放置）に相当する形は「大きい」と読む
  eq('GF-C 利用者の実測（44分中16分の開き）は大きいと読む', isFinishSpreadWide(16, 44), true)
}
{
  // 画面に出す文言（規約H）。数字と品名がそろって初めて読めるので、差し込み口を固定する
  eq(
    'GF-C 見出しに「調理を始めてから」が入っている（何分後かの起点が読める）',
    ja.cookNavi.finishTitle.includes('調理を始めてから'),
    true,
  )
  eq('GF-C 品ごとの行は分数を差し込む', ja.cookNavi.finishItem.includes('{n}'), true)
  eq(
    'GF-C 開きの一文は、2品の名前と分数を差し込む',
    ja.cookNavi.finishSpread.includes('{first}') &&
      ja.cookNavi.finishSpread.includes('{last}') &&
      ja.cookNavi.finishSpread.includes('{n}'),
    true,
  )
  eq(
    'GF-C 開きが大きいときの一文も、先にできる品の名前を差し込む',
    ja.cookNavi.finishSpreadWide.includes('{first}'),
    true,
  )
}

// ==========================================================================================
// 便GK: 段取りの数字が信用できない件（2026-08-14 実操作テスト3回目）
// 利用者の原文は docs/71 に追記。ここは再発防止のケースだけを置く。
// ==========================================================================================

// ---------- GK-1: 分数欄が埋まっていても、混在手順を割る ----------
// 原文:「手順1の本文は『皮を取り、フォークで刺し、そぎ切りにする。塩こしょうと酒をふって10分ほどおく』…
//        それを手順まるごと『待ち』にして…押した瞬間から10:00がカウントダウンを始める。
//        でも私はまだ肉に触ってもいない」
// 真因: 2026-08-08 便ED の打ち手#2（取り込んだ手順の本文に書かれた時間を分数欄へ転記）以降、
//       URL取り込み・貼り付けで登録したレシピの分数欄は**埋まる**ようになった。
//       splitMixedStep は「分数欄が埋まっている手順は分けない」で外していたため、
//       R3の症状を直したはずの便GDが、実際の登録経路では1件も効いていなかった。
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  const chicken = t(
    '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
    10,
  )
  eq(
    'GK-1 分数欄が埋まっていても「◯分おく」型の混在は割る（待ちの側に同じ分数が書かれている）',
    (() => {
      const s = splitMixedStep(chicken)
      return s && [s.active.text, s.wait.text, s.wait.minutes, s.active.minutes]
    })(),
    [
      '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。',
      '塩こしょうと酒をふって10分ほどおく。',
      10,
      undefined,
    ],
  )
  const soup = t('沸いたら豆腐をさいの目に切って入れ、乾燥わかめも加えて1〜2分煮る。', 2)
  eq(
    'GK-1 「◯分煮る」型（豆腐を切る手作業が入っている）も割る',
    (() => {
      const s = splitMixedStep(soup)
      return s && [s.active.text, s.wait.text, s.wait.minutes]
    })(),
    // 切る位置はできるだけ後ろ（＝手を動かす部分をできるだけ残す）ので、
    // 豆腐を切るのもわかめを加えるのも手作業の側に残る
    ['沸いたら豆腐をさいの目に切って入れ、乾燥わかめも加えて', '1〜2分煮る。', 2],
  )
  // 迷ったら割らない側（S1を増やさない）: 分数欄の数字が本文の待ちの側に書かれていない手順は割らない
  eq(
    'GK-1 分数欄の数字が本文に書かれていない手順は今までどおり割らない',
    splitMixedStep(t('水を入れて煮る', 10)),
    undefined,
  )
  eq(
    'GK-1 手作業の側にだけ時間が書かれている手順は割らない',
    splitMixedStep(t('玉ねぎを10分炒めてから煮る', 10)),
    undefined,
  )
  {
    // アプリと同じ登録経路（貼り付け取り込み → 本文の時間を分数欄へ転記）を通しても割れること
    const raw = '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。'
    const step = { text: raw, minutes: stepMinutesFromText(raw) }
    eq('GK-1 取り込み経路では分数欄が埋まる（前提の確認）', step.minutes, 10)
    const plan = buildCookTimeline([{ id: 1, title: 'GK主菜', steps: [step] }])
    eq('GK-1 取り込んだレシピでも手を動かす時間が0分でなくなる', plan.items[0].activeMinutes > 0, true)
    eq('GK-1 待ちの分数は変わらない', plan.items[1].waitMinutes, 10)
    eq(
      'GK-1 タイマーは待ちの工程だけに出る（手作業の前には押せない）',
      [showsWaitTimerButton(plan.items[0]), showsWaitTimerButton(plan.items[1])],
      [false, true],
    )
    eq('GK-1 待ちは手作業が終わってから始まる', plan.items[1].startMin, plan.items[0].endMin)
    eq(
      'GK-1 番号は「1-1」「1-2」',
      [recipeStepLabel(plan.items[0]), recipeStepLabel(plan.items[1])],
      ['1-1', '1-2'],
    )
  }
}

// ---------- GK-2: 分数の書かれていない手作業の見積り ----------
// 原文:「『焼けたら乾燥パセリをふる』に4分。パセリをふるのに4分は取りません。10秒です。
//        逆に『ホイル敷いて肉を並べてみそマヨを塗ってチーズをのせる』が2分。…見積りが逆になっている」
{
  const t = (text) => ({ text })
  const one = estimateActiveMinutes(t('焼けたら乾燥パセリをふる。')).minutes
  const many = estimateActiveMinutes(
    t('アルミホイルを敷いて鶏を並べ、みそマヨを塗ってチーズをのせる。'),
  ).minutes
  eq('GK-2 「ふる」の一手は一律4分にしない', one <= 2, true)
  eq('GK-2 複数動作の組み立ては、一手より長く見る（見積りの逆転を起こさない）', many > one, true)
  eq('GK-2 「塩をふる」も一手として読む', estimateActiveMinutes(t('塩をふる。')).minutes <= 3, true)
  eq('GK-2 「器に盛って散らす」は仕上げのまま短い', estimateActiveMinutes(t('器に盛る。')).minutes, 2)
  // 手順の中でいちばん重い動作で見る（最後に出てきた語だけで決めない）
  eq(
    'GK-2 「炒めて器に盛る」は炒めの重さで見る（最後の「盛る」だけで2分にしない）',
    estimateActiveMinutes(t('ひき肉を炒めて器に盛る。')).minutes >= 5,
    true,
  )
  // やりすぎない側の歯止め（既存の見積りを壊さない）
  eq('GK-2 切る工程は3分のまま', estimateActiveMinutes(t('玉ねぎをみじん切りにする')).minutes, 3)
  eq('GK-2 炒める工程は5分のまま', estimateActiveMinutes(t('ひき肉を炒める')).minutes, 5)
  eq(
    'GK-2 「鍋に水を入れて火にかける」は準備動作で2分のまま',
    estimateActiveMinutes(t('鍋に水とだしの素を入れて火にかける。')).minutes,
    2,
  )
}

// ---------- GK-3: 範囲で書かれた時間のタイマーは短いほうで立てる ----------
// 原文:「本文は『12〜15分焼く』。ボタンのラベルは『12〜15分 タイマー開始』なのに、表示と実際の待ちは約15分。
//        チーズがのっているものを最初から15分放置に設定するのは危ない。12分で一度見るほうが正しい」
{
  const { findTimeTokens } = await import('../src/logic/time.ts')
  const secs = (text) => findTimeTokens(text).map((x) => x.seconds)
  const maxSecs = (text) => findTimeTokens(text).map((x) => x.maxSeconds)
  eq('GK-3 タイマーにする長さは範囲の短いほう', [secs('12〜15分焼く。'), secs('1〜2分煮る。')], [[720], [60]])
  eq('GK-3 段取りの見積りに使う長さは範囲の長いほうのまま', maxSecs('12〜15分焼く。'), [900])
  eq('GK-3 単位が2回書かれる形でも短いほうで立てる', secs('12分〜15分煮る。'), [720])
  eq('GK-3 範囲でない時間は今までどおり', [secs('中火で15分煮る。'), maxSecs('中火で15分煮る。')], [[900], [900]])
  eq(
    'GK-3 段取りの待ち分数は上限のまま（先に短く見積もって詰め込まない）',
    resolveWaitMinutes({ text: '魚焼きグリルで12〜15分焼く。' }),
    15,
  )
  eq(
    'GK-3 待ちブロックのタイマーも短いほうで始める',
    waitTimerSeconds({ text: '魚焼きグリルで12〜15分焼く。', waitMinutes: 15, longRest: false }),
    720,
  )
  eq(
    'GK-3 範囲で書かれていない待ちは、その待ち分数どおりに始める',
    waitTimerSeconds({ text: '弱火で20分煮る。', waitMinutes: 20, longRest: false }),
    1200,
  )
  eq(
    'GK-3 分数を本文に持たない待ち（調理法から当てた分数）もその分数で始める',
    waitTimerSeconds({ text: '魚焼きグリルで焼く。', waitMinutes: 15, longRest: false }),
    900,
  )
  eq('GK-3 取り込みの分数欄には長いほうを写す（本文に書いてある事実の転記）', stepMinutesFromText('12〜15分焼く。'), 15)
}

// ---------- GK-4: 「1品だけなら約◯分」が手順の合計と合わない ----------
// 原文:「鶏の手順は 10＋3＋2＋15＋4＝34分。なのに『1品だけなら約31分』。
//        ごま和えは12分、みそ汁は13分でどちらもぴったり合うのに鶏だけ3分合わない」
// 真因: 利用者が本文に書いた「その間に」の手順と、ナビが差し込んだ「沸くのを待つ」の直後の手順は、
//       その品の待ちの**中**に置かれる（2026-08-13 便GB/GD）。品の所要時間には二重に足されないので、
//       画面の手順の分数を足した数より短くなる。画面がその重なりを何も言っていなかった。
{
  const chicken = {
    id: 1,
    title: 'GK鶏のみそマヨ焼き',
    steps: [
      {
        text: '鶏むね肉は皮を取り、そぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
        minutes: 10,
      },
      { text: 'その間に☆を全部混ぜ合わせておく。' },
      { text: '魚焼きグリルで15分焼く。', minutes: 15 },
      { text: '焼けたら乾燥パセリをふる。' },
    ],
  }
  const side = {
    id: 2,
    title: 'GKごま和え',
    steps: [
      { text: 'ほうれん草を3〜4cmの長さに切る。' },
      { text: '電子レンジで3分加熱する。', minutes: 3 },
      { text: '水気をしぼって和える。' },
    ],
  }
  const plan = buildCookPlan([chicken, side])
  for (const r of plan.recipes) {
    eq(`GK-4 品ごとに手順の分数の合計を持つ（${r.title}）`, typeof r.stepSumMinutes === 'number', true)
    eq(
      `GK-4 手順の合計は「1品だけなら」の目安を下回らない（${r.title}）`,
      r.stepSumMinutes >= r.soloMinutes,
      true,
    )
  }
  const gap = plan.recipes.find((r) => r.id === 1)
  eq(
    'GK-4 「その間に」を書いた品は、手順の合計と1品だけの目安が食い違う（重なりぶん）',
    gap.stepSumMinutes - gap.soloMinutes > 0,
    true,
  )
  const even = plan.recipes.find((r) => r.id === 2)
  eq('GK-4 重なりの無い品はぴったり合う', even.stepSumMinutes, even.soloMinutes)
  eq(
    'GK-4 食い違う理由を画面に置く一文がある（手順の分数を足した数との関係を書く）',
    typeof ja.cookNavi.legendOverlapNote === 'string' && ja.cookNavi.legendOverlapNote.length > 0,
    true,
  )
}

// ---------- GK-5: 「台所を離れられる待ち時間」が言い過ぎ ----------
// 原文:「数えたら、手が空くのは（レンジ3分待ち）＋（沸くのを待つ5分）＋（煮る2分）＝10分でした。
//        でもこのうち7分は鍋の前です。吹きこぼれるので離れられない。『台所を離れられる』は言い過ぎ。
//        しかも例に出ている『漬ける・冷やす』はこの段取りに1つもない」
{
  eq('GK-5 「台所を離れられる」とは言わない', ja.cookNavi.totalAwayNote.includes('台所を離れられる'), false)
  eq(
    'GK-5 段取りに出てこないかもしれない調理法を例に出さない',
    ja.cookNavi.totalAwayNote.includes('漬ける') || ja.cookNavi.totalAwayNote.includes('冷やす'),
    false,
  )
  eq('GK-5 分数の差し込み口は残す', ja.cookNavi.totalAwayNote.includes('{n}'), true)
  // 火にかけている待ちは数えない（実装側の確認。文言だけ直して中身が違う、を防ぐ）
  {
    const plan = buildCookPlan([
      {
        id: 1,
        title: 'GK煮物',
        steps: [{ text: '材料を切る。' }, { text: '鍋に入れて弱火で20分煮る。', minutes: 20 }, { text: '器に盛る。' }],
      },
      {
        id: 2,
        title: 'GK漬け物',
        steps: [{ text: 'きゅうりを切る。' }, { text: '調味料と合わせて30分漬ける。', minutes: 30 }, { text: '器に盛る。' }],
      },
    ])
    eq('GK-5 火にかけている20分は「そばを離れてよい待ち」に数えない', plan.awayMinutes, 30)
  }
}

// ---------- GK-6: 完成の開きの警告が出る条件 ----------
// 原文:「ごま和えを17分後に和えて、鶏ができるのは34分後。17分放置。なのにアプリが警告するのは
//        『みそ汁ができてから鶏ができるまで約4分あきます』だけ。4分は言うのに17分は何も言わない。
//        判定基準がわからない」
{
  const { finishSpread } = await import('../src/logic/cookFinish.ts')
  const finishes = [
    { recipeId: 1, minutes: 34, cold: false }, // 主菜
    { recipeId: 2, minutes: 30, cold: false }, // みそ汁
    { recipeId: 3, minutes: 17, cold: true }, // ごま和え（冷たい品と判定される）
  ]
  const gap = finishSpread(finishes)
  eq('GK-6 開きは全部の品で見る（冷たい品を黙って外さない）', gap.minutes, 34 - 17)
  eq('GK-6 いちばん早い品といちばん遅い品を返す', [gap.first.recipeId, gap.last.recipeId], [3, 1])
  eq('GK-6 先にできる品が冷たい品かどうかを返す（画面で理由を書き分けるため）', gap.first.cold, true)
  eq(
    'GK-6 温かい品どうしだけのときは今までどおり',
    finishSpread([
      { recipeId: 1, minutes: 34, cold: false },
      { recipeId: 2, minutes: 30, cold: false },
    ]).minutes,
    4,
  )
  eq('GK-6 1品だけなら開きは言わない', finishSpread([{ recipeId: 1, minutes: 20, cold: false }]).minutes, 0)
  eq(
    'GK-6 冷たい品が先にできる理由を書く一文がある',
    typeof ja.cookNavi.finishSpreadCold === 'string' && ja.cookNavi.finishSpreadCold.includes('{first}'),
    true,
  )
}

// ---------- 便GL: 手順を進めたときのタイマーの一言 / 読み上げ名 ----------
{
  const { timerNoticeOnAdvance } = await import('../src/logic/cookTimerNotice.ts')
  const { naviStepSpeechText } = await import('../src/logic/naviStepText.ts')
  /** 段取りの手順1つぶん（判定に要るところだけ） */
  const it = (recipeId, stepIndex, over = {}) => ({
    recipeId,
    stepIndex,
    order: stepIndex + 1,
    stepNumber: stepIndex + 1,
    recipeId2: undefined,
    kind: 'active',
    text: '切る。',
    minutes: 3,
    waitMinutes: 0,
    activeMinutes: 3,
    longRest: false,
    addedByNavi: false,
    recipeTitle: `料理${recipeId}`,
    colorIndex: 0,
    startMin: 0,
    endMin: 3,
    ...over,
  })
  const wait = (recipeId, stepIndex, minutes, over = {}) =>
    it(recipeId, stepIndex, {
      kind: 'wait',
      waitMinutes: minutes,
      activeMinutes: 0,
      text: `${minutes}分焼く。`,
      ...over,
    })
  const timer = (id, recipeId, stepIndex, over = {}) => ({
    id,
    key: `${recipeId}-${stepIndex}-600`,
    recipeId,
    done: false,
    ...over,
  })
  const cur = (recipeId, stepIndex) => ({ recipeId, stepIndex })

  // ① タイマーを押さずに次へ進めた（利用者「グリル15分のタイマーを押さずに次へ進めてしまった」）
  {
    const items = [wait(1, 0, 15), it(2, 0)]
    eq(
      'GL-5① 待ちのタイマーを始めずに次へ進むと、その手順を指して伝える',
      JSON.stringify(timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [])),
      JSON.stringify({ kind: 'notStarted', recipeId: 1, stepIndex: 0 }),
    )
    eq(
      'GL-5① タイマーを始めてあれば何も言わない（うるさくしない）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [timer(9, 1, 0)]),
      null,
    )
    eq(
      'GL-5① 手を動かす手順から進んだときは何も言わない',
      timerNoticeOnAdvance([it(1, 0), it(2, 0)], cur(1, 0), cur(2, 0), []),
      null,
    )
    eq(
      'GL-5① 分数を出さない長い待ち（半日〜一晩）はタイマーが無いので言わない',
      timerNoticeOnAdvance(
        [wait(1, 0, 0, { longRest: true }), it(2, 0)],
        cur(1, 0),
        cur(2, 0),
        [],
      ),
      null,
    )
  }
  // ② その品のタイマーがまだ動いているのに、その品の次の手順へ進んだ
  //    （利用者「段取り6に進んだ時点で、鶏の下味10分タイマーがまだ09:12残っていました」）
  {
    const items = [wait(1, 0, 10), it(1, 1), it(2, 0)]
    eq(
      'GL-5② 同じ品のタイマーが動いたままその品の次の手順へ進むと、残り時間を伝える',
      JSON.stringify(timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [timer(7, 1, 0)])),
      JSON.stringify({ kind: 'stillRunning', timerId: 7 }),
    )
    eq(
      'GL-5② 別の品の手順へ進んだときは言わない（待ちの間に他の品をやるのは段取りどおり）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [timer(7, 1, 0)]),
      null,
    )
    eq(
      'GL-5② 一時停止しているタイマーでは言わない（急かさない）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [
        timer(7, 1, 0, { pausedRemainingMs: 60000 }),
      ]),
      null,
    )
    // 利用者が「その間に」と書いた手順は、待ちの中でやるのが正しいので黙る
    const cued = [wait(1, 0, 10), it(1, 1, { text: 'その間に☆を混ぜ合わせる。' }), it(2, 0)]
    eq(
      'GL-5② 「その間に」と書かれた手順へ進んだときは黙る（段取りどおりの並行作業）',
      timerNoticeOnAdvance(cued, cur(1, 0), cur(1, 1), [timer(7, 1, 0)]),
      null,
    )
    // ナビが足した湯沸かしの次の手順も同じ扱い
    const boil = [wait(1, 0, 5, { addedByNavi: true }), it(1, 1), it(2, 0)]
    eq(
      'GL-5② ナビが足した湯沸かしの次の手順でも黙る',
      timerNoticeOnAdvance(boil, cur(1, 0), cur(1, 1), [timer(7, 1, 0)]),
      null,
    )
  }
  // ①が②より先（火が入ったままのほうが先に伝わる）
  {
    const items = [wait(1, 0, 15), it(1, 1)]
    eq(
      'GL-5 どちらも当てはまるときは「始めていない」を先に伝える',
      timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [timer(7, 1, 5)])?.kind,
      'notStarted',
    )
  }
  // 読み上げ名（利用者「同じ『手順』で2つの番号を指していて紛らわしい」）
  {
    eq(
      'GL-B 読み上げ名は2つの番号をそれぞれの名前で呼ぶ',
      naviStepSpeechText(9, '1-2'),
      '段取り9・手順1の2つめ',
    )
    eq('GL-B 分けていない手順はそのままの番号', naviStepSpeechText(9, '3'), '段取り9・手順3')
    eq('GL-B レシピ内の番号が無い工程は段取りの番号だけ', naviStepSpeechText(9), '段取り9')
    eq(
      'GL-B 読み上げ名に「手順」が2つの番号を指す形は残っていない',
      /手順\d+[（(]/.test(naviStepSpeechText(9, '1-2')),
      false,
    )
    // 画面に出る文字（バッジと並ぶ側）は便EZ のまま変えていない
    const { naviStepText } = await import('../src/logic/naviStepText.ts')
    eq('GL-B 画面の文字は今までどおり', naviStepText(9, '1-2'), '⑨（1-2）')
  }
  // 画面文言（規約H）
  {
    eq(
      'GL-1 目安の分数の印は、何の数字かと何でないかを両方言い切る',
      // 言い回しそのものを固定しない（2026-08-15。「手で並べ替えたあと」は声・タップでも
      // 同じ印が出るため「並びを変えたあと」に直した。文言が育つたびに落ちるテストにしない）。
      // 見るのは①その数字が何なのかを言っているか ②何ではないかを打ち消しで言っているか の2つ
      ja.cookNavi.estimateStaleNote.includes('自動で組んだ並び') &&
        /ではありません|ではない/.test(ja.cookNavi.estimateStaleNote),
      true,
    )
    eq(
      'GL-3 戻すボタンは、あと何回戻せるかを差し込む',
      ja.cookNavi.reorderUndoOne.includes('{n}'),
      true,
    )
    eq(
      'GL-6 終わりの窓のタイマーの一言は、消す側・消さない側の両方を書く',
      ja.cookNavi.sessionFinishTimersStopNote.includes('残り時間はなくなります') &&
        ja.cookNavi.sessionFinishTimersKeepNote.includes('片づけの間も鳴ります'),
      true,
    )
    eq(
      'GL-A 沸くまでの待ちは、タイマーが何分ではかるかを押す前に書く（沸く時間は言い切らない）',
      ja.cookNavi.waitBlockBoilNote.includes('タイマーは{n}分ではかります') &&
        ja.cookNavi.waitBlockBoilNote.includes('火力と量で変わります'),
      true,
    )
  }
}

// ==========================================================================================
// 便GR: 混在手順の両方計上（docs/72 N4・2026-08-15）
//
// 利用者（料理歴20年・実機で3回テスト）の原文:
//   「みそ汁の手順1は『1-1 手を動かす2分／1-2 沸くのを待つ』に割ってくれている。できるのに、
//     本文に『10分おく』と書いてある側では割らない。ここが一番納得いかない。
//     この2つが直らないなら分数は見なくなります。」
//
// 測るのは**利用者が確かめたいこと**＝「手作業と待ちが両方入った手順で、両方の時間が
// 段取りに出ていること」。工程がいくつに割れたか・何番目に出たかは見ない
// （段取りが伸びても縮んでも同じ判定になる形にする）。
// ==========================================================================================
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  /**
   * その手順が段取りの上で持つ時間の合計（何工程に割れていてもまとめて数える）。
   * 元の手順1つに対応する工程は、割られていれば splitOf に元の手順番号が入る。
   */
  const stepTotals = (steps, stepNumber = 1) => {
    const items = buildCookTimeline([{ id: 1, title: '検査用', steps }]).items
    const mine = items.filter((it) => (it.splitOf ?? it.stepNumber) === stepNumber)
    return {
      active: mine.reduce((sum, it) => sum + it.activeMinutes, 0),
      wait: mine.reduce((sum, it) => sum + it.waitMinutes, 0),
    }
  }
  const bothCounted = (steps, stepNumber) => {
    const x = stepTotals(steps, stepNumber)
    return x.active > 0 && x.wait > 0
  }

  // ---- 手作業のあとに待ちが続く書き方（利用者が挙げた「10分おく」型）----
  // どれも実際に登録されているレシピの本文（URL取込・貼り付け・同梱）から取っている。
  // 分数欄は取り込み経路が本文から埋めるので、実機と同じ「埋まっている形」で見る
  for (const [label, step] of [
    ['「火を止め、そのまま10分おいて味を含ませます」（URL取込）', t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10)],
    ['「火を止め、そのまま10分おいて味を含ませる」（貼り付け）', t('火を止め、そのまま10分おいて味を含ませる', 10)],
    ['「火を止めてそのまま10分おき、味をしみ込ませる」（同梱）', t('火を止めてそのまま10分おき、味をしみ込ませる。', 10)],
    ['「もみ込んで15分おきます」（分数が本文にある）', t('ポリ袋に鶏むね肉としょうゆ、酒を入れてもみ込み、15分おきます。', 15)],
  ]) {
    eq(`GR-1 手作業と待ちの両方が段取りに出る: ${label}`, bothCounted([step]), true)
  }

  // ---- 待ちは1分も減らさない（割ったせいで待ちが短くなっていないか）----
  for (const step of [
    t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10),
    t('火を止めてそのまま10分おき、味をしみ込ませる。', 10),
    t('ポリ袋に鶏むね肉としょうゆ、酒を入れてもみ込み、15分おきます。', 15),
  ]) {
    eq(
      `GR-3 割っても待ちの分数は減らない（${step.text.slice(0, 14)}）`,
      stepTotals([step]).wait >= step.minutes,
      true,
    )
  }

  /**
   * まだ両方を数えられていない書き方（2026-08-15 便GR。**実測して見送った**ので記録だけ残す）。
   * ここをテストにすると「直っていないこと」を固定してしまうので、assert は置かない。
   *
   *   (a)「火を止めて、そのまま冷ましながら味を含ませます」「煮汁がなくなったら火を止め、そのまま冷ます」
   *       … 冷ます時間は動詞から読めない（5分のことも1時間のこともある）。
   *       既定分数を当てると N2（温かい品と汁物の放置）が53分→69分・N1が33.7%→37.5%に悪化した
   *   (b)「鍋に◯◯を入れて中火にかけ、煮立ったら△△を加えて3分ほど煮る」
   *       … 前半で火がつく形。割ると口をふさぐ時間が前半のぶん伸び、
   *       コンロ1口の家で理論下限を割る段取り（E5'-b）が1件出た
   */

  // ---- 危険側（S1）を増やさない: 手を動かし続ける工程に待ちを作らない ----
  for (const [label, step] of [
    ['たれを絡めながら煮からめる（焦げやすい）', t('しょうゆ・みりん・砂糖を加え、たれを絡めながら照りが出るまで煮からめる。', 2)],
    ['フライパンで炒める', t('フライパンに油を熱し、豚肉を色が変わるまで3分炒める。', 3)],
    ['煮立つ直前で火を止める', t('弱火にしてみそを溶き入れ、煮立つ直前で火を止めます。')],
    // 「弱火にかけ」のあとも鍋の前にいる工程（香りが立つまで＝目を離せない）。
    // 火にかける言い回しを合図に待ちを作ると、ここでフライパンから目を離させる
    ['弱火にかけて香りを立たせてから炒める', t('鍋にオリーブオイルとにんにくを入れて弱火にかけ、香りが立ったら玉ねぎとにんじんを加えてしんなりするまで炒めます。')],
  ]) {
    eq(`GR-4 手を動かし続ける工程に待ちを作らない: ${label}`, stepTotals([step]).wait, 0)
  }

  // ---- 割ったあとも「いまやる1手順」として読める（docs/69 の不変条件）----
  {
    const steps = [
      t('鍋にサラダ油を熱し、豚バラ薄切り肉を色が変わるまで炒めます。'),
      t('ふたをずらしてのせ、弱めの中火で20分煮ます。', 20),
      t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10),
      t('器に盛りつけて出来上がりです。'),
    ]
    const items = buildCookTimeline([{ id: 1, title: '豚肉と大根の煮もの', steps }]).items
    const mine = items.filter((it) => (it.splitOf ?? it.stepNumber) === 3)
    // 照合の前にゼロ幅スペースを外す（禁じ手②。BudouXが本文に差し込むので includes が外れる）
    const plainText = (text) => (text ?? '').replaceAll('​', '').trim()
    eq(
      'GR-5 割った工程はどれもレシピ本文の一部だけを持つ（本文を書き足していない）',
      mine.length > 0 && mine.every((it) => plainText(steps[2].text).includes(plainText(it.text))),
      true,
    )
    eq('GR-5 割った工程は別々の識別子を持つ（「次へ」が同じ手順に戻らない）', new Set(mine.map((it) => it.stepIndex)).size, mine.length)
    // 手作業が先・待ちが後ろ（タイマーは待ちの工程にしか出ない＝手を動かす前に押せない）
    const waits = mine.filter((it) => it.kind === 'wait')
    const actives = mine.filter((it) => it.kind === 'active')
    eq('GR-5 タイマーは待ちの工程だけに出る', actives.every((it) => !showsWaitTimerButton(it)), true)
    eq('GR-5 待ちは手作業より後ろから始まる', waits.every((w) => actives.every((a) => w.startMin >= a.startMin)), true)
    // 番号は「3-1」「3-2」…（湯沸かしの切り出しと同じ見せ方）
    eq(
      'GR-5 割った工程の番号は元の手順番号から枝分かれする',
      mine.length > 1 ? mine.every((it) => recipeStepLabel(it).startsWith('3')) : true,
      true,
    )
  }
}

// ---------- 便GV-1: 検索窓に「主菜」「副菜」と打っても絞り込めない(2026-08-15 オーナー実機) ----------
// 原因: buildSearchWords が作る検索語は 料理名+主な材料+タグ+検索キーワード+手順の調理器具 で、
// 料理の種別(Recipe.dishType)が入っていなかった。絞り込みの「料理の種別」チップには
// 前からあるので、検索窓に打った人だけが0件に落ちていた。
// 測るのは「絞り込みチップと同じ言葉を検索窓に打てば同じ集合が出るか」。
{
  const soboro = { title: '鶏そぼろ丼', ingredients: [{ name: '鶏ひき肉', amount: '200', unit: 'g' }], tags: [] }
  const mainWords = buildSearchWords(soboro.title, soboro.ingredients, soboro.tags, undefined, undefined, 'main')
  eq('GV-1 主菜のレシピは「主菜」で引ける', mainWords.includes('主菜'), true)
  eq('GV-1 主菜のレシピは読み「しゅさい」でも引ける', mainWords.includes('しゅさい'), true)

  const ohitashi = { title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草', amount: '1', unit: '束' }], tags: [] }
  const sideWords = buildSearchWords(ohitashi.title, ohitashi.ingredients, ohitashi.tags, undefined, undefined, 'side')
  eq('GV-1 副菜のレシピは「副菜」で引ける', sideWords.includes('副菜'), true)
  eq('GV-1 副菜のレシピは読み「ふくさい」でも引ける', sideWords.includes('ふくさい'), true)
  eq('GV-1 副菜のレシピは「主菜」では引けない(種別の絞り込みと食い違わせない)', sideWords.includes('主菜'), false)

  const misoshiru = { title: '豆腐とわかめの味噌汁', ingredients: [{ name: '豆腐', amount: '1/2', unit: '丁' }], tags: [] }
  const soupWords = buildSearchWords(misoshiru.title, misoshiru.ingredients, misoshiru.tags, undefined, undefined, 'soup')
  eq('GV-1 汁物のレシピは「汁物」で引ける', soupWords.includes('汁物'), true)
  eq('GV-1 汁物のレシピは読み「しるもの」でも引ける', soupWords.includes('しるもの'), true)

  const daigakuimo = { title: '大学芋', ingredients: [{ name: 'さつまいも', amount: '2', unit: '本' }], tags: [] }
  const dessertWords = buildSearchWords(daigakuimo.title, daigakuimo.ingredients, daigakuimo.tags, undefined, undefined, 'dessert')
  eq('GV-1 その他のレシピは「その他」で引ける', dessertWords.includes('その他'), true)

  // 種別が未設定のレシピ(主にユーザー自作)も、絞り込みチップと同じ推定(dishTypeGuess)に倒す。
  // ここがずれると「絞り込みでは副菜に出るのに、検索窓の『副菜』では出ない」が起きる
  const guessed = buildSearchWords(misoshiru.title, misoshiru.ingredients, misoshiru.tags)
  eq('GV-1 種別が未設定でも推定した種別で引ける(絞り込みチップと同じ判定)', guessed.includes('汁物'), true)

  // 絞り込みチップの名前(ja.dishType)と検索語がずれると、打っても0件のままになる。
  // 文言を変えたらここが赤くなる＝索引の作り直し(SEARCH_INDEX_VERSION)を忘れないための歯止め
  for (const [type, label] of Object.entries(ja.dishType)) {
    const words = buildSearchWords('テスト料理', [{ name: '鶏もも肉', amount: '1', unit: '枚' }], [], undefined, undefined, type)
    eq(`GV-1 絞り込みチップ「${label}」と同じ言葉で検索できる`, words.includes(label), true)
  }

  // 広げすぎない: 「メイン」「おかず」「スープ」等の言い換えは入れない(誤ヒットが増えるため)。
  // 入れた語を増やすときは、この行も一緒に見直すこと
  eq('GV-1 種別の言い換え(メイン)は検索語に入れない', mainWords.some((w) => w.includes('めいん')), false)
  eq('GV-1 種別の言い換え(おかず)は検索語に入れない', mainWords.some((w) => w.includes('おかず')), false)
  eq('GV-1 種別の言い換え(スープ)は検索語に入れない', soupWords.some((w) => w.includes('すーぷ')), false)

  // 既に登録済みのレシピにも効かせるには索引の作り直しが要る(db/recipes.ts rebuildSearchWordsIfNeeded)。
  // 版を上げ忘れると、新規登録したレシピでしか「主菜」で引けない
  eq(
    'GV-1 種別を足す前(v3)に保存された検索語は起動時に作り直される',
    searchIndexNeedsRebuild({ ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: 3 }),
    true,
  )
  eq(
    'GV-1 いまの版で保存済みなら作り直さない(毎回作り直して起動が重くならない)',
    searchIndexNeedsRebuild({ ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: SEARCH_INDEX_VERSION }),
    false,
  )
}

// ---------- 便GV-2: ファイルの大きさの表し方 ----------
{
  eq('GV-2 1KB未満はバイトで出す', formatFileSize(512), '512B')
  eq('GV-2 1KB以上はKBで出す(小数は出さない)', formatFileSize(1024 * 128 + 400), '128KB')
  eq('GV-2 1MB以上はMBで小数第1位まで出す', formatFileSize(1024 * 1024 * 1.53), '1.5MB')
  eq('GV-2 ちょうど1MBは1.0MBではなく1MB', formatFileSize(1024 * 1024), '1MB')
  eq('GV-2 0バイトでも壊れない', formatFileSize(0), '0B')
}

// ---------- 便GV-3: レシピの書き出しの確認(2026-08-15 オーナー実機「文章が長い。
// 箇条書きや太字で読みやすくして。ファイルのサイズも書いてあると親切」) ----------
// 素のダイアログ(window.confirm)では太字も箇条書きも出せないので、画面の中の窓
// (ConfirmDialog)に置き換える。ここでは窓に流し込む中身(純ロジック)を測る。
{
  // 素のダイアログのままだった旧確認文の文字数(改行込み240字。r=3・rest=106のとき)。
  // 「箇条書きにしただけで行数が増えては逆効果」なので、読む量そのものを減らせたかを測る。
  // 実測の基準値なので、確認の中身を意図的に増やすとき以外はこの数字を上げないこと
  const OLD_CONFIRM_LENGTH = 240
  const picked = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: true,
  })
  eq('GV-3 ファイルの大きさを実測値で出す', picked.bullets.some((b) => b.text.includes('128KB')), true)
  eq(
    'GV-3 保存先を選べる端末では選べると書く',
    picked.bullets.find((b) => b.label === '保存先')?.text.includes('選べます'),
    true,
  )
  // 保存先を選べない端末(iPhone・iPad・Firefox等)で「選べます」と書かない
  const downloaded = buildSelectedRecipesExportConfirm({
    selected: 3,
    remaining: 106,
    bytes: 1024 * 128,
    canPickLocation: false,
  })
  const dlSaveTo = downloaded.bullets.find((b) => b.label === '保存先')?.text ?? ''
  eq('GV-3 保存先を選べない端末で「選べます」と書かない', dlSaveTo.includes('選べます'), false)
  eq('GV-3 保存先を選べない端末では入る場所を書く', dlSaveTo.includes('ダウンロード'), true)

  const newLength = [picked.title, ...picked.bullets.map((b) => `${b.label}: ${b.text}`), ...picked.notes].join('\n')
    .length
  eq('GV-3 素のダイアログのときより読む量が減っている', newLength < OLD_CONFIRM_LENGTH, true)
}

// ---------- 便GW: 確認の窓をアプリ全体で1つの見た目にそろえる ----------
// オーナー原文「アプリ全体に、確認などで表示される窓が見づらく、見ていて楽しくなる画面じゃない。
// 事実を的確に伝えるのも重要。見やすさも重要」／利用者テスト「アプリの中で急に素のポップアップが
// 出るのは違和感があります」。素のダイアログ(window.confirm)は文字しか出せず、太字も箇条書きも
// 作れないので、画面の中の窓(components/ConfirmDialog)へ全件移した。
//
// ここで測るのは「あとから素のダイアログに戻る事故」を防ぐことの1点。
// 置き場所や件数ではなく**src全体に1つも無いこと**を見るので、画面が増えても勝手に守られる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  /**
   * 素のダイアログを残してよい場所（残すと決めたものは理由つきでここに書く）。
   * いまは1つも無い。増やすときは「なぜ画面の中の窓にできないか」を必ず添えること
   */
  const RAW_DIALOG_ALLOWLIST = new Map()
  const collectSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...collectSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  const offenders = []
  for (const full of collectSources(path.join(appRoot, 'src'))) {
    const rel = path.relative(appRoot, full).split(path.sep).join('/')
    const lines = readFileSync(full, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      // 説明のためにコメントへ書いた「window.confirm」は対象外(行頭が // や * のもの)
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      if (!/window\.(confirm|prompt)\s*\(/.test(line)) return
      if (RAW_DIALOG_ALLOWLIST.has(rel)) return
      offenders.push(`${rel}:${i + 1}`)
    })
  }
  eq('GW-1 素のダイアログ(window.confirm/prompt)がsrcに1つも残っていない', offenders, [])

  // 規約F「『よろしいですか？』だけは禁止」。窓になった今は、何をするかは見出しが、
  // 実行するかどうかは動詞のボタンが受け持つので、本文の末尾に置く定型句は要らなくなった。
  // ja.ts の値を丸ごと見るので、新しい確認文で書き足しても引っかかる
  const jaTexts = []
  const walkJa = (node) => {
    if (typeof node === 'string') jaTexts.push(node)
    else if (Array.isArray(node)) node.forEach(walkJa)
    else if (node && typeof node === 'object') Object.values(node).forEach(walkJa)
  }
  walkJa(ja)
  // BudouXのゼロ幅スペースが混じっても外れないよう、照合前に外す(禁じ手②)
  const stripZeroWidth = (text) => text.replaceAll('​', '')
  eq(
    'GW-2 UI文言に「よろしいですか」で終わる確認文が残っていない',
    jaTexts.filter((text) => stripZeroWidth(text).includes('よろしいですか')),
    [],
  )
}

// ---------- 読み上げの段取り(logic/speechEngine.ts): 2026-08-16 便GY・オーナー実機 ----------
// iPhone SE2/Safari「読み上げは、2-3回ONOFF繰り返し押さないと音が出ない気がします」。
// ブラウザの読み上げ（speechSynthesis）は、①取り消しの直後に話し始めると発話が捨てられる
// ②一時停止（paused）のまま残ると speak しても鳴らない ③声の一覧が後から届く、という癖がある。
// 実機が手元に無いので、speechSynthesis を差し替えて「呼ぶ順番」を固定する。
{
  const { createSpeechEngine } = await import('../src/logic/speechEngine.ts')

  /** 読み上げエンジンの替え玉。呼ばれた順番と、渡された発話を覚える */
  const makeSynth = (voices = []) => {
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      voices,
      calls: [],
      spoken: [],
      speak(utterance) {
        synth.calls.push('speak')
        synth.spoken.push(utterance)
      },
      cancel() {
        synth.calls.push('cancel')
        synth.speaking = false
        synth.pending = false
      },
      resume() {
        synth.calls.push('resume')
        synth.paused = false
      },
      getVoices: () => synth.voices,
    }
    return synth
  }

  /** 待ち時間の替え玉。何ミリ秒かは測らず、「待ちに入ったか」「消化したか」だけを見る */
  const makeClock = () => {
    let nextId = 0
    const waits = new Map()
    return {
      setTimer(fn) {
        const id = ++nextId
        waits.set(id, fn)
        return id
      },
      clearTimer(id) {
        waits.delete(id)
      },
      /** いちばん古い待ちを1つだけ消化する。消化できたら true */
      runNext() {
        const entry = waits.entries().next()
        if (entry.done) return false
        waits.delete(entry.value[0])
        entry.value[1]()
        return true
      },
      /** 待ちが無くなるまで消化する（上限は暴走よけの保険。回数そのものは測らない） */
      runAll() {
        for (let guard = 0; guard < 50; guard++) {
          if (!this.runNext()) return
        }
      },
    }
  }

  const makeEngine = (synth, clock) => {
    const events = { speaking: [], notStarted: 0 }
    const engine = createSpeechEngine({
      synth,
      createUtterance: (text) => ({
        text,
        lang: '',
        voice: null,
        onstart: null,
        onend: null,
        onerror: null,
      }),
      setTimer: (fn) => clock.setTimer(fn),
      clearTimer: (handle) => clock.clearTimer(handle),
      onSpeakingChange: (value) => events.speaking.push(value),
      onNotStarted: () => {
        events.notStarted++
      },
    })
    return { engine, events }
  }

  // SPEAK-01: 何も鳴っていないのに毎回 cancel してから speak していた。
  // iOS/Safari はこの並びで発話を捨てることがある＝押しても鳴らない1回目になる
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('玉ねぎを炒める')
    eq(
      'SPEAK-01 何も鳴っていないときは取り消しを挟まずに読み上げを始める',
      synth.calls.filter((c) => c === 'cancel'),
      [],
    )
    eq('SPEAK-01 待たずにその場で発話を渡す(押した操作の流れを切らない)', synth.spoken.length, 1)
  }

  // SPEAK-02: 読み上げ中に読み直すときは取り消しが要る。ただし取り消しの直後に続けて
  // 話し始めない（間を置く）。同じ流れの中で cancel→speak と並べるのが捨てられる形
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    synth.speaking = true
    const spokenBefore = synth.spoken.length
    engine.speak('ふたつ目')
    eq(
      'SPEAK-02 読み上げ中の読み直しは、取り消しの直後に続けて話し始めない',
      synth.calls[synth.calls.length - 1],
      'cancel',
    )
    eq('SPEAK-02 間を置くまで次の発話は渡らない', synth.spoken.length, spokenBefore)
    clock.runNext()
    eq('SPEAK-02 間を置いたあとに読み上げが始まる', synth.spoken.length > spokenBefore, true)
  }

  // SPEAK-03: 一時停止（paused）のまま残っていると、speak しても鳴らない。
  // 読み上げの前に必ず動かし直す
  {
    const synth = makeSynth()
    synth.paused = true
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('鍋を火にかける')
    const resumedAt = synth.calls.indexOf('resume')
    const spokeAt = synth.calls.indexOf('speak')
    eq(
      'SPEAK-03 一時停止のまま残っていたら、読み上げの前に動かし直す',
      resumedAt !== -1 && resumedAt < spokeAt,
      true,
    )
  }

  // SPEAK-04: 声の一覧は後から届く（iOS/Safari は最初の呼び出しで空のことがある）。
  // 空でも黙り込まず、届いたら日本語の声を使い、そのあと空を返されても使い続ける
  {
    const jaVoice = { lang: 'ja-JP' }
    const enVoice = { lang: 'en-US' }
    const synth = makeSynth([])
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('声がまだ届いていない')
    eq('SPEAK-04 声の一覧が空でも読み上げを遅らせない', synth.spoken.length, 1)
    synth.voices = [enVoice, jaVoice]
    engine.speak('声が届いたあと')
    eq(
      'SPEAK-04 声が届いたら日本語の声を選ぶ',
      synth.spoken[synth.spoken.length - 1].voice,
      jaVoice,
    )
    synth.voices = []
    engine.speak('また空を返された')
    eq(
      'SPEAK-04 一度読み込めた声は、一覧が空を返しても使い続ける',
      synth.spoken[synth.spoken.length - 1].voice,
      jaVoice,
    )
  }

  // SPEAK-05: speak が無視されたときは onerror も来ない＝黙って終わってしまう。
  // 始まった合図が来ないまま時間が過ぎたら、言い直したうえで手応えを画面に返す
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('鳴らないことがある手順')
    const spokenBefore = synth.spoken.length
    clock.runAll()
    eq('SPEAK-05 諦める前に言い直す', synth.spoken.length > spokenBefore, true)
    eq('SPEAK-05 それでも始まらなければ、鳴らなかったことを画面に返す', events.notStarted > 0, true)
    eq(
      'SPEAK-05 読み上げ中の表示のまま残さない(次に押すと止めるだけになる)',
      events.speaking[events.speaking.length - 1],
      false,
    )
  }

  // SPEAK-06: 「読み上げストップ」（2026-08-15 便GS）を壊さない。
  // 間を置いて待っている発話も取り消す＝止めたのに後から鳴り出さない
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    synth.speaking = true
    engine.speak('ふたつ目')
    engine.stop()
    const spokenAtStop = synth.spoken.length
    clock.runAll()
    eq('SPEAK-06 読み上げストップは取り消しを呼ぶ', synth.calls.includes('cancel'), true)
    eq('SPEAK-06 待っていた発話は取り消され、後から鳴り出さない', synth.spoken.length, spokenAtStop)
    eq(
      'SPEAK-06 止めたあとは読み上げ中の表示にしない',
      events.speaking[events.speaking.length - 1],
      false,
    )
  }

  // SPEAK-07: 取り消した発話の終了通知は後から届く。これを新しい発話のものとして扱うと、
  // 鳴っているのにボタンが「読み上げ」に戻り、次に押すと読み直しになる（押す回数が増える）
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    const first = synth.spoken[0]
    synth.speaking = true
    engine.speak('ふたつ目')
    clock.runNext()
    const second = synth.spoken[synth.spoken.length - 1]
    second.onstart?.()
    synth.speaking = true
    first.onerror?.()
    first.onend?.()
    eq(
      'SPEAK-07 取り消した発話の終了通知で、いまの読み上げ中の表示が消えない',
      events.speaking[events.speaking.length - 1],
      true,
    )
  }

  // SPEAK-08(便HD): 1回目の読み上げは、読み上げたい文だけをその場でブラウザへ渡す。
  //
  // オーナー実機 iPhone SE2/Safari「読み上げ1回目からなりましたが、1回目のみ音の出だしが
  // ワンテンポ遅かったのが気になりました」。出だしの遅れはブラウザ側の読み上げの立ち上がりで、
  // アプリ側の下ごしらえ(用語辞書の読み替え)は便HDの実測で1回目0.79ms・2回目以降0.06ms＝
  // 耳で分かる差にならない。
  //
  // 「無音の発話を先に1回通して温める」案は**採らなかった**（理由は便HDの報告に記載）。
  // ここで固定するのは、そのぶん**読み上げの前に何も割り込ませない**こと。
  // 先に別の発話を積むと、ブラウザに渡る順番が変わり、待ち行列に入ったぶん
  // かえって1回目が遅くなる（この読み上げの段取りは speaking/pending を見て
  // 「読み直し」と判断し、取り消し＋間を置く道へ入る）。
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('玉ねぎをくし形に切る')
    eq(
      'SPEAK-08 1回目にブラウザへ渡るのは、読み上げたい文だけ(温めの発話を先に挟まない)',
      synth.spoken.map((u) => u.text),
      ['玉ねぎをくし形に切る'],
    )
    eq(
      'SPEAK-08 1回目は待ちを挟まずその場で渡す(押してから鳴るまでを長くしない)',
      synth.calls,
      ['speak'],
    )
  }
}

// ---------- 便GY-2: マナーモードでのタイマー音（2026-08-16 オーナー実機確認） ----------
// 「タイマー音はマナーモードではなりません。オフラインでもタイマー動作の挙動は同じであることを確認」。
// iPhoneでは ①タイマー音が鳴らない ②Safariに振動の仕組みが無い が重なるので、
// マナーモード中は終わりに気づく手段が画面だけになる。
// 設定の注記は「タイマーの終了は音でお知らせします」と言い切っていて、そのままでは嘘になる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const mentionsSilentMode = (text) => text.includes('マナーモード') || text.includes('消音')
  eq(
    'GY-2 振動非対応の注記が「音でお知らせします」で言い切っていない(マナーモードでは鳴らない)',
    mentionsSilentMode(ja.settings.timerVibrationUnsupportedNote),
    true,
  )

  const manual = readFileSync(path.join(appRoot, 'public/about/manual.html'), 'utf-8')
  eq(
    'GY-2 使い方ページに「マナーモードではタイマー音が鳴らない」ことが書かれている',
    manual.split(/[。\n]/).some((s) => mentionsSilentMode(s) && s.includes('タイマー音')),
    true,
  )

  // オフラインの節（見出しのidで掴む＝並び順が変わっても外れない）に、
  // タイマーの挙動が電波のあるときと変わらないことが書かれているか
  const offlineStart = manual.indexOf('id="offline"')
  const offlineSection = manual.slice(offlineStart, manual.indexOf('<h3', offlineStart + 1))
  eq(
    'GY-2 オフラインの節に、タイマーの動きが電波のあるときと同じだと書かれている',
    offlineSection
      .split('\n')
      .some((line) => line.includes('タイマー') && (line.includes('同じ') || line.includes('変わ'))),
    true,
  )
}

// --- タイマーの調整を開く読み上げ名（2026-08-16）。自分で時間を決めたタイマーは名前が
//     そのまま「タイマー」なので、素直に当てはめると「タイマーのタイマーを調整」になっていた ---
{
  const { timerAdjustAria } = await import('../src/logic/timerOrder.ts')
  const T = '{label}のタイマーを調整'
  eq('TIMERARIA-1 自分で決めたタイマーは名前を重ねない', timerAdjustAria('タイマー', T, 'タイマー'), 'タイマーを調整')
  eq('TIMERARIA-2 手順のタイマーは今までどおり名前を読む', timerAdjustAria('肉じゃが', T, 'タイマー'), '肉じゃがのタイマーを調整')
  eq('TIMERARIA-3 名前が空でも読める形にする', timerAdjustAria('', T, 'タイマー'), 'タイマーを調整')
  eq(
    'TIMERARIA-4 手順つきの名前も今までどおり',
    timerAdjustAria('肉じゃが・手順⑨（1-2）', T, 'タイマー'),
    '肉じゃが・手順⑨（1-2）のタイマーを調整',
  )
}

// ==========================================================================================
// 便HA: 「鍋から離れない一手」は割らない（docs/68 の裁定・2026-08-16）
//
// 何が起きていたか: N4（混在手順の両方計上）の**分母**に、割ってはいけない手順が入っていた。
// 監査の `isMixedStep` が「手作業の語が待ちの語より前にある」だけで混在と判定するため、
// 「弱火にしてみそを溶き入れ、煮立つ直前で火を止めます」のような**鍋の前を離れられない一手**まで
// 「手作業と待ちが同居している＝割れるはずなのに割れていない」と数えていた。
// **アプリは正しく動いているのに不合格と数えていた**ので、線（90%）は動かさず分母だけを直した。
//
// ここで固定するのは2つ。
//   ① 監査が、これらの手順を分母に入れない（＝測り方の回帰）
//   ② アプリが、これらの手順で**待ちを作らない**（＝利用者が確かめたいこと。
//      待ちを作った瞬間、ナビは「その間に別の料理をどうぞ」と鍋から目を離させる）
// 本文はすべて**実際の標本のもの**（URL取込・貼り付け・同梱）をそのまま使う。
// ==========================================================================================
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  /** 割ってはいけない手順（分母から外した5件＋同梱の同型2件）。ラベルは「なぜ離れられないか」 */
  const notSplittable = [
    ['煮立つ瞬間を見て火を落とす（URL取込・みそ汁）', t('弱火にしてみそを溶き入れ、煮立つ直前で火を止めます。')],
    ['同（ホールドアウト・豚汁）', t('火を弱めてみそを溶き入れ、長ねぎを加えてひと煮したら火を止めます。')],
    ['同（同梱・豆腐とわかめの味噌汁）', t('火を弱めて味噌を溶き入れ、煮立たせる前に火を止める。')],
    ['油と香味野菜の香りを立てる（URL取込・ミートソース）', t('鍋にオリーブオイルとにんにくを入れて弱火にかけ、香りが立ったら玉ねぎとにんじんを加えてしんなりするまで炒めます。')],
    ['同（同梱・回鍋肉）', t('フライパンにサラダ油とにんにくを入れて中火にかけ、香りが立ったら豚肉を炒める。')],
    ['「煮詰めたたれ」は完了の連体修飾（貼り付け・煮豚）', t('食べやすい厚さに切り、煮汁を煮詰めたたれをかけていただきます。')],
    ['「ゆで汁は取っておくとよい」は助言（貼り付け・ゆで鶏）', t('鍋から取り出して薄切りにし、器に盛ります。ゆで汁はスープに使えるので取っておくとよいです。')],
  ]
  for (const [label, step] of notSplittable) {
    // ① 測る側: 分母から外す理由が付いている（理由の文面ではなく「理由が有ること」で見る）
    eq(`HA-1 N4の分母から外す: ${label}`, notSplittableReason(step) != null, true)
    eq(`HA-1 分母に入っていない: ${label}`, isMixedStep(step), false)
    // ② アプリ側: この手順から待ちが生まれない（何工程に割れても待ちの合計が0分）
    eq(`HA-2 アプリが待ちを作らない: ${label}`, classifyStep(step), 'active')
    eq(`HA-2 割らない（手作業→待ち）: ${label}`, splitMixedStep(step), undefined)
    eq(`HA-2 割らない（待ち→手作業）: ${label}`, splitWaitFirstStep(step), undefined)
    const items = buildCookTimeline([{ id: 1, title: '検査用', steps: [step] }]).items
    eq(
      `HA-2 段取りに待ちが1分も出ない: ${label}`,
      items.reduce((sum, it) => sum + it.waitMinutes, 0),
      0,
    )
  }

  // ---- 外しすぎていないことの歯止め（ここが崩れると「線を緩めた」のと同じになる）----
  // 同じ「煮立ったら火を止める」でも、**その手順の中で冷たい鍋に火をつけている**ものは
  // 沸くまでの待ちが本当にあるので分母に残す。規則の分かれ目そのもの。
  const keptInDenominator = [
    ['冷たいだし汁から沸かす（同梱・梅おろしぶっかけうどん）', t('小鍋にだし汁・しょうゆ・みりんを入れて中火にかけ、煮立ったら火を止める。')],
    ['火にかけて沸くのを待つ（URL取込・みそ汁）', t('鍋にだし汁を入れて火にかけ、煮立ったら木綿豆腐とわかめを加えます。')],
    ['火を止めたあとに本物の待ちが続く（URL取込・豚肉と大根の煮もの）', t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10)],
    ['冷ましながら味を含ませる（URL取込・かぼちゃの煮つけ）', t('火を止めて、そのまま冷ましながら味を含ませます。')],
    ['答え合わせが「本当にある待ち」と言っている二度揚げ（URL取込・から揚げ）', t('一度取り出して2分休ませ、油の温度を上げてもう1分揚げます。', 2)],
  ]
  for (const [label, step] of keptInDenominator) {
    eq(`HA-3 分母に残す（外しすぎない）: ${label}`, isMixedStep(step), true)
    eq(`HA-3 外す理由が付かない: ${label}`, notSplittableReason(step), null)
  }

  // 分母から外した件数は**毎回の監査の表に出す**（隠さない）。列があること自体を固定する
  {
    const scriptsDir = path.dirname(fileURLToPath(import.meta.url))
    const auditSource = readFileSync(path.join(scriptsDir, 'audit-cook-navi.mjs'), 'utf-8')
    eq(
      'HA-4 監査の表に「分母から外した」件数の列がある（外した数を隠さない）',
      auditSource.includes('分母から外した'),
      true,
    )
  }
}

// ---------- 便GZ: レシピを削除しても「作った記録」が残る(2026-08-16 オーナー承認) ----------
// オーナーの求めた形:
//  ①レシピを削除したらカードも詳細画面も無くなる ②記録は残り、内容も写真も見られる
//  ③記録からレシピ詳細へは行けない ④書き出したファイルから同じレシピを入れ直すとつながりが戻る
// オーナーの懸念は「似た名前の違うレシピとつながってしまいそう」。ここは**名前で結ばない**ことを固定する。
{
  const log = (date, note, photo) => ({
    date,
    ...(note ? { note } : {}),
    ...(photo ? { photo: { size: photo } } : {}),
  })

  // --- 印(uid)の決め方 ---
  eq('GZ-UID 基本レシピの印は料理名から決まる', starterRecipeUid('肉じゃが'), 'starter:肉じゃが')
  eq('GZ-UID 前後の空白は印に含めない', starterRecipeUid(' 肉じゃが '), 'starter:肉じゃが')
  eq('GZ-UID 基本レシピの印は見分けが付く', isStarterUid(starterRecipeUid('肉じゃが')), true)
  neq('GZ-UID 乱数の印は毎回違う', newRecipeUid(), newRecipeUid())
  eq('GZ-UID 乱数の印は基本レシピの印と形が違う', isStarterUid(newRecipeUid()), false)

  // 後から印を振る(移行)。印を持っている品は触らない・基本レシピだけ料理名由来の印になる
  {
    let n = 0
    const makeUid = () => `rnd-${++n}`
    const plan = planRecipeUidBackfill(
      [
        { id: 1, title: '肉じゃが', isStarter: true },
        { id: 2, title: '肉じゃが', isStarter: false }, // 自分で登録した同名レシピ
        { id: 3, title: '高たんぱく品A', isStarter: true, sourceSetId: 'kintore' },
        { id: 4, title: '既に印あり', uid: 'keep-me' },
      ],
      new Set(['肉じゃが']),
      makeUid,
    )
    eq('GZ-移行 印の無い品だけに振る', plan.length, 3)
    eq('GZ-移行 基本レシピは料理名由来の印', plan.find((p) => p.id === 1).uid, 'starter:肉じゃが')
    // ここがオーナーの懸念そのもの: 同じ料理名でも、自作レシピは基本レシピと別の印になる
    eq('GZ-移行 同名の自作レシピは乱数の印(基本レシピと同じ印にしない)', plan.find((p) => p.id === 2).uid, 'rnd-1')
    eq('GZ-移行 配布セット由来は乱数の印', plan.find((p) => p.id === 3).uid, 'rnd-2')
    eq('GZ-移行 既に印がある品は作り直さない', plan.some((p) => p.id === 4), false)
    // 印は二度と重ならない(重なると結び直しの相手が一意に決まらない)
    eq('GZ-移行 振った印に重複が無い', new Set(plan.map((p) => p.uid)).size, plan.length)
  }
  {
    // 既に他の品が同じ料理名由来の印を使っていたら、乱数に落とす(重複を作らない)
    const plan = planRecipeUidBackfill(
      [
        { id: 1, title: 'カレー', uid: 'starter:カレー' },
        { id: 2, title: 'カレー', isStarter: true },
      ],
      new Set(['カレー']),
      () => 'rnd-x',
    )
    eq('GZ-移行 印がぶつかるときは乱数に落とす', plan[0].uid, 'rnd-x')
  }

  // --- 削除で残すまとまりの作り方 ---
  {
    const recipe = {
      uid: 'u-1',
      title: '肉じゃが',
      iconKey: 'meat',
      servings: 2,
      cookedLogs: [log('2026-08-01'), log('2026-08-03', 'おいしくできた', 10)],
    }
    const record = buildDetachedRecord(recipe, 1000)
    eq('GZ-削除 印を写して残す', record.recipeUid, 'u-1')
    eq('GZ-削除 料理名を写して残す(表示用。照合には使わない)', record.title, '肉じゃが')
    eq('GZ-削除 記録は日付の新しい順に並べる', record.logs.map((l) => l.date), ['2026-08-03', '2026-08-01'])
    eq('GZ-削除 写真も一緒に残る', record.logs[0].photo.size, 10)
    eq('GZ-削除 ひとことメモも残る', record.logs[0].note, 'おいしくできた')
    eq(
      'GZ-削除 記録が1件も無いレシピはまとまりを作らない',
      buildDetachedRecord({ uid: 'u-2', title: 'から揚げ', servings: 2, cookedLogs: [] }),
      null,
    )
  }

  // --- 結び直し(オーナーの④と懸念) ---
  {
    const records = [
      { id: 1, recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01'), log('2026-08-02')], detachedAt: 1 },
      { id: 2, recipeUid: 'u-2', title: 'カレー', logs: [log('2026-07-01')], detachedAt: 1 },
      { id: 3, title: '印の無い記録', logs: [log('2026-06-01')], detachedAt: 1 },
    ]
    // 「肉じゃが」という同じ料理名の別レシピ(印が違う)を入れ直しても結ばれてはいけない
    const recipes = [{ id: 10, uid: 'other-uid', cookedLogs: [] }]
    const noMatch = planDetachedReattach(records, recipes)
    eq('GZ-結び直し 料理名が同じでも印が違えば結ばない', noMatch.items.length, 0)
    eq('GZ-結び直し 結ばなかった記録は消えない(件数0)', noMatch.logsReattached, 0)

    // 印が一致するレシピが入り直したときだけ結ぶ
    const matched = planDetachedReattach(records, [
      { id: 10, uid: 'u-1', cookedLogs: [] },
      { id: 11, uid: 'other-uid', cookedLogs: [] },
    ])
    eq('GZ-結び直し 印が一致した1品だけ結ぶ', matched.items.length, 1)
    eq('GZ-結び直し 戻した記録の件数', matched.logsReattached, 2)
    eq('GZ-結び直し 戻し先のレシピ', matched.items[0].recipeId, 10)
    eq('GZ-結び直し 消すまとまりの番号', matched.items[0].recordId, 1)
    eq('GZ-結び直し 印の無い記録は結ばない', matched.items.some((i) => i.recordId === 3), false)

    // 同じ記録がレシピ側にもある場合は二重にしない(写真だけ埋める)
    const dup = planDetachedReattach(
      [{ id: 1, recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01', undefined, 5)], detachedAt: 1 }],
      [{ id: 10, uid: 'u-1', cookedLogs: [log('2026-08-01')] }],
    )
    eq('GZ-結び直し 同じ記録は二重に足さない', dup.logsReattached, 0)
    eq('GZ-結び直し 記録の件数は増えない', dup.items[0].cookedLogs.length, 1)
    eq('GZ-結び直し 欠けていた写真だけ埋める', dup.items[0].cookedLogs[0].photo.size, 5)
  }

  // --- まとまりの畳み込み(同じレシピを入れ直しては消す、を繰り返しても行が増えない) ---
  {
    const merged = mergeDetachedRecords([
      { recipeUid: 'u-1', title: '肉じゃが', logs: [log('2026-08-01')], detachedAt: 1 },
      { recipeUid: 'u-1', title: '肉じゃが（改）', logs: [log('2026-08-05')], detachedAt: 2 },
      { title: '印なし', logs: [log('2026-08-03')], detachedAt: 1 },
    ])
    eq('GZ-畳み込み 同じ印は1行にまとめる', merged.length, 2)
    eq('GZ-畳み込み 記録は両方残る', merged[0].logs.length, 2)
    eq('GZ-畳み込み 料理名は新しく消した方を採る', merged[0].title, '肉じゃが（改）')
    eq('GZ-畳み込み 印の無い行はまとめない', merged[1].title, '印なし')
  }

  // --- 画面へ渡す形(オーナーの③: レシピ詳細へ行けない) ---
  {
    const stub = detachedRecipeStub({
      id: 7,
      recipeUid: 'u-1',
      title: '肉じゃが',
      iconKey: 'meat',
      servings: 3,
      logs: [log('2026-08-01')],
      detachedAt: 1,
    })
    // レシピ番号を持たない＝小窓・カードがレシピ詳細への行き先を出さない経路に乗る
    eq('GZ-表示 レシピ番号を持たない(詳細画面へ行けない)', stub.id, undefined)
    eq('GZ-表示 料理名は出す', stub.title, '肉じゃが')
    eq('GZ-表示 アイコンは削除前のものを引き継ぐ', stub.iconKey, 'meat')
    eq('GZ-表示 記録はそのまま読める', stub.cookedLogs.length, 1)
    // 材料・手順は空にする＝栄養や食費の集計に「中身が0の料理」を混ぜないための歯止め
    eq('GZ-表示 材料は空(集計に混ぜない)', stub.ingredients.length, 0)
    eq('GZ-表示 手順は空', stub.steps.length, 0)
  }

  // --- 件数と容量 ---
  {
    const records = [
      { logs: [log('2026-08-01'), log('2026-08-02', undefined, 100)] },
      { logs: [log('2026-07-01', undefined, 50)] },
    ]
    eq('GZ-件数 残っている記録の件数', countDetachedLogs(records).logs, 3)
    eq('GZ-件数 そのうち写真つきの枚数', countDetachedLogs(records).photos, 2)
    eq('GZ-容量 写真の合計バイト数', detachedPhotoBytes(records), 150)
  }

  // --- 削除の確認文(規約F・オーナー指示「記録は残るに変わるはずなので文言も直す」) ---
  {
    const impact = summarizeRecipeDeleteImpact(
      [
        { isStarter: true, cookedLogs: [log('2026-08-01', undefined, 1), log('2026-08-02')] },
        { isStarter: false, cookedLogs: [log('2026-08-01', undefined, 1)] },
      ],
      { totalRecipes: 109, mealPlanEntries: 4, todayEntries: 2 },
    )
    const text = confirmContentText(buildBulkDeleteConfirm(impact))
    eq('GZ-確認文 記録は「残るもの」に件数つきで入る', /残るもの: 作った記録3件（うち写真2枚）/.test(text), true)
    eq('GZ-確認文 「消えるもの」に記録を書かない', /消えるもの: [^\n]*作った記録/.test(text), false)
    eq('GZ-確認文 消えるものはレシピの中身と献立', /消えるもの: [^\n]*材料・手順/.test(text), true)
    eq('GZ-確認文 献立の予定・今日の献立の数は残す', /献立の予定4[品件]・今日の献立2[品件]/.test(text), true)
    eq('GZ-確認文 記録がどこで読めるか書く', text.includes('作った記録の一覧'), true)
    eq('GZ-確認文 レシピ詳細へ行けなくなることを書く', text.includes('レシピ詳細へは行けなくなります'), true)
    eq('GZ-確認文 入れ直せば戻ることを書く', text.includes('読み込み直す'), true)
    eq('GZ-確認文 基本レシピは記録もつながり直すと書く', text.includes('作った記録もつながり直します'), true)
    eq('GZ-確認文 「よろしいですか？」だけで終わらせない', text.includes('よろしいですか'), false)

    // 記録が0件なら、残り方の説明は出さない(残らないものを「残ります」と言わない)
    const noLogs = summarizeRecipeDeleteImpact([{ isStarter: false, cookedLogs: [] }], {
      totalRecipes: 5,
      mealPlanEntries: 0,
      todayEntries: 0,
    })
    const noLogsText = confirmContentText(buildBulkDeleteConfirm(noLogs))
    eq('GZ-確認文 記録0件でも件数は明示する', /作った記録0件（うち写真0枚）/.test(noLogsText), true)
    eq('GZ-確認文 記録0件なら残り方の説明は出さない', noLogsText.includes('作った記録の一覧'), false)

    // 1品削除も同じ規則(2つの確認文が食い違わない)
    const single = confirmContentText(buildSingleDeleteConfirm({ cookedLogs: 2, photos: 1 }))
    eq('GZ-確認文 1品削除でも記録は残るものに入る', /残るもの: 作った記録2件（うち写真1枚）/.test(single), true)
    eq('GZ-確認文 1品削除でも消えるものに記録を書かない', /消えるもの: [^\n]*作った記録/.test(single), false)
    eq('GZ-確認文 1品削除でも記録の読み場所を書く', single.includes('作った記録の一覧'), true)
    eq(
      'GZ-確認文 1品削除で記録0件なら残り方の説明は出さない',
      confirmContentText(buildSingleDeleteConfirm({ cookedLogs: 0, photos: 0 })).includes('作った記録の一覧'),
      false,
    )
    eq('GZ-確認文 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(`${text}${single}`), false)
  }

  // --- バックアップ(古いファイルとの往復。オーナー指示「古いバックアップから戻せなくなるのは絶対に不可」) ---
  {
    const base = { app: 'uchi-recipe', version: 1, exportedAt: '', recipes: [] }
    eq(
      'GZ-バックアップ 項目を持たない古いファイルでは残った記録に触らない',
      tablesToReplace(base).detachedLogs,
      false,
    )
    eq(
      'GZ-バックアップ 空配列は「空にする意図」として置き換え対象',
      tablesToReplace({ ...base, detachedLogs: [] }).detachedLogs,
      true,
    )
    eq(
      'GZ-バックアップ 中身があれば置き換え対象',
      tablesToReplace({ ...base, detachedLogs: [{ title: 'x', logs: [], detachedAt: 1 }] }).detachedLogs,
      true,
    )
    // 上書きの確認文は、残った記録も消える件数に数える(数え漏らすと言った件数より多く消える)
    const impact = countReplaceImpact([{ cookedLogs: [log('2026-08-01')] }], 3, [
      { logs: [log('2026-07-01'), log('2026-07-02')] },
    ])
    eq('GZ-バックアップ 上書きで消える記録に残った記録も足す', impact.cookedLogs, 3)
    eq(
      'GZ-バックアップ 残った記録を渡さなくても従来どおり数えられる',
      countReplaceImpact([{ cookedLogs: [log('2026-08-01')] }], 3).cookedLogs,
      1,
    )
    // 「今のデータに追加」で同じまとまりかを見分ける鍵は印。料理名では突き合わせない
    eq(
      'GZ-バックアップ 印があれば印だけで見分ける',
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: '肉じゃが', detachedAt: 1 }),
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: 'ぜんぜん違う名前', detachedAt: 999 }),
    )
    neq(
      'GZ-バックアップ 料理名が同じでも印が違えば別のまとまり',
      mergeRowKeys.detachedLogs({ recipeUid: 'u-1', title: '肉じゃが', detachedAt: 1 }),
      mergeRowKeys.detachedLogs({ recipeUid: 'u-2', title: '肉じゃが', detachedAt: 1 }),
    )
  }

  // --- 「基本レシピを入れ直す」の確認文も、記録が残る側に変わる ---
  {
    const removed = {
      removed: 1,
      removedCookedLogs: 2,
      removedCookedPhotos: 1,
      removedRecipePhotos: 1,
      kept: 3,
      added: 0,
    }
    const text = confirmContentText(buildStarterReloadConfirm(removed))
    eq('GZ-入れ直し 消えるのはレシピの写真だけ', text.includes('レシピの写真1枚も消えます'), true)
    eq('GZ-入れ直し 「消えるもの」に作った記録を書かない', /消えるもの: [^\n]*作った記録/.test(text), false)
    eq('GZ-入れ直し 残るものに記録の件数を書く', text.includes('作った記録2件（うち写真1枚）も残り'), true)
    eq(
      'GZ-入れ直し 記録が付いていない品なら記録の話は書かない',
      /作った記録\d+件（うち写真/.test(
        confirmContentText(buildStarterReloadConfirm({ ...removed, removedCookedLogs: 0 })),
      ),
      false,
    )
    eq('GZ-入れ直し 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(text), false)
  }

  // --- 配線の確認(画面・DB操作がこの仕組みを通っているか。実DBはe2eで見る) ---
  {
    const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    const recipesSrc = readFileSync(path.join(appRoot, 'src/db/recipes.ts'), 'utf-8')
    // 削除の3経路すべてで、消す前に記録を移し替えていること
    eq(
      'GZ-配線 1品削除は消す前に記録を残す',
      /deleteRecipe\(id: number\)[\s\S]{0,600}detachRecipeLogs\(\[recipe\]\)[\s\S]{0,600}db\.recipes\.delete\(id\)/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'GZ-配線 まとめて削除も消す前に記録を残す',
      /deleteRecipes\(ids[\s\S]{0,900}detachRecipeLogs\(targets\)[\s\S]{0,900}bulkDelete\(targetIds\)/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'GZ-配線 セット丸ごと削除も消す前に記録を残す',
      /deleteRecipesBySourceSet[\s\S]{0,900}detachRecipeLogs\(targets\)[\s\S]{0,900}bulkDelete\(ids\)/.test(
        recipesSrc,
      ),
      true,
    )
    // 移し替えと削除が同じトランザクションでないと、片方だけ成功して記録が消える
    eq(
      'GZ-配線 1品削除は記録の移し替えと同じトランザクション',
      /deleteRecipe\(id: number\)[\s\S]{0,200}db\.transaction\('rw'[^)]*db\.detachedLogs/.test(recipesSrc),
      true,
    )
    const backupSrc = readFileSync(path.join(appRoot, 'src/logic/backup.ts'), 'utf-8')
    eq('GZ-配線 バックアップに残った記録を含める', /detachedLogs,\n\s*\}\n\s*return JSON\.stringify\(file\)/.test(backupSrc), true)
    eq('GZ-配線 取り込みのあとに結び直す', (backupSrc.match(/await reattachDetachedLogs\(\)/g) ?? []).length >= 3, true)
    const appSrc = readFileSync(path.join(appRoot, 'src/App.tsx'), 'utf-8')
    eq(
      'GZ-配線 起動時に印を振ってから結び直す',
      /backfillRecipeUids\(\)[\s\S]{0,120}reattachDetachedLogs\(\)/.test(appSrc),
      true,
    )
    // 集計へ混ぜない歯止め(材料が無い記録を栄養・食費に0として数えない)
    const mealPlanSrc = readFileSync(path.join(appRoot, 'src/pages/MealPlanPage.tsx'), 'utf-8')
    eq(
      'GZ-配線 削除済みレシピの記録は栄養・食費の入力(cookedLogsByDate)に混ぜない',
      /const cookedLogsByDate = useMemo\(\(\) => \{[\s\S]{0,500}\}, \[recipes\]\)/.test(mealPlanSrc),
      true,
    )
  }
}

// ---------- 便HC: 便GZの積み残し2件(2026-08-16) ----------
// ①古い記録の書き出し(アーカイブ)が「レシピを削除しても残った記録」を対象にしていなかった。
//   この機能の目的は端末容量の軽量化(2026-08-02 オーナー要望)で、**残った記録こそレシピが無いぶん
//   容量だけが残っている**状態なので、対象外なのは目的に反する。
// ②「今のデータに追加」のレシピ照合が料理名／IDだけだったため、同名の別レシピがある端末へ
//   書き出したファイルから同じレシピを入れ直すと、既存の同名レシピに合流して印が入らず、
//   記録が結び直せなかった。
{
  const log = (date, note, photo) => ({
    date,
    ...(note ? { note } : {}),
    ...(photo ? { photo: { size: photo } } : {}),
  })

  // --- ①書き出しの対象 ---
  {
    const cutoff = '2026-07-02'
    const recipes = [
      { id: 1, title: '肉じゃが', cookedLogs: [log('2026-07-01'), log('2026-08-01')] },
    ]
    const detached = [
      // レシピを削除しても残った記録(印あり)。写真つきの古い記録が容量を占め続けている
      {
        id: 3,
        recipeUid: 'u-1',
        title: 'カレー',
        logs: [log('2026-05-05', undefined, 10), log('2026-08-05')],
        detachedAt: 1,
      },
      // 印を持たない古い記録のまとまりも、容量は同じように残っているので対象に入れる
      { id: 4, title: '印なし', logs: [log('2026-04-04')], detachedAt: 1 },
    ]
    const targets = collectArchiveTargets(recipes, cutoff, detached)
    eq('HC①-対象 残った記録も書き出しの対象に入る', targets.length, 3)
    eq(
      'HC①-対象 境目以降の記録は残った記録でも書き出さない',
      targets.every((t) => t.log.date < cutoff),
      true,
    )
    const counts = countArchiveTargets(targets)
    eq('HC①-対象 件数に残った記録も足す', counts.logs, 3)
    eq('HC①-対象 写真の枚数に残った記録の写真も足す', counts.photos, 1)
    eq('HC①-対象 品数はレシピ1品＋残った記録2まとまり', counts.recipes, 3)
    eq('HC①-対象 そのうち残った記録の件数を別に数える', counts.detachedLogs, 2)
    eq(
      'HC①-対象 レシピの記録と残った記録でIDがぶつからない',
      new Set(targets.map((t) => t.id)).size,
      targets.length,
    )
    eq(
      'HC①-対象 どこにある記録かが分かる(消すときにレシピ側と残った記録側を取り違えない)',
      targets.map((t) => t.source).sort(),
      ['detached', 'detached', 'recipe'],
    )
    eq(
      'HC①-対象 残った記録を渡さなくても従来どおり数えられる(古い呼び出しを壊さない)',
      collectArchiveTargets(recipes, cutoff).length,
      1,
    )

    // 消すときのIDは書き出しのときと同じ手順で作る(違うと消す対象を取り違える)
    eq(
      'HC①-対象 消すとき用のIDは書き出し時と同じ',
      archiveIdsForDetached(detached[0]),
      ['u:u-1\n2026-05-05\n', 'u:u-1\n2026-08-05\n'],
    )
    // まとまりの番号は「データを上書き」で振り直されるので、印があるうちは印を鍵にする
    eq(
      'HC①-ID まとまりの番号が変わっても印が同じならIDは変わらない',
      archiveIdsForDetached({ id: 99, recipeUid: 'u-1', logs: [log('2026-05-05')] })[0],
      archiveIdsForDetached({ id: 3, recipeUid: 'u-1', logs: [log('2026-05-05')] })[0],
    )
    eq(
      'HC①-ID 印の無いまとまりはまとまりの番号を鍵にする',
      archiveIdsForDetached({ id: 4, logs: [log('2026-04-04')] })[0],
      'd4\n2026-04-04\n',
    )
    // レシピ側のIDはレシピ番号(数字)・手編集の行は'?'＋料理名。どれともぶつからない形にする
    eq(
      'HC①-ID レシピ側のIDとぶつからない',
      new Set([
        ...archiveIdsForRecipe({ id: 4, title: 'カレー', cookedLogs: [log('2026-04-04')] }),
        ...archiveIdsForDetached({ id: 4, logs: [log('2026-04-04')] }),
        ...archiveIdsForDetached({ id: 4, recipeUid: 'u-1', logs: [log('2026-04-04')] }),
      ]).size,
      3,
    )
  }

  // --- ①書き出したファイルの形（古いアーカイブファイルが読めなくならないこと） ---
  {
    // 便GZ以前に書き出したファイル: レシピ番号を鍵にしたIDだけが入っている
    const oldFileJson = JSON.stringify({
      app: 'uchi-recipe',
      kind: ARCHIVE_KIND,
      version: 1,
      exportedAt: '2026-08-02T00:00:00.000Z',
      logs: [
        { id: '1\n2026-05-01\n', date: '2026-05-01', recipeTitle: '肉じゃが' },
        {
          id: '2\n2026-04-01\n',
          date: '2026-04-01',
          recipeTitle: 'カレー',
          photoBase64: 'AAA',
          photoType: 'image/jpeg',
        },
      ],
    })
    const oldParsed = parseArchiveFile(oldFileJson)
    eq('HC①-旧ファイル 便GZ以前のアーカイブファイルがそのまま読める', oldParsed.logs.length, 2)
    eq('HC①-旧ファイル 読めなかった記録は0件', oldParsed.brokenCount, 0)
    eq(
      'HC①-旧ファイル 写真も読める',
      oldParsed.logs.find((l) => l.recipeTitle === 'カレー').photoBase64,
      'AAA',
    )
    // 残った記録を足して書き出しても、ファイルの形（版・種別マーク・項目）は変えない
    const appended = mergeArchiveLogs(oldParsed.logs, [
      { id: 'u:u-1\n2026-03-01\n', date: '2026-03-01', recipeTitle: '削除したレシピ' },
    ])
    const newFile = buildArchiveFile(appended, '2026-08-16T00:00:00.000Z')
    eq('HC①-旧ファイル 版を上げない(古いアプリでも読める形のまま)', newFile.version, 1)
    eq('HC①-旧ファイル 種別マークは同じ', newFile.kind, ARCHIVE_KIND)
    eq(
      'HC①-旧ファイル ファイルの項目は増やさない',
      Object.keys(newFile).sort(),
      ['app', 'exportedAt', 'kind', 'logs', 'version'],
    )
    eq('HC①-旧ファイル 前のファイルの記録は残る', appended.length, 3)
    eq(
      'HC①-旧ファイル 書き足したファイルも読める',
      parseArchiveFile(JSON.stringify(newFile)).logs.length,
      3,
    )
    eq(
      'HC①-旧ファイル 同じファイルを2回まとめても増えない',
      mergeArchiveLogs(appended, appended).length,
      3,
    )
  }

  // --- ①「書き出した記録を端末から消す」の確認文（規約F・実態に合わせる） ---
  {
    const bullet = (content, label) =>
      (content.bullets ?? []).find((b) => b.label === label)?.text ?? ''
    const goneLabel = '消えるもの'
    const keptLabel = '残るもの'

    // レシピの中の記録と、残った記録の両方を消す場面
    const both = buildArchiveDeleteConfirm({
      logs: 5,
      photos: 2,
      detachedLogs: 2,
      cutoff: '2026-07-16',
    })
    eq('HC①-確認文 消える件数と写真の枚数を書く', bullet(both, goneLabel), '作った記録5件・写真2枚')
    eq(
      'HC①-確認文 レシピの記録も消すときは「レシピ本体は残る」と書く',
      bullet(both, keptLabel).includes('レシピ本体'),
      true,
    )
    eq(
      'HC①-確認文 残るものに境目の日付を入れる',
      bullet(both, keptLabel).includes('2026年7月16日以降の記録'),
      true,
    )
    eq(
      'HC①-確認文 残った記録が含まれるときは内訳を出す',
      (both.notes ?? []).some((n) => n.includes('2件') && n.includes('レシピを削除したあと')),
      true,
    )

    // レシピの無い記録だけを消す場面（「レシピ本体は残ります」が誤解を生む場面）
    const detachedOnly = buildArchiveDeleteConfirm({
      logs: 3,
      photos: 1,
      detachedLogs: 3,
      cutoff: '2026-07-16',
    })
    eq(
      'HC①-確認文 レシピの無い記録だけを消すときは「レシピ本体」と書かない',
      bullet(detachedOnly, keptLabel).includes('レシピ本体'),
      false,
    )
    eq(
      'HC①-確認文 それでも残るものは件数・日付つきで書く(規約F)',
      bullet(detachedOnly, keptLabel),
      '2026年7月16日以降の記録・書き出したファイル',
    )
    eq(
      'HC①-確認文 消えるものは件数つきで書く(規約F)',
      bullet(detachedOnly, goneLabel),
      '作った記録3件・写真1枚',
    )

    // 残った記録が1件も無いときは内訳を出さない（無い話をしない）
    const recipeOnly = buildArchiveDeleteConfirm({
      logs: 2,
      photos: 0,
      detachedLogs: 0,
      cutoff: '2026-07-16',
    })
    // 2026-08-20 便IJ・①: 補足そのものが1件も無いこと（notes.length===0）で測っていたが、
    // それは「補足を1つも足せない」という別の約束になってしまう（実際、読みかたの制限の1行を
    // 足した便IJで落ちた）。測りたいのは**残った記録の内訳を出していないこと**なので、
    // その1行の形（ja の型に数字を入れたもの）を作って、それが混じっていないかで見る
    const detachedNoteRe = new RegExp(
      `^${ja.settings.archiveDeleteConfirmDetachedNote
        .split('{d}')
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('\\d+')}$`,
    )
    eq(
      'HC①-確認文 残った記録が無ければ内訳は出さない',
      (recipeOnly.notes ?? []).filter((n) => detachedNoteRe.test(n)),
      [],
    )
    // 見張りが当たっていること（型が合わなくなったら、上の判定は何も測らずに合格してしまう）
    eq(
      'HC①-確認文 内訳の見張りが当たっている（残った記録があるときは拾える）',
      (both.notes ?? []).some((n) => detachedNoteRe.test(n)),
      true,
    )
    eq(
      'HC①-確認文 レシピの記録だけなら従来どおり「レシピ本体」を書く',
      bullet(recipeOnly, keptLabel).includes('レシピ本体'),
      true,
    )
    const allText = [both, detachedOnly, recipeOnly].map(confirmContentText).join('\n')
    eq('HC①-確認文 件数の差し込み跡が残っていない', /\{[a-z]+\}/.test(allText), false)
    eq('HC①-確認文 「よろしいですか？」だけで終わらせない', allText.includes('よろしいですか'), false)
    eq('HC①-確認文 実行ボタンは何が起きるか分かる言葉', both.confirmLabel, '端末から消す')
  }

  // --- ②「今のデータに追加」でのレシピ照合(司令部の裁定4項目) ---
  {
    // 端末側: 1=肉じゃが(印u-mine) / 2=わたしの唐揚げ(印u-karaage)
    const titleById = new Map([
      [1, '肉じゃが'],
      [2, 'わたしの唐揚げ'],
    ])
    const idByTitle = new Map([
      ['肉じゃが', 1],
      ['わたしの唐揚げ', 2],
    ])
    const uidById = new Map([
      [1, 'u-mine'],
      [2, 'u-karaage'],
    ])
    const idByUid = new Map([
      ['u-mine', 1],
      ['u-karaage', 2],
    ])

    // 規則1: 印が一致すれば、番号も料理名も違っても同じレシピとみなす(最優先)
    eq(
      'HC②-照合 印が一致すれば料理名が違っても同じレシピ',
      resolveMergeRecipeAction(
        { id: 9, title: '肉じゃが（名前を変えた）', uid: 'u-mine' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )

    // 規則3: 両方が印を持ち、印が違うときは「合流はする・印は引き継がない」
    // (レシピを重複させない＝「追加」の見え方を変えない。記録は結ばず端末に残す)
    eq(
      'HC②-照合 同名で印が違っても合流はする(レシピを重複させない)',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 印が違うときはファイル側の印を引き継がない(記録を結ばない)',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ).adoptUid,
      undefined,
    )
    eq(
      'HC②-照合 版ズレで番号がずれていても、印が違えば印は引き継がない',
      resolveMergeRecipeAction(
        { id: 2, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 番号が空いていれば従来どおり同じ番号のまま追加する',
      resolveMergeRecipeAction(
        { id: 5, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'add' },
    )
    // 規則4: この関数は「消す」指示を返さない(追加は今のデータを1件も消さない)
    eq(
      'HC②-照合 返すのは合流・追加だけ(消す指示は返さない)',
      [
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        { id: 5, title: '肉じゃが', uid: 'u-file' },
        { id: 2, title: 'まったく新しい料理', uid: 'u-new' },
        { id: undefined, title: '番号なし', uid: 'u-x' },
      ]
        .map(
          (r) =>
            resolveMergeRecipeAction(r, titleById, idByTitle, uidById, idByUid).kind,
        )
        .every((kind) => ['enrich', 'add', 'addWithNewId'].includes(kind)),
      true,
    )

    // 規則2: 料理名で当たった既存レシピが印を持っていなければ、従来どおり同一とみなし印を引き継ぐ
    eq(
      'HC②-照合 今のレシピに印が無ければファイル側の印を引き継ぐ',
      resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        new Map(),
        new Map(),
      ),
      { kind: 'enrich', targetId: 1, adoptUid: 'u-file' },
    )
    eq(
      'HC②-照合 版ズレで番号がずれていても、印を持たない同名レシピには印を引き継ぐ',
      resolveMergeRecipeAction(
        { id: 2, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
        new Map([[2, 'u-karaage']]),
        new Map([['u-karaage', 2]]),
      ),
      { kind: 'enrich', targetId: 1, adoptUid: 'u-file' },
    )

    // 印を持たない古いバックアップは従来どおり(照合の仕方を変えない=古いファイルが読めなくならない)
    eq(
      'HC②-照合 印の無い古いファイルは従来どおり同名で合流する',
      resolveMergeRecipeAction({ id: 1, title: '肉じゃが' }, titleById, idByTitle, uidById, idByUid),
      { kind: 'enrich', targetId: 1 },
    )
    eq(
      'HC②-照合 印の無い古いファイルは版ズレの振り直しも従来どおり',
      resolveMergeRecipeAction(
        { id: 2, title: 'まったく新しい料理' },
        titleById,
        idByTitle,
        uidById,
        idByUid,
      ),
      { kind: 'addWithNewId' },
    )
    // 印の照合表を渡さない呼び出しでも、合流先の選び方は従来どおり(印が分からない＝印を
    // 持っていない端末として扱うので、規則2どおり印は引き継ぐ側になる)
    {
      const { kind, targetId } = resolveMergeRecipeAction(
        { id: 1, title: '肉じゃが', uid: 'u-file' },
        titleById,
        idByTitle,
      )
      eq('HC②-照合 印の照合表を渡さなくても合流先は従来どおり', { kind, targetId }, {
        kind: 'enrich',
        targetId: 1,
      })
    }

    // 規則3の裏付け: 印が食い違う相手へ合流しても、記録はその相手に結ばれない
    // (＝オーナーの懸念「似た名前の違うレシピとつながる」を防ぐ)。記録は残ったままになる
    const record = {
      id: 7,
      recipeUid: 'u-file',
      title: '肉じゃが',
      logs: [log('2026-08-01')],
      detachedAt: 1,
    }
    const notLinked = planDetachedReattach([record], [{ id: 1, uid: 'u-mine', cookedLogs: [] }])
    eq('HC②-結び直し 印が違う同名レシピには記録を結ばない', notLinked.items.length, 0)
    eq('HC②-結び直し 結ばなかった記録は消えない', notLinked.logsReattached, 0)
    // 規則2で印を引き継いだ場合は、そのレシピに記録が戻る
    const linked = planDetachedReattach([record], [{ id: 1, uid: 'u-file', cookedLogs: [] }])
    eq('HC②-結び直し 印を引き継いだレシピには記録が戻る', linked.items.length, 1)
    eq('HC②-結び直し 戻し先は印が一致したレシピ', linked.items[0].recipeId, 1)
  }

  // --- 配線の確認(画面・DB操作がこの仕組みを通っているか。実DBはe2eで見る) ---
  {
    const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    const recipesSrc = readFileSync(path.join(appRoot, 'src/db/recipes.ts'), 'utf-8')
    // 書き出した記録を消す先も2か所(レシピの中と、残った記録)。同じトランザクションで消す
    eq(
      'HC①-配線 書き出した記録の削除は残った記録も対象にする',
      /deleteArchivedCookedLogs[\s\S]{0,1400}archiveIdsForDetached\(record\)/.test(recipesSrc),
      true,
    )
    eq(
      'HC①-配線 削除は2か所を同じトランザクションで行う',
      /deleteArchivedCookedLogs[\s\S]{0,900}db\.transaction\('rw', db\.recipes, db\.detachedLogs/.test(
        recipesSrc,
      ),
      true,
    )
    eq(
      'HC①-配線 記録が0件になったまとまりは行ごと消す(空の行を残さない)',
      /archiveIdsForDetached\(record\)[\s\S]{0,400}db\.detachedLogs\.delete\(record\.id\)/.test(
        recipesSrc,
      ),
      true,
    )
    const settingsSrc = readFileSync(path.join(appRoot, 'src/pages/SettingsPage.tsx'), 'utf-8')
    eq(
      'HC①-配線 書き出しの対象に残った記録を渡している',
      /collectArchiveTargets\(\s*recipes \?\? \[\],\s*archiveCutoff,\s*detachedRecords \?\? \[\],\s*\)/.test(
        settingsSrc,
      ),
      true,
    )
    eq(
      'HC①-配線 削除の確認文は1か所(logic/cookedArchive.ts)で組み立てる',
      settingsSrc.includes('confirm(buildArchiveDeleteConfirm(archiveExported))'),
      true,
    )
    const backupSrc = readFileSync(path.join(appRoot, 'src/logic/backup.ts'), 'utf-8')
    eq(
      'HC②-配線 「今のデータに追加」の照合に印の表を渡している',
      /resolveMergeRecipeAction\(\s*recipe,\s*existingTitleById,\s*existingIdByTitle,\s*existingUidById,\s*existingIdByUid,\s*\)/.test(
        backupSrc,
      ),
      true,
    )
    eq(
      'HC②-配線 引き継ぐ印を今のレシピへ書き戻している',
      /action\.adoptUid \? \{ \.\.\.merged\.recipe, uid: action\.adoptUid \}[\s\S]{0,300}db\.recipes\.put\(adopted\)/.test(
        backupSrc,
      ),
      true,
    )
    eq(
      'HC②-配線 追加したレシピの印も照合表に載せる(同じファイルの中で二重に入らない)',
      (backupSrc.match(/indexExisting\(/g) ?? []).length >= 4,
      true,
    )
  }
}

// ---------- 便HD: 縦にだけ送る箱が、横にも動かせてしまう（2026-08-16 オーナー実機 iPhone SE2/Safari） ----------
// オーナー実機「作った！の窓の中の情報量が多すぎて、縦横にスクロールできる状態でした。
// 写真はわかりやすいように右下を表示したものなので、余白や見出しもちゃんとありました」。
//
// 起きていたこと（便HDが実測で突き止めた機序）:
//  ① `src/index.css` の body に `hanging-punctuation: allow-end` がある。行末の約物（」）。、）を
//     行の外へぶら下げる指定で、**Safari系だけが実装している**（Chromiumは未実装＝何も起きない）。
//  ② Safari はぶら下げたぶんを「右へのはみ出し」として記録する。実測で、文字14pxの行に対して13px、
//     文字18px太字の行に対して17px。**見た目にはみ出しているのは1px程度**で、残りは中身の無い余白。
//  ③ 窓は `overflow-y-auto` だけを指定していた。CSSの規定で、**片方の軸が visible でなくなると
//     もう片方の visible は auto に変わる**ため、`overflow-x` が auto になっていた
//     ＝窓は横にも送れる箱になっていた。
//  ④ ②のはみ出しが窓の左右の余白（16px＋枠1px）を超えると、窓が実際に横へ動く。
//     便HDの再現実験では 18px 太字の行で `scrollWidth - clientWidth = 1`、実際に横へ1px動いた。
//     どの行が余白を超えるかは端末の字形と折り返し位置しだいなので、Chromiumでも、
//     PCのSafariでも出ないのに実機だけで出る、という形になる。
//
// ここで測るのは「縦にだけ送るつもりの箱が、横にも動ける状態になっていないか」の1点。
// 置き場所や件数ではなく **src全体に1つも無いこと** を見るので、窓が増えても勝手に守られる。
// 見た目は変わらない（横に動かせないだけで、はみ出しはもともと余白の中に収まっている）。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const collectSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...collectSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  /**
   * 指定のかたまり（'...' "..." `...`）を取り出す。コメントの中の「'」を
   * 文字列の始まりと取り違えないよう、コメントと文字列を1文字ずつ見分けて拾う
   * （説明文に overflow-y-auto と書いただけの行を落とさないため）
   */
  const collectStringLiterals = (src) => {
    const out = []
    let i = 0
    let line = 1
    while (i < src.length) {
      const c = src[i]
      if (c === '\n') {
        line++
        i++
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++
      } else if (c === '/' && src[i + 1] === '*') {
        i += 2
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        const startLine = line
        const quote = c
        let value = ''
        i++
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') {
            i += 2
            continue
          }
          if (src[i] === '\n') line++
          value += src[i]
          i++
        }
        i++
        out.push({ value, line: startLine })
      } else i++
    }
    return out
  }
  /**
   * 横にも送れてよい箱は `overflow-x-auto` などを自分で書けば対象外になる
   * （判定は「同じ指定のかたまりの中に overflow-x-* があるか」）
   */
  const offenders = []
  for (const full of collectSources(path.join(appRoot, 'src'))) {
    const rel = path.relative(appRoot, full).split(path.sep).join('/')
    for (const { value, line } of collectStringLiterals(readFileSync(full, 'utf-8'))) {
      if (!value.includes('overflow-y-auto')) continue
      if (/overflow-x-(hidden|auto|scroll|clip)/.test(value)) continue
      offenders.push(`${rel}:${line}`)
    }
  }
  eq(
    'HD-1 縦にだけ送る箱(overflow-y-auto)は、横に動けないことも書いてある',
    offenders,
    [],
  )

  // 窓そのもの（利用者が「作った！」で開くもの）が、いま横に動けない指定になっていること。
  // 上の掃引はsrc全体を見るが、こちらは**オーナーが実機で触った窓**を名指しで押さえる
  const cookedLogSrc = readFileSync(
    path.join(appRoot, 'src/components/CookedLogModal.tsx'),
    'utf-8',
  )
  eq(
    'HD-2 「作った記録をつける」の窓は横に動かせない',
    /overflow-x-hidden[^"'`]*overflow-y-auto|overflow-y-auto[^"'`]*overflow-x-hidden/.test(
      cookedLogSrc,
    ),
    true,
  )
}

// --- 日付の欄が枠からはみ出さない（2026-08-16 オーナー実機・iPhone SE2）。
//     iOSでは中の値が独立した箱で描かれ、既定の余白と最小幅を持つため width:100% では抑えられない。
//     手元のブラウザでは再現しないので、**指定が消えていないこと**を見張る ---
{
  const heRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const css = readFileSync(path.join(heRoot, 'src/index.css'), 'utf-8')
  eq(
    'HE-1 日付の欄の中の値から、既定の余白と最小幅を外している',
    /::-webkit-date-and-time-value[\s\S]{0,120}margin:\s*0/.test(css) &&
      /::-webkit-date-and-time-value[\s\S]{0,120}min-width:\s*0/.test(css),
    true,
  )
  eq(
    'HE-1 iOSのときだけ日付欄の見た目の作り直しを外す（デスクトップの印を消さない）',
    /@supports \(-webkit-touch-callout: none\)[\s\S]{0,200}input\[type='date'\][\s\S]{0,120}appearance:\s*none/.test(
      css,
    ),
    true,
  )
  eq(
    'HE-1 日付の欄そのものにも縮む指定がある',
    /input\[type='date'\]\s*\{[\s\S]{0,120}min-width:\s*0/.test(css),
    true,
  )
}

// ---------- 便HE: 窓の中を送るつもりが、後ろの画面が動く（2026-08-16 オーナー実機 iPhone SE2/Safari） ----------
// オーナー原文「窓の見た目は直りました！しかし、窓内を縦にスクロールするつもりが、
// 後ろの画面が動いてしまうことがあります。」
//
// 便HEがWebKit(Safariと同じ描画エンジン・375x667)で測って分かった、後ろが動く2つの経路:
//  ① 窓の外側（暗い背景）の上で払うと、そのまま後ろの画面が送られる（400px送ると400px動いた）
//  ② 窓の中を下端まで送ったあとさらに払うと、送りが後ろの画面へ移る
//     （scroll chaining。600px送ると後ろが600px動いた）
// 「ことがあります」＝いつも起きるわけではない、の正体は②で、窓の中の余りが尽きた瞬間から
// 後ろへ移るため、中身が短い窓・下端まで送っていないときは起きない。
//
// ここで見張るのは、直し方が消えていないこと（実機の指の動きは手元では作れないため）:
//  HE-2 縦に送る箱には、送りが外へ移らない指定（overscroll-contain）がある … ②の対策
//  HE-3 全面の窓を描くファイルは、後ろの画面を止める共通の仕組みを使っている … ①の対策
//  HE-4 その共通の仕組みが「重なっても1回だけ」「閉じたら元の位置へ戻す」を守っている
{
  const heAppRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const heSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...heSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  /** コメントの中の引用符を文字列の始まりと取り違えないよう、HD-1 と同じ拾い方をする */
  const heStringLiterals = (src) => {
    const out = []
    let i = 0
    let line = 1
    while (i < src.length) {
      const c = src[i]
      if (c === '\n') {
        line++
        i++
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++
      } else if (c === '/' && src[i + 1] === '*') {
        i += 2
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        const startLine = line
        const quote = c
        let value = ''
        i++
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') {
            i += 2
            continue
          }
          if (src[i] === '\n') line++
          value += src[i]
          i++
        }
        i++
        out.push({ value, line: startLine })
      } else i++
    }
    return out
  }

  // --- HE-2: 縦に送る箱は、端まで送っても送りが外へ移らない ---
  // 置き場所や件数ではなく **src全体に1つも無いこと** を見るので、箱が増えても勝手に守られる
  // （overflow-x-hidden を足した便HD の掃引と同じやり方）。
  // わざと外へ移したい箱は overscroll-auto と自分で書けば対象外になる。
  const heChainable = []
  for (const full of heSources(path.join(heAppRoot, 'src'))) {
    const rel = path.relative(heAppRoot, full).split(path.sep).join('/')
    for (const { value, line } of heStringLiterals(readFileSync(full, 'utf-8'))) {
      if (!value.includes('overflow-y-auto')) continue
      if (/overscroll-(y-)?(contain|none|auto)/.test(value)) continue
      heChainable.push(`${rel}:${line}`)
    }
  }
  eq('HE-2 縦に送る箱は、端まで送っても送りが後ろの画面へ移らない', heChainable, [])

  // --- HE-3: 全面の窓は、後ろの画面を止める共通の仕組みを通っている ---
  // 数え方は「そのファイルにある全面の窓の数」と「後ろの画面を止める呼び出しの数」の対応。
  // 窓が増えたら止める呼び出しも増やす必要があるので、20枚以上ある窓のどれかが取り残される
  // ことがない（窓ごとに同じ処理を書き写す形にはしない＝呼ぶのは共通のフック1つ）。
  const heOverlayExempt = new Map([
    [
      'src/components/TermPopover.tsx',
      // 語をタップして出す小さな吹き出し。中に送る箱を持たず、画面が送られたら
      // 語との位置がずれるので**自分から閉じる**作り。止めると閉じられなくなる
      '用語の吹き出しは送られたら閉じる作りのため',
    ],
    [
      'src/components/dialogStyle.ts',
      // 2026-08-17 便HJ: 窓の見た目（クラス名）だけを置く場所で、窓そのものは描かない。
      // このクラス名を使って窓を描く側（ConfirmDialog／ChoiceDialog）は下の数え方で
      // ちゃんと1枚ずつ数えられるので、見張りは弱くならない
      'クラス名だけを置く場所で窓を描かないため（使う側で数える）',
    ],
  ])
  const heMissingLock = []
  for (const full of heSources(path.join(heAppRoot, 'src'))) {
    const rel = path.relative(heAppRoot, full).split(path.sep).join('/')
    const src = readFileSync(full, 'utf-8')
    // 2026-08-17 便HJ: 窓の後ろ（暗い背景）のクラス名を components/dialogStyle.ts で
    // 分け合う形にしたので、そのクラス名を**使っている**ファイルも窓1枚として数える
    // （読み込みの行は使ったことにならないので数から外す）。見張る中身は変えていない
    // 2026-08-19 便HU: **コメントも数から外す**。「なぜ全面の下敷きを置かないのか」を
    // 説明した文章の中にクラス名を書いたら、実在しない窓として数えられて赤くなった。
    // 見張りたいのは実際に描いている窓なので、読み込みの行と同じくコメントも落とす
    const heBody = src
      .replace(/import\s[\s\S]*?from\s+'[^']+'/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const overlays =
      (heBody.match(/fixed inset-0/g) ?? []).length +
      (heBody.match(/DIALOG_BACKDROP_CLS/g) ?? []).length
    if (overlays === 0) continue
    if (heOverlayExempt.has(rel)) continue
    const locks = (src.match(/useScrollLock\(/g) ?? []).length
    if (locks < overlays) heMissingLock.push(`${rel}(窓${overlays}/止める呼び出し${locks})`)
  }
  eq('HE-3 全面の窓はすべて、後ろの画面を止める共通の仕組みを通っている', heMissingLock, [])
  eq(
    'HE-3 対象外にしている窓は、理由付きで1か所にまとまっている',
    [...heOverlayExempt.values()].every((reason) => reason.length > 0),
    true,
  )

  // --- HE-4: 共通の仕組みそのもの（重なっても1回だけ／閉じたら元の位置へ戻す） ---
  // 本物のブラウザは要らない部分なので、body と window の代わりを置いて動かす。
  // 見るのは「利用者が確かめたいこと」＝止めているあいだ見た目が動かず、閉じたら元の場所に戻ること
  {
    const heFakeStyle = () => ({ position: '', top: '', left: '', width: '', overflow: '' })
    const body = { style: heFakeStyle() }
    const html = { style: heFakeStyle(), clientWidth: 375 }
    const scrolled = []
    const fakeWindow = {
      scrollY: 0,
      location: { hash: '#/recipes' },
      scrollTo: (_x, y) => {
        fakeWindow.scrollY = y
        scrolled.push(y)
      },
    }
    const prevWindow = globalThis.window
    const prevDocument = globalThis.document
    globalThis.window = fakeWindow
    globalThis.document = { body, documentElement: html }
    try {
      const { acquireScrollLock, releaseScrollLock, scrollLockDepth } = await import(
        '../src/components/useScrollLock.ts'
      )

      // 一覧を途中まで送ったところで窓を開く
      fakeWindow.scrollY = 640
      acquireScrollLock()
      eq('HE-4 窓を開いているあいだ、後ろの画面は動かせない', body.style.position, 'fixed')
      eq(
        'HE-4 止めた瞬間に見た目がずれない（送っていた位置ぶん上へずらして固定する）',
        body.style.top,
        '-640px',
      )
      eq('HE-4 止めているあいだの横幅は、止める前の幅のまま', body.style.width, '375px')

      // 窓が重なっても、止め方は1回だけ（全画面の調理中モードの上に確認の窓が重なる形）
      acquireScrollLock()
      eq('HE-4 窓が重なった数を数えている', scrollLockDepth(), 2)
      releaseScrollLock()
      eq('HE-4 上の窓を閉じただけでは、まだ止まったまま', body.style.position, 'fixed')
      eq('HE-4 上の窓を閉じただけでは、まだ元の位置へ戻さない', scrolled, [])

      // 最後の1枚を閉じたら、開く前の位置に戻る（ここが壊れると「戻ったら先頭に飛ぶ」になる）
      releaseScrollLock()
      eq('HE-4 最後の窓を閉じたら、後ろの画面は元どおり動かせる', body.style.position, '')
      eq('HE-4 最後の窓を閉じたら、開く前の位置に戻る', scrolled, [640])
      eq('HE-4 止める前に入れた指定は残さない', [body.style.top, body.style.width], ['', ''])
      eq('HE-4 数え直しも0に戻っている', scrollLockDepth(), 0)

      // 窓の中から別の画面へ移ったときは、移った先の位置に触らない
      scrolled.length = 0
      fakeWindow.scrollY = 300
      acquireScrollLock()
      fakeWindow.location.hash = '#/recipes/12'
      releaseScrollLock()
      eq('HE-4 窓の中から別の画面へ移ったときは、移った先を勝手に送らない', scrolled, [])
      eq('HE-4 別の画面へ移っても、固定は必ず外す', body.style.position, '')
    } finally {
      globalThis.window = prevWindow
      globalThis.document = prevDocument
    }
  }
}

// ==========================================================================================
// 便HL: 説明のページに、無くなった操作の名前を残さない（GONEWORD-1〜3）
//
// なぜ要るか: 2026-08-17 の作り替え（便HG/HH/HI/HJ）でアプリから消えた操作の名前が、
// 使い方ページと複数の端末で使う方法にそのまま残っていた。読んだ人は画面で探して見つからず、
// 「自分の操作が悪い」と受け取ることになる。説明文が正しいかどうかは機械では測れないが、
// **消した名前が残っていないこと**は測れるので、そこだけを見張る。
//
// 見る先はユーザーが読むページの本文だけ（HTMLのコメントは内部の説明なので外す）。
// アプリ側の文言（ja.ts）は消した名前をコメントで経緯として残しているので対象にしない。
//
// 新しい名前が入っているかも一緒に見る（消しただけで書き直し忘れると、その操作の説明が
// ページから丸ごと落ちる）。期待値は ja.ts の実物から取る＝アプリで名前を変えたら赤になる。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const pages = ['public/about/manual.html', 'public/about/index.html', 'public/about/multi-device.html']
  const bodyOf = (rel) =>
    readFileSync(path.join(appRoot, rel), 'utf-8').replace(/<!--[\s\S]*?-->/g, '')

  /** 無くなった名前と、いま同じことをする操作の名前（読む人がどこを見ればよいか分かる形で書く） */
  const goneNames = [
    // 2026-08-17 便HI: 献立の「日」から無くなった操作
    ['別の提案を見る', '「おまかせで献立を組む」を押し直す'],
    ['もう1品さがす', '畳んだ「今日なに作る？」の見出し'],
    // 同・その日の献立が空のときの案内文（「今日の献立」の枠ごと出なくなった）
    ['まだ今日つくるものが決まっていません', '「今日なに作る？」と「今日の献立を探す」'],
    ['レシピ一覧からまとめて選べます', '同上'],
    // 2026-08-18 便HM: オーナー指示の改名（「選ぶ」→「探す」）と、
    // 1品／献立をひとつの節にまとめたときに要らなくなった見出し
    ['今日の献立を選ぶ', '今日の献立を探す'],
    ['おまかせで組んだ献立', '「献立」に切り替えたときに出る主菜・副菜の候補'],
    // 2026-08-17 便HH: 献立の「日」から外したボタン（行き先はレシピ一覧と、その絞り込みに残っている）
    ['「レシピを探す」', '下の並びの「レシピ」'],
    ['「在庫の食材から探す」', 'レシピ一覧の「在庫の食材で絞る」'],
    // 同・改名前の名前
    ['おまかせで提案', 'おまかせで献立を組む'],
    ['ほかの候補を見る', 'ランダムで1品出す'],
  ]
  for (const rel of pages) {
    const body = bodyOf(rel)
    for (const [gone, now] of goneNames) {
      eq(`GONEWORD-1 ${rel} に無くなった名前「${gone}」が残っていない（今は ${now}）`, body.includes(gone), false)
    }
  }

  // 2026-08-17 便HJ: 選び終わったあとの3つは、帯のボタン（「選択したレシピ◯品を…」）から
  // 窓の道（「ファイルに書き出す」「削除する」）へ移した。
  // 「選択したレシピ◯品を今日の献立に入れる」だけは残っている（献立から来た選択モードのボタン）ので、
  // 書き出し・削除の2つだけを見張る
  const goneSelectButtons = [
    [/選択したレシピ[^」]*を書き出す/, ja.recipes.selectActionExport],
    [/選択したレシピ[^」]*を削除/, ja.recipes.selectActionDelete],
  ]
  for (const rel of pages) {
    const body = bodyOf(rel)
    for (const [pattern, now] of goneSelectButtons) {
      const hit = body.match(pattern)
      eq(`GONEWORD-2 ${rel} に帯のころのボタン名が残っていない（今は「${now}」）`, hit?.[0] ?? null, null)
    }
  }

  // 書き直したあとの名前が入っているか。期待値はアプリの文言そのもの
  const manual = bodyOf('public/about/manual.html')
  const multiDevice = bodyOf('public/about/multi-device.html')
  const selectActionsTitle = ja.recipes.selectActionsTitle.replace('{n}', '◯')
  eq('GONEWORD-3 使い方ページに「選び終わる」が書いてある', manual.includes(ja.recipes.selectFinish), true)
  eq(`GONEWORD-3 使い方ページに「${selectActionsTitle}」が書いてある`, manual.includes(selectActionsTitle), true)
  eq('GONEWORD-3 使い方ページに窓の3つの道が書いてある', [
    manual.includes(ja.recipes.selectActionToToday),
    manual.includes(ja.recipes.selectActionExport),
    manual.includes(ja.recipes.selectActionDelete),
  ], [true, true, true])
  eq('GONEWORD-3 使い方ページに「選択をやめる」が書いてある', manual.includes(ja.recipes.selectExit), true)
  eq('GONEWORD-3 複数の端末で使う方法にも「選び終わる」が書いてある', multiDevice.includes(ja.recipes.selectFinish), true)
  eq(
    'GONEWORD-3 使い方ページに「レシピ一覧から追加」が書いてある',
    manual.includes(ja.mealPlan.todayAddMoreButton),
    true,
  )
  // 2026-08-18 便HM: 「今日なに作る？」を1品／献立の切り替え1つにまとめたので、
  // 使い方ページにも切り替えの名前と、まとめたあとのボタンの名前が要る
  eq(
    'GONEWORD-3 使い方ページに「1品」「献立」の切り替えが書いてある',
    [
      manual.includes(`「${ja.dayStart.modeOne}」`),
      manual.includes(`「${ja.dayStart.modePlan}」`),
    ],
    [true, true],
  )
  eq(
    'GONEWORD-3 使い方ページに「今日の献立を探す」が書いてある',
    manual.includes(ja.mealPlan.todayChooseButton),
    true,
  )
}

// ==========================================================================================
// PLANWORD-1: 「何も起きないもの」を確認文・お知らせに書かない（2026-08-18 オーナー指摘）
//
// オーナー原文:「今日の献立からレシピを削除したときにでる『〜外しました（作った記録は残ります）』、
//              作った記録もするということ？消すだけですよね。嘘書かないで。」
//
// 献立の予定（mealPlans / todayList）を消す・入れ替えるだけの操作は、作った記録（cookedLogs）に
// 一切触らない。触らないものを「残ります」「消えません」と書くと、**危なかったように読める**。
// 規約Fが求めるのは「消えるものと残るものを両方書く」ことで、
// **もともと何も起きないものを書き足すことではない**。
//
// 測るのは「その操作が触らない種類のデータの名前が、文に混ざっていないこと」。
// 文言そのものの言い回しは見ない＝書き直しても、規則を守っているかぎり赤にならない。
// ==========================================================================================
{
  /** 献立の予定だけを触る操作（作った記録には触らない）の、押す前の説明と押したあとの知らせ */
  const planOnlyTexts = [
    ['日タブ・×の説明', ja.mealPlan.todayPlannedRemoveHint],
    ['日タブ・×のお知らせ', ja.mealPlan.todayPlannedRemovedToast],
    ['週タブ・まとめて空にする（食事を選んだとき）', ja.mealPlan.clearWeekSlotConfirm],
    ['週タブ・まとめて空にする（全部の食事）', ja.mealPlan.clearWeekSlotConfirmAll],
    ['週タブ・まとめて献立を入力の説明', ja.mealPlan.fillModeReplaceAllHint],
    ['月タブ・献立をまとめて提案', ja.mealPlan.fillMonthConfirm],
    ['月タブ・献立をまとめて提案（残る献立が無いとき）', ja.mealPlan.fillMonthConfirmNoKept],
    ['テンプレートを入れる', ja.mealPlan.templateApplyConfirm],
    ['テンプレートを入れる（残る献立が無いとき）', ja.mealPlan.templateApplyConfirmNoKept],
  ]
  for (const [where, text] of planOnlyTexts) {
    eq(
      `PLANWORD-1 ${where}: 献立の予定しか触らないので「記録」の話を書かない`,
      /記録/.test(text ?? ''),
      false,
    )
  }
  // 在庫の整理も同じ（消えるのは在庫の食材だけ。レシピにも作った記録にも触らない）
  eq(
    'PLANWORD-1 在庫の整理: 在庫の食材しか触らないので「レシピ」「作った記録」の話を書かない',
    /レシピ|作った記録/.test(ja.pantry.organizeConfirm ?? ''),
    false,
  )
  // 逆に、本当に片方が消えて片方が残る操作では書いたままにする（規約Fの本来の役目）。
  // レシピを消すと、そのレシピの作った記録は残る＝「消えると思って当然」なので必ず書く
  eq(
    'PLANWORD-1 レシピの削除では「作った記録が残る」ことを書く（本当に消えると思う場面）',
    [/作った記録/.test(ja.form.confirmDeleteKept), /作った記録/.test(ja.recipes.bulkDeleteConfirmKept)],
    [true, true],
  )
}

// ==========================================================================================
// HN-1: 同じ役目のボタンは、同じ塗り方にする（2026-08-18 オーナー指摘）
//
// オーナー原文:「『作った！』と『全て作った！』など、同じような機能は色を同じにした方が、
//              パッとみてわかりやすいと思う。ここに限らず。」
//
// 測り方の決めごと（色の値は決め打ちしない）:
//   ・アプリの色はテーマで変わるので、「#cc3f01であること」のような測り方はしない。
//   ・代わりに、そのボタンが**どの塗り方（トークンの組み合わせ）を選んでいるか**を読み取り、
//     **同じ役目のボタンどうしで一致しているか**だけを見る。
//   ・塗り方を変えたくなったときは、その役目の全部を一緒に変えれば緑のまま通る
//     ＝「今の形」ではなく「そろっているか」を測っている。
//
// 拾い方: UI文言（src/i18n/ja.ts のキー）が書かれている場所から**手前にさかのぼって**
// いちばん近い <button の開きタグを見つけ、その className を読む。
// ボタンの中身（アイコン・字）が増えても、置き場所が変わっても、同じ判定になる。
// ==========================================================================================
{
  const hnRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const hnFile = (rel) => readFileSync(path.join(hnRoot, rel), 'utf-8')

  /**
   * 目印（JSXに書かれた文言の式）を持つボタンの className を取り出す。
   *
   * 見た目が状態で変わるボタン（`className={`… ${押した? 'A' : 'B'}`}`）は、
   * **まだ押していないときの見た目**＝ else 側（: のあと。並びのいちばん最後）を読む。
   * 押したあとの見た目（「追加済み ✓」等）は役目が変わるので、そろえる対象ではない。
   */
  const buttonClassFor = (src, marker) => {
    const at = src.indexOf(marker)
    if (at < 0) return { error: `目印が見つからない: ${marker}` }
    const openAt = src.lastIndexOf('<button', at)
    if (openAt < 0) return { error: `ボタンの開きタグが見つからない: ${marker}` }
    const head = src.slice(openAt, at)
    const plain = head.match(/className="([^"]*)"/)
    if (plain) return { cls: plain[1] }
    const tpl = head.match(/className=\{`([\s\S]*?)`\}/)
    if (!tpl) return { error: `className が読めない: ${marker}` }
    const expr = tpl[1]
    // 条件の外にそのまま書いてある部分＋条件のいちばん最後のかたまり（＝else側）
    const base = expr.replace(/\$\{[\s\S]*?\}/g, ' ')
    const branches = [...expr.matchAll(/'([^']*)'/g)].map((m) => m[1])
    return { cls: `${base} ${branches.at(-1) ?? ''}`.replace(/\s+/g, ' ').trim() }
  }

  /**
   * 塗り方の呼び名。トークンの組み合わせだけで決める（具体的な色は見ない）。
   *  ・塗り   … 地をアクセントで塗り、字はアクセントの上用（bg-accent + text-on-accent）
   *  ・枠だけ … 地はカード面のまま、枠と字にアクセント（border-accent + text-accent-ink）
   *  ・地味枠 … 枠は区切り線の色で、字だけアクセント（border-edge + text-accent-ink）
   */
  const toneOf = (cls) => {
    const filled = /(^|\s)bg-accent(\s|$)/.test(cls) && /(^|\s)text-on-accent(\s|$)/.test(cls)
    const accentEdge = /(^|\s)border-accent(\s|$)/.test(cls)
    const plainEdge = /(^|\s)border-edge(\s|$)/.test(cls)
    const accentInk = /(^|\s)text-accent-ink(\s|$)/.test(cls)
    if (filled) return '塗り'
    if (accentEdge && accentInk) return '枠だけ'
    if (plainEdge && accentInk) return '地味枠'
    return `判別できない(${cls})`
  }

  /** 役目ごとのボタン一覧。[どこにあるか, ファイル, JSXに書かれた文言の式] */
  const HN_ROLES = [
    [
      '作った記録をつける',
      [
        ['レシピ詳細の「作った！」', 'src/pages/RecipeDetailPage.tsx', '{ja.detail.cooked}'],
        [
          '献立・日タブの1品ごとの「作った！」',
          'src/pages/MealPlanPage.tsx',
          '{ja.mealPlan.todayMarkCooked}',
        ],
        [
          '献立・日タブの「全て作った！」',
          'src/pages/MealPlanPage.tsx',
          '{ja.mealPlan.todayMarkAllCooked}',
        ],
        [
          '並行調理ナビの「まとめて作った！」',
          'src/pages/CookNaviPage.tsx',
          '{ja.cookNavi.markAllCooked}',
        ],
        [
          '調理を終えた窓の記録ボタン',
          'src/components/CookFinishModal.tsx',
          '{ja.cookNavi.sessionFinishRecord}',
        ],
        ['記録の窓の保存ボタン', 'src/components/CookedLogModal.tsx', '{ja.detail.cookedSave}'],
      ],
    ],
    [
      '今日の献立に入れる',
      [
        [
          'レシピ詳細の「今日の献立に追加」',
          'src/pages/RecipeDetailPage.tsx',
          '{isInTodayList ? `${ja.detail.todayAdded} ✓` : ja.detail.todayAdd}',
        ],
        [
          '献立・日タブの「レシピ一覧から追加」',
          'src/pages/MealPlanPage.tsx',
          '{ja.mealPlan.todayAddMoreButton}',
        ],
        [
          '「今日なに作る？」の「今日の献立に入れる」',
          'src/components/TodaySuggestPanel.tsx',
          '{ja.mealPlan.todaySuggestApply}',
        ],
      ],
    ],
  ]

  for (const [role, buttons] of HN_ROLES) {
    const found = buttons.map(([where, rel, marker]) => {
      const r = buttonClassFor(hnFile(rel), marker)
      return `${where}=${r.error ?? toneOf(r.cls)}`
    })
    const kinds = new Set(found.map((f) => f.slice(f.indexOf('=') + 1)))
    // そろっていれば空の配列。ずれていたら「どこが何色か」を全部並べて出す
    eq(`HN-1 「${role}」のボタンは全部そろった塗り方`, kinds.size === 1 ? [] : found, [])
  }

  // ==========================================================================================
  // HN-2: レシピカードの形は「密度」の1軸・3つだけ（2026-08-18 便HN）
  //
  // オーナー原文:「場所や機能ごとにレシピカードの形や内容が変わっているのがみづらい。
  //              パターン２つ（もしくは３つ）に絞って。」
  //
  // 値が4つ目に増えるのは「密度」以外の軸を混ぜてしまった合図なので、数そのものを見張る。
  // あわせて、共通部品が3つとも扱っていること・レシピ一覧が設定値をこの写し方で渡していること
  // （＝一覧の見え方が従来のまま保たれる道すじ）を見る。
  // ==========================================================================================
  eq('HN-2 カードの密度は3つまで（4つ目が要るなら設計を見直す）', CARD_DENSITIES.length, 3)
  eq(
    'HN-2 レシピ一覧の表示形式は、従来と同じ見え方の密度に写る',
    ['grid', 'list'].map(densityForListLayout),
    ['large', 'standard'],
  )
  {
    const card = hnFile('src/components/RecipeCard.tsx')
    const missing = CARD_DENSITIES.filter((d) => !card.includes(`'${d}'`))
    eq('HN-2 共通のカードは3つの密度をすべて描き分けている', missing, [])
    // 「密度」以外の言葉で形を切り替える口を増やしていないこと（旧 layout='grid'|'list' の置き換え）
    eq('HN-2 共通のカードの形を決める口は「密度」だけ', /\blayout\??:/.test(card), false)
    const recipes = hnFile('src/pages/RecipesPage.tsx')
    eq(
      'HN-2 レシピ一覧は、設定の表示形式を密度に写してからカードへ渡す',
      /density=\{densityForListLayout\(/.test(recipes),
      true,
    )
  }

  // ==========================================================================================
  // IG-1: 「小」のカードの絵は、入れ物の高さではなく実寸で決める（2026-08-20 便IG・⑫）
  //
  // オーナー実機報告:「月の日の窓を開くと、作った記録の写真が窓いっぱいに縦長で表示され、
  //                 料理名が出ていない」
  //
  // 直す前は絵の枠が `aspect-square h-full min-h-[var(--tap-min)]`（＝カードの高さいっぱいの
  // 正方形）で、親の高さが中身で決まる場所では高さ100%が解けず、中の<img>が**写真そのものの
  // 大きさ**で並んだ結果、正方形の一辺が600pxになり、料理名の幅が4pxまで潰れていた。
  // 写真のある「小」のカードならどこでも起きる（週タブの過ぎた日でも同じ実測が出た）。
  //
  // 実際の大きさは e2e の CARDSMALL-01 が測る。ここはその手前の安い見張りで、
  // **絵の枠が入れ物の高さに頼る書き方へ戻っていないこと**だけを見る。
  // ==========================================================================================
  {
    const card = hnFile('src/components/RecipeCard.tsx')
    // 「小」の枝（density === 'small'）から、次の密度の枝までを切り出して見る
    const smallStart = card.indexOf("if (density === 'small')")
    const smallEnd = card.indexOf("if (density === 'standard')")
    eq('IG-1 「小」の枝を読み取れている', smallStart > 0 && smallEnd > smallStart, true)
    const small = card.slice(smallStart, smallEnd)
    eq(
      'IG-1 「小」の絵は押せる大きさ（--tap-min）の正方形を実寸で持つ',
      /h-\[var\(--tap-min\)\]\s+w-\[var\(--tap-min\)\]/.test(small),
      true,
    )
    eq(
      'IG-1 「小」の絵の枠が、入れ物の高さ頼み（aspect-square + h-full）へ戻っていない',
      /aspect-square[^'`]*h-full/.test(small),
      false,
    )
  }
}

// ==========================================================================================
// HW-1〜HW-3: 「同じ役目のカードは同じ形をしている」の見張り（2026-08-19 便HW）
//
// オーナー原文:
//   「場所や機能ごとにレシピカードの形や内容が変わっているのがみづらい。
//     パターン２つ（もしくは３つ）に絞って。」
//   「表記揺れを直すように、レシピカードなど、同じ情報なら形もできるだけ揃えることを徹底したい」
//
// 便HN（1段目）で「密度」＝大／標準／小の3つを共通部品に作り、便HW（2〜3段目）で
// 画面ごとに自前で組んでいたカードを全部そこへ寄せた。
//
// **測り方の決めごと**（カードの種類を書き写して並べない＝画面が増えても当たる形にする）:
//   HW-1 … 「料理の絵」を自前で描いている画面が1つも無いこと。
//          カードが増えるときは必ずこの部品を通るので、**新しい画面が自前で組んだら赤**になる。
//   HW-2 … カードを出しているすべての場所が、3つの密度のどれかに解決できること。
//   HW-3 … **1つの並びの中で形を混ぜていない**こと（同じ一覧に別々の形が並ぶのが
//          オーナーの言う「みづらい」の中身）。
//
// **読み取りに失敗したら必ず落ちる**ようにしてある（2026-08-18に、数を読めなかった便が
// -1 を返して4件のテストが「何も測らないまま合格」した失敗の再発防止）。
// 走査できたファイル数・拾えた呼び出し数が0なら、その場で不合格にする。
//
// HW_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る。
// 「この見張りが、直す前のコードに当てると本当に赤くなるか」を確かめるための口。
// ==========================================================================================
{
  const hwScriptDir = path.dirname(fileURLToPath(import.meta.url))
  const hwRoot = process.env.HW_SRC_ROOT ?? path.join(hwScriptDir, '..')
  const hwSrcDir = path.join(hwRoot, 'src')

  /** src配下の .tsx を再帰的に集める（リポジトリ内の相対パスで返す） */
  const listTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...listTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const hwFiles = listTsx(hwSrcDir).map((full) => ({
    rel: path.relative(hwRoot, full).split(path.sep).join('/'),
    src: readFileSync(full, 'utf-8'),
  }))
  // 走査そのものが壊れていたら（0件・ほんの数件しか読めていない）、ここで落とす。
  // 下の3つは「見つからなければ緑」の形をしているので、走査が空だと全部素通りしてしまう
  eq('HW-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', hwFiles.length > 0, true)

  // ---- HW-1: 料理の絵（写真か代わり絵か）を描いているのは共通部品だけ --------------------
  // 自前のカードは例外なく「写真があれば <img>、無ければ代わり絵」を自分で書くところから
  // 始まる。その1行が共通部品の外に出た瞬間に赤くする＝「その画面だけのカード」が生まれない。
  const hwPlaceholderUsers = hwFiles
    .filter(({ src }) => /<RecipePlaceholder\b/.test(src))
    .map(({ rel }) => rel)
  eq(
    'HW-1 料理の絵を描いているのは共通のカード部品だけ（自前のカードが無い）',
    hwPlaceholderUsers,
    ['src/components/RecipeCard.tsx'],
  )

  // ---- HW-2: カードを出す場所は、必ず3つの密度のどれかに解決できる ------------------------
  /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `=>` に釣られない） */
  const cardOpenTags = (src) => {
    const tags = []
    let at = src.indexOf('<RecipeCard')
    while (at >= 0) {
      let depth = 0
      let end = -1
      for (let i = at; i < src.length; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) {
          end = i
          break
        }
      }
      if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
      tags.push({ at, text: src.slice(at, end + 1) })
      at = src.indexOf('<RecipeCard', end)
    }
    return { tags }
  }
  /** 開きタグ1つぶんの密度。読めなければ理由を返す（黙って既定に倒さない） */
  const densityOf = (tag) => {
    const literal = tag.match(/density="([a-z]+)"/)
    if (literal) {
      return CARD_DENSITIES.includes(literal[1])
        ? { density: literal[1] }
        : { error: `知らない密度: ${literal[1]}` }
    }
    const expr = tag.match(/density=\{([^}]*)\}/)
    if (expr) {
      // 設定の表示形式から写す道（レシピ一覧）。写し先は densityForListLayout が受け持つ
      if (/densityForListLayout\(/.test(expr[1])) return { density: 'listLayout' }
      return { error: `密度の式が読めない: ${expr[1].trim()}` }
    }
    // 省略時は既定の「大」
    return { density: 'large' }
  }

  const hwCalls = []
  const hwTagErrors = []
  for (const { rel, src } of hwFiles) {
    const found = cardOpenTags(src)
    if (found.error) {
      hwTagErrors.push(`${rel}: ${found.error}`)
      continue
    }
    for (const tag of found.tags) {
      const d = densityOf(tag.text)
      hwCalls.push({ rel, at: tag.at, ...d })
    }
  }
  eq('HW-2 カードの呼び出しを切り出せている（切り出せない書き方が無い）', hwTagErrors, [])
  eq(
    'HW-2 カードを出している場所を1つ以上拾えている（0件なら見張りが壊れている）',
    hwCalls.length > 0,
    true,
  )
  eq(
    'HW-2 すべての場所が3つの密度のどれかに解決できる',
    hwCalls.filter((c) => c.error).map((c) => `${c.rel}: ${c.error}`),
    [],
  )

  // ---- HW-3: 一覧の行は、例外なく共通のカードを通る ---------------------------------------
  // 「同じ情報なら同じ形」が崩れるときは、いつも**一覧の1行だけを自前で組む小さな部品**から
  // 始まる（便HWで直したのは、まさにその4つ: 今日の献立の行・作った記録のカード・
  // 最近作ったものの行・作った記録の一覧の行）。
  // そこで「レシピを受け取って一覧の行（<li>）を返す部品は、必ず共通のカードを描いている」
  // を規則にする。次に一覧が増えたときも、自前で組めばその場で赤くなる。
  const hwRowOffenders = []
  for (const { rel, src } of hwFiles) {
    if (rel === 'src/components/RecipeCard.tsx') continue
    // 「recipe: Recipe を受け取る部品」の宣言を拾う（function 宣言・アロー関数のどちらも）
    const decls = [...src.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)\b/g)]
    for (let i = 0; i < decls.length; i++) {
      const from = decls[i].index
      const to = i + 1 < decls.length ? decls[i + 1].index : src.length
      const body = src.slice(from, to)
      // レシピを1品受け取り、一覧の行（<li）を返している部品だけを見る
      if (!/\brecipe:\s*Recipe\b/.test(body)) continue
      if (!/<li\b/.test(body)) continue
      if (/<RecipeCard\b/.test(body)) continue
      hwRowOffenders.push(`${rel} の ${decls[i][1]}`)
    }
  }
  eq('HW-3 一覧の1行は、どの画面でも共通のカードを通っている', hwRowOffenders, [])

  // ---- HW-5: 公開するページに、マージの競合の印が残っていない ----------------------------
  // 2026-08-19 便HW で、public/about/manual.html に `<<<<<<< HEAD` … `>>>>>>> ブランチ名` が
  // 1組そのまま残っているのを見つけた（利用者にその記号ごと表示される）。
  // 人の目では見落とすので、公開するHTML・JSONを機械で掃く。
  {
    const publicDir = path.join(hwRoot, 'public')
    const listPublicText = (dir) => {
      const out = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...listPublicText(full))
        else if (/\.(html|json|txt|webmanifest)$/.test(entry.name)) out.push(full)
      }
      return out.sort()
    }
    const publicFiles = listPublicText(publicDir)
    eq('HW-5 公開するページを走査できている（0件なら見張りが壊れている）', publicFiles.length > 0, true)
    const conflicted = publicFiles.filter((full) =>
      /^(<{7}|={7}|>{7})( |$)/m.test(readFileSync(full, 'utf-8')),
    )
    eq(
      'HW-5 公開するページにマージの競合の印が残っていない',
      conflicted.map((full) => path.relative(hwRoot, full).split(path.sep).join('/')),
      [],
    )
  }

  // ---- HW-4: カードの形を外からいじる口を増やしていない -----------------------------------
  // 密度を3つに絞っても、呼び出し側が見た目を上書きできる口（className・大きさ・変種）が
  // 開いていれば、そこから4つ目の形がこっそり生える。**口そのものが無い**ことを見張る。
  {
    const cardSrc = hwFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')
    eq('HW-4 共通のカード部品を読めている', cardSrc != null, true)
    const propsAt = cardSrc ? cardSrc.src.indexOf('type Props = {') : -1
    eq('HW-4 カードの受け口（Props）を読めている', propsAt >= 0, true)
    const propsBlock = propsAt >= 0 ? cardSrc.src.slice(propsAt, cardSrc.src.indexOf('\n}', propsAt)) : ''
    const forbidden = ['className', 'style', 'size', 'variant', 'compact', 'layout', 'width', 'height']
    eq(
      'HW-4 カードの形を外から変える口を持たない（形は「密度」だけで決める）',
      forbidden.filter((name) => new RegExp(`(^|\\s)${name}\\??:`, 'm').test(propsBlock)),
      [],
    )
  }

  // ---- HX-1: カードに「重ねて」出す表示が、指を素通りさせている ---------------------------
  // 2026-08-19 便HXで実際に出た後戻り: 便HWで骨格を組み替えたとき、栄養価の値バッジが
  // 押せる面（レシピ詳細へのリンク）の**外側**へ出た。「大」は指を素通りさせていたが
  // 「標準」は素通りさせておらず、一覧(リスト)表示ではバッジの上だけ押しても何も起きない
  // 死角になっていた（390px幅の実機で、押してもレシピ詳細へ行かないことを実測）。
  // 見えているかどうかだけを見ていると、この種の後戻りは一切引っかからない。
  {
    const cardSrc = hwFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')?.src ?? ''
    eq('HX-1 共通のカード部品を読めている', cardSrc.length > 0, true)
    // 値バッジを出している場所（「大」「標準」の2か所）を全部拾う。0件なら見張りが壊れている
    const badgeSpots = [...cardSrc.matchAll(/\{nutrientBadgeText &&/g)].map((m) => m.index)
    eq('HX-1 値バッジを出している場所を拾えている（0件なら見張りが壊れている）', badgeSpots.length >= 2, true)
    // 「標準」はバッジ自身が、「大」は外側の重ねの箱が pointer-events-none を持つので、
    // 直後のclassと直前のclassの**どちらか**にあれば通す（持たせ方を1つに縛らない）。
    // 見るのは class の中身だけ＝説明のコメントに同じ言葉が書いてあっても通らない
    const classAfter = (at) => cardSrc.slice(at, at + 600).match(/className="([^"]*)"/)?.[1] ?? ''
    const classBefore = (at) => {
      const found = [...cardSrc.slice(Math.max(0, at - 600), at).matchAll(/className="([^"]*)"/g)]
      return found.length > 0 ? found[found.length - 1][1] : ''
    }
    eq(
      'HX-1 カードに重ねる値バッジは指を素通りさせる（押せる面の外に死角を作らない）',
      badgeSpots.filter(
        (at) =>
          !classAfter(at).includes('pointer-events-none') &&
          !classBefore(at).includes('pointer-events-none'),
      ).length,
      0,
    )
  }
}

// ==========================================================================================
// HY-1〜HY-5: 「どの場所で、カードに何を載せるか」は1つの表で決まる（2026-08-19 便HY）
//
// オーナー原文:
//   「レシピカードはフォーマットが揃っていれば、それぞれの場所で不要な情報はなくして
//     シンプルにしたいのですが、どうでしょう？『今日なに作る？』だったら『基本レシピ』と
//     食材表記はいらないように感じました。」
//
// 便HN/便HWで**形**は3つの密度にそろった。便HYはその先の**引き算**で、決めごとは
// 「**削るのは自由・足すのは共通部品を通す**」。表は src/logic/cardParts.ts の1か所。
//
// **測り方の決めごと**（項目名を画面ごとに書き写して並べない＝場所が増えても当たる形にする）:
//   HY-1 … カードを出しているすべての場所が、表の「場所」のどれかに解決できること
//   HY-2 … 共通のカード部品が、表を通してからでないとその項目を描かないこと
//   HY-3 … 表に、カードが用意していない項目を書けないこと（＝その場で足せない）
//   HY-4 … 表に書いたのに一度も使われていない項目が無いこと（書いただけで効かない列を作らない）
//   HY-5 … **どの場所も、レシピを探す一覧より情報を増やしていない**こと。そのうえで
//          「今日なに作る？」の候補は、レシピを探す一覧より**少ない**こと（今回の引き算そのもの）
//
// **読み取りに失敗したら必ず落ちる**形にしてある（拾えた呼び出しが0件・描いている場所が0件なら
// その場で不合格。「見つからなかった＝合格」に倒れる書き方をしない）。
//
// HY_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る
// （この見張りが直す前のコードで本当に赤くなるかを確かめるための口）。
// ==========================================================================================
{
  const hyScriptDir = path.dirname(fileURLToPath(import.meta.url))
  const hyRoot = process.env.HY_SRC_ROOT ?? path.join(hyScriptDir, '..')
  const hySrcDir = path.join(hyRoot, 'src')

  const hyListTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...hyListTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const hyFiles = hyListTsx(hySrcDir).map((full) => ({
    rel: path.relative(hyRoot, full).split(path.sep).join('/'),
    src: readFileSync(full, 'utf-8'),
  }))
  eq('HY-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', hyFiles.length > 0, true)

  // ---- HY-1: カードを出す場所は、必ず表の「場所」に解決できる ----------------------------
  /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `>` に釣られない） */
  const hyCardOpenTags = (src) => {
    const tags = []
    let at = src.indexOf('<RecipeCard')
    while (at >= 0) {
      let depth = 0
      let end = -1
      for (let i = at; i < src.length; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) {
          end = i
          break
        }
      }
      if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
      tags.push(src.slice(at, end + 1))
      at = src.indexOf('<RecipeCard', end)
    }
    return { tags }
  }
  /** 開きタグ1つぶんの場所。読めなければ理由を返す（黙って既定に倒さない） */
  const hyPlaceOf = (tag) => {
    const literal = tag.match(/\bplace="([A-Za-z]+)"/)
    if (literal) {
      return Object.hasOwn(CARD_PLACE_PARTS, literal[1])
        ? { place: literal[1] }
        : { error: `表に無い場所: ${literal[1]}` }
    }
    // 省略は「レシピ一覧と同じ＝いちばん情報の多い側」。式で渡すのは読めないので不合格にする
    const expr = tag.match(/\bplace=\{([^}]*)\}/)
    if (expr) return { error: `場所の式が読めない: ${expr[1].trim()}` }
    return { place: DEFAULT_CARD_PLACE }
  }

  const hyCalls = []
  const hyTagErrors = []
  for (const { rel, src } of hyFiles) {
    if (rel === 'src/components/RecipeCard.tsx') continue
    const found = hyCardOpenTags(src)
    if (found.error) {
      hyTagErrors.push(`${rel}: ${found.error}`)
      continue
    }
    for (const tag of found.tags) hyCalls.push({ rel, ...hyPlaceOf(tag) })
  }
  eq('HY-1 カードの呼び出しを切り出せている（切り出せない書き方が無い）', hyTagErrors, [])
  eq(
    'HY-1 カードを出している場所を1つ以上拾えている（0件なら見張りが壊れている）',
    hyCalls.length > 0,
    true,
  )
  eq(
    'HY-1 すべての場所が表のどれかに解決できる（表に無い場所でカードを出していない）',
    hyCalls.filter((c) => c.error).map((c) => `${c.rel}: ${c.error}`),
    [],
  )

  // ---- HY-2: カード部品は、表を通してからでないとその項目を描かない ----------------------
  // 「その項目を実際に画面へ出している一行」を項目ごとに1つ決めて、そこへ辿り着く前に
  // 必ず表の判定（shows('◯◯')）を通っていることを見る。表を素通りして描き足した瞬間に赤くなる。
  {
    const hyCardSrc = hyFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')?.src ?? ''
    eq('HY-2 共通のカード部品を読めている', hyCardSrc.length > 0, true)
    /** 項目ごとの「画面へ出している印」。コメントではなく、描画に使っている式そのものを見る */
    const hyRenderMarks = {
      time: 'ja.recipes.minutesSuffix',
      effort: 'ja.effort[',
      season: 'ja.season[',
      starter: 'ja.card.starterBadge',
      ingredients: 'ingredientColorToken(',
    }
    // 表の項目と、印を持っている項目がぴったり一致していること
    // （どちらかにしか無い＝この見張りが片方を測っていない）
    eq(
      'HY-2 カタログの項目すべてに「画面へ出している印」がある（測り漏れが無い）',
      CARD_PART_KEYS.filter((key) => !(key in hyRenderMarks)),
      [],
    )
    eq(
      'HY-2 印の側に、カタログに無い項目が紛れていない',
      Object.keys(hyRenderMarks).filter((key) => !CARD_PART_KEYS.includes(key)),
      [],
    )
    const hyUnguarded = []
    const hyNotDrawn = []
    for (const [key, mark] of Object.entries(hyRenderMarks)) {
      const spots = []
      let at = hyCardSrc.indexOf(mark)
      while (at >= 0) {
        spots.push(at)
        at = hyCardSrc.indexOf(mark, at + mark.length)
      }
      // 描いている場所が1つも無い＝印が古い（見張りが何も測っていない）ので不合格にする
      if (spots.length === 0) {
        hyNotDrawn.push(`${key}（印: ${mark}）`)
        continue
      }
      for (const spot of spots) {
        // 直前800文字のあいだに表の判定があるか。密度ごとに書き方が違っても当たるよう、
        // 「どの入れ子の何段目か」ではなく**手前にあるか**だけで見る
        const before = hyCardSrc.slice(Math.max(0, spot - 800), spot)
        if (!before.includes(`shows('${key}')`)) hyUnguarded.push(`${key} @${spot}`)
      }
    }
    eq('HY-2 印が古くなっていない（どの項目も1か所以上で描かれている）', hyNotDrawn, [])
    eq(
      'HY-2 カタログの項目は、表を通してからでないと描かれない（表の外で描き足せない）',
      hyUnguarded,
      [],
    )
  }

  // ---- HY-3/HY-4: 表そのものの決まりごと -------------------------------------------------
  const hyPlaces = Object.keys(CARD_PLACE_PARTS)
  eq('HY-3 表に場所が1つ以上ある（0件なら見張りが壊れている）', hyPlaces.length > 0, true)
  eq(
    'HY-3 表に、カードが用意していない項目は書けない（その場で新しい項目を足せない）',
    hyPlaces.flatMap((place) =>
      CARD_PLACE_PARTS[place]
        .filter((key) => !CARD_PART_KEYS.includes(key))
        .map((key) => `${place}: ${key}`),
    ),
    [],
  )
  eq(
    'HY-3 同じ項目を1つの場所に2回書いていない',
    hyPlaces.filter((place) => new Set(CARD_PLACE_PARTS[place]).size !== CARD_PLACE_PARTS[place].length),
    [],
  )
  eq(
    'HY-4 表に書いたのに、どの場所でも使われていない項目が無い',
    CARD_PART_KEYS.filter((key) => !hyPlaces.some((place) => cardPartsFor(place).has(key))),
    [],
  )
  eq(
    'HY-4 省略したときの場所が表に載っている',
    Object.hasOwn(CARD_PLACE_PARTS, DEFAULT_CARD_PLACE),
    true,
  )

  // ---- HY-5: 引き算の向き（増やす方向へは動かない・候補は実際に減っている） ---------------
  // 「どの場所で何が出るか」を項目名で書き写すと、項目が増えた瞬間に写し直しが要る。
  // ここでは**場所どうしの大小**だけで測る＝新しい項目が増えても、場所が増えても当たる。
  {
    const hyFull = cardPartsFor(DEFAULT_CARD_PLACE)
    const hyGrew = hyPlaces.filter((place) =>
      [...cardPartsFor(place)].some((key) => !hyFull.has(key)),
    )
    eq(
      'HY-5 どの場所も、レシピを探す一覧より情報を増やしていない（削る方向だけ）',
      hyGrew,
      [],
    )
    const hySuggest = cardPartsFor('todaySuggest')
    eq(
      'HY-5 「今日なに作る？」の候補は、レシピを探す一覧より載せる情報が少ない（2026-08-19 オーナー指示）',
      hySuggest.size < hyFull.size && [...hySuggest].every((key) => hyFull.has(key)),
      true,
    )
  }
}

// ==========================================================================================
// 便HQ-3: 押せる面の共通の器（2026-08-18・軸7）
//
// 同じ役目の「閉じる／外す ✕」が 22px〜48px の7段階に散り、同じファイルの中で32pxと44pxが
// 混ざっていた（44px側にだけ「44px四方に広げる」意図のコメントが付いていた＝片方だけ直した跡）。
// 原因は **44px確保の共通の器が無く、毎回手書きだった** こと（`min-h-11` / `h-11 w-11` /
// `p-3` / `-m-2 p-3.5` の4通りが併存）。器（src/index.css の .tap-target）を1つ作って
// 全部そこへ載せたので、ここでは **クラス名の有無ではなく、1つずつ大きさを出して** 見張る。
//
// 測り方: ボタンに書いてあるクラスから、そのボタンが実際に何px四方になるかを出す
// （アイコンの大きさ＋padding、または h-/w-/min-h-/min-w- の指定。器を着けているものは
// 器が保証する大きさまで当たり判定が広がる＝その値は index.css から読む）。
// 対象は「文字のラベルを持たない＝アイコンだけのボタン」の ✕ とチェックの丸。
// 文字ラベル付きのボタンは高さを変えると見た目が変わるので、ここでは測らない。
//
// 実画面での当たり判定は scripts/e2e-smoke.mjs の TAP-44 が受け持つ（中心から21pxの点を
// 実際に突いて、押しても何も起きない場所が無いかを見る）。ここは e2e が開かない画面まで含めて
// 1つも取りこぼさないための静的な見張り。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const css = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')
  // 守る大きさ（44px）はここで決め、器が本当にその大きさを配っているかを index.css で確かめる。
  // 器が壊れたら「押せる面が広がっている」根拠が無くなるので、全部の✕がその場で赤くなる
  const REQUIRED = 44
  const tapMin = Number(css.match(/--tap-min:\s*(\d+)px/)?.[1] ?? 0)
  eq('HQ-3 押せる面の大きさは index.css の1か所で決めてある', tapMin, REQUIRED)
  eq(
    'HQ-3 器はその値で当たり判定を広げる（箱を大きくしない＝見た目を変えない）',
    /\.tap-target::after\s*\{[^}]*width:\s*var\(--tap-min\)[^}]*height:\s*var\(--tap-min\)[^}]*\}/.test(
      css,
    ),
    true,
  )

  // Tailwind の間隔は 1 = 4px（h-11 = 44px・p-3.5 = 14px）
  const spacing = (v) => Number(v) * 4
  const sizeOf = (cls, iconPx) => {
    const pick = (name) => {
      const m = cls.match(new RegExp(`(?:^|[\\s\`{])${name}-(\\d+(?:\\.\\d+)?)(?![\\w.-])`))
      return m ? spacing(m[1]) : undefined
    }
    const p = pick('p')
    const px = pick('px')
    const py = pick('py')
    const border = /(?:^|[\s`{])border(?![\w-])/.test(cls) ? 2 : 0
    const width = Math.max(pick('w') ?? iconPx + 2 * (px ?? p ?? 0) + border, pick('min-w') ?? 0)
    const height = Math.max(pick('h') ?? iconPx + 2 * (py ?? p ?? 0) + border, pick('min-h') ?? 0)
    // 器を着けているボタンは、箱が小さくても押せる面は器の大きさまで広がる
    const held = /(?:^|[\s`{])tap-target(?![\w-])/.test(cls) ? tapMin : 0
    return { width: Math.max(width, held), height: Math.max(height, held) }
  }

  /** JSXの開きタグの終わり（属性の中の { } と文字列は数えない） */
  const openTagEnd = (src, from) => {
    let depth = 0
    for (let i = from; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '"' || c === "'" || c === '`') {
        const quote = c
        i += 1
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') i += 1
          i += 1
        }
      } else if (c === '>' && depth === 0) return i + 1
    }
    return -1
  }

  const tsxFiles = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) walk(path.join(dir, name.name))
      else if (name.name.endsWith('.tsx')) tsxFiles.push(path.join(dir, name.name))
    }
  }
  walk(path.join(appRoot, 'src'))
  tsxFiles.sort()

  // アイコンだけのボタン＝押す場所そのもの。✕（閉じる・外す・消す）とチェックの丸を測る
  const ICONS = ['X', 'CheckCircle2']
  const tooSmall = []
  let measured = 0
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf-8')
    const rel = path.relative(appRoot, file)
    // 同じファイルの中でクラス文字列を定数にまとめている場合（iconBtnCls 等）に備えて先に読む
    const consts = {}
    for (const m of src.matchAll(/const (\w+) =\s*\n?\s*'([^']*)'/g)) consts[m[1]] = m[2]
    for (const icon of ICONS) {
      const iconRe = new RegExp(`<${icon} size=\\{(\\d+)\\}`, 'g')
      for (const m of src.matchAll(iconRe)) {
        const iconPx = Number(m[1])
        const at = m.index
        // 押す場所は <button> だけとは限らない。役割だけ button に見せた <span>・<div>・<a> があり、
        // **いちばん小さかった32pxの✕がまさにその形**だった（DayStartNotices の「閉じる」）。
        // タグ名で探すと、直したい当のものを測り漏らす。
        // そこで、アイコンの手前の開きタグを1つずつさかのぼり、
        // 最初に見つかった「押せる要素」（button/Link、または onClick か role="button" を持つもの）を持ち主とする。
        // 途中に見た目だけの入れ物（<span className>）が挟まっていても、その奥のボタンまで届く
        const HOLDERS = ['button', 'Link', 'span', 'div', 'a', 'label']
        let openIdx = -1
        let tagName = ''
        let cursor = at
        while (cursor > 0) {
          let best = -1
          let bestTag = ''
          for (const t of HOLDERS) {
            const i = src.lastIndexOf(`<${t}`, cursor - 1)
            // `<a` が `<article` に当たらないよう、タグ名の直後が空白か > であることを確かめる
            if (i > best && /[\s>/]/.test(src[i + 1 + t.length] ?? '')) {
              best = i
              bestTag = t
            }
          }
          if (best < 0) break
          const holderEnd = openTagEnd(src, best)
          const holderAttrs = holderEnd > 0 ? src.slice(best, holderEnd) : ''
          const clickable =
            bestTag === 'button' ||
            bestTag === 'Link' ||
            /onClick/.test(holderAttrs) ||
            /role="button"/.test(holderAttrs)
          if (clickable) {
            openIdx = best
            tagName = bestTag
            break
          }
          cursor = best
        }
        if (openIdx < 0) continue
        const bodyStart = openTagEnd(src, openIdx)
        const bodyEnd = src.indexOf(`</${tagName}>`, at)
        if (bodyStart < 0 || bodyEnd < 0 || bodyStart > at) continue
        // 文字のラベルを持つボタンは対象外（高さを変えると見た目が変わるため）
        const body = src
          .slice(bodyStart, bodyEnd)
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
          .replace(/<[A-Za-z][^>]*\/>/g, '')
        if (body.trim() !== '') continue
        const attrs = src.slice(openIdx, bodyStart)
        let cls =
          attrs.match(/className=\{`([\s\S]*?)`\}/)?.[1] ??
          attrs.match(/className="([^"]*)"/)?.[1] ??
          attrs.match(/className=\{(\w+)\}/)?.[1] ??
          ''
        if (consts[cls]) cls = consts[cls]
        cls = cls.replace(/\$\{(\w+)\}/g, (_, name) => ` ${consts[name] ?? ''} `)
        const line = src.slice(0, at).split('\n').length
        const { width, height } = sizeOf(cls, iconPx)
        measured += 1
        if (width < REQUIRED || height < REQUIRED)
          tooSmall.push(`${rel}:${line} ${width}x${height}`)
      }
    }
  }
  // 数そのものは決め打ちしない（画面が増えれば増える）。「1つも小さいものが無い」ことだけを見る
  eq('HQ-3 ✕とチェックの丸を1つ残らず測れている', measured > 30, true)
  eq('HQ-3 44px未満の✕・チェックの丸が1つも無い', tooSmall, [])
}

// ---------- 便HR: 数え方（助数詞）と呼び名の見張り（軸5・軸6） ----------
// 2026-08-18 便HP の洗い出しで、同じものを数えているのに助数詞が違う箇所が16件、
// 同じ画面・同じ操作を別の名前で呼んでいる箇所が16件見つかった。いちばん重いのは
//   ・献立から「買い物リストを作る」を押すと、着いた先の画面名が「買い物メモ」
//   ・1つの文の中で同じ数を「{n}件」と「{n}品」で数える（並行調理ナビの確認文）
// 個別の文字列を並べても次に文言が増えたときに素通りするので、**規則で捕まえる**。
//
// 決めた線引き（司令部裁定・2026-08-18）:
//   料理そのもの＝「品」…レシピ・献立に入っている料理・収録レシピ
//   記録や行やデータの本数＝「件」…作った記録・材料・手順・タイマー・下書き・食材・価格
//
// 見る先は「利用者の目に触れる文字」だけ。ja.ts はコメントを外した文字列、
// public/about/*.html はタグを外した本文を見る（foods.html は生成物なので
// 直す先は scripts/gen-food-price-page.mjs だが、出来上がりの文字を測る）。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

  // 落とした部分は空白に置き換える（改行だけ残す）。行番号が原文とずれると、
  // 赤が出たときに直す場所を探せなくなるため
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  /** ja.ts からコメント（ブロック・行）を落として、画面に出る文字だけにする */
  const stripTsComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + blank(m.slice(p1.length)))
  /** HTML から <script>/<style>/コメント/タグを落として本文だけにする */
  const stripHtml = (src) =>
    src
      .replace(/<script[\s\S]*?<\/script>/gi, blank)
      .replace(/<style[\s\S]*?<\/style>/gi, blank)
      .replace(/<!--[\s\S]*?-->/g, blank)
      .replace(/<[^>]+>/g, blank)

  const sources = []
  {
    const jaSrc = stripTsComments(readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8'))
    sources.push({ rel: 'src/i18n/ja.ts', text: jaSrc })
    const aboutDir = path.join(appRoot, 'public/about')
    // コラム(public/about/column/)も利用者が読むページなので同じ規則で見る
    for (const e of readdirSync(aboutDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const files = e.isDirectory()
        ? readdirSync(path.join(aboutDir, e.name))
            .filter((f) => f.endsWith('.html'))
            .sort()
            .map((f) => `${e.name}/${f}`)
        : e.name.endsWith('.html')
          ? [e.name]
          : []
      for (const f of files)
        sources.push({
          rel: `public/about/${f}`,
          text: stripHtml(readFileSync(path.join(aboutDir, f), 'utf-8')),
        })
    }
    // お知らせ(アプリの中で読む文章)も同じ規則で見る
    sources.push({
      rel: 'public/news.json',
      text: readFileSync(path.join(appRoot, 'public/news.json'), 'utf-8'),
    })
    // 生成元も同じ規則で見る（foods.html だけ直しても次の生成で戻るため）
    sources.push({
      rel: 'scripts/gen-food-price-page.mjs',
      text: stripTsComments(readFileSync(path.join(appRoot, 'scripts/gen-food-price-page.mjs'), 'utf-8')),
    })
  }

  const lineOf = (text, at) => text.slice(0, at).split('\n').length
  /** 前後を切り出して、赤が出たときにどこの話か読めるようにする */
  const around = (text, at, before = 14, after = 8) =>
    text.slice(Math.max(0, at - before), at + after).replace(/\s+/g, ' ').trim()

  // ---- 規則①: 数える名詞のうしろに付く助数詞 ----
  // 数の直前 8文字の中に出てくる**最後の**名詞で、どちらの助数詞かが決まる。
  // 「この料理の他の作った記録{n}件」のように名詞が2つ出るときは、数に近いほうが勝つ。
  const NOUN_COUNTER = [
    // 料理そのもの＝品
    ['レシピ', '品'],
    ['献立', '品'],
    ['料理', '品'],
    ['主菜', '品'],
    ['副菜', '品'],
    // 記録・行・データの本数＝件
    ['作った記録', '件'],
    ['記録', '件'],
    ['材料', '件'],
    ['手順', '件'],
    ['タイマー', '件'],
    ['下書き', '件'],
    ['食材', '件'],
    ['価格', '件'],
  ]
  const NUM = '(?:\\{[A-Za-z][A-Za-z0-9]*\\}|[0-9０-９]+|◯)'
  const counterRe = new RegExp(`${NUM}(件|品)`, 'g')
  const counterViolations = []
  for (const { rel, text } of sources) {
    for (const m of text.matchAll(counterRe)) {
      const counter = m[1]
      // タグ・改行・字下げを詰めてから直前の8文字を見る（HTMLでは名詞とのあいだに
      // タグが挟まるため、文字数だけで切ると名詞を取りこぼす）
      const window = text
        .slice(Math.max(0, m.index - 80), m.index)
        .replace(/\s+/g, '')
        .slice(-8)
      let noun = null
      let want = null
      let bestAt = -1
      for (const [word, c] of NOUN_COUNTER) {
        // 「記録した{n}品」の「記録」のように、動詞として使われている語は数える名詞ではない
        let at = window.lastIndexOf(word)
        while (at >= 0 && window.slice(at + word.length).startsWith('し'))
          at = window.lastIndexOf(word, at - 1)
        if (at > bestAt) {
          bestAt = at
          noun = word
          want = c
        }
      }
      // 「全{n}品」のように直前に名詞が無い数え方は、文だけでは何を数えているか決められない。
      // ここでは判定せず、書く人が節（レシピ一覧なら品／記録の一覧なら件）で決める
      if (bestAt < 0) continue
      if (counter !== want)
        counterViolations.push(
          `${rel}:${lineOf(text, m.index)} 「${around(text, m.index)}」＝${noun}なので「${want}」`,
        )
    }
  }
  eq('HR-1 数える名詞と助数詞（品／件）が食い違う文言が1つも無い', counterViolations, [])


  // ---- 規則②: 同じ言葉の書き分け（送り仮名・漢数字・呼び名） ----
  // 「どちらでもよい」ものを2通り書くと、次に足す人がどちらを見るかで割れる。片方を正にする。
  const WORD_RULES = [
    { name: 'か月', bad: /ヶ月|ケ月|カ月/g, good: '「か月」' },
    { name: '杯分', bad: /杯ぶん/g, good: '「杯分」' },
    { name: '1品', bad: /一品(?!もの)/g, good: '「1品」（「一品もの」は料理の種類の名前なので対象外）' },
    { name: '買い物メモ', bad: /買い物リスト/g, good: '「買い物メモ」（タブと見出しに出ている名前）' },
    {
      name: '月間の献立',
      bad: /月間表示|月間ビュー|月間の献立表|月間献立/g,
      good: '「月間の献立」（月タブの見出しに出ている名前）',
    },
    // 無料の登録上限は、紹介ページ・使い方ページ・お知らせが全部「30品」で書いてある。
    // アプリ側だけ「件」で書くと、同じ数字が2通りに読める
    { name: '登録上限は品', bad: /30件|件登録できます|件を超えて登録/g, good: '「品」' },
  ]
  const wordViolations = []
  for (const { rel, text } of sources) {
    for (const rule of WORD_RULES) {
      for (const m of text.matchAll(rule.bad))
        wordViolations.push(`${rel}:${lineOf(text, m.index)} 「${around(text, m.index)}」→ ${rule.good}`)
    }
  }
  eq('HR-2 書き分けの揺れ（ヶ月・杯ぶん・一品・買い物リスト・月間◯◯）が1つも無い', wordViolations, [])

  // ---- 規則③: 共通語を各画面で書き写していない ----
  // 同じ「閉じる」を6か所で別々に定義していたため、片方だけ変えると割れる状態だった。
  // ja.common に1本だけ持ち、画面側は ja.common.close を参照する。
  {
    const jaRaw = readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')
    const dup = (word) => (stripTsComments(jaRaw).match(new RegExp(`:\\s*'${word}'`, 'g')) ?? []).length
    eq('HR-3 「閉じる」の定義は ja.common の1か所だけ', dup('閉じる'), 1)
    eq('HR-3 「やめる」の定義は ja.common の1か所だけ', dup('やめる'), 1)
  }

  // ---- 規則④: 案内文が読み上げるボタン名が実在する ----
  // 「『◯◯』を押します」と書いてあるのに、そのボタンが別の名前になっている案内があった。
  // ja.ts の中の「…」を押す/押します の引用を全部拾い、ja.ts のどこかに同じ文字列の
  // 値があるかを見る（{n} のような差し込みは ◯ に均してから比べる）。
  {
    const jaRaw = readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')
    const jaSrc = stripTsComments(jaRaw)
    const toKey = (s) => s.replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, '◯')
    const values = new Set()
    for (const m of jaSrc.matchAll(/'((?:[^'\\]|\\.)*)'/g)) values.add(toKey(m[1]))
    // アプリの中の言葉でないボタン名（引用しても ja.ts には無いのが正しいもの）。
    // 1つずつ理由を書く。増やすときも理由なしで足さないこと
    const NOT_IN_JA = new Set([
      // 端末（ブラウザ・OS）側のボタン。うちレシピの文言ではない
      'ホーム画面に追加',
      'インストール',
      // 分数・食事の名前を差し込んで組み立てるボタン。組み立て後の文字列は ja.ts に無い
      // （タイマーのチップ ja.focus.timerChip「{n}分」／食事の枠 ja.mealPlan の朝食・昼食・夕食）
      '15分',
      '夕食に入れる',
      // 章の中で説明している考え方の呼び名（栄養の「概算」と「めやす」）。画面のボタンではない
      'めやす',
    ])
    // 案内文が引用しているボタン名（3文字以上。「＋」「×」のような記号1つは対象外）。
    // ja.ts と、利用者が読むページ（紹介・使い方）の両方を見る＝ボタン名を変えたのに
    // 使い方ページだけ古い名前のまま、という食い違いをここで捕まえる
    //
    // 2026-08-19 便IE: 拾う言い方を「押す」だけから広げた。使い方ページには
    // 「『提案の条件』を開くと」「『レシピを総入れ替え』を選ぶと」のように**押す以外の動詞**で
    // 操作を説明している文が多く、そこに残っていた旧名（提案の条件→現在の条件、
    // レシピを総入れ替え→総入れ替え、まだ決まっていない枠だけ埋める→空いた枠だけ）を
    // この見張りが1つも拾えていなかった。操作の動詞を増やせば、同じ取りこぼしは起きない
    const missing = []
    const quoteTargets = [{ rel: 'src/i18n/ja.ts', text: jaSrc }].concat(
      sources.filter((s) => s.rel.startsWith('public/about/')),
    )
    // 「◯◯」に続く操作の言い方。押す・開く・選ぶ・タップする・入れる（ONにする）まで見る
    const OPERATION_VERBS = /「([^「」]{3,40})」を(?:押|開(?:く|き|いた|いて)|選(?:ぶ|び|ん)|タップ)/g
    for (const { rel, text } of quoteTargets) {
      for (const m of text.replace(/\s+/g, ' ').matchAll(OPERATION_VERBS)) {
        const name = toKey(m[1])
        // ボタンの名前に読点・句点は入らない。「『鮭にするか、ぶりにするか』を選ぶ」のような
        // 地の文の引用まで拾うと、この見張りが「直しようのない赤」で埋まる
        if (/[、。？！]/.test(name)) continue
        if (!values.has(name) && !NOT_IN_JA.has(name)) missing.push(`${rel} 「${m[1]}」`)
      }
    }
    eq('HR-4 案内文が引用するボタン名が ja.ts に実在する', missing, [])

    // ---- 規則④-2: 使い方ページ・紹介ページが**太字で名指ししている画面の言葉** ----------
    // 2026-08-19 便IE。上の規則④は「◯◯」を押す/開く/選ぶ の形にしか当たらないので、
    // 「最初は『まだ決まっていない枠だけ埋める』で」のように動詞を伴わない引用は素通りしていた。
    //
    // これらのページは**画面に出ている言葉を太字の「」で名指しする**書き方でそろえてあるので、
    // その形（<strong>「◯◯」</strong>）を丸ごと見張る。ページの書き方そのものを物差しにするので、
    // 章が増えても当たる（「押す」以外の言い方で説明しても拾える）。
    //
    // {n} のような差し込みのある文言は、埋めたあとの文字列がページに載る。差し込みを
    // 「何か1文字以上」に読み替えて照合するが、**差し込みを除いた地の文が6文字以上ある
    // ものだけ**をその照合に使う（'{name} {n}' のような、ほぼ差し込みだけの文言を
    // 物差しにすると何にでも当たってしまい、この見張りが何も測らなくなる）
    const boldNames = []
    const boldMissing = []
    const jaTemplates = []
    for (const value of values) {
      if (!value.includes('◯')) continue
      if (value.replace(/◯/g, '').length < 6) continue
      jaTemplates.push(
        new RegExp(`^${value.split('◯').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`),
      )
    }
    // 太字は印そのものを見るので、タグを外す前の生のHTMLを読む
    const boldSources = sources
      .filter((s) => s.rel.startsWith('public/about/'))
      .map((s) => ({ rel: s.rel, raw: readFileSync(path.join(appRoot, s.rel), 'utf-8') }))
    for (const { rel, raw } of boldSources) {
      for (const m of raw.replace(/<!--[\s\S]*?-->/g, ' ').matchAll(
        /<strong>\s*「([^「」<>]{3,40})」\s*<\/strong>/g,
      )) {
        const name = toKey(m[1])
        boldNames.push(name)
        if (values.has(name) || NOT_IN_JA.has(name)) continue
        if (jaTemplates.some((re) => re.test(name))) continue
        boldMissing.push(`${rel} 「${m[1]}」`)
      }
    }
    // 拾えた数が0なら、ページの書き方が変わって物差しが当たらなくなったということ
    eq('HR-4 使い方ページが太字で名指ししている画面の言葉を拾えている', boldNames.length > 0, true)
    eq('HR-4 太字で名指ししている画面の言葉が ja.ts に実在する', boldMissing, [])
  }

  // ---- 規則⑤: 絞り込みの欄の呼び名がそろっている（2026-08-20 便IH・①） --------------------
  // オーナー原文:
  //   「絞り込み『タグ』は、追加可能になった＝タグ以外も登録できる、ので、『ワード』
  //     『キーワード』のような別の名前がいいのでは？このアプリでの『タグ』は
  //     レシピカードに表示されるワードなので。」→ **キーワードに改名OK**
  //
  // 線引き: 絞り込みの欄＝「キーワード」／レシピカードに出る印＝「タグ」。タグはキーワードの一種。
  //
  // 半端に直すと**新しい食い違い**になる（アプリは新しい名前、使い方ページは古い名前）ので、
  // 個別の文字列を並べずに規則で掃く:
  //   IH-1 … 「絞り込みの◯◯」と名指ししている呼び名は、**全部 ja.ts の欄の見出しと同じ**
  //          （見出しを別の名前に変えたら、掃く物差しもそれに追随する＝文字を書き写さない）
  //   IH-2 … 絞り込みの話と同じ文に「タグ」が出るなら、**レシピに付いている印だと分かる書き方**
  //          （文の中で「レシピ」と名乗る）にする。絞り込みの欄そのものを指す裸の「タグ」は残せない
  //
  // 読み取りに失敗したら必ず落ちる: 名指ししている箇所が1つも拾えない／絞り込みの話が
  // 1文も拾えないときは、その場で不合格にする（「見つからなかった＝合格」に倒れない）。
  {
    const jaRaw = readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')
    const jaSrc = stripTsComments(jaRaw)

    /** 文の単位に切る（。！？で切る。空白だけの断片は捨てる） */
    const toSentences = (text) =>
      text
        .split(/[。！？\n]/)
        .map((t) => t.replace(/\s+/g, ' ').trim())
        .filter((t) => t !== '')

    /** 利用者の目に触れる文（どこの文かを添える）。ja.ts は文字列1つずつ、ページは段落1つずつ */
    const uiSentences = []
    for (const m of jaSrc.matchAll(/'((?:[^'\\]|\\.)*)'/g))
      for (const sentence of toSentences(m[1]))
        uiSentences.push({ rel: `src/i18n/ja.ts:${lineOf(jaSrc, m.index)}`, sentence })
    // ページは**段落・箇条書きの区切りで切る**（<strong>のような文の途中に入る印では切らない）。
    // 区切らずに切ると隣の項目とつながって、関係の無い語どうしを同じ文として測ってしまう
    const BLOCK_TAGS =
      /<\/?(?:p|li|h[1-6]|td|th|div|section|ul|ol|figure|figcaption|br|blockquote|table|tr|dl|dt|dd|details|summary|header|footer|main|nav|article|aside)\b[^>]*>/gi
    for (const { rel } of sources.filter((x) => x.rel.startsWith('public/about/'))) {
      const raw = readFileSync(path.join(appRoot, rel), 'utf-8')
      const body = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<!--[\s\S]*?-->/g, ' ')
      // 図の説明（alt）も読み上げで耳に入る文なので同じ規則で見る
      for (const m of body.matchAll(/\balt="([^"]*)"/g))
        for (const sentence of toSentences(m[1])) uiSentences.push({ rel: `${rel}(図の説明)`, sentence })
      for (const sentence of toSentences(body.replace(BLOCK_TAGS, '\n').replace(/<[^>]+>/g, '')))
        uiSentences.push({ rel, sentence })
    }
    eq('IH-1 利用者の目に触れる文を拾えている（0件なら見張りが壊れている）', uiSentences.length > 0, true)

    // --- IH-1: 「絞り込みの◯◯」の呼び名は、絞り込みの欄の見出しと同じ言葉だけ ---
    // 物差しは ja.ts の見出しそのもの（文字を書き写さない）
    const filterFieldName = ja.search.tagTitle
    eq('IH-1 絞り込みの欄の見出しを読めている', typeof filterFieldName === 'string' && filterFieldName.length > 0, true)
    // 「絞り込みの「◯◯」」と、かっこ無しで「絞り込みの◯◯に登録／に並び／から削除」の2通りを拾う
    const NAMED_QUOTED = /絞り込み(?:の|に)「([^「」]{1,14})」/g
    const NAMED_PLAIN = /絞り込み(?:の|に)([^\s、。「」]{2,10}?)(?=に登録|に並|から削除|に当たる)/g
    const namedHits = []
    for (const { rel, sentence } of uiSentences)
      for (const re of [NAMED_QUOTED, NAMED_PLAIN])
        for (const m of sentence.matchAll(re)) namedHits.push({ rel, name: m[1], sentence })
    eq('IH-1 絞り込みの欄を名指ししている文言を拾えている（0件なら見張りが壊れている）', namedHits.length > 0, true)
    eq(
      'IH-1 絞り込みの欄の呼び名が、画面の見出しと1つにそろっている',
      namedHits.filter((h) => h.name !== filterFieldName).map((h) => `${h.rel} 「${h.name}」→「${filterFieldName}」（${h.sentence}）`),
      [],
    )

    // --- IH-5: アプリの中でしか通じない造語を、画面の言葉に使わない ---
    // 2026-08-20 便IH・① オーナー「当たった先の表記：『当たった先』『当たり先』→違う言葉ない？
    // 一般的にこういうアプリではどう言っているの？」
    //
    // 「当たった先」「当たり先」は司令部と便が作った造語で、他のアプリでは使われていない。
    // 検索の結果がなぜ出たのかを言うときの一般的な語は「一致」。
    // （「ハイライト」＝文字に色を付けるやり方はいちばん多いが、手順の調理器具・材料の分類のように
    // **画面に出ていない場所**での一致を指せないので、このアプリでは使えない）
    //
    // 表に1行足すだけで次の造語も掃ける形にしてある。理由なしで足さないこと
    const COINED_WORDS = [
      {
        bad: /当たった先|当たり先/g,
        good: '「一致した場所」（検索の結果がなぜ出たのかを言う一般的な語。2026-08-20 便IH・①）',
      },
    ]
    const coined = []
    for (const { rel, sentence } of uiSentences)
      for (const rule of COINED_WORDS)
        for (const m of sentence.matchAll(rule.bad))
          coined.push(`${rel} 「${m[0]}」→ ${rule.good}（${sentence}）`)
    eq('IH-5 アプリの中でしか通じない造語が、画面の言葉に1つも無い', coined, [])

    // --- IH-2: 絞り込みの話と同じ文の「タグ」は、レシピに付いている印だと分かる書き方 ---
    const filterSentences = uiSentences.filter((x) => x.sentence.includes('絞り込'))
    eq('IH-2 絞り込みの話をしている文を拾えている（0件なら見張りが壊れている）', filterSentences.length > 0, true)
    eq(
      'IH-2 絞り込みの話と同じ文の「タグ」は、レシピに付いている印だと分かる書き方になっている',
      filterSentences
        .filter((x) => x.sentence.includes('タグ') && !x.sentence.includes('レシピ'))
        .map((x) => `${x.rel} 「${x.sentence}」`),
      [],
    )
  }

  // ---- 規則⑥: 使い方ページの図が、いまの画面とそろっている（2026-08-20 便IK） -------------
  // オーナー原文（この便の発端）:
  //   「④画像あった方がいい。
  //     ・説明で画像がないため「（畳んでいる時も押せます）など見た目を説明したり捕捉する文が
  //       省けるのは嬉しい」
  //
  // 図で言葉を省く以上、**図が古くなると説明そのものが消える**。文章なら「古い名前が
  // 書いてある」と読めば気づけるが、図は撮り直しを忘れても見た目は何ともないので気づけない。
  // そこで図まわりの食い違いだけを機械で掃く:
  //   IK-1 … ページが載せている図・撮る仕組み（shots-manual.mjs の SHOT_NAMES）・撮影の控え
  //          （manual-shot-sizes.json）の3つが1対1（撮ったのに載せていない／載せているのに
  //          誰も撮らない図を作らない＝撮り直しの対象から漏れる図をなくす）
  //   IK-2 … <img> の width/height が撮影の控えと同じ（撮り直して縦横が変わったのに
  //          ページの数字が古いままだと、その図だけ縦横比が狂って出る）
  //   IK-3 … どの図にも説明（alt）と題（figcaption）がある。図で言葉を省くほど、
  //          目で見られない人が頼れるのは alt だけになる
  //   IK-4 … 図の説明・題が「」で名指ししている**画面の言葉**が ja.ts に実在する
  //          （規則④を図に広げたもの。ボタン名を変えたのに図の説明だけ古い名前のまま、を捕まえる）
  //
  // 読み取りに失敗したら必ず落ちる: 図が0枚・カット名が0件のときはその場で不合格にする
  // （「見つからなかった＝合格」に倒れない）。
  {
    const manualRel = 'public/about/manual.html'
    const manualRaw = readFileSync(path.join(appRoot, manualRel), 'utf-8')
    const shotsRaw = readFileSync(path.join(appRoot, 'scripts/shots-manual.mjs'), 'utf-8')
    const shotSizes = JSON.parse(
      readFileSync(path.join(appRoot, 'scripts/data/manual-shot-sizes.json'), 'utf-8'),
    )

    // 撮る仕組みが持っているカット名は、配列そのものから読む（名前を書き写さない）
    const shotNamesBlock = shotsRaw.match(/const SHOT_NAMES = \[([\s\S]*?)\n\]/)
    eq('IK-1 撮る仕組みのカット名を読めている', shotNamesBlock !== null, true)
    const shotNames = shotNamesBlock
      ? [...shotNamesBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
      : []
    eq('IK-1 撮る仕組みのカット名を1つ以上読めている', shotNames.length > 0, true)

    const figures = []
    for (const m of manualRaw.matchAll(/<figure\b[^>]*>([\s\S]*?)<\/figure>/g)) {
      const inner = m[1]
      const img = inner.match(/<img\s+src="\/about\/img\/manual\/([a-z0-9-]+)\.webp"([^>]*)>/)
      figures.push({
        name: img?.[1] ?? null,
        w: Number(img?.[2].match(/\swidth="(\d+)"/)?.[1]),
        h: Number(img?.[2].match(/\sheight="(\d+)"/)?.[1]),
        alt: inner.match(/\salt="([^"]*)"/)?.[1] ?? '',
        caption: (inner.match(/<figcaption>([\s\S]*?)<\/figcaption>/)?.[1] ?? '')
          .replace(/<[^>]+>/g, '')
          .trim(),
      })
    }
    eq('IK-1 使い方ページの図を読めている（0枚なら見張りが壊れている）', figures.length > 0, true)

    const used = figures.map((f) => f.name).filter((n) => n !== null)
    eq(
      'IK-1 ページのすべての図が /about/img/manual/ の webp',
      figures.filter((f) => f.name === null).map((f) => f.alt.slice(0, 30) || '(説明の無い図)'),
      [],
    )
    eq('IK-1 ページが載せている図は、撮る仕組みが撮っているものだけ', used.filter((n) => !shotNames.includes(n)), [])
    eq('IK-1 撮る仕組みが撮る図は、すべてページが載せている', shotNames.filter((n) => !used.includes(n)), [])
    eq('IK-1 撮影の控えに残っている図は、すべてページが載せている', Object.keys(shotSizes).filter((n) => !used.includes(n)), [])
    eq(
      'IK-1 図のファイルが実在する',
      used.filter((n) => !existsSync(path.join(appRoot, `public/about/img/manual/${n}.webp`))),
      [],
    )

    eq(
      'IK-2 図の width/height が撮影の控えと同じ',
      figures
        .filter((f) => f.name && shotSizes[f.name])
        .filter((f) => shotSizes[f.name].w !== f.w || shotSizes[f.name].h !== f.h)
        .map((f) => `${f.name} ページ=${f.w}x${f.h} 撮影=${shotSizes[f.name].w}x${shotSizes[f.name].h}`),
      [],
    )
    eq(
      'IK-2 撮影の控えに無い図をページに載せていない',
      figures.filter((f) => f.name && !shotSizes[f.name]).map((f) => f.name),
      [],
    )

    eq(
      'IK-3 どの図にも説明（alt）がある',
      figures.filter((f) => f.alt.trim().length < 6).map((f) => f.name ?? '(名前の取れない図)'),
      [],
    )
    eq(
      'IK-3 どの図にも題（figcaption）がある',
      figures.filter((f) => f.caption.length < 2).map((f) => f.name ?? '(名前の取れない図)'),
      [],
    )

    // --- IK-4: 図の説明・題が名指ししている画面の言葉 ---
    // 差し込み（{n}）も画面に出る数字も ◯ に均してから比べる。頭の「＋」は絵の代わりの飾りなので落とす
    const figNorm = (s) =>
      s
        .replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, '◯')
        .replace(/[0-9０-９]+/g, '◯')
        .replace(/^[＋+]/, '')
    const figJaSrc = stripTsComments(readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8'))
    const figValues = new Set()
    for (const m of figJaSrc.matchAll(/'((?:[^'\\]|\\.)*)'/g)) figValues.add(figNorm(m[1]))
    const figTemplates = []
    for (const value of figValues) {
      if (!value.includes('◯')) continue
      // ほぼ差し込みだけの文言（'{name} {n}' など）を物差しにすると何にでも当たってしまう
      if (value.replace(/◯/g, '').length < 6) continue
      figTemplates.push(
        new RegExp(
          `^${value
            .split('◯')
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.+')}$`,
        ),
      )
    }
    // ja.ts に無くて当たり前のもの。**1つずつ理由を書く。理由なしで足さないこと**
    const NOT_SCREEN_WORDS = new Set(
      [
        // ①デモに写り込むレシピ名・食材名。レシピの中身なので、画面の文言を変えても古くならない
        'カレーライス',
        '肉じゃが',
        '豚汁',
        'ほうれん草のおひたし',
        '鶏むね肉',
        'たまねぎ',
        '玉ねぎ',
        // ②レシピに書いた手順の本文と、調理用語の見出し（用語は src/data/cookingTerms.ts が持つ）
        '鍋にたっぷりの湯を沸かす',
        '落としぶた',
        // ③画面がその場で組み立てて出す文字（見出し＋補足／売り場名＋件数）。
        //   組み上がった形は ja.ts のどこにも無い
        '栄養価の概算（◯人分で作るときの◯食あたり）',
        '肉・魚介 ◯件',
        '調味料 ◯件',
        // ④並行調理ナビの色の名前は src/logic/naviColors.ts（NAVI_COLOR_WORDS）が持っている。
        //   声で言う語なので ja.ts の画面文言ではない
        'ピンク',
      ].map(figNorm),
    )
    const figNames = []
    const figMissing = []
    for (const f of figures) {
      for (const text of [f.alt, f.caption]) {
        for (const m of text.matchAll(/「([^「」]{2,40})」/g)) {
          const name = figNorm(m[1])
          figNames.push(name)
          if (figValues.has(name) || NOT_SCREEN_WORDS.has(name)) continue
          if (figTemplates.some((re) => re.test(name))) continue
          figMissing.push(`${f.name ?? '(名前の取れない図)'} 「${m[1]}」`)
        }
      }
    }
    eq('IK-4 図が名指ししている画面の言葉を拾えている（0件なら見張りが壊れている）', figNames.length > 0, true)
    eq('IK-4 図の説明・題が名指ししている画面の言葉が ja.ts に実在する', figMissing, [])
  }

  // ---- 規則⑦: 意味を担う語がひらがなで書かれていない（2026-08-21 便IM・規約H-2） ----------
  // オーナー原文（この規則の発端）:
  //   「ひらがな表記が多いのが気になりますが、どう言った基準ですか？ある程度難しい語彙や、
  //     漢字ばかりの場所ではひらがなの方が良いことも多いですが、「えらびました」「ちがえば」は
  //     やり過ぎな気がします。丁寧というより、稚拙な印象になる。」
  //
  // 規約H-2（オーナー承認済み）は**両向き**の決めごとで、どちらも同じ重み:
  //   ①意味を担う語は漢字（選ぶ・違う・作る・使う・見る・決める・探す）
  //   ②補助的な語はひらがな（〜してください／〜のとき／〜すること。「下さい」「時」「事」と書かない）
  //   ③丁寧にするためのひらがな化はしない
  //
  // 直した文言を並べても、**次に書く人が同じことをする**ので掃けない。ここでは
  // 「かな書きのつづり」そのものを見張る＝次に誰かが「えらびました」と書いたら赤くなる。
  //
  // 表に1行足せば掃ける語が増える。**外している語は下に1件ずつ理由を書く**（理由なしで足さない）:
  //   ・「〜してみる」「〜しておく」「〜していく」など**補助動詞**は、かなが正しいので見張らない
  //     （「使ってみる」を「使って見る」と書かせない）。「見る」は「〜を見る」の形だけ見る
  //   ・「消す」は見張らない … 「色分けします」「振り分けする」のように、別の語の一部に
  //     できてしまう並びで、本物の「けす」と見分けられない
  //   ・「くわしく」「かんたん」は見張らない … レシピ登録画面のタブ名がこの2つで、使い方ページの
  //     図（スクリーンショット）にも写っている。名前ごと変えるかは司令部の判断待ち（便IMの報告）
  //   ・「ひとつまみ」は外す … 分量の言い方（料理の言葉）で、数の「1つ」ではない
  //   ・「のぞく」は「〜は／を のぞく」の形だけ … 「（サイトを）のぞいてみる」＝覗く は
  //     常用漢字表に無いので、かなで書くのが正しい
  //   ・「はかる」「めやす」「おまかせ」「まるごと」「いちばん」「まったく」「ほとんど」「すでに」は
  //     見張らない … いずれも**このアプリでは、かな書きのほうが多数か唯一**で、
  //     かな書きが慣用の語（便IMの報告に一覧と数を載せた。倒すなら司令部の裁定が要る）
  {
    // ゼロ幅スペース（BudouX）が挟まっても素通りしないよう、照合の前に外す。
    // 改行は消さないので、赤に出る行番号は原文のまま
    const kanaSources = sources.map((s) => ({ rel: s.rel, text: s.text.replace(/​/g, '') }))
    const NOT_AFTER_KANJI = '(?<![一-龥])'
    const KANA_RULES = [
      // ①意味を担う語が、かなで書かれていないか
      { anchor: '選', good: '「選ぶ」', bad: /えら[ぶびべばんぼ]/g },
      // 「気持ちがうまく」のように**漢字＋ち＋が**で偶然できる並びは数えない
      { anchor: '違', good: '「違う」', bad: new RegExp(`${NOT_AFTER_KANJI}ちが[ういえわっ]`, 'g') },
      { anchor: '間違', good: '「間違う」', bad: /まちが[ういえわっ]/g },
      { anchor: '作', good: '「作る」', bad: /つく[るりれらろっ]/g },
      // 「見つかった」を数えないため、漢字のうしろは外す
      { anchor: '使', good: '「使う」', bad: new RegExp(`${NOT_AFTER_KANJI}つか[ういえわっ]`, 'g') },
      { anchor: '探', good: '「探す」', bad: /さが[すしせそ]/g },
      { anchor: '決', good: '「決める」', bad: /きめ[るたてよ]|きま[るりっ]/g },
      { anchor: '戻', good: '「戻す」', bad: /もど[るりすしせら]/g },
      { anchor: '開', good: '「開く」', bad: /ひら[くきけこ]/g },
      { anchor: '並', good: '「並ぶ」', bad: /なら[ぶびべん]/g },
      // 補助動詞の「〜てみる」と分けるため、「〜を見る」「〜が見える」の形だけ見る
      { anchor: '見', good: '「見る」', bad: /[をが]み[るれ]/g },
      { anchor: '含', good: '「含む」', bad: /ふく[むめま]/g },
      { anchor: '除', good: '「除く」', bad: /[はをも]のぞ[きくけ]/g },
      { anchor: '当てはま', good: '「当てはまる」', bad: /あてはま/g },
      { anchor: '分か', good: '「分かる」', bad: /わか[るりれら]/g },
      { anchor: '全部', good: '「全部」', bad: /ぜんぶ/g },
      { anchor: '普通', good: '「普通」', bad: /ふつう/g },
      { anchor: '控えめ', good: '「控えめ」', bad: /ひかえめ/g },
      { anchor: '少し', good: '「少し」', bad: /すこし/g },
      { anchor: '直ちに', good: '「直ちに」', bad: /ただちに/g },
      // 「ひとつまみ」は分量の言い方なので外す
      { anchor: '1つ', good: '「1つ」', bad: /ひとつ(?!まみ)/g },
      // ②補助的な語が、漢字で書かれていないか（公用文の一般的な作法）
      { anchor: 'ください', good: '「ください」', bad: /下さい/g },
      { anchor: 'こと', good: '「こと」', bad: /(?:する|した|ない|ある)事(?![務業実情態項柄件])/g },
      { anchor: 'とき', good: '「とき」', bad: /(?:する|した|ない|ある)時(?![間刻代計点期差々])/g },
      { anchor: 'できる', good: '「できる」', bad: /出来[るたなま]/g },
    ]
    const kanaViolations = []
    for (const { rel, text } of kanaSources)
      for (const rule of KANA_RULES)
        for (const m of text.matchAll(rule.bad))
          kanaViolations.push(`${rel}:${lineOf(text, m.index)} 「${around(text, m.index)}」→ ${rule.good}`)

    // 読み取りに失敗したら必ず落ちる: 文字が読めていない／表が現実と噛み合っていないときは、
    // 「見つからなかった＝合格」に倒れないよう、その場で不合格にする
    const scanned = kanaSources.reduce((n, s) => n + s.text.length, 0)
    eq('HR-5 掃く文字を読めている（0なら見張りが壊れている）', scanned > 100000, true)
    const anchored = KANA_RULES.filter((r) => kanaSources.some((s) => s.text.includes(r.anchor))).length
    eq(
      'HR-5 表の「直した先の書き方」が実際に使われている（表が現実と噛み合っている）',
      anchored >= Math.ceil(KANA_RULES.length / 2),
      true,
    )
    eq('HR-5 意味を担う語のかな書き・補助的な語の漢字書きが1つも無い', kanaViolations, [])
  }

  // ---- 規則⑧: アプリが短い行に割った注意書きは、説明ページでも1つの塊に戻さない（便IM・②） --
  // 便IJ・③でアプリ側（ja.settings.refreshAppCacheClearWarnings）を3行に割ったのに、
  // 使い方ページだけが**153字の1文のまま**残っていた。同じ事故を掃くために、
  // 「アプリが行に分けて言っていることは、ページでも別々の塊になっている」を測る。
  //
  // 文言は ja.ts から取るので書き写さない（言い回しを直しても、この見張りはそのまま当たる）。
  // 読み取りに失敗したら必ず落ちる: 行が2行未満・ページで1行も見つからないときは不合格。
  {
    const manualRaw = readFileSync(path.join(appRoot, 'public/about/manual.html'), 'utf-8')
    const BLOCKS = /<\/?(?:p|li|h[1-6]|td|th|ul|ol|div|section|figcaption|table|tr|dl|dt|dd|details|summary)\b[^>]*>/gi
    const blocks = manualRaw
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .split(BLOCKS)
      .map((t) => t.replace(/<[^>]+>/g, '').replace(/\s+/g, ''))
      .filter((t) => t !== '')
    const splitLines = ja.settings.refreshAppCacheClearWarnings.map((t) => t.replace(/\s+/g, ''))
    eq('HR-6 アプリ側が2行以上に割れている（前提。1行なら測るものが無い）', splitLines.length >= 2, true)
    // どの塊が、どの行を抱えているか
    const holders = splitLines.map((line) => blocks.map((b, i) => (b.includes(line) ? i : -1)).filter((i) => i >= 0))
    eq(
      'HR-6 アプリ側の行が、説明ページにも1行ずつ載っている',
      splitLines.filter((_, i) => holders[i].length === 0),
      [],
    )
    // 1つの塊が2行以上を抱えていたら、ページ側では割れていない＝元の1文に戻っている
    const crowded = []
    for (const b of new Set(blocks))
      if (splitLines.filter((line) => b.includes(line)).length >= 2) crowded.push(b.slice(0, 40))
    eq('HR-6 説明ページでも1つの塊に2行以上を詰め込んでいない', crowded, [])
  }

  // ---- 規則⑨: 場所を指示語で示していない（2026-08-21 便IP・②／規約H） ------------------------
  // 規約H（2026-08-02 オーナー指示）:
  //   「説明文・ヘルプでは『ここ』『これ』等の指示語で場所を示さない（画面名・ボタン名で言う）」
  //
  // 便IPで見つかった発端は使い方ページの1行「今日の分が決まっている日も決まっていない日も、
  // いつでもここにあります。」。**同じ型が ja.ts に8か所・使い方ページに2か所**残っていた。
  // 文言を並べて直しても次に書く人が同じことをするので、**つづりを規則で掃く**。
  //
  // 当てる形は「指示語＋場所を指す助詞」だけに絞る（ここ・こちら・そこ ＋ に／で／へ）。
  //  ・「ここまで」「ここから」は当てない … 文章の流れ（説明のどこまで／どこから）を指す言い方で、
  //    画面の場所を指していない（例: 使い方ページ「ここまでは無料でお使いいただけます」）
  //  ・「こちらを」「こちらは」「こちらも」は当てない … 直前に名乗ったもの（機能・登録済みの品）を
  //    受ける言い方で、場所ではない
  //  ・「この表」「この手間」のように**名詞に付く連体詞**は当てない … 何を指すか名詞が言っている
  //  ・「あそこ」は当てない … アプリにも説明ページにも1件も無い（当たらない規則を増やさない）
  //
  // 見る先から外すもの（外す理由を1件ずつ書く。理由なしで外さない）:
  //  ・public/about/column/ … 献立の悩みを書いた**読み物**で、画面の場所を案内する文ではない。
  //    「ここに、スクショ保存のいちばんの弱点がある」のように、文章の流れで指す言い方が入る
  {
    // ゼロ幅スペース（BudouX）が挟まっても素通りしないよう、照合の前に外す
    const deicticSources = sources
      .filter((s) => !s.rel.startsWith('public/about/column/'))
      .map((s) => ({ rel: s.rel, text: s.text.replace(/​/g, '') }))
    const PLACE_DEICTIC = /(?:ここ|こちら|そこ)[にでへ]/g
    const deicticViolations = []
    for (const { rel, text } of deicticSources)
      for (const m of text.matchAll(PLACE_DEICTIC))
        deicticViolations.push(
          `${rel}:${lineOf(text, m.index)} 「${around(text, m.index, 16, 16)}」→ 画面名・ボタン名で言う`,
        )
    // 読み取りに失敗したら必ず落ちる: 文字が読めていないときに「見つからなかった＝合格」へ倒さない
    const deicticScanned = deicticSources.reduce((n, s) => n + s.text.length, 0)
    eq('HR-7 掃く文字を読めている（0なら見張りが壊れている）', deicticScanned > 100000, true)
    eq(
      'HR-7 掃く先に ja.ts と使い方ページが入っている（外し過ぎていない）',
      ['src/i18n/ja.ts', 'public/about/manual.html'].filter(
        (rel) => !deicticSources.some((s) => s.rel === rel),
      ),
      [],
    )
    eq('HR-7 場所を指示語（ここ・こちら・そこ）で示している文が1つも無い', deicticViolations, [])
  }
}

// ==========================================================================================
// 便IH-3: 打った言葉が「どこに当たったか」（2026-08-20・②）
//
// オーナー原文:
//   「キーワード検索はどこからワードを拾ってきますか？『魚』と入れたところ６件ありましたが、
//     レシピのタグやキーワードに入っているわけではなさそうでした。」
//   （見せ方の訂正1）「各レシピカードに表示ではなく、検索バーの下に、一致した言葉を
//     多い順に羅列するイメージでした」
//   （見せ方の訂正2）「そんなに長くなるなら、羅列部分は、レシピ手順のワード説明と同じように、
//     窓出して表示したらいいのでは？それでも上限は必須。」
//
// 検索の索引（logic/kana.ts の buildSearchWords）はひらがなの語の集まりに均してあり、
// 「どこから来た語か」は消えている。窓に出す一致した場所は logic/search.ts が同じ規則を
// もう一度たどって出しているので、**索引と一致した場所がずれていないこと**をここで測る。
//
// 測るのは利用者が確かめたいこと:
//   ・検索していないときは入口も窓も出ない
//   ・**画面に出る数字と、その一致した場所で実際に出ている品数が一致する**（数を書き写さない）
//   ・出た品が1品残らず、どれかの一致した場所で説明できる
//   ・並びは品数の多い順（オーナー指定）
//   ・**上限を超えたら「ほか◯件」で数を出す**（黙って切らない。オーナー「上限は必須」）
//   ・レシピカードには一致した場所を出さない（訂正1で取り下げた形に戻っている）
//
// 読み取りに失敗したら必ず落ちる形にしてある（測れた一致した場所が0件・一致した場所の種類を
// 1つでも測れていなければその場で不合格）。
// ==========================================================================================
{
  const ihRecipe = (over) => ({
    id: 1,
    title: '',
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
  const ihWithWords = (r) => ({
    ...r,
    searchWords: buildSearchWords(r.title, r.ingredients, r.tags, r.keywords, r.steps, r.dishType),
  })

  // 同梱の基本レシピ（109品）＝オーナーが実機で見ている中身そのものを土台にする。
  // 同梱品は「検索キーワード」欄も「作った記録」も持たないので、その2つの一致した場所を
  // 測るための品を足す（足さないと、その2つを一度も測らないまま合格になる）
  const ihRecipes = [
    ...starterDefs.map((def, i) => ihWithWords(ihRecipe({ ...def, id: i + 1 }))),
    ihWithWords(
      ihRecipe({
        id: 9001,
        title: 'ピリ辛きゅうり',
        keywords: ['おつまみ'],
        ingredients: [{ name: 'きゅうり', amount: '2', unit: '本' }],
        steps: [{ text: 'きゅうりを叩いて和える' }],
      }),
    ),
    ihWithWords(
      ihRecipe({
        id: 9002,
        title: 'ためし煮',
        ingredients: [{ name: 'かぼちゃ', amount: '300', unit: 'g' }],
        steps: [{ text: '煮る' }],
        cookedLogs: [{ date: '2026-08-01', note: 'こどもが完食' }],
      }),
    ),
  ]
  const ihFind = (q) =>
    searchRecipes(ihRecipes, { ...defaultSearchOptions, ngIngredients: [], query: q }).map(
      (r) => r.recipe,
    )
  const ihSummary = (q, limit = 99) => searchMatchSummary(ihFind(q), splitTerms(q), limit)

  // ---- 検索していないときは入口も窓も出ない ------------------------------------------------
  eq(
    'IH-3 検索していないときは一致した場所が1つも出ない',
    searchMatchSummary(ihRecipes, splitTerms(''), 99),
    { rows: [], hiddenCount: 0, total: 0 },
  )
  eq(
    'IH-3 空白だけを打っても出ない',
    searchMatchSummary(ihRecipes, splitTerms('  　 '), 99),
    { rows: [], hiddenCount: 0, total: 0 },
  )

  // ---- 画面に出る数字と、実際に出ている品数が一致する --------------------------------------
  // 語は決め打ちせず、**同梱レシピが実際に持っている言葉**から作る＝レシピが増えても当たる
  const ihVocab = new Set(['きのこ', '主菜', '副菜', '汁物', 'その他', 'おつまみ', 'こども'])
  for (const r of ihRecipes) {
    for (const t of r.tags) ihVocab.add(t)
    for (const i of r.ingredients) ihVocab.add(i.name)
    for (const st of r.steps)
      for (const w of APPLIANCE_SEARCH_WORDS) if (st.text.includes(w)) ihVocab.add(w)
  }
  /** その語が料理名（読み仮名を含む）に当たっているか */
  const ihTitleHit = (recipe, term) =>
    toHiragana(recipe.title).includes(term) ||
    toTagKey(recipe.title).includes(term) ||
    titleKanaKey(recipe.title).includes(term)
  /** その一致した場所が、そのレシピに本当にあるか（欄ごとに元の場所を見に行く） */
  const ihReasonIsReal = (recipe, reason, terms) => {
    if (reason.field === 'title') return terms.some((t) => ihTitleHit(recipe, t))
    if (reason.field === 'tag') return recipe.tags.some((t) => t.trim() === reason.word)
    if (reason.field === 'ingredient')
      return recipe.ingredients.some((i) => i.name.trim() === reason.word)
    if (reason.field === 'keyword')
      return (recipe.keywords ?? []).some((k) => k.trim() === reason.word)
    if (reason.field === 'appliance') return recipe.steps.some((st) => st.text.includes(reason.word))
    if (reason.field === 'dishType')
      return reason.word === dishTypeSearchWord(recipeDishType(recipe))
    if (reason.field === 'cookedNote')
      return reason.word === undefined && recipe.cookedLogs.some((log) => !!log.note)
    return false
  }

  let ihWords = 0
  const ihFieldsSeen = new Set()
  const ihCountMismatch = []
  const ihUnexplained = []
  const ihUnreal = []
  const ihOutOfOrder = []
  const ihTotalWrong = []
  for (const q of ihVocab) {
    const terms = splitTerms(q)
    const hits = ihFind(q)
    if (hits.length === 0) continue
    const summary = ihSummary(q)
    // ① 並びは品数の多い順（オーナー指定）
    for (let i = 1; i < summary.rows.length; i++)
      if (summary.rows[i - 1].count < summary.rows[i].count)
        ihOutOfOrder.push(`「${q}」 ${summary.rows[i - 1].count} → ${summary.rows[i].count}`)
    // ② 入口に出す「ほか◯件」の元になる総数が、並べた数と合っている
    if (summary.total !== summary.rows.length + summary.hiddenCount)
      ihTotalWrong.push(`「${q}」 総数=${summary.total} 並べた=${summary.rows.length} 隠した=${summary.hiddenCount}`)
    for (const row of summary.rows) {
      ihWords++
      ihFieldsSeen.add(row.field)
      // ③ 画面の数字は書き写さず、**その一致した場所に当たる品を数え直して**突き合わせる
      const actual = hits.filter((recipe) =>
        searchMatchReasons(recipe, terms).some(
          (reason) => reason.field === row.field && reason.word === row.word,
        ),
      )
      if (actual.length !== row.count)
        ihCountMismatch.push(
          `「${q}」 ${row.field}「${row.word ?? ''}」 画面=${row.count} 実際=${actual.length}`,
        )
      // ④ その一致した場所が、数えた品に本当にあるか
      for (const recipe of actual)
        if (!ihReasonIsReal(recipe, row, terms))
          ihUnreal.push(`「${q}」→${recipe.title}: ${row.field}「${row.word ?? ''}」`)
    }
    // ⑤ 出た品は1品残らず、どれかの一致した場所で説明できる
    for (const recipe of hits)
      if (searchMatchReasons(recipe, terms).length === 0) ihUnexplained.push(`「${q}」→${recipe.title}`)
  }
  eq('IH-3 測れた一致した場所が1つ以上ある（0件なら見張りが壊れている）', ihWords > 0, true)
  eq(
    'IH-3 一致した場所の種類をすべて一度は測れている（測り漏れが無い）',
    ['title', 'tag', 'ingredient', 'keyword', 'appliance', 'dishType', 'cookedNote'].filter(
      (f) => !ihFieldsSeen.has(f),
    ),
    [],
  )
  eq('IH-3 画面の数字と、その一致した場所で実際に出ている品数が一致する', ihCountMismatch, [])
  eq('IH-3 出した一致した場所は、その品に本当にある', ihUnreal, [])
  eq('IH-3 出たのに、どの一致した場所でも説明できない品が1つも無い', ihUnexplained, [])
  eq('IH-3 並びが品数の多い順になっている（オーナー指定）', ihOutOfOrder, [])
  eq('IH-3 並べた数と隠した数を足すと、一致した場所の総数になる', ihTotalWrong, [])

  // ---- 料理名で当たったぶんは1つにまとめて数える（1品ずつ並べて窓を埋めない） ---------------
  {
    const rows = ihSummary('豆腐').rows
    const titleRows = rows.filter((r) => r.field === 'title')
    eq('IH-3 料理名の一致した場所は1つにまとまっている（品ごとに増えない）', titleRows.length, 1)
    eq(
      'IH-3 料理名の数字は、料理名にその言葉がある品数と一致する',
      titleRows[0]?.count,
      ihFind('豆腐').filter((r) => splitTerms('豆腐').some((t) => ihTitleHit(r, t))).length,
    )
    eq(
      'IH-3 料理名の一致した場所には言葉を添えない（品ごとに違う文なので並べない）',
      titleRows[0]?.word,
      undefined,
    )
  }

  // ---- オーナーが実機で見た「魚」（2026-08-20 便IH・②の発端） ------------------------------
  // 品数は決め打ちしない（レシピが増減しても当たる）。**一致した場所の顔ぶれ**だけを見る
  {
    const summary = ihSummary('魚')
    const fields = summary.rows.map((r) => r.field)
    eq('IH-3 「魚」で一致した場所が1つ以上出る（0件なら見張りが壊れている）', summary.rows.length > 0, true)
    eq('IH-3 「魚」はレシピに付いているタグでも当たる', fields.includes('tag'), true)
    eq('IH-3 「魚」は手順に出てくる調理器具でも当たる', fields.includes('appliance'), true)
  }

  // ---- 上限を超えたら「ほか◯件」で数を出す（オーナー「上限は必須」・黙って切らない） --------
  {
    // 一致した場所がいちばん多く出る語を、画面と同じやり方でその場で探す（語を決め打ちしない）
    let widest = null
    for (const q of ihVocab) {
      const all = ihSummary(q, 999)
      if (widest == null || all.total > widest.all.total) widest = { q, all }
    }
    eq('IH-3 上限を試せる語を見つけられた（0件なら見張りが壊れている）', widest != null && widest.all.total > 2, true)
    const limit = 2
    const cut = ihSummary(widest.q, limit)
    eq('IH-3 上限までしか並べない', cut.rows.length, limit)
    eq('IH-3 隠した一致した場所の件数を必ず返す（黙って切らない）', cut.hiddenCount, widest.all.total - limit)
    eq('IH-3 並べたぶんと隠したぶんを足すと一致した場所の総数になる', cut.rows.length + cut.hiddenCount, cut.total)
    eq('IH-3 隠したぶんは、いちばん品数の少ない側から落ちる', cut.rows[0].count >= widest.all.rows[widest.all.rows.length - 1].count, true)
    eq('IH-3 全部入るときは「ほか」を出さない', ihSummary(widest.q, 999).hiddenCount, 0)
  }

  // ---- 一覧に並べる1つぶんの文字 -------------------------------------------------------------
  {
    const fish = ihSummary('魚').rows.find((r) => r.field === 'tag')
    eq('IH-3 タグで当たった行を組み立てられている', fish !== undefined, true)
    eq(
      'IH-3 タグで当たった行の文字',
      searchMatchRowText(fish),
      ja.search.matchRow
        .replace('{field}', ja.search.matchFieldTag)
        .replace('{word}', '魚')
        .replace('{n}', String(fish?.count)),
    )
    const titleRow = ihSummary('豆腐').rows.find((r) => r.field === 'title')
    eq(
      'IH-3 料理名の行は言葉を添えず「料理名 品数」だけ',
      searchMatchRowText(titleRow),
      ja.search.matchRowWithoutWord
        .replace('{field}', ja.search.matchFieldTitle)
        .replace('{n}', String(titleRow?.count)),
    )
    const noteRow = ihSummary('こども').rows.find((r) => r.field === 'cookedNote')
    eq(
      'IH-3 作った記録のメモの行は、メモの本文を出さずに出どころだけ言う',
      searchMatchRowText(noteRow),
      ja.search.matchRowWithoutWord
        .replace('{field}', ja.search.matchFieldCookedNote)
        .replace('{n}', String(noteRow?.count)),
    )
    const kwRow = ihSummary('おつまみ').rows.find((r) => r.field === 'keyword')
    eq(
      'IH-3 レシピの「検索キーワード」欄で当たった行は、その欄の名前で説明する',
      searchMatchRowText(kwRow),
      ja.search.matchRow
        .replace('{field}', ja.search.matchFieldKeyword)
        .replace('{word}', 'おつまみ')
        .replace('{n}', String(kwRow?.count)),
    )
  }

  // ---- カードには一致した場所を出さない（オーナー訂正1で取り下げた形に戻っている） --------------
  // 共通のカード部品が「その項目を出す口」を持っていないことを、部品のソースそのもので見る
  {
    const cardSrc = readFileSync(
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src/components/RecipeCard.tsx'),
      'utf-8',
    )
    eq('IH-3 共通のカード部品を読めている（0字なら見張りが壊れている）', cardSrc.length > 0, true)
    eq(
      'IH-3 レシピカードは一致した場所を出す口を持っていない（検索まどの下の入口と窓に一本化）',
      cardSrc.includes('matchReason') || cardSrc.includes('card-match-reason'),
      false,
    )
    eq(
      'IH-3 カードの項目の表にも一致した場所が残っていない',
      CARD_PART_KEYS.filter((key) => key.toLowerCase().includes('match')),
      [],
    )
  }
}

// ==========================================================================================
// 便IH-4: 書き出すファイルの名前（2026-08-20・④ オーナー承認済み）
//
// オーナー原文: 「バックアップ名変更については注記いれたほうがいいですね。」
// 決めごと（司令部裁定）:
//   ・日本語のファイル名にはしない（PCによっては文字化け・並べ替えの不都合が出る）＝英語のまま
//   ・アーカイブは `uchi-recipe-records-` → `uchi-recipe-archive-`
//     （アプリの中では「アーカイブファイル」と呼んでいるのに、名前だけ records で
//     同じものだと分からなかった）
//   ・**名前は自由に変えてよいが `.json` は残す**ことを画面に書く
//
// 測るのは利用者が確かめたいこと:
//   ・3つのファイルが名前で見分けられる／どれも `.json` で終わる
//   ・**名前を変えても、前の名前で書き出したファイルでも読める**
//     （読み込みが受け取るのは中身の文字列だけで、ファイル名を一切見ていないこと）
//   ・その注記が画面の文言として実在し、`.json` を名指ししている
// ==========================================================================================
{
  const ihDate = new Date(2026, 7, 2)
  const ihNames = {
    バックアップ: backupFileName(ihDate),
    選んだレシピ: selectedRecipesFileName(ihDate),
    アーカイブ: archiveFileName(ihDate),
  }
  eq('IH-4 アーカイブの名前はアプリの中の呼び名（アーカイブ）に合わせる', ihNames.アーカイブ, 'uchi-recipe-archive-2026-08-02.json')
  eq(
    'IH-4 3つのファイルは名前で見分けられる（同じ名前が1つも無い）',
    new Set(Object.values(ihNames)).size,
    Object.keys(ihNames).length,
  )
  eq(
    'IH-4 どのファイルも拡張子は .json',
    Object.entries(ihNames).filter(([, name]) => !name.endsWith('.json')),
    [],
  )
  eq(
    'IH-4 ファイル名に日本語を使わない（PCで不都合が出ることがある）',
    Object.entries(ihNames).filter(([, name]) => !/^[\x20-\x7e]+$/.test(name)),
    [],
  )

  // ---- 名前を変えても読めること -------------------------------------------------------------
  // 読み込みが**ファイル名を受け取っていない**ことを、口の形そのもので見る
  // （引数が1つ＝中身の文字列だけ。名前で分岐する余地が無い）
  eq('IH-4 アーカイブの読み込みは中身だけを受け取る（ファイル名を見ない）', parseArchiveFile.length, 1)
  eq('IH-4 バックアップの読み込みは中身だけを受け取る（ファイル名を見ない）', parseBackup.length, 1)
  // 実際に、いまの名前で書き出したものと、前の名前で書き出したものの**中身**が同じように読めること
  {
    const file = buildArchiveFile(
      [{ id: 'ih-4-1', recipeTitle: 'テスト煮', date: '2026-01-02', servings: 2 }],
      '2026-01-03T00:00:00.000Z',
    )
    const json = JSON.stringify(file)
    eq(
      'IH-4 いまの名前で書き出したアーカイブが読める',
      parseArchiveFile(json).logs.map((log) => log.recipeTitle),
      ['テスト煮'],
    )
    // ファイル名は読み込みの入力に無いので、**名前を変えても同じ中身なら同じ結果になる**。
    // 名前をいくつ変えても読めた記録が変わらないことを、名前の顔ぶれごと並べて見る
    eq(
      'IH-4 名前を付け替えても（前の名前・自分で付けた名前でも）中身が同じなら同じように読める',
      [
        'uchi-recipe-archive-2026-01-03.json',
        'uchi-recipe-records-2026-01-03.json',
        'わたしの記録.json',
        'backup',
      ].map((name) => `${name}: ${parseArchiveFile(json).logs.length}件`),
      [
        'uchi-recipe-archive-2026-01-03.json: 1件',
        'uchi-recipe-records-2026-01-03.json: 1件',
        'わたしの記録.json: 1件',
        'backup: 1件',
      ],
    )
  }

  // ---- 注記が画面にあること -----------------------------------------------------------------
  {
    const note = ja.settings.fileNameFreeNote
    eq('IH-4 ファイル名の注記が文言として実在する', typeof note === 'string' && note.length > 0, true)
    eq('IH-4 注記が「.json」を名指ししている（拡張子だけは残す、と読める）', note.includes('.json'), true)
    // 画面で言うファイル名の頭と、実際に書き出す名前の頭がそろっていること
    // （文言に書き写した文字列が古くなるのを防ぐ。名前を変えたらこの見張りが落ちる）
    const prefixes = ja.settings.archiveVsBackupNote.match(/uchi-recipe-[a-z]+-/g) ?? []
    eq('IH-4 説明文からファイル名の頭を拾えている（0件なら見張りが壊れている）', prefixes.length > 0, true)
    eq(
      'IH-4 説明文が書いているファイル名の頭が、実際に書き出す名前と一致する',
      prefixes.filter((prefix) => !Object.values(ihNames).some((name) => name.startsWith(prefix))),
      [],
    )
  }
}

// ==========================================================================================
// 便HS-1: 空のときの見せ方の型（2026-08-18・軸8）
//
// 一覧29か所を調べたところ、空のときの言い回しが5系統に割れ、そのうち2つは
// **何が無いのかを名乗っていなかった**（「見つかりません」だけ・「まだ登録されていません」だけ）。
// 利用者から見ると、目の前の枠が「レシピの一覧なのか・食材の一覧なのか」が字から分からない。
//
// そこで空の型を1つに決めた:
//   ・1件も無い    … 「（まだ）◯◯がありません」  ＋（次の一手があれば）ボタン1つ
//   ・条件で0件    … 「条件に合う◯◯が見つかりません」＋「条件をクリア」
//   ・「まだ」を付けるのは、利用者がこれからためていくもの（レシピ・作った記録・買い物メモ・
//     テンプレート・在庫の食材・NG食材）。その日・その枠にたまたま無いだけのもの
//     （その日の献立・その日の記録・そのレシピの材料）には付けない。
//
// ここで見張るのは**個別の文字列ではなく規則**にする（文言は規約Hで書き直され続けるため、
// 文字列を並べた見張りは書いた直後から古くなる）。
// なお、掃けた文の数も一緒に確かめる＝正規表現が当たらなくなったときに
// 「1件も違反が無い」と読めてしまい、**何も測らないまま合格**するのを防ぐ（2026-08-18の反省）。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const blank = (s) => s.replace(/[^\n]/g, ' ')
  const stripTsComments = (src) =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + blank(m.slice(p1.length)))
  const jaSrc = stripTsComments(readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8'))
  const lineOf = (text, at) => text.slice(0, at).split('\n').length
  /** ja.ts の中の「画面に出る文字」を、行番号つきで1つずつ取り出す */
  const jaStrings = []
  for (const m of jaSrc.matchAll(/'((?:[^'\\]|\\.)*)'/g))
    jaStrings.push({ value: m[1], line: lineOf(jaSrc, m.index) })

  // ---- 規則①: 「無い」と言い切る文は、何が無いのかを名乗る ----
  // 「◯◯が/は/も（まだ）ありません」「◯◯が見つかりません」の形になっているか。
  // 主語は同じ文の中にあればよい（「調理中だった手順が、組み直した段取りに見つかりませんでした」
  // のように、主語と述語のあいだに別の語句が挟まる文があるため）。
  // 「正しくありません」のようなイ形容詞の否定は「無い」と言っているのではないので除く。
  {
    const unnamed = []
    let scanned = 0
    for (const { value, line } of jaStrings) {
      for (const m of value.matchAll(/(?:ありません|見つかりません)(?:でした)?/g)) {
        const head = value.slice(0, m.index)
        if (/く$/.test(head)) continue // 「正しくありません」＝イ形容詞の否定
        scanned += 1
        const sentence = head.slice(head.lastIndexOf('。') + 1)
        if (!/[^\s、。（）「」][がはも]/.test(sentence))
          unnamed.push(`src/i18n/ja.ts:${line} 「${value}」＝何が無いのかを名乗っていない`)
      }
    }
    // 掃けた文が明らかに足りないときは、規則が当たらなくなったということ。
    // 下限は「いま57文あるので、その半分を切ったら掃けていない」という保険の数字で、
    // 文の数そのものを固定するものではない（減らす方向の変更で赤くしないための下限）
    eq('HS-1 「無い」と言い切る文を取りこぼさずに掃けている', scanned >= 28, true)
    eq('HS-1 何が無いのかを名乗らない空の案内が1つも無い', unnamed, [])
  }

  // ---- 規則②: 空の案内を受け身で書かない ----
  // 「登録されていません」は主語を落としても文として成立してしまい、実際に
  // NG食材の空の案内が「まだ登録されていません」だけになっていた。言い方そのものを使わない。
  {
    const passive = []
    for (const { value, line } of jaStrings)
      if (/登録されていません/.test(value))
        passive.push(`src/i18n/ja.ts:${line} 「${value}」＝「◯◯がありません」で言う`)
    eq('HS-1 空の案内を「登録されていません」と受け身で書いていない', passive, [])
  }

  // ---- 規則③: 条件で0件になる画面には、条件を外す入口がある ----
  // 「条件に合う◯◯が見つかりません」と出す画面を ja.ts の文言から割り出し、
  // その文言を使っている画面が「条件をクリア」(ja.search.clear) も出しているかを見る。
  // 画面の名前を書き並べないので、同じ形の画面が増えても自動で見張りの対象に入る。
  {
    const jaKeys = []
    for (const m of jaSrc.matchAll(/([A-Za-z0-9_]+)\s*:\s*'((?:[^'\\]|\\.)*)'/g))
      if (/条件に合う.+が見つかりません/.test(m[2])) jaKeys.push(m[1])
    eq('HS-1 「条件に合う◯◯が見つかりません」の文言を拾えている', jaKeys.length >= 3, true)
    const missing = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name)
        if (e.isDirectory()) walk(full)
        else if (e.name.endsWith('.tsx')) {
          const src = readFileSync(full, 'utf-8')
          const used = jaKeys.filter((k) => new RegExp(`ja\\.[A-Za-z0-9_.]*\\.${k}\\b`).test(src))
          if (used.length > 0 && !/ja\.search\.clear\b/.test(src))
            missing.push(`${path.relative(appRoot, full)} 「${used.join('・')}」を出すのに条件を外す入口が無い`)
        }
      }
    }
    walk(path.join(appRoot, 'src'))
    eq('HS-1 条件で0件になる画面に「条件をクリア」がある', missing, [])
  }
}


// ==========================================================================================
// 便HV: 月タブの整理（2026-08-19 オーナー書き溜め⑥⑦⑧⑨⑩⑪）
//
// ここで見張るのは、画面の作りそのものではなく **利用者が確かめたいこと**:
//   ⑥ カレンダーのマスに出す栄養を選べる（＝1日分の8項目が全部取り出せる）／顔ぶれは
//      栄養価の表示・並び替えと同じ（便HU・⑯で1か所に集めた NUTRITION_DISPLAY_KEYS から引く）
//   ⑦⑪ ボタンの名前を変えたら、使い方ページ・紹介ページ・設定のPro案内も一緒に変わる
//      （実在しないボタン名で操作を説明したままにしない）
//   ⑧⑨ 過去と未来で数値が2つに割れていない（合計が1つにまとまっている）
//   ⑩ カレンダーの説明が「概算であること」「その日1人分であること」だけを言っている
//
// 日付を使う検査は、**その場で決めた today からの相対**で組む（曜日・月替わりの前提を置かない）。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const HV_TODAY = '2026-07-15'
  const onionHV = { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 }
  const chickenHV = { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 }
  const hvIndex = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
    { name: '鶏もも肉', pricePerUnit: 130, unit: '100g' },
  ])

  // ---- ⑥ カレンダーのマスに出す栄養を選べる ----
  // マスに出せるのは「その日に1人が食べる分」なので、1日分の集計が8項目そろっている必要がある。
  // 顔ぶれ・名前は栄養価の表示と同じ1か所(NUTRITION_DISPLAY_KEYS)から引く＝片方だけ古くならない。
  {
    const cells = dayIntakeMap({
      dates: ['2026-07-10', '2026-07-14', '2026-07-20'],
      today: HV_TODAY,
      cooked: [{ date: '2026-07-10', recipe: chickenHV }],
      planned: [{ date: '2026-07-20', recipe: onionHV }],
      priceIndex: hvIndex,
    })
    const pastCell = cells.get('2026-07-10')
    eq(
      'HV-6 カレンダーの1日分が栄養8項目をすべて持つ(どれを選んでもマスに出せる)',
      Object.keys(pastCell?.nutrition ?? {}).sort(),
      [...NUTRITION_DISPLAY_KEYS].sort(),
    )
    // 値は「その日の料理の1人分を足したもの」＝栄養カードと同じ数え方であること。
    // 期待値は同じ入力を summarizeRangeIntake に通した値から取る(手打ちの数字を置かない)
    const sameDay = summarizeRangeIntake({
      start: '2026-07-10',
      end: '2026-07-10',
      today: HV_TODAY,
      cooked: [{ date: '2026-07-10', recipe: chickenHV }],
      planned: [],
      priceIndex: hvIndex,
    })
    eq(
      'HV-6 マスの栄養は、その日の1人分の合計(期間の集計と同じ数え方)',
      NUTRITION_DISPLAY_KEYS.map((k) => pastCell?.nutrition?.[k] ?? null),
      NUTRITION_DISPLAY_KEYS.map((k) => sameDay.nutrition.total[k]),
    )
    // 既定はエネルギー。保存値が壊れていても必ず表示できる項目に落ちる
    // (無料/Proの線引き上、エネルギーだけが無料側の項目なので既定を動かさない)
    const nutritionMod = await import('../src/logic/nutrition.ts')
    eq(
      'HV-6 未設定・知らない値のときはエネルギーに落ちる(既定は今までどおり)',
      [
        nutritionMod.resolveNutritionDisplayKey?.(undefined),
        nutritionMod.resolveNutritionDisplayKey?.('とけい'),
        nutritionMod.resolveNutritionDisplayKey?.('proteinG'),
      ],
      ['kcal', 'kcal', 'proteinG'],
    )
  }

  // ---- ⑧⑨ 過去と未来で数値が2つに割れていない ----
  // 「作った記録ぶん」と「これから作る予定ぶん」を別々の行に出すのをやめたので、
  // 画面に出す合計は1つ。分けたままの2つを足し忘れると、どちらか片方だけの額になる。
  {
    const hv = summarizeRangeIntake({
      start: '2026-07-01',
      end: '2026-07-31',
      today: HV_TODAY,
      cooked: [
        { date: '2026-07-10', recipe: onionHV, log: { servings: 3 } },
        { date: '2026-07-10', recipe: chickenHV },
        { date: '2026-07-12', recipe: onionHV, log: { servings: 2 } },
      ],
      planned: [
        { date: '2026-07-20', recipe: chickenHV, servings: 3 },
        { date: '2026-07-25', recipe: onionHV, servings: 4 },
      ],
      priceIndex: hvIndex,
    })
    eq(
      'HV-8 「全員分」は作った食数ぶんと作る食数ぶんを1つに足した額',
      hv.householdYen,
      hv.cookedHouseholdYen + hv.planHouseholdYen,
    )
    eq(
      'HV-8 のべ食数も1つにまとまる',
      hv.mealCount,
      hv.cookedMealCount + hv.planMealCount,
    )
    eq(
      'HV-8 1日あたりの平均の分母は「記録か献立のある日数」(同じ日に何品でも1日)',
      hv.dayCount,
      4, // 7/10(2品で1日)・7/12・7/20・7/25
    )
    eq('HV-8 1日あたりの平均 = 全員分 ÷ その日数', hv.perDayYen, Math.round(hv.householdYen / hv.dayCount))
    // 片方しか無い期間でも同じ形（行を出す/出さないの判断が実績の有無に引きずられない）
    const futureOnly = summarizeRangeIntake({
      start: '2026-07-16',
      end: '2026-07-31',
      today: HV_TODAY,
      cooked: [],
      planned: [{ date: '2026-07-20', recipe: chickenHV, servings: 3 }],
      priceIndex: hvIndex,
    })
    eq(
      'HV-8 記録が1件も無い期間でも「全員分」は予定ぶんで出る(0円で伏せない)',
      { yen: futureOnly.householdYen, meals: futureOnly.mealCount, days: futureOnly.dayCount },
      { yen: futureOnly.planHouseholdYen, meals: futureOnly.planMealCount, days: 1 },
    )
    eq(
      'HV-8 記録も献立も無い期間は0で割らない',
      { days: futureOnly.dayCount > 0, perDay: summarizeRangeIntake({
        start: '2026-07-16',
        end: '2026-07-17',
        today: HV_TODAY,
        cooked: [],
        planned: [],
        priceIndex: hvIndex,
      }).perDayYen },
      { days: true, perDay: 0 },
    )
  }

  // ---- ⑨ 使わなくなった文言を残さない（EK-1と同じ作法） ----
  eq('HV-9 消した「この月の栄養から組む」の文言が残っていない', 'purposeReviewTitle' in ja.mealPlan, false)
  eq('HV-9 畳んだ月カードの「予定」の行の文言が残っていない', 'monthFoldedPlanPersonal' in ja.mealPlan, false)
  eq('HV-8 表の「これから作る予定」の見出しが残っていない', 'intakeCostPlanGroup' in ja.mealPlan, false)

  // ---- ⑩ カレンダーの説明は「概算」と「その日に1人が食べる分」だけ ----
  for (const [name, legend] of [
    ['栄養', ja.mealPlan.monthCellNutritionLegend],
    ['食費', ja.mealPlan.monthCellCostLegend],
  ]) {
    eq(
      `HV-10 ${name}の説明に、カレンダーを見れば分かる数え方の説明が残っていない`,
      /過ぎた日|今日から先|まだの分/.test(legend),
      false,
    )
    eq(
      `HV-10 ${name}の説明が「概算」と「その日に1人が食べる分」を言っている`,
      legend.includes('概算') && legend.includes('その日に1人が食べる分'),
      true,
    )
  }

  // ---- ⑦⑪ 名前を変えたら、利用者が読むページも一緒に変える ----
  // 期待値はアプリの文言そのもの(ja.ts)から取る＝アプリで名前を変えたらここが赤くなる。
  {
    const bodyOf = (rel) =>
      readFileSync(path.join(appRoot, rel), 'utf-8').replace(/<!--[\s\S]*?-->/g, '')
    const pages = ['public/about/manual.html', 'public/about/index.html']
    for (const rel of pages) {
      const body = bodyOf(rel)
      eq(
        `HV-11 ${rel} に無くなったボタン名「未定の日をまとめて提案」が残っていない（今は「${ja.mealPlan.fillMonth}」）`,
        body.includes('未定の日をまとめて提案'),
        false,
      )
      eq(
        `HV-7 ${rel} が「期間の食費と栄養」をボタン名として説明していない（今は「${ja.mealPlan.rangeCostToggle}」）`,
        /「期間の食費と栄養」(のボタン|ボタン|を押)/.test(body),
        false,
      )
    }
    const manualHV = bodyOf('public/about/manual.html')
    eq('HV-11 使い方ページに今のボタン名が書いてある', manualHV.includes(ja.mealPlan.fillMonth), true)
    eq('HV-7 使い方ページに今のボタン名が書いてある', manualHV.includes(ja.mealPlan.rangeCostToggle), true)
    // 設定のPro案内の道順も、いま画面に出ているボタン名で書く
    const mealPlanFeatures = ja.settings.proActivatedFeatureGroups.flatMap((g) => g.features)
    const rangeFeature = mealPlanFeatures.find((f) => f.hint.includes('期間'))
    eq(
      'HV-7 設定のPro案内の道順が、今のボタン名で書かれている',
      rangeFeature?.hint.includes(ja.mealPlan.rangeCostToggle) ?? false,
      true,
    )
  }
}

// ---------- IC-1: 折りたたみの開閉が「予約の追い越し」で消えないこと（2026-08-19 便IC） ----------
//
// 直したバグ: 折りたたみ（src/components/Collapse.tsx・34か所で使う共通部品）は
// 「中身を置く→高さ0のまま1フレーム待つ→伸ばす」を requestAnimationFrame の二重予約で
// 表していた。予約は描き直しの順番を保証しないので、機械が混むと
// 「高さ0の中身」が一度も作られないまま開き切り、**アニメーションが丸ごと消えていた**
// （設定の「機種変更するときは」は混んでいなくても毎回消えていた）。
//
// いまは useLayoutEffect（描き直しの前に必ず走る）の中で、中身を置く → 寸法を読んで
// 「高さ0」をブラウザに確定させる → 1fr にする、を**同じ処理の中で**順に行う。
// 予約を挟まないので順番が入れ替わらない。
//
// ここは「動きが出るか」ではなく「予約に戻していないか」だけを見る見張り
// （動きそのものは scripts/e2e-smoke.mjs の EO-01 が実機で測る）。
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const raw = readFileSync(path.join(appRoot, 'src/components/Collapse.tsx'), 'utf-8')
  if (raw.length < 500) throw new Error(`Collapse.tsx を読み取れていない(長さ=${raw.length})`)
  // 説明のコメントに書いた言葉を数えないよう、コメントを落としてから読む
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
  if (code.length < 300) throw new Error('Collapse.tsx のコメントを落としたら中身が残らない')
  // 前提の確認（同じ読み方で、いま在るものが「在る」と読めること＝見張りの空振り防止）
  eq('IC-1 前提: Collapse.tsx の中身を読めている', /export default function Collapse/.test(code), true)

  eq(
    'IC-1 開くときの順番を requestAnimationFrame の予約で作っていない',
    /requestAnimationFrame/.test(code),
    false,
  )
  eq(
    'IC-1 開閉の指示は描き直しの前に片づける（useLayoutEffect を使う）',
    /useLayoutEffect\s*\(/.test(code),
    true,
  )
  eq(
    'IC-1 「高さ0」を確定させる寸法の読み取りが残っている（消すとアニメーションが出なくなる）',
    /getBoundingClientRect\(\)/.test(code),
    true,
  )
}

// ==========================================================================================
// IA-1〜IA-5: 献立の「日」の絞り込みを窓にした回の見張り（2026-08-19 便IA）
//
// オーナー原文（実機）:
//   ①「今日なに作るで、条件を絞るボタンをぽちぽち色々試すたびに、説明文や追加の選択肢が出現して
//      ボタンや献立のレシピカードの場所が変わるので見づらく感じる」
//   ②「1品も条件ぽちぽち帰るたびに候補が変わらないようにして」
//   ③「月や週の献立で、サイコロ押してレシピを変更した後に、元に戻すトースト？出してほしい」
//   ⑤「④OKフォーマットそのままで情報減らすなどコンパクトにする努力はして」
//
// **実際に動かして測るのは e2e**（DAYCOND-01・DAYONE-02・WEEKDICE-03・SUGGESTNG-04・
// PICKCOMPACT-05）が受け持つ。ここは e2e が開かない場所まで含めて、**決めごとが
// 書き換わっていないか**を静的に見張る。読み取りに失敗したら必ず落ちる形にしてある。
// ==========================================================================================
{
  const iaRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const iaRead = (rel) => readFileSync(path.join(iaRoot, rel), 'utf-8')

  // ---- IA-1: 「レシピを選ぶ」画面の引き算（⑤） ------------------------------------------
  // 項目名を並べ立てるのではなく、**場所どうしの大小**と「決め手が残っているか」で測る。
  {
    const iaFull = cardPartsFor('recipeList')
    const iaPicker = cardPartsFor('recipePicker')
    const iaSuggest = cardPartsFor('todaySuggest')
    eq(
      'IA-1 「レシピを選ぶ」画面は、レシピ一覧より載せる情報が少ない（2026-08-19 オーナー指示の引き算）',
      iaPicker.size < iaFull.size && [...iaPicker].every((key) => iaFull.has(key)),
      true,
    )
    eq(
      'IA-1 「レシピを選ぶ」画面にも調理時間は残っている（決め手まで消していない）',
      iaPicker.has('time'),
      true,
    )
    // 「1品を選ぶ」場所は2つある（今日なに作る？の候補・レシピを選ぶ画面）。
    // 同じ役目なので載せる情報も同じにする＝片方だけ増減させない
    eq(
      'IA-1 「1品を選ぶ」2か所（今日なに作る？の候補・レシピを選ぶ画面）は同じだけ載せる',
      [...iaPicker].sort().join(','),
      [...iaSuggest].sort().join(','),
    )
  }

  // ---- IA-2: 「変えた条件は…」の1行（①②・規約H） ---------------------------------------
  // 押すボタンの名前で場所を言う（「ここ」「これ」等の指示語で言わない）。
  // 1品側と献立側で、同じことを違う言い方にしない（型がそろっているかを見る）。
  {
    // 文言そのものが無いときは、その場で不合格にする（undefined を空文字に倒して素通りさせない）
    const iaText = (value) => (typeof value === 'string' ? value : '')
    const iaNotices = [
      { label: '1品', text: iaText(ja.dayStart.conditionChanged), button: iaText(ja.dayStart.shuffle) },
      {
        label: '献立',
        text: iaText(ja.mealPlan.todaySuggestConditionChanged),
        button: iaText(ja.mealPlan.todaySuggestButton),
      },
    ]
    eq(
      'IA-2 「変えた条件は…」の1行が1品側と献立側の両方にある',
      iaNotices.filter((n) => n.text.length === 0 || n.button.length === 0).map((n) => n.label),
      [],
    )
    eq(
      'IA-2 「変えた条件は…」の1行は、押すボタンの名前を書いている（規約H）',
      iaNotices.filter((n) => !n.text.includes(n.button)).map((n) => n.label),
      [],
    )
    eq(
      'IA-2 その1行で場所を指示語（ここ・これ・上の・下の）で示していない（規約H）',
      iaNotices.filter((n) => /ここ|これ|上の|下の/.test(n.text)).map((n) => n.label),
      [],
    )
    // ボタン名を外した残り（言い回し）が1品側と献立側で同じ＝同じことを違う言葉で言わない
    const iaShape = (n) => n.text.replace(n.button, '')
    eq(
      'IA-2 1品側と献立側で、言い回しはそろっている（違うのはボタンの名前だけ）',
      iaShape(iaNotices[0]),
      iaShape(iaNotices[1]),
    )
  }

  // ---- IA-3: サイコロの知らせと「元に戻す」（③・規約F） -----------------------------------
  // 週・月は複数の日が同時に見えているので、**いつの・どの食事の枠か**を必ず言う。
  // 取り消しの文言は、起きたことと対になっている（入れた↔外した／変えた↔戻した）。
  {
    const iaSuggestToasts = {
      suggestReplacedToast: ['{before}', '{after}'],
      suggestReplaceUndoneToast: ['{title}'],
      suggestAddedToast: ['{title}'],
      suggestAddedPairToast: ['{main}', '{side}'],
      suggestAddUndoneToast: ['{title}'],
      suggestAddPairUndoneToast: ['{main}', '{side}'],
    }
    const iaMissingSlot = Object.keys(iaSuggestToasts).filter((key) => {
      const text = ja.mealPlan[key]
      return typeof text !== 'string' || !['{m}', '{d}', '{slot}'].every((ph) => text.includes(ph))
    })
    eq(
      'IA-3 サイコロの知らせは、いつの・どの食事の枠かを必ず書いている（週・月は日が並んでいる）',
      iaMissingSlot,
      [],
    )
    const iaMissingTitles = Object.entries(iaSuggestToasts).filter(
      ([key, holes]) => !holes.every((ph) => (typeof ja.mealPlan[key] === 'string' ? ja.mealPlan[key] : '').includes(ph)),
    )
    eq(
      'IA-3 サイコロの知らせは、どの料理のことかを書いている（規約F: 何が戻るのかが分かる）',
      iaMissingTitles.map(([key]) => key),
      [],
    )
    const iaReplaced = typeof ja.mealPlan.suggestReplacedToast === 'string' ? ja.mealPlan.suggestReplacedToast : ''
    const iaReplaceUndone =
      typeof ja.mealPlan.suggestReplaceUndoneToast === 'string' ? ja.mealPlan.suggestReplaceUndoneToast : ''
    eq(
      'IA-3 入れ替えの知らせは、前の料理名と後の料理名を両方書いている（元に戻すと何が戻るか）',
      iaReplaced.includes('{before}') &&
        iaReplaced.includes('{after}') &&
        iaReplaceUndone.includes('{title}'),
      true,
    )
  }

  // ---- IA-4: 窓の作りを新しく発明していない（①） -----------------------------------------
  // 「条件をしぼる」は**すでにある窓の作法**に乗せる約束。共通の3点セット
  // （端末の「戻る」で閉じる・後ろの画面を止める・見た目）を使っていることを見る。
  {
    const iaPanel = iaRead('src/components/TodaySuggestPanel.tsx')
    eq('IA-4 「今日なに作る？」の節を読めている（0文字なら見張りが壊れている）', iaPanel.length > 0, true)
    const iaWindowParts = [
      ['端末の「戻る」・Escapeで閉じる', 'useOverlayDismiss('],
      ['後ろの画面を止める', 'useScrollLock('],
      ['窓の見た目（共通）', 'DIALOG_CARD_CLS'],
      ['窓の後ろ（共通）', 'DIALOG_BACKDROP_CLS'],
    ]
    eq(
      'IA-4 「条件をしぼる」の窓は、すでにある窓の作法に乗っている（新しい窓を作っていない）',
      iaWindowParts.filter(([, needle]) => !iaPanel.includes(needle)).map(([label]) => label),
      [],
    )
    // 絞り込みのチップ（条件・分数・料理の種別・在庫）は、**窓の中にだけ**置く。
    // 節の側（折りたたみ）へ戻すと、開いた瞬間に下が押し下がる形に逆戻りする。
    // JSXは書いた順に画面へ出るので、チップの呼び出しが窓の目印より後ろにあることで見る
    const iaModalAt = iaPanel.indexOf('data-testid="day-conditions-modal"')
    const iaChipUses = [...iaPanel.matchAll(/conditionChipCls\(/g)].map((m) => m.index)
    eq(
      'IA-4 絞り込みのチップは窓の中だけにある（節の側の折りたたみへ戻していない）',
      iaModalAt > 0 && iaChipUses.length > 0 && iaChipUses.every((at) => at > iaModalAt),
      true,
    )
  }

  // ---- IA-5: NG食材の警告を渡し漏れていない（④・2026-08-19 便IEで対象を全画面へ広げた） ----
  // 測るのは1つだけ:「**これから作る品を出すカードは、どの画面にあっても
  // 設定『食べられない食材』を受け取っている**」。
  //
  // 便IAの時点では献立の2ファイルだけを名指しで見ていたため、買い物メモの「レシピを選ぶ」の
  // 渡し漏れが素通りした（同じ渡し漏れが別の画面で起きても当たらない書き方だった）。
  // ファイル名を書き写して並べるのをやめ、**src/ の .tsx を全部走査して、カードを出す
  // 「場所」(place) で対象かどうかを決める**形にする。画面が増えても当たる。
  //
  // 対象外は2つだけ:
  //  ・**作った記録** … place="cookedLog"（記録の一覧）と、献立の枠に収まっているのが
  //    記録のカード（photoOverride で記録の写真を出しているもの）。もう作ったものに
  //    「食べられない食材が入っています」と出しても直す先が無い
  //  ・**押せない見本** … 献立の枠(planSlot)の readOnly。サンプルデモの月の日の窓と
  //    献立テンプレの中身で、指しているレシピが端末に無いこともある見本
  //  ※「レシピを選ぶ」一覧の readOnly は見本ではない。行の中の＋/−で食数を決める作りなので
  //    カードごと押せなくしてあるだけで、出しているのはこれから作る品そのもの。だから対象。
  //
  // 場所の名前を並べただけだと、表(src/logic/cardParts.ts)に新しい場所が増えたときに
  // 黙って素通りする。**表のすべての場所を「要る／要らない」に仕分けてあるか**を先に見て、
  // 仕分けの無い場所が1つでもあればその場で不合格にする。
  //
  // IA_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る
  // （この見張りが直す前のコードで本当に赤くなるかを確かめるための口）。
  {
    const iaSrcRoot = process.env.IA_SRC_ROOT ?? iaRoot
    const iaListTsx = (dir) => {
      const out = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...iaListTsx(full))
        else if (entry.name.endsWith('.tsx')) out.push(full)
      }
      return out.sort()
    }
    const iaFiles = iaListTsx(path.join(iaSrcRoot, 'src')).map((full) => ({
      rel: path.relative(iaSrcRoot, full).split(path.sep).join('/'),
      src: readFileSync(full, 'utf-8'),
    }))
    eq('IA-5 走査できた画面ファイルがある（0件なら見張りが壊れている）', iaFiles.length > 0, true)

    // 「これから作る品を出す場所」＝ここに並ぶもの。表の場所はすべてどちらかに入れる
    const iaNgNeeded = new Set(['recipeList', 'recipePicker', 'todayPlan', 'todaySuggest', 'planSlot'])
    const iaNgNotNeeded = new Set(['cookedLog'])
    eq(
      'IA-5 カードを出す場所すべてが「NG食材が要る／要らない」に仕分けてある（新しい場所が黙って素通りしない）',
      Object.keys(CARD_PLACE_PARTS).filter(
        (place) => !iaNgNeeded.has(place) && !iaNgNotNeeded.has(place),
      ),
      [],
    )
    eq(
      'IA-5 仕分けに書いた場所は、すべて表に実在する（消えた場所を見張り続けない）',
      [...iaNgNeeded, ...iaNgNotNeeded].filter((place) => !Object.hasOwn(CARD_PLACE_PARTS, place)),
      [],
    )

    /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `>` に釣られない） */
    const iaCardOpenTags = (src) => {
      const tags = []
      let at = src.indexOf('<RecipeCard')
      while (at >= 0) {
        let depth = 0
        let end = -1
        for (let i = at; i < src.length; i++) {
          const ch = src[i]
          if (ch === '{') depth++
          else if (ch === '}') depth--
          else if (ch === '>' && depth === 0) {
            end = i
            break
          }
        }
        if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
        tags.push(src.slice(at, end + 1))
        at = src.indexOf('<RecipeCard', end)
      }
      return { tags }
    }

    const iaCalls = []
    const iaReadErrors = []
    for (const { rel, src } of iaFiles) {
      if (rel === 'src/components/RecipeCard.tsx') continue
      const found = iaCardOpenTags(src)
      if (found.error) {
        iaReadErrors.push(`${rel}: ${found.error}`)
        continue
      }
      for (const tag of found.tags) {
        const literal = tag.match(/\bplace="([A-Za-z]+)"/)
        // 式で渡されると読めない＝黙って既定に倒さず、その場で不合格にする
        const expr = tag.match(/\bplace=\{([^}]*)\}/)
        if (expr) {
          iaReadErrors.push(`${rel}: 場所の式が読めない: ${expr[1].trim()}`)
          continue
        }
        const place = literal ? literal[1] : DEFAULT_CARD_PLACE
        if (!Object.hasOwn(CARD_PLACE_PARTS, place)) {
          iaReadErrors.push(`${rel}: 表に無い場所: ${place}`)
          continue
        }
        iaCalls.push({ rel, place, tag })
      }
    }
    eq('IA-5 カードの呼び出しを切り出せている（読めない書き方が無い）', iaReadErrors, [])
    eq('IA-5 カードの呼び出しを1つ以上拾えている（0件なら見張りが壊れている）', iaCalls.length > 0, true)

    /** 作った記録のカード（記録の一覧・献立の枠に収まった記録） */
    const iaIsCookedLog = (c) => iaNgNotNeeded.has(c.place) || /\bphotoOverride=/.test(c.tag)
    /** 押せない見本（献立の枠の readOnly） */
    const iaIsSample = (c) => c.place === 'planSlot' && /\breadOnly\b/.test(c.tag)
    const iaMust = iaCalls.filter((c) => !iaIsCookedLog(c) && !iaIsSample(c))
    const iaWhere = (c) =>
      `${c.rel} place=${c.place} ${c.tag.replace(/\s+/g, ' ').slice(0, 70)}…`

    eq('IA-5 NG食材を渡すべきカードが1つ以上ある（全部が対象外に倒れていない）', iaMust.length > 0, true)
    eq(
      'IA-5 対象外の判定が空振りしていない（作った記録・押せない見本を1つも拾えていないなら書き方が変わっている）',
      iaCalls.filter(iaIsCookedLog).length > 0 && iaCalls.filter(iaIsSample).length > 0,
      true,
    )
    eq(
      'IA-5 これから作る品を出すカードは、どの画面にあっても必ずNG食材を受け取っている',
      iaMust.filter((c) => !/\bngIngredients=/.test(c.tag)).map(iaWhere),
      [],
    )
  }
}

// ---------- 便ID(2026-08-19 オーナーの書き溜め7件) ----------
// 直したもの: ②入れかたのボタンを短く横1列に ③「提案の条件」→「現在の条件」
// ⑤「多め/ひかえめ」の見出しと選択肢名の両立 ⑥先週コピーの説明 ⑦曜日カードの既定の折りたたみ。
// 画面の見え方(窓で開くこと・位置が動かないこと)は e2e の WEEKCOND-01 / WEEKFOLD-01 が受け持ち、
// ここでは**言葉と実際の動きが食い違っていないか**と、日付に依らない判定だけを見る
{
  const mealPlanLogic = await import('../src/logic/mealPlan.ts')
  const { planCopyLastWeek } = mealPlanLogic
  // 読み取りに失敗したら必ず落ちる形にする（見張りが「関数が無いので測れませんでした」で
  // 素通りしないよう、無ければここで1件NGにしてから空の実装で先へ進む）
  eq(
    'ID-7 曜日カードの既定を決める関数がある（無ければ以下は測れていない）',
    typeof mealPlanLogic.planDefaultFoldedDates === 'function',
    true,
  )
  const planDefaultFoldedDates =
    typeof mealPlanLogic.planDefaultFoldedDates === 'function'
      ? mealPlanLogic.planDefaultFoldedDates
      : () => ['(関数が無い)']

  // --- ⑦ 曜日カードの既定(planDefaultFoldedDates) ---
  // オーナー原文「過去の日付は折りたたみ、献立が空欄の未来の日付も折りたたみ、
  // 献立ありの未来の日付は開いて表示にしたい」。
  //
  // 禁じ手①(曜日・月替わりの前提)よけ: 「今日」は引数で渡す形にして、
  // **月初・月末・年またぎ・うるう日**の4通りで同じ結論になることを固定する。
  // 実行日がいつでも通る＝この見張り自体が日付で赤くならない
  {
    const cases = [
      ['月末をまたぐ', '2026-08-31', ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']],
      ['年をまたぐ', '2026-12-31', ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']],
      ['月初', '2026-03-01', ['2026-02-26', '2026-02-27', '2026-03-01', '2026-03-02', '2026-03-03']],
      ['うるう日', '2028-02-29', ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']],
    ]
    for (const [name, today, dates] of cases) {
      const past = dates.filter((d) => d < today)
      const future = dates.filter((d) => d > today)
      // 未来の1日目にだけ献立を入れる＝「献立あり/なし」で開閉が分かれることを見る
      const withPlan = new Set([future[0]])
      const folded = planDefaultFoldedDates({ dates, today, datesWithPlan: withPlan })
      eq(`ID-7 ${name}: 過ぎた日はすべて畳む`, past.every((d) => folded.includes(d)), true)
      eq(`ID-7 ${name}: 献立のある未来の日は開く`, folded.includes(future[0]), false)
      eq(`ID-7 ${name}: 献立の無い未来の日は畳む`, folded.includes(future[1]), true)
      eq(`ID-7 ${name}: 今日は献立が無くても開く`, folded.includes(today), false)
    }
    // 献立が1品も無い週でも、今日だけは開く(今日が入っていない週は全部畳む)
    eq(
      'ID-7 献立が1品も無い未来の週は全部畳む',
      planDefaultFoldedDates({
        dates: ['2026-09-07', '2026-09-08'],
        today: '2026-09-01',
        datesWithPlan: new Set(),
      }),
      ['2026-09-07', '2026-09-08'],
    )
    eq(
      'ID-7 過ぎた日は献立が入っていても畳む(過ぎた日は予定を出さない画面のため)',
      planDefaultFoldedDates({
        dates: ['2026-08-30'],
        today: '2026-09-01',
        datesWithPlan: new Set(['2026-08-30']),
      }),
      ['2026-08-30'],
    )
  }

  // --- ⑥ 「先週の献立をコピー」の説明が、実際の動きと食い違っていないこと ---
  // オーナー案は「そのまま入力します」または「上書きします」。実装(planCopyLastWeek)は
  // **すでに入っている食事を1つも書き換えない**ので、「上書きします」と書いた瞬間に
  // 画面の言葉が嘘になる(規約F)。動きと言葉を1か所で結んで固定する
  {
    const prevEntries = [
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      prevEntries,
    }
    eq(
      'ID-6 空いている枠には入る(何も起きないテストで素通りしていないことの担保)',
      planCopyLastWeek({ ...base, entries: [] }).ops.length,
      2,
    )
    eq(
      'ID-6 すでに献立が入っている枠には1品も入れない(＝上書きしない)',
      planCopyLastWeek({
        ...base,
        entries: [
          { date: '2026-08-10', slot: 'dinner' },
          { date: '2026-08-11', slot: 'dinner' },
        ],
      }).ops.length,
      0,
    )
    eq(
      'ID-6 埋まっている日と空いている日が混ざっていれば、空いている日にだけ入る',
      planCopyLastWeek({ ...base, entries: [{ date: '2026-08-10', slot: 'dinner' }] }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' }],
    )
    // 2026-08-19 便IF・⑧: コピーにも「入れかた」が効くようになったので、説明は入れかたごとに
    // 2本に分かれた。「上書きしない」と言えるのは**空いた枠だけ**を選んでいるときの説明と
    // 確認の窓の本文の2つ（総入れ替えの側は消してから入れるので、別の言い方で言う＝IF-8が見る）
    for (const [name, text] of [
      ['空いた枠だけのときの説明', ja.mealPlan.copyWeekFillEmptyHint],
      ['空いた枠だけの確認の窓の本文', ja.mealPlan.copyWeekConfirm],
    ]) {
      eq(
        `ID-6 ${name}は「上書きします」と言わない(この入れかたは上書きしない)`,
        typeof text === 'string' && !/上書きします/.test(text),
        true,
      )
    }
    for (const [name, text] of [
      ['空いた枠だけのときの説明', ja.mealPlan.copyWeekFillEmptyHint],
      ['総入れ替えのときの説明', ja.mealPlan.copyWeekReplaceAllHint],
    ]) {
      eq(
        `ID-6 ${name}は、押すと何が入るかを「入力」で言う`,
        typeof text === 'string' && text.includes('入力します'),
        true,
      )
    }
  }

  // --- ⑤ 「多め/ひかえめ」の見出しと選択肢名の両立 ---
  // プルダウンの中は区分(多め/ひかえめ)＋項目名だけ、閉じたときの要約は「たんぱく質多め」。
  // 2つの表示名がずれると、選んだ名前と要約の名前が別物になる。組み立てで結んで固定する
  {
    const { MORE_MEAL_PURPOSES, LESS_MEAL_PURPOSES } = await import('../src/db/types.ts')
    const summaryOf = (purpose) =>
      ({
        protein: ja.mealPlan.purposeProtein,
        fiber: ja.mealPlan.purposeFiber,
        iron: ja.mealPlan.purposeIron,
        calcium: ja.mealPlan.purposeCalcium,
        lowEnergy: ja.mealPlan.purposeLowEnergy,
        lowFat: ja.mealPlan.purposeLowFat,
        lowCarb: ja.mealPlan.purposeLowCarb,
        lowSalt: ja.mealPlan.purposeLowSalt,
      })[purpose]
    const groups = [
      [MORE_MEAL_PURPOSES, ja.mealPlan.purposeGroupMore],
      [LESS_MEAL_PURPOSES, ja.mealPlan.purposeGroupLess],
    ]
    const mismatched = []
    let counted = 0
    for (const [purposes, groupLabel] of groups) {
      for (const purpose of purposes) {
        counted++
        const option = ja.mealPlan.purposeOption?.[purpose]
        if (!option || `${option}${groupLabel}` !== summaryOf(purpose)) {
          mismatched.push(`${purpose}: 選択肢=${option} 区分=${groupLabel} 要約=${summaryOf(purpose)}`)
        }
      }
    }
    eq('ID-5 見張る軸が8つそろっている(0件なら見張りが壊れている)', counted, 8)
    eq('ID-5 選択肢名＋区分名＝要約の名前(たんぱく質＋多め＝たんぱく質多め)', mismatched, [])
    eq(
      `ID-5 選択肢名そのものには「${ja.mealPlan.purposeGroupMore}」「${ja.mealPlan.purposeGroupLess}」を付けない(区分と二重に言わない)`,
      // 区分の名前は ja.ts から取る(書き写すと、区分の名前を直したときにこの見張りが何も測らなくなる)
      Object.values(ja.mealPlan.purposeOption ?? {}).filter((v) =>
        [ja.mealPlan.purposeGroupMore, ja.mealPlan.purposeGroupLess].some((g) => v.includes(g)),
      ),
      [],
    )
  }

  // --- ② 入れかたの2つのボタン ---
  // オーナー原文「横一列にボタンを配置。２列だと情報量自体が多く感じ、直感的に２択だとわからない」。
  // 画面側は2列のグリッドで必ず横1列に置くが、名前が長いとボタンの中で折り返して背が伸びる。
  // 「一部の単語のみでも内容がなんとなくわかる」長さに収まっていることを字数で固定する
  {
    for (const [name, label] of [
      ['空き埋め', ja.mealPlan.fillModeFillEmpty],
      ['総入れ替え', ja.mealPlan.fillModeReplaceAll],
    ]) {
      eq(`ID-2 入れかたのボタン「${name}」は6文字以内`, label.length <= 6, true)
    }
    neq('ID-2 2つのボタンは違う名前', ja.mealPlan.fillModeFillEmpty, ja.mealPlan.fillModeReplaceAll)
    // 短くしても、押すと何が起きるかは下の1行が言い切る(規約H。名前だけに背負わせない)
    eq(
      'ID-2 空き埋めの説明は「今ある献立はそのまま」を言う',
      ja.mealPlan.fillModeFillEmptyHint.includes('今ある献立はそのまま'),
      true,
    )
    eq(
      'ID-2 総入れ替えの説明は「消してから入れ直す」を言う',
      ja.mealPlan.fillModeReplaceAllHint.includes('消して'),
      true,
    )
  }

  // --- ③ 「提案の条件」→「現在の条件」 ---
  {
    eq('ID-3 ボタンの名前は「現在の条件」', ja.mealPlan.suggestConditionsToggle, '現在の条件')
    eq(
      'ID-3 条件を選んでいないときに出す言葉がある(コロンの後ろを空にしない)',
      typeof ja.mealPlan.suggestConditionsNone === 'string' &&
        ja.mealPlan.suggestConditionsNone.length > 0,
      true,
    )
    // 2026-08-22 便IY: 便IDは「ボタン=いまの状態・窓=これから使う条件」と役割で呼び分けたが、
    // **同じものを指しているのに2つの名前で呼んでいる**ため、押した先で名前が変わって見えた。
    // 司令部裁定でオーナーが実機で言及した「現在の条件」に寄せる（規約H）
    eq(
      'ID-3(便IY) 窓の見出しは、押したボタンと同じ名前（同じものを2つの名前で呼ばない）',
      ja.mealPlan.suggestConditionsTitle,
      ja.mealPlan.suggestConditionsToggle,
    )
  }
}

// ---------- 便IF(2026-08-19 オーナーの書き溜め。週タブを「日タブのできること増加版」に作り直す) ----------
// ここで見張るのは**日付に左右されない中身**だけ:
//   ⑧ 先週コピーに「入れかた」が効く（総入れ替えを選ぶと決まっている枠も入れ替わる／
//      選ばなければ1品も入れ替わらない）
//   ④ コピー元の7日間の日付を、文言に差し込む場所があること（「先週」と固定で書かない）
//   ⑪ 過去だけの週ではロックのボタンを出さない／今日以降が1日でもあれば出す
// 画面の並び・見た目（⑥②③）は e2e の WEEKFMT-01 が受け持つ。
//
// 禁じ手よけ:
//  ・曜日・月替わりの前提を置かない＝「今日」は引数で渡し、月末・年またぎ・うるう日でも同じ結論を見る
//  ・読み取りに失敗したら必ず落ちる（関数や文言が無いときは、素通りではなくその場で1件NGにする）
{
  const mealPlanLogicIF = await import('../src/logic/mealPlan.ts')
  const { planCopyLastWeek: copyIF } = mealPlanLogicIF

  // --- ⑧ 先週コピー×入れかた(planCopyLastWeek の replaceAll) ---
  {
    const prevEntries = [
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      prevEntries,
    }
    // 両日ともすでに決まっている状態を土台にする（＝「入れ替わったか」を見分けられる形）
    const filled = [
      { id: 101, date: '2026-08-10', slot: 'dinner', recipeId: 91 },
      { id: 102, date: '2026-08-11', slot: 'dinner', recipeId: 92 },
    ]
    const keep = copyIF({ ...base, entries: filled })
    eq('IF-8 選ばなければ入れ替わらない: 1品も入れない', keep.ops.length, 0)
    eq(
      'IF-8 選ばなければ入れ替わらない: 1件も消さない',
      Array.isArray(keep.entryIdsToRemove) ? keep.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [],
    )
    const swap = copyIF({ ...base, entries: filled, replaceAll: true })
    eq(
      'IF-8 上書きを選ぶと、決まっている枠の行を消す',
      Array.isArray(swap.entryIdsToRemove) ? [...swap.entryIdsToRemove].sort((a, b) => a - b) : '(entryIdsToRemoveが無い)',
      [101, 102],
    )
    eq(
      'IF-8 上書きを選ぶと、コピー元の献立がその枠に入る',
      swap.ops,
      [
        { date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' },
        { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
      ],
    )
    eq(
      'IF-8 入れ替える食事の数を返す(規約Fの件数に使う)',
      swap.replacedSlotCount,
      2,
    )
    // 空いている枠しか無いときは、どちらの入れかたでも結果が同じ（消すものが無い）
    const emptyKeep = copyIF({ ...base, entries: [] })
    const emptySwap = copyIF({ ...base, entries: [], replaceAll: true })
    eq('IF-8 空いている枠には、どちらの入れかたでも入る(素通り防止)', emptyKeep.ops.length, 2)
    eq('IF-8 空いている枠だけなら、上書きを選んでも消すものは無い', emptySwap.entryIdsToRemove, [])
    // 鍵と過去日は「上書き」でも触らない（既存の約束を崩していないこと）
    const lockedSwap = copyIF({
      ...base,
      entries: filled,
      replaceAll: true,
      lockedKeys: new Set(['2026-08-10|dinner']),
    })
    eq(
      'IF-8 鍵の掛かった食事は、上書きを選んでも消さない',
      Array.isArray(lockedSwap.entryIdsToRemove) ? lockedSwap.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [102],
    )
    eq('IF-8 鍵の掛かった食事は、上書きを選んでも入れない', lockedSwap.ops, [
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    const pastSwap = copyIF({
      ...base,
      today: '2026-08-11',
      entries: filled,
      replaceAll: true,
    })
    eq(
      'IF-8 過ぎた日は、上書きを選んでも消さない',
      Array.isArray(pastSwap.entryIdsToRemove) ? pastSwap.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [102],
    )
    // コピー元にその食事が無い日は、総入れ替えでは空になる（自動提案の総入れ替えと同じ意味）。
    // 消える側の挙動なので、言葉（確認の窓の「消えるもの」）と数が食い違わないよう固定しておく
    const halfSource = copyIF({
      ...base,
      entries: filled,
      replaceAll: true,
      prevEntries: [prevEntries[0]],
    })
    eq(
      'IF-8 コピー元にその食事が無い日は、上書きを選ぶと空になる（消す行に数える）',
      Array.isArray(halfSource.entryIdsToRemove)
        ? [...halfSource.entryIdsToRemove].sort((a, b) => a - b)
        : '(entryIdsToRemoveが無い)',
      [101, 102],
    )
    eq(
      'IF-8 コピー元にある日にだけ、コピー元の献立が入る',
      halfSource.ops,
      [{ date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' }],
    )
  }

  // --- ⑪ 過去だけの週でロックのボタンを出すか(planShowWeekLock) ---
  // 過去日は予定のグリッドそのものが出ない＝手で足す・変える・消すができない。
  // 自動でまとめて動かす操作(提案・先週コピー)も過去日を初めから対象外にしている。
  // よって「過去だけの週」では鍵の掛けようが無い。今日・未来日が1日でも混ざる週では出す。
  {
    eq(
      'IF-11 ロックのボタンを出すかを決める関数がある（無ければ以下は測れていない）',
      typeof mealPlanLogicIF.planShowWeekLock === 'function',
      true,
    )
    const planShowWeekLock =
      typeof mealPlanLogicIF.planShowWeekLock === 'function'
        ? mealPlanLogicIF.planShowWeekLock
        : () => '(関数が無い)'
    // 月末・年またぎ・月初・うるう日の4通り。実行日がいつでも同じ結論になる
    const cases = [
      ['月末をまたぐ', '2026-08-31'],
      ['年をまたぐ', '2026-12-31'],
      ['月初', '2026-03-01'],
      ['うるう日', '2028-02-29'],
    ]
    for (const [name, today] of cases) {
      const past7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 7))
      const withToday = Array.from({ length: 7 }, (_, i) => shiftDate(today, i - 3))
      const future7 = Array.from({ length: 7 }, (_, i) => shiftDate(today, i + 1))
      eq(`IF-11 ${name}: 過去だけの週では出さない`, planShowWeekLock(past7, today), false)
      eq(`IF-11 ${name}: 今日を含む週では出す`, planShowWeekLock(withToday, today), true)
      eq(`IF-11 ${name}: 未来だけの週では出す`, planShowWeekLock(future7, today), true)
    }
  }

  // --- ④ コピー元の日付期間を文言に差し込む場所があること ---
  // オーナー原文「『先週の献立をコピー』に、コピー元の日付期間を書いてほしい」。
  // 表示している週を送ればコピー元も動くので、**文言に日付を書き込まず差し込み口を持つ**。
  // 実際に出る日付が画面の週と合っているかは e2e の WEEKFMT-01 が見る
  {
    const rangeTexts = {
      '空いた枠だけのときの説明': ja.mealPlan.copyWeekFillEmptyHint,
      '総入れ替えのときの説明': ja.mealPlan.copyWeekReplaceAllHint,
      '空いた枠だけの確認の窓の見出し': ja.mealPlan.copyWeekConfirmTitle,
      '総入れ替えの確認の窓の見出し': ja.mealPlan.copyWeekReplaceAllConfirmTitle,
      'コピー元が空のときの知らせ': ja.mealPlan.copyWeekNoSource,
    }
    for (const [name, text] of Object.entries(rangeTexts)) {
      eq(
        `IF-4 ${name}にコピー元の期間の差し込み口({start}と{end})がある`,
        typeof text === 'string' && text.includes('{start}') && text.includes('{end}'),
        true,
      )
      eq(
        `IF-4 ${name}は「先週」と決め打ちで書かない(選んだ週で変わるため)`,
        typeof text === 'string' && !text.includes('先週'),
        true,
      )
    }
  }

  // --- ⑧ 説明文が、直した動きと食い違っていないこと ---
  {
    eq(
      'IF-8 空いた枠だけのコピーの説明は「上書きしません」を言う(実装も上書きしない)',
      typeof ja.mealPlan.copyWeekFillEmptyHint === 'string' &&
        ja.mealPlan.copyWeekFillEmptyHint.includes('上書きしません'),
      true,
    )
    eq(
      'IF-8 総入れ替えのコピーの説明は「消してから」を言う(実装は消してから入れる)',
      typeof ja.mealPlan.copyWeekReplaceAllHint === 'string' &&
        ja.mealPlan.copyWeekReplaceAllHint.includes('消してから'),
      true,
    )
    for (const [name, text] of [
      ['空いた枠だけのときの説明', ja.mealPlan.copyWeekFillEmptyHint],
      ['総入れ替えのときの説明', ja.mealPlan.copyWeekReplaceAllHint],
    ]) {
      eq(
        `IF-8 ${name}から「入れかたは反映しません」が消えている(入れかたが効くようになったため)`,
        typeof text === 'string' && !text.includes('入れかたは反映しません'),
        true,
      )
    }
    // 規約F: 消える側の確認は「何が消えて何が残るか」を件数つきで両方言う
    eq(
      'IF-8 総入れ替えのコピーの確認に、消える品数の差し込み口がある',
      typeof ja.mealPlan.copyWeekReplaceAllGone === 'string' &&
        ja.mealPlan.copyWeekReplaceAllGone.includes('{n}') &&
        ja.mealPlan.copyWeekReplaceAllGone.includes('{s}'),
      true,
    )
    eq(
      'IF-8 総入れ替えのコピーの確認に、残るものを言う文がある',
      typeof ja.mealPlan.copyWeekReplaceAllKept === 'string' &&
        ja.mealPlan.copyWeekReplaceAllKept.length > 0,
      true,
    )
  }

  // --- ⑥ 出しかたの2択(おまかせ／週をコピー)は 2026-08-21 便IO で無くした ---
  // 別の週から入れる道は専用の画面へ独立したので、この節に2択そのものが無い。
  // 「古い文言が残っていないこと」は IO-4 が見る（消したはずのキーが復活したら赤くなる）
}

// ============================================================================
// 2026-08-20 便II: 献立の画面（オーナー承認済みだったのに着手できていなかった分）
//
// 禁じ手よけ:
//  ・曜日・月替わりの前提を置かない＝「今日」もコピー元も引数で渡し、日付を固定して結論を見る
//  ・読み取りに失敗したら必ず落ちる（関数や文言が無いときは、素通りではなくその場で1件NGにする）
// ============================================================================
{
  const mealPlanLogicII = await import('../src/logic/mealPlan.ts')
  const { planCopyLastWeek: copyII, suggestCandidates: candidatesII } = mealPlanLogicII

  // --- ⑤ コピー元の週を選べる（planCopyLastWeek の weeksBack） ---
  // オーナー原文「先週をコピーは、先週以外を今週に反映したい時に使えない。
  // 表示している週をコピーにはできない？」
  // 第1段階＝コピー先（表示している週）はそのままに、**コピー元の週を選べる**ようにした。
  // 1週間前だけを見る形だと「2週間前を今週へ」が永久にできないので、そこを固定する。
  {
    const prevEntries = [
      // 1週間前（2026-08-03の週）
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
      // 2週間前（2026-07-27の週）
      { date: '2026-07-27', slot: 'dinner', recipeId: 21, role: 'main' },
      { date: '2026-07-28', slot: 'dinner', recipeId: 22, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      entries: [],
      prevEntries,
    }
    const oneWeek = copyII(base)
    eq('II-5 選ばなければ、これまでどおり1週間前を写す（後方互換）', oneWeek.ops, [
      { date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    eq('II-5 1週間前を明示しても、選ばなかったときと同じ結果になる', copyII({ ...base, weeksBack: 1 }).ops, oneWeek.ops)
    const twoWeeks = copyII({ ...base, weeksBack: 2 })
    eq('II-5 2週間前を選ぶと、2週間前の献立を写す', twoWeeks.ops, [
      { date: '2026-08-10', slot: 'dinner', recipeId: 21, role: 'main' },
      { date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' },
    ])
    eq('II-5 コピー元の品数も、選んだ週のぶんだけ数える', twoWeeks.sourceTotal, 2)
    // 選んだ週に献立が無ければ「写すものが無い」＝黙って別の週から拾わない
    eq(
      'II-5 選んだ週に献立が無ければ、1品も写さない（別の週から拾わない）',
      copyII({ ...base, weeksBack: 3 }).ops,
      [],
    )
    eq('II-5 選んだ週に献立が無ければ、コピー元の品数も0', copyII({ ...base, weeksBack: 3 }).sourceTotal, 0)
    // 過ぎた日・鍵の約束は、どの週を選んでも変わらない
    eq(
      'II-5 コピー元を変えても、過ぎた日には入れない',
      copyII({ ...base, weeksBack: 2, today: '2026-08-11' }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' }],
    )
    eq(
      'II-5 コピー元を変えても、鍵の掛かった食事には入れない',
      copyII({ ...base, weeksBack: 2, lockedKeys: new Set(['2026-08-10|dinner']) }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' }],
    )
  }

  // --- ⑤ 文言: 2026-08-21 便IO で「コピー元の週」のプルダウンごと無くした ---
  // 中身を見ながら週を送って選ぶ画面に置き換えたので、文言の見張りは IO-4 が引き継ぐ

  // --- ① 調理時間の条件は「優先」ではなく「除外」（文言を実装に合わせる） ---
  // オーナー原文「「何分以内を優先する？」→指定した時間より長いレシピも選ばれるということ？
  // 表記も長いし、ここだけ疑問系なのが気になる。シンプルに「時間」でいいと思う」
  // 実装（logic/mealPlan.ts の suggestCandidates）は候補から**外して**いる。
  // 調理時間が入っていないレシピも一緒に外れるので、そこも文言で言う。
  {
    // まず実装の側を固定する（文言だけ直して実装が別物、を作らない）
    const r = (id, cookMinutes) => ({
      id,
      title: `品${id}`,
      tags: [],
      ingredients: [],
      steps: [],
      cookedLogs: [],
      cookMinutes,
    })
    const pool = [r(1, 10), r(2, 30), r(3, undefined), r(4, 0)]
    const picked = candidatesII(pool, {
      quickOnly: true,
      quickMinutes: 15,
      excludeNg: false,
      ngIngredients: [],
      usedRecipeIds: [],
      slot: 'dinner',
      season: 'summer',
    })
    eq(
      'II-1 実装: 調理時間の条件は「優先」ではなく候補から外す（15分より長い品は残らない）',
      picked.map((x) => x.id).sort((a, b) => a - b),
      [1],
    )
    eq(
      'II-1 実装: 調理時間を入れていない品も候補から外れる（文言で言うべき事実）',
      picked.some((x) => x.id === 3 || x.id === 4),
      false,
    )
    for (const [name, text] of [
      ['欄の名前', ja.mealPlan.quickMinutesLabel],
      ['選択肢', ja.mealPlan.quickMinutesOption],
      ['説明の1行', ja.mealPlan.quickOnlyHint],
    ]) {
      eq(
        `II-1 調理時間の条件の${name}に「優先」と書かない（実装は除外なので嘘になる）`,
        typeof text === 'string' && text.length > 0 && !text.includes('優先'),
        true,
      )
    }
    eq(
      'II-1 欄の名前は疑問形にしない（ここだけ問いかけになっていた）',
      typeof ja.mealPlan.quickMinutesLabel === 'string' &&
        !ja.mealPlan.quickMinutesLabel.includes('？') &&
        !ja.mealPlan.quickMinutesLabel.includes('?'),
      true,
    )
    eq(
      'II-1 欄の名前は短くする（8文字以内）',
      typeof ja.mealPlan.quickMinutesLabel === 'string' && ja.mealPlan.quickMinutesLabel.length <= 8,
      true,
    )
    eq(
      'II-1 調理時間を入れていない品が外れることを、説明の1行で言う',
      typeof ja.mealPlan.quickOnlyHint === 'string' &&
        ja.mealPlan.quickOnlyHint.includes('調理時間を入れていない'),
      true,
    )
    eq(
      'II-1 「指定なし」を選べる（条件を外す道が同じ欄の中にある）',
      typeof ja.mealPlan.quickMinutesNone === 'string' && ja.mealPlan.quickMinutesNone.length > 0,
      true,
    )
  }
}


// ==========================================================================================
// 便IJ: 説明まわりの3件（2026-08-20・すべてオーナー承認済み）
//
//  ① アーカイブの注意書き（「一覧のみ・写真の拡大なし」を**書き出す前に**知らせる）
//  ② NG食材の印に短い言葉（印だけでは意味が分からない）
//  ③ バックアップまわりの説明を読みやすく（アプリ＋説明ページ）
//
// 禁じ手よけ:
//  ・**文言を書き写さない**。画面に出る文字は ja.ts から読み、位置は e2e が実DOMで測る
//  ・**読み取りに失敗したら必ず落ちる**。拾えた数が0のときは、その場で不合格にする
//  ・要素の置き場所・入れ子の段数に依存しない（ここは文言と規則だけを見る）
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const len = (t) => (typeof t === 'string' ? t.replace(/​/g, '').length : -1)
  /** 文言が消えていても見張りが落ちる形で読む（未定義で例外にすると、何が欠けたか出ない） */
  const lines = (v) => (Array.isArray(v) ? v : [])
  const str = (v) => (typeof v === 'string' ? v : '')

  // ---- ① アーカイブファイルの読みかた（書き出す前に読む注意書き） --------------------------
  // オーナー原文:
  //   「アーカイブが一覧のみになるのは注意書きはありますか？写真の拡大もできないし、
  //     情報が削れるなら先に知りたい。」
  // 測るのは利用者が確かめたいこと＝**何が入るか／どう読むか／戻せるか**が画面の文言にあること。
  // 「どこに出ているか」は e2e（IJ-01）が実DOMのY座標で測る（役割を二重にしない）。
  {
    const rows = ja.settings.archiveFileRows
    eq('IJ-1 アーカイブファイルの説明が表の形で用意されている', Array.isArray(rows) && rows.length >= 3, true)
    const rowsOk = Array.isArray(rows) ? rows : []
    eq(
      'IJ-1 表の各行に見出しの語と本文がある',
      rowsOk.filter((r) => !r || !r.name || !r.body),
      [],
    )
    const body = rowsOk.map((r) => `${r?.name ?? ''}: ${r?.body ?? ''}`).join('\n')
    // ファイルに何が入るかを名指しする（「情報が削れる」と読まれないため）。
    // 何を挙げるべきかは**ファイルの形**（logic/cookedArchive.ts の ArchivedCookedLog）から取る
    // ＝項目が増えたら、この見張りが「説明に足りていない」と教える
    const FILE_FIELDS = [
      { field: 'date', word: '日付' },
      { field: 'recipeTitle', word: '料理名' },
      { field: 'note', word: 'メモ' },
      { field: 'servings', word: '人分' },
      { field: 'photoBase64', word: '写真' },
    ]
    {
      const sample = buildArchiveFile([
        {
          id: 'ij-1',
          date: '2026-01-02',
          recipeTitle: 'テスト煮',
          note: 'ひとこと',
          servings: 2,
          photoBase64: 'AAAA',
          photoType: 'image/jpeg',
        },
      ])
      const inFile = Object.keys(sample.logs[0] ?? {})
      eq(
        'IJ-1 見張りが当たっている（アーカイブファイルの項目を読めている）',
        FILE_FIELDS.filter(({ field }) => !inFile.includes(field)),
        [],
      )
      eq(
        'IJ-1 ファイルに入る項目が、説明の「入るもの」から抜けていない',
        FILE_FIELDS.filter(({ word }) => !body.includes(word)).map((f) => f.word),
        [],
      )
    }
    // 読みかたの制限（一覧だけ・写真は拡大できない）
    eq(
      'IJ-1 読む手段が「アーカイブを見る」の一覧だけであることを書いている',
      str(ja.settings.archiveViewButton).length > 0 && body.includes(str(ja.settings.archiveViewButton)) && body.includes('一覧'),
      true,
    )
    eq('IJ-1 写真を拡大できないことを書いている', body.includes('拡大'), true)
    eq('IJ-1 アプリには戻せないことを書いている', body.includes('戻せ') || body.includes('戻す'), true)
    // 「情報が削れる」の誤解を打ち消す1行（消えるのは端末側の記録で、ファイルの中身は減らない）
    eq(
      'IJ-1 消えるのは端末の記録のほうだと書いている',
      typeof ja.settings.archiveFileKeepNote === 'string' &&
        ja.settings.archiveFileKeepNote.includes('端末') &&
        ja.settings.archiveFileKeepNote.includes('ファイル'),
      true,
    )
    // 端末から消す最後の関門（規約Fの窓）にも、同じ制限が出ること
    for (const [name, exported] of [
      ['レシピの中の記録だけ', { logs: 2, photos: 0, detachedLogs: 0, cutoff: '2026-07-16' }],
      ['残った記録も混ざる', { logs: 5, photos: 2, detachedLogs: 2, cutoff: '2026-07-16' }],
    ]) {
      const notes = buildArchiveDeleteConfirm(exported).notes ?? []
      eq(
        `IJ-1 消す前の確認にも読みかたの制限が出る（${name}）`,
        notes.some((n) => n.includes(str(ja.settings.archiveViewButton)) && n.includes('拡大')),
        true,
      )
    }
  }

  // ---- ② NG食材の印の隣に出す短い言葉 --------------------------------------------------
  // オーナー原文:
  //   「レシピから追加のNG食材について、マークだけあっても意味がわからない。
  //     NG食材あり、など超短く説明欲しい。」
  // ここでは文言の性質（短い・読み上げ用と別物・呼び名がそろっている）だけを見る。
  // どのカードに出す／出さないかは e2e（IJ-02）が実DOMで測る。
  {
    const short = str(ja.card.ngBadgeShort)
    eq('IJ-2 印の隣に出す短い言葉がある', typeof short === 'string' && short.length > 0, true)
    eq('IJ-2 「超短く」（6文字以内）', len(short) <= 6, true)
    neq('IJ-2 読み上げ用の説明とは別の文言', short, ja.card.ngBadge)
    // 呼び名をそろえる: 設定の欄名・絞り込みと同じ言葉で呼ぶ（同じものを別名で呼ばない）。
    // 「NG食材」という語そのものを書き写さず、**設定の欄名の先頭から**取る
    const ngWord = str(ja.settings.ngTitle).split('（')[0]
    eq(
      'IJ-2 見張りが当たっている（設定の欄名から呼び名を取れている）',
      ngWord.length >= 2 && str(ja.search.excludeNg).includes(ngWord),
      true,
    )
    eq('IJ-2 設定の欄名と同じ呼び名を使っている', short.includes(ngWord), true)
    // 画面に出す口が共通のカード部品にあること（画面ごとに書き写していない）
    const cardSrc = readFileSync(path.join(appRoot, 'src/components/RecipeCard.tsx'), 'utf-8')
    eq('IJ-2 共通のカード部品が短い言葉を出している', cardSrc.includes('ja.card.ngBadgeShort'), true)
    const others = ['src/pages', 'src/components']
      .flatMap((dir) =>
        readdirSync(path.join(appRoot, dir))
          .filter((f) => f.endsWith('.tsx') && f !== 'RecipeCard.tsx')
          .map((f) => `${dir}/${f}`),
      )
      .filter((rel) => readFileSync(path.join(appRoot, rel), 'utf-8').includes('ngBadgeShort'))
    eq('IJ-2 短い言葉を画面側で書き写していない（出すのはカード部品だけ）', others, [])
  }

  // ---- ③ バックアップまわりの説明 ---------------------------------------------------------
  // オーナー原文:
  //   「バックアップまわりの説明が、文字ばかりで読みにくい。機種変更でアプリ卒業される。
  //     目につく単語だけで大体の内容を理解できるように、シンプルにしてください。
  //     詳しくは説明ページに案内すればOK。ただ、説明ページも同様に読みづらいので直してほしい。」
  //
  // 短くするときにいちばん危ないのは、**知らないと事故になる事実を一緒に消すこと**なので、
  // (a)並びの形 (b)事故になる事実 (c)説明ページの食い違い の3つを別々に測る。
  {
    // (a) 1つの塊だった説明が、短い行に分かれていること
    const SPLIT = [
      ['「作った記録」の写真のチェックの注記', ja.settings.backupIncludeCookedPhotosNotes],
      ['機種変更の注意', ja.settings.moveGuideNotes],
      ['ブラウザの設定でデータを消すときの注意', ja.settings.refreshAppCacheClearWarnings],
    ]
    for (const [name, lines] of SPLIT) {
      eq(`IJ-3 ${name}が短い行に分かれている`, Array.isArray(lines) && lines.length >= 2, true)
      eq(
        `IJ-3 ${name}の1行が長くなっていない（60字以内）`,
        (Array.isArray(lines) ? lines : []).filter((t) => len(t) > 60),
        [],
      )
    }
    // 書き出したあとの説明は「見出しの語＋短い本文」の形にする（目につく語だけで話が分かる）
    const LABELLED = [
      ['ファイルの場所', ja.settings.archiveWhereSavedLabel, ja.settings.archiveWhereSaved],
      ['端末が軽くなる条件', ja.settings.archiveSpaceLabel, ja.settings.archiveSpaceNote],
      ['そのあとのバックアップ', ja.settings.archiveBackupLabel, ja.settings.archiveBackupNote],
    ]
    for (const [name, label, text] of LABELLED) {
      eq(`IJ-3 ${name}に見出しの語がある`, typeof label === 'string' && label.length > 0 && len(label) <= 12, true)
      eq(`IJ-3 ${name}の本文が長くなっていない（60字以内）`, len(text) > 0 && len(text) <= 60, true)
    }

    // (b) 知らないと事故になる事実が、**アプリの中から**消えていないこと。
    // 言い回しは規約Hで変わり続けるので、事実の核になる語だけを見る。
    // あわせて「その文言が設定の画面から参照されているか」も見る＝ja に残っていても
    // 画面から外れていたら落ちる（説明ページへ送っただけ、を事故にしない）。
    const screenSrc = ['src/pages/SettingsPage.tsx', 'src/logic/backup.ts', 'src/logic/cookedArchive.ts']
      .map((rel) => readFileSync(path.join(appRoot, rel), 'utf-8'))
      .join('\n')
    const HAZARDS = [
      {
        name: '「作った記録」の写真は既定でバックアップに入らない',
        key: 'backupIncludeCookedPhotosNotes',
        text: lines(ja.settings.backupIncludeCookedPhotosNotes).join('\n'),
        must: [/OFF/, /写真/, /入りません|入らず|入らない/],
      },
      {
        name: 'バックアップファイルには解錠コードが入る（他の人に渡さない）',
        key: 'backupContainsCodeNotice',
        text: str(ja.settings.backupContainsCodeNotice),
        must: [/解錠コード/, /渡さない/],
      },
      {
        name: '「データを上書き」は今のデータを消す',
        key: 'importReplaceCaption',
        text: str(ja.settings.importReplaceCaption),
        must: [/今のデータ/, /消して|消す/],
      },
      {
        name: '「元に戻す」はこの設定画面を離れると使えない',
        key: 'backupImportReplaceNote',
        text: str(ja.settings.backupImportReplaceNote),
        must: [new RegExp(esc(str(ja.settings.replaceUndoButton))), /画面/, /戻せません|使えなく/],
      },
      {
        name: '「前回の場所に上書き」がどのファイルを書き換えるか分かる',
        key: 'backupOverwriteNoteWithName',
        text: str(ja.settings.backupOverwriteNoteWithName),
        must: [/\{name\}/, /上書き/],
      },
      {
        name: '機種変更: 記録の写真はチェックをONにしてから書き出す',
        key: 'moveGuideStep1Note',
        text: str(ja.settings.moveGuideStep1Note),
        must: [/写真/, /ON/],
      },
      {
        name: '機種変更: 新しい端末の中身が上書きで消える／手放すのは確かめてから',
        key: 'moveGuideNotes',
        text: lines(ja.settings.moveGuideNotes).join('\n'),
        must: [/上書き/, /消え/, /初期化|下取り/, /確かめて/],
      },
      {
        name: 'ブラウザの設定でサイトデータを消すと全部消える（戻せるのはバックアップだけ）',
        key: 'refreshAppCacheClearWarnings',
        text: lines(ja.settings.refreshAppCacheClearWarnings).join('\n'),
        must: [/Cookie/, /消え/, /バックアップ/],
      },
      {
        name: '書き出しただけでは端末の記録は減らない（消すのは別のボタン）',
        key: 'archiveDeleteNote',
        text: `${lines(ja.settings.archiveSteps).join('\n')}\n${str(ja.settings.archiveDeleteNote)}`,
        must: [new RegExp(esc(str(ja.settings.archiveDeleteButton))), /確かめて/],
      },
      {
        name: '端末から消した記録は、そのあとのバックアップに入らない',
        key: 'archiveBackupNote',
        // 見出しの語と本文で1つの話（見出しに「バックアップ」、本文に「入りません」）
        text: `${str(ja.settings.archiveBackupLabel)}\n${str(ja.settings.archiveBackupNote)}`,
        must: [/バックアップ/, /入りません/, /控え/],
      },
      {
        name: 'ファイル名の「.json」を消すと読み込むときに選べない',
        key: 'fileNameFreeNote',
        text: str(ja.settings.fileNameFreeNote),
        must: [/\.json/, /選べ/],
      },
    ]
    eq('IJ-3 見張りが対象を拾えている（事故になる事実の一覧が空でない）', HAZARDS.length >= 10, true)
    eq(
      'IJ-3 事故になる事実の文言が、どれも空になっていない',
      HAZARDS.filter((h) => len(h.text) === 0).map((h) => h.name),
      [],
    )
    eq(
      'IJ-3 事故になる事実が、アプリの中から1つも消えていない',
      HAZARDS.flatMap((h) =>
        h.must.filter((re) => !re.test(h.text)).map((re) => `${h.name} ← ${re}`),
      ),
      [],
    )
    eq(
      'IJ-3 事故になる事実の文言が、設定の画面から参照されている（説明ページへ送っただけにしない）',
      HAZARDS.filter((h) => !screenSrc.includes(h.key)).map((h) => h.name),
      [],
    )

    // (c) 説明ページとアプリの食い違い: 書いてあるファイル名の頭が、実際に書き出す名前と合うこと。
    // 2026-08-20 便IH・④でアーカイブの名前を records → archive に変えたとき、使い方ページだけが
    // 古い名前のまま残っていた（アプリと説明ページで別の名前を案内していた）。
    // 個別の文字列を書き写さず、**「uchi-recipe-◯◯-」の形を掃いて実際の名前と突き合わせる**。
    {
      const realNames = [
        backupFileName(new Date(2026, 7, 2)),
        selectedRecipesFileName(new Date(2026, 7, 2)),
        archiveFileName(new Date(2026, 7, 2)),
      ]
      // 見るのは**利用者の目に触れる文字**だけ。作りのコメント（「records から archive に変えた」
      // のような経緯のメモ）は画面に出ないので落とす
      const noComments = (src) =>
        src
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
      const targets = [
        { rel: 'src/i18n/ja.ts', text: noComments(readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')) },
      ]
      const aboutDir = path.join(appRoot, 'public/about')
      for (const name of readdirSync(aboutDir).filter((f) => f.endsWith('.html')).sort()) {
        targets.push({
          rel: `public/about/${name}`,
          text: noComments(readFileSync(path.join(aboutDir, name), 'utf-8')),
        })
      }
      const found = []
      const wrong = []
      for (const { rel, text } of targets) {
        for (const m of text.matchAll(/uchi-recipe-[a-z]+-/g)) {
          found.push(`${rel} ${m[0]}`)
          if (!realNames.some((n) => n.startsWith(m[0]))) wrong.push(`${rel} 「${m[0]}」`)
        }
      }
      eq('IJ-3 見張りが当たっている（ファイル名の頭を1つ以上拾えている）', found.length > 0, true)
      eq(
        'IJ-3 説明ページとアプリが同じファイル名を案内している',
        wrong,
        [],
      )
    }
  }
}


// ==========================================================================================
// 便IL: URLからの取り込み5件（2026-08-20 オーナー実機報告・プリンのレシピ）
// ==========================================================================================

// ---------- IL-1 取り込んだ文にHTMLの印が残らない（①） ----------
// オーナー原文: 「手順で『<br>』が入ったままなのは気になった。」
// **<br>だけを名指ししない**。取り込み元は「生のタグ」でも「実体参照に置き換えた形」でも
// 同じ見た目を作るので、どちらの書き方で来てもタグとして落ちることを規則で確かめる
// （実体参照を先に読み解くと `&lt;br&gt;` が `<br>` に化け、そのまま手順に残っていた）。
{
  const TAGISH = /<[^>]{1,60}>/
  const ENTITYISH = /&(?:[a-zA-Z]{2,10}|#\d{1,5}|#x[0-9a-fA-F]{1,5});/
  const markupSteps = [
    '卵を溶く<br>砂糖を加える',
    '卵を溶く<br />砂糖を加える',
    '卵を溶く&lt;br&gt;砂糖を加える',
    '卵を溶く&lt;br /&gt;砂糖を加える',
    '<b>弱火</b>で20分煮る',
    '&lt;b&gt;弱火&lt;/b&gt;で20分煮る',
    '<span class="tips">砂糖</span>を加えて混ぜる',
    '&lt;p&gt;粗熱を取る&lt;/p&gt;',
    '&lt;strong&gt;しっかり&lt;/strong&gt;混ぜる',
    '塩&amp;こしょうをふる',
    '砂糖&nbsp;を加える',
  ]
  const cleanedSteps = filterImportedSteps(markupSteps)
  eq('IL-1 取り込んだ手順にHTMLのタグが残らない', cleanedSteps.filter((s) => TAGISH.test(s)), [])
  eq('IL-1 取り込んだ手順にHTMLの実体参照が残らない', cleanedSteps.filter((s) => ENTITYISH.test(s)), [])
  eq('IL-1 印を落としても手順が1件も消えない', cleanedSteps.length, markupSteps.length)
  // 改行の印は「消す」だけだと前後の文がくっつく（「卵を溶く砂糖を加える」）。区切りとして扱えているか
  for (const [label, text] of [
    ['生の改行タグ', '卵を溶く<br>砂糖を加える'],
    ['閉じ記号つきの改行タグ', '卵を溶く<br />砂糖を加える'],
    ['実体参照の改行タグ', '卵を溶く&lt;br&gt;砂糖を加える'],
    ['段落の区切り', '<p>卵を溶く</p><p>砂糖を加える</p>'],
    ['箇条書きの区切り', '<li>卵を溶く</li><li>砂糖を加える</li>'],
  ]) {
    eq(`IL-1 ${label}の前後がくっつかない`, filterImportedSteps([text])[0].includes('溶く砂糖'), false)
  }
  const markupRows = buildImportedIngredientRows([
    { name: '砂糖&lt;br&gt;', amount: '50g' },
    { name: '<b>無塩バター</b>', amount: '30g' },
    { name: '生クリーム&nbsp;', amount: '200ml' },
    { name: '塩&amp;こしょう', amount: '少々' },
  ])
  const rowText = (r) => `${r.name} ${r.amount} ${r.unit} ${r.memo}`
  eq('IL-1 取り込んだ材料にHTMLのタグが残らない', markupRows.filter((r) => TAGISH.test(rowText(r))), [])
  eq(
    'IL-1 取り込んだ材料にHTMLの実体参照が残らない',
    markupRows.filter((r) => ENTITYISH.test(rowText(r))),
    [],
  )
  eq(
    'IL-1 材料名は印を落としても中身が残る',
    markupRows.map((r) => r.name),
    ['砂糖', '無塩バター', '生クリーム', '塩&こしょう'],
  )
  // 貼り付け経路（写真取り込みのBYO-AIを含む）も同じ手当てを通す。
  // ただし貼り付けは**行の切れ目で材料・手順を見分ける**ので、改行は残すこと
  {
    const pasted = stripPastedMarkup('<p>卵 2個</p>\n&lt;b&gt;牛乳&lt;/b&gt; 200ml')
    eq('IL-1 貼り付けた文章からもHTMLのタグが落ちる', TAGISH.test(pasted), false)
    eq('IL-1 貼り付けた文章からもHTMLの実体参照が落ちる', ENTITYISH.test(pasted), false)
    eq('IL-1 貼り付けの改行は残す（行で材料と手順を見分けるため）', pasted.includes('\n'), true)
  }
}

// ---------- IL-2 注記の行は前の手順のメモへ寄せる（②） ----------
// オーナー原文: 「自動だと手順のメモ欄は基本的に未対応？プリンのカラメルの手順の後に、
//   単独手順で代用可能の工程が挟まっているのが気になった。」
// 線引きは**行頭の注記記号（※＊）だけ**。実サイト168本の手順1,070件を数えた結果、
// 「代用」「お好みで」という語での判定は本物の仕上げ手順を巻き込む（外した例を下に固定する）。
{
  const { attachImportedStepNotes } = await import('../src/logic/urlImportRows.ts')
  const rows = attachImportedStepNotes([
    '鍋にグラニュー糖と水を入れて中火にかける',
    '※カラメルは市販のカラメルソースで代用できます',
    '卵と牛乳を混ぜて型に流す',
  ])
  eq('IL-2 注記の行は手順として増えない', rows.length, 2)
  eq('IL-2 注記は直前の手順のメモに入る', rows[0].memo, 'カラメルは市販のカラメルソースで代用できます')
  eq(
    'IL-2 手順の本文は1文字も書き換えない',
    rows.map((r) => r.text),
    ['鍋にグラニュー糖と水を入れて中火にかける', '卵と牛乳を混ぜて型に流す'],
  )
  const texts = (steps) => attachImportedStepNotes(steps).map((r) => r.text)
  // 「※の板チョコは…」「※印の材料を…」は注記ではなく、合わせ調味料の印を指した本物の手順（楽天レシピ実測）
  eq('IL-2 印を指す「※の◯◯」は手順のまま', texts(['湯煎する', '※の板チョコを溶かす']).length, 2)
  eq('IL-2 「※印の◯◯」も手順のまま', texts(['湯煎する', '※印の材料を混ぜる']).length, 2)
  // 寄せ先が無い先頭の行は手順のまま（注記だからといって消さない）
  eq('IL-2 先頭の行は寄せ先が無いので手順のまま', texts(['※オーブンは170度に予熱しておく', '生地を混ぜる']).length, 2)
  // 外した例: 語だけで判断しない（実測では「お好みで」の大半が本物の仕上げ手順だった）
  eq('IL-2 「お好みで」で始まる行は手順のまま', texts(['器に盛る', 'お好みでパセリをふる']).length, 2)
  eq('IL-2 「代用」を含むだけの行も手順のまま', texts(['器に盛る', '生クリームは牛乳で代用して泡立てる']).length, 2)
  eq('IL-2 注記が無ければ手順はそのまま', texts(['湯煎する', '型に流す', '冷やす']).length, 3)
  // 注記が続いたら1つのメモにまとめる（手順を増やさない）
  const twoNotes = attachImportedStepNotes(['焼く', '※温度は調節してください', '＊焦げそうならホイルをかぶせる'])
  eq('IL-2 続いた注記は1つの手順のメモにまとまる', twoNotes.length, 1)
  eq('IL-2 まとまった注記は行を分けて残す', twoNotes[0].memo.split('\n').length, 2)
}

// ---------- IL-3 商品名の飾り語を落としてから名寄せする（③） ----------
// オーナー原文: 「原価や栄養計算で、『オーガニックバニラビーンズペースト』や『微粒子グラニュー糖』
//   など、商品名の一部を切り取って材料を判断することは不可能ですか？」
// **落としてよい語（産地・品質の売り文句）と、落としてはいけない語（味・中身が変わる語）**の
// 両方を測る。落としすぎると「無塩バター」が「バター」になり、栄養の食塩相当量が狂う。
{
  const { stripIngredientDecoration } = await import('../src/logic/kana.ts')
  const { matchNutritionFood } = await import('../src/logic/nutrition.ts')
  const priceIdx = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))

  // (1) 落としてよい語: 落とした後の名前で名寄せに当たる
  const decorated = [
    ['有機牛乳', '牛乳'],
    ['国産たまねぎ', 'たまねぎ'],
    ['こだわりの卵', '卵'],
    ['微粒子グラニュー糖', 'グラニュー糖'],
    ['オーガニックバニラビーンズペースト', 'バニラビーンズペースト'],
    ['新鮮なきゅうり', 'きゅうり'],
    ['市販のホイップクリーム', 'ホイップクリーム'],
    ['あればパセリ', 'パセリ'],
  ]
  for (const [name, bare] of decorated) {
    eq(`IL-3 飾り語を落とすと「${bare}」になる`, stripIngredientDecoration(name), bare)
  }
  // 名寄せは「飾り語つきでも、飾り語なしと同じ結果になる」ことで測る
  // （辞書に無い食材はどちらもnullで、悪くなっていないことが分かる）
  for (const [name, bare] of decorated) {
    eq(
      `IL-3 栄養の名寄せが「${name}」でも「${bare}」と同じになる`,
      matchNutritionFood(name)?.label ?? null,
      matchNutritionFood(bare)?.label ?? null,
    )
    eq(
      `IL-3 原価の名寄せが「${name}」でも「${bare}」と同じになる`,
      matchPriceEntry(name, priceIdx)?.normalizedName ?? null,
      matchPriceEntry(bare, priceIdx)?.normalizedName ?? null,
    )
  }
  // オーナーが挙げた2つが、実際に栄養の食品に当たること
  eq('IL-3 「微粒子グラニュー糖」が砂糖として計算される', matchNutritionFood('微粒子グラニュー糖')?.label, '砂糖')

  // (2) 落としてはいけない語: 名前が1文字も変わらない
  const keepAsIs = [
    '無塩バター',
    '有塩バター',
    '減塩しょうゆ',
    '無調整豆乳',
    '低脂肪牛乳',
    '無糖ヨーグルト',
    '加糖練乳',
    '生クリーム',
    '生姜',
    '生パン粉',
    '冷凍パイシート',
    '純ココア',
    '薄力粉',
    '強力粉',
    '全粒粉',
    '無洗米',
    '粗びき黒こしょう',
  ]
  for (const name of keepAsIs) {
    eq(`IL-3 「${name}」は飾り語として落とさない`, stripIngredientDecoration(name), name)
  }
  // 落としすぎの実害を1つ固定する: 無塩バターがバターに化けたら食塩相当量が変わってしまう
  neq('IL-3 「無塩バター」を「バター」に丸めない', stripIngredientDecoration('無塩バター'), 'バター')
  // 飾り語だけの名前は空にしない（残りが無くなるなら落とさない）
  eq('IL-3 「国産」だけの行は名前を空にしない', stripIngredientDecoration('国産'), '国産')

  // (3) 名寄せを悪くしていないこと（飾り語のない名前の結果は1件も変わらない）
  const plain = ['牛乳', 'たまねぎ', '卵', 'バター', '砂糖', '鮭', '酒', '豆腐', 'にんじん']
  for (const name of plain) {
    eq(`IL-3 「${name}」の名前はそのまま`, stripIngredientDecoration(name), name)
  }
}

// ---------- IL-4 材料に混じった調理器具に印を付ける（④） ----------
// オーナー原文: 「このレシピだと、材料と一緒に調理器具も登録されます。さすがに自動だったら
//   このくらいはユーザーで消せば良いと思います。」
// **外さずに印を付ける**（材料側にも「型用バター」「冷凍パイシート」のように器具の語を含む
// 本物の材料があるため、機械で消すと本物が消える）。
{
  const { isImportedCookwareName } = await import('../src/logic/urlImportRows.ts')
  const cookware = [
    'プリン型',
    '18cmパウンド型',
    'マフィン型',
    'シフォンケーキ型',
    'プリンカップ',
    '耐熱容器',
    'ボウル',
    'バット',
    'オーブンシート',
    'クッキングシート',
    'アルミホイル',
    '竹串',
    '泡立て器',
    '茶こし',
    '保存袋',
  ]
  for (const name of cookware) {
    eq(`IL-4 「${name}」は調理器具として印が付く`, isImportedCookwareName(name), true)
  }
  // 材料のほうに出る紛らわしい名前には印を付けない（消してしまうと本物の材料が消える）
  const notCookware = [
    '型用バター',
    '冷凍パイシート',
    'パイシート',
    'カップケーキ用の生地',
    '生クリーム',
    '牛乳',
    '砂糖',
    '型抜きクッキーの生地',
    'コーヒーカップ1杯分の水',
  ]
  for (const name of notCookware) {
    eq(`IL-4 「${name}」には印を付けない`, isImportedCookwareName(name), false)
  }
  eq('IL-4 空の名前には印を付けない', isImportedCookwareName('  '), false)
}

// ---------- IL-5 「デザート」でも「おやつ」でも同じ品が出る（⑤） ----------
// オーナー原文: 「検索に引っかかるワードとしては『おやつ』も『デザート』もそれぞれで出てほしい。
//   内容としてはおなじなので、『デザート』で『おやつ』が表示されるのでも、逆でもいい。
//   ただ、大学芋がデザートかといえば違う気がするので『おやつ』だよなあ、はあります。種別はそのまま。」
// タグ名は「おやつ」のまま・種別の表示名も「その他」のまま。**タグの別名**として当てる
// （種別「その他」に「デザート」を足すと、パン・飲み物まで甘いもの扱いで並ぶため足さない）。
{
  const ilRecipe = (over) => ({
    id: 0,
    title: '',
    tags: [],
    keywords: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
  const ilWithWords = (r) => ({
    ...r,
    searchWords: buildSearchWords(r.title, r.ingredients, r.tags, r.keywords, r.steps, r.dishType),
  })
  // 同梱の基本レシピ（オーナーが実機で見ている中身そのもの）で測る
  const ilRecipes = starterDefs.map((def, i) => ilWithWords(ilRecipe({ ...def, id: i + 1 })))
  const ilFind = (q) =>
    searchRecipes(ilRecipes, { ...defaultSearchOptions, ngIngredients: [], query: q })
      .map((r) => r.recipe.title)
      .sort()
  const oyatsu = ilFind('おやつ')
  const dessert = ilFind('デザート')
  eq('IL-5 「おやつ」で当たる品がある（掴めていないまま合格に倒れない）', oyatsu.length > 0, true)
  eq('IL-5 「デザート」でも「おやつ」と同じ品が出る', dessert, oyatsu)
  // 種別「その他」には「鮭フレーク」「だしのとり方」も入っている。甘くない品まで並べない
  eq('IL-5 「デザート」で種別「その他」の品まで並ばない', dessert.includes('手作り鮭フレーク'), false)
  eq('IL-5 「デザート」で「だしのとり方」は出ない', dessert.includes('だしのとり方'), false)
  // 「その他」で絞る従来の道は今までどおり効く（種別の表示名は変えていない）
  eq('IL-5 種別の言葉「その他」は変えていない', dishTypeSearchWord('dessert'), 'その他')
  // 一致した場所の言い方: 別名で当たっても、レシピに書いてある言葉（タグ「おやつ」）を出す
  const ilDessertReasons = ilFind('デザート').length > 0
    ? searchMatchReasons(
        ilRecipes.find((r) => r.tags.includes('おやつ')),
        splitTerms('デザート'),
      )
    : []
  eq('IL-5 別名で当たったときは「タグ」に出る', ilDessertReasons.map((x) => x.field), ['tag'])
  eq(
    'IL-5 別名で当たったときはレシピに書いてある言葉を出す',
    ilDessertReasons.map((x) => x.word),
    ['おやつ'],
  )
  eq(
    'IL-5 一致した場所の行は ja の文言から作る',
    searchMatchRowText({ field: 'tag', word: 'おやつ', count: dessert.length }),
    ja.search.matchRow
      .replace('{field}', ja.search.matchFieldTag)
      .replace('{word}', 'おやつ')
      .replace('{n}', String(dessert.length)),
  )
}

// ============================================================================
// 2026-08-21 便IO: 「別の週から入れる」（中身を見ながら選ぶ）
//
// オーナー原文:
//   「先週に限らず、ユーザーが選んだ７日間を指定（献立一覧で表示して、今表示している
//     ７日間の献立を今週に反映、と言った感じ？献立の中身も確認できるし。いい案求む）
//     →この週の献立をコピー（名前はちゃんと考えて）、この週の献立をテンプレートとして
//     保存、みたいな？」
//
// 効く理由: 「先週」だけを選べる形では、**何が入っていたか思い出せないまま押す**ことになる。
// 中身を見ながら選べることが本題なので、測るのも次の2つにする:
//   ① 画面に並べる「その週の中身」が、実際にその週に入っているものと一致する
//   ② 入れたあと、その中身がそのまま入れ先の週に入っている
//
// 禁じ手よけ:
//  ・「今日」もコピー元も引数で渡す＝走らせた日の曜日・月替わりで結論が変わらない
//  ・文言は ja.ts から読む（画面の字を書き写さない）
//  ・関数が無いときは素通りせず、その場でNGにする
// ============================================================================
{
  const io = await import('../src/logic/mealPlan.ts')
  const viewOf = io.copySourceWeekView
  const maxBack = io.maxCopySourceWeeksBack
  eq('IO-0 その週の中身を作る関数がある（copySourceWeekView）', typeof viewOf === 'function', true)
  eq(
    'IO-0 さかのぼれる上限を決める関数がある（maxCopySourceWeeksBack）',
    typeof maxBack === 'function',
    true,
  )
  if (typeof viewOf === 'function' && typeof maxBack === 'function') {
    const days = (start, n) => Array.from({ length: n }, (_, i) => io.shiftDate(start, i))
    // 日付は固定して渡す（曜日・月替わりの前提を置かない）。SRCの2週間あとがDST
    const SRC = days('2026-08-03', 7)
    const DST = days('2026-08-17', 7)
    const source = [
      { date: SRC[0], slot: 'dinner', recipeId: 11, role: 'main' },
      { date: SRC[0], slot: 'dinner', recipeId: 12, role: 'side' },
      { date: SRC[0], slot: 'breakfast', recipeId: 13, role: 'main' },
      { date: SRC[3], slot: 'dinner', recipeId: 14, role: 'main' },
      // この週の外（1日前）。取得範囲の重なりでまぎれ込みやすいので、必ず捨てることを見る
      { date: io.shiftDate(SRC[0], -1), slot: 'dinner', recipeId: 99, role: 'main' },
    ]
    const visible = ['dinner']
    const view = viewOf(source, SRC, visible)

    // --- ① 見えている中身が、その週に実際に入っているものと一致する ---
    eq(
      'IO-1 中身は、選んだ7日分をそのまま並べる（献立の無い日も抜けない）',
      view.map((d) => d.date),
      SRC,
    )
    eq(
      'IO-1 その週の外の日の献立はまぎれ込まない',
      view.flatMap((d) => d.slots.flatMap((s) => s.recipeIds)).includes(99),
      false,
    )
    eq(
      'IO-1 表示していない食事は中身にも出さない（入らないものを見せない）',
      view.flatMap((d) => d.slots.map((s) => s.slot)).filter((s) => s !== 'dinner'),
      [],
    )
    eq(
      'IO-1 ある日の中身が、その日に入っている献立と一致する',
      view.find((d) => d.date === SRC[0]).slots,
      [{ slot: 'dinner', recipeIds: [11, 12] }],
    )
    eq('IO-1 献立の無い日は空のまま並ぶ', view.find((d) => d.date === SRC[1]).slots, [])

    // --- ② 入れたあと、見えていた中身がそのまま入れ先に入っている ---
    const plan = io.planCopyLastWeek({
      dates: DST,
      today: DST[0],
      visibleSlots: visible,
      entries: [],
      prevEntries: source,
      weeksBack: 2,
    })
    const shown = view.flatMap((d) =>
      d.slots.flatMap((s) =>
        s.recipeIds.map((recipeId) => ({ date: d.date, slot: s.slot, recipeId })),
      ),
    )
    const put = plan.ops.map((op) => ({
      date: io.shiftDate(op.date, -14),
      slot: op.slot,
      recipeId: op.recipeId,
    }))
    eq('IO-2 見えていた中身が、1品も欠けずにそのまま入れ先へ入る', put, shown)
    eq('IO-2 前提: 入れるものが1品以上ある（0品どうしの一致で素通りしない）', shown.length, 3)

    // --- ③ どこまでさかのぼれるかは、献立のある一番古い日で決まる ---
    eq('IO-3 献立が1件も無ければ、1週間前までにする', maxBack(DST[0], undefined), 1)
    eq(
      'IO-3 入れ先より新しい献立しか無くても、1週間前までは見られる',
      maxBack(DST[0], io.shiftDate(DST[0], 3)),
      1,
    )
    eq('IO-3 1週間前の週の中に献立があれば、1週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -1)), 1)
    eq('IO-3 ちょうど7日前に献立があれば、1週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -7)), 1)
    eq('IO-3 8日前に献立があれば、2週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -8)), 2)
    eq('IO-3 364日前に献立があれば、52週間前まで（去年の同じ時期に届く）', maxBack(DST[0], io.shiftDate(DST[0], -364)), 52)
  }

  // --- ④ 文言（画面の字は書き写さず、ja.ts に在ることだけを見る） ---
  eq(
    'IO-4 「別の週から入れる」の名前がある',
    typeof ja.mealPlan.copyPickTitle === 'string' && ja.mealPlan.copyPickTitle.length > 0,
    true,
  )
  eq(
    'IO-4 入れ先の週を日付で言う差し込み口がある',
    typeof ja.mealPlan.copyPickTarget === 'string' &&
      ja.mealPlan.copyPickTarget.includes('{start}') &&
      ja.mealPlan.copyPickTarget.includes('{end}'),
    true,
  )
  eq(
    'IO-4 実行のボタンに名前がある',
    typeof ja.mealPlan.copyPickRun === 'string' && ja.mealPlan.copyPickRun.length > 0,
    true,
  )
  eq(
    'IO-4 献立を1件も入れていない人に、行き止まりにしない1行がある',
    typeof ja.mealPlan.copyPickNoPlansYet === 'string' &&
      ja.mealPlan.copyPickNoPlansYet.length > 0,
    true,
  )
  eq(
    'IO-4 その週をテンプレートとして保存するボタンに名前がある',
    typeof ja.mealPlan.copyPickSaveTemplate === 'string' &&
      ja.mealPlan.copyPickSaveTemplate.length > 0,
    true,
  )
  // 規約F: 消す操作の確認文は、消える先の週も日付で言い切る
  eq(
    'IO-4 総入れ替えの確認文が、消える先の週を日付で言う（規約F）',
    typeof ja.mealPlan.copyWeekReplaceAllConfirmTitle === 'string' &&
      ja.mealPlan.copyWeekReplaceAllConfirmTitle.includes('{toStart}') &&
      ja.mealPlan.copyWeekReplaceAllConfirmTitle.includes('{toEnd}'),
    true,
  )
  // 同じことをする道が2つあると迷う＝古いプルダウンの文言は残さない
  eq(
    'IO-4 古い「コピー元の週」のプルダウンと出しかたの2択の文言が残っていない',
    [
      ja.mealPlan.copySourceWeekLabel,
      ja.mealPlan.copySourceWeekOption,
      ja.mealPlan.fillSourceCopy,
      ja.mealPlan.fillSourceSuggest,
      ja.mealPlan.fillSourceGroupLabel,
    ].filter((v) => v !== undefined),
    [],
  )
}

// ---------- 便IN: 折りたたみの中にしか無い操作が無いか（COLLAPSE-1） ----------
/**
 * オーナーの原則（2026-08-20）:
 *   「アプリ全体で、折りたたみを一切開かなくても、最低限一通りすべての機能を触れる
 *     （使いこなすために開く）ようにしたい。」
 *
 * **2026-08-22 オーナーの訂正（便IV）**:
 *   「折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
 *     初心者が使わないような機能はしまっておく、という意味合いでした。」
 * ＝この原則は「**毎日使うものは畳んでも押せる**」であって、「すべての操作を外に出す」では
 * なかった。便IN（2026-08-21）が後者と読んで、週タブの「空にする」「テンプレートとして保存」
 * 「テンプレートを適用」「過去の献立をコピー」を折りたたみの外へ出したが、
 * 便IVでオーナーの訂正どおり中へ戻した。**下の一覧はその訂正の受け皿でもある**。
 *
 * この見張りは**5か所を名前で並べるのではなく、規則で掃く**:
 *   ① `src/**\/*.tsx` から `<Collapse>…</Collapse>` の中身の範囲を取る（畳むと消える場所）
 *   ② 「畳むと消える場所でしか使われていない部品」も同じ扱いにする（何段でもたどる）。
 *      例: レシピ詳細の栄養枠は Collapse の中で `<LockedBody>` を描き、その中で
 *      `<ProNutrientTeaser>` を描く。中身は別の関数に書いてあるが、画面では二重に隠れている
 *   ③ その範囲にある**操作の要素**（button / Link / select / input / textarea / label）が
 *      使っている文言キー（`ja.○○.△△`）を集める
 *   ④ そのキーが**折りたたみの外に1つも出てこない**なら、「開かないと触れない操作」とみなす
 *
 * 文言そのものは書き写さない（キーで測る）＝ja.ts の文を直しても、この見張りは赤くならない。
 *
 * 外に出てきても「入口」と数えないもの: 読み上げ名（aria-label）と見出し（h1〜h6）。
 * ボタンを押して開く窓が、そのボタンと同じ文言を見出し・読み上げ名に使うため
 * （例「表示している週をテンプレートとして保存」）、数えると入口が有るように見えてしまう。
 *
 * 開いてから、でよいものは下の一覧に**理由つきで**書く。ここに足すこと自体が
 * 「畳んだままでは触れない」と認めた記録になる（黙って通せない形にしてある）。
 */
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  /** 開いてから、でよい操作（キー → そう決めた理由） */
  const OPEN_TO_REFINE = {
    // --- 献立の「週」 ---
    // 表示起点の切替は「見え方の好み」で、既定（週区切り）のままでも週の中身は全部読める。
    // 「表示のしかた」の見出しの横は表示する食事のチップで埋まっており、
    // そこへ同じ形のチップをもう2つ足すと、2組のチップが並んでどちらがどちらか読めなくなる
    'ja.mealPlan.weekLayoutCalendar': '表示起点の切替は見え方の好み。既定のままでも週の中身は全部読める',
    'ja.mealPlan.weekLayoutRolling': '表示起点の切替は見え方の好み。既定のままでも週の中身は全部読める',
    // 2026-08-22 便IV（オーナー原文「「表示のしかた」の折りたたんだ表示には、空にする項目を
    // 入れないで」）: 週の献立をまとめて消す操作は**しまう側**。毎日押すものではなく、
    // 訂正の原文が名指しした「初心者が使わないような機能」に当たる。
    // 開けば「何が消えるか」の1行・対象の食事のチップ・ボタンが同じ場所にそろって出る
    'ja.mealPlan.clearWeekSlotButton': '週の献立をまとめて消す操作。毎日押すものではないのでしまう（便IVのオーナーの訂正）',
    'ja.mealPlan.clearWeekSlotTargetAria': '同上（「空にする」の対象を選び直すチップ）',
    // 2026-08-22 便IV（オーナー原文「テンプレートエリアは折りたたみ状態でボタンはなし。」）:
    // テンプレートの節は、訂正の原文が名指しでしまう側に挙げている
    'ja.mealPlan.templateSave': '「まとめてやテンプレートのような初心者が使わないような機能はしまっておく」（便IVのオーナーの訂正）',
    'ja.mealPlan.templateApplyWeek': '同上',
    'ja.mealPlan.copyPickTitle': '同上（過去の献立をコピー。テンプレートと同じ節にある）',
    // 「まとめて献立を入力」の実行ボタンは折りたたみの外＝節の見出しの横にある
    // （2026-08-20 便II・③ → 2026-08-22 便IVで見出しの横へ。オーナー原文
    //  「「まとめて献立てを入力」ボタンは「献立を提案」の横にして、１列におさめて。」）。
    // 入れかたと条件は、その1つのボタンの効き方を細かく決めるもの＝使いこなすために開く側
    'ja.mealPlan.fillModeTitle': '「まとめて献立を入力」の効き方を決める欄。実行ボタンは見出しの横に常に出ている',
    'ja.mealPlan.fillModeFillEmpty': '同上',
    'ja.mealPlan.fillModeReplaceAll': '同上',
    // 献立表・期間の集計・概算食費は、節の見出しがそのまま機能の名前になっている
    // （見出しを読めば何ができるか分かり、開くのは実行の直前の一手）
    'ja.mealPlan.planSheetPrint': '節の見出し「献立表（印刷・画像で保存）」が機能の名前そのもの',
    'ja.mealPlan.planSheetImage': '同上',
    'ja.mealPlan.planSheetIncludeEmptyDays': '同上（載せる中身の細かい指定）',
    'ja.mealPlan.rangeDateStartLabel': '期間の集計の日付欄。節の見出しが機能の名前そのもの',
    'ja.mealPlan.rangeDateEndLabel': '同上',
    'ja.mealPlan.weekCostNoteLink': '概算食費の中の案内。食材と価格の画面は設定からも開ける',
    'ja.mealPlan.budgetSetLink': '概算食費の中の案内。週の食費予算は設定の同じ欄からも入れられる',
    'ja.mealPlan.shopRangeReset': '買い物メモの範囲を狭めた人にだけ出る戻し方。狭める操作と同じ場所にある',
    // --- レシピ一覧の絞り込み ---
    // 「絞り込み」の開閉ボタンは常に見えていて、中身は絞り込みそのもの
    'ja.search.sortAsc': 'レシピ一覧の絞り込みパネル。開閉ボタンは常に見えており、中身が機能そのもの',
    'ja.search.sortDesc': '同上',
    'ja.search.sortNutritionGate': '同上（Pro案内。設定のProからも同じ場所へ行ける）',
    'ja.search.sortNutritionGateHint': '同上',
    'ja.search.favoriteOnly': '同上',
    'ja.search.excludeNg': '同上',
    'ja.search.myRecipesOnly': '同上',
    'ja.search.dishTypeAll': '同上',
    'ja.search.quickOnly': '同上',
    'ja.search.pantryFilter': '同上',
    'ja.search.pantryToIngredients': '同上',
    'ja.search.tagMatchAllSwitch': '同上',
    'ja.search.savedSearchRemoveAria': '同上（保存した条件の削除）',
    'ja.search.legacyTagRemove': '同上（古いタグの削除）',
    'ja.search.legacyTagRemoveAria': '同上',
    // --- レシピの登録 ---
    'ja.paste.placeholder': 'レシピ登録の「文章から取り込む」欄。開閉ボタンが取り込みの名前そのもの',
    'ja.paste.apply': '同上',
    'ja.urlImport.placeholder': 'レシピ登録の「URLから取り込む」欄。開閉ボタンが取り込みの名前そのもの',
    'ja.urlImport.apply': '同上',
    'ja.urlImport.loading': '同上',
    'ja.urlImport.fetchPhoto': '同上（取り込むときの細かい指定）',
    'ja.urlImport.fetchPhotoNote': '同上',
    'ja.form.iconAuto': 'レシピ登録の絵の選び直し。既定は料理名から自動で選ばれており、開かなくても絵は付く',
    'ja.chip.remove': 'チップ入力欄の✕。欄そのものが見えていれば✕も見えている（欄の部品）',
    // --- 並行調理ナビ ---
    'ja.cookNavi.ingredientsServings': '材料の一覧の見出しに出る人数。押すのは開閉だけで、操作ではない',
    /**
     * 「この手順を先にする」（他の品の次の手順を開いた中）。**畳んだままでは触れないと認める。**
     *
     * 直さない理由（2026-08-11 便FO・オーナー承認済みの設計をそのまま守る）:
     *   下部の行は「タップ＝全文を見る」だけの意味にしてある。
     *   components/CookSessionOverlay.tsx の peekRecipeId の説明にあるとおり、
     *   「同じ行に『見る』と『移る』の2つの意味を持たせると、台所で押し間違えたときに
     *     どちらが起きたのか分からなくなる」。
     *   行の横に「先にする」を常設すると、まさにその2つの意味が1行に並ぶ。
     *   押し間違えると調理中の段取りが別の品へ移って番号が振り直されるので、
     *   濡れた手で触る画面では取り返しがつきにくい。
     *   代わりに、**開けば先にできること**を、常に見えている案内の行に書いた
     *   （ja.cookNavi.sessionOthersHint）＝入口の存在は畳んだままでも分かる。
     */
    'ja.cookNavi.sessionPeekMove': '調理中の押し間違いを避けるため、開いた中に残す（案内は常設の行に出す）',
    // --- 栄養 ---
    'ja.nutritionBalance.notesToggle': '注記と出典の開閉。読むものであって操作ではない',
    'ja.nutrition.gateLink': 'Pro版の案内リンク。設定の「Pro」から同じ場所へ行ける',
  }

  const tsxFiles = []
  const walkTsx = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walkTsx(p)
      else if (entry.name.endsWith('.tsx')) tsxFiles.push(p)
    }
  }
  walkTsx(path.join(appRoot, 'src'))

  /** 文字列・コメントの終わりの次を返す（違えば -1） */
  const skipLiteral = (src, i) => {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i)
      return e === -1 ? src.length : e
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      return e === -1 ? src.length : e + 2
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === c) return j + 1
        j++
      }
      return src.length
    }
    return -1
  }
  /** 宣言の先頭から、その本体の { } の範囲を返す */
  const bodySpan = (src, from) => {
    let i = from
    let paren = 0
    let started = false
    let depth = 0
    while (i < src.length) {
      const sk = skipLiteral(src, i)
      if (sk !== -1) { i = sk; continue }
      const c = src[i]
      if (!started) {
        if (c === '(') paren++
        else if (c === ')') paren--
        else if (c === '{' && paren === 0) { started = true; depth = 1 }
        else if (c === ';' && paren === 0) return null
      } else if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) return [from, i + 1] }
      i++
    }
    return null
  }
  /** 開始タグの `>` の位置（属性の中の {} と '' は飛ばす） */
  const endOfOpenTag = (src, from) => {
    let i = from
    let depth = 0
    let quote = null
    while (i < src.length) {
      const c = src[i]
      if (quote) {
        if (c === quote) quote = null
        else if (c === '\\') i++
      } else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) return i
      i++
    }
    return -1
  }
  /** 同じ名前の入れ子を数えて、対応する終了タグの位置を返す */
  const matchingClose = (src, tag, afterOpen) => {
    const openRe = new RegExp(`<${tag}\\b`, 'g')
    const closeRe = new RegExp(`</${tag}\\s*>`, 'g')
    let depth = 1
    let i = afterOpen
    while (i < src.length) {
      openRe.lastIndex = i
      closeRe.lastIndex = i
      const o = openRe.exec(src)
      const c = closeRe.exec(src)
      if (!c) return -1
      if (o && o.index < c.index) {
        const e = endOfOpenTag(src, o.index)
        if (e !== -1 && src[e - 1] === '/') { i = e + 1; continue }
        depth++
        i = o.index + 1
        continue
      }
      depth--
      if (depth === 0) return c.index
      i = c.index + 1
    }
    return -1
  }
  /** その要素の中身の範囲（自己終了は開始タグだけ） */
  const elementSpan = (src, start, tag) => {
    const e = endOfOpenTag(src, start)
    if (e === -1) return [start, src.length]
    if (src[e - 1] === '/') return [start, e + 1]
    const close = matchingClose(src, tag, e + 1)
    return [start, close === -1 ? e + 1 : close]
  }

  const JA_KEY = /\bja\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/g
  const INTERACTIVE = /<(button|Link|select|input|textarea|label)\b/g
  const JSX_COMPONENT = /<([A-Z][A-Za-z0-9_]*)\b/g
  const normalizeKey = (key) => key.replace(/\.(replace|replaceAll|toLocaleString)$/, '')

  const parsed = tsxFiles.map((file) => {
    const src = readFileSync(file, 'utf-8')
    const collapse = []
    const re = /<Collapse\b/g
    let m
    while ((m = re.exec(src))) {
      const e = endOfOpenTag(src, m.index)
      if (e === -1) continue
      if (src[e - 1] === '/') { re.lastIndex = e + 1; continue }
      const close = matchingClose(src, 'Collapse', e + 1)
      if (close === -1) continue
      collapse.push([e + 1, close])
      re.lastIndex = e + 1
    }
    const comps = new Map()
    for (const decl of [
      /^(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/gm,
      /^(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/gm,
    ]) {
      let d
      while ((d = decl.exec(src))) {
        if (comps.has(d[1])) continue
        const span = bodySpan(src, d.index)
        if (span) comps.set(d[1], span)
      }
    }
    return { file, src, collapse, comps }
  })

  // 同じ名前の部品が2つ以上あるファイルは、どちらを指しているか決められないので見ない
  const defs = new Map()
  for (const p of parsed) {
    for (const [name, span] of p.comps) {
      if (defs.has(name)) defs.set(name, null)
      else defs.set(name, { file: p.file, span })
    }
  }

  // 「畳むと消える範囲」を、部品をたどって広げる（動かなくなるまで繰り返す）
  const hidden = new Map(parsed.map((p) => [p.file, p.collapse.map((r) => r.slice())]))
  const inHidden = (file, i) => (hidden.get(file) ?? []).some(([a, b]) => i >= a && i < b)
  for (let round = 0; round < 8; round++) {
    let changed = false
    for (const [name, def] of defs) {
      if (!def) continue
      if ((hidden.get(def.file) ?? []).some(([a, b]) => def.span[0] >= a && def.span[1] <= b)) continue
      let uses = 0
      let hiddenUses = 0
      for (const p of parsed) {
        JSX_COMPONENT.lastIndex = 0
        let u
        while ((u = JSX_COMPONENT.exec(p.src))) {
          if (u[1] !== name) continue
          uses++
          if (inHidden(p.file, u.index)) hiddenUses++
        }
      }
      if (uses > 0 && uses === hiddenUses) {
        hidden.get(def.file).push([def.span[0], def.span[1]])
        changed = true
      }
    }
    if (!changed) break
  }

  const reachable = new Set()
  const hiddenOps = new Map()
  for (const p of parsed) {
    // 読み上げ名と見出しは「入口」と数えない（押して開く窓が同じ文言を使うため）
    const notEntry = []
    for (const re of [/aria-label=\{[^}]*\}/g, /<h[3-6][^>]*>[\s\S]*?<\/h[3-6]>/g]) {
      let s
      while ((s = re.exec(p.src))) notEntry.push([s.index, s.index + s[0].length])
    }
    JA_KEY.lastIndex = 0
    let k
    while ((k = JA_KEY.exec(p.src))) {
      if (inHidden(p.file, k.index)) continue
      if (notEntry.some(([a, b]) => k.index >= a && k.index < b)) continue
      reachable.add(normalizeKey(k[0]))
    }
    for (const [a, b] of hidden.get(p.file)) {
      const body = p.src.slice(a, b)
      INTERACTIVE.lastIndex = 0
      let im
      while ((im = INTERACTIVE.exec(body))) {
        const [s, t] = elementSpan(body, im.index, im[1])
        const chunk = body.slice(s, t)
        JA_KEY.lastIndex = 0
        let j
        while ((j = JA_KEY.exec(chunk))) {
          const key = normalizeKey(j[0])
          const line = p.src.slice(0, a + s).split('\n').length
          if (!hiddenOps.has(key)) hiddenOps.set(key, new Set())
          hiddenOps.get(key).add(`${path.relative(appRoot, p.file)}:${line}`)
        }
        INTERACTIVE.lastIndex = im.index + 1
      }
    }
  }

  const unreachable = [...hiddenOps.keys()]
    .filter((key) => !reachable.has(key) && !(key in OPEN_TO_REFINE))
    .sort()
  eq(
    'COLLAPSE-1 折りたたみを開かないと触れない操作が無い（開いてよいものは理由つきで一覧に書く）',
    unreachable.map((key) => `${key} (${[...hiddenOps.get(key)].join(' , ')})`),
    [],
  )
  // 一覧のほうが古くなっていないか（直したのに理由が残っていると、次の人が読み違える）
  const stale = Object.keys(OPEN_TO_REFINE).filter((key) => !hiddenOps.has(key)).sort()
  eq('COLLAPSE-1 「開いてから」の一覧に、もう当てはまらないものが残っていない', stale, [])
  // 見張りそのものが動いているか（掴み損ねて素通りの合格に倒れない）
  eq('COLLAPSE-1 折りたたみの中の操作を掴めている', hiddenOps.size > 20, true)

  /**
   * IV-4: オーナーが「しまっておく」と名指しした4つが、本当に折りたたみの中にあること
   * （2026-08-22 便IV）。
   *
   * 上の unreachable / stale は「外に出ているのに一覧に書いてある」を拾うが、
   * **一覧ごと消して外へ出し直す**と、どちらも赤くならずに便INの形へ戻ってしまう。
   * ここは名指しの4つを直接見る＝戻したらその場で分かる。
   */
  const IV_MUST_BE_INSIDE = [
    'ja.mealPlan.clearWeekSlotButton',
    'ja.mealPlan.templateSave',
    'ja.mealPlan.templateApplyWeek',
    'ja.mealPlan.copyPickTitle',
  ]
  eq(
    'IV-4 「空にする」「テンプレート保存」「テンプレート適用」「過去の献立をコピー」は折りたたみの中にある',
    IV_MUST_BE_INSIDE.filter(
      (key) =>
        ![...(hiddenOps.get(key) ?? [])].some((where) => where.startsWith('src/pages/MealPlanPage.tsx')),
    ),
    [],
  )
  /**
   * 逆に「まとめて献立を入力」は、畳んだままでも押せる場所に出したままであること
   * （オーナーの訂正は「毎日使うものまでしまえ」ではない）。
   * MealPlanPage.tsx の折りたたみの中で使われていないことで見る。
   */
  eq(
    'IV-4 「まとめて献立を入力」は折りたたみの中に入れていない（毎日押すものはしまわない）',
    [...(hiddenOps.get('ja.mealPlan.fillWeek') ?? [])].filter((where) =>
      where.startsWith('src/pages/MealPlanPage.tsx'),
    ),
    [],
  )
}

// ==========================================================================================
// IQ-1〜IQ-8: 「行を左へ払うと『外す』が出る」の見張り（2026-08-21 便IQ）
//
// オーナー原文: 「横にスワイプして消せるのが楽なんですけどね。」
// オーナーが実機で確かめた事実: 献立の行を**左端から右へ**払うと「ChromeでもSafariでも戻ります」
// ＝端からの戻るジェスチャーはWebページ側では検知も無効化もできない。
// そこで**向きと起点を変えて**ぶつからない形にした（行の途中から左へ払う）。
//
// ここで見張るのは「作りで守ること」＝**壊れたら黙って消える性質**だけを、
// 実画面を立てずに読み取れる形で置いてある（動きそのものは e2e の DAYSWIPE-01 が測る）。
//   IQ-1 … ブラウザの「戻る」に譲る左端の幅が残っていること（30px）
//   IQ-2 … 起点が左端のときは何も掴まないこと（判定そのものが消えていない）
//   IQ-3 … 縦の指をブラウザに残すこと（touch-action に pan-y が敷いてある）
//   IQ-4 … **押して初めて外れる**こと（外す処理を呼ぶのはボタンの押下だけ。指を離す処理からは呼ばない）
//   IQ-5 … 今日の献立の行がこの器を通っていること
//   IQ-6 … **付けすぎていない**こと（この器を使うのは今日の献立の行だけ。
//           買い物メモの品目・食材の在庫には付けない＝同じ払いが別の場所で違う結果になるのを防ぐ）
//   IQ-7 … 払う以外の道が残っていること（整理モードの×＝キーボード・読み上げの順路）
//   IQ-8 … ボタンの文言が規約H-2に沿っていること（意味を担う語は漢字・短い）
//
// 読み取りに失敗したら必ず落ちる（ファイルが無ければ IQ-0 が赤になり、残りも空振りで赤になる）。
// ==========================================================================================
{
  const iqScriptDir = path.dirname(fileURLToPath(import.meta.url))
  const iqRoot = process.env.IQ_SRC_ROOT ?? path.join(iqScriptDir, '..')
  const iqRowPath = path.join(iqRoot, 'src/components/SwipeRevealRow.tsx')
  const iqPagePath = path.join(iqRoot, 'src/pages/MealPlanPage.tsx')
  eq('IQ-0 払いの器のファイルが読める（無ければ以下は全部空振りになる）', existsSync(iqRowPath), true)
  const iqRow = existsSync(iqRowPath) ? readFileSync(iqRowPath, 'utf-8') : ''
  const iqPage = existsSync(iqPagePath) ? readFileSync(iqPagePath, 'utf-8') : ''

  // ---- IQ-1: ブラウザの「戻る」に譲る左端の幅 ----------------------------------------------
  // iOSの端からの戻るジェスチャーは左0〜30pxから始まり、献立の行は左端x=33pxから始まる。
  // ここを0にすると、行の左端で始めた払いが「戻る」と取り合いになる
  eq(
    'IQ-1 ブラウザの「戻る」に譲る左端の幅が30pxで残っている',
    /export const SWIPE_BACK_EDGE_PX = 30\b/.test(iqRow),
    true,
  )
  // ---- IQ-2: 起点が左端なら何も掴まない ----------------------------------------------------
  eq(
    'IQ-2 起点が左端のときは払いを掴まない（判定が消えていない）',
    /clientX <= SWIPE_BACK_EDGE_PX/.test(iqRow),
    true,
  )
  // ---- IQ-3: 縦の指はブラウザに残す --------------------------------------------------------
  // touch-action から pan-y が落ちると、一覧の縦スクロールがこの行の上だけ効かなくなる
  eq(
    'IQ-3 縦のスクロールはブラウザが受け持つ（touch-action に pan-y が敷いてある）',
    /touchAction: 'pan-y[^']*'/.test(iqRow),
    true,
  )
  // ---- IQ-4: 押して初めて外れる ------------------------------------------------------------
  // 「払い切ったら外れる」に変わっていないか。外す処理の呼び出しは1か所だけで、
  // それはボタンの中にある（指を離す処理＝finish からは呼ばない）
  const iqActionCalls = (iqRow.match(/onAction\(\)/g) ?? []).length
  const iqButtonStart = iqRow.indexOf('<button')
  const iqButtonEnd = iqRow.indexOf('</button>')
  const iqButton = iqButtonStart >= 0 && iqButtonEnd > iqButtonStart ? iqRow.slice(iqButtonStart, iqButtonEnd) : ''
  eq(
    'IQ-4 外すのはボタンを押したときだけ（払い切っただけでは外れない）',
    iqActionCalls === 1 && iqButton.includes('onAction()'),
    true,
  )
  // ---- IQ-5: 今日の献立の行がこの器を通っている --------------------------------------------
  eq('IQ-5 今日の献立の行が払いの器を通っている', /<SwipeRevealRow\b/.test(iqPage), true)
  // ---- IQ-6: 付けすぎていない --------------------------------------------------------------
  // 同じ払いが別の場所で違う結果になるのを防ぐため、いまは今日の献立の行だけに付ける。
  // 増やすときは、ここの一覧を意図して書き換える（黙って増えない）
  /** src配下の .tsx を集める（この見張り専用。他の見張りの走査に依らない） */
  const iqListTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...iqListTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const iqAllTsx = iqListTsx(path.join(iqRoot, 'src'))
  eq('IQ-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', iqAllTsx.length > 0, true)
  const iqUsers = iqAllTsx
    .filter((full) => /<SwipeRevealRow\b/.test(readFileSync(full, 'utf-8')))
    .map((full) => path.relative(iqRoot, full).split(path.sep).join('/'))
  eq('IQ-6 払いで外せるのは今日の献立の行だけ（買い物メモ・食材の在庫には付けない）', iqUsers, [
    'src/pages/MealPlanPage.tsx',
  ])
  // ---- IQ-7: 払う以外の道が残っている ------------------------------------------------------
  // 整理モードの×＝キーボードでも読み上げでも届く順路。払う操作しか無い形にしない
  eq(
    'IQ-7 払う以外の道（整理モードの×）が残っている',
    iqPage.includes('ja.mealPlan.todayOrganizeToggle') &&
      /aria-label=\{removeLabel \?\? ja\.mealPlan\.todayRemove\}/.test(iqPage),
    true,
  )
  // ---- IQ-8: ボタンの文言（規約H-2） -------------------------------------------------------
  // 88pxの幅に収める短さで、意味を担う語は漢字（「はずす」と開かない）
  eq('IQ-8 払って出るボタンの文言', ja.mealPlan.todaySwipeRemove, '外す')
}

// ---------- 便IR: 長文の見張り（規約Hの「長文はやめる」を数字にする） ----------
// オーナー原文（2026-08-21 書き溜め⑤）:
//   「アプリもHPも共通して、長文はやめてください。ユーザーは意外なほど読みません。
//     長文というだけで読み飛ばします。説明ページなど、どうしても長くなる場合は
//     見た目を工夫してください。」
//
// 規約Hには前から「長文は15行以上黒文字が続かないよう分割・折りたたみ・表で構成する」と
// 書いてあった。書いてあるのに守れていなかったのは、**測っていなかったから**。
//
// 決めた数字（便IRが実測して決めた。決め方は下記）:
//   ・利用者が読むページ（public/about/*.html・コラムを含む）
//       見出し・図・箇条書き・囲み・表で区切られずに**続けて読ませる本文は160字まで**。
//       箇条書きの1行・表のます目は、それ1つで1かたまりとして数える。
//   ・アプリの中のお知らせ（public/news.json）は**題20字・本文80字**まで。
//
// なぜ160字か:
//   ・スマホ幅(390px)・本文14〜15pxで1行およそ20字。160字＝およそ8行。
//   ・規約Hの「15行」は同じ換算で約300字にあたり、今回オーナーが「いきなり長文を
//     突きつけられる」と言った install.html の冒頭（4段落・174字）を捕まえられない。
//     **オーナーが実際に長いと言ったものが赤になる**ことを条件にすると上限は174字未満。
//   ・実測の分布（この便で全ページを数えた。全2,770かたまり）:
//       200字超=36件 / 180字超=45件 / 160字超=58件 / 140字超=74件 / 120字超=105件
//     160字は「オーナーが長いと言った174字が赤になる、いちばんゆるい刻み」。
//     120字まで締めると105件が一度に赤になり、直しきれずに一覧が形骸化する。
//
// 「超えたら赤」だけでは、いま超えている58件で最初から赤くなって回らない。そこで
// **いま超えているものの一覧**（scripts/data/long-text-known.json）を持ち、
//   ・一覧に無い長文が現れたら赤（＝新しく増やせない）
//   ・一覧にあるのに、もう長くない／その文が見つからないときも赤（＝直したら一覧から消す）
// の両向きで見張る。一覧は減らしていくためのもので、増やすときは理由を報告に書くこと。
{
  const irRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  /** 続けて読ませてよい本文の上限（字） */
  const LONG_TEXT_LIMIT = 160
  /** お知らせの題・本文の上限（字） */
  const NEWS_TITLE_LIMIT = 20
  const NEWS_BODY_LIMIT = 80

  // 落とした部分は空白に置き換える（改行だけ残す）＝赤に出る行番号を原文と合わせるため
  const irBlank = (s) => s.replace(/[^\n]/g, ' ')
  const irPlain = (s) =>
    s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, 'x').replace(/[\s​]+/g, '')
  // かたまりの切れ目になる印（見出し・図・箇条書き・囲み・表）
  const IR_BREAK =
    /<\/?(?:h[1-6]|ul|ol|figure|table|div|details|nav|footer|header|section|dl|blockquote|main|aside|li|dd|dt|td|th|figcaption|summary)\b[^>]*>|<hr\b[^>]*>/g
  // それ1つで1かたまりとして数える器（箇条書きの1行・表のます目・図の題）
  const IR_UNIT = /<(li|td|dd|figcaption|summary)\b[^>]*>([\s\S]*?)<\/\1>/g
  // 器の中に入れ子になっている塊は、その中でまた別に数えるのでここでは落とす
  const IR_NESTED = /<(p|ul|ol|figure|div|table|dl)\b[\s\S]*?<\/\1>/g

  /** 1ページを「続けて読ませる本文のかたまり」に切り分ける */
  const irChunks = (raw) => {
    const cleaned = raw
      .replace(/<script[\s\S]*?<\/script>/gi, irBlank)
      .replace(/<style[\s\S]*?<\/style>/gi, irBlank)
      .replace(/<!--[\s\S]*?-->/g, irBlank)
    const tokens = []
    for (const m of cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g))
      tokens.push({ kind: 'p', at: m.index, text: m[1] })
    for (const m of cleaned.matchAll(IR_UNIT))
      tokens.push({ kind: 'unit', at: m.index, text: m[2].replace(IR_NESTED, ' ') })
    for (const m of cleaned.matchAll(IR_BREAK)) tokens.push({ kind: 'brk', at: m.index })
    tokens.sort((a, b) => a.at - b.at)
    const out = []
    let run = null
    const flush = () => {
      if (run) out.push(run)
      run = null
    }
    for (const t of tokens) {
      if (t.kind === 'brk') {
        flush()
        continue
      }
      const txt = irPlain(t.text)
      if (txt === '') continue
      const line = cleaned.slice(0, t.at).split('\n').length
      if (t.kind === 'unit') {
        flush()
        out.push({ line, len: txt.length, head: txt.slice(0, 16) })
        continue
      }
      if (!run) run = { line, len: 0, head: txt.slice(0, 16) }
      run.len += txt.length
    }
    flush()
    return out
  }

  // 見る先は利用者が読むページ全部（コラムも含む。foods.html は生成物だが出来上がりを測る）
  const irAboutDir = path.join(irRoot, 'public/about')
  const irFiles = []
  for (const e of readdirSync(irAboutDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    if (e.isDirectory()) {
      if (e.name === 'img') continue
      for (const f of readdirSync(path.join(irAboutDir, e.name)).filter((f) => f.endsWith('.html')).sort())
        irFiles.push(`${e.name}/${f}`)
    } else if (e.name.endsWith('.html')) irFiles.push(e.name)
  }
  eq('HR-5 利用者が読むページを走査できている（0件なら見張りが壊れている）', irFiles.length > 0, true)

  const known = JSON.parse(readFileSync(path.join(irRoot, 'scripts/data/long-text-known.json'), 'utf-8'))
  // 「_」で始まる項目は読み手向けの説明。一覧そのものではない
  const knownList = Object.fromEntries(Object.entries(known).filter(([k]) => !k.startsWith('_')))
  const irTooLong = []
  const irStale = []
  let irMeasured = 0
  for (const f of irFiles) {
    const rel = `public/about/${f}`
    const chunks = irChunks(readFileSync(path.join(irAboutDir, f), 'utf-8'))
    irMeasured += chunks.length
    const allowed = [...(knownList[rel] ?? [])]
    for (const c of chunks) {
      if (c.len <= LONG_TEXT_LIMIT) continue
      const at = allowed.indexOf(c.head)
      if (at >= 0) {
        allowed.splice(at, 1)
        continue
      }
      irTooLong.push(`${rel}:${c.line} ${c.len}字（上限${LONG_TEXT_LIMIT}字）「${c.head}…」`)
    }
    for (const head of allowed)
      irStale.push(`${rel} 「${head}…」は${LONG_TEXT_LIMIT}字を超えていない（直ったので一覧から消してください）`)
  }
  eq('HR-5 本文のかたまりを測れている（0件なら見張りが壊れている）', irMeasured > 100, true)
  eq(`HR-5 ${LONG_TEXT_LIMIT}字を超える本文のかたまりが、一覧に無いところに増えていない`, irTooLong, [])
  eq('HR-5 一覧に、もう長くないものが残っていない', irStale, [])

  // ---- お知らせ（アプリの中で読む短い文章。ページより短く保つ） ----
  {
    const items = JSON.parse(readFileSync(path.join(irRoot, 'public/news.json'), 'utf-8'))
    eq('HR-5 お知らせを読めている（0件なら見張りが壊れている）', items.length > 0, true)
    eq(
      `HR-5 お知らせの題が${NEWS_TITLE_LIMIT}字以内`,
      items.filter((n) => n.title.length > NEWS_TITLE_LIMIT).map((n) => `${n.id} ${n.title.length}字「${n.title}」`),
      [],
    )
    eq(
      `HR-5 お知らせの本文が${NEWS_BODY_LIMIT}字以内`,
      items.filter((n) => n.body.length > NEWS_BODY_LIMIT).map((n) => `${n.id} ${n.body.length}字「${n.body.slice(0, 20)}…」`),
      [],
    )
  }
}

// ==========================================================================================
// 便IU（2026-08-21・オーナーの書き溜め7件）
//
// ここは「オーナーが言ったことが、直したあとも守られているか」を静的に見張る。
// 実際に動かして測るのは e2e（IUCARD-01・IUORG-02・IUSELECT-03・IUSCROLL-04・
// IUUNDO-06・IUTODAY-07）が受け持つ。
// 文言は必ず ja.ts から読む（この7日で6回、書き写しが赤を出しているため）。
// ==========================================================================================
{
  const iuRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const iuRead = (rel) => readFileSync(path.join(iuRoot, rel), 'utf-8')

  // ---- IU-1: ①今日の献立のカードの中身を減らす -----------------------------------------
  // オーナー原文「・今日の献立のレシピカードは、基本レシピとか材料表記はなし。」
  // 「今日なに作る？」の候補で先にやった引き算（便HY）を、今日の献立の行にも同じ手で適用する。
  // 項目名は CARD_PART_KEYS の並びから取る＝画面の字を書き写していない
  {
    const iuToday = cardPartsFor('todayPlan')
    const iuFull = cardPartsFor('recipeList')
    eq(
      'IU-1 今日の献立の1品は、レシピを探す一覧より載せる情報が少ない（2026-08-21 オーナー指示の引き算）',
      iuToday.size < iuFull.size && [...iuToday].every((key) => iuFull.has(key)),
      true,
    )
    eq('IU-1 今日の献立の1品に「基本レシピ」の印を出さない', iuToday.has('starter'), false)
    eq('IU-1 今日の献立の1品に主要食材のチップを出さない', iuToday.has('ingredients'), false)
    // 決め手（何分かかるか）まで消していないこと。引き算しすぎの見張り
    eq('IU-1 今日の献立の1品にも調理時間は残っている', iuToday.has('time'), true)
    // 「今日これを作る1品」を出す場所は日タブと「今日なに作る？」の2つ。
    // 同じ役目なので載せる情報も同じにする＝片方だけ増減させない
    eq(
      'IU-1 「今日これを作る1品」の2か所（今日の献立・今日なに作る？の候補）は同じだけ載せる',
      [...iuToday].sort().join(','),
      [...cardPartsFor('todaySuggest')].sort().join(','),
    )
  }

  // ---- IU-2: ⑤「別の週から入れる」の名前 -----------------------------------------------
  // オーナー原文「・「別の週から入れる」は名前わかりにくい。「過去の献立をコピーして入力」とか？
  // 他アプリでどうしているか参考にして。」
  // 献立アプリ meek は「献立のコピー・入れ替え」＝**「コピー」が日本の献立アプリの通り相場**。
  // 便IOがUIから「コピー」の語を消したのは行き過ぎだったので戻す。
  {
    for (const [name, text] of [
      ['画面の名前', ja.mealPlan.copyPickTitle],
      ['実行のボタン', ja.mealPlan.copyPickRun],
    ]) {
      eq(
        `IU-2 ${name}に「コピー」が入っている（2026-08-21 オーナー指示）`,
        typeof text === 'string' && text.includes('コピー'),
        true,
      )
    }
    // 説明は押すボタンの名前を主語にする（規約H: 指示語で場所を示さない）。
    // 名前は ja から組み立てる＝ボタン名を変えた瞬間にここが赤くなる（書き写しではない）
    for (const [name, text] of [
      ['空いた枠だけのときの説明', ja.mealPlan.copyWeekFillEmptyHint],
      ['総入れ替えのときの説明', ja.mealPlan.copyWeekReplaceAllHint],
    ]) {
      eq(
        `IU-2 ${name}が、押すボタンの名前をそのまま引いている`,
        typeof text === 'string' && text.includes(`「${ja.mealPlan.copyPickRun}」`),
        true,
      )
    }
    // 使い方ページも一緒に直す（画面の名前は ja から読む＝ページ側だけ古いまま残せない）
    const iuManual = iuRead('public/about/manual.html')
    for (const [name, text] of [
      ['画面の名前', ja.mealPlan.copyPickTitle],
      ['実行のボタン', ja.mealPlan.copyPickRun],
      ['節の名前', ja.mealPlan.weekGroupTemplateTitle],
    ]) {
      eq(`IU-2 使い方ページに${name}が今の言い方で載っている`, iuManual.includes(text), true)
    }
    eq(
      'IU-2 使い方ページに古い名前「別の週から入れる」が残っていない',
      iuManual.includes('別の週から入れる'),
      false,
    )
  }

  // ---- IU-3: ⑥「まとめて献立を入力」にも「元に戻す」 -------------------------------------
  // オーナー原文「・「まとめて献立を入力」押したら、元に戻すトースト？も出して」
  // ✕・サイコロ・削除にはすでに「元に戻す」がある（作法の不揃いを埋める）。
  // **どこまで戻すか**＝押す直前の姿にまるごと（入れた品を外し、総入れ替えで消した品を戻す）。
  {
    eq(
      'IU-3 「まとめて献立を入力」を戻したときの知らせがある',
      typeof ja.mealPlan.fillWeekUndoneToast === 'string' &&
        ja.mealPlan.fillWeekUndoneToast.length > 0,
      true,
    )
    eq(
      'IU-3 戻したときの知らせが、外した品数を言う（黙って戻さない）',
      typeof ja.mealPlan.fillWeekUndoneToast === 'string' &&
        ja.mealPlan.fillWeekUndoneToast.includes('{a}'),
      true,
    )
    // 総入れ替えは「入れた品を外す」と「消した品を戻す」の両方が起きる＝両方を件数で言う（規約F）
    eq(
      'IU-3 総入れ替えを戻したときの知らせが、外した品数と戻した品数を両方言う（規約F）',
      typeof ja.mealPlan.fillModeReplaceAllUndoneToast === 'string' &&
        ja.mealPlan.fillModeReplaceAllUndoneToast.includes('{a}') &&
        ja.mealPlan.fillModeReplaceAllUndoneToast.includes('{n}'),
      true,
    )
  }

  // ---- IU-4: ③プルダウンが真っ白に見える ------------------------------------------------
  // オーナー原文「・「献立を提案」、入れ方のプルダウンの色が真っ白にみえるけど気のせい？」
  // 気のせいではない: プルダウンの地色がカード面（--surface）と同じ値で、枠1本しか違わなかった。
  // 実際の見え方は e2e（IUSELECT-03）が5テーマで測る。ここは値そのものを見張る
  {
    const iuCss = iuRead('src/index.css')
    const at = iuCss.indexOf('.select-control {')
    eq('IU-4 プルダウンの決めごとを読めている（0なら見張りが壊れている）', at >= 0, true)
    const iuBlock = at >= 0 ? iuCss.slice(at, iuCss.indexOf('}', at)) : ''
    const iuBg = iuBlock.match(/background-color:\s*([^;]+);/)
    eq('IU-4 プルダウンの地色を読めている', !!iuBg, true)
    eq(
      'IU-4 プルダウンの地色が、カード面（--surface）と同じ値ではない（枠1本しか違わない状態にしない）',
      iuBg ? iuBg[1].trim() === 'var(--surface)' : true,
      false,
    )
    eq(
      'IU-4 プルダウンの色はデザイントークンから作る（直接の色指定を書かない）',
      /#[0-9a-fA-F]{3}|rgb\(|hsl\(/.test(iuBlock),
      false,
    )
  }

  // ---- IU-6: ④開いたときの縦位置を、画面ごとに必ず決めている ----------------------------
  // オーナー原文（不具合）「・「別の週から入れる」押下後ページの真ん中にスクロールしてしまう。」
  //
  // 本当の原因は「先頭へ戻す1行が無かった」こと。1枚のページの中で画面を差し替える作りなので、
  // **画面が変わってもブラウザの縦位置はそのまま残る**（押した場所がページの下のほうなら、
  // 着いた先のページの最大値まで詰められて真ん中で止まる）。
  // 2026-08-17 に献立タブだけを直したので、あとから増えた画面が同じ穴に落ちた。
  // ここでは**戻る付きの画面（BackHeader を出す画面）が、開いたときの縦位置を自分で決めて
  // いるか**だけを見る＝先頭へ戻す（useScrollTopOnOpen / window.scrollTo(0, 0)）か、
  // 覚えていた位置へ戻す（scrollTo({ top: ）か。決めていない画面が1つでもあれば赤。
  // 画面の名前を並べない＝新しい画面が増えても、そのまま当たる
  {
    const iuPagesDir = path.join(iuRoot, 'src/pages')
    const iuPageFiles = readdirSync(iuPagesDir).filter((f) => f.endsWith('.tsx')).sort()
    eq('IU-6 画面ファイルを走査できている（0件なら見張りが壊れている）', iuPageFiles.length > 0, true)
    const iuBackPages = []
    const iuUndecided = []
    for (const f of iuPageFiles) {
      const src = readFileSync(path.join(iuPagesDir, f), 'utf-8')
      if (!src.includes('<BackHeader')) continue
      iuBackPages.push(f)
      const decides =
        src.includes('useScrollTopOnOpen(') ||
        src.includes('window.scrollTo(0, 0)') ||
        src.includes('window.scrollTo({ top: ')
      if (!decides) iuUndecided.push(f)
    }
    eq('IU-6 戻る付きの画面を1つ以上拾えている（0件なら見張りが壊れている）', iuBackPages.length > 0, true)
    eq(
      'IU-6 戻る付きの画面はすべて、開いたときの縦位置を自分で決めている（前の画面の位置を持ち越さない）',
      iuUndecided,
      [],
    )
  }

  // ---- IU-5: ⑦レシピ詳細も「今日の献立に追加済み」に -------------------------------------
  // オーナー原文「・週で献立組む→今日の献立にレシピが表示される→レシピ詳細も
  // 「今日の献立に追加済み」にして。はずすと週の献立ごと編集されるようにしたい。」
  //
  // 判定の穴: レシピ詳細は「今日の献立」の表だけを見ていた。週の予定がその表へ写るのは
  // 献立の「日」を開いたときの取り込み1本だけなので、**週で組んだだけでは追加済みにならない**。
  // 判定は1か所（logic/mealPlan.ts isRecipeInToday）に置き、ここで直に測る
  {
    eq(
      'IU-5 今日の献立の表に入っていれば追加済み',
      isRecipeInToday(7, [7], []),
      true,
    )
    eq(
      'IU-5 週で組んだだけ（今日の予定にあるが、今日の献立の表にはまだ写っていない）でも追加済み',
      isRecipeInToday(7, [], [7]),
      true,
    )
    eq('IU-5 どちらにも無ければ追加済みにしない', isRecipeInToday(7, [1, 2], [3]), false)
    eq('IU-5 両方にあっても追加済み（二重に数えて崩れない）', isRecipeInToday(7, [7], [7]), true)
    // 今日すでに作った品は、日タブでも予定の行が消える（showsCookedPlanRowToday）。
    // そちらに並んでいないものを「追加済み」と言うと、また画面ごとに数え方が食い違う
    eq(
      'IU-5 今日すでに作った品は、予定に残っていても追加済みにしない（日タブと同じ数え方）',
      isRecipeInToday(7, [], [7], true),
      false,
    )
    eq(
      'IU-5 今日作ったあとに自分で入れ直したら、また追加済み',
      isRecipeInToday(7, [7], [7], true),
      true,
    )
    // 一覧のカードの印（ja.card.todayBadge）とレシピ詳細のボタン（ja.detail.todayAdded）は
    // **同じことを言っている**。同じことを言うなら同じ数え方にする＝どちらもこの判定を通す
    // （そろえないと、同じ品が一覧では印なし・詳細では「追加済み」になる）
    eq(
      'IU-5 一覧の印と詳細のボタンは同じ言い方をしている',
      ja.card.todayBadge,
      ja.detail.todayAdded,
    )
    eq(
      'IU-5 同じ言い方をする2か所が、どちらも同じ判定（isRecipeInToday）を通している',
      ['src/pages/RecipesPage.tsx', 'src/pages/RecipeDetailPage.tsx'].filter(
        (rel) => !iuRead(rel).includes('isRecipeInToday('),
      ),
      [],
    )
  }
}

// ==========================================================================================
// IX: 買い物メモに材料でないものが並ぶ(2026-08-22 便IX)
// オーナーが実際のレシピサイト14件から31品を取り込んだテスト用データで発覚した4件。
// 材料の原文はすべて、そのテスト用データ(うちレシピ_テスト用データ_31品.json)と
// 元ページ(cotta)の実測をそのまま使っている。
// ==========================================================================================
{
  // ---------- IX-1 ①水・お湯は買い物メモに出さない ----------
  // クラシル「エビグラタン」実測: ゆでるための「お湯 1000ml」「塩 小さじ2」まで材料に入っており、
  // 買い物メモの下書きに「お湯」が並んでいた。水道から出るものは店で買わないので下書きに出さない。
  // レシピの材料一覧は触らない(「ゆでる湯 1000ml」は作るときに要る情報)。
  {
    const ebi = [
      { name: 'マカロニ', amount: '60', unit: 'g' },
      { name: 'お湯', amount: '1000', unit: 'ml' },
      { name: '塩', amount: '2', unit: '小さじ' },
      { name: 'エビ', amount: '5', unit: '尾' },
      { name: 'ブロッコリー', amount: '1/2', unit: '個' },
    ]
    const before = JSON.stringify(ebi)
    const names = buildShoppingCandidates([{ id: 1, ingredients: ebi }], []).map((c) => c.name)
    eq('IX-1 エビグラタン: 買い物メモの下書きに「お湯」を出さない', names.includes('お湯'), false)
    eq('IX-1 エビグラタン: ゆで塩は残す(切らしていれば買うため)', names.includes('塩'), true)
    eq(
      'IX-1 エビグラタン: 下書きは水以外の5→4行(消えたのはお湯だけ)',
      names,
      ['マカロニ', '塩', 'エビ', 'ブロッコリー'],
    )
    eq('IX-1 レシピの材料一覧そのものは書き換えない', JSON.stringify(ebi), before)
  }
  {
    // 落とす語(買いに行かないもの)。「湯」「ぬるま湯」「熱湯」「氷水」「冷水」も同じ扱い
    const water = [
      { name: '水', amount: '600', unit: 'ml' },
      { name: 'お湯', amount: '200', unit: 'ml' },
      { name: '湯', amount: '400', unit: 'ml' },
      { name: 'ぬるま湯', amount: '100', unit: 'ml' },
      { name: '熱湯', amount: '1', unit: 'L' },
      { name: '氷水', amount: '適量', unit: '' },
      { name: '冷水', amount: '適量', unit: '' },
      { name: '水（分量外）', amount: '大さじ', unit: '1' },
    ]
    eq(
      'IX-1 水・湯の言い方はどれも買い物メモに出さない',
      buildShoppingCandidates([{ id: 1, ingredients: water }], []).map((c) => c.name),
      [],
    )
  }
  {
    // **落とさない語**。店で買うものを巻き込んだら最悪なので、名前の完全一致だけで落とす。
    // 「氷」は買う人がいる(ロックアイス)ので落とさない。調味料も切らしていれば買うので落とさない。
    const keep = [
      { name: '炭酸水', amount: '200', unit: 'ml' },
      { name: 'ミネラルウォーター', amount: '500', unit: 'ml' },
      { name: '水菜', amount: '1', unit: '束' },
      { name: '水溶き片栗粉', amount: '2', unit: '大さじ' },
      { name: 'トマト水煮缶（カット）', amount: '200', unit: 'g' },
      { name: '湯葉', amount: '50', unit: 'g' },
      { name: '氷', amount: '5', unit: '個' },
      { name: 'だし汁', amount: '300', unit: 'ml' },
      { name: '塩', amount: '少々', unit: '' },
      { name: '砂糖', amount: '2', unit: '大さじ' },
    ]
    eq(
      'IX-1 名前に水・湯・氷が入っていても、買うものは落とさない',
      buildShoppingCandidates([{ id: 1, ingredients: keep }], []).map((c) => c.name),
      keep.map((k) => k.name),
    )
  }

  // ---------- IX-2 ②宣伝・見出しを材料として保存しない(cotta実測) ----------
  // cotta「基本のシュークリームのレシピ」を文章から取り込むと、材料21件のうち5件が
  // 材料ではなかった: 「おすすめのアイテム」×3(宣伝の見出し)・「cotta 北海道産薄力粉 シュクレ 2.5kg」
  // (その見出しの下に並ぶ売り物)・「下準備」(節の見出し)。
  // 下の本文は https://www.cotta.jp/special/article/?p=64082 の材料まわりの実測(手順の文だけ短くした)。
  const COTTA_CHOUX = [
    '基本のシュークリームのレシピ(8～10個分)',
    '',
    'シュー生地を作る',
    '',
    '材料',
    '',
    '牛乳…45g',
    '水…45g',
    '無塩バター…40g',
    '塩…2g',
    '砂糖(グラニュー糖)…2g',
    '薄力粉…55g',
    '全卵(M玉)…2～3個',
    '',
    'おすすめのアイテム',
    '',
    'cotta 北海道産薄力粉 シュクレ 2.5kg',
    '',
    '下準備',
    '',
    '薄力粉をふるっておく。',
    '全卵を常温に戻しておく。',
    '',
    '作り方',
    '',
    '鍋に牛乳・水・無塩バター・塩・グラニュー糖を入れ、手早く混ぜる。',
    '',
    'カスタードクリームを作る',
    '',
    '材料',
    '',
    '牛乳…400g',
    '卵黄…80g',
    '砂糖(グラニュー糖)…100g',
    '薄力粉…40g',
    'バニラビーンズ…5cm',
    '無塩バター…20g',
    '',
    '生クリーム(乳脂肪分42％)…160g',
    '',
    'おすすめのアイテム',
    '',
    'メキシコ産バニラビーンズ マヤ・バニラ M(約16cm)',
    '',
    '作り方',
    '',
    'ボウルに卵黄・グラニュー糖・薄力粉を入れ、泡立て器で混ぜる。',
    '',
    '仕上げる',
    '',
    '材料',
    '',
    'トッピング用粉糖…適量',
    '',
    'おすすめのアイテム',
    '',
    'cotta トッピング用粉砂糖　250g',
    '',
    '作り方',
    '',
    'シュー生地にナイフで切り込みを入れる。',
  ].join('\n')
  {
    const parsed = parseRecipeText(COTTA_CHOUX)
    const names = parsed.ingredients.map((i) => i.name)
    eq(
      'IX-2 cotta: 材料は15件(取り込んだ当時は21件。宣伝の見出し3・売り物2・節の見出し1が消える)',
      parsed.ingredients.length,
      15,
    )
    eq(
      'IX-2 cotta: 正しい材料は1件も消えない(生地・クリーム・仕上げの3か所ぶんがそのまま残る)',
      names,
      [
        '牛乳', '水', '無塩バター', '塩', '砂糖(グラニュー糖)', '薄力粉', '全卵(M玉)',
        '牛乳', '卵黄', '砂糖(グラニュー糖)', '薄力粉', 'バニラビーンズ', '無塩バター',
        '生クリーム(乳脂肪分42％)', 'トッピング用粉糖',
      ],
    )
    eq('IX-2 cotta: 宣伝の見出しを材料にしない', names.includes('おすすめのアイテム'), false)
    eq(
      'IX-2 cotta: 見出しの下の売り物を材料にしない(名前に「薄力粉」が入っていても)',
      names.some((n) => n.startsWith('cotta ')),
      false,
    )
    eq('IX-2 cotta: 「下準備」を材料にしない', names.includes('下準備'), false)
    eq(
      'IX-2 cotta: 「下準備」の中身は手順として残る(捨てない)',
      parsed.steps.slice(0, 2),
      ['薄力粉をふるっておく。', '全卵を常温に戻しておく。'],
    )
    eq(
      'IX-2 cotta: 手順に紛れていた売り物も残さない',
      parsed.steps.some((s) => s.includes('マヤ・バニラ')),
      false,
    )
    // 買い物メモまで通したときに、材料でないものが1行も出ないこと(オーナーが見た画面)
    const built = buildShoppingCandidates(
      [{ id: 1, ingredients: parsed.ingredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })) }],
      [],
    )
    eq(
      'IX-2 cotta: 買い物メモの下書きに材料でないものが出ない',
      built.map((c) => c.name),
      ['牛乳', '無塩バター', '塩', '砂糖(グラニュー糖)', '薄力粉', '全卵(M玉)', '卵黄', 'バニラビーンズ', '生クリーム(乳脂肪分42％)', 'トッピング用粉糖'],
    )
  }
  {
    // cotta「基本のマドレーヌ」実測。「使用する道具」の下の「マドレーヌ型」も同じ形
    const mad = parseRecipeText(
      ['基本のマドレーヌ', '', '材料', '', '全卵…1個分', '砂糖…50g', '無塩バター…60g', '', '使用する道具', '', 'マドレーヌ型'].join('\n'),
    )
    eq(
      'IX-2 cotta(マドレーヌ): 「使用する道具」と、その下の道具を材料にしない',
      mad.ingredients.map((i) => i.name),
      ['全卵', '砂糖', '無塩バター'],
    )
  }
  {
    // 巻き込み防止: 見出しの直後が見出し行なら、次の行は落とさない(1行だけ・見出しは食べない)
    const guard = parseRecipeText(
      ['材料', 'にんじん 1本', 'おすすめのアイテム', '材料', 'じゃがいも 2個'].join('\n'),
    )
    eq(
      'IX-2 落とすのは見出しの直後の1行だけ。次が見出しなら材料を巻き込まない',
      guard.ingredients.map((i) => i.name),
      ['にんじん', 'じゃがいも'],
    )
    const guard2 = parseRecipeText(['材料', 'にんじん 1本', 'おすすめのアイテム'].join('\n'))
    eq('IX-2 見出しで文章が終わっても落ちるのは見出しだけ', guard2.ingredients.map((i) => i.name), ['にんじん'])
  }

  // ---------- IX-3 ③同じ材料が2行に分かれていても買い物メモは1行にまとめる ----------
  // cotta実測: 材料が「生地・クリーム・仕上げ」の3か所に分かれているので、牛乳・薄力粉・
  // 砂糖・無塩バターがレシピの中では2行ずつある(作る順に必要なのでレシピ側はそのまま)。
  {
    const cotta = [
      { name: '牛乳', amount: '45', unit: 'g' },
      { name: '無塩バター', amount: '40', unit: 'g' },
      { name: '砂糖(グラニュー糖)', amount: '2', unit: 'g' },
      { name: '薄力粉', amount: '55', unit: 'g' },
      { name: '牛乳', amount: '400', unit: 'g' },
      { name: '砂糖(グラニュー糖)', amount: '100', unit: 'g' },
      { name: '薄力粉', amount: '40', unit: 'g' },
      { name: '無塩バター', amount: '20', unit: 'g' },
    ]
    const built = buildShoppingCandidates([{ id: 1, ingredients: cotta }], [])
    eq('IX-3 2行ずつの材料が買い物メモでは1行ずつになる', built.length, 4)
    eq(
      'IX-3 同じ単位(g)なら足して1行にする',
      built.map((c) => `${c.name} ${c.amount}`),
      ['牛乳 450g', '無塩バター 60g', '砂糖(グラニュー糖) 100g', '薄力粉 95g'],
    )
  }
  {
    // 単位が違うときは足さない(勝手に足すと嘘の数量になる)。キッコーマン「ぶり大根」実測:
    // 砂糖が「小さじ1」と「大さじ3」の2行
    const buri = [
      { name: '砂糖', amount: '1', unit: '小さじ' },
      { name: '砂糖', amount: '3', unit: '大さじ' },
    ]
    const built = buildShoppingCandidates([{ id: 1, ingredients: buri }], [])
    eq('IX-3 単位が違う2行は1行にまとめるが、数量は足さず並べて出す', built.length, 1)
    eq('IX-3 ぶり大根の砂糖は「小さじ1・大さじ3」', built[0].amount, '小さじ1・大さじ3')
  }

  // ---------- IX-4 ④材料が0件のレシピでも壊れない・空行を出さない ----------
  // 手書きの「冷蔵庫のあまりもの炒め」(材料0件・手順3件)
  {
    const built = buildShoppingCandidates([{ id: 1, ingredients: [] }], [])
    eq('IX-4 材料0件のレシピだけを選ぶと下書きは0行(空行を作らない)', built, [])
    const mixed = buildShoppingCandidates(
      [
        { id: 1, ingredients: [] },
        { id: 2, ingredients: [{ name: '豚こま切れ肉', amount: '200', unit: 'g' }] },
      ],
      [],
    )
    eq('IX-4 材料0件のレシピを他の品と一緒に選んでも余計な行が出ない', mixed.length, 1)
    eq('IX-4 名前が空文字の行は作らない', mixed.every((c) => c.name.trim().length > 0), true)
    // 名前だけあって分量が空の材料(白ごはん.com等で実際に入る)でも、名前は必ず残る
    const blankAmount = buildShoppingCandidates(
      [{ id: 1, ingredients: [{ name: 'サラダ油', amount: '', unit: '' }] }],
      [],
    )
    eq('IX-4 分量が空の材料は名前だけの行として出す(行ごと消さない)', blankAmount.length, 1)
    eq('IX-4 分量が空でも名前は出る', blankAmount[0].name, 'サラダ油')
    eq('IX-4 分量が空のときの分量欄は空文字', blankAmount[0].amount, '')
  }
  {
    // 下書きが0行のときの説明。従来はどの理由でも「食材の在庫で『ある』に登録済みのようです」と
    // 出ていたので、材料を1件も登録していないレシピだけを選ぶと**事実と違う説明**になっていた。
    // 文言は必ず ja.ts から読む（書き写すと、直したときに片方だけ古くなる）
    const ixRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    const ixPageSrc = readFileSync(path.join(ixRoot, 'src/pages/ShoppingPage.tsx'), 'utf-8')
    neq(
      'IX-4 材料0件のときの説明は、在庫にあるときの説明と別の文にする',
      ja.shopping.candidateEmptyNoIngredients,
      ja.shopping.candidateEmpty,
    )
    eq(
      'IX-4 材料0件のときの説明は「在庫にある」と言わない',
      ja.shopping.candidateEmptyNoIngredients.includes('在庫'),
      false,
    )
    eq(
      'IX-4 買い物メモの画面が2つの説明を出し分けている',
      ['candidateEmptyNoIngredients', 'candidateEmpty'].filter((k) => !ixPageSrc.includes(`ja.shopping.${k}`)),
      [],
    )
  }
}


// ==========================================================================================
// IV-1〜IV-4: オーナーの書き溜め「週」の作り直し（2026-08-22 便IV）
//
// オーナー原文:
//   「・でふぉるとで設定３種は、折りたたんだ表示にして
//     ・「表示のしかた」の折りたたんだ表示には、空にする項目を入れないで
//     ・「まとめて献立てを入力」ボタンは「献立を提案」の横にして、１列におさめて。
//     ・テンプレートエリアは折りたたみ状態でボタンはなし。
//     ・折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
//       初心者が使わないような機能はしまっておく、という意味合いでした。
//     ・週のレシピカードが小さすぎてレシピ名で表示できる字数が少なぎる。（略）
//       週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ（タップでレシピ詳細画面に
//       つながる）。1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、選んだ
//       レシピの追加や書き換えができるようにする。」
//
// 画面の見え方（料理名で何文字読めるか・畳んだ節に何が出ているか・編集モードの中身）は
// e2e の IVFOLD-01／IVCARD-02／IVEDIT-03／IVLOCK-04 が実測で受け持つ。
// ここでは**日付にも画面にも依らない決めごと**だけを見る。
// ==========================================================================================
{
  const ivLogic = await import('../src/logic/mealPlan.ts')
  // 読み取りに失敗したら必ず落ちる形にする（「関数が無いので測れませんでした」で素通りしない）
  eq(
    'IV-0 週の作り直しで足した3つが読める（無ければ以下は測れていない）',
    [
      typeof ivLogic.WEEK_GROUP_DEFAULT_OPEN,
      typeof ivLogic.planToggleDayEdit,
      typeof ivLogic.planViewRows,
    ],
    ['object', 'function', 'function'],
  )
  const { WEEK_GROUP_DEFAULT_OPEN, planToggleDayEdit, planViewRows } = ivLogic

  // --- IV-1: 設定3種の既定は「畳んである」 ---
  // 便EN→便IF・⑤⑥で「献立を提案」だけ開いていたのを、オーナーの原文どおり3つとも畳む側へ戻す。
  // 節の名前を書き写さず、**持っている鍵の顔ぶれごと**見る＝節が増えたら必ずここに現れる
  eq(
    'IV-1 週の操作3節が既定で全部畳んである',
    Object.entries(WEEK_GROUP_DEFAULT_OPEN)
      .filter(([, open]) => open !== false)
      .map(([key]) => key),
    [],
  )
  eq(
    'IV-1 節はちょうど3つ（表示のしかた・献立を提案・テンプレート）',
    Object.keys(WEEK_GROUP_DEFAULT_OPEN).sort(),
    ['auto', 'display', 'template'],
  )

  // --- IV-2: 編集モードは1日ずつ ---
  // 司令部裁定「編集モードは1日ずつ（他の日は通常表示のまま）」。
  // 押した日を覚えるだけの判定なので、曜日にも月替わりにも依らない
  eq('IV-2 通常表示の日を押すと、その日が編集モードになる', planToggleDayEdit(null, '2026-08-22'), '2026-08-22')
  eq(
    'IV-2 同じ日をもう一度押すと通常表示に戻る',
    planToggleDayEdit('2026-08-22', '2026-08-22'),
    null,
  )
  eq(
    'IV-2 別の日を押すと、そちらへ移る（前の日は通常表示に戻る＝覚えるのは1日だけ）',
    planToggleDayEdit('2026-08-22', '2026-08-23'),
    '2026-08-23',
  )
  eq(
    'IV-2 月をまたいでも同じ（日付を文字として覚えるだけ）',
    planToggleDayEdit('2026-08-31', '2026-09-01'),
    '2026-09-01',
  )

  // --- IV-3: 通常表示は「入っている品だけ」を役割の順に並べる ---
  // オーナー原文「通常表示はレシピカード（レシピ名と画像のみ）のみ」＝空き枠は出さない。
  // 並びを役割で決めるのは、通常表示と編集モードで品の順が入れ替わらないようにするため
  const ivEntries = [
    { id: 1, recipeId: 11, role: 'soup' },
    { id: 2, recipeId: 12, role: 'main' },
    { id: 3, recipeId: 13 }, // role 未指定＝主菜あつかい（既存データを壊さない任意項目）
    { id: 4, recipeId: 14, role: 'other' },
    { id: 5, recipeId: 15, role: 'side' },
  ]
  eq(
    'IV-3 通常表示は主菜→副菜→汁物→その他の順に並べる（roleなしは主菜）',
    planViewRows(ivEntries).map((e) => e.id),
    [2, 3, 5, 1, 4],
  )
  eq('IV-3 1品も入っていない食事では何も出さない（空き枠を出さない）', planViewRows([]), [])
  eq(
    'IV-3 入っている品を1つも落とさない（並べ替えるだけ）',
    planViewRows(ivEntries).length,
    ivEntries.length,
  )
}

// ==========================================================================================
// 便IZ-1: 週タブの献立を触る操作は、指で押せる大きさ（44px＝--tap-min）を必ず持つ
//         （2026-08-22 便IZ・実機の前の機械点検）
//
// 便IVで週タブの操作は「編集モード」の中へ集められた。そこが実測でこうなっていた（390×844）:
//   引き直し（サイコロ）34×34 / 外す（×）34×34の箱＋器で44 / 食数 27×15 /
//   食事の鍵 28×28 / 日の鍵 30×30 / 「レシピを見る」高さ16 / 「＋料理を追加」高さ16 /
//   日を畳む／開く 高さ32
// つまり **同じ役目の×だけに器（.tap-target）が着いていて、隣のサイコロは素通り** という
// 「片方だけ直した跡」がここにも在った（便HQ-3が測るのは ✕ とチェックの丸だけなので届かない）。
//
// ここでは、週タブで献立を触る操作を名前で1つずつ拾い、書いてあるクラスから
// **44pxを保証するもの（器 .tap-target / min-h-11 / h-11）を持っているか**を見る。
// 実画面での実寸と間隔は scripts/e2e-smoke.mjs の IZEDIT-01 が受け持つ（390pxと320pxの両方）。
// ここは e2e が開かない場面まで含めて取りこぼさないための静的な見張り。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
  const src = readFileSync(path.join(appRoot, 'src/pages/MealPlanPage.tsx'), 'utf-8')
  const css = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')
  // 44pxを配っている大元（器）が生きていることを先に確かめる。
  // 器が壊れたら「押せる面が広がっている」根拠が無くなるので、下の全部がその場で意味を失う
  eq(
    'IZ-1 押せる面の器（.tap-target）が44pxを配っている',
    /--tap-min:\s*44px/.test(css) &&
      /\.tap-target::after\s*\{[^}]*width:\s*var\(--tap-min\)[^}]*height:\s*var\(--tap-min\)[^}]*\}/.test(css),
    true,
  )

  /**
   * 目印（data-testid か aria-label の式）から、その要素の開きタグを丸ごと取り出す。
   * 掴み方を「行番号」や「並び順」にしないのは、並びが変わった瞬間に落ちる見張りを作らないため。
   */
  const openTagOf = (marker) => {
    const at = src.indexOf(marker)
    if (at < 0) return null
    const start = src.lastIndexOf('<', at)
    if (start < 0) return null
    // 属性の中の { } と文字列は数えずに、開きタグの終わりまで進む
    let depth = 0
    for (let i = start; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '"' || c === "'" || c === '`') {
        const quote = c
        i += 1
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') i += 1
          i += 1
        }
      } else if (c === '>' && depth === 0) return src.slice(start, i + 1)
    }
    return null
  }
  /** 44pxを保証する書き方を持っているか（器 or 実寸の指定） */
  const holds44 = (tag) =>
    tag !== null &&
    /(?:^|[\s`{'"])(?:tap-target|min-h-11|h-11)(?![\w-])/.test(tag)

  // 週タブで献立を触る操作。名前＝画面に出る目印か読み上げ名の式（画面の字は書き写さない）
  const IZ_TAPS = [
    ['日を畳む／開く', 'data-testid="week-day-toggle"'],
    ['編集／完了の切り替え', 'data-testid="week-day-edit"'],
    ['日の鍵', 'data-testid="day-lock"'],
    ['食事の鍵', 'data-testid="slot-lock"'],
    ['レシピを見る', 'data-testid="slot-open-recipe"'],
    ['引き直し（サイコロ）', 'aria-label={ja.mealPlan.suggestAria}'],
    ['外す（×）', 'ja.mealPlan.removeExtraRow'],
    ['食数を変える', 'ja.mealPlan.servingsEditAria'],
    ['空いている枠にレシピを選ぶ', 'onClick={() => openPicker(date, slot, role, entryId, extraLocalId)}'],
    ['＋料理を追加', 'ja.mealPlan.addRow'],
  ]
  const izMissing = []
  const izNotFound = []
  for (const [name, marker] of IZ_TAPS) {
    const tag = openTagOf(marker)
    if (tag === null) izNotFound.push(name)
    else if (!holds44(tag)) izMissing.push(name)
  }
  // 目印が見つからないのに「44px未満は0件でした」と緑にしない（掴めていないことを先に赤で言う）
  eq('IZ-1 週タブの操作を1つも取りこぼさずに掴めた', izNotFound, [])
  eq('IZ-1 週タブで献立を触る操作は、すべて44pxの押せる面を持つ', izMissing, [])
}

// ---------- JA-0〜JA-6: 同じ料理名のレシピを、番号を付けて入れる（2026-08-22 便JA） ----------
// オーナー原文「◯件入らなかったお知らせ→それでも入れるか聞く→はいで（２）、（３）...、とつけて入れる。
// いいえで重複して入れない。」／「懸念、『肉じゃが（２）』を重複で入れると、『肉じゃが（３）』ではなく
// 『肉じゃが（２）（２）』になりそう。」
// ここで測るのは「利用者が確かめたいこと」＝①同じ番号を2つ作らないこと ②もともと括弧のある
// 料理名を壊さないこと ③中身が同じだけの品を「入らなかった」と言わないこと。
{
  const jaTools = ['stripTitleNumber', 'nextDuplicateTitle', 'isSameRecipeBody', 'buildNumberedRecipeCopy', 'buildDuplicateTitleConfirm']
  eq(
    'JA-0 番号を付けて入れる道具がそろっている',
    jaTools.filter((name) => typeof backupLogic[name] !== 'function'),
    [],
  )
  // 道具が無いときは全ケースを「(未実装)」で落とす（import ごと落ちて他の節まで消えないように）
  const strip = (t) => backupLogic.stripTitleNumber?.(t) ?? '(未実装)'
  const next = (t, titles) => backupLogic.nextDuplicateTitle?.(t, titles) ?? '(未実装)'
  const sameBody = (a, b) => backupLogic.isSameRecipeBody?.(a, b) ?? '(未実装)'

  // --- JA-1: 料理名の末尾に付けた番号だけを外す ---
  eq('JA-1 半角の番号を外す', strip('肉じゃが (2)'), '肉じゃが')
  eq('JA-1 全角の括弧で書かれた番号も外す', strip('肉じゃが（2）'), '肉じゃが')
  eq('JA-1 全角の数字で書かれた番号も外す', strip('肉じゃが（２）'), '肉じゃが')
  eq('JA-1 スペースなしの番号も外す', strip('肉じゃが(2)'), '肉じゃが')
  eq('JA-1 番号が付いていない料理名はそのまま', strip('肉じゃが'), '肉じゃが')
  // 実在する品名（src/db/starters.ts）。末尾が数字だけの括弧ではないので番号とは見なさない
  for (const title of [
    'レンジ蒸し鶏（自家製サラダチキン）',
    '卯の花(おからの炒り煮)',
    '回鍋肉(ホイコーロー)',
    'きんぴら（金平）ごぼう',
  ]) {
    eq(`JA-1 説明の括弧が付いた「${title}」を壊さない`, strip(title), title)
  }
  eq('JA-1 括弧の中に数字以外が混ざっていたら番号ではない', strip('カレー (2人分)'), 'カレー (2人分)')
  eq('JA-1 料理名が番号だけになるときは外さない', strip('(2)'), '(2)')

  // --- JA-2: 次の番号の決め方（オーナーの懸念の本体） ---
  eq('JA-2 同じ料理名が1品あるなら (2)', next('肉じゃが', ['肉じゃが']), '肉じゃが (2)')
  eq('JA-2 (2)まであるなら (3)', next('肉じゃが', ['肉じゃが', '肉じゃが (2)']), '肉じゃが (3)')
  eq(
    'JA-2 入れる品が「肉じゃが (2)」でも「肉じゃが (2) (2)」にはしない（オーナーの懸念）',
    next('肉じゃが (2)', ['肉じゃが', '肉じゃが (2)']),
    '肉じゃが (3)',
  )
  eq(
    'JA-2 端末側が全角の番号で入っていても数として読む',
    next('肉じゃが', ['肉じゃが', '肉じゃが（２）']),
    '肉じゃが (3)',
  )
  eq('JA-2 番号が飛んでいたら、いちばん大きい番号の次', next('肉じゃが', ['肉じゃが', '肉じゃが (5)']), '肉じゃが (6)')
  eq('JA-2 別の料理名は数に入れない', next('肉じゃが', ['肉じゃが', '肉じゃがコロッケ (3)']), '肉じゃが (2)')
  eq(
    'JA-2 説明の括弧が付いた料理名にも番号を足せる',
    next('レンジ蒸し鶏（自家製サラダチキン）', ['レンジ蒸し鶏（自家製サラダチキン）']),
    'レンジ蒸し鶏（自家製サラダチキン） (2)',
  )
  {
    // 1回の読み込みで同じ料理名が3品あるとき、(2)(3)(4) と続くこと（同じ番号を2つ作らない）
    const titles = new Set(['肉じゃが'])
    const made = []
    for (let i = 0; i < 3; i++) {
      const title = next('肉じゃが', titles)
      made.push(title)
      titles.add(title)
    }
    eq('JA-2 1回の読み込みで同じ料理名が続いても番号が増える', made, ['肉じゃが (2)', '肉じゃが (3)', '肉じゃが (4)'])
    eq('JA-2 同じ番号を2つ作らない', new Set(made).size, made.length)
  }

  // --- JA-3: 「入らなかった」と言う相手を、中身が違う品だけに絞る ---
  const jaRecipe = (over = {}) => ({
    title: '肉じゃが',
    servings: 2,
    effortLevel: 'normal',
    tags: ['和食'],
    ingredients: [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    steps: [{ text: '煮る' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  })
  eq('JA-3 中身が同じなら「入らなかった」と言わない', sameBody(jaRecipe(), jaRecipe()), true)
  eq(
    'JA-3 番号・印・作った記録・お気に入り・写真・日時の違いは中身の違いにしない',
    sameBody(
      jaRecipe(),
      jaRecipe({ id: 9, uid: 'u-file', isFavorite: true, cookedLogs: [{ date: '2026-01-01' }], createdAt: 99, updatedAt: 99 }),
    ),
    true,
  )
  eq(
    'JA-3 材料が違えば中身が違う',
    sameBody(jaRecipe(), jaRecipe({ ingredients: [{ name: '牛肉', amount: '200', unit: 'g' }] })),
    false,
  )
  eq('JA-3 手順が違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ steps: [{ text: '焼く' }] })), false)
  eq('JA-3 メモが違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ memo: '冷蔵で2日' })), false)
  eq('JA-3 分量の人数が違えば中身が違う', sameBody(jaRecipe(), jaRecipe({ servings: 4 })), false)

  // --- JA-4: 番号を付けて入れる品の中身 ---
  {
    const copy =
      backupLogic.buildNumberedRecipeCopy?.(
        jaRecipe({
          id: 7,
          uid: 'u-file',
          isStarter: true,
          sourceSetId: 'kintore',
          sourceSetName: '高たんぱくごはん',
          cookedLogs: [{ date: '2026-01-01' }],
        }),
        new Set(['肉じゃが']),
        new Set(),
        () => 'u-new',
      ) ?? {}
    eq('JA-4 番号を付けた料理名で入る', copy.title, '肉じゃが (2)')
    eq('JA-4 ファイル側の番号は引き継がない（端末の番号は端末が振る）', Object.hasOwn(copy, 'id'), false)
    eq(
      'JA-4 基本レシピ・配布セットの目印は外す（「基本レシピを入れ直す」で黙って消えるのを防ぐ）',
      [copy.isStarter, copy.sourceSetId, copy.sourceSetName],
      [undefined, undefined, undefined],
    )
    eq('JA-4 端末で使われていない印はそのまま引き継ぐ', copy.uid, 'u-file')
    eq('JA-4 作った記録は足さない（同じ料理名の品へ足したものと二重にしない）', copy.cookedLogs, [])
    eq('JA-4 番号を付けた料理名で検索できる', (copy.searchWords ?? []).includes('にくじゃが (2)'), true)
    eq('JA-4 材料・手順はファイルの内容が入る', copy.ingredients, jaRecipe().ingredients)
    const copyUsed =
      backupLogic.buildNumberedRecipeCopy?.(
        jaRecipe({ uid: 'u-file' }),
        new Set(['肉じゃが']),
        new Set(['u-file']),
        () => 'u-new',
      ) ?? {}
    eq(
      'JA-4 端末で使われている印は付け直す（同じ印が2品に付くと記録の結び直しが壊れる）',
      copyUsed.uid,
      'u-new',
    )
  }

  // --- JA-5: 聞き方（1回だけ・件数を言う・何が変わらないかを言う） ---
  {
    const ask = backupLogic.buildDuplicateTitleConfirm?.(3) ?? {}
    const askText = typeof ask.title === 'string' ? confirmContentText(ask) : ''
    eq('JA-5 見出しに件数が入る', /3品/.test(ask.title ?? ''), true)
    eq('JA-5 今のレシピが変わらないことを言っている', /変わらない|そのまま/.test(askText), true)
    // 窓の文（confirmContentText）にはボタンの言葉が入らないので、ボタンは別に測る
    eq('JA-5 押すと何が起きるかがボタンの言葉で分かる', (ask.confirmLabel ?? '').includes('番号'), true)
    eq('JA-5 番号の付け方が具体例で分かる', /\(2\)/.test(askText) && /\(3\)/.test(askText), true)
  }

  // --- JA-6: 読み込みの流れに繋がっているか（画面を立ち上げずに形だけ測る） ---
  {
    const jaRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
    const backupSrc = readFileSync(path.join(jaRoot, 'src/logic/backup.ts'), 'utf-8')
    const settingsSrc = readFileSync(path.join(jaRoot, 'src/pages/SettingsPage.tsx'), 'utf-8')
    eq(
      'JA-6 「追加」の結果に、入らなかった品を返している',
      /duplicateTitleRecipes/.test(backupSrc),
      true,
    )
    eq(
      'JA-6 設定画面が、入らなかった品を受けて聞いてから入れている',
      /buildDuplicateTitleConfirm[\s\S]{0,400}importDuplicateTitleRecipes/.test(settingsSrc),
      true,
    )
  }
}

// ---------- 結果 ----------
console.log(`合格: ${passed}件 / 失敗: ${failures.length}件`)
for (const f of failures) console.log(`  NG ${f}`)
process.exit(failures.length > 0 ? 1 : 0)