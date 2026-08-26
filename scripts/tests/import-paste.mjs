// 貼り付けからの取り込み（parseRecipeText とコーパス・ゴミ行の判定）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, neq } from './_harness.mjs'
import {
  parseRecipeText,
  splitQuantity,
  autoSplitAmountUnit,
  looksPoorlyParsed,
  preprocessPastedLines,
  normalizeImportedIngredient,
  isImportGomiLine,
} from '../../src/logic/parseRecipeText.ts'
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
import { stepIngredientAmounts } from '../../src/logic/naviIngredients.ts'
import { buildPriceIndex, matchPriceEntry } from '../../src/logic/priceEstimate.ts'
import { starterDefs } from '../../src/db/starters.ts'
import {
  buildImportedIngredientRows,
  filterImportedSteps,
  stripPastedMarkup,
} from '../../src/logic/urlImportRows.ts'
import { ja } from '../../src/i18n/ja.ts'
// 2026-08-26 便LG: 印から合わせ調味料の組を作り直す（速記入力・手入力・取り込みの共通の道）
import {
  regroupIngredientRowsByMark,
  countSeasoningGroupsFromMarks,
} from '../../src/logic/seasoningRegroup.ts'

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
  const { attachImportedStepNotes } = await import('../../src/logic/urlImportRows.ts')
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
  const { stripIngredientDecoration } = await import('../../src/logic/kana.ts')
  const { matchNutritionFood } = await import('../../src/logic/nutrition.ts')
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
  const { isImportedCookwareName } = await import('../../src/logic/urlImportRows.ts')
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

