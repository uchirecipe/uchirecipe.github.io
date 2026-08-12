import type { Recipe, Step } from '../db/types'
import { findTimeTokens } from './time'
import { ja } from '../i18n/ja'

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
  // 電子レンジ。「チン」は単独だと「チンゲン菜」「チンジャオロース」に誤爆するため
  // （実測: 「チンゲン菜の茎を1分炒め」が待ち系に化けていた）、動詞になる形だけを拾う
  /レンジ|電子レンジ|チンす|チンし/,
  /[0-9０-９]+\s*[WＷ]/, // 「600Wで3分加熱」等のレンジ出力ワット数（点火後は基本放置でよい）
  /発酵/, // 発酵
  /なじ|馴染/, // 味をなじませる
  /しみ|染み/, // 味をしみ込ませる
  /置い|置く|おく|おき/, // そのまま10分おく 等（minutes があるときのみ待ち扱いになる）
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
 */
const NON_WAIT_NOUN_PATTERN =
  /漬け汁|漬けだれ|漬けタレ|漬けダレ|漬け床|漬物|漬け物|オーブンシート|オーブンペーパー|しょうゆ|つゆ|煮干し|蒸し器|蒸しパン|ゆで卵|ゆでうどん|ゆで麺|お浸し/g

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
  { pattern: /冷蔵庫/, minutes: 30 },
  // 「煮立てる」は沸かすのと同じで、煮込みほど長くない（同梱109品の目視。10分は長すぎた）
  { pattern: /煮立て/, minutes: 5 },
  { pattern: /煮/, minutes: 10 },
  { pattern: /茹で|ゆで/, minutes: 8, skipForNoodles: true },
  { pattern: /蒸/, minutes: 8 },
  { pattern: /ふたをして|フタをして|蓋をして/, minutes: 8 },
  { pattern: /沸か|沸騰させ/, minutes: 5 },
  { pattern: /レンジ|チンす|チンし|[0-9０-９]\s*[WＷ]/, minutes: 3 },
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
  const haystack = `${step.text}\n${step.memo ?? ''}`
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
  const maxSeconds = Math.max(...tokens.map((t) => t.seconds))
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
  if (!hasExplicitMinutes && lastIndexOfPatterns(text, [ACTION_VERB_PATTERN]) >= waitAt) return 'active'
  const minutes = resolveWaitMinutes(step)
  return minutes != null && minutes >= MIN_PARALLEL_WAIT_MINUTES ? 'wait' : 'active'
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
    patterns: [/混ぜ|まぜ|和え|あえ|こね|練る|練り|溶く|溶き|下味|もみ込|もみこ|まぶ|(?<!炒め|煮|焼き|揚げ|いため)合わせ|漬け|漬ける|にぎる|包む|巻く|形を整え|成形/],
  },
  {
    category: 'heat',
    patterns: [/焼く|焼き|焼い|炒め|炒る|揚げ|煮る|煮込|煮立|茹で|ゆで|蒸す|蒸し|加熱|レンジ|グリル|オーブン|沸か|沸騰|温め|火にかけ|熱し|熱する/],
  },
  {
    category: 'finish',
    patterns: [/盛る|盛り|器に|添え|散らす|散らし|かけて仕上げ|仕上げ|盛りつけ|盛り付け|上にのせ|いただ/],
  },
]

/**
 * 手順の作業の種類を、本文の中で最後に出てきた見分け語から決める。
 * どの見分け語にも当たらなければ undefined（＝その断片には動作が書かれていない）。
 */
function matchedCategory(text: string): StepCategory | undefined {
  let best: StepCategory | undefined
  let bestAt = -1
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    const at = lastIndexOfPatterns(text, patterns)
    if (at > bestAt) {
      bestAt = at
      best = category
    }
  }
  return best
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
  category: StepCategory
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
      const category = matchedCategory(fragment)
      const last = groups[groups.length - 1]
      if (category === undefined) {
        // 動作の書かれていない断片（「ボウルに」「お好みで」）は、直前のまとまりの一部として扱う
        if (last) last.text += fragment
        continue
      }
      if (last && groups.length > sentenceStart && last.category === category) {
        last.text += fragment
        continue
      }
      groups.push({ category, text: fragment })
    }
    sentenceStart = groups.length
  }
  return groups
}

