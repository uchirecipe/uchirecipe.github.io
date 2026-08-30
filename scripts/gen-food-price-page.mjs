// 「食品と目安価格の一覧」ページ（public/about/foods.html）の生成スクリプト。
//
// 【再生成の手順】
//   export PATH="$HOME/.local/node/bin:$PATH"
//   npm run gen:foods        （= npx tsx scripts/gen-food-price-page.mjs）
//   → public/about/foods.html を上書きする。生成後は npm test（突き合わせテスト）と
//     npm run build を通すこと。
//
// 【この形にした理由】
// ページに載る数値は、アプリが実際に概算へ使っているマスタ2本そのままである必要がある。
//   ・栄養: src/logic/nutritionData.ts（scripts/build-nutrition.mjs が文科省の公式Excelから生成）
//   ・価格: src/data/priceDefaults.ts（PRICE_DEFAULTS）
// 表を手で書くと、マスタを直したときに必ず片方が古くなる（規約E-③の書き写し事故）。
// そのため表は一切手書きせず、マスタを import して機械生成する。
// public/about/foods.html を直接編集しないこと（次の生成で消える）。
//
// 【分類・並び】
// 見出しの分類は在庫チップ／買い物メモと同じ src/logic/pantryGroups.ts の6グループを使う
// （アプリの売り場順 SHOPPING_AISLE_ORDER と同じ並び）。グループ内は読みの五十音順にして
// 名前から引きやすくする。
//
// 【価格の対応づけ】
// 栄養食品に載せる目安価格は、価格マスタ側の名前が「かな正規化して完全一致」する行だけを使う
// （logic/priceEstimate.ts の照合と同じ正規化）。アプリの照合は前方一致のフォールバックも持つが、
// 「米酢 → 米」のような近似ヒットまで一覧に載せると、その食品の登録価格であるかのように読めて
// しまうため一覧では採らない。完全一致で使われなかった価格マスタの行は、ページ末尾の
// 「別の名前でも登録している目安価格」に全件出す（＝価格マスタ全件がページのどこかに必ず出る）。
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { NUTRITION_DATA } = await import('../src/logic/nutritionData.ts')
const { PRICE_DEFAULTS } = await import('../src/data/priceDefaults.ts')
const { buildPriceIndex, normalizeIngredientNameForPrice } = await import('../src/logic/priceEstimate.ts')
const { matchNutritionFood } = await import('../src/logic/nutrition.ts')
const { toHiragana } = await import('../src/logic/kana.ts')
const { categorizePantryName, SHOPPING_AISLE_ORDER } = await import('../src/logic/pantryGroups.ts')
const { ja } = await import('../src/i18n/ja.ts')

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'about', 'foods.html')

// ---------- データ組み立て ----------

const priceIndex = buildPriceIndex(PRICE_DEFAULTS.map((p) => ({ ...p, isDefault: true })))
const priceKey = (name) => toHiragana(normalizeIngredientNameForPrice(name))

/** その食品名で「かな完全一致」する価格マスタの行（無ければ undefined） */
function exactPrice(label) {
  const key = priceKey(label)
  return priceIndex.find((e) => e.matchKey === key)
}

const usedPriceNames = new Set()
const foodRows = NUTRITION_DATA.foods.map((food) => {
  const price = exactPrice(food.label)
  if (price) usedPriceNames.add(price.normalizedName)
  const aliases = [...food.aliases, ...(food.rawAliases ?? [])].filter((a) => a !== food.label)
  return {
    food,
    price,
    aliases: [...new Set(aliases)],
    group: categorizePantryName(food.label),
    sortKey: toHiragana(food.label),
  }
})

// 読みが同じもの（「みそ」と「味噌」等）はマスタの並び順のまま（Array.sortは安定ソート）
const byKana = (a, b) => a.sortKey.localeCompare(b.sortKey, 'ja')

/** 完全一致で使われなかった価格マスタの行（別名・書き方違いで登録してあるもの） */
const aliasPriceRows = PRICE_DEFAULTS.filter((p) => !usedPriceNames.has(p.name))
  .map((p) => ({ ...p, food: matchNutritionFood(p.name), sortKey: toHiragana(p.name) }))
  .sort(byKana)

const groups = SHOPPING_AISLE_ORDER.map((key) => ({
  key,
  label: ja.pantry.group[key],
  rows: foodRows.filter((r) => r.group === key).sort(byKana),
})).filter((g) => g.rows.length > 0)

// ---------- 整形 ----------

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 成分値の表示。gとmgは小数第1位まで、エネルギーとカルシウムは整数で揃える */
const dec1 = (v) => (Math.round(v * 10) / 10).toFixed(1)
const int0 = (v) => String(Math.round(v))

const priceText = (price) => `${price.pricePerUnit}円 / ${price.unit}`

