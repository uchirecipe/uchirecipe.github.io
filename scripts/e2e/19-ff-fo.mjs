// ==========================================================================================
// e2e の節: 便FF（作った記録等）・使い方ページ・便FL〜FO
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
// この中の節: FF-COOK, FF-FILTER, FF-PANEL, FK-MANUAL, FL-01, FM-01, FN-01, KT-5, FO-01, FO-02, FO-03, FO-04, FO-05, FO-06, FO-07, FO-08, FO-09, GF-A, FO-10
// ==========================================================================================
import './_shared.mjs'


  // ============================================================================
  // 便FF(2026-08-10 オーナー実機フィードバック)。6件それぞれに検査を持つ。
  //  FF-COOK  : 「作った！」で食数を記録する（枠の食数＞設定「食数の設定」＞レシピの登録人数分）
  //  FF-FILTER: 絞り込みの区分分け・タグの件数併記・料理の種別での絞り込み（既存の絞り込みも全部残る）
  //  FF-PANEL : 並べ替え／絞り込みをスクロール途中で開いても位置が動かない（scrollYの実測）
  // ============================================================================

  // --- FF-COOK: 「作った！」押下時の食数を記録に残す（オーナー「作った！では基本的に、
  // 作った！押下時に設定されている食数を記録したい。設定がなければ個人設定に登録されている
  // 食数を自動で反映して」）。枠に決めた食数が最優先で、決めていない品は設定の人数になることを、
  // IndexedDBの記録を直接読んで確かめる ---
  currentCheck = 'FF-COOK'
  {
    const fcBrowser = await chromium.launch()
    const fcContext = await fcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fcPage = await fcContext.newPage()
    fcPage.on('dialog', (dialog) => dialog.accept())
    fcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FF-COOK] ${err.message}`)
    })
    /** 指定した料理の「作った記録」を新しい順で読む */
    const fcLogs = (title) =>
      fcPage.evaluate(async (t) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getAll = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
          getAll.onsuccess = () => resolve(getAll.result)
          getAll.onerror = () => reject(getAll.error)
        })
        idb.close()
        const hit = all.find((r) => r.title === t)
        return (hit?.cookedLogs ?? []).map((l) => ({ date: l.date, servings: l.servings ?? null }))
      }, title)
    /** レシピ詳細から「今日の献立に追加」して、食事を選ぶ／決めない */
    const fcAddToToday = async (title, slot) => {
      await fcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(900)
      await fcPage.getByText(title, { exact: true }).first().click()
      await fcPage.waitForTimeout(800)
      await fcPage.getByRole('button', { name: ja.detail.todayAdd }).first().click()
      await fcPage.waitForTimeout(500)
      await fcPage.getByRole('button', { name: slot, exact: true }).click()
      await fcPage.waitForTimeout(700)
    }
    try {
      await fcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(2000) // 初回シード完了待ち

      // 設定「食数の設定」を4人分にする（＝枠に食数を決めていない品の既定）
      await fcPage.goto(`${BASE}/#/settings?section=household`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(900)
      await fcPage.getByLabel(ja.settings.householdServingsTitle).selectOption('4')
      await fcPage.waitForTimeout(600)

      // ① 枠に食数を決めた品: 肉じゃがを今日の夕食に入れ、週の画面で食数を6人分にする
      await fcAddToToday('肉じゃが', '夕食')
      await fcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1500)
      await fcPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(fcPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await fcPage.waitForTimeout(900)
      // 2026-08-22 便IV: 食数のボタンは編集モードの中にしか出さない
      const fcToday = await fcPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'FF-COOK 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(fcPage, fcToday)) === true,
      )
      const fcServingsBtn = fcPage.getByRole('button', { name: 'この行の食数を変える（いま4人分）' })
      check(
        'FF-COOK 前提: 食数を決めていない枠は設定「食数の設定」の4人分で出る',
        (await fcServingsBtn.count()) >= 1,
        `count=${await fcServingsBtn.count()}`,
      )
      await fcServingsBtn.first().click()
      await fcPage.waitForTimeout(500)
      await fcPage.getByRole('button', { name: ja.mealPlan.servingsUp }).click()
      await fcPage.getByRole('button', { name: ja.mealPlan.servingsUp }).click()
      await fcPage.waitForTimeout(300)
      await fcPage.getByRole('button', { name: ja.mealPlan.servingsSave, exact: true }).click()
      await fcPage.waitForTimeout(800)
      check(
        'FF-COOK 前提: 枠の食数を6人分に変えられた',
        (await fcPage.getByRole('button', { name: 'この行の食数を変える（いま6人分）' }).count()) >= 1,
      )

      // ② 枠を決めない品: ほうれん草のおひたしを「決めない」で今日の献立へ
      await fcAddToToday('ほうれん草のおひたし', '朝食・昼食・夕食を決めずに今日の献立に追加')

      // 日の画面で1品ずつ「作った！」を押す
      await fcPage.goto(`${BASE}/#/meal-plan?focus=today`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1800)
      // 2026-08-20 便II・⑥: 行の「作った！」と説明の1行は整理モードの中に移った
      await openDayOrganize(fcPage)
      const fcCookedBtns = fcPage.getByRole('button', { name: '作った！', exact: true })
      check(
        'FF-COOK 前提: 日の画面に2品ぶんの「作った！」が並ぶ',
        (await fcCookedBtns.count()) === 2,
        `count=${await fcCookedBtns.count()}`,
      )
      await fcCookedBtns.first().click()
      await fcPage.waitForTimeout(1000)
      await fcPage
        .getByRole('button', { name: '作った！', exact: true })
        .first()
        .click()
      await fcPage.waitForTimeout(1200)

      const fcNikuLogs = await fcLogs('肉じゃが')
      const fcOhitashiLogs = await fcLogs('ほうれん草のおひたし')
      check(
        'FF-COOK 枠に決めた食数(6人分)がそのまま記録に残る',
        fcNikuLogs.length === 1 && fcNikuLogs[0].servings === 6,
        JSON.stringify(fcNikuLogs),
      )
      check(
        'FF-COOK 枠に食数が無い品は設定「食数の設定」の人数(4人分)が自動で入る',
        fcOhitashiLogs.length === 1 && fcOhitashiLogs[0].servings === 4,
        JSON.stringify(fcOhitashiLogs),
      )
      // 記録側の項目名は「◯人分」(便FDで確定。献立の「食数」と混同しない)
      await fcPage.goto(`${BASE}/#/history`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1200)
      const fcHistoryText = (await fcPage.textContent('body')) ?? ''
      check(
        'FF-COOK 「作った記録」の一覧に「6人分」「4人分」が出る',
        fcHistoryText.includes('6人分') && fcHistoryText.includes('4人分'),
      )

      // 食数が入っても「元に戻す」で取り消せる(便EHの二重記録・取り消し不能の再発防止)。
      // 日の画面へ戻ってもう1品作り、トーストの「元に戻す」で記録が消えることを見る
      await fcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(900)
      await fcAddToToday('豚汁', '朝食・昼食・夕食を決めずに今日の献立に追加')
      await fcPage.goto(`${BASE}/#/meal-plan?focus=today`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1600)
      // 2026-08-20 便II・⑥: 行の「作った！」は整理モードの中に移った
      await openDayOrganize(fcPage)
      await fcPage.getByRole('button', { name: '作った！', exact: true }).first().click()
      await fcPage.waitForTimeout(900)
      check(
        'FF-COOK 前提: 食数つきで記録が付く',
        (await fcLogs('豚汁')).length === 1,
        JSON.stringify(await fcLogs('豚汁')),
      )
      await fcPage.getByRole('button', { name: '元に戻す' }).first().click()
      await fcPage.waitForTimeout(1200)
      check(
        'FF-COOK 食数が入った記録もトーストの「元に戻す」で取り消せる',
        (await fcLogs('豚汁')).length === 0,
        JSON.stringify(await fcLogs('豚汁')),
      )
    } finally {
      await fcBrowser.close()
    }
  }

  // --- FF-FILTER: 絞り込みパネルの作り直し（オーナー「タグを羅列するなら、規則性が欲しい」
  // 「在庫の食材、NG食材隠しのタグ、登録したレシピのみ、が同列で並んでいるのもわかりにくくしている」
  // 「主菜副菜などでも絞り込みしたい」）。区分の見出しと並び・既存の絞り込みが1つも消えていないこと・
  // タグの件数併記・料理の種別での絞り込みを見る ---
  currentCheck = 'FF-FILTER'
  {
    const ffBrowser = await chromium.launch()
    const ffContext = await ffBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ffPage = await ffContext.newPage()
    ffPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FF-FILTER] ${err.message}`)
    })
    const ffCards = () => ffPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
    /** 見出し(p)の縦位置。パネルの中は縦に並ぶので、区分の並び順の判定に使う */
    const ffHeadTop = (text) =>
      ffPage.evaluate((t) => {
        const el = Array.from(document.querySelectorAll('p')).find(
          (n) => n.textContent?.trim() === t,
        )
        return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
      }, text)
    /** 見出しの直後の区分の中にあるボタンを押す(同名のボタンが他の区分にもあるため) */
    const ffClickIn = (heading, label) =>
      ffPage.evaluate(
        ([h, t]) => {
          const head = Array.from(document.querySelectorAll('p')).find(
            (n) => n.textContent?.trim() === h,
          )
          const btn = Array.from(head?.nextElementSibling?.querySelectorAll('button') ?? []).find(
            (b) => b.textContent?.trim() === t,
          )
          btn?.click()
          return !!btn
        },
        [heading, label],
      )
    try {
      // 「在庫の食材で絞る」チップを出すため、先に食材の在庫を1品「ある」にしておく
      await ffPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ffPage.waitForTimeout(2000)
      await ffPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await ffPage.waitForTimeout(700)
      await ffPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await ffPage.waitForTimeout(400)
      await ffPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ffPage.waitForTimeout(1200)
      const ffTotal = await ffCards()
      await ffPage.locator('button[aria-label="絞り込み"]').click()
      await ffPage.waitForTimeout(700)

      // ---------- 区分の見出しと並び ----------
      const ffOrder = {
        // 2026-08-19 便HU・⑫で「どのレシピから探すか」から改称
        レシピを絞り込む: await ffHeadTop('レシピを絞り込む'),
        料理の種別: await ffHeadTop('料理の種別'),
        [ja.search.tagTitle]: await ffHeadTop(ja.search.tagTitle),
        食材で絞り込む: await ffHeadTop('食材で絞り込む'),
        調理時間: await ffHeadTop('調理時間'),
        手間レベル: await ffHeadTop('手間レベル'),
      }
      const ffTops = Object.values(ffOrder)
      /* 2026-08-29 便MK: 「6つの区分」と言っている以上、6つ読めていることも同じ判定式で見る。
         **実測**: ffTops を空にすると、直す前は2件とも緑のままだった（何も測らずに合格）。 */
      const FF_SECTION_COUNT = 6
      check(
        'FF-FILTER 絞り込みが6つの区分に分かれ、それぞれに見出しが付いている',
        ffTops.length === FF_SECTION_COUNT && ffTops.every((v) => v != null),
        JSON.stringify(ffOrder),
      )
      check(
        `FF-FILTER 区分の並びが「レシピを絞り込む→料理の種別→${ja.search.tagTitle}→食材で絞り込む→調理時間→手間レベル」`,
        ffTops.length === FF_SECTION_COUNT &&
          ffTops.every((v, i) => i === 0 || (v != null && ffTops[i - 1] != null && ffTops[i - 1] < v)),
        JSON.stringify(ffOrder),
      )

      // ---------- 既存の絞り込みが1つも消えていない ----------
      const ffBody = (await ffPage.textContent('body')) ?? ''
      const ffKept = [
        'お気に入り',
        'NG食材を含むレシピを隠す',
        '自分で登録したレシピのみ',
        '在庫の食材で絞る',
        '使いたい食材',
        '食材の在庫から入れる',
        '時短レシピのみに絞る',
        '〜10分',
        '超簡単',
      ]
      const ffMissing = ffKept.filter((t) => !ffBody.includes(t))
      check(
        'FF-FILTER 作り直しても既存の絞り込みが1つも消えていない',
        ffMissing.length === 0,
        `見つからない=${JSON.stringify(ffMissing)}`,
      )

      // ---------- 「在庫の食材で絞る」が食材の区分に移り、母集団の区分から外れた ----------
      const ffPantryChipTop = await ffPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '在庫の食材で絞る',
        )
        return btn ? Math.round(btn.getBoundingClientRect().top + window.scrollY) : null
      })
      check(
        'FF-FILTER 「在庫の食材で絞る」が「食材で絞り込む」の中にある(お気に入り等と同列ではない)',
        ffPantryChipTop != null &&
          ffOrder['食材で絞り込む'] != null &&
          ffOrder['調理時間'] != null &&
          ffPantryChipTop > ffOrder['食材で絞り込む'] &&
          ffPantryChipTop < ffOrder['調理時間'],
        `在庫の食材で絞る=${ffPantryChipTop} 食材で絞り込む=${ffOrder['食材で絞り込む']} 調理時間=${ffOrder['調理時間']}`,
      )

      // ---------- タグは件数つきで多い順 ----------
      const ffTagChips = await ffPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="recipes-tag-chip"]')).map(
          (b) => b.textContent?.trim() ?? '',
        ),
      )
      const ffTagCounts = ffTagChips.slice(1).map((t) => Number(t.replace(/[^0-9]/g, '')))
      check(
        'FF-FILTER タグのチップに件数が付いている(並びの規則が画面から読める)',
        ffTagCounts.length >= 3 && ffTagCounts.every((n) => Number.isFinite(n) && n > 0),
        `チップ=${JSON.stringify(ffTagChips)}`,
      )
      check(
        'FF-FILTER タグは件数の多い順に並ぶ',
        ffTagCounts.every((n, i) => i === 0 || ffTagCounts[i - 1] >= n),
        `チップ=${JSON.stringify(ffTagChips)}`,
      )

      // ---------- 料理の種別で絞り込める ----------
      // 2026-08-19 便HU・⑬: 複数選べるようになったので、1区分ずつ測るときは
      // 毎回「すべて」に戻してから選ぶ(前に選んだ区分が残っていると足し算になる)
      const ffByType = {}
      for (const label of ['主菜', '副菜', '汁物', 'その他']) {
        await ffClickIn('料理の種別', 'すべて')
        await ffPage.waitForTimeout(200)
        check(`FF-FILTER 「料理の種別」に「${label}」がある`, await ffClickIn('料理の種別', label))
        await ffPage.waitForTimeout(400)
        ffByType[label] = await ffCards()
      }
      // 2026-08-19 便HU・⑬(オーナー「料理の種別については複数選択できても良いと思う」):
      // 2つ選ぶと、どちらかに当たる品が出る(和集合)。1つだけのときより必ず増える
      await ffClickIn('料理の種別', 'すべて')
      await ffPage.waitForTimeout(200)
      await ffClickIn('料理の種別', '主菜')
      await ffPage.waitForTimeout(300)
      await ffClickIn('料理の種別', '汁物')
      await ffPage.waitForTimeout(400)
      const ffMainSoup = await ffCards()
      check(
        'FF-FILTER(便HU⑬) 料理の種別を2つ選ぶと、どちらかに当たる品が出る(主菜＋汁物)',
        ffMainSoup === ffByType['主菜'] + ffByType['汁物'] && ffMainSoup < ffTotal,
        `主菜=${ffByType['主菜']} 汁物=${ffByType['汁物']} 主菜+汁物=${ffMainSoup} 全件=${ffTotal}`,
      )
      check(
        'FF-FILTER 主菜・副菜で件数がそれぞれ絞られる(0件でも全件でもない)',
        ffByType['主菜'] > 0 &&
          ffByType['主菜'] < ffTotal &&
          ffByType['副菜'] > 0 &&
          ffByType['副菜'] < ffTotal,
        `全件=${ffTotal} ${JSON.stringify(ffByType)}`,
      )
      check(
        'FF-FILTER 4区分を合わせるとちょうど全件になる(どの料理も必ずどれか1つに入る)',
        Object.values(ffByType).reduce((a, b) => a + b, 0) === ffTotal,
        `全件=${ffTotal} ${JSON.stringify(ffByType)}`,
      )
      // 「すべて」に戻せる＝絞り込みを外す手段がある
      await ffClickIn('料理の種別', 'すべて')
      await ffPage.waitForTimeout(400)
      check('FF-FILTER 「すべて」に戻すと全件に戻る', (await ffCards()) === ffTotal)

      // 一覧の上に重ねて出すぶん、一覧の上の件数の行はパネルに隠れる。
      // 代わりにパネルの中に件数を出し、条件を変えるたびに更新されることを見る
      const ffPanelCount = () =>
        ffPage.locator('[data-testid="filter-panel-count"]').first().innerText()
      check(
        'FF-FILTER パネルの中に数が出る(隠れた件数の行の代わり)',
        readTotalCount(await ffPanelCount()) === ffTotal,
        `表示=${await ffPanelCount()} 全体=${ffTotal}`,
      )

      // チップの件数は、実際に押したときの結果件数と一致する（数字が飾りになっていない）
      const ffTopTag = ffTagChips[1]
      await ffPage.locator('[data-testid="recipes-tag-chip"]').nth(1).click()
      await ffPage.waitForTimeout(500)
      check(
        'FF-FILTER チップの件数は押したときの結果件数と一致する',
        (await ffCards()) === Number(ffTopTag.replace(/[^0-9]/g, '')),
        `チップ=${ffTopTag} 結果=${await ffCards()}`,
      )
      const ffFilteredLabel = readResultCount(await ffPanelCount())
      check(
        'FF-FILTER パネルの中の数も絞り込みに追従する',
        ffFilteredLabel?.shown === (await ffCards()) && ffFilteredLabel?.total === ffTotal,
        `表示=${await ffPanelCount()} 結果=${await ffCards()} 全体=${ffTotal}`,
      )
      await ffPage.locator('[data-testid="recipes-tag-chip"]').first().click()
      await ffPage.waitForTimeout(400)

      // 数える対象は「いま一覧に出ているレシピ」。「自分で登録したレシピのみ」をONにすると
      // 自分のレシピだけで数え直され、該当が1つも無いときはタグの区分ごと出さない
      await ffPage.getByRole('button', { name: ja.search.myRecipesOnly, exact: true }).click()
      await ffPage.waitForTimeout(700)
      check(
        'FF-FILTER 「自分で登録したレシピのみ」ONだと自分のタグで数え直す(0件なら区分ごと出さない)',
        (await ffPage.locator('[data-testid="recipes-tag-chip"]').count()) === 0,
      )
      await ffPage.getByRole('button', { name: ja.search.clear }).first().click()
      await ffPage.waitForTimeout(700)
      check(
        'FF-FILTER 条件をクリアするとタグの区分が戻る',
        (await ffPage.locator('[data-testid="recipes-tag-chip"]').count()) === ffTagChips.length,
      )
    } finally {
      await ffBrowser.close()
    }
  }

  // --- FF-PANEL: 並べ替え／絞り込みを一覧の上に重ねて出す（オーナー「スクロール途中で開いても
  // 上に戻されないようにして。一覧の上に重ねて出現させる感じ？」）。
  // スクロール位置(window.scrollY)を開閉の前後で実測し、1pxも動かないことを見張る。
  // あわせて、貼り付く帯の裏に潜らない・下のタブナビと重ならない・画面からはみ出す長さのときは
  // パネルの中だけがスクロールすることも確かめる（便EO/便ETの位置合わせと干渉していない） ---
  currentCheck = 'FF-PANEL'
  {
    const fpBrowser = await chromium.launch()
    const fpContext = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fpPage = await fpContext.newPage()
    fpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FF-PANEL] ${err.message}`)
    })
    const fpY = () => fpPage.evaluate(() => Math.round(window.scrollY))
    const fpGeom = (testid) =>
      fpPage.evaluate((id) => {
        const panel = document.querySelector(`[data-testid="${id}"]`)
        const bar = document.querySelector('.recipes-searchbar')
        if (!panel || !bar) return null
        const p = panel.getBoundingClientRect()
        const b = bar.getBoundingClientRect()
        let navTop = window.innerHeight
        for (const el of document.querySelectorAll('[data-app-bottom-bar]')) {
          const r = el.getBoundingClientRect()
          if (r.height > 0) navTop = Math.min(navTop, r.top)
        }
        return {
          panelTop: Math.round(p.top),
          panelBottom: Math.round(p.bottom),
          barBottom: Math.round(b.bottom),
          navTop: Math.round(navTop),
          scrollsInside: panel.scrollHeight > panel.clientHeight + 1,
        }
      }, testid)
    try {
      await fpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(2000)

      // 一覧の途中まで送ってから開く
      await fpPage.evaluate(() => window.scrollTo(0, 1200))
      await fpPage.waitForTimeout(500)
      const fpBefore = await fpY()
      await fpPage.locator('button[aria-label="絞り込み"]').click()
      await fpPage.waitForTimeout(1200) // 開くアニメ(220ms)+位置合わせが走るなら十分な時間
      const fpAfterOpenFilter = await fpY()
      check(
        'FF-PANEL スクロール途中で絞り込みを開いても位置が動かない',
        fpBefore > 1000 && fpAfterOpenFilter === fpBefore,
        `開く前=${fpBefore} 開いた後=${fpAfterOpenFilter}`,
      )
      const fpFilterGeom = await fpGeom('recipes-filter-panel')
      check(
        'FF-PANEL 絞り込みパネルが貼り付く検索まどの裏に潜らない',
        fpFilterGeom != null && fpFilterGeom.panelTop >= fpFilterGeom.barBottom,
        JSON.stringify(fpFilterGeom),
      )
      check(
        'FF-PANEL 絞り込みパネルが下のタブナビと重ならない',
        fpFilterGeom != null && fpFilterGeom.panelBottom <= fpFilterGeom.navTop,
        JSON.stringify(fpFilterGeom),
      )
      check(
        'FF-PANEL 画面に収まらない長さはパネルの中だけがスクロールする',
        fpFilterGeom != null && fpFilterGeom.scrollsInside === true,
        JSON.stringify(fpFilterGeom),
      )
      // パネルの中を下までスクロールしても、後ろの一覧は動かない
      await fpPage.evaluate(() => {
        const el = document.querySelector('[data-testid="recipes-filter-panel"]')
        el.scrollTo(0, el.scrollHeight)
      })
      await fpPage.waitForTimeout(500)
      check(
        'FF-PANEL パネルの中を下まで送っても後ろの一覧は動かない',
        (await fpY()) === fpBefore,
        `開く前=${fpBefore} 送った後=${await fpY()}`,
      )
      await fpPage.locator('button[aria-label="絞り込み"]').click()
      await fpPage.waitForTimeout(900)
      check(
        'FF-PANEL 絞り込みを閉じても位置が動かない',
        (await fpY()) === fpBefore,
        `開く前=${fpBefore} 閉じた後=${await fpY()}`,
      )

      // 並べ替えも同じ
      await fpPage.locator('button[aria-label="並び替え"]').click()
      await fpPage.waitForTimeout(1200)
      const fpAfterOpenSort = await fpY()
      check(
        'FF-PANEL スクロール途中で並べ替えを開いても位置が動かない',
        fpAfterOpenSort === fpBefore,
        `開く前=${fpBefore} 開いた後=${fpAfterOpenSort}`,
      )
      const fpSortGeom = await fpGeom('recipes-sort-panel')
      check(
        'FF-PANEL 並べ替えパネルも帯の裏に潜らず、タブナビとも重ならない',
        fpSortGeom != null &&
          fpSortGeom.panelTop >= fpSortGeom.barBottom &&
          fpSortGeom.panelBottom <= fpSortGeom.navTop,
        JSON.stringify(fpSortGeom),
      )
      await fpPage.locator('button[aria-label="並び替え"]').click()
      await fpPage.waitForTimeout(900)
      check(
        'FF-PANEL 並べ替えを閉じても位置が動かない',
        (await fpY()) === fpBefore,
        `開く前=${fpBefore} 閉じた後=${await fpY()}`,
      )

      // 一覧の先頭で開いたときも、帯の裏に潜らず・タブナビと重ならない
      await fpPage.evaluate(() => window.scrollTo(0, 0))
      await fpPage.waitForTimeout(400)
      await fpPage.locator('button[aria-label="絞り込み"]').click()
      await fpPage.waitForTimeout(1200)
      const fpTopGeom = await fpGeom('recipes-filter-panel')
      check(
        'FF-PANEL 一覧の先頭で開いてもパネルが帯とタブナビの間に収まる',
        fpTopGeom != null &&
          fpTopGeom.panelTop >= fpTopGeom.barBottom &&
          fpTopGeom.panelBottom <= fpTopGeom.navTop,
        JSON.stringify(fpTopGeom),
      )
      check('FF-PANEL 一覧の先頭で開いてもページは動かない', (await fpY()) === 0, `y=${await fpY()}`)
    } finally {
      await fpBrowser.close()
    }
  }

  // --- FF-HOME は 2026-08-17 便HG で廃止した。
  // 測っていたのは「ホームの『今日の献立』から献立の画面へ行ける」ことだったが、
  // オーナー決定でホーム画面そのものを無くし、その「今日の献立」は行き先だった
  // 献立の「日」に合流した＝**同じ画面の中で自分自身へ行くリンク**になるため、
  // 測る対象が残っていない（機能を落としたのではなく、行き先と出発点が1つになった）。
  // 「日」に今日の献立が出ること・その画面へ着けることは NOHOME-01 と MEALPLAN-ROLE が見ている ---

  // ============================================================================
  // 便FK(2026-08-11): 調理中モード(並行調理ナビの段取り)の説明が使い方ページにあること。
  //
  // 2026-08-10に入れた4つ(色で手順を切り替える・「手順①へ」・他の品の「完成」・
  // タイマーの一時停止／再開)のうち、はじめの3つは説明書に記述そのものが無かった。
  // ここでは**画面の文言(src/i18n/ja.ts と src/logic/naviColors.ts の値)を読んで、
  // 同じ文字列が説明書に載っているか**を見る。ページ側に文字列を直書きして照合すると、
  // アプリの文言を変えたときに説明書だけが取り残されても誰も気づけない。
  // ============================================================================
  currentCheck = 'FK-MANUAL'
  {
    const fkJaSrc = readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')
    /** ja.ts の1階層目(cookNavi・focus など)の中身だけを切り出す(同じキー名の取り違え防止) */
    const fkSection = (name) => {
      const start = fkJaSrc.indexOf(`\n  ${name}: {`)
      if (start < 0) return ''
      const end = fkJaSrc.indexOf('\n  },', start)
      return end < 0 ? fkJaSrc.slice(start) : fkJaSrc.slice(start, end)
    }
    const fkCookNavi = fkSection('cookNavi')
    const fkFocus = fkSection('focus')
    /** `key: '値',` の値を取り出す(1行のシングルクォート文字列だけを見る) */
    const fkValue = (src, key) => {
      const m = src.match(new RegExp(`^\\s*${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, 'm'))
      return m ? m[1] : undefined
    }
    const fkColorsSrc = readFileSync(path.join(appRoot, 'src/logic/naviColors.ts'), 'utf-8')
    const fkColorWords = (
      fkColorsSrc.match(/NAVI_COLOR_WORDS\s*=\s*\[([^\]]*)\]/)?.[1] ?? ''
    )
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean)

    const fkManual = await (await page.request.get(`${BASE}/about/manual.html`)).text()
    check(
      'FK-MANUAL 使い方ページを取得できた',
      fkManual.includes('うちレシピの使い方'),
      `長さ=${fkManual.length}`,
    )
    check(
      'FK-MANUAL 前提: 画面の文言を ja.ts / naviColors.ts から読めた',
      fkColorWords.length === 3 && fkValue(fkCookNavi, 'sessionToFirst') !== undefined,
      `色=${fkColorWords.join('/')} 手順へ=${fkValue(fkCookNavi, 'sessionToFirst')}`,
    )

    // --- 画面にそのまま出る文言(そのまま載っていること) ---
    for (const [label, text] of [
      ['調理中モードの入口', fkValue(fkCookNavi, 'sessionStart')],
      ['閉じたあとの入口', fkValue(fkCookNavi, 'sessionResume')],
      ['他のレシピの次の手順の見出し', fkValue(fkCookNavi, 'sessionOthersTitle')],
      ['最後の手順のボタン', fkValue(fkFocus, 'complete')],
    ]) {
      check(
        `FK-MANUAL 説明書に「${text}」がある（${label}）`,
        typeof text === 'string' && text.length > 0 && fkManual.includes(text),
        String(text),
      )
    }

    // --- 差し込み({n}など)のある文言は、埋めた形で載っていること ---
    const fkToFirst = (fkValue(fkCookNavi, 'sessionToFirst') ?? '').replace('{n}', '①')
    check(
      `FK-MANUAL 説明書に左上のボタン「${fkToFirst}」がある（便FC）`,
      fkToFirst.length > 1 && fkManual.includes(fkToFirst),
      fkToFirst,
    )
    const fkCounter = (fkValue(fkCookNavi, 'sessionCounter') ?? '')
      .replace('{n}', '◯')
      .replace('{t}', '◯')
    check(
      `FK-MANUAL 説明書に段取りの位置の表示「${fkCounter}」がある`,
      fkCounter.length > 1 && fkManual.includes(fkCounter),
      fkCounter,
    )

    // --- 他の品の「完成」(便FC)。「完成」だけだと他の説明にも当たるので、
    //     説明書の文（作り終えた品の行）とセットで見る ---
    const fkDone = fkValue(fkCookNavi, 'recipeDone') ?? ''
    check(
      `FK-MANUAL 説明書に作り終えた品の印「${fkDone}」の説明がある（便FC）`,
      fkDone.length > 0 &&
        fkManual.includes(`料理名の横に<strong>「${fkDone}」</strong>が付いた1行`),
      fkDone,
    )

    // --- 色で手順を切り替える(便FI) ---
    for (const word of fkColorWords) {
      check(
        `FK-MANUAL 説明書に色の名前「${word}」が載っている（便FI）`,
        fkManual.includes(`「${word}」`),
        word,
      )
    }
    check(
      'FK-MANUAL 説明書でも「赤」で案内しない（実装の色は青・緑・ピンク）',
      !/「赤」/.test(fkManual),
    )
    check(
      'FK-MANUAL 説明書に「手順は飛ばされません」と書いてある（引き寄せの誤解を防ぐ）',
      fkManual.includes('手順は飛ばされません'),
    )
    check(
      'FK-MANUAL 説明書に、開いていた手順が1つ後ろに下がる（消えない）ことが書いてある',
      fkManual.includes('開いていた手順は1つ後ろに下がり'),
    )
    // 行き先が無いときの短い文（3種類とも、画面の言い方のまま載っていること）
    for (const [key, filled] of [
      ['sessionColorCurrent', ['{title}', '◯◯']],
      ['sessionColorDone', ['{title}', '◯◯']],
      ['sessionColorMissing', ['{color}', '◯◯']],
    ]) {
      const text = (fkValue(fkCookNavi, key) ?? '').replace(filled[0], filled[1])
      check(
        `FK-MANUAL 説明書に移れないときの案内「${text}」がある`,
        text.length > 2 && fkManual.includes(text),
        text,
      )
    }
    check(
      'FK-MANUAL 説明書に、色は発話まるごとが一致したときだけ働くことが書いてある',
      fkManual.includes('青ねぎ'),
    )

    // --- 1品の調理中モード(§8)から、色の説明へ辿れる ---
    check(
      'FK-MANUAL §8の声の案内から色の節（#cooknavi-color）へ辿れる',
      fkManual.includes('href="#cooknavi-color"') && fkManual.includes('id="cooknavi-color"'),
    )
    // --- タイマーの一時停止／再開は便FCで既に載っている（消えていないこと） ---
    check(
      'FK-MANUAL 声の「ストップ」「再開」の説明が残っている（便FC）',
      fkManual.includes('動いているタイマーを1本、一時停止します') &&
        fkManual.includes('一時停止したタイマーを動かし直します'),
    )
    check(
      'FK-MANUAL 「タイマーを消す」は指で押す操作として書いてある（声では受けない）',
      fkManual.includes('タイマーを消す操作は、声では受け付けません') &&
        fkManual.includes('タイマーそのものを片付けるときは「タイマーを消す」'),
    )
  }

  // --- FL-01〜04: 段取りの時間の数え方と、2つの画面の並びの食い違い(2026-08-11 便FL) ---
  //     FL-01 「冷蔵庫で半日〜一晩漬ける」を「約20分の待ち時間」と数えない(長い待ちとして
  //           全体の目安から外し、外していることを画面に書く)
  //     FL-02 同じ手順の並びが段取りの一覧と調理中モードで同じ(本文→注意書き→材料→待ちブロック)
  //     FL-03 調理中モードにも「この間に、次の手作業を進められます」が出る
  //     FL-04 括弧内の任意の記述(「レンジで加熱すると時短」)を手順の主たる動作にしない
  currentCheck = 'FL-01'
  {
    const flBrowser = await chromium.launch()
    const flContext = await flBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const flPage = await flContext.newPage()
    flPage.on('dialog', (d) => void d.accept())
    flPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FL] ${err.message}`)
    })
    flPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FL] ${t}`)
    })
    try {
      await flPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await flPage.waitForTimeout(1800)
      await flPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('FL味玉', [
          { text: '卵を沸騰したお湯で10分ゆでる。', minutes: 10 },
          { text: 'ゆで上がったらすぐ冷水にとり、粗熱が取れたら殻をむく。' },
          { text: '保存袋にめんつゆと水、殻をむいた卵を入れて空気を抜き、冷蔵庫で半日〜一晩漬ける。', memo: '漬け時間が長いほど中まで味がしみる。' },
        ], [{ name: '卵', amount: '4', unit: '個' }])))
        const idB = await P(store('recipes').add(mk('FL煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15, memo: '落としぶたをすると味がしみやすい。' },
          { text: '火を止めて器に盛る。' },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('FLキャベツ丼', [
          { text: 'キャベツをせん切りにする（レンジ600Wで1分半ほど加熱すると時短になる）。' },
          { text: '油を切ったツナとキャベツをボウルであえる。' },
          { text: 'ご飯にのせて白ごまを振る。' },
        ], [{ name: 'キャベツ', amount: '2', unit: '枚' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })

      await flPage.goto(`${BASE}/#/cook-navi`)
      await flPage.reload({ waitUntil: 'networkidle' })
      await flPage.waitForTimeout(1200)
      await flPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await flPage.waitForTimeout(800)

      // 手順本文は文節の切れ目にゼロ幅スペースが入る(ja-phrase)。突き合わせる前に必ず取り除く
      const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
      const sessionText = async () => noZw(await flPage.textContent('[data-testid="cook-session"]'))
      const longCard = flPage.locator('ol > li', { hasText: '半日〜一晩漬ける' })
      check(
        'FL-01 「半日〜一晩漬ける」の手順は段取りに残る(黙って消さない)',
        (await longCard.count()) === 1,
        `件数=${await longCard.count()}`,
      )
      const longText = noZw(await longCard.first().innerText())
      check(
        'FL-01 「約20分の待ち時間」と数えない',
        !longText.includes('約20分の待ち時間') && longText.includes('長い待ち時間'),
        `カード=${longText.replace(/\n/g, ' / ')}`,
      )
      check(
        'FL-01 段取りから外していることを画面に書く',
        longText.includes(ja.cookNavi.longRestNote),
        `カード=${longText.replace(/\n/g, ' / ')}`,
      )
      check(
        'FL-01 長い待ちには「この間に、次の手作業を進められます」を出さない',
        !longText.includes(ja.cookNavi.waitFillHint),
        `カード=${longText.replace(/\n/g, ' / ')}`,
      )
      check(
        'FL-01 「手順に時間の記載がないため、この分数は目安です」も出さない(分数自体を出さないため)',
        !longText.includes(ja.cookNavi.waitEstimatedNote),
        `カード=${longText.replace(/\n/g, ' / ')}`,
      )

      // FL-04 括弧内の任意の記述を主たる動作にしない(「切る」が待ち2分にならない)
      const cabbageCard = flPage.locator('ol > li', { hasText: 'キャベツをせん切りにする' })
      const cabbageText = noZw(await cabbageCard.first().innerText())
      check(
        'FL-04 括弧内の「レンジで加熱すると時短」を待ちにしない(手を動かす工程のまま)',
        !cabbageText.includes('待ち時間') && cabbageText.includes('手を動かす'),
        `カード=${cabbageText.replace(/\n/g, ' / ')}`,
      )

      // FL-02 段取りの一覧での並び(本文→注意書き→材料→待ちブロック)
      const listOrder = await flPage.evaluate(() => {
        const li = Array.from(document.querySelectorAll('ol > li')).find((el) =>
          (el.textContent ?? '').replace(/\u200B/g, '').includes('鍋に大根とだしを入れて中火で15分煮る'),
        )
        if (!li) return null
        const y = (sel) => {
          const el = li.querySelector(sel)
          return el ? Math.round(el.getBoundingClientRect().top) : null
        }
        return {
          text: y('[data-testid="navi-step-text"]'),
          memo: y('[data-testid="navi-step-memo"]'),
          ingredients: y('[data-testid="navi-step-ingredients"]'),
          wait: y('[data-testid="navi-wait-block"]'),
        }
      })
      check(
        'FL-02 段取りの一覧の並びは 本文→注意書き→材料→待ちブロック',
        listOrder != null &&
          listOrder.text != null &&
          listOrder.text < listOrder.memo &&
          listOrder.memo < listOrder.ingredients &&
          listOrder.ingredients < listOrder.wait,
        JSON.stringify(listOrder),
      )

      // 調理中モードへ。同じ手順まで「次へ」で進む
      await flPage.locator('[data-testid="cook-session-start"]').click()
      await flPage.waitForTimeout(600)
      let reached = false
      for (let i = 0; i < 14; i++) {
        if ((await sessionText()).includes('鍋に大根とだしを入れて中火で15分煮る')) { reached = true; break }
        if ((await flPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await flPage.locator('[data-testid="cook-session-next"]').click()
        await flPage.waitForTimeout(250)
      }
      check('FL-02 調理中モードで同じ手順まで進める', reached)
      const sessionOrder = await flPage.evaluate(() => {
        const root = document.querySelector('[data-testid="cook-session"]')
        if (!root) return null
        const y = (sel) => {
          const el = root.querySelector(sel)
          return el ? Math.round(el.getBoundingClientRect().top) : null
        }
        return {
          text: y('[data-testid="cook-session-step-text"]'),
          memo: y('[data-testid="cook-session-memo"]'),
          ingredients: y('[data-testid="cook-session-ingredients"]'),
          wait: y('[data-testid="cook-session-wait-block"]'),
        }
      })
      check(
        'FL-02 調理中モードの並びも 本文→注意書き→材料→待ちブロック(2画面で同じ)',
        sessionOrder != null &&
          sessionOrder.text != null &&
          sessionOrder.text < sessionOrder.memo &&
          sessionOrder.memo < sessionOrder.ingredients &&
          sessionOrder.ingredients < sessionOrder.wait,
        JSON.stringify(sessionOrder),
      )
      check(
        'FL-03 調理中モードの待ち工程に「この間に、次の手作業を進められます」が出る',
        (await flPage.locator('[data-testid="cook-session-fill-hint"]').count()) === 1 &&
          ((await flPage.textContent('[data-testid="cook-session-fill-hint"]')) ?? '').includes(ja.cookNavi.waitFillHint),
      )
      // 長い待ちの手順まで進めて、調理中モードでも同じ扱いになることを見る
      let reachedLong = false
      for (let i = 0; i < 14; i++) {
        if ((await sessionText()).includes('半日〜一晩漬ける')) { reachedLong = true; break }
        if ((await flPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await flPage.locator('[data-testid="cook-session-next"]').click()
        await flPage.waitForTimeout(250)
      }
      const longSession = await sessionText()
      check(
        'FL-01 調理中モードでも「約20分の待ち時間」と出さず、外していることを書く',
        reachedLong &&
          !longSession.includes('約20分の待ち時間') &&
          longSession.includes('長い待ち時間') &&
          longSession.includes(ja.cookNavi.longRestNote),
        `本文=${longSession.slice(0, 200).replace(/\n/g, ' / ')}`,
      )
      // FL-05 長い待ちで終わる品に「完成」を出さない（司令部裁定）
      check(
        'FL-05 調理中モードの長い待ちの手順に「完成」を出さない',
        reachedLong &&
          (await flPage.locator('[data-testid="cook-session-recipe-done"]').count()) === 0 &&
          (await flPage.locator('[data-testid="cook-session-recipe-long-rest-done"]').count()) === 1 &&
          ((await flPage.textContent('[data-testid="cook-session-recipe-long-rest-done"]')) ?? '') ===
            'あとは待つだけ',
      )
      // 最後の手順まで送ると、作り終えた品の行に印が出る（味玉＝長い待ちで終わる品）。
      // 上限は「進めなくなるまで」の保険であって手順数の見込みではない。
      // 14固定にしていたため、便GD（1手順を手作業と待ちに分ける）で段取りが伸びた瞬間に
      // 最後まで届かなくなり、味玉の行が出ないまま判定が落ちていた（2026-08-13）
      for (let i = 0; i < 60; i++) {
        if ((await flPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await flPage.locator('[data-testid="cook-session-next"]').click()
        await flPage.waitForTimeout(250)
      }
      const otherRows = await flPage.locator('[data-testid="cook-session-other-row"]').allInnerTexts()
      // 味玉が「他の品」に並ぶか、いま開いている品そのものかは段取りの並びで変わる
      // （便GDで1手順を手作業と待ちに分けたら、最後に開く品が味玉になった）。
      // 見たいのは置き場所ではなく「長い待ちで終わる品に『完成』と言わないこと」なので、
      // どちらに出ていても同じ判定になる形にする（2026-08-13）
      const flCurrentTitle = noZw(
        (await flPage.textContent('[data-testid="cook-session-recipe"]')) ?? '',
      )
      const flMitamaRow = otherRows.map(noZw).find((t) => t.includes('FL味玉'))
      const flMitamaLongRest =
        flMitamaRow != null
          ? flMitamaRow.includes('あとは待つだけ') && !flMitamaRow.includes('完成')
          : flCurrentTitle.includes('FL味玉') &&
            (await flPage.locator('[data-testid="cook-session-recipe-long-rest-done"]').count()) ===
              1 &&
            (await flPage.locator('[data-testid="cook-session-recipe-done"]').count()) === 0
      check(
        'FL-05 「他の品の次の手順」でも、長い待ちで終わる品は「完成」と言わない',
        flMitamaLongRest,
        JSON.stringify({
          いま開いている品: flCurrentTitle,
          他の品: otherRows.map((t) => noZw(t).replace(/\n/g, ' / ')),
        }),
      )
      check(
        'FL-05 長い待ちで終わらない品は今までどおり「完成」',
        otherRows.some((t) => noZw(t).includes('FLキャベツ丼') && noZw(t).includes('完成')),
        JSON.stringify(otherRows.map((t) => noZw(t).replace(/\n/g, ' / '))),
      )
      // 段取りの一覧に戻って、同じ言い分けになっていることを見る
      await flPage.locator('[data-testid="cook-session-close"]').click()
      await flPage.waitForTimeout(700)
      const doneBadges = await flPage.locator('[data-testid="navi-recipe-done"]').allInnerTexts()
      const longDoneBadges = await flPage
        .locator('[data-testid="navi-recipe-long-rest-done"]')
        .allInnerTexts()
      check(
        'FL-05 段取りの一覧でも、長い待ちで終わる品だけ「あとは待つだけ」になる',
        longDoneBadges.length === 1 &&
          longDoneBadges[0] === 'あとは待つだけ' &&
          doneBadges.length === 2 &&
          doneBadges.every((t) => t === '完成'),
        `完成=${JSON.stringify(doneBadges)} / 長い待ち=${JSON.stringify(longDoneBadges)}`,
      )
      const longCard2 = flPage.locator('ol > li', { hasText: '半日〜一晩漬ける' })
      check(
        'FL-05 長い待ちのカードに「完成」の文字が残っていない',
        !noZw(await longCard2.first().innerText()).includes('完成'),
        noZw(await longCard2.first().innerText()).replace(/\n/g, ' / '),
      )
    } finally {
      await flBrowser.close()
    }
  }

  // --- FM-00〜09: レシピ本体のメモが並行調理ナビに1行も出ていなかった(2026-08-11 便FM) ---
  //     レシピ詳細では出ている recipe.memo が、段取りの一覧にも調理中モードにも描かれておらず、
  //     同梱109品中94品が持つ交差汚染・火通し・保存の注記が並行調理でだけ消えていた。
  //     全手順に出すと読み飛ばされるので、行の中身で寄せ先を決めて1手順に1回だけ出す。
  currentCheck = 'FM-01'
  {
    const fmBrowser = await chromium.launch()
    const fmContext = await fmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fmPage = await fmContext.newPage()
    fmPage.on('dialog', (d) => void d.accept())
    fmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FM] ${err.message}`)
    })
    fmPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FM] ${t}`)
    })
    try {
      // 同梱の基本レシピ(親子丼・ほうれん草のおひたし)を今日の献立に入れる。
      // 3品目は**メモを持たない自作レシピ**＝ユーザー登録のレシピで壊れないことも同時に見る
      await fmPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fmPage.waitForTimeout(2000)
      const seeded = await fmPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const all = await P(store('recipes').getAll())
        const found = []
        let addedAt = Date.now()
        for (const title of ['親子丼', 'ほうれん草のおひたし']) {
          const recipe = all.find((r) => r.title === title)
          if (!recipe) continue
          found.push(title)
          await P(store('todayList').add({ recipeId: recipe.id, addedAt: addedAt++ }))
        }
        const ownId = await P(store('recipes').add({
          title: 'FMメモ無し副菜', servings: 2, effortLevel: 'normal', tags: [], isFavorite: false,
          cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
          ingredients: [{ name: 'キャベツ', amount: '2', unit: '枚' }],
          steps: [{ text: 'キャベツをせん切りにする。' }, { text: '塩昆布とごま油であえる。' }],
        }))
        await P(store('todayList').add({ recipeId: ownId, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return found
      })
      check('FM-00 同梱の親子丼・ほうれん草のおひたしを今日の献立に入れられた', seeded.length === 2, JSON.stringify(seeded))

      await fmPage.goto(`${BASE}/#/cook-navi`)
      await fmPage.reload({ waitUntil: 'networkidle' })
      await fmPage.waitForTimeout(1200)
      await fmPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fmPage.waitForTimeout(800)

      const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
      // オーナー報告の実文（親子丼の本体メモ）。この1文が画面に出ることが今回の合格条件
      const WASH = '生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。'
      const HEAT = '卵は半熟で仕上げるので、お子様・高齢者・妊娠中の方や体調に不安があるときは、完全に火を通すこと。'
      const KEEP = '清潔な保存容器に入れて早めに冷蔵庫へ入れ、冷蔵庫で2日ほどで食べ切ること。'

      // 突き合わせは innerText ではなく textContent で行う。メモの1文は画面上で
      // 文節の切れ目から折り返されるため、innerText には「、」の位置に改行が入り、
      // 原文どおりの1文としては一致しない（見えている文字は同じ）
      const cardTexts = (
        await fmPage.locator('ol > li').evaluateAll((els) => els.map((el) => el.textContent))
      ).map(noZw)
      check(
        'FM-01 段取りの一覧にレシピ本体の注意書きが出る（親子丼の「生の鶏肉に…洗うこと。」）',
        cardTexts.some((t) => t.includes(WASH)),
        `カード数=${cardTexts.length}`,
      )
      check(
        'FM-02 その行が出るのは生の鶏肉を扱う手順1枚だけ（全手順には出さない）',
        cardTexts.filter((t) => t.includes(WASH)).length === 1 &&
          cardTexts.find((t) => t.includes(WASH))?.includes('鶏肉は一口大'),
        cardTexts.find((t) => t.includes(WASH))?.replace(/\n/g, ' / '),
      )
      check(
        'FM-03 火通しの行は卵を入れる手順に出る',
        cardTexts.filter((t) => t.includes(HEAT)).length === 1 &&
          cardTexts.find((t) => t.includes(HEAT))?.includes('溶き卵'),
        cardTexts.find((t) => t.includes(HEAT))?.replace(/\n/g, ' / '),
      )
      check(
        'FM-04 保存の行はその品の最後の手順（完成の印が出る手順）に出る',
        cardTexts.filter((t) => t.includes(KEEP)).length === 1 &&
          cardTexts.find((t) => t.includes(KEEP))?.includes('完成'),
        cardTexts.find((t) => t.includes(KEEP))?.replace(/\n/g, ' / '),
      )
      check(
        'FM-05 本体のメモが無い自作レシピの手順には「レシピのメモ」の枠を出さない',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）（手順の文が変わって0件になると、枠が出ていても緑になる）
        (() => {
          const rows = cardTexts.filter(
            (t) => t.includes('キャベツをせん切りにする') || t.includes('塩昆布とごま油であえる'),
          )
          return rows.length > 0 && rows.every((t) => !t.includes('レシピのメモ'))
        })(),
        JSON.stringify(
          cardTexts.filter((t) => t.includes('塩昆布とごま油であえる')).map((t) => t.replace(/\n/g, ' / ')),
        ),
      )

      // 調理中モードでも同じ行が同じ手順に出る（2画面で1つの割り当てを共有している）
      await fmPage.locator('[data-testid="cook-session-start"]').click()
      await fmPage.waitForTimeout(600)
      // いま大きく出している手順だけを見る（画面下部の「他の品の次の手順」にも
      // 手順本文が出るので、画面全体の文字で位置を判定すると先頭で止まってしまう）
      const currentStep = async () =>
        noZw(await fmPage.textContent('[data-testid="cook-session-step-text"]'))
      /**
       * 調理中モードのレシピ本体のメモ。
       * 2026-08-26 便LG・オーナー原文「レシピのメモがスクロール付きの細いスペースにあるが、
       * スクロールするよりはタップで窓出した方が読みやすい。手順ないには「レシピのメモ」だけ
       * 表示。」で、手順カードには見出しだけの入口が出るようになった。**中身は窓を開いて読む**。
       * 入口が無ければメモも無い（＝今までどおり空文字を返す）
       */
      const sessionNote = async () => {
        if ((await fmPage.locator('[data-testid="cook-session-recipe-memo"]').count()) === 0) return ''
        await fmPage.locator('[data-testid="cook-session-recipe-memo"]').click()
        await fmPage.waitForTimeout(300)
        const text = noZw(
          await fmPage.textContent('[data-testid="cook-session-recipe-memo-modal"]'),
        )
        await fmPage.locator('[data-testid="cook-session-recipe-memo-close"]').click()
        await fmPage.waitForTimeout(250)
        return text
      }
      check(
        'FM-06 調理中モードの先頭（湯を沸かす）にはレシピ本体のメモを出さない',
        (await sessionNote()) === '',
        `手順=${await currentStep()}`,
      )
      // 「他の品の次の手順」を開いたときも、その手順に付いた行が読める。
      // 先頭の位置では親子丼の次の手順が「鶏肉は一口大…」＝洗う行が付いた手順なので、
      // まだそこへ進んでいなくても、のぞいた時点で読めることを見る
      let peeked = ''
      const otherRows = fmPage.locator('[data-testid="cook-session-other-row"]')
      for (let j = 0; j < (await otherRows.count()); j++) {
        await otherRows.nth(j).click()
        await fmPage.waitForTimeout(350)
        if ((await fmPage.locator('[data-testid="cook-session-peek-recipe-memo"]').count()) > 0) {
          peeked = noZw(await fmPage.textContent('[data-testid="cook-session-peek-recipe-memo"]'))
          await otherRows.nth(j).click()
          await fmPage.waitForTimeout(200)
          break
        }
        await otherRows.nth(j).click()
        await fmPage.waitForTimeout(150)
      }
      check(
        'FM-07 他の品の次の手順を開くと、その手順のレシピ本体のメモも読める',
        peeked.includes(WASH),
        `のぞき見=${peeked}`,
      )
      let reachedWash = false
      for (let i = 0; i < 16; i++) {
        if ((await currentStep()).includes('鶏肉は一口大')) { reachedWash = true; break }
        if ((await fmPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await fmPage.locator('[data-testid="cook-session-next"]').click()
        await fmPage.waitForTimeout(250)
      }
      const washNote = await sessionNote()
      check(
        'FM-08 調理中モードでも「生の鶏肉に…洗うこと。」が出る（生の鶏肉を扱う手順で）',
        reachedWash && washNote.includes(WASH),
        `手順=${await currentStep()} / メモ=${washNote}`,
      )
      let reachedHeat = false
      for (let i = 0; i < 16; i++) {
        if ((await currentStep()).includes('溶き卵')) { reachedHeat = true; break }
        if ((await fmPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await fmPage.locator('[data-testid="cook-session-next"]').click()
        await fmPage.waitForTimeout(250)
      }
      const heatNote = await sessionNote()
      check(
        'FM-09 調理中モードで火通しの行は卵を入れる手順に出る（洗う行はもう出ていない）',
        reachedHeat && heatNote.includes(HEAT) && !heatNote.includes(WASH),
        `手順=${await currentStep()} / メモ=${heatNote}`,
      )
    } finally {
      await fmBrowser.close()
    }
  }

  // --- FN-01〜04: 実際にアプリを操作した利用者テストで見つかったバグ(2026-08-11 便FN) ---
  //     FN-01 「全て作った！」のあと、同じレシピを今日の献立に戻せる(報告の再現手順そのまま)
  //     FN-02 同じ「待ち」の枠なら、どの手順でも「タイマーを始める」で操作できる
  //     FN-03 タイマーの帯が何本出ても、下のボタン・リンクが帯に隠れない(390px実測)
  //     FN-04 段取りの分数の内訳と、レシピの「調理時間」と数え方が違うことが画面に出る
  currentCheck = 'FN-01'
  {
    const fnBrowser = await chromium.launch()
    // 手順本文は文節の切れ目にゼロ幅スペースが入る(ja-phrase)。突き合わせる前に取り除く
    const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
    const watchPage = (p, tag) => {
      p.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@${tag}] ${err.message}`)
      })
      p.on('console', (msg) => {
        if (msg.type() !== 'error') return
        const t = msg.text()
        if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
        errors.push(`[console@${tag}] ${t}`)
      })
    }
    try {
      // ===== FN-01: 「全て作った！」→ 同じレシピを今日の夕食へ戻せる（実操作） =====
      {
        const ctx = await fnBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FN-01')
        let confirmText = ''
        await collectConfirms(p, (text) => {
          confirmText = text
        })
        const TITLES = ['肉じゃが', 'カレーライス', '豆腐とわかめの味噌汁']
        /** レシピ一覧から1品開いて「今日の献立に追加」→「夕食」を押す（利用者の操作そのまま） */
        const addToDinner = async (title) => {
          await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await p.waitForTimeout(500)
          await p.getByText(title, { exact: true }).first().click()
          await p.waitForTimeout(600)
          await p.getByRole('button', { name: ja.detail.todayAdd }).click()
          await p.waitForTimeout(300)
          await p.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).click()
          await p.waitForTimeout(500)
          return (await p.textContent('body')) ?? ''
        }

        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1800) // 初回シード待ち
        for (const title of TITLES) await addToDinner(title)

        await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(800)
        const beforeBody = (await p.textContent('body')) ?? ''
        check(
          'FN-01 前提: 今日の献立(日)に3品が並ぶ',
          TITLES.every((t) => beforeBody.includes(t)),
        )

      // 2026-08-20 便II・⑥: 「全て作った！」は整理モードの中に移った
        await openDayOrganize(p)
        await p.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked }).click()
        await p.waitForTimeout(900)
        check(
          'FN-01 確認文に「週の献立に残る」ことが書いてある(規約F)',
          confirmText.includes(ja.mealPlan.todayMarkAllCookedKept.split('。')[1]),
          `confirm=${JSON.stringify(confirmText)}`,
        )
        const afterAll = (await p.textContent('body')) ?? ''
        check(
          'FN-01 前提: 「3件の作った記録をつけました」が出て今日の献立が空になる',
          // 2026-08-17 便HI: 空の日は「今日の献立」の見出しごと出さないので、そちらで測る
          afterAll.includes('3件の作った記録をつけました') &&
            (await p.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
        )

        // ここが報告のバグ: 空なのに「今日の夕食にすでに入っています」と断られ、何も追加されなかった
        const restoredToasts = []
        for (const title of TITLES) restoredToasts.push(await addToDinner(title))
        /* 2026-08-29 便MK: 3品ぶんの知らせを集められていることを、同じ判定式に入れた。
           **実測**: restoredToasts を空にすると、直す前は2件とも緑のままだった。 */
        check(
          'FN-01 作った品を同じ夕食へ入れ直すと「すでに入っています」で断られない',
          restoredToasts.length === TITLES.length &&
            restoredToasts.every((t) => !t.includes('今日の夕食にすでに入っています')),
        )
        check(
          'FN-01 入れ直したことと、記録が残ることを知らせる',
          restoredToasts.length === TITLES.length &&
            restoredToasts.every((t) =>
              t.includes('今日の夕食に戻しました（作った記録はそのまま残ります）'),
            ),
        )

        await p.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(900)
        const restoredBody = (await p.textContent('body')) ?? ''
        check(
          'FN-01 今日の献立(日)に3品とも戻っている',
          TITLES.every((t) => restoredBody.includes(t)) &&
            (await p.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 1,
        )
        check('FN-01 並行調理ナビの入口も戻る(2品以上あるため)', restoredBody.includes('並行調理ナビ'))

        // 予定の行は増えていない（週タブで同じ品が2行に並ばない）＋作った記録は消えていない
        const state = await p.evaluate(async () => {
          const openDb = () =>
            new Promise((resolve, reject) => {
              const r = indexedDB.open('uchi-recipe')
              r.onsuccess = () => resolve(r.result)
              r.onerror = () => reject(r.error)
            })
          const db = await openDb()
          const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
          const plans = await P(db.transaction('mealPlans').objectStore('mealPlans').getAll())
          const recipes = await P(db.transaction('recipes').objectStore('recipes').getAll())
          const today = new Date()
          const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          const titles = ['肉じゃが', 'カレーライス', '豆腐とわかめの味噌汁']
          const ids = recipes.filter((r) => titles.includes(r.title)).map((r) => r.id)
          db.close()
          return {
            dinnerRows: plans.filter((e) => e.date === iso && e.slot === 'dinner' && ids.includes(e.recipeId)).length,
            cookedCount: recipes
              .filter((r) => ids.includes(r.id))
              .filter((r) => (r.cookedLogs ?? []).some((l) => l.date === iso)).length,
          }
        })
        check(
          'FN-01 入れ直しで予定の行は増えない(同じ品が2行にならない)',
          state.dinnerRows === 3,
          `dinnerRows=${state.dinnerRows}`,
        )
        check('FN-01 作った記録は消えない(3品とも今日の記録が残る)', state.cookedCount === 3, `cooked=${state.cookedCount}`)
        await ctx.close()
      }

      // ===== FN-02〜04: 並行調理ナビ（待ちのタイマー・帯の下余白・分数の内訳） =====
      {
        const ctx = await fnBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        watchPage(p, 'FN-02')
        p.on('dialog', (d) => void d.accept())
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1800)
        // 報告と同じ顔ぶれ: 本文に分数が書かれた待ち／時間の書かれていない待ち／分数つきの待ち
        await p.evaluate(async () => {
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
            title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps, cookMinutes: 10,
            isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
          })
          const ids = []
          ids.push(await P(store('recipes').add(mk('FN生姜焼き', [
            { text: '豚肉に下味をつけてそのまま10分おく。', minutes: 10 },
            { text: 'フライパンで両面を焼き、たれをからめる。' },
          ], [{ name: '豚肉', amount: '200', unit: 'g' }]))))
          ids.push(await P(store('recipes').add(mk('FNおひたし', [
            { text: 'ほうれん草はざく切りにする。' },
            { text: '鍋にふたをして弱火で煮る。' },
            { text: '水気を絞ってしょうゆで和える。' },
          ], [{ name: 'ほうれん草', amount: '1', unit: '束' }]))))
          ids.push(await P(store('recipes').add(mk('FN味噌汁', [
            { text: '鍋にだしを入れて火にかける。' },
            { text: '豆腐とわかめを入れて2分温める。', minutes: 2 },
            { text: 'みそを溶き入れる。' },
          ], [{ name: '豆腐', amount: '1/2', unit: '丁' }]))))
          let addedAt = Date.now()
          for (const id of ids) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
          const cur = (await P(store('settings').get(1))) || { id: 1 }
          await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
          db.close()
        })
        await p.goto(`${BASE}/#/cook-navi`)
        await p.reload({ waitUntil: 'networkidle' })
        await p.waitForTimeout(1200)
        await p.getByRole('button', { name: ja.cookNavi.build }).click()
        await p.waitForTimeout(900)

        // FN-02: 待ちの枠の数だけ「タイマーを始める」がある（出たり出なかったりしない）。
        // 2026-08-25 便KT: 電子レンジ・トースターの待ちだけは器具が知らせるのでボタンを出さない
        // ＝そのぶんを差し引いて数える（差し引く枠には代わりの一文が必ず入っていることも見る）
        const waitBlocks = await p.locator('[data-testid="navi-wait-block"]').count()
        const applianceWaits = await p
          .locator('[data-testid="navi-wait-block"]')
          .filter({ has: p.locator('[data-testid="navi-wait-appliance-timer"]') })
          .count()
        const timerButtons = await p
          .locator('[data-testid="navi-wait-block"]')
          .getByRole('button', { name: ja.cookNavi.startTimer })
          .count()
        check(
          'FN-02 待ちの枠が3つ以上ある(判定の前提)',
          waitBlocks >= 3,
          `waitBlocks=${waitBlocks}`,
        )
        check(
          'FN-02 待ちの枠の数と「タイマーを始める」の数が一致する(器具が知らせる待ちを除く)',
          waitBlocks - applianceWaits === timerButtons,
          `枠=${waitBlocks} / 器具が知らせる=${applianceWaits} / ボタン=${timerButtons}`,
        )
        // 本文に分数が書かれた待ち(「2分温める」)にもボタンがある＝本文の小さな文字に頼らせない
        const inTextWait = p.locator('[data-testid="navi-wait-block"]').filter({ hasText: '約2分の待ち時間' })
        check(
          'FN-02 本文に分数が書かれた待ち(「2分温める」)にもボタンがある',
          (await inTextWait.getByRole('button', { name: ja.cookNavi.startTimer }).count()) === 1,
        )
        // 手順に時間が書かれていない待ち(調理法から当てた分数)にもボタンがある
        const estimatedWait = p
          .locator('[data-testid="navi-wait-block"]')
          .filter({ has: p.locator('[data-testid="navi-wait-estimated"]') })
        check(
          'FN-02 時間の書かれていない待ちにもボタンがある(目安であることは添えたまま)',
          (await estimatedWait.count()) >= 1 &&
            (await estimatedWait.getByRole('button', { name: ja.cookNavi.startTimer }).count()) ===
              (await estimatedWait.count()),
        )

        // FN-04: 品ごとの内訳と、数え方の違いの一文
        const legendMinutes = await p.locator('[data-testid="navi-legend-minutes"]').allInnerTexts()
        // 文言は書き写さず ja.ts から組み立てる（2026-08-25 便KT で「1品だけなら約◯分」→
        // 「単品で約◯分」に変わったときに、書き写した側だけが取り残されるのを防ぐ）
        const legendRe = new RegExp(
          `^${ja.cookNavi.legendRecipeMinutes
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            .replace('\\{n\\}', '\\d+')}$`,
        )
        check(
          `FN-04 組み合わせる品それぞれに「${ja.cookNavi.legendRecipeMinutes}」が出る`,
          legendMinutes.length === 3 && legendMinutes.every((t) => legendRe.test(t.trim())),
          JSON.stringify(legendMinutes),
        )
        // --- LG-01: 「1品ずつ作ると約◯分 → この段取りで約◯分／約◯分の短縮」は画面から消えている ---
        //   2026-08-26 便LG・オーナー原文「「1品ずつ作ると〜◯分の短縮」→削除。4分とかだと個人の
        //   裁量で直ぐに覆るし、目安でさえこれしか変わらないんだと思ってしまう。ない方がいい。」
        //   便FN がここで見ていた「内訳の合計＝1品ずつ作ると約◯分」は、画面から数字が消えたので
        //   scripts/tests/cook-navi.mjs（buildCookPlan の sequentialMinutes）側だけで見張る。
        //   ここは**戻っていないこと**を見る（黙って検査を消すと、次の便が足し直しても気づけない）
        const bodyNoCompare = noZw(await p.textContent('body'))
        check(
          'LG-01 「1品ずつ作ると約◯分」の比較行は画面に出ていない（2026-08-26 オーナー指示で削除）',
          (await p.locator('[data-testid="navi-total-compare"]').count()) === 0 &&
            !/1品ずつ作ると約\d+分/.test(bodyNoCompare),
          bodyNoCompare.slice(0, 200),
        )
        check(
          'LG-01 「約◯分の短縮」も画面に出ていない',
          !/約\d+分の短縮/.test(bodyNoCompare),
        )
        // 全体の目安（この段取りで約◯分）は今までどおり出ていること＝消しすぎていないこと
        check(
          'LG-01 全体の目安は残っている（消しすぎていない）',
          (await p.locator('[data-testid="navi-total-estimate"]').count()) === 1,
        )
        // 2026-08-25 便KT・オーナー原文「「レシピの一覧に出ている〜一致しません」削除。
        // どこのことかわからない上に違っているのは前提のうちなので不要」。
        // 便FN が置いていた断り書きは消した。**戻っていないこと**をここで見張る
        //（黙って検査を消すと、次の便が足し直しても誰も気づかない）
        check(
          'KT-3 数え方の断り書きは画面に出ていない（2026-08-25 オーナー指示で削除）',
          (await p.locator('[data-testid="navi-total-count-note"]').count()) === 0 &&
            !noZw(await p.textContent('body')).includes('数え方が違う'),
        )
        check(
          'KT-3 「段取りと進んだところは〜」も画面に出ていない',
          (await p.locator('[data-testid="navi-restore-keep-note"]').count()) === 0,
        )

        // --- KT-5: 「できあがりの目安」の枠は画面から消えている ---
        //   2026-08-25 便KT・オーナー原文「「出来上がりの目安」削除。全体の調理時間が分かれば
        //   十分。細かく出したところで、個人の手のスピードや状況によってすぐに変わるので、
        //   ここまで細かく表示してもあまり意味がない。」
        //   便GF/GK がここで測っていた「品ごとの約◯分後」「開きの一文」は節ごと消した。
        //   **全体の調理時間**は今までどおり画面に出ていること（消しすぎていないこと）まで見る
        {
          const prevCheck = currentCheck
          currentCheck = 'KT-5'
          check(
            'KT-5 品ごとの「できあがりの目安」の枠が画面に無い',
            (await p.locator('[data-testid="navi-finish-times"]').count()) === 0 &&
              !noZw(await p.textContent('body')).includes('できあがりの目安'),
          )
          // 見出しの言い方（2026-08-25 便KM で「全体の目安」→「全体の調理時間」）に
          // 引きずられないよう、拾う形も ja.ts から組み立てる
          const naviBody = noZw(await p.textContent('body'))
          const totalRe = new RegExp(
            ja.cookNavi.totalEstimate
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace(/\s+/g, '\\s*')
              .replace('\\{n\\}', '(\\d+)'),
          )
          const totalOnScreen = Number(totalRe.exec(naviBody)?.[1] ?? -1)
          check(
            'KT-5 消したのは品ごとの目安だけ＝「全体の調理時間 約◯分」は今までどおり出ている',
            totalOnScreen > 0,
            `全体=${totalOnScreen}`,
          )
          currentCheck = prevCheck
        }

        // FN-03: タイマーを2本動かして献立の画面へ。帯の下に隠れる操作要素がゼロであること
        const startButtons = p
          .locator('[data-testid="navi-wait-block"]')
          .getByRole('button', { name: ja.cookNavi.startTimer })
        await startButtons.nth(0).click()
        await p.waitForTimeout(300)
        await startButtons.nth(1).click()
        await p.waitForTimeout(600)
        await p.goto(`${BASE}/#/meal-plan`)
        await p.waitForTimeout(1200)
        const bottom = await p.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight)
          const vh = window.innerHeight
          const bars = [...document.querySelectorAll('[data-app-bottom-bar]')].filter((b) => {
            const r = b.getBoundingClientRect()
            return r.height > 0 && r.top < vh
          })
          let barTop = vh
          for (const b of bars) barTop = Math.min(barTop, b.getBoundingClientRect().top)
          const hidden = []
          for (const el of document.querySelectorAll('main a, main button, main [role="button"]')) {
            const r = el.getBoundingClientRect()
            if (r.height <= 0 || r.width <= 0) continue
            if (r.top >= barTop) hidden.push((el.textContent || '').trim().slice(0, 24))
          }
          return {
            barCount: bars.length,
            inset: Math.round(vh - barTop),
            cssVar: getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-inset').trim(),
            hidden,
          }
        })
        check(
          'FN-03 前提: タイマーの帯とタブナビの2本が出ている',
          bottom.barCount === 2,
          JSON.stringify(bottom),
        )
        check(
          'FN-03 ページの下余白が、実際に出ている帯の高さに追随する',
          bottom.cssVar === `${bottom.inset}px`,
          `css=${bottom.cssVar} / 実測=${bottom.inset}px`,
        )
        check(
          'FN-03 帯に完全に隠れて押せない操作要素がゼロ(390px実測)',
          bottom.hidden.length === 0,
          JSON.stringify(bottom.hidden),
        )
        // 帯が1本増えても余白がついてくる（お知らせの帯が同時に出た場合）
        const grown = await p.evaluate(async () => {
          const before = getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-inset').trim()
          const el = document.createElement('div')
          el.setAttribute('data-app-bottom-bar', '')
          el.style.cssText = `position:fixed;left:0;right:0;bottom:${before};height:80px;`
          document.body.appendChild(el)
          await new Promise((r) => setTimeout(r, 500))
          const after = getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-inset').trim()
          el.remove()
          await new Promise((r) => setTimeout(r, 500))
          const back = getComputedStyle(document.documentElement).getPropertyValue('--app-bottom-inset').trim()
          return { before, after, back }
        })
        check(
          'FN-03 帯が増えれば余白も増え、消えれば元に戻る',
          Number.parseInt(grown.after, 10) === Number.parseInt(grown.before, 10) + 80 &&
            grown.back === grown.before,
          JSON.stringify(grown),
        )
        await ctx.close()
      }
    } finally {
      await fnBrowser.close()
    }
  }


  // ============================================================================
  // 便FO（2026-08-11 利用者テスト・実際にアプリを最後まで操作した人の指摘）:
  // 並行調理ナビ／調理中モード／タイマーの使い勝手
  // ============================================================================
  //   FO-01 献立タブの並行調理ナビの行は、押す前にPro版の機能だと分かる
  //   FO-02 「段取りを作る」を初めて押したときも、できた段取りまで画面が送られる
  //   FO-03 声の操作の案内は、声を使っている間だけ出す（切っている間は場所を取らない）
  //   FO-04 調理中モードの料理名が途中で切れない（読み上げ用の文字と画面の文字が一致する）
  //   FO-05 左上は「最初の手順へ」。押した直後だけ「元の手順に戻す」が出て1回で帰れる
  //   FO-06 他の品の行を開いた中の「この手順に移る」で指でも移れる（行のタップは全文を開くだけ）
  //   FO-07 鳴り終わったタイマーは品を問わず画面の上に大きく出て、手順を進めても場所が動かない
  //   FO-08 常駐タイマーの帯はタップしても画面が変わらない（移動は窓の「手順◯を開く」から）
  //   FO-09 「完成！」で、その場に作った記録の確認が出て記録できる
  //   FO-10 中断して献立から戻ったとき、続きの入口が画面の中に入っている
  currentCheck = 'FO-01'
  {
    const foBrowser = await chromium.launch()
    const foContext = await foBrowser.newContext({ viewport: { width: 390, height: 844 } })
    // 声の操作のボタンが出る環境にする（実際の聞き取りは使わない＝案内の出し分けだけを見る）
    await foContext.addInitScript(`
      (() => {
        class FakeRecognition {
          constructor() { window.__recognition = this }
          start() {} stop() {} abort() {}
        }
        window.SpeechRecognition = FakeRecognition
        window.webkitSpeechRecognition = FakeRecognition
      })()
    `)
    const foPage = await foContext.newPage()
    /** 確認の窓に「はい」と答えるか「やめる」と答えるか（FO-09で切り替える） */
    let foDialogAnswer = 'accept'
    let foDialogMessage = ''
    foPage.on('dialog', (d) => {
      foDialogMessage = d.message()
      void (foDialogAnswer === 'accept' ? d.accept() : d.dismiss())
    })
    foPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FO] ${err.message}`)
    })
    foPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FO] ${t}`)
    })
    const foCounter = () => foPage.locator('[data-testid="cook-session-counter"]').innerText()
    const foRecipe = () => foPage.locator('[data-testid="cook-session-recipe"]').innerText()
    const foSessionText = () => foPage.locator('[data-testid="cook-session"]').innerText()
    const foNext = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        await foPage.locator('[data-testid="cook-session-next"]').click()
        await foPage.waitForTimeout(200)
      }
    }
    /** 段取りの最後の手順（「完成！」が出るところ）まで進む */
    const foToLast = async () => {
      for (let i = 0; i < 40; i++) {
        if ((await foPage.locator('[data-testid="cook-session-finish"]').count()) > 0) return
        await foPage.locator('[data-testid="cook-session-next"]').click()
        await foPage.waitForTimeout(120)
      }
    }
    try {
      await foPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1800)
      const foIds = await foPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('FO照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        // 料理名が途中で切れないことを見るための長い名前（実機の指摘は11文字で切れていた）
        const idB = await P(store('recipes').add(mk('FOほうれん草のおひたし（ごま風味）', [
          { text: 'ほうれん草は根元を切り落として洗う。' },
          { text: '鍋にたっぷりの湯を沸かし、ほうれん草を2分ゆでる。', minutes: 2 },
          { text: '水気をしぼって食べやすく切り、だしとしょうゆで和える。' },
        ], [{ name: 'ほうれん草', amount: '1', unit: '束' }])))
        const idC = await P(store('recipes').add(mk('FO煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、味をしみ込ませてから器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return { idA, idB, idC }
      })

      // --- FO-01: 献立タブの行は、押す前にPro版の機能だと分かる ---
      //   利用者テスト「『並行調理ナビ』にPro/鍵の印がない。献立の一覧に普通の行として
      //   並んでいるので押した。押した先で初めて『Pro版の機能です』と言われた」
      await foPage.goto(`${BASE}/#/meal-plan`)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1800)
      const foEntry = await foPage.evaluate(() =>
        [...document.querySelectorAll('a')]
          .filter((a) => a.getAttribute('href')?.includes('/cook-navi'))
          .map((a) => a.textContent.replace(/\s+/g, ' ').trim()),
      )
      check(
        'FO-01 献立タブの並行調理ナビの行に、押す前にPro版の機能だと書いてある',
        foEntry.some((t) => t.includes('並行調理ナビ') && t.includes('Pro版の機能')),
        JSON.stringify(foEntry),
      )

      // --- FO-02: 「段取りを作る」を初めて押したときも、できた段取りまで画面が送られる ---
      //   利用者テスト「押しても画面がほぼ変わらない。押した直後の画面は上のボタンのまま。
      //   結果は画面のずっと下にできている。押せていないのかと思ってもう一度押しそうになった」
      currentCheck = 'FO-02'
      await foPage.goto(`${BASE}/#/cook-navi`)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1400)
      const foScrollBeforeBuild = await foPage.evaluate(() => window.scrollY)
      await foPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await foPage.waitForTimeout(1600)
      const foAfterBuild = await foPage.evaluate(() => {
        const el = document.querySelector('[data-testid="cook-session-start"]')
        return { scrollY: Math.round(window.scrollY), hasTimeline: el != null }
      })
      check(
        'FO-02 前提: 段取りができている',
        foAfterBuild.hasTimeline,
        JSON.stringify(foAfterBuild),
      )
      check(
        'FO-02 初めて「段取りを作る」を押したときも、できた段取りまで画面が送られる',
        foAfterBuild.scrollY > foScrollBeforeBuild,
        `スクロール ${foScrollBeforeBuild}→${foAfterBuild.scrollY}`,
      )

      // --- FO-03: 声の操作の案内は、声を使っている間だけ出す ---
      //   利用者テスト「声を使わないのに、画面の上5行がずっと声の説明で埋まっている。
      //   マイクは切ってあるのに消えない」
      currentCheck = 'FO-03'
      await foPage.locator('[data-testid="cook-session-start"]').click()
      await foPage.waitForTimeout(700)
      check(
        'FO-03 前提: 全画面の調理中モードが開き、「声で操作」のボタンがある',
        (await foPage.locator('[data-testid="cook-session"]').count()) === 1 &&
          (await foPage.locator('button[aria-label="声で操作する"]').count()) === 1,
      )
      check(
        'FO-03 声を切っている間は、言葉の一覧を画面に出さない',
        !(await foSessionText()).includes('声で操作:'),
        (await foSessionText()).slice(0, 120),
      )
      await foPage.locator('button[aria-label="声で操作する"]').click()
      await foPage.waitForTimeout(500)
      check(
        'FO-03 「声で操作」を押すと言葉の一覧が出る（使う人だけが読む）',
        (await foSessionText()).includes('声で操作:') &&
          (await foSessionText()).includes(ja.cookNavi.sessionMicColorHint),
      )
      await foPage.locator('button[aria-label="声の操作をやめる"]').click()
      await foPage.waitForTimeout(500)
      check(
        'FO-03 もう一度押して切ると、案内もまた消える',
        !(await foSessionText()).includes('声で操作:'),
      )

      // --- FO-04: 料理名が途中で切れない ---
      //   利用者テスト「調理中モードの料理名の帯が途中で切れる（『ほうれん草のおひ…』11文字で
      //   切れる）。読み上げ用のテキストには全部入っている」
      currentCheck = 'FO-04'
      for (let i = 0; i < 12; i++) {
        if ((await foRecipe()).includes('ごま風味')) break
        await foNext(1)
      }
      const foTitleGeom = await foPage.evaluate(() => {
        const el = document.querySelector('[data-testid="cook-session-recipe"]')
        if (!el) return null
        return {
          text: el.textContent,
          // 文字が枠に収まらず切り落とされていないか（切っていると scrollWidth のほうが大きい）
          clipped: el.scrollWidth > el.clientWidth + 1,
        }
      })
      check(
        'FO-04 前提: 長い名前の品の手順を開いている',
        foTitleGeom != null && foTitleGeom.text.includes('ごま風味'),
        JSON.stringify(foTitleGeom),
      )
      check(
        'FO-04 料理名が最後まで画面に出る（…で切らない）',
        foTitleGeom != null &&
          foTitleGeom.text === 'FOほうれん草のおひたし（ごま風味）' &&
          !foTitleGeom.clipped,
        JSON.stringify(foTitleGeom),
      )

      // --- FO-05: 「最初の手順へ」と、その取り消し ---
      //   利用者テスト「『手順①へ』は押すまで意味不明。丸囲みの①はこのアプリの他のどこにも
      //   出てこない。閉じる✕のすぐ隣にあるので、押し間違えたら今いる場所を失う
      //  （戻る手段は『次へ』を8回）」
      currentCheck = 'FO-05'
      const foToFirst = foPage.locator('[data-testid="cook-session-to-first"]')
      check(
        'FO-05 左上のボタンが「最初の手順へ」（丸囲み数字を使わない）',
        (await foToFirst.innerText()).trim() === '最初の手順へ' &&
          !(await foToFirst.innerText()).includes('①'),
        await foToFirst.innerText(),
      )
      // 先頭にいると「最初の手順へ」が押せない（段取りの並びは組み方次第なので、その場合だけ1つ進める）
      if (/^段取り 1\//.test(await foCounter())) await foNext(1)
      const foBeforeFirst = await foCounter()
      check(
        'FO-05 前提: 段取りの途中にいる',
        !/^段取り 1\//.test(foBeforeFirst),
        foBeforeFirst,
      )
      check(
        'FO-05 押す前は取り消しのボタンを出さない',
        (await foPage.locator('[data-testid="cook-session-undo-first"]').count()) === 0,
      )
      await foToFirst.click()
      await foPage.waitForTimeout(400)
      check(
        'FO-05 押すと段取りの最初の手順へ移る',
        /^段取り 1\//.test(await foCounter()),
        await foCounter(),
      )
      check(
        'FO-05 押した直後だけ「元の手順に戻す」が出る',
        (await foPage.locator('[data-testid="cook-session-undo-first"]').innerText()).includes(
          '元の手順に戻す',
        ),
      )
      await foPage.locator('[data-testid="cook-session-undo-first"]').click()
      await foPage.waitForTimeout(400)
      check(
        'FO-05 1回押すだけで元いた手順に帰れる（「次へ」を何回も押さない）',
        (await foCounter()) === foBeforeFirst,
        `${foBeforeFirst}→${await foCounter()}`,
      )
      check(
        'FO-05 帰ったあとは取り消しのボタンを残さない',
        (await foPage.locator('[data-testid="cook-session-undo-first"]').count()) === 0,
      )
      await foToFirst.click()
      await foPage.waitForTimeout(400)
      await foNext(1)
      check(
        'FO-05 別の移動をしたら取り消しのボタンは消える（どこへ戻すのかが曖昧にならない）',
        (await foPage.locator('[data-testid="cook-session-undo-first"]').count()) === 0,
      )

      // --- FO-06: 指でも他の品へ移れる（行のタップの意味は変えない） ---
      //   利用者テスト「他の品への切り替えが、画面からはできない。下の行を押したら全文が
      //   開くだけ。色で飛べるのは声だけで、画面には同じ手段がない」
      //   2026-08-11 オーナー承認済みの設計（行のタップは見るだけ）は維持し、
      //   移る操作は「開いた中」に置く＝1つの行に2つの意味を持たせない
      currentCheck = 'FO-06'
      const foBeforePeek = await foCounter()
      await foPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await foPage.waitForTimeout(400)
      check(
        'FO-06 行のタップは今までどおり全文が出るだけ（調理中の手順は動かない）',
        (await foPage.locator('[data-testid="cook-session-peek"]').count()) === 1 &&
          (await foCounter()) === foBeforePeek,
        `${foBeforePeek}→${await foCounter()}`,
      )
      const foMoveTarget = (
        await foPage.locator('[data-testid="cook-session-other-row"]').first().innerText()
      )
        .split('\n')
        .map((s) => s.trim())
        .find((s) => s.startsWith('FO'))
      check(
        'FO-06 開いた中に「この手順を先にする」がある',
        (await foPage.locator('[data-testid="cook-session-peek-move"]').first().innerText()).includes(
          'この手順を先にする',
        ),
      )
      await foPage.locator('[data-testid="cook-session-peek-move"]').first().click()
      await foPage.waitForTimeout(600)
      check(
        'FO-06 押すとその品の手順が開く（声で色を言ったときと同じ引き寄せ）',
        (await foRecipe()) === foMoveTarget,
        `期待=${foMoveTarget} 実際=${await foRecipe()}`,
      )
      check(
        'FO-06 引き寄せなので手順を飛ばさない（開いていた手順は次に残る）',
        (await foPage.locator('[data-testid="cook-session-other-row"]').first().innerText()).length > 0 &&
          !(await foPage.locator('[data-testid="cook-session-others"]').innerText()).includes('完成'),
        await foPage.locator('[data-testid="cook-session-others"]').innerText(),
      )
      const foMovedLogs = await foPage.evaluate(async () => {
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
        return all.filter((r) => r.title.startsWith('FO')).reduce((n, r) => n + r.cookedLogs.length, 0)
      })
      check('FO-06 移っただけでは作った記録は付かない', foMovedLogs === 0, `記録=${foMovedLogs}件`)

      // --- FO-07: 鳴り終わったタイマーは画面の上に大きく出て、場所が動かない ---
      //   利用者テスト「鳴り終わったタイマーが、画面の一番下に小さく『終わり』と出るだけ。
      //   コンロの前で手を動かしているときに、あの位置のあの大きさでは気づけない」
      currentCheck = 'FO-07'
      await foPage.evaluate((ids) => {
        const now = Date.now()
        localStorage.setItem(
          'uchirecipe:activeTimers',
          JSON.stringify([
            // いま大きく出している品ではない品のタイマーを終わらせる（以前は下部の行に紛れていた）
            { id: 971, key: 'fo-done', label: 'FO煮物', doneLabel: '煮込み終わり', recipeId: ids.idC, stepNumber: 2, endsAt: now - 5000, totalSeconds: 900, done: true, muted: false, fromNavi: true, naviColorIndex: 2, naviOrder: 5, naviStepLabel: '2' },
          ]),
        )
      }, foIds)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1800)
      const foBanner = foPage.locator('[data-testid="cook-session-finished-timers"]')
      check(
        'FO-07 鳴り終わったタイマーが調理中モードの画面に出る',
        (await foBanner.count()) === 1 &&
          (await foBanner.innerText()).includes('煮込み終わり'),
        (await foBanner.count()) === 1 ? await foBanner.innerText() : 'なし',
      )
      const foDoneLook = await foPage.evaluate(() => {
        const banner = document.querySelector('[data-testid="cook-session-finished-timers"]')
        const label = document.querySelector('[data-testid="cook-session-finished-label"]')
        const others = document.querySelector('[data-testid="cook-session-others"]')
        if (!banner || !label) return null
        const b = banner.getBoundingClientRect()
        return {
          top: Math.round(b.top),
          width: Math.round(b.width),
          fontSize: Math.round(Number.parseFloat(getComputedStyle(label).fontSize)),
          insideOthers: others ? others.contains(banner) : false,
          viewport: window.innerHeight,
        }
      })
      check(
        'FO-07 画面の上（下部の「他の品の次の手順」の中ではない）に出る',
        foDoneLook != null && foDoneLook.insideOthers === false && foDoneLook.top < 240,
        JSON.stringify(foDoneLook),
      )
      check(
        'FO-07 終了の文言が大きい（小さな印で終わらせない）',
        foDoneLook != null && foDoneLook.fontSize >= 18,
        JSON.stringify(foDoneLook),
      )
      const foBannerTops = []
      for (let i = 0; i < 3; i++) {
        const box = await foBanner.boundingBox()
        foBannerTops.push(box ? Math.round(box.y) : -1)
        await foNext(1)
      }
      /* 2026-08-29 便MK: 3手ぶん測れていることを同じ判定式に入れた。
         **実測**: foBannerTops を空にすると、直す前は緑のままだった（置き場所を1回も見ずに合格）。 */
      check(
        'FO-07 手順を進めても、終わったタイマーの置き場所が変わらない（毎回探さない）',
        foBannerTops.length === 3 && foBannerTops.every((y) => y >= 0 && y < 240),
        JSON.stringify(foBannerTops),
      )
      check(
        'FO-07 消す操作が大きなボタンで押せる（小さな✕だけにしない）',
        (await foPage.locator('[data-testid="cook-session-finished-dismiss"]').innerText()).includes(
          'タイマーを消す',
        ),
      )
      const foDismissBox = await foPage
        .locator('[data-testid="cook-session-finished-dismiss"]')
        .boundingBox()
      check(
        'FO-07 その消すボタンが指で押せる大きさ（高さ40px以上）',
        foDismissBox != null && foDismissBox.height >= 40,
        JSON.stringify(foDismissBox),
      )
      await foPage.locator('[data-testid="cook-session-finished-dismiss"]').click()
      await foPage.waitForTimeout(500)
      check(
        'FO-07 押すとその場で消える（居座らない）',
        (await foBanner.count()) === 0,
      )

      // --- FO-08: 常駐タイマーの帯はタップしても画面が変わらない ---
      //   利用者テスト「タイマーの帯そのものが大きなボタンで、押すと別の画面に飛ぶ。
      //   帯を消そうとして触ったら、並行調理ナビの画面に飛ばされた」
      currentCheck = 'FO-08'
      await foPage.goto(`${BASE}/#/meal-plan`)
      await foPage.evaluate((ids) => {
        const now = Date.now()
        localStorage.setItem(
          'uchirecipe:activeTimers',
          JSON.stringify([
            { id: 972, key: 'fo-bar', label: 'FO煮物', doneLabel: '煮込み終わり', recipeId: ids.idC, stepNumber: 2, endsAt: now - 4000, totalSeconds: 900, done: true, muted: false, fromNavi: true, naviColorIndex: 2, naviOrder: 5, naviStepLabel: '2' },
          ]),
        )
      }, foIds)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1800)
      const foUrlBefore = foPage.url()
      await foPage.locator('[data-app-bottom-bar] button').first().click()
      await foPage.waitForTimeout(700)
      check(
        'FO-08 終わったタイマーの帯を触っても画面が変わらない',
        foPage.url() === foUrlBefore,
        `${foUrlBefore} → ${foPage.url()}`,
      )
      const foAdjust = foPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
      check('FO-08 代わりにタイマーの窓が開く', (await foAdjust.count()) === 1)
      // 2026-08-15 便GQ: 調理の途中かどうかで「開く」「見る」に名前が分かれるので、
      // ここは**手順への道があること**だけを見る（動きの語で掴まない）
      const foGoToStep = foAdjust.locator('[data-testid="timer-adjust-go-step"]')
      check(
        'FO-08 窓の中には手順への道が残っている（名前を読んで押せる）',
        (await foGoToStep.count()) === 1,
        (await foGoToStep.count()) === 1 ? await foGoToStep.innerText() : 'なし',
      )
      check(
        'FO-08 窓の中に大きな「タイマーを消す」がある（小さな✕を狙わなくてよい）',
        (await foAdjust.getByRole('button', { name: ja.timer.stopTimer }).count()) === 1,
      )
      await foGoToStep.click()
      await foPage.waitForTimeout(1200)
      check(
        'FO-08 窓のボタンからは今までどおり手順のある画面へ進む',
        foPage.url() !== foUrlBefore,
        foPage.url(),
      )
      await foPage.evaluate(() => localStorage.removeItem('uchirecipe:activeTimers'))

      // --- FO-09: 「完成！」でその場に作った記録の確認が出る ---
      //   利用者テスト「最後の『完成！』を押しても、記録はつかない。14/14まで進めて押したが
      //  『作りました』も出ず、段取りのページに戻っただけ。別に『まとめて作った！』を押す
      //   必要があると気づくまで分からなかった」
      currentCheck = 'FO-09'
      await foPage.goto(`${BASE}/#/cook-navi`)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1600)
      if ((await foPage.locator('[data-testid="cook-session-start"]').count()) === 0) {
        await foPage.getByRole('button', { name: ja.cookNavi.build }).click()
        await foPage.waitForTimeout(1200)
      }
      if ((await foPage.locator('[data-testid="cook-session"]').count()) === 0) {
        await foPage.locator('[data-testid="cook-session-start"]').click()
        await foPage.waitForTimeout(700)
      }
      await foToLast()
      check(
        'FO-09 前提: 段取りの最後の手順で「完成！」が出ている',
        (await foPage.locator('[data-testid="cook-session-finish"]').innerText()).trim() === '完成！',
      )
      // ①まず「完成！」を押したときに出る窓の中身（2026-08-12 便FX でブラウザの確認から
      //    画面の中の窓に変わり、行き先が3つになった）
      await foPage.locator('[data-testid="cook-session-finish"]').click()
      await foPage.waitForTimeout(800)
      // 2026-08-25 便KM: 消えるもの・残るものの説明は畳んで出すようになった。
      // この節が見るのは「その説明が書いてあるか」なので、読む前に開く（中身は減らしていない）
      if ((await foPage.locator('[data-testid="cook-finish-detail-toggle"]').count()) === 1) {
        await foPage.locator('[data-testid="cook-finish-detail-toggle"]').click()
        await foPage.waitForTimeout(500)
      }
      const foFinishBody = await foPage.locator('[data-testid="cook-finish-modal"]').innerText()
      check(
        'FO-09 「完成！」を押すと、その場で作った記録の確認が出る',
        foFinishBody.includes(ja.cookNavi.markAllCookedConfirmTitle.split('{n}品')[1]) &&
          foFinishBody.includes('記録をつける'),
        foFinishBody.slice(0, 200),
      )
      check(
        'FO-09 確認文に、記録する品名と数が入っている（規約F）',
        foFinishBody.includes('FO照り焼き') &&
          foFinishBody.includes('FO煮物') &&
          hasCount(foFinishBody, 3),
        foFinishBody.slice(0, 240),
      )
      // GF-A（2026-08-14 便GF・利用者テスト「ダイアログに『レシピと段取りはそのまま残ります』と
      // 書かれているのに、記録をつけると段取りが消える。リロードしても戻らない。
      // 説明文がその場で嘘になっているのが一番まずい」）。
      // 記録で段取りを終える動きはオーナーの整理どおりなので、案内文を動きに合わせた。
      // ここでは**確認文の中身**を見て、下の GF-A で**そのとおりに消えるか**を見る（両方そろって合格）
      check(
        'FO-09 確認文に、何が残るかも書いてある（規約F）',
        foFinishBody.includes('残ります') &&
          foFinishBody.includes('レシピ') &&
          foFinishBody.includes('作った記録'),
        foFinishBody.slice(0, 240),
      )
      check(
        'GF-A 確認文に「段取りも消える」と書いてある（残ると書いていない）',
        foFinishBody.includes('段取り') &&
          foFinishBody.includes('消えます') &&
          !/段取り[^。]*残ります/.test(foFinishBody),
        foFinishBody.slice(0, 300),
      )
      // FX-06: まとめて付けた記録も、あとから1件ずつ直せることを添える
      check(
        'FX-06 記録の確認に「あとから1件ずつ編集できる」が書いてある',
        foFinishBody.includes(ja.cookNavi.markAllCookedConfirmEdit.trim()),
        foFinishBody.slice(0, 300),
      )
      // FX-07: 3つ目の行き先＝手順の画面へ帰る（押しても記録は付かず、全画面も閉じない）
      const foFinishCounterBefore = await foCounter()
      check(
        'FX-07 窓に3つの行き先がある（記録をつける／調理を続ける／記録をつけずに閉じる）',
        (await foPage.locator('[data-testid="cook-finish-record"]').count()) === 1 &&
          (await foPage.locator('[data-testid="cook-finish-back"]').count()) === 1 &&
          (await foPage.locator('[data-testid="cook-finish-close"]').count()) === 1,
        foFinishBody,
      )
      await foPage.locator('[data-testid="cook-finish-back"]').click()
      await foPage.waitForTimeout(700)
      check(
        'FX-07 「調理を続ける」で、完成！を押す直前の手順の画面に戻る',
        (await foPage.locator('[data-testid="cook-session"]').count()) === 1 &&
          (await foPage.locator('[data-testid="cook-finish-modal"]').count()) === 0 &&
          (await foCounter()) === foFinishCounterBefore,
        `${foFinishCounterBefore}→${await foCounter()}`,
      )
      const foBackLogs = await foPage.evaluate(async () => {
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
        return all.filter((r) => r.title.startsWith('FO')).map((r) => r.cookedLogs.length)
      })
      check(
        'FX-07 「調理を続ける」では記録は付かない',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        foBackLogs.length > 0 && foBackLogs.every((n) => n === 0),
        JSON.stringify(foBackLogs),
      )
      // 「記録をつけずに閉じる」を選ぶと、記録は付かず段取りのページに戻る（従来の「やめる」）
      await foPage.locator('[data-testid="cook-session-finish"]').click()
      await foPage.waitForTimeout(600)
      await foPage.locator('[data-testid="cook-finish-close"]').click()
      await foPage.waitForTimeout(1500)
      check(
        'FO-09 「記録をつけずに閉じる」を選ぶと記録は付かず、段取りのページに戻る',
        (await foPage.locator('[data-testid="navi-mark-all-cooked"]').count()) === 1 &&
          (await foPage.locator('[data-testid="cook-session"]').count()) === 0,
      )
      // ②「記録をつける」を選んだとき: その場で記録が付く（もう一度「まとめて作った！」を探さない）
      await foPage.locator('[data-testid="cook-session-start"]').click()
      await foPage.waitForTimeout(700)
      await foToLast()
      await foPage.locator('[data-testid="cook-session-finish"]').click()
      await foPage.waitForTimeout(600)
      await foPage.locator('[data-testid="cook-finish-record"]').click()
      await foPage.waitForTimeout(1800)
      const foLogs = await foPage.evaluate(async () => {
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
        return all
          .filter((r) => r.title.startsWith('FO'))
          .map((r) => ({ title: r.title, logs: r.cookedLogs.length }))
      })
      check(
        'FO-09 「はい」を選ぶと、段取りに組んだ3品に作った記録が付く',
        foLogs.length === 3 && foLogs.every((r) => r.logs === 1),
        JSON.stringify(foLogs),
      )
      check(
        'FO-09 記録できたことを画面で知らせる',
        ((await foPage.textContent('body')) ?? '').includes('作った記録をつけました'),
      )
      // --- GF-A: 記録をつけたあとの並行調理ナビが、確認文で言ったとおりになっている ---
      //   利用者テスト「並行調理ナビが『今日の献立にレシピがありません』になり、段取りが消える。
      //   リロードしても戻らない」。段取りが終わること自体は確認文どおりでよい。
      //   直したのは①確認文が「段取りは残る」と嘘をついていたこと ②作り終えた状態を
      //  「レシピがありません」と言っていたこと。**どこに出ていても同じ判定**になるよう本文で見る
      currentCheck = 'GF-A'
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1600)
      const gfaBody = ((await foPage.textContent('body')) ?? '').replaceAll('​', '')
      check(
        'GF-A 記録したあとは段取りが残らない（確認文どおり）',
        (await foPage.locator('[data-testid="cook-session-start"]').count()) === 0 &&
          (await foPage.locator('[data-testid="navi-mark-all-cooked"]').count()) === 0,
        gfaBody.slice(0, 200),
      )
      check(
        'GF-A 作り終えた状態を「今日の献立にレシピがありません」と言わない',
        !gfaBody.includes(ja.cookNavi.emptyToday),
        gfaBody.slice(0, 300),
      )
      check(
        'GF-A 作り終えたことと、次にできることを画面に書く',
        new RegExp(ja.cookNavi.emptyTodayCooked.split('。')[1].replace('{n}', '\\d+')).test(gfaBody) &&
          gfaBody.includes(ja.cookNavi.emptyTodayCooked.split('。')[2]),
        gfaBody.slice(0, 300),
      )

      // --- FO-10: 中断して献立から戻ったとき、続きの入口が画面の中に入っている ---
      //   利用者テスト「献立画面の『並行調理ナビを再開』を押しても、調理中モードには戻らず、
      //   段取りページの一番上に戻るだけ。そこから下までスクロールして『調理中モードの
      //   続きから見る』を押す必要がある」
      currentCheck = 'FO-10'
      // 記録した3品は今日の献立から外れている（確認文どおり）ので、もう一度入れ直してから組む。
      // 作った記録が付いていても、自分で今日の献立に入れ直せば候補に戻る（2026-08-11 便FNの直し）
      await foPage.evaluate(async (ids) => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = db.transaction('todayList', 'readwrite').objectStore('todayList')
        let addedAt = Date.now()
        for (const id of [ids.idA, ids.idB, ids.idC]) await P(store.add({ recipeId: id, addedAt: addedAt++ }))
        db.close()
      }, foIds)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1600)
      await foPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await foPage.waitForTimeout(1400)
      await foPage.locator('[data-testid="cook-session-start"]').click()
      await foPage.waitForTimeout(700)
      await foNext(4)
      const foPaused = await foCounter()
      await foPage.locator('[data-testid="cook-session-close"]').click()
      await foPage.waitForTimeout(700)
      await foPage.goto(`${BASE}/#/meal-plan`)
      await foPage.reload({ waitUntil: 'networkidle' })
      await foPage.waitForTimeout(1600)
      check(
        'FO-10 前提: 献立タブに「並行調理ナビを再開」が出ている',
        (await foPage.locator('[data-testid="navi-resume"]').count()) === 1,
      )
      await foPage.locator('[data-testid="navi-resume"]').click()
      await foPage.waitForTimeout(2200)
      const foResumeGeom = await foPage.evaluate(() => {
        const el = document.querySelector('[data-testid="cook-session-start"]')
        if (!el) return null
        const r = el.getBoundingClientRect()
        let bottomBar = window.innerHeight
        for (const b of document.querySelectorAll('[data-app-bottom-bar]')) {
          const br = b.getBoundingClientRect()
          if (br.height > 0 && br.top < bottomBar) bottomBar = br.top
        }
        return {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          bottomBar: Math.round(bottomBar),
          text: el.textContent.replace(/\s+/g, ' ').trim(),
        }
      })
      check(
        'FO-10 再開すると「調理中モードの続きから見る」が画面の中に入っている',
        foResumeGeom != null &&
          foResumeGeom.text.includes('続きから見る') &&
          foResumeGeom.top >= 0 &&
          foResumeGeom.bottom <= foResumeGeom.bottomBar,
        JSON.stringify(foResumeGeom),
      )
      await foPage.locator('[data-testid="cook-session-start"]').click()
      await foPage.waitForTimeout(800)
      check(
        'FO-10 その1回で、中断した手順の続きから開く',
        (await foCounter()) === foPaused,
        `中断=${foPaused} 再開=${await foCounter()}`,
      )
    } finally {
      await foBrowser.close()
    }
  }
