// ==========================================================================================
// 便MJ（2026-08-29）: 前の3便の申し送りを、実機で確かめてから直したもの
// この中の節: MJPRICE-01, MJCHIP-02, MJPANEL-03
//
// 申し送り:
//  ①（便MA）「『ひき肉』で絞ると今も合いびき肉は出ません（キーが `あいびきにく` で
//     `ひきにく` を含まないため）。広げるなら価格の解決と五十音順の並び位置に波及する」
//  ②（便MD）「買い物メモの範囲えらびのチップは塗りつぶし（実行ボタンと同じ見た目）のまま」
//  ③（便LW）「`?section=archive` で帰ると、着く先の『古い記録の書き出し』カードは
//     既定で畳まれた状態」→ 司令部の裁定（2026-08-28）「開いたまま帰します」
//
// 直す前の実測（2026-08-29・390px・BASE_URL=http://localhost:4581）:
//  ①「ひき肉」で絞ると 213件のマスタから**2件**（豚ひき肉・鶏ひき肉）だけ。合いびき肉が出ない
//  ②選択中のチップの地 rgb(204,63,1)／文字 rgb(250,245,236)。すぐ下の実行ボタン
//    「選んだ範囲の買い物メモを作る」も地 rgb(204,63,1)／文字 rgb(250,245,236) で**同じ**
//  ③archive/backup とも、自分で開いてから説明ページへ出て帰ると aria-expanded が **false**
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 曜日・月替わりの前提は置かない。掴むのは data-testid と ja.ts から組み立てた読み上げ名だけで、
// 並び順・押す回数・置き場所には依らない（禁じ手②③④）。
// 見るのは**計算した見た目の値**（getComputedStyle）で、クラス名は書き写さない。
// ==========================================================================================
import './_shared.mjs'

  // ==========================================================================================
  // MJPRICE-01 「ひき肉」で絞ると、マスタのひき肉が1件残らず出る（合いびき肉が落ちない）
  // ==========================================================================================
  currentCheck = 'MJPRICE-01'
  {
    const mjBrowser = await chromium.launch()
    try {
      const mjCtx = await mjBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const mjPage = await mjCtx.newPage()
      mjPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MJPRICE-01] ${err.message}`)
      })
      await mjPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await mjPage.waitForTimeout(2400) // 価格マスタの投入待ち

      // 行の名前は「{name}の価格（円）」の読み上げ名から読む（画面の字を書き写さない）
      const mjAriaSuffix = ja.priceMaster.entryPriceAria.split('{name}')[1]
      const mjShownNames = async () =>
        mjPage
          .locator(`input[aria-label$="${mjAriaSuffix}"]`)
          .evaluateAll(
            (els, suffix) => els.map((el) => (el.getAttribute('aria-label') ?? '').slice(0, -suffix.length)),
            mjAriaSuffix,
          )
      const mjSearch = mjPage.getByLabel(ja.priceMaster.searchLabel)
      const mjAll = await mjShownNames()
      check('MJPRICE-01 前提: 価格マスタの行が並んでいる', mjAll.length > 100, `${mjAll.length}件`)

      /**
       * マスタに実際に入っている「ひき肉の行」＝**一覧から読む**（3件と決め打ちしない）。
       * マスタに牛ひき肉を足したら、この検査もそのまま新しい行を要求する形になる。
       * 見分けは**表示名**で行う。連濁で「合い**びき**肉」と濁るので、濁点のどちらも拾う
       * （この濁点こそが、直す前に合いびき肉だけが絞り込みから落ちていた原因そのもの。
       *   照合キー（toHiragana）で見分けると、直したい仕組みで答え合わせすることになる）。
       */
      const mjMinceRows = mjAll.filter((name) => /[ひび]き肉$/.test(name)).sort()
      check(
        'MJPRICE-01 前提: マスタにひき肉の行がある',
        mjMinceRows.length >= 2,
        `ひき肉の行=${JSON.stringify(mjMinceRows)}`,
      )
      // ①「ひき肉」で絞ると、その行が1件残らず出る（直す前は合いびき肉だけが落ちていた）
      for (const word of ['ひき肉', '挽き肉', '挽肉']) {
        await mjSearch.first().fill(word)
        await mjPage.waitForTimeout(700)
        const hit = (await mjShownNames()).sort()
        check(
          `MJPRICE-01 「${word}」で絞ると、マスタのひき肉が1件残らず出る`,
          JSON.stringify(hit) === JSON.stringify(mjMinceRows),
          `出た行=${JSON.stringify(hit)} 期待=${JSON.stringify(mjMinceRows)}`,
        )
      }
      // ② 合いびき肉に届く書き分けが、どれも同じ1件に着く（濁点・送り仮名で切れない）
      for (const word of ['合いびき肉', '合い挽き肉', '合挽肉', 'あいびき肉', 'あいびき']) {
        await mjSearch.first().fill(word)
        await mjPage.waitForTimeout(600)
        const hit = await mjShownNames()
        check(
          `MJPRICE-01 「${word}」で合いびき肉の行だけが出る`,
          hit.length === 1 && hit[0] === '合いびき肉',
          `出た行=${JSON.stringify(hit)}`,
        )
      }
      // ③ 緩くなっていないこと。別の肉を探しているときに合いびき肉が割り込まない
      for (const word of ['豚ひき肉', '鶏ひき肉']) {
        if (!mjMinceRows.includes(word)) continue
        await mjSearch.first().fill(word)
        await mjPage.waitForTimeout(600)
        const hit = await mjShownNames()
        check(
          `MJPRICE-01 「${word}」で絞ると、合いびき肉は混ざらない`,
          hit.length === 1 && hit[0] === word,
          `出た行=${JSON.stringify(hit)}`,
        )
      }
      // ④ 五十音順の並び位置が動いていない（読み仮名の集約先を変えたときの波及先）
      await mjSearch.first().fill('')
      await mjPage.waitForTimeout(700)
      const mjOrder = await mjShownNames()
      check(
        'MJPRICE-01 五十音順で合いびき肉が2番目のまま（並び位置が動いていない）',
        mjOrder.indexOf('合いびき肉') === 1,
        `先頭3件=${JSON.stringify(mjOrder.slice(0, 3))}`,
      )
    } finally {
      await mjBrowser.close()
    }
  }

  // ==========================================================================================
  // MJCHIP-02 買い物メモの範囲えらびのチップが、実行ボタンと見分けが付く（塗りつぶしでない）
  // ==========================================================================================
  currentCheck = 'MJCHIP-02'
  {
    const mcBrowser = await chromium.launch()
    try {
      const mcCtx = await mcBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const mcPage = await mcCtx.newPage()
      mcPage.on('dialog', (d) => void d.accept())
      mcPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MJCHIP-02] ${err.message}`)
      })
      await mcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mcPage.waitForTimeout(2400) // 初回シード完了待ち
      await mcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mcPage.reload({ waitUntil: 'networkidle' })
      await mcPage.waitForTimeout(1800)
      for (const label of [ja.firstSetupNotice.dismissButton, ja.homeScreenNotice.dismissButton]) {
        const btn = mcPage.getByRole('button', { name: label })
        if ((await btn.count()) > 0) {
          await btn.first().click()
          await mcPage.waitForTimeout(400)
        }
      }
      await mcPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await mcPage.waitForTimeout(1600)
      await openWeekGroup(mcPage, ja.mealPlan.weekGroupShoppingTitle)
      await mcPage.waitForTimeout(800)

      /** その要素の「見えている姿」。クラス名ではなく計算した値で見る */
      const mcLook = async (locator) =>
        locator.evaluate((el) => {
          const s = getComputedStyle(el)
          return { bg: s.backgroundColor, color: s.color, border: s.borderTopColor, width: s.borderTopWidth }
        })
      const mcDate = mcPage.locator('[data-testid="shop-range-date"]')
      const mcSlot = mcPage.locator('[data-testid="shop-range-slot"]')
      check(
        'MJCHIP-02 前提: 範囲えらびの日付・食事のチップが出ている',
        (await mcDate.count()) > 0 && (await mcSlot.count()) > 0,
        `日付=${await mcDate.count()}件 食事=${await mcSlot.count()}件`,
      )
      // 押していない既定は「全部が選ばれている」＝選択中の姿をそのまま読める
      const mcDateOn = await mcLook(mcDate.first())
      const mcSlotOn = await mcLook(mcSlot.first())

      // 手本は同じ画面の「表示する食事」チップ（2026-08-09 便ENの作法どおりの形）。
      // **手本から読む**ので、テーマや色トークンを変えても書き写しにならない
      const mcRef = mcPage
        .locator(`[role="group"][aria-label="${ja.mealPlan.slotFilterTitle}"] button[aria-pressed="true"]`)
        .first()
      check('MJCHIP-02 前提: 手本の「表示する食事」チップがある', (await mcRef.count()) > 0, `${await mcRef.count()}件`)
      const mcRefOn = await mcLook(mcRef)
      for (const [name, look] of [['日付', mcDateOn], ['食事', mcSlotOn]]) {
        check(
          `MJCHIP-02 選んだ${name}のチップの見た目が、手本の「表示する食事」と同じ`,
          look.bg === mcRefOn.bg && look.color === mcRefOn.color && look.border === mcRefOn.border,
          `${name}=${JSON.stringify(look)} 手本=${JSON.stringify(mcRefOn)}`,
        )
      }

      // 実行ボタン（買い物メモを作る）。**塗りつぶしはこちら専用**（2026-08-09 便EN）
      const mcRun = mcPage
        .getByRole('button', { name: new RegExp(`${ja.mealPlan.goToShopping}|${ja.mealPlan.goToShoppingPicked}`) })
        .last()
      check('MJCHIP-02 前提: 同じ節に実行ボタンが並んでいる', (await mcRun.count()) > 0, `${await mcRun.count()}件`)
      const mcRunLook = await mcLook(mcRun)
      for (const [name, look] of [['日付', mcDateOn], ['食事', mcSlotOn]]) {
        check(
          `MJCHIP-02 選んだ${name}のチップが、実行ボタンと同じ塗りになっていない`,
          look.bg !== mcRunLook.bg,
          `${name}の地=${look.bg} 実行ボタンの地=${mcRunLook.bg}`,
        )
      }
      // 片側だけ消していないこと＝実行ボタンは今までどおり塗ってある
      check(
        'MJCHIP-02 実行ボタンは塗りつぶしのまま（アクセント色で塗ってある）',
        mcRunLook.bg !== mcDateOn.bg && mcRunLook.bg !== 'rgba(0, 0, 0, 0)',
        `実行ボタン=${JSON.stringify(mcRunLook)}`,
      )
      // 色だけでなく**形**でも選択が分かる。押しても幅が動かない（2026-08-09 便EO）
      const mcWidthBefore = (await mcSlot.first().boundingBox())?.width
      await mcSlot.first().click()
      await mcPage.waitForTimeout(500)
      const mcWidthAfter = (await mcSlot.first().boundingBox())?.width
      check(
        'MJCHIP-02 チップを押しても幅が動かない（右隣がずれない）',
        mcWidthBefore != null && mcWidthAfter != null && Math.abs(mcWidthBefore - mcWidthAfter) < 1,
        `押す前=${mcWidthBefore}px 押した後=${mcWidthAfter}px`,
      )
      const mcSlotOff = await mcLook(mcSlot.first())
      check(
        'MJCHIP-02 選んでいるときと外したときで、見た目が変わる',
        mcSlotOff.bg !== mcSlotOn.bg || mcSlotOff.color !== mcSlotOn.color,
        `選択中=${JSON.stringify(mcSlotOn)} 外した=${JSON.stringify(mcSlotOff)}`,
      )
    } finally {
      await mcBrowser.close()
    }
  }

  // ==========================================================================================
  // MJPANEL-03 設定へ帰ると、開いていた折りたたみが開いたまま（着地先のカードが畳まれない）
  // ==========================================================================================
  currentCheck = 'MJPANEL-03'
  {
    const mkBrowser = await chromium.launch()
    try {
      const mkCtx = await mkBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const mkPage = await mkCtx.newPage()
      mkPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MJPANEL-03] ${err.message}`)
      })
      await mkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mkPage.waitForTimeout(2400)

      /** その折りたたみが開いているか（押し方ではなく aria の状態で読む） */
      const mkOpen = (testId) =>
        mkPage.evaluate(
          (t) => document.querySelector(`[data-testid="${t}"]`)?.getAttribute('aria-expanded') ?? null,
          testId,
        )
      /**
       * 設定を**素の姿で**開き直す。ハッシュだけの移動は同じ文書のままで画面が作り直されないので、
       * 必ず読み込み直す（前の節の開閉が残ったまま測る事故を防ぐ）
       */
      const mkFreshSettings = async (query = '') => {
        await mkPage.goto(`${BASE}/#/settings${query}`, { waitUntil: 'networkidle' })
        await mkPage.reload({ waitUntil: 'networkidle' })
        await mkPage.waitForTimeout(1600)
      }

      for (const [name, toggleId, linkId] of [
        ['古い記録の書き出し', 'archive-toggle', 'archive-detail-link'],
        ['バックアップの注意点', 'backup-notice-toggle', 'backup-detail-link'],
      ]) {
        await mkFreshSettings()
        // ① 素で開いたときは今までどおり畳んである（便JJ・便LSの「既定は畳む」を変えていない）
        check(
          `MJPANEL-03 素で設定を開くと「${name}」は畳んだまま（既定は変えていない）`,
          (await mkOpen(toggleId)) === 'false',
          `aria-expanded=${await mkOpen(toggleId)}`,
        )
        // ② 自分で開いてから、その中の「詳しい説明」で説明ページへ出る
        await mkPage.locator(`[data-testid="${toggleId}"]`).first().click()
        await mkPage.waitForTimeout(600)
        check(
          `MJPANEL-03 前提: 「${name}」を自分で開けた`,
          (await mkOpen(toggleId)) === 'true',
          `aria-expanded=${await mkOpen(toggleId)}`,
        )
        const mkLink = mkPage.locator(`[data-testid="${linkId}"]`)
        check(`MJPANEL-03 前提: 「${name}」に説明ページへの案内がある`, (await mkLink.count()) === 1, `${await mkLink.count()}件`)
        await mkLink.first().click()
        await mkPage.waitForTimeout(1800)
        check(
          `MJPANEL-03 前提: 「${name}」から説明ページへ移れる`,
          new URL(mkPage.url()).pathname.startsWith('/about/'),
          `着いた先=${mkPage.url()}`,
        )
        // ③ 説明ページの帰り道でアプリへ帰る
        const mkReturn = mkPage.locator('#appReturn')
        check(
          `MJPANEL-03 前提: 説明ページに帰り道が出ている（${name}）`,
          (await mkReturn.count()) === 1,
          `${await mkReturn.count()}件`,
        )
        await mkReturn.first().click()
        await mkPage.waitForTimeout(2500)
        check(
          `MJPANEL-03 帰り着く先が設定（${name}）`,
          new URL(mkPage.url()).hash.startsWith('#/settings'),
          `着いた先=${mkPage.url()}`,
        )
        // ④ ここが直したところ。開いていた折りたたみが開いたまま帰る
        check(
          `MJPANEL-03 開いていた「${name}」が、帰っても開いたまま`,
          (await mkOpen(toggleId)) === 'true',
          `aria-expanded=${await mkOpen(toggleId)}`,
        )
        // ⑤ 覚えは1回きり。次に素で開いたら、また畳んだ姿に戻る
        await mkFreshSettings()
        check(
          `MJPANEL-03 覚えは1回きり（次に素で開くと「${name}」はまた畳んである）`,
          (await mkOpen(toggleId)) === 'false',
          `aria-expanded=${await mkOpen(toggleId)}`,
        )
      }

      // ⑥ 折りたたみの**外**にあるリンク（利用規約）で出ても、開いていたものは開いたまま帰る
      //    ＝直したのは「この経路だけ」ではなく、この画面から出る道ぜんぶ
      await mkFreshSettings()
      await mkPage.locator('[data-testid="archive-toggle"]').first().click()
      await mkPage.waitForTimeout(500)
      const mkTerms = mkPage.locator('a[href^="/about/terms.html"]')
      check('MJPANEL-03 前提: 利用規約へのリンクがある', (await mkTerms.count()) > 0, `${await mkTerms.count()}件`)
      if ((await mkTerms.count()) > 0) {
        await mkTerms.first().click()
        await mkPage.waitForTimeout(1800)
        const mkTermsReturn = mkPage.locator('#appReturn')
        if ((await mkTermsReturn.count()) === 1) {
          await mkTermsReturn.first().click()
          await mkPage.waitForTimeout(2500)
          check(
            'MJPANEL-03 折りたたみの外のリンク（利用規約）で出ても、開いていたカードは開いたまま',
            (await mkOpen('archive-toggle')) === 'true',
            `aria-expanded=${await mkOpen('archive-toggle')}`,
          )
        }
      }
    } finally {
      await mkBrowser.close()
    }
  }
