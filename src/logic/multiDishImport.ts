/**
 * 「1品の中に料理がいくつも入っている」取り込みを見分ける（2026-08-25 便KO・④）。
 *
 * オーナーの裁定（原文）: 「1品に複数料理が入った品は、取り込みのときに知らせるだけ（機械で分けない）」。
 * したがってこのモジュールは**判定して数を数えるだけ**で、材料・手順には一切手を触れない。
 *
 * ## なぜ要るか（実データの実測）
 * 影響範囲テストの取り込み90品のうち2品が、1品の登録に複数の料理を抱えていた。
 *   ・「変幻自在おかず！ ねぎ3本使い切り献立」＝材料34件・手順14件・料理5つ
 *   ・「お弁当に使える♪ ブロッコリー使い切り3選」＝材料16件・手順9件・料理3つ
 * どちらも1品として保存されるため、材料はすべて1皿分として合算され、献立にも1品として並ぶ。
 *
 * ## 見分け方（実データ90品＋同梱109品で測って決めた）
 * ①**手順の先頭に付いた見出し**が2種類以上ある
 *    「＜豚肉とねぎのごまポン酢しょうゆ＞ ねぎは4cm幅に切る。」「【マヨチーズ焼き】耐熱容器に…」
 *    のように、料理ごとの区切りが手順の**行頭**に書かれる。
 * ②料理名が複数の料理を指している（「◯選」「献立」）
 *
 * ## 測った結果（誤検出）
 * 材料の件数だけでは決められない（16件の「ブロッコリー使い切り3選」と、ふつうの1品である
 * 17件の「麻婆豆腐」・16件の「厚揚げの麻婆豆腐」が重なる）ので、件数は条件に使わない。
 * 見出しは**行頭に限る**ことと**合わせ調味料の印を外す**ことが要る:
 *   ・「保存袋に【A】を入れて混ぜ」「【煮汁】が少なくなって」は文の途中の合わせ調味料の印
 *   ・「【お好みで】みじん切りにした大葉を添えても◯」は行頭だが料理名ではない
 * この2つを外すと、取り込み90品＋同梱109品の199品で、複数料理と判定されるのは上の2品だけになる。
 */

/** 見出しの囲み（全角・半角の括弧）。中身は1〜20字まで見る */
const HEADING_AT_LINE_START = /^[\s　]*[＜〈《【[［<]([^＞〉》】\]］>]{1,20})[＞〉》】\]］>]/

/**
 * 見出しに見えるが料理名ではない語（実データで実際に出たものと、同じ役目の言葉）。
 * 合わせ調味料の印・工程の断り書きで、これを料理名と読むと、ふつうの1品を複数料理と言ってしまう。
 */
const NOT_DISH_HEADINGS: readonly string[] = [
  'お好みで',
  'お好み',
  '調味料',
  '合わせ調味料',
  '煮汁',
  'たれ',
  'タレ',
  'ソース',
  '下味',
  '下準備',
  '準備',
  '仕上げ',
  '作り方',
  '材料',
  'ポイント',
  'コツ',
  'メモ',
  '注意',
  '保存',
  'トッピング',
  '付け合わせ',
]

/**
 * 料理名が「いくつもの料理」を指している形（「3選」「5品」「◯◯献立」）。
 * 「1選」「1品」は1つなので数えない。
 */
const TITLE_SAYS_MANY = /[2-9２-９]\s*[選品]|[二三四五六七八九]\s*[選品]|献立/

/** 記号・英数字だけの見出し（「A」「B」「☆」「A-1」）は合わせ調味料の印なので料理名ではない */
function isMarkOnly(text: string): boolean {
  return !/[ぁ-んァ-ヶ一-龥]/.test(text)
}

/** その1行が料理の見出しで始まっていれば、その見出しを返す */
export function dishHeadingOf(stepText: string): string | undefined {
  const matched = HEADING_AT_LINE_START.exec(stepText)
  if (!matched) return undefined
  const heading = matched[1].trim()
  if (heading === '') return undefined
  if (isMarkOnly(heading)) return undefined
  if (NOT_DISH_HEADINGS.some((word) => heading === word || heading.startsWith(word))) return undefined
  return heading
}

export interface MultiDishInput {
  title: string
  steps: readonly { text: string }[]
}

export interface MultiDishSignal {
  /** 手順の行頭から拾った料理の見出し（順番はそのまま・重複は落とす） */
  headings: string[]
  /** 料理名が複数の料理を指している（「3選」「献立」） */
  titleSaysMany: boolean
}

/**
 * 取り込んだ1品に複数の料理が入っていそうかを見る。
 * 当てはまらなければ undefined（＝何も知らせない）。
 */
export function detectMultiDish(input: MultiDishInput): MultiDishSignal | undefined {
  const headings: string[] = []
  for (const step of input.steps) {
    const heading = dishHeadingOf(step.text)
    if (heading && !headings.includes(heading)) headings.push(heading)
  }
  const titleSaysMany = TITLE_SAYS_MANY.test(input.title)
  if (headings.length < 2 && !titleSaysMany) return undefined
  return { headings, titleSaysMany }
}

/** 知らせに出す料理の数（見出しから数えられないときは undefined＝数を言わない） */
export function multiDishCount(signal: MultiDishSignal): number | undefined {
  return signal.headings.length >= 2 ? signal.headings.length : undefined
}
