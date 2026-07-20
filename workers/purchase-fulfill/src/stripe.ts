/**
 * Stripe連携ロジック(Checkout Session取得・Webhook署名検証・なりすまし抑止チェック)。
 * Cloudflare Worker(index.ts)からも、Nodeの単体テスト(scripts/test.mjs、fetchを注入して
 * Stripe応答をモック)からも同じ関数を使えるよう、Workers固有APIに依存しない形にする
 * (Web標準のfetch/crypto.subtleのみ使用。Node20+・Workers双方で動く)。
 */

const CHECKOUT_SESSION_ID_RE = /^cs_[A-Za-z0-9_]{10,300}$/

/** クエリの session_id がStripe Checkout Sessionのidらしい形か検証する(cs_で始まる等)。 */
export function isValidSessionIdFormat(sessionId: string | null): sessionId is string {
  return typeof sessionId === 'string' && CHECKOUT_SESSION_ID_RE.test(sessionId)
}

/** GET /v1/checkout/sessions/{id} のレスポンスのうち、このWorkerが使うフィールドだけ。 */
export interface StripeCheckoutSession {
  id: string
  payment_status: string // 'paid' | 'unpaid' | 'no_payment_required'
  status: string // 'open' | 'complete' | 'expired'
  amount_total: number | null
  currency: string | null
  mode: string // 'payment' | 'setup' | 'subscription'
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Stripe APIからCheckout Sessionを取得する。存在しない/APIエラーの場合はnullを返す
 * (呼び出し側は「確認できませんでした」として安全側に倒す)。
 */
export async function fetchCheckoutSession(
  sessionId: string,
  secretKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<StripeCheckoutSession | null> {
  const res = await fetchImpl(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) return null
  const data = (await res.json()) as StripeCheckoutSession
  if (!data || typeof data.id !== 'string') return null
  return data
}

/** うちレシピ買い切り版の価格(税込・円)。docs/44に記載の現行価格。値上げ時はここも更新すること。 */
export const EXPECTED_AMOUNT_JPY = 800
const EXPECTED_CURRENCY = 'jpy'
const EXPECTED_MODE = 'payment'

/**
 * セッションが「うちレシピ買い切り版」の決済リンク由来らしいか軽く検証する(なりすまし・
 * 別リンク流用の抑止。過剰にはしない=docs/44の方針どおり)。amount_total/currency/modeの
 * 3点が一致することだけを見る(Payment LinkのID自体はbuy.stripe.comの短縮URLから逆算できず
 * 未確定のため対象にしない)。
 */
export function looksLikeExpectedPurchase(session: Pick<StripeCheckoutSession, 'amount_total' | 'currency' | 'mode'>): boolean {
  return session.amount_total === EXPECTED_AMOUNT_JPY && session.currency === EXPECTED_CURRENCY && session.mode === EXPECTED_MODE
}

const SIGNATURE_TOLERANCE_SECONDS = 300

function parseSignatureHeader(header: string): { timestamp?: string; v1?: string } {
  const out: { timestamp?: string; v1?: string } = {}
  for (const part of header.split(',')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key === 't') out.timestamp = value
    else if (key === 'v1' && !out.v1) out.v1 = value // 複数v1がある場合は先頭を採用(ローテーション中の旧鍵は無視)
  }
  return out
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * StripeのWebhook署名(`Stripe-Signature`ヘッダ)を検証する。標準のStripe署名方式
 * (`t=<timestamp>,v1=<hex hmac>` を `${timestamp}.${rawBody}` のHMAC-SHA256で照合)を
 * Web Crypto APIで実装したもの。タイムスタンプが許容範囲(既定5分)を超えていたら
 * リプレイ対策として拒否する。rawBodyは(JSON.parseする前の)生の文字列であること。
 */
export async function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string,
  now: number = Date.now(),
  toleranceSeconds: number = SIGNATURE_TOLERANCE_SECONDS,
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false
  const { timestamp, v1 } = parseSignatureHeader(signatureHeader)
  if (!timestamp || !v1) return false

  const timestampNum = Number(timestamp)
  if (!Number.isFinite(timestampNum)) return false
  if (Math.abs(now / 1000 - timestampNum) > toleranceSeconds) return false

  const expectedHex = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`)
  return timingSafeEqual(expectedHex, v1.toLowerCase())
}
