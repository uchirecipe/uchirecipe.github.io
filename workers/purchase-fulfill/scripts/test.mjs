// purchase-fulfill Workerの単体回帰テスト(Stripe実APIには一切接続しない・fetchはすべてスタブ)。
// 実行: npx tsx workers/purchase-fulfill/scripts/test.mjs
// app本体のnpm testとは独立に実行する(app/scripts/test-logic.mjsは触らない。docs/44参照)。
// 新しいバグを直したら、必ずここに再発防止のケースを1行足すこと(app本体のscripts/test-logic.mjsと同じ運用)。
import assert from 'node:assert/strict'
import { allocateCodeForSession } from '../src/pool.ts'
import {
  EXPECTED_AMOUNT_JPY,
  fetchCheckoutSession,
  isValidSessionIdFormat,
  looksLikeExpectedPurchase,
  verifyStripeWebhookSignature,
} from '../src/stripe.ts'
import { handleSuccess, handleWebhook } from '../src/index.ts'
import { CODE_EMAIL_SUBJECT, renderCodeEmailHtml, renderCodeEmailText } from '../src/email.ts'

let passCount = 0
function test(name, fn) {
  try {
    fn()
    passCount++
  } catch (err) {
    console.error(`FAIL: ${name}`)
    throw err
  }
}
async function asyncTest(name, fn) {
  try {
    await fn()
    passCount++
  } catch (err) {
    console.error(`FAIL: ${name}`)
    throw err
  }
}

// ============================================================================
// テスト用ヘルパー: インメモリKVモック(KVNamespaceの一部だけ実装)
// ============================================================================
function createMockKV(initial = {}) {
  const store = new Map(Object.entries(initial))
  return {
    async get(key) {
      return store.has(key) ? store.get(key) : null
    },
    async put(key, value) {
      store.set(key, value)
    },
    _dump() {
      return Object.fromEntries(store)
    },
  }
}

function poolKV(codes) {
  return createMockKV({ pool: JSON.stringify(codes) })
}

// ============================================================================
// pool.ts: allocateCodeForSession
// ============================================================================

await asyncTest('paidセッション→コード払い出し(プールから1件popされ、pool/sessionともKVに反映)', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const result = await allocateCodeForSession(kv, 'cs_test_a1B2c3D4e5F6g7H8i9J0')
  assert.equal(result.status, 'allocated')
  assert.equal(result.code, 'UR-AAAA-1111')
  const dump = kv._dump()
  assert.deepEqual(JSON.parse(dump.pool), ['UR-BBBB-2222'])
  assert.equal(JSON.parse(dump['session:cs_test_a1B2c3D4e5F6g7H8i9J0']).code, 'UR-AAAA-1111')
})

await asyncTest('同一session再取得→同じコード(プールは消費されない・冪等)', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const first = await allocateCodeForSession(kv, 'cs_test_same')
  const second = await allocateCodeForSession(kv, 'cs_test_same')
  assert.equal(first.status, 'allocated')
  assert.equal(second.status, 'already_allocated')
  assert.equal(first.code, second.code)
  // 2回目でプールが減っていないこと(冪等)
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-BBBB-2222'])
})

await asyncTest('プール空→在庫切れ(out_of_stock)', async () => {
  const kv = poolKV([])
  const result = await allocateCodeForSession(kv, 'cs_test_empty')
  assert.equal(result.status, 'out_of_stock')
  assert.equal(kv._dump()['session:cs_test_empty'], undefined)
})

await asyncTest('pool未初期化(KVにpoolキーが無い)でも例外にならずout_of_stock扱い', async () => {
  const kv = createMockKV({})
  const result = await allocateCodeForSession(kv, 'cs_test_nopool')
  assert.equal(result.status, 'out_of_stock')
})

// ============================================================================
// stripe.ts: isValidSessionIdFormat / looksLikeExpectedPurchase
// ============================================================================

test('isValidSessionIdFormat: cs_で始まる妥当な形式を受理する', () => {
  assert.equal(isValidSessionIdFormat('cs_test_a1B2c3D4e5F6'), true)
  assert.equal(isValidSessionIdFormat('cs_live_a1B2c3D4e5F6g7H8'), true)
})

