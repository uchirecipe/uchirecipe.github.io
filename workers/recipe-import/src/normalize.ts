/**
 * schema.org/Recipe の JSON-LD を HTML から抽出し、うちレシピの取り込み用に正規化する。
 * Cloudflare Worker(index.ts)からも、app側のテスト(scripts/test-logic.mjs)からも
 * 同じロジックをそのまま使えるよう、DOM・Workers固有API・Node APIに依存しない純TSモジュールにする。
 *
 * 検証(docs/39_URL取り込み検証.md)で確認した実世界のばらつきに対応する:
 * - JSON-LDは <script type="application/ld+json"> が複数あり、@graph・配列・単体のいずれもありうる
 * - @type が配列("Recipe"を含む)のケースがある
 * - JSON-LD内に生の制御文字(改行等)が混入し素朴なJSON.parseが失敗するケースがある(ミツカン)
 * - recipeInstructions は 文字列配列 / HowToStepオブジェクト配列 / HowToSection(入れ子) / 単一の長文字列
 *   のいずれもありうる(E・レシピは「作り方1. …2. …」という1本の文字列)
 * - cookTime(duration)は "PT40M"(分)と "PT1800S"(秒)の両方がありうる
 * - recipeYield は "2 servings" "4人分" "２人分"(全角) "4(servings)" "2〜3" "その他"(数字なし)等ゆれる
 * - recipeIngredient の文字列は「名前+分量」がスペース/中黒/くっつきで混在する
 */

export interface NormalizedIngredient {
  name: string
  amount?: string
}

export interface NormalizedRecipe {
  title: string
  ingredients: NormalizedIngredient[]
  steps: string[]
  servings?: number
  cookMinutes?: number
  imageUrl?: string
  sourceUrl: string
}

// ============================================================================
// 文字列ユーティリティ(Worker単体で完結させるため、app側のsrc/logicとは独立実装)
// ============================================================================

/** 全角数字・全角スラッシュ・全角ピリオドを半角にする(app側 src/logic/amount.ts normalizeDigits と同じ変換規則) */
function normalizeDigits(text: string): string {
  return text.replace(/[０-９／．]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
}

/** よくあるHTML実体参照を復号する(数値参照含む) */
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

/** HTMLタグを除去する(recipeInstructionsのtextにリンク等が埋め込まれるケース対策) */
function stripHtmlTags(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

/** 改行・タブ・連続空白を単一の半角スペースにまとめる */
function collapseWhitespace(text: string): string {
  return text.replace(/[\s　]+/g, ' ').trim()
}

/** タグ除去→実体参照復号→空白正規化までを一括で行う(表示用テキストの共通クリーンアップ) */
function cleanText(text: string): string {
  return collapseWhitespace(decodeHtmlEntities(stripHtmlTags(text)))
}

// ============================================================================
// JSON-LD抽出(parse_jsonld.cjsの検証済みロジックをTS化)
// ============================================================================

/** HTMLから <script type="application/ld+json"> の中身を全部取り出す */
function extractLdJsonBlocks(html: string): string[] {
  const blocks: string[] = []
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    blocks.push(m[1])
  }
  return blocks
}

/**
 * 一部サイト(ミツカン等)はJSON-LD内の文字列リテラルに生の制御文字(改行等)を埋め込んでおり、
 * 素朴なJSON.parseが失敗する。文字列リテラルの中だけ制御文字をエスケープして復旧する。
 * (検証スクリプト parse_jsonld.cjs の sanitizeControlCharsInStrings をそのまま移植)
 */
function sanitizeControlCharsInStrings(text: string): string {
  let out = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    const code = text.charCodeAt(i)
    if (inString) {
      if (escaped) {
        out += ch
        escaped = false
        continue
      }
      if (ch === '\\') {
        out += ch
        escaped = true
        continue
      }
      if (ch === '"') {
        out += ch
        inString = false
        continue
      }
      if (code < 0x20) {
        if (ch === '\n') out += '\\n'
        else if (ch === '\r') out += '\\r'
        else if (ch === '\t') out += '\\t'
        else out += ' '
        continue
      }
      out += ch
    } else {
      if (ch === '"') inString = true
      out += ch
    }
  }
  return out
}

function isRecipeType(t: unknown): boolean {
  if (!t) return false
  if (Array.isArray(t)) return t.some((x) => typeof x === 'string' && x.toLowerCase().includes('recipe'))
  if (typeof t === 'string') return t.toLowerCase().includes('recipe')
  return false
}

