/**
 * URL取り込みの結果(Worker応答)をフォームの行へ落とし込む前処理(2026-07-28 便BX/C07・C08・C09)。
 *
 * RecipeFormPage.tsx から切り出して vite非依存にしてあり、scripts/test-logic.mjs から
 * 直接テストできる(urlImportImage.ts・urlImportReason.ts と同じ作法)。
 *
 * ここでやること:
 * - C07: 貼り付け経路のゴミ行判定(EXACT/PREFIX/REGEX)を材料・手順にも通す(経路間の非対称の解消)
 * - C08: 材料のグループ情報(「A水」のA / 「合わせ調味料」等の見出し行)を、捨てずに
 *        合わせ調味料グループ(seasoningGroup)と材料メモへ引き継ぐ
 * - C09: 分量を読み取れなかった材料の件数を数えられるようにする(取り込み結果の内訳表示用)
 * - IL①: 取り込んだ文に残ったHTMLの印(タグ・実体参照)を落とす
 * - IL②: 注記の行を、前の手順のメモへ寄せる
 * - IL④: 材料に混じった調理器具に印を付ける(外しはしない)
 */
import {
  assignSeasoningGroupsByMark,
  isImportGomiLine,
  isIngredientGroupHeading,
  normalizeImportedIngredient,
} from './parseRecipeText'
import { MAX_SEASONING_GROUP } from './seasoningGroup'

/** Worker応答の材料1件(src/logic/urlImport.ts の ImportedIngredient と同じ形) */
export interface ImportedIngredientLike {
  name: string
  amount?: string
  group?: string
}

/** フォームの材料行(RecipeFormPage.tsx の IngredientRow と同じ形) */
export interface ImportedIngredientRow {
  name: string
  amount: string
  unit: string
  memo: string
  group: number | undefined
}

// ============================================================================
// ① 取り込んだ文に残ったHTMLの印を落とす(2026-08-20 便IL・オーナー実機報告
//    「手順で『<br>』が入ったままなのは気になった。」)
// ============================================================================

/**
 * 改行として扱うタグ(<br>と、段落・箇条書き・表の行の閉じタグ)。
 * ただ落とすだけだと前後の文がくっついて「卵を溶く砂糖を加える」になるため、先に改行へ置き換える。
 */
const LINE_BREAK_TAG = /<\s*br\s*\/?\s*>|<\/\s*(?:p|div|li|tr|h[1-6])\s*>/gi
const HTML_TAG = /<[^>]*>/g

/** よくあるHTML実体参照を読み解く(数値参照を含む) */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
}

function stripTags(text: string): string {
  return text.replace(LINE_BREAK_TAG, '\n').replace(HTML_TAG, '')
}

/**
 * 取り込んだ1つぶんの文から、HTMLの印(タグ・実体参照)を落として1行に整える。
 *
 * **落とす→読み解く→もう一度落とす**の2周にしてある。取り込み元には、同じ改行を「生のタグ」で
 * 書くサイトと「&lt;br&gt;」のように実体参照へ置き換えて書くサイトの両方があり、1周だけだと
 * 読み解いたあとに現れる「<br>」が本文にそのまま残る(オーナーが実機で見た形)。
 *
 * 同じ手当ては取り込み元を読む Worker 側(workers/recipe-import/src/normalize.ts の cleanText)
 * にも入れてあるが、**アプリはWorkerを差し替えずに更新されうる**ので、受け取った側でももう一度
 * 通す(既にきれいな文は1文字も変わらない)。
 */
export function stripImportedMarkup(text: string): string {
  if (!text) return ''
  return stripPastedMarkup(text)
    .replace(/[\s　]+/g, ' ')
    .trim()
}

/**
 * 貼り付けた文章からHTMLの印だけを落とす（改行はそのまま残す版）。
 *
 * 貼り付け取り込み（写真取り込みのBYO-AIを含む）は**行の切れ目で材料・手順を見分ける**ので、
 * stripImportedMarkup のように空白をまとめてしまうと解釈できなくなる。
 * ここでは印を落とすだけにして、行の形はそのまま parseRecipeText へ渡す。
 */
