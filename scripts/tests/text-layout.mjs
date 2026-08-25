// 文言と表記の規律（改行エンジン・助数詞・長文・「目安」の使いどころ）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, neq, scriptFileUrl } from './_harness.mjs'
import { parseRecipeText } from '../../src/logic/parseRecipeText.ts'
import {
  buildSearchWords,
  toHiragana,
  toTagKey,
  titleKanaKey,
  APPLIANCE_SEARCH_WORDS,
  dishTypeSearchWord,
} from '../../src/logic/kana.ts'
import { convertToGrams, NUTRITION_DISPLAY_KEYS } from '../../src/logic/nutrition.ts'
import {
  isRecipeInToday,
  recipeDishType,
  normalizePlanFillMode,
  planDayCardPadClass,
} from '../../src/logic/mealPlan.ts'
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
import {
  PRICE_DEFAULTS_VERSION as PRICE_DEFAULTS_VERSION_FOR_JG,
} from '../../src/data/priceDefaults.ts'
import { buildShoppingCandidates } from '../../src/logic/shopping.ts'
import { CARD_PART_KEYS, cardPartsFor } from '../../src/logic/cardParts.ts'
import { parseBackup } from '../../src/logic/backup.ts'
import { backupFileName, selectedRecipesFileName } from '../../src/logic/fileSave.ts'
import {
  buildPriceIndex,
  matchPriceEntry,
  estimateIngredientYen,
} from '../../src/logic/priceEstimate.ts'
import { summarizeRangeIntake, dayIntakeMap } from '../../src/logic/rangeSummary.ts'
import {
  searchRecipes,
  searchMatchReasons,
  searchMatchSummary,
  searchMatchRowText,
  splitTerms,
  defaultSearchOptions,
} from '../../src/logic/search.ts'
import { starterDefs } from '../../src/db/starters.ts'
import {
  archiveFileName,
  buildArchiveFile,
  parseArchiveFile,
} from '../../src/logic/cookedArchive.ts'
import { ja } from '../../src/i18n/ja.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'

