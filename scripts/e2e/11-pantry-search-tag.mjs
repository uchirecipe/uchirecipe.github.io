// ==========================================================================================
// e2e の節: 在庫・絞り込み・検索・タグ
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
// この中の節: EG-01, EH-01, PANTRY-GROUP-01, PANTRYFILTER-01, LISTPANEL-01, HZ-TAG-01, IH-SEARCH-01, IB-TAG-01, HZ-TAG-02
// ==========================================================================================
import './_shared.mjs'


  // --- EG-01: 便EG(2026-08-08 オーナー実機フィードバック⑤〜⑩)。実際に3品を作って見つかった
  //     画面の不備の回帰防止:
  //       ⑤ レシピ名の頭にそのレシピ内の番号(①②③)／行内の「手順◯」表記は出さない
  //       ③ ゆでる工程の前に「湯を沸かす」が「ナビが追加」の印つきで入る
  //       ⑥ 注意書きの箇条書きが行ごとに分かれて表示される
  //       ⑦ そのレシピの最後の手順カードに「完成」が出る
  //       ⑧ レシピ詳細から「戻る」でナビへ帰る(レシピ一覧へ飛ばされない)
  //       ⑨ 献立タブの日に「並行調理を再開」が出て、押すと段取りの続きが開く
  //       ⑩ 献立タブの「全て作った！」は、段取りも終わることを押す前に伝える(規約F) ---
  currentCheck = 'EG-01'
  {
    const egBrowser = await chromium.launch()
    const egContext = await egBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const egPage = await egContext.newPage()
    let egConfirmText = ''
    await collectConfirms(egPage, (text) => {
      egConfirmText = text
    })
    egPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EG-01] ${err.message}`)
    })
    try {
      await egPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await egPage.waitForTimeout(1800)
      await egPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients: [], steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        const idA = await P(store('recipes').add(mk('EGゆで野菜', [
          { text: 'にんじんを切る' },
          { text: 'にんじんをゆでる', memo: '・かたさは竹串で見ること。\n・ゆですぎないこと。' },
          { text: 'ごまで和える' },
        ])))
        const idB = await P(store('recipes').add(mk('EG煮物', [
          { text: '大根を切る' }, { text: '鍋で15分煮る' }, { text: '器に盛る' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await egPage.goto(`${BASE}/#/cook-navi`)
      await egPage.reload({ waitUntil: 'networkidle' })
      await egPage.waitForTimeout(1200)
      await egPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await egPage.waitForTimeout(700)

      const egCards = await egPage.$$eval('ol > li', (lis) => lis.map((li) => li.textContent || ''))
      // ⑤ レシピごとの手順番号。2026-08-09 便EHで丸数字(①②③)をやめ、レシピ色の丸バッジにした
      // （丸数字は12pxでは中の数字が潰れて読めなかった）。行内の「手順◯」という見出しは出さない
      const egCutCard = egPage.locator('ol > li', { hasText: '大根を切る' }).first()
      const egServeCard = egPage.locator('ol > li', { hasText: '器に盛る' }).first()
      check(
        'EG-01 レシピごとの手順番号が、料理名の手前の丸バッジで出る',
        (await egCutCard.locator('[data-testid="navi-recipe-step-number"]').textContent()) === '1' &&
          (await egServeCard.locator('[data-testid="navi-recipe-step-number"]').textContent()) === '3',
      )
      check(
        // 2026-08-09 便ES（オーナー指示D-4）: 「ナビが追加」の札の代わりに、元の手順を
        // 2つに分けたことが分かる番号（◯-1 / ◯-2）を付ける
        'EG-01 ナビが足した工程は「◯-1」の番号で、元の手順の1つめだと分かる',
        /^\d+-1$/.test(
          (await egPage
            .locator('ol > li', { hasText: ja.cookNavi.addedBoilWaterStep })
            .first()
            .locator('[data-testid="navi-recipe-step-number"]')
            .textContent()) ?? '',
        ),
      )
      check(
        'EG-01 行内の「手順◯」の表記は消えている(読み上げ用の隠し文字だけ)',
        (await egPage.locator('ol > li p > span.text-ink-muted', { hasText: /^手順\d+$/ }).count()) === 0,
      )
      // ③ 湯を沸かすの差し込み。2026-08-09 便ES（オーナー指示D-3/D-4）:
      //    「ナビが追加」の札はやめて手順番号を「◯-1」「◯-2」に、分数（約5分）は表示しない
      check(
        'EG-01 ゆでる工程の前に「湯を沸かす」が入る',
        (await egPage.locator('[data-testid="navi-added-step"]').count()) === 0 &&
          egCards.some((t) => t.includes('湯を沸かす')),
        `cards=${JSON.stringify(egCards.map((t) => t.slice(0, 40)))}`,
      )
      check(
        'EG-01 足した工程の分数は表示しない（計算には使う）',
        egCards.some((t) => t.includes('湯を沸かす') && t.includes('沸くまでの待ち時間')) &&
          !egCards.some((t) => t.includes('湯を沸かす') && t.includes('約5分の待ち時間')),
      )
      check(
        'EG-01 分けた2つの工程は「◯-1」「◯-2」の番号で分割が分かる',
        (
          await egPage.$$eval('[data-testid="navi-recipe-step-number"]', (els) =>
            els.map((el) => el.textContent || ''),
          )
        ).filter((t) => /-\d$/.test(t)).length === 2,
      )
      // ⑥ メモの箇条書きが行ごとに分かれる（1本の棒読みにならない）
      const memoCard = egPage.locator('ol > li', { hasText: 'にんじんをゆでる' }).first()
      const memoLines = await memoCard.locator('[data-testid="navi-step-memo"] p').count()
      // 本文はBudouXの折返し用ゼロ幅スペース(U+200B)を含むので、比較の前に取り除く
      const memoText = (await memoCard.locator('[data-testid="navi-step-memo"]').innerText()).replace(/\u200B/g, '')
      check(
        'EG-01 注意書きの箇条書きが行ごとに分かれて表示される',
        memoLines === 2 && memoText.includes('かたさは竹串で見ること。') && memoText.includes('ゆですぎないこと。'),
        `行数=${memoLines} 本文=${JSON.stringify(memoText)}`,
      )
      // ⑦ 各レシピの最後の手順に「完成」
      check(
        'EG-01 レシピごとに最後の手順カードへ「完成」が出る(2品ぶん)',
        (await egPage.locator('[data-testid="navi-recipe-done"]').count()) === 2,
      )
      const doneCards = egCards.filter((t) => t.includes('完成'))
      check(
        'EG-01 「完成」が付くのはそのレシピの最後の手順',
        doneCards.length === 2 &&
          doneCards.some((t) => t.includes('器に盛る')) &&
          doneCards.some((t) => t.includes('ごまで和える')),
        `done=${JSON.stringify(doneCards.map((t) => t.slice(0, 40)))}`,
      )

      // ⑧ レシピ詳細へ行って「戻る」でナビへ帰る
      await egPage.getByRole('link', { name: /EG煮物/ }).last().click()
      await egPage.waitForTimeout(800)
      check('EG-01 段取りの下のリンクからレシピ詳細が開く', /#\/recipes\/\d+/.test(egPage.url()), `url=${egPage.url()}`)
      await egPage.getByRole('button', { name: ja.common.back }).first().click()
      await egPage.waitForTimeout(1000)
      check(
        'EG-01 レシピ詳細の「戻る」でナビに帰る(レシピ一覧へ飛ばされない)',
        egPage.url().includes('/cook-navi'),
        `url=${egPage.url()}`,
      )
      check(
        'EG-01 帰ってきたナビに段取りが残っている',
        (await egPage.textContent('body')).includes('組み合わせる2品'),
      )

      // ⑨ 献立タブの日に「並行調理を再開」
      await egPage.goto(`${BASE}/#/meal-plan`)
      await egPage.waitForTimeout(1000)
      check(
        'EG-01 段取りが残っているとき献立タブに「並行調理ナビを再開」が出る',
        (await egPage.locator('[data-testid="navi-resume"]').count()) === 1 &&
          (await egPage.textContent('body')).includes('並行調理ナビを再開'),
      )
      await egPage.locator('[data-testid="navi-resume"]').click()
      await egPage.waitForTimeout(1000)
      check(
        'EG-01 「並行調理ナビを再開」で段取りの続きが開く',
        egPage.url().includes('/cook-navi') &&
          (await egPage.textContent('body')).includes('組み合わせる2品'),
        `url=${egPage.url()}`,
      )

      // ⑩ 献立タブの「全て作った！」は段取りも終わることを先に伝える
      await egPage.goto(`${BASE}/#/meal-plan`)
      await egPage.waitForTimeout(1000)
      egConfirmText = ''
      // 2026-08-20 便II・⑥: 「全て作った！」は整理モードの中に移った
      await openDayOrganize(egPage)
      await egPage.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked }).click()
      await egPage.waitForTimeout(1000)
      check(
        'EG-01 「全て作った！」の確認文に、段取りも終わることが書いてある(規約F)',
        egConfirmText.includes('並行調理ナビ') &&
          egConfirmText.includes('作りかけの段取りも終わります'),
        egConfirmText.slice(0, 240),
      )
      check(
        'EG-01 記録したあとは「並行調理ナビを再開」も消える(押せない入口を残さない)',
        (await egPage.locator('[data-testid="navi-resume"]').count()) === 0,
      )
    } finally {
      await egBrowser.close()
    }
  }

  // --- EH-01: 便EH(2026-08-09 オーナー実機フィードバック)。並行調理ナビの重大バグと段取り精度:
  //       ① 並行調理中に献立タブから1品だけ「作った！」しても状態が壊れない
  //          (段取りから外れる／押す前に確認が出る／記録が二重にならない)
  //       ② 待ち時間に手作業を詰め込みすぎない
  //       ④ 手順に埋もれた「湯を沸かす」が前の工程として分離される
  //       ⑤ 手作業の手順カードに目安時間が出る
  //       ⑥ ナビから始めたタイマーの番号が段取りの通し番号になる ---
  currentCheck = 'EH-01'
  {
    const ehBrowser = await chromium.launch()
    const ehContext = await ehBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const ehPage = await ehContext.newPage()
    let ehConfirmText = ''
    const ehAccept = true
    await collectConfirms(ehPage, (text) => {
      ehConfirmText = text
    })
    ehPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EH-01] ${err.message}`)
    })
    try {
      await ehPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ehPage.waitForTimeout(1800)
      await ehPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps, ingredients = []) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        const idA = await P(store('recipes').add(mk('EHナムル', [
          { text: 'にんじんは細切りにする。' },
          { text: '鍋にたっぷりの湯を沸かし、にんじんを4分茹でて冷水にとる。' },
          { text: 'ごま油と塩で和える。' },
        ], [
          { name: 'にんじん', amount: '1', unit: '本' },
          { name: 'ごま油', amount: '大さじ1', unit: '' },
          { name: '塩', amount: '少々', unit: '' },
        ])))
        const idB = await P(store('recipes').add(mk('EHオムライス', [
          { text: '鶏肉と玉ねぎを切る。' },
          { text: '鶏肉を炒める。' },
          { text: '玉ねぎがしんなりするまで炒める。' },
          { text: 'ご飯を入れてケチャップで炒める。', minutes: 3 },
          { text: '卵を焼いて包み、皿に盛る。' },
        ])))
        // 合わせ調味料は3品目(色の添字2=--chip-pink)に置く。1品目だとレシピの色と
        // 合わせ調味料のグループ色がどちらも--chip-blueで、色を直したか判別できないため
        const idC = await P(store('recipes').add(mk('EH煮物', [
          { text: '大根を切る。' }, { text: '鍋で15分煮る。' }, { text: '器に盛る。' },
        ], [
          { name: '大根', amount: '1/3', unit: '本' },
          { name: 'しょうゆ', amount: '大さじ2', unit: '', seasoningGroup: 1 },
          { name: 'みりん', amount: '大さじ2', unit: '', seasoningGroup: 1 },
        ])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await ehPage.goto(`${BASE}/#/cook-navi`)
      await ehPage.reload({ waitUntil: 'networkidle' })
      await ehPage.waitForTimeout(1200)
      await ehPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await ehPage.waitForTimeout(800)

      // ④ 手順に埋もれた「湯を沸かす」が前の工程として分離される
      // 本文はBudouXの折返し用ゼロ幅スペース(U+200B)を含むので、突き合わせの前に取り除く
      // （EG-01のメモ検査と同じ作法。ここを忘れると本文の照合が必ず外れる）
      const ehCards = await ehPage.$$eval('ol > li', (lis) =>
        lis.map((li) => (li.textContent || '').replace(/\u200B/g, '').replace(/\s+/g, '')),
      )
      check(
        'EH-01 手順に書かれた湯沸かしが、前の待ち工程として切り出される',
        ehCards.some((t) => t.includes('鍋にたっぷりの湯を沸かす') && t.includes('沸くまでの待ち時間')),
        `cards=${JSON.stringify(ehCards.map((t) => t.slice(0, 40)))}`,
      )
      check(
        'EH-01 切り出したあとの手順は、ゆでる作業だけになる',
        ehCards.some((t) => t.includes('にんじんを4分茹でて冷水にとる。') && !t.includes('湯を沸かし、')),
        `cards=${JSON.stringify(ehCards.map((t) => t.slice(0, 40)))}`,
      )

      // ⑤ 手作業の手順カードに目安時間が出る（書かれた時間と、ナビの見積りを書き分ける）
      check(
        'EH-01 手順に分数があれば「目安◯分」で出る',
        (
          await ehPage
            .locator('ol > li', { hasText: 'ご飯を入れてケチャップで炒める。' })
            .first()
            .locator('[data-testid="navi-active-minutes"]')
            .textContent()
        ) === '目安3分',
      )
      check(
        'EH-01 分数の無い手作業は「この手順の見積り◯分」と書き分ける',
        /^この手順の見積り\d+分$/.test(
          (await ehPage
            .locator('ol > li', { hasText: '鶏肉と玉ねぎを切る。' })
            .first()
            .locator('[data-testid="navi-active-minutes"]')
            .textContent()) ?? '',
        ),
      )
      check(
        'EH-01 待ちの手順には手作業の目安時間を重ねて出さない',
        (await ehPage
          .locator('ol > li', { hasText: '鍋で15分煮る。' })
          .first()
          .locator('[data-testid="navi-active-minutes"]')
          .count()) === 0,
      )

      // ② 4分のゆで待ちに詰め込みすぎない（オーナー実機報告「無理。不可能」の再現）。
      // ゆで上がり(=同じ品の次の手順)までに差し込まれた手作業の**目安時間の合計**が、
      // 待ち時間の4分を超えていないことを見る（工程数ではなく時間で見るのが指摘の趣旨）
      const ehPlan = await ehPage.$$eval('ol > li', (lis) =>
        lis.map((li) => ({
          text: (li.textContent || '').replace(/\u200B/g, '').replace(/\s+/g, ''),
          // 手作業カードの右下に出る目安時間（待ちカードには無いので0）
          minutes:
            Number(
              (li.querySelector('[data-testid="navi-active-minutes"]')?.textContent || '').replace(
                /[^0-9]/g,
                '',
              ),
            ) || 0,
        })),
      )
      const boilAt = ehPlan.findIndex((x) => x.text.includes('にんじんを4分茹でて'))
      const backAt = ehPlan.findIndex((x, i) => i > boilAt && x.text.includes('ごま油と塩で和える'))
      const insertedBetween = boilAt >= 0 && backAt > boilAt ? ehPlan.slice(boilAt + 1, backAt) : []
      const insertedMinutes = insertedBetween.reduce((a, x) => a + x.minutes, 0)
      check(
        'EH-01 4分のゆで待ちに差し込む手作業の合計は4分を超えない(物理的に不可能な段取りにしない)',
        boilAt >= 0 && backAt > boilAt && insertedMinutes <= 4,
        `ゆで=${boilAt + 1}番目 戻り=${backAt + 1}番目 合計${insertedMinutes}分 間に入った工程=${JSON.stringify(
          insertedBetween.map((x) => `${x.text.slice(0, 24)}(${x.minutes}分)`),
        )}`,
      )

      // 合わせ調味料の線は、そのレシピの色（レシピ詳細のグループ色を持ち込まない）
      await ehPage.locator('[data-testid="navi-ingredients-toggle"]').click()
      await ehPage.waitForTimeout(400)
      const ehSeasoningColors = await ehPage.$$eval(
        '[data-testid="navi-ingredients-panel"] li ul li',
        (lis) =>
          lis
            .map((li) => ({
              text: (li.textContent || '').slice(0, 12),
              border: getComputedStyle(li).borderLeftColor,
              // 材料のliの外側にある「レシピの1件」のli（色の線を持つ）と突き合わせる
              recipe: getComputedStyle(li.parentElement.closest('li[style]')).borderLeftColor,
            }))
            .filter((x) => /しょうゆ|みりん/.test(x.text)),
      )
      check(
        'EH-01 合わせ調味料の線の色が、そのレシピの色と同じ',
        ehSeasoningColors.length === 2 && ehSeasoningColors.every((x) => x.border === x.recipe),
        JSON.stringify(ehSeasoningColors),
      )
      check(
        'EH-01 レシピ詳細の合わせ調味料の色(--chip-blue)を持ち込まない',
        ehSeasoningColors.every((x) => x.border !== 'rgb(25, 113, 194)'),
        JSON.stringify(ehSeasoningColors),
      )

      // ⑥ ナビから始めたタイマーの番号は段取りの通し番号。
      // 「タイマーを始める」は、待ち分数が本文に書かれていない待ちカードにだけ出る
      // （本文に「15分」と書いてある手順には出ない＝そこを押そうとすると必ず待ちぼうけになる）。
      // 切り出した「湯を沸かす」がその条件を満たすので、そのカードで見る
      const ehTimerCard = ehPage.locator('ol > li', { hasText: ja.cookNavi.addedBoilWaterStep }).first()
      const ehTimerButton = ehTimerCard.getByRole('button', { name: /タイマーを始める/ })
      if ((await ehTimerButton.count()) === 0) {
        check('EH-01 常駐タイマーの番号が、ナビの段取りの通し番号になる', false, 'タイマー開始ボタンが見つからない')
      } else {
        const ehTimerOrder = await ehTimerCard.locator('span.rounded-full').first().textContent()
        await ehTimerButton.click()
        await ehPage.waitForTimeout(600)
        const ehBarNumber = await ehPage
          .locator('div.fixed button span.rounded-full')
          .first()
          .textContent()
        check(
          'EH-01 常駐タイマーの番号が、ナビの段取りの通し番号になる',
          ehBarNumber === ehTimerOrder,
          `段取りの番号=${ehTimerOrder} タイマーの番号=${ehBarNumber}`,
        )
        const ehTimerClose = ehPage.locator('div.fixed [aria-label="タイマーを消す"]').first()
        if ((await ehTimerClose.count()) > 0) await ehTimerClose.click()
        await ehPage.waitForTimeout(300)
      }

      // ① 献立タブから1品だけ「作った！」したときの挙動。
      // 2026-08-20 便II・⑥で「作った！」は「今日の献立」の整理モードの中に入った。
      // ここで見たいのは**押した結果**（押す前の断り書き・段取りの組み直し）なので、
      // 押せる場所まで進めるためにモードへ入るだけにする
      // （「整理モードの中にある」こと自体を測るのは DAYORG-01 の役目。二重に持たない）
      await ehPage.goto(`${BASE}/#/meal-plan`)
      await ehPage.waitForTimeout(1000)
      await openDayOrganize(ehPage)
      check(
        'EH-01 段取り中は「作った！」が段取りに与える影響を先に書いてある(規約F)',
        (await ehPage.locator('[data-testid="day-navi-cooked-hint"]').count()) === 1,
      )
      ehConfirmText = ''
      const ehCookedButton = ehPage
        .locator('li', { hasText: 'EH煮物' })
        .first()
        .getByRole('button', { name: '作った！' })
      if ((await ehCookedButton.count()) === 0) {
        check('EH-01 今日の献立にEH煮物の「作った！」がある', false, '行が見つからない')
      } else {
        await ehCookedButton.click()
      }
      await ehPage.waitForTimeout(1200)
      check(
        'EH-01 段取りに組んだ品を1品だけ記録するときは、段取りがどう変わるかを先に伝える',
        ehConfirmText.includes('並行調理ナビの段取りからも「EH煮物」が外れ') &&
          ehConfirmText.includes('残りの2品で組み直します'),
        ehConfirmText.slice(0, 240),
      )
      await ehPage.goto(`${BASE}/#/cook-navi`)
      await ehPage.waitForTimeout(1200)
      const ehBody = ((await ehPage.textContent('body')) ?? '').replace(/\u200B/g, '')
      check(
        'EH-01 記録した品は段取りから外れ、残りの2品で組み直される',
        ehBody.includes('組み合わせる2品') && !ehBody.includes('大根を切る'),
      )
      check(
        'EH-01 段取りから外したことを黙って済ませない',
        (await ehPage.locator('[data-testid="navi-selection-dropped"]').count()) === 1,
      )
      check(
        'EH-01 記録した品は「組み合わせるレシピを選ぶ」からも消えている',
        !ehBody.includes('EH煮物'),
      )
      // 「まとめて作った！」で残り2品を記録しても、EH煮物の記録は増えない
      ehConfirmText = ''
      await ehPage.locator('[data-testid="navi-mark-all-cooked"]').click()
      await ehPage.waitForTimeout(1500)
      const ehLogCounts = await ehPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const rows = await new Promise((res, rej) => {
          const req = db.transaction('recipes').objectStore('recipes').getAll()
          req.onsuccess = () => res(req.result)
          req.onerror = () => rej(req.error)
        })
        db.close()
        return rows
          .filter((r) => String(r.title).startsWith('EH'))
          .map((r) => [r.title, r.cookedLogs.length])
      })
      check(
        'EH-01 記録が二重に付かない(1品ずつ記録した品も、まとめて記録した品も1件ずつ)',
        ehLogCounts.length === 3 && ehLogCounts.every(([, n]) => n === 1),
        JSON.stringify(ehLogCounts),
      )

      // --- LG-04（2026-08-26 便LG）: 記録の直後に「作った記録の一覧へ」を出す ---
      //   オーナー原文「レシピ詳細以外からの「作った！」は内容の入力が省略されています。
      //   記録した後に出るトーストに、「作った記録の一覧にいく」選択が欲しいです。」
      //   まとめて作った！は何人分・ひとこと・写真を聞かずに記録するので、足しに行ける場所を添える
      currentCheck = 'LG-04'
      const lgToastShown = Date.now()
      const lgHistoryLink = ehPage.locator('[data-testid="toast-link"]')
      check(
        `LG-04 記録のトーストに「${ja.cookNavi.markAllCookedHistory}」が出る`,
        (await lgHistoryLink.count()) === 1,
        stripZwspText(await ehPage.textContent('body')).slice(0, 200),
      )
      check(
        'LG-04 「元に戻す」も同時に出る（どちらも押せる）',
        (await ehPage.locator('[data-testid="toast-action"]').count()) === 1,
      )
      // 2つ並んでも押す大きさが 44px を割らない（390px幅の実測）
      const lgToastBtns = await ehPage.evaluate(() =>
        ['toast-action', 'toast-link'].map((id) => {
          const el = document.querySelector(`[data-testid="${id}"]`)
          if (!el) return null
          const r = el.getBoundingClientRect()
          return { id, w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }
        }),
      )
      check(
        'LG-04 2つ並んでも、どちらも高さ44px以上で画面からはみ出さない',
        lgToastBtns.every((b) => b && b.h >= 44 && b.right <= 390),
        JSON.stringify(lgToastBtns),
      )
      // 規約: 6秒で消えるトーストを、消えたあとに読んでいた失敗例がある。
      // **消える前に押せる長さか**を測る（押せるまでの実測時間を判定に出す）
      await lgHistoryLink.click()
      const lgPressedMs = Date.now() - lgToastShown
      await ehPage.waitForTimeout(800)
      check(
        `LG-04 トーストが消える前に押せる（押すまで${lgPressedMs}ms・自動で消えるのは6000ms）`,
        lgPressedMs < 6000,
        `${lgPressedMs}ms`,
      )
      check(
        'LG-04 押すと「作った記録の一覧」へ移る',
        ehPage.url().includes('#/history') &&
          stripZwspText(await ehPage.textContent('body')).includes(ja.history.title),
        ehPage.url(),
      )
      void ehAccept
    } finally {
      await ehBrowser.close()
    }
  }

  // --- PANTRY-GROUP-01: 在庫チップの大分類グループ(2026-07-23 オーナー実機FB #1)。
  // 通常表示でグループ見出し(肉・魚介／野菜・きのこ／調味料 …)が出ること、整理モードで選んだ
  // 食材を別グループへ手動移動でき(group手動指定)、IndexedDBに保存されトーストが出ることを確認する ---
  currentCheck = 'PANTRY-GROUP-01'
  {
    const grBrowser = await chromium.launch()
    const grContext = await grBrowser.newContext()
    const grPage = await grContext.newPage()
    grPage.on('dialog', (dialog) => dialog.accept())
    grPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRY-GROUP-01] ${err.message}`)
    })
    const readPantry = () =>
      grPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    try {
      await grPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await grPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品も投入される)
      await grPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await grPage.waitForTimeout(500)

      // 通常表示でグループ見出しが出る(プリセットは野菜・きのこ/肉・魚介/調味料/豆腐・卵・乳/主食・粉を含む)
      const body = await grPage.textContent('body')
      check('PANTRY-GROUP-01 グループ見出し「野菜・きのこ」が表示される', body.includes('野菜・きのこ'))
      check('PANTRY-GROUP-01 グループ見出し「肉・魚介」が表示される', body.includes('肉・魚介'))
      check('PANTRY-GROUP-01 グループ見出し「調味料」が表示される', body.includes('調味料'))
      // ざっくり3段階の説明の一言(#12)も同じ画面に出る
      check('PANTRY-GROUP-01 在庫のざっくり3段階の一言(#12)が出る', body.includes('ざっくり3段階で記録'))

      // 整理モードに入り、玉ねぎを選んで「調味料」グループへ移動する
      await grPage.getByRole('button', { name: '整理', exact: true }).click()
      await grPage.waitForTimeout(300)
      await grPage.getByRole('button', { name: '玉ねぎ', exact: true }).click()
      await grPage.waitForTimeout(150)
      await grPage.getByRole('button', { name: ja.pantry.group.seasoning, exact: true }).click()
      await grPage.waitForTimeout(400)
      const toast = await grPage.textContent('body')
      check(
        'PANTRY-GROUP-01 グループ移動でトーストが出る',
        toast.includes('1件を「調味料」に移動しました'),
        toast.slice(0, 160),
      )
      const items = await readPantry()
      check(
        'PANTRY-GROUP-01 玉ねぎのgroupがseasoningに保存される(手動グループ変更)',
        items.find((p) => p.name === '玉ねぎ')?.group === 'seasoning',
        `玉ねぎ=${JSON.stringify(items.find((p) => p.name === '玉ねぎ'))}`,
      )
    } finally {
      await grBrowser.close()
    }
  }

  // --- PANTRYFILTER-01: レシピ一覧の絞り込みに「在庫の食材で絞る」チップ(2026-07-24 便BN・司令部追加)。
  // 在庫(ある/少ない)が1件も無いうちはチップを出さず、在庫を1品「ある」にするとチップが出て、ONに
  // すると在庫の食材を使うレシピだけに件数が絞られる(判定は在庫との一致順と同じ部分一致)ことを確認する。
  // 他チェックに影響しないよう専用のbrowser/contextで完結させる ---
  currentCheck = 'PANTRYFILTER-01'
  {
    const pfBrowser = await chromium.launch()
    const pfContext = await pfBrowser.newContext()
    const pfPage = await pfContext.newPage()
    pfPage.on('dialog', (dialog) => dialog.accept())
    pfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRYFILTER-01] ${err.message}`)
    })
    const cardCount = () =>
      pfPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
    try {
      await pfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品は全て「ない」で投入)

      // 1) 在庫が全て「ない」のうちは、絞り込みパネルに「在庫の食材で絞る」チップが出ない
      await pfPage.locator('button[aria-label="絞り込み"]').click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 在庫が空のうちはチップが出ない',
        !(await pfPage.textContent('body')).includes('在庫の食材で絞る'),
      )
      // 1b) 「食材の在庫から入れる」(2026-08-02 オーナー指示・便DF)は、入れられる食材が
      // 無いときもボタン自体は出し、押せない状態＋理由の1行を添える(旧実装はボタンごと
      // 消えていて、機能があること自体に気づけなかった)
      const pfFillBtn = pfPage.getByRole('button', { name: ja.search.pantryToIngredients })
      check(
        'PANTRYFILTER-01(便DF) 在庫が空でも「食材の在庫から入れる」ボタンは出る(押せない状態)',
        (await pfFillBtn.count()) === 1 && (await pfFillBtn.isDisabled()),
      )
      check(
        'PANTRYFILTER-01(便DF) 押せない理由が1行で出る',
        (await pfPage.textContent('body')).includes(
          '食材の在庫で「ある」「少ない」にした食材が、使いたい食材に入ります',
        ),
      )
      // パネルを閉じる
      await pfPage.locator('[data-testid="filter-panel-close"]').click()
      await pfPage.waitForTimeout(200)

      // 2) 在庫の「玉ねぎ」を1タップして「ある」にする(none→have)
      await pfPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(500)
      await pfPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 玉ねぎを「ある」にできた',
        (await pfPage.textContent('body')).includes('玉ねぎ（ある）'),
      )

      // 3) レシピ一覧に戻ると、絞り込みパネルにチップが出る
      await pfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(800)
      const totalCards = await cardCount()
      await pfPage.locator('button[aria-label="絞り込み"]').click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 在庫があるとチップが出る',
        (await pfPage.textContent('body')).includes('在庫の食材で絞る'),
      )

      // 3b) 「食材の在庫から入れる」が押せるようになり、押すと在庫の食材が
      // 「使いたい食材」のチップとして入る(2026-08-02 オーナー指示・便DF)
      const pfFillBtn2 = pfPage.getByRole('button', { name: ja.search.pantryToIngredients })
      check('PANTRYFILTER-01(便DF) 在庫があると「食材の在庫から入れる」が押せる', await pfFillBtn2.isEnabled())
      await pfFillBtn2.click()
      await pfPage.waitForTimeout(400)
      // 「使いたい食材」のチップは ChipInput(span+✗ボタン)。在庫の「玉ねぎ」が入ったことを見る
      const wantedChips = () =>
        pfPage.evaluate(() =>
          Array.from(document.querySelectorAll('span'))
            .filter((s) => s.querySelector('button[aria-label="このチップを削除"]'))
            .map((s) => s.textContent?.trim() ?? ''),
        )
      check(
        'PANTRYFILTER-01(便DF) 押すと在庫の食材が使いたい食材に入る',
        (await wantedChips()).includes('玉ねぎ'),
        `チップ=${JSON.stringify(await wantedChips())}`,
      )
      // 入れた食材を外して、以降の件数チェックに影響させない
      await pfPage.getByRole('button', { name: ja.chip.remove }).first().click()
      await pfPage.waitForTimeout(400)
      check('PANTRYFILTER-01(便DF) 入れた食材は✗で外せる', (await wantedChips()).length === 0)

      // 4) ONにすると在庫の食材(玉ねぎ)を使うレシピだけに件数が絞られる
      await pfPage.getByRole('button', { name: ja.search.pantryFilter, exact: true }).click()
      await pfPage.waitForTimeout(400)
      const filteredCards = await cardCount()
      check(
        'PANTRYFILTER-01 チップONで件数が絞られる(0<絞り込み後<全件)',
        filteredCards > 0 && filteredCards < totalCards,
        `全件=${totalCards} 絞り込み後=${filteredCards}`,
      )
    } finally {
      await pfBrowser.close()
    }
  }

  // --- LISTPANEL-01: レシピ一覧の並び替え/絞り込みパネルの再構成(2026-08-03 オーナー指示・便DI)。
  //   ③ 並び替えパネルの「並び順」(昇順/降順)がパネルの一番上に来ていること
  //   ⑦ 並べ替えに「最近作った順」があること
  //   ⑤ 絞り込みパネルの先頭が「レシピを絞り込む」(お気に入り等の頻用条件)で、
  //      「タグ」「調理時間」「手間レベル」より上にあること
  //      (見出しは2026-08-10 便FFで「表示するレシピ」→2026-08-19 便HU・⑫で現在の名前に改称)
  //   ④ 「タグ」が直書きの固定2択ではなく、実際の使用頻度で並んでいること
  //      (2026-08-10 便FFで見出しを「よく使うタグ」から改称し、チップに件数を併記)
  //   ⑥ 「自分で登録したレシピのみ」だけがONのときも「条件をクリア」が出て、押すと戻ること ---
  currentCheck = 'LISTPANEL-01'
  {
    const lpBrowser = await chromium.launch()
    const lpContext = await lpBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const lpPage = await lpContext.newPage()
    lpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LISTPANEL-01] ${err.message}`)
    })
    try {
      await lpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await lpPage.waitForTimeout(1800) // 初回シード完了待ち

      // 見出し・チップの縦位置を測って「上にあるか」を判定する共通関数
      const topOf = (text) =>
        lpPage.evaluate((t) => {
          const el = Array.from(document.querySelectorAll('p, button')).find(
            (n) => n.textContent?.trim() === t,
          )
          return el ? el.getBoundingClientRect().top + window.scrollY : null
        }, text)

      // ---------- ③ 並び順がパネルの最上部 / ⑦ 最近作った順 ----------
      await lpPage.locator('button[aria-label="並び替え"]').click()
      await lpPage.waitForTimeout(300)
      const dirTop = await topOf('並び順')
      const sortTop = await topOf('並べ替え')
      check(
        'LISTPANEL-01(③) 並び替えパネルの「並び順」が「並べ替え」より上にある',
        dirTop != null && sortTop != null && dirTop < sortTop,
        `並び順=${dirTop} 並べ替え=${sortTop}`,
      )
      const nutritionTop = await topOf('栄養価で並び替え')
      check(
        'LISTPANEL-01(③) 「並び順」は栄養価の区分よりも上(末尾に埋もれていない)',
        dirTop != null && nutritionTop != null && dirTop < nutritionTop,
        `並び順=${dirTop} 栄養価で並び替え=${nutritionTop}`,
      )
      const recentBtn = lpPage.getByRole('button', { name: ja.search.sortRecentCooked, exact: true })
      check('LISTPANEL-01(⑦) 並べ替えに「最近作った順」がある', (await recentBtn.count()) === 1)
      await recentBtn.click()
      await lpPage.waitForTimeout(300)
      check(
        'LISTPANEL-01(⑦) 「最近作った順」を選ぶと既定で降順(新しい方から)になる',
        await lpPage.evaluate(() => {
          const target = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === '降順',
          )
          return target ? target.className.includes('border-accent') : false
        }),
      )
      // 記録が1件も無い状態では全レシピが同着なので、件数が減っていない(絞り込みではない)ことだけ見る
      const recentCards = await lpPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
      check(
        'LISTPANEL-01(⑦) 「最近作った順」は並べ替えなので件数が減らない',
        recentCards > 0,
        `件数=${recentCards}`,
      )
      // 既定(更新順)に戻してパネルを閉じる
      await lpPage.getByRole('button', { name: ja.search.sortUpdated, exact: true }).click()
      await lpPage.waitForTimeout(200)
      await lpPage.locator('[data-testid="sort-panel-close"]').click()
      await lpPage.waitForTimeout(300)

      // ---------- ⑤ 絞り込みパネルの区分見出しと並び ----------
      await lpPage.locator('button[aria-label="絞り込み"]').click()
      await lpPage.waitForTimeout(300)
      // 見出しは2026-08-19 便HU・⑫(オーナー指示)で「どのレシピから探すか」→「レシピを絞り込む」
      const shownTop = await topOf('レシピを絞り込む')
      // 欄の見出しは ja.ts から読む（2026-08-20 便IH・①で「タグ」→「キーワード」に改名。
      // 画面の字を書き写すと、次の改名でここだけ古くなる）
      const tagTop = await topOf(ja.search.tagTitle)
      const timeTop = await topOf('調理時間')
      const effortTop = await topOf('手間レベル')
      const favTop = await topOf('お気に入り')
      check(
        'LISTPANEL-01(⑤・便HU⑫) 「レシピを絞り込む」の区分見出しがある',
        shownTop != null,
      )
      check(
        `LISTPANEL-01(⑤) 「レシピを絞り込む」が「${ja.search.tagTitle}」・調理時間・手間レベルより上にある`,
        shownTop != null &&
          tagTop != null &&
          timeTop != null &&
          effortTop != null &&
          shownTop < tagTop &&
          tagTop < timeTop &&
          timeTop < effortTop,
        `レシピを絞り込む=${shownTop} ${ja.search.tagTitle}=${tagTop} 調理時間=${timeTop} 手間レベル=${effortTop}`,
      )
      check(
        'LISTPANEL-01(⑤) 「お気に入り」が手間レベルより上に来た(旧: パネル末尾で見えなかった)',
        favTop != null && effortTop != null && favTop < effortTop,
        `お気に入り=${favTop} 手間レベル=${effortTop}`,
      )

      // ---------- ④ タグが使用頻度ベース(2026-08-10 便FFで件数を併記) ----------
      const tagChips = await lpPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipes-tag-chip"]')).map(
          (b) => b.textContent?.trim() ?? '',
        ),
      )
      check(
        'LISTPANEL-01(④) タグが直書きの2択(作り置き・お弁当)ではなくなっている',
        tagChips.length > 3,
        `チップ=${JSON.stringify(tagChips)}`,
      )
      check(
        'LISTPANEL-01(④) 件数つきで多い順に並ぶ(基本レシピ109品: 和食66→作り置き44→定番28)',
        JSON.stringify(tagChips.slice(0, 4)) ===
          JSON.stringify(['すべて', '和食 66', '作り置き 44', '定番 28']),
        `チップ=${JSON.stringify(tagChips)}`,
      )
      check(
        'LISTPANEL-01(④) 上位6件までに収まる(「すべて」を除く。件数を併記した分だけ8→6に減らした)',
        tagChips.length <= 7,
        `チップ=${JSON.stringify(tagChips)}`,
      )
      // 実際に絞り込みとして効く(チップの文字列と絞り込みの判定が食い違っていない)
      const beforeTagCount = await lpPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
      await lpPage.getByRole('button', { name: '和食 66', exact: true }).click()
      await lpPage.waitForTimeout(400)
      const afterTagCount = await lpPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
      check(
        'LISTPANEL-01(④) タグチップを押すとそのタグのレシピだけに絞られる',
        afterTagCount > 0 && afterTagCount < beforeTagCount,
        `全件=${beforeTagCount} 和食=${afterTagCount}`,
      )
      // タグの「すべて」に戻す(「料理の種別」等にも同名のボタンがあるので、タグの行から選ぶ)
      await lpPage.locator('[data-testid="recipes-tag-chip"]').first().click()
      await lpPage.waitForTimeout(300)

      // ---------- ⑥ 「自分で登録したレシピのみ」だけでも条件をクリアが出る ----------
      const clearInPanel = () => lpPage.getByRole('button', { name: ja.search.clear })
      check(
        'LISTPANEL-01(⑥) 条件が何も無いうちは「条件をクリア」が出ない(前提)',
        (await clearInPanel().count()) === 0,
      )
      await lpPage.getByRole('button', { name: ja.search.myRecipesOnly, exact: true }).click()
      await lpPage.waitForTimeout(400)
      // 自作レシピ0件だと一覧が0件になり、空状態側にも「条件をクリア」が出る。
      // 見たいのは絞り込みパネルの中(=「レシピを絞り込む」の見出しより上)に出ているかどうか
      check(
        'LISTPANEL-01(⑥) 「自分で登録したレシピのみ」だけでも絞り込みパネルに「条件をクリア」が出る',
        await lpPage.evaluate(() => {
          const heading = Array.from(document.querySelectorAll('p')).find(
            (n) => n.textContent?.trim() === 'レシピを絞り込む',
          )
          const clears = Array.from(document.querySelectorAll('button')).filter(
            (b) => b.textContent?.trim() === '条件をクリア',
          )
          if (!heading || clears.length === 0) return false
          const headingTop = heading.getBoundingClientRect().top
          return clears.some((b) => b.getBoundingClientRect().top < headingTop)
        }),
      )
      await clearInPanel().first().click()
      await lpPage.waitForTimeout(500)
      check(
        'LISTPANEL-01(⑥) 「条件をクリア」で「自分で登録したレシピのみ」もOFFに戻る',
        (await lpPage
          .getByRole('button', { name: ja.search.myRecipesOnly, exact: true })
          .getAttribute('aria-pressed')) === 'false',
      )
      check(
        'LISTPANEL-01(⑥) クリア後は基本レシピが一覧に戻る',
        (await lpPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()) > 0,
      )
    } finally {
      await lpBrowser.close()
    }
  }

  // --- HZ-TAG-01: よく使う検索を「絞り込みのタグ」として登録する（2026-08-19 便HZ・② オーナー
  //     「検索結果にタグづけは、絞り込んだレシピにタグをつけるのではなく、絞り込み機能の『タグ』に
  //      新しいタグを追加する、という意味でした。レシピ自体はいじりません」
  //      「よく使うタグを自分で設定する機能です」）。
  //
  //     【この検査でいちばん測ること】**レシピのデータが1件も変わらないこと**。
  //     以前の版（便HU・⑭）は、押した時点で検索に一致したレシピにタグを書き込んでいた。
  //     端末の中身（IndexedDBのrecipes）を登録の前後で丸ごと読み比べる。
  //     読み取れなかった（0件だった）ときは必ず落ちる形にする。
  //     あわせて ⑮「高たんぱく」がタグの候補から消えていること・レシピ側には残っていることも見る ---
  currentCheck = 'HZ-TAG-01'
  {
    const htBrowser = await chromium.launch()
    const htContext = await htBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const htPage = await htContext.newPage()
    htPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@HZ-TAG-01] ${err.message}`)
    })
    // 端末に入っているレシピを丸ごと読む（並びに左右されないようidの順にそろえる）。
    // 1品ずつ文字列にしておくと、変わった品だけを名指しで報告できる
    const HT_READ_RECIPES = `(async () => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('uchi-recipe')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      const all = await new Promise((res, rej) => {
        const q = db.transaction('recipes').objectStore('recipes').getAll()
        q.onsuccess = () => res(q.result)
        q.onerror = () => rej(q.error)
      })
      return all.slice().sort((a, b) => (a.id ?? 0) - (b.id ?? 0)).map((r) => JSON.stringify(r))
    })()`
    try {
      // カードはグリッド/リストどちらの表示でも同じように数えたいので、置き場所ではなく
      // 「レシピ1品へのリンク」であることで拾う（#/recipes/新規 は数に入らない）
      const htIds = () =>
        htPage.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => /^#\/recipes\/\d+$/.test(href)),
        )
      const htCards = async () => (await htIds()).length
      const htOpenFilter = async () => {
        await htPage.locator('button[aria-label="絞り込み"]').click()
        await htPage.waitForTimeout(400)
      }
      await htPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await htPage.waitForTimeout(2000)
      const htTotal = await htCards()
      check('HZ-TAG-01 前提: 一覧にレシピが出ている', htTotal > 0, `全件=${htTotal}`)

      // ---------- ⑮ 「高たんぱく」は絞り込みの候補に出さない（レシピ側のタグは残す） ----------
      await htOpenFilter()
      const htTagChips = await htPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipes-tag-chip"]')).map(
          (b) => b.textContent?.trim() ?? '',
        ),
      )
      check(
        'HZ-TAG-01(⑮) 前提: タグの候補を読み取れている',
        htTagChips.length > 1,
        `チップ=${JSON.stringify(htTagChips)}`,
      )
      check(
        'HZ-TAG-01(⑮) 「高たんぱく」が絞り込みのタグの候補に出ない',
        !htTagChips.some((t) => t.startsWith('高たんぱく')),
        `チップ=${JSON.stringify(htTagChips)}`,
      )
      await htPage.locator('[data-testid="filter-panel-close"]').click()
      await htPage.waitForTimeout(300)
      // レシピ側のタグは消していない＝検索で「高たんぱく」を打てば当たる（データを失っていない）
      await htPage.locator('input[type="search"]').fill('高たんぱく')
      await htPage.waitForTimeout(700)
      const htProteinHits = await htCards()
      check(
        'HZ-TAG-01(⑮) レシピに付いた「高たんぱく」タグは残っている(検索で当たる)',
        htProteinHits > 0 && htProteinHits < htTotal,
        `高たんぱくの検索結果=${htProteinHits} 全件=${htTotal}`,
      )

      // ---------- ② 登録の前に、端末に入っているレシピを丸ごと控える ----------
      await htPage.locator('input[type="search"]').fill('')
      await htPage.waitForTimeout(600)
      const htBefore = await htPage.evaluate(HT_READ_RECIPES)
      check(
        'HZ-TAG-01(②) 前提: 端末のレシピの中身を読み取れている',
        Array.isArray(htBefore) && htBefore.length > 0 && htBefore.length === htTotal,
        `読み取れた品数=${Array.isArray(htBefore) ? htBefore.length : 'null'} 一覧の品数=${htTotal}`,
      )

      // ---------- ② 登録 → 絞り込みに出る → 押すとその検索が戻る ----------
      await htPage.locator('input[type="search"]').fill('豆腐')
      await htPage.waitForTimeout(800)
      const htHitIds = await htIds()
      check(
        'HZ-TAG-01 前提: 検索の結果が0件でも全件でもない',
        htHitIds.length > 0 && htHitIds.length < htTotal,
        `検索結果=${htHitIds.length} 全件=${htTotal}`,
      )
      const htAddButton = htPage.locator('[data-testid="saved-search-add"]')
      const htAddLabel = ((await htAddButton.textContent()) ?? '').replace(/​/g, '')
      check(
        'HZ-TAG-01(②) 登録ボタンに、登録する言葉が出ている',
        htAddLabel.includes('豆腐') && htAddLabel.includes(ja.search.tagTitle),
        `ボタン=${htAddLabel}`,
      )
      // 2026-08-20 便IH・③（オーナー「『「」を絞り込みの〜登録』→『「」をキーワードに登録』。
      // 下に説明あるので。」）: 行き先はボタンから落として、真下の1行が言い切る形にした。
      // **どちらかに必ず行き先が出ている**ことを見る（両方から消えると、押した先が分からなくなる）
      const htAddHint = ((await htPage.textContent('body')) ?? '').replace(/​/g, '')
      check(
        `HZ-TAG-01(②) 登録の行き先(絞り込みの「${ja.search.tagTitle}」)が、ボタンかその下の説明に出ている`,
        htAddHint.includes(ja.search.savedSearchAddHint),
        `説明=${ja.search.savedSearchAddHint}`,
      )
      // 何品に付くか、という言い方が残っていない（レシピに書き込む機能ではなくなった）
      check(
        'HZ-TAG-01(②) 登録ボタンが「レシピ◯品にタグを付ける」になっていない',
        !/レシピ\d+品/.test(htAddLabel),
        `ボタン=${htAddLabel}`,
      )
      await htAddButton.click()
      await htPage.waitForTimeout(900)
      // 検索語を消しても、タグとして残っていること
      await htPage.locator('input[type="search"]').fill('')
      await htPage.waitForTimeout(700)
      check(
        'HZ-TAG-01(②) 検索語を消すと全件に戻る(前提)',
        (await htCards()) === htTotal,
        `全件=${htTotal}`,
      )
      await htOpenFilter()
      const htSavedChip = htPage.locator('[data-testid="recipes-saved-search-chip"]').first()
      check(
        'HZ-TAG-01(②) 登録したタグが絞り込みに出る',
        (await htPage.locator('[data-testid="recipes-saved-search-chip"]').count()) === 1,
        `登録したタグの数=${await htPage.locator('[data-testid="recipes-saved-search-chip"]').count()}`,
      )
      await htSavedChip.click()
      await htPage.waitForTimeout(700)
      const htRecalledIds = await htIds()
      check(
        'HZ-TAG-01(②) 登録したタグを押すと、登録したときと同じ検索が戻る',
        JSON.stringify(htRecalledIds) === JSON.stringify(htHitIds),
        `押した後=${JSON.stringify(htRecalledIds)} 登録したとき=${JSON.stringify(htHitIds)}`,
      )
      // 2026-08-19 便IB・②: 登録したタグは、もとからあるタグと同じ「絞り込みのタグ」として効く
      // （押しても検索欄は動かない＝2つのタグで押したときの効き方が違う、という状態を作らない）
      check(
        'HZ-TAG-01(②) 登録したタグを押しても検索欄は変わらない(タグの選択として効く)',
        (await htPage.locator('input[type="search"]').inputValue()) === '',
        `検索欄=${await htPage.locator('input[type="search"]').inputValue()}`,
      )
      check(
        'HZ-TAG-01(②) 押した登録したタグが「選ばれている」状態になる',
        (await htSavedChip.getAttribute('aria-pressed')) === 'true',
        `aria-pressed=${await htSavedChip.getAttribute('aria-pressed')}`,
      )

      // ---------- ② 削除できる（規約F: 何が消えて何が残るか） ----------
      await htPage.evaluate(() => {
        window.__confirmDialogs = []
      })
      await htPage.locator('[data-testid="recipes-saved-search-remove"]').first().click()
      await htPage.waitForTimeout(1000)
      const htRemoveConfirm = (
        await htPage.evaluate(() => (window.__confirmDialogs ?? []).join('\n'))
      ).replace(/​/g, '')
      check(
        'HZ-TAG-01(②) 削除の確認に「消えるもの」と「残るもの」が両方出る(規約F)',
        htRemoveConfirm.includes('消えるもの') && htRemoveConfirm.includes('残るもの'),
        `窓=${htRemoveConfirm}`,
      )
      check(
        'HZ-TAG-01(②) 削除の確認に、レシピが変わらないことが品数つきで出る',
        new RegExp(`レシピ${htTotal}品`).test(htRemoveConfirm),
        `窓=${htRemoveConfirm} 全件=${htTotal}`,
      )
      await htPage.waitForTimeout(400)
      check(
        'HZ-TAG-01(②) 削除すると登録したタグの欄から消える',
        (await htPage.locator('[data-testid="recipes-saved-search-chip"]').count()) === 0,
      )

      // ---------- ② いちばんの肝: ここまでの通しでレシピのデータが1件も変わっていない ----------
      await htPage.locator('input[type="search"]').fill('')
      await htPage.waitForTimeout(800)
      const htAfter = await htPage.evaluate(HT_READ_RECIPES)
      const htChanged =
        Array.isArray(htAfter) && Array.isArray(htBefore)
          ? htAfter.filter((row, i) => row !== htBefore[i])
          : null
      check(
        'HZ-TAG-01(②) 登録→押す→削除を通してもレシピのデータが1件も変わらない',
        Array.isArray(htAfter) &&
          htAfter.length > 0 &&
          htAfter.length === htBefore.length &&
          htChanged.length === 0,
        `前=${Array.isArray(htBefore) ? htBefore.length : 'null'}品 後=${
          Array.isArray(htAfter) ? htAfter.length : 'null'
        }品 変わった品=${htChanged == null ? '読めない' : htChanged.slice(0, 2).join(' / ')}`,
      )
      check(
        'HZ-TAG-01(②) レシピは1品も消えていない',
        (await htCards()) === htTotal,
        `いまの品数=${await htCards()} 全件=${htTotal}`,
      )
    } finally {
      await htBrowser.close()
    }
  }

  // --- IH-SEARCH-01: 絞り込みの欄の呼び名（①）と、打った言葉が「どこに当たったか」（②）
  //     （2026-08-20 便IH）
  //
  //     オーナー原文（①）: 「絞り込み『タグ』は、追加可能になった＝タグ以外も登録できる、ので、
  //       『ワード』『キーワード』のような別の名前がいいのでは？このアプリでの『タグ』は
  //       レシピカードに表示されるワードなので。」
  //     オーナー原文（②）: 「キーワード検索はどこからワードを拾ってきますか？『魚』と入れたところ
  //       ６件ありましたが、レシピのタグやキーワードに入っているわけではなさそうでした。」
  //       →（訂正1）「各レシピカードに表示ではなく、検索バーの下に…羅列するイメージ」
  //       →（訂正2）「そんなに長くなるなら、羅列部分は…窓出して表示したらいいのでは？
  //          それでも上限は必須。」
  //
  //     【この検査で測ること】
  //      ①絞り込みのパネルに、古い呼び名（レシピに付いている印＝「タグ」）が1つも残っていない
  //        ＝欄の見出しは ja.ts の値そのもの（画面の字を書き写さない）
  //      ②検索していないときは入口が出ない／レシピカードには一致した場所を1つも出さない
  //        （訂正1で取り下げた形に戻っている）
  //      ③入口を押すと窓が開き、一致した場所が品数の多い順に並ぶ
  //      ④**窓の数字と、実際に画面へ出ている品数が合っている**（数字を書き写さず、
  //        画面から数え直して突き合わせる）
  //      ⑤上限を超えたときは「ほか◯件」で数を出す（黙って切らない）
  //
  //     品数は決め打ちしない（レシピが増減しても当たる）。読み取りに失敗したら必ず落ちる
  //     （カードが0枚・窓の行を1つも読めない・数字を読めないときは不合格）---
  currentCheck = 'IH-SEARCH-01'
  {
    const ihBrowser = await chromium.launch()
    const ihContext = await ihBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ihPage = await ihContext.newPage()
    ihPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@IH-SEARCH-01] ${err.message}`)
    })
    try {
      const ihClean = (text) => (text ?? '').replace(/​/g, '').replace(/\s+/g, ' ').trim()
      /** 画面に出ているカードの料理名（何番目のカードか・入れ子の段数には頼らない） */
      const ihTitles = () =>
        ihPage.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .filter((a) => /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''))
            .map((a) =>
              (a.querySelector('[data-testid="recipe-card-title"]')?.textContent ?? '')
                .replace(/​/g, '')
                .trim(),
            ),
        )
      /** カードのどこかに一致した場所が出ていないか（訂正1で取り下げた形が残っていないか） */
      const ihCardReasons = () =>
        ihPage.locator('[data-testid="card-match-reason"]').count()
      /** 窓の中の行を「出どころ・言葉・品数」に分けて読む。読めなければ count が null */
      const ihRows = () =>
        ihPage.evaluate(() =>
          Array.from(document.querySelectorAll('[data-testid="search-match-word"]')).map((el) => {
            const text = (el.textContent ?? '').replace(/​/g, '').trim()
            const m = text.match(/(\d+)品\s*$/)
            const quoted = text.match(/^(.+?)「(.+)」\s*\d+品\s*$/)
            return {
              text,
              field: quoted ? quoted[1].trim() : text.replace(/\s*\d+品\s*$/, '').trim(),
              word: quoted ? quoted[2] : null,
              count: m ? Number(m[1]) : null,
            }
          }),
        )
      const ihSearch = async (q) => {
        await ihPage.locator('input[type="search"]').fill(q)
        await ihPage.waitForTimeout(1000)
      }
      const ihOpenDialog = async () => {
        await ihPage.locator('[data-testid="search-match-open"]').click()
        await ihPage.waitForTimeout(500)
      }
      const ihCloseDialog = async () => {
        await ihPage.locator('[data-testid="search-match-close"]').click()
        await ihPage.waitForTimeout(400)
      }
      await ihPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ihPage.waitForTimeout(2000)

      // ---- ② 検索していないときは入口が出ない ------------------------------------------------
      const ihIdle = await ihTitles()
      check('IH-SEARCH-01 前提: 一覧にカードが出ている', ihIdle.length > 0, `カード=${ihIdle.length}枚`)
      check(
        'IH-SEARCH-01 前提: 料理名を読み取れている(読めないまま合格にしない)',
        ihIdle.every((t) => t !== ''),
        `料理名の読めないカード=${ihIdle.filter((t) => t === '').length}枚`,
      )
      check(
        'IH-SEARCH-01(②) 検索していないときは一致した場所の入口が出ない',
        (await ihPage.locator('[data-testid="search-match-open"]').count()) === 0,
      )
      /**
       * 件数の行（「◯品 / 全◯品」「自分で登録 ◯/30品」）の高さと、数字が欠けていないか。
       * 入口はこの行に入るので、**出入りしても行の高さが動かない**ことと、
       * **数字が「…」で欠けない**ことを、検索の前後で同じ物差しで測る（2026-08-20 便IH・②）
       */
      const ihCountRow = () =>
        ihPage.evaluate(() => {
          const label = document.querySelector('[data-testid="free-limit-count"]')
          const p = label?.parentElement
          const row = p?.parentElement
          if (!p || !row) return null
          return {
            h: Math.round(row.getBoundingClientRect().height),
            clip: Math.max(0, p.scrollWidth - p.clientWidth),
            text: (p.textContent ?? '').replace(/\s+/g, ' ').trim(),
          }
        })
      const ihRowIdle = await ihCountRow()
      check(
        'IH-SEARCH-01(②) 前提: 件数の行を測れている(読めないまま合格にしない)',
        ihRowIdle != null && ihRowIdle.h > 0 && ihRowIdle.text !== '',
        `実測=${JSON.stringify(ihRowIdle)}`,
      )

      // ---- ①絞り込みのパネルの呼び名 ---------------------------------------------------------
      await ihPage.locator('button[aria-label="絞り込み"]').click()
      await ihPage.waitForTimeout(600)
      const ihPanel = ihClean(await ihPage.textContent('[data-testid="recipes-filter-panel"]'))
      check('IH-SEARCH-01 前提: 絞り込みのパネルの中身を読めている', ihPanel.length > 0, `字数=${ihPanel.length}`)
      check(
        'IH-SEARCH-01(①) 絞り込みの欄の見出しが画面に出ている',
        ihPanel.includes(ja.search.tagTitle),
        `見出し=「${ja.search.tagTitle}」 パネル=${ihPanel.slice(0, 120)}`,
      )
      check(
        'IH-SEARCH-01(①) 絞り込みのパネルに、レシピに付いている印の呼び名が1つも残っていない',
        // 「以前の版でレシピに書き込まれたタグ」の後始末の欄は、書き込まれたタグが
        // 残っている端末にだけ出る（この検査は初回起動の端末なので出ない）
        !ihPanel.includes(ja.form.tagsLabel),
        `パネル=${ihPanel.slice(0, 400)}`,
      )
      await ihPage.locator('[data-testid="filter-panel-close"]').click()
      await ihPage.waitForTimeout(400)

      // ---- ②③ 「魚」（オーナーが実機で見た言葉） ----------------------------------------------
      await ihSearch('魚')
      const ihFishTitles = await ihTitles()
      check('IH-SEARCH-01(②) 「魚」で1品以上出る', ihFishTitles.length > 0, `出た品数=${ihFishTitles.length}`)
      check(
        'IH-SEARCH-01(②) レシピカードには一致した場所を1つも出さない(訂正1で取り下げた形に戻っている)',
        (await ihCardReasons()) === 0,
        `カードに出ていた一致した場所=${await ihCardReasons()}件`,
      )
      const ihEntry = ihClean(await ihPage.textContent('[data-testid="search-match-open"]'))
      check(
        'IH-SEARCH-01(②) 検索すると一致した場所の入口が出る',
        ihEntry === ja.search.matchEntry,
        `入口=${ihEntry} 期待=${ja.search.matchEntry}`,
      )
      // 訂正3「一列使わず、キーワード登録に並べられるくらい小さく」＋訂正4（置き場所）
      // 「『一致した場所』は、全◯品自分で登録◯品、の隣の方がいいかも。キーワード登録が
      //  されているワードの時に、列を増やす必要がなくなるので。」
      //
      // 測るのは3つ:
      //  ・入口が**件数の行の中**にある（行を増やしていない）
      //  ・入口は行を丸ごと使わない（幅が画面の半分未満）
      //  ・**押せる大きさは44pxを割らない**（中心から21pxの4点を実際に突く）
      // どれも「何番目の要素か」ではなく**同じ行にいるか・実際に押せるか**で見るので、
      // 並びが変わっても当たる
      const ihEntryBox = await ihPage.evaluate(() => {
        const entry = document.querySelector('[data-testid="search-match-open"]')
        const countRow = document
          .querySelector('[data-testid="free-limit-count"]')
          ?.closest('div')
        if (!entry) return null
        entry.scrollIntoView({ block: 'center' })
        const r = entry.getBoundingClientRect()
        const c = countRow?.getBoundingClientRect()
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        const d = 21
        const dead = [
          [cx - d, cy],
          [cx + d, cy],
          [cx, cy - d],
          [cx, cy + d],
        ].filter(([x, y]) => {
          const hit = document.elementFromPoint(x, y)
          return !(hit && (hit === entry || entry.contains(hit)))
        })
        return {
          w: Math.round(r.width),
          h: Math.round(r.height),
          pageW: document.documentElement.clientWidth,
          dead: dead.length,
          countRowFound: !!countRow,
          inCountRow: countRow ? countRow.contains(entry) : null,
          rowH: c ? Math.round(c.height) : null,
        }
      })
      // 入口が出入りしても件数の行の高さが動かないこと・数字が欠けないこと。
      // **品数の桁数を変えながら**測る（1桁・2桁・3桁）＝桁が増えた瞬間に折り返して
      // 行が伸びる、という直りにくい跳ね方をここで捕まえる
      const ihRowStates = [{ q: '(検索なし)', row: ihRowIdle }]
      for (const q of ['魚', '和食', 'し']) {
        await ihSearch(q)
        ihRowStates.push({ q, row: await ihCountRow() })
      }
      await ihSearch('魚')
      check(
        'IH-SEARCH-01(②) 前提: 1桁・2桁・3桁の品数をひととおり測れている',
        ihRowStates.length === 4 &&
          ihRowStates.every((state) => state.row != null) &&
          new Set(ihRowStates.map((state) => (state.row.text.match(/^\d+/) ?? [''])[0].length)).size >= 3,
        `実測=${JSON.stringify(ihRowStates)}`,
      )
      check(
        'IH-SEARCH-01(②) 入口が出ても、品数の桁が増えても、件数の行の高さが変わらない(画面が跳ねない)',
        new Set(ihRowStates.map((state) => state.row?.h)).size === 1,
        `実測=${JSON.stringify(ihRowStates.map((state) => `${state.q}=${state.row?.h}px`))}`,
      )
      check(
        'IH-SEARCH-01(②) 入口が並んでも品数の数字が「…」で欠けない',
        ihRowStates.every((state) => state.row?.clip === 0),
        `実測=${JSON.stringify(ihRowStates.map((state) => `${state.q}=${state.row?.clip}px「${state.row?.text}」`))}`,
      )
      check(
        'IH-SEARCH-01(②) 入口の大きさを測れている(読めないまま合格にしない)',
        ihEntryBox != null && ihEntryBox.w > 0 && ihEntryBox.countRowFound,
        `実測=${JSON.stringify(ihEntryBox)}`,
      )
      check(
        'IH-SEARCH-01(②) 入口は件数の行の中にある(入口のために行を増やしていない)',
        ihEntryBox?.inCountRow === true,
        `実測=${JSON.stringify(ihEntryBox)}`,
      )
      check(
        'IH-SEARCH-01(②) 入口は1行を丸ごと使わない',
        ihEntryBox != null && ihEntryBox.w < ihEntryBox.pageW / 2,
        `入口の幅=${ihEntryBox?.w}px 画面の幅=${ihEntryBox?.pageW}px`,
      )
      check(
        'IH-SEARCH-01(②) 見た目を小さくしても、押す面は44px四方を割らない',
        ihEntryBox?.dead === 0,
        `44px四方の中で押せない点=${ihEntryBox?.dead}箇所 見た目=${ihEntryBox?.w}x${ihEntryBox?.h}`,
      )
      check(
        'IH-SEARCH-01(②) 窓を開く前は一致した場所の一覧を出さない(入口の1行だけ)',
        (await ihPage.locator('[data-testid="search-match-word"]').count()) === 0,
      )
      await ihOpenDialog()
      const ihFishRows = await ihRows()
      check(
        'IH-SEARCH-01(③) 入口を押すと窓が開き、一致した場所が並ぶ',
        (await ihPage.locator('[data-testid="search-match-dialog"]').count()) === 1 &&
          ihFishRows.length > 0,
        `行=${JSON.stringify(ihFishRows.map((r) => r.text))}`,
      )
      check(
        'IH-SEARCH-01(③) 窓の行の品数を読み取れている(読めないまま合格にしない)',
        ihFishRows.every((r) => r.count != null && r.count > 0),
        `行=${JSON.stringify(ihFishRows)}`,
      )
      check(
        'IH-SEARCH-01(③) 窓の並びが品数の多い順(オーナー指定)',
        ihFishRows.every((r, i) => i === 0 || ihFishRows[i - 1].count >= r.count),
        `行=${JSON.stringify(ihFishRows.map((r) => r.text))}`,
      )
      check(
        'IH-SEARCH-01(②) 「魚」はレシピに付いているタグでも当たっていることが読める',
        ihFishRows.some((r) => r.field === ja.search.matchFieldTag),
        `行=${JSON.stringify(ihFishRows.map((r) => r.text))}`,
      )
      check(
        'IH-SEARCH-01(②) 「魚」は手順に出てくる調理器具でも当たっていることが読める',
        ihFishRows.some((r) => r.field === ja.search.matchFieldAppliance),
        `行=${JSON.stringify(ihFishRows.map((r) => r.text))}`,
      )
      await ihCloseDialog()
      check(
        'IH-SEARCH-01(③) 「閉じる」で窓が閉じる',
        (await ihPage.locator('[data-testid="search-match-dialog"]').count()) === 0,
      )

      // ---- ④ 窓の数字と、実際に画面へ出ている品数が合っている ---------------------------------
      // (a) 料理名の行: その言葉が料理名に入っているカードを**画面から数え直して**突き合わせる
      await ihSearch('豆腐')
      await ihOpenDialog()
      const ihTofuRows = await ihRows()
      const ihTofuTitleRow = ihTofuRows.find((r) => r.field === ja.search.matchFieldTitle)
      await ihCloseDialog()
      const ihTofuTitles = await ihTitles()
      check(
        'IH-SEARCH-01(④) 前提: 「豆腐」の窓に料理名の行がある',
        ihTofuTitleRow != null && ihTofuTitleRow.count != null,
        `行=${JSON.stringify(ihTofuRows.map((r) => r.text))}`,
      )
      if (ihTofuTitleRow?.count != null) {
        const named = ihTofuTitles.filter((t) => t.includes('豆腐'))
        check(
          'IH-SEARCH-01(④) 「料理名」の数字と、料理名に言葉が入っているカードの数が一致する',
          named.length === ihTofuTitleRow.count,
          `窓の数字=${ihTofuTitleRow.count} 画面で数えた品数=${named.length} 料理名=${JSON.stringify(named)}`,
        )
      }
      // (b) 一致した場所が1つだけの言葉: その数字は、いま出ている品数そのもの
      await ihSearch('和食')
      const ihWashokuTitles = await ihTitles()
      await ihOpenDialog()
      const ihWashokuRows = await ihRows()
      await ihCloseDialog()
      check(
        'IH-SEARCH-01(④) 前提: 一致した場所が1つだけになる言葉で測れている',
        ihWashokuRows.length === 1 && ihWashokuRows[0].count != null,
        `行=${JSON.stringify(ihWashokuRows.map((r) => r.text))}`,
      )
      if (ihWashokuRows.length === 1) {
        check(
          'IH-SEARCH-01(④) 一致した場所が1つだけなら、その数字は画面に出ている品数と同じ',
          ihWashokuRows[0].count === ihWashokuTitles.length,
          `窓の数字=${ihWashokuRows[0].count} 画面のカード=${ihWashokuTitles.length}枚`,
        )
      }

      // ---- ⑤ 上限を超えたら「ほか◯件」で数を出す（オーナー「上限は必須」） --------------------
      // 1文字だけ打つと一致した場所がいちばん増える。上限の数は画面から読み取り、書き写さない
      await ihSearch('ん')
      const ihWideEntry = ihClean(await ihPage.textContent('[data-testid="search-match-open"]'))
      await ihOpenDialog()
      const ihWideRows = await ihRows()
      const ihMoreText = ihClean(
        await ihPage.textContent('[data-testid="search-match-more"]').catch(() => ''),
      )
      const ihMoreCount = Number((ihMoreText.match(/(\d+)/) ?? [])[1])
      check(
        'IH-SEARCH-01(⑤) 前提: 一致した場所が上限を超える言葉で測れている',
        ihWideRows.length > 0 && ihMoreText !== '',
        `行=${ihWideRows.length}件 ほか=${ihMoreText}`,
      )
      check(
        'IH-SEARCH-01(⑤) 上限を超えた分は「ほか◯件」で数が出る(黙って切らない)',
        Number.isFinite(ihMoreCount) && ihMoreCount > 0,
        `ほか=${ihMoreText}`,
      )
      check(
        'IH-SEARCH-01(⑤) 入口は言葉の当たり方で姿を変えない(いつも同じ1つの押しどころ)',
        ihWideEntry === ja.search.matchEntry,
        `入口=${ihWideEntry} 期待=${ja.search.matchEntry}`,
      )
      await ihCloseDialog()
      // 上限は当たった数で変わらない（別の当たりの広い言葉でも、並ぶ行数は同じ）
      await ihSearch('い')
      await ihOpenDialog()
      const ihWideRows2 = await ihRows()
      const ihMore2 = ihClean(
        await ihPage.textContent('[data-testid="search-match-more"]').catch(() => ''),
      )
      check(
        'IH-SEARCH-01(⑤) 上限は当たった数で変わらない(別の広い言葉でも並ぶ行数は同じ)',
        ihWideRows2.length === ihWideRows.length && ihMore2 !== '',
        `「ん」=${ihWideRows.length}行 「い」=${ihWideRows2.length}行 ほか=${ihMore2}`,
      )
      await ihCloseDialog()

      // ---- 狭い画面でも件数の行が跳ねないか ------------------------------------------------------
      // 390pxでは余白があって折り返さないので、**いちばん余白の薄い幅**でもう一度だけ測る。
      // 360pxはAndroidの小さめの端末で実際にある幅で、ここが通れば375px（実機の基準）も通る
      {
        const ihNarrow = await ihContext.newPage()
        try {
          await ihNarrow.setViewportSize({ width: 360, height: 844 })
          await ihNarrow.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await ihNarrow.waitForTimeout(1800)
          const readRow = () =>
            ihNarrow.evaluate(() => {
              const label = document.querySelector('[data-testid="free-limit-count"]')
              const p = label?.parentElement
              const row = p?.parentElement
              if (!p || !row) return null
              return {
                h: Math.round(row.getBoundingClientRect().height),
                clip: Math.max(0, p.scrollWidth - p.clientWidth),
                text: (p.textContent ?? '').replace(/\s+/g, ' ').trim(),
              }
            })
          const states = [{ q: '(検索なし)', row: await readRow() }]
          for (const q of ['魚', '和食', 'し']) {
            await ihNarrow.locator('input[type="search"]').fill(q)
            await ihNarrow.waitForTimeout(900)
            states.push({ q, row: await readRow() })
          }
          check(
            'IH-SEARCH-01(②) 前提: 狭い画面(360px)でも件数の行を測れている',
            states.every((state) => state.row != null && state.row.h > 0),
            `実測=${JSON.stringify(states)}`,
          )
          check(
            'IH-SEARCH-01(②) 狭い画面(360px)でも件数の行の高さが変わらない',
            new Set(states.map((state) => state.row?.h)).size === 1,
            `実測=${JSON.stringify(states.map((state) => `${state.q}=${state.row?.h}px`))}`,
          )
          check(
            'IH-SEARCH-01(②) 狭い画面(360px)でも品数の数字が欠けない(縮むのは入口の文字の側)',
            states.every((state) => state.row?.clip === 0),
            `実測=${JSON.stringify(states.map((state) => `${state.q}=${state.row?.clip}px「${state.row?.text}」`))}`,
          )
        } finally {
          await ihNarrow.close()
        }
      }

      // ---- 検索をやめたら入口も消える -----------------------------------------------------------
      await ihSearch('')
      const ihAfter = await ihTitles()
      check(
        'IH-SEARCH-01(②) 検索をやめると一致した場所の入口が消える',
        ihAfter.length > 0 &&
          (await ihPage.locator('[data-testid="search-match-open"]').count()) === 0,
        `カード=${ihAfter.length}枚`,
      )
    } finally {
      await ihBrowser.close()
    }
  }

  // --- IB-TAG-01: 絞り込みの「タグ」は1つの並びで、数字の意味もそろっている（2026-08-19 便IB・②
  //     オーナー実機フィードバック「絞り込みタグは、実質キーワード検索？説明に『タグが付いている
  //     レシピの品数』とあるので、表現を揃えたい。やりたいことは『好きなキーワードをよく使うタグとして
  //     絞り込みに登録したい』」）。
  //
  //     直す前は、同じ「タグ」の欄に性質の違う2つが別々に並んでいた
  //     （もとからあるタグ＝レシピに付いている印・数字あり／自分で登録したタグ＝保存した検索の言葉・数字なし）。
  //     【この検査で測ること】
  //      ①チップに出ている数字と、そのチップだけで絞り込んだときに実際に出る品数が一致すること
  //        （もとからあるタグ・登録したタグの両方で。数字と結果が食い違うと説明文が嘘になる）
  //      ②登録したタグも、もとからあるタグと同じ選び方（スイッチ）に乗ること
  //      ③欄が2つに分かれていない（「自分で登録したタグ」という別見出しが無い）
  //     数字が読み取れなかったときは必ず落ちる（読めないまま合格にしない）---
  currentCheck = 'IB-TAG-01'
  {
    const ibBrowser = await chromium.launch()
    const ibContext = await ibBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ibPage = await ibContext.newPage()
    ibPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@IB-TAG-01] ${err.message}`)
    })
    try {
      const ibIds = () =>
        ibPage.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => /^#\/recipes\/\d+$/.test(href)),
        )
      // チップは名前で押す（画面の中の何番目か・入れ子の段数には頼らない）
      const ibClickChip = (testid, label) =>
        ibPage.evaluate(
          ({ testid, label }) => {
            const btn = Array.from(document.querySelectorAll(`[data-testid="${testid}"]`)).find(
              (b) => (b.textContent ?? '').replace(/​/g, '').trim().split(' ')[0] === label,
            )
            if (!btn) return false
            btn.click()
            return true
          },
          { testid, label },
        )
      // チップの「名前」と「数字」を読む。数字が付いていなければ null（読めないまま合格にしない）
      const ibChips = (testid) =>
        ibPage.evaluate(
          (testid) =>
            Array.from(document.querySelectorAll(`[data-testid="${testid}"]`))
              .map((b) => (b.textContent ?? '').replace(/​/g, '').trim())
              .filter((text) => text !== '' && text.split(' ')[0] !== 'すべて')
              .map((text) => {
                const m = text.match(/(\d+)\s*$/)
                return { name: text.split(' ')[0], count: m ? Number(m[1]) : null }
              }),
          testid,
        )
      const ibClearTags = () => ibClickChip('recipes-tag-chip', 'すべて')
      const ibSwitch = ibPage.locator('[data-testid="recipes-tag-match"]')
      const ibSwitchOn = async () => (await ibSwitch.first().getAttribute('aria-checked')) === 'true'
      const ibSetSwitch = async (on) => {
        if ((await ibSwitch.count()) !== 1) return false
        if ((await ibSwitchOn()) === on) return true
        await ibSwitch.first().click()
        await ibPage.waitForTimeout(400)
        return (await ibSwitchOn()) === on
      }
      const ibOpenFilter = async () => {
        await ibPage.locator('button[aria-label="絞り込み"]').click()
        await ibPage.waitForTimeout(500)
      }
      await ibPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ibPage.waitForTimeout(2000)
      const ibTotal = (await ibIds()).length
      check('IB-TAG-01 前提: 一覧にレシピが出ている', ibTotal > 0, `全件=${ibTotal}`)

      // 好きな言葉を「よく使うタグ」として登録する
      await ibPage.locator('input[type="search"]').fill('豆腐')
      await ibPage.waitForTimeout(900)
      const ibSearchHits = await ibIds()
      check(
        'IB-TAG-01 前提: 登録する言葉の検索結果が0品でも全品でもない',
        ibSearchHits.length > 0 && ibSearchHits.length < ibTotal,
        `検索結果=${ibSearchHits.length} 全件=${ibTotal}`,
      )
      await ibPage.locator('[data-testid="saved-search-add"]').click()
      await ibPage.waitForTimeout(900)
      await ibPage.locator('input[type="search"]').fill('')
      await ibPage.waitForTimeout(700)

      await ibOpenFilter()
      const ibSavedChips = await ibChips('recipes-saved-search-chip')
      const ibTagChips = await ibChips('recipes-tag-chip')
      check(
        'IB-TAG-01(②) 登録したタグが絞り込みのタグに1つ並んでいる',
        ibSavedChips.length === 1 && ibSavedChips[0].name === '豆腐',
        `登録したタグ=${JSON.stringify(ibSavedChips)}`,
      )
      check(
        'IB-TAG-01(②) 前提: もとからあるタグも2つ以上読み取れている',
        ibTagChips.length >= 2,
        `タグ=${JSON.stringify(ibTagChips)}`,
      )
      check(
        'IB-TAG-01(②) 登録したタグにも数字が出ている(もとからあるタグと同じ形)',
        ibSavedChips.length === 1 && ibSavedChips[0].count != null && ibSavedChips[0].count > 0,
        `登録したタグ=${JSON.stringify(ibSavedChips)}`,
      )
      check(
        'IB-TAG-01(②) 欄が2つに分かれていない(「自分で登録したタグ」の別見出しが無い)',
        !(await ibPage.textContent('body')).replace(/​/g, '').includes('自分で登録したタグ'),
      )
      check(
        'IB-TAG-01(②) 数字の意味の説明が1本になっている',
        // 文言は ja.ts から読む（画面の字を書き写すと、呼び名を変えたときに片方だけ古くなる。
        // 2026-08-20 便IH・①で「タグ」→「キーワード」に改名した際、ここが実際に取り残された）
        (await ibPage.textContent('body')).replace(/​/g, '').includes(ja.search.tagCountHint),
      )

      // 増えた押しどころ（選び方のスイッチ・登録したタグの削除）が指で押せる大きさであること。
      // クラス名ではなく**実際の当たり判定**で測る（TAP-44と同じ方法。中心から上下左右21pxの点を
      // 突いて、何も起きない場所が無いことを見る）。測れなかったら落ちる
      const ibTapProbe = await ibPage.evaluate(() => {
        const out = []
        for (const sel of [
          '[data-testid="recipes-tag-match"]',
          '[data-testid="recipes-saved-search-remove"]',
        ]) {
          const el = document.querySelector(sel)
          if (!el) {
            out.push({ sel, found: false })
            continue
          }
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          const d = 21
          const dead = [
            [cx - d, cy],
            [cx + d, cy],
            [cx, cy - d],
            [cx, cy + d],
          ].filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            if (hit && (hit === el || el.contains(hit))) return false
            return !(hit && hit.closest('button, a[href], [role="button"], input, select, textarea, label'))
          })
          out.push({ sel, found: true, box: `${Math.round(r.width)}x${Math.round(r.height)}`, dead: dead.length })
        }
        return out
      })
      check(
        'IB-TAG-01 増えた押しどころ(スイッチ・削除)に、44px四方の中で押せない場所が無い',
        ibTapProbe.length === 2 &&
          ibTapProbe.every((probe) => probe.found && probe.dead === 0),
        `実測=${JSON.stringify(ibTapProbe)}`,
      )

      // ① 画面の数字と、実際に出る品数が一致する（登録したタグ・もとからあるタグの両方）
      const ibTargets = [
        ...ibSavedChips.slice(0, 1).map((c) => ({ ...c, testid: 'recipes-saved-search-chip' })),
        ...ibTagChips.slice(0, 2).map((c) => ({ ...c, testid: 'recipes-tag-chip' })),
      ]
      check(
        'IB-TAG-01(①) 前提: 数字を確かめる相手を3つ拾えている',
        ibTargets.length === 3 && ibTargets.every((t) => t.count != null),
        `相手=${JSON.stringify(ibTargets)}`,
      )
      await ibSetSwitch(false)
      for (const target of ibTargets) {
        await ibClearTags()
        await ibPage.waitForTimeout(300)
        const pressed = await ibClickChip(target.testid, target.name)
        await ibPage.waitForTimeout(600)
        const shown = (await ibIds()).length
        check(
          `IB-TAG-01(①) 「${target.name}」: 画面の数字と実際に出る品数が一致する`,
          pressed && target.count != null && shown === target.count,
          `押せた=${pressed} 画面の数字=${target.count} 実際に出た品数=${shown} 全件=${ibTotal}`,
        )
        check(
          `IB-TAG-01(①) 前提: 「${target.name}」で絞ると0品でも全件でもない`,
          shown > 0 && shown < ibTotal,
          `実際に出た品数=${shown} 全件=${ibTotal}`,
        )
      }

      // ② 登録したタグも、もとからあるタグと同じ選び方（スイッチ）に乗る。
      //    重なりのある相手を画面から探す（重なりが無いとONが必ず0品になり、比べる中身が無い）
      let ibPairTag = null
      let ibOr = null
      let ibAnd = null
      for (const tag of ibTagChips) {
        await ibSetSwitch(false)
        await ibClearTags()
        await ibPage.waitForTimeout(250)
        if (!(await ibClickChip('recipes-saved-search-chip', '豆腐'))) continue
        await ibPage.waitForTimeout(350)
        if (!(await ibClickChip('recipes-tag-chip', tag.name))) continue
        await ibPage.waitForTimeout(400)
        const union = await ibIds()
        if (!(await ibSetSwitch(true))) continue
        await ibPage.waitForTimeout(450)
        const both = await ibIds()
        if (both.length > 0 && both.length < union.length) {
          ibPairTag = tag.name
          ibOr = union
          ibAnd = both
          break
        }
      }
      check(
        'IB-TAG-01(②) 前提: 登録したタグと重なるタグを画面から見つけられた',
        ibPairTag != null,
        `もとからあるタグ=${JSON.stringify(ibTagChips.map((c) => c.name))}`,
      )
      if (ibPairTag != null) {
        check(
          'IB-TAG-01(②) 登録したタグを混ぜてもスイッチONで結果が絞り込まれる',
          ibAnd.length < ibOr.length,
          `ON=${ibAnd.length} OFF=${ibOr.length} 組=豆腐+${ibPairTag}`,
        )
        check(
          'IB-TAG-01(②) 登録したタグを混ぜてもONの結果はOFFの結果に必ず含まれる',
          ibAnd.every((id) => ibOr.includes(id)),
          `ON=${JSON.stringify(ibAnd)} OFF=${JSON.stringify(ibOr)}`,
        )
      }

      // 後片付け（登録したタグを消して、次の検査に持ち越さない）
      await ibSetSwitch(false)
      await ibClearTags()
      await ibPage.waitForTimeout(300)
      const ibRemove = ibPage.locator('[data-testid="recipes-saved-search-remove"]')
      if ((await ibRemove.count()) > 0) {
        await ibRemove.first().click()
        await ibPage.waitForTimeout(900)
      }
      await ibPage.locator('[data-testid="filter-panel-close"]').click()
      await ibPage.waitForTimeout(400)

      // 1つの並びにまとめた以上、同じ名前のチップが2つ並ばないこと（押す場所によって
      // 当たる品が変わる、という状態を作らない）。もとからあるタグと同じ言葉で検索したときは
      // 登録ボタンを出さない。空振りしていないことを、出るはずの言葉で先に確かめる
      await ibPage.locator('input[type="search"]').fill('豆腐')
      await ibPage.waitForTimeout(800)
      check(
        'IB-TAG-01(②) 前提: まだ並んでいない言葉では登録ボタンが出る(見張りの空振り防止)',
        (await ibPage.locator('[data-testid="saved-search-add"]').count()) === 1,
      )
      await ibPage.locator('input[type="search"]').fill(ibTagChips[0].name)
      await ibPage.waitForTimeout(800)
      check(
        `IB-TAG-01(②) もとからあるタグと同じ言葉「${ibTagChips[0].name}」では登録ボタンを出さない(同じ名前のチップを2つ作らない)`,
        (await ibPage.locator('[data-testid="saved-search-add"]').count()) === 0,
      )
      await ibPage.locator('input[type="search"]').fill('')
      await ibPage.waitForTimeout(500)
    } finally {
      await ibBrowser.close()
    }
  }

  // --- HZ-TAG-02: タグを2つ以上選んだときの選び方（2026-08-19 便HZ・③ → 便IB・①でスイッチ1つに）
  //     オーナー実機フィードバック「絞り込みタグ複数選択のANDとORの切り替えは、
  //     『すべてのタグを含む』とON/OFFスイッチの方がわかりやすいかも」。
  //     2つのチップ（どれかが付いている／すべて付いている）を、ON/OFFスイッチ1つに変えた。
  //
  //     件数の決め打ちはせず、**スイッチを入れると結果が絞り込まれ、入れないときの結果に
  //     必ず含まれる**ことを、画面から読み取ったレシピの並びで見る。
  //     タグの顔ぶれは画面から拾い、重なりのある組をその場で探す
  //     （重なりの無い組ではONが必ず0品になり、比べる中身が無くなるため）---
  currentCheck = 'HZ-TAG-02'
  {
    const tmBrowser = await chromium.launch()
    const tmContext = await tmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const tmPage = await tmContext.newPage()
    tmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@HZ-TAG-02] ${err.message}`)
    })
    try {
      const tmIds = () =>
        tmPage.evaluate(() =>
          Array.from(document.querySelectorAll('a[href]'))
            .map((a) => a.getAttribute('href') ?? '')
            .filter((href) => /^#\/recipes\/\d+$/.test(href)),
        )
      // チップは名前で押す（画面の中の何番目か、には頼らない）。押せなかったら false が返る
      const tmClickChip = (testid, label) =>
        tmPage.evaluate(
          ({ testid, label }) => {
            const btn = Array.from(document.querySelectorAll(`[data-testid="${testid}"]`)).find(
              (b) => (b.textContent ?? '').replace(/​/g, '').trim().split(' ')[0] === label,
            )
            if (!btn) return false
            btn.click()
            return true
          },
          { testid, label },
        )
      const tmClearTags = () => tmClickChip('recipes-tag-chip', 'すべて')
      // 選び方のスイッチ。入り切りは aria-checked で読む（見た目の色ではなく状態で見る）
      const tmSwitch = tmPage.locator('[data-testid="recipes-tag-match"]')
      const tmSwitchOn = async () => (await tmSwitch.first().getAttribute('aria-checked')) === 'true'
      const tmSetSwitch = async (on) => {
        if ((await tmSwitchOn()) === on) return true
        await tmSwitch.first().click()
        await tmPage.waitForTimeout(400)
        return (await tmSwitchOn()) === on
      }
      await tmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tmPage.waitForTimeout(2000)
      const tmTotal = (await tmIds()).length
      check('HZ-TAG-02 前提: 一覧にレシピが出ている', tmTotal > 0, `全件=${tmTotal}`)
      await tmPage.locator('button[aria-label="絞り込み"]').click()
      await tmPage.waitForTimeout(400)

      // タグの名前を画面から拾う（「すべて」は絞り込みを外すチップなので除く）
      const tmTagNames = await tmPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipes-tag-chip"]'))
          .map((b) => (b.textContent ?? '').replace(/​/g, '').trim().split(' ')[0])
          .filter((name) => name !== 'すべて' && name !== ''),
      )
      check(
        'HZ-TAG-02 前提: タグの候補が2つ以上ある',
        tmTagNames.length >= 2,
        `タグ=${JSON.stringify(tmTagNames)}`,
      )
      // 選び方は「ON/OFFのスイッチ1つ」（便IB・① オーナー案）。2つのチップには戻っていない
      const tmSwitchCount = await tmSwitch.count()
      const tmSwitchRole = tmSwitchCount > 0 ? await tmSwitch.first().getAttribute('role') : null
      check(
        'HZ-TAG-02(①) 選び方がON/OFFスイッチ1つになっている',
        tmSwitchCount === 1 && tmSwitchRole === 'switch',
        `数=${tmSwitchCount} role=${tmSwitchRole}`,
      )
      const tmSwitchLabel =
        tmSwitchCount > 0 ? ((await tmSwitch.first().getAttribute('aria-label')) ?? '') : ''
      check(
        'HZ-TAG-02(①) スイッチの名前を読み取れている',
        tmSwitchLabel.trim().length > 0,
        `名前=${JSON.stringify(tmSwitchLabel)}`,
      )
      check(
        'HZ-TAG-02(①) スイッチの名前に「AND」「OR」をそのまま出していない(規約H)',
        !/AND|OR/i.test(tmSwitchLabel),
        `名前=${tmSwitchLabel}`,
      )
      check(
        'HZ-TAG-02(①) スイッチの名前が画面にも文字で出ている(印だけにしない)',
        tmSwitchLabel.trim().length > 0 &&
          (await tmPage.textContent('body')).replace(/​/g, '').includes(tmSwitchLabel),
        `名前=${tmSwitchLabel}`,
      )
      check(
        'HZ-TAG-02(①) 既定はOFF(選んだタグのどれかが当たれば残る)',
        tmSwitchCount === 1 && (await tmSwitchOn()) === false,
        `入り切り=${tmSwitchCount === 1 ? await tmSwitch.first().getAttribute('aria-checked') : 'スイッチが無い'}`,
      )

      // 重なりのある2つを探す（見つからなければ「測れなかった」として落ちる）
      let tmPair = null
      let tmA = null
      let tmB = null
      let tmAnd = null
      let tmOr = null
      for (let i = 0; i < tmTagNames.length && tmPair == null; i++) {
        for (let j = i + 1; j < Math.min(tmTagNames.length, i + 4) && tmPair == null; j++) {
          await tmSetSwitch(false)
          await tmClearTags()
          await tmPage.waitForTimeout(250)
          if (!(await tmClickChip('recipes-tag-chip', tmTagNames[i]))) continue
          await tmPage.waitForTimeout(350)
          const first = await tmIds()
          if (!(await tmClickChip('recipes-tag-chip', tmTagNames[j]))) continue
          await tmPage.waitForTimeout(350)
          const union = await tmIds()
          if (!(await tmSetSwitch(true))) continue
          await tmPage.waitForTimeout(400)
          const both = await tmIds()
          if (both.length > 0) {
            tmPair = [tmTagNames[i], tmTagNames[j]]
            tmA = first
            tmOr = union
            tmAnd = both
          }
        }
      }
      check(
        'HZ-TAG-02 前提: 重なりのある2つのタグを画面から見つけられた',
        tmPair != null && tmA != null && tmA.length > 0 && tmAnd != null && tmAnd.length > 0,
        `タグ=${JSON.stringify(tmTagNames)} 見つかった組=${JSON.stringify(tmPair)}`,
      )
      if (tmPair != null) {
        check(
          'HZ-TAG-02(①) スイッチを入れると結果が絞り込まれる',
          tmAnd.length < tmOr.length,
          `${JSON.stringify(tmPair)} ON=${tmAnd.length} OFF=${tmOr.length}`,
        )
        check(
          'HZ-TAG-02(①) スイッチを入れた結果は、入れないときの結果に必ず含まれる',
          tmAnd.every((id) => tmOr.includes(id)),
          `ON=${JSON.stringify(tmAnd)} OFF=${JSON.stringify(tmOr)}`,
        )
        // もう片方だけを選んだときの品数（和集合の数え合わせに使う）
        await tmSetSwitch(false)
        await tmClearTags()
        await tmPage.waitForTimeout(250)
        await tmClickChip('recipes-tag-chip', tmPair[1])
        await tmPage.waitForTimeout(400)
        tmB = await tmIds()
        check(
          'HZ-TAG-02 前提: それぞれ1つだけ選んだときも0件でも全件でもない',
          tmA.length > 0 && tmA.length < tmTotal && tmB.length > 0 && tmB.length < tmTotal,
          `${tmPair[0]}=${tmA.length} ${tmPair[1]}=${tmB.length} 全件=${tmTotal}`,
        )
        // 1つしか選んでいないときはスイッチを入れても結果が変わらない
        // （だからスイッチは出したままでよい＝押しても間違った結果にはならない。便IB・①の判断）
        const tmOneOff = await tmIds()
        await tmSetSwitch(true)
        await tmPage.waitForTimeout(400)
        const tmOneOn = await tmIds()
        check(
          'HZ-TAG-02(①) タグが1つだけのときはスイッチを入れても結果が変わらない',
          JSON.stringify(tmOneOn) === JSON.stringify(tmOneOff) && tmOneOff.length > 0,
          `ON=${tmOneOn.length}品 OFF=${tmOneOff.length}品`,
        )
        await tmSetSwitch(false)
        await tmPage.waitForTimeout(300)
        check(
          'HZ-TAG-02 数え合わせが合う(OFF = 片方 + もう片方 - ON)',
          tmOr.length === tmA.length + tmB.length - tmAnd.length,
          `OFF=${tmOr.length} ${tmPair[0]}=${tmA.length} ${tmPair[1]}=${tmB.length} ON=${tmAnd.length}`,
        )
        check(
          'HZ-TAG-02 OFFのときは1つだけ選んだときより増える(和集合)',
          tmOr.length > tmA.length && tmOr.length > tmB.length && tmOr.length <= tmTotal,
          `OFF=${tmOr.length} ${tmPair[0]}=${tmA.length} ${tmPair[1]}=${tmB.length} 全件=${tmTotal}`,
        )
        // チップの数字（そのタグだけで絞り込んだときの品数）は、スイッチでも他の選択でも変わらない
        await tmClearTags()
        await tmPage.waitForTimeout(250)
        await tmClickChip('recipes-tag-chip', tmPair[0])
        await tmPage.waitForTimeout(300)
        await tmClickChip('recipes-tag-chip', tmPair[1])
        await tmPage.waitForTimeout(300)
        await tmSetSwitch(true)
        await tmPage.waitForTimeout(400)
        const tmChipCount = await tmPage.evaluate((name) => {
          const btn = Array.from(document.querySelectorAll('[data-testid="recipes-tag-chip"]')).find(
            (b) => (b.textContent ?? '').replace(/​/g, '').trim().split(' ')[0] === name,
          )
          const text = (btn?.textContent ?? '').replace(/​/g, '').trim()
          const m = text.match(/(\d+)\s*$/)
          return m ? Number(m[1]) : null
        }, tmPair[0])
        check(
          'HZ-TAG-02 チップの数字は「そのタグだけで絞り込んだときの品数」のまま(2つ選んでもスイッチを入れても動かない)',
          tmChipCount != null && tmChipCount === tmA.length,
          `チップの数字=${tmChipCount} ${tmPair[0]}だけを選んだときの品数=${tmA.length}`,
        )
        check(
          'HZ-TAG-02 数字が何を指すのかが画面に書いてある',
          // 文言は ja.ts から読む（便IH・①の改名で書き写しが取り残されたため）
          (await tmPage.textContent('body')).replace(/​/g, '').includes(ja.search.tagCountHint),
        )
        // 「すべて」で外せる＝絞り込みを戻す手段がある
        await tmSetSwitch(false)
        await tmClearTags()
        await tmPage.waitForTimeout(500)
        check(
          'HZ-TAG-02 「すべて」で選んだタグをまとめて外せる',
          (await tmIds()).length === tmTotal,
          `外した後=${(await tmIds()).length} 全件=${tmTotal}`,
        )
      }
    } finally {
      await tmBrowser.close()
    }
  }