/** @graphや入れ子オブジェクトを再帰的に探索し、Recipe型のノードを集める */
function findRecipeObjects(node: unknown, out: Record<string, unknown>[]): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const item of node) findRecipeObjects(item, out)
    return
  }
  const obj = node as Record<string, unknown>
  if (isRecipeType(obj['@type'])) out.push(obj)
  for (const key of Object.keys(obj)) {
    if (key === '@type') continue
    const val = obj[key]
    if (val && typeof val === 'object') findRecipeObjects(val, out)
  }
}

/** HTML内の全JSON-LDブロックからRecipe型ノードを集める(サニタイズ再試行込み) */
function parseRecipeCandidates(html: string): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = []
  for (const raw of extractLdJsonBlocks(html)) {
    const text = raw.trim().replace(/&quot;/g, '"').replace(/&amp;/g, '&')
    if (!text) continue
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      try {
        data = JSON.parse(sanitizeControlCharsInStrings(text))
      } catch {
        continue
      }
    }
    findRecipeObjects(data, candidates)
  }
  return candidates
}

/** 複数のRecipe候補から、name・recipeIngredient・recipeInstructionsが最も揃っているものを選ぶ */
function pickBestCandidate(candidates: Record<string, unknown>[]): Record<string, unknown> | undefined {
  if (candidates.length === 0) return undefined
  let best = candidates[0]
  let bestScore = -1
  for (const c of candidates) {
    let score = 0
    if (c.name) score++
    if (Array.isArray(c.recipeIngredient) ? c.recipeIngredient.length > 0 : !!c.recipeIngredient) score++
    if (c.recipeInstructions) score++
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

// ============================================================================
// フィールドごとの正規化
// ============================================================================

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  // JSON-LDのrecipeYieldに素のJSON数値(例: 2)を入れているサイトがある(macaroni実測)。
  // 文字列でなくても数値ならそのまま文字列化して扱う(そうしないと人数が丸ごと欠落する)。
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = firstString(v)
      if (s) return s
    }
  }
  return undefined
}

// M7(貼り付けパーサー src/logic/parseRecipeText.ts)のタイトル末尾整形と同じ資産をURL取り込み側にも適用する。
// 「〇〇の作り方」「〇〇 レシピ」のようなサイト・投稿者の定型末尾句を取り除く(空になれば元のまま)。
// 末尾レシピの剥がし条件は「直前が空白」または「直前が“の”」の場合のみ(2026-07-16 SMK-02回帰の教訓:
// 空白なしの連結=「試験用レシピ」のように名前の一部としてレシピで終わる語は剥がさない。
// 「の」は「誰々のレシピ」のような投稿者側の定型句にほぼ限られる安全な接続語のため対象に含める)。
function stripTitleDecoration(title: string): string {
  const cleaned = title
    .replace(/[\s　]*(?:の)?(?:レシピ[・･]?)?(?:作り方|つくり方)$/, '')
    .replace(/(?:[\s　]+|の)レシピ$/, '')
    .trim()
  return cleaned || title
}

function extractTitle(name: unknown): string | undefined {
  const raw = firstString(name)
  if (!raw) return undefined
  const cleaned = cleanText(raw)
  return stripTitleDecoration(cleaned) || undefined
}

// 分量として扱ってはいけない単位(重量・容量・個数の「◯個分」等)が数字の直後に続く場合、
// その数字は「人数」ではなく食材の分量・出来上がり数なので、人数フォールバックの対象から除外する
// (docs/39再監査: クックパッド「鶏もも肉600gで作る分量」→600人分、DELISH KITCHEN「26個分」→26人分
//  のような誤爆が実際に発生することを実測で確認)。
const NON_SERVINGS_UNIT_AFTER_NUMBER =
  /^\s*(?:g|kg|ml|cc|l|個|枚|本|切れ|缶|袋|束|かけ|尾|玉|株|合|片|箱|杯|節)/i

/**
 * recipeYield("2 servings" "4人分" "２人分" "4(servings)" "2〜3" "その他"等)から人数(整数)を取り出す。
 * 「3〜4人分」のような範囲は、app側 src/logic/parseRecipeText.ts の SERVINGS 正規表現と挙動を揃え、
 * 「人分/人前」の直前の数字(=範囲の後ろ側)を採用する。数字が全く無ければ undefined(必須項目にしない)。
 */
