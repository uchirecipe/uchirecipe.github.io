// 便FT の実DOMスクリーンショット（報告用・恒久テストではない）
import { chromium } from 'playwright'

const BASE = 'http://localhost:4365'
const OUT = '/Users/misaf/Documents/Claude/Projects/料理アプリ/dom-shots'
const seed = async (page) => page.evaluate(async () => {
  const openDb = () => new Promise((resolve, reject) => { const r = indexedDB.open('uchi-recipe'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const db = await openDb()
  const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
  const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
  const mk = (title, steps, ingredients = []) => ({
    title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps,
    isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
  })
  const idA = await P(store('recipes').add(mk('鶏の照り焼き', [
    { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
    { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
    { text: 'たれを加えて煮からめ、器に盛る。' },
  ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
  const idB = await P(store('recipes').add(mk('大根の煮物', [
    { text: '大根は一口大に切る。' },
    { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
    { text: '火を止めて10分おき、器に盛る。', minutes: 10 },
  ], [{ name: '大根', amount: '1/3', unit: '本' }])))
  const idC = await P(store('recipes').add(mk('パプリカのマリネ', [
    { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
    { text: 'パプリカときゅうりを細切りにする。' },
    { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
  ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
  let addedAt = Date.now()
  for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
  const cur = (await P(store('settings').get(1))) || { id: 1 }
  await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
  db.close()
  return [idA, idB, idC]
})

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()
page.on('dialog', (d) => void d.accept())
await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
await page.waitForTimeout(1800)
const ids = await seed(page)
await page.goto(`${BASE}/#/cook-navi`)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.getByRole('button', { name: '段取りを作る' }).click()
await page.waitForTimeout(900)
await page.locator('[data-testid="cook-session-start"]').click()
await page.waitForTimeout(600)
for (let i = 0; i < 3; i++) { await page.locator('[data-testid="cook-session-next"]').click(); await page.waitForTimeout(220) }
await page.locator('[data-testid="cook-session-close"]').click()
await page.waitForTimeout(600)

// ①アプリを開き直したあとの並行調理ナビ（段取り＋続きから見る）
const p2 = await ctx.newPage()
p2.on('dialog', (d) => void d.accept())
await p2.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
await p2.waitForTimeout(2000)
await p2.locator('[data-testid="cook-session-start"]').scrollIntoViewIfNeeded()
await p2.waitForTimeout(400)
await p2.screenshot({ path: `${OUT}/ft_reopen_resume.png` })

// ②段取りの説明に入れた「どこまで残るか」の1行
await p2.evaluate(() => window.scrollTo({ top: 0 }))
await p2.waitForTimeout(400)
await p2.locator('[data-testid="navi-restore-keep-note"]').scrollIntoViewIfNeeded()
await p2.waitForTimeout(400)
await p2.screenshot({ path: `${OUT}/ft_keep_note.png` })

// ③献立タブの「並行調理ナビを再開」（開き直したあとも出る）
const p3 = await ctx.newPage()
p3.on('dialog', (d) => void d.accept())
await p3.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
await p3.waitForTimeout(1800)
await p3.screenshot({ path: `${OUT}/ft_mealplan_resume.png` })

// ④日付が変わったときの知らせ
await p3.evaluate((recipeIds) => {
  localStorage.setItem('uchi-recipe-cook-navi-session', JSON.stringify({
    v: 1, date: '2000-01-01', selectedIds: recipeIds, showTimeline: true, trialActive: false,
    current: { recipeId: recipeIds[0], stepIndex: 1 },
  }))
}, ids)
const p4 = await ctx.newPage()
p4.on('dialog', (d) => void d.accept())
await p4.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
await p4.waitForTimeout(2000)
await p4.screenshot({ path: `${OUT}/ft_expired_notice.png` })

await browser.close()
console.log('shots done')
