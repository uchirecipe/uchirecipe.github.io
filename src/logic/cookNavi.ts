import type { Recipe, Step } from '../db/types'
import { findTimeTokens } from './time'
import { ja } from '../i18n/ja'
import {
  APPLIANCE_KEYS,
  applianceCapacity,
  ApplianceSchedule,
  DEFAULT_KITCHEN,
  stepApplianceFor,
  type ApplianceKey,
  type KitchenEquipment,
} from './cookAppliance'

/**
 * 並行調理ナビ（Pro）の中核ロジック。
 *
 * 複数レシピの手順を「1本の段取り」にまとめる。AIは使わず、
 * 決まったルール（動詞辞書＋貪欲法）だけで解くので原価ゼロ・完全オフラインで動く。
 *
 * 手順の分類:
 *   - 「待ち系」= 煮る・蒸し焼き・グリル・蒸す・漬ける・炊く・冷ます・寝かせる 等の
 *      “その間は手が空く”動詞を含み、かつ minutes（待ち分数）が設定されている手順
 *   - 「手作業系」= それ以外（切る・こねる・炒める・揚げる・素の「焼く」など、
 *      手を動かし続ける／目を離せない工程）
 *
 * 段取りの組み立て（04_技術設計の算法どおり）:
 *   1. 各手順を待ち系／手作業系に分類
 *   2. 待ち系は「待ちが長いものから」先に着手する（早く仕掛けるほど並行できる）
 *   3. 待っている隙間に、別レシピの手作業を差し込む
 *   4. 結果を1本の順番（タイムライン）にして表示し、各手順からタイマーを起動できるようにする
 *
 * 現在のスコープ外: 完全な最適化・手動並べ替え・4品以上（呼び出し側で2〜3品に制限する）。
 */

export type StepKind = 'wait' | 'active'

/**
 * 「待ち系」と判定する動詞の辞書。
 * ここに載る語を含み、かつ minutes が設定されている手順だけを「待ち系」とみなす。
 *
 * 設計判断: 炒める・揚げる・素の「焼く」（フライパンで◯分焼く 等）は
 * “時間が書いてあっても手を動かし続ける/目を離せない” 工程なのであえて辞書に入れない
 * （ロードマップが列挙する待ち動詞にも含まれていない）。
 * これにより「3分炒める」「4分揚げる」「5分焼く」は手作業系のままになる。
 * ここで「焼く」を待ち系にすると、フライパンから目を離して他レシピの作業に
 * 差し込むようナビが誘導してしまい、焦げ付き等の事故につながるため（Fable/Codexレビュー）。
 * 一方「蒸し焼き」「グリル」「オーブン」「レンジ」は火を入れたら基本放置でよい調理法なので、
 * 「8分蒸し焼き」「10分グリル」「15分オーブン」などは待ち系として拾う。
 */
export const WAIT_VERB_PATTERNS: RegExp[] = [
  /煮/, // 煮る・煮込む・煮からめる
  /蒸し焼き/, // 蒸し焼き（フタをして基本放置でよい焼き方）
  /グリル/, // グリル（点火後は基本放置）
  /蒸/, // 蒸す・蒸らす・蒸し焼き
  /漬/, // 漬ける・漬け込む
  /炊/, // 炊く
  /茹で|ゆで/, // 茹でる
  /冷ま|冷や|粗熱/, // 冷ます・冷やす・粗熱を取る
  /寝かせ|寝かし|ねかせ/, // 寝かせる
  /休ませ|休ます/, // 休ませる（揚げ物の休ませ 等）
  /浸/, // 浸水・浸す
  // 重しをのせて水切りする（豆腐等）。放置してよい工程。旧実装ではこれを拾う語が無く、
  // /チン/ が「キッチンペーパー」に誤爆したおかげで偶然待ちになっていた（2026-08-08 便EBで判明）
  /水切り|水きり/,
  /さらす|さらし/, // 水にさらす
  /温め|あたため/, // 温める
  /オーブン/, // オーブン
  /トースター/, // トースター（庫内に入れたら手が離れる。2026-08-13 便GA）
  // 電子レンジ。「チン」は単独だと「チンゲン菜」「チンジャオロース」に誤爆するため
  // （実測: 「チンゲン菜の茎を1分炒め」が待ち系に化けていた）、動詞になる形だけを拾う
  /レンジ|電子レンジ|チンす|チンし/,
  /[0-9０-９]+\s*[WＷ]/, // 「600Wで3分加熱」等のレンジ出力ワット数（点火後は基本放置でよい）
  /発酵/, // 発酵
  /なじ|馴染/, // 味をなじませる
  /しみ|染み/, // 味をしみ込ませる
  // そのまま10分おく 等（minutes があるときのみ待ち扱いになる）。
  // **「おいて」「おいた」のて形が抜けていた**（2026-08-15 便GR）。漢字の「置いて」は `置い` で
  // 拾えていたのに、ひらがなだけ「おく／おき」しか無く、
  // 「火を止め、そのまま10分**おいて**味を含ませます」が待ち動詞を1つも持たない手順として
  // **手作業10分**になっていた（利用者が「一番納得いかない」と挙げた手順そのもの）。
  // 「おいしい」に当たらないよう、て形・た形の並びだけを足す（単独の「おい」は入れない）
  /置い|置く|おく|おき|おいて|おいた/,
]

/**
 * 「目を離せない（付きっきり）」と判定する語の辞書（2026-08-08 便EB・オーナー実機報告）。
 *
 * 報告された不具合: 肉巻きおにぎりの「たれを絡めながら照りが出るまで煮からめる」（2分・注意に
 * 「焦げやすいので」）が **待ち**に分類され、その2分の間に別レシピの作業が差し込まれていた。
 * 原因は WAIT_VERB_PATTERNS の /煮/ が「煮からめる」に当たり、minutes:2 があるため待ちが成立
 * していたこと。「煮」の付く工程でも、たれを煮からめる・煮詰める・炒り煮のように
 * **鍋から離れられない**ものがある。
 *
 * ここに載る語が手順本文か注意書き（memo）に1つでもあれば、待ち動詞・待ち分数に関係なく
 * **手作業系（付きっきり）**に倒す。短時間（2分など）でも他レシピの作業を挟ませない。
 *
 * 収録の基準は「その工程の間ずっと手を動かす／鍋から離れられない」と読める語だけ。
 * 「焦げないように水を足すこと」のような**条件つきの注意**（さつまいもの甘辛煮15分・
 * ラタトゥイユ12分など）は対象にしない＝本物の待ちを潰さないため、`焦げやす`（焦げやすい）
 * だけを拾い、`焦げない`／`焦げつき防止`／`焦げにくい` は拾わない。
 */
export const HANDS_ON_PATTERNS: RegExp[] = [
  /煮からめ|煮絡め/, // たれを煮からめる（照りが出るまで鍋につきっきり）
  /煮詰め|煮つめ/, // 煮詰める（詰まると急に焦げる）
  /炒り煮|炒め煮/, // 炒り煮・炒め煮（混ぜ続ける）
  /絶えず/, // 絶えず混ぜながら
  /(?:かき)?混ぜ続け/, // 混ぜ続ける・かき混ぜ続ける
  /(?:ゆす|揺す)りながら/, // フライパンをゆすりながら
  /混ぜながら/, // 混ぜながら煮る・温める
  /(?:から|絡)めながら/, // たれを絡めながら
  /目を離/, // 目を離さない・目を離せない
  /焦げやす/, // 焦げやすいので〜
  /つきっきり|付きっきり/,
  /手を止めず|手を離さ/,
  // 「沸騰直前まで温めたら火を弱める」（冷しゃぶ）は、沸くのを見ていないと成り立たない工程。
  // 「沸かす」の待ちと同じ顔をしているので明示的に付きっきり側へ倒す（2026-08-08 便ED・同梱109品の目視）
  /沸騰直前|煮立つ直前|沸く直前/,
]

/**
 * 待ち動詞の辞書に足りていなかった家庭の言い回し（2026-08-08 便ED・docs/68 打ち手#1(a)）。
 * 「水を沸かす」「乾物をもどす」「解凍する」「冷蔵庫で冷やす」「ふたをして火にかける」は
 * どれも手が空く工程だが、辞書に無いため実測で全部が手作業に落ちていた。
 *
 * WAIT_VERB_PATTERNS 本体に足さず別に持つのは、isHandsOnStep の位置判定
 * （炒め・揚げが待ち動詞より後ろにあるか）の基準を従来のまま動かさないため。
 */
export const EXTRA_WAIT_VERB_PATTERNS: RegExp[] = [
  /沸か|沸騰させ|湯を沸/, // 湯を沸かす
  // 「沸くまで」「沸くのを」＝沸くのを見ている状態（2026-08-13 便GD）。
  // ナビが差し込む「火にかけたまま、沸くのを待つ」を待ちとして読むために足した。
  // 既定分数の表（DEFAULT_WAIT_MINUTES）には載せない＝**時間の書かれていない**
  // 「沸くまで火にかける」等は今までどおり手作業のまま（勝手に鍋から目を離させない）
  /沸くまで|沸くのを/,
  /もどす|もどし|戻す|戻し/, // 乾物をもどす
  /解凍/,
  /冷蔵庫に入れ|冷蔵庫で/,
  /ふたをして|フタをして|蓋をして/, // ふたをして火にかける（多くは放置工程）
]

/**
 * 待ち動詞の字は入っているが、待ち時間ではない名詞（2026-08-08 便ED・docs/68 6-3の×2件）。
 * 「だし汁・しょうゆ・酢・砂糖を混ぜ、漬け汁を作る」は調味液を作る手作業なのに、
 * 「漬」に反応して20分の漬け込みに化けていた。判定の前に伏せ字へ置き換える
 * （位置ルールで文字位置を使うので、**同じ長さ**の伏せ字にして位置をずらさない）。
 *
 * 「オーブンシート」も同じ誤りで、紙を敷くだけの手順が「オーブン15分」に化けていた
 * （フルーツヨーグルトバーク 手順3。同梱109品の目視で判明）。
 *
 * 「しょうゆで味をつける」が**8分の待ち**になっていたのが最悪の例（「しょう**ゆで**」が
 * 「ゆでる」に当たっていた）。ホールドアウト標本で見つかった。
 * ここに載せるのは「その字を含むだけで、待ち時間ではない**名詞**」だけ。
 *
 * 「ゆで汁」は 2026-08-16 便HA で足した取りこぼし。**ゆで上がったあとの湯そのものを指す名詞**で、
 * これから何かをゆでる合図ではない。「ゆで汁はスープに使えるので取っておくとよいです」
 * （ホールドアウト しっとりゆで鶏 手順3）・「ゆで汁を少量加えて揺すり、オイルと乳化させる」
 * （同梱 ペペロンチーノ）のように、**すでに手元にある汁を使う手作業**の中に出てくる。
 * 「ゆで卵」「ゆでうどん」と同じ理由・同じ並び。
 */
const NON_WAIT_NOUN_PATTERN =
  /漬け汁|漬けだれ|漬けタレ|漬けダレ|漬け床|漬物|漬け物|オーブンシート|オーブンペーパー|しょうゆ|つゆ|煮干し|蒸し器|蒸しパン|ゆで卵|ゆでうどん|ゆで麺|ゆで汁|茹で汁|お浸し/g

function maskNonWaitNouns(text: string): string {
  return text.replace(NON_WAIT_NOUN_PATTERN, (m) => '＊'.repeat(m.length))
}

/**
 * 括弧の中の「やってもやらなくてよい」記述（2026-08-11 便FL・実画面から）。
 *
 * 起きていた不具合: `ツナキャベツ丼` 手順1「キャベツをせん切りにする（レンジ600Wで1分半ほど
 * 加熱すると時短になる）。」が **待ち2分**と判定されていた。必ずやる動作は「切る」で、
 * レンジは括弧の中の任意（注意書きにも「生のままでもよい」とある）。括弧の中の語で
 * 待ち動詞・分数・作業の種類が決まると、やらないかもしれない作業がその手順の主役になる。
 *
 * **伏せるのは「任意」と読める合図が入っている括弧だけ**にする。
 * 「(なければオーブンを200度に予熱して10分ほど焼く)」「(両面焼きグリルの場合は…)」のような
 * 言い換え・道具違いの但し書きは、どちらを選んでも加熱すること自体は変わらないので伏せない
 * （伏せると同梱109品で本物の待ちを5件失うことを実測で確認した）。
 */
const OPTIONAL_PAREN_PATTERN =
  /[（(][^）)]*(?:時短|お好み|好みで|好みなら|でもよい|でも良い|してもよい|しなくても|なくても|省略|代用|あれば)[^）)]*[）)]/g

/**
 * 手順の「必ずやる部分」の本文。括弧内の任意の記述を同じ長さの伏せ字に置き換える
 * （位置ルールで文字位置を使うので長さを変えない）。
 *
 * 付きっきり判定（isHandsOnStep）にはあえて使わない。括弧の中に「焦げやすいので」のような
 * 目を離せない合図が書かれていることがあり、そこを伏せると安全側の判定材料が減るため。
 */
export function stepMainText(text: string): string {
  return text.replace(OPTIONAL_PAREN_PATTERN, (m) => '＊'.repeat(m.length))
}

/**
 * その日のうちには終わらない「長い待ち」の言い回し（2026-08-11 便FL・実画面から）。
 *
 * 起きていた不具合: `漬けるだけ味玉` 手順3「冷蔵庫で半日〜一晩漬ける」が、時間の書かれていない
 * 漬け込みの既定分数（20分）を当てられて **待ち20分**になり、全体の見積り37分に入っていた。
 * 「手順に時間の記載がないため、この分数は目安です」と断ってはいるが、半日を20分と数えるのは
 * 目安の範囲を超えている。
 *
 * こうした工程は**手順としては段取りに残したまま、時間の計算からだけ外す**
 * （黙って消すと「なぜ出てこないのか」になる）。画面には長い待ちであることと、
 * 今回の調理では仕上がらないことを添えて出す。
 */
const LONG_REST_PATTERN =
  /半日|一晩|ひと晩|ひとばん|[1１]晩|一昼夜|数時間|翌日|翌朝|一日|[1１]日|数日|一週間|[1１]週間/

/**
 * 数字で書かれた待ちのうち、これ以上は今回の調理に収まらないとみなす分数。
 * 3時間（180分）。同梱109品では `フルーツヨーグルトバーク` の「冷凍庫で3時間以上冷やし固める」
 * だけが当たる（診断 docs/68 で見積りの最悪例＝見積195分/実際10分 として挙がっていた手順）。
 */
const LONG_REST_MINUTES = 180

/** その手順が「今回の調理では終わらない長い待ち」か */
export function isLongRestStep(step: Step): boolean {
  if (LONG_REST_PATTERN.test(stepMainText(step.text))) return true
  const minutes = resolveStepMinutes(step)
  return minutes != null && minutes >= LONG_REST_MINUTES
}

/**
 * 手を動かし続ける調理動詞（炒める・揚げる）。**待ち動詞より後ろに出てきたとき**だけ
 * 付きっきり扱いにする（2026-08-08 便EB）。
 *
 * 位置で判断する理由: 「鍋で鶏肉と野菜を炒め、水を加えて中火で15分煮る」は最後が「煮る」なので
 * 本物の15分の待ち。一方「全体に油がなじむまで炒める」（卯の花）・「えびを漬け汁ごと入れて
 * 炒める」は、待ち動詞（なじ／漬）が先に出ているだけで実体は炒め工程であり、
 * 従来は待ちに化けてフライパンから目を離させていた。
 * 「最後に来る動作がその手順の主役」という単純な規則で両者を分ける。
 */
const HANDS_ON_COOK_PATTERN = /炒め|炒る|揚げ/

/**
 * 手作業の動作（2026-08-08 便ED・docs/68 打ち手#1(b)）。
 * HANDS_ON_COOK_PATTERN（炒め・揚げ）の位置ルールを、手を動かす動作全般に広げるための辞書。
 * これが待ち動詞より後ろに来る手順は、待ち動詞が入っていても実体は手作業
 * （「煮立ったらアクを取る」「粗熱が取れたら殻をむく」）。
 *
 * 「むく／むき」は docs/68 6-3 で見つかった欠落（「粗熱が取れたら殻をむく」が20分の待ちに化けていた）。
 * 「洗う／締める」は同梱109品の目視で見つかった欠落（「茹で上がったら流水で洗い流し、氷水で
 * しっかり締める」が8分の待ちに化け、うどんが伸びる段取りになっていた）。
 * 「水気をきる」型のひらがな表記は docs/68「残る限界」に記録されていた欠落（2026-08-09 便EM）。
 * 「ごぼうを水に5分さらして水気をきります」の末尾が手作業だと読めず、5分の待ちに化けていた。
 * ひらがなの「きる」は単独だと「はりきる」「使いきる」等に当たるので、
 * 水気・湯・油・汁気を落とす言い回しの形だけを拾う。
 */
const ACTION_VERB_PATTERN =
  /炒め|炒る|揚げ|焼く|焼き|焼い|取る|取り|取っ|加え|入れ|混ぜ|溶き|溶い|溶か|絞る|絞り|絞っ|切る|切り|切っ|盛る|盛り|盛っ|かける|かけて|ふる|ふり|返す|返し|のせ|散ら|和え|あえ|つぶ|こね|まぶ|止め|ぬぐ|添え|よそ|包む|巻く|にぎ|ほぐ|むく|むき|洗う|洗い|洗っ|締め|(?:水気|水け|湯|油|汁気|汁け)をき[るりっ]/

/**
 * 手を離してよい加熱器具（2026-08-13 便GA・docs/72 第1段）。
 *
 * 直した不具合（docs/71 R3）: 「魚焼きグリルで15分焼く」が**手作業15分**と判定され、
 * 15分ずっと手がふさがる前提で段取りを組んでいた。原因は位置ルール（ACTION_VERB_PATTERN）が
 * 末尾の「焼く」を手を動かす動作として拾うこと。**手順に分数が書かれていないときだけ**起きるので、
 * 分数欄の埋まっている同梱109品では1件も現れず、利用者が登録したレシピでだけ起きていた。
 *
 * 直し方は「焼く」を待ち動詞にすることではない（フライパンの焼きから目を離させる＝事故になる）。
 * **その手順に放置してよい器具が書かれているとき、その後ろの「焼く」はその器具の加熱そのもの**
 * であって手を動かす動作ではない、と読む。器具の語が無い「フライパンで3分焼く」は従来のまま。
 *
 * 載せるのは「入れて扉・スイッチを閉じたら火加減を見なくてよい」器具だけ
 * （docs/72 §3 が数える4器具のうち、コンロを除いた3つ＋電子レンジ）。
 * 鍋・フライパン・中華鍋は載せない＝コンロの加熱は従来どおり手作業側に倒す。
 */
const UNATTENDED_APPLIANCE_PATTERN = /グリル|オーブン|トースター|レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]/g
/** 上の器具が受け持つ加熱の動詞。器具の語より後ろに出たときだけ、手作業の動作から外す */
const APPLIANCE_HEAT_VERB_PATTERN = /焼く|焼き|焼い|焼け/g

/**
 * 放置してよい器具の加熱動詞を、位置ルールの対象から外す（同じ長さの伏せ字。位置をずらさない）。
 * 効かせる範囲は**器具の語が出てきた文の中だけ**（次の文の「フライパンで焼き色をつける」まで
 * 巻き込まない）。
 */
function maskApplianceHeatVerbs(text: string): string {
  return maskAfterCue(text, UNATTENDED_APPLIANCE_PATTERN, APPLIANCE_HEAT_VERB_PATTERN)
}

/**
 * 合図の語（cue）が出てきた位置から、その文の終わりまでの間にある target を伏せ字にする。
 * 伏せ字は**同じ長さ**にして文字位置をずらさない（位置ルールが文字位置で判断するため）。
 */
function maskAfterCue(text: string, cue: RegExp, target: RegExp): string {
  cue.lastIndex = 0
  let result = text
  let m: RegExpExecArray | null
  while ((m = cue.exec(text)) !== null) {
    const start = m.index
    const dot = result.slice(start).search(SENTENCE_SPLIT_PATTERN)
    const end = dot === -1 ? result.length : start + dot
    result =
      result.slice(0, start) +
      result.slice(start, end).replace(target, (x) => '＊'.repeat(x.length)) +
      result.slice(end)
    if (m.index === cue.lastIndex) cue.lastIndex++
  }
  return result
}

/**
 * 「待ちの最中に一度だけ手を入れる」合図（2026-08-13 便GA・docs/72 第1段）。
 *
 * 直した不具合: 「弱火で25分煮込み、ときどき混ぜながら水分をとばします」（25分の煮込み）と
 * 「そこから60分ゆっくり煮ていきます。途中で上下を返すと色むらがなくなります」（60分の煮込み）が、
 * どちらも手作業と判定されていた。前者は「混ぜながら」を付きっきりの合図として拾ったため、
 * 後者は位置ルールが末尾の「返す」を主役と読んだため。
 *
 * 「ときどき」「途中で」が付く動作は、その加熱を**終わらせる**動作ではなく、
 * 待っている間に一度手を入れるだけの動作なので、どちらの判定にも数えない。
 * 数えないのは下の OCCASIONAL_ACTION_PATTERN の語だけ＝**炒める・揚げる・焼く・切る・盛る**は
 * 「ときどき」が付いても従来どおり手作業として数える（鍋の前を離れる誤りを増やさないため）。
 * 「絶えず」「混ぜ続ける」「煮詰める」「焦げやすい」も従来どおり付きっきりのまま。
 */
const OCCASIONAL_CUE_PATTERN = /途中で|途中に|ときどき|時々|たまに|時折/g
/** 待ちの最中の一手として扱う動作（かき混ぜる・上下を返す・アクを取る） */
const OCCASIONAL_ACTION_PATTERN = /(?:かき)?混ぜ|まぜ|返す|返し|返っ|裏返|アクを取|あくを取/g

function maskOccasionalActions(text: string): string {
  return maskAfterCue(text, OCCASIONAL_CUE_PATTERN, OCCASIONAL_ACTION_PATTERN)
}

/**
 * 利用者が本文に書いた「並行の指示」（2026-08-13 便GB・docs/72 第2段 対象3）。
 *
 * 直した不具合（docs/71 R3）: 手順②「**その間に**☆を全部混ぜ合わせておく」は、手順①の
 * 10分の漬け込みの**中でやれ**と利用者自身が書いた指示なのに、段取りでは9番目・約16分地点
 * （①の待ちがとっくに明けたあと）に置かれていた。R3の言葉では
 * 「私の文章に書いてある並行の指示が、並行調理ナビに一切拾われないのは皮肉です」。
 *
 * 原因は段取りの作りそのもの。**レシピ内の手順は前の手順が終わるまで着手しない**（readyAt）ので、
 * 「その待ちの次の手順」は構造上その待ちの中に置けない。そこで**この合図が付いた手順だけ**を
 * 例外にし、直前の待ちを**仕掛けた時点で**着手できるようにする。
 *
 * 例外の範囲をここまで絞る理由（限界として記録する）:
 *   - 合図があるのは**直前の手順が待ちのときだけ**。合図だけで手順を前へ飛ばさない
 *   - 対象は**手作業の手順だけ**。待ちの手順を重ねると器具の取り合いになる（docs/72 第3段）
 *   - その手順の次からは従来どおり、待ちが明けるまで着手しない
 *
 * 「〜しながら」は合図にしない。実際の本文では「ほぐしながら炒める」「混ぜながら煮る」のように
 * **1つの動作の中の同時**がほとんどで、並行の指示ではない（本体では「混ぜながら」を
 * `HANDS_ON_PATTERNS` の**目を離さない合図**として使っている）。
 */
const PARALLEL_CUE_PATTERN =
  /その間|そのあいだ|している間|しているあいだ|待つ間|待っている間|寝かせている間|焼いている間|煮ている間|漬けている間|ゆでている間|茹でている間|冷ましている間|炊いている間/

/** その手順文が「直前の待ちの中でやれ」という利用者の指示を含むか */
export function hasParallelCue(text: string): boolean {
  return PARALLEL_CUE_PATTERN.test(stepMainText(text ?? ''))
}