// ---------- 便JH: 取り込んだレシピには安全注記が1つも付かない（2026-08-22 オーナーの書き溜め） ----
// オーナー原文:
//   「レンジ温泉卵
//    ・卵をレンジ加熱なら、卵黄に爪楊枝で穴を開けないと爆発しそう」
//
// 根は1品の話ではない。同梱の基本レシピ（109品）には CLAUDE.md D-④ の安全注記が原稿に
// 入っているのに、URL・文章から取り込んだレシピには1つも付かない。
// オーナーの実データ31品を測ると、D-④に該当する26品の**26品すべてに注記が無かった**
// （同梱109品は該当81品のうち75品に注記あり）。
//
// ここで見張るのは次の2つ。**直す前はすべて赤**（safetyNotesFor が無い＝注記が0件）:
//   ①危険が公に知られている組み合わせでは注記が出る（JH-1〜JH-4）
//   ②それ以外では**1件も出さない**（JH-5・JH-8）。誤検出で毎回出ると本当に必要なときに読まれない
// 仕掛けの中身は src/logic/safetyNotes.ts、文言は src/i18n/ja.ts の ja.safety。
import { safetyNotesFor, stepSafetyNotes, wholeRecipeSafetyNotes } from '../../src/logic/safetyNotes.ts'
{
  /** 判定に使う最小限の形を組む（材料名と手順本文だけ見る） */
  const jhRecipe = (title, ings, stepTexts, extra = {}) => ({
    title,
    servings: 2,
    ingredients: ings.map((name) => ({ name })),
    steps: stepTexts.map((t) => (typeof t === 'string' ? { text: t } : t)),
    ...extra,
  })
  const jhRules = (recipe) => safetyNotesFor(recipe).map((n) => n.rule)
  /** その手順に付いた注記の決まりの名前 */
  const jhStepRules = (recipe, i) =>
    stepSafetyNotes(safetyNotesFor(recipe), i).map((n) => n.rule)

  // --- JH-1: 電子レンジ＋卵。黄身は薄い膜に包まれていて、中の水分が急に沸騰すると破裂する ---
  // オーナーの実データ「レンジで温泉卵」の手順そのまま（1手順しかないレシピ）
  const jhOnsen = jhRecipe('レンジで温泉卵', ['卵', '水'], ['器に卵と水を入れ、電子レンジ600Wで50秒加熱する'])
  eq('JH-1 レンジ加熱の手順に卵があれば、その手順に注記が付く', jhStepRules(jhOnsen, 0), ['microwaveEgg'])
  eq(
    'JH-1 注記は手順の本文ではなく、添える文として返る（本文は1文字も変えない）',
    jhOnsen.steps[0].text,
    '器に卵と水を入れ、電子レンジ600Wで50秒加熱する',
  )
  eq(
    'JH-1 レンチン・電子レンジ・レンジのどの書き方でも拾う',
    ['卵をレンジで1分加熱する', '卵をレンチンする', '卵を電子レンジにかける'].map(
      (t) => jhStepRules(jhRecipe('t', ['卵'], [t]), 0).length,
    ),
    [1, 1, 1],
  )

  // --- JH-2: 電子レンジ＋皮や薄い膜のあるもの。①と同じ理屈で破裂する ---
  // オーナーの実データ「丸ごと無限ピーマン」の手順そのまま
  const jhPiman = jhRecipe(
    '丸ごと無限ピーマン',
    ['ピーマン', 'ツナ缶'],
    ['聞こえますか…ピーマンは丸ごとレンチンするのです…', 'ピーマン3～4個を容器にいれラップし600w4分チン…'],
  )
  eq('JH-2 皮のある野菜を丸ごとレンジにかける手順に注記が付く', jhStepRules(jhPiman, 0), ['microwaveBurst'])
  eq(
    'JH-2 ウインナー・たらこ・栗のように膜のあるものもレンジと同じ手順にあれば拾う',
    ['ウインナーをレンジで温める', 'たらこをレンジで加熱する', '栗をレンジにかける'].map(
      (t) => jhStepRules(jhRecipe('t', ['ウインナー'], [t]), 0),
    ),
    [['microwaveBurst'], ['microwaveBurst'], ['microwaveBurst']],
  )

  // --- JH-3: 電子レンジ＋生の肉・魚。火の通りにムラが出て中心が生のまま残りやすい（D-④②） ---
  // オーナーの実データ「レンジで簡単！本格グリーンカレー」の手順そのまま
  const jhCurry = jhRecipe(
    'レンジで簡単！本格グリーンカレー',
    ['鶏むね肉', '玉ねぎ', 'ココナッツミルク'],
    [
      '鶏むね肉は一口大（そぎ切り）に、なすとズッキーニは半月切りにする。',
      '耐熱容器に切った野菜と鶏むね肉を入れ、フタ又はラップをかけて、600wのレンジで6分加熱する。',
    ],
    { servings: 4 },
  )
  eq('JH-3 レンジ加熱の手順に生の肉があれば、その手順に火の通りの目安が付く', jhStepRules(jhCurry, 1), ['microwaveRawMeat'])
  eq('JH-3 レンジを使っていない手順には付かない', jhStepRules(jhCurry, 0), [])
  eq(
    'JH-3 火の通りの目安が本文にすでに書いてあれば、二重に言わない',
    jhStepRules(jhRecipe('t', ['鶏肉'], ['鶏肉をレンジで5分加熱し、中まで火が通ったか確認する']), 0),
    [],
  )

  // --- JH-4: レシピ全体に添えるもの（対象者・保存・再加熱。D-④③④⑦の置き場所） ---
  eq(
    'JH-4 半熟・生の卵を使うレシピには、対象者の案内がレシピ全体に付く',
    jhRules(jhRecipe('☆簡単ビビンバ☆', ['温泉卵', '合挽き肉', 'ご飯'], ['丼にご飯を盛り温泉卵をのせて出来上がり'])),
    ['runnyEgg'],
  )
  eq(
    'JH-4 はちみつを使うレシピには、1歳未満への案内がレシピ全体に付く',
    jhRules(jhRecipe('ヨーグルトバーク', ['ヨーグルト', 'はちみつ'], ['混ぜて冷凍庫で固める'])),
    ['honey'],
  )
  eq(
    'JH-4 4人分以上の煮込みには、冷蔵と温め直しの案内がレシピ全体に付く',
    jhRules(jhRecipe('レンジで簡単！本格グリーンカレー', ['玉ねぎ'], ['煮る'], { servings: 4 })),
    ['bigBatchStew'],
  )
  eq(
    'JH-4 作り置きと書いてあれば人数分によらず付く',
    jhRules(jhRecipe('【15分】基本のグリーンカレー【作り置き・大量消費・夏野菜】', ['なす'], ['煮る'], { servings: 2 })),
    ['bigBatchStew'],
  )
  eq(
    'JH-4 3人分以下の煮込みには付けない（D-④の4人前以上より狭く取らない・広げない）',
    jhRules(jhRecipe('ハヤシライス', ['牛切り落とし肉'], ['煮る'], { servings: 2 })),
    [],
  )
  eq(
    'JH-4 レシピ全体の注記は、どの手順にも紐づかない形で返る',
    wholeRecipeSafetyNotes(safetyNotesFor(jhRecipe('カレー', ['玉ねぎ'], ['煮る'], { servings: 4 }))).map(
      (n) => n.stepIndex,
    ),
    [undefined],
  )

  // --- JH-5: 出してはいけない形（誤検出で毎回出ると、本当に必要なときに読まれなくなる） ---
  eq(
    'JH-5 溶き卵をレンジにかける手順には出さない（膜がすでに壊れていて破裂しない）',
    jhStepRules(jhRecipe('t', ['卵'], ['溶き卵を耐熱容器に入れ、レンジで1分加熱する']), 0),
    [],
  )
  eq(
    'JH-5 「オレンジ」を電子レンジと読み違えない',
    jhStepRules(jhRecipe('t', ['卵', 'オレンジ'], ['卵とオレンジを混ぜる']), 0),
    [],
  )
  eq(
    'JH-5 電子レンジのオーブン機能で焼く手順には出さない（破裂・加熱ムラの話ではない）',
    jhStepRules(jhRecipe('t', ['卵'], ['電子レンジのオーブン機能を使い170℃で25分焼く']), 0),
    [],
  )
  eq(
    'JH-5 本文にすでに穴を開ける指示があれば、二重に言わない',
    jhStepRules(jhRecipe('t', ['卵'], ['卵の黄身に爪楊枝で穴を開け、レンジで50秒加熱する']), 0),
    [],
  )
  eq(
    'JH-5 レンジを使わない卵料理には出さない',
    jhRules(jhRecipe('だし巻き卵', ['卵', 'だし汁'], ['卵を溶き、フライパンで巻きながら焼く'])),
    [],
  )
  eq(
    'JH-5 同梱の基本レシピには1件も出さない（原稿に注記が入っているので二重に出さない）',
    safetyNotesFor({ ...jhOnsen, isStarter: true }),
    [],
  )
  eq(
    'JH-5 「半熟」だけで卵の話でないもの（半熟チーズケーキ）には出さない',
    jhRules(jhRecipe('半熟チーズケーキ', ['クリームチーズ', '生クリーム'], ['型に流して焼く'])),
    [],
  )

  // --- JH-6: 添えるだけで、レシピのデータには何も書き込まない ---
  {
    const before = jhRecipe('レンジで温泉卵', ['卵'], [{ text: '卵をレンジで50秒加熱する', memo: '好みで塩をふる' }])
    const snapshot = JSON.stringify(before)
    safetyNotesFor(before)
    eq('JH-6 判定を通してもレシピの中身が1文字も変わらない', JSON.stringify(before), snapshot)
    eq('JH-6 利用者が書いたメモはそのまま残る', before.steps[0].memo, '好みで塩をふる')
  }

  // --- JH-7: 文言の作法（D-④: 簡潔な常体1〜2文・必須は「〜こと」・菌名や恐怖をあおる語は書かない） ---
  {
    const jhTexts = Object.entries(ja.safety).filter(([k]) => k !== 'title' && k !== 'source')
    eq('JH-7 文言を読めている（0件なら見張りが壊れている）', jhTexts.length >= 6, true)
    const jhStyle = []
    for (const [key, text] of jhTexts) {
      const plain = text.replace(/​/g, '')
      if (!/(こと|安心)。$/.test(plain)) jhStyle.push(`${key}: 「〜こと。」「〜と安心。」で終わっていない`)
      if (plain.split('。').filter(Boolean).length > 2) jhStyle.push(`${key}: 3文以上ある`)
      if (plain.length > 60) jhStyle.push(`${key}: 60字を超えている（${plain.length}字）`)
      for (const ng of ['菌', '中毒', '危険', '死', '病気'])
        if (plain.includes(ng)) jhStyle.push(`${key}: 「${ng}」が入っている`)
    }
    eq('JH-7 レシピに添える注意の文言が D-④ の作法から外れていない', jhStyle, [])
  }

  // --- JH-8: 同梱109品に当てても、人が書いた注記と食い違わない（誤検出の見張り） ---
  // 同梱には出さない仕掛けだが、**語の表を広げすぎたら赤くする**ために、あえて当てて数える。
  // ここに出る8品は、すべて原稿（starters.ts・sets/*.ts）に同じ話の注記が人の手で入っている品。
  // 表を広げて品が増えたら、その1件ずつが本当に必要かを確かめること（理由なしに増やさない）。
  {
    const jhFired = starterDefs
      .map((r) => ({ title: r.title, rules: safetyNotesFor(r).map((n) => n.rule) }))
      .filter((r) => r.rules.length > 0)
    eq('JH-8 同梱レシピを読めている（0品なら見張りが壊れている）', starterDefs.length, 109)
    eq(
      'JH-8 同梱109品で注記が出るのは、人が同じ話を書いている8品だけ',
      jhFired.map((r) => `${r.title}:${r.rules.join('+')}`),
      [
        'カレーライス:bigBatchStew',
        '親子丼:runnyEgg',
        'だし巻き卵:runnyEgg',
        '豚汁:bigBatchStew',
        'クリームシチュー:bigBatchStew',
        'オムライス:runnyEgg',
        'エビとブロッコリーの卵炒め:runnyEgg',
        'フルーツヨーグルトバーク:honey',
      ],
    )
  }
}