test('isValidSessionIdFormat: 不正な形式(cs_で始まらない・短すぎ・null)を拒否する', () => {
  assert.equal(isValidSessionIdFormat(null), false)
  assert.equal(isValidSessionIdFormat(''), false)
  assert.equal(isValidSessionIdFormat('cs_short'), false)
  assert.equal(isValidSessionIdFormat('<script>alert(1)</script>'), false)
  assert.equal(isValidSessionIdFormat('not_cs_prefixed_but_long_enough'), false)
})

test('looksLikeExpectedPurchase: 800円・jpy・paymentモード一致でtrue', () => {
  assert.equal(
    looksLikeExpectedPurchase({ amount_total: EXPECTED_AMOUNT_JPY, currency: 'jpy', mode: 'payment' }),
    true,
  )
})

test('looksLikeExpectedPurchase: 金額/通貨/modeいずれかが不一致ならfalse', () => {
  assert.equal(looksLikeExpectedPurchase({ amount_total: 500, currency: 'jpy', mode: 'payment' }), false)
  assert.equal(looksLikeExpectedPurchase({ amount_total: 800, currency: 'usd', mode: 'payment' }), false)
  assert.equal(looksLikeExpectedPurchase({ amount_total: 800, currency: 'jpy', mode: 'subscription' }), false)
})

// ============================================================================
// stripe.ts: fetchCheckoutSession(fetchはスタブ・実Stripeには繋がない)
// ============================================================================

await asyncTest('fetchCheckoutSession: Stripe APIの200応答をそのまま返す', async () => {
  const stubFetch = async (input, init) => {
    assert.equal(input, 'https://api.stripe.com/v1/checkout/sessions/cs_test_a1B2c3D4e5F6g7H8i9J0')
    assert.equal(init.headers.Authorization, 'Bearer sk_test_dummy')
    return new Response(
      JSON.stringify({ id: 'cs_test_a1B2c3D4e5F6g7H8i9J0', payment_status: 'paid', status: 'complete', amount_total: 800, currency: 'jpy', mode: 'payment' }),
      { status: 200 },
    )
  }
  const session = await fetchCheckoutSession('cs_test_a1B2c3D4e5F6g7H8i9J0', 'sk_test_dummy', stubFetch)
  assert.equal(session?.payment_status, 'paid')
})

await asyncTest('fetchCheckoutSession: Stripe APIが404等を返したらnull', async () => {
  const stubFetch = async () => new Response('{}', { status: 404 })
  const session = await fetchCheckoutSession('cs_test_missing', 'sk_test_dummy', stubFetch)
  assert.equal(session, null)
})

// ============================================================================
// stripe.ts: verifyStripeWebhookSignature(署名検証)
// ============================================================================