/** 短時間の合図。既定分数を当てない（「熱湯でさっとゆでる」を8分の待ちにしない） */
const SHORT_CUE_PATTERN = /さっと|ざっと|軽く|手早く|素早く/

/**
 * 並行の材料にする待ちの下限（分）。2026-08-09 便EM・docs/68「残る限界」の危険側1件。
 *
 * 「にんじんを1分、ほうれん草を30秒ゆでます」は待ち1分と判定され、その1分に別の料理の
 * 手作業が差し込まれていた。1分では鍋の前を離れる余地が無く、離れればゆですぎになる。
 * 秒だけの待ち（30秒ゆでる）を既に手作業へ倒しているのと同じ理由で、1分もここに含める。
 * 2分以上は従来どおり待ちのまま（味噌汁の「2分温める」等）。
 */
const MIN_PARALLEL_WAIT_MINUTES = 2

/** 「〜ておく／〜ておき／〜ておいて」＝先に済ませる言い方であって放置時間ではない */
const TE_OKU_PATTERN = /[てで](?:お|置)[くきい]/

/**
 * 麺類（2026-08-08 便ED・ホールドアウト標本）。
 * 「そうめんをゆでる」に既定の8分を当てると、実際は1〜2分で吹きこぼれる工程から目を離させる。
 * 麺のゆで時間は袋の表示どおりで短いので、**時間が書かれていない麺のゆでには既定分数を当てない**
 * （本文に「8分ゆでる」と書いてあればそれは従来どおり使う）。
 */
const NOODLE_PATTERN = /そうめん|素麺|そば|うどん|パスタ|スパゲ|マカロニ|中華麺|ラーメン|春雨|ビーフン|フォー/

/**
 * 時間が書かれていない待ち工程に当てる既定の分数（2026-08-08 便ED・docs/68 打ち手#1(a)）。
 *
 * **時間の読める調理法だけを載せる。汎用のフォールバック（該当なし＝10分）は置かない。**
 * 置くと「油をなじませる」「たれを作っておく」まで待ちに化ける（診断で実測済み）。
 * 上から順に見て最初に当たったものを使う。
 */
const DEFAULT_WAIT_MINUTES: { pattern: RegExp; minutes: number; skipForNoodles?: boolean }[] = [
  { pattern: /解凍/, minutes: 30 },
  { pattern: /炊/, minutes: 30 },
  { pattern: /発酵/, minutes: 40 },
  { pattern: /漬|浸/, minutes: 20 },
  { pattern: /もどす|もどし|戻す|戻し/, minutes: 15 },
  { pattern: /オーブン|グリル/, minutes: 15 },
  // トースターはオーブン・グリルより短い（食パン・グラタンの焼き色付けが中心）。
  // 待ち分数を長く見積もるほど、その中に他の品の作業を詰め込むので、短い側に置く（2026-08-13 便GA）
  { pattern: /トースター/, minutes: 5 },
  { pattern: /冷蔵庫/, minutes: 30 },
  // 「煮立てる」は沸かすのと同じで、煮込みほど長くない（同梱109品の目視。10分は長すぎた）
  { pattern: /煮立て/, minutes: 5 },
  { pattern: /煮/, minutes: 10 },
  { pattern: /茹で|ゆで/, minutes: 8, skipForNoodles: true },
  { pattern: /蒸/, minutes: 8 },
  { pattern: /ふたをして|フタをして|蓋をして/, minutes: 8 },
  { pattern: /沸か|沸騰させ/, minutes: 5 },
  { pattern: /レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]/, minutes: 3 },
  // **「冷ます・粗熱を取る」は入れない**（2026-08-15 便GR・実測して見送った）。
  // 「火を止めて、そのまま冷ましながら味を含ませます」を10分の待ちとして拾えるようになる代わりに、
  // 冷ます工程が長い待ちとして段取りの先頭へ回り、**N2（温かい品と汁物の放置）が53分→69分・
  // N1（完成の揃い）が33.7%→37.5%** に悪化した（N4は+3.6pt）。
  // 冷ます時間は動詞から読めない（5分のことも1時間のこともある）ので、
  // 「どれだけ手を離してよいか分からないものは待ちにしない」という上の歯止めをそのまま守る。
]

/**
 * text 中で pattern 群のどれかが最後に**終わる**位置（無ければ -1）。
 *
 * 位置ルールで待ち動詞の位置を測るときは、始まりではなく終わりで比べる（2026-08-08 便ED）。
 * 「ふたをして中火で15分蒸し焼きにします」は、待ち動詞「蒸し焼き」の中に手作業動詞「焼き」が
 * 入っているため、始まりで比べると手作業が後ろに来て待ちが消えてしまう（ホールドアウト標本で判明）。
 */
function lastEndOfPatterns(text: string, patterns: readonly RegExp[]): number {
  let last = -1
  for (const re of patterns) {
    const global = new RegExp(re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = global.exec(text)) !== null) {
      last = Math.max(last, m.index + m[0].length)
      if (m.index === global.lastIndex) global.lastIndex++
    }
  }
  return last
}

/** text 中で pattern 群のどれかが**最初に**現れる位置（無ければ -1） */
function firstIndexOfPatterns(text: string, patterns: readonly RegExp[]): number {
  let first = -1
  for (const re of patterns) {
    const m = new RegExp(re.source).exec(text)
    if (m && (first === -1 || m.index < first)) first = m.index
  }
  return first
}

/** text 中で pattern 群のどれかが最後に現れる位置（無ければ -1） */
function lastIndexOfPatterns(text: string, patterns: readonly RegExp[]): number {
  let last = -1
  for (const re of patterns) {
    const global = new RegExp(re.source, 'g')
    let m: RegExpExecArray | null
    while ((m = global.exec(text)) !== null) {
      last = Math.max(last, m.index)
      if (m.index === global.lastIndex) global.lastIndex++
    }
  }
  return last
}

/**
 * 手順が「目を離せない（付きっきり）」かどうか。手順本文と注意書き（memo）の両方を見る。
 * オーナー報告の肉巻きおにぎりは、目を離せない根拠（「焦げやすいので」）が memo 側にあった。
 */
export function isHandsOnStep(step: Step): boolean {
  // 「ときどき混ぜながら」は待ちの最中の一手であって付きっきりの合図ではない（2026-08-13 便GA）。
  // 「絶えず混ぜながら」「混ぜ続ける」「煮詰める」「焦げやすい」は伏せないので従来どおり付きっきり
  const haystack = maskOccasionalActions(`${step.text}\n${step.memo ?? ''}`)
  if (HANDS_ON_PATTERNS.some((re) => re.test(haystack))) return true
  // 炒め・揚げは「待ち動詞より後ろにあるとき」だけ付きっきり（本文のみで判断する。
  // memo の「炒めたときに水っぽくならない」等の言及で本物の待ちを潰さないため）
  const text = maskNonWaitNouns(step.text)
  const cookAt = lastIndexOfPatterns(text, [HANDS_ON_COOK_PATTERN])
  if (cookAt === -1) return false
  return cookAt > lastIndexOfPatterns(text, WAIT_VERB_PATTERNS)
}

/**
 * 手順の待ち分数（分）を求める。
 * 明示された step.minutes を最優先し（明示データ＞推定）、無ければ本文の時間表記から
 * 推定する（2026-07-23 便BI・Fable裁定。貼り付け／URL取り込みのレシピは minutes が空で、
 * 長い待ちが認識されず段取り精度が落ちていた実態への対応）。推定はタイマー機能と同じ
 * findTimeTokens を情報源にし、複数あるときは最長を採る。1分未満（秒だけ）の待ちは
 * 並行しても実益が乏しく、むしろ誤って別作業を挟ませる実害の方が大きいので推定対象から
 * 外す（安全側＝手作業に倒す）。明示 minutes は 1分未満でも尊重する。
 */
export function resolveStepMinutes(step: Step): number | undefined {
  if (step.minutes != null && step.minutes > 0) return step.minutes
  // 括弧の中の任意の記述に書かれた時間は、その手順の時間として数えない
  // （2026-08-11 便FL。「せん切りにする（レンジ600Wで1分半…）」の1分半はやらないかもしれない作業）
  const tokens = findTimeTokens(stepMainText(step.text))
  if (tokens.length === 0) return undefined
  // 幅のある書き方（「12〜15分」）は**長いほう**で見積る（2026-08-14 便GK）。
  // 短く見積もると、その待ちの中へ差し込む手作業が増えて詰め込みすぎになる。
  // タイマーを鳴らすのは短いほう（logic/time.ts の TimeToken.seconds）で、役割を分けてある
  const maxSeconds = Math.max(...tokens.map((t) => t.maxSeconds))
  if (maxSeconds < 60) return undefined
  return Math.round(maxSeconds / 60)
}

/**
 * 待ち工程として扱うときの待ち分数（分）。
 * 明示 minutes ＞ 本文の時間表記 ＞ 調理法ごとの既定分数、の順に決める
 * （2026-08-08 便ED・docs/68 打ち手#1）。
 *
 * 歯止め（これが無いと目を離させる誤りが増える。診断で実測済み）:
 *   - 本文に時間表記があるのに1分未満（「30秒ゆでる」）なら既定分数を当てない。
 *     書いてある時間より長い分数を機械が上書きするのは危険側の誤り
 *   - 「さっと」「軽く」等の短時間の合図がある工程には当てない
 *   - 「〜ておく」（作っておく・溶いておく）は放置時間ではないので当てない
 *   - 表に無い待ち動詞（なじませる・味をしみ込ませる・温める・置く）には当てない＝undefined を返し、
 *     呼び出し側で手作業系に倒す（**汎用フォールバックは置かない**）
 *
 * ここで求めた既定分数は**ナビの計算と表示にだけ使い、レシピのデータには書き込まない**。
 */
export function resolveWaitMinutes(step: Step): number | undefined {
  const explicit = resolveStepMinutes(step)
  if (explicit != null) return explicit
  const main = stepMainText(step.text)
  // 本文に時間が書いてあって1分未満だった＝短いと分かっている。既定分数で上書きしない
  if (findTimeTokens(main).length > 0) return undefined
  if (SHORT_CUE_PATTERN.test(main)) return undefined
  if (TE_OKU_PATTERN.test(main)) return undefined
  const text = maskNonWaitNouns(main)
  const hit = DEFAULT_WAIT_MINUTES.find((v) => v.pattern.test(text))
  if (!hit) return undefined
  if (hit.skipForNoodles && NOODLE_PATTERN.test(text)) return undefined
  return hit.minutes
}

/**
 * 手順1つを「待ち系」か「手作業系」かに分類する。
 * 待ち動詞（WAIT_VERB_PATTERNS ＋ EXTRA_WAIT_VERB_PATTERNS）を含まない手順（切る・混ぜる・
 * 炒める・素の焼く等）は常に手作業系（安全側の既定）。
 *
 * 待ち動詞を含む手順でも、次のときは手作業系に倒す:
 *   - 目を離せない工程（isHandsOnStep）
 *   - **手順の最後に来る動作が手作業のとき**（2026-08-08 便ED・位置ルール）。
 *     「煮立ったら浮いてきたアクを取ります」「粗熱が取れたら殻をむく」は待ちではない。
 *     ただし**ユーザーが自分で分数を入れた手順には当てない**（入力の意思を尊重する）
 *   - 待ち分数がどうしても分からないとき（resolveWaitMinutes が undefined）。
 *     どれだけ手を離してよいか不明なものを待ちにする方が実害が大きい
 *   - 待ちが2分に満たないとき（MIN_PARALLEL_WAIT_MINUTES。2026-08-09 便EM）。
 *     1分では別の料理へ移る余地が無く、移らせると元の鍋から目を離すだけになる
 */
export function classifyStep(step: Step): StepKind {
  // 目を離せない工程は、待ち動詞・待ち分数に関係なく手作業系（2026-08-08 便EB）。
  // 短い待ちほど「2分しかないのに他の作業を挟まれる」実害が大きいので最優先で判定する
  if (isHandsOnStep(step)) return 'active'
  // 括弧の中の任意の記述は、その手順の主たる動作にしない（2026-08-11 便FL）
  const text = maskNonWaitNouns(stepMainText(step.text))
  const waitAt = lastEndOfPatterns(text, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS])
  if (waitAt === -1) return 'active'
  const hasExplicitMinutes = step.minutes != null && step.minutes > 0
  // 位置ルールは残す（外すと「煮立ったらアクを取る」「粗熱が取れたら殻をむく」が待ちに化ける）。
  // ただし**放置してよい器具の加熱そのものの動詞**と**待ちの最中の一手**は、手を動かす動作に
  // 数えない（2026-08-13 便GA・docs/72 第1段）。伏せ字は同じ長さなので waitAt の位置はずれない
  const forPosition = maskOccasionalActions(maskApplianceHeatVerbs(text))
  if (!hasExplicitMinutes && lastIndexOfPatterns(forPosition, [ACTION_VERB_PATTERN]) >= waitAt) {
    return 'active'
  }
  const minutes = resolveWaitMinutes(step)
  return minutes != null && minutes >= MIN_PARALLEL_WAIT_MINUTES ? 'wait' : 'active'
}

/**
 * 1つの手順に「手を動かす作業」と「そのあとの待ち」が同居しているときの切れ目
 * （2026-08-13 便GD・docs/72 対象2）。
 *
 * 直した不具合（docs/71 R3）:
 *   「皮を取り、フォークで刺し、そぎ切りにする。**10分おく**」→ **待ち10分だけ**が段取りに乗り、
 *   包丁仕事の4〜5分が0分として扱われていた。しかも待ちの工程は最初からタイマーを押せるので、
 *   **押してから包丁を持つと漬け時間が5分しか残らない**。
 *
 * 直し方は「1つの工程に2つの時間を持たせる」ではなく、**段取りの上で2つの工程に分ける**。
 *   - 手を動かす工程が先・待ちの工程が後ろ、という並びそのものが正しい順序になる
 *   - **タイマーは待ちの工程にしか出ない**＝手作業が終わるまで押せない（上の実害がそのまま消える）
 *   - 調理中モードは「いまやる1手順を大きく1枚」（docs/69）なので、性質の違う2つの作業を
 *     1枚に載せるとどちらを今やるのか読めなくなる
 *   - 番号は「①-1」「①-2」＝**湯沸かしの切り出し（2026-08-09 便ES）と同じ見せ方**を使う
 *
 * **レシピのデータは書き換えない**（規約D）。段取りに載せるときの見え方だけを分ける。
 *
 * 分けない条件（迷ったら分けない側に倒す）:
 *   - もともと待ちと判定されていない手順（＝新しく待ちを作らない。S1を増やさない）
 *   - **手順の分数欄が埋まっている**（理由は下の `splitMixedStep` の中に書いた）
 *   - 切れ目（句読点、または手作業の動詞＋「て／で」）が待ちの語より前に無い
 *   - 切った前半に手を動かす動詞が無い（「弱火で20分煮る」のような待ちだけの手順）
 *   - 切った前半が手作業・後半が待ちにならない（切ったことで判定が変わるなら切らない）
 *   - 切ったことで待ち分数が短くなる（「15分漬けたあと2分ゆでる」型。待ちを取りこぼす）
 */
/**
 * 括弧の中の但し書きは、**手順を切る位置の根拠にしない**（同じ長さの伏せ字にする）。
 *
 * これが無いと「鮭を裏返し、中まで火が通るまで焼いて器に盛る（両面焼きグリルの場合は
 * 裏返さずそのまま両面を焼く）。」で、括弧の中の「グリル」を待ちの合図として拾い、
 * **「器に盛る」が待ちの工程**に切り出されていた（同梱109品の目視で発見）。
 * 括弧の外に待ちの合図が無い手順は分けない。
 */
const PAREN_CONTENT_PATTERN = /[（(][^）)]*[）)]/g

/** 切れ目の候補①: 句読点・改行の直後 */
const MIXED_SPLIT_PUNCTUATION = /[。．\n、，,]/g
/** 切れ目の候補②: 手作業の動詞に続く「て／で」の直後（「水を入れて｜煮る」） */
const MIXED_SPLIT_CONJUNCTION = new RegExp(`(?:${ACTION_VERB_PATTERN.source})[てで]`, 'g')

/**
 * 切る位置は**できるだけ後ろ**（＝手を動かす部分をできるだけ残す）。
 *
 * 「鶏肉を加え、袋の上から手でよくもみ込んで下味をなじませ、冷蔵庫で30分ほど置く。」で、
 * 待ちの合図をいちばん**前**（なじませ）で取ると「鶏肉を加え、」だけが手作業になり、
 * もみ込む作業が待ちの中へ消える。いちばん**後ろ**（置く）で取れば
 * 「鶏肉を加え、…下味をなじませ、」までが手作業として残る。
 * 後ろで取ると前半が待ちになってしまう手順（「だし汁と調味料を加えてひと煮立ちさせ、…煮る」）
 * だけ、前の合図まで戻ってもう一度試す。
 */
function mixedSplitPoint(text: string, waitAt: number): number | undefined {
  let best: number | undefined
  for (const re of [MIXED_SPLIT_PUNCTUATION, MIXED_SPLIT_CONJUNCTION]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const at = m.index + m[0].length
      if (at > 0 && at <= waitAt && (best == null || at > best)) best = at
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  return best
}

/**
 * その分数が、手順の**待ちの側**に書かれた時間か（2026-08-14 便GK）。
 *
 * 「…そぎ切りにする。塩こしょうと酒をふって**10分**ほどおく。」の 10 は、後半の待ちの長さであって
 * 手順ぜんたいの所要時間ではない。分数欄にこの 10 が入っていても、前半の包丁仕事は別に時間が要る。
 * 逆に「玉ねぎを**10分**炒めてから煮る」の 10 は手を動かす側の時間なので、ここで弾く。
 */
function minutesWrittenInWaitPart(head: string, tail: string, minutes: number): boolean {
  const seconds = minutes * 60
  const written = (part: string) =>
    findTimeTokens(stepMainText(part)).some(
      (token) => token.seconds === seconds || token.maxSeconds === seconds,
    )
  return written(tail) && !written(head)
}

export function splitMixedStep(step: Step): { active: Step; wait: Step } | undefined {
  const text = step.text ?? ''
  if (classifyStep(step) !== 'wait') return undefined
  /**
   * 分数欄に数字が入っている手順は、**その数字が待ちの側の本文に書かれているときだけ**分ける
   * （2026-08-14 便GK・実操作テスト3回目）。
   *
   * もとは「分数欄が埋まっていたら分けない」だった。当時の根拠は
   * 「取り込み・貼り付け・手入力で登録したレシピは分数欄が必ず空（docs/68 2-3・A/B/Cとも0.0%）」。
   * **この前提は 2026-08-08 便ED の打ち手#2 で失効していた**——取り込みは本文に書かれた時間を
   * 分数欄へ写すようになった（`logic/importStepMinutes.ts`）。つまり便GDが直したはずの症状は、
   * 実際の登録経路では1件も直っていなかった。利用者の原文:
   *   「調理中モードで実際にタイマーを押してみました。押した瞬間から10:00がカウントダウンを
   *     始める。でも私はまだ肉に触ってもいない。言われたとおりに押すと、下味は5分しか入らない」
   *
   * ただし分数欄の数字を無条件で待ちに振り替えると、利用者が「その手順の所要時間」のつもりで
   * 入れた数字まで待ちに化ける（＝目を離させる誤り・S1）。そこで
   * **本文の待ちの側にその分数が書かれている**ことを条件にする（`minutesWrittenInWaitPart`）。
   * 「◯分おく」「◯分煮る」と本文が言っている手順だけが対象になり、迷う手順は分けない側に残る。
   */
  const explicitMinutes = step.minutes != null && step.minutes > 0 ? step.minutes : undefined
  // 位置を測る本文（括弧の中の任意の記述と、待ちでない名詞を同じ長さの伏せ字にする）。
  // 長さが変わらないので、ここで求めた位置をそのまま元の本文に当てられる
  const masked = maskNonWaitNouns(stepMainText(text)).replace(PAREN_CONTENT_PATTERN, (m) =>
    '＊'.repeat(m.length),
  )
  const waitPositions = [
    lastIndexOfPatterns(masked, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS]),
    firstIndexOfPatterns(masked, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS]),
  ]
  for (const waitAt of waitPositions) {
    if (waitAt <= 0) continue
    const cut = mixedSplitPoint(masked, waitAt)
    if (cut == null) continue
    const head = text.slice(0, cut).trim()
    const tail = text.slice(cut).trim()
    if (!head || !tail) continue
    if (explicitMinutes != null) {
      if (!minutesWrittenInWaitPart(head, tail, explicitMinutes)) continue
      /**
       * 分けると**コンロの口がいったん空く**手順だけは分けない（2026-08-15 便GR・迷ったら分けない側）。
       *
       * もとは「前半が火の状態を変える手順は分けない」だった（2026-08-14 便GK）。
       * 狙いは「いったん火を止めてルーを溶かし、｜弱火でとろみが付くまで5分煮る。」のように
       * **前半で火が下り・後半でまた火がつく**書き方で、分けると口が空く時刻だけが動き、
       * コンロ1口の家に「カレーの鍋をいったん下ろして別の品を火にかける」段取りや
       * 理論下限を割る段取り（E5'-b・docs/68）が出ることだった。
       *
       * ところがこの条件は**火を止めてから待つだけの手順まで巻き込んでいた**。
       * 「火を止め、そのまま10分おいて味を含ませます」は前半で火が下りるだけで後半も火はつかない
       * ＝口の空く時刻が1分も動かないのに分けられず、**火を止める一手が0分**のまま残っていた
       * ＝利用者が「一番納得いかない」と挙げた手順そのもの。
       *
       * そこで**火が下りたまま待つ形（前半で火が下り、後半でも火がつかない）だけ**を通す。
       */
      const headShift = stepHeatShift({ text: head }, DEFAULT_KITCHEN)
      const tailShift = stepHeatShift({ text: tail }, DEFAULT_KITCHEN)
      // 前半で火がつく形（「鍋で鶏肉と野菜を炒め、水を加えて｜中火で15分煮る。」）は便GKのまま
      // 分けない。**後半も火の上（on→on）なら口の勘定は動かない**と考えて通してみたが、実測すると
      // コンロ1口の家で理論下限を割る段取り（E5'-b）が1件出て、N2も53分→55分に悪化した
      if (headShift === 'on') continue
      // 前半で火が下り、後半でまた火がつく形（「いったん火を止めてルーを溶かし、｜弱火で5分煮る。」）
      if (headShift === 'off' && tailShift === 'on') continue
    }
    if (!ACTION_VERB_PATTERN.test(maskNonWaitNouns(stepMainText(head)))) continue
    // 注意書きは両方に付ける。片方に寄せると、火の通り具合のような**安全に関わる一文**が
    // 手作業側・待ち側のどちらかから消える（規約D-④の doneness メモは待ちの側で読みたい）
    const active: Step = { text: head, memo: step.memo }
    // 手順に書かれた分数は待ちのもの（「10分おく」の10分）。前半には持たせない
    const wait: Step = { text: tail, minutes: step.minutes, memo: step.memo }
    if (classifyStep(active) !== 'active') continue
    if (classifyStep(wait) !== 'wait') continue
    if ((resolveWaitMinutes(wait) ?? 0) < (resolveWaitMinutes(step) ?? 0)) continue
    return { active, wait }
  }
  return undefined
}

