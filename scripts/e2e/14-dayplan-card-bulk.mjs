// ==========================================================================================
// e2e の節: 日の条件・カードの部品・まとめて削除
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
// この中の節: DAYPLANFILTER-01, CARDPARTS-01, DAYCOND-01, DAYONE-02, WEEKDICE-03, SUGGESTNG-04, PICKCOMPACT-05, FORMING-01, SETBACK-01, BULKDEL-01, AISLE-01
// ==========================================================================================
import './_shared.mjs'


  // --- DAYPLANFILTER-01(2026-08-19 便HT・オーナー原文「献立にも1品と同じように条件を絞る
  // 機能つければいいのでは？」／2026-08-19 便HY・オーナー原文「『在庫の食材から』を
  // ON/OFFするたびに献立の表示が切り替わらないようにして。変わるのは『おまかせで組む』押下後」)。
  //
  // 測るのは2つ。**選んだ条件が組まれた献立に効いているか**と、**それがいつ効くか**。
  // 画面に条件が出ているかではなく、出てくる料理で見る。
  //   ① 条件を変えただけでは、出ている献立が**変わらない**（勝手に組み替わらない）
  //   ② 変えたことは、押すボタンのそばで分かる（1行が出る）
  //   ③ 「おまかせで献立を組む」を押すと組み直り、10分以内の品だけになる（＝条件が効いている）
  //      押したあとは②の1行が消える（変えた条件が反映済みだと分かる）
  //   ④ 条件に合う品が1つも無いときは、条件を無視した献立を黙って出さない
  //   ⑤ 「お気に入り」で組み直すと、組まれた品がすべてお気に入りになる
  // 便HTはここを「条件を変えたら押さなくても組み直す」にしていた。オーナーの指摘で逆向きに
  // 直したので、この検査も向きごと入れ替えてある（在庫だけでなく**どの条件でも**据え置き）。
  // 仕込みは「調理時間で分かれる自分のレシピ」を作るのではなく、**同梱のレシピの調理時間を
  // そのまま使う**（レシピの中身に手を入れない）。判定は画面の料理名を IndexedDB の
  // レシピと突き合わせて行う＝表示の書式に依らない。
  // 禁じ手よけ: 曜日・月替わりの前提を置かない／文言の完全一致で測らない／品数・押す回数を
  // 決め打ちしない／要素の置き場所に固定しない（data-testid と名前で掴む）／
  // **料理名が1つも読めなかったときは合格に倒さず不合格にする** ---
  currentCheck = 'DAYPLANFILTER-01'
  {
    const pfBrowser = await chromium.launch()
    const pfContext = await pfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const pfPage = await pfContext.newPage()
    pfPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYPLANFILTER-01] ${text}`)
    })
    pfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYPLANFILTER-01] ${err.message}`)
    })
    const pfSection = () =>
      pfPage.locator('section').filter({ has: pfPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
    /**
     * いま組んである献立の料理名。**「献立」側の組（day-suggest-pair）からだけ**読む。
     * 1品側のカードを拾えるようにしておくと、既定が1品に戻ったときに1品の画面を
     * 献立として測って素通り合格する（2026-08-18 FS-06 と同じ倒れ方）。
     */
    const pfTitles = async () =>
      (
        await pfSection()
          .locator('[data-testid="day-suggest-pair"] [data-testid="day-suggest-result-title"]')
          .allTextContents()
      ).map((t) => t.replaceAll('​', '').trim())
    const pfRecipes = () =>
      pfPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result.transaction(['recipes'], 'readonly').objectStore('recipes').getAll()
              q.onsuccess = () =>
                resolve(
                  q.result.map((r) => ({
                    title: r.title,
                    cookMinutes: r.cookMinutes ?? null,
                    isFavorite: !!r.isFavorite,
                  })),
                )
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await pfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(2400) // 初回シード完了待ち
      await pfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await pfPage.reload({ waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(1800)
      const pfAll = await pfRecipes()
      const pfByTitle = new Map(pfAll.map((r) => [r.title, r]))

      // 献立側で測っていることを、この節のいちばん最初に固定する
      if ((await pfPage.locator('[data-testid="day-mode-plan"]').count()) === 1) {
        await pfPage.locator('[data-testid="day-mode-plan"]').click()
        await pfPage.waitForTimeout(1400)
      }
      check(
        'DAYPLANFILTER-01 前提: はじめの画面は「献立」で、組んだ献立が出ている',
        (await pfPage.locator('[data-testid="day-mode-plan"]').getAttribute('aria-pressed')) ===
          'true' && (await pfTitles()).length > 0,
        `組=${JSON.stringify(await pfTitles())}`,
      )
      // 前提: 10分以内のレシピと、10分を超えるレシピが両方ある（無いと①が測れない）
      check(
        'DAYPLANFILTER-01 前提: 10分以内の品と10分を超える品が両方ある',
        pfAll.some((r) => r.cookMinutes != null && r.cookMinutes > 0 && r.cookMinutes <= 10) &&
          pfAll.some((r) => r.cookMinutes != null && r.cookMinutes > 10),
      )

      // ①〜③ 「◯分以内」を10分にする → 押すまで変わらない → 押すと効く
      const pfConditions = pfSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
      check('DAYPLANFILTER-01 前提: 献立側でも「条件をしぼる」が押せる', (await pfConditions.count()) === 1)
      if ((await pfConditions.count()) === 1) {
        await pfConditions.click()
        await pfPage.waitForTimeout(500)
      }
      const pfBefore = await pfTitles()
      check('DAYPLANFILTER-01 前提: 条件を変える前の献立を読めた', pfBefore.length > 0)
      // 無いものを押して30秒待ち、節ごと「実行中断」で止まらないようにする
      // （止まると後ろの節まで走らないので、赤の中身が読めなくなる）
      const pfQuick = pfSection().getByRole('button', { name: jaRe(ja.dayStart.condQuick, { n: '' }, { end: true }) })
      check('DAYPLANFILTER-01 前提: 献立側で「◯分以内」が選べる', (await pfQuick.count()) >= 1)
      if ((await pfQuick.count()) >= 1) {
        await pfQuick.first().click()
        await pfPage.waitForTimeout(1200)
      }
      // 分数のチップ（10/15/20/30）から10分を選ぶ
      // 2026-08-19 便IA: 分数は最初から4つ並んでいるので、押しても選択肢は増えない
      const pfTen = pfSection().getByRole('button', { name: '10分以内', exact: true })
      check('DAYPLANFILTER-01 前提: 分数(10分以内)が選べる', (await pfTen.count()) >= 1)
      if ((await pfTen.count()) >= 1) {
        await pfTen.first().click()
        await pfPage.waitForTimeout(1500)
      }
      // 2026-08-19 便IA: 絞り込みは窓で開く。押すボタンは窓の裏なので、閉じてから押す
      const pfCloseConditions = () => pfPage.locator('[data-testid="day-conditions-close"]')
      if ((await pfCloseConditions().count()) === 1) {
        await pfCloseConditions().click()
        await pfPage.waitForTimeout(700)
      }
      const pfChangedNote = () => pfPage.locator('[data-testid="day-plan-condition-changed"]')
      {
        // ① 条件を変えただけでは、出ている献立は1品も入れ替わらない
        const titles = await pfTitles()
        check(
          'DAYPLANFILTER-01 条件を変えただけでは、出ている献立が組み直らない(2026-08-19 便HY)',
          pfBefore.length > 0 && JSON.stringify(titles) === JSON.stringify(pfBefore),
          `前=${JSON.stringify(pfBefore)} 後=${JSON.stringify(titles)}`,
        )
        // ② 変えたことは押すボタンのそばで分かる（画面が変わらない理由が読める）
        check(
          'DAYPLANFILTER-01 条件を変えると、押すボタンのそばに変えたことが出る',
          (await pfChangedNote().count()) === 1,
        )
        // ボタンより下に出す＝押すものが動かない（便HTの誤タップ対策を壊していない）
        const noteBox = (await pfChangedNote().count()) === 1 ? await pfChangedNote().boundingBox() : null
        const drawBox = await pfPage.locator('[data-testid="day-suggest-draw"]').boundingBox()
        check(
          'DAYPLANFILTER-01 その1行は決めてもらうボタンより下に出る(ボタンを押し下げない)',
          noteBox != null && drawBox != null && noteBox.y > drawBox.y,
          `1行y=${noteBox ? Math.round(noteBox.y) : '無し'} ボタンy=${drawBox ? Math.round(drawBox.y) : '無し'}`,
        )
      }
      // ③ 押すと組み直り、条件が効いた結果になる
      {
        await pfPage.locator('[data-testid="day-suggest-draw"]').click()
        await pfPage.waitForTimeout(1500)
        const titles = await pfTitles()
        const overs = titles.filter((t) => {
          const r = pfByTitle.get(t)
          return !r || r.cookMinutes == null || r.cookMinutes > 10
        })
        check(
          'DAYPLANFILTER-01 押すと「10分以内」が効いて、組まれた献立が10分以内の品だけになる',
          titles.length > 0 && overs.length === 0,
          `出た品=${JSON.stringify(titles)} はみ出し=${JSON.stringify(overs)}`,
        )
        check(
          'DAYPLANFILTER-01 押したあとは「変えた条件は…」の1行が消える',
          (await pfChangedNote().count()) === 0,
        )
      }

      // ④ 条件に合う品が1つも無いときは、**黙って条件を無視した献立を出さない**。
      // ここがいちばん分かりづらい倒れ方（絞ったのに効いていないように見える）なので、
      // お気に入りを1品も付けていない状態で「お気に入り」を選んで確かめる
      {
        await pfPage.reload({ waitUntil: 'networkidle' })
        await pfPage.waitForTimeout(2000)
        if ((await pfPage.locator('[data-testid="day-mode-plan"]').count()) === 1) {
          await pfPage.locator('[data-testid="day-mode-plan"]').click()
          await pfPage.waitForTimeout(1400)
        }
        const pfCond0 = pfSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
        if ((await pfCond0.count()) === 1) {
          await pfCond0.click()
          await pfPage.waitForTimeout(500)
        }
        const pfFav0 = pfSection().getByRole('button', { name: 'お気に入り', exact: true })
        check('DAYPLANFILTER-01 前提: お気に入りが選べる', (await pfFav0.count()) === 1)
        if ((await pfFav0.count()) === 1) {
          await pfFav0.click()
          await pfPage.waitForTimeout(800)
        }
        if ((await pfCloseConditions().count()) === 1) {
          await pfCloseConditions().click()
          await pfPage.waitForTimeout(700)
        }
        // 2026-08-19 便HY: 押すまでは組み直さないので、0件の知らせもここでは出ない
        check(
          'DAYPLANFILTER-01 条件を変えただけでは「組める献立がありませんでした」と先に言わない',
          !((await pfPage.textContent('body')) ?? '')
            .replaceAll('​', '')
            .includes(ja.mealPlan.todaySuggestNoPair),
        )
        await pfPage.locator('[data-testid="day-suggest-draw"]').click()
        await pfPage.waitForTimeout(1600)
        const pfBody0 = ((await pfPage.textContent('body')) ?? '').replaceAll('​', '')
        check(
          'DAYPLANFILTER-01 条件に合う品が無いときは、条件を無視した献立を黙って出さない',
          (await pfTitles()).length === 0 && pfBody0.includes(ja.mealPlan.todaySuggestNoPair),
          `組=${JSON.stringify(await pfTitles())}`,
        )
      }

      // ⑤ 「お気に入り」にして押すと、組まれた品がすべてお気に入りになる
      // お気に入りを2品だけ付ける（主菜と副菜が1品ずつ＝献立が組める最小の形）
      await pfPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const wanted = ['肉じゃが', 'ほうれん草のおひたし']
                const targets = g.result.filter((r) => wanted.includes(r.title))
                const tx = idb.transaction('recipes', 'readwrite')
                const store = tx.objectStore('recipes')
                for (const r of targets) store.put({ ...r, isFavorite: true })
                tx.oncomplete = () => resolve(targets.length)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await pfPage.reload({ waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(2000)
      if ((await pfPage.locator('[data-testid="day-mode-plan"]').count()) === 1) {
        await pfPage.locator('[data-testid="day-mode-plan"]').click()
        await pfPage.waitForTimeout(1400)
      }
      const pfConditions2 = pfSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
      if ((await pfConditions2.count()) === 1) {
        await pfConditions2.click()
        await pfPage.waitForTimeout(500)
      }
      const pfFav = pfSection().getByRole('button', { name: 'お気に入り', exact: true })
      check('DAYPLANFILTER-01 前提: 献立側で「お気に入り」が選べる', (await pfFav.count()) === 1)
      if ((await pfFav.count()) === 1) {
        await pfFav.click()
        await pfPage.waitForTimeout(800)
      }
      if ((await pfCloseConditions().count()) === 1) {
        await pfCloseConditions().click()
        await pfPage.waitForTimeout(700)
      }
      // 2026-08-19 便HY: 効かせるのは押したとき。押す前と押したあとで、同じ条件が
      // 「まだ効いていない」→「効いた」に変わることを1組で見る。
      // 押す前の判定は**料理名の中身ではなく、変えた印が出ているか**で行う
      // （たまたま引けた組がお気に入りと一致する回だけ落ちる、をしない）
      const pfNoteBefore = await pfPage.locator('[data-testid="day-plan-condition-changed"]').count()
      await pfPage.locator('[data-testid="day-suggest-draw"]').click()
      await pfPage.waitForTimeout(1600)
      {
        const favTitles = await pfTitles()
        const notFav = favTitles.filter((t) => !(pfByTitle.get(t) ? ['肉じゃが', 'ほうれん草のおひたし'].includes(t) : false))
        check(
          'DAYPLANFILTER-01 「お気に入り」にして押すと、お気に入りにした品だけで組まれる',
          favTitles.length > 0 && notFav.length === 0,
          `出た品=${JSON.stringify(favTitles)} お気に入りでない=${JSON.stringify(notFav)}`,
        )
        // 押す前は「まだ反映していない」と言っていて、押したら言わなくなる
        check(
          'DAYPLANFILTER-01 「お気に入り」を選んだ時点では、まだ反映していないと言っている',
          pfNoteBefore === 1,
          `変えた印=${pfNoteBefore}`,
        )
        check(
          'DAYPLANFILTER-01 押したあとは、その1行が消える',
          (await pfPage.locator('[data-testid="day-plan-condition-changed"]').count()) === 0,
        )
      }
    } finally {
      await pfBrowser.close()
    }
  }

  // --- CARDPARTS-01(2026-08-19 便HY・オーナー原文「レシピカードはフォーマットが揃っていれば、
  // それぞれの場所で不要な情報はなくしてシンプルにしたいのですが、どうでしょう？
  // 『今日なに作る？』だったら『基本レシピ』と食材表記はいらないように感じました。」)。
  //
  // 2026-08-21 便IU・①でオーナーが同じ引き算を今日の献立にも指示した（原文
  // 「・今日の献立のレシピカードは、基本レシピとか材料表記はなし。」）ので、見比べる相手を
  // 「今日の献立の行」から「レシピを探す一覧」へ移した。
  //
  // 測るのは「**同じレシピのカードが、場所によって載せる情報を変えているか**」。
  // 項目名を場所ごとに書き写して並べるのではなく、**同じ1品を3か所で見比べて**判定する:
  //   ① 「今日なに作る？」の候補には「基本レシピ」も主要食材のチップも出ない
  //   ② その同じ品を今日の献立に入れても、そちらにも出ない（便IU・①）
  //   ③ 同じ品を**レシピを探す一覧**で見ると両方とも出る
  //      （＝カードごと情報を落としたのではなく、場所で切り替えている）
  //   ④ 骨格は動かしていない: 料理名の大きさが2か所で同じで、オーナーがOKと言った16pxのまま
  //   ⑤ 候補カードからも、決め手になる手間（かんたん/ふつう/じっくり）は消えていない
  //
  // 見比べる品は**idで押さえる**（2026-08-21 便IU）。料理名で引くと、同じ名前の品が
  // 端末に2つあったときに別のレシピの主要食材と突き合わせてしまう
  // 主要食材のチップに出る名前は画面側と同じ関数（pickDisplayIngredientChips）で出す
  // ＝表示の書式や選び方が変わっても、書き写した名前が古くなって空振りすることがない。
  // 禁じ手よけ: 曜日・月替わりの前提を置かない／文言の完全一致で測らない（ゼロ幅スペースを外す）／
  // 押す回数を決め打ちしない（上限は保険と分かる書き方）／要素の置き場所に固定しない
  //（data-testid で掴み、入れ子の段数は見ない）。
  // **測る材料が取れなかったときは合格に倒さず不合格にする**（料理名が読めない・
  // 料理名に含まれない主要食材が1つも無い品しか引けなかった、はどちらも前提の不合格） ---
  currentCheck = 'CARDPARTS-01'
  {
    const cpBrowser = await chromium.launch()
    const cpContext = await cpBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const cpPage = await cpContext.newPage()
    cpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@CARDPARTS-01] ${text}`)
    })
    cpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@CARDPARTS-01] ${err.message}`)
    })
    const cpClean = (t) => (t ?? '').replaceAll('​', '').trim()
    const cpSection = () =>
      cpPage.locator('section').filter({ has: cpPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
    const cpCard = () => cpSection().locator('[data-testid="day-suggest-result"]').first()
    const cpTitleEl = () => cpSection().locator('[data-testid="day-suggest-result-title"]').first()
    /** 端末に入っているレシピ（主要食材のチップを検査側でも同じ関数で出すため） */
    const cpRecipes = () =>
      cpPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result.transaction(['recipes'], 'readonly').objectStore('recipes').getAll()
              q.onsuccess = () =>
                resolve(
                  q.result.map((r) => ({
                    id: r.id,
                    title: r.title,
                    isStarter: !!r.isStarter,
                    // 2026-08-23 便JP・③: 「普通」の品はカードに手間を出さなくなったので、
                    // 何が出ているはずかを、その品の値から決める（画面の文字だけでは決まらない）
                    effortLevel: r.effortLevel,
                    ingredients: (r.ingredients ?? []).map((i) => ({
                      name: i.name ?? '',
                      amount: i.amount ?? '',
                      unit: i.unit ?? '',
                    })),
                  })),
                )
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await cpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(2400) // 初回シード完了待ち
      await cpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await cpPage.reload({ waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(1800)
      const cpAll = await cpRecipes()
      const cpByTitle = new Map(cpAll.map((r) => [r.title, r]))
      check('CARDPARTS-01 前提: 端末のレシピを読めた', cpAll.length > 0)

      // 1品側に寄せる＝候補が1品だけになり、どのレシピを見比べるのかが決まる
      const cpOne = cpPage.locator('[data-testid="day-mode-one"]')
      check('CARDPARTS-01 前提: 「1品」への切り替えがある', (await cpOne.count()) === 1)
      if ((await cpOne.count()) === 1) {
        await cpOne.click()
        await cpPage.waitForTimeout(1000)
      }

      /**
       * 見比べに使える品が出るまで引き直す（上限は無限ループ避けの保険）。
       * 使えるのは「基本レシピの印を持ち、かつ**料理名に含まれない**主要食材がある」品
       * ＝料理名にその食材が入っていると、カードの文字に出ていても
       * 「チップが出ている」のか「料理名の一部」なのか切り分けられない
       */
      const CP_MAX_DRAWS = 12
      let cpTitle = ''
      let cpChips = []
      for (let i = 0; i < CP_MAX_DRAWS; i++) {
        cpTitle = cpClean(await cpTitleEl().textContent())
        const recipe = cpByTitle.get(cpTitle)
        if (recipe && recipe.isStarter) {
          cpChips = pickDisplayIngredientChips(recipe.ingredients)
            .map((c) => c.name)
            .filter((name) => name.length > 0 && !cpTitle.includes(name))
          if (cpChips.length > 0) break
        }
        cpChips = []
        await cpSection().getByRole('button', { name: ja.dayStart.shuffle }).click()
        await cpPage.waitForTimeout(600)
      }
      check(
        'CARDPARTS-01 前提: 見比べに使える候補が出た（基本レシピの印と、料理名に無い主要食材を持つ品）',
        cpTitle.length > 0 && cpChips.length > 0,
        `料理名=${cpTitle} 主要食材=${JSON.stringify(cpChips)}`,
      )

      // ① 「今日なに作る？」の候補には、基本レシピの印も主要食材のチップも出ない
      const cpCardText = cpClean(await cpCard().textContent())
      check(
        'CARDPARTS-01 「今日なに作る？」の候補に「基本レシピ」を出さない',
        cpTitle.length > 0 && !cpCardText.includes(ja.card.starterBadge),
        `カード=${cpCardText}`,
      )
      check(
        'CARDPARTS-01 「今日なに作る？」の候補に主要食材のチップを出さない',
        cpChips.length > 0 && cpChips.every((name) => !cpCardText.includes(name)),
        `カード=${cpCardText} 主要食材=${JSON.stringify(cpChips)}`,
      )
      // ④ 決め手になる手間は残っている（カードごと情報を落としたのではない）。
      //    2026-08-23 便JP・③で「普通」だけは出さなくなったので、その品の値で期待を分ける
      //    （画面の文字を書き写さず、端末に入っている値から「出ているはず/出ていないはず」を決める）
      const cpEffortWords = (text) => Object.values(ja.effort).filter((w) => text.includes(w))
      const cpSuggestEffort = cpByTitle.get(cpTitle)?.effortLevel
      check(
        'CARDPARTS-01 候補カードの手間は、既定値（普通）のときだけ出さない（便JP・③）',
        cpSuggestEffort != null &&
          (cpSuggestEffort === 'normal'
            ? cpEffortWords(cpCardText).length === 0
            : cpEffortWords(cpCardText).join(',') === ja.effort[cpSuggestEffort]),
        `手間=${cpSuggestEffort} カードに出ている手間=${JSON.stringify(cpEffortWords(cpCardText))}`,
      )
      const cpSuggestFont = await cpTitleEl().evaluate((el) => getComputedStyle(el).fontSize)

      // ② 同じ品を今日の献立に入れると、そちらのカードには両方とも出る
      await cpPage.locator('[data-testid="day-suggest-apply"]').click()
      await cpPage.waitForTimeout(600)
      const cpSlotButtons = cpPage.locator('[data-testid="today-slot-button"]')
      check('CARDPARTS-01 前提: 食事の枠を選ぶ窓が開く', (await cpSlotButtons.count()) === 3)
      if ((await cpSlotButtons.count()) === 3) {
        await cpPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
        await cpPage.waitForTimeout(1600)
      }
      /**
       * 入れた品を**idで押さえ直す**（2026-08-21 便IU）。
       * 「今日なに作る？」の候補は後から届くデータで引き直されることがあるので、
       * 読んだ料理名と実際に入った品がずれうる（禁じ手⑤）。いま入れた品＝
       * 今日の献立にいちばん後から入った1件を端末から読んで、そこから料理名と主要食材を出す
       */
      const cpToday = await cpPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result
                .transaction(['todayList'], 'readonly')
                .objectStore('todayList')
                .getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const cpAdded = [...cpToday].sort((a, b) => b.addedAt - a.addedAt)[0]
      const cpTarget = cpAll.find((r) => r.id === cpAdded?.recipeId)
      check(
        'CARDPARTS-01 前提: 入れた品をidで押さえられた',
        !!cpTarget,
        `id=${cpAdded?.recipeId}`,
      )
      if (cpTarget) {
        cpTitle = cpTarget.title
        cpChips = pickDisplayIngredientChips(cpTarget.ingredients)
          .map((c) => c.name)
          .filter((name) => name.length > 0 && !cpTitle.includes(name))
      }
      check(
        'CARDPARTS-01 前提: 入れた品にも料理名に無い主要食材がある（出ているかを切り分けられる）',
        cpChips.length > 0,
        `料理名=${cpTitle} 主要食材=${JSON.stringify(cpChips)}`,
      )
      const cpPlanCard = cpPage
        .locator('[data-testid="day-plan-card"]')
        .filter({ hasText: cpTitle })
        .first()
      check(
        'CARDPARTS-01 前提: 同じ品が今日の献立のカードとして出ている',
        (await cpPlanCard.count()) === 1,
        `料理名=${cpTitle}`,
      )
      if ((await cpPlanCard.count()) === 1) {
        const cpPlanText = cpClean(await cpPlanCard.textContent())
        // ② 2026-08-21 便IU・①: 今日の献立の行にも同じ引き算を当てた
        check(
          'CARDPARTS-01 今日の献立のカードにも「基本レシピ」を出さない（2026-08-21 便IU・①）',
          !cpPlanText.includes(ja.card.starterBadge),
          `カード=${cpPlanText}`,
        )
        check(
          'CARDPARTS-01 今日の献立のカードにも主要食材のチップを出さない（2026-08-21 便IU・①）',
          cpChips.length > 0 && cpChips.every((name) => !cpPlanText.includes(name)),
          `カード=${cpPlanText} 主要食材=${JSON.stringify(cpChips)}`,
        )
        check(
          'CARDPARTS-01 今日の献立のカードの手間も、既定値（普通）のときだけ出さない（便JP・③）',
          cpTarget?.effortLevel != null &&
            (cpTarget.effortLevel === 'normal'
              ? cpEffortWords(cpPlanText).length === 0
              : cpEffortWords(cpPlanText).join(',') === ja.effort[cpTarget.effortLevel]),
          `手間=${cpTarget?.effortLevel} カードに出ている手間=${JSON.stringify(cpEffortWords(cpPlanText))}`,
        )
        // ③ 骨格は動かしていない（料理名の大きさが2か所で同じ・オーナーOKの16pxのまま）
        const cpPlanFont = await cpPage
          .locator('[data-testid="day-plan-card-title"]')
          .first()
          .evaluate((el) => getComputedStyle(el).fontSize)
        check(
          'CARDPARTS-01 料理名の大きさは場所で変わらない（骨格は動かしていない）',
          cpSuggestFont.length > 0 && cpSuggestFont === cpPlanFont,
          `候補=${cpSuggestFont} 今日の献立=${cpPlanFont}`,
        )
        check(
          'CARDPARTS-01 料理名の大きさは16pxのまま（2026-08-19 オーナーがOKと言った大きさ）',
          cpSuggestFont === '16px',
          `候補=${cpSuggestFont}`,
        )

        // ③ 同じ品を「レシピを探す一覧」で見ると両方とも出る
        //    ＝カードごと情報を落としたのではなく、**場所で切り替えている**
        await cpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await cpPage.waitForTimeout(1500)
        // 2026-08-23 司令部: `hasText` は**部分一致**なので、「ハンバーグ」で掴むと
        // 「鶏ひき肉の豆腐ハンバーグ」にも当たる（並び順が変わった瞬間に別の品を掴んで落ちた）。
        // 料理名そのものが一致するカードだけを掴む
        const cpListCard = cpPage
          .locator('[data-testid="recipe-list-card"]')
          .filter({ has: cpPage.getByText(cpTitle, { exact: true }) })
          .first()
        check(
          'CARDPARTS-01 前提: レシピを探す一覧に同じ品のカードがある',
          (await cpListCard.count()) >= 1,
          `料理名=${cpTitle}`,
        )
        if ((await cpListCard.count()) >= 1) {
          const cpListText = cpClean(await cpListCard.textContent())
          check(
            'CARDPARTS-01 レシピを探す一覧には「基本レシピ」が出る（引き算したのは今日つくる1品の側だけ）',
            cpListText.includes(ja.card.starterBadge),
            `カード=${cpListText}`,
          )
          check(
            'CARDPARTS-01 レシピを探す一覧には主要食材のチップが出る（引き算したのは今日つくる1品の側だけ）',
            cpChips.length > 0 && cpChips.every((name) => cpListText.includes(name)),
            `カード=${cpListText} 主要食材=${JSON.stringify(cpChips)}`,
          )
        }
      }
    } finally {
      await cpBrowser.close()
    }
  }

  // --- DAYCOND-01(2026-08-19 便IA・オーナー実機「今日なに作るで、条件を絞るボタンをぽちぽち
  // 色々試すたびに、説明文や追加の選択肢が出現してボタンや献立のレシピカードの場所が変わるので
  // 見づらく感じる」)。
  //
  // 「条件をしぼる」は**窓（モーダル）**で開き、窓の中で何を押しても後ろの画面は動かない。
  // 測るのは見た目ではなく**位置**:
  //   ① 「条件をしぼる」を押すと窓が開く（折りたたみではない）
  //   ② 窓を開いた直後・窓の中で条件を次々押したあと、決めてもらうボタン・今日の献立に入れる
  //      ボタン・出ている候補カードの**ページの中での位置**が1pxも変わらない
  //   ③ 窓を閉じても、開く前と同じ場所に戻っている（後ろの画面が送られていない）
  //
  // 禁じ手よけ:
  //  ・位置は**ページの中での位置**で測る。画面の中での位置で測ると、窓が後ろの画面を
  //    止める（body を position:fixed にする）ぶんを「動いた」と誤検出する。
  //    止めているあいだは body の top に -スクロール量が入るので、それを足し戻してそろえる
  //  ・掴み方は data-testid だけ（クラス名・入れ子の段数・「何番目」に依らない）
  //  ・押す回数を決め打ちしない（並んでいる条件を順に押し、押せたものだけ数える）
  //  ・位置を読めなかったときは合格に倒さず不合格にする ---
  currentCheck = 'DAYCOND-01'
  {
    const dcBrowser = await chromium.launch()
    const dcContext = await dcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dcPage = await dcContext.newPage()
    dcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYCOND-01] ${text}`)
    })
    dcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYCOND-01] ${err.message}`)
    })
    /** ページの先頭からの位置。窓が後ろの画面を止めているあいだも同じ値になる */
    const dcDocPos = async (loc) => {
      if ((await loc.count()) === 0) return null
      return await loc.first().evaluate((el) => {
        const r = el.getBoundingClientRect()
        const fixed = getComputedStyle(document.body).position === 'fixed'
        const top = fixed ? parseFloat(document.body.style.top || '0') : 0
        const y = r.top + window.scrollY - (Number.isFinite(top) ? top : 0)
        const x = r.left + window.scrollX
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 }
      })
    }
    try {
      await dcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dcPage.waitForTimeout(2400) // 初回シード完了待ち
      await dcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dcPage.reload({ waitUntil: 'networkidle' })
      await dcPage.waitForTimeout(2000)
      const dcSection = () =>
        dcPage
          .locator('section')
          .filter({ has: dcPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
      const dcToggle = dcSection().locator('[data-testid="day-suggest-toggle"]')
      if ((await dcToggle.count()) === 1 && (await dcToggle.getAttribute('aria-expanded')) === 'false') {
        await dcToggle.click()
        await dcPage.waitForTimeout(700)
      }
      const dcWatch = {
        決めてもらうボタン: dcPage.locator('[data-testid="day-suggest-draw"]'),
        今日の献立に入れる: dcPage.locator('[data-testid="day-suggest-apply"]'),
        候補カード: dcPage.locator('[data-testid="day-suggest-result"]'),
      }
      const dcSnap = async () => {
        const out = {}
        for (const [label, loc] of Object.entries(dcWatch)) out[label] = await dcDocPos(loc)
        return out
      }
      check('DAYCOND-01 前提: 決めてもらうボタンが出ている', (await dcWatch.決めてもらうボタン.count()) === 1)
      check('DAYCOND-01 前提: 出てきた候補のカードがある', (await dcWatch.候補カード.count()) >= 1)
      const dcBefore = await dcSnap()
      check(
        'DAYCOND-01 前提: 位置を読めた（読めなければ見張りが壊れている）',
        Object.values(dcBefore).every((v) => v != null),
        JSON.stringify(dcBefore),
      )

      const dcConditions = dcSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
      check('DAYCOND-01 前提: 「条件をしぼる」が押せる', (await dcConditions.count()) === 1)
      if ((await dcConditions.count()) === 1) {
        await dcConditions.click()
        await dcPage.waitForTimeout(800)
      }
      const dcModal = dcPage.locator('[data-testid="day-conditions-modal"]')
      check('DAYCOND-01 「条件をしぼる」を押すと窓が開く（折りたたみではない）', (await dcModal.count()) === 1)

      // 窓が開いていれば窓の中を、開いていなければ節の中を押す
      // （直す前のコードでも同じ操作で測れる＝赤の中身がそのまま「何pxずれたか」になる）
      const dcScope = (await dcModal.count()) === 1 ? dcModal : dcSection()
      const dcMoved = []
      const dcSame = (a, b) =>
        a != null && b != null && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) < 0.5
      const dcCompare = async (when) => {
        const now = await dcSnap()
        for (const label of Object.keys(dcWatch)) {
          if (!dcSame(dcBefore[label], now[label])) {
            dcMoved.push(
              `${when}: ${label} ${JSON.stringify(dcBefore[label])}→${JSON.stringify(now[label])}`,
            )
          }
        }
      }
      await dcCompare('窓を開いた直後')
      // 窓の**中**も動かないこと（オーナー実機の不満は「説明文や追加の選択肢が出現して
      // 場所が変わる」なので、窓の中で同じことが起きても同じ不満になる）。
      // 窓は真ん中に出るので、中身が1行増えると窓ごと上下にずれる＝上端（いちばん上のチップ）と
      // 下端（「閉じる」）の両方を見る
      const dcInside = {
        '窓のいちばん上のチップ': dcScope.getByRole('button', { name: ja.dayStart.condAll, exact: true }),
        '窓の「閉じる」': dcPage.locator('[data-testid="day-conditions-close"]'),
      }
      const dcInsideSnap = async () => {
        const out = {}
        for (const [label, loc] of Object.entries(dcInside)) out[label] = await dcDocPos(loc)
        return out
      }
      const dcInsideBefore = await dcInsideSnap()
      check(
        'DAYCOND-01 前提: 窓の中の位置を読めた',
        (await dcModal.count()) !== 1 || Object.values(dcInsideBefore).every((v) => v != null),
        JSON.stringify(dcInsideBefore),
      )
      const dcInsideMoved = []
      const dcCompareInside = async (when) => {
        if ((await dcModal.count()) !== 1) return
        const now = await dcInsideSnap()
        for (const label of Object.keys(dcInside)) {
          if (!dcSame(dcInsideBefore[label], now[label])) {
            dcInsideMoved.push(
              `${when}: ${label} ${JSON.stringify(dcInsideBefore[label])}→${JSON.stringify(now[label])}`,
            )
          }
        }
      }
      const dcPressed = []
      for (const name of [
        ja.dayStart.condNotRecent,
        ja.dayStart.condFavorite,
        ja.dayStart.condQuick.replace('{n}', '20'),
        ja.dayStart.condQuick.replace('{n}', '10'),
        ja.dayStart.pantryOnlyToggle,
        ja.dayStart.condAll,
      ]) {
        const button = dcScope.getByRole('button', { name, exact: true })
        if ((await button.count()) === 0) continue
        await button.first().click()
        await dcPage.waitForTimeout(600)
        dcPressed.push(name)
        await dcCompare(`「${name}」を押した後`)
        await dcCompareInside(`「${name}」を押した後`)
      }
      check(
        'DAYCOND-01 前提: 条件のボタンを2つ以上押せた（押せていなければ測れていない）',
        dcPressed.length >= 2,
        `押せた=${JSON.stringify(dcPressed)}`,
      )
      check(
        'DAYCOND-01 窓の中で条件を次々押しても、後ろのボタンと候補カードが1pxも動かない',
        dcMoved.length === 0,
        dcMoved.join(' / '),
      )
      check(
        'DAYCOND-01 窓の中の並びも動かない（説明文や選択肢が出たり消えたりして中身がずれない）',
        dcInsideMoved.length === 0,
        dcInsideMoved.join(' / '),
      )

      const dcClose = dcPage.locator('[data-testid="day-conditions-close"]')
      if ((await dcClose.count()) === 1) {
        await dcClose.click()
        await dcPage.waitForTimeout(800)
        const dcAfter = await dcSnap()
        const dcDiff = Object.keys(dcWatch)
          .filter((label) => !dcSame(dcBefore[label], dcAfter[label]))
          .map((label) => `${label} ${JSON.stringify(dcBefore[label])}→${JSON.stringify(dcAfter[label])}`)
        check('DAYCOND-01 窓を閉じても、開く前と同じ場所に戻っている', dcDiff.length === 0, dcDiff.join(' / '))
      }

      // 端末の「戻る」で、この窓だけが閉じる（アプリ共通の窓の作法に乗っていること）。
      // 乗っていないと、窓を開けたまま戻るを押したときに献立の画面ごと離脱する
      if ((await dcModal.count()) === 0 && (await dcConditions.count()) === 1) {
        await dcConditions.first().click()
        await dcPage.waitForTimeout(700)
        check('DAYCOND-01 前提: 窓をもう一度開けた', (await dcModal.count()) === 1)
        await dcPage.goBack()
        await dcPage.waitForTimeout(900)
        check(
          'DAYCOND-01 端末の「戻る」で窓だけが閉じる（献立の画面から離脱しない）',
          (await dcModal.count()) === 0 && dcPage.url().includes('#/meal-plan'),
          `窓=${await dcModal.count()} URL=${dcPage.url()}`,
        )
      }
    } finally {
      await dcBrowser.close()
    }
  }

  // --- DAYONE-02(2026-08-19 便IA・オーナー実機「1品も条件ぽちぽち帰るたびに候補が
  // 変わらないようにして」)。2026-08-18の裁定（1品は引き直すのが目的なので条件を変えたら
  // すぐ入れ替わってよい）を、オーナーが実機で見て逆に決め直したもの。
  //
  // 測るのは両方向:
  //   ① 条件を変えただけでは、出ている1品が入れ替わらない
  //   ② 変えたことは、押すボタンのそばの1行で分かる
  //   ③ 「おまかせで1品出す」を押すと、変えた条件が効いた候補に入れ替わる
  //   ④ 押したあとは②の1行が消える
  // 仕込みは**お気に入りをちょうど1品だけ付ける**＝「お気に入り」に絞ったときに出る品が
  // 1つに決まるので、③を「たまたま別の品を引いた回だけ通る」形にしない。
  // 禁じ手よけ: 曜日・月替わりの前提を置かない／引き直しの回数を決め打ちしない（上限は保険）／
  // 料理名が読めなかったときは合格に倒さず不合格にする ---
  currentCheck = 'DAYONE-02'
  {
    const doBrowser = await chromium.launch()
    const doContext = await doBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const doPage = await doContext.newPage()
    doPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@DAYONE-02] ${text}`)
    })
    doPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@DAYONE-02] ${err.message}`)
    })
    const doClean = (t) => (t ?? '').replaceAll('​', '').trim()
    try {
      await doPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await doPage.waitForTimeout(2400) // 初回シード完了待ち
      const doFavTitle = '肉じゃが'
      const doMarked = await doPage.evaluate(
        (title) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const tx = idb.transaction('recipes', 'readwrite')
                const store = tx.objectStore('recipes')
                let n = 0
                for (const r of g.result) {
                  const want = r.title === title
                  if (!!r.isFavorite !== want) store.put({ ...r, isFavorite: want })
                  if (want) n++
                }
                tx.oncomplete = () => resolve(n)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        doFavTitle,
      )
      check('DAYONE-02 前提: お気に入りをちょうど1品だけ付けられた', doMarked === 1, `付けた数=${doMarked}`)
      await doPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await doPage.reload({ waitUntil: 'networkidle' })
      await doPage.waitForTimeout(2000)
      const doSection = () =>
        doPage
          .locator('section')
          .filter({ has: doPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
      const doToggle = doSection().locator('[data-testid="day-suggest-toggle"]')
      if ((await doToggle.count()) === 1 && (await doToggle.getAttribute('aria-expanded')) === 'false') {
        await doToggle.click()
        await doPage.waitForTimeout(700)
      }
      await doPage.locator('[data-testid="day-mode-one"]').click()
      await doPage.waitForTimeout(1000)
      const doTitle = () => doPage.locator('[data-testid="day-suggest-result-title"]').first()
      // お気に入りに付けた品そのものが出ていたら、別の品になるまで引き直す（上限は保険）
      const DO_MAX_DRAWS = 12
      let doShown = doClean(await doTitle().textContent())
      for (let i = 0; i < DO_MAX_DRAWS && doShown === doFavTitle; i++) {
        await doPage.locator('[data-testid="day-suggest-draw"]').click()
        await doPage.waitForTimeout(600)
        doShown = doClean(await doTitle().textContent())
      }
      check(
        'DAYONE-02 前提: お気に入り以外の候補が出ている（変わったかどうかを見分けられる）',
        doShown.length > 0 && doShown !== doFavTitle,
        `候補=${doShown}`,
      )

      const doConditions = doSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
      if ((await doConditions.count()) === 1) {
        await doConditions.click()
        await doPage.waitForTimeout(800)
      }
      const doModal = doPage.locator('[data-testid="day-conditions-modal"]')
      const doScope = (await doModal.count()) === 1 ? doModal : doSection()
      const doFav = doScope.getByRole('button', { name: ja.dayStart.condFavorite, exact: true })
      check('DAYONE-02 前提: 「お気に入り」で絞れる', (await doFav.count()) >= 1)
      if ((await doFav.count()) >= 1) {
        await doFav.first().click()
        await doPage.waitForTimeout(900)
      }
      const doClose = doPage.locator('[data-testid="day-conditions-close"]')
      if ((await doClose.count()) === 1) {
        await doClose.click()
        await doPage.waitForTimeout(800)
      }
      check(
        'DAYONE-02 条件を変えただけでは、1品の候補が入れ替わらない',
        doClean(await doTitle().textContent()) === doShown,
        `変える前=${doShown} 変えた後=${doClean(await doTitle().textContent())}`,
      )
      const doNote = () => doPage.locator('[data-testid="day-one-condition-changed"]')
      check(
        'DAYONE-02 条件を変えると、押すボタンのそばに「まだ反映していない」1行が出る',
        (await doNote().count()) === 1 && (await doNote().first().isVisible()),
      )
      await doPage.locator('[data-testid="day-suggest-draw"]').click()
      await doPage.waitForTimeout(1000)
      check(
        'DAYONE-02 「おまかせで1品出す」を押すと、変えた条件が効いた候補に入れ替わる',
        doClean(await doTitle().textContent()) === doFavTitle,
        `出た候補=${doClean(await doTitle().textContent())} 期待=${doFavTitle}`,
      )
      check('DAYONE-02 押したあとは、その1行が消える', (await doNote().count()) === 0)
    } finally {
      await doBrowser.close()
    }
  }

  // --- WEEKDICE-03(2026-08-19 便IA・オーナー実機「月や週の献立で、サイコロ押してレシピを
  // 変更した後に、元に戻すトースト？出してほしい」)。
  //
  // 週・月の行のサイコロを押すと、その枠のレシピが入れ替わる。入れ替えは端末に保存されるので、
  // 押し直しても前の料理には戻らない＝**何が入っていたかを覚えていないと戻せない**状態だった。
  // ×の知らせ（便HQ）と同じ形にそろえ、**入れ替える前のレシピに戻る**ところまで測る。
  //   ① 押すと、何が何に変わったかの知らせが出る
  //   ② その知らせに「元に戻す」が付いている
  //   ③ 押すと、入れ替える前のレシピに戻っている
  // 行の掴み方は data-date / data-slot / data-role（**いつの・どの食事の・どの役割**の行か）。
  // 週には同じ形の行が何十個も並ぶので、「何番目」や入れ子の段数では掴まない。
  // 禁じ手よけ: 曜日・月替わりの前提を置かない（使うのは今日の日付だけ）／
  // サイコロを押す回数を決め打ちしない（同じ品を引くことがあるので上限つきで繰り返す）／
  // 料理名を読めなかったときは合格に倒さず不合格にする ---
  currentCheck = 'WEEKDICE-03'
  {
    const wdBrowser = await chromium.launch()
    const wdContext = await wdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wdPage = await wdContext.newPage()
    wdPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@WEEKDICE-03] ${text}`)
    })
    wdPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKDICE-03] ${err.message}`)
    })
    const wdClean = (t) => (t ?? '').replaceAll('​', '').trim()
    try {
      await wdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wdPage.waitForTimeout(2400) // 初回シード完了待ち
      await wdPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wdPage.reload({ waitUntil: 'networkidle' })
      await wdPage.waitForTimeout(2000)
      const wdToday = await wdPage.evaluate(() => {
        const d = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      })
      await wdPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await wdPage.waitForTimeout(1400)
      // 2026-08-22 便IV: サイコロ（引き直し）は編集モードの中にしか出さない
      check(
        'WEEKDICE-03 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(wdPage, wdToday)) === true,
      )
      const wdRow = wdPage.locator(
        `[data-testid="plan-row"][data-date="${wdToday}"][data-slot="dinner"][data-role="main"]`,
      )
      check(
        'WEEKDICE-03 前提: 今日の夕食・主菜の行を掴めた（日付と食事と役割で掴む）',
        (await wdRow.count()) === 1,
        `見つかった行=${await wdRow.count()}`,
      )
      if ((await wdRow.count()) === 1) {
        // 空いていればまず1品入れる（測りたいのは「入れ替え」なので、中身を作ってから始める）
        if ((await wdRow.locator('[data-testid="row-recipe"]').count()) === 0) {
          await wdRow.getByRole('button', { name: ja.mealPlan.emptyAssign }).click()
          await wdPage.waitForTimeout(1000)
          await wdPage.locator('[data-testid="recipe-picker"] [data-testid="picker-item"]').first().click()
          await wdPage.waitForTimeout(1400)
        }
        const wdTitle = async () =>
          wdClean(await wdRow.locator('[data-testid="row-recipe"]').first().textContent())
        const wdBefore = await wdTitle()
        check('WEEKDICE-03 前提: 行にレシピが入っている', wdBefore.length > 0, `料理名=${wdBefore}`)
        const WD_MAX_PRESSES = 10
        let wdAfter = wdBefore
        for (let i = 0; i < WD_MAX_PRESSES && wdAfter === wdBefore; i++) {
          await wdRow.getByRole('button', { name: ja.mealPlan.suggestAria }).click()
          await wdPage.waitForTimeout(900)
          wdAfter = await wdTitle()
        }
        check(
          'WEEKDICE-03 前提: サイコロでレシピが入れ替わった',
          wdBefore.length > 0 && wdAfter.length > 0 && wdAfter !== wdBefore,
          `前=${wdBefore} 後=${wdAfter}`,
        )
        const wdToast = wdPage.locator('[role="status"]')
        const wdToastText = wdClean(await wdToast.first().textContent().catch(() => ''))
        check(
          'WEEKDICE-03 サイコロを押すと、何が何に変わったかの知らせが出る',
          wdToastText.includes(wdBefore) && wdToastText.includes(wdAfter),
          `知らせ=${wdToastText}`,
        )
        const wdUndo = wdToast.getByRole('button', { name: ja.common.undo })
        check('WEEKDICE-03 その知らせに「元に戻す」が付いている', (await wdUndo.count()) === 1)
        if ((await wdUndo.count()) === 1) {
          await wdUndo.first().click()
          await wdPage.waitForTimeout(1400)
          check(
            'WEEKDICE-03 「元に戻す」で、入れ替える前のレシピに戻っている',
            (await wdTitle()) === wdBefore,
            `戻した後=${await wdTitle()} 期待=${wdBefore}`,
          )
        }
      }
    } finally {
      await wdBrowser.close()
    }
  }

  // --- SUGGESTNG-04(2026-08-19 便IA・司令部裁定): NG食材（設定「食べられない食材」）の警告は、
  // **提案してくる場所にこそ要る**。レシピ一覧・献立の枠・「レシピを選ぶ」画面には出ていたのに、
  // 「今日なに作る？」の候補と「今日の献立」の1品にだけ出ていなかった（渡し忘れ）。
  // 同じ1品を2か所で見て、どちらにも同じ印が出ることを測る。
  // 仕込みはお気に入り1品＋その品が使っている食材をNGに入れる＝**必ずその品が候補に出る**
  // ようにして、「たまたまNGの品を引いた回だけ通る」形にしない ---
  currentCheck = 'SUGGESTNG-04'
  {
    const snBrowser = await chromium.launch()
    const snContext = await snBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const snPage = await snContext.newPage()
    snPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@SUGGESTNG-04] ${text}`)
    })
    snPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@SUGGESTNG-04] ${err.message}`)
    })
    const snClean = (t) => (t ?? '').replaceAll('​', '').trim()
    try {
      await snPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await snPage.waitForTimeout(2400) // 初回シード完了待ち
      const snTitle = '肉じゃが'
      const snNg = 'じゃがいも'
      const snSetup = await snPage.evaluate(
        ({ title, ng }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const target = g.result.find((r) => r.title === title)
                const hasNg =
                  !!target && (target.ingredients ?? []).some((i) => (i.name ?? '').includes(ng))
                const tx = idb.transaction(['recipes', 'settings'], 'readwrite')
                const store = tx.objectStore('recipes')
                for (const r of g.result) {
                  const want = r.title === title
                  if (!!r.isFavorite !== want) store.put({ ...r, isFavorite: want })
                }
                const settingsStore = tx.objectStore('settings')
                const sg = settingsStore.get(1)
                sg.onsuccess = () => settingsStore.put({ ...(sg.result ?? { id: 1 }), ngIngredients: [ng] })
                tx.oncomplete = () => resolve({ hasNg })
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { title: snTitle, ng: snNg },
      )
      check(
        `SUGGESTNG-04 前提: 「${snTitle}」が「${snNg}」を使っている（使っていなければ測れていない）`,
        snSetup.hasNg === true,
        JSON.stringify(snSetup),
      )
      await snPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await snPage.reload({ waitUntil: 'networkidle' })
      await snPage.waitForTimeout(2200)
      const snSection = () =>
        snPage
          .locator('section')
          .filter({ has: snPage.getByRole('heading', { name: ja.dayStart.suggestTitle }) })
      const snToggle = snSection().locator('[data-testid="day-suggest-toggle"]')
      if ((await snToggle.count()) === 1 && (await snToggle.getAttribute('aria-expanded')) === 'false') {
        await snToggle.click()
        await snPage.waitForTimeout(700)
      }
      await snPage.locator('[data-testid="day-mode-one"]').click()
      await snPage.waitForTimeout(1000)
      const snConditions = snSection().getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
      if ((await snConditions.count()) === 1) {
        await snConditions.click()
        await snPage.waitForTimeout(800)
      }
      const snModal = snPage.locator('[data-testid="day-conditions-modal"]')
      const snScope = (await snModal.count()) === 1 ? snModal : snSection()
      const snFav = snScope.getByRole('button', { name: ja.dayStart.condFavorite, exact: true })
      if ((await snFav.count()) >= 1) {
        await snFav.first().click()
        await snPage.waitForTimeout(800)
      }
      const snClose = snPage.locator('[data-testid="day-conditions-close"]')
      if ((await snClose.count()) === 1) {
        await snClose.click()
        await snPage.waitForTimeout(700)
      }
      await snPage.locator('[data-testid="day-suggest-draw"]').click()
      await snPage.waitForTimeout(1100)
      const snShown = snClean(
        await snPage.locator('[data-testid="day-suggest-result-title"]').first().textContent(),
      )
      check(
        'SUGGESTNG-04 前提: NG食材を含む品が候補に出ている',
        snShown === snTitle,
        `候補=${snShown} 期待=${snTitle}`,
      )
      check(
        'SUGGESTNG-04 「今日なに作る？」の候補にNG食材の警告が出る',
        (await snPage
          .locator('[data-testid="day-suggest-result"]')
          .first()
          .locator(`[aria-label="${ja.card.ngBadge}"]`)
          .count()) >= 1,
      )
      await snPage.locator('[data-testid="day-suggest-apply"]').click()
      await snPage.waitForTimeout(900)
      await snPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
      await snPage.waitForTimeout(1800)
      const snPlanCard = snPage.locator('[data-testid="day-plan-card"]').filter({ hasText: snTitle }).first()
      check('SUGGESTNG-04 前提: その品が今日の献立に入った', (await snPlanCard.count()) === 1)
      if ((await snPlanCard.count()) === 1) {
        check(
          'SUGGESTNG-04 「今日の献立」の1品にもNG食材の警告が出る',
          (await snPlanCard.locator(`[aria-label="${ja.card.ngBadge}"]`).count()) >= 1,
        )
      }
    } finally {
      await snBrowser.close()
    }
  }

  // --- PICKCOMPACT-05(2026-08-19 便IA・オーナー原文「④OKフォーマットそのままで情報減らすなど
  // コンパクトにする努力はして」)。
  //
  // 便HWで「レシピを選ぶ」画面が共通のカードにそろった代わりに、1画面に入る品数が減った
  // （390×844の実測で6品）。**骨格は変えずに、載せる情報だけを引いて高さを詰める**。
  // 測るのは見た目ではなく**1画面に丸ごう見える品数**＝利用者が1回のスクロールで見比べられる数。
  // 掴み方は data-testid（並びの何番目かには依らない）。列が読めなかったときは不合格にする ---
  currentCheck = 'PICKCOMPACT-05'
  {
    const pkBrowser = await chromium.launch()
    const pkContext = await pkBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const pkPage = await pkContext.newPage()
    pkPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@PICKCOMPACT-05] ${text}`)
    })
    pkPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@PICKCOMPACT-05] ${err.message}`)
    })
    const pkClean = (t) => (t ?? '').replaceAll('​', '').trim()
    try {
      await pkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pkPage.waitForTimeout(2400) // 初回シード完了待ち
      await pkPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await pkPage.reload({ waitUntil: 'networkidle' })
      await pkPage.waitForTimeout(2000)
      const pkToday = await pkPage.evaluate(() => {
        const d = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      })
      await pkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await pkPage.waitForTimeout(1400)
      // 2026-08-22 便IV: 空き枠（「レシピを選ぶ」）は編集モードの中にしか出さない
      check(
        'PICKCOMPACT-05 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(pkPage, pkToday)) === true,
      )
      const pkRow = pkPage.locator(
        `[data-testid="plan-row"][data-date="${pkToday}"][data-slot="dinner"][data-role="main"]`,
      )
      check('PICKCOMPACT-05 前提: 今日の夕食・主菜の行を掴めた', (await pkRow.count()) === 1)
      if ((await pkRow.count()) === 1) {
        const pkOpen = pkRow.getByRole('button', { name: ja.mealPlan.emptyAssign })
        if ((await pkOpen.count()) === 1) await pkOpen.click()
        // 2026-08-25 便KU: 埋まっている枠の差し替えは「レシピを変更」から
        // （カードの押下はレシピ詳細に移った）
        else await pkRow.locator('[data-testid="slot-change-recipe"]').first().click()
        await pkPage.waitForTimeout(1400)
        const pkPicker = pkPage.locator('[data-testid="recipe-picker"]')
        check('PICKCOMPACT-05 前提: 「レシピを選ぶ」画面が開いた', (await pkPicker.count()) === 1)
        const pkTotal = await pkPicker.locator('[data-testid="picker-item"]').count()
        check('PICKCOMPACT-05 前提: レシピが並んでいる', pkTotal > 10, `並んだ数=${pkTotal}`)
        const pkFully = await pkPicker.evaluate((root) => {
          const items = [...root.querySelectorAll('[data-testid="picker-item"]')]
          if (items.length === 0) return null
          return items.filter((el) => {
            const r = el.getBoundingClientRect()
            return r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5
          }).length
        })
        // 便HWのあと（引き算する前）は6品。7品を下限にする＝引き算が効いていれば必ず超える
        check(
          'PICKCOMPACT-05 1画面に7品以上が丸ごと見える（情報を引く前は6品）',
          pkFully != null && pkFully >= 7,
          `丸ごと見えた数=${pkFully ?? '読めず'}品`,
        )
        const pkText = pkClean(await pkPicker.textContent())
        check(
          'PICKCOMPACT-05 「レシピを選ぶ」画面に「基本レシピ」は出さない（選ぶ決め手にならない）',
          pkText.length > 0 && !pkText.includes(ja.card.starterBadge),
        )
        check(
          'PICKCOMPACT-05 調理時間は残っている（高さの縮まない情報まで消していない）',
          /\d+分/.test(pkText),
        )
      }
    } finally {
      await pkBrowser.close()
    }
  }

  // --- FORMING-01(2026-08-02 オーナー実機FB・便CR-2): レシピ登録の「まとめて入力」まわり。
  // (a)材料行の複数選択→まとめて削除 (b)名前と分量の間はスペース、の注意書き
  // (c)上下移動が数値調整に見えないつまみ(並び替えハンドル) (d)日本語入力の変換確定Enterで
  // 行が増えないこと(「エンターで行が増えて注力しづらい」の真因) ---
  currentCheck = 'FORMING-01'
  {
    const fiBrowser = await chromium.launch()
    const fiContext = await fiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fiPage = await fiContext.newPage()
    fiPage.on('dialog', (dialog) => dialog.accept())
    fiPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMING-01] ${err.message}`)
    })
    try {
      await fiPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await fiPage.waitForTimeout(2000)
      check(
        'FORMING-01(b) まとめて入力の欄に「名前と分量の間はスペース」の注意書きがある',
        stripZwspText(await fiPage.textContent('body')).includes(ja.form.quickIngredientSpaceHint),
      )
      const quick = fiPage.getByLabel(ja.form.quickIngredientLabel)
      const rowCount = () => fiPage.locator(`input[aria-label="${ja.form.ingredientName}"]`).count()
      // 材料名は入力欄の値なので textContent には出ない(注意書きの「豚こま 200g」を拾って
      // 偽陽性になる)。value を直接読んで確かめる
      const nameValues = () =>
        fiPage.locator(`input[aria-label="${ja.form.ingredientName}"]`).evaluateAll((els) => els.map((el) => el.value))
      // 並び替えハンドルは材料行と手順行の両方にあるので、材料行のぶんの増減で見る
      const handleCount = () => fiPage.getByRole('group', { name: ja.form.reorderHandle }).count()
      // (d) IMEの変換確定Enter(isComposing=true)では行を足さない
      await quick.fill('たまねぎ 1個')
      const beforeIme = await rowCount()
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
      await fiPage.evaluate((quickLabel) => {
        const el = document.querySelector(`input[aria-label="${quickLabel}"]`)
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
      }, ja.form.quickIngredientLabel)
      await fiPage.waitForTimeout(400)
      check(
        'FORMING-01(d) 変換確定のEnter(isComposing)では材料行が増えない',
        (await rowCount()) === beforeIme && (await quick.inputValue()) === 'たまねぎ 1個',
        `行数 ${beforeIme}→${await rowCount()} / 欄の値=${await quick.inputValue()}`,
      )
      // 確定後のEnterでは従来どおり行になる
      await quick.press('Enter')
      await fiPage.waitForTimeout(400)
      check(
        'FORMING-01(d) 変換確定後のEnterでは従来どおり材料行になる',
        (await quick.inputValue()) === '' && (await nameValues()).includes('たまねぎ'),
        JSON.stringify(await nameValues()),
      )
      for (const line of ['豚こま 200g', 'しょうゆ 大さじ2']) {
        await quick.fill(line)
        await fiPage.getByRole('button', { name: ja.form.quickIngredientAdd }).click()
        await fiPage.waitForTimeout(250)
      }
      check(
        'FORMING-01 前提: 材料が3行(たまねぎ・豚こま・しょうゆ)になっている',
        JSON.stringify(await nameValues()) === JSON.stringify(['たまねぎ', '豚こま', 'しょうゆ']),
        JSON.stringify(await nameValues()),
      )
      // (c) 上下移動は「つまみ+枠」のハンドルにまとまっている
      const handlesBeforeOrganize = await handleCount()
      check(
        'FORMING-01(c) 材料行の上下移動が並び替えハンドル(つまみ)にまとまっている',
        handlesBeforeOrganize >= 3,
        `ハンドル数=${handlesBeforeOrganize}`,
      )
      // (a) 「選んで削除」モード→2行選択→まとめて削除
      // ボタン名は2026-08-02 オーナー指示(便DF)で「整理」から「選んで削除」に変更(何ができるか
      // 読み取れなかったため)。名前が戻ってしまわないよう、ここで名指しして押す
      await fiPage.getByRole('button', { name: ja.form.ingredientOrganizeToggle, exact: true }).click()
      await fiPage.waitForTimeout(300)
      check(
        // 2026-08-23 便JO: 画面の文を書き写した正規表現をやめ、ja.ts から読む形にした（禁じ手②）。
        // 触れる面を枠ぜんぶに広げたのに合わせて案内も直したところ、この1行だけが赤くなっていた
        'FORMING-01(便DF) モードに入ると消し方の説明が出る',
        stripZwspText(await fiPage.textContent('body')).includes(
          stripZwspText(ja.form.ingredientOrganizeHint),
        ),
      )
      check(
        'FORMING-01(a) 選択中は材料行のハンドルが隠れる(選択中に並びが変わらない)',
        (await handleCount()) === handlesBeforeOrganize - 3,
        `整理前=${handlesBeforeOrganize} 整理中=${await handleCount()}`,
      )
      const selectBtns = fiPage.getByRole('button', { name: ja.form.ingredientOrganizeSelectRow })
      await selectBtns.nth(0).click()
      await selectBtns.nth(2).click()
      await fiPage.waitForTimeout(300)
      check(
        'FORMING-01(a) 選んだ件数が削除ボタンに出る',
        /選んだ材料2[品件行]を削除/.test(await fiPage.textContent('body')),
      )
      await fiPage.getByRole('button', { name: jaRe(ja.form.ingredientOrganizeDeleteSelected, { n: '2' }) }).click()
      await fiPage.waitForTimeout(500)
      check(
        'FORMING-01(a) 選んだ2行だけが消え、残りの1行(豚こま)はそのまま残る',
        JSON.stringify(await nameValues()) === JSON.stringify(['豚こま']),
        JSON.stringify(await nameValues()),
      )
      // 1行になったら整理することが無くなるので通常の入力に戻る(「完了」に戻れなくなるのを防ぐ)
      check(
        'FORMING-01(a) 1行まで消すと「選んで削除」モードから自動で抜ける',
        (await handleCount()) === handlesBeforeOrganize - 2 &&
          (await fiPage.getByRole('button', { name: ja.form.ingredientOrganizeSelectRow }).count()) === 0,
        `ハンドル数=${await handleCount()}`,
      )
    } finally {
      await fiBrowser.close()
    }
  }
  // --- SETBACK-01: 設定へ飛ばされたあとの帰り道(2026-08-02 オーナー指示・便DF)。
  // 各ページのPro版の説明などから設定の該当欄へ飛ぶと、着いた先に元のページへ戻る手段が
  // 無かった。?back=<元のパス>を載せて飛び、設定画面の目次チップの上に「◯◯に戻る」を出す。
  // 直接開いた設定(タブから)には出さないことも確認する ---
  currentCheck = 'SETBACK-01'
  {
    const sbBrowser = await chromium.launch()
    const sbContext = await sbBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const sbPage = await sbContext.newPage()
    sbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SETBACK-01] ${err.message}`)
    })
    const backBtn = sbPage.locator('[data-testid="settings-back"]')
    try {
      await sbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await sbPage.waitForTimeout(1800)

      // (a) タブから開いた設定には戻るボタンを出さない(帰る先が無いため)
      await sbPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await sbPage.waitForTimeout(700)
      check('SETBACK-01 直接開いた設定には戻るボタンを出さない', (await backBtn.count()) === 0)

      // (b) レシピ一覧の栄養並び替えのPro案内 → 設定(Pro節) → 「レシピ一覧に戻る」
      await sbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await sbPage.waitForTimeout(900)
      await sbPage.locator(`button[aria-label="${ja.search.sortToggle}"]`).click()
      await sbPage.waitForTimeout(300)
      // 2026-08-19 便HU・⑯でティーザーの文言が変わった（顔ぶれを栄養表示と同じ8項目にそろえた）
      await sbPage.getByText(ja.search.sortNutritionGate).click()
      await sbPage.waitForTimeout(800)
      check(
        'SETBACK-01 Pro案内のリンクに戻り先(?back=)が載っている',
        sbPage.url().includes('#/settings') && sbPage.url().includes('back=%2Frecipes'),
        `現在URL: ${sbPage.url()}`,
      )
      check(
        'SETBACK-01 設定に「レシピ一覧に戻る」が出る',
        (await backBtn.textContent())?.includes('レシピ一覧に戻る'),
      )
      // Pro節へ自動スクロールした後でも押せる位置にある(目次チップと同じ固定領域に置いている)
      check('SETBACK-01 節へスクロールした後も戻るボタンが見えている', await backBtn.isVisible())
      await backBtn.click()
      await sbPage.waitForTimeout(600)
      check(
        'SETBACK-01 押すとレシピ一覧へ帰る',
        sbPage.url().endsWith('#/recipes'),
        `現在URL: ${sbPage.url()}`,
      )

      // (c) レシピ詳細の栄養のPro案内 → 設定 → 元のレシピ詳細へ帰る(画面名も「レシピ」になる)
      await sbPage.locator('a[href^="#/recipes/"]').first().click()
      await sbPage.waitForTimeout(800)
      const sbDetailUrl = sbPage.url()
      await sbPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
      await sbPage.waitForTimeout(500)
      await sbPage.locator('a[href^="#/settings?section=pro"]').first().click()
      await sbPage.waitForTimeout(800)
      check(
        'SETBACK-01 レシピ詳細発では「レシピに戻る」になる',
        (await backBtn.textContent())?.includes('レシピに戻る'),
      )
      await backBtn.click()
      await sbPage.waitForTimeout(600)
      check(
        'SETBACK-01 押すと元のレシピ詳細へ帰る',
        sbPage.url() === sbDetailUrl,
        `現在URL: ${sbPage.url()} 期待=${sbDetailUrl}`,
      )
    } finally {
      await sbBrowser.close()
    }
  }

  // --- BULKDEL-01: レシピ一覧のまとめて削除(2026-08-02 便CT・オーナー承認)。
  // 食材の在庫の「整理」モードに倣った選択モードで複数品を選び、規約Fの確認文
  // (消えるもの＝レシピ本体+作った記録{n}件(写真{p}枚)+献立の予定・今日の献立/残るもの、を件数つき)
  // を出してから削除できること・削除後に孤児データ(週の献立・今日の献立)が残らないこと・
  // 基本レシピにはトゥームストーン(再取込除外の記録)を残さない＝入れ直しで戻せる既存挙動が
  // 維持されていること、を確認する。長押しでも選択モードに入れることも確認する。 ---
  currentCheck = 'BULKDEL-01'
  {
    const bdBrowser = await chromium.launch()
    const bdContext = await bdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const bdPage = await bdContext.newPage()
    let bdDialogMsg = ''
    await collectConfirms(bdPage, (text) => {
      bdDialogMsg = text
    })
    bdPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@BULKDEL-01] ${text}`)
    })
    bdPage.on('pageerror', (err) => errors.push(`[pageerror@BULKDEL-01] ${err.message}`))
    try {
      await bdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bdPage.waitForTimeout(1800) // 初回シード完了待ち

      // 削除の巻き添え(作った記録・写真・週の献立・今日の献立)をIndexedDB直書きで仕込む
      const bdIds = await bdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['recipes', 'mealPlans', 'todayList'], 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const nikujaga = g.result.find((r) => r.title === '肉じゃが')
                const curry = g.result.find((r) => r.title === 'カレーライス')
                // 作った記録2件(うち1件は写真つき)＋1件
                store.put({
                  ...nikujaga,
                  cookedLogs: [
                    { date: '2026-08-01', photo: new Blob(['x'], { type: 'image/jpeg' }) },
                    { date: '2026-07-31' },
                  ],
                })
                store.put({ ...curry, cookedLogs: [{ date: '2026-07-30' }] })
                const plans = tx.objectStore('mealPlans')
                plans.add({ date: '2026-08-05', slot: 'dinner', recipeId: nikujaga.id, role: 'main' })
                plans.add({ date: '2026-08-06', slot: 'dinner', recipeId: curry.id, role: 'main' })
                const today = tx.objectStore('todayList')
                today.add({ recipeId: nikujaga.id, addedAt: Date.now() })
                tx.oncomplete = () => resolve({ nikujaga: nikujaga.id, curry: curry.id })
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await bdPage.reload({ waitUntil: 'networkidle' })
      await bdPage.waitForTimeout(1500)

      // 長押しで選択モードに入る(カードを押したまま動かさない)。詳細へは遷移しない
      const bdFirstCard = bdPage.locator('a[href^="#/recipes/"]').first()
      const bdBox = await bdFirstCard.boundingBox()
      await bdPage.mouse.move(bdBox.x + bdBox.width / 2, bdBox.y + 20)
      await bdPage.mouse.down()
      await bdPage.waitForTimeout(900)
      await bdPage.mouse.up()
      await bdPage.waitForTimeout(400)
      check(
        'BULKDEL-01 長押しで選択モードに入る',
        await bdPage.getByTestId('selection-exit').isVisible(),
      )
      check('BULKDEL-01 長押しで詳細に遷移しない', !/#\/recipes\/\d+/.test(bdPage.url()), bdPage.url())
      check(
        'BULKDEL-01 長押ししたレシピが1品選ばれている',
        ((await bdPage.getByTestId('selection-bar').innerText()) ?? '').includes('1品を選択中'),
      )
      // いったん選択モードを抜けてから、「選択」ボタン経由の通常の流れを検証する
      // (抜けるボタンは2026-08-15 便GUで「完了」から画面下の帯の「選択をやめる」へ移した)
      await bdPage.getByTestId('selection-exit').click()
      await bdPage.waitForTimeout(300)
      check(
        'BULKDEL-01 選択をやめると選択モードを抜ける',
        await bdPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).isVisible(),
      )

      await bdPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
      await bdPage.waitForTimeout(300)
      const bdSelectingText = (await bdPage.textContent('body')) ?? ''
      check(
        'BULKDEL-01 選択モードの案内が出る',
        (await bdPage.getByTestId('select-hint').count()) === 1,
      )
      check(
        'BULKDEL-01 全選択・選択解除が選択操作のすぐ上に出る',
        bdSelectingText.includes('全選択') && bdSelectingText.includes('選択解除'),
      )
      // 2026-08-17 便HJ: 削除は「選び終わる」の窓の中へ移したので、0件では
      // 窓を開く操作そのものが押せないことで測る(選ぶものが無いまま先へ進めない)
      check(
        'BULKDEL-01 0件選択では、選んだあとの操作へ進めない',
        !bdSelectingText.includes('選択したレシピ') &&
          (await bdPage.getByTestId('selection-finish').isDisabled()),
      )

      // カード全面が選択ボタンになる(aria-labelは料理名)
      await bdPage.getByRole('button', { name: '肉じゃが', exact: true }).click()
      await bdPage.waitForTimeout(200)
      await bdPage.getByRole('button', { name: 'カレーライス', exact: true }).click()
      await bdPage.waitForTimeout(300)
      check(
        'BULKDEL-01 選んだ品数が操作と同じ場所に出る',
        ((await bdPage.getByTestId('selection-bar').innerText()) ?? '').includes('2品を選択中'),
      )
      /** 選び終わって、窓の中の道を1つ選ぶ(2026-08-17 便HJ) */
      const bdPickDoor = async (name) => {
        await bdPage.getByTestId('selection-finish').click()
        await bdPage.waitForTimeout(400)
        await bdPage.getByTestId(`selection-actions-${name}`).click()
        await bdPage.waitForTimeout(300)
      }

      const bdBeforeCount = await bdPage.locator('a[href^="#/recipes/"]').count()

      // --- GW-01(2026-08-15 便GW): 確認は画面の中の窓で出す ---
      // オーナー原文「アプリ全体に、確認などで表示される窓が見づらく、見ていて楽しくなる画面じゃない」
      // ／利用者テスト「アプリの中で急に素のポップアップが出るのは違和感があります」。
      // ここでは仕掛けの自動押しを止め、**窓を見て自分で押す**形で確かめる
      await setConfirmAnswer(bdPage, 'off')
      await bdPickDoor('delete')
      await bdPage.waitForTimeout(700)
      const bdConfirm = bdPage.locator('[data-testid="confirm"]')
      check('GW-01 確認は画面の中の窓で出る(素のポップアップを出さない)', (await bdConfirm.count()) === 1)
      check(
        'GW-01 窓のボタンは何が起きるかが読める動詞になっている(「OK」にしない)',
        (await bdPage.locator('[data-testid="confirm-ok"]').innerText()) === '削除する' &&
          (await bdPage.locator('[data-testid="confirm-cancel"]').innerText()) === 'やめる',
        `${await bdPage.locator('[data-testid="confirm-ok"]').innerText()} / ${await bdPage
          .locator('[data-testid="confirm-cancel"]')
          .innerText()}`,
      )
      await bdPage.locator('[data-testid="confirm-cancel"]').click()
      await bdPage.waitForTimeout(500)
      check(
        'GW-01 「やめる」を押すと窓が閉じ、1品も消えない',
        (await bdConfirm.count()) === 0 &&
          (await bdPage.locator('a[href^="#/recipes/"]').count()) === bdBeforeCount,
      )
      await setConfirmAnswer(bdPage, 'accept')

      await bdPickDoor('delete')
      await bdPage.waitForTimeout(1200)

      // 規約F: 何が消えるか/何が残るかを件数つきで両方書く
      check('BULKDEL-01 確認文に削除するレシピの数が入る', hasCountAfter(bdDialogMsg, 'レシピ', 2), `dialog=${bdDialogMsg}`)
      check('BULKDEL-01 確認文に作った記録の数が入る', hasCountAfter(bdDialogMsg, '作った記録', 3), `dialog=${bdDialogMsg}`)
      check('BULKDEL-01 確認文に写真の枚数が入る', /写真1枚/.test(bdDialogMsg), `dialog=${bdDialogMsg}`)
      check('BULKDEL-01 確認文に献立の予定の数が入る', hasCountAfter(bdDialogMsg, '献立の予定', 2), `dialog=${bdDialogMsg}`)
      check('BULKDEL-01 確認文に今日の献立の数が入る', hasCountAfter(bdDialogMsg, '今日の献立', 1), `dialog=${bdDialogMsg}`)
      check('BULKDEL-01 確認文に元に戻せないことが入る', bdDialogMsg.includes('元に戻せません'))
      check('BULKDEL-01 確認文に残るものが数つきで入る', /残るもの: [^\n]*他のレシピ\d+[品件]・買い物メモ・食材の在庫/.test(bdDialogMsg), `dialog=${bdDialogMsg}`)
      // 2026-08-16 便GZ: 作った記録はレシピを消しても残るので「残るもの」に書く
      check(
        'BULKDEL-01(便GZ) 確認文は作った記録を「残るもの」に書く',
        // 窓の文字を取り出すと改行が消えるので、`[^\n]*` では範囲を切れない（文章全体に広がる）。
        // 「消えるもの」と「残るもの」の見出しの位置で切って、どちらに入っているかを見る
        (() => {
          const removed = bdDialogMsg.slice(
            bdDialogMsg.indexOf('消えるもの'),
            bdDialogMsg.indexOf('残るもの'),
          )
          const kept = bdDialogMsg.slice(bdDialogMsg.indexOf('残るもの'))
          return kept.includes('作った記録3件（うち写真1枚）') && !removed.includes('作った記録')
        })(),
        `dialog=${bdDialogMsg}`,
      )
      check(
        'BULKDEL-01 基本レシピは入れ直しで戻せることを区別して書く',
        bdDialogMsg.includes(ja.recipes.bulkDeleteConfirmStarter.replace('{s}', '2')),
        `dialog=${bdDialogMsg}`,
      )
      check('BULKDEL-01 「よろしいですか？」で終わらせない', !bdDialogMsg.includes('よろしいですか'))

      const bdAfterText = (await bdPage.textContent('body')) ?? ''
      check('BULKDEL-01 削除の完了をトーストで知らせる', bdAfterText.includes('レシピ2品を削除しました'))
      // 判定は「カードの料理名」だけで行う。body全体のtextContentだと、隣り合う主要食材チップが
      // つながって(「豚こま切れ肉」+「じゃがいも」→"…肉じゃが…")料理名と誤一致する
      const bdTitles = await bdPage.evaluate(() =>
        Array.from(document.querySelectorAll('a[href^="#/recipes/"] p.line-clamp-2')).map(
          (p) => p.textContent,
        ),
      )
      check(
        'BULKDEL-01 削除した2品が一覧から消える',
        !bdTitles.includes('肉じゃが') && !bdTitles.includes('カレーライス'),
        JSON.stringify(bdTitles.slice(0, 5)),
      )
      const bdAfterCount = await bdPage.locator('a[href^="#/recipes/"]').count()
      check('BULKDEL-01 カード数が2枚減る', bdAfterCount === bdBeforeCount - 2, `前=${bdBeforeCount} 後=${bdAfterCount}`)
      check(
        'BULKDEL-01 削除後も選択モードは維持し選択だけ解除する(在庫の整理モードと同じ)',
        await bdPage.getByTestId('selection-exit').isVisible(),
      )

      // 孤児防止(deleteRecipeと同じ範囲)とトゥームストーンの扱いをIndexedDB直読みで確認
      const bdState = await bdPage.evaluate(
        (ids) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['recipes', 'mealPlans', 'todayList', 'setExclusions'], 'readonly')
              const out = {}
              const rq = tx.objectStore('recipes').getAll()
              rq.onsuccess = () => {
                out.remaining = rq.result.filter((r) => ids.includes(r.id)).length
              }
              const pq = tx.objectStore('mealPlans').getAll()
              pq.onsuccess = () => {
                out.orphanPlans = pq.result.filter((e) => ids.includes(e.recipeId)).length
              }
              const tq = tx.objectStore('todayList').getAll()
              tq.onsuccess = () => {
                out.orphanToday = tq.result.filter((e) => ids.includes(e.recipeId)).length
              }
              const eq2 = tx.objectStore('setExclusions').getAll()
              eq2.onsuccess = () => {
                out.exclusions = eq2.result.length
              }
              tx.oncomplete = () => resolve(out)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        [bdIds.nikujaga, bdIds.curry],
      )
      check('BULKDEL-01 レシピ本体が消える', bdState.remaining === 0, JSON.stringify(bdState))
      check('BULKDEL-01 週の献立に孤児が残らない', bdState.orphanPlans === 0, JSON.stringify(bdState))
      check('BULKDEL-01 今日の献立に孤児が残らない', bdState.orphanToday === 0, JSON.stringify(bdState))
      check(
        'BULKDEL-01 基本レシピには再取込除外の記録を残さない(入れ直しで戻せる既存挙動を維持)',
        bdState.exclusions === 0,
        JSON.stringify(bdState),
      )

      // --- 便GZ(2026-08-16 オーナー承認): レシピを消しても作った記録は残る ---
      // オーナー原文「レシピカードは削除されてレシピ詳細画面にも行けなくなり、記録を見るときに、
      // 記録した情報や写真閲覧などはできるがレシピ詳細画面には行けない」
      const bdDetached = await bdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('detachedLogs', 'readonly')
              const g = tx.objectStore('detachedLogs').getAll()
              g.onsuccess = () =>
                resolve({
                  logs: g.result.reduce((sum, r) => sum + r.logs.length, 0),
                  photos: g.result.reduce(
                    (sum, r) => sum + r.logs.filter((l) => !!l.photo).length,
                    0,
                  ),
                  titles: g.result.map((r) => r.title).sort(),
                  // 印(uid)を持っていないと入れ直しでつながりが戻らない
                  withUid: g.result.filter((r) => !!r.recipeUid).length,
                })
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'BULKDEL-01(便GZ) レシピを消しても作った記録3件が端末に残る',
        bdDetached.logs === 3,
        JSON.stringify(bdDetached),
      )
      check(
        'BULKDEL-01(便GZ) 記録に添えた写真も残る',
        bdDetached.photos === 1,
        JSON.stringify(bdDetached),
      )
      check(
        'BULKDEL-01(便GZ) 残った記録は料理名と印を持つ(印が無いと入れ直しでつながらない)',
        bdDetached.withUid === 2 &&
          bdDetached.titles.includes('肉じゃが') &&
          bdDetached.titles.includes('カレーライス'),
        JSON.stringify(bdDetached),
      )
      // 「作った記録の一覧」で読めて、レシピ詳細へは行けない
      await bdPage.goto(`${BASE}/#/history`, { waitUntil: 'networkidle' })
      await bdPage.waitForTimeout(1000)
      const bdHistoryText = (await bdPage.textContent('body')) ?? ''
      check(
        'BULKDEL-01(便GZ) 消したレシピの記録が「作った記録の一覧」に出る',
        bdHistoryText.includes('肉じゃが') && bdHistoryText.includes('カレーライス'),
        bdHistoryText.slice(0, 400),
      )
      check(
        'BULKDEL-01(便GZ) レシピが無いことが一覧で読んで分かる',
        bdHistoryText.includes(ja.cookedDetail.deletedRecipeLabel),
        bdHistoryText.slice(0, 400),
      )
      await bdPage.getByRole('button', { name: '肉じゃがの作った記録を見る' }).first().click()
      await bdPage.waitForTimeout(600)
      const bdLogDialog =
        (await bdPage.locator('[data-testid="cooked-detail-deleted-recipe"]').count()) === 1
      check('BULKDEL-01(便GZ) 記録の小窓に、レシピが無いことが書いてある', bdLogDialog)
      check(
        'BULKDEL-01(便GZ) 記録の小窓からレシピ詳細へは行けない',
        (await bdPage.getByRole('link', { name: 'レシピを見る' }).count()) === 0,
      )
      check(
        'BULKDEL-01(便GZ) 残った記録は1件ずつ消せる(減らす手立てがある)',
        (await bdPage.getByTestId('cooked-detail-delete-detached').count()) === 1,
      )
      await bdPage.keyboard.press('Escape')
      await bdPage.waitForTimeout(300)

      // 実際に設定の「基本レシピを入れ直す」で2品が戻り、記録もつながり直すことまで確認する
      await bdPage.goto(`${BASE}/#/settings?section=recipe`, { waitUntil: 'networkidle' })
      await bdPage.waitForTimeout(900)
      await bdPage.getByRole('button', { name: ja.settings.starterReload }).click()
      await bdPage.waitForTimeout(1500)
      await bdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bdPage.waitForTimeout(1200)
      const bdRestored = (await bdPage.textContent('body')) ?? ''
      check(
        'BULKDEL-01 削除した基本レシピは「基本レシピを入れ直す」で戻る',
        bdRestored.includes('肉じゃが') && bdRestored.includes('カレーライス'),
      )
      const bdRestoredLogs = await bdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () =>
                resolve(
                  g.result
                    .filter((r) => r.title === '肉じゃが' || r.title === 'カレーライス')
                    .reduce((sum, r) => sum + (r.cookedLogs?.length ?? 0), 0),
                )
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      // 2026-08-16 便GZ: 同梱の基本レシピの印は料理名から決まるので、入れ直すと同じ印の品が戻り、
      // 残しておいた記録がその品につながり直す（確認文もそう言っている）
      check(
        'BULKDEL-01(便GZ) 入れ直すと作った記録3件がレシピにつながり直す',
        bdRestoredLogs === 3,
        `logs=${bdRestoredLogs}`,
      )
      const bdDetachedAfter = await bdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('detachedLogs', 'readonly')
              const g = tx.objectStore('detachedLogs').getAll()
              g.onsuccess = () => resolve(g.result.length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'BULKDEL-01(便GZ) つながり直した記録は「レシピの無い記録」から消える(二重に出さない)',
        bdDetachedAfter === 0,
        `rows=${bdDetachedAfter}`,
      )
    } finally {
      await bdBrowser.close()
    }
  }

  // --- AISLE-01: 買い物メモの売り場順カスタム(2026-08-02 便CT/C15・オーナー承認)。
  // 既定は従来どおり(野菜・きのこ→肉・魚介→…)で、設定「買い物メモの売り場順」で並びを
  // 入れ替えると買い物メモの整列に即反映され、リロードしても維持され、「初期設定に戻す」で
  // 元に戻ること。買い物メモ側の控えめな入口から設定の該当欄へ辿れることも確認する。 ---
  currentCheck = 'AISLE-01'
  {
    const aiBrowser = await chromium.launch()
    const aiContext = await aiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const aiPage = await aiContext.newPage()
    aiPage.on('dialog', (dialog) => dialog.accept())
    aiPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@AISLE-01] ${text}`)
    })
    aiPage.on('pageerror', (err) => errors.push(`[pageerror@AISLE-01] ${err.message}`))
    try {
      await aiPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await aiPage.waitForTimeout(1800)
      await aiPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await aiPage.waitForTimeout(400)
      // 3グループにまたがる食材を手入力で足す(入力順は売り場順とわざとずらす)
      for (const name of ['しょうゆ', '玉ねぎ', '豚こま切れ肉']) {
        await aiPage.getByPlaceholder(ja.shopping.manualPlaceholder).fill(name)
        await aiPage.getByRole('button', { name: '追加', exact: true }).click()
        await aiPage.waitForTimeout(350)
      }
      // 2026-08-08 便DY-1: 買い物メモは売り場ごとのブロック(見出し+ul)になったので、
      // 食材名はブロックを跨いで document 順に拾う(=見た目の並びと同じ)
      const memoNames = () =>
        aiPage.evaluate(() =>
          Array.from(document.querySelectorAll('ul.divide-y > li > button > span.font-bold')).map(
            (el) => el.textContent,
          ),
        )
      check(
        'AISLE-01 既定は野菜・きのこ→肉・魚介→調味料の順',
        JSON.stringify(await memoNames()) === JSON.stringify(['玉ねぎ', '豚こま切れ肉', 'しょうゆ']),
        JSON.stringify(await memoNames()),
      )

      // 買い物メモ内の控えめな入口 →設定の「買い物メモの売り場順」へ着地する
      await aiPage.getByRole('link', { name: ja.shopping.aisleOrderLink }).click()
      await aiPage.waitForTimeout(1000)
      check('AISLE-01 買い物メモから売り場順の設定へ辿れる', aiPage.url().includes('section=aisle'), aiPage.url())
      check(
        'AISLE-01 設定に売り場順の欄がある',
        await aiPage.locator('#aisle-section').isVisible(),
      )
      check(
        'AISLE-01 未変更なら初期設定の順番であることを示す',
        ((await aiPage.locator('#aisle-section').textContent()) ?? '').includes(ja.settings.aisleOrderDefaultNote),
      )

      // 「調味料」を4回上へ動かして先頭にする
      const seasoningUp = aiPage
        .locator('#aisle-section li', { hasText: ja.pantry.group.seasoning })
        .getByRole('button', { name: '上へ移動' })
      for (let i = 0; i < 4; i += 1) {
        await seasoningUp.click()
        await aiPage.waitForTimeout(350)
      }
      // 行は「連番 + グループ名 + 上下ボタン」なので、グループ名だけを拾う(連番のspanは w-6)
      const aiOrderLabels = await aiPage.evaluate(() =>
        Array.from(document.querySelectorAll('#aisle-section li > span.flex-1')).map(
          (el) => el.textContent,
        ),
      )
      check(
        'AISLE-01 上へ移動で「調味料」が先頭になる',
        aiOrderLabels[0] === '調味料',
        JSON.stringify(aiOrderLabels),
      )
      // 2026-08-04 便DV-3: 「初期設定に戻す」は並びを変えていないうちも常に出る。
      // 並びを変えたら「いまは初期設定の順番です」の方が消える
      check(
        'AISLE-01 並びを変えると「いまは初期設定の順番です」が消える(ボタンは常時ある)',
        (await aiPage
          .locator('#aisle-section')
          .getByRole('button', { name: ja.settings.aisleOrderReset })
          .isVisible()) &&
          !((await aiPage.locator('#aisle-section').textContent()) ?? '').includes(ja.settings.aisleOrderDefaultNote),
      )

      await aiPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await aiPage.waitForTimeout(1200)
      await aiPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await aiPage.waitForTimeout(500)
      check(
        'AISLE-01 買い物メモの整列に即反映される',
        JSON.stringify(await memoNames()) === JSON.stringify(['しょうゆ', '玉ねぎ', '豚こま切れ肉']),
        JSON.stringify(await memoNames()),
      )
      // 設定に保存されるのでリロードしても維持される
      await aiPage.reload({ waitUntil: 'networkidle' })
      await aiPage.waitForTimeout(1500)
      await aiPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await aiPage.waitForTimeout(500)
      check(
        'AISLE-01 リロードしても売り場順が維持される',
        JSON.stringify(await memoNames()) === JSON.stringify(['しょうゆ', '玉ねぎ', '豚こま切れ肉']),
        JSON.stringify(await memoNames()),
      )

      // 「初期設定に戻す」で従来の並びへ戻る
      await aiPage.goto(`${BASE}/#/settings?section=aisle`, { waitUntil: 'networkidle' })
      await aiPage.waitForTimeout(1000)
      await aiPage.locator('#aisle-section').getByRole('button', { name: ja.settings.aisleOrderReset }).click()
      await aiPage.waitForTimeout(600)
      check(
        'AISLE-01 初期設定に戻すと案内が「いまは初期設定の順番です」に変わる',
        ((await aiPage.locator('#aisle-section').textContent()) ?? '').includes(ja.settings.aisleOrderDefaultNote),
      )
      await aiPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await aiPage.waitForTimeout(1200)
      await aiPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await aiPage.waitForTimeout(500)
      check(
        'AISLE-01 既定に戻すと買い物メモも元の並びに戻る',
        JSON.stringify(await memoNames()) === JSON.stringify(['玉ねぎ', '豚こま切れ肉', 'しょうゆ']),
        JSON.stringify(await memoNames()),
      )
    } finally {
      await aiBrowser.close()
    }
  }
