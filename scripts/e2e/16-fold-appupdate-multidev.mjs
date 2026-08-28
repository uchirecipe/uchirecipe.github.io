// ==========================================================================================
// e2e の節: 折りたたみ・アプリ更新・複数端末
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
// この中の節: EO-01, EO-02, EO-03, APPUPDATE-01, EQ-01, MULTIDEV-01, ET-00, ET-01, ET-02, ET-03, EW-01, EW-02
// ==========================================================================================
import './_shared.mjs'

  // --- EO-01: 折りたたみは高さのアニメーションで開閉し、動きを減らす設定では出さない ---
  //
  // 2026-08-19 便IC: **1か所（レシピ一覧の絞り込み）だけを見ていたのをやめ、複数の画面を見る**。
  // 折りたたみは34か所・11ファイルで同じ部品を使っているので、1か所直すと全部が変わる。
  // 逆に、見張りが1か所だけだと「その1か所が別の作りに変わった日」に見張りごと消える。
  //
  // 測り方の注意（ここを間違えると、壊れていても緑になる）:
  //  ・高さを取りに行くのに getBoundingClientRect / getComputedStyle を使うと、**その読み取り自体が
  //    ブラウザにスタイルを計算させる**。折りたたみのアニメーションは「高さ0の状態が一度計算されて
  //    いること」で成立するので、検査側が読みに行くと、アニメーションが出ない作りでも出てしまう。
  //    2026-08-19に実際にそうなっていた（本番では動いていない画面があったのに、この節は緑だった）。
  //    そこで **ResizeObserver**（実際に大きさが変わったときだけ後から知らせが来る・こちらからは
  //    何も強制しない）で記録する。
  //  ・「◯ms以内に開く」のような時間での判定はしない（機械の速さで揺れる）。
  //    **途中の高さを通ったかどうか**という結果だけで判定する。
  //  ・掴み方は入れ子の段数・クラス名に依存させない。折りたたみの箱には `data-collapse` が付く
  //    （src/components/Collapse.tsx）ので、それだけで探す。
  //  ・読み取れなかったときは必ず不合格にする（「見つからなかった＝合格」に倒れない）。
  currentCheck = 'EO-01'
  {
    /** ページの中に仕込む記録係。開閉のあいだの高さを1フレームずつ受け取る */
    const COLLAPSE_RECORDER = `() => {
      const rec = { armed: false, t0: 0, all: [] }
      window.__collapseRec = rec
      const ro = new ResizeObserver((list) => {
        if (!rec.armed) return
        const t = Math.round(performance.now() - rec.t0)
        for (const e of list) {
          const hit = e.target.__collapseHit
          if (hit && hit.armed) hit.series.push([t, Math.round(e.contentRect.height * 10) / 10])
        }
      })
      const track = (el) => {
        if (el.__collapseHit) return el.__collapseHit
        const hit = { armed: false, series: [] }
        el.__collapseHit = hit
        rec.all.push(hit)
        ro.observe(el)
        return hit
      }
      const mo = new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) {
          if (!(n instanceof Element)) continue
          const found = n.matches('[data-collapse]') ? [n] : []
          for (const el of n.querySelectorAll('[data-collapse]')) found.push(el)
          for (const el of found) { const hit = track(el); if (rec.armed) hit.armed = true }
        }
      })
      mo.observe(document.body, { childList: true, subtree: true })
      // これから測る、の合図。いま出ている折りたたみも測る対象にする（閉じる側を見るため）
      window.__collapseArm = () => {
        for (const hit of rec.all) { hit.armed = false; hit.series = [] }
        for (const el of document.querySelectorAll('[data-collapse]')) { const hit = track(el); hit.armed = true; hit.series = [] }
        rec.t0 = performance.now()
        rec.armed = true
      }
      // 測り終わり。大きさが変わったものだけを返す（閉じてDOMから消えたものも残る）
      window.__collapseRead = () => {
        rec.armed = false
        return rec.all.filter((h) => h.armed && h.series.length > 0).map((h) => h.series)
      }
    }`
    /** 折りたたみの数（閉じているあいだは中身ごとDOMに無いので0になる） */
    const collapseCount = (p) => p.evaluate(() => document.querySelectorAll('[data-collapse]').length)
    /**
     * 押してから、いちばん大きく育った（＝いま開閉した）折りたたみの高さの並びを返す。
     * 何も動かなかったときは null＝呼び出し側で必ず不合格にする。
     */
    const recordToggle = async (p, locator, settleMs = 900) => {
      await p.evaluate(() => window.__collapseArm())
      await locator.click()
      await p.waitForTimeout(settleMs)
      const seriesList = await p.evaluate(() => window.__collapseRead())
      if (!seriesList.length) return null
      const main = seriesList
        .map((s) => ({ s, max: Math.max(...s.map((x) => x[1])) }))
        .sort((a, b) => b.max - a.max)[0]
      const heights = main.s.map((x) => x[1])
      return {
        heights,
        max: main.max,
        /** 0でも開き切りでもない「途中の高さ」を何回通ったか */
        midway: heights.filter((h) => h > 0.5 && h < main.max - 0.5).length,
        text: main.s.map((x) => `${x[0]}ms:${x[1]}`).join(' '),
      }
    }

    const eoBrowser = await chromium.launch()
    try {
      const eoCtx = await eoBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const eoPage = await eoCtx.newPage()
      eoPage.on('pageerror', (err) => {
        if (/cloudflareinsights|Access-Control/.test(err.message)) return
        errors.push(`[pageerror@EO-01] ${err.message}`)
      })
      await eoPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eoPage.waitForTimeout(1800)
      await eoPage.evaluate(`(${COLLAPSE_RECORDER})()`)

      // 見る場所は「別々の画面から3つ以上」。1つの画面の作りが変わっても見張りが消えないようにする。
      // 文言は ja.ts から取る（画面の字を書き写さない）
      const eoTargets = [
        { screen: '設定', hash: '#/settings', label: ja.settings.moveGuideToggle },
        { screen: 'レシピ登録', hash: '#/recipes/new', label: ja.paste.open },
        { screen: '食材の在庫', hash: '#/shopping', label: ja.common.usageHint },
        { screen: 'レシピ一覧', hash: '#/recipes', label: ja.search.filterToggle },
      ]
      const eoMeasured = []
      for (const t of eoTargets) {
        await eoPage.evaluate((h) => { window.location.hash = h }, t.hash)
        await eoPage.waitForTimeout(1500)
        const toggle = eoPage.getByRole('button', { name: t.label, exact: false }).first()
        if ((await toggle.count()) === 0) continue // その画面に無い作りに変わった＝下の下限で受け止める
        await toggle.scrollIntoViewIfNeeded()
        await eoPage.waitForTimeout(200)
        const opening = await recordToggle(eoPage, toggle)
        check(
          `EO-01 ${t.screen}「${t.label}」は開くときに高さが途中の値を通る`,
          opening !== null && opening.midway > 0 && opening.max > 0,
          opening === null ? '高さの変化が1回も記録できなかった' : `1フレームごとの高さ: ${opening.text}`,
        )
        if (opening !== null && opening.midway > 0) eoMeasured.push(t.screen)
        // 開けたものは閉じておく（次の画面へ持ち越さない）
        if (await toggle.count()) { await toggle.click(); await eoPage.waitForTimeout(500) }
      }
      check(
        'EO-01 複数の画面の折りたたみを測れている（1か所だけの見張りに戻っていない）',
        eoMeasured.length >= 3,
        `測れた画面: ${eoMeasured.join('・') || 'なし'}`,
      )

      // 開く前後でDOMに中身が置かれる／消えることと、閉じるときも途中の高さを通ること
      await eoPage.evaluate((h) => { window.location.hash = h }, '#/settings')
      await eoPage.waitForTimeout(1500)
      const eoToggle = eoPage.getByRole('button', { name: ja.settings.moveGuideToggle, exact: false }).first()
      check('EO-01 開く前は折りたたみの中身がDOMに無い', (await collapseCount(eoPage)) === 0)
      await eoToggle.scrollIntoViewIfNeeded()
      await recordToggle(eoPage, eoToggle)
      check('EO-01 開いている間は中身がDOMにある', (await collapseCount(eoPage)) > 0)
      const eoClosing = await recordToggle(eoPage, eoToggle)
      check(
        'EO-01 閉じるときも高さが途中の値を通る',
        eoClosing !== null && eoClosing.midway > 0,
        eoClosing === null ? '高さの変化が1回も記録できなかった' : `1フレームごとの高さ: ${eoClosing.text}`,
      )
      check('EO-01 閉じ切ると中身はDOMから消える', (await collapseCount(eoPage)) === 0)

      // 動きを減らす設定では、途中の高さを通らずに開き切る
      const eoRmCtx = await eoBrowser.newContext({
        viewport: { width: 390, height: 844 },
        reducedMotion: 'reduce',
      })
      const eoRmPage = await eoRmCtx.newPage()
      eoRmPage.on('pageerror', (err) => {
        if (/cloudflareinsights|Access-Control/.test(err.message)) return
        errors.push(`[pageerror@EO-01rm] ${err.message}`)
      })
      await eoRmPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await eoRmPage.waitForTimeout(1800)
      await eoRmPage.evaluate(`(${COLLAPSE_RECORDER})()`)
      const eoRmToggle = eoRmPage.getByRole('button', { name: ja.settings.moveGuideToggle, exact: false }).first()
      await eoRmToggle.scrollIntoViewIfNeeded()
      const eoRm = await recordToggle(eoRmPage, eoRmToggle)
      check(
        'EO-01 動きを減らす設定ではアニメーションを出さず即座に開く',
        eoRm !== null && eoRm.max > 0 && eoRm.midway === 0,
        eoRm === null ? '高さの変化が1回も記録できなかった' : `1フレームごとの高さ: ${eoRm.text}`,
      )

      // EO-01f（2026-08-19 便IC）: **機械が混んでいても**途中の高さを通ること。
      // 直す前は「中身を置く」→「1フレーム待つ」→「伸ばす」を requestAnimationFrame の二重予約で
      // 表しており、予約が描き直しを追い越すとアニメーションが丸ごと消えた。設定の
      // 「機種変更するときは」は混んでいなくても毎回消えていたが、他の画面は混んだときだけ消える。
      // CPUを絞って「混んでいる状態」を作り、そこでも途中の高さを通ることを見張る。
      const eoSlowCtx = await eoBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const eoSlowPage = await eoSlowCtx.newPage()
      eoSlowPage.on('pageerror', (err) => {
        if (/cloudflareinsights|Access-Control/.test(err.message)) return
        errors.push(`[pageerror@EO-01slow] ${err.message}`)
      })
      await eoSlowPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await eoSlowPage.waitForTimeout(2000)
      const eoCdp = await eoSlowCtx.newCDPSession(eoSlowPage)
      await eoCdp.send('Emulation.setCPUThrottlingRate', { rate: 10 })
      await eoSlowPage.evaluate(`(${COLLAPSE_RECORDER})()`)
      const eoSlowToggle = eoSlowPage.getByRole('button', { name: ja.settings.moveGuideToggle, exact: false }).first()
      await eoSlowToggle.scrollIntoViewIfNeeded()
      await eoSlowPage.waitForTimeout(400)
      const eoSlow = await recordToggle(eoSlowPage, eoSlowToggle, 1600)
      await eoCdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      check(
        'EO-01 機械が混んでいても開くときに高さが途中の値を通る（予約の追い越しが起きない）',
        eoSlow !== null && eoSlow.midway > 0 && eoSlow.max > 0,
        eoSlow === null ? '高さの変化が1回も記録できなかった' : `1フレームごとの高さ: ${eoSlow.text}`,
      )
    } finally {
      await eoBrowser.close()
    }
  }

  // --- EO-02: 押下前後でボタンの寸法が変わらない（チップのチェック印・文言の入れ替え） ---
  currentCheck = 'EO-02'
  {
    const eoBrowser = await chromium.launch()
    try {
      const eoCtx = await eoBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const eoPage = await eoCtx.newPage()
      eoPage.on('pageerror', (err) => errors.push(`[pageerror@EO-02] ${err.message}`))
      eoPage.on('dialog', (d) => void d.accept())
      await eoPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eoPage.waitForTimeout(1800)
      await eoPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eoPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(eoPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await eoPage.waitForTimeout(700)

      const sizeOf = async (loc) => {
        const b = await loc.boundingBox()
        return b ? { w: Math.round(b.width * 100) / 100, h: Math.round(b.height * 100) / 100 } : null
      }
      /** 押す前後で自分の寸法が1pxも変わらないことを確かめる */
      const noResize = async (label, loc) => {
        await loc.scrollIntoViewIfNeeded()
        await eoPage.waitForTimeout(200)
        const before = await sizeOf(loc)
        await loc.click()
        await eoPage.waitForTimeout(450)
        const after = await sizeOf(loc)
        check(
          `EO-02 ${label}は押しても寸法が変わらない`,
          !!before && !!after && before.w === after.w && before.h === after.h,
          `前=${JSON.stringify(before)} 後=${JSON.stringify(after)}`,
        )
      }

      // 「すべてロック」「すべて折りたたむ」＝押すと文言が入れ替わるボタン
      await noResize('週タブ「すべてロック」', eoPage.locator('[data-testid="lock-all"]'))
      await noResize('週タブ「すべてロック」(戻す)', eoPage.locator('[data-testid="lock-all"]'))
      const eoCollapseAll = eoPage.getByRole('button', { name: /^すべて(折りたたむ|開く)$/ })
      await noResize('週タブ「すべて折りたたむ」', eoCollapseAll)
      await noResize('週タブ「すべて開く」', eoCollapseAll)

      // 現在の条件（2026-08-19 便ID・④で窓の中に移った）。
      // 2026-08-20 便II・①: 調理時間もチップからプルダウンになった＝押して幅が変わる
      // 心配のあるチップは、この窓の中に1つも残っていない
      await openWeekGroup(eoPage, ja.mealPlan.weekGroupAutoTitle)
      await eoPage.waitForTimeout(400)
      await eoPage.locator('[data-testid="plan-conditions-open"]').click()
      await eoPage.waitForTimeout(500)
      {
        const eoQuick = eoPage.locator('[data-testid="plan-quick-minutes"]')
        const before = await eoQuick.boundingBox()
        await eoQuick.selectOption('15')
        await eoPage.waitForTimeout(300)
        const after = await eoQuick.boundingBox()
        check(
          'EO-02 調理時間のプルダウンは、選んでも大きさが変わらない',
          before != null &&
            after != null &&
            Math.round(before.width) === Math.round(after.width) &&
            Math.round(before.height) === Math.round(after.height),
          `前=${JSON.stringify(before)} 後=${JSON.stringify(after)}`,
        )
        await eoQuick.selectOption('')
        await eoPage.waitForTimeout(300)
      }
      // ジャンルも同じ（2026-08-19 便HTでプルダウン→2026-08-22 便IYで複数選べる並びに戻した）。
      // 測るのは「選んでも並びの大きさが変わらないこと」＝窓の中が伸び縮みしない
      {
        const eoGenre = eoPage.locator('[data-testid="plan-genre"]')
        const before = await eoGenre.boundingBox()
        const eoChuka = eoPage.locator('[data-testid="plan-genre-chip"][data-genre="中華"]')
        check('EO-02 前提: ジャンルの並びを掴めた', (await eoChuka.count()) === 1)
        if ((await eoChuka.count()) === 1) {
          await eoChuka.click()
          await eoPage.waitForTimeout(300)
        }
        const after = await eoGenre.boundingBox()
        check(
          'EO-02 料理のジャンルの並びは、選んでも大きさが変わらない',
          before != null &&
            after != null &&
            Math.round(before.width) === Math.round(after.width) &&
            Math.round(before.height) === Math.round(after.height),
          `前=${JSON.stringify(before)} 後=${JSON.stringify(after)}`,
        )
        if ((await eoChuka.count()) === 1) {
          await eoChuka.click() // 指定なし(3つとも選んだ状態)へ戻す
          await eoPage.waitForTimeout(300)
        }
      }

      // 現在値のサマリーが付く「現在の条件」も、窓を開け閉めして寸法が変わらない
      // （2026-08-19 便ID・④で折りたたみ→窓。開いているあいだ後ろは押せないので、
      //   閉じるのは窓の中の「閉じる」で行う）
      {
        const eoCondToggle = eoPage.locator('[data-testid="plan-conditions-open"]')
        const beforeOpen = await sizeOf(eoCondToggle)
        await eoPage.locator('[data-testid="plan-conditions-close"]').click()
        await eoPage.waitForTimeout(500)
        const afterClose = await sizeOf(eoCondToggle)
        await eoCondToggle.click()
        await eoPage.waitForTimeout(500)
        const afterOpen = await sizeOf(eoCondToggle)
        await eoPage.locator('[data-testid="plan-conditions-close"]').click()
        await eoPage.waitForTimeout(500)
        check(
          'EO-02 「現在の条件」は窓を開け閉めしても寸法が変わらない',
          !!beforeOpen &&
            !!afterClose &&
            !!afterOpen &&
            beforeOpen.w === afterClose.w &&
            beforeOpen.h === afterClose.h &&
            beforeOpen.w === afterOpen.w &&
            beforeOpen.h === afterOpen.h,
          `開いている間=${JSON.stringify(beforeOpen)} 閉じた後=${JSON.stringify(afterClose)} 開き直した後=${JSON.stringify(afterOpen)}`,
        )
      }
    } finally {
      await eoBrowser.close()
    }
  }

  // --- EO-03: 押して伸びた部分が画面の外に見切れない（作った記録の行内編集） ---
  currentCheck = 'EO-03'
  {
    const eoBrowser = await chromium.launch()
    try {
      const eoCtx = await eoBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const eoPage = await eoCtx.newPage()
      eoPage.on('pageerror', (err) => errors.push(`[pageerror@EO-03] ${err.message}`))
      eoPage.on('dialog', (d) => void d.accept())
      await eoPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eoPage.waitForTimeout(1800)
      await eoPage.getByText('肉じゃが', { exact: true }).first().click()
      await eoPage.waitForTimeout(900)

      // 作った記録を1件つくる
      const eoCooked = eoPage.getByRole('button', { name: /作った/ }).first()
      await eoCooked.click()
      await eoPage.waitForTimeout(700)
      const eoSave = eoPage.getByRole('button', { name: /^記録する/ }).first()
      if (await eoSave.count()) {
        await eoSave.click()
        await eoPage.waitForTimeout(900)
      }

      const eoEdit = eoPage.getByRole('button', { name: ja.mealPlan.weekDayEdit }).first()
      check('EO-03 作った記録に「編集」がある', await eoEdit.isVisible())
      // 「編集」を画面のいちばん下に置いてから押す＝直したかった見切れの再現条件
      await eoEdit.scrollIntoViewIfNeeded()
      await eoPage.evaluate(() => {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent?.trim() === '編集')
        if (b) {
          const r = b.getBoundingClientRect()
          window.scrollBy({ top: r.bottom - (window.innerHeight - 90), behavior: 'instant' })
        }
      })
      await eoPage.waitForTimeout(300)
      await eoEdit.click()
      await eoPage.waitForTimeout(1000)
      const eoFits = await eoPage.evaluate(() => {
        const input = document.querySelector('input[type="date"]')
        const panel = input ? input.parentElement : null
        const nav = document.querySelector('[data-app-bottom-bar]')
        if (!panel) return null
        const r = panel.getBoundingClientRect()
        const navTop = nav ? nav.getBoundingClientRect().top : window.innerHeight
        return { top: r.top, bottom: r.bottom, navTop }
      })
      check(
        'EO-03 編集欄を開くと、下のタブナビに隠れない位置まで画面が動く',
        !!eoFits && eoFits.top >= 0 && eoFits.bottom <= eoFits.navTop + 1,
        eoFits ? `上端=${Math.round(eoFits.top)} 下端=${Math.round(eoFits.bottom)} タブ上端=${Math.round(eoFits.navTop)}` : 'panel not found',
      )
    } finally {
      await eoBrowser.close()
    }
  }

  // --- APPUPDATE-01: アプリの更新のワンタップ導線(2026-08-09 便ER) ---
  // 検証したいこと:
  //   ①新しいバージョンが入ると画面下に更新の帯が出る
  //   ②調理中モードの間は帯を出さない(作業を壊さない)。閉じると出る
  //   ③帯は閉じられ、そのセッションでは出し直さない
  //   ④閉じたあとも設定の「アプリの更新」→「最新の状態にする」で反映できる(画面が読み込み直される)
  //   ⑤新しいバージョンが無いときは「すでに最新のバージョンです」と伝える
  //   ⑥古いキャッシュが積み上がらない(cleanupOutdatedCaches + プリキャッシュの掃除)
  //
  // やり方: 本物のService Workerの入れ替わりを再現する必要があるため、BASE(vite preview)ではなく
  // dist/ をコピーした一時ディレクトリを自前の静的サーバーで配り、途中で配信中の sw.js の末尾に
  // 印を足して「新しいバージョンを公開した」状態を作る。sw.js のバイト列が変わればブラウザは
  // 更新として扱うので、インストール→有効化→画面の制御引き継ぎまで実物どおりに走る。
  // 専用ポート・専用ブラウザで動かすので、他のチェックにもオーナーのdevサーバーにも触れない。
  currentCheck = 'APPUPDATE-01'
  {
    const fsMod = await import('node:fs')
    const osMod = await import('node:os')
    const httpMod = await import('node:http')

    const distDir = path.join(appRoot, 'dist')
    if (!fsMod.existsSync(path.join(distDir, 'sw.js'))) {
      ng(
        'APPUPDATE-01 前提: dist/sw.js がある',
        'npm run build を済ませてから実行してください（previewの配信元がdist）',
      )
    } else {
      const serveDir = fsMod.mkdtempSync(path.join(osMod.tmpdir(), 'uchi-e2e-appupdate-'))
      fsMod.cpSync(distDir, serveDir, { recursive: true })
      const swPath = path.join(serveDir, 'sw.js')
      const swOriginal = fsMod.readFileSync(swPath, 'utf-8')
      let publishedVersion = 0
      // 「新しいバージョンを公開する」= 配信中の sw.js を別のバイト列にする
      const publishNewVersion = () => {
        publishedVersion += 1
        fsMod.writeFileSync(swPath, `${swOriginal}\n// e2e new version ${publishedVersion}\n`)
      }

      const MIME_BY_EXT = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.mjs': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.webmanifest': 'application/manifest+json; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon',
        '.woff2': 'font/woff2',
        '.txt': 'text/plain; charset=utf-8',
      }
      const server = httpMod.createServer((req, res) => {
        let filePath
        try {
          const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0])
          filePath = path.join(serveDir, urlPath)
          if (urlPath.endsWith('/')) filePath = path.join(filePath, 'index.html')
          if (!filePath.startsWith(serveDir)) {
            res.writeHead(403).end()
            return
          }
          if (!fsMod.existsSync(filePath) || fsMod.statSync(filePath).isDirectory()) {
            // このテストで開くのはハッシュルーティングのアプリ本体だけなので、
            // 見つからないURLはindex.htmlを返す(vite previewと同じ振る舞い)
            filePath = path.join(serveDir, 'index.html')
          }
          const body = fsMod.readFileSync(filePath)
          res.writeHead(200, {
            'Content-Type': MIME_BY_EXT[path.extname(filePath)] ?? 'application/octet-stream',
            // 更新の検知を確実にするため、ブラウザのHTTPキャッシュは使わせない
            'Cache-Control': 'no-store',
          })
          res.end(body)
        } catch {
          res.writeHead(500).end()
        }
      })
      const updatePort = await pickFreePort('E2E_APPUPDATE_PORT')
      await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(updatePort, '127.0.0.1', resolve)
      })
      const updateBase = `http://localhost:${updatePort}`

      const upBrowser = await chromium.launch()
      try {
        const upCtx = await upBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const upPage = await upCtx.newPage()
        upPage.on('console', (msg) => {
          if (msg.type() !== 'error') return
          const text = msg.text()
          if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
          errors.push(`[console@APPUPDATE-01] ${text}`)
        })
        upPage.on('pageerror', (err) => errors.push(`[pageerror@APPUPDATE-01] ${err.message}`))
        upPage.on('dialog', (d) => void d.accept())

        // 初回訪問: Service Workerが入り、画面の制御を引き継ぐまで待つ
        await upPage.goto(`${updateBase}/`, { waitUntil: 'networkidle' })
        await upPage.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
          timeout: 30000,
        })
        // 「すでにService Workerに制御されている状態で開いた」= ふだんの利用と同じ状態にする
        await upPage.reload({ waitUntil: 'networkidle' })
        await upPage.waitForTimeout(2000)
        const upBanner = upPage.locator('[data-testid="app-update-banner"]')
        check('APPUPDATE-01 更新が無いときは帯を出さない', (await upBanner.count()) === 0)

        // ②調理中モードを開いている間は出さない
        await upPage.goto(`${updateBase}/#/recipes`, { waitUntil: 'networkidle' })
        await upPage.waitForTimeout(1500)
        await upPage.getByText('肉じゃが', { exact: true }).first().click()
        await upPage.waitForTimeout(900)
        await upPage.getByText(ja.focus.open).click()
        await upPage.waitForTimeout(700)
        check(
          'APPUPDATE-01 前提: 調理中モードが開いている',
          (await upPage.textContent('body')).includes('手順 1/'),
        )
        publishNewVersion()
        await upPage.evaluate(async () => {
          const registration = await navigator.serviceWorker.getRegistration()
          await registration?.update()
        })
        // インストール→有効化→制御の引き継ぎまで待つ
        await upPage.waitForTimeout(4000)
        check(
          'APPUPDATE-01 調理中モードの間は更新の帯を出さない(作業を壊さない)',
          (await upBanner.count()) === 0,
        )

        // 調理中モードを閉じると帯が出る
        await upPage.getByRole('button', { name: ja.common.close }).first().click()
        await upPage.waitForTimeout(800)
        check('APPUPDATE-01 調理中モードを閉じると更新の帯が出る', await upBanner.isVisible())
        const upBannerText = await upBanner.textContent()
        check(
          'APPUPDATE-01 帯に「新しいバージョンがあります」と「更新する」が出る',
          upBannerText.includes(ja.settings.appUpdateBannerTitle) && upBannerText.includes('更新する'),
        )
        check(
          'APPUPDATE-01 帯に、あとから設定でも更新できることが書いてある',
          upBannerText.includes('設定の「アプリの更新」'),
        )

        // ③閉じられる・そのセッションでは出し直さない
        await upPage.locator('[data-testid="app-update-banner-dismiss"]').click()
        await upPage.waitForTimeout(500)
        check('APPUPDATE-01 帯は閉じられる', (await upBanner.count()) === 0)
        await upPage.goto(`${updateBase}/#/settings`, { waitUntil: 'networkidle' })
        await upPage.waitForTimeout(1500)
        check(
          'APPUPDATE-01 閉じたあとは画面を移動しても帯を出し直さない',
          (await upBanner.count()) === 0,
        )

        // ④設定の「アプリの更新」から反映できる（帯を閉じたあとの受け皿）
        const upCheckButton = upPage.locator('[data-testid="app-update-check"]')
        check('APPUPDATE-01 設定に「最新の状態にする」がある', await upCheckButton.isVisible())
        // 2026-08-22 司令部: 文言を**2つとも書き写していた**ため、便JJで「〜で足ります」→
        // 「〜をお使いください」に直した瞬間に落ちた（禁じ手②）。ja.ts から読む形へ
        const upBody = (await upPage.textContent('body')).replaceAll('\u200b', '')
        check(
          'APPUPDATE-01 設定に「困ったとき」との使い分けが書いてある',
          upBody.includes(ja.settings.appUpdateVsRefreshNote) &&
            upBody.includes(ja.settings.refreshAppVsUpdateNote),
          `見つからない方=${!upBody.includes(ja.settings.appUpdateVsRefreshNote) ? 'appUpdateVsRefreshNote' : 'refreshAppVsUpdateNote'}`,
        )
        await upCheckButton.scrollIntoViewIfNeeded()
        await upPage.waitForTimeout(200)
        await upCheckButton.click()
        await upPage.waitForTimeout(500)
        check(
          'APPUPDATE-01 更新がある状態で押すと「新しいバージョンにしました」と伝える',
          (await upPage.textContent('body')).includes('新しいバージョンにしました'),
        )
        // 知らせを読ませてから画面を読み込み直す
        await upPage.waitForTimeout(3000)
        const upReloaded = await upPage.evaluate(
          () => performance.getEntriesByType('navigation')[0]?.type,
        )
        check(
          'APPUPDATE-01 「最新の状態にする」を押すと画面が読み込み直される',
          upReloaded === 'reload',
          `navigation type=${upReloaded}`,
        )

        // ⑤更新が無いときは「すでに最新」と伝える
        await upPage.goto(`${updateBase}/#/settings`, { waitUntil: 'networkidle' })
        await upPage.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
          timeout: 30000,
        })
        await upPage.waitForTimeout(2000)
        const upCheckButton2 = upPage.locator('[data-testid="app-update-check"]')
        await upCheckButton2.scrollIntoViewIfNeeded()
        await upPage.waitForTimeout(200)
        await upCheckButton2.click()
        await upPage.waitForTimeout(3000)
        check(
          'APPUPDATE-01 更新が無い状態で押すと「すでに最新のバージョンです」と伝える',
          stripZwspText(await upPage.textContent('body')).includes(ja.settings.appUpdateResultLatest),
        )
        check(
          'APPUPDATE-01 「すでに最新」のときは画面を読み込み直さない',
          (await upBanner.count()) === 0,
        )

        // ⑥古いキャッシュが積み上がっていない(Workboxの自動削除が効いている)
        const upCacheState = await upPage.evaluate(async () => {
          const keys = await caches.keys()
          const counts = {}
          for (const key of keys) counts[key] = (await (await caches.open(key)).keys()).length
          return { keys, counts }
        })
        check(
          'APPUPDATE-01 更新を挟んでもキャッシュは1つだけ(古い世代が残らない)',
          upCacheState.keys.length === 1,
          `caches=${upCacheState.keys.join(' / ')}`,
        )
      } finally {
        await upBrowser.close()
        server.closeAllConnections?.()
        await new Promise((resolve) => server.close(resolve))
        fsMod.rmSync(serveDir, { recursive: true, force: true })
      }
    }
  }

  // --- EQ-01: 2026-08-09 便EQ(オーナー実機)「作った記録」を見るための導線と表示。
  //  ①献立の「日」の「最近作ったもの」の料理名を押すと、記録の中身(日付・何人分・ひとことメモ・写真)の
  //    小窓が開く(レシピ詳細へ飛ばない)。写真は押すと拡大表示になる
  //  ②「作った記録の一覧」の行を押しても同じ小窓が開く
  //  ③献立の作った！済みの枠と、週タブの過去日の記録カードには「作った記録を見る」が出て、
  //    そこからも同じ小窓が開く(枠を押したときの「レシピを選び直す」は残す)
  //  ④一覧への入口は日・週・月の3タブで同じ「作った記録の一覧」という名前になっている
  //  ⑤小窓の「この記録を編集する」でレシピ詳細の編集フォームが開いた状態になる
  //  ⑥献立の「日」→一覧→戻る で、離れる前とほぼ同じスクロール位置に復元される ---
  currentCheck = 'EQ-01'
  {
    const eqBrowser = await chromium.launch()
    const eqContext = await eqBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const eqPage = await eqContext.newPage()
    eqPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@EQ-01] ${text}`)
    })
    eqPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EQ-01] ${err.message}`)
    })
    try {
      const eqPad = (n) => String(n).padStart(2, '0')
      const eqNow = new Date()
      const eqToday = `${eqNow.getFullYear()}-${eqPad(eqNow.getMonth() + 1)}-${eqPad(eqNow.getDate())}`
      const eqYd = new Date()
      eqYd.setDate(eqYd.getDate() - 1)
      const eqYesterday = `${eqYd.getFullYear()}-${eqPad(eqYd.getMonth() + 1)}-${eqPad(eqYd.getDate())}`

      await eqPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(1800) // 初回シード完了待ち

      // 肉じゃがに写真つきの記録を2件(今日・昨日)仕込む。月タブを見るためPro解錠も入れる
      // (実コードは台帳原本のため、NUT-02等と同じくsettings.proCodeの直書きで状態だけ再現)
      await eqPage.evaluate(
        async ([today, yesterday]) => {
          const makePhoto = async (text) => {
            const c = document.createElement('canvas')
            c.width = 320
            c.height = 180
            const g = c.getContext('2d')
            g.fillStyle = '#b4632a'
            g.fillRect(0, 0, c.width, c.height)
            g.fillStyle = '#fff'
            g.font = 'bold 28px sans-serif'
            g.fillText(text, 20, 100)
            return await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.8))
          }
          const photoA = await makePhoto('today')
          const photoB = await makePhoto('yesterday')
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          await new Promise((res, rej) => {
            const tx = idb.transaction(['recipes', 'settings'], 'readwrite')
            const store = tx.objectStore('recipes')
            const g = store.getAll()
            g.onsuccess = () => {
              const r = g.result.find((x) => x.title === '肉じゃが')
              if (!r) {
                rej(new Error('肉じゃがが見つからない'))
                return
              }
              r.cookedLogs = [
                { date: today, note: '甘めに仕上げたら好評だった', servings: 4, photo: photoA },
                { date: yesterday, note: 'じゃがいもは大きめに切った', servings: 3, photo: photoB },
              ]
              store.put(r)
              const s = tx.objectStore('settings')
              const gs = s.get(1)
              gs.onsuccess = () => {
                s.put({
                  ...(gs.result || { id: 1 }),
                  id: 1,
                  proCode: 'UR-E2E-TEST-ONLY',
                  proActivatedAt: Date.now(),
                })
              }
            }
            tx.oncomplete = () => res(undefined)
            tx.onerror = () => rej(tx.error)
          })
          idb.close()
        },
        [eqToday, eqYesterday],
      )

      // ---------- ① 献立の「日」の「最近作ったもの」 ----------
      // (2026-08-17 便HG: ホーム画面の廃止で、この一覧はホームから献立の「日」へ移った。
      //  測っているのは「行を押すと記録の小窓が開く(レシピ詳細へ飛ばない)」で変えていない)
      await eqPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eqPage.reload({ waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(1800)
      const eqHomeOpen = eqPage.getByRole('button', { name: '肉じゃがの作った記録を見る' }).first()
      check('EQ-01(①) 献立の「日」の「最近作ったもの」の行が記録を開くボタンになっている', (await eqHomeOpen.count()) === 1)
      await eqHomeOpen.click()
      await eqPage.waitForTimeout(700)
      check(
        'EQ-01(①) 押してもレシピ詳細へは移らない(その場で小窓が開く)',
        !/#\/recipes\/\d+/.test(eqPage.url()),
        `url=${eqPage.url()}`,
      )
      const eqDialog = eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' })
      const eqDialogText = (await eqDialog.textContent()) ?? ''
      // 2026-08-10 便FD で小窓をコンパクトにしたので期待値を更新:
      // 食数は料理名の横の括弧書き（「肉じゃが（4人分）」）になり、「何人分作ったか」の行は無くなった
      check(
        'EQ-01(①) 小窓に入力した情報が全部出る(日付・食数・ひとことメモ・写真)',
        eqDialogText.includes(eqToday.replaceAll('-', '/')) &&
          eqDialogText.includes('（4人分）') &&
          eqDialogText.includes('ひとことメモ') &&
          eqDialogText.includes('甘めに仕上げたら好評だった') &&
          eqDialogText.includes('写真'),
        eqDialogText.slice(0, 200),
      )
      // 2026-08-10 便FD: 「この記録を編集する」はレシピ詳細へのリンクをやめ、
      // その場で編集欄を開くボタンになった（「レシピを見る」はリンクのまま）
      check(
        'EQ-01(①) 小窓からレシピ詳細へ行ける／記録はその場で直せる',
        (await eqDialog.getByRole('button', { name: ja.cookedDetail.edit }).count()) === 1 &&
          (await eqDialog.getByRole('link', { name: 'レシピを見る' }).count()) === 1,
      )
      // 写真の拡大
      await eqDialog.getByRole('button', { name: ja.detail.cookedPhotoView }).click()
      await eqPage.waitForTimeout(600)
      const eqZoom = eqPage.locator('div[role="dialog"][aria-label="写真を拡大表示"]')
      check('EQ-01(①) 写真を押すと拡大表示の窓が開く', (await eqZoom.count()) === 1)
      const eqZoomBigger = await eqPage.evaluate(() => {
        const zoom = document.querySelector('div[role="dialog"][aria-label="写真を拡大表示"] img')
        const thumb = [...document.querySelectorAll('button[aria-label="写真を拡大表示"] img')][0]
        if (!zoom || !thumb) return null
        return { zoom: zoom.getBoundingClientRect().height, thumb: thumb.getBoundingClientRect().height }
      })
      check(
        'EQ-01(①) 拡大表示は小窓のサムネイルより大きい',
        !!eqZoomBigger && eqZoomBigger.zoom > eqZoomBigger.thumb,
        eqZoomBigger ? `拡大=${Math.round(eqZoomBigger.zoom)} サムネ=${Math.round(eqZoomBigger.thumb)}` : 'not found',
      )
      // Escapeで拡大だけが閉じ、下の小窓は開いたまま(重ね窓は1枚ずつ閉じる)
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(500)
      check(
        'EQ-01(①) Escapeで拡大表示だけが閉じ、記録の小窓は開いたまま',
        (await eqZoom.count()) === 0 && (await eqDialog.count()) === 1,
      )
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(500)
      check('EQ-01(①) もう一度Escapeで記録の小窓も閉じる', (await eqDialog.count()) === 0)

      // ---------- ④ 入口の名前がそろっている ----------
      // 2026-08-17 便HG: 「最近作ったもの」が献立の「日」へ移り、その下に前からある
      // 「作った記録の一覧」と隣り合った。同じ行き先のリンクを2つ並べないと決めたので、
      // この画面に入口は1つだけであることも合わせて見る
      check(
        'EQ-01(④) 献立の「日」の入口が「作った記録の一覧」という名前で1つだけある',
        (await eqPage.getByRole('link', { name: '作った記録の一覧' }).count()) === 1,
      )

      // ---------- ⑥ 献立の「日」→一覧→戻る のスクロール位置復元 ----------
      const eqHomeLink = eqPage.getByRole('link', { name: '作った記録の一覧' }).first()
      await eqHomeLink.scrollIntoViewIfNeeded()
      await eqPage.waitForTimeout(400)
      const eqScrollBefore = await eqPage.evaluate(() => Math.round(window.scrollY))
      await eqHomeLink.click()
      await eqPage.waitForTimeout(900)
      check(
        'EQ-01(④) 一覧の見出しも「作った記録の一覧」になっている',
        ((await eqPage.textContent('body')) ?? '').includes('作った記録の一覧'),
      )

      // ---------- ② 一覧の行から同じ小窓が開く ----------
      const eqListOpen = eqPage.getByRole('button', { name: '肉じゃがの作った記録を見る' }).first()
      check('EQ-01(②) 一覧の行が記録を開くボタンになっている', (await eqListOpen.count()) >= 1)
      await eqListOpen.click()
      await eqPage.waitForTimeout(700)
      check(
        'EQ-01(②) 一覧からも同じ小窓が開く',
        (await eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' }).count()) === 1,
      )

      // ---------- ⑤ 「この記録を編集する」でその場に編集欄が開く ----------
      // 2026-08-10 便FD で期待値を更新（旧: レシピ詳細へ移って編集フォームが開く）。
      // オーナー実機「カレンダーなどから編集するを選択すると、問答無用でレシピ詳細画面に
      // 飛ばされる。カレンダーなどの元の画面で編集が完結できるようにして」
      await eqPage
        .getByRole('dialog', { name: '肉じゃがの作った記録' })
        .getByRole('button', { name: ja.cookedDetail.edit })
        .click()
      await eqPage.waitForTimeout(800)
      check(
        'EQ-01(⑤) レシピ詳細へは移らない(元の画面のまま)',
        !/#\/recipes\/\d+/.test(eqPage.url()),
        `url=${eqPage.url()}`,
      )
      check(
        'EQ-01(⑤) 小窓の中に編集欄が開く(日付欄と「保存する」が出る)',
        (await eqPage.locator('[data-testid="cooked-log-editor"]').count()) === 1 &&
          (await eqPage.locator('[data-testid="cooked-log-editor"] input[type="date"]').count()) === 1 &&
          (await eqPage.getByRole('button', { name: '保存する' }).count()) >= 1,
      )
      await eqPage.getByRole('button', { name: ja.common.confirmCancel }).click()
      await eqPage.waitForTimeout(500)

      // ---------- ⑥ 献立の「日」へ戻ったときのスクロール位置 ----------
      await eqPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(1200)
      // 2026-08-17 便HI: 「離れる前の位置」は**押す直前**の値で測る。
      // scrollIntoViewIfNeeded は画面下に貼り付く帯（タブナビ）を勘定に入れないので、
      // そのあとのクリックが帯を避けてもう一度送る＝先に測ると測った値と実際に離れた位置が
      // 食い違う（実測: 測った値2px／実際に離れた位置111px。アプリは覚えたとおりに戻していて正常）。
      // hover はクリックと同じ位置合わせを行うので、これを済ませてから測る
      const eqHistoryLink = eqPage.getByRole('link', { name: '作った記録の一覧' }).first()
      await eqHistoryLink.hover()
      await eqPage.waitForTimeout(400)
      const eqScrollBefore2 = await eqPage.evaluate(() => Math.round(window.scrollY))
      await eqHistoryLink.click()
      await eqPage.waitForTimeout(900)
      await eqPage.getByRole('button', { name: ja.common.back }).first().click()
      await eqPage.waitForTimeout(1500)
      const eqScrollAfter = await eqPage.evaluate(() => Math.round(window.scrollY))
      /**
       * いま送れる限界（ページの下端）。
       *
       * 2026-08-20 便II で、この検査が「単独では緑・続けて流すと赤（82px）」になる正体を
       * 切り分けた。**⑥（「作った！」を整理モードへ移した）とは関係が無い**——この検査の土台では
       * 今日の献立が1品も無く、「今日の献立」の節そのものが画面に出ていない（整理ボタンも行も0個）。
       *
       * 本当の原因は「今日なに作る？」で、**戻るたびに別の献立を組み直す**こと。主菜が
       * 一品もの（カレー・丼・麺・鍋）だと副菜のカードが付かず、節の高さが実測 156〜170px →
       * 74px、ページの下端が **82px 上がる**（6回流して 2枚→1枚 になった回だけ再現）。
       * 「作った記録の一覧」への入口はページのいちばん下にあるので、離れる直前の位置は
       * **必ずページの下端**になる＝下端が動けば、覚えた位置はもう存在しない。
       *
       * アプリはこのとき下端まで戻す（logic上の Math.min(覚えた位置, 送れる限界)）。これは
       * 利用者にとっても正しい——無い場所へは戻せない。よって**期待値も同じ形で書く**。
       * 縦位置を決め打ちすると、乱数で変わる高さのぶんだけテストが赤くなる（禁じ手④）。
       */
      const eqReachAfter = await eqPage.evaluate(() =>
        Math.round(document.documentElement.scrollHeight - window.innerHeight),
      )
      const eqExpectedScroll = Math.min(eqScrollBefore2, Math.max(0, eqReachAfter))
      // 素通り防止: 離れる前に実際に送れていて、戻った先にも送れる高さが残っていること。
      // どちらかが0なら「動かないページで測っていた」＝この検査は何も見ていない
      check(
        'EQ-01(⑥) 前提: 離れる前にページを送れていて、戻った先にも送れる高さがある',
        eqScrollBefore2 > 0 && eqReachAfter > 0,
        `離れる前=${eqScrollBefore2} / 戻った先の限界=${eqReachAfter}`,
      )
      check(
        'EQ-01(⑥) 一覧から戻ると献立の「日」は離れる前とほぼ同じスクロール位置になる(誤差40px以内)',
        Math.abs(eqScrollAfter - eqExpectedScroll) <= 40,
        `before=${eqScrollBefore2}(初回=${eqScrollBefore}) / after=${eqScrollAfter} / 戻った先の限界=${eqReachAfter} / 期待=${eqExpectedScroll}`,
      )
      check(
        'EQ-01(⑥) 復元に使ったクエリ(restore)はURLから消える',
        !eqPage.url().includes('restore='),
        `url=${eqPage.url()}`,
      )

      // ---------- ③ 献立: 週タブの過去日カード と 作った！済みの枠 ----------
      await eqPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(1000)
      check(
        'EQ-01(④) 献立の日タブにも「作った記録の一覧」の入口がある',
        (await eqPage.getByRole('link', { name: '作った記録の一覧' }).count()) >= 1,
      )
      await eqPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(eqPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await eqPage.waitForTimeout(900)
      // 週タブは月曜始まりで、表示中の週は sessionStorage に覚えられる(便DT-2「戻ったら同じ場所へ返す」)。
      // つまり画面を開き直しても今週には戻らない。目的の日のカードが出るまで週を送る形にする
      // (今日が月曜だと「昨日」=日曜が前の週に入り、旧実装は前の週へ移ったまま帰れず必ず落ちた。2026-08-10 実発)
      //
      // 2026-08-24 便KH: **着いた週で必ず開き直す**ようにした。
      // 曜日カードの畳み方(dayFoldOverrides)は日付をキーに覚えるので、週を送った先の日は
      // 「人が押して開けた」記憶が無く既定に戻る＝過ぎた日は畳んだまま(便ID・⑦)。
      // 畳んだカードは中身をDOMに出さないため、送った先で肉じゃがのリンクも
      // 「作った記録を見る」も0件になり、scrollIntoViewIfNeeded が30秒待って**実行が中断**していた。
      // 時計を固定した実測: 日曜(2026-08-23)は昨日=土曜が同じ週なので週送り0回で緑、
      // 月曜(2026-08-24)は昨日=日曜が前の週に入り週送り1回→7日とも畳み(aria-expanded=false)、
      // リンク0件・ボタン0件。アプリ側は正常で(畳んだ見出しに「作った記録あり」の印は出ている)、
      // 開き直せば同じ週で肉じゃがのカードもボタンも出る。JFPAST-01 が同じ作法(送ってから開く)。
      const eqShowWeekWith = async (date) => {
        const eqAtWeek = async () =>
          (await eqPage.locator(`section[data-date="${date}"]`).count()) > 0
        for (let i = 0; i < 4; i++) {
          if (await eqAtWeek()) {
            await openAllWeekDays(eqPage)
            return true
          }
          const shown = await eqPage.locator('section[data-date]').first().getAttribute('data-date')
          const dir = shown && date < shown ? ja.mealPlan.prevWeek : ja.mealPlan.nextWeek
          await eqPage.locator(`button[aria-label="${dir}"]`).click()
          await eqPage.waitForTimeout(600)
        }
        if (!(await eqAtWeek())) return false
        await openAllWeekDays(eqPage)
        return true
      }
      check('EQ-01(③) 昨日を含む週を表示できる', await eqShowWeekWith(eqYesterday), `昨日=${eqYesterday}`)
      // 週タブの過去日カードは従来どおりレシピ詳細へのリンクのまま(便DT-2の動線を壊さない)
      check(
        'EQ-01(③) 週タブの過去日カードはレシピ詳細へのリンクのまま残っている',
        (await eqPage.locator('a[href*="#/recipes/"]').filter({ hasText: '肉じゃが' }).count()) >= 1,
      )
      const eqWeekOpen = eqPage.getByRole('button', { name: '肉じゃがの作った記録を見る' }).first()
      check('EQ-01(③) 週タブの過去日カードに「作った記録を見る」が足されている', (await eqWeekOpen.count()) >= 1)
      await eqWeekOpen.scrollIntoViewIfNeeded()
      await eqWeekOpen.click()
      await eqPage.waitForTimeout(700)
      check(
        'EQ-01(③) 週タブからも同じ小窓が開く',
        (await eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' }).count()) === 1,
      )
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(500)

      // 今日の夕食の主菜に肉じゃがを入れる → 今日の記録があるので枠が「作った！済み」になる。
      // 上で「前の週」へ動いていることがあるので、今週へ開き直してから操作する
      await eqPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(900)
      await eqPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(eqPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await eqPage.waitForTimeout(900)
      check('EQ-01(③) 今日を含む週へ帰れる', await eqShowWeekWith(eqToday), `今日=${eqToday}`)
      const eqTodaySection = eqPage.locator(`section[data-date="${eqToday}"]`)
      // 2026-08-22 便IV: 空き枠は編集モードの中にしか出さない
      check(
        'EQ-01 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(eqPage, eqToday)) === true,
      )
      await eqTodaySection.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
      await eqPage.waitForTimeout(600)
      await eqPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await eqPage.waitForTimeout(500)
      await eqPage
        .locator('[data-testid="recipe-picker"]')
        .getByText('肉じゃが', { exact: true })
        .first()
        .click()
      await eqPage.waitForTimeout(1000)
      const eqPlanOpen = eqTodaySection
        .getByRole('button', { name: '肉じゃがの作った記録を見る' })
        .first()
      check('EQ-01(③) 作った！済みの枠の下に「作った記録を見る」が出る', (await eqPlanOpen.count()) === 1)
      // 作った！済みの枠でも「レシピを変更」で選び直せるまま(便DP-5の裁定を壊さない)。
      // 2026-08-25 便KU: 差し替えは枠そのものの押下から「レシピを変更」のボタンへ移った
      // （枠の押下はレシピ詳細＝アプリの他のレシピカードと同じ行き先）
      const eqRowStillEditable = await eqPage.evaluate((d) => {
        const sec = document.querySelector(`section[data-date="${d}"]`)
        const row = [...(sec?.querySelectorAll('[data-testid="plan-row"]') ?? [])].find((r) =>
          (r.textContent ?? '').includes('肉じゃが'),
        )
        const change = row?.querySelector('[data-testid="slot-change-recipe"]')
        return change ? !change.disabled : null
      }, eqToday)
      check('EQ-01(③→便KU) 作った！済みの枠でも「レシピを変更」で選び直せるまま', eqRowStillEditable === true)
      await eqPlanOpen.click()
      await eqPage.waitForTimeout(700)
      check(
        'EQ-01(③) 献立の枠からも同じ小窓が開く',
        (await eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' }).count()) === 1,
      )
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(500)

      // ---------- ③ 月タブの日の窓 ----------
      await eqPage.getByRole('button', { name: '月', exact: true }).click()
      await eqPage.waitForTimeout(900)
      check(
        'EQ-01(④) 月タブの入口も「作った記録の一覧」',
        (await eqPage.getByRole('link', { name: '作った記録の一覧' }).count()) >= 1,
      )
      await eqPage.locator(`button[data-date="${eqToday}"]`).first().click()
      await eqPage.waitForTimeout(700)
      const eqMonthOpen = eqPage.getByRole('button', { name: '肉じゃがの作った記録を見る' }).first()
      check('EQ-01(③) 月タブの日の窓の記録カードが記録を開くボタンになっている', (await eqMonthOpen.count()) >= 1)
      await eqMonthOpen.click()
      await eqPage.waitForTimeout(700)
      check(
        'EQ-01(③) 月タブの日の窓からも同じ小窓が開く',
        (await eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' }).count()) === 1,
      )
      // 重ね窓: 戻る/Escapeで上の1枚(小窓)だけが閉じ、日の窓は開いたまま
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(600)
      check(
        'EQ-01(③) 小窓を閉じても下の日の窓は開いたまま(1回で1枚だけ閉じる)',
        (await eqPage.getByRole('dialog', { name: '肉じゃがの作った記録' }).count()) === 0 &&
          (await eqPage.locator('[role="dialog"]').count()) >= 1,
      )

      // ---------- 記録が無いレシピでは小窓の入口が出ない(誤って空の窓を開かせない) ----------
      await eqPage.keyboard.press('Escape')
      await eqPage.waitForTimeout(500)
      await eqPage.goto(`${BASE}/#/history`, { waitUntil: 'networkidle' })
      await eqPage.waitForTimeout(900)
      check(
        'EQ-01(②) 一覧には仕込んだ2件だけが出る',
        ((await eqPage.textContent('body')) ?? '').includes('全2件'),
        ((await eqPage.textContent('body')) ?? '').slice(0, 120),
      )
    } finally {
      await eqBrowser.close()
    }
  }


  // --- MULTIDEV-01: 2026-08-09 便EV「複数の端末で使う方法」(/about/multi-device.html)。
  // 端末内保存のアプリで機種変更・2台目・クラウド運用をどう回すかを手順にした静的ページ。
  //  (a) ページが200で開き、SWが動くpreviewでもアプリ本体(SPAシェル)にすり替わらない
  //  (b) 必要な節(機種変更・2台目・クラウドの注意・定期的な書き出し)がそろっている
  //  (c) ページ内のリンク・画像がすべて生きている(リンク切れ無し)
  //  (d) ライト/ダークの両方で本文が読める(本文と背景のコントラスト比4.5:1以上)
  //  (e) 390px幅で横にはみ出さない
  //  (f) 紹介ページ・使い方ページ・ホーム画面追加ページからの導線があり、sitemapに載っている
  //  (g) 2026-08-10 便FH「長文ばかりで読みづらい」の対応後の作り(読みやすさ)を固定する:
  //      ・g-1 読み飛ばしても要旨が拾えるよう、本文のかたまりが長文に戻っていない
  //        (段落・箇条書き1件あたり100字未満。折りたたみの中だけ例外＝畳んだ但し書き)
  //      ・g-2 「消えるもの/残るもの」は見くらべの表(table.cmp)で両方書く
  //      ・g-3 読まずに事故る6項目は**折りたたみの中に入れない**(details配下に無いこと)。
  //        規約F両記・iPhoneのブラウザ/ホーム画面の分離・クラウドは同期でない・
  //        「今のデータに追加」で書き換えが入らない・解錠コードの共有設定・定期書き出しの目安と置き場所
  //      ・g-4 細かい但し書きは折りたたみに入れて既定で閉じている ---
  currentCheck = 'MULTIDEV-01'
  {
    const mdBrowser = await chromium.launch()
    try {
      // 相対輝度からコントラスト比を出す(WCAG 2.x)。rgb()文字列をそのまま受ける
      const evContrast = (fg, bg) => {
        const lum = (css) => {
          const [r, g, b] = css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
          const ch = (v) => {
            const s = v / 255
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
        }
        const a = lum(fg)
        const b = lum(bg)
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
      }

      for (const scheme of ['light', 'dark']) {
        const evContext = await mdBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
        })
        const evPage = await evContext.newPage()
        evPage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
          errors.push(`[pageerror@MULTIDEV-01] ${err.message}`)
        })
        const evRes = await evPage.goto(`${BASE}/about/multi-device.html`, { waitUntil: 'networkidle' })
        check(`MULTIDEV-01(a) ${scheme}: ページが200で開く`, evRes.status() === 200, `status=${evRes?.status()}`)
        const evInfo = await evPage.evaluate(() => {
          const style = (sel) => {
            const el = document.querySelector(sel)
            if (!el) return null
            const cs = getComputedStyle(el)
            return { color: cs.color, size: parseFloat(cs.fontSize) }
          }
          return {
            title: document.title,
            h1: document.querySelector('h1')?.textContent?.trim() ?? '',
            heads: [...document.querySelectorAll('h2,h3')].map((h) => h.textContent.trim()),
            // アプリ本体(SPAシェル)にすり替わっていたらルート要素が出る
            appRoot: !!document.querySelector('#root'),
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            overflow: [...document.querySelectorAll('main *')].filter(
              (el) => el.getBoundingClientRect().right > window.innerWidth + 1,
            ).length,
            pageBg: getComputedStyle(document.body).backgroundColor,
            surfaceBg: getComputedStyle(document.querySelector('.note')).backgroundColor,
            body: style('main p'),
            muted: style('p.muted'),
            noteLink: style('.note a'),
          }
        })
        check(`MULTIDEV-01(a) ${scheme}: 静的ページのままでアプリ本体にすり替わらない`, evInfo.appRoot === false)
        check(
          `MULTIDEV-01(a) ${scheme}: 見出しがページのものになっている`,
          evInfo.h1 === '複数の端末で使う方法' && evInfo.title.includes('複数の端末で使う方法'),
          `h1=${evInfo.h1} / title=${evInfo.title}`,
        )
        if (scheme === 'light') {
          for (const kw of [
            '機種変更',
            '読み込みは「追加」と「上書き」の2種類',
            '2台目の端末',
            'クラウドを使うときに気をつけること',
            '定期的に書き出しておく',
          ]) {
            check(`MULTIDEV-01(b) ${kw} の節がある`, evInfo.heads.some((h) => h.includes(kw)), evInfo.heads.join(' / '))
          }
          // 規約F: 「消えるもの」と「残るもの」を両方書いているか
          const evText = await evPage.textContent('main')
          check('MULTIDEV-01(b) 上書きで消えるものと残るものを両方書いている', evText.includes('消えるもの') && evText.includes('残るもの'))
          // 2026-08-22 司令部: ここは**1文をそのまま書き写していた**ため、長文を短くした瞬間に
          // 落ちた（禁じ手②）。実際には見出しが同じことを言っており、事実は消えていない。
          // 「iPhone・iPad」「ブラウザ」「ホーム画面」「分かれる/別々」の4つがそろっているか、
          // という**意図**で測る。言い回しを変えても、事実が残っていれば通る
          const evSplitWords = ['iPhone', 'iPad', 'ブラウザ', 'ホーム画面']
          check(
            'MULTIDEV-01(b) iPhone・iPadでブラウザとホーム画面のデータが分かれることに触れている',
            evSplitWords.every((w) => evText.includes(w)) &&
              (evText.includes('分かれ') || evText.includes('別々')),
            `そろっていない語=${evSplitWords.filter((w) => !evText.includes(w)).join('・') || '（分かれる/別々が無い）'}`,
          )

          // (g-2) 「追加」と「上書き」の違いを見くらべの表で出す(2026-08-10 便FH)。
          // 以前は同じ内容を機種変更の注意カードとクラウドの箇条書きの2箇所に長文で書いていた
          const evTable = await evPage.evaluate(() => {
            const t = document.querySelector('table.cmp')
            if (!t) return null
            return {
              cols: [...t.querySelectorAll('thead th')].map((th) => th.textContent.trim()),
              rows: [...t.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((c) => c.textContent.trim())),
            }
          })
          check('MULTIDEV-01(g-2) 「追加」と「上書き」の見くらべの表がある', evTable !== null)
          if (evTable) {
            const evRow = (name) => evTable.rows.find((r) => r[0] === name)
            check(
              'MULTIDEV-01(g-2) 表の列が「今のデータに追加」「データを上書き」',
              evTable.cols.includes('今のデータに追加') && evTable.cols.includes('データを上書き'),
              JSON.stringify(evTable.cols),
            )
            check(
              'MULTIDEV-01(g-2) 表に「消えるもの」「残るもの」の行がある',
              !!evRow('消えるもの') && !!evRow('残るもの'),
              JSON.stringify(evTable.rows.map((r) => r[0])),
            )
            check(
              'MULTIDEV-01(g-2) 上書きで消えるのはレシピ・作った記録・食材の価格',
              evRow('消えるもの')?.[2] === '読み込む端末のレシピ・作った記録・食材の価格',
              evRow('消えるもの')?.[2],
            )
            check(
              'MULTIDEV-01(g-2) 上書きでもPro版の解錠コードは残る',
              evRow('残るもの')?.[2]?.includes('Pro版の解錠コード'),
              evRow('残るもの')?.[2],
            )
            check(
              'MULTIDEV-01(g-2) 「今のデータに追加」は1件も消えない',
              evRow('消えるもの')?.[1]?.includes('1件も消えません'),
              evRow('消えるもの')?.[1],
            )
            // 2026-08-22 便JA: 振る舞いが「黙って入らない」から「入らなかった品に番号を付けて
            // 入れるか聞く」に変わった。**語の組み合わせ**で測る（1文の書き写しは禁じ手②）
            check(
              'MULTIDEV-01(g-2) 「今のデータに追加」で今あるレシピの内容が変わらないと書いてある',
              (evRow('同じ料理名のレシピ')?.[1] ?? '').includes('今の内容のまま'),
              evRow('同じ料理名のレシピ')?.[1],
            )
            check(
              'MULTIDEV-01(g-2) 同じ料理名でも番号を付けて足せると書いてある',
              (evRow('同じ料理名のレシピ')?.[1] ?? '').includes('番号'),
              evRow('同じ料理名のレシピ')?.[1],
            )
          }

          // (g-3) 読まずに事故る項目が折りたたみ(details)の中に隠れていないこと。
          // 短くする改修のたびに「畳んで短く見せる」誘惑が働く箇所なので機械で止める
          const evMustShow = [
            ['規約F・消えるもの', '消えるもの'],
            ['規約F・残るもの', '残るもの'],
            ['上書き前の控えと「元に戻す」', '設定の画面を開いている間は「元に戻す」で戻せます'],
            // 2026-08-22 司令部: ここだけ**語の組み合わせ**で書いてある（下の evaluate は配列も受ける）。
            // 1文の書き写しは、長文を短くした瞬間に落ちる（禁じ手②で実発）。
            // 他の項目も、文言を直すときはこの形に移すこと
            ['iPhone・iPadでブラウザとホーム画面のデータが分かれる', ['iPhone', 'ホーム画面', '分かれ']],
            ['クラウドに置いても同期ではない', 'クラウドに置いても、同期にはなりません'],
            ['クラウドのファイルを自動で読み書きしない', '自動で読み書きすることはありません'],
            ['「今のデータに追加」では同じ料理名のレシピが変わらない', ['同じ料理名のレシピ', '今の内容のまま']],
            ['「今のデータに追加」では書き換えた材料・手順が入らない', ['書き換えた材料', '手順', '入りません']],
            // 2026-08-22 便JA: 入らなかった品を知らせて聞くようになったので、その2点を足す
            // 2026-08-27 便LS: オーナー指示で「入りませんでした」→「追加できませんでした」に
            // そろえた（ja.ts 全体で「足す」→「追加」）。**見張る中身は変えない**＝
            // 「入らなかったことを知らせ、番号を付けるかを聞く」ことがページに書いてあること
            ['追加できなかった品があると知らせて聞くことを書いている', ['追加できなかった品', '聞かれます']],
            ['番号を付けても今あるレシピは変わらないことを書いている', ['番号', '今あるレシピ', 'そのまま']],
            ['バックアップファイルに解錠コードが含まれる', 'バックアップファイルにはPro版の解錠コードが含まれます'],
            ['クラウドの共有設定の注意', 'リンクを知っている人が開ける共有設定にしないでください'],
            ['定期的な書き出しの目安', '目安は月に1回'],
            ['置き場所を端末の中だけにしない', '置き場所は、使っている端末の中だけにしない'],
          ]
          const evPlacement = await evPage.evaluate((phrases) => {
            const norm = (s) => s.replace(/\s+/g, '')
            const els = [...document.querySelectorAll('main *')]
            return phrases.map(([label, text]) => {
              // text は1つの文でも、語の配列でもよい（配列なら**全部そろっている要素**を探す）
              const needles = (Array.isArray(text) ? text : [text]).map(norm)
              const hits = els.filter((el) => {
                const t = norm(el.textContent)
                return needles.every((n) => t.includes(n))
              })
              return {
                label,
                found: hits.length > 0,
                outside: hits.some((el) => !el.closest('details')),
              }
            })
          }, evMustShow)
          for (const ph of evPlacement) {
            check(`MULTIDEV-01(g-3) ${ph.label} がページにある`, ph.found)
            check(`MULTIDEV-01(g-3) ${ph.label} が折りたたみの中に畳まれていない`, ph.outside)
          }

          // (g-1) 長文に戻っていないか。折りたたみの中(畳んである但し書き)は対象外
          const evLong = await evPage.evaluate(() => {
            const blocks = [...document.querySelectorAll('main p, main li, main figcaption')].filter(
              (el) => !el.closest('details') && !el.querySelector('p, ul, ol, figure'),
            )
            const lens = blocks
              .map((el) => ({
                len: [...el.textContent.replace(/\s+/g, ' ').trim()].length,
                text: el.textContent.trim().slice(0, 30),
              }))
              .sort((a, b) => b.len - a.len)
            return { max: lens[0], over100: lens.filter((l) => l.len >= 100).length, count: lens.length }
          })
          check(
            'MULTIDEV-01(g-1) 本文のかたまりが100字以上の長文になっていない',
            evLong.over100 === 0,
            `最長=${evLong.max?.len}字「${evLong.max?.text}」/ 100字以上=${evLong.over100}件 / 対象=${evLong.count}件`,
          )

          // (g-4) 細かい但し書きは折りたたみへ。既定では閉じている
          const evDetails = await evPage.evaluate(() =>
            [...document.querySelectorAll('details')].map((d) => ({
              open: d.open,
              summary: d.querySelector('summary')?.textContent?.trim() ?? '',
            })),
          )
          check('MULTIDEV-01(g-4) 細かい但し書きを折りたたみに入れている', evDetails.length >= 2, `件数=${evDetails.length}`)
          check(
            'MULTIDEV-01(g-4) 折りたたみは既定で閉じていて見出しが付いている',
            evDetails.length > 0 && evDetails.every((d) => d.open === false && d.summary.length > 0),
            JSON.stringify(evDetails),
          )
        }
        check(
          `MULTIDEV-01(d) ${scheme}: 本文と背景のコントラストが4.5:1以上`,
          evContrast(evInfo.body.color, evInfo.pageBg) >= 4.5,
          `比=${evContrast(evInfo.body.color, evInfo.pageBg).toFixed(2)}`,
        )
        check(
          `MULTIDEV-01(d) ${scheme}: 補足文と背景のコントラストが4.5:1以上`,
          evContrast(evInfo.muted.color, evInfo.pageBg) >= 4.5,
          `比=${evContrast(evInfo.muted.color, evInfo.pageBg).toFixed(2)}`,
        )
        check(
          `MULTIDEV-01(d) ${scheme}: カード面のリンクと面のコントラストが4.5:1以上`,
          evContrast(evInfo.noteLink.color, evInfo.surfaceBg) >= 4.5,
          `比=${evContrast(evInfo.noteLink.color, evInfo.surfaceBg).toFixed(2)}`,
        )
        check(
          `MULTIDEV-01(e) ${scheme}: 390px幅で横にはみ出さない`,
          evInfo.scrollWidth <= evInfo.innerWidth && evInfo.overflow === 0,
          `scrollWidth=${evInfo.scrollWidth} / はみ出し要素=${evInfo.overflow}`,
        )
        if (scheme === 'light') {
          // (c) リンク・画像の生存確認(リンク切れ無し)
          const evUrls = await evPage.evaluate(() =>
            [
              ...[...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
              ...[...document.querySelectorAll('img')].map((i) => i.getAttribute('src')),
            ].filter((v, i, arr) => arr.indexOf(v) === i),
          )
          check('MULTIDEV-01(c) ページ内リンクと画像が5件以上ある', evUrls.length >= 5, `件数=${evUrls.length}`)
          for (const url of evUrls) {
            const r = await evPage.request.get(`${BASE}${url}`)
            check(`MULTIDEV-01(c) リンク/画像 ${url}`, r.status() === 200, `status=${r.status()}`)
          }
          // ページ内アンカー(飛び先のチップ)の行き先が実在するか
          const evAnchors = await evPage.evaluate(() =>
            [...document.querySelectorAll('nav.jump a')].map((a) => ({
              href: a.getAttribute('href'),
              exists: !!document.querySelector(a.getAttribute('href')),
            })),
          )
          // 2026-08-10 便FH: 「読み込みは「追加」と「上書き」の2種類」の節を足したのでチップは5つ
          check('MULTIDEV-01(c) 飛び先チップが5つあり、行き先がすべて実在する', evAnchors.length === 5 && evAnchors.every((a) => a.exists), JSON.stringify(evAnchors))
        }
        await evContext.close()
      }

      // (f) 導線: 紹介ページ・使い方ページ・ホーム画面追加ページ・sitemap
      const evLp = await (await page.request.get(`${BASE}/about/`)).text()
      // 2026-08-10 便FG: 小見出しは「バックアップでレシピを保存」に変わった(導線はそのまま)
      check('MULTIDEV-01(f) 紹介ページの「バックアップでレシピを保存」から辿れる', evLp.includes('/about/multi-device.html'))
      check(
        'MULTIDEV-01(f) 紹介ページのよくある質問(複数の端末)からも辿れる',
        evLp.indexOf('/about/multi-device.html', evLp.indexOf('複数の端末で同じデータを使えますか')) > -1,
      )
      const evManual = await (await page.request.get(`${BASE}/about/manual.html`)).text()
      // 2026-08-13 便FY: 「複数の端末で使う方法」への案内は§11(共有)にも増えたので、
      // ページ内の**最初の**出現ではなく、§12の見出しより後ろの出現を見る。
      // 見出しの直後にあること(400字以内)という判定の意図はそのまま
      const evManualHead = evManual.indexOf('12</span>バックアップと機種変更')
      const evManualLink =
        evManualHead > -1 ? evManual.indexOf('/about/multi-device.html', evManualHead) : -1
      check(
        'MULTIDEV-01(f) 使い方ページの「バックアップと機種変更」の冒頭から辿れる',
        evManualHead > -1 && evManualLink > -1 && evManualLink - evManualHead < 400,
        `見出し=${evManualHead} リンク=${evManualLink}`,
      )
      const evInstall = await (await page.request.get(`${BASE}/about/install.html`)).text()
      check('MULTIDEV-01(f) ホーム画面追加ページからも辿れる', evInstall.includes('/about/multi-device.html'))
      const evSitemap = await (await page.request.get(`${BASE}/sitemap.xml`)).text()
      check('MULTIDEV-01(f) sitemapに載っている', evSitemap.includes('https://uchirecipe.com/about/multi-device.html'))
    } finally {
      await mdBrowser.close()
    }
  }

  // --- ET-00: 横スクロールが出ない（2026-08-09 便ET・本番不具合の再発防止） ---
  // 共通の折りたたみ(components/Collapse.tsx)の外側gridに列指定が無く、暗黙の1列が
  // auto扱い＝最小幅が中身のmin-contentになっていた。折り返せない中身（献立の週タブの
  // 料理名カード・「＋料理を追加」）があると列が親より広くなり、390px幅でページごと
  // 横スクロールした（実測 document.scrollWidth 512〜529 / clientWidth 390）。
  // 再現には「長い料理名」が要る（肉じゃがのような短い名前では出ない）ので、
  // 献立にわざと長い名前の品を入れてから測る。
  currentCheck = 'ET-00'
  {
    const etoBrowser = await chromium.launch()
    try {
      const etoCtx = await etoBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const etoPage = await etoCtx.newPage()
      etoPage.on('pageerror', (err) => errors.push(`[pageerror@ET-00] ${err.message}`))
      const etoWidth = () =>
        etoPage.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }))
      /** 折りたたみ(Collapse)の内側が外側より広くなっていないか＝はみ出しの発生源そのもの */
      const etoCollapseOver = () =>
        etoPage.evaluate(() => {
          const over = []
          for (const outer of document.querySelectorAll('div[style*="grid-template-rows"]')) {
            const inner = outer.firstElementChild
            if (!inner) continue
            const or = outer.getBoundingClientRect()
            const ir = inner.getBoundingClientRect()
            if (ir.width > or.width + 0.5)
              over.push({ outerW: Math.round(or.width), innerW: Math.round(ir.width) })
          }
          return over
        })

      await etoPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await etoPage.waitForTimeout(2000)
      const etoNow = new Date()
      const etoPad = (n) => String(n).padStart(2, '0')
      const etoToday = `${etoNow.getFullYear()}-${etoPad(etoNow.getMonth() + 1)}-${etoPad(etoNow.getDate())}`
      await etoPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(etoPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await etoPage.waitForTimeout(1200)
      const etoEmpty = await etoWidth()
      check(
        'ET-00 献立の週タブ(献立なし)で横スクロールが出ない',
        etoEmpty.sw === etoEmpty.cw,
        JSON.stringify(etoEmpty),
      )

      // 今日の枠に長い名前の品を2つ入れる（主菜→副菜の順に「レシピを選ぶ」が繰り上がる）
      const etoLongTitles = ['レンジ蒸し鶏（自家製サラダチキン）', 'ブロッコリーとにんじんのハーブマリネ']
      // 2026-08-22 便IV: 空き枠は編集モードの中にしか出さない
      check(
        'ET-00 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(etoPage, etoToday)) === true,
      )
      for (const title of etoLongTitles) {
        const etoSection = etoPage.locator(`section[data-date="${etoToday}"]`)
        const etoPick = etoSection.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first()
        await etoPick.scrollIntoViewIfNeeded()
        await etoPick.click()
        await etoPage.waitForTimeout(700)
        await etoPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill(title)
        await etoPage.waitForTimeout(500)
        await etoPage
          .locator('[data-testid="recipe-picker"]')
          .getByText(title, { exact: true })
          .first()
          .click()
        await etoPage.waitForTimeout(1200)
      }
      const etoFilled = await etoWidth()
      const etoOver = await etoCollapseOver()
      check(
        'ET-00 献立の週タブ(長い名前の献立あり)で横スクロールが出ない',
        etoFilled.sw === etoFilled.cw,
        JSON.stringify(etoFilled),
      )
      check(
        'ET-00 折りたたみの内側が外側より広がっていない(はみ出しの発生源)',
        etoOver.length === 0,
        JSON.stringify(etoOver),
      )

      // 週タブ以外の主要画面（献立が入った状態のまま）も同じ物差しで見る
      for (const [etoName, etoTab] of [
        ['月', '月'],
        ['日', '日'],
      ]) {
        await etoPage.getByRole('button', { name: etoTab, exact: true }).click()
        await etoPage.waitForTimeout(1000)
        const etoW = await etoWidth()
        check(`ET-00 献立の${etoName}タブで横スクロールが出ない`, etoW.sw === etoW.cw, JSON.stringify(etoW))
      }
      for (const [etoName, etoUrl] of [
        ['献立', '#/meal-plan'],
        ['レシピ一覧', '#/recipes'],
        ['買い物', '#/shopping'],
        ['設定', '#/settings'],
        ['作った記録', '#/history'],
      ]) {
        await etoPage.goto(`${BASE}/${etoUrl}`, { waitUntil: 'networkidle' })
        await etoPage.waitForTimeout(1100)
        const etoW = await etoWidth()
        check(`ET-00 ${etoName}で横スクロールが出ない`, etoW.sw === etoW.cw, JSON.stringify(etoW))
      }
      // 折りたたみは「開いた状態」でこそはみ出すので、開けるものを開いてからもう一度測る
      await etoPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await etoPage.waitForTimeout(1200)
      for (let i = 0; i < 6; i++) {
        const etoToggle = etoPage.locator('button[aria-expanded="false"]').first()
        if ((await etoToggle.count()) === 0) break
        try {
          await etoToggle.scrollIntoViewIfNeeded({ timeout: 1500 })
          await etoToggle.click({ timeout: 1500 })
        } catch {
          break
        }
        await etoPage.waitForTimeout(450)
      }
      const etoOpened = await etoWidth()
      check(
        'ET-00 設定の折りたたみを開いた状態でも横スクロールが出ない',
        etoOpened.sw === etoOpened.cw,
        JSON.stringify(etoOpened),
      )
    } finally {
      await etoBrowser.close()
    }
  }

  // --- ET-01: レシピ一覧のカードの高さが料理名の長さで変わらない（2026-08-09 便ET） ---
  // オーナー実機「レシピカードの大きさがレシピ名の長さによって変わる→カードをレシピ名2行の
  // サイズで統一し、はみ出る分は省略する」。料理名の枠を常に2行ぶんの高さにし(min-h)、
  // 3行目以降は省略(line-clamp-2)、グリッドの行は全カード同じ高さに揃える(grid-auto-rows:1fr)。
  currentCheck = 'ET-01'
  {
    const etcBrowser = await chromium.launch()
    try {
      const etcCtx = await etcBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const etcPage = await etcCtx.newPage()
      etcPage.on('pageerror', (err) => errors.push(`[pageerror@ET-01] ${err.message}`))
      /** 一覧のカード1枚ずつの高さ・料理名の枠の高さ・省略されているか */
      const etcCards = () =>
        etcPage.evaluate(() => {
          const cards = [...document.querySelectorAll('a[href^="#/recipes/"]')].filter(
            (a) => a.getAttribute('href') !== '#/recipes/new',
          )
          const rows = cards.map((a) => {
            const p = a.querySelector('p')
            return {
              title: (p?.textContent ?? '').trim(),
              h: Math.round(a.getBoundingClientRect().height * 100) / 100,
              titleH: p ? Math.round(p.getBoundingClientRect().height * 100) / 100 : null,
              clamp: p ? getComputedStyle(p).webkitLineClamp : null,
              // 2行に収まらず「…」で省かれているか（中身の高さ > 見えている高さ）
              clipped: p ? p.scrollHeight > p.clientHeight + 1 : null,
            }
          })
          return {
            count: rows.length,
            heights: [...new Set(rows.map((r) => r.h))].sort((a, b) => a - b),
            titleHeights: [...new Set(rows.map((r) => r.titleH))].sort((a, b) => a - b),
            rows,
          }
        })

      await etcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await etcPage.waitForTimeout(2200)
      const etcSeeded = await etcCards()
      check(
        'ET-01 一覧のカードがすべて同じ高さになっている',
        etcSeeded.count > 50 && etcSeeded.heights.length === 1,
        `枚数${etcSeeded.count} 高さ${JSON.stringify(etcSeeded.heights)}`,
      )
      check(
        'ET-01 料理名の枠は1行の名前でも2行ぶんで、全カード同じ高さ',
        etcSeeded.titleHeights.length === 1,
        JSON.stringify(etcSeeded.titleHeights),
      )
      // 1行に収まる短い名前と、2行になる長い名前が同じ高さであることを名指しで確かめる
      const etcShort = etcSeeded.rows.find((r) => r.title === '水ようかん')
      const etcTwoLine = etcSeeded.rows.find((r) => r.title === '鶏むね肉のレモンペッパー炒め')
      check(
        'ET-01 1行の名前(水ようかん)と2行の名前(鶏むね肉のレモンペッパー炒め)のカードが同じ高さ',
        !!etcShort && !!etcTwoLine && etcShort.h === etcTwoLine.h,
        JSON.stringify({ short: etcShort?.h, twoLine: etcTwoLine?.h }),
      )
      check(
        'ET-01 料理名は2行までで打ち切る設定になっている',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        etcSeeded.rows.length > 0 && etcSeeded.rows.every((r) => r.clamp === '2'),
        JSON.stringify([...new Set(etcSeeded.rows.map((r) => r.clamp))]),
      )

      // 2行に収まらない長い名前を1品登録し、カードが伸びずに名前だけ省略されることを見る
      const etcLongTitle = 'ぶりの照り焼きとほうれん草のごま和えと具だくさん味噌汁のこんだて'
      await etcPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await etcPage.waitForTimeout(600)
      await etcPage.getByPlaceholder(ja.form.namePlaceholder).fill(etcLongTitle)
      await etcPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('ぶり')
      await etcPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('ぶりを焼く')
      await etcPage.getByRole('button', { name: '保存する' }).click()
      await etcPage.waitForTimeout(1200)
      await etcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await etcPage.waitForTimeout(1800)
      const etcAfter = await etcCards()
      const etcLong = etcAfter.rows.find((r) => etcLongTitle.startsWith(r.title.replace(/…$/, '')))
      check(
        'ET-01 長い料理名を1品足してもカードの高さは全枚数そろったまま',
        etcAfter.count === etcSeeded.count + 1 && etcAfter.heights.length === 1,
        `枚数${etcAfter.count} 高さ${JSON.stringify(etcAfter.heights)}`,
      )
      check(
        'ET-01 2行に収まらない料理名は省略される(カードを押し広げない)',
        !!etcLong && etcLong.clipped === true && etcLong.h === etcSeeded.heights[0],
        JSON.stringify(etcLong ?? null),
      )
    } finally {
      await etcBrowser.close()
    }
  }

  // --- ET-02: 検索まど・献立の日/週/月が画面上部に固定される（2026-08-09 便ET） ---
  // オーナー実機「レシピ一覧の検索まど、献立タブの日週月ボタンは上に固定したい」。
  // 下部のタブナビと重ならないこと、固定した帯の裏に要素が潜り込まないことまで見る。
  currentCheck = 'ET-02'
  {
    const etsBrowser = await chromium.launch()
    try {
      const etsCtx = await etsBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const etsPage = await etsCtx.newPage()
      etsPage.on('pageerror', (err) => errors.push(`[pageerror@ET-02] ${err.message}`))
      /** 上部固定の帯と下部タブナビの位置関係 */
      const etsBar = (selector) =>
        etsPage.evaluate((sel) => {
          const bar = document.querySelector(sel)
          const nav = document.querySelector('[data-app-bottom-bar]')
          if (!bar) return null
          const r = bar.getBoundingClientRect()
          const nr = nav?.getBoundingClientRect()
          return {
            y: Math.round(window.scrollY),
            top: Math.round(r.top * 100) / 100,
            bottom: Math.round(r.bottom * 100) / 100,
            h: Math.round(r.height * 100) / 100,
            navTop: nr ? Math.round(nr.top) : null,
            overlapsNav: nr ? r.bottom > nr.top : null,
          }
        }, selector)

      // ---------- レシピ一覧の検索まど ----------
      await etsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await etsPage.waitForTimeout(2200)
      const etsTop = await etsBar('.recipes-searchbar')
      check('ET-02 レシピ一覧の検索まどの帯がある', !!etsTop, JSON.stringify(etsTop))
      await etsPage.evaluate(() => window.scrollTo(0, 1500))
      await etsPage.waitForTimeout(700)
      const etsStuck = await etsBar('.recipes-searchbar')
      const etsInput = await etsPage.evaluate(() => {
        const i = document.querySelector('input[type="search"]')
        if (!i) return null
        const r = i.getBoundingClientRect()
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), inView: r.top >= 0 && r.bottom <= window.innerHeight }
      })
      check(
        'ET-02 下へスクロールしても検索まどが画面上部に残る',
        !!etsStuck && etsStuck.top <= 1 && etsStuck.y > 1000 && !!etsInput?.inView,
        JSON.stringify({ bar: etsStuck, input: etsInput }),
      )
      check(
        'ET-02 検索まどの帯が下部のタブナビと重ならない',
        !!etsStuck && etsStuck.overlapsNav === false,
        JSON.stringify(etsStuck),
      )
      // 画面の一番上から絞り込みパネルを開いたとき、パネルの頭が帯の裏に潜らない
      // （便EOの「伸びた部分を画面内に入れる」処理が、貼り付く帯の高さを見込んでいるか）
      await etsPage.evaluate(() => window.scrollTo(0, 0))
      await etsPage.waitForTimeout(500)
      await etsPage.locator('button[aria-label="絞り込み"]').click()
      await etsPage.waitForTimeout(1400)
      const etsPanel = await etsPage.evaluate(() => {
        const bar = document.querySelector('.recipes-searchbar').getBoundingClientRect()
        const head = [...document.querySelectorAll('p')].find(
          (p) => p.textContent?.trim() === 'レシピを絞り込む',
        )
        const hr = head?.getBoundingClientRect()
        return {
          barBottom: Math.round(bar.bottom),
          headTop: hr ? Math.round(hr.top) : null,
          hidden: hr ? hr.top < bar.bottom : null,
        }
      })
      check(
        'ET-02 絞り込みパネルを開いてもパネルの頭が固定した帯の裏に隠れない',
        etsPanel.hidden === false,
        JSON.stringify(etsPanel),
      )

      // ---------- 献立の日/週/月 ----------
      await etsPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await etsPage.waitForTimeout(2000)
      await etsPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(etsPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await etsPage.waitForTimeout(1300)
      await etsPage.evaluate(() => window.scrollTo(0, 1200))
      await etsPage.waitForTimeout(700)
      const etsTabs = await etsBar('.meal-plan-tabbar')
      const etsButtons = await etsPage.evaluate(() =>
        ['日', '週', '月'].map((name) => {
          const b = [...document.querySelectorAll('.meal-plan-tabbar button')].find(
            (x) => x.textContent?.trim() === name,
          )
          const r = b?.getBoundingClientRect()
          return { name, inView: r ? r.top >= 0 && r.bottom <= window.innerHeight : false }
        }),
      )
      check(
        'ET-02 下へスクロールしても献立の日/週/月が画面上部に残る',
        !!etsTabs && etsTabs.top <= 1 && etsButtons.every((b) => b.inView),
        JSON.stringify({ bar: etsTabs, buttons: etsButtons }),
      )
      check(
        'ET-02 日/週/月の帯が下部のタブナビと重ならない',
        !!etsTabs && etsTabs.overlapsNav === false,
        JSON.stringify(etsTabs),
      )
      // 日付を指定して週タブを開くと、その日の枠へ自動でスクロールする。
      // 固定した帯の裏に日付の見出しが潜り込まないこと（section側の scroll-mt）
      const etsNow = new Date()
      const etsPad = (n) => String(n).padStart(2, '0')
      const etsToday = `${etsNow.getFullYear()}-${etsPad(etsNow.getMonth() + 1)}-${etsPad(etsNow.getDate())}`
      // 直前に window.scrollTo(0, 1200) しているうえ、ここは「#より後ろ」だけが変わる移動なので
      // ページは読み込み直されない＝日付へ飛ぶ処理が走らず、スクロール位置1200が残る。
      // 今日が月曜だと目的の日が週の1枚目に来るため、残った1200のせいで必ず隠れ判定になる
      // （曜日を前提にしたテストの4件目。2026-08-10 便EXで実測: ハッシュだけの移動→y=1200・
      //   secTop=-684で赤、読み込み直すとy=452・secTop=64で緑。アプリ側は正常）。
      // 日付指定で開いた「素の状態」を見たいので、必ず読み込み直してから測る
      await etsPage.goto(`${BASE}/#/meal-plan?focus=week&date=${etsToday}`, { waitUntil: 'networkidle' })
      await etsPage.reload({ waitUntil: 'networkidle' })
      await etsPage.waitForTimeout(2500)
      const etsJump = await etsPage.evaluate((d) => {
        const bar = document.querySelector('.meal-plan-tabbar')?.getBoundingClientRect()
        const sec = document.querySelector(`section[data-date="${d}"]`)?.getBoundingClientRect()
        if (!bar || !sec) return null
        return {
          barBottom: Math.round(bar.bottom),
          secTop: Math.round(sec.top),
          hidden: sec.top < bar.bottom - 1,
          y: Math.round(window.scrollY),
        }
      }, etsToday)
      check(
        'ET-02 日付を指定して開いた週タブで、その日の枠が固定した帯の裏に隠れない',
        !!etsJump && etsJump.hidden === false,
        JSON.stringify(etsJump),
      )
    } finally {
      await etsBrowser.close()
    }
  }

  // --- ET-03: 設定「機種変更するときは」の案内リンクが「複数の端末で使う方法」ページを指す ---
  // 2026-08-09 便ET。行き先は便EVが新設した /about/multi-device.html。
  // 従来は使い方ページの節(/about/manual.html#backup)を指していたが、端末別の保存先・
  // 受け渡し・2台目・クラウドの注意が1ページにまとまった新ページのほうが手順として具体的。
  // ページ本体は便EVの担当(このブランチには入っていない)なので、ここで見るのは
  // 「アプリ側が正しい行き先を指していて、その行き先が200で返る」ことの2点。
  currentCheck = 'ET-03'
  {
    const etmBrowser = await chromium.launch()
    try {
      const etmCtx = await etmBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const etmPage = await etmCtx.newPage()
      etmPage.on('pageerror', (err) => errors.push(`[pageerror@ET-03] ${err.message}`))
      await etmPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await etmPage.waitForTimeout(1500)
      await etmPage.getByRole('button', { name: ja.settings.moveGuideToggle }).click()
      await etmPage.waitForTimeout(900)
      const etmLink = etmPage.locator('[data-testid="move-guide-transfer-link"]')
      const etmHref = (await etmLink.count()) > 0 ? await etmLink.getAttribute('href') : null
      const etmLabel = (await etmLink.count()) > 0 ? (await etmLink.textContent())?.trim() : null
      // 2026-08-27 便LS（オーナー原文「『バックアップの詳しい説明を見る』から**現在地へ戻る手段がない**。
      // アプリではなくHPへ飛ばされるので、アプリを開きなおしたり、『アプリを開く』をHPから探さないといけない」）:
      // 行き先に**帰り先**（`?from=…`）を載せる形にした。**行き先のページ自体は変わっていない**ので、
      // 「どのページを指すか」だけを見て、帰り先の有無で落とさない形にする
      const etmPath = (etmHref ?? '').split('?')[0]
      check(
        'ET-03 「機種変更するときは」の案内リンクが /about/multi-device.html を指す',
        etmPath === '/about/multi-device.html',
        String(etmHref),
      )
      check(
        'ET-03 リンクは帰り先を連れている（説明ページから戻れる・2026-08-27 便LS）',
        (etmHref ?? '').includes('from='),
        String(etmHref),
      )
      check(
        'ET-03 リンクの文言が行き先のページ名になっている',
        etmLabel === ja.settings.moveGuideTransferLink,
        String(etmLabel),
      )
      // アプリ内の /about/ 配下へのリンクは別窓にしない作法(iOSのホーム画面追加アプリは
      // Safariとストレージが別)。ここもその作法どおりであること
      check(
        'ET-03 リンクは別窓(target=_blank)にしていない',
        (await etmLink.getAttribute('target')) === null,
        String(await etmLink.getAttribute('target')),
      )
      const etmRes = await etmPage.request.get(`${BASE}/about/multi-device.html`)
      const etmBody = etmRes.ok() ? await etmRes.text() : ''
      check('ET-03 リンク先のページが200で返る', etmRes.status() === 200, `status=${etmRes.status()}`)
      check(
        'ET-03 リンク先がアプリ本体のシェルにすり替わっていない(静的ページが返っている)',
        etmBody.includes('複数の端末で使う方法') && !etmBody.includes('<div id="root"></div>'),
        etmBody.slice(0, 80),
      )
      // 案内文とリンクの言い先が食い違っていないこと(片方だけ「使い方ページ」に取り残さない)
      const etmText = (await etmPage.textContent('body')) ?? ''
      check(
        'ET-03 案内文も同じページ名を指している',
        etmText.includes('「複数の端末で使う方法」のページに載せています'),
        etmText.includes('使い方ページに載せています') ? '案内文が旧「使い方ページ」のまま' : '',
      )
    } finally {
      await etmBrowser.close()
    }
  }

  // --- EW-01: 端末のホーム画面への追加を案内する「初回のお知らせ」(2026-08-10 便EW)。
  // 紹介ページ側の割り込み(data-ask="install")をやめ、アプリを開いて最初に着く画面に着いた直後に
  // 1回だけ出す案内に作り直した。
  // 2026-08-17 便HG: アプリのホーム画面を廃止し、最初に着くのが献立の「日」になったので、
  // 着地の合図もそこへ移した(出す作法は変えていない)。見る画面を #/meal-plan に差し替えている。
  // 見るのは次の7点:
  //  (a) 指で操作する端末(390px・タッチあり)の初回で出る・中身がそろっている
  //  (b) 閉じたら、同じ端末で開き直しても二度と出ない(✕でも「このまま使う」でも)
  //  (c) すでにホーム画面のアイコンから開いているときは出ない(iOS・Android/パソコンの両方の見分け方)
  //  (d) パソコン(マウス・1280px)では出ない
  //  (e) 「追加する方法を見る」の行き先が200で返り、押すとそのページへ着く
  //  (f) ライト/ダークの両方で文字が読める(コントラスト比4.5:1以上)
  //  (g) お知らせに書いた「あとから見る場所」(設定の「ホーム画面への追加方法」)が本当に辿れる
  currentCheck = 'EW-01'
  {
    const ewBrowser = await chromium.launch()
    // 相対輝度からコントラスト比を出す(WCAG 2.x)。MULTIDEV-01と同じ計算
    const ewContrast = (fg, bg) => {
      const lum = (css) => {
        const [r, g, b] = css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
        const ch = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
      }
      const a = lum(fg)
      const b = lum(bg)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    // 指で操作する端末のブラウザ。hasTouch を付けると (pointer: coarse) / (hover: none) /
    // navigator.maxTouchPoints>0 の3つが揃う＝アプリ側が見ている判定材料と同じ状態になる
    const phone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    const ewOpen = async (ctx) => {
      const p = await ctx.newPage()
      p.on('pageerror', (err) => errors.push(`[pageerror@EW-01] ${err.message}`))
      await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(2000)
      return p
    }
    const ewVisible = (p) => p.locator('[data-testid="home-screen-notice"]').isVisible()

    let ewNote = ''
    try {
      // (a) 初回に出る
      {
        const ctx = await ewBrowser.newContext(phone)
        const page1 = await ewOpen(ctx)
        check('EW-01(a) スマホ幅の初回でお知らせが出る', await ewVisible(page1))
        const info = await page1.evaluate(() => {
          const box = document.querySelector('[data-testid="home-screen-notice"]')
          if (!box) return null
          const img = box.querySelector('img')
          const guide = box.querySelector('[data-testid="home-screen-notice-guide"]')
          return {
            role: box.getAttribute('role'),
            title: box.querySelector('h2')?.textContent?.trim() ?? '',
            body: box.querySelectorAll('p')[0]?.textContent?.trim() ?? '',
            note: [...box.querySelectorAll('p')].pop()?.textContent?.trim() ?? '',
            imgSrc: img?.getAttribute('src') ?? '',
            imgOk: !!img && img.complete && img.naturalWidth > 0,
            imgSizeMatches:
              !!img &&
              img.naturalWidth === Number(img.getAttribute('width')) &&
              img.naturalHeight === Number(img.getAttribute('height')),
            imgAlt: img?.getAttribute('alt') ?? '',
            guideHref: guide?.getAttribute('href') ?? '',
            guideTarget: guide?.getAttribute('target'),
            guideLabel: guide?.textContent?.trim() ?? '',
            dismissLabel:
              box.querySelector('[data-testid="home-screen-notice-dismiss"]')?.textContent?.trim() ?? '',
            hasClose: !!box.querySelector('[data-testid="home-screen-notice-close"]'),
          }
        })
        ewNote = info?.note ?? ''
        check('EW-01(a) 重ね窓として名乗っている(role=dialog)', info?.role === 'dialog', String(info?.role))
        // 2026-08-21 便IR: 見出し・本文を書き写して比べていた（言い回しを直すたびに、
        // アプリは正常なのにここだけ赤くなる＝禁じ手②）。文言は ja.ts から読む
        check(
          'EW-01(a) 見出しがホーム画面にアイコンを追加できる話になっている',
          info?.title === ja.homeScreenNotice.title,
          String(info?.title),
        )
        check(
          'EW-01(a) 本文がアプリストアからのダウンロードではないと伝える',
          info?.body === ja.homeScreenNotice.body &&
            /アプリストアからのダウンロード[^。]{0,6}(必要ありません|ありません|不要)/.test(info?.body ?? ''),
          String(info?.body),
        )
        check(
          'EW-01(a) スマートフォンのホーム画面の図が実際に表示されている',
          info?.imgSrc === '/img/home-screen-icon.webp' && info?.imgOk === true,
          JSON.stringify({ src: info?.imgSrc, ok: info?.imgOk }),
        )
        check(
          'EW-01(a) 図の実寸とHTMLに書いた寸法が一致している(読み込み中に文字が飛ばない)',
          info?.imgSizeMatches === true,
        )
        check(
          'EW-01(a) 図に、目の見えない方にも伝わる説明が付いている',
          (info?.imgAlt ?? '').includes('ホーム画面') && (info?.imgAlt ?? '').includes('うちレシピ'),
          String(info?.imgAlt),
        )
        check(
          'EW-01(a) ボタンは「追加する方法を見る」と「このまま使う」の2つ＋✕がある',
          info?.guideLabel === '追加する方法を見る' &&
            info?.dismissLabel === 'このまま使う' &&
            info?.hasClose === true,
          JSON.stringify({ guide: info?.guideLabel, dismiss: info?.dismissLabel, close: info?.hasClose }),
        )
        check(
          'EW-01(a) あとから見る場所を書いた一言がある',
          ewNote === ja.homeScreenNotice.laterNote,
          ewNote,
        )
        // 2026-08-28 便LW: 説明ページへのリンクに帰り先（?from=）を載せたので、
        // 行き先は**パスで**見る（クエリまで込みの完全一致は、帰り先が付いた瞬間に落ちる＝禁じ手②）
        const ewGuidePath = (info?.guideHref ?? '').split('?')[0]
        check(
          'EW-01(a) 手順ページへのリンクは別窓(target=_blank)にしていない',
          ewGuidePath === '/about/install.html' && info?.guideTarget === null,
          JSON.stringify({ href: info?.guideHref, target: info?.guideTarget }),
        )
        check(
          'EW-01(a) そのリンクは帰り先を連れている（説明ページから戻れる・2026-08-28 便LW）',
          (info?.guideHref ?? '').includes('from='),
          String(info?.guideHref),
        )
        // (b-1) 「このまま使う」で閉じたら、開き直しても出ない
        await page1.locator('[data-testid="home-screen-notice-dismiss"]').click()
        await page1.waitForTimeout(400)
        check('EW-01(b) 「このまま使う」で閉じられる', (await ewVisible(page1)) === false)
        await page1.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await page1.waitForTimeout(1500)
        check('EW-01(b) 閉じたあとに開き直しても出ない', (await ewVisible(page1)) === false)
        // 見た記録は端末内(localStorage)だけ＝サーバーにも設定(バックアップ対象)にも入れない
        const ewSeen = await page1.evaluate(() => ({
          local: localStorage.getItem('uchirecipe:homeScreenNoticeSeen'),
          session: sessionStorage.getItem('uchirecipe:homeScreenNoticeSeen'),
        }))
        check(
          'EW-01(b) 見た記録はlocalStorageに残る(端末内のみ)',
          ewSeen.local === '1' && ewSeen.session === null,
          JSON.stringify(ewSeen),
        )
        await ctx.close()
      }

      // (b-2) ✕で閉じた場合も「見た」扱いになる
      {
        const ctx = await ewBrowser.newContext(phone)
        const page2 = await ewOpen(ctx)
        check('EW-01(b) 別の端末(まっさらな状態)ではまた出る', await ewVisible(page2))
        await page2.locator('[data-testid="home-screen-notice-close"]').click()
        await page2.waitForTimeout(400)
        await page2.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await page2.waitForTimeout(1500)
        check('EW-01(b) ✕で閉じたあとも開き直して出ない', (await ewVisible(page2)) === false)
        await ctx.close()
      }

      // (c) すでにホーム画面のアイコンから開いているときは出ない。
      // 判定材料は logic/standalone.ts の2つ。iOSは navigator.standalone、
      // Android・パソコンは matchMedia('(display-mode: standalone)') なので、両方を試す
      {
        const ctx = await ewBrowser.newContext(phone)
        await ctx.addInitScript(() => {
          Object.defineProperty(navigator, 'standalone', { value: true, configurable: true })
        })
        const page3 = await ewOpen(ctx)
        check(
          'EW-01(c) iOSのアイコン起動(navigator.standalone)では出ない',
          (await ewVisible(page3)) === false,
        )
        await ctx.close()
      }
      {
        const ctx = await ewBrowser.newContext(phone)
        await ctx.addInitScript(() => {
          const orig = window.matchMedia.bind(window)
          window.matchMedia = (q) =>
            String(q).includes('display-mode: standalone')
              ? {
                  matches: true,
                  media: String(q),
                  onchange: null,
                  addEventListener() {},
                  removeEventListener() {},
                  addListener() {},
                  removeListener() {},
                  dispatchEvent: () => false,
                }
              : orig(q)
        })
        const page4 = await ewOpen(ctx)
        check(
          'EW-01(c) display-mode: standalone のアイコン起動では出ない',
          (await ewVisible(page4)) === false,
        )
        await ctx.close()
      }

      // (d) パソコンでは出ない。マウス操作の広い画面＝(pointer: fine)/(hover: hover)
      {
        const ctx = await ewBrowser.newContext({ viewport: { width: 1280, height: 800 } })
        const page5 = await ewOpen(ctx)
        const ewPc = await page5.evaluate(() => ({
          coarse: matchMedia('(pointer: coarse)').matches,
          hoverNone: matchMedia('(hover: none)').matches,
          touch: navigator.maxTouchPoints,
        }))
        check(
          'EW-01(d) パソコン幅(マウス操作)では出ない',
          (await ewVisible(page5)) === false,
          JSON.stringify(ewPc),
        )
        check(
          'EW-01(d) パソコンの判定材料が「指で操作しない」になっている',
          ewPc.coarse === false && ewPc.hoverNone === false && ewPc.touch === 0,
          JSON.stringify(ewPc),
        )
        await ctx.close()
      }

      // (e) リンク先が生きていて、押すとそのページに着く
      {
        const ctx = await ewBrowser.newContext(phone)
        const page6 = await ewOpen(ctx)
        const ewRes = await page6.request.get(`${BASE}/about/install.html`)
        const ewBody = ewRes.ok() ? await ewRes.text() : ''
        check('EW-01(e) 「追加する方法を見る」の行き先が200で返る', ewRes.status() === 200, `status=${ewRes.status()}`)
        check(
          'EW-01(e) 行き先がアプリ本体のシェルにすり替わっていない',
          ewBody.includes('ホーム画面に追加する方法') && !ewBody.includes('<div id="root"></div>'),
          ewBody.slice(0, 80),
        )
        await page6.locator('[data-testid="home-screen-notice-guide"]').click()
        await page6.waitForLoadState('networkidle')
        await page6.waitForTimeout(600)
        check(
          'EW-01(e) 押すと手順ページへ移る',
          page6.url().includes('/about/install.html'),
          page6.url(),
        )
        // 手順ページへ移った人にも、戻ってきたときに同じお知らせを出さない。
        // ブラウザの「戻る」で帰る道と、開き直す道の両方を見る
        await page6.goBack({ waitUntil: 'networkidle' })
        await page6.waitForTimeout(1500)
        check(
          'EW-01(e) 手順ページからブラウザの戻るで帰ってきても出ない',
          (await ewVisible(page6)) === false,
          page6.url(),
        )
        await page6.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await page6.waitForTimeout(1500)
        check('EW-01(e) 手順ページを見たあとに開き直しても出ない', (await ewVisible(page6)) === false)
        await ctx.close()
      }

      // (b-3) Escape(パソコンのキーボード・端末の戻るに相当する閉じ方)でも閉じられて、
      // 「見た」扱いになる。重ね窓の共通フック(useOverlayDismiss)に載っていることの確認
      {
        const ctx = await ewBrowser.newContext(phone)
        const page9 = await ewOpen(ctx)
        await page9.keyboard.press('Escape')
        await page9.waitForTimeout(500)
        check('EW-01(b) Escapeでも閉じられる', (await ewVisible(page9)) === false)
        await page9.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await page9.waitForTimeout(1500)
        check('EW-01(b) Escapeで閉じたあとも開き直して出ない', (await ewVisible(page9)) === false)
        await ctx.close()
      }

      // (f) ライト/ダークの両方で読める
      for (const scheme of ['light', 'dark']) {
        const ctx = await ewBrowser.newContext({ ...phone, colorScheme: scheme })
        const page7 = await ewOpen(ctx)
        check(`EW-01(f) ${scheme}: お知らせが出る`, await ewVisible(page7))
        const ewColors = await page7.evaluate(() => {
          const box = document.querySelector('[data-testid="home-screen-notice"]')
          const cs = (el) => (el ? getComputedStyle(el) : null)
          const pick = (el) => {
            const s = cs(el)
            return s ? { color: s.color, bg: s.backgroundColor, size: parseFloat(s.fontSize) } : null
          }
          const ps = [...box.querySelectorAll('p')]
          return {
            card: cs(box).backgroundColor,
            title: pick(box.querySelector('h2')),
            body: pick(ps[0]),
            note: pick(ps[ps.length - 1]),
            guide: pick(box.querySelector('[data-testid="home-screen-notice-guide"]')),
            dismiss: pick(box.querySelector('[data-testid="home-screen-notice-dismiss"]')),
          }
        })
        for (const [name, part, bg] of [
          ['見出し', ewColors.title, ewColors.card],
          ['本文', ewColors.body, ewColors.card],
          ['あとから見る場所の一言', ewColors.note, ewColors.card],
          ['「追加する方法を見る」', ewColors.guide, ewColors.guide?.bg],
          ['「このまま使う」', ewColors.dismiss, ewColors.dismiss?.bg],
        ]) {
          const ratio = ewContrast(part.color, bg)
          check(
            `EW-01(f) ${scheme}: ${name}のコントラストが4.5:1以上`,
            ratio >= 4.5,
            `比=${ratio.toFixed(2)} 文字=${part.color} 地=${bg}`,
          )
        }
        // カードが画面からはみ出していないこと(小さい画面でボタンに届かないのを防ぐ)
        const ewFits = await page7.evaluate(() => {
          const r = document.querySelector('[data-testid="home-screen-notice"]').getBoundingClientRect()
          return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: window.innerHeight, w: window.innerWidth, right: Math.round(r.right) }
        })
        check(
          `EW-01(f) ${scheme}: お知らせが画面に収まっている`,
          ewFits.top >= 0 && ewFits.bottom <= ewFits.h && ewFits.right <= ewFits.w,
          JSON.stringify(ewFits),
        )
        await ctx.close()
      }

      // (g) お知らせに書いた「あとから見る場所」が本当に辿れる。
      // 戻り道は設定の「うちレシピについて」にあるリンク(2026-08-09 便EIで設置)。
      // 反射的に閉じた人が同じ情報へ辿り直せることが、この案内を1回きりにできる前提
      {
        const ctx = await ewBrowser.newContext(phone)
        const page8 = await ewOpen(ctx)
        await page8.locator('[data-testid="home-screen-notice-dismiss"]').click()
        await page8.waitForTimeout(400)
        await page8.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
        await page8.waitForTimeout(1800)
        const ewLink = page8.locator('[data-testid="settings-install-link"]')
        const ewLabel = (await ewLink.count()) > 0 ? (await ewLink.textContent())?.trim() : null
        const ewHref = (await ewLink.count()) > 0 ? await ewLink.getAttribute('href') : null
        check(
          'EW-01(g) お知らせが案内した名前のリンクが設定にある',
          ewLabel === ja.settings.installPageLink && ewNote.includes(ewLabel ?? ' '),
          JSON.stringify({ label: ewLabel, note: ewNote }),
        )
        check(
          'EW-01(g) そのリンクが手順ページを指している',
          (ewHref ?? '').split('?')[0] === '/about/install.html',
          String(ewHref),
        )
        check(
          'EW-01(g) 設定のリンクも帰り先を連れている（2026-08-28 便LW）',
          (ewHref ?? '').includes('from='),
          String(ewHref),
        )
        await ewLink.scrollIntoViewIfNeeded()
        await ewLink.click()
        await page8.waitForLoadState('networkidle')
        await page8.waitForTimeout(600)
        check(
          'EW-01(g) 設定のリンクから手順ページへ実際に着く',
          page8.url().includes('/about/install.html'),
          page8.url(),
        )
        await ctx.close()
      }

      // --- EW-02: 説明ページ(install.html)の文言2件(2026-08-10 便EW・オーナー指示) ---
      currentCheck = 'EW-02'
      {
        const ewIns = await (await page.request.get(`${BASE}/about/install.html`)).text()
        check(
          'EW-02 見出しが「手順の最初に、うちレシピの◯◯の画面を開いてください」になっている',
          // 2026-08-17 ホーム画面を廃止し、着地は「献立」になった。言い回しを丸ごと決め打ちせず、
          // 「手順の最初に開く画面を名指ししている」ことで測る（CLAUDE.md 禁じ手②）
          /手順の最初に[、]?\s*うちレシピの[^<]{0,12}画面を開いてください/.test(ewIns) &&
            !ewIns.includes('ホーム画面）を開いてください') &&
            !ewIns.includes('<strong>先にうちレシピを開いてください</strong>'),
        )
        check(
          'EW-02 その中の説明が、追加したときに開いていたページが開くことを言っている',
          ewIns.includes('アイコンからは、追加したときに開いていたページが開きます'),
        )
        // 2026-08-21 便IR: このページの一言は、アプリの中の案内(ja.homeScreenNotice.body)と
        // 同じ言い回しにそろえてある。**ja.ts の文を物差しにして**、ページ側が付いてきているかを見る
        // （両方に同じ文を書き写すと、片方を直したときにここが赤くなる＝禁じ手②）。
        // 2026-08-21 オーナー書き溜め③で冒頭を短くしたため、後ろの「うちレシピを開きやすく
        // するための手順です。」は落とした（見出しの言い直しだった）
        const ewNoStore =
          ja.homeScreenNotice.body.split('。').find((t) => t.includes('アプリストア')) ?? ''
        check(
          'EW-02 物差しにする一言を ja.ts から取れている',
          ewNoStore.length > 8,
          JSON.stringify(ewNoStore),
        )
        check(
          'EW-02 ページの初めに、アプリストアからのダウンロードではないと書いてある',
          ewIns.includes(ewNoStore),
          JSON.stringify(ewNoStore),
        )
        check(
          'EW-02 その一言は、iPhone・Androidの手順より前(ページの初めの方)にある',
          ewIns.indexOf(ewNoStore) > 0 && ewIns.indexOf(ewNoStore) < ewIns.indexOf('id="iphone"'),
        )
        // Android・パソコンの手順では「インストール」を押してもらうので、
        // 「インストールは不要」とは書かない(2026-08-09 オーナー指摘と同じ線)
        check(
          'EW-02 「インストール不要」の言い方を足していない',
          !/インストール[^。<]{0,12}(不要|いりません|要りません)/.test(ewIns),
        )
      }
    } finally {
      await ewBrowser.close()
    }
  }