/**
 * 同じ同居でも**待ちが先・手作業が後ろ**の手順（2026-08-13 便GD）。
 *
 * docs/68 3-3 が「構造的な限界」として記録していた形:
 *   「切り干し大根はたっぷりの水につけてもどし、水気を絞ってざく切りにする」
 *   → **15分の放置と手作業が1手順に同居していて、どちらに倒しても正しくならない**
 * いまは位置ルール（最後に来る動作が主役）で手作業3分になり、15分の放置が丸ごと落ちている
 * （docs/68 の「見逃し」一覧に載っている2件がこの形。ホールドアウトのひじきも同じ）。
 *
 * **危険側（S1）を増やさないための歯止め**:
 *   - 待ちの部分が**1つの節に収まっている**こと（読点・句点をまたがない）。
 *     「ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります」は
 *     節を3つまたぐので分けない＝2026-08-09 便EMで**危険側1件として潰した形**を戻さない。
 *     節1つなら、待ちに巻き込まれる手作業もその中の一手だけで済む
 *   - 分けた前半が待ち・後半が手作業と読めること（分けて判定が変わるなら分けない）
 *   - 分数欄が空の手順だけ（`splitMixedStep` と同じ理由）
 *   - **前半に時間が書いてあるか、乾物をもどす型の言い回しであること**。
 *     これが無いと、手順の一部を切り出したせいで**元の手順には無かった待ちが生まれる**。
 *     実測した2件（同梱109品の目視）:
 *       「茹で上がったらすぐにざるにあげ、｜流水でもみ洗いして…」→ 前半が**ゆで8分の待ち**に化ける
 *       「冷やした茶碗蒸しに冷たいだしあんをかけ、｜…散らす」→ 「茶碗**蒸**し」で蒸し8分に化ける
 *     どちらも段取りに存在しない待ちで、待っている間に別の料理へ移らせる＝危険側の誤り。
 */
/** 切れ目の候補: 待ちの動詞に続く「て／で」の直後（「水につけてもどし｜、」も読点で拾う） */
const WAIT_FIRST_SPLIT_CONJUNCTION = new RegExp(
  `(?:${[...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS].map((r) => r.source).join('|')})[てで]`,
  'g',
)
/**
 * 前半を待ちとして切り出してよい言い回し（時間が書かれていないときの許可リスト）。
 * 乾物・切り干し・高野豆腐を水やぬるま湯でもどす型に限る（docs/68 3-3 が
 * 「構造的な限界」として記録していた形そのもの）。**汎用の許可は置かない。**
 */
const WAIT_FIRST_SOAK_PATTERN = /もどす|もどし|戻す|戻し|ひたし|浸し|水につけ|水に浸/

export function splitWaitFirstStep(step: Step): { wait: Step; active: Step } | undefined {
  const text = step.text ?? ''
  if (classifyStep(step) !== 'active') return undefined
  if (step.minutes != null && step.minutes > 0) return undefined
  const masked = maskNonWaitNouns(stepMainText(text))
    .replace(PAREN_CONTENT_PATTERN, (m) => '＊'.repeat(m.length))
    // 「茹で上がったら」はすでにゆで終わったものを指す言い方。待ちの合図にしない
    .replace(BOILED_ALREADY_PATTERN, (m) => '＊'.repeat(m.length))
  const waitEnd = lastEndOfPatterns(masked, [...WAIT_VERB_PATTERNS, ...EXTRA_WAIT_VERB_PATTERNS])
  if (waitEnd <= 0) return undefined
  // 待ちの語より後ろで、いちばん近い切れ目
  let cut: number | undefined
  for (const re of [MIXED_SPLIT_PUNCTUATION, WAIT_FIRST_SPLIT_CONJUNCTION]) {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(masked)) !== null) {
      const at = m.index + m[0].length
      if (at >= waitEnd && (cut == null || at < cut)) cut = at
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
  if (cut == null) return undefined
  // 待ちの部分が節をまたいでいたら分けない（前半に別の手作業が埋まっている）
  if (new RegExp(MIXED_SPLIT_PUNCTUATION.source).test(masked.slice(0, cut - 1))) return undefined
  const head = text.slice(0, cut).trim()
  const tail = text.slice(cut).trim()
  if (!head || !tail) return undefined
  // 前半に時間が書いてあるか、乾物をもどす型の言い回しであること（無い待ちを作らない）
  const headMain = stepMainText(head)
  if (findTimeTokens(headMain).length === 0 && !WAIT_FIRST_SOAK_PATTERN.test(headMain)) {
    return undefined
  }
  const wait: Step = { text: head, memo: step.memo }
  const active: Step = { text: tail, memo: step.memo }
  if (classifyStep(wait) !== 'wait') return undefined
  if (classifyStep(active) !== 'active') return undefined
  return { wait, active }
}

/**
 * 手作業系で minutes が書かれていない工程に当てる、いちばん基本の所要時間（分）。
 * 作業の種類ごとの見積り（ACTIVE_MINUTES_BY_CATEGORY）が使えないときの土台になる。
 */
export const DEFAULT_ACTIVE_MINUTES = 4

/**
 * 手順の「作業の種類」（2026-08-08 便EB・オーナー要望「野菜を切る工程はまとめたい」
 * 「準備→焼いたり形を整えたり混ぜたり、と3品全体の流れを整えたい」）。
 *
 * AIは使わず、手順本文にどの語が**いちばん後ろに**出てくるかだけで決める。
 * 「切った野菜を炒める」のように複数の動作が並ぶ手順は、最後に来る動作がその手順の主役
 * （＝炒める）という単純な規則にする（isHandsOnStep の位置判定と同じ考え方）。
 * どれにも当たらない手順は 'other'（既定側）で、並べ替えでは加熱と同じ扱いにして
 * 余計に前後させない。
 */
export type StepCategory = 'cut' | 'wash' | 'season' | 'heat' | 'finish' | 'other'

/** 種類ごとの見分け語。並びは判定の優先順ではなく、位置（最後に出た語）で決める */
const CATEGORY_PATTERNS: { category: StepCategory; patterns: RegExp[] }[] = [
  {
    category: 'cut',
    patterns: [/切る|切り|切っ|刻む|刻み|刻ん|むく|むき|皮をむ|スライス|そぎ|ちぎ|くし形|輪切|乱切|千切|みじん/],
  },
  {
    category: 'wash',
    patterns: [/洗う|洗い|洗っ|さらす|さらし|水切り|水きり|水気を|塩をふ|塩をま|板ずり|下ゆで|筋を取|石づき/],
  },
  {
    category: 'season',
    // 「合わせ」は**加熱の動詞にくっついた形（炒め合わせる・煮合わせる）を除く**
    // （2026-08-09 便ES・オーナー報告D-5「玉ねぎをしんなりするまで炒め、ご飯をほぐしながら
    //   炒め合わせる」の目安が3分。位置ルールで「合わせ」が「炒め」より後ろに来るため、
    //   炒め工程まるごとが「混ぜる（3分）」に化けていた）
    // 「並べる・塗る・敷く」は組み立ての一手（2026-08-14 便GK・実操作テスト3回目
    // 「『ホイル敷いて肉を並べてみそマヨを塗ってチーズをのせる』が2分。…見積りが逆になっている」）。
    // どの種類にも当たらないと、手順の長さだけで一律に見積る枝へ落ちて 4分になっていた
    patterns: [/混ぜ|まぜ|和え|あえ|こね|練る|練り|溶く|溶き|下味|もみ込|もみこ|まぶ|(?<!炒め|煮|焼き|揚げ|いため)合わせ|漬け|漬ける|にぎる|包む|巻く|形を整え|成形|並べ|敷く|敷い|敷き|塗る|塗り|塗っ/],
  },
  {
    category: 'heat',
    patterns: [/焼く|焼き|焼い|炒め|炒る|揚げ|煮る|煮込|煮立|茹で|ゆで|蒸す|蒸し|加熱|レンジ|グリル|オーブン|沸か|沸騰|温め|火にかけ|熱し|熱する/],
  },
  {
    category: 'finish',
    // 「ふる・のせる」は仕上げの一手（2026-08-14 便GK・実操作テスト3回目
    // 「『焼けたら乾燥パセリをふる』に4分。パセリをふるのに4分は取りません。10秒です」）。
    // 「ふる」は単独だと「ふるいにかける」「水気をふき取る」に当たるので、
    // 「〜をふる／〜を振る」の形に限る
    patterns: [
      /盛る|盛り|器に|添え|散らす|散らし|かけて仕上げ|仕上げ|盛りつけ|盛り付け|のせ|乗せ|載せ|いただ/,
      /を[ふ振][りっ]|を[ふ振]る(?!い)/,
    ],
  },
]

/**
 * その断片に出てきた作業の種類を全部返す（`main` は本文の中で最後に出てきたもの）。
 *
 * 「最後に来る動作がその手順の主役」は**順番の判断**（並べ替え・段階）には正しいが、
 * **所要時間の見積り**には合わない（2026-08-14 便GK・実操作テスト3回目）。
 * 「ひき肉を炒めて器に盛る」は最後の語が「盛る」なので仕上げ＝2分と見積られていたが、
 * 実際にかかるのは炒める時間。見積りは**いちばん重い動作**で取る（`groupBaseMinutes`）。
 */
function matchedCategories(text: string): { main?: StepCategory; all: StepCategory[] } {
  let main: StepCategory | undefined
  let bestAt = -1
  const all: StepCategory[] = []
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    const at = lastIndexOfPatterns(text, patterns)
    if (at === -1) continue
    all.push(category)
    if (at > bestAt) {
      bestAt = at
      main = category
    }
  }
  return { main, all }
}

/**
 * 手順の作業の種類を、本文の中で最後に出てきた見分け語から決める。
 * どの見分け語にも当たらなければ undefined（＝その断片には動作が書かれていない）。
 */
function matchedCategory(text: string): StepCategory | undefined {
  return matchedCategories(text).main
}

/** 手順の作業の種類を、本文の中で最後に出てきた見分け語から決める（当たらなければ 'other'） */
export function stepCategory(step: Step): StepCategory {
  return matchedCategory(stepMainText(step.text)) ?? 'other'
}

/**
 * 段階（下ごしらえ→加熱→仕上げ）の大枠。数字が小さいほど先にやりたい。
 * 3品ぶんの手順を混ぜても「準備がひととおり済んでから加熱、盛り付けは最後」の形が崩れないよう、
 * 手作業の順番を決めるときの判断材料に使う。'other'（分類できなかった手順）は加熱と同じ 1 に置き、
 * 分からない手順を前にも後ろにも動かさない（既定側に倒す）。
 */
const CATEGORY_STAGE: Record<StepCategory, number> = {
  wash: 0,
  cut: 0,
  season: 0,
  heat: 1,
  other: 1,
  finish: 2,
}

export function stepStageRank(step: Step): number {
  return CATEGORY_STAGE[stepCategory(step)]
}

/**
 * 手作業の所要時間の見積り（2026-08-09 便EH・オーナー実機報告
 * 「茹で時間＝待ち時間4分想定の手順から、次の手順でザルにあげるまでに、鶏肉炒め＋玉ねぎ＋
 * ご飯＋盛り付けまで入っている。無理。不可能。余裕を持って時間設定して」）。
 *
 * 従来は minutes の無い手作業をすべて一律4分とみなしていた。この見積りは
 *   - 「器に盛る」まで4分と数える（長すぎる）
 *   - 1段落まるごとが1手順になった取り込みレシピも4分と数える（短すぎる。診断 docs/68 3-3）
 * の両方でずれており、**待ち時間に何工程まで入るか**の計算をこの値で行うようになった今は、
 * ずれがそのまま「物理的に不可能な段取り」になる。
 *
 * 見積りの決め方（AIは使わない）:
 *   1. 手順に分数が書かれていればそれを使う（ユーザーの入力が最優先）
 *   2. 本文に「3分炒める」のような時間表記があり、手順が短ければそれを使う
 *   3. どちらも無ければ、作業の種類ごとの目安に、手順文の長さぶんを足す
 *      （およそ60字ごとに1工程分＝DEFAULT_ACTIVE_MINUTES を足す。長い1手順は作業量も多い）
 */
const ACTIVE_MINUTES_BY_CATEGORY: Record<StepCategory, number> = {
  // 切る: 1つの動作（1文・1節）ぶん。数種類を切る手順は、節・文ごとに動作を数えて足す
  // （2026-08-09 便ES で 4→3。複数動作の足し上げを入れたので、1動作の目安をそろえ直した）
  cut: 3,
  // 洗う・水気を取る・筋を取る等の下処理
  wash: 3,
  // 混ぜる・和える・下味をもみ込む・成形
  season: 3,
  // 炒める・焼く・揚げる（時間が書かれていない加熱は、切る作業より長く見る）
  heat: 5,
  // 器に盛る・散らす・添える
  finish: 2,
  // 見分け語に当たらなかった手順。動作のまとまり（stepActionGroups）は見分け語に当たった
  // 断片しか作らないので、ここが使われるのは stepCategory を直接呼ぶ並べ替え側だけ
  other: 4,
}

/**
 * 加熱の中でも「火にかける」「油を熱する」だけの手順は、手を動かす時間そのものは短い
 * （そのあと沸くのを待つ時間は、次の手順の待ちとして別に数える）。
 * 炒める・焼く・揚げる・煮るのように**続けて手を動かす語**が無い加熱は、準備動作として短く見る。
 */
const SUSTAINED_COOK_PATTERN = /炒め|炒る|焼|揚げ|煮|蒸/
const QUICK_HEAT_MINUTES = 2

/** 手順文が何字ごとに「1工程ぶん」の作業量を持つとみなすか */
const ACTIVE_BULK_CHARS = 60
/** 見積りの上限（分）。どれだけ長い1手順でもここで頭打ちにする */
const ACTIVE_MINUTES_CAP = 20

/**
 * 2つめ以降の動作に足す分数（2026-08-09 便ES・オーナー報告D-5
 * 「1手順に複数動作があるときの見積りが短すぎる。『玉ねぎをしんなりするまで炒め＋ご飯を
 *   ほぐしながら炒め合わせる』で目安3分は足りない」）。
 *
 * 従来は**手順の中で最後に出てきた動作1つだけ**でその手順の所要時間を決めていた。
 * 「切り、炒め、味をととのえて器に盛る」のように3つの動作が入った手順でも、
 * 最後の「盛る」だけを見て2分と見積っていた（同梱109品では手作業手順の53%が複数動作）。
 *
 * 満額（その動作を単独でやったときの目安）を足さず**1分ずつ**にとどめるのは、
 * 続けてやる動作は段取りが重なるため（炒めながら味をつける・切ったそばからボウルに入れる）。
 * 同梱109品で測ると、満額に近い足し方（種類ごとに1〜2分）では並行の短縮率が
 * 32.6%→32.4%に落ちた（＝待ち時間に入る作業が減って段取りが痩せる）。1分ずつなら
 * 短縮率を保ったまま、複数動作の手順だけを実態に近づけられる。
 */
const EXTRA_ACTION_MINUTES = 1

/** 文の区切り（句点・改行）。文をまたぐ動作は、同じ種類でもまとめない */
const SENTENCE_SPLIT_PATTERN = /[。．\n]/
/** 文の中で動作ごとに切るときの区切り（読点） */
const CLAUSE_SPLIT_PATTERN = /[、，,]/

/** 1手順の中の「動作のまとまり」 */
export interface StepActionGroup {
  /** そのまとまりの主役（本文の中で最後に出てきた種類）。並べ替え・段階の判断に使う */
  category: StepCategory
  /** そのまとまりに出てきた種類の全部。見積りはこの中でいちばん重いもので取る（便GK） */
  categories: StepCategory[]
  text: string
}

/**
 * 手順文を「動作のまとまり」に分ける（2026-08-09 便ES）。
 *
 * 読点・句点で区切り、**動作の語が入っている断片だけ**をまとまりとして数える。
 * 材料の列挙（「しょうゆ、ごま油、酢を混ぜる」の「しょうゆ」「ごま油」）は動作が無いので
 * 数えない＝読点の数で見積りが膨らまないようにするための歯止め。
 * 同じ種類が続く断片は1つにまとめる（「切り、薄切りにする」は切る作業1つ）。
 */
export function stepActionGroups(text: string): StepActionGroup[] {
  const groups: StepActionGroup[] = []
  for (const sentence of text.split(SENTENCE_SPLIT_PATTERN)) {
    // 同じ種類をまとめるのは1つの文の中だけ（文が変われば別の作業と数える）。
    // 1段落まるごとが1手順になった取り込みレシピ（診断 docs/68 3-3）で、
    // 「炒めます。…炒め、…」を1つの動作に潰してしまわないための区切り
    let sentenceStart = groups.length
    for (const raw of sentence.split(CLAUSE_SPLIT_PATTERN)) {
      const fragment = raw.trim()
      if (!fragment) continue
      const { main: category, all } = matchedCategories(fragment)
      const last = groups[groups.length - 1]
      if (category === undefined) {
        // 動作の書かれていない断片（「ボウルに」「お好みで」）は、直前のまとまりの一部として扱う
        if (last) last.text += fragment
        continue
      }
      if (last && groups.length > sentenceStart && last.category === category) {
        last.text += fragment
        for (const c of all) if (!last.categories.includes(c)) last.categories.push(c)
        continue
      }
      groups.push({ category, categories: all, text: fragment })
    }
    sentenceStart = groups.length
  }
  return groups
}

/**
 * その動作のまとまり1つぶんの目安（分）。
 * まとまりの中に複数の種類が出てくるときは**いちばん重いもの**で取る（2026-08-14 便GK）。
 * 「炒めて器に盛る」を、最後の語だけを見て仕上げ2分と数えていた（＝見積りが逆になる元）。
 */
function groupBaseMinutes(group: StepActionGroup): number {
  let best = 0
  for (const category of group.categories.length > 0 ? group.categories : [group.category]) {
    // 「油を熱する」「火にかける」だけの加熱は、手を動かす時間そのものは短い
    const minutes =
      category === 'heat' && !SUSTAINED_COOK_PATTERN.test(group.text)
        ? QUICK_HEAT_MINUTES
        : ACTIVE_MINUTES_BY_CATEGORY[category]
    if (minutes > best) best = minutes
  }
  return best
}

export interface ActiveMinutesEstimate {
  minutes: number
  /** レシピに書かれた時間ではなく、ナビが当てた見積りか（画面ではその旨を添えて出す） */
  estimated: boolean
}

/**
 * 待ちの手前だけを切り出した断片（`splitMixedStep` の前半）で、動作の語が1つも
 * 見つからなかったときの目安（分。2026-08-13 便GD）。
 *
 * ふつうの手順なら「動作の語が無い＝取り込みレシピの説明文」なので文の長さで見積るが、
 * ここで扱うのは「鍋に水を入れて」「ふたをずらしてのせ、」のように、
 * **待ちを仕掛けるための一手**だと分かっている短い断片。4分と数えると
 * 段取り全体がその分だけ嘘になる（docs/71 R3「文章が短いほど長く見積もられている」）。
 */
const LEAD_IN_MINUTES = 1

export function estimateActiveMinutes(
  step: Step,
  options?: { leadIn?: boolean },
): ActiveMinutesEstimate {
  if (step.minutes != null && step.minutes > 0) return { minutes: step.minutes, estimated: false }
  // 括弧の中の任意の記述は、その手順の作業量にも数えない（2026-08-11 便FL）
  const text = stepMainText(step.text ?? '')
  const fromText = resolveStepMinutes(step)
  const groups = stepActionGroups(text)
  // 動作が1つだけの短い手順に「3分炒める」と書いてあれば、それがその手順の所要時間そのもの
  if (fromText != null && groups.length <= 1 && text.length <= ACTIVE_BULK_CHARS) {
    return { minutes: fromText, estimated: false }
  }
  if (groups.length === 0) {
    if (options?.leadIn) return { minutes: Math.max(LEAD_IN_MINUTES, fromText ?? 0), estimated: true }
    // 動作の語が1つも見つからない手順（取り込みレシピの説明文など）は、文の長さだけで見る
    const bulk = Math.max(1, Math.ceil(text.length / ACTIVE_BULK_CHARS))
    const guess = Math.min(ACTIVE_MINUTES_CAP, bulk * DEFAULT_ACTIVE_MINUTES)
    return { minutes: Math.max(guess, fromText ?? 0), estimated: true }
  }
  // いちばん重い動作を満額、残りの動作は1分ずつ足す
  const bases = groups.map(groupBaseMinutes)
  const mainIndex = bases.indexOf(Math.max(...bases))
  const byAction = bases.reduce(
    (sum, base, i) => sum + (i === mainIndex ? base : EXTRA_ACTION_MINUTES),
    0,
  )
  const guess = byAction
  // 本文に書かれた時間（その一部の作業の時間）より短くならないようにする
  return {
    minutes: Math.min(ACTIVE_MINUTES_CAP, Math.max(guess, fromText ?? 0)),
    estimated: true,
  }
}

/**
 * 待ちの「手を戻す締め切りの厳しさ」（2026-08-09 便EH）。
 *
 * 待ちには性質の違うものがある。
 *   - onTime  … ゆでる・湯を沸かす・レンジ。**1分の超過でゆですぎ・吹きこぼれ**になる
 *   - simmer  … 煮る・蒸す・オーブン・グリル。弱火やふたの中で進むので、
 *               レシピ自体「15〜20分」のように幅で書かれることが多い
 *   - relaxed … 漬ける・冷やす・寝かせる・もどす・味をなじませる。数分の遅れは料理に影響しない
 *
 * この違いを、待ち時間に差し込む手作業の上限（buildCookTimeline）に使う。
 * 判定は本文の中で**最後に出てきた語**で決める（この画面のほかの位置ルールと同じ考え方）。
 * 「煮汁がなくなったら火を止め、そのまま冷ます」は冷ますが主役＝relaxed。
 * どの語にも当たらないときは、いちばん厳しい onTime に倒す（安全側）。
 */
export type WaitUrgency = 'onTime' | 'simmer' | 'relaxed'

const ON_TIME_WAIT_PATTERN =
  /茹で|ゆで|湯がく|ゆがく|レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]|温め|あたため/
const SIMMER_WAIT_PATTERN =
  // 「沸くのを」「沸くまで」は、ナビが差し込む沸くまでの待ち（2026-08-13 便GD）。
  // 鍋が沸くのを待つ間は数分の遅れで料理が台無しにはならないので、煮込みと同じ扱いにする
  // （ゆでる・レンジのように1分の超過が失敗になる工程ではない）
  /煮|蒸|オーブン|グリル|トースター|焼き|揚げ|ふたをして|フタをして|蓋をして|火を通|沸か|沸騰|沸くの|沸くまで/
const RELAXED_WAIT_PATTERN =
  /漬|浸|マリネ|寝かせ|寝かし|ねかせ|休ませ|休ます|冷ま|冷や|粗熱|冷蔵庫|なじ|馴染|しみ|染み|発酵|解凍|もどす|もどし|戻す|戻し|さらす|さらし|水切り|水きり|炊|置い|置く|おく|おき/

export function waitUrgency(step: Step): WaitUrgency {
  const text = maskNonWaitNouns(step.text)
  const onTime = lastEndOfPatterns(text, [ON_TIME_WAIT_PATTERN])
  const simmer = lastEndOfPatterns(text, [SIMMER_WAIT_PATTERN])
  const relaxed = lastEndOfPatterns(text, [RELAXED_WAIT_PATTERN])
  if (onTime === -1 && simmer === -1 && relaxed === -1) return 'onTime'
  if (onTime >= simmer && onTime >= relaxed) return 'onTime'
  if (simmer >= relaxed) return 'simmer'
  return 'relaxed'
}

/**
 * 煮込み等で、締め切りを何分まで越えてよいか（待ち時間の2割・上限5分）。
 * 15分煮るなら3分、5分煮るなら1分まで。**ゆでる・レンジには一切与えない**。
 */
const SIMMER_OVERRUN_RATIO = 0.2
const SIMMER_OVERRUN_MAX = 5

/**
 * その待ちを仕掛けたあと、**遅くともいつまでに手を戻さないといけないか**（待ち終了からの猶予・分）。
 * relaxed は上限なし（Infinity）。
 */
export function waitOverrunAllowance(step: Step, waitMinutes: number): number {
  switch (waitUrgency(step)) {
    case 'onTime':
      return 0
    case 'simmer':
      return Math.min(SIMMER_OVERRUN_MAX, Math.floor(waitMinutes * SIMMER_OVERRUN_RATIO))
    default:
      return Number.POSITIVE_INFINITY
  }
}

