// ==========================================================================================
// e2e の節: 献立の枠と窓・買い物の範囲・食数
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
// この中の節: MEALPLAN-09, SLOTWIN-01, PASTLOG-01, MEALPLAN-07, RANGE-EA, MEALPLAN-S1S2, MEALPLAN-S3, MEALPLAN-SERV, SHOPRANGE-EA, MEALPLAN-HOUSE
// ==========================================================================================
import './_shared.mjs'


  // --- MEALPLAN-09: 便BH-2の新仕様を決定的に検証する(docs/56)。
  //  (A) 一品もの(カレー)の主菜を手動で入れた枠は、まとめて献立でも副菜を足さない(1品で完結) /
  //  (B) 主菜と副菜のジャンルが食い違う枠には「ジャンル混在」バッジが控えめに出る ---
  currentCheck = 'MEALPLAN-09'
  {
    const mp9Browser = await chromium.launch()
    const mp9Context = await mp9Browser.newContext()
    const mp9Page = await mp9Context.newPage()
    mp9Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-09] ${text}`)
    })
    mp9Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-09] ${err.message}`)
    })
    try {
      // 「先頭の未定」の行にレシピを手動割り当てするヘルパー(ピッカーで検索して選ぶ)
      // 2026-08-22 便IV: 空き枠は編集モードの中にしか出さない。**どの日に入れるかを渡す**
      // （編集モードは一度に1日だけなので、「画面の先頭の空き枠」では日をまたげない）
      const assign = async (date, title) => {
        const edited = await openWeekDayEdit(mp9Page, date)
        check(`MEALPLAN-09 前提: ${date} を編集モードにできた（便IV）`, edited === true)
        await mp9Page
          .locator(`section[data-date="${date}"]`)
          .getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true })
          .first()
          .click()
        await mp9Page.waitForTimeout(400)
        await mp9Page.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill(title)
        await mp9Page.waitForTimeout(300)
        await mp9Page.getByText(title, { exact: true }).first().click()
        await mp9Page.waitForTimeout(400)
      }

      await mp9Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp9Page.waitForTimeout(1800)
      await mp9Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mp9Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp9Page.waitForTimeout(300)
      // 全日程を未来日にする(MEALPLAN-03/04/08と同じ理由)
      await mp9Page.locator('button[aria-label="次の週"]').click()
      await openAllWeekDays(mp9Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp9Page.waitForTimeout(300)

      // (B) 月曜: 主菜=肉じゃが(和食)→副菜=ポテトサラダ(洋食)を手動で入れる(ジャンルが食い違う)。
      // 先頭の未定=月曜の主菜、次の先頭の未定=月曜の副菜(主菜が埋まると副菜が先頭になる)
      const mp9Dates = await mp9Page.evaluate(() =>
        [...document.querySelectorAll('section[data-date]')].map((el) => el.getAttribute('data-date')),
      )
      check('MEALPLAN-09 前提: 次の週の7日分が出ている', mp9Dates.length === 7, JSON.stringify(mp9Dates))
      await assign(mp9Dates[0], '肉じゃが')
      await assign(mp9Dates[0], 'ポテトサラダ')
      check(
        // 2026-07-30 便CH/C12: バッジ文言を平易な「主菜と別ジャンル」に変えた
        'MEALPLAN-09(B) 主菜(和食)と副菜(洋食)が食い違う枠に「主菜と別ジャンル」バッジが出る',
        (await mp9Page.getByText(ja.mealPlan.genreMixedBadge, { exact: true }).count()) >= 1,
      )

      // (A) 火曜: 主菜=カレーライス(一品もの)を手動で入れる(次の先頭の未定=火曜の主菜)
      await assign(mp9Dates[1], 'カレーライス')
      await mp9Page.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await mp9Page.waitForTimeout(1200)

      // カレーの入った枠(date)に副菜行が無いことをIndexedDBで確認
      const rows = await mp9Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
              const mpReq = tx.objectStore('mealPlans').getAll()
              const rcReq = tx.objectStore('recipes').getAll()
              let mp, rc
              const done = () => {
                if (mp === undefined || rc === undefined) return
                const titleById = new Map(rc.map((r) => [r.id, r.title]))
                resolve(
                  mp
                    .filter((r) => r.slot === 'dinner')
                    .map((r) => ({ date: r.date, role: r.role, title: titleById.get(r.recipeId) })),
                )
              }
              mpReq.onsuccess = () => {
                mp = mpReq.result
                done()
              }
              rcReq.onsuccess = () => {
                rc = rcReq.result
                done()
              }
              mpReq.onerror = () => reject(mpReq.error)
              rcReq.onerror = () => reject(rcReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const curryRow = rows.find((r) => r.title === 'カレーライス')
      const curryDate = curryRow?.date
      const sidesOnCurryDay = rows.filter((r) => r.date === curryDate && r.role === 'side')
      check(
        'MEALPLAN-09(A) 一品もの(カレー)の主菜を入れた枠には、まとめて献立でも副菜が足されない',
        !!curryRow && sidesOnCurryDay.length === 0,
        `curryDate=${curryDate} sides=${JSON.stringify(sidesOnCurryDay)}`,
      )
    } finally {
      await mp9Browser.close()
    }
  }

  // --- SLOTWIN-01: 「今日の献立に追加」のスロット振り分け窓(2026-07-17 便Z-1・docs/35 §2)。
  // レシピ詳細のボタン押下で「朝食・昼食・夕食のどれに入れますか？」の窓が開き、
  // (a) 「夕食」を選ぶと週プランの今日の夕食枠に入り(IndexedDB直読み)、今日の献立(日タブ)にも
  //     反映される(=1操作で両方に反映)
  // (b) 同じ枠に同じレシピが既にあるときは重複させずトーストで案内される(件数不変)
  // (c) 「決めない」は従来どおりtodayListへの直接追加のみ(週プランには入らない) ---
  currentCheck = 'SLOTWIN-01'
  {
    const swBrowser = await chromium.launch()
    const swContext = await swBrowser.newContext()
    const swPage = await swContext.newPage()
    swPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@SLOTWIN-01] ${text}`)
    })
    swPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SLOTWIN-01] ${err.message}`)
    })
    try {
      await swPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(1800) // 初回シード完了待ち

      // mealPlans/todayListをIndexedDB直読みするヘルパー(今日の日付はブラウザ側で算出)
      const countTodaySlotEntries = (recipeId, slot) =>
        swPage.evaluate(
          ({ recipeId, slot }) =>
            new Promise((resolve, reject) => {
              const d = new Date()
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result.filter(
                      (row) => row.date === date && row.slot === slot && row.recipeId === recipeId,
                    ).length,
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { recipeId, slot },
        )
      const todayListIds = () =>
        swPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('todayList', 'readonly')
                const g = tx.objectStore('todayList').getAll()
                g.onsuccess = () => resolve(g.result.map((row) => row.recipeId))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // (a) 肉じゃがの詳細でボタン押下→窓→「夕食」
      await swPage.getByText('肉じゃが', { exact: true }).first().click()
      await swPage.waitForTimeout(500)
      const swRecipeId = Number(swPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await swPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await swPage.waitForTimeout(300)
      check(
        'SLOTWIN-01 ボタン押下で窓「朝食・昼食・夕食のどれに入れますか？」が開く',
        stripZwspText(await swPage.textContent('body')).includes(ja.detail.todaySlotDialogTitle),
      )
      await swPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01 「今日の夕食に追加しました」トーストが出る',
        (await swPage.textContent('body')).includes('今日の夕食に追加しました'),
      )
      check(
        'SLOTWIN-01 ボタンが「今日の献立に追加済み」表示に変わる',
        (await swPage.textContent('body')).includes('今日の献立に追加済み'),
      )
      check(
        'SLOTWIN-01 週プランの今日の夕食枠に入る(mealPlansに1件)',
        (await countTodaySlotEntries(swRecipeId, 'dinner')) === 1,
      )
      check(
        'SLOTWIN-01 今日の献立(todayList)にも入る(1操作で両方に反映)',
        (await todayListIds()).includes(swRecipeId),
      )

      // 日タブに反映されている(今日の献立セクションに肉じゃがが出る)
      await swPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(1200)
      check(
        'SLOTWIN-01 日タブの今日の献立に反映される',
        (await swPage.textContent('body')).includes('肉じゃが'),
      )
      // 週タブの今日の夕食枠にも見える
      await swPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(swPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01 週タブの今日の枠にも肉じゃがが見える',
        (await swPage.textContent('body')).includes('肉じゃが'),
      )

      // (b) 二重に入れる道が無いこと（2026-08-21 便IU・⑦で作りが変わった）。
      //
      // 便IU・⑦の前: レシピ詳細は「今日の献立」の表だけを見ていたので、表から1件消すと
      // ボタンが「追加」に戻り、そこからもう一度同じ枠を選べた（そのときの重複ガードを
      // 「今日の夕食にすでに入っています」のトーストで測っていた）。
      // 便IU・⑦の後: 詳細は**今日の予定も見る**ので、表から消しても予定が残っていれば
      // 「追加済み」のまま＝**二重に入れる窓がそもそも開かない**。
      // 重複ガード（logic/mealPlan.ts todaySlotAddPlan の 'duplicate'）はDB側の保険として
      // 残してあるが、画面からは通らなくなったので、ここではより強い保証のほうを測る。
      // 状態の作り方は今までどおり（週の予定に入った品は日タブの「今週の献立の予定」に並び
      // ×が出ないので、todayListから直接1件消して同じ状態を作る）
      await swPage.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('todayList', 'readwrite')
              const store = tx.objectStore('todayList')
              const g = store.getAll()
              g.onsuccess = () => {
                const row = g.result.find((r) => r.recipeId === recipeId)
                if (row) store.delete(row.id)
              }
              tx.oncomplete = () => resolve(true)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        swRecipeId,
      )
      await swPage.waitForTimeout(300)
      await swPage.goto(`${BASE}/#/recipes/${swRecipeId}`, { waitUntil: 'networkidle' })
      // 生IDB書き込みはDexieのliveQueryを更新しないので、読み直してから操作する
      await swPage.reload({ waitUntil: 'networkidle' })
      await swPage.waitForTimeout(800)
      const swToggleLabel = (
        (await swPage.locator('[data-testid="detail-today-toggle"]').textContent()) ?? ''
      )
        .replaceAll('\u200b', '')
        .trim()
      check(
        'SLOTWIN-01(二重防止) 今日の予定に残っていれば、表から消えていても「追加済み」のまま（2026-08-21 便IU・⑦）',
        swToggleLabel.includes(ja.detail.todayAdded),
        `ボタン=${swToggleLabel}`,
      )
      check(
        'SLOTWIN-01(二重防止) 食事を選ぶ窓は開かない（二重に入れる道が無い）',
        !(await swPage.textContent('body')).includes(ja.detail.todaySlotDialogTitle),
      )
      check(
        'SLOTWIN-01(二重防止) mealPlansの夕食枠は1件のまま増えない',
        (await countTodaySlotEntries(swRecipeId, 'dinner')) === 1,
      )

      // (c) 「決めない」: カレーライスで窓→決めない→todayListのみ(週プランには入らない)
      await swPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(500)
      await swPage.getByText('カレーライス', { exact: true }).first().click()
      await swPage.waitForTimeout(500)
      const swCurryId = Number(swPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await swPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await swPage.waitForTimeout(300)
      await swPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01(決めない) todayListへ直接追加される',
        (await todayListIds()).includes(swCurryId),
      )
      const swCurrySlotCounts = await Promise.all(
        ['breakfast', 'lunch', 'dinner'].map((slot) => countTodaySlotEntries(swCurryId, slot)),
      )
      check(
        'SLOTWIN-01(決めない) 週プランのどの枠にも入らない(従来どおりの枠なし追加)',
        swCurrySlotCounts.every((n) => n === 0),
        `counts=${JSON.stringify(swCurrySlotCounts)}`,
      )
    } finally {
      await swBrowser.close()
    }
  }

  // --- PASTLOG-01: 週/月の過去振り返り(2026-07-17 便Z-2・docs/35 §3)。
  // 昨日の日付で「作った！」記録を付け、
  // (a) 週タブの昨日の枠に「作った記録」の薄いカード(レシピ名+✓)が出ること
  //     (昨日が前週に当たる=実行日が月曜の場合は「前の週」へ移動してから確認)、
  // (b) 月タブ(Pro解錠)のカレンダー日に「記録あり」小マークが出て、その日をタップした
  //     日モーダルに作った記録が表示されること、を確認する。
  // 月間献立への機能追加はPro v2まで凍結が既定だったが、オーナー指示で解除して実装した分 ---
  currentCheck = 'PASTLOG-01'
  {
    const plBrowser = await chromium.launch()
    const plContext = await plBrowser.newContext()
    const plPage = await plContext.newPage()
    plPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@PASTLOG-01] ${text}`)
    })
    plPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PASTLOG-01] ${err.message}`)
    })
    try {
      const plPad = (n) => String(n).padStart(2, '0')
      const plToday = new Date()
      const plYd = new Date()
      plYd.setDate(plYd.getDate() - 1)
      const plYesterday = `${plYd.getFullYear()}-${plPad(plYd.getMonth() + 1)}-${plPad(plYd.getDate())}`
      const plYesterdaySlash = plYesterday.replaceAll('-', '/')

      await plPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await plPage.waitForTimeout(1800) // 初回シード完了待ち

      // 肉じゃがに「作った！」記録を昨日の日付で付ける(実UIのCookedLogModal経由)
      await plPage.getByText('肉じゃが', { exact: true }).first().click()
      await plPage.waitForTimeout(500)
      await plPage.getByRole('button', { name: '作った！' }).click()
      await plPage.waitForTimeout(300)
      await plPage.locator('input[type="date"]').fill(plYesterday)
      await plPage.getByRole('button', { name: ja.detail.cookedSave }).click()
      await plPage.waitForTimeout(500)
      check(
        'PASTLOG-01 前提: 昨日の日付で作った記録を保存できる',
        (await plPage.textContent('body')).includes('作った記録をつけました'),
      )

      // (a) 週タブ: 昨日の枠に「作った記録」カード(レシピ名+✓)が出る
      await plPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await plPage.waitForTimeout(800)
      await plPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(plPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await plPage.waitForTimeout(500)
      if (!(await plPage.textContent('body')).includes(plYesterdaySlash)) {
        // 実行日が月曜のときだけ、昨日(日曜)は前の週に表示される
        await plPage.locator('button[aria-label="前の週"]').click()
        await openAllWeekDays(plPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await plPage.waitForTimeout(500)
      }
      const plDayCardText = await plPage
        .locator('section', { hasText: plYesterdaySlash })
        .first()
        .textContent()
      check(
        'PASTLOG-01 週タブの昨日の枠に「作った記録」+レシピ名が出る',
        !!plDayCardText && plDayCardText.includes('作った記録') && plDayCardText.includes('肉じゃが'),
        `昨日カード=${plDayCardText?.slice(0, 120)}`,
      )
      // 便BS(タスク2): 過去日は予定グリッドを出さず「記録だけ残す」。昨日カードに空き枠ボタン
      // (レシピを選ぶ)が無いことで、達成しなかった予定が過去表示から消えていることを確認する
      check(
        'PASTLOG-01(便BS) 過去日は予定グリッドを出さない(昨日カードに「レシピを選ぶ」が無い)',
        !!plDayCardText && !plDayCardText.includes('レシピを選ぶ'),
      )

      // (b) 月タブ: Pro解錠(月間はPro機能。実コードは台帳原本のためNUT-02等と同様
      // settings.proCodeの直書きで「解錠済み」状態だけ再現)→「記録あり」マーク→日モーダル
      await plPage.evaluate(async () => {
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
      await plPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await plPage.reload({ waitUntil: 'networkidle' })
      await plPage.waitForTimeout(800)
      await plPage.getByRole('button', { name: '月', exact: true }).click()
      await plPage.waitForTimeout(500)
      if (plYesterday.slice(0, 7) !== `${plToday.getFullYear()}-${plPad(plToday.getMonth() + 1)}`) {
        // 実行日が月初(1日)のときだけ、昨日は前の月に表示される
        await plPage.locator('button[aria-label="前の月"]').click()
        await plPage.waitForTimeout(500)
      }
      check(
        'PASTLOG-01 月カレンダーに「記録あり」小マークが出る',
        (await plPage.locator('[aria-label="記録あり"]').count()) >= 1,
      )
      // 2026-07-30 便CH/C3: 写真モードでは記録の印が出るのに、数字モードに切り替えると
      // 印ごと消えていた(同じ画面で「記録はある/数字には無い」が同居して見える)。
      // 便CH/C8: 家族の実支出(作った食数ぶん)は内訳を開かずに読めるところへ上げた
      await plPage.getByRole('button', { name: '食費', exact: true }).click()
      await plPage.waitForTimeout(400)
      check(
        'PASTLOG-01(便CH/C3) 食費モードに切り替えても作った記録の日に「作った記録あり」が残る',
        (await plPage
          .locator(`button[data-date="${plYesterday}"][aria-label*="作った記録あり"]`)
          .count()) === 1,
      )
      // 2026-08-03 便DQ: 常設1行だった全体食費は、食費の表の「全員分／作った食数ぶん」の行になった。
      // 2026-08-07 便DU: 月の食費カードは折りたたみになった(既定は畳む)ので、見出しを押して開いてから読む
      await plPage.getByRole('button', { name: /月の食費/ }).click()
      await plPage.waitForTimeout(300)
      const plMonthTable =
        (await plPage.locator('table', { hasText: ja.mealPlan.intakeCostRowPersonalNote }).first().textContent()) ?? ''
      // 2026-08-19 便HV・⑧⑨: 過去と未来で行を分けなくなったので、「全員分」は
      // 作った食数ぶんと作る食数ぶんを足した1行になった(数え方の書き方もそれに合わせた)
      check(
        'PASTLOG-01(便CH/C8・便DQ・便HV) 月の食費の表に「全員分」の金額とのべ食数が内訳を開かずに出る',
        /全員分[^約]{0,20}約[\d,]+円のべ\d+食/.test(plMonthTable),
        `表=${plMonthTable.slice(0, 200)}`,
      )
      // 以降の「記録あり」マーク経由のタップのため写真モードへ戻す
      await plPage.getByRole('button', { name: '写真', exact: true }).click()
      await plPage.waitForTimeout(400)
      // 「記録あり」マークの付いた日(=昨日)をタップ→日モーダルに作った記録が出る
      await plPage
        .locator('button', { has: plPage.locator('[aria-label="記録あり"]') })
        .first()
        .click()
      await plPage.waitForTimeout(500)
      const plModalText = await plPage.locator('[role="dialog"]').first().textContent()
      check(
        'PASTLOG-01 日モーダルにその日の「作った記録」が表示される',
        !!plModalText && plModalText.includes('作った記録') && plModalText.includes('肉じゃが'),
        `モーダル=${plModalText?.slice(0, 120)}`,
      )
    } finally {
      await plBrowser.close()
    }
  }

  // --- MEALPLAN-07: 献立タブ・月タブ「期間で絞る」
  // (2026-07-17 便AB → 2026-07-28 便CAでオーナー確定仕様に改訂)。
  //
  // 【旧テストを書き換えた理由】便CAでオーナー確定の仕様変更が2点入り、旧テストが固定していた
  // 期待値がそのまま成立しなくなったため、丸ごと書き直した。
  //  ①「合計÷食数の平均(1食あたり)」を廃止し「1人が期間内に摂取した食事の合計(1人分)」を出す
  //    → 旧「1食あたり 約◯円」「1日あたり平均=合計÷6日」の検証は仕様ごと消滅。
  //  ②過去日は作った記録・今日以降は登録した献立だけで数える(過去の予定ベース表示は廃止)
  //    → 旧テストは「当月の3〜8日」に献立を入れていたが、実行日によって過去にも未来にもなるため
  //      日付依存で不安定。予定側は翌月(全日が未来)・実績側は前月(全日が過去)で決定的に検証する。
  //
  // 検証内容:
  //  A(予定・翌月): 今日以降の期間は登録した献立で計算する。1人分の合計＝単品の概算食費÷登録人数×2品。
  //  B(実績・前月): 過ぎた期間は作った記録だけで計算し、同じ期間に置いた「過去の予定」は数えない
  //    (オーナー指示「過去の予定ベース計算は邪魔なので表示なし」の回帰防止)。
  //    オーナー指示で残す「作った記録の食費(全体)」＝全量の金額と延べ食数も確認する。
  //  C(混在・当月): 過去分と今日以降分が混ざる期間は、どの日をどちらの基準で数えたかを明示する。
  //  D: モード中は日タップが範囲選択に使われ日モーダルが出ない/解除で復活する(便ABからの継続確認)。
  //  E: カレンダーのセル表示切り替え(写真/栄養/食費)と、選択が設定に記憶されること(便CA・タスク2)。
  // 日セルは data-date 属性で掴む(日番号のテキスト一致だと予定プレビューや数字が入った途端に崩れるため)。
  currentCheck = 'MEALPLAN-07'
  {
    const rcBrowser = await chromium.launch()
    const rcContext = await rcBrowser.newContext()
    const rcPage = await rcContext.newPage()
    rcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-07] ${text}`)
    })
    rcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-07] ${err.message}`)
    })
    try {
      await rcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(1800) // 初回シード完了待ち

      // 肉じゃがの単品概算食費(レシピ登録人数の全量)を実UIから読み取る
      await rcPage.getByText('肉じゃが', { exact: true }).first().click()
      await rcPage.waitForTimeout(500)
      const rcDetailText = (await rcPage.textContent('body')) ?? ''
      const rcSingleMatch = rcDetailText.match(/約([\d,]+)円/)
      const rcSingleCost = Number((rcSingleMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'MEALPLAN-07 前提: 肉じゃがの概算食費が読み取れる(0円ではない)',
        rcSingleCost > 0,
        `rcSingleCost=${rcSingleCost}`,
      )

      const rcRecipe = await rcPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const r = g.result.find((x) => x.title === '肉じゃが')
                resolve(r ? { id: r.id, servings: r.servings } : null)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const rcRecipeId = rcRecipe?.id
      const rcServings = rcRecipe?.servings > 0 ? rcRecipe.servings : 1
      check(
        'MEALPLAN-07 前提: 肉じゃがの登録人数が読める',
        rcServings > 0,
        `servings=${rcRecipe?.servings}`,
      )
      // 1人分の期待値(便CA): 「全量÷登録人数」を品ごとに1回だけ足し、最後に一度だけ四捨五入する
      const rcPersonalOne = rcSingleCost / rcServings

      // 翌月(全日が未来)・前月(全日が過去)・当月(混在)に、それぞれ検証用のデータを入れる
      const rcNow = new Date()
      const prefixOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const rcCurPrefix = prefixOf(rcNow)
      const rcNextPrefix = prefixOf(new Date(rcNow.getFullYear(), rcNow.getMonth() + 1, 1))
      const rcPrevPrefix = prefixOf(new Date(rcNow.getFullYear(), rcNow.getMonth() - 1, 1))
      const rcCurLastDay = new Date(rcNow.getFullYear(), rcNow.getMonth() + 1, 0).getDate()
      const rcTodayDay = rcNow.getDate()

      // 献立(mealPlans): 翌月3日・8日(未来=数える) / 前月5日(過去=数えない) / 当月末日(今日以降=数える)
      await rcPage.evaluate(
        ({ recipeId, dates }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const store = tx.objectStore('mealPlans')
              dates.forEach((date) => store.add({ date, slot: 'dinner', recipeId, role: 'main' }))
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        {
          recipeId: rcRecipeId,
          dates: [
            `${rcNextPrefix}-03`,
            `${rcNextPrefix}-08`,
            `${rcPrevPrefix}-05`,
            `${rcCurPrefix}-${String(rcCurLastDay).padStart(2, '0')}`,
          ],
        },
      )
      // 作った記録(cookedLogs): 前月3日(過去=数える) / 当月1日(過去=数える。当月が混在期間になる)
      await rcPage.evaluate(
        ({ recipeId, dates }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.get(recipeId)
              g.onsuccess = () => {
                const r = g.result
                r.cookedLogs = [...dates.map((date) => ({ date })), ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { recipeId: rcRecipeId, dates: [`${rcPrevPrefix}-03`, `${rcCurPrefix}-01`] },
      )

      // Pro解錠(IndexedDB直書き。PASTLOG-01と同じ「解錠済み状態の再現」手法)
      await rcPage.evaluate(async () => {
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

      await rcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await rcPage.reload({ waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(800)
      await rcPage.getByRole('button', { name: '月', exact: true }).click()
      await rcPage.waitForTimeout(500)

      // 日セルは data-date で掴む(予定プレビュー・数字が入っても壊れない)
      const rcDay = (date) => rcPage.locator(`button[data-date="${date}"]`)
      // 2026-08-19 便HV・⑦: ボタン名は「期間で絞る」（2026-08-26 便LHでカレンダーの下へ移った）
      const rcModeBtn = rcPage.getByRole('button', { name: ja.mealPlan.rangeCostToggle, exact: true })
      // 便DRで期間カードも月タブと同じ体裁(食費の表＋折りたたみ)になったため、
      // 本文全体ではなくカード/表を掴んで読む(同じ画面に月の食費の表があり、文言が重なるため)
      const rcCard = rcPage.locator('[data-testid="range-result-card"]')
      const rcTable = rcPage.locator('[data-testid="range-cost-table"]')
      /* 2026-08-26 便LH（オーナー原文「１ヶ月分の内容が、そのまま絞った期間の内容に書き変わるのが
         ベスト。」）: 期間を選んでも**別のカードは増えず**、月の食費・栄養のカードの中身が
         そのまま期間のものに入れ替わる。カードは既定で畳んであるので、中身を読む前に開く。
         掴むのは data-testid（見出しの文字は月・期間で入れ替わるので書き写さない・禁じ手②④） */
      const rcOpenCard = async (testId) => {
        const btn = rcPage.locator(`[data-testid="${testId}"]`)
        if ((await btn.count()) === 0) return
        if ((await btn.first().getAttribute('aria-expanded')) === 'true') return
        await btn.first().click()
        await rcPage.waitForTimeout(350)
      }
      const rcOpenCards = async () => {
        await rcOpenCard('month-cost-toggle')
        await rcOpenCard('month-nutrition-toggle')
      }
      const rcNextMonthBtn = rcPage.getByRole('button', { name: ja.mealPlan.nextMonth, exact: true })
      const rcPrevMonthBtn = rcPage.getByRole('button', { name: ja.mealPlan.prevMonth, exact: true })

      // ===== モードON: 案内が出る =====
      await rcModeBtn.click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モードONで開始日案内が出る',
        stripZwspText(await rcPage.textContent('body')).includes(ja.mealPlan.rangeCostGuideStart),
      )
      check('MEALPLAN-07 モードONはaria-pressed=true', (await rcModeBtn.getAttribute('aria-pressed')) === 'true')

      // ===== A: 予定(翌月=全日が未来) =====
      await rcNextMonthBtn.click()
      await rcPage.waitForTimeout(400)
      await rcDay(`${rcNextPrefix}-03`).click()
      await rcPage.waitForTimeout(200)
      check(
        'MEALPLAN-07 開始日タップ後は終了日案内が出る',
        stripZwspText(await rcPage.textContent('body')).includes(ja.mealPlan.rangeCostGuideEnd),
      )
      check(
        'MEALPLAN-07 モード中は日モーダルが開かない(開始日タップ時点)',
        (await rcPage.locator('[role="dialog"]').count()) === 0,
      )
      await rcDay(`${rcNextPrefix}-08`).click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 終了日タップ後も日モーダルは開かない',
        (await rcPage.locator('[role="dialog"]').count()) === 0,
      )
      await rcOpenCards()
      const rcFutureText = (await rcPage.textContent('body')) ?? ''
      check(
        // 2026-08-26 便LH: 「期間の食費と栄養」のカードは廃止し、月の2枚の中身が入れ替わる形にした。
        // 選んだ期間はカレンダーの下の1行が名乗る
        'MEALPLAN-07(便LH) 月の食費・栄養のカードが「選んだ期間の」に入れ替わる',
        rcFutureText.includes(ja.mealPlan.rangeCostCardTitle) &&
          rcFutureText.includes(ja.mealPlan.rangeNutritionCardTitle),
        `本文=${rcFutureText.slice(0, 60)}`,
      )
      check('MEALPLAN-07 選んだ期間の1行に日数(6日間)が出る', rcFutureText.includes('6日間'))
      check(
        'MEALPLAN-07(便CA③) 未来だけの期間は「登録した献立で計算」と明示する',
        rcFutureText.includes(ja.mealPlan.rangeBasisPlanOnly),
        `本文=${rcFutureText.slice(0, 40)}`,
      )
      check(
        'MEALPLAN-07(便CA③) 未来だけの期間に「作った記録だけで計算」は出さない',
        !rcFutureText.includes('過ぎた日なので、作った記録だけで計算しています'),
      )
      // 2026-08-03 便DR: 1人分の合計は食費の表の1行目(「1人分／献立を1食ずつ足した合計」)に入った
      const rcFutureTableText = (await rcTable.textContent()) ?? ''
      const rcFuturePersonalMatch = rcFutureTableText.match(
        /1人分献立を1食ずつ足した合計約([\d,]+)円(\d+)食/,
      )
      const rcFuturePersonal = Number((rcFuturePersonalMatch?.[1] ?? '-1').replace(/,/g, ''))
      check(
        'MEALPLAN-07(便CA①・便DR) 表の「1人分」＝単品概算食費÷登録人数×2品(平均ではなく合計)と2食',
        rcFuturePersonal === Math.round(rcPersonalOne * 2) && rcFuturePersonalMatch?.[2] === '2',
        `表=${rcFutureTableText.slice(0, 200)} 期待=${Math.round(rcPersonalOne * 2)}`,
      )
      // 同じ画面の月カードにも同じ文言があるので、並びの検査は期間カードの中だけを読む
      const rcFutureCardText = (await rcCard.textContent()) ?? ''
      check(
        'MEALPLAN-07(便DR) 期間カードの並びは月タブと同じ「食費→栄養」(食費の表が栄養8項目より先)',
        rcFutureCardText.indexOf('献立を1食ずつ足した合計') > 0 &&
          rcFutureCardText.indexOf('献立を1食ずつ足した合計') <
            rcFutureCardText.indexOf('たんぱく質'),
        `カード=${rcFutureCardText.slice(0, 200)}`,
      )
      check(
        'MEALPLAN-07(便CA①・便DR) 1日あたりの平均＝1人分合計÷6日(分母を行に書く)',
        rcFutureTableText.includes(
          `1日あたりの平均1人分÷選んだ6日約${Math.round(Math.round(rcPersonalOne * 2) / 6).toLocaleString()}円`,
        ),
        `表=${rcFutureTableText.match(/1日あたりの平均[^円]{0,30}円/)?.[0]}`,
      )
      check(
        'MEALPLAN-07(便CA①) 廃止した「1食あたり 約◯円」は出さない',
        !/1食あたり 約[\d,]+円/.test(rcFutureText),
      )
      check(
        // 2026-07-30 便CH/C8＋2026-08-03 便DQ/DR → 2026-08-19 便HV・⑧:
        // 過去と未来で行を分けない。未来だけの期間でも「全員分」は1行だけで、
        // 下段の「これから作る予定」は出ない(数字は作る食数ぶんそのもの)
        'MEALPLAN-07(便HV) 未来だけの期間でも「全員分」は1行だけで、予定用の下段は出ない',
        /全員分[^約]{0,20}約[\d,]+円のべ\d+食/.test(rcFutureTableText) &&
          !rcFutureTableText.includes('これから作る予定') &&
          (await rcTable.locator('tbody').count()) === 1,
        `表=${rcFutureTableText.slice(0, 240)}`,
      )
      // 2026-08-03 便DR: 内訳と価格の但し書きは月タブと同じく折りたたみの中(既定は畳む)
      check(
        'MEALPLAN-07(便DR) 内訳と価格の但し書きは既定で畳まれている',
        !rcFutureCardText.includes('内訳 作った記録'),
      )
      await rcCard.getByRole('button', { name: ja.mealPlan.intakeCostDetailsOpen }).click()
      await rcPage.waitForTimeout(200)
      const rcFutureOpenText = (await rcCard.textContent()) ?? ''
      check(
        'MEALPLAN-07(便CA①) 内訳に「作った記録 約0円（0品）／登録した献立 …（2品）」が出る',
        /内訳 作った記録 約0円（0[品件]）／登録した献立 約[\d,]+円（2[品件]）/.test(rcFutureOpenText),
        `内訳=${rcFutureOpenText.match(/内訳[^。]{0,60}/)?.[0]}`,
      )
      check(
        'MEALPLAN-07(便CA①・便DR) 見出し「栄養（1人分）」の下に8項目が出る',
        rcFutureOpenText.includes('栄養（1人分）') &&
          rcFutureOpenText.includes('エネルギー') &&
          rcFutureOpenText.includes('食物繊維'),
      )
      check(
        'MEALPLAN-07 摂取栄養は「概算」表記で出す(2026-08-02 便CW-9で数値側の表記を統一)',
        rcFutureOpenText.includes('概算'),
      )
      check(
        'MEALPLAN-07(便CA①) 栄養の注記は「登録した献立2品の栄養価を、1食分ずつ足して算出した数値です」',
        /登録した献立2[品件]の栄養価を、1食分ずつ足して算出した数値です/.test(rcFutureOpenText),
        `注記=${rcFutureOpenText.match(/.{0,10}1食分ずつ足して算出した数値です/)?.[0]}`,
      )
      // 便DR: 栄養の長い但し書きと出典も月タブと同じく折りたたみの中
      check(
        'MEALPLAN-07(便DR) 栄養の長い但し書きと出典は既定では出さない',
        !rcFutureOpenText.includes('調理による変化などは反映しておらず'),
      )
      await rcCard.getByRole('button', { name: '注記と出典' }).click()
      await rcPage.waitForTimeout(200)
      check(
        'MEALPLAN-07(便DR) 「注記と出典」で概算の但し書きと成分表の出典が出る',
        ((await rcCard.textContent()) ?? '').includes('調理による変化などは反映しておらず') &&
          ((await rcCard.textContent()) ?? '').includes('出典: '),
      )

      // 終了日<開始日の順にタップしても自動で入れ替わり同じ結果になる
      await rcDay(`${rcNextPrefix}-08`).click()
      await rcPage.waitForTimeout(200)
      await rcDay(`${rcNextPrefix}-03`).click()
      await rcPage.waitForTimeout(300)
      await rcOpenCards()
      const rcSwappedText = (await rcPage.textContent('body')) ?? ''
      check(
        'MEALPLAN-07 終了日<開始日タップでも自動で入れ替わり同じ範囲になる(6日間)',
        rcSwappedText.includes('6日間'),
      )
      const rcSwappedPersonal = Number(
        (((await rcTable.textContent()) ?? '').match(/1人分献立を1食ずつ足した合計約([\d,]+)円/)?.[1] ??
          '-1'
        ).replace(/,/g, ''),
      )
      check(
        'MEALPLAN-07 逆順タップでも1人分の合計は変わらない(自動入れ替え)',
        rcSwappedPersonal === rcFuturePersonal,
        `swapped=${rcSwappedPersonal} normal=${rcFuturePersonal}`,
      )

      // ===== B: 実績(前月=全日が過去)。同じ期間に置いた「過去の予定」は数えないこと =====
      await rcPrevMonthBtn.click()
      await rcPage.waitForTimeout(300)
      await rcPrevMonthBtn.click()
      await rcPage.waitForTimeout(400)
      await rcDay(`${rcPrevPrefix}-01`).click()
      await rcPage.waitForTimeout(200)
      await rcDay(`${rcPrevPrefix}-10`).click()
      await rcPage.waitForTimeout(300)
      await rcOpenCards()
      const rcPastText = (await rcPage.textContent('body')) ?? ''
      check(
        // 2026-08-22 司令部: 文言を**書き写していた**ため、月の期間カードから「過ぎた日なので、」を
        // 落とした瞬間に落ちた（禁じ手②）。ja.ts から読む形へ。BudouXがゼロ幅スペースを差し込むので
        // 照合前に外す
        'MEALPLAN-07(便CA③) 過去だけの期間は「作った記録だけで計算」と明示する',
        rcPastText.replaceAll('\u200b', '').includes(ja.mealPlan.rangeBasisActualOnly),
        `期待の文=${ja.mealPlan.rangeBasisActualOnly}`,
      )
      const rcPastTableText = (await rcTable.textContent()) ?? ''
      const rcPastPersonal = Number(
        (rcPastTableText.match(/1人分献立を1食ずつ足した合計約([\d,]+)円/)?.[1] ?? '-1').replace(
          /,/g,
          '',
        ),
      )
      check(
        'MEALPLAN-07(便CA①) 過去期間の1人分合計＝作った記録1件の1人分(何人分作ったかでは増えない)',
        rcPastPersonal === Math.round(rcPersonalOne),
        `表示=${rcPastPersonal} 期待=${Math.round(rcPersonalOne)}`,
      )
      check(
        'MEALPLAN-07(便CA②) 同じ期間に登録した献立があっても、過去の予定は0品0円で数えない',
        /内訳 作った記録 約[\d,]+円（1[品件]）／登録した献立 約0円（0[品件]）/.test(rcPastText),
        `内訳=${rcPastText.match(/内訳[^。]{0,60}/)?.[0]}`,
      )
      check(
        // 2026-07-30 便CH/C8: 「全体」→数え方を言い切る・「◯食分」→「のべ◯食分」
        // 2026-08-03 便DQ: 予定側「作る食数ぶん」と語をそろえて「作った食数ぶん」に統一
        // 2026-08-03 便DR: 表の「全員分／作った食数ぶん」の行になった(数字と数え方は同じ)
        'MEALPLAN-07(便CA・便DR) オーナー指示で残す「全員分」の行が金額と延べ食数で出る',
        new RegExp(
          `全員分[^約]{0,20}約${rcSingleCost.toLocaleString()}円のべ${rcServings}食`,
        ).test(rcPastTableText),
        `表=${rcPastTableText.slice(0, 240)} single=${rcSingleCost} servings=${rcServings}`,
      )
      check(
        // 2026-08-19 便HV・⑧: 下段そのものを廃止したので、どの期間でも出ない
        'MEALPLAN-07(便HV) 表に「これから作る予定」の下段は出ない',
        !rcPastTableText.includes('これから作る予定'),
        `表=${rcPastTableText.slice(0, 240)}`,
      )
      check(
        'MEALPLAN-07(便CA①) 栄養の注記は「作った記録1件の栄養価を、1食分ずつ足して算出した数値です」',
        /作った記録1[品件]の栄養価を、1食分ずつ足して算出した数値です/.test(rcPastText),
      )
      // 記録も予定も無い期間は空案内
      await rcDay(`${rcPrevPrefix}-20`).click()
      await rcPage.waitForTimeout(200)
      await rcDay(`${rcPrevPrefix}-22`).click()
      await rcPage.waitForTimeout(300)
      await rcOpenCards()
      check(
        'MEALPLAN-07(便CA) 記録も予定も無い期間は空案内を出す',
        ((await rcPage.textContent('body')) ?? '').includes(
          'この期間には、作った記録も登録した献立もありません',
        ),
      )

      // ===== C: 混在(当月。1日に記録・末日に予定) =====
      // 実行日が1日だと当月に過去日が無く、末日だと未来日が無いので、その間の日だけ検証する
      // (2026-08-08 便EA: 今日は記録・献立の両方で数えるようになったため、過去/未来の
      //  どちらかが空だと基準行が「◯/◯〜◯/◯は作った記録、…」の形にならない)
      await rcPage.getByRole('button', { name: ja.mealPlan.thisMonth }).click()
      await rcPage.waitForTimeout(400)
      if (rcTodayDay >= 2 && rcTodayDay < rcCurLastDay) {
        await rcDay(`${rcCurPrefix}-01`).click()
        await rcPage.waitForTimeout(200)
        await rcDay(`${rcCurPrefix}-${String(rcCurLastDay).padStart(2, '0')}`).click()
        await rcPage.waitForTimeout(300)
        await rcOpenCards()
        const rcMixedText = (await rcPage.textContent('body')) ?? ''
        check(
          'MEALPLAN-07(便CA③) 混在期間は「◯/◯〜◯/◯は作った記録、◯/◯〜◯/◯は登録した献立で計算しています」と区別して出す',
          /\d+\/\d+〜\d+\/\d+は作った記録、\d+\/\d+〜\d+\/\d+は登録した献立で計算しています/.test(
            rcMixedText,
          ),
          `本文=${rcMixedText.match(/.{0,40}計算しています/)?.[0]}`,
        )
        check(
          'MEALPLAN-07(便EA) 混在期間には「今日は、作った記録があるものは記録…」の1文も出る',
          rcMixedText.includes(
            '今日は、作った記録があるものは記録、まだのものは登録した献立で計算しています',
          ),
        )
        check(
          'MEALPLAN-07(便CA③) 混在期間の内訳は実績1品と予定1品の両方が出る',
          /内訳 作った記録 約[\d,]+円（1[品件]）／登録した献立 約[\d,]+円（1[品件]）/.test(rcMixedText),
          `内訳=${rcMixedText.match(/内訳[^。]{0,60}/)?.[0]}`,
        )
        check(
          'MEALPLAN-07(便CA①) 混在期間の栄養注記は「作った記録1件と登録した献立1品の栄養価を、1食分ずつ足して算出した数値です」',
          /作った記録1[品件]と登録した献立1[品件]の栄養価を、1食分ずつ足して算出した数値です/.test(rcMixedText),
        )
        const rcMixedPersonal = Number(
          (((await rcTable.textContent()) ?? '').match(
            /1人分献立を1食ずつ足した合計約([\d,]+)円/,
          )?.[1] ?? '-1'
          ).replace(/,/g, ''),
        )
        check(
          'MEALPLAN-07(便CA①) 混在期間の1人分合計＝実績1品＋予定1品',
          rcMixedPersonal === Math.round(rcPersonalOne) + Math.round(rcPersonalOne),
          `表示=${rcMixedPersonal} 期待=${Math.round(rcPersonalOne) * 2}`,
        )
      } else {
        check('MEALPLAN-07(便CA③) 混在期間の検証は当月に過去日と未来日がある日だけ実施(今日は月初/月末なので省略)', true)
      }

      // ===== D: モード解除で日モーダルが復活する =====
      await rcModeBtn.click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モード解除後はaria-pressed=false',
        (await rcModeBtn.getAttribute('aria-pressed')) === 'false',
      )
      await rcDay(`${rcCurPrefix}-01`).click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モード解除後は日タップで日モーダルが復活する',
        await rcPage.locator('[role="dialog"]').isVisible(),
      )
      await rcPage.locator('[role="dialog"] button[aria-label="閉じる"]').click()
      await rcPage.waitForTimeout(300)

      // ===== E: カレンダーのセル表示切り替え(便CA・タスク2) =====
      // 翌月(予定あり)で確認する。既定は写真モード＝予定のある日に主菜名が出ている
      await rcNextMonthBtn.click()
      await rcPage.waitForTimeout(400)
      const rcPhotoModeBtn = rcPage.getByRole('button', { name: '写真', exact: true })
      const rcNutriModeBtn = rcPage.getByRole('button', { name: ja.mealPlan.monthCellModeNutrition, exact: true })
      const rcCostModeBtn = rcPage.getByRole('button', { name: '食費', exact: true })
      check(
        'MEALPLAN-07(便CA②) 写真/栄養/食費の切り替えが3つとも出る',
        (await rcPhotoModeBtn.count()) === 1 &&
          (await rcNutriModeBtn.count()) === 1 &&
          (await rcCostModeBtn.count()) === 1,
      )
      check(
        'MEALPLAN-07(便CA②) 既定は写真モード(aria-pressed=true)',
        (await rcPhotoModeBtn.getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MEALPLAN-07(便CA②) 写真モードのセルは従来どおり献立のプレビュー(主菜名)を出す',
        ((await rcDay(`${rcNextPrefix}-03`).textContent()) ?? '').includes('肉じゃが'),
      )

      await rcNutriModeBtn.click()
      await rcPage.waitForTimeout(400)
      // セルの見た目は数字だけ(「498kcal」は7列のセルに入りきらず切れるため。単位は凡例と読み上げで補う)。
      // 数字が「その日の1人分のkcal」であることは aria-label 側で確認する
      const rcNutriCell = (await rcDay(`${rcNextPrefix}-03`).textContent()) ?? ''
      const rcNutriAria = (await rcDay(`${rcNextPrefix}-03`).getAttribute('aria-label')) ?? ''
      // 2026-08-19 便HV・⑥: 単位は項目ごとに変わるので、読み上げも栄養パネルと同じ
      // 「498 kcal」の形（数と単位のあいだに空き）で作るようにした。空きの有無は問わずに読む
      const rcNutriKcal = rcNutriAria.match(/([\d,]+)\s*kcal/)?.[1] ?? ''
      check(
        'MEALPLAN-07(便CA②) 読み上げ(aria-label)は「◯日 ◯kcal 登録した献立」',
        /^3日 [\d,]+\s?kcal 登録した献立$/.test(rcNutriAria),
        `aria=${rcNutriAria}`,
      )
      check(
        'MEALPLAN-07(便CA②→便EA) 栄養モードのセルは 日付＋数字＋単位(kcal)',
        rcNutriCell === `3${rcNutriKcal}kcal` && rcNutriKcal !== '',
        `セル=${rcNutriCell} 期待=3${rcNutriKcal}kcal`,
      )
      check(
        // 2026-08-19 便HV・⑩で説明を短くした(数え方の説明は落とした)が、項目名は言い続ける
        'MEALPLAN-07(便EA・便HV) 栄養モードの凡例が「何の数字か」を言う(エネルギー(kcal))',
        ((await rcPage.textContent('body')) ?? '')
          .replaceAll('\u200b', '')
          .includes('エネルギー（kcal）の概算です'),
      )
      check(
        'MEALPLAN-07(便CA②) 予定も記録も無い日は数字を出さない(日付だけ)',
        ((await rcDay(`${rcNextPrefix}-04`).textContent()) ?? '').trim() === '4',
        `セル=${await rcDay(`${rcNextPrefix}-04`).textContent()}`,
      )

      await rcCostModeBtn.click()
      await rcPage.waitForTimeout(400)
      const rcCostCell = (await rcDay(`${rcNextPrefix}-03`).textContent()) ?? ''
      check(
        'MEALPLAN-07(便CA②) 食費モードのセルにその日の1人分の金額が出る',
        new RegExp(`${Math.round(rcPersonalOne).toLocaleString()}円`).test(rcCostCell),
        `セル=${rcCostCell} 期待=${Math.round(rcPersonalOne).toLocaleString()}円`,
      )
      check(
        'MEALPLAN-07(便EA・便HV) 食費モードの凡例も「何の数字か」を言う(食費(円))',
        ((await rcPage.textContent('body')) ?? '')
          .replaceAll('\u200b', '')
          .includes('食費（円）の概算です'),
      )

      // 選択は設定に記憶され、再読み込みしても食費モードのまま
      await rcPage.reload({ waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(900)
      await rcPage.getByRole('button', { name: '月', exact: true }).click()
      await rcPage.waitForTimeout(500)
      check(
        'MEALPLAN-07(便CA②) 切り替えた表示は設定に記憶される(再読み込み後も食費モード)',
        (await rcPage.getByRole('button', { name: '食費', exact: true }).getAttribute('aria-pressed')) ===
          'true',
      )
      // 写真モードへ戻すと従来表示に復帰する
      await rcPage.getByRole('button', { name: '写真', exact: true }).click()
      await rcPage.waitForTimeout(400)
      check(
        'MEALPLAN-07(便CA②) 写真モードへ戻すと従来の献立プレビューに復帰する',
        !((await rcPage.textContent('body')) ?? '').includes('の概算です。その日に1人が食べる分で'),
      )
    } finally {
      await rcBrowser.close()
    }
  }

  // --- RANGE-EA: 2026-08-08 便EA(オーナー指示)の3件。
  //  EA-2a 期間の食費と栄養: 選んだ期間の文字を大きくする(今どこを見ているかが主役)
  //  EA-2b 開始日・終了日を手入力で変えられ、月をまたぐ期間も計算する
  //  EA-3  今日の「作った記録」が集計に入る(今日は作った分は記録・まだの分は献立。二重計上ゼロ) ---
  currentCheck = 'RANGE-EA'
  {
    const eaBrowser = await chromium.launch()
    const eaContext = await eaBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const eaPage = await eaContext.newPage()
    eaPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@RANGE-EA] ${err.message}`)
    })
    try {
      await eaPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eaPage.waitForTimeout(2000) // 初回シード完了待ち

      const eaNow = new Date()
      const eaDay = (offset) => {
        const d = new Date(eaNow.getFullYear(), eaNow.getMonth(), eaNow.getDate() + offset)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      const eaToday = eaDay(0)
      const eaLastMonth = eaDay(-40) // 必ず前月以前になる日(月またぎの検証用)

      // 検証用に2品を掴む(今日の予定に主菜=A・副菜=Bを入れ、Aだけ「作った記録」を付ける)
      const eaIds = await eaPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.slice(0, 2).map((r) => r.id))
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('RANGE-EA 前提: 検証用のレシピが2品ある', eaIds.length === 2, `ids=${JSON.stringify(eaIds)}`)

      // 献立: 今日の夕食に主菜(A)と副菜(B)。前月の日にも1品(月またぎの集計に入るか)
      await eaPage.evaluate(
        ({ ids, today, lastMonth }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const store = tx.objectStore('mealPlans')
              store.add({ date: today, slot: 'dinner', recipeId: ids[0], role: 'main' })
              store.add({ date: today, slot: 'dinner', recipeId: ids[1], role: 'side' })
              store.add({ date: lastMonth, slot: 'dinner', recipeId: ids[0], role: 'main' })
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { ids: eaIds, today: eaToday, lastMonth: eaLastMonth },
      )
      // 作った記録: 今日にA、前月の日にA(前月は「作った記録」で数える日)
      await eaPage.evaluate(
        ({ id, dates }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.get(id)
              g.onsuccess = () => {
                const r = g.result
                r.cookedLogs = [...dates.map((date) => ({ date })), ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { id: eaIds[0], dates: [eaToday, eaLastMonth] },
      )
      // Pro解錠(月タブと栄養の注記を見るため。他ブロックと同じIndexedDB直書き)
      await eaPage.evaluate(async () => {
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

      await eaPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eaPage.reload({ waitUntil: 'networkidle' })
      await eaPage.waitForTimeout(1200)
      await eaPage.getByRole('button', { name: '月', exact: true }).click()
      await eaPage.waitForTimeout(600)

      // ---------- EA-1: 栄養モードのセルに単位(kcal)が出る ----------
      await eaPage.getByRole('button', { name: ja.mealPlan.monthCellModeNutrition, exact: true }).click()
      await eaPage.waitForTimeout(500)
      const eaCellText = (await eaPage.locator(`button[data-date="${eaToday}"]`).textContent()) ?? ''
      check(
        'RANGE-EA(便EA-1) 栄養モードのセルは数字の下に単位(kcal)が出る',
        eaCellText.includes('kcal'),
        `セル=${eaCellText}`,
      )
      check(
        // 2026-08-19 便HV・⑩で説明を短くしたが、「何の数字か」を先に言うことは変えていない
        'RANGE-EA(便EA-1・便HV) 凡例が「何の数字か」を言う(エネルギー(kcal))',
        ((await eaPage.textContent('body')) ?? '')
          .replaceAll('\u200b', '')
          .includes('エネルギー（kcal）の概算です'),
      )
      await eaPage.getByRole('button', { name: '写真', exact: true }).click()
      await eaPage.waitForTimeout(400)

      // ---------- EA-2b: 開始日・終了日の手入力 ----------
      await eaPage.getByRole('button', { name: ja.mealPlan.rangeCostToggle, exact: true }).click()
      await eaPage.waitForTimeout(400)
      const eaStartInput = eaPage.locator('[data-testid="range-date-start"]')
      const eaEndInput = eaPage.locator('[data-testid="range-date-end"]')
      check(
        'RANGE-EA(便EA-2b) 期間モードに開始日・終了日の日付欄が出る',
        (await eaStartInput.count()) === 1 && (await eaEndInput.count()) === 1,
      )
      // まず「今日だけ」の期間で、今日の記録と予定の数え方を見る
      await eaStartInput.fill(eaToday)
      await eaPage.waitForTimeout(200)
      await eaEndInput.fill(eaToday)
      await eaPage.waitForTimeout(600)
      const eaCard = eaPage.locator('[data-testid="range-result-card"]')
      check('RANGE-EA(便EA-2b) 日付欄だけで期間の結果カードが出る', await eaCard.isVisible())
      /* 2026-08-26 便LH: 期間を選ぶと、月の食費・栄養のカードの中身がそのまま入れ替わる
         （別のカードは増えない）。カードは既定で畳んであるので、中身を読む前に開く */
      const eaOpenCard = async (testId) => {
        const btn = eaPage.locator(`[data-testid="${testId}"]`)
        if ((await btn.count()) === 0) return
        if ((await btn.first().getAttribute('aria-expanded')) === 'true') return
        await btn.first().click()
        await eaPage.waitForTimeout(350)
      }
      const eaOpenCards = async () => {
        await eaOpenCard('month-cost-toggle')
        await eaOpenCard('month-nutrition-toggle')
      }
      await eaOpenCards()
      const eaTodayCardText = (await eaCard.textContent()) ?? ''
      check(
        'RANGE-EA(便EA-3) 今日の「作った記録」1品と、まだ作っていない献立1品を分けて数える',
        /作った記録1[品件]と登録した献立1[品件]の栄養価を、1食分ずつ足して算出した数値です/.test(
          eaTodayCardText,
        ),
        `カード=${eaTodayCardText.match(/.{0,20}1食分ずつ足して算出した数値です/)?.[0]}`,
      )
      check(
        // 2026-08-26 便LH: 数え方の1行は、数字より先に読めるようカレンダーの下（選んだ期間の1行の
        // すぐ下）へ移した。カードの中ではなく画面全体から読む
        'RANGE-EA(便EA-3) 基準行が「今日は、作った記録があるものは記録…」と言う',
        ((await eaPage.textContent('body')) ?? '')
          .replaceAll('\u200b', '')
          .includes(ja.mealPlan.rangeBasisToday),
      )

      // ---------- EA-2a: 選んだ期間の文字が大きい ----------
      const eaPeriod = eaPage.locator('[data-testid="range-selected-period"]')
      const eaPeriodSize = await eaPeriod.evaluate((el) =>
        Number.parseFloat(getComputedStyle(el).fontSize),
      )
      const eaTitleSize = await eaCard
        .locator('h2')
        .first()
        .evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize))
      check(
        'RANGE-EA(便EA-2a) 選んだ期間の文字が、カードの見出しより大きい(16px以上)',
        eaPeriodSize >= 16 && eaPeriodSize > eaTitleSize,
        `期間=${eaPeriodSize}px 見出し=${eaTitleSize}px`,
      )

      // ---------- EA-2b: 月をまたぐ期間も計算する ----------
      await eaStartInput.fill(eaLastMonth)
      await eaPage.waitForTimeout(800)
      await eaOpenCards()
      const eaCrossText = (await eaCard.textContent()) ?? ''
      check(
        'RANGE-EA(便EA-2b) 月をまたぐ期間でも、表示中の月の外の「作った記録」を数える(記録2品)',
        /作った記録2[品件]と登録した献立1[品件]の栄養価を、1食分ずつ足して算出した数値です/.test(eaCrossText),
        `カード=${eaCrossText.match(/.{0,26}1食分ずつ足して算出した数値です/)?.[0]}`,
      )
      check(
        'RANGE-EA(便EA-2b) 月をまたぐ期間でも結果カードが空にならない',
        !eaCrossText.includes(ja.mealPlan.rangeIntakeEmpty),
      )
    } finally {
      await eaBrowser.close()
    }
  }

  // --- MEALPLAN-S1S2: 月セルの未来日プレビュー強化(S-1)と、献立ゼロの未来日を淡く可視化(S-2)。
  // 2026-07-25 便BU・docs/59。翌月(=全日が未来日)へ移動し、ある日にだけ夕食主菜を投入する。
  //  S-1: 予定のある未来日のセルに、点ではなく主菜名(肉じゃが)が出ること。
  //  S-2: 予定も記録も無い未来日のセルは控えめな点線枠(border-dashed)になり、予定のある日は実線のままなこと。
  // 月タブはPro機能のためIndexedDB直書きで解錠する(MEALPLAN-07と同手法)。 ---
  currentCheck = 'MEALPLAN-S1S2'
  {
    const s12Browser = await chromium.launch()
    const s12Context = await s12Browser.newContext()
    const s12Page = await s12Context.newPage()
    s12Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-S1S2] ${text}`)
    })
    s12Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-S1S2] ${err.message}`)
    })
    try {
      await s12Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await s12Page.waitForTimeout(1800) // 初回シード完了待ち

      const s12RecipeId = await s12Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.find((r) => r.title === '肉じゃが')?.id)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )

      // 翌月・10日の夕食主菜に肉じゃがを投入(翌月は全日が未来日=showPlanDotが立つ)
      const s12Now = new Date()
      const s12Next = new Date(s12Now.getFullYear(), s12Now.getMonth() + 1, 1)
      const s12Prefix = `${s12Next.getFullYear()}-${String(s12Next.getMonth() + 1).padStart(2, '0')}`
      const s12PlannedDate = `${s12Prefix}-10`
      await s12Page.evaluate(
        ({ recipeId, date }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId, role: 'main' })
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { recipeId: s12RecipeId, date: s12PlannedDate },
      )

      // Pro解錠(IndexedDB直書き)
      await s12Page.evaluate(async () => {
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

      await s12Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await s12Page.reload({ waitUntil: 'networkidle' })
      await s12Page.waitForTimeout(800)
      await s12Page.getByRole('button', { name: '月', exact: true }).click()
      await s12Page.waitForTimeout(400)
      // 翌月へ移動(全日が未来日になる)
      await s12Page.getByRole('button', { name: ja.mealPlan.nextMonth, exact: true }).click()
      await s12Page.waitForTimeout(400)

      const s12Grid = s12Page.locator('div.grid.grid-cols-7').last()
      // セルは主菜名を含むため ^10$ 完全一致では引けない。「10」を含むセル(唯一)をテキストで判定する
      const s12Day10 = s12Grid.locator('button').filter({ hasText: /10/ }).first()
      const s12Day10Text = (await s12Day10.textContent()) ?? ''
      check(
        'MEALPLAN-S1S2(S-1) 予定のある未来日セルに主菜名(肉じゃが)が出る(点ではなく名前)',
        s12Day10Text.includes('肉じゃが'),
        `day10Text=${s12Day10Text}`,
      )
      const s12Day10Cls = (await s12Day10.getAttribute('class')) ?? ''
      check(
        'MEALPLAN-S1S2(S-2) 予定のある未来日セルは実線のまま(点線ではない)',
        !s12Day10Cls.includes('border-dashed'),
        `day10Cls=${s12Day10Cls}`,
      )
      // 予定も記録も無い未来日(11日)は控えめな点線枠になる
      const s12Day11 = s12Grid.locator('button').filter({ hasText: /^11$/ }).first()
      const s12Day11Cls = (await s12Day11.getAttribute('class')) ?? ''
      check(
        'MEALPLAN-S1S2(S-2) 献立ゼロの未来日セルは控えめな点線枠(border-dashed)で可視化される',
        s12Day11Cls.includes('border-dashed'),
        `day11Cls=${s12Day11Cls}`,
      )
    } finally {
      await s12Browser.close()
    }
  }

  // --- MEALPLAN-S3: 別の週の献立を入れる(2026-07-25 便BU・docs/59)。週タブ「今日から7日間」表示にし、
  // 1週間前(source)にだけ夕食主菜を仕込み、今日(day0)には別の主菜を手動配置しておく。
  // 2026-08-21 便IO(オーナー承認済みの設計): 週タブの出しかたの2択とコピー元のプルダウンをやめ、
  // 「別の週から入れる」の画面（週を送って中身を見ながら選ぶ）へ移した。
  // ここでは入口→画面→実行の道すじと、非破壊の約束が変わっていないことを見る。
  // 確認ダイアログ承認で:
  //  ・空いている未来日(day1=今日+1)に先週の主菜(カレーライス)がコピーされること
  //  ・既に手動配置がある今日(day0)は上書きされず元のまま(肉じゃが)残ること(非破壊)
  //  ・確認文が「入る件数」と「残る」を明示する規約F準拠であること
  // を確認する。今日を含むローリング表示にすることで日付計算を決定的にする。 ---
  currentCheck = 'MEALPLAN-S3'
  {
    const cwBrowser = await chromium.launch()
    const cwContext = await cwBrowser.newContext()
    const cwPage = await cwContext.newPage()
    let cwDialogMsg = ''
    await collectConfirms(cwPage, (text) => {
      cwDialogMsg = text
    })
    cwPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-S3] ${text}`)
    })
    cwPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-S3] ${err.message}`)
    })
    try {
      await cwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cwPage.waitForTimeout(1800) // 初回シード完了待ち

      const cwIds = await cwPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const find = (t) => g.result.find((r) => r.title === t)?.id
                resolve({ curry: find('カレーライス'), nikujaga: find('肉じゃが') })
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )

      // 週の表示起点を「今日から7日間」に切り替え(weekStartsToday=trueを設定に記憶)。
      // 先週(source)= 今日-7 / 今日-6、今週= 今日(day0) / 今日+1(day1) を決定的に扱う
      await cwPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await cwPage.waitForTimeout(500)
      await cwPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(cwPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await cwPage.waitForTimeout(300)
      // 2026-08-03 便DJ: 「表示のしかた」グループは既定で畳まれているので先に開く
      await cwPage.getByRole('button', { name: '表示のしかたを開く' }).click()
      await cwPage.waitForTimeout(200)
      await selectWeekLayout(cwPage, ja.mealPlan.weekLayoutRolling)
      await cwPage.waitForTimeout(300)

      // IndexedDB直書きで先週2日分のsourceと、今週day0の手動配置を仕込む
      await cwPage.evaluate(
        ({ curry, nikujaga }) =>
          new Promise((resolve, reject) => {
            const toStr = (d) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const shift = (days) => {
              const d = new Date()
              d.setDate(d.getDate() + days)
              return toStr(d)
            }
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const store = tx.objectStore('mealPlans')
              store.add({ date: shift(-7), slot: 'dinner', recipeId: curry, role: 'main' }) // 先週day0
              store.add({ date: shift(-6), slot: 'dinner', recipeId: curry, role: 'main' }) // 先週day1
              store.add({ date: shift(0), slot: 'dinner', recipeId: nikujaga, role: 'main' }) // 今日=手動配置
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        cwIds,
      )
      await cwPage.reload({ waitUntil: 'networkidle' })
      await cwPage.waitForTimeout(800)
      await cwPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(cwPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await cwPage.waitForTimeout(400)

      // 2026-08-21 便IO: 入口は「過去の献立・テンプレートから入れる」の節にある。
      // 2026-08-22 便IV: その節は畳んだ状態から始まり、開くとこの入口が出る
      // （オーナー原文「テンプレートエリアは折りたたみ状態でボタンはなし。」）
      const cwEntry = cwPage.locator('[data-testid="week-copy-pick"]')
      check(
        'MEALPLAN-S3(便IV) 畳んでいるあいだ「過去の献立をコピー」の入口は出ていない',
        (await cwEntry.count()) === 0,
      )
      await openWeekGroup(cwPage, ja.mealPlan.weekGroupTemplateTitle)
      check(
        'MEALPLAN-S3(便IO) 節を開くと「過去の献立をコピー」の入口が出る',
        (await cwEntry.count()) === 1,
      )
      const cwWeekShown = await cwPage
        .locator('[data-testid="week-day-toggle"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute('data-date')))
      await cwEntry.click()
      await cwPage.waitForTimeout(900)
      const cwTarget = cwPage.locator('[data-testid="copy-pick-target"]')
      check(
        'MEALPLAN-S3(便IO) 入れ先は「週」の画面で表示していた7日間のまま(週を送っても動かない先)',
        cwWeekShown.length === 7 &&
          (await cwTarget.getAttribute('data-start')) === cwWeekShown[0] &&
          (await cwTarget.getAttribute('data-end')) === cwWeekShown[6],
        `入れ先=${await cwTarget.getAttribute('data-start')}〜${await cwTarget.getAttribute('data-end')} 週=${JSON.stringify(cwWeekShown)}`,
      )
      check(
        // 2026-08-19 便IF・⑧: 入れかたはコピーにも効く。2026-08-21 便IOでこの画面へ移った
        'MEALPLAN-S3(便IF-⑧) 入れかたはこの画面で選べる(既定は空いた枠だけ)',
        (await cwPage.locator('[data-testid="copy-pick-fill-mode"]').inputValue()) === 'fillEmpty',
      )
      await cwPage.locator('[data-testid="copy-pick-run"]').click()
      await cwPage.waitForTimeout(1800)

      /* 2026-08-27 便LT（オーナー原文「この週の献立をコピー押下後、確認画面は日付確認のみ。
         「今ある〜」削除。」）: 本文（旧 copyWeekConfirm「今ある献立◯品は…そのまま残ります。」）を
         外した＝規約Fの例外（2026-08-25 裁定D）。**見出しが入る先を言い切っている**ので、
         今ある献立に触らないことはそこから読める。見張りも見出しへ移す */
      check(
        'MEALPLAN-S3(便LT) 確認文が「入る品数」と「入る先」を明示する（規約F準拠）',
        /入れます/.test(cwDialogMsg) &&
          /\d+品/.test(cwDialogMsg) &&
          cwDialogMsg.includes('まだ決まっていないところ'),
        `dialog=${cwDialogMsg}`,
      )
      check(
        'MEALPLAN-S3(便LT) 見出しから読めること（今ある献立は残る）を、本文で言い直していない',
        !/そのまま残ります/.test(cwDialogMsg),
        `dialog=${cwDialogMsg}`,
      )
      check(
        'MEALPLAN-S3(便IO) 入れ終わると献立の「週」へ戻る(次の一手を探させない)',
        !cwPage.url().includes('copy-week'),
        cwPage.url(),
      )
      // 2026-08-19 便IF・④: 完了の知らせにも、入れた週の7日間の日付が入る
      const cwToast = (await cwPage.textContent('body')) ?? ''
      check(
        'MEALPLAN-S3 コピー完了トーストが出る',
        /\d{4}\/\d{2}\/\d{2}〜\d{4}\/\d{2}\/\d{2}の献立を\d+品入れました/.test(cwToast),
        cwToast.slice(0, 400),
      )

      // IndexedDBで結果を検証(day1=コピーされる / day0=手動配置が残る)
      const cwResult = await cwPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const toStr = (d) =>
              `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const shift = (days) => {
              const d = new Date()
              d.setDate(d.getDate() + days)
              return toStr(d)
            }
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => {
                const all = g.result
                const at = (date) => all.filter((e) => e.date === date && e.slot === 'dinner')
                resolve({ day0: at(shift(0)), day1: at(shift(1)) })
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-S3 空いていた未来日(今日+1)に先週の主菜(カレー)がコピーされる',
        cwResult.day1.length === 1 && cwResult.day1[0].recipeId === cwIds.curry,
        `day1=${JSON.stringify(cwResult.day1)}`,
      )
      check(
        'MEALPLAN-S3 手動配置のある今日(day0)は上書きされず元のまま(肉じゃが)残る=非破壊',
        cwResult.day0.length === 1 && cwResult.day0[0].recipeId === cwIds.nikujaga,
        `day0=${JSON.stringify(cwResult.day0)}`,
      )
    } finally {
      await cwBrowser.close()
    }
  }

  // --- MEALPLAN-SERV: 献立の食数(2026-08-03 便DJ・オーナー指示)。週の1品ごとに「何人分作るか」を
  // 決められ、それが買い物メモの分量に効くこと・「1人分」の栄養表示は動かないことを確認する。
  // 再発防止の要点: 既定(食数を触っていない)ときの分量が従来と1gも変わらないこと。 ---
  currentCheck = 'MEALPLAN-SERV'
  {
    const svBrowser = await chromium.launch()
    const svContext = await svBrowser.newContext()
    const svPage = await svContext.newPage()
    svPage.on('dialog', (dialog) => dialog.accept())
    svPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-SERV] ${text}`)
    })
    svPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-SERV] ${err.message}`)
    })
    try {
      await svPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await svPage.waitForTimeout(2000) // 初回シード完了待ち
      await svPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(svPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await svPage.waitForTimeout(400)
      // 今日の夕食・主菜にレシピを1品入れる。
      // 2026-08-22 便IV: 空き枠と食数のボタンは編集モードの中にしか出さない
      const svToday = await svPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'MEALPLAN-SERV 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(svPage, svToday)) === true,
      )
      await svPage.getByRole('button', { name: ja.mealPlan.emptyAssign }).first().click()
      await svPage.waitForTimeout(500)
      await svPage.locator('ul li button').first().click()
      await svPage.waitForTimeout(700)

      const svServingsBtn = svPage.getByRole('button', { name: /この行の食数を変える/ }).first()
      check(
        'MEALPLAN-SERV 入っている行に食数のボタンが出る(既定はレシピの登録人数分)',
        (await svServingsBtn.count()) === 1 &&
          /^\d+人分$/.test(((await svServingsBtn.textContent()) ?? '').trim()),
        `label=${(await svServingsBtn.textContent()) ?? ''}`,
      )
      const svBase = Number(((await svServingsBtn.textContent()) ?? '').replace(/[^0-9]/g, ''))

      // 既定(食数を触っていない)ときの買い物メモの分量を控える
      // (下書きの分量欄はtextarea。inputではないので取り違えないこと)
      const svReadAmounts = async () => {
        await svPage.waitForSelector('textarea', { timeout: 15000 })
        return svPage.evaluate(() =>
          [...document.querySelectorAll('textarea')]
            .map((t) => t.value)
            .filter((v) => v && /[0-9]/.test(v)),
        )
      }
      await svPage.getByRole('button', { name: ja.mealPlan.goToShopping }).click()
      await svPage.waitForTimeout(1200)
      const svAmountsBefore = await svReadAmounts()
      check(
        'MEALPLAN-SERV 前提: 献立から買い物メモの下書きができる',
        svAmountsBefore.length > 0,
        `amounts=${JSON.stringify(svAmountsBefore)}`,
      )

      // 食数を2倍にすると、同じ材料の分量も2倍になる
      await svPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await svPage.waitForTimeout(900)
      await svPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(svPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await svPage.waitForTimeout(400)
      await openWeekDayEdit(svPage, svToday) // 便IV: 食数のボタンは編集モードの中
      await svPage.getByRole('button', { name: /この行の食数を変える/ }).first().click()
      await svPage.waitForTimeout(400)
      for (let i = 0; i < svBase; i++) {
        await svPage.getByRole('button', { name: ja.mealPlan.servingsUp }).click()
      }
      await svPage.getByRole('button', { name: ja.mealPlan.servingsSave }).click()
      await svPage.waitForTimeout(700)
      check(
        'MEALPLAN-SERV 食数を変えると結果がトーストに出る',
        ((await svPage.textContent('body')) ?? '').includes(`を${svBase * 2}人分にしました`),
      )
      const svSaved = await svPage.evaluate(
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
      check(
        'MEALPLAN-SERV 食数は献立の行に任意項目として保存される',
        svSaved.length === 1 && svSaved[0].servings === svBase * 2,
        `saved=${JSON.stringify(svSaved)}`,
      )
      await svPage.getByRole('button', { name: ja.mealPlan.goToShopping }).click()
      await svPage.waitForTimeout(1200)
      const svAmountsAfter = await svReadAmounts()
      // 分量は「小さじ1/2」のような分数表記も出るので、分数のまま数値にして比べる
      const svNum = (v) => {
        const mixed = v.match(/(\d+)\s*と\s*(\d+)\/(\d+)/)
        if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
        const frac = v.match(/(\d+)\/(\d+)/)
        if (frac) return Number(frac[1]) / Number(frac[2])
        const dec = v.match(/\d+(?:\.\d+)?/)
        return dec ? Number(dec[0]) : 0
      }
      check(
        'MEALPLAN-SERV 食数を2倍にすると買い物メモの分量も2倍になる',
        svAmountsAfter.length === svAmountsBefore.length &&
          svAmountsBefore.every((v, i) => svNum(svAmountsAfter[i]) === svNum(v) * 2),
        `before=${JSON.stringify(svAmountsBefore)} after=${JSON.stringify(svAmountsAfter)}`,
      )
    } finally {
      await svBrowser.close()
    }
  }

  // --- SHOPRANGE-EA: 買い物メモの範囲えらび(2026-08-08 便EA・オーナー要望
  // 「選択した日付や時間帯レシピから買い物リスト作成したい。3日分とか、
  // １週間分まとめて買い物とは限らない」)。
  // 再発防止の要点: ①開かなければ従来どおり(ボタン名・下書きの中身が変わらない)
  // ②日付/食事を絞ると、その範囲の献立だけで下書きができる
  // ③買い物メモ側に「どの範囲から作ったか」が出る ---
  currentCheck = 'SHOPRANGE-EA'
  {
    const srBrowser = await chromium.launch()
    const srContext = await srBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const srPage = await srContext.newPage()
    srPage.on('dialog', (dialog) => dialog.accept())
    srPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOPRANGE-EA] ${err.message}`)
    })
    try {
      await srPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await srPage.waitForTimeout(2000) // 初回シード完了待ち
      await srPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(500)
      // 既定の「表示する食事」は夕食だけなので、朝食・昼食も出して3食で検証する
      // (範囲えらびの食事チップは「表示している食事」だけを出す仕様のため)
      const srSlotFilter = srPage.getByRole('group', { name: ja.mealPlan.slotFilterTitle })
      for (const name of ['朝食', '昼食']) {
        const btn = srSlotFilter.getByRole('button', { name, exact: true })
        if ((await btn.getAttribute('aria-pressed')) !== 'true') await btn.click()
        await srPage.waitForTimeout(300)
      }
      // 「次の週」へ移す＝7日とも未来日になり、実行日によって選べる日数が変わらない
      // (当週は今日より前の日が対象外なので、日曜に走らせると選べる日が1日しか無い)
      await srPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(700)
      // 週ぜんぶに献立を入れる(絞る前/絞った後を比べる材料を作る)
      await srPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await srPage.waitForTimeout(3000)

      // ---------- ①既定: 開かなければ従来どおり ----------
      check(
        `SHOPRANGE-EA(既定) 範囲えらびは閉じていて、要約は「${ja.mealPlan.shopRangeSummaryAll}」`,
        (await srPage.getByTestId('shop-range-toggle').getAttribute('aria-expanded')) === 'false' &&
          // 文言そのものは ja.ts から取る（書き写すと、名前を直したときにテストだけが赤くなる）
          ((await srPage.getByTestId('shop-range-summary').textContent()) ?? '').includes(
            ja.mealPlan.shopRangeSummaryAll,
          ),
      )
      check(
        'SHOPRANGE-EA(既定) 絞っていないときのボタン名は「買い物メモを作る」(便LH)',
        await srPage.getByRole('button', { name: ja.mealPlan.goToShopping }).isVisible(),
      )
      const srCountDraft = () => srPage.locator('textarea').count()
      await srPage.getByRole('button', { name: ja.mealPlan.goToShopping }).click()
      await srPage.waitForTimeout(1500)
      const srAll = await srCountDraft()
      check('SHOPRANGE-EA(既定) 週ぜんぶから下書きができる', srAll > 0, `rows=${srAll}`)
      // 絞っていないときは範囲の1行にも「表示している週全部」に当たる日付範囲が出る
      const srAllRange = (await srPage.getByTestId('candidate-range').textContent()) ?? ''
      check(
        'SHOPRANGE-EA(既定) 下書きに「どの範囲から作ったか」が出る',
        srAllRange.includes('から作りました') && /\d+\/\d+/.test(srAllRange),
        `range=${srAllRange}`,
      )

      // ---------- ②日付と食事で絞る ----------
      await srPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await srPage.waitForTimeout(1200)
      await srPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(500)
      await srPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(700)
      await srPage.getByTestId('shop-range-toggle').click()
      await srPage.waitForTimeout(300)
      const srDateChips = srPage.getByTestId('shop-range-date')
      const srDateCount = await srDateChips.count()
      check(
        'SHOPRANGE-EA(絞る) 日付のボタンは、今日以降の日だけ出る',
        srDateCount > 0 && srDateCount <= 7,
        `dates=${srDateCount}`,
      )
      check(
        'SHOPRANGE-EA(絞る) 開いた直後はすべての日付が選ばれている(既定=全部)',
        (await srPage.locator('[data-testid="shop-range-date"][aria-pressed="true"]').count()) ===
          srDateCount,
      )
      // 先頭の1日だけ残す
      for (let i = 1; i < srDateCount; i++) await srDateChips.nth(i).click()
      await srPage.waitForTimeout(300)
      check(
        'SHOPRANGE-EA(絞る) 絞るとボタン名が「選んだ範囲の買い物メモを作る」に変わる',
        await srPage.getByRole('button', { name: ja.mealPlan.goToShoppingPicked }).isVisible(),
      )
      const srKeptDate = await srDateChips.nth(0).getAttribute('data-date')
      await srPage.getByRole('button', { name: ja.mealPlan.goToShoppingPicked }).click()
      await srPage.waitForTimeout(1500)
      const srOneDay = await srCountDraft()
      check(
        'SHOPRANGE-EA(絞る) 1日だけ選ぶと、下書きは週ぜんぶより少なくなる',
        srOneDay > 0 && srOneDay < srAll,
        `oneDay=${srOneDay} all=${srAll}`,
      )
      const srRangeText = (await srPage.getByTestId('candidate-range').textContent()) ?? ''
      const srExpectedMd = `${Number(srKeptDate.slice(5, 7))}/${Number(srKeptDate.slice(8, 10))}`
      check(
        'SHOPRANGE-EA(絞る) 買い物メモ側に、選んだ日付が範囲として出る',
        srRangeText.includes(srExpectedMd) && srRangeText.includes('から作りました'),
        `range=${srRangeText} expected=${srExpectedMd}`,
      )

      // ---------- ③食事で絞る + 「表示している週全部に戻す」 ----------
      await srPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await srPage.waitForTimeout(1200)
      await srPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(500)
      await srPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(700)
      await srPage.getByTestId('shop-range-toggle').click()
      await srPage.waitForTimeout(300)
      const srSlotChips = srPage.getByTestId('shop-range-slot')
      const srSlotCount = await srSlotChips.count()
      for (let i = 0; i < srSlotCount - 1; i++) await srSlotChips.nth(i).click()
      await srPage.waitForTimeout(300)
      check(
        'SHOPRANGE-EA(絞る) 食事を絞ると要約にその食事だけが出る',
        ((await srPage.getByTestId('shop-range-summary').textContent()) ?? '').includes('夕食'),
        `summary=${await srPage.getByTestId('shop-range-summary').textContent()}`,
      )
      await srPage.getByRole('button', { name: ja.mealPlan.goToShoppingPicked }).click()
      await srPage.waitForTimeout(1500)
      const srDinnerOnly = await srCountDraft()
      check(
        'SHOPRANGE-EA(絞る) 夕食だけに絞ると、下書きは週ぜんぶより少なくなる',
        srDinnerOnly > 0 && srDinnerOnly < srAll,
        `dinner=${srDinnerOnly} all=${srAll}`,
      )
      await srPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await srPage.waitForTimeout(1200)
      await srPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(500)
      await srPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
      await openAllWeekDays(srPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await srPage.waitForTimeout(700)
      await srPage.getByTestId('shop-range-toggle').click()
      await srPage.waitForTimeout(300)
      await srPage.getByTestId('shop-range-slot').nth(0).click()
      await srPage.waitForTimeout(200)
      await srPage.getByRole('button', { name: ja.mealPlan.shopRangeReset }).click()
      await srPage.waitForTimeout(300)
      check(
        `SHOPRANGE-EA(絞る) 「${ja.mealPlan.shopRangeReset}」で既定へ戻る`,
        ((await srPage.getByTestId('shop-range-summary').textContent()) ?? '').includes(
          ja.mealPlan.shopRangeSummaryAll,
        ) && (await srPage.getByRole('button', { name: ja.mealPlan.goToShopping }).isVisible()),
      )
    } finally {
      await srBrowser.close()
    }
  }

  // --- MEALPLAN-HOUSE: 設定「食数の設定」(2026-08-03 便DK・オーナー確定
  // 「3人家族なら予算や買い物メモは3人分で計算した数値が必要。栄養は1人当たりのみで十分」)。
  // 設定→献立→買い物→食費を一続きに通し、同じ献立が
  //   ①未設定なら従来どおり(登録人数分) ②設定するとその人数分の分量・金額になる
  // ことを、同じ画面・同じ献立の前後比較で見張る。
  // 4人分を選ぶのは、同梱の「肉じゃが」が2人分登録なのでちょうど2倍になり、
  // 丸め誤差なしで分量・金額を突き合わせられるため。 ---
  currentCheck = 'MEALPLAN-HOUSE'
  {
    const hhBrowser = await chromium.launch()
    const hhContext = await hhBrowser.newContext()
    const hhPage = await hhContext.newPage()
    hhPage.on('dialog', (dialog) => dialog.accept())
    hhPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-HOUSE] ${text}`)
    })
    hhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-HOUSE] ${err.message}`)
    })
    try {
      await hhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await hhPage.waitForTimeout(2000) // 初回シード完了待ち
      await hhPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(hhPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await hhPage.waitForTimeout(400)
      // 今日の最初の空き枠に「肉じゃが」(登録2人分)を入れる。
      // 2026-08-22 便IV: 空き枠と食数のボタンは編集モードの中にしか出さない
      const hhToday = await hhPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'MEALPLAN-HOUSE 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(hhPage, hhToday)) === true,
      )
      await hhPage.getByRole('button', { name: ja.mealPlan.emptyAssign }).first().click()
      await hhPage.waitForTimeout(500)
      await hhPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await hhPage.waitForTimeout(300)
      await hhPage.getByText('肉じゃが', { exact: true }).first().click()
      await hhPage.waitForTimeout(800)

      const hhChip = () =>
        hhPage.getByRole('button', { name: /この行の食数を変える/ }).first().textContent()
      const hhNum = (v) => Number((v ?? '').replace(/[^0-9]/g, ''))
      const hhBase = hhNum(await hhChip())
      check(
        'MEALPLAN-HOUSE 前提: 食数の設定が未設定なら行はレシピの登録人数分(2人分)',
        hhBase === 2,
        `chip=${await hhChip()}`,
      )
      // 未設定のときの概算食費(合計金額)と注記を控える
      const hhOpenCost = async () => {
        // 2026-08-25 便KU: 概算食費は節の中（節を開けば金額まで出る。名前は便LHで「食費」）
        await openWeekGroup(hhPage, ja.mealPlan.weekGroupCostTitle)
        await hhPage.waitForTimeout(500)
        const text = (await hhPage.textContent('body')) ?? ''
        return {
          yen: Number((text.match(/約([\d,]+)円/)?.[1] ?? '0').replace(/,/g, '')),
          note: text.match(/作る食数ぶん（合計(\d+)人分）の金額です/)?.[1],
        }
      }
      const hhCostBefore = await hhOpenCost()
      check(
        'MEALPLAN-HOUSE 概算食費の注記が「作る食数ぶん（合計◯人分）」になっている',
        hhCostBefore.note === '2' && hhCostBefore.yen > 0,
        JSON.stringify(hhCostBefore),
      )
      // 未設定のときの買い物メモの分量(下書きの分量欄はtextarea)
      const hhReadAmounts = async () => {
        await hhPage.waitForSelector('textarea', { timeout: 15000 })
        return hhPage.evaluate(() =>
          [...document.querySelectorAll('textarea')]
            .map((t) => t.value)
            .filter((v) => v && /[0-9]/.test(v)),
        )
      }
      await hhPage.getByRole('button', { name: ja.mealPlan.goToShopping }).click()
      await hhPage.waitForTimeout(1200)
      const hhAmountsBefore = await hhReadAmounts()
      check(
        'MEALPLAN-HOUSE 前提: 献立から買い物メモの下書きができる',
        hhAmountsBefore.length > 0,
        `amounts=${JSON.stringify(hhAmountsBefore)}`,
      )

      // レシピ詳細の人数ステッパーは、未設定なら従来どおり登録人数分(2人分)で開く
      await hhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await hhPage.waitForTimeout(800)
      const hhOpenDetail = async () => {
        await hhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await hhPage.waitForTimeout(900)
        await hhPage.getByText('肉じゃが', { exact: true }).first().click()
        await hhPage.waitForTimeout(700)
        const shown = await hhPage.locator('span.min-w-14').first().textContent()
        return {
          servings: hhNum(shown),
          registered: ((await hhPage.textContent('body')) ?? '').match(/登録: (\d+)人分/)?.[1],
        }
      }
      const hhDetailBefore = await hhOpenDetail()
      check(
        'MEALPLAN-HOUSE 未設定ならレシピ詳細は登録人数分(2人分)で開く',
        hhDetailBefore.servings === 2,
        JSON.stringify(hhDetailBefore),
      )

      // --- 設定「食数の設定」を4人分にする ---
      await hhPage.goto(`${BASE}/#/settings?section=household`, { waitUntil: 'networkidle' })
      await hhPage.waitForTimeout(900)
      const hhSelect = hhPage.getByLabel(ja.settings.householdServingsTitle)
      check(
        'MEALPLAN-HOUSE 設定の個人設定節に「食数の設定」がある(既定は設定しない)',
        (await hhSelect.count()) === 1 && (await hhSelect.inputValue()) === '',
        `count=${await hhSelect.count()} value=${await hhSelect.inputValue()}`,
      )
      check(
        'MEALPLAN-HOUSE 説明は効く先(買い物の分量・食費)と効かない先(栄養の1人分)を両方書く',
        ((await hhPage.textContent('body')) ?? '').includes(
          'レシピの表示や、献立の買い物の分量・食費を計算するときの基準として扱います。栄養の「1人分」の表示は変わりません',
        ),
      )
      await hhSelect.selectOption('4')
      await hhPage.waitForTimeout(600)

      // 献立の行・概算食費・買い物メモが4人分になる
      await hhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await hhPage.waitForTimeout(1200)
      await hhPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(hhPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await openWeekDayEdit(hhPage, hhToday) // 便IV: 食数のボタンは編集モードの中
      await hhPage.waitForTimeout(500)
      check(
        'MEALPLAN-HOUSE 食数を決めていない行は「食数の設定」で表示される(4人分)',
        hhNum(await hhChip()) === 4,
        `chip=${await hhChip()}`,
      )
      const hhCostAfter = await hhOpenCost()
      check(
        'MEALPLAN-HOUSE 概算食費は作る食数ぶん(2人分→4人分でちょうど2倍・注記も4人分)',
        hhCostAfter.note === '4' && hhCostAfter.yen === hhCostBefore.yen * 2,
        `before=${JSON.stringify(hhCostBefore)} after=${JSON.stringify(hhCostAfter)}`,
      )
      await hhPage.getByRole('button', { name: ja.mealPlan.goToShopping }).click()
      await hhPage.waitForTimeout(1200)
      const hhAmountsAfter = await hhReadAmounts()
      const hhAmountNum = (v) => {
        const mixed = v.match(/(\d+)\s*と\s*(\d+)\/(\d+)/)
        if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
        const frac = v.match(/(\d+)\/(\d+)/)
        if (frac) return Number(frac[1]) / Number(frac[2])
        const dec = v.match(/\d+(?:\.\d+)?/)
        return dec ? Number(dec[0]) : 0
      }
      check(
        'MEALPLAN-HOUSE 買い物メモの分量も「食数の設定」ぶん(2倍)になる',
        hhAmountsAfter.length === hhAmountsBefore.length &&
          hhAmountsBefore.every((v, i) => hhAmountNum(hhAmountsAfter[i]) === hhAmountNum(v) * 2),
        `before=${JSON.stringify(hhAmountsBefore)} after=${JSON.stringify(hhAmountsAfter)}`,
      )

      // レシピ詳細も「食数の設定」で開き、元の登録人数は併記で残る
      const hhDetailAfter = await hhOpenDetail()
      check(
        'MEALPLAN-HOUSE レシピ詳細は「食数の設定」(4人分)で開く',
        hhDetailAfter.servings === 4,
        JSON.stringify(hhDetailAfter),
      )
      // 2026-08-25 便KS・③（オーナー原文「レシピ詳細の材料下段「登録：◯人分」がここに
      // 書いてあると、材料の原価などがその人数分であるかのように見える。削除。知りたかったら
      // 編集で確認できるし。」）: **併記は無くなった**。ここは「出ないこと」を見張る側に回す
      // ＝黙って検査を消さず、オーナーの裁定を守る形にして残す
      check(
        'MEALPLAN-HOUSE レシピ詳細に「登録: ◯人分」を併記しない（2026-08-25 オーナー指示）',
        hhDetailAfter.registered === undefined,
        JSON.stringify(hhDetailAfter),
      )
      // 栄養の「1人分」(折りたたんだ1行のkcal)は、開いた人数が何人分でも動かないこと
      const hhKcal = async () =>
        ((await hhPage.textContent('body')) ?? '').match(/([\d,]+)kcal/)?.[1]
      const hhKcalBefore = await hhKcal()
      await hhPage.getByRole('button', { name: ja.detail.servingsUp }).click()
      await hhPage.waitForTimeout(500)
      check(
        'MEALPLAN-HOUSE 詳細で手で人数を変えるとその画面ではそちらが優先(4→5人分)',
        hhNum(await hhPage.locator('span.min-w-14').first().textContent()) === 5,
      )
      const hhKcalAfter = await hhKcal()
      check(
        'MEALPLAN-HOUSE 栄養の「1人分」は人数を変えても動かない',
        hhKcalBefore != null && hhKcalAfter === hhKcalBefore,
        `before=${hhKcalBefore} after=${hhKcalAfter}`,
      )

      // 枠ごとに決めた食数は「食数の設定」より強い。戻すボタンは既定(=4人分)を名乗る
      await hhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await hhPage.waitForTimeout(1000)
      await hhPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(hhPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await openWeekDayEdit(hhPage, hhToday) // 便IV: 食数のボタンは編集モードの中
      await hhPage.waitForTimeout(400)
      await hhPage.getByRole('button', { name: /この行の食数を変える/ }).first().click()
      await hhPage.waitForTimeout(400)
      check(
        'MEALPLAN-HOUSE 食数の窓に設定の「食数の設定」の値が出る',
        ((await hhPage.textContent('body')) ?? '').includes('設定の「食数の設定」は4人分です'),
      )
      await hhPage.getByRole('button', { name: ja.mealPlan.servingsUp }).click()
      await hhPage.getByRole('button', { name: ja.mealPlan.servingsSave }).click()
      await hhPage.waitForTimeout(700)
      check(
        'MEALPLAN-HOUSE 枠ごとに決めた食数は「食数の設定」より優先される(5人分)',
        hhNum(await hhChip()) === 5,
        `chip=${await hhChip()}`,
      )
      await hhPage.getByRole('button', { name: /この行の食数を変える/ }).first().click()
      await hhPage.waitForTimeout(400)
      check(
        'MEALPLAN-HOUSE 戻すボタンは戻り先の人数(既定の4人分)を名乗る',
        (await hhPage.getByRole('button', { name: '既定の4人分に戻す' }).count()) === 1,
      )
      await hhPage.getByRole('button', { name: '既定の4人分に戻す' }).click()
      await hhPage.waitForTimeout(700)
      check(
        'MEALPLAN-HOUSE 「既定に戻す」で食数の設定(4人分)に戻る',
        hhNum(await hhChip()) === 4,
        `chip=${await hhChip()}`,
      )
    } finally {
      await hhBrowser.close()
    }
  }
