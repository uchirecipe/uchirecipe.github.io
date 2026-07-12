// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / QF-01(時短絞り込みで件数が変わる) / SMK-02+03(登録・削除) /
//         SMK-04(貼り付け整形) / SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) /
//         KW-01(検索キーワード欄。保存→検索でヒットし、一覧・詳細には表示されないこと) /
//         SMK-14簡易(未解錠ゲート) /
//         SMK-19(静的ページがアプリ本体にすり替わらない。SWが動くpreviewでの実行時に実質検証) /
//         SCROLL-01(一覧のスクロール位置復元。iPhone SE実機フィードバック 2026-07-11。
//         webkit+375x667ビューポートで検証。60秒滞在バリエーション込み。他のチェックはchromiumのまま) /
//         SCROLL-02(一覧の絞り込み・並べ替え条件が詳細→戻るを経ても保持される。
//         2026-07-12深夜フィードバック再調査で判明した本当の原因の再発防止。PC Chrome相当) /
//         TIMER-ADJ-01(実行中タイマーの±調整窓。タップで開き「+1分」「−30秒」で残り秒が変わる) /
//         TIMER-CUSTOM-01(じぶんタイマー。入口Aから起動し、0未満にならない floor 挙動も確認) /
//         NUT-01(栄養価のめやす: 未解錠でもエネルギー・塩分の概算が閉じた1行から見え、
//         展開すると「めやす」表記・出典・Pro案内リンクが出る) /
//         NUT-02(栄養価のめやす: Pro解錠済みで5項目の実パネルが出る・人数を変えても1人分の値は不変。
//         M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED有効化) /
//         合わせ調味料ライン表示。console/pageerrorは全工程で監視(既知のCF計測CORSは除外)
import { chromium, webkit } from 'playwright'

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