// ---------- HTML ----------

const NUTRIENT_COLUMNS = [
  [ja.nutrition.kcalLabel, ja.nutrition.kcalUnit, (n) => int0(n.kcal)],
  [ja.nutrition.proteinLabel, 'g', (n) => dec1(n.proteinG)],
  [ja.nutrition.fatLabel, 'g', (n) => dec1(n.fatG)],
  [ja.nutrition.carbLabel, 'g', (n) => dec1(n.carbG)],
  [ja.nutrition.fiberLabel, 'g', (n) => dec1(n.fiberG)],
  ['食塩相当量', 'g', (n) => dec1(n.saltG)],
  [ja.nutrition.ironLabel, 'mg', (n) => dec1(n.ironMg)],
  [ja.nutrition.calciumLabel, 'mg', (n) => int0(n.calciumMg)],
]

function foodTable(group) {
  const head = NUTRIENT_COLUMNS.map(
    ([label, unit]) => `<th scope="col" class="n">${esc(label)}<span class="u">${esc(unit)}</span></th>`,
  ).join('')
  const body = group.rows
    .map((row) => {
      const alias = row.aliases.length > 0 ? `<span class="al">別名: ${esc(row.aliases.join('・'))}</span>` : ''
      const price = row.price
        ? `<td class="p">${esc(priceText(row.price))}</td>`
        : '<td class="p none">価格なし</td>'
      const cells = NUTRIENT_COLUMNS.map(([, , get]) => `<td class="n">${get(row.food.per100g)}</td>`).join('')
      return `        <tr><th scope="row" class="nm">${esc(row.food.label)}${alias}</th>${price}${cells}<td class="src">${esc(row.food.mextName)}</td></tr>`
    })
    .join('\n')
  return `      <thead>
        <tr><th scope="col" class="nm">食品名</th><th scope="col" class="p">目安価格</th>${head}<th scope="col" class="src">成分表の収載名</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>`
}

function aliasTable() {
  const body = aliasPriceRows
    .map(
      (row) =>
        `        <tr><th scope="row" class="nm">${esc(row.name)}</th><td class="p">${esc(priceText(row))}</td><td class="ref">${row.food ? esc(row.food.label) : '該当なし'}</td></tr>`,
    )
    .join('\n')
  return `      <thead>
        <tr><th scope="col" class="nm">食品名</th><th scope="col" class="p">目安価格</th><th scope="col" class="ref">栄養の計算に使う食品</th></tr>
      </thead>
      <tbody>
${body}
      </tbody>`
}

const sections = groups
  .map(
    (g) => `  <section class="cat" id="cat-${g.key}">
    <h2>${esc(g.label)}<span class="cat__n">${g.rows.length}件</span></h2>
    <div class="scroll" tabindex="0" role="group" aria-label="${esc(g.label)}の食品データ">
    <table class="fd">
${foodTable(g)}
    </table>
    </div>
  </section>`,
  )
  .join('\n\n')

const jump = [
  ...groups.map((g) => `<li><a href="#cat-${g.key}">${esc(g.label)}</a></li>`),
  '<li><a href="#alias">別の名前でも登録している目安価格</a></li>',
].join('\n      ')

const priceCount = PRICE_DEFAULTS.length
const foodCount = NUTRITION_DATA.foods.length

