import type { Recipe, Step } from '../db/types'

/**
 * 並行調理ナビ（Pro）の中核ロジック。
 *
 * 複数レシピの手順を「1本の段取り（叩き台）」にまとめる。AIは使わず、
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
 * v1のスコープ外: 完全な最適化・手動並べ替え・4品以上（呼び出し側で2〜3品に制限する）。
 * あくまで「段取りの叩き台」であり、この通りに進めることを強制しない。
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
  /さらす|さらし/, // 水にさらす
  /温め|あたため/, // 温める
  /オーブン/, // オーブン
  /レンジ|電子レンジ|チン/, // 電子レンジ
  /発酵/, // 発酵
  /なじ|馴染/, // 味をなじませる
  /しみ|染み/, // 味をしみ込ませる
  /置い|置く|おく|おき/, // そのまま10分おく 等（minutes があるときのみ待ち扱いになる）
]

/** 手順1つを「待ち系」か「手作業系」かに分類する */
export function classifyStep(step: Step): StepKind {
  const minutes = step.minutes
  if (minutes != null && minutes > 0 && WAIT_VERB_PATTERNS.some((re) => re.test(step.text))) {
    return 'wait'
  }
  return 'active'
}

/**
 * 手作業系で minutes が書かれていない工程に、順番を組むためだけに使う仮の所要時間（分）。
 * 表示はせず、内部の並べ替え計算だけに使う。
 */
export const DEFAULT_ACTIVE_MINUTES = 4

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
        const waitMinutes = kind === 'wait' ? (s.minutes ?? 0) : 0
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
        }
      }),
    }))
}

/** そのレシピの残り手順の中で最も長い待ち分数（手作業を先にどれだけ急ぐべきかの指標） */
function maxRemainingWait(job: Job): number {
  let max = 0
  for (let i = job.ptr; i < job.steps.length; i++) {
    if (job.steps[i].kind === 'wait') max = Math.max(max, job.steps[i].waitMinutes)
  }
  return max
}

/**
 * 選んだレシピ（2〜3品想定）の手順を、1本の段取りタイムラインにまとめる。
 *
 * 貪欲法（料理人＝1人という前提の単純なシミュレーション）:
 *   - 料理人が手すきになったら、いま着手できる手順の中から次を選ぶ
 *   - 「待ち系」を優先して仕掛ける（仕掛けた瞬間から裏で時間が進み、料理人はすぐ次に移れる）
 *     待ち系が複数あるときは “待ちが長いもの” から
 *   - 着手できる待ち系が無ければ「手作業系」を1つ進める（料理人はその分ふさがる）
 *     手作業系が複数あるときは “この先に長い待ちが控えているレシピ” を優先（早く仕掛けるため）
 *   - どれも前の手順待ちで着手できなければ、次に待ちが明ける時刻まで時間を進める
 * レシピ内の手順の順序は必ず保たれる（前の手順が終わるまで次は着手できない）。
 */
export function buildCookTimeline(recipes: Recipe[]): CookTimeline {
  const jobs = buildJobs(recipes)
  const items: TimelineItem[] = []
  let cookAt = 0

  const hasRemaining = () => jobs.some((j) => j.ptr < j.steps.length)

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
      // 手作業のみ。この先に長い待ちが控えているレシピを先に進める
      const acts = ready
        .slice()
        .sort((a, b) => maxRemainingWait(b) - maxRemainingWait(a) || a.colorIndex - b.colorIndex)
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
