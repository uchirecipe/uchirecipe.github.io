/**
 * コピペした文章を「材料」と「手順」に自動で振り分ける（AI不要のパターン認識）。
 * 対応する形式の例:
 *   材料（2人分）           ← 見出しと人数
 *   ・にんじん…1本          ← 中黒＋三点リーダー
 *   にんじん 1本            ← 空白区切り
 *   豚こま切れ肉 200g       ← 数字+単位の分離（200 / g）
 *   作り方                  ← 見出し
 *   1. にんじんを切る       ← 番号付き手順
 *   ①フライパンで炒める     ← 丸数字
 * 結果はフォームに流し込まれ、ユーザーが確認・修正してから保存する。
 */

export interface ParsedIngredient {
  name: string
  amount: string
  unit: string
  /** 単位の後ろの括弧書き(「1枚（250g）」の「250g」)。フォームの材料メモ欄へ */
  memo?: string
}

export interface ParsedRecipe {
  title?: string
  servings?: number
  ingredients: ParsedIngredient[]
  steps: string[]
  /** 「コツ」「ポイント」「メモ」見出し以降の文章。フォームのメモ欄(レシピ全体のメモ)へ */
  memo?: string
}

/** 全角数字・全角英字を半角にする（判定用） */
function normalize(text: string): string {
  return text.replace(/[０-９Ａ-Ｚａ-ｚ／．]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  )
}

