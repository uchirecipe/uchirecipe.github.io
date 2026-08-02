// 使い方ページ(§12 バックアップ)の「容量のめやす」表に載せる実測値を測るスクリプト。
//
// 使い方:
//   npm run build
//   npx vite preview --port 4288 --strictPort   (別ターミナル)
//   BASE_URL=http://localhost:4288 MANUAL_PHOTO_DIR=<料理写真のフォルダ> npx tsx scripts/measure-storage.mjs
//
// 測り方:
//  - 実機と同じ経路で IndexedDB(uchi-recipe)へ書き込み、書き込み前後の
//    navigator.storage.estimate().usageDetails.indexedDB の差を1件あたりに割る
//  - 写真はアプリ本体と同じ圧縮をかける(レシピ写真=長辺1200px/JPEG 0.85、
//    作った記録の写真=長辺1280px/JPEG 0.80。src/logic/image.ts・CookedLogModal.tsx と同値)
//  - 料理写真はリポジトリに置かない(ぱくたその素材)。MANUAL_PHOTO_DIR から読む
//  - オーナーのdevサーバー(5173)は不可侵。BASE_URLは必ずpreviewを指すこと

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? ''
if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('BASE_URLにpreview(例: http://localhost:4288)を指定してください（5173は不可）')
  process.exit(1)
}
const PHOTO_DIR = process.env.MANUAL_PHOTO_DIR ?? ''
const photoFiles = PHOTO_DIR
  ? fs
      .readdirSync(PHOTO_DIR)
      .filter((f) => /\.jpe?g$/i.test(f))
      .map((f) => `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTO_DIR, f)).toString('base64')}`)
  : []
if (!photoFiles.length) {
  console.error('MANUAL_PHOTO_DIR に料理写真(JPEG)を置いてください（写真つきの実測に必要）')
  process.exit(1)
}

const N = Number(process.env.SAMPLE_N ?? 100)
/** ONLY=1 のように番号を並べると、その項目だけを測る(件数を変えて測り直すとき用) */
const ONLY = new Set((process.env.ONLY ?? '').split(',').map((x) => x.trim()).filter(Boolean))

/**
 * 実機と同じ圧縮をかけた写真Blobを作るヘルパーを、ページ側に window.__resize として置く。
 * (src/logic/image.ts の resizePhoto と同じ手順)
 */
async function installResize(page) {
  await page.evaluate(() => {
    window.__resize = async (dataUrl, maxEdge, quality) => {
      const blob = await (await fetch(dataUrl)).blob()
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const out = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality))
      bitmap.close()
      return out
    }
  })
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ja-JP' })
const page = await context.newPage()
page.on('dialog', (d) => d.accept())

/** IndexedDBの使用量(バイト)。書き込みが落ち着くまで少し待ってから測る */
async function usage() {
  await page.waitForTimeout(4000)
  return page.evaluate(async () => {
    const e = await navigator.storage.estimate()
    return e.usageDetails?.indexedDB ?? e.usage ?? 0
  })
}

const results = []
async function measure(no, label, fn) {
  if (ONLY.size && !ONLY.has(String(no))) return
  const before = await usage()
  const meta = await page.evaluate(fn, { n: N, photos: photoFiles })
  const after = await usage()
  const total = after - before
  results.push({ label, total, per: total / N, ...meta })
  console.log(
    `${label}: 合計 ${(total / 1024 / 1024).toFixed(2)}MB / ${N}件 = 1件あたり ${(total / N / 1024).toFixed(1)}KB` +
      (meta.photoBytes ? `  (写真1枚 ${(meta.photoBytes / N / 1024).toFixed(1)}KB)` : ''),
  )
}

