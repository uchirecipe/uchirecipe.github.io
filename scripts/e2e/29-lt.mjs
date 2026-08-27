// ==========================================================================================
// 便LT（2026-08-27 オーナーの書き溜め）: 献立の「週」・テンプレート・過去の献立をコピー
// この中の節: LTTPL-01, LTTPL-02, LTCOPY-01
//
// ここで測るのは**実機の見え方（px）と、実際に何が入るか**:
//   LTTPL-01 テンプレートの選択がプルダウンで、件数が増えても選ぶところの高さが変わらない
//            （オーナー原文「作成したテンプレートの選択方法はプルダウンに。
//              多くなったときにスクロール長くなるので。」）
//   LTTPL-02 「確認」のあいだは料理名に幅が回る（オーナー原文「レシピ名が短すぎて読めない」）
//   LTCOPY-01「コピーする食事」で絞ると、その食事だけが入る
//            （オーナー原文「入れかたの下に、対象にする食事（朝昼夕）の選択ボタンが欲しい。」）
//
// 禁じ手よけ:
//  ・曜日・月替わりの前提を置かない（週の送り・過去日を使わず、テンプレートは曜日を全部持たせる）
//  ・画面の日本語を書き写さず ja.ts から読む
//  ・生のIndexedDBへ書いたら必ず reload する（Dexieのライブ購読は生書き込みを見ていない）
// ==========================================================================================
import './_shared.mjs'

