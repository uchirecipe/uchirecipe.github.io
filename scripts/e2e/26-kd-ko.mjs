// ==========================================================================================
// e2e の節: 便KD〜KO（並行調理ナビ・買い物メモ・見た目）
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
// この中の節: KDNAVI-01, KQFIN-01, KFSALT-01, KFSERV-02, KIADD-01, KIUNDO-02, KIADD-03, KILOCK-04, KITOAST-05, KIDUP-06, KJSTATE-01, KJFOLD-02, KJTHEME-03, KJLOG-04, KMNAVI-01, KMNAVI-02, KMFINISH-01, KOGAP-01, KOGAP-03, KOGAP-02, KOGAP-04, KOMULTI-01
// ==========================================================================================
import './_shared.mjs'

  // --- KDNAVI-01: 電子レンジの二重予約（2026-08-23 便KD・影響範囲テストC「時間が無い人」の実データ）。
  //
  // 起きていたこと（画面から書き写した実際の段取り）:
  //   [16-22] 600Wのレンジで6分加熱し、ラップをしたまま2分おく ← 「この間に、次の手作業を進められます」
  //   [16-18] ラップをかけて2分レンチンし、水けをきる          ← その「次」がもう1品のレンジ
  // レンジは1台なので、言われたとおりには進められない。
  //
  // 画面には工程の開始時刻が出ないので、e2eが見張るのは**画面が利用者に約束していること**:
  // 「この待ちの間に次の手作業を進められます」と書いた待ちの、**すぐ次のカードが同じ器具を
  // 使う工程になっていない**こと。掴み方は data-testid と ja.ts の文言（並びの何番目かには依らない）。
  // 手順の本文はレシピのデータなので、器具の見分けはロジックと同じ関数に通して読む ---
  currentCheck = 'KDNAVI-01'
  {
    const kdBrowser = await chromium.launch()
    const kdContext = await kdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kdPage = await kdContext.newPage()
    kdPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@KDNAVI-01] ${err.message}`)
    })
    try {
      await kdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kdPage.waitForTimeout(2400) // 初回シード完了待ち
      await kdPage.evaluate(async () => {
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
        const mk = (title, dishType, steps) => ({
          title,
          servings: 2,
          effortLevel: 'normal',
          tags: [],
          dishType,
          ingredients: [],
          steps,
          isFavorite: false,
          cookedLogs: [],
          searchWords: [],
          isStarter: false,
          updatedAt: Date.now(),
        })
        // 本文は実データ（デリッシュキッチン／レタスクラブから取り込んだもの）そのまま
        const idA = await P(
          store('recipes').add(
            mk('E2Eレンチンみぞれ煮', 'main', [
              { text: '鶏肉はキッチンペーパーで水気をふきとり、一口大に切る。ビニール袋に鶏肉、マヨネーズを入れて揉み込む。' },
              { text: 'しめじは根元を切り落とし、手でほぐす。大根は皮を厚めにむき、すりおろして軽く水気を切る(大根おろし)。' },
              { text: '耐熱容器に☆、1を入れて混ぜ、しめじ、大根おろしをのせてふんわりとラップをし、600Wのレンジで6分加熱し、ラップをしたまま2分おく。', minutes: 6 },
              { text: '器に盛り、細ねぎをちらす。' },
            ]),
          ),
        )
        const idB = await P(
          store('recipes').add(
            mk('E2Eキャベツののりごまあえ', 'side', [
              { text: 'キャベツは3～4cm四方に切って耐熱ボウルに入れ、ラップをかけて2分レンチンし、水けをきる。', minutes: 2 },
              { text: '焼きのりは細かくちぎり、白すりごま大さじ1、しょうゆ小さじ2、砂糖小さじ1/2とともに１に加えてあえる。' },
            ]),
          ),
        )
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(
          store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
        )
        db.close()
      })
      // 生のIndexedDBへ書いたので、必ず読み込み直す（Dexieのライブ購読はDexie経由しか見ていない）
      await kdPage.goto(`${BASE}/#/cook-navi`)
      await kdPage.reload({ waitUntil: 'networkidle' })
      await kdPage.waitForTimeout(1600)
      await kdPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await kdPage.waitForTimeout(900)

      // 画面から段取りのカードを読む（本文・待ちかどうか・「この間に進められます」の有無）
      const kdCards = await kdPage.$$eval(
        'ol > li',
        (lis, hint) =>
          lis.map((li) => ({
            text: (li.querySelector('[data-testid="navi-step-text"]')?.textContent ?? '').replaceAll(
              '\u200b',
              '',
            ),
            isWait: li.querySelector('[data-testid="navi-wait-block"]') != null,
            fillHint: ((li.textContent ?? '').replaceAll('\u200b', '')).includes(hint),
          })),
        ja.cookNavi.waitFillHint,
      )
      check(
        'KDNAVI-01 前提: 並行の段取りが出て、レンジを使う工程が2つとも段取りに載っている',
        kdCards.length > 0 &&
          kdCards.filter((c) => stepAppliance(c.text) === 'microwave').length >= 2,
        `カード=${kdCards.length} レンジの工程=${kdCards.filter((c) => stepAppliance(c.text) === 'microwave').length}`,
      )
      const kdClash = kdCards
        .map((c, i) => ({ c, next: kdCards[i + 1], i }))
        .filter(
          ({ c, next }) =>
            c.isWait &&
            c.fillHint &&
            stepAppliance(c.text) != null &&
            next != null &&
            stepAppliance(next.text) === stepAppliance(c.text),
        )
        .map(({ c, i }) => `${i + 1}枚目(${stepAppliance(c.text)}) → ${i + 2}枚目`)
      check(
        'KDNAVI-01 「この間に進められます」と書いた待ちの次に、同じ器具を使う工程を置かない',
        kdClash.length === 0,
        kdClash.join(' / '),
      )
    } finally {
      await kdBrowser.close()
    }
  }


  // --- KQFIN-01: 熱いうちに食べたい品が先に仕上がって冷める
  // （2026-08-25 便KQ・影響範囲テストC「時間が無い人」の実データ）。
  //
  // 起きていたこと（画面の「できあがりの目安」から書き写した実際の数字）:
  //   豚肉とキャベツの蒸ししゃぶ      約15分後
  //   えのきとしめじの塩昆布和え      約27分後
  // 熱いうちに食べたい品はこの組に1つだけなのに、和え物より12分早く仕上がる
  // ＝蒸ししゃぶは12分そのままになる。
  //
  // 2026-08-25 便KT: 「できあがりの目安」の枠はオーナー指示で画面から消したので、
  // 見る先を**画面に残っている「完成」の印の並び**に移した（測る中身は変えていない）。
  // 熱い品が1つだけの組では、その品の「完成」が**いちばん最後**に来ること
  // ＝ほかの品が先に出来上がって、熱い品だけが待たされる並びになっていないこと。
  // 何番目のカードに出るか・工程がいくつに割れたかは見ない
  // （段取りが伸びても縮んでも同じ判定になる形）。熱い品が2つある組は対象にしない
  // ＝どちらかが先に仕上がるのは物理的に避けられないため。 ---
  currentCheck = 'KQFIN-01'
  {
    // 本文は実データ（レタスクラブ／クラシル）から取り込んだものそのまま
    const kqHotSteps = [
      { text: 'キャベツはざく切りにする。トマトは1cm角に切ってボウルに入れ、Aを混ぜてトマトだれを作る。' },
      { text: 'フライパンにキャベツを広げて入れ、豚肉を広げてのせて、塩少々、酒大さじ3をふる。ふたをして中火にかけ、肉に火が通るまで7～8分蒸し焼きにする。', minutes: 8 },
      { text: '器に盛ってトマトだれをかける。' },
    ]
    const kqColdSteps = [
      { text: 'えのき、しめじは石づきを切り落としておきます。' },
      { text: 'えのきは半分に切ってほぐします。' },
      { text: 'しめじは小房にほぐします。' },
      { text: '耐熱ボウルに1、2を入れ、ふんわりとラップをかけ、600Wの電子レンジで2分程加熱します。水気を切り、粗熱を取ります。', minutes: 2 },
      { text: 'ボウルに3、塩昆布、(A)を入れて和えます。' },
      { text: '器に盛り付けて完成です。' },
    ]
    const kqHotTitle = 'E2E豚肉とキャベツの蒸ししゃぶ'
    const kqColdTitle = 'E2Eえのきとしめじの塩昆布和え'
    // 「熱いうちに食べたい品」かどうかは、画面と同じ関数に通して決める（判定を書き写さない）
    const kqHotCount = [
      { title: kqHotTitle, steps: kqHotSteps, dishType: 'main' },
      { title: kqColdTitle, steps: kqColdSteps, dishType: 'side' },
    ].filter((r) => recipeServeTemp(r) === 'hot')

    const kqBrowser = await chromium.launch()
    const kqContext = await kqBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kqPage = await kqContext.newPage()
    kqPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@KQFIN-01] ${err.message}`)
    })
    try {
      await kqPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kqPage.waitForTimeout(2400) // 初回シード完了待ち
      await kqPage.evaluate(
        async ({ hotTitle, coldTitle, hotSteps, coldSteps }) => {
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
          const mk = (title, dishType, steps) => ({
            title,
            servings: 2,
            effortLevel: 'normal',
            tags: [],
            dishType,
            ingredients: [],
            steps,
            isFavorite: false,
            cookedLogs: [],
            searchWords: [],
            isStarter: false,
            updatedAt: Date.now(),
          })
          const idHot = await P(store('recipes').add(mk(hotTitle, 'main', hotSteps)))
          const idCold = await P(store('recipes').add(mk(coldTitle, 'side', coldSteps)))
          // 今日の予定に入っている品を段取りが読む。ここだけ入れ替える
          const today = await P(store('todayList').getAll())
          for (const row of today) await P(store('todayList').delete(row.id))
          let addedAt = Date.now()
          await P(store('todayList').add({ recipeId: idHot, addedAt: addedAt++ }))
          await P(store('todayList').add({ recipeId: idCold, addedAt: addedAt++ }))
          const cur = (await P(store('settings').get(1))) || { id: 1 }
          await P(
            store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
          )
          db.close()
        },
        { hotTitle: kqHotTitle, coldTitle: kqColdTitle, hotSteps: kqHotSteps, coldSteps: kqColdSteps },
      )
      // 生のIndexedDBへ書いたので、必ず読み込み直す（Dexieのライブ購読はDexie経由しか見ていない）
      await kqPage.goto(`${BASE}/#/cook-navi`)
      await kqPage.reload({ waitUntil: 'networkidle' })
      await kqPage.waitForTimeout(1600)
      await kqPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await kqPage.waitForTimeout(900)

      // 段取りの中の「完成」の印を、上から順に読む（どの品がどの順で仕上がるか）
      const kqDone = await kqPage.$$eval('#root li', (lis) =>
        lis
          .filter((li) => li.querySelector('[data-testid="navi-recipe-done"]'))
          .map((li) => (li.textContent ?? '').replaceAll('​', '')),
      )
      const kqHotAt = kqDone.findIndex((row) => row.includes(kqHotTitle))
      check(
        'KQFIN-01 前提: 2品とも「完成」まで段取りに入っていて、熱い品はこの組に1つだけ',
        kqDone.length === 2 && kqHotAt >= 0 && kqHotCount.length === 1,
        `完成の並び=${kqDone.map((r) => r.slice(0, 24)).join(' / ')} 熱い品=${kqHotCount.length}品`,
      )
      check(
        'KQFIN-01 熱いうちに食べたい品が、ほかの品より先に仕上がってそのままにならない',
        kqHotAt === kqDone.length - 1,
        `熱い品の完成=${kqHotAt + 1}番目 / 完成は全${kqDone.length}件`,
      )
    } finally {
      await kqBrowser.close()
    }
  }


  // --- KFSALT-01 / KFSERV-02(2026-08-23 便KF): 塩分の数字が、減塩したい人の判断に使えるか ---
  //
  // 影響範囲テストB「健康を気にする人」30品の実測が出発点:
  //   ・塩分の源（白だし・固形スープの素・がらスープ）が丸ごと落ちると「塩分0.0g」と出る（実測2品）
  //   ・落ちても、出るのは他の材料が落ちたときと同じ1文だけ
  //   ・人数分が読めないと黙って2人分になり、1人分の塩分が2倍（4.9g）に出る（警告は1つも出ない）
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①塩分を持つ調味料が計算に入っていない品は、折りたたんだ1行の時点で分かる
  //   ②その注意は**数値より上**に出る（0.0gを見て安心したあとに読む位置では意味がない）
  //   ③塩分を持たない材料しか落ちていない品では出さない（毎回出る注意は読まれなくなる）
  //   ④人数分が読み取れなかったら、人数分の欄のところに出る／直したら消える
  // 禁じ手よけ: 掴むのは data-testid だけ／文言は ja.ts から読む（page.evaluate の中では使わない）／
  //             生のIndexedDBへ書いたら必ず読み込み直す／曜日・月替わりに依らない
  currentCheck = 'KFSALT-01'
  {
    const kfBrowser = await chromium.launch()
    const kfContext = await kfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kfPage = await kfContext.newPage()
    kfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KFSALT-01] ${err.message}`)
    })
    try {
      await kfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(2400) // 初回シード完了待ち
      const kfIds = await kfPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, ingredients) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients,
          steps: [{ text: '混ぜる' }],
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false,
          createdAt: Date.now(), updatedAt: Date.now(),
        })
        // ①塩分の源（成分表に無い合わせだれ）が落ちる品／②薬味しか落ちない品
        const saltGap = await P(store('recipes').add(mk('E2E塩分源が落ちる和えもの', [
          { name: 'トマト', amount: '2', unit: '個' },
          { name: '秘伝のみそだれ', amount: '1', unit: '大さじ' },
        ])))
        const clean = await P(store('recipes').add(mk('E2E薬味だけ落ちる和えもの', [
          { name: 'ほうれん草', amount: '1', unit: '束' },
          { name: 'しょうゆ', amount: '1', unit: '大さじ' },
          { name: '白いりごま', amount: '適量', unit: '' },
        ])))
        // ③材料だけが落ちる品（塩分を持つ調味料は落ちない）。
        // 2026-08-27 便LO: 下の「材料の印とは差し替えになる」を**出る場面と対にして**測るために足した。
        // 対が無いと、材料の印そのものが消えても改名されても「2つ並ばない」は緑のままになる
        const materialGap = await P(store('recipes').add(mk('E2E材料だけ落ちる和えもの', [
          { name: 'トマト', amount: '2', unit: '個' },
          { name: 'E2Eふしぎな木の実', amount: '50', unit: 'g' },
        ])))
        db.close()
        return { saltGap, clean, materialGap }
      })
      // 生のIndexedDBへ書いたので必ず読み込み直す（Dexieのライブ購読はDexie経由の書き込みしか見ない）
      await kfPage.goto(`${BASE}/#/recipes/${kfIds.saltGap}`)
      await kfPage.reload({ waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(1400)

      // ① 折りたたんだ1行の時点で、専用の印が出る
      const kfSaltBadge = kfPage.locator('[data-testid="nutrition-salt-gap-badge"]')
      check('KFSALT-01 塩分を持つ調味料が落ちた品には、専用の印が畳んだままでも出る', (await kfSaltBadge.count()) === 1)
      const kfBadgeText = ((await kfSaltBadge.count()) === 1 ? await kfSaltBadge.textContent() : '').replaceAll('​', '')
      check(
        'KFSALT-01 印の文言が「計算できない調味料」であって、材料の印ではない',
        kfBadgeText.includes(ja.nutrition.saltGapBadge.replace('{n}', '1')),
        `印=${kfBadgeText}`,
      )
      check(
        'KFSALT-01 材料の印(計算できない材料)とは差し替えになっていて、2つ並ばない',
        (await kfPage.locator('[data-testid="nutrition-material-gap-badge"]').count()) === 0,
      )

      // ② 折りたたみを開くと、注意が**数値より上**に出る
      await kfPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
      await kfPage.waitForTimeout(400)
      const kfNote = kfPage.locator('[data-testid="nutrition-salt-gap-note"]')
      check('KFSALT-01 折りたたみを開くと塩分の注意が出る', (await kfNote.count()) === 1)
      const kfNoteText = ((await kfNote.count()) === 1 ? await kfNote.textContent() : '').replaceAll('​', '')
      check(
        'KFSALT-01 注意に「塩分を持つ調味料を計算に含めていない」と書いてある',
        kfNoteText.includes(ja.nutrition.saltGapNote),
        `注意=${kfNoteText}`,
      )
      check(
        'KFSALT-01 注意に、落ちた調味料の名前が並ぶ（何を足せば正しくなるか分かる）',
        kfNoteText.includes('秘伝のみそだれ'),
        `注意=${kfNoteText}`,
      )
      const kfNoteBox = (await kfNote.count()) === 1 ? await kfNote.boundingBox() : null
      const kfKcalRow = kfPage.locator('[data-nutrient-label="kcal"]')
      const kfKcalBox = (await kfKcalRow.count()) > 0 ? await kfKcalRow.first().boundingBox() : null
      check(
        'KFSALT-01 注意は数値の表より上にある（数字を読む前に届く）',
        kfNoteBox != null && kfKcalBox != null && kfNoteBox.y < kfKcalBox.y,
        `注意y=${kfNoteBox?.y} 表y=${kfKcalBox?.y}`,
      )

      // 塩分相当量が実際に出ている状態（8項目のお試し）では、数値の向きまで言い切る
      const kfTrial = kfPage.locator('[data-testid="nutrition-trial-button"]')
      if ((await kfTrial.count()) > 0) {
        await kfTrial.click()
        await kfPage.waitForTimeout(500)
        const kfTrialNote = ((await kfNote.count()) === 1 ? await kfNote.textContent() : '').replaceAll('​', '')
        check(
          'KFSALT-01 塩分相当量が出ている状態では「実際より小さい数値です」まで言う',
          kfTrialNote.includes(ja.nutrition.saltGapNoteSalt),
          `注意=${kfTrialNote}`,
        )
      }

      // ③ 薬味しか落ちていない品では出さない
      await kfPage.goto(`${BASE}/#/recipes/${kfIds.clean}`)
      await kfPage.reload({ waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(1200)
      check(
        'KFSALT-01 薬味(適量)しか落ちていない品では塩分の印を出さない',
        (await kfPage.locator('[data-testid="nutrition-salt-gap-badge"]').count()) === 0,
      )
      await kfPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
      await kfPage.waitForTimeout(400)
      check(
        'KFSALT-01 薬味しか落ちていない品では塩分の注意も出さない',
        (await kfPage.locator('[data-testid="nutrition-salt-gap-note"]').count()) === 0,
      )

      // ③' 材料の印が「出る場面」を同じ節で押さえておく（2026-08-27 便LO）。
      // 上の「2つ並ばない」は count()===0 だけを見ているので、材料の印が改名されても
      // 丸ごと消えても緑のままになる。**出る場面と出ない場面を対にして**測ると、
      // 印そのものが失われた時にこの対の片方が必ず落ちる
      await kfPage.goto(`${BASE}/#/recipes/${kfIds.materialGap}`)
      await kfPage.reload({ waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(1200)
      const kfMaterialBadge = kfPage.locator('[data-testid="nutrition-material-gap-badge"]')
      check(
        'KFSALT-01 材料だけが落ちる品では、材料の印のほうが出る（差し替えの相手が実在する）',
        (await kfMaterialBadge.count()) === 1,
      )
      check(
        'KFSALT-01 その品では塩分の印は出ない（差し替えは両方向に効く）',
        (await kfPage.locator('[data-testid="nutrition-salt-gap-badge"]').count()) === 0,
      )
      check(
        'KFSALT-01 材料の印の文言は「計算できない材料」',
        ((await kfMaterialBadge.count()) === 1 ? await kfMaterialBadge.textContent() : '')
          .replaceAll('\u200b', '')
          .includes(ja.nutrition.materialGapBadge.replace('{n}', '1')),
        `印=${await kfMaterialBadge.textContent().catch(() => '(無し)')}`,
      )

      // ④ 人数分が読み取れなかったことを、人数分のところで知らせる
      currentCheck = 'KFSERV-02'
      await kfPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(600)
      await kfPage.getByText(ja.paste.open).click()
      await kfPage.waitForTimeout(300)
      // 人数分を**書いていない**文章（元ページに人数分が無い状態の再現）
      await kfPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
        'E2E人数分なしレシピ\n\n材料\n・切り干し大根　40g\n・しょうゆ　大さじ3\n\n作り方\n1. 戻す\n2. 煮る',
      )
      await kfPage.getByRole('button', { name: ja.paste.apply }).click()
      await kfPage.waitForTimeout(500)
      const kfServNote = kfPage.locator('[data-testid="servings-not-read"]')
      check('KFSERV-02 人数分が書かれていない取り込みでは、人数分のところに印が出る', (await kfServNote.count()) === 1)
      const kfServText = ((await kfServNote.count()) === 1 ? await kfServNote.textContent() : '').replaceAll('​', '')
      check(
        'KFSERV-02 印に「人数分が書かれていなかった」と、いま何人分なのかが書いてある',
        kfServText.includes(ja.form.servingsNotReadNote.replace('{n}', '2')),
        `印=${kfServText}`,
      )
      // 2026-08-25 便KW・①: 人数分と調理時間は1行にまとまった。この文章はどちらも
      // 書いていないので、2つ並んだ形がそのまま出る
      check(
        'KFSERV-02 取り込みの結果の文でも人数分を読めなかったと言う',
        ((await kfPage.textContent('body')) ?? '')
          .replaceAll('​', '')
          .includes(
            ja.paste.notImported.replace(
              '{items}',
              [ja.paste.itemServings, ja.paste.itemCookMinutes].join(ja.paste.itemSeparator),
            ),
          ),
      )
      // 人数分を直したら印は消える（確認が済んだとみなす）
      await kfPage.getByRole('button', { name: ja.detail.servingsUp }).click()
      await kfPage.waitForTimeout(300)
      check(
        'KFSERV-02 人数分を直すと印は消える',
        (await kfPage.locator('[data-testid="servings-not-read"]').count()) === 0,
      )
      // 人数分が書いてある文章では、はじめから出ない。
      // 一度レシピ一覧へ出てから入り直す（同じハッシュへの goto は同じ画面のままなので、
      // 開いたままの貼り付け欄をそのまま使うことになる）
      await kfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(600)
      await kfPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(600)
      const kfPasteBox = kfPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
      // 貼り付け欄が畳まれているときだけ開く（開いている状態で押すと閉じてしまう）
      if ((await kfPasteBox.count()) === 0) {
        await kfPage.getByText(ja.paste.open).click()
        await kfPage.waitForTimeout(300)
      }
      await kfPasteBox.fill(
        'E2E人数分ありレシピ\n\n材料（4人分）\n・切り干し大根　40g\n・しょうゆ　大さじ3\n\n作り方\n1. 戻す\n2. 煮る',
      )
      await kfPage.getByRole('button', { name: ja.paste.apply }).click()
      await kfPage.waitForTimeout(500)
      check(
        'KFSERV-02 人数分が書いてある文章では印を出さない（毎回出る注意にしない）',
        (await kfPage.locator('[data-testid="servings-not-read"]').count()) === 0,
      )
    } finally {
      await kfBrowser.close()
    }
  }



  // ==========================================================================================
  // KIADD-01 / KIUNDO-02 / KIADD-03 / KILOCK-04 / KITOAST-05（2026-08-24 便KI・オーナー実機）
  //
  // オーナー原文:
  //   「レシピ一覧から選択中から『夕食に入れる』した場合、今週の献立にもとからあった夕食の主菜と
  //     入れ替えに消える。もしくは既存レシピと入れ替えになって、全て入らない。追加のみしてください。」
  //   「総入れ替え→まとめて献立入力した後のトーストの文が長い上に改行もないので読む前に消える。
  //     日の献立は変わらないとでているが、更新されているので不要な文。」
  //
  // 測るのは「利用者が確かめたいこと」＝**入れたときに、もとからあった献立が消えていないこと**。
  // 「足せた」だけを測ると、足したそばから既存が消えていても合格になるので、
  // 押す前の中身と押した後の中身を**端末のデータで数えて突き合わせる**形にしてある。
  //
  // 禁じ手よけ: 掴むのは data-testid と ja.ts から組み立てた名前だけ／page.evaluate の中では
  //   ja を使わない（料理名は端末から読んだものを引数で渡す）／生のIndexedDBへ書いたら読み込み直す／
  //   曜日・月替わりに依らない（今日の枠しか触らない。KITOAST-05 だけ週を触るので、
  //   E2E_FAKE_TODAY で月曜・日曜の両方を当ててある）
  // ==========================================================================================

  // --- KIADD-01: 「◯食に入れる」で、もとからあった主菜が消えない／KIUNDO-02: 元に戻せる ---
  currentCheck = 'KIADD-01'
  {
    const kiBrowser = await chromium.launch()
    const kiContext = await kiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kiPage = await kiContext.newPage()
    kiPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KIADD-01] ${err.message}`)
    })
    try {
      await kiPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await kiPage.waitForTimeout(2400) // 初回シード完了待ち
      /** 主菜の料理を必要な数だけ端末から拾う（料理名を書き写さない＝並びが変わっても効く） */
      const pickMains = (page, count) =>
        page.evaluate(
          (count) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const g = req.result.transaction('recipes', 'readonly').objectStore('recipes').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result
                      .filter((r) => r.dishType === 'main')
                      .slice(0, count)
                      .map((r) => ({ id: r.id, title: r.title })),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          count,
        )
      /** 今日の献立（端末のデータ）を「食事/役割/料理名」の一覧で読む */
      const dinnerOf = (page) =>
        page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const d = new Date()
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
                const gp = tx.objectStore('mealPlans').getAll()
                const gr = tx.objectStore('recipes').getAll()
                tx.oncomplete = () => {
                  const byId = new Map(gr.result.map((r) => [r.id, r.title]))
                  resolve(
                    gp.result
                      .filter((e) => e.date === date && e.slot === 'dinner')
                      .map((e) => byId.get(e.recipeId)),
                  )
                }
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
      /** 今日の夕食に1品、レシピ一覧から選択中に何品かを仕込む（生書き込みなので必ず読み込み直す） */
      const seed = (page, plannedId, pickedIds) =>
        page.evaluate(
          ({ plannedId, pickedIds }) =>
            new Promise((resolve, reject) => {
              const d = new Date()
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction(['mealPlans', 'todayList'], 'readwrite')
                if (plannedId != null)
                  tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId: plannedId, role: 'main' })
                for (const id of pickedIds)
                  tx.objectStore('todayList').add({ recipeId: id, addedAt: Date.now() })
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { plannedId, pickedIds },
        )
      const addToDinner = ja.mealPlan.planMismatchAddToSlot.replace('{slot}', ja.mealPlan.slot.dinner)
      const mains = await pickMains(kiPage, 4)
      check('KIADD-01 前提: 主菜の料理を4品用意できている', mains.length === 4, `用意=${mains.length}品`)
      await seed(kiPage, mains[0].id, [mains[1].id])
      await kiPage.reload({ waitUntil: 'networkidle' })
      await kiPage.waitForTimeout(1600)
      const before = await dinnerOf(kiPage)
      check(
        'KIADD-01 前提: 今日の夕食に主菜が1品だけ入っている',
        before.length === 1 && before[0] === mains[0].title,
        `押す前=${JSON.stringify(before)}`,
      )
      await kiPage
        .locator('[data-testid="day-picked"] li', { hasText: mains[1].title })
        .getByRole('button', { name: addToDinner, exact: true })
        .first()
        .click()
      await kiPage.waitForTimeout(1000)
      const after = await dinnerOf(kiPage)
      check(
        'KIADD-01 もとからあった夕食の主菜が消えていない（入れ替えにならない）',
        after.includes(mains[0].title),
        `押した後=${JSON.stringify(after)}`,
      )
      check(
        'KIADD-01 押した料理も入っている（もとの1品＋足した1品＝2品）',
        after.length === 2 && after.includes(mains[1].title),
        `押した後=${JSON.stringify(after)}`,
      )
      const plannedText = stripZwspText(
        await kiPage.locator('[data-testid="day-planned"]').first().textContent(),
      )
      check(
        'KIADD-01 画面の「今週の献立の予定」にも2品とも並ぶ',
        plannedText.includes(mains[0].title) && plannedText.includes(mains[1].title),
      )

      currentCheck = 'KIUNDO-02'
      const kiUndo = kiPage.getByRole('button', { name: ja.common.undo, exact: true })
      check('KIUNDO-02 入れた直後のトーストに「元に戻す」が出る', (await kiUndo.count()) === 1)
      await kiUndo.first().click()
      await kiPage.waitForTimeout(1000)
      const undone = await dinnerOf(kiPage)
      check(
        'KIUNDO-02 「元に戻す」で押す前の姿に戻る（足した1品だけが外れる）',
        undone.length === 1 && undone[0] === mains[0].title,
        `戻した後=${JSON.stringify(undone)}`,
      )

      // --- KIADD-03: 主菜を続けて入れても、前に入れた分が消えない（「全て入らない」の再発防止） ---
      currentCheck = 'KIADD-03'
      await kiPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction(['mealPlans', 'todayList'], 'readwrite')
              tx.objectStore('mealPlans').clear()
              tx.objectStore('todayList').clear()
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await seed(kiPage, null, [mains[1].id, mains[2].id, mains[3].id])
      await kiPage.reload({ waitUntil: 'networkidle' })
      await kiPage.waitForTimeout(1600)
      for (const m of [mains[1], mains[2], mains[3]]) {
        await kiPage
          .locator('[data-testid="day-picked"] li', { hasText: m.title })
          .getByRole('button', { name: addToDinner, exact: true })
          .first()
          .click()
        await kiPage.waitForTimeout(800)
      }
      const three = await dinnerOf(kiPage)
      check(
        'KIADD-03 主菜を3品つづけて入れると3品とも残る（前の分と入れ替わらない）',
        three.length === 3 &&
          [mains[1], mains[2], mains[3]].every((m) => three.includes(m.title)),
        `押した後=${JSON.stringify(three)}`,
      )
    } finally {
      await kiBrowser.close()
    }
  }

  // --- KILOCK-04: 鍵の掛かった食事には、今までどおり入らない（追加のみにしても止まる） ---
  currentCheck = 'KILOCK-04'
  {
    const klBrowser = await chromium.launch()
    const klContext = await klBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const klPage = await klContext.newPage()
    klPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KILOCK-04] ${err.message}`)
    })
    try {
      await klPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await klPage.waitForTimeout(2400)
      const klSeed = await klPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const mains = g.result.filter((r) => r.dishType === 'main').slice(0, 2)
                const tx = idb.transaction(['mealPlans', 'todayList', 'mealPlanLocks'], 'readwrite')
                tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId: mains[0].id, role: 'main' })
                tx.objectStore('todayList').add({ recipeId: mains[1].id, addedAt: Date.now() })
                tx.objectStore('mealPlanLocks').put({ key: `${date}|dinner`, date, slot: 'dinner', lockedAt: Date.now() })
                tx.oncomplete = () => resolve(mains.map((r) => r.title))
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await klPage.reload({ waitUntil: 'networkidle' })
      await klPage.waitForTimeout(1600)
      const klAddToDinner = ja.mealPlan.planMismatchAddToSlot.replace('{slot}', ja.mealPlan.slot.dinner)
      await klPage
        .locator('[data-testid="day-picked"] li', { hasText: klSeed[1] })
        .getByRole('button', { name: klAddToDinner, exact: true })
        .first()
        .click()
      await klPage.waitForTimeout(900)
      const klDinner = await klPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
              const gp = tx.objectStore('mealPlans').getAll()
              const gr = tx.objectStore('recipes').getAll()
              tx.oncomplete = () => {
                const byId = new Map(gr.result.map((r) => [r.id, r.title]))
                resolve(gp.result.filter((e) => e.date === date && e.slot === 'dinner').map((e) => byId.get(e.recipeId)))
              }
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'KILOCK-04 鍵の掛かった夕食には入らない（もとの1品のまま）',
        klDinner.length === 1 && klDinner[0] === klSeed[0],
        `押した後=${JSON.stringify(klDinner)}`,
      )
      check(
        'KILOCK-04 入らなかったことを画面で知らせる（黙って何も起きないにしない）',
        stripZwspText(await klPage.textContent('body')).includes(ja.mealPlan.lockedEditBlocked),
      )
    } finally {
      await klBrowser.close()
    }
  }

  // --- KITOAST-05: 総入れ替えのあとの知らせが、読み切れる長さで、事実と合っていること ---
  //
  // 実装を読んで確かめたこと: 日タブの「今週の献立の予定」は今日の予定からその場で組み立てるので、
  // 週タブで総入れ替えすると**自動で変わる**。それなのに「自動では変わらない」と知らせていた。
  // ここで測るのは ①知らせが短く読み切れること ②日タブの「今日の献立」が実際に変わっていること。
  currentCheck = 'KITOAST-05'
  {
    const ktBrowser = await chromium.launch()
    const ktContext = await ktBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ktPage = await ktContext.newPage()
    ktPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KITOAST-05] ${err.message}`)
    })
    try {
      await ktPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ktPage.waitForTimeout(2400)
      await ktPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const mains = g.result.filter((r) => r.dishType === 'main').slice(0, 2)
                const tx = idb.transaction(['mealPlans', 'todayList'], 'readwrite')
                tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId: mains[0].id, role: 'main' })
                tx.objectStore('todayList').add({ recipeId: mains[1].id, addedAt: Date.now() })
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await ktPage.reload({ waitUntil: 'networkidle' })
      await ktPage.waitForTimeout(1800) // 日タブの自動取り込みが済むまで待つ（済んだ側の知らせを測るため）
      const ktPlannedText = async () => {
        const node = ktPage.locator('[data-testid="day-planned"]')
        if ((await node.count()) === 0) return ''
        return stripZwspText(await node.first().textContent())
      }
      const ktBeforeDay = await ktPlannedText()
      check('KITOAST-05 前提: 日タブの「今週の献立の予定」に献立が出ている', ktBeforeDay.length > 0)
      // 週タブへ移り、入れかたを「総入れ替え」にしてまとめて入れる
      await ktPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await ktPage.waitForTimeout(1200)
      await openWeekGroup(ktPage, ja.mealPlan.weekGroupAutoTitle)
      await ktPage.locator('[data-testid="fill-mode"]').selectOption('replaceAll')
      await ktPage.waitForTimeout(200)
      await ktPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await ktPage.waitForTimeout(700)
      const ktOk = ktPage.locator('[data-testid$="-ok"]')
      if ((await ktOk.count()) > 0) await ktOk.first().click()
      const ktShownAt = Date.now()
      await ktPage.waitForTimeout(700)
      const ktToastRaw = stripZwspText(
        (await ktPage.locator('[role="status"]').allTextContents()).join(''),
      )
      // トーストの本文＝出ている文字から「元に戻す」（操作のボタン）を除いたもの
      const ktToast = ktToastRaw.replace(ja.common.undo, '').trim()
      check('KITOAST-05 前提: トーストが出ている', ktToast.length > 0, `本文=${JSON.stringify(ktToast)}`)
      // 6秒で消えるトーストなので、読み切れる長さに収まっていること（実測した字数を必ず残す）
      check(
        'KITOAST-05 知らせが40字以内（6秒で消えるあいだに読み切れる長さ）',
        ktToast.length <= 40,
        `${ktToast.length}字: ${JSON.stringify(ktToast)}`,
      )
      // 入れ替えたことと入った品数だけを言う1文になっていること（内部の取り込みの話を足さない）
      const ktDonePattern = new RegExp(
        `^${ja.mealPlan.fillModeReplaceAllDone
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          .replace('\\{a\\}', '\\d+')}$`,
      )
      check(
        'KITOAST-05 知らせは「入れ替えて◯品を入れました」の1文だけ',
        ktDonePattern.test(ktToast),
        `本文=${JSON.stringify(ktToast)}`,
      )
      // トーストが出ている時間を測る（短くしても、読む前に消えていないかを数字で残す）
      let ktGoneAfter = null
      for (let i = 0; i < 44; i++) {
        await ktPage.waitForTimeout(250)
        // allTextContents は待たずにその瞬間の姿を返す（count のあとに消えると textContent が
        // 30秒待って実行中断になる＝禁じ手⑤と同じ形の事故になるため、1回の読みで済ませる）
        const shown = (await ktPage.locator('[role="status"]').allTextContents())
          .map((t) => stripZwspText(t).trim())
          .filter((t) => t.length > 0)
        if (shown.length === 0) {
          ktGoneAfter = Date.now() - ktShownAt
          break
        }
      }
      check(
        'KITOAST-05 トーストは5秒以上出ている（読む前に消えない）',
        ktGoneAfter != null && ktGoneAfter >= 5000,
        `出ていた時間=${ktGoneAfter}ms`,
      )
      // 日タブへ戻り、「今日の献立」が実際に更新されていること＝「自動では変わらない」は嘘だった
      await ktPage.getByRole('button', { name: ja.mealPlan.viewDay, exact: true }).click()
      await ktPage.waitForTimeout(1600)
      const ktAfterDay = await ktPlannedText()
      check(
        'KITOAST-05 日タブの「今日の献立」は総入れ替えで自動的に変わる（知らせと食い違わない）',
        ktAfterDay.length > 0 && ktAfterDay !== ktBeforeDay,
        `押す前=${JSON.stringify(ktBeforeDay)} 押した後=${JSON.stringify(ktAfterDay)}`,
      )
    } finally {
      await ktBrowser.close()
    }
  }


  // --- KIDUP-06: 同じ料理を2回入れても行は増えず、すでに入っていることを知らせる ---
  //
  // オーナー原文（2026-08-24・上限と重複の裁定）:
  //   「追加のみは上限なしでいいと思います。2回目だったら追加済みであることのお知らせを
  //     出せばよいのでは？」
  //
  // 「2回目」を確実に起こすために、ボタンを**同じ瞬間に2回押す**（連打）。
  // 押した品は「レシピ一覧から選択中」から「今週の献立の予定」へ移るので、
  // 画面を待ってから押し直す形では2回目にならない（1回目で行が消える）。
  currentCheck = 'KIDUP-06'
  {
    const kdBrowser = await chromium.launch()
    const kdContext = await kdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kdPage = await kdContext.newPage()
    kdPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KIDUP-06] ${err.message}`)
    })
    try {
      await kdPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await kdPage.waitForTimeout(2400)
      const kdTitle = await kdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const main = g.result.filter((r) => r.dishType === 'main')[0]
                const tx = idb.transaction('todayList', 'readwrite')
                tx.objectStore('todayList').add({ recipeId: main.id, addedAt: Date.now() })
                tx.oncomplete = () => resolve(main.title)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await kdPage.reload({ waitUntil: 'networkidle' })
      await kdPage.waitForTimeout(1600)
      const kdBtn = kdPage
        .locator('[data-testid="day-picked"] li', { hasText: kdTitle })
        .getByRole(
          'button',
          { name: ja.mealPlan.planMismatchAddToSlot.replace('{slot}', ja.mealPlan.slot.dinner), exact: true },
        )
        .first()
      const kdHandle = await kdBtn.elementHandle()
      // 同じ瞬間に2回（画面が描き直される前に2回目が入る＝実機の連打と同じ形）
      await kdPage.evaluate((el) => {
        el.click()
        el.click()
      }, kdHandle)
      await kdPage.waitForTimeout(1400)
      const kdDinner = await kdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const g = req.result.transaction('mealPlans', 'readonly').objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.filter((e) => e.date === date && e.slot === 'dinner').length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('KIDUP-06 2回押しても行は1つだけ（同じ料理が2行に並ばない）', kdDinner === 1, `夕食の行=${kdDinner}件`)
      check(
        'KIDUP-06 2回目は「すでに入っています」と知らせる（黙って何も起きないにしない）',
        stripZwspText(await kdPage.textContent('body')).includes(
          ja.mealPlan.planMismatchAlready
            .replace('{slot}', ja.mealPlan.slot.dinner)
            .replace('{title}', kdTitle),
        ),
        `画面の知らせ=${JSON.stringify(stripZwspText((await kdPage.locator('[role="status"]').allTextContents()).join('')))}`,
      )
    } finally {
      await kdBrowser.close()
    }
  }



  // --- KJSTATE-01(2026-08-24 便KJ・①): 提案の「入れかた」と「調理時間」が、画面を離れても選んだまま ---
  //
  // オーナー原文: 「提案の入れ方が、タブ移動で「空いた枠だけ」に戻る。選択保持して。
  //   総入れ替えだと確認画面も出るので、総入れ替えに気づかない仕組みにはなっていない。」
  // 2026-08-23 の影響範囲テストで見つかった同じ型（「20分以内」が画面を離れるたびに「指定なし」に
  // 戻る）も、同じ節で一緒に見張る。
  //
  // 測るのは**選んだものが選んだままか**だけで、覚え方（設定に持つのか画面の状態か）には触れない。
  // あわせて、覚えたせいで**消える操作が黙って走らない**こと＝総入れ替えを選んだまま実行しても
  // 確認の窓が必ず出ること（オーナーが安全と判断した根拠そのもの）も同じ節で見る。
  currentCheck = 'KJSTATE-01'
  {
    const kjBrowser = await chromium.launch()
    const kjContext = await kjBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kjPage = await kjContext.newPage()
    kjPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KJSTATE-01] ${err.message}`)
    })
    try {
      /** 週タブを開いて「献立を提案」の節まで出す（畳んでいるときだけ押す＝押す回数を決め打ちしない） */
      const kjGoWeek = async () => {
        await kjPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
        await kjPage.waitForTimeout(1100)
        await openWeekGroup(kjPage, ja.mealPlan.weekGroupAutoTitle)
      }
      const kjFillValue = async () =>
        (await kjPage.locator('[data-testid="fill-mode"]').first().inputValue())
      /** 「現在の条件」の窓を開いて調理時間の値を読み、閉じる */
      const kjMinutesValue = async () => {
        await kjPage.locator('[data-testid="plan-conditions-open"]').first().click()
        await kjPage.waitForTimeout(600)
        const value = await kjPage.locator('[data-testid="plan-quick-minutes"]').first().inputValue()
        await kjPage.locator('[data-testid="plan-conditions-close"]').first().click()
        await kjPage.waitForTimeout(400)
        return value
      }

      await kjPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await kjPage.waitForTimeout(2400)
      await kjGoWeek()
      check(
        'KJSTATE-01 前提: 「入れかた」の選び口を掴めた',
        (await kjPage.locator('[data-testid="fill-mode"]').count()) === 1,
      )
      check(
        'KJSTATE-01 触る前は非破壊の「空いた枠だけ」から始まる（既定は変えない）',
        (await kjFillValue()) === 'fillEmpty',
        `値=${await kjFillValue()}`,
      )
      // 消える側を選ぶ前に、この週を献立で埋めておく（消すものが無いと確認の窓が出ないため）
      await kjPage.locator('[data-testid="week-fill-run"]').first().click()
      await kjPage.waitForTimeout(2600)
      await kjPage.locator('[data-testid="fill-mode"]').first().selectOption('replaceAll')
      await kjPage.waitForTimeout(500)
      await kjPage.locator('[data-testid="plan-conditions-open"]').first().click()
      await kjPage.waitForTimeout(600)
      await kjPage.locator('[data-testid="plan-quick-minutes"]').first().selectOption('20')
      await kjPage.waitForTimeout(500)
      await kjPage.locator('[data-testid="plan-conditions-close"]').first().click()
      await kjPage.waitForTimeout(400)

      // ①「タブ移動」＝下の並びで別のタブへ移って戻る（オーナーが実機で踏んだ順番）
      await kjPage.getByRole('link', { name: ja.nav.recipes }).first().click()
      await kjPage.waitForTimeout(1600)
      await kjPage.getByRole('link', { name: ja.nav.mealPlan }).first().click()
      await kjPage.waitForTimeout(1800)
      await kjGoWeek()
      check(
        'KJSTATE-01 タブを移って戻っても「入れかた」は選んだまま（総入れ替え）',
        (await kjFillValue()) === 'replaceAll',
        `値=${await kjFillValue()}`,
      )
      check(
        'KJSTATE-01 タブを移って戻っても「調理時間」は選んだまま（20分）',
        (await kjMinutesValue()) === '20',
        `値=${await kjMinutesValue()}`,
      )

      // ②アプリを開き直しても同じ（画面の中だけで覚えていないこと）
      await kjPage.reload({ waitUntil: 'networkidle' })
      await kjPage.waitForTimeout(2200)
      await kjGoWeek()
      check(
        'KJSTATE-01 開き直しても「入れかた」は選んだまま',
        (await kjFillValue()) === 'replaceAll',
        `値=${await kjFillValue()}`,
      )
      check(
        'KJSTATE-01 開き直しても「調理時間」は選んだまま',
        (await kjMinutesValue()) === '20',
        `値=${await kjMinutesValue()}`,
      )

      // ③覚えていても、消える操作は黙って走らない（規約F・オーナーの安全の読みが崩れていないこと）。
      // オーナーは「総入れ替えだと確認画面も出るので、総入れ替えに気づかない仕組みには
      // なっていない」と**安全まで見たうえで**選択を残すよう求めているので、そこが崩れて
      // いないことを同じ節で測る。
      // e2e の仕掛けは確認の窓を出た瞬間に押してしまう（installConfirmAutoPress）ので、
      // 「出たかどうか」は画面を掴みにいかず、貯め口（window.__confirmDialogs）で見る
      await kjPage.evaluate(() => {
        window.__confirmDialogs = []
      })
      await kjPage.locator('[data-testid="week-fill-run"]').first().click()
      await kjPage.waitForTimeout(2800)
      const kjConfirms = (await readConfirms(kjPage)).map(stripZwspText)
      check(
        'KJSTATE-01 総入れ替えを選んだまま実行しても、消える前に確認の窓が出る',
        kjConfirms.some((t) => t.includes(ja.mealPlan.fillModeReplaceAllConfirmTitle)),
        JSON.stringify(kjConfirms),
      )
      check(
        'KJSTATE-01 その確認は「消えるもの」と「残るもの」を両方書く（規約F）',
        kjConfirms.some(
          (t) =>
            t.includes(ja.mealPlan.fillModeReplaceAllGoneLabel) &&
            t.includes(ja.mealPlan.fillModeReplaceAllKeptLabel),
        ),
        JSON.stringify(kjConfirms),
      )

      // ④「条件をクリア」で消したら、消えたことも覚える（画面だけ戻って保存が残る、を作らない）。
      // 「条件をクリア」は条件を1つも選んでいないあいだ見えない（場所だけ取る）ので、
      // 押す直前にこの画面でもう一度選んでから押す＝直す前・直したあとのどちらでも押せる形にする
      await kjPage.locator('[data-testid="plan-conditions-open"]').first().click()
      await kjPage.waitForTimeout(600)
      await kjPage.locator('[data-testid="plan-quick-minutes"]').first().selectOption('20')
      await kjPage.waitForTimeout(600)
      const kjClear = kjPage.locator('[data-testid="plan-conditions-clear"]').first()
      check('KJSTATE-01 前提: 条件を選んでいるので「条件をクリア」が押せる', await kjClear.isVisible())
      if (await kjClear.isVisible()) {
        await kjClear.click({ timeout: 5000 })
        await kjPage.waitForTimeout(700)
      }
      await kjPage.locator('[data-testid="plan-conditions-close"]').first().click()
      await kjPage.waitForTimeout(400)
      await kjPage.reload({ waitUntil: 'networkidle' })
      await kjPage.waitForTimeout(2200)
      await kjGoWeek()
      check(
        'KJSTATE-01 「条件をクリア」で外した調理時間は、開き直しても外れたまま',
        (await kjMinutesValue()) === '',
        `値=${await kjMinutesValue()}`,
      )
    } finally {
      await kjBrowser.close()
    }
  }

  // --- KJFOLD-02(2026-08-24 便KJ・②): 過ぎた日を畳んだカードは、一回り細い ---
  //
  // オーナー原文: 「過去に日付は折りたたみ時の枠を一回り細くしてほしい。
  //   一番下が今日の時にスクロールが長い。」＝**実用の問題**（今日へたどり着くまでが長い）。
  //
  // 曜日に依らない測り方にする（禁じ手①）: 前の週へ送れば7日とも過ぎた日、
  // 次の週へ送れば7日とも先の日になる。どちらも献立が無ければ既定で畳んである。
  // 測るのは「畳んだ1日ぶんの高さ」と「7日ぶんの縦の長さ」、そして**押して開く見出しが
  // 44px（--tap-min）を保っているか**。細くしたせいで押せなくなっては本末転倒なので必ず一緒に見る。
  currentCheck = 'KJFOLD-02'
  {
    const kfBrowser = await chromium.launch()
    const kfContext = await kfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kfPage = await kfContext.newPage()
    kfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KJFOLD-02] ${err.message}`)
    })
    try {
      await kfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await kfPage.waitForTimeout(2400)
      await kfPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await kfPage.waitForTimeout(1200)
      /** 畳み方が落ち着く（2回続けて同じになる）まで待ってから測る（禁じ手⑤） */
      const kfSettle = async () => {
        let prev = ''
        for (let i = 0; i < 20; i++) {
          await kfPage.waitForTimeout(150)
          const now = await kfPage
            .locator('[data-testid="week-day-toggle"]')
            .evaluateAll((els) =>
              els.map((el) => `${el.getAttribute('data-date')}:${el.getAttribute('aria-expanded')}`).join(','),
            )
          if (now === prev) return now
          prev = now
        }
        return prev
      }
      /** 畳んでいる7日ぶんの実測（1日ぶんの高さ・見出しの押せる高さ・7日ぶんの縦の長さ） */
      const kfMeasure = async () => {
        await kfSettle()
        return await kfPage.evaluate(() => {
          const secs = [...document.querySelectorAll('section[data-date]')]
          const folded = secs.filter(
            (s) => s.querySelector('[data-testid="week-day-toggle"]')?.getAttribute('aria-expanded') === 'false',
          )
          if (folded.length === 0) return null
          const heights = folded.map((s) => Math.round(s.getBoundingClientRect().height * 10) / 10)
          const taps = folded.map((s) => {
            const b = s.querySelector('[data-testid="week-day-toggle"]')
            return b ? Math.round(b.getBoundingClientRect().height * 10) / 10 : 0
          })
          const first = secs[0].getBoundingClientRect()
          const last = secs[secs.length - 1].getBoundingClientRect()
          return {
            foldedCount: folded.length,
            cardHeight: Math.max(...heights),
            tapHeight: Math.min(...taps),
            span: Math.round((last.bottom - first.top) * 10) / 10,
          }
        })
      }
      // 前の週＝7日とも過ぎた日
      await kfPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
      const kfPast = await kfMeasure()
      // 次の週へ2回送る＝7日とも先の日
      await kfPage.getByRole('button', { name: ja.mealPlan.nextWeek }).first().click()
      await kfPage.waitForTimeout(400)
      await kfPage.getByRole('button', { name: ja.mealPlan.nextWeek }).first().click()
      const kfFuture = await kfMeasure()
      check(
        'KJFOLD-02 前提: 過ぎた週も先の週も7日とも畳んだ状態を測れた',
        kfPast !== null && kfFuture !== null && kfPast.foldedCount === 7 && kfFuture.foldedCount === 7,
        `過ぎた週=${JSON.stringify(kfPast)} 先の週=${JSON.stringify(kfFuture)}`,
      )
      if (kfPast !== null && kfFuture !== null) {
        check(
          'KJFOLD-02 過ぎた日の畳んだカードは、先の日の畳んだカードより一回り細い（8px以上低い）',
          kfPast.cardHeight <= kfFuture.cardHeight - 8,
          `過ぎた日=${kfPast.cardHeight}px 先の日=${kfFuture.cardHeight}px 差=${Math.round((kfFuture.cardHeight - kfPast.cardHeight) * 10) / 10}px`,
        )
        check(
          'KJFOLD-02 細くしても、押して開く見出しは44px（--tap-min）を保っている',
          kfPast.tapHeight >= 44,
          `見出しの押せる高さ=${kfPast.tapHeight}px`,
        )
        check(
          'KJFOLD-02 7日ぶんの縦の長さが、細くした分だけ縮んでいる（56px以上）',
          kfPast.span <= kfFuture.span - 56,
          `過ぎた週=${kfPast.span}px 先の週=${kfFuture.span}px 差=${Math.round((kfFuture.span - kfPast.span) * 10) / 10}px`,
        )
      }
      // 細くしたのは畳んでいるあいだだけ＝開けば今までどおりの余白に戻る（行き止まりを作らない）
      await kfPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
      await kfPage.waitForTimeout(400)
      await kfPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
      await kfSettle()
      await openAllWeekDays(kfPage)
      await kfPage.waitForTimeout(600)
      const kfOpened = await kfPage.evaluate(() => {
        const s = document.querySelector('section[data-date]')
        if (!s) return null
        const cs = getComputedStyle(s)
        return { padTop: Math.round(parseFloat(cs.paddingTop)), height: Math.round(s.getBoundingClientRect().height) }
      })
      check(
        'KJFOLD-02 開けば過ぎた日のカードも今までどおりの余白に戻る（16px）',
        kfOpened !== null && kfOpened.padTop === 16,
        JSON.stringify(kfOpened),
      )
    } finally {
      await kfBrowser.close()
    }
  }

  // --- KJTHEME-03(2026-08-24 便KJ・②): 細くした過ぎた日のカードが、5テーマとも枠線で見分けられる ---
  //
  // 便IU・③（プルダウンの地色が置かれている面と枠1本しか違わなかった）と同じ見落としを、
  // 「細くしたら線が見えなくなっていないか」で見張る。測るのは**実際に塗られる色**
  // （過ぎた日の面は color-mix() で作っているので、キャンバスに1px塗ってブラウザが描く値を読む）。
  // 直接の色の値は書かない＝**見分けが付くか**と**文字が読めるか**だけを測る。
  currentCheck = 'KJTHEME-03'
  {
    const ktDist = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
    const ktLum = (c) => {
      const f = (v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const ktRatio = (a, b) => (Math.max(ktLum(a), ktLum(b)) + 0.05) / (Math.min(ktLum(a), ktLum(b)) + 0.05)
    const ktHex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const ktBrowser = await chromium.launch()
    try {
      for (const [ktTheme, ktLabel, ktScheme] of [
        ['auto', '自動（端末=ライト）', 'light'],
        ['auto', '自動（端末=ダーク）', 'dark'],
        ['light', 'ライト', 'dark'],
        ['dark', 'ダーク', 'light'],
        ['brown', 'ブラウン', 'light'],
        ['green', 'グリーン', 'dark'],
      ]) {
        const ktContext = await ktBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: ktScheme,
        })
        const ktPage = await ktContext.newPage()
        try {
          await ktPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await ktPage.waitForTimeout(2400)
          await ktPage.evaluate(async (theme) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
            const cur = await P(idb.transaction('settings').objectStore('settings').get(1))
            await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({ ...(cur || {}), id: 1, theme }))
            idb.close()
          }, ktTheme)
          await ktPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
          await ktPage.reload({ waitUntil: 'networkidle' })
          await ktPage.waitForTimeout(2000)
          await ktPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await ktPage.waitForTimeout(1200)
          await ktPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
          await ktPage.waitForTimeout(1400)
          const ktSeen = await ktPage.evaluate(() => {
            const cvs = document.createElement('canvas').getContext('2d')
            const toRgb = (v) => {
              cvs.clearRect(0, 0, 1, 1)
              cvs.fillStyle = v
              cvs.fillRect(0, 0, 1, 1)
              const d = cvs.getImageData(0, 0, 1, 1).data
              return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
            }
            const behindOf = (el) => {
              let p = el.parentElement
              while (p) {
                const bg = getComputedStyle(p).backgroundColor
                if (toRgb(bg).a > 0) return toRgb(bg)
                p = p.parentElement
              }
              return toRgb('rgb(255,255,255)')
            }
            const section = [...document.querySelectorAll('section[data-date]')].find(
              (s) => s.querySelector('[data-testid="week-day-toggle"]')?.getAttribute('aria-expanded') === 'false',
            )
            if (!section) return null
            const cs = getComputedStyle(section)
            const label = section.querySelector('[data-testid="week-day-toggle"] span')
            return {
              border: toRgb(cs.borderTopColor),
              face: toRgb(cs.backgroundColor),
              behind: behindOf(section),
              height: Math.round(section.getBoundingClientRect().height),
              text: label ? toRgb(getComputedStyle(label).color) : null,
            }
          })
          check(
            `KJTHEME-03 [${ktLabel}] 前提: 畳んだ過ぎた日のカードを掴めた`,
            ktSeen !== null && ktSeen.text !== null,
            JSON.stringify(ktSeen),
          )
          if (ktSeen === null || ktSeen.text === null) {
            await ktContext.close()
            continue
          }
          check(
            `KJTHEME-03 [${ktLabel}] 細くしたカードの枠線が、後ろの画面と見分けられる`,
            ktDist(ktSeen.border, ktSeen.behind) >= 20,
            `線=${ktHex(ktSeen.border)} 後ろ=${ktHex(ktSeen.behind)} 差=${ktDist(ktSeen.border, ktSeen.behind).toFixed(1)}`,
          )
          // 下限8は「線が面に溶けていない」ことだけを見る値（枠線は1pxの細い線なので、
          // 塗りつぶしの印を測る IZTHEME-02 の20とは別に決める）。
          // この節を足した時点の実測（390×844・過ぎた日の畳んだカード）:
          // ライト39.2 / 自動ライト39.2 / ダーク15.2 / 自動ダーク15.2 / ブラウン12.3 / グリーン27.5。
          // いちばん薄いブラウンでも12.3あるので、8を割るのは線の色を面に近づけたときだけになる
          check(
            `KJTHEME-03 [${ktLabel}] 枠線がカードの面とも見分けられる（線が面に溶けない）`,
            ktDist(ktSeen.border, ktSeen.face) >= 8,
            `線=${ktHex(ktSeen.border)} 面=${ktHex(ktSeen.face)} 差=${ktDist(ktSeen.border, ktSeen.face).toFixed(1)}`,
          )
          check(
            `KJTHEME-03 [${ktLabel}] 細くしても日付の文字が読める（AA 4.5:1以上）`,
            ktRatio(ktSeen.text, ktSeen.face) >= 4.5,
            `${ktRatio(ktSeen.text, ktSeen.face).toFixed(2)}:1`,
          )
        } finally {
          await ktContext.close()
        }
      }
    } finally {
      await ktBrowser.close()
    }
  }

  // --- KJLOG-04(2026-08-24 便KJ・③): 「作った記録」の窓の作法を、他の窓にそろえる ---
  //
  // オーナー原文: 「週や月から出る窓の「作った記録」の一番下を「閉じる」にして。
  //   他の窓の一番下が「閉じる」なのにここだけ違うと誤タップしそう。
  //   「レシピを見る」はボタンではなく文字のリンクにして小さく。ばしょも日付横右端あたりに移動。」
  //
  // 誤タップの中身は「他の窓で閉じるがある場所に、別の場所へ移る大きなボタンが置いてある」こと。
  // なので測るのは①窓の一番下にあるものが「閉じる」か ②「レシピを見る」が日付の行の右端の
  // 小さな文字リンクになっているか ③それでも押せる大きさ（44px）か ④レシピへ行く道が残っているか。
  currentCheck = 'KJLOG-04'
  {
    const klBrowser = await chromium.launch()
    const klContext = await klBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const klPage = await klContext.newPage()
    klPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KJLOG-04] ${err.message}`)
    })
    try {
      const klPad = (n) => String(n).padStart(2, '0')
      const klYd = new Date()
      klYd.setDate(klYd.getDate() - 1)
      const klYesterday = `${klYd.getFullYear()}-${klPad(klYd.getMonth() + 1)}-${klPad(klYd.getDate())}`
      const klTitle = '肉じゃが'
      await klPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await klPage.waitForTimeout(2400)
      await klPage.evaluate(async ([date, title]) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result)
          req.onerror = () => rej(req.error)
        })
        await new Promise((res, rej) => {
          const tx = idb.transaction('recipes', 'readwrite')
          const store = tx.objectStore('recipes')
          const g = store.getAll()
          g.onsuccess = () => {
            const r = g.result.find((x) => x.title === title)
            if (!r) {
              rej(new Error('仕込むレシピが見つからない'))
              return
            }
            r.cookedLogs = [{ date, servings: 3 }, ...(r.cookedLogs ?? [])]
            store.put(r)
          }
          tx.oncomplete = () => res(undefined)
          tx.onerror = () => rej(tx.error)
        })
        idb.close()
      }, [klYesterday, klTitle])
      // 生のIndexedDBへ書いたので必ず読み込み直す（禁じ手⑥）
      await klPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await klPage.reload({ waitUntil: 'networkidle' })
      await klPage.waitForTimeout(2200)
      await klPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await klPage.waitForTimeout(1200)
      // 仕込んだ日のカードが出る週まで送る（曜日に依らない。禁じ手①）
      for (let i = 0; i < 2; i++) {
        if ((await klPage.locator(`section[data-date="${klYesterday}"]`).count()) > 0) break
        await klPage.getByRole('button', { name: ja.mealPlan.prevWeek }).first().click()
        await klPage.waitForTimeout(1200)
      }
      check(
        'KJLOG-04 前提: 記録を仕込んだ日のカードが週タブに出ている',
        (await klPage.locator(`section[data-date="${klYesterday}"]`).count()) === 1,
      )
      await openAllWeekDays(klPage)
      await klPage.waitForTimeout(700)
      await klPage
        .getByRole('button', { name: ja.cookedDetail.openAria.replace('{title}', klTitle) })
        .first()
        .click()
      await klPage.waitForTimeout(900)
      const klDialogName = ja.cookedDetail.dialogAria.replace('{title}', klTitle)
      check(
        'KJLOG-04 前提: 週タブから「作った記録」の窓が開いた',
        (await klPage.getByRole('dialog', { name: klDialogName }).count()) === 1,
      )
      const klSeen = await klPage.evaluate((name) => {
        const dialog = document.querySelector(`div[role="dialog"][aria-label="${name}"]`)
        if (!dialog) return null
        const dr = dialog.getBoundingClientRect()
        const items = [...dialog.querySelectorAll('button, a')].filter((el) => {
          const r = el.getBoundingClientRect()
          return r.width > 0 && r.height > 0
        })
        const bottom = items.reduce((acc, el) =>
          el.getBoundingClientRect().bottom > acc.getBoundingClientRect().bottom ? el : acc,
        items[0])
        const link = dialog.querySelector('[data-testid="cooked-detail-open-recipe"]')
        const date = dialog.querySelector('[data-testid="cooked-detail-date"]')
        const dateRow = dialog.querySelector('[data-testid="cooked-detail-date-row"]')
        const title = dialog.querySelector('[data-testid="cooked-detail-title"]')
        const rectOf = (el) => {
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, h: Math.round(r.height * 10) / 10 }
        }
        /** .tap-target で広げた当たり判定も含めた高さ（::after の指定値を読む） */
        const tapHeightOf = (el) => {
          if (!el) return 0
          const own = el.getBoundingClientRect().height
          const after = getComputedStyle(el, '::after')
          const grown = parseFloat(after.height)
          return Math.round(Math.max(own, Number.isFinite(grown) ? grown : 0) * 10) / 10
        }
        return {
          dialog: { left: dr.left, right: dr.right, width: dr.width },
          bottomText: (bottom?.textContent ?? '').trim(),
          bottomTag: bottom?.tagName ?? null,
          link: link
            ? {
                tag: link.tagName,
                rect: rectOf(link),
                tapHeight: tapHeightOf(link),
                fontSize: Math.round(parseFloat(getComputedStyle(link).fontSize) * 10) / 10,
                borderWidth: Math.round(parseFloat(getComputedStyle(link).borderTopWidth) * 10) / 10,
                href: link.getAttribute('href'),
              }
            : null,
          dateRect: rectOf(date),
          dateRowRect: rectOf(dateRow),
          titleFontSize: title ? Math.round(parseFloat(getComputedStyle(title).fontSize) * 10) / 10 : null,
        }
      }, klDialogName)
      check('KJLOG-04 前提: 窓の中身を測れた', klSeen !== null, JSON.stringify(klSeen))
      if (klSeen !== null) {
        check(
          'KJLOG-04 窓の一番下は「閉じる」（他の窓と同じものが同じ場所にある）',
          stripZwspText(klSeen.bottomText) === ja.common.close,
          `一番下=${JSON.stringify(klSeen.bottomText)}`,
        )
        check(
          'KJLOG-04 「レシピを見る」が窓の中にある（小さくしただけで、行けなくしていない）',
          klSeen.link !== null,
          JSON.stringify(klSeen.link),
        )
      }
      if (klSeen !== null && klSeen.link !== null && klSeen.dateRect !== null) {
        check(
          'KJLOG-04 「レシピを見る」はボタンではなく文字のリンク（枠線を持たない<a>）',
          klSeen.link.tag === 'A' && klSeen.link.borderWidth === 0,
          `tag=${klSeen.link.tag} 枠線=${klSeen.link.borderWidth}px`,
        )
        check(
          'KJLOG-04 「レシピを見る」は日付と同じ行にある（縦に重なっている）',
          Math.min(klSeen.link.rect.bottom, klSeen.dateRect.bottom) -
            Math.max(klSeen.link.rect.top, klSeen.dateRect.top) >
            0,
          `リンク=${JSON.stringify(klSeen.link.rect)} 日付=${JSON.stringify(klSeen.dateRect)}`,
        )
        check(
          'KJLOG-04 「レシピを見る」は日付の右・その行の右端にある',
          klSeen.link.rect.left > klSeen.dateRect.right &&
            klSeen.dateRowRect !== null &&
            klSeen.dateRowRect.right - klSeen.link.rect.right <= 4 &&
            klSeen.link.rect.left > klSeen.dialog.left + klSeen.dialog.width / 2,
          `リンクの右端から行の右端まで=${klSeen.dateRowRect === null ? '測れず' : Math.round(klSeen.dateRowRect.right - klSeen.link.rect.right)}px 窓の中央=${Math.round(klSeen.dialog.left + klSeen.dialog.width / 2)} リンクの左端=${Math.round(klSeen.link.rect.left)}`,
        )
        check(
          'KJLOG-04 「レシピを見る」の字は料理名より小さい（14px以下）',
          klSeen.link.fontSize <= 14 &&
            klSeen.titleFontSize !== null &&
            klSeen.link.fontSize < klSeen.titleFontSize,
          `リンク=${klSeen.link.fontSize}px 料理名=${klSeen.titleFontSize}px`,
        )
        check(
          'KJLOG-04 小さくしても指で押せる（当たり判定44px以上）',
          klSeen.link.tapHeight >= 44,
          `当たり判定=${klSeen.link.tapHeight}px`,
        )
      }
      // 行き止まりにしない: 押せばレシピ詳細へ移る
      if ((await klPage.locator('[data-testid="cooked-detail-open-recipe"]').count()) === 1) {
        await klPage.locator('[data-testid="cooked-detail-open-recipe"]').first().click()
        await klPage.waitForTimeout(1200)
        check(
          'KJLOG-04 「レシピを見る」を押すとレシピ詳細へ移る（道は残っている）',
          /#\/recipes\/\d+/.test(klPage.url()),
          `url=${klPage.url()}`,
        )
      }
    } finally {
      await klBrowser.close()
    }
  }


  // ============================================================================
  // KMNAVI-01/02・KMFINISH-01: 並行調理ナビの上段・並べ替え・「完成！」の窓
  // （2026-08-25 便KM・オーナー書き溜め）
  //
  //   「・全体の目安約◯分→全体の調理時間約◯分
  //     　下の説明もながい。短く簡潔に。必要ない分は省いて。
  //     ・順番の入れ替えをしても元に戻せない。
  //     　上へ下へボタンの縦幅低くして。これのせいでページ全体が無駄に長い。
  //     ・完成押下後の窓の説明も長い。読みたい人だけ読めるように、折りたたんでしまうか、
  //     　さらに別の窓で表示のにしたい。」
  //
  //   KMNAVI-01 全体の分数の見出しと、その下の説明の量／上へ・下への見た目の高さと当たり判定
  //   KMNAVI-02 動かした直後にその場で1回で戻せる（他の操作と同じトーストの「元に戻す」）
  //   KMFINISH-01 「完成！」の窓の説明は畳んであり、押した人だけが読める
  // ============================================================================
  currentCheck = 'KMNAVI-01'
  {
    const kmBrowser = await chromium.launch()
    const kmCtx = await kmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const kmPage = await kmCtx.newPage()
    kmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KM] ${err.message}`)
    })
    /** 段取りに出ている手順の本文（ゼロ幅スペース・改行を外して比べる） */
    const kmOrder = async () =>
      (await kmPage.locator('[data-testid="navi-step-text"]').allInnerTexts()).map((t) =>
        stripZwspText(t).replace(/\s+/g, ''),
      )
    try {
      await kmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kmPage.waitForTimeout(1800)
      await kmPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients: [], steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        const a = await P(store('recipes').add(mk('KM煮物', [
          { text: '大根を一口大に切る。', minutes: 4 },
          { text: '鍋に大根とだしを入れて中火で12分煮る。', minutes: 12 },
          { text: '器に盛る。', minutes: 2 },
        ])))
        const b = await P(store('recipes').add(mk('KM炒めもの', [
          { text: 'にんじんを細切りにする。', minutes: 3 },
          { text: 'フライパンで豚肉を炒める。', minutes: 5 },
          { text: '器に盛る。', minutes: 2 },
        ])))
        let addedAt = Date.now()
        for (const id of [a, b]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await kmPage.goto(`${BASE}/#/cook-navi`)
      await kmPage.reload({ waitUntil: 'networkidle' })
      await kmPage.waitForTimeout(1500)
      await kmPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await kmPage.waitForTimeout(1000)

      // --- KMNAVI-01: 見出しと、その下の説明の量 ---
      const kmEstimate = stripZwspText(
        await kmPage.locator('[data-testid="navi-total-estimate"]').innerText(),
      ).replace(/\s+/g, '')
      // 文言は ja.ts から組み立てる（画面の日本語を書き写さない・CLAUDE.md の禁じ手②）
      const kmEstimateRe = new RegExp(
        `^${ja.cookNavi.totalEstimate.replace(/\s+/g, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('\\{n\\}', '\\d+')}$`,
      )
      // 何と書くか（「全体の調理時間」）は ja.ts 側の見張り（test-logic の KM-1）が持つ。
      // ここが見るのは「ja.ts の文言がそのまま画面に出ているか」だけ（書き写さない）
      check(
        'KMNAVI-01 全体の分数の見出しが ja.ts の文言どおり出ている',
        kmEstimateRe.test(kmEstimate),
        `画面=${kmEstimate} 期待の形=${ja.cookNavi.totalEstimate}`,
      )
      // 「短く簡潔に。必要ない分は省いて。」＝この枠に載る字数そのものを見張る。
      // 文言が変わっても測り方は変わらない（言い回しに固定しない）
      const KM_CARD_LIMIT = 320
      // 掴めなかったときに30秒待って実行を中断させない（CLAUDE.md の禁じ手・2026-08-22 UI-390-01）。
      // 見つからなければその場で赤にして、後ろの節は走らせる
      const kmCardCount = await kmPage.locator('[data-testid="navi-total-card"]').count()
      const kmCardText =
        kmCardCount === 0
          ? ''
          : stripZwspText(await kmPage.locator('[data-testid="navi-total-card"]').innerText()).replace(/\s+/g, '')
      check(
        `KMNAVI-01 全体の分数の枠に載る字数が${KM_CARD_LIMIT}字以内`,
        kmCardCount === 1 && kmCardText.length <= KM_CARD_LIMIT,
        `枠の数=${kmCardCount} 実際=${kmCardText.length}字 中身=${kmCardText.slice(0, 320)}`,
      )

      // --- KMNAVI-01: 上へ・下へは見た目が低く、当たり判定は44pxのまま ---
      const kmTap = await kmPage.evaluate(() => {
        const out = []
        for (const sel of ['navi-step-up', 'navi-step-down']) {
          const el = document.querySelector(`[data-testid="${sel}"]`)
          if (!el) { out.push({ sel, found: false }); continue }
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          // 中心から上下21pxの点を突いて、そのボタンが受けるかを見る（TAP-44 と同じやり方）
          const dead = [[cx, cy - 21], [cx, cy + 21]].filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            return !(hit && (hit === el || el.contains(hit)))
          }).length
          out.push({ sel, found: true, h: Math.round(r.height), w: Math.round(r.width), dead })
        }
        return out
      })
      check('KMNAVI-01 前提: 上へ・下へのボタンが画面にある', kmTap.every((t) => t.found), JSON.stringify(kmTap))
      const KM_BTN_MAX_H = 34
      check(
        `KMNAVI-01 上へ・下への見た目の高さが${KM_BTN_MAX_H}px以下（ページを無駄に長くしない）`,
        kmTap.every((t) => t.found && t.h <= KM_BTN_MAX_H),
        JSON.stringify(kmTap),
      )
      check(
        'KMNAVI-01 見た目を低くしても、押せる大きさ44pxは保たれている',
        kmTap.every((t) => t.found && t.dead === 0),
        JSON.stringify(kmTap),
      )

      // --- KMNAVI-02: 動かした直後に、その場で1回で戻せる ---
      currentCheck = 'KMNAVI-02'
      const kmBefore = await kmOrder()
      check('KMNAVI-02 前提: 段取りが組めている', kmBefore.length >= 4, kmBefore.join(' | '))
      await kmPage.locator('[data-testid="navi-step-down"]').first().click()
      await kmPage.waitForTimeout(600)
      const kmMoved = await kmOrder()
      check(
        'KMNAVI-02 前提: 「下へ」で並びが変わる',
        kmMoved.join('|') !== kmBefore.join('|'),
        `前=${kmBefore.join(' | ')} 後=${kmMoved.join(' | ')}`,
      )
      const kmUndoBtn = kmPage.getByRole('button', { name: ja.common.undo })
      check(
        'KMNAVI-02 動かした直後に「元に戻す」がその場に出る（探しに行かなくてよい）',
        (await kmUndoBtn.count()) >= 1,
        `見つかった数=${await kmUndoBtn.count()}`,
      )
      if ((await kmUndoBtn.count()) >= 1) {
        await kmUndoBtn.first().click()
        await kmPage.waitForTimeout(600)
      }
      const kmBack = await kmOrder()
      check(
        'KMNAVI-02 1回押すだけで動かす前の並びに戻る',
        kmBack.join('|') === kmBefore.join('|'),
        `戻り=${kmBack.join(' | ')} 期待=${kmBefore.join(' | ')}`,
      )

      // --- KMFINISH-01: 「完成！」の窓の説明は畳んである ---
      currentCheck = 'KMFINISH-01'
      await kmPage.locator('[data-testid="cook-session-start"]').click()
      await kmPage.waitForTimeout(800)
      for (let i = 0; i < 40; i++) {
        if ((await kmPage.locator('[data-testid="cook-session-finish"]').count()) > 0) break
        await kmPage.locator('[data-testid="cook-session-next"]').click()
        await kmPage.waitForTimeout(120)
      }
      check(
        'KMFINISH-01 前提: 段取りの最後まで進めて「完成！」が出る',
        (await kmPage.locator('[data-testid="cook-session-finish"]').count()) === 1,
      )
      await kmPage.locator('[data-testid="cook-session-finish"]').click()
      await kmPage.waitForTimeout(800)
      const kmModal = kmPage.locator('[data-testid="cook-finish-modal"]')
      check('KMFINISH-01 前提: 「完成！」の窓が開く', (await kmModal.count()) === 1)
      const kmClosedText = stripZwspText(await kmModal.innerText()).replace(/\s+/g, '')
      // 畳んだ状態で読ませるのは「何品に記録が付くか」＝押す前に要る情報だけ
      check(
        'KMFINISH-01 畳んだ状態でも、何品に記録が付くかは読める',
        kmClosedText.includes('KM煮物') && kmClosedText.includes('KM炒めもの'),
        kmClosedText.slice(0, 240),
      )
      // 消えるもの・残るものの長い説明は、押すまで出さない
      const kmDetailMark = ja.cookNavi.markAllCookedConfirmEdit.replace(/\s+/g, '').slice(0, 12)
      check(
        'KMFINISH-01 長い説明は、開くまで出ていない',
        !kmClosedText.includes(kmDetailMark),
        `目印=${kmDetailMark} 中身=${kmClosedText.slice(0, 300)}`,
      )
      const KM_MODAL_CLOSED_LIMIT = 200
      check(
        `KMFINISH-01 畳んだ状態の窓の字数が${KM_MODAL_CLOSED_LIMIT}字以内`,
        kmClosedText.length <= KM_MODAL_CLOSED_LIMIT,
        `実際=${kmClosedText.length}字 中身=${kmClosedText.slice(0, 300)}`,
      )
      const kmDetailBtn = kmPage.getByRole('button', { name: ja.cookNavi.sessionFinishDetailOpen ?? '' })
      const kmDetailBtnCount = ja.cookNavi.sessionFinishDetailOpen ? await kmDetailBtn.count() : 0
      check(
        'KMFINISH-01 「読む」ための入口が窓の中にある（行き止まりにしない）',
        kmDetailBtnCount === 1,
        `見つかった数=${kmDetailBtnCount} 文言=${ja.cookNavi.sessionFinishDetailOpen ?? '(未定義)'}`,
      )
      if (kmDetailBtnCount === 1) {
        await kmDetailBtn.first().click()
        await kmPage.waitForTimeout(700)
      }
      const kmOpenText = stripZwspText(await kmModal.innerText()).replace(/\s+/g, '')
      check(
        'KMFINISH-01 押すと、消えるもの・残るものの説明が読める（無くしていない）',
        kmOpenText.includes(kmDetailMark) && kmOpenText.length > kmClosedText.length,
        `開いた後=${kmOpenText.slice(0, 320)}`,
      )
      check(
        'KMFINISH-01 3つの行き先は畳んでも畳まなくても押せる',
        (await kmPage.locator('[data-testid="cook-finish-record"]').count()) === 1 &&
          (await kmPage.locator('[data-testid="cook-finish-back"]').count()) === 1 &&
          (await kmPage.locator('[data-testid="cook-finish-close"]').count()) === 1,
      )
    } finally {
      await kmBrowser.close()
    }
  }

  // ============================================================================
  // KOGAP-01〜04・KOMULTI-01（2026-08-25 便KO）: 取り込みで入らない項目と、複数料理の知らせ
  //
  //   影響範囲テストの取り込み実データ90品では、献立の絞り込みが読む項目
  //   （ジャンル・季節・時間帯・種別・手間レベル）が1つも入っていなかった。
  //
  //   KOGAP-01 取り込みが終わった直後に、入らなかった項目だけが1タップで選べる形で出る
  //   KOGAP-02 押さなくても保存できる／押した値はそのまま保存される
  //   KOGAP-03 説明は初回のみ・「今後表示しない」で消せる（2回目の取り込みでは出ない）
  //   KOGAP-04 設定から戻すと、また出る
  //   KOMULTI-01 1品に複数料理が入った取り込みだけを知らせる
  // ============================================================================
  currentCheck = 'KOGAP-01'
  {
    const koBrowser = await chromium.launch()
    const koCtx = await koBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const koPage = await koCtx.newPage()
    koPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@KO] ${err.message}`)
    })
    /** 貼り付けから取り込む（登録画面を開き直してから貼る＝前の入力を持ち越さない） */
    const koPaste = async (text) => {
      await koPage.goto(`${BASE}/#/recipes/new`)
      await koPage.reload({ waitUntil: 'networkidle' })
      await koPage.waitForTimeout(900)
      await koPage.getByText(ja.paste.open).click()
      await koPage.waitForTimeout(300)
      await koPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(text)
      await koPage.getByRole('button', { name: ja.paste.apply }).click()
      await koPage.waitForTimeout(700)
    }
    // ジャンル・季節・時間帯・手間レベルがどこにも書かれていない、ふつうの1品
    const KO_PLAIN =
      'KO取り込みの品\n2人分\n\n材料\n・鶏むね肉　200g\n・しょうゆ　大さじ1\n\n作り方\n1. 鶏むね肉を切る\n2. 5分焼く'
    try {
      // --- KOGAP-01: 入らなかった項目だけが並ぶ ---
      await koPaste(KO_PLAIN)
      const koGaps = koPage.locator('[data-testid="import-field-gaps"]')
      check('KOGAP-01 取り込みの結果に、入らなかった項目の並びが出る', (await koGaps.count()) === 1)
      const koRow = async (id) => (await koPage.locator(`[data-testid="${id}"]`).count()) === 1
      check(
        'KOGAP-01 ジャンル・季節・時間帯・手間レベルの4つが出ている（どれも取り込みでは入らない）',
        [
          await koRow('import-gap-genre'),
          await koRow('import-gap-season'),
          await koRow('import-gap-suitable-for'),
          await koRow('import-gap-effort'),
        ].every(Boolean),
      )
      // 種別は料理名から読み取れることがある。読み取れた品では並びに出さない（入ったものを出さない）
      const koDishTypePressed = await koPage.evaluate(
        () => document.querySelectorAll('[data-testid="import-gap-dish-type"] [aria-pressed="true"]').length,
      )
      const koDishTypeShown = await koRow('import-gap-dish-type')
      check(
        'KOGAP-01 種別は、料理名から読み取れなかったときだけ出る（読み取れた品では出さない）',
        !koDishTypeShown || koDishTypePressed === 0,
        `並びが出ている=${koDishTypeShown} 選ばれている数=${koDishTypePressed}`,
      )
      check(
        'KOGAP-01 選ぶ部品は「くわしく」タブと同じもの（同じ並び・同じ押し方）',
        (await koPage.locator('[data-testid="import-gap-season"] button[aria-pressed]').count()) === 4,
      )
      // 掴めなかったときに30秒待って実行を中断させない（CLAUDE.md の禁じ手・2026-08-22 UI-390-01）。
      // 見つからなければその場で赤にして、後ろの節は走らせる
      // 手間レベルは「選ばなければ普通」なので、押すまでどれも塗らない
      // （選んでいないのに選んだ顔になると、入っていない項目だという話と食い違う）
      check(
        'KOGAP-01 手間レベルは、押すまでどれも選ばれていない（既定の「普通」を塗らない）',
        (await koPage.locator('[data-testid="import-gap-effort"] button[aria-pressed="true"]').count()) === 0,
      )
      const koGapText =
        (await koGaps.count()) === 0 ? '' : stripZwspText(await koGaps.innerText()).replace(/\s+/g, '')
      check(
        'KOGAP-01 何の並びかが見出しで分かる',
        koGapText.includes(ja.form.importGapTitle.replace(/\s+/g, '')),
        koGapText.slice(0, 160),
      )
      // 390px: 横にはみ出さない（項目を足しても、押せる幅のまま収まる）
      const koOverflow = await koPage.evaluate(() => {
        const box = document.querySelector('[data-testid="import-field-gaps"]')
        if (!box) return null
        const r = box.getBoundingClientRect()
        return {
          right: Math.round(r.right),
          width: Math.round(r.width),
          height: Math.round(r.height),
          bodyScroll: document.documentElement.scrollWidth,
          minBtn: Math.min(
            ...[...box.querySelectorAll('button')].map((b) => Math.round(b.getBoundingClientRect().height)),
          ),
        }
      })
      check(
        'KOGAP-01 390pxで横にはみ出さず、ボタンの高さは44px以上',
        !!koOverflow && koOverflow.right <= 390 && koOverflow.bodyScroll <= 390 && koOverflow.minBtn >= 44,
        JSON.stringify(koOverflow),
      )

      // --- KOGAP-03: 説明は初回のみ・「今後表示しない」で消せる ---
      currentCheck = 'KOGAP-03'
      check(
        'KOGAP-03 初回の取り込みでは、入らない項目があることの説明が出る',
        (await koPage.locator('[data-testid="import-gap-notice"]').count()) === 1,
      )
      const koHide = koPage.locator('[data-testid="import-gap-notice-hide"]').first()
      check('KOGAP-03 「今後表示しない」がある', (await koHide.count()) === 1)
      if (await koHide.count()) {
        await koHide.click()
        await koPage.waitForTimeout(300)
      }
      check(
        'KOGAP-03 押すとその場で説明が消える（並びは残る＝設定はそのまま続けられる）',
        (await koPage.locator('[data-testid="import-gap-notice"]').count()) === 0 &&
          (await koPage.locator('[data-testid="import-field-gaps"]').count()) === 1,
      )

      // --- KOGAP-02: 1タップで選べて、押さなくても保存できる ---
      currentCheck = 'KOGAP-02'
      const koGenreBtn = koPage.locator('[data-testid="import-gap-genre"] button').first()
      const koEffortBtn = koPage.locator('[data-testid="import-gap-effort"] button').first()
      if (await koGenreBtn.count()) {
        await koGenreBtn.click()
        await koPage.waitForTimeout(200)
      }
      if (await koEffortBtn.count()) {
        await koEffortBtn.click()
        await koPage.waitForTimeout(200)
      }
      check(
        'KOGAP-02 押すと、その並びは消えずに選んだ状態になる（選び直せる）',
        (await koPage.locator('[data-testid="import-gap-genre"] button[aria-pressed="true"]').count()) === 1 &&
          (await koPage.locator('[data-testid="import-gap-effort"] button[aria-pressed="true"]').count()) === 1,
      )
      // 選んだジャンルは「くわしく」タブのタグにも入っている（絞り込みが読むのと同じ形）
      await koPage.getByRole('tab', { name: ja.form.formTabDetail }).click()
      await koPage.waitForTimeout(400)
      const koDetailText = stripZwspText(await koPage.textContent('body')).replace(/\s+/g, '')
      check(
        'KOGAP-02 選んだジャンルは、絞り込みが読むタグとして入っている',
        koDetailText.includes(ja.mealPlan.genreLabel.replace(/\s+/g, '')) || koDetailText.includes('和食'),
        koDetailText.slice(0, 200),
      )
      await koPage.getByRole('button', { name: ja.form.save }).click()
      await koPage.waitForTimeout(1500)
      const koSaved = await koPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const all = await new Promise((res, rej) => {
          const q = db.transaction('recipes').objectStore('recipes').getAll()
          q.onsuccess = () => res(q.result)
          q.onerror = () => rej(q.error)
        })
        db.close()
        const one = all.filter((r) => r.title === 'KO取り込みの品').pop()
        return one ? { tags: one.tags, effortLevel: one.effortLevel } : null
      })
      check(
        'KOGAP-02 押した値がそのまま保存される',
        !!koSaved && koSaved.tags.includes('和食') && koSaved.effortLevel === 'easy',
        JSON.stringify(koSaved),
      )
      // 押さなくても保存できる（強制しない）
      await koPaste('KO何も押さない品\n2人分\n\n材料\n・豆腐　1丁\n\n作り方\n1. 豆腐を切る\n2. 盛る')
      await koPage.getByRole('button', { name: ja.form.save }).click()
      await koPage.waitForTimeout(1500)
      const koSavedPlain = await koPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const all = await new Promise((res, rej) => {
          const q = db.transaction('recipes').objectStore('recipes').getAll()
          q.onsuccess = () => res(q.result)
          q.onerror = () => rej(q.error)
        })
        db.close()
        return all.some((r) => r.title === 'KO何も押さない品')
      })
      check('KOGAP-02 1つも押さずに保存できる（強制しない）', koSavedPlain === true)

      // --- KOGAP-03（続き）: 2回目の取り込みでは説明が出ない ---
      currentCheck = 'KOGAP-03'
      await koPaste(KO_PLAIN)
      check(
        'KOGAP-03 2回目の取り込みでは説明が出ない（並びは出る）',
        (await koPage.locator('[data-testid="import-gap-notice"]').count()) === 0 &&
          (await koPage.locator('[data-testid="import-field-gaps"]').count()) === 1,
      )

      // --- KOGAP-04: 設定から戻せる ---
      currentCheck = 'KOGAP-04'
      await koPage.goto(`${BASE}/#/settings?section=recipe`)
      await koPage.reload({ waitUntil: 'networkidle' })
      await koPage.waitForTimeout(1200)
      const koSwitch = koPage.locator('[data-testid="import-gap-notice-switch"]')
      check('KOGAP-04 設定に戻す場所がある', (await koSwitch.count()) === 1)
      const koSwitchFound = (await koSwitch.count()) === 1
      check(
        'KOGAP-04 いまは切れている（一度出したので自動で切れた）',
        koSwitchFound && (await koSwitch.getAttribute('aria-checked')) === 'false',
      )
      if (koSwitchFound) {
        await koSwitch.click()
        await koPage.waitForTimeout(300)
      }
      check(
        'KOGAP-04 入れ直せる',
        koSwitchFound && (await koSwitch.getAttribute('aria-checked')) === 'true',
      )
      await koPaste(KO_PLAIN)
      check(
        'KOGAP-04 入れ直すと、次の取り込みでまた説明が出る',
        (await koPage.locator('[data-testid="import-gap-notice"]').count()) === 1,
      )

      // --- KOMULTI-01: 1品に複数料理が入った取り込みだけを知らせる ---
      currentCheck = 'KOMULTI-01'
      await koPaste(
        'KOねぎ使い切り3選\n2人分\n\n材料\n・ねぎ　3本\n・豚バラ肉　200g\n・にんじん　1本\n\n作り方\n1. ＜豚肉とねぎの炒めもの＞ ねぎを4cm幅に切る\n2. 豚肉を焼く\n3. 【にんじんのきんぴら】にんじんを千切りにする\n4. 炒める',
      )
      const koMulti = koPage.locator('[data-testid="import-multi-dish"]')
      check('KOMULTI-01 複数料理が入っていそうな取り込みでは知らせる', (await koMulti.count()) === 1)
      const koMultiText = (await koMulti.count()) ? stripZwspText(await koMulti.innerText()).replace(/\s+/g, '') : ''
      check(
        'KOMULTI-01 知らせは ja.ts の文言どおり（画面の日本語を書き写さない）',
        koMultiText === ja.form.importMultiDish.replace('{n}', '2').replace(/\s+/g, ''),
        `画面=${koMultiText} 期待=${ja.form.importMultiDish.replace('{n}', '2')}`,
      )
      check(
        'KOMULTI-01 分ける操作は出さない（知らせるだけ）',
        (await koPage.locator('[data-testid="import-multi-dish"] button').count()) === 0,
      )
      await koPaste(KO_PLAIN)
      check(
        'KOMULTI-01 ふつうの1品では知らせない',
        (await koPage.locator('[data-testid="import-multi-dish"]').count()) === 0,
      )
    } finally {
      await koBrowser.close()
    }
  }

  // ============================================================================
  // LG-03（2026-08-26 便LG）: レシピ登録画面（オーナーの書き溜め）
  //
  //   LG-03a 手順・材料の1行削除は、確認の窓をやめて「元に戻す」つきのトーストにする
  //   LG-03b 材料の「選んで削除」中は、手順の側を触れなくする／消したらトーストを出す／
  //          「完了」でも黙らない
  //   LG-03c 材料メモ・手順メモは「メモを追加」で開く（すでに文字があるときは開いた状態）
  //   LG-03d 「見える範囲を調整」は画像の直下
  //   LG-03e 印から合わせ調味料の組を作る（ビビンバ）
  // ============================================================================
  currentCheck = 'LG-03a'
  {
    const lgBrowser = await chromium.launch()
    const lgCtx = await lgBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const lgPage = await lgCtx.newPage()
    lgPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LG] ${err.message}`)
    })
    /** 登録画面を開き直す（前の入力を持ち越さない） */
    const lgOpenForm = async () => {
      await lgPage.goto(`${BASE}/#/recipes/new`)
      await lgPage.reload({ waitUntil: 'networkidle' })
      await lgPage.waitForTimeout(900)
    }
    try {
      // --- LG-03a: 1行削除は確認の窓を出さず、トーストで戻せる ---
      await lgOpenForm()
      await lgPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('LG消す手順')
      await lgPage.waitForTimeout(200)
      const lgStepDelete = lgPage
        .locator('[data-testid="step-section"]')
        .getByRole('button', { name: ja.form.removeRow })
        .first()
      await lgStepDelete.click()
      await lgPage.waitForTimeout(500)
      check(
        'LG-03a 手順の削除で確認の窓が出ない（テンポを止めない）',
        (await lgPage.locator('[data-testid="confirm"]').count()) === 0,
      )
      const lgToastText = stripZwspText(await lgPage.textContent('body'))
      check(
        `LG-03a 代わりに「${ja.form.rowRemovedToast}」のトーストが出る`,
        lgToastText.includes(ja.form.rowRemovedToast),
        lgToastText.slice(0, 160),
      )
      check(
        'LG-03a 手順の本文は画面から消えている',
        (await lgPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().inputValue()) === '',
      )
      // 「元に戻す」はトーストが消える前に押せる長さか（規約: 6秒で消えるトーストを
      // 消えたあとに読んでいた失敗例がある）。押せるまでの時間も測る
      const lgUndoStart = Date.now()
      const lgUndo = lgPage.getByRole('button', { name: ja.common.undo })
      check('LG-03a トーストに「元に戻す」が出る', (await lgUndo.count()) >= 1)
      await lgUndo.first().click()
      const lgUndoMs = Date.now() - lgUndoStart
      await lgPage.waitForTimeout(400)
      check(
        `LG-03a 「元に戻す」はトーストが消える前に押せる（押すまで${lgUndoMs}ms・自動で消えるのは6000ms）`,
        lgUndoMs < 6000,
        `${lgUndoMs}ms`,
      )
      check(
        'LG-03a 「元に戻す」で消した手順が戻る',
        (await lgPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().inputValue()) ===
          'LG消す手順',
      )

      // --- LG-03b: 「選んで削除」中は手順を触れなくする ---
      currentCheck = 'LG-03b'
      await lgOpenForm()
      await lgPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('LGにんじん')
      await lgPage.getByRole('button', { name: ja.form.addIngredient }).click()
      await lgPage.waitForTimeout(200)
      await lgPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).nth(1).fill('LGたまねぎ')
      await lgPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('LG手順')
      await lgPage.waitForTimeout(200)
      await lgPage.getByRole('button', { name: ja.form.ingredientOrganizeToggle }).click()
      await lgPage.waitForTimeout(400)
      const lgStepBox = await lgPage.evaluate(() => {
        const el = document.querySelector('[data-testid="step-section"]')
        if (!el) return null
        const cs = getComputedStyle(el)
        return { inert: el.hasAttribute('inert'), opacity: cs.opacity, pointerEvents: cs.pointerEvents }
      })
      check(
        'LG-03b 材料を選んでいる間、手順の枠は薄くなり触れない',
        lgStepBox !== null &&
          lgStepBox.inert === true &&
          Number(lgStepBox.opacity) < 1 &&
          lgStepBox.pointerEvents === 'none',
        JSON.stringify(lgStepBox),
      )
      // 1件選んで消す → トーストが出る
      await lgPage.locator('[data-testid="ingredient-row"]').first().click()
      await lgPage.waitForTimeout(300)
      await lgPage
        .getByRole('button', { name: ja.form.ingredientOrganizeDeleteSelected.replace('{n}', '1') })
        .click()
      await lgPage.waitForTimeout(400)
      if ((await lgPage.locator('[data-testid="confirm-ok"]').count()) > 0) {
        await lgPage.locator('[data-testid="confirm-ok"]').click()
        await lgPage.waitForTimeout(500)
      }
      const lgBulkText = stripZwspText(await lgPage.textContent('body'))
      check(
        'LG-03b まとめて削除でも黙って消えない（件数入りのトーストが出る）',
        lgBulkText.includes(ja.form.ingredientOrganizeRemovedToast.replace('{n}', '1')),
        lgBulkText.slice(0, 200),
      )
      check(
        'LG-03b まとめて削除にも「元に戻す」が付く',
        (await lgPage.getByRole('button', { name: ja.common.undo }).count()) >= 1,
      )
      // 「完了」でも黙らない
      await lgOpenForm()
      await lgPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('LGにんじん')
      await lgPage.getByRole('button', { name: ja.form.addIngredient }).click()
      await lgPage.waitForTimeout(200)
      await lgPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).nth(1).fill('LGたまねぎ')
      await lgPage.waitForTimeout(200)
      await lgPage.getByRole('button', { name: ja.form.ingredientOrganizeToggle }).click()
      await lgPage.waitForTimeout(300)
      await lgPage.locator('[data-testid="ingredient-row"]').first().click()
      await lgPage.waitForTimeout(300)
      await lgPage.getByRole('button', { name: ja.form.ingredientOrganizeDone }).click()
      await lgPage.waitForTimeout(500)
      const lgDoneText = stripZwspText(await lgPage.textContent('body'))
      check(
        'LG-03b 「完了」で選択が外れたことと、消していないことを知らせる',
        lgDoneText.includes(ja.form.ingredientOrganizeDoneToast),
        lgDoneText.slice(0, 200),
      )
      check(
        'LG-03b 「完了」では材料は1件も消えていない',
        (await lgPage.locator('[data-testid="ingredient-row"]').count()) === 2,
      )

      // --- LG-03c: メモは「メモを追加」で開く ---
      currentCheck = 'LG-03c'
      await lgOpenForm()
      check(
        'LG-03c 材料メモの欄は、はじめは出ていない',
        (await lgPage.getByPlaceholder(ja.form.ingredientMemoPlaceholder).count()) === 0,
      )
      check(
        'LG-03c 手順メモの欄も、はじめは出ていない',
        (await lgPage.getByPlaceholder(ja.form.stepMemoPlaceholder).count()) === 0,
      )
      check(
        'LG-03c 代わりに「メモを追加」が材料と手順の両方に出る',
        (await lgPage.locator('[data-testid="ingredient-memo-add"]').count()) >= 1 &&
          (await lgPage.locator('[data-testid="step-memo-add"]').count()) >= 1,
      )
      // ページ全体の高さ（メモの欄を畳んだ効き目を測る）
      const lgHeightFolded = await lgPage.evaluate(() => document.body.scrollHeight)
      await lgPage.locator('[data-testid="ingredient-memo-add"]').first().click()
      await lgPage.locator('[data-testid="step-memo-add"]').first().click()
      await lgPage.waitForTimeout(400)
      check(
        'LG-03c 「メモを追加」を押すと、その行のメモの欄が出る',
        (await lgPage.getByPlaceholder(ja.form.ingredientMemoPlaceholder).count()) === 1 &&
          (await lgPage.getByPlaceholder(ja.form.stepMemoPlaceholder).count()) === 1,
      )
      const lgHeightOpen = await lgPage.evaluate(() => document.body.scrollHeight)
      check(
        `LG-03c 畳んでいるぶんページが短い（畳んだとき${lgHeightFolded}px → 2行開くと${lgHeightOpen}px）`,
        lgHeightFolded < lgHeightOpen,
        `${lgHeightFolded}px → ${lgHeightOpen}px`,
      )
      // 取り込みで文字が入った行は、押さなくても開いている
      await lgPage.goto(`${BASE}/#/recipes/new`)
      await lgPage.reload({ waitUntil: 'networkidle' })
      await lgPage.waitForTimeout(900)
      await lgPage.getByText(ja.paste.open).click()
      await lgPage.waitForTimeout(300)
      await lgPage
        .locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
        .fill('LGメモ入りの品\n2人分\n\n材料\n・鶏むね肉 1枚（250g）\n・しょうゆ 大さじ1\n\n作り方\n1. 焼く')
      await lgPage.getByRole('button', { name: ja.paste.apply }).click()
      await lgPage.waitForTimeout(900)
      check(
        'LG-03c 取り込みでメモが入った行は、押さなくても開いている',
        (await lgPage.getByPlaceholder(ja.form.ingredientMemoPlaceholder).count()) >= 1,
      )

      // --- LG-03d: 「見える範囲を調整」は画像の直下 ---
      currentCheck = 'LG-03d'
      await lgOpenForm()
      await lgPage.locator('input[type=file]').nth(1).setInputFiles({
        name: 'lg.png',
        mimeType: 'image/png',
        buffer: makeTestPng(120, 90),
      })
      await lgPage.waitForTimeout(900)
      const lgPhotoOrder = await lgPage.evaluate(() => {
        const focus = document.querySelector('[data-testid="photo-focus-open-form"]')
        if (!focus) return null
        const img = focus.parentElement?.querySelector('img')
        const take = [...document.querySelectorAll('button')].find((b) =>
          b.querySelector('svg') && b.textContent && b.textContent.length < 12 && b.textContent.includes('カメラ'),
        )
        const r = (el) => (el ? el.getBoundingClientRect() : null)
        return {
          imgBottom: r(img)?.bottom ?? null,
          focusTop: r(focus)?.top ?? null,
          takeTop: r(take)?.top ?? null,
        }
      })
      check(
        'LG-03d 「見える範囲を調整」は画像のすぐ下にある（カメラなどの3つより上）',
        lgPhotoOrder !== null &&
          lgPhotoOrder.focusTop !== null &&
          lgPhotoOrder.imgBottom !== null &&
          lgPhotoOrder.focusTop >= lgPhotoOrder.imgBottom - 1 &&
          (lgPhotoOrder.takeTop === null || lgPhotoOrder.focusTop < lgPhotoOrder.takeTop),
        JSON.stringify(lgPhotoOrder),
      )
      check(
        `LG-03d 画像の下端から「見える範囲を調整」の上端までは${
          lgPhotoOrder ? Math.round(lgPhotoOrder.focusTop - lgPhotoOrder.imgBottom) : '?'
        }px`,
        lgPhotoOrder !== null && lgPhotoOrder.focusTop - lgPhotoOrder.imgBottom < 24,
        JSON.stringify(lgPhotoOrder),
      )

      // --- LG-03e: 印から合わせ調味料の組を作る（ビビンバ） ---
      currentCheck = 'LG-03e'
      await lgPage.goto(`${BASE}/#/recipes/new`)
      await lgPage.reload({ waitUntil: 'networkidle' })
      await lgPage.waitForTimeout(900)
      await lgPage.getByText(ja.paste.open).click()
      await lgPage.waitForTimeout(300)
      // 印が名前の先頭に無い（＝取り込みでは組にならない）書き方で入れ、あとから組にできることを見る
      await lgPage
        .locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
        .fill('LGビビンバ\n2人分\n\n材料\n・ご飯 2杯分\n・牛ひき肉 150g\n・●しょうゆ 大さじ1\n・●砂糖 大さじ1/2\n・●コチュジャン 大さじ1\n\n作り方\n1. ●の調味料を合わせておく\n2. 牛ひき肉を炒める')
      await lgPage.getByRole('button', { name: ja.paste.apply }).click()
      await lgPage.waitForTimeout(900)
      const lgGroupLines = await lgPage.evaluate(
        () =>
          [...document.querySelectorAll('[data-testid="ingredient-row"]')].filter(
            (el) => el.style.borderLeft && el.style.borderLeft !== '',
          ).length,
      )
      check(
        'LG-03e 貼り付け取り込みは、●の3件をその場で同じ組にする（色の線が付く）',
        lgGroupLines === 3,
        `色の線が付いた行=${lgGroupLines}`,
      )
      check(
        'LG-03e 組ができたので「印から組を作る」は出さない（押しても何も起きないボタンを置かない）',
        (await lgPage.locator('[data-testid="ingredient-seasoning-run"]').count()) === 0 &&
          (await lgPage.locator('[data-testid="import-gap-seasoning-run"]').count()) === 0,
      )
      // 速記入力（1行ずつ足す道）は取り込みを通らない。組を作る入口がその場に出ること
      await lgOpenForm()
      // 印の付いていない材料も混ぜる（全部に同じ印が付いている並びは「行頭の飾り」として
      // 組にしない規則なので、実際のレシピと同じ形にする）
      for (const line of [
        'ご飯 2杯分',
        '牛ひき肉 150g',
        '●しょうゆ 大さじ1',
        '●砂糖 大さじ1/2',
        '●コチュジャン 大さじ1',
      ]) {
        await lgPage.getByPlaceholder(ja.form.quickIngredientPlaceholder).fill(line)
        await lgPage.getByRole('button', { name: ja.form.quickIngredientAdd }).click()
        await lgPage.waitForTimeout(250)
      }
      const lgRunButton = lgPage.locator('[data-testid="ingredient-seasoning-run"]')
      check(
        'LG-03e 速記入力で印つきの材料を並べると、「印から組を作る」が材料の欄に出る',
        (await lgRunButton.count()) === 1,
      )
      await lgRunButton.click()
      await lgPage.waitForTimeout(500)
      const lgQuickGroupLines = await lgPage.evaluate(
        () =>
          [...document.querySelectorAll('[data-testid="ingredient-row"]')].filter(
            (el) => el.style.borderLeft && el.style.borderLeft !== '',
          ).length,
      )
      check(
        'LG-03e 押すと3件が同じ組になる（印が消えただけで終わらない）',
        lgQuickGroupLines === 3,
        `色の線が付いた行=${lgQuickGroupLines}`,
      )
      check(
        'LG-03e 押したあとは入口が消える（もう作るものが無い）',
        (await lgRunButton.count()) === 0,
      )
      const lgDoneNote = stripZwspText(await lgPage.textContent('body'))
      check(
        'LG-03e 何をしたのかをその場に出す',
        lgDoneNote.includes(ja.form.importGapSeasoningDone.replace('{n}', '1')),
        lgDoneNote.slice(0, 200),
      )
    } finally {
      await lgBrowser.close()
    }
  }