const ING_HEADER = /^[【\[（(◆■□●○☆★♪#＊*\s]*(材料|用意するもの|ざいりょう)/
const STEP_HEADER = /^[【\[（(◆■□●○☆★♪#＊*\s]*(作り方|つくり方|作りかた|手順|調理手順|下ごしらえ)/
// コツ・ポイント・メモの見出し。見出し語が実質単独の行(飾り記号は可)か、
// 「コツ: 〜」のようにコロンで内容が続く行だけを見出し扱いする
// (「ポイントは強火で〜」のような手順の文を誤って見出しにしないため)
const MEMO_HEADER =
  /^[【\[（(◆■□●○☆★♪#＊*※\s]*(?:コツ・ポイント|コツ|ポイント|メモ)[】\])）]*\s*(?:[:：]\s*(.*))?$/
const BULLET = /^[・･\-–—*●○◎▪•‣＊※◇]+\s*/
const STEP_NUMBER = /^[（(]?\d{1,2}[）)．.、:：]\s*|^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*|^(step|STEP|Step)\s*\d+[．.:：)）]?\s*/
const SERVINGS = /(\d+(?:[.．]\d+)?)\s*人\s*(?:分|前)/

/**
 * 見出し・番号のない材料欄で、分量の無い行が来たときに手順の文と誤認識しないための判定。
 * 「〜って」「〜んで」のようなて形の中間表現、または代表的な調理動詞の終止形で終わる行は
 * 材料名（「〈タレ〉しょうゆ」等）ではなく手順の文とみなす
 */
const STEP_LIKE_MIDDLE = /って|んで/
const STEP_LIKE_ENDING =
  /(切る|むく|剥く|煮る|焼く|炒める|茹でる|ゆでる|蒸す|揚げる|漬ける|冷ます|混ぜる|加える|入れる|盛る|かける|絞る|こす|裏返す|取り出す|並べる|包む|丸める|こねる|塗る|溶く|溶かす|含める|詰める|する|できる)$/
function looksLikeStepSentence(line: string): boolean {
  return STEP_LIKE_MIDDLE.test(line) || STEP_LIKE_ENDING.test(line)
}

/**
 * 「200g」「大さじ2」「1/2個」「適量」などを 分量+単位 に分ける。
 * 「1枚（250g）」のような単位末尾の括弧書きは memo として分離して返す。
 */
export function splitQuantity(raw: string): { amount: string; unit: string; memo?: string } {
  const text = normalize(raw.trim())
  if (!text) return { amount: '', unit: '' }

  // 「大さじ2」「小さじ1/2」「カップ1」→ 単位が前に来る形
  const pre = text.match(/^(大さじ|小さじ|おおさじ|こさじ|カップ)\s*(\d+(?:\.\d+)?(?:\/\d+)?)$/)
  if (pre) return { amount: pre[2], unit: pre[1] }

  // 「200g」「1本」「1/2個」→ 数字が前に来る形
  const post = text.match(/^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(.*)$/)
  if (post) {
    // 単位の後ろの括弧書き(「1枚（250g）」の「（250g）」)は単位に混ぜず、メモとして分ける
    const paren = post[2].match(/^(.*?)\s*[（(]([^（）()]+)[）)]$/)
    if (paren && paren[1].trim()) {
      return { amount: post[1], unit: paren[1].trim(), memo: paren[2].trim() }
    }
    return { amount: post[1], unit: post[2] }
  }

  // 「適量」「少々」など数字なし → 分量欄にそのまま
  return { amount: raw.trim(), unit: '' }
}

/**
 * 手入力フォームの保存時の救済: 単位欄が空のまま分量欄に「大さじ3」「1/2本」のように
 * 単位ごと書かれていたら、分量と単位に自動で分ける（そのままだと人数変更が効かないため）。
 * 「少々」「適量」など分けられないものは何もしない。単位欄に入力があるときも触らない。
 * 「1枚（250g）」の括弧書きは memo として返す（呼び出し側で材料メモに足す）。
 */
export function autoSplitAmountUnit(
  amount: string,
  unit: string,
): { amount: string; unit: string; memo?: string } {
  const trimmedAmount = amount.trim()
  const trimmedUnit = unit.trim()
  if (trimmedUnit || !trimmedAmount) return { amount: trimmedAmount, unit: trimmedUnit }
  const split = splitQuantity(trimmedAmount)
  if (!split.unit) return { amount: trimmedAmount, unit: '' }
  return split
}

/** 1行を材料として解釈してみる。材料らしくなければ undefined */
function parseIngredientLine(rawLine: string): ParsedIngredient | undefined {
  const line = rawLine.replace(BULLET, '').trim()
  if (!line || line.length > 40) return undefined

  // 区切り文字あり: 「にんじん…1本」「豚肉：200g」「じゃがいも  3個」
  const bySeparator = line.split(/[…‥⋯]+|[：:]|\t+| {2,}|　+/).map((p) => p.trim()).filter(Boolean)
  if (bySeparator.length >= 2) {
    const name = bySeparator[0]
    const quantity = bySeparator.slice(1).join(' ')
    if (name) return { name, ...splitQuantity(quantity) }
  }

  // 半角スペース1つ区切り: 「にんじん 1本」（後半が分量らしいときだけ）
  const bySpace = line.match(/^(.+?)\s+(\S+)$/)
  if (bySpace) {
    const quantity = normalize(bySpace[2])
    if (/^(?:大さじ|小さじ|カップ)?\d|^(適量|少々|お好みで|ひとつまみ)$/.test(quantity)) {
      return { name: bySpace[1].trim(), ...splitQuantity(bySpace[2]) }
    }
  }

  // 「豚肉200g」のように名前と数量がくっついている形
  const glued = normalize(line).match(/^(.+?)(\d+(?:\.\d+)?(?:\/\d+)?\s*(?:g|kg|ml|cc|個|本|枚|袋|缶|玉|株|丁|片|かけ|束|尾|切れ|合|カップ|杯))$/)
  if (glued && glued[1].trim().length >= 1) {
    return { name: glued[1].trim(), ...splitQuantity(glued[2]) }
  }

  return undefined
}

/** 貼り付けた文章全体を解析する */
export function parseRecipeText(text: string): ParsedRecipe {
  const result: ParsedRecipe = { ingredients: [], steps: [] }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let mode: 'auto' | 'ingredients' | 'steps' | 'memo' = 'auto'
  const memoLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine

    // 人数分はどの行にあっても拾う
    if (result.servings === undefined) {
      const servings = normalize(line).match(SERVINGS)
      if (servings) result.servings = Math.max(1, Math.round(Number.parseFloat(servings[1])))
    }

    // 見出し行
    if (ING_HEADER.test(line)) {
      mode = 'ingredients'
      continue
    }
    if (STEP_HEADER.test(line) && line.length <= 15) {
      mode = 'steps'
      continue
    }
    const memoHeader = line.match(MEMO_HEADER)
    if (memoHeader) {
      mode = 'memo'
      // 「コツ: 強火で〜」のように同じ行に内容が続く形も拾う
      const inline = memoHeader[1]?.trim()
      if (inline) memoLines.push(inline)
      continue
    }

    // コツ・ポイント・メモの見出し以降は、手順ではなくメモとして集める
    if (mode === 'memo') {
      const text = line.replace(BULLET, '').trim()
      if (text) memoLines.push(text)
      continue
    }

    // 番号付きの行は手順とみなす
    const normalized = normalize(line)
    if (STEP_NUMBER.test(normalized)) {
      mode = 'steps'
      result.steps.push(normalized.replace(STEP_NUMBER, '').trim())
      continue
    }

    if (mode === 'steps') {
      result.steps.push(line.replace(BULLET, '').trim())
      continue
    }

    // 材料として読めるか試す（見出し前は、分量がはっきりある行だけ材料とみなす）
    const ingredient = parseIngredientLine(line)
    if (ingredient && (mode === 'ingredients' || /\d|適量|少々|お好み|ひとつまみ/.test(ingredient.amount))) {
      result.ingredients.push(ingredient)
      if (mode === 'auto') mode = 'ingredients'
      continue
    }
    if (mode === 'ingredients') {
      const name = line.replace(BULLET, '').trim()
      // 見出し・番号が無いまま手順の文に入っていた場合、材料名と誤認識しないよう切り替える
      if (looksLikeStepSentence(name)) {
        mode = 'steps'
        result.steps.push(name)
        continue
      }
      // 材料欄の中の分量なし行（例: 「〈タレ〉しょうゆ」）は名前だけの材料として拾う
      if (name.length <= 25) {
        result.ingredients.push({ name, amount: '', unit: '' })
        continue
      }
    }

    // まだタイトルが無く、短い行ならタイトルと解釈
    if (!result.title && mode === 'auto' && line.length <= 30) {
      result.title = line.replace(BULLET, '').trim()
      continue
    }

    // それ以外の長い文は手順として扱う
    result.steps.push(line)
  }

  if (memoLines.length > 0) result.memo = memoLines.join('\n')
  return result
}
