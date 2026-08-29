// ==========================================================================================
// e2e の節: 食材と価格・献立(週/月)の基本
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
// この中の節: PRICE-01, INLINE-01, MEALPLAN-01, NUTRI-DAY-01, NUTRI-PRO-01, MEALPLAN-02, MEALPLAN-03, MEALPLAN-04, MEALPLAN-05, MEALPLAN-06, MEALPLAN-08
// ==========================================================================================
import './_shared.mjs'


  // --- PRICE-01: 食材価格マスタ(「食材と価格」画面。docs/20 §3)。
  // 材料に価格を入力していないレシピでも、マスタの目安価格が詳細の概算食費に反映され、
  // マスタの価格を編集すると反映結果も追従することを確認する。
  // 2026-07-12 UX改修で編集モーダルを廃止し一覧の行内編集に変わったため、操作手順もそれに合わせた ---
  currentCheck = 'PRICE-01'
  // テスト用レシピ: 材料に価格を入力せず、マスタ初期値がある「玉ねぎ」だけを使う
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2E価格マスタ確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('玉ねぎ')
  await page.getByPlaceholder(ja.form.ingredientAmountPlaceholder).first().fill('1')
  await page.getByPlaceholder(ja.form.ingredientUnitPlaceholder).first().fill('個')
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('切る')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const priceDetailBefore = await page.textContent('body')
  check(
    // 2026-08-26 便LF: 玉ねぎの目安価格を50→77円/1個にした（オーナー裁定「ORIGINAL_30 のピン留めを
    // 外して並の実勢へ」。根拠は src/data/priceDefaults.ts の玉ねぎの行のコメント）。
    // この節が見張っているのは「マスタの目安価格が詳細の概算食費に出ること」で、値そのものではない
    'PRICE-01 マスタ初期値(玉ねぎ1個77円。便LFの前は50円)が価格未入力の詳細の概算食費に反映される',
    priceDetailBefore.includes('約77円'),
  )
  check(
    'PRICE-01 詳細画面の概算食費欄にはマスタ由来の注記が出ない' +
      '(2026-07-13 オーナー実機フィードバックで削除。週の献立側も同日中に削除)',
    !priceDetailBefore.includes('一部は目安価格から計算しています'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの目安価格の注記は表示しない' +
      '(2026-07-14 オーナー実機フィードバック「材料のメモ欄に目安価格が表示されている」の解消で機能削除)',
    !priceDetailBefore.includes('（目安50円）'),
  )
  // 修正3a: 概算食費(合計)に加えて「1食あたり」も表示される。既定servings=2なので77÷2=39円
  check(
    'PRICE-01(修正3a) 「1食あたり」の概算食費も表示される(既定人数2人・77÷2=約39円)',
    priceDetailBefore.includes('1食あたり 約39円'),
  )
  // 2026-07-28 便BY/COST-03: 何人分を1食に分けた額なのかを常時添える
  check(
    'PRICE-01(便KN) 概算食費が「1食あたり 約39円」と出る',
    priceDetailBefore.includes(ja.detail.pricePerServing.replace('{n}', '39')),
  )

  // 設定から「食材と価格」を開き、初期値30件の投入と目安の注意書きを確認する。
  // 「食材と価格を編集する」リンクは個人設定節にある
  // (2026-07-13 UI改善で「レシピ」タブから移動)ため、タブ切り替え不要でそのまま開ける
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: '食材と価格を編集する' }).click()
  await page.waitForTimeout(500)
  check('PRICE-01 設定からの遷移でタイトルが表示される', page.url().includes('#/prices'))
  const priceListBefore = await page.textContent('body')
  check(
    'PRICE-01 初期値が投入されている(玉ねぎ・鶏もも肉を含む)',
    priceListBefore.includes('玉ねぎ') && priceListBefore.includes('鶏もも肉'),
  )
  // 2026-08-04 便DV-9: 「目安です」から「何を基準にした価格か」を書く形に変えた
  check(
    'PRICE-01 はじめから入っている価格の根拠が表示される',
    priceListBefore.includes(ja.priceMaster.disclaimer),
  )

  // --- INLINE-01: 一覧の行内編集(2026-07-12 UX改修)。玉ねぎの行を名前で特定し、
  // 編集ボタン・別窓を経由せず、価格欄に直接入力してEnter(=blur)で即保存できることを確認する。
  // 2026-07-13 UI改善で「目安」/「自分の価格」バッジは廃止したため、ここでは
  // 「デフォルトに戻す」ボタンの出現/消失(=上書き済みかどうか)で編集反映を確認する ---
  currentCheck = 'INLINE-01'
  const onionRow = page.locator('li', { hasText: '玉ねぎ' })
  check(
    'INLINE-01 初期状態(未編集)では「デフォルトに戻す」ボタンが出ない',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  const onionPriceInput = onionRow.getByLabel('玉ねぎの価格（円）')
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter') // Enterでblur→保存(モーダル・保存ボタンを経由しない)
  await page.waitForTimeout(400)
  const onionRowTextAfterEdit = await onionRow.textContent()
  check('INLINE-01 編集後は「デフォルトに戻す」ボタンが出る', onionRowTextAfterEdit.includes('デフォルトに戻す'))
  check(
    'INLINE-01 価格入力欄の値が999のまま保持される(再マウントで飛ばない)',
    (await onionPriceInput.inputValue()) === '999',
  )

  // 修正2a: 手入力で既定値(2026-08-26 便LFで50→77円)に戻すと「デフォルトに戻す」ボタンも
  // 消えることを確認する。以前は編集フラグが一方通行だったため、値を既定値に戻してもボタンが残るバグがあった
  await onionPriceInput.fill('77')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)
  check(
    'INLINE-01(修正2a) 手入力で既定値と一致させると「デフォルトに戻す」ボタンが消える',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  // 後続の検証用に再度999へ編集し直す
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)

  // 修正2b: 重複食材の登録防止。既に登録済みの「玉ねぎ」を追加しようとすると拒否される
  // exact:trueが必須(部分一致だと検索欄「食材名で絞り込む」や各行の「{name}の価格（円）」等と衝突する)
  // 2026-07-15 UI改修で単位欄が「数量(数字)＋単位(選択)」に分離されたため、addUnitInputは
  // 数量欄(addQtyInput)＋単位選択(addUnitSelect)の2つに置き換えた(PRICEUNIT-01参照)
  const addNameInput = page.getByLabel(ja.priceMaster.nameLabel, { exact: true })
  const addPriceInput = page.getByLabel(ja.priceMaster.priceLabel, { exact: true })
  const addQtyInput = page.getByLabel(ja.priceMaster.quantityLabel, { exact: true })
  const addUnitSelect = page.getByLabel('単位', { exact: true })
  await addNameInput.fill('玉ねぎ')
  await addPriceInput.fill('80')
  await addQtyInput.fill('1')
  await addUnitSelect.selectOption('個')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 既に登録済みの食材名は追加を拒否し、案内メッセージが出る',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです'),
  )
  check(
    'INLINE-01(修正2b) 拒否後も「玉ねぎ」の行は1件のまま増えない',
    (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  // 前後の空白・括弧付きの表記ゆれも正規化して同一とみなし拒否される
  await addNameInput.fill('  玉ねぎ（小）  ')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 表記ゆれ(前後空白・括弧書き)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです') &&
      (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2b拡張(2026-07-15オーナー実機フィードバック): かな表記ゆれ(カタカナ⇄ひらがな)も
  // toHiraganaで正規化して重複と判定する。登録済み「白菜」に対してカタカナ「ハクサイ」を追加拒否する
  await addNameInput.fill('ハクサイ')
  await addPriceInput.fill('99')
  await addQtyInput.fill('1')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b拡張) かな表記ゆれ(カタカナ/ひらがな。白菜/ハクサイ)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「白菜」は既に登録済みです') &&
      (await page.locator('li', { hasText: '白菜' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2c: 追加入力欄が一覧より上に表示される(食材名欄のY座標 < 玉ねぎ行のY座標)
  const addNameBox = await addNameInput.boundingBox()
  const onionRowBoxForOrder = await onionRow.boundingBox()
  check(
    'INLINE-01(修正2c) 追加入力欄が一覧より上に表示される',
    !!addNameBox && !!onionRowBoxForOrder && addNameBox.y < onionRowBoxForOrder.y,
  )

  // 検索/絞り込み: 存在しない食材名で0件表示になることを確認してから解除する
  const searchInput = page.getByPlaceholder(ja.priceMaster.searchPlaceholder)
  await searchInput.fill('ぜったいにないよみとうしょくざい')
  await page.waitForTimeout(300)
  check(
    'INLINE-01 検索で該当なしのメッセージが出る',
    // 文言は ja.ts の1か所から読む（2026-08-18 便HS で空の言い回しを型にそろえた際、
    // ここに書き写してあった旧文言だけが取り残されて赤くなった＝禁じ手②）
    stripZwspText(await page.textContent('body')).includes(ja.priceMaster.searchEmpty),
  )
  await searchInput.fill('')
  await page.waitForTimeout(300)

  // 詳細画面に戻り、編集後の価格が概算食費に反映されることを確認する(999円・1食あたり500円)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfter = await page.textContent('body')
  check(
    'PRICE-01 マスタ編集後、詳細の概算食費が更新される(約999円)',
    priceDetailAfter.includes('約999円'),
  )
  check(
    'PRICE-01(修正3a) 「1食あたり」も編集後の価格に追従する(999÷2=約500円)',
    priceDetailAfter.includes('1食あたり 約500円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記は編集後も表示しない',
    !priceDetailAfter.includes('（999円）') && !priceDetailAfter.includes('（目安999円）'),
  )

  // 「デフォルトに戻す」で投入時の価格に復元できることを確認する
  await page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const onionRowAgain = page.locator('li', { hasText: '玉ねぎ' })
  await onionRowAgain.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
  await page.waitForTimeout(400)
  const onionRowTextAfterReset = await onionRowAgain.textContent()
  check(
    'INLINE-01 「デフォルトに戻す」後はボタンが再び消える(未編集扱いに戻る)',
    !onionRowTextAfterReset.includes('デフォルトに戻す'),
  )
  check(
    'INLINE-01 「デフォルトに戻す」で価格が77円に戻る(便LFの前は50円)',
    (await onionRowAgain.getByLabel('玉ねぎの価格（円）').inputValue()) === '77',
  )

  // デフォルトに戻した後は、詳細の概算食費も77円(1食あたり39円)に戻ることを確認する。
  // 材料行ごとの目安価格由来の注記は2026-07-14に機能ごと削除したため、ここでは確認しない
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfterReset = await page.textContent('body')
  check(
    'INLINE-01 「デフォルトに戻す」後は詳細の概算食費も77円に戻る',
    priceDetailAfterReset.includes('約77円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記はデフォルト復元後も表示しない',
    !priceDetailAfterReset.includes('（目安50円）'),
  )

  // 後始末: テスト用レシピを削除（削除は詳細画面からなので、いったんレシピ詳細に戻る）
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- MEALPLAN-01: 献立タブ・週プランナー(第4波ペルソナPDCA Fix1/3/4/5/6。まっさらプロファイル
  // で検証するため専用browser/contextを使う。2026-07-16 便U-1でタブ構成(日/週/月)に再設計。
  // 既定タブは「日」になったため、週タブの検証は明示的に「週」タブへ切り替えてから行う)。
  // Fix1: 週移動の中央チップ(以前は無ラベルの地の文だった)は、当週表示中はaria-labelなし、
  //       当週以外を見ているときだけaria-label(今週へ戻る)が付く「戻るボタン」になっていること
  // Fix3: 何も割り当てていない週は概算食費セクションが非表示、割り当てると表示されること
  // Fix4: 埋まった枠のピッカーを再度開くと、現在のレシピの行に「選択中」バッジが出ること
  // Fix5: 食事帯フィルタ・時短優先トグル・日/週/月タブにaria-pressedが付くこと(見た目は変更なし)
  // Fix6: 最後の1つの食事帯フィルタを外そうとすると無反応ではなく説明トーストが出ること
  // 便U-4: 週タブの「この帯の今週分を空にする」で帯選択+確認confirm→その帯の週エントリが
  //        全削除されること・他の帯には影響しないこと ---
  currentCheck = 'MEALPLAN-01'
  {
    const mpBrowser = await chromium.launch()
    const mpContext = await mpBrowser.newContext()
    const mpPage = await mpContext.newPage()
    mpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-01] ${text}`)
    })
    mpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-01] ${err.message}`)
    })
    // 便U-4の削除確認confirmを自動承認する。2026-08-09 便EK: 規約F(何が消えて何が残るか)の
    // 確認文そのものも検証するので、承認する前に文面を控える
    const mpDialogs = []
    await collectConfirms(mpPage, mpDialogs)
    try {
      await mpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mpPage.waitForTimeout(1800) // 初回シード完了待ち

      // 便U-1: 既定は「日」タブ。以降の検証は週タブの内容が対象なので明示的に切り替える
      const dayTabBtn = mpPage.getByRole('button', { name: '日', exact: true })
      check('MEALPLAN-01(便U-1) 献立タブを開くと既定で「日」タブが選択されている', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')
      await mpPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mpPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mpPage.waitForTimeout(300)

      // Fix3: まっさらプロファイル・未割当時は概算食費セクションが無い
      const mpEmptyText = await mpPage.textContent('body')
      check(
        'MEALPLAN-01(Fix3) 未割当時は概算食費セクションが無い',
        !mpEmptyText.includes(ja.mealPlan.weekCostTitle),
      )

      // Fix1: 週移動の中央チップ。まず当週表示中はaria-labelが無いことを確認
      const weekCenterBtn = mpPage.locator('button', { hasText: '〜' }).first()
      const weekTextAtCurrent = (await weekCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-01(Fix1) 当週表示中は中央チップにaria-labelが無い',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )
      await mpPage.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).click()
      await openAllWeekDays(mpPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 「次の週」で来週へ→中央チップにaria-label(今週へ戻る)が付く',
        (await weekCenterBtn.getAttribute('aria-label')) === '今週へ戻る',
      )
      await weekCenterBtn.click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 中央チップをタップすると当週へ戻る(日付レンジが元に戻る)',
        (await weekCenterBtn.textContent())?.trim() === weekTextAtCurrent,
      )
      check(
        'MEALPLAN-01(Fix1) 当週へ戻った後は中央チップのaria-labelが再び消える',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )

      // Fix4+Fix3: 空き枠に「肉じゃが」を割り当てる(ピッカー経由)。
      // 2026-07-24 便BH-3・タスク5: 空き枠は「未定」テキストから「レシピを選ぶ」ボタンに変わった。
      // 2026-08-22 便IV: 空き枠は**編集モードの中にしか出さない**（通常表示は入っている品だけ）。
      // 既定で開いているのは今日のカードなので、その日を編集モードにしてから触る
      const mpToday = await mpPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'MEALPLAN-01(便IV) 前提: 今日のカードを編集モードにできた',
        (await openWeekDayEdit(mpPage, mpToday)) === true,
      )
      await mpPage.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      check('MEALPLAN-01(Fix4) ピッカーが開く', (await mpPage.textContent('body')).includes('レシピを選ぶ'))
      await mpPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await mpPage.waitForTimeout(300)
      await mpPage.getByText('肉じゃが', { exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      // 2026-07-24 便BH-3・タスク4: 概算食費は小さな折りたたみ(既定閉)になった。
      // 2026-08-25 便KU: その折りたたみは節に一本化された（入れ子にしない）。
      // 2026-08-26 便LH: 節は「栄養」「食費」に割れたので、金額は「食費」の節を開いて読む
      await openWeekGroup(mpPage, ja.mealPlan.weekGroupCostTitle)
      await mpPage.waitForTimeout(500)
      const mpAssignedText = await mpPage.textContent('body')
      check('MEALPLAN-01(Fix3) 割り当てると概算食費セクションが出る', mpAssignedText.includes(ja.mealPlan.weekCostTitle))
      const mpCostText = await mpPage.textContent('body')
      const costMatch = mpCostText.match(/約([\d,]+)円/)
      check(
        'MEALPLAN-01(Fix3) 表示された概算食費は0円ではない',
        !!costMatch && Number(costMatch[1].replace(/,/g, '')) > 0,
        `costMatch=${costMatch?.[0]}`,
      )
      check(
        'MEALPLAN-01(便BH-3・タスク8) 概算食費に「◯食分」が併記される',
        /\d+食分/.test(mpCostText),
      )
      check(
        'MEALPLAN-01(Fix3) 概算食費セクションにマスタ由来の注記は出ない' +
          '(2026-07-13 オーナー実機フィードバックで詳細に続き週の献立側も削除)',
        !mpCostText.includes('一部は目安価格から計算しています'),
      )

      // 2026-07-14: 概算食費欄のリンク文言を「食材と価格を編集する」に変更し、
      // 遷移先も/recipesから/prices(食材と価格ページ)に変更した
      const weekCostLink = mpPage.getByRole('link', { name: '食材と価格を編集する' })
      check(
        'MEALPLAN-01(修正1a) 概算食費欄のリンク文言が「食材と価格を編集する」になる',
        await weekCostLink.isVisible(),
      )
      check(
        'MEALPLAN-01(修正1a) リンクの遷移先が/prices(食材と価格ページ)になる',
        (await weekCostLink.getAttribute('href'))?.includes('/prices'),
      )

      // Fix4: 埋まった枠を再度開くと現在のレシピ行に「選択中」バッジが出る
      await mpPage.getByRole('button', { name: '肉じゃが' }).first().click()
      await mpPage.waitForTimeout(400)
      const currentPickRow = mpPage.locator('li', { hasText: ja.mealPlan.pickCurrentBadge })
      check('MEALPLAN-01(Fix4) 「選択中」バッジが出る', await currentPickRow.isVisible())
      check(
        'MEALPLAN-01(Fix4) 「選択中」バッジは現在のレシピ(肉じゃが)の行に付く',
        (await currentPickRow.textContent())?.includes('肉じゃが'),
      )
      await mpPage.locator(`button[aria-label="${ja.common.close}"]`).click()
      await mpPage.waitForTimeout(300)

      // Fix5: aria-pressed(見た目は変更しない)
      // 2026-08-09 便EN(オーナー指示): 「献立を提案」グループは既定で畳んである。
      // 中の操作(提案の条件・入れかた・先週コピー)を触る前に開く
      await openWeekGroup(mpPage, ja.mealPlan.weekGroupAutoTitle)
      await mpPage.waitForTimeout(300)
      // 2026-07-16 UI総点検A-3で既定折りたたみ → 2026-08-19 便ID・④で**窓**になった。
      // 条件は窓の中にあるので、開いて触り、触り終えたら閉じてから次の操作へ移る
      const suggestConditionsOpenBtn = mpPage.locator('[data-testid="plan-conditions-open"]')
      const suggestConditionsModal = mpPage.locator('[data-testid="plan-conditions-modal"]')
      check(
        'MEALPLAN-01(便ID・④) 現在の条件の窓は、押すまで開いていない',
        (await suggestConditionsModal.count()) === 0,
      )
      await suggestConditionsOpenBtn.click()
      await mpPage.waitForTimeout(400)
      check('MEALPLAN-01(便ID・④) 「現在の条件」を押すと窓が開く', (await suggestConditionsModal.count()) === 1)
      // 2026-08-20 便II・①: 「調理時間◯分以内を優先」のチップ＋分数のプルダウンをやめ、
      // プルダウン1つ（指定なし／◯分以内）にした
      const quickSelect = mpPage.locator('[data-testid="plan-quick-minutes"]')
      check('MEALPLAN-01(便II・①) 調理時間の条件は既定で「指定なし」', (await quickSelect.inputValue()) === '')
      await quickSelect.selectOption('15')
      await mpPage.waitForTimeout(200)
      check('MEALPLAN-01(便II・①) 分数を選ぶとその条件が効く', (await quickSelect.inputValue()) === '15')
      await quickSelect.selectOption('') // 元に戻す
      await mpPage.waitForTimeout(200)
      await mpPage.locator('[data-testid="plan-conditions-close"]').click()
      await mpPage.waitForTimeout(400)
      // 2026-08-29: 週タブに「入れる食事」のチップ（便MK）が増え、同じ画面に「夕食」という名前の
      // ボタンが2つ並んだ。**どちらの群のボタンかまで指す**（名前だけで掴むと strict mode で中断する）
      const mpSlotFilter = mpPage.getByLabel(ja.mealPlan.slotFilterTitle)
      const breakfastFilterBtn = mpSlotFilter.getByRole('button', { name: ja.mealPlan.slot.breakfast, exact: true })
      const lunchFilterBtn = mpSlotFilter.getByRole('button', { name: ja.mealPlan.slot.lunch, exact: true })
      const dinnerFilterBtn = mpSlotFilter.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true })
      // 2026-07-13更新: 新規ユーザーの既定表示食事帯は「夕食のみ」(オーナー判断・プレッシャー軽減)。
      // まっさらプロファイルで検証しているこのテストでは朝食/昼食=false、夕食=trueが既定になる
      check(
        'MEALPLAN-01(Fix5・2026-07-13更新) 食事帯フィルタは新規ユーザーの既定で夕食だけaria-pressed=true',
        (await breakfastFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await lunchFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )
      const weekToggleBtn = mpPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true })
      const monthToggleBtn = mpPage.getByRole('button', { name: '月', exact: true })
      check(
        'MEALPLAN-01(Fix5・便U-1) 日/週/月タブにもaria-pressedが付く(週表示中はfalse/true/false)',
        (await dayTabBtn.getAttribute('aria-pressed')) === 'false' &&
          (await weekToggleBtn.getAttribute('aria-pressed')) === 'true' &&
          (await monthToggleBtn.getAttribute('aria-pressed')) === 'false',
      )

      // Fix6(2026-07-13更新): 既定で夕食だけが表示中なので、その最後の1つを外そうとすると
      // 説明トーストが出て外れないことを直接確認する(以前は昼食/夕食を手動で外して朝食だけに
      // してから検証していたが、新既定で夕食のみのため不要になった)
      await dinnerFilterBtn.click() // 最後の1つ(夕食)を外そうとする
      await mpPage.waitForTimeout(300)
      check(
        'MEALPLAN-01(Fix6) 最後の1枠(夕食)を外そうとすると説明トーストが出る',
        stripZwspText(await mpPage.textContent('body')).includes(ja.mealPlan.slotFilterKeepOne),
      )
      check(
        'MEALPLAN-01(Fix6) 夕食フィルタは外れずaria-pressed=trueのまま',
        (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )

      // 2026-08-09 便EK: 「選んでいない食事は残る」を件数で断定するための土台を作る。
      // ここまでで献立が入っているのは夕食(肉じゃが)だけなので、消す側だけを見ても
      // 「消えた」しか言えない。昼食を表示に足して1品入れ、残る側にも中身を持たせる
      await lunchFilterBtn.click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(便EK) 前提: 昼食を表示に足せた(残る側の食事を用意する)',
        (await lunchFilterBtn.getAttribute('aria-pressed')) === 'true',
      )
      await mpPage.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      await mpPage.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('ほうれん草のおひたし')
      await mpPage.waitForTimeout(300)
      await mpPage.getByText('ほうれん草のおひたし', { exact: true }).first().click()
      await mpPage.waitForTimeout(500)
      /** 献立(mealPlans)を食事ごとに数える。まっさらプロファイルなのでこの週の分しか無い */
      const mpSlotCounts = () =>
        mpPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () => {
                  const counts = { breakfast: 0, lunch: 0, dinner: 0 }
                  g.result.forEach((e) => {
                    counts[e.slot] = (counts[e.slot] ?? 0) + 1
                  })
                  resolve(counts)
                }
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
      const mpBeforeClear = await mpSlotCounts()
      check(
        'MEALPLAN-01(便EK) 前提: 消す側(夕食)と残る側(昼食)の両方に献立が入っている',
        mpBeforeClear.dinner > 0 && mpBeforeClear.lunch > 0,
        `before=${JSON.stringify(mpBeforeClear)}`,
      )

      // 便U-4 → 便CW-3 → 便DE-12で「表示している週の◯◯をまとめて空にする」に改名 →
      // 2026-08-03 便DJ(オーナー指示)で「表示のしかた」グループの中へ移動し、対象の食事を
      // 複数選べるようにした。ここまでの操作で月曜夕食の主菜行に「肉じゃが」が割り当て済み(Fix4)。
      // まず「表示のしかた」が畳まれていて中身が見えないことを確かめてから開く
      check(
        'MEALPLAN-01(便DJ) 「表示のしかた」は既定で畳まれ、空にする操作も見えない',
        (await mpPage.getByRole('button', { name: '空にする食事として夕食を選ぶ' }).count()) === 0,
      )
      await mpPage.getByRole('button', { name: '表示のしかたを開く' }).click()
      await mpPage.waitForTimeout(300)
      // 対象の食事は既定で「夕食」なので、選び直しは不要にconfirmだけ操作する。
      // aria-labelで対象の食事ボタン(表示帯フィルタの「夕食」ボタンとは別物)を特定する
      const clearDinnerTargetBtn = mpPage.getByRole('button', { name: '空にする食事として夕食を選ぶ' })
      check(
        'MEALPLAN-01(便U-4) 対象の食事ボタンは既定で「夕食」がaria-pressed=true',
        (await clearDinnerTargetBtn.getAttribute('aria-pressed')) === 'true',
      )
      // 便DJ: 複数選択。朝食も足してから空にすると、選んだ2つが両方消える
      const clearBreakfastTargetBtn = mpPage.getByRole('button', {
        name: '空にする食事として朝食を選ぶ',
      })
      await clearBreakfastTargetBtn.click()
      await mpPage.waitForTimeout(200)
      check(
        'MEALPLAN-01(便DJ) 空にする食事は複数選べる(朝食+夕食がaria-pressed=true)',
        (await clearBreakfastTargetBtn.getAttribute('aria-pressed')) === 'true' &&
          (await clearDinnerTargetBtn.getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MEALPLAN-01(便DJ) 見出しは選んだ食事を並べて出す',
        ((await mpPage.textContent('body')) ?? '').includes('表示している週の朝食・夕食をまとめて空にする'),
      )
      mpDialogs.length = 0
      await mpPage.getByRole('button', { name: ja.mealPlan.clearWeekSlotButton, exact: true }).click()
      await mpPage.waitForTimeout(600)
      check(
        'MEALPLAN-01(便U-4/便DJ) 確認後、選んだ食事を並べた削除完了のトーストが出る',
        (await mpPage.textContent('body')).includes('表示している週の朝食・夕食の予定を'),
      )
      check(
        'MEALPLAN-01(便U-4/便CW-3) 手で選んで入れた「肉じゃが」も消える(改名の根拠になる実挙動)',
        (await mpPage.getByText('肉じゃが', { exact: true }).count()) === 0,
      )
      // 2026-08-09 便EK: 「消えた」だけでなく「選んでいない食事は残る」も件数で断定する。
      // 消える側が0件になったことと、残る側が1件も減っていないことを対で見る
      const mpAfterClear = await mpSlotCounts()
      check(
        'MEALPLAN-01(便EK) 選んだ食事(朝食・夕食)の予定は0件になる',
        mpAfterClear.dinner === 0 && mpAfterClear.breakfast === 0,
        `before=${JSON.stringify(mpBeforeClear)} / after=${JSON.stringify(mpAfterClear)}`,
      )
      check(
        'MEALPLAN-01(便EK) 選んでいない昼食の予定は1件も減らない(件数まで同じ)',
        mpAfterClear.lunch === mpBeforeClear.lunch && mpAfterClear.lunch > 0,
        `before=${JSON.stringify(mpBeforeClear)} / after=${JSON.stringify(mpAfterClear)}`,
      )
      check(
        'MEALPLAN-01(便EK) 昼食に入れた「ほうれん草のおひたし」は画面にも残る',
        (await mpPage.getByText('ほうれん草のおひたし', { exact: true }).count()) > 0,
      )
      check(
        'MEALPLAN-01(便EK・規約F) 確認文が残る食事とその件数を名指しする',
        mpDialogs.some((m) =>
          m.includes(`他の食事（昼食）の予定${mpBeforeClear.lunch}品は残ります`),
        ),
        `dialogs=${JSON.stringify(mpDialogs)}`,
      )
      check(
        'MEALPLAN-01(便EK・規約F) 確認文が消える品数も書く',
        mpDialogs.some((m) =>
          new RegExp(`表示している週の朝食・夕食の予定${mpBeforeClear.dinner}品を削除します`).test(m),
        ),
        `dialogs=${JSON.stringify(mpDialogs)}`,
      )

      // 2026-07-29 便CD/MP-02: 「今日から7日間」表示の曜日ラベルが日付と一致すること。
      // 従来は7日カードの並び順(配列インデックス)で曜日を引いていたため、今日が月曜の日以外は
      // 表示中の7行すべての曜日が日付と食い違っていた(水曜に「月 2026/07/29 今日」と出る)。
      // このモードは自動テストが1件も無く、ユーザーからも報告されにくい盲点だったので恒久化する
      // 「表示のしかた」グループは上の「まとめて空にする」の検証で既に開いてある(2026-08-03 便DJ)
      await selectWeekLayout(mpPage, ja.mealPlan.weekLayoutRolling)
      await mpPage.waitForTimeout(500)
      // 曜日の名前も画面の文言。evaluate の中はブラウザ側なので**引数で渡す**（便JM）
      const rollingHeads = await mpPage.evaluate((dow) => {
        const found = []
        const mismatch = []
        document.querySelectorAll('h2').forEach((h) => {
          const m = (h.textContent ?? '').match(/^([月火水木金土日])\s+(\d{4})\/(\d{2})\/(\d{2})/)
          if (!m) return
          const d = new Date(`${m[2]}-${m[3]}-${m[4]}T00:00:00`)
          const expected = dow[(d.getDay() + 6) % 7]
          found.push(`${m[1]} ${m[2]}/${m[3]}/${m[4]}`)
          if (expected !== m[1]) mismatch.push(`${m[2]}/${m[3]}/${m[4]} は${expected}なのに${m[1]}と表示`)
        })
        return { found, mismatch }
      }, ja.mealPlan.dow)
      check(
        'MEALPLAN-01(便CD/MP-02) 「今日から7日間」で7日分のカード見出しが出る',
        rollingHeads.found.length === 7,
        `found=${rollingHeads.found.length}`,
      )
      check(
        'MEALPLAN-01(便CD/MP-02) 「今日から7日間」の曜日ラベルが日付と一致する',
        rollingHeads.mismatch.length === 0,
        rollingHeads.mismatch.join(' / '),
      )
    } finally {
      await mpBrowser.close()
    }
  }

  // --- NUTRI-DAY-01 / NUTRI-WEEK-01: 栄養バランス献立 第1段「見える化」の無料視点
  // (2026-07-30 便CL・docs/60 第1段 / 2026-08-01 線引きB'で無料側の内訳を変更)。
  // ・週タブの各日カードに「この日の献立の栄養（1人分の概算）」が1行(**無料は kcal・野菜g の2値**)で出ること
  // ・週まとめに「表示している週の献立の栄養（1人分の概算）」が同じ構成で出ること
  // ・展開すると1日の目安が**説明文1行**で出ること(2026-08-02 便CW-7で並置UIから置換。
  //   **無料は野菜350gだけ**で、塩分の目安はPro側。不足・過多の断定をしない=
  //   「足りません」「摂りすぎ」の語がどこにも出ないこと)
  // ・成分値の出典と「目安の出典」が別行で出ること
  // ・**未解錠(無料)では8項目が出ないこと**(たんぱく質・塩分等の実数値が出ず、鍵付き導線になること)
  // 「まとめて献立を入力」の対象を7日ぶん確実にするため「今日から7日間」表示に切り替えてから行う
  // (週区切り表示だと実行日の曜日次第で対象日数が変わり、目安の日数が日替わりになる) ---
  currentCheck = 'NUTRI-DAY-01'
  {
    const nbBrowser = await chromium.launch()
    const nbContext = await nbBrowser.newContext()
    const nbPage = await nbContext.newPage()
    nbPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@NUTRI-DAY-01] ${text}`)
    })
    nbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUTRI-DAY-01] ${err.message}`)
    })
    try {
      await nbPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nbPage.waitForTimeout(2000) // 初回シード完了待ち
      await nbPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(nbPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await nbPage.waitForTimeout(300)
      // 2026-08-03 便DJ: 「表示のしかた」グループは既定で畳まれているので先に開く
      await nbPage.getByRole('button', { name: '表示のしかたを開く' }).click()
      await nbPage.waitForTimeout(200)
      await selectWeekLayout(nbPage, ja.mealPlan.weekLayoutRolling)
      await nbPage.waitForTimeout(500)

      // 何も割り当てていない週にはパネルを出さない(「0kcal」を7日並べない)
      const nbEmptyText = await nbPage.textContent('body')
      check(
        'NUTRI-DAY-01 未割当時は「この日の献立」の行が出ない',
        !nbEmptyText.includes(ja.nutritionBalance.dayTitlePlan),
      )
      check(
        'NUTRI-WEEK-01 未割当時は「表示している週の献立」の行も出ない',
        !nbEmptyText.includes(ja.nutritionBalance.weekTitle),
      )

      await nbPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await nbPage.waitForTimeout(1200)
      const nbFilledText = await nbPage.textContent('body')
      check(
        'NUTRI-DAY-01 献立を入れると各日カードに「この日の献立の栄養（1人分の概算）」が出る',
        nbFilledText.includes(ja.nutritionBalance.dayTitlePlan),
      )
      const dayToggles = nbPage.getByRole('button', { name: jaRe(ja.nutritionBalance.dayToggleExpand, {}, { exact: true }) })
      check(
        'NUTRI-DAY-01 7日分すべてに折りたたみの栄養行が出る(読み上げ名に日付が入る)',
        (await dayToggles.count()) === 7,
        `count=${await dayToggles.count()}`,
      )
      // 既定は1行だけ(目安の説明は展開時のみ。2026-07-11の「面積を取りすぎる」の再発防止)
      check(
        'NUTRI-DAY-01 既定は1行=目安の説明は畳まれている',
        !nbFilledText.includes(NB_GUIDE_VEG),
      )
      // 1行の中身(無料): kcal・野菜gの2値。塩分は2026-08-01 線引きB'でPro側へ移した
      check(
        'NUTRI-DAY-01 1行に「約◯kcal」が出る',
        /約[\d,]+kcal/.test(nbFilledText),
      )
      check(
        "NUTRI-DAY-01(B') 無料の1行に「塩分約◯g」は出ない",
        !/塩分約[\d.]+g/.test(nbFilledText),
        '無料の1行に塩分が残っている',
      )
      check(
        'NUTRI-DAY-01(docs/60 §7 未決#3) 野菜量は無料でも1行に出る',
        /野菜約[\d,]+g/.test(nbFilledText),
      )
      // 2026-08-25 便KU: 週まとめの栄養は節の中（既定は畳んである）。2026-08-26 便LHで節は「栄養」。
      // **節を開いてから**読む＝上の nbFilledText（節を開く前の画面）では出ていない
      await openWeekGroup(nbPage, ja.mealPlan.weekGroupNutritionTitle)
      await nbPage.waitForTimeout(600)
      check(
        'NUTRI-WEEK-01 週まとめに「表示している週の献立の栄養（1人分の概算）」が出る',
        ((await nbPage.textContent('body')) ?? '').includes(ja.nutritionBalance.weekTitle),
      )

      // 日カードを展開して目安の説明文・注記・出典・鍵付き導線を確認する
      await dayToggles.first().click()
      await nbPage.waitForTimeout(400)
      // 2026-08-09 便EN(オーナー指示「注意説明が長い」): 但し書きと出典は中で畳んだので、
      // 中身を読む前に「注記と出典」を開く（畳んだままでも出る行は先に見張る）
      const nbDayFoldedText = await nbPage.textContent('body')
      check(
        'NUTRI-DAY-01(便EN) 但し書きと出典は畳んである(開くまで出典は出ない)',
        !nbDayFoldedText.includes('出典: 日本食品標準成分表（八訂）増補2023年（文部科学省）'),
      )
      check(
        'NUTRI-DAY-01(便EN) 畳んだままでも「合計に何が入っていないか」の1行は出す',
        nbDayFoldedText.includes(ja.nutritionBalance.registeredOnlyNote),
      )
      await nbPage.getByRole('button', { name: '注記と出典' }).first().click()
      await nbPage.waitForTimeout(300)
      const nbDayOpenText = await nbPage.textContent('body')
      check(
        'NUTRI-DAY-01(便CW-7) 展開すると1日の目安が説明文1行で出る(無料は野菜だけ)',
        nbDayOpenText.includes(NB_GUIDE_VEG),
      )
      check(
        "NUTRI-DAY-01(B') 無料では塩分の目安を出さない(値ごとPro側へ移した)",
        !nbDayOpenText.includes('塩分7.5g（男性）'),
        '無料に塩分の目安が残っている',
      )
      check(
        'NUTRI-DAY-01(便CW-7) 自分の数値と目安を並べる旧UIは出さない',
        !nbDayOpenText.includes('目安とくらべる') && !/　／　目安 /.test(nbDayOpenText),
      )
      check(
        "NUTRI-DAY-01(B') 無料は塩分の目安を出さないので、その出典も挙げない",
        !nbDayOpenText.includes('日本人の食事摂取基準（2025年版）'),
      )
      check(
        'NUTRI-DAY-01(docs/60 §7 未決#2) エネルギーには目安の線を引かない',
        !/エネルギー.{0,12}目安 [\d,]+ ?kcal/.test(nbDayOpenText),
      )
      check(
        'NUTRI-DAY-01(docs/60 §1-3-2) 不足・過多を断定する語を出さない',
        !nbDayOpenText.includes('足りません') &&
          !nbDayOpenText.includes('摂りすぎ') &&
          !nbDayOpenText.includes('とりすぎ') &&
          !nbDayOpenText.includes('不足しています'),
      )
      check(
        'NUTRI-DAY-01(規約H・docs/60 §1-3-5) 「監修」「推奨」「減塩」は使わない',
        !nbDayOpenText.includes('監修') &&
          !nbDayOpenText.includes('推奨') &&
          !nbDayOpenText.includes('減塩'),
      )
      check(
        'NUTRI-DAY-01(docs/60 §1-3-3・便CW-8) 「登録したレシピだけの合計」の但し書きが出る',
        nbDayOpenText.includes(ja.nutritionBalance.registeredOnlyNote),
      )
      check(
        // 2026-08-22 便JF・④（オーナー原文「『３食のうち〜』→削除。（略）説明し過ぎで邪魔。」）
        'NUTRI-DAY-01(便JF・④) 「3食のうち夕食だけを〜」の言い換えは出さない',
        !nbDayOpenText.includes('3食のうち夕食だけを登録している場合は'),
      )
      check(
        'NUTRI-DAY-01(docs/60 §1-3-4) 除外分で下限側に出ることの但し書きが出る',
        nbDayOpenText.includes(ja.nutrition.excludedDirectionNoteTotal),
      )
      check(
        'NUTRI-DAY-01 野菜の数え方(いも・豆・きのこ・海藻・果物を含まない)を明示する',
        nbDayOpenText.includes(ja.nutritionBalance.vegetableCountNote),
      )
      check(
        'NUTRI-DAY-01(docs/60 §1-1) 成分値の出典と「目安の出典」を別行で出す',
        nbDayOpenText.includes('出典: 日本食品標準成分表（八訂）増補2023年（文部科学省）') &&
          nbDayOpenText.includes(`${ja.nutritionBalance.guideSourcePrefix}健康日本21（第三次）（厚生労働省）`),
      )
      check(
        'NUTRI-DAY-01 目安の適用範囲(治療中・妊娠中は主治医の指示)を1行置く',
        nbDayOpenText.includes(ja.nutritionBalance.guideScopeNote),
      )
      check(
        'NUTRI-DAY-01(便CW-6) 食事ごとの内訳は無料では出さない(Pro限定)',
        !nbDayOpenText.includes('食事ごとの内訳'),
      )
      // 無料視点の線引き: 8項目の実数値は出さず、鍵付き導線(PRO-01の様式)にする
      check(
        'NUTRI-DAY-01 未解錠では8項目の実数値が出ない(カルシウムのmg値が無い)',
        !/カルシウム\s*[\d,.]+\s*mg/.test(nbDayOpenText),
      )
      check(
        "NUTRI-DAY-01(B') 未解錠では塩分相当量の実数値も出ない",
        !/塩分相当量\s*[\d,.]/.test(nbDayOpenText),
      )
      check(
        'NUTRI-DAY-01 未解錠では鍵付き導線(Pro版で使えます/栄養価8項目の概算)になる',
        nbDayOpenText.includes('Pro版で使えます') && nbDayOpenText.includes('栄養価8項目の概算'),
      )

      // 週まとめを展開: 目安は日数で掛けず、1日分の基準を説明文1行で書く(便CW-7)
      // 2026-08-25 便KU: 週まとめの栄養は節の中（既定は畳んである。節の名前は便LHで「栄養」）
      await openWeekGroup(nbPage, ja.mealPlan.weekGroupNutritionTitle)
      await nbPage.waitForTimeout(500)
      await nbPage.getByRole('button', { name: ja.nutritionBalance.weekToggleExpand }).click()
      await nbPage.waitForTimeout(400)
      const nbWeekOpenText = await nbPage.textContent('body')
      check(
        'NUTRI-WEEK-01(便CW-7) 週まとめも1日分の目安を説明文1行で書く',
        nbWeekOpenText.includes(NB_GUIDE_VEG),
      )
      check(
        'NUTRI-WEEK-01(便CW-7) 目安を日数倍した数字は出さない',
        !/目安 2,450g/.test(nbWeekOpenText) &&
          !nbWeekOpenText.includes('日ぶんに伸ばした数です'),
      )
      check(
        'NUTRI-WEEK-01 週は「過ぎた日は作った記録・明日から先は登録した献立」の基準を明示する',
        nbWeekOpenText.includes(ja.nutritionBalance.weekBasisNote),
      )
      // 2026-08-09 便EK: 今日を含む週は「今日の数え方」も必ず添える(期間カードと同じ文)。
      // 週タブの既定表示は当週なので、この画面には必ず今日が入っている
      check(
        // 2026-08-28 便MB: 文言を書き写していたのを ja から読む形にした（禁じ手②）
        'NUTRI-WEEK-01(便EK) 今日を含む週は今日の数え方も出す(期間カードと同じ言い方)',
        stripZwspText(nbWeekOpenText).includes(ja.nutritionBalance.basisNoteToday),
      )

      // --- 2026-08-02 便CW-10: 「ごはんを含めて計算する」(無料・既定OFF)。
      // ONにすると各食にごはん1杯分の栄養と食費が足され、選択は設定に残る。
      // 量(150g)・成分値・金額はマスタ参照なので、ここでは「増えること」と「残ること」を見る
      const riceCheckbox = nbPage.locator('[data-testid="include-rice"]').first()
      check(
        'NUTRI-DAY-01(便CW-10/便EN) 「1食につきごはん1杯（150g）を足して計算する」が展開部に出る(既定OFF)',
        nbWeekOpenText.includes('1食につきごはん1杯（150g）を足して計算する') &&
          (await riceCheckbox.isChecked()) === false,
      )
      check(
        'NUTRI-DAY-10(便CW-10) 何が起きるかの説明(足す食事・足さない食事)を添える',
        nbWeekOpenText.includes(ja.nutritionBalance.includeRiceHint),
      )
      const kcalNumbers = (text) =>
        Array.from(text.matchAll(/約([\d,]+)kcal/g)).map((m) => Number(m[1].replace(/,/g, '')))
      const beforeRiceKcal = kcalNumbers(nbWeekOpenText)
      // check()ではなくclick(): 表示は設定(IndexedDB)の読み直しで切り替わるため、
      // クリック直後の同期チェックでは まだ false のまま＝check()が「変わらなかった」と判定する
      await riceCheckbox.click()
      await nbPage.waitForTimeout(900)
      check(
        'NUTRI-DAY-01(便CW-10) チェックを押すとONになる',
        await riceCheckbox.isChecked(),
      )
      const afterRiceText = await nbPage.textContent('body')
      const afterRiceKcal = kcalNumbers(afterRiceText)
      check(
        'NUTRI-DAY-01(便CW-10) ONにすると週の合計エネルギーが増える(ごはんぶん)',
        afterRiceKcal.at(-1) > beforeRiceKcal.at(-1),
        `before=${beforeRiceKcal.at(-1)} after=${afterRiceKcal.at(-1)}`,
      )
      // 選択は設定に記憶する(読み込み直しても外れない)
      await nbPage.reload({ waitUntil: 'networkidle' })
      await nbPage.waitForTimeout(1200)
      await nbPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(nbPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await nbPage.waitForTimeout(400)
      await openWeekGroup(nbPage, ja.mealPlan.weekGroupNutritionTitle) // 便KU→便LH
      await nbPage.waitForTimeout(500)
      await nbPage.getByRole('button', { name: ja.nutritionBalance.weekToggleExpand }).click()
      await nbPage.waitForTimeout(400)
      check(
        'NUTRI-DAY-01(便CW-10) 選択は設定に残る(読み込み直してもONのまま)',
        await nbPage.locator('[data-testid="include-rice"]').first().isChecked(),
      )
      // 食費にも同じ選択が効き、何を足した金額なのかを必ず書く
      // （2026-08-25 便KU: 概算食費は節の中。2026-08-26 便LHで「食費」の節に分かれた）
      await openWeekGroup(nbPage, ja.mealPlan.weekGroupCostTitle)
      await nbPage.waitForTimeout(500)
      check(
        'NUTRI-DAY-01(便CW-10) 週の概算食費に「ごはん◯杯分を含めた金額です」を添える',
        jaRe(ja.nutritionBalance.includeRiceCostNote, { n: '\\d+', yen: '[\\d,]+' }).test(
          stripZwspText(await nbPage.textContent('body')),
        ),
      )
    } finally {
      await nbBrowser.close()
    }
  }

  // --- NUTRI-PRO-01: 同じパネルのPro視点(2026-07-30 便CL・docs/60 第1段)。
  // Pro解錠(コード入力UI経由)後は、日カード・週まとめの展開で栄養8項目の実数値＋野菜量が出て、
  // 鍵付き導線が消えること。線引きは2026-08-01のB'(オーナー確定)＝
  // 無料はエネルギー＋野菜量、Proは8項目(食塩相当量を含む)＋野菜量。
  // 塩分の値・塩分の目安並置がPro側にだけ出ることも、ここで見張る ---
  currentCheck = 'NUTRI-PRO-01'
  {
    const npBrowser = await chromium.launch()
    const npContext = await npBrowser.newContext()
    const npPage = await npContext.newPage()
    npPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@NUTRI-PRO-01] ${text}`)
    })
    npPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUTRI-PRO-01] ${err.message}`)
    })
    try {
      await npPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await npPage.waitForTimeout(1800)
      await npPage.getByPlaceholder(ja.settings.unlockCodePlaceholder).fill('UR-96QS-2VSZ')
      await npPage.getByRole('button', { name: ja.settings.unlockActivate, exact: true }).first().click()
      await npPage.waitForTimeout(1000)
      check(
        'NUTRI-PRO-01 前提: Pro解錠が成功する',
        stripZwspText(await npPage.textContent('body')).includes(ja.settings.proActivatedTitle),
      )

      await npPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await npPage.waitForTimeout(900)
      await npPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(npPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await npPage.waitForTimeout(300)
      // 2026-08-03 便DJ: 「表示のしかた」グループは既定で畳まれているので先に開く
      await npPage.getByRole('button', { name: '表示のしかたを開く' }).click()
      await npPage.waitForTimeout(200)
      await selectWeekLayout(npPage, ja.mealPlan.weekLayoutRolling)
      await npPage.waitForTimeout(500)
      // 2026-08-02 便CW-6の「食事ごとの内訳」は2つ以上の食事に献立がある日にだけ出るので、
      // 既定(夕食のみ)に朝食を足してから献立を立てる
      await npPage.getByRole('button', { name: ja.mealPlan.slot.breakfast, exact: true }).click()
      await npPage.waitForTimeout(300)
      await npPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await npPage.waitForTimeout(1500)
      await npPage
        .getByRole('button', { name: jaRe(ja.nutritionBalance.dayToggleExpand, {}, { exact: true }) })
        .first()
        .click()
      await npPage.waitForTimeout(400)
      // 2026-08-09 便EN: 但し書きと出典は折りたたみの中（目安の出典もここ）
      await npPage.getByRole('button', { name: '注記と出典' }).first().click()
      await npPage.waitForTimeout(300)
      const npOpenText = await npPage.textContent('body')
      check('NUTRI-PRO-01 Pro解錠済みでたんぱく質が出る', npOpenText.includes('たんぱく質'))
      check(
        'NUTRI-PRO-01 Pro解錠済みでカルシウムがmg単位の実数値で出る',
        /カルシウム\s*[\d,.]+\s*mg/.test(npOpenText),
      )
      check(
        "NUTRI-PRO-01(B') Pro解錠済みでは塩分相当量の実数値が出る",
        /塩分相当量\s*[\d,.]+\s*g/.test(npOpenText),
      )
      check(
        "NUTRI-PRO-01(B') Pro解錠済みでは1行サマリーにも「塩分約◯g」が出る",
        /塩分約[\d.]+g/.test(npOpenText),
      )
      check(
        'NUTRI-PRO-01 Pro解錠済みでも野菜量は同じパネルに並ぶ',
        /野菜\s*[\d,]+\s*g/.test(npOpenText),
      )
      check(
        'NUTRI-PRO-01 Pro解錠済みでは鍵付き導線が出ない',
        !npOpenText.includes('Pro版で使えます'),
      )
      check(
        'NUTRI-PRO-01(便CW-7) Pro解錠済みは塩分と野菜の目安を説明文1行で出す',
        npOpenText.includes(NB_GUIDE_FULL),
      )
      check(
        "NUTRI-PRO-01(B') 塩分の目安を出すので、その出典もPro側では挙げる",
        npOpenText.includes(
          `${ja.nutritionBalance.guideSourcePrefix}日本人の食事摂取基準（2025年版）（厚生労働省）${ja.nutritionBalance.guideSourceSeparator}健康日本21（第三次）（厚生労働省）`,
        ),
      )
      // 便CW-6: 食事ごとの内訳(Pro)。朝食・夕食の2食に献立があるので小計が2行出る
      check(
        'NUTRI-PRO-01(便CW-6) Pro解錠済みは展開部に「食事ごとの内訳（1人分）」が出る',
        npOpenText.includes(ja.nutritionBalance.slotBreakdownTitle),
      )
      const npSlotRows = await npPage
        .locator('dt', {
          hasText: new RegExp(
            `^(${[ja.mealPlan.slot.breakfast, ja.mealPlan.slot.lunch, ja.mealPlan.slot.dinner]
              .map(reEscape)
              .join('|')})$`,
          ),
        })
        .count()
      check(
        'NUTRI-PRO-01(便CW-6) 内訳は献立のある食事の数だけ並ぶ(朝食・夕食の2行)',
        npSlotRows === 2,
        `rows=${npSlotRows}`,
      )
      // 便CW-10: 「ごはんを含めて計算する」は無料機能だがPro画面にも同じ場所に出る(既定OFF)
      check(
        'NUTRI-PRO-01(便CW-10/便EN) 「1食につきごはん1杯（150g）を足して計算する」が既定OFFで出る',
        npOpenText.includes('1食につきごはん1杯（150g）を足して計算する') &&
          (await npPage.locator('[data-testid="include-rice"]').first().isChecked()) === false,
      )
    } finally {
      await npBrowser.close()
    }
  }

  // --- MEALPLAN-02: 献立タブ・月カレンダー(第4波ペルソナPDCA Fix2)。Pro解錠(実際のコード入力UI経由)
  // →月表示→「前の月」→中央チップにaria-label(今月へ戻る)→タップで当月へ戻ることを確認する。
  // Pro解錠はPRO-FALLBACK-01と同じテスト用コード(docs/22記載・販売用ではない)を使う。
  // 便U-5(2026-07-16 Fable設計: 月タブの日タップは「その日の献立」を窓表示し、従来の
  // 即週ジャンプはモーダル内の「この週を開く」ボタンへ移動)も同じPro解錠済みブラウザで検証する ---
  currentCheck = 'MEALPLAN-02'
  {
    const mp2Browser = await chromium.launch()
    const mp2Context = await mp2Browser.newContext()
    const mp2Page = await mp2Context.newPage()
    mp2Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-02] ${text}`)
    })
    mp2Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-02] ${err.message}`)
    })
    try {
      await mp2Page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(1500)
      // 2026-07-17設定ゼロベース裁定#7: Pro/追加レシピパックの入力欄が1つに統合された
      await mp2Page.getByPlaceholder(ja.settings.unlockCodePlaceholder).fill('UR-96QS-2VSZ')
      await mp2Page.getByRole('button', { name: ja.settings.unlockActivate, exact: true }).first().click()
      await mp2Page.waitForTimeout(1000)
      check(
        'MEALPLAN-02 前提: Pro解錠が成功する',
        stripZwspText(await mp2Page.textContent('body')).includes(ja.settings.proActivatedTitle),
      )

      await mp2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02 前提: Pro解錠済みで月カレンダーが開く(ゲートでない)',
        // 機能の呼び名が変わってもゲートの有無を測れるよう、変わらない側の文で見る
        !(await mp2Page.textContent('body')).includes('Pro版の機能です'),
      )

      const monthCenterBtn = mp2Page.locator('button').filter({ hasText: '/' }).first()
      const monthTextAtCurrent = (await monthCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-02(Fix2) 当月表示中は中央チップにaria-labelが無い',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )
      await mp2Page.locator(`button[aria-label="${ja.mealPlan.prevMonth}"]`).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 「前の月」で先月へ→中央チップにaria-label(今月へ戻る)が付く',
        (await monthCenterBtn.getAttribute('aria-label')) === '今月へ戻る',
      )
      await monthCenterBtn.click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 中央チップをタップすると当月へ戻る(年月表示が元に戻る)',
        (await monthCenterBtn.textContent())?.trim() === monthTextAtCurrent,
      )
      check(
        'MEALPLAN-02(Fix2) 当月へ戻った後は中央チップのaria-labelが再び消える',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )

      // 便U-5: 月タブの日タップは窓表示(モーダル)。まず献立の無い日(今日)をタップ→
      // 「献立がありません」+「この週を開く」が出ること。従来の即週ジャンプが起きない
      // (=タップ直後も月タブのまま)ことも確認する
      const todayCell = mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first()
      await todayCell.click()
      await mp2Page.waitForTimeout(400)
      const monthTabBtn = mp2Page.getByRole('button', { name: '月', exact: true })
      check(
        'MEALPLAN-02(便U-5) 日をタップしても即週ジャンプせず月タブのまま(モーダルが開く)',
        (await monthTabBtn.getAttribute('aria-pressed')) === 'true',
      )
      const dayModal = mp2Page.locator('[role="dialog"]')
      check('MEALPLAN-02(便U-5) その日の献立モーダルが開く', await dayModal.isVisible())
      // 2026-08-23 便JN: 窓は通常表示で開くようになったので、空の日の1行も
      // 週タブの通常表示と同じもの（押す場所の名前まで言う1行）に変わった
      check(
        'MEALPLAN-02(便U-5) 献立の無い日は、献立が無いことと押す場所が1行で分かる',
        stripZwspText(await dayModal.textContent()).includes(ja.mealPlan.weekDayViewEmpty),
      )
      check(
        'MEALPLAN-02(便U-5) モーダルに「この週を開く」ボタンがある',
        await dayModal.getByRole('button', { name: ja.mealPlan.monthDayModalOpenWeek }).isVisible(),
      )
      // ×で閉じられる
      await dayModal.locator(`button[aria-label="${ja.common.close}"]`).click()
      await mp2Page.waitForTimeout(300)
      check('MEALPLAN-02(便U-5) ×でモーダルが閉じる', !(await dayModal.isVisible()))

      // 献立のある日: 今日の日付の夕食に「肉じゃが」をIndexedDB直書きで投入してから
      // 同じ日をタップ→モーダルに食事帯ラベルとレシピ名リンクが出ること
      const mp2RecipeId = await mp2Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.find((r) => r.title === '肉じゃが')?.id)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await mp2Page.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const a = tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId, role: 'main' })
              a.onerror = () => reject(a.error)
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        mp2RecipeId,
      )
      // 素のIndexedDB直書きはDexieのliveQueryキャッシュに検知されない(ハッシュ遷移の
      // 開き直しは同一ドキュメントのためキャッシュも残る)ので、本物のreloadで反映させる
      await mp2Page.reload({ waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      await mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first().click()
      await mp2Page.waitForTimeout(400)
      const dayModalFilled = mp2Page.locator('[role="dialog"]')
      const dayModalFilledText = await dayModalFilled.textContent()
      check(
        'MEALPLAN-02(便U-5) 献立のある日は食事帯ラベル(夕食)とレシピ名が出る',
        dayModalFilledText.includes('夕食') && dayModalFilledText.includes('肉じゃが'),
      )
      // 2026-07-29 便CB-1・docs/59 A-3で、この窓は「閲覧+週を開く」から「その場で編集できる」へ変わった。
      // レシピ名は詳細へのリンクではなく、押すとレシピを選び直せるボタンになる(週タブの行と同じ機構)。
      // 元の検証意図(窓が行き止まりでなく、その日の献立に手が届く)はこの形で引き継ぐ。
      // 2026-08-23 便JN: その編集の面は「編集」を押した先へ移った(週タブと同じ2モード)。
      // 通常表示のままでは出ないので、先に編集モードへ入ってから同じことを見る
      const mp2EditOn = await openMonthDayEdit(mp2Page)
      check('MEALPLAN-02(便JN) 前提: 日の窓を編集モードにできた', mp2EditOn === true, `結果=${mp2EditOn}`)
      const mp2EditText = stripZwspText(await dayModalFilled.textContent())
      check(
        'MEALPLAN-02(便CB-1/A-3) レシピ名は押すと選び直せるボタンになっている(週タブと同じ編集行)',
        (await dayModalFilled.getByRole('button', { name: '肉じゃが' }).count()) > 0,
      )
      check(
        'MEALPLAN-02(便CB-1/A-3) 窓の中に主菜・副菜の行ラベルが出る(役割の粒度を保ったまま編集できる)',
        mp2EditText.includes(ja.mealPlan.role.main) && mp2EditText.includes(ja.mealPlan.role.side),
      )
      // 「この週を開く」で週タブへ移動する(従来の週ジャンプはここへ移動した)
      await dayModalFilled.getByRole('button', { name: ja.mealPlan.monthDayModalOpenWeek }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(便U-5) 「この週を開く」で週タブへ切り替わる',
        (await mp2Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MEALPLAN-02(便U-5) 開いた週に投入済みの肉じゃがが見える(今日を含む週が開いている)',
        (await mp2Page.getByText('肉じゃが', { exact: true }).count()) > 0,
      )
    } finally {
      await mp2Browser.close()
    }
  }

  // --- MEALPLAN-03: 献立タブ・主菜+副菜構成(2026-07-13 Fable設計・オーナー要望。まっさら
  // プロファイルで検証するため専用browser/contextを使う)。
  // ・各枠は既定で「主菜」「副菜」の2行(未定×2)が並ぶこと
  // ・行単位のサイコロは対象の役割の行だけに作用する(枠が部分的に埋まっているとき)こと
  // ・枠が丸ごと空のときのサイコロは主菜+副菜のペアで一度に埋まること
  // ・「＋料理を追加」で行を増やせること
  // ・ジャンルチップ(指定なし/和食/洋食/中華)が単一選択で切り替わること
  // ・「まとめて献立を立てる」ボタンにDicesアイコンが付くこと(Sparklesから変更) ---
  currentCheck = 'MEALPLAN-03'
  {
    const mp3Browser = await chromium.launch()
    const mp3Context = await mp3Browser.newContext()
    const mp3Page = await mp3Context.newPage()
    mp3Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-03] ${text}`)
    })
    mp3Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-03] ${err.message}`)
    })
    try {
      await mp3Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp3Page.waitForTimeout(1800) // 初回シード完了待ち(この時点で表示食事帯は既定の「夕食のみ」)
      // 便U-1: 既定タブは「日」になったため、週プランナーの検証は「週」タブへ切り替えてから行う
      await mp3Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mp3Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp3Page.waitForTimeout(300)
      // 2026-07-16 便W-⑤a: ランダム週献立(サイコロ/まとめて献立)は過去日の枠を対象外にした。
      // このテストは実行日の曜日次第で「当週の月曜」が過去日になりうる(例: 実行日が木曜なら
      // 月〜水は過去)ため、サイコロの行インデックス(nth)が曜日で変わってしまう。
      // 「次の週」へ1回進めば、その週の月曜は実行日が何曜日でも必ず未来日になり、テストが
      // 決定的になる(過去日保護そのものの検証はMEALPLAN-06で別途行う)
      await mp3Page.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).click()
      await openAllWeekDays(mp3Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp3Page.waitForTimeout(300)

      // 2026-08-22 便IV: 週の1日カードは**通常表示（絵と料理名だけ）と編集モード**に分かれ、
      // 空き枠・役割のラベル・サイコロ・「＋料理を追加」は編集モードの中にしか出さなくなった。
      // ここで見たいのは「1日ぶんの枠の作り」なので、**日ごとに編集モードへ入って、その日の
      // カードの中だけを数える**（週7日ぶんの合計で数えると、編集モードが1日ずつであることと
      // 噛み合わない。合計での数え方は他の日の状態にも左右されて壊れやすい）。
      // 使う日は3日: d0=主菜/副菜の行の作りと行単位のサイコロ、d1=枠が丸ごと空のときのペア提案、
      // d2=「＋料理を追加」と空欄行の×
      const mp3Dates = await mp3Page.evaluate(() =>
        [...document.querySelectorAll('section[data-date]')].map((s) => s.getAttribute('data-date')),
      )
      check(
        'MEALPLAN-03 前提: 次の週の7日分のカードが出ている',
        mp3Dates.length === 7,
        `dates=${JSON.stringify(mp3Dates)}`,
      )
      const [mp3D0, mp3D1, mp3D2] = mp3Dates
      /** その日のカードの中だけを見る（他の日の状態に左右されない） */
      const mp3Card = (date) => mp3Page.locator(`section[data-date="${date}"]`)
      const mp3Empty = (date) =>
        mp3Card(date).getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true })

      check(
        'MEALPLAN-03(便IV) 通常表示には空き枠を出さない（入っている品だけを並べる）',
        (await mp3Empty(mp3D0).count()) === 0,
        `空き枠=${await mp3Empty(mp3D0).count()}件`,
      )
      check(
        'MEALPLAN-03(便IV) 前提: 1日目を編集モードにできた',
        (await openWeekDayEdit(mp3Page, mp3D0)) === true,
      )
      // 各枠は既定で主菜+副菜の2行(未定×2)。既定表示は夕食のみなので1日=2件
      check(
        'MEALPLAN-03 編集モードの枠は既定で主菜+副菜の2行(未定×2)が並ぶ',
        (await mp3Empty(mp3D0).count()) === 2,
        `空き枠=${await mp3Empty(mp3D0).count()}件`,
      )
      check(
        'MEALPLAN-03 行に「主菜」「副菜」のラベルが付く',
        (await mp3Card(mp3D0).getByText('主菜', { exact: true }).count()) === 1 &&
          (await mp3Card(mp3D0).getByText('副菜', { exact: true }).count()) === 1,
        `主菜=${await mp3Card(mp3D0).getByText('主菜', { exact: true }).count()} 副菜=${await mp3Card(mp3D0).getByText('副菜', { exact: true }).count()}`,
      )

      // 「まとめて献立を入力」ボタンにアイコン(svg)が付く(SparklesからDicesへ変更。2026-07-13)
      const fillWeekBtn = mp3Page.getByRole('button', { name: ja.mealPlan.fillWeek })
      check(
        'MEALPLAN-03 「まとめて献立を入力」ボタンにアイコンが付く',
        (await fillWeekBtn.locator('svg').count()) > 0,
      )

      // 2026-08-09 便EN(オーナー指示): 「献立を提案」グループは既定で畳んである
      // (2026-08-22 便IVで3節とも畳む既定に戻った)。中の操作を触る前に開く
      await openWeekGroup(mp3Page, ja.mealPlan.weekGroupAutoTitle)
      await mp3Page.waitForTimeout(300)
      // 料理のジャンルは「現在の条件」の窓の中(2026-08-19 便ID・④で折りたたみ→窓)。まず開く
      await mp3Page.locator('[data-testid="plan-conditions-open"]').click()
      await mp3Page.waitForTimeout(400)

      // 料理のジャンル。2026-08-19 便HT(オーナー指示「和洋中選択も同様にプルダウン」)で
      // チップ4つ → プルダウン1つにしたが、2026-08-22 便IY(オーナー原文「複数選択のほうが
      // いいかも」)で**選べるジャンルを並べて選ぶ/外す**形に戻した。既定は3つとも選んだ状態
      const mp3Chips = mp3Page.locator('[data-testid="plan-genre-chip"]')
      const mp3Picked = async () =>
        mp3Chips.evaluateAll((els) =>
          els
            .filter((el) => el.getAttribute('aria-pressed') === 'true')
            .map((el) => el.getAttribute('data-genre')),
        )
      check(
        'MEALPLAN-03 料理のジャンルは選べるジャンルのぶんだけ並ぶ',
        (await mp3Chips.count()) === MEAL_GENRES.length,
        `並び=${await mp3Chips.count()}件`,
      )
      check(
        'MEALPLAN-03 料理のジャンルは既定で全部選ばれている(＝指定なし)',
        JSON.stringify(await mp3Picked()) === JSON.stringify([...MEAL_GENRES]),
        `選ばれている=${JSON.stringify(await mp3Picked())}`,
      )
      await mp3Page.locator(`[data-testid="plan-genre-chip"][data-genre="${MEAL_GENRES[MEAL_GENRES.length - 1]}"]`).click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03 料理のジャンルは1つ外しても残りが選ばれたまま(複数選べる)',
        JSON.stringify(await mp3Picked()) === JSON.stringify(MEAL_GENRES.slice(0, -1)),
        `選ばれている=${JSON.stringify(await mp3Picked())}`,
      )
      // 以降の提案テストに影響しないよう「指定なし」(3つとも選んだ状態)へ戻す
      await mp3Page.locator(`[data-testid="plan-genre-chip"][data-genre="${MEAL_GENRES[MEAL_GENRES.length - 1]}"]`).click()
      await mp3Page.waitForTimeout(300)
      // 「高たんぱく優先」トグルは削除済み(2026-08-09 便EO・オーナー指示)
      check(
        'MEALPLAN-03 「高たんぱく優先」トグルは現在の条件に無い(便EOで削除)',
        (await mp3Page.getByRole('button', { name: '高たんぱく優先', exact: true }).count()) === 0,
      )
      // 窓を閉じてから、後ろの画面(曜日カード)の操作へ移る(2026-08-19 便ID・④)
      await mp3Page.locator('[data-testid="plan-conditions-close"]').click()
      await mp3Page.waitForTimeout(400)

      // 1日目・夕食の主菜行(先頭の空き枠)に「肉じゃが」をピッカーで割り当てる
      await mp3Empty(mp3D0).first().click()
      await mp3Page.waitForTimeout(400)
      await mp3Page.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await mp3Page.waitForTimeout(300)
      await mp3Page.getByText('肉じゃが', { exact: true }).first().click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03 主菜行に肉じゃがを割り当てられる',
        await mp3Card(mp3D0).getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      check(
        'MEALPLAN-03 割り当て後はその日の空き枠が1件減る(2→1)',
        (await mp3Empty(mp3D0).count()) === 1,
        `空き枠=${await mp3Empty(mp3D0).count()}件`,
      )

      // 行単位のサイコロ: 同じ日の副菜行(主菜が埋まっているので枠は「丸ごと空」ではない)だけを
      // 振ると、副菜だけ埋まり主菜(肉じゃが)は変わらない
      const mp3Dice = (date) =>
        mp3Card(date).getByRole('button', { name: ja.mealPlan.suggestAria })
      await mp3Dice(mp3D0).last().click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜だけ自動提案しても主菜(肉じゃが)は変わらない',
        await mp3Card(mp3D0).getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜行が埋まりその日の空き枠が0件になる',
        (await mp3Empty(mp3D0).count()) === 0,
        `空き枠=${await mp3Empty(mp3D0).count()}件`,
      )

      // 空き枠のペア提案: 2日目の夕食は主菜・副菜ともまだ未定→その日の主菜行のサイコロを
      // 振ると、枠が丸ごと空だったため主菜(+副菜)で埋まる。便BH-2で「一品もの(カレー・丼・麺・鍋)の
      // 主菜が選ばれた枠は副菜を空ける」ようになったため、減る未定は2件(通常)か1件(一品もの)。
      // どちらでも主菜は必ず1件埋まる(=最低1件は未定が減る)ことを確認する
      check(
        'MEALPLAN-03(便IV) 前提: 2日目を編集モードにできた',
        (await openWeekDayEdit(mp3Page, mp3D1)) === true,
      )
      const mp3PairBefore = await mp3Empty(mp3D1).count()
      check(
        'MEALPLAN-03(空き枠のペア提案) 前提: 2日目は主菜・副菜とも空いている',
        mp3PairBefore === 2,
        `空き枠=${mp3PairBefore}件`,
      )
      await mp3Dice(mp3D1).first().click()
      await mp3Page.waitForTimeout(400)
      const mp3PairAfter = await mp3Empty(mp3D1).count()
      const pairDelta = mp3PairBefore - mp3PairAfter
      check(
        'MEALPLAN-03(空き枠のペア提案) サイコロ1回で主菜(+副菜)が埋まる(一品ものなら副菜は空く)',
        pairDelta === 1 || pairDelta === 2,
        `before=${mp3PairBefore} after=${mp3PairAfter} delta=${pairDelta}`,
      )

      // ＋料理を追加: 3日目(まだ未着手の日)で主菜をもう1行追加すると「未定」が1件増える
      check(
        'MEALPLAN-03(便IV) 前提: 3日目を編集モードにできた',
        (await openWeekDayEdit(mp3Page, mp3D2)) === true,
      )
      const mp3AddBefore = await mp3Empty(mp3D2).count()
      await mp3Card(mp3D2).getByRole('button', { name: ja.mealPlan.addRow }).first().click()
      await mp3Page.waitForTimeout(200)
      await mp3Card(mp3D2).getByRole('button', { name: '主菜', exact: true }).click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03(＋料理を追加) 行を追加すると空き枠が1件増える',
        (await mp3Empty(mp3D2).count()) === mp3AddBefore + 1,
        `before=${mp3AddBefore} after=${await mp3Empty(mp3D2).count()}`,
      )

      // --- 2026-08-02 便CW-2: 既定の主菜/副菜の空欄行も×で畳める。畳んでも献立データは
      // 消えず(空欄行を隠すだけ)、戻すのは既存の「＋料理を追加」→主菜/副菜。
      // 同じ日の空欄行で、閉じる→同じ役割で戻す、が1行ぶんで往復することを確認する
      const hideBtns = mp3Card(mp3D2).getByRole('button', { name: jaRe(ja.mealPlan.hideEmptyRow, { role: '' }, { end: true }) })
      const beforeHideEmpty = await mp3Empty(mp3D2).count()
      const beforeHideCount = await hideBtns.count()
      // 空欄行は「既定の空欄行(×=閉じる)」と「＋料理を追加で増やした行(×=この追加した行をやめる)」の
      // 2種類。どちらの×も付いていること＝合計が空欄行の数と一致することで確かめる
      const extraRowCloseCount = await mp3Card(mp3D2)
        .getByRole('button', { name: ja.mealPlan.removeExtraRow })
        .count()
      check(
        'MEALPLAN-03(便CW-2) 既定の空欄行にも×(閉じる)が付く',
        beforeHideCount > 0 && beforeHideCount + extraRowCloseCount === beforeHideEmpty,
        `close=${beforeHideCount} extra=${extraRowCloseCount} empty=${beforeHideEmpty}`,
      )
      const lastHideLabel = await hideBtns.last().getAttribute('aria-label')
      const hiddenRole = lastHideLabel?.startsWith('主菜') ? '主菜' : '副菜'
      await hideBtns.last().click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03(便CW-2) ×を押すとその空欄行だけが畳まれる',
        (await mp3Empty(mp3D2).count()) === beforeHideEmpty - 1,
        `before=${beforeHideEmpty} after=${await mp3Empty(mp3D2).count()}`,
      )
      // 戻す: 同じ食事の「＋料理を追加」→畳んだ役割。行が2つに増えず、元の1行に戻ること
      await mp3Card(mp3D2).getByRole('button', { name: ja.mealPlan.addRow }).last().click()
      await mp3Page.waitForTimeout(200)
      await mp3Card(mp3D2).getByRole('button', { name: hiddenRole, exact: true }).click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03(便CW-2) 「＋料理を追加」で畳んだ空欄行が戻る(二重に増えない)',
        (await mp3Empty(mp3D2).count()) === beforeHideEmpty,
        `before=${beforeHideEmpty} after=${await mp3Empty(mp3D2).count()}`,
      )

      // --- 2026-08-02 便CW-1: 朝食/昼食/夕食を1日のカードの中で見分けられること。
      // 3つの食事を表示にしてから、各ブロックの地色と左帯の色が互いに違うことを見る
      // (色そのものはテーマトークン依存なので、値ではなく「3つとも違う」ことだけを固定する)。
      // 2026-08-22 便IV: 通常表示は空の食事の囲みを出さないので、**編集モードの日**で測る
      await mp3Page.getByRole('button', { name: ja.mealPlan.slot.breakfast, exact: true }).click()
      await mp3Page.waitForTimeout(200)
      await mp3Page.getByRole('button', { name: ja.mealPlan.slot.lunch, exact: true }).click()
      await mp3Page.waitForTimeout(400)
      const slotTones = await mp3Page.evaluate((date) => {
        const card = document.querySelector(`section[data-date="${date}"]`)
        return [...(card?.querySelectorAll('[data-testid="slot-block"]') ?? [])]
          .slice(0, 3)
          .map((el) => {
            const cs = getComputedStyle(el)
            return `${el.getAttribute('data-slot')}|${cs.backgroundColor}|${cs.borderLeftColor}`
          })
      }, mp3D2)
      check(
        'MEALPLAN-03(便CW-1) 1日のカードに朝食・昼食・夕食の囲みが並ぶ',
        slotTones.length === 3 &&
          slotTones.map((t) => t.split('|')[0]).join(',') === 'breakfast,lunch,dinner',
        slotTones.join(' / '),
      )
      check(
        'MEALPLAN-03(便CW-1) 3つの食事は地色も左帯の色も互いに違う',
        new Set(slotTones.map((t) => t.split('|')[1])).size === 3 &&
          new Set(slotTones.map((t) => t.split('|')[2])).size === 3,
        slotTones.join(' / '),
      )
      check(
        'MEALPLAN-03(便CW-1) 囲みの左帯は0pxではない(区分が見えている)',
        await mp3Page.$eval(
          '[data-testid="slot-block"]',
          (el) => parseFloat(getComputedStyle(el).borderLeftWidth) > 0,
        ),
      )
      // --- 2026-08-02 便CW-4: 予定の行に小さなサムネ(写真 or 料理アイコン)が付くこと。
      // ここまでにサイコロで料理が入っている行があるので、その行から数える
      check(
        'MEALPLAN-03(便CW-4) レシピが入っている行にはサムネが付く',
        (await mp3Page.locator('[data-testid="row-thumb"]').count()) > 0,
      )
    } finally {
      await mp3Browser.close()
    }
  }

  // --- MEALPLAN-04: 「まとめて献立を入力」の再抽選(修正1b・2026-07-14オーナー実機
  // フィードバック)。以前は空き枠だけ埋めるため2回目以降のタップが無反応だった。
  // 押すたびに枠を一旦クリアしてから主菜+副菜のペアで埋め直す(再抽選)。
  // 2026-08-07 便DT-8(オーナー指示)で入れかたがスイッチになり、再抽選は
  // 「レシピを総入れ替え」側の動きになった(既定は非破壊の「まだ決まっていない枠だけ埋める」)。
  // このテストはスイッチを総入れ替えに倒してから押す。総入れ替えは消す操作なので、
  // 2回目以降は規約Fの確認文が出る＝ダイアログを受け入れてから進む。
  // mealPlansテーブルの行idがクリア→再作成で入れ替わる(削除+追加のため必ず新しいautoIncrement
  // idになる)ことで再抽選を検証する。手動枠が保護されることは MEALPLAN-08 で別途検証する ---
  currentCheck = 'MEALPLAN-04'
  {
    const mp4Browser = await chromium.launch()
    const mp4Context = await mp4Browser.newContext()
    const mp4Page = await mp4Context.newPage()
    mp4Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-04] ${text}`)
    })
    mp4Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-04] ${err.message}`)
    })
    try {
      // 総入れ替えの確認文(規約F)は自動で受け入れる。何が出たかは本文の検査で別途見る
      let mp4DialogText = ''
      await collectConfirms(mp4Page, (text) => {
        mp4DialogText = text
      })
      await mp4Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp4Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      // 便U-1: 既定タブは「日」になったため、「まとめて献立を入力」がある「週」タブへ切り替える
      await mp4Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mp4Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp4Page.waitForTimeout(300)
      // 2026-07-16 便W-⑤a: 過去日はまとめて献立の対象外になったため、実行日の曜日に関係なく
      // 「7日×主菜+副菜=14件が全部埋まる」を保証するには表示中の週を全日程未来にする必要がある
      // (MEALPLAN-03と同じ理由。「次の週」に進めば当週の月曜は実行日に関わらず必ず未来日)
      await mp4Page.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).click()
      await openAllWeekDays(mp4Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp4Page.waitForTimeout(300)

      // 便BH-2: 一品もの(カレー・丼・麺・鍋)の主菜が選ばれた枠は副菜を空けるため、埋まる件数は
      // 7(全部一品もの)〜14(全部通常)の範囲でばらつく。件数固定ではなく「毎日必ず主菜が1件立つ」
      // という不変条件で検証する。あわせて主菜・レシピのdishTypeも読む
      const dinnerRows = () =>
        mp4Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
                const mpReq = tx.objectStore('mealPlans').getAll()
                const rcReq = tx.objectStore('recipes').getAll()
                let mp, rc
                const done = () => {
                  if (mp === undefined || rc === undefined) return
                  const dishTypeById = new Map(rc.map((r) => [r.id, r.dishType]))
                  resolve(
                    mp
                      .filter((row) => row.slot === 'dinner')
                      .map((row) => ({
                        id: row.id,
                        role: row.role,
                        dishType: dishTypeById.get(row.recipeId),
                      })),
                  )
                }
                mpReq.onsuccess = () => {
                  mp = mpReq.result
                  done()
                }
                rcReq.onsuccess = () => {
                  rc = rcReq.result
                  done()
                }
                mpReq.onerror = () => reject(mpReq.error)
                rcReq.onerror = () => reject(rcReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // 2026-08-09 便EN(オーナー指示): 「献立を提案」グループは既定で畳んである。
      // 中の操作(提案の条件・入れかた・先週コピー)を触る前に開く
      await openWeekGroup(mp4Page, ja.mealPlan.weekGroupAutoTitle)
      await mp4Page.waitForTimeout(300)
      // 便DT-8: 入れかたを「総入れ替え」に倒す(既定は非破壊の「空いた枠だけ」)。
      // 2026-08-20 便II・④: 入れかたはプルダウンになった
      await mp4Page.locator('[data-testid="fill-mode"]').selectOption('replaceAll')
      await mp4Page.waitForTimeout(200)
      check(
        `MEALPLAN-04(便DT-8) 入れかたを「${ja.mealPlan.fillModeReplaceAll}」に切り替えられる`,
        (await mp4Page.locator('[data-testid="fill-mode"]').inputValue()) === 'replaceAll',
        `いまの入れかた=${await mp4Page.locator('[data-testid="fill-mode"]').inputValue()}`,
      )
      const fillWeekBtn = mp4Page.getByRole('button', { name: ja.mealPlan.fillWeek })
      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      const rowsAfterFirst = await dinnerRows()
      const mainsAfterFirst = rowsAfterFirst.filter((r) => r.role === 'main')
      check(
        'MEALPLAN-04 1回目の「まとめて献立を立てる」で7日すべてに主菜が1件立つ',
        mainsAfterFirst.length === 7,
        `主菜=${mainsAfterFirst.length}件`,
      )
      check(
        'MEALPLAN-04 1回目の合計は7〜14件(一品ものの日は副菜が空く)',
        rowsAfterFirst.length >= 7 && rowsAfterFirst.length <= 14,
        `合計=${rowsAfterFirst.length}件`,
      )
      // 便BH-2 タスク2: 主菜スロットは必ずdishType=mainのレシピから選ばれる(野菜炒め=side等は主菜に来ない)
      check(
        'MEALPLAN-04 主菜は必ずdishType=mainのレシピから選ばれる',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        mainsAfterFirst.length > 0 && mainsAfterFirst.every((r) => r.dishType === 'main'),
        `主菜のdishType=${JSON.stringify(mainsAfterFirst.map((r) => r.dishType))}`,
      )
      const idsAfterFirst = rowsAfterFirst.map((r) => r.id)

      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      const rowsAfterSecond = await dinnerRows()
      check(
        'MEALPLAN-04 2回目のタップも無反応にならず、7日すべてに主菜が立つ(以前は無反応バグがあった)',
        rowsAfterSecond.filter((r) => r.role === 'main').length === 7,
      )
      check(
        'MEALPLAN-04(便DT-8) 総入れ替えは消す前に確認文を出し、消える件数と残るものを両方書く(規約F)',
        mp4DialogText.includes('消えるもの') &&
          mp4DialogText.includes('作った記録') &&
          /\d+品/.test(mp4DialogText),
        `dialog=${mp4DialogText}`,
      )
      const idsAfterSecond = rowsAfterSecond.map((r) => r.id)
      const overlappingIds = idsAfterSecond.filter((id) => idsAfterFirst.includes(id))
      check(
        'MEALPLAN-04 2回目は「全部埋まっているので無視」ではなく、全行を一旦クリアしてから' +
          '再作成する(旧idが1件も残らない=以前の「空き枠だけ埋める」実装なら2回目は無反応で' +
          'idが完全一致していたはず)',
        overlappingIds.length === 0,
        `overlap=${JSON.stringify(overlappingIds)}`,
      )
    } finally {
      await mp4Browser.close()
    }
  }

  // --- MEALPLAN-05: 日タブの週プラン自動取り込み(便U-3・2026-07-16 Fable設計)。
  // 日タブを開いたとき、今日の日付の週プラン登録(表示中の食事帯のみ)が今日の献立へ
  // 自動で取り込まれること。加えて冪等性の2点:
  //  (a) 2回開いても重複しない(importRecipeIdsToTodayListの重複スキップ+lastAutoImportDate)
  //  (b) 取り込まれた品をユーザーが消した後にもう一度開いても、その日のうちは再出現しない
  //      (settings.lastAutoImportDateに今日の日付が記録済みのため自動実行がスキップされる)
  // 非表示帯(朝食)の登録は取り込まれないことも確認する。まっさらプロファイル(新規ユーザー
  // 既定=夕食のみ表示)で検証するため専用browser/contextを使う ---
  currentCheck = 'MEALPLAN-05'
  {
    const mp5Browser = await chromium.launch()
    const mp5Context = await mp5Browser.newContext()
    const mp5Page = await mp5Context.newPage()
    mp5Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-05] ${text}`)
    })
    mp5Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-05] ${err.message}`)
    })
    try {
      // まずレシピ一覧で初回シードを済ませ、今日の週プランをIndexedDB直書きで用意する:
      // 夕食(表示帯)に肉じゃが(主菜)+カレーライス(副菜扱い)、朝食(非表示帯)に豚の生姜焼き
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1800) // 初回シード完了待ち
      const seeded = await mp5Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const byTitle = (t) => g.result.find((r) => r.title === t)?.id
                const nikujaga = byTitle('肉じゃが')
                const curry = byTitle('カレーライス')
                const shogayaki = byTitle('豚の生姜焼き')
                if (!nikujaga || !curry || !shogayaki) {
                  resolve({ ok: false })
                  return
                }
                const wtx = idb.transaction('mealPlans', 'readwrite')
                const store = wtx.objectStore('mealPlans')
                store.add({ date, slot: 'dinner', recipeId: nikujaga, role: 'main' })
                store.add({ date, slot: 'dinner', recipeId: curry, role: 'side' })
                store.add({ date, slot: 'breakfast', recipeId: shogayaki, role: 'main' })
                wtx.oncomplete = () => resolve({ ok: true })
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('MEALPLAN-05 前提: 今日の週プラン(夕食2件+朝食1件)を直接投入できる', seeded.ok)

      // 投入したら**必ずページを読み込み直す**(2026-08-22 司令部・禁じ手⑤の親戚)。
      // ここは mealPlans を Dexie を通さず生のIndexedDBへ書いている。Dexieのライブ購読は
      // 「Dexie経由の書き込み」しか見ていないので、**その画面がすでに mealPlans を読んでいると、
      // 生書き込みは届かないまま空の結果が使い回される**。/#/recipes → /#/meal-plan は
      // ハッシュが変わるだけ＝同じドキュメントなので、購読は張り直されない。
      // 2026-08-21 便IU・⑦でレシピ一覧が「今日の予定」を読むようになった結果、この節の
      // 6件が丸ごと落ちた（アプリの不具合ではなく、この手順の脆さ）。実利用ではDexie経由で
      // 書くので同じことは起きない。読み込み直せば購読が張り直され、投入済みのデータを読む。
      await mp5Page.reload({ waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(600)

      // todayListの実データを直接読むヘルパー(重複の有無を黒箱の見た目でなくDBで断定する)
      const todayListRecipeIds = () =>
        mp5Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('todayList', 'readonly')
                const g = tx.objectStore('todayList').getAll()
                g.onsuccess = () => resolve(g.result.map((row) => row.recipeId))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // 1回目: 献立タブを開く(既定=日タブ)→夕食の2件だけが自動で今日の献立に入る
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200) // 自動取り込み+liveQuery反映待ち
      const mp5BodyAfterFirst = await mp5Page.textContent('body')
      check(
        'MEALPLAN-05 日タブを開くと夕食(表示帯)の週プラン2件が今日の献立に自動で入る',
        mp5BodyAfterFirst.includes('肉じゃが') && mp5BodyAfterFirst.includes('カレーライス'),
      )
      const idsAfterFirstOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05 朝食(非表示帯)の登録は今日の献立(todayList)に取り込まれない',
        idsAfterFirstOpen.length === 2,
        `ids=${JSON.stringify(idsAfterFirstOpen)}`,
      )
      // 2026-08-03 便DH: 日タブは今日の週プランを朝食・昼食・夕食すべて並べる(取り込みの対象=
      // 表示帯だけ、という切り分けは上のtodayListの件数で担保する)
      check(
        'MEALPLAN-05(便DH) 取り込まない朝食の予定も「今週の献立の予定」には並ぶ',
        mp5BodyAfterFirst.includes('豚の生姜焼き') && mp5BodyAfterFirst.includes('今週の献立の予定'),
      )

      // 2回目: 一旦別ページへ抜けて開き直す(再マウント)→重複しない(冪等)
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterSecondOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(冪等) 2回開いてもtodayListは2件のまま重複しない',
        idsAfterSecondOpen.length === 2,
        `ids=${JSON.stringify(idsAfterSecondOpen)}`,
      )

      // 削除→開き直し: 今日の献立から1件外す→開き直しても再出現しない
      // (lastAutoImportDateに今日が記録済みのため、その日のうちの自動再取り込みはスキップ)。
      // 2026-08-03 便DH: 週の予定から来た品は「今週の献立の予定」に並び×は出ない(外すのは週タブの仕事)
      // ため、ここは todayList を直接1件消して再取り込みが起きないことだけを検証する
      check(
        'MEALPLAN-05(便DH) 週の予定から来た品に×(この献立から外す)は出ない',
        (await mp5Page.locator(`button[aria-label="${ja.mealPlan.todayRemove}"]`).count()) === 0,
      )
      await mp5Page.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('todayList', 'readwrite')
              const store = tx.objectStore('todayList')
              const g = store.getAll()
              g.onsuccess = () => {
                const row = g.result.find((r) => r.recipeId === recipeId)
                if (row) store.delete(row.id)
              }
              tx.oncomplete = () => resolve(true)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        idsAfterSecondOpen[0],
      )
      await mp5Page.waitForTimeout(300)
      const idsAfterRemove = await todayListRecipeIds()
      check(
        'MEALPLAN-05 1件外すとtodayListは1件になる',
        idsAfterRemove.length === 1,
        `ids=${JSON.stringify(idsAfterRemove)}`,
      )
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterReopen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(再出現防止) 削除後に日タブを開き直しても消した品は戻らない(1件のまま)',
        idsAfterReopen.length === 1 &&
          JSON.stringify(idsAfterReopen) === JSON.stringify(idsAfterRemove),
        `before=${JSON.stringify(idsAfterRemove)} after=${JSON.stringify(idsAfterReopen)}`,
      )
    } finally {
      await mp5Browser.close()
    }
  }

  // --- MEALPLAN-06: 過去日の扱い(2026-07-16 便W-⑤a→2026-07-24 便BS・タスク2で強化)。
  // 便BS: 過去日は「作った記録」だけを日記のように残し、達成しなかった予定は過去表示から消す
  // (表示レベルのフィルタ=mealPlansデータは非破壊で残す)。よって過去週は予定グリッドを出さず、
  // 「まとめて献立」「サイコロ」の対象にもならない(上書きも新規埋めも起きない)。
  // 「前の週」は実行日の曜日に関わらず必ず全7日が過去日になる(当週の月曜が実行日以前でも、
  // 前の週の日曜は必ずそれよりさらに前)ため、実行日に依存しない決定的なテストになる ---
  currentCheck = 'MEALPLAN-06'
  {
    const mp6Browser = await chromium.launch()
    const mp6Context = await mp6Browser.newContext()
    const mp6Page = await mp6Context.newPage()
    mp6Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-06] ${text}`)
    })
    mp6Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-06] ${err.message}`)
    })
    try {
      await mp6Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp6Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      await mp6Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mp6Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp6Page.waitForTimeout(300)
      await mp6Page.locator(`button[aria-label="${ja.mealPlan.prevWeek}"]`).click()
      await openAllWeekDays(mp6Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp6Page.waitForTimeout(300)

      // 前提: 表示中の週は全日程が過去日。便BS(タスク2)で過去日は予定グリッドを表示しなくなった
      // (達成しなかった予定は過去表示から消す=非破壊の表示フィルタ)。記録の無い過去日は「この日の
      // 記録はありません」を出す(7日分)。よって「レシピを選ぶ」(空き枠ボタン)は0件になる
      check(
        'MEALPLAN-06(便BS) 過去週は予定グリッド(レシピを選ぶ)を1つも出さない',
        (await mp6Page.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).count()) === 0,
      )
      check(
        'MEALPLAN-06(便BS) 記録の無い過去日は「記録が無い」を7日分出す',
        (await mp6Page.getByText(ja.mealPlan.pastNoRecord).count()) === 7,
      )
      // (a) 過去日にはサイコロ(行の自動提案)ボタン自体が出ない
      check(
        'MEALPLAN-06(過去日保護a) 過去週にはサイコロボタンが1つも出ない',
        (await mp6Page.getByRole('button', { name: ja.mealPlan.suggestAria }).count()) === 0,
      )
      // (a) 「まとめて献立を立てる」を押しても過去週には予定が生まれない(グリッドを出さないまま)
      await mp6Page.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await mp6Page.waitForTimeout(600)
      check(
        'MEALPLAN-06(過去日保護a) 「まとめて献立を立てる」を押しても過去週に予定は出ない(0のまま)',
        (await mp6Page.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).count()) === 0,
      )
    } finally {
      await mp6Browser.close()
    }
  }

  // --- MEALPLAN-08: 手動配置の保護(2026-07-22 便BE・外部レビューで見つかったUX欠陥の修正)。
  // 週の枠に手動でレシピ(肉じゃが)を入れた直後に「まとめて献立を立てる」を押しても、
  // その手動配置が無警告で上書き削除されず、同じmealPlans行id・同じレシピのまま残ることを
  // IndexedDB直読みで検証する。旧実装は表示中の全枠を一旦クリアしていたため手動配置が消えていた。
  // 併せて、空き枠は自動提案で埋まること・「すでに決まっている◯食分は残した」トーストが出ること・
  // 2回押しても手動枠が保護され続けること(自動枠だけ再抽選)を確認する。
  // まっさらプロファイルで検証するため専用browser/contextを使う ---
  currentCheck = 'MEALPLAN-08'
  {
    const mp8Browser = await chromium.launch()
    const mp8Context = await mp8Browser.newContext()
    const mp8Page = await mp8Context.newPage()
    mp8Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-08] ${text}`)
    })
    mp8Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-08] ${err.message}`)
    })
    try {
      // 夕食枠の全mealPlans行(id・recipeId・auto)を読む(手動行が上書きされないことの検証用)
      const dinnerRows = () =>
        mp8Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction('mealPlans', 'readonly')
                const getAllReq = tx.objectStore('mealPlans').getAll()
                getAllReq.onsuccess = () =>
                  resolve(
                    getAllReq.result
                      .filter((row) => row.slot === 'dinner')
                      .map((row) => ({ id: row.id, date: row.date, recipeId: row.recipeId, role: row.role, auto: row.auto ?? false })),
                  )
                getAllReq.onerror = () => reject(getAllReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      await mp8Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp8Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      await mp8Page.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(mp8Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp8Page.waitForTimeout(300)
      // 全日程を未来日にするため「次の週」へ(過去日保護と切り分ける。MEALPLAN-03/04と同じ理由)
      await mp8Page.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).click()
      await openAllWeekDays(mp8Page) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await mp8Page.waitForTimeout(300)

      // 月曜・夕食の主菜行(先頭の「未定」)に肉じゃがを手動で割り当てる。
      // 2026-08-22 便IV: 空き枠は編集モードの中にしか出さない
      const mp8FirstDate = await mp8Page.evaluate(
        () => document.querySelector('section[data-date]')?.getAttribute('data-date') ?? '',
      )
      check(
        'MEALPLAN-08 前提: 先頭の日を編集モードにできた（便IV）',
        (await openWeekDayEdit(mp8Page, mp8FirstDate)) === true,
        `先頭の日=${mp8FirstDate}`,
      )
      await mp8Page.getByRole('button', { name: ja.mealPlan.emptyAssign, exact: true }).first().click()
      await mp8Page.waitForTimeout(400)
      await mp8Page.getByPlaceholder(ja.mealPlan.pickSearchPlaceholder).fill('肉じゃが')
      await mp8Page.waitForTimeout(300)
      await mp8Page.getByText('肉じゃが', { exact: true }).first().click()
      await mp8Page.waitForTimeout(400)

      const rowsBefore = await dinnerRows()
      check('MEALPLAN-08 前提: 手動配置の夕食行が1件だけある', rowsBefore.length === 1)
      const manual = rowsBefore[0]
      check('MEALPLAN-08 前提: 手動配置の行はauto=false(手動扱い)', manual.auto === false)

      // 「まとめて献立を立てる」を押す
      const fillWeekBtn = mp8Page.getByRole('button', { name: ja.mealPlan.fillWeek })
      await fillWeekBtn.click()
      await mp8Page.waitForTimeout(1000)

      // 核心: 手動配置の行が同じid・同じレシピ・手動のまま残る(無警告で上書き削除されない)
      const rowsAfter = await dinnerRows()
      check(
        'MEALPLAN-08 手動配置の行が上書き削除されず、同じid・同じレシピのまま残る',
        rowsAfter.some((r) => r.id === manual.id && r.recipeId === manual.recipeId && r.auto === false),
      )
      // 肉じゃがが画面にも残っている
      check(
        'MEALPLAN-08 肉じゃがが週ビューに残って見える',
        await mp8Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      // 空き枠は自動提案で埋まる(手動の1枠以外の夕食に自動行が増える)
      const autoRowsAfter = rowsAfter.filter((r) => r.auto === true)
      check(
        'MEALPLAN-08 空いていた枠は自動提案で埋まる(自動行が1件以上増える)',
        autoRowsAfter.length >= 1,
      )
      // 便BH-2(役割粒度の保護): 手動主菜(肉じゃが=一品ものでない)だけ入れた枠は、主菜を残したまま
      // 空いていた副菜だけが自動で埋まる。手動主菜と同じ日に、自動の副菜行が足される
      check(
        'MEALPLAN-08(役割粒度) 手動主菜だけの枠に副菜だけが自動提案で足される',
        rowsAfter.some(
          (r) => r.date === manual.date && r.role === 'side' && r.auto === true,
        ) && rowsAfter.some((r) => r.id === manual.id && r.role === 'main' && r.auto === false),
      )
      // 「すでに決まっている◯食分はそのままにして◯品を新しく立てました」トーストが出る
      // (2026-07-29 便CD/MP-06: 実際に立てた品数で出し分ける。0品なら0品と言う)
      check(
        'MEALPLAN-08 手動枠を残した旨のトーストが出る',
        // 2026-08-25: 画面の日本語を書き写していた（禁じ手②）ため、便KTが
        // 「◯食分」→「◯品」に言い直した時点で掴めなくなった。ja.ts の雛形の
        // **差し込み口より前**だけを見る＝数字が変わっても文言を直しても追従する
        await mp8Page
          .getByText(ja.mealPlan.fillWeekKeptManual.split('{')[0], { exact: false })
          .first()
          .isVisible(),
      )

      // 2回目のタップでも手動枠は保護され続ける(自動枠だけ再抽選される)
      await fillWeekBtn.click()
      await mp8Page.waitForTimeout(1000)
      const rowsAfter2 = await dinnerRows()
      check(
        'MEALPLAN-08 2回押しても手動配置の行(id・レシピ)は保護され続ける',
        rowsAfter2.some((r) => r.id === manual.id && r.recipeId === manual.recipeId && r.auto === false),
      )
    } finally {
      await mp8Browser.close()
    }
  }
