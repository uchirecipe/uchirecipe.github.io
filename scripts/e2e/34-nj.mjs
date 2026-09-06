// ==========================================================================================
// 便NJ（2026-09-06）: 日タブの実機フィードバック（切り替えの控えめ化・ルーレット演出）
// この中の節: NJSWITCH-01, NJROLL-01
//
// オーナー原文「1品と献立の切り替えスイッチが縦に大きいので、ランダムボタンよりも
// 目立ってる気がする。」「おまかせ表示は、レシピを表示する時の変化が味気ない。
// ルーレットしてる表現の動きってつけられる？重くならないくらいの、0.2、0.3秒くらいで。」
//
// 測ること:
//  NJSWITCH-01 1品/献立の切り替えは「決めてもらう」ボタンより低い（主役の上下関係）。
//              どちらへ切り替えても、切り替え自身も決めてもらうボタンも1pxも動かない
//              （便HT・便IAの「押しても画面が動かない」規律のまま）
//  NJROLL-01   決めてもらうボタンを押すとルーレットの覆い（day-suggest-rolling）が出て、
//              着地後は覆いが消え、出ている料理名が実装と同じ候補づくり
//              （logic/homeSuggest.ts の suggestionCandidates・同じ季節）の中の品で、
//              読み直しても変わらない（＝回りっぱなしにならない）。
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
      const nsOne = await nsBox('day-mode-one')
      const nsPlan = await nsBox('day-mode-plan')
      const nsDraw = await nsBox('day-suggest-draw')
      check(
        'NJSWITCH-01 前提: 切り替え2つと決めてもらうボタンの位置を読めた',
        nsOne != null && nsPlan != null && nsDraw != null,
        `1品=${JSON.stringify(nsOne)} 献立=${JSON.stringify(nsPlan)} ボタン=${JSON.stringify(nsDraw)}`,
      )
      if (nsOne != null && nsPlan != null && nsDraw != null) {
        check(
          'NJSWITCH-01 切り替えは決めてもらうボタンより低い（目立つのはボタンの側）',
          nsOne.h < nsDraw.h && nsPlan.h < nsDraw.h,
          `1品=${nsOne.h}px 献立=${nsPlan.h}px ボタン=${nsDraw.h}px`,
        )
        check(
          'NJSWITCH-01 切り替え2つは同じ高さ（選ばれている側だけ大きくならない）',
          nsOne.h === nsPlan.h,
          `1品=${nsOne.h}px 献立=${nsPlan.h}px`,
        )
        // どちらへ切り替えても、切り替え自身も決めてもらうボタンも動かない
        // （出た結果の品数（1品=1枚/献立=2枚）はボタンより下なので、上は動かないのが正）
        await nsPage.locator('[data-testid="day-mode-one"]').click()
        await nsPage.waitForTimeout(800)
        const nsOneAfter = await nsBox('day-mode-one')
        const nsDrawAfter = await nsBox('day-suggest-draw')
        await nsPage.locator('[data-testid="day-mode-plan"]').click()
        await nsPage.waitForTimeout(800)
        const nsDrawBack = await nsBox('day-suggest-draw')
        check(
          'NJSWITCH-01 切り替えを押しても、切り替えと決めてもらうボタンは1pxも動かない',
          nsOneAfter != null &&
            nsDrawAfter != null &&
            nsDrawBack != null &&
            nsOneAfter.y === nsOne.y &&
            nsOneAfter.h === nsOne.h &&
            nsDrawAfter.y === nsDraw.y &&
            nsDrawBack.y === nsDraw.y,
          `前=${JSON.stringify({ one: nsOne, draw: nsDraw })} 1品後=${JSON.stringify({ one: nsOneAfter, draw: nsDrawAfter })} 献立後=${JSON.stringify(nsDrawBack)}`,
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