export function stripPastedMarkup(text: string): string {
  if (!text) return ''
  return stripTags(decodeHtmlEntities(stripTags(text)))
}

/**
 * グループ記号(A/B/…)を合わせ調味料グループ番号(1〜MAX_SEASONING_GROUP)に対応づける。
 * 上限を超える記号(Eより後ろ)は色が一周して別グループと見分けが付かなくなるため未設定にする
 * (記号自体は材料メモに残るので情報は失われない)。
 */
export function seasoningGroupFromLetter(letter: string | undefined): number | undefined {
  if (!letter) return undefined
  const normalized = letter.trim().normalize('NFKC').toUpperCase()
  if (!/^[A-Z]$/.test(normalized)) return undefined
  const index = normalized.charCodeAt(0) - 'A'.charCodeAt(0) + 1
  return index <= MAX_SEASONING_GROUP ? index : undefined
}

/**
 * 手順の配列からゴミ行(SNS名だけの行・URLだけの行・ハッシュタグ行など)を落とす。
 * 全部落ちてしまう場合だけは判定を疑って元のまま返す(取り込みが丸ごと空になる事故を防ぐ安全弁)。
 */
export function filterImportedSteps(steps: string[]): string[] {
  // 先にHTMLの印を落としてから判定する(印が付いたままだとゴミ行の判定も当たらない)
  const cleaned = steps.map(stripImportedMarkup).filter((text) => text !== '')
  const kept = cleaned.filter((text) => !isImportGomiLine(text))
  return kept.length > 0 || cleaned.length === 0 ? kept : cleaned
}

/**
 * Worker応答の材料をフォームの行に変換する。
 * - ゴミ行は落とす(C07)
 * - 分量を持たないグループ見出し行(「合わせ調味料」「【A】」等)は材料にせず、
 *   それ以降の材料を1つのグループとしてまとめる(C08)
 * - 「A水」のようにグループ記号が付いていた材料は、記号をメモに残しつつグループ色を割り当てる(C08)
 *
 * 材料が1件も残らない場合は判定を疑い、ゴミ除去も見出し判定もしない素の変換に戻す(安全弁)。
 */
export function buildImportedIngredientRows(
  rawIngredients: ImportedIngredientLike[],
): ImportedIngredientRow[] {
  // 材料側もHTMLの印を落としてから解釈する(名前に印が残ると栄養・原価の名前照合も外れる)
  const ingredients: ImportedIngredientLike[] = rawIngredients.map((ing) => ({
    ...ing,
    name: stripImportedMarkup(ing.name),
    ...(ing.amount !== undefined ? { amount: stripImportedMarkup(ing.amount) } : {}),
  }))
  const toRow = (
    ing: ImportedIngredientLike,
    group: number | undefined,
    keepGroupLabel: boolean,
  ): ImportedIngredientRow => {
    const parsed = normalizeImportedIngredient(ing.name, ing.amount)
    // グループ記号は材料名には戻さない(栄養・原価の名前照合を壊さないため)。
    // 手順文の「Aを加えて」を材料側から追えるよう、メモの先頭にだけ残す
    const memo = [keepGroupLabel ? ing.group : undefined, parsed.memo].filter(Boolean).join(' ')
    return {
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      memo,
      group,
    }
  }

  const rows: ImportedIngredientRow[] = []
  /** 印から組を決めるための控え(行と同じ並び。2026-08-14 便GF) */
  const marks: (string | undefined)[] = []
  let headingGroup = 0
  let hasExplicitGroup = false
  for (const ing of ingredients) {
    if (isImportGomiLine(ing.name)) continue
    const parsed = normalizeImportedIngredient(ing.name, ing.amount)
    // 見出しと判定してよいのは「分量も単位も持たない行」だけ(実材料を誤って消さないための条件)
    if (!parsed.amount && !parsed.unit && isIngredientGroupHeading(parsed.name)) {
      headingGroup++
      continue
    }
    const letterGroup = seasoningGroupFromLetter(ing.group)
    const currentHeadingGroup =
      headingGroup >= 1 && headingGroup <= MAX_SEASONING_GROUP ? headingGroup : undefined
    const group = letterGroup ?? currentHeadingGroup
    if (group != null) hasExplicitGroup = true
    rows.push(toRow(ing, group, true))
    marks.push(parsed.mark)
  }
  if (rows.length === 0 && ingredients.length > 0) {
    return ingredients.map((ing) => toRow(ing, seasoningGroupFromLetter(ing.group), true))
  }
  // 取り込み元がグループを持たないとき(見出しも「A水」の記号も無い)だけ、材料名の先頭に
  // 付いた印(☆・◎・A等)から組を決める(2026-08-14 便GF・貼り付け取り込みと同じ規則)。
  // 取り込み元の組と混ぜると番号が衝突するので、**どちらか一方だけ**を使う
  if (!hasExplicitGroup) {
    const marked = assignSeasoningGroupsByMark(
      rows.map((row, i) => ({
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        ...(row.memo ? { memo: row.memo } : {}),
        ...(marks[i] ? { mark: marks[i] } : {}),
      })),
    )
    return rows.map((row, i) => ({
      ...row,
      name: marked[i].name,
      memo: marked[i].memo ?? '',
      group: marked[i].group,
    }))
  }
  return rows
}

