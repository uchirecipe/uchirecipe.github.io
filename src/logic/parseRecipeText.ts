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
  /** 「調理時間: 20分」「所要時間 15分」のようなメタ情報行から拾った分数。フォームの調理時間欄へ */
  cookMinutes?: number
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
// 「調理時間: 20分」「調理時間 20分」「所要時間: 15分」のような単独のメタ情報行。
// 行全体がこの形のときだけ一致させる(「調理時間20分を目安に煮る」のような手順の文は対象外)
const COOK_TIME_LINE =
  /^[【\[（(◆■□●○☆★♪#＊*※\s]*(調理時間|所要時間|目安時間|合計時間|準備時間)[】\])）]*\s*[:：]?\s*約?\s*(\d{1,3})\s*分\s*(?:程度|ほど|くらい)?\s*$/

// F1: 「1 鶏むね肉を切る」のような区切り記号なし(数字＋空白のみ)の番号手順。
// STEP_NUMBER は区切り記号(．.、:：等)を必須にしているため拾えず、ここで別パターンとして扱う。
const STEP_NUMBER_SPACE = /^(\d{1,2})[ 　\t]+(.+)$/
// 「1 本」「2 200g」のように番号直後が材料の分量そのものである行を、手順の番号と誤爆させないためのガード
const BARE_UNIT_REST =
  /^(?:g|kg|ml|cc|個|本|枚|袋|缶|玉|株|丁|片|かけ|束|尾|切れ|合|カップ|杯|人分)(?:[（(].*)?$/
function spaceNumberRestIsQuantity(rest: string): boolean {
  if (!rest) return true
  if (/^\d/.test(rest)) return true // G1「1 200g」数字続き=材料
  if (BARE_UNIT_REST.test(rest)) return true // G2「1 本」残りが単位
  if (/^(?:大さじ|小さじ|カップ)\s*\d/.test(rest)) return true // G2'「2 大さじ1」
  if (/^分(?!量)|^(?:時間|秒)/.test(rest)) return true // G3「15 分ほど置く」
  return false
}
// 「1 玉ねぎ 1個」のように、番号の後ろが材料名+分量で終わっている行を
// (見出しなし連番プリスキャンで)手順の連番としてカウントしないためのガード
const INGREDIENT_LIKE_END =
  /(?:\d+(?:\.\d+)?(?:\/\d+)?\s*(?:g|kg|ml|cc|個|本|枚|袋|缶|玉|株|丁|片|かけ|束|尾|切れ|合|カップ|杯)|適量|少々|ひとつまみ|お好みで)$/
/**
 * 見出し・番号記号がないまま「数字＋空白」の連番だけが続く文章(クックパッド等の貼り付けに多い形)を検出する。
 * auto/材料modeのときは、この連番が確認できた場合だけ「数字＋空白」を手順番号として切り替える
 * (単発の「1 本」等を誤って手順にしないための安全策)。
 */
function detectSpaceNumberSequence(lines: string[]): boolean {
  const nums: number[] = []
  for (const l of lines) {
    const m = normalize(l).match(STEP_NUMBER_SPACE)
    if (!m) continue
    const rest = m[2].trim()
    if (spaceNumberRestIsQuantity(rest) || INGREDIENT_LIKE_END.test(rest)) continue
    nums.push(Number(m[1]))
  }
  return nums.some((n, i) => i > 0 && n === nums[i - 1] + 1)
}

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
 * 材料セクション内の「小見出し・装飾行」（分量を持たず材料名でもない行）の判定。
 * 「※タレ」「【タレ】」「(合わせ調味料)」「タレ:」等を材料として取り込まないために使う。
 * 「〈タレ〉しょうゆ」のように括弧の外へ内容が続く行は小見出しではなく材料名として扱う。
 * rawLine は飾り記号(※等)を落とす前の行、name は落とした後の行を渡す
 */
function isIngredientSubheading(rawLine: string, name: string): boolean {
  if (/^※/.test(rawLine.trim())) return true // 「※タレ」
  if (/^[【\[（(〈《].*[】\]）)〉》]$/.test(name)) return true // 全体が括弧で囲まれた行
  if (/^[^:：]{1,12}[:：]$/.test(name)) return true // 「タレ:」のような見出し
  return false
}

/**
 * 「200g」「大さじ2」「1/2個」「適量」「大さじ2〜3」などを 分量+単位 に分ける。
 * 「1枚（250g）」のような単位末尾の括弧書きは memo として分離して返す。
 * F3: 範囲分量(「〜」「~」「～」いずれも受け付ける)は amount を「N〜M」に正規化して保持する
 * (人数スケールには非対応。unit だけ分離できれば十分という裁定)。
 */
export function splitQuantity(raw: string): { amount: string; unit: string; memo?: string } {
  const text = normalize(raw.trim())
  if (!text) return { amount: '', unit: '' }
  // 範囲(「〜」「~」「～」いずれも受ける)の出力は「N〜M」に正規化し、前後の空白は除く
  const normalizeRangeAmount = (s: string) => s.replace(/\s*[〜~～]\s*/, '〜')

  // 「大さじ2」「小さじ1/2」「カップ1」「大さじ2〜3」→ 単位が前に来る形
  const pre = text.match(
    /^(大さじ|小さじ|おおさじ|こさじ|カップ)\s*(\d+(?:\.\d+)?(?:\/\d+)?(?:\s*[〜~～]\s*\d+(?:\.\d+)?(?:\/\d+)?)?)$/,
  )
  if (pre) return { amount: normalizeRangeAmount(pre[2]), unit: pre[1] }

  // 「200g」「1本」「1/2個」「2〜3個」→ 数字が前に来る形
  const post = text.match(
    /^(\d+(?:\.\d+)?(?:\/\d+)?(?:\s*[〜~～]\s*\d+(?:\.\d+)?(?:\/\d+)?)?)\s*(.*)$/,
  )
  if (post) {
    const amount = normalizeRangeAmount(post[1])
    // 単位の後ろの括弧書き(「1枚（250g）」の「（250g）」)は単位に混ぜず、メモとして分ける
    const paren = post[2].match(/^(.*?)\s*[（(]([^（）()]+)[）)]$/)
    if (paren && paren[1].trim()) {
      return { amount, unit: paren[1].trim(), memo: paren[2].trim() }
    }
    return { amount, unit: post[2] }
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
  // F1: 見出し・区切り記号が無いまま「数字＋空白」の連番だけが続く文章かどうかを先読みしておく
  // (auto/材料modeで数字+空白を手順番号として切り替えてよいかの判定に使う)
  const spaceNumberSeq = detectSpaceNumberSequence(lines)

  let mode: 'auto' | 'ingredients' | 'steps' | 'memo' = 'auto'
  const memoLines: string[] = []

  for (const rawLine of lines) {
    const line = rawLine

    // 人数分はどの行にあっても拾う
    if (result.servings === undefined) {
      const servings = normalize(line).match(SERVINGS)
      if (servings) result.servings = Math.max(1, Math.round(Number.parseFloat(servings[1])))
    }

    // 「調理時間: 20分」のような単独のメタ情報行は、材料・手順に入れずcookMinutesとして拾う
    // (準備時間は調理時間と混同しないよう、値は採用せず行だけ読み飛ばす)
    const timeLine = normalize(line).replace(BULLET, '').match(COOK_TIME_LINE)
    if (timeLine) {
      if (result.cookMinutes === undefined && timeLine[1] !== '準備時間') {
        result.cookMinutes = Number.parseInt(timeLine[2], 10)
      }
      continue
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

    // F1: 区切り記号のない「数字＋空白」の番号手順(クックパッド等の最頻出形式)。
    // steps mode中はガードG1〜G3を通れば常に剥がす。auto/材料modeは連番プリスキャンで
    // 検出できたときだけ切り替える(単発の「1 本」のような分量行を誤って手順にしないため)。
    // 既知の制限: ①「2 3cm幅に切る」のように番号直後が数字始まりの手順文は番号が残る(G1とのトレードオフ)
    // ②連番材料「1 玉ねぎ 1個」はname欄に「1 」が残る(超少数派のため未対応)
    const spaceNum = normalized.match(STEP_NUMBER_SPACE)
    if (spaceNum) {
      const rest = spaceNum[2].trim()
      if (
        !spaceNumberRestIsQuantity(rest) &&
        (mode === 'steps' || (spaceNumberSeq && !INGREDIENT_LIKE_END.test(rest)))
      ) {
        mode = 'steps'
        result.steps.push(rest)
        continue
      }
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
      // 「※タレ」「【タレ】」「(合わせ調味料)」のような小見出し・装飾行は取り込まない
      if (isIngredientSubheading(line, name)) continue
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

export function looksPoorlyParsed(input: string, parsed: ParsedRecipe): boolean {
  return parsed.ingredients.length === 0 && parsed.steps.length <= 1 && input.trim().length >= 60
}
