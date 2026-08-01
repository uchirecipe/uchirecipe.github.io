// 使い方ページ(public/about/manual.html)に載せる実機スクリーンショットを撮り直すスクリプト。
//
// 使い方:
//   npm run build
//   npm run preview -- --port 4281 --strictPort   (別ターミナル)
//   BASE_URL=http://localhost:4281 npx tsx scripts/shots-manual.mjs
//
// 仕様:
//  - 390x844(iPhone相当)・ライトテーマ・deviceScaleFactor 2 で撮る
//  - 空画面を載せないため、撮影前に見栄えのするデモデータを投入する
//    (Pro解錠・週/月の献立・買い物メモ・在庫・作った記録)
//  - 出力は public/about/img/manual/*.webp (1枚100KB以下を目安)
//  - オーナーのdevサーバー(5173)は不可侵。BASE_URLは必ずpreviewを指すこと

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import sharp from 'sharp'

const BASE = process.env.BASE_URL ?? ''
if (!BASE || /:5173(\/|$)/.test(BASE)) {
  console.error('BASE_URLにpreview(例: http://localhost:4281)を指定してください（5173は不可）')
  process.exit(1)
}
const OUT_DIR = path.resolve(fileURLToPath(new URL('../public/about/img/manual/', import.meta.url)))
fs.mkdirSync(OUT_DIR, { recursive: true })

const VIEWPORT = { width: 390, height: 844 }
const sizes = []

const wait = (page, ms) => page.waitForTimeout(ms)

