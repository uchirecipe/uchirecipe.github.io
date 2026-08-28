// ==========================================================================================
// 便MA（2026-08-28）: オーナーが実機で見つけた「戻る」と「絞り込み」の穴
// この中の節: MABACK-01, MATPL-02, MAPRICE-03
//
// オーナー原文:
//  ①「選んだ期間の栄養など、計算できなかった材料があるレシピ名をタップした後のレシピ詳細から、
//     戻るで同じ画面に戻るようにして。レシピ一覧に飛んでしまう。」
//  ②「テンプレートをこの月に入れる→テンプレートの中身を見る→ここから戻るで週に飛んでしまう。」
//  ③「『合い挽き肉』で絞り込みしても『合いびき肉』が出せなかった。」
//
// 直す前の実測（2026-08-28・BASE_URL=http://localhost:4530）:
//  ①月タブ→期間で絞る→選んだ期間の栄養→計算できなかった料理の名前→詳細→戻る で
//    **/#/recipes**（レシピ一覧）へ着地。名前のリンクが出所（location.state）を1つも
//    載せていなかった（便LVが直した「寄り道で出所が落ちる」とは別の原因）
//  ②月タブ→テンプレートの窓→「テンプレートの内容を見る・直す」→戻る で、
//    押されているタブが**「週」**（帰り先が週と書き切ってあった）
//  ③213件のマスタに対し「合い挽き肉」は**0件**（「合いびき肉」は1件）
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 曜日・月替わりの前提は置かない（今日1日だけを相手にする）。掴むのは data-testid と
// ja.ts から組み立てた読み上げ名だけで、並び順・押す回数・置き場所には依らない（禁じ手②③④）。
// 生のIndexedDBへ書いたあとは必ず読み込み直す（禁じ手⑥）。
// ==========================================================================================
import './_shared.mjs'

  // ==========================================================================================
  // MABACK-01 栄養の「計算できなかった料理」から開いた詳細の「戻る」が、押した画面へ帰る
  // ==========================================================================================
  currentCheck = 'MABACK-01'
  {
    const maBrowser = await chromium.launch()
    try {
      const maCtx = await maBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const maPage = await maCtx.newPage()
      maPage.on('dialog', (d) => void d.accept())
      maPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MABACK-01] ${err.message}`)
      })
      /** 初回の案内が出ていたら閉じる（出ない版でも素通りする＝押す回数を決め打ちしない） */
      const maDismissNotice = async () => {
        for (const label of [ja.firstSetupNotice.dismissButton, ja.homeScreenNotice.dismissButton]) {
          const btn = maPage.getByRole('button', { name: label })
          if ((await btn.count()) > 0) {
            await btn.first().click()
            await maPage.waitForTimeout(400)
          }
        }
      }
      /** いま押されているタブの名前（日/週/月）。押し方ではなく aria の状態で読む */
      const maActiveTab = async () => {
        for (const label of [ja.mealPlan.viewDay, ja.mealPlan.viewWeek, ja.mealPlan.viewMonth]) {
          const btn = maPage.getByRole('button', { name: label, exact: true }).first()
          if ((await btn.count()) === 0) continue
          if ((await btn.getAttribute('aria-pressed')) === 'true') return label
        }
        return '(どれも押されていない)'
      }

      // 成分データを持たない材料を使う品を仕込む（JPGAP-02 と同じ作り方）
      const MA_OK = 'MAぜんぶ計算できる品'
      const MA_PARTIAL = 'MA一部が計算できない品'
      const MA_EXCLUDED = 'MA何も計算できない品'
      await maPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await maPage.waitForTimeout(2400) // 初回シード完了待ち
      const maSeed = await maPage.evaluate(async (titles) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const cur = (await P(idb.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({
          ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now(),
        }))
        const mk = (title, ingredients) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps: [{ text: '作る' }],
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false,
          createdAt: Date.now(), updatedAt: Date.now(),
        })
        const rice = { name: '米', amount: '150', unit: 'g' }
        const unknown = { name: 'うちレシピ架空調味料', amount: '100', unit: 'g' }
        const add = (v) => P(idb.transaction('recipes', 'readwrite').objectStore('recipes').add(v))
        const ok = await add(mk(titles.ok, [rice]))
        const partial = await add(mk(titles.partial, [rice, unknown]))
        const excluded = await add(mk(titles.excluded, [unknown]))
        // 今日だけを相手にする＝曜日にも月替わりにも依らない
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        await P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').clear())
        const put = (v) => P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').add(v))
        await put({ date, slot: 'dinner', recipeId: ok, role: 'main' })
        await put({ date, slot: 'dinner', recipeId: partial, role: 'side' })
        await put({ date, slot: 'lunch', recipeId: excluded, role: 'main' })
        idb.close()
        return { ok, partial, excluded, date }
      }, { ok: MA_OK, partial: MA_PARTIAL, excluded: MA_EXCLUDED })

      // 生のIndexedDBへ書いたので必ず読み込み直す（CLAUDE.md 禁じ手⑥）
      await maPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await maPage.reload({ waitUntil: 'networkidle' })
      await maPage.waitForTimeout(2000)
      await maDismissNotice()

      // --- ① 月タブ →「期間で絞る」→「選んだ期間の栄養」---
      await maPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).first().click()
      await maPage.waitForTimeout(1400)
      await maPage.getByRole('button', { name: ja.mealPlan.rangeCostToggle }).first().click()
      await maPage.waitForTimeout(500)
      await maPage.locator('[data-testid="range-date-start"]').fill(maSeed.date)
      await maPage.waitForTimeout(300)
      await maPage.locator('[data-testid="range-date-end"]').fill(maSeed.date)
      await maPage.waitForTimeout(1400)
      check(
        'MABACK-01 前提: 期間で絞ると「選んだ期間の栄養」のカードが出る',
        (await maPage.locator('[data-testid="range-result-card"]').count()) === 1,
        `カード=${await maPage.locator('[data-testid="range-result-card"]').count()}件`,
      )
      const maNutToggle = maPage.locator('[data-testid="month-nutrition-toggle"]')
      if ((await maNutToggle.count()) > 0) {
        await maNutToggle.first().click()
        await maPage.waitForTimeout(900)
      }
      const maGap = maPage.locator('[data-testid="nutrition-gap-dish"]')
      const maGapNames = (await maGap.allTextContents()).map((t) => stripZwspText(t).trim())
      check(
        'MABACK-01 前提: 計算できなかった料理の名前が並んでいる',
        maGapNames.includes(MA_PARTIAL),
        `出ている名前=${JSON.stringify(maGapNames)}`,
      )
      const maTarget = maGap.filter({ hasText: MA_PARTIAL }).first()
      if ((await maTarget.count()) > 0) {
        await maTarget.click()
        await maPage.waitForTimeout(1500)
        check(
          'MABACK-01 名前を押すと、そのレシピの詳細が開く',
          maPage.url().includes(`/recipes/${maSeed.partial}`),
          `URL=${maPage.url()}`,
        )
        await maPage.getByRole('button', { name: ja.common.back }).first().click()
        await maPage.waitForTimeout(1800)
        // 行き先はパスで見る（クエリは着いた画面が消すので、文字の完全一致では見ない＝禁じ手②）
        check(
          'MABACK-01 期間の栄養から開いた詳細の「戻る」が、レシピ一覧ではなく献立へ帰る',
          new URL(maPage.url()).hash.startsWith('#/meal-plan'),
          `着いた先=${maPage.url()}`,
        )
        check(
          'MABACK-01 帰った先で押されているタブが「月」（週にも日にも落ちない）',
          (await maActiveTab()) === ja.mealPlan.viewMonth,
          `押されているタブ=${await maActiveTab()}`,
        )
        check(
          'MABACK-01 読んでいた「選んだ期間の栄養」のカードごと帰る',
          (await maPage.locator('[data-testid="range-result-card"]').count()) === 1,
          `カード=${await maPage.locator('[data-testid="range-result-card"]').count()}件`,
        )
      }

      // --- ② 週タブの「週まとめの栄養」からも同じように帰る ---
      await maPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await maPage.reload({ waitUntil: 'networkidle' })
      await maPage.waitForTimeout(1800)
      await maDismissNotice()
      await maPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await maPage.waitForTimeout(1600)
      await openWeekGroup(maPage, ja.mealPlan.weekGroupNutritionTitle)
      await maPage.waitForTimeout(600)
      const maWeekToggle = maPage.getByRole('button', { name: ja.nutritionBalance.weekToggleExpand })
      if ((await maWeekToggle.count()) > 0) {
        await maWeekToggle.first().click()
        await maPage.waitForTimeout(900)
      }
      const maWeekGap = maPage.locator('[data-testid="nutrition-gap-dish"]').filter({ hasText: MA_EXCLUDED }).first()
      check(
        'MABACK-01 前提: 週まとめの栄養にも計算できなかった料理の名前が出る',
        (await maWeekGap.count()) > 0,
        `名前=${await maWeekGap.count()}件`,
      )
      if ((await maWeekGap.count()) > 0) {
        await maWeekGap.click()
        await maPage.waitForTimeout(1500)
        await maPage.getByRole('button', { name: ja.common.back }).first().click()
        await maPage.waitForTimeout(1800)
        check(
          'MABACK-01 週まとめの栄養から開いた詳細の「戻る」も、献立へ帰る',
          new URL(maPage.url()).hash.startsWith('#/meal-plan'),
          `着いた先=${maPage.url()}`,
        )
        check(
          'MABACK-01 帰った先で押されているタブが「週」',
          (await maActiveTab()) === ja.mealPlan.viewWeek,
          `押されているタブ=${await maActiveTab()}`,
        )
      }

      // --- ③ 出所の無い詳細（レシピ一覧から開いたもの）は、今までどおりレシピ一覧へ戻る ---
      //     ＝別の画面の出所を勝手に名乗らない
      await maPage.goto(`${BASE}/#/recipes/${maSeed.partial}`, { waitUntil: 'networkidle' })
      await maPage.waitForTimeout(1400)
      await maPage.getByRole('button', { name: ja.common.back }).first().click()
      await maPage.waitForTimeout(1500)
      check(
        'MABACK-01 献立を通らずに開いた詳細の「戻る」は、今までどおりレシピ一覧へ行く',
        new URL(maPage.url()).hash.startsWith('#/recipes') &&
          !new URL(maPage.url()).hash.startsWith('#/recipes/'),
        `着いた先=${maPage.url()}`,
      )
    } finally {
      await maBrowser.close()
    }
  }

  // ==========================================================================================
  // MATPL-02 テンプレートの内容の画面の「戻る」が、開いたタブへ帰る（月から入ったら月へ）
  // ==========================================================================================
  currentCheck = 'MATPL-02'
  {
    const mtBrowser = await chromium.launch()
    try {
      const mtCtx = await mtBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const mtPage = await mtCtx.newPage()
      mtPage.on('dialog', (d) => void d.accept())
      mtPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MATPL-02] ${err.message}`)
      })
      const mtDismissNotice = async () => {
        for (const label of [ja.firstSetupNotice.dismissButton, ja.homeScreenNotice.dismissButton]) {
          const btn = mtPage.getByRole('button', { name: label })
          if ((await btn.count()) > 0) {
            await btn.first().click()
            await mtPage.waitForTimeout(400)
          }
        }
      }
      const mtActiveTab = async () => {
        for (const label of [ja.mealPlan.viewDay, ja.mealPlan.viewWeek, ja.mealPlan.viewMonth]) {
          const btn = mtPage.getByRole('button', { name: label, exact: true }).first()
          if ((await btn.count()) === 0) continue
          if ((await btn.getAttribute('aria-pressed')) === 'true') return label
        }
        return '(どれも押されていない)'
      }

      await mtPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mtPage.waitForTimeout(2400)
      await mtPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const cur = (await P(idb.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({
          ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now(),
        }))
        const all = await P(idb.transaction('recipes').objectStore('recipes').getAll())
        const ids = all.slice(0, 3).map((r) => r.id)
        await P(idb.transaction('mealTemplates', 'readwrite').objectStore('mealTemplates').clear())
        await P(idb.transaction('mealTemplates', 'readwrite').objectStore('mealTemplates').add({
          name: 'MAテンプレート',
          items: ids.map((recipeId, i) => ({ dow: i, slot: 'dinner', role: 'main', recipeId })),
          createdAt: Date.now(),
        }))
        idb.close()
      })
      // 生のIndexedDBへ書いたので必ず読み込み直す（禁じ手⑥）
      await mtPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mtPage.reload({ waitUntil: 'networkidle' })
      await mtPage.waitForTimeout(2000)
      await mtDismissNotice()

      // --- 月タブ →「テンプレートをこの月に入れる」の窓 →「内容を見る・直す」→ 戻る ---
      await mtPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).first().click()
      await mtPage.waitForTimeout(1400)
      // 献立を入れる操作の節が畳んでいたら開く（既定がどちらでも同じ場所に着く）
      const mtGroup = mtPage.locator('[data-testid="month-plan-group-toggle"]')
      if ((await mtGroup.count()) > 0 && (await mtGroup.first().getAttribute('aria-expanded')) === 'false') {
        await mtGroup.first().click()
        await mtPage.waitForTimeout(600)
      }
      const mtApply = mtPage.locator('[data-testid="month-template-apply"]')
      check(
        'MATPL-02 前提: 月タブにテンプレートを入れるボタンがある',
        (await mtApply.count()) === 1,
        `${await mtApply.count()}件`,
      )
      if ((await mtApply.count()) > 0) {
        await mtApply.first().click()
        await mtPage.waitForTimeout(900)
        const mtLink = mtPage.getByRole('link', { name: ja.mealPlan.templateManageLink })
        check(
          'MATPL-02 前提: 窓の中に「テンプレートの内容を見る・直す」がある',
          (await mtLink.count()) > 0,
          `${await mtLink.count()}件`,
        )
        await mtLink.last().click()
        await mtPage.waitForTimeout(1500)
        check(
          'MATPL-02 前提: テンプレートの内容の画面が開く',
          new URL(mtPage.url()).hash.startsWith('#/meal-templates'),
          `URL=${mtPage.url()}`,
        )
        await mtPage.getByRole('button', { name: ja.common.back }).first().click()
        await mtPage.waitForTimeout(1800)
        check(
          'MATPL-02 月から開いたテンプレートの内容の画面の「戻る」が、献立へ帰る',
          new URL(mtPage.url()).hash.startsWith('#/meal-plan'),
          `着いた先=${mtPage.url()}`,
        )
        check(
          'MATPL-02 月から入ったら「月」へ帰る（週へ飛ばない）',
          (await mtActiveTab()) === ja.mealPlan.viewMonth,
          `押されているタブ=${await mtActiveTab()}`,
        )
      }

      // --- 週タブから開いたときは、今までどおり「週」へ帰る ---
      await mtPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mtPage.reload({ waitUntil: 'networkidle' })
      await mtPage.waitForTimeout(1800)
      await mtDismissNotice()
      await mtPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await mtPage.waitForTimeout(1600)
      await openWeekGroup(mtPage, ja.mealPlan.weekGroupTemplateTitle)
      await mtPage.waitForTimeout(600)
      const mtWeekLink = mtPage.getByRole('link', { name: ja.mealPlan.templateManageLink })
      check(
        'MATPL-02 前提: 週タブにも「テンプレートの内容を見る・直す」がある',
        (await mtWeekLink.count()) > 0,
        `${await mtWeekLink.count()}件`,
      )
      if ((await mtWeekLink.count()) > 0) {
        await mtWeekLink.first().click()
        await mtPage.waitForTimeout(1500)
        await mtPage.getByRole('button', { name: ja.common.back }).first().click()
        await mtPage.waitForTimeout(1800)
        check(
          'MATPL-02 週から入ったら「週」へ帰る（今までどおり）',
          new URL(mtPage.url()).hash.startsWith('#/meal-plan') &&
            (await mtActiveTab()) === ja.mealPlan.viewWeek,
          `着いた先=${mtPage.url()} 押されているタブ=${await mtActiveTab()}`,
        )
      }
    } finally {
      await mtBrowser.close()
    }
  }

  // ==========================================================================================
  // MAPRICE-03 「食材と価格」の絞り込みが、同じ肉の書き分け（合い挽き肉／合いびき肉）に当たる
  // ==========================================================================================
  currentCheck = 'MAPRICE-03'
  {
    const mpBrowser = await chromium.launch()
    try {
      const mpCtx = await mpBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const mpPage = await mpCtx.newPage()
      mpPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MAPRICE-03] ${err.message}`)
      })
      await mpPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await mpPage.waitForTimeout(2400) // 価格マスタの投入待ち

      // 行の名前は「{name}の価格（円）」の読み上げ名から読む（画面の字を書き写さない）
      const mpAriaSuffix = ja.priceMaster.entryPriceAria.split('{name}')[1]
      const mpShownNames = async () =>
        mpPage
          .locator(`input[aria-label$="${mpAriaSuffix}"]`)
          .evaluateAll(
            (els, suffix) =>
              els.map((el) => (el.getAttribute('aria-label') ?? '').slice(0, -suffix.length)),
            mpAriaSuffix,
          )
      const mpSearch = mpPage.getByLabel(ja.priceMaster.searchLabel)
      check('MAPRICE-03 前提: 絞り込みの欄がある', (await mpSearch.count()) > 0, `${await mpSearch.count()}件`)
      const mpAll = await mpShownNames()
      check(
        'MAPRICE-03 前提: 価格マスタの行が並んでいる',
        mpAll.length > 100,
        `${mpAll.length}件`,
      )
      // オーナーが打った書き方（送り仮名あり）で、マスタの書き方（送り仮名なし）が出る
      await mpSearch.first().fill('合い挽き肉')
      await mpPage.waitForTimeout(700)
      const mpHit = await mpShownNames()
      check(
        'MAPRICE-03 「合い挽き肉」で絞り込むと「合いびき肉」が出る',
        mpHit.includes('合いびき肉'),
        `出た行=${JSON.stringify(mpHit)}`,
      )
      check(
        'MAPRICE-03 関係ない食材まで出さない（当たるのは同じ肉の1件だけ）',
        mpHit.length === 1,
        `出た行=${JSON.stringify(mpHit)}`,
      )
      // もとの書き方でも今までどおり出る（片方だけ当たる形にしない）
      await mpSearch.first().fill('合いびき肉')
      await mpPage.waitForTimeout(700)
      const mpHit2 = await mpShownNames()
      check(
        'MAPRICE-03 「合いびき肉」でも今までどおり出る',
        mpHit2.length === 1 && mpHit2.includes('合いびき肉'),
        `出た行=${JSON.stringify(mpHit2)}`,
      )
    } finally {
      await mpBrowser.close()
    }
  }