/**
 * 【火にかけたままにしない】2026-08-14 便GG・docs/72 第5段。
 *
 * 利用者（料理歴20年・自分で登録したレシピで実操作）の原文:
 *   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が
 *     挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と
 *     書いてあるのに。豆腐は崩れるしわかめは溶けます。**#7の後に「火を止める」も「弱火にする」も
 *     出てきません。**」
 *
 * なぜ 2026-08-09 便EH の「遅くともこの時刻までに手を戻す締め切り」（attendWithin）が
 * 効かなかったか:
 *   1. 締め切りは**待ちの工程からしか生まれない**。「沸いたら豆腐とわかめを入れる」は手作業なので、
 *      鍋が火にかかったままでも締め切りを持てない
 *   2. その品の手順を1つ出すたびに `attendUntil = 0` で**消していた**。鍋に手を戻したのか、
 *      鍋を火にかけたまま別のことをしたのかを区別していなかった
 * ＝**「火がついている」という状態そのものを段取りが持っていなかった**。ここではそれを持たせる。
 *
 * 数えるのは**コンロ（IH含む）だけ**。電子レンジ・魚焼きグリル・トースターは待ちが明けた時点で
 * タイマーが切れ、レシピにも「3分加熱」と時間が書いてあるので利用者は止める合図を持っている
 * （置きっぱなしで冷めるのは別の軸＝2026-08-13 便GBの「仕上げを寄せる」が受け持つ）。
 */
export type HeatShift = 'on' | 'off' | 'keep'

/**
 * 火から下ろす合図。これがある手順のあとは、その品は火にかかっていない。
 * `cookAppliance.ts` の OFF_HEAT_PATTERN と役割が違う（あちらは「その手順がコンロをふさぐか」、
 * こちらは「その手順のあと火が残るか」）ので、別に持つ。
 */
/**
 * 【手でこねる・形を作る工程は、火の上ではできない】2026-08-15 便GM。
 *
 * 上の keep（どちらでもない工程では火の状態を引き継ぐ）は「沸いたら豆腐とわかめを入れる」を
 * 捕まえるための肝だが、**中身が鍋から出ている品まで火にかけたまま**と読んでしまっていた。
 * 実例（ハンバーグ）: 「玉ねぎをみじん切りにして炒める→ひき肉とまぜてこねる→形を作る→焼く」。
 * 本文に「火を止める」が無いので、1つめで付いた火が最後まで続いていることになり、
 *   ①その品は最初から最後までコンロを1口ふさぎ続ける（ボウルで肉をこねている間もずっと）
 *   ②火にかかったままとみなされるので、仕上げを揃える仕組み（holdsFinish）が一切効かない
 * の2つが同時に起きていた。**ひき肉を手でこねるのはボウルの中の作業**で、炒めた玉ねぎは
 * とっくに鍋から出ている＝この工程が来る時点で火は下りている。
 *
 * 語は**手でタネを扱う工程だけ**に絞る。「丸める」「混ぜる」は鍋の中でもやるので入れない
 * （鍋の中の作業を火から下ろすと読むと、火にかけたままの放置を取りこぼす）。
 * 位置くらべは従来どおりなので、「こねてからフライパンで焼く」は火にかける側のまま。
 */
const HEAT_OFF_PATTERN =
  /火を止め|火をとめ|火を消|火からおろ|火から下ろ|火から外|火からはず|器に盛|皿に盛|椀に|お椀に|盛り付け|盛りつけ|盛って|取り出|とり出|ざるにあげ|ざるに上げ|ざるにとり|ざるに移|ザルにあげ|ザルに上げ|ザルにとり|ザルに移|湯を切|湯をき|湯切り|油をき|油を切|水気をき|水気を切|水けをき|水けを切|水気をしぼ|水気を絞|水けをしぼ|水けを絞|つぶ|水にとる|水に取る|水にさら|流水|洗う|洗い|洗っ|冷水|冷ま|粗熱|こね|捏ね|成形|形を作|形を整え|できあがり|出来上がり/

/**
 * 手でタネを扱う工程（上の HEAT_OFF_PATTERN のうち 2026-08-15 便GMが足したぶん）。
 * **この工程に入るまでの空きも、火にかけたままの放置には数えない**＝火は前の加熱が済んだ時点で
 * 止まっている（ボウルの中の作業なので、中身はとっくに鍋から出ている）。
 * 監査 `audit-cook-navi.mjs` の MEASURE_OFF_HEAT_BY_HAND と同じ役割・同じ語。
 */
const OFF_HEAT_BY_HAND_PATTERN = /こね|捏ね|成形|形を作|形を整え|形にする/

/** 火にかかっている合図（位置くらべに使う。器具の見分けそのものは cookAppliance が持つ） */
const HEAT_ON_PATTERN =
  /火にかけ|火に掛け|火をつけ|火を入れ|点火|強火|中火|弱火|とろ火|煮|茹|ゆで|沸か|沸騰|煮立|炒め|炒る|揚げ|蒸|焼く|焼き|焼い|熱し|熱する|加熱|温め/

/**
 * その手順のあと、その品はコンロの上で火にかかったままか。
 *   on   … 火がつく（この手順でコンロを使う）
 *   off  … 火から下りる（火を止める・器に盛る・湯を切る・つぶす・冷ます 等）
 *   keep … どちらでもない＝**直前の状態をそのまま引き継ぐ**
 *
 * keep が肝心。「沸いたら豆腐と乾燥わかめを入れる」は火の語をひとつも持たないが、
 * 鍋は火にかかったままで、次の「火を止める」までずっと煮え続ける。
 *
 * 火を下ろす語と火にかける語が両方あるときは、**あとに来たほうが主役**
 * （この画面のほかの位置ルールと同じ）。「水気を絞って鍋に戻し、5分煮る」は火にかける。
 */
export function stepHeatShift(step: Step, kitchen: KitchenEquipment): HeatShift {
  const text = maskNonWaitNouns(stepMainText(step.text))
  const off = lastEndOfPatterns(text, [HEAT_OFF_PATTERN])
  const on = lastEndOfPatterns(text, [HEAT_ON_PATTERN])
  if (off >= 0 && off > on) return 'off'
  const key = stepApplianceFor(step.text, kitchen)
  if (key == null) return 'keep'
  // コンロ以外の器具（レンジ・グリル・トースター）は、その工程が終われば加熱も終わる
  if (key !== 'stove') return 'off'
  if (classifyStep(step) === 'wait' && waitUrgency(step) === 'relaxed') return 'off'
  return 'on'
}

/**
 * 【火が下りるのは、その工程の手前か終わりか】2026-08-14 便GI。
 *
 * 同じ「火から下りる工程」でも、鍋がコンロを離れる時点は2つある。
 *   終わり … 「豆腐を加え、弱火で5分ほど煮て味をなじませたら器に盛る」
 *             ＝その工程の**間ずっと火にかかっている**。5分ぶん口はふさがったまま
 *   手前 … 「火を止めてそのまま10分おき、味をしみ込ませる」「器に盛る」
 *             ＝火は工程の頭で下りている。**置いておくだけの時間まで口をふさがない**
 *
 * 見分けは位置くらべ（この画面のほかの規則と同じ）。**火にかける語が、火を下ろす語より前**にあれば、
 * その工程の間は火の上にいる＝終わりに下りる。
 */
export function heatOffAtEnd(step: Step): boolean {
  const text = maskNonWaitNouns(stepMainText(step.text))
  const off = lastEndOfPatterns(text, [HEAT_OFF_PATTERN])
  const on = lastEndOfPatterns(text, [HEAT_ON_PATTERN])
  return on >= 0 && on < off
}

/**
 * 【台所を離れてよいかと、器具をふさぐかは別の話】2026-08-23 便KD・影響範囲テストC（時短の人）。
 *
 * 起きていた不具合（実データ30品・レンジを使う17品の全136組で実測）:
 * 「鶏むね肉ときのこのレンチンみぞれ煮」と「キャベツののりごまあえ」を組むと
 * ```
 * [16-22] 600Wのレンジで6分加熱し、ラップをしたまま2分おく    ← レンジを押さえていない扱い
 * [16-18] ラップをかけて2分レンチンし、水けをきる            ← 同じ16分から同時に始まる
 * ```
 * になり、**電子レンジ1台を2品が同時に使う段取り**が出ていた。この台所では作れない。
 *
 * 原因は、待ちが器具をふさぐかを `waitUrgency(s) !== 'relaxed'` で決めていたこと。
 * `waitUrgency` が答えるのは「**遅くとも何分後までに手を戻さないといけないか**」＝
 * 台所を離れてよいかの話で、**器具が動いているかどうかとは別の軸**。
 * レンジ加熱の文が「〜2分おく」「〜粗熱を取ります」で終わると、最後に当たった語で relaxed に倒れ、
 * 6分レンジが動いている工程が「器具を取らない待ち」に化けていた。
 * 実測すると、器具の字がある待ちのうち relaxed で除外されていたのは同梱109品＋実データ30品で
 * わずか8件、そのうち7件は**本当は器具が動いている**工程だった（除外がほぼ全部まちがい）。
 *
 * ここで見るのは1つだけ＝**その待ちの間、鍋や器がまだ器具の上にあるか**。
 * 見分けは、この画面のほかの規則と同じ位置くらべ:
 *   下ろす語だけがある（火にかける語が1つも無い）… 「火を止めてそのまま10分おく」
 *     ＝待ちに入る時点でもう下りている → **ふさがない**
 *   それ以外 … 「弱火で5分ほど煮て味をなじませたら器に盛る」「600Wで6分加熱し、2分おく」
 *     ＝その待ちの間は器具の上にいる → **ふさぐ**
 *
 * 迷ったらふさぐ側に倒す（`cookAppliance.ts` 冒頭の方針。見落とすとその家では作れない段取りが出るが、
 * 多めに数えても段取りが少し長くなるだけ）。
 */
const APPLIANCE_RELEASED_PATTERN = new RegExp(
  // 火を下ろす合図（HEAT_OFF_PATTERN）に、器具から下ろす言い回しを足したもの。
  // 「鍋ごと冷蔵庫で冷やす」のように火の語が1つも無い待ちを拾うために別に持つ
  // （HEAT_OFF_PATTERN を直に太らせると、火が残るかの判定 stepHeatShift まで動いてしまう）
  `${HEAT_OFF_PATTERN.source}|冷や|冷蔵庫|冷凍庫|保存容器|バットに移|ボウルに移|皿に移|器に移`,
)

/**
 * 器具が動いている合図。`HEAT_ON_PATTERN`（コンロに火がついているか）に、
 * **コンロ以外の器具を回す語**を足す。HEAT_ON_PATTERN はコンロ専用に育ってきた辞書なので
 * 「レンチン」「7分チン」「トースターで焼く」を1つも持っておらず、これだけで見ると
 * 「ラップをかけて2分レンチンし、水けをきる」が**動いていない待ち**に化ける（実測）。
 */
const APPLIANCE_RUNNING_PATTERN = new RegExp(
  `${HEAT_ON_PATTERN.source}|レンジ|レンチン|チンす|チンし|チン。|グリル|トースター|オーブン|[0-9０-９]\\s*[WＷ]`,
)

/** その待ちの間、鍋や器がまだ器具の上にあるか（＝器具をふさぐか） */
export function waitKeepsAppliance(step: Step): boolean {
  const text = maskNonWaitNouns(stepMainText(step.text))
  const off = lastEndOfPatterns(text, [APPLIANCE_RELEASED_PATTERN])
  const on = lastEndOfPatterns(text, [APPLIANCE_RUNNING_PATTERN])
  return !(off >= 0 && on === -1)
}

/**
 * 火にかけたまま、次の手順まで空けてよい時間（分）。
 *
 * 3分の根拠は利用者自身の手順そのもの＝「豆腐を入れて味噌を溶くのは焼き上がりの3分前」。
 * レシピ本文の「1〜2分煮る」に1分の余裕を足した幅で、短い煮込みを最後まで通せる。
 * 待ちの工程がもともと持っている超過許容（`waitOverrunAllowance`＝煮込みなら待ちの2割・上限5分）は
 * そのままにして、**この猶予は「待ちではない工程で火にかけたままになったとき」にだけ**与える
 * （既存の締め切りを緩める方向に働かせない）。
 */
export const HEAT_HOLD_ALLOWANCE = 3

/**
 * 生の肉・魚を指す語（2026-08-08 便ED・オーナー指示「切る順番を野菜→肉に。肉は最後」）。
 * まな板と包丁を洗わずに続けても差し支えない順に並べるための、台所の定石
 * （生の肉・魚を先に切ると、そのあと生で食べる野菜に菌が移りうる）。
 *
 * 見分けは手順文の語だけで行う簡単な規則にする。**当てはまらないものは野菜あつかい**＝
 * 判断が付かないときは従来どおりの順番のままにする（余計に入れ替えない）。
 * 「たら」「いか」など、ほかの言葉の一部になりやすい語はあえて入れない（誤検出のほうが害が大きい）。
 */
const RAW_MEAT_PATTERN =
  /肉|鶏|豚|ささみ|ベーコン|ハム|ソーセージ|ウインナー|切り身|刺身|鮭|さば|ぶり|えび|ホタテ|貝柱|魚/

/**
 * 切る工程どうしを比べるときの順番（0＝野菜など先に切るもの／1＝生の肉・魚＝最後に切るもの）。
 * 切る工程以外には影響しない（呼び出し側が category === 'cut' のときだけ使う）。
 */
export function cutOrderRank(step: Step): number {
  return RAW_MEAT_PATTERN.test(step.text) ? 1 : 0
}

/**
 * 漬け込み・寝かせの待ちか（2026-08-08 便EG・オーナー実機報告
 * 「切る手順が後ろに行ってた。マリネしてつけ置きが先に来ていたが、マリネ液→カット→混ぜる、に
 * した方がいい」）。
 *
 * 待ち工程はふつう早く仕掛けるほど得だが、漬け込み・寝かせだけは事情が違う。
 * 生の肉・魚を漬けたあとで別の品の野菜を切ると、まな板と手を洗い直すことになる
 * （切る工程は「野菜→肉・魚」の順に並べてある。cutOrderRank と同じ台所の定石）。
 * 漬け込みは数十分の長い待ちで、数分の切る工程を先に入れても全体はほとんど伸びない。
 */
const SOAK_WAIT_PATTERN = /漬|浸|マリネ|もみ込|もみこ|なじま|寝かせ|寝かし|ねかせ|冷蔵庫/

export function isSoakWait(step: Step): boolean {
  return SOAK_WAIT_PATTERN.test(maskNonWaitNouns(step.text))
}

/**
 * 出したい温度（2026-08-08 便EG・オーナー実機報告
 * 「仕上げてすぐ提供したいレシピの優先度が決まってるといいのか？ 冷たい方がいいものは先に
 * 仕上げて冷蔵庫で冷やしたい」）。
 *
 * 料理名と手順文から機械的に見分ける。**判断が付かないものは 'neutral'**＝従来どおりの順番に
 * 任せる（無理に前後させない）。
 *   - cold  … 仕上げてから冷やす品。先に仕上げて冷蔵庫に入れられる
 *   - hot   … できたてが温かい品。最後に仕上げたい
 *   - neutral … どちらとも読めない品
 */
export type ServeTemp = 'cold' | 'hot' | 'neutral'

/** 手順文に出てくる「冷やしてから食べる」の言い回し */
const CHILL_STEP_PATTERN =
  /冷蔵庫で冷や|冷蔵庫に入れて冷や|冷蔵庫で.{0,6}冷や|よく冷や|しっかり冷や|冷やし固め|冷やしてから|氷水で冷や|冷めるまで|冷ましてから/
/** 料理名から分かる冷たい料理（サラダ・和え物・酢の物のように、熱々では出さない品） */
const COLD_TITLE_PATTERN =
  /冷やし|冷製|冷たい|サラダ|マリネ|和え|あえ|酢の物|おひたし|お浸し|浅漬け|ナムル|ゼリー|ムース|アイス|ヨーグルト|冷奴|冷や奴/
/**
 * 最後の手順が火を使っている＝できたてが温かい品。
 * endsWithHeat は「盛り付け・味つけ」を読み飛ばして段階で見るため、
 * 「フライパンで豚肉を炒める。器に盛る。」のように1手順に炒めと盛り付けが同居する品を
 * 拾えない（同梱109品で炒めもの6品が漏れていた）。最後の手順の本文も直接見る。
 */
const HEAT_FINISH_PATTERN = /焼く|焼き|焼い|炒め|炒る|揚げ|煮|蒸|茹で|ゆで|炊|温め|熱し|加熱|レンジ|グリル|オーブン|沸か/

export function recipeServeTemp(
  recipe: Pick<Recipe, 'title' | 'steps' | 'dishType'>,
): ServeTemp {
  const steps = recipe.steps ?? []
  if (steps.length === 0) return 'neutral'
  if (steps.some((s) => CHILL_STEP_PATTERN.test(s.text))) return 'cold'
  if (COLD_TITLE_PATTERN.test(recipe.title ?? '')) return 'cold'
  // 汁物は「できたてが温かい品」として扱う（2026-08-13 便GB・docs/71 R3
  // 「平日の夕食で汁物が冷めきるのは、段取りとして失格です」）。
  // 最後の手順が「みそを溶いて火を止める」のように火を使う語を持たない書き方だと、
  // 下の加熱の判定では neutral になり、仕上げの順番がどちらにも寄らなかった。
  // 冷たい汁物（冷や汁・冷製スープ）は上の2つで先に cold と読むので、ここには落ちてこない
  if (recipe.dishType === 'soup') return 'hot'
  if (endsWithHeat(recipe)) return 'hot'
  return HEAT_FINISH_PATTERN.test(maskNonWaitNouns(steps[steps.length - 1].text)) ? 'hot' : 'neutral'
}

const SERVE_RANK: Record<ServeTemp, number> = { cold: 0, neutral: 1, hot: 2 }

/** 完成の順番に使う数字（小さいほど先に仕上げたい） */
export function serveTempRank(recipe: Pick<Recipe, 'title' | 'steps' | 'dishType'>): number {
  return SERVE_RANK[recipeServeTemp(recipe)]
}

/**
 * 「湯を沸かす」を段取りに差し込む（2026-08-08 便EG・オーナー実機報告
 * 「茹でる工程に湯を沸かすが考慮されていない」）。
 *
 * 多くのレシピは「〜をゆでる」とだけ書き、その前に必要な湯沸かしを手順にしていない。
 * 湯が沸くまでは手が空くので、**段取りの上でだけ**待ち工程として差し込む。
 * **レシピのデータ（手順本文）には一切書き込まない**（表示と計算だけの工程）。
 */

/** ゆでる工程の合図。masked（NON_WAIT_NOUN_PATTERN で伏せた）本文に対して使う */
const BOIL_STEP_PATTERN = /茹で|ゆで|湯がく|ゆがく/
/**
 * 「ゆで上がったら」「ゆでたじゃがいも」は、すでにゆで終わったものを指す言い方なので
 * 湯沸かしの合図にしない（同じ長さの伏せ字に置き換えて位置をずらさない）。
 */
const BOILED_ALREADY_PATTERN = /ゆで上が|茹で上が|ゆであが|ゆでた|茹でた/g
/** すでに湯を沸かす工程が書かれている（「鍋にたっぷりの湯を沸かし」「沸騰したら」） */
const BOIL_WATER_MENTION = /沸/

/**
 * 【ワンパンのレシピに、存在しない湯沸かしを足さない】2026-08-23 便KD・影響範囲テストC。
 *
 * 起きていた不具合（実データ「ワンパンミートソースパスタ」・画面から）:
 *   [20-25] 湯を沸かす（ナビが足した5分の待ち）
 *   [25-26] カットトマト缶、水、☆を加えて混ぜ、パスタを半分に折り入れて混ぜる。
 *           煮立ったらふたをし、中火で時々混ぜながら袋の表示時間より1分長くゆでる。
 * このレシピはフライパン1つで、ソースの中にパスタを直接入れて煮る。**別鍋で湯を沸かす工程は無い。**
 *
 * ゆでる工程そのものに「煮立ったら」と書いてある＝**液体はもう器に入っていて、沸くのを待っている**。
 * そこから先の加熱は本文が受け持っているので、手前に湯沸かしを足す余地がない。
 * 「たっぷりの湯に塩を入れ、スパゲッティをゆでる」（同梱 ペペロンチーノ）のような
 * **湯だけを別に沸かす**書き方には「煮立った」が出てこないので、今までどおり湯沸かしを足す。
 *
 * 見るのは**ゆでる工程そのものだけ**にする。前の手順まで見ると、
 * 「小鍋につゆを作る（煮立ったら火を止める）」→「鍋にたっぷりの湯を沸かし、うどんを茹でる」
 * （同梱 梅おろしぶっかけうどん）のように、**別の鍋の煮立ち**で本物の湯沸かしを消してしまう。
 */
const BOIL_ALREADY_IN_POT = /煮立/

/**
 * 湯が沸くまでの既定の待ち分数。
 * 根拠: 家庭のコンロ（約3kW相当の強火）で鍋1〜1.5Lの水を沸騰させるのにかかる目安が5分前後。
 * 待ち動詞の既定分数表（DEFAULT_WAIT_MINUTES の「沸か」）と同じ値にそろえてある
 * ＝手順に「湯を沸かす」と書いてあるレシピと、書いていないレシピで見積りが食い違わないようにするため。
 */
export const BOIL_WATER_MINUTES = 5

/** 段取りに載せる手順1つ（レシピの手順そのもの、またはナビが足した工程） */
export interface PlanStep {
  step: Step
  /** 元レシピの手順の添字（0始まり）。ナビが足した工程は負の値（重複しない一時的な鍵） */
  stepIndex: number
  /** 元レシピ内の手順番号（1始まり）。ナビが足した工程は 0（番号を持たない） */
  stepNumber: number
  /** ナビが段取りに足した工程か（レシピには書かれていない） */
  addedByNavi: boolean
  /**
   * レシピの1手順を段取りの上で2つに分けたとき、元がレシピの何番目の手順か
   * （2026-08-09 便ES・オーナー指示D-4「手順番号を③-1、③-2のようにして分割が分かる形に」）。
   * 湯沸かしを切り出した／前に差し込んだ場合の2つの工程に付く。分けていない手順では undefined。
   */
  splitOf?: number
  /** 分けた2つのうち何番目か（1 または 2） */
  splitPart?: 1 | 2
  /**
   * 待ちの手前だけを切り出した前半か（2026-08-13 便GD）。所要時間の見積りを
   * 断片として扱う（`estimateActiveMinutes` の leadIn）ための印。
   */
  leadIn?: boolean
  /**
   * ナビが差し込んだ待ちの**すぐ後ろ**の手順か（2026-08-13 便GD）。
   * 利用者はその待ちを書いていない＝その手順は待ちの明けるのを待って書かれたものではないので、
   * 待ちの中で進めてよい（「その間に」と同じ扱い）。
   */
  afterAddedWait?: boolean
}

/**
 * 「鍋にたっぷりの湯を沸かし、にんじんを2分茹でます。」のように、**湯沸かしとゆでる作業が
 * 1つの手順にまとまっている**ときの切れ目を探す（2026-08-09 便EH・オーナー実機報告
 * 「茹でるための湯沸かしが手順にない。茹で時間のみで待ち時間4分だが、沸かし始めから
 * 考えたらもっとかかる。もとのレシピでひとくくりにされているが、『沸かす』だけ分離できない?」）。
 *
 * 切り出すのは、湯を沸かす言い方が**読点・句点の直前**に来ている場合だけにする。
 * 「湯を沸かして塩を入れ、…」のように別の作業が挟まっているものは切らない
 * （切ると読める文にならないため。その場合は従来どおり1手順のまま扱う）。
 *
 * **レシピのデータは書き換えない**。段取りに載せるときの見え方だけを分ける。
 */
