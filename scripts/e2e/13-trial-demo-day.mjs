// ==========================================================================================
// e2e の節: お試し・デモ・献立の「日」の作り直し
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
// この中の節: TRIAL-01, TRIAL-02, DEMO-01, DISCLOSE-01, DAYLAYOUT-01, DAYMODE-01, DAYFLOW-01, DAYDEFAULT-01, WEEKSELECT-01, KKGENRE-01
// ==========================================================================================
import './_shared.mjs'

  // --- TRIAL-01: 並行調理ナビの恒常お試し（docs/62 決定③）。
  // 未解錠の入口の鍵が「お試しで使ってみる（あと{n}回）」になり、押すと本物のナビが開く。
  // 3回で使い切ると「お試しは終了しました。続きはPro版で」＋鍵表示に戻ること。
  //
  // 2026-08-08 便ED で「1回」の数え方が変わった（オーナー実機フィードバック①の帰結）:
  // 作りかけの段取りを覚えるようにしたため、**他のタブへ行って戻ってもお試しは続く**
  // （以前は画面を離れるたびに1回ずつ失っていた＝タブを移動するだけで3回使い切る）。
  // 1回のお試しが終わるのは「戻る」を押したとき・「まとめて作った！」で記録したとき・
  // アプリのウィンドウを閉じたとき。回数の消費（settings.cookNaviTrialCount）は従来どおり
  // 「お試しで使ってみる」を押した瞬間の1回だけ。 ---
  currentCheck = 'TRIAL-01'
  {
    const t1Browser = await chromium.launch()
    const t1Context = await t1Browser.newContext({ viewport: { width: 390, height: 844 } })
    const t1Page = await t1Context.newPage()
    t1Page.on('pageerror', (err) => errors.push(`[pageerror@TRIAL-01] ${err.message}`))
    try {
      await t1Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await t1Page.waitForTimeout(1800)
      // 「お試し中は本物のナビ全機能」を確かめるため、今日の献立に2品を入れておく
      // （NAVI-01と同じ直書き。Pro解錠はしない＝お試しだけで動くことを見る）
      await t1Page.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const db = await openDb()
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const all = await P(store('recipes').getAll())
        const picked = all.slice(0, 2)
        let addedAt = Date.now()
        for (const r of picked) await P(store('todayList').add({ recipeId: r.id, addedAt: addedAt++ }))
        db.close()
      })
      // 直書きはDexieの変更通知を出さないため、購読中のliveQueryが空のままになる。必ず読み直す
      await t1Page.reload({ waitUntil: 'networkidle' })
      await t1Page.waitForTimeout(1000)

      const t1Start = t1Page.locator('[data-testid="cook-navi-trial-start"]')
      for (let i = 3; i >= 1; i--) {
        await t1Page.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
        await t1Page.waitForTimeout(600)
        check(
          `TRIAL-01 ${4 - i}回目: 入口の鍵が「お試しで使ってみる（あと${i}回）」になる`,
          ((await t1Start.textContent()) ?? '').includes(`あと${i}回`),
          `text=${await t1Start.textContent()}`,
        )
        await t1Start.click()
        await t1Page.waitForTimeout(600)
        const t1Body = (await t1Page.textContent('body')) ?? ''
        check(
          `TRIAL-01 ${4 - i}回目: お試し中は本物のナビが開く（ゲートが消える・全機能そのまま）`,
          !t1Body.includes(ja.cookNavi.gateTitle) &&
            t1Body.includes(ja.cookNavi.selectTitle) &&
            t1Body.includes('2品を選択中'),
          `body先頭=${t1Body.slice(0, 200)}`,
        )
        const t1ActiveText =
          (await t1Page.locator('[data-testid="cook-navi-trial-active"]').textContent()) ?? ''
        check(
          `TRIAL-01 ${4 - i}回目: お試し中である旨と残り回数を控えめに出す`,
          i > 1 ? t1ActiveText.includes(`このあと${i - 1}回`) : t1ActiveText.includes('最後の1回'),
          `text=${t1ActiveText}`,
        )
        // 便ED: 他のタブへ行って戻ってもお試しは続く（回数を余分に失わない）
        await t1Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await t1Page.waitForTimeout(300)
        await t1Page.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
        await t1Page.waitForTimeout(600)
        check(
          `TRIAL-01 ${4 - i}回目: 画面を移動して戻ってもお試しは続く（回数を余分に消費しない）`,
          (await t1Start.count()) === 0 &&
            stripZwspText(await t1Page.textContent('body')).includes(ja.cookNavi.selectTitle),
        )
        // 「戻る」でこの1回のお試しを終える（次に開くと残り回数の案内に戻る）。
        // 2026-08-09 便ES: 段取り（選んだ品）は戻るでは消さない＝お試しだけが終わる
        await t1Page.getByRole('button', { name: ja.common.back }).first().click()
        await t1Page.waitForTimeout(500)
      }
      // 3回使い切ったら、鍵表示＋「お試しは終了しました。続きはPro版で」に戻る
      await t1Page.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
      await t1Page.waitForTimeout(600)
      check('TRIAL-01 使い切ったらお試しボタンは出ない', (await t1Start.count()) === 0)
      check(
        'TRIAL-01 使い切ったら「お試しは終了しました。続きはPro版で」を出す',
        ((await t1Page.locator('[data-testid="cook-navi-trial-exhausted"]').textContent()) ?? '').includes(
          'お試しは終了しました',
        ),
      )
      check(
        'TRIAL-01 使い切ったらゲート（鍵）表示に戻る',
        stripZwspText(await t1Page.textContent('body')).includes(ja.cookNavi.gateTitle),
      )
      const t1Count = await t1Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readonly')
              const g = tx.objectStore('settings').get(1)
              g.onsuccess = () => resolve(g.result?.cookNaviTrialCount)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('TRIAL-01 お試し回数は端末内（settings）に3で止まる', t1Count === 3, `count=${t1Count}`)
    } finally {
      await t1Browser.close()
    }
  }

  // --- TRIAL-02: 月間献立の恒常お試し（docs/62 決定③）。
  // 未解錠のロックプレビューから「1回だけ表示」で本物の月タブが開き、
  // 「この画面がいつでも見られるようになります」の一言が出ること。
  // 閉じたら（別タブへ移って戻ったら）ロック表示に戻り、2回目は出せないこと。
  // 2026-08-02 オーナー指摘: 「作った記録」が5件たまるまでは入口を出さず、控えめな一言に
  // 差し替える（記録0件で1回きりのお試しを使い切り、ほぼ空のカレンダーを見て終わる事故を防ぐ）。---
  currentCheck = 'TRIAL-02'
  {
    const t2Browser = await chromium.launch()
    const t2Context = await t2Browser.newContext({ viewport: { width: 390, height: 844 } })
    const t2Page = await t2Context.newPage()
    t2Page.on('pageerror', (err) => errors.push(`[pageerror@TRIAL-02] ${err.message}`))
    try {
      await t2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await t2Page.waitForTimeout(1800)
      await t2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await t2Page.getByRole('button', { name: '月', exact: true }).click()
      await t2Page.waitForTimeout(500)

      // まず「作った記録」が0件の状態。入口は出さず、たまったら使えることだけ知らせる
      check(
        'TRIAL-02(2026-08-02) 記録が少ないうちはお試しの入口を出さない',
        (await t2Page.locator('[data-testid="month-trial-start"]').count()) === 0,
      )
      check(
        'TRIAL-02(2026-08-02) 代わりに「5件たまったらお試しできます」を控えめに出す',
        (
          (await t2Page.locator('[data-testid="month-trial-pending"]').textContent()) ?? ''
        ).includes('5件たまったらお試しできます'),
      )

      // 「作った記録」を5件入れると入口が出る（記録はレシピに埋め込みの配列）
      await t2Page.evaluate(
        (n) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const targets = g.result.slice(0, n)
                const wtx = idb.transaction('recipes', 'readwrite')
                const store = wtx.objectStore('recipes')
                for (const r of targets) {
                  store.put({ ...r, cookedLogs: [{ date: '2026-07-20' }] })
                }
                wtx.oncomplete = () => resolve(undefined)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        5,
      )
      await t2Page.reload({ waitUntil: 'networkidle' })
      await t2Page.waitForTimeout(1200)
      await t2Page.getByRole('button', { name: '月', exact: true }).click()
      await t2Page.waitForTimeout(600)

      const t2Start = t2Page.locator('[data-testid="month-trial-start"]')
      check('TRIAL-02 記録が5件たまるとロックプレビューにお試しの入口が出る', await t2Start.isVisible())
      check(
        'TRIAL-02 入口の文言は「1回だけ表示」(2026-08-02 簡潔化)',
        ((await t2Start.textContent()) ?? '').trim() === '1回だけ表示',
        `文言=${(await t2Start.textContent()) ?? ''}`,
      )
      await t2Start.click()
      await t2Page.waitForTimeout(700)
      const t2Body = (await t2Page.textContent('body')) ?? ''
      check(
        'TRIAL-02 お試しで本物の月タブが開く（ロック案内が消える）',
        !t2Body.includes(ja.mealPlan.monthLockedTitle) && t2Body.includes('月の食費'),
      )
      check(
        'TRIAL-02 表示中に「この画面がいつでも見られるようになります」を控えめに添える',
        ((await t2Page.locator('[data-testid="month-trial-active"]').textContent()) ?? '').includes(
          'いつでも見られるようになります',
        ),
      )
      // 閉じる（別タブへ移って戻る）とロックへ戻り、2回目は出せない
      await t2Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(t2Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await t2Page.waitForTimeout(400)
      await t2Page.getByRole('button', { name: '月', exact: true }).click()
      await t2Page.waitForTimeout(500)
      check(
        'TRIAL-02 閉じたらロック表示に戻る',
        stripZwspText(await t2Page.textContent('body')).includes(ja.mealPlan.monthLockedTitle),
      )
      check('TRIAL-02 お試しは1回だけ（2回目のボタンは出ない）', (await t2Start.count()) === 0)
      check(
        'TRIAL-02 使い切ったことを控えめに知らせる',
        ((await t2Page.locator('[data-testid="month-trial-used"]').textContent()) ?? '').includes('ご利用済み'),
      )
    } finally {
      await t2Browser.close()
    }
  }

  // --- DEMO-01: 月間画面のサンプルデモ（2026-08-02 便DC）。
  // 未解錠・記録0件（＝1回だけのお試しの入口がまだ出ない状態）でも「サンプルで見る」は常時出て、
  // 押すと見本の1か月分が入った本物の月タブが開くこと。写真つきのセル・カレンダーの表示のしかたの
  // 切り替え・日の窓が実際に触れること。そしてデモを触っても端末のIndexedDBが1バイトも変わらず、
  // 1回だけのお試し（settings.monthTrialUsed）も消費しないこと。---
  currentCheck = 'DEMO-01'
  {
    const dmBrowser = await chromium.launch()
    const dmContext = await dmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dmPage = await dmContext.newPage()
    dmPage.on('pageerror', (err) => errors.push(`[pageerror@DEMO-01] ${err.message}`))
    /** IndexedDBの全ストアを丸ごと文字列化する（Blobは中身ではなくバイト数で比べる） */
    const dmSnapshot = () =>
      dmPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const names = Array.from(idb.objectStoreNames)
              if (names.length === 0) return resolve('{}')
              const tx = idb.transaction(names, 'readonly')
              const out = {}
              let left = names.length
              for (const name of names) {
                const g = tx.objectStore(name).getAll()
                g.onsuccess = () => {
                  out[name] = g.result.map((row) =>
                    JSON.stringify(row, (_k, v) =>
                      typeof Blob !== 'undefined' && v instanceof Blob ? `blob:${v.size}` : v,
                    ),
                  )
                  left -= 1
                  if (left === 0) resolve(JSON.stringify(out))
                }
                g.onerror = () => reject(g.error)
              }
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await dmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(2000)
      await dmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dmPage.getByRole('button', { name: '月', exact: true }).click()
      await dmPage.waitForTimeout(600)

      // 記録0件＝1回だけのお試しはまだ出ない状態でも、サンプルの入口は出る（お試しとは独立）
      check(
        'DEMO-01 記録が無くてもロック案内に「サンプルで見る」が出る',
        (await dmPage.locator('[data-testid="month-trial-start"]').count()) === 0 &&
          (await dmPage.locator('[data-testid="month-demo-link"]').isVisible()),
      )
      const dmBefore = await dmSnapshot()

      await dmPage.locator('[data-testid="month-demo-link"]').click()
      await dmPage.waitForTimeout(1500)
      check(
        'DEMO-01 サンプルであることを帯で言い切る',
        ((await dmPage.locator('[data-testid="month-demo-banner"]').textContent()) ?? '').includes(ja.mealPlan.monthDemoBannerTitle),
      )
      // 2026-08-07 便DU: 食費・栄養のカードは折りたたみになった(既定は畳む)ので、中身を読む前に開く
      await dmPage.getByRole('button', { name: /月の食費/ }).click()
      await dmPage.waitForTimeout(300)
      await dmPage.getByRole('button', { name: /月の栄養（1人分）/ }).click()
      await dmPage.waitForTimeout(300)
      const dmBody = (await dmPage.textContent('body')) ?? ''
      check(
        'DEMO-01 本物の月タブが見本のデータで開く（ロック案内は出ない）',
        !dmBody.includes(ja.mealPlan.monthLockedTitle) &&
          dmBody.includes('5月の食費') &&
          dmBody.includes('5/1〜5/23は作った記録'),
        `body先頭=${dmBody.slice(0, 160)}`,
      )
      // 2026-08-03 便DQ: 食費の表(一人分・全員分・1日あたりの平均)と、別カードになった栄養の
      // 8項目が、見本の1か月でも数値としてそろって出る。
      // 1日あたりの平均は「全員分 ÷ ◯日」＝画面の上だけで検算できる形で出す
      // (2026-08-19 便HV・⑨で分母が「記録か献立のある日数」になった。分母の数は画面から読む)
      const dmCostTable = (await dmPage.locator('table', { hasText: ja.mealPlan.intakeCostRowPersonalNote }).first().textContent()) ?? ''
      const dmPerDay = /全員分[^約]{0,20}約([\d,]+)円のべ\d+食1日あたりの平均[^÷]{0,10}÷[^\d]{0,20}(\d+)日約([\d,]+)円/.exec(dmCostTable)
      check(
        'DEMO-01(便DQ・便HV) 食費の表に「全員分」と「1日あたりの平均(全員分÷◯日)」が出て、割り算が合う',
        !!dmPerDay &&
          Number(dmPerDay[2]) > 0 &&
          Math.round(Number(dmPerDay[1].replaceAll(',', '')) / Number(dmPerDay[2])) ===
            Number(dmPerDay[3].replaceAll(',', '')),
        `表=${dmCostTable.slice(0, 260)}`,
      )
      check(
        'DEMO-01(便DQ・便DU) 栄養は「5月の栄養（1人分）」の別カードで、開くと8項目が出る',
        dmBody.includes('5月の栄養（1人分）') &&
          dmBody.includes('たんぱく質') &&
          dmBody.includes('カルシウム'),
      )
      check(
        'DEMO-01 カレンダーに写真つきのセルが出る',
        (await dmPage.locator('[data-date="2026-05-09"] img').count()) === 1,
      )
      check(
        'DEMO-01 デモには献立を書き換える操作を出さない',
        !dmBody.includes('献立をまとめて提案') && !dmBody.includes('テンプレートを適用'),
      )
      // カレンダーの表示のしかた（写真⇄栄養⇄食費）が実際に切り替わる
      await dmPage.getByRole('button', { name: '食費', exact: true }).click()
      await dmPage.waitForTimeout(500)
      check(
        'DEMO-01 「食費」に切り替えると各日に金額が出る',
        ((await dmPage.locator('[data-date="2026-05-09"]').textContent()) ?? '').includes('円'),
      )
      await dmPage.getByRole('button', { name: ja.mealPlan.monthCellModeNutrition, exact: true }).click()
      await dmPage.waitForTimeout(500)
      check(
        'DEMO-01 「栄養」に切り替えると各日にエネルギーが出る',
        (
          (await dmPage.locator('[data-date="2026-05-09"]').getAttribute('aria-label')) ?? ''
        ).includes('kcal'),
      )
      await dmPage.getByRole('button', { name: '写真', exact: true }).click()
      await dmPage.waitForTimeout(400)
      // 日の窓は読むだけ（編集欄・メモ欄・週へのジャンプは出さない）
      await dmPage.locator('[data-date="2026-05-07"]').click()
      await dmPage.waitForTimeout(500)
      const dmModal = (await dmPage.getByRole('dialog').textContent()) ?? ''
      check(
        'DEMO-01 過ぎた日の窓にその日の作った記録が出る',
        dmModal.includes('作った記録') && dmModal.includes('鮭の塩焼き'),
        `modal=${dmModal.slice(0, 160)}`,
      )
      check(
        'DEMO-01 デモの日の窓に編集欄・週へのジャンプは出さない',
        !dmModal.includes('この週を開く') && !dmModal.includes('この日のメモ'),
      )
      await dmPage.keyboard.press('Escape')
      await dmPage.waitForTimeout(300)
      // 月を移動して戻る（見本は5月だけなので、移動先は空になるのが正しい）
      await dmPage.getByRole('button', { name: ja.mealPlan.nextMonth }).click()
      await dmPage.waitForTimeout(500)
      await dmPage.getByRole('button', { name: ja.mealPlan.thisMonth }).click()
      await dmPage.waitForTimeout(500)
      check(
        'DEMO-01 月を移動して戻ると見本の月に戻る',
        (await dmPage.locator('[data-date="2026-05-09"] img').count()) === 1,
      )

      const dmAfter = await dmSnapshot()
      check('DEMO-01 デモを触っても端末のデータ(IndexedDB)は変わらない', dmAfter === dmBefore)

      // 閉じると元の画面（月タブ）へ戻り、1回だけのお試しは使われていない
      await dmPage.locator('[data-testid="month-demo-close"]').click()
      await dmPage.waitForTimeout(800)
      await dmPage.getByRole('button', { name: '月', exact: true }).click()
      await dmPage.waitForTimeout(600)
      check(
        'DEMO-01 閉じたら元の月タブ（ロック案内）へ戻る',
        stripZwspText(await dmPage.textContent('body')).includes(ja.mealPlan.monthLockedTitle),
      )
      check(
        'DEMO-01 デモは1回だけのお試しを消費しない',
        (
          (await dmPage.locator('[data-testid="month-trial-pending"]').textContent()) ?? ''
        ).includes('5件たまったらお試しできます'),
      )
      check(
        'DEMO-01 サンプルの入口は回数制限なく出続ける',
        await dmPage.locator('[data-testid="month-demo-link"]').isVisible(),
      )

      // 設定のPro節からも同じデモへ入れて、閉じると設定へ戻る
      await dmPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1200)
      await dmPage.locator('[data-testid="settings-month-demo-link"]').click()
      await dmPage.waitForTimeout(1500)
      check(
        'DEMO-01 設定のPro紹介からもデモへ入れる',
        await dmPage.locator('[data-testid="month-demo-banner"]').isVisible(),
      )
      await dmPage.locator('[data-testid="month-demo-close"]').click()
      await dmPage.waitForTimeout(800)
      check(
        'DEMO-01 設定から入ったときは閉じると設定へ戻る',
        ((await dmPage.textContent('body')) ?? '').includes('購入と解錠'),
        `url=${dmPage.url()}`,
      )

      /* 2026-08-29 便MK: この節の頭の判定は `month-trial-start` の count()===0（お試しの入口が
         まだ出ない状態）を見ているのに、同じ節では一度も「出る」側を測っていなかった
         ＝目印が変わっても必ず緑になる（便LOの走査で 13:285 として残っていた1件）。
         **いちばん最後に**、記録を5件入れて入口が出るところまで作って対にする
         （端末のデータを見比べる判定はすでに終わっているので、増やしても巻き添えにしない）。 */
      await dmPage.evaluate(
        (n) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const targets = g.result.slice(0, n)
                const wtx = idb.transaction('recipes', 'readwrite')
                const store = wtx.objectStore('recipes')
                for (const r of targets) {
                  store.put({ ...r, cookedLogs: [{ date: '2026-07-20' }] })
                }
                wtx.oncomplete = () => resolve(undefined)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        5,
      )
      // 生のIndexedDBへ書いたので読み込み直す（Dexieのライブ購読はDexie経由しか見ていない・禁じ手⑥）
      await dmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dmPage.reload({ waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1500)
      // タブの名前は ja.ts から読む（画面の日本語を書き写さない・禁じ手②）
      await dmPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await dmPage.waitForTimeout(700)
      check(
        'DEMO-01 前提: 記録が5件たまればお試しの入口は出る（目印が生きている）',
        await dmPage.locator('[data-testid="month-trial-start"]').isVisible(),
      )
      check(
        'DEMO-01 入口が出たあとも、サンプルの入口は並んで出続ける（お試しとは別の道）',
        await dmPage.locator('[data-testid="month-demo-link"]').isVisible(),
      )
    } finally {
      await dmBrowser.close()
    }
  }

  // --- DISCLOSE-01: 購入前の精度開示（docs/62 決定④「購入ボタンの上」と「解錠コード入力画面」）。
  // 2026-08-03 便DN で購入ボタンと解錠コード入力欄が隣り合わせになったため、開示は1つで
  // 両方の位置条件を満たす（開示 → 購入ボタン → 入力欄 の順に並んでいること）。
  // 断定・脅しの文体になっていないこと。 ---
  currentCheck = 'DISCLOSE-01'
  {
    const d1Browser = await chromium.launch()
    const d1Context = await d1Browser.newContext({ viewport: { width: 390, height: 844 } })
    const d1Page = await d1Context.newPage()
    d1Page.on('pageerror', (err) => errors.push(`[pageerror@DISCLOSE-01] ${err.message}`))
    try {
      await d1Page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await d1Page.waitForTimeout(1500)
      const d1Notice = (await d1Page.locator('[data-testid="pro-accuracy-notice"]').textContent()) ?? ''
      for (const [label, text] of [['購入案内の位置', d1Notice]]) {
        check(
          `DISCLOSE-01 ${label}に「概算」であることが書かれている`,
          text.includes('概算'),
          `text=${text}`,
        )
        check(
          `DISCLOSE-01 ${label}に「調理による変化は反映していない」が書かれている`,
          text.includes('調理による変化'),
          `text=${text}`,
        )
        check(
          `DISCLOSE-01 ${label}に「治療中・妊娠中の方の食事管理には使えない」が書かれている`,
          text.includes('治療中') && text.includes('妊娠中') && text.includes('使えません'),
          `text=${text}`,
        )
      }
      // 開示 → 購入ボタン → 解錠コード入力欄 の順に並ぶ＝docs/62 決定④の2箇所を1つの開示で満たす
      check(
        'DISCLOSE-01 開示は購入ボタンより上、かつ解錠コード入力欄より上にある(便DN)',
        await d1Page.evaluate(() => {
          const notice = document.querySelector('[data-testid="pro-accuracy-notice"]')
          const buy = document.querySelector('[data-testid="pro-buy-link"]')
          const row = document.querySelector('[data-testid="unlock-code-row"]')
          if (!notice || !buy || !row) return false
          const before = Node.DOCUMENT_POSITION_FOLLOWING
          return (
            (notice.compareDocumentPosition(buy) & before) !== 0 &&
            (notice.compareDocumentPosition(row) & before) !== 0
          )
        }),
      )
      // 解錠済みでも購入案内側の開示は残す（買ったあとに前提が消えない）
      await d1Page.evaluate(async () => {
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
      await d1Page.reload({ waitUntil: 'networkidle' })
      await d1Page.waitForTimeout(1200)
      check(
        'DISCLOSE-01 解錠後も購入案内側の開示は残る',
        await d1Page.locator('[data-testid="pro-accuracy-notice"]').isVisible(),
      )
      check(
        'DISCLOSE-01 解錠後は購入ボタンと入力欄が消える（買う必要が無いため）',
        (await d1Page.locator('[data-testid="pro-buy-link"]').count()) === 0 &&
          (await d1Page.locator('[data-testid="unlock-code-row"]').count()) === 0,
      )
    } finally {
      await d1Browser.close()
    }
  }

  // --- DAYLAYOUT-01(2026-08-17 便HH・オーナー承認済み): 献立の「日」の押せるボタンの重なりを解く。
  // 旧DAYSEARCH-01(旧HOMESEARCH-01)を置き換える。旧検査が測っていた「レシピを探す」
  // 「在庫の食材から探す」の2つは、行き先が他と重なっていたので画面から外した:
  //   ・レシピを探す(?focus=search)   … 行き先は「今日の献立を探す」と下の並びの「レシピ」と同じ
  //                                     レシピ一覧。検索欄は一覧の上端に貼り付いて常に見えている
  //   ・在庫の食材から探す(?pantry=1) … 同じ絞り込みが「今日なに作る？」の「在庫の食材から」と
  //                                     レシピ一覧の絞り込み「在庫の食材で絞る」にある
  // この検査が見るのは、直したこと(=押せるボタンが5つから3つに減っても、決め方は全部残る)の骨格:
  //   ① 献立が無い日: 「自分で選ぶ」入口が1つだけ／「決めてもらう」2つが同じ節に居る／
  //      外した2つがどこにも無い／どれも指で押せる大きさ
  //   ② 献立がある日: 同じ節を「今日なに作る？」の名前のまま畳んで出し、見出しを押すと開いて使える
  //      （2026-08-17 便HI。便HHの小さいリンク「もう1品さがす」は、節を日によって別名で呼ばないため廃止）
  // 置き場所ではなく「名前で掴めるか」「押すとどうなるか」「同じ節に居るか」で測る(禁じ手④)。
  // 曜日・月替わりに依らない材料(todayList・在庫)だけを使う(禁じ手①)。
  // 照合はBudouXのゼロ幅スペースを外してから(禁じ手②) ---
  currentCheck = 'DAYLAYOUT-01'
  {
    const dlBrowser = await chromium.launch()
    const dlContext = await dlBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dlPage = await dlContext.newPage()
    dlPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYLAYOUT-01] ${text}`)
    })
    dlPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYLAYOUT-01] ${err.message}`)
    })
    const dlBody = async () => ((await dlPage.textContent('body')) ?? '').replaceAll('​', '')
    /** 「今日なに作る？」の見出しを持つ節そのもの(何番目の要素かではなく“同じ節に居るか”で測る) */
    const dlSuggestSection = () =>
      dlPage.locator('section').filter({ has: dlPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
    /** 押せる大きさ。44pxは下限の保険(これを下回ると濡れた手では押しにくい) */
    const dlTapSize = async (locator) => {
      if ((await locator.count()) !== 1) return { width: 0, height: 0 }
      return (await locator.boundingBox()) ?? { width: 0, height: 0 }
    }
    try {
      await dlPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dlPage.waitForTimeout(2200) // 初回シード完了待ち

      // 在庫を1品「ある」にする(在庫があるときにだけ出る入口まで含めて見るため)
      await dlPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('pantryItems', 'readwrite')
              const store = tx.objectStore('pantryItems')
              const g = store.getAll()
              g.onsuccess = () => {
                store.put({ ...g.result[0], level: 'have' })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )

      // ---- ① その日の献立が決まっていない日 ----
      await dlPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dlPage.reload({ waitUntil: 'networkidle' })
      await dlPage.waitForTimeout(1600)
      {
        const body = await dlBody()
        const choose = dlPage.getByRole('button', { name: ja.mealPlan.todayChooseButton })
        check(
          'DAYLAYOUT-01 献立が無い日に「自分で選ぶ」入口はちょうど1つ',
          (await choose.count()) === 1,
        )
        check(
          'DAYLAYOUT-01 「レシピを探す」はどこにも出ない(レシピ一覧へ行く道が二重にならない)',
          !body.includes('レシピを探す'),
        )
        check(
          'DAYLAYOUT-01 「在庫の食材から探す」はどこにも出ない(在庫での絞り込みが二重にならない)',
          !body.includes('在庫の食材から探す'),
        )
        const section = dlSuggestSection()
        check('DAYLAYOUT-01 献立が無い日は「今日なに作る？」が出る', (await section.count()) === 1)
        // 2026-08-17 便HI(オーナー指示): 「今日の献立」の見出しと枠は空の日には出さない。
        // 「今日の献立を探す」だけを残し、置き場所は「今日なに作る？」の下
        check(
          'DAYLAYOUT-01 献立が無い日は「今日の献立」の見出しを出さない',
          (await dlPage.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
        )
        {
          const sectionBox = (await section.boundingBox()) ?? { y: 0, height: 0 }
          const chooseBox = (await choose.boundingBox()) ?? { y: 0 }
          check(
            'DAYLAYOUT-01 「今日の献立を探す」は「今日なに作る？」の下にある',
            chooseBox.y >= sectionBox.y + sectionBox.height,
            `節=${Math.round(sectionBox.y)}+${Math.round(sectionBox.height)} 選ぶ=${Math.round(chooseBox.y)}`,
          )
        }
        // 2026-08-18 便HM: 「決めてもらう」ボタンは**1つ**になり、見出しの下の「1品」/「献立」の
        // 切り替えで名前と中身が入れ替わる。ここでは「散らばっていないこと」だけを見る
        // （切り替えそのものの中身は DAYMODE-01）
        const draw = section.locator('[data-testid="day-suggest-draw"]')
        // 2026-08-19 便HT: はじめは「献立」から始まるので、1品側のボタンを見る前に切り替える
        // （名前が入れ替わるだけで、ボタンそのものは1つのまま）
        if ((await section.locator('[data-testid="day-mode-one"]').count()) === 1) {
          await section.locator('[data-testid="day-mode-one"]').click()
          await dlPage.waitForTimeout(800)
        }
        const oneDish = section.getByRole('button', { name: ja.dayStart.shuffle })
        check(
          'DAYLAYOUT-01 「決めてもらう」ボタンは「今日なに作る？」の中に1つだけ',
          (await draw.count()) === 1 &&
            (await dlPage.locator('[data-testid="day-suggest-draw"]').count()) === 1,
          `節の中=${await draw.count()} 画面全体=${await dlPage.locator('[data-testid="day-suggest-draw"]').count()}`,
        )
        check(
          'DAYLAYOUT-01 切り替えも「今日なに作る？」の中にある(他の節へ散らばっていない)',
          (await section.locator('[data-testid="day-mode-one"]').count()) === 1 &&
            (await dlPage.locator('[data-testid="day-mode-plan"]').count()) === 1,
        )
        for (const [label, loc] of [
          ['今日の献立を探す', choose],
          ['おまかせで1品出す', oneDish],
        ]) {
          const box = await dlTapSize(loc)
          check(
            `DAYLAYOUT-01 「${label}」は指で押せる大きさ(高さ44px以上・幅240px以上)`,
            box.height >= 44 && box.width >= 240,
            `w=${Math.round(box.width)} h=${Math.round(box.height)}`,
          )
        }
        check(
          'DAYLAYOUT-01 献立が無い日にも「作った記録の一覧」がある',
          body.includes('作った記録の一覧'),
        )
      }

      // ---- ② その日の献立が決まっている日 ----
      // 週の予定ではなく「レシピ一覧から選択中」の1品で作る(日付を一切使わない)
      await dlPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const main = g.result.find((r) => r.title === '肉じゃが')
                const tx = idb.transaction('todayList', 'readwrite')
                tx.objectStore('todayList').add({ recipeId: main.id, addedAt: Date.now() })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await dlPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dlPage.reload({ waitUntil: 'networkidle' })
      await dlPage.waitForTimeout(1600)
      {
        const body = await dlBody()
        check('DAYLAYOUT-01 献立がある日は今日の献立が出る', body.includes('肉じゃが'))
        check(
          'DAYLAYOUT-01 献立がある日は「今日なに作る？」を畳んでおく(見え方を重くしない)',
          // 2026-08-17 便HI: 節の名前は畳んでも出したままにしたので、中身が出ていないことで測る。
          // 2026-08-20 便II・③: 決めてもらうボタンだけは畳んでも残すので、中身＝1品/献立の
          // 切り替えと候補で測る（ボタンが残っていることは下の行で別に見る）
          (await dlPage.locator('[data-testid="day-mode-one"]').count()) === 0 &&
            (await dlPage.locator('[data-testid="day-suggest-result"]').count()) === 0,
          `切り替え=${await dlPage.locator('[data-testid="day-mode-one"]').count()} 候補=${await dlPage.locator('[data-testid="day-suggest-result"]').count()}`,
        )
        check(
          'DAYLAYOUT-01(便II・③) 畳んでいても、決めてもらうボタンだけは押せる場所に残る',
          (await dlPage.locator('[data-testid="day-suggest-draw"]').count()) === 1,
        )
        const section = dlSuggestSection()
        const toggle = dlPage.locator('[data-testid="day-suggest-toggle"]')
        const toggleFound = (await toggle.count()) === 1
        check(
          'DAYLAYOUT-01 献立がある日も節の名前は「今日なに作る？」のまま(別名にしない)',
          toggleFound &&
            ((await toggle.textContent()) ?? '').replaceAll('\u200b', '').includes('今日なに作る？'),
        )
        check(
          'DAYLAYOUT-01 献立がある日は「もう1品さがす」という別名を出さない',
          !body.includes('もう1品さがす'),
        )
        check(
          'DAYLAYOUT-01 献立がある日は畳んで出す',
          toggleFound && (await toggle.getAttribute('aria-expanded')) === 'false',
        )
        const toggleBox = await dlTapSize(toggle)
        check(
          'DAYLAYOUT-01 畳んだ見出しも指で押せる大きさ(高さ44px以上)',
          toggleBox.height >= 44,
          `w=${Math.round(toggleBox.width)} h=${Math.round(toggleBox.height)}`,
        )
        // 献立がある日は「今日の献立」の中の「レシピ一覧から追加」が同じ行き先を持つので、
        // 「今日の献立を探す」は出さない(同じ操作を2か所に作らない)
        check(
          'DAYLAYOUT-01 献立がある日は「今日の献立を探す」を出さない(入口が二重にならない)',
          (await dlPage.getByRole('button', { name: ja.mealPlan.todayChooseButton }).count()) === 0 &&
            (await dlPage.locator('[data-testid="today-add-more"]').count()) === 1,
        )
        if (toggleFound) {
          await toggle.click()
          await dlPage.waitForTimeout(700)
        }
        check(
          'DAYLAYOUT-01 見出しを押すと「今日なに作る？」が開く',
          toggleFound && (await toggle.getAttribute('aria-expanded')) === 'true',
        )
        const oneDish = section.getByRole('button', { name: ja.dayStart.shuffle })
        const oneDishFound = (await oneDish.count()) === 1
        check('DAYLAYOUT-01 開いた提案は「おまかせで1品出す」が使える', oneDishFound)
        // 振り直しても候補のカードが出ていること(開いた先で提案として機能する)。
        // 出た料理名そのものは見ない(くじなので毎回変わる)
        const dlCardTitle = async () => {
          const card = section.locator('a[href*="#/recipes/"]').first()
          return (await card.count()) > 0 ? ((await card.textContent()) ?? '') : ''
        }
        const before = oneDishFound ? await dlCardTitle() : ''
        if (oneDishFound) {
          await oneDish.click()
          await dlPage.waitForTimeout(600)
        }
        const after = oneDishFound ? await dlCardTitle() : ''
        check(
          'DAYLAYOUT-01 振り直しても候補のカードが出ている(提案が使える)',
          before.trim().length > 0 && after.trim().length > 0,
          `前=${before.trim().slice(0, 20)} 後=${after.trim().slice(0, 20)}`,
        )
        // 2026-08-28 便LX: 上の「畳んでいるときは候補が出ていない」（day-suggest-result が0件）は、
        // **出る場面をこの節で1度も測っていなかった**ので、目印を変えても・カードが丸ごと
        // 消えても緑のままだった（src で `day-suggest-result` を改名して実測）。
        // 開いたあとの「出る場面」をここで対にする。件数は決め打ちせず下限だけ見る（禁じ手③）
        check(
          'DAYLAYOUT-01 開いた提案の候補には目印が付いている(畳んだときの「出ていない」が中身のある判定になる)',
          (await section.locator('[data-testid="day-suggest-result"]').count()) >= 1,
          `候補=${await section.locator('[data-testid="day-suggest-result"]').count()}`,
        )
        // 2026-08-18 便HM: 献立がある日にも「1品」/「献立」の切り替えをそのまま出す。
        // 便HHで隠していた理由（押すとさらに2品入ってしまう）は便HIで消えており
        // （いまは「今日の献立に入れる」を押して食事を選ぶまで入らない）、
        // 片側だけを日によって消すと、覚えている選び方が黙って無視されるため
        check(
          'DAYLAYOUT-01 献立がある日も「1品」「献立」の切り替えが同じように使える',
          (await section.locator('[data-testid="day-mode-one"]').count()) === 1 &&
            (await section.locator('[data-testid="day-mode-plan"]').count()) === 1,
        )
        check(
          'DAYLAYOUT-01 献立がある日にも「作った記録の一覧」がある',
          (await dlBody()).includes('作った記録の一覧'),
        )
      }
    } finally {
      await dlBrowser.close()
    }
  }

  // --- DAYMODE-01(2026-08-18 便HM → 2026-08-19 便HT・オーナー実機フィードバックの再発防止)。
  // オーナー原文(便HM):
  //   「『ランダムで1品出す』と『おまかせで献立を組む』は同じボタンにまとめ、
  //     『1品』↔️『献立』に切り替えスイッチにしませんか？見た目は1品の画面に寄せたい。
  //     今日の献立にれるボタンを1品にも適用えきるし。」
  //   「『おまかせで献立を組む』の候補が下に出るのわかりづらい。」
  // オーナー原文(便HT・実機で追加):
  //   「献立にも1品と同じように条件を絞る機能つければいいのでは？」
  //   「ランダムボタンが下だと品数によってボタン位置が変わり、連続タップで誤タップします。
  //     上に持ってくるか、ボタン位置がずれないようにするかして。」
  //
  // この検査が見るのは、直したことの骨格:
  //   ① 切り替えが1組あって、指で押せて、押していない側が分かる
  //   ② 「決めてもらう」ボタンは画面に1つだけ（名前は切り替えで入れ替わる）
  //   ③ **結果はボタンより下**。そして**ボタンの位置は、切り替えでも・出た品数でも・
  //      連続して押しても動かない**（便HTの誤タップの再発防止。ここが今回の要）
  //   ④ 「献立」に切り替えたら、押さなくても結果が出ている
  //   ⑤ 「今日の献立に入れる」は1品でも使え、食事の枠の窓（他の画面と同じ部品）を通る
  //   ⑥ 絞り込み（条件をしぼる・在庫の食材から）は**どちらの側でも使える**。
  //      当てはめられない「料理の種別」だけは、献立側で理由の1行に置き換わっている
  //   ⑦ 切り替えは覚えている（開き直しても同じ側から始まる）
  // 禁じ手よけ: 曜日・月替わりの前提を置かない（仕込むのは todayList だけ・日付を使わない）／
  // 文言の完全一致で測らない（ゼロ幅スペースを外して部分一致）／品数を決め打ちしない
  //（一品ものの主菜だと副菜が付かないのが正しいので、「役割が付いているか」で見る）／
  // 置き場所に固定しない（名前と data-testid で掴む。③の上下と位置だけは要件そのものなので測る）。
  // 掴めなかったときに合格へ倒れないよう、位置は「両方の箱が取れたか」を条件に入れる ---
  currentCheck = 'DAYMODE-01'
  {
    const dmBrowser = await chromium.launch()
    // 画面の高さは390×667（直す前に「今日の献立に入れる」が画面の外へ落ちていた大きさ）
    const dmContext = await dmBrowser.newContext({ viewport: { width: 390, height: 667 } })
    const dmPage = await dmContext.newPage()
    dmPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYMODE-01] ${text}`)
    })
    dmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYMODE-01] ${err.message}`)
    })
    const dmBody = async () => ((await dmPage.textContent('body')) ?? '').replaceAll('​', '')
    const dmSection = () =>
      dmPage.locator('section').filter({ has: dmPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
    const dmOne = () => dmPage.locator('[data-testid="day-mode-one"]')
    const dmPlan = () => dmPage.locator('[data-testid="day-mode-plan"]')
    const dmDraw = () => dmPage.locator('[data-testid="day-suggest-draw"]')
    const dmApply = () => dmPage.locator('[data-testid="day-suggest-apply"]')
    const dmResults = () => dmSection().locator('[data-testid="day-suggest-result"]')
    /** 無いものを掴もうとして検査ごと止まらないようにする（1つだけ在るときにその箱を返す） */
    const dmBox = async (locator) => ((await locator.count()) === 1 ? await locator.boundingBox() : null)
    /** 決めてもらうボタンの縦位置。取れなければ null（null は下の判定で必ず不合格になる） */
    /**
     * 決めてもらうボタンの縦位置。取れなければ null（null は下の判定で必ず不合格になる）。
     *
     * 2026-08-19 司令部: **ページの中での位置**で測る（画面の中での位置に scrollY を足す）。
     * 直前の検査が「押すものを画面の中へ送る」ためにページを動かすので、画面の中での位置だけで
     * 見ていると、レイアウトが1pxも変わっていないのに「動いた」と読めてしまう（実際に誤検出した）。
     * オーナーの指摘（連続タップで指の下からボタンが逃げる）の正体は**並びの変化**なので、
     * ページの中での位置で測るのが本来の測り方。
     */
    const dmDrawY = async () => {
      const box = await dmBox(dmDraw())
      if (!box) return null
      const scrolled = await dmPage.evaluate(() => Math.round(scrollY))
      return Math.round(box.y) + scrolled
    }
    const dmPressed = async (locator) =>
      (await locator.count()) === 1 ? await locator.getAttribute('aria-pressed') : null
    const dmRead = (store) =>
      dmPage.evaluate(
        (name) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result.transaction([name], 'readonly').objectStore(name).getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
        store,
      )
    try {
      await dmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(2200) // 初回シード完了待ち
      await dmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dmPage.reload({ waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1800)

      // ---- ① 切り替えがある ----
      check(
        'DAYMODE-01 「今日なに作る？」に「1品」「献立」の切り替えがある',
        (await dmOne().count()) === 1 && (await dmPlan().count()) === 1,
      )
      check(
        'DAYMODE-01 切り替えは「今日なに作る？」の中にある',
        (await dmSection().locator('[data-testid="day-mode-one"]').count()) === 1,
      )
      {
        const oneBox = (await dmBox(dmOne())) ?? { width: 0, height: 0 }
        const planBox = (await dmBox(dmPlan())) ?? { width: 0, height: 0 }
        check(
          'DAYMODE-01 切り替えは指で押せる大きさ(高さ44px以上)',
          oneBox.height >= 44 && planBox.height >= 44,
          `1品 h=${Math.round(oneBox.height)} 献立 h=${Math.round(planBox.height)}`,
        )
      }
      // ---- ② 決めてもらうボタンは1つ ----
      check('DAYMODE-01 決めてもらうボタンは画面に1つだけ', (await dmDraw().count()) === 1)
      // ---- ④ はじめは「献立」で、押さなくても組んだ献立が出ている(2026-08-19 便HT) ----
      check(
        'DAYMODE-01 はじめは「献立」から始まる(2026-08-19 便HT・オーナー指示)',
        (await dmPressed(dmPlan())) === 'true' && (await dmPressed(dmOne())) === 'false',
      )
      // 既定が「献立」であることは上で測った。ここから先は**必ず献立側で測る**ために
      // 明示的に寄せる（既定が1品に戻ってしまったときに、1品の画面を献立として測って
      // 素通り合格するのを防ぐ。押しても同じ側なら何も起きない）
      if ((await dmPlan().count()) === 1) {
        await dmPlan().click()
        await dmPage.waitForTimeout(1200)
      }
      check(
        'DAYMODE-01 前提: 献立側で測っている',
        (await dmPressed(dmPlan())) === 'true',
        `献立=${await dmPressed(dmPlan())}`,
      )
      /** 「献立」側でのボタンの縦位置。①〜⑦を通して、ここから動かないことを見る */
      const dmDrawYPlan = await dmDrawY()
      {
        const resultBox = await dmBox(dmResults().first())
        const drawBox = await dmBox(dmDraw())
        check(
          'DAYMODE-01 「献立」へ切り替えると、押さなくても組んだ献立が出ている',
          resultBox != null,
          `候補y=${resultBox ? Math.round(resultBox.y) : '無し'}`,
        )
        check(
          'DAYMODE-01 献立のとき、結果は決めてもらうボタンより下にある(2026-08-19 便HT)',
          resultBox != null && drawBox != null && resultBox.y > drawBox.y,
          `候補y=${resultBox ? Math.round(resultBox.y) : '無し'} ボタンy=${drawBox ? Math.round(drawBox.y) : '無し'}`,
        )
        const dmRoleTexts = (await dmResults().allTextContents()).map((t) => t.replaceAll('​', ''))
        check(
          'DAYMODE-01 献立のときは、出た品に主菜/副菜の別が付いている',
          dmRoleTexts.length > 0 && dmRoleTexts.every((t) => /主菜|副菜/.test(t)),
          JSON.stringify(dmRoleTexts.map((t) => t.slice(0, 20))),
        )
        // 「今日の献立に入れる」に**指が届く**こと（2026-08-19 司令部が測り直した）。
        //
        // 元はここで「押していない状態のまま、下端が667px以内に収まる」を見ていた。
        // だが実測すると、収まるかどうかは**その回に引けた料理名の長さ**で決まっていた:
        //   1品もの(副菜が付かない)= 555px ／ 2品で短い名前= 661px ／ 2品で2行に折り返す名前= 671px
        // さらに在庫を登録している人には「在庫の食材から」の行が増えるので、もっと下がる。
        // つまり「画面の高さに収まる」は、たまたま短い名前を引いた回だけ通る約束だった
        // （禁じ手④＝置き場所の決め打ち）。
        //
        // 利用者が困るのは「収まらないこと」ではなく**押せないこと**なので、そちらを測る:
        // その位置まで送ったうえで、①画面の中に全部見えている ②下に貼り付くタブの帯に
        // 隠れていない、の2つ。ボタンが動かないことは上の2件が別に見張っている。
        const applyReach = await dmPage.evaluate(() => {
          const btn = document.querySelector('[data-testid="day-suggest-apply"]')
          if (!btn) return null
          btn.scrollIntoView({ block: 'center' })
          const r = btn.getBoundingClientRect()
          // 下に貼り付いている帯（タブ）の上端。無ければ画面の下端
          const bars = [...document.querySelectorAll('nav, [data-app-bottom-bar]')].filter((el) => {
            const s = getComputedStyle(el)
            return s.position === 'fixed' && el.getBoundingClientRect().bottom >= innerHeight - 2
          })
          const barTop = bars.length > 0 ? Math.min(...bars.map((el) => el.getBoundingClientRect().top)) : innerHeight
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            barTop: Math.round(barTop),
            h: Math.round(r.height),
          }
        })
        // 送ったぶんのスクロールは、ここで先頭へ戻す＝次の検査が「画面の中での位置」を
        // 見ていても、この検査の副作用で狂わないようにする
        await dmPage.evaluate(() => window.scrollTo(0, 0))
        await dmPage.waitForTimeout(200)
        check(
          'DAYMODE-01 「今日の献立に入れる」に指が届く（画面の中に全部見えて、下の帯に隠れない）',
          applyReach != null &&
            applyReach.h > 0 &&
            applyReach.top >= 0 &&
            applyReach.bottom <= applyReach.barTop,
          applyReach
            ? `上端=${applyReach.top} 下端=${applyReach.bottom} 帯の上端=${applyReach.barTop}`
            : '無し',
        )
        // ⑥ 絞り込みは献立側でも使える。当てられない「料理の種別」だけ理由に置き換わる
        check(
          'DAYMODE-01 献立のときも「条件をしぼる」が使える(2026-08-19 便HT・オーナー指示)',
          (await dmBody()).includes('条件をしぼる'),
        )
        // 2026-08-19 便IA: 「条件をしぼる」は**窓**で開く。開いているあいだ後ろの画面は
        // 窓に覆われて押せないので、閉じるのは窓の中の「閉じる」から行う
        const dmConditions = dmSection().getByRole('button', { name: /条件をしぼる/ })
        if ((await dmConditions.count()) === 1) {
          await dmConditions.click()
          await dmPage.waitForTimeout(600)
        }
        check(
          'DAYMODE-01 献立のときは料理の種別を並べず、当てられない理由を出す',
          (await dmSection().locator('[data-testid="day-dishtype-plan-note"]').count()) === 1 &&
            (await dmSection().getByRole('button', { name: '汁物', exact: true }).count()) === 0,
        )
        const dmCloseConditions = dmPage.locator('[data-testid="day-conditions-close"]')
        if ((await dmCloseConditions.count()) === 1) {
          await dmCloseConditions.click()
          await dmPage.waitForTimeout(600)
        }
      }
      // ---- ③ 連続して押してもボタンが動かない(誤タップの再発防止・2026-08-19 便HT) ----
      {
        const DM_PRESSES = 4
        const moved = []
        for (let i = 0; i < DM_PRESSES; i++) {
          await dmDraw().click()
          await dmPage.waitForTimeout(500)
          const y = await dmDrawY()
          if (y == null || y !== dmDrawYPlan) moved.push(`${i + 1}回目: ${y ?? '掴めず'}`)
        }
        check(
          'DAYMODE-01 献立で連続して押しても、決めてもらうボタンの位置が動かない',
          dmDrawYPlan != null && moved.length === 0,
          `最初のy=${dmDrawYPlan ?? '掴めず'} ずれ=${JSON.stringify(moved)}`,
        )
      }
      // ---- ③ 切り替えてもボタンが動かない ----
      if ((await dmOne().count()) === 1) {
        await dmOne().click()
        await dmPage.waitForTimeout(900)
      }
      {
        const dmDrawYOne = await dmDrawY()
        check(
          'DAYMODE-01 「1品」に切り替えても決めてもらうボタンの位置が動かない',
          dmDrawYPlan != null && dmDrawYOne != null && dmDrawYOne === dmDrawYPlan,
          `献立のy=${dmDrawYPlan ?? '掴めず'} 1品のy=${dmDrawYOne ?? '掴めず'}`,
        )
        const resultBox = await dmBox(dmResults().first())
        const drawBox = await dmBox(dmDraw())
        check(
          'DAYMODE-01 1品のときも、出てきた候補は決めてもらうボタンより下にある',
          resultBox != null && drawBox != null && resultBox.y > drawBox.y,
          `候補y=${resultBox ? Math.round(resultBox.y) : '無し'} ボタンy=${drawBox ? Math.round(drawBox.y) : '無し'}`,
        )
        check('DAYMODE-01 1品のときは「条件をしぼる」が使える', (await dmBody()).includes('条件をしぼる'))
        check(
          'DAYMODE-01 1品のときに献立側の候補数は出さない(数字が2つ並ばない)',
          !(await dmBody()).includes('主菜の候補'),
        )
      }
      // ---- ⑦ 切り替えを覚えている ----
      await dmPage.reload({ waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1800)
      check(
        'DAYMODE-01 切り替えは覚えている(開き直しても「1品」のまま)',
        (await dmPressed(dmOne())) === 'true',
      )
      // ---- ⑤ 1品でも「今日の献立に入れる」が使える ----
      {
        check('DAYMODE-01 1品にも「今日の献立に入れる」がある', (await dmApply().count()) === 1)
        const dmTitles = await dmSection()
          .locator('[data-testid="day-suggest-result-title"]')
          .allTextContents()
        const dmPicked = (dmTitles[0] ?? '').replaceAll('​', '').trim()
        check('DAYMODE-01 前提: 入れる品の名前が読めた', dmPicked.length > 0)
        if ((await dmApply().count()) === 1) {
          await dmApply().click()
          await dmPage.waitForTimeout(600)
        }
        const dmSlotButtons = dmPage.locator('[data-testid="today-slot-button"]')
        check(
          'DAYMODE-01 1品でも食事の枠を選ぶ窓が開く(他の画面と同じ部品・朝昼夕の3つ)',
          (await dmSlotButtons.count()) === 3,
        )
        if ((await dmSlotButtons.count()) === 3) {
          await dmPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
          await dmPage.waitForTimeout(1500)
        }
        check(
          'DAYMODE-01 1品を選んだ食事に入れられる',
          dmPicked.length > 0 &&
            (await dmRead('todayList')).length > 0 &&
            (await dmBody()).includes(dmPicked),
          `入れた品=${dmPicked}`,
        )
      }
    } finally {
      await dmBrowser.close()
    }
  }

  // --- DAYFLOW-01(2026-08-17 便HI・オーナー実機フィードバック8件の再発防止)。
  // 献立の「日/週/月」を実際に触って、次の6つを確かめる:
  //   (a) どのタブへ移ってもページのいちばん上から見せる（前は週タブだけ今日のカードへ送っていた）
  //   (b) 下の並びの「献立」を押すと日へ戻る／すでに日にいるときは先頭へ送る
  //   (c) 「今週の献立の予定」の×は、今日の献立と今週の献立の両方から外す
  //   (d) 「おまかせで献立を組む」は押しただけでは入らず、押すたびに別の組み合わせが出る。
  //       入るのは「今日の献立に入れる」で食事を選んだときだけ（窓は他の画面と同じ部品）
  //   (e) 今日の献立のレシピ→詳細→戻る のあと「レシピ」タブを押すと**一覧**が開く
  //   (f) 「今日なに作る？」の候補→詳細→戻る で、さっき開いた料理がそのまま出ている
  // 禁じ手よけ: 曜日・月替わりの前提を置かない（日付は実行時の「今日」をそのまま使い、
  // 週のどのカードかは見ない）／文言の完全一致で測らない（ゼロ幅スペースを外して部分一致）／
  // 押す回数・件数を決め打ちしない（上限は保険と分かる形で、判定は中身の変化で行う）／
  // 要素の置き場所に固定しない（名前・data-testid で掴む。(a)の位置だけは要件そのものなので測る） ---
  currentCheck = 'DAYFLOW-01'
  {
    const dfBrowser = await chromium.launch()
    const dfContext = await dfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dfPage = await dfContext.newPage()
    dfPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYFLOW-01] ${text}`)
    })
    dfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYFLOW-01] ${err.message}`)
    })
    /** 実行時の「今日」。曜日には一切依存しない（その日の予定を仕込むためだけに使う） */
    const dfToday = (() => {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    const dfBody = async () => ((await dfPage.textContent('body')) ?? '').replaceAll('​', '')
    const dfTab = (name) => dfPage.getByRole('button', { name, exact: true })
    /** 画面下の並びの「献立」（タブそのもの。日/週/月の切り替えボタンとは別物） */
    const dfBottomMealPlan = () => dfPage.locator('[data-app-bottom-bar] a[href="#/meal-plan"]')
    const dfScrollToBottom = async () => {
      await dfPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
      await dfPage.waitForTimeout(400)
      return dfPage.evaluate(() => Math.round(window.scrollY))
    }
    const dfScrollY = () => dfPage.evaluate(() => Math.round(window.scrollY))
    /** 端末に残るデータの読み書き（曜日に依らない材料だけを仕込む） */
    const dfRead = (store) =>
      dfPage.evaluate(
        (name) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result.transaction([name], 'readonly').objectStore(name).getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
        store,
      )
    const dfClearPlans = () =>
      dfPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction(['todayList', 'mealPlans', 'settings'], 'readwrite')
              tx.objectStore('todayList').clear()
              tx.objectStore('mealPlans').clear()
              // 自動取り込みの「その日1回だけ」の記録も戻す（仕込み直しが効くように）
              const g = tx.objectStore('settings').get(1)
              g.onsuccess = () => {
                if (g.result) tx.objectStore('settings').put({ ...g.result, lastAutoImportDate: '' })
              }
              tx.oncomplete = () => resolve(true)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    const dfSeedPlan = (title, date, slot) =>
      dfPage.evaluate(
        ({ title: t, date: d, slot: sl }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const recipe = g.result.find((r) => r.title === t)
                if (!recipe) {
                  reject(new Error(`レシピが見つからない: ${t}`))
                  return
                }
                const tx = idb.transaction('mealPlans', 'readwrite')
                tx.objectStore('mealPlans').add({
                  date: d,
                  slot: sl,
                  recipeId: recipe.id,
                  role: 'main',
                })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { title, date, slot },
      )
    try {
      await dfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(2200) // 初回シード完了待ち

      // ---- (a) どのタブへ移ってもいちばん上から ----
      await dfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1500)
      await dfTab('週').click()
      await dfPage.waitForTimeout(900)
      const dfWeekBottom = await dfScrollToBottom()
      check(
        'DAYFLOW-01 前提: 週の画面は下まで送れる（位置の検査が成り立つ）',
        dfWeekBottom > 0,
        `scrollY=${dfWeekBottom}`,
      )
      await dfTab('月').click()
      await dfPage.waitForTimeout(900)
      check('DAYFLOW-01(a) 月へ移るとページのいちばん上から見せる', (await dfScrollY()) === 0, `scrollY=${await dfScrollY()}`)
      await dfTab('週').click()
      await dfPage.waitForTimeout(900)
      check('DAYFLOW-01(a) 週へ移るとページのいちばん上から見せる', (await dfScrollY()) === 0, `scrollY=${await dfScrollY()}`)
      await dfScrollToBottom()
      await dfTab('日').click()
      await dfPage.waitForTimeout(900)
      check('DAYFLOW-01(a) 日へ移るとページのいちばん上から見せる', (await dfScrollY()) === 0, `scrollY=${await dfScrollY()}`)

      // ---- (b) 下の並びの「献立」で日へ戻る／すでに日なら先頭へ ----
      await dfTab('週').click()
      await dfPage.waitForTimeout(900)
      const dfBeforeTap = await dfScrollToBottom()
      await dfBottomMealPlan().click()
      await dfPage.waitForTimeout(900)
      check(
        'DAYFLOW-01(b) 週を見ているときに下の「献立」を押すと日に戻る',
        (await dfTab('日').getAttribute('aria-pressed')) === 'true',
      )
      check(
        'DAYFLOW-01(b) そのときページのいちばん上から見せる',
        (await dfScrollY()) === 0,
        `押す前=${dfBeforeTap} 押した後=${await dfScrollY()}`,
      )
      // すでに日にいるとき（押しても行き先が同じ）は先頭へ送る＝押して何も起きない、を作らない
      await dfTab('月').click()
      await dfPage.waitForTimeout(600)
      await dfTab('日').click()
      await dfPage.waitForTimeout(600)
      await dfPage.evaluate(() => window.scrollTo(0, 400))
      await dfPage.waitForTimeout(300)
      const dfDayScrolled = await dfScrollY()
      await dfBottomMealPlan().click()
      await dfPage.waitForTimeout(800)
      check(
        'DAYFLOW-01(b) すでに日にいるときも下の「献立」で先頭へ戻る',
        dfDayScrolled === 0 || (await dfScrollY()) === 0,
        `押す前=${dfDayScrolled} 押した後=${await dfScrollY()}`,
      )
      // 別のタブから来たときも先頭から（前の画面で送っていた位置を引きずらない）
      await dfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1200)
      const dfRecipesBottom = await dfScrollToBottom()
      check(
        'DAYFLOW-01 前提: レシピ一覧は下まで送れる',
        dfRecipesBottom > 0,
        `scrollY=${dfRecipesBottom}`,
      )
      await dfBottomMealPlan().click()
      await dfPage.waitForTimeout(1200)
      check(
        'DAYFLOW-01(b) 別のタブから献立へ来たときも先頭から見せる',
        (await dfScrollY()) === 0,
        `レシピ一覧=${dfRecipesBottom} 献立=${await dfScrollY()}`,
      )

      // ---- (c) 「今週の献立の予定」の×は、今日と今週の両方から外す ----
      await dfClearPlans()
      await dfSeedPlan('肉じゃが', dfToday, 'dinner')
      await dfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dfPage.reload({ waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1800)
      {
        const planned = dfPage.locator('[data-testid="day-planned"]')
        check(
          'DAYFLOW-01(c) 前提: 今日の予定が「今週の献立の予定」に並ぶ',
          (await planned.count()) === 1 &&
            ((await planned.textContent()) ?? '').includes('肉じゃが'),
        )
        // 2026-08-20 便IG・①: ×は「整理」モードの中にしか出ない。押す前の説明も同じモードの中に置く
        // （出ていない操作の説明を先に読ませないため）ので、整理へ入ってから両方を見る
        await openDayOrganize(dfPage)
        // 規約F: 押す前に「何が外れて何が残るか」が読める
        check(
          'DAYFLOW-01(c) ×の前に「今週の献立からも外れる」が読める',
          (await dfBody()).includes('今週の献立からも外れます'),
        )
        const dfRemove = planned.getByRole('button', { name: ja.mealPlan.todayPlannedRemove })
        check('DAYFLOW-01(c) 「今週の献立の予定」の行に×がある', (await dfRemove.count()) === 1)
        await dfRemove.first().click()
        await dfPage.waitForTimeout(1200)
        const afterBody = await dfBody()
        const afterPlans = await dfRead('mealPlans')
        const afterToday = await dfRead('todayList')
        check(
          'DAYFLOW-01(c) ×で今週の献立の予定そのものが消える（週と連動）',
          afterPlans.filter((e) => e.date === dfToday).length === 0,
          `plans=${JSON.stringify(afterPlans)}`,
        )
        check(
          // 料理名は外したことを知らせるトーストにも入るので、本文の有無では測らない(禁じ手②)。
          // 「日」に並ぶ行が消えたこと（＝並びが空になり見出しごと出なくなること）で測る
          'DAYFLOW-01(c) ×で今日の献立からも消える（行が別の見出しへ移らない）',
          afterToday.length === 0 &&
            (await planned.count()) === 0 &&
            (await dfPage.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
          `today=${JSON.stringify(afterToday)}`,
        )
        check(
          'DAYFLOW-01(c) 外したあと、何が外れたかを知らせる（規約F）',
          afterBody.includes('今日と今週の献立から外しました'),
        )
        // 2026-08-18 便HM（オーナー「作った記録もするということ？消すだけですよね。嘘書かないで。」）:
        // この×は献立の予定しか消さない。触らないものを「残ります」と書くと、
        // 危なかったものを助けたように読める。押す前の説明にも、外したあとの知らせにも書かない
        check(
          'DAYFLOW-01(c) ×まわりで「作った記録」の話をしない（触らないものを書かない）',
          !afterBody.includes('作った記録は残ります'),
          `本文に残っている: ${afterBody.includes('作った記録は残ります')}`,
        )
      }

      // ---- (d) おまかせは押しただけでは入らない／押すたびに別の組み合わせ／入れるときに食事を選ぶ ----
      await dfClearPlans()
      await dfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dfPage.reload({ waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1800)
      {
        // 2026-08-18 便HM: おまかせは「今日なに作る？」の「献立」側になった。
        // 切り替えてから触る（切り替えた時点で1組出る＝押さなくても結果が見えている）
        await dfPage.locator('[data-testid="day-mode-plan"]').click()
        await dfPage.waitForTimeout(1200)
        const omakase = dfPage.getByRole('button', { name: ja.mealPlan.todaySuggestButton })
        const pair = dfPage.locator('[data-testid="day-suggest-pair"]')
        const pairText = async () =>
          (await pair.count()) > 0 ? ((await pair.textContent()) ?? '').replaceAll('​', '') : ''
        check('DAYFLOW-01(d) 「献立」へ切り替えた時点で組んだ献立が画面に出ている', (await pair.count()) === 1)
        await omakase.click()
        await dfPage.waitForTimeout(700)
        check('DAYFLOW-01(d) 押すと組んだ献立が画面に出る', (await pair.count()) === 1)
        check(
          'DAYFLOW-01(d) 押しただけでは今日の献立に入らない',
          (await dfRead('todayList')).length === 0 &&
            (await dfPage.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
        )
        // 押すたびに別の組み合わせが出る。回数は決め打ちせず、変わった時点で止める
        // （上限は無限ループ避けの保険。候補が尽きるほど条件が狭いときのため）
        const DF_MAX_PRESSES = 8
        const first = await pairText()
        let changed = false
        for (let i = 0; i < DF_MAX_PRESSES && !changed; i++) {
          await omakase.click()
          await dfPage.waitForTimeout(500)
          changed = (await pairText()) !== first
        }
        check(
          'DAYFLOW-01(d) 続けて押すと別の組み合わせが出る',
          changed,
          `最初=${first.slice(0, 40)} 最後=${(await pairText()).slice(0, 40)}`,
        )
        // 入れるときは、他の画面とまったく同じ「朝食・昼食・夕食のどれに入れますか？」の窓が開く。
        // 料理名は名前の欄そのものから取る（1行にまとまった文から切り出すと、
        // 主菜/副菜の見出しと料理名が地続きになって切り分けられない）
        const dfPairTitles = (
          await pair.locator('[data-testid="day-suggest-result-title"]').allTextContents()
        ).map((t) => t.replaceAll('\u200b', '').trim())
        await dfPage.locator('[data-testid="day-suggest-apply"]').click()
        await dfPage.waitForTimeout(500)
        check(
          'DAYFLOW-01(d) 入れる前に食事の枠を選ぶ窓が開く（他の画面と同じ部品・朝昼夕の3つ）',
          (await dfPage.locator('[data-testid="today-slot-button"]').count()) === 3,
        )
        await dfPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
        await dfPage.waitForTimeout(1500)
        const dfAfterApply = await dfBody()
        const dfPlansAfter = await dfRead('mealPlans')
        check(
          'DAYFLOW-01(d) 選んだ食事の今週の献立に入る',
          dfPlansAfter.filter((e) => e.date === dfToday && e.slot === 'dinner').length > 0,
          `plans=${JSON.stringify(dfPlansAfter)}`,
        )
        check(
          'DAYFLOW-01(d) 今日の献立にも入り、入った先（夕食）を知らせる',
          (await dfRead('todayList')).length > 0 && dfAfterApply.includes('今日の夕食に'),
        )
        // 組んだ献立に並んでいた料理が、そのまま今日の献立に並ぶ（別の料理にすり替わらない）
        const dfMissing = dfPairTitles.filter(
          (title) => title.length > 0 && !dfAfterApply.includes(title),
        )
        check(
          'DAYFLOW-01(d) 組んだ献立の料理がそのまま今日の献立に並ぶ',
          dfMissing.length === 0,
          `入っていない=${JSON.stringify(dfMissing)}`,
        )
        check(
          'DAYFLOW-01(d) 入れたあとに「別の提案を見る」（入れたあとの振り直し）は残っていない',
          !dfAfterApply.includes('別の提案を見る'),
        )
      }

      // ---- (e) 今日の献立のレシピ→詳細→戻る のあと「レシピ」タブを押すと一覧が開く ----
      {
        const dayRow = dfPage.locator('[data-testid="day-planned"] a[href^="#/recipes/"]').first()
        await dayRow.click()
        await dfPage.waitForTimeout(800)
        check(
          'DAYFLOW-01(e) 前提: 今日の献立の料理からレシピ詳細へ行ける',
          /#\/recipes\/\d+/.test(dfPage.url()),
          `現在URL: ${dfPage.url()}`,
        )
        await dfPage.getByRole('button', { name: ja.common.back }).click()
        await dfPage.waitForTimeout(1000)
        check(
          'DAYFLOW-01(e) 前提: 戻ると献立へ帰る',
          (dfPage.url().split('#')[1] ?? '').startsWith('/meal-plan'),
          `現在URL: ${dfPage.url()}`,
        )
        await dfPage.locator('[data-app-bottom-bar] a[href^="#/recipes"]').click()
        await dfPage.waitForTimeout(1000)
        check(
          'DAYFLOW-01(e) そのあと「レシピ」タブを押すとレシピ一覧が開く（詳細に戻らない）',
          !/#\/recipes\/\d+/.test(dfPage.url()),
          `現在URL: ${dfPage.url()}`,
        )
      }

      // ---- (f) 「今日なに作る？」の候補→詳細→戻る で、同じ料理が出ている ----
      await dfClearPlans()
      await dfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dfPage.reload({ waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1800)
      {
        const suggestSection = dfPage
          .locator('section')
          .filter({ has: dfPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
        // 2026-08-18 便HM: (d)で「献立」に切り替えた状態が端末に残っている（覚える作りにした）。
        // ここで見たいのは1品の候補カードなので、明示的に「1品」へ戻してから測る
        await dfPage.locator('[data-testid="day-mode-one"]').click()
        await dfPage.waitForTimeout(800)
        const cardTitle = async () => {
          const card = suggestSection.locator('a[href^="#/recipes/"]').first()
          return (await card.count()) > 0
            ? ((await card.textContent()) ?? '').replaceAll('​', '').trim()
            : ''
        }
        // 1回だけだと「たまたま同じ料理を引いた」で素通り合格しうるので、往復を繰り返して見る
        // （毎回同じなら引き直していない。上限は保険ではなく、この回数ぶん確かめる）
        const DF_RETURN_TRIPS = 3
        const mismatches = []
        for (let i = 0; i < DF_RETURN_TRIPS; i++) {
          const before = await cardTitle()
          await suggestSection.locator('a[href^="#/recipes/"]').first().click()
          await dfPage.waitForTimeout(800)
          await dfPage.getByRole('button', { name: ja.common.back }).click()
          await dfPage.waitForTimeout(1200)
          const after = await cardTitle()
          if (before.length === 0 || before !== after) mismatches.push(`${i + 1}回目: ${before} → ${after}`)
          // 次の往復は「おまかせで1品出す」で引き直してから（覚えが外れることも一緒に見る）
          await suggestSection.getByRole('button', { name: ja.dayStart.shuffle }).click()
          await dfPage.waitForTimeout(500)
        }
        check(
          'DAYFLOW-01(f) 候補カードから詳細へ行って戻ると、さっき開いた料理がそのまま出ている',
          mismatches.length === 0,
          `食い違い=${JSON.stringify(mismatches)}`,
        )
      }

      // ---- (g) 「献立」側の候補→詳細→戻る で、さっき組んだ献立がそのまま出ている ----
      // 2026-08-19 便HT・オーナー原文「提案された献立→レシピ詳細→戻る、の流れで、
      // 献立『今日なに作る？』の提案が変更されないようにして。」
      // (f)は1品側の同じ約束を測っている。献立側は画面を離れると組んだ主菜・副菜が消え、
      // 戻った瞬間に別の組み合わせが引き直されていた。
      // 禁じ手よけ: 往復の回数ぶんだけ確かめる（1回だと「たまたま同じ組を引いた」で素通りする）／
      // 品数を決め打ちしない（一品ものの主菜だと副菜が付かないので、並んだ名前の**列**で見る）／
      // **組が読めなかったときは合格に倒さず、その場で食い違いとして記録する**
      {
        const suggestSection = dfPage
          .locator('section')
          .filter({ has: dfPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
        await dfPage.locator('[data-testid="day-mode-plan"]').click()
        await dfPage.waitForTimeout(1500)
        const dfPair = dfPage.locator('[data-testid="day-suggest-pair"]')
        const dfPairTitles = async () =>
          (await dfPair.locator('[data-testid="day-suggest-result-title"]').allTextContents()).map(
            (t) => t.replaceAll('​', '').trim(),
          )
        const DF_PLAN_TRIPS = 3
        const planMismatches = []
        for (let i = 0; i < DF_PLAN_TRIPS; i++) {
          const before = await dfPairTitles()
          if (before.length === 0 || before.some((t) => t.length === 0)) {
            planMismatches.push(`${i + 1}回目: 組んだ献立が読めなかった`)
            break
          }
          await dfPair.locator('a[href^="#/recipes/"]').first().click()
          await dfPage.waitForTimeout(900)
          await dfPage.getByRole('button', { name: ja.common.back }).click()
          await dfPage.waitForTimeout(1400)
          const after = await dfPairTitles()
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            planMismatches.push(`${i + 1}回目: ${before.join('・')} → ${after.join('・') || '空'}`)
          }
          // 次の往復は「おまかせで献立を組む」で組み直してから
          // （覚えが「戻ってきた1回だけ」で外れることも一緒に見る）
          await suggestSection.getByRole('button', { name: ja.mealPlan.todaySuggestButton }).click()
          await dfPage.waitForTimeout(700)
        }
        check(
          'DAYFLOW-01(g) 献立の料理から詳細へ行って戻ると、さっき組んだ献立がそのまま出ている',
          planMismatches.length === 0,
          `食い違い=${JSON.stringify(planMismatches)}`,
        )
      }

      // ---- (h) 「作った記録の一覧」へ行って戻っても、さっき出ていた提案がそのまま残っている ----
      // 2026-08-21 便IP・①。便IIの実測「『今日なに作る？』が戻るたびに別の献立を組み直す。
      // 主菜が一品もの（カレー・丼・麺・鍋）だと副菜のカードが付かず、
      // 節の高さが156〜170px→74px、ページの下端が82px上がる」。
      // (g)がレシピ詳細からの戻りを測っているのに対し、こちらは**日タブの別の出口**
      // （「作った記録の一覧」）から帰ってきたときを測る。献立側・1品側の両方を見る。
      //
      // 禁じ手よけ:
      //  ①曜日・月替わりの前提を置かない（日付を使わない。今日の日タブをそのまま見る）
      //  ②文字列の完全一致で測らない（ゼロ幅スペースを外してから料理名を比べる）
      //  ③品数・押す回数を決め打ちしない（並んだ名前の**列**で比べる。往復はこの回数ぶん確かめる）
      //  ④置き場所に固定しない（data-testid とボタン名で掴む）
      //  ⑤後から届くデータで見た目が変わる場所を、届く前に掴まない
      //    （献立はレシピがDBから届いてから組まれる。**名前が読めるまで待ってから**掴む）
      await dfClearPlans()
      await dfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dfPage.reload({ waitUntil: 'networkidle' })
      await dfPage.waitForTimeout(1800)
      {
        const suggestSection = dfPage
          .locator('section')
          .filter({ has: dfPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
        const historyLink = () => dfPage.getByRole('link', { name: ja.mealPlan.historyLink })
        /** 出ているものが読めるまで待つ（届く前に掴まない・禁じ手⑤） */
        const dhWaitTitles = async (read) => {
          for (let i = 0; i < 30; i++) {
            const titles = await read()
            if (titles.length > 0 && titles.every((t) => t.length > 0)) return titles
            await dfPage.waitForTimeout(300)
          }
          return []
        }
        /** 「作った記録の一覧」へ行って「戻る」で帰ってくる */
        const dhRoundTrip = async () => {
          await historyLink().scrollIntoViewIfNeeded()
          await historyLink().click()
          await dfPage.waitForTimeout(900)
          const onHistory = (dfPage.url().split('#')[1] ?? '').startsWith('/history')
          await dfPage.getByRole('button', { name: ja.common.back }).click()
          await dfPage.waitForTimeout(1400)
          return onHistory
        }

        // --- 献立側 ---
        await dfPage.locator('[data-testid="day-mode-plan"]').click()
        await dfPage.waitForTimeout(1200)
        const dhPair = dfPage.locator('[data-testid="day-suggest-pair"]')
        const dhPairTitles = async () =>
          (await dhPair.locator('[data-testid="day-suggest-result-title"]').allTextContents()).map(
            (t) => t.replaceAll('​', '').trim(),
          )
        check(
          'DAYFLOW-01(h) 前提: 日タブに「作った記録の一覧」への入口がある',
          (await historyLink().count()) === 1,
          `入口の数=${await historyLink().count()}`,
        )
        const DH_TRIPS = 3
        const dhPlanMismatches = []
        for (let i = 0; i < DH_TRIPS; i++) {
          const before = await dhWaitTitles(dhPairTitles)
          if (before.length === 0) {
            dhPlanMismatches.push(`${i + 1}回目: 組んだ献立が読めなかった`)
            break
          }
          const onHistory = await dhRoundTrip()
          if (!onHistory) {
            dhPlanMismatches.push(`${i + 1}回目: 「作った記録の一覧」に着いていない`)
            break
          }
          const after = await dhWaitTitles(dhPairTitles)
          if (JSON.stringify(before) !== JSON.stringify(after))
            dhPlanMismatches.push(`${i + 1}回目: ${before.join('・')} → ${after.join('・') || '空'}`)
          // 次の往復は組み直してから（覚えが「戻ってきた1回だけ」で外れることも一緒に見る）
          await suggestSection.getByRole('button', { name: ja.mealPlan.todaySuggestButton }).click()
          await dfPage.waitForTimeout(700)
        }
        check(
          'DAYFLOW-01(h) 作った記録の一覧へ行って戻ると、さっき出ていた献立がそのまま残っている',
          dhPlanMismatches.length === 0,
          `食い違い=${JSON.stringify(dhPlanMismatches)}`,
        )

        // --- 1品側（同じ節の片側だけが組み直る、を作らない） ---
        await dfPage.locator('[data-testid="day-mode-one"]').click()
        await dfPage.waitForTimeout(900)
        const dhOneTitle = async () => {
          const card = suggestSection.locator('a[href^="#/recipes/"]').first()
          return (await card.count()) > 0
            ? [((await card.textContent()) ?? '').replaceAll('​', '').trim()]
            : []
        }
        const dhOneMismatches = []
        for (let i = 0; i < DH_TRIPS; i++) {
          const before = await dhWaitTitles(dhOneTitle)
          if (before.length === 0) {
            dhOneMismatches.push(`${i + 1}回目: 出ている1品が読めなかった`)
            break
          }
          await dhRoundTrip()
          const after = await dhWaitTitles(dhOneTitle)
          if (JSON.stringify(before) !== JSON.stringify(after))
            dhOneMismatches.push(`${i + 1}回目: ${before.join('')} → ${after.join('') || '空'}`)
          await suggestSection.getByRole('button', { name: ja.dayStart.shuffle }).click()
          await dfPage.waitForTimeout(500)
        }
        check(
          'DAYFLOW-01(h) 作った記録の一覧へ行って戻ると、さっき出ていた1品もそのまま残っている',
          dhOneMismatches.length === 0,
          `食い違い=${JSON.stringify(dhOneMismatches)}`,
        )

        // --- 下の並びの「献立」で自分から離れたときは、覚えを持ち越さない（線引きの片側） ---
        // 「アプリの中のどこから戻っても保つ」を、**タブで離れたときまで**広げない。
        // 広げると、何時間も別のタブを触っていた人が古い提案を見せられる。
        // 測り方: 別のタブへ移ってから献立へ戻る往復を繰り返し、**1回でも入れ替われば合格**
        // （くじなので、たまたま同じ料理を引き当てる回もある＝毎回違うことは測れない）
        await dfPage.locator('[data-testid="day-mode-plan"]').click()
        await dfPage.waitForTimeout(1200)
        let dhTabRedrawn = false
        const dhTabSeen = []
        for (let i = 0; i < 6 && !dhTabRedrawn; i++) {
          const before = await dhWaitTitles(dhPairTitles)
          await dfPage.locator('[data-app-bottom-bar] a[href^="#/recipes"]').click()
          await dfPage.waitForTimeout(900)
          await dfBottomMealPlan().click()
          await dfPage.waitForTimeout(1500)
          const after = await dhWaitTitles(dhPairTitles)
          dhTabSeen.push(`${before.join('・') || '空'} → ${after.join('・') || '空'}`)
          if (before.length > 0 && after.length > 0 && JSON.stringify(before) !== JSON.stringify(after))
            dhTabRedrawn = true
        }
        check(
          'DAYFLOW-01(h) 下の並びのタブで自分から離れたときは、次に開くと組み直す（古い提案を残さない）',
          dhTabRedrawn,
          `往復=${JSON.stringify(dhTabSeen)}`,
        )
      }
    } finally {
      await dfBrowser.close()
    }
  }

  // --- DAYDEFAULT-01(2026-08-19 便HT・オーナー原文「基本を献立表示にして、1品にする時のみ
  // スイッチ押すようにした方が良いかも」)。
  //
  // 測るのは「**はじめて開いた人の画面に何が出るか**」。まっさらな入れ物(context)で
  // 献立の「日」を開いて、次を見る:
  //   ① 「献立」の側が選ばれている（押されている側で測る。色では測らない）
  //   ② 押していないのに主菜・副菜が出ている（切り替えるまで空、にしない）
  //   ③ 絞り込み（条件をしぼる・在庫の食材から）は、はじめの画面からそのまま使える
  //      （便HTでオーナーが「献立にも条件を絞る機能を」と指示したので、既定の側でも見える）
  //   ④ 「1品」を押せば1品側に移り、そこでは料理の種別まで選べる
  //   ⑤ 自分で「1品」を選んだあとは、開き直しても1品のまま（既定は自分の選択を上書きしない）
  // 禁じ手よけ: 曜日・月替わりの前提を置かない（日付を一切使わない）／文言の完全一致で
  // 測らない（ゼロ幅スペースを外して部分一致）／品数を決め打ちしない（役割が付いているかで見る）／
  // 置き場所に固定しない（data-testid と名前で掴む）。掴めなければ必ず不合格になる形にする ---
  currentCheck = 'DAYDEFAULT-01'
  {
    const ddBrowser = await chromium.launch()
    const ddContext = await ddBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ddPage = await ddContext.newPage()
    ddPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYDEFAULT-01] ${text}`)
    })
    ddPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYDEFAULT-01] ${err.message}`)
    })
    const ddBody = async () => ((await ddPage.textContent('body')) ?? '').replaceAll('​', '')
    const ddSection = () =>
      ddPage.locator('section').filter({ has: ddPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
    const ddPressed = async (testId) => {
      const loc = ddPage.locator(`[data-testid="${testId}"]`)
      return (await loc.count()) === 1 ? await loc.getAttribute('aria-pressed') : null
    }
    try {
      // はじめて開く人と同じ道: アプリを開いてシードを待ち、そのまま献立の「日」を見る
      await ddPage.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      await ddPage.waitForTimeout(2600) // 初回シード完了待ち
      await ddPage.reload({ waitUntil: 'networkidle' })
      await ddPage.waitForTimeout(1800)

      check(
        'DAYDEFAULT-01 前提: はじめて開いた画面に「今日なに作る？」が出る',
        (await ddSection().count()) === 1,
      )
      // ① 既定は「献立」
      check(
        'DAYDEFAULT-01 はじめて開いた人には「献立」が選ばれている',
        (await ddPressed('day-mode-plan')) === 'true' && (await ddPressed('day-mode-one')) === 'false',
        `献立=${await ddPressed('day-mode-plan')} 1品=${await ddPressed('day-mode-one')}`,
      )
      // ② 押していないのに組んだ献立が出ている
      {
        const ddRoleTexts = (
          await ddSection().locator('[data-testid="day-suggest-result"]').allTextContents()
        ).map((t) => t.replaceAll('​', ''))
        check(
          'DAYDEFAULT-01 押していないのに主菜・副菜が出ている',
          ddRoleTexts.length > 0 && ddRoleTexts.every((t) => /主菜|副菜/.test(t)),
          JSON.stringify(ddRoleTexts.map((t) => t.slice(0, 20))),
        )
        check(
          'DAYDEFAULT-01 決めてもらうボタンは「おまかせで献立を組む」になっている',
          stripZwspText(await ddBody()).includes(ja.mealPlan.todaySuggestButton),
        )
        check(
          'DAYDEFAULT-01 「今日の献立に入れる」まで、はじめの画面から使える',
          (await ddPage.locator('[data-testid="day-suggest-apply"]').count()) === 1,
        )
      }
      // ③ 絞り込みは、はじめの画面からそのまま見える
      check(
        'DAYDEFAULT-01 はじめの画面（献立）でも「条件をしぼる」が見えている',
        (await ddPressed('day-mode-plan')) === 'true' && (await ddBody()).includes('条件をしぼる'),
        `献立=${await ddPressed('day-mode-plan')}`,
      )
      // ④ 「1品」を押すと1品側になり、料理の種別まで選べる
      {
        await ddPage.locator('[data-testid="day-mode-one"]').click()
        await ddPage.waitForTimeout(900)
        check(
          'DAYDEFAULT-01 「1品」を押すと1品側になる',
          (await ddPressed('day-mode-one')) === 'true',
        )
        const ddConditions = ddSection().getByRole('button', { name: /条件をしぼる/ })
        check('DAYDEFAULT-01 前提: 「条件をしぼる」が押せる', (await ddConditions.count()) === 1)
        if ((await ddConditions.count()) === 1) {
          await ddConditions.click()
          await ddPage.waitForTimeout(500)
        }
        check(
          'DAYDEFAULT-01 1品側では料理の種別まで選べる',
          (await ddSection().getByRole('button', { name: '汁物', exact: true }).count()) === 1,
        )
        // 2026-08-19 便IA: 窓で開くようになったので、次へ進む前に閉じる
        const ddCloseConditions = ddPage.locator('[data-testid="day-conditions-close"]')
        if ((await ddCloseConditions.count()) === 1) {
          await ddCloseConditions.click()
          await ddPage.waitForTimeout(600)
        }
      }
      // ⑤ 自分で選んだ側は、開き直しても上書きされない
      await ddPage.reload({ waitUntil: 'networkidle' })
      await ddPage.waitForTimeout(1800)
      check(
        'DAYDEFAULT-01 自分で「1品」にしたあとは、開き直しても1品のまま',
        (await ddPressed('day-mode-one')) === 'true',
        `1品=${await ddPressed('day-mode-one')} 献立=${await ddPressed('day-mode-plan')}`,
      )
    } finally {
      await ddBrowser.close()
    }
  }

  // --- WEEKSELECT-01(2026-08-19 便HT・オーナー原文「栄養から組むのボタンは、プルダウンに
  // したい。ボタンがたくさん並ぶとごちゃつき感がある。和洋中選択も同様にプルダウン。
  // 調理時間15分いないを優先は、時間だけプルダウンで変更できるようにしたい。」)。
  //
  // 測るのは「**プルダウンで選んだ結果が効いているか**」であって、見た目がプルダウンかどうかでは
  // ない。効き先は「今日なに作る？」の献立側に出る主菜の候補数——週の「提案の条件」は
  // 献立エンジンがそのまま読むので、条件を変えれば候補の数が動く。
  //   ① 調理時間はプルダウン1つ（2026-08-20 便II・①でチップ＋分数の2つを1つにまとめた）
  //   ② 「指定なし」を選べば条件が外れ、分数を選べばその場で効く
  //   ③ 分数を10分→30分に広げると、主菜の候補が**増える**（選んだ分数が提案に効いている）
  //   ④ 料理のジャンルで「和食」を選ぶと、主菜の候補が**減る**（絞り込みが効いている）
  // 禁じ手よけ: 候補の数そのものを決め打ちしない（増えた・減ったの向きだけを見る）／
  // 曜日・月替わりの前提を置かない／文言の完全一致で測らない／
  // **数が読めなかったときは null のまま比較して必ず不合格になる形にする**
  //（読めない＝合格、に倒さない。2026-08-18 FS-06 の教訓） ---
  currentCheck = 'WEEKSELECT-01'
  {
    const wsBrowser = await chromium.launch()
    const wsContext = await wsBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wsPage = await wsContext.newPage()
    wsPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@WEEKSELECT-01] ${text}`)
    })
    wsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKSELECT-01] ${err.message}`)
    })
    /** 「今日なに作る？」の献立側に出ている主菜の候補数。読めなければ null（＝必ず不合格になる） */
    const wsMainCandidates = async () => {
      await wsPage.getByRole('button', { name: '日', exact: true }).click()
      await wsPage.waitForTimeout(1200)
      const body = ((await wsPage.textContent('body')) ?? '').replaceAll('​', '')
      const m = body.match(/主菜の候補\s*(\d+)\s*[品件]/)
      return m ? Number(m[1]) : null
    }
    /**
     * 週タブの「現在の条件」の窓を開いた状態にする。
     * 2026-08-19 便ID・④で折りたたみ→窓になったので、閉じてからでないと後ろの画面は触れない
     * （下の wsCloseConditions と対で使う）
     */
    const wsOpenConditions = async () => {
      const tab = wsPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
      if ((await tab.getAttribute('aria-pressed')) !== 'true') {
        await tab.click()
        await wsPage.waitForTimeout(800)
      }
      const group = wsPage.getByRole('button', { name: '献立を提案を開く' })
      if ((await group.count()) > 0) {
        await group.click()
        await wsPage.waitForTimeout(400)
      }
      if ((await wsPage.locator('[data-testid="plan-conditions-modal"]').count()) === 0) {
        await wsPage.locator('[data-testid="plan-conditions-open"]').click()
        await wsPage.waitForTimeout(500)
      }
    }
    /** 「現在の条件」の窓を閉じる（開いたままだと後ろの画面もタブも押せない） */
    const wsCloseConditions = async () => {
      const close = wsPage.locator('[data-testid="plan-conditions-close"]')
      if ((await close.count()) > 0) {
        await close.click()
        await wsPage.waitForTimeout(500)
      }
    }
    try {
      await wsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wsPage.waitForTimeout(2400) // 初回シード完了待ち
      await wsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wsPage.reload({ waitUntil: 'networkidle' })
      await wsPage.waitForTimeout(1800)

      await wsOpenConditions()
      // ① 調理時間はプルダウン1つ（2026-08-20 便II・①。チップ「調理時間◯分以内を優先」は無くした
      //    ＝実装は優先ではなく除外なので、文言が嘘だった）
      const wsMinutes = wsPage.locator('[data-testid="plan-quick-minutes"]')
      check('WEEKSELECT-01(便II・①) 調理時間はプルダウン1つ', (await wsMinutes.count()) === 1)
      check(
        'WEEKSELECT-01(便II・①) 「優先」と名乗るボタンは残っていない（実装は候補から外している）',
        (await wsPage.getByRole('button', { name: /分以内を優先/ }).count()) === 0,
      )
      check(
        'WEEKSELECT-01 前提: 調理時間はまだ指定していない',
        (await wsMinutes.inputValue()) === '',
        `いまの値=${await wsMinutes.inputValue()}`,
      )
      // ② 分数を選べばその場で効き、「指定なし」に戻せば外れる
      await wsMinutes.selectOption('20')
      await wsPage.waitForTimeout(600)
      check(
        'WEEKSELECT-01(便II・①) 分数を選ぶとその場で条件になる',
        (await wsMinutes.inputValue()) === '20',
        `いまの値=${await wsMinutes.inputValue()}`,
      )
      await wsMinutes.selectOption('10')
      await wsPage.waitForTimeout(700)
      check(
        'WEEKSELECT-01(便II・①) 選んだ分数は「現在の条件」のボタンにも出る',
        (((await wsPage.locator('[data-testid="plan-conditions-open"]').textContent()) ?? '')
          .replace(/​/g, '')
          .includes(ja.mealPlan.quickOnlySummary.replace('{n}', '10'))),
        `条件のボタン=${await wsPage.locator('[data-testid="plan-conditions-open"]').textContent()}`,
      )
      // ③ 10分 → 30分で主菜の候補が増える（選んだ分数が提案に効いている）
      await wsCloseConditions()
      const wsAt10 = await wsMainCandidates()
      await wsOpenConditions()
      await wsMinutes.selectOption('30')
      await wsPage.waitForTimeout(700)
      await wsCloseConditions()
      const wsAt30 = await wsMainCandidates()
      check(
        'WEEKSELECT-01 分数を10分→30分に広げると主菜の候補が増える（プルダウンの選択が提案に効いている）',
        wsAt10 != null && wsAt30 != null && wsAt30 > wsAt10,
        `10分=${wsAt10 ?? '読めず'} 30分=${wsAt30 ?? '読めず'}`,
      )
      // ④ 料理のジャンルで絞ると候補が減る
      //    2026-08-22 便IY: プルダウン1つ → 選べるジャンルの並び(複数選択)。既定は3つとも選んだ
      //    状態なので、「和食だけ」にするには残り2つを外す
      await wsOpenConditions()
      const wsChips = wsPage.locator('[data-testid="plan-genre-chip"]')
      check(
        'WEEKSELECT-01 料理のジャンルは選べるジャンルのぶんだけ並ぶ',
        (await wsChips.count()) === MEAL_GENRES.length,
        `並び=${await wsChips.count()}件`,
      )
      for (const off of ['洋食', '中華']) {
        const chip = wsPage.locator(`[data-testid="plan-genre-chip"][data-genre="${off}"]`)
        if ((await chip.count()) === 1) {
          await chip.click()
          await wsPage.waitForTimeout(500)
        }
      }
      await wsCloseConditions()
      const wsWashoku = await wsMainCandidates()
      check(
        'WEEKSELECT-01 料理のジャンルで「和食」を選ぶと主菜の候補が減る（絞り込みが効いている）',
        wsAt30 != null && wsWashoku != null && wsWashoku > 0 && wsWashoku < wsAt30,
        `指定なし=${wsAt30 ?? '読めず'} 和食=${wsWashoku ?? '読めず'}`,
      )
      // 窓を閉じていても、いま何で絞っているかがボタンから読める（便EOの約束を壊していない）
      await wsPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await wsPage.waitForTimeout(700)
      const wsCondLabel = (
        (await wsPage.locator('[data-testid="plan-conditions-open"]').textContent()) ?? ''
      ).replaceAll('​', '')
      check(
        'WEEKSELECT-01 「現在の条件」に、いまの分数とジャンルが出る',
        wsCondLabel.includes('30分以内') && wsCondLabel.includes('和食'),
        `ラベル=${wsCondLabel}`,
      )
    } finally {
      await wsBrowser.close()
    }
  }

  // --- KKGENRE-01（2026-08-24 便KK・オーナー裁定B案「タグを持たない品は『どのジャンルにも合う』
  //     として落とさない」）。
  //
  // 何が起きていたか（実データ90品＋同梱109品での実測）: 取り込んだレシピにはジャンルタグが
  // 1件も付かないので、「和食だけ」を選ぶと**自分の品だけが全部消えていた**。しかも自分の品しか
  // 無い端末では0件緩和が働いて全部出るので、**同じボタンが状況で正反対に効いて**いた。
  //
  // 測るのは画面に出る「主菜の候補◯品」の**動き**だけ（数そのものは決め打ちしない）。
  //   ① ジャンルタグの無い品を1品足すと、「和食だけ」の候補が1品ぶん増える（落とさない）
  //   ② 中華タグの品を1品足しても、「和食だけ」の候補は増えない（選ばなかったジャンルは落ちる）
  // 生のIndexedDBへ書いたあとは必ず reload する（Dexieの購読は生書き込みを見ないため。禁じ手⑥）---
  currentCheck = 'KKGENRE-01'
  {
    const kkBrowser = await chromium.launch()
    const kkContext = await kkBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kkPage = await kkContext.newPage()
    kkPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@KKGENRE-01] ${err.message}`)
    })
    /** 「今日なに作る？」の献立側に出ている主菜の候補数。読めなければ null（＝必ず不合格になる） */
    const kkMainCandidates = async () => {
      await kkPage.getByRole('button', { name: ja.mealPlan.viewDay, exact: true }).click()
      await kkPage.waitForTimeout(1200)
      const body = stripZwspText(await kkPage.textContent('body'))
      // 画面の字は書き写さず、ja.ts の文型から探す形にする（JM-1〜JM-5）
      const [head, tail] = ja.mealPlan.todaySuggestCandidateCount.split('{n}')
      const m = body.match(new RegExp(`${head}\\s*(\\d+)\\s*${tail}`))
      return m ? Number(m[1]) : null
    }
    /** 主菜になる品を1品足す（生のIndexedDB→そのあと必ず reload する） */
    const kkAddMain = async (title, tags) => {
      await kkPage.evaluate(
        async ({ title, tags }) => {
          const db = await new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
          await new Promise((res, rej) => {
            const req = db
              .transaction('recipes', 'readwrite')
              .objectStore('recipes')
              .add({
                title,
                servings: 2,
                effortLevel: 'normal',
                tags,
                dishType: 'main',
                ingredients: [{ name: 'とりもも肉', amount: '200', unit: 'g' }],
                steps: [{ text: 'フライパンで焼く' }],
                isFavorite: false,
                cookedLogs: [],
                searchWords: [],
                isStarter: false,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              })
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          db.close()
        },
        { title, tags },
      )
      await kkPage.reload({ waitUntil: 'networkidle' })
      await kkPage.waitForTimeout(1500)
    }
    try {
      await kkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kkPage.waitForTimeout(2400) // 初回シード完了待ち
      await kkPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await kkPage.reload({ waitUntil: 'networkidle' })
      await kkPage.waitForTimeout(1800)
      // 「和食だけ」にする（既定は3つとも選んだ状態＝指定なし）
      const kkTab = kkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
      if ((await kkTab.getAttribute('aria-pressed')) !== 'true') {
        await kkTab.click()
        await kkPage.waitForTimeout(800)
      }
      const kkGroup = kkPage.getByRole('button', { name: '献立を提案を開く' })
      if ((await kkGroup.count()) > 0) {
        await kkGroup.click()
        await kkPage.waitForTimeout(400)
      }
      if ((await kkPage.locator('[data-testid="plan-conditions-modal"]').count()) === 0) {
        await kkPage.locator('[data-testid="plan-conditions-open"]').click()
        await kkPage.waitForTimeout(500)
      }
      for (const off of MEAL_GENRES.filter((g) => g !== '和食')) {
        const chip = kkPage.locator(`[data-testid="plan-genre-chip"][data-genre="${off}"]`)
        if ((await chip.count()) === 1) {
          await chip.click()
          await kkPage.waitForTimeout(400)
        }
      }
      const kkClose = kkPage.locator('[data-testid="plan-conditions-close"]')
      if ((await kkClose.count()) > 0) {
        await kkClose.click()
        await kkPage.waitForTimeout(500)
      }
      const kkBase = await kkMainCandidates()
      check(
        'KKGENRE-01 前提: 「和食だけ」で主菜の候補が読める',
        kkBase != null && kkBase > 0,
        `和食だけ=${kkBase ?? '読めず'}`,
      )
      // ① ジャンルタグの無い品は落とさない
      await kkAddMain('KKタグ無しの主菜', [])
      const kkAfterTagless = await kkMainCandidates()
      check(
        'KKGENRE-01 ジャンルタグの無い品を足すと、「和食だけ」の候補が1品ぶん増える（落とさない）',
        kkBase != null && kkAfterTagless != null && kkAfterTagless === kkBase + 1,
        `足す前=${kkBase ?? '読めず'} 足したあと=${kkAfterTagless ?? '読めず'}`,
      )
      // ② 選ばなかったジャンルのタグが付いた品は今までどおり落ちる
      await kkAddMain('KK中華の主菜', ['中華'])
      const kkAfterChuka = await kkMainCandidates()
      check(
        'KKGENRE-01 中華タグの品を足しても、「和食だけ」の候補は増えない（選ばなかったジャンルは落ちる）',
        kkAfterTagless != null && kkAfterChuka != null && kkAfterChuka === kkAfterTagless,
        `足す前=${kkAfterTagless ?? '読めず'} 足したあと=${kkAfterChuka ?? '読めず'}`,
      )
    } finally {
      await kkBrowser.close()
    }
  }