export function extractServings(recipeYield: unknown): number | undefined {
  const raw = firstString(recipeYield)
  if (!raw) return undefined
  const normalized = normalizeDigits(raw)
  const withServings = normalized.match(/(\d+)\s*人\s*(?:分|前)/)
  if (withServings) return Number.parseInt(withServings[1], 10)
  // 「人分/人前」の明示が無い場合だけ、最初に見つかった数字を人数とみなす。
  // ただし直後に重量・容量・個数単位が続く数字(600g・26個分等)は人数ではないので飛ばす。
  for (const m of normalized.matchAll(/\d+/g)) {
    const after = normalized.slice((m.index ?? 0) + m[0].length)
    if (NON_SERVINGS_UNIT_AFTER_NUMBER.test(after)) continue
    return Number.parseInt(m[0], 10)
  }
  return undefined
}

/**
 * ISO8601 duration("PT40M" "PT1800S" "PT1H30M"等)を分(整数)に変換する。
 * DELISH KITCHENのように秒表記(PT1800S)のサイトがあるため、秒からの変換を含めて対応する(docs/39)。
 */
export function parseIso8601DurationToMinutes(duration: unknown): number | undefined {
  const raw = firstString(duration)
  if (!raw) return undefined
  const m = raw.trim().match(/^P(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i)
  if (!m) return undefined
  const hours = m[1] ? Number.parseInt(m[1], 10) : 0
  const minutes = m[2] ? Number.parseInt(m[2], 10) : 0
  const seconds = m[3] ? Number.parseFloat(m[3]) : 0
  if (hours === 0 && minutes === 0 && seconds === 0) return undefined
  const total = Math.round(hours * 60 + minutes + seconds / 60)
  return total > 0 ? total : undefined
}

/** image(文字列 / 文字列配列 / {url} / {url}の配列)から最初のURLを取り出す */
export function extractImageUrl(image: unknown): string | undefined {
  if (!image) return undefined
  if (typeof image === 'string') return image || undefined
  if (Array.isArray(image)) {
    for (const item of image) {
      const url = extractImageUrl(item)
      if (url) return url
    }
    return undefined
  }
  if (typeof image === 'object') {
    const obj = image as Record<string, unknown>
    if (typeof obj.url === 'string') return obj.url
    if (typeof obj['@id'] === 'string') return obj['@id'] as string
  }
  return undefined
}

const BULLET_PREFIX = /^[・･\-–—*●○◎▪•‣＊※◇☆★\s　]+/

// 「Ａ水」「B砂糖」「A「ほんだし®」」のように、合わせ調味料のグループ記号(A/B等の単一英字)が
// 区切りなしで名前の先頭にくっついているケース(味の素パーク実測)。BULLET_PREFIXの記号(☆★○等)と違い
// 英字は普通の食材名の一部でもありうるため、「1文字の大文字英字の直後が日本語(かな/カナ/漢字)か
// 開き括弧・引用符」という、グループ記号として使われる時の典型形に絞って剥がす
// (誤って"L-〇〇"のような英字混じりの実在の食材名を壊さないため2文字以上・小文字は対象外)。
const GROUP_LETTER_PREFIX = /^[A-ZＡ-Ｚ](?=[぀-ゟ゠-ヿ一-鿿「『（(＜<])/

// 「大さじ2　1/2」(空白区切りの帯分数=整数2＋分数1/2で2.5を意味する)のように、整数と分数の間に
// 区切りの空白が入っていると、素朴な「末尾の空白で名前/分量を分ける」ロジックが誤爆し、
// 整数側までもが名前に取り込まれてしまう(レタスクラブ実測:「しょうゆ…大さじ2」+「1/2」に誤分割)。
// 名前/分量の境界を決める前に「整数+空白+分数」を1個の小数トークンへ畳んでおくことで防ぐ。
function collapseSpacedMixedFraction(text: string): string {
  return text.replace(/(\d+)[\s　]+(\d+)\/(\d+)(?![\d\/])/g, (match, whole: string, num: string, den: string) => {
    const denominator = Number.parseInt(den, 10)
    if (!denominator) return match
    const value = Number.parseInt(whole, 10) + Number.parseInt(num, 10) / denominator
    return String(Math.round(value * 1000) / 1000)
  })
}

/**
 * recipeIngredientの1件分の文字列("牛こま切れ肉 200g" "そうめん4ワ" "合わせ調味料"等)を
 * 名前と分量に分ける。分量はamount+unitのくっついた文字列のまま返す(単位への分解は
 * app側の既存資産 splitQuantity(src/logic/parseRecipeText.ts)に委ねる設計。docs/39 検証データより
 * 「名前 空白/中黒 分量」の形が大半のため、末尾の空白・記号区切りを優先的に分量境界とみなす)。
 */
export function splitIngredientAmount(raw: string): NormalizedIngredient {
  const cleaned = cleanText(raw).replace(BULLET_PREFIX, '').trim()
  if (!cleaned) return { name: '' }
  // 「A」「Ｂ」のようなグループ記号1文字だけの行(味の素パーク・オレンジページ実測)は
  // 材料としての情報を持たないため、空扱いにして呼び出し側(normalizeIngredients)で除外する
  if (/^[A-ZＡ-Ｚ]$/.test(cleaned)) return { name: '' }
  const normalized = collapseSpacedMixedFraction(normalizeDigits(cleaned)).replace(GROUP_LETTER_PREFIX, '')

  // 末尾の区切り(半角/全角スペース・三点リーダー系)を優先して分量境界とみなす
  const sepMatches = [...normalized.matchAll(/[\s　]+|[…‥⋯]+/g)]
  if (sepMatches.length > 0) {
    const last = sepMatches[sepMatches.length - 1]
    const name = normalized.slice(0, last.index).trim()
    const amount = normalized.slice((last.index ?? 0) + last[0].length).trim()
    if (name && amount) return { name, amount }
  }

  // 区切りが無い「くっつき」形(「そうめん4ワ」等): 数字が始まる位置で分ける
  const glued = normalized.match(/^(\D+?)(\d.*)$/)
  if (glued && glued[1].trim()) {
    return { name: glued[1].trim(), amount: glued[2].trim() }
  }

  // 数字も区切りも無ければ、材料名(グループ見出し等)のみとして返す
  return { name: normalized }
}

/** recipeIngredient(文字列配列が基本だが、単体文字列のケースも防御的に受ける)を正規化する */
export function normalizeIngredients(recipeIngredient: unknown): NormalizedIngredient[] {
  const list = Array.isArray(recipeIngredient) ? recipeIngredient : recipeIngredient ? [recipeIngredient] : []
  const out: NormalizedIngredient[] = []
  for (const item of list) {
    if (typeof item !== 'string') continue
    const parsed = splitIngredientAmount(item)
    if (parsed.name) out.push(parsed)
  }
  return out
}

const LEADING_STEP_LABEL = /^(作り方|つくり方|手順|調理手順|下ごしらえ|下準備)[:：]?\s*/

// 手順の番号マーカー本体(全角/半角数字1〜2桁 + 区切り記号、丸数字、または「[1]」のような角括弧数字)。
// 「作り方1.」「下準備2.」のようにラベル語が番号ごとに繰り返されるサイト(E・レシピ実測)に対応するため、
// ラベル語も番号にくっついていれば1個のマーカーとして丸ごと消費する。
// (?!\d)は「3.5」のような小数点をステップ番号と誤認しないためのガード。
const STEP_MARKER =
  /(?:作り方|つくり方|手順|下ごしらえ|下準備)?[0-9０-９]{1,2}[.、．)）](?![0-9０-９])|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]|[\[［][0-9０-９]{1,2}[\]］]/g
