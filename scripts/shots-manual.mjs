// 使い方ページ(public/about/manual.html)に載せる実機スクリーンショットを撮り直すスクリプト。
//
// 使い方:
//   npm run build
//   npm run preview -- --port 4284 --strictPort   (別ターミナル)
//   BASE_URL=http://localhost:4284 npx tsx scripts/shots-manual.mjs
//
//   一部だけ撮り直すとき(下の ONLY を参照):
//   BASE_URL=http://localhost:4284 ONLY=home-suggest,home-search npx tsx scripts/shots-manual.mjs
//
// 仕様:
//  - 390x844(iPhone相当)・ライトテーマ・deviceScaleFactor 2 のブラウザで操作する
//  - 出力は「説明している箇所だけ」を切り出した部分スクリーンショット
//    (2026-08-02 オーナー指示。縦長の全画面スクショは本文と対応が取りにくいためやめた)
//  - トリミングの基準(2026-08-02 オーナー指示): 説明しているパネルが縦に丸ごと収まる
//    ところまで切る(基準= 「URLから取り込む」パネル: 説明文・URL欄・写真チェック・
//    読み込むボタンまで)。文字が途中で切れる狭い切り出しは作らない。
//    横幅は全カットで画面幅(390px→実寸780px)に統一する = 各cropはfullWidth既定
//  - 空画面を載せないため、撮影前に見栄えのするデモデータを投入する
//    (Pro解錠・週/月の献立・買い物メモ・在庫・作った記録・料理写真)
//  - 出力は public/about/img/manual/*.webp
//  - オーナーのdevサーバー(5173)は不可侵。BASE_URLは必ずpreviewを指すこと
//
// デモ用の料理写真について:
//  - 写真つきレシピの見え方(一覧カード・詳細・月カレンダー)を載せるため、
//    フリー素材サイト「ぱくたそ」(https://www.pakutaso.com/)の料理写真を使っている。
//    利用規約: 商用利用可・加工可・クレジット表記は必須ではない(2026-08-02 確認)。
//  - 素材そのものはリポジトリに置かない(再配布にあたりうるため)。撮影時だけ
//    MANUAL_PHOTO_DIR に置いた JPEG を IndexedDB へ読み込ませる。
//    既定の場所は <repo>/.manual-photos/ で、次のファイル名を見る:
//      curry.jpg / hamburg.jpg / mabo.jpg / misoshiru.jpg / hoikoro.jpg
//    出典(いずれも ぱくたそ):
//      curry     https://www.pakutaso.com/20251010299post-55605.html
//      hamburg   https://www.pakutaso.com/20250535143post-54483.html
//      mabo      https://www.pakutaso.com/20250638167post-54632.html
//      misoshiru https://www.pakutaso.com/20210348077post-33918.html
//      hoikoro   https://www.pakutaso.com/20250645167post-54631.html
//  - 見つからないときは写真なしで撮影を続ける(警告を出す)。
//
//  - 2026-08-09 便EU: `.manual-photos/` はリポジトリの外(各自の手元)にあるフォルダなので、
//    worktreeで撮り直すときは**まず用意されていない**。そのまま全カットを撮ると、写真つきの
//    カットが写真なしの絵に置き換わる(警告は出るが見落としやすい)。
//    同じ「ぱくたそ」の原本が `.demo-photos/`(public/demo/*.webp の元。build-demo-photos.mjs参照)
//    にあり、curry・hamburg・mabo の3枚はそちらと**同じ写真**なので流用できる:
//      MANUAL_PHOTO_DIR=<app>/.demo-photos npx tsx scripts/shots-manual.mjs
//    ただし misoshiru・hoikoro は .demo-photos に無い。この2枚が要るのは
//    logs(味噌汁のサムネイル)と plan-month-photo(カレンダーに敷く写真)なので、
//    **その2カットを撮り直すときだけ .manual-photos に5枚そろえること**。
//    そろっていない状態でこの2カットを撮ると、いま入っている絵より写真が減る。

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = process.env.BASE_URL ?? ''
if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('BASE_URLにpreview(例: http://localhost:4284)を指定してください（5173は不可）')
  process.exit(1)
}
const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/about/img/manual')
const PHOTO_DIR = process.env.MANUAL_PHOTO_DIR ?? path.join(ROOT, '.manual-photos')
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEW = { width: 390, height: 844 }
const sizes = []
const failures = []
/** manual.html の <img width height> に入れる実寸(px)。表示は半分のCSS pxにする */
const manifest = {}

/**
 * このスクリプトが撮るカットの名前(出力は public/about/img/manual/<名前>.webp)。
 * ONLY= の指定を照合するために持つ(2026-08-09 便EM)。名前を打ち間違えると、
 * 「1枚も撮れないまま全カット走り切って何も変わらない」という分かりにくい失敗になっていた。
 */
const SHOT_NAMES = [
  'recipe-cards', 'home-suggest', 'home-search', 'nav-tabs', 'search',
  'register-tabs', 'ingredient-rows', 'bulk-input', 'register-detail', 'paste', 'url-import',
  'plan-day-buttons', 'select-for-today', 'plan-week-nutrition-open', 'plan-week-day', 'cost-week',
  'plan-month', 'plan-month-photo', 'shopping', 'pantry',
  'detail-photo', 'nutrition-open', 'share', 'logs',
  'cookmode-voice', 'cookmode', 'timer', 'settings-kitchen', 'cooknavi',
  'cooknavi-finish', 'cooknavi-reorder', 'cooknavi-reorder-undo',
  'cooknavi-session', 'cooknavi-session-others',
  'backup-export', 'backup-import', 'nutrition-row', 'plan-week-nutrition-row',
]

/**
 * ONLY=home-suggest,home-search のように指定すると、その名前のスクショだけを書き出す(部分撮り直し)。
 * 料理写真(MANUAL_PHOTO_DIR)を持っていない環境で全部を撮り直すと、写真つきのスクショ
 * (recipe-cards / detail-photo / plan-month-photo / search / logs)が写真なしの絵に
 * 置き換わってしまうため、一部の画面だけ追随させたいときは対象を絞る。
 * 指定ぶんを撮り終えた時点で撮影を打ち切る。
 *
 * 2026-08-09 便EM:
 *  - 指定名を SHOT_NAMES と照合し、打ち間違いはその場で止める
 *  - 指定外のカットは切り出しごと飛ばす(紹介ページ側 scripts/shots-lp.mjs の want() と同じ流儀)。
 *    以前は切り出しまで実行して保存だけ止めていたため、関係のないカットの失敗が
 *    「撮影できなかったもの」に並び、本当に撮りたいカットの成否が読み取りにくかった。
 *    画面を進める操作(タブの切り替え・トグルの開閉)は飛ばさないので、後続のカットには影響しない
 */