const BOIL_WATER_CLAUSE = /(沸かして|沸かし|沸かす|沸騰させて|沸騰させ)([、。，,])/
/** 切り出した前半を、単独の手順として読める形にそろえる（連用形→終止形） */
const BOIL_WATER_PLAIN_FORM: [RegExp, string][] = [
  [/沸かして$/, '沸かす'],
  [/沸かし$/, '沸かす'],
  [/沸騰させて$/, '沸騰させる'],
  [/沸騰させ$/, '沸騰させる'],
]
/** 湯沸かしの手前を切る区切り（句点・改行・読点）。後ろにあるものから順に試す */
const BOIL_HEAD_BOUNDARY = /[。．\n、，,]/g
/** 湯沸かしの工程として読める最小限の材料（この語が残らないところまでは切り詰めない） */
const BOIL_HEAD_CUE = /湯|水|鍋/

/**
 * 湯沸かしの言い回しの**手前**を、どこから読み始めれば湯沸かしだけの文になるかを探す
 * （2026-08-11 便FL・実画面から）。
 *
 * 起きていた不具合: `ほうれん草のおひたし` 手順1「ほうれん草は根元の土を流水でよく洗い落とす。
 * 鍋にたっぷりの湯を沸かし、根元から入れて1分ほどゆでる。」で、**手順の先頭から**「沸かし」までを
 * 湯沸かしの工程として切り出していたため、手作業の「洗い落とす」が丸ごと待ち5分に化けていた。
 *
 * 区切り（句点・読点）を後ろから順に試し、**湯・水・鍋の語が残る一番後ろの区切り**を採る。
 * 「鍋に水を入れて沸かし、」のように区切りの無い書き方は手順の先頭から（従来どおり）。
 */
function boilHeadStart(text: string, clauseEnd: number): number {
  let start = 0
  BOIL_HEAD_BOUNDARY.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = BOIL_HEAD_BOUNDARY.exec(text)) !== null) {
    const at = m.index + m[0].length
    if (at >= clauseEnd) break
    if (BOIL_HEAD_CUE.test(text.slice(at, clauseEnd))) start = at
  }
  return start
}

export function splitBoilWaterClause(
  text: string,
): { boilWater: string; rest: string } | undefined {
  const m = BOIL_WATER_CLAUSE.exec(text)
  if (!m) return undefined
  const clauseEnd = m.index + m[1].length
  // 湯沸かしの手前にある文・節（＝別の手作業）は待ちに巻き込まず、後ろの工程に残す
  const headStart = boilHeadStart(text, clauseEnd)
  const before = text.slice(0, headStart)
  const head = text.slice(headStart, clauseEnd).trim()
  const after = text.slice(m.index + m[0].length)
  const rest = (before + after).trim()
  if (!head || !after.trim()) return undefined
  // 切り出したあとの手順にゆでる作業が残っていること（作業そのものを消してしまわない）。
  // 見るのは湯沸かしより後ろだけ＝前に戻した手作業の文で判定しない
  const maskedAfter = maskNonWaitNouns(after).replace(BOILED_ALREADY_PATTERN, (x) =>
    '＊'.repeat(x.length),
  )
  if (!BOIL_STEP_PATTERN.test(maskedAfter)) return undefined
  let boilWater = head
  for (const [pattern, replacement] of BOIL_WATER_PLAIN_FORM) {
    if (pattern.test(boilWater)) {
      boilWater = boilWater.replace(pattern, replacement)
      break
    }
  }
  return { boilWater, rest }
}

/**
 * レシピの手順を、段取りに載せる形に展開する。
 *
 * 3つの手当てを順に掛ける（どれもレシピのデータは書き換えず、段取りの見え方だけを変える）:
 *   1. 湯沸かし（2026-08-09 便EH）… 「湯を沸かす」を差し込む／同じ手順の中から切り出す
 *   2. 沸くまでの待ち（2026-08-13 便GD）… 「中火にかける」で終わる手順の後ろに、
 *      **本文には書かれていない沸くまでの待ち**を差し込む
 *   3. 混在手順（2026-08-13 便GD）… 手作業と待ちが同居する手順を2つに分ける
 */
export function buildPlanSteps(steps: readonly Step[]): PlanStep[] {
  return splitMixedPlanSteps(addImpliedBoilWait(withBoilWaterStep(steps)))
}

/**
 * 湯沸かしを段取りに載せる（必要なら「湯を沸かす」を1つ足す）。
 *
 * 1レシピにつき1回まで（鍋を何度も沸かす想定はしない）。次の2通りがある:
 *   - ゆでる工程はあるが湯沸かしがどこにも書かれていない → 「湯を沸かす」を直前に差し込む
 *   - 湯沸かしがゆでる工程と**同じ手順の中に**書かれている → その部分だけを前の工程に切り出す
 *     （2026-08-09 便EH。沸かし始めからの時間が段取りに乗らず、待ちが短く出ていた）
 * 前の手順ですでに湯を沸かしているレシピには何もしない。
 */
function withBoilWaterStep(steps: readonly Step[]): PlanStep[] {
  const plain = steps.map((s, i) => ({
    step: s,
    stepIndex: i,
    stepNumber: i + 1,
    addedByNavi: false,
  }))
  const masked = steps.map((s) =>
    maskNonWaitNouns(s.text).replace(BOILED_ALREADY_PATTERN, (m) => '＊'.repeat(m.length)),
  )
  const boilAt = masked.findIndex((t) => BOIL_STEP_PATTERN.test(t))
  if (boilAt === -1) return plain
  // 前の手順ですでに湯を沸かしていれば何もしない
  if (masked.slice(0, boilAt).some((t) => BOIL_WATER_MENTION.test(t))) return plain
  // 分けた2つには「③-1」「③-2」の番号を付ける（2026-08-09 便ES）。
  // stepIndex（カーソル・タイマー・手順カードのidに使う識別子）は従来のまま変えない
  const addedAt = (text: string): PlanStep => ({
    step: { text, minutes: BOIL_WATER_MINUTES },
    stepIndex: -1,
    stepNumber: 0,
    addedByNavi: true,
    splitOf: boilAt + 1,
    splitPart: 1,
  })
  if (BOIL_WATER_MENTION.test(masked[boilAt])) {
    // 同じ手順の中に湯沸かしが書かれている＝そこだけを前の工程として切り出す
    const split = splitBoilWaterClause(steps[boilAt].text)
    if (!split) return plain
    const rest: PlanStep = {
      ...plain[boilAt],
      step: { ...steps[boilAt], text: split.rest },
      splitOf: boilAt + 1,
      splitPart: 2,
    }
    return [...plain.slice(0, boilAt), addedAt(split.boilWater), rest, ...plain.slice(boilAt + 1)]
  }
  // 「煮立ったら…ゆでる」＝液体はもう器の中。別鍋の湯沸かしは足さない（2026-08-23 便KD）
  if (BOIL_ALREADY_IN_POT.test(masked[boilAt])) return plain
  const boiled: PlanStep = { ...plain[boilAt], splitOf: boilAt + 1, splitPart: 2 }
  return [
    ...plain.slice(0, boilAt),
    addedAt(ja.cookNavi.addedBoilWaterStep),
    boiled,
    ...plain.slice(boilAt + 1),
  ]
}

/**
 * 本文に書かれていない「沸くまでの待ち」を差し込む（2026-08-13 便GD・docs/72 対象2）。
 *
 * 直した不具合（docs/71 R3）:
 *   「鍋に水とだしの素を入れて**中火にかける**。」→ **手作業2分**だけが段取りに乗り、
 *   沸くまでの4〜5分が1秒も計上されていなかった。R3の言葉では
 *   「結果、実際にはここで3分立ち尽くします」。
 *
 * **拾いすぎると危険側の誤判定（S1）が増える**（熱しているフライパンから目を離させる）。
 * そこで合図を2つとも満たすときだけに絞る:
 *   1. その手順が**「火にかける」で終わっている**（かけたあとに何もしない＝そこで手が離れる）。
 *      「火にかけ、煮立ったらアクを取る」のように同じ手順で作業が続く書き方は対象にしない
 *   2. **同じレシピの後ろの手順に「沸いたら」「煮立ったら」がある**
 *      ＝沸くのを待つ工程があることを利用者自身が書いている
 * 2が無ければ何も足さない（「フライパンを中火にかける」だけの手順は今までどおり手作業）。
 *
 * 湯沸かしをすでに1つ足したレシピには足さない（鍋を何度も沸かす想定はしない＝上と同じ扱い）。
 */
/** 「火にかける」で手順が終わっている（かけたあとの作業が書かれていない） */
const HEAT_ON_END_PATTERN = /火に(?:かけ|掛け)(?:る|ます|た|ました)?[。．]?$/
/** 沸いたことを前提にした後ろの手順（＝沸くのを待つ工程がある証拠） */
const BOIL_ARRIVAL_PATTERN = /沸いた|沸騰した|沸騰して|煮立った|煮立ってき|沸いてき|わいたら/

function addImpliedBoilWait(plan: PlanStep[]): PlanStep[] {
  if (plan.some((p) => p.addedByNavi)) return plan
  const at = plan.findIndex(
    (p) =>
      HEAT_ON_END_PATTERN.test(maskNonWaitNouns(stepMainText(p.step.text ?? '')).trim()) &&
      classifyStep(p.step) === 'active',
  )
  if (at === -1) return plan
  const arrives = plan
    .slice(at + 1)
    .some((p) => BOIL_ARRIVAL_PATTERN.test(maskNonWaitNouns(stepMainText(p.step.text ?? ''))))
  if (!arrives) return plan
  const waiting: PlanStep = {
    step: { text: ja.cookNavi.addedBoilWaitStep, minutes: BOIL_WATER_MINUTES },
    stepIndex: -1,
    stepNumber: 0,
    addedByNavi: true,
    splitOf: plan[at].stepNumber,
    splitPart: 2,
  }
  // 沸くのを待つ間、利用者が書いた次の手順は進めてよい（その待ちは利用者が書いたものではなく、
  // ナビが差し込んだもの＝次の手順がそれを待って書かれているはずがない）。
  // ただし**その次の手順自体が「沸いたら」で始まる**ときは別＝沸くのを待つ工程そのものなので、
  // 待ちの中に置いてはいけない（「沸騰したら卵を入れる」を沸く前にやらせない）
  const after = plan[at + 1]
  const afterWaitsForBoil =
    after != null && BOIL_ARRIVAL_PATTERN.test(maskNonWaitNouns(stepMainText(after.step.text ?? '')))
  return [
    ...plan.slice(0, at),
    { ...plan[at], splitOf: plan[at].stepNumber, splitPart: 1 },
    waiting,
    ...(after ? [{ ...after, afterAddedWait: !afterWaitsForBoil }] : []),
    ...plan.slice(at + 2),
  ]
}

/**
 * 手作業と待ちが同居する手順を、段取りの上で2つに分ける（2026-08-13 便GD・`splitMixedStep`）。
 *
 * 分けた2つの識別子（`stepIndex`。カーソル・タイマー・手順カードの id に使う）は
 * **必ず別の値**にする＝同じ値だと「次へ」が同じ手順に戻る。
 * 前半が元の添字をそのまま持ち、後半（待ち）は負の値を持つ
 * （湯沸かしの -1 とぶつからないよう -2 から下を使う）。
 * すでに湯沸かしで分けた手順は二重に分けない（番号が「3-1-2」のようになってしまう）。
 */
function splitMixedPlanSteps(plan: PlanStep[]): PlanStep[] {
  const out: PlanStep[] = []
  for (const item of plan) {
    if (item.addedByNavi || item.splitOf != null || item.stepIndex < 0) {
      out.push(item)
      continue
    }
    const split = splitMixedStep(item.step)
    if (split) {
      out.push({ ...item, step: split.active, splitOf: item.stepNumber, splitPart: 1, leadIn: true })
      out.push({
        ...item,
        step: split.wait,
        stepIndex: -(item.stepIndex + 2),
        splitOf: item.stepNumber,
        splitPart: 2,
      })
      continue
    }
    // 待ちが先・手作業が後ろの同居（「水につけてもどし、水気を絞ってざく切りにする」）
    const waitFirst = splitWaitFirstStep(item.step)
    if (waitFirst) {
      out.push({ ...item, step: waitFirst.wait, splitOf: item.stepNumber, splitPart: 1 })
      out.push({
        ...item,
        step: waitFirst.active,
        stepIndex: -(item.stepIndex + 2),
        splitOf: item.stepNumber,
        splitPart: 2,
      })
      continue
    }
    out.push(item)
  }
  return out
}

/**
 * 画面に出す「そのレシピ内での手順番号」（2026-08-09 便ES・オーナー指示D-4）。
 * レシピの1手順を段取りの上で2つに分けた工程は「3-1」「3-2」。
 * 番号を持たない工程（分けていないナビ追加の工程）は undefined。
 */
export function recipeStepLabel(item: {
  stepNumber: number
  splitOf?: number
  splitPart?: 1 | 2
}): string | undefined {
  if (item.splitOf != null && item.splitPart != null) return `${item.splitOf}-${item.splitPart}`
  return item.stepNumber > 0 ? String(item.stepNumber) : undefined
}

/** レシピの色分け用パレット添字（0,1,2）。CookNaviPage 側で CSS 変数のチップ色に対応づける */
export interface TimelineRecipe {
  id: number
  title: string
  colorIndex: number
  /**
   * その品を1品だけで作ったときの目安（分。2026-08-11 便FN・利用者テストの指摘
   * 「レシピ一覧の所要時間の合計35分に対して、段取りは『1品ずつ作ると約41分』。
   *   別の3品では一覧の合計95分に対して80分。多く出たり少なく出たりする」）。
   *
   * ナビの分数はレシピ欄の「調理時間」とは別の数え方（手順ごとの見積りを積み上げ、
   * 手順に時間の書かれていない工程は調理法から当てる）なので、両者は一致しない。
   * 品ごとの内訳を出しておけば、合計がどこから来た数字かを画面の上で確かめられる。
   * この値の合計が CookPlan.sequentialMinutes（「1品ずつ作ると約◯分」）になる。
   *
   * 任意項目にしてあるのは、単体の buildCookTimeline は自分自身を1品ずつ呼び直せない
   * （無限に入れ子になる）ため。値を入れるのは buildCookPlan だけ。
   */
  soloMinutes?: number
  /**
   * その品の**手順の分数を単純に足した合計**（分。2026-08-14 便GK・実操作テスト3回目）。
   *
   * 原文:「鶏の手順は 10＋3＋2＋15＋4＝34分。なのに『1品だけなら約31分』。
   *   ごま和えは12分、みそ汁は13分でどちらもぴったり合うのに鶏だけ3分合わない」
   *
   * 食い違いの正体は**重なり**。利用者が本文に書いた「その間に」の手順（2026-08-13 便GB）と、
   * ナビが差し込んだ「沸くのを待つ」の直後の手順（同 便GD）は、その品の待ちの**中**に置かれる。
   * だから品の所要時間には二重に足されない。数字はどちらも正しいのに、画面が
   * その重なりを何も言っていなかったため「合わない」としか読めなかった。
   * この値と `soloMinutes` の差が重なりぶんで、差があるときだけ画面に一文を添える。
   */
  stepSumMinutes?: number
}

/** 1本にまとめたタイムラインの1手順 */
export interface TimelineItem {
  /** 表示上の通し番号（1始まり） */
  order: number
  recipeId: number
  recipeTitle: string
  /** 0,1,2 のレシピ色添字 */
  colorIndex: number
  /** 元レシピ内の手順番号（1始まり。タイマー起動やレシピ内の位置表示に使う）。ナビが足した工程は0 */
  stepNumber: number
  /** 元レシピ内の手順の添字（0始まり）。ナビが足した工程は負の値 */
  stepIndex: number
  /** ナビが段取りに足した工程か（レシピの手順には無い。2026-08-08 便EG） */
  addedByNavi: boolean
  /** レシピの1手順を段取りの上で2つに分けたときの、元の手順番号（2026-08-09 便ES） */
  splitOf?: number
  /** 分けた2つのうち何番目か（1 または 2） */
  splitPart?: 1 | 2
  text: string
  memo?: string
  minutes?: number
  kind: StepKind
  /** 待ち系のときの待ち分数（手作業系は0。長い待ちも0＝時間の計算に入れない） */
  waitMinutes: number
  /**
   * 待ち分数が「手順に書かれていない」ため調理法から当てた既定値かどうか（2026-08-08 便ED）。
   * 画面では目安であることを添えて出す（書いてある分数と同じ顔で出さない）。
   */
  waitEstimated: boolean
  /**
   * 「半日〜一晩漬ける」のように、今回の調理では終わらない長い待ちか（2026-08-11 便FL）。
   * 手順は段取りに残したまま、時間の計算からだけ外す。画面では分数を出さず、
   * 今回の調理では仕上がらないことを添えて出す。
   */
  longRest: boolean
  /**
   * 手作業のときの目安の所要時間（分）。待ち系は0（2026-08-09 便EH・オーナー指示
   * 「炒めたりする工程でも単品レシピの手順では目安時間が書いてあるのに並行ではない。
   * 手順カードの右下（完成ある場合は上）に目安時間入れて」）。
   */
  activeMinutes: number
  /** その所要時間が、レシピに書かれた時間ではなくナビの見積りか */
  activeEstimated: boolean
  /** 開始からの目安の開始位置（分）。おおよその並び計算用 */
  startMin: number
  /** 目安の終了位置（分） */
  endMin: number
}

export interface CookTimeline {
  items: TimelineItem[]
  /** 全体の目安（分）。手作業の仮所要も含むおおよその値 */
  totalMinutes: number
  recipes: TimelineRecipe[]
}

interface Job {
  recipeId: number
  title: string
  colorIndex: number
  /** 出したい温度（冷やす=0 / どちらでもない=1 / 熱々=2。完成の順番を決めるのに使う） */
  serveRank: number
  steps: {
    stepIndex: number
    stepNumber: number
    addedByNavi: boolean
    splitOf?: number
    splitPart?: 1 | 2
    text: string
    memo?: string
    minutes?: number
    kind: StepKind
    waitMinutes: number
    waitEstimated: boolean
    /** 今回の調理では終わらない長い待ちか（2026-08-11 便FL） */
    longRest: boolean
    activeMinutes: number
    activeEstimated: boolean
    category: StepCategory
    stageRank: number
    /** 切る工程の中での順番（0=野菜など / 1=生の肉・魚。切る工程どうしのときだけ使う） */
    cutRank: number
    /** 漬け込み・寝かせの待ちか（先に切る工程を済ませたい待ち。2026-08-08 便EG） */
    soakWait: boolean
    /**
     * その待ちを仕掛けたあと、遅くとも何分後までに手を戻さないといけないか（2026-08-09 便EH）。
     * ゆでる=待ち時間ちょうど／煮込み=待ち時間+2割／漬け込み・冷やす=上限なし
     */
    attendWithin: number
    /**
     * 利用者が本文に「その間に」と書いた手順で、**直前の手順が待ち**のもの（2026-08-13 便GB）。
     * この手順だけは、直前の待ちが明けるのを待たずに着手してよい。
     */
    parallelCue: boolean
    /** ナビが差し込んだ待ちの直後の手順か（2026-08-13 便GD。parallelCue と同じ扱いにする） */
    afterAddedWait: boolean
    /** 手作業と待ちが同居する手順を分けた**前半**か（2026-08-13 便GD） */
    leadIn: boolean
    /** その工程が使う器具（2026-08-13 便GC・docs/72 第3段）。使わない工程は null */
    applianceKey: ApplianceKey | null
    /** その工程のあと、その品がコンロの火にかかったまま残るか（2026-08-14 便GG） */
    heatShift: HeatShift
    /**
     * その工程が器具を**ふさぐ**か。
     * 待ちのうち、**待ちに入る時点でもう器具から下りている**もの（「火を止めてそのまま10分おく」・
     * 冷蔵庫で冷やす等）はふさがない＝`waitKeepsAppliance`
     * （docs/72 §3「占有する待ち＝煮る・焼く／占有しない待ち＝漬ける・冷ます・寝かせる」）。
     * **手を戻す締め切り（waitUrgency）とは別の軸**。混ぜていたせいで、レンジ加熱の文が
     * 「〜2分おく」で終わると relaxed に倒れてレンジを押さえなかった（2026-08-23 便KD）。
     */
    occupies: boolean
  }[]
  /** 次に着手する手順の添字 */
  ptr: number
  /** 次の手順を始められるようになる時刻（前の手順の終了 or 待ちの完了） */
  readyAt: number
  /**
   * 直前に仕掛けた待ちが明ける時刻（2026-08-13 便GB）。
   * ふつうは readyAt と同じだが、「その間に」の手順を待ちの中に置いたときだけ readyAt が
   * 先に進む（＝手は空く）ので、待ちそのものの終わりを別に覚えておく。
   */
  waitDoneAt: number
  /**
   * 「この時刻までに手を戻さないといけない」待ちを仕掛けている状態（0＝無し。2026-08-09 便EH）。
   * ゆで上がり・煮上がりの時刻。ここを過ぎて別の作業を続ける段取りは物理的に成立しない。
   */
  attendUntil: number
  /**
   * その品がいまコンロの火にかかったままか（2026-08-14 便GG・docs/72 第5段）。
   * 待ちの工程だけでなく、**手作業で鍋に手を入れて火にかけたまま次へ進んだ**状態も持つ。
   */
  onHeat: boolean
}

function buildJobs(recipes: Recipe[], kitchen: KitchenEquipment): Job[] {
  const jobs = recipes
    .filter((r) => r.id != null && r.steps.length > 0)
    .map((r, colorIndex) => ({
      recipeId: r.id!,
      title: r.title,
      colorIndex,
      serveRank: serveTempRank(r),
      ptr: 0,
      readyAt: 0,
      waitDoneAt: 0,
      attendUntil: 0,
      onHeat: false,
      steps: buildPlanSteps(r.steps).map(({ step: s, stepIndex, stepNumber, addedByNavi, splitOf, splitPart, leadIn, afterAddedWait }) => {
        const kind = classifyStep(s)
        // 待ちの分数は明示 minutes ＞本文の時間表記＞調理法ごとの既定分数の順で解決する
        // （classifyStep が wait を返した時点で resolveWaitMinutes は必ず値を持つ）。手作業系の
        // 順序計算は従来どおり明示 minutes か DEFAULT_ACTIVE_MINUTES を使う（推定は待ちの認識
        // だけに使い、手作業の所要時間は変えない＝順序への影響を待ち認識の改善だけに限定する）
        // 「半日〜一晩漬ける」のように今回の調理では終わらない待ちは、手順として段取りに残しつつ
        // 時間の計算からは外す（2026-08-11 便FL）。分数を数えると全体の見積りがその分だけ嘘になる
        const longRest = kind === 'wait' && isLongRestStep(s)
        const waitMinutes = kind === 'wait' && !longRest ? (resolveWaitMinutes(s) ?? 0) : 0
        // 手作業の所要時間は、作業の種類と手順文の長さから見積る（2026-08-09 便EH）。
        // 従来の一律4分では、待ち時間に入る工程数の計算がそのままずれていた
        // 待ちの手前だけを切り出した前半は「断片」として短く見積る（2026-08-13 便GD）
        const active = estimateActiveMinutes(s, { leadIn })
        // どの器具をふさぐか（2026-08-13 便GC）。持っていない器具の工程はコンロ1口として数える
        const applianceKey = stepApplianceFor(s.text, kitchen)
        // 器具をふさぐかは「器具が動いているか」だけで決める（2026-08-23 便KD）。
        // 手を戻す締め切り（waitUrgency）はこことは別の軸なので混ぜない
        const occupies =
          applianceKey != null &&
          (kind === 'wait'
            ? !longRest && waitMinutes > 0 && waitKeepsAppliance(s)
            : active.minutes > 0)
        return {
          stepIndex,
          stepNumber,
          addedByNavi,
          splitOf,
          splitPart,
          text: s.text,
          memo: s.memo,
          minutes: s.minutes,
          kind,
          waitMinutes,
          longRest,
          // 手順に時間が書かれておらず、調理法から当てた分数で待ちにした手順
          // （ナビが足した工程は分割の番号「◯-1」で示すので、ここでは印を出さない。
          //   長い待ちは分数そのものを出さないので、分数への断りも出さない）
          waitEstimated:
            kind === 'wait' && !longRest && !addedByNavi && resolveStepMinutes(s) == null,
          activeMinutes: kind === 'active' ? active.minutes : 0,
          activeEstimated: kind === 'active' && active.estimated,
          category: stepCategory(s),
          stageRank: stepStageRank(s),
          cutRank: cutOrderRank(s),
          soakWait: kind === 'wait' && isSoakWait(s),
          attendWithin:
            kind !== 'wait'
              ? 0
              : // 長い待ちは手を戻す締め切りを持たない（何分後に戻るという話ではない）
                longRest
                ? Number.POSITIVE_INFINITY
                : waitMinutes + waitOverrunAllowance(s, waitMinutes),
          parallelCue: false,
          afterAddedWait: afterAddedWait === true,
          leadIn: leadIn === true,
          applianceKey,
          occupies,
          heatShift: stepHeatShift(s, kitchen),
        }
      }),
    }))
  // 「その間に」の合図は、**直前の手順が待ちのときだけ**有効にする（2026-08-13 便GB）。
  // 合図だけで手順を前へ飛ばさない＝利用者が指している待ちが実際にあるときに限る。
  // ナビが差し込んだ「沸くまでの待ち」の直後の手順も同じ扱いにする（2026-08-13 便GD）。
  // その待ちは利用者が書いたものではないので、次の手順がそれを待って書かれているはずがない
  // （R3のみそ汁「中火にかける→豆腐を切る→沸いたら入れる」は、豆腐を切るのが沸くのを待つ間）
  for (const job of jobs) {
    for (let i = 1; i < job.steps.length; i++) {
      const prev = job.steps[i - 1]
      const step = job.steps[i]
      step.parallelCue =
        step.kind === 'active' &&
        prev.kind === 'wait' &&
        prev.waitMinutes > 0 &&
        (hasParallelCue(step.text) || step.afterAddedWait)
    }
  }
  return jobs
}