// 番号直後が格助詞で始まる場合は、新しい手順の開始ではなく前の手順への参照
// (「(1)の生地を」「[3]に加える」等。ミツカン・E・レシピ実測)とみなし、マーカーとして扱わない
// (parseRecipeText.ts STEP_NUMBER_REF_GUARD/M4と同じ考え方をWorker側にも移植)。
const STEP_MARKER_FOLLOWED_BY_PARTICLE = /^(?:を|と|の|へ|は|が|に|で)/

/**
 * 「作り方1. ジャガイモは…作り方2. 玉ねぎは…」のような1本の長文字列を番号区切りで手順配列に割る
 * (E・レシピ・ミツカン対応)。番号直後が助詞なら前の手順への参照とみなして分割しない。
 */
function splitInstructionBlob(text: string): string[] {
  const withoutLabel = text.replace(LEADING_STEP_LABEL, '')
  const markers: { index: number; length: number }[] = []
  STEP_MARKER.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = STEP_MARKER.exec(withoutLabel)) !== null) {
    const after = withoutLabel.slice(m.index + m[0].length)
    if (!STEP_MARKER_FOLLOWED_BY_PARTICLE.test(after)) {
      markers.push({ index: m.index, length: m[0].length })
    }
  }
  if (markers.length > 1) {
    const parts: string[] = []
    for (let i = 0; i < markers.length; i++) {
      const start = markers[i].index + markers[i].length
      const end = i + 1 < markers.length ? markers[i + 1].index : withoutLabel.length
      const part = withoutLabel.slice(start, end).trim()
      if (part) parts.push(part)
    }
    if (parts.length > 1) return parts
  }
  // 番号が見つからなければ改行区切りを試す
  const byNewline = withoutLabel
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (byNewline.length > 1) return byNewline
  const single = withoutLabel.trim()
  return single ? [single] : []
}