const ONLY = new Set(
  (process.env.ONLY ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)
const unknownOnly = [...ONLY].filter((name) => !SHOT_NAMES.includes(name))
if (unknownOnly.length) {
  console.error(`ONLYに知らないカット名があります: ${unknownOnly.join(', ')}`)
  console.error(`使える名前: ${SHOT_NAMES.join(', ')}`)
  process.exit(1)
}
/** そのカットを撮るか(ONLY未指定なら全部撮る) */
const want = (name) => ONLY.size === 0 || ONLY.has(name)
/** ONLYで指定したぶんを撮り終えた合図。撮影の失敗と取り違えないよう専用のクラスにする */
class AllRequestedDone extends Error {}

const wait = (page, ms) => page.waitForTimeout(ms)

/** 料理写真(任意)をdataURLで読み込む */
function loadPhotos() {
  const names = ['curry', 'hamburg', 'mabo', 'misoshiru', 'hoikoro']
  const out = {}
  for (const n of names) {
    const p = path.join(PHOTO_DIR, `${n}.jpg`)
    if (!fs.existsSync(p)) continue
    out[n] = `data:image/jpeg;base64,${fs.readFileSync(p).toString('base64')}`
  }
  const missing = names.filter((n) => !out[n])
  if (missing.length) {
    console.warn(`⚠ 料理写真が見つかりません(${missing.join(',')})。写真なしで撮影します: ${PHOTO_DIR}`)
  }
  return out
}

async function save(png, name) {
  if (!want(name)) return
  const meta = await sharp(png).metadata()
  const webp = await sharp(png).webp({ quality: 78, effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${name}.webp`), webp)
  sizes.push([name, webp.length])
  manifest[name] = { w: meta.width, h: meta.height }
  console.log(`  ${name}.webp  ${meta.width}x${meta.height}  ${(webp.length / 1024).toFixed(1)}KB`)
  if (ONLY.size && sizes.length === ONLY.size) throw new AllRequestedDone()
}

/** 要素の位置(ビューポート基準)を測る */
const rectOf = (loc) =>
  loc.first().evaluate((n) => {
    const b = n.getBoundingClientRect()
    return { x: b.x, y: b.y, w: b.width, h: b.height }
  })

/**
 * 要素の周りだけを切り出して保存する。
 * top: 画面の上から何pxの位置に要素の上端を置くか(既定=なるべく中央寄り)
 */
async function crop(page, name, loc, opts = {}) {
  if (!want(name)) return
  try {
    return await cropInner(page, name, loc, opts)
  } catch (e) {
    if (e instanceof AllRequestedDone) throw e
    failures.push(name)
    console.warn(`  ⚠ ${name} 失敗: ${String(e).split('\n')[0].slice(0, 110)}`)
  }
}

async function cropInner(page, name, loc, opts = {}) {
  const {
    padX = 8,
    padTop = 8,
    padBottom = 8,
    top = null,
    maxHeight = null,
    extraBottom = 0,
    fullWidth = true,
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
  const png = await page.screenshot({ clip: { x, y, width: w, height: h } })
  await save(png, name)
}

/** 上端の要素から下端の要素までをひとまとめに切り出す */
async function cropRange(page, name, topLoc, bottomLoc, opts = {}) {
  if (!want(name)) return
  try {
    return await cropRangeInner(page, name, topLoc, bottomLoc, opts)
  } catch (e) {
    if (e instanceof AllRequestedDone) throw e
    failures.push(name)
    console.warn(`  ⚠ ${name} 失敗: ${String(e).split('\n')[0].slice(0, 110)}`)
  }
}

async function cropRangeInner(page, name, topLoc, bottomLoc, opts = {}) {
  const { padX = 8, padTop = 8, padBottom = 8, top = 16, fullWidth = true } = opts
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
  const w = fullWidth
    ? VIEW.width
    : Math.max(1, Math.min(VIEW.width - x, Math.round(right - x)))
  const h = Math.max(1, Math.min(VIEW.height - y, Math.round(b.y + b.h + padBottom - y)))
  const png = await page.screenshot({ clip: { x, y, width: w, height: h } })
  await save(png, name)
}

/** 画面下端の固定要素(タブバー)など、位置を直接指定して切り出す */
async function cropRect(page, name, rect) {
  if (!want(name)) return
  const png = await page.screenshot({ clip: rect })
  await save(png, name)
}

/** 撮影結果のまとめ表示と、manual.html の width/height を直すときの控えの書き出し */
function report() {
  if (failures.length) console.log(`\n⚠ 撮影できなかったもの: ${failures.join(', ')}`)
  const total = sizes.reduce((s, [, n]) => s + n, 0)
  console.log(`\n合計 ${sizes.length}枚 / ${(total / 1024).toFixed(1)}KB`)
  console.log('\n--- manifest (manual.html の width/height 用) ---')
  console.log(JSON.stringify(manifest, null, 0))
  // manual.html の <img width height> を直すときの控え(公開物には含めない)。
  // 部分撮り直し(ONLY)のときは、撮っていないぶんの控えを消さないよう既存の内容に上書きする
  const file = path.join(ROOT, 'scripts/data/manual-shot-sizes.json')
  let merged = manifest
  if (ONLY.size && fs.existsSync(file)) {
    merged = { ...JSON.parse(fs.readFileSync(file, 'utf8')), ...manifest }
  }
  fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n')
}

/** 登録画面を「かんたん」タブの初期状態で開き直す(同じハッシュへのgotoでは再マウントされないため) */
async function openNewRecipeForm(page, BASE) {
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(600)
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const discard = page.getByRole('button', { name: '破棄する' })
  if (await discard.count()) {
    await discard.click()
    await page.waitForTimeout(400)
  }
  const simple = page.getByText('かんたん', { exact: true }).first()
  if (await simple.count()) {
    await simple.click()
    await page.waitForTimeout(400)
  }
}

/** IndexedDBへ直接書き込むデモデータ投入(Pro解錠・在庫・作った記録・料理写真) */
async function seedDirect(page, photos) {
  return page.evaluate(async (photos) => {
    const openDb = () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('uchi-recipe')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
    const P = (req) =>
      new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
    const toBlob = async (dataUrl) => (await fetch(dataUrl)).blob()
    const db = await openDb()
    const store = (name) => db.transaction(name, 'readwrite').objectStore(name)

    // Pro解錠(月間献立・栄養8項目・並行調理ナビの画面を撮るため)
    const cur = (await P(store('settings').get(1))) ?? { id: 1 }
    await P(
      store('settings').put({ ...cur, id: 1, proCode: 'UR-DEMO-SHOT', proActivatedAt: Date.now() }),
    )

    // 在庫: プリセットの状態を「ある/少ない/ない」に散らし、グループが分かれるよう数品足す。
    // 「ある」の食材は買い物メモの下書きに出ないので、生鮮は low/none 中心にする
    const levelByName = {
      卵: 'have', 玉ねぎ: 'low', にんじん: 'low', じゃがいも: 'low', キャベツ: 'none',
      豚肉: 'none', 鶏肉: 'none', 牛乳: 'low', しょうゆ: 'have', みそ: 'have', 米: 'have', 豆腐: 'none',
    }
    const pantry = await P(store('pantryItems').getAll())
    for (const item of pantry) {
      const level = levelByName[item.name]
      if (level) await P(store('pantryItems').put({ ...item, level }))
    }
    const extra = [
      ['鮭', 'none'], ['ほうれん草', 'low'], ['しめじ', 'have'],
      ['納豆', 'have'], ['スパゲッティ', 'have'], ['砂糖', 'have'],
    ]
    const existing = new Set(pantry.map((p) => p.name))
    let order = pantry.length
    for (const [name, level] of extra) {
      if (existing.has(name)) continue
      await P(store('pantryItems').add({ name, level, isFrequent: true, sortOrder: order++ }))
    }

    const ymd = (offsetDays) => {
      const d = new Date()
      d.setDate(d.getDate() - offsetDays)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    // 作った記録: 直近30日に散らす。月カレンダーは「前の月」を出して写真日記の見え方を撮るので、
    // 1か月ぶんが埋まるように日付を広くとる
    const logPlan = [
      ['肉じゃが', [1, 9, 17], 4, { 1: '少し甘めにしたら好評だった' }],
      ['鶏の照り焼き', [2, 7, 21], 3, { 7: '皮をパリッと焼けた' }],
      ['豚の生姜焼き', [3, 11, 24], 2, {}],
      ['ほうれん草のおひたし', [2, 5, 13], 2, {}],
      ['カレーライス', [4, 15, 26], 4, { 4: '2日目のほうが好み' }],
      ['豆腐とわかめの味噌汁', [1, 3, 6, 14, 22], 3, {}],
      ['麻婆豆腐', [6, 16, 27], 3, {}],
      ['きんぴらごぼう', [8, 19], 2, { 8: '作り置きで3日もった' }],
      ['ハンバーグ', [10, 23], 4, { 10: '子どもが完食' }],
      ['回鍋肉', [12, 28], 3, {}],
    ]
    // 写真つきにするレシピ(料理写真があるときだけ)
    const photoByTitle = {
      カレーライス: photos.curry,
      ハンバーグ: photos.hamburg,
      麻婆豆腐: photos.mabo,
      豆腐とわかめの味噌汁: photos.misoshiru,
      回鍋肉: photos.hoikoro,
    }

    const recipes = await P(store('recipes').getAll())
    const applied = []
    const photoIds = []
    let bump = Date.now()
    for (const [title, days, servings, notes] of logPlan) {
      const r = recipes.find((x) => x.title === title || x.title.startsWith(title))
      if (!r) continue
      const logs = days.map((d) => {
        const log = { date: ymd(d), servings }
        if (notes[d]) log.note = notes[d]
        return log
      })
      const next = { ...r, cookedLogs: logs, updatedAt: r.updatedAt }
      const dataUrl = photoByTitle[title]
      if (dataUrl) {
        next.photo = await toBlob(dataUrl)
        // 一覧(更新順)の先頭に写真つきが3品だけ来るようにする。
        // 4枚目はアイコンのカードにして、写真あり/なしの両方が1枚に写るようにする
        if (['回鍋肉', 'ハンバーグ', '麻婆豆腐'].includes(title)) next.updatedAt = bump++
        photoIds.push(r.id)
      }
      await P(store('recipes').put(next))
      applied.push(r.title)
    }
    db.close()
    return { applied, photoIds }
  }, photos)
}

const photos = loadPhotos()
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: VIEW,
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'ja-JP',
})
context.setDefaultTimeout(10000)
const page = await context.newPage()
page.on('dialog', (d) => d.accept())

try {
  // ---- 初回シード + デモデータ投入 ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 2500)

  // §3「収録レシピ」に載せる一覧は、写真つきレシピが混ざると
  //「収録レシピにも写真が付いてくる」と読めてしまうため、デモ写真を入れる前に撮る
  //(2026-08-02 オーナー指示)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 500)
  const starterCard = page.locator('main a[href*="/recipes/"]:not([href$="/new"])')
  // 2026-08-10 便FJ: 検索まどの帯が画面上部に貼り付く(2026-08-09 便ET)ようになったため、
  // カードの上端を12pxに寄せると1枚目の上が帯の下に隠れる。帯の高さ(66px)より下に置く
  await cropRange(page, 'recipe-cards', starterCard.first(), starterCard.nth(3), { top: 80 })

  const seeded = await seedDirect(page, photos)
  console.log('seed:', seeded.applied.length, '品に記録 /', seeded.photoIds.length, '品に写真')
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 1500)

  // ======== ホーム ========
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await wait(page, 1800)

  // 「今日なに作る？」(2026-08-03 便DH: 今週の献立に今日の予定があると出ないので、献立を入れる前に撮る)
  const suggestCard = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: '今日なに作る？' }) })
  await crop(page, 'home-suggest', suggestCard, { top: 60 })

  // 「レシピを探す」ショートカット(2026-08-02 便CRで旧「使いたい食材から探す」の検索欄から差し替え)。
  // 在庫を入れてあるので「在庫の食材から探す」も一緒に写る
  const searchShortcut = page
    .locator('section')
    .filter({ has: page.getByRole('button', { name: 'レシピを探す', exact: true }) })
  await crop(page, 'home-search', searchShortcut, { top: 120 })

  // 下タブ(画面の見取り図)
  await cropRect(page, 'nav-tabs', { x: 0, y: VIEW.height - 72, width: VIEW.width, height: 72 })

  // ======== レシピ一覧(写真つきカード) ========
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 400)
  const recipeCard = page.locator('main a[href*="/recipes/"]:not([href$="/new"])')

  // 検索(かな表記ゆれ): 検索欄 + ヒット件数
  await page.getByPlaceholder('料理名・材料・タグ').fill('たまねぎ')
  await wait(page, 900)
  await cropRange(page, 'search', page.getByPlaceholder('料理名・材料・タグ'), recipeCard.first(), {
    top: 64,
  })
  await page.getByPlaceholder('料理名・材料・タグ').fill('')
  await wait(page, 500)

  // ======== 登録画面 ========
  await openNewRecipeForm(page, BASE)
  await page.getByPlaceholder('例: 肉じゃが').fill('鶏むね肉のさっぱり煮')
  const names = page.getByPlaceholder('例: じゃがいも', { exact: true })
  const amounts = page.getByPlaceholder('例: 3', { exact: true })
  const units = page.getByPlaceholder('例: 個', { exact: true })
  const rows = [
    ['鶏むね肉', '1', '枚'],
    ['玉ねぎ', '1', '個'],
    ['しょうゆ', '2', '大さじ'],
    ['酢', '2', '大さじ'],
  ]
  for (let i = 0; i < rows.length; i++) {
    if ((await names.count()) <= i) {
      await page.getByRole('button', { name: '材料を追加' }).click()
      await wait(page, 300)
    }
    await names.nth(i).fill(rows[i][0])
    await amounts.nth(i).fill(rows[i][1])
    await units.nth(i).fill(rows[i][2])
  }
  await wait(page, 400)

  // 「かんたん／くわしく」のタブと、その下の最初の入力欄
  await cropRange(
    page,
    'register-tabs',
    page.getByText('かんたん', { exact: true }).first(),
    page.getByPlaceholder('例: 肉じゃが'),
    { top: 64, padBottom: 12 },
  )

  // 材料の行(名前・分量・単位の3欄)
  await cropRange(page, 'ingredient-rows', names.first(), page.getByPlaceholder(/材料メモ/).first(), {
    top: 120,
    padBottom: 12,
  })

  // 「まとめて入力」: 見出し「まとめて入力」から「材料に追加」まで、パネルを丸ごと切る
  const bulkPanel = page.getByPlaceholder(/まとめて入力|豚こま/).first().locator('xpath=../..')
  if (await bulkPanel.count()) {
    await crop(page, 'bulk-input', bulkPanel, { top: 140, padTop: 12, padBottom: 12 })
  }

  // 「くわしく」タブの項目
  await page.getByText('くわしく', { exact: true }).first().click()
  await wait(page, 700)
  // 「ひとこと説明」は空のままだと、例文のプレースホルダーが欄の幅で途中まで
  // (「…ソースをかけた見た」)しか写らず、誤字のように読めてしまう(2026-08-09 オーナー実機報告)。
  // 撮影用に、欄に収まる長さの文を実際に入れて撮る。入力すると「くわしく」タブに●が付くので、
  // 本文の「入力した項目があるとタブに●が付きます」も図で確かめられる
  const intro = page.getByPlaceholder(/ソースをかけた/).first()
  if (await intro.count()) {
    await intro.fill('酢でさっぱり、やわらかく煮ます')
    // 入力直後のままだと欄に青い枠(フォーカスの印)が残るので外してから撮る
    await intro.blur()
    await wait(page, 300)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 300)
  await cropRange(
    page,
    'register-detail',
    page.getByText('くわしく', { exact: true }).first(),
    page.getByText('献立・検索に使う', { exact: true }).first(),
    { top: 64, padBottom: 12 },
  )

  // ---- テキスト貼り付けで自動入力 ----
  await openNewRecipeForm(page, BASE)
  await page.getByPlaceholder('例: 肉じゃが').fill('なすとピーマンのみそ炒め')
  await page.getByText('テキスト貼り付けで自動入力').click()
  await wait(page, 500)
  const pasteArea = page.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]')
  await pasteArea.fill(
    'なすとピーマンのみそ炒め\n\n材料（2人分）\n・なす 2本\n・ピーマン 3個\n・豚こま切れ肉 150g\n・みそ 大さじ1\n\n作り方\n1. なすとピーマンを乱切りにする\n2. 豚こまを炒め、なす・ピーマンを加えて炒める\n3. みそを加えて全体にからめる',
  )
  await page.getByRole('button', { name: '自動で振り分ける' }).click()
  await wait(page, 1200)
  await crop(page, 'paste', pasteArea.locator('xpath=..'), { top: 60, padTop: 12, padBottom: 12 })

  // ---- URLから取り込む ----
  await openNewRecipeForm(page, BASE)
  const urlToggle = page.getByText('URLから取り込む', { exact: true }).first()
  if (await urlToggle.count()) {
    await urlToggle.click()
    await wait(page, 600)
    // 説明文・URL欄・「写真も取り込む」・「読み込む」まで縦に丸ごと入れる
    //(この切り出しが他のカットのトリミング基準。2026-08-02 オーナー指示)
    const urlPanel = page.locator('input[type="url"], input[inputmode="url"]').first().locator('xpath=..')
    if (await urlPanel.count()) {
      await crop(page, 'url-import', urlPanel, { top: 96, padTop: 12, padBottom: 12 })
    }
  }

  // ======== 献立 ========
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await wait(page, 1500)

  // 「日」タブ: まだ決まっていないときの2つのボタン
  const dayTab = page.getByRole('button', { name: '日', exact: true })
  if (await dayTab.count()) {
    await dayTab.click()
    await wait(page, 700)
    const pickBtn = page.getByRole('button', { name: '今日の献立を選ぶ' })
    const autoBtn = page.getByRole('button', { name: 'おまかせで提案' })
    if ((await pickBtn.count()) && (await autoBtn.count())) {
      await cropRange(page, 'plan-day-buttons', pickBtn, autoBtn, { top: 100, padBottom: 44 })
    }
  }

  // 「今日の献立を選ぶ」からレシピ一覧が選択モードで開くところ(2026-08-13 便FY)。
  // 使い方ページ§4の本文が「レシピ一覧が選択モードで開きます」と書いているのに図が無く、
  // どんな画面に変わるのかが読めなかった。帯(何を選んでいる最中か)・選び方の案内・
  // 件数入りの決定ボタン・選んだカードの印が1枚に入る範囲を切る。
  // 決定ボタンは押さない = 今日の献立の中身を変えずに撮る(あとの「週」「月」の図に影響させない)
  const pickForToday = page.getByRole('button', { name: '今日の献立を選ぶ' })
  if (await pickForToday.count()) {
    await pickForToday.first().click()
    await wait(page, 1800)
    const selectBanner = page.locator('[data-testid="select-for-today-banner"]')
    // カード全面を覆う選択ボタンを2枚押す。並び順は撮るたびに変わりうるので、
    // 料理名で指定せず先頭から2枚を選ぶ。押すのはDOMのclick(貼り付く検索まどの帯が
    // 1枚目の当たり判定を横取りするため、座標を使う操作は避ける)
    const cardButtons = page.locator('main a[href*="/recipes/"]:not([href$="/new"])')
    const overlays = page.locator('main button.absolute.inset-0[aria-pressed]')
    for (const i of [0, 1]) {
      if ((await overlays.count()) > i) {
        await overlays.nth(i).evaluate((el) => el.click())
        await wait(page, 300)
      }
    }
    const addToToday = page.locator('[data-testid="add-selected-to-today"]')
    if ((await selectBanner.count()) && (await addToToday.count())) {
      // 検索まどの帯が画面上部に貼り付く(2026-08-09 便ET)ので、帯の高さ(66px)より下に置く
      await cropRange(page, 'select-for-today', selectBanner, cardButtons.first(), { top: 72 })
    }
  }

  // 「週」タブ: まとめて献立を立てる → 1日ぶんのカード + 栄養行
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  await page.getByRole('button', { name: '週', exact: true }).click()
  await wait(page, 600)
  // 2026-08-08 便DW: 「今日から7日間」は折りたたみグループ「表示のしかた」の中にあり、
  // 既定では畳まれている(2026-08-03 便DJ)。先に見出しを押して開かないとボタンを掴めない。
  // 実行ボタンの名前は「まとめて献立を立てる」→「まとめて献立を入力」(2026-08-07 便DT-5)
  await page.getByRole('button', { name: '表示のしかたを開く' }).click()
  await wait(page, 500)
  await page.getByRole('button', { name: '今日から7日間', exact: true }).click()
  await wait(page, 600)
  await page.getByRole('button', { name: '表示のしかたを閉じる' }).click()
  await wait(page, 400)
  await page.getByRole('button', { name: 'まとめて献立を入力' }).click()
  await wait(page, 2200)
  // 野菜量が3桁gの日を優先して選ぶ(主菜だけの一品ものの日だと極端に小さい数字が載るため)
  const dayToggles = page.getByRole('button', {
    name: /^この日（.+）の栄養の概算を詳しく見る$/,
  })
  const richDayToggles = dayToggles.filter({ hasText: /野菜約\d{3}g/ })
  // 「今日」以外の日を選ぶ(2026-08-09 便EU)。今日の栄養には
  // 「今日は、作った記録があるものは記録、まだのものは登録した献立で計算しています」の
  // 1行が足され、開いたときの高さが日によって変わる。図の下が1行ぶん切れるのを避ける
  const candidates = (await richDayToggles.count()) ? richDayToggles : dayToggles
  let dayIndex = 0
  if (await candidates.count()) {
    const notToday = await candidates.evaluateAll((els) =>
      els.findIndex((el) => !(el.closest('section')?.textContent ?? '').includes('今日')),
    )
    if (notToday >= 0) dayIndex = notToday
  }
  const dayToggle = candidates.nth(dayIndex)
  if (await dayToggle.count()) {
    // クリックすると読み上げ名が変わるので実体を掴んでから操作する
    const toggleEl = await dayToggle.elementHandle()
    await toggleEl.scrollIntoViewIfNeeded()
    await wait(page, 300)
    await toggleEl.click()
    await wait(page, 1000)
    await toggleEl.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 60))
    await wait(page, 400)
    // 2026-08-02 便CW-7で並置UI→説明文1行になったので、8項目・「ごはんを含めて計算する」・
    // 「1日分のめやすは〜」の1行までが入る高さに広げる(説明している範囲を途中で切らない)。
    // 2026-08-09 便EU: チェックの見出しが「1食につきごはん1杯（150g）を足して計算する」に
    // なって2行に折り返したぶん、466pxでは「1日分のめやすは〜」が途中で切れていた
    await cropRect(page, 'plan-week-nutrition-open', { x: 0, y: 50, width: VIEW.width, height: 508 })
    await toggleEl.click()
    await wait(page, 600)
  }
  // 1日ぶんのカード(主菜・副菜が入った状態)
  // 主菜と副菜の両方が埋まっている日を選ぶ(一品ものの日だと副菜が空欄のまま載る)
  // 2026-08-08 便DW: 「主菜」「副菜」だけの絞り込みでは、説明文に「主菜と副菜でまとめて
  // 入れます」を持つ「献立を提案」グループを掴んでしまっていた(実際に取り違えが起きた)。
  // 曜日カードにしか無い「この日のメモ」を条件に足して、日のカードだけに絞る
  const weekDayCards = page
    .locator('main section, main li')
    .filter({ hasText: /主菜/ })
    .filter({ hasText: 'この日のメモ' })
  const filledWeekDayCards = weekDayCards
    .filter({ hasText: /副菜/ })
    .filter({ hasNotText: 'レシピを選ぶ' })
  const weekDayCard = (await filledWeekDayCards.count())
    ? filledWeekDayCards.first()
    : weekDayCards.first()
  if (await weekDayCard.count()) {
    // 2026-08-10 便FJ: 「日」「週」「月」の帯が画面上部に貼り付く(2026-08-09 便ET)ので、
    // カードの上端は帯の高さ(54px)より下に置く(40pxのままだとカードの上に帯の切れ端が写る)
    await crop(page, 'plan-week-day', weekDayCard, { top: 64, maxHeight: 500 })
  }
  // 表示している週の概算食費
  const costRow = page.getByRole('button', { name: /表示している週の概算食費/ }).first()
  if (await costRow.count()) {
    await costRow.click()
    await wait(page, 900)
    await crop(page, 'cost-week', costRow, { top: 200, padTop: 12, extraBottom: 190 })
    await costRow.click()
    await wait(page, 500)
  }

  // 「月」タブ: 未定の日をまとめて提案 → 今月のカレンダー
  await page.getByRole('button', { name: '月', exact: true }).click()
  await wait(page, 900)
  const fillMonth = page.getByRole('button', { name: '未定の日をまとめて提案' })
  if (await fillMonth.count()) {
    await fillMonth.click()
    await wait(page, 2500)
  }
  await wait(page, 6500) // 結果トーストが自動で消えるのを待つ
  // 2026-08-08 便DW(オーナー指摘「献立月ページサンプルが実際の画面と違う」): カレンダーの
  // マスだけを切り出していたため、月タブのどこを見ているのか実機と結び付かなかった。
  // 2026-08-07 便DUでカレンダーが月タブの先頭に上がったので、「カレンダーに出す情報」から
  // カレンダーの最終行までを1枚に収める(画面を開いたときに最初に見える範囲そのもの)
  const monthCellModeLabel = page.getByText('カレンダーに出す情報', { exact: true }).first()
  const lastCell = page.locator('button[data-date]').last()
  // 2026-08-10 便FJ: 「日」「週」「月」の帯が上部に貼り付く(2026-08-09 便ET)ようになり、
  // 上端16pxでは「カレンダーに出す情報」と写真・栄養・食費のボタンが帯の下に隠れていた
  await cropRange(page, 'plan-month', monthCellModeLabel, lastCell, {
    top: 64,
    padTop: 10,
    padBottom: 10,
    fullWidth: true,
  })

  // 前の月 = 作った記録が並ぶ「写真日記」の見え方
  const prevMonth = page.getByRole('button', { name: '前の月' })
  if (await prevMonth.count()) {
    await prevMonth.click()
    await wait(page, 1500)
    const cell = page.locator('button[data-date]').first()
    await crop(page, 'plan-month-photo', cell, { top: 130, padTop: 26, padBottom: 6, extraBottom: 210 })
    await page.getByRole('button', { name: '次の月' }).click()
    await wait(page, 1200)
  }

  // ======== 買い物メモ ========
  await page.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await page.getByRole('button', { name: '買い物メモ', exact: true }).click()
  await wait(page, 600)
  await page.getByRole('button', { name: 'レシピから追加', exact: true }).click()
  await wait(page, 900)
  const plusButtons = page.getByRole('button', { name: '食数を増やす' })
  const plusCount = Math.min(await plusButtons.count(), 3)
  for (let i = 0; i < plusCount; i++) {
    await plusButtons.nth(i).click()
    await wait(page, 180)
  }
  await page.getByRole('button', { name: '下書きを作る' }).click()
  await wait(page, 1400)
  const draft = page.locator('section').filter({ hasText: '買い物メモ（下書き）' }).last()
  const unchecked = draft.locator('button[aria-pressed="false"]')
  for (let i = (await unchecked.count()) - 1; i >= 0; i--) {
    await unchecked.nth(i).click()
    await wait(page, 100)
  }
  const addConfirmed = page.getByRole('button', { name: '買い物メモに追加' })
  if (await addConfirmed.count()) {
    await addConfirmed.click()
    await wait(page, 1400)
  }
  await wait(page, 6500) // 追加トーストが消えるのを待つ
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 400)
  // 売り場順(野菜・きのこ → 肉・魚介 …)が分かる範囲
  await cropRect(page, 'shopping', { x: 0, y: 150, width: VIEW.width, height: 540 })

  // ======== 食材の在庫 ========
  await page.getByRole('button', { name: '食材の在庫', exact: true }).click()
  await wait(page, 1000)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 400)
  const pantryGroup = page.getByText('肉・魚介', { exact: true }).first()
  if (await pantryGroup.count()) {
    await crop(page, 'pantry', pantryGroup, { top: 110, padTop: 12, extraBottom: 380 })
  }

  // ======== レシピ詳細(写真つき) ========
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await page.getByPlaceholder('料理名・材料・タグ').fill('カレーライス')
  await wait(page, 800)
  await page.locator('main a[href*="/recipes/"]:not([href$="/new"])').first().click()
  await wait(page, 1400)
  // 「食数の設定」「台所の器具」の初回の案内(2026-08-13 便GE)は、レシピ詳細を初めて開いたときに
  // 1回だけ出る。撮影用の端末は毎回まっさらなので必ずここで出て、以降の操作を全部ふさぐ
  // (2026-08-15 便GN で撮り直したときに実際に止まった)。閉じると次からは出ない
  const firstSetupDismiss = page.locator('[data-testid="first-setup-notice-dismiss"]')
  if (await firstSetupDismiss.count()) {
    await firstSetupDismiss.click()
    await wait(page, 600)
  }
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 400)
  await cropRect(page, 'detail-photo', { x: 0, y: 44, width: VIEW.width, height: 338 })

  // 栄養価の概算(閉じた1行)
  const nutToggle = page.getByRole('button', { name: '栄養価の概算を詳しく見る' })
  if (await nutToggle.count()) {
    const nutEl = await nutToggle.first().elementHandle()
    await nutEl.scrollIntoViewIfNeeded()
    await wait(page, 300)
    await nutEl.click()
    await wait(page, 1000)
    await nutEl.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 70))
    await wait(page, 400)
    await cropRect(page, 'nutrition-open', { x: 0, y: 58, width: VIEW.width, height: 470 })
    await nutEl.click()
    await wait(page, 500)
  }

  // 共有(シェアする内容)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 300)
  await page.locator('button[aria-label="シェア"]').first().click()
  await wait(page, 1000)
  const shareDialog = page.getByRole('dialog', { name: 'シェアする内容' })
  if (await shareDialog.count()) {
    await crop(page, 'share', shareDialog, { top: 20, maxHeight: 600 })
    const closeShare = shareDialog.getByRole('button', { name: '閉じる' })
    if (await closeShare.count()) {
      await closeShare.first().click()
      await wait(page, 500)
    } else {
      await page.keyboard.press('Escape')
      await wait(page, 500)
    }
  }

  // ======== 作った記録 ========
  await page.goto(`${BASE}/#/history`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 400)
  await cropRect(page, 'logs', { x: 0, y: 44, width: VIEW.width, height: 362 })

  // ======== 調理中モード ========
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await page.getByPlaceholder('料理名・材料・タグ').fill('肉じゃが')
  await wait(page, 800)
  await page.locator('main a[href*="/recipes/"]:not([href$="/new"])').first().click()
  await wait(page, 1200)
  await page.getByText('調理中モードで見る').click()
  await wait(page, 1200)
  const focusLayer = page.locator('div.fixed.inset-0.z-50').last()
  let timerBtn = focusLayer.getByRole('button', { name: /タイマー開始/ })
  for (let i = 0; i < 6 && (await timerBtn.count()) === 0; i++) {
    await page.getByRole('button', { name: '次へ' }).click()
    await wait(page, 600)
    timerBtn = focusLayer.getByRole('button', { name: /タイマー開始/ })
  }
  // 2026-08-10 便FJ: 声で操作の案内に「読み上げ」「一時停止」「再開」が加わって4行になり
  // (2026-08-10 便FC)、134pxでは最後の行が画面のふちに貼り付いていた。
  // タイマーのマーク(y=132〜176)まで入る高さにして、案内文の下に余白を作る
  await cropRect(page, 'cookmode-voice', { x: 0, y: 0, width: VIEW.width, height: 184 })
  await cropRect(page, 'cookmode', { x: 0, y: 240, width: VIEW.width, height: 440 })
  if (await timerBtn.count()) {
    await timerBtn.first().click()
    await wait(page, 1400)
  }
  const adjust = page.locator('[aria-label*="のタイマーを調整"]')
  if (await adjust.count()) {
    await adjust.first().click()
    await wait(page, 1000)
  }
  const timerDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  if (await timerDialog.count()) {
    // 2026-08-08 便DW: 調整の窓に「このタイマーを消音」「手順◯を開く」が増えた
    // (2026-08-03 実機FB③④)ので、maxHeight 290 では下が切れる。窓が丸ごと入る高さにする
    // (トリミング基準=説明しているパネルを縦に丸ごと収める)
    // 2026-08-10 便FJ: 窓に「一時停止」が増えて背が高くなり(2026-08-10 便FC)、上に8pxの
    // 余白を取ると、窓の後ろにある「残り時間はアプリを閉じても続きます…」の案内が
    // 1行だけ途中で切れて写り込む。窓の上端ちょうどから切り出す
    await crop(page, 'timer', timerDialog, { top: 40, padTop: 0, maxHeight: 560 })
  }
  const stopTimer = timerDialog.getByRole('button', { name: 'タイマーを消す' })
  if (await stopTimer.count()) {
    await stopTimer.first().click()
    await wait(page, 700)
  }
  const closeAdjust = timerDialog.getByRole('button', { name: '閉じる' })
  if (await closeAdjust.count()) {
    await closeAdjust.first().click()
    await wait(page, 400)
  }

  // ======== 設定「台所の器具」(2026-08-15 便GN) ========
  // 使い方ページ§9の「台所の器具に合わせて段取りを組みます」の図。
  // 段取りの前提になる設定なので、並行調理ナビの図より前に撮っておく(読む順番と同じ)。
  // 欄が丸ごと収まるところまで切る(トリミング基準)。既定のまま=コンロ2口・3つとも「持っている」
  await page.goto(`${BASE}/#/settings?section=kitchen`, { waitUntil: 'networkidle' })
  await wait(page, 1800)
  const kitchenSection = page.locator('#kitchen-section')
  if (await kitchenSection.count()) {
    // タブの帯が画面の上に貼り付いているので、欄の見出しがその下に来る位置まで送ってから切る
    await crop(page, 'settings-kitchen', kitchenSection, { top: 110, padTop: 10, padBottom: 10 })
  }

  // ======== 並行調理ナビ ========
  // 今日の献立を「肉じゃが」「ほうれん草のおひたし」の2品だけにしてから開く。
  // 2026-08-09 便EU: 以前は「2品に満たなければ足す」だったが、この時点では上の週タブで
  // 献立を入れているため今日の枠が別の料理で埋まっていることがあり、撮るたびに段取りの
  // 中身が変わっていた(同 便ESで今週の献立の予定も候補に入るようになったため)。
  // 説明書の図は毎回同じ絵にしたいので、今日の献立を作り直して固定する。
  await page.evaluate(async () => {
    const openDb = () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('uchi-recipe')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
    const P = (req) =>
      new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
    const db = await openDb()
    const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
    await P(store('todayList').clear())
    const recipes = await P(store('recipes').getAll())
    // 2026-08-11 便FK: 3品目(豚汁)を足す。段取りの図(cooknavi)は今までどおり2品で撮り、
    // そのあとで3品目を入れ直して調理中モードの2カットを撮る
    // (色の目印は「他の品」の行に出るので、2品だと1本しか写らない)
    const wanted = ['肉じゃが', 'ほうれん草のおひたし', '豚汁']
    let addedAt = Date.now()
    for (const title of wanted) {
      const r = recipes.find((x) => x.title === title || x.title.startsWith(title))
      if (!r) continue
      await P(store('todayList').add({ recipeId: r.id, addedAt: addedAt++ }))
    }
    db.close()
  })
  await page.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 1800)
  // 組み合わせるレシピを「肉じゃが」「ほうれん草のおひたし」の2品に固定する(2026-08-09 便EU)。
  // 今日の献立だけでなく今週の献立の予定も候補に並び、既定で選ばれた状態で出る
  // (2026-08-09 便ES)ため、今日の献立を作り直すだけでは段取りの中身が固定できなかった。
  // 外す操作を先に済ませてから入れる(選べるのは3品までで、先に入れると弾かれるため)。
  const NAVI_PICKS = ['肉じゃが', 'ほうれん草のおひたし']
  const pickButtons = page.locator('main button[aria-pressed]')
  for (const onlyTurnOff of [true, false]) {
    const count = await pickButtons.count()
    for (let i = 0; i < count; i++) {
      const btn = pickButtons.nth(i)
      const label = ((await btn.textContent()) ?? '').trim()
      const shouldBeOn = NAVI_PICKS.some((t) => label.startsWith(t))
      const isOn = (await btn.getAttribute('aria-pressed')) === 'true'
      if (isOn === shouldBeOn) continue
      if (onlyTurnOff !== isOn) continue
      await btn.click()
      await wait(page, 200)
    }
  }
  const makePlan = page.getByRole('button', { name: '段取りを作る' })
  if (await makePlan.count()) {
    await makePlan.click()
    await wait(page, 1600)
  }
  // どの待ちの帯を撮るか(2026-08-09 便EU)。
  // 使い方ページ§9の本文が触れているのは「タイマーを始める」と「手順ごとに出る材料と分量」の
  // 2つなので、その両方が1枚に収まる帯を選ぶ。手順の本文に分数が書かれている待ち
  // (「中火で15分煮る」など)は本文の「15分」自体がタイマーのボタンになり帯にはボタンが
  // 出ないため、先頭の帯を無条件に撮ると本文と食い違う絵になっていた。
  // 待ちの帯は「約◯分の待ち時間」と「沸くまでの待ち時間」の2種類がある（2026-08-13 便GDで「湯が」を外した）
  // (ナビが足した湯沸かしは分数を出さない。2026-08-09 便ES)ので、両方を候補に入れる。
  const WAIT_BAND = /(約.+|沸くまで)の待ち時間/
  const waitCards = page.locator('main li').filter({ hasText: WAIT_BAND })
  let waitIndex = 0
  if (await waitCards.count()) {
    const picked = await waitCards.evaluateAll((cards) => {
      const hasStartTimer = (el) =>
        [...el.querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('タイマーを始める'))
      const nextHasIngredients = (el) =>
        !!el.nextElementSibling?.querySelector('[data-testid="navi-step-ingredients"]')
      const byBoth = cards.findIndex((el) => hasStartTimer(el) && nextHasIngredients(el))
      if (byBoth >= 0) return byBoth
      return cards.findIndex((el) => hasStartTimer(el))
    })
    if (picked >= 0) waitIndex = picked
  }
  const waitCard = waitCards.nth(waitIndex)
  // 次の手順の材料の行までを下端にする(2026-08-15 便GN)。
  // 2026-08-14 便GJ で手順カードに「上へ」「下へ」の行が増え、切り出しの高さを px で
  // 決め打ちしていたぶん(y=108・320px)では次の手順の本文が途中で切れていた。
  // 高さを測って切る形にすれば、カードの中身が増えても本文の途中では切れない
  const nextIngredients = waitCard.locator(
    'xpath=following-sibling::li[1]//*[@data-testid="navi-step-ingredients"]',
  )
  if ((await waitCard.count()) && (await nextIngredients.count())) {
    await cropRange(page, 'cooknavi', waitCard, nextIngredients, { top: 60, padBottom: 2 })
  } else if (await waitCard.count()) {
    await crop(page, 'cooknavi', waitCard, { top: 60, padBottom: 12, extraBottom: 220 })
  } else {
    await cropRect(page, 'cooknavi', { x: 0, y: 60, width: VIEW.width, height: 300 })
  }

  // ======== できあがりの目安(2026-08-15 便GN) ========
  // 使い方ページ§9の「できあがりの目安」の図。品ごとの分数と、その開きの一言が入る枠を
  // 丸ごと切る。**手で並べ替える前**に撮る(並べ替えたあとは分数が灰色になるため、
  // 自動で組んだ並びのときの見え方をここで写す)
  const finishPanel = page.locator('[data-testid="navi-finish-times"]')
  if (await finishPanel.count()) {
    await crop(page, 'cooknavi-finish', finishPanel, { top: 72, padTop: 4, padBottom: 6 })
  } else {
    console.warn('  ⚠ できあがりの目安の枠が見つかりませんでした')
  }

  // ======== 段取りの並べ替え(2026-08-15 便GN) ========
  // 使い方ページ§9の「段取りの順番を自分で変える」の2枚。
  //  cooknavi-reorder      … 手順カードの「上へ」「下へ」と、無理な並びになったときの印
  //  cooknavi-reorder-undo … 戻す欄(1つ前の並びに戻す/自動の並びに戻す)と印のまとめ
  //
  // 印が出る並びを**作ってから**撮る。同じ品の2つめ以降の手順を先頭まで押し上げると
  // 「レシピに書いた順番より前に出ています」の印が必ず付く(logic/cookReorder.ts)。
  // 動かした手順が先頭に来るので、印の付いたカードの位置が毎回同じになる。
  //
  // カードのDOM id は navi-step-<レシピの番号>-<手順の呼び名>(CookNaviPage.tsx naviStepDomId)。
  // レシピの番号が一度出たあとに同じ番号がまた出てくる位置＝その品の2つめ以降の手順
  const reorderFrom = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('main ol > li')]
    const seen = new Set()
    for (let i = 0; i < cards.length; i++) {
      const id = cards[i].id ?? ''
      const recipeId = id.split('-')[2]
      if (!recipeId) continue
      if (seen.has(recipeId)) return i
      seen.add(recipeId)
    }
    return -1
  })
  if (reorderFrom > 0) {
    for (let at = reorderFrom; at > 0; at--) {
      const up = page.locator('[data-testid="navi-step-up"]').nth(at)
      await up.scrollIntoViewIfNeeded()
      await wait(page, 200)
      await up.click()
      await wait(page, 500)
    }
    const movedCard = page.locator('main ol > li').first()
    if (await movedCard.count()) {
      await crop(page, 'cooknavi-reorder', movedCard, { top: 72, padTop: 8, padBottom: 8 })
    }
    const reorderState = page.locator('[data-testid="navi-reorder-state"]')
    if (await reorderState.count()) {
      await crop(page, 'cooknavi-reorder-undo', reorderState, { top: 72, padTop: 8, padBottom: 8 })
    }
    // 撮り終えたら自動の並びに戻す(このあとの調理中モードのカットに並べ替えを持ち込まない)。
    // 「自動の並びに戻す」は確認の窓が開くので、押した回数ぶん1つずつ戻す
    for (let i = 0; i < reorderFrom; i++) {
      const undoOne = page.locator('[data-testid="navi-reorder-undo"]')
      if ((await undoOne.count()) === 0) break
      await undoOne.scrollIntoViewIfNeeded()
      await wait(page, 200)
      await undoOne.click()
      await wait(page, 500)
    }
  } else {
    console.warn('  ⚠ 印の出る並びを作れませんでした（同じ品の2つめの手順が見つからない）')
  }

  // ======== 並行調理ナビの調理中モード(2026-08-11 便FK) ========
  // 使い方ページ§9に足した3つの節(段取りを調理中モードで見る／他の品の次の手順／
  // 色を言って別の品の手順に移る)の図。上の cooknavi は2品で固定してあるので、
  // ここで3品目を足してから撮る = 上のカットの絵は変えない。
  const naviRepick = page.getByRole('button', { name: 'レシピを選び直す' })
  if (await naviRepick.count()) {
    await naviRepick.click()
    await wait(page, 800)
    // 3品目(豚汁)を入れる。段取りに3品あると「他の品の次の手順」が2行になり、
    // 色の名前(青・緑・ピンク)が2つ写る
    const thirdPick = page.locator('main button[aria-pressed]').filter({ hasText: '豚汁' }).first()
    if ((await thirdPick.count()) && (await thirdPick.getAttribute('aria-pressed')) !== 'true') {
      await thirdPick.click()
      await wait(page, 300)
    }
    const makePlan3 = page.getByRole('button', { name: '段取りを作る' })
    if (await makePlan3.count()) {
      await makePlan3.click()
      await wait(page, 1600)
    }
  }
  const sessionStart = page.locator('[data-testid="cook-session-start"]')
  if (await sessionStart.count()) {
    await sessionStart.click()
    await wait(page, 900)
    // 「他の品の次の手順」に**完成した品と、まだ手順の残っている品が並ぶ**ところまで進める。
    // 1枚で「色の名前」「作り終えた品の1行(完成)」の両方が写る位置(説明している範囲と一致させる)。
    // 左上の「手順①へ」も、先頭にいる間は押せない見た目なので、進めてから撮る
    let reached = false
    for (let i = 0; i < 30; i++) {
      const done = await page.locator('[data-testid="cook-session-other-done"]').count()
      const rows = await page.locator('[data-testid="cook-session-other-row"]').count()
      if (done >= 1 && rows >= 2) {
        reached = true
        break
      }
      const next = page.locator('[data-testid="cook-session-next"]')
      if ((await next.count()) === 0) break
      await next.click()
      await wait(page, 220)
    }
    if (!reached) {
      console.warn('  ⚠ 調理中モードで「完成」と残りの手順が並ぶ位置に届きませんでした（図の説明と食い違わないか確認すること）')
    }
    // 上部: ✕ / 最初の手順へ / 料理名 / 段取り◯/◯ / 声で操作・読み上げ。
    // 2026-08-11 便FO: 声で使える言葉の案内は「声で操作」をONにしている間だけ出るようにしたので、
    // この図は**既定の状態（声を使っていないとき）**を写す。言葉の一覧は本文の§8に書いてある
    const sessionHeaderHeight = await page.evaluate(() => {
      const header = document.querySelector('[data-testid="cook-session"] > div')
      return header ? Math.round(header.getBoundingClientRect().bottom) : 0
    })
    if (sessionHeaderHeight > 0) {
      await cropRect(page, 'cooknavi-session', {
        x: 0,
        y: 0,
        width: VIEW.width,
        height: sessionHeaderHeight + 10,
      })
    }
    // 下部: 他の品の次の手順(色の名前・完成の印)。枠が丸ごと入る高さで切る
    const othersPanel = page.locator('[data-testid="cook-session-others"]')
    if (await othersPanel.count()) {
      const othersRect = await rectOf(othersPanel)
      const othersY = Math.max(0, Math.round(othersRect.y - 6))
      await cropRect(page, 'cooknavi-session-others', {
        x: 0,
        y: othersY,
        width: VIEW.width,
        height: Math.min(VIEW.height - othersY, Math.round(othersRect.h + 12)),
      })
    }
    const sessionClose = page.locator('[data-testid="cook-session-close"]')
    if (await sessionClose.count()) {
      await sessionClose.click()
      await wait(page, 500)
    }
  }

  // ======== バックアップ ========
  await page.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
  await wait(page, 2000)
  const exportBtn = page.getByRole('button', { name: 'ファイルに書き出す' }).first()
  const photoCheck = page.getByText(/「作った記録」の写真もバックアップに含める/).first()
  if ((await photoCheck.count()) && (await exportBtn.count())) {
    await cropRange(page, 'backup-export', photoCheck, exportBtn, { top: 120, padBottom: 14 })
  } else if (await exportBtn.count()) {
    await crop(page, 'backup-export', exportBtn, { top: 300, padTop: 14, padBottom: 14 })
  }
  const importBtn = page.getByRole('button', { name: /今のデータに追加/ }).first()
  const replaceBtn = page.getByRole('button', { name: /データを上書き/ }).first()
  if ((await importBtn.count()) && (await replaceBtn.count())) {
    await cropRange(page, 'backup-import', importBtn, replaceBtn, { top: 160, padBottom: 110 })
  }

  // ======== 無料版での栄養の見え方(カロリー + 野菜量) ========
  // ここまではPro解錠で撮っている。§5「無料で見られるのはカロリーと野菜量です」に載せる
  // 1行は、解錠を外した状態で撮り直す
  await page.evaluate(async () => {
    const openDb = () =>
      new Promise((resolve, reject) => {
        const r = indexedDB.open('uchi-recipe')
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
      })
    const P = (req) =>
      new Promise((res, rej) => {
        req.onsuccess = () => res(req.result)
        req.onerror = () => rej(req.error)
      })
    const db = await openDb()
    const st = db.transaction('settings', 'readwrite').objectStore('settings')
    const cur = (await P(st.get(1))) ?? { id: 1 }
    delete cur.proCode
    delete cur.proActivatedAt
    await P(db.transaction('settings', 'readwrite').objectStore('settings').put({ ...cur, id: 1 }))
    db.close()
  })
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 1800)
  await page.getByPlaceholder('料理名・材料・タグ').fill('カレーライス')
  await wait(page, 900)
  await page.locator('main a[href*="/recipes/"]:not([href$="/new"])').first().click()
  await wait(page, 1500)
  const freeNut = page.getByRole('button', { name: '栄養価の概算を詳しく見る' })
  if (await freeNut.count()) {
    await crop(page, 'nutrition-row', freeNut, { top: 300, padTop: 10, padBottom: 10 })
  }
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  const weekTab2 = page.getByRole('button', { name: '週', exact: true })
  if (await weekTab2.count()) {
    await weekTab2.click()
    await wait(page, 900)
    const freeDayRows = page.getByRole('button', {
      name: /^この日（.+）の栄養の概算を詳しく見る$/,
    })
    const richFreeDayRows = freeDayRows.filter({ hasText: /野菜約\d{3}g/ })
    const freeDayRow = (await richFreeDayRows.count())
      ? richFreeDayRows.first()
      : freeDayRows.first()
    if (await freeDayRow.count()) {
      await crop(page, 'plan-week-nutrition-row', freeDayRow, { top: 300, padTop: 10, padBottom: 10 })
    }
  }

  report()
} catch (e) {
  if (!(e instanceof AllRequestedDone)) throw e
  console.log('\nONLYで指定したぶんを撮り終えたので、ここで打ち切りました')
  report()
} finally {
  await browser.close()
}