const errors = []
const results = []
let currentCheck = ''
const ok = (label) => results.push({ label, pass: true })
const ng = (label, detail) => results.push({ label, pass: false, detail })
const check = (label, cond, detail = '') => (cond ? ok(label) : ng(label, detail))
// タイマーの残り表示("08:24"や"1:05:00")を秒数に変換する(TIMER-ADJ-01/TIMER-CUSTOM-01用)
const parseRemainingSeconds = (text) => {
  const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return m[3] !== undefined
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2])
}

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

  // --- NUT-01: 栄養価のめやす(未解錠・無料)。肉じゃがの詳細を開いたまま検証する
  // (M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED=trueに前倒し有効化。エネルギー・食塩相当量の
  // 2項目は無料でも常時計算表示(2026-07-10バッチH-4)、残り3項目はPro案内にとどめる設計) ---
  currentCheck = 'NUT-01'
  check('NUT-01 栄養価のめやす見出しが閉じた状態から見える', detailText.includes('栄養価のめやす'))
  check('NUT-01 エネルギー(kcal)の概算が閉じた1行から見える', /\d+kcal/.test(detailText))
  check('NUT-01 塩分の概算が閉じた1行から見える', detailText.includes('塩分'))
  await page.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
  await page.waitForTimeout(300)
  const nutExpandedText = await page.textContent('body')
  check('NUT-01 展開すると断定しない「めやす」表記の注記が出る', nutExpandedText.includes('めやす'))
  check('NUT-01 出典表記がある', nutExpandedText.includes('出典'))
  check(
    'NUT-01 未解錠には月間献立と同じ「Pro版について見る」リンクが出る',
    nutExpandedText.includes('Pro版について見る'),
  )
  await page.getByRole('button', { name: '栄養価のめやすを閉じる' }).click()
  await page.waitForTimeout(200)

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

  // --- KW-01: 検索キーワード欄(keywords・2026-07-12バッチ)。一覧や詳細には表示されず、
  // 検索語に入力したときだけヒットすることを確認する ---
  currentCheck = 'KW-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eキーワード確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  const kwInput = page.getByPlaceholder('例: チンジャオロース、おつまみ など')
  await kwInput.fill('ずっきーにのひみつご')
  await kwInput.press('Enter') // タグと同じくEnterでチップ化(addKeyword)
  await page.waitForTimeout(200)
  const kwFormText = await page.textContent('body')
  check('KW-01 キーワードがチップとして追加される', kwFormText.includes('ずっきーにのひみつご'))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const kwDetailText = await page.textContent('body')
  check('KW-01 保存自体は成功する(詳細にタイトルが出る)', kwDetailText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 保存後の詳細画面にキーワード文字列が表示されない', !kwDetailText.includes('ずっきーにのひみつご'))

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('KW-01 一覧画面にもキーワード文字列が表示されない(検索前)', !(await page.textContent('body')).includes('ずっきーにのひみつご'))
  await page.locator('input[type="search"]').fill('ずっきーにのひみつご')
  await page.waitForTimeout(400)
  const kwSearchText = await page.textContent('body')
  check('KW-01 検索キーワードでレシピがヒットする', kwSearchText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 検索結果表示でもキーワード文字列自体は表示されない', !kwSearchText.includes('ずっきーにのひみつご'))

  // 検索語をクリアしておく(一覧の検索条件はsessionStorageに保存され、この後の一覧系チェックが
  // 同じpage/contextを使い回すため、絞り込んだままだと後続チェックの「a[href^="#/recipes/"]」の
  // querySelectorが0件ヒットの一覧で「＋(新規登録)」リンクを拾ってしまい誤検出になる)
  await page.locator('input[type="search"]').fill('')
  await page.waitForTimeout(400)

  // 後始末: 検証用に作成したレシピを削除
  await page.getByText('E2Eキーワード確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

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

  // --- NUT-02: 栄養価のめやす(Pro解錠済み)。5項目の実パネル(たんぱく質・脂質・炭水化物を含む)が
  // 出ること、人数を変えても「1人分」の値は変わらないこと(全量だけが連動する)を確認する。
  // 実際のPro解錠コード(UR-...)は販売台帳の原本なのでリポジトリにコミットできないため、
  // ここではsettings.proCodeをIndexedDBへ直接書き込んで「解錠済み」状態だけを再現する
  // (コード検証ロジック自体はscripts/test-logic.mjsで別途確認済み)。他チェックのPro状態に
  // 影響しないよう、専用のbrowser/contextで完結させる(M6-1 2026-07-12) ---
  currentCheck = 'NUT-02'
  {
    const nutBrowser = await chromium.launch()
    const nutContext = await nutBrowser.newContext()
    const nutPage = await nutContext.newPage()
    nutPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUT-02] ${err.message}`)
    })
    try {
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await nutPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            const putReq = store.put({ ...current, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await nutPage.reload({ waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.getByText('肉じゃが', { exact: true }).first().click()
      await nutPage.waitForTimeout(600)
      await nutPage.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
      await nutPage.waitForTimeout(300)
      const unlockedText = await nutPage.textContent('body')
      check('NUT-02 Pro解錠済みでたんぱく質が表示される', unlockedText.includes('たんぱく質'))
      check('NUT-02 Pro解錠済みで脂質が表示される', unlockedText.includes('脂質'))
      check('NUT-02 Pro解錠済みで炭水化物が表示される', unlockedText.includes('炭水化物'))
      check('NUT-02 Pro解錠済みで塩分相当量が表示される', unlockedText.includes('塩分相当量'))
      check('NUT-02 断定しない「概算」バッジが出る', unlockedText.includes('概算'))
      check('NUT-02 「1人分」の内訳がある', unlockedText.includes('1人分'))
      check('NUT-02 「全量」の内訳もある(人数連動)', unlockedText.includes('全量'))

      // 人数を変えても「1人分」のエネルギーは変わらない(servings連動の検算。全量側だけが連動する)
      const perMatchBefore = unlockedText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      await nutPage.locator('button[aria-label="人数を増やす"]').click()
      await nutPage.waitForTimeout(400)
      const afterServingsText = await nutPage.textContent('body')
      const perMatchAfter = afterServingsText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      check(
        'NUT-02 人数を変えても1人分のエネルギーは変わらない',
        !!perMatchBefore && !!perMatchAfter && perMatchBefore[1] === perMatchAfter[1],
        `変更前=${perMatchBefore?.[1]} 変更後=${perMatchAfter?.[1]}`,
      )
    } finally {
      await nutBrowser.close()
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

  // --- TIMER-ADJ-01: 実行中タイマーの±調整(窓方式。2026-07-12タイマー自由設定・Fable設計docs/20 §6)。
  // 肉じゃが手順3「中火で15分煮る」の「15分」をタップしてタイマーを起動し、
  // 常駐バー(TimerBar)の表示をタップして窓を開き、「+1分」「−30秒」で残り秒が変わることを確認する ---
  currentCheck = 'TIMER-ADJ-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '15分 タイマー開始' }).click()
  await page.waitForTimeout(500)
  // タイマー起動の初回だけ出る説明バナーが、次の正規表現セレクタと混同しないことも併せて確認
  const adjustOpenBtn = page.getByRole('button', { name: /のタイマーを調整/ })
  check('TIMER-ADJ-01 常駐バーにタイマー行が現れる(タップで調整窓が開く導線)', await adjustOpenBtn.isVisible())
  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  const adjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  check('TIMER-ADJ-01 タイマー調整の窓が開く(「作った！」と同じ様式)', await adjustDialog.isVisible())
  const adjBeforeSec = parseRemainingSeconds(await adjustDialog.textContent())
  await adjustDialog.getByRole('button', { name: '+1分' }).click()
  await page.waitForTimeout(200)
  const adjAfterPlusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「+1分」で残り秒が約60秒増える',
    adjBeforeSec !== null && adjAfterPlusSec !== null && adjAfterPlusSec - adjBeforeSec >= 50,
    `押す前=${adjBeforeSec}s 押した後=${adjAfterPlusSec}s`,
  )
  await adjustDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(200)
  const adjAfterMinusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「−30秒」で残り秒が約30秒減る',
    adjAfterMinusSec !== null && adjAfterPlusSec - adjAfterMinusSec >= 20,
    `「+1分」後=${adjAfterPlusSec}s 「−30秒」後=${adjAfterMinusSec}s`,
  )
  // 窓の外(背景)をタップして閉じる。常駐バーの表示はそのまま残る(タイマー自体は動作中のまま)
  await page.mouse.click(5, 5)
  await page.waitForTimeout(300)
  check('TIMER-ADJ-01 背景タップで窓が閉じる', !(await adjustDialog.isVisible().catch(() => false)))
  // 「停止」でタイマーごと消えることも確認する(後続のTIMER-CUSTOM-01に影響を残さないための後片付けも兼ねる)
  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  await adjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)
  check(
    'TIMER-ADJ-01 「停止」でタイマーが常駐バーから消える',
    !(await adjustOpenBtn.isVisible().catch(() => false)),
  )

  // --- TIMER-CUSTOM-01: じぶんタイマー(自由な分数で始めるタイマー。同バッチ)。
  // レシピ詳細のBackHeaderにあるタイマーアイコン(入口A)から開き、既定3分→1分まで減らして起動する。
  // 続けて同じ調整窓で「−30秒」を重ねても残りが0未満にならない(即完了扱いにしない)ことも確認する ---
  currentCheck = 'TIMER-CUSTOM-01'
  await page.getByRole('button', { name: 'じぶんタイマーを開く' }).click()
  await page.waitForTimeout(300)
  const customDialog = page.getByRole('dialog', { name: 'じぶんタイマー' })
  check(
    'TIMER-CUSTOM-01 じぶんタイマーの窓が開く(初回既定3分)',
    (await customDialog.textContent()).includes('3分'),
  )
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 分数ステッパー(±1分)で1分まで減らせる',
    (await customDialog.textContent()).includes('1分'),
  )
  await customDialog.getByRole('button', { name: '開始' }).click()
  await page.waitForTimeout(400)
  const customBarText = await page.textContent('body')
  check(
    'TIMER-CUSTOM-01 じぶんタイマーが起動する(常駐バーに「じぶんタイマー」表示)',
    customBarText.includes('じぶんタイマー'),
  )
  await page.getByRole('button', { name: /のタイマーを調整/ }).click()
  await page.waitForTimeout(300)
  const customAdjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(150)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 1分-30秒-30秒=0
  await page.waitForTimeout(150)
  const atFloorText = await customAdjustDialog.textContent()
  check('TIMER-CUSTOM-01 「−30秒」を重ねても残りは0で止まる', atFloorText.includes('00:00'), atFloorText)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 0からさらに押しても0のまま
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 0からさらに「−30秒」しても0のまま(即完了扱いにしない)',
    (await customAdjustDialog.textContent()).includes('00:00'),
  )
  await customAdjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)

  // --- PRICE-01: 食材価格マスタ(「食材と価格」画面。docs/20 §3)。
  // 材料に価格を入力していないレシピでも、マスタの目安価格が詳細の概算食費に反映され、
  // マスタの価格を編集すると反映結果も追従することを確認する ---
  currentCheck = 'PRICE-01'
  // テスト用レシピ: 材料に価格を入力せず、マスタ初期値がある「玉ねぎ」だけを使う
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E価格マスタ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('玉ねぎ')
  await page.getByPlaceholder('例: 3').first().fill('1')
  await page.getByPlaceholder('例: 個').first().fill('個')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('切る')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const priceDetailBefore = await page.textContent('body')
  check(
    'PRICE-01 マスタ初期値(玉ねぎ1個50円)が価格未入力の詳細の概算食費に反映される',
    priceDetailBefore.includes('約50円'),
  )
  check(
    'PRICE-01 マスタ由来の注記が表示される',
    priceDetailBefore.includes('一部は目安価格から計算しています'),
  )

  // 設定から「食材と価格」を開き、初期値30件の投入と目安の注意書きを確認する
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: '食材と価格を編集する' }).click()
  await page.waitForTimeout(500)
  check('PRICE-01 設定からの遷移でタイトルが表示される', page.url().includes('#/prices'))
  const priceListBefore = await page.textContent('body')
  check(
    'PRICE-01 初期値が投入されている(玉ねぎ・鶏もも肉を含む)',
    priceListBefore.includes('玉ねぎ') && priceListBefore.includes('鶏もも肉'),
  )
  check('PRICE-01 目安価格の注意書きが表示される', priceListBefore.includes('価格は目安です'))

  // マスタの「玉ねぎ」(一覧の先頭=PRICE_DEFAULTSの1件目)を999円に編集する
  const firstPriceRow = page.locator('ul li').first()
  await firstPriceRow.getByLabel('この食材を編集').click()
  await page.waitForTimeout(300)
  await firstPriceRow.getByLabel('価格（円）').fill('999')
  await firstPriceRow.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(400)
  check('PRICE-01 マスタの価格編集が一覧に反映される', (await page.textContent('body')).includes('999円'))

  // 詳細画面に戻り、編集後の目安価格が概算食費に反映されることを確認する
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  check(
    'PRICE-01 マスタ編集後、詳細の概算食費が更新される(約999円)',
    (await page.textContent('body')).includes('約999円'),
  )

  // 後始末: テスト用レシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

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
