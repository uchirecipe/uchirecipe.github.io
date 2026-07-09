// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / SMK-02+03(登録・削除) / SMK-04(貼り付け整形) /
//         SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) / SMK-14簡易(未解錠ゲート) /
//         SMK-19(静的ページがアプリ本体にすり替わらない。SWが動くpreviewでの実行時に実質検証) /
//         合わせ調味料ライン表示。console/pageerrorは全工程で監視(既知のCF計測CORSは除外)
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

const errors = []
const results = []
let currentCheck = ''
const ok = (label) => results.push({ label, pass: true })
const ng = (label, detail) => results.push({ label, pass: false, detail })
const check = (label, cond, detail = '') => (cond ? ok(label) : ng(label, detail))

const browser = await chromium.launch()
const context = await browser.newContext() // 毎回まっさらなストレージ(初回シードから検証)
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ
  if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
  errors.push(`[console@${currentCheck}] ${text}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror@${currentCheck}] ${err.message}`))
page.on('dialog', (dialog) => dialog.accept())

try {
  // --- SMK-01: 起動・初回シード ---
  currentCheck = 'SMK-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800) // 初回シード完了待ち
  const listText = await page.textContent('body')
  check('SMK-01 起動・基本レシピのシード', listText.includes('肉じゃが') && listText.includes('カレーライス'))

  // --- SMK-05: 人数変更で帯分数表示(2人分→3人分でじゃがいも3個→4と1/2個) ---
  currentCheck = 'SMK-05'
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.locator('button[aria-label="人数を増やす"]').click()
  await page.waitForTimeout(400)
  const detailText = await page.textContent('body')
  check('SMK-05 人数変更の帯分数スケール', detailText.includes('4と1/2個'), `「4と1/2個」が見つからない`)
  check('SMK-05 g系は整数のまま', detailText.includes('300g'), '牛こま300g(200g×1.5)が見つからない')

  // --- 合わせ調味料の色ライン(共通説明文の表示) ---
  check('合わせ調味料ヒント表示', detailText.includes('先にまとめて計量してOK'))

  // --- SMK-08(簡易): 調理中モードを開いて手順送り・閉じる ---
  currentCheck = 'SMK-08'
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  const focusText = await page.textContent('body')
  check('SMK-08 調理中モードが開く', focusText.includes('手順 1/'))
  await page.getByRole('button', { name: '次へ' }).click()
  await page.waitForTimeout(300)
  check('SMK-08 手順送り', (await page.textContent('body')).includes('手順 2/'))
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)

  // --- TAB-01: 詳細を開いたままリロード→下タブ「レシピ」で一覧へ戻れる ---
  // (覚えた「最後のレシピパス」＝現在地となりタップが無反応になる回帰の防止。2026-07-09第2波)
  currentCheck = 'TAB-01'
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('TAB-01 リロードで詳細が復元される', /#\/recipes\/\d+/.test(page.url()))
  await page.locator('nav').getByText('レシピ', { exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'TAB-01 リロード後もレシピタブで一覧へ戻れる',
    page.url().includes('#/recipes') && !/#\/recipes\/\d/.test(page.url()),
    `現在URL: ${page.url()}`,
  )

  // --- SMK-04+02: テキスト貼り付け→登録 ---
  currentCheck = 'SMK-04'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('テキスト貼り付けで自動入力').click()
  await page.waitForTimeout(300)
  await page.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]').fill(
    'E2Eスモーク試験用レシピ\n\n材料（2人分）\n・にんじん　1本\n・しょうゆ　大さじ2\n\n作り方\n1. にんじんを切る\n2. 炒める',
  )
  await page.getByRole('button', { name: '自動で振り分ける' }).click()
  await page.waitForTimeout(300)
  const formText = await page.textContent('body')
  check('SMK-04 貼り付け整形の読み取り結果', formText.includes('材料2件・手順2件を読み取りました'))
  currentCheck = 'SMK-02'
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const savedText = await page.textContent('body')
  check('SMK-02 保存→詳細表示', savedText.includes('E2Eスモーク試験用レシピ') && savedText.includes('にんじん'))

  // --- SMK-03: 編集画面から削除(ダイアログは自動承諾) ---
  currentCheck = 'SMK-03'
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('SMK-03 削除が一覧に反映', !(await page.textContent('body')).includes('E2Eスモーク試験用レシピ'))

  // --- SMK-14(簡易): 未解錠でのセット取り込みは丁寧にブロックされる ---
  currentCheck = 'SMK-14'
  await page.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check(
    'SMK-14 未解錠ゲート',
    (await page.textContent('body')).includes('追加レシピパックまたはPro版の解錠が必要'),
  )

  // --- SMK-19: 静的ページ(/about/配下・/sets/)がSW有効でも200でアプリ本体にすり替わらない ---
  // アプリ本体のtitleは「うちレシピ」単独。静的ページは必ず「◯◯｜うちレシピ」形式のtitleを持つ
  currentCheck = 'SMK-19'
  const staticPages = [
    ['/about/', 'うちレシピについて'],
    ['/about/terms.html', '利用規約'],
    ['/about/column/', 'コラム'],
    ['/about/column/kondate-kimaranai.html', '献立が決められない'],
    ['/about/column/recipe-screenshot-seiri.html', 'スクショ'],
    ['/sets/', 'レシピセット'],
  ]
  for (const [path, titleKeyword] of staticPages) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const title = await page.title()
    check(
      `SMK-19 静的ページ ${path}`,
      res.status() === 200 && title.includes(titleKeyword),
      `status=${res.status()} title=「${title}」`,
    )
  }
} catch (err) {
  ng(`実行中断(${currentCheck})`, err.message)
} finally {
  await browser.close()
}

// --- 結果 ---
const failed = results.filter((r) => !r.pass)
console.log(`\n対象: ${BASE}`)
for (const r of results) console.log(`${r.pass ? 'OK ' : 'NG '} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`\n合格: ${results.length - failed.length}/${results.length}件 / console・pageerror: ${errors.length}件`)
for (const e of errors) console.log(`  ${e}`)
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0)