// ---------- KG-3: 合わせ調味料の印が材料名に残る（英小文字の「a.」） ----------
// 実データA「節約おかず。厚揚げともやしのピリ辛みそ炒め」で5行すべてが `a. 酒` のまま保存され、
// 買い物メモにも栄養にも名前が届いていなかった（大文字A〜Dの印は既に剥がしている＝経路の非対称）。
{
  const rows = buildImportedIngredientRows([
    { name: '厚揚げ', amount: '2枚' },
    { name: 'もやし', amount: '1袋' },
    { name: 'a. 酒', amount: '大さじ1' },
    { name: 'a. みりん', amount: '大さじ1' },
    { name: 'a. 砂糖', amount: '小さじ1' },
    { name: 'a. 合わせみそ', amount: '大さじ1.5' },
    { name: 'a. 豆板醤', amount: '小さじ1' },
  ])
  eq('KG-3 英小文字の印は材料名から外れる', rows.map((r) => r.name).join(','), '厚揚げ,もやし,酒,みりん,砂糖,合わせみそ,豆板醤')
  eq('KG-3 外した印は材料メモに残る', rows[2].memo, 'a')
  eq('KG-3 同じ印の材料は1つの組になる', rows.slice(2).every((r) => r.group === 1), true)
  eq('KG-3 印の無い材料は組に入らない', [rows[0].group, rows[1].group], [undefined, undefined])
  // 誤爆: 英字で始まるだけの本物の材料名は触らない
  const notMarks = buildImportedIngredientRows([
    { name: 'EVオリーブ油', amount: '適量' },
    { name: 'A5ランクの牛肉', amount: '200g' },
    { name: 'aさんのタレ', amount: '大さじ1' },
  ])
  eq('KG-3 誤爆しない: 英字で始まる材料名はそのまま', notMarks.map((r) => r.name).join(','), 'EVオリーブ油,A5ランクの牛肉,aさんのタレ')
}