/** 分量も単位も読み取れなかった材料(名前だけの行)の件数。取り込み結果の内訳表示に使う(C09) */
export function countAmountlessRows(rows: ImportedIngredientRow[]): number {
  return rows.filter((row) => !row.amount.trim() && !row.unit.trim()).length
}
// ============================================================================
// ② 注記の行を、前の手順のメモへ寄せる(2026-08-20 便IL・オーナー実機報告
//    「自動だと手順のメモ欄は基本的に未対応？プリンのカラメルの手順の後に、
//      単独手順で代用可能の工程が挟まっているのが気になった。」)
// ============================================================================

/** 手順1件ぶん(本文とメモ)。フォームの StepRow に流し込む前の形 */
export interface ImportedStepRow {
  text: string
  memo: string
}

/**
 * 注記の印。**「※」と「＊」だけ**にしてある。
 *
 * 実サイト168本・手順1,070件を数えた結果、「★」「☆」「◆」「●」「■」「・」は
 * 合わせ調味料の印(「★を加えて煮立たせる」)・小見出し(「■卵黄生地。」)・箇条書きの点として
 * 使われていて、注記の印ではなかった。半角の「*」も箇条書きの点として使われるため入れない。
 */
const STEP_NOTE_MARK = /^[※＊]+[\s　]*/

/**
 * 印のすぐ後ろが助詞・「印」・「マーク」なら、注記ではなく**材料に付けた印を指した本物の手順**
 * (「※の板チョコはトッピング用に取り分ける」楽天レシピ実測)。手順として残す。
 */
const STEP_NOTE_MARK_REFERENCE = /^[※＊]+[\s　]*(?:[のをはがにでとも]|印|マーク)/

/**
 * 取り込んだ手順の並びのうち、注記の行を**直前の手順のメモ**へ寄せる。
 *
 * 寄せる条件は上の2つの正規表現だけ＝**行頭の注記の印**で判断する。
 * 「代用」「お好みで」のような**語での判断はしない**: 同じ実測で「お好みで」を含む手順は
 * 大半が「器に盛り、お好みでパセリをふる」のような本物の仕上げ手順で、語で寄せると
 * 手順そのものが消える。
 *
 * - 先頭の行は寄せ先が無いので、注記の印が付いていても手順として残す(消さない)
 * - 注記が続いたときは1つのメモに改行でつないで入れる(手順の数を増やさない)
 * - 手順の本文は1文字も書き換えない
 */