/** recipeInstructionsの1要素(文字列 / HowToStep / HowToSection)から手順テキストを集める */
function collectInstructionTexts(node: unknown, out: string[]): void {
  if (!node) return
  if (typeof node === 'string') {
    for (const text of splitInstructionBlob(cleanText(node))) out.push(text)
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) collectInstructionTexts(item, out)
    return
  }
  if (typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const type = obj['@type']
    const isSection =
      (typeof type === 'string' && type.toLowerCase().includes('section')) || Array.isArray(obj.itemListElement)
    if (isSection && obj.itemListElement) {
      collectInstructionTexts(obj.itemListElement, out)
      return
    }
    const text = obj.text ?? obj.name
    if (typeof text === 'string') {
      const cleaned = cleanText(text)
      if (cleaned) out.push(cleaned)
    }
  }
}

/**
 * recipeInstructions(文字列配列 / HowToStep配列 / HowToSection入れ子 / 単一文字列)を手順配列に正規化する。
 * HowToStepが1個しかなく、その中身が「[1]…[2]…」のように複数手順を1個のテキストに
 * まとめてしまっているサイト(ミツカン実測)に対応するため、結果が1件だけの場合は
 * 番号分割(splitInstructionBlob)を再適用する(通常の複数HowToStep配列には影響しない)。
 */
export function normalizeInstructions(recipeInstructions: unknown): string[] {
  const out: string[] = []
  collectInstructionTexts(recipeInstructions, out)
  if (out.length === 1) {
    const resplit = splitInstructionBlob(out[0])
    if (resplit.length > 1) return resplit.filter((s) => s.length > 0)
  }
  return out.filter((s) => s.length > 0)
}

// ============================================================================
// エントリポイント
// ============================================================================

/**
 * HTML文字列からschema.org/Recipeを抽出し正規化する。見つからない・中核3項目
 * (title・ingredients・steps)のいずれかが空なら undefined を返す(呼び出し側は no_recipe として扱う想定)。
 */
export function extractRecipeFromHtml(html: string, sourceUrl: string): NormalizedRecipe | undefined {
  const candidates = parseRecipeCandidates(html)
  const best = pickBestCandidate(candidates)
  if (!best) return undefined

  const title = extractTitle(best.name)
  const ingredients = normalizeIngredients(best.recipeIngredient)
  const steps = normalizeInstructions(best.recipeInstructions)
  if (!title || ingredients.length === 0 || steps.length === 0) return undefined

  const servings = extractServings(best.recipeYield)
  // cookTime(正味の調理時間)が無くてもtotalTime(下ごしらえ込みの所要時間)は入っているサイトが多い
  // (再監査実測: NHK・キッコーマン・味の素パーク・ハウス食品・楽天レシピ・つくおき等7サイトでcookTimeは
  // 空だがtotalTimeは入っており、cookTimeだけを見ていたこれまでの実装では丸ごと欠落していた)。
  const cookMinutes = parseIso8601DurationToMinutes(best.cookTime) ?? parseIso8601DurationToMinutes(best.totalTime)
  const imageUrl = extractImageUrl(best.image)

  return {
    title,
    ingredients,
    steps,
    ...(servings !== undefined ? { servings } : {}),
    ...(cookMinutes !== undefined ? { cookMinutes } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
    sourceUrl,
  }
}
