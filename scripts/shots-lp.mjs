// 紹介ページ(public/about/index.html)に載せる実機スクリーンショットを撮るスクリプト。
//
// 使い方:
//   npm run build
//   npm run preview -- --port 4286 --strictPort   (別ターミナル)
//   BASE_URL=http://localhost:4286 npx tsx scripts/shots-lp.mjs
//
// 使い方ページ側(scripts/shots-manual.mjs)との違い:
//  - あちらは Pro を解錠した端末で撮っている。紹介ページは「無料でできること」を
//    無料の見え方のまま並べる構成なので、こちらは解錠しない状態で撮る
//    (例: 週の献立の栄養行は、無料だとカロリーと野菜量だけが出る)。
//  - 紹介ページで新しく要る2枚だけを撮る。ほかの図は使い方ページの部分スクショ
//    (public/about/img/manual/*.webp)をそのまま使う。
//
// 出力: public/about/img/lp/*.webp
// 注意: オーナーのdevサーバー(5173)は不可侵。BASE_URLは必ずpreviewを指すこと。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = process.env.BASE_URL ?? ''
if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('BASE_URLにpreview(例: http://localhost:4286)を指定してください（5173は不可）')
  process.exit(1)
}
const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/about/img/lp')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEW = { width: 390, height: 844 }
const failures = []
const wait = (page, ms) => page.waitForTimeout(ms)

