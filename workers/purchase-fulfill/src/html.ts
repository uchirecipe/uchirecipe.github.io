/**
 * GET /success が返す日本語HTMLページ群。スマホ縦画面前提・インラインCSSのみ(外部リソース無し)。
 * 表示するコード以外に外部/ユーザー入力由来の値は一切埋め込まない
 * (session_idはXSS対策のためどのページにも出力しない。不正なsession_idでも安全)。
 *
 * 2026-08-03 ブランド統一(オーナー指摘「うちレシピのマークがない・配色もうちレシピっぽくない」):
 * - ページ上部にうちレシピの正式アイコン(public/icon.svg)をインラインSVGで表示する。
 *   Worker単体で表示が完結するよう外部URLは参照しない(faviconも同じSVGのdata URI)。
 * - 配色は public/about/index.html のライト/ダークのトークン値をそのまま書き写した
 *   (アプリ本体 src/index.css と同系)。色を変えるときは about 側の全ファイルと一緒に直す。
 * 導線・文言・コードの視認性(大きい等幅表示とコピーボタン)は変更していない。
 */

const APP_URL = 'https://uchirecipe.com/'
const CONTACT_EMAIL = 'uchiapplication@gmail.com'
const UNLOCK_GUIDE_URL = 'https://uchirecipe.com/about/unlock.html'

/**
 * うちレシピの正式アイコン(public/icon.svg のパスをそのまま写したもの)。
 * トマトオレンジ(#d9480f = PWAアイコンと同じブランド色)地に、クリーム色のふた付き鍋と湯気3本。
 * ここに直接埋め込むのは、Workerが画像URL(uchirecipe.com側)に依存せず単体で表示を完結させるため。
 * アイコンを差し替えるときは public/icon.svg と合わせてこの定数も更新する。
 */
const BRAND_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080" role="img" aria-label="うちレシピ" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:1.5">' +
  '<g transform="matrix(1.11707,0,0,1.1207,-67.8479,-66.3879)">' +
  '<path d="M816.831,59.238C933.208,59.238 1027.55,153.275 1027.55,269.275L1027.55,812.886C1027.55,928.886 933.208,1022.92 816.831,1022.92L271.456,1022.92C155.079,1022.92 60.737,928.886 60.737,812.886L60.737,269.275C60.737,153.275 155.079,59.238 271.456,59.238L816.831,59.238Z" style="fill:#d9480f"/>' +
  '</g>' +
  '<g transform="matrix(1,0,0,1,0.16656,1.5635)">' +
  '<path d="M564.752,422.292C839.128,426.299 817.129,497.042 817.129,497.042L262.538,497.042C262.538,497.042 240.538,426.299 514.915,422.292C511.598,417.447 509.658,411.587 509.658,405.277C509.658,388.623 523.179,375.101 539.833,375.101C556.488,375.101 570.009,388.623 570.009,405.277C570.009,411.587 568.068,417.447 564.752,422.292ZM426.983,853.486C336.163,853.486 262.538,779.861 262.538,689.041L262.538,582.994C257.772,587.931 251.086,591.001 243.682,591.001L185.286,591.001C170.813,591.001 159.08,579.268 159.08,564.794L159.08,559.151C159.08,544.677 170.813,532.944 185.286,532.944L243.682,532.944C251.086,532.944 257.772,536.014 262.538,540.951L262.538,515.581L817.129,515.581L817.129,540.951C821.895,536.014 828.581,532.944 835.985,532.944L894.38,532.944C908.854,532.944 920.587,544.677 920.587,559.151L920.587,564.794C920.587,579.268 908.854,591.001 894.38,591.001L835.985,591.001C828.581,591.001 821.895,587.931 817.129,582.994L817.129,689.041C817.129,779.861 743.504,853.486 652.683,853.486L652.35,853.486L427.317,853.486L426.983,853.486Z" style="fill:#fffdf8"/>' +
  '</g>' +
  '<g>' +
  '<g transform="matrix(1,0,0,0.904133,0,31.7384)">' +
  '<path d="M540,218.765C540,218.765 506.513,279.047 540,331.069" style="fill:none;stroke:#fffdf8;stroke-width:43.03px"/>' +
  '</g>' +
  '<g transform="matrix(1,0,0,0.904133,-127.157,31.7384)">' +
  '<path d="M540,218.765C540,218.765 506.513,279.047 540,331.069" style="fill:none;stroke:#fffdf8;stroke-width:43.03px"/>' +
  '</g>' +
  '<g transform="matrix(1,0,0,0.904133,125.316,31.7384)">' +
  '<path d="M540,218.765C540,218.765 506.513,279.047 540,331.069" style="fill:none;stroke:#fffdf8;stroke-width:43.03px"/>' +
  '</g>' +
  '</g>' +
  '</svg>'

