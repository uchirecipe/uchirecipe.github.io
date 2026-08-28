// ==========================================================================================
// e2e の節: 台所の器具・献立の組み方・日の提案
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
// この中の節: NAVI-KITCHEN, MEALPLAN-A2, MEALPLAN-A3B3, MEALPLAN-DU, MEALPLAN-A1B2, MEALPLAN-A4, MEALPLAN-A5, MEALPLAN-ROLE, DAYSUGGEST-01
// ==========================================================================================
import './_shared.mjs'


  // --- NAVI-KITCHEN: 設定「台所の器具」(2026-08-13 便GC・docs/72 第3段。実操作テスト2体目
  // 「設定を全部見ましたが、コンロ・IH・レンジといった器具の設定は一つもありません。うちは1口
  // なので、この段取りはそもそも成立しません」)。
  // 見るのは3つだけ: ①既定が2口で3器具とも「持っている」 ②選んだ値が読み込み直しても残る
  // ③持っていない器具の扱いが画面に書いてある(設定した結果が読めないと、設定した意味がない)。 ---
  currentCheck = 'NAVI-KITCHEN'
  {
    const kcBrowser = await chromium.launch()
    const kcContext = await kcBrowser.newContext()
    const kcPage = await kcContext.newPage()
    kcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@NAVI-KITCHEN] ${text}`)
    })
    kcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-KITCHEN] ${err.message}`)
    })
    try {
      await kcPage.goto(`${BASE}/#/settings?section=kitchen`, { waitUntil: 'networkidle' })
      await kcPage.waitForTimeout(2000) // 初回シード完了待ち
      const kcBurners = kcPage.getByTestId('kitchen-burners')
      check(
        'NAVI-KITCHEN 設定に「台所の器具」があり、コンロの既定は2口',
        (await kcBurners.count()) === 1 && (await kcBurners.inputValue()) === '2',
        `count=${await kcBurners.count()} value=${await kcBurners.inputValue()}`,
      )
      check(
        'NAVI-KITCHEN レンジ・グリル・トースターの既定は「持っている」',
        (await kcPage.getByTestId('kitchen-kitchenNoMicrowave').getAttribute('aria-checked')) === 'true' &&
          (await kcPage.getByTestId('kitchen-kitchenNoGrill').getAttribute('aria-checked')) === 'true' &&
          (await kcPage.getByTestId('kitchen-kitchenNoToaster').getAttribute('aria-checked')) === 'true',
      )
      check(
        'NAVI-KITCHEN 持っていない器具の扱いと、変えると段取りが組み直されることが書いてある',
        ((await kcPage.textContent('body')) ?? '').includes(ja.settings.kitchenMissingNote) &&
          ((await kcPage.textContent('body')) ?? '').includes(ja.settings.kitchenChangeNote),
      )
      await kcBurners.selectOption('1')
      await kcPage.getByTestId('kitchen-kitchenNoGrill').click()
      await kcPage.waitForTimeout(700)
      await kcPage.reload({ waitUntil: 'networkidle' })
      await kcPage.waitForTimeout(1500)
      check(
        'NAVI-KITCHEN 選んだ口数と「持っていない」は読み込み直しても残る',
        (await kcPage.getByTestId('kitchen-burners').inputValue()) === '1' &&
          (await kcPage.getByTestId('kitchen-kitchenNoGrill').getAttribute('aria-checked')) === 'false',
      )
    } finally {
      await kcBrowser.close()
    }
  }

  // --- MEALPLAN-A2: 日付メモ(2026-07-29 便CB-1・docs/59 A-2)。レシピに紐付かない1行メモを
  // 週タブの日カードで書き、月タブのセルに「メモあり」の印が出て、日モーダルからも同じメモを
  // 読み書きできること、空にすると消えること(データも消えること)を確認する。
  // 月タブはPro機能のためIndexedDB直書きで解錠する(MEALPLAN-07と同手法)。 ---
  currentCheck = 'MEALPLAN-A2'
  {
    const dnBrowser = await chromium.launch()
    const dnContext = await dnBrowser.newContext()
    const dnPage = await dnContext.newPage()
    dnPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-A2] ${text}`)
    })
    dnPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-A2] ${err.message}`)
    })
    try {
      await dnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dnPage.waitForTimeout(1800) // 初回シード完了待ち
      // Pro解錠(IndexedDB直書き)
      await dnPage.evaluate(async () => {
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
      await dnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dnPage.reload({ waitUntil: 'networkidle' })
      await dnPage.waitForTimeout(800)

      const dnNow = new Date()
      const dnDay = dnNow.getDate()
      const dnNoteLabel = `${dnNow.getMonth() + 1}月${dnDay}日のメモ`
      const dnToday = `${dnNow.getFullYear()}-${String(dnNow.getMonth() + 1).padStart(2, '0')}-${String(dnDay).padStart(2, '0')}`

      // 週タブ: 今日のカードのメモ欄に入力し、欄から離れると保存される
      await dnPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(dnPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await dnPage.waitForTimeout(400)
      const dnWeekInput = dnPage.getByLabel(dnNoteLabel)
      check('MEALPLAN-A2 週タブの各日カードにメモ欄がある', (await dnWeekInput.count()) === 1)
      check(
        'MEALPLAN-A2 メモ欄は空のとき書き方の例をプレースホルダーで示す',
        (await dnWeekInput.getAttribute('placeholder')) === ja.mealPlan.dayNotePlaceholder,
      )
      await dnWeekInput.fill('外食')
      await dnPage.keyboard.press('Enter')
      await dnPage.waitForTimeout(500)
      check(
        'MEALPLAN-A2 メモを書いて欄を離れると保存され、保存した旨のトーストが出る',
        stripZwspText(await dnPage.textContent('body')).includes(ja.mealPlan.dayNoteSaved),
      )
      const dnStored = await dnPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('dayNotes', 'readonly')
              const g = tx.objectStore('dayNotes').get(date)
              g.onsuccess = () => resolve(g.result ?? null)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        dnToday,
      )
      check(
        'MEALPLAN-A2 メモは献立(mealPlans)ではなく日付メモ専用テーブルに1日1件で保存される',
        dnStored != null && dnStored.date === dnToday && dnStored.text === '外食',
        `stored=${JSON.stringify(dnStored)}`,
      )
      // 献立の登録が無くてもメモだけが保存できている(レシピに紐付かない自由メモであること)
      const dnPlanCount = await dnPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-A2 メモを書いても献立(mealPlans)には1件も行が増えない',
        dnPlanCount === 0,
        `mealPlans=${dnPlanCount}`,
      )

      // 月タブ: セルに「メモあり」の控えめな印が出る(写真モードのまま=既定)
      await dnPage.getByRole('button', { name: '月', exact: true }).click()
      await dnPage.waitForTimeout(500)
      check(
        'MEALPLAN-A2 月カレンダーの今日のセルに「メモあり」の印が出る',
        (await dnPage.locator(`button[data-date="${dnToday}"] [aria-label="メモあり"]`).count()) === 1,
      )
      check(
        'MEALPLAN-A2 メモの無い日のセルには印が出ない(1件だけ)',
        (await dnPage.locator('[aria-label="メモあり"]').count()) === 1,
      )

      // 日モーダル: 同じメモが読める→空にすると消える
      await dnPage.locator(`button[data-date="${dnToday}"]`).click()
      await dnPage.waitForTimeout(400)
      const dnModal = dnPage.getByRole('dialog')
      const dnModalInput = dnModal.getByLabel(dnNoteLabel)
      check('MEALPLAN-A2 月タブの日モーダルにも同じメモ欄がある', (await dnModalInput.count()) === 1)
      check(
        'MEALPLAN-A2 日モーダルのメモ欄に週タブで書いた内容が入っている',
        (await dnModalInput.inputValue()) === '外食',
      )
      await dnModalInput.fill('')
      await dnPage.keyboard.press('Enter')
      await dnPage.waitForTimeout(500)
      check(
        'MEALPLAN-A2 メモを空にして離れると消した旨のトーストが出る',
        stripZwspText(await dnPage.textContent('body')).includes(ja.mealPlan.dayNoteRemoved),
      )
      const dnAfter = await dnPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('dayNotes', 'readonly')
              const g = tx.objectStore('dayNotes').get(date)
              g.onsuccess = () => resolve(g.result ?? null)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        dnToday,
      )
      check('MEALPLAN-A2 空にしたメモはデータごと消える(空のメモを残さない)', dnAfter === null)
      await dnPage.getByRole('button', { name: ja.common.close, exact: true }).first().click()
      await dnPage.waitForTimeout(400)
      check(
        'MEALPLAN-A2 メモを消すと月セルの印も消える',
        (await dnPage.locator('[aria-label="メモあり"]').count()) === 0,
      )
    } finally {
      await dnBrowser.close()
    }
  }

  // --- MEALPLAN-A3B3: 月タブから直接 追加/差し替え/削除(A-3)と、月間サマリーの常設(B-3)。
  // 2026-07-29 便CB-1・docs/59。翌月(=全日が未来日)の10日を開き、日モーダルの中だけで
  //  ・空き行「レシピを選ぶ」→ピッカー→肉じゃが を割り当てられる(週タブへ飛ばない)
  //  ・割り当て後もモーダルは開いたままで、続けて編集できる(ピッカーはモーダルより上に出る)
  //  ・役割(主菜/副菜)の粒度が保たれる(主菜行に入れたら role=main で保存される)
  //  ・×で削除できる(データも消える)
  // を確認し、あわせて期間を選ばなくても月間サマリーが出ていること(B-3)を確認する。
  // 月タブはPro機能のためIndexedDB直書きで解錠する(MEALPLAN-07と同手法)。 ---
  currentCheck = 'MEALPLAN-A3B3'
  {
    const meBrowser = await chromium.launch()
    const meContext = await meBrowser.newContext()
    const mePage = await meContext.newPage()
    mePage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-A3B3] ${text}`)
    })
    mePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-A3B3] ${err.message}`)
    })
    try {
      await mePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mePage.waitForTimeout(1800) // 初回シード完了待ち
      await mePage.evaluate(async () => {
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
      await mePage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mePage.reload({ waitUntil: 'networkidle' })
      await mePage.waitForTimeout(800)
      await mePage.getByRole('button', { name: '月', exact: true }).click()
      await mePage.waitForTimeout(400)

      // B-3: 期間を1日も選んでいない状態で、月間サマリーが最初から出ている
      const meNow = new Date()
      // 2026-08-03 便DQ: 見出しは「◯月の食費」と「◯月の栄養（1人分）」の2枚に分かれた
      const meThisMonthTitle = `${meNow.getMonth() + 1}月の食費`
      const meBodyBefore = (await mePage.textContent('body')) ?? ''
      check(
        'MEALPLAN-A3B3(B-3) 期間を選ばなくても月間サマリーが月タブ上部に出ている',
        meBodyBefore.includes(meThisMonthTitle),
        `title=${meThisMonthTitle}`,
      )
      check(
        // 2026-08-19 便HV・⑦でボタン名を「期間で絞る」に変えた(機能は同じ)
        'MEALPLAN-A3B3(B-3) 期間指定のUI(期間で絞る)も従来どおり残っている',
        (await mePage.getByRole('button', { name: ja.mealPlan.rangeCostToggle, exact: true }).count()) === 1,
      )

      // 翌月へ移動(全日が未来日=編集対象)。10日のセルを開く
      await mePage.getByRole('button', { name: ja.mealPlan.nextMonth, exact: true }).click()
      await mePage.waitForTimeout(400)
      const meNext = new Date(meNow.getFullYear(), meNow.getMonth() + 1, 1)
      const meDate = `${meNext.getFullYear()}-${String(meNext.getMonth() + 1).padStart(2, '0')}-10`
      // 2026-08-07 便DU: 月の食費カードは折りたたみになった(既定は畳む)。
      // 見出しは畳んだままでも出るので、中身を読む検査の前に押して開く（開閉は月を移動しても保つ）
      const meCostCardBtn = mePage.getByRole('button', { name: /月の食費/ })
      check(
        'MEALPLAN-A3B3(便DU) 月の食費カードは既定で畳まれている(カレンダーを押し下げない)',
        (await meCostCardBtn.getAttribute('aria-expanded')) === 'false',
      )
      await meCostCardBtn.click()
      await mePage.waitForTimeout(300)
      check(
        'MEALPLAN-A3B3(B-3) 記録も予定も無い月は、数字の代わりに空の案内を出す',
        ((await mePage.textContent('body')) ?? '').includes(ja.mealPlan.monthSummaryEmpty),
      )
      await mePage.locator(`button[data-date="${meDate}"]`).click()
      await mePage.waitForTimeout(400)
      const meModal = mePage.locator('[role="dialog"]')
      check('MEALPLAN-A3B3(A-3) 日モーダルが開く', await meModal.isVisible())
      // 2026-08-23 便JN: 空き行や1品ごとの操作は「編集」を押した先へ移った（週タブと同じ2モード）
      const meEditOn = await openMonthDayEdit(mePage)
      check('MEALPLAN-A3B3(便JN) 前提: 日の窓を編集モードにできた', meEditOn === true, `結果=${meEditOn}`)
      check(
        'MEALPLAN-A3B3(A-3) 献立の無い未来日でも、その場で選べる空き行が出る',
        (await meModal.getByRole('button', { name: ja.mealPlan.emptyAssign }).count()) >= 1,
      )
      // 主菜行の「レシピを選ぶ」→ピッカー→肉じゃが
      await meModal.getByRole('button', { name: ja.mealPlan.emptyAssign }).first().click()
      await mePage.waitForTimeout(400)
      check(
        'MEALPLAN-A3B3(A-3) 月タブのままピッカーが開く(週タブへ飛ばない)',
        (await mePage.getByRole('button', { name: '月', exact: true }).getAttribute('aria-pressed')) ===
          'true',
      )
      // 2026-07-30 便CH/C13: 重ね窓をEscape・端末の戻るで1枚ずつ閉じる。
      // 従来はどちらでも閉じず、戻ると献立画面ごとレシピ一覧へ離脱していた(見ていた月も失われる)
      await mePage.keyboard.press('Escape')
      await mePage.waitForTimeout(400)
      check(
        'MEALPLAN-A3B3(便CH/C13) ピッカーはEscapeで閉じる',
        (await mePage.getByRole('heading', { name: ja.mealPlan.pickTitle }).count()) === 0,
      )
      check(
        'MEALPLAN-A3B3(便CH/C13) ピッカーを閉じても下の日モーダルは開いたまま残る',
        await meModal.isVisible(),
      )
      await mePage.goBack()
      await mePage.waitForTimeout(500)
      check(
        'MEALPLAN-A3B3(便CH/C13) 端末の戻るでは日モーダルだけが閉じ、月タブから離脱しない',
        !(await meModal.isVisible()) &&
          mePage.url().includes('/meal-plan') &&
          (await mePage.getByRole('button', { name: '月', exact: true }).getAttribute('aria-pressed')) ===
            'true',
        `url=${mePage.url()}`,
      )
      // 続きの検証のため、日モーダル→編集モード→ピッカーを開き直す
      await mePage.locator(`button[data-date="${meDate}"]`).click()
      await mePage.waitForTimeout(400)
      const meEditOn2 = await openMonthDayEdit(mePage)
      check('MEALPLAN-A3B3(便JN) 前提: 開き直した窓も編集モードにできた', meEditOn2 === true, `結果=${meEditOn2}`)
      await meModal.getByRole('button', { name: ja.mealPlan.emptyAssign }).first().click()
      await mePage.waitForTimeout(400)
      await mePage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await mePage.waitForTimeout(300)
      await mePage.getByRole('button', { name: /肉じゃが/ }).first().click()
      await mePage.waitForTimeout(600)
      check(
        'MEALPLAN-A3B3(A-3) 選び終わってもモーダルは開いたまま(続けて編集できる)',
        await meModal.isVisible(),
      )
      check(
        'MEALPLAN-A3B3(A-3) モーダルの主菜行に選んだレシピが入る',
        ((await meModal.textContent()) ?? '').includes('肉じゃが'),
      )
      const meSaved = await mePage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.filter((e) => e.date === date))
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        meDate,
      )
      check(
        'MEALPLAN-A3B3(A-3) 月から入れた献立は、その日・その食事の主菜として1件だけ保存される',
        meSaved.length === 1 && meSaved[0].slot === 'dinner' && meSaved[0].role === 'main',
        `saved=${JSON.stringify(meSaved)}`,
      )
      check(
        'MEALPLAN-A3B3(A-3) 手で選んだ枠なので自動提案由来(auto)にはならない',
        meSaved[0].auto !== true,
        `auto=${meSaved[0].auto}`,
      )
      // B-3: 予定を入れた翌月のサマリーに金額が出る(期間選択なし)
      const meMonthTitle = `${meNext.getMonth() + 1}月の食費`
      // 2026-08-07 便DU: この画面で献立を1品足したので、窓の下は「キャンセル」「保存」になる。
      // 「保存」は入っている内容を確定して閉じる(データはこの時点ですでに入っている)
      check(
        'MEALPLAN-A3B3(便DU) 献立を変えた日の窓は下が「キャンセル」「保存」になる',
        (await meModal.locator('[data-testid="day-modal-save"]').count()) === 1 &&
          (await meModal.locator('[data-testid="day-modal-cancel"]').count()) === 1 &&
          (await meModal.locator('[data-testid="day-modal-close"]').count()) === 0,
      )
      await meModal.locator('[data-testid="day-modal-save"]').click()
      await mePage.waitForTimeout(400)
      check('MEALPLAN-A3B3(便DU) 「保存」で日の窓が閉じる', !(await meModal.isVisible()))
      // 便DU: 栄養カードも折りたたみになったので、8項目を読む前に開く
      await mePage.getByRole('button', { name: /月の栄養（1人分）/ }).click()
      await mePage.waitForTimeout(300)
      const meBodyAfter = (await mePage.textContent('body')) ?? ''
      check(
        'MEALPLAN-A3B3(B-3) 表示中の月のサマリーが見出しに月を出す',
        meBodyAfter.includes(meMonthTitle),
        `title=${meMonthTitle}`,
      )
      check(
        'MEALPLAN-A3B3(B-3) 未来の月は「今日から先の期間なので、登録した献立で計算しています」と基準を明示する',
        meBodyAfter.includes(ja.mealPlan.rangeBasisPlanOnly),
      )
      // 2026-08-03 便DQ: 食費は表になった。1行目「一人分／献立を1食ずつ足した合計」の金額を読む
      const meCostTable = mePage.locator('table', { hasText: ja.mealPlan.intakeCostRowPersonalNote }).first()
      const meCostTableText = (await meCostTable.textContent()) ?? ''
      const meSummaryYen = /1人分献立を1食ずつ足した合計約([\d,]+)円(\d+)食/.exec(meCostTableText)
      check(
        'MEALPLAN-A3B3(B-3・便DQ) 食費の表の「1人分」行に0円ではない金額と食数が出る',
        !!meSummaryYen &&
          Number(meSummaryYen[1].replaceAll(',', '')) > 0 &&
          Number(meSummaryYen[2]) > 0,
        `表=${meCostTableText.slice(0, 160)}`,
      )
      check(
        'MEALPLAN-A3B3(B-3) 内訳は既定で畳まれている(カレンダーを押し下げない)',
        !meBodyAfter.includes('内訳 作った記録'),
      )
      // 2026-08-19 便HV・⑨(オーナー指示「過去と未来に分ける必要なし」): 全部が今日から先の月でも、
      // 行は「1人分」「全員分」「1日あたりの平均」の1組だけ。予定用の下段は作らない
      check(
        // 「割れていない」は表の作りで測る: 予定用の下段は別のtbodyだったので、tbodyが1つなら割れていない
        'MEALPLAN-A3B3(便HV) 未来の月でも表の行は1組だけで、予定用の下段は出ない',
        (await meCostTable.locator('tbody').count()) === 1 &&
          !meCostTableText.includes('これから作る予定') &&
          (meCostTableText.match(/1人分/g) ?? []).length === 1,
        `表=${meCostTableText.slice(0, 240)}`,
      )
      check(
        'MEALPLAN-A3B3(便HV) 記録が無い月でも「全員分」と「1日あたりの平均」は作る予定ぶんで出る',
        /全員分[^約]{0,20}約[\d,]+円のべ\d+食/.test(meCostTableText) &&
          /1日あたりの平均[^約]{0,20}約[\d,]+円/.test(meCostTableText),
        `表=${meCostTableText.slice(0, 240)}`,
      )
      // 2026-08-28 便MB（オーナー「内訳の中にも同じ内容の文があるため」）: 表のすぐ下に置いていた
      // 「食材の目安価格をもとに自動計算した概算の数値です」(旧 intakeCostEstimateNote) は消した。
      // 同じ中身は内訳の中の weekCostNote が言っているので、**外には出さない**ことを見張る
      // （内訳を開いたときに出ることは、この節の後ろの「常設サマリーも〜」が見ている）
      check(
        'MEALPLAN-A3B3(便MB) 概算の但し書きを内訳の外にもう1つ置いていない',
        !meBodyAfter.includes(ja.mealPlan.weekCostNote),
        `外=${meBodyAfter.slice(0, 200)}`,
      )
      // 2026-08-03 便DQ: 栄養は別カード(見出しは「◯月の栄養（1人分）」)。
      // 2026-08-07 便DU: そのカード自体が折りたたみになり、開けば8項目がまとめて出る
      check(
        'MEALPLAN-A3B3(便DQ・便DU) 栄養は食費と別のカードで、開くと8項目がまとめて出る',
        meBodyAfter.includes(`${meNext.getMonth() + 1}月の栄養（1人分）`) &&
          meBodyAfter.includes('たんぱく質') &&
          meBodyAfter.includes('カルシウム'),
      )
      check(
        'MEALPLAN-A3B3(便DQ) 栄養の長い但し書きと出典は折りたたみの中(既定では出さない)',
        !meBodyAfter.includes('調理による変化などは反映しておらず') && !meBodyAfter.includes('出典: '),
      )
      await mePage.getByRole('button', { name: '注記と出典' }).click()
      await mePage.waitForTimeout(300)
      check(
        'MEALPLAN-A3B3(便DQ) 「注記と出典」で概算の但し書きと成分表の出典が出る',
        ((await mePage.textContent('body')) ?? '').includes('調理による変化などは反映しておらず') &&
          ((await mePage.textContent('body')) ?? '').includes('出典: '),
      )
      await mePage.getByRole('button', { name: ja.mealPlan.intakeCostDetailsOpen }).click()
      await mePage.waitForTimeout(300)
      const meBodyOpen = (await mePage.textContent('body')) ?? ''
      check(
        'MEALPLAN-A3B3(B-3) 「内訳を見る」で実績/予定の1人分の内訳が出る',
        meBodyOpen.includes('内訳 作った記録'),
      )
      check(
        'MEALPLAN-A3B3(B-3) 常設サマリーも「概算・目安」の但し書きを外さない',
        // 2026-07-30 便CH/C2: 注記の文言を実装どおり(目安価格で自動計算している)に直した
        meBodyOpen.includes('概算') &&
          meBodyOpen.includes('食材の目安価格で自動計算しています'),
      )
      // A-3: 月の窓から削除もできる(データごと消える)。2026-08-23 便JN: 外すのは編集モードの中
      await mePage.locator(`button[data-date="${meDate}"]`).click()
      await mePage.waitForTimeout(400)
      const meEditOn3 = await openMonthDayEdit(mePage)
      check('MEALPLAN-A3B3(便JN) 前提: 外す前に窓を編集モードにできた', meEditOn3 === true, `結果=${meEditOn3}`)
      await meModal.getByRole('button', { name: ja.mealPlan.clear }).first().click()
      await mePage.waitForTimeout(600)
      const meAfterRemove = await mePage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.filter((e) => e.date === date).length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        meDate,
      )
      check('MEALPLAN-A3B3(A-3) 月の窓から外すと献立が消える(0件)', meAfterRemove === 0)
      check(
        'MEALPLAN-A3B3(A-3) 外した後も月タブのまま(週へ飛ばされない)',
        (await mePage.getByRole('button', { name: '月', exact: true }).getAttribute('aria-pressed')) ===
          'true',
      )
    } finally {
      await meBrowser.close()
    }
  }

  // --- MEALPLAN-DU: 月カレンダーの写真の選び方と、日の窓の閉じる/キャンセル(2026-08-07 便DU・オーナー指示)。
  //  ⑤ その日の「作った記録」の写真をレシピの写真より優先する＋「レシピの写真は使わない」の切り替え
  //  ⑥ その日に写真の候補が複数あるとき、カレンダーに出す1枚を日ごとに選べる
  //  ⑦ 日の窓の下に「閉じる」を置く
  //  ⑧ この画面で献立を変えたら「キャンセル」で開いたときの状態へ戻せる(確認文は規約F)
  //  ⑨ 「カレンダーの表示のしかた」の切り替えに見出しと説明を付ける
  // 月タブはPro機能のためIndexedDB直書きで解錠する(MEALPLAN-07と同手法)。 ---
  currentCheck = 'MEALPLAN-DU'
  {
    const duBrowser = await chromium.launch()
    const duContext = await duBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const duPage = await duContext.newPage()
    let duDialog = ''
    await collectConfirms(duPage, (text) => {
      duDialog = text
    })
    duPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-DU] ${text}`)
    })
    duPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-DU] ${err.message}`)
    })
    try {
      await duPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await duPage.waitForTimeout(1800) // 初回シード完了待ち

      const duNow = new Date()
      const duPad = (n) => String(n).padStart(2, '0')
      const duPrefix = `${duNow.getFullYear()}-${duPad(duNow.getMonth() + 1)}`
      const duToday = `${duPrefix}-${duPad(duNow.getDate())}`
      // 今日と重ならない検証用の日を、必ず当月内に2つ取る
      const duFallback = `${duPrefix}-${duPad(duNow.getDate() === 15 ? 16 : 15)}`
      const duOrder = `${duPrefix}-${duPad(duNow.getDate() === 20 ? 21 : 20)}`

      // 検証用の作った記録を仕込む。写真は本物の1x1 PNG(壊れた画像で読み込みエラーを出さないため)。
      //  today   … 2品とも記録に写真あり＝日ごとに選べる候補が2つになる
      //  order   … idの小さい方(その日の先頭の記録)には写真が無く、2品目にだけ写真がある
      //            ＝便DU以前の「先頭の記録しか見ない」実装なら写真が出ない日
      //  fallback… 記録の写真は無く、レシピに登録した写真だけがある＝代用が効く日
      const duIds = await duPage.evaluate(
        ({ today, fallback, order }) =>
          new Promise((resolve, reject) => {
            const b64 =
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
            const bin = atob(b64)
            const bytes = new Uint8Array(bin.length)
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
            const png = () => new Blob([bytes], { type: 'image/png' })
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const a = g.result.find((r) => r.title === '肉じゃが')
                const b = g.result.find((r) => r.title === 'カレーライス')
                // recipesはid順で読まれるので、idの小さい方がその日の「先頭の記録」になる
                const first = a.id < b.id ? a : b
                const second = a.id < b.id ? b : a
                store.put({
                  ...first,
                  photo: undefined,
                  cookedLogs: [{ date: today, photo: png() }, { date: order }],
                })
                store.put({
                  ...second,
                  photo: png(),
                  cookedLogs: [
                    { date: today, photo: png() },
                    { date: fallback },
                    { date: order, photo: png() },
                  ],
                })
                tx.oncomplete = () =>
                  resolve({
                    first: first.id,
                    second: second.id,
                    firstTitle: first.title,
                    secondTitle: second.title,
                  })
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { today: duToday, fallback: duFallback, order: duOrder },
      )
      // Pro解錠(IndexedDB直書き)
      await duPage.evaluate(async () => {
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
      await duPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await duPage.reload({ waitUntil: 'networkidle' })
      await duPage.waitForTimeout(900)
      await duPage.getByRole('button', { name: '月', exact: true }).click()
      await duPage.waitForTimeout(600)

      const duCell = (date) => duPage.locator(`button[data-date="${date}"]`)
      const duBody0 = (await duPage.textContent('body')) ?? ''

      // ⑨ 表示の切り替えに見出しと説明が付く
      check(
        'MEALPLAN-DU(⑨) 「カレンダーの表示のしかた」の見出しが画面に出る',
        duBody0.includes(ja.mealPlan.monthCellModeLabel),
      )
      check(
        'MEALPLAN-DU(⑨) 写真モードでは「何が出るのか」の説明が切り替えのすぐ下に出る',
        duBody0.includes('その日の「作った記録」の写真を出します'),
      )
      // ① カレンダーが月タブの先頭側にある(食費・栄養のカードより前に描かれる)
      const duCalendarIndex = duBody0.indexOf('月火水木金土日')
      check(
        'MEALPLAN-DU(①) カレンダーが月の食費カードより先に出る',
        duCalendarIndex >= 0 && duCalendarIndex < duBody0.indexOf('月の食費'),
        `カレンダー=${duCalendarIndex} 食費=${duBody0.indexOf('月の食費')}`,
      )

      // ⑤ 記録の写真は「その日の何品目にあっても」レシピの写真より先に拾う(便DU以前の回帰防止)
      check(
        'MEALPLAN-DU(⑤) 先頭の記録に写真が無くても、2品目の記録の写真をセルに出す',
        (await duCell(duOrder).locator('img').count()) === 1,
      )
      check(
        'MEALPLAN-DU(⑤) 記録に写真が無い日はレシピの写真で代用する(従来どおり)',
        (await duCell(duFallback).locator('img').count()) === 1,
      )
      // ⑤ 「レシピの写真は使わない」
      const duHideBtn = duPage.locator('[data-testid="month-hide-recipe-photo"]')
      check('MEALPLAN-DU(⑤) 写真モードに「レシピの写真は使わない」が出る', (await duHideBtn.count()) === 1)
      // 2026-08-28 便MB（オーナー「ONOFFするタイプのボタンはスイッチにしてください」）:
      // 設定に残る入切なのでスイッチ（role="switch" + aria-checked）になった
      check(
        'MEALPLAN-DU(便MB) 「レシピの写真は使わない」はスイッチ(role=switch)',
        (await duHideBtn.getAttribute('role')) === 'switch',
        `role=${await duHideBtn.getAttribute('role')}`,
      )
      check(
        'MEALPLAN-DU(⑤) 既定は「使う」(入っていない)',
        (await duHideBtn.getAttribute('aria-checked')) === 'false',
      )
      await duHideBtn.click()
      await duPage.waitForTimeout(500)
      check(
        'MEALPLAN-DU(⑤) 「レシピの写真は使わない」でレシピ写真だけの日から写真が消える',
        (await duCell(duFallback).locator('img').count()) === 0,
      )
      check(
        'MEALPLAN-DU(⑤) 記録の写真がある日は残る',
        (await duCell(duOrder).locator('img').count()) === 1 &&
          (await duCell(duToday).locator('img').count()) === 1,
      )
      // 選択は設定に記憶される
      await duPage.reload({ waitUntil: 'networkidle' })
      await duPage.waitForTimeout(900)
      await duPage.getByRole('button', { name: '月', exact: true }).click()
      await duPage.waitForTimeout(500)
      check(
        'MEALPLAN-DU(⑤) 「レシピの写真は使わない」は設定に記憶される',
        (await duPage
          .locator('[data-testid="month-hide-recipe-photo"]')
          .getAttribute('aria-checked')) === 'true',
      )
      await duPage.locator('[data-testid="month-hide-recipe-photo"]').click()
      await duPage.waitForTimeout(400)
      // 栄養/食費モードでは写真を敷かないので、この切り替えも出さない
      await duPage.getByRole('button', { name: '食費', exact: true }).click()
      await duPage.waitForTimeout(400)
      check(
        'MEALPLAN-DU(⑤) 食費モードでは「レシピの写真は使わない」を出さない',
        (await duPage.locator('[data-testid="month-hide-recipe-photo"]').count()) === 0,
      )
      check(
        // 2026-08-19 便HV・⑩(オーナー指示「説明が長いので、数値が概算であることと1日分の
        // 数値であることの説明のみで良いのでは？」): 数え方の長い説明は落とし、
        // 「概算であること」と「その日に1人が食べる分であること」だけを言う
        'MEALPLAN-DU(⑨→便EA→便HV) 食費モードの説明は「概算」と「その日に1人が食べる分」だけを言う',
        await (async () => {
          const legend = ((await duPage.textContent('body')) ?? '').replaceAll('\u200b', '')
          return (
            legend.includes(ja.mealPlan.monthCellCostLegend) &&
            !legend.includes('今日は作った分は記録・まだの分は献立で計算しています')
          )
        })(),
      )
      await duPage.getByRole('button', { name: '写真', exact: true }).click()
      await duPage.waitForTimeout(400)

      // ⑥⑦ 今日(記録が2品ある日)の窓を開く
      await duCell(duToday).click()
      await duPage.waitForTimeout(500)
      const duModal = duPage.locator('[role="dialog"]')
      check('MEALPLAN-DU(⑦) 日の窓が開く', await duModal.isVisible())
      check(
        'MEALPLAN-DU(⑦) 何も変えていない窓の下は「閉じる」1つだけ',
        (await duModal.locator('[data-testid="day-modal-close"]').count()) === 1 &&
          (await duModal.locator('[data-testid="day-modal-save"]').count()) === 0 &&
          (await duModal.locator('[data-testid="day-modal-cancel"]').count()) === 0,
      )
      const duPicker = duModal.locator('[data-testid="day-cover-picker"]')
      // 2026-08-23 便JN: 「カレンダーに出す写真」の指名は編集モードの中へ移した
      // （通常表示は写真と料理名だけ＝オーナー原文「普段の見え方をシンプルにする」）
      check(
        'MEALPLAN-DU(便JN) 通常表示には写真の選び直しを出さない',
        (await duPicker.count()) === 0,
        `件数=${await duPicker.count()}`,
      )
      const duEditOn = await openMonthDayEdit(duPage)
      check('MEALPLAN-DU(便JN) 前提: 日の窓を編集モードにできた', duEditOn === true, `結果=${duEditOn}`)
      check('MEALPLAN-DU(⑥) 候補が2つ以上ある日に写真の選び直しが出る', (await duPicker.count()) === 1)
      check(
        'MEALPLAN-DU(⑥) 候補は「自動で選ぶ」＋その日の料理2品',
        (await duPicker.locator('button').count()) === 3,
        `件数=${await duPicker.locator('button').count()}`,
      )
      check(
        'MEALPLAN-DU(⑥) 既定は「自動で選ぶ」が選ばれている',
        (await duPicker.getByRole('button', { name: ja.mealPlan.monthDayCoverAutoAria }).getAttribute(
          'aria-pressed',
        )) === 'true',
      )
      await duPicker
        .getByRole('button', { name: `${duIds.secondTitle}の写真をカレンダーに出す` })
        .click()
      await duPage.waitForTimeout(500)
      const duChosen = await duPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readonly')
              const g = tx.objectStore('settings').get(1)
              g.onsuccess = () => resolve(g.result?.monthDayCoverRecipe ?? null)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-DU(⑥) 選んだ料理は日付ごとに設定へ残る',
        !!duChosen && duChosen[duToday] === duIds.second,
        `保存=${JSON.stringify(duChosen)} 期待=${duToday}:${duIds.second}`,
      )
      await duPicker.getByRole('button', { name: ja.mealPlan.monthDayCoverAutoAria }).click()
      await duPage.waitForTimeout(500)
      const duCleared = await duPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('settings', 'readonly')
              const g = tx.objectStore('settings').get(1)
              g.onsuccess = () => resolve(g.result?.monthDayCoverRecipe ?? null)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-DU(⑥) 「自動で選ぶ」に戻すとその日の指名が消える',
        !duCleared || duCleared[duToday] === undefined,
        `保存=${JSON.stringify(duCleared)}`,
      )

      // ⑧ 献立を1品足すと「キャンセル」「保存」に変わり、キャンセルで開いたときへ戻る
      await duModal.getByRole('button', { name: ja.mealPlan.emptyAssign }).first().click()
      await duPage.waitForTimeout(400)
      // 同じ画面に「◯◯の写真をカレンダーに出す」ボタンもあるので、レシピの選択はピッカーの中だけを見る
      const duRecipePicker = duPage.locator('[data-testid="recipe-picker"]')
      await duRecipePicker.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await duPage.waitForTimeout(300)
      await duRecipePicker.getByRole('button', { name: /肉じゃが/ }).first().click()
      await duPage.waitForTimeout(700)
      check(
        'MEALPLAN-DU(⑧) 献立を足すと窓の下が「キャンセル」「保存」になる',
        (await duModal.locator('[data-testid="day-modal-cancel"]').count()) === 1 &&
          (await duModal.locator('[data-testid="day-modal-save"]').count()) === 1 &&
          (await duModal.locator('[data-testid="day-modal-close"]').count()) === 0,
      )
      check(
        'MEALPLAN-DU(⑧) 変更がすでに入っていることを窓の中で正直に書く',
        ((await duModal.textContent()) ?? '').includes(ja.mealPlan.monthDayModalDirtyNote),
      )
      const duBeforeCancel = await duPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.filter((e) => e.date === date).length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        duToday,
      )
      check('MEALPLAN-DU(⑧) 前提: 足した献立が1件入っている', duBeforeCancel === 1, `件数=${duBeforeCancel}`)
      duDialog = ''
      await duModal.locator('[data-testid="day-modal-cancel"]').click()
      await duPage.waitForTimeout(900)
      check(
        'MEALPLAN-DU(⑧・規約F) キャンセルの確認文が「取り消すもの」と「戻るもの」を両方件数つきで書く',
        duDialog.includes('取り消すもの: 追加した1品') &&
          duDialog.includes('戻るもの: この画面を開いたときの献立0品') &&
          duDialog.includes('作った記録と写真、他の日の献立は変わりません'),
        `確認文=${duDialog}`,
      )
      const duAfterCancel = await duPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.filter((e) => e.date === date).length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        duToday,
      )
      check('MEALPLAN-DU(⑧) キャンセルで足した献立が消え、開いたときの0件へ戻る', duAfterCancel === 0)
      check('MEALPLAN-DU(⑧) キャンセルで日の窓が閉じる', !(await duModal.isVisible()))
      check(
        'MEALPLAN-DU(⑧) 作った記録は消えない(取り消しの対象外)',
        (await duCell(duToday).locator('img').count()) === 1,
      )
    } finally {
      await duBrowser.close()
    }
  }

  // --- MEALPLAN-A1B2: マイ献立テンプレート(A-1)＋曜日固定の定番(B-2)。2026-07-29 便CB-2・docs/59。
  // 表示中の週(月曜に副菜1品・金曜に肉じゃが)を「表示している週をテンプレートとして保存」→ 月タブで翌月を開き
  //  ・入れる曜日を「金」だけに絞って流し込む＝毎週金曜に同じ献立が入る(B-2)
  //  ・すでに献立が入っている金曜は上書きされず残る(非破壊)
  //  ・確認文が規約F(何品が入るか＋何が消えないか)を満たしている
  // をIndexedDBの実データで確認する。月タブはPro機能のためIndexedDB直書きで解錠する ---
  currentCheck = 'MEALPLAN-A1B2'
  {
    const tpBrowser = await chromium.launch()
    const tpContext = await tpBrowser.newContext()
    const tpPage = await tpContext.newPage()
    let tpConfirmMsg = ''
    await collectConfirms(tpPage, (text) => {
      tpConfirmMsg = text
    })
    tpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-A1B2] ${text}`)
    })
    tpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-A1B2] ${err.message}`)
    })
    try {
      const tpYmd = (d) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const tpNow = new Date()
      // 表示中の週(週区切り＝月曜始まり)の月曜と金曜
      const tpMonday = new Date(tpNow)
      tpMonday.setDate(tpNow.getDate() + (tpNow.getDay() === 0 ? -6 : 1 - tpNow.getDay()))
      const tpFriday = new Date(tpMonday)
      tpFriday.setDate(tpMonday.getDate() + 4)
      // 翌月(全日が未来日)の金曜すべて
      const tpNextAnchor = new Date(tpNow.getFullYear(), tpNow.getMonth() + 1, 1)
      const tpNextLast = new Date(tpNextAnchor.getFullYear(), tpNextAnchor.getMonth() + 1, 0).getDate()
      const tpNextFridays = []
      for (let day = 1; day <= tpNextLast; day++) {
        const d = new Date(tpNextAnchor.getFullYear(), tpNextAnchor.getMonth(), day)
        if (d.getDay() === 5) tpNextFridays.push(tpYmd(d))
      }

      await tpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(1800) // 初回シード完了待ち
      // Pro解錠(IndexedDB直書き)＋週の献立と「翌月の最初の金曜」の先約を仕込む
      const tpIds = await tpPage.evaluate(
        ([monday, friday, occupied]) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const curry = g.result.find((r) => r.title === '肉じゃが')
                const side = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                if (!curry || !side) {
                  reject(new Error('seed recipes not found'))
                  return
                }
                const wtx = idb.transaction(['mealPlans', 'settings'], 'readwrite')
                const plans = wtx.objectStore('mealPlans')
                plans.add({ date: monday, slot: 'dinner', recipeId: side.id, role: 'main' })
                plans.add({ date: friday, slot: 'dinner', recipeId: curry.id, role: 'main' })
                // 翌月の最初の金曜には先約(別の料理)を入れておく＝上書きされないことの確認用
                plans.add({ date: occupied, slot: 'dinner', recipeId: side.id, role: 'main' })
                const settings = wtx.objectStore('settings')
                const getReq = settings.get(1)
                getReq.onsuccess = () => {
                  const current = getReq.result || { id: 1 }
                  settings.put({
                    ...current,
                    id: 1,
                    proCode: 'UR-E2E-TEST-ONLY',
                    proActivatedAt: Date.now(),
                  })
                }
                wtx.oncomplete = () => resolve({ curryId: curry.id, sideId: side.id })
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        [tpYmd(tpMonday), tpYmd(tpFriday), tpNextFridays[0]],
      )
      await tpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await tpPage.reload({ waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(900)

      // A-1: 週タブで「表示している週をテンプレートとして保存」
      // (2026-08-03 便DJ: 「献立テンプレート」グループは既定で畳まれているので先に開く)
      await tpPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(tpPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await tpPage.waitForTimeout(400)
      await tpPage.getByRole('button', { name: `${ja.mealPlan.weekGroupTemplateTitle}を開く` }).click()
      await tpPage.waitForTimeout(200)
      await tpPage.getByRole('button', { name: ja.mealPlan.templateSave }).click()
      await tpPage.waitForTimeout(300)
      const tpSaveModal = tpPage.getByRole('dialog', { name: ja.mealPlan.templateSave })
      check('MEALPLAN-A1B2(A-1) 保存の窓が開き、名前を付けられる', (await tpSaveModal.count()) === 1)
      await tpSaveModal.getByLabel('テンプレートの名前').fill('定番セット')
      await tpSaveModal.getByRole('button', { name: '保存する' }).click()
      await tpPage.waitForTimeout(600)
      check(
        'MEALPLAN-A1B2(A-1) 保存すると品数つきで結果が出る',
        ((await tpPage.textContent('body')) ?? '').includes('テンプレート「定番セット」を2品で保存しました'),
      )
      const tpSaved = await tpPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealTemplates', 'readonly')
              const g = tx.objectStore('mealTemplates').getAll()
              g.onsuccess = () => resolve(g.result)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-A1B2(A-1) テンプレートは献立とは別の専用テーブルに1件保存される',
        tpSaved.length === 1 && tpSaved[0].name === '定番セット' && tpSaved[0].items.length === 2,
        `saved=${JSON.stringify(tpSaved)}`,
      )
      check(
        'MEALPLAN-A1B2(A-1) 中身は日付ではなく曜日(月=0/金=4)で持つ',
        JSON.stringify(tpSaved[0].items.map((i) => [i.dow, i.slot, i.recipeId])) ===
          JSON.stringify([
            [0, 'dinner', tpIds.sideId],
            [4, 'dinner', tpIds.curryId],
          ]),
        `items=${JSON.stringify(tpSaved[0].items)}`,
      )

      // B-2: 月タブで翌月を開き、「金」だけを選んで入れる
      // (便DE-8で「流し込む」→「内容を入れる」、便DJで「テンプレートを適用」に改名)
      await tpPage.getByRole('button', { name: '月', exact: true }).click()
      await tpPage.waitForTimeout(400)
      await tpPage.getByRole('button', { name: ja.mealPlan.nextMonth }).click()
      await tpPage.waitForTimeout(500)
      /* 2026-08-26 便LH（オーナー原文「献立関連のボタンがバラバラに配置してあるように見えるので、
         １グループにまとめて。折りたたみの見える部分は「献立をまとめて提案」のみ。」）:
         月タブのテンプレートは折りたたみの中へ入った。開いてから押す。
         入る先が名前から読めるように、ボタン名も「テンプレートをこの月に入れる」になった */
      check(
        'MEALPLAN-A1B2(便LH) 畳んでいるあいだ、月の献立の節に出るのは「献立をまとめて提案」だけ',
        (await tpPage.locator('[data-testid="month-fill-run"]').isVisible()) &&
          (await tpPage.locator('[data-testid="month-template-apply"]').count()) === 0,
      )
      await tpPage.locator('[data-testid="month-plan-group-toggle"]').click()
      await tpPage.waitForTimeout(400)
      check(
        'MEALPLAN-A1B2(便LH) 開くと、月のテンプレートのボタンが入る先を名乗って出る',
        (await tpPage.locator('[data-testid="month-template-apply"]').innerText()).includes(
          ja.mealPlan.templateApplyMonth,
        ),
      )
      check(
        'MEALPLAN-A1B2(便LH) テンプレートを作れる場所（「週」の画面）も同じ節に書いてある',
        stripZwspText(await tpPage.textContent('body')).includes(
          stripZwspText(ja.mealPlan.templateMonthNote),
        ),
      )
      await tpPage.locator('[data-testid="month-template-apply"]').click()
      await tpPage.waitForTimeout(400)
      const tpApplyModal = tpPage.getByRole('dialog', { name: ja.mealPlan.templateApply })
      check('MEALPLAN-A1B2(B-2) テンプレートを適用する窓が開く', (await tpApplyModal.count()) === 1)
      check(
        'MEALPLAN-A1B2(B-2) 既定では全曜日が選ばれている(1週間まるごと＝A-1)',
        (await tpApplyModal.locator('button[data-dow][aria-pressed="true"]').count()) === 7,
      )
      // 月・火・水・木・土・日を外して「金」だけにする
      for (const dow of [0, 1, 2, 3, 5, 6]) {
        await tpApplyModal.locator(`button[data-dow="${dow}"]`).click()
      }
      await tpPage.waitForTimeout(200)
      check(
        'MEALPLAN-A1B2(B-2) 曜日を絞れる(金だけを選べる)',
        (await tpApplyModal.locator('button[data-dow][aria-pressed="true"]').count()) === 1,
      )
      await tpApplyModal.getByRole('button', { name: '入れる', exact: true }).click()
      await tpPage.waitForTimeout(900)
      check(
        'MEALPLAN-A1B2(規約F) 確認文が「何品を、どこへ入れるか」を言い切る',
        // 2026-08-25: 「まだ決まっていない◯食分に入れます」を書き写していた（禁じ手②）。
        // 便KTが**枠と品の単位の衝突**を直して「まだ決まっていない食事に入れます」にした。
        // ja.ts の雛形から組み立てる＝文言を直しても数字が変わっても追従する。
        // 2026-08-28 便LV: 本文（旧「すでに入っている献立は消えません。」）は外したので、
        // 見出しだけを見る（外したことそのものは meal-plan.mjs の LV-2 が見張る）
        tpConfirmMsg.includes(
          ja.mealPlan.templateApplyConfirmTitle
            .replace('{name}', '定番セット')
            .replace('{n}', '3'),
        ),
        `confirm=${tpConfirmMsg}`,
      )
      const tpAfter = await tpPage.evaluate(
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
      const tpFridayPlans = tpNextFridays.map((date) =>
        tpAfter.filter((e) => e.date === date).map((e) => e.recipeId),
      )
      check(
        'MEALPLAN-A1B2(B-2) 翌月の毎週金曜に同じ献立(肉じゃが)が入る',
        tpFridayPlans.slice(1).every((ids) => ids.length === 1 && ids[0] === tpIds.curryId),
        `fridays=${JSON.stringify(tpNextFridays)} plans=${JSON.stringify(tpFridayPlans)}`,
      )
      check(
        'MEALPLAN-A1B2(非破壊) すでに献立がある金曜は上書きされず元のまま残る',
        tpFridayPlans[0].length === 1 && tpFridayPlans[0][0] === tpIds.sideId,
        `first=${JSON.stringify(tpFridayPlans[0])}`,
      )
      const tpNextPrefix = `${tpNextAnchor.getFullYear()}-${String(tpNextAnchor.getMonth() + 1).padStart(2, '0')}`
      check(
        'MEALPLAN-A1B2(B-2) 選ばなかった曜日(月)には何も入らない',
        tpAfter.filter((e) => e.date.startsWith(tpNextPrefix) && e.recipeId === tpIds.sideId).length === 1,
        `count=${tpAfter.filter((e) => e.date.startsWith(tpNextPrefix) && e.recipeId === tpIds.sideId).length}`,
      )
      check(
        'MEALPLAN-A1B2 テンプレートから入れた枠は手動配置扱い(auto無し)＝まとめて献立で上書きされない',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）（1件も入らなくなった退行が緑で通る）
        (() => {
          const rows = tpAfter.filter(
            (e) => e.date.startsWith(tpNextPrefix) && e.recipeId === tpIds.curryId,
          )
          return rows.length > 0 && rows.every((e) => !e.auto)
        })(),
      )
      check(
        'MEALPLAN-A1B2 結果は入れた品数つきで伝える',
        ((await tpPage.textContent('body')) ?? '').includes('テンプレート「定番セット」から'),
      )
    } finally {
      await tpBrowser.close()
    }
  }

  // --- MEALPLAN-A4: 献立表の印刷／画像化(2026-07-29 便CB-2・docs/59 A-4)。
  // 献立を1枚に整形し、①ブラウザ印刷(画面のUIは紙に出さず献立表だけを出す)
  // ②画像保存(既存のレシピ画像カードと同じCanvas機構)の両方が動くことを確認する。
  // 日付メモ(A-2)も一緒に載ることも見る。
  // 2026-08-26 便LH: 置き場所は**月タブの1か所だけ**になった（オーナー原文「献立表は、月と週に
  // あるが、片方におきたい（月がいいかも）。月なら期間で絞るがそのまま使える。」）。
  // 載せる中身も「登録した献立」だけ（過ぎた日も同じ食事の行で出す） ---
  currentCheck = 'MEALPLAN-A4'
  {
    const psBrowser = await chromium.launch()
    const psContext = await psBrowser.newContext()
    const psPage = await psContext.newPage()
    psPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-A4] ${text}`)
    })
    psPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-A4] ${err.message}`)
    })
    try {
      const psNow = new Date()
      const psToday = `${psNow.getFullYear()}-${String(psNow.getMonth() + 1).padStart(2, '0')}-${String(psNow.getDate()).padStart(2, '0')}`
      // 曜日の名前は ja.ts から読む（書き写さない・禁じ手②）。ja.mealPlan.dow は月曜始まりなので、
      // JSの getDay()（日曜=0）を月曜始まりへ直してから引く
      const psLabel = `${psNow.getMonth() + 1}/${psNow.getDate()}（${ja.mealPlan.dow[(psNow.getDay() + 6) % 7]}）`
      await psPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await psPage.waitForTimeout(1800) // 初回シード完了待ち
      await psPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const main = g.result.find((r) => r.title === '肉じゃが')
                const side = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                if (!main || !side) {
                  reject(new Error('seed recipes not found'))
                  return
                }
                const wtx = idb.transaction(['mealPlans', 'dayNotes', 'settings'], 'readwrite')
                const plans = wtx.objectStore('mealPlans')
                plans.add({ date, slot: 'dinner', recipeId: main.id, role: 'main' })
                plans.add({ date, slot: 'dinner', recipeId: side.id, role: 'side' })
                wtx.objectStore('dayNotes').put({ date, text: '実家に行く', updatedAt: Date.now() })
                const settings = wtx.objectStore('settings')
                const getReq = settings.get(1)
                getReq.onsuccess = () => {
                  const current = getReq.result || { id: 1 }
                  settings.put({
                    ...current,
                    id: 1,
                    proCode: 'UR-E2E-TEST-ONLY',
                    proActivatedAt: Date.now(),
                  })
                }
                wtx.oncomplete = () => resolve(undefined)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        psToday,
      )
      await psPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await psPage.reload({ waitUntil: 'networkidle' })
      await psPage.waitForTimeout(900)

      // 月タブ: 献立表を開く（既定は閉じている＝画面を占領しない）
      await psPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await psPage.waitForTimeout(600)
      check(
        'MEALPLAN-A4 献立表は既定で畳まれている(画面を占領しない)',
        (await psPage.locator('.plan-sheet-preview').count()) === 0,
      )
      check(
        'MEALPLAN-A4(便LH) 週タブには献立表を置かない(片方だけにする)',
        await (async () => {
          await psPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await psPage.waitForTimeout(600)
          const gone =
            (await psPage.getByRole('button', { name: ja.mealPlan.planSheetTitle, exact: true }).count()) === 0
          await psPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
          await psPage.waitForTimeout(600)
          return gone
        })(),
      )
      await psPage.getByRole('button', { name: ja.mealPlan.planSheetTitle, exact: true }).click()
      await psPage.waitForTimeout(400)
      check(
        'MEALPLAN-A4 開くと献立表1枚がプレビューされる',
        (await psPage.locator('.plan-sheet-preview').count()) === 1,
      )
      const psSheetText = (await psPage.locator('.plan-sheet-preview').textContent()) ?? ''
      check(
        'MEALPLAN-A4 献立表に日付・主菜・副菜が1枚に整形されて載る',
        psSheetText.includes(psLabel) &&
          psSheetText.includes('肉じゃが') &&
          psSheetText.includes('ほうれん草のおひたし'),
        `sheet=${psSheetText.slice(0, 200)}`,
      )
      check(
        'MEALPLAN-A4 日付メモ(A-2)も一緒に載る(冷蔵庫に貼る用途)',
        psSheetText.includes('実家に行く'),
      )
      check(
        // 2026-08-26 便LH: 載せるのは登録した献立だけになったので、紙の上の名乗りも変わった。
        // 文言は ja.ts から読む（書き写さない・禁じ手②）
        'MEALPLAN-A4(便LH) 何を載せた表なのかを紙の上でも明記する',
        stripZwspText(psSheetText).includes(stripZwspText(ja.mealPlan.planSheetBasisNote)),
        `note=${ja.mealPlan.planSheetBasisNote}`,
      )
      check(
        'MEALPLAN-A4(便LH) 食事のラベル(朝食・昼食・夕食)は太字にする',
        await psPage.evaluate(() => {
          const el = document.querySelector('.plan-sheet-preview .sheet-slot-label')
          return el ? Number(getComputedStyle(el).fontWeight) >= 700 : false
        }),
      )
      check(
        'MEALPLAN-A4 出どころが分かるようアプリ名とURLを入れる',
        psSheetText.includes('うちレシピ') && psSheetText.includes('uchirecipe.com'),
      )

      // 2026-08-02 オーナー指示(a): 登録のない日は既定で載せない。
      // この週で中身があるのは今日だけなので、既定では1日ぶんしか出ない
      const psDayCount = () => psPage.locator('.plan-sheet-preview li').count()
      check(
        'MEALPLAN-A4(2026-08-02) 既定では登録のない日を省く(中身のある日だけ載る)',
        (await psDayCount()) === 1,
        `days=${await psDayCount()}`,
      )
      await psPage.locator('[data-testid="plan-sheet-include-empty"]').check()
      await psPage.waitForTimeout(300)
      // 月の日数は月ごとに違うので数を決め打ちしない（禁じ手③）
      const psMonthDays = new Date(psNow.getFullYear(), psNow.getMonth() + 1, 0).getDate()
      check(
        'MEALPLAN-A4(2026-08-02) 「登録のない日も載せる」でその月の全日が戻る(可逆)',
        (await psDayCount()) === psMonthDays,
        `days=${await psDayCount()} 期待=${psMonthDays}`,
      )
      await psPage.locator('[data-testid="plan-sheet-include-empty"]').uncheck()
      await psPage.waitForTimeout(300)
      check(
        'MEALPLAN-A4(2026-08-02) チェックを外すと省いた表に戻る',
        (await psDayCount()) === 1,
      )

      // 2026-08-02 オーナー指示(b): 「夕食」「主菜」のラベルは料理名と同じ大きさで横並びだった。
      // 小さく・薄く・行頭の別の列に分ける
      const psLabelStyle = await psPage.evaluate(() => {
        const root = document.querySelector('.plan-sheet-preview')
        const row = root?.querySelector('.sheet-row')
        const label = root?.querySelector('.sheet-row-label')
        const role = root?.querySelector('.sheet-role')
        if (!row || !label || !role) return null
        const px = (el) => parseFloat(getComputedStyle(el).fontSize)
        return {
          row: px(row),
          label: px(label),
          role: px(role),
          labelLeft: Math.round(label.getBoundingClientRect().left),
          roleLeft: Math.round(role.getBoundingClientRect().left),
          bodyLeft: Math.round(row.lastElementChild.getBoundingClientRect().left),
        }
      })
      check(
        'MEALPLAN-A4(2026-08-02) 食事・役割のラベルは料理名より小さい',
        psLabelStyle !== null &&
          psLabelStyle.label < psLabelStyle.row &&
          psLabelStyle.role < psLabelStyle.row,
        JSON.stringify(psLabelStyle),
      )
      check(
        'MEALPLAN-A4(2026-08-02) 食事・役割のラベルは料理名と別の列(左)に分かれている',
        psLabelStyle !== null &&
          psLabelStyle.roleLeft > psLabelStyle.labelLeft + 20 &&
          psLabelStyle.bodyLeft > psLabelStyle.roleLeft + 20,
        JSON.stringify(psLabelStyle),
      )
      // 料理は1品につき1行(以前は「主菜 肉じゃが　副菜 …」と1行に詰めていた)
      check(
        'MEALPLAN-A4(2026-08-02) 料理は1品につき1行に分かれる',
        (await psPage.locator('.plan-sheet-preview .sheet-row').count()) === 3,
        `rows=${await psPage.locator('.plan-sheet-preview .sheet-row').count()}`,
      )

      // 印刷: 画面のUIは紙に出さず、献立表だけを出す(index.cssの@media print)
      await psPage.emulateMedia({ media: 'print' })
      await psPage.waitForTimeout(200)
      check(
        'MEALPLAN-A4(印刷) 印刷時は献立表だけが見え、画面のUI(タブ等)は紙に出ない',
        (await psPage.locator('.plan-sheet-print').isVisible()) === true &&
          (await psPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).isVisible()) === false,
      )
      check(
        'MEALPLAN-A4(印刷) 印刷用の1枚はアプリ本体の外(body直下)に置き、白紙ページが続かないようにする',
        (await psPage.evaluate(
          () => document.querySelector('.plan-sheet-print')?.parentElement === document.body,
        )) === true,
      )
      check(
        'MEALPLAN-A4(印刷) 印刷用の1枚にも同じ内容(日付・料理・メモ)が入る',
        ((await psPage.locator('.plan-sheet-print').textContent()) ?? '').includes('実家に行く'),
      )
      // 2026-08-02 オーナー指示(c): モノクロ印刷対応。紙では文字が全部黒一色になるので、
      // 色ではなく「日付の上の罫線」「文字の太さ・大きさ」「ラベル列の灰色の階調」で区別する
      const psPrintStyle = await psPage.evaluate(() => {
        const root = document.querySelector('.plan-sheet-print')
        const day = root?.querySelector('.sheet-day')
        const dayLabel = root?.querySelector('.sheet-day-label')
        const row = root?.querySelector('.sheet-row')
        const label = root?.querySelector('.sheet-row-label')
        if (!day || !dayLabel || !row || !label) return null
        const cs = (el) => getComputedStyle(el)
        return {
          dayBorderWidth: parseFloat(cs(day).borderTopWidth),
          dayBorderStyle: cs(day).borderTopStyle,
          dayLabelSize: parseFloat(cs(dayLabel).fontSize),
          dayLabelWeight: cs(dayLabel).fontWeight,
          dayLabelColor: cs(dayLabel).color,
          rowSize: parseFloat(cs(row).fontSize),
          labelSize: parseFloat(cs(label).fontSize),
          labelColor: cs(label).color,
          breakInside: cs(day).breakInside,
        }
      })
      check(
        'MEALPLAN-A4(印刷・モノクロ) 日付の区切りが罫線で引かれる(色に頼らない)',
        psPrintStyle !== null &&
          psPrintStyle.dayBorderWidth > 0 &&
          psPrintStyle.dayBorderStyle === 'solid',
        JSON.stringify(psPrintStyle),
      )
      check(
        'MEALPLAN-A4(印刷・モノクロ) 日付は本文より大きく太い(アクセント色が黒になっても区別できる)',
        psPrintStyle !== null &&
          psPrintStyle.dayLabelSize > psPrintStyle.rowSize &&
          Number(psPrintStyle.dayLabelWeight) >= 700 &&
          psPrintStyle.dayLabelColor === 'rgb(0, 0, 0)',
        JSON.stringify(psPrintStyle),
      )
      check(
        'MEALPLAN-A4(印刷・モノクロ) 行頭ラベルは本文より小さく、灰色の階調で分ける',
        psPrintStyle !== null &&
          psPrintStyle.labelSize < psPrintStyle.rowSize &&
          psPrintStyle.labelColor !== 'rgb(0, 0, 0)',
        JSON.stringify(psPrintStyle),
      )
      check(
        'MEALPLAN-A4(印刷) 1日分が2ページに割れない',
        psPrintStyle !== null && psPrintStyle.breakInside === 'avoid',
        JSON.stringify(psPrintStyle),
      )
      await psPage.emulateMedia({ media: 'screen' })
      await psPage.waitForTimeout(200)
      await psPage.evaluate(() => {
        window.__e2ePrintCount = 0
        window.print = () => {
          window.__e2ePrintCount += 1
        }
      })
      await psPage.getByRole('button', { name: ja.mealPlan.planSheetPrint, exact: true }).click()
      await psPage.waitForTimeout(300)
      check(
        'MEALPLAN-A4(印刷) 「印刷する」でブラウザの印刷が呼ばれる',
        (await psPage.evaluate(() => window.__e2ePrintCount)) === 1,
      )

      // 画像保存: 非対応環境ではPNGダウンロードに切り替わる(=生成成功の確認)
      const [psDownload] = await Promise.all([
        psPage.waitForEvent('download', { timeout: 15000 }),
        psPage.getByRole('button', { name: ja.mealPlan.planSheetImage, exact: true }).click(),
      ])
      check(
        'MEALPLAN-A4(画像) 献立表の画像が生成されPNGダウンロードに切り替わる',
        psDownload.suggestedFilename().endsWith('.png'),
        psDownload.suggestedFilename(),
      )
      check(
        'MEALPLAN-A4(画像) 保存したことを結果メッセージで伝える',
        stripZwspText(await psPage.textContent('body')).includes(ja.mealPlan.planSheetImageDone),
      )

      // 見出しはその月（期間で絞っているときは期間の見出しに変わる＝下の LHSHEET-01 で見る）
      const psMonthHeading = `${psNow.getFullYear()}年${psNow.getMonth() + 1}月の献立`
      const psMonthSheet = (await psPage.locator('.plan-sheet-preview').textContent()) ?? ''
      check(
        'MEALPLAN-A4 月タブの献立表の見出しはその月',
        psMonthSheet.includes(psMonthHeading) && psMonthSheet.includes('肉じゃが'),
        `heading=${psMonthHeading} sheet=${psMonthSheet.slice(0, 120)}`,
      )
    } finally {
      await psBrowser.close()
    }
  }

  // --- MEALPLAN-A5: 月の空日を一括提案(2026-07-29 便CB-2・docs/59 A-5)。
  // 翌月(全日が未来日)を開いて「献立をまとめて提案」を押し、
  //  ・一括なので実行前に規約Fの確認文が出る(何日分・何食分を埋めるか＋何が消えないか)
  //  ・すでに決まっている日は上書きされない(手動配置の保護は週の「まとめて献立」と同じ)
  //  ・結果は実際に入れた品数で報告する(便CD/MP-06の正直な完了報告と同じ作法)
  //  ・BH-2の回帰(同じ食事の主菜と副菜のジャンルが揃う)を月の一括提案でも壊していない
  // をIndexedDBの実データで確認する ---
  currentCheck = 'MEALPLAN-A5'
  {
    const fmBrowser = await chromium.launch()
    const fmContext = await fmBrowser.newContext()
    const fmPage = await fmContext.newPage()
    let fmConfirmMsg = ''
    await collectConfirms(fmPage, (text) => {
      fmConfirmMsg = text
    })
    fmPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-A5] ${text}`)
    })
    fmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-A5] ${err.message}`)
    })
    try {
      const fmNow = new Date()
      const fmNextAnchor = new Date(fmNow.getFullYear(), fmNow.getMonth() + 1, 1)
      const fmPrefix = `${fmNextAnchor.getFullYear()}-${String(fmNextAnchor.getMonth() + 1).padStart(2, '0')}`
      const fmLastDay = new Date(fmNextAnchor.getFullYear(), fmNextAnchor.getMonth() + 1, 0).getDate()
      const fmManualDate = `${fmPrefix}-10`
      // 2026-07-30 便CH/C10: 「外食」とメモを書いた日は一括提案で埋めない
      const fmNoteDate = `${fmPrefix}-15`

      await fmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fmPage.waitForTimeout(1800) // 初回シード完了待ち
      const fmManualId = await fmPage.evaluate(
        ([manualDate, noteDate]) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const manual = g.result.find((r) => r.title === '肉じゃが')
                if (!manual) {
                  reject(new Error('seed recipe not found'))
                  return
                }
                const wtx = idb.transaction(['mealPlans', 'settings', 'dayNotes'], 'readwrite')
                // 手動で入れた1枠(上書きされないことの確認用)
                wtx
                  .objectStore('mealPlans')
                  .add({ date: manualDate, slot: 'dinner', recipeId: manual.id, role: 'main' })
                // その日のメモがある日(便CH/C10: 一括提案の対象外になることの確認用)
                wtx
                  .objectStore('dayNotes')
                  .put({ date: noteDate, text: '外食', updatedAt: Date.now() })
                const settings = wtx.objectStore('settings')
                const getReq = settings.get(1)
                getReq.onsuccess = () => {
                  const current = getReq.result || { id: 1 }
                  settings.put({
                    ...current,
                    id: 1,
                    proCode: 'UR-E2E-TEST-ONLY',
                    proActivatedAt: Date.now(),
                  })
                }
                wtx.oncomplete = () => resolve(manual.id)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        [fmManualDate, fmNoteDate],
      )
      await fmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await fmPage.reload({ waitUntil: 'networkidle' })
      await fmPage.waitForTimeout(900)
      await fmPage.getByRole('button', { name: '月', exact: true }).click()
      await fmPage.waitForTimeout(400)
      await fmPage.getByRole('button', { name: ja.mealPlan.nextMonth }).click()
      await fmPage.waitForTimeout(600)
      await fmPage.getByRole('button', { name: ja.mealPlan.fillMonth }).click()
      /*
       * 月まるごとの提案は枠数が多いので、**結果の知らせが出るまで**待つ
       *（出た時点で書き込みは終わっている）。決め打ちの秒数で待つと、トーストは6秒で
       * 自動的に消える（components/Toast.tsx）ので、待ち終わったころには読めなくなっていた
       *（2026-08-25 便KT で気づいた。以前はここを「本文に無い＝赤」ではなく素通りしていた）。
       * 掴む文字は ja.ts から作る＝画面の日本語を書き写さない。evaluate の中に ja は無いので
       * 引数で渡す（CLAUDE.md の JM-4）
       */
      // 差し込み口より後ろの、必ずそのまま出る部分だけを掴む（数字を挟むので前半は使えない）
      const fmTail = (text) => text.slice(text.lastIndexOf('}') + 1)
      const fmToastNeedles = [
        fmTail(ja.mealPlan.fillMonthDone),
        fmTail(ja.mealPlan.fillMonthKeptManual),
      ]
      let fmResultBody = ''
      const fmReadBody = () =>
        fmPage.evaluate(() => (document.body.innerText ?? '').replaceAll('\u200b', ''))
      try {
        await fmPage.waitForFunction(
          (needles) =>
            needles.some((n) => (document.body.innerText ?? '').replaceAll('\u200b', '').includes(n)),
          fmToastNeedles,
          { timeout: 25000 },
        )
        fmResultBody = await fmReadBody()
      } catch {
        fmResultBody = await fmReadBody()
      }
      await fmPage.waitForTimeout(1200)
      // 文言は書き写さず ja.ts から組み立てる（2026-08-25 便KT で「◯日分（◯食分）」から
      // 「◯食分」を落とし、残る側の数え方を「◯品」にそろえた。書き写した側だけが取り残される
      // のを防ぐ）。{d}{k} には数字が入る
      const fmJaRe = (text) =>
        new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[a-z]\\\}/g, '\\d+'))
      check(
        'MEALPLAN-A5(規約F) 実行前に「何日分を埋めるか」と「何が消えないか」を確認する',
        fmJaRe(ja.mealPlan.fillMonthConfirmTitle).test(fmConfirmMsg) &&
          fmJaRe(ja.mealPlan.fillMonthConfirm).test(fmConfirmMsg),
        `confirm=${fmConfirmMsg}`,
      )
      const fmData = await fmPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
              const plans = tx.objectStore('mealPlans').getAll()
              const recipes = tx.objectStore('recipes').getAll()
              tx.oncomplete = () =>
                resolve({
                  plans: plans.result,
                  recipes: recipes.result.map((r) => ({ id: r.id, title: r.title, tags: r.tags })),
                })
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const fmMonthPlans = fmData.plans.filter((e) => e.date.startsWith(fmPrefix))
      const fmFilledDays = new Set(fmMonthPlans.map((e) => e.date))
      check(
        'MEALPLAN-A5 翌月のほぼ全日に献立が入る(週の7日ではなく月レンジで動く)',
        // 2026-07-30 便CH/C10: メモを書いた1日は対象外なので、埋まるのは最大でも「月の日数-1」
        fmFilledDays.size >= fmLastDay - 2,
        `days=${fmFilledDays.size}/${fmLastDay}`,
      )
      // 2026-07-30 便CH/C10: 「外食」とメモを書いた日は埋めない。しかも黙って飛ばさず
      // 確認文にも「メモを書いた◯日には入れません」と書く
      check(
        'MEALPLAN-A5(便CH/C10) メモを書いた日には献立を入れない(外食の日を勝手に埋めない)',
        !fmFilledDays.has(fmNoteDate),
        `noteDate=${fmNoteDate} filled=${fmFilledDays.has(fmNoteDate)}`,
      )
      check(
        'MEALPLAN-A5(便CH/C10) メモの日を外したことを確認文に書く',
        fmConfirmMsg.includes('メモを書いた1日には入れません'),
        `confirm=${fmConfirmMsg}`,
      )
      const fmManualSlot = fmMonthPlans.filter(
        (e) => e.date === fmManualDate && (e.role ?? 'main') === 'main',
      )
      check(
        'MEALPLAN-A5 手動で入れた主菜は上書きされずそのまま残る(非破壊)',
        fmManualSlot.length === 1 &&
          fmManualSlot[0].recipeId === fmManualId &&
          !fmManualSlot[0].auto,
        `manual=${JSON.stringify(fmManualSlot)}`,
      )
      check(
        'MEALPLAN-A5 自動で入れた枠にはautoが付く(次の提案で再抽選できる)',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        (() => {
          const rows = fmMonthPlans.filter((e) => e.date !== fmManualDate)
          return rows.length > 0 && rows.every((e) => e.auto === true)
        })(),
      )
      // 結果のトーストも ja.ts から組み立てて拾う（2026-08-25 便KT で「◯食分はそのままにして」
      // →「◯品はそのままにして」に変わった）。上で**出るまで待って**控えた本文を見る
      check(
        'MEALPLAN-A5 結果は実際に入れた品数で伝える(正直な完了報告)',
        fmJaRe(ja.mealPlan.fillMonthDone).test(fmResultBody) ||
          fmJaRe(ja.mealPlan.fillMonthKeptManual).test(fmResultBody),
        `body=${fmResultBody.slice(0, 200)}`,
      )
      // 2026-07-30 便CH/C1: 2回目に押しても、自動で入れた献立を総入れ替えしない(非破壊)。
      // 従来は確認文が「今ある献立と作った記録は消えません」と言いながら自動分を全部消して
      // 振り直していた(規約F違反・買い物を済ませた後だと取り消せない)
      fmConfirmMsg = ''
      const fmBefore = fmMonthPlans
        .map((e) => `${e.date}|${e.slot}|${e.role ?? 'main'}|${e.recipeId}`)
        .sort()
      await fmPage.getByRole('button', { name: ja.mealPlan.fillMonth }).click()
      await fmPage.waitForTimeout(2500)
      const fmAfterSecond = await fmPage.evaluate(
        (prefix) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () =>
                resolve(
                  g.result
                    .filter((e) => e.date.startsWith(prefix))
                    .map((e) => `${e.date}|${e.slot}|${e.role ?? 'main'}|${e.recipeId}`)
                    .sort(),
                )
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        fmPrefix,
      )
      check(
        'MEALPLAN-A5(便CH/C1) 2回目を押しても1品も消えない・入れ替わらない(総入れ替えしない)',
        fmBefore.every((row) => fmAfterSecond.includes(row)),
        `before=${fmBefore.length}品 after=${fmAfterSecond.length}品 消えた=${
          fmBefore.filter((row) => !fmAfterSecond.includes(row)).length
        }品`,
      )
      check(
        'MEALPLAN-A5(便CH/C10) 2回目でもメモを書いた日は空のまま',
        !fmAfterSecond.some((row) => row.startsWith(`${fmNoteDate}|`)),
      )

      // BH-2の回帰: 同じ食事に入った主菜と副菜のジャンル(和食/洋食/中華)が食い違わない
      const fmGenres = ['和食', '洋食', '中華']
      const fmTagsById = new Map(fmData.recipes.map((r) => [r.id, r.tags ?? []]))
      const fmGenreOf = (id) => fmGenres.find((g) => (fmTagsById.get(id) ?? []).includes(g))
      const fmBySlot = new Map()
      for (const e of fmMonthPlans) {
        const key = `${e.date}|${e.slot}`
        const list = fmBySlot.get(key) ?? []
        list.push(e)
        fmBySlot.set(key, list)
      }
      let fmPairs = 0
      let fmMixed = 0
      for (const list of fmBySlot.values()) {
        const main = list.find((e) => (e.role ?? 'main') === 'main')
        const sides = list.filter((e) => (e.role ?? 'main') === 'side')
        if (!main || sides.length === 0) continue
        const mainGenre = fmGenreOf(main.recipeId)
        if (!mainGenre) continue
        fmPairs++
        if (sides.some((s) => fmGenreOf(s.recipeId) && fmGenreOf(s.recipeId) !== mainGenre)) fmMixed++
      }
      check(
        'MEALPLAN-A5(BH-2回帰) 月の一括提案でも、同じ食事の主菜と副菜のジャンルが揃う(混在0)',
        fmPairs > 0 && fmMixed === 0,
        `pairs=${fmPairs} mixed=${fmMixed}`,
      )
    } finally {
      await fmBrowser.close()
    }
  }

  // --- MEALPLAN-ROLE: 日タブの「レシピ一覧から選択中」と「今週の献立の予定」の並列表示
  // (2026-08-02 便DE-2で警告＋長い説明文から置き換え)の食事ボタンが、役割(主菜/副菜)の粒度を
  // 守ること(2026-07-29 便CB-1・便CD報告の不具合の再発防止)。
  // 以前は料理の種類を見ずに必ず「その枠の主菜」を置き換えていたため、副菜(ほうれん草のおひたし)を
  // 押すと夕食の主菜(肉じゃが)が消えていた。副菜は副菜として足され、主菜が残ることを実データで確認する ---
  currentCheck = 'MEALPLAN-ROLE'
  {
    const roBrowser = await chromium.launch()
    const roContext = await roBrowser.newContext()
    const roPage = await roContext.newPage()
    roPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-ROLE] ${text}`)
    })
    roPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-ROLE] ${err.message}`)
    })
    try {
      await roPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await roPage.waitForTimeout(1800) // 初回シード完了待ち
      // 今日の夕食の主菜に肉じゃが / 「今日の献立」に副菜(ほうれん草のおひたし)だけを入れる
      const roSeed = await roPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const main = g.result.find((r) => r.title === '肉じゃが')
                const side = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                if (!main || !side) {
                  reject(new Error('seed recipes not found'))
                  return
                }
                const wtx = idb.transaction(['mealPlans', 'todayList'], 'readwrite')
                wtx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId: main.id, role: 'main' })
                wtx.objectStore('todayList').add({ recipeId: side.id, addedAt: Date.now() })
                wtx.oncomplete = () =>
                  resolve({ date, mainId: main.id, sideId: side.id, sideDishType: side.dishType })
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'MEALPLAN-ROLE 前提: 副菜のレシピ(ほうれん草のおひたし)はdishType=sideで同梱されている',
        roSeed.sideDishType === 'side',
        `dishType=${roSeed.sideDishType}`,
      )
      await roPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await roPage.reload({ waitUntil: 'networkidle' })
      await roPage.waitForTimeout(1200)
      const roBody = (await roPage.textContent('body')) ?? ''
      check(
        'MEALPLAN-ROLE(便DH) 前提: 2つの見出しが縦一列で出る',
        roBody.includes(ja.mealPlan.todayPickedLabel) && roBody.includes('今週の献立の予定'),
      )
      check(
        'MEALPLAN-ROLE(便DE-2) 長い説明文と「食い違っています」の警告は出さない',
        !roBody.includes('今日の献立と今週の予定が食い違っています') &&
          !roBody.includes('主菜になる料理は主菜、副菜になる料理は副菜として入り'),
      )
      // 2026-08-03 便DH: 「レシピ一覧から選択中」＝週の予定に無い品 /
      // 「今週の献立の予定」＝今日の週プラン。中身がそれぞれの側に入っていること
      check(
        'MEALPLAN-ROLE(便DH) 「レシピ一覧から選択中」に副菜(ほうれん草のおひたし)が並ぶ',
        (await roPage.locator('[data-testid="day-picked"]').textContent())?.includes(
          'ほうれん草のおひたし',
        ),
      )
      check(
        'MEALPLAN-ROLE(便DH) 「今週の献立の予定」の夕食に肉じゃがが並ぶ',
        (await roPage.locator('[data-testid="day-planned"]').textContent())?.includes('肉じゃが'),
      )
      // 2026-08-20 便IG・①: ×は「整理」モードの中にしか出ないので、先に整理へ入ってから数える
      await openDayOrganize(roPage)
      check(
        'MEALPLAN-ROLE(便DH) ×(この献立から外す)が押せるのは「レシピ一覧から選択中」だけ',
        (await roPage
          .locator('[data-testid="day-picked"] button[aria-label="この献立から外す"]')
          .count()) === 1 &&
          (await roPage
            .locator('[data-testid="day-planned"] button[aria-label="この献立から外す"]')
            .count()) === 0,
      )
      check(
        'MEALPLAN-ROLE(便DH) 日タブから「表示する食事」は消えている',
        !roBody.includes('表示する食事（朝食・昼食・夕食）'),
      )
      await roPage.getByRole('button', { name: '夕食に入れる' }).first().click()
      await roPage.waitForTimeout(700)
      check(
        'MEALPLAN-ROLE どの食事のどの役割に入れたかをトーストで伝える',
        ((await roPage.textContent('body')) ?? '').includes(
          '夕食の副菜に「ほうれん草のおひたし」を登録しました',
        ),
      )
      const roResult = await roPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readonly')
              const g = tx.objectStore('mealPlans').getAll()
              g.onsuccess = () =>
                resolve(g.result.filter((e) => e.date === date && e.slot === 'dinner'))
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        roSeed.date,
      )
      check(
        '再発防止(便CD) 副菜を押しても夕食の主菜(肉じゃが)は消えない',
        roResult.some((e) => e.recipeId === roSeed.mainId && (e.role ?? 'main') === 'main'),
        `rows=${JSON.stringify(roResult)}`,
      )
      check(
        '再発防止(便CD) 副菜のレシピはrole=sideで追加される(主菜の置き換えではない)',
        roResult.some((e) => e.recipeId === roSeed.sideId && e.role === 'side'),
        `rows=${JSON.stringify(roResult)}`,
      )
      check(
        '再発防止(便CD) 夕食の行はちょうど2件(主菜+副菜)になる',
        roResult.length === 2,
        `rows=${JSON.stringify(roResult)}`,
      )
    } finally {
      await roBrowser.close()
    }
  }

  // --- DAYSUGGEST-01(旧HOME-DH-01): 献立の「日」の「今日なに作る？」。
  // 中身(「条件をしぼる」の折りたたみ・料理の種別4区分・候補数・「おまかせで1品出す」)と、
  // 出す/出さないの条件を確認する。2026-08-03 便DHでホームに作ったものを、
  // 2026-08-17 便HG(オーナー決定「先にホーム画面なくします」)で献立の「日」へ移した。
  // 測っている中身は移設前と同じで、見る画面と出す条件だけが変わっている:
  //   旧… 今週の献立に今日の予定があるときだけ出さない(設定「常に表示」で上書きできた)
  //   新… その日の献立が1品でも決まっていたら出さない(オーナー指示。設定は廃止)
  // ホームの2群の折りたたみ・設定「ホーム画面のカスタマイズ」の検査は、
  // どちらも画面ごと無くなったので落とした(日の2群そのものは MEALPLAN-ROLE が見ている。
  // 設定からカスタマイズが消えたことは NOHOME-01 が見ている)。
  // まっさらプロファイルで通しで確認する ---
  currentCheck = 'DAYSUGGEST-01'
  {
    const dhBrowser = await chromium.launch()
    const dhContext = await dhBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const dhPage = await dhContext.newPage()
    dhPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYSUGGEST-01] ${text}`)
    })
    dhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DAYSUGGEST-01] ${err.message}`)
    })
    try {
      await dhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dhPage.waitForTimeout(1800) // 初回シード完了待ち

      // (1) その日の献立がまだ空の状態＝「今日なに作る？」が出る
      await dhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dhPage.reload({ waitUntil: 'networkidle' })
      await dhPage.waitForTimeout(1500)
      // 2026-08-19 便HT: はじめて開いた人は「献立」から始まるようになった（オーナー指示）。
      // この節が見たいのは**1品側の中身**なので、明示的に「1品」へ寄せてから測る
      // （はじめに何が出るかは DAYDEFAULT-01 が受け持つ）
      {
        const dhOne = dhPage.locator('[data-testid="day-mode-one"]')
        check('DAYSUGGEST-01 前提: 「1品」への切り替えが1つある', (await dhOne.count()) === 1)
        if ((await dhOne.count()) === 1) {
          await dhOne.click()
          await dhPage.waitForTimeout(800)
        }
      }
      {
        const body = ((await dhPage.textContent('body')) ?? '').replaceAll('​', '')
        check(
          'DAYSUGGEST-01 その日の献立が決まっていなければ「今日なに作る？」が出る',
          body.includes('今日なに作る？'),
        )
        // 2026-08-17 便HH: 名前は「ランダムで選ぶ」→「ランダムで1品出す」
        // (規約H。隣に並んだ「おまかせで献立を組む」との違いを名前で言う)
        // 2026-08-19 便HY(オーナー指示): 「ランダムで1品出す」→「おまかせで1品出す」。
        // 同じ1つのボタンが切り替えで入れ替わるので、頭の言葉を「おまかせ」でそろえた
        check(
          'DAYSUGGEST-01 振り直しは「おまかせで1品出す」(旧「ほかの候補を見る」「ランダムで選ぶ」「ランダムで1品出す」は残っていない)',
          body.includes('おまかせで1品出す') &&
            !body.includes('ほかの候補を見る') &&
            !body.includes('ランダムで選ぶ') &&
            !body.includes('ランダムで1品出す'),
        )
        // オレンジ地・白字(既存CTAと同じトークン)。直接色指定ではなくクラスで確認する
        const shuffleClass =
          (await dhPage.getByRole('button', { name: ja.dayStart.shuffle }).getAttribute('class')) ??
          ''
        check(
          'DAYSUGGEST-01 「おまかせで1品出す」はオレンジ地・白字(bg-accent/text-on-accent)',
          shuffleClass.includes('bg-accent') && shuffleClass.includes('text-on-accent'),
        )
        // 種別4区分は「条件をしぼる」の中。畳んでいる間は出ない
        check(
          'DAYSUGGEST-01 種別チップは「条件をしぼる」を開くまで出ない',
          (await dhPage.getByRole('button', { name: '主菜', exact: true }).count()) === 0,
        )
        await dhPage.getByRole('button', { name: /条件をしぼる/ }).click()
        await dhPage.waitForTimeout(400)
        check(
          'DAYSUGGEST-01 「条件をしぼる」の中にレシピと同じ4区分(主菜・副菜・汁物・その他)が並ぶ',
          (await dhPage.getByRole('button', { name: '主菜', exact: true }).count()) === 1 &&
            (await dhPage.getByRole('button', { name: '副菜', exact: true }).count()) === 1 &&
            (await dhPage.getByRole('button', { name: '汁物', exact: true }).count()) === 1 &&
            (await dhPage.getByRole('button', { name: 'その他', exact: true }).count()) === 1,
        )
        check(
          'DAYSUGGEST-01 既定は主菜だけON',
          (await dhPage
            .getByRole('button', { name: '主菜', exact: true })
            .getAttribute('aria-pressed')) === 'true' &&
            (await dhPage
              .getByRole('button', { name: '副菜', exact: true })
              .getAttribute('aria-pressed')) === 'false',
        )

        // 2026-08-04 便DV-1 再発防止(オーナー実機報告「全ボタンを選択すると候補が減る」)。
        // 種別を足すたびに「候補◯品」が増える(減らない)・全選択と未選択が同じ品数になること
        const candidateCount = async () => {
          const text = ((await dhPage.textContent('body')) ?? '').replaceAll('​', '')
          const m = text.match(/候補(\d+)品/)
          return m ? Number(m[1]) : -1
        }
        const tapType = async (name) => {
          await dhPage.getByRole('button', { name, exact: true }).click()
          await dhPage.waitForTimeout(350)
        }
        const cMainOnly = await candidateCount()
        await tapType('副菜')
        const cMainSide = await candidateCount()
        await tapType('汁物')
        await tapType('その他')
        const cAll = await candidateCount()
        check(
          'DAYSUGGEST-01(便DV) 種別を足すと候補は減らない(主菜のみ→+副菜→全選択)',
          cMainOnly > 0 && cMainSide >= cMainOnly && cAll >= cMainSide,
          `主菜のみ=${cMainOnly} +副菜=${cMainSide} 全選択=${cAll}`,
        )
        // 全部OFF(=種別で絞らない)にすると、全選択とまったく同じ品数になる
        for (const name of ['主菜', '副菜', '汁物', 'その他']) await tapType(name)
        const cNone = await candidateCount()
        check(
          'DAYSUGGEST-01(便DV) 未選択(絞らない)と全選択の候補数が一致する',
          cNone === cAll,
          `未選択=${cNone} 全選択=${cAll}`,
        )
      }

      // (2) 今日の献立に1品でも入ると、開いたままにはしない(2026-08-17 便HG・オーナー指示)。
      // 週の予定ではなく「レシピ一覧から選択中」の1品でも同じように引っ込むことを見る
      // ＝献立が決まっている日に提案を重ねない、という決めごとそのものを測る。
      // 2026-08-17 便HI: 決まっている日は**節ごと畳んで**出す(見出しは「今日なに作る？」のまま)。
      // ここで見るのは「押していないうちは中身が出ていない」こと(開けることは DAYLAYOUT-01 が見る)
      await dhPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const side = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                const tx = idb.transaction('todayList', 'readwrite')
                tx.objectStore('todayList').add({ recipeId: side.id, addedAt: Date.now() })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await dhPage.reload({ waitUntil: 'networkidle' })
      await dhPage.waitForTimeout(1500)
      {
        const body = ((await dhPage.textContent('body')) ?? '').replaceAll('​', '')
        check(
          'DAYSUGGEST-01 今日の献立が1品でも決まると「今日なに作る？」は開いたまま出さない',
          // 2026-08-20 便II・③: 決めてもらうボタンだけは畳んでも出す（折りたたみを開かなくても
          // 機能に手が届くようにした）ので、「中身が出ていない」は**切り替えと候補**で測る
          (await dhPage.locator('[data-testid="day-suggest-toggle"]').getAttribute(
            'aria-expanded',
          )) === 'false' &&
            (await dhPage.locator('[data-testid="day-mode-one"]').count()) === 0 &&
            (await dhPage.locator('[data-testid="day-suggest-result"]').count()) === 0 &&
            body.includes('ほうれん草のおひたし'),
          `切り替え=${await dhPage.locator('[data-testid="day-mode-one"]').count()} 候補=${await dhPage.locator('[data-testid="day-suggest-result"]').count()}`,
        )
        check(
          'DAYSUGGEST-01(便II・③) 畳んでいても、決めてもらうボタンだけは押せる場所に残る',
          (await dhPage.locator('[data-testid="day-suggest-draw"]').count()) === 1,
        )
      }

      // (3) その1品を今日の献立から外すと、また出る(片道の判定になっていないこと)
      await dhPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('todayList', 'readwrite')
              tx.objectStore('todayList').clear()
              tx.oncomplete = () => resolve(true)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await dhPage.reload({ waitUntil: 'networkidle' })
      await dhPage.waitForTimeout(1500)
      check(
        'DAYSUGGEST-01 今日の献立を空に戻すと「今日なに作る？」がまた出る',
        ((await dhPage.textContent('body')) ?? '').replaceAll('​', '').includes('おまかせで1品出す'),
      )
      // 2026-08-28 便LX: 上の「1品でも決まると候補は出ていない」（day-suggest-result が0件）は、
      // **出る場面をこの節で1度も測っていなかった**ので、目印を変えても・候補のカードが丸ごと
      // 消えても緑のままだった（src で `day-suggest-result` を改名して実測）。
      // 空に戻したここで1品出させ、「出る場面」と対にする。件数は下限だけ見る（禁じ手③）
      {
        const dhDraw = dhPage.getByRole('button', { name: ja.dayStart.shuffle })
        if ((await dhDraw.count()) >= 1) {
          await dhDraw.first().click()
          await dhPage.waitForTimeout(900)
        }
        check(
          'DAYSUGGEST-01 出させた候補には目印が付いている(「出ていない」が中身のある判定になる)',
          (await dhPage.locator('[data-testid="day-suggest-result"]').count()) >= 1,
          `候補=${await dhPage.locator('[data-testid="day-suggest-result"]').count()}`,
        )
      }
    } finally {
      await dhBrowser.close()
    }
  }