try {
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000) // 初回シード(収録レシピ)の完了待ち

  await installResize(page)
  const seedUsage = await usage()
  console.log(`収録レシピ入りの初期状態: ${(seedUsage / 1024 / 1024).toFixed(2)}MB`)

  // ⓪ 収録レシピ(実物のレシピ本文)の実測。同じ文面のコピーを大量に入れると
  //    IndexedDBの圧縮が効きすぎて実態より小さく出るため、本物の文面で測る。
  //    レシピを全消しした前後の差を1件あたりに割る
  if (!ONLY.size || ONLY.has('0')) {
    const before = await usage()
    const meta = await page.evaluate(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('uchi-recipe')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
      const all = await P(db.transaction('recipes', 'readonly').objectStore('recipes').getAll())
      const jsonBytes = new Blob([JSON.stringify(all)]).size
      await P(db.transaction('recipes', 'readwrite').objectStore('recipes').clear())
      db.close()
      return { count: all.length, jsonBytes }
    })
    await page.waitForTimeout(6000)
    const after = await usage()
    const total = before - after
    results.push({ label: '⓪ 収録レシピ(実物)', count: meta.count, jsonBytes: meta.jsonBytes, total, per: total / meta.count })
    console.log(
      `⓪ 収録レシピ(実物) ${meta.count}件: IndexedDB ${(total / 1024).toFixed(0)}KB = 1件あたり ${(total / meta.count / 1024).toFixed(2)}KB` +
        ` / JSON実文字量 ${(meta.jsonBytes / 1024).toFixed(0)}KB = 1件あたり ${(meta.jsonBytes / meta.count / 1024).toFixed(2)}KB`,
    )
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(3000)
    await installResize(page)
  }

  // ① テキストのみのレシピ
  await measure(1, '① テキストのみレシピ', async ({ n }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('uchi-recipe')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
    const st = () => db.transaction('recipes', 'readwrite').objectStore('recipes')
    for (let i = 0; i < n; i++) {
      await P(st().add({
        title: `計測用レシピ${i + 1}`,
        servings: 4,
        dishType: 'main',
        description: '計測のために入れた、ごく普通の分量のレシピです。',
        ingredients: [
          { name: '鶏むね肉', amount: '1', unit: '枚' },
          { name: '玉ねぎ', amount: '1', unit: '個' },
          { name: 'にんじん', amount: '1/2', unit: '本' },
          { name: 'じゃがいも', amount: '2', unit: '個' },
          { name: 'しょうゆ', amount: '2', unit: '大さじ' },
          { name: 'みりん', amount: '2', unit: '大さじ' },
          { name: '砂糖', amount: '1', unit: '大さじ' },
          { name: 'サラダ油', amount: '1', unit: '小さじ' },
        ],
        steps: [
          { text: '玉ねぎはくし形に切り、にんじんとじゃがいもは乱切りにする', minutes: undefined },
          { text: '鍋に油を熱し、鶏肉の表面を焼きつける', minutes: 3 },
          { text: '野菜を加えて全体に油をまわす', minutes: 2 },
          { text: '水と調味料を加え、落としぶたをして煮込む', minutes: 15 },
          { text: '味をみて、煮汁が少なくなったら火を止める', minutes: undefined },
        ],
        cookTime: 30, effortLevel: 2, tags: ['和食', '定番'], keywords: ['煮物'],
        memo: '前日に作っておくと味がなじみます。', cookedLogs: [],
        isFavorite: false, isStarter: false, createdAt: Date.now(), updatedAt: Date.now(),
      }))
    }
    db.close()
    return {}
  })

  // ② 写真つきのレシピ(URLから取り込む/カメラ/アルバムのどれでも同じ圧縮)
  await measure(2, '② 写真つきレシピ', async ({ n, photos }) => {
    const resize = window.__resize
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('uchi-recipe')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
    const st = () => db.transaction('recipes', 'readwrite').objectStore('recipes')
    let photoBytes = 0
    for (let i = 0; i < n; i++) {
      const photo = await resize(photos[i % photos.length], 1200, 0.85)
      photoBytes += photo.size
      await P(st().add({
        title: `計測用・写真つき${i + 1}`, servings: 2, dishType: 'main',
        ingredients: [
          { name: '豚こま切れ肉', amount: '200', unit: 'g' },
          { name: 'キャベツ', amount: '1/4', unit: '個' },
          { name: 'ピーマン', amount: '2', unit: '個' },
          { name: 'みそ', amount: '1', unit: '大さじ' },
          { name: '酒', amount: '1', unit: '大さじ' },
        ],
        steps: [
          { text: 'キャベツはざく切り、ピーマンは細切りにする' },
          { text: '豚肉を炒め、色が変わったら野菜を加える', minutes: 5 },
          { text: '調味料を加えて全体にからめる', minutes: 2 },
        ],
        cookTime: 15, effortLevel: 1, tags: [], keywords: [], cookedLogs: [], photo,
        sourceUrl: 'https://example.com/recipe/12345',
        isFavorite: false, isStarter: false, createdAt: Date.now(), updatedAt: Date.now(),
      }))
    }
    db.close()
    return { photoBytes }
  })

  // ③ 写真つきの「作った記録」
  await measure(3, '③ 写真つき作った記録', async ({ n, photos }) => {
    const resize = window.__resize
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('uchi-recipe')
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
    const all = await P(db.transaction('recipes', 'readonly').objectStore('recipes').getAll())
    const target = all.find((r) => r.isStarter)
    let photoBytes = 0
    const logs = []
    for (let i = 0; i < n; i++) {
      const photo = await resize(photos[i % photos.length], 1280, 0.8)
      photoBytes += photo.size
      const d = new Date()
      d.setDate(d.getDate() - i)
      logs.push({
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        servings: 3, note: '家族に好評だった', photo,
      })
    }
    await P(db.transaction('recipes', 'readwrite').objectStore('recipes')
      .put({ ...target, cookedLogs: [...target.cookedLogs, ...logs] }))
    db.close()
    return { photoBytes }
  })

  console.log('\n--- まとめ(JSON) ---')
  console.log(JSON.stringify({ seedUsage, sampleN: N, results }, null, 2))
} finally {
  await browser.close()
}