async function makeSignatureHeader(secret, payload, timestampSeconds) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestampSeconds}.${payload}`))
  const hex = Array.from(new Uint8Array(sigBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return `t=${timestampSeconds},v1=${hex}`
}

await asyncTest('webhook署名OK: 正しい秘密鍵で計算した署名は検証を通る', async () => {
  const secret = 'whsec_test_secret'
  const payload = JSON.stringify({ type: 'checkout.session.completed' })
  const nowMs = 1_700_000_000_000
  const header = await makeSignatureHeader(secret, payload, Math.floor(nowMs / 1000))
  const ok = await verifyStripeWebhookSignature(payload, header, secret, nowMs)
  assert.equal(ok, true)
})

await asyncTest('webhook署名NG: 秘密鍵が違うと検証に失敗する', async () => {
  const payload = JSON.stringify({ type: 'checkout.session.completed' })
  const nowMs = 1_700_000_000_000
  const header = await makeSignatureHeader('whsec_correct', payload, Math.floor(nowMs / 1000))
  const ok = await verifyStripeWebhookSignature(payload, header, 'whsec_wrong', nowMs)
  assert.equal(ok, false)
})

await asyncTest('webhook署名NG: ペイロード改ざんで検証に失敗する', async () => {
  const secret = 'whsec_test_secret'
  const originalPayload = JSON.stringify({ type: 'checkout.session.completed', amount: 800 })
  const nowMs = 1_700_000_000_000
  const header = await makeSignatureHeader(secret, originalPayload, Math.floor(nowMs / 1000))
  const tamperedPayload = JSON.stringify({ type: 'checkout.session.completed', amount: 1 })
  const ok = await verifyStripeWebhookSignature(tamperedPayload, header, secret, nowMs)
  assert.equal(ok, false)
})

await asyncTest('webhook署名NG: タイムスタンプが許容範囲外(リプレイ)なら失敗する', async () => {
  const secret = 'whsec_test_secret'
  const payload = JSON.stringify({ type: 'checkout.session.completed' })
  const oldTimestampSeconds = 1_700_000_000 // nowMsから10分以上前
  const header = await makeSignatureHeader(secret, payload, oldTimestampSeconds)
  const nowMs = 1_700_000_000_000 + 10 * 60 * 1000
  const ok = await verifyStripeWebhookSignature(payload, header, secret, nowMs)
  assert.equal(ok, false)
})

await asyncTest('webhook署名NG: ヘッダが無い/壊れている場合は失敗する', async () => {
  const secret = 'whsec_test_secret'
  assert.equal(await verifyStripeWebhookSignature('{}', null, secret), false)
  assert.equal(await verifyStripeWebhookSignature('{}', 'garbage', secret), false)
  assert.equal(await verifyStripeWebhookSignature('{}', 't=123', secret), false)
})

// ============================================================================
// index.ts: handleSuccess(統合的な分岐の確認。fetchはスタブ)
// ============================================================================

function stripeSessionResponse(overrides = {}) {
  return new Response(
    JSON.stringify({
      id: 'cs_test_a1B2c3D4e5F6g7H8i9J0',
      payment_status: 'paid',
      status: 'complete',
      amount_total: 800,
      currency: 'jpy',
      mode: 'payment',
      ...overrides,
    }),
    { status: 200 },
  )
}

await asyncTest('handleSuccess: paidセッション→200・コードを含むHTML・KVに割当が残る', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse()
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  assert.equal(res.status, 200)
  const body = await res.text()
  assert.ok(body.includes('UR-AAAA-1111'))
  assert.equal(JSON.parse(kv._dump()['session:cs_test_a1B2c3D4e5F6g7H8i9J0']).code, 'UR-AAAA-1111')
})

await asyncTest('handleSuccess: 同一session_idを2回読み込んでも同じコードを返す(冪等)', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse()
  const url = new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0')
  const res1 = await handleSuccess(url, env, stubFetch)
  const res2 = await handleSuccess(url, env, stubFetch)
  const body1 = await res1.text()
  const body2 = await res2.text()
  assert.ok(body1.includes('UR-AAAA-1111'))
  assert.ok(body2.includes('UR-AAAA-1111'))
  assert.ok(!body2.includes('UR-BBBB-2222'))
})

await asyncTest('handleSuccess: unpaidセッション→拒否(コードは払い出されない)', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse({ payment_status: 'unpaid', status: 'open' })
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  const body = await res.text()
  assert.ok(!body.includes('UR-AAAA-1111'))
  assert.ok(body.includes('まだお支払いが確認できません'))
  assert.equal(kv._dump()['session:cs_test_a1B2c3D4e5F6g7H8i9J0'], undefined)
  // プールも消費されていないこと
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-AAAA-1111'])
})

await asyncTest('handleSuccess: プール空→在庫切れページ(200・専用ヘッダ付き)', async () => {
  const kv = poolKV([])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse()
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('X-Purchase-Fulfill-Alert'), 'out-of-stock')
  const body = await res.text()
  // 連絡先はhtml.tsのCONTACT_EMAILと同じであること(2026-08-03: この行はhapillust@…を見ており、
  // 実装がuchiapplication@…に変わった後もテストだけ古いまま落ちていた=回帰の見落とし)
  assert.ok(body.includes('uchiapplication@gmail.com'))
})

await asyncTest('在庫切れページ: 購入者に連絡を催促せず「こちらから送る」案内になっている(2026-08-03オーナー指示)', async () => {
  const kv = poolKV([])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse()
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  const body = await res.text()
  assert.ok(body.includes('ご購入時のメールアドレスにコードをお送りします'))
  assert.ok(body.includes('1日たってもメールが届かない場合は'))
  // 旧文面(購入者に連絡を催促する言い回し)が残っていないこと
  assert.ok(!body.includes('担当者が確認しております'))
  assert.ok(!body.includes('お手数ですが'))
})

await asyncTest('handleSuccess: session_id形式が不正なら400・Stripeを呼ばない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  let fetchCalled = false
  const stubFetch = async () => {
    fetchCalled = true
    return stripeSessionResponse()
  }
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=not-a-session'), env, stubFetch)
  assert.equal(res.status, 400)
  assert.equal(fetchCalled, false)
})

await asyncTest('handleSuccess: 金額が想定外(なりすまし/別リンク流用疑い)なら拒否しコードを払い出さない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => stripeSessionResponse({ amount_total: 100 })
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  assert.equal(res.status, 400)
  assert.equal(kv._dump()['session:cs_test_a1B2c3D4e5F6g7H8i9J0'], undefined)
})

await asyncTest('handleSuccess: Stripe APIがセッションを見つけられない(null)なら拒否ページ', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec' }
  const stubFetch = async () => new Response('{}', { status: 404 })
  const res = await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_a1B2c3D4e5F6g7H8i9J0'), env, stubFetch)
  assert.equal(res.status, 400)
})

// ============================================================================
// index.ts: handleWebhook
// ============================================================================

async function makeWebhookRequest(secret, eventBody, { timestampSeconds, badSignature = false } = {}) {
  const payload = JSON.stringify(eventBody)
  const ts = timestampSeconds ?? Math.floor(Date.now() / 1000)
  const header = badSignature ? `t=${ts},v1=deadbeef` : await makeSignatureHeader(secret, payload, ts)
  return new Request('https://worker.example/webhook', {
    method: 'POST',
    headers: { 'Stripe-Signature': header, 'Content-Type': 'application/json' },
    body: payload,
  })
}

function completedEvent(sessionOverrides = {}) {
  return {
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_webhook',
        payment_status: 'paid',
        status: 'complete',
        amount_total: 800,
        currency: 'jpy',
        mode: 'payment',
        customer_details: { email: 'buyer@example.com' },
        ...sessionOverrides,
      },
    },
  }
}

/** Resend APIのスタブ。呼ばれた回数とリクエスト内容を記録する(実際には送信しない)。 */
function createResendStub({ status = 200 } = {}) {
  const calls = []
  const fetchImpl = async (input, init) => {
    calls.push({ input, init, body: JSON.parse(init.body) })
    return new Response(JSON.stringify({ id: 'stub-email-id' }), { status })
  }
  fetchImpl.calls = calls
  return fetchImpl
}

await asyncTest('handleWebhook: 署名OK・checkout.session.completed→200・コード割当(GET /successと同じロジックを共有)', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret }
  const req = await makeWebhookRequest(secret, completedEvent())
  const res = await handleWebhook(req, env)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.ok, true)
  assert.equal(body.status, 'allocated')
  assert.equal(JSON.parse(kv._dump()['session:cs_test_webhook']).code, 'UR-AAAA-1111')
})

await asyncTest('handleWebhook: 署名NG(改ざん/別鍵)→400・KVは変更されない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: 'whsec_correct' }
  const req = await makeWebhookRequest('whsec_wrong', completedEvent())
  const res = await handleWebhook(req, env)
  assert.equal(res.status, 400)
  assert.equal(kv._dump()['session:cs_test_webhook'], undefined)
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-AAAA-1111'])
})

await asyncTest('handleWebhook: 未払い(payment_status!==paid)イベントはskipされコードを消費しない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret }
  const req = await makeWebhookRequest(secret, completedEvent({ payment_status: 'unpaid' }))
  const res = await handleWebhook(req, env)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.skipped, 'not_paid_yet')
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-AAAA-1111'])
})

await asyncTest('handleWebhook: 対象外イベント種別は200でskipし何もしない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret }
  const req = await makeWebhookRequest(secret, { type: 'payment_intent.succeeded', data: { object: {} } })
  const res = await handleWebhook(req, env)
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.skipped, 'unhandled_event_type')
})

await asyncTest('handleWebhook: GET /successで既に払い出し済みのsessionを後からwebhookが受け取っても同じコード(冪等)', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret }
  const stubFetch = async () => stripeSessionResponse({ id: 'cs_test_webhook' })
  await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_webhook'), env, stubFetch)
  const req = await makeWebhookRequest(secret, completedEvent())
  const res = await handleWebhook(req, env)
  const body = await res.json()
  assert.equal(body.status, 'already_allocated')
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-BBBB-2222'])
})

// ============================================================================
// email.ts + handleWebhook: 解錠コードの自動メール送付
// (2026-08-03 オーナー指示「購入者に連絡を催促するのではなく、コードが自動でメールなどで届くように」)
// ============================================================================

const RESEND_URL = 'https://api.resend.com/emails'

await asyncTest('メール送付: 割当成功→Resendへ1通送り、KVにemailedAtが記録される', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()
  const req = await makeWebhookRequest(secret, completedEvent())
  const res = await handleWebhook(req, env, resend)

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.email, 'sent')
  assert.equal(resend.calls.length, 1)
  assert.equal(resend.calls[0].input, RESEND_URL)
  assert.equal(resend.calls[0].init.headers.Authorization, 'Bearer re_test_dummy')
  assert.deepEqual(resend.calls[0].body.to, ['buyer@example.com'])
  assert.equal(resend.calls[0].body.subject, CODE_EMAIL_SUBJECT)
  assert.equal(resend.calls[0].body.reply_to, 'uchiapplication@gmail.com')
  assert.ok(resend.calls[0].body.from.includes('code@uchirecipe.com'))
  assert.ok(resend.calls[0].body.text.includes('UR-AAAA-1111'))
  assert.ok(resend.calls[0].body.html.includes('UR-AAAA-1111'))
  const record = JSON.parse(kv._dump()['session:cs_test_webhook'])
  assert.equal(record.code, 'UR-AAAA-1111')
  assert.equal(typeof record.emailedAt, 'number')
  // 宛先(個人情報)はKVに残さない
  assert.ok(!kv._dump()['session:cs_test_webhook'].includes('buyer@example.com'))
})

await asyncTest('メール送付: RESEND_API_KEY未設定なら送信をスキップし、割当は従来どおり成功する', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret }
  const resend = createResendStub()
  const req = await makeWebhookRequest(secret, completedEvent())
  const res = await handleWebhook(req, env, resend)

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.status, 'allocated')
  assert.equal(body.email, 'skipped_not_configured')
  assert.equal(resend.calls.length, 0)
  assert.equal(JSON.parse(kv._dump()['session:cs_test_webhook']).emailedAt, undefined)
})

await asyncTest('メール送付: 宛先(customer_details.email)が取れないときは送らず、割当だけ確定する', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()
  const req = await makeWebhookRequest(secret, completedEvent({ customer_details: null }))
  const res = await handleWebhook(req, env, resend)

  const body = await res.json()
  assert.equal(body.status, 'allocated')
  assert.equal(body.email, 'skipped_no_customer_email')
  assert.equal(resend.calls.length, 0)
  assert.equal(JSON.parse(kv._dump()['session:cs_test_webhook']).code, 'UR-AAAA-1111')
})

await asyncTest('メール送付: customer_detailsはあるがemailが空でも送らない', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()
  const req = await makeWebhookRequest(secret, completedEvent({ customer_details: { email: null } }))
  const res = await handleWebhook(req, env, resend)

  const body = await res.json()
  assert.equal(body.email, 'skipped_no_customer_email')
  assert.equal(resend.calls.length, 0)
})

await asyncTest('メール送付: Stripeが同じイベントを再送しても2通目は送らない(emailedAtで冪等)', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()
  const res1 = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, resend)
  const res2 = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, resend)

  assert.equal((await res1.json()).email, 'sent')
  const body2 = await res2.json()
  assert.equal(body2.status, 'already_allocated')
  assert.equal(body2.email, 'skipped_already_emailed')
  assert.equal(resend.calls.length, 1)
  // 2通目を試みていないのでプールも減っていない
  assert.deepEqual(JSON.parse(kv._dump().pool), ['UR-BBBB-2222'])
})

await asyncTest('メール送付: /successで先に払い出されたセッションでも、webhookは同じコードをメールする', async () => {
  const kv = poolKV(['UR-AAAA-1111', 'UR-BBBB-2222'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const stubFetch = async () => stripeSessionResponse({ id: 'cs_test_webhook' })
  await handleSuccess(new URL('https://worker.example/success?session_id=cs_test_webhook'), env, stubFetch)
  const resend = createResendStub()
  const res = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, resend)

  const body = await res.json()
  assert.equal(body.status, 'already_allocated')
  assert.equal(body.email, 'sent')
  assert.ok(resend.calls[0].body.text.includes('UR-AAAA-1111'))
})

await asyncTest('メール送付: Resendが失敗してもwebhookは200(割当優先)・emailedAtは書かず次回再挑戦できる', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const failing = createResendStub({ status: 500 })
  const res = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, failing)

  assert.equal(res.status, 200)
  assert.equal((await res.json()).email, 'send_failed')
  assert.equal(JSON.parse(kv._dump()['session:cs_test_webhook']).emailedAt, undefined)

  // Stripeの再送で今度は成功する
  const retry = createResendStub()
  const res2 = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, retry)
  assert.equal((await res2.json()).email, 'sent')
  assert.equal(retry.calls.length, 1)
})

await asyncTest('メール送付: fetch自体が例外を投げてもwebhookは200のまま', async () => {
  const kv = poolKV(['UR-AAAA-1111'])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const throwingFetch = async () => {
    throw new Error('network down')
  }
  const res = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, throwingFetch)
  assert.equal(res.status, 200)
  assert.equal((await res.json()).email, 'send_failed')
})

await asyncTest('メール送付: 在庫切れのときは送らない(送るコードが無いため)', async () => {
  const kv = poolKV([])
  const secret = 'whsec_test_secret'
  const env = { PRO_CODES: kv, STRIPE_SECRET_KEY: 'sk_test_dummy', STRIPE_WEBHOOK_SECRET: secret, RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()
  const res = await handleWebhook(await makeWebhookRequest(secret, completedEvent()), env, resend)

  assert.equal(res.status, 200)
  const body = await res.json()
  assert.equal(body.status, 'out_of_stock')
  assert.equal(body.alert, 'out-of-stock')
  assert.equal(resend.calls.length, 0)
})

await asyncTest('メール送付: 未払い・署名NGのイベントではメールを送らない', async () => {
  const secret = 'whsec_test_secret'
  const base = { STRIPE_SECRET_KEY: 'sk_test_dummy', RESEND_API_KEY: 're_test_dummy' }
  const resend = createResendStub()

  const unpaidEnv = { ...base, PRO_CODES: poolKV(['UR-AAAA-1111']), STRIPE_WEBHOOK_SECRET: secret }
  await handleWebhook(await makeWebhookRequest(secret, completedEvent({ payment_status: 'unpaid' })), unpaidEnv, resend)

  const badSigEnv = { ...base, PRO_CODES: poolKV(['UR-AAAA-1111']), STRIPE_WEBHOOK_SECRET: 'whsec_correct' }
  await handleWebhook(await makeWebhookRequest('whsec_wrong', completedEvent()), badSigEnv, resend)

  assert.equal(resend.calls.length, 0)
})

await asyncTest('メール文面: 件名・コード・入力手順3歩・精度開示・問い合わせ先がテキスト/HTML両方に入る', () => {
  assert.equal(CODE_EMAIL_SUBJECT, 'うちレシピ Pro版 解錠コード')
  const accuracy = '栄養と食費の数字は、材料と分量から計算した概算です。調理による変化は反映していません。治療中の方・妊娠中の方の食事管理には使えません。'
  for (const bodyText of [renderCodeEmailText('UR-AAAA-1111'), renderCodeEmailHtml('UR-AAAA-1111')]) {
    assert.ok(bodyText.includes('UR-AAAA-1111'))
    assert.ok(bodyText.includes('うちレシピを開く→設定'))
    assert.ok(bodyText.includes('「Pro」→「購入と解錠」にこのコードを入力'))
    assert.ok(bodyText.includes('「解錠する」を押すと全機能が使えます'))
    // 精度開示は about/index.html の購入ボタン上の一文と同じであること(片方だけ変えない)
    assert.ok(bodyText.includes(accuracy))
    assert.ok(bodyText.includes('uchiapplication@gmail.com'))
  }
})

await asyncTest('メール文面: HTML版は外部リソースを読み込まない(画像・スクリプト・外部CSS無し)', () => {
  const html = renderCodeEmailHtml('UR-AAAA-1111')
  assert.ok(!html.includes('<img'))
  assert.ok(!html.includes('<script'))
  assert.ok(!html.includes('<link'))
  // リンク先はうちレシピ自身のみ
  for (const href of html.match(/href="([^"]+)"/g) ?? []) {
    assert.ok(href.includes('uchirecipe.com'), `想定外のリンク先: ${href}`)
  }
})

console.log(`purchase-fulfill: ${passCount}件のテストに合格しました`)
