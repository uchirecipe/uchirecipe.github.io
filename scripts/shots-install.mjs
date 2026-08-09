// 「ホーム画面に追加する方法」ページ(public/about/install.html)に載せる説明図を作るスクリプト。
//
// 使い方:
//   npx tsx scripts/shots-install.mjs
//   ONLY=ios-share,ios-sheet npx tsx scripts/shots-install.mjs   (指定した図だけ作り直す)
//
// 他のスクショ用スクリプト(shots-lp.mjs / shots-manual.mjs)との違い:
//  - あちらは実際のアプリ画面を撮る。こちらが説明したいのは「iPhoneやAndroidのブラウザの
//    どのボタンを押すか」で、実機の画面を撮る手段がない。そこでブラウザのUIを模した図を
//    HTML+CSS+インラインSVGで組み立て、Playwrightで描画して画像にしている。
//    外部の素材・スクリーンショットは一切使っていない(全部このファイルの中で描いている)。
//  - サーバーを立てる必要はない(page.setContentで組み立てたHTMLを描画するだけ)。
//    アプリのアイコンだけは public/icon.svg を読み込んでdata URIとして埋め込む。
//  - 押す場所は「アクセント色の枠」と「三角つきのラベル」で示す。
//
// 出力: public/about/img/install/*.webp (幅340CSSpx・2倍解像度 = 680px)

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/about/img/install')
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

