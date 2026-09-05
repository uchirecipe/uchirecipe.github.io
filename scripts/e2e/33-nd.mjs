// ==========================================================================================
// 便ND（2026-09-05）: レシピ一覧の上の「最近作っていないレシピ」の区画
// この中の節: NDSHELF-01, NDSHELF-02, NDSHELF-03
//
// オーナー原文「しばらく作っていない棚は、自分で登録したレシピが優先で出るようにする、
// 毎回同じ作っていないレシピが並ば内容にする、ようにしたい」
//
// 測ること:
//  NDSHELF-01 初回シード直後（自作0品）でも区画が出て、同梱の基本レシピで10品埋まる。
//             区画の中だけが横にスクロールし、ページ全体は横にあふれない
//  NDSHELF-02 14日の境目（13日前に作った品は出ない・15日前と一度も作っていない品は出る）と
//             自作が先。並びは実装と同じ関数＋同じ種（日替わり）から作った期待値と一致し、
//             開き直しても変わらない。**日替わりの検証は E2E_FAKE_TODAY を2日分**当てて走らせる
//             （どちらの日でもその日の期待値と一致する＝種が今日の日付で効いている。
//              あわせて「あすの種」の期待値が今日の並びと違うことも節の中で見る）
//  NDSHELF-03 検索中・選択モード中・並べ替え中は区画ごと消え、条件を外すと戻る。
//             全品を今日作った状態にすると見出しごと消える（一覧そのものは残る）
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 文言は ja.ts から読む（禁じ手②）。並びの期待値は _shared.mjs 経由の pickShelfRecipes／
// shelfSeed（実装そのもの）から作る＝優先順・上限・種の決め方を検査に書き写さない。
// 曜日・月替わりの前提は置かない（日付は「今日からn日前」で組み立てる）。
// ==========================================================================================
import './_shared.mjs'

  currentCheck = 'NDSHELF-01'
  {
    const ndBrowser = await chromium.launch()
    try {
      const ndCtx = await ndBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const ndPage = await ndCtx.newPage()
      ndPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await ndPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1800) // 初回シード完了待ち

      // 「今日からn日前」のYYYY-MM-DD。E2E_FAKE_TODAY があれば node 側の Date ごとずれている
      const ndDay = (daysAgo) => {
        const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        const p = (v) => String(v).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }
      const ndShelfLinkIds = () =>
        ndPage.evaluate(() =>
          Array.from(
            document.querySelectorAll('[data-testid="recipe-shelf"] a[href^="#/recipes/"]'),
          ).map((a) => Number((a.getAttribute('href') ?? '').split('/').pop())),
        )

      // --- NDSHELF-01: 自作0品でも区画が出て、同梱で10品埋まる ---
      check(
        'NDSHELF-01 一覧の上に「最近作っていないレシピ」の見出しが出る',
        stripZwspText(await ndPage.textContent('body')).includes(ja.recipes.shelfNotRecentTitle),
      )
      const ndFreshIds = await ndShelfLinkIds()
      check(
        'NDSHELF-01 自作0品（初回シード直後）でも同梱の基本レシピで上限まで埋まる',
        ndFreshIds.length === SHELF_MAX,
        `区画のカード=${ndFreshIds.length}品`,
      )
      const ndOverflow = await ndPage.evaluate(() => {
        const shelf = document.querySelector('[data-testid="recipe-shelf"] ul')
        return {
          pageScrollW: document.documentElement.scrollWidth,
          pageClientW: document.documentElement.clientWidth,
          shelfScrollable: !!shelf && shelf.scrollWidth > shelf.clientWidth,
        }
      })
      check(
        'NDSHELF-01 横にスクロールするのは区画の中だけ（ページ全体は390px幅で横にあふれない）',
        ndOverflow.pageScrollW <= ndOverflow.pageClientW && ndOverflow.shelfScrollable,
        JSON.stringify(ndOverflow),
      )

      // --- 前提づくり: 同梱3品を「自分で登録した品」に変え、作った記録で境目を作る。
      // 生のIndexedDBへ書くので、必ず読み込み直す（Dexieのライブ購読は生書き込みを見ていない） ---
      currentCheck = 'NDSHELF-02'
      const ndOwn = await ndPage.evaluate(
        ({ day15, day13 }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const all = store.getAll()
              all.onsuccess = () => {
                const rows = all.result.slice().sort((a, b) => a.id - b.id)
                if (rows.length < 3) {
                  reject(new Error(`レシピが${rows.length}品しか無い`))
                  return
                }
                // 3品を自作に変える: cooked15=15日前に作った / cooked13=13日前に作った /
                // never=一度も作っていない
                const [r15, r13, rNever] = rows
                store.put({ ...r15, isStarter: false, cookedLogs: [{ date: day15 }] })
                store.put({ ...r13, isStarter: false, cookedLogs: [{ date: day13 }] })
                store.put({ ...rNever, isStarter: false, cookedLogs: [] })
                tx.oncomplete = () =>
                  resolve({ cooked15: r15.id, cooked13: r13.id, never: rNever.id })
                tx.onerror = () => reject(tx.error)
              }
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { day15: ndDay(15), day13: ndDay(13) },
      )
      await ndPage.reload({ waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1500)

      // --- NDSHELF-02: 14日の境目・自作が先・並びは日替わりの種で決まる ---
      const ndIds = await ndShelfLinkIds()
      check(
        'NDSHELF-02 13日前に作った品は出ない（「最近作ってない」と同じ14日の境目の内側）',
        !ndIds.includes(ndOwn.cooked13),
        `区画=${JSON.stringify(ndIds)} 13日前=${ndOwn.cooked13}`,
      )
      check(
        'NDSHELF-02 自作が先: 1枚目=一度も作っていない自作、2枚目=15日前に作った自作',
        ndIds[0] === ndOwn.never && ndIds[1] === ndOwn.cooked15,
        `区画=${JSON.stringify(ndIds)} 自作=${JSON.stringify(ndOwn)}`,
      )
      check(
        'NDSHELF-02 残りは同梱の基本レシピで上限まで埋まる',
        ndIds.length === SHELF_MAX && ndIds.slice(2).length > 0,
        `区画のカード=${ndIds.length}品`,
      )
      // 期待値は実装と同じ関数＋同じ種から作る（E2E_FAKE_TODAYを当てた日はその日の種になる）
      const ndRows = await ndPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const all = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAll()
              all.onsuccess = () =>
                resolve(
                  all.result.map((r) => ({
                    id: r.id,
                    title: r.title,
                    isStarter: r.isStarter,
                    updatedAt: r.updatedAt,
                    // 写真(Blob)は evaluate の境界を越えられないので、要る形だけ写す
                    cookedLogs: (r.cookedLogs ?? []).map((log) => ({ date: log.date })),
                  })),
                )
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const ndExpectedToday = pickShelfRecipes(ndRows, shelfSeed()).map((r) => r.id)
      check(
        'NDSHELF-02 並びが「実装と同じ関数＋今日の種」の期待値と一致する（種が日付で効いている）',
        JSON.stringify(ndIds) === JSON.stringify(ndExpectedToday),
        `画面=${JSON.stringify(ndIds)} 期待=${JSON.stringify(ndExpectedToday)}`,
      )
      const ndTomorrow = ndDay(-1)
      const ndExpectedTomorrow = pickShelfRecipes(ndRows, ndTomorrow).map((r) => r.id)
      check(
        'NDSHELF-02 あすの種では並びが変わる（毎回同じ並びにならない）',
        ndExpectedTomorrow.join(',') !== ndIds.join(','),
        `今日=${ndIds.join(',')} あす(${ndTomorrow})=${ndExpectedTomorrow.join(',')}`,
      )
      await ndPage.reload({ waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1500)
      check(
        'NDSHELF-02 開き直しても同じ日のうちは並びが変わらない',
        JSON.stringify(await ndShelfLinkIds()) === JSON.stringify(ndIds),
        `開き直し後=${JSON.stringify(await ndShelfLinkIds())}`,
      )

      // --- NDSHELF-03: 検索中・選択モード中は消え、外すと戻る。0件なら見出しごと消える ---
      currentCheck = 'NDSHELF-03'
      const ndShelfCount = () => ndPage.locator('[data-testid="recipe-shelf"]').count()
      await ndPage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await ndPage.waitForTimeout(700)
      check('NDSHELF-03 検索中は区画ごと出さない', (await ndShelfCount()) === 0)
      await ndPage.getByPlaceholder(ja.search.placeholder).fill('')
      await ndPage.waitForTimeout(700)
      check('NDSHELF-03 検索をやめると区画が戻る', (await ndShelfCount()) === 1)
      await ndPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
      await ndPage.waitForTimeout(500)
      check('NDSHELF-03 選択モード中は区画ごと出さない（区画のカードは選べないため）', (await ndShelfCount()) === 0)
      await ndPage.getByTestId('selection-exit').click()
      await ndPage.waitForTimeout(500)
      check('NDSHELF-03 選択モードを抜けると区画が戻る', (await ndShelfCount()) === 1)

      // 並べ替え中も隠す(2026-09-05 オーナー実機FB「並び替え設定を変更したときに出ないようにしたい」。
      // 並べ替えた一覧の先頭に、並びと無関係な区画が挟まらないこと)
      await ndPage.locator(`button[aria-label="${ja.search.sortToggle}"]`).click()
      await ndPage.waitForTimeout(400)
      await ndPage.getByRole('button', { name: ja.search.sortKana, exact: true }).click()
      await ndPage.waitForTimeout(500)
      check('NDSHELF-03 並べ替え中は区画ごと出さない', (await ndShelfCount()) === 0)
      await ndPage.getByRole('button', { name: ja.search.sortUpdated, exact: true }).click()
      await ndPage.waitForTimeout(500)
      await ndPage.getByTestId('sort-panel-close').click()
      await ndPage.waitForTimeout(400)
      check('NDSHELF-03 並べ替えを既定に戻すと区画が戻る', (await ndShelfCount()) === 1)

      // 全品を「今日作った」状態にする → 該当0件 → 見出しごと消える（一覧そのものは残る）
      await ndPage.evaluate(
        (today) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const all = store.getAll()
              all.onsuccess = () => {
                for (const r of all.result) {
                  store.put({ ...r, cookedLogs: [...(r.cookedLogs ?? []), { date: today }] })
                }
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
        ndDay(0),
      )
      await ndPage.reload({ waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1500)
      const ndGridCount = await ndPage
        .locator('div.grid.grid-cols-2 a[href^="#/recipes/"]')
        .count()
      check(
        'NDSHELF-03 全部つい最近作った状態なら、見出しごと消える（空の区画を残さない）',
        (await ndShelfCount()) === 0 &&
          !stripZwspText(await ndPage.textContent('body')).includes(ja.recipes.shelfNotRecentTitle),
      )
      check(
        'NDSHELF-03 区画が消えても一覧そのものは今までどおり並ぶ',
        ndGridCount > 0,
        `一覧のカード=${ndGridCount}品`,
      )

      await ndCtx.close()
    } finally {
      await ndBrowser.close()
    }
  }