// ---------- KG-4: 手順ではない「報告文」が手順に入る ----------
// 実データC「こっくりおいしい豚バラ大根」の最終手順が、テレビ番組で紹介された報告文だった
// （並行調理ナビの最後の工程＝「作った！」の直前に読む行になる）。
{
  eq(
    'KG-4 テレビで紹介された報告文は手順ではない',
    isImportGomiLine('2014/01/17に日本テレビ「ヒルナンデス」で試食、紹介していただきました♪'),
    true,
  )
  eq('KG-4 話題入りの報告文も手順ではない', isImportGomiLine('おかげさまで話題入りしました！ありがとうございます'), true)
  eq('KG-4 レシピ本に掲載された報告文も手順ではない', isImportGomiLine('2020年3月　レシピ本に掲載していただきました'), true)
  // 誤爆: 本物の手順は落とさない
  eq('KG-4 誤爆しない: 本物の手順は残る', isImportGomiLine('大根に火が通ったら蓋を開け、煮汁がなくなるまで煮込んで出来上がり。'), false)
  eq('KG-4 誤爆しない: 紹介の語を含む手順は残る', isImportGomiLine('お好みで七味を紹介した分量よりも多めにふる。'), false)
  eq(
    'KG-4 報告文だけが落ち、手順は全部残る',
    filterImportedSteps([
      '大根は2cmくらいのいちょう切りにする。',
      '鍋にごま油を温めて炒める。',
      '2014/01/17に日本テレビ「ヒルナンデス」で試食、紹介していただきました♪',
    ]),
    ['大根は2cmくらいのいちょう切りにする。', '鍋にごま油を温めて炒める。'],
  )
}

