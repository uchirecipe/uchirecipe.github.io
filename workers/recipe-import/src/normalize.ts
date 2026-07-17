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
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = firstString(v)
      if (s) return s
    }
  }
  return undefined
}

function extractTitle(name: unknown): string | undefined {
  const raw = firstString(name)
  if (!raw) return undefined
  const cleaned = cleanText(raw)
  return cleaned || undefined
}

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
  const anyNumber = normalized.match(/(\d+)/)
  if (anyNumber) return Number.parseInt(anyNumber[1], 10)
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

/**
 * recipeIngredientの1件分の文字列("牛こま切れ肉 200g" "そうめん4ワ" "合わせ調味料"等)を
 * 名前と分量に分ける。分量はamount+unitのくっついた文字列のまま返す(単位への分解は
 * app側の既存資産 splitQuantity(src/logic/parseRecipeText.ts)に委ねる設計。docs/39 検証データより
 * 「名前 空白/中黒 分量」の形が大半のため、末尾の空白・記号区切りを優先的に分量境界とみなす)。
 */
export function splitIngredientAmount(raw: string): NormalizedIngredient {
  const cleaned = cleanText(raw).replace(BULLET_PREFIX, '').trim()
  if (!cleaned) return { name: '' }
  const normalized = normalizeDigits(cleaned)

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

const LEADING_STEP_LABEL = /^(作り方|つくり方|手順|調理手順)[:：]?\s*/

/** 「作り方1. ジャガイモは…2. 玉ねぎは…」のような1本の長文字列を番号区切りで手順配列に割る(E・レシピ対応) */
function splitInstructionBlob(text: string): string[] {
  const withoutLabel = text.replace(LEADING_STEP_LABEL, '')
  // 番号("1." "1)" "1、" 等)直前で分割する。丸数字にも対応
  const parts = withoutLabel
    .split(/(?=\d{1,2}[.、．)）])|(?=[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳])/)
    .map((s) => s.replace(/^\d{1,2}[.、．)）]\s*/, '').replace(/^[①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳]\s*/, '').trim())
    .filter(Boolean)
  if (parts.length > 1) return parts
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

/** recipeInstructions(文字列配列 / HowToStep配列 / HowToSection入れ子 / 単一文字列)を手順配列に正規化する */
export function normalizeInstructions(recipeInstructions: unknown): string[] {
  const out: string[] = []
  collectInstructionTexts(recipeInstructions, out)
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
  const cookMinutes = parseIso8601DurationToMinutes(best.cookTime)
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
