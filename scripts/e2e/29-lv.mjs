// ==========================================================================================
// 便LV（2026-08-28）: 献立の「パネルの中の折りたたみ」を、寄り道から帰っても開いたままにする
// この中の節: LVPANEL-01, LVPANEL-02, LVPANEL-03
//
// オーナー原文（2026-08-27 の書き溜め。便LUが受け、折りたたみだけ残っていた）:
//  「各種pro版について見るからの戻り先、献立ならすべて日に戻ってしまう。直前の状態に戻して。
//    折りたたみが閉じてしまう、スクロール場所がズレるのもやめて。」
//
// 直す前の実測（2026-08-28・週タブ）: 節を6つとも開き、栄養パネルも開いた状態で
// パネルの中の「Pro版について見る」→ 設定 →「献立に戻る」と帰ると、**6つとも畳まれ**、
// 栄養パネルは節ごと消えていた（縦位置も 2407 → 1331 とずれていた）。
//
// この便の節は**自前のブラウザ**を開いて測る（前の節が残した画面の状態に寄りかからない）。
// 曜日・月替わりの前提は置かない＝見るのは「離れる前と帰ったあとが同じか」だけ。
// 節の数・押す回数は決め打ちしない（禁じ手③）。掴むのは ja.ts から組み立てた読み上げ名と
// data-testid だけで、並び順や置き場所には依らない（禁じ手②④）。
// ==========================================================================================
import './_shared.mjs'

  // ==========================================================================================
  // LVPANEL-01 週タブ: 開いていた節と栄養パネルが、Pro案内から帰っても開いたまま
  // ==========================================================================================
  currentCheck = 'LVPANEL-01'
  {
    const lvBrowser = await chromium.launch()
    try {
      const lvCtx = await lvBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const lvPage = await lvCtx.newPage()
      lvPage.on('dialog', (d) => void d.accept())
      lvPage.on('pageerror', (err) => errors.push(`[pageerror@LV] ${err.message}`))

      /** 週タブの節の見出し。ja.ts から取る＝節が増えても名前を書き写さない */
      const lvGroupTitles = [
        ja.mealPlan.weekGroupDisplayTitle,
        ja.mealPlan.weekGroupAutoTitle,
        ja.mealPlan.weekGroupTemplateTitle,
        ja.mealPlan.weekGroupNutritionTitle,
        ja.mealPlan.weekGroupCostTitle,
        ja.mealPlan.weekGroupShoppingTitle,
      ]
      const lvOpenAria = (title) =>
        ja.mealPlan.weekGroupToggleOpenAria.replace('{group}', title)
      const lvCloseAria = (title) =>
        ja.mealPlan.weekGroupToggleCloseAria.replace('{group}', title)
      /** いま開いている節の見出しの一覧（並び順ではなく名前の集まりで見る） */
      const lvOpenGroups = async () => {
        const open = []
        for (const title of lvGroupTitles) {
          if ((await lvPage.getByRole('button', { name: lvCloseAria(title) }).count()) > 0) {
            open.push(title)
          }
        }
        return open
      }
      /** 画面に出ている節を、まだ畳んでいるものだけ開く（すでに開いていれば押さない＝禁じ手③） */
      const lvOpenAllGroups = async () => {
        for (const title of lvGroupTitles) {
          const opener = lvPage.getByRole('button', { name: lvOpenAria(title) })
          if ((await opener.count()) > 0) {
            await opener.first().click()
            await lvPage.waitForTimeout(350)
          }
        }
      }
      const lvWeekPanelOpen = async () =>
        (await lvPage
          .getByRole('button', { name: ja.nutritionBalance.weekToggleCollapse })
          .count()) > 0

      await lvPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      // 初回だけ出る案内（作る人数と台所の器具）が後ろの画面を固定するので、先に見た記録を残す
      await lvPage.evaluate(() => localStorage.setItem('uchirecipe:firstSetupNoticeSeen', '1'))
      await lvPage.reload({ waitUntil: 'networkidle' })
      await lvPage.waitForTimeout(2500)
      await lvPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await lvPage.waitForTimeout(1500)
      // 栄養・食費の節は「数える献立があるとき」だけ出るので、先に週を埋める。
      // 埋め終わって画面が落ち着いてから掴む（禁じ手⑤: 届く前に掴まない）
      await lvPage.getByRole('button', { name: ja.mealPlan.fillWeek }).first().click()
      await lvPage.waitForTimeout(3500)

      await lvOpenAllGroups()
      const lvWeekExpand = lvPage.getByRole('button', {
        name: ja.nutritionBalance.weekToggleExpand,
      })
      if ((await lvWeekExpand.count()) > 0) {
        await lvWeekExpand.first().scrollIntoViewIfNeeded()
        await lvWeekExpand.first().click()
        await lvPage.waitForTimeout(700)
      }
      const lvGroupsBefore = await lvOpenGroups()
      const lvPanelBefore = await lvWeekPanelOpen()
      check(
        'LVPANEL-01 前提: 節と栄養パネルを開いた状態を作れている',
        lvGroupsBefore.length > 0 && lvPanelBefore,
        `開いた節=${lvGroupsBefore.join('・')} パネル=${lvPanelBefore}`,
      )

      // Pro案内は栄養パネルの中にある＝この折りたたみを開いた本人が押すところ
      const lvGate = lvPage.getByRole('link', { name: ja.nutrition.gateLink }).last()
      await lvGate.scrollIntoViewIfNeeded()
      await lvPage.waitForTimeout(400)
      const lvYBefore = await lvPage.evaluate(() => window.scrollY)
      await lvGate.click()
      await lvPage.waitForTimeout(1500)
      const lvBackLabel = ja.backLink.backTo.replace('{page}', ja.backLink.mealPlan)
      await lvPage.getByRole('button', { name: lvBackLabel }).first().click()
      await lvPage.waitForTimeout(3500)

      const lvGroupsAfter = await lvOpenGroups()
      check(
        'LVPANEL-01 開いていた節が、帰ってきても開いたまま（畳まれない）',
        // 長さも同じ条件で見る＝1つも開いていない（＝直す前の姿）を「全部そろっている」と
        // 読み違えない
        lvGroupsBefore.length > 0 && lvGroupsBefore.every((t) => lvGroupsAfter.includes(t)),
        `前=${lvGroupsBefore.join('・')} 後=${lvGroupsAfter.join('・')}`,
      )
      check(
        'LVPANEL-01 畳んでいた節まで勝手に開かない（開閉をそのまま戻す）',
        lvGroupsAfter.length === lvGroupsBefore.length &&
          lvGroupsAfter.length > 0 &&
          lvGroupsAfter.every((t) => lvGroupsBefore.includes(t)),
        `前=${lvGroupsBefore.join('・')} 後=${lvGroupsAfter.join('・')}`,
      )
      check(
        'LVPANEL-01 栄養パネル（節の中の折りたたみ）も開いたまま',
        await lvWeekPanelOpen(),
        `前=${lvPanelBefore} 後=${await lvWeekPanelOpen()}`,
      )
      // 上限は保険（画面の高さの丸めぶんだけ動くことがある）。
      // 直す前は、節が畳まれてページが縮むぶんだけ手前に着地していた
      const lvYAfter = await lvPage.evaluate(() => window.scrollY)
      check(
        'LVPANEL-01 縦位置も離れる前と同じ（節が畳まれたぶん手前に着地しない）',
        lvYBefore > 200 && Math.abs(lvYAfter - lvYBefore) <= 60,
        `前=${lvYBefore} 後=${lvYAfter}`,
      )

      // ======================================================================================
      // LVPANEL-02 覚えは1回きり。素で開き直したら既定（畳んだ状態）で迎える
      // ======================================================================================
      currentCheck = 'LVPANEL-02'
      await lvPage.goto(`${BASE}/#/recipes`)
      await lvPage.waitForTimeout(1500)
      await lvPage.goto(`${BASE}/#/meal-plan`)
      await lvPage.waitForTimeout(2500)
      await lvPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await lvPage.waitForTimeout(1800)
      check(
        'LVPANEL-02 素で開き直したら、節はどれも畳んだ状態で迎える（前の開閉が蘇らない）',
        (await lvOpenGroups()).length === 0,
        `開いている節=${(await lvOpenGroups()).join('・')}`,
      )

      // ======================================================================================
      // LVPANEL-03 曜日カードの中の栄養パネルも同じ（同じ形の折りたたみが7つ並ぶ側）
      // ======================================================================================
      currentCheck = 'LVPANEL-03'
      // 掴む目印は ja.ts の**日付のうしろ**（「）の栄養の概算を閉じる」）にする。
      // 前だけ（「この日（」）だと開くほうの名前とも当たり、開いていても閉じていても
      // 同じ件数になって**素通り合格**になる（2026-08-28 に壊して確かめた）
      const lvDayTail = (label) => new RegExp(`${label.split('}')[1]}$`)
      const lvDayCollapse = lvPage.getByRole('button', {
        name: lvDayTail(ja.nutritionBalance.dayToggleCollapse),
      })
      const lvDayExpand = lvPage.getByRole('button', {
        name: lvDayTail(ja.nutritionBalance.dayToggleExpand),
      })
      if ((await lvDayExpand.count()) > 0) {
        await lvDayExpand.first().scrollIntoViewIfNeeded()
        await lvDayExpand.first().click()
        await lvPage.waitForTimeout(700)
        const lvDayOpenBefore = await lvDayCollapse.count()
        const lvDayGate = lvPage.getByRole('link', { name: ja.nutrition.gateLink }).first()
        await lvDayGate.scrollIntoViewIfNeeded()
        await lvPage.waitForTimeout(300)
        await lvDayGate.click()
        await lvPage.waitForTimeout(1500)
        await lvPage.getByRole('button', { name: lvBackLabel }).first().click()
        await lvPage.waitForTimeout(3500)
        check(
          'LVPANEL-03 曜日カードの栄養パネルも、開いたまま帰ってくる',
          (await lvDayCollapse.count()) === lvDayOpenBefore && lvDayOpenBefore > 0,
          `前=${lvDayOpenBefore} 後=${await lvDayCollapse.count()}`,
        )
      } else {
        check(
          'LVPANEL-03 曜日カードの栄養パネルも、開いたまま帰ってくる',
          false,
          '曜日カードの栄養パネルが1つも出ていない（前提が崩れている）',
        )
      }
    } finally {
      await lvBrowser.close()
    }
  }

  // ==========================================================================================
  // LVBACK-01 入れ子で寄り道しても、「戻る」が自分の居た画面へ帰る
  //
  // 直したバグ（実測 2026-08-28）: 献立の週タブからレシピ詳細を開くと、出所は
  // **履歴の付け足し（location.state）**にだけ載っている
  //   {"from":"mealPlanWeek","fromPath":"/meal-plan?focus=week&restore=1"}
  // ところが設定の「レシピに戻る」は付け足しを持たずに移るので、寄り道から帰った詳細では
  // それが **null** になり、詳細の「戻る」が献立ではなく**レシピ一覧**へ着地していた。
  // 2段でも3段でも同じで、重ねるほど帰れなくなる（オーナー報告「戻ってくる手段がない」の家族）。
  //
  // 測るのは「何段重ねても、押した人が自分の居た画面へ帰れるか」だけ。
  // 重ねる回数は検査したいことそのものなので数を書くが、**2段と3段の両方**を当てる。
  // ==========================================================================================
  currentCheck = 'LVBACK-01'
  {
    const lbBrowser = await chromium.launch()
    try {
      const lbCtx = await lbBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const lbPage = await lbCtx.newPage()
      lbPage.on('dialog', (d) => void d.accept())
      lbPage.on('pageerror', (err) => errors.push(`[pageerror@LVBACK] ${err.message}`))

      const lbGroupTitles = [
        ja.mealPlan.weekGroupDisplayTitle,
        ja.mealPlan.weekGroupAutoTitle,
        ja.mealPlan.weekGroupTemplateTitle,
        ja.mealPlan.weekGroupNutritionTitle,
        ja.mealPlan.weekGroupCostTitle,
        ja.mealPlan.weekGroupShoppingTitle,
      ]
      const lbOpenGroups = async () => {
        const open = []
        for (const title of lbGroupTitles) {
          const name = ja.mealPlan.weekGroupToggleCloseAria.replace('{group}', title)
          if ((await lbPage.getByRole('button', { name }).count()) > 0) open.push(title)
        }
        return open
      }
      /** 画面に出ている節を、まだ畳んでいるものだけ開く（すでに開いていれば押さない） */
      const lbOpenAllGroups = async () => {
        for (const title of lbGroupTitles) {
          const opener = lbPage.getByRole('button', {
            name: ja.mealPlan.weekGroupToggleOpenAria.replace('{group}', title),
          })
          if ((await opener.count()) > 0) {
            await opener.first().click()
            await lbPage.waitForTimeout(300)
          }
        }
      }
      /** レシピ詳細から「Pro版について見る」→ 設定 →「レシピに戻る」を1往復 */
      const lbDetourOnce = async () => {
        const expand = lbPage.getByRole('button', { name: ja.nutrition.toggleExpand })
        if ((await expand.count()) > 0) {
          await expand.first().click()
          await lbPage.waitForTimeout(800)
        }
        const gate = lbPage.getByRole('link', { name: ja.nutrition.gateLink })
        if ((await gate.count()) === 0) return false
        await gate.first().scrollIntoViewIfNeeded()
        await lbPage.waitForTimeout(300)
        await gate.first().click()
        await lbPage.waitForTimeout(1400)
        const backToDetail = lbPage.getByRole('button', {
          name: ja.backLink.backTo.replace('{page}', ja.backLink.recipeDetail),
        })
        if ((await backToDetail.count()) === 0) return false
        await backToDetail.first().click()
        await lbPage.waitForTimeout(2200)
        return true
      }
      /** 献立の週タブ → 曜日カードのレシピ → 寄り道を times 回 →「戻る」 */
      const lbRound = async (times) => {
        await lbPage.goto(`${BASE}/#/meal-plan`)
        await lbPage.waitForTimeout(2500)
        await lbPage
          .getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
          .first()
          .click()
        await lbPage.waitForTimeout(1800)
        await lbOpenAllGroups()
        const opened = await lbOpenGroups()
        const link = lbPage.locator('a[href^="#/recipes/"]').first()
        await link.scrollIntoViewIfNeeded()
        await lbPage.waitForTimeout(300)
        await link.click()
        await lbPage.waitForTimeout(2200)
        let detoured = 0
        for (let i = 0; i < times; i++) if (await lbDetourOnce()) detoured++
        await lbPage.getByRole('button', { name: ja.common.back, exact: true }).first().click()
        await lbPage.waitForTimeout(3500)
        return { opened, detoured, url: lbPage.url(), back: await lbOpenGroups() }
      }

      await lbPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      // 初回だけ出る案内（作る人数と台所の器具）が後ろの画面を固定するので、先に見た記録を残す
      await lbPage.evaluate(() => localStorage.setItem('uchirecipe:firstSetupNoticeSeen', '1'))
      await lbPage.reload({ waitUntil: 'networkidle' })
      await lbPage.waitForTimeout(2500)
      await lbPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await lbPage.waitForTimeout(1500)
      await lbPage.getByRole('button', { name: ja.mealPlan.fillWeek }).first().click()
      await lbPage.waitForTimeout(3500)

      for (const times of [1, 2]) {
        const r = await lbRound(times)
        check(
          `LVBACK-01 前提: ${times + 1}段の寄り道を作れている（節も開いている）`,
          r.detoured === times && r.opened.length > 0,
          `寄り道=${r.detoured}/${times} 開いた節=${r.opened.join('・')}`,
        )
        check(
          `LVBACK-01 ${times + 1}段まで重ねても「戻る」が献立へ帰る（レシピ一覧へ飛ばない）`,
          r.url.includes('#/meal-plan'),
          r.url,
        )
        check(
          `LVBACK-01 ${times + 1}段まで重ねても、開いていた節がそのまま帰る`,
          r.back.length > 0 && r.opened.every((t) => r.back.includes(t)),
          `前=${r.opened.join('・')} 後=${r.back.join('・')}`,
        )
      }

      // 出所の無い画面（レシピ一覧から開いた詳細）は、今までどおり一覧へ帰る
      // ＝覚えが残っていても、別の画面の出所を勝手に名乗らない
      await lbPage.goto(`${BASE}/#/recipes`)
      await lbPage.waitForTimeout(2200)
      await lbPage.locator('a[href^="#/recipes/"]').first().click()
      await lbPage.waitForTimeout(2200)
      const lbListDetoured = await lbDetourOnce()
      await lbPage.getByRole('button', { name: ja.common.back, exact: true }).first().click()
      await lbPage.waitForTimeout(2500)
      check(
        'LVBACK-01 出所の無い詳細は、寄り道のあとも今までどおりレシピ一覧へ帰る',
        lbListDetoured && lbPage.url().includes('#/recipes') && !lbPage.url().includes('#/meal-plan'),
        `寄り道=${lbListDetoured} 着いた先=${lbPage.url()}`,
      )
    } finally {
      await lbBrowser.close()
    }
  }
