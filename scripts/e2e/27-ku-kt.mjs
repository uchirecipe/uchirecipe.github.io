// ==========================================================================================
// e2e の節: 便KU・便KT（作った記録の行・数字の書き方）
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
// この中の節: KUBACK-01, KUROW-03, KUBACK-02, KUGROUP-05, KULINE-04, KTNUM-01, KTTIMER-02, KTSPREAD-03
// ==========================================================================================
import './_shared.mjs'



  // ==========================================================================================
  // 便KU: 2026-08-25 オーナー実機（献立の「月」「週」と買い物メモ）
  //  KUBACK-01 月タブの日の窓の「作った記録」のレシピ→詳細→戻る で、月・その日の窓ごと帰る
  //  KUBACK-02 買い物メモの食材の窓のレシピ→詳細→戻る で、買い物メモ・同じ食材の窓ごと帰る
  //  KUROW-03  「作った記録を見る」は右端にあり、レシピカードより明らかに低い
  //  KULINE-04 朝昼夕の境目が線で読める（ライト・ダークの両方で、線と面の差が3:1以上）
  //  KUGROUP-05 7日分の下は「栄養と食費」「買い物メモ」の2節にまとまり、
  //             畳んでいても「買い物メモを作る」は押せる
  // ==========================================================================================
  currentCheck = 'KUBACK-01'
  {
    const kuBrowser = await chromium.launch()
    try {
      const kuCtx = await kuBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const kuPage = await kuCtx.newPage()
      kuPage.on('dialog', (d) => void d.accept())
      kuPage.on('pageerror', (err) => errors.push(`[pageerror@KU] ${err.message}`))
      await kuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kuPage.waitForTimeout(2000)
      const kuSeed = await kuPage.evaluate(async () => {
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
        const iso = (dt) =>
          `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
        const now = new Date()
        const today = iso(now)
        // 過ぎた日は「今日の前日」だと今日が月初のときに前の月になる。
        // 月タブは開いた月のカレンダーを出すので、**同じ月の中の過ぎた日**を選ぶ
        // （今日が1日なら今日を使う＝どの日でも必ず今月のマスがある）
        const past = now.getDate() > 1 ? iso(new Date(now.getFullYear(), now.getMonth(), 1)) : today
        const mk = (title, logs = []) => ({
          title,
          servings: 2,
          effortLevel: 'normal',
          tags: [],
          ingredients: [{ name: 'KUにんじん', amount: '1', unit: '本' }],
          steps: [{ text: '切る。' }],
          isFavorite: false,
          cookedLogs: logs,
          searchWords: [],
          isStarter: false,
          updatedAt: Date.now(),
        })
        const ids = []
        for (let i = 1; i <= 3; i++) {
          ids.push(await P(store('recipes').add(mk(`KU記録${i}`, [{ date: past, servings: 2 }]))))
        }
        // 買い物メモ（食材の窓の出所になるレシピ付き）
        await P(
          store('shoppingItems').add({
            name: 'KUにんじん',
            amount: '1本',
            isChecked: false,
            order: 0,
            fromRecipeIds: [ids[0]],
            fromRecipes: [{ recipeId: ids[0], amount: '1本' }],
          }),
        )
        // 週の編集画面の境目を測るため、今日の朝昼夕に1品ずつ入れる
        for (const slot of ['breakfast', 'lunch', 'dinner']) {
          await P(store('mealPlans').add({ date: today, slot, role: 'main', recipeId: ids[0] }))
        }
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(
          store('settings').put({
            ...cur,
            id: 1,
            // 月タブ（月間献立）はPro機能なので、解錠した状態で測る
            proCode: 'UR-E2E-TEST-ONLY',
            proActivatedAt: Date.now(),
            visibleMealSlots: ['breakfast', 'lunch', 'dinner'],
          }),
        )
        db.close()
        return { today, past, ids }
      })
      // 生のIndexedDBへ書いたので必ず読み込み直す（CLAUDE.md 禁じ手⑥）
      await kuPage.goto(`${BASE}/#/meal-plan`)
      await kuPage.reload({ waitUntil: 'networkidle' })
      await kuPage.waitForTimeout(2200)
      await kuPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await kuPage.waitForTimeout(1600)
      await kuPage.locator(`[data-date="${kuSeed.past}"]`).first().click()
      await kuPage.waitForTimeout(1400)
      const kuDayDialog = kuPage.locator('[role="dialog"]')
      check(
        'KUBACK-01 前提: 月タブの日の窓が開き、作った記録のカードが並んでいる',
        (await kuDayDialog.locator('[data-testid="cooked-log-card"]').count()) === 3,
        `記録=${await kuDayDialog.locator('[data-testid="cooked-log-card"]').count()}件`,
      )
      const kuRecordLink = kuDayDialog
        .locator('a[data-testid="cooked-log-recipe"]')
        .first()
      check(
        'KUBACK-01 前提: 記録のカードがレシピ詳細へのリンクになっている',
        (await kuRecordLink.count()) === 1,
        `リンク=${await kuRecordLink.count()}`,
      )
      await kuRecordLink.click()
      await kuPage.waitForTimeout(1500)
      check(
        'KUBACK-01 前提: 記録のカードからレシピ詳細へ移る',
        /#\/recipes\/\d+/.test(kuPage.url()),
        kuPage.url(),
      )
      await kuPage.getByRole('button', { name: ja.common.back }).first().click()
      await kuPage.waitForTimeout(2500)
      const kuBack = await kuPage.evaluate(() => {
        const dialogs = [...document.querySelectorAll('[role="dialog"]')]
        return {
          url: location.hash,
          dialogs: dialogs.length,
          labels: dialogs.map((d) => d.getAttribute('aria-label') ?? '').join(' / '),
          logs: document.querySelectorAll('[data-testid="cooked-log-card"]').length,
        }
      })
      check(
        'KUBACK-01 「戻る」でレシピ一覧へ飛ばされず、献立へ帰る',
        kuBack.url.includes('/meal-plan'),
        JSON.stringify(kuBack),
      )
      check(
        'KUBACK-01 帰った先で、開いていた日の窓が開き直っている（記録も並んでいる）',
        kuBack.dialogs >= 1 && kuBack.logs === 3,
        JSON.stringify(kuBack),
      )

      // ---------- KUROW-03: 「作った記録を見る」の位置と高さ ----------
      currentCheck = 'KUROW-03'
      const kuRow = await kuPage.evaluate(() => {
        const dialog = [...document.querySelectorAll('[role="dialog"]')].pop()
        const li = dialog?.querySelector('[data-testid="cooked-log-card"]')
        if (!li) return null
        const card = li.querySelector('[data-testid="cooked-log-recipe"]')
        const open = li.querySelector('[data-testid="cooked-log-open-detail"]')
        if (!card || !open) return null
        const lr = li.getBoundingClientRect()
        const cr = card.getBoundingClientRect()
        const or = open.getBoundingClientRect()
        return {
          li: Math.round(lr.height),
          card: Math.round(cr.height),
          open: Math.round(or.height),
          rightGap: Math.round(lr.right - or.right),
          // 当たり判定（.tap-target が広げる面）は44px四方を割らない
          tapH: Math.round(
            parseFloat(getComputedStyle(open, '::after').height) || or.height,
          ),
          tapW: Math.round(
            parseFloat(getComputedStyle(open, '::after').width) || or.width,
          ),
        }
      })
      check('KUROW-03 前提: 記録のカードと「作った記録を見る」を掴めた', kuRow !== null, JSON.stringify(kuRow))
      check(
        'KUROW-03 「作った記録を見る」は行の右端に寄っている（右の空きが8px以内）',
        kuRow !== null && kuRow.rightGap <= 8,
        JSON.stringify(kuRow),
      )
      check(
        'KUROW-03 その行はレシピカードより明らかに低い（カードの半分以下）',
        kuRow !== null && kuRow.open * 2 <= kuRow.card,
        JSON.stringify(kuRow),
      )
      check(
        'KUROW-03 小さくしても指で押せる（当たり判定は44px四方以上）',
        kuRow !== null && kuRow.tapH >= 44 && kuRow.tapW >= 44,
        JSON.stringify(kuRow),
      )

      // ---------- KUBACK-02: 買い物メモの食材の窓へ帰る ----------
      currentCheck = 'KUBACK-02'
      await kuPage.goto(`${BASE}/#/shopping`)
      await kuPage.reload({ waitUntil: 'networkidle' })
      await kuPage.waitForTimeout(2000)
      await kuPage.getByRole('button', { name: ja.shopping.tabMemo, exact: true }).click()
      await kuPage.waitForTimeout(900)
      const kuNameBtn = kuPage.getByRole('button', {
        name: `KUにんじん ${ja.shopping.memoSourceOpen}`,
      })
      check('KUBACK-02 前提: 買い物メモの食材を掴めた', (await kuNameBtn.count()) === 1, `件数=${await kuNameBtn.count()}`)
      await kuNameBtn.first().click()
      await kuPage.waitForTimeout(900)
      check(
        'KUBACK-02 前提: 食材の窓が開き、出所のレシピが並ぶ',
        (await kuPage.locator('a[data-testid="shopping-source-recipe"]').count()) >= 1,
        `件数=${await kuPage.locator('a[data-testid="shopping-source-recipe"]').count()}`,
      )
      await kuPage.locator('a[data-testid="shopping-source-recipe"]').first().click()
      await kuPage.waitForTimeout(1500)
      check(
        'KUBACK-02 前提: 窓のレシピからレシピ詳細へ移る',
        /#\/recipes\/\d+/.test(kuPage.url()),
        kuPage.url(),
      )
      await kuPage.getByRole('button', { name: ja.common.back }).first().click()
      await kuPage.waitForTimeout(2500)
      const kuShopBack = await kuPage.evaluate(() => {
        const dialogs = [...document.querySelectorAll('[role="dialog"]')]
        return {
          url: location.hash,
          dialogs: dialogs.length,
          labels: dialogs.map((d) => d.getAttribute('aria-label') ?? '').join(' / '),
        }
      })
      check(
        'KUBACK-02 「戻る」でレシピ一覧へ飛ばされず、買い物メモへ帰る',
        kuShopBack.url.includes('/shopping'),
        JSON.stringify(kuShopBack),
      )
      check(
        'KUBACK-02 帰った先で、開いていた食材の窓が開き直っている',
        kuShopBack.dialogs >= 1 && kuShopBack.labels.includes('KUにんじん'),
        JSON.stringify(kuShopBack),
      )

      // ---------- KULINE-04 / KUGROUP-05: 週タブ ----------
      currentCheck = 'KUGROUP-05'
      await kuPage.goto(`${BASE}/#/meal-plan`)
      await kuPage.reload({ waitUntil: 'networkidle' })
      await kuPage.waitForTimeout(2200)
      await kuPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await kuPage.waitForTimeout(1500)
      await openAllWeekDays(kuPage)
      await kuPage.waitForTimeout(600)
      const kuGroupNames = [
        ja.mealPlan.weekGroupNutritionCostTitle,
        ja.mealPlan.weekGroupShoppingTitle,
      ]
      for (const name of kuGroupNames) {
        check(
          `KUGROUP-05 「${name}」の節が1つある（畳んだ状態で見出しだけ出る）`,
          (await kuPage.getByRole('button', {
            name: ja.mealPlan.weekGroupToggleOpenAria.replace('{group}', name),
          }).count()) === 1,
        )
      }
      check(
        'KUGROUP-05 畳んでいても「買い物メモを作る」は押せる（毎回押すものはしまわない）',
        await kuPage.getByRole('button', { name: ja.mealPlan.goToShopping }).isVisible(),
      )
      check(
        'KUGROUP-05 畳んでいても、いま何を対象にしているかは読める（範囲の要約）',
        (await kuPage.getByTestId('shop-range-summary').innerText()).includes(
          ja.mealPlan.shopRangeSummaryAll,
        ),
      )
      check(
        'KUGROUP-05 畳んでいるあいだ、概算食費の見出しと金額は出さない',
        !stripZwspText(await kuPage.textContent('body')).includes(ja.mealPlan.weekCostTitle),
      )
      await openWeekGroup(kuPage, ja.mealPlan.weekGroupNutritionCostTitle)
      await kuPage.waitForTimeout(700)
      check(
        'KUGROUP-05 節を1回開くと、週まとめの栄養がその場に出る（入れ子の折りたたみを作らない）',
        stripZwspText(await kuPage.textContent('body')).includes(ja.nutritionBalance.weekTitle),
      )
      await kuCtx.close()

      // ---------- KULINE-04: 朝昼夕の境目（ライト・ダークの両方） ----------
      currentCheck = 'KULINE-04'
      for (const scheme of ['light', 'dark']) {
        const lineCtx = await kuBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
        })
        const linePage = await lineCtx.newPage()
        linePage.on('pageerror', (err) => errors.push(`[pageerror@KULINE] ${err.message}`))
        await linePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await linePage.waitForTimeout(2000)
        // 入れ物（context）ごとに端末の中身は空なので、この入れ物にも同じ献立を入れる
        await linePage.evaluate(async () => {
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
          const iso = (dt) =>
            `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
          const today = iso(new Date())
          const id = await P(
            store('recipes').add({
              title: 'KU境目',
              servings: 2,
              effortLevel: 'normal',
              tags: [],
              ingredients: [],
              steps: [{ text: '切る。' }],
              isFavorite: false,
              cookedLogs: [],
              searchWords: [],
              isStarter: false,
              updatedAt: Date.now(),
            }),
          )
          for (const slot of ['breakfast', 'lunch', 'dinner']) {
            await P(store('mealPlans').add({ date: today, slot, role: 'main', recipeId: id }))
          }
          const cur = (await P(store('settings').get(1))) || { id: 1 }
          await P(
            store('settings').put({
              ...cur,
              id: 1,
              visibleMealSlots: ['breakfast', 'lunch', 'dinner'],
            }),
          )
          db.close()
        })
        await linePage.goto(`${BASE}/#/meal-plan`)
        await linePage.reload({ waitUntil: 'networkidle' })
        await linePage.waitForTimeout(2200)
        await linePage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
        await linePage.waitForTimeout(1500)
        await openAllWeekDays(linePage)
        await linePage.waitForTimeout(600)
        const lineToday = await linePage.evaluate(() => {
          const d = new Date()
          const pad = (n) => String(n).padStart(2, '0')
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        })
        const lineEditOn = await openWeekDayEdit(linePage, lineToday)
        check(`KULINE-04(${scheme}) 前提: 今日のカードを編集モードにできた`, lineEditOn === true)
        const lineInfo = await linePage.evaluate((date) => {
          // 色は oklab() で返ることがある（color-mix）。相対輝度は線形sRGBから出す
          const clamp = (v) => Math.min(1, Math.max(0, v))
          const oklabToLinear = (L, A, B) => {
            const l_ = L + 0.3963377774 * A + 0.2158037573 * B
            const m_ = L - 0.1055613458 * A - 0.0638541728 * B
            const s_ = L - 0.0894841775 * A - 1.291485548 * B
            const l = l_ * l_ * l_
            const m = m_ * m_ * m_
            const s = s_ * s_ * s_
            return {
              r: clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
              g: clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
              b: clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
            }
          }
          const lin = (v) => {
            const c = v / 255
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
          }
          const parse = (str) => {
            if (!str) return null
            let m = str.match(/oklab\(([^)]+)\)/)
            if (m) {
              const p = m[1]
                .split(/[ ,/]+/)
                .filter(Boolean)
                .map((x) => (x.endsWith('%') ? Number(x.slice(0, -1)) / 100 : Number(x)))
              return oklabToLinear(p[0], p[1], p[2])
            }
            m = str.match(/rgba?\(([^)]+)\)/)
            if (!m) return null
            const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number)
            return { r: lin(p[0]), g: lin(p[1]), b: lin(p[2]) }
          }
          const lum = (c) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
          const ratio = (x, y) => {
            if (!x || !y) return null
            const a = lum(x)
            const b = lum(y)
            return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100
          }
          const section = document.querySelector(`section[data-date="${date}"]`)
          if (!section) return null
          const blocks = [...section.querySelectorAll('[data-testid="slot-block"]')]
          if (blocks.length < 2) return null
          const read = (el) => {
            const cs = getComputedStyle(el)
            const r = el.getBoundingClientRect()
            return { bg: cs.backgroundColor, line: cs.borderTopColor, top: r.top, bottom: r.bottom }
          }
          const list = blocks.map(read)
          const out = { blocks: blocks.length, gaps: [], lineVsAbove: [], lineVsBelow: [], bgPairs: [] }
          for (let i = 1; i < list.length; i++) {
            out.gaps.push(Math.round(list[i].top - list[i - 1].bottom))
            out.lineVsAbove.push(ratio(parse(list[i].line), parse(list[i - 1].bg)))
            out.lineVsBelow.push(ratio(parse(list[i].line), parse(list[i].bg)))
            out.bgPairs.push(ratio(parse(list[i - 1].bg), parse(list[i].bg)))
          }
          return out
        }, lineToday)
        check(
          `KULINE-04(${scheme}) 前提: 朝昼夕の枠が3つとも並んでいる`,
          lineInfo !== null && lineInfo.blocks === 3,
          JSON.stringify(lineInfo),
        )
        // 直す前は 地色どうし 1.04:1（ダーク1.05:1）・線と面 1.07〜1.25:1 で、
        // 「どこで朝昼夕が変わるか」を色から読めなかった。**線で引く**側で測る
        check(
          `KULINE-04(${scheme}) 隣り合う枠の境目の線は、上下どちらの面に対しても3:1以上`,
          lineInfo !== null &&
            lineInfo.lineVsAbove.every((v) => v !== null && v >= 3) &&
            lineInfo.lineVsBelow.every((v) => v !== null && v >= 3),
          JSON.stringify(lineInfo),
        )
        check(
          `KULINE-04(${scheme}) 枠どうしの間は16px以上（距離でも切れ目が読める）`,
          lineInfo !== null && lineInfo.gaps.every((g) => g >= 16),
          JSON.stringify(lineInfo),
        )
        await lineCtx.close()
      }
    } finally {
      await kuBrowser.close()
    }
  }


  // --- KTNUM-01 / KTTIMER-02: 2026-08-25 便KT（オーナー書き溜め・並行調理ナビ）---
  //
  // ①「並行調理のレシピごとの番号「1−1」などが、レシピ名が長いと改行されてしまう。」
  //   → 番号のバッジは折り返さず、料理名の札だけが縮む。390px と 320px の両方で測る。
  //     折り返しは**文字の行数**で測る（Range の getClientRects が1つ＝1行）。
  //     バッジの高さは固定なので、高さでは見分けられない。
  // ②「レンジでは、レンジのタイマーを使います。レンジに関するタイマーは削除できない？」
  //   → 電子レンジの待ちには「タイマーを始める」を出さず、何ではかるのかを1行で書く。
  //     コンロの待ちには今までどおり出す（器具が何も知らせないため）。 ---
  currentCheck = 'KTNUM-01'
  {
    const ktBrowser = await chromium.launch()
    const ktSeed = async (page) => {
      await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(2400) // 初回シード完了待ち
      await page.evaluate(async () => {
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
        // 料理名を長くする（オーナーの報告は「レシピ名が長いと」）。
        // 1つめの品は、1手順が段取りの上で2つに割れる形（＝番号が「3-1」「3-2」になる）
        const idA = await P(
          store('recipes').add(
            mk('E2E鶏むね肉とたっぷり根菜のやわらか甘辛煮こみ定食', 'main', [
              { text: '鶏むね肉と根菜を食べやすい大きさに切る。' },
              { text: 'フライパンに油を熱し、鶏むね肉の色が変わるまで炒める。' },
              { text: '水としょうゆ・みりん・砂糖を入れ、落としぶたをして中火で15分煮る。', minutes: 15 },
            ]),
          ),
        )
        // 2つめは電子レンジの待ち（器具が知らせる待ち）
        const idB = await P(
          store('recipes').add(
            mk('E2Eブロッコリーのレンジ蒸し', 'side', [
              { text: 'ブロッコリーは小房に分ける。' },
              { text: '耐熱皿に並べてふんわりとラップをかけ、電子レンジ(600W)で3分加熱する。', minutes: 3 },
              { text: '水気をきってごま油と塩で和える。' },
            ]),
          ),
        )
        const today = await P(store('todayList').getAll())
        for (const row of today) await P(store('todayList').delete(row.id))
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
      await page.goto(`${BASE}/#/cook-navi`)
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(1600)
      await page.getByRole('button', { name: ja.cookNavi.build }).click()
      await page.waitForTimeout(1000)
    }
    /** 品ごとの番号のバッジを、行数と幅で測る（文字が折り返していないか） */
    const ktBadges = (page) =>
      page.$$eval('[data-testid="navi-recipe-step-number"]', (wraps) =>
        wraps.map((wrap) => {
          const badge = wrap.firstElementChild ?? wrap
          const node = [...badge.childNodes].find((n) => n.nodeType === 3)
          const range = document.createRange()
          if (node) range.selectNodeContents(node)
          const box = badge.getBoundingClientRect()
          return {
            label: (badge.textContent ?? '').trim(),
            lines: node ? range.getClientRects().length : 0,
            width: Math.round(box.width),
            scrollWidth: badge.scrollWidth,
            right: Math.round(box.right),
          }
        }),
      )
    try {
      for (const width of [390, 320]) {
        const ktContext = await ktBrowser.newContext({ viewport: { width, height: 844 } })
        const ktPage = await ktContext.newPage()
        ktPage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
            return
          errors.push(`[pageerror@KTNUM-01] ${err.message}`)
        })
        try {
          await ktSeed(ktPage)
          const badges = await ktBadges(ktPage)
          check(
            `KTNUM-01 前提: ${width}px で品ごとの番号が出ていて、割れた手順の「◯-◯」もある`,
            badges.length >= 3 && badges.some((b) => b.label.includes('-')),
            `${width}px 番号=${badges.map((b) => b.label).join(',')}`,
          )
          const ktWrapped = badges.filter((b) => b.lines > 1)
          check(
            `KTNUM-01 ${width}px で番号が折り返していない（レシピ名が長くても1行）`,
            ktWrapped.length === 0,
            `折り返した番号=${JSON.stringify(ktWrapped)}`,
          )
          const ktSqueezed = badges.filter((b) => b.scrollWidth > b.width + 1)
          check(
            `KTNUM-01 ${width}px で番号が押しつぶされていない（中身がはみ出していない）`,
            ktSqueezed.length === 0,
            `つぶれた番号=${JSON.stringify(ktSqueezed)}`,
          )
          check(
            `KTNUM-01 ${width}px で番号が画面の外へ押し出されていない`,
            badges.every((b) => b.right <= width),
            JSON.stringify(badges.map((b) => b.right)),
          )
          // 縮むのは料理名の札のほう＝長い名前は省略されて画面に収まる
          const ktPillOverflow = await ktPage.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          )
          check(
            `KTNUM-01 ${width}px で横スクロールが出ていない（縮むのは料理名の札のほう）`,
            ktPillOverflow <= 0,
            `はみ出し=${ktPillOverflow}px`,
          )

          // --- KTTIMER-02: 器具そのものが知らせる待ちには、アプリのタイマーを出さない ---
          if (width === 390) {
            currentCheck = 'KTTIMER-02'
            const ktWaits = await ktPage.$$eval(
              '[data-testid="navi-wait-block"]',
              (blocks, startLabel) =>
                blocks.map((b) => ({
                  text: (b.closest('li')?.querySelector('[data-testid="navi-step-text"]')?.textContent ?? '')
                    .replaceAll('\u200b', ''),
                  hasButton: [...b.querySelectorAll('button')].some((btn) =>
                    (btn.textContent ?? '').replaceAll('\u200b', '').includes(startLabel),
                  ),
                  applianceNote: (
                    b.querySelector('[data-testid="navi-wait-appliance-timer"]')?.textContent ?? ''
                  ).replaceAll('\u200b', ''),
                })),
              ja.cookNavi.startTimer,
            )
            const ktMicro = ktWaits.filter((w) => stepAppliance(w.text) === 'microwave')
            const ktStove = ktWaits.filter((w) => stepAppliance(w.text) === 'stove')
            check(
              'KTTIMER-02 前提: レンジの待ちとコンロの待ちが両方この段取りにある',
              ktMicro.length >= 1 && ktStove.length >= 1,
              `レンジ=${ktMicro.length} コンロ=${ktStove.length}`,
            )
            check(
              'KTTIMER-02 レンジの待ちに「タイマーを始める」を出さない',
              ktMicro.every((w) => !w.hasButton),
              JSON.stringify(ktMicro),
            )
            check(
              'KTTIMER-02 代わりに、何ではかるのかを書く（黙って消さない）',
              ktMicro.every(
                (w) =>
                  w.applianceNote ===
                  ja.cookNavi.waitApplianceTimerNote.replace('{appliance}', ja.settings.kitchenMicrowave),
              ),
              JSON.stringify(ktMicro.map((w) => w.applianceNote)),
            )
            check(
              'KTTIMER-02 コンロの待ちには今までどおり出す（器具が何も知らせないため）',
              ktStove.every((w) => w.hasButton && w.applianceNote === ''),
              JSON.stringify(ktStove),
            )
            currentCheck = 'KTNUM-01'
          }
        } finally {
          await ktContext.close()
        }
      }
    } finally {
      await ktBrowser.close()
    }
  }

  // --- KTSPREAD-03: 先にできた品が待つことになる、という警告（2026-08-25 便KT・司令部裁定）---
  //
  // 便KQが熱い品が1つだけの組の放置を 15組→7組 に減らしたが、残る7組は**熱い品が2つあって
  // 物理的に避けられない**組で、実際に置いたままになる。オーナー指示で消したのは
  // **分数の予測**（「約◯分あきます」）なので、事実の警告だけを分数抜きで残した。
  //
  // ここで見るのは2つ:
  //   ①熱い品が2つで開きが大きい組では、警告が画面に出る
  //   ②その警告に**分数が1つも入っていない**（数字を戻す次の便を止める）
  // 掴み方は data-testid と ja.ts の文言だけ（何番目のカードか・工程がいくつに割れたかは見ない）---
  currentCheck = 'KTSPREAD-03'
  {
    const ksBrowser = await chromium.launch()
    const ksContext = await ksBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ksPage = await ksContext.newPage()
    ksPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@KTSPREAD-03] ${err.message}`)
    })
    // どちらも熱いうちに食べたい主菜＝便KQでも並べ替えでは揃えられない組（残る7組の形）。
    // 煮こみが先にできあがり、炊き上がりを待つあいだ置いたままになる
    const ksFirstTitle = 'E2Eじっくり煮こみの牛すね肉'
    const ksLastTitle = 'E2E五目炊き込みごはん'
    try {
      await ksPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ksPage.waitForTimeout(2400) // 初回シード完了待ち
      await ksPage.evaluate(
        async ({ firstTitle, lastTitle }) => {
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
          // どちらも熱いうちに食べる主菜。炊き上がりまでが長いので、煮こみが先にできあがる
          const idFirst = await P(
            store('recipes').add(
              mk(firstTitle, 'main', [
                { text: '牛すね肉と玉ねぎを一口大に切る。' },
                { text: '鍋に牛すね肉・玉ねぎ・水を入れ、ふたをして弱火で30分煮こむ。', minutes: 30 },
                { text: '塩こしょうで味をととのえて器に盛る。' },
              ]),
            ),
          )
          const idLast = await P(
            store('recipes').add(
              mk(lastTitle, 'main', [
                { text: '米を研ぎ、30分浸水させる。', minutes: 30 },
                { text: 'にんじんとしいたけを細切りにする。' },
                { text: '炊飯器に米と具材、だしを入れて普通に炊く。', minutes: 40 },
                { text: '炊き上がったら10分蒸らして全体を混ぜる。', minutes: 10 },
              ]),
            ),
          )
          const today = await P(store('todayList').getAll())
          for (const row of today) await P(store('todayList').delete(row.id))
          let addedAt = Date.now()
          await P(store('todayList').add({ recipeId: idFirst, addedAt: addedAt++ }))
          await P(store('todayList').add({ recipeId: idLast, addedAt: addedAt++ }))
          const cur = (await P(store('settings').get(1))) || { id: 1 }
          await P(
            store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
          )
          db.close()
        },
        { firstTitle: ksFirstTitle, lastTitle: ksLastTitle },
      )
      // 生のIndexedDBへ書いたので、必ず読み込み直す（Dexieのライブ購読はDexie経由しか見ていない）
      await ksPage.goto(`${BASE}/#/cook-navi`)
      await ksPage.reload({ waitUntil: 'networkidle' })
      await ksPage.waitForTimeout(1600)
      await ksPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await ksPage.waitForTimeout(1000)

      const ksWait = ksPage.locator('[data-testid="navi-finish-wait"]')
      const ksText = (await ksWait.count()) === 0 ? '' : stripZwspText(await ksWait.innerText())
      check(
        'KTSPREAD-03 熱い品が2つで完成が大きくずれる組では、待つことになる品を知らせる',
        (await ksWait.count()) === 1 && ksText.includes(ksFirstTitle) && ksText.includes(ksLastTitle),
        `画面=${ksText}`,
      )
      check(
        'KTSPREAD-03 その一文は ja.ts の文言どおり（画面の日本語を書き写さない）',
        ksText ===
          ja.cookNavi.finishWaitNote.replace('{first}', ksFirstTitle).replace('{last}', ksLastTitle),
        `画面=${ksText} / 期待=${ja.cookNavi.finishWaitNote}`,
      )
      check(
        'KTSPREAD-03 警告に分数が入っていない（消した「約◯分あきます」を戻さない）',
        !/\d+\s*分/.test(ksText) && !ksText.includes('あきます'),
        `画面=${ksText}`,
      )
      // 品ごとの「約◯分後」の一覧は消したまま（戻していない）
      check(
        'KTSPREAD-03 品ごとの「できあがりの目安」の枠は消えたまま',
        (await ksPage.locator('[data-testid="navi-finish-times"]').count()) === 0 &&
          !stripZwspText(await ksPage.textContent('body')).includes('できあがりの目安'),
      )
      // 警告は「全体の調理時間」の枠より後・手順カードより前に出る＝読み進める流れの中にある
      const ksOrder = await ksPage.evaluate(() => {
        const card = document.querySelector('[data-testid="navi-total-card"]')
        const note = document.querySelector('[data-testid="navi-finish-wait"]')
        const firstStep = document.querySelector('[data-testid="navi-step-text"]')
        if (!card || !note || !firstStep) return null
        const y = (el) => Math.round(el.getBoundingClientRect().top + window.scrollY)
        return { card: y(card), note: y(note), step: y(firstStep) }
      })
      check(
        'KTSPREAD-03 警告は全体の調理時間の下・手順カードの上にある（手順より先に読める）',
        ksOrder != null && ksOrder.card < ksOrder.note && ksOrder.note < ksOrder.step,
        JSON.stringify(ksOrder),
      )
    } finally {
      await ksBrowser.close()
    }
  }

