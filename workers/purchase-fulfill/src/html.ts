/**
 * GET /success が返す日本語HTMLページ群。スマホ縦画面前提・インラインCSSのみ(外部リソース無し)。
 * 表示するコード以外に外部/ユーザー入力由来の値は一切埋め込まない
 * (session_idはXSS対策のためどのページにも出力しない。不正なsession_idでも安全)。
 */

const APP_URL = 'https://uchirecipe.com/'
const CONTACT_EMAIL = 'hapillust@gmail.com'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pageShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} - うちレシピ</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px 16px 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Noto Sans JP", sans-serif;
    background: #faf7f2;
    color: #2b2420;
    line-height: 1.7;
  }
  main { max-width: 420px; margin: 0 auto; }
  h1 { font-size: 1.25rem; margin: 0 0 12px; }
  p { margin: 0 0 16px; }
  .code-box {
    background: #fff;
    border: 2px solid #d9a441;
    border-radius: 12px;
    padding: 20px 12px;
    text-align: center;
    margin: 0 0 12px;
  }
  .code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 1.6rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    word-break: break-all;
    color: #2b2420;
  }
  .copy-btn {
    display: block;
    width: 100%;
    margin: 0 0 24px;
    padding: 12px;
    font-size: 1rem;
    border-radius: 10px;
    border: 1px solid #d9a441;
    background: #fff;
    color: #7a4f10;
  }
  .copy-btn:active { background: #f5e9d3; }
  ol { padding-left: 1.3em; margin: 0 0 20px; }
  li { margin-bottom: 8px; }
  .warn {
    background: #fff3e0;
    border-radius: 8px;
    padding: 12px;
    font-size: 0.92rem;
  }
  .btn {
    display: block;
    text-align: center;
    margin-top: 24px;
    padding: 14px;
    border-radius: 10px;
    background: #d9a441;
    color: #fff;
    text-decoration: none;
    font-weight: 700;
  }
  .contact { font-size: 0.85rem; color: #6b5f52; margin-top: 24px; }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1a16; color: #f0e9df; }
    .code-box { background: #2a241d; border-color: #d9a441; }
    .code { color: #f0e9df; }
    .copy-btn { background: #2a241d; color: #e8c477; }
    .copy-btn:active { background: #3a3225; }
    .warn { background: #3a2f1a; color: #f0e9df; }
    .contact { color: #b3a898; }
  }
</style>
</head>
<body>
<main>
${bodyHtml}
</main>
</body>
</html>
`
}

/** 決済確認済み・コード払い出し成功ページ。 */
export function renderSuccessPage(code: string): string {
  const safeCode = escapeHtml(code)
  return pageShell(
    'ご購入ありがとうございます',
    `
<h1>ご購入ありがとうございます</h1>
<p>うちレシピの解錠コードです。</p>
<div class="code-box"><span class="code" id="unlock-code">${safeCode}</span></div>
<button type="button" class="copy-btn" id="copy-btn" onclick="copyUnlockCode()">コードをコピーする</button>
<ol>
  <li>うちレシピを開く</li>
  <li>「設定」→「購入と解錠」を開く</li>
  <li>このコードを入力すると全機能が使えます</li>
</ol>
<p class="warn">このコードは大切に保管してください。このページは後から開き直せない場合があります。</p>
<a class="btn" href="${escapeHtml(APP_URL)}">うちレシピを開く</a>
<p class="contact">コードについて困ったときは ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
</main>
<script>
function copyUnlockCode() {
  var code = document.getElementById('unlock-code').textContent;
  var btn = document.getElementById('copy-btn');
  function done(ok) { if (btn) btn.textContent = ok ? 'コピーしました' : 'コピーできませんでした(手動で選択してください)'; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code).then(function () { done(true); }, function () { done(false); });
  } else {
    done(false);
  }
}
</script>
`,
  )
}

/** まだ支払いが確認できない場合のページ(status/payment_statusが未完了)。 */
export function renderNotPaidPage(): string {
  return pageShell(
    'お支払いを確認できませんでした',
    `
<h1>まだお支払いが確認できません</h1>
<p>決済が完了していないか、確認にもう少し時間がかかっている可能性があります。少し時間をおいてこのページを再読み込みしてください。</p>
<p class="warn">状況が変わらない場合は ${escapeHtml(CONTACT_EMAIL)} までご連絡ください(いつ購入されたか分かる情報を添えていただけると助かります)。</p>
<a class="btn" href="${escapeHtml(APP_URL)}">うちレシピを開く</a>
`,
  )
}

/** コードプールが空だった場合のページ。 */
export function renderOutOfStockPage(): string {
  return pageShell(
    'コードの準備中です',
    `
<h1>コードの準備中です</h1>
<p>ご購入ありがとうございます。ただいまコードの在庫を切らしており、担当者が確認しております。</p>
<p class="warn">お手数ですが ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。折り返しコードをお送りします。</p>
`,
  )
}

/** session_id不正・Stripe照合失敗など、安全側で拒否する場合の汎用ページ。 */
export function renderInvalidPage(): string {
  return pageShell(
    'ご購入内容を確認できませんでした',
    `
<h1>ご購入内容を確認できませんでした</h1>
<p>このページのリンクが正しくないか、期限切れの可能性があります。決済完了後の画面から改めてお試しください。</p>
<p class="warn">解決しない場合は ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
`,
  )
}

/** Stripe API呼び出しの失敗など、一時的なエラーの場合のページ。 */
export function renderTemporaryErrorPage(): string {
  return pageShell(
    '確認できませんでした',
    `
<h1>確認できませんでした</h1>
<p>只今、確認処理が混み合っているか、一時的な不具合が発生している可能性があります。少し時間をおいてこのページを再読み込みしてください。</p>
<p class="warn">繰り返し表示される場合は ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
`,
  )
}