/**
 * そのレシピを今から1品だけで作り切った場合に残る時間（分）＝残りの待ちと手作業の合計。
 * 「残りが長い品ほど先に手を付ける」ための指標（2026-08-08 便EB）。
 *
 * 従来の maxRemainingWait（残りで**いちばん長い1つの待ち**だけを見る）を置き換える。
 * 旧指標は待ちの本数も、待ちにたどり着くまでの手作業の量も見ないため、
 * 「5分の待ちが3回ある品」より「20分の待ちが最後に1回だけある品」を必ず優先し、
 * 前者の仕掛けが遅れて全体が伸びていた。残り時間の合計にすると、待ちの本数・
 * そこまでの手作業も含めて「あとどれだけ掛かる品か」で比べられる。
 * 待ちが1本しかない単純なレシピでは従来と同じ順番になる（後方互換）。
 */
function remainingSpan(job: Job): number {
  let total = 0
  for (let i = job.ptr; i < job.steps.length; i++) {
    total += job.steps[i].kind === 'wait' ? job.steps[i].waitMinutes : job.steps[i].activeMinutes
  }
  return total
}

/** その品に残っている「手を動かす時間」の合計（分。2026-08-13 便GB） */
function remainingActive(job: Job): number {
  let total = 0
  for (let i = job.ptr; i < job.steps.length; i++) {
    if (job.steps[i].kind !== 'wait') total += job.steps[i].activeMinutes
  }
  return total
}

/**
 * 「着火」とみなす待ちの長さ（分。2026-08-13 便GB・docs/72 第2段 対象1）。
 *
 * これ以上の放置調理は、始めるのが遅れたぶんだけ全体がそのまま伸びる＝**その品の残りの
 * 手作業より先に仕掛けたい**。8分は N3（放置調理の取りこぼし）の物差しと同じ値にそろえてある。
 * これ未満の待ち（レンジ3分・2分温める）は、順番を入れ替えても全体はほとんど変わらないので
 * 従来の並べ方に任せる。
 */
const IGNITION_WAIT_MINUTES = 8

/** その品に、これから仕掛ける長い放置調理（着火）が残っているか */
function hasIgnitionAhead(job: Job): boolean {
  for (let i = job.ptr; i < job.steps.length; i++) {
    const step = job.steps[i]
    if (step.kind === 'wait' && step.waitMinutes >= IGNITION_WAIT_MINUTES) return true
  }
  return false
}

/**
 * 【着火ごと後ろへ回す】2026-08-14 便GG・docs/72 第5段。
 *
 * 利用者の手順そのもの: 「私はみそ汁は一番最後にやります。**だしを張って火にかけるのは
 * グリルに入れてから**、豆腐を入れて味噌を溶くのは焼き上がりの3分前。」
 *
 * いま出そうとしている一手が「火をつけて、止めるまで続く一連の工程」の入口かどうか。
 * 2026-08-13 便GBの「仕上げを寄せる」は**最後の1手だけ**を後ろへ送っていたので、
 * 火はついたまま仕上げだけが遅れていた（＝利用者の言う「10分ぐつぐつ煮え続ける」）。
 * 入口ごと送れば、火のついている時間そのものが動く。
 */
function startsHeatRun(job: Job): boolean {
  if (job.onHeat) return false
  if (job.steps[job.ptr]?.heatShift !== 'on') return false
  // ptr から最後まで、火をつけたあと途中で下ろさずに続くか（最後の一手で下ろすのはよい）
  let on = false
  for (let i = job.ptr; i < job.steps.length; i++) {
    const shift = job.steps[i].heatShift
    if (shift === 'on') on = true
    else if (shift === 'off') return on && i === job.steps.length - 1
  }
  return on
}

/** 後ろへ回すときに動かす長さ（分）。一連の工程ごと回すなら、その品の残り全部 */
function heldSpan(job: Job): number {
  return startsHeatRun(job) ? remainingSpan(job) : job.steps[job.ptr].activeMinutes
}

/**
 * 前倒ししてまで先に着火する放置調理の長さ（分。2026-08-13 便GC・docs/72 第3段 B）。
 *
 * 着火とみなす下限（IGNITION_WAIT_MINUTES＝8分）より長くしてある。実測すると、
 * **8〜12分の放置調理まで前倒しすると、その品だけが早く仕上がって完成の開き（N1）が広がる**
 * （野生＋ホールドアウト344通りで、30%超の割合が 25.0%→25.9% に悪化した）。
 * 15分以上の放置調理は、始めるのが遅れたぶんだけ段取り全体がそのまま伸びるので、
 * 前倒しの得が開きの損を上回る（同梱109品の平均短縮率 33.0%→33.2%）。
 */
const IGNITION_PULL_MINUTES = 15

/**
 * **あと1手で着火できる**品か（2026-08-13 便GC・docs/72 第3段 B）。
 * いま進めようとしている手順の次が、長い放置調理（15分以上）そのもののとき。
 * 口数に余裕があるときだけ、この品を先に進めて**火を重ねる**ために使う。
 */
function ignitesNext(job: Job): Job['steps'][number] | undefined {
  const next = job.steps[job.ptr + 1]
  if (!next) return undefined
  if (next.kind !== 'wait' || next.waitMinutes < IGNITION_PULL_MINUTES) return undefined
  return next
}

/**
 * 【別の鍋に移る前に、火を止める／弱火にする】2026-08-15 便GO・docs/72 第7段。
 *
 * 利用者（料理歴20年・自分で登録したレシピで実操作）の原文:
 *   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が
 *     挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と
 *     書いてあるのに。豆腐は崩れるしわかめは溶けます。
 *     **#7の後に「火を止める」も「弱火にする」も出てきません。**」
 *
 * 便GMが該当108件を全部書き出した結果、**残り89件はすべて「鍋が2つ同時に手を待っている」場面**で、
 * 手は1組しかないため片方は必ず待たされることが分かった（手が空いていたのに戻り遅れた例は0件）。
 * 並べ替えでは移動するだけで消えず、着火を見合わせれば短縮率と引き換えになる。
 * **実際の台所では、別の鍋に移る前に火を弱めるか止める。** それを段取りの一手として出す。
 *
 * ## レシピ本文は書き換えない（規約D）
 * 「湯を沸かす」「火にかけたまま、沸くのを待つ」と同じ作法で、**段取りの上にだけ**工程を足す
 * （`addedByNavi`）。レシピのデータには一切書き込まない。
 *
 * ## 「止める」と「弱くする」の分け方
 * **火を止めてよいのは、その鍋の加熱がもう仕事を終えているときだけ。**
 *   - 足す位置は必ず**加熱に関わる工程が終わった瞬間**（`leftAt`）なので、
 *     「煮汁が少なくなるまで煮る」の**最中**に止めることは構造上起こらない
 *     （待ちの途中には足さない＝レシピが指定した加熱時間は必ず最後まで通る）
 *   - そのうえで、**その品の残りの工程に火を必要とするものが1つでもあれば「弱火にする」**。
 *     止めると鍋を温め直すことになり、「沸いた湯に卵を入れる」「続けて煮る」がその場で
 *     成立しなくなる（段取りの見積りも狂う）
 *   - 残りに火を使う工程が1つも無ければ、その鍋の火はもう仕事を終えている＝**「火を止める」**
 *     （「器に盛る」「つぶす」「冷水にとる」「ご飯にかける」で終わる品）
 *
 * 「火を必要とする工程」は `heatShift === 'on'` だけでは足りない（`needsFire`）。
 * 「煮汁がほとんどなくなったら火を止め、そのまま冷ます」「弱火にしてみそを溶き入れ、
 * 煮立つ直前で火を止めます」は**工程全体としては火が下りる（'off'）が、その工程の間は火の上にいる**。
 * ここで先に止めると、煮詰める・溶かすというレシピの意図がその場で消える
 * （＝まさに「加熱の途中で止めたら料理が変わる」型）。**工程の終わりに火が下りる書き方
 * （`heatOffAtEnd`）は、火を必要とする側に数える。**
 * 迷う型は**弱火**に倒す＝加熱を途中で断ち切らない側（料理を壊さない側）。
 *
 * ## 出しすぎない
 * 足すのは**猶予を本当に超える場面だけ**（待ちの猶予は `waitOverrunAllowance`、
 * 待ちでない工程は `HEAT_HOLD_ALLOWANCE`＝3分。監査 N7 と同じ数え方）。
 * 1つの火のあいだに同じ一手は繰り返さない。
 *
 * ## 時間
 * この一手は0分（コンロのつまみを回すだけ）。段取りの長さは1分も動かないので、
 * 短縮率（E1・E2・E5'）には影響しない。
 *
 * **口の予約は返さない**（火を止めた鍋の口を空きとして数え直すと、段取りそのものが組み替わり、
 * ほかの項目の値が動く）。ここでやるのは「一手を足すこと」だけに絞る。
 */
export type HeatBreakKind = 'off' | 'low'

/**
 * ナビが足す「火を止める／弱火にする」工程の識別子（レシピ内で重ならない負の値）。
 * 湯沸かしは -1、混在手順を分けた後半は -(元の添字+2) を使うので、そこから離した値にする。
 */
const HEAT_BREAK_STEP_INDEX_BASE = -1000

/**
 * その工程のあと、鍋が火にかかったまま次の一手を待てる時間（分）。
 * 待ちはもともとの超過許容（煮込みなら待ちの2割・上限5分）と3分の大きいほうを使う
 * ＝**既存の締め切りを緩めも縮めもしない**（監査 N7 の `heatAllowanceOf` と同じ）。
 */
function heatBreakAllowance(item: TimelineItem): number {
  if (item.kind !== 'wait') return HEAT_HOLD_ALLOWANCE
  const over = waitOverrunAllowance({ text: item.text, minutes: item.minutes }, item.waitMinutes)
  return Number.isFinite(over) ? Math.max(HEAT_HOLD_ALLOWANCE, over) : Number.POSITIVE_INFINITY
}

/**
 * 足した一手を置く位置。
 *
 * **その時刻にもう始まっている工程の後ろ・その時刻から始まる工程の前**に置く
 * （＝手が空いた瞬間に「別の鍋に移る前に」やる一手として読める）。
 * 待ちが明けた時刻が別の品の作業の途中に当たる場合だけ、その作業の後ろに並ぶ
 * （つまみを回すだけの一手なので、手を止めて寄る形になる）。
 */
function heatBreakPosition(items: readonly TimelineItem[], at: number, before: number): number {
  let pos = 0
  for (let j = 0; j < items.length; j++) if (items[j].startMin < at) pos = j + 1
  return Math.min(pos, before)
}

function makeHeatBreakItem(
  ref: TimelineItem,
  kind: HeatBreakKind,
  at: number,
  seq: number,
): TimelineItem {
  const text = kind === 'off' ? ja.cookNavi.addedHeatOffStep : ja.cookNavi.addedHeatLowStep
  return {
    // 通し番号は差し込んだあとに振り直す
    order: 0,
    recipeId: ref.recipeId,
    recipeTitle: ref.recipeTitle,
    colorIndex: ref.colorIndex,
    stepNumber: 0,
    stepIndex: HEAT_BREAK_STEP_INDEX_BASE - seq,
    addedByNavi: true,
    // **どの品の火かを本文に書く**（複数の鍋が動いているので、取り違えると別の料理が止まる）。
    // レシピの手順は「いま向き合っている鍋」の話だが、この一手だけは**別の鍋に手を伸ばす**指示
    text: text.replace('{title}', ref.recipeTitle),
    kind: 'active',
    waitMinutes: 0,
    waitEstimated: false,
    longRest: false,
    // つまみを回すだけ＝0分。段取りの長さを1分も動かさない
    activeMinutes: 0,
    activeEstimated: false,
    startMin: at,
    endMin: at,
  }
}

/**
 * 組み上がった段取りに「火を止める／弱火にする」を差し込む（上の説明を参照）。
 * 純関数。渡した配列は書き換えない。
 */
export function insertHeatBreakSteps(
  items: readonly TimelineItem[],
  kitchen: KitchenEquipment = DEFAULT_KITCHEN,
): TimelineItem[] {
  const steps = items.map((it) => ({ text: it.text, minutes: it.minutes, memo: it.memo }))
  const shifts = steps.map((step) => stepHeatShift(step, kitchen))
  /** その工程は火を必要とするか（工程の終わりに火が下りる書き方も、その間は火の上） */
  const needsFire = steps.map((step, i) => shifts[i] === 'on' || heatOffAtEnd(step))
  /**
   * 手でタネを扱う工程（こねる・形を作る）。**そこへ入るまでの空きは放置ではない**ので、
   * 火の一手も足さない（2026-08-15 便GM。ボウルの中の作業＝中身は鍋から出ている）。
   * 監査 N7 が数えない場面と、足す場面をそろえる。
   */
  const offByHand = steps.map((step) =>
    OFF_HEAT_BY_HAND_PATTERN.test(maskNonWaitNouns(stepMainText(step.text))),
  )
  const byRecipe = new Map<number, number[]>()
  items.forEach((it, i) => {
    const list = byRecipe.get(it.recipeId)
    if (list) list.push(i)
    else byRecipe.set(it.recipeId, [i])
  })

  const inserts: { pos: number; item: TimelineItem }[] = []
  for (const [, idxs] of byRecipe) {
    /** 遅くともこの時刻までにその鍋へ手を戻す（null＝火にかかっていない） */
    let dueAt: number | null = null
    /** その鍋から手が離れた時刻（＝足す一手を置く時刻） */
    let leftAt = 0
    /** いまの火のあいだにもう足した一手（同じ一手を繰り返さない） */
    let lastBreak: HeatBreakKind | null = null
    let added = 0
    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k]
      const item = items[i]
      if (dueAt != null && item.startMin > dueAt && !offByHand[i]) {
        // 火にかけたまま、次にその品へ手が戻るのが猶予を過ぎる場面
        const needsHeatAgain = idxs.slice(k).some((j) => needsFire[j])
        const kind: HeatBreakKind = needsHeatAgain ? 'low' : 'off'
        if (kind !== lastBreak) {
          inserts.push({
            pos: heatBreakPosition(items, leftAt, i),
            item: makeHeatBreakItem(item, kind, leftAt, added++),
          })
          if (kind === 'off') {
            // 火が下りた＝この鍋の締め切りは無くなる
            dueAt = null
            lastBreak = null
          } else {
            // 弱火のまま＝火は続くので、締め切りはそこから数え直す
            dueAt = leftAt + HEAT_HOLD_ALLOWANCE
            lastBreak = kind
          }
        }
      }
      const shift = shifts[i]
      if (shift === 'off') {
        dueAt = null
        lastBreak = null
      } else if (shift === 'on') {
        const allowance = heatBreakAllowance(item)
        dueAt = Number.isFinite(allowance) ? item.endMin + allowance : null
        leftAt = item.endMin
        lastBreak = null
      } else if (dueAt != null) {
        // 火にかかったまま別の一手を挟んだ（「その間に」等）。鍋の締め切りは早まらない
        const due = item.endMin + HEAT_HOLD_ALLOWANCE
        if (due > dueAt) {
          dueAt = due
          leftAt = item.endMin
        }
      }
    }
  }
  if (inserts.length === 0) return items.slice()

  const byPos = new Map<number, TimelineItem[]>()
  for (const { pos, item } of inserts) {
    const list = byPos.get(pos)
    if (list) list.push(item)
    else byPos.set(pos, [item])
  }
  const out: TimelineItem[] = []
  for (let j = 0; j <= items.length; j++) {
    for (const extra of (byPos.get(j) ?? []).sort((a, b) => a.startMin - b.startMin)) out.push(extra)
    if (j < items.length) out.push(items[j])
  }
  return out.map((item, i) => (item.order === i + 1 ? item : { ...item, order: i + 1 }))
}

/**
 * 選んだレシピ（2〜3品想定）の手順を、1本の段取りタイムラインにまとめる。
 *
 * 貪欲法（料理人＝1人という前提の単純なシミュレーション）:
 *   - 料理人が手すきになったら、いま着手できる手順の中から次を選ぶ
 *   - 「待ち系」を優先して仕掛ける（仕掛けた瞬間から裏で時間が進み、料理人はすぐ次に移れる）
 *     待ち系が複数あるときは “待ちが長いもの” から。
 *     **例外は漬け込み・寝かせ**（2026-08-08 便EG）。着手できる「切る」工程があるうちは
 *     そちらを先に片付ける（生の肉・魚を漬けたあとで野菜を切らせない）
 *   - 着手できる待ち系が無ければ「手作業系」を1つ進める（料理人はその分ふさがる）
 *   - どれも前の手順待ちで着手できなければ、次に待ちが明ける時刻まで時間を進める
 * レシピ内の手順の順序は必ず保たれる（前の手順が終わるまで次は着手できない）。
 *
 * **待ち時間に詰め込みすぎない**（2026-08-09 便EH・オーナー実機報告
 * 「茹で時間＝待ち時間4分想定の手順から、次の手順でザルにあげるまでに…入っている。無理。
 * 不可能。余裕を持って時間設定して」）。手を戻す締め切りのある待ち（waitUrgency）を
 * 仕掛けている間は、
 *   - 差し込む手作業の**見積り時間の合計が、その締め切りを越えないようにする**
 *     （越える工程は入れず、待ちが明けるまで手を空けておく）
 *   - 待ちが明けた品の**次の手順を最優先で進める**（ゆで上がりを放置しない）
 *   - 逆に、**仕掛けても中に入る手作業が1つも無い短い待ちは、先に手作業を片付けてから仕掛ける**
 *     （4分のゆでを先に始めて4分立ち尽くすより、5分の切る作業を済ませてから湯に入れる）
 * 漬け込み・冷やすなど数分の遅れが問題にならない待ちには、この上限を掛けない。
 *
 * 手作業系が複数あるときの選び方（2026-08-08 便EB・オーナー要望「3品全体の流れを整えたい」）。
 * 上から順に見て、決まらなければ次の基準に進む:
 *   1. **明けた待ちの後始末**（attendDue・2026-08-09 便EH）。ゆで上がった品をざるに上げる、
 *      煮上がった鍋の火を止める、が最優先
 *   2. **利用者が書いた並行の指示**（cueDue・2026-08-13 便GB）。「その間に」と書かれた手順は、
 *      その待ちが動いているうちに片付ける（利用者が指した窓を外さない）
 *   3. **切る工程を続ける**（cutRun・2026-08-09 便EH・オーナー実機報告
 *      「切る手順がまだ後回しになっている。全部レシピ分カットの流れが自然」）。
 *      直前が“切る”なら、別レシピの“切る”をレシピをまたいで続けて片付ける。
 *      **2026-08-13 便GBで4・5より上に移した**。切る流れを切って着火を数分早めても得は小さく、
 *      まな板の上を行き来する段取りのほうが実際には損になるため
 *   4. **着火の準備を待たせない**（ignitionRank・2026-08-13 便GB・docs/72 第2段）。
 *      長い放置調理（8分以上）がこれから残っている品の手順を先に進める。
 *      **これが「最後に仕上げる」と「最後に着火する」を分ける本体**。
 *      提供タイミング（次の5）は仕上げの順番であって、着火まで後ろへ送る理由にはならない
 *   5. **完成の順番**（finishBias・2026-08-08 便EG）。その品の最後の手順のときだけ効く。
 *      冷やす品は先に仕上げて冷蔵庫へ、熱々の品は最後に仕上げる。温度が読めない品は据え置き
 *   6. **残り時間が長いレシピを先に**（remainingSpan）。長く掛かる品を後回しにすると
 *      全体が伸びるため。待ちを早く仕掛けることにもなる
 *   7. **段階の大枠**（下ごしらえ→加熱→仕上げ）。同じくらい急ぐ品どうしなら、
 *      切る・洗う・下味などの準備を先に、盛り付けは最後にまわす
 *   8. **直前と同じ種類の作業を続ける**（切る以外）
 *   9. レシピの選択順（ここまで同点なら並びを安定させるだけ）
 *
 * **仕上げの手順は、ほかの品の完成に合わせて後ろへ寄せる**（holdsFinish・2026-08-13 便GB）。
 * 温かい品（汁物を含む）の最後の手順は、ほかの品がまだ終わらないうちに済ませても
 * 冷めるだけなので、**次に手が必要になる時刻に着地するようずらす**。
 * 全体の目安は伸びない（元から手が空いていた時間に置き直すだけ）。
 * 冷やす品には掛けない＝オーナー指示「冷たい方がいいものは先に仕上げて冷蔵庫で冷やしたい」のまま。
 */
