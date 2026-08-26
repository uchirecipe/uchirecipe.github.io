// ==========================================================================================
// 便LJ（2026-08-26）: 便LG・LH・LI の申し送りの片付け
// この中の節: LJCOOK-01, LJCOOK-02, LJCOOK-03, LJCOOK-04, LJPHOTO-01
// ==========================================================================================
import './_shared.mjs'

  // ==========================================================================================
  // 便LJ・①: レシピ詳細**以外**の「作った！」のトーストに「作った記録の一覧へ」を添える
  //
  // オーナー原文「レシピ詳細以外からの「作った！」は内容の入力が省略されています。
  // 記録した後に出るトーストに、「作った記録の一覧にいく」選択が欲しいです。」
  //
  // 便LGが並行調理ナビの「まとめて作った！」だけを直した（見張りは LG-04）。
  // 残っていた献立側の4か所をここで測る:
  //   LJCOOK-01 日タブ・1品ずつの「作った！」（整理モードの中）
  //   LJCOOK-02 日タブ・「全て作った！」
  //   LJCOOK-03 週タブ・過ぎた日の「作った記録を追加」
  //   LJCOOK-04 月タブ・日の窓の「作った記録を追加」
  //
  // どの節でも見るのは同じ3つ:
  //   ①トーストに ja.common.cookedHistoryLink が出る（文言は ja.ts から読む＝書き写さない）
  //   ②**6,000msで消える前に押せる**（押すまでの実測時間を判定に出す）
  //   ③押すと「作った記録の一覧」へ着く
  // ==========================================================================================
  currentCheck = 'LJCOOK-01'
  {
    const ljBrowser = await chromium.launch()
    try {
      const ljCtx = await ljBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const ljPage = await ljCtx.newPage()
      ljPage.on('dialog', (d) => void d.accept())
      ljPage.on('pageerror', (err) => errors.push(`[pageerror@LJ] ${err.message}`))
      await ljPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ljPage.waitForTimeout(2000)

      const ljSeed = await ljPage.evaluate(async () => {
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
        const iso = (dt) =>
          `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        const now = new Date()
        const today = iso(now)
        // 過ぎた日は「今月の1日」を使う（今日が1日なら今日）。前日を使うと今日が月初のとき
        // 前の月のマスになり、月タブで開けない（曜日にも月替わりにも寄りかからない形）
        const past = now.getDate() > 1 ? iso(new Date(now.getFullYear(), now.getMonth(), 1)) : today
        const mk = (title) => ({
          title,
          servings: 2,
          effortLevel: 'normal',
          tags: [],
          ingredients: [{ name: 'LJにんじん', amount: '1', unit: '本' }],
          steps: [{ text: '切る。' }],
          isFavorite: false,
          cookedLogs: [],
          searchWords: [],
          isStarter: false,
          updatedAt: Date.now(),
        })
        const ids = []
        for (let i = 1; i <= 3; i++) ids.push(await P(store('recipes').add(mk(`LJ料理${i}`))))
        let addedAt = Date.now()
        for (const id of ids) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        // 月タブ（月間献立）は買い切り版の機能なので、解錠しておかないとカレンダーが出ない
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(
          store('settings').put({
            ...cur,
            id: 1,
            proCode: 'UR-E2E-TEST-ONLY',
            proActivatedAt: Date.now(),
          }),
        )
        db.close()
        return { today, past, ids }
      })
      // 生のIndexedDBへ書いたので必ず読み込み直す（CLAUDE.md 禁じ手⑥）
      await ljPage.goto(`${BASE}/#/meal-plan`)
      await ljPage.reload({ waitUntil: 'networkidle' })
      await ljPage.waitForTimeout(2200)

      /** トーストの行き先を「出る→消える前に押せる→着く」の順で測る道具（4か所で同じ形で使う） */
      const ljCheckHistoryLink = async (label, shownAt) => {
        const link = ljPage.locator('[data-testid="toast-link"]')
        check(
          `${currentCheck} ${label}のトーストに「${ja.common.cookedHistoryLink}」が出る`,
          (await link.count()) === 1,
          stripZwspText(await ljPage.textContent('body')).slice(0, 200),
        )
        if ((await link.count()) !== 1) return
        check(
          `${currentCheck} ${label}の行き先の文字が ja.ts のとおり（画面の日本語を書き写さない）`,
          stripZwspText(await link.first().innerText()) === ja.common.cookedHistoryLink,
          stripZwspText(await link.first().innerText()),
        )
        await link.first().click()
        const pressedMs = Date.now() - shownAt
        await ljPage.waitForTimeout(900)
        check(
          `${currentCheck} ${label}のトーストは消える前に押せる（押すまで${pressedMs}ms・自動で消えるのは6000ms）`,
          pressedMs < 6000,
          `${pressedMs}ms`,
        )
        check(
          `${currentCheck} ${label}の行き先は「作った記録の一覧」`,
          ljPage.url().includes('#/history') &&
            stripZwspText(await ljPage.textContent('body')).includes(ja.history.title),
          ljPage.url(),
        )
      }

      // --- LJCOOK-01: 日タブ・1品ずつの「作った！」 ---
      await openDayOrganize(ljPage)
      const ljOneCooked = ljPage
        .locator('li', { hasText: 'LJ料理1' })
        .first()
        .getByRole('button', { name: ja.mealPlan.todayMarkCooked, exact: true })
      check('LJCOOK-01 前提: 今日の献立に1品ずつの「作った！」がある', (await ljOneCooked.count()) === 1)
      await ljOneCooked.first().click()
      const ljOneShownAt = Date.now()
      await ljPage.waitForTimeout(700)
      check(
        'LJCOOK-01 「元に戻す」も同時に出る（行き先を足しても取り消しは消えない）',
        (await ljPage.locator('[data-testid="toast-action"]').count()) === 1,
      )
      // 2つ並んでも押す大きさが 44px を割らず、390px幅からはみ出さない
      const ljOneBtns = await ljPage.evaluate(() =>
        ['toast-action', 'toast-link'].map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { id, h: Math.round(r.height), right: Math.round(r.right) }
        }),
      )
      check(
        'LJCOOK-01 2つ並んでも、どちらも高さ44px以上で画面からはみ出さない',
        ljOneBtns.every((b) => b && b.h >= 44 && b.right <= 390),
        JSON.stringify(ljOneBtns),
      )
      await ljCheckHistoryLink('日タブの「作った！」', ljOneShownAt)
      // 「作った記録の一覧」の戻るで、日タブへ帰れる（画面の中のリンクと同じ道を通っている）
      await ljPage.getByRole('button', { name: ja.common.back }).first().click()
      await ljPage.waitForTimeout(1600)
      check(
        'LJCOOK-01 一覧の「戻る」で献立へ帰る（画面の中のリンクと同じ帰り道）',
        ljPage.url().includes('#/meal-plan'),
        ljPage.url(),
      )

      // --- LJCOOK-02: 日タブ・「全て作った！」 ---
      currentCheck = 'LJCOOK-02'
      await ljPage.goto(`${BASE}/#/meal-plan`)
      await ljPage.reload({ waitUntil: 'networkidle' })
      await ljPage.waitForTimeout(2000)
      await openDayOrganize(ljPage)
      const ljAll = ljPage.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked, exact: true })
      check('LJCOOK-02 前提: 「全て作った！」がある', (await ljAll.count()) === 1)
      await ljAll.first().click()
      // 確認の窓は仕掛けが自動で「記録をつける」を押す
      await ljPage.waitForTimeout(1200)
      const ljAllShownAt = Date.now()
      await ljCheckHistoryLink('日タブの「全て作った！」', ljAllShownAt)

      // --- LJCOOK-03: 週タブ・過ぎた日の「作った記録を追加」 ---
      // 週は月曜始まりなので、今日が月曜だとこの週に過ぎた日が1日も無い。
      // **前の週へ1つ送ってから**測る＝今日が何曜日でも必ず過ぎた日がある
      currentCheck = 'LJCOOK-03'
      await ljPage.goto(`${BASE}/#/meal-plan`)
      await ljPage.reload({ waitUntil: 'networkidle' })
      await ljPage.waitForTimeout(2000)
      await ljPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await ljPage.waitForTimeout(1200)
      await ljPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
      await ljPage.waitForTimeout(1200)
      const ljWeekDates = await ljPage.evaluate(() =>
        [...document.querySelectorAll('section[data-date]')].map((el) => el.dataset.date),
      )
      check(
        'LJCOOK-03 前提: 前の週の7日ぶんのカードが出ている',
        ljWeekDates.length === 7,
        JSON.stringify(ljWeekDates),
      )
      const ljWeekPast = ljWeekDates[0]
      check(
        'LJCOOK-03 前提: 週タブの過ぎた日を編集モードにできた',
        await openWeekDayEdit(ljPage, ljWeekPast),
        `日=${ljWeekPast}`,
      )
      const ljWeekAdd = ljPage.locator(`[data-testid="past-record-add"][data-date="${ljWeekPast}"]`)
      check('LJCOOK-03 前提: 「作った記録を追加」がある', (await ljWeekAdd.count()) === 1)
      await ljWeekAdd.first().click()
      await ljPage.waitForTimeout(900)
      await ljPage.locator('[data-testid="recipe-picker"] li', { hasText: 'LJ料理2' }).first().click()
      const ljWeekShownAt = Date.now()
      await ljPage.waitForTimeout(900)
      await ljCheckHistoryLink('週タブの「作った記録を追加」', ljWeekShownAt)

      // --- LJCOOK-04: 月タブ・日の窓の「作った記録を追加」 ---
      currentCheck = 'LJCOOK-04'
      await ljPage.goto(`${BASE}/#/meal-plan`)
      await ljPage.reload({ waitUntil: 'networkidle' })
      await ljPage.waitForTimeout(2000)
      await ljPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await ljPage.waitForTimeout(1600)
      await ljPage.locator(`[data-date="${ljSeed.past}"]`).first().click()
      await ljPage.waitForTimeout(1400)
      check(
        'LJCOOK-04 前提: 月タブの日の窓を編集モードにできた',
        await openMonthDayEdit(ljPage),
        `日=${ljSeed.past}`,
      )
      const ljMonthAdd = ljPage.locator(`[data-testid="past-record-add"][data-date="${ljSeed.past}"]`)
      check('LJCOOK-04 前提: 日の窓に「作った記録を追加」がある', (await ljMonthAdd.count()) === 1)
      await ljMonthAdd.first().click()
      await ljPage.waitForTimeout(900)
      await ljPage.locator('[data-testid="recipe-picker"] li', { hasText: 'LJ料理3' }).first().click()
      const ljMonthShownAt = Date.now()
      await ljPage.waitForTimeout(900)
      // 日の窓（z-50）よりトーストのほうが上（z-70）＝窓の裏に隠れない
      const ljToastAbove = await ljPage.evaluate(() => {
        const link = document.querySelector('[data-testid="toast-link"]')
        if (!link) return null
        const r = link.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return top ? top.closest('[data-testid="toast-link"]') != null : false
      })
      check(
        'LJCOOK-04 日の窓が開いていても、行き先のボタンが窓の裏に隠れない',
        ljToastAbove === true,
        String(ljToastAbove),
      )
      await ljCheckHistoryLink('月タブの「作った記録を追加」', ljMonthShownAt)
    } finally {
      await ljBrowser.close()
    }
  }

  // ==========================================================================================
  // 便LJ・②: 写真だけを変えたときも「未保存の変更」として扱う（不具合の修正）
  //
  // 直す前の実測（レシピの編集で1つだけ変えて上の「戻る」を押す）:
  //   写真を差し替える／写真を消す／見える範囲を変える … 引き止めが出ない（下書きも無い）
  //   写真ではなくアイコンを出す設定／アイコンを選ぶ／料理名 … 出る
  // ＝写真を選んだだけで画面を離れると、引き止めも下書きも無いまま消えていた。
  //
  // 直し方は src/pages/RecipeFormPage.tsx の photoBaselineRef に書いてある
  // （写真は比較の文字列に混ぜず、入れ物が同じかどうかだけで見る）。
  // ソースの側の見張りは scripts/tests/ui-source-guards.mjs の LJ-1。
  // ==========================================================================================
  currentCheck = 'LJPHOTO-01'
  {
    const ljpBrowser = await chromium.launch()
    try {
      const ljpCtx = await ljpBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const ljpPage = await ljpCtx.newPage()
      ljpPage.on('pageerror', (err) => errors.push(`[pageerror@LJPHOTO] ${err.message}`))
      // 引き止めの窓は自分で読んで自分で押す（仕掛けの自動押しに流されない）
      await ljpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ljpPage.waitForTimeout(2000)
      await setConfirmAnswer(ljpPage, 'off')
      const ljpFirst = makeTestPng(200, 200)
      const ljpSecond = makeTestPng(300, 180)
      const ljpId = await ljpPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => {
              const keys = r.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAllKeys()
              keys.onsuccess = () => resolve(keys.result[0] ?? null)
              keys.onerror = () => reject(keys.error)
            }
            r.onerror = () => reject(r.error)
          }),
      )
      check('LJPHOTO-01 前提: 編集するレシピのidを取れた', Number.isInteger(ljpId), `id=${ljpId}`)

      const ljpOpenEdit = async () => {
        await ljpPage.goto(`${BASE}/#/recipes/${ljpId}/edit`, { waitUntil: 'networkidle' })
        await ljpPage.reload({ waitUntil: 'networkidle' })
        await ljpPage.waitForTimeout(1600)
        await setConfirmAnswer(ljpPage, 'off')
      }
      /** 上の「戻る」を押して、引き止めが出るか・窓の文はどうかを読む（出たら留まる） */
      const ljpProbe = async () => {
        await ljpPage.getByRole('button', { name: ja.common.back, exact: true }).first().click()
        await ljpPage.waitForTimeout(800)
        const dialog = ljpPage.locator('[data-testid="confirm"]')
        const shown = (await dialog.count()) === 1
        const body = shown ? stripZwspText(await dialog.first().textContent()) : ''
        if (shown) {
          await ljpPage.locator('[data-testid="confirm-cancel"]').first().click()
          await ljpPage.waitForTimeout(500)
        }
        return { shown, body }
      }

      // 写真つきの状態を作る（アルバムの入力欄＝2つ目の file 欄）
      await ljpOpenEdit()
      await ljpPage
        .locator('input[type=file]')
        .nth(1)
        .setInputFiles({ name: 'lj1.png', mimeType: 'image/png', buffer: ljpFirst })
      await ljpPage.waitForTimeout(1200)
      await ljpPage.getByRole('button', { name: ja.form.save }).first().click()
      await ljpPage.waitForTimeout(1800)
      check(
        'LJPHOTO-01 前提: 写真つきで保存できた（引き止めに邪魔されない）',
        !/\/edit/.test(ljpPage.url()),
        ljpPage.url(),
      )

      // ①写真を差し替えただけ
      await ljpOpenEdit()
      await ljpPage
        .locator('input[type=file]')
        .nth(1)
        .setInputFiles({ name: 'lj2.png', mimeType: 'image/png', buffer: ljpSecond })
      await ljpPage.waitForTimeout(1200)
      const ljpReplaced = await ljpProbe()
      check(
        'LJPHOTO-01 写真を差し替えただけでも、離れようとすると引き止められる',
        ljpReplaced.shown,
        `窓=${ljpReplaced.body.slice(0, 160)}`,
      )
      // 引き止めの本文は「書きかけは端末に残る」と言い切っている。写真だけは残せないので、
      // 写真が変わっているときは必ずその一行が要る（規約F: その場で嘘にしない）
      check(
        'LJPHOTO-01 写真が変わっているときは「写真は書きかけに残せない」ことも言う',
        ljpReplaced.body.includes(stripZwspText(ja.form.leaveUnsavedPhotoNote)),
        `窓=${ljpReplaced.body.slice(0, 240)}`,
      )

      // ②見える範囲だけを変えた
      await ljpOpenEdit()
      await ljpPage.locator('[data-testid="photo-focus-open-form"]').first().click()
      await ljpPage.waitForTimeout(700)
      const ljpBox = await ljpPage.locator('[data-testid="photo-focus-picker"]').first().boundingBox()
      await ljpPage.mouse.click(ljpBox.x + ljpBox.width * 0.8, ljpBox.y + ljpBox.height * 0.2)
      await ljpPage.waitForTimeout(400)
      await ljpPage.locator('[data-testid="photo-focus-apply"]').first().click()
      await ljpPage.waitForTimeout(700)
      const ljpFocused = await ljpProbe()
      check(
        'LJPHOTO-01 見える範囲を変えただけでも、離れようとすると引き止められる',
        ljpFocused.shown,
        `窓=${ljpFocused.body.slice(0, 160)}`,
      )

      // ③写真を消した
      await ljpOpenEdit()
      await ljpPage.getByRole('button', { name: ja.form.photoRemove }).first().click()
      await ljpPage.waitForTimeout(700)
      const ljpRemoved = await ljpProbe()
      check(
        'LJPHOTO-01 写真を消しただけでも、離れようとすると引き止められる',
        ljpRemoved.shown,
        `窓=${ljpRemoved.body.slice(0, 160)}`,
      )

      // ④何も変えていなければ、今までどおり引き止めない（普段の行き来の邪魔をしない）
      await ljpOpenEdit()
      const ljpUntouched = await ljpProbe()
      check(
        'LJPHOTO-01 何も変えていなければ引き止めない（写真を見ただけで邪魔をしない）',
        !ljpUntouched.shown,
        `窓=${ljpUntouched.body.slice(0, 160)}`,
      )
      // 文字だけを直したときは、写真の一行は出ない（要らない説明を足さない）
      await ljpOpenEdit()
      await ljpPage.getByLabel(ja.form.nameLabel).first().fill('LJ写真の見張り用')
      await ljpPage.waitForTimeout(600)
      const ljpTextOnly = await ljpProbe()
      check(
        'LJPHOTO-01 文字だけを直したときは引き止めるが、写真の一行は出さない',
        ljpTextOnly.shown && !ljpTextOnly.body.includes(stripZwspText(ja.form.leaveUnsavedPhotoNote)),
        `窓=${ljpTextOnly.body.slice(0, 240)}`,
      )
    } finally {
      await ljpBrowser.close()
    }
  }