currentCheck = 'LTTPL-01'
  {

    /** テンプレートを n 件仕込む（1件＝月〜日の夕食に1品ずつ＝どの曜日から見ても中身がある） */
    const ltSeedTemplates = async (page, n, recipeIds) =>
      page.evaluate(
        ({ count, ids }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealTemplates', 'readwrite')
              const store = tx.objectStore('mealTemplates')
              store.clear()
              for (let i = 0; i < count; i++) {
                const items = []
                for (let dow = 0; dow < 7; dow++) {
                  items.push({ dow, slot: 'dinner', role: 'main', recipeId: ids[(i + dow) % ids.length] })
                }
                store.add({ name: `てんぷれ${i + 1}`, items, createdAt: Date.now() + i })
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { count: n, ids: recipeIds },
      )

    /** レシピのidを長い料理名の順に取る（「短すぎて読めない」を測るので、長い名前を使う） */
    const ltRecipeIds = async (page) =>
      page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () =>
                resolve(
                  g.result
                    .slice()
                    .sort((a, b) => (b.title ?? '').length - (a.title ?? '').length)
                    .map((r) => r.id),
                )
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )

    // ==========================================================================================
    // LTTPL-01: テンプレートの選択はプルダウン（適用の窓・内容の画面の両方）
    //
    // オーナー原文（司令部が一度押し戻したが、オーナーの反論で撤回した）:
    //   「④プルダウンではタイトルが一括で確認できて、気になったものの中身を確認→レシピ名を一覧で
    //     確認の流れが綺麗ではないのですか？テンプレートタイトルとレシピ名を同列に扱っても
    //     おかしなことになるだけでは？」
    //
    // 測るのは「件数が増えても、選ぶところの高さが変わらないこと」＝
    // 3件と10件で選ぶところの高さが同じで、窓そのものも伸びないこと。
    // ==========================================================================================
    currentCheck = 'LTTPL-01'
    {
      const ltBrowser = await chromium.launch()
      try {
        const ltCtx = await ltBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const ltPage = await ltCtx.newPage()
        ltPage.on('pageerror', (err) => errors.push(`[pageerror@LTTPL-01] ${err.message}`))
        await ltPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await ltPage.waitForTimeout(2400) // 初回シード完了待ち
        const ltIds = await ltRecipeIds(ltPage)
        check('LTTPL-01 前提: レシピを読めた', ltIds.length > 10, `${ltIds.length}件`)

        /** 「テンプレートを適用」の窓を開いて、選ぶところと窓の高さを測る */
        const ltMeasureApply = async () => {
          await ltPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
          await ltPage.waitForTimeout(1500)
          await ltPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await ltPage.waitForTimeout(900)
          await openWeekGroup(ltPage, ja.mealPlan.weekGroupTemplateTitle)
          await ltPage.locator('[data-testid="week-template-apply"]').click()
          await ltPage.waitForTimeout(700)
          return ltPage.evaluate(() => {
            const dialog = [...document.querySelectorAll('[role="dialog"]')].pop()
            if (!dialog) return null
            const pick = dialog.querySelector('[data-testid="template-apply-pick"]')
            const holder = pick ? (pick.closest('label') ?? pick) : null
            return {
              あるか: pick != null,
              プルダウンか: pick?.tagName === 'SELECT',
              選ぶところの高さ: holder ? Math.round(holder.getBoundingClientRect().height) : 0,
              選べる数: pick ? pick.options.length : 0,
              窓の中身の高さ: Math.round(dialog.scrollHeight),
              はみ出し: Math.max(0, Math.round(dialog.scrollHeight - dialog.clientHeight)),
            }
          })
        }

        await ltSeedTemplates(ltPage, 3, ltIds)
        await ltPage.reload({ waitUntil: 'networkidle' }) // 生書き込みなので必ず読み込み直す
        await ltPage.waitForTimeout(1200)
        const ltApply3 = await ltMeasureApply()
        await ltSeedTemplates(ltPage, 10, ltIds)
        await ltPage.reload({ waitUntil: 'networkidle' })
        await ltPage.waitForTimeout(1200)
        const ltApply10 = await ltMeasureApply()

        check(
          'LTTPL-01 「テンプレートを適用」の窓で、テンプレートをプルダウンで選ぶ',
          ltApply3?.プルダウンか === true && ltApply10?.プルダウンか === true,
          `3件=${JSON.stringify(ltApply3)} 10件=${JSON.stringify(ltApply10)}`,
        )
        check(
          'LTTPL-01 保存した数はプルダウンの中に全部ある（隠していない）',
          ltApply3?.選べる数 === 3 && ltApply10?.選べる数 === 10,
          `3件=${ltApply3?.選べる数} 10件=${ltApply10?.選べる数}`,
        )
        check(
          'LTTPL-01 件数が増えても、選ぶところの高さは変わらない（スクロールが伸びない）',
          ltApply3 != null &&
            ltApply10 != null &&
            ltApply3.選ぶところの高さ === ltApply10.選ぶところの高さ,
          `3件=${ltApply3?.選ぶところの高さ}px 10件=${ltApply10?.選ぶところの高さ}px`,
        )
        check(
          'LTTPL-01 件数が増えても、窓そのものが伸びてはみ出さない',
          ltApply10 != null && ltApply10.窓の中身の高さ === ltApply3?.窓の中身の高さ && ltApply10.はみ出し === 0,
          `3件=${ltApply3?.窓の中身の高さ}px 10件=${ltApply10?.窓の中身の高さ}px はみ出し=${ltApply10?.はみ出し}px`,
        )

        // ---- 内容の画面も同じプルダウン ----
        const ltMeasureManage = async () => {
          await ltPage.goto(`${BASE}/#/meal-templates`, { waitUntil: 'networkidle' })
          await ltPage.waitForTimeout(1500)
          return ltPage.evaluate(() => {
            const pick = document.querySelector('[data-testid="template-pick"]')
            const holder = pick ? (pick.closest('label') ?? pick) : null
            return {
              プルダウンか: pick?.tagName === 'SELECT',
              選ぶところの高さ: holder ? Math.round(holder.getBoundingClientRect().height) : 0,
              選べる数: pick ? pick.options.length : 0,
              並んでいるテンプレートの数: document.querySelectorAll('[data-testid="template-card"]').length,
              ページの高さ: Math.round(document.documentElement.scrollHeight),
            }
          })
        }
        const ltManage10 = await ltMeasureManage()
        await ltSeedTemplates(ltPage, 3, ltIds)
        await ltPage.reload({ waitUntil: 'networkidle' })
        await ltPage.waitForTimeout(1200)
        const ltManage3 = await ltMeasureManage()
        check(
          'LTTPL-01 「テンプレートの内容」の画面も、同じくプルダウンで選ぶ',
          ltManage3.プルダウンか === true && ltManage10.プルダウンか === true,
          `3件=${JSON.stringify(ltManage3)} 10件=${JSON.stringify(ltManage10)}`,
        )
        check(
          'LTTPL-01 内容を出すのは選んでいる1本だけ（保存した数だけ縦に積まない）',
          ltManage3.並んでいるテンプレートの数 === 1 && ltManage10.並んでいるテンプレートの数 === 1,
          `3件=${ltManage3.並んでいるテンプレートの数} 10件=${ltManage10.並んでいるテンプレートの数}`,
        )
        check(
          'LTTPL-01 件数が増えてもページの高さが変わらない（オーナーの困りごとそのもの）',
          ltManage3.ページの高さ === ltManage10.ページの高さ,
          `3件=${ltManage3.ページの高さ}px 10件=${ltManage10.ページの高さ}px`,
        )

        // 選び替えると、出ている内容もそのテンプレートのものに変わる
        const ltPick = ltPage.locator('[data-testid="template-pick"]')
        const ltTitlesOf = async () =>
          ltPage.locator('[data-testid="template-item-title"]').evaluateAll((els) =>
            els.map((el) => (el.textContent ?? '').replaceAll('​', '')),
          )
        const ltFirstTitles = await ltTitlesOf()
        const ltOptions = await ltPick.evaluate((el) => [...el.options].map((o) => o.value))
        await ltPick.selectOption(ltOptions[1])
        await ltPage.waitForTimeout(700)
        const ltSecondTitles = await ltTitlesOf()
        check(
          'LTTPL-01 選び替えると、出ている内容もそのテンプレートのものに変わる',
          ltFirstTitles.length > 0 &&
            ltSecondTitles.length > 0 &&
            JSON.stringify(ltFirstTitles) !== JSON.stringify(ltSecondTitles),
          `1本目=${JSON.stringify(ltFirstTitles)} 2本目=${JSON.stringify(ltSecondTitles)}`,
        )
      } finally {
        await ltBrowser.close()
      }
    }

    // ==========================================================================================
    // LTTPL-02: 「確認」のあいだは料理名に幅が回る
    //
    // オーナー原文「献立テンプレートの中身のレシピ名が短すぎて読めない。→確認と編集でモード分け？
    // ボタンの位置調整のみだと、行が増えてスクロール長くなりそう」
    //
    // 直す前の実測（390px幅）: 料理名に使えるのは 76px ＝全角3文字しか読めなかった。
    // 320px幅では 6px ＝**1文字も読めなかった**。
    // ここでは「役割の列と料理名だけで1段目を作る」ことを、幅の数字で見張る。
    // ==========================================================================================
    currentCheck = 'LTTPL-02'
    {
      const l2Browser = await chromium.launch()
      try {
        for (const width of [390, 320]) {
          const l2Ctx = await l2Browser.newContext({ viewport: { width, height: 844 } })
          const l2Page = await l2Ctx.newPage()
          l2Page.on('pageerror', (err) => errors.push(`[pageerror@LTTPL-02] ${err.message}`))
          await l2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await l2Page.waitForTimeout(2400)
          const l2Ids = await ltRecipeIds(l2Page)
          await ltSeedTemplates(l2Page, 2, l2Ids)
          await l2Page.goto(`${BASE}/#/meal-templates`, { waitUntil: 'networkidle' })
          await l2Page.waitForTimeout(1600)

          /** 料理名に使える幅（いちばん長い名前の行で測る） */
          const l2TitleWidth = async () =>
            l2Page.evaluate(() => {
              const els = [...document.querySelectorAll('[data-testid="template-item-title"]')]
              if (els.length === 0) return null
              return Math.round(
                Math.max(...els.map((el) => el.getBoundingClientRect().width)),
              )
            })
          const l2Confirm = await l2TitleWidth()
          const l2Toggle = l2Page.locator('[data-testid="template-edit-toggle"]')
          check(
            `LTTPL-02(${width}px) 確認と編集の切り替えが出ている`,
            (await l2Toggle.count()) === 1,
          )
          check(
            `LTTPL-02(${width}px) 切り替えの名前は、週の曜日カードと同じ言葉`,
            ((await l2Toggle.textContent()) ?? '').replaceAll('​', '').trim() ===
              ja.mealTemplates.editItems,
            `名前=${await l2Toggle.textContent()}`,
          )
          await l2Toggle.click()
          await l2Page.waitForTimeout(600)
          const l2Editing = await l2TitleWidth()
          check(
            `LTTPL-02(${width}px) 押すと「完了」に変わる（押している状態が名前で分かる）`,
            ((await l2Toggle.textContent()) ?? '').replaceAll('​', '').trim() ===
              ja.mealTemplates.editItemsDone,
            `名前=${await l2Toggle.textContent()}`,
          )
          check(
            `LTTPL-02(${width}px) 直す操作を出しても、料理名の幅は減らない（2段目に置いたため）`,
            l2Confirm != null && l2Editing != null && l2Editing === l2Confirm,
            `確認=${l2Confirm}px 編集=${l2Editing}px`,
          )
          // 直す前は 390px で76px・320px で6pxしか無かった。**画面の幅の3分の1以上**を下限にする
          // （具体的な数字を決め打つと、余白を1px動かすたびに赤くなる）
          check(
            `LTTPL-02(${width}px) 料理名に画面の3分の1より広い幅がある（直す前は76px/6px）`,
            l2Confirm != null && l2Confirm > width / 3,
            `料理名=${l2Confirm}px 画面=${width}px`,
          )
          // 「編集」のあいだだけ直す操作が出る
          check(
            `LTTPL-02(${width}px) 編集のあいだは、レシピを差し替えるボタンが出ている`,
            (await l2Page.getByRole('button', { name: ja.mealTemplates.replaceItem }).count()) > 0,
          )
          await l2Toggle.click()
          await l2Page.waitForTimeout(600)
          check(
            `LTTPL-02(${width}px) 確認に戻すと、直す操作は畳まれる`,
            (await l2Page.getByRole('button', { name: ja.mealTemplates.replaceItem }).count()) === 0,
          )
          await l2Ctx.close()
        }
      } finally {
        await l2Browser.close()
      }
    }

    // ==========================================================================================
    // LTCOPY-01: 「過去の献立をコピー」で、入れる食事を絞れる
    //
    // オーナー原文「入れかたの下に、対象にする食事（朝昼夕）の選択ボタンが欲しい。」
    //
    // 「表示する食事」（アプリ全体の設定）とは別物なので、二重には持たない＝
    // 選べるのは表示している食事だけで、既定は全部選んだ状態（触らなければ今までと同じ範囲が入る）。
    // 曜日に左右されないよう、**コピー元は1週間前の同じ7日間**（週の送りをしない）で仕込む。
    // ==========================================================================================
    currentCheck = 'LTCOPY-01'
    {
      const l3Browser = await chromium.launch()
      try {
        const l3Ctx = await l3Browser.newContext({ viewport: { width: 390, height: 844 } })
        const l3Page = await l3Ctx.newPage()
        l3Page.on('pageerror', (err) => errors.push(`[pageerror@LTCOPY-01] ${err.message}`))
        await l3Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await l3Page.waitForTimeout(2400)
        const l3Ids = await ltRecipeIds(l3Page)

        // 朝食・昼食・夕食をすべて出す設定にし、1週間前の7日間に朝食と夕食を仕込む。
        // **明日から先の7日間**を入れ先にする＝過ぎた日が混ざらないので曜日に左右されない
        await l3Page.evaluate(
          (ids) =>
            new Promise((resolve, reject) => {
              const toStr = (d) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const shift = (days) => {
                const d = new Date()
                d.setDate(d.getDate() + days)
                return toStr(d)
              }
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const db = req.result
                const tx = db.transaction(['settings', 'mealPlans'], 'readwrite')
                const settings = tx.objectStore('settings')
                const got = settings.getAll()
                got.onsuccess = () => {
                  settings.put({
                    ...(got.result[0] ?? {}),
                    visibleMealSlots: ['breakfast', 'lunch', 'dinner'],
                    weekStartsToday: true,
                  })
                }
                const plans = tx.objectStore('mealPlans')
                // 入れ先（今日から7日間）の1週間前に、朝食と夕食を1品ずつ入れる
                for (let i = 0; i < 7; i++) {
                  plans.add({ date: shift(i - 7), slot: 'breakfast', recipeId: ids[0], role: 'main' })
                  plans.add({ date: shift(i - 7), slot: 'dinner', recipeId: ids[1], role: 'main' })
                }
                tx.oncomplete = () => resolve(undefined)
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
          l3Ids,
        )
        await l3Page.reload({ waitUntil: 'networkidle' }) // 生書き込みなので必ず読み込み直す
        await l3Page.waitForTimeout(1600)

        await l3Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await l3Page.waitForTimeout(1500)
        await l3Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
        await l3Page.waitForTimeout(1000)
        await openWeekGroup(l3Page, ja.mealPlan.weekGroupTemplateTitle)
        await l3Page.locator('[data-testid="week-copy-pick"]').click()
        await l3Page.waitForTimeout(1200)

        const l3Slots = l3Page.locator('[data-testid="copy-pick-slot"]')
        check(
          'LTCOPY-01 入れる食事の並びが、表示している食事のぶんだけ出る',
          (await l3Slots.count()) === 3,
          `${await l3Slots.count()}件`,
        )
        check(
          'LTCOPY-01 既定は全部選んだ状態（触らなければ今までと同じ範囲が入る）',
          (await l3Page.locator('[data-testid="copy-pick-slot"][aria-pressed="true"]').count()) === 3,
        )
        // 「入れかたの下の説明の1行が無いこと」は、画面に無い目印を数えても何も測れない
        // （LK-1: 目印そのものが src から消えているので、必ず緑になる）。
        // ソースから消えていることは ui-source-guards.mjs の LT-4 が見る
        check(
          'LTCOPY-01 入れる先の1行が、入る方向を一方向に読める言い方になっている',
          ((await l3Page.locator('[data-testid="copy-pick-target"]').textContent()) ?? '')
            .replaceAll('​', '')
            .includes('入れる先'),
          `${await l3Page.locator('[data-testid="copy-pick-target"]').textContent()}`,
        )

        // 朝食だけを外して夕食と昼食を残す → 入るのは夕食だけ（昼食はコピー元が空）
        await l3Page.locator('[data-testid="copy-pick-slot"][data-slot="breakfast"]').click()
        await l3Page.waitForTimeout(600)
        const l3ShownSlots = await l3Page
          .locator('[data-testid="copy-source-item"]')
          .evaluateAll((els) => [...new Set(els.map((el) => el.getAttribute('data-slot')))])
        check(
          'LTCOPY-01 絞ると、上に並ぶコピー元の中身も同じ範囲になる（見えているものと入るものを合わせる）',
          l3ShownSlots.length === 1 && l3ShownSlots[0] === 'dinner',
          JSON.stringify(l3ShownSlots),
        )

        // 全部外すと押せない（入る先が無いまま走らせない）
        for (const slot of ['lunch', 'dinner']) {
          await l3Page.locator(`[data-testid="copy-pick-slot"][data-slot="${slot}"]`).click()
          await l3Page.waitForTimeout(300)
        }
        check(
          'LTCOPY-01 食事を1つも選んでいなければ、実行を押せない',
          await l3Page.locator('[data-testid="copy-pick-run"]').isDisabled(),
        )
        check(
          'LTCOPY-01 押せない理由がその場に出る',
          (await l3Page.locator('[data-testid="copy-pick-slot-empty"]').count()) === 1,
        )

        // 夕食だけを選び直して実行 → 入るのは夕食だけ
        await l3Page.locator('[data-testid="copy-pick-slot"][data-slot="dinner"]').click()
        await l3Page.waitForTimeout(400)
        await l3Page.locator('[data-testid="copy-pick-run"]').click()
        await l3Page.waitForTimeout(2000)
        const l3After = await l3Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const toStr = (d) =>
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const shift = (days) => {
                const d = new Date()
                d.setDate(d.getDate() + days)
                return toStr(d)
              }
              const from = toStr(new Date())
              const to = shift(6)
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    [
                      ...new Set(
                        g.result.filter((e) => e.date >= from && e.date <= to).map((e) => e.slot),
                      ),
                    ].sort(),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
        check(
          'LTCOPY-01 選んだ食事だけが入る（外した朝食は1品も入らない）',
          l3After.length === 1 && l3After[0] === 'dinner',
          JSON.stringify(l3After),
        )
      } finally {
        await l3Browser.close()
      }
    }

  }
