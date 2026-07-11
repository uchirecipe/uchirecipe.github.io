// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / QF-01(時短絞り込みで件数が変わる) / SMK-02+03(登録・削除) /
//         SMK-04(貼り付け整形) / SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) /
//         SMK-14簡易(未解錠ゲート) /
//         SMK-19(静的ページがアプリ本体にすり替わらない。SWが動くpreviewでの実行時に実質検証) /
//         SCROLL-01(一覧のスクロール位置復元。iPhone SE実機フィードバック 2026-07-11。
//         webkit+375x667ビューポートで検証。60秒滞在バリエーション込み。他のチェックはchromiumのまま) /
//         SCROLL-02(一覧の絞り込み・並べ替え条件が詳細→戻るを経ても保持される。
//         2026-07-12深夜フィードバック再調査で判明した本当の原因の再発防止。PC Chrome相当) /
//         合わせ調味料ライン表示。console/pageerrorは全工程で監視(既知のCF計測CORSは除外)
import { chromium, webkit } from 'playwright'

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

  // --- QF-01: 絞り込み「時短」でカード件数が変わる(quickStepsを持つレシピだけに絞られる。
  // UI改善バッチ 2026-07-11) ---
  currentCheck = 'QF-01'
  const allCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '時短', exact: true }).click()
  await page.waitForTimeout(400)
  const quickCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'QF-01 時短絞り込みで件数が変わる',
    quickCardCount > 0 && quickCardCount < allCardCount,
    `全件=${allCardCount} 時短=${quickCardCount}`,
  )
  // 絞り込みを解除して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: '時短', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)

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

  // --- TERM-01: 用語タップでポップオーバーが開き、外タップで閉じる(用語タップ辞書 2026-07-11)。
  // 肉じゃが手順1「玉ねぎはくし形に切る」の「くし形」をタップして説明を確認する ---
  currentCheck = 'TERM-01'
  await page.getByRole('button', { name: 'くし形切りの説明を見る' }).click()
  await page.waitForTimeout(300)
  const termOpenText = await page.textContent('body')
  check('TERM-01 用語タップでポップオーバーが開く', termOpenText.includes('縦半分に切った玉ねぎ'))
  await page.mouse.click(5, 5) // ポップオーバーの外をタップ
  await page.waitForTimeout(300)
  const termClosedText = await page.textContent('body')
  check('TERM-01 外タップでポップオーバーが閉じる', !termClosedText.includes('縦半分に切った玉ねぎ'))

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

  // --- DET-01: 詳細の戻るボタンは、一覧以外の画面(ホーム)から来た場合でも常に一覧へ戻る ---
  // (ブラウザ履歴があると直前の画面に戻ってしまっていた不具合の再発防止。2026-07-10)
  currentCheck = 'DET-01'
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('a[href^="#/recipes/"]').first().click()
  await page.waitForTimeout(500)
  check('DET-01 ホームからレシピ詳細へ遷移', /#\/recipes\/\d+/.test(page.url()), `現在URL: ${page.url()}`)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01 詳細の戻るボタンは常に一覧へ(直前の画面(ホーム)には戻らない)',
    page.url().endsWith('#/recipes'),
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

  // --- SCROLL-01: 一覧のスクロール位置復元(iPhone SE2実機フィードバック 2026-07-11)。
  // 「詳細→戻る→スクロール位置が復元される」を、iOS Safari相当のwebkitエンジン+
  // iPhone SEのビューポート(375x667)で検証する(実機の不具合はwebkit固有の挙動だったため)。
  // 他のチェックと違うブラウザエンジンを使うので、ここだけ専用のbrowser/contextを開閉する ---
  currentCheck = 'SCROLL-01'
  {
    const wkBrowser = await webkit.launch()
    const wkContext = await wkBrowser.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage = await wkContext.newPage()
    wkPage.on('pageerror', (err) => {
      // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ。
      // webkitではconsoleではなくpageerrorとして表面化するため、こちらでも同様に除外する
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SCROLL-01] ${err.message}`)
    })
    try {
      await wkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage.evaluate(() => window.scrollTo(0, 500))
      await wkPage.waitForTimeout(400) // スクロール位置保存(rAFスロットル)の反映待ち
      const scrollBefore = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 事前条件: 一覧がスクロールできている(iPhone SE相当)',
        scrollBefore > 100,
        `scrollY=${scrollBefore}`,
      )
      // Playwrightの.click()は要素を可視範囲へ自動スクロールしてしまい、テスト対象の
      // スクロール位置そのものを壊してしまうため、DOMのclick()を直接呼ぶ
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check('SCROLL-01 詳細へ遷移', /#\/recipes\/\d+/.test(wkPage.url()), `現在URL: ${wkPage.url()}`)
      await wkPage.getByRole('button', { name: '戻る' }).click()
      await wkPage.waitForTimeout(800)
      const scrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細→戻るで一覧のスクロール位置が復元される(iPhone SE 375x667・webkit)',
        Math.abs(scrollAfter - scrollBefore) < 60,
        `復元前=${scrollBefore} 復元後=${scrollAfter}`,
      )

      // --- 滞在時間バリエーション(2026-07-12深夜フィードバック「一定時間以上詳細画面に
      // いたとき一覧の位置がリセットされる感じ」の再現・再発防止ケース)。再調査の結果、
      // 実際のトリガーは滞在時間そのものではなく「離脱時に絞り込み条件が既定値でなかったこと」
      // だったが(下のSCROLL-02で別途固定)、時間経過そのものが無関係であることも
      // 恒久的に保証しておくため、実際に60秒待ってから戻る経路もここで検証する ---
      await wkPage.evaluate(() => window.scrollTo(0, 400))
      await wkPage.waitForTimeout(400)
      const longScrollBefore = await wkPage.evaluate(() => window.scrollY)
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check(
        'SCROLL-01 (滞在60秒) 詳細へ遷移',
        /#\/recipes\/\d+/.test(wkPage.url()),
        `現在URL: ${wkPage.url()}`,
      )
      await wkPage.waitForTimeout(60000) // 詳細画面に実際に60秒滞在する
      await wkPage.getByRole('button', { name: '戻る' }).click()
      await wkPage.waitForTimeout(800)
      const longScrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細に60秒滞在してから戻ってもスクロール位置が復元される',
        Math.abs(longScrollAfter - longScrollBefore) < 60,
        `復元前=${longScrollBefore} 復元後=${longScrollAfter}`,
      )
    } finally {
      await wkBrowser.close()
    }
  }

  // --- IPAD-01: iPadで「戻る」ヘッダーがマルチタスク操作ボタンに被らない
  // (オーナー実機フィードバック 2026-07-12: 「iPadから表示すると、画面サイズボタンと
  // 『戻る』ボタンが被る」→ iPad判定(:root.is-ipad)で上部に余白を足す対策の配線検証)。
  // PlaywrightのiPadエミュレーションはmaxTouchPoints=0を返すため、検出値は注入する
  // (検出式→クラス付与→CSS余白、の配線が壊れたら落ちる回帰テスト) ---
  currentCheck = 'IPAD-01'
  {
    const ipadBrowser = await webkit.launch()
    const ipadCtx = await ipadBrowser.newContext({
      viewport: { width: 820, height: 1180 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    })
    const ipadPage = await ipadCtx.newPage()
    await ipadPage.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 })
    })
    try {
      await ipadPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ipadPage.waitForTimeout(1800)
      check(
        'IPAD-01 iPad判定クラスが:rootに付く',
        await ipadPage.evaluate(() => document.documentElement.classList.contains('is-ipad')),
      )
      await ipadPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await ipadPage.waitForTimeout(600)
      const padTop = await ipadPage.evaluate(() => {
        const h = document.querySelector('.back-header')
        return h ? parseFloat(getComputedStyle(h).paddingTop) : -1
      })
      check('IPAD-01 戻るヘッダーに上部余白が付く(22px+)', padTop >= 22, `paddingTop=${padTop}`)
    } finally {
      await ipadBrowser.close()
    }
  }
  // 逆条件: 通常のスマホ(iPhone SE2相当)ではiPad用の余白が付かないこと(LOG-01のページで検証)

  // --- LOG-01: 「作った！」記録フォームの窓表示化(オーナー実機フィードバック 2026-07-12。
  // 「『作った！』の位置が最下層のため、押下すると画面全体の表示が動いて見づらい」
  // 「『作った！』の日付入力のバーの大きさが、はみだしている」の再発防止)。
  // ・押下前後でページのスクロール位置(window.scrollY)が変わらない(以前はインライン展開で
  //   scrollIntoViewが走り、レイアウトごと動いていた)
  // ・<input type="date">がiPhone SE2相当(375x667・webkit)の画面幅からはみ出さない
  // ・保存すると記録が一覧に反映される(既存の記録保存ロジックが壊れていないことの確認)
  currentCheck = 'LOG-01'
  {
    const wkBrowser2 = await webkit.launch()
    const wkContext2 = await wkBrowser2.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage2 = await wkContext2.newPage()
    wkPage2.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-01] ${err.message}`)
    })
    try {
      await wkPage2.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage2.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage2.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage2.waitForTimeout(600)
      await wkPage2.evaluate(() => window.scrollTo(0, 200))
      await wkPage2.waitForTimeout(300)
      const scrollBeforeOpen = await wkPage2.evaluate(() => window.scrollY)
      // 「作った！」はページ最下部のボタンなので、Playwrightの.click()に任せると
      // 可視範囲へ自動スクロールしてしまい検証したいスクロール位置そのものを壊す(SCROLL-01と同じ理由)。
      // DOMのclick()を直接呼んでスクロールを発生させない
      await wkPage2.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await wkPage2.waitForTimeout(400)
      const dialogText = await wkPage2.textContent('body')
      check('LOG-01 「作った！」で窓(モーダル)が開く', dialogText.includes('作った記録をつける'))
      const scrollAfterOpen = await wkPage2.evaluate(() => window.scrollY)
      check(
        'LOG-01 窓を開いてもページのスクロール位置が変わらない',
        scrollAfterOpen === scrollBeforeOpen,
        `開く前=${scrollBeforeOpen} 開いた後=${scrollAfterOpen}`,
      )
      const dateBox = await wkPage2.locator('input[type="date"]').boundingBox()
      check(
        'LOG-01 日付入力が画面幅(375px)からはみ出さない',
        !!dateBox && dateBox.x >= 0 && dateBox.x + dateBox.width <= 375,
        `x=${dateBox?.x} width=${dateBox?.width}`,
      )
      // 窓(モーダル)の保存ボタンは「記録する」(過去記録を後から編集するときの「保存する」とは別物)
      await wkPage2.getByRole('button', { name: '記録する', exact: true }).click()
      await wkPage2.waitForTimeout(500)
      const savedText = await wkPage2.textContent('body')
      check('LOG-01 保存すると「作った記録」に反映される', savedText.includes('作った記録'))
    } finally {
      await wkBrowser2.close()
    }
  }

  // --- SCROLL-02: 一覧の絞り込み・並べ替え条件が「詳細→戻る」を経ても保持される
  // (2026-07-12深夜フィードバックの再調査で判明した本当の原因の再発防止テスト。PC Chrome相当・
  // デスクトップビューポート)。詳細の「戻る」は常に素の /recipes へ新規遷移するため、
  // 検索語や並べ替えなど何か1つでも既定値から変えていると、以前は復元判定のfiltersKeyが
  // 不一致になり、スクロール位置だけでなく絞り込み条件そのものが黙って消えていた
  // (オーナーは「長く滞在すると起きる」と感じていたが、実際は滞在時間に関係なく、絞り込み中に
  // 詳細を開いて戻るだけで即再現した。絞り込んで探すほど長時間読む対象に行き着きやすい、
  // という行動側の相関を「時間経過が原因」と体感していたと考えられる) ---
  currentCheck = 'SCROLL-02'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: '絞り込み' }).click()
  await page.waitForTimeout(200)
  // 並べ替えを既定の「更新順」から変える(URLに載らない絞り込みなので、これが復元できれば
  // filtersKey全体が保存・復元されていることの証明になる)
  await page.getByRole('button', { name: 'あいうえお順' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを閉じる
  await page.waitForTimeout(200)
  await page.evaluate(() => window.scrollTo(0, 300))
  await page.waitForTimeout(400)
  const s2ScrollBefore = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => {
    const link = document.querySelector('a[href^="#/recipes/"]')
    if (link instanceof HTMLElement) link.click()
  })
  await page.waitForTimeout(600)
  check('SCROLL-02 詳細へ遷移', /#\/recipes\/\d+/.test(page.url()), `現在URL: ${page.url()}`)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(800)
  const s2ScrollAfter = await page.evaluate(() => window.scrollY)
  check(
    'SCROLL-02 詳細→戻るでスクロール位置が復元される(並べ替え変更中・PC Chrome相当)',
    Math.abs(s2ScrollAfter - s2ScrollBefore) < 60,
    `復元前=${s2ScrollBefore} 復元後=${s2ScrollAfter}`,
  )
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを再度開いて並べ替え状態を確認
  await page.waitForTimeout(200)
  const sortStillActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === 'あいうえお順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SCROLL-02 詳細→戻るで並べ替え条件(あいうえお順)も保持される', sortStillActive)
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを閉じる(後続チェックへの影響防止)
  await page.waitForTimeout(200)

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