// ---------- KG-5: 調理時間が書かれていないことを、URL取り込みでも知らせる ----------
// 実データ: クックパッド25品すべてで調理時間が空（実測でページ側に cookTime/totalTime が無い）。
// 貼り付け経路には知らせがあるのに、URL経路には無かった。
// 2026-08-25 便KW・①: 人数分の知らせ（便KF）と1行にまとめたので、
// 「調理時間という項目名が、読み取れなかったものの並びに出せること」を見張る形に変えた。
{
  eq('KG-5 貼り付け経路に「読み取れなかったもの」の知らせがある', typeof ja.paste.notImported === 'string' && ja.paste.notImported.includes('{items}'), true)
  eq('KG-5 URL取り込み経路にも同じ知らせがある', typeof ja.urlImport.notImported === 'string' && ja.urlImport.notImported.includes('{items}'), true)
  eq('KG-5 どちらの経路も「調理時間」を項目名として出せる', [ja.paste.itemCookMinutes, ja.urlImport.itemCookMinutes], ['調理時間', '調理時間'])
  eq('KG-5 「調理時間」が入った1行を組み立てられる', ja.urlImport.notImported.replace('{items}', ja.urlImport.itemCookMinutes).includes('調理時間'), true)
}


// ============================================================================
// LG-04: 印から合わせ調味料の組を作る（2026-08-26 便LG・オーナー原文「ビビンバ」）
//
//   「調味料の頭の印を削除するようにしたが、手順に『●の調味料を合わせておく』とあり、
//    合わせ調味料の設定は自動で出来ていないので、これではただ目印が消えただけになっている。」
//
//   実測: 貼り付け取り込みとURL取り込みは印から組を作れていた。組にならず印だけ残るのは
//   **その2つを通らない道**（材料の速記入力・手で入れた並び・取り込み元が見出しで組を
//   持っていた回）で、あとから印で作り直す道が画面のどこにも無かった。
//   ここでは作り直しの規則（logic/seasoningRegroup.ts）を固定する。
// ============================================================================
{
  const lgRow = (name, memo = '', group = undefined) => ({ name, amount: '', unit: '', memo, group })
  const lgGroups = (rows) => rows.map((r) => (r.group != null ? `${r.name}#${r.group}` : r.name))
  const lgCount = (rows) =>
    new Set(rows.map((r) => r.group).filter((g) => g != null)).size

  // ---- ビビンバ型: ●が4件 → 1組 ----
  {
    const rows = [
      lgRow('ご飯'),
      lgRow('牛ひき肉'),
      lgRow('しょうゆ', '●'),
      lgRow('砂糖', '●'),
      lgRow('コチュジャン', '●'),
      lgRow('おろしにんにく', '●'),
      lgRow('ごま油'),
    ]
    eq('LG-04 押す前は「印から組を作る」が出る（1組作れる）', countSeasoningGroupsFromMarks(rows), 1)
    const after = regroupIngredientRowsByMark(rows)
    eq(
      'LG-04 ビビンバ型: ●の4件が同じ組になる',
      lgGroups(after),
      ['ご飯', '牛ひき肉', 'しょうゆ#1', '砂糖#1', 'コチュジャン#1', 'おろしにんにく#1', 'ごま油'],
    )
    eq('LG-04 印はメモに残る（書いてあった事実を消さない）', after[2].memo, '●')
    eq(
      'LG-04 もう一度押しても何も変わらない（組があるときは手を出さない）',
      lgGroups(regroupIngredientRowsByMark(after)),
      lgGroups(after),
    )
    eq('LG-04 作ったあとは入口が出ない', countSeasoningGroupsFromMarks(after), 0)
  }

  // ---- 印が2種類なら2組 ----
  {
    const rows = [lgRow('みそ', '☆'), lgRow('みりん', '☆'), lgRow('ごま', '◎'), lgRow('砂糖', '◎')]
    eq('LG-04 印が2種類あれば2組になる', lgGroups(regroupIngredientRowsByMark(rows)), [
      'みそ#1',
      'みりん#1',
      'ごま#2',
      '砂糖#2',
    ])
  }

  // ---- 誤って組にしないもの ----
  {
    eq(
      'LG-04 同じ印が1件しか無ければ組にしない',
      lgCount(regroupIngredientRowsByMark([lgRow('しょうゆ', '●'), lgRow('砂糖'), lgRow('酒')])),
      0,
    )
    const decorative = [lgRow('豚肉', '●'), lgRow('キャベツ', '●'), lgRow('しょうゆ', '●')]
    eq(
      'LG-04 全部の材料に同じ印＝行頭の飾りなので組にしない',
      lgCount(regroupIngredientRowsByMark(decorative)),
      0,
    )
    eq(
      'LG-04 組にしなかった行のメモは1文字も変えない（人が書いた印を消さない）',
      regroupIngredientRowsByMark(decorative).map((r) => r.memo),
      ['●', '●', '●'],
    )
    eq(
      'LG-04 「A5ランクの牛肉」「EVオリーブ油」を英字の印と読み違えない',
      lgCount(
        regroupIngredientRowsByMark([
          lgRow('A5ランクの牛肉'),
          lgRow('EVオリーブ油'),
          lgRow('しょうゆ'),
        ]),
      ),
      0,
    )
    eq(
      'LG-04 すでに組が付いている並びは塗り替えない',
      lgGroups(regroupIngredientRowsByMark([lgRow('みそ', '☆'), lgRow('みりん', '☆', 3)])),
      ['みそ', 'みりん#3'],
    )
  }

  // ---- 同梱109品への誤爆が無いこと ----
  {
    let lgMisfire = 0
    let lgChanged = 0
    for (const def of starterDefs) {
      const asIs = def.ingredients.map((i) => lgRow(i.name, i.memo ?? '', i.seasoningGroup))
      if (JSON.stringify(asIs) !== JSON.stringify(regroupIngredientRowsByMark(asIs))) lgChanged++
      const noGroup = def.ingredients.map((i) => lgRow(i.name, i.memo ?? ''))
      if (countSeasoningGroupsFromMarks(noGroup) > 0) lgMisfire++
    }
    eq('LG-04 同梱109品を作り直しにかけても中身が変わらない', lgChanged, 0)
    eq('LG-04 同梱109品では「印から組を作る」が出ない（印を使っていないため）', lgMisfire, 0)
  }

  // ---- 貼り付け取り込みと同じ組になること（同じレシピが道によって違う組にならない） ----
  {
    const lgPaste = `ビビンバ
材料（2人分）
ご飯 2杯分
牛ひき肉 150g
●しょうゆ 大さじ1
●砂糖 大さじ1/2
●コチュジャン 大さじ1
●おろしにんにく 小さじ1/2
ごま油 大さじ1

作り方
1 ●の調味料を合わせておく。
2 フライパンにごま油を熱し、牛ひき肉を炒め、●を加えて炒める。`
    const parsed = parseRecipeText(lgPaste)
    const pasteGroups = new Set(
      parsed.ingredients.map((r) => r.group).filter((g) => g != null),
    ).size
    const byHand = regroupIngredientRowsByMark(
      parsed.ingredients.map((r) => lgRow(r.name, r.memo ?? '')),
    )
    eq('LG-04 貼り付け取り込みは今までどおり1組にする', pasteGroups, 1)
    eq('LG-04 手で並べたときも同じ組の数になる', lgCount(byHand), pasteGroups)
    eq(
      'LG-04 手順文の印（●）は消さない＝材料の組と読み合わせられる',
      parsed.steps.some((text) => text.includes('●')),
      true,
    )
  }
}
