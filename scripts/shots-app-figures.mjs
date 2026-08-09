// アプリ本体(src/)の画面に載せる説明図を作るスクリプト(2026-08-10 便EW)。
//
// 使い方:
//   npx tsx scripts/shots-app-figures.mjs
//   ONLY=home-screen-icon npx tsx scripts/shots-app-figures.mjs   (指定した図だけ作り直す)
//
// scripts/shots-install.mjs と作り方は同じ(HTML+CSS+インラインSVGで組み立て、Playwrightで
// 描画してwebpに書き出す。外部の素材・実機のスクリーンショットは使っていない)。
// 別ファイルに分けてあるのは書き出し先が違うため:
//   shots-install.mjs … public/about/img/install/  (紹介サイトの説明ページに載せる図)
//   このファイル       … public/img/               (アプリ本体が読む図)
// アプリ本体が読む図を public/about/img/ に置くと、Service Workerの事前キャッシュ対象から
// 外れている(vite.config.ts の workbox.globIgnores = ['about/img/**'])ため、電波の無い
// 場所で図だけ出ないことがある。public/img/ は事前キャッシュに入る。
//
// 出力: public/img/*.webp (幅340CSSpx・2倍解像度 = 680px)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/img')
fs.mkdirSync(OUT_DIR, { recursive: true })

const ONLY = new Set(
  (process.env.ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const want = (name) => ONLY.size === 0 || ONLY.has(name)

const APP_ICON = `data:image/svg+xml;base64,${fs
  .readFileSync(path.join(ROOT, 'public/icon.svg'))
  .toString('base64')}`

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fffdf8}
#fig{
  position:relative;width:340px;overflow:hidden;background:#fffdf8;
  font-family:-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif;
  color:#43362a;line-height:1.5;-webkit-font-smoothing:antialiased;
}

/* スマートフォンの上半分。下は切り落として「画面の続きがある」ように見せる
   (全体を入れると縦に長くなりすぎ、お知らせの窓に収まらない) */
.phone{
  width:264px;margin:10px auto 0;padding:8px 8px 0;background:#3a3a3e;
  border-radius:30px 30px 0 0
}
.screen{
  border-radius:23px 23px 0 0;overflow:hidden;
  /* 壁紙。install.htmlの「追加したあとの姿」の図と同じ配色に揃える */
  background:linear-gradient(160deg,#c9d3de,#e0d4c2)
}

/* 時刻と電波・電池(形だけ。読ませるものではない) */
.status{display:flex;align-items:center;justify-content:space-between;padding:7px 16px 2px}
.status .clock{font-size:10.5px;font-weight:bold;color:#2c2c2e}
.status .marks{display:flex;align-items:center;gap:3px}
.status .bar{width:3px;border-radius:1px;background:#2c2c2e}
.status .batt{width:16px;height:8px;border:1.2px solid #2c2c2e;border-radius:2.5px;position:relative}
.status .batt::after{content:"";position:absolute;inset:1.5px;right:5px;background:#2c2c2e;border-radius:1px}

.apps{display:flex;justify-content:space-between;padding:10px 12px 0}
.app{width:54px;text-align:center}
.app .sq{width:52px;height:52px;border-radius:13px;background:rgba(255,255,255,.5);margin:0 auto;display:block}
.app img.sq{background:none}
/* うちレシピ以外のアイコンは「他のアプリ」を表す無地の板。うっすら濃さを変えて並びに変化を出す */
.app .sq.b{background:rgba(255,255,255,.62)}
.app .sq.c{background:rgba(255,255,255,.4)}
.app .nm{margin-top:5px;font-size:10.5px;color:#2c2c2e;font-weight:bold}
.app .nm.ph{height:7px;border-radius:4px;background:rgba(255,255,255,.6);margin:8px auto 0;width:34px}
.row2{padding-bottom:14px}
`

const wrap = (inner) =>
  `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="fig">${inner}</div></body></html>`

const blank = (tone = '') => `<div class="app"><span class="sq ${tone}"></span><div class="nm ph"></div></div>`

const FIGURES = {
  // ホーム画面に「うちレシピ」のアイコンが並んでいる姿(アプリ内の初回お知らせで使う)。
  // 色が付いているのは うちレシピ のアイコンだけ＝どれのことか一目で分かる
  'home-screen-icon': `
    <div class="phone">
      <div class="screen">
        <div class="status">
          <span class="clock">18:30</span>
          <span class="marks">
            <span class="bar" style="height:5px"></span>
            <span class="bar" style="height:7px"></span>
            <span class="bar" style="height:9px"></span>
            <span class="batt"></span>
          </span>
        </div>
        <div class="apps">
          ${blank()}
          <div class="app"><img class="sq" src="${APP_ICON}" alt=""><div class="nm">うちレシピ</div></div>
          ${blank('b')}
          ${blank('c')}
        </div>
        <div class="apps row2">
          ${blank('c')}
          ${blank()}
          ${blank('b')}
          ${blank()}
        </div>
      </div>
    </div>`,
}

async function save(png, name) {
  const meta = await sharp(png).metadata()
  const webp = await sharp(png).webp({ quality: 92, effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${name}.webp`), webp)
  console.log(`  ${name}.webp  ${meta.width}x${meta.height}  ${(webp.length / 1024).toFixed(1)}KB`)
}

const browser = await chromium.launch()
const context = await browser.newContext({
  deviceScaleFactor: 2,
  viewport: { width: 420, height: 900 },
})
const page = await context.newPage()
try {
  for (const [name, inner] of Object.entries(FIGURES)) {
    if (!want(name)) continue
    await page.setContent(wrap(inner), { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(120)
    await save(await page.locator('#fig').screenshot(), name)
  }
} finally {
  await browser.close()
}
console.log('図の書き出しが終わりました →', OUT_DIR)
