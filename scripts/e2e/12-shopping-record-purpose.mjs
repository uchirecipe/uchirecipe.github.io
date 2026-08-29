// ==========================================================================================
// e2e の節: 買い物メモ・作った記録・目的モード
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
// この中の節: HU-CLOSE-01, SHOP-COUNT-01, SHOP-COMPLETE-01, SHOP-DRAFT-02, IX-SHOP-01, IX-SHOP-02, IX-PASTE-01, COOKED-REFLECT-01, WORD-CI1-01, LOG-CI2-01, CARRY-01, FAV-CARD-01, SHARE-CANCEL-01, SEARCH-CI3-01, SHARE-SERVINGS-01, PASTE-SERVINGS-01, EDITMISSING-01, PRICEUNDO-01, FOCUSVOICE-01, PURPOSE-01, PURPOSE-02
// ==========================================================================================
import './_shared.mjs'


  // --- HU-CLOSE-01: 並び替え／絞り込みの窓は、窓の外をタップしても閉じる（2026-08-19 便HU・⑰
  //     オーナー「窓の外タップでも閉じるようにして。この場合はややこしくなるので『決定』ボタン削除？」）。
  //     旧「決定」は廃止したので、測るのは**2つの閉じ方で絞り込みの結果が同じ**になること
  //     （＝閉じ方によって条件が変わったり、押していないレシピが開いたりしない）。
  //     件数は画面から読み取り、読めないときは必ず落ちる（0件・全件をそのまま合格にしない）---
  currentCheck = 'HU-CLOSE-01'
  {
    const hcBrowser = await chromium.launch()
    const hcContext = await hcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const hcPage = await hcContext.newPage()
    hcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@HU-CLOSE-01] ${err.message}`)
    })
    try {
      const hcTitles = () =>
        hcPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
      const hcOpenFilter = async () => {
        await hcPage.locator(`button[aria-label="${ja.search.filterToggle}"]`).click()
        await hcPage.waitForTimeout(400)
      }
      const hcPanelVisible = () =>
        hcPage.locator('[data-testid="recipes-filter-panel"]').first().isVisible()
      await hcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await hcPage.waitForTimeout(2000)
      const hcTotal = (await hcTitles()).length
      check('HU-CLOSE-01 前提: 一覧にレシピが出ている', hcTotal > 0, `全件=${hcTotal}`)

      // 旧「決定」は無い（名前が動作と食い違うボタンを残さない）
      await hcOpenFilter()
      check(
        'HU-CLOSE-01(⑰) 絞り込みの窓に「決定」ボタンは無い',
        (await hcPage.getByRole('button', { name: ja.mealPlan.servingsSave, exact: true }).count()) === 0,
      )
      check(
        'HU-CLOSE-01(⑰) 代わりに窓を閉じるボタンがある(何も押せない窓にしない)',
        (await hcPage.locator('[data-testid="filter-panel-close"]').count()) === 1,
      )

      // 条件をかける（0件でも全件でもない状態を作る＝閉じ方の違いが結果に出る余地を残す）
      await hcPage.getByRole('button', { name: '主菜', exact: true }).click()
      await hcPage.waitForTimeout(300)
      await hcPage.locator(`select[aria-label="${ja.search.timeTitle}"]`).selectOption({ label: ja.search.timeUnder30 })
      await hcPage.waitForTimeout(500)
      const hcFilteredInPanel = (await hcTitles()).length
      check(
        'HU-CLOSE-01(⑰) 前提: 条件をかけた結果が0件でも全件でもない',
        hcFilteredInPanel > 0 && hcFilteredInPanel < hcTotal,
        `条件つき=${hcFilteredInPanel} 全件=${hcTotal}`,
      )

      // (a) 「閉じる」ボタンで閉じる
      await hcPage.locator('[data-testid="filter-panel-close"]').click()
      await hcPage.waitForTimeout(500)
      const hcByButton = await hcTitles()
      check('HU-CLOSE-01(⑰) 「閉じる」で窓が閉じる', (await hcPanelVisible()) === false)

      // (b) 同じ条件のまま開き直して、窓の外をタップして閉じる。
      // タップする場所は、窓の外でありながら**その下にレシピのカードがある**点を選ぶ
      // （窓は画面のほとんどを覆うので、左右に残る余白の帯がそれにあたる）。
      // 「窓の外で閉じたつもりが、下のレシピが開いてしまう」が起きないことを、
      // いちばん起こりやすい場所で測るため。点が取れなければ落とす（測れないまま合格にしない）
      await hcOpenFilter()
      check('HU-CLOSE-01(⑰) 前提: 窓が開いている', (await hcPanelVisible()) === true)
      const hcOutsidePoint = await hcPage.evaluate(() => {
        const panel = document.querySelector('[data-testid="recipes-filter-panel"]')
        if (!panel) return null
        const r = panel.getBoundingClientRect()
        const y = Math.round(r.top + r.height / 2)
        // 窓の左右に残る余白の帯（窓は画面のほとんどを覆うので、外はこの帯になる）
        for (const x of [Math.round(r.left / 2), Math.round((r.right + window.innerWidth) / 2)]) {
          if (x < 2 || x > window.innerWidth - 2) continue
          const el = document.elementFromPoint(x, y)
          if (!el || panel.contains(el)) continue
          return { x, y, tag: el.tagName }
        }
        return null
      })
      check(
        'HU-CLOSE-01(⑰) 前提: 窓の外の点を掴めている',
        hcOutsidePoint != null,
        `点=${JSON.stringify(hcOutsidePoint)}`,
      )
      await hcPage.mouse.click(hcOutsidePoint.x, hcOutsidePoint.y)
      await hcPage.waitForTimeout(500)
      const hcByOutside = await hcTitles()
      check('HU-CLOSE-01(⑰) 窓の外のタップで窓が閉じる', (await hcPanelVisible()) === false)
      check(
        'HU-CLOSE-01(⑰) 外タップで閉じたときと「閉じる」で閉じたときで、絞り込みの結果が同じ',
        hcByButton.length === hcFilteredInPanel &&
          hcByOutside.length === hcFilteredInPanel &&
          JSON.stringify(hcByButton) === JSON.stringify(hcByOutside),
        `閉じるボタン=${JSON.stringify(hcByButton)} 外タップ=${JSON.stringify(hcByOutside)}`,
      )
      check(
        'HU-CLOSE-01(⑰) 窓の外のタップで、その下にあるレシピを開いてしまわない',
        !/#\/recipes\/\d+/.test(hcPage.url()),
        `URL=${hcPage.url()}`,
      )

      // 窓の外にある「押せるもの」（下のタブナビ）を押したときも、1回目は窓を閉じるだけで
      // その操作は起きない＝閉じたつもりが別の画面へ飛ばされない
      await hcOpenFilter()
      const hcMealTab = hcPage.getByRole('link', { name: '献立' }).first()
      const hcTabBox = await hcMealTab.boundingBox()
      check(
        'HU-CLOSE-01(⑰) 前提: 下のタブナビの位置を掴めている',
        hcTabBox != null,
        `タブの位置=${JSON.stringify(hcTabBox)}`,
      )
      await hcPage.mouse.click(hcTabBox.x + hcTabBox.width / 2, hcTabBox.y + hcTabBox.height / 2)
      await hcPage.waitForTimeout(500)
      check(
        'HU-CLOSE-01(⑰) 窓の外のタブを押したときも、1回目は窓が閉じるだけで画面は移動しない',
        (await hcPanelVisible()) === false && /#\/recipes/.test(hcPage.url()),
        `URL=${hcPage.url()}`,
      )

      // 窓の中の操作では閉じない（「条件をクリア」のように押すと消えるものを押しても閉じない）
      await hcOpenFilter()
      await hcPage
        .locator('[data-testid="recipes-filter-panel"]')
        .getByRole('button', { name: ja.search.clear })
        .click()
      await hcPage.waitForTimeout(500)
      check(
        'HU-CLOSE-01(⑰) 窓の中の「条件をクリア」を押しても窓は閉じない',
        (await hcPanelVisible()) === true,
      )
      check(
        'HU-CLOSE-01(⑰) 「条件をクリア」で全件に戻る',
        (await hcTitles()).length === hcTotal,
        `クリア後=${(await hcTitles()).length} 全件=${hcTotal}`,
      )
    } finally {
      await hcBrowser.close()
    }
  }

  // --- SHOP-COUNT-01: 買い物メモ「レシピから追加」の食数+/-方式(2026-07-23 #3)と、
  // 「下書きを作る」押下時のトースト(#4/文言は2026-07-24 #14で「候補」→「下書き」に改称)。
  // 食数0では下書きを作るがdisabled、+で1食にすると押せて、押すと下書きセクションとトーストが出る ---
  currentCheck = 'SHOP-COUNT-01'
  {
    const scBrowser = await chromium.launch()
    const scContext = await scBrowser.newContext()
    const scPage = await scContext.newPage()
    scPage.on('dialog', (dialog) => dialog.accept())
    scPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOP-COUNT-01] ${err.message}`)
    })
    try {
      await scPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(1800)
      await scPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(400)
      // 買い物メモタブへ
      await scPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await scPage.waitForTimeout(300)
      // レシピから追加(ピッカー)を開く
      await scPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await scPage.waitForTimeout(400)

      const makeBtn = scPage.getByRole('button', { name: ja.shopping.makeCandidates })
      check('SHOP-COUNT-01 食数0では「下書きを作る」がdisabled', await makeBtn.isDisabled())
      // 最初のレシピの食数を1にする
      await scPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await scPage.waitForTimeout(200)
      check('SHOP-COUNT-01 食数1で「下書きを作る」が押せる(1食以上で選択扱い)', !(await makeBtn.isDisabled()))
      await makeBtn.click()
      await scPage.waitForTimeout(500)
      const afterMake = await scPage.textContent('body')
      check('SHOP-COUNT-01 下書きを作るとトーストが出る(#4)', afterMake.includes('下書きを作りました'))
      check('SHOP-COUNT-01 買い物メモ(下書き)セクションが出る(#14)', afterMake.includes(ja.shopping.candidateTitle))
    } finally {
      await scBrowser.close()
    }
  }

  // --- SHOP-COMPLETE-01: 買い物完了の中央モーダル(2026-07-23 #7)＋在庫反映で未登録食材の
  // チップを作って反映(#8)＋反映トースト(#9)。在庫に無い新食材を手入力→チェック→買い物完了→
  // モーダルで「反映する」を押すと、在庫チップが新規作成され(level=have)トーストが出ることを確認する ---
  currentCheck = 'SHOP-COMPLETE-01'
  {
    const cpBrowser = await chromium.launch()
    const cpContext = await cpBrowser.newContext()
    const cpPage = await cpContext.newPage()
    cpPage.on('dialog', (dialog) => dialog.accept())
    cpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOP-COMPLETE-01] ${err.message}`)
    })
    const readPantry = () =>
      cpPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    try {
      await cpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(1800)
      await cpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(400)
      await cpPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await cpPage.waitForTimeout(300)

      // 在庫に無い新食材を手入力で1件追加
      await cpPage.getByPlaceholder(ja.shopping.manualPlaceholder).fill('E2E新食材ペペロン')
      await cpPage.getByRole('button', { name: '追加', exact: true }).click()
      await cpPage.waitForTimeout(300)
      // チェックを入れる
      await cpPage.getByRole('button', { name: ja.shopping.toggleCheck, exact: true }).click()
      await cpPage.waitForTimeout(200)
      // 買い物完了 → 中央モーダル
      await cpPage.getByRole('button', { name: ja.shopping.complete, exact: true }).click()
      await cpPage.waitForTimeout(300)
      const modalBody = await cpPage.textContent('body')
      check(
        'SHOP-COMPLETE-01 買い物完了で確認モーダルが出る(#7)',
        modalBody.includes(ja.shopping.completeConfirmTitle),
      )
      // 反映する
      await cpPage.getByRole('button', { name: ja.shopping.completeYes, exact: true }).click()
      await cpPage.waitForTimeout(500)
      const afterBody = await cpPage.textContent('body')
      check('SHOP-COMPLETE-01 反映するとトーストが出る(#9)', afterBody.includes('在庫に反映しました'))
      const items = await readPantry()
      const created = items.find((p) => p.name === 'E2E新食材ペペロン')
      check(
        'SHOP-COMPLETE-01 未登録食材のチップが新規作成され「ある」で反映される(#8)',
        !!created && created.level === 'have',
        `created=${JSON.stringify(created)}`,
      )
    } finally {
      await cpBrowser.close()
    }
  }

  // --- SHOP-DRAFT-02: 2026-07-24 実機FB の買い物メモ系。
  //  #11 買い物メモの売り場順(野菜→肉→…)自動整列 / #8 「レシピを選び直す」で直前の選択を保持したまま
  //  ピッカーを開き直す / #10 下書きの食材名タップで「使うレシピ」ポップが出る、を通しで検証する ---
  currentCheck = 'SHOP-DRAFT-02'
  {
    const sdBrowser = await chromium.launch()
    const sdContext = await sdBrowser.newContext()
    const sdPage = await sdContext.newPage()
    sdPage.on('dialog', (dialog) => dialog.accept())
    sdPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOP-DRAFT-02] ${err.message}`)
    })
    try {
      await sdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await sdPage.waitForTimeout(1800)
      await sdPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await sdPage.waitForTimeout(400)
      await sdPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await sdPage.waitForTimeout(300)

      // #11 売り場順: わざと売り場順と違う順(調味料→肉→野菜)で手入力し、表示は野菜→肉→調味料に整うことを確認
      for (const name of ['しょうゆ', '豚バラ肉', '玉ねぎ']) {
        await sdPage.getByPlaceholder(ja.shopping.manualPlaceholder).fill(name)
        await sdPage.getByRole('button', { name: '追加', exact: true }).click()
        await sdPage.waitForTimeout(200)
      }
      const memoSection = sdPage.locator('section', { hasText: '買い物メモ' }).first()
      const memoOrder = await memoSection
        .locator('ul > li')
        .evaluateAll((lis) => lis.map((li) => li.querySelector('span')?.textContent ?? ''))
      check(
        'SHOP-DRAFT-02(#11) 買い物メモが売り場順(野菜→肉→調味料)に自動整列する',
        JSON.stringify(memoOrder) === JSON.stringify(['玉ねぎ', '豚バラ肉', 'しょうゆ']),
        `memoOrder=${JSON.stringify(memoOrder)}`,
      )

      // 下書きを作る(最初のレシピを2食に)
      await sdPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await sdPage.waitForTimeout(400)
      await sdPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await sdPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await sdPage.waitForTimeout(200)
      await sdPage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await sdPage.waitForTimeout(500)
      const draftBody = await sdPage.textContent('body')
      check('SHOP-DRAFT-02 下書きセクションが出て「レシピを選び直す」「キャンセル」が並ぶ(#8)',
        draftBody.includes(ja.shopping.candidateTitle) &&
          (await sdPage.getByRole('button', { name: 'レシピを選び直す' }).isVisible()) &&
          (await sdPage.getByRole('button', { name: 'キャンセル' }).isVisible()))

      // #10 食材名タップで「使うレシピ」ポップ(全文+レシピ名)が出る
      const draftSection = sdPage.locator('section', { hasText: ja.shopping.candidateTitle })
      await draftSection.locator('ul li').first().locator('button').nth(1).click()
      await sdPage.waitForTimeout(250)
      const popup = sdPage.getByRole('dialog')
      check('SHOP-DRAFT-02(#10) 食材名タップで「使うレシピ」ポップが出る',
        (await popup.isVisible()) && (await popup.textContent()).includes('使うレシピ'))
      await sdPage.keyboard.press('Escape')
      await sdPage.waitForTimeout(200)

      // #8 「レシピを選び直す」で直前の選択(2食)を保持したままピッカーが開き直す
      await sdPage.getByRole('button', { name: 'レシピを選び直す' }).click()
      await sdPage.waitForTimeout(300)
      const repickBody = await sdPage.textContent('body')
      check('SHOP-DRAFT-02(#8) 選び直しで直前の選択(2食)が保持されピッカーが開く',
        repickBody.includes('2食') &&
          !(await sdPage.getByRole('button', { name: ja.shopping.makeCandidates }).isDisabled()))
    } finally {
      await sdBrowser.close()
    }
  }

  // --- IX-SHOP-01: 買い物メモに「お湯」が並ぶ(2026-08-22 便IX)。
  //   オーナーが実際のレシピサイトから取り込んだ31品で発覚した。クラシル「エビグラタン」は
  //   マカロニをゆでるための「お湯 1000ml」まで材料に入っており、買い物メモの下書きに
  //   「お湯」の行が並んでいた(店で買うものではない)。
  //
  //   測るのは利用者が確かめたいこと3つ。どれも「どこに出ているか」ではなく
  //   **画面のどこかに出ているか**で判定する(並びが変わっても同じ判定になる形):
  //     ①下書きに「お湯」が出ない ②同じレシピの他の材料(ゆで塩も含む)は出る
  //     ③レシピの材料一覧には「お湯 1000ml」が残っている(作るときに要る情報なので消さない)
  //   料理名は同梱レシピに左右されないよう、この検証の中で登録して作る(「お湯」を含まない名前にする) ---
  currentCheck = 'IX-SHOP-01'
  {
    const ixBrowser = await chromium.launch()
    try {
      const ixContext = await ixBrowser.newContext()
      const ixPage = await ixContext.newPage()
      ixPage.on('dialog', (dialog) => dialog.accept())
      ixPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IX-SHOP-01] ${err.message}`)
      })
      const ixTitle = 'IX検証グラタン'
      await ixPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ixPage.waitForTimeout(1800)
      const ixId = await ixPage.evaluate(async (title) => {
        const db = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        // クラシル「エビグラタン」の材料の並びそのまま(ゆでる湯と、ゆで塩が先頭に入る形)
        const id = await P(store('recipes').add({
          title, servings: 2, effortLevel: 'normal', tags: [], isFavorite: false,
          cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
          ingredients: [
            { name: 'マカロニ', amount: '60', unit: 'g' },
            { name: 'お湯', amount: '1000', unit: 'ml' },
            { name: '塩', amount: '2', unit: '小さじ' },
            { name: 'エビ', amount: '5', unit: '尾' },
          ],
          steps: [{ text: 'マカロニをゆでる。', minutes: 5 }, { text: 'オーブンで焼く。' }],
        }))
        db.close()
        return id
      }, ixTitle)

      // ③ 先にレシピの材料一覧を見ておく(買い物メモ側で落としても、レシピからは消えないこと)
      await ixPage.goto(`${BASE}/#/recipes/${ixId}`)
      await ixPage.reload({ waitUntil: 'networkidle' })
      await ixPage.waitForTimeout(900)
      const ixDetail = (await ixPage.textContent('body')).replace(/​/g, '')
      check(
        'IX-SHOP-01 ③レシピの材料一覧には「お湯 1000ml」が残る(作るときに要る情報)',
        ixDetail.includes('お湯') && ixDetail.includes('1000'),
        `detailHasOyu=${ixDetail.includes('お湯')} detailHas1000=${ixDetail.includes('1000')}`,
      )

      await ixPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await ixPage.waitForTimeout(600)
      await ixPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await ixPage.waitForTimeout(300)
      await ixPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await ixPage.waitForTimeout(400)
      // 同梱レシピを巻き込まないよう、この検証で登録した1品だけに絞ってから食数を1にする
      await ixPage.getByPlaceholder(ja.search.placeholder).fill(ixTitle)
      await ixPage.waitForTimeout(400)
      await ixPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await ixPage.waitForTimeout(200)
      await ixPage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await ixPage.waitForTimeout(600)

      const ixDraft = (await ixPage.textContent('body')).replace(/​/g, '')
      check(
        'IX-SHOP-01 ①買い物メモの下書きに「お湯」が出ない',
        ixDraft.includes(ja.shopping.candidateTitle) && !ixDraft.includes('お湯'),
        `draftShown=${ixDraft.includes(ja.shopping.candidateTitle)} hasOyu=${ixDraft.includes('お湯')}`,
      )
      check(
        'IX-SHOP-01 ②同じレシピの他の材料は出る(ゆで塩も落とさない)',
        ['マカロニ', 'エビ', '塩'].every((n) => ixDraft.includes(n)),
        `draftMissing=${JSON.stringify(['マカロニ', 'エビ', '塩'].filter((n) => !ixDraft.includes(n)))}`,
      )

      // 確定して買い物メモに入れたあとも「お湯」は無い(下書きだけの話にしない)
      await ixPage.getByRole('button', { name: ja.shopping.addConfirmed }).click()
      await ixPage.waitForTimeout(600)
      const ixMemo = (await ixPage.textContent('body')).replace(/​/g, '')
      check(
        'IX-SHOP-01 ①確定して買い物メモに入れても「お湯」の行は無い',
        !ixMemo.includes('お湯') && ixMemo.includes('マカロニ'),
        `memoHasOyu=${ixMemo.includes('お湯')} memoHasMacaroni=${ixMemo.includes('マカロニ')}`,
      )
    } finally {
      await ixBrowser.close()
    }
  }

  // --- IX-SHOP-02: 材料が0件のレシピを買い物メモに入れようとしたとき(2026-08-22 便IX)。
  //   オーナーのテスト用データにある手書きの「冷蔵庫のあまりもの炒め」(材料0件・手順3件)が、
  //   買い物メモで壊れないこと・不自然な空行を出さないこと・**理由に合った説明が出ること**を見る。
  //   実測(便IX)では壊れも空行も無かったが、説明だけが「食材の在庫で『ある』に登録済みのようです」
  //   ＝材料を1件も登録していないレシピでは事実と違う文になっていた ---
  currentCheck = 'IX-SHOP-02'
  {
    const izBrowser = await chromium.launch()
    try {
      const izPage = await (await izBrowser.newContext()).newPage()
      izPage.on('dialog', (dialog) => dialog.accept())
      izPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IX-SHOP-02] ${err.message}`)
      })
      const izTitle = 'IX材料ゼロ炒め'
      await izPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await izPage.waitForTimeout(1800)
      await izPage.evaluate(async (title) => {
        const db = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        await P(db.transaction('recipes', 'readwrite').objectStore('recipes').add({
          title, servings: 2, effortLevel: 'normal', tags: [], isFavorite: false,
          cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
          ingredients: [],
          steps: [
            { text: '冷蔵庫に残っている野菜と肉を食べやすく切る' },
            { text: 'フライパンに油を熱し、火の通りにくいものから炒める', minutes: 5 },
            { text: '塩・こしょうで味を調える' },
          ],
        }))
        db.close()
      }, izTitle)

      await izPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await izPage.reload({ waitUntil: 'networkidle' })
      await izPage.waitForTimeout(800)
      await izPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await izPage.waitForTimeout(300)
      await izPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await izPage.waitForTimeout(400)
      await izPage.getByPlaceholder(ja.search.placeholder).fill(izTitle)
      await izPage.waitForTimeout(400)
      await izPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await izPage.waitForTimeout(200)
      await izPage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await izPage.waitForTimeout(700)

      const izDraft = izPage.locator('section').filter({ hasText: ja.shopping.candidateTitle }).last()
      check(
        'IX-SHOP-02 下書きの枠は出る(押しても何も起きない、にならない)',
        await izDraft.isVisible(),
      )
      // 空行を出していないこと＝行(li)が1つも無いこと。0件なのに枠だけの行を作らない
      check(
        'IX-SHOP-02 材料0件でも空の行を作らない',
        (await izDraft.locator('ul > li').count()) === 0,
        `行数=${await izDraft.locator('ul > li').count()}`,
      )
      // 何も入れられないのに「買い物メモに追加」を押せる状態にしない
      check(
        'IX-SHOP-02 入れるものが無いので「買い物メモに追加」は出さない',
        (await izPage.getByRole('button', { name: ja.shopping.addConfirmed }).count()) === 0,
      )
      const izText = (await izDraft.textContent()).replace(/​/g, '')
      check(
        'IX-SHOP-02 理由に合った説明が出る(材料が無いことを言う)',
        izText.includes(ja.shopping.candidateEmptyNoIngredients),
        `text=${izText.slice(-80)}`,
      )
      check(
        'IX-SHOP-02 事実と違う説明(在庫にある)は出さない',
        !izText.includes(ja.shopping.candidateEmpty),
        `text=${izText.slice(-80)}`,
      )
    } finally {
      await izBrowser.close()
    }
  }

  // --- IX-PASTE-01: 文章から取り込むと宣伝・見出しが材料に入る(2026-08-22 便IX)。
  //   cotta「基本のシュークリームのレシピ」を文章から取り込んだ実データで、材料21件のうち
  //   「おすすめのアイテム」(宣伝の見出し)・「cotta 北海道産薄力粉 シュクレ 2.5kg」(その下に並ぶ売り物)・
  //   「下準備」(節の見出し)が材料の行として保存され、買い物メモにもそのまま並んでいた。
  //   下の文章は元ページ https://www.cotta.jp/special/article/?p=64082 の材料まわりの実測。
  //   判定は**フォームの入力欄に何が入ったか**で見る(貼り付けた原文は画面に残るので、
  //   画面全体の文字で見ると素通り合格になる) ---
  currentCheck = 'IX-PASTE-01'
  {
    const ipBrowser = await chromium.launch()
    try {
      const ipPage = await (await ipBrowser.newContext()).newPage()
      ipPage.on('dialog', (dialog) => dialog.accept())
      ipPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IX-PASTE-01] ${err.message}`)
      })
      await ipPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ipPage.waitForTimeout(1500)
      await ipPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ipPage.waitForTimeout(500)
      const ipBox = ipPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
      if (!(await ipBox.isVisible().catch(() => false))) {
        await ipPage.getByText(ja.paste.open).click()
        await ipPage.waitForTimeout(400)
      }
      await ipBox.fill(
        [
          'IX貼り付けテスト',
          '',
          '材料',
          '',
          '牛乳…45g',
          '薄力粉…55g',
          '',
          'おすすめのアイテム',
          '',
          'cotta 北海道産薄力粉 シュクレ 2.5kg',
          '',
          '下準備',
          '',
          '薄力粉をふるっておく。',
          '',
          '作り方',
          '',
          '鍋に牛乳を入れて温める。',
        ].join('\n'),
      )
      await ipPage.getByRole('button', { name: ja.paste.apply }).click()
      await ipPage.waitForTimeout(500)
      const ipRead = (await ipPage.textContent('body')).replace(/​/g, '')
      check(
        'IX-PASTE-01 読み取り結果は材料2件・手順2件(宣伝2行と節の見出しは材料に数えない)',
        ipRead.includes(
          ja.paste.resultSummary.split('。')[0].replace('{i}', '2').replace('{s}', '2'),
        ),
        ipRead.match(jaRe(ja.paste.resultSummary.split('。')[0], { i: '\\d+', s: '\\d+' }))?.[0] ??
          '(読み取り結果の行が無い)',
      )
      // 入力欄に何が入ったかで見る(並び順・行の位置には依らない)
      const ipValues = await ipPage.evaluate(() =>
        [...document.querySelectorAll('input')].map((el) => el.value).filter(Boolean),
      )
      check(
        'IX-PASTE-01 宣伝の見出し・売り物・節の見出しが材料の行にならない',
        !ipValues.some((v) => ['おすすめのアイテム', '下準備'].includes(v)) &&
          !ipValues.some((v) => v.includes('cotta 北海道産薄力粉')),
        `values=${JSON.stringify(ipValues)}`,
      )
      check(
        'IX-PASTE-01 正しい材料(牛乳・薄力粉)は巻き込まれず両方残る',
        ipValues.includes('牛乳') && ipValues.includes('薄力粉'),
        `values=${JSON.stringify(ipValues)}`,
      )
    } finally {
      await ipBrowser.close()
    }
  }

  // --- COOKED-REFLECT-01: 「作った！」の在庫反映スイッチ(2026-07-23 #11)。既定OFF・選択を記憶。
  // 在庫「玉ねぎ」を「ある」にしておき、玉ねぎを使う肉じゃがで作った!記録時にスイッチONで保存すると、
  // 使った食材の在庫が1段階下がる(ある→少ない)こと、スイッチ状態がsettingsに記憶されることを確認する ---
  currentCheck = 'COOKED-REFLECT-01'
  {
    const crBrowser = await chromium.launch()
    const crContext = await crBrowser.newContext()
    const crPage = await crContext.newPage()
    crPage.on('dialog', (dialog) => dialog.accept())
    crPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@COOKED-REFLECT-01] ${err.message}`)
    })
    const readPantry = () =>
      crPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    const readReflectSetting = () =>
      crPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const s = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return s
      })
    try {
      await crPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(1800)
      // 在庫「玉ねぎ」を1回タップして「ない」→「ある」にする
      await crPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(400)
      await crPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await crPage.waitForTimeout(250)
      const beforeItems = await readPantry()
      check(
        'COOKED-REFLECT-01 前提: 玉ねぎを「ある」にできた',
        beforeItems.find((p) => p.name === '玉ねぎ')?.level === 'have',
        `玉ねぎ=${JSON.stringify(beforeItems.find((p) => p.name === '玉ねぎ'))}`,
      )
      // 肉じゃがの詳細を開く
      await crPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(500)
      await crPage.getByText('肉じゃが', { exact: true }).first().click()
      await crPage.waitForTimeout(500)
      // 作った!モーダルを開き、在庫反映スイッチをONにする
      await crPage.getByRole('button', { name: '作った！' }).first().click()
      await crPage.waitForTimeout(300)
      await crPage.getByRole('switch', { name: ja.detail.cookedReflectPantryLabel }).click()
      await crPage.waitForTimeout(300)
      const setting = await readReflectSetting()
      check(
        'COOKED-REFLECT-01 スイッチONがsettingsに記憶される(cookedReflectPantry=true)',
        setting?.cookedReflectPantry === true,
        `settings=${JSON.stringify({ cookedReflectPantry: setting?.cookedReflectPantry })}`,
      )
      // 記録する → 使った玉ねぎの在庫が1段階下がる(ある→少ない)
      await crPage.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await crPage.waitForTimeout(700)
      const afterItems = await readPantry()
      check(
        'COOKED-REFLECT-01 記録すると玉ねぎの在庫が1段階下がる(ある→少ない)',
        afterItems.find((p) => p.name === '玉ねぎ')?.level === 'low',
        `玉ねぎ=${JSON.stringify(afterItems.find((p) => p.name === '玉ねぎ'))}`,
      )
    } finally {
      await crBrowser.close()
    }
  }
  // --- WORD-CI1-01(2026-07-29 便CI 第1波・文言): B4診断の文言4件の再発防止。
  // C13 並び替え「よく使う順」が何を数えた順かの説明 /
  // C20 絞り込みで0件になったとき、その場で条件を外せる導線 /
  // C06 在庫スイッチの説明が「ある→少ない→ない」の3段階で閉じている /
  // C01 レシピ削除の確認文が消えるもの(作った記録・写真・献立の予定)と残るものを件数つきで書く(規約F) ---
  currentCheck = 'WORD-CI1-01'
  {
    const w1Browser = await chromium.launch()
    const w1Context = await w1Browser.newContext()
    const w1Page = await w1Context.newPage()
    w1Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WORD-CI1-01] ${err.message}`)
    })
    // 削除の確認文を読むだけで実際には消さない(dismiss)。同じ端末データを後続の検証で使うため
    const w1Dialogs = []
    await collectConfirms(w1Page, w1Dialogs)
    try {
      await w1Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await w1Page.waitForTimeout(1800) // 初回シード完了待ち
      // 確認の窓は「やめる」で閉じる＝文言だけ読んで、端末のデータは後続の検証のために残す
      await setConfirmAnswer(w1Page, 'cancel')

      // C13: 並び替えパネルに「よく使う順」の意味が書かれている
      await w1Page.locator(`button[aria-label="${ja.search.sortToggle}"]`).click()
      await w1Page.waitForTimeout(300)
      const sortPanelText = await w1Page.textContent('body')
      check(
        'WORD-CI1-01/C13 並び替えパネルに「よく使う順」が何を数えた順かの説明が出る',
        sortPanelText.includes(ja.search.sortCookedHint),
      )
      await w1Page.locator('[data-testid="sort-panel-close"]').click()
      await w1Page.waitForTimeout(300)

      // C20: お気に入り0件の状態で「お気に入り」絞り込みをONにして0件にする
      await w1Page.locator(`button[aria-label="${ja.search.filterToggle}"]`).click()
      await w1Page.waitForTimeout(300)
      await w1Page.getByRole('button', { name: 'お気に入り', exact: true }).click()
      await w1Page.waitForTimeout(300)
      await w1Page.locator('[data-testid="filter-panel-close"]').click()
      await w1Page.waitForTimeout(400)
      const emptyText = await w1Page.textContent('body')
      check(
        'WORD-CI1-01/C20 絞り込みで0件のとき「＋から登録」ではなく条件を外す案内が出る',
        emptyText.includes('条件に合うレシピが見つかりません') &&
          emptyText.includes(ja.search.noResultFilteredHint) &&
          !emptyText.includes(ja.search.noResultHint),
        emptyText.slice(0, 400),
      )
      const clearBtn = w1Page.getByRole('button', { name: ja.search.clear })
      check(
        'WORD-CI1-01/C20 絞り込みパネルを開かなくても「条件をクリア」が押せる',
        (await clearBtn.count()) === 1 && (await clearBtn.first().isVisible()),
        `count=${await clearBtn.count()}`,
      )
      await clearBtn.first().click()
      await w1Page.waitForTimeout(500)
      check(
        'WORD-CI1-01/C20 「条件をクリア」でレシピが戻る',
        (await w1Page.locator('a[href^="#/recipes/"]').count()) > 0,
      )

      // C06: 記録モーダルの在庫スイッチの説明が3段階で閉じている
      await w1Page.getByText('肉じゃが', { exact: true }).first().click()
      await w1Page.waitForTimeout(600)
      await w1Page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await w1Page.waitForTimeout(400)
      const logDialogText =
        (await w1Page.getByRole('dialog', { name: ja.detail.cookedDialogTitle }).textContent()) ?? ''
      check(
        'WORD-CI1-01/C06 在庫スイッチの説明が「ある→少ない→ない」の3段階で閉じている',
        logDialogText.includes(ja.detail.cookedReflectPantryHint) &&
          !logDialogText.includes('在庫を1段階下げます'),
        logDialogText,
      )

      // C01: 記録を2件つけてから削除の確認文を読む(実行はしない)
      await w1Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await w1Page.waitForTimeout(600)
      await w1Page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await w1Page.waitForTimeout(400)
      await w1Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await w1Page.waitForTimeout(600)
      await w1Page.locator('a[href*="/edit"]').first().click()
      await w1Page.waitForTimeout(600)
      await w1Page.getByRole('button', { name: ja.form.deleteRecipe }).click()
      await w1Page.waitForTimeout(500)
      const delMessage = w1Dialogs[w1Dialogs.length - 1] ?? ''
      check(
        'WORD-CI1-01/C01 削除の確認文に作った記録の件数(写真枚数つき)が入る(規約F)',
        /作った記録2件（うち写真0枚）/.test(delMessage),
        delMessage,
      )
      // 2026-08-16 便GZ: 記録はレシピを消しても残るので「残るもの」側に書く。
      // 言い回しではなく「記録の件数がどちらの項目に載っているか」で測る
      check(
        'WORD-CI1-01/C01 削除の確認文は作った記録を「残るもの」に書く(便GZ)',
        // 見出しの位置で範囲を切る（窓の文字を取り出すと改行が消えるため。2026-08-16）
        (() => {
          const removed = delMessage.slice(
            delMessage.indexOf('消えるもの'),
            delMessage.indexOf('残るもの'),
          )
          const kept = delMessage.slice(delMessage.indexOf('残るもの'))
          return kept.includes('作った記録2件') && !removed.includes('作った記録')
        })(),
        delMessage,
      )
      check(
        'WORD-CI1-01/C01 削除の確認文に献立の予定・今日の献立も消えることが書かれている',
        delMessage.includes('献立の予定') && delMessage.includes('今日の献立'),
        delMessage,
      )
      check(
        'WORD-CI1-01/C01 削除の確認文に「何が残るか」も書かれている(「よろしいですか？」だけにしない)',
        // 言い回しを固定しない（2026-08-15 便GWで確認の窓を揃えたとき「〜は残ります」から
        // 「残るもの:」の見出しに変わって落ちた。CLAUDE.md 禁じ手②）。
        // 測るのは「何が残るかを書いていること」と「よろしいですか？で終わっていないこと」
        /残るもの|残ります|残りません/.test(delMessage) && !delMessage.includes('よろしいですか'),
        delMessage,
      )
    } finally {
      await w1Browser.close()
    }
  }
  // --- LOG-CI2-01(2026-07-29 便CI 第2波・記録の連鎖): C05 記録した人数の可視化と編集 /
  // C19 「やめる」でメモが残らない / C08 記録が日付の新しい順に保たれる /
  // C03 直近5件で打ち切られた記録の続きへ行ける / C04 履歴に写真サムネが出る /
  // C02 作った記録を1件だけ削除できる(確認文は規約F) ---
  currentCheck = 'LOG-CI2-01'
  {
    const tinyPng2 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const l2Browser = await chromium.launch()
    const l2Context = await l2Browser.newContext()
    const l2Page = await l2Context.newPage()
    l2Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-CI2-01] ${err.message}`)
    })
    const l2Dialogs = []
    await collectConfirms(l2Page, l2Dialogs)
    const openLogModal = async () => {
      await l2Page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await l2Page.waitForTimeout(400)
    }
    const readLogs = (id) =>
      l2Page.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const getReq = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
              getReq.onsuccess = () => {
                const logs = getReq.result?.cookedLogs ?? []
                resolve(
                  logs.map((l) => ({
                    date: l.date,
                    servings: l.servings ?? null,
                    hasPhoto: l.photo instanceof Blob,
                  })),
                )
              }
              getReq.onerror = () => reject(getReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        id,
      )
    try {
      await l2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await l2Page.waitForTimeout(2000) // 初回シード完了待ち
      await l2Page.getByText('肉じゃが', { exact: true }).first().click()
      await l2Page.waitForTimeout(600)
      const recipeId = Number(l2Page.url().match(/#\/recipes\/(\d+)/)?.[1])
      const shownServings = Number(
        ((await l2Page.locator('span.min-w-14').first().textContent()) ?? '').match(/\d+/)?.[0],
      )

      // --- C05: 記録窓に「何人分作った？」が出て、その場で直せる ---
      await openLogModal()
      const logDialog = l2Page.getByRole('dialog', { name: ja.detail.cookedDialogTitle })
      const logDialogText = (await logDialog.textContent()) ?? ''
      check(
        'LOG-CI2-01/C05 記録窓に「何人分作った？」の欄が出る',
        logDialogText.includes('何人分作った？'),
        logDialogText,
      )
      check(
        'LOG-CI2-01/C05 記録した人数が何に使われるかも書かれている(実績食費の分母)',
        logDialogText.includes('作った記録の食費'),
        logDialogText,
      )
      check(
        'LOG-CI2-01/C05 初期値は詳細画面の表示人数',
        ((await logDialog.locator('span.min-w-14').textContent()) ?? '').includes(String(shownServings)),
        await logDialog.locator('span.min-w-14').textContent(),
      )
      await logDialog.getByRole('button', { name: ja.detail.servingsUp }).click()
      await l2Page.waitForTimeout(200)
      await logDialog
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'h.png', mimeType: 'image/png', buffer: tinyPng2 })
      await l2Page.waitForTimeout(600)
      await l2Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await l2Page.waitForTimeout(700)
      const afterFirst = await readLogs(recipeId)
      check(
        'LOG-CI2-01/C05 記録窓で直した人数がそのまま保存される',
        afterFirst[0]?.servings === shownServings + 1,
        JSON.stringify(afterFirst),
      )
      check(
        'LOG-CI2-01/C05 記録一覧にも「◯人分」が出る',
        (await l2Page.textContent('body')).includes(`${shownServings + 1}人分`),
      )

      // --- C19: メモを書いて「やめる」→ 次に開いたときメモが残っていない ---
      await openLogModal()
      await logDialog.locator('input[type="text"]').first().fill('やめるテストのメモ')
      await l2Page.waitForTimeout(200)
      await logDialog.getByRole('button', { name: ja.common.confirmCancel }).click()
      await l2Page.waitForTimeout(400)
      await openLogModal()
      check(
        'LOG-CI2-01/C19 「やめる」で捨てたメモが次の記録に持ち越されない',
        (await logDialog.locator('input[type="text"]').first().inputValue()) === '',
        await logDialog.locator('input[type="text"]').first().inputValue(),
      )
      // --- C08: 過去の日付を後から記録しても、記録は日付の新しい順に保たれる ---
      await logDialog.locator('input[type="date"]').fill('2026-06-01')
      await l2Page.waitForTimeout(200)
      await l2Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await l2Page.waitForTimeout(700)
      const afterPast = await readLogs(recipeId)
      const sortedDates = [...afterPast.map((l) => l.date)].sort((a, b) => b.localeCompare(a))
      check(
        'LOG-CI2-01/C08 過去日を後から記録しても保存順は日付の新しい順のまま',
        JSON.stringify(afterPast.map((l) => l.date)) === JSON.stringify(sortedDates),
        JSON.stringify(afterPast.map((l) => l.date)),
      )

      // --- C03: 記録が5件を超えたら「すべて見る（他◯件）」で続きに行ける ---
      for (let i = 0; i < 4; i++) {
        await openLogModal()
        await l2Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
        await l2Page.waitForTimeout(600)
      }
      const seeAll = l2Page.getByRole('link', { name: jaRe(ja.detail.cookedLogsSeeAll, { n: '\\d+' }) })
      check('LOG-CI2-01/C03 記録が6件以上あると「すべて見る（他◯件）」が出る', (await seeAll.count()) === 1)
      check(
        'LOG-CI2-01/C03 「他◯件」の件数が「総数−表示中の5件」になっている',
        ((await seeAll.textContent()) ?? '').includes(`他${(await readLogs(recipeId)).length - 5}件`),
        await seeAll.textContent(),
      )
      await seeAll.click()
      await l2Page.waitForTimeout(800)
      check(
        'LOG-CI2-01/C03 履歴ページがこのレシピの記録だけに絞られる',
        (l2Page.url().split('#')[1] ?? '').startsWith(`/history?recipe=${recipeId}`),
        l2Page.url(),
      )
      const historyText = await l2Page.textContent('body')
      const totalLogs = (await readLogs(recipeId)).length
      check(
        'LOG-CI2-01/C03 絞り込み中であることと、外し方が画面に出る',
        historyText.includes('「肉じゃが」の記録だけを表示しています') &&
          historyText.includes('すべての記録を見る'),
        historyText.slice(0, 300),
      )
      check(
        'LOG-CI2-01/C03 履歴に件数が出る(全◯件)',
        historyText.includes(`全${totalLogs}件`),
        historyText.slice(0, 300),
      )
      check(
        'LOG-CI2-01/C04 履歴の行に写真サムネイルが出る(記録写真→レシピ写真の順)',
        (await l2Page.locator('ul li img').count()) >= 1,
        `img=${await l2Page.locator('ul li img').count()}`,
      )
      check(
        'LOG-CI2-01/C05 履歴の行にも記録した人数が出る',
        historyText.includes(`${shownServings + 1}人分`),
      )
      await l2Page.getByRole('link', { name: ja.history.filteredClear }).click()
      await l2Page.waitForTimeout(600)
      check(
        'LOG-CI2-01/C03 「すべての記録を見る」で絞り込みが外れる',
        !(await l2Page.textContent('body')).includes(
        ja.history.filteredBy.replace('「{title}」', ''),
      ),
      )

      // --- C02: 作った記録を1件だけ削除できる。確認文は規約F ---
      await l2Page.goto(`${BASE}/#/recipes/${recipeId}`, { waitUntil: 'networkidle' })
      await l2Page.waitForTimeout(700)
      const beforeDelete = (await readLogs(recipeId)).length
      await l2Page.locator(`button[aria-label="${ja.detail.cookedLogEdit}"]`).first().click()
      await l2Page.waitForTimeout(400)
      const deleteLogBtn = l2Page.getByRole('button', { name: 'この記録を削除' })
      check('LOG-CI2-01/C02 記録の編集行に「この記録を削除」が出る', (await deleteLogBtn.count()) === 1)
      // まず確認文だけ読む(キャンセル=消えないこと)
      await setConfirmAnswer(l2Page, 'cancel')
      await deleteLogBtn.click()
      await l2Page.waitForTimeout(500)
      const delLogMessage = l2Dialogs[l2Dialogs.length - 1] ?? ''
      check(
        'LOG-CI2-01/C02 削除の確認文に、消える記録の日付と残る記録の件数が入る(規約F)',
        jaRe(ja.detail.cookedLogDeleteConfirmTitle, { date: '\\d{4}/\\d{2}/\\d{2}' }).test(
          delLogMessage,
        ) &&
          delLogMessage.includes(`他の作った記録${beforeDelete - 1}件は残ります`),
        delLogMessage,
      )
      check(
        'LOG-CI2-01/C02 確認文に「元に戻せません」と、レシピ本体は残ることが書かれている',
        delLogMessage.includes('元に戻せません') && delLogMessage.includes('レシピ本体'),
        delLogMessage,
      )
      check(
        'LOG-CI2-01/C02 キャンセルすると記録は消えない',
        (await readLogs(recipeId)).length === beforeDelete,
      )
      await setConfirmAnswer(l2Page, 'accept')
      await deleteLogBtn.click()
      await l2Page.waitForTimeout(800)
      check(
        'LOG-CI2-01/C02 承諾すると作った記録が1件だけ減る(レシピは残る)',
        (await readLogs(recipeId)).length === beforeDelete - 1 &&
          (await l2Page.textContent('body')).includes('肉じゃが'),
        `残り=${(await readLogs(recipeId)).length}`,
      )
      check(
        'LOG-CI2-01/C02 削除したことがトーストで分かる',
        stripZwspText(await l2Page.textContent('body')).includes(ja.detail.cookedLogDeletedToast),
      )

      // --- C05: 記録の編集フォームからも人数を直せる ---
      const beforeEditServings = (await readLogs(recipeId))[0]?.servings
      await l2Page.locator(`button[aria-label="${ja.detail.cookedLogEdit}"]`).first().click()
      await l2Page.waitForTimeout(400)
      const editRow = l2Page.locator('li', { hasText: ja.detail.cookedServings }).last()
      check(
        'LOG-CI2-01/C05 記録の編集フォームにも人数の欄があり、記録済みの値で開く',
        ((await editRow.locator('span.min-w-12').textContent()) ?? '').includes(
          String(beforeEditServings),
        ),
        await editRow.locator('span.min-w-12').textContent(),
      )
      await editRow.getByRole('button', { name: ja.detail.servingsUp }).click()
      await l2Page.waitForTimeout(200)
      await l2Page.getByRole('button', { name: '保存する', exact: true }).click()
      await l2Page.waitForTimeout(700)
      const afterEdit = await readLogs(recipeId)
      check(
        'LOG-CI2-01/C05 記録の編集フォームで直した人数が保存される',
        afterEdit[0]?.servings === beforeEditServings + 1,
        `編集前=${beforeEditServings} 編集後=${afterEdit[0]?.servings}`,
      )
    } finally {
      await l2Browser.close()
    }
  }

  // --- CARRY-01(2026-07-29 便CI/C07): レシピ内リンク(だし汁→だしのとり方)で移動したとき、
  // 前のレシピの表示人数と記録メモの下書きが持ち越されないこと。持ち越すと材料が誤スケールし、
  // 誤った人数が黙って記録される(献立の実績食費の分母になる) ---
  currentCheck = 'CARRY-01'
  {
    const cyBrowser = await chromium.launch()
    const cyContext = await cyBrowser.newContext()
    const cyPage = await cyContext.newPage()
    cyPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@CARRY-01] ${err.message}`)
    })
    try {
      await cyPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cyPage.waitForTimeout(2200)
      await cyPage.locator('input[type="search"]').fill('だし巻き卵')
      await cyPage.waitForTimeout(500)
      await cyPage.getByText('だし巻き卵', { exact: true }).first().click()
      await cyPage.waitForTimeout(700)
      // 人数を4回増やして6人分にし、記録メモの下書きも残す
      for (let i = 0; i < 4; i++) {
        await cyPage.locator(`button[aria-label="${ja.detail.servingsUp}"]`).first().click()
        await cyPage.waitForTimeout(120)
      }
      const beforeMove = await cyPage.locator('span.min-w-14').first().textContent()
      await cyPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await cyPage.waitForTimeout(400)
      const carryDialog = cyPage.getByRole('dialog', { name: ja.detail.cookedDialogTitle })
      await carryDialog.locator('input[type="text"]').first().fill('だし巻き卵用のメモ')
      await carryDialog.getByRole('button', { name: ja.common.confirmCancel }).click()
      await cyPage.waitForTimeout(400)

      await cyPage.getByRole('link', { name: ja.detail.dashiRecipeLink }).first().click()
      await cyPage.waitForTimeout(800)
      const afterMove = await cyPage.locator('span.min-w-14').first().textContent()
      check(
        'CARRY-01/C07 レシピ内リンクで移動すると表示人数が移動先の登録人数に戻る(前の6人分が残らない)',
        (beforeMove ?? '').includes('6') && !(afterMove ?? '').includes('6'),
        `移動前=${beforeMove} 移動後=${afterMove}`,
      )
      await cyPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await cyPage.waitForTimeout(400)
      check(
        'CARRY-01/C07 前のレシピの記録メモの下書きが移動先にプリフィルされない',
        (await carryDialog.locator('input[type="text"]').first().inputValue()) === '',
        await carryDialog.locator('input[type="text"]').first().inputValue(),
      )
    } finally {
      await cyBrowser.close()
    }
  }

  // --- FAV-CARD-01(2026-07-29 便CI/C15): レシピ一覧のカードのハートで、詳細を開かずに
  // お気に入りを付け外しできること(カードのタップ=詳細へ、は壊さない) ---
  currentCheck = 'FAV-CARD-01'
  {
    const fcBrowser = await chromium.launch()
    const fcContext = await fcBrowser.newContext()
    const fcPage = await fcContext.newPage()
    fcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FAV-CARD-01] ${err.message}`)
    })
    try {
      await fcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(2000)
      const heart = fcPage.getByRole('button', { name: ja.detail.favoriteOn }).first()
      check('FAV-CARD-01 一覧カードに押せるお気に入りボタンが出る', (await heart.count()) >= 1)
      await heart.click()
      await fcPage.waitForTimeout(700)
      check(
        'FAV-CARD-01 ハートを押しても詳細へ遷移しない(一覧のまま)',
        (fcPage.url().split('#')[1] ?? '').startsWith('/recipes') &&
          !/^\/recipes\/\d/.test(fcPage.url().split('#')[1] ?? ''),
        fcPage.url(),
      )
      const favCount = await fcPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const all = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              all.onsuccess = () => resolve(all.result.filter((r) => r.isFavorite).length)
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('FAV-CARD-01 一覧のハートでお気に入りが1件付く', favCount === 1, `favCount=${favCount}`)
      await fcPage.getByRole('button', { name: ja.detail.favoriteOff }).first().click()
      await fcPage.waitForTimeout(700)
      const favCount2 = await fcPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const all = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              all.onsuccess = () => resolve(all.result.filter((r) => r.isFavorite).length)
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('FAV-CARD-01 もう一度押すと外れる', favCount2 === 0, `favCount=${favCount2}`)
    } finally {
      await fcBrowser.close()
    }
  }

  // --- SHARE-CANCEL-01(2026-07-29 便CI/C17): Web Share対応端末でテキスト共有をキャンセルしても、
  // クリップボードを黙って上書きしないこと。navigator.shareをAbortErrorで拒否するスタブで再現する ---
  currentCheck = 'SHARE-CANCEL-01'
  {
    const scBrowser = await chromium.launch()
    const scContext = await scBrowser.newContext()
    await scContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
    await scContext.addInitScript(() => {
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        value: () => Promise.reject(new DOMException('canceled', 'AbortError')),
      })
    })
    const scPage = await scContext.newPage()
    scPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHARE-CANCEL-01] ${err.message}`)
    })
    try {
      await scPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(2000)
      await scPage.evaluate(() => navigator.clipboard.writeText('★元のクリップボード★'))
      await scPage.getByText('肉じゃが', { exact: true }).first().click()
      await scPage.waitForTimeout(600)
      await scPage.locator(`button[aria-label="${ja.share.button}"]`).click()
      await scPage.waitForTimeout(300)
      const scDialog = scPage.getByRole('dialog', { name: ja.share.dialogTitle })
      await scDialog.getByRole('button', { name: ja.share.textOption }).click()
      await scPage.waitForTimeout(800)
      const clip = await scPage.evaluate(() => navigator.clipboard.readText())
      check(
        'SHARE-CANCEL-01/C17 共有をキャンセルしてもクリップボードが書き換わらない',
        clip === '★元のクリップボード★',
        clip.slice(0, 80),
      )
      check(
        'SHARE-CANCEL-01/C17 キャンセル時はシェアの窓も閉じない(やめたのに画面だけ変わらない)',
        await scDialog.isVisible(),
      )
    } finally {
      await scBrowser.close()
    }
  }
  // --- SEARCH-CI3-01(2026-07-29 便CI 第3波・検索の配線): C09/C21 タグ・材料がかなでも引ける /
  // C12 五十音順が読み順になる / C11 「ぜんぶ使える」が先頭に出る / C16 記録メモも検索対象 ---
  currentCheck = 'SEARCH-CI3-01'
  {
    const s3Browser = await chromium.launch()
    const s3Context = await s3Browser.newContext()
    const s3Page = await s3Context.newPage()
    s3Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SEARCH-CI3-01] ${err.message}`)
    })
    const countFor = async (query) => {
      await s3Page.locator('input[type="search"]').fill(query)
      await s3Page.waitForTimeout(500)
      // カードのタイトルで数える(a[href^="#/recipes/"] だけだと右下の「＋」も1件に数えてしまう)
      return await s3Page.locator('a[href^="#/recipes/"] p.line-clamp-2').count()
    }
    // 検索条件つきのURLで一覧を開き直す。同じ /recipes のまま goto すると RecipesPage が
    // 作り直されず、?ing= / ?q= が読まれない(初期stateでしか見ていないため)ので、
    // 一度べつの画面を経由して確実にマウントし直す
    const openRecipesWith = async (queryString) => {
      await s3Page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))
      await s3Page.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await s3Page.waitForTimeout(400)
      await s3Page.goto(`${BASE}/#/recipes${queryString}`, { waitUntil: 'networkidle' })
      await s3Page.waitForTimeout(900)
    }
    try {
      await s3Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await s3Page.waitForTimeout(2200) // 初回シード完了待ち

      // C09/C21: 漢字表記とかな表記で同じ件数になる(漢字側の件数を減らさないこと込み)
      for (const [kanji, kana] of [
        ['和食', 'わしょく'],
        ['作り置き', 'つくりおき'],
        ['お弁当', 'おべんとう'],
        ['鶏ひき肉', 'とりひきにく'],
      ]) {
        const kanjiCount = await countFor(kanji)
        const kanaCount = await countFor(kana)
        check(
          `SEARCH-CI3-01/C09・C21 「${kanji}」(${kanjiCount}件)と「${kana}」の件数が一致する`,
          kanjiCount > 0 && kanaCount === kanjiCount,
          `${kanji}=${kanjiCount} ${kana}=${kanaCount}`,
        )
      }
      await s3Page.locator('input[type="search"]').fill('')
      await s3Page.waitForTimeout(500)

      // C12: 五十音順が読みの順になっている(旧実装は漢字始まりが末尾に固まっていた)
      await s3Page.locator(`button[aria-label="${ja.search.sortToggle}"]`).click()
      await s3Page.waitForTimeout(300)
      await s3Page.getByRole('button', { name: ja.search.sortKana }).click()
      await s3Page.waitForTimeout(300)
      await s3Page.locator('[data-testid="sort-panel-close"]').click()
      await s3Page.waitForTimeout(600)
      const kanaTitles = await s3Page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="#/recipes/"] p.line-clamp-2')).map((p) =>
          p.textContent.trim(),
        ),
      )
      const indexOf = (title) => kanaTitles.indexOf(title)
      check(
        'SEARCH-CI3-01/C12 五十音順で「親子丼(おやこどん)」が「カレーライス(かれーらいす)」より前に出る',
        indexOf('親子丼') >= 0 && indexOf('親子丼') < indexOf('カレーライス'),
        `親子丼=${indexOf('親子丼')} カレーライス=${indexOf('カレーライス')}`,
      )
      check(
        'SEARCH-CI3-01/C12 「肉じゃが(にくじゃが)」が末尾ではなく「水ようかん(みずようかん)」より前に出る',
        indexOf('肉じゃが') >= 0 && indexOf('肉じゃが') < indexOf('水ようかん'),
        `肉じゃが=${indexOf('肉じゃが')} 水ようかん=${indexOf('水ようかん')} 全${kanaTitles.length}件`,
      )
      check(
        'SEARCH-CI3-01/C12 「豚汁(とんじる)」が「豚肉のケチャップ炒め(ぶたにく…)」より前に出る(同じ漢字で2箇所に割れない)',
        indexOf('豚汁') >= 0 && indexOf('豚汁') < indexOf('豚肉のケチャップ炒め'),
        `豚汁=${indexOf('豚汁')} 豚肉のケチャップ炒め=${indexOf('豚肉のケチャップ炒め')}`,
      )

      // C11: 「使いたい食材」を入れると、ぜんぶ使えるレシピが先頭に出る(並べ替えは更新順のまま)
      await openRecipesWith(`?ing=${encodeURIComponent('キャベツ にんじん')}`)
      const subLabels = await s3Page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="#/recipes/"] p.text-accent-ink')).map((p) =>
          p.textContent.trim(),
        ),
      )
      check(
        `SEARCH-CI3-01/C11 「${ja.search.usedAll}」レシピが先頭に出る`,
        subLabels[0] === ja.search.usedAll,
        JSON.stringify(subLabels.slice(0, 6)),
      )
      check(
        `SEARCH-CI3-01/C11 「${ja.search.usedAll}」が「一部だけ使える」より後ろに埋もれない`,
        subLabels.indexOf(ja.search.usedAll) <
          subLabels.findIndex((l) => l.startsWith('食材 1/')),
        JSON.stringify(subLabels.slice(0, 6)),
      )

      // C16: 作った記録のひとことメモでも探せる
      await openRecipesWith('')
      await s3Page.getByText('肉じゃが', { exact: true }).first().click()
      await s3Page.waitForTimeout(700)
      await s3Page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await s3Page.waitForTimeout(400)
      await s3Page
        .getByRole('dialog', { name: ja.detail.cookedDialogTitle })
        .locator('input[type="text"]')
        .first()
        .fill('こどもが完食した')
      await s3Page.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await s3Page.waitForTimeout(800)
      await openRecipesWith(`?q=${encodeURIComponent('完食')}`)
      const noteHitTitles = await s3Page.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="#/recipes/"] p.line-clamp-2')).map((p) =>
          p.textContent.trim(),
        ),
      )
      check(
        'SEARCH-CI3-01/C16 記録のひとことメモの言葉で、そのレシピを検索できる',
        noteHitTitles.length === 1 && noteHitTitles[0] === '肉じゃが',
        JSON.stringify(noteHitTitles),
      )
    } finally {
      await s3Browser.close()
    }
  }

  // --- SHARE-SERVINGS-01(2026-07-29 便CI/C18): 共有はレシピ詳細で表示している人数の分量で出る。
  // 従来は画面で4人分を見た直後に共有しても登録人数(2人分)の分量が出て、断りも無かった ---
  currentCheck = 'SHARE-SERVINGS-01'
  {
    const ssBrowser = await chromium.launch()
    const ssContext = await ssBrowser.newContext()
    await ssContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
    const ssPage = await ssContext.newPage()
    ssPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHARE-SERVINGS-01] ${err.message}`)
    })
    try {
      await ssPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ssPage.waitForTimeout(2000)
      await ssPage.getByText('肉じゃが', { exact: true }).first().click()
      await ssPage.waitForTimeout(700)
      const registered = Number(
        ((await ssPage.locator('span.min-w-14').first().textContent()) ?? '').match(/\d+/)?.[0],
      )
      await ssPage.locator(`button[aria-label="${ja.detail.servingsUp}"]`).first().click()
      await ssPage.waitForTimeout(300)
      await ssPage.locator(`button[aria-label="${ja.share.button}"]`).click()
      await ssPage.waitForTimeout(400)
      const ssDialog = ssPage.getByRole('dialog', { name: ja.share.dialogTitle })
      check(
        'SHARE-SERVINGS-01/C18 シェアの窓に「いま表示している◯人分の分量でシェアします」が出る',
        ((await ssDialog.textContent()) ?? '').includes(
          `いま表示している${registered + 1}人分の分量でシェアします`,
        ),
        await ssDialog.textContent(),
      )
      await ssDialog.getByRole('button', { name: ja.share.textOption }).click()
      await ssPage.waitForTimeout(800)
      const shared = await ssPage.evaluate(() => navigator.clipboard.readText())
      check(
        'SHARE-SERVINGS-01/C18 共有した文章の人数が表示中の人数になる',
        shared.includes(`\n${registered + 1}人分\n`),
        shared.split('\n').slice(0, 3).join(' / '),
      )
    } finally {
      await ssBrowser.close()
    }
  }
  // --- PASTE-SERVINGS-01(2026-07-30 便CK/①-1): 貼り付けの人数分もアプリの範囲(1〜20)に収める。
  // 「＋」は20人分で止まるのに、貼り付けからは50人分がそのまま入り保存できていた ---
  currentCheck = 'PASTE-SERVINGS-01'
  {
    await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    await page.getByText(ja.paste.open).click()
    await page.waitForTimeout(300)
    await page
      .locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
      .fill('大鍋のカレー\n50人分\n材料\nじゃがいも 20個\nにんじん 10本\n作り方\n1. 全部切る\n2. 煮る')
    await page.getByRole('button', { name: ja.paste.apply }).click()
    await page.waitForTimeout(500)
    const pastedServings = await page
      .locator('span.min-w-14.text-center.text-lg.font-bold.text-ink')
      .textContent()
    check(
      'PASTE-SERVINGS-01 「50人分」を貼り付けても人数分は上限の20人分に収まる',
      pastedServings === '20人分',
      `実際=${pastedServings}`,
    )
    check(
      'PASTE-SERVINGS-01 材料・手順の取り込み自体は従来どおり動く',
      (await page.textContent('body')).includes('材料2件・手順2件を読み取りました'),
    )
    // 下書きを残さずに離脱する(以降のチェックに「復元しますか？」を持ち込まない)
    await page.getByRole('button', { name: 'キャンセル' }).click()
    await page.waitForTimeout(500)
  }

  // --- EDITMISSING-01(2026-07-30 便CK/①-2): 削除済み・存在しないIDの編集URL。
  // 従来は案内が一切出ないまま入力でき、baselineRefがnullのままなので下書きの自動保存・
  // 離脱警告・キャンセル確認が3つまとめて停止し、「保存する」を押すと無言で
  // 「レシピが見つかりませんでした」の画面へ飛んで1件も保存されていなかった ---
  currentCheck = 'EDITMISSING-01'
  {
    await page.goto(`${BASE}/#/recipes/424242/edit`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    check(
      'EDITMISSING-01 レシピが見つからないことを保存前に画面で伝える',
      (await page.textContent('body')).includes(ja.form.recipeNotFound),
    )
    await page.locator(`input[placeholder="${ja.form.namePlaceholder}"]`).fill('存在しないIDの編集テスト')
    await page.waitForTimeout(600)
    const missingDraftKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('uchirecipe:draft:')),
    )
    check(
      'EDITMISSING-01 書いた内容の下書き自動保存が止まらない(全損しない)',
      missingDraftKeys.includes('uchirecipe:draft:edit:424242'),
      JSON.stringify(missingDraftKeys),
    )
    await page.getByRole('button', { name: '保存する' }).click()
    await page.waitForTimeout(800)
    check(
      'EDITMISSING-01 保存を押しても無言で飛ばされず、編集画面に留まる',
      page.url().includes('#/recipes/424242/edit'),
      page.url(),
    )
    check(
      'EDITMISSING-01 保存できない理由が画面に出る',
      (await page.textContent('body')).includes(ja.form.recipeNotFound),
    )
    // キャンセル確認が復活していること(dirtyRefが効いている)＝確認を経て下書きも片付く
    await page.getByRole('button', { name: 'キャンセル' }).click()
    await page.waitForTimeout(600)
    const missingDraftAfter = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('uchirecipe:draft:edit:424242')),
    )
    check(
      'EDITMISSING-01 キャンセルの確認が効き、下書きも片付く',
      missingDraftAfter.length === 0,
      JSON.stringify(missingDraftAfter),
    )
  }

  // --- PRICEUNDO-01(2026-07-30 便CK/③-2): 「食材と価格」の行削除に取り消しを付ける。
  // 従来は確認もトーストも無い1タップで目安価格の原本ごと消え、アプリ内に復旧導線が無かった
  // (規約F違反。seedPriceDefaultsIfNeededは初回起動とPRICE_DEFAULTS_VERSION更新時しか走らない) ---
  currentCheck = 'PRICEUNDO-01'
  {
    await page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    await page.locator(`input[aria-label="${ja.priceMaster.searchLabel}"]`).fill('玉ねぎ')
    await page.waitForTimeout(400)
    const priceBefore = await page
      .locator(`input[aria-label="${ja.priceMaster.entryPriceAria.replace('{name}', '玉ねぎ')}"]`)
      .first()
      .inputValue()
    await page.locator(`button[aria-label="${ja.priceMaster.remove}"]`).first().click()
    await page.waitForTimeout(500)
    const removedBody = await page.textContent('body')
    check(
      'PRICEUNDO-01 削除したことと、概算食費から外れることをその場で伝える',
      removedBody.includes('「玉ねぎ」を削除しました。この食材を使うレシピの概算食費からも外れます'),
    )
    check(
      'PRICEUNDO-01 行は実際に消えている',
      (await page.locator(`input[aria-label="${ja.priceMaster.entryPriceAria.replace('{name}', '玉ねぎ')}"]`).count()) === 0,
    )
    await page.getByRole('button', { name: '元に戻す' }).click()
    await page.waitForTimeout(600)
    check(
      'PRICEUNDO-01 「元に戻す」で戻ったことを伝える',
      (await page.textContent('body')).includes('「玉ねぎ」を戻しました（目安価格も元のままです）'),
    )
    const priceAfter = await page
      .locator(`input[aria-label="${ja.priceMaster.entryPriceAria.replace('{name}', '玉ねぎ')}"]`)
      .first()
      .inputValue()
    check(
      'PRICEUNDO-01 目安価格も削除前と同じ値で戻る',
      priceAfter === priceBefore && priceAfter !== '',
      `削除前=${priceBefore} 復元後=${priceAfter}`,
    )
  }

  // --- FOCUSVOICE-01(2026-07-30 便CK/④-1): 調理中モードの声の操作「もう一回」。
  // 判定の正規表現が半角の「1」しか見ておらず、案内文どおりの「もう一回」(漢数字)と
  // 「もういっかい」が完全無反応(読み上げも、聞き取りの手応えも出ない)だった。
  // window.SpeechRecognitionを偽装して onresult に文字列を注入して検証する ---
  currentCheck = 'FOCUSVOICE-01'
  {
    const fvBrowser = await chromium.launch()
    const fvContext = await fvBrowser.newContext({ viewport: { width: 375, height: 667 } })
    await fvContext.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = ''
          this.continuous = false
          this.interimResults = false
        }
        start() {
          window.__fakeRecognition = this
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRecognition
      window.__emitVoice = (text) => {
        const r = window.__fakeRecognition
        if (!r || typeof r.onresult !== 'function') return false
        r.onresult({ results: [[{ transcript: text }]] })
        return true
      }
    })
    const fvPage = await fvContext.newPage()
    fvPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FOCUSVOICE-01] ${err.message}`)
    })
    try {
      await fvPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fvPage.waitForTimeout(2000)
      await fvPage.getByText('肉じゃが', { exact: true }).first().click()
      await fvPage.waitForTimeout(700)
      await fvPage.getByText(ja.focus.open).click()
      await fvPage.waitForTimeout(600)
      await fvPage.locator(`button[aria-label="${ja.focus.micStart}"]`).click()
      await fvPage.waitForTimeout(400)
      check('FOCUSVOICE-01 前提: 「声で操作」ONで聞いている状態になる', (await fvPage.textContent('body')).includes('聞いています…'))
      for (const phrase of ['もう一回', 'もういっかい', 'もう1回', 'もう一度']) {
        const emitted = await fvPage.evaluate((text) => window.__emitVoice(text), phrase)
        await fvPage.waitForTimeout(400)
        check(
          `FOCUSVOICE-01 「${phrase}」が読み上げのコマンドとして届く(聞き取りの手応えが出る)`,
          emitted && (await fvPage.textContent('body')).includes(`「${phrase}」を聞き取りました`),
          `注入=${emitted}`,
        )
        await fvPage.waitForTimeout(2300) // 手応え表示(2.5秒)が消えるのを待って次の語形へ
      }
      // 移動系のコマンドが従来どおり効くこと(正規表現の書き換えで壊していないことの確認)
      await fvPage.evaluate(() => window.__emitVoice('次へ'))
      await fvPage.waitForTimeout(500)
      check(
        'FOCUSVOICE-01 「次へ」は従来どおり手順を進める',
        (await fvPage.textContent('body')).includes('手順 2/'),
      )
      await fvPage.evaluate(() => window.__emitVoice('戻って'))
      await fvPage.waitForTimeout(500)
      check(
        'FOCUSVOICE-01 「戻って」は従来どおり手順を戻す',
        (await fvPage.textContent('body')).includes('手順 1/'),
      )
    } finally {
      await fvBrowser.close()
    }
  }

  // ============================================================================
  // 便CP-2（2026-08-02・docs/62 決定②③④）: 目的モード / 恒常のお試し2種 / 精度開示2箇所
  // ============================================================================

  // --- PURPOSE-01: 無料ユーザーの入口（docs/62 決定②「売り場を変える」）。
  // 2026-08-19 便IF・②（オーナー原文「無料版でpro機能の案内が折りたたみでも表示されていて
  // 邪魔。しまって。」）: 鍵付き行の置き場所を**条件の窓の中**へ移した。
  // 見るのは「入口が残っていること」と「タップで設定のPro節へ着地すること」で変わらない。
  // 変わったのは、窓を開くまでは場所を取らないこと（消してはいない）。 ---
  currentCheck = 'PURPOSE-01'
  {
    const p1Browser = await chromium.launch()
    const p1Context = await p1Browser.newContext({ viewport: { width: 390, height: 844 } })
    const p1Page = await p1Context.newPage()
    p1Page.on('pageerror', (err) => errors.push(`[pageerror@PURPOSE-01] ${err.message}`))
    try {
      await p1Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await p1Page.waitForTimeout(1800) // 初回シード待ち
      await p1Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p1Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(p1Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await p1Page.waitForTimeout(400)

      const p1Locked = p1Page.locator('[data-testid="purpose-locked-row"]')
      check(
        'PURPOSE-01(便IF・②) 週タブを開いただけでは鍵付き行は出ない（しまわれている）',
        (await p1Locked.count()) === 0,
      )
      check(
        'PURPOSE-01 未解錠では目的の選択肢は出さない',
        (await p1Page.locator('[data-testid="purpose-picker"]').count()) === 0,
      )
      await openWeekGroup(p1Page, ja.mealPlan.weekGroupAutoTitle)
      await p1Page.locator('[data-testid="plan-conditions-open"]').click()
      await p1Page.waitForTimeout(400)
      check(
        'PURPOSE-01(便IF・②) 条件の窓を開けば鍵付き行がある（消してはいない）',
        await p1Locked.isVisible(),
      )
      const p1LockedText = (await p1Locked.textContent()) ?? ''
      check(
        'PURPOSE-01 鍵付き行に何ができるかが書かれている',
        p1LockedText.includes('栄養から組む') && p1LockedText.includes('たんぱく質多め'),
        `text=${p1LockedText}`,
      )
      check(
        'PURPOSE-01 条件の窓を開いても未解錠に3択は出ない',
        (await p1Page.locator('[data-testid="purpose-picker"]').count()) === 0,
      )
      await p1Locked.click()
      await p1Page.waitForTimeout(600)
      check(
        'PURPOSE-01 鍵付き行のタップでPro案内（設定のPro節）へ着地する',
        p1Page.url().includes('/settings') && p1Page.url().includes('section=pro'),
        `url=${p1Page.url()}`,
      )

      /* 2026-08-29 便MK: この節は `purpose-picker` の count()===0 を3回見ているのに、
         同じ節では一度も「出る」側を測っていなかった＝目印が変わっても必ず緑になる
         （便LOの走査で 12:1620・1637 として残っていた2件）。Pro案内へ着いたところで解錠し、
         同じ場所に3択が出るところまでを1本につないで対にする。 */
      await p1Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readwrite')
              const store = tx.objectStore('settings')
              const get = store.get(1)
              get.onsuccess = () => {
                store.put({
                  ...(get.result || { id: 1 }),
                  id: 1,
                  proCode: 'UR-E2E-TEST-ONLY',
                  proActivatedAt: Date.now(),
                })
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      // 生のIndexedDBへ書いたので読み込み直す（Dexieのライブ購読はDexie経由しか見ていない・禁じ手⑥）
      await p1Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p1Page.reload({ waitUntil: 'networkidle' })
      await p1Page.waitForTimeout(1500)
      await p1Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(p1Page)
      await p1Page.waitForTimeout(400)
      await openWeekGroup(p1Page, ja.mealPlan.weekGroupAutoTitle)
      await p1Page.locator('[data-testid="plan-conditions-open"]').click()
      await p1Page.waitForTimeout(600)
      check(
        'PURPOSE-01 前提: 解錠すれば同じ場所に3択が出る（目印が生きている）',
        (await p1Page.locator('[data-testid="purpose-picker"]').count()) === 1,
      )
      check(
        'PURPOSE-01 解錠したら鍵付き行のほうは消える（両方は出さない）',
        (await p1Locked.count()) === 0,
      )
    } finally {
      await p1Browser.close()
    }
  }

  // --- PURPOSE-02: 目的モード（Pro）。「たんぱく質多め」を選ぶと
  //  ①選択が設定に残る（再読み込み後も維持）②畳んだ条件ラベルに現在値が出る
  //  ③「まとめて献立を立てる」で実際に献立が入り、その枠に目的が記録される
  //  ④月タブの答え合わせ（「この月の「目的から組む」」）に日数と数字が並置される
  // Pro解錠はMEALPLAN-07等と同じ settings.proCode 直書きで再現する。 ---
  currentCheck = 'PURPOSE-02'
  {
    const p2Browser = await chromium.launch()
    const p2Context = await p2Browser.newContext({ viewport: { width: 390, height: 844 } })
    const p2Page = await p2Context.newPage()
    p2Page.on('pageerror', (err) => errors.push(`[pageerror@PURPOSE-02] ${err.message}`))
    try {
      await p2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await p2Page.waitForTimeout(1800)
      await p2Page.evaluate(async () => {
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
      await p2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p2Page.reload({ waitUntil: 'networkidle' })
      await p2Page.waitForTimeout(800)
      await p2Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(p2Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await p2Page.waitForTimeout(400)

      // 2026-08-09 便EN: 「献立を提案」グループが既定で畳んであるので先に開く
      await openWeekGroup(p2Page, ja.mealPlan.weekGroupAutoTitle)
      await p2Page.waitForTimeout(300)
      await p2Page.locator('[data-testid="plan-conditions-open"]').click()
      await p2Page.waitForTimeout(400)
      const p2Picker = p2Page.locator('[data-testid="purpose-picker"]')
      check('PURPOSE-02 解錠済みの条件欄に目的の選択肢が出る', await p2Picker.isVisible())
      // 2026-08-27 便LO: 「鍵付き行は出さない」は**条件の窓を開いたあと**で測る。
      // 2026-08-19 便IF で鍵付き行の置き場所が条件の窓の中へ移ったので、窓を開く前は
      // 解錠済みでも未解錠でも0件になる（PURPOSE-01 が同じ場所で0件を見ている）＝
      // 窓の手前で測っていた間は、Proの線が壊れても必ず緑だった。
      // 目的の選択肢が出ていること（上の行）と対にして、同じ画面で両方を見る
      check(
        'PURPOSE-02 解錠済みなら、条件の窓を開いても鍵付き行は出さない',
        (await p2Page.locator('[data-testid="purpose-locked-row"]').count()) === 0,
        `窓の中の鍵付き行=${await p2Page.locator('[data-testid="plan-conditions-modal"] [data-testid="purpose-locked-row"]').count()}件`,
      )
      const p2PickerText = (await p2Picker.textContent()) ?? ''
      // 2026-08-19 便ID・⑤(オーナー原文「個別に『〇〇多め』『〇〇ひかえめ』とついていると
      // くどく感じる。しかし、『提案の条件：〇〇』に入れる場合は『〇〇多め』の方が見やすい」):
      // **選択肢は区分(多め/ひかえめ)＋項目名だけ**になった。軸の顔ぶれ(8つ)は変えていないので、
      // 見張る中身は「8軸そろっているか」のまま、名前の読み方だけを ja.ts から引く形にする
      check(
        'PURPOSE-02 選択肢は 指定なし＋「多め」4つ＋「ひかえめ」4つの計8軸(2026-08-07 便DT-9)',
        p2PickerText.includes('指定なし') &&
          Object.values(ja.mealPlan.purposeOption).every((label) => p2PickerText.includes(label)) &&
          Object.values(ja.mealPlan.purposeOption).length === 8,
        `text=${p2PickerText}`,
      )
      // 2026-08-19 便HT(オーナー指示「栄養から組むのボタンは、プルダウンにしたい」):
      // チップ9個をプルダウン1つにした。ここで見たいのは「選んだ結果が効いているか」なので、
      // 掴み方だけをプルダウンに合わせ、確かめる中身は変えていない
      const p2Select = p2Page.locator('[data-testid="plan-purpose"]')
      check('PURPOSE-02 目的の選択肢はプルダウン1つにまとまっている', (await p2Select.count()) === 1)
      check(
        'PURPOSE-02 既定は「指定なし」（従来どおりの提案）',
        (await p2Select.inputValue()) === '',
        `value=${await p2Select.inputValue()}`,
      )
      check(
        `PURPOSE-02 プルダウンの中でも「${ja.mealPlan.purposeGroupMore}」「${ja.mealPlan.purposeGroupLess}」の2群に分かれている`,
        (await p2Select.locator(`optgroup[label="${ja.mealPlan.purposeGroupMore}"]`).count()) === 1 &&
          (await p2Select.locator(`optgroup[label="${ja.mealPlan.purposeGroupLess}"]`).count()) === 1,
      )
      // 断定・効能の語（「バランスの良い」等）を出していないこと（docs/60 §1-3・規約H）
      check(
        'PURPOSE-02 目的の説明に断定・効能の語を使っていない',
        !p2PickerText.includes('バランスの良い') &&
          !p2PickerText.includes('健康的') &&
          !p2PickerText.includes('不足'),
        `text=${p2PickerText}`,
      )

      await p2Select.selectOption({ label: ja.mealPlan.purposeOption.protein })
      await p2Page.waitForTimeout(700)
      check(
        'PURPOSE-02 プルダウンで選ぶとその値になる',
        (await p2Select.inputValue()) === 'protein',
        `value=${await p2Select.inputValue()}`,
      )
      // 窓を閉じると、条件のボタンに現在の目的が出る（何が効いているか窓を開けなくても分かる）。
      // 2026-08-19 便ID・⑤: 選択肢は「たんぱく質」でも、ボタンには区分を足した「たんぱく質多め」で出る
      await p2Page.locator('[data-testid="plan-conditions-close"]').click()
      await p2Page.waitForTimeout(400)
      check(
        'PURPOSE-02 条件のボタンに現在の目的が「たんぱく質多め」の形で出る',
        (
          (await p2Page.locator('[data-testid="plan-conditions-open"]').textContent()) ?? ''
        ).includes(ja.mealPlan.purposeProtein),
      )
      // 設定に保存され、再読み込みしても選び直さずに済む（1か月続けるための指定）
      await p2Page.reload({ waitUntil: 'networkidle' })
      await p2Page.waitForTimeout(800)
      await p2Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(p2Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await p2Page.waitForTimeout(400)
      // 折りたたみの状態は覚えないので、読み込み直したらまた畳んである（2026-08-09 便EN）
      await openWeekGroup(p2Page, ja.mealPlan.weekGroupAutoTitle)
      await p2Page.waitForTimeout(300)
      check(
        'PURPOSE-02 選んだ目的は再読み込み後も残る',
        (
          (await p2Page.locator('[data-testid="plan-conditions-open"]').textContent()) ?? ''
        ).includes(
          ja.mealPlan.purposeProtein,
        ),
      )

      // まとめて献立: 目的が効いていても提案は0件にならず、入れた枠に目的が記録される
      await p2Page.getByRole('button', { name: ja.mealPlan.fillWeek, exact: true }).click()
      await p2Page.waitForTimeout(1500)
      const p2Entries = await p2Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('PURPOSE-02 目的を指定しても献立が入る（0件回避が壊れていない）', p2Entries.length > 0, `n=${p2Entries.length}`)
      check(
        'PURPOSE-02 自動で入れた枠に目的が記録される',
        p2Entries.filter((e) => e.purpose === 'protein').length > 0,
        `purpose付き=${p2Entries.filter((e) => e.purpose === 'protein').length}/${p2Entries.length}`,
      )

      // 月タブの「答え合わせ」(旧「この月の『栄養から組む』」)は、2026-08-19 便HV・⑨の
      // オーナー指示で削除した。**消したものが戻っていないこと**と、
      // **消しても「栄養から組む」自体は効いたままであること**(枠に purpose が残るのは上で確認済み)を見る
      await p2Page.getByRole('button', { name: '月', exact: true }).click()
      await p2Page.waitForTimeout(600)
      // 2026-08-26 便LH: 「栄養から組む」の入口は「献立の入れかた」の折りたたみの中へ移った
      await openMonthPlanGroup(p2Page)
      await p2Page.waitForTimeout(800)
      const p2NutritionCard = p2Page.getByRole('button', { name: jaRe(ja.mealPlan.monthNutritionTitle, { m: '' }) })
      if (await p2NutritionCard.count()) {
        await p2NutritionCard.click()
        await p2Page.waitForTimeout(400)
      }
      const p2MonthBody = ((await p2Page.textContent('body')) ?? '').replaceAll('\u200b', '')
      check(
        'PURPOSE-02(便HV・⑨) 月タブに「この月の『栄養から組む』」の答え合わせは出さない',
        (await p2Page.locator('[data-testid="purpose-review"]').count()) === 0 &&
          !p2MonthBody.includes('で組んだ日'),
        `本文=${p2MonthBody.slice(0, 200)}`,
      )
      check(
        'PURPOSE-02(便HV・⑨) 答え合わせを消しても「栄養から組む」の入口は月タブに残っている',
        (await p2Page.locator('[data-testid="plan-conditions-open"]').count()) > 0,
      )

      /* 2026-08-29 便MQ: この節は `purpose-locked-row` の count()===0（上の「解錠済みなら鍵付き行は
         出さない」）を見ているのに、**同じ節では一度も「出る」側を測っていなかった**＝目印の名前が
         変わっても必ず緑になる（便LOの走査で 12:1751 として残っていた1件）。
         **実測**: src の data-testid を purpose-locked-rowZZ に改名して npm run build（終了コード0）
         したうえでこの節を走らせると、**14件とも緑のまま**だった＝素通りは確定。
         解錠を外して、同じ条件の窓に鍵付き行が戻るところまでを1本につないで対にする。 */
      await p2Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readwrite')
              const store = tx.objectStore('settings')
              const get = store.get(1)
              get.onsuccess = () => {
                const { proCode, proActivatedAt, ...rest } = get.result || { id: 1 }
                const put = store.put({ ...rest, id: 1 })
                put.onsuccess = () => resolve(undefined)
                put.onerror = () => reject(put.error)
              }
              get.onerror = () => reject(get.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      // 生のIndexedDBへ書いたので必ず読み込み直す(Dexieのライブ購読はDexie経由の書き込みしか
      // 見ていない＝CLAUDE.mdの禁じ手⑥)
      await p2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p2Page.reload({ waitUntil: 'networkidle' })
      await p2Page.waitForTimeout(800)
      await p2Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(p2Page) // 畳む既定なので、カードの中を触る前に開く(禁じ手⑤)
      await p2Page.waitForTimeout(400)
      await openWeekGroup(p2Page, ja.mealPlan.weekGroupAutoTitle)
      await p2Page.waitForTimeout(300)
      await p2Page.locator('[data-testid="plan-conditions-open"]').click()
      await p2Page.waitForTimeout(400)
      check(
        'PURPOSE-02 解錠を外すと同じ条件の窓に鍵付き行が戻る(「出さない」側だけを見ない)',
        (await p2Page.locator('[data-testid="purpose-locked-row"]').count()) > 0,
      )
    } finally {
      await p2Browser.close()
    }
  }


  // --- LN-PICK-01: 「レシピから追加」の選択画面が、レシピタブと同じ探し方になっている
  //     （2026-08-27 便LN・オーナー原文「レシピから追加のレシピ選択画面は、検索と絞り込み、
  //     並び替えの使い勝手をレシピタブと同じにしたい。レシピの表示の仕方は今のまま、
  //     食数増減できる状態で。」）。
  //
  //     直す前は、検索が料理名だけの部分一致・絞り込みが1つも無い・並び替えが4種だけだった。
  //     測るのは利用者が確かめたいこと5つ。**どこに出ているか**ではなく
  //     **その操作で並びが変わるか**で見る（並びやDOMの形が変わっても同じ判定になる形）:
  //       ①料理名に無い言葉（材料）でも探せる ②「一致した場所」が読める
  //       ③絞り込みで品数が減る ④並び替えで並びが変わる
  //       ⑤レシピの見せ方と食数の±は今までどおり（オーナーが名指しで「今のまま」と言ったもの）
  currentCheck = 'LN-PICK-01'
  {
    const lnBrowser = await chromium.launch()
    try {
      const lnContext = await lnBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const lnPage = await lnContext.newPage()
      lnPage.on('dialog', (dialog) => dialog.accept())
      lnPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@LN-PICK-01] ${err.message}`)
      })
      const lnTitles = () =>
        lnPage.evaluate(() =>
          [...document.querySelectorAll('li')]
            .filter((li) => li.querySelector('button[aria-label]'))
            .map((li) => li.querySelector('p')?.textContent?.replace(/​/g, '').trim())
            .filter(Boolean),
        )

      await lnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await lnPage.waitForTimeout(1800)
      await lnPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await lnPage.waitForTimeout(500)
      await lnPage.getByRole('button', { name: ja.shopping.tabMemo, exact: true }).click()
      await lnPage.waitForTimeout(300)
      await lnPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await lnPage.waitForTimeout(500)

      const lnAll = await lnTitles()
      check('LN-PICK-01 選択画面にレシピが並ぶ', lnAll.length > 0, `n=${lnAll.length}`)

      // ① 料理名に無い言葉（材料名）で探せる＝レシピタブと同じ searchRecipes を使っている。
      //    打つ言葉は同梱レシピの材料から取り、料理名に含まれない語であることを検査の中で確かめる
      const lnWord = '鶏ひき肉'
      await lnPage.getByPlaceholder(ja.search.placeholder).fill(lnWord)
      await lnPage.waitForTimeout(600)
      const lnFound = await lnTitles()
      check(
        `LN-PICK-01 ①材料の言葉（${lnWord}）で探せる＝料理名だけの部分一致ではない`,
        lnFound.length > 0 && lnFound.some((t) => !t.includes(lnWord)),
        `該当=${JSON.stringify(lnFound)}`,
      )
      check(
        'LN-PICK-01 ①探した結果は全件より少ない（絞れている）',
        lnFound.length < lnAll.length,
        `該当=${lnFound.length} 全件=${lnAll.length}`,
      )

      // ② 「一致した場所」が読める（レシピタブと同じ窓）
      check(
        'LN-PICK-01 ②「一致した場所」の入口が出る',
        (await lnPage.getByTestId('picker-match-open').count()) === 1,
      )
      await lnPage.getByTestId('picker-match-open').click()
      await lnPage.waitForTimeout(400)
      const lnMatch = ((await lnPage.getByTestId('search-match-dialog').textContent()) ?? '').replaceAll('​', '')
      check(
        'LN-PICK-01 ②一致した場所に、打った言葉と当たった場所が出る',
        lnMatch.includes(lnWord) && (await lnPage.getByTestId('search-match-word').count()) > 0,
        `窓=${lnMatch.slice(0, 120)}`,
      )
      await lnPage.getByTestId('search-match-close').click()
      await lnPage.waitForTimeout(300)
      await lnPage.getByPlaceholder(ja.search.placeholder).fill('')
      await lnPage.waitForTimeout(500)

      // ③ 絞り込みで品数が減る（レシピタブと同じパネル）
      await lnPage.getByRole('button', { name: ja.search.filterToggle }).click()
      await lnPage.waitForTimeout(500)
      check(
        'LN-PICK-01 ③レシピタブと同じ絞り込みパネルが開く',
        (await lnPage.getByTestId('recipes-filter-panel').count()) === 1,
      )
      await lnPage.getByRole('button', { name: ja.dishType.side, exact: true }).click()
      await lnPage.waitForTimeout(500)
      await lnPage.getByTestId('filter-panel-close').click()
      await lnPage.waitForTimeout(500)
      const lnSide = await lnTitles()
      check(
        'LN-PICK-01 ③料理の種別で絞ると品数が減る',
        lnSide.length > 0 && lnSide.length < lnAll.length,
        `副菜=${lnSide.length} 全件=${lnAll.length}`,
      )

      // ④ 並び替えで並びが変わる（レシピタブと同じパネル。無料でも選べる並びで測る）
      await lnPage.getByRole('button', { name: ja.search.sortToggle }).click()
      await lnPage.waitForTimeout(500)
      check(
        'LN-PICK-01 ④レシピタブと同じ並び替えパネルが開く',
        (await lnPage.getByTestId('recipes-sort-panel').count()) === 1,
      )
      const lnSortText = ((await lnPage.getByTestId('recipes-sort-panel').textContent()) ?? '').replaceAll('​', '')
      check(
        'LN-PICK-01 ④無料でも選べる並び（最近作った順・原価順）が出ている',
        lnSortText.includes(ja.search.sortRecentCooked) && lnSortText.includes(ja.search.sortCost),
        `パネル=${lnSortText.slice(0, 160)}`,
      )
      check(
        'LN-PICK-01 ④栄養8項目の並び替えはProの線のまま（無料では案内が出る）',
        lnSortText.includes(ja.search.sortNutritionGate),
        `パネル=${lnSortText.slice(0, 200)}`,
      )
      await lnPage.getByRole('button', { name: ja.search.sortKana, exact: true }).click()
      await lnPage.waitForTimeout(400)
      await lnPage.getByTestId('sort-panel-close').click()
      await lnPage.waitForTimeout(500)
      const lnKana = await lnTitles()
      check(
        'LN-PICK-01 ④並び替えを変えると並びが変わる（品数は変わらない）',
        lnKana.length === lnSide.length && JSON.stringify(lnKana) !== JSON.stringify(lnSide),
        `五十音=${JSON.stringify(lnKana.slice(0, 3))} 直前=${JSON.stringify(lnSide.slice(0, 3))}`,
      )

      // ⑤ レシピの見せ方と食数の±は今までどおり（写真つきの標準のカード＋±のボタン）
      const lnCard = await lnPage.evaluate((upLabel) => {
        const plus = [...document.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === upLabel,
        )
        const li = plus?.closest('li')
        return {
          title: li?.querySelector('p')?.textContent?.replace(/​/g, '').trim() ?? '',
          hasThumb: !!li?.querySelector('img, [class*="mask"], svg'),
          hasMinus: !!li?.querySelector('button[aria-label]'),
        }
      }, ja.shopping.pickerServingUp)
      check(
        'LN-PICK-01 ⑤レシピの見せ方は今のまま（料理名と写真の枠がある行）',
        lnCard.title.length > 0 && lnCard.hasThumb,
        `カード=${JSON.stringify(lnCard)}`,
      )
      await lnPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await lnPage.waitForTimeout(300)
      const lnAfterPlus = ((await lnPage.textContent('body')) ?? '').replaceAll('​', '')
      check(
        'LN-PICK-01 ⑤食数の＋が今までどおり効く（1食になる）',
        lnAfterPlus.includes(`1${ja.shopping.pickerServingUnit}`) &&
          !(await lnPage.getByRole('button', { name: ja.shopping.makeCandidates }).isDisabled()),
      )

      // 0品になる条件を掛けたら、その場で条件を外せる（行き止まりにしない）
      await lnPage.getByPlaceholder(ja.search.placeholder).fill('ここにしかないことば')
      await lnPage.waitForTimeout(600)
      check(
        'LN-PICK-01 0品のときは、その場で条件を外せる',
        (await lnPage.getByTestId('picker-clear').count()) === 1,
      )
      await lnPage.getByTestId('picker-clear').click()
      await lnPage.waitForTimeout(600)
      const lnCleared = await lnTitles()
      check(
        'LN-PICK-01 条件をクリアすると全件に戻り、選んだ食数は残る',
        lnCleared.length === lnAll.length &&
          ((await lnPage.textContent('body')) ?? '').includes(`1${ja.shopping.pickerServingUnit}`),
        `クリア後=${lnCleared.length} 全件=${lnAll.length}`,
      )
      // 選んだ状態のまま下書きまで作れる（探し方を変えても、この画面の目的は変わっていない）
      await lnPage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await lnPage.waitForTimeout(700)
      check(
        'LN-PICK-01 探して選んだあと、今までどおり下書きが作れる',
        ((await lnPage.textContent('body')) ?? '').replaceAll('​', '').includes(ja.shopping.candidateTitle),
      )
    } finally {
      await lnBrowser.close()
    }
  }