export function buildCookTimeline(
  recipes: Recipe[],
  kitchen: KitchenEquipment = DEFAULT_KITCHEN,
): CookTimeline {
  const jobs = buildJobs(recipes, kitchen)
  const items: TimelineItem[] = []
  const schedule = new ApplianceSchedule(kitchen)
  let cookAt = 0

  /** その工程が器具をふさぐ長さ（分） */
  const useSpan = (step: Job['steps'][number]) =>
    step.kind === 'wait' ? step.waitMinutes : step.activeMinutes
  /**
   * その工程を `at` から始めても、器具の台数を超えないか（2026-08-13 便GC・docs/72 第3段 A）。
   * **その品が火にかけたままの鍋は、自分の口としては数えない**（同じ鍋の続きだから。2026-08-14 便GI）
   */
  const fitsAppliance = (job: Job, at: number) => {
    const step = job.steps[job.ptr]
    /**
     * **「すでに火にかけている鍋の続きは新しい口を要らない」は、ここでは通さない**（2026-08-15 便GR）。
     *
     * 占有を書き込む側（下の `samePot`）は同じ鍋の続きを二重に数えないので、空きを見るこちらも
     * そろえたくなるが、実測すると**コンロ2口の家で3つの鍋が同時に火にかかる段取り**が出た
     * （N5 0件→1件）。理由は「着火を後ろへ回した品が先に口を予約している」ため
     * （たらのホイル焼き／ひじきの煮もの／しっとりゆで鶏。ひじきが炒めたあと22分空く形の裏返し）。
     * 予約と着火の順番の問題なので、混在手順ではなく段取りの並べ方の側で直す話。
     */
    return !step.occupies || step.applianceKey == null
      ? true
      : schedule.canUse(step.applianceKey, at, at + useSpan(step), job.recipeId)
  }
  /** その工程のあと、その品の鍋がコンロに残るか（＝火を止めるまで口をふさぎ続ける） */
  const staysOnHeat = (job: Job, step: Job['steps'][number]) =>
    step.applianceKey === 'stove' &&
    (step.heatShift === 'on' || (step.heatShift === 'keep' && job.onHeat))

  const hasRemaining = () => jobs.some((j) => j.ptr < j.steps.length)
  /** 直前に出した手作業の種類（同じ種類の作業を続けてまとめるために覚えておく） */
  let lastActiveCategory: StepCategory | null = null

  /**
   * 完成の順番の重み（2026-08-08 便EG・オーナー実機報告
   * 「冷たい方がいいものは先に仕上げて冷蔵庫で冷やしたい」「肉が焼き上がってから
   * オムライスの卵を焼いて仕上げる手順が理想」）。
   *
   * **その品の最後の手順にだけ**効かせる（＝完成のタイミングだけを動かし、途中の順番は変えない）。
   * 冷やす品の仕上げは早め（0）、熱々の品の仕上げは最後（2）、それ以外は据え置き（1）。
   * 温度が読めない品は serveRank が 1 なので、従来とまったく同じ順番になる。
   *
   * **「火をつけたら止めるまで続く一連の工程」の入口も、その品の仕上げとみなす**
   * （2026-08-14 便GG）。火をつけた時点でその品は最後まで走り切ることになるので、
   * 最後の1手だけを見ていると、熱々の品が火にかかっている間に冷たい品が後ろへ落ちる
   * （実測: オムライス・照り焼き・トマトサラダの3品で、サラダが最後に回った）。
   */
  const finishBias = (j: Job) =>
    j.ptr === j.steps.length - 1 || startsHeatRun(j) ? j.serveRank : 1

  while (hasRemaining()) {
    const active = jobs.filter((j) => j.ptr < j.steps.length)
    let ready = active.filter((j) => j.readyAt <= cookAt)
    if (ready.length === 0) {
      // いま着手できるものが無い＝全部が裏の待ち中。次に明ける時刻まで進める
      cookAt = Math.min(...active.map((j) => j.readyAt))
      ready = active.filter((j) => j.readyAt <= cookAt)
    }

    // 【器具の制約】設定した台数を超えて同時に使う工程は、いまは始められない
    // （2026-08-13 便GC・docs/72 第3段 A。R2「うちは1口なので、この段取りはそもそも成立しません」）
    const usable = ready.filter((j) => fitsAppliance(j, cookAt))
    if (usable.length === 0) {
      // 全部が器具の空き待ち＝いちばん早く空く時刻（または次に待ちが明ける時刻）まで進める
      let nextAt = Number.POSITIVE_INFINITY
      for (const j of ready) {
        const key = j.steps[j.ptr].applianceKey
        const freeAt = key == null ? undefined : schedule.nextFreeAt(key, cookAt)
        if (freeAt != null && freeAt > cookAt) nextAt = Math.min(nextAt, freeAt)
      }
      for (const j of active) if (j.readyAt > cookAt) nextAt = Math.min(nextAt, j.readyAt)
      // 時刻を必ず前へ進める（取りこぼしがあっても計算が止まらないように）
      cookAt = Number.isFinite(nextAt) && nextAt > cookAt ? nextAt : cookAt + DEFAULT_ACTIVE_MINUTES
      continue
    }
    ready = usable

    /**
     * 「この時刻までに手を戻さないといけない」いちばん早い締め切り（2026-08-09 便EH）。
     * ゆで上がり・煮上がりのうち、まだ手を付けていないものの中でいちばん早い時刻。
     * 該当が無ければ Infinity（＝上限なし）。
     */
    const attendDeadline = jobs.reduce(
      (min, j) => (j.attendUntil > cookAt ? Math.min(min, j.attendUntil) : min),
      Number.POSITIVE_INFINITY,
    )
    /**
     * その手作業を今から始めても、締め切りまでに手が空くか。
     *
     * 見るのは**ほかの品**の締め切りだけ（2026-08-12 便FU-1・利用者テスト
     * 「表示されている各手順の分を足しても、そのレシピの合計と合わない。鶏だけ+3分ずれる」）。
     * 締め切り（attendUntil）は「その鍋に遅くともいつまでに手を戻すか」を表すので、
     * **その鍋に戻る作業そのもの**＝同じ品の次の手順を、この判定で弾いてはいけない。
     * 弾くと締め切りの時刻まで何もしない空白が段取りに入り（煮込みの猶予＝待ちの2割ぶん）、
     * その空白は手順のどこにも出ないため、手順の分数を足した値とヘッダーの合計が食い違う。
     * 空白は料理の都合ではなく計算の産物なので、はじめから作らない。
     */
    const fitsBeforeDeadline = (j: Job) => {
      const othersDeadline = jobs.reduce(
        (min, k) => (k !== j && k.attendUntil > cookAt ? Math.min(min, k.attendUntil) : min),
        Number.POSITIVE_INFINITY,
      )
      // 「その間に」で自分の鍋の待ちの中に置く手順だけは、**自分の締め切りも見る**
      // （2026-08-13 便GB）。12分の煮込みの中に20分の作業を入れたら鍋が焦げる。
      // 利用者が指した窓に収まらない指示は、従来どおり待ちが明けてから置く
      const ownDeadline =
        j.steps[j.ptr].parallelCue && j.attendUntil > cookAt
          ? j.attendUntil
          : Number.POSITIVE_INFINITY
      return cookAt + j.steps[j.ptr].activeMinutes <= Math.min(othersDeadline, ownDeadline)
    }

    /**
     * その品を今から1品だけで作り切ったときの完成見込み（分）。
     * 仕上げをどこまで後ろへ寄せてよいかの目安に使う（2026-08-13 便GB）。
     */
    const projectedEnd = (j: Job) => Math.max(j.readyAt, cookAt) + remainingSpan(j)
    /**
     * その品の**仕上げの手順**を、ほかの品の完成に合わせて後ろへ寄せてよいか（2026-08-13 便GB）。
     * 温かい品（汁物を含む）の最後の手順で、ほかの品がまだ終わらないときだけ。
     * 冷やす品には掛けない（先に仕上げて冷蔵庫へ＝2026-08-08 便EGのオーナー指示）。
     */
    const holdsFinish = (j: Job) => {
      if (j.serveRank < SERVE_RANK.hot) return false
      // **火にかけたままの品は待たせない**（2026-08-14 便GG・docs/72 第5段）。
      // ここが利用者の「豆腐が10分ぐつぐつ煮え続ける」の正体。完成の時刻を揃えるために
      // 最後の「みそを溶いて火を止める」を後ろへ送っていたが、その間ずっと鍋は火の上にある。
      // 揃えたいなら**着火ごと後ろへ回す**（下の holdsIgnition）。仕上げだけを送ってはいけない
      if (j.onHeat) return false
      const step = j.steps[j.ptr]
      if (step.kind !== 'active') return false
      // 最後の1手（従来）に加え、**火をつけてから止めるまで続く一連の工程の入口**も後ろへ回す
      if (j.ptr !== j.steps.length - 1 && !startsHeatRun(j)) return false
      const othersEnd = jobs.reduce(
        (max, k) => (k !== j && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max),
        -1,
      )
      return othersEnd > cookAt + heldSpan(j)
    }
    /**
     * その品の「火をつけてから止めるまで」を、ほかの品の完成に着地させるための着火時刻（分）。
     * 2026-08-14 便GG・利用者の手順「だしを張って火にかけるのはグリルに入れてから」。
     *
     * 逆算で引く長さは**その品の残り（待ち込み）＋ほかの品に残っている手作業**。
     * ほかの品の手作業は同じ1組の手を取り合うので、その分だけ早めに火をつけておかないと、
     * 煮上がったときに手がふさがっていて全体が伸びる（**遅らせて伸ばしたら本末転倒**）。
     * ＝**必ず「必要より少し早い」側に倒す**見積り。
     */
    const igniteAt = (j: Job) => {
      const othersEnd = jobs.reduce(
        (max, k) => (k !== j && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max),
        -1,
      )
      if (othersEnd < 0) return cookAt
      const othersActive = jobs.reduce(
        (sum, k) => (k !== j && k.ptr < k.steps.length ? sum + remainingActive(k) : sum),
        0,
      )
      return othersEnd - remainingSpan(j) - othersActive
    }
    /**
     * **着火そのものを後ろへ回す**（2026-08-14 便GG・docs/72 第5段）。
     *
     * 「鍋で20分煮る」のように、火をつける一手が**待ちの工程**で始まる品は、上の holdsFinish の
     * 道（手作業だけを後ろへ送る仕組み）に乗らない。そのまま早く仕掛けると、煮上がってから
     * 食卓までのあいだ鍋を火から下ろすか放置するかしかなくなる。
     * 温かい品（汁物を含む）で、まだ余裕があるうちは**仕掛けること自体を待つ**。
     */
    const holdsIgnition = (j: Job) =>
      j.serveRank >= SERVE_RANK.hot &&
      j.steps[j.ptr].kind === 'wait' &&
      startsHeatRun(j) &&
      igniteAt(j) > cookAt

    // 手作業の選び方（上のコメントの1〜9）。切る工程どうしだけは、まな板の順序（野菜→肉・魚）を先に見る
    /**
     * 明けた待ちの後始末。**先に明けた鍋から順に**手を戻す（2026-08-13 便GD）。
     *
     * 便EHでは「後始末が要るかどうか」の2値だったので、同じ時刻に2つの鍋が明けていると
     * 次の物差し（完成の順番など）で決まっていた。実測（docs/71 R3の再現）では、
     * **16分に沸いた鍋より、18分に明けたレンジの仕上げが先**に選ばれ、鍋は25分まで
     * 沸きっぱなしになっていた。明けた時刻の早い順にすれば、いちばん長く放置されている
     * ものから片付く。まだ明けていない品は従来どおりいちばん後ろ（Infinity）。
     */
    const attendDue = (j: Job) =>
      j.attendUntil > 0 && j.waitDoneAt <= cookAt ? j.waitDoneAt : Number.POSITIVE_INFINITY
    // 利用者が「その間に」と書いた手順は、その待ちが動いているうちに片付ける
    const cueDue = (j: Job) => (j.steps[j.ptr].parallelCue && j.waitDoneAt > cookAt ? 0 : 1)
    const ignitionRank = (j: Job) => (hasIgnitionAhead(j) ? 0 : 1)
    /**
     * 【口数に余裕があるときは、もっと火を重ねる】（2026-08-13 便GC・docs/72 第3段 B）。
     *
     * **あと1手で長い放置調理に入れる品**で、**その器具にいま空きがある**なら、その一手を先に出す。
     * ＝火を1つ増やせるときは増やす。空きが無いとき（1口で鍋がふさがっているとき）は
     * 従来の並べ方のまま＝急いで着火の準備をしても口が空いていないので意味がない。
     *
     * 対象は**器具をふさぐ待ち**だけ。冷蔵庫で寝かせる・漬け込むのように器具を取らない待ちは
     * 従来の並べ方に任せる（急いでも誰の邪魔にもならないので、切る流れを断つ理由がない）。
     */
    const ignitionNow = (j: Job) => {
      const next = ignitesNext(j)
      if (!next || next.applianceKey == null || !next.occupies) return 1
      if (!schedule.hasSpare(next.applianceKey, cookAt, j.recipeId)) return 1
      // 前倒しするのは**いま着手できる中でいちばん時間の掛かる品**だけにする。
      // どの品でも前倒しすると、短い品まで先に仕上がって完成の開きが広がる（実測で確認）
      const longest = Math.max(...ready.map(remainingSpan))
      return remainingSpan(j) >= longest ? 0 : 1
    }
    /**
     * **鍋が火にかかったまま、次の一手を待っている品**（2026-08-14 便GG）。
     * 裏の待ちがまだ動いているうちは急がない（waitDoneAt）。明けていれば、いま戻らないと煮すぎになる。
     */
    const potWaiting = (j: Job) => j.onHeat && j.waitDoneAt <= cookAt
    const cutRun = (j: Job) =>
      lastActiveCategory === 'cut' && j.steps[j.ptr].category === 'cut' ? 0 : 1
    /**
     * 漬け込み・寝かせを**仕掛けるための一手**（分けた前半。2026-08-13 便GD）。
     *
     * 「鶏肉をマリネ液に入れて｜冷蔵庫で30分漬ける」を2つに分けたことで、漬け込みの手前に
     * 手作業の工程ができた。この一手は待ちではないので、下の「漬け込みの前に切る工程を
     * 先に片付ける」（2026-08-08 便EG・生の肉を漬けたあとで野菜を切らせない）の対象から
     * 外れてしまう。分ける前と同じ順番になるよう、切る工程があるうちは後ろへ回す。
     */
    const soakLeadIn = (j: Job) => {
      const step = j.steps[j.ptr]
      const next = j.steps[j.ptr + 1]
      return step.leadIn && next != null && next.kind === 'wait' && next.soakWait
    }
    const sameCat = (j: Job) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
    /**
     * 上のコメント1〜9の順に見る比較（どの2つを比べても同じ物差しを使う）。
     *
     * **まな板の順序（野菜→肉・魚）はここに入れない**（2026-08-13 便GD）。
     * 「切る工程どうしのときだけ最優先」は、3つ以上を並べ替えると順番が一周してしまう比較で
     * （A<B・B<C・C<A が同時に成立しうる）、並べ替えの結果が実装まかせになる。
     * 実害: R3の3品で「鶏を切る（着火が控えている）」より汁物が先に選ばれ、
     * 段取り全体が34分→50分に伸びた。まな板の順序は下の `pickActive` で別に当てる。
     */
    const compareActive = (a: Job, b: Job) => {
      const stepA = a.steps[a.ptr]
      const stepB = b.steps[b.ptr]
      return (
        attendDue(a) - attendDue(b) ||
        cueDue(a) - cueDue(b) ||
        ignitionNow(a) - ignitionNow(b) ||
        cutRun(a) - cutRun(b) ||
        // 漬け込みを仕掛ける一手は、着手できる切る工程があるうちは後ろへ（2026-08-13 便GD）
        (readyCuts.length > 0 ? Number(soakLeadIn(a)) - Number(soakLeadIn(b)) : 0) ||
        ignitionRank(a) - ignitionRank(b) ||
        finishBias(a) - finishBias(b) ||
        remainingSpan(b) - remainingSpan(a) ||
        stepA.stageRank - stepB.stageRank ||
        sameCat(a) - sameCat(b) ||
        a.colorIndex - b.colorIndex
      )
    }
    /**
     * 次に出す手作業を選ぶ。
     * **選ばれたのが切る工程だったときだけ**、切る工程の中でまな板の順序（野菜→肉・魚）に
     * そろえ直す（2026-08-08 便ED・オーナー指示「切る順番を野菜→肉に。肉は最後」）。
     * 「切る番」であることは上の比較で決め、「どれから切るか」だけをここで決める。
     */
    const pickActive = (candidates: Job[]): Job => {
      const sorted = candidates.slice().sort(compareActive)
      const best = sorted[0]
      if (best.steps[best.ptr].category !== 'cut') return best
      return sorted
        .filter((j) => j.steps[j.ptr].category === 'cut')
        .reduce((low, j) => (j.steps[j.ptr].cutRank < low.steps[low.ptr].cutRank ? j : low), best)
    }

    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    // **火にかけたままの鍋の続きを先に仕掛ける**（2026-08-14 便GG）。
    // 「湯を沸かす→ゆでる」「水と調味料を入れて→煮る」のように、火にかけた鍋にそのまま続く待ちは、
    // ほかの品の新しい待ちより先に。あとにすると、その間に別の品がコンロを取ってしまい、
    // 火にかけた鍋が「口が空くまで」放置される
    // （実測: 湯が沸いてからゆで始めるまで8分・煮汁を入れてから煮始めるまで14分）。
    // 待ちは仕掛けても手をふさがないので、この入れ替えで段取りは1分も伸びない。
    // 次に待ちが長いものから（同着はレシピの選択順で安定させる）
    waits.sort(
      (a, b) =>
        Number(!potWaiting(a)) - Number(!potWaiting(b)) ||
        b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes ||
        a.colorIndex - b.colorIndex,
    )
    // 待ちの締め切りに間に合う手作業だけを差し込みの候補にする。
    // **ただし自分の鍋が待っている品は、ほかの鍋の締め切りで弾かない**（2026-08-14 便GG）。
    // 鍋が2つ同時に手を待っているとき、どちらも「相手の締め切りに間に合わない」と弾き合って
    // 手が空いたまま時計だけが進んでいた（＝縮まない。同梱109品の平均短縮率で実測）。
    // どちらかを先にやるしかない場面なので、いちばん長く待っている鍋から片付ける（attendDue）
    const fittingActives = ready.filter(
      (j) =>
        j.steps[j.ptr].kind === 'active' &&
        (Number.isFinite(attendDue(j)) || fitsBeforeDeadline(j)),
    )
    // いま進めたい手作業（＝後ろへ寄せる仕上げを除いたもの）
    const eagerActives = fittingActives.filter((j) => !holdsFinish(j))
    const shortestActive = eagerActives.reduce(
      (min, j) => Math.min(min, j.steps[j.ptr].activeMinutes),
      Number.POSITIVE_INFINITY,
    )
    // 締め切りのある待ちが明けた品は、続きの待ちも待たせない
    // （湯が沸いたらすぐ材料を入れる。沸いた湯を放置する段取りにしない）
    const dueWaits = waits.filter((j) => j.attendUntil > 0)
    // いま仕掛けたい待ち（＝着火ごと後ろへ回すものを除いたもの。2026-08-14 便GG）
    const eagerWaits = waits.filter((j) => !holdsIgnition(j))
    // 仕掛けても中に入る手作業が1つも無い短い待ちは、先に手作業を片付けてから仕掛ける
    const waitWouldIdle =
      eagerWaits.length > 0 &&
      dueWaits.length === 0 &&
      eagerActives.length > 0 &&
      eagerWaits[0].steps[eagerWaits[0].ptr].attendWithin < shortestActive
    let chosen: Job
    /** その手順を「次に手が必要になる時刻」に着地させる（仕上げを後ろへ寄せるときだけ） */
    let holdFinish = false
    /** 着火を後ろへ回して仕掛けるときの開始時刻（0＝ずらさない。2026-08-14 便GG） */
    let igniteFrom = 0
    // 漬け込み・寝かせを仕掛ける前に、いま着手できる「切る」工程を先に片付ける
    // （2026-08-08 便EG・オーナー実機報告。生の肉・魚を漬けたあとで野菜を切りたくない）。
    // 対象は「いま着手できる待ちが全部、漬け込み・寝かせのとき」だけ＝煮る・ゆでるのような
    // ふつうの待ちは今までどおり最優先で仕掛ける
    const readyCuts = eagerActives.filter((j) => j.steps[j.ptr].category === 'cut')
    const soakOnly = waits.length > 0 && waits.every((j) => j.steps[j.ptr].soakWait)
    // 火にかけたままの鍋に戻る一手は、**最後の1口を取られる前に**片付ける（2026-08-14 便GG）。
    // 待ちは仕掛けた瞬間に器具をふさぐので、先に仕掛けられると戻る口が無くなる
    // （実測: 豚汁の炒めのあと、ほかの品の蒸し焼き15分に2口目を取られ、15分戻れなかった）。
    // **口に余裕があるうちは従来どおり待ちを先に仕掛ける**＝縮める力を落とさない
    const potWaitingActives = fittingActives.filter(
      (j) =>
        potWaiting(j) &&
        j.attendUntil > 0 &&
        j.steps[j.ptr].kind === 'active' &&
        j.steps[j.ptr].applianceKey === 'stove',
    )
    const stoveWaitsQueued = eagerWaits.filter(
      (j) => j.steps[j.ptr].occupies && j.steps[j.ptr].applianceKey === 'stove',
    ).length
    const lastBurnerTaken =
      stoveWaitsQueued > 0 && schedule.spare('stove', cookAt) <= stoveWaitsQueued
    if (dueWaits.length > 0) {
      chosen = dueWaits[0]
    } else if (potWaitingActives.length > 0 && lastBurnerTaken) {
      chosen = pickActive(potWaitingActives)
    } else if (eagerWaits.length > 0 && !(soakOnly && readyCuts.length > 0) && !waitWouldIdle) {
      chosen = eagerWaits[0]
    } else if (soakOnly && readyCuts.length > 0) {
      chosen = pickActive(readyCuts)
    } else if (eagerActives.length > 0) {
      // 手作業のみ。上のコメント1〜9の順に見て決める
      chosen = pickActive(eagerActives)
    } else if (eagerWaits.length > 0) {
      chosen = eagerWaits[0]
    } else if (fittingActives.length > 0) {
      // 残っているのは「後ろへ寄せたい仕上げ」だけ（2026-08-13 便GB）。
      // ここで済ませると、ほかの品ができるずっと前に仕上がって冷める。
      //   ①まだ先送りできる（次に手が必要になる時刻まで送っても、ほかの品の完成に間に合う）
      //     → 何もせず時刻だけ進めて、その間にほかの品の手順を進める
      //   ②もう先送りできない → ほかの品の完成に着地するよう開始をずらして仕上げる
      chosen = pickActive(fittingActives)
      // 後ろへ回す長さ。着火ごと回すときは、その品の残り全部を動かす（2026-08-14 便GG）
      const heldMinutes = heldSpan(chosen)
      /** そのうち**手を動かす**ぶん（待ちは裏で進むので手をふさがない） */
      const heldActive = startsHeatRun(chosen)
        ? remainingActive(chosen)
        : chosen.steps[chosen.ptr].activeMinutes
      const othersEnd = jobs.reduce(
        (max, k) =>
          k !== chosen && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max,
        -1,
      )
      // ほかの品に残っている「手を動かす時間」の合計。先送りしてよいかの判断に使う
      const othersActive = jobs.reduce(
        (sum, k) => (k !== chosen && k.ptr < k.steps.length ? sum + remainingActive(k) : sum),
        0,
      )
      const nextAt = active.reduce(
        (next, j) => (j !== chosen && j.readyAt > cookAt ? Math.min(next, j.readyAt) : next),
        attendDeadline,
      )
      // **先送りしてよいのは、送った先にもまだ手の空く時間が残っているときだけ**。
      // ここを見ないと、ほかの品の手順で埋まったあとに仕上げがはみ出し、全体が伸びる
      // （＝縮めるための機能が縮まなくなる。同梱109品の平均短縮率で実測して入れた歯止め）
      //
      // 2026-08-14 便GG: 必要な余白の数え方を直した。**待ちは手をふさがない**ので、
      // 「送った先で足りていないといけない時間」は
      //   ①その一連の工程が終わるまでの長さ（待ち込み）と
      //   ②手を動かす時間の合計（この品の残り＋ほかの品の残り）
      // の**大きいほう**。旧式（ほかの品の手作業＋一連の長さ）は②の中に①の待ちを二重に足しており、
      // 着火ごと後ろへ回す判断でほぼ必ず「余白が足りない」と出ていた
      // （実測: R3の3品でみそ汁が10分地点で着火し、完成29分・食卓52分＝23分放置になっていた）
      if (
        Number.isFinite(nextAt) &&
        nextAt > cookAt &&
        othersEnd - nextAt >= Math.max(heldMinutes, othersActive + heldActive)
      ) {
        cookAt = nextAt
        continue
      }
      holdFinish = true
    } else if (waits.length > 0) {
      // 後ろへ回していた着火しか残っていない（ほかの品は裏の待ちの中で、手も空いている）。
      // ここで時刻だけ進めると着火がさらに遅れて全体が伸びるので、**着地から逆算した時刻**に
      // 仕掛ける（2026-08-14 便GG）
      chosen = waits[0]
      igniteFrom = Math.max(cookAt, igniteAt(chosen))
    } else {
      // 締め切りまでに終わる手作業が1つも無い＝ここは手を空けて待つ（詰め込まない）。
      // 進める先は「次に何かが起きる時刻」＝手を戻す締め切りと、裏の待ちが明ける時刻の早い方
      const nextAt = active.reduce(
        (next, j) => (j.readyAt > cookAt ? Math.min(next, j.readyAt) : next),
        attendDeadline,
      )
      // 時刻を必ず前へ進める（何かの取りこぼしで進まなくなっても、段取りの計算が止まらないように）
      cookAt = Number.isFinite(nextAt) && nextAt > cookAt ? nextAt : cookAt + DEFAULT_ACTIVE_MINUTES
      continue
    }

    const step = chosen.steps[chosen.ptr]
    let startMin = cookAt
    if (igniteFrom > cookAt) {
      // 着火を後ろへ回す（2026-08-14 便GG）。器具が空いていなければずらさない
      startMin = igniteFrom
      if (!fitsAppliance(chosen, startMin)) startMin = cookAt
    }
    if (holdFinish) {
      // ほかの品の完成見込みに合わせて着地させる（そこまで待てないときは、次に手が必要になる
      // 時刻に合わせる）。全体の目安は伸びない＝元から手が空いていた時間に置き直すだけ
      const othersEnd = jobs.reduce(
        (max, k) =>
          k !== chosen && k.ptr < k.steps.length ? Math.max(max, projectedEnd(k)) : max,
        -1,
      )
      const nextAt = active.reduce(
        (next, j) => (j !== chosen && j.readyAt > cookAt ? Math.min(next, j.readyAt) : next),
        attendDeadline,
      )
      const landing = Math.min(Number.isFinite(nextAt) ? nextAt : othersEnd, othersEnd)
      // 着火ごと後ろへ回すときは、**一連の工程の終わり**がほかの品の完成に着地するよう逆算する
      // （最後の1手だけを送っていた 2026-08-13 便GB との違い。docs/72 第5段）。
      // 逆算には igniteAt（ほかの品に残っている手作業も引いた時刻）を使う。「次に手が必要になる
      // 時刻」に合わせて置くと、**同じく後ろへ回したもう1品の場所が無くなって**全体が伸びる
      // （実測: 豚汁／しっとりゆで鶏／肉じゃがで 78→101分になっていた）
      if (Number.isFinite(landing)) {
        startMin = Math.max(
          cookAt,
          startsHeatRun(chosen) ? igniteAt(chosen) : landing - heldSpan(chosen),
        )
      }
      // 後ろへずらした先で器具が空いていなければ、ずらさない（器具の制約が先。2026-08-13 便GC）
      if (!fitsAppliance(chosen, startMin)) startMin = cookAt
    }
    // 【火にかけた鍋は、止めるまで口をふさぎ続ける】（2026-08-14 便GI）。
    // 火が残る工程は「終わりの決まっていない占有」にし、火を止めた時点で口を返す。
    // 火の残らない工程（レンジ・グリル・湯を切る等）は従来どおりその工程の長さだけふさぐ
    const holdsBurner = staysOnHeat(chosen, step)
    // すでに火にかけている鍋の続きは、同じ1口を使う（二重に数えない）
    const samePot = chosen.onHeat && step.applianceKey === 'stove'
    if (holdsBurner) {
      schedule.hold('stove', chosen.recipeId, startMin)
    } else if (step.occupies && step.applianceKey != null && !samePot) {
      schedule.occupy(step.applianceKey, startMin, startMin + useSpan(step))
    }
    // 前に仕掛けた待ちの後始末はここで済む（締め切りの管理から外す）。
    // ただし「その間に」で待ちの中に置いた手順は、その鍋に戻る作業ではないので締め切りを残す
    const keepsPot = step.kind === 'active' && step.parallelCue && chosen.waitDoneAt > startMin
    if (!keepsPot) chosen.attendUntil = 0
    // 火にかかっているかを引き継ぐ（2026-08-14 便GG）。'keep' の工程では変えない
    if (step.heatShift === 'on') chosen.onHeat = true
    else if (step.heatShift === 'off') chosen.onHeat = false
    // 火が消えたら口を返す（2026-08-14 便GI）。返す時刻は火が下りる時点
    // （「弱火で5分煮て器に盛る」はその工程の終わり／「火を止めてそのまま10分おく」はその手前）
    if (!chosen.onHeat) {
      schedule.release(chosen.recipeId, startMin + (heatOffAtEnd(step) ? useSpan(step) : 0))
    }
    if (step.kind === 'wait') {
      const endMin = startMin + step.waitMinutes
      chosen.waitDoneAt = endMin
      // 次の手順が利用者の「その間に」なら、この待ちを仕掛けた時点で手が空く（2026-08-13 便GB）
      chosen.readyAt = chosen.steps[chosen.ptr + 1]?.parallelCue ? startMin : endMin
      // 「遅くともこの時刻までに手を戻す」締め切り。上限なしの待ち（漬け込み等）は 0＝管理しない
      const attendUntil = startMin + step.attendWithin
      chosen.attendUntil = Number.isFinite(attendUntil) ? attendUntil : 0
      // 待ちは仕掛けたら裏で進むので、料理人（cookAt）はその場で手すきのまま
      items.push(makeItem(items.length + 1, chosen, step, startMin, endMin))
    } else {
      const endMin = startMin + step.activeMinutes
      cookAt = endMin
      // 「その間に」を待ちの中でやった直後は、まだその待ちが明けていない
      chosen.readyAt = Math.max(endMin, chosen.waitDoneAt)
      // **鍋を火にかけたまま次へ進んだ**なら、そこから締め切りが始まる（2026-08-14 便GG）。
      // 待ちの工程が持つ締め切り（waitOverrunAllowance）はそのまま。ここで足すのは
      // 「待ちではないのに火がついたままになった」ぶんだけ＝既存の締め切りを緩めない
      if (chosen.onHeat && chosen.ptr + 1 < chosen.steps.length) {
        chosen.waitDoneAt = Math.max(chosen.waitDoneAt, endMin)
        chosen.attendUntil = Math.max(chosen.attendUntil, endMin + HEAT_HOLD_ALLOWANCE)
      }
      lastActiveCategory = step.category
      items.push(makeItem(items.length + 1, chosen, step, startMin, endMin))
    }
    chosen.ptr++
    // その品を最後まで出し終えたら、火にかけたままでも口を返す（食卓に出す＝火から下りる）
    if (chosen.ptr >= chosen.steps.length) {
      chosen.onHeat = false
      schedule.release(chosen.recipeId, startMin + useSpan(step))
    }
  }

  // 【別の鍋に移る前に、火を止める／弱火にする】2026-08-15 便GO。
  // 組み上がった段取りを読み直して、火にかけたまま手が戻らない場面に一手を足す
  // （0分なので totalMinutes は動かない。詳しくは insertHeatBreakSteps）
  const planned = insertHeatBreakSteps(items, kitchen)
  const totalMinutes = planned.reduce((max, it) => Math.max(max, it.endMin), 0)
  const recipes2: TimelineRecipe[] = jobs.map((j) => ({
    id: j.recipeId,
    title: j.title,
    colorIndex: j.colorIndex,
  }))

  return { items: planned, totalMinutes, recipes: recipes2 }
}

