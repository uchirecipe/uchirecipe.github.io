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
// M6: 「! ポイント」のような感嘆符付き装飾もコツ・ポイント見出しとして扱う
const MEMO_HEADER =
  /^[【\[（(◆■□●○☆★♪#＊*※!！\s]*(?:コツ・ポイント|コツ|ポイント|メモ)[】\])）]*\s*(?:[:：]\s*(.*))?$/
const BULLET = /^[・･\-–—*●○◎▪•‣＊※◇☆★]+\s*/
const STEP_NUMBER = /^[（(]?\d{1,2}[）)．.、:：]\s*|^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*|^(step|STEP|Step)\s*\d+[．.:：)）]?\s*/
// M4: 「2.を3cm…」「（1）のフライパン…」のように番号直後が格助詞で始まる行は、
// 前の手順への参照であって新しい番号手順ではない。番号を剥がさず行全体を手順として扱うためのガード
const STEP_NUMBER_REF_GUARD = /^[（(]?\d{1,2}\s*[）)．.、:：]\s*(?:を|と|の|へ|は|が)/
const SERVINGS = /(\d+(?:[.．]\d+)?)\s*人\s*(?:分|前)/
// M2: 「3人分」「(2人分)」「3〜4人分」のように行全体が人数だけの行(材料/手順に混入させず読み飛ばす)
const SERVINGS_ONLY_LINE =
  /^[（(【\[]?\s*約?\d+(?:[.．]\d+)?(?:\s*[〜~～]\s*\d+(?:[.．]\d+)?)?\s*人\s*(?:分|前)\s*[】\])）]?$/
// 「調理時間: 20分」「調理時間 20分」「所要時間: 15分」のような単独のメタ情報行。
// 行全体がこの形のときだけ一致させる(「調理時間20分を目安に煮る」のような手順の文は対象外)
// M5: 区切りに「/」「／」も追加(「調理時間 ／20分」)
const COOK_TIME_LINE =
  /^[【\[（(◆■□●○☆★♪#＊*※\s]*(調理時間|所要時間|目安時間|合計時間|準備時間)[】\])）]*\s*[:：/／]?\s*約?\s*(\d{1,3})\s*分\s*(?:程度|ほど|くらい)?\s*$/

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

// M3(a): 「（A）ソース」のように短い英数字ラベル+短い補足語で終わる行
const PAREN_LABEL_SUBHEADING = /^[（(][A-Za-zＡ-Ｚａ-ｚ0-9０-９]{1,2}[）)][^0-9０-９]{1,8}$/
// M3(b): グループ語そのものだけの行(BULLET剥落後・☆調味料等に対応)
const INGREDIENT_GROUP_WORD =
  /^(トッピング|下味|衣|タレ|ソース|合わせ調味料|薬味|付け合わせ|飾り用?|仕上げ用?|具材?|調味料|スープ|あん|生地)$/
// M3(c)/F9: 「＊」「※」「*」始まりの注記行、および「【トッピング野菜】＊好みの野菜でよい。」のような
// 括弧見出し+直後に＊※*が続く複合行
const NOTE_PREFIX_SUBHEADING = /^[※＊*]/
const BRACKET_NOTE_COMPOUND_SUBHEADING = /^[【\[〈《（(].{1,14}[】\]〉》）)]\s*[＊※*]/

/**
 * 材料セクション内の「小見出し・装飾行」（分量を持たず材料名でもない行）の判定。
 * 「※タレ」「【タレ】」「(合わせ調味料)」「タレ:」等を材料として取り込まないために使う。
 * 「〈タレ〉しょうゆ」のように括弧の外へ内容が続く行は小見出しではなく材料名として扱う。
 * rawLine は飾り記号(※等)を落とす前の行、name は落とした後の行を渡す
 */
function isIngredientSubheading(rawLine: string, name: string): boolean {
  const trimmedRaw = rawLine.trim()
  if (NOTE_PREFIX_SUBHEADING.test(trimmedRaw)) return true // F9:「※タレ」「＊あれば〜」
  if (BRACKET_NOTE_COMPOUND_SUBHEADING.test(trimmedRaw)) return true // M3(c):「【トッピング野菜】＊好みの野菜でよい。」
  if (/^[【\[（(〈《].*[】\]）)〉》]$/.test(name)) return true // 全体が括弧で囲まれた行
  if (/^[^:：]{1,12}[:：]$/.test(name)) return true // 「タレ:」のような見出し
  if (PAREN_LABEL_SUBHEADING.test(name)) return true // M3(a):「（A）ソース」
  if (INGREDIENT_GROUP_WORD.test(name)) return true // M3(b):「トッピング」「☆調味料」等
  return false
}

// 「大さじ1と1/2」「大さじ1・1/2」のような帯分数(整数+と/・+分数)を小数(1.5)に畳む。
// URL取り込み(実サイトのrecipeIngredient)で「と」「・」のどちらの接続も実測されており
// (オレンジページ・DELISH KITCHEN・macaroniは「と」、ハウス食品は「・」)、素の数字パターンしか
// 認識しない下の pre/post 正規表現だけでは丸ごと解釈不能になり単位が分離できなくなるための前処理。
function collapseMixedFraction(text: string): string {
  return text.replace(/(\d+)(?:と|・)(\d+)\/(\d+)/g, (match, whole: string, num: string, den: string) => {
    const denominator = Number.parseInt(den, 10)
    if (!denominator) return match
    const value = Number.parseInt(whole, 10) + Number.parseInt(num, 10) / denominator
    return String(Math.round(value * 1000) / 1000)
  })
}

/**
 * 「200g」「大さじ2」「1/2個」「適量」「大さじ2〜3」などを 分量+単位 に分ける。
 * 「1枚（250g）」のような単位末尾の括弧書きは memo として分離して返す。
 * F3: 範囲分量(「〜」「~」「～」いずれも受け付ける)は amount を「N〜M」に正規化して保持する
 * (人数スケールには非対応。unit だけ分離できれば十分という裁定)。
 */
export function splitQuantity(raw: string): { amount: string; unit: string; memo?: string } {
  const text = collapseMixedFraction(normalize(raw.trim()))
  if (!text) return { amount: '', unit: '' }
  // 範囲(「〜」「~」「～」いずれも受ける)の出力は「N〜M」に正規化し、前後の空白は除く
  const normalizeRangeAmount = (s: string) => s.replace(/\s*[〜~～]\s*/, '〜')

  // 「大さじ2」「小さじ1/2」「カップ1」「大さじ2〜3」→ 単位が前に来る形。
  // 末尾の「杯」(「大さじ2杯」macaroni実測)は数量に対する冗長な助数詞なので、あれば読み捨てる
  const pre = text.match(
    /^(大さじ|小さじ|おおさじ|こさじ|カップ)\s*(\d+(?:\.\d+)?(?:\/\d+)?(?:\s*[〜~～]\s*\d+(?:\.\d+)?(?:\/\d+)?)?)杯?$/,
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

  // M8/F8(1): 「みりん大さじ2」のように単位が前置でくっついている形
  const gluedPreUnit = normalize(line).match(
    /^(.+?)((?:大さじ|小さじ|おおさじ|こさじ|カップ)\s*\d+(?:\.\d+)?(?:\/\d+)?(?:\s*[〜~～]\s*\d+(?:\.\d+)?(?:\/\d+)?)?)$/,
  )
  if (gluedPreUnit && gluedPreUnit[1].trim().length >= 1) {
    return { name: gluedPreUnit[1].trim(), ...splitQuantity(gluedPreUnit[2]) }
  }

  // 「豚肉200g」「そうめん4ワ（200g）」のように名前と数量がくっついている形
  // M8/F8(2): 単位にコ|ワ|房|柵|節を追加・末尾「分」(コ分/枚分/本分)・数量範囲・
  // 末尾の括弧書き(memo)を許容する。名前中の丸括弧注記(「（薄切り）」等)は剥がさない
  const glued = normalize(line).match(
    /^(.+?)(\d+(?:\.\d+)?(?:\/\d+)?(?:\s*[〜~～]\s*\d+(?:\.\d+)?(?:\/\d+)?)?\s*(?:g|kg|ml|cc|個|本|枚|袋|缶|玉|株|丁|片|かけ|束|尾|切れ|合|カップ|杯|コ|ワ|房|柵|節)(?:分)?)(?:[（(]([^（）()]*)[）)])?$/,
  )
  if (glued && glued[1].trim().length >= 1) {
    const split = splitQuantity(glued[2])
    const memo = glued[3]?.trim() || split.memo
    return { name: glued[1].trim(), amount: split.amount, unit: split.unit, ...(memo ? { memo } : {}) }
  }

  return undefined
}

// ============================================================================
// 第2弾(docs/29 P7 Fable裁定 §0〜§9): 実サイトの貼り付け形式に既存パーサーを翻訳する前処理。
// preprocessPastedLines(text) は4パスの純関数連結。既存の逐次ループの判定順序・
// 既存regexの意味は変えず、「既存パーサーの得意な形」に行を並べ替えるだけ。
// ============================================================================

type Region = 'pre' | 'ing' | 'steps' | 'memo'

// H-1(Fable裁定・貼り付けパーサー回帰再発防止): 「材料をすべて鍋に入れて炒める」のような
// 手順文の冒頭がING_HEADERに部分一致し、classifyHeaderが材料見出しと誤認する事故を防ぐガード。
// STEP_HEADER側は既に「≤15字」の長さ制約があるため対象外(Fable裁定・現状維持)。
// ING_HEADERは長さ制約が無いので、classifyHeader内でING判定するときだけ次の2条件で除外する:
// (a) 行が長すぎる(>15字)、(b) 見出し語の直後が助詞(を/は/が/も/に/で)で始まる
// (見出し語のすぐ後ろに助詞が続くなら、それは見出しではなく文の一部)。
const ING_HEADER_FOLLOWED_BY_PARTICLE =
  /^[【\[（(◆■□●○☆★♪#＊*\s]*(?:材料|用意するもの|ざいりょう)[をはがもにで]/
function isIngHeaderLine(line: string): boolean {
  return ING_HEADER.test(line) && line.length <= 15 && !ING_HEADER_FOLLOWED_BY_PARTICLE.test(line)
}

/** 見出し行かどうか(既存のING_HEADER/STEP_HEADER/MEMO_HEADERで判定)。ヘッダー行自身の領域分類には使わない共通ヘルパー */
function classifyHeader(line: string): Region | null {
  if (!line) return null
  if (isIngHeaderLine(line)) return 'ing'
  if (STEP_HEADER.test(line) && line.length <= 15) return 'steps'
  if (MEMO_HEADER.test(line)) return 'memo'
  return null
}

/** 各行が「その行に到達した時点で属している領域」を返す(見出し行自身は切替前の領域のまま) */
function computeRegions(lines: string[]): Region[] {
  const regions: Region[] = []
  let region: Region = 'pre'
  for (const line of lines) {
    regions.push(region)
    if (line === '') continue
    const header = classifyHeader(line)
    if (header) region = header
  }
  return regions
}

function hasIngOrStepHeader(lines: string[]): boolean {
  return lines.some((l) => {
    const h = classifyHeader(l)
    return h === 'ing' || h === 'steps'
  })
}

// ---- §2 F6: 単独番号行の結合 ----
const SOLO_STEP_NUM = /^[（(]?(\d{1,2})[）)．.、:：]?$/
const SOLO_MARU = /^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳❶❷❸❹❺❻❼❽❾❿]$/
const SOLO_STEP_WORD = /^(?:STEP|Step|step)\s*(\d{1,2})$/
const MARU_VALUES: Record<string, number> = {}
;['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'].forEach(
  (ch, idx) => {
    MARU_VALUES[ch] = idx + 1
  },
)
;['❶', '❷', '❸', '❹', '❺', '❻', '❼', '❽', '❾', '❿'].forEach((ch, idx) => {
  MARU_VALUES[ch] = idx + 1
})

/** steps領域で「単独番号行」を無条件マーカーとして数値化する(①②や STEP1 も含む) */
function soloMarkerNumber(line: string): number | null {
  const n = normalize(line).trim()
  const solo = n.match(SOLO_STEP_NUM)
  if (solo) return Number(solo[1])
  if (SOLO_MARU.test(n)) return MARU_VALUES[n] ?? null
  const word = n.match(SOLO_STEP_WORD)
  if (word) return Number(word[1])
  return null
}

/** pre/ing領域では数字のみの単独行(丸数字・STEP語は対象外)だけをラン判定の対象にする */
function soloNumericMarker(line: string): number | null {
  const m = normalize(line).trim().match(SOLO_STEP_NUM)
  return m ? Number(m[1]) : null
}

/** pre/ing領域に「1」から始まる昇順の連番(単独番号行)が実在するか(P3材料欄の単発「2」等を誤爆させないため) */
function detectSoloNumberSequence(lines: string[], regions: Region[]): boolean {
  const nums: number[] = []
  for (let i = 0; i < lines.length; i++) {
    if (regions[i] !== 'pre' && regions[i] !== 'ing') continue
    const v = soloNumericMarker(lines[i])
    if (v !== null) nums.push(v)
  }
  return nums.some((n, i) => n === 1 && i + 1 < nums.length && nums[i + 1] === 2)
}

/** M4: 番号+格助詞始まり(手順参照)を除いた、既存STEP_NUMBERへの一致(Pass3の境界検出にも使う) */
function isStepNumberBoundaryLine(line: string): boolean {
  const n = normalize(line)
  return STEP_NUMBER.test(n) && !STEP_NUMBER_REF_GUARD.test(n)
}

/**
 * Pass3: 「1」(改行)「フライパンに油を…」のような単独番号行を「1. フライパンに油を…」に書き換え、
 * 既存のSTEP_NUMBER経路(既存の逐次ループ)にそのまま食わせる。番号行自体は捨てる。
 * steps領域では単独番号行を無条件マーカーとする(連番不要・欠番OK)。
 * pre/ing領域では「1」始まりの連番ランに属す数字のみマーカーとする(P3材料欄の単発「2」は非マーカー)。
 */
function pass3(lines: string[]): string[] {
  const regions = computeRegions(lines)
  const soloSeq = detectSoloNumberSequence(lines, regions)
  const markerAt = (idx: number): number | null => {
    const region = regions[idx]
    if (region === 'steps') return soloMarkerNumber(lines[idx])
    if ((region === 'pre' || region === 'ing') && soloSeq) return soloNumericMarker(lines[idx])
    return null
  }

  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line === '') {
      out.push(line)
      i++
      continue
    }
    const marker = markerAt(i)
    if (marker === null) {
      out.push(line)
      i++
      continue
    }
    // マーカー行を破棄し、続く行を次マーカー/空行/見出し/STEP_NUMBER行まで区切りなしで連結する
    let j = i + 1
    const bodyParts: string[] = []
    while (j < lines.length) {
      const bl = lines[j]
      if (bl === '') break
      if (classifyHeader(bl)) break
      if (markerAt(j) !== null) break
      if (isStepNumberBoundaryLine(bl)) break
      bodyParts.push(bl)
      j++
    }
    const body = bodyParts.join('')
    if (body) out.push(`${marker}. ${body}`)
    i = j
  }
  return out
}

/**
 * Pass2(F10): steps領域内で本文の途中に挟まる「コツ」「ポイント」等のラベル行(単独)を検出し、
 * 後にまだ番号手順が続く時だけ、ラベル+直後の内容を退避して前処理の最後に「コツ・ポイント」+
 * 退避行として末尾移送する。後続に手順が無ければ何もしない(既存の末尾コツ処理に任せる)。
 */
function pass2(lines: string[]): string[] {
  const regions = computeRegions(lines)
  const out: string[] = []
  const rescued: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line !== '' && regions[i] === 'steps' && MEMO_HEADER.test(line)) {
      let j = i + 1
      const bodyParts: string[] = []
      while (j < lines.length) {
        const bl = lines[j]
        if (bl === '') break
        if (classifyHeader(bl)) break
        if (soloMarkerNumber(bl) !== null) break
        if (isStepNumberBoundaryLine(bl)) break
        bodyParts.push(bl)
        j++
      }
      let k = j
      while (k < lines.length && lines[k] === '') k++
      const moreStepsFollow =
        k < lines.length &&
        !classifyHeader(lines[k]) &&
        (soloMarkerNumber(lines[k]) !== null || isStepNumberBoundaryLine(lines[k]))
      if (moreStepsFollow && bodyParts.length > 0) {
        rescued.push(...bodyParts)
        i = j
        continue
      }
    }
    out.push(line)
    i++
  }
  if (rescued.length > 0) {
    out.push('コツ・ポイント')
    out.push(...rescued)
  }
  return out
}

// ---- §1 F5: 名前行+分量行ペアリング ----
const AMOUNT_ONLY_EXACT = /^(適量|少々|適宜|少量|ひとつまみ|ふたつまみ|お好みで?|お好みの量|好みで)$/
const AMOUNT_EACH = /^各[、,]?\s*\S{1,8}$/
const AMOUNT_PRE_UNIT = /^(大さじ|小さじ|おおさじ|こさじ|カップ)\s*\d/
const AMOUNT_SIZE_PREFIX = /^[大中小]\s*\d/
const AMOUNT_COMBINED = /^合わせて\s*\d/
const AMOUNT_NUMBER_GENERIC =
  /^約?\d{1,4}(?:[./]\d{1,3})?(?:\s*[〜~～]\s*\d{1,4}(?:[./]\d{1,3})?)?\s*\S{0,5}(?:くらい|ぐらい|ほど|程度)?(?:[（(][^（）()]{1,12}[）)])?$/

function isAmountLine(raw: string): boolean {
  const t = normalize(raw).trim()
  if (!t || t.length > 15) return false
  if (AMOUNT_ONLY_EXACT.test(t)) return true
  if (AMOUNT_EACH.test(t)) return true
  if (AMOUNT_PRE_UNIT.test(t)) return true
  if (AMOUNT_SIZE_PREFIX.test(t)) return true
  if (AMOUNT_COMBINED.test(t)) return true
  if (AMOUNT_NUMBER_GENERIC.test(t)) return true
  return false
}

function isNameCandidate(raw: string): boolean {
  const s = raw.replace(BULLET, '').trim()
  if (!s || s.length > 25) return false
  if (isAmountLine(raw)) return false
  if (classifyHeader(raw)) return false
  if (isIngredientSubheading(raw, s)) return false
  if (looksLikeStepSentence(s)) return false
  const p = parseIngredientLine(raw)
  if (p && /\d|適量|少々|適宜|お好み|ひとつまみ/.test(p.amount + p.unit)) return false
  return true
}

/**
 * Pass4(F5): ing領域(材料見出しが無い入力では一切しない)で、名前行の直後に分量行が来たら
 * 「名前\t分量」に書き換え、既存parseIngredientLineのタブ区切り経路に流す。
 * 名前とペアにならない孤児の分量行(クラシルの「分量の調整」直後の単独「2」等)は捨てる。
 */
function pass4(lines: string[]): string[] {
  const regions = computeRegions(lines)
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // 「3人分」等の人数専用行はM2(mainループ)に処理を譲る(F5の名前/分量ペアリング対象にしない)
    if (line === '' || regions[i] !== 'ing' || SERVINGS_ONLY_LINE.test(normalize(line).trim())) {
      out.push(line)
      i++
      continue
    }
    const next = lines[i + 1]
    const nextIsAmount =
      next !== undefined &&
      next !== '' &&
      isAmountLine(next) &&
      !SERVINGS_ONLY_LINE.test(normalize(next).trim())
    if (isNameCandidate(line) && nextIsAmount) {
      out.push(`${line}\t${next}`)
      i += 2
      continue
    }
    if (isAmountLine(line)) {
      // 孤児の分量行(名前と結びつかない)は捨てる
      i++
      continue
    }
    out.push(line)
    i++
  }
  return out
}

// ---- §3 F7: ゴミ除去(固定リスト+動的regex+冒頭領域の一般規則) ----
const EXACT_GOMI = new Set([
  '共有', '印刷', '印刷する', '保存', '保存する', 'シェア', 'ポスト', 'ツイート', 'いいね', '広告',
  '人前', '人分', '料理モード', 'クックモード', '登録済一覧', '分量の調整', 'つくれぽ', '話題入り', '殿堂入り',
  'Facebook', 'Twitter', 'X', 'LINE', 'Instagram', 'Pinterest', 'はてブ', 'リンクをコピー',
  'ログイン', '会員登録', '新規登録', 'レシピを書く', 'レシピを保存', '買い物リスト', '買い物リストに入れる', '材料コピー',
  'お気に入り', 'お気に入りに追加', '動画を見る', '関連レシピ', '関連キーワード', '詳細検索', 'もっと見る', '続きを読む',
  '講師', '調理', '簡単！', '簡単!', 'おすすめの献立', '画面が暗くなりません', 'Play Video',
])
const PREFIX_GOMI = [
  'はじめてのつくれぽ', 'つくれぽを', 'みんなのつくれぽ', 'マイレシピ登録', 'マイフォルダ', 'クリップ', 'このレシピの',
  '作者:', '出典', '引用元', 'スポンサー', '関連記事', 'あなたにおすすめ', 'おすすめレシピ', 'レビュー', '質問を見る',
  '作り方を動画で', '料理を安全に', '安全に調理', '料理を楽しむにあたって', '印刷するレシピ', 'つくったコメント',
  '1人分あたり', '栄養成分', '栄養情報',
]
const HASHTAG_LINE = /^[#＃]\S/
const HEADER_WORDS_IN_LINE = /(材料|作り方|つくり方|手順|コツ|ポイント|メモ)/
const AUTHOR_HANDLE_LINE = /^.{0,20}@[A-Za-z0-9_.]{3,}$/
const PHOTO_CAPTION_LINE = /^.{0,30}(?:作り方|材料)\s*\d{0,3}\s*写真$/
const STEP_CAPTION_LINE = /^調理\s*ステップ\s*\d{1,2}$/
const MINUTES_DISH_LINE = /^\d{1,3}分料理[！!]?$/
const AUTHOR_RECIPE_LIST_LINE = /^.{1,15}さんのレシピ(?:一覧)?$/
const SERVING_ADJUST_LINE = /^人数に合わせて.{0,12}調整/
const MY_RECIPE_REGISTER_LINE = /^(?:マイレシピ登録|お気に入り登録|クリップ)(?:する)?[（(]?\d*[）)]?.{0,6}$/
const PHOTOGRAPHER_LINE = /^撮影[\s　／/:：]/
const UPDATED_DATE_LINE = /^更新日[\s:：]/
// 行全体がURLだけの行（レシピサイトからの貼り付けに混ざるリンク、本アプリの共有テキスト末尾の
// 入口URL「https://uchirecipe.com/」など）。手順・材料のどれでもないので落とす。
// これにより「テキストで共有」した文章を別端末に貼り付けても、末尾のアプリ入口URLが手順に化けない
const URL_ONLY_LINE = /^https?:\/\/\S+$/
const REGEX_GOMI = [
  AUTHOR_HANDLE_LINE,
  PHOTO_CAPTION_LINE,
  STEP_CAPTION_LINE,
  MINUTES_DISH_LINE,
  AUTHOR_RECIPE_LIST_LINE,
  SERVING_ADJUST_LINE,
  MY_RECIPE_REGISTER_LINE,
  PHOTOGRAPHER_LINE,
  UPDATED_DATE_LINE,
  URL_ONLY_LINE,
]

function isHashtagGomi(line: string): boolean {
  const t = line.trim()
  return HASHTAG_LINE.test(t) && !HEADER_WORDS_IN_LINE.test(t)
}
function isExactGomi(line: string): boolean {
  return EXACT_GOMI.has(line.trim())
}
function isPrefixGomi(line: string): boolean {
  const t = line.trim()
  return PREFIX_GOMI.some((p) => t.startsWith(p))
}
// M-4(Fable裁定・再発防止): SERVING_ADJUST_LINE(「人数に合わせて量を調整してください」型)は
// memo領域(コツ・ポイント見出し以降)では正当なコツ・メモ文である可能性があるため削除しない。
// 他のEXACT/PREFIX/REGEXゴミ判定は現状維持(領域を問わず常に有効)。
function isRegexGomi(line: string, region: Region): boolean {
  const t = line.trim()
  return REGEX_GOMI.some((re) => {
    if (re === SERVING_ADJUST_LINE && region === 'memo') return false
    return re.test(t)
  })
}

// META_LABELS: ラベル+値ペア(次行または同一行)の除去
const META_LABEL_WORDS = [
  'エネルギー', 'カロリー', '熱量', '塩分', '食塩相当量', 'たんぱく質', 'タンパク質', '脂質', '糖質',
  '炭水化物', '食物繊維', '費用目安', 'コレステロール',
]
const META_LABEL_ALT = META_LABEL_WORDS.join('|')
const META_LABEL_ONLY_LINE = new RegExp(`^(?:${META_LABEL_ALT})$`)
const META_INLINE_LINE = new RegExp(`^(?:${META_LABEL_ALT})[\\s　]*[／/:：]`)
const META_VALUE_LINE = /^約?[\d.]+\s*(?:kcal|kJ|g|mg|円|%)$/i

// 時間ラベルは捨てず併合する(調理時間/所要時間/目安時間/合計時間/準備時間 単独行+次行「約?N分」)
const TIME_LABEL_WORDS = ['調理時間', '所要時間', '目安時間', '合計時間', '準備時間']
const TIME_LABEL_ONLY_LINE = new RegExp(`^(?:${TIME_LABEL_WORDS.join('|')})$`)
const TIME_VALUE_LINE = /^約?\d{1,3}分$/

// REWRITE: 捨てず書き換える行
const ONE_POINT_ADVICE_LINE = /^(?:料理上手のワンポイント|ワンポイント(?:アドバイス)?|アドバイス)$/
// F12: 「調理時間50分カロリー297kcal…」のような調理時間メタくっつき行→「調理時間 50分」に書き換え
const COOK_TIME_GLUED_META = /^(調理時間|所要時間|目安時間|合計時間|準備時間)(\d{1,3})分\S/
function rewriteCookTimeGluedMeta(line: string): string | null {
  const m = normalize(line).match(COOK_TIME_GLUED_META)
  if (!m) return null
  return `${m[1]} ${m[2]}分`
}

/**
 * Pass1: ゴミ除去・メタ併合(F7/F9/F11/F12)。
 * ING_HEADER/STEP_HEADERが本文のどこかに存在する時だけ、pre領域は
 * 「タイトル候補(最初の1行)/人数行/COOK_TIME_LINE/MEMO_HEADER」以外を全て捨てる(3-1)。
 * 見出しが無い入力ではこの一般規則は発動せず、既存挙動を維持する。
 * EXACT/PREFIX/REGEX/METAのゴミ判定はing/steps領域でも安全なもの(行全体一致・前方一致のみ)で、
 * 領域に関わらず常に有効(3-2)。
 */
function pass1(lines: string[]): string[] {
  const hasHeader = hasIngOrStepHeader(lines)
  const out: string[] = []
  let region: Region = 'pre'
  let titleAssigned = false
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    if (raw === '') {
      out.push(raw)
      i++
      continue
    }

    // REWRITE(書き換え)は判定より先に行う
    let line = raw
    const gluedMeta = rewriteCookTimeGluedMeta(line)
    if (gluedMeta) line = gluedMeta
    if (ONE_POINT_ADVICE_LINE.test(normalize(line).trim())) line = 'コツ・ポイント'

    // 見出し行(材料/作り方/コツ・ポイント等)は常に素通りさせる
    const header = classifyHeader(line)
    if (header) {
      out.push(line)
      region = header
      i++
      continue
    }

    // 必須ガード: pre領域の「＊」「※」始まり行は、キープ判定より先に(見出しが存在する入力でのみ)捨てる
    // (「＊1人分」のようなカロリー等の脚注をservingsとして誤取得しないため)
    if (region === 'pre' && hasHeader && /^[＊※*]/.test(normalize(line).trim())) {
      i++
      continue
    }

    // META_LABELS: ラベル単独行(+次行が値なら2行とも/値が無くてもラベル単独は捨てる)
    if (META_LABEL_ONLY_LINE.test(normalize(line).trim())) {
      const next = lines[i + 1]
      if (next !== undefined && META_VALUE_LINE.test(normalize(next).trim())) {
        i += 2
        continue
      }
      i++
      continue
    }
    // META_LABELS: 同一行「ラベル／値」形式
    if (META_INLINE_LINE.test(normalize(line).trim())) {
      i++
      continue
    }

    // 時間ラベルは捨てず併合(「調理時間」+「20分」→「調理時間 20分」)
    if (TIME_LABEL_ONLY_LINE.test(normalize(line).trim())) {
      const next = lines[i + 1]
      if (next !== undefined && TIME_VALUE_LINE.test(normalize(next).trim())) {
        out.push(`${line.trim()} ${normalize(next).trim()}`)
        i += 2
        continue
      }
    }

    // 固定ゴミリスト(EXACT/PREFIX)・動的regex(ハッシュタグ・@作者・写真キャプション等)
    if (isExactGomi(line) || isPrefixGomi(line) || isHashtagGomi(line) || isRegexGomi(line, region)) {
      i++
      continue
    }

    // 冒頭一般規則(3-1): 見出しが存在する入力のpre領域だけ、次のカテゴリ以外を全て捨てる
    if (region === 'pre' && hasHeader) {
      const n = normalize(line).trim()
      if (SERVINGS_ONLY_LINE.test(n)) {
        out.push(line)
        i++
        continue
      }
      if (COOK_TIME_LINE.test(normalize(line).replace(BULLET, ''))) {
        out.push(line)
        i++
        continue
      }
      if (!titleAssigned && line.trim().length <= 30) {
        out.push(line)
        titleAssigned = true
        i++
        continue
      }
      i++
      continue
    }

    // ing/steps/memo領域、または見出しが無い入力のpre領域はそのまま残す
    out.push(line)
    i++
  }
  return out
}

/**
 * 貼り付けた文章を、既存の逐次パーサーが得意な形に翻訳する前処理(§0)。
 * Pass1(ゴミ除去・メタ併合) → Pass2(インラインポイント末尾移送) →
 * Pass3(単独番号行→「N. 本文」) → Pass4(名前行+分量行→「名前\t分量」) の順で適用する。
 * 空行はパス間の境界判定に使い、返却時に取り除く。
 */
export function preprocessPastedLines(text: string): string[] {
  let lines: string[] = text.split(/\r?\n/).map((line) => line.trim())
  lines = pass1(lines)
  lines = pass2(lines)
  lines = pass3(lines)
  lines = pass4(lines)
  return lines.filter((line) => line !== '')
}

/** 貼り付けた文章全体を解析する */
export function parseRecipeText(text: string): ParsedRecipe {
  const result: ParsedRecipe = { ingredients: [], steps: [] }
  const lines = preprocessPastedLines(text)
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
    // M2: 「3人分」「(2人分)」「3〜4人分」のように行全体が人数だけの行は、材料・手順に混ざらないよう読み飛ばす
    if (SERVINGS_ONLY_LINE.test(normalize(line))) continue

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
    // M4: 「2.を3cm…」「（1）のフライパン…」のように番号直後が格助詞(を/と/の/へ/は/が)で
    // 始まる行は、前の手順への参照であって新しい番号ではない。番号を剥がさず行全体を手順にする
    const normalized = normalize(line)
    if (STEP_NUMBER.test(normalized) && !STEP_NUMBER_REF_GUARD.test(normalized)) {
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
    // M7: 「〇〇　レシピ・作り方」のようなサイトの末尾定型句を取り除く(空になれば元のまま)
    if (!result.title && mode === 'auto' && line.length <= 30) {
      const stripped = line.replace(BULLET, '').trim()
      const cleaned = stripped
        .replace(/[\s　]*(?:の)?(?:レシピ[・･]?)?(?:作り方|つくり方)$/, '')
        // 末尾「レシピ」は空白区切りがある時だけ剥がす(「〇〇 レシピ」のサイト接尾辞)。
        // 空白なしの連結(「試験用レシピ」等、料理名の一部として「レシピ」で終わる名前)は
        // 剥がさない(2026-07-16 SMK-02回帰: 便Iの`[\s　]*`が語末レシピを過剰除去していた)
        .replace(/[\s　]+レシピ$/, '')
        .trim()
      result.title = cleaned || stripped
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
