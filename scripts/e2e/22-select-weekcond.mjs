// ==========================================================================================
// e2e の節: 複数選択・週の条件と畳み方・週の書式
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
// この中の節: SELECT-UI-01, SELECT-UI-02, SELECT-UI-03, CARDUNIFY-01, DELMSG-01, DELMSG-02, EMPTYNAV-01, HV-01, WEEKCOND-01, WEEKCOND-02, WEEKFOLD-01, WEEKFMT-01
// ==========================================================================================
import './_shared.mjs'

  // --- SELECT-UI-01: レシピ一覧の複数選択まわり(2026-08-15 便GU・オーナー実機フィードバック4件) ---
  //  ① 複数選択中に画面下のタブを押すと、タブの下のレシピカードが押されて移動できなかった
  //  ② 案内文に書いてある操作(タップで選ぶ・もう一度タップで外す)が、そのとおりに効くこと
  //  ③ 選んだあとの操作と、選択をやめる操作が、一覧を下まで送っても画面の中にあること
  //  ④ 写真が読めないレシピでも、カードの絵の枠が空白にならない(代わり絵に戻る)こと
  // 置き場所ではなく「押したときにどうなるか」で測る(どこに出ていても同じ判定になる形)。
  // タップは座標で送る(実機と同じで、その点でいちばん上にある要素が受ける)。
  //
  // 2026-08-17 便HJ(オーナー実機フィードバック「『選択』ボタン押下したら選択をやめるボタンに
  // 変化するようにして。場所が変わると戻る時に迷子になる」「選択ボタン押下→レシピ選択→選択終了→
  // 複数のボタンからレシピをどうするのか選ぶ、という流れはどうか」)で ③ を測り直した:
  //  ・入る/やめるは同じ場所の1つのボタン(押しても上端・右端が動かない)
  //  ・選んだあとの操作は帯に並べず、「選び終わる」→窓の4つの道(献立/書き出し/削除/やめる)で選ぶ
  // 測るのは変わらず「一覧を下まで送っても、次に進む操作とその選択肢に手が届くか」。
  currentCheck = 'SELECT-UI-01'
  {
    const suBrowser = await chromium.launch()
    try {
      for (const [suLabel, suViewport] of [
        ['スマホ幅', { width: 390, height: 844 }],
        ['PC幅', { width: 1280, height: 800 }],
      ]) {
        const suCtx = await suBrowser.newContext({ viewport: suViewport })
        const suPage = await suCtx.newPage()
        suPage.on('console', (msg) => {
          if (msg.type() !== 'error') return
          const text = msg.text()
          if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
          errors.push(`[console@SELECT-UI-01] ${text}`)
        })
        suPage.on('pageerror', (err) => errors.push(`[pageerror@SELECT-UI-01] ${err.message}`))
        suPage.on('dialog', (d) => void d.accept())
        await suPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await suPage.waitForTimeout(2200) // 初回シード完了待ち

        const suSelectedCount = () =>
          suPage.locator('[data-testid="select-card"][aria-pressed="true"]').count()
        /** 画面の中にあり、下に固定した帯にも隠れていないカードの中心座標 */
        const suFreeCardPoint = () =>
          suPage.evaluate(() => {
            const bars = [...document.querySelectorAll('[data-app-bottom-bar]')]
            const barTop = bars.reduce((min, bar) => {
              const r = bar.getBoundingClientRect()
              return r.height > 0 ? Math.min(min, r.top) : min
            }, window.innerHeight)
            const cards = [...document.querySelectorAll('[data-testid="select-card"]')]
            for (const card of cards.reverse()) {
              const r = card.getBoundingClientRect()
              if (r.top >= 0 && r.bottom <= barTop) {
                return { x: r.x + r.width / 2, y: r.y + r.height / 2, label: card.getAttribute('aria-label') }
              }
            }
            return null
          })
        /** 名前で指したカードを画面の中央へ送り、その中心座標を返す(下の帯に隠れない位置) */
        const suCardPointByLabel = async (cardLabel) => {
          const point = await suPage.evaluate((name) => {
            const card = [...document.querySelectorAll('[data-testid="select-card"]')].find(
              (el) => el.getAttribute('aria-label') === name,
            )
            if (!card) return null
            card.scrollIntoView({ block: 'center' })
            const r = card.getBoundingClientRect()
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
          }, cardLabel)
          await suPage.waitForTimeout(300)
          return point
        }
        /**
         * 下部タブの中心と、その点で実際に当たる要素を返す。
         * overCard は「その点の真下にレシピカードが敷かれているか」(形の重なりだけで判定)。
         * この検証は overCard が真のタブについてだけ意味を持つので、前提として別に確かめる
         */
        const suTabPoints = () =>
          suPage.evaluate(() => {
            const nav = document.querySelector('nav[data-app-bottom-bar]')
            if (!nav) return []
            const cardRects = [...document.querySelectorAll('a[href^="#/recipes/"]')].map((el) =>
              el.getBoundingClientRect(),
            )
            return [...nav.querySelectorAll('a')].map((a) => {
              const r = a.getBoundingClientRect()
              const x = r.x + r.width / 2
              const y = r.y + r.height / 2
              const hit = document.elementFromPoint(x, y)
              return {
                label: (a.textContent ?? '').trim(),
                x,
                y,
                overCard: cardRects.some(
                  (c) => c.left <= x && x <= c.right && c.top <= y && y <= c.bottom,
                ),
                insideNav: hit ? nav.contains(hit) : false,
                hitLabel: hit?.getAttribute?.('aria-label') ?? null,
              }
            })
          })
        /**
         * 一覧を下の方まで送る。いちばん下まで送りきらないのは、末尾では下余白のぶん
         * カードがタブ帯まで届かず「タブの下にカードがある」状態を作れないため
         */
        const suScrollDeep = async () => {
          await suPage.evaluate(() =>
            window.scrollTo(0, Math.round(document.body.scrollHeight * 0.6)),
          )
          await suPage.waitForTimeout(400)
        }

        /** 目印の要素があれば押す。無ければ押さずに false（無いこと自体は各checkがNGとして出す） */
        const suClickIfPresent = async (locator) => {
          if ((await locator.count()) !== 1) return false
          await locator.click()
          await suPage.waitForTimeout(400)
          return true
        }
        /** 名前で指したボタンの外枠（押す前と押した後で場所が動いていないかを測るため） */
        const suButtonBox = async (name) => {
          const button = suPage.getByRole('button', { name, exact: true })
          if ((await button.count()) === 0) return null
          return await button.first().boundingBox()
        }

        // 選択モードに入る前後で、入口のボタンが同じ場所にあること(2026-08-17 便HJ)。
        // 幅は名前の長さで変わるので、動かないことを上端と右端で測る
        const suToggleBefore = await suButtonBox('選択')
        await suPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
        await suPage.waitForTimeout(300)
        const suToggleAfter = await suButtonBox('選択をやめる')
        check(
          `SELECT-UI-01(${suLabel}) 「選択」を押しても、ボタンは同じ場所で「選択をやめる」に変わる`,
          !!suToggleBefore &&
            !!suToggleAfter &&
            Math.abs(suToggleBefore.y - suToggleAfter.y) <= 2 &&
            Math.abs(
              suToggleBefore.x + suToggleBefore.width - (suToggleAfter.x + suToggleAfter.width),
            ) <= 2,
          JSON.stringify({ before: suToggleBefore, after: suToggleAfter }),
        )
        await suScrollDeep()

        // ① タブ帯の当たり判定。中心がカードに重なるタブでも、受けるのはタブ自身であること
        const suTabs = await suTabPoints()
        const suTabsOverCard = suTabs.filter((t) => t.overCard)
        const suTabDetail = JSON.stringify(
          suTabs.map(({ label, overCard, insideNav, hitLabel }) => ({ label, overCard, insideNav, hitLabel })),
        )
        check(
          `SELECT-UI-01(${suLabel}) 前提: タブの下にレシピカードが敷かれている位置まで送れている`,
          suTabsOverCard.length > 0,
          suTabDetail,
        )
        check(
          `SELECT-UI-01(${suLabel}) 選択中でも、下にカードがあるタブはタブ自身が受ける(カードが横取りしない)`,
          suTabsOverCard.length > 0 && suTabsOverCard.every((t) => t.insideNav),
          suTabDetail,
        )

        // ③ 一覧の下端付近のカードを選んでも、操作は画面の中にある
        const suPoint = await suFreeCardPoint()
        check(
          `SELECT-UI-01(${suLabel}) 前提: 下の方まで送った位置に、帯に隠れていないカードがある`,
          !!suPoint,
        )
        await suPage.mouse.click(suPoint.x, suPoint.y)
        await suPage.waitForTimeout(400)
        check(
          `SELECT-UI-01(${suLabel}) 一覧の下の方にあるカードをタップすると選べる`,
          (await suSelectedCount()) === 1,
        )
        // 無い要素は「画面の中に無い」として即NGにする(待ち続けて節ごと中断させない)
        const suInViewport = async (locator) => {
          if ((await locator.count()) !== 1) return false
          const box = await locator.boundingBox()
          if (!box) return false
          return box.y >= 0 && box.y + box.height <= suPage.viewportSize().height
        }
        const suFinish = suPage.getByTestId('selection-finish')
        const suActions = suPage.getByTestId('selection-actions')
        const suDoor = (name) => suPage.getByTestId(`selection-actions-${name}`)
        check(
          `SELECT-UI-01(${suLabel}) 一覧を下の方まで送っても、選び終わる操作が画面の中にある`,
          (await suFinish.count()) === 1 && (await suInViewport(suFinish)),
        )
        check(
          `SELECT-UI-01(${suLabel}) 何品選んでいるかが、操作と同じ場所に出る`,
          /\d+品を選択中/.test((await suPage.getByTestId('selection-bar').innerText()) ?? ''),
          await suPage.getByTestId('selection-bar').innerText(),
        )
        check(
          `SELECT-UI-01(${suLabel}) 抜けるボタンを「完了」という名前のままにしない`,
          (await suPage.getByRole('button', { name: '完了', exact: true }).count()) === 0,
        )

        // 選び終わったら、選んだレシピをどうするのかを窓の中の4つから選ぶ(2026-08-17 便HJ)。
        // 帯に4つ並べると小さい画面がふさがるので、窓は「選び終わる」を押したときだけ出す
        await suClickIfPresent(suFinish)
        check(
          `SELECT-UI-01(${suLabel}) 選び終わると、献立に入れる・書き出す・削除・やめるの4つが出る`,
          (await suActions.count()) === 1 &&
            (await suDoor('today').count()) === 1 &&
            (await suDoor('export').count()) === 1 &&
            (await suDoor('delete').count()) === 1 &&
            (await suDoor('cancel').count()) === 1,
          await suActions.innerText().catch(() => '(窓が出ていない)'),
        )
        check(
          `SELECT-UI-01(${suLabel}) その4つはどれも画面の中にある(一覧を下まで送った位置でも)`,
          (await suInViewport(suDoor('today'))) &&
            (await suInViewport(suDoor('export'))) &&
            (await suInViewport(suDoor('delete'))) &&
            (await suInViewport(suDoor('cancel'))),
        )
        // 窓の作法は確認の窓(ConfirmDialog)と同じ＝押し間違えて開いても、閉じれば元の続きに戻れる
        await suPage.keyboard.press('Escape')
        await suPage.waitForTimeout(300)
        check(
          `SELECT-UI-01(${suLabel}) 窓を閉じても選んだレシピは外れない(選び直せる)`,
          (await suActions.count()) === 0 && (await suSelectedCount()) === 1,
        )

        // ② 案内文どおり: 同じカードをもう一度タップすると外れる
        const suPoint2 = await suCardPointByLabel(suPoint.label)
        await suPage.mouse.click(suPoint2.x, suPoint2.y)
        await suPage.waitForTimeout(300)
        check(
          `SELECT-UI-01(${suLabel}) 同じカードをもう一度タップすると選択が外れる(案内文どおり)`,
          (await suSelectedCount()) === 0,
        )
        check(
          `SELECT-UI-01(${suLabel}) 1品も選んでいないうちは、選び終わるを押せない`,
          (await suFinish.count()) === 1 && (await suFinish.isDisabled()),
        )

        // ① 実際にタブを押す。移動できること・押した先でカードが選ばれないこと
        const suPoint3 = await suFreeCardPoint()
        await suPage.mouse.click(suPoint3.x, suPoint3.y)
        await suPage.waitForTimeout(300)
        await suScrollDeep()
        const suSettingsTab = (await suTabPoints()).find((t) => t.label.includes('設定') && t.overCard)
        await suPage.mouse.click(suSettingsTab.x, suSettingsTab.y)
        await suPage.waitForTimeout(900)
        check(
          `SELECT-UI-01(${suLabel}) 選択中でもタブを押せば、その画面へ移動する`,
          suPage.url().includes('#/settings'),
          suPage.url(),
        )

        // タブを移動したら選択は残さない(戻ってきた一覧はふだんの状態から始まる)
        await suPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await suPage.waitForTimeout(1400)
        check(
          `SELECT-UI-01(${suLabel}) タブを移動して戻ると、選択は残らずふだんの一覧に戻る`,
          (await suPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).count()) === 1 &&
            (await suPage.getByTestId('selection-bar').count()) === 0 &&
            (await suSelectedCount()) === 0,
        )

        // ③ やめる操作は、選んだものを外してふだんの一覧に戻す。
        // 入口と同じ場所のボタンと、選び終わったあとの窓の中と、どちらから抜けても同じ結果になること
        const suBackToPlainList = async () =>
          (await suPage.getByTestId('selection-bar').count()) === 0 &&
          (await suSelectedCount()) === 0 &&
          (await suPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).count()) === 1
        await suPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
        await suPage.waitForTimeout(300)
        const suPoint4 = await suFreeCardPoint()
        await suPage.mouse.click(suPoint4.x, suPoint4.y)
        await suPage.waitForTimeout(300)
        check(`SELECT-UI-01(${suLabel}) 前提: 1品選べている`, (await suSelectedCount()) === 1)
        await suPage.getByTestId('selection-exit').click()
        await suPage.waitForTimeout(500)
        check(
          `SELECT-UI-01(${suLabel}) 選択をやめると、選んだレシピが外れてふだんの一覧に戻る`,
          await suBackToPlainList(),
        )

        await suPage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
        await suPage.waitForTimeout(300)
        const suPoint5 = await suFreeCardPoint()
        await suPage.mouse.click(suPoint5.x, suPoint5.y)
        await suPage.waitForTimeout(300)
        await suClickIfPresent(suFinish)
        await suClickIfPresent(suDoor('cancel'))
        await suPage.waitForTimeout(400)
        check(
          `SELECT-UI-01(${suLabel}) 選び終わったあとの窓からやめても、同じようにふだんの一覧に戻る`,
          (await suActions.count()) === 0 && (await suBackToPlainList()),
        )

        // ④ 写真が読めないレシピでも、カードの絵の枠が空白にならない。
        // 対象はidで名指しする(料理名での探し当ては、名前を含む別のレシピを掴みうる)
        const suBrokenId = await suPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction(['recipes'], 'readwrite')
                const store = tx.objectStore('recipes')
                const g = store.getAll()
                g.onsuccess = () => {
                  const target = g.result.find((r) => r.title === '肉じゃが')
                  // 画像として読めないバイト列(壊れた写真・空の写真の代わり)
                  store.put({
                    ...target,
                    photo: new Blob(['x'], { type: 'image/jpeg' }),
                    updatedAt: Date.now(),
                  })
                  tx.oncomplete = () => resolve(target.id)
                  tx.onerror = () => reject(tx.error)
                }
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
        await suPage.reload({ waitUntil: 'networkidle' })
        await suPage.waitForTimeout(2000)
        const suDrawn = await suPage.evaluate((id) => {
          const card = document.querySelector(`a[href="#/recipes/${id}"]`)
          if (!card) return { found: false }
          const img = card.querySelector('img')
          const icon = [...card.querySelectorAll('span[aria-hidden]')].find((el) => {
            const cs = getComputedStyle(el)
            const mask = cs.maskImage !== 'none' ? cs.maskImage : cs.webkitMaskImage
            return (mask ?? '').includes('/icons/')
          })
          return {
            found: true,
            brokenImage: !!img && (img.naturalWidth === 0 || img.naturalHeight === 0),
            hasIcon: !!icon,
          }
        }, suBrokenId)
        check(
          `SELECT-UI-01(${suLabel}) 写真が読めないレシピのカードは、代わり絵に戻って空白にならない`,
          suDrawn.found && suDrawn.hasIcon && !suDrawn.brokenImage,
          JSON.stringify(suDrawn),
        )

        await suCtx.close()
      }
    } finally {
      await suBrowser.close()
    }
  }

  // --- SELECT-UI-02: 小さい画面(375x667)で、選んでいる最中もレシピのカードが見えること ---
  // 2026-08-17 便HJ・オーナー実機フィードバック「画面が小さいと、レシピ選択中に出る選択肢ボタンで
  // 画面の半分が見えなくなる」(送られてきた画面は375x667相当で、カードが2枚しか見えていなかった)。
  // 置き場所ではなく「見えているか」で測る:
  //  ・下に固定した帯が画面の半分を覆っていないこと(オーナーの言葉そのままの基準)
  //  ・帯に隠れず丸ごと見えるカードの枚数が、ふだんの一覧から減らないこと
  // 枚数を決め打ちしないのは、カードの寸法や1行に並ぶ枚数が変わっても同じ判定になるようにするため。
  // 併せて、献立の「今日の献立を探す」から来た選択モード(?select=today)は行き先が決まっているので
  // 4つの道を出さず、これまでどおり決定ボタンと「入れずに献立に戻る」で完結することも見る。
  currentCheck = 'SELECT-UI-02'
  {
    const s2Browser = await chromium.launch()
    try {
      const s2Ctx = await s2Browser.newContext({ viewport: { width: 375, height: 667 } })
      const s2Page = await s2Ctx.newPage()
      s2Page.on('pageerror', (err) => errors.push(`[pageerror@SELECT-UI-02] ${err.message}`))
      await s2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await s2Page.waitForTimeout(2200) // 初回シード完了待ち

      /** 一覧の先頭で、下に固定した帯がどれだけ画面を覆っているか・カードが何枚見えているか */
      const s2Measure = async () => {
        await s2Page.evaluate(() => window.scrollTo(0, 0))
        await s2Page.waitForTimeout(300)
        return await s2Page.evaluate(() => {
          const vh = window.innerHeight
          const bars = [...document.querySelectorAll('[data-app-bottom-bar]')]
          const barTop = bars.reduce((min, bar) => {
            const r = bar.getBoundingClientRect()
            return r.height > 0 && r.top < min ? r.top : min
          }, vh)
          const rects = [...document.querySelectorAll('a[href^="#/recipes/"]')]
            .filter((el) => el.getAttribute('href') !== '#/recipes/new')
            .map((el) => el.getBoundingClientRect())
          return {
            vh,
            coveredPx: Math.round(vh - barTop),
            fullyVisibleCards: rects.filter((r) => r.top >= 0 && r.bottom <= barTop).length,
          }
        })
      }

      const s2Plain = await s2Measure()
      check(
        'SELECT-UI-02 前提: ふだんの一覧では、帯に隠れず丸ごと見えるカードがある',
        s2Plain.fullyVisibleCards > 0,
        JSON.stringify(s2Plain),
      )
      await s2Page.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
      await s2Page.waitForTimeout(400)
      await s2Page.locator('[data-testid="select-card"]').first().click()
      await s2Page.waitForTimeout(400)
      const s2Picking = await s2Measure()
      // 2026-08-27 便LO: 下の「献立から来たときは入口を出さない」と**対**にして、
      // ふつうの選択モードでは同じ入口が出ていることを先に押さえる。
      // 対が無いと、入口そのものが消えても改名されても「出さない」は必ず緑になる
      check(
        'SELECT-UI-02 ふつうの選択モードでは「選び終わる」が出ていて、押すと窓が開く（下の「出さない」と対）',
        (await s2Page.getByTestId('selection-finish').count()) === 1,
        `決定=${await s2Page.getByTestId('selection-finish').count()}件`,
      )
      await s2Page.getByTestId('selection-finish').click()
      await s2Page.waitForTimeout(400)
      check(
        'SELECT-UI-02 ふつうの選択モードでは、どうするかを選ぶ窓が開く（下の「出さない」と対）',
        (await s2Page.getByTestId('selection-actions').count()) === 1,
        `窓=${await s2Page.getByTestId('selection-actions').count()}件`,
      )
      // 開いた窓は閉じて、以降の測り方（帯の高さ・カードの枚数）を変えない
      await s2Page.keyboard.press('Escape')
      await s2Page.waitForTimeout(300)
      check(
        'SELECT-UI-02 レシピを選んでいる最中も、下に固定した帯が画面の半分を覆わない',
        s2Picking.coveredPx * 2 < s2Picking.vh,
        `帯=${s2Picking.coveredPx}px / 画面=${s2Picking.vh}px`,
      )
      check(
        'SELECT-UI-02 レシピを選んでいる最中も、丸ごと見えるカードの枚数がふだんの一覧から減らない',
        s2Picking.fullyVisibleCards >= s2Plain.fullyVisibleCards,
        `ふだん=${s2Plain.fullyVisibleCards}枚 / 選択中=${s2Picking.fullyVisibleCards}枚`,
      )

      // 献立から来た選択モードは行き先が決まっているので、4つの道は出さない(2026-08-11 便FPの動きのまま)。
      // 献立の画面を経由して開く: 同じ「#/recipes」に居るまま `?select=today` を足しても
      // 画面は作り直されず、来たときの指示(select=today)を受け取れないため
      await s2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await s2Page.waitForTimeout(900)
      await s2Page.goto(`${BASE}/#/recipes?select=today`, { waitUntil: 'networkidle' })
      await s2Page.waitForTimeout(1500)
      check(
        'SELECT-UI-02 献立から来たときは、選んでいる最中の案内と決定ボタンがそのまま出る',
        (await s2Page.getByTestId('select-for-today-banner').count()) === 1 &&
          (await s2Page.getByTestId('add-selected-to-today').count()) === 1,
      )
      check(
        'SELECT-UI-02 献立から来たときは、どうするかを選ぶ窓の入口を出さない(行き先が決まっているため)',
        (await s2Page.getByTestId('selection-finish').count()) === 0 &&
          (await s2Page.getByTestId('selection-actions').count()) === 0,
      )
      check(
        'SELECT-UI-02 献立から来たときは「入れずに献立に戻る」がある',
        (await s2Page.getByRole('button', { name: ja.recipes.selectExitToMealPlan }).count()) === 1,
      )
      await s2Page.getByRole('button', { name: ja.recipes.selectExitToMealPlan }).click()
      await s2Page.waitForTimeout(1000)
      check(
        'SELECT-UI-02 「入れずに献立に戻る」を押すと献立の画面へ戻る',
        s2Page.url().includes('#/meal-plan'),
        s2Page.url(),
      )

      await s2Ctx.close()
    } finally {
      await s2Browser.close()
    }
  }

  // --- SELECT-UI-03: 「選んだ◯品をどうしますか？」の窓から、選ぶ作業の続きに戻れる ---
  // 2026-08-18 便HO・オーナー実機フィードバック(原文)「選択したレシピをどうするかの窓に、
  // キャンセルで選択の続きに戻れるようにしたい。選択をやめる、で選択したレシピもリセットされてしまう」。
  //
  // 2026-08-17 便HJの時点でも、窓の外のタップとEscapeなら選んだレシピを残したまま閉じられたが、
  // 窓の中に並ぶボタンは「今日の献立に入れる」「ファイルに書き出す」「削除する」「選択をやめる」の
  // 4つで、続きに戻る道だけが**押せる場所として見えていなかった**。
  //
  // 測り方(禁じ手④「置き場所への固定」・②「文字列の完全一致」を避ける):
  // 名前や並び順で探さず、窓の中のボタンを1つずつ押して**起きたこと**で見分ける。
  //   ・窓が閉じて、選んだレシピが残り、選択モードのまま  = 選ぶ作業の続きに戻る道
  //   ・窓が閉じて、選んだレシピが外れ、ふだんの一覧に戻る = 選択をやめる道
  // 両方が窓の中に押せるボタンとしてあり、名前が違う(同じ名前で違う結果にならない)ことを見る。
  currentCheck = 'SELECT-UI-03'
  {
    const s3Browser = await chromium.launch()
    try {
      for (const [s3Label, s3Viewport] of [
        ['小さい画面', { width: 375, height: 667 }],
        ['PC幅', { width: 1280, height: 800 }],
      ]) {
        const s3Ctx = await s3Browser.newContext({ viewport: s3Viewport })
        const s3Page = await s3Ctx.newPage()
        s3Page.on('pageerror', (err) => errors.push(`[pageerror@SELECT-UI-03] ${err.message}`))
        await s3Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await s3Page.waitForTimeout(2200) // 初回シード完了待ち

        const s3Actions = s3Page.getByTestId('selection-actions')
        const s3Selected = () =>
          s3Page.locator('[data-testid="select-card"][aria-pressed="true"]').count()
        /** ふだんの一覧から始め直す(別の画面を経由して選択モードごと作り直す) */
        const s3Reset = async () => {
          await s3Page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
          await s3Page.waitForTimeout(500)
          await s3Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await s3Page.waitForTimeout(1400)
        }
        /** 2品選んで「選び終わる」まで進み、どうするかの窓を開く */
        const s3OpenDialog = async () => {
          await s3Page.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
          await s3Page.waitForTimeout(400)
          const cards = s3Page.locator('[data-testid="select-card"]')
          await cards.nth(0).click()
          await cards.nth(1).click()
          await s3Page.waitForTimeout(300)
          await s3Page.getByTestId('selection-finish').click()
          await s3Page.waitForTimeout(500)
        }
        /** 窓の中に並ぶボタン(名前・目印・押す面の大きさ) */
        const s3Doors = async () =>
          await s3Actions.locator('button').evaluateAll((els) =>
            els.map((el) => {
              const b = el.getBoundingClientRect()
              return {
                testId: el.dataset.testid ?? '',
                label: (el.innerText ?? '').replace(/​/g, '').replace(/\s+/g, ' ').trim(),
                top: b.top,
                bottom: b.bottom,
                height: b.height,
              }
            }),
          )

        await s3OpenDialog()
        const s3All = await s3Doors()
        check(
          `SELECT-UI-03(${s3Label}) 前提: 選び終わると、どうするかの窓が開く`,
          (await s3Actions.count()) === 1 && s3All.length > 0 && (await s3Selected()) === 2,
          JSON.stringify(s3All.map((d) => d.label)),
        )

        // 「選んだレシピに対して何かをする」道(献立に入れる・書き出す・削除する)以外を、
        // 1つずつ押して結果を見る。押す前に窓を開き直すので、順番に左右されない
        const s3ActionIds = [
          'selection-actions-today',
          'selection-actions-export',
          'selection-actions-delete',
        ]
        const s3Exits = s3All.filter((d) => !s3ActionIds.includes(d.testId))
        const s3Outcomes = []
        for (const door of s3Exits) {
          if (s3Outcomes.length > 0) {
            await s3Reset()
            await s3OpenDialog()
          }
          const button = door.testId
            ? s3Page.getByTestId(door.testId)
            : s3Actions.getByRole('button', { name: door.label, exact: true })
          const box = await button.boundingBox()
          const vh = s3Page.viewportSize().height
          await button.click()
          await s3Page.waitForTimeout(600)
          s3Outcomes.push({
            label: door.label,
            closed: (await s3Actions.count()) === 0,
            kept: (await s3Selected()) === 2,
            stillSelecting: (await s3Page.getByTestId('selection-bar').count()) === 1,
            inViewport: !!box && box.y >= 0 && box.y + box.height <= vh,
            tapHeight: box ? Math.round(box.height) : 0,
          })
        }
        const s3Detail = JSON.stringify(s3Outcomes)
        const s3Continue = s3Outcomes.find((o) => o.closed && o.kept && o.stillSelecting)
        const s3Quit = s3Outcomes.find((o) => o.closed && !o.kept && !o.stillSelecting)

        check(
          `SELECT-UI-03(${s3Label}) 窓の中に、選んだレシピを残したまま選ぶ作業の続きに戻るボタンがある`,
          !!s3Continue,
          s3Detail,
        )
        check(
          `SELECT-UI-03(${s3Label}) 窓の中に、選んだレシピを外してふだんの一覧に戻るボタンもある`,
          !!s3Quit,
          s3Detail,
        )
        check(
          `SELECT-UI-03(${s3Label}) その2つは違う名前で並ぶ(同じ名前で違う結果にならない)`,
          !!s3Continue &&
            !!s3Quit &&
            s3Continue.label.length > 0 &&
            s3Quit.label.length > 0 &&
            s3Continue.label !== s3Quit.label,
          `続きに戻る=${s3Continue?.label ?? '(無い)'} / やめる=${s3Quit?.label ?? '(無い)'}`,
        )
        check(
          `SELECT-UI-03(${s3Label}) 続きに戻るボタンが画面の中にあり、押す面が小さくない`,
          !!s3Continue && s3Continue.inViewport && s3Continue.tapHeight >= 44,
          s3Continue ? JSON.stringify(s3Continue) : '(続きに戻るボタンが無い)',
        )

        await s3Ctx.close()
      }
    } finally {
      await s3Browser.close()
    }
  }

  // --- CARDUNIFY-01: レシピカードの形は「密度」の3つだけ。レシピ一覧の見え方は変えない ---
  // 2026-08-18 便HN・オーナー指摘(原文)「場所や機能ごとにレシピカードの形や内容が変わっているのが
  // みづらい。パターン２つ（もしくは３つ）に絞って。」
  // 「表記揺れを直すように、レシピカードなど、同じ情報なら形もできるだけ揃えることを徹底したい」
  //
  // 共通部品(components/RecipeCard)に密度(large/standard/small)を入れた1段目の見張り。
  // 測るのは寸法の絶対値ではなく**形の決まりごと**にする(端末の文字サイズや写真で数値は動くため):
  //   ・「大」(グリッド)  … 絵は正方形で、カードの幅いっぱい。料理名の枠は2行ぶんの高さを持つ
  //   ・「標準」(一覧)    … 絵は正方形のサムネで、カードより小さい。名前は絵の横に来る
  //   ・どちらも カード全体がレシピ詳細への1枚のリンク
  //   ・表示形式を往復させても、グリッドの寸法がぴたりと元に戻る(切り替えが見た目を持ち帰らない)
  currentCheck = 'CARDUNIFY-01'
  {
    const cuBrowser = await chromium.launch()
    try {
      const cuCtx = await cuBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const cuPage = await cuCtx.newPage()
      cuPage.on('pageerror', (err) => errors.push(`[pageerror@CARDUNIFY-01] ${err.message}`))
      await cuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cuPage.waitForTimeout(2200) // 初回シード完了待ち

      /** 先頭のカード1枚の形を測る。写真の有無で中身が変わらないよう、絵の枠(正方形の箱)を見る */
      const cuShape = () =>
        cuPage.evaluate(() => {
          const card = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).find((a) =>
            /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
          )
          if (!card) return null
          const r = card.getBoundingClientRect()
          // 絵の枠 = カードの中でいちばん大きい正方形の箱(写真でもアイコンの敷物でも同じ)
          let art = null
          for (const el of card.querySelectorAll('div, span')) {
            const b = el.getBoundingClientRect()
            if (b.width < 8 || Math.abs(b.width - b.height) > 1) continue
            if (!art || b.width > art.width) art = b
          }
          const title = card.querySelector('p')
          const tb = title?.getBoundingClientRect()
          const lh = title ? parseFloat(getComputedStyle(title).lineHeight) : 0
          return {
            card: { w: Math.round(r.width * 100) / 100, h: Math.round(r.height * 100) / 100 },
            art: art ? { w: Math.round(art.width * 100) / 100, h: Math.round(art.height * 100) / 100 } : null,
            title: tb ? { w: Math.round(tb.width * 100) / 100, h: Math.round(tb.height * 100) / 100 } : null,
            lineHeight: lh,
            // カードの中に、詳細へ移る別のリンクが二重に入っていないこと
            innerRecipeLinks: card.querySelectorAll('a[href^="#/recipes/"]').length,
          }
        })

      const cuGrid = await cuShape()
      check('CARDUNIFY-01 「大」カードが1枚のリンクとして出ている', !!cuGrid && cuGrid.innerRecipeLinks === 0, JSON.stringify(cuGrid))
      check(
        'CARDUNIFY-01 「大」の絵は正方形で、カードの幅いっぱい',
        !!cuGrid?.art && Math.abs(cuGrid.art.w - cuGrid.art.h) <= 1 && cuGrid.card.w - cuGrid.art.w <= 4,
        JSON.stringify(cuGrid),
      )
      check(
        'CARDUNIFY-01 「大」の料理名の枠は2行ぶんの高さを持つ(名前の長さでカードの背が変わらない)',
        !!cuGrid?.title && cuGrid.lineHeight > 0 && cuGrid.title.h >= cuGrid.lineHeight * 2 - 1,
        JSON.stringify(cuGrid),
      )

      await cuPage.locator(`button[aria-label="${ja.search.layoutToggleToList}"]`).click()
      await cuPage.waitForTimeout(600)
      const cuList = await cuShape()
      check('CARDUNIFY-01 「標準」カードも1枚のリンクとして出ている', !!cuList && cuList.innerRecipeLinks === 0, JSON.stringify(cuList))
      check(
        'CARDUNIFY-01 「標準」の絵は正方形のサムネで、カードの幅より小さい',
        !!cuList?.art && Math.abs(cuList.art.w - cuList.art.h) <= 1 && cuList.art.w < cuList.card.w / 2,
        JSON.stringify(cuList),
      )
      check(
        'CARDUNIFY-01 「標準」は「大」より1枚が低い(同じ情報を狭く出す形になっている)',
        !!cuGrid && !!cuList && cuList.card.h < cuGrid.card.h,
        `大=${JSON.stringify(cuGrid?.card)} 標準=${JSON.stringify(cuList?.card)}`,
      )

      await cuPage.locator(`button[aria-label="${ja.search.layoutToggleToGrid}"]`).click()
      await cuPage.waitForTimeout(600)
      const cuBack = await cuShape()
      check(
        'CARDUNIFY-01 表示形式を往復しても「大」の寸法が元に戻る',
        JSON.stringify(cuBack) === JSON.stringify(cuGrid),
        `往路=${JSON.stringify(cuGrid)} 復路=${JSON.stringify(cuBack)}`,
      )

      // --- 献立の「日」の1品ごとの「作った！」: 押せる大きさが小さくならない ---
      // 台所で濡れた手で押す前提(CLAUDE.md「押せる大きさを小さくしない」)。
      // 便HNで枠だけ→塗りに色をそろえたときに、当たり判定まで小さくしていないことを見張る。
      const cuHref = await cuPage.evaluate(() => {
        const a = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).find((x) =>
          /^#\/recipes\/\d+$/.test(x.getAttribute('href') ?? ''),
        )
        return a?.getAttribute('href')
      })
      await cuPage.goto(`${BASE}/${cuHref}`, { waitUntil: 'networkidle' })
      await cuPage.waitForTimeout(900)
      const cuAdd = cuPage.getByRole('button', { name: ja.detail.todayAdd, exact: true })
      if (await cuAdd.count()) {
        await cuAdd.first().click()
        await cuPage.waitForTimeout(600)
        const cuSlot = slotBtnExceptFill(cuPage, ja.mealPlan.slot.dinner)
        if (await cuSlot.count()) {
          await cuSlot.first().click()
          await cuPage.waitForTimeout(900)
        }
      }
      await cuPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await cuPage.waitForTimeout(1600)
      // 2026-08-20 便II・⑥: 行の「作った！」は整理モードの中に移った
      await openDayOrganize(cuPage)
      const cuCooked = await cuPage.evaluate((label) => {
        const b = Array.from(document.querySelectorAll('button')).find(
          (x) => (x.textContent ?? '').replaceAll('​', '').trim() === label,
        )
        if (!b) return null
        const r = b.getBoundingClientRect()
        return { w: Math.round(r.width), h: Math.round(r.height) }
      }, ja.mealPlan.todayMarkCooked)
      check(
        'CARDUNIFY-01 献立の「日」の1品ごとの記録ボタンは、押せる高さが44px以上',
        !!cuCooked && cuCooked.h >= 44,
        JSON.stringify(cuCooked),
      )

      await cuCtx.close()
    } finally {
      await cuBrowser.close()
    }
  }

  // --- DELMSG-01/02: 消したあと、消えたことが画面に出る（2026-08-18 便HS・軸4）---
  // 直す前に赤くなることを確かめたうえで足した見張り。レシピの1品削除は、削除した瞬間に
  // 編集画面ごと消えて一覧へ移るので**画面が何も言わず**、在庫のまとめて削除はチップが
  // 黙って消えるだけだった（同じ画面の一括「状態設定」はトーストを出していた）。
  //
  // ここで測るのは「トーストが出たか」ではなく **利用者に伝わっているか**＝
  // 画面に出ている文字そのものを見る。知らせ方をトーストからページ内の帯に変えても、
  // 伝わってさえいれば通る（＝実装の形ではなく、確かめたいことを測る）。
  // 準備（総数の読み取り・ボタン探し）に失敗したときは必ず不合格にする＝
  // 「見つからなかったから合格」に倒れる書き方をしない（2026-08-18 FS-06 の反省）。
  currentCheck = 'DELMSG-01'
  {
    const dmBrowser = await chromium.launch()
    try {
      // ① レシピを1品削除する
      const dmCtx = await dmBrowser.newContext()
      const dmPage = await dmCtx.newPage()
      dmPage.on('pageerror', (err) => errors.push(`[pageerror@DELMSG-01] ${err.message}`))
      await dmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(2000)
      const dmTotal = async () => readTotalCount(await dmPage.textContent('body'))
      const dmBefore = await dmTotal()
      const dmHref = await dmPage.locator('a[href^="#/recipes/"]').first().getAttribute('href')
      check(
        'DELMSG-01 準備: 一覧の総数と、消す対象のレシピを読み取れた',
        dmBefore !== null && !!dmHref,
        `総数=${dmBefore} href=${dmHref}`,
      )
      if (dmBefore === null || !dmHref) throw new Error('レシピ一覧から削除するレシピを掴めなかった')
      await dmPage.goto(`${BASE}/${dmHref}`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1200)
      const dmTitle = ((await dmPage.locator('h1').first().textContent()) ?? '')
        .replaceAll('​', '')
        .trim()
      check('DELMSG-01 準備: 消す対象の料理名を読み取れた', dmTitle.length > 0, `料理名=${dmTitle}`)
      if (!dmTitle) throw new Error('消すレシピの料理名を読み取れなかった')
      await dmPage.goto(`${BASE}/${dmHref}/edit`, { waitUntil: 'networkidle' })
      await dmPage.waitForTimeout(1200)
      const dmDelete = dmPage.getByRole('button', { name: ja.form.deleteRecipe, exact: true })
      check('DELMSG-01 準備: 「このレシピを削除」が見つかった', (await dmDelete.count()) > 0)
      await dmDelete.first().click()
      // 確認の窓は installConfirmAutoPress が自動で「削除する」を押す（この台本の共通の作法）
      await dmPage.waitForTimeout(1800)
      check(
        'DELMSG-01 準備: 削除の確認の窓が出た',
        ((await dmPage.evaluate(() => window.__confirmDialogs ?? [])) ?? []).length > 0,
      )
      const dmAfter = await dmTotal()
      check(
        'DELMSG-01 消したぶん、一覧の総数が1減っている',
        dmAfter !== null && dmAfter === dmBefore - 1,
        `前=${dmBefore} 後=${dmAfter}`,
      )
      // 消したレシピはもう一覧に無いので、その料理名が画面に出ているなら
      // それは「消したことを告げる知らせ」以外にありえない
      const dmBody = ((await dmPage.textContent('body')) ?? '').replaceAll('​', '')
      const dmStillListed = await dmPage.evaluate(
        (t) =>
          Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).some((a) =>
            (a.textContent ?? '').replaceAll('​', '').includes(t),
          ),
        dmTitle,
      )
      check(
        'DELMSG-01 消したあと、消したレシピの名前を含む知らせが画面に出る',
        dmBody.includes(dmTitle) && !dmStillListed,
        `料理名=${dmTitle} 一覧に残っている=${dmStillListed}`,
      )
      await dmCtx.close()

      // ② 在庫の食材をまとめて削除する
      currentCheck = 'DELMSG-02'
      const dpCtx = await dmBrowser.newContext()
      const dpPage = await dpCtx.newPage()
      dpPage.on('pageerror', (err) => errors.push(`[pageerror@DELMSG-02] ${err.message}`))
      await dpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await dpPage.waitForTimeout(2200)
      await dpPage
        .getByRole('button', { name: ja.pantry.organizeToggle, exact: true })
        .first()
        .click()
      await dpPage.waitForTimeout(400)
      // 在庫のチップだけを掴む（画面上部の「食材の在庫／買い物メモ」タブも aria-pressed を持つ）
      const dpChips = dpPage.locator('button.rounded-full[aria-pressed]')
      const dpChipCount = await dpChips.count()
      check('DELMSG-02 準備: 整理モードで在庫の食材が並ぶ', dpChipCount >= 2, `チップ数=${dpChipCount}`)
      if (dpChipCount < 2) throw new Error('在庫の食材を2件選べなかった')
      const dpNames = []
      for (let i = 0; i < 2; i++) {
        const chip = dpChips.nth(i)
        dpNames.push(((await chip.textContent()) ?? '').replaceAll('​', '').replace(/\s+/g, ' ').trim())
        await chip.click()
        await dpPage.waitForTimeout(200)
      }
      /** いま画面に出ている「文字を持つ末端の要素」を全部集める */
      const dpLeaves = () =>
        dpPage.evaluate(() =>
          Array.from(document.querySelectorAll('body *'))
            .filter((el) => el.children.length === 0 && el.getClientRects().length > 0)
            .map((el) => (el.textContent ?? '').replaceAll('​', '').replace(/\s+/g, ' ').trim())
            .filter((t) => t.length > 0),
        )
      const dpBefore = new Set(await dpLeaves())
      const dpDelete = dpPage.getByRole('button', {
        name: ja.pantry.organizeDeleteSelected.replace('{n}', '2'),
        exact: true,
      })
      check('DELMSG-02 準備: まとめて削除のボタンが見つかった', (await dpDelete.count()) > 0)
      await dpDelete.first().click()
      // 確認の窓は installConfirmAutoPress が自動で「削除する」を押す
      await dpPage.waitForTimeout(1500)
      check(
        'DELMSG-02 準備: 削除の確認の窓が出た',
        ((await dpPage.evaluate(() => window.__confirmDialogs ?? [])) ?? []).length > 0,
      )
      const dpAfter = await dpLeaves()
      check(
        'DELMSG-02 選んだ食材が在庫から消えている',
        dpNames.every((n) => !dpAfter.includes(n)),
        `選んだ=${dpNames.join('・')}`,
      )
      // 押す前に画面に無かった文字のうち、消した数を告げているものがあるか。
      // 数は「自分で選んだ2件」から出す＝件数の決め打ちにしない
      const dpAdded = dpAfter.filter((t) => !dpBefore.has(t))
      check(
        'DELMSG-02 消したあと、消えたことを件数つきで告げる文字が画面に出る',
        dpAdded.some((t) => hasCount(t, dpNames.length)),
        `押す前に無かった文字=${dpAdded.join(' / ').slice(0, 200)}`,
      )
      await dpCtx.close()

      // ③ 空のときの導線の大きさ（2026-08-18 便HS・軸8）。
      // 並行調理ナビの空状態だけが下線リンク（20px）で、他の空状態の導線（ボタン）より
      // 小さかった。台所で押す画面なので、押せる高さが44pxを下回らないことを見張る
      currentCheck = 'EMPTYNAV-01'
      const dnCtx = await dmBrowser.newContext()
      const dnPage = await dnCtx.newPage()
      dnPage.on('pageerror', (err) => errors.push(`[pageerror@EMPTYNAV-01] ${err.message}`))
      await dnPage.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
      await dnPage.waitForTimeout(2200)
      // 並行調理ナビはProの機能なので、まず無料のお試しで中へ入る（残り回数は文言に入るので前方一致で探す）
      const dnTrial = dnPage.getByRole('button', {
        name: new RegExp(`^${ja.cookNavi.trialButton.replace(/（あと\{n\}回）/, '')}`),
      })
      check('EMPTYNAV-01 準備: 並行調理ナビのお試しの入口が見つかった', (await dnTrial.count()) > 0)
      if (await dnTrial.count()) {
        await dnTrial.first().click()
        await dnPage.waitForTimeout(1500)
      }
      const dnEmpty = dnPage.locator('[data-testid="navi-empty-today"]')
      check('EMPTYNAV-01 準備: 今日の献立が空のときの案内が出ている', (await dnEmpty.count()) > 0)
      const dnBox = await dnPage
        .getByRole('link', { name: ja.cookNavi.goToday, exact: true })
        .first()
        .boundingBox()
      check(
        'EMPTYNAV-01 空のときの導線は、押せる高さが44px以上',
        !!dnBox && dnBox.height >= 44,
        JSON.stringify(dnBox),
      )
      await dnCtx.close()
    } finally {
      await dmBrowser.close()
    }
  }


  // --- HV-01: 月タブの整理（2026-08-19 便HV・オーナー書き溜め⑥⑧⑨⑪）。
  //
  //  ⑥ カレンダーのマスに出す栄養を選べる（既定はエネルギーのまま）。
  //     測るのは「選んだ栄養がマスの数値に出ること」と「無料のままでは8項目が見えないこと」。
  //  ⑧⑨ 食費・栄養が過去と未来で2つに割れていないこと（見出しの文字合わせではなく、
  //     **数値が1つにまとまっているか**で測る＝のべ食数が記録ぶん＋予定ぶんの合計になっているか）。
  //  ⑪ ボタン名が「献立をまとめて提案」になっていること。
  //
  // 日付の置き方: 記録も献立も**今日**に置く。今日は必ず表示中の月に入るので、
  // 月初でも月末でも同じように動く（曜日・月替わりの前提を作らない）。
  // 数を読み取れなかったときは必ず不合格にする（読めないまま合格にしない）。 ---
  currentCheck = 'HV-01'
  {
    const hvBrowser = await chromium.launch()
    try {
      const hvNow = new Date()
      const hvToday = `${hvNow.getFullYear()}-${String(hvNow.getMonth() + 1).padStart(2, '0')}-${String(hvNow.getDate()).padStart(2, '0')}`
      const hvLabels = NUTRITION_DISPLAY_KEYS.map((key) => nutritionLabelFor(key))
      /** マスの読み上げ(aria-label)から数値と単位を読む。読めなければ null（＝不合格にする） */
      const readNutrientCell = async (targetPage, date) => {
        const aria = (
          (await targetPage.locator(`button[data-date="${date}"]`).getAttribute('aria-label')) ?? ''
        ).replaceAll('​', '')
        const m = aria.match(/^\d+日\s+([\d,.]+)\s*(kcal|mg|g)(?=\s|$)/)
        return m ? { value: Number(m[1].replaceAll(',', '')), unit: m[2], aria } : null
      }

      // ===== (1) Pro解錠した月タブ: 栄養の項目を選べる =====
      const hvContext = await hvBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const hvPage = await hvContext.newPage()
      hvPage.on('pageerror', (err) => errors.push(`[pageerror@HV-01] ${err.message}`))
      await hvPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await hvPage.waitForTimeout(2200) // 初回シード待ち
      // 今日に「作った記録1件(3人分)」と「別の料理の献立1枠」を置く。
      // 別の料理にするのは、今日の同じ料理は記録側で数えて予定から落とす規則があるため。
      const hvSeed = await hvPage.evaluate(async (today) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result)
          req.onerror = () => rej(req.error)
        })
        const P = (r) =>
          new Promise((res, rej) => {
            r.onsuccess = () => res(r.result)
            r.onerror = () => rej(r.error)
          })
        const settings =
          (await P(idb.transaction('settings', 'readonly').objectStore('settings').get(1))) || { id: 1 }
        await P(
          idb
            .transaction('settings', 'readwrite')
            .objectStore('settings')
            .put({
              ...settings,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
              monthCellMode: 'nutrition',
              monthCellNutrient: undefined,
            }),
        )
        const all = await P(idb.transaction('recipes', 'readonly').objectStore('recipes').getAll())
        const usable = all.filter((r) => (r.ingredients?.length ?? 0) > 3)
        const cookedRecipe = usable[0]
        const plannedRecipe = usable[1]
        // 献立は空にしてから1枠だけ置く（この月で数字が出る日を今日だけにする）
        await P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').clear())
        await P(
          idb
            .transaction('mealPlans', 'readwrite')
            .objectStore('mealPlans')
            .add({ date: today, slot: 'dinner', recipeId: plannedRecipe.id, role: 'main' }),
        )
        const rstore = idb.transaction('recipes', 'readwrite').objectStore('recipes')
        const target = await P(rstore.get(cookedRecipe.id))
        target.cookedLogs = [{ date: today, servings: 3 }]
        await P(rstore.put(target))
        idb.close()
        return { cookedServings: 3, plannedServings: plannedRecipe.servings }
      }, hvToday)

      await hvPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await hvPage.reload({ waitUntil: 'networkidle' })
      await hvPage.waitForTimeout(2000)
      await hvPage.getByRole('button', { name: '月', exact: true }).first().click()
      await hvPage.waitForTimeout(1200)

      const hvSelect = hvPage.locator('[data-testid="month-cell-nutrient"]')
      // 選択欄が無いときも、この節の残りを最後まで見るために「無かった」を記録して進む
      // （途中で例外を投げると、⑧⑨⑪の結果がひとつも分からなくなる）
      const hvHasSelect = (await hvSelect.count()) === 1
      check('HV-01(⑥) 栄養モードに「カレンダーに出す栄養」の選択欄が出る', hvHasSelect)
      const hvOptions = hvHasSelect
        ? (await hvSelect.locator('option').allTextContents()).map((t) => t.replaceAll('​', '').trim())
        : []
      check(
        'HV-01(⑥) 選べる顔ぶれは栄養価の表示と同じ8項目・同じ順・同じ名前',
        JSON.stringify(hvOptions) === JSON.stringify(hvLabels),
        `画面=${hvOptions.join('/') || '(選択欄が無い)'} 期待=${hvLabels.join('/')}`,
      )
      const hvDefaultNutrient = hvHasSelect ? await hvSelect.inputValue() : null
      check(
        'HV-01(⑥) 既定は今までどおりエネルギー',
        hvDefaultNutrient === 'kcal',
        `value=${hvDefaultNutrient ?? '(選択欄が無い)'}`,
      )
      // 押せる大きさ（料理中に触る画面なので、プルダウンも指で押せる高さを保つ）
      const hvSelectBox = hvHasSelect ? await hvSelect.boundingBox() : null
      check(
        'HV-01(⑥) 栄養の選択欄は指で押せる高さ(44px以上)',
        !!hvSelectBox && hvSelectBox.height >= 44,
        JSON.stringify(hvSelectBox),
      )

      // 既定(エネルギー)の値が、今日のマスと月の栄養カードで一致する
      const hvKcalCell = await readNutrientCell(hvPage, hvToday)
      check(
        'HV-01(⑥) 既定では今日のマスにエネルギー(kcal)の数値が出る',
        !!hvKcalCell && hvKcalCell.unit === 'kcal' && hvKcalCell.value > 0,
        `読み上げ=${hvKcalCell?.aria ?? '(読めなかった)'}`,
      )
      const hvFoldedNutrition = hvPage.locator('[data-testid="month-nutrition-folded"]')
      const hvFoldedKcalText = (await hvFoldedNutrition.count())
        ? ((await hvFoldedNutrition.innerText()) ?? '').replaceAll('​', '')
        : ''
      const hvFoldedKcal = Number(
        (hvFoldedKcalText.match(/([\d,]+)\s*kcal/)?.[1] ?? '').replaceAll(',', ''),
      )
      check(
        'HV-01(⑥) マスのエネルギーは、この月の合計(数字が出る日は今日だけ)と同じ値',
        Number.isFinite(hvFoldedKcal) && hvFoldedKcal > 0 && hvKcalCell?.value === hvFoldedKcal,
        `マス=${hvKcalCell?.value ?? '(読めなかった)'} 月の合計=${hvFoldedKcal}`,
      )

      // 別の栄養を選ぶと、マスの数値と単位がその栄養のものに変わる
      if (hvHasSelect) {
        await hvSelect.selectOption('proteinG')
        await hvPage.waitForTimeout(700)
      }
      const hvProteinCell = hvHasSelect ? await readNutrientCell(hvPage, hvToday) : null
      await hvPage.getByRole('button', { name: jaRe(ja.mealPlan.monthNutritionTitle, { m: '' }) }).click()
      await hvPage.waitForTimeout(500)
      const hvPanelText = (await hvPage.locator('[data-testid="month-nutrition-panel"]').count())
        ? ((await hvPage.locator('[data-testid="month-nutrition-panel"]').innerText()) ?? '').replaceAll('​', '')
        : ''
      const hvPanelProtein = Number(
        (hvPanelText.match(
          new RegExp(`${nutritionLabelFor('proteinG')}\\s*([\\d,.]+)\\s*g`),
        )?.[1] ?? '').replaceAll(',', ''),
      )
      check(
        'HV-01(⑥) 選んだ栄養(たんぱく質)がマスの数値に出る（単位も項目に合わせて変わる）',
        !!hvProteinCell &&
          hvProteinCell.unit === 'g' &&
          Number.isFinite(hvPanelProtein) &&
          hvPanelProtein > 0 &&
          hvProteinCell.value === hvPanelProtein,
        `マス=${hvProteinCell?.value ?? '(読めなかった)'}${hvProteinCell?.unit ?? ''} 月の合計=${hvPanelProtein}g`,
      )
      check(
        'HV-01(⑥) 選んだ栄養は、たんぱく質とエネルギーで別の数値になる(選び直しが効いている)',
        !!hvProteinCell && !!hvKcalCell && hvProteinCell.value !== hvKcalCell.value,
        `たんぱく質=${hvProteinCell?.value} エネルギー=${hvKcalCell?.value}`,
      )
      // 説明も選んだ栄養の名前で出る（⑩で短くしても「何の数字か」は言い続ける）
      check(
        'HV-01(⑥⑩) 説明が選んだ栄養の名前で出て、数え方の長い説明は付いていない',
        await (async () => {
          const body = ((await hvPage.textContent('body')) ?? '').replaceAll('​', '')
          return (
            body.includes('その日に1人が食べる分のたんぱく質（g）の概算です') &&
            !body.includes('今日は作った分は記録・まだの分は献立で計算しています')
          )
        })(),
      )

      // 選んだ項目は設定に残る（毎回選び直させない。カレンダーの表示の切り替えと同じ扱い）
      await hvPage.reload({ waitUntil: 'networkidle' })
      await hvPage.waitForTimeout(1800)
      await hvPage.getByRole('button', { name: '月', exact: true }).first().click()
      await hvPage.waitForTimeout(1000)
      check(
        'HV-01(⑥) 選んだ栄養は再読み込みしても残る',
        (await hvPage.locator('[data-testid="month-cell-nutrient"]').count()) === 1 &&
          (await hvPage.locator('[data-testid="month-cell-nutrient"]').inputValue()) === 'proteinG',
      )

      // ===== (2) ⑧⑨ 食費・栄養が過去と未来で割れていない =====
      // 読み込み直した直後のカードは畳まれている（開閉は覚えない・便EN）ので、まず畳んだ側を見る
      const hvFoldedNutritionText = (await hvPage
        .locator('[data-testid="month-nutrition-folded"]')
        .count())
        ? ((await hvPage.locator('[data-testid="month-nutrition-folded"]').innerText()) ?? '').replaceAll('​', '')
        : ''
      check(
        // 2026-08-20 便IG・⑬: 数値は見出しの横に1つだけ出る(項目名「エネルギー」は開いた
        // ときのパネルに任せた＝390px幅で見出しが折り返して縦長になるのを避けるため)。
        // ここで見たいのは「畳んだ側にエネルギーの合計が1つだけ読める」ことなので、単位で測る
        'HV-01(⑨) 畳んだ栄養カードに出るのはエネルギーの合計だけ',
        (await hvPage.locator('[data-testid="month-nutrition-folded"]').count()) === 1 &&
          /^[\d,]+\s*kcal$/.test(hvFoldedNutritionText.trim()),
        `畳んだ栄養=${hvFoldedNutritionText.replace(/\n/g, ' / ') || '(出ていない)'}`,
      )
      await hvPage.getByRole('button', { name: jaRe(ja.mealPlan.monthNutritionTitle, { m: '' }) }).click()
      await hvPage.waitForTimeout(400)
      check(
        'HV-01(⑨) 栄養カードを開いているあいだ、畳んだ側の数値は出さない(同じ数字を二度出さない)',
        (await hvPage.locator('[data-testid="month-nutrition-folded"]').count()) === 0,
      )
      // 畳み直してから、この先の食費カードの検査へ進む
      await hvPage.getByRole('button', { name: jaRe(ja.mealPlan.monthNutritionTitle, { m: '' }) }).click()
      await hvPage.waitForTimeout(400)
      const hvFoldedCost = hvPage.locator('[data-testid="month-cost-folded"]')
      const hvFoldedCostText = (await hvFoldedCost.count())
        ? ((await hvFoldedCost.innerText()) ?? '').replaceAll('​', '')
        : ''
      const hvFoldedCostYen = Number(
        (hvFoldedCostText.match(/約([\d,]+)円/)?.[1] ?? '').replaceAll(',', ''),
      )
      check(
        // 2026-08-20 便IG・⑬: 金額は見出しの横に1つだけ(行の名前「全員分」は開いたときの表に任せた)
        'HV-01(⑨) 畳んだ食費カードに出るのは食費の合計だけ',
        (await hvFoldedCost.count()) === 1 &&
          /^約[\d,]+円$/.test(hvFoldedCostText.trim()) &&
          Number.isFinite(hvFoldedCostYen) &&
          hvFoldedCostYen > 0,
        `畳んだ食費=${hvFoldedCostText.replace(/\n/g, ' / ')}`,
      )
      await hvPage.getByRole('button', { name: jaRe(ja.mealPlan.monthCostTitle, { m: '' }) }).click()
      await hvPage.waitForTimeout(500)
      const hvCostTableText = (await hvPage.locator('[data-testid="month-cost-table"]').count())
        ? ((await hvPage.locator('[data-testid="month-cost-table"]').innerText()) ?? '').replaceAll('​', '')
        : ''
      check(
        // 「割れていない」は表の作りで測る: 予定用の下段は別のtbodyだったので、tbodyが1つなら割れていない
        'HV-01(⑧⑨) 食費の表は過去と未来に分かれていない(行が1組・予定用の下段が無い)',
        (await hvPage.locator('[data-testid="month-cost-table"] tbody').count()) === 1 &&
          !hvCostTableText.includes('これから作る予定') &&
          (hvCostTableText.match(/1人分/g) ?? []).length === 1,
        `表=${hvCostTableText.replace(/\n/g, ' / ')}`,
      )
      // 数値が1つにまとまっているか＝のべ食数が「作った記録ぶん＋これから作るぶん」になっているか。
      // 片方しか数えていなければ、この数は必ず小さくなる
      const hvMealsShown = Number(
        (hvCostTableText.match(/のべ\s*([\d,]+)\s*食/)?.[1] ?? '').replaceAll(',', ''),
      )
      check(
        'HV-01(⑧⑨) 「全員分」ののべ食数が、作った記録ぶんと作る予定ぶんを足した数になっている',
        Number.isFinite(hvMealsShown) &&
          hvMealsShown === hvSeed.cookedServings + hvSeed.plannedServings,
        `画面=${hvMealsShown} 期待=${hvSeed.cookedServings}+${hvSeed.plannedServings}=${hvSeed.cookedServings + hvSeed.plannedServings}`,
      )
      const hvTableYen = Number(
        (hvCostTableText.match(/全員分[\s\S]{0,20}?約([\d,]+)円/)?.[1] ?? '').replaceAll(',', ''),
      )
      check(
        'HV-01(⑨) 畳んだときの金額は、開いたときの表の「全員分」と同じ値',
        Number.isFinite(hvTableYen) && hvTableYen > 0 && hvTableYen === hvFoldedCostYen,
        `畳んだ=${hvFoldedCostYen} 表=${hvTableYen}`,
      )

      // ===== (3) ⑪ ボタン名 =====
      check(
        'HV-01(⑪) 月タブのボタン名が「献立をまとめて提案」になっている',
        (await hvPage.getByRole('button', { name: ja.mealPlan.fillMonth, exact: true }).count()) === 1,
      )
      check(
        // 2026-08-26 便LH: 説明の1行は折りたたみの中へ入った（オーナー原文「献立関連のボタンが
        // バラバラに配置してあるように見えるので、１グループにまとめて。折りたたみの
        // 見える部分は「献立をまとめて提案」のみ。」）。開いてから読む
        'HV-01(⑪→便LH) どこに入るかの説明は、節を開けばボタンのそばに出る',
        await (async () => {
          await hvPage.locator('[data-testid="month-plan-group-toggle"]').click()
          await hvPage.waitForTimeout(400)
          return ((await hvPage.textContent('body')) ?? '')
            .replaceAll('​', '')
            .includes(ja.mealPlan.fillMonthHint)
        })(),
      )
      await hvContext.close()

      // ===== (4) ⑥の線引き: 無料のままでは栄養8項目が見えない =====
      const hvFreeContext = await hvBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const hvFreePage = await hvFreeContext.newPage()
      hvFreePage.on('pageerror', (err) => errors.push(`[pageerror@HV-01free] ${err.message}`))
      await hvFreePage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await hvFreePage.waitForTimeout(2200)
      await hvFreePage.getByRole('button', { name: '月', exact: true }).first().click()
      await hvFreePage.waitForTimeout(1000)
      const hvFreeBody = ((await hvFreePage.textContent('body')) ?? '').replaceAll('​', '')
      check(
        'HV-01(⑥) 準備: 無料のままだと月の画面は鍵の案内になっている',
        hvFreeBody.includes(ja.mealPlan.monthLockedTitle),
        `本文=${hvFreeBody.slice(0, 160)}`,
      )
      const hvProOnlyNutrients = NUTRITION_DISPLAY_KEYS.filter((key) => key !== 'kcal').map((key) =>
        nutritionLabelFor(key),
      )
      check(
        'HV-01(⑥) 無料のままでは、カレンダーの栄養の選択欄もPro側の栄養の名前も出ない',
        (await hvFreePage.locator('[data-testid="month-cell-nutrient"]').count()) === 0 &&
          // 2026-08-28 便LX: 見る名前が1つも無いと every は中身を見ずに true になり、
          // **Proの線が壊れても必ず緑**になる（PURPOSE-02 と同じ形）。
          // 名前の数の下限を同じ判定式で見る（決め打ちはしない＝禁じ手③）
          hvProOnlyNutrients.length > 0 &&
          hvProOnlyNutrients.every((label) => !hvFreeBody.includes(label)),
        `出ていた項目=${hvProOnlyNutrients.filter((label) => hvFreeBody.includes(label)).join('/') || 'なし'}`,
      )
      await hvFreeContext.close()
    } finally {
      await hvBrowser.close()
    }
  }

  // --- WEEKCOND-01(2026-08-19 便ID・①②③④。オーナーの書き溜め)。
  //
  // 測るのは4つ:
  //   ① 週タブ「献立を提案」の並びが 入れかた → 現在の条件 の順
  //   ② 入れかたの2つのボタンが横一列（同じ高さ・違う横位置）に並ぶ
  //   ③ 条件を1つも選んでいないときのボタンの字が「現在の条件: 指定なし」
  //   ④ 押すと**窓**が開き、窓の中で条件を次々変えても後ろの画面が1pxも動かない
  //      （閉じても開く前と同じ場所に戻る・端末の「戻る」で窓だけ閉じる）
  //
  // 禁じ手よけ（便IAの DAYCOND-01 と同じ）:
  //  ・位置は**ページの中での位置**で測る（窓が後ろの画面を止めるぶんを「動いた」と誤検出しない）
  //  ・掴み方は data-testid と読み上げ名だけ（クラス名・入れ子の段数・「何番目」に依らない）
  //  ・押す回数を決め打ちしない（並んでいるものを順に触り、触れたものだけ数える）
  //  ・位置を読めなかったときは合格に倒さず不合格にする ---
  currentCheck = 'WEEKCOND-01'
  {
    const wcBrowser = await chromium.launch()
    const wcContext = await wcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wcPage = await wcContext.newPage()
    wcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@WEEKCOND-01] ${text}`)
    })
    wcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKCOND-01] ${err.message}`)
    })
    /** ページの先頭からの位置。窓が後ろの画面を止めているあいだも同じ値になる */
    const wcDocPos = async (loc) => {
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
    const wcStrip = (s) => (s ?? '').replace(/​/g, '')
    try {
      await wcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wcPage.waitForTimeout(2400) // 初回シード完了待ち
      await wcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wcPage.waitForTimeout(1500)
      await wcPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await wcPage.waitForTimeout(800)
      // 「献立を提案」グループは 2026-08-19 便IF・⑤⑥ で既定が「開く」に戻った。
      // 畳んでいるときだけ開く＝既定がどちらでも、この先は「開いた状態」から測れる
      await openWeekGroup(wcPage, ja.mealPlan.weekGroupAutoTitle)
      check(
        'WEEKCOND-01 前提: 「献立を提案」のグループが開いている',
        (await wcPage
          .getByRole('button', {
            name: ja.mealPlan.weekGroupToggleCloseAria.replace(
              '{group}',
              ja.mealPlan.weekGroupAutoTitle,
            ),
          })
          .count()) === 1,
      )

      const wcConditions = wcPage.locator('[data-testid="plan-conditions-open"]')
      // 2026-08-20 便II・④: 入れかたは2つのチップからプルダウン1つになった
      const wcFillMode = wcPage.locator('[data-testid="fill-mode"]')
      check('WEEKCOND-01 前提: 「現在の条件」のボタンが1つ出ている', (await wcConditions.count()) === 1)
      check('WEEKCOND-01 前提: 入れかたのプルダウンが1つ出ている', (await wcFillMode.count()) === 1)

      // ③ 何も選んでいないときの見え方
      // 2026-08-27 便LT: 名前は太字の小見出しへ出し、押すところにはいま効いている条件だけを残した
      // （オーナー原文「ここで設定できることに気づけない」）。読む順は今までと同じ「名前→値」なので、
      // 名前は小見出しで、値は押すところで、つないだ形は読み上げ名で見る
      const wcCondLabelText = await wcConditions.evaluate(
        (el) => el.previousElementSibling?.textContent ?? '',
      )
      check(
        'WEEKCOND-01(③・便LT) 条件の名前は、押すところの外に小見出しとして出ている',
        wcStrip(wcCondLabelText) === ja.mealPlan.suggestConditionsToggle,
        `小見出し=${wcStrip(wcCondLabelText)}`,
      )
      check(
        'WEEKCOND-01(③) 条件を選んでいないときは、押すところに「指定なし」と出る',
        wcStrip(await wcConditions.textContent()) === ja.mealPlan.suggestConditionsNone,
        `字=${wcStrip(await wcConditions.textContent())}`,
      )
      check(
        'WEEKCOND-01(③・便LT) 読み上げ名は名前と値をつないで持つ（値だけのボタンにしない）',
        wcStrip((await wcConditions.getAttribute('aria-label')) ?? '') ===
          `${ja.mealPlan.suggestConditionsToggle}: ${ja.mealPlan.suggestConditionsNone}`,
        `読み上げ名=${await wcConditions.getAttribute('aria-label')}`,
      )
      // 「入れかた」と同じ形（横いっぱい・44px）になっていること＝存在感の直しそのもの
      {
        const wcCondBox = await wcConditions.boundingBox()
        const wcFillBox = await wcPage.locator('[data-testid="fill-mode"]').boundingBox()
        check(
          'WEEKCOND-01(便LT) 条件を押すところは、すぐ上の「入れかた」と同じ幅・同じ高さ',
          wcCondBox != null &&
            wcFillBox != null &&
            Math.abs(wcCondBox.width - wcFillBox.width) <= 1 &&
            wcCondBox.height >= 44,
          `条件=${JSON.stringify(wcCondBox)} 入れかた=${JSON.stringify(wcFillBox)}`,
        )
      }

      // ① 並び順（入れかたが先・現在の条件が後）
      const wcFillTitlePos = await wcDocPos(
        wcPage.getByText(ja.mealPlan.fillModeTitle, { exact: true }),
      )
      const wcCondPos = await wcDocPos(wcConditions)
      check(
        'WEEKCOND-01 前提: 入れかたの見出しと現在の条件の位置を読めた',
        wcFillTitlePos != null && wcCondPos != null,
        `入れかた=${JSON.stringify(wcFillTitlePos)} 条件=${JSON.stringify(wcCondPos)}`,
      )
      check(
        'WEEKCOND-01(①) 並び順は 入れかた → 現在の条件',
        wcFillTitlePos != null && wcCondPos != null && wcFillTitlePos.y < wcCondPos.y,
        `入れかた=${JSON.stringify(wcFillTitlePos)} 条件=${JSON.stringify(wcCondPos)}`,
      )

      // ② 2択が1行に収まっている（2026-08-20 便II・④でプルダウンになった＝
      //    2つのボタンが2段に割れる心配そのものが無くなり、選択肢は閉じた1行の中に入る）
      const wcFillOptions = await wcFillMode.locator('option').evaluateAll((els) =>
        els.map((el) => el.value),
      )
      check(
        'WEEKCOND-01(②) 入れかたはプルダウン1つで、選択肢は「空いた枠だけ」と「総入れ替え」の2つ',
        JSON.stringify(wcFillOptions) === JSON.stringify(['fillEmpty', 'replaceAll']),
        `選択肢=${JSON.stringify(wcFillOptions)}`,
      )

      // ④ 窓で開く・後ろが動かない
      const wcWatch = {
        入れかたのプルダウン: wcFillMode,
        まとめて献立を入力: wcPage.getByRole('button', { name: ja.mealPlan.fillWeek }),
        いちばん上の曜日カード: wcPage.locator('[data-testid="week-day-toggle"]'),
      }
      const wcSnap = async () => {
        const out = {}
        for (const [label, loc] of Object.entries(wcWatch)) out[label] = await wcDocPos(loc)
        return out
      }
      const wcBefore = await wcSnap()
      check(
        'WEEKCOND-01 前提: 後ろの画面の位置を読めた（読めなければ見張りが壊れている）',
        Object.values(wcBefore).every((v) => v != null),
        JSON.stringify(wcBefore),
      )
      await wcConditions.click()
      await wcPage.waitForTimeout(800)
      const wcModal = wcPage.locator('[data-testid="plan-conditions-modal"]')
      check(
        'WEEKCOND-01(④) 「現在の条件」を押すと窓が開く（折りたたみではない）',
        (await wcModal.count()) === 1,
      )

      const wcMoved = []
      const wcSame = (a, b) =>
        a != null && b != null && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) < 0.5
      const wcCompare = async (when) => {
        const now = await wcSnap()
        for (const label of Object.keys(wcWatch)) {
          if (!wcSame(wcBefore[label], now[label])) {
            wcMoved.push(`${when}: ${label} ${JSON.stringify(wcBefore[label])}→${JSON.stringify(now[label])}`)
          }
        }
      }
      await wcCompare('窓を開いた直後')

      // 窓の中も動かないこと（オーナーの不満は「下にスペースが伸びる」なので、
      // 窓の中で同じことが起きても同じ不満になる）。窓は真ん中に出るので上端と下端の両方を見る
      const wcScope = (await wcModal.count()) === 1 ? wcModal : wcPage
      const wcInside = {
        窓の見出し: wcPage.getByRole('heading', { name: ja.mealPlan.suggestConditionsTitle }),
        'ジャンルの並び': wcPage.locator('[data-testid="plan-genre"]'),
        '窓の「閉じる」': wcPage.locator('[data-testid="plan-conditions-close"]'),
      }
      const wcInsideSnap = async () => {
        const out = {}
        for (const [label, loc] of Object.entries(wcInside)) out[label] = await wcDocPos(loc)
        return out
      }
      const wcInsideBefore = await wcInsideSnap()
      check(
        'WEEKCOND-01 前提: 窓の中の位置を読めた',
        (await wcModal.count()) !== 1 || Object.values(wcInsideBefore).every((v) => v != null),
        JSON.stringify(wcInsideBefore),
      )
      const wcInsideMoved = []
      const wcCompareInside = async (when) => {
        if ((await wcModal.count()) !== 1) return
        const now = await wcInsideSnap()
        for (const label of Object.keys(wcInside)) {
          if (!wcSame(wcInsideBefore[label], now[label])) {
            wcInsideMoved.push(
              `${when}: ${label} ${JSON.stringify(wcInsideBefore[label])}→${JSON.stringify(now[label])}`,
            )
          }
        }
      }

      // 窓の中の条件を順に触る（触れたものだけ数える＝押す回数を決め打ちしない）
      const wcTouched = []
      const wcMinutes = wcScope.locator('[data-testid="plan-quick-minutes"]')
      if ((await wcMinutes.count()) > 0) {
        const wcMinuteValues = await wcMinutes.locator('option').evaluateAll((els) =>
          els.map((el) => el.value),
        )
        for (const value of wcMinuteValues) {
          await wcMinutes.selectOption(value)
          await wcPage.waitForTimeout(400)
          const label = value === '' ? '調理時間=指定なし' : `調理時間=${value}分`
          wcTouched.push(label)
          await wcCompare(`${label}にした後`)
          await wcCompareInside(`${label}にした後`)
        }
      }
      // ジャンルは2026-08-22 便IYで複数選べる並びになった。並んでいるものを1つずつ押して、
      // 押すたびに後ろの画面も窓の中も動かないことを見る（押す回数は並びの数から取る＝決め打ちしない）
      const wcGenreChips = wcScope.locator('[data-testid="plan-genre-chip"]')
      const wcGenreNames = await wcGenreChips.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-genre')),
      )
      for (const name of wcGenreNames) {
        const chip = wcPage.locator(`[data-testid="plan-genre-chip"][data-genre="${name}"]`)
        if ((await chip.count()) === 0) continue
        await chip.click()
        await wcPage.waitForTimeout(400)
        wcTouched.push(`ジャンル=${name}`)
        await wcCompare(`ジャンルの${name}を押した後`)
        await wcCompareInside(`ジャンルの${name}を押した後`)
      }
      check(
        'WEEKCOND-01 前提: 窓の中の条件を2つ以上触れた（触れていなければ測れていない）',
        wcTouched.length >= 2,
        `触れた=${JSON.stringify(wcTouched)}`,
      )
      check(
        'WEEKCOND-01(④) 窓の中で条件を次々変えても、後ろの画面は1pxも動かない',
        wcMoved.length === 0,
        wcMoved.join(' / '),
      )
      check(
        'WEEKCOND-01(④) 窓の中の並びも動かない（選択肢や説明が出たり消えたりして中身がずれない）',
        wcInsideMoved.length === 0,
        wcInsideMoved.join(' / '),
      )

      const wcClose = wcPage.locator('[data-testid="plan-conditions-close"]')
      if ((await wcClose.count()) === 1) {
        await wcClose.click()
        await wcPage.waitForTimeout(800)
        const wcAfter = await wcSnap()
        const wcDiff = Object.keys(wcWatch)
          .filter((label) => !wcSame(wcBefore[label], wcAfter[label]))
          .map((label) => `${label} ${JSON.stringify(wcBefore[label])}→${JSON.stringify(wcAfter[label])}`)
        check('WEEKCOND-01(④) 窓を閉じても、開く前と同じ場所に戻っている', wcDiff.length === 0, wcDiff.join(' / '))
      }
      // 閉じたあと、選んだ条件がボタンの字に出ている（③の「現在の条件」の意味）
      check(
        'WEEKCOND-01(③) 選んだあとのボタンには、いま効いている条件が並ぶ',
        wcStrip(await wcConditions.textContent()) !== ja.mealPlan.suggestConditionsNone,
        `字=${wcStrip(await wcConditions.textContent())}`,
      )

      // 端末の「戻る」で、この窓だけが閉じる（アプリ共通の窓の作法に乗っていること）
      if ((await wcModal.count()) === 0) {
        await wcConditions.click()
        await wcPage.waitForTimeout(700)
        check('WEEKCOND-01 前提: 窓をもう一度開けた', (await wcModal.count()) === 1)
        await wcPage.goBack()
        await wcPage.waitForTimeout(900)
        check(
          'WEEKCOND-01(④) 端末の「戻る」で窓だけが閉じる（献立の画面から離脱しない）',
          (await wcModal.count()) === 0 && wcPage.url().includes('#/meal-plan'),
          `窓=${await wcModal.count()} URL=${wcPage.url()}`,
        )
      }
    } finally {
      await wcBrowser.close()
    }
  }

  // --- WEEKCOND-02(2026-08-19 便ID・④の月タブ側 ＋ ⑤)。
  // 条件の部品は週と月が共有している(renderSuggestConditions)ので、**月でも同じ窓が開き、
  // 月の画面が動かない**ことを見る。あわせて⑤「多め/ひかえめ」の両立を見る:
  //   ・プルダウンの中は区分(多め/ひかえめ)＋項目名だけ（「たんぱく質多め」とは書かない）
  //   ・選んだあと、条件のボタンには「たんぱく質多め」と組み立てて出る
  // 月タブと「栄養から組む」はPro機能なので、この節だけ解錠して見る ---
  currentCheck = 'WEEKCOND-02'
  {
    const wmBrowser = await chromium.launch()
    const wmContext = await wmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wmPage = await wmContext.newPage()
    wmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKCOND-02] ${err.message}`)
    })
    const wmDocPos = async (loc) => {
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
    const wmStrip = (s) => (s ?? '').replace(/​/g, '')
    try {
      await wmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wmPage.waitForTimeout(2400)
      await wmPage.evaluate(async () => {
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
      await wmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wmPage.reload({ waitUntil: 'networkidle' })
      await wmPage.waitForTimeout(1800)
      await wmPage.getByRole('button', { name: '月', exact: true }).first().click()
      await wmPage.waitForTimeout(1200)
      // 2026-08-26 便LH: 月タブの献立まわりは「献立の入れかた」の折りたたみに入り、
      // 畳んだときに見えるのは「献立をまとめて提案」だけになった（オーナー指示）。
      // 開かずに掴むと30秒待って**フルe2eごと実行中断**する
      await openMonthPlanGroup(wmPage)

      const wmConditions = wmPage.locator('[data-testid="plan-conditions-open"]')
      check(
        'WEEKCOND-02 前提: 月タブにも「現在の条件」のボタンが出ている（週と同じ部品）',
        (await wmConditions.count()) === 1,
      )
      const wmWatch = {
        献立をまとめて提案: wmPage.getByRole('button', { name: ja.mealPlan.fillMonth, exact: true }),
        '「作った記録」への入口': wmPage.getByRole('link', { name: new RegExp(ja.mealPlan.historyLink) }),
      }
      const wmSnap = async () => {
        const out = {}
        for (const [label, loc] of Object.entries(wmWatch)) out[label] = await wmDocPos(loc)
        return out
      }
      const wmBefore = await wmSnap()
      check(
        'WEEKCOND-02 前提: 月タブの位置を読めた（読めなければ見張りが壊れている）',
        Object.values(wmBefore).every((v) => v != null),
        JSON.stringify(wmBefore),
      )
      await wmConditions.click()
      await wmPage.waitForTimeout(800)
      const wmModal = wmPage.locator('[data-testid="plan-conditions-modal"]')
      check('WEEKCOND-02(④) 月タブでも押すと窓が開く', (await wmModal.count()) === 1)

      const wmSame = (a, b) =>
        a != null && b != null && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.x - b.x) < 0.5
      const wmMoved = []
      const wmCompare = async (when) => {
        const now = await wmSnap()
        for (const label of Object.keys(wmWatch)) {
          if (!wmSame(wmBefore[label], now[label])) {
            wmMoved.push(`${when}: ${label} ${JSON.stringify(wmBefore[label])}→${JSON.stringify(now[label])}`)
          }
        }
      }
      await wmCompare('窓を開いた直後')

      // ⑤ 「栄養から組む」のプルダウン: 区分＋項目名だけで、「多め/ひかえめ」を項目にも書かない
      const wmPurpose = wmPage.locator('[data-testid="plan-purpose"]')
      check('WEEKCOND-02 前提: 「栄養から組む」のプルダウンがある（Pro解錠済み）', (await wmPurpose.count()) === 1)
      const wmOptions = await wmPurpose.evaluate((el) =>
        [...el.querySelectorAll('optgroup')].map((g) => ({
          group: g.label,
          options: [...g.querySelectorAll('option')].map((o) => ({ value: o.value, label: o.textContent ?? '' })),
        })),
      )
      const wmGroupLabels = wmOptions.map((g) => g.group)
      check(
        'WEEKCOND-02(⑤) プルダウンは「多め」「ひかえめ」で区分されている',
        wmGroupLabels.includes(ja.mealPlan.purposeGroupMore) &&
          wmGroupLabels.includes(ja.mealPlan.purposeGroupLess),
        JSON.stringify(wmGroupLabels),
      )
      const wmAllOptions = wmOptions.flatMap((g) => g.options)
      check(
        'WEEKCOND-02 前提: 選択肢を8つ読めた（読めなければ見張りが壊れている）',
        wmAllOptions.length === 8,
        JSON.stringify(wmAllOptions),
      )
      check(
        `WEEKCOND-02(⑤) 選択肢の名前に「${ja.mealPlan.purposeGroupMore}」「${ja.mealPlan.purposeGroupLess}」を重ねて書かない（区分が言っている）`,
        wmAllOptions.every((o) =>
          [ja.mealPlan.purposeGroupMore, ja.mealPlan.purposeGroupLess].every((g) => !o.label.includes(g)),
        ),
        JSON.stringify(wmAllOptions.map((o) => o.label)),
      )
      check(
        'WEEKCOND-02(⑤) 選択肢の名前は項目名そのもの（たんぱく質・塩分 など）',
        wmAllOptions.every((o) => o.label === ja.mealPlan.purposeOption[o.value]),
        JSON.stringify(wmAllOptions.map((o) => `${o.value}=${o.label}`)),
      )
      // 選んでから閉じると、条件のボタンには区分を足した名前で出る
      await wmPurpose.selectOption('protein')
      await wmPage.waitForTimeout(600)
      await wmCompare('栄養から組むを選んだ後')
      check(
        'WEEKCOND-02(④) 月タブでも、窓の中で条件を変えて後ろの画面が1pxも動かない',
        wmMoved.length === 0,
        wmMoved.join(' / '),
      )
      const wmClose = wmPage.locator('[data-testid="plan-conditions-close"]')
      if ((await wmClose.count()) === 1) {
        await wmClose.click()
        await wmPage.waitForTimeout(800)
      }
      check(
        'WEEKCOND-02(⑤) 条件のボタンには「たんぱく質多め」と組み立てて出る',
        wmStrip(await wmConditions.textContent()).includes(ja.mealPlan.purposeProtein),
        `字=${wmStrip(await wmConditions.textContent())}`,
      )
      const wmAfter = await wmSnap()
      const wmDiff = Object.keys(wmWatch)
        .filter((label) => !wmSame(wmBefore[label], wmAfter[label]))
        .map((label) => `${label} ${JSON.stringify(wmBefore[label])}→${JSON.stringify(wmAfter[label])}`)
      check(
        'WEEKCOND-02(④) 月タブでも、窓を閉じたら開く前と同じ場所に戻っている',
        wmDiff.length === 0,
        wmDiff.join(' / '),
      )
      // 月タブの中身がそのまま出ていること（この節は週と月で共有している部品を触るので、
      // 月の側が欠けたり壊れたりしていないことを同じ節で見る）
      const wmCells = wmPage.locator('button[data-date]')
      check(
        'WEEKCOND-02 月タブの中身は壊れていない（カレンダーの日と実行ボタンがそのまま出ている）',
        (await wmPage.getByRole('button', { name: ja.mealPlan.fillMonth, exact: true }).count()) === 1 &&
          (await wmCells.count()) >= 28,
        `カレンダーの日=${await wmCells.count()}`,
      )
    } finally {
      await wmBrowser.close()
    }
  }

  // --- WEEKFOLD-01(2026-08-19 便ID・⑦。オーナー原文「デフォルト表示は、過去の日付は折りたたみ
  // （入力があれば☑️マーク）、献立が空欄の未来の日付も折りたたみ、献立ありの未来の日付は開いて
  // 表示にしたい。献立ありで折りたたみにした場合はオレンジ色の「・」などで入力があることが
  // わかるようにして」)。
  //
  // 測るのは3つ:
  //   ① 過ぎた日は畳まれている
  //   ② 献立のある未来の日は開いている／空の未来の日は畳まれている
  //   ③ 畳んでいても、入力があることが印で分かる（未来=献立の点／過ぎた日=作った記録の印）
  //
  // 禁じ手よけ:
  //  ・**曜日・月替わりの前提を置かない**。「次の週」は今日が何曜日でも全7日が未来、
  //    「前の週」は全7日が過去になる（MEALPLAN-06と同じ土台）。日付は画面に出ている
  //    週の範囲から読み取る＝こちらで日付を組み立てない
  //  ・掴み方は data-testid と data-date（並び順・入れ子の段数に依らない）
  //  ・仕込みが効いていない状態で「畳まれている」が通ってしまわないよう、
  //    献立を入れた日が実際に開くことと対で見る ---
  currentCheck = 'WEEKFOLD-01'
  {
    const wfBrowser = await chromium.launch()
    const wfContext = await wfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wfPage = await wfContext.newPage()
    wfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKFOLD-01] ${err.message}`)
    })
    try {
      /** 週タブを開き直して、指定の向きへ1回ずつ送る（画面を読み込み直したあとの共通の手順） */
      const wfOpenWeek = async (steps) => {
        // 読み込み直す（同じURLへのgotoだけでは画面が作り直されず、見ている週が残る）。
        // 作り直せば見ている週は必ず「今週」から始まるので、送る回数と着く週が1対1で対応する
        await wfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await wfPage.reload({ waitUntil: 'networkidle' })
        await wfPage.waitForTimeout(1800)
        const tab = wfPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
        if ((await tab.getAttribute('aria-pressed')) !== 'true') {
          await tab.click()
          await wfPage.waitForTimeout(800)
        }
        for (const label of steps) {
          await wfPage.locator(`button[aria-label="${label}"]`).click()
          await wfPage.waitForTimeout(800)
        }
      }
      /** 画面に出ている7日分の日付（data-date）。並び順ではなく属性から読む */
      const wfDates = () =>
        wfPage
          .locator('[data-testid="week-day-toggle"]')
          .evaluateAll((els) => els.map((el) => el.getAttribute('data-date')))
      /** その日のカードが開いているか（掴めなければ null＝合格に倒さない） */
      const wfOpen = async (date) => {
        const loc = wfPage.locator(`[data-testid="week-day-toggle"][data-date="${date}"]`)
        if ((await loc.count()) !== 1) return null
        return (await loc.getAttribute('aria-expanded')) === 'true'
      }
      /** その日の印（無ければ null） */
      const wfMark = async (date) => {
        const loc = wfPage.locator(`[data-testid="week-day-mark"][data-date="${date}"]`)
        if ((await loc.count()) === 0) return null
        return await loc.first().getAttribute('data-mark')
      }
      const wfOpenMap = async (dates) =>
        JSON.stringify(await Promise.all(dates.map(async (d) => `${d}:${await wfOpen(d)}`)))
      /** 献立(mealPlans)を直接入れる。Dexieの自動反映は自分の書き込みしか見ていないので、入れたあとは読み込み直す */
      const wfSeedPlans = (dates) =>
        wfPage.evaluate(
          (targets) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const rtx = idb.transaction('recipes', 'readonly')
                const g = rtx.objectStore('recipes').getAll()
                g.onsuccess = () => {
                  const recipeId = g.result[0]?.id
                  if (!recipeId) {
                    resolve({ ok: false })
                    return
                  }
                  const wtx = idb.transaction('mealPlans', 'readwrite')
                  const store = wtx.objectStore('mealPlans')
                  for (const date of targets) store.add({ date, slot: 'dinner', recipeId, role: 'main' })
                  wtx.oncomplete = () => resolve({ ok: true })
                  wtx.onerror = () => reject(wtx.error)
                }
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          dates,
        )

      await wfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wfPage.waitForTimeout(2400) // 初回シード完了待ち

      // ===== 未来の週（今日が何曜日でも全7日が未来） =====
      await wfOpenWeek(['次の週'])
      const wfNext = await wfDates()
      check(
        'WEEKFOLD-01 前提: 次の週の7日分を読めた',
        wfNext.length === 7 && wfNext.every(Boolean),
        JSON.stringify(wfNext),
      )
      const wfToday = await wfPage.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      check(
        'WEEKFOLD-01 前提: 次の週は全部が今日より後（曜日に左右されない土台）',
        wfNext.length === 7 && wfNext.every((d) => d > wfToday),
        `今日=${wfToday} 週=${JSON.stringify(wfNext)}`,
      )
      check(
        'WEEKFOLD-01(②) 献立を入れる前は、未来の日も全部畳まれている',
        wfNext.length > 0 &&
          (await Promise.all(wfNext.map((d) => wfOpen(d)))).every((v) => v === false),
        await wfOpenMap(wfNext),
      )

      // 7日のうち2日にだけ献立を入れる（夕食＝新しい端末で表示している食事）
      const wfPlanDates = [wfNext[1], wfNext[3]]
      const wfEmptyDates = wfNext.filter((d) => !wfPlanDates.includes(d))
      check('WEEKFOLD-01 前提: 未来の2日に献立を仕込めた', (await wfSeedPlans(wfPlanDates)).ok === true)
      await wfOpenWeek(['次の週'])
      check(
        'WEEKFOLD-01 前提: 読み込み直しても同じ週を見ている',
        JSON.stringify(await wfDates()) === JSON.stringify(wfNext),
        JSON.stringify(await wfDates()),
      )
      check(
        'WEEKFOLD-01(②) 献立のある未来の日は開いている',
        (await Promise.all(wfPlanDates.map((d) => wfOpen(d)))).every((v) => v === true),
        await wfOpenMap(wfPlanDates),
      )
      check(
        'WEEKFOLD-01(②) 献立の無い未来の日は畳まれたまま',
        wfEmptyDates.length > 0 &&
          (await Promise.all(wfEmptyDates.map((d) => wfOpen(d)))).every((v) => v === false),
        await wfOpenMap(wfEmptyDates),
      )
      check(
        'WEEKFOLD-01(③) 開いている日には印を出さない（中身がそのまま見えているため）',
        (await wfMark(wfPlanDates[0])) === null,
        `印=${await wfMark(wfPlanDates[0])}`,
      )
      // 自分で畳むと、献立が入っていることが印で分かる
      await wfPage.locator(`[data-testid="week-day-toggle"][data-date="${wfPlanDates[0]}"]`).click()
      await wfPage.waitForTimeout(700)
      check(
        'WEEKFOLD-01(③) 献立のある日を畳むと、入力があることが分かる印が出る',
        (await wfOpen(wfPlanDates[0])) === false && (await wfMark(wfPlanDates[0])) === 'plan',
        `開=${await wfOpen(wfPlanDates[0])} 印=${await wfMark(wfPlanDates[0])}`,
      )
      check(
        'WEEKFOLD-01(③) 献立の無い日には印を出さない',
        (await wfMark(wfEmptyDates[0])) === null,
        `印=${await wfMark(wfEmptyDates[0])}`,
      )
      // 印は絵文字ではなく、アイコンと色で描いてある（端末ごとに見た目が変わる絵文字を使わない）
      const wfMarkText = await wfPage
        .locator(`[data-testid="week-day-mark"][data-date="${wfPlanDates[0]}"]`)
        .evaluate((el) => el.textContent ?? '')
      check(
        'WEEKFOLD-01(③) 印は絵文字ではない（文字としての☑や・を置いていない）',
        !/[☑✔・●✅]/.test(wfMarkText),
        `字=${JSON.stringify(wfMarkText)}`,
      )

      // ===== 過ぎた週（今日が何曜日でも全7日が過去） =====
      await wfOpenWeek(['前の週'])
      const wfPast = await wfDates()
      check(
        'WEEKFOLD-01 前提: 前の週の7日分を読めた',
        wfPast.length === 7 && wfPast.every(Boolean),
        JSON.stringify(wfPast),
      )
      check(
        'WEEKFOLD-01 前提: 前の週は全部が今日より前（曜日に左右されない土台）',
        wfPast.length === 7 && wfPast.every((d) => d < wfToday),
        `今日=${wfToday} 週=${JSON.stringify(wfPast)}`,
      )
      check(
        'WEEKFOLD-01(①) 過ぎた日は全部畳まれている',
        wfPast.length > 0 &&
          (await Promise.all(wfPast.map((d) => wfOpen(d)))).every((v) => v === false),
        await wfOpenMap(wfPast),
      )
      check(
        'WEEKFOLD-01(③) 記録の無い過ぎた日には印を出さない',
        (await wfMark(wfPast[2])) === null,
        `印=${await wfMark(wfPast[2])}`,
      )
      // 過ぎた日に「作った記録」を仕込む（過ぎた日のカードが見せるのは記録なので、印も記録で出す）
      const wfLogged = await wfPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const recipe = g.result[0]
                if (!recipe) {
                  resolve({ ok: false })
                  return
                }
                store.put({ ...recipe, cookedLogs: [...(recipe.cookedLogs ?? []), { date }] })
              }
              tx.oncomplete = () => resolve({ ok: true })
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        wfPast[2],
      )
      check('WEEKFOLD-01 前提: 過ぎた日に作った記録を仕込めた', wfLogged.ok === true)
      await wfOpenWeek(['前の週'])
      check(
        'WEEKFOLD-01 前提: 読み込み直しても同じ過ぎた週を見ている',
        JSON.stringify(await wfDates()) === JSON.stringify(wfPast),
        JSON.stringify(await wfDates()),
      )
      check(
        'WEEKFOLD-01(③) 畳んでいる過ぎた日に記録があれば、印で分かる',
        (await wfOpen(wfPast[2])) === false && (await wfMark(wfPast[2])) === 'cooked',
        `開=${await wfOpen(wfPast[2])} 印=${await wfMark(wfPast[2])}`,
      )
      check(
        'WEEKFOLD-01(③) 記録の無い他の過ぎた日には印が出ない（全部に出ていないこと）',
        (await wfMark(wfPast[3])) === null && (await wfMark(wfPast[4])) === null,
        `${wfPast[3]}=${await wfMark(wfPast[3])} ${wfPast[4]}=${await wfMark(wfPast[4])}`,
      )
      // 既定で畳んでいても、自分で開けば開ける（既定は上書きできる）
      const wfExpandAll = wfPage.getByRole('button', { name: ja.mealPlan.weekDayExpandAll })
      check(
        'WEEKFOLD-01 前提: 全部畳まれているので「すべて開く」が出ている',
        (await wfExpandAll.count()) === 1,
      )
      if ((await wfExpandAll.count()) === 1) {
        await wfExpandAll.click()
        await wfPage.waitForTimeout(900)
        check(
          'WEEKFOLD-01(①) 「すべて開く」を押せば、過ぎた日も開ける（既定は上書きできる）',
          wfPast.length > 0 &&
            (await Promise.all(wfPast.map((d) => wfOpen(d)))).every((v) => v === true),
          await wfOpenMap(wfPast),
        )
      }
    } finally {
      await wfBrowser.close()
    }
  }

  // --- WEEKFMT-01(2026-08-19 便IF。オーナー原文「日と週で、同じ献立を提案する機能なのに、
  // 条件の絞り込みなどのボタンの配置がバラバラで、まるで別機能。フォーマット揃えたい。
  // 週は、日の、できることが増えたバージョン。」ほか⑧②③④⑪)。
  //
  // 測るのは6つ:
  //  ⑥ 日と週で、同じ役目のものが同じ順に並んでいる（**並びを書き写して並べない**。
  //     それぞれのタブで役目→画面上の位置を読み、出てきた順番の列どうしを突き合わせる）
  //  ② 無料版のPro案内が、週タブを開いただけでは出ていない（＝しまわれている）。
  //     消してはいない＝条件の窓を開けば同じ入口がある
  //  ③ 条件の窓に「条件をクリア」がある（名前は日タブと同じ ja.search.clear）
  //  ④⑤ → 2026-08-21 便IOで「別の週から入れる」の画面へ移した（下の便IOの節で見る）
  //     （画面に出ている週から計算して照合＝日付を書き写さない）
  //  ⑧ 「総入れ替え」を選ぶと決まっている枠も入れ替わり、選ばなければ1品も入れ替わらない
  //  ⑪ 過去だけの週ではロックのボタンを出さない／今日を含む週では出す
  //
  // 禁じ手よけ:
  //  ・掴み方は data-testid と読み上げ名だけ（入れ子の段数・並び順・クラス名に依らない）
  //  ・位置は「ページの中での位置」で測り、要素の親子関係には触れない
  //  ・日付・曜日の前提を置かない（週は画面から読む。前後どちらへも送って戻す）
  //  ・読み取りに失敗したら null のまま「前提」の行で必ず落とす（小さいから合格に倒さない） ---
  currentCheck = 'WEEKFMT-01'
  {
    const wmBrowser = await chromium.launch()
    const wmContext = await wmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const wmPage = await wmContext.newPage()
    wmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@WEEKFMT-01] ${err.message}`)
    })
    try {
      /** ページの中での位置（スクロールしていても同じ値になる） */
      const wmPos = async (loc) => {
        if ((await loc.count()) === 0) return null
        return await loc.first().evaluate((el) => {
          const r = el.getBoundingClientRect()
          return { y: Math.round(r.top + window.scrollY), x: Math.round(r.left + window.scrollX) }
        })
      }
      const wmTab = async (name) => {
        const tab = wmPage.getByRole('button', { name, exact: true })
        if ((await tab.getAttribute('aria-pressed')) !== 'true') {
          await tab.click()
          await wmPage.waitForTimeout(900)
        }
      }
      const wmToday = () =>
        wmPage.evaluate(() => {
          const d = new Date()
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })
      /** 画面に出ている7日分の日付（並び順ではなく属性から読む） */
      const wmDates = () =>
        wmPage
          .locator('[data-testid="week-day-toggle"]')
          .evaluateAll((els) => els.map((el) => el.getAttribute('data-date')))

      // 確認の窓は共通の仕掛けが自動で押す（installConfirmAutoPress）ので、
      // 文言は受け取り口で拾う（押し終わったあとに画面を見に行っても、もう窓は無い）
      const wmDialogs = []
      await collectConfirms(wmPage, wmDialogs)
      await wmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wmPage.waitForTimeout(2400) // 初回シード完了待ち

      // ===== ⑥ 同じ役目のものが同じ順に並んでいるか =====
      // 役目 → その役目を担う目印。**日と週で1対1に対応させる**。
      // 「週にしか無いもの（入れかた）」は、この突き合わせには入れない
      // ＝「できることが増えた版」であることと、並びがそろっていることを混ぜて測らない
      // 2026-08-21 便IO: 週の「出しかたの切り替え（おまかせ／週をコピー）」は無くなった
      // （別の週から入れる道は専用の画面へ独立した）。日タブの「1品／献立」と1対1に
      // 対応する役目が週側に無くなったので、この突き合わせからは外す。
      // 週にしか無いもの・日にしか無いものを並びの検査に混ぜない、という元の作法のまま
      const wmRoles = [
        ['条件の窓を開くボタン', 'day-conditions-open', 'plan-conditions-open'],
        ['決めてもらうボタン', 'day-suggest-draw', 'week-fill-run'],
      ]
      /** そのタブで、役目を画面の上から順に並べた列を作る（読めない役目があれば null を混ぜる） */
      const wmOrderOf = async (which) => {
        const found = []
        for (const [role, dayId, weekId] of wmRoles) {
          const id = which === 'day' ? dayId : weekId
          const pos = await wmPos(wmPage.locator(`[data-testid="${id}"]`))
          found.push({ role, id, pos })
        }
        return found
      }
      await wmTab('日')
      const wmDayFound = await wmOrderOf('day')
      await wmTab('週')
      // 2026-08-22 便IV: 週の3節は畳んだ状態から始まる（オーナー原文
      // 「でふぉるとで設定３種は、折りたたんだ表示にして」）。並びを測るのは「開いたときの並び」
      // なので、先に開く（畳んだときに何が出ているかは IVFOLD-01 が受け持つ）
      await openWeekGroup(wmPage, ja.mealPlan.weekGroupAutoTitle)
      await wmPage.waitForTimeout(400)
      const wmWeekFound = await wmOrderOf('week')
      check(
        'WEEKFMT-01 前提: 日タブの役目をすべて掴めた（掴めなければ以下は測れていない）',
        wmDayFound.every((f) => f.pos != null),
        JSON.stringify(wmDayFound),
      )
      check(
        'WEEKFMT-01 前提: 週タブの役目をすべて掴めた（掴めなければ以下は測れていない）',
        wmWeekFound.every((f) => f.pos != null),
        JSON.stringify(wmWeekFound),
      )
      const wmSeq = (found) =>
        found.every((f) => f.pos != null)
          ? found
              .slice()
              .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x)
              .map((f) => f.role)
          : null
      const wmDaySeq = wmSeq(wmDayFound)
      const wmWeekSeq = wmSeq(wmWeekFound)
      // 2026-08-22 便IV（オーナー原文「「まとめて献立てを入力」ボタンは「献立を提案」の横にして、
      // １列におさめて。」）で、週の実行ボタンは**節の見出しの行**へ上がった。
      // 便IF・⑥の「日と週で同じ順」は、この2つについては成り立たなくなる（新しい指示が正・規約B）。
      // 順番そのものを消すと、どちらのタブの並びも黙って動かせてしまうので、
      // **それぞれのタブの中での並び**を書き留めて固定する:
      //   日 … 条件の窓を開くボタン → 決めてもらうボタン（便IF・⑥のまま）
      //   週 … 決めてもらうボタン（見出しの横）→ 条件の窓を開くボタン（便IV）
      // そろえ続けているもの（条件は窓で開く・実行は塗りつぶし・名前）は下の行が見る
      check(
        'WEEKFMT-01(⑥) 日タブの並びは 条件の窓 → 決めてもらう のまま',
        JSON.stringify(wmDaySeq) === JSON.stringify(['条件の窓を開くボタン', '決めてもらうボタン']),
        `日=${JSON.stringify(wmDaySeq)}`,
      )
      check(
        'WEEKFMT-01(便IV) 週タブでは、実行ボタンが見出しの横＝条件より上に来る',
        JSON.stringify(wmWeekSeq) === JSON.stringify(['決めてもらうボタン', '条件の窓を開くボタン']),
        `週=${JSON.stringify(wmWeekSeq)}`,
      )
      // 見た目もそろえる: 「決めてもらう」ボタンはどちらのタブでも塗りつぶしで横いっぱい
      const wmRunLook = async (id) => {
        const loc = wmPage.locator(`[data-testid="${id}"]`)
        if ((await loc.count()) === 0) return null
        return await loc.first().evaluate((el) => {
          const parent = el.parentElement
          const w = el.getBoundingClientRect().width
          const pw = parent ? parent.getBoundingClientRect().width : 0
          return {
            filled: el.className.includes('bg-accent'),
            widthRatio: pw > 0 ? Math.round((w / pw) * 100) : 0,
          }
        })
      }
      await wmTab('日')
      const wmDayRun = await wmRunLook('day-suggest-draw')
      await wmTab('週')
      await openWeekGroup(wmPage, ja.mealPlan.weekGroupAutoTitle)
      await wmPage.waitForTimeout(400)
      const wmWeekRun = await wmRunLook('week-fill-run')
      check(
        'WEEKFMT-01 前提: 両方の「決めてもらう」ボタンの見た目を読めた',
        wmDayRun != null && wmWeekRun != null,
        `日=${JSON.stringify(wmDayRun)} 週=${JSON.stringify(wmWeekRun)}`,
      )
      check(
        'WEEKFMT-01(⑥) 「決めてもらう」ボタンは、日でも週でも塗りつぶしで目立たせている',
        wmDayRun != null && wmWeekRun != null && wmDayRun.filled === true && wmWeekRun.filled === true,
        `日=${JSON.stringify(wmDayRun)} 週=${JSON.stringify(wmWeekRun)}`,
      )
      // 横いっぱいは日タブだけ。2026-08-22 便IV（オーナー原文「「まとめて献立てを入力」ボタンは
      // 「献立を提案」の横にして、１列におさめて。」）で、週は節の見出しと同じ行へ移った
      // ＝畳んだときも1行で収まる。同じ行に居ることは IVFOLD-01 が実測で見る
      check(
        'WEEKFMT-01(⑥→便IV) 日タブの「決めてもらう」ボタンは横いっぱいのまま',
        wmDayRun != null && wmDayRun.widthRatio >= 90,
        `日=${JSON.stringify(wmDayRun)}`,
      )
      check(
        'WEEKFMT-01(便IV) 週タブの「まとめて献立を入力」は見出しの横なので横いっぱいではない',
        wmWeekRun != null && wmWeekRun.widthRatio < 90,
        `週=${JSON.stringify(wmWeekRun)}`,
      )

      // ===== ② 無料版のPro案内はしまわれている（消してはいない） =====
      const wmLockedRow = wmPage.locator('[data-testid="purpose-locked-row"]')
      check(
        'WEEKFMT-01(②) 週タブを開いただけでは、無料版のPro案内は出ていない',
        (await wmLockedRow.count()) === 0,
      )
      const wmCondOpen = wmPage.locator('[data-testid="plan-conditions-open"]')
      await wmCondOpen.click()
      await wmPage.waitForTimeout(700)
      const wmModal = wmPage.locator('[data-testid="plan-conditions-modal"]')
      check('WEEKFMT-01 前提: 条件の窓が開いた', (await wmModal.count()) === 1)
      check(
        'WEEKFMT-01(②) 条件の窓を開けば、Pro案内の入口はある（消してはいない）',
        (await wmModal.locator('[data-testid="purpose-locked-row"]').count()) === 1,
      )

      // ===== ③ 条件の窓の「条件をクリア」 =====
      // 名前は「日タブの窓に出ているものと同じか」で見る（こちらに文字列を書き写さない）。
      // 条件を1つも選んでいないあいだは場所だけ取って読み上げから外している（日タブと同じ作り）ので、
      // 役割ではなく目印で掴む
      const wmClear = wmModal.locator('[data-testid="plan-conditions-clear"]')
      check(
        'WEEKFMT-01(③) 条件の窓に「条件をクリア」がある',
        (await wmClear.count()) === 1,
      )
      const wmClearName = (await wmClear.count()) === 1
        ? ((await wmClear.textContent()) ?? '').replace(/​/g, '').trim()
        : null
      check(
        'WEEKFMT-01(③) 「条件をクリア」の名前は、日タブの窓のものと同じ',
        wmClearName != null && wmClearName === ja.search.clear,
        `週=${wmClearName} 日=${ja.search.clear}`,
      )
      // 2026-08-22 便IY: ジャンルは複数選べる並びになった。既定は3つとも選んだ状態(＝指定なし)
      // なので、1つ外して「絞っている」状態を作る
      const wmPicked = async () =>
        wmPage
          .locator('[data-testid="plan-genre-chip"]')
          .evaluateAll((els) =>
            els
              .filter((el) => el.getAttribute('aria-pressed') === 'true')
              .map((el) => el.getAttribute('data-genre')),
          )
      await wmPage.locator(`[data-testid="plan-genre-chip"][data-genre="${MEAL_GENRES[MEAL_GENRES.length - 1]}"]`).click()
      await wmPage.waitForTimeout(400)
      check(
        'WEEKFMT-01(③) 前提: 条件を1つ選べた（選べていなければクリアの効きは測れていない）',
        JSON.stringify(await wmPicked()) === JSON.stringify(['和食', '洋食']),
        JSON.stringify(await wmPicked()),
      )
      check(
        'WEEKFMT-01(③) 条件を選ぶと「条件をクリア」が押せる形で出る',
        (await wmClear.count()) === 1 && (await wmClear.isVisible()) === true,
      )
      await wmClear.click()
      await wmPage.waitForTimeout(400)
      check(
        'WEEKFMT-01(③) 「条件をクリア」を押すと、選んだ条件が外れる',
        JSON.stringify(await wmPicked()) === JSON.stringify([...MEAL_GENRES]),
        JSON.stringify(await wmPicked()),
      )
      await wmPage.locator('[data-testid="plan-conditions-close"]').click()
      await wmPage.waitForTimeout(500)
      check(
        'WEEKFMT-01(③) クリアしたあと、条件のボタンは「指定なし」に戻る',
        ((await wmCondOpen.textContent()) ?? '')
          .replace(/​/g, '')
          .includes(ja.mealPlan.suggestConditionsNone),
        (await wmCondOpen.textContent())?.replace(/​/g, ''),
      )

      // ===== 便IO: 別の週から入れる（週を送って中身を見ながら選ぶ） =====
      // オーナー原文「先週に限らず、ユーザーが選んだ７日間を指定（献立一覧で表示して、
      // 今表示している７日間の献立を今週に反映、と言った感じ？献立の中身も確認できるし。）」
      // 効く理由: 「先週」だけを選べる形では、何が入っていたか思い出せないまま押すことになる。
      // なので測るのは次の2つ:
      //   ① 画面に出る「その週の中身」が、実際にその週に入っているものと一致する
      //   ② 入れたあと、その中身がそのまま入れ先の週に入っている
      // 禁じ手よけ: 曜日・月替わりの前提を置かない（表示している7日を属性から読み、
      // 今日以降の日だけを対象にする）／画面の字を書き写さず、目印と実データで突き合わせる
      const wmShown = await wmDates()
      check(
        'WEEKFMT-01 前提: 表示している週の7日分を読めた',
        wmShown.length === 7 && wmShown.every(Boolean),
        JSON.stringify(wmShown),
      )
      const wmShiftKey = (date, days) => {
        const d = new Date(`${date}T00:00:00`)
        d.setDate(d.getDate() + days)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      }
      const wmYmd = (date) => date.replaceAll('-', '/')
      const wmToday2 = await wmToday()
      const wmFuture = wmShown.filter((d) => d >= wmToday2)
      check(
        'WEEKFMT-01 前提: 今日以降の日が1日以上ある（今週を見ている）',
        wmFuture.length > 0,
        `今日=${wmToday2} 週=${JSON.stringify(wmShown)}`,
      )
      /** 献立を直接入れる（which=登録順の何品目のレシピか。日ごとに変えて見分けられるようにする） */
      const wmSeed = (rows) =>
        wmPage.evaluate(
          (targets) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const rtx = idb.transaction('recipes', 'readonly')
                const g = rtx.objectStore('recipes').getAll()
                g.onsuccess = () => {
                  const known = g.result
                    .filter((r) => r.id != null)
                    .map((r) => ({ id: r.id, title: r.title }))
                  const need = Math.max(...targets.map((t) => t.which)) + 1
                  if (known.length < need) {
                    resolve({ ok: false })
                    return
                  }
                  const wtx = idb.transaction('mealPlans', 'readwrite')
                  const store = wtx.objectStore('mealPlans')
                  for (const row of targets) {
                    store.add({
                      date: row.date,
                      slot: 'dinner',
                      recipeId: known[row.which].id,
                      role: 'main',
                    })
                  }
                  wtx.oncomplete = () => resolve({ ok: true, recipes: known.slice(0, need) })
                  wtx.onerror = () => reject(wtx.error)
                }
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          rows,
        )
      /** 指定の日に入っている献立を id つきで読む（並びは id 順＝入れた順） */
      const wmPlans = (dates) =>
        wmPage.evaluate(
          (targets) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result
                      .filter((e) => targets.includes(e.date))
                      .sort((a, b) => a.id - b.id)
                      .map((e) => ({ id: e.id, date: e.date, slot: e.slot, recipeId: e.recipeId })),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          dates,
        )
      // **2週間前**に入れる中身を仕込む＝「先週」だけでは届かない週を選べることも同時に見る。
      // 日ごとに別のレシピにして、どの日の中身がどこへ入ったかを1品ずつ突き合わせられるようにする
      const wmSrcDates = wmShown.map((d) => wmShiftKey(d, -14))
      const wmSeeded = await wmSeed([
        ...wmFuture.map((d, i) => ({ date: wmShiftKey(d, -14), which: i })),
        // 入れ先の今日以降は、コピー元とは違う1品で埋めておく（入れ替わったかを見分けるため）
        ...wmFuture.map((d) => ({ date: d, which: 7 })),
      ])
      check('WEEKFMT-01 前提: 2週間前と今の週に、別のレシピの献立を仕込めた', wmSeeded.ok === true)
      // 仕込んだあとは読み込み直す（Dexieの自動反映は自分の書き込みしか見ていない）
      await wmPage.reload({ waitUntil: 'networkidle' })
      await wmPage.waitForTimeout(1800)
      await wmTab('週')
      const wmBefore = await wmPlans(wmFuture)
      check(
        'WEEKFMT-01 前提: 入れ先の今日以降が、コピー元とは違う1品で埋まっている',
        wmBefore.length === wmFuture.length &&
          wmBefore.every((e) => e.recipeId === wmSeeded.recipes[7].id),
        JSON.stringify(wmBefore),
      )

      // ---- 入口（2026-08-22 便IVでテンプレートの節の折りたたみの中へ戻った） ----
      const wmEntry = wmPage.locator('[data-testid="week-copy-pick"]')
      await openWeekGroup(wmPage, ja.mealPlan.weekGroupTemplateTitle)
      check(
        'WEEKFMT-01(便IO) 節を開くと「過去の献立をコピー」の入口が押せる',
        (await wmEntry.count()) === 1,
      )
      await wmEntry.click()
      await wmPage.waitForTimeout(1000)
      const wmTargetBox = wmPage.locator('[data-testid="copy-pick-target"]')
      check(
        'WEEKFMT-01(便IO) 入れ先は「週」の画面で表示していた7日間のまま（この画面で週を送っても動かない）',
        (await wmTargetBox.getAttribute('data-start')) === wmShown[0] &&
          (await wmTargetBox.getAttribute('data-end')) === wmShown[6],
        `入れ先=${await wmTargetBox.getAttribute('data-start')}〜${await wmTargetBox.getAttribute('data-end')}`,
      )
      check(
        'WEEKFMT-01(便IO) 入れ先の7日間は日付で書いてある（この画面には週が2つあるため）',
        ((await wmTargetBox.textContent()) ?? '').replace(/​/g, '').includes(wmYmd(wmShown[0])),
        (await wmTargetBox.textContent()) ?? '',
      )
      const wmSrcWeek = wmPage.locator('[data-testid="copy-source-week"]')
      check(
        'WEEKFMT-01(便IO) 開いた直後は1週間前を見ている',
        (await wmSrcWeek.getAttribute('data-start')) === wmShiftKey(wmShown[0], -7),
        `いま=${await wmSrcWeek.getAttribute('data-start')}`,
      )
      // 「先週」に限らず選べること＝さらに前へ送れる（便II・⑤のプルダウンの置き換え）
      await wmPage.locator('[data-testid="copy-pick-prev"]').click()
      await wmPage.waitForTimeout(700)
      check(
        'WEEKFMT-01(便IO) さらに前へ送ると2週間前になる（「先週」に限らず選べる）',
        (await wmSrcWeek.getAttribute('data-start')) === wmSrcDates[0],
        `いま=${await wmSrcWeek.getAttribute('data-start')} 期待=${wmSrcDates[0]}`,
      )
      const wmSrcInDb = (await wmPlans(wmSrcDates)).map((e) => ({
        date: e.date,
        slot: e.slot,
        recipeId: e.recipeId,
      }))
      check(
        'WEEKFMT-01 前提: その週に献立が入っている（0件どうしの一致で素通りしない）',
        wmSrcInDb.length === wmFuture.length && wmSrcInDb.length > 0,
        JSON.stringify(wmSrcInDb),
      )
      const wmItems = await wmPage
        .locator('[data-testid="copy-source-item"]')
        .evaluateAll((els) =>
          els.map((el) => ({
            date: el.getAttribute('data-date'),
            slot: el.getAttribute('data-slot'),
            recipeId: Number(el.getAttribute('data-recipe-id')),
            text: (el.textContent ?? '').replace(/​/g, ''),
          })),
        )
      check(
        'WEEKFMT-01(便IO・①) 画面に出ている中身が、その週に実際に入っているものと一致する',
        JSON.stringify(
          wmItems.map((i) => ({ date: i.date, slot: i.slot, recipeId: i.recipeId })),
        ) === JSON.stringify(wmSrcInDb),
        `画面=${JSON.stringify(wmItems)} / データ=${JSON.stringify(wmSrcInDb)}`,
      )
      check(
        'WEEKFMT-01(便IO・①) 中身は料理名で読める（idだけの一致で素通りしない）',
        wmItems.length > 0 &&
          wmItems.every((i) =>
            i.text.includes(wmSeeded.recipes.find((r) => r.id === i.recipeId)?.title ?? ' '),
          ),
        JSON.stringify(wmItems.map((i) => i.text)),
      )

      // ---- ⑧ 入れかたはこの画面にあり、既定は非破壊 ----
      const wmFillMode = wmPage.locator('[data-testid="copy-pick-fill-mode"]')
      check(
        'WEEKFMT-01(⑧) 前提: 入れかたの既定は「空いた枠だけ」',
        (await wmFillMode.inputValue()) === 'fillEmpty',
        await wmFillMode.inputValue(),
      )
      wmDialogs.length = 0
      await wmPage.locator('[data-testid="copy-pick-run"]').click()
      await wmPage.waitForTimeout(1800)
      const wmAfterKeep = await wmPlans(wmFuture)
      check(
        'WEEKFMT-01(⑧) 上書きを選ばなければ、決まっている枠は入れ替わらない',
        JSON.stringify(wmAfterKeep) === JSON.stringify(wmBefore),
        `前=${JSON.stringify(wmBefore)} 後=${JSON.stringify(wmAfterKeep)}`,
      )
      check(
        'WEEKFMT-01(⑧) 上書きを選ばなければ、消す確認の窓も出ない',
        wmDialogs.length === 0,
        JSON.stringify(wmDialogs),
      )
      // ---- ⑧ 総入れ替えは規約Fの確認を通ってから入れ替える ----
      await wmFillMode.selectOption('replaceAll')
      await wmPage.waitForTimeout(400)
      wmDialogs.length = 0
      await wmPage.locator('[data-testid="copy-pick-run"]').click()
      await wmPage.waitForTimeout(2500)
      check(
        'WEEKFMT-01(⑧・規約F) 上書きするときは、押す前に確認の窓が出る',
        wmDialogs.length === 1,
        JSON.stringify(wmDialogs),
      )
      const wmConfirmText = wmDialogs[0] ?? ''
      check(
        'WEEKFMT-01(⑧・規約F) 確認の窓は「消えるもの」と「残るもの」を両方書く',
        wmConfirmText.includes(ja.mealPlan.fillModeReplaceAllGoneLabel) &&
          wmConfirmText.includes(ja.mealPlan.fillModeReplaceAllKeptLabel),
        wmConfirmText,
      )
      check(
        'WEEKFMT-01(⑧・規約F) 確認の窓は、消える品数を数で言う',
        new RegExp(`${wmBefore.length}\\s*[品件]`).test(wmConfirmText),
        wmConfirmText,
      )
      check(
        'WEEKFMT-01(便IO・規約F) 確認の窓は、消える先の週も日付で言う（この画面には週が2つあるため）',
        wmConfirmText.includes(wmYmd(wmShown[0])) && wmConfirmText.includes(wmYmd(wmShown[6])),
        wmConfirmText,
      )
      // ---- ② 入れたあと、選んだ週の中身がそのまま入れ先に入っている ----
      const wmAfterSwap = await wmPlans(wmFuture)
      const wmWant = wmFuture.map((d) => ({
        date: d,
        slot: 'dinner',
        recipeId: wmSrcInDb.find((e) => e.date === wmShiftKey(d, -14))?.recipeId,
      }))
      check(
        'WEEKFMT-01(便IO・②) 入れたあと、選んだ週の中身がそのまま入れ先の週に入っている',
        JSON.stringify(
          wmAfterSwap.map((e) => ({ date: e.date, slot: e.slot, recipeId: e.recipeId })),
        ) === JSON.stringify(wmWant) &&
          wmAfterSwap.every((e) => !wmBefore.some((b) => b.id === e.id)),
        `入った=${JSON.stringify(wmAfterSwap)} / 期待=${JSON.stringify(wmWant)}`,
      )
      check(
        'WEEKFMT-01(便IO) 入れ終わると献立の「週」へ戻る（次の一手を探させない）',
        !wmPage.url().includes('copy-week'),
        wmPage.url(),
      )

      // ===== ⑪ 過去だけの週ではロックのボタンを出さない =====
      await wmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wmPage.reload({ waitUntil: 'networkidle' })
      await wmPage.waitForTimeout(1800)
      await wmTab('週')
      const wmLockCount = async () => ({
        all: await wmPage.locator('[data-testid="lock-all"]').count(),
        day: await wmPage.locator('[data-testid="day-lock"]').count(),
      })
      const wmNow = await wmLockCount()
      check(
        'WEEKFMT-01(⑪) 今日を含む週では、ロックのボタンを出す',
        wmNow.all === 1 && wmNow.day === 7,
        JSON.stringify(wmNow),
      )
      // 前の週へ2回送る＝今日が何曜日でも7日とも過去になる（曜日の前提を置かない）
      for (let i = 0; i < 2; i++) {
        await wmPage.locator(`button[aria-label="${ja.mealPlan.prevWeek}"]`).click()
        await wmPage.waitForTimeout(700)
      }
      const wmPastDates = await wmDates()
      const wmToday3 = await wmToday()
      check(
        'WEEKFMT-01 前提: 送った先は7日とも過去（曜日に左右されない土台）',
        wmPastDates.length === 7 && wmPastDates.every((d) => d < wmToday3),
        `今日=${wmToday3} 週=${JSON.stringify(wmPastDates)}`,
      )
      const wmPast = await wmLockCount()
      // 2026-08-22 便JFで巻き戻した（オーナー「ロックボタンは芯ではないだけで、結果として
      // あることに意味が出ました」）。便IF・⑪の「過ぎた日には鍵で守るものが無い」という前提は
      // **当時から崩れていた**——「まとめて空にする」は過ぎた日も消す対象で、それを止められるのは
      // 鍵だけなのに、過去だけの週では鍵が出なかった＝守る手段が1つも無かった。
      // 見張りを消すのではなく、**逆向きに立て直す**（出ることを測る）
      check(
        'WEEKFMT-01(⑪→便JFで巻き戻し) 過去だけの週でも、ロックのボタンを出す',
        wmPast.all === 1 && wmPast.day === 7,
        JSON.stringify(wmPast),
      )
      // 戻せば また出る（前後どちらへも送れる形にする）
      for (let i = 0; i < 2; i++) {
        await wmPage.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).click()
        await wmPage.waitForTimeout(700)
      }
      const wmBack = await wmLockCount()
      check(
        'WEEKFMT-01(⑪) 今日を含む週へ戻せば、ロックのボタンはまた出る',
        wmBack.all === 1 && wmBack.day === 7,
        JSON.stringify(wmBack),
      )
    } finally {
      await wmBrowser.close()
    }
  }
