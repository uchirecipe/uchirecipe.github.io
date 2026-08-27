// ==========================================================================================
// 便LU（2026-08-27）: オーナーの書き溜めの片付け
// この中の節: LUBACK-01, LUBACK-02, LUBACK-03, LUSHOP-01, LUPANTRY-01
//
// オーナー原文:
//  ・「各種pro版について見るからの戻り先、献立ならすべて日に戻ってしまう。直前の状態に戻して。
//    折りたたみが閉じてしまう、スクロール場所がズレるのもやめて。」
//  ・「「買い物メモを作る」→「下書きを作成しました」「追加する中身を選択してください」のように
//    案内出して。画面飛んだだけだと一瞬何が起きたのかわからなくなる。
//    あと、下書き画面から直前の画面まで戻ってくる手段がない。」
//  ・「作った！で在庫を減らすのスイッチ、ONOFFするたびにトーストはいらない。
//    スイッチの見た目が変わるので、変更できたことが見えるため。」
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 曜日・月替わりの前提は置かない＝見るのは「離れる前と帰ったあとが同じか」だけにしてある。
// ==========================================================================================
import './_shared.mjs'

  // ==========================================================================================
  // LUBACK-01 献立の月タブ「Pro版について見る」→ 設定 →「献立に戻る」
  //  ①帰り道に「見ていたタブ」が乗っている（?focus=month&restore=1）
  //  ②帰ってきたときに月タブが選ばれている（直す前はいつも日タブだった）
  // ==========================================================================================
  currentCheck = 'LUBACK-01'
  {
    const luBrowser = await chromium.launch()
    try {
      const luCtx = await luBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const luPage = await luCtx.newPage()
      luPage.on('dialog', (d) => void d.accept())
      luPage.on('pageerror', (err) => errors.push(`[pageerror@LU] ${err.message}`))
      await luPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await luPage.waitForTimeout(2200)

      const luTabPressed = (name) =>
        luPage.getByRole('button', { name, exact: true }).first().getAttribute('aria-pressed')

      await luPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).first().click()
      await luPage.waitForTimeout(1500)
      const luGate = luPage.getByRole('link', { name: ja.mealPlan.monthProGateLink }).first()
      await luGate.scrollIntoViewIfNeeded()
      await luPage.waitForTimeout(400)
      const luHref = (await luGate.getAttribute('href')) ?? ''
      check(
        'LUBACK-01 月タブのPro案内が「見ていたタブへ帰る」道を持っている',
        luHref.includes(encodeURIComponent('/meal-plan?focus=month&restore=1')),
        luHref,
      )
      await luGate.click()
      await luPage.waitForTimeout(1200)
      const luBackLabel = ja.backLink.backTo.replace('{page}', ja.backLink.mealPlan)
      const luBackBtn = luPage.getByRole('button', { name: luBackLabel }).first()
      check(
        'LUBACK-01 設定に「献立に戻る」が出る',
        (await luPage.getByRole('button', { name: luBackLabel }).count()) === 1,
        luPage.url(),
      )
      await luBackBtn.click()
      await luPage.waitForTimeout(2500)
      check(
        'LUBACK-01 帰ってきたら月タブのまま（日タブに戻らない）',
        (await luTabPressed(ja.mealPlan.viewMonth)) === 'true' &&
          (await luTabPressed(ja.mealPlan.viewDay)) === 'false',
        `日=${await luTabPressed(ja.mealPlan.viewDay)} 週=${await luTabPressed(
          ja.mealPlan.viewWeek,
        )} 月=${await luTabPressed(ja.mealPlan.viewMonth)}`,
      )

      // ======================================================================================
      // LUBACK-02 レシピ詳細の栄養「Pro版について見る」→ 設定 →「レシピに戻る」
      //  ①折りたたみ（栄養価の概算）が開いたまま帰る
      //  ②縦位置が離れる前と同じ
      // ======================================================================================
      currentCheck = 'LUBACK-02'
      // 初回だけ出る案内（作る人数と台所の器具）が後ろの画面を固定するので、先に見た記録を残す
      await luPage.evaluate(() => localStorage.setItem('uchirecipe:firstSetupNoticeSeen', '1'))
      await luPage.goto(`${BASE}/#/recipes`)
      await luPage.reload({ waitUntil: 'networkidle' })
      await luPage.waitForTimeout(2200)
      await luPage.locator('a[href^="#/recipes/"]').first().click()
      await luPage.waitForTimeout(1800)
      const luDetailUrl = luPage.url()
      await luPage.getByRole('button', { name: ja.nutrition.toggleExpand }).first().click()
      await luPage.waitForTimeout(900)
      const luNutriGate = luPage.getByRole('link', { name: ja.nutrition.gateLink }).first()
      await luNutriGate.scrollIntoViewIfNeeded()
      await luPage.waitForTimeout(500)
      const luYBefore = await luPage.evaluate(() => window.scrollY)
      await luNutriGate.click()
      await luPage.waitForTimeout(1200)
      await luPage
        .getByRole('button', { name: ja.backLink.backTo.replace('{page}', ja.backLink.recipeDetail) })
        .first()
        .click()
      await luPage.waitForTimeout(3000)
      const luYAfter = await luPage.evaluate(() => window.scrollY)
      check(
        'LUBACK-02 帰り着いたのは離れたレシピの詳細',
        luPage.url() === luDetailUrl,
        `${luPage.url()} / ${luDetailUrl}`,
      )
      check(
        'LUBACK-02 栄養価の概算が開いたまま帰る（折りたたみが閉じない）',
        (await luPage.getByRole('button', { name: ja.nutrition.toggleCollapse }).count()) === 1,
        `開=${await luPage.getByRole('button', { name: ja.nutrition.toggleCollapse }).count()}`,
      )
      // 上限は保険（画面の高さの丸めぶんだけ動くことがある）。直す前は必ず0へ戻っていた
      check(
        'LUBACK-02 縦位置が離れる前と同じ（先頭へ戻らない）',
        luYBefore > 200 && Math.abs(luYAfter - luYBefore) <= 40,
        `前=${luYBefore} 後=${luYAfter}`,
      )

      // ======================================================================================
      // LUBACK-03 並行調理ナビの「Pro版について見る」→ 設定 →「並行調理ナビに戻る」
      // ここは鍵の案内だけの短い画面だが、帰り道の作りを他とそろえる（画面ごとに違う形にしない）
      // ======================================================================================
      currentCheck = 'LUBACK-03'
      await luPage.goto(`${BASE}/#/cook-navi`)
      await luPage.waitForTimeout(2000)
      const luNaviGate = luPage.getByRole('link', { name: ja.cookNavi.gateLink }).first()
      const luNaviHref = (await luNaviGate.getAttribute('href')) ?? ''
      check(
        'LUBACK-03 並行調理ナビのPro案内も「覚えた場所へ戻す」印を載せている',
        luNaviHref.includes(encodeURIComponent('/cook-navi?restore=1')),
        luNaviHref,
      )
      await luNaviGate.click()
      await luPage.waitForTimeout(1200)
      await luPage
        .getByRole('button', { name: ja.backLink.backTo.replace('{page}', ja.backLink.cookNavi) })
        .first()
        .click()
      await luPage.waitForTimeout(2200)
      check(
        'LUBACK-03 並行調理ナビへ帰れる',
        luPage.url().includes('#/cook-navi'),
        luPage.url(),
      )

      // ======================================================================================
      // LUSHOP-01 献立の「買い物メモを作る」
      //  ①着いた画面で「何が起きたか」と「次に押すもの」が出る
      //  ②下書きから「献立に戻る」で、見ていた週と縦位置へ帰る
      // ======================================================================================
      currentCheck = 'LUSHOP-01'
      await luPage.goto(`${BASE}/#/meal-plan`)
      await luPage.waitForTimeout(2200)
      await luPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await luPage.waitForTimeout(1200)
      await luPage.getByRole('button', { name: ja.mealPlan.fillWeek }).first().click()
      await luPage.waitForTimeout(3000)
      const luShopBtn = luPage.getByRole('button', { name: ja.mealPlan.goToShopping }).first()
      await luShopBtn.scrollIntoViewIfNeeded()
      await luPage.waitForTimeout(500)
      const luPlanY = await luPage.evaluate(() => window.scrollY)
      await luShopBtn.click()
      await luPage.waitForTimeout(2500)
      const luBody = stripZwspText(await luPage.textContent('body'))
      check(
        'LUSHOP-01 下書きができたことと、次に押すものを画面で知らせる',
        luBody.includes(stripZwspText(ja.shopping.fromMealPlanDraftToast)),
        luBody.slice(0, 240),
      )
      const luDraftBack = luPage.locator('[data-testid="candidate-back"]')
      check(
        'LUSHOP-01 下書きに、作った画面へ帰るボタンがある',
        (await luDraftBack.count()) === 1 &&
          stripZwspText(await luDraftBack.first().innerText()) ===
            ja.backLink.backTo.replace('{page}', ja.backLink.mealPlan),
        `件数=${await luDraftBack.count()}`,
      )
      await luDraftBack.first().click()
      await luPage.waitForTimeout(3000)
      const luPlanYAfter = await luPage.evaluate(() => window.scrollY)
      check(
        'LUSHOP-01 帰ってきたら週タブのまま（日タブに戻らない）',
        (await luTabPressed(ja.mealPlan.viewWeek)) === 'true',
        `日=${await luTabPressed(ja.mealPlan.viewDay)} 週=${await luTabPressed(
          ja.mealPlan.viewWeek,
        )}`,
      )
      check(
        'LUSHOP-01 縦位置も離れる前と同じ',
        luPlanY > 200 && Math.abs(luPlanYAfter - luPlanY) <= 60,
        `前=${luPlanY} 後=${luPlanYAfter}`,
      )

      // ======================================================================================
      // LUPANTRY-01 食材の「作った！」で在庫を減らすスイッチ
      // 押した結果はスイッチの見た目（aria-checked）で分かるので、知らせは出さない
      // ======================================================================================
      currentCheck = 'LUPANTRY-01'
      await luPage.goto(`${BASE}/#/shopping`)
      await luPage.waitForTimeout(2200)
      // 下書きが残っていると「買い物メモ」タブで迎えるので、スイッチのある「食材の在庫」へ移る
      await luPage.getByRole('button', { name: ja.shopping.tabInventory }).first().click()
      await luPage.waitForTimeout(900)
      const luSwitch = luPage.locator('[data-testid="pantry-cooked-reflect-switch"]').first()
      await luSwitch.scrollIntoViewIfNeeded()
      await luPage.waitForTimeout(400)
      const luBefore = await luSwitch.getAttribute('aria-checked')
      await luSwitch.click()
      await luPage.waitForTimeout(1200)
      const luAfter = await luSwitch.getAttribute('aria-checked')
      check(
        'LUPANTRY-01 押すとスイッチの状態が変わる（読み上げにも伝わる aria-checked）',
        luBefore !== luAfter && (await luSwitch.getAttribute('role')) === 'switch',
        `前=${luBefore} 後=${luAfter}`,
      )
      check(
        'LUPANTRY-01 切り替えても知らせ（トースト）を出さない',
        // 知らせの帯は role="status"（components/Toast.tsx）。この画面には他に出るものが無い
        (await luPage.locator('[role="status"]').count()) === 0,
        stripZwspText(await luPage.textContent('body')).slice(0, 200),
      )
      // 戻す側でも同じ（ONのときだけ出す、という作りが残っていないか）
      await luSwitch.click()
      await luPage.waitForTimeout(1200)
      check(
        'LUPANTRY-01 戻すときも知らせを出さない',
        (await luPage.locator('[role="status"]').count()) === 0 &&
          (await luSwitch.getAttribute('aria-checked')) === luBefore,
        `戻り=${await luSwitch.getAttribute('aria-checked')}`,
      )
    } finally {
      await luBrowser.close()
    }
  }
