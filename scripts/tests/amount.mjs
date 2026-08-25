// 分量と単位の読み取り（scaleAmount / splitQuantity / 全角の正規化）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq } from './_harness.mjs'
import {
  scaleAmount,
  formatAmountUnit,
  normalizeDigits,
  normalizeAmountInput,
  expandMixedFraction,
} from '../../src/logic/amount.ts'
import { isHttpUrl } from '../../src/logic/url.ts'
import { splitQuantity, autoSplitAmountUnit } from '../../src/logic/parseRecipeText.ts'
import {
  parseAmountNumber,
  convertToGrams,
  computeRecipeNutrition,
} from '../../src/logic/nutrition.ts'

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

