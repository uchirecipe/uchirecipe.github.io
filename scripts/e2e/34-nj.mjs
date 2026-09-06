// ==========================================================================================
// 便NJ（2026-09-06）: 日タブの実機フィードバック（切り替えの控えめ化・ルーレット演出）
// 2026-09-07 便NK（第2弾）で両方を作り直した:
//  ・切り替えは**逆側だけを見せるボタン1つ**（オーナー原文「献立をデフォルトにして、
//    スイッチで1品に切り替えの方が見た目がすっきりするかも。常に２択ボタンじゃなくて」）。
//    data-testid は押した先の側の名前＝ day-mode-one が在る=いま献立側／day-mode-plan が在る=1品側
//  ・ルーレットは**結果のカードごと**に覆いを重ねる（オーナー原文「ルーレットに見える部分が、
//    文字だけな上に品数も違う。変な演出でしかない」→ 品数が結果と同じ・見た目もカードと同じ面）
// この中の節: NJSWITCH-01, NJROLL-01
//
// 測ること:
//  NJSWITCH-01 切り替えは逆側だけが1つ出ている（2択チップを常設しない）。
//              「決めてもらう」ボタンより低い（主役の上下関係）。
//              押して入れ替わっても、切り替えの場所・高さも決めてもらうボタンも1pxも動かない
//              （便HT・便IAの「押しても画面が動かない」規律のまま）
//  NJROLL-01   決めてもらうボタンを押すとルーレットの覆い（day-suggest-rolling）が出て、
//              着地後は覆いが消え、出ている料理名が実装と同じ候補づくり
//              （logic/homeSuggest.ts の suggestionCandidates・同じ季節）の中の品で、
//              読み直しても変わらない（＝回りっぱなしにならない）。
//              覆いは**結果のカードの上だけ**に、**結果と同じ数**だけ出る（1品=1枚・献立=品数ぶん。
//              数はMutationObserverで回っている最中の実物を数える）。
//              reduced-motion の文脈では覆いを出さず即着地する。
//              演出の長さ（200〜300ms）はソースの見張り（ui-source-guards の NJ-2）が固定する
//              ＝ここでは時間を測らない（マシンの負荷で揺れる数字を検査に書かない）
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 文言は ja.ts から読む（禁じ手②）。候補の期待値は _shared.mjs 経由の実装そのものから作る。
// 料理名が読めなかったときは合格に倒さず不合格にする。
// ==========================================================================================
import './_shared.mjs'

  currentCheck = 'NJSWITCH-01'
  {
    const nsBrowser = await chromium.launch()
    try {
      const nsCtx = await nsBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const nsPage = await nsCtx.newPage()
      nsPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await nsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nsPage.waitForTimeout(2400) // 初回シード完了待ち

      const nsBox = async (id) => {
        const loc = nsPage.locator(`[data-testid="${id}"]`)
        if ((await loc.count()) !== 1) return null
        const b = await loc.first().boundingBox()
        return b ? { y: Math.round(b.y), h: Math.round(b.height) } : null
      }
      const nsCount = (id) => nsPage.locator(`[data-testid="${id}"]`).count()
      // 2026-09-07 便NK: day-mode-one（1品側への切り替え）が在る＝いま既定の献立側
      const nsToggle = await nsBox('day-mode-one')
      const nsDraw = await nsBox('day-suggest-draw')
      check(
        'NJSWITCH-01 前提: 切り替えと決めてもらうボタンの位置を読めた',
        nsToggle != null && nsDraw != null,
        `切り替え=${JSON.stringify(nsToggle)} ボタン=${JSON.stringify(nsDraw)}`,
      )
      check(
        'NJSWITCH-01 既定（献立）では1品側への切り替えだけが出ている（2択チップを常設しない）',
        nsToggle != null && (await nsCount('day-mode-plan')) === 0,
        `1品へ=${nsToggle != null ? 1 : 0} 献立へ=${await nsCount('day-mode-plan')}`,
      )
      if (nsToggle != null && nsDraw != null) {
        check(
          'NJSWITCH-01 切り替えは決めてもらうボタンより低い（目立つのはボタンの側）',
          nsToggle.h < nsDraw.h,
          `切り替え=${nsToggle.h}px ボタン=${nsDraw.h}px`,
        )
        // 押すと逆側のボタンに入れ替わる。切り替えの場所・高さも決めてもらうボタンも動かない
        // （出た結果の品数（1品=1枚/献立=2枚）はボタンより下なので、上は動かないのが正）
        await nsPage.locator('[data-testid="day-mode-one"]').click()
        await nsPage.waitForTimeout(800)
        const nsBackBtn = await nsBox('day-mode-plan')
        const nsDrawAfter = await nsBox('day-suggest-draw')
        check(
          'NJSWITCH-01 押すと「献立に戻す」だけに入れ替わる（1品側でも逆側だけを見せる）',
          nsBackBtn != null && (await nsCount('day-mode-one')) === 0,
          `献立へ=${JSON.stringify(nsBackBtn)} 1品へ=${await nsCount('day-mode-one')}`,
        )
        await nsPage.locator('[data-testid="day-mode-plan"]').click()
        await nsPage.waitForTimeout(800)
        const nsToggleBack = await nsBox('day-mode-one')
        const nsDrawBack = await nsBox('day-suggest-draw')
        check(
          'NJSWITCH-01 切り替えを押しても、切り替えの場所・高さと決めてもらうボタンは1pxも動かない',
          nsBackBtn != null &&
            nsDrawAfter != null &&
            nsToggleBack != null &&
            nsDrawBack != null &&
            nsBackBtn.y === nsToggle.y &&
            nsBackBtn.h === nsToggle.h &&
            nsToggleBack.y === nsToggle.y &&
            nsToggleBack.h === nsToggle.h &&
            nsDrawAfter.y === nsDraw.y &&
            nsDrawBack.y === nsDraw.y,
          `前=${JSON.stringify({ toggle: nsToggle, draw: nsDraw })} 1品後=${JSON.stringify({ toggle: nsBackBtn, draw: nsDrawAfter })} 献立後=${JSON.stringify({ toggle: nsToggleBack, draw: nsDrawBack })}`,
        )
      }
    } finally {
      await nsBrowser.close()
    }
  }

  currentCheck = 'NJROLL-01'
  {
    const njBrowser = await chromium.launch()
    try {
      const njClean = (t) => (t ?? '').replaceAll('​', '').trim()

      // --- 普段の文脈: 押すと回り、着地して止まる ---
      const njCtx = await njBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const njPage = await njCtx.newPage()
      njPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await njPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await njPage.waitForTimeout(2400) // 初回シード完了待ち
      // 期待値（引ける料理名の母集団）は実装と同じ関数・同じ季節から作る（数え方を書き写さない）
      const njAll = await njPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const njPool = suggestionCandidates(njAll, ['main'], currentSeason()).map((r) => r.title)
      check(
        'NJROLL-01 前提: 候補が2品以上ある（1品以下ではルーレットは回さない設計のため測れない）',
        njPool.length >= 2,
        `候補=${njPool.length}品`,
      )
      await njPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await njPage.reload({ waitUntil: 'networkidle' })
      await njPage.waitForTimeout(2000)
      const njOneBtn = njPage.locator('[data-testid="day-mode-one"]')
      check('NJROLL-01 前提: 「1品」へ切り替えられる', (await njOneBtn.count()) === 1)
      if ((await njOneBtn.count()) === 1) {
        await njOneBtn.click()
        await njPage.waitForTimeout(1000)
      }
      const njTitle = () => njPage.locator('[data-testid="day-suggest-result-title"]').first()
      const njRolling = njPage.locator('[data-testid="day-suggest-rolling"]')
      // 2026-09-07 便NK: 覆いの数と「結果のカードに重なっているか」は、回っている最中の実物を
      // MutationObserver で数える（240msしか無いので、押してから locator で数えると間に合わない）
      const njArmRollWatch = () =>
        njPage.evaluate(() => {
          window.__njRoll = { max: 0, offCard: 0 }
          const scan = () => {
            const covers = document.querySelectorAll('[data-testid="day-suggest-rolling"]')
            if (covers.length > window.__njRoll.max) window.__njRoll.max = covers.length
            for (const c of covers) {
              // 覆いは結果のカードの入れ物の中（＝カードの上）に居ること
              if (!c.parentElement?.querySelector('[data-testid="day-suggest-result"]'))
                window.__njRoll.offCard++
            }
          }
          if (!window.__njRollObs) {
            window.__njRollObs = new MutationObserver(scan)
            window.__njRollObs.observe(document.body, { childList: true, subtree: true })
          }
        })
      await njArmRollWatch()
      // 覆いは240msで消えるので、**押す前から**現れ待ちを仕掛けておく
      //（押してから探し始めると、探す準備のあいだに消え終わることがある）
      const njSeenPromise = njRolling
        .waitFor({ state: 'attached', timeout: 1500 })
        .then(() => true)
        .catch(() => false)
      await njPage.locator('[data-testid="day-suggest-draw"]').click()
      const njSeen = await njSeenPromise
      check('NJROLL-01 押すとルーレットの覆いが出る', njSeen === true)
      await njPage.waitForTimeout(700)
      const njLanded = njClean(await njTitle().textContent())
      check(
        'NJROLL-01 着地後は覆いが消えている（回りっぱなしにならない）',
        (await njRolling.count()) === 0,
      )
      {
        const njOneRoll = await njPage.evaluate(() => window.__njRoll)
        check(
          'NJROLL-01 1品では覆いが1枚だけ、結果のカードの上に出る（品数が結果と同じ）',
          njOneRoll.max === 1 && njOneRoll.offCard === 0,
          `覆いの最大=${njOneRoll.max} カードの外=${njOneRoll.offCard}`,
        )
      }
      check(
        'NJROLL-01 着地した料理名は実装と同じ候補づくりの中の品',
        njLanded.length > 0 && njPool.includes(njLanded),
        `出た品=${njLanded}`,
      )
      await njPage.waitForTimeout(300)
      check(
        'NJROLL-01 着地した料理名は読み直しても変わらない（演出は表示だけで、結果を差し替えない）',
        njClean(await njTitle().textContent()) === njLanded,
        `直後=${njLanded} 300ms後=${njClean(await njTitle().textContent())}`,
      )

      // --- 献立側: 覆いは結果のカードと同じ数だけ出る（「品数も違う」を作り直した本丸） ---
      await njPage.evaluate(() => {
        window.__njRoll.max = 0
        window.__njRoll.offCard = 0
      })
      const njPlanBtn = njPage.locator('[data-testid="day-mode-plan"]')
      check('NJROLL-01 前提: 「献立」へ戻せる', (await njPlanBtn.count()) === 1)
      if ((await njPlanBtn.count()) === 1) {
        await njPlanBtn.click()
        await njPage.waitForTimeout(1200)
      }
      // 覆いは献立では2枚出るので .first() で待つ（複数一致の locator を waitFor すると
      // strict mode が例外を投げ、catch で false に化けて「出ていない」と誤判定する）
      const njPlanSeenPromise = njRolling
        .first()
        .waitFor({ state: 'attached', timeout: 1500 })
        .then(() => true)
        .catch(() => false)
      await njPage.locator('[data-testid="day-suggest-draw"]').click()
      const njPlanSeen = await njPlanSeenPromise
      check('NJROLL-01 献立でも押すとルーレットの覆いが出る', njPlanSeen === true)
      await njPage.waitForTimeout(700)
      {
        const njPlanRoll = await njPage.evaluate(() => window.__njRoll)
        const njPlanCards = await njPage
          .locator('[data-testid="day-suggest-pair"] [data-testid="day-suggest-result"]')
          .count()
        check(
          'NJROLL-01 前提: 組んだ献立のカードが出ている（0枚なら測れていない）',
          njPlanCards >= 1,
          `カード=${njPlanCards}枚`,
        )
        check(
          'NJROLL-01 献立では覆いが結果のカードと同じ数だけ、カードの上に出る（品数が結果と同じ）',
          njPlanRoll.max === njPlanCards && njPlanRoll.offCard === 0,
          `覆いの最大=${njPlanRoll.max} カード=${njPlanCards}枚 カードの外=${njPlanRoll.offCard}`,
        )
        check(
          'NJROLL-01 献立でも着地後は覆いが消えている',
          (await njRolling.count()) === 0,
        )
      }
      await njCtx.close()

      // --- reduced-motion の文脈: 回さず即着地 ---
      const njRmCtx = await njBrowser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      })
      const njRmPage = await njRmCtx.newPage()
      njRmPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${currentCheck}] ${err.message}`)
      })
      await njRmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await njRmPage.waitForTimeout(2400) // まっさらな文脈なので初回シードから
      await njRmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await njRmPage.reload({ waitUntil: 'networkidle' })
      await njRmPage.waitForTimeout(2000)
      const njRmOne = njRmPage.locator('[data-testid="day-mode-one"]')
      check('NJROLL-01 前提: reduced-motionの文脈でも「1品」へ切り替えられる', (await njRmOne.count()) === 1)
      if ((await njRmOne.count()) === 1) {
        await njRmOne.click()
        await njRmPage.waitForTimeout(1000)
      }
      await njRmPage.locator('[data-testid="day-suggest-draw"]').click()
      // 覆いの寿命（240ms）より手前で見る＝もし回っていれば、ここで必ず捕まる
      await njRmPage.waitForTimeout(120)
      const njRmTitle = njClean(
        await njRmPage.locator('[data-testid="day-suggest-result-title"]').first().textContent(),
      )
      check(
        'NJROLL-01 reduced-motionでは覆いを出さず即着地する',
        (await njRmPage.locator('[data-testid="day-suggest-rolling"]').count()) === 0 &&
          njRmTitle.length > 0 &&
          njPool.includes(njRmTitle),
        `出た品=${njRmTitle}`,
      )
      await njRmCtx.close()
    } finally {
      await njBrowser.close()
    }
  }
