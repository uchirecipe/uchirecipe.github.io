import type { Recipe, Step } from '../db/types'
import { findTimeTokens } from './time'

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
]

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
  const cookAt = lastIndexOfPatterns(step.text, [HANDS_ON_COOK_PATTERN])
  if (cookAt === -1) return false
  return cookAt > lastIndexOfPatterns(step.text, WAIT_VERB_PATTERNS)
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
  const tokens = findTimeTokens(step.text)
  if (tokens.length === 0) return undefined
  const maxSeconds = Math.max(...tokens.map((t) => t.seconds))
  if (maxSeconds < 60) return undefined
  return Math.round(maxSeconds / 60)
}

/**
 * 手順1つを「待ち系」か「手作業系」かに分類する。
 * 待ち動詞（WAIT_VERB_PATTERNS）を含まない手順（切る・混ぜる・炒める・素の焼く等）は
 * 常に手作業系（安全側の既定）。待ち動詞を含む手順は、待ち分数が分かるとき（明示 minutes
 * または本文の時間表記から推定できるとき）だけ待ち系にする。時間が全く分からない待ち動詞
 * （「じっくり煮込む」等、分数の手掛かりが無いもの）は、どれだけ手を離してよいか不明なので
 * 手作業系に倒す（安全側。誤って待ち扱いにして別作業を挟ませる方が実害が大きい）。
 */
export function classifyStep(step: Step): StepKind {
  // 目を離せない工程は、待ち動詞・待ち分数に関係なく手作業系（2026-08-08 便EB）。
  // 短い待ちほど「2分しかないのに他の作業を挟まれる」実害が大きいので最優先で判定する
  if (isHandsOnStep(step)) return 'active'
  if (!WAIT_VERB_PATTERNS.some((re) => re.test(step.text))) return 'active'
  return resolveStepMinutes(step) != null ? 'wait' : 'active'
}