/** 段取りの出し方（2026-08-08 便ED） */
export type CookPlanMode = 'parallel' | 'sequential'

export interface CookPlan extends CookTimeline {
  mode: CookPlanMode
  /** 1品ずつ順に作ったときの合計（分）。ナビと同じ物差しで数えた値 */
  sequentialMinutes: number
  /** 並行の段取りにしたときの合計（分） */
  parallelMinutes: number
  /** 1品ずつ作るのに比べて何%縮むか */
  gainPercent: number
  /**
   * このうち「台所を離れられる待ち」の合計（分。2026-08-09 便ES・オーナー指摘B）。
   * 漬ける・冷やす・寝かせる・もどす など、数分の遅れが料理に影響しない待ち（waitUrgency の
   * relaxed）だけを数える。レシピ欄の「調理時間」はこの時間を含めないので、
   * ナビの合計がレシピの合計より長く出る理由の大半がここにある。
   */
  awayMinutes: number
  /**
   * 1品ずつ作る順番になった理由が**器具の台数**か（2026-08-13 便GC）。
   *
   * 正直表示の文面は「手が空く待ち時間が見つかりませんでした」だったが、器具の制約を入れた後は
   * **待ちはあるのに口が空いていない**ために並行できない場合が出る。その2つを同じ文で言うと嘘になる
   * （序列「安全>正直>短縮効果」）。台数に余裕のある台所で組み直したときに段取りが短くなるなら、
   * 縮まなかった理由は待ちの不足ではなく台数。
   */
  limitedByEquipment: boolean
  /**
   * 縮まなかった理由になった**器具の種類**（2026-08-24 便KK・オーナー裁定A案「理由を出す」）。
   *
   * limitedByEquipment だけでは「器具のせい」までしか言えず、画面には
   * 「コンロ◯口では」としか出せなかった。**電子レンジ・魚焼きグリル・トースターは
   * 持っていても1台**なので、口数に余裕がある家でもここが理由で縮まないことがある
   * （2026-08-23 便KDでレンジの二重予約を直してから増えた）。
   *
   * その器具**1つだけ**台数の制約を外して組み直したときに段取りが短くなるなら、
   * 足りなかったのはその器具。2つ以上の器具が絡んでいて1つに絞れないときは undefined
   * （**嘘をつかない**＝名前を挙げずに「台所の器具」とだけ言う）。
   */
  limitingAppliance?: ApplianceKey
}

/**
 * これ未満の短縮率なら「並行の余地なし」として1品ずつ作る順番を出す（docs/68 打ち手#4）。
 * 誤差の範囲でしか縮まないのに「約◯分」とだけ出すと、縮んでいないのに縮んだように見えるため。
 */
export const MIN_GAIN_PERCENT = 5

/**
 * その品が加熱で終わるか（＝できたてが温かい品）。
 * 後ろから見て、加熱の後始末にあたる工程（盛り付け・味つけ・分類できなかった手順）は読み飛ばし、
 * 最後の「切る・下処理・加熱」のどれで終わっているかで決める。
 * 「炒める→塩こしょうで味をつける→皿に盛る」は温かい品、「切る→和える」は冷たい品。
 */
function endsWithHeat(recipe: Pick<Recipe, 'steps'>): boolean {
  for (let i = recipe.steps.length - 1; i >= 0; i--) {
    const category = stepCategory(recipe.steps[i])
    if (category === 'finish' || category === 'season' || category === 'other') continue
    return category === 'heat'
  }
  return false
}

/**
 * 1品ずつ順に作る段取り（2026-08-08 便ED・docs/68 打ち手#4）。
 * 1品を最後まで作り終えてから次の品に移る。**冷やす品を先に、熱々の品を最後にまわす**ので、
 * 冷やす品は冷蔵庫に入れる時間が取れ、温かい品は冷めるのを最小限にできる
 * （2026-08-08 便EG。従来の「加熱で終わる品を最後」に、冷やす品を先へ回す並びを足した）。
 */
function buildSequentialTimeline(
  recipes: Recipe[],
  kitchen: KitchenEquipment = DEFAULT_KITCHEN,
): CookTimeline {
  const valid = recipes.filter((r) => r.id != null && r.steps.length > 0)
  const ordered = valid
    .map((recipe, index) => ({ recipe, index }))
    .sort((a, b) => serveTempRank(a.recipe) - serveTempRank(b.recipe) || a.index - b.index)

  const items: TimelineItem[] = []
  let offset = 0
  for (const { recipe, index } of ordered) {
    const single = buildCookTimeline([recipe], kitchen)
    for (const item of single.items) {
      items.push({
        ...item,
        order: items.length + 1,
        colorIndex: index,
        startMin: item.startMin + offset,
        endMin: item.endMin + offset,
      })
    }
    offset += single.totalMinutes
  }
  return {
    items,
    totalMinutes: offset,
    recipes: valid.map((r, colorIndex) => ({ id: r.id!, title: r.title, colorIndex })),
  }
}

/**
 * 選んだレシピの段取りを作る。**並行の余地があるかどうかを同じ物差しで測ってから出し分ける**
 * （2026-08-08 便ED・docs/68 打ち手#4）。
 *
 * 診断（docs/68）で、ユーザーが登録したレシピ3品の約3回に1回は1分も縮んでいないのに、
 * 画面には「全体の目安 約◯分」とだけ出ていた（縮んでいないのに縮んだように見える）。
 * 短縮率が MIN_GAIN_PERCENT 未満のときは並行に組まず、1品ずつ作る順番をそのまま出して、
 * 待ち時間が見つからなかったことを画面に書く。
 */
export function buildCookPlan(
  recipes: Recipe[],
  kitchen: KitchenEquipment = DEFAULT_KITCHEN,
): CookPlan {
  const valid = recipes.filter((r) => r.id != null && r.steps.length > 0)
  const parallel = buildCookTimeline(valid, kitchen)
  // 品ごとに「1品だけで作ったときの目安」を出し、その合計を「1品ずつ作ると約◯分」にする。
  // 内訳を画面へ渡せるように控えておく（2026-08-11 便FN）
  const soloMinutes = new Map<number, number>()
  // 手順の分数をそのまま足した合計も控える（画面の数字と読み合わせるため。2026-08-14 便GK）
  const stepSumMinutes = new Map<number, number>()
  for (const r of valid) {
    const solo = buildCookTimeline([r], kitchen)
    soloMinutes.set(r.id!, solo.totalMinutes)
    stepSumMinutes.set(
      r.id!,
      solo.items.reduce((sum, it) => sum + (it.kind === 'wait' ? it.waitMinutes : it.activeMinutes), 0),
    )
  }
  const sequentialMinutes = Array.from(soloMinutes.values()).reduce((sum, m) => sum + m, 0)
  const parallelMinutes = parallel.totalMinutes
  const withSolo = (timeline: CookTimeline): TimelineRecipe[] =>
    timeline.recipes.map((r) => ({
      ...r,
      soloMinutes: soloMinutes.get(r.id),
      stepSumMinutes: stepSumMinutes.get(r.id),
    }))
  const gainPercent =
    sequentialMinutes > 0 ? ((sequentialMinutes - parallelMinutes) / sequentialMinutes) * 100 : 0
  if (gainPercent >= MIN_GAIN_PERCENT) {
    return {
      ...parallel,
      recipes: withSolo(parallel),
      mode: 'parallel',
      sequentialMinutes,
      parallelMinutes,
      gainPercent,
      awayMinutes: awayWaitMinutes(parallel.items),
      limitedByEquipment: false,
    }
  }
  const sequential = buildSequentialTimeline(valid, kitchen)
  const reason = diagnoseNoParallel(valid, kitchen, parallelMinutes)
  return {
    ...sequential,
    recipes: withSolo(sequential),
    mode: 'sequential',
    sequentialMinutes,
    parallelMinutes,
    gainPercent,
    awayMinutes: awayWaitMinutes(sequential.items),
    limitedByEquipment: reason.limitedByEquipment,
    limitingAppliance: reason.limitingAppliance,
  }
}

/** その台所が持っている器具（持っていない器具の工程はコンロとして数えるので、ここには出さない） */
function ownedAppliances(kitchen: KitchenEquipment): ApplianceKey[] {
  return APPLIANCE_KEYS.filter((key) => applianceCapacity(kitchen, key) > 0)
}

/**
 * 1品ずつ作る順番になった理由を見分ける（2026-08-13 便GC → 2026-08-24 便KKで器具の種類まで）。
 *
 * やり方は「**台数の制約を外して組み直し、短くなるかを見る**」の1つだけ。
 *   - 持っている器具**すべて**の制約を外して短くなる → 理由は器具の台数（limitedByEquipment）
 *   - **1つだけ**外して短くなる器具があれば、それが理由（limitingAppliance）。
 *     いちばん短くなる器具を採る（同じなら数える順＝コンロ→レンジ→グリル→トースター）
 *   - どちらも短くならない → そもそも手が空く待ちが無い（＝従来の文を出す）
 *
 * **持っていない器具は見ない**。その工程はコンロ1口として数えているので（stepApplianceFor）、
 * 理由も「コンロ」になるのが正しい。持っていない器具の名前を出すと嘘になる。
 */
function diagnoseNoParallel(
  recipes: Recipe[],
  kitchen: KitchenEquipment,
  parallelMinutes: number,
): { limitedByEquipment: boolean; limitingAppliance?: ApplianceKey } {
  const owned = ownedAppliances(kitchen)
  const shortenedBy = (unlimited: ApplianceKey[]): number =>
    parallelMinutes - buildCookTimeline(recipes, { ...kitchen, unlimited }).totalMinutes
  if (shortenedBy(owned) <= 0) return { limitedByEquipment: false }
  let best: ApplianceKey | undefined
  let bestGain = 0
  for (const key of owned) {
    const gain = shortenedBy([key])
    if (gain > bestGain) {
      best = key
      bestGain = gain
    }
  }
  return { limitedByEquipment: true, limitingAppliance: best }
}

/**
 * 段取りの中で「台所を離れられる待ち」の合計（分）。
 * 判定は waitUrgency の relaxed（漬ける・冷やす・寝かせる・もどす等）だけ。
 * ゆでる・煮るのように鍋の前に戻らないといけない待ちは数えない。
 */
function awayWaitMinutes(items: readonly TimelineItem[]): number {
  return items
    .filter((item) => item.kind === 'wait' && waitUrgency({ text: item.text }) === 'relaxed')
    .reduce((sum, item) => sum + item.waitMinutes, 0)
}

/**
 * その待ちの**中に**進められる手作業が、段取りの上に本当にあるか。
 * 待ちのブロックの「この間に、次の手作業を進められます」はこれが真のときだけ出す。
 *
 * 2026-07-09（ペルソナ第2波）: 最後の待ち工程にまで出ていたので「後ろに手作業が残っているか」
 * にした（旧 hasLaterHandsOnStep）。
 *
 * 2026-08-12 便FS-2（利用者テスト）: 「鍋にだし汁…2分ほど煮る」の待ちにこの一文が出るのに、
 * 次の手順は「火を弱め、みそを溶き入れる」＝**同じ鍋の続き**だった。2分の間にできる作業ではない。
 * 「後ろに手作業があるか」では、待ちが明けてからしか始められない続きの手順まで数えてしまう。
 *
 * 段取りは、待ちを仕掛けても料理人の時計を進めない（待ちは裏で進む）ので、
 * **待ちが明ける前に始まる手作業＝その待ちの中に入る作業**になる。同じ品の続きは、
 * その品が空くのを待ってからしか置かれない（readyAt）ため、必ず待ちの終わり以降に始まる。
 * つまり「開始が待ちの終わりより前の手作業があるか」だけを見れば、
 * 同じ品の続きは構造的に数えられない（品の異同を別途見比べる必要がない）。
 */
export function hasFillableWorkDuringWait(
  items: readonly { kind: StepKind; startMin: number; endMin: number }[],
  index: number,
): boolean {
  const wait = items[index]
  if (!wait) return false
  return items.some(
    (item, i) => i > index && item.kind === 'active' && item.startMin < wait.endMin,
  )
}

/**
 * 待ちのブロックに「タイマーを始める」ボタンを出すか（2026-08-11 便FN・利用者テストのバグ修正）。
 *
 * 報告された不具合: 同じ見た目の待ちブロックなのに、ボタンが出る手順と出ない手順があった
 * （段取りA＝手順1にはあり、手順9「豆腐とわかめを入れて2分温める」には無い。
 * 段取りB＝待ち5つのうちボタンは1つだけ）。ボタンの無い手順では、タイマーを動かす唯一の
 * 手段が本文中の小さな「15分」の文字（実測69×43px）になり、濡れた手では押せない。
 *
 * 真因は次の2つの条件で、どちらも**ブロックが名乗っている分数とは別のもの**を見ていた:
 *   1. `minutes != null` … 手順に分数が書かれていない待ち（調理法から当てた分数）を外していた。
 *      ブロックは「約8分の待ち時間」と名乗っているのに、ボタンだけが消える
 *   2. `!isMinutesShownInText(...)` … 本文に同じ分数が書いてあれば本文タップで足りる、
 *      という前提。台所では本文中の小さな文字を狙って押すのは現実的でない
 *
 * そこで**ブロックが分数を名乗っているかどうか**だけで決める＝「約◯分の待ち時間」と書いた
 * ブロックには必ずボタンがある。分数を出さない長い待ち（半日〜一晩）にだけ出さない
 * （何分のタイマーか決められないため。理由はブロック内の一文が伝える）。
 * ナビが足した湯沸かしは分数を表に出さないが、沸くまでの待ちにタイマーは要るので出す
 * （従来からボタンが出ていた側で、見え方は変わらない）。
 *
 * 本文中の時間表記のタップは今までどおり残る＝同じ長さなら押した先も同じタイマー
 * （TimerProvider の key が `レシピ-手順-秒数` なので二重には立たない）。
 */
export function showsWaitTimerButton(
  item: Pick<TimelineItem, 'kind' | 'longRest' | 'waitMinutes'>,
): boolean {
  return item.kind === 'wait' && !item.longRest && item.waitMinutes > 0
}

/**
 * 待ちのブロックの「タイマーを始める」で数える秒数（2026-08-14 便GK・実操作テスト3回目）。
 *
 * 原文: 「本文は『12〜15分焼く』。ボタンのラベルは『12〜15分 タイマー開始』なのに、表示と実際の
 * 待ちは約15分。チーズがのっているものを最初から15分放置に設定するのは危ない。12分で一度見る
 * ほうが正しい。焦げるかどうかを見るタイミングを潰しています」
 *
 * 幅で書かれた待ち（「12〜15分」）は**短いほうで鳴らす**。段取りの待ち分数（`waitMinutes`）は
 * 長いほうのままにしてある＝待ちの中へ詰め込みすぎないため。役割を分けることで、
 * 「見るタイミングを潰さない」と「詰め込みすぎない」の両方を安全側に倒せる。
 * 幅で書かれていない待ちは、これまでどおりその待ち分数で鳴らす。
 */
export function waitTimerSeconds(
  item: Pick<TimelineItem, 'text' | 'waitMinutes'> & { longRest?: boolean },
): number {
  const full = Math.max(0, item.waitMinutes) * 60
  if (full <= 0) return 0
  const ranged = findTimeTokens(stepMainText(item.text ?? '')).find(
    (token) => token.maxSeconds === full && token.seconds < token.maxSeconds,
  )
  return ranged ? ranged.seconds : full
}

/**
 * その品の段取りが「今回の調理では終わらない長い待ち」で終わるか（2026-08-11 便FL・司令部裁定）。
 *
 * 「完成」の印は**料理ができた合図**として読まれる。最後の手順が「冷蔵庫で半日〜一晩漬ける」の
 * ときにこれを出すと、同じカードの中で「今回の調理では仕上がらない」と「完成」が並び、
 * 画面が自分で矛盾を言う。そこだけ別の言い方に差し替えるための判定。
 *
 * **最後の手順が長い待ちのときだけ**に限る。長い待ちが途中にある品
 * （フルーツヨーグルトバーク＝冷凍3時間→凍ったら割る）は、最後の手順まで進めば本当に
 * 出来上がるので「完成」のままでよい。
 */
export function endsWithLongRest(
  items: readonly { recipeId: number; longRest: boolean }[],
  recipeId: number,
): boolean {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].recipeId === recipeId) return items[i].longRest
  }
  return false
}

function makeItem(
  order: number,
  job: Job,
  step: Job['steps'][number],
  startMin: number,
  endMin: number,
): TimelineItem {
  return {
    order,
    recipeId: job.recipeId,
    recipeTitle: job.title,
    colorIndex: job.colorIndex,
    stepNumber: step.stepNumber,
    stepIndex: step.stepIndex,
    text: step.text,
    memo: step.memo,
    minutes: step.minutes,
    kind: step.kind,
    waitMinutes: step.waitMinutes,
    waitEstimated: step.waitEstimated,
    longRest: step.longRest,
    activeMinutes: step.activeMinutes,
    activeEstimated: step.activeEstimated,
    addedByNavi: step.addedByNavi,
    splitOf: step.splitOf,
    splitPart: step.splitPart,
    startMin,
    endMin,
  }
}
