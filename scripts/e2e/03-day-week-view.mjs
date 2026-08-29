// ==========================================================================================
// e2e の節: 献立の「日」と「週」の見た目と操作
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
// この中の節: DAYSWIPE-01, CARDSMALL-01, WEEKOPEN-01, FOLDFIG-01, BACKCLOSE-01, TAP-44, TODAYSYNC-01, WEEKUI-01, WEEKUI-DT
// ==========================================================================================
import './_shared.mjs'


  // --- DAYSWIPE-01: 今日の献立の行を**左へ払う**と右から「外す」が出て、**押して初めて**外れる
  // (2026-08-21 便IQ)。オーナー原文「横にスワイプして消せるのが楽なんですけどね。」
  //
  // オーナーが実機で確かめた事実: 献立の行を**左端から右へ**払うと「ChromeでもSafariでも戻ります」
  // ＝端からの戻るジェスチャーはWebページ側では検知も無効化もできない。そこで**向きと起点を変える**。
  //   ブラウザが取るのは「左端から右へ」／こちらが使うのは「行の途中から左へ」＝ぶつからない。
  //
  // 見張るのは、壊れると黙って困る5つ:
  //   ①払うとボタンが出る(整理モードに入らずに外せる＝「楽」の中身) ②払い切っただけでは外れない
  //   ③起点が左端30px以内の払いには反応しない(ブラウザの「戻る」に譲る)
  //   ④縦の指を奪わない(一覧のスクロールが効く。いちばん壊れやすい)
  //   ⑤開くのは1行だけ・他を触ると閉じる・画面を離れて戻ると閉じている
  // あわせて、外したあと「元に戻す」で戻ること、払う以外の道(整理モードの×)が残っていることも見る。
  //
  // 指の動きは2通りで作る。**本物のマウス**(pointerdown/move/upが実際に流れる経路)で開くところまでを
  // measure し、起点や向きを細かく変える検査は**その行の上でPointerEventを組み立てて**測る
  // （画面の左端30px以内には行そのものが無い＝本物の指では起点を左端にできないため。
  //   行は左端x=33pxから始まる・2026-08-21 便IPの実測）。
  // 縦のスクロールだけは本物の指でないと意味がないので、CDPの touch で払う。
  // 掴み方は data-testid と読み上げの名前(aria-label)だけ＝並び順・入れ子の段数に依らない(禁じ手④) ---
  currentCheck = 'DAYSWIPE-01'
  {
    const dsBrowser = await chromium.launch()
    const dsContext = await dsBrowser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    })
    // 指で触れる入れ物にすると「ホーム画面に追加」の案内が出る条件（指の操作・ホバーなし）に
    // 当たるので、見た記録を先に入れておく（この節が測るのは払いの動きで、案内は GE-01/HS-01 の担当）
    await dsContext.addInitScript(() => {
      try {
        localStorage.setItem('uchirecipe:homeScreenNoticeSeen', '1')
      } catch {
        // ストレージを使えない入れ物では何もしない
      }
    })
    const dsPage = await dsContext.newPage()
    dsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DAYSWIPE-01] ${err.message}`)
    })
    const dsCdp = await dsContext.newCDPSession(dsPage)
    const dsRead = (table) =>
      dsPage.evaluate(
        (name) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const store = req.result.transaction(name, 'readonly').objectStore(name)
              const q = store.getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
        table,
      )
    /**
     * その料理の行の実寸。**掴む前に画面の中へ入れてから**測る（今日の献立は画面の下のほうにあり、
     * 画面の外の座標に指を置いても何も起きない）。見つからなければ null を返し、
     * 「見つからなかった＝合格」に倒れないよう呼び出し側で必ず見る。
     */
    const dsRowBox = async (title, { scroll = true } = {}) => {
      const box = await dsPage.evaluate(
        ({ t, scroll }) => {
          const clean = (s) => (s ?? '').replaceAll('​', '')
          const row = [...document.querySelectorAll('[data-testid="day-swipe-row"]')].find((el) =>
            clean(el.innerText).includes(t),
          )
          if (!row) return null
          if (scroll) row.scrollIntoView({ block: 'center' })
          const b = row.getBoundingClientRect()
          return { x: b.x, y: b.y, w: b.width, h: b.height }
        },
        { t: title, scroll },
      )
      if (box && scroll) await dsPage.waitForTimeout(200)
      return box
    }
    /** 開いている「外す」を閉じる（行の外を触ったのと同じ合図を送る。画面は動かさない） */
    const dsCloseSwipe = async () => {
      await dsPage.evaluate(() =>
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })),
      )
      await dsPage.waitForTimeout(250)
    }
    /** その料理の行に「外す」が出ているか */
    const dsRowOpen = (title) =>
      dsPage.evaluate((t) => {
        const clean = (s) => (s ?? '').replaceAll('​', '')
        const row = [...document.querySelectorAll('[data-testid="day-swipe-row"]')].find((el) =>
          clean(el.innerText).includes(t),
        )
        if (!row) return 'row-not-found'
        return !!row.querySelector('[data-testid="day-swipe-remove"]')
      }, title)
    /**
     * その行の上で指の動きを組み立てる。startX を渡すと**起点だけ**を好きな位置にできる
     * （画面の左端30px以内には行が無いので、本物の指では作れない起点を測るために使う）。
     */
    const dsGesture = (title, { startX, dx = -120, dy = 0, steps = 6, release = true } = {}) =>
      dsPage.evaluate(
        ({ t, startX, dx, dy, steps, release }) => {
          const clean = (s) => (s ?? '').replaceAll('​', '')
          const row = [...document.querySelectorAll('[data-testid="day-swipe-row"]')].find((el) =>
            clean(el.innerText).includes(t),
          )
          if (!row) return 'row-not-found'
          const target = row.querySelector('[data-testid="day-plan-card"]') ?? row.firstElementChild
          if (!target) return 'card-not-found'
          const b = row.getBoundingClientRect()
          const y = b.y + b.height / 2
          const x0 = startX ?? b.x + b.width - 24
          const fire = (type, x, yy) =>
            target.dispatchEvent(
              new PointerEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: yy,
                pointerId: 1,
                pointerType: 'touch',
                isPrimary: true,
                button: 0,
                buttons: 1,
              }),
            )
          fire('pointerdown', x0, y)
          for (let i = 1; i <= steps; i++) {
            fire('pointermove', x0 + (dx * i) / steps, y + (dy * i) / steps)
          }
          if (release) fire('pointerup', x0 + dx, y + dy)
          return 'ok'
        },
        { t: title, startX, dx, dy, steps, release },
      )
    /**
     * 本物のマウスで、その行の途中から左へ払う。
     * **払う直前に測り直す**（前に測った位置は、別の行を測ったときのスクロールでもうずれている）。
     */
    const dsMouseSwipeLeft = async (title) => {
      const box = await dsRowBox(title)
      if (!box) return false
      const y = box.y + box.h / 2
      const startX = box.x + box.w - 24
      await dsPage.mouse.move(startX, y)
      await dsPage.mouse.down()
      await dsPage.mouse.move(startX - 130, y, { steps: 12 })
      await dsPage.mouse.up()
      await dsPage.waitForTimeout(350)
      return true
    }
    /**
     * 本物の指で払う（CDPのtouch）。縦のスクロールをブラウザに残せているかは、
     * マウスでは測れない（touch-actionは指の操作にしか効かない）。
     */
    const dsTouchDrag = async (x, y, dx, dy, steps = 10) => {
      await dsCdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
      for (let i = 1; i <= steps; i++) {
        await dsCdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [{ x: x + (dx * i) / steps, y: y + (dy * i) / steps }],
        })
        await dsPage.waitForTimeout(16)
      }
      await dsCdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      await dsPage.waitForTimeout(450)
    }
    const dsTouchPan = (x, y, dy) => dsTouchDrag(x, y, 0, dy)
    const dsPlannedButton = () =>
      dsPage.locator(`button[aria-label="${ja.mealPlan.todayPlannedRemove}"]`)
    const dsPickedButton = () => dsPage.locator(`button[aria-label="${ja.mealPlan.todayRemove}"]`)
    const dsPlanned = '肉じゃが'
    const dsPicked = 'ほうれん草のおひたし'
    try {
      // ①今週の献立の予定に入る品(夕食) ②レシピ一覧から選択中に入る品(食事を決めずに追加)
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(1800) // 初回シード完了待ち
      await dsPage.getByText(dsPlanned, { exact: true }).first().click()
      await dsPage.waitForTimeout(500)
      await dsPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await dsPage.waitForTimeout(300)
      await slotBtnExceptFill(dsPage, ja.mealPlan.slot.dinner).click()
      await dsPage.waitForTimeout(600)
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(900)
      await dsPage.getByText(dsPicked, { exact: true }).first().click()
      await dsPage.waitForTimeout(500)
      await dsPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await dsPage.waitForTimeout(300)
      await dsPage
        .getByRole('button', { name: ja.detail.todaySlotUndecided })
        .click()
      await dsPage.waitForTimeout(600)

      await dsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(1800)
      /** 献立の画面のURL。払った行を押してもここから動かないことを後で見る */
      const dsUrlBefore = dsPage.url()

      // ---------- 前提 ----------
      const dsBefore = { today: await dsRead('todayList'), plans: await dsRead('mealPlans') }
      check(
        'DAYSWIPE-01 前提: 今日の献立2件・今週の予定1件が端末に入っている',
        dsBefore.today.length === 2 && dsBefore.plans.length === 1,
        `today=${dsBefore.today.length} plans=${dsBefore.plans.length}`,
      )
      const dsPlannedBox0 = await dsRowBox(dsPlanned)
      const dsPickedBox0 = await dsRowBox(dsPicked)
      check(
        'DAYSWIPE-01 前提: 今日の献立の2品とも、払える行として並んでいる',
        !!dsPlannedBox0 && !!dsPickedBox0,
        `${dsPlanned}=${JSON.stringify(dsPlannedBox0)} ${dsPicked}=${JSON.stringify(dsPickedBox0)}`,
      )
      check(
        'DAYSWIPE-01 前提: 払う前は「外す」が1つも出ていない（整理モードにも入っていない）',
        (await dsPlannedButton().count()) === 0 && (await dsPickedButton().count()) === 0,
        `今週の予定=${await dsPlannedButton().count()} 選択中=${await dsPickedButton().count()}`,
      )

      // ---------- ① 行の途中から左へ払うと「外す」が出る（本物のマウスで） ----------
      await dsMouseSwipeLeft(dsPlanned)
      check(
        'DAYSWIPE-01(①) 整理モードに入らなくても、行を左へ払うと「外す」が出る',
        (await dsRowOpen(dsPlanned)) === true,
        `開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      const dsActionBox = (await dsPlannedButton().count()) === 1
        ? await dsPlannedButton().boundingBox()
        : null
      check(
        'DAYSWIPE-01(①) 出た「外す」は1つだけで、指で押せる大きさ（44px以上）',
        (await dsPlannedButton().count()) === 1 &&
          !!dsActionBox &&
          dsActionBox.height >= 44 &&
          dsActionBox.width >= 44,
        `数=${await dsPlannedButton().count()} 大きさ=${JSON.stringify(dsActionBox)}`,
      )
      // 出ていないときに textContent を待つと30秒の中断になるので、必ず数を見てから読む
      const dsActionText =
        (await dsPlannedButton().count()) === 1
          ? ((await dsPlannedButton().first().textContent()) ?? '').replaceAll('​', '').trim()
          : '(出ていない)'
      check(
        'DAYSWIPE-01(①) 出たボタンの字は「外す」',
        dsActionText === ja.mealPlan.todaySwipeRemove,
        `字=${dsActionText}`,
      )

      // ---------- ② 払い切っただけでは外れない ----------
      const dsAfterSwipe = { today: await dsRead('todayList'), plans: await dsRead('mealPlans') }
      // 「開いている」ことも一緒に見る＝払えていないだけの状態を合格にしない
      check(
        'DAYSWIPE-01(②) 払い切って「外す」が出ても、まだ1件も外れていない（押して初めて外れる）',
        (await dsRowOpen(dsPlanned)) === true &&
          dsAfterSwipe.today.length === 2 &&
          dsAfterSwipe.plans.length === 1,
        `開いたか=${await dsRowOpen(dsPlanned)} today=${dsAfterSwipe.today.length} plans=${dsAfterSwipe.plans.length}`,
      )

      // ---------- ⑤ 開くのは1行だけ / 他の行を触ると閉じる ----------
      await dsMouseSwipeLeft(dsPicked)
      check(
        'DAYSWIPE-01(⑤) 別の行を払うと、前に開いていた行は閉じる（開くのは1行だけ）',
        (await dsRowOpen(dsPicked)) === true && (await dsRowOpen(dsPlanned)) === false,
        `選択中=${await dsRowOpen(dsPicked)} 今週の予定=${await dsRowOpen(dsPlanned)}`,
      )
      check(
        'DAYSWIPE-01(読み上げ) 「レシピ一覧から選択中」の行の「外す」は、外れる範囲が名前で分かる',
        (await dsPickedButton().count()) === 1 && (await dsPlannedButton().count()) === 0,
        `選択中=${await dsPickedButton().count()} 今週の予定=${await dsPlannedButton().count()}`,
      )
      // 開いている行の外（別の行のカード）を触ったら閉じる。
      // このタップは「閉じる」だけに使い、その下のレシピを開かない
      const dsPlannedBox1 = await dsRowBox(dsPlanned)
      if (dsPlannedBox1) {
        await dsPage.mouse.click(dsPlannedBox1.x + dsPlannedBox1.w / 2, dsPlannedBox1.y + dsPlannedBox1.h / 2)
        await dsPage.waitForTimeout(400)
      }
      // 閉じるつもりのタップが、その下のレシピを開いてしまわないことも一緒に見る
      check(
        'DAYSWIPE-01(⑤) 他の行を触ると開いていた「外す」は閉じ、そのタップは閉じるだけに使われる',
        (await dsRowOpen(dsPicked)) === false && dsPage.url() === dsUrlBefore,
        `選択中=${await dsRowOpen(dsPicked)} URL=${dsPage.url()}`,
      )

      // ---------- ③ 起点が左端30px以内の払いには反応しない ----------
      // （ブラウザの「戻る」に譲る。行そのものは左端x=33pxから始まるので、
      //   本物の指では作れない起点をこの行の上で組み立てて測る）
      await dsPage.evaluate(() => window.scrollTo(0, 0))
      await dsPage.waitForTimeout(200)
      const dsEdge = await dsGesture(dsPlanned, { startX: 10, dx: -130 })
      await dsPage.waitForTimeout(350)
      check(
        'DAYSWIPE-01(③) 起点が左端30px以内の払いには反応しない（ブラウザの「戻る」に譲る）',
        dsEdge === 'ok' && (await dsRowOpen(dsPlanned)) === false,
        `組み立て=${dsEdge} 開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      // 同じ払いでも、起点が左端の外なら開く＝「反応しないのは起点のせい」だと言い切れる
      const dsInside = await dsGesture(dsPlanned, { startX: 200, dx: -130 })
      await dsPage.waitForTimeout(350)
      check(
        'DAYSWIPE-01(③) 起点が左端の外なら、同じ払いで開く（開かない理由が起点であることの裏取り）',
        dsInside === 'ok' && (await dsRowOpen(dsPlanned)) === true,
        `組み立て=${dsInside} 開いたか=${await dsRowOpen(dsPlanned)}`,
      )

      // ---------- ④ 縦の指を奪わない ----------
      check(
        'DAYSWIPE-01(④) 縦のスクロールはブラウザが受け持つ（行に touch-action の pan-y が敷いてある）',
        await dsPage.evaluate(() => {
          const row = document.querySelector('[data-testid="day-swipe-row"]')
          const slider = row?.lastElementChild
          return slider ? getComputedStyle(slider).touchAction.includes('pan-y') : false
        }),
        true,
      )
      // 縦に動かす指では開かない（先に閉じてから測る）
      await dsCloseSwipe()
      const dsVertical = await dsGesture(dsPlanned, { startX: 200, dx: -40, dy: 140 })
      await dsPage.waitForTimeout(350)
      check(
        'DAYSWIPE-01(④) 縦のほうが大きい指では「外す」が出ない（一覧をめくる指を奪わない）',
        dsVertical === 'ok' && (await dsRowOpen(dsPlanned)) === false,
        `組み立て=${dsVertical} 開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      // 本物の指で、行の上から縦に払ってページが動くこと。
      // いちばん上まで戻してから測る＝下へ動かせる余地をいちばん大きく取る
      // （画面の中へ入れ直すと、行が下のほうにあるぶんだけ余地が減る）
      await dsCloseSwipe()
      await dsPage.evaluate(() => window.scrollTo(0, 0))
      await dsPage.waitForTimeout(300)
      const dsRowForPan = await dsRowBox(dsPlanned, { scroll: false })
      const dsScrollRoom = await dsPage.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY,
      )
      const dsRowOnScreen =
        !!dsRowForPan && dsRowForPan.y > 0 && dsRowForPan.y + dsRowForPan.h < 844
      let dsScrollAfter = 0
      if (dsRowOnScreen) {
        await dsTouchPan(dsRowForPan.x + dsRowForPan.w / 2, dsRowForPan.y + dsRowForPan.h / 2, -200)
        dsScrollAfter = await dsPage.evaluate(() => window.scrollY)
      }
      check(
        'DAYSWIPE-01(④) 行の上から縦に払うと、一覧がちゃんとスクロールする',
        dsRowOnScreen && dsScrollRoom > 100 && dsScrollAfter > 0,
        `行が画面の中にあるか=${dsRowOnScreen} まだ下がれる量=${dsScrollRoom} 払った後=${dsScrollAfter}`,
      )
      check(
        'DAYSWIPE-01(④) 縦に払っただけでは「外す」は出ない',
        (await dsRowOpen(dsPlanned)) === false,
        `開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      // 本物の指で**横に**払っても開く。普段使うのは指なので、ここが緑でないと機能そのものが
      // 届いていない（マウスだけで見ていると、縦に譲る設定を変えたときに気づけない）
      await dsCloseSwipe()
      const dsTouchRow = await dsRowBox(dsPlanned)
      if (dsTouchRow) {
        await dsTouchDrag(dsTouchRow.x + dsTouchRow.w - 24, dsTouchRow.y + dsTouchRow.h / 2, -130, 0, 12)
      }
      check(
        'DAYSWIPE-01(①) 本物の指で左へ払っても「外す」が出る（普段使うのは指）',
        !!dsTouchRow && (await dsRowOpen(dsPlanned)) === true && dsPage.url() === dsUrlBefore,
        `開いたか=${await dsRowOpen(dsPlanned)} URL=${dsPage.url()}`,
      )

      // ---------- ⑤ 開いた行を押しても、レシピ詳細へ飛ばない（閉じるだけ） ----------
      await dsPage.evaluate(() => window.scrollTo(0, 0))
      await dsPage.waitForTimeout(300)
      await dsMouseSwipeLeft(dsPlanned)
      const dsBox3 = await dsRowBox(dsPlanned)
      if (dsBox3) {
        await dsPage.mouse.click(dsBox3.x + 60, dsBox3.y + dsBox3.h / 2)
        await dsPage.waitForTimeout(500)
      }
      check(
        'DAYSWIPE-01(⑤) 開いている行そのものを押しても、レシピ詳細へは行かず閉じるだけ',
        dsPage.url() === dsUrlBefore && (await dsRowOpen(dsPlanned)) === false,
        `URL=${dsPage.url()} 開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      // ここが落ちるとレシピ詳細に居るので、献立の画面へ戻す
      // （1つの赤が、この先の全部を「画面が違う」だけの赤に化けさせないため）
      if (!dsPage.url().includes('/meal-plan')) {
        await dsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await dsPage.waitForTimeout(1200)
      }

      // ---------- ⑤ 画面を離れて戻ったら閉じている ----------
      await dsMouseSwipeLeft(dsPlanned)
      check(
        'DAYSWIPE-01(⑤) 前提: 画面を離れる前は開いている',
        (await dsRowOpen(dsPlanned)) === true,
        `開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      await dsPage.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
      await dsPage.waitForTimeout(300)
      check(
        'DAYSWIPE-01(⑤) 画面を離れる合図で閉じる（別のアプリから戻ったとき、最初の1タップを奪わない）',
        (await dsRowOpen(dsPlanned)) === false,
        `開いたか=${await dsRowOpen(dsPlanned)}`,
      )
      await dsMouseSwipeLeft(dsPlanned)
      const dsTab = async (name) => {
        const tab = dsPage.getByRole('button', { name, exact: true })
        if ((await tab.count()) === 0) return false
        await tab.first().click()
        await dsPage.waitForTimeout(900)
        return true
      }
      await dsTab(ja.mealPlan.viewWeek)
      await dsTab(ja.mealPlan.viewDay)
      check(
        'DAYSWIPE-01(⑤) 「週」へ移って「日」へ戻ると、払った行は閉じている',
        (await dsRowOpen(dsPlanned)) === false,
        `開いたか=${await dsRowOpen(dsPlanned)}`,
      )

      // ---------- ⑥ 押して初めて外れる → 「元に戻す」で戻る ----------
      await dsPage.evaluate(() => window.scrollTo(0, 0))
      await dsPage.waitForTimeout(300)
      await dsMouseSwipeLeft(dsPlanned)
      if ((await dsPlannedButton().count()) === 1) {
        await dsPlannedButton().first().click()
        await dsPage.waitForTimeout(900)
      }
      const dsAfter = { today: await dsRead('todayList'), plans: await dsRead('mealPlans') }
      check(
        'DAYSWIPE-01(⑥) 「外す」を押すと、今日と今週の献立の両方から外れる（×と同じ中身）',
        dsAfter.today.length === 1 && dsAfter.plans.length === 0,
        `today=${dsAfter.today.length} plans=${dsAfter.plans.length}`,
      )
      const dsUndo = dsPage.getByRole('button', { name: ja.common.undo, exact: true })
      check(
        'DAYSWIPE-01(⑥) 外した直後のお知らせに「元に戻す」が出る',
        (await dsUndo.count()) === 1,
        `元に戻す=${await dsUndo.count()}`,
      )
      if ((await dsUndo.count()) === 1) {
        await dsUndo.click()
        await dsPage.waitForTimeout(1000)
        const dsUndone = { today: await dsRead('todayList'), plans: await dsRead('mealPlans') }
        check(
          'DAYSWIPE-01(⑥) 「元に戻す」で今日の献立にも今週の予定にも戻る',
          dsUndone.today.length === 2 &&
            dsUndone.plans.length === 1 &&
            dsUndone.plans[0].date === dsBefore.plans[0].date &&
            dsUndone.plans[0].slot === dsBefore.plans[0].slot &&
            dsUndone.plans[0].recipeId === dsBefore.plans[0].recipeId,
          `today=${dsUndone.today.length} plans=${JSON.stringify(dsUndone.plans)}`,
        )
      }

      // ---------- 払う操作しか無い形にしない（キーボード・読み上げの道を残す） ----------
      await dsPage.waitForTimeout(600)
      const dsOrganize = dsPage.getByRole('button', {
        name: ja.mealPlan.todayOrganizeToggle,
        exact: true,
      })
      check(
        'DAYSWIPE-01(道を残す) 払わなくても外せる道（整理モードの入口）が残っている',
        (await dsOrganize.count()) === 1,
        `整理=${await dsOrganize.count()}`,
      )
      if ((await dsOrganize.count()) === 1) {
        await dsOrganize.click()
        await dsPage.waitForTimeout(600)
        check(
          'DAYSWIPE-01(道を残す) 整理モードに入れば、払わずに×から外せる',
          (await dsPlannedButton().count()) === 1 && (await dsPickedButton().count()) === 1,
          `今週の予定=${await dsPlannedButton().count()} 選択中=${await dsPickedButton().count()}`,
        )
      }
    } finally {
      await dsBrowser.close()
    }
  }

  // --- CARDSMALL-01: 「小」のカードに写真があっても、絵が入れ物いっぱいに膨らまない
  // (2026-08-20 便IG・⑫。オーナー実機報告「月の日の窓を開くと、作った記録の写真が窓いっぱいに
  // 縦長で表示され、料理名が出ていない」)。
  // 原因は入れ物の形ではなく、絵の枠が「高さ100%」で組まれていたこと＝親の高さが中身で決まる
  // 場所では高さが決まらず、中の<img>が元の大きさ(600px等)のまま並んで、正方形の一辺が
  // その大きさになっていた。月の日の窓だけの話ではないので、**同じ「小」のカードを使う
  // 週タブの過ぎた日**でも同じことを測る(片方だけ直して片方が残るのを防ぐ)。
  // 測るのは見た目のクラス名ではなく**実際の大きさ**(行・絵・料理名の箱)。
  // 読み取れなかったときは error を返して必ず落ちる(「見つからなかった＝合格」に倒れない) ---
  currentCheck = 'CARDSMALL-01'
  {
    const csBrowser = await chromium.launch()
    const csContext = await csBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const csPage = await csContext.newPage()
    csPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@CARDSMALL-01] ${err.message}`)
    })
    const pad2 = (n) => String(n).padStart(2, '0')
    const csDay = (offset) => {
      const d = new Date()
      d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    }
    const csToday = csDay(0)
    const csPast = csDay(-1)
    /** その行の「行・絵・料理名」の実寸を返す。読めなければ error を返す(必ず落ちる形) */
    const csMeasure = (rootSel, title) =>
      csPage.evaluate(
        ({ rootSel, title }) => {
          const clean = (s) => (s ?? '').replaceAll('​', '')
          const root = document.querySelector(rootSel)
          if (!root) return { error: `土台が見つからない(${rootSel})` }
          const li = [...root.querySelectorAll('li')].find((el) =>
            clean(el.innerText).includes(title),
          )
          if (!li) return { error: `「${title}」の行が見つからない` }
          const img = li.querySelector('img')
          if (!img) return { error: '記録の写真が見つからない' }
          const titleEl = [...li.querySelectorAll('*')]
            .filter((el) => el.children.length === 0)
            .find((el) => clean(el.textContent).trim() === title)
          if (!titleEl) return { error: '料理名の箱が見つからない' }
          const r = (el) => {
            const b = el.getBoundingClientRect()
            return { w: Math.round(b.width), h: Math.round(b.height) }
          }
          return { row: r(li), img: r(img), title: r(titleEl) }
        },
        { rootSel, title },
      )
    const csCheckCard = (where, m) => {
      check(
        `CARDSMALL-01(⑫) ${where}: 窓の中の記録に料理名が出ている(幅が潰れていない)`,
        !m.error && m.title.w >= 80,
        `計測=${JSON.stringify(m)}`,
      )
      check(
        `CARDSMALL-01(⑫) ${where}: 絵が行からはみ出していない(縦にも横にも行の中に収まる)`,
        !m.error && m.img.w <= m.row.w && m.img.h <= m.row.h,
        `計測=${JSON.stringify(m)}`,
      )
      check(
        `CARDSMALL-01(⑫) ${where}: 行の高さが「小」のまま(1行ぶん・96px以下)`,
        !m.error && m.row.h <= 96,
        `計測=${JSON.stringify(m)}`,
      )
      check(
        `CARDSMALL-01(⑫) ${where}: 絵は押せる大きさ(44px)以上の正方形`,
        !m.error && m.img.h >= 44 && Math.abs(m.img.w - m.img.h) <= 2,
        `計測=${JSON.stringify(m)}`,
      )
    }
    try {
      await csPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await csPage.waitForTimeout(1800) // 初回シード完了待ち
      // Pro解錠(月タブを開くため)＋今日と昨日に「縦長の写真つきの作った記録」を仕込む。
      // 写真の元の大きさ(600×900)が、そのまま画面の大きさに化けていたのが⑫の中身
      await csPage.evaluate(
        async ({ today, past }) => {
          const photo = await new Promise((resolve) => {
            const c = document.createElement('canvas')
            c.width = 600
            c.height = 900
            const ctx = c.getContext('2d')
            ctx.fillStyle = '#c60'
            ctx.fillRect(0, 0, 600, 900)
            c.toBlob((b) => resolve(b), 'image/jpeg', 0.8)
          })
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          await new Promise((res, rej) => {
            const tx = idb.transaction(['settings', 'recipes'], 'readwrite')
            const s = tx.objectStore('settings')
            const g = s.get(1)
            g.onsuccess = () =>
              s.put({
                ...(g.result || { id: 1 }),
                id: 1,
                proCode: 'UR-E2E-TEST-ONLY',
                proActivatedAt: Date.now(),
              })
            const rs = tx.objectStore('recipes')
            const all = rs.getAll()
            all.onsuccess = () => {
              const r = all.result.find((x) => x.title === '肉じゃが')
              if (r) {
                r.cookedLogs = [
                  { date: today, servings: 2, photo },
                  { date: past, servings: 2, photo },
                ]
                rs.put(r)
              }
            }
            tx.oncomplete = () => res()
            tx.onerror = () => rej(tx.error)
          })
          idb.close()
        },
        { today: csToday, past: csPast },
      )
      await csPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await csPage.reload({ waitUntil: 'networkidle' })
      await csPage.waitForTimeout(1500)

      // ---------- (a) 月タブ: 日の窓 ----------
      await csPage.getByRole('button', { name: '月', exact: true }).click()
      await csPage.waitForTimeout(900)
      const csCell = csPage.locator(`button[data-date="${csToday}"]`)
      check('CARDSMALL-01 前提: 月のカレンダーに今日のマスがある', (await csCell.count()) === 1)
      await csCell.click()
      await csPage.waitForTimeout(900)
      check(
        'CARDSMALL-01 前提: 日の窓が開き、作った記録が並んでいる',
        (await csPage.locator('[role="dialog"]').count()) === 1 &&
          ((await csPage.locator('[role="dialog"]').innerText()) ?? '').includes('肉じゃが'),
      )
      csCheckCard('月の日の窓', await csMeasure('[role="dialog"]', '肉じゃが'))
      await csPage.keyboard.press('Escape')
      await csPage.waitForTimeout(500)

      // ---------- (b) 週タブ: 過ぎた日のカード(同じ「小」のカードを使う場所) ----------
      await csPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await csPage.waitForTimeout(700)
      // 昨日のカードが出る週まで送る(前へも後ろへも送れる形。曜日・月替わりに依らない)
      for (let i = 0; i < 3; i++) {
        if ((await csPage.locator(`section[data-date="${csPast}"]`).count()) > 0) break
        await csPage.getByRole('button', { name: ja.mealPlan.prevWeek, exact: true }).click()
        await csPage.waitForTimeout(600)
      }
      const csPastSection = csPage.locator(`section[data-date="${csPast}"]`)
      check(
        'CARDSMALL-01 前提: 週タブに昨日のカードが出ている',
        (await csPastSection.count()) === 1,
      )
      if ((await csPastSection.count()) === 1) {
        const csFold = csPastSection.locator('[data-testid="week-day-toggle"]')
        if ((await csFold.getAttribute('aria-expanded')) === 'false') {
          await csFold.click()
          await csPage.waitForTimeout(600)
        }
        csCheckCard('週タブの過ぎた日', await csMeasure(`section[data-date="${csPast}"]`, '肉じゃが'))
      }
    } finally {
      await csBrowser.close()
    }
  }

  // --- WEEKOPEN-01: 月の日の窓から「この週を開く」で着いた週は、記録のある日が開いていて、
  // 選んだ日付まで送られている(2026-08-20 便IG・⑩。オーナー原文「月から「この週を開く」した
  // ときは、記録がある日は開いた状態、選んだ日付までスクロールして表示。」)。
  // 便ID・⑦の既定(過ぎた日は畳む)とぶつかるので、**月から来たときだけの上書き**として作った。
  // 曜日にも月替わりにも依らない形にする: 目当ての日のマスが今の月に無ければ前の月へ送る ---
  currentCheck = 'WEEKOPEN-01'
  {
    const woBrowser = await chromium.launch()
    const woContext = await woBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const woPage = await woContext.newPage()
    woPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKOPEN-01] ${err.message}`)
    })
    const woPad = (n) => String(n).padStart(2, '0')
    const woDate = (offset) => {
      const d = new Date()
      d.setDate(d.getDate() + offset)
      return `${d.getFullYear()}-${woPad(d.getMonth() + 1)}-${woPad(d.getDate())}`
    }
    const woTarget = woDate(-1)
    try {
      await woPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await woPage.waitForTimeout(1800)
      await woPage.evaluate(async (date) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result)
          req.onerror = () => rej(req.error)
        })
        await new Promise((res, rej) => {
          const tx = idb.transaction(['settings', 'recipes'], 'readwrite')
          const s = tx.objectStore('settings')
          const g = s.get(1)
          g.onsuccess = () =>
            s.put({
              ...(g.result || { id: 1 }),
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
          const rs = tx.objectStore('recipes')
          const all = rs.getAll()
          all.onsuccess = () => {
            const r = all.result.find((x) => x.title === '肉じゃが')
            if (r) {
              r.cookedLogs = [{ date, servings: 2 }]
              rs.put(r)
            }
          }
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
        idb.close()
      }, woTarget)
      await woPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await woPage.reload({ waitUntil: 'networkidle' })
      await woPage.waitForTimeout(1500)
      await woPage.getByRole('button', { name: '月', exact: true }).click()
      await woPage.waitForTimeout(900)
      for (let i = 0; i < 2; i++) {
        if ((await woPage.locator(`button[data-date="${woTarget}"]`).count()) > 0) break
        await woPage.getByRole('button', { name: ja.mealPlan.prevMonth, exact: true }).click()
        await woPage.waitForTimeout(700)
      }
      const woCell = woPage.locator(`button[data-date="${woTarget}"]`)
      check('WEEKOPEN-01 前提: 記録のある日のマスが月のカレンダーにある', (await woCell.count()) === 1)
      if ((await woCell.count()) === 1) {
        await woCell.click()
        await woPage.waitForTimeout(800)
        const woOpenWeek = woPage.getByRole('button', {
          name: ja.mealPlan.monthDayModalOpenWeek,
          exact: true,
        })
        check('WEEKOPEN-01 前提: 日の窓に「この週を開く」がある', (await woOpenWeek.count()) === 1)
        await woOpenWeek.click()
        await woPage.waitForTimeout(1600)
        check(
          'WEEKOPEN-01 「この週を開く」で週タブに移る',
          (await woPage
            .getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
            .getAttribute('aria-pressed')) === 'true',
        )
        const woSection = woPage.locator(`section[data-date="${woTarget}"]`)
        check(
          'WEEKOPEN-01 前提: 選んだ日のカードが週に出ている',
          (await woSection.count()) === 1,
        )
        if ((await woSection.count()) === 1) {
          check(
            'WEEKOPEN-01(⑩) 記録がある日は開いた状態で着く(過ぎた日を畳む既定を上書きする)',
            (await woSection
              .locator('[data-testid="week-day-toggle"]')
              .getAttribute('aria-expanded')) === 'true',
          )
          check(
            'WEEKOPEN-01(⑩) 開いた中身に、その日の作った記録が見えている',
            ((await woSection.innerText()) ?? '').replaceAll('​', '').includes('肉じゃが'),
          )
          const woPos = await woPage.evaluate((date) => {
            const el = document.querySelector(`section[data-date="${date}"]`)
            const all = [...document.querySelectorAll('section[data-date]')].map(
              (s) => s.dataset.date,
            )
            return {
              top: el ? Math.round(el.getBoundingClientRect().top) : null,
              index: all.indexOf(date),
              scrollY: Math.round(window.scrollY),
            }
          }, woTarget)
          check(
            'WEEKOPEN-01(⑩) 選んだ日付が画面の上端まで送られている',
            woPos.top !== null && woPos.top >= -4 && woPos.top <= 120,
            `位置=${JSON.stringify(woPos)}`,
          )
          check(
            'WEEKOPEN-01(⑩) 先頭の日でなければ、実際に画面が下へ送られている',
            woPos.index === 0 ? true : woPos.scrollY > 0,
            `位置=${JSON.stringify(woPos)}`,
          )
        }
      }
    } finally {
      await woBrowser.close()
    }
  }

  // --- FOLDFIG-01: 畳んだ月の食費・栄養カードの数値は、見出しの横に1行で出る
  // (2026-08-20 便IG・⑬。オーナー原文「◯月の食費・栄養の折りたたみで表示される数値は、
  // ◯月の食費（栄養）の横に表示して。縦長にしない。」)。
  // 「縦長にしない」を、見出しの高さ(1行に収まっている)と、畳んだカードに見出し以外の
  // 中身が無いことの2つで測る。390px幅(iPhone 12〜15相当)で見る ---
  currentCheck = 'FOLDFIG-01'
  {
    const ffBrowser = await chromium.launch()
    const ffContext = await ffBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ffPage = await ffContext.newPage()
    ffPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FOLDFIG-01] ${err.message}`)
    })
    /** 畳んだカードの見出しと、カード全体の中身を読む(見出しの外に何か残っていないかを見る) */
    const ffCard = (testId) =>
      ffPage.evaluate((id) => {
        const clean = (s) => (s ?? '').replaceAll('​', '')
        const marker = document.querySelector(`[data-testid="${id}"]`)
        if (!marker) return { error: `畳んだときの数値(${id})が見つからない` }
        const section = marker.closest('section')
        const h2 = section?.querySelector('h2')
        if (!section || !h2) return { error: 'カードか見出しが見つからない' }
        return {
          inHeader: h2.contains(marker),
          headerText: clean(h2.innerText).replace(/\n/g, ' '),
          headerH: Math.round(h2.getBoundingClientRect().height),
          headerW: Math.round(h2.getBoundingClientRect().width),
          // 見出しの外に残っている中身(畳んでいるあいだは空であってほしい)
          restText: clean(section.innerText).replace(clean(h2.innerText), '').trim(),
          valueText: clean(marker.innerText).replace(/\n/g, ' '),
        }
      }, testId)
    try {
      await ffPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ffPage.waitForTimeout(1800)
      // Pro解錠＋今日の作った記録を数品ぶん(食費・栄養の合計が桁数の多い数字になるようにする)
      await ffPage.evaluate(async () => {
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => {
          req.onsuccess = () => res(req.result)
          req.onerror = () => rej(req.error)
        })
        await new Promise((res, rej) => {
          const tx = idb.transaction(['settings', 'recipes'], 'readwrite')
          const s = tx.objectStore('settings')
          const g = s.get(1)
          g.onsuccess = () =>
            s.put({
              ...(g.result || { id: 1 }),
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
          const rs = tx.objectStore('recipes')
          const all = rs.getAll()
          all.onsuccess = () => {
            all.result.slice(0, 30).forEach((r) => {
              r.cookedLogs = [{ date, servings: 8 }]
              rs.put(r)
            })
          }
          tx.oncomplete = () => res()
          tx.onerror = () => rej(tx.error)
        })
        idb.close()
      })
      await ffPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ffPage.reload({ waitUntil: 'networkidle' })
      await ffPage.waitForTimeout(1800)
      await ffPage.getByRole('button', { name: '月', exact: true }).click()
      await ffPage.waitForTimeout(1500)

      for (const [label, testId, unitRe] of [
        ['食費', 'month-cost-folded', /[\d,]+円/],
        ['栄養', 'month-nutrition-folded', /[\d,]+\s*kcal/],
      ]) {
        const card = await ffCard(testId)
        check(
          `FOLDFIG-01(⑬) ${label}: 畳んだときの数値が見出しの中に出ている`,
          !card.error && card.inHeader === true && unitRe.test(card.valueText),
          `カード=${JSON.stringify(card)}`,
        )
        check(
          `FOLDFIG-01(⑬) ${label}: 見出しは1行のまま(折り返して縦長になっていない)`,
          !card.error && card.headerH <= 60,
          `カード=${JSON.stringify(card)}`,
        )
        check(
          `FOLDFIG-01(⑬) ${label}: 畳んでいるあいだ、見出しの下には何も出さない`,
          !card.error && card.restText === '',
          `カード=${JSON.stringify(card)}`,
        )
      }

      // 見出しに出す数字は、開いたときの表・パネルと同じ値であること(別々に数え直さない)
      const ffCostValue = (await ffCard('month-cost-folded')).valueText ?? ''
      const ffCostYen = ffCostValue.match(/[\d,]+円/)?.[0] ?? ''
      await ffPage.getByRole('button', { name: jaRe(ja.mealPlan.monthCostTitle, { m: '' }) }).click()
      await ffPage.waitForTimeout(700)
      const ffTable = (await ffPage.locator('[data-testid="month-cost-table"]').count())
        ? ((await ffPage.locator('[data-testid="month-cost-table"]').innerText()) ?? '').replaceAll('​', '')
        : ''
      check(
        'FOLDFIG-01(⑬) 見出しの金額は、開いたときの表と同じ数字',
        !!ffCostYen && ffTable.includes(ffCostYen),
        `見出し=${ffCostValue} 表=${ffTable.replace(/\n/g, ' / ').slice(0, 200)}`,
      )
    } finally {
      await ffBrowser.close()
    }
  }

  // --- BACKCLOSE-01: 窓を開けているあいだの端末の「戻る」は、窓だけを閉じて画面を動かさない
  // (2026-08-18 便HQ・軸3)。自前のEscapeだけの窓は「戻る」が素通りし、
  // 「朝食・昼食・夕食のどれに入れますか？」で戻るとレシピ詳細ごとレシピ一覧へ飛ばされていた
  // (何をしていたか分からなくなる)。共通の仕組み(useOverlayDismiss)へ寄せた窓を代表で見る ---
  currentCheck = 'BACKCLOSE-01'
  {
    const bcBrowser = await chromium.launch()
    const bcContext = await bcBrowser.newContext()
    const bcPage = await bcContext.newPage()
    bcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@BACKCLOSE-01] ${err.message}`)
    })
    try {
      await bcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bcPage.waitForTimeout(1800)
      await bcPage.getByText('肉じゃが', { exact: true }).first().click()
      await bcPage.waitForTimeout(700)
      const bcDetailUrl = bcPage.url()

      // (1) 朝食・昼食・夕食のどれに入れますか？
      await bcPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await bcPage.waitForTimeout(400)
      check(
        'BACKCLOSE-01 前提: 「朝食・昼食・夕食のどれに入れますか？」が開く',
        stripZwspText(await bcPage.textContent('body')).includes(ja.detail.todaySlotDialogTitle),
      )
      await bcPage.goBack()
      await bcPage.waitForTimeout(700)
      check(
        'BACKCLOSE-01 「戻る」で「朝食・昼食・夕食のどれに入れますか？」の窓が閉じる',
        !((await bcPage.textContent('body')) ?? '').includes(ja.detail.todaySlotDialogTitle),
      )
      check(
        'BACKCLOSE-01 「戻る」で画面は動かない(レシピ詳細のまま)',
        bcPage.url() === bcDetailUrl,
        `いま=${bcPage.url()} 期待=${bcDetailUrl}`,
      )

      // (2) 共有の窓(同じ作法に寄せた別の窓でも、結果が同じであることを見る)
      const bcShare = bcPage.locator(`button[aria-label="${ja.share.button}"]`)
      if ((await bcShare.count()) > 0) {
        await bcShare.first().click()
        await bcPage.waitForTimeout(400)
        const bcShareOpen = ((await bcPage.textContent('body')) ?? '').includes('シェアする内容')
        if (bcShareOpen) {
          await bcPage.goBack()
          await bcPage.waitForTimeout(700)
          check(
            'BACKCLOSE-01 「戻る」で共有の窓も、窓だけが閉じて画面は動かない',
            !((await bcPage.textContent('body')) ?? '').includes('シェアする内容') &&
              bcPage.url() === bcDetailUrl,
            `いま=${bcPage.url()}`,
          )
        }
      }
    } finally {
      await bcBrowser.close()
    }
  }

  // --- TAP-44: ×とチェックの丸は、44px四方のどこを押しても「何も起きない場所」が無い
  // (2026-08-18 便HQ・軸7)。同じ役目の×が22px〜48pxの7段階に散っていたので、
  // 共通の器(src/index.css の .tap-target)に全部載せ替えた。
  // ここは**クラス名ではなく実際の当たり判定**で測る: ボタンの中心から上下左右・斜めに21pxの点を
  // 突き、elementFromPoint がそのボタン(かその子)を返すかを見る。隣の押せるものに当たった場合は
  // 2つが隙間なく並んでいる(どちらかには必ず届く)ので死んだ余白ではない＝合格とする。
  // クラス名の総点検は test-logic の HQ-3 が受け持つ(e2eが開かない画面まで1つずつ測る) ---
  currentCheck = 'TAP-44'
  {
    const tpBrowser = await chromium.launch()
    const tpContext = await tpBrowser.newContext()
    const tpPage = await tpContext.newPage()
    tpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TAP-44] ${err.message}`)
    })
    const tapProbe = () =>
      tpPage.evaluate(() => {
        const targets = []
        const seen = new Set()
        const push = (el, why) => {
          if (el && !seen.has(el)) {
            seen.add(el)
            targets.push({ el, why })
          }
        }
        // ×(閉じる・外す・消す): 文字ラベルを持たず、中身が×アイコンだけのボタン
        document.querySelectorAll('svg[class~="lucide-x"]').forEach((svg) => {
          const btn = svg.closest('button, a[href], [role="button"]')
          if (!btn || (btn.textContent ?? '').trim() !== '') return
          push(btn, '×')
        })
        // 買い物メモのチェックの丸(いちばん連打する操作)
        document.querySelectorAll('[data-testid="memo-check"]').forEach((el) => push(el, 'チェックの丸'))
        const out = []
        for (const { el, why } of targets) {
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          // 画面の外にはみ出していて測れないものは飛ばす(測れたものだけを判定する)
          if (cx - 22 < 0 || cy - 22 < 0 || cx + 22 > innerWidth || cy + 22 > innerHeight) continue
          const d = 21
          const points = [
            [cx - d, cy], [cx + d, cy], [cx, cy - d], [cx, cy + d],
            [cx - d, cy - d], [cx + d, cy - d], [cx - d, cy + d], [cx + d, cy + d],
          ]
          const dead = points.filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            if (hit && (hit === el || el.contains(hit))) return false
            return !(hit && hit.closest('button, a[href], [role="button"], input, select, textarea, label'))
          })
          out.push({
            why,
            label: el.getAttribute('aria-label') ?? '',
            box: `${Math.round(r.width)}x${Math.round(r.height)}`,
            dead: dead.length,
          })
        }
        return out
      })
    const tapCheck = async (where) => {
      const probed = await tapProbe()
      const bad = probed.filter((p) => p.dead > 0)
      check(
        `TAP-44 ${where}: ×とチェックの丸に44px未満の押せない場所が無い`,
        probed.length > 0 && bad.length === 0,
        `測った数=${probed.length} 届かない=${JSON.stringify(bad)}`,
      )
    }
    try {
      await tpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(1800)
      // ×とチェックの丸が画面に出るところまで仕込む
      await tpPage.getByText('肉じゃが', { exact: true }).first().click()
      await tpPage.waitForTimeout(500)
      await tpPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await tpPage.waitForTimeout(300)
      await slotBtnExceptFill(tpPage, ja.mealPlan.slot.dinner).click()
      await tpPage.waitForTimeout(500)
      await tpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(900)
      await tpPage.getByRole('button', { name: '買い物メモ', exact: true }).first().click()
      await tpPage.waitForTimeout(500)
      await tpPage.getByPlaceholder(ja.shopping.manualPlaceholder).fill('じゃがいも')
      await tpPage.getByRole('button', { name: '追加', exact: true }).click()
      await tpPage.waitForTimeout(600)
      await tapCheck('買い物メモ')

      await tpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(1000)
      // 2026-08-20 司令部: 日タブの×は「整理」の中へ移った(便IG・オーナー指示A案)。
      // 押せる大きさは**出ているときに**測るものなので、先に整理へ入る。
      // 入らずに測ると「測った数=0」で必ず落ちる（0件を合格に倒さない見張りが効いている）
      await openDayOrganize(tpPage)
      await tpPage.waitForTimeout(400)
      await tapCheck('献立(日)')
      await tpPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(tpPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await tpPage.waitForTimeout(800)
      // 2026-08-22 便IV: 週の×も「編集」の中へ移った（日タブの「整理」と同じ扱い）。
      // 押せる大きさは**出ているときに**測るものなので、先に編集モードへ入る。
      // 入らずに測ると「測った数=0」で必ず落ちる（0件を合格に倒さない見張りが効いている）
      const tpToday = await tpPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'TAP-44 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(tpPage, tpToday)) === true,
      )
      await tapCheck('献立(週)')

      // 窓の中の×も測る
      await tpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tpPage.waitForTimeout(1000)
      await tpPage.getByText('カレーライス', { exact: true }).first().click()
      await tpPage.waitForTimeout(600)
      await tpPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await tpPage.waitForTimeout(500)
      await tapCheck('窓(朝食・昼食・夕食のどれに入れますか？)')
    } finally {
      await tpBrowser.close()
    }
  }

  // --- TODAYSYNC-01: 「週の予定を削除したあと、今日の献立に『レシピ一覧から選択中』として残る」
  // バグの再発防止(2026-08-03 便DP-4・オーナー報告)。
  // 原因: 日タブを開くと今日の予定が今日の献立へ自動取り込みされる(便U-3)が、その予定を消したときに
  // 写しを片付ける経路が無く、写しが「今日の予定に無い品」=①レシピ一覧から選択中 として残っていた。
  // 再現手順どおりに ①週タブで今日の夕食に割り当て ②日タブを開いて自動取り込みさせる
  // ③週タブでその割り当てを外す ④日タブに戻る、を通し、今日の献立テーブルが空になることを確認する ---
  currentCheck = 'TODAYSYNC-01'
  {
    const tsBrowser = await chromium.launch()
    const tsContext = await tsBrowser.newContext()
    const tsPage = await tsContext.newPage()
    tsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TODAYSYNC-01] ${err.message}`)
    })
    const tsToday = (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })()
    const tsReadToday = () =>
      tsPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tq = req.result.transaction(['todayList'], 'readonly').objectStore('todayList').getAll()
              tq.onsuccess = () => resolve(tq.result)
              tq.onerror = () => reject(tq.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await tsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await tsPage.waitForTimeout(1800) // 初回シード完了待ち

      // ①週タブへ切り替え、今日のカードの空き枠に「肉じゃが」を割り当てる
      await tsPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(tsPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await tsPage.waitForTimeout(500)
      const tsTodayCard = tsPage.locator(`section[data-date="${tsToday}"]`)
      // 2026-08-22 便IV: 空き枠と×は編集モードの中にしか出さない
      check(
        'TODAYSYNC-01 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(tsPage, tsToday)) === true,
      )
      await tsTodayCard.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
      await tsPage.waitForTimeout(400)
      await tsPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await tsPage.waitForTimeout(300)
      await tsPage.getByText('肉じゃが', { exact: true }).first().click()
      await tsPage.waitForTimeout(500)
      check(
        'TODAYSYNC-01 前提: 今日のカードに肉じゃがを割り当てられる',
        ((await tsTodayCard.textContent()) ?? '').includes('肉じゃが'),
      )

      // ②日タブを開く＝自動取り込み(便U-3)で今日の献立へ写しが入る
      await tsPage.getByRole('button', { name: '日', exact: true }).click()
      await tsPage.waitForTimeout(900)
      const tsImported = await tsReadToday()
      check(
        'TODAYSYNC-01 前提: 日タブを開くと今日の予定が今日の献立へ自動取り込みされる',
        tsImported.length === 1,
        `today=${JSON.stringify(tsImported)}`,
      )
      check(
        'TODAYSYNC-01(便DP-4) 自動取り込みで入った品には「予定の写し」の印(fromPlan)が付く',
        tsImported[0]?.fromPlan === true,
        `today=${JSON.stringify(tsImported)}`,
      )

      // ③週タブへ戻り、その割り当てを外す
      await tsPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(tsPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await tsPage.waitForTimeout(600)
      await openWeekDayEdit(tsPage, tsToday) // 便IV: ×は編集モードの中
      await tsTodayCard.getByRole('button', { name: ja.mealPlan.clear }).first().click()
      await tsPage.waitForTimeout(900)

      // ④今日の献立から写しも片付いている(バグの本体)
      const tsAfter = await tsReadToday()
      check(
        'TODAYSYNC-01(便DP-4) 週の予定を外すと、自動取り込みされた写しも今日の献立から消える',
        tsAfter.length === 0,
        `today=${JSON.stringify(tsAfter)}`,
      )
      await tsPage.getByRole('button', { name: '日', exact: true }).click()
      await tsPage.waitForTimeout(700)
      const tsDayText = (await tsPage.textContent('body')) ?? ''
      check(
        'TODAYSYNC-01(便DP-4) 日タブに「レシピ一覧から選択中」として取り残されない',
        // 2026-08-17 便HI: 空の日は「今日の献立」の見出しごと出さないので、そちらで測る
        !tsDayText.includes(ja.mealPlan.todayPickedLabel) &&
          (await tsPage.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
      )

      // 自分でレシピ一覧から足した品は巻き込まない(印が無いものは消さない)
      await tsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tsPage.waitForTimeout(600)
      await tsPage.getByText('カレーライス', { exact: true }).first().click()
      await tsPage.waitForTimeout(500)
      await tsPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await tsPage.waitForTimeout(300)
      await tsPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await tsPage.waitForTimeout(300)
      await tsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await tsPage.waitForTimeout(900)
      const tsManual = await tsReadToday()
      check(
        'TODAYSYNC-01(便DP-4) 自分で足した品は今日の予定に無くても消さない',
        tsManual.length === 1 && tsManual[0]?.fromPlan === undefined,
        `today=${JSON.stringify(tsManual)}`,
      )
    } finally {
      await tsBrowser.close()
    }
  }

  // --- WEEKUI-01: 週タブの見分け・並び(2026-08-03 便DP・オーナー指示)。
  //  DP-5 記録が付いた枠に「作った」バッジ+淡い面/文字を出して予定と見分ける
  //       (司令部裁定: 見た目で強く区別し、編集は可能なまま残す=間違えた記録を直せない方が害が大きい)
  //  DP-6 「表示のしかた」を畳んでいるときは「表示する食事」の見出し文字を出さずボタン群だけ残す
  //  DP-7/DT-6 食事のボタン群は「表示のしかた」の見出しの横に置き、開閉に関わらず同じ場所に出す。
  //       開いたときの中身の並びは 週の区切り → まとめて空にする
  //  DP-8 今日のカードの囲み線を太く/まとめ3つ(栄養価・概算食費・献立表)を曜日カードと区切る ---
  currentCheck = 'WEEKUI-01'
  {
    const wuBrowser = await chromium.launch()
    const wuContext = await wuBrowser.newContext()
    const wuPage = await wuContext.newPage()
    wuPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKUI-01] ${err.message}`)
    })
    const wuToday = (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })()
    try {
      await wuPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await wuPage.waitForTimeout(1800) // 初回シード完了待ち
      await wuPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(wuPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await wuPage.waitForTimeout(600)

      // DP-6: 既定は「表示のしかた」が畳まれた状態。見出しの文字は出さず、食事ボタンだけ残す
      const wuSlotGroup = wuPage.getByRole('group', { name: ja.mealPlan.slotFilterTitle })
      check(
        'WEEKUI-01(便DP-6) 畳んでいるときは「表示する食事」の見出し文字を出さない',
        !((await wuPage.textContent('body')) ?? '').includes('表示する食事'),
      )
      check(
        'WEEKUI-01(便DP-6) 畳んでいても食事のボタン群は出したまま',
        (await wuSlotGroup.getByRole('button').count()) === 3,
      )

      // DT-6: 食事のボタン群は見出し「表示のしかた」と同じ行(＝折りたたみボタンの直後)にある
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
      const wuSlotInHeader = await wuPage.evaluate((slotFilterTitle) => {
        const group = document.querySelector(`[role="group"][aria-label="${slotFilterTitle}"]`)
        const toggle = group?.parentElement?.querySelector('button[aria-expanded]')
        return {
          sameRow: !!toggle,
          afterToggle:
            !!toggle &&
            !!group &&
            (toggle.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        }
      }, ja.mealPlan.slotFilterTitle)
      check(
        'WEEKUI-01(便DT-6) 食事のボタン群は「表示のしかた」の見出し(折りたたみボタン)の横にある',
        wuSlotInHeader.sameRow && wuSlotInHeader.afterToggle,
        `pos=${JSON.stringify(wuSlotInHeader)}`,
      )
      // DP-7: 開くと 週の区切り → まとめて空にする の順に並ぶ
      await wuPage.getByRole('button', { name: '表示のしかたを開く' }).click()
      await wuPage.waitForTimeout(400)
      check(
        'WEEKUI-01(便DT-6) 開いても食事のボタン群は見出しの横のまま(1組だけ)',
        (await wuPage.getByRole('group', { name: ja.mealPlan.slotFilterTitle }).count()) === 1,
      )
      const wuOrder = await wuPage.evaluate(() => {
        const sec = [...document.querySelectorAll('section')].find(
          (s) => s.textContent?.includes('表示のしかた') && s.textContent?.includes('週区切り'),
        )
        const txt = sec?.textContent ?? ''
        return {
          layout: txt.indexOf('週区切り'),
          clear: txt.indexOf('まとめて空にする'),
        }
      })
      check(
        'WEEKUI-01(便DP-7) 「表示のしかた」の並びが 週の区切り→まとめて空にする',
        wuOrder.layout >= 0 && wuOrder.layout < wuOrder.clear,
        `order=${JSON.stringify(wuOrder)}`,
      )
      await wuPage.getByRole('button', { name: '表示のしかたを閉じる' }).click()
      await wuPage.waitForTimeout(300)

      // DP-8: 今日のカードだけ囲み線が太い(border-2)
      const wuCardCls = await wuPage.evaluate((d) => {
        const cards = [...document.querySelectorAll('section[data-date]')]
        const todayCard = cards.find((c) => c.getAttribute('data-date') === d)
        const other = cards.find((c) => c.getAttribute('data-date') !== d)
        return { today: todayCard?.className ?? '', other: other?.className ?? '' }
      }, wuToday)
      check(
        'WEEKUI-01(便DP-8) 今日の曜日カードの囲み線が太い(border-2 border-accent)',
        wuCardCls.today.includes('border-2') && wuCardCls.today.includes('border-accent'),
        `today=${wuCardCls.today}`,
      )
      check(
        'WEEKUI-01(便DP-8) ほかの曜日カードは細い線のまま(今日だけを強めている)',
        !wuCardCls.other.includes('border-2'),
        `other=${wuCardCls.other}`,
      )

      // DP-5: 今日の枠に2品入れ、片方だけ「作った！」を付けて見分けを確認する
      const wuCard = wuPage.locator(`section[data-date="${wuToday}"]`)
      // 2026-08-22 便IV: 空き枠（「レシピを選ぶ」）は編集モードの中にしか出さない
      check(
        'WEEKUI-01 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(wuPage, wuToday)) === true,
      )
      for (const title of ['肉じゃが', 'カレーライス']) {
        await wuCard.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
        await wuPage.waitForTimeout(400)
        await wuPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill(title)
        await wuPage.waitForTimeout(300)
        await wuPage.getByText(title, { exact: true }).first().click()
        await wuPage.waitForTimeout(500)
      }
      await wuPage.getByRole('button', { name: '日', exact: true }).click()
      await wuPage.waitForTimeout(900)
      // 肉じゃがの行の「作った！」だけを押す（2026-08-20 便II・⑥で整理モードの中に移った）
      await openDayOrganize(wuPage)
      await wuPage.evaluate(() => {
        const li = [...document.querySelectorAll('li')].find((el) => el.textContent?.includes('肉じゃが'))
        const b = [...(li?.querySelectorAll('button') ?? [])].find((x) => x.textContent?.includes('作った！'))
        b?.click()
      })
      await wuPage.waitForTimeout(900)
      await wuPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(wuPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await wuPage.waitForTimeout(700)
      // 2026-08-25 便KU: 1品カードは編集モードでも**レシピ詳細へのリンク**になり、差し替えは
      // 同じ行の「レシピを変更」が持つようになった。掴む先を <button> から目印（row-recipe）へ移す
      // ＝この節が見たいのは「記録済みと予定の見分け」で、押しどころの正体ではない
      const wuRows = await wuPage.evaluate((d) => {
        const sec = document.querySelector(`section[data-date="${d}"]`)
        const rows = [...(sec?.querySelectorAll('[data-testid="plan-row"]') ?? [])]
        const rowOf = (title) => rows.find((r) => (r.textContent ?? '').includes(title))
        const cardOf = (row) => row?.querySelector('[data-testid="row-recipe"]') ?? null
        const changeOf = (row) => row?.querySelector('[data-testid="slot-change-recipe"]') ?? null
        const cookedRow = rowOf('肉じゃが')
        const plannedRow = rowOf('カレーライス')
        const cooked = cardOf(cookedRow)
        const planned = cardOf(plannedRow)
        const cookedChange = changeOf(cookedRow)
        return {
          cookedCls: cooked?.className ?? '',
          cookedText: cooked?.textContent ?? '',
          // 差し替えの道が残っているか（記録済みでも押せること）
          cookedChangeDisabled: cookedChange ? cookedChange.disabled : true,
          plannedCls: planned?.className ?? '',
          plannedText: planned?.textContent ?? '',
        }
      }, wuToday)
      check(
        'WEEKUI-01(便DP-5) 記録が付いた枠に「作った」バッジが出る',
        wuRows.cookedText.includes('作った'),
        `cooked=${JSON.stringify(wuRows.cookedText)}`,
      )
      check(
        'WEEKUI-01(便DP-5) まだ作っていない予定の枠にはバッジを出さない',
        !wuRows.plannedText.includes('作った'),
        `planned=${JSON.stringify(wuRows.plannedText)}`,
      )
      check(
        'WEEKUI-01(便DP-5) 記録済みは面と文字を落とし、予定は塗った面のまま(見た目で区別)',
        wuRows.cookedCls.includes('bg-app/60') &&
          wuRows.cookedCls.includes('text-ink-muted') &&
          wuRows.plannedCls.includes('bg-surface') &&
          wuRows.plannedCls.includes('text-ink'),
        `cooked=${wuRows.cookedCls} / planned=${wuRows.plannedCls}`,
      )
      // 司令部裁定: 見た目だけ区別し、編集は可能なまま残す(間違えた記録を直せない方が害が大きい)
      check(
        'WEEKUI-01(便DP-5→便KU) 記録済みの枠でも「レシピを変更」が押せる(編集不可にはしない)',
        wuRows.cookedChangeDisabled === false,
        JSON.stringify(wuRows.cookedChangeDisabled),
      )
      await wuPage.evaluate((d) => {
        const sec = document.querySelector(`section[data-date="${d}"]`)
        const row = [...(sec?.querySelectorAll('[data-testid="plan-row"]') ?? [])].find((r) =>
          (r.textContent ?? '').includes('肉じゃが'),
        )
        row?.querySelector('[data-testid="slot-change-recipe"]')?.click()
      }, wuToday)
      await wuPage.waitForTimeout(500)
      check(
        'WEEKUI-01(便DP-5→便KU) 記録済みの枠でも「レシピを変更」でレシピ選択の窓が開く',
        !!(await wuPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).count()),
      )
      await wuPage.keyboard.press('Escape')
      await wuPage.waitForTimeout(400)

      // DP-8: 7日分の下のまとめは、区切り線+広い間隔で7日分と分かれ、曜日カード(面+影)と
      // 見た目を分ける。2026-08-26 便LH: まとめは「栄養／食費」の面と「買い物メモ」の面の2枚に
      // なった（献立表は月タブへ移した）。掴む目印は開閉ボタンの data-testid にする
      // ＝見出しの文字にも並び順にも依らない（禁じ手②④）。
      // 文言は ja.ts から読むが、evaluate の中は**ブラウザ側**で走るので引数で渡す
      // （中に ja.xxx と書くと ja is not defined になり、そこで実行が中断する）
      const wuSummary = await wuPage.evaluate(() => {
        const toggle = document.querySelector('[data-testid="week-cost-toggle"]')
        const panel = toggle?.closest('.setup-panel') ?? null
        const wrap = panel?.parentElement ?? null
        const shopPanel = document
          .querySelector('[data-testid="shop-range-toggle"]')
          ?.closest('.setup-panel')
        return {
          wrapCls: wrap?.className ?? '',
          panelCls: panel?.className ?? '',
          costSecCls: toggle?.closest('section')?.className ?? '',
          samePanelAsShop: panel != null && panel === shopPanel,
          hasNutrition: !!document.querySelector('[data-testid="week-nutrition-toggle"]'),
        }
      })
      check(
        'WEEKUI-01(便DP-8) まとめは7日分の下に区切り線+広い間隔で分かれている',
        !!wuSummary &&
          wuSummary.wrapCls.includes('border-t') &&
          wuSummary.wrapCls.includes('mt-[var(--space-lg)]'),
        `wrap=${wuSummary?.wrapCls}`,
      )
      check(
        'WEEKUI-01(便DP-8→便LH) まとめの節そのものは面を塗らない(囲みの面は .setup-panel が受け持つ)',
        !!wuSummary &&
          !wuSummary.costSecCls.includes('bg-surface') &&
          !wuSummary.costSecCls.includes('shadow-sm'),
        `cost=${wuSummary?.costSecCls}`,
      )
      check(
        'WEEKUI-01(便LH) 栄養と食費は同じ面、買い物メモは別の面（オーナー「買い物めもはくっつけない」）',
        !!wuSummary && wuSummary.hasNutrition && wuSummary.samePanelAsShop === false,
        JSON.stringify(wuSummary),
      )
    } finally {
      await wuBrowser.close()
    }
  }

  // --- WEEKUI-DT: 2026-08-07 便DT(オーナー実機確認)の10件。
  //  DT-1  日タブの「作った！」ボタンの位置(2026-08-08 便EAで「料理名の横」へ変更)
  //  DT-2  週タブの記録カード→レシピ詳細→戻る で、同じ週・同じスクロール位置へ戻り、
  //        その後「レシピ」タブを押すと(詳細ではなく)レシピ一覧が開く
  //  DT-3  日付の切り替え欄は「すべて折りたたむ」の上(7日分カードの直前)
  //  DT-4  グループ見出しは「献立を提案」
  //  DT-5  実行ボタンは「まとめて献立を入力」。畳んでいても見える・塗りつぶしで目立つ
  //  DT-6  畳んでも使うボタンは見出しの横に集約
  //  DT-7  別の週から入れる道は 2026-08-21 便IOで専用の画面へ移した…MEALPLAN-S3で検証
  //  DT-8  入れかたスイッチ。既定は非破壊(まだ決まっていない枠だけ埋める)
  //  DT-9  目的の軸は8つ…PURPOSE-02で検証
  //  DT-10 食事(朝食/昼食/夕食)の文字を少し大きく ---
  currentCheck = 'WEEKUI-DT'
  {
    const dtBrowser = await chromium.launch()
    const dtContext = await dtBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dtPage = await dtContext.newPage()
    dtPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKUI-DT] ${err.message}`)
    })
    try {
      await dtPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await dtPage.waitForTimeout(1800) // 初回シード完了待ち

      // ---------- DT-1→EA-1→HW: 日タブの1品は「2段」(A案) ----------
      // 2026-08-08 便EA(オーナー指示「作ったボタンをレシピ名横に」)で料理名と同じ行の右へ
      // 置いていたが、2026-08-19 便HW(オーナー原文「場所や機能ごとにレシピカードの形や内容が
      // 変わっているのがみづらい」＋オーナー承認のA案)で**2段**にした。
      //   1段目 … 共通のレシピカードの「標準」(レシピ一覧の一覧表示と同じ形)
      //   2段目 … その料理への操作(「作った！」「✕」)
      // 直った問題: 料理名とボタンが横一列だったため、料理名が途中で切れていた。
      // 検査するのは①操作が料理名の**下の段**にある ②料理名がボタンに幅を奪われていない
      // ③当たり判定44px以上 ④✕(外す)と12px以上離れている(押し間違い対策) の4点。
      // ②は「収まるか」ではなく**カードの幅に対する割合**で測る＝引けた料理名の長さに左右されない
      // 2026-08-17 便HH: おまかせは「今日なに作る？」の中へ移り、名前も
      // 「おまかせで提案」→「おまかせで献立を組む」になった(置き場所は問わず名前で掴む)。
      // 2026-08-17 便HI: 押しただけでは今日の献立に入らなくなったので、
      // 組んだ献立を「今日の献立に入れる」→食事を選ぶ、まで進めて行を用意する。
      // 2026-08-18 便HM: おまかせは「今日なに作る？」の「献立」側になったので、先に切り替える
      // （切り替えた時点で1組出るが、ここでは行を用意したいだけなので押して引き直しておく）
      await dtPage.locator('[data-testid="day-mode-plan"]').click()
      await dtPage.waitForTimeout(1200)
      await dtPage.getByRole('button', { name: jaRe(ja.mealPlan.todaySuggestButton) }).first().click()
      await dtPage.waitForTimeout(800)
      await dtPage.locator('[data-testid="day-suggest-apply"]').click()
      await dtPage.waitForTimeout(400)
      await dtPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await dtPage.waitForTimeout(1200)
      // 2026-08-20 便IG・①: ×は「整理」モードの中にしか出さなくなった。ここで測りたいのは
      // 「作った！」と×が押し間違えない距離にあることなので、×が出ている状態＝整理モードで測る
      await openDayOrganize(dtPage)
      const dtCookedBtn = await dtPage.evaluate(() => {
        const btn = [...document.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('作った！'),
        )
        const li = btn?.closest('li')
        if (!btn || !li) return { error: '「作った！」の行が見つからない' }
        // 1段目＝カード(レシピ詳細へのリンク)。その中の料理名の枠を測る
        const card = li.querySelector('a[href*="/recipes/"]')
        const titleEl = [...li.querySelectorAll('p')].find((p) =>
          p.className.includes('line-clamp-2'),
        )
        if (!card || !titleEl) return { error: 'カードか料理名が見つからない' }
        const btnRect = btn.getBoundingClientRect()
        const cardRect = card.getBoundingClientRect()
        const titleRect = titleEl.getBoundingClientRect()
        // ✕(外す)は同じ段にあるときだけ距離を測る(「今週の献立の予定」の行には出ない)
        const removeBtn = [...li.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === 'この献立から外す',
        )
        const removeRect = removeBtn?.getBoundingClientRect()
        return {
          height: Math.round(btnRect.height),
          // 操作は料理名より下の段にあるか(2段になっているか)
          belowTitle: btnRect.top >= titleRect.bottom - 2,
          // 料理名がボタンに幅を奪われていないか。カードの内側の幅に対する割合で測る
          // (絶対値や「何文字入るか」で測ると、引けた料理名の長さで結果が変わる)
          titleWidthRatio: Math.round((titleRect.width / cardRect.width) * 100),
          removeGap: removeRect ? Math.round(removeRect.left - btnRect.right) : null,
        }
      })
      check(
        'WEEKUI-DT(便HW・A案) 日タブの1品は2段（操作は料理名の下の段にある）',
        !dtCookedBtn.error && dtCookedBtn.belowTitle === true,
        `btn=${JSON.stringify(dtCookedBtn)}`,
      )
      check(
        'WEEKUI-DT(便HW・A案) 料理名が操作に幅を奪われていない（カード幅の6割以上を使う）',
        !dtCookedBtn.error &&
          typeof dtCookedBtn.titleWidthRatio === 'number' &&
          dtCookedBtn.titleWidthRatio >= 60,
        `btn=${JSON.stringify(dtCookedBtn)}`,
      )
      check(
        'WEEKUI-DT(便EA-1) 「作った！」の当たり判定は44px以上',
        !dtCookedBtn.error && dtCookedBtn.height >= 44,
        `btn=${JSON.stringify(dtCookedBtn)}`,
      )
      check(
        'WEEKUI-DT(便EA-1) 「作った！」と✕(外す)は12px以上離れている',
        !dtCookedBtn.error && dtCookedBtn.removeGap !== null && dtCookedBtn.removeGap >= 12,
        `btn=${JSON.stringify(dtCookedBtn)}`,
      )

      // ---------- 週タブへ ----------
      await dtPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(dtPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await dtPage.waitForTimeout(700)

      // ---------- DT-4/5/6: 見出しの名前・実行ボタンの位置と見た目 ----------
      const dtBody = (await dtPage.textContent('body')) ?? ''
      check(
        'WEEKUI-DT(便DT-4) グループ見出しが「献立を提案」になっている(「自動で献立を提案」は残っていない)',
        dtBody.includes('献立を提案') && !dtBody.includes('自動で献立を提案'),
      )
      const dtFillBtn = dtPage.locator('[data-testid="week-fill-run"]')
      check('WEEKUI-DT(便DT-5) 実行ボタンは「まとめて献立を入力」', await dtFillBtn.isVisible())
      check(
        'WEEKUI-DT(便DT-5) 実行ボタンは塗りつぶしで目立たせている',
        ((await dtFillBtn.getAttribute('class')) ?? '').includes('bg-accent'),
      )
      // 2026-08-19 便IF・⑥で実行ボタンを日タブと同じ場所（条件の下・横いっぱい）へ移した。
      // 2026-08-20 便II・③（オーナー原文「折りたたんだ状態で「まとめて献立を入力」ボタンほしい」）で、
      // その実行ボタンだけを折りたたみの外へ出した。
      // 2026-08-22 便IV（オーナー原文「でふぉるとで設定３種は、折りたたんだ表示にして」
      // 「「まとめて献立てを入力」ボタンは「献立を提案」の横にして、１列におさめて。」）:
      // **既定は3節とも畳んである**に変わり、実行ボタンは見出しの横に移った。
      // ここでは「既定で畳んでいる」「畳んだままでも実行ボタンは出ている」「開くと条件と
      // 入れかたが出る」を見る（畳んだときの中身と押せる大きさは IVFOLD-01 が実測で受け持つ）
      const dtAutoOpen = dtPage.getByRole('button', { name: '献立を提案を開く' })
      check(
        'WEEKUI-DT(便IV) 「献立を提案」は既定で畳んである',
        (await dtAutoOpen.count()) === 1,
        `開くボタン=${await dtAutoOpen.count()}件`,
      )
      check(
        'WEEKUI-DT(便IV) 畳んでいるあいだ、現在の条件と入れかたは隠れている',
        // 2026-08-19 便ID・③: 「提案の条件」→「現在の条件」に改名した(名前は ja.ts から読む)
        (await dtPage.getByRole('button', { name: new RegExp(`^${ja.mealPlan.suggestConditionsToggle}`) }).count()) === 0 &&
          (await dtPage.locator('[data-testid="fill-mode"]').count()) === 0,
      )
      check(
        'WEEKUI-DT(便IV) 畳んでも「まとめて献立を入力」は残る(折りたたみを開かなくても押せる)',
        (await dtPage.locator('[data-testid="week-fill-run"]').count()) === 1,
      )
      if ((await dtAutoOpen.count()) === 1) {
        await dtAutoOpen.click()
        await dtPage.waitForTimeout(400)
      }
      check(
        'WEEKUI-DT(便IF-⑥) 開くと現在の条件と入れかたが出る（しまっただけで無くしていない）',
        (await dtPage.getByRole('button', { name: new RegExp(`^${ja.mealPlan.suggestConditionsToggle}`) }).count()) === 1 &&
          (await dtPage.locator('[data-testid="fill-mode"]').count()) === 1,
      )

      // ---------- DT-3: 日付の切り替え欄は「すべて折りたたむ」の上・7日分カードの直前 ----------
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
      const dtOrder = await dtPage.evaluate((prevWeek) => {
        const all = [...document.querySelectorAll('button')]
        const prev = document.querySelector(`button[aria-label="${prevWeek}"]`)
        const collapse = all.find((b) => b.textContent?.trim() === 'すべて折りたたむ')
        const firstCard = document.querySelector('section[data-date]')
        const autoToggle = all.find((b) => b.textContent?.includes('献立を提案'))
        const pos = (a, b) =>
          a && b ? (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 : false
        return {
          hasAll: !!prev && !!collapse && !!firstCard && !!autoToggle,
          afterGroups: pos(autoToggle, prev),
          beforeCollapse: pos(prev, collapse),
          beforeCards: pos(collapse, firstCard),
        }
      }, ja.mealPlan.prevWeek)
      check(
        'WEEKUI-DT(便DT-3) 日付の切り替え欄は操作グループより下・「すべて折りたたむ」の上にある',
        dtOrder.hasAll && dtOrder.afterGroups && dtOrder.beforeCollapse && dtOrder.beforeCards,
        `order=${JSON.stringify(dtOrder)}`,
      )

      // ---------- DT-8: 入れかたスイッチ。既定は非破壊 ----------
      // 2026-08-20 便II・④: 入れかたは2つのチップからプルダウン1つになった
      check(
        `WEEKUI-DT(便DT-8) 既定の入れかたは「${ja.mealPlan.fillModeFillEmpty}」(非破壊)`,
        (await dtPage.locator('[data-testid="fill-mode"]').inputValue()) === 'fillEmpty',
        `いまの入れかた=${await dtPage.locator('[data-testid="fill-mode"]').inputValue()}`,
      )
      // 既定のまま2回押しても、1回目に入った献立のidが1件も入れ替わらない(=1品も消していない)
      const dtDinnerIds = () =>
        dtPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () => resolve(g.result.map((e) => e.id).sort((a, b) => a - b))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
      await dtFillBtn.click()
      await dtPage.waitForTimeout(1200)
      const dtIds1 = await dtDinnerIds()
      check('WEEKUI-DT(便DT-8) 1回目で献立が入る', dtIds1.length > 0, `n=${dtIds1.length}`)
      await dtFillBtn.click()
      await dtPage.waitForTimeout(1200)
      const dtIds2 = await dtDinnerIds()
      check(
        'WEEKUI-DT(便DT-8) 既定では2回押しても既存の献立が1件も消えない(完全に非破壊)',
        dtIds1.every((id) => dtIds2.includes(id)),
        `1=${JSON.stringify(dtIds1)} / 2=${JSON.stringify(dtIds2)}`,
      )

      // ---------- DT-10: 食事(朝食/昼食/夕食)の文字を少し大きく ----------
      const dtSlotLabel = await dtPage.evaluate(() => {
        const block = document.querySelector('[data-testid="slot-block"]')
        const p = block?.querySelector('p')
        if (!p) return null
        return { text: p.textContent ?? '', size: getComputedStyle(p).fontSize, cls: p.className }
      })
      check(
        'WEEKUI-DT(便DT-10) 提案結果の「夕食」等の文字が14px(text-sm)になっている',
        !!dtSlotLabel &&
          ['朝食', '昼食', '夕食'].includes(dtSlotLabel.text) &&
          dtSlotLabel.size === '14px',
        `slot=${JSON.stringify(dtSlotLabel)}`,
      )

      // ---------- DT-2: 週タブの記録カード→詳細→戻る の往復 ----------
      // 過去日(昨日)に作った記録を仕込み、週タブに記録カードを出す
      await dtPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            d.setDate(d.getDate() - 1)
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const r = g.result.find((x) => x.title === 'カレーライス')
                if (!r) {
                  reject(new Error('カレーライスが見つからない'))
                  return
                }
                r.cookedLogs = [{ date }, ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await dtPage.reload({ waitUntil: 'networkidle' })
      await dtPage.waitForTimeout(1200)
      await dtPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(dtPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await dtPage.waitForTimeout(900)
      // 週タブは月曜始まりなので、今日が月曜だと「昨日」=日曜は前の週に入り、仕込んだ記録カードが出ない
      // (EQ-01と同じ日付依存。2026-08-10 実発)。仕込んだ日のカードが出る週まで送ってから掴む
      const dtSeed = new Date()
      dtSeed.setDate(dtSeed.getDate() - 1)
      const dtSeedDate = `${dtSeed.getFullYear()}-${String(dtSeed.getMonth() + 1).padStart(2, '0')}-${String(dtSeed.getDate()).padStart(2, '0')}`
      for (let i = 0; i < 4; i++) {
        if ((await dtPage.locator(`section[data-date="${dtSeedDate}"]`).count()) > 0) break
        const shown = await dtPage.locator('section[data-date]').first().getAttribute('data-date')
        await dtPage.locator(`button[aria-label="${shown && dtSeedDate < shown ? '前の週' : '次の週'}"]`).click()
        await openAllWeekDays(dtPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await dtPage.waitForTimeout(600)
      }
      check(
        'WEEKUI-DT 記録を仕込んだ日(昨日)を含む週を表示できる',
        (await dtPage.locator(`section[data-date="${dtSeedDate}"]`).count()) > 0,
        `昨日=${dtSeedDate}`,
      )
      // 記録カードが見えるところまでスクロールしてから開く(戻ったときの復元位置の比較用)
      const dtLogLink = dtPage.locator('a[href*="#/recipes/"]').filter({ hasText: 'カレーライス' }).first()
      await dtLogLink.scrollIntoViewIfNeeded()
      await dtPage.waitForTimeout(400)
      // 2026-08-17 便HI: 週タブは**先頭から**出るようになった（以前は今日のカードへ勝手に送っていた）。
      // この検査が見たいのは「戻ったときに元の位置へ帰るか」なので、**自分で送ってから**測る。
      // 送れない（ページが短い）ときは戻り先の比較そのものが成り立たないので、その旨を出す
      await dtPage.evaluate(() => window.scrollBy(0, 240))
      await dtPage.waitForTimeout(300)
      const dtScrollBefore = await dtPage.evaluate(() => Math.round(window.scrollY))
      const dtWeekBefore =
        (await dtPage.locator(`button[aria-label="${ja.mealPlan.prevWeek}"] ~ button`).first().textContent()) ?? ''
      check(
        'WEEKUI-DT(便DT-2) 前提: 記録カードを開く前に週タブを送っている',
        dtScrollBefore > 0,
        `scrollY=${dtScrollBefore}（ページが送れる高さか）`,
      )
      // Playwrightのclick()は要素を見える位置へ送るので、上で作った位置が壊れる。
      // DOMのclickを直接呼んで送らない（同じ理由の対処がSCROLL-01・LOG-01にもある）
      await dtLogLink.evaluate((el) => el.click())
      await dtPage.waitForTimeout(900)
      check(
        'WEEKUI-DT(便DT-2) 記録カードからレシピ詳細が開く',
        /#\/recipes\/\d+/.test(dtPage.url()),
        `url=${dtPage.url()}`,
      )
      // 詳細の「戻る」で週タブへ帰る(従来はレシピ一覧へ飛んでいた)
      await dtPage.getByRole('button', { name: ja.common.back }).first().click()
      await dtPage.waitForTimeout(1500)
      check(
        'WEEKUI-DT(便DT-2) 詳細の「戻る」で献立タブへ戻る(レシピ一覧へ飛ばない)',
        dtPage.url().includes('#/meal-plan'),
        `url=${dtPage.url()}`,
      )
      check(
        'WEEKUI-DT(便DT-2) 復元に使ったクエリ(focus/restore)はURLから消える',
        !dtPage.url().includes('focus=') && !dtPage.url().includes('restore='),
        `url=${dtPage.url()}`,
      )
      const dtWeekAfter =
        (await dtPage.locator(`button[aria-label="${ja.mealPlan.prevWeek}"] ~ button`).first().textContent()) ?? ''
      check(
        'WEEKUI-DT(便DT-2) 戻ると週タブが開き、離れる前と同じ週を見ている',
        dtWeekAfter.trim() === dtWeekBefore.trim() && dtWeekAfter.trim() !== '',
        `before=${dtWeekBefore} / after=${dtWeekAfter}`,
      )
      const dtScrollAfter = await dtPage.evaluate(() => Math.round(window.scrollY))
      check(
        'WEEKUI-DT(便DT-2) 戻ると離れる前とほぼ同じスクロール位置に復元される(誤差40px以内)',
        Math.abs(dtScrollAfter - dtScrollBefore) <= 40,
        `before=${dtScrollBefore} / after=${dtScrollAfter}`,
      )
      // その後「レシピ」タブを押すと、さっき閉じた詳細ではなくレシピ一覧が開く
      await dtPage.locator('nav a[href^="#/recipes"]').first().click()
      await dtPage.waitForTimeout(900)
      check(
        'WEEKUI-DT(便DT-2) その後「レシピ」タブを押すとレシピ一覧が開く(詳細が開いたままにならない)',
        /#\/recipes(\?|$)/.test(dtPage.url()),
        `url=${dtPage.url()}`,
      )
    } finally {
      await dtBrowser.close()
    }
  }