/** favicon。ページ上部のアイコンと同じSVGをdata URI化したもの(外部ファイルを取りに行かせない)。 */
const FAVICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BRAND_ICON_SVG)}`

/** ページ上部のブランド表示(about/index.html のヘッダーと同じ「アイコン+うちレシピ」)。 */
const BRAND_HEADER_HTML = `<header class="brand">
<span class="brand-mark">${BRAND_ICON_SVG}</span>
<p class="brand-name">うちレシピ</p>
</header>`

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function pageShell(title: string, bodyHtml: string, scriptHtml = ''): string {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}｜うちレシピ Pro版</title>
<link rel="icon" href="${FAVICON_DATA_URI}" type="image/svg+xml" />
<style>
  /* 配色は public/about/index.html と同じトークン値(アプリ本体 src/index.css と同系)。
     ライト/ダークの2テーマだけなので、面別の文字用アクセントは両方とも同値になる。 */
  :root {
    color-scheme: light dark;
    --bg: #faf5ec;
    --text: #43362a;
    --accent: #cc3f01;
    --accent-ink-page: #b8380a;
    --accent-ink-surface: #b8380a;
    --accent-ink: var(--accent-ink-page);
    --surface: #fffdf8;
    --text-muted: #7c6a56;
    --border: #e9dfd0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #211a13;
      --text: #f1e8db;
      --accent: #ff8a4c;
      --accent-ink-page: #ff8a4c;
      --accent-ink-surface: #ff8a4c;
      --surface: #2c241b;
      --text-muted: #a89680;
      --border: #3d3327;
    }
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 20px 16px 40px;
    font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.8;
  }
  main { max-width: 420px; margin: 0 auto; }
  /* ページ上部のブランド表示(about/index.html の header.page と同じ形) */
  .brand { max-width: 420px; margin: 0 auto; text-align: center; padding: 4px 0 0; }
  .brand-mark svg { display: block; width: 56px; height: 56px; margin: 0 auto; }
  .brand-name {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: bold;
  }
  h1 { font-size: 1.25rem; line-height: 1.45; margin: 14px 0 12px; text-align: center; }
  p { margin: 0 0 16px; }
  .code-box {
    background: var(--surface);
    --accent-ink: var(--accent-ink-surface);
    border: 2px solid var(--accent);
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
    color: var(--text);
  }
  .copy-btn {
    display: block;
    width: 100%;
    margin: 0 0 24px;
    padding: 12px;
    font-size: 1rem;
    font-weight: bold;
    border-radius: 10px;
    border: 1px solid var(--accent);
    background: var(--surface);
    color: var(--accent-ink-surface);
  }
  .copy-btn:active { background: var(--bg); }
  ol { padding-left: 1.3em; margin: 0 0 20px; }
  li { margin-bottom: 8px; }
  /* about/index.html の .note と同じ形(左にアクセントの罫)。あちらはカード面の中に置くので
     地が --bg、こちらはページ背景の上に直接置くので地を --surface にしている */
  .warn {
    background: var(--surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 0.92rem;
  }
  .btn {
    display: block;
    text-align: center;
    margin-top: 24px;
    padding: 16px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--bg);
    text-decoration: none;
    font-weight: bold;
    box-shadow: 0 4px 14px rgba(67, 54, 42, 0.12);
  }
  .contact { font-size: 0.85rem; color: var(--text-muted); margin-top: 24px; }
  .guide-link { text-align: center; font-size: 0.9rem; margin: 14px 0 20px; }
  .guide-link a { color: var(--accent-ink); text-decoration: underline; }
</style>
</head>
<body>
${BRAND_HEADER_HTML}
<main>
${bodyHtml}
</main>
${scriptHtml}</body>
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
  <li>うちレシピを開く→設定</li>
  <li>「購入と解錠」にこのコードを入力</li>
  <li>「解錠する」を押すと全機能が使えます</li>
</ol>
<p class="warn">このコードは大切に保管してください。このページは後から開き直せない場合があります(機種変更のときも、同じコードをもう一度入力すれば使えます)。</p>
<a class="btn" href="${escapeHtml(APP_URL)}">うちレシピを開く</a>
<p class="guide-link"><a href="${escapeHtml(UNLOCK_GUIDE_URL)}" target="_blank" rel="noopener">画像付きの詳しい使い方はこちら（新しいタブで開きます）</a></p>
<p class="contact">コードについて困ったときは ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
`,
    `<script>
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

/**
 * コードプールが空だった場合のページ。
 * 2026-08-03: 購入者に連絡を催促する文面(「担当者が確認しております・ご連絡ください」)をやめ、
 * こちらから送る前提の案内に変更(オーナー指示「購入者に連絡を催促するのではなく、コードが
 * 自動でメールなどで届くように」)。在庫切れ時の追送自体は在庫補充後の手動対応。
 */
export function renderOutOfStockPage(): string {
  return pageShell(
    'コードの準備中です',
    `
<h1>コードの準備中です</h1>
<p>ご購入ありがとうございます。ただいまコードの在庫を切らしています。確認のうえ、ご購入時のメールアドレスにコードをお送りします。</p>
<p class="warn">1日たってもメールが届かない場合は ${escapeHtml(CONTACT_EMAIL)} までご連絡ください。</p>
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
