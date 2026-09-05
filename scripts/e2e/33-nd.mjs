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
      // data-shelf="not-recent" で限定する(2026-09-05 便NF): 区画が2つになったので、
      // data-testid="recipe-shelf" だけだと在庫の区画のカードまで数えてしまう
      const ndShelfLinkIds = () =>
        ndPage.evaluate(() =>
          Array.from(
            document.querySelectorAll(
              '[data-testid="recipe-shelf"][data-shelf="not-recent"] a[href^="#/recipes/"]',
            ),
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
      const ndShelfCount = () =>
        ndPage.locator('[data-testid="recipe-shelf"][data-shelf="not-recent"]').count()
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

  // ==========================================================================================
  // NDSHELF-04（2026-09-05 便NF）: 2つ目の区画「在庫の食材を使うレシピ」
  //
  // 測ること:
  //  ・初回シード直後（在庫12件すべて「ない」＝チップ0件）は区画ごと出ない＝新規ユーザーには出ない
  //  ・在庫を1件「ある」にすると区画が現れ、在庫の食材を使う品**だけ**が並ぶ（判定は実装の
  //    makePantryMatcher から読む＝生きた区画の証明）
  //  ・並びは実装と同じ関数＋同じ種（pickPantryShelfRecipes・shelfSeed）の期待値と一致
  //  ・同点（全品1チップ一致）なら自作が先頭
  //  ・チップ2件でも並びが実装の期待値と一致（在庫との一致が多い順）
  //  ・2区画の上下: 「最近作っていない」が上・在庫が下
  //  ・在庫を全部「ない」に戻すと区画ごと消える（上の区画と一覧は残る）
  //
  // 自前のブラウザ・新しいcontext（＝初回シードから始める）。文言は ja.ts から読む（禁じ手②）。
  // 生のIndexedDBへ書いたら必ず読み込み直す（禁じ手⑥: Dexieのライブ購読は生書き込みを見ていない）。
  // ==========================================================================================
  currentCheck = 'NDSHELF-04'
  {
    const nfBrowser = await chromium.launch()
    try {
      const nfCtx = await nfBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const nfPage = await nfCtx.newPage()
      nfPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await nfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1800) // 初回シード完了待ち

      const nfShelfSel = '[data-testid="recipe-shelf"][data-shelf="pantry"]'
      const nfShelfCount = () => nfPage.locator(nfShelfSel).count()
      const nfShelfLinkIds = () =>
        nfPage.evaluate(
          (sel) =>
            Array.from(document.querySelectorAll(`${sel} a[href^="#/recipes/"]`)).map((a) =>
              Number((a.getAttribute('href') ?? '').split('/').pop()),
            ),
          nfShelfSel,
        )
      // 在庫チップの状態を書き換える(生のIndexedDB。呼んだら必ず読み込み直すこと)
      const nfSetPantry = (updates) =>
        nfPage.evaluate(
          (pairs) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction('pantryItems', 'readwrite')
                const store = tx.objectStore('pantryItems')
                const all = store.getAll()
                all.onsuccess = () => {
                  for (const item of all.result) {
                    const level = pairs[item.name] ?? (pairs['*'] || null)
                    if (level) store.put({ ...item, level })
                  }
                  tx.oncomplete = () => resolve(undefined)
                  tx.onerror = () => reject(tx.error)
                }
                all.onerror = () => reject(all.error)
              }
              req.onerror = () => reject(req.error)
            }),
          updates,
        )
      // レシピと在庫を「期待値づくりに要る形」で写す(写真Blobはevaluateの境界を越えられない)
      const nfReadRows = () =>
        nfPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['recipes', 'pantryItems'], 'readonly')
                const recipesReq = tx.objectStore('recipes').getAll()
                const pantryReq = tx.objectStore('pantryItems').getAll()
                tx.oncomplete = () =>
                  resolve({
                    recipes: recipesReq.result.map((r) => ({
                      id: r.id,
                      title: r.title,
                      isStarter: r.isStarter,
                      updatedAt: r.updatedAt,
                      ingredients: (r.ingredients ?? []).map((i) => ({
                        name: i.name,
                        amount: i.amount,
                        unit: i.unit,
                      })),
                      cookedLogs: (r.cookedLogs ?? []).map((log) => ({ date: log.date })),
                    })),
                    pantry: pantryReq.result.map((p) => ({ name: p.name, level: p.level })),
                  })
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // --- 初回シード直後(在庫12件すべて「ない」)は区画ごと出ない ---
      check(
        'NDSHELF-04 初回シード直後(在庫チップ0件)は在庫の区画ごと出ない＝新規ユーザーには出ない',
        (await nfShelfCount()) === 0 &&
          !stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )

      // --- 卵を「ある」にすると区画が現れる ---
      await nfSetPantry({ 卵: 'have' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      check(
        'NDSHELF-04 在庫を1件「ある」にすると「在庫の食材を使うレシピ」の区画が現れる',
        (await nfShelfCount()) === 1 &&
          stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )
      const nfIds1 = await nfShelfLinkIds()
      const nfRows1 = await nfReadRows()
      const nfNames1 = pantryAvailableNames(nfRows1.pantry)
      check(
        'NDSHELF-04 在庫あり扱いは「ある」の1件だけ(あとは全部「ない」のまま)',
        JSON.stringify(nfNames1) === JSON.stringify(['卵']),
        `在庫あり=${JSON.stringify(nfNames1)}`,
      )
      // 「在庫の食材を使う品だけ」を実装の判定器そのもの(makePantryMatcher)で確かめる
      const nfMatches1 = makePantryMatcher(nfNames1)
      const nfById = new Map(nfRows1.recipes.map((r) => [r.id, r]))
      check(
        'NDSHELF-04 並ぶのは在庫の食材を使う品だけ(判定は実装のmakePantryMatcher。空のまま合格に倒れない)',
        nfIds1.length > 0 &&
          nfIds1.every((id) => {
            const r = nfById.get(id)
            return !!r && r.ingredients.some((i) => nfMatches1(i.name))
          }),
        `区画=${JSON.stringify(nfIds1)}`,
      )
      const nfExpected1 = pickPantryShelfRecipes(nfRows1.recipes, nfNames1, shelfSeed()).map(
        (r) => r.id,
      )
      check(
        'NDSHELF-04 並びが「実装と同じ関数＋今日の種」の期待値と一致する',
        JSON.stringify(nfIds1) === JSON.stringify(nfExpected1),
        `画面=${JSON.stringify(nfIds1)} 期待=${JSON.stringify(nfExpected1)}`,
      )

      // --- 2区画の上下: 「最近作っていない」が上・在庫が下 ---
      const nfShelfOrder = await nfPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipe-shelf"]')).map((el) =>
          el.getAttribute('data-shelf'),
        ),
      )
      check(
        'NDSHELF-04 区画は2つで、上=「最近作っていない」・下=在庫の順',
        JSON.stringify(nfShelfOrder) === JSON.stringify(['not-recent', 'pantry']),
        `並び=${JSON.stringify(nfShelfOrder)}`,
      )

      // --- 同点(全品1チップ一致)なら自作が先頭: 候補のうち区画に出ていない品を自作に変える ---
      const nfCandidates = nfRows1.recipes
        .filter((r) => r.ingredients.some((i) => nfMatches1(i.name)))
        .map((r) => r.id)
      const nfOwnId = nfCandidates.find((id) => !nfIds1.includes(id)) ?? nfIds1.at(-1)
      await nfPage.evaluate(
        (ownId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const one = store.get(ownId)
              one.onsuccess = () => {
                store.put({ ...one.result, isStarter: false })
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              one.onerror = () => reject(one.error)
            }
            req.onerror = () => reject(req.error)
          }),
        nfOwnId,
      )
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      const nfIds2 = await nfShelfLinkIds()
      check(
        'NDSHELF-04 同点(全品1チップ一致)なら自作が先頭(候補外だった品が自作になると1枚目に上がる)',
        nfIds2[0] === nfOwnId,
        `区画=${JSON.stringify(nfIds2)} 自作にした品=${nfOwnId}`,
      )

      // --- チップ2件でも並びは実装の期待値と一致(在庫との一致が多い順) ---
      await nfSetPantry({ 玉ねぎ: 'have' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      const nfIds3 = await nfShelfLinkIds()
      const nfRows3 = await nfReadRows()
      const nfNames3 = pantryAvailableNames(nfRows3.pantry)
      const nfExpected3 = pickPantryShelfRecipes(nfRows3.recipes, nfNames3, shelfSeed()).map(
        (r) => r.id,
      )
      check(
        'NDSHELF-04 チップ2件(卵・玉ねぎ)でも並びが実装の期待値と一致(一致が多い品が先)',
        nfNames3.length === 2 && JSON.stringify(nfIds3) === JSON.stringify(nfExpected3),
        `画面=${JSON.stringify(nfIds3)} 期待=${JSON.stringify(nfExpected3)} 在庫=${JSON.stringify(nfNames3)}`,
      )

      // --- 在庫を全部「ない」に戻すと区画ごと消える(上の区画と一覧は残る) ---
      await nfSetPantry({ '*': 'none' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      const nfGridCount = await nfPage
        .locator('div.grid.grid-cols-2 a[href^="#/recipes/"]')
        .count()
      check(
        'NDSHELF-04 在庫を全部「ない」にすると区画ごと消える(空の見出しを残さない)',
        (await nfShelfCount()) === 0 &&
          !stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )
      check(
        'NDSHELF-04 在庫の区画が消えても「最近作っていない」の区画と一覧は残る',
        (await nfPage.locator('[data-testid="recipe-shelf"][data-shelf="not-recent"]').count()) ===
          1 && nfGridCount > 0,
        `一覧のカード=${nfGridCount}品`,
      )

      await nfCtx.close()
    } finally {
      await nfBrowser.close()
    }
  }
