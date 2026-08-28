// ==========================================================================================
// e2e の節: 静的ページ・起動・バックアップ
//
// 2026-08-26 便LC が scripts/e2e-smoke.mjs（54,483行）から**そのまま**出した。
// **検査の中身は1文字も変えていない**（変えたのは「どのファイルに書いてあるか」だけ）。
// 字下げも分ける前のまま＝元の `try { … }` の中の見た目をそのまま持ってきているので、
// 機械で1文字ずつ突き合わせられる（docs/74 第2手）。
//
// 使う道具（page・check・ja・currentCheck…）は ./_shared.mjs が用意する。
// 走る順番と、どの節がどのファイルに居るかは scripts/e2e-smoke.mjs が持っている。
// **節どうしは前の節が残した画面の状態を引き継ぐので、順番も、この区切りも動かさないこと。**
//
// この中の節: LOCKPREV-01, PHOTOCAL-01, RECIPESET-01, DASH-01, SMK-19, SMK-19b, SMK-19c, LAUNCH-01, LAUNCH-02, NUTTRIAL-01, COLLAPSED-01, PRICEUNIT-01, BACKUP-01, MERGE-01, REPLACEUNDO-01, CODEMERGE-01
// ==========================================================================================
import './_shared.mjs'


  // --- LOCKPREV-01: 未解錠ユーザーへの鍵付きプレビュー(2026-07-24 便BS・タスク6・規約H準拠)。
  // 月タブを完全に隠さず、ぼかしたサンプルカレンダーの上に「Pro版で使えます」+機能説明+「Pro版に
  // ついて見る」リンクを重ねる。実カレンダーの操作(期間の食費モード等)は出さない。機能を卑下する
  // 表現(おまけ/簡易的/大したもの=規約H禁止)を含まないことも確認する。まっさら(未解錠)プロファイル ---
  currentCheck = 'LOCKPREV-01'
  {
    const lpBrowser = await chromium.launch()
    const lpContext = await lpBrowser.newContext()
    const lpPage = await lpContext.newPage()
    lpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@LOCKPREV-01] ${text}`)
    })
    lpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOCKPREV-01] ${err.message}`)
    })
    try {
      await lpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await lpPage.waitForTimeout(1500)
      await lpPage.getByRole('button', { name: '月', exact: true }).click()
      await lpPage.waitForTimeout(400)
      const lpBody = (await lpPage.textContent('body')) ?? ''
      check('LOCKPREV-01 未解錠は鍵付きプレビューに「Pro版で使えます」が出る', lpBody.includes('Pro版で使えます'))
      check('LOCKPREV-01 未解錠でも「Pro版について見る」リンクが出る', lpBody.includes('Pro版について見る'))
      check(
        'LOCKPREV-01 未解錠では実カレンダー操作(期間の食費モード)を出さない',
        (await lpPage.getByRole('button', { name: '期間の食費', exact: true }).count()) === 0,
      )
      check(
        'LOCKPREV-01(規約H) 機能を卑下する表現(おまけ/簡易的/大したもの)を含まない',
        !/おまけ|簡易的|大したもの/.test(lpBody),
      )
    } finally {
      await lpBrowser.close()
    }
  }

  // --- PHOTOCAL-01: 月間カレンダーに作った記録の写真サムネ(2026-07-24 便BS・タスク4)。
  // 肉じゃがのcookedLogsに写真Blob付きの記録(昨日)を直接注入し、Pro解錠済み月カレンダーで
  // その日のセルに写真(img)が敷かれ、「記録あり」のaria-labelを持つことを確認する。
  // Pro解錠はPASTLOG-01等と同じsettings.proCode直書きで「解錠済み状態」を再現する ---
  currentCheck = 'PHOTOCAL-01'
  {
    const pcBrowser = await chromium.launch()
    const pcContext = await pcBrowser.newContext()
    const pcPage = await pcContext.newPage()
    pcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@PHOTOCAL-01] ${text}`)
    })
    pcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PHOTOCAL-01] ${err.message}`)
    })
    try {
      const pcPad = (n) => String(n).padStart(2, '0')
      const pcNow = new Date()
      const pcYd = new Date()
      pcYd.setDate(pcYd.getDate() - 1)
      const pcYesterday = `${pcYd.getFullYear()}-${pcPad(pcYd.getMonth() + 1)}-${pcPad(pcYd.getDate())}`

      await pcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pcPage.waitForTimeout(1800) // 初回シード完了待ち

      await pcPage.evaluate(async (date) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        // 肉じゃがに写真Blob付きの記録(昨日)を追加
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('recipes', 'readwrite')
          const store = tx.objectStore('recipes')
          const g = store.getAll()
          g.onsuccess = () => {
            const r = g.result.find((x) => x.title === '肉じゃが')
            const blob = new Blob([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70])], {
              type: 'image/jpeg',
            })
            r.cookedLogs = [{ date, photo: blob }, ...(r.cookedLogs ?? [])]
            store.put(r)
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        // Pro解錠(settings.proCode直書き)
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const gg = store.get(1)
          gg.onsuccess = () => {
            const c = gg.result || { id: 1 }
            store.put({ ...c, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      }, pcYesterday)

      await pcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await pcPage.reload({ waitUntil: 'networkidle' })
      await pcPage.waitForTimeout(800)
      await pcPage.getByRole('button', { name: '月', exact: true }).click()
      await pcPage.waitForTimeout(500)
      if (pcYesterday.slice(0, 7) !== `${pcNow.getFullYear()}-${pcPad(pcNow.getMonth() + 1)}`) {
        // 実行日が月初(1日)のときだけ、昨日は前の月に表示される
        await pcPage.locator('button[aria-label="前の月"]').click()
        await pcPage.waitForTimeout(400)
      }
      const pcPhotoCell = pcPage.locator('button[aria-label="記録あり"]').first()
      check('PHOTOCAL-01 記録のある日セルが「記録あり」で出る', (await pcPhotoCell.count()) >= 1)
      check(
        'PHOTOCAL-01 記録写真のある日のセルに写真(img)が敷かれる',
        (await pcPhotoCell.locator('img').count()) >= 1,
      )
    } finally {
      await pcBrowser.close()
    }
  }

  // --- RECIPESET-01: 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)。テーマ全廃
  // (2026-07-23)でテーマ配布(?set=・配布JSON)は撤去したが、この汎用ローダーは配布互換として存続する。
  // 修正4(2026-07-14 オーナー実機フィードバック): 結果を読み込み欄の上部にテキストで表示し、下部トースト
  // (押して閉じるボタン)としては二重に出ないこと。エラー(URLが見つからない)・成功(ファイル読み込み)の
  // 両方を確認し、取り込んだ品が「基本レシピ」バッジで表示され旧テーマ名(setName)が出ないことも確認する。
  // 専用のまっさらプロファイルで完結させる ---
  currentCheck = 'RECIPESET-01'
  {
    const rsBrowser = await chromium.launch()
    const rsContext = await rsBrowser.newContext()
    const rsPage = await rsContext.newPage()
    rsPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@RECIPESET-01] ${text}`)
    })
    rsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@RECIPESET-01] ${err.message}`)
    })
    try {
      await rsPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(1000)
      await rsPage.getByRole('button', { name: 'レシピ', exact: true }).click()
      await rsPage.waitForTimeout(300)

      const urlInput = rsPage.getByPlaceholder('https://…')
      const loadUrlBtn = rsPage.getByRole('button', { name: ja.settings.recipeSetUrlLoad })

      // エラー(見つからない)パス
      await urlInput.fill(`${BASE}/e2e-nonexistent-set.json`)
      await loadUrlBtn.click()
      await rsPage.waitForTimeout(600)
      check(
        'RECIPESET-01(修正4) 存在しないURLの結果が読み込み欄の上部にテキストで出る',
        (await rsPage.textContent('body')).includes(ja.settings.recipeSetNotFound),
      )
      const errorMsgBox = await rsPage
        .getByText(ja.settings.recipeSetNotFound, { exact: false })
        .first()
        .boundingBox()
      const urlInputBox = await urlInput.boundingBox()
      check(
        'RECIPESET-01(修正4) 結果メッセージが読み込み欄(URL入力)より上に表示される',
        !!errorMsgBox && !!urlInputBox && errorMsgBox.y < urlInputBox.y,
      )
      check(
        'RECIPESET-01(修正4) 下部トースト(押して閉じるボタン)としては出ない(二重表示しない)',
        (await rsPage
          .getByRole('button', { name: ja.settings.recipeSetNotFound, exact: false })
          .count()) === 0,
      )

      // 成功パス: 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)は、テーマ全廃
      // (2026-07-23)後も配布互換として存続する。配布JSON(/sets/data/*.json)は撤去したため、ファイル
      // 読み込み経路をバックアップ形式のJSONで検証する。setId/setName付きでも取り込んだ品は「基本レシピ」
      // として入り(isStarter)、テーマ名(setName)は出ない(RecipeCardが第◯弾/テーマ名を表示しない)
      const setJson = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        setId: 'e2e-generic-set',
        setName: 'E2Eテスト用セット',
        recipes: [
          {
            title: 'E2E読み込みテストレシピ',
            servings: 2,
            cookMinutes: 10,
            effortLevel: 'easy',
            tags: ['和食'],
            ingredients: [{ name: 'E2Eテスト食材', amount: '1', unit: '個' }],
            steps: [{ text: 'E2Eテスト手順。' }],
            cookedLogs: [],
          },
        ],
      })
      // 「レシピセットを読み込む」欄の隠しファイル入力(DOM上は設定画面で最初のファイル入力)へ直接投入する
      await rsPage.locator('input[type="file"][accept="application/json,.json"]').first().setInputFiles({
        name: 'e2e-set.json',
        mimeType: 'application/json',
        buffer: Buffer.from(setJson, 'utf-8'),
      })
      await rsPage.waitForTimeout(1000)
      const afterSuccessText = await rsPage.textContent('body')
      check(
        'RECIPESET-01 ファイル読み込み(バックアップ形式)が成功し「◯品追加しました」が上部に出る',
        /\d+[品件]追加しました/.test(afterSuccessText),
      )
      check(
        'RECIPESET-01(修正4) 直前のエラーメッセージは成功後には残らない',
        !afterSuccessText.includes(ja.settings.recipeSetNotFound),
      )

      // 基本レシピバッジの確認: setId/setName付きで取り込んでもカードは「基本レシピ」バッジに統一され、
      // 第◯弾/テーマ名(setName)は出ない(2026-07-23のテーマ全廃で表示上の括りを完全撤去)
      await rsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(800)
      const importedCardText = await rsPage
        .locator('a[href^="#/recipes/"]', { hasText: 'E2E読み込みテストレシピ' })
        .first()
        .textContent()
      check(
        'RECIPESET-01 setId/setName付きセットの取り込み後もカードは「基本レシピ」バッジで、テーマ名(setName)は出ない',
        !!importedCardText &&
          importedCardText.includes('基本レシピ') &&
          !importedCardText.includes('E2Eテスト用セット'),
        `カードテキスト=${importedCardText}`,
      )
    } finally {
      await rsBrowser.close()
    }
  }

  // --- DASH-01: だし紐づけ(2026-07-23)。材料「だし汁」系の行から収録レシピ「だしのとり方」の詳細へ
  // 飛べる小さなリンクが出て、タップで遷移すること・収録レシピをユーザーが削除するとリンクが出ないこと
  // を確認する。専用のbrowser/contextで完結させる ---
  currentCheck = 'DASH-01'
  {
    const dsBrowser = await chromium.launch()
    const dsContext = await dsBrowser.newContext()
    const dsPage = await dsContext.newPage()
    dsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DASH-01] ${err.message}`)
    })
    dsPage.on('dialog', (dialog) => dialog.accept())
    try {
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(2200) // 初回シード完了待ち(109品・だし巻き卵/だしのとり方を含む)

      // 1) 「だし汁」を材料に持つ基本レシピ(だし巻き卵)を開く
      await dsPage.locator('input[type="search"]').fill('だし巻き卵')
      await dsPage.waitForTimeout(500)
      await dsPage.getByText('だし巻き卵', { exact: true }).first().click()
      await dsPage.waitForTimeout(600)

      // 2) 材料エリアに「だしのとり方」への小さなリンクが出る(だし汁の行)
      const dashiLink = dsPage.getByRole('link', { name: ja.detail.dashiRecipeLink })
      check('DASH-01 「だし汁」の材料行に「だしのとり方」へのリンクが出る', (await dashiLink.count()) > 0)

      // 3) リンクをタップすると収録レシピ「だしのとり方」の詳細へ遷移する
      await dashiLink.first().click()
      await dsPage.waitForTimeout(600)
      const dashiDetail = await dsPage.textContent('body')
      check(
        'DASH-01 リンクから「だしのとり方」の詳細へ遷移する(材料に昆布・かつお節がある)',
        dashiDetail.includes('だしのとり方') &&
          dashiDetail.includes('昆布') &&
          dashiDetail.includes('かつお節'),
      )
      const dashiRecipeId = Number(dsPage.url().match(/#\/recipes\/(\d+)/)?.[1])

      // 4) 収録レシピ「だしのとり方」をユーザーが削除するとリンクは出なくなる
      await dsPage.goto(`${BASE}/#/recipes/${dashiRecipeId}/edit`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(600)
      await dsPage.getByRole('button', { name: ja.form.deleteRecipe }).click()
      await dsPage.waitForTimeout(800)
      await dsPage.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(500)
      await dsPage.locator('input[type="search"]').fill('だし巻き卵')
      await dsPage.waitForTimeout(500)
      await dsPage.getByText('だし巻き卵', { exact: true }).first().click()
      await dsPage.waitForTimeout(600)
      check(
        'DASH-01 収録レシピ「だしのとり方」を削除するとリンクは出ない(ユーザー削除を尊重)',
        (await dsPage.getByRole('link', { name: ja.detail.dashiRecipeLink }).count()) === 0,
      )
    } finally {
      await dsBrowser.close()
    }
  }

  // --- SMK-19: 静的ページ(/about/配下・/sets/)がSW有効でも200でアプリ本体にすり替わらない ---
  // アプリ本体のtitleは「うちレシピ」単独。静的ページは必ず「◯◯｜うちレシピ」形式のtitleを持つ
  currentCheck = 'SMK-19'
  const staticPages = [
    ['/about/', 'うちレシピについて'],
    ['/about/manual.html', 'うちレシピの使い方'],
    ['/about/install.html', 'ホーム画面に追加する方法'], // 2026-08-08 便EF: 追加手順の専用ページ
    ['/about/terms.html', '利用規約'],
    ['/about/tokushoho.html', '特定商取引法に基づく表記'], // 2026-08-02 便DD: 発売と同時に公開
    ['/about/unlock.html', '解錠コード'],
    ['/about/column/', 'コラム'],
    ['/about/column/kondate-kimaranai.html', '献立が決められない'],
    ['/about/column/recipe-screenshot-seiri.html', 'スクショ'],
    ['/about/foods.html', '食品と目安価格の一覧'],
    // /sets/(配布ページ)は2026-07-23のテーマ全廃で撤去
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

  // --- SMK-19b: 「食品と目安価格の一覧」(機械生成ページ)の中身とリンク・画像が生きている ---
  // 生成物なので手で崩れることはないが、リンク先の移動・アイコンの改名で静かに404になりうる。
  // 同一オリジンのリンクと画像を全部たどって200を確かめる(外部リンクは対象外)。
  {
    currentCheck = 'SMK-19b'
    await page.goto(`${BASE}/about/foods.html`, { waitUntil: 'networkidle' })
    const foodsInfo = await page.evaluate(() => ({
      rows: document.querySelectorAll('table.fd tbody tr').length,
      sections: document.querySelectorAll('section.cat').length,
      urls: [
        ...new Set(
          [
            ...Array.from(document.querySelectorAll('a[href]')).map((a) => a.href),
            ...Array.from(document.querySelectorAll('img[src]')).map((i) => i.src),
          ]
            // ページ内アンカー(#cat-…)はfoods.html自身を指すので#以降を落としてから重複を除く
            .map((u) => u.split('#')[0])
            .filter((u) => u.startsWith(location.origin)),
        ),
      ],
    }))
    check('SMK-19b 一覧の行が生成されている', foodsInfo.rows > 200, `rows=${foodsInfo.rows}`)
    check('SMK-19b 分類の見出しがある', foodsInfo.sections === 7, `sections=${foodsInfo.sections}`)
    for (const url of foodsInfo.urls) {
      const res = await page.request.get(url)
      check(`SMK-19b リンク/画像 ${url.replace(BASE, '')}`, res.status() === 200, `status=${res.status()}`)
    }
  }

  // --- SMK-19c:「ホーム画面に追加する方法」(2026-08-08 便EF)。
  // 説明図は scripts/shots-install.mjs で描いて public/about/img/install/ に置いた自作の画像で、
  // 手で書いたHTMLから参照している。ファイル名の打ち間違い・図の作り直しでの改名で
  // 静かに404になりうるため、同一オリジンのリンクと画像を全部たどって200を確かめる。
  // あわせて「必ず目に入る位置」の導線(紹介ページのCTA直下・使い方ページの冒頭)が
  // 消えていないことと、押す場所を示した図が3系統(iPhone/Android/パソコン)そろっていることを見る ---
  {
    currentCheck = 'SMK-19c'
    await page.goto(`${BASE}/about/install.html`, { waitUntil: 'networkidle' })
    const installInfo = await page.evaluate(() => ({
      figures: document.querySelectorAll('figure.shot img').length,
      headings: Array.from(document.querySelectorAll('h2')).map((h) => h.textContent?.trim() ?? ''),
      urls: [
        ...new Set(
          [
            ...Array.from(document.querySelectorAll('a[href]')).map((a) => a.href),
            ...Array.from(document.querySelectorAll('img[src]')).map((i) => i.src),
          ]
            .map((u) => u.split('#')[0])
            .filter((u) => u.startsWith(location.origin)),
        ),
      ],
    }))
    check('SMK-19c 説明図が6枚ある', installInfo.figures === 6, `枚数=${installInfo.figures}`)
    for (const kw of ['iPhone・iPad（Safari）', 'Android（Chrome）', 'パソコン（Chrome・Edge）']) {
      check(`SMK-19c ${kw} の手順がある`, installInfo.headings.some((h) => h.includes(kw)))
    }
    for (const url of installInfo.urls) {
      const res = await page.request.get(url)
      check(`SMK-19c リンク/画像 ${url.replace(BASE, '')}`, res.status() === 200, `status=${res.status()}`)
    }
    // 導線: 紹介ページは「無料で使ってみる」の直後、使い方ページは本文の冒頭に置いている
    const lpForInstall = await (await page.request.get(`${BASE}/about/`)).text()
    check(
      'SMK-19c 紹介ページの「無料で使ってみる」の近くに追加方法へのリンクがある',
      lpForInstall.includes('無料で使ってみる') &&
        lpForInstall.indexOf('/about/install.html') > lpForInstall.indexOf('無料で使ってみる') &&
        lpForInstall.indexOf('/about/install.html') - lpForInstall.indexOf('無料で使ってみる') < 400,
    )
    const manualForInstall = await (await page.request.get(`${BASE}/about/manual.html`)).text()
    check(
      'SMK-19c 使い方ページの冒頭に追加方法へのリンクがある',
      manualForInstall.includes('class="head-link"') && manualForInstall.includes('/about/install.html'),
    )
  }

  // --- LAUNCH-01: 発売後に残ってはいけない語の掃引と、発売に必要な導線(2026-08-02 便DD)。
  // 「準備期間」「販売準備中」はPro版の発売前だけの言い回しで、発売後に1箇所でも残ると
  // 「まだ買えない」と読ませてしまう。静的ページ全体を機械的に見張る。
  // 「買い切り版」は商品名の旧表記(2026-08-02 オーナー指示で商品名は「Pro版」に統一し、
  // 「買い切り」は購入形態の説明語としてだけ使う)。商品名として復活すると表記が再び混ざるので
  // 禁止語に入れる。説明語の「買い切り」単体は禁止していない。
  // 語を増やすときは FORBIDDEN_AFTER_LAUNCH に足す ---
  currentCheck = 'LAUNCH-01'
  {
    const FORBIDDEN_AFTER_LAUNCH = ['準備期間', '販売準備中', '買い切り版']
    // 決済リンク(docs/08 §3で確定した本番のPayment Link)。src/logic/pro.ts の
    // PRO_PURCHASE_URL・紹介ページの購入ボタンと同じ値であることを固定する
    const STRIPE_PAY_URL = 'https://buy.stripe.com/9B69AV8idaXva3wa4KdQQ00'
    // 精度開示(docs/62 決定④)。購入ボタンより前に出ていること＝買う前に読んで買った状態
    const ACCURACY_TAIL = '治療中の方・妊娠中の方の食事管理には使えません'

    const launchPages = [
      '/about/',
      '/about/manual.html',
      '/about/install.html',
      '/about/terms.html',
      '/about/unlock.html',
      '/about/tokushoho.html',
      '/about/column/',
    ]
    for (const p of launchPages) {
      const res = await page.request.get(`${BASE}${p}`)
      const html = await res.text()
      const hit = FORBIDDEN_AFTER_LAUNCH.filter((w) => html.includes(w))
      check(
        `LAUNCH-01 ${p} に発売前の言い回しが残っていない`,
        res.status() === 200 && hit.length === 0,
        `status=${res.status()} 残存=${hit.join('/') || 'なし'}`,
      )
    }

    // 特商法表記ページ(発売の必須ゲート・docs/08 §2)
    const tokushoRes = await page.request.get(`${BASE}/about/tokushoho.html`)
    const tokushoHtml = await tokushoRes.text()
    check(
      'LAUNCH-01 特商法表記ページが公開され、必須項目が入っている',
      tokushoRes.status() === 200 &&
        ['販売業者', '所在地', '販売価格', '返品', 'お支払い方法'].every((k) => tokushoHtml.includes(k)),
      `status=${tokushoRes.status()}`,
    )
    check(
      'LAUNCH-01 特商法表記は検索結果に出さない(noindex・氏名を含むため)',
      /<meta[^>]+name="robots"[^>]+noindex/.test(tokushoHtml),
    )

    const lpHtml = await (await page.request.get(`${BASE}/about/`)).text()
    check('LAUNCH-01 紹介ページに購入ボタン(決済リンク)がある', lpHtml.includes(STRIPE_PAY_URL))
    check('LAUNCH-01 紹介ページのフッターから特商法表記へ辿れる', lpHtml.includes('/about/tokushoho.html'))
    check(
      'LAUNCH-01 精度開示が購入ボタンより前にある(docs/62 決定④)',
      lpHtml.includes(ACCURACY_TAIL) && lpHtml.indexOf(ACCURACY_TAIL) < lpHtml.indexOf(STRIPE_PAY_URL),
    )
    check('LAUNCH-01 紹介ページの価格は総額(税込)のみ', lpHtml.includes('800円（税込）'))
    check('LAUNCH-01 紹介ページに30品上限の案内がある', lpHtml.includes('無料で登録できるレシピは30品までです'))

    // 使い方ページ: 購入の3歩(購入→コード表示→設定で入力)が書いてある
    const manualHtml = await (await page.request.get(`${BASE}/about/manual.html`)).text()
    check('LAUNCH-01 使い方ページに買い方の節がある', manualHtml.includes('Pro版の買い方'))
    check(
      'LAUNCH-01 使い方ページの買い方が購入→コード表示→設定で入力の3歩になっている',
      manualHtml.includes('/about/#buy') &&
        manualHtml.includes('購入完了の画面に解錠コード') &&
        manualHtml.includes('「購入と解錠」にそのコードを入れて'),
    )
    check('LAUNCH-01 使い方ページのフッターから特商法表記へ辿れる', manualHtml.includes('/about/tokushoho.html'))
    // 紹介ページ側のアンカー(#buy)が実在する＝使い方からのリンクが空振りしない
    check('LAUNCH-01 紹介ページに#buyのアンカーがある', /id="buy"/.test(lpHtml))
    // 買う前のお試し(2026-08-08 便DZで栄養8項目の1回だけ表示を追加)。
    // 使い方ページの「買う前にお試しいただけます」に3つとも書いてあること
    check(
      'LAUNCH-01 使い方ページのお試しの節に3つ(ナビ3回・月間1回・栄養8項目1回)が書いてある',
      manualHtml.includes('買う前にお試しいただけます') &&
        manualHtml.includes('<strong>並行調理ナビ</strong>: <strong>3回まで</strong>') &&
        manualHtml.includes('<strong>月間の献立</strong>: <strong>1回だけ</strong>') &&
        manualHtml.includes('<strong>栄養価の8項目表示</strong>: <strong>1回だけ</strong>'),
    )

    // --- LAUNCH-01(2026-08-08 便DZ): 上限を30に変えたので、対外文言のどこにも
    // 旧上限の表記が残っていないことを機械で証明する。1か所でも残ると
    // 「言っていたことと違う」になるため、静的ページ・お知らせに加えて、
    // 画面の文言が入っているJS(ビルド成果物)まで含めて検査する。
    // 「150件」等の巻き込みを避けるため、直前が数字でない場合だけを拾う ---
    const OLD_LIMIT_RE = /(?<!\d)50\s*(品|件)/
    const outwardTargets = ['/about/', '/about/manual.html', '/about/unlock.html', '/news.json']
    for (const path of outwardTargets) {
      const res = await page.request.get(`${BASE}${path}`)
      const text = await res.text()
      check(
        `LAUNCH-01(便DZ) ${path} に旧上限の表記が残っていない`,
        res.status() === 200 && !OLD_LIMIT_RE.test(text),
        `残存=${text.match(OLD_LIMIT_RE)?.[0] ?? 'なし'}`,
      )
    }
    // アプリ本体(UI文言はja.tsとしてJSに入る)。index.htmlが読み込むmodule scriptを全部見る
    const appHtml = await (await page.request.get(`${BASE}/`)).text()
    const scriptPaths = [...appHtml.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1])
    check('LAUNCH-01(便DZ) アプリのJSを検査対象として取得できた', scriptPaths.length > 0, `件数=${scriptPaths.length}`)
    for (const src of scriptPaths) {
      const res = await page.request.get(src.startsWith('http') ? src : `${BASE}${src}`)
      const text = await res.text()
      check(
        `LAUNCH-01(便DZ) アプリのJS(${src.split('/').pop()})に旧上限の表記が残っていない`,
        !OLD_LIMIT_RE.test(text),
        `残存=${text.match(OLD_LIMIT_RE)?.[0] ?? 'なし'}`,
      )
    }
  }

  // --- LAUNCH-02: アプリ内の発売状態(2026-08-02 便DD)。設定の「Pro」に購入導線が出ること・
  // アプリ画面にも発売前の言い回しが残っていないこと・お知らせに発売の告知が入っていることを見る ---
  currentCheck = 'LAUNCH-02'
  {
    const l2Browser = await chromium.launch()
    const l2Context = await l2Browser.newContext()
    const l2Page = await l2Context.newPage()
    l2Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LAUNCH-02] ${err.message}`)
    })
    try {
      await l2Page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await l2Page.waitForTimeout(2400) // 初回シード(109品)の完了待ち
      const buyHref = await l2Page.getAttribute('[data-testid="pro-buy-link"]', 'href')
      check(
        'LAUNCH-02 設定のPro節に購入ボタンがあり、決済リンクを指している',
        buyHref === 'https://buy.stripe.com/9B69AV8idaXva3wa4KdQQ00',
        `href=${buyHref}`,
      )
      const settingsText = (await l2Page.textContent('body')) ?? ''
      check(
        'LAUNCH-02 設定のPro節に発売前の言い回しが残っていない',
        !/準備期間|販売準備中/.test(settingsText),
      )
      check(
        'LAUNCH-02 購入ボタンの上に精度開示が出ている(docs/62 決定④)',
        settingsText.includes(ja.settings.unlockAccuracyNotice),
      )
      check(
        'LAUNCH-02 購入ボタンのそばに特商法表記へのリンクがある',
        (await l2Page.locator('a[href="/about/tokushoho.html"]').count()) > 0,
      )
      // 早期価格の注記(2026-08-03 オーナー指示・便DN)。購入ボタンのそばに1行だけ出し、
      // 正式版の金額はアプリには書かない(対外表記は早期価格のみ)
      check(
        'LAUNCH-02 購入ボタンのそばに「800円は早期価格」の1行が出る',
        ((await l2Page.locator('[data-testid="pro-early-price-note"]').textContent()) ?? '').includes(
          '早期価格',
        ) &&
          (await l2Page.evaluate(() => {
            const note = document.querySelector('[data-testid="pro-early-price-note"]')
            const buy = document.querySelector('[data-testid="pro-buy-link"]')
            return note?.nextElementSibling === buy
          })),
      )
      check(
        'LAUNCH-02 アプリには正式版の金額を書かない(早期価格の表記のみ)',
        !/1[,，]?500\s*円/.test(settingsText),
      )

      // お知らせ(public/news.json)の最新が発売の告知になっている
      const news = await l2Page.evaluate(async () => {
        const res = await fetch('/news.json')
        return res.ok ? await res.json() : []
      })
      // 2026-08-04 便DV-10(オーナー指摘): 押し売りに見えないよう題も文面も短くし、
      // 解錠済みには出さない印(hideWhenPro)を付けた。
      // 2026-08-08 便DZ: 上限を30に変えたお知らせが最新になった(アプリは最新1件だけを出す)
      // 2026-08-21 便IR: 題を丸ごと書き写して比べていた（オーナー書き溜め④で題を直した
      // だけで赤くなった＝禁じ手②）。印(id)と、数字が出ているかだけを見る
      check(
        'LAUNCH-02(便DZ) お知らせの最新が無料の上限の案内',
        Array.isArray(news) &&
          news[0]?.id === '2026-08-08-free-limit-30' &&
          new RegExp(`${FREE_LIMIT}品`).test(news[0]?.title ?? ''),
        `latest=${JSON.stringify(news[0]?.title)}`,
      )
      check(
        'LAUNCH-02(便DZ) 上限の案内に、登録済みのレシピが残ることが書いてある(規約F)',
        /登録済みのレシピ[^。]*使えます/.test(news[0]?.body ?? ''),
        JSON.stringify(news[0]?.body),
      )
      check(
        'LAUNCH-02(便DZ) 上限変更の告知は解錠済みには出さない印が付いている',
        news[0]?.hideWhenPro === true,
        `hideWhenPro=${news[0]?.hideWhenPro}`,
      )
      // 2026-08-21 オーナー指示（A案）: **発売前にPro版の告知を配らない**ので取り下げた
      // （原文「まだ正式なユーザーはいません。このような表現は、宣伝をした後になります」）。
      // 「その1件が在ること」を前提に測っていたので、取り下げた瞬間に赤くなっていた。
      // いまは**発売前は無いのが正しい**を測り、**発売して戻したときに作法を測る**形にする
      check(
        'LAUNCH-02 発売前はPro版そのものを題にした告知を配らない(2026-08-21 オーナー指示)',
        !news.some((n) => /Pro版/.test(n.title ?? '')),
        JSON.stringify(news.map((n) => n.title)),
      )
      check(
        'LAUNCH-02 Proの案内へ連れて行く告知には、解錠済みに出さない印が付いている',
        news
          .filter((n) => /section=pro|manual\.html#pro/.test(n.link ?? ''))
          .every((n) => n.hideWhenPro === true),
        JSON.stringify(
          news
            .filter((n) => /section=pro|manual\.html#pro/.test(n.link ?? ''))
            .map((n) => [n.id, n.hideWhenPro]),
        ),
      )

      // --- 30件の線引きの実挙動(2026-08-08 便DZ: 上限50→30・予告は節目だけ)。
      // 同梱の基本レシピ(isStarter)は上限に数えないので、ここで入れた自作レシピだけで到達する。
      // 節目の案内は「登録し終えた件数がちょうど20/27/30のとき」だけ出るので、
      // 生IndexedDBで直前まで積み、最後の1品を実際のフォームから保存して確かめる ---
      const seedOwnRecipes = (count, offset) =>
        l2Page.evaluate(
          ({ count, offset }) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['recipes'], 'readwrite')
                const store = tx.objectStore('recipes')
                for (let i = 0; i < count; i += 1) {
                  store.add({
                    title: `上限確認用レシピ${offset + i + 1}`,
                    servings: 2,
                    effortLevel: 'easy',
                    tags: [],
                    ingredients: [{ name: 'にんじん', amount: '1', unit: '本' }],
                    steps: [{ text: '切る' }],
                    isFavorite: false,
                    cookedLogs: [],
                    searchWords: [],
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                  })
                }
                tx.oncomplete = () => {
                  idb.close()
                  resolve(undefined)
                }
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { count, offset },
        )
      // フォームから1品保存する(生IndexedDBへの書き込みはliveQueryに伝わらないので毎回再読込で入る)
      const saveRecipeFromForm = async (title) => {
        await l2Page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
        await l2Page.reload({ waitUntil: 'networkidle' })
        await l2Page.waitForTimeout(1600)
        await l2Page.getByPlaceholder(ja.form.namePlaceholder).fill(title)
        await l2Page.getByRole('button', { name: '保存する' }).first().click()
        await l2Page.waitForTimeout(900)
      }
      const openRecipeList = async () => {
        await l2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await l2Page.waitForTimeout(1200)
        return (await l2Page.textContent('body')) ?? ''
      }

      // 19件まで積む: この時点では節目ではないので案内は出ない。件数表記は常時出る
      await seedOwnRecipes(19, 0)
      await l2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await l2Page.reload({ waitUntil: 'networkidle' })
      await l2Page.waitForTimeout(1600)
      check(
        'LAUNCH-02(便DZ) レシピ一覧の品数の横に「自分で登録 ◯/30品」が出る',
        ((await l2Page.locator('[data-testid="free-limit-count"]').textContent()) ?? '').includes(
          '自分で登録 19/30品',
        ),
        `件数表記=${await l2Page.locator('[data-testid="free-limit-count"]').textContent()}`,
      )
      check(
        'LAUNCH-02(便DZ) 19件では節目の案内を出さない',
        (await l2Page.locator('[data-testid="free-limit-notice"]').count()) === 0,
      )

      // 20件目を登録し終えた瞬間だけ予告を出す(あと10件)
      await saveRecipeFromForm('20品目のレシピ')
      let listText = await openRecipeList()
      check(
        'LAUNCH-02(便DZ) 20件目の登録完了で「あと10品登録できます」の予告が出る',
        (await l2Page.locator('[data-testid="free-limit-notice"]').count()) > 0 &&
          /あと10[品件]登録できます/.test(listText),
      )
      check(
        'LAUNCH-02(便DZ) 予告と同時に件数表記も20/30品になる',
        ((await l2Page.locator('[data-testid="free-limit-count"]').textContent()) ?? '').includes(
          '自分で登録 20/30品',
        ),
      )
      // 閉じたら再表示しない(一覧を開くたびに出さない)
      await l2Page.locator('[data-testid="free-limit-notice"] button').click()
      await l2Page.waitForTimeout(500)
      listText = await openRecipeList()
      check(
        'LAUNCH-02(便DZ) 予告は閉じたら再表示しない',
        (await l2Page.locator('[data-testid="free-limit-notice"]').count()) === 0,
      )

      // 21件目(節目の次)では出さない=登録のたびに同じ案内が出ない
      await saveRecipeFromForm('21品目のレシピ')
      listText = await openRecipeList()
      check(
        'LAUNCH-02(便DZ) 21件目では予告を出さない(節目のときだけ)',
        (await l2Page.locator('[data-testid="free-limit-notice"]').count()) === 0 &&
          !/あと\d+[品件]登録できます/.test(listText),
      )

      // 29件まで積んでから30件目を登録=上限到達の案内(予告ではない)
      await seedOwnRecipes(8, 100)
      await saveRecipeFromForm('30品目のレシピ')
      listText = await openRecipeList()
      check(
        'LAUNCH-02(便DZ) 30件目の登録完了で上限到達の案内が出る',
        listText.includes(ja.recipes.freeLimitReachedNotice.split('。')[0]),
      )
      check(
        'LAUNCH-02(便DZ) 上限到達の案内に「残るもの」(閲覧・編集・削除・復元)が書いてある(規約F)',
        listText.includes(ja.recipes.freeLimitReachedNotice.split('これまでどおり')[1]),
      )
      check(
        'LAUNCH-02(便DZ) 上限到達の案内から購入導線に進める(規約H)',
        (await l2Page
          .locator('[data-testid="free-limit-notice"] a[href*="section=pro"]')
          .count()) > 0,
      )

      // 31品目はブロックされる(上限で止めるのは新規追加だけ)
      await saveRecipeFromForm('31品目のレシピ')
      const blockedText = (await l2Page.textContent('body')) ?? ''
      check(
        'LAUNCH-02 30件に達したら新規追加はブロックされる',
        blockedText.includes(ja.form.freeLimitBlocked.split('。')[0]),
      )
      check(
        'LAUNCH-02 ブロックの案内に「残るもの」(閲覧・編集・削除・復元)が書いてある(規約F)',
        blockedText.includes(ja.form.freeLimitBlocked.split('これまでどおり')[1]),
      )
      check(
        'LAUNCH-02 ブロックの案内から購入導線に進める(規約H)',
        (await l2Page.locator('[data-testid="free-limit-pro-cta"]').count()) > 0,
      )
      // 既存レシピが閲覧できることまで確認する(上限で止めるのは新規追加だけ)
      listText = await openRecipeList()
      check('LAUNCH-02 上限到達後も既存レシピは一覧に出る', /上限確認用レシピ\d+/.test(listText))
      await l2Page.getByText(/^上限確認用レシピ\d+$/).first().click()
      await l2Page.waitForTimeout(800)
      const detailText = (await l2Page.textContent('body')) ?? ''
      check(
        'LAUNCH-02 上限到達後も既存レシピを開ける',
        /上限確認用レシピ\d+/.test(detailText) && detailText.includes('にんじん'),
      )
    } finally {
      await l2Browser.close()
    }
  }

  // --- NUTTRIAL-01: 栄養8項目のお試し表示(1回だけ・2026-08-08 便DZ・オーナー決定)。
  // 未解錠のまま、好きなレシピ1品で8項目のフル表示を1回だけ見られる。
  // 2026-08-21 便IN: 押すボタンは栄養の折りたたみの**外**へ移した（畳んだままでも触れるように）。
  // 畳んだまま押せることは COLLAPSED-01 が見る。ここは今までどおり「1回だけ」の効き方を見る。
  // 使い切ったら入口を出さず「ご利用済みです」に差し替わり、別のレシピではロック表示に戻る
  // ことまで確認する(Proの表示ゲート自体は変えていない=見本は1回だけ)。
  // お試しを消費するので、他のチェックの状態に影響しない専用のbrowser/contextで完結させる ---
  currentCheck = 'NUTTRIAL-01'
  {
    const ntBrowser = await chromium.launch()
    const ntContext = await ntBrowser.newContext()
    const ntPage = await ntContext.newPage()
    ntPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUTTRIAL-01] ${err.message}`)
    })
    try {
      const openNutrition = async (title) => {
        await ntPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await ntPage.waitForTimeout(1600)
        await ntPage.getByText(title, { exact: true }).first().click()
        await ntPage.waitForTimeout(700)
        await ntPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
        await ntPage.waitForTimeout(300)
        return (await ntPage.textContent('body')) ?? ''
      }

      await ntPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ntPage.waitForTimeout(2400) // 初回シード(109品)の完了待ち
      let nutText = await openNutrition('肉じゃが')
      check(
        `NUTTRIAL-01 未解錠のときは「${ja.nutrition.trialButton}」の入口が出る`,
        (await ntPage.locator('[data-testid="nutrition-trial-button"]').count()) > 0,
      )
      check(
        'NUTTRIAL-01 お試し前は8項目(たんぱく質の数値)が出ていない',
        !/たんぱく質\s*[\d,]/.test(nutText),
      )

      await ntPage.locator('[data-testid="nutrition-trial-button"]').click()
      await ntPage.waitForTimeout(500)
      nutText = (await ntPage.textContent('body')) ?? ''
      check(
        'NUTTRIAL-01 押すと8項目(たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウム・塩分相当量)の数値が出る',
        ['たんぱく質', '脂質', '炭水化物', '食物繊維', '鉄', 'カルシウム', '塩分相当量'].every((k) =>
          new RegExp(`${k}\\s*[\\d,]`).test(nutText),
        ),
      )
      check(
        'NUTTRIAL-01 お試しで表示中であることが画面に出る',
        (await ntPage.locator('[data-testid="nutrition-trial-active"]').count()) > 0 &&
          nutText.includes(ja.nutrition.trialActiveNote),
      )

      // 別のレシピではロック表示に戻る(開けるのは1品だけ)＝Proの表示ゲートは変えていない
      nutText = await openNutrition('カレーライス')
      check(
        'NUTTRIAL-01 別のレシピではロック表示に戻る(8項目は出ない)',
        !/たんぱく質\s*[\d,]/.test(nutText) && nutText.includes('栄養価8項目の概算'),
      )
      check(
        'NUTTRIAL-01 使い切ったら入口を出さず「ご利用済みです」に差し替わる',
        (await ntPage.locator('[data-testid="nutrition-trial-button"]').count()) === 0 &&
          nutText.includes('お試しの表示（1回だけ）はご利用済みです'),
      )
      check(
        'NUTTRIAL-01 使い切ったあともPro版への導線は残る',
        nutText.includes('Pro版について見る'),
      )
    } finally {
      await ntBrowser.close()
    }
  }

  // --- COLLAPSED-01: 折りたたみの中の操作が行き止まりでないこと(2026-08-21 便IN
  // → 2026-08-22 便IVでオーナーが原則を訂正)。
  //
  // 便INが当てていた原則「アプリ全体で、折りたたみを一切開かなくても、最低限一通りすべての機能を
  // 触れる（使いこなすために開く）ようにしたい」は、オーナーが便IVでこう訂正している:
  //   「折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
  //     初心者が使わないような機能はしまっておく、という意味合いでした。」
  // ＝週タブの「空にする」「テンプレート」は**しまう側**に戻った。
  // 「畳んだ状態で何が出ていて何が出ていないか」は IVFOLD-01 が受け持つので、ここでは
  // **開いたあとに行き止まりにならないこと**（押すと窓が出る・画面が開く・確認が出る）と、
  // **毎日使うものが畳んだままでも触れること**（設定のごはん・レシピ詳細の栄養のお試し）を見る。
  // 「折りたたみの中にしか無い操作が無いか」の掃引そのものは scripts/test-logic.mjs の
  // COLLAPSE-1（と、しまった4つを名指しで見る IV-4）が受け持つ。
  // 文言は ja.ts から読む(書き写さない)。掴み方は名前とアクセシビリティの状態だけで、
  // 画面のどこに出ていても同じ判定になる(禁じ手④: 置き場所に固定しない) ---
  currentCheck = 'COLLAPSED-01'
  {
    const cdBrowser = await chromium.launch()
    try {
      const cdContext = await cdBrowser.newContext()
      const cdPage = await cdContext.newPage()
      cdPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@COLLAPSED-01] ${err.message}`)
      })
      await cdPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await cdPage.waitForTimeout(2000) // 初回シード完了待ち
      await cdPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await cdPage.waitForTimeout(700)

      // 前提: 「表示のしかた」と別の週・テンプレートの節は畳んだまま(＝畳んだ状態で測っている)
      const cdFolded = await cdPage.evaluate(() =>
        [...document.querySelectorAll('button[aria-expanded]')]
          .filter((b) => /を(開く|閉じる)$/.test(b.getAttribute('aria-label') ?? ''))
          .map((b) => ({
            name: b.getAttribute('aria-label') ?? '',
            open: b.getAttribute('aria-expanded') === 'true',
          })),
      )
      const cdIsFolded = (title) =>
        cdFolded.some((g) => g.name === `${title}を開く` && !g.open)
      check(
        'COLLAPSED-01 前提: 「表示のしかた」と過去の献立・テンプレートの節は畳んだまま',
        cdIsFolded(ja.mealPlan.weekGroupDisplayTitle) &&
          cdIsFolded(ja.mealPlan.weekGroupTemplateTitle),
        JSON.stringify(cdFolded),
      )

      // 2026-08-22 便IV: この4つは折りたたみの中へ戻った（オーナーの訂正）。開いてから触る
      await openWeekGroup(cdPage, ja.mealPlan.weekGroupDisplayTitle)
      await openWeekGroup(cdPage, ja.mealPlan.weekGroupTemplateTitle)
      await cdPage.waitForTimeout(400)
      for (const [what, label, role] of [
        ['この週をまとめて空にする', ja.mealPlan.clearWeekSlotButton, 'button'],
        ['表示している週をテンプレートとして保存', ja.mealPlan.templateSave, 'button'],
        ['テンプレートを適用', ja.mealPlan.templateApplyWeek, 'button'],
        ['過去の献立をコピー', ja.mealPlan.copyPickTitle, 'link'],
      ]) {
        const btn = cdPage.getByRole(role, { name: label, exact: true })
        check(
          `COLLAPSED-01 節を開くと「${label}」が押せる（${what}）`,
          (await btn.count()) > 0 && (await btn.first().isVisible()),
        )
      }

      // 指で押せる大きさがあること。**実際の当たり判定**で測る
      // （クラス名では測らない。中心から上下左右21pxの点を突いて、そのボタンに当たるか＝TAP-44と同じ方法）
      const cdDead = await cdPage.evaluate((ids) => {
        const out = []
        for (const id of ids) {
          const el = document.querySelector(`[data-testid="${id}"]`)
          if (!el) {
            out.push({ id, missing: true })
            continue
          }
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          if (cx - 22 < 0 || cy - 22 < 0 || cx + 22 > innerWidth || cy + 22 > innerHeight) continue
          const d = 21
          const dead = [
            [cx - d, cy], [cx + d, cy], [cx, cy - d], [cx, cy + d],
          ].filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            return !(hit && (hit === el || el.contains(hit)))
          })
          if (dead.length > 0) out.push({ id, box: `${Math.round(r.width)}x${Math.round(r.height)}`, dead: dead.length })
        }
        return out
      }, ['week-clear-slot', 'week-template-save', 'week-template-apply', 'week-copy-pick'])
      check(
        'COLLAPSED-01 この4つに、44px未満の押せない場所が無い',
        cdDead.length === 0,
        JSON.stringify(cdDead),
      )

      // 行き止まりでないこと: テンプレートの2つは窓が開く
      await cdPage.getByRole('button', { name: ja.mealPlan.templateSave, exact: true }).first().click()
      await cdPage.waitForTimeout(400)
      // 献立がまだ1品も入っていない週では、窓の代わりに理由の一言が返る（どちらでも行き止まりでない）
      const cdSaveText = (await cdPage.textContent('body')) ?? ''
      check(
        'COLLAPSED-01 「保存」が返事をする(窓が開くか、理由の一言が出る)',
        cdSaveText.includes(ja.mealPlan.templateNameLabel) ||
          cdSaveText.includes(ja.mealPlan.templateSaveEmpty),
        cdSaveText.slice(0, 200),
      )
      await cdPage.keyboard.press('Escape')
      await cdPage.waitForTimeout(400)
      await cdPage
        .getByRole('button', { name: ja.mealPlan.templateApplyWeek, exact: true })
        .first()
        .click()
      await cdPage.waitForTimeout(400)
      check(
        'COLLAPSED-01 「テンプレートを適用」で窓が開く',
        (await cdPage.getByRole('dialog', { name: ja.mealPlan.templateApply }).count()) > 0,
      )
      await cdPage.keyboard.press('Escape')
      await cdPage.waitForTimeout(400)

      // 2026-08-21 便IO: 「過去の献立をコピー」を押すと、その画面が開く（行き止まりでない）
      await cdPage.getByRole('link', { name: ja.mealPlan.copyPickTitle, exact: true }).first().click()
      await cdPage.waitForTimeout(900)
      check(
        'COLLAPSED-01 「過去の献立をコピー」で、その画面が開く',
        (await cdPage.locator('[data-testid="copy-pick-run"]').count()) === 1,
        cdPage.url(),
      )
      await cdPage.goBack()
      await cdPage.waitForTimeout(900)
      await cdPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await cdPage.waitForTimeout(600)
      // 戻ると節は既定（畳んである）に戻るので、開き直してから触る
      await openWeekGroup(cdPage, ja.mealPlan.weekGroupDisplayTitle)
      await cdPage.waitForTimeout(400)

      // 「空にする」は消える操作。押すと確認の窓が必ず出る(規約F)。ここでは消さない
      // （自動押しを止めて、窓が出たことを自分の目で確かめてから「やめる」を押す）
      await setConfirmAnswer(cdPage, 'off')
      await cdPage
        .getByRole('button', { name: ja.mealPlan.clearWeekSlotButton, exact: true })
        .first()
        .click()
      await cdPage.waitForTimeout(500)
      const cdConfirmText = (await cdPage.textContent('body')) ?? ''
      check(
        'COLLAPSED-01 「空にする」を押すと確認の窓が出る(規約F)',
        cdConfirmText.includes(ja.mealPlan.clearWeekSlotConfirmOk) ||
          cdConfirmText.includes(ja.mealPlan.clearWeekSlotEmpty.replace('{slot}', ja.mealPlan.slot.dinner)),
        cdConfirmText.slice(0, 200),
      )
      const cdCancel = cdPage.getByRole('button', { name: ja.common.confirmCancel, exact: true })
      if ((await cdCancel.count()) > 0) {
        await cdCancel.first().click()
        await cdPage.waitForTimeout(300)
      }
      await setConfirmAnswer(cdPage, 'accept')

      // 設定: ごはんの計算は折りたたみの無い画面にあり、押すと切り替わる
      await cdPage.goto(`${BASE}/#/settings?section=rice`, { waitUntil: 'networkidle' })
      await cdPage.waitForTimeout(900)
      const cdRice = cdPage.locator('[data-testid="settings-include-rice"]')
      check(
        'COLLAPSED-01 設定にも「ごはんを足して計算する」の入口がある',
        (await cdRice.count()) > 0 && (await cdRice.first().isVisible()),
      )
      const cdRiceBefore = await cdRice.first().getAttribute('aria-checked')
      await cdRice.first().click()
      await cdPage.waitForTimeout(400)
      check(
        'COLLAPSED-01 設定のスイッチで切り替わる',
        (await cdRice.first().getAttribute('aria-checked')) !== cdRiceBefore,
      )
      // 端末に残る設定であること(＝献立の栄養パネルのチェックと同じ1つの設定を動かしている)
      await cdPage.reload({ waitUntil: 'networkidle' })
      await cdPage.waitForTimeout(900)
      check(
        'COLLAPSED-01 設定で切り替えた値が読み込み直しても残る',
        (await cdPage.locator('[data-testid="settings-include-rice"]').first().getAttribute(
          'aria-checked',
        )) !== cdRiceBefore,
      )

      // レシピ詳細: 栄養の折りたたみを開かないまま、8項目のお試しの入口が押せる
      await cdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cdPage.waitForTimeout(1200)
      await cdPage.getByText('肉じゃが', { exact: true }).first().click()
      await cdPage.waitForTimeout(800)
      const cdTrial = cdPage.locator('[data-testid="nutrition-trial-button"]')
      const cdNutToggle = cdPage.getByRole('button', { name: ja.nutrition.toggleExpand })
      check(
        'COLLAPSED-01 前提: 栄養の折りたたみは閉じたまま',
        (await cdNutToggle.count()) > 0 &&
          (await cdNutToggle.first().getAttribute('aria-expanded')) === 'false',
      )
      check(
        `COLLAPSED-01 畳んだままでも「${ja.nutrition.trialButton}」が押せる`,
        (await cdTrial.count()) > 0 && (await cdTrial.first().isVisible()),
      )
      await cdTrial.first().click()
      await cdPage.waitForTimeout(700)
      const cdTrialText = (await cdPage.textContent('body')) ?? ''
      check(
        'COLLAPSED-01 畳んだまま押しても、8項目が出る(折りたたみも一緒に開く)',
        ['たんぱく質', '脂質', '炭水化物', '食物繊維', '鉄', 'カルシウム', '塩分相当量'].every((k) =>
          new RegExp(`${k}\\s*[\\d,]`).test(cdTrialText),
        ),
      )
    } finally {
      await cdBrowser.close()
    }
  }

  // --- PRICEUNIT-01: 「食材と価格」の単位入力UI改修(2026-07-15オーナー実機フィードバック:
  // 単位欄が自由入力だと不安・使いにくい)。新規追加フォームで数量(数字)＋単位(選択)を別々に
  // 入力して追加すると、保存形式は従来どおり1つの文字列に合成される(「2」＋「個」→「2個」)ことを
  // IndexedDBの実データで確認する。加えて、既存デフォルト行(玉ねぎ)の数量欄を新UIで書き換えると
  // 「デフォルトに戻す」ボタンが出現し、押すと数量・単位ともに投入時の状態(1個)へ戻り
  // ボタンも再び消えることを確認する。他チェックの解錠状態・データに影響しないよう
  // 専用のbrowser/contextで完結させる ---
  currentCheck = 'PRICEUNIT-01'
  {
    const puBrowser = await chromium.launch()
    try {
      const puContext = await puBrowser.newContext()
      const puPage = await puContext.newPage()
      puPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@PRICEUNIT-01] ${err.message}`)
      })
      await puPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(1800) // 初回シード完了待ち(食材価格マスタの初期投入含む)

      await puPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(500)

      // 新規追加: 名前「テスト食材」・価格「500」・数量「2」・単位「個」で追加する
      await puPage.getByLabel(ja.priceMaster.nameLabel, { exact: true }).fill('テスト食材')
      await puPage.getByLabel(ja.priceMaster.priceLabel, { exact: true }).fill('500')
      await puPage.getByLabel(ja.priceMaster.quantityLabel, { exact: true }).fill('2')
      await puPage.getByLabel('単位', { exact: true }).selectOption('個')
      await puPage.getByRole('button', { name: '追加', exact: true }).click()
      await puPage.waitForTimeout(400)

      const testRow = puPage.locator('li', { hasText: 'テスト食材' })
      check('PRICEUNIT-01 追加した食材が一覧に並ぶ', (await testRow.count()) === 1)

      // 保存形式が従来どおり1つの文字列(「2個」)に合成されていることをIndexedDBの実データで確認
      // (updatePriceEntryのisDefault再判定が文字列比較のため、合成結果の完全一致が最重要)
      const savedTestEntry = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === 'テスト食材')
      })
      check(
        'PRICEUNIT-01 数量「2」+単位「個」が「2個」の1文字列に合成されて保存される',
        savedTestEntry?.unit === '2個' && savedTestEntry?.pricePerUnit === 500,
        `savedTestEntry=${JSON.stringify(savedTestEntry)}`,
      )

      // 一覧の行は「2個」を数量欄「2」＋単位選択「個」に分解して表示する(往復確認)
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を数量欄「2」に分解して表示する',
        (await testRow.getByLabel('テスト食材の数量').inputValue()) === '2',
      )
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を単位選択「個」に分解して表示する',
        (await testRow.getByLabel('テスト食材の単位').inputValue()) === '個',
      )

      // 既存のデフォルト行(玉ねぎ=1個50円)の数量を新UIで書き換えると「デフォルトに戻す」が出る
      const onionRow = puPage.locator('li', { hasText: '玉ねぎ' })
      check(
        'PRICEUNIT-01 編集前の玉ねぎ行には「デフォルトに戻す」が出ない',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const onionQtyInput = onionRow.getByLabel('玉ねぎの数量')
      await onionQtyInput.fill('3')
      await onionQtyInput.press('Enter') // Enterでblur→保存
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 数量欄(新UI)を書き換えると「デフォルトに戻す」が出る',
        (await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const savedOnionAfterEdit = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === '玉ねぎ')
      })
      check(
        'PRICEUNIT-01 数量「3」への書き換えが「3個」の1文字列に合成されて保存される',
        savedOnionAfterEdit?.unit === '3個',
        `savedOnionAfterEdit=${JSON.stringify(savedOnionAfterEdit)}`,
      )

      // 「デフォルトに戻す」で投入時の状態(数量「1」・単位「個」)に戻り、ボタンも再び消える
      await onionRow.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後はボタンが再び消える',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は数量欄が「1」に戻る',
        (await onionRow.getByLabel('玉ねぎの数量').inputValue()) === '1',
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は単位選択が「個」に戻る',
        (await onionRow.getByLabel('玉ねぎの単位').inputValue()) === '個',
      )
    } finally {
      await puBrowser.close()
    }
  }

  // --- BACKUP-01: バックアップの全ユーザーデータ対応(在庫・買い物メモ・週献立・今日の献立・
  // 食材価格マスタ。2026-07-13 データ堅牢性強化)。価格編集+週献立割当+在庫品を実際の
  // 「バックアップ」タブ→「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで捕捉)で
  // 書き出し、まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元して
  // 実際に引き継がれることを確認する。加えて、これらの項目が無い旧形式のbackup JSONを
  // 既に価格・在庫データのあるプロファイルへ読み込んでもエラーにならず既存データが消えない
  // (後方互換)ことも確認する。他チェックへの影響を避けるため専用のbrowser/contextで完結させる。
  // 週献立・在庫ボード自体のUI操作はMEALPLAN-01〜03/INLINE-01等で別途カバー済みのため、
  // ここでは前提データの用意にIndexedDBへの直接書き込みを使い、バックアップ機構そのものの
  // 往復検証(実際のエクスポート/インポートUI経由)に的を絞る ---
  currentCheck = 'BACKUP-01'
  {
    let downloadedJson = ''
    // MERGE-01(便CJ/C1)でも参照するのでtryブロックの外で宣言する
    let setup = null

    // 1)〜3) 書き出し元プロファイル: 価格を1件編集・週献立に1枠割当・在庫に1品を用意し、
    // 実際の「ファイルに書き出す」ボタンでバックアップJSONを書き出す
    const srcBrowser = await chromium.launch()
    try {
      const srcContext = await srcBrowser.newContext({ acceptDownloads: true })
      const srcPage = await srcContext.newPage()
      srcPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(書き出し元)] ${err.message}`)
      })
      srcPage.on('dialog', (dialog) => dialog.accept())
      await srcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(1800) // 初回シード完了待ち

      // 価格を1件編集(玉ねぎ→888円。「食材と価格」一覧の行内編集を実際のUIで行う)
      await srcPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      const srcOnionPriceInput = srcPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      await srcOnionPriceInput.fill('888')
      await srcOnionPriceInput.press('Enter')
      await srcPage.waitForTimeout(400)

      // 週献立に1枠割当・在庫に1品・Pro解錠コード(IndexedDBへ直接書き込み。理由は上のコメントの通り。
      // Pro解錠コードは2026-07-17バックアップ改修 修正1のコード往復確認用。実際の購入コードは
      // 販売台帳の原本のためNUT-02等と同様settings.proCodeの直書きで「解錠済み」を再現する)
      setup = await srcPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const recipeId = await new Promise((resolve, reject) => {
          const cursorReq = idb.transaction('recipes', 'readonly').objectStore('recipes').openCursor()
          cursorReq.onsuccess = () => resolve(cursorReq.result ? cursorReq.result.primaryKey : null)
          cursorReq.onerror = () => reject(cursorReq.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['mealPlans', 'pantryItems', 'settings'], 'readwrite')
          tx.objectStore('mealPlans').add({ date: '2026-07-20', slot: 'dinner', recipeId, role: 'main' })
          tx.objectStore('pantryItems').add({ name: 'E2Eバックアップ確認在庫', level: 'have', isFrequent: true })
          const settingsStore = tx.objectStore('settings')
          const getReq = settingsStore.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            settingsStore.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        // 便CJ/C1(2026-07-30): 既にあるレシピに紐づくユーザーデータ(お気に入り・作った記録)も
        // 用意する。まっさらな端末へ「追加」で読み込むと同梱の基本レシピは必ずID衝突するため、
        // 以前はこれらが1件も戻らなかった(実機QA S1)。下のMERGE-01がその再発を検出する
        const recipeTitle = await new Promise((resolve, reject) => {
          const tx2 = idb.transaction('recipes', 'readwrite')
          const store = tx2.objectStore('recipes')
          const getReq = store.get(recipeId)
          let title = null
          getReq.onsuccess = () => {
            const recipe = getReq.result
            title = recipe.title
            store.put({
              ...recipe,
              isFavorite: true,
              cookedLogs: [{ date: '2026-07-19', note: 'E2Eマージ確認の記録' }],
            })
          }
          tx2.oncomplete = () => resolve(title)
          tx2.onerror = () => reject(tx2.error)
        })
        idb.close()
        return { recipeId, recipeTitle }
      })
      check('BACKUP-01 前提: 割当先レシピIDを取得できた', typeof setup.recipeId === 'number')

      // 「バックアップ」タブ→「ファイルに書き出す」で実際に書き出す
      await srcPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      await srcPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await srcPage.waitForTimeout(300)
      const [download] = await Promise.all([
        srcPage.waitForEvent('download'),
        srcPage.getByRole('button', { name: 'ファイルに書き出す' }).click(),
      ])
      downloadedJson = readFileSync(await download.path(), 'utf-8')
      const exported = JSON.parse(downloadedJson)
      const exportedOnion = (exported.prices ?? []).find((p) => p.name === '玉ねぎ')
      check(
        'BACKUP-01 書き出しJSONに編集後の価格(玉ねぎ888円)が含まれる',
        exportedOnion?.pricePerUnit === 888,
        `exportedOnion=${JSON.stringify(exportedOnion)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに割り当てた週献立の枠が含まれる',
        (exported.mealPlans ?? []).some(
          (m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.recipeId === setup.recipeId,
        ),
        `mealPlans=${JSON.stringify(exported.mealPlans)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに追加した在庫品が含まれる',
        (exported.pantryItems ?? []).some((p) => p.name === 'E2Eバックアップ確認在庫'),
      )
      check(
        'BACKUP-01 書き出しJSONの新規5テーブルはid(自動採番)を含まない(復元先で振り直すため)',
        ['pantryItems', 'shoppingItems', 'mealPlans', 'todayList', 'prices'].every((key) =>
          (exported[key] ?? []).every((row) => !('id' in row)),
        ),
      )
      // CODEBACKUP-01(修正1): 書き出しJSONにPro解錠コードが含まれること(オーナー実害
      // 「ブラウザデータ消去→復元しても購入状態が戻らない」の再発防止。settings自体が
      // 従来からバックアップに含まれていたが、コード欄がちゃんと乗ることを明示的に固定する)
      check(
        'CODEBACKUP-01 書き出しJSONの settings.proCode に解錠コードが含まれる',
        exported.settings?.proCode === 'UR-E2E-TEST-ONLY',
        `exported.settings=${JSON.stringify(exported.settings)}`,
      )
    } finally {
      await srcBrowser.close()
    }

    // 4) まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元する
    const dstBrowser = await chromium.launch()
    try {
      const dstContext = await dstBrowser.newContext()
      const dstPage = await dstContext.newPage()
      dstPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(復元先)] ${err.message}`)
      })
      dstPage.on('dialog', (dialog) => dialog.accept())
      await dstPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(1800) // 初回シード完了待ち(まっさらな別プロファイル)
      await dstPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      await dstPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await dstPage.waitForTimeout(300)
      const fileChooser = await clickReplaceImport(dstPage)
      await fileChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(downloadedJson, 'utf-8'),
      })
      await dstPage.waitForTimeout(800)
      const dstMessage = await dstPage.textContent('body')
      check(
        'BACKUP-01 復元後に成功メッセージが出る(エラーにならない)',
        dstMessage.includes(ja.settings.backupImportDone.replace('{n}', '')),
      )
      check(
        'BACKUP-01 復元後にエラーメッセージは出ない',
        !dstMessage.includes(ja.settings.backupImportError),
      )

      // 価格が実際に復元されたことをUIで確認する(玉ねぎ888円)
      await dstPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      const dstOnionPriceInput = dstPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      check('BACKUP-01 価格編集(玉ねぎ888円)が復元される', (await dstOnionPriceInput.inputValue()) === '888')

      // 週献立・在庫が実際に復元されたことをIndexedDBで直接確認する
      const restored = await dstPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        const [mealPlans, pantryItems] = await Promise.all([getAll('mealPlans'), getAll('pantryItems')])
        idb.close()
        return { mealPlans, pantryItems, settings }
      })
      check(
        'BACKUP-01 週献立の割当(2026-07-20夕食)が復元される',
        restored.mealPlans.some((m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.role === 'main'),
        `mealPlans=${JSON.stringify(restored.mealPlans)}`,
      )
      check(
        'BACKUP-01 在庫の追加品が復元される',
        restored.pantryItems.some((p) => p.name === 'E2Eバックアップ確認在庫'),
        `pantryItems=${JSON.stringify(restored.pantryItems)}`,
      )
      // CODEBACKUP-01(修正1・最重要): 「ブラウザデータ消去→復元」を再現する本命シナリオ。
      // まっさらな(購入していない)別プロファイルへ「読み込む(置き換え)」で復元するだけで、
      // Pro解錠コードも一緒に戻り購入状態が回復することを確認する
      check(
        'CODEBACKUP-01 まっさらなプロファイルへの置き換え復元でPro解錠コードが戻る(オーナー実害の再発防止)',
        restored.settings?.proCode === 'UR-E2E-TEST-ONLY',
        `settings=${JSON.stringify(restored.settings)}`,
      )
      // UI側でも実際にPro解錠済み表示になっていることを確認する(IndexedDB直読みだけでなく
      // 画面表示にも反映されることの担保)
      await dstPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      check(
        'CODEBACKUP-01 復元後、Pro節の表示も解錠済みになっている',
        stripZwspText(await dstPage.textContent('body')).includes(ja.settings.proActivatedTitle),
      )
    } finally {
      await dstBrowser.close()
    }

    // 4b) MERGE-01(2026-07-30 便CJ/C1・実機QA S1事故の再発防止): 同じファイルをまっさらな別
    //     プロファイルへ「読み込む(今のデータに追加)」で読み込む。以前はこの経路が
    //     レシピ本体と解錠コードしか見ておらず、(a)在庫・買い物メモ・週献立・今日の献立・価格・
    //     日付メモ・献立テンプレートの7テーブルと、(b)既にあるレシピ(まっさら端末では同梱109品が
    //     必ずID衝突する)の作った記録・お気に入り・写真が1件も戻らないまま「追加◯件・
    //     スキップ◯件」と成功風に表示されていた。非破壊マージ(今のデータは1件も消さない)に
    //     なったことと、今のデータを上書きしないことの両方を固定する
    currentCheck = 'MERGE-01'
    const mergeBrowser = await chromium.launch()
    try {
      const mergeContext = await mergeBrowser.newContext()
      const mergePage = await mergeContext.newPage()
      mergePage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MERGE-01] ${err.message}`)
      })
      mergePage.on('dialog', (dialog) => dialog.accept())
      await mergePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mergePage.waitForTimeout(1800) // 初回シード完了待ち(まっさらな別プロファイル)
      await mergePage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await mergePage.waitForTimeout(500)
      await mergePage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await mergePage.waitForTimeout(300)
      const [mergeChooser] = await Promise.all([
        mergePage.waitForEvent('filechooser'),
        mergePage.getByRole('button', { name: ja.settings.backupImportMerge }).click(),
      ])
      await mergeChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(downloadedJson, 'utf-8'),
      })
      await mergePage.waitForTimeout(1200)
      const mergeBody = await mergePage.textContent('body')
      // 2026-08-27 便LS: 「足す」を「追加」にそろえた（オーナー指示）ので、文字を書き写さず
      // ja.ts の型紙から見出しの部分を取る（言い回しが変わっても、この判定はそのまま当たる）
      const mergeLead = ja.settings.backupImportMergeResult.split('{a}')[0]
      const mergeTables = ja.settings.backupImportMergeResultTables.split('{t}')[0]
      check(
        'MERGE-01 結果に取り込みの内訳が出る(何が追加されたかを画面で確認できる)',
        mergeLead.length > 4 &&
          mergeBody.includes(mergeLead) &&
          mergeBody.includes(mergeTables) &&
          mergeBody.includes('「作った記録」'),
        `body抜粋=${mergeBody.slice(mergeBody.indexOf(mergeLead), mergeBody.indexOf(mergeLead) + 200)}`,
      )
      check('MERGE-01 エラーメッセージは出ない', !mergeBody.includes(ja.settings.backupImportError))
      const mergedData = await mergePage.evaluate(async (recipeId) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const recipe = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        const [mealPlans, pantryItems, prices] = await Promise.all([
          getAll('mealPlans'),
          getAll('pantryItems'),
          getAll('prices'),
        ])
        idb.close()
        return { recipe, mealPlans, pantryItems, prices }
      }, setup.recipeId)
      check(
        'MERGE-01 既にあるレシピ(ID衝突する同梱レシピ)へ「作った記録」が取り込まれる',
        (mergedData.recipe?.cookedLogs ?? []).some((log) => log.note === 'E2Eマージ確認の記録'),
        `cookedLogs=${JSON.stringify(mergedData.recipe?.cookedLogs)}`,
      )
      check(
        'MERGE-01 既にあるレシピへお気に入りが取り込まれる',
        mergedData.recipe?.isFavorite === true,
      )
      check(
        'MERGE-01 既にあるレシピの内容(料理名)は書き換えない(今のデータを優先)',
        mergedData.recipe?.title === setup.recipeTitle,
      )
      check(
        'MERGE-01 週献立が取り込まれる(7テーブルの取りこぼしの再発防止)',
        mergedData.mealPlans.some((m) => m.date === '2026-07-20' && m.slot === 'dinner'),
        `mealPlans=${JSON.stringify(mergedData.mealPlans)}`,
      )
      check(
        'MERGE-01 在庫が取り込まれる(7テーブルの取りこぼしの再発防止)',
        mergedData.pantryItems.some((p) => p.name === 'E2Eバックアップ確認在庫'),
        `pantryItems=${JSON.stringify(mergedData.pantryItems)}`,
      )
      const mergedOnion = mergedData.prices.filter((p) => p.name === '玉ねぎ')
      check(
        'MERGE-01 今の価格は上書きせず二重にも増やさない(非破壊マージ: 同じ名前の行は足さない)',
        mergedOnion.length === 1 && mergedOnion[0].pricePerUnit !== 888,
        `玉ねぎ=${JSON.stringify(mergedOnion)}`,
      )
    } finally {
      await mergeBrowser.close()
    }
    currentCheck = 'BACKUP-01'

    // 5) 後方互換: 新5テーブルの項目が無い旧形式のbackup JSONを、既に価格・在庫データのある
    //    プロファイルへ読み込んでもエラーにならず、既存の価格・在庫データが消えないことを確認する。
    //    あわせて便CJ/C2(2026-07-30・実機QA S2)の再発防止: この旧形式JSONはsettings自体を
    //    持たないため、以前は置き換えで読むと解錠コード・NG食材・テーマ・週の食費予算が
    //    既定値へ初期化されていた(スプレッドが何も上書きせずdefaultSettingsが書かれていた)
    const compatBrowser = await chromium.launch()
    try {
      const compatContext = await compatBrowser.newContext()
      const compatPage = await compatContext.newPage()
      compatPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(後方互換)] ${err.message}`)
      })
      compatPage.on('dialog', (dialog) => dialog.accept())
      await compatPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(1800) // 初回シード完了待ち

      // 復元前から価格マスタ・在庫ボードにデータがある状態を用意する(IndexedDBへ直接書き込み)
      await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['prices', 'pantryItems', 'settings'], 'readwrite')
          tx.objectStore('prices').add({
            name: 'E2E後方互換確認価格',
            pricePerUnit: 321,
            unit: '1個',
            updatedAt: Date.now(),
            isDefault: false,
          })
          tx.objectStore('pantryItems').add({ name: 'E2E後方互換確認在庫', level: 'have', isFrequent: true })
          // 便CJ/C2: 解錠コード・NG食材・テーマ・週の食費予算を入れた「使っている端末」を再現する
          const settingsStore = tx.objectStore('settings')
          const getReq = settingsStore.get(1)
          getReq.onsuccess = () => {
            const cur = getReq.result || { id: 1 }
            settingsStore.put({
              ...cur,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
              ngIngredients: ['E2E確認NG食材'],
              theme: 'brown',
              weeklyBudget: 4321,
            })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })

      // この対応より前の形式(新5テーブルの項目が一切無い)のbackup JSONを模す
      const oldFormatBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })

      await compatPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(500)
      await compatPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await compatPage.waitForTimeout(300)
      const compatFileChooser = await clickReplaceImport(compatPage)
      await compatFileChooser.setFiles({
        name: 'old-format-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(oldFormatBackup, 'utf-8'),
      })
      await compatPage.waitForTimeout(800)
      check(
        'BACKUP-01 旧形式(新5テーブル項目なし)のバックアップを読み込んでもエラーにならない',
        !(await compatPage.textContent('body')).includes(ja.settings.backupImportError),
      )

      const afterCompat = await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const [prices, pantryItems] = await Promise.all([getAll('prices'), getAll('pantryItems')])
        const recipeCount = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('recipes', 'readonly').objectStore('recipes').count()
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return { prices, pantryItems, recipeCount, settings }
      })
      check(
        'BACKUP-01 旧形式の復元で既存の価格マスタが消えない(clearされない)',
        afterCompat.prices.some((p) => p.name === 'E2E後方互換確認価格'),
        `prices件数=${afterCompat.prices.length}`,
      )
      check(
        'BACKUP-01 旧形式の復元で既存の在庫ボードが消えない(clearされない)',
        afterCompat.pantryItems.some((p) => p.name === 'E2E後方互換確認在庫'),
        `pantryItems件数=${afterCompat.pantryItems.length}`,
      )
      check(
        'BACKUP-01 旧形式でもrecipesフィールド自体は従来どおり置き換わる(空配列→0件)',
        afterCompat.recipeCount === 0,
        `recipeCount=${afterCompat.recipeCount}`,
      )
      check(
        'REPLACESETTINGS-01 便CJ/C2: settingsを持たないJSONの置き換えでPro解錠コードが消えない',
        afterCompat.settings?.proCode === 'UR-E2E-TEST-ONLY',
        `settings=${JSON.stringify(afterCompat.settings)}`,
      )
      check(
        'REPLACESETTINGS-01 便CJ/C2: settingsを持たないJSONの置き換えでNG食材・テーマ・週の食費予算も初期化されない',
        (afterCompat.settings?.ngIngredients ?? []).includes('E2E確認NG食材') &&
          afterCompat.settings?.theme === 'brown' &&
          afterCompat.settings?.weeklyBudget === 4321,
        `settings=${JSON.stringify(afterCompat.settings)}`,
      )
    } finally {
      await compatBrowser.close()
    }
  }

  // --- REPLACEUNDO-01(2026-07-17設定ゼロベース裁定#6): 置き換え読み込みの安全三重化。
  // (a)確認文(pickImportFile・onImportFileの両方)に消える件数(レシピ・作った記録・価格)が
  //    具体的に入り、「何が残るか/どうなるか」も書かれていること(app/CLAUDE.md規約F)
  // (b)実行前に現データを内部(preImportSnapshotsテーブル)へ自動退避すること
  // (c)置き換え直後に1回だけ「元に戻す」が出て、押すと退避データから実際に復元できること
  // を、実際の「読み込む(今のデータと置き換え)」UIフローで確認する。他チェックに影響しない
  // よう専用のbrowser/contextで完結させる ---
  currentCheck = 'REPLACEUNDO-01'
  {
    const ruBrowser = await chromium.launch()
    try {
      const ruContext = await ruBrowser.newContext()
      const ruPage = await ruContext.newPage()
      ruPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@REPLACEUNDO-01] ${err.message}`)
      })
      const dialogMessages = []
      await collectConfirms(ruPage, dialogMessages)

      const countTable = async (storeName) =>
        ruPage.evaluate(async (name) => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const count = await new Promise((resolve, reject) => {
            const req2 = idb.transaction(name, 'readonly').objectStore(name).count()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
          idb.close()
          return count
        }, storeName)

      await ruPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ruPage.waitForTimeout(1800) // 初回シード完了待ち

      const originalRecipeCount = await countTable('recipes')
      check(
        'REPLACEUNDO-01 前提: 基本レシピがシードされている',
        originalRecipeCount > 0,
        `originalRecipeCount=${originalRecipeCount}`,
      )

      await ruPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await ruPage.waitForTimeout(500)
      await ruPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await ruPage.waitForTimeout(300)

      const emptyBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })
      const fileChooser = await clickReplaceImport(ruPage)
      await fileChooser.setFiles({
        name: 'empty-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(emptyBackup, 'utf-8'),
      })
      await ruPage.waitForTimeout(800)

      check(
        'REPLACEUNDO-01(a) 確認文(事前確認+実行前確認の2回とも)に消えるレシピ件数が具体的に入る(規約F)',
        dialogMessages.length === 2 &&
          dialogMessages.every((m) => hasCountAfter(m, '今のレシピ', originalRecipeCount)),
        `dialogMessages=${JSON.stringify(dialogMessages)}`,
      )
      check(
        'REPLACEUNDO-01(a) 確認文に「作った記録」「価格」の件数も入る',
        dialogMessages.every((m) => /作った記録\d+件・価格\d+件/.test(m)),
        `dialogMessages=${JSON.stringify(dialogMessages)}`,
      )
      check(
        'REPLACEUNDO-01(a) 確認文に「元に戻す」で戻せる旨(残る/どうなるか)も書かれている' +
          '(規約F。「よろしいですか？」だけの確認にしない)',
        dialogMessages.every((m) => m.includes('元に戻す') && m.includes('戻せます')),
      )

      check(
        'REPLACEUNDO-01 置き換え実行後に成功メッセージが出る(0品)',
        (await ruPage.textContent('body')).includes('0品のレシピを読み込みました'),
      )
      check(
        'REPLACEUNDO-01(c) 置き換え直後に「元に戻す」バナーが出る',
        (await ruPage.textContent('body')).includes('元に戻す'),
      )

      const afterReplaceRecipeCount = await countTable('recipes')
      const afterReplaceSnapshotCount = await countTable('preImportSnapshots')
      check(
        'REPLACEUNDO-01(b) 置き換え前に現データが内部へ自動退避されている(preImportSnapshotsに1件)',
        afterReplaceSnapshotCount === 1,
        `afterReplaceSnapshotCount=${afterReplaceSnapshotCount}`,
      )
      check(
        'REPLACEUNDO-01 置き換え後、実際にレシピが0件になっている(IndexedDB直読み)',
        afterReplaceRecipeCount === 0,
      )

      // 「元に戻す」を押す
      await ruPage.getByRole('button', { name: '元に戻す', exact: true }).click()
      await ruPage.waitForTimeout(800)
      check(
        'REPLACEUNDO-01(c) 「元に戻す」後に復元完了メッセージが出る',
        stripZwspText(await ruPage.textContent('body')).includes(ja.settings.replaceUndoDone),
      )
      const afterUndoRecipeCount = await countTable('recipes')
      const afterUndoSnapshotCount = await countTable('preImportSnapshots')
      check(
        'REPLACEUNDO-01(c) 「元に戻す」でレシピ件数が退避前と一致する',
        afterUndoRecipeCount === originalRecipeCount,
        `originalRecipeCount=${originalRecipeCount} afterUndoRecipeCount=${afterUndoRecipeCount}`,
      )
      check(
        'REPLACEUNDO-01 復元後は退避データが消える(1世代のみ保持)',
        afterUndoSnapshotCount === 0,
      )
    } finally {
      await ruBrowser.close()
    }
  }

  // --- CODEMERGE-01(2026-07-17バックアップ改修 修正1): merge復元(「読み込む(今のデータに追加)」)
  // でもPro解錠コードが戻ること、および旧形式(コード無し)バックアップをmergeしても既存の解錠
  // コードが消えない(後方互換)ことを、実際の「バックアップを読み込む」UI経由で確認する。
  // (a) 既存プロファイルはコード未購入→コードを含むバックアップをmerge→復元後に解錠される
  // (b) 既存プロファイルはPro解錠済み→コードを含まない旧形式バックアップをmerge→解錠状態が
  //     消えない(mergeUnlockCodesの「バックアップに無ければ既存を保持」を実UIで固定する) ---
  currentCheck = 'CODEMERGE-01'
  {
    // (a) 未購入プロファイル + コード入りバックアップをmerge → 解錠される
    const cmaBrowser = await chromium.launch()
    try {
      const cmaContext = await cmaBrowser.newContext()
      const cmaPage = await cmaContext.newPage()
      cmaPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@CODEMERGE-01(a)] ${err.message}`)
      })
      cmaPage.on('dialog', (dialog) => dialog.accept())
      await cmaPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cmaPage.waitForTimeout(1800) // 初回シード完了待ち(未購入のまっさらなプロファイル)

      const backupWithCode = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: { proCode: 'UR-E2E-MERGE-TEST', proActivatedAt: Date.now() },
        recipes: [],
      })
      await cmaPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await cmaPage.waitForTimeout(500)
      await cmaPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await cmaPage.waitForTimeout(300)
      const [cmaFileChooser] = await Promise.all([
        cmaPage.waitForEvent('filechooser'),
        cmaPage.getByRole('button', { name: ja.settings.backupImportMerge }).click(),
      ])
      await cmaFileChooser.setFiles({
        name: 'with-code-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backupWithCode, 'utf-8'),
      })
      await cmaPage.waitForTimeout(800)
      const cmaProCode = await cmaPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return settings?.proCode
      })
      check(
        'CODEMERGE-01(a) 未購入プロファイルへのmerge復元でバックアップ側のPro解錠コードが設定される',
        cmaProCode === 'UR-E2E-MERGE-TEST',
        `proCode=${cmaProCode}`,
      )
    } finally {
      await cmaBrowser.close()
    }

    // (b) Pro解錠済みプロファイル + コード無し(旧形式)バックアップをmerge → 解錠状態が消えない
    const cmbBrowser = await chromium.launch()
    try {
      const cmbContext = await cmbBrowser.newContext()
      const cmbPage = await cmbContext.newPage()
      cmbPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@CODEMERGE-01(b)] ${err.message}`)
      })
      cmbPage.on('dialog', (dialog) => dialog.accept())
      await cmbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cmbPage.waitForTimeout(1800) // 初回シード完了待ち

      // 既にPro解錠済みの状態を用意する(IndexedDB直書き。実コードは販売台帳の原本のため
      // NUT-02等と同じ方式で「解錠済み」だけを再現する)
      await cmbPage.evaluate(async () => {
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
            store.put({ ...current, id: 1, proCode: 'UR-E2E-EXISTING', proActivatedAt: Date.now() })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })

      // コード欄もsettings欄も無い、この対応より前の旧形式バックアップを模す
      const oldFormatNoCodeBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })
      await cmbPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await cmbPage.waitForTimeout(500)
      await cmbPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await cmbPage.waitForTimeout(300)
      const [cmbFileChooser] = await Promise.all([
        cmbPage.waitForEvent('filechooser'),
        cmbPage.getByRole('button', { name: ja.settings.backupImportMerge }).click(),
      ])
      await cmbFileChooser.setFiles({
        name: 'old-format-no-code-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(oldFormatNoCodeBackup, 'utf-8'),
      })
      await cmbPage.waitForTimeout(800)
      check(
        'CODEMERGE-01(b) 旧形式バックアップのmerge復元でもエラーにならない',
        !(await cmbPage.textContent('body')).includes(ja.settings.backupImportError),
      )
      const cmbProCode = await cmbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return settings?.proCode
      })
      check(
        'CODEMERGE-01(b) 旧形式(コード無し)バックアップをmergeしても既存のPro解錠コードは消えない(空で上書きしない)',
        cmbProCode === 'UR-E2E-EXISTING',
        `proCode=${cmbProCode}`,
      )
    } finally {
      await cmbBrowser.close()
    }
  }

  // --- LW-01(2026-08-28 便LW): 説明ページからアプリへ帰れること ---------------------------
  // オーナー原文（2026-08-27）「アプリではなくHPへ飛ばされるので、アプリを開きなおしたり、
  // 『アプリを開く』をHPから探さないといけない」。便LSが2枚だけ直したので、他の説明ページへ
  // 飛ばされると同じ行き止まりになっていた。ここで見るのは**実際のブラウザでの見え方**:
  //   (a) アプリから来たら帰り道が見えて、押すと元の画面に着く
  //   (b) アプリから来ていない人（検索から来た人）には出ない
  //   (c) 外部サイトへ飛ばす踏み台にならない
  //   (d) 説明ページを渡り歩いても帰り道が消えない
  // 文言は掴まない（禁じ手②）。要素は id、行き先は**パス**で見る。
  currentCheck = 'LW-01'
  {
    const lwBrowser = await chromium.launch()
    const lwContext = await lwBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const lwPage = await lwContext.newPage()
    try {
      const LW_FROM = '/settings?section=backup'
      const lwQuery = `?from=${encodeURIComponent(LW_FROM)}`
      // 説明ページは増えるものなので、一覧に無いページを作られたら気づけるよう
      // **紹介ページから辿れる説明ページも合わせて**数える（上限ではなく下限で見る）
      const lwPages = [
        '/about/',
        '/about/manual.html',
        '/about/multi-device.html',
        '/about/install.html',
        '/about/terms.html',
        '/about/tokushoho.html',
        '/about/unlock.html',
        '/about/foods.html',
        '/about/column/',
        '/about/column/kondate-kimaranai.html',
        '/about/column/recipe-screenshot-seiri.html',
      ]
      const lwMissing = []
      const lwTooSmall = []
      const lwShownWithoutApp = []
      const lwShownForOutside = []
      for (const p of lwPages) {
        await lwPage.goto(`${BASE}${p}${lwQuery}`, { waitUntil: 'networkidle' })
        const lwLink = lwPage.locator('#appReturn')
        const lwHref = (await lwLink.count()) === 1 ? await lwLink.getAttribute('href') : null
        const lwBox = (await lwLink.count()) === 1 ? await lwLink.boundingBox() : null
        if (lwHref !== `/#${LW_FROM}` || !(await lwLink.isVisible().catch(() => false))) {
          lwMissing.push(`${p}(href=${lwHref})`)
        }
        // 料理中に押すボタンなので、押せる大きさ（44px）を下回らないこと
        if (!lwBox || lwBox.height < 44) lwTooSmall.push(`${p}(高さ=${lwBox?.height ?? 'なし'})`)

        await lwPage.goto(`${BASE}${p}`, { waitUntil: 'networkidle' })
        if ((await lwPage.locator('#appReturn').count()) !== 0) lwShownWithoutApp.push(p)

        for (const outside of ['https://example.com/', '//example.com/']) {
          await lwPage.goto(`${BASE}${p}?from=${encodeURIComponent(outside)}`, {
            waitUntil: 'networkidle',
          })
          if ((await lwPage.locator('#appReturn').count()) !== 0) lwShownForOutside.push(`${p}(${outside})`)
        }
      }
      check(
        'LW-01 前提: 説明ページを数えられている（0枚なら見張りが空振りしている）',
        lwPages.length >= 11,
        `見た枚数=${lwPages.length}`,
      )
      check(
        'LW-01 アプリから来たら、どの説明ページにも帰り道が出る',
        lwMissing.length === 0,
        `出ない=${JSON.stringify(lwMissing)}`,
      )
      check(
        'LW-01 帰り道が料理中でも押せる大きさ（44px以上）',
        lwTooSmall.length === 0,
        `小さい=${JSON.stringify(lwTooSmall)}`,
      )
      check(
        'LW-01 アプリから来ていない人には帰り道を出さない',
        lwShownWithoutApp.length === 0,
        `出てしまう=${JSON.stringify(lwShownWithoutApp)}`,
      )
      check(
        'LW-01 外部サイトへ飛ばす踏み台にならない',
        lwShownForOutside.length === 0,
        `受けてしまう=${JSON.stringify(lwShownForOutside)}`,
      )

      // (d) 説明ページを渡り歩いても帰り道が消えない。
      // 使い方ページは解錠コードの使い方・食品と目安価格の一覧・コラムへリンクしているので、
      // 1歩進んだだけで帰り道が消えると、報告された行き止まりにそのまま戻る
      await lwPage.goto(`${BASE}/about/manual.html${lwQuery}`, { waitUntil: 'networkidle' })
      const lwHandover = await lwPage.evaluate(() => {
        const out = { about: [], sameFile: [] }
        for (const a of document.querySelectorAll('a[href]')) {
          const raw = a.getAttribute('href')
          if (!raw) continue
          if (raw.startsWith('/about/')) out.about.push(raw)
          if (raw.startsWith('#')) out.sameFile.push(raw)
        }
        return out
      })
      check(
        'LW-01 前提: 使い方ページから他の説明ページへのリンクを掴めている',
        lwHandover.about.length > 0,
        `本数=${lwHandover.about.length}`,
      )
      check(
        'LW-01 説明ページどうしのリンクが帰り先を引き継いでいる',
        lwHandover.about.length > 0 &&
          lwHandover.about.every((h) => h.includes(`from=${encodeURIComponent(LW_FROM)}`)),
        `引き継いでいない=${JSON.stringify(lwHandover.about.filter((h) => !h.includes('from=')).slice(0, 5))}`,
      )
      check(
        'LW-01 同じページ内の目印（#…）は書き替えない（その場で飛ぶ動きを壊さない）',
        lwHandover.sameFile.length > 0 && lwHandover.sameFile.every((h) => !h.includes('from=')),
        `目印=${lwHandover.sameFile.length}本`,
      )
      // 進んだ先でも帰り先は同じ（行き先はパスで見る＝文言は掴まない）
      await lwPage.locator('a[href^="/about/unlock.html"]').first().click()
      await lwPage.waitForLoadState('networkidle')
      const lwDeepHref = await lwPage.locator('#appReturn').getAttribute('href').catch(() => null)
      check(
        'LW-01 説明ページを1歩進んでも、帰り先は元の画面のまま',
        lwPage.url().split('?')[0].endsWith('/about/unlock.html') && lwDeepHref === `/#${LW_FROM}`,
        `いる場所=${lwPage.url().split('?')[0]} 帰り先=${lwDeepHref}`,
      )

      // (a) 実際に押して、アプリの元の画面に着くこと
      await lwPage.goto(`${BASE}/about/manual.html${lwQuery}#backup`, { waitUntil: 'networkidle' })
      await lwPage.locator('#appReturn').click()
      await lwPage.waitForLoadState('networkidle')
      await lwPage.waitForTimeout(1500)
      check(
        'LW-01 帰り道を押すと、アプリの元の画面に着く',
        lwPage.url().includes(`/#${LW_FROM}`),
        `着いた先=${lwPage.url()}`,
      )
      check(
        'LW-01 着いた先がアプリの中（静的ページのままではない）',
        (await lwPage.locator('[data-testid="setting-timer-sound"]').count()) === 1,
        `title=${await lwPage.title()}`,
      )

      // --- LW-01(2) タイマー音の説明が390pxで3行以内 ---
      // 便LSが幅を256→324pxに広げてもなお4行だった（根っこは文の長さ）。
      // 字数ではなく**描かれた高さ÷行の高さ**で数える（折り返しは字数では決まらない）
      const lwDesc = lwPage.locator('[data-testid="setting-timer-sound"] p').first()
      const lwLines = await lwDesc.evaluate((el) => {
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight)
        const rect = el.getBoundingClientRect()
        return { lines: Math.round(rect.height / lineHeight), width: rect.width, lineHeight }
      })
      check(
        'LW-01 タイマー音の説明が390pxで3行以内',
        lwLines.lines <= 3 && lwLines.lineHeight > 0,
        `${lwLines.lines}行（折り返し幅=${lwLines.width}px・行の高さ=${lwLines.lineHeight}px）`,
      )
      // 短くするために事実を落としていないこと（文言は ja.ts から読む＝書き写さない）
      const lwDescText = (await lwDesc.innerText()).replace(/​/g, '')
      check(
        'LW-01 短くしても、タイマーごとの消音と振動の2つが画面に残っている',
        lwDescText === ja.settings.timerSoundDescription.replace(/​/g, ''),
        `画面=${lwDescText}`,
      )

      // --- LW-01(3) 解錠済みのPro版の説明から、設定へ帰れる（2026-08-28 司令部の裁定） ---
      // ここは解錠済みの側の枝で、解錠コードの入力欄が無い。守るものが無いまま別窓の例外に
      // なっていたので同じ窓へそろえた。同じ窓にした以上、帰り道が無いと
      // オーナーが報告した行き止まりそのものになるので、押して帰れるところまで測る。
      await lwPage.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const store = () => idb.transaction('settings', 'readwrite').objectStore('settings')
        const cur = (await P(store().get(1))) || { id: 1 }
        await P(store().put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        idb.close()
      })
      // 生のIndexedDBへ書いた変更はDexieの購読に伝わらないので、必ず読み込み直してから見る
      await lwPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await lwPage.reload({ waitUntil: 'networkidle' })
      await lwPage.waitForTimeout(1500)
      const lwProLink = lwPage.locator('[data-testid="pro-detail-link-activated"]')
      const lwProHref = (await lwProLink.count()) === 1 ? await lwProLink.getAttribute('href') : null
      const lwProTarget = (await lwProLink.count()) === 1 ? await lwProLink.getAttribute('target') : 'なし'
      check(
        'LW-01 解錠済みのPro版の説明が同じ窓で開く（別窓に戻っていない）',
        (await lwProLink.count()) === 1 && lwProTarget === null,
        `件数=${await lwProLink.count()} target=${lwProTarget}`,
      )
      check(
        // 行き先はパスと見出しの目印で見る（文言も href の完全一致も使わない）
        'LW-01 解錠済みのPro版の説明が、行き先と帰り先の両方を持っている',
        typeof lwProHref === 'string' &&
          lwProHref.split('?')[0] === '/about/manual.html' &&
          lwProHref.endsWith('#pro') &&
          lwProHref.includes(`from=${encodeURIComponent('/settings?section=pro')}`),
        String(lwProHref),
      )
      // 押した場所の縦位置を控えてから移る（帰ってきたときに同じ場所へ着いたかを測るため）
      const lwProBefore = await lwProLink.boundingBox()
      await lwProLink.click()
      await lwPage.waitForLoadState('networkidle')
      check(
        'LW-01 押すと同じ窓で使い方ページへ移る（別窓が開くのではない）',
        lwPage.url().split('?')[0].endsWith('/about/manual.html') &&
          (await lwPage.locator('#appReturn').count()) === 1,
        `いる場所=${lwPage.url().split('?')[0]}`,
      )
      await lwPage.locator('#appReturn').click()
      await lwPage.waitForLoadState('networkidle')
      await lwPage.waitForTimeout(1500)
      const lwProAfter = await lwPage
        .locator('[data-testid="pro-detail-link-activated"]')
        .boundingBox()
        .catch(() => null)
      const lwProSection = await lwPage.locator('#pro-section').boundingBox().catch(() => null)
      // 実測（390px・解錠済み）で帰り着いたときのPro版の枠の上端:
      //   ?section=pro=69px ／ ?section=なし=5,599px ／ ?section=about=-755px。
      // 「枠の頭が画面の中にある」で見るので、行き先を取り違えるとどちらの向きでも落ちる
      check(
        'LW-01 帰り道を押すと、押した場所（設定のPro版の枠）に戻る',
        lwPage.url().includes('/#/settings?section=pro') &&
          lwProAfter !== null &&
          lwProSection !== null &&
          // 枠の頭が画面の中に入っている＝設定の先頭に着いて自分で探し直す形になっていない
          lwProSection.y > -1 &&
          lwProSection.y < 844,
        `url=${lwPage.url()} 枠の上端=${lwProSection?.y ?? 'なし'}px 押した場所=${
          lwProBefore ? Math.round(lwProBefore.y) : 'なし'
        }px`,
      )
    } finally {
      await lwBrowser.close()
    }
  }