export function attachImportedStepNotes(steps: string[]): ImportedStepRow[] {
  const rows: ImportedStepRow[] = []
  for (const step of steps) {
    const text = step.trim()
    if (!text) continue
    const isNote =
      rows.length > 0 && STEP_NOTE_MARK.test(text) && !STEP_NOTE_MARK_REFERENCE.test(text)
    if (isNote) {
      const note = text.replace(STEP_NOTE_MARK, '').trim()
      if (note) {
        const prev = rows[rows.length - 1]
        prev.memo = prev.memo ? `${prev.memo}\n${note}` : note
        continue
      }
    }
    rows.push({ text, memo: '' })
  }
  return rows
}

// ============================================================================
// ④ 材料に混じった調理器具に印を付ける(2026-08-20 便IL・オーナー実機報告
//    「このレシピだと、材料と一緒に調理器具も登録されます。」)
// ============================================================================

/**
 * 調理器具として印を付ける語。**名前の末尾がこれらのどれかに当たるか**で判定する。
 *
 * 部分一致にしない理由: 材料側にも器具の語を含む本物の材料がある。
 * 「型用バター」(型に塗るバター)・「冷凍パイシート」・「型抜きクッキーの生地」は材料で、
 * 「型」「シート」を含むだけで印を付けると本物の材料に印が付く。
 * 同じ理由で「シート」「器」「皿」のような短い語だけでは判定せず、
 * 「クッキングシート」「オーブンシート」のように器具として通る形で持つ。
 */
const COOKWARE_SUFFIXES: readonly string[] = [
  '型',
  'カップ',
  '容器',
  'ボウル',
  'バット',
  '天板',
  '鍋',
  'フライパン',
  'ざる',
  'ザル',
  'こし器',
  '茶こし',
  '泡立て器',
  '蒸し器',
  'せいろ',
  'ミキサー',
  'ミルサー',
  'フードプロセッサー',
  '絞り袋',
  'しぼり袋',
  '保存袋',
  'ポリ袋',
  'ビニール袋',
  'タッパー',
  'まな板',
  '包丁',
  '菜箸',
  '竹串',
  'つまようじ',
  '爪楊枝',
  'アルミホイル',
  'ラップ',
  'クッキングシート',
  'オーブンシート',
  'オーブンペーパー',
  'クッキングペーパー',
  'キッチンペーパー',
  '温度計',
  'はかり',
  'スケール',
  '口金',
  'ゴムベラ',
  'シリコンベラ',
  '木ベラ',
  'トング',
  'オーブン',
  'オーブントースター',
  'トースター',
  '電子レンジ',
  '炊飯器',
  'ホットプレート',
]

/** 判定に入る前に、括弧書きの注記・見出しの括弧・行頭の飾り記号・「を使用」を外す */
function normalizeCookwareName(name: string): string {
  return name
    .normalize('NFKC')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[【[][^】\]]*[】\]]/g, '')
    .replace(/^[\s　【】[\]（）()〔〕■□●○◆◇★☆※＊*・‐-]+/, '')
    .replace(/[\s　【】[\]（）()〔〕。、]+$/, '')
    .replace(/(?:を)?(?:使用|用意)$/, '')
    .trim()
}

/**
 * その材料行が調理器具かどうか(2026-08-20 便IL・④)。
 *
 * **判定しても外さない**。印を付けるだけにして、消すかどうかはユーザーが決める
 * (オーナー「さすがに自動だったらこのくらいはユーザーで消せば良いと思います。」)。
 * 機械で外すと「型用バター」のような本物の材料まで消えるおそれがあり、
 * 取り込みで材料が黙って減るほうが実害が大きい。
 */
export function isImportedCookwareName(name: string): boolean {
  const cleaned = normalizeCookwareName(name)
  if (!cleaned) return false
  return COOKWARE_SUFFIXES.some((word) => cleaned.endsWith(word))
}