/**
 * 手作業系で minutes が書かれていない工程に、順番を組むためだけに使う仮の所要時間（分）。
 * 表示はせず、内部の並べ替え計算だけに使う。
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
    patterns: [/混ぜ|まぜ|和え|あえ|こね|練る|練り|溶く|溶き|下味|もみ込|もみこ|まぶ|合わせ|漬け|漬ける|にぎる|包む|巻く|形を整え|成形/],
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

/** 手順の作業の種類を、本文の中で最後に出てきた見分け語から決める */
export function stepCategory(step: Step): StepCategory {
  let best: StepCategory = 'other'
  let bestAt = -1
  for (const { category, patterns } of CATEGORY_PATTERNS) {
    const at = lastIndexOfPatterns(step.text, patterns)
    if (at > bestAt) {
      bestAt = at
      best = category
    }
  }
  return best
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

/** レシピの色分け用パレット添字（0,1,2）。CookNaviPage 側で CSS 変数のチップ色に対応づける */
export interface TimelineRecipe {
  id: number
  title: string
  colorIndex: number
}

/** 1本にまとめたタイムラインの1手順 */
export interface TimelineItem {
  /** 表示上の通し番号（1始まり） */
  order: number
  recipeId: number
  recipeTitle: string
  /** 0,1,2 のレシピ色添字 */
  colorIndex: number
  /** 元レシピ内の手順番号（1始まり。タイマー起動やレシピ内の位置表示に使う） */
  stepNumber: number
  /** 元レシピ内の手順の添字（0始まり） */
  stepIndex: number
  text: string
  memo?: string
  minutes?: number
  kind: StepKind
  /** 待ち系のときの待ち分数（手作業系は0） */
  waitMinutes: number
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
  steps: {
    stepIndex: number
    stepNumber: number
    text: string
    memo?: string
    minutes?: number
    kind: StepKind
    waitMinutes: number
    activeMinutes: number
    category: StepCategory
    stageRank: number
  }[]
  /** 次に着手する手順の添字 */
  ptr: number
  /** 次の手順を始められるようになる時刻（前の手順の終了 or 待ちの完了） */
  readyAt: number
}

function buildJobs(recipes: Recipe[]): Job[] {
  return recipes
    .filter((r) => r.id != null && r.steps.length > 0)
    .map((r, colorIndex) => ({
      recipeId: r.id!,
      title: r.title,
      colorIndex,
      ptr: 0,
      readyAt: 0,
      steps: r.steps.map((s, i) => {
        const kind = classifyStep(s)
        // 待ちの分数は明示 minutes ＞本文推定の順で解決する（classifyStep が wait を返した
        // 時点で resolveStepMinutes は必ず値を持つ）。手作業系の順序計算は従来どおり明示
        // minutes か DEFAULT_ACTIVE_MINUTES を使う（本文推定は待ちの認識だけに使い、
        // 手作業の所要時間は変えない＝順序への影響を待ち認識の改善だけに限定する）
        const waitMinutes = kind === 'wait' ? (resolveStepMinutes(s) ?? 0) : 0
        const activeMinutes =
          kind === 'active'
            ? s.minutes != null && s.minutes > 0
              ? s.minutes
              : DEFAULT_ACTIVE_MINUTES
            : 0
        return {
          stepIndex: i,
          stepNumber: i + 1,
          text: s.text,
          memo: s.memo,
          minutes: s.minutes,
          kind,
          waitMinutes,
          activeMinutes,
          category: stepCategory(s),
          stageRank: stepStageRank(s),
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
 *     待ち系が複数あるときは “待ちが長いもの” から
 *   - 着手できる待ち系が無ければ「手作業系」を1つ進める（料理人はその分ふさがる）
 *   - どれも前の手順待ちで着手できなければ、次に待ちが明ける時刻まで時間を進める
 * レシピ内の手順の順序は必ず保たれる（前の手順が終わるまで次は着手できない）。
 *
 * 手作業系が複数あるときの選び方（2026-08-08 便EB・オーナー要望「3品全体の流れを整えたい」）。
 * 上から順に見て、決まらなければ次の基準に進む:
 *   1. **残り時間が長いレシピを先に**（remainingSpan）。長く掛かる品を後回しにすると
 *      全体が伸びるため。待ちを早く仕掛けることにもなる
 *   2. **段階の大枠**（下ごしらえ→加熱→仕上げ）。同じくらい急ぐ品どうしなら、
 *      切る・洗う・下味などの準備を先に、盛り付けは最後にまわす
 *   3. **直前と同じ種類の作業を続ける**。「野菜を切る工程がバラける」を防ぐため、
 *      直前が“切る”なら別レシピの“切る”を続けて片付ける
 *   4. レシピの選択順（ここまで同点なら並びを安定させるだけ）
 * 1を最優先に置いているのは、流れを整えるために全体の所要時間を延ばさないため
 * （2・3は「1が同点のときだけ」効く）。
 */
export function buildCookTimeline(recipes: Recipe[]): CookTimeline {
  const jobs = buildJobs(recipes)
  const items: TimelineItem[] = []
  let cookAt = 0

  const hasRemaining = () => jobs.some((j) => j.ptr < j.steps.length)
  /** 直前に出した手作業の種類（同じ種類の作業を続けてまとめるために覚えておく） */
  let lastActiveCategory: StepCategory | null = null

  while (hasRemaining()) {
    const active = jobs.filter((j) => j.ptr < j.steps.length)
    let ready = active.filter((j) => j.readyAt <= cookAt)
    if (ready.length === 0) {
      // いま着手できるものが無い＝全部が裏の待ち中。次に明ける時刻まで進める
      cookAt = Math.min(...active.map((j) => j.readyAt))
      ready = active.filter((j) => j.readyAt <= cookAt)
    }

    const waits = ready.filter((j) => j.steps[j.ptr].kind === 'wait')
    let chosen: Job
    if (waits.length > 0) {
      // 待ちが長いものから仕掛ける（同着はレシピの選択順で安定させる）
      waits.sort(
        (a, b) =>
          b.steps[b.ptr].waitMinutes - a.steps[a.ptr].waitMinutes || a.colorIndex - b.colorIndex,
      )
      chosen = waits[0]
    } else {
      // 手作業のみ。残り時間→段階→同じ種類の作業→選択順、の順に見て決める
      const sameCat = (j: Job) => (j.steps[j.ptr].category === lastActiveCategory ? 0 : 1)
      const acts = ready
        .slice()
        .sort(
          (a, b) =>
            remainingSpan(b) - remainingSpan(a) ||
            a.steps[a.ptr].stageRank - b.steps[b.ptr].stageRank ||
            sameCat(a) - sameCat(b) ||
            a.colorIndex - b.colorIndex,
        )
      chosen = acts[0]
    }

    const step = chosen.steps[chosen.ptr]
    const startMin = cookAt
    if (step.kind === 'wait') {
      const endMin = startMin + step.waitMinutes
      chosen.readyAt = endMin
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

/**
 * タイムライン上で index の手順より後に「手作業系」の手順が残っているか。
 * 待ち手順の「この間に、次の手作業を進められます」ヒントは、実際に後続の手作業が
 * あるときだけ表示する（最後の待ち工程にまで出るのを防ぐ。2026-07-09ペルソナ第2波）
 */
export function hasLaterHandsOnStep(items: readonly { kind: StepKind }[], index: number): boolean {
  return items.some((item, i) => i > index && item.kind === 'active')
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
    startMin,
    endMin,
  }
}
