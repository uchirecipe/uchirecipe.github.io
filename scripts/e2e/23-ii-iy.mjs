// ==========================================================================================
// e2e の節: 便II〜IY（折りたたみ・週の編集モード・ジャンル）
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
// この中の節: FOLDRUN-01, NGWORD-01, BKFACT-01, IUORG-02, IUSELECT-03, IUSCROLL-04, IUUNDO-06, IUTODAY-07, IVFOLD-01, IVCARD-02, IVEDIT-03, IVLOCK-04, IYGENRE-01
// ==========================================================================================
import './_shared.mjs'


  // --- FOLDRUN-01: 折りたたみを開かなくても、決めてもらう操作に手が届く（2026-08-20 便II・③）。
  // オーナー原文「折りたたんだ状態で「まとめて献立を入力」ボタンほしい。アプリ全体で、
  // 折りたたみを一切開かなくても、最低限一通りすべての機能を触れる（使いこなすために開く）
  // ようにしたい。」
  // 便DT-5/6で一度この形（畳んでも押せる）になっていたのを、便IFが「日タブにそろえる」ために
  // 取り下げた。そろえる先を「日も週も畳んだまま押せる」に直したので、**日・週の両方**を見る。
  // 見張るのは ①畳んだ状態でも実行ボタンが画面に出ている ②指で押せる大きさ（44px以上）
  // ③押すと実際に効く（週＝端末の献立の行が増える／日＝候補が画面に出る）。
  // 掴み方は data-testid と端末のデータの変化だけ＝並び・入れ子の段数に依らない（禁じ手④）。
  // 「畳む前にボタンがあった」「畳めた」を先に測ってから本題に入る
  // ＝ボタンが見つからないだけで合格に倒れない（禁じ手「見つからなかった＝合格」対策） ---
  currentCheck = 'FOLDRUN-01'
  {
    const frBrowser = await chromium.launch()
    const frContext = await frBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const frPage = await frContext.newPage()
    frPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FOLDRUN-01] ${err.message}`)
    })
    /** 端末に入っている献立の行数（週の「まとめて献立を入力」が効いたかを実データで見る） */
    const frPlanCount = () =>
      frPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const g = req.result.transaction('mealPlans', 'readonly').objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      // 今日の献立を1品決める＝日タブの「今日なに作る？」が畳める日の形になる
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(1800) // 初回シード完了待ち
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      await frPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await frPage.waitForTimeout(300)
      await frPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
      await frPage.waitForTimeout(600)

      // ---------- 日タブ: 「今日なに作る？」を畳んだまま ----------
      await frPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(1500)
      const frDayToggle = frPage.locator('[data-testid="day-suggest-toggle"]')
      const frDayDraw = frPage.locator('[data-testid="day-suggest-draw"]')
      check(
        'FOLDRUN-01 前提: 献立が決まっている日は「今日なに作る？」が畳めて、畳んだ状態から始まる',
        (await frDayToggle.count()) === 1 &&
          (await frDayToggle.getAttribute('aria-expanded')) === 'false',
        `畳みボタン=${await frDayToggle.count()} aria-expanded=${await frDayToggle.getAttribute('aria-expanded')}`,
      )
      const frDayBox = (await frDayDraw.count()) === 1 ? await frDayDraw.boundingBox() : null
      check(
        'FOLDRUN-01(日) 畳んだままでも「決めてもらう」ボタンが画面に出ている',
        (await frDayDraw.count()) === 1 && (await frDayDraw.isVisible()),
        `ボタン=${await frDayDraw.count()}`,
      )
      check(
        'FOLDRUN-01(日) 畳んだままの「決めてもらう」ボタンが指で押せる大きさ(44px以上)',
        !!frDayBox && frDayBox.height >= 44,
        `高さ=${frDayBox?.height}`,
      )
      if ((await frDayDraw.count()) === 1) {
        await frDayDraw.click()
        await frPage.waitForTimeout(1200)
      }
      const frPair = frPage.locator('[data-testid="day-suggest-pair"]')
      const frOne = frPage.locator('[data-testid="day-suggest-result"]')
      check(
        'FOLDRUN-01(日) 畳んだまま押しても実際に効く(候補が画面に出る)',
        (await frPair.count()) + (await frOne.count()) > 0,
        `献立=${await frPair.count()} 1品=${await frOne.count()}`,
      )
      check(
        'FOLDRUN-01(日) 押した結果は折りたたみの中に出るので、押した時点で節が開く',
        (await frDayToggle.getAttribute('aria-expanded')) === 'true',
        `aria-expanded=${await frDayToggle.getAttribute('aria-expanded')}`,
      )

      // ---------- 週タブ: 「献立を提案」を畳んだまま ----------
      await frPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await frPage.waitForTimeout(1000)
      const frFill = frPage.locator('[data-testid="week-fill-run"]')
      check(
        'FOLDRUN-01 前提: 畳む前は「まとめて献立を入力」が出ている',
        (await frFill.count()) === 1,
        `ボタン=${await frFill.count()}`,
      )
      // 2026-08-22 便IV: 「献立を提案」は既定で畳んである（オーナー原文「でふぉるとで設定３種は、
      // 折りたたんだ表示にして」）。開いていたら畳んでから測る＝既定がどちらでも同じ土台に着く
      const frClose = frPage.getByRole('button', { name: '献立を提案を閉じる' })
      const frOpenBtn = frPage.getByRole('button', { name: '献立を提案を開く' })
      check(
        'FOLDRUN-01 前提: 「献立を提案」の開け閉めボタンを掴めた',
        (await frClose.count()) + (await frOpenBtn.count()) === 1,
        `閉じる=${await frClose.count()} 開く=${await frOpenBtn.count()}`,
      )
      if ((await frClose.count()) === 1) {
        await frClose.click()
        await frPage.waitForTimeout(600)
      }
      check(
        'FOLDRUN-01 前提: 畳んだ状態になっている',
        (await frPage.getByRole('button', { name: '献立を提案を開く' }).count()) === 1,
      )
      const frFillBox = (await frFill.count()) === 1 ? await frFill.boundingBox() : null
      check(
        'FOLDRUN-01(週) 畳んだままでも「まとめて献立を入力」が画面に出ている',
        (await frFill.count()) === 1 && (await frFill.isVisible()),
        `ボタン=${await frFill.count()}`,
      )
      check(
        'FOLDRUN-01(週) 畳んだままの「まとめて献立を入力」が指で押せる大きさ(44px以上)',
        !!frFillBox && frFillBox.height >= 44,
        `高さ=${frFillBox?.height}`,
      )
      const frBefore = await frPlanCount()
      if ((await frFill.count()) === 1) {
        await frFill.click()
        await frPage.waitForTimeout(1600)
      }
      const frAfter = await frPlanCount()
      check(
        'FOLDRUN-01(週) 畳んだまま押しても実際に効く(端末の献立の行が増える)',
        Number.isInteger(frBefore) && Number.isInteger(frAfter) && frAfter > frBefore,
        `押す前=${frBefore} 押した後=${frAfter}`,
      )
      check(
        'FOLDRUN-01(週) 押しても勝手には開かない(結果は下の曜日カードに出るので開く必要が無い)',
        // 実行ボタンが消えていないことも一緒に見る＝「ボタンが無いから畳んだまま」で合格に倒れない
        (await frPage.getByRole('button', { name: '献立を提案を開く' }).count()) === 1 &&
          (await frFill.count()) === 1,
        `畳んだまま=${await frPage.getByRole('button', { name: '献立を提案を開く' }).count()} ボタン=${await frFill.count()}`,
      )
    } finally {
      await frBrowser.close()
    }
  }


  // --- 便IJ・②③(2026-08-20 オーナー承認済み) ---------------------------------------------
  //
  // ② NGWORD-01: NG食材の印の隣に短い言葉が出ている
  //    オーナー原文「レシピから追加のNG食材について、マークだけあっても意味がわからない。
  //    NG食材あり、など超短く説明欲しい。」
  //    印は5か所以上のカードに出る。**言葉を出す密度と出さない密度**を実DOMで測る:
  //      ・大／標準 … 印＋言葉（横幅に余裕がある）
  //      ・小 …… 印だけ。週の枠は実測169pxしかなく、言葉（実測92px）を足すと料理名が消える
  //    禁じ手よけ: 掴み方は data-testid（並びの何番目・入れ子の段数に依らない）。
  //    文言は ja から読む（書き写さない）。**1つも拾えなかったときはその場で不合格**にする。
  //
  // ③ BKFACT-01: 知らないと事故になる情報が、アプリ側の画面から消えていない
  //    オーナー原文「バックアップまわりの説明が、文字ばかりで読みにくい。（略）詳しくは説明ページに
  //    案内すればOK。」＝**説明ページへ送ってよい情報と、送ってはいけない情報**がある。
  //    ここでは後者だけを、ja の文言そのものが画面に出ているかで測る。
  currentCheck = 'NGWORD-01'
  {
    const ngBrowser = await chromium.launch()
    const ngCtx = await ngBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ngPage = await ngCtx.newPage()
    ngPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NGWORD-01] ${err.message}`)
    })
    const ngClean = (t) => (t ?? '').replaceAll('​', '').trim()
    /** 目印で掴んだ要素の中身（並びの何番目かには依らない） */
    const ngTexts = (sel) =>
      ngPage.evaluate(
        (s) =>
          Array.from(document.querySelectorAll(s)).map((el) =>
            (el.textContent ?? '').replaceAll('​', '').trim(),
          ),
        sel,
      )
    try {
      await ngPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(2400) // 初回シード完了待ち

      // 前提①: 週の枠（密度「小」）に品を入れる。UIから入れる（献立の作りに手を入れない）
      await ngPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(1800)
      await ngPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await ngPage.waitForTimeout(1000)
      const ngFill = ngPage.locator('[data-testid="week-fill-run"]')
      if ((await ngFill.count()) === 1) {
        await ngFill.click()
        await ngPage.waitForTimeout(2400)
      }

      // 前提②: 端末にあるレシピでいちばん多く使われている材料をNG食材に入れる
      //（どの品が献立に入っても必ず印が付く状態を作る。品名を決め打ちしない）
      const ngWordIngredient = await ngPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const counts = new Map()
                for (const r of g.result)
                  for (const i of r.ingredients ?? [])
                    if (i?.name) counts.set(i.name, (counts.get(i.name) ?? 0) + 1)
                const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
                if (!top) {
                  resolve(null)
                  return
                }
                const st = idb.transaction('settings', 'readwrite').objectStore('settings')
                const sg = st.get(1)
                sg.onsuccess = () => {
                  const put = st.put({ ...(sg.result ?? { id: 1 }), id: 1, ngIngredients: [top[0]] })
                  put.onsuccess = () => resolve({ name: top[0], used: top[1] })
                  put.onerror = () => reject(put.error)
                }
                sg.onerror = () => reject(sg.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'NGWORD-01 前提: NG食材に入れる材料を決められた（決められなければ以降は測れていない）',
        !!ngWordIngredient && ngWordIngredient.used >= 5,
        `材料=${JSON.stringify(ngWordIngredient)}`,
      )

      // 前提③: **いま献立に入った品**の材料も1つNG食材に足す（2026-08-22 司令部）。
      // 直す前は「端末全体でいちばん多く使われている材料」だけを入れて「どの品が献立に
      // 入っても必ず印が付く」と書いていたが、**それは成り立っていなかった**。最多の材料でも
      // 全品には入っていないので、引かれた品がたまたま全部それを含まないと「小」の3件が
      // まとめて落ちる（実測: 同じ版で3回走らせて1回落ちた＝アプリではなくこの手順の揺れ。
      // 禁じ手③「件数の決め打ち」の親戚で、**引かれる品に結果が依る**形だった）。
      // 献立に入った品の材料から選べば、印が1つも付かないことが原理的に起きない。
      const ngPlannedIngredient = await ngPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const mg = idb.transaction('mealPlans', 'readonly').objectStore('mealPlans').getAll()
              mg.onsuccess = () => {
                const ids = new Set(mg.result.map((e) => e.recipeId))
                const rg = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
                rg.onsuccess = () => {
                  const planned = rg.result.filter((r) => ids.has(r.id))
                  const counts = new Map()
                  for (const r of planned)
                    for (const i of r.ingredients ?? [])
                      if (i?.name) counts.set(i.name, (counts.get(i.name) ?? 0) + 1)
                  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
                  if (!top) {
                    resolve(null)
                    return
                  }
                  const st = idb.transaction('settings', 'readwrite').objectStore('settings')
                  const sg = st.get(1)
                  sg.onsuccess = () => {
                    const prev = sg.result?.ngIngredients ?? []
                    const next = prev.includes(top[0]) ? prev : [...prev, top[0]]
                    const put = st.put({ ...(sg.result ?? { id: 1 }), id: 1, ngIngredients: next })
                    put.onsuccess = () => resolve({ name: top[0], usedInPlan: top[1], planned: planned.length })
                    put.onerror = () => reject(put.error)
                  }
                  sg.onerror = () => reject(sg.error)
                }
                rg.onerror = () => reject(rg.error)
              }
              mg.onerror = () => reject(mg.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'NGWORD-01 前提: 献立に入った品の材料もNG食材に入れられた（入らなければ「小」は測れていない）',
        !!ngPlannedIngredient && ngPlannedIngredient.planned > 0 && ngPlannedIngredient.usedInPlan > 0,
        `献立の材料=${JSON.stringify(ngPlannedIngredient)}`,
      )
      // 禁じ手⑥: settings を Dexie を通さず生の IndexedDB へ書いたので、**必ず読み込み直す**
      await ngPage.reload({ waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(800)

      // ---- 大（レシピ一覧のグリッド）----
      await ngPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ngPage.reload({ waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(2400)
      const ngLarge = await ngTexts('[data-testid="ng-badge"]')
      check(
        'NGWORD-01 前提: レシピ一覧（大）にNG食材の印が出ている',
        ngLarge.length > 0,
        `印=${ngLarge.length}件`,
      )
      check(
        'NGWORD-01(大) 印の隣に短い言葉が出ている',
        ngLarge.length > 0 && ngLarge.every((t) => t === ja.card.ngBadgeShort),
        `言葉=${JSON.stringify([...new Set(ngLarge)].slice(0, 3))} 期待=${ja.card.ngBadgeShort}`,
      )

      // ---- 標準（レシピ一覧の一覧表示）----
      const ngToList = ngPage.getByRole('button', { name: ja.search.layoutToggleToList })
      check('NGWORD-01 前提: 一覧表示に切り替えられる', (await ngToList.count()) >= 1)
      if ((await ngToList.count()) >= 1) {
        await ngToList.first().click()
        await ngPage.waitForTimeout(1600)
      }
      const ngStandard = await ngTexts('[data-testid="ng-badge"]')
      check(
        'NGWORD-01 前提: レシピ一覧（標準）にNG食材の印が出ている',
        ngStandard.length > 0,
        `印=${ngStandard.length}件`,
      )
      check(
        'NGWORD-01(標準) 印の隣に短い言葉が出ている',
        ngStandard.length > 0 && ngStandard.every((t) => t === ja.card.ngBadgeShort),
        `言葉=${JSON.stringify([...new Set(ngStandard)].slice(0, 3))} 期待=${ja.card.ngBadgeShort}`,
      )

      // ---- 小（週の枠）: 印だけ。言葉は出さず、料理名が残っていること ----
      await ngPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(2000)
      await ngPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await ngPage.waitForTimeout(1600)
      const ngSlotCards = await ngPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="row-recipe"]')).map((el) => {
          const rect = el.getBoundingClientRect()
          return {
            width: Math.round(rect.width),
            text: (el.textContent ?? '').replaceAll('​', '').trim(),
            badges: el.querySelectorAll('[data-testid="ng-badge"]').length,
            words: el.querySelectorAll('[data-testid="ng-badge-word"]').length,
          }
        }),
      )
      const ngWithBadge = ngSlotCards.filter((c) => c.badges > 0)
      check(
        'NGWORD-01 前提: 週の枠（小）にNG食材の印が出ている',
        ngSlotCards.length > 0 && ngWithBadge.length > 0,
        `枠=${ngSlotCards.length}件 印つき=${ngWithBadge.length}件`,
      )
      check(
        'NGWORD-01(小) 狭い行では言葉を出さない（印だけ）',
        ngWithBadge.length > 0 && ngWithBadge.every((c) => c.words === 0),
        `言葉つき=${ngWithBadge.filter((c) => c.words > 0).length}件`,
      )
      check(
        'NGWORD-01(小) 印を出しても料理名が消えていない',
        ngWithBadge.length > 0 && ngWithBadge.every((c) => c.text.length > 0),
        `中身=${JSON.stringify(ngWithBadge.slice(0, 3))}`,
      )
      check(
        // 「小」で言葉を出さない理由そのもの。
        // 2026-08-22 便IVで週の通常表示から役割・人数・サイコロ・×が編集モードへ移り、
        // カードの幅は実測169px→301pxに広がった。それでも言葉（実測92px）を足すと
        // 料理名が5〜6文字ぶん削れる＝オーナーが便IVで直させた「名前が読めない」に逆戻りする。
        // 幅が「小」の上限まで広がっても、印だけにする判断は変えない。
        // 行が印だけになっていること自体は上の2行が見ているので、ここは幅を記録に残す役
        'NGWORD-01(小) 判断の前提: 狭い行の幅を実測できている（判断を見直す合図として残す）',
        ngWithBadge.length > 0 && ngWithBadge.every((c) => c.width > 0 && c.width < 340),
        `幅=${JSON.stringify(ngWithBadge.map((c) => c.width).slice(0, 5))}`,
      )

      // ---- ③ 事故になる情報が、アプリ側の画面から消えていない ----
      currentCheck = 'BKFACT-01'
      await ngPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await ngPage.waitForTimeout(1800)
      // 機種変更の手順は折りたたみの中にあるので開く（畳んだままだと本文が読めない）
      const bkMoveToggle = ngPage.getByRole('button', { name: ja.settings.moveGuideToggle, exact: false })
      check('BKFACT-01 前提: 「機種変更するときは」を開ける', (await bkMoveToggle.count()) >= 1)
      if ((await bkMoveToggle.count()) >= 1) {
        await bkMoveToggle.first().click()
        await ngPage.waitForTimeout(800)
      }
      // 2026-08-22 便JJ: 「古い記録の書き出し（アーカイブ）」も畳んであるので開く
      const bkArchiveToggle = ngPage.locator('[data-testid="archive-toggle"]')
      check('BKFACT-01 前提: 「古い記録の書き出し（アーカイブ）」を開ける', (await bkArchiveToggle.count()) >= 1)
      if ((await bkArchiveToggle.count()) >= 1) {
        await bkArchiveToggle.first().click()
        await ngPage.waitForTimeout(800)
      }
      const bkText = ngClean(await ngPage.locator('#section-backup').innerText().catch(() => ''))
      // 説明ページへ送ってはいけない事実（知らないと機種変更でデータを失う）。文言は ja から読む
      const BK_MUST = [
        ...ja.settings.backupIncludeCookedPhotosNotes,
        ja.settings.backupContainsCodeNotice,
        ja.settings.importReplaceCaption,
        ja.settings.moveGuideStep1Note,
        ...ja.settings.moveGuideNotes,
        ...ja.settings.refreshAppCacheClearWarnings,
        // 「書き出しただけでは端末の記録は減らない」は手順の並びが言う
        // （archiveDeleteNote は書き出しを済ませてから出る文なので、常に出ているものだけを見る）
        ...ja.settings.archiveSteps,
        ja.settings.archiveBackupNote,
        ja.settings.fileNameFreeNote,
      ]
      check(
        'BKFACT-01 前提: バックアップの節の本文を読めている',
        bkText.length > 200 && BK_MUST.length >= 10,
        `本文=${bkText.length}字 見る事実=${BK_MUST.length}件`,
      )
      const bkMissing = BK_MUST.filter((t) => !bkText.includes(ngClean(t)))
      check(
        'BKFACT-01 事故になる事実が、アプリの画面から1つも消えていない',
        bkMissing.length === 0,
        `画面に無い=${JSON.stringify(bkMissing)}`,
      )
      // 詳しい説明の行き先（アプリ側を短くしたぶん、案内先が生きていること）
      for (const [name, sel, href] of [
        ['バックアップ', '[data-testid="backup-detail-link"]', '/about/manual.html#backup'],
        ['古い記録の書き出し', '[data-testid="archive-detail-link"]', '/about/manual.html#archive'],
      ]) {
        const link = ngPage.locator(sel)
        check(
          `BKFACT-01 ${name}の詳しい説明への案内が生きている`,
          (await link.count()) === 1 && (await link.getAttribute('href')) === href,
          `href=${(await link.count()) === 1 ? await link.getAttribute('href') : 'なし'}`,
        )
      }
    } finally {
      await ngBrowser.close()
    }
  }

  // ==========================================================================================
  // 便IU（2026-08-21・オーナーの書き溜め）。①はCARDPARTS-01に畳んである
  // ==========================================================================================

  // --- IUORG-02(②。オーナー原文「・整理画面の「作った！」と×は右に寄せて。」)。
  // 測るのは**行の中での位置**（クラス名では測らない）。左の空きが右の空きより大きければ
  // 右へ寄っている。あわせて押せる大きさ（44px）を小さくしていないことも見る ---
  currentCheck = 'IUORG-02'
  {
    const ogBrowser = await chromium.launch()
    const ogContext = await ogBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ogPage = await ogContext.newPage()
    ogPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@IUORG-02] ${text}`)
    })
    try {
      await ogPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ogPage.waitForTimeout(2400) // 初回シード完了待ち
      await ogPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ogPage.reload({ waitUntil: 'networkidle' })
      await ogPage.waitForTimeout(1800)
      const ogOne = ogPage.locator('[data-testid="day-mode-one"]')
      if ((await ogOne.count()) === 1) {
        await ogOne.click()
        await ogPage.waitForTimeout(800)
      }
      await ogPage.locator('[data-testid="day-suggest-apply"]').click()
      await ogPage.waitForTimeout(600)
      await ogPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
      await ogPage.waitForTimeout(1600)
      const ogOrganize = ogPage.locator('[data-testid="day-organize"]')
      check('IUORG-02 前提: 「整理」がある', (await ogOrganize.count()) === 1)
      await ogOrganize.click()
      await ogPage.waitForTimeout(600)
      const ogCard = ogPage.locator('[data-testid="day-plan-card"]').first()
      check('IUORG-02 前提: 今日の献立の行がある', (await ogCard.count()) === 1)
      const ogCooked = ogCard.getByRole('button', { name: ja.mealPlan.todayMarkCooked })
      const ogRemove = ogCard.locator(
        `button[aria-label="${ja.mealPlan.todayRemove}"], button[aria-label="${ja.mealPlan.todayPlannedRemove}"]`,
      )
      check('IUORG-02 前提: 整理モードで「作った！」が出ている', (await ogCooked.count()) === 1)
      check('IUORG-02 前提: 整理モードで×が出ている', (await ogRemove.count()) === 1)
      if ((await ogCooked.count()) === 1 && (await ogRemove.count()) === 1) {
        const ogCardBox = await ogCard.boundingBox()
        const ogCookedBox = await ogCooked.first().boundingBox()
        const ogRemoveBox = await ogRemove.first().boundingBox()
        const ogLeftGap = ogCookedBox.x - ogCardBox.x
        const ogRightGap = ogCardBox.x + ogCardBox.width - (ogRemoveBox.x + ogRemoveBox.width)
        check(
          'IUORG-02 「作った！」と×が行の右に寄っている（左の空きのほうがずっと大きい）',
          ogLeftGap > ogRightGap * 3,
          `左の空き=${Math.round(ogLeftGap)}px 右の空き=${Math.round(ogRightGap)}px`,
        )
        check(
          'IUORG-02 右端まで寄っている（右の空きは行の余白ぶんだけ）',
          ogRightGap <= 12,
          `右の空き=${Math.round(ogRightGap)}px`,
        )
        check(
          'IUORG-02 押せる大きさを小さくしていない（どちらも44px以上）',
          Math.min(ogCookedBox.height, ogRemoveBox.height) >= 44 && ogRemoveBox.width >= 44,
          `作った！=${Math.round(ogCookedBox.width)}x${Math.round(ogCookedBox.height)} ×=${Math.round(ogRemoveBox.width)}x${Math.round(ogRemoveBox.height)}`,
        )
      }
    } finally {
      await ogBrowser.close()
    }
  }

  // --- IUSELECT-03(③。オーナー原文「・「献立を提案」、入れ方のプルダウンの色が真っ白に
  // みえるけど気のせい？」)。気のせいではなく、プルダウンの地色が置かれている面と同じ値だった。
  //
  // 測るのは**実際に塗られる色**（color-mix()は計算値がoklab()で返るので、キャンバスに
  // 1px塗って読み出す＝ブラウザが本当に描く値）。後ろの面は、透けていない親を上へ探して決める。
  // テーマは5種すべて。「自動」は端末の設定に従うので明るい側・暗い側の両方を見る。
  // 直接の色の値は書かない（テーマの色を変えたらここも直す、では見張りにならない）＝
  // **見分けが付くか**と**文字が読めるか**だけを測る ---
  currentCheck = 'IUSELECT-03'
  {
    const slDist = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
    const slLum = (c) => {
      const f = (v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const slRatio = (a, b) =>
      (Math.max(slLum(a), slLum(b)) + 0.05) / (Math.min(slLum(a), slLum(b)) + 0.05)
    const slHex = (c) =>
      `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const slBrowser = await chromium.launch()
    try {
      for (const [slTheme, slLabel, slScheme] of [
        ['auto', '自動（端末=ライト）', 'light'],
        ['auto', '自動（端末=ダーク）', 'dark'],
        ['light', 'ライト', 'dark'],
        ['dark', 'ダーク', 'light'],
        ['brown', 'ブラウン', 'light'],
        ['green', 'グリーン', 'dark'],
      ]) {
        const slContext = await slBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: slScheme,
        })
        const slPage = await slContext.newPage()
        try {
          await slPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await slPage.waitForTimeout(2400) // 初回シード完了待ち(settingsもこの時点で作られる)
          await slPage.evaluate(async (theme) => {
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
                const putReq = store.put({ ...current, id: 1, theme })
                putReq.onsuccess = () => resolve(undefined)
                putReq.onerror = () => reject(putReq.error)
              }
              getReq.onerror = () => reject(getReq.error)
            })
            idb.close()
          }, slTheme)
          await slPage.goto(`${BASE}/#/meal-plan?focus=week`, { waitUntil: 'networkidle' })
          await slPage.reload({ waitUntil: 'networkidle' })
          await slPage.waitForTimeout(1800)
          // 2026-08-22 便IV: 入れかたのプルダウンは折りたたみの中にあるので、先に開く
          await openWeekGroup(slPage, ja.mealPlan.weekGroupAutoTitle)
          const slSelect = slPage.locator('[data-testid="fill-mode"]')
          check(
            `IUSELECT-03 [${slLabel}] 前提: 入れかたのプルダウンがある`,
            (await slSelect.count()) === 1,
          )
          if ((await slSelect.count()) !== 1) continue
          const slSeen = await slSelect.evaluate((el) => {
            const canvas = document.createElement('canvas')
            canvas.width = 1
            canvas.height = 1
            const ctx = canvas.getContext('2d')
            const toRgb = (value) => {
              ctx.clearRect(0, 0, 1, 1)
              ctx.fillStyle = value
              ctx.fillRect(0, 0, 1, 1)
              const d = ctx.getImageData(0, 0, 1, 1).data
              return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
            }
            const cs = getComputedStyle(el)
            let parent = el.parentElement
            let behind = 'rgb(255, 255, 255)'
            while (parent) {
              const bg = getComputedStyle(parent).backgroundColor
              if (toRgb(bg).a > 0) {
                behind = bg
                break
              }
              parent = parent.parentElement
            }
            return {
              bg: toRgb(cs.backgroundColor),
              behind: toRgb(behind),
              color: toRgb(cs.color),
              border: toRgb(cs.borderTopColor),
            }
          })
          check(
            `IUSELECT-03 [${slLabel}] プルダウンの地色が、後ろの面と見分けられる`,
            slDist(slSeen.bg, slSeen.behind) >= 20,
            `地=${slHex(slSeen.bg)} 後ろの面=${slHex(slSeen.behind)} 差=${slDist(slSeen.bg, slSeen.behind).toFixed(1)}`,
          )
          check(
            `IUSELECT-03 [${slLabel}] 枠が後ろの面からはっきり浮いている（押せるものだと分かる）`,
            slDist(slSeen.border, slSeen.behind) >= 40,
            `枠=${slHex(slSeen.border)} 後ろの面=${slHex(slSeen.behind)} 差=${slDist(slSeen.border, slSeen.behind).toFixed(1)}`,
          )
          check(
            `IUSELECT-03 [${slLabel}] プルダウンの文字が読める（AA 4.5:1以上）`,
            slRatio(slSeen.color, slSeen.bg) >= 4.5,
            `${slRatio(slSeen.color, slSeen.bg).toFixed(2)}:1`,
          )
        } finally {
          await slContext.close()
        }
      }
    } finally {
      await slBrowser.close()
    }
  }

  // --- IUSCROLL-04(④。オーナー原文「・「別の週から入れる」押下後ページの真ん中に
  // スクロールしてしまう。」)。
  //
  // 本当の原因は「先頭へ戻す1行が無かった」こと（1枚のページの中で画面を差し替える作りなので、
  // 画面が変わってもブラウザの縦位置がそのまま残り、着いた先の最大値まで詰められて真ん中で止まる）。
  // 測るのは**ページの中での縦位置**（画面の中での位置ではない）。押す場所はページの下のほうに
  // あるので、実際の使いかたと同じく下まで送ってから押す。
  // 着いた直後と、中身が届いたあとの両方で測る（後から背が伸びても動かないこと） ---
  currentCheck = 'IUSCROLL-04'
  {
    const scBrowser = await chromium.launch()
    const scContext = await scBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const scPage = await scContext.newPage()
    scPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@IUSCROLL-04] ${text}`)
    })
    try {
      await scPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(2400) // 初回シード完了待ち
      await scPage.goto(`${BASE}/#/meal-plan?focus=week`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(2000)
      // 2026-08-22 便IV: この入口はテンプレートの節の折りたたみの中にある
      await openWeekGroup(scPage, ja.mealPlan.weekGroupTemplateTitle)
      const scLink = scPage.locator('[data-testid="week-copy-pick"]')
      check('IUSCROLL-04 前提: 過去の献立をコピーの入口がある', (await scLink.count()) === 1)
      await scPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await scPage.waitForTimeout(400)
      const scBefore = await scPage.evaluate(() => window.scrollY)
      check(
        'IUSCROLL-04 前提: 押す時点でページは下まで送られている',
        scBefore > 300,
        `押す前のscrollY=${scBefore}`,
      )
      await scLink.click()
      await scPage.waitForTimeout(500)
      const scAt0 = await scPage.evaluate(() => window.scrollY)
      await scPage.waitForTimeout(1800)
      const scAt1 = await scPage.evaluate(() => window.scrollY)
      check(
        'IUSCROLL-04 前提: 過去の献立をコピーの画面に着いた',
        (await scPage.locator('[data-testid="copy-pick-target"]').count()) === 1,
      )
      check(
        'IUSCROLL-04 押した直後、ページのいちばん上を見せている（真ん中へ送られない）',
        scAt0 <= 4,
        `着いた直後のscrollY=${scAt0}（押す前=${scBefore}）`,
      )
      check(
        'IUSCROLL-04 中身が届いても縦位置が動かない',
        Math.abs(scAt1 - scAt0) <= 4 && scAt1 <= 4,
        `直後=${scAt0} 1.8秒後=${scAt1}`,
      )
    } finally {
      await scBrowser.close()
    }
  }

  // --- IUUNDO-06(⑥。オーナー原文「・「まとめて献立を入力」押したら、元に戻すトースト？も出して」)。
  //
  // **どこまで戻すか＝押す直前の姿にまるごと**。空いた枠だけのときは入れた品を外し、
  // 総入れ替えのときは**消えた献立まで戻す**（入れた品を外すだけでは押す前と違う状態で終わる）。
  // 測り方は端末の献立の中身そのもの（日付・食事・レシピ・役割の並び）で、押す回数や品数は
  // 決め打ちしない ---
  currentCheck = 'IUUNDO-06'
  {
    const udBrowser = await chromium.launch()
    const udContext = await udBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const udPage = await udContext.newPage()
    udPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@IUUNDO-06] ${text}`)
    })
    const udPlans = () =>
      udPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result
                .transaction(['mealPlans'], 'readonly')
                .objectStore('mealPlans')
                .getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    /** 献立の中身を並びに依らない1本の文字列にする（件数だけでなく中身まで見比べる） */
    const udShape = async () =>
      (await udPlans())
        .map((e) => `${e.date}|${e.slot}|${e.recipeId}|${e.role ?? ''}`)
        .sort()
        .join(',')
    try {
      await udPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await udPage.waitForTimeout(2400) // 初回シード完了待ち
      await udPage.goto(`${BASE}/#/meal-plan?focus=week`, { waitUntil: 'networkidle' })
      await udPage.waitForTimeout(2000)
      const udBefore = await udShape()
      await udPage.locator('[data-testid="week-fill-run"]').click()
      await udPage.waitForTimeout(2500)
      const udFilled = await udShape()
      check('IUUNDO-06 前提: まとめて献立を入力で献立が増えた', udFilled !== udBefore)
      const udUndo = udPage.getByRole('button', { name: ja.common.undo })
      check(
        'IUUNDO-06 「まとめて献立を入力」の直後に「元に戻す」が出る',
        (await udUndo.count()) === 1,
      )
      if ((await udUndo.count()) === 1) {
        await udUndo.first().click()
        await udPage.waitForTimeout(2000)
        check(
          'IUUNDO-06 「元に戻す」で、押す前の献立に戻る',
          (await udShape()) === udBefore,
          `押す前=${udBefore.length}字 戻した後=${(await udShape()).length}字`,
        )
      }
      // 総入れ替え: 入れた品を外すだけでは足りない（消えた献立も戻さないと押す前の姿にならない）
      await udPage.locator('[data-testid="week-fill-run"]').click()
      await udPage.waitForTimeout(2500)
      const udBeforeReplace = await udShape()
      check('IUUNDO-06 前提: 入れ替える前の献立がある', udBeforeReplace.length > 0)
      // 2026-08-22 便IV: 入れかたのプルダウンは「献立を提案」の折りたたみの中にある（実行ボタンだけが
      // 見出しの横に出ている）。触る前に開く
      await openWeekGroup(udPage, ja.mealPlan.weekGroupAutoTitle)
      await udPage.selectOption('[data-testid="fill-mode"]', 'replaceAll')
      await udPage.waitForTimeout(400)
      await udPage.locator('[data-testid="week-fill-run"]').click()
      await udPage.waitForTimeout(3000)
      // 総入れ替えの確認の窓（規約F）は仕掛けが自動で押す。出たことは貯め口から確かめる
      const udConfirms = await readConfirms(udPage)
      check(
        'IUUNDO-06 前提: 総入れ替えでは消える前に確認の窓が出る（規約F）',
        udConfirms.length > 0,
        `窓=${JSON.stringify(udConfirms)}`,
      )
      const udReplaced = await udShape()
      check('IUUNDO-06 前提: 総入れ替えで中身が変わった', udReplaced !== udBeforeReplace)
      const udUndo2 = udPage.getByRole('button', { name: ja.common.undo })
      check('IUUNDO-06 総入れ替えの直後にも「元に戻す」が出る', (await udUndo2.count()) === 1)
      if ((await udUndo2.count()) === 1) {
        await udUndo2.first().click()
        await udPage.waitForTimeout(2500)
        check(
          'IUUNDO-06 総入れ替えを戻すと、消えた献立まで押す前の姿に戻る',
          (await udShape()) === udBeforeReplace,
          `押す直前=${udBeforeReplace.split(',').length}件 戻した後=${(await udShape()).split(',').length}件`,
        )
      }
    } finally {
      await udBrowser.close()
    }
  }

  // --- IUTODAY-07(⑦。オーナー原文「・週で献立組む→今日の献立にレシピが表示される→
  // レシピ詳細も「今日の献立に追加済み」にして。はずすと週の献立ごと編集されるようにしたい。」)。
  //
  // 直している穴: レシピ詳細は「今日の献立」の表だけを見ていた。週の予定がその表へ写るのは
  // **献立の「日」を開いたときの取り込み1本だけ**なので、週タブで組んだだけでは追加済みに
  // ならなかった。ここでは**「日」を一度も開かずに**週タブだけで組んで測る ---
  currentCheck = 'IUTODAY-07'
  {
    const tdBrowser = await chromium.launch()
    const tdContext = await tdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const tdPage = await tdContext.newPage()
    tdPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@IUTODAY-07] ${text}`)
    })
    const tdPlans = () =>
      tdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const q = req.result
                .transaction(['mealPlans'], 'readonly')
                .objectStore('mealPlans')
                .getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await tdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tdPage.waitForTimeout(2400) // 初回シード完了待ち
      // 週タブだけで献立を組む（「日」は一度も開かない＝自動取り込みを走らせない）
      await tdPage.goto(`${BASE}/#/meal-plan?focus=week`, { waitUntil: 'networkidle' })
      await tdPage.waitForTimeout(2000)
      await tdPage.locator('[data-testid="week-fill-run"]').click()
      await tdPage.waitForTimeout(2500)
      // 「今日」は端末の日付から取る（曜日・月替わりの前提は置かない）
      const tdToday = await tdPage.evaluate(() => {
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      })
      const tdTodayRows = (await tdPlans()).filter((e) => e.date === tdToday)
      check(
        'IUTODAY-07 前提: 週で組んだ結果、今日の予定が入っている',
        tdTodayRows.length > 0,
        `${tdTodayRows.length}件`,
      )
      if (tdTodayRows.length > 0) {
        const tdRecipeId = tdTodayRows[0].recipeId
        await tdPage.goto(`${BASE}/#/recipes/${tdRecipeId}`, { waitUntil: 'networkidle' })
        await tdPage.waitForTimeout(1500)
        const tdToggle = tdPage.locator('[data-testid="detail-today-toggle"]')
        const tdLabel = () =>
          tdToggle.textContent().then((t) => (t ?? '').replaceAll('​', '').trim())
        check('IUTODAY-07 前提: 今日の献立のボタンがある', (await tdToggle.count()) === 1)
        check(
          'IUTODAY-07 週で組んだだけで、レシピ詳細が「今日の献立に追加済み」になる',
          stripZwspText(await tdLabel()).includes(ja.detail.todayAdded),
          `ボタン=${await tdLabel()}`,
        )
        // 規約F: 押すと今週の献立からも外れることが、押す前に読める場所に書いてある
        check(
          'IUTODAY-07 押す前に、今週の献立からも外れることが書いてある（規約F）',
          (await tdPage.locator('[data-testid="detail-today-remove-hint"]').count()) === 1,
        )
        await tdToggle.click()
        await tdPage.waitForTimeout(1800)
        check(
          'IUTODAY-07 外すと、今週の献立の予定からも消える',
          (await tdPlans()).filter((e) => e.date === tdToday && e.recipeId === tdRecipeId)
            .length === 0,
        )
        check(
          'IUTODAY-07 外したあとは「今日の献立に追加」に戻る',
          stripZwspText(await tdLabel()).includes(ja.detail.todayAdd) &&
            !(await tdLabel()).includes(ja.detail.todayAdded),
          `ボタン=${await tdLabel()}`,
        )
        // 消える操作なので「元に戻す」が出て、押すと週の予定ごと戻る（日タブの×と同じ形）
        const tdUndo = tdPage.getByRole('button', { name: ja.common.undo })
        check('IUTODAY-07 外した直後に「元に戻す」が出る', (await tdUndo.count()) === 1)
        if ((await tdUndo.count()) === 1) {
          await tdUndo.first().click()
          await tdPage.waitForTimeout(1800)
          check(
            'IUTODAY-07 「元に戻す」で、今週の献立の予定ごと戻る',
            (await tdPlans()).filter((e) => e.date === tdToday && e.recipeId === tdRecipeId)
              .length > 0,
          )
        }
      }
    } finally {
      await tdBrowser.close()
    }
  }


  // --- 便IV(2026-08-22 オーナーの書き溜め「週」) ---------------------------------------------
  //
  // オーナー原文:
  //   「・でふぉるとで設定３種は、折りたたんだ表示にして
  //     ・「表示のしかた」の折りたたんだ表示には、空にする項目を入れないで
  //     ・「まとめて献立てを入力」ボタンは「献立を提案」の横にして、１列におさめて。
  //     ・テンプレートエリアは折りたたみ状態でボタンはなし。
  //     ・折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
  //       初心者が使わないような機能はしまっておく、という意味合いでした。
  //     ・週のレシピカードが小さすぎてレシピ名で表示できる字数が少なぎる。
  //       「豆腐ときの…」「レンジ蒸し…」「鶏胸肉の…」だとなんなのかわからない。
  //       週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ（タップでレシピ詳細画面に
  //       つながる）。1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、選んだ
  //       レシピの追加や書き換えができるようにする。」
  //
  // 便IF・便INで「畳んだままでも実行ボタンが押せる」形にしたうちの2か所（表示のしかたの
  // 「空にする」・テンプレートの3つ）を、オーナーの訂正どおり折りたたみの中へ戻す。
  // 掴み方は data-testid と読み上げ名だけ＝並び順・入れ子の段数・クラス名に依らない（禁じ手④）。
  // 文言は ja.ts から読む（書き写さない）。
  //
  //   IVFOLD-01 … 3つの節の既定と、畳んだときに何が出ているか（1列に収まっているかも実測）
  //   IVCARD-02 … 通常表示の1品カードは「写真＋料理名」だけ・料理名で何文字読めるか
  //   IVEDIT-03 … 編集モードは1日ずつ（他の日は通常表示のまま）
  //   IVLOCK-04 … 鍵の掛かった食事は通常表示でも分かる

  // --- IVFOLD-01: 週タブの操作3節の既定と、畳んだときの中身 ---
  currentCheck = 'IVFOLD-01'
  {
    const ivBrowser = await chromium.launch()
    const ivContext = await ivBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ivPage = await ivContext.newPage()
    ivPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@IVFOLD-01] ${err.message}`)
    })
    try {
      await ivPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await ivPage.waitForTimeout(2200) // 初回シード完了待ち
      await ivPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await ivPage.waitForTimeout(1200)

      /** 節の見出しの開閉状態（読み上げ名で掴む＝画面のどこにあっても同じ判定） */
      const ivGroupOpen = async (title) => {
        const opener = ivPage.getByRole('button', { name: `${title}を開く` })
        const closer = ivPage.getByRole('button', { name: `${title}を閉じる` })
        if ((await closer.count()) === 1) return true
        if ((await opener.count()) === 1) return false
        return null // 見つからない＝測れていない（合格に倒さない）
      }
      const ivStates = {
        display: await ivGroupOpen(ja.mealPlan.weekGroupDisplayTitle),
        auto: await ivGroupOpen(ja.mealPlan.weekGroupAutoTitle),
        template: await ivGroupOpen(ja.mealPlan.weekGroupTemplateTitle),
      }
      check(
        'IVFOLD-01 前提: 3つの節の見出しを全部掴めた',
        Object.values(ivStates).every((v) => v !== null),
        JSON.stringify(ivStates),
      )
      check(
        'IVFOLD-01 設定3種は既定で畳んである',
        ivStates.display === false && ivStates.auto === false && ivStates.template === false,
        JSON.stringify(ivStates),
      )

      // 畳んだ「表示のしかた」に、空にする操作を出さない
      check(
        'IVFOLD-01 畳んだ「表示のしかた」に「空にする」が出ていない',
        (await ivPage.locator('[data-testid="week-clear-slot"]').count()) === 0,
      )
      // 畳んだ「過去の献立・テンプレートから入れる」にボタンを出さない
      const ivTemplateButtons = async () =>
        (await ivPage.locator('[data-testid="week-template-save"]').count()) +
        (await ivPage.locator('[data-testid="week-template-apply"]').count()) +
        (await ivPage.locator('[data-testid="week-copy-pick"]').count())
      check(
        'IVFOLD-01 畳んだテンプレートの節にボタンが1つも出ていない',
        (await ivTemplateButtons()) === 0,
        `出ているボタン=${await ivTemplateButtons()}件`,
      )

      // 「まとめて献立を入力」は畳んだままでも出ていて、「献立を提案」の見出しと同じ行に1列で収まる
      const ivFill = ivPage.locator('[data-testid="week-fill-run"]')
      check(
        'IVFOLD-01 畳んだままでも「まとめて献立を入力」は出ている（しまわない機能）',
        (await ivFill.count()) === 1 && (await ivFill.first().isVisible()),
        `ボタン=${await ivFill.count()}件`,
      )
      const ivRow = await ivPage.evaluate((openAria) => {
        const fill = document.querySelector('[data-testid="week-fill-run"]')
        const head = [...document.querySelectorAll('button[aria-label]')].find(
          (b) => b.getAttribute('aria-label') === openAria,
        )
        if (!fill || !head) return null
        const f = fill.getBoundingClientRect()
        const h = head.getBoundingClientRect()
        // 2つを抱えている行（見出しの親）の高さ。折り返していれば行が2段ぶんに伸びる
        const line = head.parentElement?.getBoundingClientRect()
        return {
          overlap: Math.min(f.bottom, h.bottom) - Math.max(f.top, h.top),
          fillHeight: Math.round(f.height),
          headHeight: Math.round(h.height),
          lineHeight: line ? Math.round(line.height) : null,
          fillWidth: Math.round(f.width),
        }
      }, `${ja.mealPlan.weekGroupAutoTitle}を開く`)
      check(
        'IVFOLD-01 前提: 「献立を提案」の見出しと実行ボタンを両方掴めた',
        ivRow !== null,
        JSON.stringify(ivRow),
      )
      check(
        'IVFOLD-01 「まとめて献立を入力」は「献立を提案」の見出しの横（同じ行）にある',
        ivRow !== null && ivRow.overlap > 0,
        JSON.stringify(ivRow),
      )
      check(
        'IVFOLD-01 その行が1列に収まっている（折り返して2段にならない）',
        ivRow !== null &&
          ivRow.lineHeight !== null &&
          ivRow.lineHeight <= Math.max(ivRow.fillHeight, ivRow.headHeight) + 4,
        JSON.stringify(ivRow),
      )
      check(
        'IVFOLD-01 「まとめて献立を入力」は指で押せる大きさ(44px以上)',
        ivRow !== null && ivRow.fillHeight >= 44,
        JSON.stringify(ivRow),
      )

      // 行き止まりでないこと: 開けば「空にする」もテンプレートの3つも出る
      await ivPage.getByRole('button', { name: `${ja.mealPlan.weekGroupDisplayTitle}を開く` }).click()
      await ivPage.waitForTimeout(500)
      check(
        'IVFOLD-01 「表示のしかた」を開くと「空にする」が出る（しまっただけで、無くしていない）',
        (await ivPage.locator('[data-testid="week-clear-slot"]').count()) === 1,
      )
      await ivPage.getByRole('button', { name: `${ja.mealPlan.weekGroupTemplateTitle}を開く` }).click()
      await ivPage.waitForTimeout(500)
      check(
        'IVFOLD-01 テンプレートの節を開くと3つのボタンが出る',
        (await ivTemplateButtons()) === 3,
        `出ているボタン=${await ivTemplateButtons()}件`,
      )
    } finally {
      await ivBrowser.close()
    }
  }

  // --- IVCARD-02 / IVEDIT-03 / IVLOCK-04: 週の1日カードの通常表示と編集モード ---
  currentCheck = 'IVCARD-02'
  {
    const iwBrowser = await chromium.launch()
    const iwContext = await iwBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const iwPage = await iwContext.newPage()
    iwPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@IVCARD-02] ${err.message}`)
    })
    const iwClean = (t) => (t ?? '').replaceAll('​', '').trim()
    try {
      await iwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await iwPage.waitForTimeout(2400) // 初回シード完了待ち
      await iwPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await iwPage.reload({ waitUntil: 'networkidle' })
      await iwPage.waitForTimeout(1800)
      await iwPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await iwPage.waitForTimeout(1200)
      // 週を献立で埋める（測る対象を作ってから測る）
      await iwPage.locator('[data-testid="week-fill-run"]').first().click()
      await iwPage.waitForTimeout(2600)
      await openAllWeekDays(iwPage)
      await iwPage.waitForTimeout(600)

      const iwToday = await iwPage.evaluate(() => {
        const d = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      })
      const iwTodayCard = iwPage.locator(`section[data-date="${iwToday}"]`)
      check(
        'IVCARD-02 前提: 今日のカードに1品以上の献立が入っている',
        (await iwTodayCard.locator('[data-testid="row-recipe"]').count()) > 0,
        `品数=${await iwTodayCard.locator('[data-testid="row-recipe"]').count()}`,
      )

      // ---- 通常表示の1品カードは「写真＋料理名」だけ ----
      // 文字として出ているものを丸ごと読む＝「載っていないこと」を漏れなく測る
      const iwCards = await iwPage.evaluate((date) => {
        const section = document.querySelector(`section[data-date="${date}"]`)
        if (!section) return null
        const cvs = document.createElement('canvas').getContext('2d')
        return [...section.querySelectorAll('[data-testid="row-recipe"]')].map((el) => {
          const title = el.querySelector('[data-testid="row-title"]')
          const cs = title ? getComputedStyle(title) : null
          if (cs) cvs.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
          const text = (title?.textContent ?? '').replaceAll('​', '')
          const tw = title ? title.getBoundingClientRect().width : 0
          // その幅に何文字ぶん入るか（先頭から積んで、幅を超える手前まで）
          let fit = 0
          if (cs) {
            for (let i = 1; i <= Math.max(text.length, 20); i++) {
              const probe = i <= text.length ? text.slice(0, i) : text + 'あ'.repeat(i - text.length)
              if (cvs.measureText(probe).width <= tw) fit = i
              else break
            }
          }
          const r = el.getBoundingClientRect()
          return {
            all: (el.textContent ?? '').replaceAll('​', '').trim(),
            title: text,
            titleWidth: Math.round(tw),
            cardWidth: Math.round(r.width),
            cardHeight: Math.round(r.height),
            fitChars: fit,
            thumbs: el.querySelectorAll('[data-testid="row-thumb"]').length,
          }
        })
      }, iwToday)
      check(
        'IVCARD-02 前提: 通常表示の1品カードを実測できた（料理名の目印つき）',
        Array.isArray(iwCards) && iwCards.length > 0 && iwCards.every((c) => c.title.length > 0),
        JSON.stringify(iwCards),
      )
      check(
        'IVCARD-02 1品カードに出る文字は料理名だけ（時間・手間・季節・食材は載せない）',
        Array.isArray(iwCards) && iwCards.length > 0 && iwCards.every((c) => c.all === c.title),
        JSON.stringify(iwCards),
      )
      check(
        'IVCARD-02 1品カードには写真（または代わり絵）が付いている',
        Array.isArray(iwCards) && iwCards.length > 0 && iwCards.every((c) => c.thumbs === 1),
        JSON.stringify(iwCards),
      )
      check(
        'IVCARD-02 料理名が10文字以上読める（直す前は実測7文字・幅119px）',
        Array.isArray(iwCards) && iwCards.length > 0 && iwCards.every((c) => c.fitChars >= 10),
        JSON.stringify(iwCards),
      )
      check(
        'IVCARD-02 料理名の幅がカード幅の6割以上（操作に幅を奪われていない）',
        Array.isArray(iwCards) &&
          iwCards.length > 0 &&
          iwCards.every((c) => c.cardWidth > 0 && c.titleWidth / c.cardWidth >= 0.6),
        JSON.stringify(iwCards),
      )
      check(
        'IVCARD-02 1品カードは指で押せる大きさ(44px以上)',
        Array.isArray(iwCards) && iwCards.length > 0 && iwCards.every((c) => c.cardHeight >= 44),
        JSON.stringify(iwCards),
      )

      // 通常表示に、編集の操作が1つも出ていないこと（役割・人数・サイコロ・×・追加・別ジャンル）
      // 読むのは**献立の枠の中だけ**（この日の栄養の「1人分」を人数の指定と数えないため）
      const iwViewOps = await iwPage.evaluate(
        ({ date, aria }) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          if (!section) return null
          const blocks = [...section.querySelectorAll('[data-testid="slot-block"]')]
          if (blocks.length === 0) return null
          const text = blocks.map((b) => b.textContent ?? '').join(' ').replaceAll('​', '')
          const byAria = (name) =>
            blocks.flatMap((b) => [...b.querySelectorAll('[aria-label]')]).filter((el) =>
              (el.getAttribute('aria-label') ?? '').startsWith(name),
            ).length
          return {
            dice: byAria(aria.suggest),
            remove: byAria(aria.clear),
            addRow: blocks
              .flatMap((b) => [...b.querySelectorAll('button')])
              .filter((b) => (b.textContent ?? '').trim() === aria.addRow).length,
            servings: /\d+人分/.test(text) ? 1 : 0,
            roleLabel: aria.roles.filter((r) => text.includes(r)).length,
            genreMixed: text.includes(aria.genreMixed) ? 1 : 0,
            slotLockButtons: section.querySelectorAll('[data-testid="slot-lock"]').length,
          }
        },
        {
          date: iwToday,
          aria: {
            suggest: ja.mealPlan.suggestAria,
            clear: ja.mealPlan.clear,
            addRow: ja.mealPlan.addRow,
            roles: [ja.mealPlan.role.main, ja.mealPlan.role.side],
            genreMixed: ja.mealPlan.genreMixedBadge,
          },
        },
      )
      check(
        'IVCARD-02 前提: 今日のカードの中を読めた',
        iwViewOps !== null,
        JSON.stringify(iwViewOps),
      )
      check(
        'IVCARD-02 通常表示に、引き直し・外す・追加の操作を出さない',
        iwViewOps !== null &&
          iwViewOps.dice === 0 &&
          iwViewOps.remove === 0 &&
          iwViewOps.addRow === 0,
        JSON.stringify(iwViewOps),
      )
      check(
        'IVCARD-02 通常表示に、役割（主菜/副菜）・人数・「主菜と別ジャンル」を出さない',
        iwViewOps !== null &&
          iwViewOps.roleLabel === 0 &&
          iwViewOps.servings === 0 &&
          iwViewOps.genreMixed === 0,
        JSON.stringify(iwViewOps),
      )

      // タップでレシピ詳細へつながる
      const iwFirstTitle = iwCards && iwCards.length > 0 ? iwCards[0].title : ''
      await iwTodayCard.locator('[data-testid="row-recipe"]').first().click()
      await iwPage.waitForTimeout(1500)
      check(
        'IVCARD-02 1品カードをタップするとレシピ詳細が開く',
        /#\/recipes\/\d+/.test(iwPage.url()),
        iwPage.url(),
      )
      check(
        'IVCARD-02 開いた先が、カードに出ていた料理になっている',
        iwFirstTitle.length > 0 && iwClean(await iwPage.textContent('body')).includes(iwFirstTitle),
        `カードの料理名=${iwFirstTitle}`,
      )
      // ブラウザの戻りは `#/meal-plan` に着くだけで、タブは既定の「日」に落ちる。
      // ここから先は週タブを見るので、明示的に週へ戻してから曜日カードを開き直す
      await iwPage.goBack()
      await iwPage.waitForTimeout(1800)
      await iwPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await iwPage.waitForTimeout(1200)
      await openAllWeekDays(iwPage)
      await iwPage.waitForTimeout(600)
      check(
        'IVCARD-02 前提: レシピ詳細から戻って、週タブの曜日カードが出ている',
        (await iwPage.locator('section[data-date]').count()) === 7,
        `カード=${await iwPage.locator('section[data-date]').count()}枚`,
      )

      // ---- IVEDIT-03: 編集モードは1日ずつ ----
      currentCheck = 'IVEDIT-03'
      const iwEdit = (date) => iwPage.locator(`[data-testid="week-day-edit"][data-date="${date}"]`)
      /** 編集モードに入っているか。ボタンが無ければ null（見つからない＝合格に倒さない） */
      const iwEditOn = async (date) =>
        (await iwEdit(date).count()) === 1 ? (await iwEdit(date).getAttribute('aria-pressed')) === 'true' : null
      check(
        'IVEDIT-03 前提: 1日カードの見出しに編集の切り替えボタンがある',
        (await iwEdit(iwToday).count()) === 1,
        `ボタン=${await iwEdit(iwToday).count()}件`,
      )
      const iwEditBox = (await iwEdit(iwToday).count()) === 1 ? await iwEdit(iwToday).boundingBox() : null
      check(
        'IVEDIT-03 編集の切り替えボタンが指で押せる大きさ(44px以上)',
        !!iwEditBox && iwEditBox.height >= 44,
        `高さ=${iwEditBox?.height}`,
      )
      check(
        'IVEDIT-03 既定は通常表示（編集モードに入っていない）',
        (await iwEditOn(iwToday)) === false,
        `編集モード=${await iwEditOn(iwToday)}`,
      )
      // 2026-08-23 司令部（禁じ手①）: 「今日を含む週の、今日より先の日」は**今日が週の最終日
      // （日曜など）だと0日**になる。過ぎた日の献立はどの画面にも出ないので、この節は日曜に
      // まとめて落ちていた。週の区切りを「今日から7日間」にすれば今日が初日になり、
      // 先の日が必ず6日ある（この節が測るのは編集モードの振る舞いで、週の区切り方には依らない）
      await selectWeekLayout(iwPage, ja.mealPlan.weekLayoutRolling)
      await iwPage.waitForTimeout(800)
      // 切り替えると見ている7日間がずれるので、**その週にもう一度献立を入れ直す**
      // （前に入れたのは「週区切り」の7日間で、今日から7日間には空の日が混ざる）
      await iwPage.locator('[data-testid="week-fill-run"]').first().click()
      await iwPage.waitForTimeout(2600)
      await openAllWeekDays(iwPage)
      await iwPage.waitForTimeout(400)
      // 編集モードに入る前に、献立の入っている別の日を1つ選んでおく（他の日が巻き添えにならないこと用）
      const iwOtherDate = await iwPage.evaluate((today) => {
        for (const s of document.querySelectorAll('section[data-date]')) {
          const d = s.getAttribute('data-date')
          if (d && d !== today && s.querySelector('[data-testid="row-recipe"]')) return d
        }
        return null
      }, iwToday)
      check('IVEDIT-03 前提: 献立の入っている別の日がある', iwOtherDate !== null, `別の日=${iwOtherDate}`)

      if ((await iwEdit(iwToday).count()) === 1) {
        await iwEdit(iwToday).click()
        await iwPage.waitForTimeout(700)
      }
      const iwEditOps = await iwPage.evaluate(
        ({ date, aria }) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          if (!section) return null
          const blocks = [...section.querySelectorAll('[data-testid="slot-block"]')]
          if (blocks.length === 0) return null
          const text = blocks.map((b) => b.textContent ?? '').join(' ').replaceAll('​', '')
          const byAria = (name) =>
            blocks.flatMap((b) => [...b.querySelectorAll('[aria-label]')]).filter((el) =>
              (el.getAttribute('aria-label') ?? '').startsWith(name),
            ).length
          return {
            dice: byAria(aria.suggest),
            remove: byAria(aria.clear),
            addRow: blocks
              .flatMap((b) => [...b.querySelectorAll('button')])
              .filter((b) => (b.textContent ?? '').trim() === aria.addRow).length,
            servings: /\d+人分/.test(text) ? 1 : 0,
            roleLabel: aria.roles.filter((r) => text.includes(r)).length,
            slotLockButtons: section.querySelectorAll('[data-testid="slot-lock"]').length,
            pickers: section.querySelectorAll('[data-testid="slot-change-recipe"]').length,
          }
        },
        {
          date: iwToday,
          aria: {
            suggest: ja.mealPlan.suggestAria,
            clear: ja.mealPlan.clear,
            addRow: ja.mealPlan.addRow,
            roles: [ja.mealPlan.role.main, ja.mealPlan.role.side],
          },
        },
      )
      check(
        'IVEDIT-03 編集モードに入ると、引き直し・外す・追加・人数・役割・鍵が全部出る',
        iwEditOps !== null &&
          iwEditOps.dice > 0 &&
          iwEditOps.remove > 0 &&
          iwEditOps.addRow > 0 &&
          iwEditOps.servings === 1 &&
          iwEditOps.roleLabel > 0 &&
          iwEditOps.slotLockButtons > 0,
        JSON.stringify(iwEditOps),
      )
      check(
        'IVEDIT-03 編集モードには差し替えの入口「レシピを変更」が出る（2026-08-25 便KU）',
        iwEditOps !== null && iwEditOps.pickers > 0,
        JSON.stringify(iwEditOps),
      )
      if (iwOtherDate) {
        const iwOtherDice = await iwPage.evaluate(
          ({ date, suggest }) => {
            const section = document.querySelector(`section[data-date="${date}"]`)
            if (!section) return null
            return [...section.querySelectorAll('[aria-label]')].filter((el) =>
              (el.getAttribute('aria-label') ?? '').startsWith(suggest),
            ).length
          },
          { date: iwOtherDate, suggest: ja.mealPlan.suggestAria },
        )
        check(
          'IVEDIT-03 編集モードは1日だけ（他の日は通常表示のまま）',
          iwOtherDice === 0,
          `別の日(${iwOtherDate})のサイコロ=${iwOtherDice}`,
        )
        // 別の日の編集を押すと、前の日は通常表示に戻る
        if ((await iwEdit(iwOtherDate).count()) === 1) {
          await iwEdit(iwOtherDate).click()
          await iwPage.waitForTimeout(700)
        }
        check(
          'IVEDIT-03 別の日の編集に移ると、前の日は通常表示に戻る',
          (await iwEditOn(iwToday)) === false && (await iwEditOn(iwOtherDate)) === true,
          `今日=${await iwEditOn(iwToday)} 別の日=${await iwEditOn(iwOtherDate)}`,
        )
        if ((await iwEdit(iwOtherDate).count()) === 1) {
          await iwEdit(iwOtherDate).click()
          await iwPage.waitForTimeout(700)
        }
        check(
          'IVEDIT-03 もう一度押すと通常表示に戻る',
          (await iwEditOn(iwOtherDate)) === false,
          `編集モード=${await iwEditOn(iwOtherDate)}`,
        )
      }
      // 2026-08-22 便JF・①（オーナー原文「過去の日付の記録も、編集モードで後から記録を
      // 追加できるようにして。」）: 過ぎた日にも編集の切り替えを出す。
      // 便IVのときは過ぎた日の編集モードに中身が無かったので出していなかった＝前提が変わった。
      // 過ぎた日の編集モードで触るのは**作った記録**で、献立の枠は今までどおり出さない
      // （それは下の JFPAST-01 が測る）
      // 2026-08-23 便JM（禁じ手①の裏返し）: ここは**過ぎた日**を測る検査なのに、いま見ている
      // 7日間は「今日から7日間」＝過ぎた日が1日も無い。前の形（週区切り）でも今日が月曜なら
      // 過ぎた日は0日で、filter() が空 → every() が素通りで合格していた（測れていないのに緑）。
      // 「前の週」へ1回送れば、区切り方にも曜日にも依らず**7日とも過ぎた日**になる。
      // JFPAST-01 が同じ理由で同じ送り方をしている（見本）。
      await iwPage.getByRole('button', { name: ja.mealPlan.prevWeek, exact: true }).click()
      await iwPage.waitForTimeout(900)
      await openAllWeekDays(iwPage)
      await iwPage.waitForTimeout(400)
      const readDayCards = () =>
        iwPage.evaluate(() => {
          const out = []
          for (const s of document.querySelectorAll('section[data-date]')) {
            out.push({
              date: s.getAttribute('data-date'),
              edit: s.querySelectorAll('[data-testid="week-day-edit"]').length,
              slots: s.querySelectorAll('[data-testid="slot-block"]').length,
            })
          }
          return out
        })
      const iwPastEdit = await readDayCards()
      check(
        'IVEDIT-03 前提: 前の週へ送ると7日とも過ぎた日になっている（曜日・区切り方に依らない）',
        iwPastEdit.length === 7 && iwPastEdit.every((d) => d.date && d.date < iwToday),
        JSON.stringify(iwPastEdit),
      )
      check(
        'IVEDIT-03 過ぎた日にも編集の切り替えを出す（便JF・①で記録を足せるようになった）',
        // 7日ぶん読めていることを先に見る＝1枚も掴めていないのに every() で素通りしない
        iwPastEdit.length === 7 && iwPastEdit.every((d) => d.edit === 1),
        JSON.stringify(iwPastEdit),
      )
      check(
        'IVEDIT-03 過ぎた日には献立の枠を出さない（記録だけを見せる画面のまま）',
        iwPastEdit.length === 7 && iwPastEdit.every((d) => d.slots === 0),
        JSON.stringify(iwPastEdit),
      )
      // 続きの検査は今日のカードを触るので、見ている7日間を戻しておく
      await iwPage.getByRole('button', { name: ja.mealPlan.nextWeek, exact: true }).click()
      await iwPage.waitForTimeout(900)
      await openAllWeekDays(iwPage)
      await iwPage.waitForTimeout(400)
      const iwBackToToday = await readDayCards()
      check(
        'IVEDIT-03 前提: 今日を含む7日間へ戻せた（続きの検査の土台）',
        iwBackToToday.some((d) => d.date === iwToday),
        JSON.stringify(iwBackToToday.map((d) => d.date)),
      )

      // ---- IVLOCK-04: 鍵の掛かった食事は通常表示でも分かる ----
      currentCheck = 'IVLOCK-04'
      const iwLockMark = () =>
        iwPage.locator(`section[data-date="${iwToday}"] [data-testid="slot-lock-mark"]`)
      check(
        'IVLOCK-04 前提: 鍵を掛けていない通常表示には鍵の印が出ていない',
        (await iwLockMark().count()) === 0,
        `印=${await iwLockMark().count()}件`,
      )
      const iwDayLock = iwPage.locator(`[data-testid="day-lock"][data-date="${iwToday}"]`)
      check('IVLOCK-04 前提: 今日の鍵のボタンを掴めた', (await iwDayLock.count()) === 1)
      if ((await iwDayLock.count()) === 1) {
        await iwDayLock.click()
        await iwPage.waitForTimeout(1200)
      }
      check(
        'IVLOCK-04 鍵を掛けると、通常表示のままでも鍵の印が出る',
        (await iwLockMark().count()) > 0,
        `印=${await iwLockMark().count()}件`,
      )
      if ((await iwDayLock.count()) === 1) {
        await iwDayLock.click()
        await iwPage.waitForTimeout(1200)
      }
      check(
        'IVLOCK-04 鍵を外すと印も消える',
        (await iwLockMark().count()) === 0,
        `印=${await iwLockMark().count()}件`,
      )
    } finally {
      await iwBrowser.close()
    }
  }


  // --- IYGENRE-01: 料理のジャンルを複数選べる（2026-08-22 便IY） ---
  // オーナー原文「週献立は、「料理のジャンル」は複数選択のほうがいいかも。１つしか選べないと、
  // １週間中華だけ、という献立しか組めない。全てを選ぶと、中華は入れたくないけど和洋食は
  // 混在させたい、ができない。」
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ① ジャンルは3つとも選べる／外せる（既定は3つとも選んだ状態＝指定なし）
  //   ② 2つ選んだときの主菜の候補が、1つだけのときより**多く**、指定なしより**少ない**
  //      ＝「1週間中華だけ」しか組めなかった困りごとが、本当に解けている
  //   ③ 最後の1つは外せない（1つも選んでいない＝候補が無くなる状態を作らせない）
  //   ④ 「条件をクリア」で3つとも選んだ状態に戻り、条件のボタンは「指定なし」に戻る
  //   ⑤ 週タブと月タブで同じ窓・同じ状態（条件を共有している）
  //   ⑥ 390×844で1行に収まり、押せる大きさは44px以上
  // 禁じ手よけ: 候補の数を決め打ちしない（多い・少ないの向きだけを見る）／曜日・月替わりの
  // 前提を置かない／画面の字を書き写さず ja.ts と MEAL_GENRES から引く／数が読めなければ
  // null のまま比較して必ず不合格になる形にする
  currentCheck = 'IYGENRE-01'
  {
    const iyBrowser = await chromium.launch()
    const iyContext = await iyBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const iyPage = await iyContext.newPage()
    iyPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@IYGENRE-01] ${text}`)
    })
    iyPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@IYGENRE-01] ${err.message}`)
    })
    const iyChips = () => iyPage.locator('[data-testid="plan-genre-chip"]')
    const iyChip = (genre) =>
      iyPage.locator(`[data-testid="plan-genre-chip"][data-genre="${genre}"]`)
    /** いま選ばれているジャンル（画面の並び順のまま）。読めなければ null */
    const iySelected = async () => {
      if ((await iyChips().count()) === 0) return null
      return iyChips().evaluateAll((els) =>
        els
          .filter((el) => el.getAttribute('aria-pressed') === 'true')
          .map((el) => el.getAttribute('data-genre')),
      )
    }
    /**
     * 選ばれているジャンルが**落ち着く**（2回続けて同じになる）まで待ってから読む。
     * 設定はDexieから後で届くので、届く前に掴むと「3つとも選んだ状態」を掴んでしまう
     * （禁じ手⑤）。読み込み直したあとの検査は必ずこちらを通す
     */
    const iySettled = async () => {
      let prev = JSON.stringify(await iySelected())
      for (let i = 0; i < 20; i++) {
        await iyPage.waitForTimeout(200)
        const now = JSON.stringify(await iySelected())
        if (now === prev && now !== 'null') return JSON.parse(now)
        prev = now
      }
      return prev === 'null' ? null : JSON.parse(prev)
    }
    /** ジャンルのチップを押す。無ければ何もしない（無いことは別の検査が受け持つ） */
    const iyTap = async (genre) => {
      if ((await iyChip(genre).count()) === 0) return
      await iyChip(genre).click()
      await iyPage.waitForTimeout(500)
    }
    /** 週タブの「現在の条件」の窓を開いた状態にする */
    const iyOpenConditions = async (tabName = '週') => {
      const tab = iyPage.getByRole('button', { name: tabName, exact: true })
      if ((await tab.getAttribute('aria-pressed')) !== 'true') {
        await tab.click()
        await iyPage.waitForTimeout(900)
      }
      // 2026-08-26 便LH: 月タブの「現在の条件」は「献立の入れかた」の折りたたみへ移った
      // （オーナー指示「折りたたみの見える部分は『献立をまとめて提案』のみ」）。
      // 週と月で開く相手が違うので、タブで開き分ける。
      // 週のまま掴むと30秒待って**フルe2eごと実行中断**する（2026-08-26 実発）
      if (tabName === '月') await openMonthPlanGroup(iyPage)
      else await openWeekGroup(iyPage, ja.mealPlan.weekGroupAutoTitle)
      if ((await iyPage.locator('[data-testid="plan-conditions-modal"]').count()) === 0) {
        await iyPage.locator('[data-testid="plan-conditions-open"]').click()
        await iyPage.waitForTimeout(600)
      }
    }
    const iyCloseConditions = async () => {
      const close = iyPage.locator('[data-testid="plan-conditions-close"]')
      if ((await close.count()) > 0) {
        await close.click()
        await iyPage.waitForTimeout(500)
      }
    }
    /** 「現在の条件」のボタンに出ている字（ゼロ幅スペースを外す）。読めなければ null */
    const iyCondLabel = async () => {
      const btn = iyPage.locator('[data-testid="plan-conditions-open"]')
      if ((await btn.count()) === 0) return null
      return ((await btn.first().textContent()) ?? '').replaceAll('​', '')
    }
    /** 「今日なに作る？」の献立側に出る主菜の候補数。読めなければ null（＝必ず不合格になる） */
    const iyMainCandidates = async () => {
      await iyPage.getByRole('button', { name: '日', exact: true }).click()
      await iyPage.waitForTimeout(1300)
      const body = ((await iyPage.textContent('body')) ?? '').replaceAll('​', '')
      const m = body.match(/主菜の候補\s*(\d+)\s*[品件]/)
      return m ? Number(m[1]) : null
    }
    try {
      await iyPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await iyPage.waitForTimeout(2400) // 初回シード完了待ち
      // 月タブはPro版の機能なので、週と月で同じ窓かを見るために解錠しておく
      // （コードはWEEKLOCK-MONTHと同じ検証用の1本）
      await iyPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await iyPage.waitForTimeout(1600)
      await iyPage.getByPlaceholder(ja.settings.unlockCodePlaceholder).fill('UR-96QS-2VSZ')
      await iyPage.getByRole('button', { name: ja.settings.unlockActivate, exact: true }).click()
      await iyPage.waitForTimeout(900)
      check(
        'IYGENRE-01 前提: Pro版を解錠した（月タブの窓を見るため）',
        stripZwspText(await iyPage.textContent('body')).includes(ja.settings.proActivatedTitle),
      )
      await iyPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await iyPage.reload({ waitUntil: 'networkidle' })
      await iyPage.waitForTimeout(1800)

      // ===== ① 3つのジャンルが並び、既定は3つとも選ばれている =====
      await iyOpenConditions()
      check(
        'IYGENRE-01 料理のジャンルは、選べるジャンルのぶんだけ並ぶ（1つだけ選ぶプルダウンではない）',
        (await iyChips().count()) === MEAL_GENRES.length,
        `並び=${await iyChips().count()}件 / 選べるジャンル=${MEAL_GENRES.length}件`,
      )
      check(
        'IYGENRE-01 並んでいるのは和食・洋食・中華（MEAL_GENRESと同じ並び）',
        (await iyChips().evaluateAll((els) => els.map((el) => el.getAttribute('data-genre')))).join(',') ===
          MEAL_GENRES.join(','),
        `画面=${(await iyChips().evaluateAll((els) => els.map((el) => el.getAttribute('data-genre')))).join(',')}`,
      )
      check(
        'IYGENRE-01 既定は3つとも選ばれている（＝指定なし。いまと同じ振る舞い）',
        JSON.stringify(await iySelected()) === JSON.stringify([...MEAL_GENRES]),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      check(
        'IYGENRE-01 既定では「現在の条件」にジャンルを出さない（指定なしのため）',
        (await iyCondLabel())?.includes(ja.mealPlan.suggestConditionsNone) === true,
        `条件のボタン=${await iyCondLabel()}`,
      )
      // ⑥ 390px幅での見え方（1行に収まる・押せる大きさ44px以上・右端がはみ出さない）
      const iyBoxes = await iyChips().evaluateAll((els) =>
        els.map((el) => {
          const r = el.getBoundingClientRect()
          return { genre: el.getAttribute('data-genre'), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right) }
        }),
      )
      check(
        'IYGENRE-01 前提: ジャンルのチップの大きさを実測できた',
        iyBoxes.length === MEAL_GENRES.length,
        JSON.stringify(iyBoxes),
      )
      check(
        'IYGENRE-01 390px幅でジャンルは1行に収まる（横に並ぶ）',
        iyBoxes.length === MEAL_GENRES.length && iyBoxes.every((b) => Math.abs(b.y - iyBoxes[0].y) < 2),
        JSON.stringify(iyBoxes),
      )
      check(
        'IYGENRE-01 ジャンルは指で押せる大きさ（44px以上）',
        iyBoxes.length === MEAL_GENRES.length && iyBoxes.every((b) => b.h >= 44),
        JSON.stringify(iyBoxes),
      )
      check(
        'IYGENRE-01 390px幅で画面の外へはみ出さない',
        iyBoxes.length === MEAL_GENRES.length && iyBoxes.every((b) => b.right <= 390),
        JSON.stringify(iyBoxes),
      )

      // ===== ② 複数選択が本当に効く（候補の数の向きで見る） =====
      await iyCloseConditions()
      const iyAny = await iyMainCandidates()
      await iyOpenConditions()
      await iyTap('中華') // 「中華は入れたくないけど和洋食は混在させたい」
      check(
        'IYGENRE-01 1つ外すと、残りは選ばれたまま（複数選べる）',
        JSON.stringify(await iySelected()) === JSON.stringify(['和食', '洋食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      check(
        'IYGENRE-01 選んだジャンルは「現在の条件」のボタンにも出る',
        (await iyCondLabel())?.includes('和食') === true && (await iyCondLabel())?.includes('洋食') === true,
        `条件のボタン=${await iyCondLabel()}`,
      )
      await iyCloseConditions()
      const iyTwo = await iyMainCandidates()
      await iyOpenConditions()
      await iyTap('洋食')
      check(
        'IYGENRE-01 さらに1つ外すと、1つだけ選んだ状態になる（これまでと同じ形も作れる）',
        JSON.stringify(await iySelected()) === JSON.stringify(['和食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      await iyCloseConditions()
      const iyOne = await iyMainCandidates()
      check(
        'IYGENRE-01 2つ選ぶと、1つだけのときより主菜の候補が増える（複数選択が効いている）',
        iyOne != null && iyTwo != null && iyOne > 0 && iyTwo > iyOne,
        `1つ=${iyOne ?? '読めず'} 2つ=${iyTwo ?? '読めず'}`,
      )
      check(
        'IYGENRE-01 2つ選んでも、指定なしよりは候補が少ない（絞り込みが効いている）',
        iyTwo != null && iyAny != null && iyTwo < iyAny,
        `2つ=${iyTwo ?? '読めず'} 指定なし=${iyAny ?? '読めず'}`,
      )

      // ===== ③ 最後の1つは外せない（候補が無くなる状態を作らせない） =====
      await iyOpenConditions()
      await iyTap('和食')
      check(
        'IYGENRE-01 最後の1つは外せない（1つも選んでいない状態を作らせない）',
        JSON.stringify(await iySelected()) === JSON.stringify(['和食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      await iyCloseConditions()
      const iyStillOne = await iyMainCandidates()
      check(
        'IYGENRE-01 最後の1つを押しても、候補は無くならない',
        iyStillOne != null && iyStillOne > 0 && iyStillOne === iyOne,
        `押す前=${iyOne ?? '読めず'} 押した後=${iyStillOne ?? '読めず'}`,
      )

      // ===== ⑤ 月タブでも同じ窓・同じ状態（条件を共有している） =====
      await iyPage.getByRole('button', { name: '月', exact: true }).click()
      await iyPage.waitForTimeout(1200)
      // 2026-08-26 便LH: 月タブの「現在の条件」は「献立の入れかた」の折りたたみの中。
      // ここは iyOpenConditions を通らない**2つ目の入口**で、直し忘れると同じ中断が続く
      await openMonthPlanGroup(iyPage)
      if ((await iyPage.locator('[data-testid="plan-conditions-modal"]').count()) === 0) {
        await iyPage.locator('[data-testid="plan-conditions-open"]').first().click()
        await iyPage.waitForTimeout(600)
      }
      check(
        'IYGENRE-01 月タブの「現在の条件」にも同じジャンルの並びが出る',
        (await iyChips().count()) === MEAL_GENRES.length,
        `並び=${await iyChips().count()}件`,
      )
      check(
        'IYGENRE-01 月タブでも、週タブで選んだジャンルがそのまま出る（条件を共有している）',
        JSON.stringify(await iySelected()) === JSON.stringify(['和食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )

      // ===== ④ 「条件をクリア」で3つとも選んだ状態（＝指定なし）に戻る =====
      const iyClear = iyPage.locator('[data-testid="plan-conditions-clear"]')
      check('IYGENRE-01 前提: 「条件をクリア」を掴めた', (await iyClear.count()) === 1)
      if ((await iyClear.count()) === 1) {
        await iyClear.first().click()
        await iyPage.waitForTimeout(600)
      }
      check(
        'IYGENRE-01 「条件をクリア」で3つとも選んだ状態（指定なし）に戻る',
        JSON.stringify(await iySelected()) === JSON.stringify([...MEAL_GENRES]),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      // ===== 窓の見出しは、押したボタンと同じ名前（同じものを2つの名前で呼ばない） =====
      const iyHeading = (
        (await iyPage
          .locator('[data-testid="plan-conditions-modal"]')
          .getByRole('heading')
          .first()
          .textContent()) ?? ''
      ).replaceAll('​', '').trim()
      check(
        'IYGENRE-01(便IY) 条件の窓の見出しは、押したボタンと同じ名前',
        iyHeading === ja.mealPlan.suggestConditionsToggle,
        `窓の見出し=${iyHeading} ボタン=${ja.mealPlan.suggestConditionsToggle}`,
      )
      await iyCloseConditions()
      check(
        'IYGENRE-01 クリアしたあと、条件のボタンは「指定なし」に戻る',
        (await iyCondLabel())?.includes(ja.mealPlan.suggestConditionsNone) === true,
        `条件のボタン=${await iyCondLabel()}`,
      )

      // ===== ⑦ 選んだジャンルを覚えている（司令部裁定B案） =====
      // 「うちは中華を作らない」は年単位で続く家庭の好みなので、開くたびに選び直させない。
      // まず、直前に押した「条件をクリア」が**保存も消している**ことを読み込み直して確かめる
      // （画面だけ戻って保存が残る、をしない）。設定は後から届くので落ち着くまで待って掴む
      await iyPage.reload({ waitUntil: 'networkidle' })
      await iyPage.waitForTimeout(2400)
      await iyOpenConditions()
      check(
        'IYGENRE-01(便IY) 「条件をクリア」は保存も消す（読み込み直しても3つとも選んだ状態）',
        JSON.stringify(await iySettled()) === JSON.stringify([...MEAL_GENRES]),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      await iyTap('中華')
      check(
        'IYGENRE-01(便IY) 前提: 覚えているかを測る前に、1つ外せた',
        JSON.stringify(await iySelected()) === JSON.stringify(['和食', '洋食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      await iyCloseConditions()
      await iyPage.reload({ waitUntil: 'networkidle' })
      await iyPage.waitForTimeout(2400)
      await iyOpenConditions()
      check(
        'IYGENRE-01(便IY) 選んだジャンルは読み込み直しても残る（開くたびに選び直させない）',
        JSON.stringify(await iySettled()) === JSON.stringify(['和食', '洋食']),
        `選ばれている=${JSON.stringify(await iySelected())}`,
      )
      check(
        'IYGENRE-01(便IY) 覚えているあいだは「現在の条件」にも出る（黙って絞り込まない）',
        (await iyCondLabel())?.includes('和食') === true &&
          (await iyCondLabel())?.includes('中華') === false,
        `条件のボタン=${await iyCondLabel()}`,
      )
      // 覚えた条件を消してから終わる（この節が次に使う入れ物へ持ち越さない）
      const iyClearAgain = iyPage.locator('[data-testid="plan-conditions-clear"]')
      // 条件を1つも選んでいないあいだは場所だけ取って見えなくしてある（便II・②）。
      // 見えないものを押しに行くと30秒待って中断するので、見えているときだけ押す
      if ((await iyClearAgain.count()) === 1 && (await iyClearAgain.first().isVisible())) {
        await iyClearAgain.first().click()
        await iyPage.waitForTimeout(600)
      }
      await iyCloseConditions()
    } finally {
      await iyBrowser.close()
    }
  }


