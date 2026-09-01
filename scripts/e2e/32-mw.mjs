// ==========================================================================================
// 便MW（2026-09-01・オーナー裁定★2）: 人数分の「数え方」（人分/個分）
// この中の節: MWUNIT-01, MWUNIT-02, MWUNIT-03
//
// オーナー裁定（原文）「単位は、食数を個数にした場合には、栄養も1個で表示。例えば、
// シフォンケーキ1個の栄養が一人分で表記されていても、なん等分したのかによって変わってしまうため
// 数値を出しようがない。シュークリームなども8個のレシピから1個分の栄養が表示される分には問題ない」
//
// 測ること:
//  MWUNIT-01 個の品を作る→「食数の設定=3人」でも詳細が**8個分**で開く（司令部裁定1）→
//            原価「1個あたり」・栄養「（1個あたり）」「1個分」「全量（8個分）」（Pro解錠して表まで見る）
//  MWUNIT-02 共有テキストの2行目が「8個分」→**そのまま貼り付けて往復**（司令部裁定2）:
//            個数8・数え方=個分・未確認の印なし、で戻る
//  MWUNIT-03 バックアップの書き出しJSONに servingsUnit が入り、上書き読み込みで往復しても
//            詳細が「8個分」のまま
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 曜日・月替わりの前提は置かない。文言は必ず ja.ts から組み立てる（禁じ手②）。
// 押す回数は決め打ちしない（＋は「8個分」と表示されるまで押す上限つきのループ・禁じ手③）。
// ==========================================================================================
import './_shared.mjs'

  currentCheck = 'MWUNIT-01'
  {
    const mwBrowser = await chromium.launch()
    try {
      const mwCtx = await mwBrowser.newContext({ viewport: { width: 390, height: 844 } })
      await mwCtx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
      const mwPage = await mwCtx.newPage()
      mwPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      mwPage.on('dialog', (dialog) => dialog.accept())
      await mwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)

      // 前提づくり: 「食数の設定=3人」（裁定1の再現条件）と Pro 解錠（栄養の表を見るため）。
      // 生のIndexedDBへ書くので、必ず読み込み直す（Dexieのライブ購読は生書き込みを見ていない）
      await mwPage.evaluate(async () => {
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
            const putReq = store.put({
              ...current,
              id: 1,
              householdServings: 3,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await mwPage.reload({ waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(800)

      // --- 個の品を登録フォームで作る ---
      await mwPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(600)
      await mwPage.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eシュークリーム')
      // 数え方の2択が人数分の欄のそばに出ている（既定は「人分」が選ばれている）
      const mwPicker = mwPage.locator('[data-testid="servings-unit-picker"]')
      check('MWUNIT-01 数え方の2択（人分/個分）が出る', (await mwPicker.count()) === 1)
      const mwPersonBtn = mwPicker.getByRole('button', { name: ja.form.servingsUnit, exact: true })
      const mwPieceBtn = mwPicker.getByRole('button', { name: ja.form.servingsUnitPiece, exact: true })
      check(
        'MWUNIT-01 既定は「人分」が選ばれている',
        (await mwPersonBtn.getAttribute('aria-pressed')) === 'true' &&
          (await mwPieceBtn.getAttribute('aria-pressed')) === 'false',
      )
      await mwPieceBtn.click()
      await mwPage.waitForTimeout(200)
      check('MWUNIT-01 「個分」を押すと選びが移る', (await mwPieceBtn.getAttribute('aria-pressed')) === 'true')
      const mwFormBody = stripZwspText((await mwPage.textContent('body')) ?? '')
      check('MWUNIT-01 欄の名前が「個数」に変わる', mwFormBody.includes(ja.form.servingsLabelPiece))
      // ＋を「8個分」と表示されるまで押す（回数は決め打ちしない・上限は保険）
      const mwUpBtn = mwPage.locator(`button[aria-label="${ja.detail.servingsUpPiece}"]`)
      check('MWUNIT-01 ＋の読み上げ名も「個数を増やす」', (await mwUpBtn.count()) === 1)
      for (let i = 0; i < 12; i++) {
        const now = stripZwspText((await mwPage.textContent('body')) ?? '')
        if (now.includes(`8${ja.form.servingsUnitPiece}`)) break
        await mwUpBtn.click()
        await mwPage.waitForTimeout(100)
      }
      check(
        'MWUNIT-01 フォームの表示が「8個分」',
        stripZwspText((await mwPage.textContent('body')) ?? '').includes(`8${ja.form.servingsUnitPiece}`),
      )
      // 材料と手順（卵は価格マスタ・成分表の両方にあるので、原価と栄養が必ず数字になる）
      await mwPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('卵')
      await mwPage.getByPlaceholder(ja.form.ingredientAmountPlaceholder, { exact: true }).first().fill('4')
      await mwPage.getByPlaceholder(ja.form.ingredientUnitPlaceholder, { exact: true }).first().fill('個')
      await mwPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('生地を絞って焼く')
      await mwPage.getByRole('button', { name: ja.form.save }).click()
      await mwPage.waitForTimeout(800)
      check('MWUNIT-01 保存後にレシピ詳細へ遷移する', mwPage.url().includes('#/recipes/'))

      // --- 詳細: 食数の設定=3人でも「8個分」で開く（司令部裁定1・材料が3/8に化けない） ---
      const mwDetailBody = stripZwspText((await mwPage.textContent('body')) ?? '')
      check(
        'MWUNIT-01 詳細が「8個分」で開く（食数の設定=3人を流用しない）',
        mwDetailBody.includes(`8${ja.detail.servingsUnitPiece}`),
      )
      check(
        'MWUNIT-01 「3個分」で開いていない',
        !mwDetailBody.includes(`3${ja.detail.servingsUnitPiece}`),
      )
      check(
        'MWUNIT-01 ステッパーの読み上げ名が「個数を増やす/減らす」',
        (await mwPage.locator(`button[aria-label="${ja.detail.servingsUpPiece}"]`).count()) === 1 &&
          (await mwPage.locator(`button[aria-label="${ja.detail.servingsDownPiece}"]`).count()) === 1,
      )
      // 原価: 「1個あたり 約◯円」と言い、「1食あたり」とは言わない
      check(
        'MWUNIT-01 原価は「1個あたり 約◯円」',
        jaRe(ja.detail.pricePerServingPiece, { n: '[\\d,]+' }).test(mwDetailBody),
      )
      check(
        'MWUNIT-01 この品に「1食あたり」の言い方が出ない',
        !jaRe(ja.detail.pricePerServing, { n: '[\\d,]+' }).test(mwDetailBody),
      )
      // 栄養: 折りたたみの1行が「（1個あたり）: 」
      check(
        'MWUNIT-01 栄養の要約が「（1個あたり）」',
        mwDetailBody.includes(ja.nutrition.summaryLabelPiece),
      )
      // 開くと表の見出しが「1個分」「全量（8個分）」（Pro解錠済みなので8項目の表が出る）
      await mwPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
      await mwPage.waitForTimeout(400)
      const mwNutBody = stripZwspText((await mwPage.textContent('body')) ?? '')
      check('MWUNIT-01 表の1列目が「1個分」', mwNutBody.includes(ja.nutrition.recipeServingHeaderPiece))
      check(
        'MWUNIT-01 表の2列目が「全量（8個分）」',
        mwNutBody.includes(ja.nutrition.totalHeaderPiece.replace('{n}', '8')),
      )
      await mwPage.getByRole('button', { name: ja.nutrition.toggleCollapse }).click()
      await mwPage.waitForTimeout(200)

      // ==========================================================================================
      // MWUNIT-02 共有→貼り付けの往復（司令部裁定2: 「8個分」と書き、貼り付け側が読み戻す）
      // ==========================================================================================
      currentCheck = 'MWUNIT-02'
      await mwPage.locator(`button[aria-label="${ja.share.button}"]`).click()
      await mwPage.waitForTimeout(300)
      const mwShareDialog = mwPage.getByRole('dialog', { name: ja.share.dialogTitle })
      check('MWUNIT-02 シェアの窓が開く', (await mwShareDialog.count()) === 1)
      const mwDialogText = stripZwspText((await mwShareDialog.textContent()) ?? '')
      check(
        'MWUNIT-02 「いま表示している8個分の分量で〜」と言う',
        mwDialogText.includes(ja.share.servingsNotePiece.replace('{n}', '8')),
      )
      check(
        'MWUNIT-02 栄養の選択肢も「1個あたりの〜」（Pro解錠済みなので塩分入りの名前）',
        mwDialogText.includes(ja.share.optNutritionPiece),
      )
      await mwShareDialog.getByRole('button', { name: ja.share.textOption }).click()
      await mwPage.waitForTimeout(600)
      const mwCopied = await mwPage.evaluate(() => navigator.clipboard.readText())
      check(
        'MWUNIT-02 共有テキストの2行目が「8個分」',
        mwCopied.includes(`E2Eシュークリーム\n8${ja.detail.servingsUnitPiece}`),
      )
      check('MWUNIT-02 「8人分」とは書かない', !mwCopied.includes(`8${ja.detail.servingsUnit}`))
      await mwShareDialog.locator(`button[aria-label="${ja.common.close}"]`).click()
      await mwPage.waitForTimeout(200)

      // 貼り付けで往復: 新しいフォームに貼ると、個数8・数え方=個分・未確認の印なし、で戻る
      await mwPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(600)
      await mwPage.getByText(ja.paste.open).click()
      await mwPage.waitForTimeout(300)
      await mwPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(mwCopied)
      await mwPage.getByRole('button', { name: ja.paste.apply }).click()
      await mwPage.waitForTimeout(500)
      const mwPasteBody = stripZwspText((await mwPage.textContent('body')) ?? '')
      check(
        'MWUNIT-02 貼り付け後のフォームが「8個分」',
        mwPasteBody.includes(`8${ja.form.servingsUnitPiece}`),
      )
      const mwPastePicker = mwPage.locator('[data-testid="servings-unit-picker"]')
      check(
        'MWUNIT-02 数え方が「個分」で戻る',
        (await mwPastePicker
          .getByRole('button', { name: ja.form.servingsUnitPiece, exact: true })
          .getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MWUNIT-02 「人数分を読み取れなかった」の印は出ない（読めているので）',
        (await mwPage.locator('[data-testid="servings-not-read"]').count()) === 0,
      )
      // 出る場面と対にする（LO-1）: 個数を消した文章を貼り直すと、印が**出る**。
      // そのとき数え方は動かさない（読めなかったのに単位だけ人へ戻さない）。
      // 貼り付けの欄は1回目の取り込みのあと開いたままのことがある＝**開いていなければ開く**
      // （押す回数を決め打ちしない・禁じ手③）
      const mwPasteArea = mwPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
      if (!(await mwPasteArea.isVisible().catch(() => false))) {
        await mwPage.getByText(ja.paste.open).click()
        await mwPage.waitForTimeout(300)
      }
      await mwPasteArea.fill(mwCopied.replace(`8${ja.detail.servingsUnitPiece}\n`, ''))
      await mwPage.getByRole('button', { name: ja.paste.apply }).click()
      await mwPage.waitForTimeout(500)
      check(
        'MWUNIT-02 個数の無い文章を貼ると印が出る（出る場面との対）',
        (await mwPage.locator('[data-testid="servings-not-read"]').count()) === 1,
      )
      check(
        'MWUNIT-02 読めなかったときは数え方を動かさない（個分のまま・注意も個の言い方）',
        (await mwPage
          .locator('[data-testid="servings-unit-picker"]')
          .getByRole('button', { name: ja.form.servingsUnitPiece, exact: true })
          .getAttribute('aria-pressed')) === 'true' &&
          stripZwspText(
            (await mwPage.locator('[data-testid="servings-not-read"]').textContent()) ?? '',
          ).includes(ja.form.servingsNotReadNotePiece.replace('{n}', '8')),
      )
      // 貼り付けの結果からもう1品はつくらない（往復の確認だけで足りる）。書きかけを捨てて戻る
      await mwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(400)

      // ==========================================================================================
      // MWUNIT-03 バックアップの往復（Omit+spreadの自動持ち回りを実ファイルで確かめる）
      // ==========================================================================================
      currentCheck = 'MWUNIT-03'
      await mwPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await mwPage.waitForTimeout(500)
      await mwPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await mwPage.waitForTimeout(300)
      const [mwDownload] = await Promise.all([
        mwPage.waitForEvent('download'),
        mwPage.getByRole('button', { name: ja.settings.backupExport }).click(),
      ])
      const mwJson = readFileSync(await mwDownload.path(), 'utf-8')
      const mwExported = JSON.parse(mwJson)
      const mwExportedRecipe = (mwExported.recipes ?? []).find((r) => r.title === 'E2Eシュークリーム')
      check(
        'MWUNIT-03 書き出しJSONに servingsUnit=piece が入る',
        mwExportedRecipe?.servingsUnit === 'piece',
        `recipe=${JSON.stringify({ servings: mwExportedRecipe?.servings, servingsUnit: mwExportedRecipe?.servingsUnit })}`,
      )
      check('MWUNIT-03 個数8も入る', mwExportedRecipe?.servings === 8)

      // 上書き読み込みで戻し、詳細が「8個分」のままであること
      const mwChooser = await clickReplaceImport(mwPage)
      await mwChooser.setFiles({
        name: 'mw-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(mwJson, 'utf-8'),
      })
      await mwPage.waitForTimeout(2500)
      await mwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mwPage.reload({ waitUntil: 'networkidle' }) // 生の書き込みではないが、読み直してから掴む
      await mwPage.waitForTimeout(800)
      await mwPage.getByText('E2Eシュークリーム', { exact: true }).first().click()
      await mwPage.waitForTimeout(600)
      const mwRestoredBody = stripZwspText((await mwPage.textContent('body')) ?? '')
      check(
        'MWUNIT-03 読み込み後も詳細が「8個分」で開く',
        mwRestoredBody.includes(`8${ja.detail.servingsUnitPiece}`),
      )
      check(
        'MWUNIT-03 読み込み後も原価は「1個あたり」',
        jaRe(ja.detail.pricePerServingPiece, { n: '[\\d,]+' }).test(mwRestoredBody),
      )
      await mwCtx.close()
    } finally {
      await mwBrowser.close()
    }
  }