async function shot(page, name, ms = 400) {
  await wait(page, ms)
  const png = await page.screenshot()
  const webp = await sharp(png).webp({ quality: 74, effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${name}.webp`), webp)
  sizes.push([name, webp.length])
  console.log(`  ${name}.webp  ${(webp.length / 1024).toFixed(1)}KB`)
}

/** IndexedDBへ直接書き込むデモデータ投入(Pro解錠・在庫・作った記録) */
async function seedDirect(page) {
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

    // Pro解錠(月間献立・栄養8項目・並行調理ナビの画面を撮るため)
    const cur = (await P(store('settings').get(1))) ?? { id: 1 }
    await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-DEMO-SHOT', proActivatedAt: Date.now() }))

    // 在庫: プリセット12品の状態を「ある/少ない/ない」に散らし、グループが分かれるよう数品足す
    // 「ある」の食材は買い物メモの下書きに出ないので、生鮮は low/none 中心にして
    // 買い物メモの画面が空にならないようにする
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

    // 作った記録: 直近の日付に散らす(月カレンダーの「記録あり」印・記録ページ・よく使う順のため)
    const ymd = (offsetDays) => {
      const d = new Date()
      d.setDate(d.getDate() - offsetDays)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    const logPlan = [
      ['肉じゃが', [{ date: ymd(1), servings: 4, note: '少し甘めにしたら好評だった' }, { date: ymd(9), servings: 4 }]],
      ['鶏の照り焼き', [{ date: ymd(2), servings: 3 }, { date: ymd(7), servings: 3, note: '皮をパリッと焼けた' }]],
      ['豚のしょうが焼き', [{ date: ymd(3), servings: 2 }, { date: ymd(11), servings: 2 }]],
      ['ほうれん草のおひたし', [{ date: ymd(2), servings: 2 }, { date: ymd(5), servings: 2 }]],
      ['カレーライス', [{ date: ymd(4), servings: 4, note: '2日目のほうが好み' }]],
      ['みそ汁', [{ date: ymd(1), servings: 3 }, { date: ymd(3), servings: 3 }, { date: ymd(6), servings: 3 }]],
      ['麻婆豆腐', [{ date: ymd(6), servings: 3 }]],
      ['きんぴらごぼう', [{ date: ymd(8), servings: 2, note: '作り置きで3日もった' }]],
    ]
    const recipes = await P(store('recipes').getAll())
    const applied = []
    for (const [title, logs] of logPlan) {
      const r = recipes.find((x) => x.title === title || x.title.startsWith(title))
      if (!r) continue
      await P(store('recipes').put({ ...r, cookedLogs: logs, updatedAt: r.updatedAt }))
      applied.push(r.title)
    }
    db.close()
    return applied
  })
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  colorScheme: 'light',
  locale: 'ja-JP',
})
const page = await context.newPage()
page.on('dialog', (d) => d.accept())

try {
  // ---- 初回シード + デモデータ投入 ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 2500)
  await seedDirect(page)
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 1500)

  // ---- 献立(週): まとめて献立を立てる → 栄養行を開く ----
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await page.getByRole('button', { name: '週', exact: true }).click()
  await wait(page, 400)
  await page.getByRole('button', { name: '今日から7日間', exact: true }).click()
  await wait(page, 500)
  await page.getByRole('button', { name: 'まとめて献立を立てる' }).click()
  await wait(page, 1800)
  const dayToggle = page.getByRole('button', { name: /^この日（.+）の栄養のめやすを詳しく見る$/ }).first()
  if (await dayToggle.count()) {
    // クリックすると読み上げ名が「閉じる」に変わるので、実体を掴んでから操作する
    const toggleEl = await dayToggle.elementHandle()
    await toggleEl.scrollIntoViewIfNeeded()
    await wait(page, 300)
    await toggleEl.click()
    await wait(page, 700)
    // 展開した行を画面の上から260pxの位置に置く(上に日付・主菜副菜、下に栄養パネルが入る)
    await toggleEl.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 260))
  }
  await shot(page, 'plan-week')

  // ---- 献立(月): 未定の日をまとめて提案 ----
  await page.getByRole('button', { name: '月', exact: true }).click()
  await wait(page, 700)
  const fillMonth = page.getByRole('button', { name: '未定の日をまとめて提案' })
  if (await fillMonth.count()) {
    await fillMonth.click()
    await wait(page, 2500)
  }
  await wait(page, 6500) // 結果トーストが自動で消えるのを待つ(画面を隠さない)
  // カレンダーの1マス目を上から120pxに置く(曜日の見出しごと1枚に収める)
  const firstCell = page.locator('button[data-date]').first()
  await firstCell.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 120))
  await shot(page, 'plan-month')

  // ---- 献立(日): おまかせで提案 → 今日の献立2品 ----
  await page.getByRole('button', { name: '日', exact: true }).click()
  await wait(page, 700)
  const suggest = page.getByRole('button', { name: 'おまかせで提案' })
  if (await suggest.count()) {
    await suggest.click()
    await wait(page, 1500)
  }

  // 今日の献立が2品に満たなければ直接足す(並行調理ナビは2品以上で開けるため)
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
    const today = await P(store('todayList').getAll())
    const recipes = await P(store('recipes').getAll())
    const wanted = ['肉じゃが', 'ほうれん草のおひたし', 'みそ汁']
    let addedAt = Date.now()
    const has = new Set(today.map((t) => t.recipeId))
    for (const title of wanted) {
      if (has.size >= 2) break
      const r = recipes.find((x) => x.title === title || x.title.startsWith(title))
      if (!r || has.has(r.id)) continue
      await P(store('todayList').add({ recipeId: r.id, addedAt: addedAt++ }))
      has.add(r.id)
    }
    db.close()
  })

  // ---- 並行調理ナビ ----
  await page.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
  await page.reload({ waitUntil: 'networkidle' })
  await wait(page, 1500)
  const makePlan = page.getByRole('button', { name: '段取りを作る' })
  if (await makePlan.count()) {
    await makePlan.click()
    await wait(page, 1200)
    const naviHead = page.getByText('組み合わせる2品').first()
    if (await naviHead.count()) {
      await naviHead.evaluate((el) => {
        const card = el.closest('section, div[class*="rounded"]')
        ;(card ?? el).scrollIntoView({ block: 'start' })
        window.scrollBy(0, -12)
      })
    }
  }
  await shot(page, 'cooknavi')

  // ---- ホーム ----
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await wait(page, 1500)
  await shot(page, 'home')

  // ---- レシピ一覧 ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await shot(page, 'recipes')

  // ---- 検索(かな表記ゆれ) ----
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('たまねぎ')
  await wait(page, 800)
  await shot(page, 'search')
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('')
  await wait(page, 400)

  // ---- 登録フォーム(かんたん) ----
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await wait(page, 800)
  const discard = page.getByRole('button', { name: '破棄する' })
  if (await discard.count()) {
    await discard.click()
    await wait(page, 400)
  }
  await page.getByPlaceholder('例: 肉じゃが').fill('鶏むね肉のさっぱり煮')
  // 「例: じゃがいも」は手順欄(例: じゃがいもを一口大に切る)にも前方一致するのでexactで取る
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
  const steps = page.getByPlaceholder('例: じゃがいもを一口大に切る')
  const stepTexts = ['鶏むね肉を一口大のそぎ切りにする', 'しょうゆと酢を入れて弱火で10分煮る']
  for (let i = 0; i < stepTexts.length; i++) {
    if ((await steps.count()) <= i) {
      await page.getByRole('button', { name: '手順を追加' }).click()
      await wait(page, 300)
    }
    await steps.nth(i).fill(stepTexts[i])
  }
  await wait(page, 300)
  // 「かんたん／くわしく」のタブが頭に入る位置で撮る
  const easyTab = page.getByText('かんたん', { exact: true }).first()
  if (await easyTab.count()) {
    await easyTab.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - 96))
  }
  await shot(page, 'register-form')

  // ---- テキスト貼り付けで自動入力 ----
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await wait(page, 800)
  const discard2 = page.getByRole('button', { name: '破棄する' })
  if (await discard2.count()) {
    await discard2.click()
    await wait(page, 400)
  }
  await page.getByPlaceholder('例: 肉じゃが').fill('なすとピーマンのみそ炒め')
  await page.getByText('テキスト貼り付けで自動入力').click()
  await wait(page, 400)
  await page.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]').fill(
    'なすとピーマンのみそ炒め\n\n材料（2人分）\n・なす 2本\n・ピーマン 3個\n・豚こま切れ肉 150g\n・みそ 大さじ1\n\n作り方\n1. なすとピーマンを乱切りにする\n2. 豚こまを炒め、なす・ピーマンを加えて炒める\n3. みそを加えて全体にからめる',
  )
  await page.getByRole('button', { name: '自動で振り分ける' }).click()
  await wait(page, 900)
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'paste')

  // ---- 買い物メモ(売り場順) ----
  await page.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
  await wait(page, 900)
  await page.getByRole('button', { name: '買い物メモ', exact: true }).click()
  await wait(page, 500)
  await page.getByRole('button', { name: 'レシピから追加', exact: true }).click()
  await wait(page, 700)
  const plusButtons = page.getByRole('button', { name: '食数を増やす' })
  const plusCount = Math.min(await plusButtons.count(), 6)
  for (let i = 0; i < plusCount; i++) {
    await plusButtons.nth(i).click()
    await wait(page, 200)
  }
  await page.getByRole('button', { name: '下書きを作る' }).click()
  await wait(page, 1200)
  // 下書きは調味料だけ既定でチェックが外れている。売り場順の全体を見せたいので全部チェックする
  const draft = page.locator('section').filter({ hasText: '買い物メモ（下書き）' }).last()
  const unchecked = draft.locator('button[aria-pressed="false"]')
  for (let i = (await unchecked.count()) - 1; i >= 0; i--) {
    await unchecked.nth(i).click()
    await wait(page, 120)
  }
  const addConfirmed = page.getByRole('button', { name: '買い物メモに追加' })
  if (await addConfirmed.count()) {
    await addConfirmed.click()
    await wait(page, 1200)
  }
  await wait(page, 6500) // 追加トーストが消えるのを待つ
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'shopping')

  // ---- 食材の在庫(グループ) ----
  await page.getByRole('button', { name: '食材の在庫', exact: true }).click()
  await wait(page, 800)
  await page.evaluate(() => window.scrollTo(0, 0))
  await shot(page, 'pantry')

  // ---- レシピ詳細: 栄養価のめやす(Pro 8項目) ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 900)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await wait(page, 900)
  const nutToggle = page.getByRole('button', { name: '栄養価のめやすを詳しく見る' })
  if (await nutToggle.count()) {
    await nutToggle.scrollIntoViewIfNeeded()
    await wait(page, 300)
    await nutToggle.click()
    await wait(page, 700)
    await page.evaluate(() => window.scrollBy(0, -120))
  }
  await shot(page, 'nutrition')

  // ---- 共有(シェアする内容) ----
  await page.evaluate(() => window.scrollTo(0, 0))
  await wait(page, 300)
  await page.locator('button[aria-label="シェア"]').first().click()
  await wait(page, 800)
  await shot(page, 'share')
  const closeShare = page.getByRole('dialog', { name: 'シェアする内容' }).getByRole('button', { name: '閉じる' })
  if (await closeShare.count()) {
    await closeShare.first().click()
    await wait(page, 400)
  } else {
    await page.keyboard.press('Escape')
    await wait(page, 400)
  }

  // ---- 作った記録(レシピ詳細の記録一覧) ----
  await page.goto(`${BASE}/#/history`, { waitUntil: 'networkidle' })
  await wait(page, 1200)
  await shot(page, 'logs')

  // ---- 調理中モード + タイマー ----
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await wait(page, 900)
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('肉じゃが')
  await wait(page, 600)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await wait(page, 900)
  await page.getByText('調理中モードで見る').click()
  await wait(page, 900)
  // タイマー付きの手順まで進む(時間表記のボタンがある手順を探す)。
  // 裏に残っているレシピ詳細にも同じボタンがあるので、調理中モードの全画面レイヤーに絞る
  const focusLayer = page.locator('div.fixed.inset-0.z-50').last()
  let timerBtn = focusLayer.getByRole('button', { name: /タイマー開始/ })
  for (let i = 0; i < 6 && (await timerBtn.count()) === 0; i++) {
    await page.getByRole('button', { name: '次へ' }).click()
    await wait(page, 500)
    timerBtn = focusLayer.getByRole('button', { name: /タイマー開始/ })
  }
  await shot(page, 'cookmode')
  if (await timerBtn.count()) {
    await timerBtn.first().click()
    await wait(page, 1200)
  }
  const adjust = page.locator('[aria-label*="のタイマーを調整"]')
  if (await adjust.count()) {
    await adjust.first().click()
    await wait(page, 800)
  }
  await shot(page, 'timer')
  // 以降の画面に常駐タイマーのバーが写り込まないよう、ここで停止しておく
  const stopTimer = page.getByRole('dialog', { name: 'タイマーを調整' }).getByRole('button', { name: '停止' })
  if (await stopTimer.count()) {
    await stopTimer.first().click()
    await wait(page, 600)
  }
  const closeAdjust = page.getByRole('dialog', { name: 'タイマーを調整' }).getByRole('button', { name: '閉じる' })
  if (await closeAdjust.count()) {
    await closeAdjust.first().click()
    await wait(page, 300)
  }

  // ---- バックアップ ----
  await page.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
  await wait(page, 1800)
  await page.evaluate(() => window.scrollBy(0, -34))
  await shot(page, 'backup')

  const total = sizes.reduce((s, [, n]) => s + n, 0)
  console.log(`\n合計 ${sizes.length}枚 / ${(total / 1024).toFixed(1)}KB`)
  const over = sizes.filter(([, n]) => n > 100 * 1024)
  if (over.length) console.log('100KB超:', over.map(([n, b]) => `${n}=${(b / 1024).toFixed(1)}KB`).join(' '))
} finally {
  await browser.close()
}
