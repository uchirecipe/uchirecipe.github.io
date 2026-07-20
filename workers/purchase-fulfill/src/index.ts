/**
 * うちレシピ「購入後に解錠コードを自動で渡す」Cloudflare Worker。設計: ../../docs/44_購入後コード自動配信_設計.md
 *
 * GET /success?session_id=<Checkout Session id>
 *   Stripe決済リンクの「完了後リダイレクト先」に設定する。Stripe APIでセッションを取得し、
 *   支払い済みを確認できたらKVコードプールから1件払い出して日本語ページで表示する(冪等)。
 *
 * POST /webhook
 *   Stripeの checkout.session.completed イベントを受け取り、同じ払い出しロジックで
 *   コードを予約しておく(顧客が完了ページを開かずタブを閉じてしまっても割当が確定するための保険)。
 *   署名検証(Stripe-Signature)必須。
 *
 * プライバシー方針: このWorkerはconsole.log等を使わない(recipe-import Workerと同じ方針)。
 * 検知が必要な状態(在庫切れ・想定外の決済内容)はレスポンスの内容/ステータスで表現する。
 */
import type { Env } from './env'
import {
  fetchCheckoutSession,
  isValidSessionIdFormat,
  looksLikeExpectedPurchase,
  verifyStripeWebhookSignature,
  type FetchLike,
  type StripeCheckoutSession,
} from './stripe'
import { allocateCodeForSession } from './pool'
import {
  renderInvalidPage,
  renderNotPaidPage,
  renderOutOfStockPage,
  renderSuccessPage,
  renderTemporaryErrorPage,
} from './html'

function htmlResponse(body: string, status: number, extraHeaders?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...extraHeaders },
  })
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

/** GET /success のハンドラ本体。テストからfetchImplを注入できるよう分離している。 */
export async function handleSuccess(url: URL, env: Env, fetchImpl: FetchLike = fetch): Promise<Response> {
  const sessionId = url.searchParams.get('session_id')
  if (!isValidSessionIdFormat(sessionId)) {
    return htmlResponse(renderInvalidPage(), 400)
  }

  if (!env.STRIPE_SECRET_KEY || !env.PRO_CODES) {
    // 設定未完了(secret未設定・KV未バインド)。オーナー作業待ちの状態。
    return htmlResponse(renderTemporaryErrorPage(), 500)
  }

  let session: StripeCheckoutSession | null
  try {
    session = await fetchCheckoutSession(sessionId, env.STRIPE_SECRET_KEY, fetchImpl)
  } catch {
    return htmlResponse(renderTemporaryErrorPage(), 503)
  }

  if (!session) {
    return htmlResponse(renderInvalidPage(), 400)
  }

  if (session.status !== 'complete' || session.payment_status !== 'paid') {
    return htmlResponse(renderNotPaidPage(), 200)
  }

  if (!looksLikeExpectedPurchase(session)) {
    // 想定外の金額/通貨/mode(=このWorker向けの決済リンクではない可能性)。理由は伝えず安全側で拒否する。
    return htmlResponse(renderInvalidPage(), 400)
  }

  const result = await allocateCodeForSession(env.PRO_CODES, sessionId)
  if (result.status === 'out_of_stock') {
    // 在庫切れ: console.log等は使わず(recipe-import Workerと同じ方針)、レスポンスヘッダで検知できるようにする。
    // オーナーは `curl -I` やちょっとした死活監視でこのヘッダの有無を確認できる。
    return htmlResponse(renderOutOfStockPage(), 200, { 'X-Purchase-Fulfill-Alert': 'out-of-stock' })
  }

  return htmlResponse(renderSuccessPage(result.code), 200)
}

/** checkout.session.completed イベントのdata.objectのうち、このWorkerが使うフィールドだけ。 */
interface CheckoutSessionCompletedEvent {
  type: string
  data: { object: StripeCheckoutSession }
}

/** POST /webhook のハンドラ本体。 */
export async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const signatureHeader = request.headers.get('Stripe-Signature')
  const rawBody = await request.text()

  if (!env.STRIPE_WEBHOOK_SECRET) {
    return jsonResponse({ ok: false, error: 'not_configured' }, 500)
  }

  const validSignature = await verifyStripeWebhookSignature(rawBody, signatureHeader, env.STRIPE_WEBHOOK_SECRET)
  if (!validSignature) {
    return jsonResponse({ ok: false, error: 'invalid_signature' }, 400)
  }

  let event: CheckoutSessionCompletedEvent
  try {
    event = JSON.parse(rawBody) as CheckoutSessionCompletedEvent
  } catch {
    return jsonResponse({ ok: false, error: 'invalid_json' }, 400)
  }

  if (event.type !== 'checkout.session.completed') {
    // 対象外イベント。Stripeへ再送させないよう2xxで返す。
    return jsonResponse({ ok: true, skipped: 'unhandled_event_type' }, 200)
  }

  const session = event.data?.object
  if (!session || typeof session.id !== 'string') {
    return jsonResponse({ ok: false, error: 'malformed_event' }, 400)
  }

  // 非同期決済手段(銀行振込等)ではcheckout.session.completedがpayment_status='unpaid'のまま
  // 先に発火することがある(実際の入金確定は後続のcheckout.session.async_payment_succeededイベント)。
  // 本設計はカード決済のPayment Linkのみを対象とするため、未払いならここでは何もせずskipする
  // (TODO: 非同期決済手段を有効化する場合はasync_payment_succeededのハンドリングを追加すること)。
  if (session.payment_status !== 'paid') {
    return jsonResponse({ ok: true, skipped: 'not_paid_yet' }, 200)
  }

  if (!looksLikeExpectedPurchase(session)) {
    return jsonResponse({ ok: true, skipped: 'unexpected_purchase' }, 200)
  }

  if (!env.PRO_CODES) {
    return jsonResponse({ ok: false, error: 'not_configured' }, 500)
  }

  try {
    const result = await allocateCodeForSession(env.PRO_CODES, session.id)
    // メール送信はこの設計では実装しない(Managed Paymentsが確認メールを代行するため、
    // またこちらで顧客メールアドレスを確実に取得できるか未確定なため。docs/44参照)。
    return jsonResponse({ ok: true, status: result.status }, 200)
  } catch {
    // KV障害等の一時的な問題はStripeにリトライしてほしいので500を返す。
    return jsonResponse({ ok: false, error: 'allocation_failed' }, 500)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/success') {
      if (request.method !== 'GET') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
      return handleSuccess(url, env)
    }

    if (url.pathname === '/webhook') {
      if (request.method !== 'POST') return jsonResponse({ ok: false, error: 'method_not_allowed' }, 405)
      return handleWebhook(request, env)
    }

    return jsonResponse({ ok: false, error: 'not_found' }, 404)
  },
}
