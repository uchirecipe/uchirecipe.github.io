// ==========================================================================================
// e2e の節: 起動・一覧・詳細・設定の入口
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
// この中の節: SMK-01, COUNT-01, QF-01, LAYOUT-01, SORTDIR-01, SMK-05, NUT-01, ZENKAKU-01, TERM-01, SMK-08, FOCUS-MEMO-01, TAB-01, DET-01, URLIMPORT-00, SMK-04, SMK-02, SMK-03, GF-B, KG-A, KG-B, KW-01, INTRO-01, ONEPOINT-01, DISHTYPE-01, STEP0-01, NUTSORT-01, UI-390-01, UI-390-02, FOCUS-SCROLL-01, SCROLLLOCK-01, FOCUS-COPY-01, SMK-14, SETTINGS-TAB-01, BANNER-01, NGCOUNT-01, ABOUT-01, MOVEGUIDE-01, BACKUPCARDS-01
// ==========================================================================================
import './_shared.mjs'

  // --- SMK-01: 起動・初回シード ---
  currentCheck = 'SMK-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800) // 初回シード完了待ち
  const listText = await page.textContent('body')
  check('SMK-01 起動・基本レシピのシード', listText.includes('肉じゃが') && listText.includes('カレーライス'))

  // --- COUNT-01: 絞り込み無しでも一覧上部に総件数「全◯件」が常に表示される(2026-07-13 UI改善) ---
  currentCheck = 'COUNT-01'
  const allCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  const allTotalLabel = readTotalCount(await page.textContent('body'))
  check(
    'COUNT-01 絞り込み無しで一覧の総数が出て、並んでいるカードの数と一致する',
    allTotalLabel === allCardCount,
    `見出しの総数=${allTotalLabel} カード数=${allCardCount}`,
  )

  // --- QF-01: 絞り込み「時短レシピのみに絞る」でカード件数が変わる(quickStepsを持つレシピだけに
  // 絞られる。UI改善バッチ 2026-07-11。チップ文言は2026-07-13「時短」→「時短レシピ」、
  // 2026-07-16便T-5で「時短レシピのみに絞る」に変更) ---
  currentCheck = 'QF-01'
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: ja.search.quickOnly, exact: true }).click()
  await page.waitForTimeout(400)
  const quickCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'QF-01 時短絞り込みで件数が変わる',
    quickCardCount > 0 && quickCardCount < allCardCount,
    `全件=${allCardCount} 時短=${quickCardCount}`,
  )
  const quickCountLabel = readResultCount(await page.textContent('body'))
  check(
    'COUNT-01 絞り込み中は「結果の数 / 全体の数」の形で、どちらも実際の数と一致する',
    quickCountLabel?.shown === quickCardCount && quickCountLabel?.total === allCardCount,
    `見出し=${JSON.stringify(quickCountLabel)} 結果=${quickCardCount} 全体=${allCardCount}`,
  )
  // 絞り込みを解除して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: ja.search.quickOnly, exact: true }).click()
  await page.waitForTimeout(300)
  await page.locator('[data-testid="filter-panel-close"]').click()
  await page.waitForTimeout(300)

  // --- LAYOUT-01: 一覧の表示形式切替(グリッド/リスト。2026-07-13 UI改善)。settingsに保存され
  // リロード後(再訪)も維持されることを確認する ---
  currentCheck = 'LAYOUT-01'
  const layoutContainerInfo = () =>
    page.evaluate(() => {
      const cardLinks = (root) =>
        Array.from((root ?? document).querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
          /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
        )
      const links = cardLinks()
      // グリッド/リストのコンテナ＝**カードを2枚以上まとめて抱えている、いちばん内側の要素**。
      // 以前は「リンクの2つ親」と数えていたが、2026-08-19 便HWで共通カードの外枠(div)が1枚
      // 増えたぶん親の数が変わり、コンテナではなくカード1枚のラッパーを掴んでいた。
      // 置き場所(何番目の親か)への固定はCLAUDE.mdの禁じ手④なので、
      // 「カードを複数抱えた最初の親」を辿って取る＝入れ子が増えても減っても同じ所に当たる。
      // 見つからないときは null のまま返す(className が空文字になり、判定は必ず不合格になる)
      let container = null
      if (links.length > 1) {
        let el = links[0]
        while (el.parentElement && cardLinks(el.parentElement).length < 2) el = el.parentElement
        container = el.parentElement
      }
      return { className: container?.className ?? '', count: links.length }
    })
  const layoutBefore = await layoutContainerInfo()
  check('LAYOUT-01 既定はグリッド表示', layoutBefore.className.includes('grid-cols-2'))
  await page.locator('button[aria-label="リスト表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterToList = await layoutContainerInfo()
  check(
    'LAYOUT-01 「リスト表示に切り替え」を押すと縦一列表示になる',
    layoutAfterToList.className.includes('flex-col') &&
      !layoutAfterToList.className.includes('grid-cols-2'),
  )
  check(
    'LAYOUT-01 リスト表示でもレシピ件数は変わらない',
    layoutAfterToList.count === layoutBefore.count,
    `グリッド=${layoutBefore.count} リスト=${layoutAfterToList.count}`,
  )
  // リスト表示の行がグリッドカードと同等の情報量を持つこと(2026-07-13 UI改善: 主要食材チップ・
  // 由来バッジ(基本レシピ)・タイトル2行折り返しをlist行にも追加)
  const listRowContent = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
      /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
    )
    return {
      anyChip: links.some((a) => a.querySelector('[style*="--chip-"]')),
      anyStarterBadge: links.some((a) => a.textContent?.includes('基本レシピ')),
      anyClampedTitle: links.some((a) => a.querySelector('p.line-clamp-2')),
    }
  })
  check('LAYOUT-01 リスト表示でも主要食材チップが見える', listRowContent.anyChip)
  check('LAYOUT-01 リスト表示でも由来バッジ(基本レシピ)が見える', listRowContent.anyStarterBadge)
  check(
    'LAYOUT-01 リスト表示でもタイトルが2行まで折り返す(line-clamp-2)',
    listRowContent.anyClampedTitle,
  )
  // リロードしても設定(settings.recipeListLayout)に保存されて維持されることを確認する
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const layoutAfterReload = await layoutContainerInfo()
  check(
    'LAYOUT-01 リロード後もリスト表示が維持される(settingsに保存)',
    layoutAfterReload.className.includes('flex-col'),
  )
  // グリッド表示に戻して以降のチェック(グリッド前提のセレクタ)に影響しないようにする
  await page.locator('button[aria-label="グリッド表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterBackToGrid = await layoutContainerInfo()
  check('LAYOUT-01 グリッド表示に戻せる', layoutAfterBackToGrid.className.includes('grid-cols-2'))

  // --- SORTDIR-01: 並べ替えの昇順/降順トグル(2026-07-13 UI改善)。「五十音順」(2026-07-16便T-5で
  // 「あいうえお順」から改称)を選ぶと既定で昇順(あ→ん)になり、「降順」を押すと並びがちょうど反転する
  // ことを確認する。便T-1で並び替えボタンが絞り込みボタンから分離したのでそちらを開く ---
  currentCheck = 'SORTDIR-01'
  const cardTitles = () =>
    page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
  // 2026-08-02 オーナー指示(便DF): 昇順/降順は件数表記の横の常設ボタンをやめ、並べ替えパネルの
  // 中へ移した。パネルを開く前は画面に出ていないことを見張る(元の位置に戻ってしまう再発防止)
  const dirButtonCount = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).filter((b) =>
        ['昇順', '降順'].includes(b.textContent?.trim() ?? ''),
      ).length,
    )
  check(
    'SORTDIR-01(2026-08-02改定) 並べ替えパネルを開く前は昇順/降順ボタンが出ていない',
    (await dirButtonCount()) === 0,
  )
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  check(
    'SORTDIR-01(2026-08-02改定) 並べ替えパネルを開くと昇順/降順ボタンが中に出る',
    (await dirButtonCount()) === 2,
  )
  await page.getByRole('button', { name: ja.search.sortKana, exact: true }).click()
  await page.waitForTimeout(300)
  const ascActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '昇順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SORTDIR-01 「五十音順」を選ぶと既定で昇順が選択される', ascActive)
  const ascTitles = await cardTitles()
  await page.getByRole('button', { name: ja.search.sortDesc, exact: true }).click()
  await page.waitForTimeout(300)
  const descTitles = await cardTitles()
  check(
    'SORTDIR-01 「降順」を押すと並び順がちょうど反転する',
    ascTitles.length > 1 && JSON.stringify(descTitles) === JSON.stringify([...ascTitles].reverse()),
    `昇順=${JSON.stringify(ascTitles)} 降順=${JSON.stringify(descTitles)}`,
  )
  // 既定(更新順・降順)に戻して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: ja.search.sortUpdated, exact: true }).click()
  await page.waitForTimeout(200)
  await page.locator('[data-testid="sort-panel-close"]').click()
  await page.waitForTimeout(300)

  // --- SMK-05: 人数変更で帯分数表示(2人分→3人分でじゃがいも3個→4と1/2個) ---
  currentCheck = 'SMK-05'
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.locator('button[aria-label="人数を増やす"]').click()
  await page.waitForTimeout(400)
  const detailText = await page.textContent('body')
  check('SMK-05 人数変更の帯分数スケール', detailText.includes('4と1/2個'), `「4と1/2個」が見つからない`)
  check('SMK-05 g系は整数のまま', detailText.includes('300g'), '牛こま300g(200g×1.5)が見つからない')

  // --- 合わせ調味料の色ライン(共通説明文の表示) ---
  check('合わせ調味料ヒント表示', detailText.includes('合わせ調味料です'))

  // --- NUT-01: 栄養価の概算(未解錠・無料)。肉じゃがの詳細を開いたまま検証する
  // (M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED=trueに前倒し有効化。
  // 2026-08-01 線引きB'(オーナー確定): 無料で出るのは**エネルギーと野菜量**の2つで、
  // 食塩相当量は残り6項目と同じPro側へ移した。
  // 2026-08-02 オーナー指示: 閉じた1行も無料の2値(エネルギー・野菜量)にそろえた) ---
  currentCheck = 'NUT-01'
  check('NUT-01 栄養価の概算 見出しが閉じた状態から見える', detailText.includes('栄養価の概算'))
  check('NUT-01 エネルギー(kcal)の概算が閉じた1行から見える', /\d+kcal/.test(detailText))
  check(
    'NUT-01(2026-08-02) 閉じた1行は「◯kcal・野菜約◯g」の2値',
    /[\d,]+kcal・野菜約[\d,]+g/.test(detailText),
    `閉じた1行=${detailText.match(/.{0,24}kcal.{0,16}/)?.[0]}`,
  )
  check(
    "NUT-01(B') 無料の閉じた1行に塩分が出ない",
    !detailText.includes('塩分'),
    '無料の要約行に「塩分」が残っている',
  )
  await page.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
  await page.waitForTimeout(300)
  const nutExpandedText = await page.textContent('body')
  check('NUT-01 展開すると断定しない「概算」表記の注記が出る', nutExpandedText.includes('概算'))
  // 2026-08-28 便MC（オーナー原文「栄養の説明と注記は折りたたみにしてコンパクトに。
  // 他に個所でやってる「注記と出典」と同じように」）: 説明・注記・出典は
  // 献立の栄養パネルと同じ「注記と出典」の折りたたみへ入れた。
  // 畳んでいるあいだは中身をDOMに置かない作法なので、開く前・開いた後の両方を測る
  check(
    'NUT-01(便MC) 説明と注記・出典は畳んである（開くまで出典は出ない）',
    !nutExpandedText.includes(ja.nutrition.sourcePrefix),
  )
  await page.getByRole('button', { name: ja.nutritionBalance.notesToggle }).first().click()
  await page.waitForTimeout(400)
  const nutNotesOpenText = await page.textContent('body')
  check('NUT-01 出典表記がある', nutNotesOpenText.includes('出典'))
  check(
    'NUT-01 未解錠には月間献立と同じ「Pro版について見る」リンクが出る',
    nutExpandedText.includes('Pro版について見る'),
  )
  check(
    'NUT-01 未解錠案内にPro版で増える項目が明記される(2026-07-13 UIペルソナQA・2026-08-01で塩分相当量を追加)',
    nutExpandedText.includes(
      'Pro版では、たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウム・塩分相当量の概算も表示されます',
    ),
  )
  // 2026-08-01 線引きB': 無料の展開部はエネルギーと野菜量だけ。塩分の数値は出さない
  // (「塩分相当量」の語自体はPro案内のティーザーに出るので、語ではなく「値が続いているか」で判定する)
  check(
    "NUT-01(B') 無料の展開部に野菜量(g)の値が出る",
    /野菜\s*[\d,]+\s*g/.test(nutExpandedText),
    '無料の展開部に「野菜 ◯g」が無い',
  )
  check(
    "NUT-01(B') 無料の展開部に塩分相当量の値が出ない",
    !/塩分相当量\s*[\d,]/.test(nutExpandedText),
    '無料の展開部に塩分相当量の数値が出ている',
  )
  check(
    "NUT-01(B') 野菜量の数え方の注記が出る",
    nutNotesOpenText.includes('食品成分表の「野菜類」に名寄せできた材料'),
  )
  // PRO-01(2026-07-28 便BY): 未解錠のティーザーを、月間献立ゲートと同じ blur+Lockバッジ+見出しの
  // 様式に揃える(同じPro導線なのに画面ごとに表現が3種類あった状態の解消)
  check(
    'NUT-01(便BY PRO-01) 未解錠ティーザーに月間献立と同じLockバッジ「Pro版で使えます」が出る',
    nutExpandedText.includes('Pro版で使えます') && nutExpandedText.includes('栄養価8項目の概算'),
  )
  const nutBlurCount = await page.evaluate(
    () =>
      Array.from(document.querySelectorAll('*')).filter((el) => {
        const f = getComputedStyle(el).backdropFilter
        return f && f !== 'none' && f.includes('blur')
      }).length,
  )
  check(
    'NUT-01(便BY PRO-01) 未解錠ティーザーにぼかし(backdrop-blur)が適用されている',
    nutBlurCount > 0,
    `blur要素=${nutBlurCount}`,
  )
  // 2026-08-25 便KN・オーナー指示: 基準人数の併記をやめた（人数分は同じ画面の
  // 人数ステッパーと「登録: ◯人分」に出ている）。ここは「1食あたり」と言えていることだけ見る
  check(
    'NUT-01(便KN) 栄養の要約が「1食あたり」と言っている',
    stripZwspText(nutExpandedText).includes(ja.nutrition.summaryLabel),
    `本文に「${ja.nutrition.summaryLabel}」が無い`,
  )
  await page.getByRole('button', { name: ja.nutrition.toggleCollapse }).click()
  await page.waitForTimeout(200)

  // --- ZENKAKU-01: 全角入力の自動正規化(2026-07-21 オーナー実機報告:「アサリ 300ｇ」の全角ｇだと
  // 栄養計算に反映されない・数量も全角で入力できてしまう)。材料の分量欄に全角数字「３００」・
  // 単位欄に全角「ｇ」を入力し、blur(フォーカスを外す)で自動的に半角「300」「g」に置き換わること、
  // 保存後の栄養計算にも反映され「計算対象外」にならないことを確認する(修正前は単位が全角のまま
  // だと半角の食品データと一致せず計算対象外になっていた=本バグの直接の再現ケース) ---
  currentCheck = 'ZENKAKU-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2E全角正規化確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('アサリ')
  const zenkakuAmountInput = page.getByPlaceholder(ja.form.ingredientAmountPlaceholder, { exact: true }).first()
  const zenkakuUnitInput = page.getByPlaceholder(ja.form.ingredientUnitPlaceholder, { exact: true }).first()
  await zenkakuAmountInput.fill('３００') // 全角数字
  await zenkakuUnitInput.fill('ｇ') // 全角英字(半角gの全角形)
  // Tabでフォーカスを外し、実際のblurイベントを発火させる(IME確定後のblurと同じ経路。
  // compositionend後にしか発火しないため、変換中の文字が正規化で壊れることはない)
  await zenkakuUnitInput.press('Tab')
  await page.waitForTimeout(200)
  check(
    'ZENKAKU-01 全角数量「３００」はblurで半角「300」に置き換わる',
    (await zenkakuAmountInput.inputValue()) === '300',
    `実際の値=${await zenkakuAmountInput.inputValue()}`,
  )
  check(
    'ZENKAKU-01 全角単位「ｇ」はblurで半角「g」に置き換わる',
    (await zenkakuUnitInput.inputValue()) === 'g',
    `実際の値=${await zenkakuUnitInput.inputValue()}`,
  )
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('アサリを砂抜きする')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  check('ZENKAKU-01 保存後にレシピ詳細へ遷移する', page.url().includes('#/recipes/'))
  const zenkakuDetailText = await page.textContent('body')
  check('ZENKAKU-01 栄養価の概算 見出しが見える', zenkakuDetailText.includes('栄養価の概算'))
  await page.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
  await page.waitForTimeout(300)
  const zenkakuNutritionText = await page.textContent('body')
  check(
    'ZENKAKU-01 全角で入力した「アサリ 300ｇ」が栄養計算対象外にならない(単位「ｇ」がgとして解釈される回帰)',
    // ラベルは2026-07-28 便BY/NUT-02で「計算対象外 n件」→「計算に含めていない材料 n件」に変更
    !zenkakuNutritionText.includes('計算に含めていない材料'),
  )
  await page.getByRole('button', { name: ja.nutrition.toggleCollapse }).click()
  await page.waitForTimeout(200)

  // 以降のTERM-01が「肉じゃが」の詳細を開いたままである前提のため、その状態に戻す
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)

  // --- TERM-01: 用語タップでポップオーバーが開き、外タップで閉じる(用語タップ辞書 2026-07-11)。
  // 肉じゃが手順1「玉ねぎはくし形に切る」の「くし形」をタップして説明を確認する ---
  currentCheck = 'TERM-01'
  await page.getByRole('button', { name: 'くし形切りの説明を見る' }).click()
  await page.waitForTimeout(300)
  // 説明文はMemoText描画(2026-07-12)で文節境界にZWSPが入るため、比較前に除去する
  const stripZwsp = (s) => s.replace(/\u200b/g, '')
  const termOpenText = stripZwsp(await page.textContent('body'))
  check('TERM-01 用語タップでポップオーバーが開く', termOpenText.includes('縦半分に切った玉ねぎ'))
  await page.mouse.click(5, 5) // ポップオーバーの外をタップ
  await page.waitForTimeout(300)
  const termClosedText = stripZwsp(await page.textContent('body'))
  check('TERM-01 外タップでポップオーバーが閉じる', !termClosedText.includes('縦半分に切った玉ねぎ'))

  // --- SMK-08(簡易): 調理中モードを開いて手順送り・閉じる ---
  currentCheck = 'SMK-08'
  await page.getByText(ja.focus.open).click()
  await page.waitForTimeout(500)
  const focusText = await page.textContent('body')
  check('SMK-08 調理中モードが開く', focusText.includes('手順 1/'))
  await page.getByRole('button', { name: ja.focus.next }).click()
  await page.waitForTimeout(300)
  check('SMK-08 手順送り', (await page.textContent('body')).includes('手順 2/'))
  await page.getByRole('button', { name: ja.common.close }).click()
  await page.waitForTimeout(300)

  // --- FOCUS-MEMO-01: 調理中モードの▽折りたたみメモをタップすると詳細画面と同じ小窓(ポップオーバー)で
  // 開く(2026-07-12 Fable裁定: 1手順を大きく見せる調理中モードでメモ全文の常時展開は本文を圧迫するため、
  // 詳細画面と挙動を統一)。「回鍋肉(ホイコーロー)」手順5の「▽たくさん作るとき」には「・」箇条書きと
  // 「｜」改行の両方が入っているため、これらが小窓の中でも効くことまで併せて確認する
  // (2026-07-13: 元は「蒸しなすの香味だれ」→用語辞書集約で削除→「鶏の照り焼き」に差し替え。
  //  2026-07-14: 鶏の照り焼きの▽も分割冗長文の横展開削除で｜構造が消えたため、同じ構造(手順範囲指定の
  //  例外として｜+・箇条書きを保持している)「回鍋肉」手順5に再度差し替えた) ---
  currentCheck = 'FOCUS-MEMO-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.search.placeholder).fill('回鍋肉')
  await page.waitForTimeout(300)
  await page.getByText('回鍋肉(ホイコーロー)', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByText(ja.focus.open).click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.focus.next }).click() // 手順2へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: ja.focus.next }).click() // 手順3へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: ja.focus.next }).click() // 手順4へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: ja.focus.next }).click() // 手順5(▽を含む手順)へ
  await page.waitForTimeout(300)
  const focusMemoFoldedText = await page.textContent('body')
  check(
    'FOCUS-MEMO-01 ▽はラベルのみ折りたたみ表示され詳細は隠れている',
    focusMemoFoldedText.includes('たくさん作るとき') &&
      !focusMemoFoldedText.includes('一度に炒められるのはフライパン'),
  )
  // 詳細画面の手順リスト(FocusModeの背後にDOM上は残ったまま)にも同じ▽ボタンがあるため、
  // FocusModeの全画面オーバーレイ(.fixed.inset-0.z-50)側だけに絞って押す
  await page.locator('.fixed.inset-0.z-50').getByRole('button', { name: 'たくさん作るとき' }).click()
  await page.waitForTimeout(300)
  const focusMemoOpenText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 タップで小窓が開き詳細(1文目)が見える',
    focusMemoOpenText.includes('一度に炒められるのはフライパン'),
  )
  check(
    'FOCUS-MEMO-01 「｜」改行後の2文目も「・」箇条書きとして見える',
    focusMemoOpenText.includes('人数が多いときは手順③〜⑤'),
  )
  await page.mouse.click(5, 5) // 小窓の外をタップ
  await page.waitForTimeout(300)
  const focusMemoClosedText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 外タップで小窓が閉じる',
    !focusMemoClosedText.includes('一度に炒められるのはフライパン'),
  )
  await page.getByRole('button', { name: ja.common.close }).click()
  await page.waitForTimeout(300)
  // この検索語が一覧の状態(sessionStorage)に残ったままだと、以降のテスト(戻る動線・スクロール系)が
  // 「鶏の照り焼き」だけの絞り込み一覧を前提に動いてしまい無関係な失敗を招くため、必ず消しておく
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- TAB-01: 詳細を開いたままリロード→下タブ「レシピ」で一覧へ戻れる ---
  // (覚えた「最後のレシピパス」＝現在地となりタップが無反応になる回帰の防止。2026-07-09第2波)
  currentCheck = 'TAB-01'
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('TAB-01 リロードで詳細が復元される', /#\/recipes\/\d+/.test(page.url()))
  await page.locator('nav').getByText('レシピ', { exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'TAB-01 リロード後もレシピタブで一覧へ戻れる',
    page.url().includes('#/recipes') && !/#\/recipes\/\d/.test(page.url()),
    `現在URL: ${page.url()}`,
  )

  // --- DET-01: 詳細の戻るボタン(2026-08-02オーナー指示・同日追補で確定)。
  // 確定形: 今日の献立発の例外(2026-07-12・07-16)は残し、出所state無し・
  // 不明時は必ずレシピ一覧へ(一覧へ行く手段が消える不具合の再発防止)。
  // (a)=献立の「日」の「今日なに作る？」の候補カード発は例外どおり献立へ帰る
  //     (2026-08-17 便HGでホーム画面を廃止し、この候補カードはホームから献立の「日」へ移った。
  //      測っているのは「出所を持ったカードから開いた詳細は、その出所へ帰る」で変えていない)
  // (b)=state無しの直接URLは一覧へ ---
  currentCheck = 'DET-01'
  // (a) 献立の「日」の候補カードから詳細→戻る→献立へ
  await page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  await page.locator('a[href^="#/recipes/"]').first().click()
  await page.waitForTimeout(500)
  check(
    'DET-01 献立の「日」の候補カードからレシピ詳細へ遷移',
    /#\/recipes\/\d+/.test(page.url()),
    `現在URL: ${page.url()}`,
  )
  const det01DetailUrl = page.url()
  await page.getByRole('button', { name: ja.common.back }).click()
  await page.waitForTimeout(600)
  check(
    'DET-01(2026-08-02追補) 候補カード発の戻るは献立へ帰る(例外復元)',
    (page.url().split('#')[1] ?? '').startsWith('/meal-plan'),
    `現在URL: ${page.url()}`,
  )

  // (b) 戻り先の保全: 直接URL(ブラウザ履歴なし・state無し)で詳細を開いた場合も一覧へ
  await page.goto(det01DetailUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.common.back }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01(戻り先の保全) 直接URLで開いた詳細の戻るは従来どおり一覧へ',
    page.url().endsWith('#/recipes'),
    `現在URL: ${page.url()}`,
  )

  // --- URLIMPORT-00: VITE_RECIPE_IMPORT_ENDPOINT未設定(通常のdev/preview起動)では
  // 「URLから取り込む」ボタン自体が出ない(Workerデプロイ前でも壊れない設計。src/logic/urlImport.ts
  // のisUrlImportEnabled)。設定済みの場合の表示・取り込みフローはURLIMPORT-01以降(自前preview
  // サーバー・VITE_RECIPE_IMPORT_ENDPOINTをダミー値でビルド)で確認する ---
  currentCheck = 'URLIMPORT-00'
  // 2026-07-21改定: 本番Workerのデプロイに伴い .env.production にエンドポイントが設定された。
  // このチェックは「ビルド時の設定状態と表示が一致すること」を検証する適応型にする
  // (設定済みビルド=ボタンが出る/未設定ビルド=出ない。未設定側の分岐検証はURLIMPORT-01の
  // 専用ビルド側で担保)。.env.production を読んで期待値を決める
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  {
    const envFile = readFileSync(path.join(appRoot, '.env.production'), 'utf8')
    const m = envFile.match(/^VITE_RECIPE_IMPORT_ENDPOINT=(.*)$/m)
    const endpointConfigured = !!(m && m[1].trim())
    const btnVisible = await page.getByText(ja.urlImport.open).isVisible().catch(() => false)
    check(
      endpointConfigured
        ? 'URLIMPORT-00 エンドポイント設定済みビルドでは「URLから取り込む」ボタンが出る'
        : 'URLIMPORT-00 エンドポイント未設定では「URLから取り込む」ボタンが出ない',
      endpointConfigured ? btnVisible : !btnVisible,
    )
  }

  // --- SMK-04+02: テキスト貼り付け→登録 ---
  currentCheck = 'SMK-04'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText(ja.paste.open).click()
  await page.waitForTimeout(300)
  await page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
    'E2Eスモーク試験用レシピ\n\n材料（2人分）\n・にんじん　1本\n・しょうゆ　大さじ2\n\n作り方\n1. にんじんを切る\n2. 炒める',
  )
  await page.getByRole('button', { name: ja.paste.apply }).click()
  await page.waitForTimeout(300)
  const formText = await page.textContent('body')
  check('SMK-04 貼り付け整形の読み取り結果', formText.includes('材料2件・手順2件を読み取りました'))
  // 2026-08-02 オーナー指示(便DF→司令部差し替え): 取り込めたときだけ合わせ調味料の案内1行を出す
  check(
    'SMK-04(司令部差替) 貼り付け成功時に合わせ調味料の案内1行が出る',
    formText.includes(ja.form.importSeasoningGuide),
  )
  check(
    'SMK-04(2026-08-03改定) レシピ登録・編集画面に「食材と価格」への案内・リンクを置かない',
    (await page.locator('a[href="#/prices"]').count()) === 0 &&
      !formText.includes('価格は「食材と価格」ページでまとめて管理します') &&
      !formText.includes('食材と価格を編集する'),
    `#/pricesリンク数=${await page.locator('a[href="#/prices"]').count()}`,
  )
  currentCheck = 'SMK-02'
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const savedText = await page.textContent('body')
  check('SMK-02 保存→詳細表示', savedText.includes('E2Eスモーク試験用レシピ') && savedText.includes('にんじん'))

  // --- SMK-03: 編集画面から削除(ダイアログは自動承諾) ---
  currentCheck = 'SMK-03'
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  // 一覧から消えたことを「一覧のカード」で見る(2026-08-18 便HS後の修正)。
  // それまでは画面全体の文字にその名前が無いことで見ていたが、便HSが削除の知らせを足し、
  // その文言に消した料理名が入るようになったため、正しく消えていても赤くなっていた。
  // 知らせが出ること自体は DELMSG-01 が受け持つので、ここは一覧に残っていないかだけを見る
  // 一覧のカードが1枚も掴めていないなら「消えたから0件」ではなく「測れていない」ので、
  // 0件を合格に倒さないよう、先に一覧が読めていることを確かめる
  const smk3Cards = await page.locator('a[href*="#/recipes/"]').count()
  check('SMK-03 一覧のカードを掴めている', smk3Cards > 0, `カード数=${smk3Cards}`)
  check(
    'SMK-03 削除が一覧に反映',
    (await page.locator('a[href*="#/recipes/"]', { hasText: 'E2Eスモーク試験用レシピ' }).count()) === 0,
  )

  // --- GF-B: 貼り付けの☆・◎を見て、合わせ調味料の組を自動で作る ---
  //   利用者テスト「貼り付け後の材料名は『みそ』『すりごま』になるのに、色分け（合わせ調味料
  //   グループ）は自動では付かない。一方、手順は『その間に☆を全部混ぜ合わせておく。』のまま。
  //   結果、『☆ってどれ？』が画面のどこを見ても分からない」
  //   「9行の材料を1つずつ探して4回タップする手間は『面倒だから登録したくない』層には重い」
  {
    currentCheck = 'GF-B'
    await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByText(ja.paste.open).click()
    await page.waitForTimeout(300)
    await page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
      'GF記号テスト\n\n材料（2人分）\n☆みそ　大さじ2\n☆マヨネーズ　大さじ1\n◎すりごま　大さじ2\n◎しょうゆ　小さじ1\nにんじん　1本\n\n作り方\n1. その間に☆を全部混ぜ合わせておく。\n2. ボウルで◎を混ぜ、にんじんを和える。',
    )
    await page.getByRole('button', { name: ja.paste.apply }).click()
    await page.waitForTimeout(500)
    // 組の色は材料行の丸ボタンに出る。aria-label に組番号が入るので、**どの行にあっても**
    // 同じ判定になる形で数える（並びを決め打ちしない）
    const gfGroupLabels = await page.evaluate(() =>
      [...document.querySelectorAll('button[aria-label^="合わせ調味料グループ"]')].map(
        (el) => el.getAttribute('aria-label') ?? '',
      ),
    )
    const gfGroups = gfGroupLabels.filter((l) => /^合わせ調味料グループ[0-9]/.test(l))
    check(
      'GF-B ☆と◎が、それぞれ別の組として自動で色分けされる',
      gfGroups.length === 4 && new Set(gfGroups.map((l) => l.slice(0, 12))).size === 2,
      JSON.stringify(gfGroups),
    )
    // 印は材料メモの欄（入力欄）に残る。入力欄の中身は本文には出ないので値を読む
    const gfMemos = await page.evaluate(() =>
      [...document.querySelectorAll('input')]
        .map((el) => el.value)
        .filter((v) => v.trim() !== ''),
    )
    check(
      'GF-B 印が材料名から外れ、材料のメモに残る（☆がどれかを画面で追える）',
      gfMemos.includes('☆') && gfMemos.includes('◎'),
      JSON.stringify(gfMemos),
    )
    const gfFormText = ((await page.textContent('body')) ?? '').replaceAll('​', '')
    check(
      'GF-B 自動で色分けしたことを画面で知らせる（黙って色を付けない）',
      gfFormText.includes('2組にまとめ、色分けしました'),
      (await page.locator('[data-testid="import-seasoning-guide"]').innerText()) ?? '',
    )
    // 保存したあとの中身を見る（画面の並びに依存しない形で確かめる）
    await page.getByRole('button', { name: '保存する' }).click()
    await page.waitForTimeout(900)
    const gfSaved = await page.evaluate(async () => {
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
      const recipe = all.find((r) => r.title === 'GF記号テスト')
      return recipe
        ? recipe.ingredients.map((i) => [i.name, i.seasoningGroup ?? null, i.memo ?? ''])
        : null
    })
    check(
      'GF-B 保存した材料名に記号が混ざらない（栄養・原価の名前照合を壊さない）',
      // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
      gfSaved != null && gfSaved.length > 0 && gfSaved.every(([name]) => !/[☆◎]/.test(name)),
      JSON.stringify(gfSaved),
    )
    check(
      'GF-B 保存した材料に、印から作った組と印そのものが残っている',
      gfSaved != null &&
        gfSaved.filter(([, group]) => group != null).length === 4 &&
        new Set(gfSaved.map(([, group]) => group).filter((g) => g != null)).size === 2 &&
        gfSaved.filter(([, , memo]) => memo === '☆' || memo === '◎').length === 4,
      JSON.stringify(gfSaved),
    )
    // 後続の検査に影響しないよう、確認用のレシピはここで片付ける（確認ダイアログは自動承諾）
    await page.locator('a[href*="/edit"]').first().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
    await page.waitForTimeout(800)
  }


  // --- KG-A/KG-B: 取り込んだレシピの「料理の種別」と、英小文字の合わせ調味料の印 ---
  //   影響範囲テスト（2026-08-23・実データ90品）で3体が同じ壊れ方をした:
  //   ・30品中19〜24品が主菜になり、「20分以内」で絞ると副菜の候補が3品まで枯れた
  //   ・`a. 酒` `a. みりん` のように小文字で書かれた組の印が、材料名に残ったまま保存された
  //   ここでは貼り付け経路で、①料理名に「副菜」と書いてあれば副菜が選ばれる
  //   ②料理名から読み取れないときは種別を選ばずに知らせる ③小文字の印が組になる、を見る。
  {
    currentCheck = 'KG-A'
    await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByText(ja.paste.open).click()
    await page.waitForTimeout(300)
    await page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
      'KG小文字の印テスト 副菜\n\n材料（2人分）\nもやし　1袋\na. 酒　大さじ1\na. みりん　大さじ1\na. 砂糖　小さじ1\n\n作り方\n1. もやしをゆでる。\n2. aを混ぜて和える。',
    )
    await page.getByRole('button', { name: ja.paste.apply }).click()
    await page.waitForTimeout(500)
    // 種別のチップは「かんたん」タブにも出ている。**どの位置にあっても**同じ判定になるよう、
    // 種別の名前（ja.dishType）と一致するボタンだけを見る（並びを決め打ちしない）
    const dishTypeNames = [ja.dishType.main, ja.dishType.side, ja.dishType.soup, ja.dishType.dessert]
    const readDishTypeChips = async () =>
      await page.evaluate(
        (names) =>
          [...document.querySelectorAll('button[aria-pressed]')]
            .map((el) => ({
              label: (el.textContent ?? '').replaceAll('​', '').trim(),
              pressed: el.getAttribute('aria-pressed') === 'true',
            }))
            .filter((one) => names.includes(one.label)),
        dishTypeNames,
      )
    // 同じ選択が「かんたん」「くわしく」の両方に出るので、件数は決め打ちしない
    // （選ばれている種別が副菜だけか、を見る）
    const kgChips = await readDishTypeChips()
    check(
      'KG-A 料理名に「副菜」と書いてあれば、副菜が選ばれる',
      kgChips.some((c) => c.pressed) && kgChips.filter((c) => c.pressed).every((c) => c.label === ja.dishType.side),
      JSON.stringify(kgChips),
    )
    const kgMemos = await page.evaluate(() =>
      [...document.querySelectorAll('input')].map((el) => el.value).filter((v) => v.trim() !== ''),
    )
    check(
      'KG-A 英小文字の印が材料のメモに残る（手順の「aを混ぜて」と結び付く）',
      kgMemos.filter((v) => v === 'a').length === 3,
      JSON.stringify(kgMemos),
    )
    const kgGroupLabels = await page.evaluate(() =>
      [...document.querySelectorAll('button[aria-label^="合わせ調味料グループ"]')].map(
        (el) => el.getAttribute('aria-label') ?? '',
      ),
    )
    check(
      'KG-A 小文字の印から合わせ調味料の組ができる',
      kgGroupLabels.filter((l) => /^合わせ調味料グループ[0-9]/.test(l)).length === 3,
      JSON.stringify(kgGroupLabels),
    )
    // 保存した中身で、名前に印が残っていないことを見る（栄養・原価の名前照合を壊さないため）
    await page.getByRole('button', { name: ja.form.save }).click()
    await page.waitForTimeout(900)
    const kgSaved = await page.evaluate(async () => {
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
      const recipe = all.find((r) => r.title.includes('KG小文字の印テスト'))
      return recipe ? { names: recipe.ingredients.map((i) => i.name), dishType: recipe.dishType ?? null } : null
    })
    check(
      'KG-A 保存した材料名に小文字の印が残らない',
      // 2026-08-27 便LO: 材料が1件も保存されていないと every は中身を見ずに true になる
      // （＝保存で材料が丸ごと落ちても緑）。件数のほうも同じ判定式で見る
      kgSaved != null &&
        kgSaved.names.length > 0 &&
        kgSaved.names.every((name) => !/^a[.．]?\s/.test(name)),
      JSON.stringify(kgSaved),
    )
    check('KG-A 保存した種別が副菜になっている', kgSaved != null && kgSaved.dishType === 'side', JSON.stringify(kgSaved))
    await page.locator('a[href*="/edit"]').first().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
    await page.waitForTimeout(800)

    // 料理名からは種別が読み取れない品。**機械が主菜と決めずに**、選んでもらう知らせを出す
    currentCheck = 'KG-B'
    await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByText(ja.paste.open).click()
    await page.waitForTimeout(300)
    await page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
      'KGパリパリきゅうり\n\n材料（2人分）\nきゅうり　2本\n砂糖　大さじ1\n\n作り方\n1. きゅうりを切る。\n2. 調味料と混ぜる。',
    )
    await page.getByRole('button', { name: ja.paste.apply }).click()
    await page.waitForTimeout(500)
    const kgUnknownChips = await readDishTypeChips()
    check(
      'KG-B 料理名から読み取れないときは、種別を選ばないまま出す（主菜に倒さない）',
      kgUnknownChips.length >= 4 && kgUnknownChips.every((c) => !c.pressed),
      JSON.stringify(kgUnknownChips),
    )
    const kgUnknownText = ((await page.textContent('body')) ?? '').replaceAll('​', '')
    check(
      'KG-B 種別を選んでほしいことを画面で知らせる',
      kgUnknownText.includes(ja.form.dishTypeNotGuessedHint.replaceAll('​', '')),
      kgUnknownText.slice(0, 200),
    )
    await page.getByRole('button', { name: ja.form.save }).click()
    await page.waitForTimeout(900)
    const kgUnknownSaved = await page.evaluate(async () => {
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
      const recipe = all.find((r) => r.title.includes('KGパリパリきゅうり'))
      return recipe ? recipe.dishType ?? null : 'レシピが見つからない'
    })
    check(
      'KG-B 読み取れなかった種別は、レシピにも書き込まれない',
      kgUnknownSaved === null,
      JSON.stringify(kgUnknownSaved),
    )
    await page.locator('a[href*="/edit"]').first().click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
    await page.waitForTimeout(800)
  }



  // --- KW-01: 検索キーワード欄(keywords・2026-07-12バッチ)。一覧や詳細には表示されず、
  // 検索語に入力したときだけヒットすることを確認する ---
  currentCheck = 'KW-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eキーワード確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')
  // 検索キーワード欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  const kwInput = page.getByPlaceholder(ja.form.keywordPlaceholder)
  await kwInput.fill('ずっきーにのひみつご')
  await kwInput.press('Enter') // タグと同じくEnterでチップ化(addKeyword)
  await page.waitForTimeout(200)
  const kwFormText = await page.textContent('body')
  check('KW-01 キーワードがチップとして追加される', kwFormText.includes('ずっきーにのひみつご'))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const kwDetailText = await page.textContent('body')
  check('KW-01 保存自体は成功する(詳細にタイトルが出る)', kwDetailText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 保存後の詳細画面にキーワード文字列が表示されない', !kwDetailText.includes('ずっきーにのひみつご'))

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('KW-01 一覧画面にもキーワード文字列が表示されない(検索前)', !(await page.textContent('body')).includes('ずっきーにのひみつご'))
  await page.locator('input[type="search"]').fill('ずっきーにのひみつご')
  await page.waitForTimeout(400)
  const kwSearchText = await page.textContent('body')
  check('KW-01 検索キーワードでレシピがヒットする', kwSearchText.includes('E2Eキーワード確認レシピ'))
  // 見る先を「一覧のカード」に絞る(2026-08-19 司令部)。
  // それまでは画面全体の文字で見ていたが、便HUが「検索した言葉をタグに登録する」ボタンを足し、
  // その文字に**利用者が自分で打った検索語**が入るようになったため、
  // レシピ側の隠しキーワードが漏れていなくても赤くなっていた。
  // ここが守りたいのは「レシピの情報としてキーワードが出ていないこと」なので、カードの中だけを見る。
  // カードが0枚だと素通り合格になるので、先に掴めていることを確かめる
  const kwCards = await page.locator('a[href*="#/recipes/"]').count()
  check('KW-01 前提: 検索結果のカードを掴めている', kwCards > 0, `カード数=${kwCards}`)
  const kwCardTexts = (await page.locator('a[href*="#/recipes/"]').allTextContents()).join(' ')
  check(
    'KW-01 検索結果のカードにキーワード文字列自体は表示されない',
    kwCards > 0 && !kwCardTexts.includes('ずっきーにのひみつご'),
  )

  // 検索語をクリアしておく(一覧の検索条件はsessionStorageに保存され、この後の一覧系チェックが
  // 同じpage/contextを使い回すため、絞り込んだままだと後続チェックの「a[href^="#/recipes/"]」の
  // querySelectorが0件ヒットの一覧で「＋(新規登録)」リンクを拾ってしまい誤検出になる)
  await page.locator('input[type="search"]').fill('')
  await page.waitForTimeout(400)

  // 後始末: 検証用に作成したレシピを削除
  await page.getByText('E2Eキーワード確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- INTRO-01: ひとこと説明(intro・任意。2026-07-13)。料理名だけでは中身が想像しにくい
  // 料理向けの短い説明文。フォームで入力→保存→詳細の料理名の直下に表示されることを確認する ---
  currentCheck = 'INTRO-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eひとこと説明確認レシピ')
  // ひとこと説明欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder(ja.form.introPlaceholder)
    .fill('E2E確認用のひとこと説明テキスト')
  await page.getByRole('tab', { name: ja.form.formTabSimple }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 2026-07-16 UI総点検A-8: introもwrapJaPhrases経由(ja-phrase)の描画になり、文節境界にZWSPが
  // 入るようになったため、他のMemoText系フィールドと同じくstripZwspしてから比較する
  const introDetailText = stripZwsp(await page.textContent('body'))
  check(
    'INTRO-01 保存後の詳細に料理名が表示される',
    introDetailText.includes('E2Eひとこと説明確認レシピ'),
  )
  check(
    'INTRO-01 保存後の詳細に料理名の下にひとこと説明が表示される',
    introDetailText.includes('E2E確認用のひとこと説明テキスト'),
  )
  const introHeading = page.getByRole('heading', { name: 'E2Eひとこと説明確認レシピ' })
  const introBelowTitle = stripZwsp(
    await introHeading.evaluate((el) => {
      const next = el.nextElementSibling
      return next?.textContent ?? ''
    }),
  )
  check(
    'INTRO-01 ひとこと説明は料理名見出しの直後の要素に表示される',
    introBelowTitle.includes('E2E確認用のひとこと説明テキスト'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- ONEPOINT-01: メモ2区画化(2026-07。オーナー承認済み設計)。「ワンポイント」
  // (こつ・知識)と「メモ」(保存方法・注意書き・安全)を別々に入力→保存→詳細画面で
  // ①ワンポイント→②メモの順で見出し付きで表示されること・編集画面を開き直しても
  // 両方の入力が保持されることを確認する ---
  currentCheck = 'ONEPOINT-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eワンポイントメモ確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')
  // ワンポイント・メモ欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder(ja.form.onePointPlaceholder)
    .fill('E2E確認用のワンポイント本文')
  await page.getByPlaceholder(ja.form.memoPlaceholder).fill('E2E確認用のメモ本文')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 本文はMemoText(改行エンジン)経由でZWSPが挿入されるため、素のincludesでは一致しない。stripZwspで除去してから照合する
  const onePointDetailText = stripZwsp(await page.textContent('body'))
  check(
    'ONEPOINT-01 保存後の詳細にワンポイント本文が表示される',
    onePointDetailText.includes('E2E確認用のワンポイント本文'),
  )
  check(
    'ONEPOINT-01 保存後の詳細にメモ本文が表示される',
    onePointDetailText.includes('E2E確認用のメモ本文'),
  )
  const onePointHeadings = await page.locator('h2').allTextContents()
  const onePointIdx = onePointHeadings.indexOf('ワンポイント')
  const memoIdx = onePointHeadings.indexOf('メモ')
  check('ONEPOINT-01 「ワンポイント」見出しが存在する', onePointIdx !== -1)
  check('ONEPOINT-01 「メモ」見出しが存在する', memoIdx !== -1)
  check(
    'ONEPOINT-01 表示順は①ワンポイント→②メモ(オーナー承認済み設計)',
    onePointIdx !== -1 && memoIdx !== -1 && onePointIdx < memoIdx,
    `headings: ${JSON.stringify(onePointHeadings)}`,
  )

  // 編集画面を開き直しても両方の入力が保持される(DB保存の確認)。編集画面の初期表示は
  // 常に「かんたん」タブのため、ワンポイント・メモを確認するには「くわしく」への切替が必要
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  const onePointEditValue = await page
    .getByPlaceholder(ja.form.onePointPlaceholder)
    .inputValue()
  const memoEditValue = await page.getByPlaceholder(ja.form.memoPlaceholder).inputValue()
  check(
    'ONEPOINT-01 編集画面のワンポイント欄に保存内容が復元される',
    onePointEditValue === 'E2E確認用のワンポイント本文',
    `実際の値: ${onePointEditValue}`,
  )
  check(
    'ONEPOINT-01 編集画面のメモ欄に保存内容が復元される',
    memoEditValue === 'E2E確認用のメモ本文',
    `実際の値: ${memoEditValue}`,
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- DISHTYPE-01: レシピ種別チップ(主菜/副菜/汁物/デザート・任意選択。2026-07-13
  // 献立の主菜+副菜提案精度向上対応)。選択→保存→編集画面を開き直しても選択状態が
  // 保持される(DB保存の確認)こと、もう一度押すと解除できることを確認する ---
  currentCheck = 'DISHTYPE-01'
  const isChipActive = (locator) => locator.evaluate((el) => el.className.includes('border-accent'))
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2E種別チップ確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
  await page.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')
  // 種別チップは「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  const sideChip = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 保存前は「副菜」チップが未選択', !(await isChipActive(sideChip)))
  await sideChip.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 「副菜」チップをタップすると選択状態になる', await isChipActive(sideChip))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  check(
    'DISHTYPE-01 保存自体は成功する(詳細にタイトルが出る)',
    (await page.textContent('body')).includes('E2E種別チップ確認レシピ'),
  )
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: ja.form.formTabDetail }).click()
  await page.waitForTimeout(200)
  const sideChipEdit = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 編集画面を開き直しても選択状態が保持される(DB保存の確認)', await isChipActive(sideChipEdit))
  await sideChipEdit.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 もう一度押すと選択が解除される', !(await isChipActive(sideChipEdit)))

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- STEP0-01: 手順0件のレシピ(バグ修正2026-07)。手順欄を空のまま保存すると
  // cleanInput()で空の手順行が除かれ steps:[] になる。この状態の詳細画面で
  // 「調理中モードで見る」ボタンが表示されず(押せてクラッシュすることがない)ことを確認する ---
  currentCheck = 'STEP0-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder(ja.form.namePlaceholder).fill('E2E手順0件確認レシピ')
  await page.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
  // 手順本文は空のまま保存する(このレシピが手順0件になる)
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const step0DetailText = await page.textContent('body')
  check(
    'STEP0-01 保存自体は成功する(詳細にタイトルが出る)',
    step0DetailText.includes('E2E手順0件確認レシピ'),
  )
  check(
    'STEP0-01 手順0件では「調理中モードで見る」ボタンが表示されない',
    !step0DetailText.includes('調理中モードで見る'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.form.deleteRecipe }).click()
  await page.waitForTimeout(800)

  // --- NUTSORT-01: 栄養並び替えの無料側(2026-07-13 Fable設計→2026-07-16 便T-4で5項目まとめて
  // Pro機能化→**2026-08-01 線引きB'(オーナー確定)でカロリー順だけ無料に開放**)。
  // 無料(未解錠)では並び替えパネルに「カロリー」だけが選択肢として出て、たんぱく質・塩分・脂質・糖質は
  // グレーのティーザー行にまとまり、タップ先が既存のPro案内(設定のProタブ)であることを確認する。
  // 実際の並び順の検証はPro解錠済みのNUTSORT-02側で行う ---
  currentCheck = 'NUTSORT-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  const nutSortPanelText = await page.textContent('body')
  // 見出しは2026-08-19 便HU・⑯(オーナー指示)で「栄養価で探す」→「栄養価で並び替え」に戻した
  check(
    "NUTSORT-01(B') 無料でも「栄養価で並び替え」の見出しが出る",
    nutSortPanelText.includes('栄養価で並び替え'),
  )
  check(
    "NUTSORT-01(B'・便HU⑯) 無料のティーザーはPro側7項目の案内になっている",
    nutSortPanelText.includes(ja.search.sortNutritionGate),
  )
  check(
    'NUTSORT-01(便HU⑯) ティーザーにPro側の項目名が並ぶ',
    nutSortPanelText.includes(
      'たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウム・塩分相当量で並び替えられます',
    ),
  )
  // 2026-08-19 便HZ・①(オーナー「並び替え『たんぱく質が多い順〜探せます』削除。
  // タイトルのみで目的がわかるため」)。無料・Proの両方とも消したので、無料側でも出ない
  check(
    'NUTSORT-01(便HZ①) 並び替えの見出しに添えていた用途の1行が無い',
    !nutSortPanelText.includes('目的からレシピを探せます'),
  )
  const freeNutrientButtons = await page.evaluate(() => {
    // 栄養表示の8項目の名前。無料で選べるのがエネルギーだけであることを見る
    const names = [
      'エネルギー',
      'たんぱく質',
      '脂質',
      '炭水化物',
      '食物繊維',
      '鉄',
      'カルシウム',
      '塩分相当量',
    ]
    const buttons = Array.from(document.querySelectorAll('button'))
    return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
  })
  check(
    "NUTSORT-01(B') 無料で選べる栄養並び替えはエネルギー順だけ",
    freeNutrientButtons.length === 1 && freeNutrientButtons[0] === 'エネルギー',
    `出た項目=${JSON.stringify(freeNutrientButtons)}`,
  )
  const teaserHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'))
    const teaser = links.find((a) => a.textContent?.includes('（Pro機能）'))
    return teaser?.getAttribute('href') ?? null
  })
  // 2026-08-02 便DF: 行き先は従来どおり設定のPro節で、末尾に戻り先(?back=)が付く
  // (帰り道の検証はSETBACK-01。ここでは行き先が変わっていないことだけを見る)
  check(
    'NUTSORT-01 ティーザーのタップ先は既存のPro案内(設定のPro節)',
    teaserHref === '#/settings?section=pro&back=%2Frecipes',
    `href=${teaserHref}`,
  )
  // 無料でもエネルギー順が実際に使えること(選ぶとカードに「エネルギー: ◯kcal」が出る)を確かめる。
  // 「選択肢が出ている」だけでは、値の表示ゲート(nutrientBadgeTextFor)が閉じたままでも通ってしまう
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'エネルギー',
    )
    button?.click()
  })
  await page.waitForTimeout(600)
  const freeKcalSortText = await page.textContent('body')
  check(
    "NUTSORT-01(B') 無料でエネルギー順を選ぶとカードに「エネルギー: ◯kcal」が出る",
    /エネルギー: [\d,]+kcal/.test(freeKcalSortText),
    'エネルギー順のバッジが出ていない',
  )
  check(
    "NUTSORT-01(B') 無料のカードに塩分相当量の値は出ない",
    !/塩分相当量: /.test(freeKcalSortText),
  )
  // 並び替えを既定(更新順)に戻してから閉じる
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === '更新順',
    )
    button?.click()
  })
  await page.waitForTimeout(400)
  // パネルを閉じ、以降のチェックに影響しないようにする(条件は何も変えていない)。
  // 2026-08-19 便HU・⑰: 旧「決定」は廃止し「閉じる」に置き換わった
  await page.locator('[data-testid="sort-panel-close"]').click()
  await page.waitForTimeout(300)
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- UI-390-01: 390px幅(iPhone 12〜15相当)のレシピ詳細で、「原価を見る」「原価を編集」を
  // ONにしても横スクロールが出ず、「人数を増やす」ボタンが画面内に収まること
  // (2026-07-28 便BY/UI-01。従来は見出し行を1本のflexにshrink-0で並べていたため
  // documentElement.scrollWidthが416pxへ膨らみ、＋ボタンが画面外に出ていた) ---
  currentCheck = 'UI-390-01'
  {
    const w390Browser = await chromium.launch()
    try {
      const w390Context = await w390Browser.newContext({ viewport: { width: 390, height: 844 } })
      const w390Page = await w390Context.newPage()
      await w390Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await w390Page.waitForTimeout(1200)
      await w390Page.getByText('肉じゃが', { exact: true }).first().click()
      await w390Page.waitForTimeout(600)
      // 2026-08-03 オーナー指示: 原価トグルは押しても場所が動かないこと。ボタン自身と
      // 人数ステッパーの位置を毎回測り、開閉で動かないことを見張る(再発防止)。
      // 位置は見出し「材料」を原点にした相対座標で測る(クリックで画面がスクロールしても
      // ずれない。ビューポート座標のままだと「スクロールした」だけで落ちてしまう)
      const costToggle = w390Page.getByRole('button', { name: new RegExp(`^(${ja.detail.priceViewShow}|${ja.detail.priceViewHide})$`) })
      const measure = async () => {
        const doc = await w390Page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))
        const box = await w390Page.getByRole('button', { name: ja.detail.servingsUp }).boundingBox()
        const toggleBox = await costToggle.boundingBox()
        const headBox = await w390Page
          .getByRole('heading', { name: '材料', level: 2 })
          .boundingBox()
        const rel = (b) =>
          b && headBox ? `${Math.round(b.x - headBox.x)},${Math.round(b.y - headBox.y)}` : null
        return {
          ...doc,
          plusRight: box ? box.x + box.width : null,
          plusPos: rel(box),
          togglePos: rel(toggleBox),
        }
      }
      const before = await measure()
      check(
        'UI-390-01 原価OFFでは横スクロールが出ない(前提)',
        before.scrollWidth === before.clientWidth,
        JSON.stringify(before),
      )
      await costToggle.click()
      await w390Page.waitForTimeout(400)
      const view = await measure()
      check(
        'UI-390-01 「原価を見る」ONでも横スクロールが出ない',
        view.scrollWidth === view.clientWidth,
        JSON.stringify(view),
      )
      check(
        'UI-390-01 「原価を見る」ONでも「人数を増やす」が画面内に収まる',
        view.plusRight != null && view.plusRight <= view.clientWidth,
        JSON.stringify(view),
      )
      check(
        'UI-390-01(2026-08-03) 原価トグルを押してもボタンと人数ステッパーの位置が動かない',
        view.togglePos === before.togglePos && view.plusPos === before.plusPos,
        `OFF=${JSON.stringify(before)} ON=${JSON.stringify(view)}`,
      )
      await w390Page.getByRole('button', { name: ja.detail.priceEditShow }).click()
      await w390Page.waitForTimeout(400)
      const edit = await measure()
      check(
        'UI-390-01 「原価を編集」ONでも横スクロールが出ず＋ボタンが画面内に収まる',
        edit.scrollWidth === edit.clientWidth &&
          edit.plusRight != null &&
          edit.plusRight <= edit.clientWidth,
        JSON.stringify(edit),
      )
      check(
        'UI-390-01(2026-08-03) 「原価を編集」を出しても原価トグル・人数ステッパーの位置は動かない',
        edit.togglePos === before.togglePos && edit.plusPos === before.plusPos,
        `OFF=${JSON.stringify(before)} EDIT=${JSON.stringify(edit)}`,
      )
      // --- UI-390-02: 時間トークン2連の接着(「[30分]〜[1時間]ほど漬ける。」)が横あふれを
      // 起こさないこと(2026-07-27 機能④診断C1。mergeTildeBoxesの無条件nowrap接着で
      // レシピ87を開くだけでページ全体が横あふれし、Chrome Android相当では全ボタンが
      // 押下不能になっていた。12字の幅ガードで〜の前後の行割りを許容して解消) ---
      currentCheck = 'UI-390-02'
      await w390Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await w390Page.waitForTimeout(800)
      await w390Page.getByPlaceholder(ja.search.placeholder).fill('冷やしトマト')
      await w390Page.waitForTimeout(600)
      await w390Page.getByText('冷やしトマトの浅漬け', { exact: true }).first().click()
      await w390Page.waitForTimeout(800)
      const tildeDoc = await w390Page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      check(
        'UI-390-02 時間トークン2連のレシピ詳細で横あふれしない',
        tildeDoc.scrollWidth <= tildeDoc.clientWidth,
        JSON.stringify(tildeDoc),
      )
    } finally {
      await w390Browser.close()
    }
  }

  // --- FOCUS-SCROLL-01: 調理中モードで長い手順を開いても本文の冒頭が「上に到達不能」に
  // ならないこと(2026-07-28 機能④診断C2)。素の justify-center は中身が枠より高いとき
  // 開始側をスクロール原点より外へ押し出し、scrollTopは負にできないため冒頭が永久に
  // 読めなくなっていた(375x667の同梱レシピ10手順・最大101px欠落。Chromium系)。
  // justify-center-safe(safe center)であふれた時だけ上寄せに落ちる ---
  currentCheck = 'FOCUS-SCROLL-01'
  {
    // 調理中モードの✕(左上)を押して閉じる
    const fsFocusClose = async (p) => {
      await p.locator('.fixed.inset-0.z-50').getByRole('button', { name: ja.common.close }).first().click()
      await p.waitForTimeout(400)
    }
    const fsBrowser = await chromium.launch()
    try {
      const fsContext = await fsBrowser.newContext({
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
      })
      const fsPage = await fsContext.newPage()
      await fsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(1200)
      await fsPage.getByPlaceholder(ja.search.placeholder).fill('冷やし茶碗蒸し')
      await fsPage.waitForTimeout(600)
      await fsPage.getByText('冷やし茶碗蒸し', { exact: true }).first().click()
      await fsPage.waitForTimeout(800)
      await fsPage.getByText(ja.focus.open).click()
      await fsPage.waitForTimeout(500)
      // 診断で最大(101px)の欠落が出ていた手順4/8まで送る
      for (let i = 0; i < 3; i++) {
        await fsPage.getByRole('button', { name: ja.focus.next }).click()
        await fsPage.waitForTimeout(250)
      }
      const reach = await fsPage.evaluate(() => {
        // 手順本文の枠。2026-08-03 便DS でタイマー行にも「flex-1 + overflow-y-auto」を持つ
        // 入れ物ができたため、縦並び(flex-col)であることまで見て本文の枠だけを選ぶ
        const scroller = Array.from(document.querySelectorAll('div')).find(
          (d) =>
            d.className.includes('overflow-y-auto') &&
            d.className.includes('flex-1') &&
            d.className.includes('flex-col'),
        )
        const body = scroller?.querySelector('p.ja-phrase')
        const badge = scroller?.firstElementChild
        if (!scroller || !body || !badge) return null
        scroller.scrollTop = -99999 // 上限まで戻す(負は0に丸められる)
        const top = scroller.getBoundingClientRect().top
        return {
          step: document.body.innerText.match(/手順 \d+\/\d+/)?.[0] ?? '',
          justify: getComputedStyle(scroller).justifyContent,
          hiddenBody: Math.round(top - body.getBoundingClientRect().top),
          hiddenBadge: Math.round(top - badge.getBoundingClientRect().top),
        }
      })
      check(
        'FOCUS-SCROLL-01 375x667の長い手順で本文の冒頭が枠の上に隠れない',
        reach != null && reach.hiddenBody <= 0,
        JSON.stringify(reach),
      )
      check(
        'FOCUS-SCROLL-01 手順番号バッジも枠内に収まる(上に押し出されない)',
        reach != null && reach.hiddenBadge <= 0,
        JSON.stringify(reach),
      )
      check(
        'FOCUS-SCROLL-01 縦位置の指定は safe center(短い手順の中央寄せは維持)',
        reach != null && reach.justify === 'safe center',
        JSON.stringify(reach),
      )
      // 375px幅の横あふれ監視(2026-07-28): 横に1pxでもあふれるとChromeモバイルは
      // ページ全体をズームアウトし、fixed inset-0 の調理中モードが画面より高く描画されて
      // 「前へ/次へ」が可視域の外に落ちる(機能④診断C1と同じ機構)。
      // 説明文を足したときに再発しやすいので、詳細ページと調理中モードの両方で見張る
      const w375 = await fsPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        innerHeight: window.innerHeight,
      }))
      check(
        'FOCUS-SCROLL-01 375px幅の調理中モードで横あふれしない(ボタンが画面外に落ちない)',
        w375.scrollWidth <= w375.clientWidth && w375.innerHeight === 667,
        JSON.stringify(w375),
      )
      const nextReachable = await fsPage.evaluate(() => {
        const overlay = document.querySelector('.fixed.inset-0.z-50')
        const next = Array.from(overlay.querySelectorAll('button')).find((b) =>
          b.textContent.includes('次へ'),
        )
        if (!next) return null
        const r = next.getBoundingClientRect()
        return { bottom: Math.round(r.bottom), viewport: window.innerHeight }
      })
      check(
        'FOCUS-SCROLL-01 「次へ」が可視域の中に収まっている',
        nextReachable != null && nextReachable.bottom <= nextReachable.viewport,
        JSON.stringify(nextReachable),
      )
      // 背景スクロールのロック(2026-07-28 機能④診断): 手順を読むための縦スワイプが
      // 背後のレシピ詳細に抜けると、閉じたときに見当違いな位置へ着地する
      const scrollBefore = await fsPage.evaluate(() => window.scrollY)
      await fsPage.mouse.move(180, 400)
      await fsPage.mouse.wheel(0, 500)
      await fsPage.waitForTimeout(400)
      const scrollLeak = await fsPage.evaluate(() => ({
        after: window.scrollY,
        bodyOverflow: getComputedStyle(document.body).overflow,
        htmlOverflow: getComputedStyle(document.documentElement).overflow,
      }))
      check(
        'FOCUS-SCROLL-01 調理中モード表示中は背景のレシピ詳細がスクロールしない',
        scrollBefore === scrollLeak.after &&
          scrollLeak.bodyOverflow === 'hidden' &&
          scrollLeak.htmlOverflow === 'hidden',
        JSON.stringify({ before: scrollBefore, ...scrollLeak }),
      )
      await fsFocusClose(fsPage)
      const scrollRestored = await fsPage.evaluate(
        () => getComputedStyle(document.body).overflow,
      )
      check(
        'FOCUS-SCROLL-01 閉じたら背景のスクロールは元に戻る',
        scrollRestored !== 'hidden',
        scrollRestored,
      )
      const w375Detail = await fsPage.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))
      check(
        'FOCUS-SCROLL-01 375px幅のレシピ詳細でも横あふれしない(入口の説明文を足しても)',
        w375Detail.scrollWidth <= w375Detail.clientWidth,
        JSON.stringify(w375Detail),
      )

      // --- SCROLLLOCK-01: 窓を開いているあいだ後ろの画面が動かず、閉じたら元の位置に戻る
      // (2026-08-16 便HE・オーナー実機「窓内を縦にスクロールするつもりが、後ろの画面が
      // 動いてしまうことがあります」)。
      //
      // 見るのは3つ。どれも「利用者が確かめたいこと」で測る:
      //  ① 止めた瞬間に見た目がずれない(後ろの画面の要素が、画面のどこに見えているか)
      //  ② 窓が重なっているとき、上の1枚を閉じても下の窓ぶんの固定は外れない
      //  ③ 閉じたら、開く前に見ていた位置に戻る(ここが壊れると「戻ったら先頭に飛ぶ」になる)
      //
      // ③は「本体を固定する」やり方の代償で、対処しないと必ず先頭へ飛ぶ。
      // 送る位置は画面の長さから決める(決め打ちの数値にしない)
      currentCheck = 'SCROLLLOCK-01'
      const lockTargetY = await fsPage.evaluate(() => {
        const reachable = document.documentElement.scrollHeight - window.innerHeight
        const y = Math.round(Math.min(reachable, window.innerHeight) / 2)
        window.scrollTo(0, y)
        return y
      })
      await fsPage.waitForTimeout(300)
      const lockBefore = await fsPage.evaluate(() => ({
        y: window.scrollY,
        mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
        mainWidth: Math.round(document.querySelector('main').getBoundingClientRect().width),
      }))
      check(
        'SCROLLLOCK-01 前提: 窓を開く前にレシピ詳細を途中まで送れている',
        lockBefore.y > 0,
        JSON.stringify({ lockTargetY, ...lockBefore }),
      )
      // 入口のボタンは画面の下のほうにあるので、locator の click だと Playwright が
      // 先にその位置まで画面を送ってしまい、「送っていた位置」が測る前に変わる。
      // ここで見たいのは窓を開いた瞬間の位置なので、送らずにそのまま押す
      await fsPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.includes('調理中モードで見る'),
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await fsPage.waitForTimeout(500)
      const lockDuring = await fsPage.evaluate(() => ({
        mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
        mainWidth: Math.round(document.querySelector('main').getBoundingClientRect().width),
        bodyPosition: getComputedStyle(document.body).position,
      }))
      check(
        'SCROLLLOCK-01 後ろの画面を止めても、見た目の位置と幅が動かない',
        lockDuring.mainTop === lockBefore.mainTop && lockDuring.mainWidth === lockBefore.mainWidth,
        JSON.stringify({ before: lockBefore, during: lockDuring }),
      )
      // 窓の重なり: 全画面の調理中モードの上に「文字の大きさ」の窓を開いて閉じる。
      // 上の1枚を閉じただけで下の全画面ぶんの固定まで外れると、後ろの画面がまた動き出す
      await fsPage.getByTestId('cook-text-size-open').click()
      await fsPage.waitForTimeout(300)
      const nestedOpen = await fsPage.evaluate(
        () => getComputedStyle(document.body).position,
      )
      await fsPage
        .getByTestId('cook-text-size-modal')
        .getByRole('button', { name: ja.common.close })
        .click()
      await fsPage.waitForTimeout(300)
      const nestedClosed = await fsPage.evaluate(() => ({
        bodyPosition: getComputedStyle(document.body).position,
        mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
        overlayStillOpen: document.querySelector('.fixed.inset-0.z-50') !== null,
      }))
      check(
        'SCROLLLOCK-01 重ねた窓を閉じても、下の全画面ぶんの止めは外れない',
        nestedOpen === lockDuring.bodyPosition &&
          nestedClosed.bodyPosition === lockDuring.bodyPosition &&
          nestedClosed.mainTop === lockBefore.mainTop &&
          nestedClosed.overlayStillOpen,
        JSON.stringify({ nestedOpen, ...nestedClosed }),
      )
      await fsFocusClose(fsPage)
      await fsPage.waitForTimeout(400)
      const lockAfter = await fsPage.evaluate(() => ({
        y: window.scrollY,
        mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
        bodyPosition: getComputedStyle(document.body).position,
      }))
      check(
        'SCROLLLOCK-01 窓を閉じたら、開く前に見ていた位置に戻っている',
        lockAfter.y === lockBefore.y &&
          lockAfter.mainTop === lockBefore.mainTop &&
          lockAfter.bodyPosition !== 'fixed',
        JSON.stringify({ before: lockBefore, after: lockAfter }),
      )
      currentCheck = 'FOCUS-SCROLL-01'

      // --- FOCUS-COPY-01: 何ができる機能かが読んで分かること(2026-07-28 機能④診断C13/C15/C16/C17) ---
      currentCheck = 'FOCUS-COPY-01'
      const detailBody = await fsPage.textContent('body')
      check(
        'FOCUS-COPY-01 入口の説明で読み上げ・声の操作・タイマーまで伝わる',
        detailBody.includes(ja.focus.openHint),
      )
      await fsPage.getByText(ja.focus.open).click()
      await fsPage.waitForTimeout(500)
      const focusBody = await fsPage.textContent('body')
      // 2026-08-15 便GS（オーナー承認「ナビ側に揃えて」）で、声で使える言葉の案内は
      // **「声で操作」を押している間だけ**出るようになった（押していないときに
      // 「『次へ』で手順の移動」と書いてあると、その言葉はいま何も起きない＝画面が嘘をつく）。
      // 測りたいのは「使える言葉が読んで分かること」なので、**押してから**確かめる。
      // 実機の音声認識は自動では再現できないので、他の節と同じやり方で入れ物だけ差し替える
      await fsPage.evaluate(() => {
        class FakeRecognition {
          constructor() { window.__recognition = this }
          start() {}
          stop() {}
          abort() {}
        }
        window.SpeechRecognition = FakeRecognition
        window.webkitSpeechRecognition = FakeRecognition
      })
      check(
        'FOCUS-COPY-01 押す前は、いま効かない言葉を並べない',
        !focusBody.includes('「次へ」「戻って」で手順の移動'),
      )
      const fsMic = fsPage.getByRole('button', { name: ja.focus.micLabel })
      if (await fsMic.count()) {
        await fsMic.first().click()
        await fsPage.waitForTimeout(500)
      }
      const focusListeningBody = await fsPage.textContent('body')
      check(
        'FOCUS-COPY-01 声のコマンドに「何が起きるか」が添えられている（押している間）',
        focusListeningBody.includes('「次へ」「戻って」で手順の移動') &&
          focusListeningBody.includes(ja.focus.micHintTimer),
      )
      const iconLabels = await fsPage.evaluate(() =>
        Array.from(document.querySelector('.fixed.inset-0.z-50').querySelectorAll('button span'))
          .map((s) => s.textContent)
          .filter((t) => t === '読み上げ' || t === '声で操作'),
      )
      check(
        'FOCUS-COPY-01 アイコンだけのボタンに小さな名前が添えられている(読み上げ・声で操作)',
        iconLabels.includes('読み上げ') && iconLabels.includes('声で操作'),
        JSON.stringify(iconLabels),
      )
      await fsPage
        .locator('.fixed.inset-0.z-50')
        .getByRole('button', { name: ja.timer.customOpenAria })
        .click()
      await fsPage.waitForTimeout(400)
      check(
        'FOCUS-COPY-01 タイマーの窓に用途の説明がある',
        (await fsPage.getByRole('dialog', { name: 'タイマー', exact: true }).textContent()).includes(
          'レシピの手順とは関係なく、好きな時間ではかれます',
        ),
      )
    } finally {
      await fsBrowser.close()
    }
  }

  // --- SMK-14: テーマ・第◯弾の括りを全廃(2026-07-23オーナー確定)。旧配布テーマ(全52品)は
  // 同梱の「基本レシピ」に合流し、初回シードで全109品が入る(2026-07-29に副菜6品を追加)。まっさらな状態で:
  //  (1) 初回シードで109品が全て「基本レシピ」(isStarter・sourceSetIdなし)として入る
  //  (2) 旧テーマ由来の代表品が基本レシピとして存在する
  //  (3) 設定にテーマ一覧・「すべて追加」等のテーマUIが一切存在しない
  //  (4) 旧配布ページの ?set= 付きURLで来ても、エラーにならず設定へ無害に着地する(取り込みは起きない)
  // を、専用のbrowser/contextで確認する(主フローのDBを汚さないため) ---
  currentCheck = 'SMK-14'
  {
    const freeBrowser = await chromium.launch()
    const freeContext = await freeBrowser.newContext()
    const freePage = await freeContext.newPage()
    freePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SMK-14] ${err.message}`)
    })
    // ?set= 付きURLで確認ダイアログが出ないこと自体も仕様だが、万一出ても止まらないよう承諾しておく
    freePage.on('dialog', (dialog) => dialog.accept())
    try {
      await freePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(2200) // 初回シード完了待ち(109品)

      // (1) 初回シードで109品が全て「平らな基本レシピ」(isStarter・sourceSetIdなし)として入る
      const seededStats = await freePage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getAll = tx.objectStore('recipes').getAll()
              getAll.onsuccess = () => {
                const rs = getAll.result
                resolve({
                  total: rs.length,
                  starters: rs.filter((r) => r.isStarter === true).length,
                  withSourceSet: rs.filter((r) => r.sourceSetId != null).length,
                  hasKintore: rs.some((r) => r.title === 'レンジ蒸し鶏（自家製サラダチキン）'),
                  hasDashi: rs.some((r) => r.title === 'だしのとり方'),
                })
              }
              getAll.onerror = () => reject(getAll.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'SMK-14 初回シードで109品が入る',
        seededStats.total === 109,
        `total=${seededStats.total}`,
      )
      check(
        'SMK-14 全品が「基本レシピ」(isStarter)で、テーマ由来のsourceSetIdは付かない(平ら)',
        seededStats.starters === 109 && seededStats.withSourceSet === 0,
        `starters=${seededStats.starters} withSourceSet=${seededStats.withSourceSet}`,
      )
      check(
        'SMK-14 旧テーマ由来の代表品(高たんぱく・だしのとり方)が基本レシピとして同梱される',
        seededStats.hasKintore && seededStats.hasDashi,
        `hasKintore=${seededStats.hasKintore} hasDashi=${seededStats.hasDashi}`,
      )

      // (3) 設定にテーマUI(テーマ一覧・すべて追加・テーマ一覧節)が一切存在しない
      await freePage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(800)
      const settingsBody = await freePage.textContent('body')
      const hasThemeSection = await freePage.evaluate(
        () => !!document.getElementById('theme-list-section'),
      )
      check(
        'SMK-14 設定にテーマ一覧・「すべて追加」等のテーマUIが存在しない',
        !settingsBody.includes('テーマ一覧') &&
          !settingsBody.includes('すべて追加') &&
          !hasThemeSection,
      )
      // 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)は配布互換として存続する
      check(
        'SMK-14 汎用の「レシピセットを読み込む」欄は存続する',
        settingsBody.includes(ja.settings.recipeSetTitle),
      )

      // (4) 旧 ?set= 付きURLで来ても、エラーにならず設定へ無害に着地する(取り込みは起きない)
      await freePage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(1000)
      const afterSetBody = await freePage.textContent('body')
      check(
        'SMK-14 ?set=付きURLは無害に設定へ着地する(取り込みは起きない・エラーも出ない)',
        !/\d+[品件]追加しました/.test(afterSetBody) &&
          !afterSetBody.includes('見つかりませんでした') &&
          afterSetBody.includes(ja.settings.ngTitle),
      )
      check(
        'SMK-14 ?set=付きURLの set パラメータは静かに取り除かれる',
        !freePage.url().includes('set=kintore'),
        `url=${freePage.url()}`,
      )
    } finally {
      await freeBrowser.close()
    }
  }

  // --- SETTINGS-TAB-01: 設定画面の1本スクロール化(2026-07-17オーナー採用決定。旧: 上部タブ4分割2026-07-12〜)。
  // 個人設定→レシピ→バックアップ→Pro→アプリについての5節が1画面に同時に存在し(=どれも隠れない)、
  // 上部の目次チップ(個人設定/レシピ/バックアップ/Pro/アプリ)のタップで該当節へスクロールすること・
  // ?section=/?set=直リンクが該当節へ自動スクロールすることを確認する。旧「他タブは隠れている」検証は
  // 「全節が同時に存在する」検証へ、旧aria-pressed検証はスクロール位置検証へ置き換えた。
  // 2026-08-02 オーナー指示: 旧「全般」節の中にあった「その他」(＝アプリについて)を
  // ページ最後の独立した節へ移した(その他がページ途中にある違和感の解消) ---
  currentCheck = 'SETTINGS-TAB-01'
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  {
    const body = await page.textContent('body')
    check(
      'SETTINGS-TAB-01 1本スクロール: 個人設定(NG食材)/レシピ(セット読み込み)/バックアップ(書き出し)/Pro(Pro版)の4節が同時に存在する',
      body.includes(ja.settings.ngTitle) &&
        body.includes(ja.settings.recipeSetTitle) &&
        body.includes('ファイルに書き出す') &&
        body.includes('Pro版'),
    )
  }
  check(
    'SETTINGS-TAB-01(便DH) 目次チップ(個人設定/レシピ/バックアップ/Pro/アプリ)が5つとも存在する',
    (await page.getByRole('button', { name: ja.settings.tabBasic, exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'レシピ', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: ja.settings.tabBackup, exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Pro', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: ja.settings.tocAbout, exact: true }).count()) === 1,
  )
  // 2026-08-02: 目次チップは5列。390px幅で1行に収まり、文字が折り返して高さが揃わなくならないこと
  {
    const chipRows = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="設定の目次"]')
      if (!nav) return null
      const chips = Array.from(nav.querySelectorAll('button'))
      const tops = new Set(chips.map((el) => Math.round(el.getBoundingClientRect().top)))
      const heights = new Set(chips.map((el) => Math.round(el.getBoundingClientRect().height)))
      return { count: chips.length, rows: tops.size, heights: heights.size }
    })
    check(
      'SETTINGS-TAB-01 目次チップ5つが1行に収まり、高さが揃っている(文字の折り返しが起きない)',
      chipRows !== null && chipRows.count === 5 && chipRows.rows === 1 && chipRows.heights === 1,
      JSON.stringify(chipRows),
    )
  }
  // 節の上端(viewport相対top)を返すヘルパ。sticky目次チップ(約88px)の下付近(<200)へ来たら
  // 「その節の先頭までスクロールした」とみなす(scroll-mt-24でチップ分だけ下げている)
  const settingsSectionTop = (id) =>
    page.evaluate((elId) => {
      const el = document.getElementById(elId)
      return el ? el.getBoundingClientRect().top : null
    }, id)
  // スムーズスクロールが落ち着く(window.scrollYが変化しなくなる)まで待つ。長距離のスムーズ
  // スクロールは固定待ちだとアニメーション途中で測ってしまうため(旧: 700ms固定で偽陰性)
  const waitScrollSettled = async () => {
    let last = -1
    for (let i = 0; i < 25; i++) {
      const y = await page.evaluate(() => Math.round(window.scrollY))
      if (y === last) return
      last = y
      await page.waitForTimeout(120)
    }
  }
  // 「Pro」チップ: 最上部から下部のPro節まで大きくスクロールする(topが大きく減る=下へ動いた)。
  // Pro節は最後尾なので先頭が上端(96px)まで届かず最下部で止まることがある→上端付近か最下部で合格
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const proTopBefore = await settingsSectionTop('section-pro')
  await page.getByRole('button', { name: 'Pro', exact: true }).click()
  await waitScrollSettled()
  const proTopAfter = await settingsSectionTop('section-pro')
  const proAtBottom = await page.evaluate(
    () => window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 8,
  )
  check(
    'SETTINGS-TAB-01 「Pro」チップのタップで下部のPro節までスクロールする',
    proTopBefore !== null &&
      proTopAfter !== null &&
      proTopAfter < proTopBefore - 100 &&
      (proTopAfter < 200 || proAtBottom),
    `proTopBefore=${proTopBefore} proTopAfter=${proTopAfter} atBottom=${proAtBottom}`,
  )
  // 「バックアップ」チップ: バックアップ節の先頭が上端付近へ来る
  await page.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
  await waitScrollSettled()
  const backupChipTop = await settingsSectionTop('section-backup')
  check(
    'SETTINGS-TAB-01 「バックアップ」チップのタップでバックアップ節の先頭が上端付近へ来る',
    backupChipTop !== null && backupChipTop >= -5 && backupChipTop < 200,
    `backupChipTop=${backupChipTop}`,
  )
  // 「レシピ」チップ: レシピ節の先頭が上端付近へ来る
  await page.getByRole('button', { name: 'レシピ', exact: true }).click()
  await waitScrollSettled()
  const recipeChipTop = await settingsSectionTop('section-recipe')
  check(
    'SETTINGS-TAB-01 「レシピ」チップのタップでレシピ節の先頭が上端付近へ来る',
    recipeChipTop !== null && recipeChipTop >= -5 && recipeChipTop < 200,
    `recipeChipTop=${recipeChipTop}`,
  )
  // 2026-08-02: 「アプリについて」節がページのいちばん最後(Pro節より下)にあること。
  // 旧構成では全般節の途中(レシピ節より上)にあり、「その他」がページ途中に出ていた
  {
    const order = await page.evaluate(() =>
      ['section-basic', 'section-recipe', 'section-backup', 'section-pro', 'section-about'].map(
        (id) => {
          const el = document.getElementById(id)
          return el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null
        },
      ),
    )
    check(
      'SETTINGS-TAB-01(2026-08-02) 節の並びは 個人設定→レシピ→バックアップ→Pro→アプリについて',
      order.every((v) => v !== null) && order.every((v, i) => i === 0 || v > order[i - 1]),
      JSON.stringify(order),
    )
    // 「その他」の小見出しが全般節から消えていること(売り場順カードの食材グループ名にも
    // 「その他」があるので、本文まるごとではなく小見出しの<p>だけを見る)
    const otherHeadingLeft = await page.evaluate(() => {
      const basic = document.getElementById('section-basic')
      if (!basic) return null
      return Array.from(basic.querySelectorAll('p')).some((el) => el.textContent?.trim() === 'その他')
    })
    check(
      'SETTINGS-TAB-01(2026-08-02) 個人設定節に「その他」の小見出しが残っていない',
      otherHeadingLeft === false,
      `otherHeadingLeft=${otherHeadingLeft}`,
    )
  }
  // ?section=about の直リンクが「アプリについて」節へ着地する(既存の?section=値は不変)
  {
    await page.goto(`${BASE}/#/settings?section=about`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    await waitScrollSettled()
    const aboutTop = await settingsSectionTop('section-about')
    const aboutAtBottom = await page.evaluate(
      () => window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 8,
    )
    check(
      'SETTINGS-TAB-01(2026-08-02) ?section=about で「アプリについて」節へ着地する',
      aboutTop !== null && (aboutTop < 200 || aboutAtBottom),
      `aboutTop=${aboutTop} atBottom=${aboutAtBottom}`,
    )
    await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
  }

  // --- BANNER-01(2026-07-17設定ゼロベース裁定#1): バックアップ状態バナー。目次チップの下・
  // 全節共通の常設バナー。「書き出しへ」はどこからでもバックアップ節の①書き出しカードへ
  // スクロールする(1本スクロール化でタブ切り替えは廃止。ボタン文言は2026-07-30 便CJ/C7で
  // 「今すぐ保存」から改名: 押しても保存はせずスクロールするだけ)。
  // 2026-08-26 便LI: 一度もバックアップしていない状態は**警告ではなく「すすめ」**にした
  // （オーナー原文「いきなり『まだ〜』と出てきても、まだも何も何も説明受けてないけど？」）。
  // 警告色になっていないことも実DOMで見る ---
  currentCheck = 'BANNER-01'
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  check(
    'BANNER-01 全節共通のバックアップ状態バナーが見える(未実施は「すすめ」)',
    stripZwspText(await page.textContent('body')).includes(ja.settings.bannerBackupNotYet),
  )
  check(
    'BANNER-01(便LI) 一度も書き出していない人を責める文言が出ていない',
    !stripZwspText(await page.textContent('body')).includes('まだバックアップしていません'),
  )
  {
    const bannerWarnCls = await page.evaluate((text) => {
      const btn = Array.from(document.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').replace(/\u200B/g, '').trim() === text,
      )
      return btn ? `${btn.className} ${btn.parentElement?.className ?? ''}` : null
    }, ja.settings.bannerBackupNotYet)
    check(
      'BANNER-01(便LI) 未実施のバナーは警告色になっていない',
      bannerWarnCls !== null && !bannerWarnCls.includes('warning'),
      `class=${bannerWarnCls}`,
    )
  }
  // 2026-08-27 便LS（オーナー追記「初回のみ、バックアップのすすめと説明にすべき→お知らせの
  // 文章に」）: すすめの置き場所が**書き出しカードの中→献立の画面のお知らせ**に移った。
  // カードの中の1行（旧 backupNotYet）は、オーナー原文「場所が中途半端で目立たないので、
  // 存在意義がない。削除」のとおり外している。移った先の中身は BKNOTICE-01 が見る
  check(
    'BANNER-01(便LS) 書き出しカードの中に、未実施の1行が残っていない',
    !stripZwspText(await page.textContent('body')).includes('最初のバックアップ'),
  )
  await page.getByRole('button', { name: ja.settings.bannerSaveNow, exact: true }).click()
  await waitScrollSettled()
  check(
    'BANNER-01 「書き出しへ」でバックアップの①書き出しカードへスクロールする(ボタンがDOMにある)',
    (await page.textContent('body')).includes('ファイルに書き出す'),
  )
  {
    const exportCardTop = await settingsSectionTop('backup-section')
    check(
      'BANNER-01 「書き出しへ」で①バックアップを取るカードが上端付近へ来る(旧aria-pressed検証をスクロール位置検証へ)',
      exportCardTop !== null && exportCardTop >= -5 && exportCardTop < 200,
      `exportCardTop=${exportCardTop}`,
    )
  }

  // 1本スクロールでは全節が常にDOMにあるため、以降の各節の内容は直接確認する(タブ切り替え不要)
  currentCheck = 'SETTINGS-TAB-01'
  // --- NGCOUNT-01(2026-07-17設定ゼロベース裁定#2): NG食材見出し行の件数常時表示。
  // 未登録は「未設定」(登録後の「◯件」表示はTOAST-01で確認する) ---
  currentCheck = 'NGCOUNT-01'
  check(
    'NGCOUNT-01 未登録は「未設定」表示',
    (await page.textContent('body')).includes('未設定'),
  )
  // --- ABOUT-01(2026-07-17設定ゼロベース裁定#3): 「このアプリについて」にバージョン+
  // データ件数(レシピ◯件・作った記録◯件)を表示する ---
  currentCheck = 'ABOUT-01'
  {
    const aboutText = await page.textContent('body')
    check('ABOUT-01 バージョン表示がある', /バージョン \S+/.test(aboutText))
    check(
      'ABOUT-01 データ件数表示(レシピ◯件・作った記録◯件)がある',
      /レシピ \d+[品件]（自分で登録 \d+\/\d+[品件]）・作った記録 \d+[品件]/.test(aboutText),
    )
    // 2026-08-08 便DZ: 未解錠のときは、レシピ一覧と同じ「自分で登録 ◯/30品」をここにも出す
    // (オーナー要望「利用者がどう確認できるか」。総件数には基本レシピが入るので別の数として並べる)
    check(
      'ABOUT-01(便DZ) 未解錠のデータ件数に「自分で登録 ◯/30品」が出る',
      /自分で登録 \d+\/30[品件]/.test(aboutText),
      `件数表示=${aboutText.match(/レシピ \d+件[^・]*・作った記録 \d+件/)?.[0]}`,
    )
  }
  // --- MOVEGUIDE-01(2026-07-17設定ゼロベース裁定#5): 機種変更・引っ越しガイド(折りたたみ)。
  // 既定は畳まれていて手順は見えず、タップで展開すると4ステップ+注意文が見えること。
  // 2026-07-30 便CJで手順を改訂: ①に「作った記録」の写真の扱い(C5)、②にファイルの受け渡し(C4)、
  // ④は「解錠コードを入れ直す」誤情報の撤去(C3。実際はファイルから自動で戻る) ---
  currentCheck = 'MOVEGUIDE-01'
  // 2026-08-20 便IJ: ここは**文言を書き写して**測っていたため、手順を「1行＋下の注記」に
  // 分けた時点で4件が落ちた（アプリは正常。禁じ手②）。文言は ja.ts から読む形に直し、
  // 「①の中にあるか」「地の文より弱くなっていないか」は**画面の作り**で測る。
  // 手順そのものの数（4つ）も決め打ちせず ja の並びから取る
  const moveGuideSteps = [
    ja.settings.moveGuideStep1,
    ja.settings.moveGuideStep2,
    ja.settings.moveGuideStep3,
    ja.settings.moveGuideStep4,
  ]
  check(
    'MOVEGUIDE-01 「機種変更するときは」の折りたたみ見出しが見える',
    stripZwspText(await page.textContent('body')).includes(ja.settings.moveGuideToggle),
  )
  check(
    'MOVEGUIDE-01 既定は畳まれていて手順は見えない',
    !(await page.textContent('body')).replaceAll('​', '').includes(ja.settings.moveGuideStep1),
  )
  await page.getByRole('button', { name: ja.settings.moveGuideToggle, exact: true }).click()
  await page.waitForTimeout(300)
  {
    const guideText = (await page.textContent('body')).replaceAll('​', '')
    const moveGuideMissing = moveGuideSteps.filter((step) => !guideText.includes(step))
    check(
      'MOVEGUIDE-01 展開すると4ステップが見える',
      moveGuideSteps.length === 4 &&
        moveGuideSteps.every((step) => typeof step === 'string' && step.length > 0) &&
        moveGuideMissing.length === 0,
      `画面に無い手順=${JSON.stringify(moveGuideMissing)}`,
    )
    // 便CJ/C5「写真だけ静かに失わせない」。**①の中にあること**と、**地の文より弱くないこと**を
    // 画面の作りで測る（2026-08-20 便IJ で手順本文から下の注記へ移したので、
    // 「文字が入っているか」だけでは静かになったかどうかが分からない）
    const moveGuidePhoto = await page.evaluate((noteText) => {
      const notes = Array.from(document.querySelectorAll('[data-testid="move-guide-step1-note"]'))
      const note = notes.find((el) => (el.textContent ?? '').replaceAll('​', '').includes(noteText))
      if (!note) return { found: false }
      // 手順の行（li）をたどる。入れ子の段数には依らず「いちばん近い li」を親とする
      const li = note.closest('li')
      const ol = li?.closest('ol')
      const stepIndex = ol && li ? Array.from(ol.children).indexOf(li) : -1
      const noteStyle = getComputedStyle(note)
      // 比べる相手は、その手順の地の文（li の直下のテキスト）の見た目
      const liStyle = li ? getComputedStyle(li) : null
      return {
        found: true,
        stepIndex,
        bold: Number(noteStyle.fontWeight) > Number(liStyle?.fontWeight ?? 400),
        colored: noteStyle.color !== liStyle?.color,
        visible: note.getBoundingClientRect().height > 0,
      }
    }, ja.settings.moveGuideStep1Note)
    check(
      'MOVEGUIDE-01 便CJ/C5: ①に「作った記録」の写真を含める操作の案内がある(写真だけ静かに失わせない)',
      moveGuidePhoto.found === true && moveGuidePhoto.stepIndex === 0 && moveGuidePhoto.visible === true,
      JSON.stringify(moveGuidePhoto),
    )
    check(
      // 手順本文から注記へ移したぶん、字は小さくなる。**太字か色つきのどちらか**で
      // 地の文より目立っていること＝静かにしない（どちらでもなければ本当に弱くなっている）
      'MOVEGUIDE-01 便CJ/C5: その案内が手順の地の文より弱くなっていない(太字か色つき)',
      moveGuidePhoto.found === true && (moveGuidePhoto.bold === true || moveGuidePhoto.colored === true),
      JSON.stringify(moveGuidePhoto),
    )
    check(
      'MOVEGUIDE-01 便CJ/C4: ファイルを新しい端末へ移す工程が独立したステップとして書かれている',
      guideText.includes(ja.settings.moveGuideStep2),
    )
    check(
      'MOVEGUIDE-01 便CJ/C3: 「解錠コードを入れ直す」という実装と矛盾した案内が無い',
      !guideText.includes('購入コードを入れ直す') && !guideText.includes('解錠コードを入れ直す（'),
    )
    check(
      // 上の「無いこと」だけだと、④ごと消えても合格に倒れる。**戻ることを言っている**側も見る
      'MOVEGUIDE-01 便CJ/C3: Pro版がファイルから一緒に戻ることは書いてある',
      guideText.includes(ja.settings.moveGuideStep4Note),
    )
    const moveGuideNotesMissing = ja.settings.moveGuideNotes.filter((n) => !guideText.includes(n))
    check(
      'MOVEGUIDE-01 注意文が見える',
      ja.settings.moveGuideNotes.length >= 2 && moveGuideNotesMissing.length === 0,
      `画面に無い注意=${JSON.stringify(moveGuideNotesMissing)}`,
    )
  }
  // 畳んで元に戻す(以降のチェックに影響しないように)
  await page.getByRole('button', { name: ja.settings.moveGuideToggle, exact: true }).click()
  await page.waitForTimeout(200)
  // 2026-08-27 便LS（オーナー指示）: バックアップの注意書きと詳しい説明のリンク、
  // 「アプリの更新」「困ったとき」の押すとき・消えるもの・残るものは折りたたみに入った。
  // **中身は1つも減らしていない**ので、開いてから今までどおり見る
  for (const lsToggle of [
    'backup-notice-toggle',
    'app-update-detail-toggle',
    'refresh-app-detail-toggle',
  ]) {
    const lsBtn = page.locator(`[data-testid="${lsToggle}"]`)
    check(`BACKUPCARDS-01(便LS) 折りたたみ「${lsToggle}」がある`, (await lsBtn.count()) === 1)
    if ((await lsBtn.count()) === 1) {
      await lsBtn.click()
      await page.waitForTimeout(400)
    }
  }

  currentCheck = 'BACKUPCARDS-01'
  // 修正5(2026-07-17バックアップ改修): バックアップタブが3カード
  // (①バックアップを取る/②バックアップを読み込む/③困ったとき)に再構成されたこと
  // (2026-08-02 オーナー指示で②の見出し・ボタン文言を短くした)
  check(
    'BACKUPCARDS-01 「バックアップを読み込む」の見出しが見える(カード②)',
    stripZwspText(await page.textContent('body')).includes(ja.settings.backupRestoreTitle),
  )
  check(
    'BACKUPCARDS-01 「今のデータに追加」「データを上書き」の両ボタンが同時に見える(並べて配置)',
    (await page.textContent('body')).includes('今のデータに追加') &&
      (await page.textContent('body')).includes('データを上書き'),
  )
  check(
    'BACKUPCARDS-01 修正1: バックアップに解錠コードが含まれる旨の注意文が見える(呼称は便CJ/C9で統一)',
    (await page.textContent('body')).includes('バックアップファイルにはPro版の解錠コードが含まれます'),
  )
  // REFRESH-APP-01: 「アプリの表示を修復する」ボタン(2026-07-16新設・2026-07-17修正4で文言全面改訂。
  // SWとキャッシュだけ消してリロードする安全機能)が③困ったときカードに存在し、消えるもの/残るものの
  // 説明があること。実際のSW解除・reloadはheadlessでの副作用が大きいため、ボタンとconfirm文言の
  // 存在確認までとし、クリックはしない(refreshApp()自体はscripts/test-logic.mjsのモックテストで検証済み)。
  check(
    'REFRESH-APP-01 「アプリの表示を修復する」ボタンが見える(2026-07-17文言変更)',
    stripZwspText(await page.textContent('body')).includes(ja.settings.refreshAppButton),
  )
  // 2026-08-22 便JJ: 文言はオーナー指示で書き換わる（「だけです」「はそのまま残ります」を外した）ので、
  // 書き写さずに ja.ts から読む（禁じ手②の文字列べた書きを避ける）
  check(
    'REFRESH-APP-01 説明文に「消えるもの」「残るもの」の内訳がある(修正4)',
    stripZwspText(await page.textContent('body')).includes(ja.settings.refreshAppWhatIsCleared) &&
      stripZwspText(await page.textContent('body')).includes(ja.settings.refreshAppWhatRemains),
  )
  {
    // 2026-08-20 便IJ: 153字の1文を3行に分けたので、文言を書き写した判定は落ちた（禁じ手②）。
    // ja.ts から読む形にし、**3行とも**画面に出ていることを見る（分けた拍子に1行落ちたら赤くなる）
    const refreshBody = (await page.textContent('body')).replaceAll('​', '')
    const refreshMissing = ja.settings.refreshAppCacheClearWarnings.filter(
      (line) => !refreshBody.includes(line),
    )
    check(
      'REFRESH-APP-01 ブラウザのキャッシュクリアに関する注意(「Cookieと他のサイトデータ」)がある(修正4)',
      ja.settings.refreshAppCacheClearWarnings.length >= 2 && refreshMissing.length === 0,
      `画面に無い行=${JSON.stringify(refreshMissing)}`,
    )
    // 2026-08-22 便JJ: この注意書きの置き場所は「バックアップを取る」カード。
    // 「困ったとき」(修復)の隣に置くと「修復するとCookieと他サイトのデータが消える」と読める、
    // というオーナー指摘への手当て。どこに出ていても通る判定にはせず、置き場所そのものを見る
    const jjWarnInBackup = await page
      .locator('#backup-section [data-testid="cache-clear-warnings"]')
      .count()
    check(
      'JJWARN-01 ブラウザのデータ削除の注意は「バックアップを取る」カードにある(修復の隣ではない)',
      jjWarnInBackup === 1,
      `#backup-section 内の件数=${jjWarnInBackup}`,
    )
  }
  check(
    'REFRESH-APP-01 上書きボタン(前回の場所に上書き)はFile System Access API非対応のheadless環境では出ない',
    !(await page.textContent('body')).includes('前回の場所に上書き'),
  )
  // ?section=直リンクの自動スクロール(1本スクロール化後: タブ切り替えではなく該当節へ自動スクロール)。
  // 自動スクロールはSettingsPageの1マウントにつき一度だけ動く(scrolledToSectionRefのワンショット)ため、
  // 各?section=の検証の前に一度/recipesへ抜けてSettingsPageを再マウントさせ、毎回まっさらな状態で
  // 発火することを独立に確認する。unlock.html・NutritionTeaser等の既存導線が使う互換パラメータ
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  // ?section=recipe は「レシピ」節へ自動スクロールする(テーマ全廃で ?section=themes は廃止したが、
  // 旧リンク互換として themes も recipe 節へ読み替えて着地させる=sectionDeepLinksのthemes→section-recipe)
  await page.goto(`${BASE}/#/settings?section=recipe`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  {
    const recipeSecTop = await settingsSectionTop('section-recipe')
    check(
      'SETTINGS-TAB-01 ?section=recipeはレシピ節へ自動スクロールする(見出しがDOMにあり上端付近)',
      stripZwspText(await page.textContent('body')).includes(ja.settings.recipeSetTitle) &&
        recipeSecTop !== null &&
        recipeSecTop >= -5 &&
        recipeSecTop < 220,
      `recipeSecTop=${recipeSecTop}`,
    )
  }
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  {
    const proSecTop = await settingsSectionTop('pro-section')
    const proSecAtBottom = await page.evaluate(
      () => window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 8,
    )
    check(
      'SETTINGS-TAB-01 ?section=proはPro節へ自動スクロールする(Pro版の見出しがDOMにあり上端付近か最下部)',
      (await page.textContent('body')).includes('Pro版') &&
        proSecTop !== null &&
        (proSecTop < 220 || proSecAtBottom),
      `proSecTop=${proSecTop} atBottom=${proSecAtBottom}`,
    )
  }
  check(
    'SETTINGS-TAB-01 1本スクロールなので?section=proでも個人設定節(NG食材)は同じページに存在する',
    stripZwspText(await page.textContent('body')).includes(ja.settings.ngTitle),
  )