// ---------- jaWrap: 文節折返し(BudouX・2026-07-11) ----------
{
  const { wrapJaPhrases, ZWSP } = await import('../../src/logic/jaWrap.ts')
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
  const { splitAroundTimeToken } = await import('../../src/logic/jaWrap.ts')
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
    '../../src/logic/termSplit.ts'
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

// ---------- termSplit: 純粋性(StrictMode二重実行の再発防止・2026-07-11) ----------
{
  const { splitByTerms } = await import('../../src/logic/termSplit.ts')
  const text = '玉ねぎはくし形に切る。'
  const seen = new Set()
  const first = splitByTerms(text, seen)
  eq('splitByTermsは入力セットを書き換えない', seen.size, 0)
  const second = splitByTerms(text, seen)
  const tappable = (segs) => segs.filter((s) => s.type === 'term' && s.tappable).length
  eq('2回呼んでも1回目と同じ結果(二重実行安全)', tappable(second), tappable(first))
  eq('くし形がタップ可能', tappable(first) >= 1, true)
}

// ---------- 材料名の下線マッチ(docs/20 §7・手順本文中の材料名に控えめな下線・2026-07-12) ----------
{
  const { buildIngredientNames, findIngredientMatches } = await import(
    '../../src/logic/ingredientSpans.ts'
  )
  const { splitByTerms } = await import('../../src/logic/termSplit.ts')

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

// ---------- lineCompose: 読点優先・幅実測の行組みエンジン(2026-07-21 p9/line-compose) ----------
// composeLines へ「1文字=1幅」の偽測定関数と、実アトム列(TermText+TimeText 相当の分解結果)を
// 渡し、オーナー3例を幅12/14/17/28 で組んだ期待行を固定する。期待値はアルゴリズムから導出し、
// 受け入れ基準1(こんにゃく文)・基準2(しょうゆ・みりん文)・基準3(PC幅でも詰め込まない)を満たす。
{
  const { composeLines, lineToText } = await import('../../src/logic/lineCompose.ts')
  const { ZWSP } = await import('../../src/logic/jaWrap.ts')
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
  const { composeLines, lineToText } = await import('../../src/logic/lineCompose.ts')
  const { ZWSP } = await import('../../src/logic/jaWrap.ts')
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
  const { findTimeTokens } = await import('../../src/logic/time.ts')
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
  const { composeLines, lineToText } = await import('../../src/logic/lineCompose.ts')
  const { splitAroundTimeToken, ZWSP } = await import('../../src/logic/jaWrap.ts')
  const { findTimeTokens } = await import('../../src/logic/time.ts')
  const { splitByTerms } = await import('../../src/logic/termSplit.ts')
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
  const { composeLines, lineToText } = await import('../../src/logic/lineCompose.ts')
  const { splitAroundTimeToken, ZWSP } = await import('../../src/logic/jaWrap.ts')
  const { findTimeTokens } = await import('../../src/logic/time.ts')
  const { splitByTerms } = await import('../../src/logic/termSplit.ts')
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

// ---------- 便EI-4: 写真1枚あたりの容量表記を1つに揃える ----------
// 「150〜300KB」と「100〜300KB」が混在していた(2026-08-09 便EI)。実測は使い方ページ§12の表
// (scripts/measure-storage.mjs でIndexedDBの増分を実測。レシピの写真 約170KB・
// 「作った記録」の写真 約160KB)で、docs/20 §4 の記録写真の実測も150〜300KB。
// 圧縮設定はレシピ写真=長辺1200px/JPEG0.85(logic/image.ts)、記録写真=長辺1280px/JPEG0.80
// (CookedLogModal.tsx)で、どちらも同じ水準に落ちる。以後は全箇所を同じ範囲で書く。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const PHOTO_SIZE_TEXT = '150〜300KB'
  const targets = ['src/i18n/ja.ts', 'public/about/index.html', 'public/about/manual.html']
  for (const rel of targets) {
    const src = readFileSync(path.join(appRoot, rel), 'utf-8')
    // 「◯〜◯KB」の形で書かれた範囲表記だけを拾う(「約170KB」等の単一値は対象外)
    const ranges = [...new Set(src.match(/\d+〜\d+KB/g) ?? [])]
    eq(`EI-4 ${rel} の写真容量の範囲表記が1種類に揃っている`, ranges, ranges.length ? [PHOTO_SIZE_TEXT] : [])
  }
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
    const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')

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
      // 章の中で説明している考え方の呼び名（栄養の「概算」と「目安」）。画面のボタンではない
      '目安',
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

    // IK-5: **使い方ページ以外**が載せている同じ図も、控えと同じ大きさで書く（2026-08-22 司令部）。
    // 直した穴: 上の IK-2 は manual.html しか読んでいなかったので、紹介ページ（index.html）が
    // 同じ図を載せていても取りこぼす。実際に 2026-08-22 の撮り直しで paste.webp が
    // 780x924→780x964 に変わったとき、manual.html だけが直り index.html が古い数字のまま残った
    // （e2e の SHOTSIZE-EP と FE-LP が拾ったが、単体では通っていた＝発見が1段階遅れる）。
    // 図は縦横比が狂うと崩れて出るので、載せている場所を全部見る。
    const otherPages = readdirSync(path.join(appRoot, 'public/about'))
      .filter((f) => f.endsWith('.html') && f !== 'manual.html')
    eq('IK-5 使い方ページ以外のページを読めている（0件なら見張りが壊れている）', otherPages.length > 0, true)
    const otherFigureSizes = []
    for (const file of otherPages) {
      const raw = readFileSync(path.join(appRoot, 'public/about', file), 'utf-8')
      for (const m of raw.matchAll(/<img\s+src="\/about\/img\/manual\/([a-z0-9-]+)\.webp"([^>]*)>/g)) {
        const name = m[1]
        const w = Number(m[2].match(/\swidth="(\d+)"/)?.[1])
        const h = Number(m[2].match(/\sheight="(\d+)"/)?.[1])
        if (!shotSizes[name]) {
          otherFigureSizes.push(`${file} ${name} 撮影の控えに無い`)
        } else if (shotSizes[name].w !== w || shotSizes[name].h !== h) {
          otherFigureSizes.push(`${file} ${name} ページ=${w}x${h} 撮影=${shotSizes[name].w}x${shotSizes[name].h}`)
        }
      }
    }
    eq('IK-5 使い方ページ以外が載せている図も、width/height が撮影の控えと同じ', otherFigureSizes, [])

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
        '栄養価の概算（◯食あたり）',
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

    // --- JB-1 / JB-2: 撮ると宣言したカットが、黙って撮られないまま終わらない（2026-08-22 便JB） ---
    //
    // 発端: 週タブの通常表示から「主菜」の字が消えた（便IV）ため、撮影スクリプトが
    // `main section, main li` を「主菜」で絞って掴んでいた plan-week-day が**どの日にも
    // 当たらなくなった**。掴めないと `if (await weekDayCard.count())` に入らないので、
    // crop が呼ばれず、警告も失敗も出ないまま**その1枚だけ古い絵が残った**
    // （38枚撮れて plan-week-day だけ更新されない。司令部が実際に撮り直して発覚）。
    //
    // IK-1〜IK-4 は「ページ・カット名・控えの3つがそろっているか」を見るので、
    // **前と同じ名前の古い webp が置いてある**この壊れ方は素通りする。
    // ここでは撮影スクリプトの**書き方そのもの**を掃く:
    //   JB-1 … 掴めなかったときに黙って飛ぶ形（`if (…count()) { crop(…) }` で else も
    //          missShot も無いもの）が1つも無い
    //   JB-2 … SHOT_NAMES と、実際に切り出している名前が1対1
    //          （宣言だけして誰も撮らない・宣言していない名前で撮る、のどちらも作らせない）
    const shotLines = shotsRaw.split('\n')
    const CROP_CALL = /\bcrop(?:Range|Rect|PanelTop)?\(\s*page,\s*'([a-z0-9-]+)'/g
    const silentSkips = []
    for (let i = 0; i < shotLines.length; i++) {
      const opened = shotLines[i].match(/^(\s*)if \(.*\.count\(\).*\{\s*$/)
      if (!opened) continue
      const indent = opened[1]
      // if から、else / else if の連鎖の終わりまでを1つの塊として読む
      let end = i + 1
      while (end < shotLines.length) {
        if (shotLines[end].startsWith(`${indent}}`)) {
          if (/^\s*\}\s*else\b/.test(shotLines[end])) {
            end += 1
            continue
          }
          break
        }
        end += 1
      }
      const chain = shotLines.slice(i, Math.min(end + 1, shotLines.length)).join('\n')
      const shotsHere = [...new Set([...chain.matchAll(CROP_CALL)].map((m) => m[1]))]
      if (shotsHere.length === 0) continue
      if (chain.includes('missShot(')) continue
      silentSkips.push(
        `scripts/shots-manual.mjs:${i + 1} 掴めなかったときに ${shotsHere.join('・')} が黙って飛ぶ`,
      )
    }
    eq('JB-1 撮影スクリプトを行で読めている（0行なら見張りが壊れている）', shotLines.length > 100, true)
    eq('JB-1 掴めなかったときにカットが黙って飛ぶ形が1つも無い', silentSkips, [])

    const cropped = [...new Set([...shotsRaw.matchAll(CROP_CALL)].map((m) => m[1]))]
    eq('JB-2 撮影スクリプトが切り出している名前を拾えている（0件なら見張りが壊れている）', cropped.length > 0, true)
    eq('JB-2 宣言したカットは、すべて実際に切り出している', shotNames.filter((n) => !cropped.includes(n)), [])
    eq('JB-2 切り出している名前は、すべて宣言したカット', cropped.filter((n) => !shotNames.includes(n)), [])
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
  //   ・「はかる」「おまかせ」「まるごと」「いちばん」「まったく」「ほとんど」「すでに」は
  //     見張らない … いずれも**このアプリでは、かな書きのほうが多数か唯一**で、
  //     かな書きが慣用の語（便IMの報告に一覧と数を載せた。倒すなら司令部の裁定が要る）
  //   ・「めやす」は**見張る側に移した**（2026-08-25 便KV・司令部裁定）。便IMはこの語も
  //     「かな書きのほうが多数か唯一」として外していたが、**この語だけは事実と違っていた**:
  //     便KVの実測で ja.ts の文言は漢字「目安」16件・かな「めやす」4件（かなは栄養の公的
  //     基準値だけ＝nutritionBalance.guideNote / guideNoteFree / guideSourcePrefix /
  //     guideScopeNote）。同じ語が画面ごとに2つのつづりで出ていたので、規約H-2（意味を担う
  //     語は漢字）どおり漢字へそろえ、下の表に1行足して二度と割れないようにした。
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
      // 2026-08-25 便KV: 栄養の公的基準値だけ「めやす」で残っていたのを漢字へそろえた（規約H-2）
      { anchor: '目安', good: '「目安」', bad: /めやす(?!い)/g },
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
      path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/components/RecipeCard.tsx'),
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
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
    const nutritionMod = await import('../../src/logic/nutrition.ts')
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
  const irRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
  const iuRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
    // 2026-08-25 便KZ で src/pages/mealPlan/ ができたので、下の階層まで走査する
    const iuPageFiles = readdirSync(iuPagesDir, { recursive: true })
      .filter((f) => f.endsWith('.tsx'))
      .sort()
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
    // キッコーマン「ぶり大根」実測: 砂糖が「小さじ1」と「大さじ3」の2行。
    // 2026-08-23 便KE から、**換算できる単位どうし**（小さじ⇄大さじ、g⇄kg）は足して1つにする
    // （買い物メモに「小さじ1・大さじ3」と並んでいても、店で何を買えばよいかが決まらないため）。
    // 換算できない組（本 vs g、個 vs 玉）は今までどおり足さずに並べる＝下の2件で見張る
    const buri = [
      { name: '砂糖', amount: '1', unit: '小さじ' },
      { name: '砂糖', amount: '3', unit: '大さじ' },
    ]
    const built = buildShoppingCandidates([{ id: 1, ingredients: buri }], [])
    eq('IX-3 単位が違う2行は1行にまとめる', built.length, 1)
    eq('IX-3 ぶり大根の砂糖は足して「大さじ3と1/4」(便KE。旧:「小さじ1・大さじ3」)', built[0].amount, '大さじ3と1/4')
    // 成分表に目安量が無い食材は、単位が違えば今までどおり足さずに並べる（勝手な重さを作らない）
    // 例に使う食材は「成分表に単位の目安量を1つも持たないもの」であること。
    // 2026-08-25 便KP: それまで例に使っていた豆苗が「1パック=100g」の目安量を持ったので
    // （実データで1品まるごと野菜量0gになっていたのを直したため）、目安量を持たない鶏ひき肉に替えた。
    // 測っていること自体は変えていない
    const mixed = buildShoppingCandidates(
      [{ id: 1, ingredients: [
        { name: '鶏ひき肉', amount: '1', unit: 'パック' },
        { name: '鶏ひき肉', amount: '100', unit: 'g' },
      ] }],
      [],
    )
    eq('IX-3 目安量が無い食材は単位が違えば足さずに並べる', mixed[0].amount, '1パック・100g')
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
    const ixRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
  const ivLogic = await import('../../src/logic/mealPlan.ts')
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
  // 2026-08-25 便KU: 7日分のカードの下にあった4つを「栄養と食費」「買い物メモ」の2節に
  // まとめたので、節は3つ→5つになった（オーナー原文「買い物メモ、栄養と食費、
  // それぞれでまとめて表示する（ページ頭の設定のように）」）
  eq(
    'IV-1 節はちょうど5つ（表示のしかた・献立を提案・テンプレート・栄養と食費・買い物メモ）',
    Object.keys(WEEK_GROUP_DEFAULT_OPEN).sort(),
    ['auto', 'display', 'nutritionCost', 'shopping', 'template'],
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
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
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
    // 2026-08-25 便KU: 「レシピを見る」はカードそのものが担うようになり、
    // この段のボタンは「レシピを変更」（差し替え）になった
    ['レシピを変更', 'data-testid="slot-change-recipe"'],
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

// ---------- KI-2: 「まとめて献立を入力」の知らせが、読み切れる長さで、嘘を含まないこと ----------
// オーナー原文:
//   「総入れ替え→まとめて献立入力した後のトーストの文が長い上に改行もないので読む前に消える。
//     日の献立は変わらないとでているが、更新されているので不要な文。」
//
// 実装を読んで確かめた結果（2026-08-24 実測）: 日タブの「今日の献立」の「今週の献立の予定」は
// 今日の予定（mealPlans）からその場で組み立てているので、週タブで総入れ替えすると**自動で変わる**。
// 実測でも、押す前「夕食 肉じゃが」→押した後「夕食 鶏ひき肉の豆腐ハンバーグ・きんぴらごぼう」に
// 変わっていた。つまり「自動では変わらない」は事実の逆＝文が嘘だったので、文ごと外す。
// トーストは6秒で自動的に消える（components/Toast.tsx AUTO_DISMISS_MS）ので、その間に
// 読み切れる長さを上限にする。
{
  const TOAST_LIMIT = 40
  eq(
    'KI-2 「日の献立は自動では変わらない」という嘘の知らせが残っていない',
    'fillWeekTodayNotice' in ja.mealPlan,
    false,
  )
  eq(
    'KI-2 同じ場所で出していたもう一方の知らせ（取り込みの内部の話）も残っていない',
    'fillWeekTodayWillImport' in ja.mealPlan,
    false,
  )
  const fillWeekToasts = {
    fillModeReplaceAllDone: ja.mealPlan.fillModeReplaceAllDone,
    fillWeekDone: ja.mealPlan.fillWeekDone,
    fillWeekKeptManual: ja.mealPlan.fillWeekKeptManual,
    fillWeekNoRoom: ja.mealPlan.fillWeekNoRoom,
    fillWeekNoAdded: ja.mealPlan.fillWeekNoAdded,
    fillModeReplaceAllNothing: ja.mealPlan.fillModeReplaceAllNothing,
    lockedSlotNotice: ja.mealPlan.lockedSlotNotice,
  }
  for (const [key, text] of Object.entries(fillWeekToasts)) {
    eq(
      `KI-2 ${key} が${TOAST_LIMIT}字以内（6秒で消えるトーストで読み切れる長さ）`,
      text.replace(/\{[a-z]\}/g, '').length <= TOAST_LIMIT,
      true,
    )
  }
  // 「改行もない」への手当て: 2文以上つながるときは改行でつなぎ、トーストがその改行を出せること
  const mealPlanSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/pages/MealPlanPage.tsx'),
    'utf-8',
  )
  const toastSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/components/Toast.tsx'),
    'utf-8',
  )
  eq('KI-2 前提: 献立の画面を読めている（0字なら見張りが壊れている）', mealPlanSrc.length > 10000, true)
  eq(
    'KI-2 「まとめて献立を入力」の知らせは改行でつなぐ（1行に詰めない）',
    mealPlanSrc.includes("messages.join('\\n')"),
    true,
  )
  eq(
    'KI-2 知らせに足す一文も改行でつなぐ（withNotice）',
    mealPlanSrc.includes('`${text}\\n${notice}`'),
    true,
  )
  eq(
    'KI-2 知らせのつなぎ目に半角スペースが戻っていない（withNotice）',
    mealPlanSrc.includes('`${text} ${notice}`'),
    false,
  )
  eq(
    'KI-2 トーストが改行をそのまま出す（whitespace-pre-line）',
    toastSrc.includes('whitespace-pre-line'),
    true,
  )
}


// ==========================================================================================
// KJ-1〜KJ-3（2026-08-24 便KJ・オーナー書き溜め）
// ==========================================================================================
{
  const kjRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const kjRead = (rel) => readFileSync(path.join(kjRoot, rel), 'utf-8')
  const kjPlanSrc = kjRead('src/pages/MealPlanPage.tsx')
  const kjTypesSrc = kjRead('src/db/types.ts')
  const kjLogSrc = kjRead('src/components/CookedLogDetailModal.tsx')
  eq('KJ 前提: 献立の画面を読めている（0字なら見張りが壊れている）', kjPlanSrc.length > 10000, true)
  eq('KJ 前提: 設定の型を読めている', kjTypesSrc.length > 5000, true)
  eq('KJ 前提: 作った記録の窓を読めている', kjLogSrc.length > 3000, true)

  // ---- KJ-1: 提案の「入れかた」と「調理時間」を、画面を離れても覚えている ----
  //
  // オーナー原文「提案の入れ方が、タブ移動で「空いた枠だけ」に戻る。選択保持して。
  // 総入れ替えだと確認画面も出るので、総入れ替えに気づかない仕組みにはなっていない。」
  // 2026-08-23 の影響範囲テストで見つかった同じ型（「20分以内」が画面を離れると「指定なし」に
  // 戻る）も一緒に直したので、両方をここで見張る。
  // 置き場所は planPurpose・planGenres と同じ「設定」（開くたびに選び直させない）。
  eq(
    'KJ-1 「入れかた」の覚え先が設定にある（planFillMode）',
    kjTypesSrc.includes('planFillMode?:'),
    true,
  )
  eq(
    'KJ-1 「調理時間」を効かせているかの覚え先が設定にある（planQuickOn）',
    kjTypesSrc.includes('planQuickOn?:'),
    true,
  )
  eq(
    'KJ-1 「入れかた」を画面の中だけで持っていない（useState に戻っていない）',
    /useState<'fillEmpty' \| 'replaceAll'>/.test(kjPlanSrc),
    false,
  )
  eq(
    'KJ-1 「調理時間」のON/OFFを画面の中だけで持っていない（useState に戻っていない）',
    /const \[quickOnly, setQuickOnly\] = useState/.test(kjPlanSrc),
    false,
  )
  // 読み替えの規則（未設定・壊れた値でも、必ず非破壊の「空いた枠だけ」から始まる）
  eq('KJ-1 未設定は「空いた枠だけ」（既定は変えない）', normalizePlanFillMode(undefined), 'fillEmpty')
  eq('KJ-1 保存されていれば「総入れ替え」を覚えている', normalizePlanFillMode('replaceAll'), 'replaceAll')
  eq('KJ-1 「空いた枠だけ」も覚えている', normalizePlanFillMode('fillEmpty'), 'fillEmpty')
  eq('KJ-1 知らない値は「空いた枠だけ」に倒す', normalizePlanFillMode('replaceEverything'), 'fillEmpty')
  eq('KJ-1 壊れた値（数値）でも「空いた枠だけ」に倒す', normalizePlanFillMode(3), 'fillEmpty')
  eq('KJ-1 壊れた値（null）でも「空いた枠だけ」に倒す', normalizePlanFillMode(null), 'fillEmpty')
  // 消える側を覚えても、確認の窓は必ず通る（オーナーが安全と判断した根拠）
  eq(
    'KJ-1 総入れ替えは消す前に確認を出す道が残っている（規約F）',
    kjPlanSrc.includes('ja.mealPlan.fillModeReplaceAllConfirmTitle'),
    true,
  )

  // ---- KJ-2: 過ぎた日を畳んだカードの余白 ----
  //
  // オーナー原文「過去に日付は折りたたみ時の枠を一回り細くしてほしい。
  // 一番下が今日の時にスクロールが長い。」
  // 細くするのは**過ぎた日を畳んでいるあいだだけ**（開けば今までどおり）。
  // 押して開く見出しは44px（--tap-min）のままなので、細くしても押せなくならない。
  eq(
    'KJ-2 過ぎた日を畳んでいるあいだは余白を詰める',
    planDayCardPadClass({ folded: true, past: true }),
    'p-[var(--space-sm)]',
  )
  eq(
    'KJ-2 過ぎた日でも開いていれば今までどおりの余白',
    planDayCardPadClass({ folded: false, past: true }),
    'p-[var(--space-md)]',
  )
  eq(
    'KJ-2 先の日は畳んでいても今までどおりの余白（指示は過去の日付だけ）',
    planDayCardPadClass({ folded: true, past: false }),
    'p-[var(--space-md)]',
  )
  eq(
    'KJ-2 先の日を開いているときも今までどおりの余白',
    planDayCardPadClass({ folded: false, past: false }),
    'p-[var(--space-md)]',
  )
  eq(
    'KJ-2 詰めるのは余白だけ＝見出しの押せる高さ(min-h-11=44px)は残っている',
    kjPlanSrc.includes('data-testid="week-day-toggle"') && kjPlanSrc.includes('min-h-11 min-w-40'),
    true,
  )

  // ---- KJ-3: 「作った記録」の窓の作法を、他の窓にそろえる ----
  //
  // オーナー原文「週や月から出る窓の「作った記録」の一番下を「閉じる」にして。
  // 他の窓の一番下が「閉じる」なのにここだけ違うと誤タップしそう。
  // 「レシピを見る」はボタンではなく文字のリンクにして小さく。ばしょも日付横右端あたりに移動。」
  //
  // そろえる先は**同じ場所から開く日の窓**（週・月の日付を押して開くもの）。
  // 窓の一番下の「閉じる」は、その日の窓とまったく同じ見た目にする＝
  // 見た目の値を2か所に書き写さず dialogStyle の1本（DIALOG_CANCEL_BUTTON_CLS）から取る。
  eq(
    'KJ-3 作った記録の窓が、下端の「閉じる」を出している',
    kjLogSrc.includes('data-testid="cooked-detail-close"') && kjLogSrc.includes('ja.common.close'),
    true,
  )
  eq(
    'KJ-3 その「閉じる」の見た目は共通の1本から取る（日の窓と別物にならない）',
    kjLogSrc.includes('DIALOG_CANCEL_BUTTON_CLS'),
    true,
  )
  eq(
    'KJ-3 日の窓の「閉じる」も同じ1本から取っている（そろえた先が書き写しのままにならない）',
    kjPlanSrc.includes('data-testid="day-modal-close"') &&
      kjPlanSrc.includes('className={DIALOG_CANCEL_BUTTON_CLS}'),
    true,
  )
  eq(
    'KJ-3 「レシピを見る」は文字のリンク＝枠線も地色も持たない',
    /data-testid="cooked-detail-open-recipe"[\s\S]{0,400}?className="[^"]*underline[^"]*"/.test(kjLogSrc) &&
      !/data-testid="cooked-detail-open-recipe"[\s\S]{0,400}?className="[^"]*border-edge[^"]*"/.test(kjLogSrc),
    true,
  )
  eq(
    'KJ-3 「レシピを見る」は小さくしても指で押せる（44px＝--tap-min の当たり判定）',
    /data-testid="cooked-detail-open-recipe"[\s\S]{0,400}?min-h-\[var\(--tap-min\)\]/.test(kjLogSrc),
    true,
  )
  eq(
    'KJ-3 「レシピを見る」の行き先は今までどおり（道を消していない）',
    kjLogSrc.includes('to={recipePath}') && kjLogSrc.includes('ja.cookedDetail.openRecipe'),
    true,
  )
  eq(
    'KJ-3 日付の行に検査用の目印があり、その行に「レシピを見る」を並べている',
    kjLogSrc.includes('data-testid="cooked-detail-date"'),
    true,
  )
}

// ---------- 便KV: 「目安」の使いどころ（2026-08-25 オーナー書き溜め・実機確認18）----------
// オーナー原文:
//   「『安全のめやす』→『注意』。安全のめやすは日本語として変です。何度も指摘していますが、
//     「めやす」を多用しすぎです。日本語として変になる場所にもしょっ中使用してくるので
//     指摘するのが面倒です。」
//
// 1か所直して終わりにすると、次に書く人が同じ形でまた足す（現に「何度も」足してきた）。
// 線そのものは CLAUDE.md 規約H に書いた:
//   「目安」は、量・金額・時間など**数で表せるもの**の、おおよその値か、その基準にだけ使う。
//   「◯◯の目安」と書けるのは◯◯が数で表せるときだけ。
// ここでは、その線を2本立てで見張る:
//   KV-1 いま許している使い方を一覧で持ち、**増えても減っても赤**にする
//   KV-2 数で表せない語に「目安」を付ける形そのものを掃く（アプリと利用者が読むページの両方）
// つづりは漢字「目安」にそろえた（2026-08-25 司令部裁定・規約H-2）。かな書き「めやす」は HR-5 が掃くが、
// KV-1・KV-2 は取りこぼしを作らないよう**両方のつづりを同じ語として**数える。
{
  const kvRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const kvRead = (rel) => readFileSync(path.join(kvRoot, rel), 'utf-8')

  // ---- KV-1: ja.ts の文言に出てくる「目安」を、一覧と突き合わせる ----
  // 数えるのは**文言そのもの**だけ（ja を走って値を見るので、コメントは初めから入らない）。
  // 一覧（scripts/data/ja-meyasu-known.json）には1件ずつ
  // 「**何の数**のおおよその値なのか」を書く。書けないものは、そもそも「目安」と呼べない。
  {
    const kvStrings = []
    const kvWalk = (obj, prefix) => {
      for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'string') kvStrings.push({ key: full, value })
        else if (value && typeof value === 'object') kvWalk(value, full)
      }
    }
    kvWalk(ja, '')
    eq('KV-1 ja.ts の文言を読めている（0件なら見張りが壊れている）', kvStrings.length > 1000, true)

    const kvHits = kvStrings
      .filter(({ value }) => value.includes('目安') || value.includes('めやす'))
      .map(({ key }) => key)
    eq('KV-1 「目安」の文言が実在する（0件なら数え方が壊れている）', kvHits.length > 0, true)

    const kvKnown = JSON.parse(kvRead('scripts/data/ja-meyasu-known.json'))
    // 「_」で始まる項目は読み手向けの説明。一覧そのものではない
    const kvAllowed = Object.keys(kvKnown).filter((k) => !k.startsWith('_'))
    eq(
      'KV-1 「目安」が、一覧に無いところに増えていない',
      kvHits.filter((k) => !kvAllowed.includes(k)),
      [],
    )
    eq(
      'KV-1 一覧に、もう「目安」を使っていないものが残っていない（直したら消す）',
      kvAllowed.filter((k) => !kvHits.includes(k)),
      [],
    )
    eq(
      'KV-1 一覧のすべてに、何の数のおおよその値なのかが書いてある',
      kvAllowed.filter((k) => typeof kvKnown[k] !== 'string' || kvKnown[k].length < 10),
      [],
    )
    // オーナーが名指しで直させた言い方。直した先（「注意」）も一緒に確かめる
    eq('KV-1 設定の見出しが「注意」', ja.settings.safetyTitle, '注意')
    eq('KV-1 設定の切り替えが「注意を表示する」', ja.settings.safetyShow, '注意を表示する')
    eq('KV-1 枠の見出しも同じ語（同じものを2つの名前で呼ばない）', ja.safety.title, ja.settings.safetyTitle)
  }

  // ---- KV-2: 数で表せないものに「目安」を付けていない ----
  // 「◯◯が数で表せるか」は機械では決められないので、**実際に事故になった語と、
  // 同じ形で書きたくなる語**を表で持つ。表から語を落とすときは理由を残すこと。
  // 掃く先はアプリの文言（ja.ts）と、利用者が読むページ（public/about/*.html）の両方。
  // オーナーは実機で気づくので、アプリだけ直してページに残る形にしない。
  {
    const KV_NOT_MEASURABLE = ['安全', '品質', '注意', '危険', '衛生', '清潔', 'おいしさ', '使い方']
    // 「安全の目安」「安全のめやす」「安全な目安」のどれでも当たるようにする
    const kvBad = new RegExp(`(${KV_NOT_MEASURABLE.join('|')})[のなにはを]?(目安|めやす)`, 'g')

    const kvTargets = []
    const kvJaValues = []
    const kvWalk2 = (obj, prefix) => {
      for (const [key, value] of Object.entries(obj)) {
        const full = prefix ? `${prefix}.${key}` : key
        if (typeof value === 'string') kvJaValues.push({ where: `ja.ts ${full}`, text: value })
        else if (value && typeof value === 'object') kvWalk2(value, full)
      }
    }
    kvWalk2(ja, '')
    kvTargets.push(...kvJaValues)

    const kvAboutDir = path.join(kvRoot, 'public/about')
    let kvPages = 0
    for (const e of readdirSync(kvAboutDir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const rels = []
      if (e.isDirectory()) {
        if (e.name === 'img') continue
        for (const f of readdirSync(path.join(kvAboutDir, e.name)).filter((f) => f.endsWith('.html')).sort())
          rels.push(`${e.name}/${f}`)
      } else if (e.name.endsWith('.html')) rels.push(e.name)
      for (const rel of rels) {
        kvPages += 1
        // ゼロ幅スペース（BudouX）が挟まっても素通りしないよう、照合の前に外す
        kvTargets.push({ where: `public/about/${rel}`, text: kvRead(`public/about/${rel}`).replace(/​/g, '') })
      }
    }
    eq('KV-2 利用者が読むページを走査できている（0件なら見張りが壊れている）', kvPages > 0, true)
    eq(
      'KV-2 掃く文字を読めている（0なら見張りが壊れている）',
      kvTargets.reduce((n, t) => n + t.text.length, 0) > 100000,
      true,
    )
    // 見張りそのものの自己確認。掃く相手が今は1件も無いので、
    // 「見つからなかった＝合格」に倒れていないかを、当たるはずの形・当たってはいけない形で確かめる
    const kvSelf = (text) => [...text.matchAll(new RegExp(kvBad.source, 'g'))].map((m) => m[0])
    eq('KV-2 自己確認: 「安全の目安」は当たる', kvSelf('安全の目安を表示する'), ['安全の目安'])
    eq('KV-2 自己確認: かな書きの「安全のめやす」も当たる', kvSelf('安全のめやすを表示する'), ['安全のめやす'])
    eq('KV-2 自己確認: 「品質の目安」も当たる', kvSelf('品質の目安です'), ['品質の目安'])
    eq('KV-2 自己確認: 金額・時間・基準値の正しい使い方には当たらない', [
      ...kvSelf('食材の目安価格で自動計算しています'),
      ...kvSelf('目安30分'),
      ...kvSelf('1日分の目安は、野菜350gです。'),
      ...kvSelf('1日分のめやすは、野菜350gです。'),
      ...kvSelf('注意を表示する'),
    ], [])
    const kvViolations = []
    for (const { where, text } of kvTargets)
      for (const m of text.matchAll(kvBad)) kvViolations.push(`${where}: 「${m[0]}」`)
    eq('KV-2 数で表せないものに「目安」を付けた言い方が1つも無い', kvViolations, [])
  }
}


// 便KU: 2026-08-25 オーナー実機（献立の「月」「週」と買い物メモ）
//
//  KU-1 レシピ詳細の「戻る」が、買い物メモから開いたときだけ帰り道を知らなかった
//       （オーナー原文「材料→窓のレシピ→レシピ詳細→戻る→買い物メモの窓まで戻して表示」）
//  KU-2 月タブの日の窓の「作った記録」のカードだけ、出所を持たずに詳細へ移っていた
//       （オーナー原文「窓の記録のレシピからレシピ詳細→戻る→レシピ一覧に戻ってしまうので、
//         直近の画面に戻して。」）
//  KU-3 「作った記録を見る」の位置と高さ
//       （オーナー原文「窓の「作った記録を見る」を右に寄せて」
//         「作った記録のレシピと「作った記録を見る」の縦幅が同じくらいなので、レシピ数が多いと
//          それだけ無駄に縦長になる。〜どっちについているのかわかりづらい」）
//  KU-4 週の編集画面のレシピカードだけ、押してもレシピ詳細に行かなかった
//       （オーナー原文「編集画面、ここだけレシピカードをタップでレシピ詳細に行かない。〜
//         「レシピを見る」→「レシピを変更」」）
//  KU-5 朝昼夕の境目が読めない（地色の差が実測1.04:1・ダーク1.05:1しかない）
//  KU-6 7日分のカードの下の4つを、上の設定と同じ作法で2つの囲みにまとめる
//
// ここは「渡し忘れ」「掴み方」を静的に見張る側。実画面での位置・高さ・コントラストは
// scripts/e2e-smoke.mjs（KU…節）と実測（報告に数字）が受け持つ。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  // 献立の画面は2026-08-25 便KZ（docs/74 第3手）で、画面の本体と src/pages/mealPlan/ の部品に
  // 分かれた（中身は1文字も動かしていない）。記録のカード（CookedLogCard）は DayParts.tsx に
  // あるので、ここは**画面一式**を1つの本文として読む＝分ける前と同じものを見ている
  const kuPlanSrc = [
    'src/pages/MealPlanPage.tsx',
    'src/pages/mealPlan/DayParts.tsx',
    'src/pages/mealPlan/IntakeParts.tsx',
    'src/pages/mealPlan/MonthParts.tsx',
  ]
    .map((rel) => readFileSync(path.join(appRoot, rel), 'utf-8'))
    .join('\n')
  const kuShopSrc = readFileSync(path.join(appRoot, 'src/pages/ShoppingPage.tsx'), 'utf-8')
  const kuDetailSrc = readFileSync(path.join(appRoot, 'src/pages/RecipeDetailPage.tsx'), 'utf-8')
  const kuCss = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')
  const {
    serializeShoppingReturn: kuSer,
    parseShoppingReturn: kuParse,
    SHOPPING_RETURN_KEY: kuKey,
  } = await import('../../src/logic/navMemory.ts')
  const { WEEK_GROUP_DEFAULT_OPEN: kuGroups } = await import('../../src/logic/mealPlan.ts')

  // ---- KU-1: 買い物メモの帰り道（純ロジック） ----
  eq('KU-1 覚えた居場所をそのまま読み戻せる', kuParse(kuSer({
    tab: 'memo', kind: 'memo', name: 'にんじん', scrollY: 812.4,
  })), { tab: 'memo', kind: 'memo', name: 'にんじん', scrollY: 812 })
  eq('KU-1 下書きの窓も同じ形で覚えられる', kuParse(kuSer({
    tab: 'memo', kind: 'draft', name: '豚こま肉', scrollY: 0,
  })), { tab: 'memo', kind: 'draft', name: '豚こま肉', scrollY: 0 })
  eq('KU-1 覚えていない（null）ときは何もしない', kuParse(null), null)
  eq('KU-1 壊れた文字列は無視する', kuParse('{'), null)
  eq('KU-1 知らないタブは無視する（別の画面を勝手に開かない）', kuParse('{"tab":"x","kind":"memo","name":"a","scrollY":0}'), null)
  eq('KU-1 知らない出所は無視する', kuParse('{"tab":"memo","kind":"x","name":"a","scrollY":0}'), null)
  eq('KU-1 食材の名前が空なら窓を開かない', kuParse('{"tab":"memo","kind":"memo","name":"","scrollY":0}'), null)
  eq('KU-1 縦位置が負の値なら無視する', kuParse('{"tab":"memo","kind":"memo","name":"a","scrollY":-1}'), null)
  eq('KU-1 覚え先の鍵は他の画面と衝突しない名前', kuKey, 'shopping:return')
  // 覚えたものを読む側（レシピ詳細の「戻る」）が、買い物メモを出所として知っていること。
  // ここが抜けていたのが今回のバグ＝帰り道を覚えても必ずレシピ一覧へ行っていた
  eq(
    'KU-1 レシピ詳細の「戻る」が買い物メモを出所として知っている',
    /BACK_TO_ORIGIN_FROM\s*=\s*\[[^\]]*'shopping'/.test(kuDetailSrc),
    true,
  )
  eq(
    'KU-1 買い物メモの窓のレシピカードが、出所と帰り道の両方を渡している',
    /RecipeCard[\s\S]{0,700}?linkState=\{SHOPPING_RETURN_LINK_STATE\}[\s\S]{0,200}?onNavigate=\{rememberSourcePopupReturn\}/.test(
      kuShopSrc,
    ),
    true,
  )
  eq(
    'KU-1 覚える縦位置は、窓で固定される前の値を読む（窓が開いていると window.scrollY は0）',
    kuShopSrc.includes('scrollY: lockedScrollY()'),
    true,
  )
  eq(
    'KU-1 窓を開き直すのは買い物メモが端末から届いてから（禁じ手⑤）',
    /if \(recipes == null\) return[\s\S]{0,400}?if \(shoppingItems == null\) return/.test(kuShopSrc),
    true,
  )

  // ---- KU-2: 月タブの日の窓の「作った記録」からの帰り道 ----
  // 同じ窓の中の「レシピを見る」（slot-open-recipe → 便KUで slot-change-recipe に役割が移った）
  // とまったく同じ帰り道に乗っていること。**渡し忘れ**が今回のバグそのものなので、
  // 「CookedLogCard に linkState と onNavigate が両方付いている」を見る
  const kuMonthLogCard = (() => {
    const at = kuPlanSrc.indexOf('dayModalLogs.map(')
    if (at < 0) return ''
    return kuPlanSrc.slice(at, at + 2200)
  })()
  eq('KU-2 前提: 月タブの日の窓の記録カードを掴めた', kuMonthLogCard.includes('<CookedLogCard'), true)
  eq(
    'KU-2 月タブの日の窓の記録カードが、レシピ詳細へ出所を渡している',
    kuMonthLogCard.includes('linkState={logDetailLinkState}'),
    true,
  )
  eq(
    'KU-2 その帰り道は「月・縦位置・開いていた日の窓」を覚えるほうを通る',
    kuMonthLogCard.includes('onNavigate={rememberLogDetailReturn}'),
    true,
  )
  eq(
    'KU-2 覚える中身に「開いていた日の窓」が入っている（窓ごと開き直せる）',
    /rememberMonthReturn[\s\S]{0,400}?openDate: dayModalDate/.test(kuPlanSrc),
    true,
  )

  // ---- KU-3: 「作った記録を見る」の位置と高さ ----
  const kuOpenDetailTag = (() => {
    const at = kuPlanSrc.indexOf('data-testid="cooked-log-open-detail"')
    if (at < 0) return ''
    const start = kuPlanSrc.lastIndexOf('<', at)
    const end = kuPlanSrc.indexOf('>', at)
    return start < 0 || end < 0 ? '' : kuPlanSrc.slice(start, end + 1)
  })()
  eq('KU-3 前提: 「作った記録を見る」に検査用の目印がある', kuOpenDetailTag !== '', true)
  eq(
    'KU-3 「作った記録を見る」の行は右端に寄せる（左に48px空けて置かない）',
    /justify-end/.test(
      kuPlanSrc.slice(
        Math.max(0, kuPlanSrc.indexOf('data-testid="cooked-log-open-detail"') - 600),
        kuPlanSrc.indexOf('data-testid="cooked-log-open-detail"'),
      ),
    ),
    true,
  )
  eq(
    'KU-3 高さは持たせず、当たり判定だけ44px（器 .tap-target）＝カードと同じ縦幅にしない',
    kuOpenDetailTag.includes('tap-target') && !/min-h-11/.test(kuOpenDetailTag),
    true,
  )
  eq(
    'KU-3 記録どうしの間（12px）は、1件の中（2px）より広い＝どの記録の入口かが距離で読める',
    kuPlanSrc.includes('<ul className="mt-1 space-y-3">') &&
      /className="mt-0\.5 flex flex-wrap items-center justify-end gap-3"/.test(kuPlanSrc),
    true,
  )

  // ---- KU-4: 編集モードのカードもレシピ詳細へ ----
  const kuEditCard = (() => {
    const at = kuPlanSrc.indexOf('thumbTestId="row-thumb"')
    if (at < 0) return ''
    const start = kuPlanSrc.lastIndexOf('<RecipeCard', at)
    return start < 0 ? '' : kuPlanSrc.slice(start, at)
  })()
  eq('KU-4 前提: 編集モードの1品カードを掴めた', kuEditCard !== '', true)
  eq(
    'KU-4 編集モードでもカードの押下はレシピ詳細（他のレシピカードと同じ行き先）',
    kuEditCard.includes('linkState={logDetailLinkState}') &&
      kuEditCard.includes('onNavigate={rememberLogDetailReturn}'),
    true,
  )
  eq(
    'KU-4 カードの押下に差し替えを割り当てていない（同じ押しどころに2つの役割を持たせない）',
    !kuEditCard.includes('onSelect='),
    true,
  )
  eq(
    'KU-4 差し替えは名前の付いたボタンが持つ（道を消していない）',
    kuPlanSrc.includes('data-testid="slot-change-recipe"') &&
      kuPlanSrc.includes('{ja.mealPlan.changeRecipe}'),
    true,
  )
  eq(
    'KU-4 その名前は「レシピを変更」（オーナー指示の字義どおり・規約B）',
    ja.mealPlan.changeRecipe,
    'レシピを変更',
  )
  eq(
    'KU-4 「レシピを見る」の文言は編集モードから消えている（カードがその役割を持つため）',
    !Object.prototype.hasOwnProperty.call(ja.mealPlan, 'openRecipe'),
    true,
  )
  eq(
    'KU-4 鍵の掛かった食事では差し替えを押せなくする（読むことは止めない）',
    /data-testid="slot-change-recipe"[\s\S]{0,300}?disabled=\{locked\}/.test(kuPlanSrc),
    true,
  )

  // ---- KU-5: 朝昼夕の境目 ----
  // 地色の差（実測 ライト1.04:1・ダーク1.05:1）に見分けを頼るのをやめ、境目を線で引く。
  // 使う線は便JEが「3:1を5テーマとも超える」ことを測って作った --border-card
  eq(
    'KU-5 食事の枠の囲みは、面との差が3:1を超える線（--border-card）を使う',
    !/borderColor: slotLocked \? 'var\(--accent\)' : 'var\(--border\)'/.test(kuPlanSrc) &&
      (kuPlanSrc.match(/borderColor: slotLocked \? 'var\(--accent\)' : 'var\(--border-card\)'/g) ?? [])
        .length === 2,
    true,
  )
  eq(
    'KU-5 その線の色はトークンの混色のまま＝5テーマとも自動で追従する',
    /--border-card:\s*color-mix\(in oklab, var\(--text\) 50%, var\(--border\)\)/.test(kuCss),
    true,
  )
  eq(
    'KU-5 食事どうしの間（16px）は、1品と1品の間（16px）以上に取る＝距離でも切れ目が読める',
    (kuPlanSrc.match(/space-y-\[var\(--space-md\)\]>?/g) ?? []).length >= 2,
    true,
  )
  eq(
    'KU-5 通常表示と編集モードで見分け方を変えない（同じ線・同じ地色）',
    (kuPlanSrc.match(/borderLeftColor: SLOT_TONE\[slot\]\.bar/g) ?? []).length === 2,
    true,
  )

  // ---- KU-6: 7日分の下を2つの囲みにまとめる ----
  eq(
    'KU-6 増えた節の既定は上の3つと同じ「畳んだ状態」',
    [kuGroups.nutritionCost, kuGroups.shopping],
    [false, false],
  )
  eq(
    'KU-6 2つの節はページ頭の設定と同じ1枚の面（.setup-panel）に入る',
    /className="setup-panel[^"]*">[\s\S]{0,900}?'nutritionCost'/.test(kuPlanSrc) &&
      /'shopping',[\s\S]{0,1400}?<\/section>\n\n      <\/div>/.test(kuPlanSrc),
    true,
  )
  eq(
    'KU-6 節の見出しは上の3つとまったく同じ部品から作る（見出しを2通り作らない）',
    kuPlanSrc.includes("renderWeekGroupHeader(\n          'nutritionCost'") ||
      /renderWeekGroupHeader\([\s\S]{0,40}'nutritionCost'/.test(kuPlanSrc),
    true,
  )
  eq(
    'KU-6 「買い物メモを作る」は折りたたみの外＝畳んでも押すものが画面から消えない',
    // 範囲えらび（renderShopRange＝中身ごと Collapse）を閉じたあとにボタンが並ぶ形かを見る
    /\{renderShopRange\(\)\}\s*<button\s+type="button"\s+onClick=\{goShopping\}/.test(kuPlanSrc) &&
      /<Collapse open=\{weekGroupOpen\.shopping\}>/.test(kuPlanSrc),
    true,
  )
  eq(
    'KU-6 いま何を対象にしているかは畳んでいても読める（要約が見出しの横に出る）',
    /renderShopRangeSummary\(\)/.test(kuPlanSrc) &&
      kuPlanSrc.includes('data-testid="shop-range-summary"'),
    true,
  )
  eq(
    'KU-6 概算食費に入れ子の折りたたみを作らない（開くのに2回押させない）',
    !kuPlanSrc.includes('weekCostOpen'),
    true,
  )
  eq(
    'KU-6 節の名前は画面に出ている呼び名にそろえる',
    [ja.mealPlan.weekGroupShoppingTitle, ja.mealPlan.weekGroupNutritionCostTitle],
    ['買い物メモ', '栄養と食費'],
  )
}

// ==========================================================================================
// 便KW・②: みそを、種類ごとに価格も塩分も正しく扱う
// ==========================================================================================
// オーナー原文（2026-08-25 夜・申し送り3）:
//   「味噌は種類で価格も塩分量も異なります。分けて扱うならどちらも対応してください。」
//
// 直す前の実測（scratchpad/miso-probe）: 成分表は米みその3種＋減塩みその**4件**しかなく、
// 「だし入りみそ」「麦みそ」「八丁味噌」「西京みそ」は**栄養も価格も解決せず、材料が丸ごと
// 計算から落ちていた**（＝塩分が少なく出る）。さらに「米みそ」は価格側の前方一致で
// 「米 60円/1合」＝生の米の値段に当たっていた。
{
  const kwIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const { matchNutritionFood: kwFood } = await import('../../src/logic/nutrition.ts')
  const kwId = (name) => kwFood(name)?.id ?? null
  const kwSalt = (name) => kwFood(name)?.per100g.saltG ?? null
  const kwYen = (name, amount, unit) =>
    estimateIngredientYen({ name, amount, unit }, kwIndex)?.yen ?? null

  // --- KW-2: 八訂に収載のあるみそは、種類ごとに別の食品として持つ ---
  eq('KW-2 米みそ 淡色辛みそ（代表の「みそ」）', kwId('みそ'), '17045')
  eq('KW-2 米みそ 甘みそ（白みそ）', kwId('白みそ'), '17044')
  eq('KW-2 米みそ 赤色辛みそ（赤みそ）', kwId('赤みそ'), '17046')
  eq('KW-2 米みそ だし入りみそ', kwId('だし入りみそ'), '17120')
  eq('KW-2 麦みそ', kwId('麦みそ'), '17047')
  eq('KW-2 豆みそ（八丁味噌）', kwId('八丁味噌'), '17048')
  eq('KW-2 減塩みそ', kwId('減塩みそ'), '17119')
  // 種類ごとに食塩相当量が違う（＝1つで代表させると外れる）。値は八訂そのまま
  eq('KW-2 食塩相当量は種類ごとに違う（八訂の値そのまま・g/100g）', [
    kwSalt('白みそ'), kwSalt('減塩みそ'), kwSalt('麦みそ'), kwSalt('豆みそ'),
    kwSalt('だし入りみそ'), kwSalt('みそ'), kwSalt('赤みそ'),
  ], [6.1, 10.7, 10.7, 10.9, 11.9, 12.4, 13])
  eq('KW-2 いちばん薄い白みそと、いちばん濃い赤みそで2倍以上ひらく', kwSalt('赤みそ') / kwSalt('白みそ') > 2, true)
  // 大さじ・小さじの重さは、みそ類すべてで同じ値をそのまま使う（新しい重さを作っていない）
  eq('KW-2 みそ類の大さじは全部同じ重さ', [
    convertToGrams(1, '大さじ', kwFood('だし入りみそ') ?? {}),
    convertToGrams(1, '大さじ', kwFood('麦みそ') ?? {}),
    convertToGrams(1, '大さじ', kwFood('豆みそ') ?? {}),
  ], [
    convertToGrams(1, '大さじ', kwFood('みそ') ?? {}),
    convertToGrams(1, '大さじ', kwFood('みそ') ?? {}),
    convertToGrams(1, '大さじ', kwFood('みそ') ?? {}),
  ])

  // --- KW-3: 書き方のちがいが、同じ種類に寄る（実測した16通り） ---
  eq('KW-3 漢字・かなのちがいは同じ種類に寄る', [
    kwId('味噌'), kwId('赤味噌'), kwId('白味噌'), kwId('だし入り味噌'), kwId('出汁入りみそ'),
    kwId('麦味噌'), kwId('豆味噌'), kwId('八丁みそ'), kwId('減塩味噌'),
  ], ['17045', '17046', '17044', '17120', '17120', '17047', '17048', '17048', '17119'])
  eq('KW-3 「合わせみそ」「信州みそ」は代表の淡色辛みそに寄る', [
    kwId('合わせみそ'), kwId('合わせ味噌'), kwId('信州みそ'),
  ], ['17045', '17045', '17045'])
  eq('KW-3 「西京みそ」は白みそ（甘みそ）に寄る＝同梱レシピの西京焼きと同じ扱い', [
    kwId('西京みそ'), kwId('西京味噌'),
  ], ['17044', '17044'])
  eq('KW-3 「米みそ」は八訂の分類名なので代表の淡色辛みそに寄る', kwId('米みそ'), '17045')
  // 根拠が書けないものは足さない（「分からない」と出すほうが正しい）
  eq('KW-3 「赤だし」は足していない（豆みそと米みその調合で、八訂に収載が無い）', [
    kwFood('赤だし'), kwFood('赤だしみそ'),
  ], [null, null])

  // --- KW-4: 価格の誤爆（前方一致で別の食材の値段に当たる）を塞ぐ ---
  // 直す前: 「米みそ 100g」→ 40円（米 60円/1合の値段）。成分表に「米みそ」が無いあいだは
  // priceEstimate の isSameNutritionFood が前方一致を通してしまうため
  eq('KW-4 「米みそ」に米の値段が当たらない', kwYen('米みそ', '1', '大さじ'), kwYen('みそ', '1', '大さじ'))
  eq('KW-4 「米みそ 100g」も米の値段（40円）ではない', kwYen('米みそ', '100', 'g') !== 40, true)
  eq('KW-4 「米」そのものは今までどおり', kwYen('米', '1', '合'), 60)

  // --- KW-5: 価格も種類ごとに引ける（1件ずつ実売を調べ直した結果。根拠は priceDefaults.ts のコメント） ---
  // 容量をそろえて測り直すと、家庭用の750gカップで売っている種類（基本・だし入り・赤・減塩・麦）は
  // どれも500〜600円/kgの同じ帯で、種類による差は出ない。**はっきり違うのは豆みそ（八丁味噌）だけ**
  // ＝家庭用に750g規格が無く、300g前後の袋でしか買えないため
  eq('KW-5 750gカップで売っている種類は、みなじ同じ帯（大さじ1で11円）', [
    kwYen('みそ', '1', '大さじ'), kwYen('だし入りみそ', '1', '大さじ'),
    kwYen('赤みそ', '1', '大さじ'), kwYen('減塩みそ', '1', '大さじ'),
    kwYen('麦みそ', '1', '大さじ'),
  ], [11, 11, 11, 11, 11])
  eq('KW-5 豆みそ（八丁味噌）だけは明確に高い（300g袋でしか買えない）', kwYen('豆みそ', '1', '大さじ'), 30)
  eq('KW-5 八丁味噌の書き方ちがいも同じ値段に寄る', [
    kwYen('八丁味噌', '1', '大さじ'), kwYen('八丁みそ', '1', '大さじ'),
  ], [30, 30])
  eq('KW-5 豆みそは基本のみその3倍近い（種類で価格が違ういちばん大きい例）', kwYen('豆みそ', '1', '大さじ') / kwYen('みそ', '1', '大さじ') > 2.5, true)
  // 2026-08-25 便KX: 15→13円（司令部裁定「帯の中へ入れる」。便KWが同じ測り方でそろえて測り直したら
  // 500g帯の実売は597〜798円/kg＝10.8〜14.4円/大さじ1で、15円＝833円/kgは帯の外だった。
  // 帯の中央12.6円を四捨五入して13円）。**基本のみそ(11円)より高い**という関係は変わらない
  eq('KW-5 白みそは基本より高いまま（値は便KXで実測の帯の中へ）', [
    kwYen('白みそ', '1', '大さじ'), kwYen('白みそ', '1', '大さじ') > kwYen('みそ', '1', '大さじ'),
  ], [13, true])
  eq('KW-5 「西京みそ」も白みその値段で引ける', kwYen('西京みそ', '1', '大さじ'), kwYen('白みそ', '1', '大さじ'))
  // 版番号を上げないと、新しい行が既存の端末に届かない
  eq('KW-5 価格マスタの版番号を上げてある', PRICE_DEFAULTS_VERSION_FOR_JG >= 14, true)

  // --- KW-6: 同梱109品への影響（数えたうえで、変わらないことを見張る） ---
  // 109品で使っているみそは9件/9品。書き方は便KWの時点で「味噌」3件・「みそ」4件・「白みそ」2件と
  // 割れていたが、**2026-08-25 便KX で材料名・手順本文とも「みそ」にそろえた**（規約H-2。
  // 「噌」は常用漢字表に無いので、公用文の作法どおり かなで書く。価格マスタ・成分表・八訂も「みそ」）。
  // 料理名（豆腐とわかめの味噌汁・さばの味噌煮・なめこと豆腐の味噌汁）は**据え置き**——
  // 料理名は同梱レシピの印そのもの（logic/recipeUid.ts の `starter:<料理名>`）で、
  // 変えると作った記録の結び直しが切れる。「味噌汁」「味噌煮」は料理名として定着した書き方でもある
  eq('KW-6 同梱レシピが使うみその書き方は2通りだけ（便KXで「味噌」を「みそ」へ統一）', (() => {
    const names = new Set()
    for (const r of starterDefs) {
      for (const ing of r.ingredients ?? []) {
        if (/みそ|味噌/.test(ing.name) && !/煮缶|さば|サバ/.test(ing.name)) names.add(ing.name)
      }
    }
    return [...names].sort()
  })(), ['みそ', '白みそ'])
  // 「味噌」と書いた利用者のレシピは今までどおり同じ食品・同じ値段に解決する
  // （logic/ingredientReadings.ts の「味噌→みそ」はそのまま残してある）。
  // 白みそ大さじ3が45円→39円になったのは便KXの値の見直し（上のKW-5）
  eq('KW-6 「味噌」と書いても同じ食品・同じ値段のまま', [
    kwId('みそ'), kwId('味噌'), kwId('白みそ'),
    kwYen('みそ', '2', '大さじ'), kwYen('味噌', '2', '大さじ'), kwYen('白みそ', '3', '大さじ'),
  ], ['17045', '17045', '17044', 22, 22, 39])
}

// ============================================================================
// KX: 価格マスタの「前方一致」が別の食材に誤爆する（2026-08-25 便KX）
// ============================================================================
// 【何が起きていたか】材料名がマスタ項目名で**始まる**だけで価格を当てていた。
// 日本語の複合語は主要語が末尾にあるので、これは向きが逆で、先頭がたまたま一致した
// 別の食材に当たる。便KWの実測: 「ねぎ味噌」→ねぎ100円/1本 ／「みそ汁の素」→みそ11円/大さじ1。
//
// 【全数を数えた】同梱109品の全材料名＋価格マスタ全項目＋成分表の全別名に、
// 八訂の全収載食品名(2,538品)の語を足した**2,235件**を1つずつ当てて、当たり方を数えた:
//   完全一致 301 ／ 成分表・飾り語経由 322 ／ 前方一致 90 ／ 当たらない 1,523
// 前方一致90件のうち、成分表で「同じ食品」と確認できたのは49件、**確認できないまま
// 当たっていたのが41件**で、そのうち40件が別の食材だった（塩さば→塩・米粉→米・酢みそ→酢…）。
//
// 【どう直したか】確かめの強い順に並べ替え、**先頭で決めるのはいちばん最後**にした。
// ⑤末尾一致（主要語は末尾）を④成分表経由の後ろに入れ、⑥確認できない前方一致でも
// マスタ側の身元が分からない組は認めない。詳しくは src/logic/priceEstimate.ts。
{
  const kxIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
  const { matchPriceEntry: kxMatch } = await import('../../src/logic/priceEstimate.ts')
  const { isZeroIngredient: kxIsZero } = await import('../../src/logic/nutrition.ts')
  const kxHit = (name) => kxMatch(name, kxIndex)?.normalizedName ?? null
  const kxYen = (name, amount, unit) =>
    estimateIngredientYen({ name, amount, unit }, kxIndex)?.yen ?? null

  // --- KX-1: 実測した誤爆が塞がっている ---
  // 便KWが実機で見つけた2件
  eq('KX-1 「ねぎ味噌」がねぎ(100円/1本)に当たらない', kxHit('ねぎ味噌') !== 'ねぎ', true)
  eq('KX-1 「ねぎみそ」も同じ', kxHit('ねぎみそ') !== 'ねぎ', true)
  eq('KX-1 「みそ汁の素」がみそ(11円/大さじ1)に当たらない', kxHit('みそ汁の素') !== 'みそ', true)
  // 八訂の食品名で全数を洗ったときに出た同じ型の誤爆（塩・米・酢・さば・鮭・ぶり）
  eq('KX-1 「塩◯◯」が塩(1円/小さじ1)に当たらない', [
    kxHit('塩さば'), kxHit('塩辛'), kxHit('塩麹'), kxHit('塩豆'), kxHit('塩納豆'),
  ].filter((x) => x === '塩'), [])
  eq('KX-1 「米◯◯」が米(60円/1合)に当たらない', [
    kxHit('米粉'), kxHit('米粉パン'), kxHit('米粉めん'), kxHit('米菓'), kxHit('米粒麦'),
  ].filter((x) => x === '米'), [])
  eq('KX-1 「酢◯◯」が酢(340円/1L)に当たらない', [
    kxHit('酢みそ'), kxHit('酢豚'), kxHit('酢漬'),
  ].filter((x) => x === '酢'), [])
  eq('KX-1 「さば節」「サケ節」が切り身の値段に当たらない', [kxHit('さば節'), kxHit('サケ節')], [null, null])
  eq('KX-1 「みそ煮」「みそ漬」「みそ味」がみその値段に当たらない', [
    kxHit('みそ煮'), kxHit('みそ漬'), kxHit('みそ味'),
  ].filter((x) => x === 'みそ'), [])
  // 【まだ残っている誤爆】ここに並ぶ10件は、残りが**ひらがなで続く**ので「別の語の始まり」の
  // 見分けが効かず、末尾にも価格マスタの項目名が無いため、いまも先頭の語の値段に当たる
  // （2026-08-25 便KX 実測。八訂の全収載食品名まで広げて数えたときの残り）。
  // どれも八訂の食品名としては実在するが、家庭のレシピの材料名としては出にくいので据え置いた。
  // **直すなら「成分表に足して身元が分かるようにする」**のが筋（便KWが「米みそ」でやったのと同じ）。
  // ここは**増えたら赤・直したらその名前を消す**一覧として置いてある（理由なしに足さないこと）
  eq('KX-1 まだ残っている誤爆は10件だけ（増やさないための見張り）', [
    kxHit('塩だら'), kxHit('塩いわし'), kxHit('塩ます'), kxHit('塩ほっけ'), kxHit('しおがま'),
    kxHit('米ぬか'), kxHit('米こうじ'), kxHit('米でん粉'), kxHit('酒かす'), kxHit('酢の物類'),
  ], ['塩', '塩', '塩', '塩', '塩', '米', '米', '米', '酒', '酢'])
  // マスタ側の身元が成分表で分からない項目への前方一致（ワインとワインビネガーは別物）
  eq('KX-1 ワインビネガー4通りが「赤ワイン 600円/1L」に当たらない', [
    kxHit('ワインビネガー'), kxHit('白ワインビネガー'), kxHit('赤ワインビネガー'), kxHit('ぶどう酢'),
  ].filter((x) => x === '赤ワイン'), [])

  // --- KX-2: 主要語は末尾（塞ぐだけでなく、正しいほうへ当て直す） ---
  eq('KX-2 「ねぎ味噌」はみその値段で引ける', kxYen('ねぎ味噌', '2', '大さじ'), kxYen('みそ', '2', '大さじ'))
  eq('KX-2 「塩さば」はさばの値段で引ける', [kxHit('塩さば'), kxYen('塩さば', '2', '切れ')], ['さば', 200])
  eq('KX-2 「酢みそ」はみその値段で引ける', kxHit('酢みそ'), 'みそ')
  // 実データで「価格なし」だった行が、末尾一致で拾えるようになった（値の桁は合っている）
  eq('KX-2 「田舎みそ 大さじ6」はみその値段（実データ31品）', kxYen('田舎みそ', '6', '大さじ'), 66)
  eq('KX-2 「調味酢 大さじ2」は酢の値段（影響範囲テストB）', kxYen('調味酢', '2', '大さじ'), 10)
  eq('KX-2 「薄口しょうゆ」はしょうゆの値段', kxHit('薄口しょうゆ'), 'しょうゆ')
  // 末尾一致は**成分表経由より後ろ**に置くこと（先に置くと、成分表が知っている種類に届かない）
  eq('KX-2 末尾一致は成分表経由を追い越さない（ねぎの種類が末尾の「ねぎ」に流れない）', [
    kxHit('白ねぎ'), kxHit('細ねぎ'), kxHit('葉ねぎ'), kxHit('新玉ねぎ'),
  ], ['長ねぎ', '小ねぎ', '青ねぎ', '玉ねぎ'])
  eq('KX-2 「ポン酢しょうゆ」は末尾の「しょうゆ」ではなくポン酢のまま', kxHit('ポン酢しょうゆ'), 'ポン酢')
  // 【末尾一致の行き過ぎ】2,235件で当てた84件のうち、末尾がたまたま食材名になっている3件は
  // 別の食べ物なのに当たる（とんぶり＝ホウキギの実／梅びしお＝練り梅／甘酒）。
  // 残り81件は正しい（玄米・もち米→米／清酒・純米酒→酒／米酢・りんご酢→酢／生ハム→ハム／
  // 練りみそ・ごまみそ→みそ／サニーレタス→レタス ほか）ので、3件のために末尾一致はやめない。
  // ここも**増えたら赤**の一覧（例外の名前を並べて塞ぐより、成分表に足して身元を分からせるのが筋）
  eq('KX-2 末尾一致の行き過ぎは3件だけ（増やさないための見張り）', [
    kxHit('とんぶり'), kxHit('梅びしお'), kxHit('甘酒'),
  ], ['ぶり', '塩', '酒'])

  // --- KX-3: 塞ぎすぎていないこと（今まで正しく当たっていた組が残る） ---
  // 同梱109品で前方一致に頼っている材料名
  eq('KX-3 同梱109品の前方一致は今までどおり', [
    kxHit('えのきだけ'), kxHit('大根おろし'), kxHit('豚バラ薄切り肉'), kxHit('豚ロース薄切り肉'),
  ], ['えのき', '大根', '豚バラ薄切り', '豚ロース薄切り'])
  // オーナーの実データにある「書き足し・並記」の書き方（成分表では身元が分からない名前）
  eq('KX-3 書き足し・並記の行も今までどおり拾える', [
    kxHit('ねぎのみじん切り・大さじ2'), kxHit('みそだれ'), kxHit('みそ、水 各'),
  ], ['ねぎ', 'みそ', 'みそ'])
  eq('KX-3 「たまねぎ薄切り」のような書き足しも今までどおり', kxHit('たまねぎ薄切り'), '玉ねぎ')
  // 同梱109品は全材料が価格を引ける（test-price.mjs と同じ条件をここでも見張る）
  eq('KX-3 同梱109品で価格の引けない材料は0件', (() => {
    const miss = []
    for (const r of starterDefs) {
      for (const ing of r.ingredients ?? []) {
        const nm = (ing.name ?? '').trim()
        if (!nm || kxIsZero(nm)) continue
        if (!kxMatch(nm, kxIndex)) miss.push(nm)
      }
    }
    return [...new Set(miss)]
  })(), [])

  // --- KX-4: みそ汁の素（八訂の即席みそ ペーストタイプ 17050。理由は nutrition-foods.mjs） ---
  const { matchNutritionFood: kxFood } = await import('../../src/logic/nutrition.ts')
  eq('KX-4 「みそ汁の素」は即席みそ ペーストタイプ', kxFood('みそ汁の素')?.id, '17050')
  eq('KX-4 書き方のちがいも同じ食品に寄る', [
    kxFood('味噌汁の素')?.id, kxFood('即席みそ')?.id, kxFood('インスタントみそ汁')?.id,
  ], ['17050', '17050', '17050'])
  eq('KX-4 普通の「みそ」は巻き込まれない', kxFood('みそ')?.id, '17045')
  eq('KX-4 1食分は18g（市販品の内容量そのまま）', convertToGrams(1, '食分', kxFood('みそ汁の素') ?? {}), 18)
  eq('KX-4 「1袋」と書いても1食分ぶんの値段', kxYen('みそ汁の素', '1', '袋'), 18)
  eq('KX-4 食塩相当量は八訂の値そのまま（g/100g）', kxFood('みそ汁の素')?.per100g.saltG, 9.6)

  // --- KX-5: 白みそを実測の帯の中へ（司令部裁定。根拠は priceDefaults.ts の行のコメント） ---
  eq('KX-5 白みそは13円/大さじ1（帯597〜798円/kg＝10.8〜14.4円の中央12.6円を四捨五入）',
    kxYen('白みそ', '1', '大さじ'), 13)
  eq('KX-5 同梱の西京焼き2品の白みそ大さじ3は39円（便KXの前は45円）', [
    kxYen('白みそ', '3', '大さじ'), kxYen('西京みそ', '3', '大さじ'),
  ], [39, 39])
  // 基本のみその11円は動かさない（実測は約9.9円だが、差は大さじ1あたり1円で、
  // scripts/test-price.mjs の ORIGINAL_30 のピン留めを外す価値がない。priceDefaults.ts の行も参照）
  eq('KX-5 基本のみそは11円/大さじ1のまま', kxYen('みそ', '1', '大さじ'), 11)
}

// ============================================================================
// KY: 栄養の名寄せの「部分一致」が別の食品に誤爆する（2026-08-25 便KY）
// ============================================================================
// 【何が起きていたか】材料名の**どこかに**成分表の別名（3文字以上）が入っているだけで
// その食品の成分値を当てていた。日本語の複合語は「別の食材名＋食材名」で**別の食べ物**になるので、
// これは栄養の数字（カロリー・食塩相当量・野菜量）が直接狂う。実測で出た形:
//   杏仁豆腐・ごま豆腐 → 木綿豆腐 ／ 玉子豆腐 → 卵 ／ バターピーナッツ → バター
//   りんご酢 → りんご ／ みりん干し → みりん ／ 昆布茶 → 昆布 ／ 魚肉ソーセージ → ウインナー
//
// 【全数を数えた】便KXと同じ数え方（同梱109品の全材料名＋価格マスタ全項目＋成分表の全別名に、
// 八訂の全収載食品名2,538品の語を足した2,414件）を1つずつ当てて、当たり方を数えた:
//   完全一致など 566 ／ **部分一致 260** ／ 当たらない 1,586
// 部分一致260件のうち240件は八訂の食品名なので、当たった食品の100gあたりの値と
// 「その名前が指す八訂の食品」の値を突き合わせて数えられる。**数字が合っていなかったのが90件**。
//
// 【どう直したか】部分一致の**手前に「身元の確かめ」**を入れた。
// 価格側（便KX）は「成分表で身元が分かるか」を確かめに使えたが、栄養側にはその上が無いので、
// **八訂そのもの**を確かめに使う（scripts/build-nutrition.mjs が公式Excelから機械で作る）。
// 便KXの「末尾優先・残りが別の語なら認めない」は栄養側では**使えない**（実測: 末尾優先だけでは
// 90→89件しか減らず、残りが別の語かを見る形にすると誤爆は33件まで減る代わりに、
// 正しく当たっていた119件と**オーナーの実データの38件**が落ちる）。理由は報告に書いた。
{
  const { matchNutritionFood: kyFood, isZeroIngredient: kyZero } = await import('../../src/logic/nutrition.ts')
  const kyId = (name) => kyFood(name)?.id ?? null
  const kyLabel = (name) => kyFood(name)?.label ?? null

  // --- KY-1: 司令部が挙げた誤爆が塞がっている ---
  eq('KY-1 「杏仁豆腐」が木綿豆腐に当たらない（八訂に収載が無いので「分からない」が正しい）',
    kyLabel('杏仁豆腐'), null)
  eq('KY-1 「バターピーナッツ」「ピーナッツバター」がバターに当たらない', [
    kyLabel('バターピーナッツ'), kyLabel('ピーナッツバター'),
  ].filter((x) => x === 'バター'), [])
  // 八訂の全収載食品名で洗ったときに出た同じ型の誤爆（当たっていた値→本当の値）
  eq('KY-1 調味料・加工品が素材に当たらない', [
    kyLabel('りんご酢'),        // りんご(53kcal) ではない。八訂17018 果実酢りんご酢は26kcal
    kyLabel('みりん干し'),      // みりん(241kcal) ではない。八訂10058 いわしみりん干しは330kcal
    kyLabel('昆布茶'),          // 昆布(塩6.6g) ではない。八訂16051 昆布茶は塩51.3g
    kyLabel('ゆずこしょう'),    // こしょう(塩0.1g) ではない。八訂17115 ゆずこしょうは塩25.2g
    kyLabel('とうもろこし油'),  // とうもろこし(89kcal) ではない。八訂14007 は884kcal
    kyLabel('魚肉ソーセージ'),  // ウインナー(319kcal) ではない。八訂10388 は158kcal
    kyLabel('ちくわぶ'),        // ちくわ(魚の練り物) ではない。八訂01069 は小麦粉の製品
    kyLabel('おかひじき'),      // ひじき(海藻・180kcal) ではない。八訂06030 は野菜で16kcal
  ], [null, null, null, null, null, null, null, null])
  eq('KY-1 料理名・菓子が材料に当たらない', [
    kyLabel('麻婆豆腐'), kyLabel('チーズケーキ'), kyLabel('こんにゃくゼリー'), kyLabel('バタースコッチ'),
  ], [null, null, null, null])

  // --- KY-2: 塞ぐだけでなく、値のある食品は成分表に足して正しいほうへ当てる ---
  // （便KXが「みそ汁の素」でやったのと同じ筋。八訂に収載があるものは足す）
  eq('KY-2 「ごま豆腐」は八訂02056（でん粉製品）で、木綿豆腐ではない', [kyId('ごま豆腐'), kyId('胡麻豆腐')], ['02056', '02056'])
  eq('KY-2 「玉子豆腐」は八訂12017（鶏卵）で、卵そのものではない', [
    kyId('玉子豆腐'), kyId('卵豆腐'), kyId('たまご豆腐'),
  ], ['12017', '12017', '12017'])
  eq('KY-2 玉子豆腐のエネルギーは卵の約半分（八訂の値そのまま）', [
    kyFood('玉子豆腐')?.per100g.kcal, kyFood('卵')?.per100g.kcal,
  ], [76, 142])
  eq('KY-2 「じゃがいもでん粉」は片栗粉（同じ八訂02034）', kyId('じゃがいもでん粉'), '02034')

  // --- KY-3: 塞ぎすぎていない（今まで正しく当たっていた書き方が残る） ---
  // 同梱109品・価格マスタ・オーナーの実データにある書き方
  // 「ピザ用チーズ」の当たり先は 2026-08-26 便LB（オーナー裁定「ゴーダチーズで」）で
  // プロセスチーズ(13040・label「チーズ」)から八訂のゴーダ(13036・label「ピザ用チーズ」)へ移した。
  // この節が見ているのは「塞ぎすぎて当たらなくなっていないか」なので、当たり先の名前だけ直す
  // （当たり先そのものの見張りは scripts/tests/nutrition.mjs の LB-1〜LB-3）。
  eq('KY-3 飾り語つきの書き方は今までどおり', [
    kyLabel('白すりごま'), kyLabel('黒いりごま'), kyLabel('紅しょうが'), kyLabel('大根おろし'),
    kyLabel('えのきだけ'), kyLabel('ピザ用チーズ'), kyLabel('冷凍うどん'), kyLabel('粉砂糖'),
  ], ['いりごま', 'いりごま', 'しょうが', '大根', 'えのき', 'ピザ用チーズ', 'うどん', '砂糖'])
  eq('KY-3 書き足し・並記の行も今までどおり', [
    kyLabel('長ねぎのみじん切り'), kyLabel('しょうがのせん切り'), kyLabel('乾燥芽ひじき 約'),
    kyLabel('むき枝豆[冷凍]'), kyLabel('ごま油(仕上げ用) 〜'),
  ], ['長ねぎ', 'しょうが', 'ひじき', '枝豆', 'ごま油'])
  // 八訂の「種類ちがい」は、数字が変わらないものは塞がない（塞ぐ理由が無い）
  eq('KY-3 数字が変わらない種類ちがいは今までどおり当たる', [
    kyLabel('赤たまねぎ'), kyLabel('黒砂糖'), kyLabel('うずら卵'), kyLabel('かに風味かまぼこ'),
    kyLabel('だし巻きたまご'), kyLabel('削り昆布'), kyLabel('ほんしめじ'), kyLabel('葉しょうが'),
  ], ['玉ねぎ', '砂糖', '卵', 'かまぼこ', '卵', '昆布', 'しめじ', 'しょうが'])
  // 同梱109品は全材料が名寄せできる（test-nutrition.mjs のカバー率100%をここでも見張る）
  eq('KY-3 同梱109品で栄養の分からない材料は0件', (() => {
    const miss = []
    for (const r of starterDefs) {
      for (const ing of r.ingredients ?? []) {
        const nm = (ing.name ?? '').trim()
        if (!nm || kyZero(nm)) continue
        if (!kyFood(nm)) miss.push(nm)
      }
    }
    return [...new Set(miss)]
  })(), [])

  // --- KY-4: 身元の確かめ表そのものの見張り ---
  // 表は公式Excelから機械で作る（手書きは「八訂に収載が無い別の食べ物」だけ・理由つき）。
  // **アプリが持っている食品の名前が入ってはいけない**（入ると、その材料が丸ごと計算対象外になる）
  const { NUTRITION_DATA: kyData } = await import('../../src/logic/nutritionData.ts')
  eq('KY-4 身元の確かめ表がある', (kyData.otherFoodNames?.length ?? 0) > 0, true)
  // 【まだ残っている誤爆】2,419件を当て直して残ったのはこの2件だけ（2026-08-25 便KY 実測。
  // 直す前は90件）。どちらも八訂の**味付けの断り書き**（「トマト 加工品 ホール 食塩無添加」
  // 「マヨネーズ 全卵型」）で、アプリが持っている食品の名前の一部でもあるため、
  // 「アプリが持っていない別の食品の名前」という見分けが効かない。
  // 材料名として単独で書かれることはまず無く（実際は「トマト缶（食塩無添加）」のように
  // 括弧書きで、括弧を落とせば正しく当たる）、据え置いた。
  // ここは**増えたら赤・直したらその名前を消す**一覧（理由なしに足さないこと）
  eq('KY-1 まだ残っている誤爆は2件だけ（増やさないための見張り）', [
    kyLabel('食塩無添加'), kyLabel('全卵型'),
  ], ['塩', '卵'])
  eq('KY-1 括弧書きで書けば正しく当たる（実際の書かれ方）', [
    kyLabel('トマト缶（食塩無添加）'), kyLabel('マヨネーズ（全卵型）'),
  ], ['トマト缶', 'マヨネーズ'])

  // --- KY-5: ワインビネガーの目安価格（②。根拠は src/data/priceDefaults.ts の行のコメント） ---
  // 便KXが「ワインビネガー→赤ワイン 600円/1L」の誤爆を塞いだ結果、成分表には八訂17017があるのに
  // 価格マスタに項目が無く「価格が分からない材料」になっていた。家庭用500mlの実売でそろえて足した
  {
    const kyIndex = buildPriceIndex(PRICE_DEFAULTS.map((d) => ({ ...d, isDefault: true })))
    const kyYen = (name, amount, unit) =>
      estimateIngredientYen({ name, amount, unit }, kyIndex)?.yen ?? null
    const kyHit = (name) => matchPriceEntry(name, kyIndex)?.normalizedName ?? null
    eq('KY-5 ワインビネガーに目安価格がある（500円/500ml）', kyYen('ワインビネガー', '2', '大さじ'), 30)
    eq('KY-5 赤・白の書き方も同じ行に当たる（末尾一致）', [
      kyHit('ワインビネガー'), kyHit('白ワインビネガー'), kyHit('赤ワインビネガー'), kyHit('ぶどう酢'),
    ], ['ワインビネガー', 'ワインビネガー', 'ワインビネガー', 'ワインビネガー'])
    eq('KY-5 「赤ワイン」そのものは巻き込まれない（600円/1Lのまま）', [
      kyHit('赤ワイン'), kyYen('赤ワイン', '100', 'ml'),
    ], ['赤ワイン', 60])
    eq('KY-5 普通の酢は今までどおり（340円/1L）', [kyHit('酢'), kyYen('酢', '2', '大さじ')], ['酢', 10])
    // 版番号を上げないと、新しい行が既存の端末に届かない
    eq('KY-5 価格マスタの版番号を上げてある', PRICE_DEFAULTS_VERSION_FOR_JG >= 16, true)
  }

  eq('KY-4 アプリが持っている食品の別名は表に入っていない', (() => {
    const set = new Set(kyData.otherFoodNames ?? [])
    const bad = []
    for (const f of kyData.foods) for (const a of f.aliases) if (set.has(toHiragana(a))) bad.push(a)
    return bad
  })(), [])
}

