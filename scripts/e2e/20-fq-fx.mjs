// ==========================================================================================
// e2e の節: 便FP〜FX
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
// この中の節: FQ-01, FP-01, FP-02, FP-03, FP-04, FR-01, FR-02, FS-01, FS-02, FS-03, FS-05, FS-08, FS-07, FS-04, FS-06, FT-01, FT-02, FT-03, FT-04, FT-07, FT-06, FT-05, FU-01, FU-02, FU-05, GK-01, GK-02, FU-04, FU-06, FU-03, FX-01, FX-11, FX-04, FX-02, FX-03, FX-10, FX-09, FX-05, FX-08, FX-12
// ==========================================================================================
import './_shared.mjs'


  // --- FQ-01〜04: ご飯を材料に持つのに用意する手順が無い9品の注意書き(2026-08-11 便FQ) ---
  //     テキストペルソナ3体が独立に「ご飯を炊く工程が段取りに無い」と指摘した件。
  //     オーナー裁定=A案(手順は増やさず、レシピの注意書きに1行足す)。足した1行が
  //     **レシピ詳細と段取りの両方**に出ることを、9品それぞれについて見る。
  currentCheck = 'FQ-01'
  {
    const fqBrowser = await chromium.launch()
    // 手順本文・メモは文節の切れ目にゼロ幅スペースが入る(ja-phrase)。突き合わせる前に取り除く
    const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
    // 9品と、それぞれに足した注意書きの原文（1文字でも変わったらここで落ちる）
    const FQ_NOTES = [
      ['カレーライス', '・ご飯を炊く時間は調理時間に含んでいない。ルーが仕上がったらすぐかけられるよう、4杯分を先に炊いておくこと。'],
      ['ツナキャベツ丼', 'ご飯を炊く時間は調理時間に含んでいない。あえた具をのせて仕上げるので、2杯分を先に用意しておくこと。'],
      ['親子丼', '・ご飯を炊く時間は調理時間に含んでいない。卵をとじたら熱いうちに盛り付けるので、2杯分を先に炊いておくこと。'],
      ['チャーハン', '・ご飯を炊く時間は調理時間に含んでいない。炒め始めるまでに2杯分を用意しておくこと。'],
      ['牛丼', 'ご飯を炊く時間は調理時間に含んでいない。煮汁ごとご飯にのせて仕上げるので、2杯分を先に炊いておくこと。'],
      ['鶏そぼろ丼', '・ご飯を炊く時間は調理時間に含んでいない。そぼろと炒り卵をのせるので、2杯分を先に炊いておくこと。'],
      ['オムライス', '・ご飯を炊く時間は調理時間に含んでいない。ほぐしながら炒めるので、温かいご飯2杯分を先に用意しておくこと。'],
      ['肉巻きおにぎり', '・ご飯を炊く時間は調理時間に含んでいない。にぎるところから始まるので、2杯分を先に炊いておくこと。'],
      ['冷や汁', '・ご飯を炊く時間は調理時間に含んでいない。ご飯は温かいままでも冷めたものでもよいので、2杯分を先に炊いておくこと。'],
    ]
    try {
      const fqContext = await fqBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fqPage = await fqContext.newPage()
      fqPage.on('dialog', (d) => void d.accept())
      fqPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FQ] ${err.message}`)
      })
      fqPage.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@FQ] ${t}`)
      })

      await fqPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fqPage.waitForTimeout(2000)
      // 同梱レシピのidを引き、並行調理ナビを使えるようにしておく
      const ids = await fqPage.evaluate(async (titles) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const all = await P(store('recipes').getAll())
        const map = {}
        for (const t of titles) {
          const r = all.find((x) => x.title === t)
          if (r) map[t] = r.id
        }
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return map
      }, FQ_NOTES.map(([t]) => t))
      check(
        'FQ-01 対象9品が同梱レシピとして見つかる',
        FQ_NOTES.every(([t]) => typeof ids[t] === 'number'),
        JSON.stringify(ids),
      )

      // ---- レシピ詳細の「メモ」に、その品の注意書きが原文で出る ----
      const detailMissing = []
      for (const [title, note] of FQ_NOTES) {
        if (typeof ids[title] !== 'number') { detailMissing.push(`${title}(id無し)`); continue }
        await fqPage.goto(`${BASE}/#/recipes/${ids[title]}`)
        await fqPage.waitForTimeout(600)
        const body = noZw(await fqPage.textContent('main'))
        if (!body.includes(note)) detailMissing.push(title)
      }
      check('FQ-02 9品それぞれのレシピ詳細に、足した注意書きが出る', detailMissing.length === 0, JSON.stringify(detailMissing))

      // ---- 段取り（並行調理ナビ）にも同じ行が出る。ナビは最大3品なので3品ずつ組む ----
      const naviMissing = []
      const naviWrongStep = []
      for (let b = 0; b < FQ_NOTES.length; b += 3) {
        const batch = FQ_NOTES.slice(b, b + 3)
        await fqPage.evaluate(async (recipeIds) => {
          const openDb = () =>
            new Promise((resolve, reject) => {
              const r = indexedDB.open('uchi-recipe')
              r.onsuccess = () => resolve(r.result)
              r.onerror = () => reject(r.error)
            })
          const db = await openDb()
          const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
          const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
          await P(store('todayList').clear())
          let addedAt = Date.now()
          for (const id of recipeIds) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
          db.close()
        }, batch.map(([t]) => ids[t]))
        // 作りかけの段取り(選んだ品・表示中か)は端末に覚えられている(2026-08-12 便FT で
        // localStorage へ移した)。組を替えるときは覚え書きを消してから開く。覚えていた選択が
        // 今日の献立と食い違うと選択が空に整えられ、「段取りを作る」が押せないまま（disabled）になる
        await fqPage.goto(`${BASE}/#/recipes`)
        await fqPage.waitForTimeout(400)
        await fqPage.evaluate(() => {
          sessionStorage.clear()
          localStorage.removeItem('uchi-recipe-cook-navi-session')
        })
        await fqPage.goto(`${BASE}/#/cook-navi`)
        await fqPage.reload({ waitUntil: 'networkidle' })
        await fqPage.waitForTimeout(1200)
        await fqPage.getByRole('button', { name: ja.cookNavi.build }).click()
        await fqPage.waitForTimeout(900)
        const cards = (
          await fqPage.locator('ol > li').evaluateAll((els) => els.map((el) => el.textContent))
        ).map(noZw)
        for (const [title, note] of batch) {
          const hits = cards.filter((t) => t.includes(note))
          if (hits.length !== 1) { naviMissing.push(`${title}(${hits.length}枚)`); continue }
          // 「作り始めに読める位置」＝その品の最初の手順に出る。
          // 段取りは品をまたいで並ぶので、同じ品の手順カードの中で最初のものかを見る
          const own = cards.filter((t) => t.includes(title))
          if (own.length > 0 && !own[0].includes(note)) naviWrongStep.push(title)
        }
      }
      check('FQ-03 9品それぞれの注意書きが、段取りのカード1枚だけに出る', naviMissing.length === 0, JSON.stringify(naviMissing))
      check('FQ-04 その1枚は、その品の最初の手順（作り始めに読める位置）', naviWrongStep.length === 0, JSON.stringify(naviWrongStep))
      await fqContext.close()
    } finally {
      await fqBrowser.close()
    }
  }

  // --- FP-01〜04: 実際にアプリを操作した利用者テストの報告(2026-08-11 便FP) ---
  //     FP-01 献立の「＋ 今日の献立を探す」からレシピ一覧が選択モードで開き、3品をまとめて
  //           今日の献立へ入れられる(レシピ詳細を1度も開かずに済む)
  //     FP-02 一覧の「選択」で何ができるかが、1品も選ばないうちから読める
  //           (今日の献立に入れる・書き出す・削除する)
  //     FP-03 食事の振り分け窓: 3つの食事は同じ見た目(どれも選択済みに見えない)・
  //           旧「決めない」は何が起きるかが名前と説明で分かる
  //     FP-04 「今日の献立に追加」で入れた品が、週タブで料理の種別どおりの行に入る
  //           (おひたし=副菜・味噌汁=汁物。以前は全部主菜だった)
  currentCheck = 'FP-01'
  {
    const fpBrowser = await chromium.launch()
    const watchPage = (p, tag) => {
      p.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${tag}] ${err.message}`)
      })
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@${tag}] ${t}`)
      })
    }
    /** 今日の日付(端末側の暦で算出。e2eに曜日・月替わりの前提を置かない) */
    const todayIso = (p) =>
      p.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
    /** 今日の献立の予定を、レシピ名つきで読む(mealPlans × recipes をIndexedDB直読み) */
    const readTodayPlan = (p, date) =>
      p.evaluate(async (iso) => {
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
        const plans = await P(db.transaction('mealPlans').objectStore('mealPlans').getAll())
        const recipes = await P(db.transaction('recipes').objectStore('recipes').getAll())
        const todayList = await P(db.transaction('todayList').objectStore('todayList').getAll())
        const titleOf = (id) => recipes.find((r) => r.id === id)?.title ?? `?${id}`
        db.close()
        return {
          plan: plans
            .filter((e) => e.date === iso)
            .map((e) => ({ slot: e.slot, role: e.role ?? 'main', title: titleOf(e.recipeId) })),
          today: todayList.map((t) => titleOf(t.recipeId)),
        }
      }, date)

    try {
      // ===== FP-01: 献立の「今日の献立を探す」→ まとめて3品(実操作) =====
      {
        const ctx = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FP-01')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2200) // 初回シード待ち

        await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(900)
        check(
          'FP-01 前提: 今日の献立は空で「今日の献立を探す」が出ている',
          // 2026-08-17 便HI: 空の日は「今日の献立」の見出しごと出さず、ボタンだけを残す
          (await p.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0 &&
            (await p.getByRole('button', { name: ja.mealPlan.todayChooseButton }).count()) === 1,
        )
        await p.getByRole('button', { name: ja.mealPlan.todayChooseButton }).click()
        await p.waitForTimeout(1200)

        // 報告②: 飛び先が「ただのレシピ一覧」で、選んでいる最中だと分かる表示も決定ボタンも無かった
        const banner = p.getByTestId('select-for-today-banner')
        check(
          'FP-01 飛び先で「今日の献立に入れるレシピを選んでいます」が出る',
          (await banner.count()) === 1 &&
            stripZwspText(await banner.innerText()).includes(ja.recipes.selectForTodayTitle),
        )
        const decide = p.getByTestId('add-selected-to-today')
        check(
          'FP-01 決定ボタンが最初から見えていて、1品も選ばないうちは押せない',
          (await decide.count()) === 1 && (await decide.isDisabled()),
        )
        // 2026-08-17 便HJ: 削除・書き出しは「選び終わる」の窓の中へ移ったので、
        // 献立から来たときはその窓の入口ごと出さないこと(行き先が決まっているため)で測る
        check(
          'FP-01 献立に入れに来た選択モードでは、削除・書き出しのボタンを出さない',
          (await p.getByTestId('selection-finish').count()) === 0 &&
            (await p.getByTestId('selection-actions-delete').count()) === 0 &&
            (await p.getByTestId('selection-actions-export').count()) === 0,
        )

        // 3品をタップして選ぶ(レシピ詳細は1度も開かない)
        const TITLES = ['肉じゃが', 'ほうれん草のおひたし', '豆腐とわかめの味噌汁']
        for (const t of TITLES) {
          await p.getByRole('button', { name: t, exact: true }).first().click()
          await p.waitForTimeout(200)
        }
        check(
          'FP-01 選んだ品数が決定ボタンに出る(件数表示)',
          ((await decide.innerText()) ?? '').includes('選択したレシピ3品を今日の献立に入れる'),
          await decide.innerText(),
        )

        await decide.click()
        await p.waitForTimeout(500)
        check(
          'FP-01 食事の振り分けは品ごとではなく1回だけ聞く',
          ((await p.textContent('body')) ?? '').includes('選んだ3品を朝食・昼食・夕食のどれに入れますか？'),
        )
        await p.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
        await p.waitForTimeout(1600)

        // 入れ終わったら献立へ戻り、何品どこへ入ったかを知らせる
        check('FP-01 入れ終わったら献立の画面へ戻る', p.url().includes('#/meal-plan'), p.url())
        const afterBody = (await p.textContent('body')) ?? ''
        check(
          'FP-01 「今日の夕食に3品を入れました」と知らせる',
          afterBody.includes('今日の夕食に3品を入れました'),
        )
        check(
          'FP-01 今日の献立に3品とも並んでいる',
          TITLES.every((t) => afterBody.includes(t)) &&
            (await p.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 1,
        )
        check('FP-01 2品以上あるので並行調理ナビの入口も出る', afterBody.includes('並行調理ナビ'))

        // FP-04: 週の予定の行は、料理の種別どおりの役割で入る
        const iso = await todayIso(p)
        const state = await readTodayPlan(p, iso)
        const roleOf = (title) => state.plan.find((e) => e.title === title)?.role
        check(
          'FP-04 まとめて入れても、行の役割はレシピの種別どおり(主菜/副菜/汁物)',
          roleOf('肉じゃが') === 'main' &&
            roleOf('ほうれん草のおひたし') === 'side' &&
            roleOf('豆腐とわかめの味噌汁') === 'soup',
          JSON.stringify(state.plan),
        )
        check(
          'FP-01 同じ食事(夕食)に3行そろって入る',
          state.plan.filter((e) => e.slot === 'dinner').length === 3,
          JSON.stringify(state.plan),
        )

        // 週タブの画面でも、副菜・汁物の行として出ている(報告④の見え方そのもの)
        await p.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
        await openAllWeekDays(p) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await p.waitForTimeout(1200)
        const domRole = async (title) => {
          const row = p.locator('[data-testid="plan-row"]').filter({ hasText: title }).first()
          return (await row.count()) === 0 ? null : await row.getAttribute('data-role')
        }
        check(
          'FP-04 週の画面でも、おひたしは副菜の行・味噌汁は汁物の行(主菜にしない)',
          (await domRole('ほうれん草のおひたし')) === 'side' &&
            (await domRole('豆腐とわかめの味噌汁')) === 'soup' &&
            (await domRole('肉じゃが')) === 'main',
          `おひたし=${await domRole('ほうれん草のおひたし')} / 味噌汁=${await domRole('豆腐とわかめの味噌汁')}`,
        )

        // 1品でも入っていると空状態のボタンは消えるので、日タブに足す入口が残っていること
        await p.getByRole('button', { name: '日', exact: true }).first().click()
        await p.waitForTimeout(900)
        check(
          'FP-01 献立に品が入っている状態でも、まとめて足す入口が残る',
          (await p.getByTestId('today-add-more').count()) === 1,
        )
        await p.getByTestId('today-add-more').click()
        await p.waitForTimeout(1100)
        check(
          'FP-01 その入口も選択モードのレシピ一覧へ行く',
          (await p.getByTestId('select-for-today-banner').count()) === 1,
        )
        await ctx.close()
      }

      // ===== FP-02: 一覧の「選択」で何ができるかが読める + まとめて献立へ入る =====
      currentCheck = 'FP-02'
      {
        const ctx = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FP-02')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2200)

        await p.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
        await p.waitForTimeout(500)
        // 報告①: 選ぶ機能があるのに、使い道が書き出しと削除しかないと思わなかった。
        // 2026-08-17 便HJ: 3つの道は「選び終わる」を押した先の窓に移したので、
        // 案内文もその流れを言う形に書き直した(1品も選ばないうちから読める点は変えない)
        const hint = p.getByTestId('select-actions-hint')
        check(
          'FP-02 1品も選ばないうちに、選択でできる3つが名前で出ている',
          (await hint.count()) === 1 &&
            ((await hint.innerText()) ?? '')
              .replace(/​/g, '')
              .includes(ja.recipes.selectActionsHint),
          await hint.innerText().catch(() => ''),
        )

        await p.getByRole('button', { name: '肉じゃが', exact: true }).first().click()
        await p.waitForTimeout(200)
        await p.getByRole('button', { name: 'ほうれん草のおひたし', exact: true }).first().click()
        await p.waitForTimeout(400)
        await p.getByTestId('selection-finish').click()
        await p.waitForTimeout(400)
        check(
          'FP-02 選び終わると3つの操作が実際に並ぶ(献立・書き出し・削除)',
          (await p.getByTestId('selection-actions-today').count()) === 1 &&
            (await p.getByTestId('selection-actions-export').count()) === 1 &&
            (await p.getByTestId('selection-actions-delete').count()) === 1,
        )

        await p.getByTestId('selection-actions-today').click()
        await p.waitForTimeout(500)
        // 食事を決めない方でもまとめて入る(今週の予定には入れない)
        await p.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
        await p.waitForTimeout(1200)
        check(
          'FP-02 一覧から入れたときは一覧に留まり、結果をその場で知らせる',
          p.url().includes('#/recipes') &&
            ((await p.textContent('body')) ?? '').includes('今日の献立に2品を入れました'),
        )
        const iso2 = await todayIso(p)
        const state2 = await readTodayPlan(p, iso2)
        check(
          'FP-02 食事を決めない方は今日の献立にだけ入り、今週の予定には入らない',
          state2.today.includes('肉じゃが') &&
            state2.today.includes('ほうれん草のおひたし') &&
            state2.plan.length === 0,
          JSON.stringify(state2),
        )

        // 入れたあとも選択モードは続く(書き出し・削除と同じ作法。続けて選び直せる)。
        // 2026-08-17 便HJ: 抜ける操作は入口と同じ場所のボタン(selection-exit)、
        // 献立に入れる操作は「選び終わる」の窓の中＝どちらも一覧の上には並んでいない
        check(
          'FP-02 入れたあとも選択モードのまま続けられる(選択だけ解除される)',
          (await p.getByTestId('selection-exit').count()) === 1 &&
            (await p.getByTestId('selection-actions-today').count()) === 0 &&
            (await p.getByTestId('selection-finish').isDisabled()),
        )
        // すでに入っている品を選び直しても、黙って二重に増やさない
        await p.getByRole('button', { name: '肉じゃが', exact: true }).first().click()
        await p.waitForTimeout(300)
        await p.getByTestId('selection-finish').click()
        await p.waitForTimeout(400)
        await p.getByTestId('selection-actions-today').click()
        await p.waitForTimeout(400)
        await p.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
        await p.waitForTimeout(1000)
        check(
          'FP-02 すでに入っている品は増やさず、その旨を伝える',
          ((await p.textContent('body')) ?? '').includes(
            '選んだ1品は、すでに今日の献立に入っています',
          ),
        )
        const state3 = await readTodayPlan(p, iso2)
        check(
          'FP-02 今日の献立の件数は増えていない',
          state3.today.filter((t) => t === '肉じゃが').length === 1,
          JSON.stringify(state3.today),
        )
        await ctx.close()
      }

      // ===== FP-03: 食事の振り分け窓（報告③） =====
      currentCheck = 'FP-03'
      {
        const ctx = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FP-03')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2200)
        await p.getByText('ほうれん草のおひたし', { exact: true }).first().click()
        await p.waitForTimeout(800)
        await p.getByRole('button', { name: ja.detail.todayAdd }).click()
        await p.waitForTimeout(500)

        // 「夕食だけが塗られている」＝もう選ばれているのか推奨なのか読めない、という報告への対応。
        // 3つのボタンの見た目(class)がそろっていることで「まだ何も選ばれていない」と言い切る
        const slotClasses = await p
          .locator('[data-testid="today-slot-button"]')
          .evaluateAll((els) => els.map((el) => el.className))
        check(
          'FP-03 朝食・昼食・夕食は同じ見た目(どれも選択済みに見えない)',
          slotClasses.length === 3 && new Set(slotClasses).size === 1,
          JSON.stringify(slotClasses),
        )
        check(
          'FP-03 アクセント色で塗られた食事ボタンが1つも無い',
          slotClasses.every((c) => !c.includes('bg-accent')),
          JSON.stringify(slotClasses),
        )

        const dialogText = (await p.getByRole('dialog').innerText()) ?? ''
        check(
          'FP-03 「決めない」ではなく、何が起きるかを名前で言う',
          !dialogText.includes('決めない') &&
            dialogText.includes(ja.detail.todaySlotUndecided),
          dialogText,
        )
        check(
          'FP-03 3つの食事との違い(今週の予定に入るかどうか)が書いてある',
          dialogText.includes(ja.detail.todaySlotUndecidedHint),
          dialogText,
        )

        await p.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
        await p.waitForTimeout(900)
        check(
          'FP-03 押したら結果を知らせる(無言で閉じない)',
          stripZwspText(await p.textContent('body')).includes(ja.detail.todaySlotUndecidedAddedToast),
        )
        const iso3 = await todayIso(p)
        const state4 = await readTodayPlan(p, iso3)
        check(
          'FP-03 押すと今日の献立には入り、今週の予定には入らない',
          state4.today.includes('ほうれん草のおひたし') && state4.plan.length === 0,
          JSON.stringify(state4),
        )
        await ctx.close()
      }

      // ===== FP-04: 1品ずつの経路でも、行の役割はレシピの種別どおり =====
      currentCheck = 'FP-04'
      {
        const ctx = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FP-04')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2200)
        // 報告と同じ顔ぶれ: 主菜・副菜(おひたし)・汁物(味噌汁)を1品ずつ夕食へ入れる
        for (const title of ['肉じゃが', 'ほうれん草のおひたし', '豆腐とわかめの味噌汁']) {
          await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await p.waitForTimeout(600)
          await p.getByText(title, { exact: true }).first().click()
          await p.waitForTimeout(700)
          await p.getByRole('button', { name: ja.detail.todayAdd }).click()
          await p.waitForTimeout(300)
          await p.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
          await p.waitForTimeout(700)
        }
        const iso4 = await todayIso(p)
        const state5 = await readTodayPlan(p, iso4)
        const roleOf = (title) => state5.plan.find((e) => e.title === title)?.role
        check(
          'FP-04 1品ずつ入れても、おひたしは副菜・味噌汁は汁物(全部主菜にならない)',
          roleOf('肉じゃが') === 'main' &&
            roleOf('ほうれん草のおひたし') === 'side' &&
            roleOf('豆腐とわかめの味噌汁') === 'soup',
          JSON.stringify(state5.plan),
        )
        check(
          'FP-04 主菜の行が2つ以上に増えていない(役割の取り違えで枠が埋まらない)',
          state5.plan.filter((e) => e.role === 'main').length === 1,
          JSON.stringify(state5.plan),
        )
        await ctx.close()
      }
    } finally {
      await fpBrowser.close()
    }
  }

  // --- FR-01〜02: 今日の献立を入れ替えてナビへ戻ると「段取りを作る」が押せなくなる ---
  //     (2026-08-12 便FR・利用者テストの実操作。検査用の細工なしで、画面のボタンだけで再現する)
  //     報告された手順: ①レシピ詳細の「今日の献立に追加」で3品入れる ②ナビで段取りを作る
  //     ③気が変わって3品とも別の品に入れ替える ④ナビへ戻る
  //     症状: 「0品を選択中」で「段取りを作る」が押せない。もう一度どこかへ行って戻ると
  //           今度は3品が選ばれて押せる＝同じ画面が来るたびに違う状態で開く。
  //     真因: 覚えていた選択があると初回の自動選択を止める札が立つが、覚えていた選択が
  //           整合で1品も残らず落ちた後も札は立ったままだった。次に開くと覚え書きが消えて
  //           いる(1品も選んでいない状態は保存しない)ため初回扱いになり自動選択が効く。
  //     FR-02 は直しの副作用の確認: 自分で選択を全部外した状態は勝手に選び直さない。
  currentCheck = 'FR-01'
  {
    const frBrowser = await chromium.launch()
    try {
      const ctx = await frBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const p = await ctx.newPage()
      p.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FR] ${err.message}`)
      })
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@FR] ${t}`)
      })
      /** レシピ詳細を開いて「今日の献立に追加」(食事は決めない) */
      const addToToday = async (title) => {
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(500)
        await p.getByText(title, { exact: true }).first().click()
        await p.waitForTimeout(700)
        await p.getByRole('button', { name: ja.detail.todayAdd, exact: true }).click()
        await p.waitForTimeout(400)
        await p.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
        await p.waitForTimeout(500)
      }
      /** レシピ詳細の「今日の献立に追加済み」をもう一度押して外す */
      const removeFromToday = async (title) => {
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(500)
        await p.getByText(title, { exact: true }).first().click()
        await p.waitForTimeout(700)
        await p.getByRole('button', { name: /今日の献立に追加済み/ }).click()
        await p.waitForTimeout(600)
      }
      /** ナビを開いて「何品を選択中か」「段取りを作るが押せるか」を読む */
      const openNavi = async () => {
        await p.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1500)
        const build = p.getByRole('button', { name: ja.cookNavi.build })
        const notice = p.getByTestId('navi-selection-dropped')
        return {
          count: Number(((await p.textContent('body')) ?? '').match(/(\d+)品を選択中/)?.[1] ?? -1),
          canBuild: (await build.count()) > 0 ? !(await build.isDisabled()) : false,
          notice: (await notice.count()) > 0 ? await notice.innerText() : '',
          selected: await p.locator('button[aria-pressed="true"]').allInnerTexts(),
        }
      }

      await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(2500) // 初回シード待ち
      // ナビはPro機能。解錠だけは前準備として直接書き込む(再現手順そのものには関係しない)
      await p.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const cur = (await P(db.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(
          db
            .transaction('settings', 'readwrite')
            .objectStore('settings')
            .put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
        )
        db.close()
      })

      const FIRST = ['肉じゃが', 'ほうれん草のおひたし', '豆腐とわかめの味噌汁']
      const SECOND = ['カレーライス', 'ポテトサラダ', 'きんぴらごぼう']

      // ① 3品入れる → ② ナビで段取りを作る
      for (const t of FIRST) await addToToday(t)
      const before = await openNavi()
      check('FR-01 前提: 3品入れてナビを開くと3品が選ばれている', before.count === 3, JSON.stringify(before))
      await p.getByRole('button', { name: ja.cookNavi.build }).click()
      await p.waitForTimeout(900)
      check(
        'FR-01 前提: 段取りが出る',
        ((await p.textContent('body')) ?? '').includes('組み合わせる3品'),
      )

      // ③ 気が変わって3品とも入れ替える(「今日の献立に追加済み」で外し、別の3品を追加)
      for (const t of FIRST) await removeFromToday(t)
      for (const t of SECOND) await addToToday(t)

      // ④ ナビへ戻る(画面移動だけ)
      const first = await openNavi()
      check(
        'FR-01 入れ替えて戻っても0品にならない(今の献立から3品が選ばれる)',
        first.count === 3,
        JSON.stringify(first),
      )
      check('FR-01 「段取りを作る」がそのまま押せる', first.canBuild, JSON.stringify(first))
      check(
        'FR-01 選ばれているのは入れ替えた後の3品',
        SECOND.every((t) => first.selected.some((s) => s.includes(t))),
        JSON.stringify(first.selected),
      )
      check(
        'FR-01 前の品を外したことを黙って済ませない(その場に1行出す)',
        first.notice.includes('選び直しました'),
        first.notice,
      )
      // 段取りは組み直さない＝利用者が選んでいない品で勝手に手順を並べない
      check(
        'FR-01 段取りは自動では組み直さない(「段取りを作る」を押すまで出ない)',
        !((await p.textContent('body')) ?? '').includes('組み合わせる3品'),
      )

      // もう一度どこかへ行って戻る＝同じ画面が同じ状態で開く(開くたびに結果が変わらない)
      await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(800)
      const second = await openNavi()
      check(
        'FR-01 もう一度出入りしても同じ状態で開く(3品・押せる)',
        second.count === 3 && second.canBuild,
        JSON.stringify(second),
      )

      // FR-02: 自分で選択を全部外したら、その画面にいる間は勝手に選び直さない
      currentCheck = 'FR-02'
      for (const t of SECOND) {
        await p.getByRole('button', { name: new RegExp(t) }).first().click()
        await p.waitForTimeout(250)
      }
      const cleared = await p.textContent('body')
      check(
        'FR-02 手で全部外したら0品のまま(勝手に選び直さない)',
        (cleared ?? '').includes('0品を選択中'),
        (cleared ?? '').match(/\d+品を選択中/)?.[0] ?? '',
      )
      check(
        'FR-02 0品では「段取りを作る」は押せない',
        await p.getByRole('button', { name: ja.cookNavi.build }).isDisabled(),
      )
      await ctx.close()
    } finally {
      await frBrowser.close()
    }
  }


  // --- FS-01〜08: 実際にアプリを操作した利用者テスト(コンロ1口)の報告8件(2026-08-12 便FS) ---
  //     FS-01 「今日の夕食に戻しました」と言われた品が、夕食の行として日タブに戻る
  //     FS-02 待ちの「この間に、次の手作業を進められます」を同じ品の続きには出さない
  //     FS-03 材料の左に、閉じていない「(」が見えない
  //     FS-04 検索窓のプレースホルダが幅390pxで切れない
  //     FS-05 タイマーが動いている間は「タイマーを始める」を残さず、残り時間に置き換える
  //     FS-06 「電子レンジ」で引ける(手順本文まるごとは検索対象にしない)
  //     FS-07 対応外の言葉だったことが画面に出る
  //     FS-08 手順を移すと段取りの番号が付け直されることが画面に書いてある
  currentCheck = 'FS-01'
  {
    const fsBrowser2 = await chromium.launch()
    const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
    const watch = (p, tag) => {
      p.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${tag}] ${err.message}`)
      })
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@${tag}] ${t}`)
      })
    }
    /** ナビ(Pro機能)の解錠だけ前準備として直接書き込む */
    const unlockPro = (p) =>
      p.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const cur = (await P(db.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(
          db
            .transaction('settings', 'readwrite')
            .objectStore('settings')
            .put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
        )
        db.close()
      })

    try {
      // ===== FS-01: 「今日の夕食に戻しました」と言われた品が夕食の行として戻る =====
      {
        const ctx = await fsBrowser2.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watch(p, 'FS-01')
        p.on('dialog', (d) => void d.accept())
        /** レシピ詳細を開いて「今日の献立に追加」→「夕食」（報告の操作そのまま） */
        const addToDinner = async (title) => {
          await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await p.waitForTimeout(500)
          await p.getByText(title, { exact: true }).first().click()
          await p.waitForTimeout(700)
          await p.getByRole('button', { name: ja.detail.todayAdd, exact: true }).click()
          await p.waitForTimeout(300)
          await p.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
          await p.waitForTimeout(500)
          return (await p.textContent('body')) ?? ''
        }
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2000) // 初回シード待ち
        await addToDinner('肉じゃが')

        // ② 献立の日タブでその品の「作った！」を押す
        await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(900)
        const plannedBefore = noZw(await p.locator('[data-testid="day-planned"]').innerText())
        check(
          'FS-01 前提: 作る前は「今週の献立の予定／夕食」に並ぶ',
          plannedBefore.includes('夕食') && plannedBefore.includes('肉じゃが'),
          plannedBefore,
        )
        // 2026-08-20 便II・⑥: 行の「作った！」は整理モードの中に移った
        await openDayOrganize(p)
        await p.getByRole('button', { name: '作った！', exact: true }).first().click()
        await p.waitForTimeout(900)
        check(
          'FS-01 前提: 作ったら日タブから消える（作った後は予定でなく記録）',
          (await p.locator('[data-testid="day-planned"]').count()) === 0 &&
            (await p.locator('[data-testid="day-picked"]').count()) === 0,
        )

        // ③ もう一度、同じレシピを「今日の献立に追加」→「夕食」
        const toast = await addToDinner('肉じゃが')
        check(
          'FS-01 入れ直したことと、記録が残ることを知らせる',
          toast.includes('今日の夕食に戻しました（作った記録はそのまま残ります）'),
        )
        await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(900)
        const plannedAfter = noZw(
          (await p.locator('[data-testid="day-planned"]').count()) > 0
            ? await p.locator('[data-testid="day-planned"]').innerText()
            : '',
        )
        check(
          'FS-01 言われたとおり「今週の献立の予定／夕食」の行として戻る',
          plannedAfter.includes('夕食') && plannedAfter.includes('肉じゃが'),
          plannedAfter,
        )
        const pickedCount = await p.locator('[data-testid="day-picked"]').count()
        check(
          'FS-01 食事の決まっていない「レシピ一覧から選択中」には入らない',
          pickedCount === 0,
          `選択中の枠=${pickedCount}`,
        )
        check(
          'FS-01 「夕食に入れる」を選び直す行が出ない（夕食と言われた直後に夕食を選ばせない）',
          !((await p.textContent('body')) ?? '').includes('夕食に入れる'),
        )
        const rows = await p.evaluate(async () => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => res(r.result)
            r.onerror = () => rej(r.error)
          })
          const P = (req) =>
            new Promise((res, rej) => {
              req.onsuccess = () => res(req.result)
              req.onerror = () => rej(req.error)
            })
          const plans = await P(db.transaction('mealPlans').objectStore('mealPlans').getAll())
          const recipes = await P(db.transaction('recipes').objectStore('recipes').getAll())
          const t = new Date()
          const iso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
          const id = recipes.find((r) => r.title === '肉じゃが')?.id
          const cooked = (recipes.find((r) => r.id === id)?.cookedLogs ?? []).filter(
            (l) => l.date === iso,
          ).length
          db.close()
          return {
            dinner: plans.filter((e) => e.date === iso && e.slot === 'dinner' && e.recipeId === id)
              .length,
            cooked,
          }
        })
        check('FS-01 週の予定の行は増えない（週タブで同じ品が2行にならない）', rows.dinner === 1, `行=${rows.dinner}`)
        check('FS-01 作った記録は消えない', rows.cooked === 1, `記録=${rows.cooked}`)
        await ctx.close()
      }

      // ===== FS-02/03/05/08: 並行調理ナビ（報告と同じ3品の段取り） =====
      {
        currentCheck = 'FS-02'
        const ctx = await fsBrowser2.newContext({ viewport: { width: 390, height: 844 } })
        // 声の操作のボタンが出る環境にして、対応外の言葉の知らせ（FS-07）も同じ画面で確かめる
        await ctx.addInitScript(() => {
          class FakeRecognition {
            start() {
              window.__fakeRecognition = this
            }
            stop() {}
            abort() {}
          }
          window.SpeechRecognition = FakeRecognition
          window.webkitSpeechRecognition = FakeRecognition
          window.__emitVoice = (text) => {
            const r = window.__fakeRecognition
            if (!r || typeof r.onresult !== 'function') return false
            r.onresult({ results: [[{ transcript: text }]] })
            return true
          }
        })
        const p = await ctx.newPage()
        watch(p, 'FS-02')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2000)
        await unlockPro(p)
        // 報告と同じ顔ぶれ（味噌汁の「2分温める」の次が同じ鍋の続きになる組み合わせ）
        await p.evaluate(async () => {
          const db = await new Promise((res, rej) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => res(r.result)
            r.onerror = () => rej(r.error)
          })
          const P = (req) =>
            new Promise((res, rej) => {
              req.onsuccess = () => res(req.result)
              req.onerror = () => rej(req.error)
            })
          const recipes = await P(db.transaction('recipes').objectStore('recipes').getAll())
          const store = db.transaction('todayList', 'readwrite').objectStore('todayList')
          let addedAt = Date.now()
          for (const title of ['肉じゃが', 'カレーライス', '豆腐とわかめの味噌汁']) {
            const id = recipes.find((r) => r.title === title)?.id
            if (id != null) await P(store.add({ recipeId: id, addedAt: addedAt++ }))
          }
          db.close()
        })
        await p.goto(`${BASE}/#/cook-navi`)
        await p.reload({ waitUntil: 'networkidle' })
        await p.waitForTimeout(1500)
        await p.getByRole('button', { name: ja.cookNavi.build }).click()
        await p.waitForTimeout(900)

        const waitBlocks = await p.$$eval('[data-testid="navi-wait-block"]', (els) =>
          els.map((el) => ({
            card: (el.closest('li')?.innerText ?? '').replace(/\u200B/g, ''),
            block: (el.innerText ?? '').replace(/\u200B/g, ''),
          })),
        )
        const HINT = 'この間に、次の手作業を進められます'
        /**
         * 「次が同じ鍋の続き」になる待ちを見る。
         *
         * 2026-08-14 便GK まではこの標本の「沸いたら…豆腐とわかめを入れて2分温める。」が
         * その形だった。いまは**この手順が2つに割れる**（豆腐を切って入れる手作業＋2分の待ち）
         * ので、割れた待ちの中には別の品の手作業が本当に入る＝「この間に〜」は嘘ではなくなった。
         * 同じ形は、ナビが差し込む「火にかけたまま、沸くのを待つ」に移っている
         * （次に来るのは同じ鍋の「沸いたら豆腐とわかめを入れる」）。そこで見る。
         */
        const soup = waitBlocks.find((w) => w.card.includes('沸くのを待つ'))
        const nikujaga = waitBlocks.find((w) => w.card.includes('15分煮る'))
        check('FS-02 前提: 味噌汁の「沸くのを待つ」の待ちが段取りに出る', soup !== undefined)
        check(
          'FS-02 次が同じ鍋の続きの待ちには「この間に〜」を出さない',
          soup !== undefined && !soup.block.includes(HINT),
          soup?.block,
        )
        check(
          'FS-02 待ちの中に別の品の手作業が入る待ちには今までどおり出す',
          nikujaga !== undefined && nikujaga.block.includes(HINT),
          nikujaga?.block,
        )

        // FS-03: 材料の枠は角を丸めない（左だけの線＋角丸が「(」に見えていた）
        currentCheck = 'FS-03'
        const ingBox = await p.$eval('[data-testid="navi-step-ingredients"]', (el) => {
          const cs = getComputedStyle(el)
          return {
            radius: [cs.borderTopLeftRadius, cs.borderBottomLeftRadius].join('/'),
            leftWidth: cs.borderLeftWidth,
          }
        })
        check(
          'FS-03 段取りの材料の枠に角丸が付いていない（左の線が弧にならない）',
          ingBox.radius === '0px/0px' && ingBox.leftWidth === '2px',
          JSON.stringify(ingBox),
        )

        // FS-05: タイマーが動いている間は「タイマーを始める」を残さない
        currentCheck = 'FS-05'
        // カードは id（navi-step-レシピ-手順）で掴む。「タイマーを始める」で絞り込むと、
        // 押した後にその条件から外れて**別のカード**を指してしまう
        const timerCardId = await p.$$eval('[data-testid="navi-wait-block"]', (els) => {
          const li = els.map((el) => el.closest('li')).find((el) => el?.innerText.includes('タイマーを始める'))
          return li?.id ?? ''
        })
        check('FS-05 前提: 待ちのブロックに「タイマーを始める」がある', timerCardId !== '', timerCardId)
        const timerCard = p.locator(`#${timerCardId}`)
        await timerCard.getByRole('button', { name: ja.cookNavi.startTimer }).click()
        await p.waitForTimeout(900)
        const cardAfter = noZw(await timerCard.innerText())
        check(
          'FS-05 動いていることと残り時間が、始めたその場に出る',
          /タイマー動作中 残り\d+:\d\d/.test(cardAfter),
          cardAfter,
        )
        check(
          'FS-05 押しても何も起きない「タイマーを始める」が残らない',
          !cardAfter.includes('タイマーを始める'),
          cardAfter,
        )
        // 同じブロックの残り時間の表示は1つだけ（二重に立てていない）
        check(
          'FS-05 待ちのブロックの残り時間は1つだけ',
          (await timerCard.locator('[data-testid="navi-wait-timer-running"]').count()) === 1,
        )

        // FS-08: 手順を移すと段取りの番号が付け直されることが画面に書いてある
        currentCheck = 'FS-08'
        await p.locator('[data-testid="cook-session-start"]').click()
        await p.waitForTimeout(700)
        const counterBefore = await p.locator('[data-testid="cook-session-counter"]').innerText()
        check('FS-08 前提: 調理中モードは段取りの先頭から始まる', /^段取り 1\//.test(counterBefore), counterBefore)
        check(
          'FS-08 前提: 移る前は番号の付け直しの説明を出さない',
          (await p.locator('[data-testid="cook-session-pull-notice"]').count()) === 0,
        )
        await p.locator('[data-testid="cook-session-other-row"]').first().click()
        await p.waitForTimeout(400)
        await p.locator('[data-testid="cook-session-peek-move"]').first().click()
        await p.waitForTimeout(600)
        const notice = noZw(
          (await p.locator('[data-testid="cook-session-pull-notice"]').count()) > 0
            ? await p.locator('[data-testid="cook-session-pull-notice"]').innerText()
            : '',
        )
        check(
          'FS-08 移った直後に、番号を付け直したことをその場に出す',
          notice === ja.cookNavi.pullRenumberedNote,
          notice,
        )
        // 一覧に戻っても、並びが変わっている間は同じ説明が読める
        await p.locator('[data-testid="cook-session-close"]').click()
        await p.waitForTimeout(600)
        const listNote = noZw(
          (await p.locator('[data-testid="navi-pull-renumbered"]').count()) > 0
            ? await p.locator('[data-testid="navi-pull-renumbered"]').innerText()
            : '',
        )
        check(
          'FS-08 段取りの一覧でも、並びが変わっている間は理由が読める',
          listNote === ja.cookNavi.pullRenumberedNote,
          listNote,
        )

        // FS-07: 対応外の言葉だったことが分かる（調理中モードの声の操作）
        currentCheck = 'FS-07'
        await p.locator('[data-testid="cook-session-start"]').click()
        await p.waitForTimeout(700)
        await p.locator('button[aria-label="声で操作する"]').click()
        await p.waitForTimeout(500)
        check(
          'FS-07 前提: 「声で操作」ONで聞いている状態になる',
          ((await p.textContent('body')) ?? '').includes('聞いています…'),
        )
        for (const phrase of ['進んで', 'ちょっと待って', 'うーん']) {
          const emitted = await p.evaluate((text) => window.__emitVoice(text), phrase)
          await p.waitForTimeout(400)
          const body = noZw(await p.textContent('body'))
          check(
            `FS-07 「${phrase}」は対応外の言葉だと分かる（黙って「聞いています…」のままにしない）`,
            emitted && body.includes(`「${phrase}」は声で使える言葉ではありません`),
            `注入=${emitted}`,
          )
          await p.waitForTimeout(3800)
        }
        // 使える言葉は今までどおり効く（判定の作り替えで壊していないこと）
        const before = await p.locator('[data-testid="cook-session-counter"]').innerText()
        await p.evaluate(() => window.__emitVoice('次へ'))
        await p.waitForTimeout(600)
        const after = await p.locator('[data-testid="cook-session-counter"]').innerText()
        check('FS-07 「次へ」は今までどおり手順が進む', before !== after, `${before}→${after}`)
        // 材料の枠（調理中モード側）も角丸なし
        const ingBox2 = await p.$eval('[data-testid="cook-session-ingredients"]', (el) => {
          const cs = getComputedStyle(el)
          return [cs.borderTopLeftRadius, cs.borderBottomLeftRadius].join('/')
        })
        check('FS-03 調理中モードの材料の枠にも角丸が付いていない', ingBox2 === '0px/0px', ingBox2)
        await ctx.close()
      }

      // ===== FS-04/06: レシピ一覧の検索まど =====
      {
        currentCheck = 'FS-04'
        const ctx = await fsBrowser2.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watch(p, 'FS-04')
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(2000)
        const fit = await p.$eval('input[type="search"]', (el) => {
          const cs = getComputedStyle(el)
          const ctx2d = document.createElement('canvas').getContext('2d')
          ctx2d.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
          return {
            text: el.placeholder,
            width: ctx2d.measureText(el.placeholder).width,
            avail: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
          }
        })
        check(
          'FS-04 検索窓のプレースホルダが幅390pxの入力欄に収まる（途中で切れない）',
          fit.width <= fit.avail,
          `「${fit.text}」=${Math.round(fit.width)}px / 入る幅=${Math.round(fit.avail)}px`,
        )

        currentCheck = 'FS-06'
        // 助数詞ではなく数を読む。読めなかったときは null にして、
        // 「小さいから合格」に倒れないよう呼び出し側で必ず落とす（2026-08-18 便HR）
        const countOf = async (query) => {
          await p.getByPlaceholder(ja.search.placeholder).fill(query)
          await p.waitForTimeout(700)
          return readResultCount(await p.textContent('body'))?.shown ?? null
        }
        const renji = await countOf('電子レンジ')
        check(
          'FS-06 「電子レンジ」で0にならない（手順に書かれた器具で引ける）',
          renji !== null && renji >= 10,
          `結果=${renji}`,
        )
        const renji2 = await countOf('レンジ')
        check(
          'FS-06 「レンジ」でも同じ品が引ける',
          renji2 !== null && renji2 === renji,
          `電子レンジ=${renji} / レンジ=${renji2}`,
        )
        const shownTitles = noZw(await p.textContent('body'))
        check(
          'FS-06 手順にだけ器具が出てくる品も並ぶ',
          shownTitles.includes('蒸しなすの香味だれ'),
        )
        // 手順本文をまるごと検索対象にはしない（一覧が埋まる語で増えていないこと）
        for (const [word, limit] of [
          ['フライパン', 1],
          ['中火', 1],
          ['ラップ', 1],
        ]) {
          const n = await countOf(word)
          check(
            `FS-06 「${word}」では増やさない（手順本文をまるごと検索対象にしない）`,
            n !== null && n < limit,
            `結果=${n}`,
          )
        }
        await ctx.close()
      }
    } finally {
      await fsBrowser2.close()
    }
  }

  // ============================================================================
  // 便FT（2026-08-12 利用者テスト・実操作2体目）:
  //   「アプリを開き直すと、段取りも途中の位置も消える。タイマーの残り時間は開き直しても
  //     続いているのに、段取りだけ消えるのはちぐはぐに感じました」
  //
  // ここで見張るのは「残ること」と「間違ったものが残らないこと」の両方。
  //   FT-01 段取りを作る → アプリを開き直す（新しいタブ＝別のセッション）→ 段取りと位置が残る
  //   FT-02 同じタブの読み込み直しでも残る（従来どおり全画面も開いたまま続く）
  //   FT-03 開き直したあとは全画面ではなく段取りの一覧に着地し、「続きから見る」で戻れる
  //   FT-04 献立タブの「並行調理ナビを再開」も、開き直したあとに出る
  //   FT-05 覚え書きの日付が今日でなければ残さない・勝手に復活しない・捨てたことを知らせる
  //   FT-06 覚えていた品が今日の献立から消えていたら、既存の整合が働く（勝手な段取りを出さない）
  //   FT-07 動いているタイマーと、組み直した段取りの手順の対応が壊れない
  // ============================================================================
  currentCheck = 'FT-01'
  {
    const ftBrowser = await chromium.launch()
    // localStorage は同じ context の中で共有され、sessionStorage はタブごとに分かれる
    // ＝「新しいタブで開く」が実機の「アプリを開き直す」に当たる
    const ftContext = await ftBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ftWatch = (p, tag) => {
      p.on('dialog', (d) => void d.accept())
      p.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${tag}] ${err.message}`)
      })
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@${tag}] ${t}`)
      })
    }
    /** 「アプリを開き直す」＝同じ端末（同じ context）で新しいタブを開く */
    const ftReopen = async (hash = '/cook-navi') => {
      const p = await ftContext.newPage()
      ftWatch(p, 'FT')
      await p.goto(`${BASE}/#${hash}`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(2000)
      return p
    }
    // 知らせの文は文節の切れ目にゼロ幅スペースが入るので、突き合わせる前に取り除く
    const ftNoZw = (t) => (t ?? '').replace(/\u200B/g, '')
    const ftPage = await ftContext.newPage()
    ftWatch(ftPage, 'FT')
    try {
      await ftPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1800)
      const ftIds = await ftPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('FT照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('FT煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('FTマリネ', [
          { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
          { text: 'パプリカときゅうりを細切りにする。' },
          { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
        ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return [idA, idB, idC]
      })
      await ftPage.goto(`${BASE}/#/cook-navi`)
      await ftPage.reload({ waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1200)
      await ftPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await ftPage.waitForTimeout(800)

      // 2026-08-25 便KT・オーナー原文「「段取りと進んだところは、〜」削除」。
      // 常に出していた説明は消した。**作りは変えていない**ので、開き直しても段取りと
      // 途中の位置が残ることは、この節の以降の検査（FT-02 以降）がそのまま見張る。
      // 日付をまたいで捨てたときは restoreExpiredByDate がその場で理由を言う（FT-05 が見張る）
      check(
        'KT-3 「段取りと進んだところは〜」の説明が画面から消えている',
        (await ftPage.locator('[data-testid="navi-restore-keep-note"]').count()) === 0,
      )

      // 開き直したあとと比べるための、いまの段取りの枚数（2026-08-14 便GK。
      // 枚数を決め打ちすると、混在手順を割って1手順が2工程になった瞬間に落ちる。
      // 見たいのは「開き直しても同じ段取りが残っている」ことなので、開く前の値と比べる）
      const ftCardsBefore = await ftPage.locator('[data-testid="navi-step-text"]').count()
      // 調理中モードで3つ進めておく（＝段取りと「途中の位置」の両方がある状態）
      await ftPage.locator('[data-testid="cook-session-start"]').click()
      await ftPage.waitForTimeout(600)
      for (let i = 0; i < 3; i++) {
        await ftPage.locator('[data-testid="cook-session-next"]').click()
        await ftPage.waitForTimeout(250)
      }
      const ftCounterBefore = await ftPage.locator('[data-testid="cook-session-counter"]').innerText()
      check('FT-01 前提: 調理中モードで3つ進んでいる', /^段取り 4\//.test(ftCounterBefore), ftCounterBefore)

      // 覚え書きは端末に残る側（localStorage）にあり、覚えているのは「利用者が出した指示」だけ
      const ftStored = await ftPage.evaluate(() => ({
        local: localStorage.getItem('uchi-recipe-cook-navi-session'),
        session: sessionStorage.getItem('uchi-recipe-cook-navi-session'),
      }))
      const ftRecord = JSON.parse(ftStored.local ?? 'null')
      check('FT-01 覚え書きは端末に残る置き場にある（タブを閉じても消えない）', ftRecord != null, ftStored.local)
      check(
        'FT-01 覚えているのは選んだ品・段取りを出しているか・調理中の位置だけ（段取りは保存しない）',
        ftRecord != null &&
          Object.keys(ftRecord).sort().join(',') === 'current,date,selectedIds,showTimeline,trialActive,v',
        Object.keys(ftRecord ?? {}).sort().join(','),
      )
      check(
        'FT-01 覚え書きには捨てる判断に使う「版」と「覚えた日」が入っている',
        ftRecord?.v === 1 && /^\d{4}-\d{2}-\d{2}$/.test(ftRecord?.date ?? ''),
        `v=${ftRecord?.v} date=${ftRecord?.date}`,
      )

      // --- FT-02: 同じタブの読み込み直し（従来どおり全画面は開いたまま続く） ---
      currentCheck = 'FT-02'
      await ftPage.reload({ waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1800)
      check(
        'FT-02 読み込み直しても調理中モードは開いたまま、同じ手順で続く',
        (await ftPage.locator('[data-testid="cook-session-counter"]').count()) === 1 &&
          (await ftPage.locator('[data-testid="cook-session-counter"]').innerText()) === ftCounterBefore,
        `${await ftPage.locator('[data-testid="cook-session-counter"]').innerText().catch(() => '(全画面が閉じた)')} / 期待=${ftCounterBefore}`,
      )

      // --- FT-01/03: アプリを開き直す（新しいタブ） ---
      currentCheck = 'FT-01'
      const ftPage2 = await ftReopen()
      const ftCards = await ftPage2.locator('[data-testid="navi-step-text"]').count()
      check(
        'FT-01 アプリを開き直しても段取りが残っている（作り直しにならない）',
        ftCards > 0 && ftCards === ftCardsBefore,
        `${ftCards}枚 / 開く前=${ftCardsBefore}枚`,
      )
      currentCheck = 'FT-03'
      check(
        'FT-03 開き直した直後は全画面ではなく段取りの一覧に着地する（大きな手順をいきなり出さない）',
        (await ftPage2.locator('[data-testid="cook-session-counter"]').count()) === 0,
      )
      check(
        'FT-03 入口のボタンが「続きから見る」になっている',
        (await ftPage2.locator('[data-testid="cook-session-start"]').innerText()).trim() ===
          '調理中モードの続きから見る',
      )
      const ftHint = await ftPage2.locator('[data-testid="cook-session-start-hint"]').innerText()
      check(
        'FT-03 どの手順から始まるかを、画面のバッジと同じ丸数字で添えている',
        ftHint.includes('④'),
        ftHint,
      )
      await ftPage2.locator('[data-testid="cook-session-start"]').click()
      await ftPage2.waitForTimeout(800)
      check(
        'FT-03 押すと、閉じる前と同じ手順から調理中モードが開く（①に戻らない）',
        (await ftPage2.locator('[data-testid="cook-session-counter"]').innerText()) === ftCounterBefore,
        `${await ftPage2.locator('[data-testid="cook-session-counter"]').innerText()} / 期待=${ftCounterBefore}`,
      )
      await ftPage2.locator('[data-testid="cook-session-close"]').click()
      await ftPage2.waitForTimeout(500)

      // --- FT-04: 献立タブの「並行調理ナビを再開」 ---
      currentCheck = 'FT-04'
      const ftPage3 = await ftReopen('/meal-plan')
      check(
        'FT-04 アプリを開き直しても、献立タブに「並行調理ナビを再開」が出る',
        (await ftPage3.locator('[data-testid="navi-resume"]').count()) === 1,
      )

      // --- FT-07: タイマーとの対応（開き直しても同じ手順に付いたまま） ---
      currentCheck = 'FT-07'
      await ftPage3.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
      await ftPage3.waitForTimeout(1500)
      await ftPage3.getByRole('button', { name: ja.cookNavi.startTimer }).first().click()
      await ftPage3.waitForTimeout(800)
      const ftTimerBefore = await ftPage3.locator('[data-testid="navi-wait-timer-running"]').first().innerText()
      check(
        'FT-07 前提: 段取りの手順からタイマーが動き出す',
        /タイマー動作中 残り\d+:\d\d/.test(ftTimerBefore),
        ftTimerBefore,
      )
      const ftTimerStep = await ftPage3.evaluate(() => {
        const rows = JSON.parse(localStorage.getItem('uchirecipe:activeTimers') ?? '[]')
        return rows.map((t) => t.key).join(',')
      })
      const ftPage4 = await ftReopen()
      const ftTimerAfter = await ftPage4
        .locator('[data-testid="navi-wait-timer-running"]')
        .first()
        .innerText()
        .catch(() => '(見つからない)')
      check(
        'FT-07 開き直して組み直した段取りでも、動いているタイマーは同じ手順に付いたまま',
        /タイマー動作中 残り\d+:\d\d/.test(ftTimerAfter),
        `${ftTimerAfter} / タイマーのひも付け=${ftTimerStep}`,
      )
      check(
        'FT-07 タイマーの残り時間は開き直しても続いている（段取りだけ消える、が起きない）',
        ftTimerAfter !== ftTimerBefore,
        `開き直す前=${ftTimerBefore} / 後=${ftTimerAfter}`,
      )

      // --- FT-06: 覚えていた品が今日の献立から消えている ---
      currentCheck = 'FT-06'
      await ftPage4.evaluate(async (dropIds) => {
        const openDb = () => new Promise((resolve, reject) => { const r = indexedDB.open('uchi-recipe'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const all = await P(db.transaction('todayList', 'readonly').objectStore('todayList').getAll())
        const st = db.transaction('todayList', 'readwrite').objectStore('todayList')
        for (const row of all) if (dropIds.includes(row.recipeId)) await P(st.delete(row.id))
        db.close()
      }, [ftIds[2]])
      const ftPage5 = await ftReopen()
      const ftDropped = await ftPage5.locator('[data-testid="navi-selection-dropped"]').innerText().catch(() => '')
      check(
        'FT-06 今日の献立から消えた品は組み合わせから外し、そのことを画面に書く（黙って中身を変えない）',
        ftDropped.includes('今日の献立にない品'),
        ftDropped || '(知らせが出ていない)',
      )
      const ftCards2 = await ftPage5.locator('[data-testid="navi-step-text"]').count()
      check(
        'FT-06 段取りは残った2品で組み直す（消えた品の手順が残らない）',
        // 枚数を決め打ちしない（CLAUDE.md 禁じ手③）。1手順を2つに割る変更が入るたびに増えるため。
        // 測るのは「消えた品が段取りに残っていないこと」と「残った2品の手順で組み直せていること」
        ftCards2 > 0 &&
          !(await ftPage5.textContent('body')).includes('FTマリネ') &&
          (await ftPage5.textContent('body')).includes('FT照り焼き') &&
          (await ftPage5.textContent('body')).includes('FT煮物'),
        `${ftCards2}枚`,
      )
      // もう1品外すと段取りが成り立たない＝勝手に組んだ段取りを出さない
      await ftPage5.evaluate(async (dropIds) => {
        const openDb = () => new Promise((resolve, reject) => { const r = indexedDB.open('uchi-recipe'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const all = await P(db.transaction('todayList', 'readonly').objectStore('todayList').getAll())
        const st = db.transaction('todayList', 'readwrite').objectStore('todayList')
        for (const row of all) if (dropIds.includes(row.recipeId)) await P(st.delete(row.id))
        db.close()
      }, [ftIds[1]])
      const ftPage6 = await ftReopen()
      check(
        'FT-06 2品を割ったら段取りは出さない（残り1品で勝手に組み直さない）',
        (await ftPage6.locator('[data-testid="navi-step-text"]').count()) === 0,
      )

      // --- FT-05: 覚え書きの日付が今日でない ---
      currentCheck = 'FT-05'
      // 段取りと調理中の位置がある覚え書きを、日付だけ過去にして置き直す
      await ftPage6.evaluate((recipeIds) => {
        localStorage.setItem(
          'uchi-recipe-cook-navi-session',
          JSON.stringify({
            v: 1,
            date: '2000-01-01',
            selectedIds: recipeIds,
            showTimeline: true,
            trialActive: false,
            current: { recipeId: recipeIds[0], stepIndex: 1 },
          }),
        )
      }, ftIds)
      const ftPage7 = await ftReopen('/meal-plan')
      check(
        'FT-05 昨日以前の段取りでは、献立タブの「並行調理ナビを再開」を出さない',
        (await ftPage7.locator('[data-testid="navi-resume"]').count()) === 0,
      )
      await ftPage7.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
      await ftPage7.waitForTimeout(1800)
      check(
        'FT-05 昨日以前の段取りは復活しない（古い段取りが今日の画面に出てこない）',
        (await ftPage7.locator('[data-testid="navi-step-text"]').count()) === 0,
      )
      const ftExpired = ftNoZw(
        await ftPage7.locator('[data-testid="navi-restore-expired"]').innerText().catch(() => ''),
      ).trim()
      check(
        'FT-05 捨てたことを黙らない（理由と、何が残っているかを画面に書く）',
        ftExpired.includes('日付が変わったため') && ftExpired.includes('レシピと作った記録はそのままです'),
        ftExpired || '(知らせが出ていない)',
      )
      // 知らせたあとは、その覚え書きを引きずらない
      const ftAfterExpired = JSON.parse(
        (await ftPage7.evaluate(() => localStorage.getItem('uchi-recipe-cook-navi-session'))) ?? 'null',
      )
      check(
        'FT-05 古い覚え書きは残さず、今日の覚え書きに置き換わる',
        ftAfterExpired == null || (ftAfterExpired.date !== '2000-01-01' && ftAfterExpired.showTimeline === false),
        JSON.stringify(ftAfterExpired),
      )
      // 段取りを作る前（選んだだけ）の覚え書きは、失うものが無いので知らせない
      await ftPage7.evaluate((recipeIds) => {
        localStorage.setItem(
          'uchi-recipe-cook-navi-session',
          JSON.stringify({ v: 1, date: '2000-01-01', selectedIds: recipeIds, showTimeline: false, trialActive: false }),
        )
      }, ftIds)
      const ftPage8 = await ftReopen()
      check(
        'FT-05 段取りを作る前の覚え書きを捨てたときは知らせない（余計な知らせを出さない）',
        (await ftPage8.locator('[data-testid="navi-restore-expired"]').count()) === 0,
      )
    } finally {
      await ftBrowser.close()
    }
  }

  // ============================================================================
  // FU-01〜06: 「自分で登録したレシピだけ」で試した実操作テストで出た6件（2026-08-12 便FU）
  //
  //   FU-01 画面に出ている各手順の分の合計＝ヘッダーの品ごとの目安（機械で突き合わせる）
  //   FU-02 合わせ調味料が、段取りにも調理中モードにも組ごと出る
  //   FU-03 貼り付け取り込みでも調理時間が入り、入らないときは理由を書く
  //   FU-04 段取りの丸数字とレシピ内の手順番号がくっついていない（「⑫5」を作らない）
  //   FU-05 「12〜15分」が1つの時間チップになり、「12〜」だけが取り残されない
  //   FU-06 走っているタイマーの帯の裏に、レシピ詳細の中身が隠れたままにならない
  // ============================================================================
  currentCheck = 'FU-01'
  {
    const fuBrowser = await chromium.launch()
    const fuContext = await fuBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fuPage = await fuContext.newPage()
    fuPage.on('dialog', (d) => void d.accept())
    fuPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FU] ${err.message}`)
    })
    fuPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FU] ${t}`)
    })
    try {
      await fuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fuPage.waitForTimeout(1800)
      // 利用者テストと同じ形の3品（分数つきの手順・合わせ調味料・範囲の時間表記）
      const fuIds = await fuPage.evaluate(async () => {
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
        // 「1手順に複数動作」も「湯を沸かす」も入れない＝画面に分数が出ない工程を作らない
        // （ナビが足す「湯を沸かす」だけは分数を出さない決まりなので、この検査から外しておく）
        const idA = await P(store('recipes').add(mk(
          'FUみそマヨ焼き',
          [
            { text: '鶏むね肉に☆をもみ込んで10分おく。', minutes: 10 },
            { text: '玉ねぎを薄切りにする。', minutes: 3 },
            { text: '天板にアルミホイルを敷く。', minutes: 2 },
            { text: '魚焼きグリルの弱火で12〜15分焼く。', minutes: 15 },
            { text: '器に盛り、細ねぎを散らす。', minutes: 4 },
          ],
          [
            { name: '鶏むね肉', amount: '300', unit: 'g' },
            { name: 'みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
            { name: 'マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
            { name: '砂糖', amount: '1', unit: '小さじ', seasoningGroup: 1 },
            { name: '酒', amount: '1', unit: '小さじ', seasoningGroup: 1 },
            { name: '細ねぎ', amount: '2', unit: '本' },
          ],
        )))
        const idB = await P(store('recipes').add(mk(
          'FUみそ汁',
          [
            { text: '鍋にだし汁を入れて火にかける。', minutes: 2 },
            { text: '豆腐とわかめを加えて2分煮る。', minutes: 2 },
            { text: 'みそを溶き入れ、火を止める。', minutes: 4 },
          ],
          [{ name: 'だし汁', amount: '400', unit: 'ml' }, { name: '木綿豆腐', amount: '1/2', unit: '丁' }],
        )))
        const idC = await P(store('recipes').add(mk(
          'FUごま和え',
          [
            { text: 'ほうれん草を洗う。', minutes: 3 },
            { text: '水気を絞って4cm長さに切る。', minutes: 3 },
            { text: 'すりごまと砂糖で和える。', minutes: 3 },
            { text: '器に盛る。', minutes: 3 },
          ],
          [{ name: 'ほうれん草', amount: '1', unit: '束' }, { name: 'すりごま', amount: '2', unit: '大さじ' }],
        )))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return [idA, idB, idC]
      })
      await fuPage.goto(`${BASE}/#/cook-navi`)
      await fuPage.reload({ waitUntil: 'networkidle' })
      await fuPage.waitForTimeout(1200)
      await fuPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fuPage.waitForTimeout(900)

      // --- FU-01: 画面に出ている各手順の分を足すと、ヘッダーの品ごとの目安と一致する ---
      //   （見出しの言い方は 2026-08-25 便KT で「1品だけなら約◯分」→「単品で約◯分」に変わった。
      //     拾い方は「約◯分」のままなので、言い方が変わっても同じ判定になる）
      const fuMinutes = await fuPage.evaluate(() => {
        /** 手順カードに実際に出ている分数（待ちブロックの「約◯分の待ち時間」／手作業の「目安◯分」） */
        const shown = (card) => {
          const wait = card.querySelector('[data-testid="navi-wait-block"]')
          if (wait) {
            const m = (wait.textContent ?? '').match(/約\s*(\d+)\s*分の待ち時間/)
            return m ? Number(m[1]) : 0
          }
          const active = card.querySelector('[data-testid="navi-active-minutes"]')
          const m = (active?.textContent ?? '').match(/(\d+)\s*分/)
          return m ? Number(m[1]) : 0
        }
        const perRecipe = {}
        for (const card of document.querySelectorAll('[id^="navi-step-"]')) {
          const id = card.id.match(/^navi-step-(\d+)-/)?.[1]
          if (!id) continue
          perRecipe[id] = (perRecipe[id] ?? 0) + shown(card)
        }
        const legend = [...document.querySelectorAll('[data-testid="navi-legend-minutes"]')].map((el) => ({
          title: (el.parentElement?.textContent ?? '').replace(el.textContent ?? '', '').trim(),
          // 「単品で約34分」。言い方に寄りかからないよう「約◯分」で取る
          minutes: Number((el.textContent ?? '').match(/約\s*(\d+)\s*分/)?.[1] ?? 0),
        }))
        // 2026-08-26 便LG: 「1品ずつ作ると約◯分」は画面から消したので、比較の元は取らない
        return { perRecipe, legend }
      })
      const fuTitles = { [fuIds[0]]: 'FUみそマヨ焼き', [fuIds[1]]: 'FUみそ汁', [fuIds[2]]: 'FUごま和え' }
      const fuMismatch = fuIds
        .map((id) => {
          const legend = fuMinutes.legend.find((l) => l.title === fuTitles[id])
          return { title: fuTitles[id], shown: fuMinutes.perRecipe[String(id)] ?? 0, legend: legend?.minutes ?? -1 }
        })
        .filter((r) => r.shown !== r.legend)
      check(
        `FU-01 画面に出ている各手順の分の合計＝ヘッダーの「${ja.cookNavi.legendRecipeMinutes}」（3品とも）`,
        fuMinutes.legend.length === 3 && fuMismatch.length === 0,
        JSON.stringify({ 不一致: fuMismatch, 画面: fuMinutes.perRecipe, 見出し: fuMinutes.legend }),
      )
      // 2026-08-26 便LG・オーナー指示で「1品ずつ作ると約◯分」を画面から消した。
      // 「品ごとの目安の足し算＝sequentialMinutes」は scripts/tests/cook-navi.mjs 側で見張る。
      // ここでは**画面から消えたまま**であることを見る
      check(
        'LG-01 段取りの画面に「1品ずつ作ると約◯分」が戻っていない',
        (await fuPage.locator('[data-testid="navi-total-compare"]').count()) === 0,
      )
      check(
        'FU-01 みそマヨ焼き（待ち10・3・2・待ち15・4）の目安は34分（空白の3分が乗らない）',
        (fuMinutes.legend.find((l) => l.title === 'FUみそマヨ焼き')?.minutes ?? 0) === 34,
        JSON.stringify(fuMinutes.legend),
      )

      // --- FU-02: 合わせ調味料が段取りに組ごと出る ---
      currentCheck = 'FU-02'
      const fuSeasoning = await fuPage.evaluate((recipeId) => {
        const out = {}
        for (const card of document.querySelectorAll(`[id^="navi-step-${recipeId}-"]`)) {
          const text = card.querySelector('[data-testid="navi-step-text"]')?.textContent?.trim() ?? ''
          const ings = card.querySelector('[data-testid="navi-step-ingredients"]')?.textContent?.trim() ?? ''
          out[text] = ings
        }
        return out
      }, fuIds[0])
      const fuMixStep = Object.entries(fuSeasoning).find(([text]) => text.includes('☆'))
      check(
        'FU-02 「☆をもみ込む」手順に、組の材料が全部出る（1つだけ出して残りを消さない）',
        !!fuMixStep &&
          ['みそ', 'マヨネーズ', '砂糖', '酒'].every((name) => fuMixStep[1].includes(name)),
        JSON.stringify(fuSeasoning),
      )
      check(
        'FU-02 合わせ調味料と関係ない手順には持ち込まない',
        Object.entries(fuSeasoning).some(([text, ings]) => text.includes('アルミホイル') && ings === ''),
        JSON.stringify(fuSeasoning),
      )

      // --- FU-05: 「12〜15分」が1つの時間チップになる（段取りの手順本文） ---
      currentCheck = 'FU-05'
      const fuGrill = await fuPage.evaluate((recipeId) => {
        for (const card of document.querySelectorAll(`[id^="navi-step-${recipeId}-"]`)) {
          const p = card.querySelector('[data-testid="navi-step-text"]')
          if (!p || !(p.textContent ?? '').includes('魚焼きグリル')) continue
          const chips = [...p.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim())
          const outside = (p.textContent ?? '').replace(/\u200B/g, '')
          return { chips, text: outside }
        }
        return null
      }, fuIds[0])
      check(
        'FU-05 段取りの「12〜15分」が1つの時間チップになっている',
        !!fuGrill && fuGrill.chips.includes('12〜15分'),
        JSON.stringify(fuGrill),
      )
      check(
        'FU-05 範囲の前半（12〜）だけがチップの外に取り残されていない',
        !!fuGrill && !/12〜(?!15分)/.test(fuGrill.text.replace('12〜15分', '')),
        JSON.stringify(fuGrill),
      )

      // --- GK-01/GK-02: 幅で書かれた待ちのタイマーと、混在手順の分割（2026-08-14 便GK） ---
      //   GK-01 原文「本文は『12〜15分焼く』。…表示と実際の待ちは約15分。チーズがのっているものを
      //         最初から15分放置に設定するのは危ない。12分で一度見るほうが正しい」
      //   GK-02 原文「手順1の本文は『…そぎ切りにする。塩こしょうと酒をふって10分ほどおく』です。
      //         前半は完全に手作業で…それを手順まるごと『待ち』にして」
      {
        const prevCheck = currentCheck
        currentCheck = 'GK-01'
        const fuGrillWait = await fuPage.evaluate((recipeId) => {
          for (const card of document.querySelectorAll(`[id^="navi-step-${recipeId}-"]`)) {
            const text = card.querySelector('[data-testid="navi-step-text"]')?.textContent ?? ''
            if (!text.includes('魚焼きグリル')) continue
            const box = card.querySelector('[data-testid="navi-wait-block"]')
            return {
              title: (box?.textContent ?? '').replaceAll('​', ''),
              note: (
                card.querySelector('[data-testid="navi-wait-timer-range"]')?.textContent ?? ''
              ).replaceAll('​', ''),
            }
          }
          return null
        }, fuIds[0])
        check(
          'GK-01 幅で書かれた待ちは、段取りの見積りは長いほう（約15分の待ち時間）のまま',
          !!fuGrillWait && fuGrillWait.title.includes('約15分の待ち時間'),
          JSON.stringify(fuGrillWait),
        )
        check(
          'GK-01 その待ちに「タイマーは短いほうの12分で始めます。」が添えてある',
          !!fuGrillWait && fuGrillWait.note.includes('タイマーは短いほうの12分で始めます'),
          JSON.stringify(fuGrillWait),
        )
        currentCheck = 'GK-02'
        // FUみそ汁の「豆腐とわかめを加えて2分煮る。」＝手を動かす部分と待ちが同居する手順。
        // 分数欄が埋まっていても2つに分かれ、タイマーは待ちの側にだけ出ること
        const fuSoupSplit = await fuPage.evaluate((recipeId) => {
          const rows = []
          for (const card of document.querySelectorAll(`[id^="navi-step-${recipeId}-"]`)) {
            const text = (card.querySelector('[data-testid="navi-step-text"]')?.textContent ?? '')
              .replaceAll('​', '')
              .trim()
            if (!text.includes('豆腐とわかめ') && !text.includes('2分煮る')) continue
            rows.push({
              text,
              label: (
                card.querySelector('[data-testid="navi-recipe-step-number"]')?.textContent ?? ''
              ).trim(),
              wait: !!card.querySelector('[data-testid="navi-wait-block"]'),
              timer: [...card.querySelectorAll('button')].some(
                (b) => (b.textContent ?? '').includes('タイマーを始める'),
              ),
            })
          }
          return rows
        }, fuIds[1])
        check(
          'GK-02 分数欄が埋まっていても、手を動かす部分と待ちが2つの工程に分かれる',
          fuSoupSplit.length === 2 && fuSoupSplit.filter((r) => r.wait).length === 1,
          JSON.stringify(fuSoupSplit),
        )
        check(
          'GK-02 タイマーは待ちの工程だけに出る（手を動かす前には押せない）',
          fuSoupSplit.length === 2 &&
            fuSoupSplit.every((r) => r.timer === r.wait),
          JSON.stringify(fuSoupSplit),
        )
        currentCheck = prevCheck
      }

      // --- FU-02(調理中モード): 大きく出す1手順にも組ごと出る ---
      currentCheck = 'FU-02'
      await fuPage.locator('[data-testid="cook-session-start"]').click()
      await fuPage.waitForTimeout(700)
      let fuSessionIngredients = ''
      for (let i = 0; i < 12; i++) {
        const text = await fuPage.locator('[data-testid="cook-session-step-text"], [data-testid="cook-session"]').first().innerText()
        if (text.includes('☆')) {
          fuSessionIngredients = await fuPage
            .locator('[data-testid="cook-session-ingredients"]')
            .innerText()
            .catch(() => '')
          break
        }
        await fuPage.locator('[data-testid="cook-session-next"]').click()
        await fuPage.waitForTimeout(250)
      }
      check(
        'FU-02 調理中モードの「☆をもみ込む」手順にも組の材料が全部出る',
        ['みそ', 'マヨネーズ', '砂糖', '酒'].every((name) => fuSessionIngredients.includes(name)),
        fuSessionIngredients,
      )
      await fuPage.locator('[data-testid="cook-session-close"]').click()
      await fuPage.waitForTimeout(600)

      // --- FU-04: 段取りの丸数字とレシピ内の手順番号がくっついていない ---
      currentCheck = 'FU-04'
      const fuWaitTimer = fuPage.getByRole('button', { name: ja.cookNavi.startTimer }).first()
      await fuWaitTimer.click()
      await fuPage.waitForTimeout(800)
      const fuBarRow = fuPage.locator('button[aria-label*="タイマーを調整"]').first()
      const fuBarAria = (await fuBarRow.getAttribute('aria-label')) ?? ''
      // 2026-08-14 便GL: 読み上げ名は「段取り9・手順1の2つめ」の形になった（丸数字は使わない。
      // 読み上げソフトによって「まる9」「9」と読みが割れるため）。くっついて読めないことは同じ
      check(
        'FU-04 常駐バーの読み上げ名で、2つの番号がくっついていない',
        /段取り\d+・手順/.test(fuBarAria) &&
          !/[①-⑳㉑-㉟㊱-㊿]\d/.test(fuBarAria) &&
          !/手順[①-⑳㉑-㉟㊱-㊿]/.test(fuBarAria) &&
          !/手順\d+[（(]/.test(fuBarAria),
        fuBarAria,
      )
      await fuBarRow.click()
      await fuPage.waitForTimeout(500)
      const fuDialogText = await fuPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle }).textContent()
      check(
        'FU-04 タイマーを調整する窓でも、丸数字と手順番号がくっついていない',
        !/[①-⑳㉑-㉟㊱-㊿]\d/.test(fuDialogText ?? ''),
        (fuDialogText ?? '').slice(0, 160),
      )
      await fuPage
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: ja.timer.stopTimer })
        .click()
      await fuPage.waitForTimeout(600)

      // --- FU-06: レシピ詳細の中身が、走っているタイマーの帯の裏に隠れたままにならない ---
      currentCheck = 'FU-06'
      await fuPage.goto(`${BASE}/#/recipes/${fuIds[0]}`)
      await fuPage.reload({ waitUntil: 'networkidle' })
      await fuPage.waitForTimeout(1200)
      const fuChips = fuPage.locator('button[aria-label*="タイマー開始"]:visible')
      await fuChips.nth(0).click()
      await fuPage.waitForTimeout(600)
      await fuChips.nth(1).click()
      await fuPage.waitForTimeout(900)
      const fuInset = await fuPage.evaluate(() => {
        const bars = [...document.querySelectorAll('[data-app-bottom-bar]')]
        const barTop = Math.min(...bars.map((b) => b.getBoundingClientRect().top))
        const doc = document.scrollingElement
        const maxScroll = doc.scrollHeight - doc.clientHeight
        const before = doc.scrollTop
        // 画面の中身（材料の行を含む）が1つ残らず「帯より上」へ持ち上げられるか。
        // 下余白が帯の高さに追随していれば足りる＝便FNの仕組みがこの画面でも効いていること
        const rows = [...document.querySelectorAll('main *')].filter(
          (el) => el.children.length === 0 && (el.textContent ?? '').trim() !== '',
        )
        const unreachable = []
        for (const row of rows) {
          const rect = row.getBoundingClientRect()
          if (rect.height === 0) continue
          if (doc.scrollTop + rect.bottom - barTop > maxScroll + 1) unreachable.push(row.textContent.trim())
        }
        doc.scrollTo(0, before)
        return {
          bars: bars.length,
          barTop: Math.round(barTop),
          mainPaddingBottom: getComputedStyle(document.querySelector('main')).paddingBottom,
          insetVar: getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-inset').trim(),
          unreachable: unreachable.slice(0, 5),
        }
      })
      check(
        'FU-06 タイマー2本ぶんの帯の高さが、レシピ詳細の下余白に追随している',
        fuInset.bars >= 2 &&
          Number.parseInt(fuInset.mainPaddingBottom, 10) >= 844 - fuInset.barTop,
        JSON.stringify(fuInset),
      )
      check(
        'FU-06 帯の裏から出せない中身が1つも無い（材料の行を含む）',
        fuInset.unreachable.length === 0,
        JSON.stringify(fuInset),
      )
      // 「作った！」の直後に出る知らせも帯の上に出す（旧: 固定88pxで帯の裏に潜り込んでいた）
      await fuPage.evaluate(() => document.scrollingElement.scrollTo(0, document.scrollingElement.scrollHeight))
      await fuPage.waitForTimeout(400)
      const fuCooked = fuPage.getByRole('button', { name: '作った！', exact: true }).first()
      if (await fuCooked.count()) {
        await fuCooked.click()
        await fuPage.waitForTimeout(1200)
        const fuSave = fuPage.getByRole('button', { name: ja.detail.cookedSave }).first()
        if (await fuSave.count()) {
          await fuSave.click()
          await fuPage.waitForTimeout(1200)
        }
      }
      const fuToast = await fuPage.evaluate(() => {
        const el = document.querySelector('[role="status"]')
        if (!el) return null
        const barTop = Math.min(
          ...[...document.querySelectorAll('[data-app-bottom-bar]')].map((b) => b.getBoundingClientRect().top),
        )
        return { bottom: Math.round(el.getBoundingClientRect().bottom), barTop: Math.round(barTop) }
      })
      check(
        'FU-06 走っているタイマーの帯の上に知らせを出す（帯の裏に隠さない）',
        !!fuToast && fuToast.bottom <= fuToast.barTop,
        JSON.stringify(fuToast),
      )

      // --- FU-03: 貼り付け取り込みの調理時間 ---
      currentCheck = 'FU-03'
      await fuPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await fuPage.waitForTimeout(700)
      await fuPage.getByText(ja.paste.open).click()
      await fuPage.waitForTimeout(300)
      await fuPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
        'FU貼り付け時間つき\n2人分\n調理時間 1時間30分\n\n材料\n・にんじん　1本\n・しょうゆ　大さじ2\n\n作り方\n1. にんじんを切る\n2. 20分煮る',
      )
      await fuPage.getByRole('button', { name: ja.paste.apply }).click()
      await fuPage.waitForTimeout(600)
      const fuCookMinutes = await fuPage.getByLabel(ja.form.cookMinutesLabel).inputValue()
      const fuPasteBody = await fuPage.textContent('body')
      check(
        'FU-03 貼り付けの「調理時間 1時間30分」が調理時間の欄に入る（90分）',
        fuCookMinutes === '90',
        `調理時間欄=${fuCookMinutes}`,
      )
      check(
        'FU-03 何を置き換えたかを結果に書く（URL取り込みと同じ）',
        fuPasteBody.includes('も貼り付けた内容に合わせました'),
        fuPasteBody.slice(fuPasteBody.indexOf('読み取りました'), fuPasteBody.indexOf('読み取りました') + 200),
      )
      // 調理時間が書かれていない文章では、欄が空のままである理由を書く。
      // 直前の貼り付けで入った90分が欄に残っていると「空のまま」にならないので、
      // 登録画面を開き直して（＝欄が空の状態から）確かめる
      await fuPage.goto(`${BASE}/#/recipes/new`)
      await fuPage.reload({ waitUntil: 'networkidle' })
      await fuPage.waitForTimeout(900)
      await fuPage.getByText(ja.paste.open).click()
      await fuPage.waitForTimeout(300)
      await fuPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
        'FU貼り付け時間なし\n2人分\n\n材料\n・にんじん　1本\n\n作り方\n1. にんじんを切る\n2. 10分煮る',
      )
      await fuPage.getByRole('button', { name: ja.paste.apply }).click()
      await fuPage.waitForTimeout(600)
      const fuPasteBody2 = await fuPage.textContent('body')
      // 2026-08-25 便KW・①（オーナー原文「改行や内容を絞って短く読みやすくしてください」）:
      // 40字の1文（「調理時間は貼り付けた文章に書かれていなかったので、調理時間の欄は
      // 空のままです」）を、人数分と同じ1行にまとめた（`ja.paste.notImported`）。
      // ここは**その文言を書き写していた**（禁じ手②）ので、ja.ts から組み立てる形に直す。
      // 見張る中身は変えない＝「調理時間が入らなかったことを、黙らずに言っている」
      check(
        'FU-03 調理時間が書かれていないときは、入らなかったことを言う',
        stripZwspText(fuPasteBody2).includes(
          stripZwspText(ja.paste.notImported.replace('{items}', ja.paste.itemCookMinutes)),
        ),
        fuPasteBody2.slice(fuPasteBody2.indexOf('読み取りました'), fuPasteBody2.indexOf('読み取りました') + 240),
      )
    } finally {
      await fuBrowser.close()
    }
  }

  // ============================================================================
  // FX-01〜12: オーナーの書き溜め（調理ナビ・調理中モード）10件＋司令部裁定2件（2026-08-12 便FX）
  //
  //   FX-01 合わせ調味料の説明は、材料一覧の中で1回だけ（品ごとに繰り返さない）
  //   FX-02 声の案内は3つにまとまり、「読み上げ」だけが目立つ
  //   FX-03 色の案内が「青」「緑」「ピンク」の3つとも書いてある
  //   FX-04 他の品の行の色の囲みは、文字数が違っても同じ幅
  //   FX-05 読み上げを使ったあと、読み方の直し方を1回だけ案内する
  //   FX-07 「完成！」の窓から、手順の画面に帰れる（FO-09 の中で確認）
  //   FX-08 段取りを消す（消したあとは開き直しても戻らない）
  //   FX-09 手順の文字の大きさを変えられる（変えた大きさは開き直しても続く）
  //   FX-10 他の品の行の中のボタンが「この手順を先にする」
  //   FX-11 湯沸かしの待ちに、全体の目安への数え方が添えてある
  //   FX-12 「浸けている間は」の注意が、浸す手順に出る（同梱のフレンチトーストで確認）
  // ============================================================================
  currentCheck = 'FX-01'
  {
    const fxBrowser = await chromium.launch()
    const fxContext = await fxBrowser.newContext({ viewport: { width: 390, height: 844 } })
    // 声で操作は自動で再現できないので、FI と同じ手口で SpeechRecognition を偽装する
    await fxContext.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = ''
          this.continuous = false
          this.interimResults = false
        }
        start() {
          window.__fxRecognition = this
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRecognition
    })
    const fxPage = await fxContext.newPage()
    let fxDialogMessage = ''
    await collectConfirms(fxPage, (text) => {
      fxDialogMessage = text
    })
    fxPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FX] ${err.message}`)
    })
    fxPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FX] ${t}`)
    })
    const fxHint = () =>
      fxPage.locator('[data-testid="cook-session"] p', { hasText: ja.focus.micLabel }).first().innerText()
    try {
      await fxPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1800)
      // 3品: ①ゆで工程だけあって湯沸かしが書かれていない（ナビが「湯を沸かす」を足す）
      //      ②③合わせ調味料の組を持つ品を2つ（説明が1回だけになることを見るため）
      await fxPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('FXパスタ', [
          { text: 'たまねぎを5cm幅に切る。', minutes: 3 },
          { text: 'スパゲッティを8分ゆでる。', minutes: 8 },
          { text: '☆を加えて炒め合わせ、器に盛る。', minutes: 4 },
        ], [
          { name: 'たまねぎ', amount: '1', unit: '個' },
          { name: 'しょうゆ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
          { name: 'みりん', amount: '1', unit: '大さじ', seasoningGroup: 1 },
        ])))
        const idB = await P(store('recipes').add(mk('FX煮物', [
          { text: '大根は一口大に切る。', minutes: 4 },
          { text: '鍋に大根と★を入れて中火で15分煮る。', minutes: 15 },
          { text: '器に盛る。', minutes: 2 },
        ], [
          { name: '大根', amount: '1/3', unit: '本' },
          { name: 'みそ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
          { name: '砂糖', amount: '1', unit: '大さじ', seasoningGroup: 1 },
        ])))
        const idC = await P(store('recipes').add(mk('FXサラダ', [
          { text: 'きゅうりを薄切りにする。', minutes: 3 },
          { text: 'ボウルで和えて器に盛る。', minutes: 3 },
        ], [{ name: 'きゅうり', amount: '1', unit: '本' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await fxPage.goto(`${BASE}/#/cook-navi`)
      await fxPage.reload({ waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1400)
      await fxPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fxPage.waitForTimeout(1000)

      // --- FX-11: 湯沸かしの待ちに、全体の目安への数え方が添えてある（司令部裁定A案） ---
      currentCheck = 'FX-11'
      const fxBoilBlock = await fxPage
        .locator('[data-testid="navi-wait-block"]', { hasText: ja.cookNavi.waitBlockBoil })
        .first()
        .innerText()
        .catch(() => '')
      check(
        'FX-11 前提: ナビが「湯を沸かす」を足した待ちが段取りに出ている',
        fxBoilBlock.includes('沸くまでの待ち時間'),
        fxBoilBlock,
      )
      // 2026-08-14 便GL: 数え方の一文に「タイマーが何分ではかるか」を足した（利用者テスト
      // 「押すと5分固定で始まるが、事前に分数がどこにも書いていない」）。数え方の説明は残す
      // 文言は ja.ts から組み立てる（2026-08-25 便KM で「全体の目安」→「全体の調理時間」に
      // 変わったときに、書き写しが残っていて落ちた。CLAUDE.md の禁じ手②）
      const fxBoilNote = stripZwspText(ja.cookNavi.waitBlockBoilNote).replaceAll('{n}', '5')
      check(
        'FX-11 待ちブロックに、全体の調理時間への数え方が添えてある',
        stripZwspText(fxBoilBlock).replace(/\s+/g, '').includes(
          fxBoilNote.split('。')[1].replace(/\s+/g, ''),
        ),
        `${fxBoilBlock} / ja.ts=${fxBoilNote}`,
      )
      check(
        'FX-11 押す前に、タイマーが何分ではかるかも読める',
        stripZwspText(fxBoilBlock).replace(/\s+/g, '').includes(
          fxBoilNote.split('。')[0].replace(/\s+/g, ''),
        ),
        `${fxBoilBlock} / ja.ts=${fxBoilNote}`,
      )
      check(
        'FX-11 沸くまでの時間は言い切らない（火力と量で変わると書く）',
        fxBoilBlock.includes('火力と量で変わります'),
        fxBoilBlock,
      )
      check(
        'FX-11 見出しは「沸くまでの待ち時間」のまま（分数を出さない）',
        !fxBoilBlock.includes('約5分の待ち時間'),
        fxBoilBlock,
      )
      check(
        'FX-11 湯沸かし以外の待ちには、この行を出さない',
        (await fxPage.locator('[data-testid="navi-boil-note"]').count()) === 1,
        String(await fxPage.locator('[data-testid="navi-boil-note"]').count()),
      )

      // --- FX-01: 合わせ調味料の説明は材料一覧の中で1回だけ ---
      currentCheck = 'FX-01'
      await fxPage.locator('[data-testid="navi-ingredients-toggle"]').click()
      await fxPage.waitForTimeout(600)
      const fxHints = await fxPage.locator('[data-testid="navi-seasoning-group-hint"]').allInnerTexts()
      check(
        'FX-01 合わせ調味料を持つ品が2つあっても、説明は1か所だけ',
        fxHints.length === 1,
        `${fxHints.length}か所: ${fxHints.join(' / ')}`,
      )
      check(
        'FX-01 説明の文言（「左に同じ線が付いた材料は」を言い換えた）',
        fxHints[0] === '左の線が同じ材料どうしは、合わせ調味料です。先にまとめて計量できます',
        fxHints[0],
      )
      // 説明は材料一覧の見出しの下＝線が出てくる前に読める位置にある
      const fxHintOrder = await fxPage.evaluate(() => {
        const panel = document.querySelector('[data-testid="navi-ingredients-panel"]')
        const hint = panel?.querySelector('[data-testid="navi-seasoning-group-hint"]')
        const firstRow = panel?.querySelector('li')
        if (!hint || !firstRow) return null
        return hint.getBoundingClientRect().top < firstRow.getBoundingClientRect().top
      })
      check('FX-01 説明は材料の行より上にある', fxHintOrder === true, String(fxHintOrder))

      // --- 調理中モードへ ---
      currentCheck = 'FX-04'
      await fxPage.locator('[data-testid="cook-session-start"]').click()
      await fxPage.waitForTimeout(800)
      check(
        'FX 前提: 調理中モードが開く',
        (await fxPage.locator('[data-testid="cook-session"]').count()) === 1,
      )

      // --- FX-04: 色の囲みは、文字数が違っても同じ幅 ---
      const fxColorBoxes = await fxPage.evaluate(() =>
        [...document.querySelectorAll('[data-testid="cook-session-color-word"]')].map((el) => ({
          word: el.textContent.trim(),
          width: Math.round(el.getBoundingClientRect().width * 100) / 100,
        })),
      )
      check(
        'FX-04 前提: 文字数の違う色の囲みが2つ以上出ている',
        fxColorBoxes.length >= 2 &&
          new Set(fxColorBoxes.map((b) => b.word.length)).size >= 2,
        JSON.stringify(fxColorBoxes),
      )
      check(
        'FX-04 色の囲みの幅がすべて同じ（実測）',
        new Set(fxColorBoxes.map((b) => b.width)).size === 1,
        JSON.stringify(fxColorBoxes),
      )

      // --- FX-02 / FX-03: 声の案内 ---
      currentCheck = 'FX-02'
      const fxMicStart = fxPage.locator('button[aria-label="声で操作する"]')
      if ((await fxMicStart.count()) > 0) {
        await fxMicStart.click()
        await fxPage.waitForTimeout(400)
      }
      const fxHintText = await fxHint()
      check(
        'FX-02 声の案内は3つ（手順の移動／読み上げ／タイマー操作）',
        fxHintText.includes(ja.focus.micHintMove) &&
          fxHintText.includes(ja.focus.micHintRead) &&
          fxHintText.includes(ja.focus.micHintTimer),
        fxHintText,
      )
      check(
        'FX-02 タイマーの個別説明は出さない',
        !fxHintText.includes('で時間をはかる') && !fxHintText.includes('で読み上げとタイマーを一時停止'),
        fxHintText,
      )
      const fxReadEmphasis = await fxPage.evaluate(() => {
        const el = document.querySelector('[data-testid="voice-hint-read"]')
        if (!el) return null
        const own = getComputedStyle(el)
        const parent = getComputedStyle(el.parentElement)
        return {
          text: el.textContent.trim(),
          weight: own.fontWeight,
          parentWeight: parent.fontWeight,
          color: own.color,
          parentColor: parent.color,
        }
      })
      check(
        'FX-02 「読み上げ」の部分だけが太字で、まわりと違う色になっている',
        fxReadEmphasis != null &&
          Number(fxReadEmphasis.weight) >= 700 &&
          Number(fxReadEmphasis.weight) > Number(fxReadEmphasis.parentWeight) &&
          fxReadEmphasis.color !== fxReadEmphasis.parentColor,
        JSON.stringify(fxReadEmphasis),
      )
      currentCheck = 'FX-03'
      check(
        'FX-03 色の案内は「青」「緑」「ピンク」の3つとも書いてある',
        fxHintText.includes('「青」「緑」「ピンク」と言うと'),
        fxHintText,
      )
      check(
        'FX-03 「など色を言うと」で済ませない・「赤」も出さない',
        !fxHintText.includes('など色を言うと') && !fxHintText.includes('「赤」'),
        fxHintText,
      )

      // --- FX-10: 他の品の行を開いた中のボタン ---
      currentCheck = 'FX-10'
      await fxPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await fxPage.waitForTimeout(500)
      const fxPeekMove = await fxPage.locator('[data-testid="cook-session-peek-move"]').first().innerText()
      check(
        'FX-10 ボタンの文言が「この手順を先にする」',
        fxPeekMove.includes('この手順を先にする') && !fxPeekMove.includes('この手順に移る'),
        fxPeekMove,
      )
      await fxPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await fxPage.waitForTimeout(400)

      // --- FX-09: 手順の文字の大きさ ---
      currentCheck = 'FX-09'
      const fxStepFontSize = () =>
        fxPage.evaluate(() =>
          getComputedStyle(document.querySelector('[data-testid="cook-session-step-text"]')).fontSize,
        )
      const fxFontBefore = await fxStepFontSize()
      await fxPage.locator('[data-testid="cook-text-size-open"]').click()
      await fxPage.waitForTimeout(500)
      check(
        'FX-09 文字の大きさの窓が開き、4段から選べる',
        (await fxPage.locator('[data-testid="cook-text-size-option"]').count()) === 4,
        String(await fxPage.locator('[data-testid="cook-text-size-option"]').count()),
      )
      await fxPage.locator('[data-testid="cook-text-size-option"]').nth(3).click()
      await fxPage.waitForTimeout(500)
      const fxFontLarge = await fxStepFontSize()
      check(
        'FX-09 「特大」を選ぶと手順の本文が大きくなる（24px→36px）',
        fxFontBefore === '24px' && fxFontLarge === '36px',
        `${fxFontBefore}→${fxFontLarge}`,
      )
      // 大きくしても、手順の枠は縦に送れる＝画面に入りきらなくならない
      const fxScrollable = await fxPage.evaluate(() => {
        const p = document.querySelector('[data-testid="cook-session-step-text"]')
        let el = p.parentElement
        while (el && getComputedStyle(el).overflowY !== 'auto') el = el.parentElement
        if (!el) return null
        return { canScroll: el.scrollHeight > el.clientHeight ? true : 'fits' }
      })
      check('FX-09 手順の枠は縦に送れる作りのまま', fxScrollable != null, JSON.stringify(fxScrollable))
      await fxPage.locator('[data-testid="cook-text-size-modal"] button[aria-label="閉じる"]').click()
      await fxPage.waitForTimeout(400)
      await fxPage.reload({ waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1600)
      if ((await fxPage.locator('[data-testid="cook-session"]').count()) === 0) {
        await fxPage.locator('[data-testid="cook-session-start"]').click()
        await fxPage.waitForTimeout(700)
      }
      check(
        'FX-09 選んだ大きさは、開き直しても続く',
        (await fxStepFontSize()) === '36px',
        await fxStepFontSize(),
      )
      // 標準に戻しておく（あとの検査を素の大きさで見るため）
      await fxPage.locator('[data-testid="cook-text-size-open"]').click()
      await fxPage.waitForTimeout(400)
      await fxPage.locator('[data-testid="cook-text-size-option"]').nth(1).click()
      await fxPage.waitForTimeout(400)
      await fxPage.locator('[data-testid="cook-text-size-modal"] button[aria-label="閉じる"]').click()
      await fxPage.waitForTimeout(400)
      check('FX-09 「普通」に戻せる', (await fxStepFontSize()) === '24px', await fxStepFontSize())

      // --- FX-05: 読み上げを使ったあと、読み方の直し方を1回だけ案内する ---
      currentCheck = 'FX-05'
      check(
        'FX-05 読み上げを使う前は、読み方の案内を出さない',
        (await fxPage.locator('[data-testid="speech-reading-hint"]').count()) === 0,
      )
      await fxPage.locator('button[aria-label="読み上げ"]').first().click()
      await fxPage.waitForTimeout(600)
      const fxReadingHint = await fxPage
        .locator('[data-testid="speech-reading-hint"]')
        .innerText()
        .catch(() => '')
      check(
        'FX-05 読み上げを使うと、読み方の直し方を案内する',
        fxReadingHint.includes(ja.focus.readingHintTitle) &&
          fxReadingHint.includes('端末の設定で声を切り替える') &&
          fxReadingHint.includes('iPhone') &&
          fxReadingHint.includes('Android'),
        fxReadingHint,
      )
      await fxPage.locator('[data-testid="speech-reading-hint-close"]').click()
      await fxPage.waitForTimeout(600)
      await fxPage.reload({ waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1600)
      if ((await fxPage.locator('[data-testid="cook-session"]').count()) === 0) {
        await fxPage.locator('[data-testid="cook-session-start"]').click()
        await fxPage.waitForTimeout(700)
      }
      await fxPage.locator('button[aria-label="読み上げ"]').first().click()
      await fxPage.waitForTimeout(600)
      check(
        'FX-05 一度閉じたら、次に読み上げを使っても出さない（しつこくしない）',
        (await fxPage.locator('[data-testid="speech-reading-hint"]').count()) === 0,
      )

      // --- FX-08: 段取りを消す ---
      currentCheck = 'FX-08'
      await fxPage.locator('[data-testid="cook-session-close"]').click()
      await fxPage.waitForTimeout(800)
      check(
        'FX-08 段取りの下に「段取りを消す」がある',
        (await fxPage.locator('[data-testid="navi-discard-timeline"]').innerText()) === '段取りを消す',
        await fxPage.locator('[data-testid="navi-discard-timeline"]').innerText(),
      )
      await setConfirmAnswer(fxPage, 'cancel')
      fxDialogMessage = ''
      await fxPage.locator('[data-testid="navi-discard-timeline"]').click()
      await fxPage.waitForTimeout(900)
      // 2026-08-25 便KT・オーナー原文（差し戻しD）「文章が長くわかりづらいので。消える側は
      // 「段取りを消す」したら当然消えるとわかる範囲では？むしろ確認で説明が入った方が煩わしいかと」。
      // 規約Fの例外＝ボタンの名前が消えるものを言い切っているので、並べ立てはやめた。
      // 残るのは、名前から読み取れない一点（タイマーは止まらない）だけ
      check(
        'FX-08 確認文は「段取りを消します」と「動いているタイマーは残ります」の2行だけ',
        fxDialogMessage.includes(ja.cookNavi.discardTimelineConfirmTitle) &&
          fxDialogMessage.includes(ja.cookNavi.discardTimelineTimerNote) &&
          !fxDialogMessage.includes('組み合わせ'),
        fxDialogMessage,
      )
      check(
        'FX-08 確認でやめれば、段取りはそのまま残る',
        (await fxPage.locator('[data-testid="navi-mark-all-cooked"]').count()) === 1,
      )
      await setConfirmAnswer(fxPage, 'accept')
      await fxPage.locator('[data-testid="navi-discard-timeline"]').click()
      await fxPage.waitForTimeout(1200)
      check(
        'FX-08 消すと段取りが無くなり、選び直しの状態に戻る',
        (await fxPage.locator('[data-testid="navi-mark-all-cooked"]').count()) === 0 &&
          ((await fxPage.textContent('body')) ?? '').includes('0品を選択中'),
        await fxPage.locator('[data-testid="navi-mark-all-cooked"]').count(),
      )
      check(
        'FX-08 消したことを画面で知らせる',
        ((await fxPage.textContent('body')) ?? '').includes('段取りを消しました'),
      )
      const fxCookedAfterDiscard = await fxPage.evaluate(async () => {
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
          .filter((r) => String(r.title).startsWith('FX'))
          .reduce((n, r) => n + (r.cookedLogs?.length ?? 0), 0)
      })
      check('FX-08 消しても作った記録は付かない（消すだけ）', fxCookedAfterDiscard === 0, String(fxCookedAfterDiscard))
      await fxPage.reload({ waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1600)
      check(
        'FX-08 開き直しても、消した段取りは戻らない',
        (await fxPage.locator('[data-testid="navi-mark-all-cooked"]').count()) === 0,
      )

      // --- FX-12: 「浸けている間は」の注意が、浸す手順に出る（同梱のフレンチトースト） ---
      currentCheck = 'FX-12'
      const fxStarterOk = await fxPage.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const all = await P(db.transaction('recipes').objectStore('recipes').getAll())
        const toast = all.find((r) => r.title === 'フレンチトースト')
        const other = all.find((r) => r.title === 'ほうれん草のおひたし')
        if (!toast || !other) return false
        // 今日の献立をこの2品だけにする
        const list = db.transaction('todayList', 'readwrite').objectStore('todayList')
        await P(list.clear())
        let addedAt = Date.now()
        for (const r of [toast, other]) await P(
          db.transaction('todayList', 'readwrite').objectStore('todayList').add({ recipeId: r.id, addedAt: addedAt++ }),
        )
        db.close()
        return true
      })
      check('FX-12 前提: 同梱のフレンチトーストとおひたしを今日の献立に入れられた', fxStarterOk === true)
      await fxPage.reload({ waitUntil: 'networkidle' })
      await fxPage.waitForTimeout(1800)
      await fxPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fxPage.waitForTimeout(1200)
      const fxToastCards = await fxPage.evaluate(() =>
        [...document.querySelectorAll('[id^="navi-step-"]')].map((card) => ({
          text: (card.querySelector('[data-testid="navi-step-text"]')?.textContent ?? '').trim(),
          memo: (card.querySelector('[data-testid="navi-recipe-memo"]')?.textContent ?? '').trim(),
        })),
      )
      // 文節で折り返すためにゼロ幅スペース(U+200B)が差し込まれるので、照合の前に外す。
      // 外さないと「含む」が常に偽になり、逆向きの判定（含まないこと）は素通り合格になる
      // （2026-08-09 EH-01 と同型。2026-08-13 便FXの検査で再発）
      const fxStrip = (t) => (t ?? '').replaceAll('\u200b', '')
      const fxSoak = fxToastCards.find((c) => c.text.includes('卵液に浸し'))
      const fxServe = fxToastCards.find((c) => c.text.includes('メープルシロップ'))
      check(
        'FX-12 前提: フレンチトーストの「卵液に浸す」手順と最後の手順が段取りに出ている',
        fxSoak != null && fxServe != null,
        JSON.stringify(fxToastCards.map((c) => c.text.slice(0, 20))),
      )
      check(
        'FX-12 「浸けている間は必ず冷蔵庫に入れておくこと。」は、浸す手順に出る',
        fxStrip(fxSoak?.memo).includes('浸けている間は必ず冷蔵庫に入れておくこと。'),
        fxSoak?.memo,
      )
      check(
        'FX-12 最後の手順には出ない（以前はここに出ていた）',
        !fxStrip(fxServe?.memo).includes('浸けている間は必ず冷蔵庫に入れておくこと。'),
        fxServe?.memo,
      )
    } finally {
      await fxBrowser.close()
    }
  }
