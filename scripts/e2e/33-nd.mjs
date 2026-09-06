// ==========================================================================================
// 便ND（2026-09-05）→ 便NH（2026-09-06）: 献立の「日」の棚3段
// この中の節: NDSHELF-01, NDSHELF-02, NDSHELF-03, NDSHELF-04, NDSHELF-05
//
// オーナー原文「しばらく作っていない棚は、自分で登録したレシピが優先で出るようにする、
// 毎回同じ作っていないレシピが並ば内容にする、ようにしたい」（2026-09-05・区画を作ったとき）
// 「（棚は）何を作るのかサーっと探せるページ（＝献立の日）へ」「『最近作った』も同じ
// レシピ横スクロールにする」「各棚に、並び替え設定済みのレシピ一覧へのリンク」（2026-09-06）
//
// 測ること:
//  NDSHELF-01 初回シード直後: 「最近作っていないレシピ」が日タブに出て同梱で10品埋まる。
//             記録0件なら「最近作ったもの」は見出しごと出ない・在庫チップ0件なら在庫の棚も
//             出ない。棚は「今日なに作る？」の決めてもらうボタンより下。
//             棚の中だけが横にスクロールし、ページ全体は横にあふれない
//  NDSHELF-02 「最近作ったもの」は記録の新しい順（期待値は実装 pickRecentCookedShelfRecipes）。
//             14日の境目（13日前に作った品は「最近作っていない」に出ない）と自作が先。
//             **鎖の除外**: 15日前に作った品でも「最近作ったもの」に居るあいだは
//             「最近作っていない」に出ない＝同じ品はページ内の棚に1回だけ。
//             並びは実装と同じ関数＋同じ種（日替わり）の期待値と一致し、開き直しても変わらない。
//             日替わりの検証は E2E_FAKE_TODAY を2日分当てて走らせる（どちらの日でも
//             その日の期待値と一致する＝種が今日の日付で効いている。あわせて「あすの種」の
//             期待値が今日の並びと違うことも節の中で見る）
//  NDSHELF-03 全品を今日作った状態にすると「最近作っていない」は見出しごと消える
//             （「最近作ったもの」と日タブそのものは残る）
//  NDSHELF-04 在庫の棚: チップ0件では出ない・1件で現れ在庫の食材を使う品だけが並ぶ・
//             並びは実装の期待値と一致（鎖の除外込み）・同点なら自作が先頭・
//             3段の上下は 最近作った→最近作っていない→在庫・
//             在庫を全部「ない」に戻すと棚ごと消え、**day-suggest-draw の縦位置が動かない**
//             （棚を「今日なに作る？」より上に置き直すとここが赤くなる＝下見■6の3の見張り）
//  NDSHELF-05 「レシピ一覧で見る」リンク3本: 行き先の ?sort=・?dir= が棚と同じ物差し。
//             押すと一覧がその並びで開く（期待値は実装 sortResults から作る）
//
// 旧NDSHELF-03の「検索中・選択モード中・並べ替え中は消える」は落とした（日タブに
// その概念が無い。一覧側の出し分けは棚ごと撤去された＝ui-source-guards の NH-1 が見張る）。
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 文言は ja.ts から読む（禁じ手②）。並びの期待値は _shared.mjs 経由の実装そのものから作る。
// 曜日・月替わりの前提は置かない（日付は「今日からn日前」で組み立てる）。
// 生のIndexedDBへ書いたら必ず読み込み直す（禁じ手⑥）。
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
      await ndPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1800) // 初回シード完了待ち

      // 「今日からn日前」のYYYY-MM-DD。E2E_FAKE_TODAY があれば node 側の Date ごとずれている
      const ndDay = (daysAgo) => {
        const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        const p = (v) => String(v).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }
      // 棚のカードのレシピ番号（data-shelf で棚を選ぶ。日タブには3つの棚が並ぶため）
      const ndShelfLinkIds = (shelf) =>
        ndPage.evaluate(
          (sel) =>
            Array.from(
              document.querySelectorAll(
                `[data-testid="recipe-shelf"][data-shelf="${sel}"] ul a[href^="#/recipes/"]`,
              ),
            ).map((a) => Number((a.getAttribute('href') ?? '').split('/').pop())),
          shelf,
        )
      const ndShelfCount = (shelf) =>
        ndPage.locator(`[data-testid="recipe-shelf"][data-shelf="${shelf}"]`).count()

      // --- NDSHELF-01: 初回シード直後の日タブ ---
      const ndBody1 = stripZwspText(await ndPage.textContent('body'))
      check(
        'NDSHELF-01 日タブに「最近作っていないレシピ」の見出しが出る',
        ndBody1.includes(ja.recipes.shelfNotRecentTitle),
      )
      check(
        'NDSHELF-01 記録が1件も無いうちは「最近作ったもの」は見出しごと出ない',
        (await ndShelfCount('recent-cooked')) === 0 && !ndBody1.includes(ja.dayStart.historyTitle),
      )
      check(
        'NDSHELF-01 在庫チップ0件（初回シード直後）なら在庫の棚も出ない',
        (await ndShelfCount('pantry')) === 0 && !ndBody1.includes(ja.recipes.shelfPantryTitle),
      )
      const ndFreshIds = await ndShelfLinkIds('not-recent')
      check(
        'NDSHELF-01 自作0品（初回シード直後）でも同梱の基本レシピで上限まで埋まる',
        ndFreshIds.length === SHELF_MAX,
        `棚のカード=${ndFreshIds.length}品`,
      )
      // 棚は「今日なに作る？」の決めてもらうボタンより下（便HTの誤タップ対策を壊さない）
      const ndDrawBox = await ndPage.locator('[data-testid="day-suggest-draw"]').boundingBox()
      const ndShelfBox = await ndPage
        .locator('[data-testid="recipe-shelf"][data-shelf="not-recent"]')
        .boundingBox()
      check(
        'NDSHELF-01 棚は「今日なに作る？」の決めてもらうボタンより下にある',
        ndDrawBox != null && ndShelfBox != null && ndShelfBox.y > ndDrawBox.y,
        `ボタンy=${ndDrawBox ? Math.round(ndDrawBox.y) : '無し'} 棚y=${ndShelfBox ? Math.round(ndShelfBox.y) : '無し'}`,
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
        'NDSHELF-01 横にスクロールするのは棚の中だけ（ページ全体は390px幅で横にあふれない）',
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
      const ndReadRows = () =>
        ndPage.evaluate(
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
      const ndRows = await ndReadRows()

      // --- NDSHELF-02: 「最近作ったもの」は記録の新しい順（実装の期待値と一致） ---
      const ndRecentIds = await ndShelfLinkIds('recent-cooked')
      const ndRecentExpected = pickRecentCookedShelfRecipes(ndRows).map((r) => r.id)
      check(
        'NDSHELF-02 「最近作ったもの」が現れ、並びは実装の期待値（記録の新しい順）と一致する',
        ndRecentIds.length > 0 && JSON.stringify(ndRecentIds) === JSON.stringify(ndRecentExpected),
        `画面=${JSON.stringify(ndRecentIds)} 期待=${JSON.stringify(ndRecentExpected)}`,
      )
      check(
        'NDSHELF-02 13日前より15日前が後ろ（新しい順）',
        ndRecentIds[0] === ndOwn.cooked13 && ndRecentIds[1] === ndOwn.cooked15,
        `棚=${JSON.stringify(ndRecentIds)} 13日前=${ndOwn.cooked13} 15日前=${ndOwn.cooked15}`,
      )

      // --- NDSHELF-02: 「最近作っていない」の14日の境目・鎖の除外・自作が先・種 ---
      const ndIds = await ndShelfLinkIds('not-recent')
      check(
        'NDSHELF-02 13日前に作った品は出ない（「最近作ってない」と同じ14日の境目の内側）',
        !ndIds.includes(ndOwn.cooked13),
        `棚=${JSON.stringify(ndIds)} 13日前=${ndOwn.cooked13}`,
      )
      check(
        'NDSHELF-02 15日前の品も「最近作ったもの」に居るあいだは出ない（同じ品はページ内の棚に1回だけ）',
        !ndIds.includes(ndOwn.cooked15),
        `棚=${JSON.stringify(ndIds)} 15日前=${ndOwn.cooked15}`,
      )
      check(
        'NDSHELF-02 自作が先: 1枚目=一度も作っていない自作',
        ndIds[0] === ndOwn.never,
        `棚=${JSON.stringify(ndIds)} 自作=${JSON.stringify(ndOwn)}`,
      )
      check(
        'NDSHELF-02 残りは同梱の基本レシピで上限まで埋まる',
        ndIds.length === SHELF_MAX && ndIds.slice(1).length > 0,
        `棚のカード=${ndIds.length}品`,
      )
      // 期待値は実装と同じ関数＋同じ種＋同じ鎖の除外から作る
      // （E2E_FAKE_TODAYを当てた日はその日の種になる）
      const ndExpectedToday = pickShelfRecipes(ndRows, shelfSeed(), new Set(ndRecentExpected)).map(
        (r) => r.id,
      )
      check(
        'NDSHELF-02 並びが「実装と同じ関数＋今日の種」の期待値と一致する（種が日付で効いている）',
        JSON.stringify(ndIds) === JSON.stringify(ndExpectedToday),
        `画面=${JSON.stringify(ndIds)} 期待=${JSON.stringify(ndExpectedToday)}`,
      )
      const ndTomorrow = ndDay(-1)
      const ndExpectedTomorrow = pickShelfRecipes(ndRows, ndTomorrow, new Set(ndRecentExpected)).map(
        (r) => r.id,
      )
      check(
        'NDSHELF-02 あすの種では並びが変わる（毎回同じ並びにならない）',
        ndExpectedTomorrow.join(',') !== ndIds.join(','),
        `今日=${ndIds.join(',')} あす(${ndTomorrow})=${ndExpectedTomorrow.join(',')}`,
      )
      await ndPage.reload({ waitUntil: 'networkidle' })
      await ndPage.waitForTimeout(1500)
      check(
        'NDSHELF-02 開き直しても同じ日のうちは並びが変わらない',
        JSON.stringify(await ndShelfLinkIds('not-recent')) === JSON.stringify(ndIds),
        `開き直し後=${JSON.stringify(await ndShelfLinkIds('not-recent'))}`,
      )
      // ページ内の全棚から番号を集め、同じ品が2回出ていないことを見る
      // （鎖の除外＝excludeIds を外すとここが赤くなる。壊して実測済み）
      const ndAllIds = await ndPage.evaluate(() =>
        Array.from(
          document.querySelectorAll('[data-testid="recipe-shelf"] ul a[href^="#/recipes/"]'),
        ).map((a) => Number((a.getAttribute('href') ?? '').split('/').pop())),
      )
      check(
        'NDSHELF-02 同じ品はページ内の棚に1回だけ（全棚を通して重複が無い）',
        new Set(ndAllIds).size === ndAllIds.length,
        `全棚=${JSON.stringify(ndAllIds)}`,
      )

      // --- NDSHELF-03: 全品を「今日作った」状態 → 「最近作っていない」だけ見出しごと消える ---
      currentCheck = 'NDSHELF-03'
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
      check(
        'NDSHELF-03 全部つい最近作った状態なら「最近作っていない」は見出しごと消える（空の棚を残さない）',
        (await ndShelfCount('not-recent')) === 0 &&
          !stripZwspText(await ndPage.textContent('body')).includes(ja.recipes.shelfNotRecentTitle),
      )
      check(
        'NDSHELF-03 「最近作ったもの」は今日作った品で埋まったまま残る',
        (await ndShelfLinkIds('recent-cooked')).length === RECENT_SHELF_MAX,
        `棚のカード=${(await ndShelfLinkIds('recent-cooked')).length}品`,
      )
      check(
        'NDSHELF-03 棚が消えても日タブそのもの（「今日なに作る？」）は今までどおり',
        (await ndPage.locator('[data-testid="day-suggest-draw"]').count()) === 1,
      )

      await ndCtx.close()
    } finally {
      await ndBrowser.close()
    }
  }

  // ==========================================================================================
  // NDSHELF-04（2026-09-05 便NF → 2026-09-06 便NH で日タブへ）: 在庫の棚と3段の形
  // NDSHELF-05: 「レシピ一覧で見る」リンク3本
  //
  // 自前のブラウザ・新しいcontext（＝初回シードから始める）。文言は ja.ts から読む（禁じ手②）。
  // 生のIndexedDBへ書いたら必ず読み込み直す（禁じ手⑥: Dexieのライブ購読は生書き込みを見ていない）。
  // ==========================================================================================
  currentCheck = 'NDSHELF-04'
  {
    // 棚の並び順と「レシピ一覧で見る」の行き先（実装 MealPlanPage.tsx の listHref と同じ値。
    // 判定側でも掴む側でもなく「行き先の約束」そのものなので、ここに1回だけ書く。
    // ※節の塊の中に置くこと: e2e-part は塊単位で切り出すので、外に出すと単独実行で落ちる
    const ND_SHELF_ORDER = ['recent-cooked', 'not-recent', 'pantry']
    const ND_LIST_HREFS = {
      'recent-cooked': '#/recipes?sort=recentCooked&dir=desc',
      'not-recent': '#/recipes?sort=recentCooked&dir=asc',
      pantry: '#/recipes?sort=pantryMatch&dir=desc',
    }
    const nfBrowser = await chromium.launch()
    try {
      const nfCtx = await nfBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const nfPage = await nfCtx.newPage()
      nfPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await nfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1800) // 初回シード完了待ち

      const nfShelfSel = (shelf) => `[data-testid="recipe-shelf"][data-shelf="${shelf}"]`
      const nfShelfCount = (shelf) => nfPage.locator(nfShelfSel(shelf)).count()
      const nfShelfLinkIds = (shelf) =>
        nfPage.evaluate(
          (sel) =>
            Array.from(document.querySelectorAll(`${sel} ul a[href^="#/recipes/"]`)).map((a) =>
              Number((a.getAttribute('href') ?? '').split('/').pop()),
            ),
          nfShelfSel(shelf),
        )
      // 「今日からn日前」のYYYY-MM-DD（上のブロックのndDayは別スコープなので同じ形で持つ）
      const nfDay = (daysAgo) => {
        const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        const p = (v) => String(v).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      }
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
      // 3つの棚の期待値を実装の関数から「鎖の除外」込みで作る（画面と同じ組み立て方）
      const nfExpectedShelves = (rows) => {
        const names = pantryAvailableNames(rows.pantry)
        const recent = pickRecentCookedShelfRecipes(rows.recipes).map((r) => r.id)
        const notRecent = pickShelfRecipes(rows.recipes, shelfSeed(), new Set(recent)).map(
          (r) => r.id,
        )
        const pantry = pickPantryShelfRecipes(
          rows.recipes,
          names,
          shelfSeed(),
          new Set([...recent, ...notRecent]),
        ).map((r) => r.id)
        return { names, recent, notRecent, pantry }
      }

      // --- 初回シード直後(在庫12件すべて「ない」)は在庫の棚ごと出ない ---
      check(
        'NDSHELF-04 初回シード直後(在庫チップ0件)は在庫の棚ごと出ない＝新規ユーザーには出ない',
        (await nfShelfCount('pantry')) === 0 &&
          !stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )

      // --- 前提づくり: 同梱5品に1〜5日前の記録を付けて「最近作ったもの」を5品で埋める。
      // 在庫の棚の「同点なら自作が先頭」を、鎖の除外に吸い上げられずに測るため
      // （記録が5件より少ないと、どんな記録を付けた品も「最近作ったもの」に入ってしまう） ---
      await nfPage.evaluate(
        (days) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const all = store.getAll()
              all.onsuccess = () => {
                const rows = all.result.slice().sort((a, b) => a.id - b.id)
                rows.slice(0, days.length).forEach((r, i) => {
                  store.put({ ...r, cookedLogs: [{ date: days[i] }] })
                })
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
        [nfDay(1), nfDay(2), nfDay(3), nfDay(4), nfDay(5)],
      )

      // --- 卵を「ある」にすると在庫の棚が現れる ---
      await nfSetPantry({ 卵: 'have' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      check(
        'NDSHELF-04 在庫を1件「ある」にすると「在庫の食材を使うレシピ」の棚が現れる',
        (await nfShelfCount('pantry')) === 1 &&
          stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )
      const nfIds1 = await nfShelfLinkIds('pantry')
      const nfRows1 = await nfReadRows()
      const nfExp1 = nfExpectedShelves(nfRows1)
      check(
        'NDSHELF-04 在庫あり扱いは「ある」の1件だけ(あとは全部「ない」のまま)',
        JSON.stringify(nfExp1.names) === JSON.stringify(['卵']),
        `在庫あり=${JSON.stringify(nfExp1.names)}`,
      )
      // 「在庫の食材を使う品だけ」を実装の判定器そのもの(makePantryMatcher)で確かめる
      const nfMatches1 = makePantryMatcher(nfExp1.names)
      const nfById = new Map(nfRows1.recipes.map((r) => [r.id, r]))
      check(
        'NDSHELF-04 並ぶのは在庫の食材を使う品だけ(判定は実装のmakePantryMatcher。空のまま合格に倒れない)',
        nfIds1.length > 0 &&
          nfIds1.every((id) => {
            const r = nfById.get(id)
            return !!r && r.ingredients.some((i) => nfMatches1(i.name))
          }),
        `棚=${JSON.stringify(nfIds1)}`,
      )
      check(
        'NDSHELF-04 並びが「実装と同じ関数＋今日の種＋鎖の除外」の期待値と一致する',
        JSON.stringify(nfIds1) === JSON.stringify(nfExp1.pantry),
        `画面=${JSON.stringify(nfIds1)} 期待=${JSON.stringify(nfExp1.pantry)}`,
      )

      // --- 3段の上下: 最近作った → 最近作っていない → 在庫 ---
      const nfShelfOrder = await nfPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipe-shelf"]')).map((el) =>
          el.getAttribute('data-shelf'),
        ),
      )
      check(
        'NDSHELF-04 棚は3段で、上から 最近作った→最近作っていない→在庫 の順',
        JSON.stringify(nfShelfOrder) === JSON.stringify(ND_SHELF_ORDER),
        `並び=${JSON.stringify(nfShelfOrder)}`,
      )

      // --- 同点(全品1チップ一致)なら自作が先頭 ---
      // 候補（卵を使う品）のうち、いまどの棚にも出ていない品を1つ選び、自作に変えて
      // 「10日前に作った」記録を付ける。10日前は
      //  ・「最近作ったもの」には入らない（1〜5日前の5品のほうが新しい）
      //  ・「最近作っていない」からも外れる（14日の境目の内側）
      // ＝鎖の除外に吸い上げられず在庫の棚に残る（在庫の棚は最近作ったかを見ない証明を兼ねる）
      const nfCandidates = nfRows1.recipes
        .filter((r) => r.ingredients.some((i) => nfMatches1(i.name)))
        .map((r) => r.id)
      const nfOwnId =
        nfCandidates.find(
          (id) =>
            !nfExp1.recent.includes(id) && !nfExp1.notRecent.includes(id) && !nfIds1.includes(id),
        ) ?? nfIds1.at(-1)
      await nfPage.evaluate(
        ([ownId, tenDaysAgo]) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const one = store.get(ownId)
              one.onsuccess = () => {
                store.put({
                  ...one.result,
                  isStarter: false,
                  cookedLogs: [{ date: tenDaysAgo }],
                })
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              one.onerror = () => reject(one.error)
            }
            req.onerror = () => reject(req.error)
          }),
        [nfOwnId, nfDay(10)],
      )
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      const nfIds2 = await nfShelfLinkIds('pantry')
      check(
        'NDSHELF-04 同点(全品1チップ一致)なら自作が先頭(10日前に作った自作の品が1枚目に上がる)',
        nfIds2[0] === nfOwnId,
        `棚=${JSON.stringify(nfIds2)} 自作にした品=${nfOwnId}`,
      )

      // --- チップ2件でも並びは実装の期待値と一致(在庫との一致が多い順・鎖の除外込み) ---
      await nfSetPantry({ 玉ねぎ: 'have' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      const nfIds3 = await nfShelfLinkIds('pantry')
      const nfRows3 = await nfReadRows()
      const nfExp3 = nfExpectedShelves(nfRows3)
      check(
        'NDSHELF-04 チップ2件(卵・玉ねぎ)でも並びが実装の期待値と一致(一致が多い品が先)',
        nfExp3.names.length === 2 && JSON.stringify(nfIds3) === JSON.stringify(nfExp3.pantry),
        `画面=${JSON.stringify(nfIds3)} 期待=${JSON.stringify(nfExp3.pantry)} 在庫=${JSON.stringify(nfExp3.names)}`,
      )

      // --- NDSHELF-05: 「レシピ一覧で見る」リンク3本（3つの棚が全部出ているこの状態で見る） ---
      currentCheck = 'NDSHELF-05'
      for (const shelf of ND_SHELF_ORDER) {
        const nfLink = nfPage.locator(`${nfShelfSel(shelf)} a[href="${ND_LIST_HREFS[shelf]}"]`)
        check(
          `NDSHELF-05 ${shelf} の棚に「レシピ一覧で見る」があり、行き先の並び替えが棚と同じ物差し`,
          (await nfLink.count()) === 1 &&
            stripZwspText(await nfLink.textContent()).includes(ja.recipes.shelfListLink),
          `href待ち=${ND_LIST_HREFS[shelf]} 本数=${await nfLink.count()}`,
        )
      }
      // 「最近作っていない」のリンクを押す → 一覧が「最近作った順・古い順」で開く。
      // 期待値は実装の sortResults そのもの（並べ方をここに書き写さない）。
      // dir=asc は既定(desc)と逆向き＝URLの ?dir= が効いていることの証明にもなる
      await nfPage.locator(`${nfShelfSel('not-recent')} a[href="${ND_LIST_HREFS['not-recent']}"]`).click()
      await nfPage.waitForTimeout(1500)
      const nfGridIds = await nfPage.evaluate(() =>
        Array.from(document.querySelectorAll('div.grid.grid-cols-2 a[href^="#/recipes/"]'))
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => /^#\/recipes\/\d+$/.test(href))
          .map((href) => Number(href.split('/').pop())),
      )
      // 一覧の入力と同じ土台の並びにしてから実装の sortResults へ渡す。
      // アプリの一覧は db.recipes.orderBy('updatedAt').reverse()（src/db/recipes.ts）＝
      // 更新が新しい順・同点はid降順で受け取り、sortResults は安定ソートなので
      // 同点（記録なしどうし等）は土台の順が残る。土台を合わせないと同点だけ食い違う
      const nfBase = nfRows3.recipes
        .slice()
        .sort((a, b) => b.updatedAt - a.updatedAt || b.id - a.id)
      const nfSorted = sortResults(
        nfBase.map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 })),
        'recentCooked',
        [],
        'asc',
      ).map((r) => r.recipe.id)
      check(
        'NDSHELF-05 押すと一覧が「最近作った順・古い順」で開く（並びは実装のsortResultsと一致）',
        nfGridIds.length > 0 && JSON.stringify(nfGridIds) === JSON.stringify(nfSorted),
        `画面=${JSON.stringify(nfGridIds.slice(0, 6))}… 期待=${JSON.stringify(nfSorted.slice(0, 6))}…`,
      )
      // 先頭は「作った記録がいちばん古い品」（判定は実装の lastCookedDate から）
      const nfOldest = nfRows3.recipes
        .filter((r) => lastCookedDate(r) !== null)
        .sort((a, b) => (lastCookedDate(a) < lastCookedDate(b) ? -1 : 1))[0]
      check(
        'NDSHELF-05 先頭は作った記録がいちばん古い品（一度も作っていない品は末尾側）',
        nfGridIds[0] === nfOldest.id,
        `先頭=${nfGridIds[0]} 期待=${nfOldest.id}`,
      )
      check(
        'NDSHELF-05 一度きりの指示なので ?sort=・?dir= はURLから消える',
        !nfPage.url().includes('sort='),
        `URL=${nfPage.url()}`,
      )
      // 日タブへ戻る（以降の在庫の検査は日タブで測る）
      await nfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1200)

      // --- 在庫を全部「ない」に戻すと棚ごと消える。day-suggest-draw の縦位置は動かない ---
      currentCheck = 'NDSHELF-04'
      const nfDrawBefore = await nfPage.locator('[data-testid="day-suggest-draw"]').boundingBox()
      await nfSetPantry({ '*': 'none' })
      await nfPage.reload({ waitUntil: 'networkidle' })
      await nfPage.waitForTimeout(1500)
      check(
        'NDSHELF-04 在庫を全部「ない」にすると棚ごと消える(空の見出しを残さない)',
        (await nfShelfCount('pantry')) === 0 &&
          !stripZwspText(await nfPage.textContent('body')).includes(ja.recipes.shelfPantryTitle),
      )
      check(
        'NDSHELF-04 在庫の棚が消えても「最近作ったもの」「最近作っていない」は残る',
        (await nfShelfCount('recent-cooked')) === 1 && (await nfShelfCount('not-recent')) === 1,
      )
      // 棚の出入りで「決めてもらう」ボタンが動かない（棚を「今日なに作る？」より上へ
      // 置き直すとここが赤くなる。便HTの誤タップ対策＝DAYPLANFILTER-01と同じ物差し）
      const nfDrawAfter = await nfPage.locator('[data-testid="day-suggest-draw"]').boundingBox()
      check(
        'NDSHELF-04 在庫の棚が出入りしても day-suggest-draw の縦位置が動かない',
        nfDrawBefore != null &&
          nfDrawAfter != null &&
          Math.abs(nfDrawBefore.y - nfDrawAfter.y) < 1,
        `前y=${nfDrawBefore ? Math.round(nfDrawBefore.y) : '無し'} 後y=${nfDrawAfter ? Math.round(nfDrawAfter.y) : '無し'}`,
      )

      await nfCtx.close()
    } finally {
      await nfBrowser.close()
    }
  }