// ---- インラインSVGのアイコン(全部ここで描いている) ------------------------------
const PATHS = {
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  // iOSの共有マーク: 四角から上向きの矢印が出ている形
  share:
    '<path d="M12 3.2v11.3"/><path d="M8.2 7l3.8-3.8L15.8 7"/><path d="M5.6 11.6v7.6c0 1 .8 1.8 1.8 1.8h9.2c1 0 1.8-.8 1.8-1.8v-7.6"/>',
  book: '<path d="M12 7c-1.9-1.7-4.4-2.5-6.9-2.3a1 1 0 0 0-.9 1v10.9a1 1 0 0 0 1.1 1c2.4-.2 4.8.6 6.7 2.2"/><path d="M12 7c1.9-1.7 4.4-2.5 6.9-2.3a1 1 0 0 1 .9 1v10.9a1 1 0 0 1-1.1 1c-2.4-.2-4.8.6-6.7 2.2"/><path d="M12 7v12.8"/>',
  tabs: '<rect x="3.5" y="7.5" width="11" height="11" rx="2.5"/><rect x="9.5" y="5.5" width="11" height="11" rx="2.5"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 3.6V8h-4.4"/>',
  plusSquare: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8.2v7.6M8.2 12h7.6"/>',
  copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.5"/><path d="M15.5 5.5h-9a2 2 0 0 0-2 2v9"/>',
  bookmark: '<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.4L5.5 20.5v-16a1 1 0 0 1 1-1z"/>',
  glasses:
    '<circle cx="6.5" cy="14.5" r="3.5"/><circle cx="17.5" cy="14.5" r="3.5"/><path d="M10 14.5h4"/><path d="M3 12l2-5.5M21 12l-2-5.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/>',
  download: '<path d="M12 3.5v11"/><path d="M8 10.5l4 4 4-4"/><path d="M4.5 19.5h15"/>',
  star: '<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8z"/>',
  // パソコンのブラウザに出るインストールのマーク: 画面に下向き矢印
  install:
    '<rect x="3.5" y="4.5" width="17" height="12.5" rx="2.5"/><path d="M12 7.5v5.2M9.6 10.4l2.4 2.4 2.4-2.4"/><path d="M8.5 20.5h7"/>',
}
const ic = (name, size = 22, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`
const dots = (size = 22, cls = '') =>
  `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5.2" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.8" r="1.7"/></svg>`

// ---- 共通のスタイル -----------------------------------------------------------
const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fffdf8}
#fig{
  position:relative;width:340px;overflow:hidden;background:#fffdf8;
  font-family:-apple-system,"Hiragino Sans","Hiragino Kaku Gothic ProN","Yu Gothic","Noto Sans JP",sans-serif;
  color:#43362a;line-height:1.5;-webkit-font-smoothing:antialiased;
}
.ic{display:block;flex:none}

/* 押す場所を囲む枠と、名前を出すラベル */
.mark{position:relative;outline:3px solid #cc3f01;outline-offset:3px;border-radius:8px;box-shadow:0 0 0 7px rgba(204,63,1,.13)}
.mark--round{border-radius:999px}
.tag{
  display:inline-block;background:#cc3f01;color:#fffdf8;font-size:12px;font-weight:bold;
  padding:3px 10px;border-radius:999px;position:relative;white-space:nowrap
}
.tag::after{content:"";position:absolute;left:50%;margin-left:-6px;border:6px solid transparent}
.tag--down::after{top:100%;border-top-color:#cc3f01;border-bottom:0}
.tag--up::after{bottom:100%;border-bottom-color:#cc3f01;border-top:0}
/* 三角の位置をラベルの右端から測る(押す場所が画面の右寄りにあるとき) */
.tag--ar::after{left:auto;margin-left:0;right:var(--ar,16px)}

/* アプリ側の中身(説明の主役ではないので、形だけの板で置く) */
.paper{background:#faf5ec;padding:12px 12px 14px}
.card{background:#fffdf8;border:1px solid #eadfcd;border-radius:10px;padding:9px;display:flex;gap:9px;margin-bottom:8px}
.card:last-child{margin-bottom:0}
.thumb{width:44px;height:44px;border-radius:8px;background:#efe4d2;flex:none}
.lines{flex:1;padding-top:3px}
.ln{height:8px;border-radius:4px;background:#e7dcc9;margin-bottom:7px}
.ln.w70{width:70%}.ln.w50{width:50%}.ln.w85{width:85%}.ln.w40{width:40%}

/* iOSのSafari */
.ios-bar{background:#f5f4f2;border-top:1px solid #dedcd8;padding:8px 10px 6px}
.ios-addr{
  display:flex;align-items:center;gap:8px;background:#fff;border-radius:11px;
  padding:7px 10px;font-size:12.5px;color:#43362a;box-shadow:0 1px 2px rgba(0,0,0,.06)
}
.ios-addr .aa{font-size:11px;color:#8b8b8f;flex:none}
.ios-addr .url{flex:1;text-align:center}
.ios-addr .ic{color:#8b8b8f}
.ios-tools{display:flex;align-items:center;justify-content:space-between;padding:9px 14px 4px;color:#2f70e0}
.ios-home{width:110px;height:4px;border-radius:2px;background:#c9c7c2;margin:6px auto 7px}

/* iOSの共有メニュー */
.sheet{background:#f2f1ef;border-radius:14px 14px 0 0;padding:12px 12px 14px;border:1px solid #e2e0dc;border-bottom:0}
.sheet-head{display:flex;align-items:center;gap:9px;background:#fff;border-radius:11px;padding:9px 10px;margin-bottom:10px}
.sheet-head img{width:32px;height:32px;border-radius:7px;flex:none}
.sheet-head .t{font-size:12.5px;font-weight:bold}
.sheet-head .u{font-size:11px;color:#8b8b8f}
/* overflow:hidden は付けない(2026-08-09 便EP)。付けると、押す場所を囲む枠(.mark)の
   左右が一覧のふちで切られ、囲みが閉じていない絵になる。中の行は自前の背景を持たないので
   角丸からはみ出すものはない */
.sheet-list{background:#fff;border-radius:11px}
.row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;font-size:13px;border-bottom:1px solid #eeedea;color:#43362a}
.row:last-child{border-bottom:0}
.row .ic{color:#43362a}
.row--mark{position:relative;z-index:1}

/* AndroidのChrome */
.and-bar{background:#f1f1f4;padding:8px 14px 8px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e0e0e4}
.and-addr{flex:1;background:#fff;border-radius:999px;padding:7px 12px;font-size:12.5px;color:#43362a;display:flex;align-items:center;gap:8px}
.and-bar .ic{color:#4a4a4f}
/* overflow:hidden は付けない(.sheet-listと同じ理由)。right は、いちばん下の項目を囲む枠と
   そのぼかしが図の右端で切られないよう 8px→12px に広げた(2026-08-09 便EP) */
.and-menu{
  position:absolute;right:12px;top:44px;width:190px;background:#fff;border:1px solid #e2e0dc;
  border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.16)
}
.and-menu .row{font-size:12.5px;padding:10px 12px}

/* パソコンのブラウザ */
.pc-tabs{background:#e8e6e2;padding:7px 8px 0;display:flex;gap:6px;align-items:flex-end}
.pc-tab{background:#fff;border-radius:8px 8px 0 0;padding:6px 12px;font-size:11.5px;display:flex;align-items:center;gap:6px}
.pc-tab img{width:14px;height:14px;border-radius:3px}
.pc-tools{background:#fff;padding:7px 8px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e4e2de}
.pc-tools .ic{color:#4a4a4f}
.pc-addr{flex:1;background:#f1f0ee;border-radius:999px;padding:5px 10px;font-size:11.5px;display:flex;align-items:center;gap:8px}
.pc-addr .url{flex:1}

/* 追加したあとの姿(スマートフォン/パソコン)の小見出し */
.after-label{padding:10px 12px 5px;font-size:11.5px;font-weight:bold;color:#7c6a56}
.after-label:first-child{padding-top:2px}

/* パソコンで追加したあとの窓(2026-08-09 便EP・オーナー実機報告)。
   上の帯はマニフェストの theme_color(#d9480f)で塗られ、左端にうちレシピのアイコンが出る */
.pcwin{margin:0 12px;border:1px solid #eadfcd;border-radius:10px;overflow:hidden}
.pcwin-bar{display:flex;align-items:center;gap:8px;padding:7px 10px;background:#d9480f;color:#fffdf8}
.pcwin-bar img{width:20px;height:20px;border-radius:5px;flex:none}
.pcwin-bar .t{flex:1;font-size:12px;font-weight:bold}
.pcwin-bar .ic{color:#fffdf8}

/* ホーム画面 */
.home{background:linear-gradient(160deg,#c9d3de,#e0d4c2);padding:16px 14px 18px}
.apps{display:flex;justify-content:space-between}
.app{width:60px;text-align:center}
.app .sq{width:52px;height:52px;border-radius:13px;background:rgba(255,255,255,.55);margin:0 auto}
.app img.sq{background:none}
.app .nm{margin-top:5px;font-size:10.5px;color:#2c2c2e;font-weight:bold}
.app .nm.ph{height:7px;border-radius:4px;background:rgba(255,255,255,.6);margin:8px auto 0;width:34px}
`

const wrap = (inner) => `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body><div id="fig">${inner}</div></body></html>`

// ---- 図の中身 -----------------------------------------------------------------
const appPaper = (rows = 2) =>
  `<div class="paper">${Array.from({ length: rows })
    .map(
      () =>
        `<div class="card"><div class="thumb"></div><div class="lines"><div class="ln w70"></div><div class="ln w40"></div></div></div>`,
    )
    .join('')}</div>`

const FIGURES = {
  // 追加したあとの姿。スマートフォンはホーム画面にアイコンが増え、
  // パソコンはうちレシピだけの窓で開く(2026-08-09 便EP: オレンジ色の帯とアイコンを足した)
  'home-icon': `
    <div class="after-label">スマートフォン</div>
    <div class="home">
      <div class="apps">
        <div class="app"><div class="sq"></div><div class="nm ph"></div></div>
        <div class="app"><img class="sq" src="${APP_ICON}" alt=""><div class="nm">うちレシピ</div></div>
        <div class="app"><div class="sq"></div><div class="nm ph"></div></div>
        <div class="app"><div class="sq"></div><div class="nm ph"></div></div>
      </div>
    </div>
    <div class="after-label">パソコン</div>
    <div class="pcwin">
      <div class="pcwin-bar">
        <img src="${APP_ICON}" alt="">
        <span class="t">うちレシピ</span>
        ${dots(16)}
      </div>
      <div class="paper" style="padding:10px 10px 12px">
        <div class="card"><div class="thumb"></div><div class="lines"><div class="ln w70"></div><div class="ln w40"></div></div></div>
        <div class="card"><div class="thumb"></div><div class="lines"><div class="ln w85"></div><div class="ln w50"></div></div></div>
      </div>
    </div>
    <div style="height:12px"></div>`,

  // iPhone: 共有ボタンの位置
  'ios-share': `
    ${appPaper(2)}
    <div style="text-align:center;padding:2px 0 9px;background:#faf5ec"><span class="tag tag--down">共有ボタン</span></div>
    <div class="ios-bar">
      <div class="ios-addr"><span class="aa">ぁあ</span><span class="url">uchirecipe.com</span>${ic('reload', 15)}</div>
      <div class="ios-tools">
        ${ic('chevronLeft', 21)}
        ${ic('chevronRight', 21)}
        <span class="mark mark--round" style="padding:4px">${ic('share', 22)}</span>
        ${ic('book', 21)}
        ${ic('tabs', 21)}
      </div>
      <div class="ios-home"></div>
    </div>`,

  // iPhone: 共有メニューの中の「ホーム画面に追加」
  'ios-sheet': `
    <div style="background:#8f8b85;height:26px"></div>
    <div class="sheet">
      <div class="sheet-head">
        <img src="${APP_ICON}" alt="">
        <div><div class="t">うちレシピ</div><div class="u">uchirecipe.com</div></div>
      </div>
      <div class="sheet-list">
        <div class="row"><span>コピー</span>${ic('copy', 19)}</div>
        <div class="row"><span>リーディングリストに追加</span>${ic('glasses', 19)}</div>
        <div class="row"><span>ブックマークを追加</span>${ic('bookmark', 19)}</div>
        <div class="row row--mark mark"><span style="font-weight:bold">ホーム画面に追加</span>${ic('plusSquare', 19)}</div>
        <div class="row"><span>プリント</span>${ic('download', 19)}</div>
      </div>
    </div>`,

  // Android: メニューボタンの位置
  'android-menu': `
    <div class="and-bar">
      ${ic('chevronLeft', 20)}
      <div class="and-addr"><span style="flex:1">uchirecipe.com</span></div>
      ${ic('reload', 20)}
      <span class="mark mark--round" style="padding:3px">${dots(20)}</span>
    </div>
    ${appPaper(2)}
    <div style="position:absolute;right:6px;top:48px"><span class="tag tag--up tag--ar" style="--ar:16px">メニュー</span></div>`,

  // Android: メニューの中の「アプリをインストール」
  'android-install': `
    <div class="and-bar">
      ${ic('chevronLeft', 20)}
      <div class="and-addr"><span style="flex:1">uchirecipe.com</span></div>
      ${ic('reload', 20)}
      ${dots(20)}
    </div>
    <div class="paper" style="min-height:248px"></div>
    <div class="and-menu">
      <div class="row"><span>新しいタブ</span>${ic('plusSquare', 17)}</div>
      <div class="row"><span>履歴</span>${ic('clock', 17)}</div>
      <div class="row"><span>ダウンロード</span>${ic('download', 17)}</div>
      <div class="row"><span>ブックマーク</span>${ic('star', 17)}</div>
      <div class="row row--mark mark"><span style="font-weight:bold">アプリをインストール</span>${ic('install', 17)}</div>
    </div>`,

  // パソコン: アドレスバーの右端のインストールのマーク
  'pc-install': `
    <div class="pc-tabs">
      <div class="pc-tab"><img src="${APP_ICON}" alt=""><span>うちレシピ</span></div>
    </div>
    <div class="pc-tools">
      ${ic('chevronLeft', 17)}
      ${ic('chevronRight', 17)}
      ${ic('reload', 17)}
      <div class="pc-addr">
        <span class="url">uchirecipe.com</span>
        <span class="mark mark--round" style="padding:2px">${ic('install', 17)}</span>
      </div>
      ${dots(17)}
    </div>
    ${appPaper(2)}
    <div style="position:absolute;right:8px;top:86px"><span class="tag tag--up tag--ar" style="--ar:46px">インストール</span></div>`,
}

// ---- 描画 ---------------------------------------------------------------------
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
