// 便ES の実DOMスクショ（390px）。dom-shots/es_*.png に出す
import { chromium } from 'playwright'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4336'
const outDir =
  process.env.SHOT_DIR ?? '/Users/misaf/Documents/Claude/Projects/料理アプリ/dom-shots'
mkdirSync(outDir, { recursive: true })
const shot = async (page, name, opts = {}) =>
  page.screenshot({ path: path.join(outDir, `es_${name}.png`), ...opts })

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()
page.on('dialog', (d) => void d.accept())
page.on('pageerror', (e) => console.log('[pageerror]', e.message))

await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
await page.evaluate(async () => {
  const openDb = () => new Promise((res, rej) => { const r = indexedDB.open('uchi-recipe'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  const db = await openDb()
  const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
  const store = (n) => db.transaction(n, 'readwrite').objectStore(n)
  const mk = (title, steps, ingredients = []) => ({
    title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps,
    isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
  })
  const idA = await P(store('recipes').add(mk('ほうれん草のおひたし', [
    { text: 'ほうれん草は根元をよく洗う。' },
    { text: '鍋にたっぷりの湯を沸かし、根元から入れて2分ゆでる。' },
    { text: '冷水にとって水気をしぼり、4cm長さに切る。' },
    { text: 'だしじょうゆをかけ、かつお節をのせる。' },
  ], [{ name: 'ほうれん草', amount: '1', unit: '束' }, { name: 'かつお節', amount: '2', unit: 'g' }])))
  const idB = await P(store('recipes').add(mk('豚バラ大根の煮もの', [
    { text: '大根は1.5cm厚さの半月切りにし、豚バラ薄切り肉は食べやすい長さに切る。' },
    { text: '鍋に油を熱し、豚肉を色が変わるまで炒める。' },
    { text: '大根と水、調味料を加えて中火で15分煮る。', minutes: 15 },
    { text: '器に盛りつける。' },
  ], [{ name: '大根', amount: '1/3', unit: '本' }, { name: '豚バラ薄切り肉', amount: '200', unit: 'g' }])))
  const idC = await P(store('recipes').add(mk('チャーハン', [
    { text: '玉ねぎをみじん切りにする。' },
    { text: 'フライパンに油を熱し、玉ねぎをしんなりするまで炒め、ご飯をほぐしながら炒め合わせる。' },
    { text: '塩こしょうとしょうゆで味をととのえ、器に盛る。' },
  ], [{ name: 'ご飯', amount: '2', unit: '杯' }, { name: '玉ねぎ', amount: '1/2', unit: '個' }])))
  let addedAt = Date.now()
  for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
  const cur = (await P(store('settings').get(1))) || { id: 1 }
  await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
  db.close()
})

await page.goto(`${BASE}/#/cook-navi`)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1500)
await page.getByRole('button', { name: '段取りを作る' }).click()
await page.waitForTimeout(900)
await shot(page, 'navi_full', { fullPage: true })
await page.evaluate(() => window.scrollTo(0, 0))
await shot(page, 'navi_top')

// 段取りの中ほど（湯を沸かす・手順番号3-1/3-2・見積り表示）
const boil = page.locator('li', { hasText: '湯を沸かす' }).first()
if (await boil.count()) {
  await boil.scrollIntoViewIfNeeded()
  await page.waitForTimeout(400)
  await shot(page, 'navi_boil')
}

// 調理中モード
await page.evaluate(() => window.scrollTo(0, 0))
await page.locator('[data-testid="cook-session-start"]').scrollIntoViewIfNeeded()
await page.waitForTimeout(300)
await shot(page, 'navi_session_entry')
if ((await page.locator('[data-testid="cook-session"]').count()) === 0) {
  await page.locator('[data-testid="cook-session-start"]').click()
  await page.waitForTimeout(700)
}
await shot(page, 'session_top')

// 他の品の行を開く
const other = page.locator('[data-testid="cook-session-other-row"]').first()
if (await other.count()) {
  await other.click()
  await page.waitForTimeout(500)
  await shot(page, 'session_peek')
  await other.click()
  await page.waitForTimeout(400)
}

// 次へを進めて待ち工程のタイマーを起動→タイマー表示と調整画面
for (let i = 0; i < 10; i++) {
  const t = page.locator('[data-testid="cook-session"]').getByRole('button', { name: 'タイマーを始める' })
  if (await t.count()) {
    await t.first().click({ timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(500)
  }
  const next = page.locator('[data-testid="cook-session-next"]')
  if (!(await next.count())) break
  await next.click({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(350)
}
await shot(page, 'session_timer')
const chip = page.locator('[data-testid="cook-session-current-timers"] button').first()
if (await chip.count()) {
  await chip.click()
  await page.waitForTimeout(500)
  await shot(page, 'timer_adjust')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}
// 他の品のタイマー（別レシピの手順でタイマーを起動してから戻る）
await shot(page, 'session_others')

await browser.close()
console.log('スクショを出しました:', outDir)
