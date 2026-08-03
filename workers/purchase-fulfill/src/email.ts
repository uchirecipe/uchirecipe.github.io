/**
 * 解錠コードの自動メール送付(Resend API・fetch直・SDK不使用)。
 *
 * 目的: 購入者がブラウザを閉じてしまっても、コードが手元に残る経路を1本用意する
 * (2026-08-03 オーナー指示「購入者に連絡を催促するのではなく、コードが自動でメールなどで届くように」)。
 * /success ページでのその場表示は従来どおり主経路として維持し、メールは控えとして送る。
 *
 * 方針:
 * - RESEND_API_KEY が未設定なら送信をスキップして従来動作のまま(デプロイしても壊れない)。
 * - 宛先は Checkout Session の customer_details.email。取れないときは送らない
 *   (Managed Paymentsで顧客メールが取れない可能性はdocs/44に既知として記載済み)。
 * - console.log等は使わない(このWorkerのプライバシー方針)。結果は戻り値で表現する。
 * - メールアドレスはKVにもレスポンスにも残さない(送信時にResendへ渡すだけ)。
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

/** 送信元。uchirecipe.com をResendで認証済みであること(手順は scripts/load-codes.md)。 */
const FROM = 'うちレシピ <code@uchirecipe.com>'
/** 返信先。購入者が「返信」したときに届く先(Resendの送信元アドレスは受信できないため必須)。 */
const REPLY_TO = 'uchiapplication@gmail.com'

const APP_URL = 'https://uchirecipe.com/'
const UNLOCK_GUIDE_URL = 'https://uchirecipe.com/about/unlock.html'
const CONTACT_EMAIL = 'uchiapplication@gmail.com'

/** 購入ページ(about/index.html)の精度開示と同じ一文。片方だけ変えないこと。 */
const ACCURACY_NOTICE =
  '栄養と食費の数字は、材料と分量から計算した概算です。調理による変化は反映していません。治療中の方・妊娠中の方の食事管理には使えません。'

export const CODE_EMAIL_SUBJECT = 'うちレシピ Pro版 解錠コード'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** メール本文(テキスト版)。件名・手順・精度開示は /success ページと同じ内容に揃えてある。 */
export function renderCodeEmailText(code: string): string {
  return `うちレシピ Pro版をご購入いただきありがとうございます。

解錠コード
${code}

入力の手順
1. うちレシピを開く→設定
2. 「Pro」→「購入と解錠」にこのコードを入力
3. 「解錠する」を押すと全機能が使えます

機種変更のときも同じコードで解錠できます。このメールは保管してください。

${ACCURACY_NOTICE}

うちレシピ: ${APP_URL}
画面つきの詳しい手順: ${UNLOCK_GUIDE_URL}
コードについて困ったときは ${CONTACT_EMAIL} までご連絡ください。
`
}

/** メール本文(HTML版)。外部リソース(画像・Webフォント)は読み込まない。 */
export function renderCodeEmailHtml(code: string): string {
  const safeCode = escapeHtml(code)
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:24px 16px;background:#faf5ec;color:#43362a;font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Noto Sans JP',sans-serif;line-height:1.7;">
<div style="max-width:420px;margin:0 auto;">
<div style="text-align:center;margin:0 0 16px;">
<img src="https://uchirecipe.com/apple-touch-icon.png" width="56" height="56" alt="うちレシピ" style="border-radius:12px;" />
<p style="margin:6px 0 0;font-weight:700;">うちレシピ</p>
</div>
<p style="margin:0 0 16px;">うちレシピ Pro版をご購入いただきありがとうございます。</p>
<p style="margin:0 0 8px;font-size:0.9rem;">解錠コード</p>
<div style="background:#ffffff;border:2px solid #cc3f01;border-radius:12px;padding:20px 12px;text-align:center;margin:0 0 20px;">
<span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:1.4rem;font-weight:700;letter-spacing:0.06em;word-break:break-all;color:#43362a;">${safeCode}</span>
</div>
<p style="margin:0 0 8px;font-weight:700;">入力の手順</p>
<ol style="padding-left:1.3em;margin:0 0 20px;">
<li style="margin-bottom:8px;">うちレシピを開く→設定</li>
<li style="margin-bottom:8px;">「Pro」→「購入と解錠」にこのコードを入力</li>
<li style="margin-bottom:8px;">「解錠する」を押すと全機能が使えます</li>
</ol>
<p style="background:#fffdf8;border-radius:8px;padding:12px;font-size:0.92rem;margin:0 0 20px;">機種変更のときも同じコードで解錠できます。このメールは保管してください。</p>
<p style="font-size:0.85rem;color:#6b5f52;margin:0 0 16px;">${escapeHtml(ACCURACY_NOTICE)}</p>
<p style="margin:0 0 8px;"><a href="${APP_URL}" style="color:#7a4f10;">うちレシピを開く</a></p>
<p style="margin:0 0 16px;"><a href="${UNLOCK_GUIDE_URL}" style="color:#7a4f10;">画面つきの詳しい手順</a></p>
<p style="font-size:0.85rem;color:#6b5f52;margin:0;">コードについて困ったときは ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
</div>
</body>
</html>
`
}

export type SendCodeEmailResult = 'sent' | 'send_failed'

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

/**
 * Resend APIで解錠コードのメールを1通送る。
 * 失敗しても例外は投げず 'send_failed' を返す(呼び出し側は割当済みを優先して200を返す)。
 *
 * idempotencyKey には Checkout Session id を渡す。Resend側でも同一キーの重複送信が
 * はじかれるため、KVの emailedAt 書き込みが間に合わなかった場合の二重送信も防げる。
 */
export async function sendCodeEmail(
  apiKey: string,
  to: string,
  code: string,
  idempotencyKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<SendCodeEmailResult> {
  try {
    const res = await fetchImpl(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `uchirecipe-code-${idempotencyKey}`,
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: REPLY_TO,
        subject: CODE_EMAIL_SUBJECT,
        text: renderCodeEmailText(code),
        html: renderCodeEmailHtml(code),
      }),
    })
    return res.ok ? 'sent' : 'send_failed'
  } catch {
    // ネットワーク障害・タイムアウト等。webhookは200で返し、Stripeの再送で再挑戦する。
    return 'send_failed'
  }
}