async function save(png, name) {
  const meta = await sharp(png).metadata()
  const webp = await sharp(png).webp({ quality: 78, effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${name}.webp`), webp)
  console.log(`  ${name}.webp  ${meta.width}x${meta.height}  ${(webp.length / 1024).toFixed(1)}KB`)
}

const rectOf = (loc) =>
  loc.first().evaluate((n) => {
    const b = n.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

/** 要素の周りだけを切り出して保存する */
async function crop(page, name, loc, opts = {}) {
  try {
    const {
      padX = 8,
      padTop = 8,
      padBottom = 8,
      top = null,
      maxHeight = null,
      extraBottom = 0,
      fullWidth = false,
    } = opts
    const el = loc.first()
    await el.scrollIntoViewIfNeeded()
    await wait(page, 250)
    let r = await rectOf(el)
    const wantTop = top ?? Math.max(16, Math.min(140, Math.round((VIEW.height - r.h) / 2)))
    if (Math.abs(r.y - wantTop) > 2) {
      await page.evaluate((dy) => window.scrollBy(0, dy), Math.round(r.y - wantTop))
      await wait(page, 250)
      r = await rectOf(el)
    }
    const x = fullWidth ? 0 : Math.max(0, Math.round(r.x - padX))
    const y = Math.max(0, Math.round(r.y - padTop))
    const w = fullWidth
      ? VIEW.width
      : Math.max(1, Math.min(VIEW.width - x, Math.round(r.w + padX * 2)))
    let h = Math.max(1, Math.min(VIEW.height - y, Math.round(r.h + padTop + padBottom + extraBottom)))
    if (maxHeight) h = Math.min(h, maxHeight)
    await save(await page.screenshot({ clip: { x, y, width: w, height: h } }), name)
  } catch (e) {
    failures.push(name)
    console.warn(`  ⚠ ${name} 失敗: ${String(e).split('\n')[0].slice(0, 110)}`)
  }
}

/** 上端の要素から下端の要素までをひとまとめに切り出す */
async function cropRange(page, name, topLoc, bottomLoc, opts = {}) {
  try {
    const { padX = 8, padTop = 8, padBottom = 8, top = 16, fullWidth = false } = opts
    await topLoc.first().scrollIntoViewIfNeeded()
    await wait(page, 250)
    let a = await rectOf(topLoc)
    if (Math.abs(a.y - top) > 2) {
      await page.evaluate((dy) => window.scrollBy(0, dy), Math.round(a.y - top))
      await wait(page, 250)
      a = await rectOf(topLoc)
    }
    const b = await rectOf(bottomLoc)
    const x = fullWidth ? 0 : Math.max(0, Math.round(Math.min(a.x, b.x) - padX))
    const right = Math.max(a.x + a.w, b.x + b.w) + padX
    const y = Math.max(0, Math.round(a.y - padTop))
    const w = fullWidth ? VIEW.width : Math.max(1, Math.min(VIEW.width - x, Math.round(right - x)))
    const h = Math.max(1, Math.min(VIEW.height - y, Math.round(b.y + b.h + padBottom - y)))
    await save(await page.screenshot({ clip: { x, y, width: w, height: h } }), name)
  } catch (e) {
    failures.push(name)
    console.warn(`  ⚠ ${name} 失敗: ${String(e).split('\n')[0].slice(0, 110)}`)
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'ja-JP',
})
context.setDefaultTimeout(15000)
const page = await context.newPage()
page.on('dialog', (d) => d.accept())

try {
  // ---- 初回シード待ち(収録レシピの投入) ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 2800)

  // ======== 献立(週)・無料の見え方 ========
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  await page.getByRole('button', { name: '週', exact: true }).click()
  await wait(page, 700)
  await page.getByRole('button', { name: '今日から7日間', exact: true }).click()
  await wait(page, 700)
  await page.getByRole('button', { name: 'まとめて献立を立てる' }).click()
  await wait(page, 2600)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 500)
  // 主菜と副菜の両方が入っていて、野菜量が3桁g出ている日のカードを選ぶ
  // (空の枠や、極端に小さい数字が紹介ページに載らないようにする)
  const weekDayCard = page
    .locator('main section, main li')
    .filter({ hasText: /主菜/ })
    .filter({ hasText: /副菜/ })
    .filter({ hasNotText: 'レシピを選ぶ' })
    .filter({ hasText: /野菜約\d{3}g/ })
    .first()
  await crop(page, 'plan-week-free', weekDayCard, { top: 40, padX: 6, maxHeight: 470 })

  // 今週の概算食費(開いた状態)
  const costRow = page.getByRole('button', { name: /今週の概算食費/ }).first()
  if (await costRow.count()) {
    await costRow.click()
    await wait(page, 900)
    await crop(page, 'cost-week-free', costRow, {
      top: 210,
      padTop: 12,
      extraBottom: 92,
      fullWidth: true,
    })
    await costRow.click()
    await wait(page, 400)
  }

  // ======== URLから取り込む(見出しから欄まで) ========
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 800)
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  const discard = page.getByRole('button', { name: '破棄する' })
  if (await discard.count()) {
    await discard.click()
    await wait(page, 400)
  }
  const urlToggle = page.getByText('URLから取り込む', { exact: true }).first()
  if (await urlToggle.count()) {
    await urlToggle.click()
    await wait(page, 700)
    const urlBox = page.locator('input[type="url"], input[inputmode="url"]').first()
    if (await urlBox.count()) {
      // URLは入れずに空欄(プレースホルダ)のまま撮る。実在サイト名を紹介ページに写さない
      await cropRange(page, 'url-import', urlToggle, urlBox, {
        top: 90,
        padTop: 14,
        padBottom: 2,
        fullWidth: true,
      })
    } else {
      failures.push('url-import(欄が出ない)')
    }
  } else {
    failures.push('url-import(トグルが無い)')
  }

  // ======== 保存容量のめやす(実測) ========
  // 紹介ページの「データ」セクションに書く数値の裏取り。
  // 収録レシピ(写真なし)のJSONサイズを実データから測る
  const measured = await page.evaluate(async () => {
    const req = indexedDB.open('uchi-recipe')
    const db = await new Promise((res, rej) => {
      req.onsuccess = () => res(req.result)
      req.onerror = () => rej(req.error)
    })
    const all = await new Promise((res, rej) => {
      const r = db.transaction('recipes', 'readonly').objectStore('recipes').getAll()
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    db.close()
    const sizes = all.map((r) => new Blob([JSON.stringify(r)]).size)
    sizes.sort((a, b) => a - b)
    const total = sizes.reduce((a, b) => a + b, 0)
    return {
      count: sizes.length,
      avg: Math.round(total / sizes.length),
      min: sizes[0],
      max: sizes[sizes.length - 1],
      totalKB: Math.round(total / 1024),
    }
  })
  console.log('レシピ1件あたりのデータ量(写真なし・実測):', JSON.stringify(measured))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error('\n撮影に失敗:', failures.join(', '))
  process.exit(1)
}
console.log('\n完了: public/about/img/lp/')