/** その動作のまとまり1つぶんの目安（分） */
function groupBaseMinutes(group: StepActionGroup): number {
  // 「油を熱する」「火にかける」だけの加熱は、手を動かす時間そのものは短い
  if (group.category === 'heat' && !SUSTAINED_COOK_PATTERN.test(group.text)) {
    return QUICK_HEAT_MINUTES
  }
  return ACTIVE_MINUTES_BY_CATEGORY[group.category]
}

export interface ActiveMinutesEstimate {
  minutes: number
  /** レシピに書かれた時間ではなく、ナビが当てた見積りか（画面ではその旨を添えて出す） */
  estimated: boolean
}

export function estimateActiveMinutes(step: Step): ActiveMinutesEstimate {
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
  /煮|蒸|オーブン|グリル|トースター|焼き|揚げ|ふたをして|フタをして|蓋をして|火を通|沸か|沸騰/
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

export function recipeServeTemp(recipe: Pick<Recipe, 'title' | 'steps'>): ServeTemp {
  const steps = recipe.steps ?? []
  if (steps.length === 0) return 'neutral'
  if (steps.some((s) => CHILL_STEP_PATTERN.test(s.text))) return 'cold'
  if (COLD_TITLE_PATTERN.test(recipe.title ?? '')) return 'cold'
  if (endsWithHeat(recipe)) return 'hot'
  return HEAT_FINISH_PATTERN.test(maskNonWaitNouns(steps[steps.length - 1].text)) ? 'hot' : 'neutral'
}

const SERVE_RANK: Record<ServeTemp, number> = { cold: 0, neutral: 1, hot: 2 }

/** 完成の順番に使う数字（小さいほど先に仕上げたい） */
export function serveTempRank(recipe: Pick<Recipe, 'title' | 'steps'>): number {
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
 * レシピの手順を、段取りに載せる形に展開する（必要なら「湯を沸かす」を1つ足す）。
 *
 * 1レシピにつき1回まで（鍋を何度も沸かす想定はしない）。次の2通りがある:
 *   - ゆでる工程はあるが湯沸かしがどこにも書かれていない → 「湯を沸かす」を直前に差し込む
 *   - 湯沸かしがゆでる工程と**同じ手順の中に**書かれている → その部分だけを前の工程に切り出す
 *     （2026-08-09 便EH。沸かし始めからの時間が段取りに乗らず、待ちが短く出ていた）
 * 前の手順ですでに湯を沸かしているレシピには何もしない。
 */
export function buildPlanSteps(steps: readonly Step[]): PlanStep[] {
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
  const boiled: PlanStep = { ...plain[boilAt], splitOf: boilAt + 1, splitPart: 2 }
  return [
    ...plain.slice(0, boilAt),
    addedAt(ja.cookNavi.addedBoilWaterStep),
    boiled,
    ...plain.slice(boilAt + 1),
  ]
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
  }[]
  /** 次に着手する手順の添字 */
  ptr: number
  /** 次の手順を始められるようになる時刻（前の手順の終了 or 待ちの完了） */
  readyAt: number
  /**
   * 「この時刻までに手を戻さないといけない」待ちを仕掛けている状態（0＝無し。2026-08-09 便EH）。
   * ゆで上がり・煮上がりの時刻。ここを過ぎて別の作業を続ける段取りは物理的に成立しない。
   */
  attendUntil: number
}

function buildJobs(recipes: Recipe[]): Job[] {
  return recipes
    .filter((r) => r.id != null && r.steps.length > 0)
    .map((r, colorIndex) => ({
      recipeId: r.id!,
      title: r.title,
      colorIndex,
      serveRank: serveTempRank(r),
      ptr: 0,
      readyAt: 0,
      attendUntil: 0,
      steps: buildPlanSteps(r.steps).map(({ step: s, stepIndex, stepNumber, addedByNavi, splitOf, splitPart }) => {
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
        const active = estimateActiveMinutes(s)
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
        }
      }),
    }))
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
 *   2. **完成の順番**（finishBias・2026-08-08 便EG）。その品の最後の手順のときだけ効く。
 *      冷やす品は先に仕上げて冷蔵庫へ、熱々の品は最後に仕上げる。温度が読めない品は据え置き
 *   3. **切る工程を続ける**（cutRun・2026-08-09 便EH・オーナー実機報告
 *      「切る手順がまだ後回しになっている。全部レシピ分カットの流れが自然」）。
 *      直前が“切る”なら、別レシピの“切る”をレシピをまたいで続けて片付ける
 *   4. **残り時間が長いレシピを先に**（remainingSpan）。長く掛かる品を後回しにすると
 *      全体が伸びるため。待ちを早く仕掛けることにもなる
 *   5. **段階の大枠**（下ごしらえ→加熱→仕上げ）。同じくらい急ぐ品どうしなら、
 *      切る・洗う・下味などの準備を先に、盛り付けは最後にまわす
 *   6. **直前と同じ種類の作業を続ける**（切る以外）
 *   7. レシピの選択順（ここまで同点なら並びを安定させるだけ）
 */
export function buildCookTimeline(recipes: Recipe[]): CookTimeline {
  const jobs = buildJobs(recipes)
  const items: TimelineItem[] = []
  let cookAt = 0

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
   */
  const finishBias = (j: Job) => (j.ptr === j.steps.length - 1 ? j.serveRank : 1)

  while (hasRemaining()) {
    const active = jobs.filter((j) => j.ptr < j.steps.length)
    let ready = active.filter((j) => j.readyAt <= cookAt)
    if (ready.length === 0) {
      // いま着手できるものが無い＝全部が裏の待ち中。次に明ける時刻まで進める
      cookAt = Math.min(...active.map((j) => j.readyAt))
      ready = active.filter((j) => j.readyAt <= cookAt)
    }

    /**
     * 「この時刻までに手を戻さないといけない」いちばん早い締め切り（2026-08-09 便EH）。
     * ゆで上がり・煮上がりのうち、まだ手を付けていないものの中でいちばん早い時刻。
     * 該当が無ければ Infinity（＝上限なし）。
     */
    const attendDeadline = jobs.reduce(
      (min, j) => (j.attendUntil > cookAt ? Math.min(min, j.attendUntil) : min),
      Number.POSITIVE_INFINITY,
    )
    /** その手作業を今から始めても、締め切りまでに手が空くか */
    const fitsBeforeDeadline = (j: Job) => cookAt + j.steps[j.ptr].activeMinutes <= attendDeadline

    // 手作業の選び方（上のコメントの1〜7）。切る工程どうしだけは、まな板の順序（野菜→肉・魚）を先に見る
    const attendDue = (j: Job) => (j.attendUntil > 0 && j.readyAt <= cookAt ? 0 : 1)
    const cutRun = (j: Job) =>
      lastActiveCategory === 'cut' && j.steps[j.ptr].category === 'cut' ? 0 : 1
    const sameCat = (j: Job) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
    const pickActive = (candidates: Job[]): Job =>
      candidates.slice().sort((a, b) => {
        const stepA = a.steps[a.ptr]
        const stepB = b.steps[b.ptr]
        if (stepA.category === 'cut' && stepB.category === 'cut' && stepA.cutRank !== stepB.cutRank) {
          return stepA.cutRank - stepB.cutRank
        }
        return (
          attendDue(a) - attendDue(b) ||
          finishBias(a) - finishBias(b) ||
          cutRun(a) - cutRun(b) ||
          remainingSpan(b) - remainingSpan(a) ||
          stepA.stageRank - stepB.stageRank ||
          sameCat(a) - sameCat(b) ||
          a.colorIndex - b.colorIndex
        )
      })[0]

    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    // 待ちが長いものから仕掛ける（同着はレシピの選択順で安定させる）
    waits.sort(
      (a, b) =>
        b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes || a.colorIndex - b.colorIndex,
    )
    // 待ちの締め切りに間に合う手作業だけを差し込みの候補にする
    const fittingActives = ready.filter(
      (j) => j.steps[j.ptr].kind === 'active' && fitsBeforeDeadline(j),
    )
    const shortestActive = fittingActives.reduce(
      (min, j) => Math.min(min, j.steps[j.ptr].activeMinutes),
      Number.POSITIVE_INFINITY,
    )
    // 締め切りのある待ちが明けた品は、続きの待ちも待たせない
    // （湯が沸いたらすぐ材料を入れる。沸いた湯を放置する段取りにしない）
    const dueWaits = waits.filter((j) => j.attendUntil > 0)
    // 仕掛けても中に入る手作業が1つも無い短い待ちは、先に手作業を片付けてから仕掛ける
    const waitWouldIdle =
      waits.length > 0 &&
      dueWaits.length === 0 &&
      fittingActives.length > 0 &&
      waits[0].steps[waits[0].ptr].attendWithin < shortestActive
    let chosen: Job
    // 漬け込み・寝かせを仕掛ける前に、いま着手できる「切る」工程を先に片付ける
    // （2026-08-08 便EG・オーナー実機報告。生の肉・魚を漬けたあとで野菜を切りたくない）。
    // 対象は「いま着手できる待ちが全部、漬け込み・寝かせのとき」だけ＝煮る・ゆでるのような
    // ふつうの待ちは今までどおり最優先で仕掛ける
    const readyCuts = fittingActives.filter((j) => j.steps[j.ptr].category === 'cut')
    const soakOnly = waits.length > 0 && waits.every((j) => j.steps[j.ptr].soakWait)
    if (dueWaits.length > 0) {
      chosen = dueWaits[0]
    } else if (waits.length > 0 && !(soakOnly && readyCuts.length > 0) && !waitWouldIdle) {
      chosen = waits[0]
    } else if (soakOnly && readyCuts.length > 0) {
      chosen = pickActive(readyCuts)
    } else if (fittingActives.length > 0) {
      // 手作業のみ。上のコメント1〜7の順に見て決める
      chosen = pickActive(fittingActives)
    } else if (waits.length > 0) {
      chosen = waits[0]
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
    const startMin = cookAt
    // 前に仕掛けた待ちの後始末はここで済む（締め切りの管理から外す）
    chosen.attendUntil = 0
    if (step.kind === 'wait') {
      const endMin = startMin + step.waitMinutes
      chosen.readyAt = endMin
      // 「遅くともこの時刻までに手を戻す」締め切り。上限なしの待ち（漬け込み等）は 0＝管理しない
      const attendUntil = startMin + step.attendWithin
      chosen.attendUntil = Number.isFinite(attendUntil) ? attendUntil : 0
      // 待ちは仕掛けたら裏で進むので、料理人（cookAt）はその場で手すきのまま
      items.push(makeItem(items.length + 1, chosen, step, startMin, endMin))
    } else {
      const endMin = startMin + step.activeMinutes
      cookAt = endMin
      chosen.readyAt = endMin
      lastActiveCategory = step.category
      items.push(makeItem(items.length + 1, chosen, step, startMin, endMin))
    }
    chosen.ptr++
  }

  const totalMinutes = items.reduce((max, it) => Math.max(max, it.endMin), 0)
  const recipes2: TimelineRecipe[] = jobs.map((j) => ({
    id: j.recipeId,
    title: j.title,
    colorIndex: j.colorIndex,
  }))

  return { items, totalMinutes, recipes: recipes2 }
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
function buildSequentialTimeline(recipes: Recipe[]): CookTimeline {
  const valid = recipes.filter((r) => r.id != null && r.steps.length > 0)
  const ordered = valid
    .map((recipe, index) => ({ recipe, index }))
    .sort((a, b) => serveTempRank(a.recipe) - serveTempRank(b.recipe) || a.index - b.index)

  const items: TimelineItem[] = []
  let offset = 0
  for (const { recipe, index } of ordered) {
    const single = buildCookTimeline([recipe])
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
export function buildCookPlan(recipes: Recipe[]): CookPlan {
  const valid = recipes.filter((r) => r.id != null && r.steps.length > 0)
  const parallel = buildCookTimeline(valid)
  // 品ごとに「1品だけで作ったときの目安」を出し、その合計を「1品ずつ作ると約◯分」にする。
  // 内訳を画面へ渡せるように控えておく（2026-08-11 便FN）
  const soloMinutes = new Map<number, number>()
  for (const r of valid) soloMinutes.set(r.id!, buildCookTimeline([r]).totalMinutes)
  const sequentialMinutes = Array.from(soloMinutes.values()).reduce((sum, m) => sum + m, 0)
  const parallelMinutes = parallel.totalMinutes
  const withSolo = (timeline: CookTimeline): TimelineRecipe[] =>
    timeline.recipes.map((r) => ({ ...r, soloMinutes: soloMinutes.get(r.id) }))
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
    }
  }
  const sequential = buildSequentialTimeline(valid)
  return {
    ...sequential,
    recipes: withSolo(sequential),
    mode: 'sequential',
    sequentialMinutes,
    parallelMinutes,
    gainPercent,
    awayMinutes: awayWaitMinutes(sequential.items),
  }
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
