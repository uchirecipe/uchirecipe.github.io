// ==========================================================================================
// e2e の節: 便FD（献立カード等）・紹介ページ・便FI
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
// この中の節: FD, FD-09, FD-07, FD-10, FD-08, FD-01, FD-02, FD-04, FD-03, FD-05, FD-06, FE-LP, FG-LP, HF-LP, HK-PWA, HK-LP, FI-01, FI-02, FI-03, FI-04, FI-05, FI-06, FI-07, FI-08
// ==========================================================================================
import './_shared.mjs'


  // --- FD: 2026-08-10 オーナー実機フィードバック10件（献立カード4・作った記録の小窓2・週献立4） ---
  //  FD-01 ロック中の枠の1行が「ロック中」だけになる（何ができなくなるかは鍵を掛けた案内が言う）
  //  FD-02 その日/その週の栄養に「ごはん◯杯分を足しています」が出て、数が「1食につき1杯」と一致する
  //  FD-03 週カード・月の日の窓の「レシピを見る」から戻ると、同じ画面・同じ場所に帰る
  //  FD-04 レシピを選び直すと「元に戻す」が出て、次に開く一覧に「前回選択」が並ぶ
  //  FD-05 作った記録の小窓がコンパクト（食数は料理名の横／未入力の欄は行ごと出さない）
  //  FD-06 小窓の「この記録を編集する」がその場で開き、レシピ詳細へ飛ばされない
  //  FD-07〜10 週タブが勝手に下へスクロールしない（scrollYの実測。今日へ寄ることも実測）
  currentCheck = 'FD'
  {
    const fdBrowser = await chromium.launch()
    try {
      const fdCtx = await fdBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fdPage = await fdCtx.newPage()
      fdPage.on('dialog', (d) => void d.accept())
      fdPage.on('pageerror', (err) => errors.push(`[pageerror@FD] ${err.message}`))
      fdPage.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@FD] ${t}`)
      })
      await fdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fdPage.waitForTimeout(2000)

      const fdSeed = await fdPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, logs = []) => ({
          title,
          servings: 2,
          effortLevel: 'normal',
          tags: [],
          ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }],
          steps: [{ text: '切る。' }, { text: '焼く。', minutes: 5 }],
          isFavorite: false,
          cookedLogs: logs,
          searchWords: [],
          isStarter: false,
          updatedAt: Date.now(),
        })
        const iso = (dt) =>
          `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        const now = new Date()
        const today = iso(now)
        const yesterday = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
        const idMain = await P(store('recipes').add(mk('FD照り焼き')))
        const idSide = await P(store('recipes').add(mk('FDおひたし')))
        const idOther = await P(store('recipes').add(mk('FD切り干し大根')))
        // 一品もの（主食が重なるのでごはんを足さない食事）を作るための1品
        const idCurry = await P(store('recipes').add(mk('FD夏野菜カレー')))
        // メモ付きの記録と、メモも写真も無い記録（小窓のコンパクト表示の検査に使う）
        const idLogged = await P(
          store('recipes').add(
            mk('FDきんぴらごぼう', [{ date: yesterday, servings: 3, note: '甘めがよかった' }]),
          ),
        )
        const idLoggedBare = await P(
          store('recipes').add(mk('FD肉じゃが', [{ date: yesterday, servings: 4 }])),
        )
        // 前後2週間ぶんの夕食を埋める（どの曜日に走らせても週タブが縦に長くなる）
        for (let off = -14; off <= 14; off++) {
          const date = iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + off))
          await P(store('mealPlans').add({ date, slot: 'dinner', role: 'main', recipeId: idMain }))
          await P(store('mealPlans').add({ date, slot: 'dinner', role: 'side', recipeId: idSide }))
        }
        // 今日は朝食にも1品（＝料理が入っている食事が2つ→ごはん2杯）、
        // 昼食は一品もの（＝足さない）。杯数の数え方をこの1日で確かめる
        await P(store('mealPlans').add({ date: today, slot: 'breakfast', role: 'main', recipeId: idOther }))
        await P(store('mealPlans').add({ date: today, slot: 'lunch', role: 'main', recipeId: idCurry }))
        await P(store('mealPlans').add({ date: yesterday, slot: 'dinner', role: 'other', recipeId: idLogged }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(
          store('settings').put({
            ...cur,
            id: 1,
            proCode: 'UR-E2E-TEST-ONLY',
            proActivatedAt: Date.now(),
            // ごはんを含めて計算する（既定OFFなので、この検査のためにONにしておく）
            includeRice: true,
          }),
        )
        db.close()
        return { idMain, idSide, idOther, idLogged, idLoggedBare, today, yesterday }
      })

      /** Playwrightのclick()は要素を画面内へ入れてから押す＝スクロールの実測が汚れるので、その場で押す */
      const fdClickText = (text) =>
        fdPage.evaluate((t) => {
          const b = [...document.querySelectorAll('button')].find(
            (x) => (x.textContent ?? '').trim() === t,
          )
          if (b) b.click()
          return !!b
        }, text)
      const fdClickSel = (sel) =>
        fdPage.evaluate((s) => {
          const b = document.querySelector(s)
          if (b) b.click()
          return !!b
        }, sel)
      const fdGeom = () =>
        fdPage.evaluate((today) => {
          const el = document.querySelector(`section[data-date="${today}"]`)
          let topBar = 0
          for (const b of document.querySelectorAll('[data-app-top-bar]')) {
            const r = b.getBoundingClientRect()
            if (r.height > 0 && r.top <= 2) topBar = Math.max(topBar, r.bottom)
          }
          return {
            y: Math.round(window.scrollY),
            docH: Math.round(document.documentElement.scrollHeight),
            todayTop: el ? Math.round(el.getBoundingClientRect().top) : null,
            topBar: Math.round(topBar),
          }
        }, fdSeed.today)

      // ---------- FD-09 週タブに入っても勝手に下へ飛ばない ----------
      // 2026-08-10 便FDで直したのは「タブ切替・週移動のたびにページが最下部近くまで飛ぶ」こと
      // （開いた状態で現れた折りたたみ7か所が同時に位置合わせを要求していた。実測 0→2636px）。
      // そのとき送り先を「今日のカード」に決めていたが、2026-08-17 便HI（オーナー実機
      // 「ページ開いた時に、基本的にページのいちばん上を表示して」）で寄せるのをやめた。
      // 飛ばない仕組み（Collapse側）は残っているので、ここは**先頭のままでいること**で測る。
      // 「今日のカードへ送る」道は ?focus=week&date=（ET-02が見ている）と
      // 「まとめて献立を入力」の直後（便BH-3。入った枠が画面外だと無反応に見えるため）に残っている。
      currentCheck = 'FD-09'
      await fdPage.goto(`${BASE}/#/meal-plan`)
      await fdPage.reload({ waitUntil: 'networkidle' })
      await fdPage.waitForTimeout(2000)
      await fdPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(fdPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await fdPage.waitForTimeout(2500)
      const fdEnter = await fdGeom()
      check(
        'FD-09 週タブに入ってもページの先頭のまま（下へ飛ばない）',
        fdEnter.y === 0 && fdEnter.docH > 2000,
        JSON.stringify(fdEnter),
      )
      // いったん下まで送ってから 日タブ→週タブ に入り直しても、先頭から見せる
      await fdPage.evaluate(() => window.scrollTo(0, 2500))
      await fdPage.waitForTimeout(500)
      await fdPage.getByRole('button', { name: '日', exact: true }).click()
      await fdPage.waitForTimeout(800)
      await fdPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(fdPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await fdPage.waitForTimeout(2500)
      const fdReenter = await fdGeom()
      check(
        'FD-09 週タブに入り直しても先頭から（前に見ていた縦位置に取り残されない）',
        fdReenter.y === 0,
        JSON.stringify(fdReenter),
      )

      // ---------- FD-07 「すべて折りたたむ」「すべて開く」で画面が動かない ----------
      currentCheck = 'FD-07'
      await fdPage.evaluate(() => window.scrollTo(0, 0))
      await fdPage.waitForTimeout(500)
      const fdBeforeCollapse = await fdGeom()
      check('FD-07 前提: 折りたたむ前は7日分が開いていてページが長い', fdBeforeCollapse.docH > 2000, JSON.stringify(fdBeforeCollapse))
      check('FD-07 前提: 「すべて折りたたむ」が押せる', await fdClickText('すべて折りたたむ'))
      await fdPage.waitForTimeout(1200)
      const fdCollapsed = await fdGeom()
      check(
        'FD-07 「すべて折りたたむ」で画面は動かない（縦位置そのまま）',
        Math.abs(fdCollapsed.y - fdBeforeCollapse.y) <= 2,
        `${fdBeforeCollapse.y}→${fdCollapsed.y}`,
      )
      check('FD-07 前提: 「すべて開く」が押せる', await fdClickText('すべて開く'))
      await fdPage.waitForTimeout(2000)
      const fdExpanded = await fdGeom()
      check(
        'FD-07 「すべて開く」で下へスクロールしない（実測: 旧版は0→2636px飛んでいた）',
        Math.abs(fdExpanded.y - fdCollapsed.y) <= 2,
        `${fdCollapsed.y}→${fdExpanded.y}`,
      )
      // 2026-08-11 便FJ: 旧版は「今日のカードが画面内(top<844)に残っている」を見ていたが、
      // これは**今日が週の何日目か**に依存する条件だった。この一連の操作は縦位置0から始めるので、
      // 今日のカードの位置＝(その週で今日より前の曜日のカードの高さの合計)になる。
      // 月曜なら画面内、火曜でちょうど画面の下端(実測844px)、水曜以降は画面外になる
      //  ＝ 便FDを作った2026-08-10(月)だけ通り、翌日から必ず落ちるテストだった
      //   (app/CLAUDE.md「e2eに曜日・月替わりの前提を置かない」。同型の作り込みは4回目)。
      // 直したいのは「畳む→開くで今日の居場所が変わってしまうこと」なので、
      // 往復の前後で今日のカードが同じ位置に戻ることを見る（曜日に依存しない）。
      check(
        'FD-07 「すべて開く」のあとも今日のカードが元の位置に戻っている（今日をスルーしない）',
        fdExpanded.todayTop != null &&
          fdBeforeCollapse.todayTop != null &&
          Math.abs(fdExpanded.todayTop - fdBeforeCollapse.todayTop) <= 2,
        `${JSON.stringify(fdBeforeCollapse)} → ${JSON.stringify(fdExpanded)}`,
      )

      // ---------- FD-10 「すべてロック」「すべて解除」で画面が動かない ----------
      currentCheck = 'FD-10'
      await fdPage.evaluate(() => window.scrollTo(0, 600))
      await fdPage.waitForTimeout(500)
      const fdBeforeLock = await fdGeom()
      check('FD-10 前提: 「すべてロック」が押せる', await fdClickSel('[data-testid="lock-all"]'))
      await fdPage.waitForTimeout(1500)
      const fdLocked = await fdGeom()
      check(
        'FD-10 「すべてロック」で画面が動かない',
        Math.abs(fdLocked.y - fdBeforeLock.y) <= 2,
        `${fdBeforeLock.y}→${fdLocked.y}`,
      )
      check('FD-10 前提: 「すべて解除」が押せる', await fdClickSel('[data-testid="lock-all"]'))
      await fdPage.waitForTimeout(1500)
      const fdUnlocked = await fdGeom()
      check(
        'FD-10 「すべて解除」で画面が動かない',
        Math.abs(fdUnlocked.y - fdLocked.y) <= 2,
        `${fdLocked.y}→${fdUnlocked.y}`,
      )

      // ---------- FD-08 週を切り替えても画面が動かない ----------
      currentCheck = 'FD-08'
      await fdPage.evaluate(() => window.scrollTo(0, 500))
      await fdPage.waitForTimeout(500)
      const fdBeforeWeek = await fdGeom()
      check('FD-08 前提: 「次の週」が押せる', await fdClickSel('button[aria-label="次の週"]'))
      await fdPage.waitForTimeout(1800)
      const fdNextWeek = await fdGeom()
      check(
        'FD-08 「次の週」で下へスクロールしない（実測: 旧版は0→2228px飛んでいた）',
        Math.abs(fdNextWeek.y - fdBeforeWeek.y) <= 2,
        `${fdBeforeWeek.y}→${fdNextWeek.y}`,
      )
      check('FD-08 前提: 「前の週」が押せる', await fdClickSel('button[aria-label="前の週"]'))
      await fdPage.waitForTimeout(1800)
      const fdPrevWeek = await fdGeom()
      check(
        'FD-08 「前の週」でも下へスクロールしない',
        Math.abs(fdPrevWeek.y - fdNextWeek.y) <= 2,
        `${fdNextWeek.y}→${fdPrevWeek.y}`,
      )

      // ---------- FD-01 ロック中の1行 ----------
      currentCheck = 'FD-01'
      await fdPage.evaluate(() => window.scrollTo(0, 0))
      await fdPage.waitForTimeout(400)
      await fdClickSel('[data-testid="lock-all"]')
      await fdPage.waitForTimeout(1200)
      // 2026-08-22 便IV: 枠の中の「ロック中」の1行は編集モードの中にある
      // （通常表示では、食事の見出しの横に小さな鍵の印が出る＝IVLOCK-04 が見る）
      check(
        'FD-01 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(fdPage, fdSeed.today)) === true,
      )
      const fdLockNote = await fdPage.evaluate(
        () => document.querySelector('[data-testid="slot-lock-note"]')?.textContent ?? '',
      )
      check(
        'FD-01 ロック中の枠に出る1行は「ロック中」だけ（窮屈な説明文をやめた）',
        fdLockNote === 'ロック中',
        `note=${fdLockNote}`,
      )
      const fdLockToast = await fdPage.evaluate(
        () => document.querySelector('[role="status"]')?.textContent ?? '',
      )
      check(
        'FD-01 鍵を掛けたときの案内では「削除も変更もできません」を言い続ける（規約F）',
        fdLockToast.includes(ja.mealPlan.lockEffectNote),
        fdLockToast,
      )
      await fdClickSel('[data-testid="lock-all"]')
      await fdPage.waitForTimeout(1200)

      // ---------- FD-02 ごはんの杯数の注釈 ----------
      currentCheck = 'FD-02'
      const fdDateLabel = fdSeed.today.replaceAll('-', '/')
      await fdPage
        .getByRole('button', { name: `この日（${fdDateLabel}）の栄養の概算を詳しく見る` })
        .click()
      await fdPage.waitForTimeout(1200)
      const fdRiceNote = await fdPage.evaluate((today) => {
        const section = document.querySelector(`section[data-date="${today}"]`)
        return section?.querySelector('[data-testid="rice-added-note"]')?.textContent ?? ''
      }, fdSeed.today)
      check(
        'FD-02 その日の栄養に「ごはん◯杯分を足しています」が出る',
        fdRiceNote === 'この日の合計に、ごはん2杯分を足しています。',
        `note=${fdRiceNote}`,
      )
      // 数え方の一致: 料理が入っている食事は朝食・昼食・夕食の3つだが、昼食は一品もの（カレー）
      // なので足さない＝2杯。「1食につきごはん1杯」の仕組みと同じ数になっている
      const fdRiceBasis = await fdPage.evaluate((today) => {
        const section = document.querySelector(`section[data-date="${today}"]`)
        const text = section?.textContent ?? ''
        return {
          slots: [...(section?.querySelectorAll('[data-testid="slot-block"]') ?? [])].length,
          hasRule: text.includes('1食につきごはん1杯'),
        }
      }, fdSeed.today)
      check(
        'FD-02 杯数は「料理が入っている食事の数」と同じ（一品ものの食事には足さない）',
        fdRiceNote.includes('2杯分') && fdRiceBasis.hasRule,
        JSON.stringify(fdRiceBasis),
      )

      // ---------- FD-04 レシピの選び直しを元に戻せる ----------
      currentCheck = 'FD-04'
      const fdTodaySection = fdPage.locator(`section[data-date="${fdSeed.today}"]`)
      // 2026-08-22 便IV: 枠の押下＝レシピの選び直しは編集モードの中（通常表示の押下は
      // レシピ詳細へ移る）。選び直しを測るので編集モードにしてから触る
      check(
        'FD-04 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(fdPage, fdSeed.today)) === true,
      )
      await fdTodaySection.getByRole('button', { name: /FD照り焼き/ }).first().click()
      await fdPage.waitForTimeout(800)
      check(
        'FD-04 前提: レシピを選ぶ一覧が開く',
        (await fdPage.locator('[data-testid="recipe-picker"]').count()) === 1,
      )
      await fdPage
        .locator('[data-testid="recipe-picker"]')
        .getByText('FD切り干し大根', { exact: true })
        .first()
        .click()
      await fdPage.waitForTimeout(1200)
      const fdPickToast = await fdPage.evaluate(
        () => document.querySelector('[role="status"]')?.textContent ?? '',
      )
      check(
        'FD-04 入れ替えると「「A」を「B」に変えました」と出る（黙って変わらない）',
        fdPickToast.includes('「FD照り焼き」を「FD切り干し大根」に変えました'),
        fdPickToast,
      )
      check(
        'FD-04 そのトーストから1回で元に戻せる',
        (await fdPage.getByRole('button', { name: '元に戻す' }).count()) === 1,
      )
      // 一覧を開き直すと「選択中」の次に「前回選択」が並ぶ
      await fdTodaySection.getByRole('button', { name: /FD切り干し大根/ }).first().click()
      await fdPage.waitForTimeout(800)
      const fdPickerRows = await fdPage.evaluate(() =>
        [...document.querySelectorAll('[data-testid="recipe-picker"] li button')]
          .slice(0, 2)
          .map((b) => (b.textContent ?? '').replace(/\s+/g, ' ').trim()),
      )
      check(
        'FD-04 一覧の1番目が「選択中」・2番目が「前回選択」で並ぶ',
        fdPickerRows.length === 2 &&
          fdPickerRows[0].includes('FD切り干し大根') &&
          fdPickerRows[0].includes('選択中') &&
          fdPickerRows[1].includes('FD照り焼き') &&
          fdPickerRows[1].includes('前回選択'),
        JSON.stringify(fdPickerRows),
      )
      check(
        'FD-04 「前回選択」を押せば1つ前のレシピに戻せる',
        (await fdPage.locator('[data-testid="picker-previous"]').count()) === 1,
      )
      await fdPage.locator('[data-testid="picker-previous"]').click()
      await fdPage.waitForTimeout(1200)
      check(
        'FD-04 押すと枠が1つ前のレシピに戻る',
        (await fdTodaySection.getByRole('button', { name: /FD照り焼き/ }).count()) === 1,
        (await fdTodaySection.innerText()).slice(0, 120),
      )
      // トーストの「元に戻す」でも戻せる（誤操作の直後に気づける道）
      await fdTodaySection.getByRole('button', { name: /FD照り焼き/ }).first().click()
      await fdPage.waitForTimeout(700)
      await fdPage
        .locator('[data-testid="recipe-picker"]')
        .getByText('FD切り干し大根', { exact: true })
        .first()
        .click()
      await fdPage.waitForTimeout(1000)
      await fdPage.getByRole('button', { name: '元に戻す' }).click()
      await fdPage.waitForTimeout(1200)
      check(
        'FD-04 トーストの「元に戻す」でも1つ前のレシピに戻る',
        (await fdTodaySection.getByRole('button', { name: /FD照り焼き/ }).count()) === 1 &&
          ((await fdPage.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? '')).includes(
            '「FD照り焼き」に戻しました',
          )),
        (await fdTodaySection.innerText()).slice(0, 120),
      )

      // ---------- FD-03 「レシピを見る」から同じ画面へ帰る（週タブ） ----------
      currentCheck = 'FD-03'
      // 押すためのスクロールで位置が動かないよう、先に画面の真ん中あたりへ送ってから押す
      // 2026-08-22 便IV: 通常表示では**カードそのもの**がレシピ詳細へのリンク（a要素）になった。
      // 編集モードの日の枠は押すと選び直しの窓が開く button なので、a に絞って掴む
      // ＝どちらのモードの日が混ざっていても、レシピ詳細へ移る道だけを選べる
      // FD-04 が今日のカードを編集モードにしたままなので、通常表示へ戻してから測る
      // （レシピ詳細への入口は通常表示のカード）
      const fdEditToday = fdPage.locator(
        `[data-testid="week-day-edit"][data-date="${fdSeed.today}"]`,
      )
      if (
        (await fdEditToday.count()) === 1 &&
        (await fdEditToday.first().getAttribute('aria-pressed')) === 'true'
      ) {
        await fdEditToday.first().click()
        await fdPage.waitForTimeout(600)
      }
      check(
        'FD-03 前提: 週カードに、レシピ詳細へ移る1品カードがある',
        (await fdPage.locator('a[data-testid="row-recipe"]').count()) > 0,
        `カード=${await fdPage.locator('a[data-testid="row-recipe"]').count()}件`,
      )
      await fdPage.evaluate(() => {
        const links = document.querySelectorAll('a[data-testid="row-recipe"]')
        // 週の途中のカードを選ぶ（無ければ先頭）。押す前に画面の真ん中あたりへ送る
        const link = links[3] ?? links[0]
        if (link) {
          window.scrollTo(0, Math.max(0, Math.round(window.scrollY + link.getBoundingClientRect().top - 300)))
        }
      })
      await fdPage.waitForTimeout(900)
      // 2026-08-14 便GH: 測るものを「縦スクロール量(window.scrollY)の一致」から
      // **「見ていた曜日カードが画面の同じ高さに帰ってくること」**へ変えた。
      // 旧い測り方は利用者の関心（同じ場所が映るか）とずれていて、両方向に誤判定していた:
      //  ・落ちる側 … この直前のFD-02が「栄養の概算を詳しく見る」を開いたままなので、
      //    レシピ詳細へ移ると明細が閉じてページが695px縮む。週の後半の曜日ではカードの位置が
      //    ページの末尾寄りになり、覚えた縦位置まで下がれない＝**今日が何曜日かで結果が変わる**
      //    （実測: 月〜木は通り、金2511→2460・土2715→2264で落ちる。app/CLAUDE.mdの禁じ手①）
      //  ・素通り合格の側 … 月曜は縦位置が一致して「合格」になるが、そのとき見ていたカードは
      //    画面外へ695px上がっていた＝**同じ場所に帰れていないのに通っていた**（禁じ手④に同じ）
      // カードの画面上の位置で測れば、上で何が伸び縮みしても、曜日が変わっても、
      // 「同じ場所が映るか」だけを見ることになる。誤差20px以内は変えない。
      const fdBeforeOpen = await fdPage.evaluate(() => {
        const link = [...document.querySelectorAll('a[data-testid="row-recipe"]')].find((a) => {
          const r = a.getBoundingClientRect()
          return r.top > 90 && r.bottom < window.innerHeight - 90
        })
        if (!link) return null
        const card = link.closest('section[data-date]')
        if (!card) return null
        const y = Math.round(window.scrollY)
        const date = card.getAttribute('data-date')
        const cardTop = Math.round(card.getBoundingClientRect().top)
        link.click()
        return { y, date, cardTop }
      })
      await fdPage.waitForTimeout(1500)
      check(
        'FD-03 前提: 週カードの1品カードでレシピ詳細へ移る（便IV）',
        fdBeforeOpen != null && /#\/recipes\/\d+/.test(fdPage.url()),
        `${JSON.stringify(fdBeforeOpen)} url=${fdPage.url()}`,
      )
      await fdPage.getByRole('button', { name: ja.common.back }).first().click()
      await fdPage.waitForTimeout(2500)
      const fdBack = await fdPage.evaluate((date) => {
        const card = date ? document.querySelector(`section[data-date="${date}"]`) : null
        return {
          y: Math.round(window.scrollY),
          docH: Math.round(document.documentElement.scrollHeight),
          cardTop: card ? Math.round(card.getBoundingClientRect().top) : null,
        }
      }, fdBeforeOpen?.date ?? '')
      check(
        'FD-03 前提: 戻ると離れる前と同じ週が開いている（そのカードが画面に在る）',
        fdBeforeOpen != null && fdBack.cardTop != null,
        `${JSON.stringify(fdBeforeOpen)} → ${JSON.stringify(fdBack)}`,
      )
      check(
        'FD-03 「戻る」で、離れる直前に見ていた献立のカードが画面の同じ位置に帰る（誤差20px以内）',
        fdBeforeOpen != null &&
          fdBack.cardTop != null &&
          Math.abs(fdBack.cardTop - fdBeforeOpen.cardTop) <= 20,
        `${fdBeforeOpen && fdBeforeOpen.date}のカード ${fdBeforeOpen && fdBeforeOpen.cardTop}px→${fdBack.cardTop}px / scrollY ${fdBeforeOpen && fdBeforeOpen.y}→${fdBack.y} / docH ${fdBack.docH}`,
      )

      // ---------- FD-03 「レシピを見る」から同じ画面へ帰る（月タブの日の窓） ----------
      await fdPage.getByRole('button', { name: '月', exact: true }).click()
      await fdPage.waitForTimeout(1500)
      await fdPage.locator(`[data-date="${fdSeed.today}"]`).first().click()
      await fdPage.waitForTimeout(1000)
      // 2026-08-25 便KU: 日の窓のレシピカードは**通常表示のまま**レシピ詳細へのリンク
      // （オーナー原文「他はレシピカードから必ずレシピ詳細に行くので揃えるべきでは」）。
      // 編集モードに入らなくても同じ道が在ることを、この節でそのまま測る
      check(
        'FD-03 前提: 月タブの日の窓が開き、中のレシピカードがレシピ詳細へのリンクになっている',
        (await fdPage.locator('[role="dialog"] a[data-testid="row-recipe"]').count()) >= 1,
        `リンク=${await fdPage.locator('[role="dialog"] a[data-testid="row-recipe"]').count()}`,
      )
      await fdPage.locator('[role="dialog"] a[data-testid="row-recipe"]').first().click()
      await fdPage.waitForTimeout(1500)
      check(
        'FD-03 前提: 月タブからもレシピ詳細へ移る',
        /#\/recipes\/\d+/.test(fdPage.url()),
        fdPage.url(),
      )
      await fdPage.getByRole('button', { name: ja.common.back }).first().click()
      await fdPage.waitForTimeout(2500)
      const fdMonthBack = await fdPage.evaluate((today) => {
        const dialogs = [...document.querySelectorAll('[role="dialog"]')]
        return {
          count: dialogs.length,
          text: dialogs.map((d) => (d.textContent ?? '').slice(0, 30)).join(' / '),
          hasDay: dialogs.some((d) => (d.getAttribute('aria-label') ?? '').length >= 0) && today != null,
        }
      }, fdSeed.today)
      check(
        'FD-03 月タブは「日の窓」ごと開き直す（窓が閉じたカレンダーに着地しない）',
        fdMonthBack.count >= 1 && fdMonthBack.text.includes('の献立'),
        JSON.stringify(fdMonthBack),
      )

      // ---------- FD-05 記録の小窓がコンパクト ----------
      currentCheck = 'FD-05'
      await fdPage.goto(`${BASE}/#/history`)
      await fdPage.reload({ waitUntil: 'networkidle' })
      await fdPage.waitForTimeout(1800)
      await fdPage.getByRole('button', { name: 'FDきんぴらごぼうの作った記録を見る' }).first().click()
      await fdPage.waitForTimeout(800)
      const fdLogDialog = fdPage.getByRole('dialog', { name: 'FDきんぴらごぼうの作った記録' })
      const fdLogTitle = await fdLogDialog.locator('[data-testid="cooked-detail-title"]').innerText()
      check(
        'FD-05 食数は料理名の横に短く出る（「FDきんぴらごぼう（3人分）」）',
        fdLogTitle.replace(/\s+/g, '') === 'FDきんぴらごぼう（3人分）',
        fdLogTitle,
      )
      const fdLogText = await fdLogDialog.innerText()
      check(
        'FD-05 入れた欄（ひとことメモ）は出て、「何人分作ったか」の行は無くなっている',
        fdLogText.includes('ひとことメモ') &&
          fdLogText.includes('甘めがよかった') &&
          !fdLogText.includes('何人分作ったか'),
        fdLogText.replace(/\n/g, ' | '),
      )
      await fdPage.keyboard.press('Escape')
      await fdPage.waitForTimeout(600)
      await fdPage.getByRole('button', { name: 'FD肉じゃがの作った記録を見る' }).first().click()
      await fdPage.waitForTimeout(800)
      const fdBareText = await fdPage.getByRole('dialog', { name: 'FD肉じゃがの作った記録' }).innerText()
      check(
        'FD-05 未入力の欄（ひとことメモ・写真）は行ごと出さない',
        !fdBareText.includes('ひとことメモ') && !fdBareText.includes('未入力'),
        fdBareText.replace(/\n/g, ' | '),
      )

      // ---------- FD-06 小窓の中で編集が完結する ----------
      currentCheck = 'FD-06'
      await fdPage.getByRole('button', { name: ja.cookedDetail.edit }).click()
      await fdPage.waitForTimeout(800)
      check(
        'FD-06 「この記録を編集する」でレシピ詳細へ飛ばされない（元の画面のまま）',
        fdPage.url().includes('#/history') && !/#\/recipes\/\d+/.test(fdPage.url()),
        fdPage.url(),
      )
      check(
        'FD-06 小窓の中に編集欄が開く',
        (await fdPage.locator('[data-testid="cooked-log-editor"]').count()) === 1,
      )
      await fdPage.locator('[data-testid="cooked-log-editor"] input[type="text"]').fill('小窓で直した')
      await fdPage.getByRole('button', { name: ja.detail.servingsUp }).click()
      await fdPage.getByRole('button', { name: '保存する' }).click()
      await fdPage.waitForTimeout(1500)
      const fdSaved = await fdPage.evaluate(async (id) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const rec = await P(db.transaction('recipes').objectStore('recipes').get(id))
        db.close()
        return rec.cookedLogs
      }, fdSeed.idLoggedBare)
      check(
        'FD-06 その場の保存が端末の記録に入る（メモと人数）',
        fdSaved.length === 1 && fdSaved[0].note === '小窓で直した' && fdSaved[0].servings === 5,
        JSON.stringify(fdSaved),
      )
      const fdAfterSave = await fdPage.getByRole('dialog', { name: 'FD肉じゃがの作った記録' }).innerText()
      check(
        'FD-06 保存すると小窓の表示もその場で新しくなる（画面を移らない）',
        fdAfterSave.includes('小窓で直した') && fdAfterSave.includes('（5人分）'),
        fdAfterSave.replace(/\n/g, ' | '),
      )
      // カレンダー（月タブの日の窓）からも同じように直せる
      await fdPage.keyboard.press('Escape')
      await fdPage.waitForTimeout(500)
      await fdPage.goto(`${BASE}/#/meal-plan`)
      await fdPage.reload({ waitUntil: 'networkidle' })
      await fdPage.waitForTimeout(2000)
      await fdPage.getByRole('button', { name: '月', exact: true }).click()
      await fdPage.waitForTimeout(1500)
      await fdPage.locator(`[data-date="${fdSeed.yesterday}"]`).first().click()
      await fdPage.waitForTimeout(1000)
      await fdPage.getByRole('button', { name: 'FDきんぴらごぼうの作った記録を見る' }).first().click()
      await fdPage.waitForTimeout(800)
      await fdPage.getByRole('button', { name: ja.cookedDetail.edit }).click()
      await fdPage.waitForTimeout(700)
      check(
        'FD-06 カレンダーから開いても、その場に編集欄が開く（レシピ詳細へ飛ばされない）',
        fdPage.url().includes('#/meal-plan') &&
          (await fdPage.locator('[data-testid="cooked-log-editor"]').count()) === 1,
        fdPage.url(),
      )
      await fdPage.locator('[data-testid="cooked-log-editor"] input[type="text"]').fill('カレンダーで直した')
      await fdPage.getByRole('button', { name: '保存する' }).click()
      await fdPage.waitForTimeout(1500)
      const fdSavedFromMonth = await fdPage.evaluate(async (id) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const rec = await P(db.transaction('recipes').objectStore('recipes').get(id))
        db.close()
        return rec.cookedLogs
      }, fdSeed.idLogged)
      check(
        'FD-06 カレンダーからの保存も端末の記録に入り、献立の枠は消えない（記録だけを直す）',
        fdSavedFromMonth.length === 1 && fdSavedFromMonth[0].note === 'カレンダーで直した',
        JSON.stringify(fdSavedFromMonth),
      )
      const fdMonthPlanKept = await fdPage.evaluate(async (date) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const all = await P(db.transaction('mealPlans').objectStore('mealPlans').getAll())
        db.close()
        return all.filter((e) => e.date === date).length
      }, fdSeed.yesterday)
      check(
        'FD-06 記録を直しても、その日の献立の枠は1件も減っていない',
        fdMonthPlanKept === 3,
        `件数=${fdMonthPlanKept}`,
      )
    } finally {
      await fdBrowser.close()
    }
  }

  // ================================================================================
  // --- 便FE(2026-08-10 オーナー指示): 紹介ページの密度・文章量・登録節の構成 ---
  // ①吹き出しの中の文が中央揃えで、上下の間隔が詰まっている(散らし方は便EXのまま)
  // ②「好きなレシピを登録」節が URL → 文章 → 手入力 →「登録すると、あとは自動」の順
  // ③見出しから「手で書く」が消えている(手書きのスクショ読み取りと誤解されるため)
  // ④「登録したレシピで、できること」が4つ(献立の提案を1番目に立てた)
  // ⑤無料30品の記載が紹介ページのどこかに残っていて、購入ボタンより前にある
  // ⑥390pxで横はみ出しゼロ・ライト/ダークとも本文がAA(4.5:1)以上
  // ================================================================================
  currentCheck = 'FE-LP'
  {
    const feHtml = await (await page.request.get(`${BASE}/about/`)).text()

    // --- (a) 登録節の構成 ---
    check(
      'FE-LP 登録節の見出しから「手で書く」が消えている',
      !feHtml.includes('URLを貼る。文章を貼る。手で書く。') && !/<h2[^>]*>[^<]*手で書く/.test(feHtml),
    )

    const feBrowser = await chromium.launch()
    try {
      for (const scheme of ['light', 'dark']) {
        const feCtx = await feBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
        })
        const fePage = await feCtx.newPage()
        fePage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
          errors.push(`[pageerror@FE-LP] ${err.message}`)
        })
        await fePage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })

        const fe = await fePage.evaluate(() => {
          const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          const lum = (c) => {
            const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((n) => srgb(Number(n) / 255))
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const ratio = (a, b) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
            return (x + 0.05) / (y + 0.05)
          }
          const secOf = (el) => el.closest('section.sec')
          const regSec = [...document.querySelectorAll('section.sec')].find(
            (s) => s.querySelector('.eyebrow')?.textContent?.trim() === '好きなレシピを登録する',
          )
          const canSecs = [...document.querySelectorAll('section.sec')].filter((s) =>
            (s.querySelector('.eyebrow')?.textContent ?? '').startsWith('登録したレシピで、できること'),
          )
          const painsLis = [...document.querySelectorAll('.pains li')]
          const painsBoxes = painsLis.map((li) => li.getBoundingClientRect())
          const proSec = secOf(document.querySelector('.price'))
          // 2026-08-10 便FG(オーナー指示): 無料30品の案内は、Pro版の節の枠つき注記から
          // 「好きなレシピを登録する」の節のいちばん下の1文(.free-limit)へ移した
          const limitNote = document.querySelector('.free-limit')
          // 節の中の要素を、出てくる順に「種類:文字」で並べたもの
          const outline = (sec) =>
            [...sec.querySelectorAll('h2, h3, a.more')].map(
              (el) => `${el.tagName.toLowerCase()}:${el.textContent.trim()}`,
            )
          const bodyText = (el) => {
            const cs = getComputedStyle(el)
            return { color: cs.color, size: parseFloat(cs.fontSize) }
          }
          const surface = getComputedStyle(regSec).backgroundColor
          return {
            regOutline: outline(regSec),
            regH2: regSec.querySelector('h2').textContent.trim(),
            regMoreHref: regSec.querySelector('a.more')?.getAttribute('href') ?? '',
            regHasLimitNote: !!regSec.querySelector('.note'),
            can: canSecs.map((s) => ({
              eyebrow: s.querySelector('.eyebrow').textContent.trim(),
              h2: s.querySelector('h2').textContent.trim(),
            })),
            painsAlign: painsLis.map((li) => getComputedStyle(li.querySelector('b')).textAlign),
            painsGaps: painsBoxes.slice(1).map((b, i) => Math.round(b.top - painsBoxes[i].bottom)),
            painsUlH: Math.round(document.querySelector('.pains').getBoundingClientRect().height),
            limitText: (limitNote?.textContent ?? '').trim(),
            limitInRegSec: !!limitNote && secOf(limitNote) === regSec,
            limitIsLastOfSec: !!limitNote && regSec.lastElementChild === limitNote,
            limitBeforeProSec:
              !!limitNote &&
              (limitNote.compareDocumentPosition(proSec) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
            limitBeforeBuy:
              !!limitNote &&
              (limitNote.compareDocumentPosition(document.querySelector('a.buy')) &
                Node.DOCUMENT_POSITION_FOLLOWING) !==
                0,
            docW: document.documentElement.scrollWidth,
            winW: document.documentElement.clientWidth,
            // 本文・補足・見出しのコントラスト(カード面の上)
            contrastBody: ratio(
              bodyText(regSec.querySelector('p:not(.eyebrow):not(.muted)')).color,
              surface,
            ),
            contrastMuted: ratio(
              bodyText(document.querySelector('.sec p.muted')).color,
              surface,
            ),
            contrastH3: ratio(bodyText(regSec.querySelector('h3')).color, surface),
          }
        })

        if (scheme === 'light') {
          check(
            'FE-LP 登録節の見出しが「URLを貼るだけで、レシピが登録できる」',
            fe.regH2 === 'URLを貼るだけで、レシピが登録できる',
            fe.regH2,
          )
          check(
            'FE-LP 登録節は URL → 文章 → 手入力 → 自動 の順で、末尾が詳しくリンク',
            JSON.stringify(fe.regOutline) ===
              JSON.stringify([
                'h2:URLを貼るだけで、レシピが登録できる',
                'h3:1. URLから取り込む',
                'h3:2. 文章を貼り付ける',
                'h3:3. 手入力する',
                'h3:登録すると、あとは自動',
                'a:レシピの登録を詳しく →',
              ]),
            fe.regOutline.join(' / '),
          )
          check(
            'FE-LP 登録節に枠つきの注記(.note)は置かない',
            fe.regHasLimitNote === false,
          )
          // 2026-08-10 便FG: 「他にも」は"その他"に当たる節なので番号つきの見出しラベルを外した。
          // 番号つきの「登録したレシピで、できること」は3つ
          check(
            'FE-LP 「できること」が3つあり、オーナー指定の並びになっている',
            JSON.stringify(fe.can) ===
              JSON.stringify([
                { eyebrow: '登録したレシピで、できること 1', h2: '献立を提案' },
                { eyebrow: '登録したレシピで、できること 2', h2: '調理中モードで、料理に集中' },
                { eyebrow: '登録したレシピで、できること 3', h2: '自動計算で、栄養と材料費を把握' },
              ]),
            JSON.stringify(fe.can),
          )
          check(
            'FE-LP 無料30品の記載は登録節にあり、購入ボタンより前に出る',
            fe.limitInRegSec && fe.limitBeforeBuy,
            `登録節=${fe.limitInRegSec} ボタンより前=${fe.limitBeforeBuy}`,
          )
          // 図の実寸と width/height 属性のずれ(読み込み中に文字が飛ぶ原因)。
          // 遅延読み込みの完了を待つと、画面外の図がいつまでも読み込まれず止まるので、
          // 別の Image で読み直し、1枚ごとに5秒で打ち切る(待ち続けない)
          const feShots = await fePage.evaluate(
            async () =>
              await Promise.all(
                [...document.querySelectorAll('figure.shot img')].map(
                  (el) =>
                    new Promise((res) => {
                      const probe = new Image()
                      const done = () =>
                        res({
                          src: el.getAttribute('src'),
                          w: probe.naturalWidth,
                          h: probe.naturalHeight,
                          attrW: Number(el.getAttribute('width')),
                          attrH: Number(el.getAttribute('height')),
                        })
                      probe.onload = done
                      probe.onerror = done
                      setTimeout(done, 5000)
                      probe.src = el.src
                    }),
                ),
              ),
          )
          const feShotNg = feShots.filter((s) => !s.w || s.w !== s.attrW || s.h !== s.attrH)
          check(
            'FE-LP 紹介ページの図の寸法が実寸と合っている',
            feShots.length >= 10 && feShotNg.length === 0,
            `検査${feShots.length}枚 / ずれ=${feShotNg
              .map((s) => `${s.src} 実寸${s.w}x${s.h} 記述${s.attrW}x${s.attrH}`)
              .join(' , ') || 'なし'}`,
          )
        }

        check(
          `FE-LP(${scheme}) 吹き出しの中の文が中央揃え`,
          fe.painsAlign.length === 4 && fe.painsAlign.every((a) => a === 'center'),
          fe.painsAlign.join(','),
        )
        // 便EX時点は 24/29/24px → 便FEで 8/11/8px → 便FG(オーナー「まだスカスカ」)で
        // 吹き出し自体を大きくしたうえで重ねたので、隙間は負(＝重なっている)になる。
        // 重ねすぎ(文字が隠れる)にも気づけるよう下限も見る
        check(
          `FE-LP(${scheme}) 390pxの吹き出しが重なるまで詰まっている(-28〜0px)`,
          fe.painsGaps.length === 3 && fe.painsGaps.every((g) => g >= -28 && g <= 0),
          `隙間=${fe.painsGaps.join(',')} 全体の高さ=${fe.painsUlH}`,
        )
        check(`FE-LP(${scheme}) 390pxで横にはみ出さない`, fe.docW <= fe.winW, `scrollW=${fe.docW}`)
        check(
          `FE-LP(${scheme}) 本文・補足・小見出しがAA(4.5:1)以上`,
          fe.contrastBody >= 4.5 && fe.contrastMuted >= 4.5 && fe.contrastH3 >= 4.5,
          `本文=${fe.contrastBody.toFixed(2)} 補足=${fe.contrastMuted.toFixed(2)} 小見出し=${fe.contrastH3.toFixed(2)}`,
        )
        await feCtx.close()
      }

      // PC幅でも吹き出しは上下に重なっている(隙間は0以下)。
      // 2026-08-17 便HF(オーナー指示「こんなことありませんかの吹き出し、大画面だとバランスが悪い。
      // 幅が狭い画面の時と同じにして」): 「隣り合う吹き出しが左右に完全にずれている」ことを
      // 条件にしていたが、これはパソコン幅だけ散らし幅を広げていたころ(便FG)の形。
      // 狭い画面と同じ並びでは隣どうしは左右にも重なるので、この条件は成り立たない。
      // 見たいのは括弧に書いてあるとおり「文字が重ならない」ことなので、枠ではなく
      // 文字が描かれている範囲そのもので測る形に改めた
      const fePcCtx = await feBrowser.newContext({ viewport: { width: 1280, height: 900 } })
      const fePcPage = await fePcCtx.newPage()
      await fePcPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
      const fePc = await fePcPage.evaluate(() => {
        const lis = [...document.querySelectorAll('.pains li')]
        const boxes = lis.map((li) => li.getBoundingClientRect())
        const texts = lis.map((li) => li.querySelector('b').getBoundingClientRect())
        return {
          gaps: boxes.slice(1).map((b, i) => Math.round(b.top - boxes[i].bottom)),
          // どの2つを取っても、文字の描かれている範囲どうしは重なっていない
          textOverlaps: texts
            .flatMap((a, i) =>
              texts.slice(i + 1).map((b, j) => {
                const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
                const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                return ox > 0 && oy > 0
                  ? `${i + 1}と${i + 2 + j}(横${Math.round(ox)} 縦${Math.round(oy)})`
                  : ''
              }),
            )
            .filter(Boolean),
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        }
      })
      check(
        'FE-LP(PC) 吹き出しが縦に重なるまで詰まっている',
        fePc.gaps.length === 3 && fePc.gaps.every((g) => g <= 0),
        `隙間=${fePc.gaps.join(',')}`,
      )
      check(
        'FE-LP(PC) 縦に重ねても文字どうしは重なっていない',
        fePc.textOverlaps.length === 0,
        fePc.textOverlaps.join(' , '),
      )
      check('FE-LP(PC) 横スクロールが出ていない', fePc.overflow === false)
      await fePcCtx.close()
    } finally {
      await feBrowser.close()
    }

    // --- (b) 「くわしく」の飛び先が実在する ---
    const feMoreRes = await page.request.get(`${BASE}/about/manual.html`)
    const feManual = await feMoreRes.text()
    check(
      'FE-LP 「レシピの登録をくわしく」の飛び先(/about/manual.html#register)が実在する',
      feMoreRes.status() === 200 &&
        feHtml.includes('href="/about/manual.html#register"') &&
        feManual.includes('id="register"'),
      `status=${feMoreRes.status()}`,
    )
    // 読み取り用サーバーの注記は登録節では省いた。省いてよい根拠(プライバシーポリシーと
    // 使い方ページに同じ説明がある・紹介ページのよくある質問にも残っている)を機械で見張る
    const feTerms = await (await page.request.get(`${BASE}/about/terms.html`)).text()
    check(
      'FE-LP URL取り込みが外部サーバーを経由する説明が、プライバシーポリシーにある',
      feTerms.includes('変換サーバー（Cloudflare Workers）に送信します'),
    )
    check(
      'FE-LP 同じ説明が使い方ページにもある',
      feManual.includes('読み取り用の変換サーバーへ送ります'),
    )
    check(
      'FE-LP 紹介ページのよくある質問にも残っている',
      feHtml.indexOf('変換サーバー（Cloudflare Workers）') >
        feHtml.indexOf('データはどこに保存されますか'),
    )
  }

  // ================================================================================
  // --- 便FG(2026-08-10 オーナー指示): 紹介ページの再構成と文言10件 ---
  //  ①吹き出しを大きくして重ねる(390pxは重なり・パソコンはさらに深く重なる。文字は隠さない)
  //  ②「献立から、買い物メモが自動で作れます」
  //  ③「他にも、できることたくさん」は"その他"の節として作り直し
  //     (代表3件だけ説明つき・残りは説明なしの羅列・くわしくは1つ・基本レシピは最下部)
  //  ④データの節の文言(レシピ帳/バックアップファイル/小見出しと1文/写真の削除/その都度)
  //  ⑤Pro版の節が、無料でできることの節の直後にある
  //  ⑥無料30品の1文が登録節の最下部にあり、購入ボタンより前で読める
  // ================================================================================
  currentCheck = 'FG-LP'
  {
    const fgHtml = await (await page.request.get(`${BASE}/about/`)).text()

    // --- ② 買い物メモの小見出し ---
    check(
      'FG-LP 「献立から、買い物メモが自動で作れます」になっている',
      fgHtml.includes('<h3>献立から、買い物メモが自動で作れます</h3>') &&
        !fgHtml.includes('買い物メモが自動でできます'),
    )

    // --- ④ データの節の文言5件 ---
    check(
      'FG-LP データの節は「レシピ帳を1つのファイルに書き出せます」(「ぜんぶ」を書かない)',
      fgHtml.includes('<strong>レシピ帳を1つのファイルに書き出せます</strong>') &&
        !fgHtml.includes('レシピ帳ぜんぶを'),
    )
    check(
      'FG-LP データの節は「新しい端末でバックアップファイルを読み込めば」',
      fgHtml.includes('新しい端末でバックアップファイルを読み込めば') &&
        !fgHtml.includes('新しい端末でそのファイルを読み込めば'),
    )
    check(
      'FG-LP 小見出しが「バックアップでレシピを保存」(クラウドを用意していると読ませない)',
      fgHtml.includes('<h3>バックアップでレシピを保存</h3>') &&
        !fgHtml.includes('バックアップと、クラウドの使い方'),
    )
    check(
      'FG-LP クラウドの説明は太字で強調した1文だけ',
      fgHtml.includes(
        '<p>書き出したバックアップファイルを<strong>Googleドライブなどのクラウドに置いておくと、別の端末から同じレシピ帳を読み込んで開けます</strong>。</p>',
      ),
    )
    check(
      'FG-LP データの節のバックアップの説明から写真の話が消えている(リンク先にある)',
      !fgHtml.includes('写真を含めて書き出したファイルを預けておけば') &&
        !fgHtml.includes('写真を含めるかどうかも選べます'),
    )
    check(
      'FG-LP 「そのつど」が「その都度」になっている',
      fgHtml.includes('その都度ご自身の操作で行います') && !fgHtml.includes('そのつど'),
    )

    const fgBrowser = await chromium.launch()
    try {
      for (const scheme of ['light', 'dark']) {
        const fgCtx = await fgBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
        })
        const fgPage = await fgCtx.newPage()
        fgPage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
          errors.push(`[pageerror@FG-LP] ${err.message}`)
        })
        await fgPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })

        const fg = await fgPage.evaluate(() => {
          const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          const lum = (c) => {
            const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((n) => srgb(Number(n) / 255))
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const ratio = (a, b) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
            return (x + 0.05) / (y + 0.05)
          }
          const secs = [...document.querySelectorAll('section.sec')]
          const h2s = secs.map((s) => s.querySelector('h2')?.textContent.trim() ?? '')
          const otherSec = secs.find((s) => s.querySelector('.plain-list'))
          const regSec = secs.find((s) => s.querySelector('.free-limit'))
          const planSec = secs.find((s) => (s.querySelector('h2')?.textContent ?? '') === '献立を提案')
          const limit = document.querySelector('.free-limit')
          const surface = getComputedStyle(otherSec).backgroundColor
          const bubbles = [...document.querySelectorAll('.pains li')].map((li) =>
            li.getBoundingClientRect(),
          )
          return {
            h2s,
            // ⑤ Pro版は「他にも、できることたくさん」の直後
            proAfterFree: h2s[h2s.indexOf('他にも、できることたくさん') + 1] === 'Pro版なら、もっと便利に',
            // ③ その他の節の中身
            otherHasEyebrow: !!otherSec.querySelector('.eyebrow'),
            otherLead: otherSec.querySelector('p')?.textContent.trim() ?? '',
            otherFeatureCount: otherSec.querySelectorAll('ul.feature-list > li').length,
            otherFeatureHeads: [...otherSec.querySelectorAll('ul.feature-list > li strong')].map(
              (b) => b.textContent.trim(),
            ),
            otherPlainItems: [...otherSec.querySelectorAll('ul.plain-list > li')].map((li) =>
              li.textContent.trim(),
            ),
            otherMoreCount: otherSec.querySelectorAll('a.more').length,
            otherStartersIsLast: otherSec.lastElementChild?.classList.contains('starters') === true,
            otherStartersTiny: otherSec.querySelector('.starters .tiny')?.textContent.trim() ?? '',
            otherSecH: Math.round(otherSec.getBoundingClientRect().height),
            // 献立表は献立の節へ移した
            planHasSheet: (planSec.textContent ?? '').includes('1週間の献立表を印刷・画像で保存'),
            otherHasSheet: (otherSec.textContent ?? '').includes('献立表'),
            // ⑥ 30品の1文
            limitText: limit?.textContent.trim() ?? '',
            limitIsLastOfRegSec: !!limit && regSec.lastElementChild === limit,
            limitCount: [...document.querySelectorAll('body *')].filter(
              (el) =>
                el.children.length === 0 &&
                el.textContent.includes('無料で登録できるレシピは30品まで'),
            ).length,
            // ① 吹き出し
            painsGaps: bubbles.slice(1).map((b, i) => Math.round(b.top - bubbles[i].bottom)),
            painsFonts: [...document.querySelectorAll('.pains li b')].map((b) =>
              parseFloat(getComputedStyle(b).fontSize),
            ),
            painsUlH: Math.round(document.querySelector('.pains').getBoundingClientRect().height),
            // 重ねても文字が隠れないこと: 上下に重なる組は、左右にずれているか浅い重なりだけ
            painsBadOverlap: bubbles
              .flatMap((a, i) =>
                bubbles.slice(i + 1).map((b, j) => {
                  const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
                  const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                  return ox > 0 && oy > 28 ? `${i + 1}と${i + 2 + j}(横${Math.round(ox)} 縦${Math.round(oy)})` : ''
                }),
              )
              .filter(Boolean),
            docW: document.documentElement.scrollWidth,
            winW: document.documentElement.clientWidth,
            // 新しく足した文字のコントラスト
            contrastPlain: ratio(
              getComputedStyle(otherSec.querySelector('.plain-list li')).color,
              surface,
            ),
            contrastLimit: ratio(getComputedStyle(limit).color, surface),
            contrastTiny: ratio(
              getComputedStyle(otherSec.querySelector('.starters .tiny')).color,
              getComputedStyle(otherSec.querySelector('.starters')).backgroundColor,
            ),
          }
        })

        if (scheme === 'light') {
          check(
            'FG-LP Pro版の節が、無料でできることの節の直後にある',
            fg.proAfterFree,
            fg.h2s.join(' / '),
          )
          check(
            'FG-LP 「他にも」は"その他"の節なので番号つきの見出しラベルを付けない',
            fg.otherHasEyebrow === false,
          )
          check(
            'FG-LP 代表は3件だけ短い説明つき',
            fg.otherFeatureCount === 3 &&
              JSON.stringify(fg.otherFeatureHeads) ===
                JSON.stringify([
                  '登録したレシピをすぐ探せる',
                  '作った日とひとことメモを残せる',
                  '食べられない食材に印を出せる',
                ]),
            JSON.stringify(fg.otherFeatureHeads),
          )
          check(
            'FG-LP 残りは説明を付けずに「できること」を並べてある(5件)',
            fg.otherPlainItems.length === 5 &&
              fg.otherPlainItems.every((t) => t.length <= 24 && !t.includes(':')),
            fg.otherPlainItems.join(' / '),
          )
          check(
            'FG-LP 「くわしく」のリンクは節に1つだけ',
            fg.otherMoreCount === 1,
            `件数=${fg.otherMoreCount}`,
          )
          check(
            'FG-LP 基本レシピの紹介が節のいちばん下にある',
            fg.otherStartersIsLast,
          )
          check(
            'FG-LP 基本レシピの紹介に「30品に数えない」の注釈が付いている',
            fg.otherStartersTiny.startsWith(
              '※最初から入っている基本レシピは、無料で登録できる30品には数えません。',
            ),
            fg.otherStartersTiny,
          )
          check(
            'FG-LP 「レシピでできること」でない献立表は、献立の節へ移してある',
            fg.planHasSheet && fg.otherHasSheet === false,
            `献立の節=${fg.planHasSheet} その他の節に残存=${fg.otherHasSheet}`,
          )
          check(
            'FG-LP 無料30品の1文が登録節のいちばん下にあり、ページで1箇所だけ',
            fg.limitText === '無料で登録できるレシピは30品までです。' &&
              fg.limitIsLastOfRegSec &&
              fg.limitCount === 1,
            `文=${fg.limitText} 最下部=${fg.limitIsLastOfRegSec} 箇所=${fg.limitCount}`,
          )
          check(
            'FG-LP 吹き出しの文字が便FEより大きい(いちばん大きいものが19px以上)',
            Math.max(...fg.painsFonts) >= 19 && Math.min(...fg.painsFonts) >= 17,
            fg.painsFonts.join(','),
          )
        }
        check(
          `FG-LP(${scheme}) 390pxの吹き出しが重なっている(隙間が負)`,
          fg.painsGaps.every((g) => g < 0),
          `隙間=${fg.painsGaps.join(',')} 全体の高さ=${fg.painsUlH}`,
        )
        check(
          `FG-LP(${scheme}) 重ねても文字が隠れない(左右が重なる組の縦の重なりは浅い)`,
          fg.painsBadOverlap.length === 0,
          fg.painsBadOverlap.join(' , '),
        )
        check(`FG-LP(${scheme}) 390pxで横にはみ出さない`, fg.docW <= fg.winW, `scrollW=${fg.docW}`)
        check(
          `FG-LP(${scheme}) 足した文字(羅列・30品の1文・基本レシピの注釈)がAA(4.5:1)以上`,
          fg.contrastPlain >= 4.5 && fg.contrastLimit >= 4.5 && fg.contrastTiny >= 4.5,
          `羅列=${fg.contrastPlain.toFixed(2)} 30品=${fg.contrastLimit.toFixed(2)} 注釈=${fg.contrastTiny.toFixed(2)}`,
        )
        await fgCtx.close()
      }

      // パソコン幅: 2026-08-17 便HF(オーナー指示「幅が狭い画面の時と同じにして」)で、
      // 狭い画面と同じ並びに戻した。「パソコンではもっと詰める」(便FG)という要件は
      // この指示で失効したので、全体の高さ220px以下という上限は外し、
      // 重なっていること自体と、重ねても文字が隠れないことだけを見る。
      // 文字が隠れない判定のしきい値も、狭い画面と同じ並びになった以上は別々に持つ理由が
      // ないので、390pxと同じ「縦の重なり28pxまで」にそろえる
      const fgPcCtx = await fgBrowser.newContext({ viewport: { width: 1280, height: 900 } })
      const fgPcPage = await fgPcCtx.newPage()
      await fgPcPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
      const fgPc = await fgPcPage.evaluate(() => {
        const boxes = [...document.querySelectorAll('.pains li')].map((li) => li.getBoundingClientRect())
        return {
          ulH: Math.round(document.querySelector('.pains').getBoundingClientRect().height),
          gaps: boxes.slice(1).map((b, i) => Math.round(b.top - boxes[i].bottom)),
          bad: boxes
            .flatMap((a, i) =>
              boxes.slice(i + 1).map((b, j) => {
                const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left)
                const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
                return ox > 0 && oy > 28 ? `${i + 1}と${i + 2 + j}(横${Math.round(ox)} 縦${Math.round(oy)})` : ''
              }),
            )
            .filter(Boolean),
        }
      })
      check(
        'FG-LP(PC) 吹き出しが上下に重なっている',
        fgPc.gaps.every((g) => g < 0),
        `高さ=${fgPc.ulH} 隙間=${fgPc.gaps.join(',')}`,
      )
      check('FG-LP(PC) 重ねても文字が隠れない', fgPc.bad.length === 0, fgPc.bad.join(' , '))
      await fgPcCtx.close()
    } finally {
      await fgBrowser.close()
    }

    // --- 「そのほかの使い方を詳しく」の飛び先が実在する ---
    const fgMore = await page.request.get(`${BASE}/about/manual.html`)
    check(
      'FG-LP 「そのほかの使い方を詳しく」の飛び先(/about/manual.html)が実在する',
      fgMore.status() === 200 && fgHtml.includes('>そのほかの使い方を詳しく →</a>'),
      `status=${fgMore.status()}`,
    )
  }

  // ================================================================================
  // --- 便HF(2026-08-17 オーナー実機フィードバック): 紹介ページの大きい画面での見え方3件 ---
  //  ①「登録したレシピを、スマホを触らずに〜買い物メモの作成まで」の2行が、大きい画面で
  //    中央揃えになっていなかった(左に寄り、右に約200pxの空きができていた)。
  //    周りの上部ラベル・見出し・ボタン下の注記はどれも中央揃えなのでここだけ揃わない。
  //    狭い画面では折り返して端まで届くため、左揃えのまま変えない
  //  ②「こんなこと、ありませんか」の吹き出しを、幅が狭い画面のときと同じ並びにする。
  //    パソコン幅だけ散らし幅を広げて深く重ねる指定(便FG)と、2番目だけを左上へ
  //    ずらす指定(便GT)をやめた
  //  ③ 一覧のカードの図の説明文を削除
  // 測り方: 置き場所を決め打ちせず、「左右の余白が同じか(揃っているか)」
  //         「狭い画面と同じ並びか」「文字どうしが重なっていないか」で見る。
  //         狭い画面の見え方は1pxも変えていないので、同じ物差しを両方の幅に当てて突き合わせる
  // ================================================================================
  currentCheck = 'HF-LP'
  {
    const hfBrowser = await chromium.launch()
    try {
      const hfProbe = async (width) => {
        const hfCtx = await hfBrowser.newContext({ viewport: { width, height: 900 } })
        const hfPage = await hfCtx.newPage()
        hfPage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
          errors.push(`[pageerror@HF-LP] ${err.message}`)
        })
        await hfPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
        const got = await hfPage.evaluate(() => {
          // ゼロ幅スペースが混ざっても照合が外れないように落としてから比べる
          const Z = (s) => (s ?? '').replace(/​/g, '').trim()
          // 囲みの「中身を置ける範囲」の左右端(枠線と内側の余白を除いた実際の置き場所)
          const innerX = (el) => {
            const b = el.getBoundingClientRect()
            const cs = getComputedStyle(el)
            return {
              left: b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
              right: b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
            }
          }
          // 文字が実際に描かれている行ごとの矩形(折り返した行も1行ずつ取れる)
          const lineRects = (el) => {
            const out = []
            const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
            let n
            while ((n = walk.nextNode())) {
              if (!Z(n.textContent)) continue
              const range = document.createRange()
              range.selectNodeContents(n)
              for (const b of range.getClientRects()) if (b.width >= 0.5) out.push(b)
            }
            return out
          }
          const overlaps = (rects) => {
            const out = []
            for (let i = 0; i < rects.length; i++) {
              for (let j = i + 1; j < rects.length; j++) {
                const ox = Math.min(rects[i].right, rects[j].right) - Math.max(rects[i].left, rects[j].left)
                const oy = Math.min(rects[i].bottom, rects[j].bottom) - Math.max(rects[i].top, rects[j].top)
                if (ox > 0 && oy > 0) out.push(`${i + 1}と${j + 1}(横${Math.round(ox)} 縦${Math.round(oy)})`)
              }
            }
            return out
          }
          const lead = document.querySelector('p.lead')
          const leadArea = innerX(document.querySelector('main'))
          const ul = document.querySelector('.pains')
          const ulBox = ul.getBoundingClientRect()
          const lis = [...ul.querySelectorAll('li')]
          const boxes = lis.map((li) => li.getBoundingClientRect())
          const painsArea = innerX(ul.closest('section.sec'))
          const cardFig = [...document.querySelectorAll('figure.shot')].find((f) =>
            (f.querySelector('img')?.getAttribute('src') ?? '').endsWith('recipe-cards-photo.webp'),
          )
          return {
            leadText: Z(lead.textContent),
            leadLines: lineRects(lead).map((b) => ({
              leftGap: Math.round(b.left - leadArea.left),
              rightGap: Math.round(leadArea.right - b.right),
            })),
            // 吹き出し4つの並び(一覧の左上から見た位置と大きさ)。
            // 画面幅が違ってもこれが同じなら「狭い画面と同じ並び」
            painsLayout: boxes.map(
              (b) =>
                `${Math.round(b.left - ulBox.left)},${Math.round(b.top - ulBox.top)},${Math.round(
                  b.width,
                )},${Math.round(b.height)}`,
            ),
            // 吹き出し4つをまとめて囲む範囲の、囲みの中での左右の空き
            painsBlockGap: {
              left: Math.round(Math.min(...boxes.map((b) => b.left)) - painsArea.left),
              right: Math.round(painsArea.right - Math.max(...boxes.map((b) => b.right))),
            },
            painsTextOverlaps: overlaps(lis.map((li) => li.querySelector('b').getBoundingClientRect())),
            cardFigFound: !!cardFig,
            cardFigHasCaption: !!cardFig?.querySelector('figcaption'),
            removedCaptionLeft: Z(document.body.textContent).includes(
              '写真があってもなくても同じ形で並びます',
            ),
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          }
        })
        await hfCtx.close()
        return got
      }
      const hfNarrow = await hfProbe(390)
      const hfWide = await hfProbe(1280)

      // --- ① リード文の中央揃え ---
      // 大きい画面ではこの2文は折り返さずに1文=1行で収まるので、
      // 行の左右の余白が同じなら中央に揃っている
      check(
        'HF-LP(PC) リード文「登録したレシピを〜買い物メモの作成まで」の各行が中央に揃っている',
        hfWide.leadText.startsWith('登録したレシピを、') &&
          hfWide.leadText.endsWith('買い物メモの作成まで。') &&
          hfWide.leadLines.length > 0 &&
          hfWide.leadLines.every((l) => Math.abs(l.leftGap - l.rightGap) <= 2),
        `文=${hfWide.leadText.slice(0, 12)}… / 行=${hfWide.leadLines
          .map((l) => `左${l.leftGap}/右${l.rightGap}`)
          .join(' , ')}`,
      )
      // 狭い画面は折り返して端まで届くため左揃えのまま(オーナーの指摘は大きい画面だけ)
      check(
        'HF-LP(390) リード文は左端から始まる(狭い画面の見え方は変えない)',
        hfNarrow.leadLines.length > 0 && hfNarrow.leadLines.every((l) => l.leftGap <= 1),
        `行=${hfNarrow.leadLines.map((l) => `左${l.leftGap}`).join(' , ')}`,
      )

      // --- ② 吹き出しの並び ---
      check(
        'HF-LP 吹き出しの並びが大きい画面と狭い画面で同じ',
        JSON.stringify(hfWide.painsLayout) === JSON.stringify(hfNarrow.painsLayout),
        `390=${hfNarrow.painsLayout.join(' / ')} ／ 1280=${hfWide.painsLayout.join(' / ')}`,
      )
      check(
        'HF-LP(PC) 吹き出しの塊が囲みの中で片側に寄っていない',
        Math.abs(hfWide.painsBlockGap.left - hfWide.painsBlockGap.right) <= 8,
        `左の空き=${hfWide.painsBlockGap.left} 右の空き=${hfWide.painsBlockGap.right}`,
      )
      // 重ねた結果、文字どうしが重なっていないか(枠と余白は重なってよい)
      for (const [hfLabel, hf] of [
        ['390', hfNarrow],
        ['PC', hfWide],
      ]) {
        check(
          `HF-LP(${hfLabel}) 吹き出しの文字どうしが重なっていない`,
          hf.painsTextOverlaps.length === 0,
          hf.painsTextOverlaps.join(' , '),
        )
        check(`HF-LP(${hfLabel}) 横にはみ出していない`, hf.overflow === false)
      }

      // --- ③ 一覧のカードの図の説明文を削除 ---
      // 説明文を付けない図は <figcaption> ごと置かない(使い方ページの nav-tabs.webp と同じ扱い)
      check('HF-LP 一覧のカードの図がある', hfWide.cardFigFound)
      check('HF-LP 一覧のカードの図に説明文を付けていない', hfWide.cardFigHasCaption === false)
      check('HF-LP 消した説明文がページのどこにも残っていない', hfWide.removedCaptionLeft === false)
    } finally {
      await hfBrowser.close()
    }
  }

  // ============================================================================
  // 便HK-1（2026-08-17 オーナー実機フィードバック「ホーム画面に追加のURLを献立ホーム変更」）:
  // 2026-08-17 便HG でアプリのホーム画面を廃止し、献立の「日」が入口になった。
  // 端末のホーム画面に追加したアイコンから開く行き先(manifestのstart_url)も献立を指す。
  //   ・start_url はサイトの入口「/」のままだった。「#/」は献立へ送られるので着く先は同じだが、
  //     オーナーの指示どおり行き先そのものを献立にする
  //   ・すでにホーム画面へ追加してある人が壊れないことが最優先なので、次の2つも合わせて見る
  //     ①サイトの入口を開いても、これまでどおり献立に着くこと
  //      (iPhoneは追加した時点のURLを覚えるので、既存のアイコンは「/」を開き続ける)
  //     ②アイコンの見分け(manifestのid)が今までと同じ「サイトの入口」のままで、
  //      別のアプリとして扱われない＝追加し直しにならないこと
  //      (idを書かないとstart_urlが見分けを兼ねるため、start_urlだけを変えると別アプリになる)
  // ============================================================================
  currentCheck = 'HK-PWA'
  {
    const hkManifest = await (await fetch(`${BASE}/manifest.webmanifest`)).json()
    const hkSiteRoot = new URL('/', BASE).href
    const hkStartUrl = new URL(hkManifest.start_url ?? '/', BASE)
    check(
      'HK-PWA ホーム画面のアイコンから開く行き先(start_url)が献立を指している',
      hkStartUrl.hash.startsWith('#/meal-plan'),
      `start_url=${hkManifest.start_url}`,
    )
    check(
      'HK-PWA 追加済みのアイコンが別のアプリ扱いにならない(見分けidが今までの行き先と同じ)',
      typeof hkManifest.id === 'string' && new URL(hkManifest.id, BASE).href === hkSiteRoot,
      `id=${hkManifest.id} / これまでの見分け=${hkSiteRoot}`,
    )

    const hkBrowser = await chromium.launch()
    try {
      // 実際に開いて着く先を見る。「いまいる場所」は下の並びのどれが選ばれているかで判定する
      // (画面の中身の作りには縛られない・禁じ手④)
      const hkLand = async (url) => {
        const ctx = await hkBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const page = await ctx.newPage()
        page.on('pageerror', (err) => {
          if (
            err.message.includes('cloudflareinsights') ||
            err.message.includes('Access-Control-Allow-Origin')
          )
            return
          errors.push(`[pageerror@HK-PWA] ${err.message}`)
        })
        await page.goto(url, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2200) // 初回シード完了待ち
        const got = {
          hash: await page.evaluate(() => location.hash),
          tab: (
            (await page
              .textContent('[data-app-bottom-bar] a[aria-current="page"]')
              .catch(() => '')) ?? ''
          )
            .replaceAll('​', '')
            .trim(),
        }
        await ctx.close()
        return got
      }
      const hkFromStart = await hkLand(hkStartUrl.href)
      check(
        'HK-PWA その行き先を開くと、献立の画面に着く',
        hkFromStart.hash.startsWith('#/meal-plan') && hkFromStart.tab === '献立',
        `hash=${hkFromStart.hash} / 選ばれている行き先=${hkFromStart.tab}`,
      )
      const hkFromRoot = await hkLand(hkSiteRoot)
      check(
        'HK-PWA すでに追加した人の行き先(サイトの入口)も、これまでどおり献立に着く',
        hkFromRoot.hash.startsWith('#/meal-plan') && hkFromRoot.tab === '献立',
        `hash=${hkFromRoot.hash} / 選ばれている行き先=${hkFromRoot.tab}`,
      )
    } finally {
      await hkBrowser.close()
    }
  }

  // ============================================================================
  // 便HK-2（2026-08-17 オーナー実機フィードバック「吹き出しは、背景？の白いカード部分ごと
  // 細くして、空白を削りたい」）: 便HFで吹き出しの塊を狭い画面と同じ324pxに揃えたが、
  // それを載せている囲み(白いカード)は横いっぱいのままだったため、大きい画面では
  // 塊の左右に146px前後の空きが残っていた。囲みごと細くしてその空きを削る。
  // 測り方(禁じ手④「置き場所への固定」を避ける): 何pxかは測らず、
  //   ①囲みの中に残る左右の空きが、狭い画面のときと同じか(＝余白が削れているか)
  //   ②囲みがページの中で左右均等に置かれているか
  //   ③囲みの中身(見出し・吹き出し・結びの文)の並びが、狭い画面と同じか
  //   ④狭い画面(390)では今までどおりページの幅いっぱいのままか(狭い画面の見え方を変えない)
  //   ⑤中身が囲みからはみ出していないか
  // で見る。
  // ============================================================================
  currentCheck = 'HK-LP'
  {
    const hkLpBrowser = await chromium.launch()
    try {
      const hkLpProbe = async (width) => {
        const ctx = await hkLpBrowser.newContext({ viewport: { width, height: 900 } })
        const page = await ctx.newPage()
        page.on('pageerror', (err) => {
          if (
            err.message.includes('cloudflareinsights') ||
            err.message.includes('Access-Control-Allow-Origin')
          )
            return
          errors.push(`[pageerror@HK-LP] ${err.message}`)
        })
        await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
        const got = await page.evaluate(() => {
          // 枠線と内側の余白を除いた「中身を置ける範囲」
          const innerX = (el) => {
            const b = el.getBoundingClientRect()
            const cs = getComputedStyle(el)
            return {
              left: b.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft),
              right: b.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight),
            }
          }
          const r1 = (n) => Math.round(n * 10) / 10
          const ul = document.querySelector('.pains')
          const sec = ul.closest('section.sec')
          const secBox = sec.getBoundingClientRect()
          const secIn = innerX(sec)
          const mainIn = innerX(document.querySelector('main'))
          const boxes = [...ul.querySelectorAll('li')].map((li) => li.getBoundingClientRect())
          return {
            // 吹き出しの塊が囲みの中に残している左右の空き
            innerGap: {
              left: r1(Math.min(...boxes.map((b) => b.left)) - secIn.left),
              right: r1(secIn.right - Math.max(...boxes.map((b) => b.right))),
            },
            // 囲みのいちばん下に置いた結びの一文（2026-08-18 便HO）。
            // 何pxかではなく「何行で描かれたか」と「1行に置くのに要る幅」で測る
            tail: (() => {
              const p = [...sec.querySelectorAll(':scope > p')].pop()
              if (!p) return null
              const cs = getComputedStyle(p)
              const range = document.createRange()
              range.selectNodeContents(p)
              const rects = [...range.getClientRects()].filter((b) => b.width >= 0.5)
              const lines = new Set(rects.map((b) => Math.round(b.top))).size
              // 折り返さずに1行で置いたときに要る幅（囲みがこれより広いぶんは余白になる）
              const span = document.createElement('span')
              span.style.cssText = `position:absolute;left:-9999px;top:0;white-space:nowrap;visibility:hidden;font:${cs.font};letter-spacing:${cs.letterSpacing}`
              span.textContent = p.textContent
              document.body.appendChild(span)
              const oneLineWidth = r1(span.getBoundingClientRect().width)
              span.remove()
              return {
                text: (p.textContent ?? '').replace(/​/g, '').trim(),
                lines,
                oneLineWidth,
                innerWidth: r1(secIn.right - secIn.left),
              }
            })(),
            // 囲み自体が、本文を置ける範囲の中で左右に空けている幅
            outerGap: {
              left: r1(secBox.left - mainIn.left),
              right: r1(mainIn.right - secBox.right),
            },
            secWidth: r1(secBox.width),
            mainWidth: r1(mainIn.right - mainIn.left),
            // 囲みの中身の並び(囲みの左上から見た位置と幅)。報告に出す用
            parts: [...sec.children].map((el) => {
              const b = el.getBoundingClientRect()
              return `${el.tagName}:${r1(b.left - secBox.left)},${r1(b.top - secBox.top)},${r1(b.width)}`
            }),
            // 中身の順番と、囲みの上端から見た縦の位置。
            // 2026-08-18 便HO: 横幅は画面幅で変わってよい(結びの一文が1行に収まるところまで
            // 囲みを広げるため)ので、比べるのは順番と縦の位置だけにする
            order: [...sec.children].map((el) => {
              const b = el.getBoundingClientRect()
              return `${el.tagName}:${r1(b.top - secBox.top)}`
            }),
            overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          }
        })
        await ctx.close()
        return got
      }
      const hkNarrow = await hkLpProbe(390)
      const hkWide = await hkLpProbe(1280)

      // 2026-08-18 便HO（オーナー実機フィードバック「LPの改行：大画面で『きます』だけは変なので、
      // １行が納まる幅になおしてください。」）: 便HKで囲みを吹き出しの塊ちょうどまで細くした結果、
      // 結びの一文が2行に折り返し、2行目に「きます。」だけが残っていた。
      // 一文が1行に収まるところまで囲みを広げる＝そのぶん空白は戻るので、
      // 便HKの「狭い画面と同じ空きに収める」は「1行に収まるのに要る幅を超えて広げない」に測り直す。
      check(
        'HK-LP(PC) 結びの一文が1行に収まっている(2行目に文末だけが残らない)',
        hkWide.tail != null && hkWide.tail.lines === 1,
        `行数=${hkWide.tail?.lines} / 文=${hkWide.tail?.text}`,
      )
      check(
        // 20pxは「文字1つぶん(15px)＋端数」の保険。囲みが横いっぱいに戻れば大きく超える
        'HK-LP(PC) 吹き出しの囲みは、結びの一文が1行に収まるのに要る幅より広くない(余白を増やしていない)',
        hkWide.tail != null && hkWide.tail.innerWidth - hkWide.tail.oneLineWidth <= 20,
        `中身を置ける幅=${hkWide.tail?.innerWidth} / 1行に要る幅=${hkWide.tail?.oneLineWidth} / 吹き出しの左右の空き=左${hkWide.innerGap.left}・右${hkWide.innerGap.right}`,
      )
      check(
        'HK-LP(PC) 吹き出しの囲みが左右均等に置かれている',
        Math.abs(hkWide.outerGap.left - hkWide.outerGap.right) <= 2,
        `左${hkWide.outerGap.left} / 右${hkWide.outerGap.right}`,
      )
      check(
        'HK-LP 吹き出しの囲みの中身が、大きい画面と狭い画面で同じ順番・同じ縦の位置に並ぶ',
        JSON.stringify(hkWide.order) === JSON.stringify(hkNarrow.order),
        `1280=${hkWide.parts.join(' / ')} ／ 390=${hkNarrow.parts.join(' / ')}`,
      )
      check(
        'HK-LP(390) 吹き出しの囲みは、狭い画面では今までどおりページの幅いっぱい',
        Math.abs(hkNarrow.secWidth - hkNarrow.mainWidth) <= 0.5,
        `囲み=${hkNarrow.secWidth} / 置ける幅=${hkNarrow.mainWidth}`,
      )
      for (const [hkLabel, hk] of [
        ['390', hkNarrow],
        ['PC', hkWide],
      ]) {
        check(
          `HK-LP(${hkLabel}) 吹き出しが囲みからはみ出していない`,
          hk.innerGap.left >= 0 && hk.innerGap.right >= 0,
          `左${hk.innerGap.left} / 右${hk.innerGap.right}`,
        )
        check(`HK-LP(${hkLabel}) 横にはみ出していない`, hk.overflow === false)
      }
    } finally {
      await hkLpBrowser.close()
    }
  }

  // ============================================================================
  // 便FI（2026-08-10 オーナー要望「並行調理ナビ調理中モードの、色で手順入れ替えはいつ
  // 実装しますか？」・docs/69 第3段）: 調理中モードで色を言うと、その品の手順に移る。
  //   ・語彙は画面の実物と同じ **青・緑・ピンク**（原文の「赤」は使わない）
  //   ・移り方は**引き寄せ**＝その手順をいまの位置へ持ってくる。カーソルだけ先へ飛ばすと、
  //     間の手順が「済んだ手順」に化けて、作っていない品が「完成」と出る（実機で確認済み）
  //   ・「青ねぎを散らす」では動かない（発話まるごとの一致だけを見る）
  //   ・記録・タイマーの削除は起きない（docs/69「音声の規律」）
  // ============================================================================
  currentCheck = 'FI-01'
  {
    const fiBrowser = await chromium.launch()
    const fiContext = await fiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    // 声で操作の実機挙動は自動では再現できないため、SpeechRecognition を偽装して
    // onresult に文字列を注入する（FOCUSVOICE-01 と同じ手口）
    await fiContext.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = ''
          this.continuous = false
          this.interimResults = false
        }
        start() {
          window.__fiRecognition = this
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRecognition
      window.__fiEmitVoice = (text) => {
        const r = window.__fiRecognition
        if (!r || typeof r.onresult !== 'function') return false
        r.onresult({ results: [[{ transcript: text }]] })
        return true
      }
    })
    const fiPage = await fiContext.newPage()
    fiPage.on('dialog', (d) => void d.accept())
    fiPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FI] ${err.message}`)
    })
    fiPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FI] ${t}`)
    })
    const fiCounter = () => fiPage.locator('[data-testid="cook-session-counter"]').innerText()
    const fiRecipe = () => fiPage.locator('[data-testid="cook-session-recipe"]').innerText()
    const fiHint = () =>
      fiPage.locator('[data-testid="cook-session"] p', { hasText: ja.focus.micLabel }).first().innerText()
    /** 「声で操作」をONにする（すでにONなら何もしない＝押すとOFFになってしまう） */
    const fiListen = async () => {
      const start = fiPage.locator('button[aria-label="声で操作する"]')
      if ((await start.count()) === 0) return
      await start.click()
      await fiPage.waitForTimeout(300)
    }
    const fiSay = async (word) => {
      const emitted = await fiPage.evaluate((t) => window.__fiEmitVoice(t), word)
      await fiPage.waitForTimeout(450)
      return emitted
    }
    /** 段取りの先頭へ（先頭にいるときは押せないので、そのときは何もしない） */
    const fiToFirst = async () => {
      const button = fiPage.locator('[data-testid="cook-session-to-first"]')
      if (await button.isDisabled()) return
      await button.click()
      await fiPage.waitForTimeout(350)
    }
    /** 段取りを最初から最後までなぞって「どの品の手順が何番目に並んでいるか」を集める */
    const fiWalkPlan = async () => {
      await fiToFirst()
      const seen = []
      for (let i = 0; i < 20; i++) {
        seen.push(await fiRecipe())
        const next = fiPage.locator('[data-testid="cook-session-next"]')
        if ((await next.count()) === 0) break
        await next.click()
        await fiPage.waitForTimeout(180)
      }
      return seen
    }
    /** 作った記録の件数（色で移っただけで記録が付いていないことの確認） */
    const fiCookedLogCount = () =>
      fiPage.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const all = await new Promise((res, rej) => {
          const q = db.transaction('recipes').objectStore('recipes').getAll()
          q.onsuccess = () => res(q.result)
          q.onerror = () => rej(q.error)
        })
        db.close()
        return all
          .filter((r) => String(r.title).startsWith('FI'))
          .reduce((n, r) => n + (r.cookedLogs?.length ?? 0), 0)
      })
    try {
      await fiPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fiPage.waitForTimeout(1800)
      await fiPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps, ingredients = []) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        const idA = await P(store('recipes').add(mk('FI照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('FI煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('FIマリネ', [
          { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
          { text: 'パプリカときゅうりを細切りにする。' },
          { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
        ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await fiPage.goto(`${BASE}/#/cook-navi`)
      await fiPage.reload({ waitUntil: 'networkidle' })
      await fiPage.waitForTimeout(1200)
      await fiPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fiPage.waitForTimeout(700)
      await fiPage.locator('[data-testid="cook-session-start"]').click()
      await fiPage.waitForTimeout(700)
      check(
        'FI-01 前提: 調理中モードが開く',
        (await fiPage.locator('[data-testid="cook-session"]').count()) === 1,
      )
      const fiPlanBefore = await fiWalkPlan()
      // 手順の数は決め打ちしない（2026-08-14 便GK。混在手順を割ると1手順が2工程になるので、
      // 9固定にすると段取りが正しくなった瞬間に落ちる。CLAUDE.md「手順数の決め打ち」）。
      // 見たいのは「3品ぶんの手順がすべて段取りに載っていること」
      const fiTitlesAll = ['FI照り焼き', 'FI煮物', 'FIマリネ']
      const fiCountBefore = Object.fromEntries(
        fiTitlesAll.map((t) => [t, fiPlanBefore.filter((x) => x === t).length]),
      )
      check(
        'FI-01 前提: 3品ぶんの手順がすべて段取りに載っている（1品も欠けない）',
        fiPlanBefore.length >= 9 && fiTitlesAll.every((t) => fiCountBefore[t] >= 3),
        fiPlanBefore.join(','),
      )

      // --- FI-01: 下部の行に、声で言う色の名前が出ている（色の帯だけでは何と言えばよいか決まらない） ---
      const fiWords = await fiPage.locator('[data-testid="cook-session-color-word"]').allInnerTexts()
      check(
        'FI-01 他の品の行に色の名前（青・緑・ピンクのいずれか）が出ている',
        fiWords.length === 2 && fiWords.every((w) => ['青', '緑', 'ピンク'].includes(w.trim())),
        fiWords.join('/'),
      )
      check(
        'FI-01 画面に「赤」は出さない（実装の色は青・緑・ピンク。原文の赤と食い違わせない）',
        !fiWords.some((w) => w.includes('赤')),
        fiWords.join('/'),
      )

      // --- FI-02: 案内文に色の言い方が載っている ---
      //     2026-08-11 便FO: 案内は「声で操作」をONにしている間だけ出す（利用者テスト
      //     「声を使わないのに、画面の上5行がずっと声の説明で埋まっている」）ので、先にONにする
      currentCheck = 'FI-02'
      await fiListen()
      const fiHintText = await fiHint()
      check(
        'FI-02 案内に「色を言うとその色の品の手順を先にする」が載っている',
        fiHintText.includes('「青」「緑」「ピンク」と言うとその色の品の手順を先にする'),
        fiHintText,
      )
      check(
        'FI-02 案内でも「赤」で案内しない',
        !fiHintText.includes('「赤」'),
        fiHintText,
      )

      // --- FI-03: 色を言うと、その品の手順が開く（引き寄せ） ---
      currentCheck = 'FI-03'
      await fiToFirst()
      await fiListen()
      const fiFirstRecipe = await fiRecipe()
      // いま開いていない品の色を1つ選ぶ（並びは段取り次第なので画面から取る）
      const fiTargetWord = (await fiPage.locator('[data-testid="cook-session-color-word"]').allInnerTexts())[0].trim()
      const fiTargetTitle = (
        await fiPage.locator('[data-testid="cook-session-other-row"]').first().innerText()
      )
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s.startsWith('FI'))
      check('FI-03 前提: 声で操作をONにできた', (await fiHint()).includes('聞いています'), await fiHint())
      const fiEmitted = await fiSay(fiTargetWord)
      check(
        `FI-03 「${fiTargetWord}」でその色の品の手順が開く`,
        fiEmitted && (await fiRecipe()) === fiTargetTitle,
        `言った=${fiTargetWord} 期待=${fiTargetTitle} 実際=${await fiRecipe()}`,
      )
      check(
        'FI-03 引き寄せなので、その手順が段取りの先頭に来る（手順を飛ばさない）',
        /^段取り 1\//.test(await fiCounter()),
        await fiCounter(),
      )
      check(
        'FI-03 手応えに、どの品に移ったかが名前で出る',
        (await fiHint()).includes(`${fiTargetTitle}の手順を先にしました`),
        await fiHint(),
      )
      check(
        'FI-03 開いていた品は「完成」にならない（作っていない品を完成と出さない）',
        !(await fiPage.locator('[data-testid="cook-session-others"]').innerText()).includes('完成'),
        await fiPage.locator('[data-testid="cook-session-others"]').innerText(),
      )
      // どの行に出るかは段取り次第なので、行の位置で決め打ちしない（2026-08-14 便GK。
      // CLAUDE.md「要素の置き場所への固定」＝どこに出ていても同じ判定になる形にする）
      check(
        'FI-03 開いていた手順は、すぐ次に残っている（「次へ」で戻れる）',
        (await fiPage.locator('[data-testid="cook-session-other-row"]').allInnerTexts()).some((t) =>
          t.includes(fiFirstRecipe),
        ),
        (await fiPage.locator('[data-testid="cook-session-other-row"]').allInnerTexts()).join(' / '),
      )

      // --- FI-04: 別の色を言えば移り直せる（可逆）。手順は1つも消えない ---
      currentCheck = 'FI-04'
      const fiOtherWord = ['青', '緑', 'ピンク'].filter((w) => w !== fiTargetWord)
      let fiSwitched = ''
      for (const word of fiOtherWord) {
        const before = await fiRecipe()
        await fiSay(word)
        const after = await fiRecipe()
        if (after !== before) {
          fiSwitched = word
          break
        }
      }
      check('FI-04 別の色を言うと、その品の手順に移り直せる', fiSwitched !== '', `試した=${fiOtherWord.join('/')}`)
      const fiPlanAfter = await fiWalkPlan()
      check(
        'FI-04 色で移っても手順は1つも消えない（9手順のまま）',
        fiPlanAfter.length === fiPlanBefore.length,
        `前=${fiPlanBefore.length} 後=${fiPlanAfter.length}`,
      )
      check(
        'FI-04 品ごとの手順の数も変わらない（色で移る前と同じ内訳）',
        fiTitlesAll.every((t) => fiPlanAfter.filter((x) => x === t).length === fiCountBefore[t]),
        `前=${JSON.stringify(fiCountBefore)} 後=${fiPlanAfter.join(',')}`,
      )

      // --- FI-05: 「青ねぎ」等では誤爆しない（発話まるごとの一致だけを見る） ---
      currentCheck = 'FI-05'
      await fiToFirst()
      for (const phrase of ['青ねぎを散らす', '緑黄色野菜を加える', 'ピンクペッパーをふる']) {
        const beforeRecipe = await fiRecipe()
        const beforeCounter = await fiCounter()
        await fiSay(phrase)
        check(
          `FI-05 「${phrase}」では手順が動かない`,
          (await fiRecipe()) === beforeRecipe && (await fiCounter()) === beforeCounter,
          `前=${beforeCounter}/${beforeRecipe} 後=${await fiCounter()}/${await fiRecipe()}`,
        )
      }

      // --- FI-06: 記録・タイマーの削除は起きない（docs/69「音声の規律」） ---
      currentCheck = 'FI-06'
      await fiSay('3分タイマー')
      const fiTimerCount = () =>
        fiPage.locator('[data-testid="cook-session"] button[aria-label*="タイマーを調整"]').count()
      const fiTimersBefore = await fiTimerCount()
      check('FI-06 前提: タイマーを1本動かせた', fiTimersBefore >= 1, `本数=${fiTimersBefore}`)
      for (const word of ['青', '緑', 'ピンク']) await fiSay(word)
      check(
        'FI-06 色を言ってもタイマーは消えない',
        (await fiTimerCount()) === fiTimersBefore,
        `前=${fiTimersBefore} 後=${await fiTimerCount()}`,
      )
      check('FI-06 色を言っても作った記録は付かない', (await fiCookedLogCount()) === 0, `記録=${await fiCookedLogCount()}`)
      check(
        'FI-06 色を言っても調理中モードは閉じない',
        (await fiPage.locator('[data-testid="cook-session"]').count()) === 1,
      )

      // --- FI-07: 下部の行のタップは今までどおり「見るだけ」（EL-03 の非退行） ---
      currentCheck = 'FI-07'
      const fiTapBefore = `${await fiCounter()}/${await fiRecipe()}`
      await fiPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await fiPage.waitForTimeout(350)
      check(
        'FI-07 行をタップしても調理中の手順は変わらない（色の目印を押しても移らない）',
        `${await fiCounter()}/${await fiRecipe()}` === fiTapBefore,
        `前=${fiTapBefore} 後=${await fiCounter()}/${await fiRecipe()}`,
      )
      check(
        'FI-07 タップで開くのは全文だけ',
        (await fiPage.locator('[data-testid="cook-session-peek"]').count()) === 1,
      )

      // --- FI-08: 読み込み直しても並べ替えが残る（2026-08-10 司令部裁定で保存対象にした）。
      // 保存していなかったときは、読み込み直すと並びだけ元へ戻り、カーソルより前の品が
      // 「1度も作っていないのに完成」と出た。その症状そのものを検査にする ---
      currentCheck = 'FI-08'
      await fiToFirst()
      await fiListen()
      const fiReloadWord = (await fiPage.locator('[data-testid="cook-session-color-word"]').allInnerTexts())[0].trim()
      await fiSay(fiReloadWord)
      const fiBeforeReload = `${await fiCounter()}/${await fiRecipe()}`
      check(
        'FI-08 前提: 色で引き寄せた状態にできた',
        /^段取り 1\//.test(await fiCounter()),
        fiBeforeReload,
      )
      await fiPage.reload({ waitUntil: 'networkidle' })
      await fiPage.waitForTimeout(1800)
      check(
        'FI-08 読み込み直しても調理中モードは開いたまま',
        (await fiPage.locator('[data-testid="cook-session"]').count()) === 1,
      )
      check(
        'FI-08 読み込み直しても、引き寄せた手順が開いたまま（並びが元に戻らない）',
        `${await fiCounter()}/${await fiRecipe()}` === fiBeforeReload,
        `前=${fiBeforeReload} 後=${await fiCounter()}/${await fiRecipe()}`,
      )
      check(
        'FI-08 読み込み直しても「作っていない品が完成」と出ない',
        !(await fiPage.locator('[data-testid="cook-session-others"]').innerText()).includes('完成'),
        await fiPage.locator('[data-testid="cook-session-others"]').innerText(),
      )
      const fiPlanReloaded = await fiWalkPlan()
      check(
        'FI-08 読み込み直しても手順は9つのまま（1つも消えない）',
        fiPlanReloaded.length === fiPlanBefore.length,
        `前=${fiPlanBefore.length} 後=${fiPlanReloaded.length}`,
      )
      check(
        'FI-08 読み込み直しても品ごとの手順の数は変わらない（開く前と同じ内訳）',
        fiTitlesAll.every((t) => fiPlanReloaded.filter((x) => x === t).length === fiCountBefore[t]),
        `前=${JSON.stringify(fiCountBefore)} 後=${fiPlanReloaded.join(',')}`,
      )
    } finally {
      await fiBrowser.close()
    }
  }