const html = `<!doctype html>
<!-- このファイルは自動生成です。手で編集しないこと。生成: npm run gen:foods (scripts/gen-food-price-page.mjs) -->
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>食品と目安価格の一覧｜うちレシピ</title>
<meta name="description" content="レシピ帳アプリ「うちレシピ」が栄養と食費の概算に使っている食品データ${foodCount}件と、食材の目安価格${priceCount}件の一覧です。栄養値は日本食品標準成分表（八訂）増補2023年の可食部100gあたりの数値です。">
<meta property="og:title" content="食品と目安価格の一覧｜うちレシピ">
<meta property="og:description" content="うちレシピが栄養と食費の概算に使っている食品データ${foodCount}件と、食材の目安価格${priceCount}件の一覧です。">
<meta property="og:type" content="article">
<meta property="og:url" content="https://uchirecipe.com/about/foods.html">
<meta property="og:image" content="https://uchirecipe.com/ogp.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://uchirecipe.com/about/foods.html">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<style>
  :root {
    --bg: #faf5ec;
    --text: #43362a;
    /* 塗り用のアクセント(ボタン地・CTA・注記の左罫)。2026-08-02 オーナー確定で
       #d9480f → #cc3f01。旧色はこの地に生成りの文字を載せると3.96:1でAAに届かず、
       新色は4.52:1で満たす(色みの差はごくわずか) */
    --accent: #cc3f01;
    /* 文字として使うアクセント(2026-07-30 オーナー承認・docs/色調整見本.html
       → 2026-08-02 面別トークンに拡張・docs/色調整見本2_ブラウングリーン.html)。
       塗りのオレンジは面の上で明るすぎて通常サイズの文字がAAに届かないため文字用を分けている。
       アプリ本体(app/src/index.css)と同じく「載る面」で値を持つ構造に揃える:
         --accent-ink-page    ページ背景(--bg #faf5ec)の上   #b8380a → 5.36:1
         --accent-ink-surface カード面(--surface #fffdf8)の上 #b8380a → 5.73:1
       この静的ページはライト/ダークの2テーマだけなので両方とも同じ値になる
       (面で色が分かれるのはアプリのブラウンテーマだけ)。
       使う側は --accent-ink 1つだけを見ればよく、カード面を塗るルール
       (background: var(--surface))の中でカード面用の値に差し替えている */
    --accent-ink-page: #b8380a;
    --accent-ink-surface: #b8380a;
    --accent-ink: var(--accent-ink-page);
    --surface: #fffdf8;
    /* 補足テキスト(2026-07-30)。旧#8c7b69は3.75:1/4.01:1でAA未達だった。
       本文#43362aとの明度差を保ちつつAAを満たす値: ページ背景上4.77:1 / カード面上5.10:1 */
    --text-muted: #7c6a56;
    --border: #e9dfd0;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #211a13;
      --text: #f1e8db;
      --accent: #ff8a4c;
      /* ダークは現行で7.36:1あり基準を満たしているため文字用も同色=見た目不変。
         2026-08-02の面別化でもページ背景の上・カード面の上とも同値＝ダークは一切変えない */
      --accent-ink-page: #ff8a4c;
      --accent-ink-surface: #ff8a4c;
      --surface: #2c241b;
      --text-muted: #a89680;
      --border: #3d3327;
    }
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; scroll-padding-top: 12px; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
  }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    line-height: 1.8;
  }
  main {
    max-width: 856px;
    margin: 0 auto;
    padding: 24px 16px 48px;
  }
  header {
    text-align: center;
    padding: 8px 0 4px;
  }
  header img { width: 56px; height: 56px; }
  header p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
    font-weight: bold;
  }
  h1 {
    font-size: 22px;
    line-height: 1.6;
    margin: 24px 0 8px;
  }
  .lead {
    font-size: 15.5px;
    margin: 0 0 16px;
  }
  h2 {
    font-size: 19px;
    line-height: 1.6;
    margin: 40px 0 12px;
    padding-top: 20px;
    border-top: 1px solid var(--border);
  }
  .cat__n {
    margin-left: 10px;
    font-size: 13px;
    font-weight: normal;
    color: var(--text-muted);
  }
  p { font-size: 15.5px; margin: 0 0 16px; }
  a { color: var(--accent-ink); }
  .muted { color: var(--text-muted); font-size: 13.5px; }
  .note {
    background: var(--surface);
    --accent-ink: var(--accent-ink-surface);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    border-radius: 10px;
    padding: 14px 16px;
    margin: 0 0 20px;
  }
  .note ul { margin: 0; padding-left: 1.2em; }
  .note li { font-size: 14.5px; margin-bottom: 8px; line-height: 1.75; }
  .note li:last-child { margin-bottom: 0; }
  .jump {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }
  .jump a {
    display: inline-block;
    padding: 6px 12px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface);
    --accent-ink: var(--accent-ink-surface);
    color: var(--accent-ink);
    font-size: 13px;
    font-weight: bold;
    line-height: 1.4;
    text-decoration: none;
  }
  /* ===== 一覧表 ===== */
  .scroll {
    overflow-x: auto;
    background: var(--surface);
    --accent-ink: var(--accent-ink-surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  table.fd {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;
    line-height: 1.5;
  }
  table.fd th,
  table.fd td {
    padding: 6px 8px;
    text-align: left;
    vertical-align: top;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
  }
  table.fd tbody tr:last-child th,
  table.fd tbody tr:last-child td { border-bottom: none; }
  table.fd thead th {
    background: var(--bg);
    font-size: 12px;
    font-weight: bold;
  }
  table.fd .u {
    display: block;
    font-size: 11px;
    font-weight: normal;
    color: var(--text-muted);
  }
  /* 食品名は横スクロールしても左に残す(数値がどの食品のものか見失わないため) */
  table.fd th.nm {
    position: sticky;
    left: 0;
    z-index: 1;
    min-width: 6.5em;
    max-width: 9.5em;
    white-space: normal;
    background: var(--surface);
    border-right: 1px solid var(--border);
    font-weight: bold;
  }
  table.fd thead th.nm { background: var(--bg); z-index: 2; }
  table.fd .al {
    display: block;
    font-size: 11px;
    font-weight: normal;
    line-height: 1.5;
    color: var(--text-muted);
  }
  table.fd .p { font-weight: bold; }
  table.fd .p.none { font-weight: normal; color: var(--text-muted); }
  table.fd td.n { text-align: right; font-variant-numeric: tabular-nums; }
  table.fd th.n { text-align: right; }
  table.fd .src, table.fd td.ref { color: var(--text-muted); font-size: 12px; }
  /* 収載名は長い(「＜鳥肉類＞ にわとり ［若どり・主品目］ もも 皮つき 生」等)。
     折り返さないと表の幅が食品名の何倍にもなり、横スクロールの大半が余白になる */
  table.fd td.src { white-space: normal; min-width: 11em; max-width: 13em; line-height: 1.45; }
  table.fd thead th.src, table.fd thead th.ref { color: var(--text); }
  .back {
    display: block;
    text-align: center;
    margin-top: 32px;
    color: var(--accent-ink);
    font-weight: bold;
    text-decoration: none;
  }
  footer {
    margin-top: 28px;
    text-align: center;
    font-size: 12px;
    color: var(--text-muted);
  }
  footer a { color: var(--text-muted); text-decoration: underline; }
  footer span.sep { margin: 0 8px; }
</style>
</head>
<body>
<main>
  <header>
    <img src="/icon.svg" alt="" aria-hidden="true">
    <p>うちレシピ</p>
  </header>

  <h1>食品と目安価格の一覧</h1>
  <p class="lead">うちレシピが栄養と食費の概算に使っている、食品データ${foodCount}件と食材の目安価格${priceCount}件です。</p>

  <div class="note">
    <ul>
      <li>栄養値は文部科学省「<a href="${esc(NUTRITION_DATA.sourcePage)}" target="_blank" rel="noopener">${esc(NUTRITION_DATA.source)}</a>」の可食部100gあたりの数値です。</li>
      <li>価格は地域・季節・店で変わります。アプリでは、普段よく買う商品の実際の価格に置き換えられます（設定の「食材と価格を編集する」）。</li>
      <li>レシピに表示する栄養と食費は、一覧にある数値と材料の分量から自動計算した概算です。調理による変化は反映していません。</li>
    </ul>
  </div>

  <ul class="jump">
      ${jump}
  </ul>
  <p class="muted">分類はアプリの買い物メモの売り場順、並びは読みの五十音順です。</p>

${sections}

  <section class="cat" id="alias">
    <h2>別の名前でも登録している目安価格<span class="cat__n">${aliasPriceRows.length}件</span></h2>
    <p>レシピの材料名の書き方に合わせて、同じ食品を別の名前でも登録しています。栄養は「栄養の計算に使う食品」の値で計算します。</p>
    <div class="scroll" tabindex="0" role="group" aria-label="別の名前でも登録している目安価格">
    <table class="fd">
${aliasTable()}
    </table>
    </div>
  </section>

  <p class="muted">目安価格を入れていない食品は「価格なし」と書いています。設定の「食材と価格を編集する」から追加できます。</p>

  <a class="back" href="/about/manual.html#nutrition">← 使い方（栄養と食費）に戻る</a>

  <footer>
    <a href="/about/">うちレシピについて</a>
    <span class="sep">|</span>
    <a href="/about/manual.html">使い方</a>
    <span class="sep">|</span>
    <a href="/about/terms.html">利用規約・プライバシーポリシー</a>
  </footer>
</main>
<!-- Cloudflare Web Analytics -->
    <!-- 2026-08-30: 本番のドメインでだけ鳴らす。
         それまでは localhost（開発サーバー・プレビュー・e2e）からも同じトークンで送っており、
         Cloudflare の画面で **localhost/ が最も多いURL**になっていた（フルe2eは1回で733回ページを開く）。
         数字が読めないと「訪問が少ないのか、訴求が弱いのか」の切り分けができない。 -->
    <script>
      if (location.hostname === 'uchirecipe.com') {
        var cfBeacon = document.createElement('script')
        cfBeacon.defer = true
        cfBeacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
        cfBeacon.setAttribute('data-cf-beacon', '{"token": "9386f480590d44cdae47f8526841e1ab"}')
        document.head.appendChild(cfBeacon)
      }
    </script>
<!-- End Cloudflare Web Analytics -->
<!-- アプリから来たときだけ「← うちレシピに戻る」を出す（2026-08-28 便LW）。
     中身は public/about/app-return.js（11ページで共有・書き写しを作らない） -->
<script defer src="/about/app-return.js"></script>
</body>
</html>
`

writeFileSync(OUT, html, 'utf-8')
console.log(
  `public/about/foods.html を生成: 食品${foodCount}件（うち目安価格つき${foodRows.filter((r) => r.price).length}件）・` +
    `価格マスタ${priceCount}件（別名として掲載${aliasPriceRows.length}件）・分類${groups.length}種`,
)
