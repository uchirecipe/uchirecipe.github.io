// ==========================================================================================
// e2e の節: 便JJ〜JQ（写真・離脱の確認・月の編集モード・手間）
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
// この中の節: JJSET-01, JJFORM-02, JKPHOTO-01, JKPHOTO-02, JKPHOTO-03, JOSELECT-01, JOLEAVE-02, JOCOST-03, JOTIMER-04, JNVIEW-01, JNEDIT-02, JNLOCK-03, JNPAST-04, JPCARD-01, JPGAP-02, JPEFFORT-03, JQBOX-01, JQBOX-02, JQSAME-03, JQTHEME-04
// ==========================================================================================
import './_shared.mjs'


  // --- JJSET-01 / JJFORM-02(2026-08-22 便JJ): オーナーの書き溜めで直した画面まわり ---
  //
  // 測るのは「利用者が確かめたいこと」:
  //   JJSET-01 設定 … ①「古い記録の書き出し（アーカイブ）」が畳んであり、押すと開いて中身が出る
  //                    ②ブラウザのデータ削除の注意が「困ったとき」ではなくバックアップの欄にある
  //                    ③「困ったとき」の消えるもの／残るもの／更新との使い分けが直した文で出る
  //   JJFORM-02 レシピの編集 … 「くわしく」の区画の名前と、季節・時間帯・検索キーワードの説明。
  //                    「優先されます」と書いていないこと（実装は候補から外す側）
  // 禁じ手よけ: 文言は ja.ts から読む（書き写さない）／要素はどこにあっても掴める data-testid と
  //             見出しの名前で掴む／曜日・月替わりに依らない
  currentCheck = 'JJSET-01'
  {
    const jjBrowser = await chromium.launch()
    try {
      const jjContext = await jjBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jjPage = await jjContext.newPage()
      jjPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JJ] ${err.message}`)
      })
      await jjPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jjPage.waitForTimeout(1800)
      await jjPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await jjPage.waitForTimeout(1200)

      const jjToggle = jjPage.locator('[data-testid="archive-toggle"]')
      check('JJSET-01 「古い記録の書き出し（アーカイブ）」の開閉ボタンがある', (await jjToggle.count()) === 1)
      check(
        'JJSET-01 見出しに「アーカイブ」が入っている（ファイル名と説明の呼び名に画面がつながる）',
        (await jjToggle.first().innerText()).replaceAll('​', '').includes('アーカイブ'),
        (await jjToggle.first().innerText()).replaceAll('​', ''),
      )
      check(
        'JJSET-01 既定では畳んである（たまにしか触らない機能なので開いて待たない）',
        (await jjToggle.first().getAttribute('aria-expanded')) === 'false' &&
          (await jjPage.locator('[data-testid="archive-file-facts"]').count()) === 0,
      )
      await jjToggle.first().click()
      await jjPage.waitForTimeout(700)
      const jjArchiveText = (await jjPage.locator('#archive-section').innerText()).replaceAll('​', '')
      check(
        'JJSET-01 押すと開いて、説明とアーカイブファイルの読みかたが出る',
        (await jjToggle.first().getAttribute('aria-expanded')) === 'true' &&
          (await jjPage.locator('[data-testid="archive-file-facts"]').count()) === 1 &&
          jjArchiveText.includes(ja.settings.archiveDescription.replaceAll('​', '')),
        jjArchiveText.slice(0, 80),
      )
      await jjToggle.first().click()
      await jjPage.waitForTimeout(700)
      check(
        'JJSET-01 もう一度押すと畳める',
        (await jjPage.locator('[data-testid="archive-file-facts"]').count()) === 0,
      )

      // ②ブラウザのデータ削除の注意の置き場所（オーナー原文「ここに注意書きがあると、
      //   修復＝クッキーと他サイトのデータを削除、捉えられます」）
      const jjWarnBackup = await jjPage.locator('#backup-section [data-testid="cache-clear-warnings"]').count()
      const jjWarnAll = await jjPage.locator('[data-testid="cache-clear-warnings"]').count()
      check(
        'JJSET-01 ブラウザのデータ削除の注意は「バックアップを取る」カードの中にだけある',
        jjWarnBackup === 1 && jjWarnAll === 1,
        `バックアップの中=${jjWarnBackup} 画面全体=${jjWarnAll}`,
      )
      const jjRefreshBtn = jjPage.getByRole('button', { name: ja.settings.refreshAppButton })
      check('JJSET-01 前提: 「アプリの表示を修復する」は今までどおりある', (await jjRefreshBtn.count()) >= 1)

      // ③「困ったとき」の3行（文言は ja から読む）
      const jjBody = (await jjPage.textContent('body')).replaceAll('​', '')
      check(
        'JJSET-01 「消えるもの」は言い切らない書き方で出ている',
        jjBody.includes(ja.settings.refreshAppWhatIsCleared) &&
          !/画面の一時ファイルだけです/.test(jjBody),
      )
      check(
        'JJSET-01 「残るもの」は「画面の一時ファイル以外のすべてのデータ」で出ている',
        jjBody.includes(ja.settings.refreshAppWhatRemains) &&
          ja.settings.refreshAppWhatRemains.includes('画面の一時ファイル以外'),
      )
      check(
        'JJSET-01 更新との使い分けは「お使いください」で終わる',
        jjBody.includes(ja.settings.refreshAppVsUpdateNote) &&
          ja.settings.refreshAppVsUpdateNote.endsWith('をお使いください'),
      )

      // --- JJFORM-02: レシピの編集「くわしく」 ---
      currentCheck = 'JJFORM-02'
      await jjPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await jjPage.waitForTimeout(1200)
      const jjDetailTab = jjPage.getByRole('tab', { name: ja.form.formTabDetail, exact: true })
      check('JJFORM-02 前提: 「くわしく」タブを開ける', (await jjDetailTab.count()) >= 1)
      if ((await jjDetailTab.count()) >= 1) {
        await jjDetailTab.first().click()
        await jjPage.waitForTimeout(800)
      }
      const jjForm = (await jjPage.textContent('body')).replaceAll('​', '')
      check(
        'JJFORM-02 区画の見出しが「献立提案・検索に必要な設定」になっている',
        jjForm.includes(ja.form.detailSectionPlanning) && !jjForm.includes('献立・検索に使う'),
      )
      check(
        'JJFORM-02 季節の説明に「優先」と書いていない（実装は候補から外す側）',
        jjForm.includes(ja.form.seasonDescription) && !/優先/.test(ja.form.seasonDescription),
      )
      check(
        'JJFORM-02 時間帯の説明に「優先」と書いていない',
        jjForm.includes(ja.form.suitableForDescription) && !/優先/.test(ja.form.suitableForDescription),
      )
      check(
        'JJFORM-02 検索キーワードの説明から「検索したときだけ効きます」が消えている',
        jjForm.includes(ja.form.keywordsDescription) && !/検索したときだけ効きます/.test(jjForm),
      )
    } finally {
      await jjBrowser.close()
    }
  }


  // ==========================================================================================
  // JKPHOTO-01〜03: 写真の見える範囲（2026-08-22 便JK）
  //
  // オーナー原文（最初の指摘）:
  //   「画像の中心がずれている。設定からも直せない。一覧よりも詳細画面が気になりやすいが、
  //     一覧もよくみたらちゃんとずれてる。」
  // それを踏まえた返答（これが作るものの指示）:
  //   「画像の中心ズレについて、画像のサイズの真ん中ではなく、画像の中で被写体が真ん中に
  //     写っていない、ということです。これは自動ではどうにもできない部分だと思うので、
  //     ゆーざーが見える範囲を微調整（トリミングっぽい感じ）できたら嬉しい、ということです。」
  //
  // 測ること:
  //   JKPHOTO-01 … 写真の無いレシピには入口を出さない／写真を入れると詳細の写真の中に入口が出る／
  //                 指で押せる大きさ（44px）／なぞって決めると詳細の写真の切り取り位置が変わる／
  //                 **料理名の位置が1pxも動かない**（オーナー指示）／端末に値が残る
  //   JKPHOTO-02 … **同じ1つの値がレシピ一覧のカードにも効く**（同じ写真を2回調整させない）／
  //                 「中央に戻す」で値ごと消える／**写真を入れ替えたら中央に戻る**
  //   JKPHOTO-03 … 書き出したファイルに値が入り、読み込み先でも同じ値で戻る
  //
  // 画面は390×844（オーナーの実機幅）で測る。
  // ==========================================================================================
  currentCheck = 'JKPHOTO-01'
  {
    const jkPortrait = makeTestPng(240, 420) // 縦写真: 詳細（16:9）で上下が大きく落ちる
    const jkLandscape = makeTestPng(420, 240) // 横写真: レシピ一覧のマス（1:1）で左右が大きく落ちる
    const jkBrowser = await chromium.launch()
    let jkExportedJson = ''
    try {
      const jkContext = await jkBrowser.newContext({
        viewport: { width: 390, height: 844 },
        acceptDownloads: true,
      })
      const jkPage = await jkContext.newPage()
      jkPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JKPHOTO] ${err.message}`)
      })
      jkPage.on('dialog', (dialog) => dialog.accept())

      await jkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(1800) // 初回シード完了待ち
      await jkPage.getByText('肉じゃが', { exact: true }).first().click()
      await jkPage.waitForTimeout(600)
      const jkRecipeId = Number(jkPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      check('JKPHOTO-01 前提: 調整するレシピのidを取得できた', Number.isInteger(jkRecipeId), `id=${jkRecipeId}`)

      // ① 写真の無いレシピでは、入口を1つも出さない（代わり絵には調整するものが無い）
      check(
        'JKPHOTO-01 写真の無いレシピには見える範囲の入口を出さない',
        (await jkPage.locator('[data-testid="photo-focus-open"]').count()) === 0,
      )

      // ② 編集画面から写真を入れる。写真を入れた時点で編集画面にも入口が出る
      await jkPage.goto(`${BASE}/#/recipes/${jkRecipeId}/edit`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(700)
      check(
        'JKPHOTO-01 写真を入れる前は編集画面にも入口を出さない',
        (await jkPage.locator('[data-testid="photo-focus-open-form"]').count()) === 0,
      )
      await jkPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'jk-portrait.png', mimeType: 'image/png', buffer: jkPortrait })
      await jkPage.waitForTimeout(700)
      check(
        'JKPHOTO-01 写真を入れると編集画面に見える範囲の入口が出る',
        await jkPage.locator('[data-testid="photo-focus-open-form"]').isVisible(),
      )
      // 編集画面の入口も、詳細と同じ窓を開いて同じように決められる（開く→やめる→開き直す まで見る）
      await jkPage.locator('[data-testid="photo-focus-open-form"]').click()
      await jkPage.waitForTimeout(400)
      check(
        'JKPHOTO-01 編集画面の入口からも同じ窓が開く',
        await jkPage.locator('[data-testid="photo-focus-modal"]').isVisible(),
      )
      await jkPage.getByRole('button', { name: ja.common.confirmCancel, exact: true }).click()
      await jkPage.waitForTimeout(400)
      check(
        'JKPHOTO-01 「やめる」で窓が閉じ、編集画面はそのまま残る',
        (await jkPage.locator('[data-testid="photo-focus-modal"]').count()) === 0 &&
          (await jkPage.locator('[data-testid="photo-focus-open-form"]').isVisible()),
      )
      await jkPage.getByRole('button', { name: '保存する' }).click()
      await jkPage.waitForTimeout(900)

      // ③ 詳細画面の入口。写真の中に重なっているので、下に並ぶ料理名の位置は動かない
      const jkOpen = jkPage.locator('[data-testid="photo-focus-open"]')
      check('JKPHOTO-01 写真のあるレシピの詳細に見える範囲の入口が出る', await jkOpen.isVisible())
      const jkOpenBox = await jkOpen.boundingBox()
      check(
        'JKPHOTO-01 入口は指で押せる大きさ（44px以上）',
        jkOpenBox != null && jkOpenBox.width >= 44 && jkOpenBox.height >= 44,
        `box=${JSON.stringify(jkOpenBox)}`,
      )
      const jkTitleBefore = await jkPage.locator('h1').first().boundingBox()
      const jkHeroPosBefore = await jkPage.evaluate(() => {
        const img = document.querySelector('img.aspect-video')
        return img ? getComputedStyle(img).objectPosition : null
      })

      // ④ 窓を開いて、写真の中の見せたい場所をなぞって決める
      await jkOpen.click()
      await jkPage.waitForTimeout(400)
      check(
        'JKPHOTO-01 入口を押すと見える範囲の窓が開く',
        await jkPage.locator('[data-testid="photo-focus-modal"]').isVisible(),
      )
      const jkPicker = jkPage.locator('[data-testid="photo-focus-picker"] img')
      const jkPickerBox = await jkPicker.boundingBox()
      check(
        'JKPHOTO-01 なぞる面が指で扱える大きさ（44px以上）',
        jkPickerBox != null && jkPickerBox.width >= 44 && jkPickerBox.height >= 44,
        `box=${JSON.stringify(jkPickerBox)}`,
      )
      // 押した場所がそのまま「見せたい場所」になる。押してから引きずって細かく詰める
      await jkPage.mouse.move(
        jkPickerBox.x + jkPickerBox.width * 0.2,
        jkPickerBox.y + jkPickerBox.height * 0.8,
      )
      await jkPage.mouse.down()
      await jkPage.mouse.move(
        jkPickerBox.x + jkPickerBox.width * 0.3,
        jkPickerBox.y + jkPickerBox.height * 0.2,
        { steps: 8 },
      )
      await jkPage.mouse.up()
      await jkPage.waitForTimeout(300)
      const jkPreviewPos = await jkPage.evaluate(() => {
        const detail = document.querySelector('[data-testid="photo-focus-preview-detail"]')
        const list = document.querySelector('[data-testid="photo-focus-preview-list"]')
        return {
          detail: detail ? getComputedStyle(detail).objectPosition : null,
          list: list ? getComputedStyle(list).objectPosition : null,
        }
      })
      check(
        'JKPHOTO-01 なぞると出来上がりの見本（詳細・一覧）が同じ値で動く',
        jkPreviewPos.detail != null && jkPreviewPos.detail === jkPreviewPos.list && jkPreviewPos.detail !== jkHeroPosBefore,
        `見本=${JSON.stringify(jkPreviewPos)} 直す前=${jkHeroPosBefore}`,
      )

      await jkPage.locator('[data-testid="photo-focus-apply"]').click()
      await jkPage.waitForTimeout(600)
      check(
        'JKPHOTO-01 決めると窓が閉じる',
        (await jkPage.locator('[data-testid="photo-focus-modal"]').count()) === 0,
      )
      const jkHeroPosAfter = await jkPage.evaluate(() => {
        const img = document.querySelector('img.aspect-video')
        return img ? getComputedStyle(img).objectPosition : null
      })
      check(
        'JKPHOTO-01 詳細の写真の切り取り位置が実際に変わる',
        jkHeroPosAfter != null && jkHeroPosAfter !== jkHeroPosBefore,
        `直す前=${jkHeroPosBefore} 直した後=${jkHeroPosAfter}`,
      )

      // ⑤ 料理名の位置は1pxも動かない（入口を足しても、いまの並びを崩さない）
      const jkTitleAfter = await jkPage.locator('h1').first().boundingBox()
      check(
        'JKPHOTO-01 調整の前後で料理名の位置が動かない',
        jkTitleBefore != null &&
          jkTitleAfter != null &&
          Math.abs(jkTitleBefore.x - jkTitleAfter.x) < 0.5 &&
          Math.abs(jkTitleBefore.y - jkTitleAfter.y) < 0.5,
        `前=${JSON.stringify(jkTitleBefore)} 後=${JSON.stringify(jkTitleAfter)}`,
      )

      // ⑥ 端末に値が残る（レシピごと・写真そのものは書き換えない）
      const readFocus = (targetPage, id) =>
        targetPage.evaluate(
          (recipeId) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const getReq = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
                getReq.onsuccess = () => {
                  const recipe = getReq.result
                  resolve({
                    focus: recipe?.photoFocus ?? null,
                    photoSize: recipe?.photo?.size ?? 0,
                    title: recipe?.title ?? null,
                  })
                }
                getReq.onerror = () => reject(getReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
          id,
        )
      const jkSaved = await readFocus(jkPage, jkRecipeId)
      check(
        'JKPHOTO-01 決めた見える範囲がレシピに保存される（0〜100の割合2つ）',
        jkSaved.focus != null &&
          Math.abs(jkSaved.focus.x - 30) <= 3 &&
          Math.abs(jkSaved.focus.y - 20) <= 3,
        `saved=${JSON.stringify(jkSaved.focus)}`,
      )
      check(
        'JKPHOTO-01 写真そのものは残っている（見せ方だけを覚えている）',
        jkSaved.photoSize > 0,
        `photoSize=${jkSaved.photoSize}`,
      )

      // ---- JKPHOTO-02: 同じ値がレシピ一覧にも効く / 中央に戻せる / 写真を入れ替えたら中央 ----
      currentCheck = 'JKPHOTO-02'
      await jkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(900)
      const jkCardPos = await jkPage.evaluate((recipeId) => {
        const link = document.querySelector(`a[href="#/recipes/${recipeId}"]`)
        const img = link?.querySelector('img')
        return img ? getComputedStyle(img).objectPosition : null
      }, jkRecipeId)
      check(
        'JKPHOTO-02 レシピ一覧のカードにも詳細と同じ1つの値が効く',
        jkCardPos != null && jkCardPos === jkHeroPosAfter,
        `一覧=${jkCardPos} 詳細=${jkHeroPosAfter}`,
      )

      // 「中央に戻す」→ 値ごと消える（未設定＝いままでどおり中央に戻せる）
      await jkPage.goto(`${BASE}/#/recipes/${jkRecipeId}`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(700)
      await jkPage.locator('[data-testid="photo-focus-open"]').click()
      await jkPage.waitForTimeout(400)
      await jkPage.locator('[data-testid="photo-focus-reset"]').click()
      await jkPage.waitForTimeout(200)
      check(
        'JKPHOTO-02 中央に戻したあとは「中央に戻す」がもう押せない（すでに中央だから）',
        await jkPage.locator('[data-testid="photo-focus-reset"]').isDisabled(),
      )
      await jkPage.locator('[data-testid="photo-focus-apply"]').click()
      await jkPage.waitForTimeout(600)
      const jkReset = await readFocus(jkPage, jkRecipeId)
      check(
        'JKPHOTO-02 中央に戻すと値ごと消える（未設定＝中央に戻る）',
        jkReset.focus == null,
        `saved=${JSON.stringify(jkReset.focus)}`,
      )
      const jkHeroPosReset = await jkPage.evaluate(() => {
        const img = document.querySelector('img.aspect-video')
        return img ? getComputedStyle(img).objectPosition : null
      })
      check(
        'JKPHOTO-02 中央に戻すと切り取り位置も最初と同じに戻る',
        jkHeroPosReset === jkHeroPosBefore,
        `最初=${jkHeroPosBefore} 戻したあと=${jkHeroPosReset}`,
      )

      // もう一度調整してから、写真を別のものに入れ替える → 中央に戻る
      await jkPage.locator('[data-testid="photo-focus-open"]').click()
      await jkPage.waitForTimeout(400)
      const jkPicker2 = await jkPage.locator('[data-testid="photo-focus-picker"] img').boundingBox()
      await jkPage.mouse.click(
        jkPicker2.x + jkPicker2.width * 0.5,
        jkPicker2.y + jkPicker2.height * 0.1,
      )
      await jkPage.waitForTimeout(200)
      await jkPage.locator('[data-testid="photo-focus-apply"]').click()
      await jkPage.waitForTimeout(600)
      check(
        'JKPHOTO-02 前提: 入れ替える前に見える範囲が入っている',
        (await readFocus(jkPage, jkRecipeId)).focus != null,
      )
      await jkPage.goto(`${BASE}/#/recipes/${jkRecipeId}/edit`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(700)
      await jkPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'jk-landscape.png', mimeType: 'image/png', buffer: jkLandscape })
      await jkPage.waitForTimeout(700)
      await jkPage.getByRole('button', { name: '保存する' }).click()
      await jkPage.waitForTimeout(900)
      check(
        'JKPHOTO-02 写真を入れ替えたら見える範囲は中央に戻る（前の写真の位置を当てない）',
        (await readFocus(jkPage, jkRecipeId)).focus == null,
        `saved=${JSON.stringify((await readFocus(jkPage, jkRecipeId)).focus)}`,
      )

      // ---- JKPHOTO-03: 書き出し／読み込みで値が失われない ----
      currentCheck = 'JKPHOTO-03'
      await jkPage.goto(`${BASE}/#/recipes/${jkRecipeId}`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(700)
      await jkPage.locator('[data-testid="photo-focus-open"]').click()
      await jkPage.waitForTimeout(400)
      const jkPicker3 = await jkPage.locator('[data-testid="photo-focus-picker"] img').boundingBox()
      await jkPage.mouse.click(
        jkPicker3.x + jkPicker3.width * 0.8,
        jkPicker3.y + jkPicker3.height * 0.6,
      )
      await jkPage.waitForTimeout(200)
      await jkPage.locator('[data-testid="photo-focus-apply"]').click()
      await jkPage.waitForTimeout(600)
      const jkBeforeExport = await readFocus(jkPage, jkRecipeId)
      check(
        'JKPHOTO-03 前提: 書き出す前に見える範囲が入っている',
        jkBeforeExport.focus != null,
        `saved=${JSON.stringify(jkBeforeExport.focus)}`,
      )

      await jkPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await jkPage.waitForTimeout(500)
      await jkPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await jkPage.waitForTimeout(300)
      const [jkDownload] = await Promise.all([
        jkPage.waitForEvent('download'),
        jkPage.getByRole('button', { name: 'ファイルに書き出す' }).click(),
      ])
      jkExportedJson = readFileSync(await jkDownload.path(), 'utf-8')
      const jkExported = JSON.parse(jkExportedJson)
      const jkExportedRecipe = (jkExported.recipes ?? []).find((r) => r.title === jkBeforeExport.title)
      check(
        'JKPHOTO-03 書き出したファイルに見える範囲が入っている',
        JSON.stringify(jkExportedRecipe?.photoFocus) === JSON.stringify(jkBeforeExport.focus),
        `ファイル=${JSON.stringify(jkExportedRecipe?.photoFocus)} 端末=${JSON.stringify(jkBeforeExport.focus)}`,
      )
      // 調整していないレシピには値が付かない（既存のレシピの書き出しの中身は変わらない）
      const jkUntouched = (jkExported.recipes ?? []).filter((r) => r.title !== jkBeforeExport.title)
      check(
        'JKPHOTO-03 調整していないレシピには見える範囲の項目が付かない',
        jkUntouched.length > 0 && jkUntouched.every((r) => r.photoFocus === undefined),
        `付いてしまった品=${JSON.stringify(jkUntouched.filter((r) => r.photoFocus !== undefined).map((r) => r.title))}`,
      )

      // まっさらな別の端末へ読み込んで、同じ値で戻ることを確かめる
      const jkDstContext = await jkBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jkDstPage = await jkDstContext.newPage()
      jkDstPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JKPHOTO-03(読み込み先)] ${err.message}`)
      })
      jkDstPage.on('dialog', (dialog) => dialog.accept())
      await jkDstPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jkDstPage.waitForTimeout(1800)
      await jkDstPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await jkDstPage.waitForTimeout(500)
      await jkDstPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await jkDstPage.waitForTimeout(300)
      const jkChooser = await clickReplaceImport(jkDstPage)
      await jkChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(jkExportedJson, 'utf-8'),
      })
      await jkDstPage.waitForTimeout(1200)
      const jkRestored = await jkDstPage.evaluate(
        (title) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const all = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              all.onsuccess = () => {
                const hit = all.result.find((r) => r.title === title)
                resolve({ focus: hit?.photoFocus ?? null, photoSize: hit?.photo?.size ?? 0 })
              }
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
        jkBeforeExport.title,
      )
      check(
        'JKPHOTO-03 読み込み先でも同じ見える範囲で戻る',
        JSON.stringify(jkRestored.focus) === JSON.stringify(jkBeforeExport.focus),
        `読み込み先=${JSON.stringify(jkRestored.focus)} 書き出し元=${JSON.stringify(jkBeforeExport.focus)}`,
      )
      check(
        'JKPHOTO-03 読み込み先でも写真そのものが戻っている',
        jkRestored.photoSize > 0,
        `photoSize=${jkRestored.photoSize}`,
      )
    } finally {
      await jkBrowser.close()
    }
  }


  // ==========================================================================================
  // JOSELECT-01（2026-08-23 便JO）: 材料の「選んで削除」は、枠のどこを押しても選べる
  //
  // オーナー原文:
  //   「「選んで削除」で食材の☑️を押さないと選択できない。削除する項目を選ぶだけなら、
  //     枠のどこを触っても選択できるからいいのでは？触れる場所が狭すぎる。」
  //
  // 直す前の実測（390×844）: 触れるのは丸いチェックだけで 40×40px、材料1件の枠は 358×162px。
  // **枠の面積の 2.8% しか触れなかった**。材料名の欄・メモの欄・枠の余白を押しても選べない。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①「選んで削除」の最中は、枠の**どこを押しても**その材料を選べる（代表の5点で見る）
  //   ②同じ場所をもう一度押せば外せる（選ぶのと同じ手で戻せる）
  //   ③「選んで削除」でないときは、材料名の欄を押しても選択にならず、今までどおり書ける
  //     （選ぶために普段の編集を壊していないこと）
  // 禁じ手よけ: 料理名で掴まない（端末に入っている1件目のidを使う）／文言は ja.ts から読む／
  //   押す回数・件数を決め打ちしない／page.evaluate の中に ja.*** を書かない（引数で渡す）
  // ==========================================================================================
  currentCheck = 'JOSELECT-01'
  {
    const joBrowser = await chromium.launch()
    try {
      const joContext = await joBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const joPage = await joContext.newPage()
      joPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JOSELECT-01] ${err.message}`)
      })
      await joPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await joPage.waitForTimeout(2400) // 初回シード完了待ち
      const joId = await joPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const keys = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAllKeys()
              keys.onsuccess = () => resolve(keys.result[0] ?? null)
              keys.onerror = () => reject(keys.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('JOSELECT-01 前提: 材料を触るレシピのidを取れた', Number.isInteger(joId), `id=${joId}`)
      await joPage.goto(`${BASE}/#/recipes/${joId}/edit`, { waitUntil: 'networkidle' })
      await joPage.reload({ waitUntil: 'networkidle' })
      await joPage.waitForTimeout(1400)

      // ③普段（選ぶモードでない）は、材料名の欄が今までどおり書ける
      const joName = joPage.getByLabel(ja.form.ingredientName).first()
      check('JOSELECT-01 前提: 材料名の欄を掴めた', (await joName.count()) === 1)
      await joName.fill('検査用の材料名')
      await joPage.waitForTimeout(200)
      check(
        'JOSELECT-01 「選んで削除」でないときは、材料名の欄に今までどおり書ける',
        (await joName.inputValue()) === '検査用の材料名',
        `欄の中身=${await joName.inputValue()}`,
      )

      const joOrganize = joPage.getByRole('button', {
        name: ja.form.ingredientOrganizeToggle,
        exact: true,
      })
      check('JOSELECT-01 前提: 「選んで削除」を掴めた', (await joOrganize.count()) === 1)
      await joOrganize.first().click()
      await joPage.waitForTimeout(400)

      /** 1件目の材料の枠と、その枠の選択状態を読む（枠は data-testid、状態は aria-pressed） */
      const joRead = () =>
        joPage.evaluate((label) => {
          const row = document.querySelector('[data-testid="ingredient-row"]')
          if (!row) return null
          const btn = [...row.querySelectorAll('button')].find(
            (el) => el.getAttribute('aria-label') === label,
          )
          const r = row.getBoundingClientRect()
          return {
            x: r.x,
            y: r.y,
            w: Math.round(r.width),
            h: Math.round(r.height),
            pressed: btn ? btn.getAttribute('aria-pressed') === 'true' : null,
          }
        }, ja.form.ingredientOrganizeSelectRow)

      // 材料1件目を画面の真ん中へ持ってくる（下の並び＝タブの帯に重なった場所を押すと、
      // タブを押したことになって画面ごと移ってしまう。実測: 帯に隠れる位置に枠があった）
      await joPage.evaluate(() => {
        document
          .querySelector('[data-testid="ingredient-row"]')
          ?.scrollIntoView({ block: 'center' })
      })
      await joPage.waitForTimeout(400)

      const joBefore = await joRead()
      check(
        'JOSELECT-01 前提: 材料1件の枠と選択状態を読めた（選ぶモードに入っている）',
        joBefore !== null && joBefore.pressed === false && joBefore.w > 0 && joBefore.h > 0,
        JSON.stringify(joBefore),
      )

      // ①②枠の代表の5点。どこを押しても「選ぶ⇄外す」が入れ替わる。
      //   点は枠の割合で決める＝枠の高さ・欄の並びが変わっても同じ意味の場所を指す
      const joSpots = [
        ['左上（材料名の欄）', 0.2, 0.12],
        ['右上（単位の欄）', 0.85, 0.12],
        ['真ん中（欄と欄のあいだ）', 0.5, 0.5],
        ['左下（メモの欄）', 0.3, 0.9],
        ['右下（枠の余白）', 0.95, 0.9],
      ]
      for (const [joSpotName, joRx, joRy] of joSpots) {
        const joBox = await joRead()
        if (!joBox) {
          check(`JOSELECT-01 ${joSpotName}を押すとその材料を選べる`, false, '枠を読めなかった')
          continue
        }
        const joWas = joBox.pressed
        await joPage.mouse.click(joBox.x + joBox.w * joRx, joBox.y + joBox.h * joRy)
        await joPage.waitForTimeout(250)
        const joAfter = await joRead()
        check(
          `JOSELECT-01 ${joSpotName}を押すと、その材料の選択が入れ替わる（直す前は丸いチェック 40×40px だけ）`,
          joAfter !== null && joAfter.pressed === !joWas,
          `押す前=${joWas} 押した後=${joAfter ? joAfter.pressed : 'null'}`,
        )
      }

      // ③選ぶモードを抜けたら、材料名の欄はまた書ける（モードのあいだだけ止めている）
      await joPage
        .getByRole('button', { name: ja.form.ingredientOrganizeDone, exact: true })
        .first()
        .click()
      await joPage.waitForTimeout(400)
      await joPage.getByLabel(ja.form.ingredientName).first().fill('戻したあとの材料名')
      await joPage.waitForTimeout(200)
      check(
        'JOSELECT-01 「完了」で選ぶモードを抜けたら、材料名の欄にまた書ける',
        (await joPage.getByLabel(ja.form.ingredientName).first().inputValue()) ===
          '戻したあとの材料名',
      )
    } finally {
      await joBrowser.close()
    }
  }

  // ==========================================================================================
  // JOLEAVE-02（2026-08-23 便JO）: 保存せずにレシピ編集を離れようとしたら知らせる
  //
  // オーナー原文:
  //   「編集終わりのつもりでそのまま保存をせずにページを離れそう。一時保存はされるが、
  //     反映されていないことに気づきにくい。」
  //
  // 直す前の実測: 料理名を書き換えたあと上の「戻る」を押すと、何も出ないまま
  // レシピ詳細（#/recipes/1）へ移り、見出しは元の料理名のまま＝編集が反映されていない。
  // 下の並びの「献立」でも同じく黙って離れていた。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①書きかけがあるとき、上の「戻る」で離れようとすると知らせが出る
  //   ②その知らせが「反映されない」ことと「書きかけは残る」ことの両方を言っている（規約F）
  //   ③「編集を続ける」を選べば離れない（編集の画面のまま）
  //   ④「保存せずに離れる」を選べば離れる。そのときレシピは書き換わっていない
  //   ⑤開き直すと書きかけを戻す案内が出る（言ったとおり端末に残っている）
  //   ⑥下の並びのタブで離れようとしても同じ知らせが出る
  //   ⑦何も書き換えていなければ、知らせは出ずにそのまま離れられる（普段の邪魔をしない）
  // 禁じ手よけ: 文言は ja.ts から読む／料理名で掴まない／ゼロ幅スペースを外してから照合する
  // ==========================================================================================
  currentCheck = 'JOLEAVE-02'
  {
    const jolBrowser = await chromium.launch()
    try {
      const jolContext = await jolBrowser.newContext({ viewport: { width: 390, height: 844 } })
      // 確認の窓は自分で押す（この節は「窓が出るか・どちらを押すと何が起きるか」そのものを測る）
      await jolContext.addInitScript(() => {
        try {
          localStorage.setItem('e2e:confirmAuto', 'off')
        } catch {
          /* 何もしない */
        }
      })
      const jolPage = await jolContext.newPage()
      jolPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JOLEAVE-02] ${err.message}`)
      })
      await jolPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jolPage.waitForTimeout(2400)
      const jolId = await jolPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const keys = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAllKeys()
              keys.onsuccess = () => resolve(keys.result[0] ?? null)
              keys.onerror = () => reject(keys.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('JOLEAVE-02 前提: 編集するレシピのidを取れた', Number.isInteger(jolId), `id=${jolId}`)

      const jolOpenEdit = async () => {
        await jolPage.goto(`${BASE}/#/recipes/${jolId}/edit`, { waitUntil: 'networkidle' })
        await jolPage.reload({ waitUntil: 'networkidle' })
        await jolPage.waitForTimeout(1400)
      }
      await jolOpenEdit()
      const jolTitleField = jolPage.getByLabel(ja.form.nameLabel).first()
      check('JOLEAVE-02 前提: 料理名の欄を掴めた', (await jolTitleField.count()) === 1)
      const jolOriginalTitle = stripZwspText(await jolTitleField.inputValue())
      const jolNewTitle = `${jolOriginalTitle}・書きかえ`
      await jolTitleField.fill(jolNewTitle)
      await jolPage.waitForTimeout(500)

      // ①上の「戻る」で離れようとすると知らせが出る
      const jolBack = jolPage.getByRole('button', { name: ja.common.back, exact: true }).first()
      await jolBack.click()
      await jolPage.waitForTimeout(600)
      const jolDialog = jolPage.locator('[data-testid="confirm"]')
      check(
        'JOLEAVE-02 書きかけがあるとき、上の「戻る」で離れようとすると知らせが出る',
        (await jolDialog.count()) === 1,
        `窓の数=${await jolDialog.count()} URL=${jolPage.url()}`,
      )
      // ②何が起きないか・何が残るかを両方言っている（規約F）
      const jolBody = stripZwspText(await jolDialog.first().textContent().catch(() => ''))
      check(
        'JOLEAVE-02 知らせが「レシピに反映されないこと」と「書きかけが残ること」を言っている',
        jolBody.includes(stripZwspText(ja.form.leaveUnsaved)),
        `窓の文=${jolBody.slice(0, 160)}`,
      )
      check(
        'JOLEAVE-02 知らせに「保存していない」ことが見出しで出ている',
        jolBody.includes(stripZwspText(ja.form.leaveUnsavedTitle)),
        `窓の文=${jolBody.slice(0, 160)}`,
      )
      // ③「編集を続ける」で留まれる
      await jolPage.locator('[data-testid="confirm-cancel"]').first().click()
      await jolPage.waitForTimeout(600)
      check(
        'JOLEAVE-02 「編集を続ける」を選ぶと、編集の画面のまま留まる',
        /#\/recipes\/\d+\/edit/.test(jolPage.url()) &&
          stripZwspText(await jolTitleField.inputValue()) === jolNewTitle,
        `URL=${jolPage.url()}`,
      )
      // ④「保存せずに離れる」で離れる。レシピは書き換わっていない
      await jolBack.click()
      await jolPage.waitForTimeout(600)
      await jolPage.locator('[data-testid="confirm-ok"]').first().click()
      await jolPage.waitForTimeout(900)
      check(
        'JOLEAVE-02 「保存せずに離れる」を選ぶと、編集の画面から離れる',
        !/\/edit/.test(jolPage.url()),
        `URL=${jolPage.url()}`,
      )
      const jolSavedTitle = await jolPage.evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const one = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .get(id)
              one.onsuccess = () => resolve(one.result ? one.result.title : null)
              one.onerror = () => reject(one.error)
            }
            req.onerror = () => reject(req.error)
          }),
        jolId,
      )
      check(
        'JOLEAVE-02 保存せずに離れたので、レシピそのものは書き換わっていない',
        stripZwspText(jolSavedTitle ?? '') === jolOriginalTitle,
        `端末の中の料理名=${jolSavedTitle} / 元の料理名=${jolOriginalTitle}`,
      )
      // ⑤言ったとおり書きかけは残っている（開き直すと戻す案内が出る）
      await jolOpenEdit()
      check(
        'JOLEAVE-02 開き直すと、書きかけを戻す案内が出ている（知らせの言うとおり端末に残る）',
        stripZwspText(await jolPage.locator('body').textContent()).includes(
          stripZwspText(ja.form.draftFound),
        ),
      )
      // ⑥下の並びのタブで離れようとしても同じ知らせが出る
      await jolPage.getByRole('button', { name: ja.form.draftDiscard, exact: true }).first().click()
      await jolPage.waitForTimeout(400)
      await jolPage.getByLabel(ja.form.nameLabel).first().fill(`${jolOriginalTitle}・タブで離れる`)
      await jolPage.waitForTimeout(500)
      await jolPage.getByRole('link', { name: ja.nav.mealPlan }).first().click()
      await jolPage.waitForTimeout(700)
      check(
        'JOLEAVE-02 下の並びのタブで離れようとしても、同じ知らせが出る',
        (await jolPage.locator('[data-testid="confirm"]').count()) === 1 &&
          /#\/recipes\/\d+\/edit/.test(jolPage.url()),
        `窓の数=${await jolPage.locator('[data-testid="confirm"]').count()} URL=${jolPage.url()}`,
      )
      await jolPage.locator('[data-testid="confirm-ok"]').first().click()
      await jolPage.waitForTimeout(900)
      check(
        'JOLEAVE-02 タブの知らせで「保存せずに離れる」を選ぶと、そのタブへ移る',
        /#\/meal-plan/.test(jolPage.url()),
        `URL=${jolPage.url()}`,
      )

      // ⑦何も書き換えていなければ、知らせは出ずにそのまま離れられる
      await jolOpenEdit()
      await jolPage.getByRole('button', { name: ja.form.draftDiscard, exact: true }).first().click()
      await jolPage.waitForTimeout(400)
      await jolPage.getByRole('button', { name: ja.common.back, exact: true }).first().click()
      await jolPage.waitForTimeout(900)
      check(
        'JOLEAVE-02 何も書き換えていなければ、知らせは出ずにそのまま離れられる',
        (await jolPage.locator('[data-testid="confirm"]').count()) === 0 &&
          !/\/edit/.test(jolPage.url()),
        `窓の数=${await jolPage.locator('[data-testid="confirm"]').count()} URL=${jolPage.url()}`,
      )
    } finally {
      await jolBrowser.close()
    }
  }

  // ==========================================================================================
  // JOCOST-03（2026-08-23 便JO）: 「原価を見る」「原価を編集」で材料の文字が動かない
  //
  // オーナー原文:
  //   「「原価を編集」ボタンのせいで、材料の文字が下に動くのが気になる。ボタンの場所変えたい。
  //     下でもいいが不便になる。」
  //
  // 直す前の実測（390×844・肉じゃが）: 材料の1行目の位置は
  //   閉じた状態 629px → 「原価を見る」で 675px（**46px下がる**）→「原価を編集」で 723px（**さらに48px**）。
  //   合わせて 94px、材料の3行ぶんが下へずれていた。
  //
  // 測るのは「利用者が確かめたいこと」＝**材料の文字が動かないこと**:
  //   ①「原価を見る」を押しても材料の1行目が1pxも動かない
  //   ②続けて「原価を編集」を押しても動かない
  //   ③「材料に戻す」で閉じても元の位置のまま
  //   ④「原価を編集」は画面に出ていて、指で押せる大きさ（44px・--tap-min）である
  // 禁じ手よけ: 縦位置はスクロールに依らない値（画面の位置＋スクロール量）で測る／
  //   文言は ja.ts から読む／料理名で掴まない
  // ==========================================================================================
  currentCheck = 'JOCOST-03'
  {
    const jocBrowser = await chromium.launch()
    try {
      const jocContext = await jocBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jocPage = await jocContext.newPage()
      jocPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JOCOST-03] ${err.message}`)
      })
      await jocPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jocPage.waitForTimeout(2400)
      const jocId = await jocPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const keys = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAllKeys()
              keys.onsuccess = () => resolve(keys.result[0] ?? null)
              keys.onerror = () => reject(keys.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('JOCOST-03 前提: 材料を見るレシピのidを取れた', Number.isInteger(jocId), `id=${jocId}`)
      await jocPage.goto(`${BASE}/#/recipes/${jocId}`, { waitUntil: 'networkidle' })
      await jocPage.reload({ waitUntil: 'networkidle' })
      await jocPage.waitForTimeout(1400)

      /** 材料の1行目の、ページの先頭から数えた縦位置（スクロールしても変わらない値） */
      const jocTop = () =>
        jocPage.evaluate(() => {
          const li = document.querySelector('[data-testid="detail-ingredient"]')
          if (!li) return null
          return Math.round(li.getBoundingClientRect().top + window.scrollY)
        })
      const jocClosed = await jocTop()
      check('JOCOST-03 前提: 材料の1行目の位置を測れた', jocClosed !== null && jocClosed > 0, `${jocClosed}px`)

      await jocPage.getByRole('button', { name: ja.detail.priceViewShow, exact: true }).first().click()
      await jocPage.waitForTimeout(600)
      const jocView = await jocTop()
      check(
        'JOCOST-03 「原価を見る」を押しても材料の1行目が動かない（直す前は46px下がった）',
        jocView !== null && jocView === jocClosed,
        `押す前=${jocClosed}px 押した後=${jocView}px`,
      )

      const jocEditBtn = jocPage.getByRole('button', { name: ja.detail.priceEditShow, exact: true })
      check('JOCOST-03 前提: 「原価を編集」が画面に出ている', (await jocEditBtn.count()) === 1)
      const jocEditBox = await jocEditBtn.first().boundingBox()
      check(
        'JOCOST-03 「原価を編集」が指で押せる大きさ（44px以上）',
        jocEditBox !== null && jocEditBox.height >= 44,
        JSON.stringify(jocEditBox),
      )
      await jocEditBtn.first().click()
      await jocPage.waitForTimeout(600)
      const jocEdit = await jocTop()
      check(
        'JOCOST-03 「原価を編集」を押しても材料の1行目が動かない（直す前はさらに48px下がった）',
        jocEdit !== null && jocEdit === jocClosed,
        `閉じた状態=${jocClosed}px 編集=${jocEdit}px`,
      )

      await jocPage.getByRole('button', { name: ja.detail.priceViewHide, exact: true }).first().click()
      await jocPage.waitForTimeout(600)
      const jocBack = await jocTop()
      check(
        'JOCOST-03 「材料に戻す」で閉じても、材料の1行目は元の位置のまま',
        jocBack !== null && jocBack === jocClosed,
        `閉じた状態=${jocClosed}px 戻したあと=${jocBack}px`,
      )
    } finally {
      await jocBrowser.close()
    }
  }

  // ==========================================================================================
  // JOTIMER-04（2026-08-23 便JO）: 起動中タイマーの「+1分」が押せると分かる
  //
  // オーナー原文:
  //   「起動したタイマーの「＋１」が押せるとわかりづらい。見た目工夫が必要」
  //
  // 直す前の実測（390×844）: 「+1分」は 38×36px・**枠なし（border 0px）**・地色なし（透明）の
  // 12pxの文字で、隣の残り時間（18px太字）と同じ面に並んでいた＝ただの注記に見えていた。
  // 当たり判定も 38×36px で、指で押せる大きさ（44px・--tap-min）に届いていない。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①「+1分」に押せる面の印（枠）が付いている
  //   ②少し外れて押しても届く（当たり判定が44px＝--tap-min まで広がっている）。
  //     届かなければ、その押しは行そのもの＝調整の窓を開く操作になってしまう
  //   ③押すと今までどおり残りが約1分増え、調整の窓は開かない（近道としての役目は変えていない）
  // 禁じ手よけ: 文言は ja.ts から読む／残り時間は「増えた向き」だけを見る（秒の決め打ちをしない）
  // ==========================================================================================
  currentCheck = 'JOTIMER-04'
  {
    const jotBrowser = await chromium.launch()
    try {
      const jotContext = await jotBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jotPage = await jotContext.newPage()
      jotPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JOTIMER-04] ${err.message}`)
      })
      await jotPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jotPage.waitForTimeout(2400)
      const jotId = await jotPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const all = req.result
                .transaction('recipes', 'readonly')
                .objectStore('recipes')
                .getAll()
              all.onsuccess = () => {
                // 手順に分数の入った品（タイマーを起動できる品）を選ぶ。料理名では掴まない
                const hit = all.result.find((r) =>
                  (r.steps ?? []).some((s) => typeof s.minutes === 'number' && s.minutes > 0),
                )
                resolve(hit ? hit.id : null)
              }
              all.onerror = () => reject(all.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('JOTIMER-04 前提: タイマーを起動できるレシピのidを取れた', Number.isInteger(jotId), `id=${jotId}`)
      await jotPage.goto(`${BASE}/#/recipes/${jotId}`, { waitUntil: 'networkidle' })
      await jotPage.reload({ waitUntil: 'networkidle' })
      await jotPage.waitForTimeout(1400)
      await jotPage
        .getByRole('button', { name: new RegExp(`${ja.timer.start}$`) })
        .first()
        .click()
      await jotPage.waitForTimeout(800)

      const jotRow = jotPage.getByRole('button', { name: new RegExp(ja.timer.adjustOpenAria.replace('{label}', '.*')) })
      check('JOTIMER-04 前提: 常駐バーにタイマーの行が出た', (await jotRow.count()) >= 1)
      const jotPlus = jotPage.getByRole('button', {
        name: new RegExp(ja.timer.plusOneMinuteAria.replace('{label}', '.*')),
      })
      check('JOTIMER-04 前提: 「+1分」を掴めた', (await jotPlus.count()) === 1)

      // ①押せる面の印（枠）が付いている
      const jotLook = await jotPlus.first().evaluate((el) => {
        const cs = getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return {
          borderWidth: Math.round(parseFloat(cs.borderTopWidth)),
          borderColor: cs.borderTopColor,
          background: cs.backgroundColor,
          w: Math.round(r.width),
          h: Math.round(r.height),
          cx: r.x + r.width / 2,
          cy: r.y + r.height / 2,
        }
      })
      check(
        'JOTIMER-04 「+1分」に押せる面の印（枠）が付いている（直す前は枠なし）',
        jotLook.borderWidth >= 1,
        JSON.stringify(jotLook),
      )

      // ②③少し外れた場所を押しても「+1分」に届く（届かなければ行＝調整の窓が開いてしまう）
      const jotRemaining = async () => parseRemainingSeconds(await jotRow.first().textContent())
      const jotBeforeSec = await jotRemaining()
      await jotPage.mouse.click(jotLook.cx, jotLook.cy - 20)
      await jotPage.waitForTimeout(400)
      const jotAfterSec = await jotRemaining()
      check(
        'JOTIMER-04 「+1分」の少し外を押しても届く（当たり判定が44pxまで広がっている）',
        jotBeforeSec !== null && jotAfterSec !== null && jotAfterSec - jotBeforeSec >= 50,
        `押す前=${jotBeforeSec}s 押した後=${jotAfterSec}s`,
      )
      check(
        'JOTIMER-04 「+1分」の少し外を押しても、調整の窓は開かない（行の操作に化けない）',
        !(await jotPage
          .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
          .isVisible()
          .catch(() => false)),
      )
      // 真ん中を押したときも今までどおり（近道としての役目は変えていない）
      const jotBefore2 = await jotRemaining()
      await jotPlus.first().click()
      await jotPage.waitForTimeout(400)
      const jotAfter2 = await jotRemaining()
      check(
        'JOTIMER-04 「+1分」を押すと今までどおり残りが約1分増える',
        jotBefore2 !== null && jotAfter2 !== null && jotAfter2 - jotBefore2 >= 50,
        `押す前=${jotBefore2}s 押した後=${jotAfter2}s`,
      )
    } finally {
      await jotBrowser.close()
    }
  }

  // --- JNVIEW-01 / JNEDIT-02 / JNLOCK-03 / JNPAST-04: 月タブの日の窓を、週の曜日カードと同じ2モードにする ---
  //
  // 2026-08-23 便JN・オーナー原文「献立／月／・見た目を週に寄せて、編集ボタンをつけて。」
  // 週タブは 2026-08-22 便IV で「通常表示＝写真と料理名だけ／『編集』で1品ごとの操作が出る」に
  // なった。月タブの日の窓だけが**開いた瞬間から全部の操作が出ている**古い形で残っていたので、
  // 同じ2モードにする。文言・部品・鍵の止め方は週とまったく同じものを使う（同じものを2つ作らない）。
  currentCheck = 'JNVIEW-01'
  {
    const jnBrowser = await chromium.launch()
    const jnContext = await jnBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jnPage = await jnContext.newPage()
    jnPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JNVIEW-01] ${err.message}`)
    })
    try {
      await jnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jnPage.waitForTimeout(2400) // 初回シード完了待ち
      // 月タブは買い切り版の機能なので、測る前に解錠しておく（線引きそのものは他の節が受け持つ）
      await jnPage.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const cur = (await P(db.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(
          db
            .transaction('settings', 'readwrite')
            .objectStore('settings')
            .put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
        )
        db.close()
      })
      // 生のIndexedDBへ書いたので読み込み直す（CLAUDE.md 禁じ手⑥。Dexieの購読は張り直さないと届かない）
      await jnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jnPage.reload({ waitUntil: 'networkidle' })
      await jnPage.waitForTimeout(1800)
      // 献立を作ってから測る。「今日から7日間」にすれば、今日が何曜日でも今日に献立が入る（禁じ手①）
      await jnPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jnPage.waitForTimeout(1200)
      const jnLayoutOk = await selectWeekLayout(jnPage, ja.mealPlan.weekLayoutRolling)
      check('JNVIEW-01 前提: 週の区切りを「今日から7日間」にできた', jnLayoutOk === true, `結果=${jnLayoutOk}`)
      await jnPage.locator('[data-testid="week-fill-run"]').first().click()
      await jnPage.waitForTimeout(3000)
      await jnPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await jnPage.waitForTimeout(1600)

      const jnToday = await jnPage.evaluate(() => {
        const d = new Date()
        const pad = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      })
      const jnCell = (date) => jnPage.locator(`[data-testid="month-day-cell"][data-date="${date}"]`)
      check(
        'JNVIEW-01 前提: カレンダーに今日のマスが出ている',
        (await jnCell(jnToday).count()) === 1,
        `マス=${await jnCell(jnToday).count()}件`,
      )
      await jnCell(jnToday).click()
      await jnPage.waitForTimeout(1000)
      const jnDialog = jnPage.locator('[role="dialog"]')
      check('JNVIEW-01 前提: 日の窓が開いた', (await jnDialog.count()) === 1, `窓=${await jnDialog.count()}件`)
      check(
        'JNVIEW-01 前提: 窓にその日の献立が1品以上入っている',
        (await jnDialog.locator('[data-testid="row-recipe"]').count()) > 0,
        `品数=${await jnDialog.locator('[data-testid="row-recipe"]').count()}`,
      )

      const jnEdit = jnPage.locator('[data-testid="day-modal-edit"]')
      check(
        'JNVIEW-01 日の窓の見出しに「編集」の切り替えがある',
        (await jnEdit.count()) === 1,
        `ボタン=${await jnEdit.count()}件`,
      )
      const jnEditBox = (await jnEdit.count()) === 1 ? await jnEdit.boundingBox() : null
      check(
        'JNVIEW-01 「編集」は指で押せる大きさ(44px以上)',
        !!jnEditBox && jnEditBox.height >= 44,
        `高さ=${jnEditBox?.height}`,
      )
      /** 窓が編集モードに入っているか。ボタンが無ければ null（見つからない＝合格に倒さない） */
      const jnEditOn = async () =>
        (await jnEdit.count()) === 1 ? (await jnEdit.getAttribute('aria-pressed')) === 'true' : null
      check(
        'JNVIEW-01 窓を開いた直後は通常表示（週の曜日カードと同じ既定）',
        (await jnEditOn()) === false,
        `編集モード=${await jnEditOn()}`,
      )

      // 通常表示の1品カードは「写真＋料理名」だけ（週の IVCARD-02 とまったく同じ物差し）
      const jnCards = await jnPage.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]')
        if (!dialog) return null
        const cvs = document.createElement('canvas').getContext('2d')
        return [...dialog.querySelectorAll('[data-testid="row-recipe"]')].map((el) => {
          const title = el.querySelector('[data-testid="row-title"]')
          const cs = title ? getComputedStyle(title) : null
          if (cs) cvs.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
          const text = (title?.textContent ?? '').replaceAll('​', '')
          const tw = title ? title.getBoundingClientRect().width : 0
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
            fitChars: fit,
            cardHeight: Math.round(r.height),
            thumbs: el.querySelectorAll('[data-testid="row-thumb"]').length,
          }
        })
      })
      check(
        'JNVIEW-01 前提: 通常表示の1品カードを実測できた',
        Array.isArray(jnCards) && jnCards.length > 0 && jnCards.every((c) => c.title.length > 0),
        JSON.stringify(jnCards),
      )
      check(
        'JNVIEW-01 1品カードに出る文字は料理名だけ',
        Array.isArray(jnCards) && jnCards.length > 0 && jnCards.every((c) => c.all === c.title),
        JSON.stringify(jnCards),
      )
      check(
        'JNVIEW-01 1品カードには写真（または代わり絵）が付いている',
        Array.isArray(jnCards) && jnCards.length > 0 && jnCards.every((c) => c.thumbs === 1),
        JSON.stringify(jnCards),
      )
      check(
        'JNVIEW-01 料理名が10文字以上読める（週の1品カードと同じ物差し）',
        Array.isArray(jnCards) && jnCards.length > 0 && jnCards.every((c) => c.fitChars >= 10),
        JSON.stringify(jnCards),
      )

      /** 窓の献立の枠の中に、どの操作が出ているかを数える（並び順・入れ子の段数に依らない） */
      const jnOps = () =>
        jnPage.evaluate((aria) => {
          const dialog = document.querySelector('[role="dialog"]')
          if (!dialog) return null
          const blocks = [...dialog.querySelectorAll('[data-testid="slot-block"]')]
          const text = blocks.map((b) => b.textContent ?? '').join(' ').replaceAll('​', '')
          const byAria = (name) =>
            blocks
              .flatMap((b) => [...b.querySelectorAll('[aria-label]')])
              .filter((el) => (el.getAttribute('aria-label') ?? '').startsWith(name)).length
          return {
            blocks: blocks.length,
            dice: byAria(aria.suggest),
            remove: byAria(aria.clear),
            addRow: blocks
              .flatMap((b) => [...b.querySelectorAll('button')])
              .filter((b) => (b.textContent ?? '').trim() === aria.addRow).length,
            servings: /\d+人分/.test(text) ? 1 : 0,
            roleLabel: aria.roles.filter((r) => text.includes(r)).length,
            slotLock: dialog.querySelectorAll('[data-testid="slot-lock"]').length,
            lockMark: dialog.querySelectorAll('[data-testid="slot-lock-mark"]').length,
            cards: dialog.querySelectorAll('[data-testid="row-recipe"]').length,
          }
        }, {
          suggest: ja.mealPlan.suggestAria,
          clear: ja.mealPlan.clear,
          addRow: ja.mealPlan.addRow,
          roles: [ja.mealPlan.role.main, ja.mealPlan.role.side],
        })
      const jnViewOps = await jnOps()
      check('JNVIEW-01 前提: 窓の中の献立の枠を読めた', jnViewOps !== null && jnViewOps.blocks > 0, JSON.stringify(jnViewOps))
      check(
        'JNVIEW-01 通常表示に、引き直し・外す・追加の操作を出さない',
        jnViewOps !== null && jnViewOps.dice === 0 && jnViewOps.remove === 0 && jnViewOps.addRow === 0,
        JSON.stringify(jnViewOps),
      )
      check(
        'JNVIEW-01 通常表示に、役割（主菜/副菜）・食数・時間帯の鍵を出さない',
        jnViewOps !== null &&
          jnViewOps.roleLabel === 0 &&
          jnViewOps.servings === 0 &&
          jnViewOps.slotLock === 0,
        JSON.stringify(jnViewOps),
      )

      // ---- JNEDIT-02: 「編集」で1品ごとの操作が出る ----
      currentCheck = 'JNEDIT-02'
      await jnEdit.click()
      await jnPage.waitForTimeout(800)
      check('JNEDIT-02 「編集」を押すと編集モードに入る', (await jnEditOn()) === true, `編集モード=${await jnEditOn()}`)
      const jnEditOps = await jnOps()
      check(
        'JNEDIT-02 編集モードで、引き直し・外す・追加・食数・役割・時間帯の鍵が全部出る',
        jnEditOps !== null &&
          jnEditOps.dice > 0 &&
          jnEditOps.remove > 0 &&
          jnEditOps.addRow > 0 &&
          jnEditOps.servings === 1 &&
          jnEditOps.roleLabel > 0 &&
          jnEditOps.slotLock > 0,
        JSON.stringify(jnEditOps),
      )
      check(
        'JNEDIT-02 編集モードでも1品カードは残っている（差し替えの入口）',
        jnEditOps !== null && jnEditOps.cards > 0,
        JSON.stringify(jnEditOps),
      )
      await jnEdit.click()
      await jnPage.waitForTimeout(800)
      check('JNEDIT-02 もう一度押すと通常表示に戻る', (await jnEditOn()) === false, `編集モード=${await jnEditOn()}`)

      // 窓を閉じて開き直したら、また通常表示から始まる（編集モードを持ち越さない）
      await jnEdit.click()
      await jnPage.waitForTimeout(600)
      const jnCloseBtn = jnPage.locator('[data-testid="day-modal-close"]')
      check('JNEDIT-02 前提: 窓の「閉じる」を掴めた', (await jnCloseBtn.count()) === 1, `ボタン=${await jnCloseBtn.count()}件`)
      if ((await jnCloseBtn.count()) === 1) {
        await jnCloseBtn.click()
        await jnPage.waitForTimeout(700)
      }
      await jnCell(jnToday).click()
      await jnPage.waitForTimeout(900)
      check(
        'JNEDIT-02 窓を開き直すと通常表示から始まる（編集モードを持ち越さない）',
        (await jnEditOn()) === false,
        `編集モード=${await jnEditOn()}`,
      )

      // ---- JNLOCK-03: 鍵を掛けた日でも「編集」は押せて、中の操作だけが止まる ----
      currentCheck = 'JNLOCK-03'
      await jnEdit.click()
      await jnPage.waitForTimeout(700)
      const jnSlotLock = jnPage.locator('[role="dialog"] [data-testid="slot-lock"]').first()
      check('JNLOCK-03 前提: 窓の中の時間帯の鍵を掴めた', (await jnSlotLock.count()) === 1)
      await jnSlotLock.click()
      await jnPage.waitForTimeout(1200)
      const jnLockedOps = await jnOps()
      check(
        'JNLOCK-03 鍵を掛けると、その食事には「＋料理を追加」が出ない',
        jnLockedOps !== null && jnLockedOps.addRow === 0,
        JSON.stringify(jnLockedOps),
      )
      check(
        'JNLOCK-03 鍵を掛けた理由の1行が出る',
        (await jnPage.locator('[role="dialog"] [data-testid="slot-lock-note"]').count()) > 0,
        `1行=${await jnPage.locator('[role="dialog"] [data-testid="slot-lock-note"]').count()}件`,
      )
      // 止め方は「出さない」でも「出したまま押せなくする」でもよい（アプリは引き直しを出さず、
      // 外す・食数は出したまま押せなくしている）。**どの止め方でも同じ判定になる形**で見る。
      // 見つけた操作が0件のまま合格に倒れないよう、数えた総数も一緒に見る
      const jnLockedDisabled = await jnPage.evaluate((aria) => {
        const dialog = document.querySelector('[role="dialog"]')
        if (!dialog) return null
        const byAria = [...dialog.querySelectorAll('[aria-label]')].filter((el) =>
          [aria.suggest, aria.clear].some((name) =>
            (el.getAttribute('aria-label') ?? '').startsWith(name),
          ),
        )
        // 差し替えのボタン（2026-08-25 便KU で料理名のカードから移った）も、鍵で止まる操作の1つ。
        // カードそのものはレシピ詳細への行き先になったので、鍵では止めない（読むのは止めない）
        const ops = [...byAria, ...dialog.querySelectorAll('[data-testid="slot-change-recipe"]')]
        return {
          ops: ops.length,
          pressable: ops.filter((el) => !el.disabled).length,
          addRow: [...dialog.querySelectorAll('button')].filter(
            (b) => (b.textContent ?? '').trim() === aria.addRow,
          ).length,
        }
      }, {
        suggest: ja.mealPlan.suggestAria,
        clear: ja.mealPlan.clear,
        addRow: ja.mealPlan.addRow,
      })
      check(
        'JNLOCK-03 鍵を掛けた食事では、1品を触る操作がどれも押せない（出ていないか、出ていても押せない）',
        jnLockedDisabled !== null && jnLockedDisabled.ops > 0 && jnLockedDisabled.pressable === 0,
        JSON.stringify(jnLockedDisabled),
      )
      // 「完了」で通常表示に戻しても、鍵の印だけは残って読める（週の IVLOCK-04 と同じ）
      await jnEdit.click()
      await jnPage.waitForTimeout(800)
      const jnAfterLock = await jnOps()
      check(
        'JNLOCK-03 通常表示に戻しても鍵の印は出ている',
        jnAfterLock !== null && jnAfterLock.lockMark > 0,
        JSON.stringify(jnAfterLock),
      )
      check(
        'JNLOCK-03 鍵を掛けた日でも「編集」は押せる（押した先で中の操作だけが止まる）',
        (await jnEdit.count()) === 1 && (await jnEdit.isEnabled()),
        `ボタン=${await jnEdit.count()}件`,
      )
      // 後片付け: 鍵を外して次の節へ渡す
      await jnEdit.click()
      await jnPage.waitForTimeout(700)
      await jnPage.locator('[role="dialog"] [data-testid="slot-lock"]').first().click()
      await jnPage.waitForTimeout(1000)
      await jnEdit.click()
      await jnPage.waitForTimeout(600)
      if ((await jnPage.locator('[data-testid="day-modal-close"]').count()) === 1) {
        await jnPage.locator('[data-testid="day-modal-close"]').click()
        await jnPage.waitForTimeout(700)
      }

      // ---- JNPAST-04: 過ぎた日の窓にも「編集」があり、そこだけに作った記録の追加が出る ----
      currentCheck = 'JNPAST-04'
      // 「前の月」へ送れば、今日が何日でも**その月の全部が過ぎた日**になる（禁じ手①）
      await jnPage.getByRole('button', { name: ja.mealPlan.prevMonth, exact: true }).click()
      await jnPage.waitForTimeout(1200)
      const jnPastDate = await jnPage.evaluate(() => {
        const cells = [...document.querySelectorAll('[data-testid="month-day-cell"]')]
        return cells.length > 0 ? cells[cells.length - 1].getAttribute('data-date') : null
      })
      check(
        'JNPAST-04 前提: 前の月の日を掴めた（今日より前の日付）',
        jnPastDate !== null && jnPastDate < jnToday,
        `日付=${jnPastDate} 今日=${jnToday}`,
      )
      if (jnPastDate) {
        await jnCell(jnPastDate).click()
        await jnPage.waitForTimeout(900)
        check(
          'JNPAST-04 過ぎた日の窓にも「編集」がある',
          (await jnEdit.count()) === 1,
          `ボタン=${await jnEdit.count()}件`,
        )
        check(
          'JNPAST-04 通常表示には「作った記録を追加」を出さない',
          (await jnPage.locator('[role="dialog"] [data-testid="past-record-add"]').count()) === 0,
        )
        if ((await jnEdit.count()) === 1) {
          await jnEdit.click()
          await jnPage.waitForTimeout(800)
        }
        check(
          'JNPAST-04 編集モードにすると「作った記録を追加」が出る',
          (await jnPage.locator('[role="dialog"] [data-testid="past-record-add"]').count()) === 1,
          `ボタン=${await jnPage.locator('[role="dialog"] [data-testid="past-record-add"]').count()}件`,
        )
        check(
          'JNPAST-04 過ぎた日の窓には献立の枠を出さない（記録だけを見せる画面のまま）',
          (await jnPage.locator('[role="dialog"] [data-testid="slot-block"]').count()) === 0,
          `枠=${await jnPage.locator('[role="dialog"] [data-testid="slot-block"]').count()}件`,
        )
      }
    } finally {
      await jnBrowser.close()
    }
  }



  // --- JPCARD-01(2026-08-23 便JP・①): 並ぶカードの角が、切り取る器に食われていない ---
  //
  // オーナー原文: 「① 今日の献立のレシピカードの角が消えています。」
  //
  // 便JEは「角丸の値」を --radius-card（4px）の1か所にそろえたが、**カードを切り取る器**の
  // 角丸まではそろえていなかった。器のほうが丸いと、中のカードの角（1pxの線）はその弧の外へ出て
  // 消える＝計算値は4pxのままなのに、画面には角が無い。だから**クラス名でも計算値でもなく、
  // 「切り取る器の角丸」と「カードの角丸」の差**で見張る（差が0より大きい＝食われている）。
  //
  // 掴み方は「rounded-card が効いている要素」と「その角と同じ位置で切り取っている親」だけで、
  // 画面の名前・並び順・入れ子の段数には依らない＝**どこに出ていても同じ判定になる**。
  currentCheck = 'JPCARD-01'
  {
    const jpcBrowser = await chromium.launch()
    const jpcContext = await jpcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jpcPage = await jpcContext.newPage()
    jpcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JPCARD-01] ${err.message}`)
    })
    /** その画面に出ている「並ぶカード」を全部測る（角丸／切り取る器の角丸／食われる深さ） */
    const jpcSweep = () =>
      jpcPage.evaluate(() => {
        const out = []
        for (const el of document.querySelectorAll('[class*="rounded-card"]')) {
          const r = el.getBoundingClientRect()
          if (r.width < 24 || r.height < 24) continue
          const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius)
          let cut = 0
          let clipRadius = null
          let p = el.parentElement
          while (p && p !== document.body) {
            const ps = getComputedStyle(p)
            const clips = /hidden|clip/.test(ps.overflowX) || /hidden|clip/.test(ps.overflowY)
            if (clips) {
              const pr = p.getBoundingClientRect()
              // 角が同じ位置にある器だけが、そのカードの角を切り落としうる
              if (Math.abs(pr.left - r.left) <= 1 && Math.abs(pr.top - r.top) <= 1) {
                clipRadius = parseFloat(ps.borderTopLeftRadius)
                cut = Math.max(cut, Math.round((clipRadius - radius) * 100) / 100)
              }
            }
            p = p.parentElement
          }
          out.push({
            name: el.getAttribute('data-testid') || (el.getAttribute('class') || '').slice(0, 40),
            radius,
            clipRadius,
            cut,
          })
        }
        return out
      })
    /** 測った結果を判定に流す（0件で素通りしないよう、拾えた枚数も必ず見る） */
    const jpcCheck = async (where) => {
      const cards = await jpcSweep()
      check(`JPCARD-01 前提: ${where}で並ぶカードを1枚以上掴めた`, cards.length > 0, `${cards.length}枚`)
      const eaten = cards.filter((c) => c.cut > 0)
      check(
        `JPCARD-01 ${where}のカードの角が、切り取る器に食われていない`,
        cards.length > 0 && eaten.length === 0,
        eaten.length > 0
          ? eaten
              .map((c) => `${c.name}: 角=${c.radius}px 器=${c.clipRadius}px 食われ=${c.cut}px`)
              .join(' / ')
          : `${cards.length}枚とも角のまま`,
      )
      return cards
    }
    try {
      await jpcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpcPage.waitForTimeout(2400) // 初回シード完了待ち
      await jpcCheck('レシピ一覧')

      // 今日の献立（オーナーが名指しした場所）。1品入れてから測る
      await jpcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jpcPage.reload({ waitUntil: 'networkidle' })
      await jpcPage.waitForTimeout(1800)
      const jpcOne = jpcPage.locator('[data-testid="day-mode-one"]')
      if ((await jpcOne.count()) === 1) {
        await jpcOne.click()
        await jpcPage.waitForTimeout(800)
      }
      await jpcPage.locator('[data-testid="day-suggest-apply"]').click()
      await jpcPage.waitForTimeout(600)
      await jpcPage.getByRole('button', { name: ja.mealPlan.slot.dinner, exact: true }).first().click()
      await jpcPage.waitForTimeout(1800)
      const jpcDayCards = await jpcCheck('今日の献立（日タブ）')
      const jpcPlan = jpcDayCards.find((c) => c.name === 'day-plan-card')
      check(
        'JPCARD-01 前提: 今日の献立の1品カードを掴めた',
        jpcPlan != null,
        `拾えたカード=${jpcDayCards.map((c) => c.name).join(',')}`,
      )
      check(
        'JPCARD-01 今日の献立の1品カードの角が、そのまま画面に出ている',
        jpcPlan != null && jpcPlan.radius > 0 && jpcPlan.cut === 0,
        `角=${jpcPlan?.radius}px 切り取る器=${jpcPlan?.clipRadius}px 食われ=${jpcPlan?.cut}px`,
      )

      // 週タブ（曜日カード → 食事の枠 → レシピカード の入れ子）
      await jpcPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await jpcPage.waitForTimeout(1600)
      await openAllWeekDays(jpcPage)
      await jpcPage.waitForTimeout(600)
      await jpcCheck('週タブ')

      // 月タブ（カレンダーのマス）
      await jpcPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).first().click()
      await jpcPage.waitForTimeout(1600)
      await jpcCheck('月タブ')
    } finally {
      await jpcBrowser.close()
    }
  }

  // --- JPGAP-02(2026-08-23 便JP・②): 栄養を計算できなかった料理が「どれか」分かる ---
  //
  // オーナー原文:
  //   「② 計算できない料理が表示されるようになりましたが、どれが計算できなかったのかわかりません。
  //     折りたたみ開いたらレシピ名（カードでなく文字だけ。そのままリンクになっている）出して欲しいです。」
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①畳んでいるあいだは名前を出さない（1行の要約のままにする）
  //   ②開くと、計算できなかった料理の名前が出る
  //   ③その名前がそのままリンクで、押すとそのレシピが開く
  //   ④カードにしない（写真もカードの枠も出さない＝**文字だけ**）
  currentCheck = 'JPGAP-02'
  {
    const jpgBrowser = await chromium.launch()
    const jpgContext = await jpgBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jpgPage = await jpgContext.newPage()
    jpgPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JPGAP-02] ${err.message}`)
    })
    try {
      // 成分データを持たない材料を使う品を仕込む。料理名は ja.ts の文言と重ならない形にする
      const JPG_OK = 'E2Eぜんぶ計算できる品'
      const JPG_PARTIAL = 'E2E一部が計算できない品'
      const JPG_EXCLUDED = 'E2E何も計算できない品'
      await jpgPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpgPage.waitForTimeout(2400) // 初回シード完了待ち
      const jpgIds = await jpgPage.evaluate(async (titles) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const cur = (await P(idb.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({
          ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now(),
        }))
        const mk = (title, ingredients) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps: [{ text: '作る' }],
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false,
          createdAt: Date.now(), updatedAt: Date.now(),
        })
        const rice = { name: '米', amount: '150', unit: 'g' }
        const unknown = { name: 'うちレシピ架空調味料', amount: '100', unit: 'g' }
        const add = (v) => P(idb.transaction('recipes', 'readwrite').objectStore('recipes').add(v))
        const ok = await add(mk(titles.ok, [rice]))
        const partial = await add(mk(titles.partial, [rice, unknown]))
        const excluded = await add(mk(titles.excluded, [unknown]))
        // 今日の献立に3品とも入れる（曜日に依らない＝今日は必ず表示中の週に入っている）
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        await P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').clear())
        const put = (v) => P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').add(v))
        await put({ date, slot: 'dinner', recipeId: ok, role: 'main' })
        await put({ date, slot: 'dinner', recipeId: partial, role: 'side' })
        await put({ date, slot: 'lunch', recipeId: excluded, role: 'main' })
        idb.close()
        return { ok, partial, excluded }
      }, { ok: JPG_OK, partial: JPG_PARTIAL, excluded: JPG_EXCLUDED })
      // 生のIndexedDBへ書いたので必ず読み込み直す（CLAUDE.md 禁じ手⑥）
      await jpgPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jpgPage.reload({ waitUntil: 'networkidle' })
      await jpgPage.waitForTimeout(2000)
      await jpgPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
      await jpgPage.waitForTimeout(1600)

      // 2026-08-25 便KU: 週まとめの栄養は節の中へ入った（節の名前は2026-08-26 便LHで「栄養」）。
      // この節を測るのは**週まとめの折りたたみ**なので、外側の節は先に開いておく
      await openWeekGroup(jpgPage, ja.mealPlan.weekGroupNutritionTitle)
      await jpgPage.waitForTimeout(600)
      const jpgGap = jpgPage.locator('[data-testid="nutrition-gap-dish"]')
      // ① 畳んでいるあいだは名前を出さない
      check(
        'JPGAP-02 畳んでいるあいだは、計算できなかった料理の名前を出さない',
        (await jpgGap.count()) === 0,
        `名前=${await jpgGap.count()}件`,
      )
      // ② 週まとめの折りたたみを開く（開閉ボタンは読み上げ名で掴む＝並び順に依らない）
      const jpgToggle = jpgPage.getByRole('button', { name: ja.nutritionBalance.weekToggleExpand })
      check('JPGAP-02 前提: 週まとめの栄養の折りたたみがある', (await jpgToggle.count()) > 0, `${await jpgToggle.count()}件`)
      if ((await jpgToggle.count()) > 0) {
        await jpgToggle.first().click()
        await jpgPage.waitForTimeout(900)
      }
      const jpgNames = (await jpgGap.allTextContents()).map((t) => stripZwspText(t).trim())
      check(
        'JPGAP-02 開くと、計算できなかった料理の名前が出る',
        jpgNames.includes(JPG_PARTIAL) && jpgNames.includes(JPG_EXCLUDED),
        `出ている名前=${JSON.stringify(jpgNames)}`,
      )
      check(
        'JPGAP-02 ぜんぶ計算できた料理は並べない',
        jpgNames.length > 0 && !jpgNames.includes(JPG_OK),
        `出ている名前=${JSON.stringify(jpgNames)}`,
      )
      // ④ カードにしない（写真もカードの枠も無い＝文字だけ）
      // 0件のまま「出していないから合格」に倒れないよう、拾えた件数を必ず判定に入れる
      const jpgShape = await jpgPage.evaluate(() => {
        const list = [...document.querySelectorAll('[data-testid="nutrition-gap-dish"]')]
        return {
          count: list.length,
          images: list.filter((el) => el.querySelector('img, canvas, svg') != null).length,
          cardLike: list.filter((el) => /rounded-card/.test(el.getAttribute('class') || '') || el.querySelector('[class*="rounded-card"]') != null).length,
          links: list.filter((el) => el.tagName === 'A').length,
          minHeight: list.length === 0 ? null : Math.min(...list.map((el) => Math.round(el.getBoundingClientRect().height))),
        }
      })
      check(
        'JPGAP-02 カードにしない（写真も絵もカードの枠も出さない＝文字だけ）',
        jpgShape.count > 0 && jpgShape.images === 0 && jpgShape.cardLike === 0,
        `名前=${jpgShape.count}件 写真や絵=${jpgShape.images}件 カードの枠=${jpgShape.cardLike}件`,
      )
      check(
        'JPGAP-02 名前がそのままリンクになっている',
        jpgShape.links > 0 && jpgShape.links === jpgNames.length,
        `リンク=${jpgShape.links}件 名前=${jpgNames.length}件`,
      )
      check(
        'JPGAP-02 指で押せる高さがある（44px以上）',
        jpgShape.minHeight != null && jpgShape.minHeight >= 44,
        `いちばん低い行=${jpgShape.minHeight}px`,
      )
      // ③ 押すとそのレシピが開く
      const jpgTarget = jpgGap.filter({ hasText: JPG_EXCLUDED }).first()
      if ((await jpgTarget.count()) > 0) {
        await jpgTarget.click()
        await jpgPage.waitForTimeout(1400)
        check(
          'JPGAP-02 名前を押すと、そのレシピが開く',
          jpgPage.url().includes(`/recipes/${jpgIds.excluded}`) &&
            stripZwspText(await jpgPage.textContent('body')).includes(JPG_EXCLUDED),
          `URL=${jpgPage.url()}`,
        )
      }
    } finally {
      await jpgBrowser.close()
    }
  }

  // --- JPEFFORT-03(2026-08-23 便JP・③): 手間レベルが「普通」の品はカードにバッジを出さない ---
  //
  // オーナー原文: 「③（手間レベル）推奨通り。絞り込みでどういう扱いになる？」
  // 「普通」はレシピを登録するときの既定値で、人が選んだ結果ではない。並ぶカードの大半が
  // 同じ「普通」で埋まると見比べる手がかりにならないので、**表示だけ**やめる。
  //
  // 測るのは: ①「普通」の品のカードに手間が出ない ②「超簡単」「手の込んだ」は出る
  //   ③レシピ詳細は今までどおり3つとも出す（1品を読む場所なので引き算の理由が当たらない）
  //   ④絞り込みの選択肢からも「普通」が消えている（2026-08-23 追補・オーナー指示
  //     「絞り込みからも普通はずして」）。残るのは「すべて」「超簡単」「手の込んだ」で、
  //     **選べる条件はちゃんと絞れる**こと・**レシピは1品も消えていない**ことまで見る
  currentCheck = 'JPEFFORT-03'
  {
    const jpeBrowser = await chromium.launch()
    const jpeContext = await jpeBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jpePage = await jpeContext.newPage()
    jpePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JPEFFORT-03] ${err.message}`)
    })
    try {
      // 料理名に手間の言葉が入らないようにする（カードの文字から切り分けられなくなるため）
      const JPE_NORMAL = 'E2E手間きていの品'
      const JPE_EASY = 'E2E手間かんたんの品'
      const JPE_FANCY = 'E2E手間てまひまの品'
      const jpeWords = Object.values(ja.effort)
      await jpePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpePage.waitForTimeout(2400) // 初回シード完了待ち
      const jpeIds = await jpePage.evaluate(async (titles) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const mk = (title, effortLevel) => ({
          title, servings: 2, effortLevel, tags: [], ingredients: [{ name: '米', amount: '150', unit: 'g' }],
          steps: [{ text: '作る' }], isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false,
          createdAt: Date.now(), updatedAt: Date.now(),
        })
        const add = (v) => P(idb.transaction('recipes', 'readwrite').objectStore('recipes').add(v))
        const normal = await add(mk(titles.normal, 'normal'))
        const easy = await add(mk(titles.easy, 'easy'))
        const fancy = await add(mk(titles.fancy, 'fancy'))
        idb.close()
        return { normal, easy, fancy }
      }, { normal: JPE_NORMAL, easy: JPE_EASY, fancy: JPE_FANCY })
      // 生のIndexedDBへ書いたので必ず読み込み直す（CLAUDE.md 禁じ手⑥）
      await jpePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpePage.reload({ waitUntil: 'networkidle' })
      await jpePage.waitForTimeout(2000)

      /** その料理名のカードに出ている、手間の言葉（超簡単／普通／手の込んだ） */
      const jpeCardEffort = async (title) => {
        const card = jpePage.locator('[data-testid="recipe-list-card"]').filter({
          has: jpePage.locator('[data-testid="recipe-card-title"]', { hasText: title }),
        })
        if ((await card.count()) === 0) return null
        const text = stripZwspText(await card.first().textContent())
        return jpeWords.filter((w) => text.includes(w))
      }
      // 検索でその品だけに絞ってから測る（一覧の並び順・位置に依らない）
      const jpeSearch = async (title) => {
        await jpePage.getByPlaceholder(ja.search.placeholder).fill(title)
        await jpePage.waitForTimeout(900)
      }
      await jpeSearch(JPE_NORMAL)
      const jpeNormalWords = await jpeCardEffort(JPE_NORMAL)
      check(
        'JPEFFORT-03 前提: 「普通」の品のカードを掴めた',
        jpeNormalWords != null,
        `カード=${jpeNormalWords}`,
      )
      check(
        'JPEFFORT-03 手間が「普通」の品には、カードにバッジを出さない',
        jpeNormalWords != null && jpeNormalWords.length === 0,
        `出ている手間=${JSON.stringify(jpeNormalWords)}`,
      )
      await jpeSearch(JPE_EASY)
      const jpeEasyWords = await jpeCardEffort(JPE_EASY)
      check(
        'JPEFFORT-03 「超簡単」の品にはバッジを出す',
        jpeEasyWords != null && jpeEasyWords.join(',') === ja.effort.easy,
        `出ている手間=${JSON.stringify(jpeEasyWords)}`,
      )
      await jpeSearch(JPE_FANCY)
      const jpeFancyWords = await jpeCardEffort(JPE_FANCY)
      check(
        'JPEFFORT-03 「手の込んだ」の品にはバッジを出す',
        jpeFancyWords != null && jpeFancyWords.join(',') === ja.effort.fancy,
        `出ている手間=${JSON.stringify(jpeFancyWords)}`,
      )
      // ③ レシピ詳細は今までどおり出す（1品を読む場所なので、見比べのための引き算は当てない）
      await jpePage.goto(`${BASE}/#/recipes/${jpeIds.normal}`, { waitUntil: 'networkidle' })
      await jpePage.reload({ waitUntil: 'networkidle' })
      await jpePage.waitForTimeout(1400)
      check(
        'JPEFFORT-03 レシピ詳細では「普通」も今までどおり出す',
        stripZwspText(await jpePage.textContent('body')).includes(ja.effort.normal),
        `詳細に「${ja.effort.normal}」が無い`,
      )
      // ④ 絞り込みの選択肢から「普通」が消えている
      await jpePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpePage.waitForTimeout(1600)
      await jpePage.getByPlaceholder(ja.search.placeholder).fill('E2E手間')
      await jpePage.waitForTimeout(900)
      await jpePage.getByRole('button', { name: ja.search.filterToggle }).first().click()
      await jpePage.waitForTimeout(700)
      const jpeSelect = jpePage.locator(`select[aria-label="${ja.search.effortTitle}"]`).first()
      const jpeChoices = (await jpeSelect.locator('option').allTextContents()).map((t) =>
        stripZwspText(t).trim(),
      )
      check(
        'JPEFFORT-03 絞り込みの選択肢から「普通」が消えている',
        jpeChoices.length > 0 && !jpeChoices.includes(ja.effort.normal),
        `選択肢=${JSON.stringify(jpeChoices)}`,
      )
      check(
        'JPEFFORT-03 「超簡単」「手の込んだ」は絞り込みに残っている',
        jpeChoices.includes(ja.effort.easy) && jpeChoices.includes(ja.effort.fancy),
        `選択肢=${JSON.stringify(jpeChoices)}`,
      )
      // 残っている条件はちゃんと絞れる
      await jpeSelect.selectOption({ label: ja.effort.easy })
      await jpePage.waitForTimeout(900)
      await jpePage.locator('[data-testid="filter-panel-close"]').click()
      await jpePage.waitForTimeout(900)
      const jpeFilteredTitles = (
        await jpePage.locator('[data-testid="recipe-card-title"]').allTextContents()
      ).map((t) => stripZwspText(t).trim())
      check(
        'JPEFFORT-03 残った条件はちゃんと絞れる（「超簡単」で絞るとその品だけ）',
        jpeFilteredTitles.includes(JPE_EASY) &&
          !jpeFilteredTitles.includes(JPE_NORMAL) &&
          !jpeFilteredTitles.includes(JPE_FANCY),
        `絞り込みの結果=${JSON.stringify(jpeFilteredTitles)}`,
      )
      // 「普通」の品は消えていない（絞り込みを「すべて」に戻せば出てくる＝データは無傷）
      await jpePage.getByRole('button', { name: ja.search.filterToggle }).first().click()
      await jpePage.waitForTimeout(700)
      await jpeSelect.selectOption({ label: ja.search.effortAll })
      await jpePage.waitForTimeout(900)
      await jpePage.locator('[data-testid="filter-panel-close"]').click()
      await jpePage.waitForTimeout(900)
      const jpeAllTitles = (
        await jpePage.locator('[data-testid="recipe-card-title"]').allTextContents()
      ).map((t) => stripZwspText(t).trim())
      check(
        'JPEFFORT-03 「普通」の品は1品も消えていない（絞らなければ3品とも出る）',
        jpeAllTitles.includes(JPE_NORMAL) &&
          jpeAllTitles.includes(JPE_EASY) &&
          jpeAllTitles.includes(JPE_FANCY),
        `一覧=${JSON.stringify(jpeAllTitles)}`,
      )
      // 「普通」で絞った状態が保存に残っていても、開き直せば必ず抜けられる（空の一覧に閉じ込めない）
      await jpePage.evaluate(() => {
        const KEY = 'uchirecipe:recipesListState'
        const saved = JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
        sessionStorage.setItem(KEY, JSON.stringify({ ...saved, effort: 'normal' }))
      })
      await jpePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jpePage.reload({ waitUntil: 'networkidle' })
      await jpePage.waitForTimeout(1800)
      const jpeRestored = (
        await jpePage.locator('[data-testid="recipe-card-title"]').allTextContents()
      ).map((t) => stripZwspText(t).trim())
      check(
        'JPEFFORT-03 「普通」で絞った状態が残っていても、開き直せば一覧が出る（抜ける道がある）',
        jpeRestored.length > 0 && jpeRestored.includes(JPE_NORMAL),
        `一覧=${jpeRestored.length}件`,
      )
    } finally {
      await jpeBrowser.close()
    }
  }


  // --- JQBOX-01 / JQBOX-02 / JQSAME-03(2026-08-23 便JQ): 操作の段が「どの品のものか」を距離と囲みで読める ---
  //
  // オーナー原文:
  //   「献立・週
  //     ・編集の主菜や◯人分、削除などの列が、どのレシピについているのかわからない。
  //       上下のレシピで距離が同じ」
  //
  // 2026-08-22 便IZ が操作を2段目へ移したとき、**1品の中（カードの下端→操作の段の上端）も、
  // 品と品の間（操作の段の下端→次の品のカードの上端）も同じ12px**にしてしまった。
  // 距離がまったく同じなので、操作の段が上の品のものか下の品のものかを目で読めない。
  //
  // 測るのは「利用者が確かめたいこと」で、**数字の決め打ちではなく関係で測る**:
  //   ①1品ぶん（カードの段＋操作の段）が**1つの囲み**に入っている（線が引かれている）
  //   ②**1品の中 < 品と品の間**（近いほうが同じ品＝距離で切れ目が読める）
  //   ③1品の中は12px以上のまま（便IZ が「上の品の×と下の品のカードの押し間違え」を理由に
  //     広げた値なので、縮めて直したことにしない）
  //   ④囲みを足しても**料理名の幅が通常表示と同じ**（幅を削って囲みを置いていない）
  //   ⑤囲みと隙間で1品ぶんが縦に伸びすぎない（1画面に入る品数が減りすぎない）
  //   ⑥週タブと月タブの日の窓で**同じ形**（同じ部品を使っているので、片方だけ直さない）
  // 禁じ手よけ: 曜日・月替わりに依らない（今日のカードを使い、週の区切りは「今日から7日間」）／
  // 画面の文言を書き写さない（掴む側は data-testid と ja.ts）／並び順・入れ子の段数に依らない／
  // 生のIndexedDBへ書いたら読み込み直す／畳み方が落ち着いてから掴む（openAllWeekDays）
  currentCheck = 'JQBOX-01'
  {
    /**
     * 「1品ぶん」の並びを実測する（週の曜日カード／月の日の窓のどちらにも同じものを当てる）。
     * 掴むのは data-testid だけ。文言は使わない（この関数はブラウザ側で走るので ja は見えない）
     */
    const JQ_MEASURE = (rootSel) => {
      const root = document.querySelector(rootSel)
      if (!root) return null
      const cvs = document.createElement('canvas').getContext('2d')
      const toRgb = (v) => {
        cvs.clearRect(0, 0, 1, 1)
        cvs.fillStyle = v
        cvs.fillRect(0, 0, 1, 1)
        const d = cvs.getImageData(0, 0, 1, 1).data
        return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
      }
      // 透けていない親をさかのぼって、その要素の「後ろに見えている面」を拾う
      const behindOf = (el) => {
        let p = el.parentElement
        while (p) {
          const bg = getComputedStyle(p).backgroundColor
          if (toRgb(bg).a > 0) return toRgb(bg)
          p = p.parentElement
        }
        return toRgb('rgb(255,255,255)')
      }
      const blocks = []
      for (const block of root.querySelectorAll('[data-testid="slot-block"]')) {
        const rows = [...block.querySelectorAll('[data-testid="plan-row"]')]
        if (rows.length === 0) continue
        const info = rows.map((row) => {
          const cs = getComputedStyle(row)
          const kids = [...row.children].map((k) => k.getBoundingClientRect())
          const rr = row.getBoundingClientRect()
          const title = row.querySelector('[data-testid="row-title"]')
          return {
            // 1品の中＝1段目（料理カード）の下端 → 2段目（この品への操作）の上端
            inner: kids.length >= 2 ? Math.round((kids[1].top - kids[0].bottom) * 10) / 10 : null,
            cardTop: kids.length >= 1 ? kids[0].top : rr.top,
            cardHeight: kids.length >= 1 ? Math.round(kids[0].height) : 0,
            opsHeight: kids.length >= 2 ? Math.round(kids[1].height) : 0,
            opsBottom: kids.length >= 2 ? kids[1].bottom : rr.bottom,
            top: rr.top,
            bottom: rr.bottom,
            titleWidth: title ? Math.round(title.getBoundingClientRect().width) : 0,
            borderWidth: Math.round(parseFloat(cs.borderTopWidth) * 10) / 10,
            borderColor: toRgb(cs.borderTopColor),
            behind: behindOf(row),
            radius: Math.round(parseFloat(cs.borderTopLeftRadius) * 10) / 10,
          }
        })
        // 品と品の間＝上の品の操作の段の下端 → 次の品のカードの上端
        const between = []
        const stride = []
        for (let i = 0; i + 1 < info.length; i++) {
          between.push(Math.round((info[i + 1].cardTop - info[i].opsBottom) * 10) / 10)
          stride.push(Math.round((info[i + 1].top - info[i].top) * 10) / 10)
        }
        blocks.push({
          slot: block.getAttribute('data-slot'),
          rows: info.length,
          inner: info.map((r) => r.inner),
          between,
          stride,
          content: info.map((r) => r.cardHeight + (r.inner ?? 0) + r.opsHeight),
          titleWidth: info.map((r) => r.titleWidth),
          borderWidth: info.map((r) => r.borderWidth),
          radius: info.map((r) => r.radius),
          borderColor: info[0].borderColor,
          behind: info[0].behind,
        })
      }
      return blocks
    }
    /** 通常表示の料理名の幅（囲みを足したせいで編集モードだけ細っていないかの物差し） */
    const JQ_TITLES = (rootSel) => {
      const root = document.querySelector(rootSel)
      if (!root) return null
      return [...root.querySelectorAll('[data-testid="row-title"]')].map((el) =>
        Math.round(el.getBoundingClientRect().width),
      )
    }
    /** 測った並びから「関係」を取り出す（数字の決め打ちをしないで判定するため） */
    const jqFacts = (blocks) => {
      if (!Array.isArray(blocks) || blocks.length === 0) return null
      const inner = blocks.flatMap((b) => b.inner).filter((v) => typeof v === 'number')
      const between = blocks.flatMap((b) => b.between)
      const stride = blocks.flatMap((b) => b.stride)
      const content = blocks.flatMap((b) => b.content)
      return {
        rows: blocks.reduce((a, b) => a + b.rows, 0),
        innerMax: inner.length > 0 ? Math.max(...inner) : null,
        innerMin: inner.length > 0 ? Math.min(...inner) : null,
        betweenMin: between.length > 0 ? Math.min(...between) : null,
        strideMax: stride.length > 0 ? Math.max(...stride) : null,
        contentMin: content.length > 0 ? Math.min(...content) : null,
        borderMin: Math.min(...blocks.flatMap((b) => b.borderWidth)),
        radiusMin: Math.min(...blocks.flatMap((b) => b.radius)),
        titleWidths: [...new Set(blocks.flatMap((b) => b.titleWidth))].sort((a, b) => a - b),
      }
    }
    const jqBrowser = await chromium.launch()
    const jqContext = await jqBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jqPage = await jqContext.newPage()
    jqPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JQBOX-01] ${err.message}`)
    })
    try {
      await jqPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jqPage.waitForTimeout(2400) // 初回シード完了待ち
      // 月タブは買い切り版の機能なので、測る前に解錠しておく（線引きそのものは他の節が受け持つ）
      await jqPage.evaluate(async () => {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        const P = (req) =>
          new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
        const cur = (await P(db.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
        await P(
          db
            .transaction('settings', 'readwrite')
            .objectStore('settings')
            .put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }),
        )
        db.close()
      })
      // 生のIndexedDBへ書いたので読み込み直す（禁じ手⑥。Dexieの購読は張り直さないと届かない）
      await jqPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jqPage.reload({ waitUntil: 'networkidle' })
      await jqPage.waitForTimeout(1800)
      await jqPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jqPage.waitForTimeout(1200)
      // 「今日から7日間」にすれば、今日が何曜日でも今日に献立が入る（禁じ手①）
      const jqLayoutOk = await selectWeekLayout(jqPage, ja.mealPlan.weekLayoutRolling)
      check('JQBOX-01 前提: 週の区切りを「今日から7日間」にできた', jqLayoutOk === true, `結果=${jqLayoutOk}`)
      await jqPage.locator('[data-testid="week-fill-run"]').first().click()
      await jqPage.waitForTimeout(3000)
      await openAllWeekDays(jqPage)
      await jqPage.waitForTimeout(600)
      const jqToday = await jqPage.evaluate(() => {
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      })
      const jqWeekRoot = `section[data-date="${jqToday}"]`

      // まず通常表示の料理名の幅を控える（編集モードと突き合わせる物差し）
      const jqWeekViewTitles = await jqPage.evaluate(JQ_TITLES, jqWeekRoot)
      check(
        'JQBOX-01 前提: 週タブの通常表示の料理名を測れた',
        Array.isArray(jqWeekViewTitles) && jqWeekViewTitles.length > 0 && jqWeekViewTitles.every((w) => w > 0),
        `幅=${JSON.stringify(jqWeekViewTitles)}`,
      )
      const jqWeekEditOn = await openWeekDayEdit(jqPage, jqToday)
      check('JQBOX-01 前提: 今日のカードを編集モードにできた', jqWeekEditOn === true, `結果=${jqWeekEditOn}`)
      await jqPage.waitForTimeout(600)
      const jqWeekBlocks = await jqPage.evaluate(JQ_MEASURE, jqWeekRoot)
      const jqWeek = jqFacts(jqWeekBlocks)
      check(
        'JQBOX-01 前提: 週タブの編集モードの1品ぶんを実測できた',
        jqWeek !== null && jqWeek.rows >= 2 && jqWeek.innerMax !== null && jqWeek.betweenMin !== null,
        JSON.stringify(jqWeek),
      )
      if (jqWeek !== null) {
        check(
          'JQBOX-01 1品ぶん（カードの段＋操作の段）が囲みで囲まれている',
          jqWeek.borderMin > 0 && jqWeek.radiusMin > 0,
          `線の太さ=${jqWeek.borderMin}px 角丸=${jqWeek.radiusMin}px`,
        )
        check(
          'JQBOX-01 1品の中より、品と品の間のほうが広い（近いほうが同じ品）',
          jqWeek.innerMax !== null && jqWeek.betweenMin !== null && jqWeek.betweenMin > jqWeek.innerMax,
          `1品の中=最大${jqWeek.innerMax}px / 品と品の間=最小${jqWeek.betweenMin}px`,
        )
        check(
          'JQBOX-01 1品の中は12px以上のまま（便IZ の押し間違え対策を縮めていない）',
          jqWeek.innerMin !== null && jqWeek.innerMin >= 12,
          `1品の中=最小${jqWeek.innerMin}px`,
        )
        check(
          'JQBOX-01 囲みを足しても料理名の幅が通常表示と同じ（幅を削って囲みを置いていない）',
          Array.isArray(jqWeekViewTitles) &&
            jqWeekViewTitles.length > 0 &&
            jqWeek.titleWidths.length > 0 &&
            // 2026-08-24 司令部: 編集モードには**まだ料理を入れていない空き枠の行**も並び、
            // その行の料理名は0px。0pxを混ぜて比べると「幅が違う」で落ちる（便KGで種別が
            // 「保留」になり空き枠が出る組み合わせが増えて実発）。**料理が入っている行だけ**を比べる
            jqWeek.titleWidths.filter((w) => w > 0).length > 0 &&
            jqWeek.titleWidths.filter((w) => w > 0).every((w) => jqWeekViewTitles.includes(w)),
          `編集=${JSON.stringify(jqWeek.titleWidths)} 通常=${JSON.stringify([...new Set(jqWeekViewTitles)])}`,
        )
        check(
          'JQBOX-01 囲みと隙間で1品ぶんが縦に伸びすぎない（中身の1.5倍以内）',
          jqWeek.strideMax !== null && jqWeek.contentMin !== null && jqWeek.strideMax <= jqWeek.contentMin * 1.5,
          `1品の送り=最大${jqWeek.strideMax}px / 中身=最小${jqWeek.contentMin}px`,
        )
      }
      const jqWeekScroll = await jqPage.evaluate(() => ({
        doc: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }))
      check(
        'JQBOX-01 囲みを足しても横スクロールが出ない',
        jqWeekScroll.doc <= jqWeekScroll.client,
        JSON.stringify(jqWeekScroll),
      )

      // --- JQBOX-02: 月タブの日の窓（同じ部品を使っているので、同じことを同じ物差しで測る） ---
      currentCheck = 'JQBOX-02'
      await jqPage.getByRole('button', { name: ja.mealPlan.viewMonth, exact: true }).click()
      await jqPage.waitForTimeout(1600)
      const jqCell = jqPage.locator(`[data-testid="month-day-cell"][data-date="${jqToday}"]`)
      check('JQBOX-02 前提: カレンダーに今日のマスが出ている', (await jqCell.count()) === 1, `マス=${await jqCell.count()}件`)
      await jqCell.click()
      await jqPage.waitForTimeout(1000)
      const jqMonthViewTitles = await jqPage.evaluate(JQ_TITLES, '[role="dialog"]')
      check(
        'JQBOX-02 前提: 日の窓の通常表示の料理名を測れた',
        Array.isArray(jqMonthViewTitles) && jqMonthViewTitles.length > 0 && jqMonthViewTitles.every((w) => w > 0),
        `幅=${JSON.stringify(jqMonthViewTitles)}`,
      )
      const jqMonthEditOn = await openMonthDayEdit(jqPage)
      check('JQBOX-02 前提: 日の窓を編集モードにできた', jqMonthEditOn === true, `結果=${jqMonthEditOn}`)
      await jqPage.waitForTimeout(600)
      const jqMonthBlocks = await jqPage.evaluate(JQ_MEASURE, '[role="dialog"]')
      const jqMonth = jqFacts(jqMonthBlocks)
      check(
        'JQBOX-02 前提: 月タブの日の窓の1品ぶんを実測できた',
        jqMonth !== null && jqMonth.rows >= 2 && jqMonth.innerMax !== null && jqMonth.betweenMin !== null,
        JSON.stringify(jqMonth),
      )
      if (jqMonth !== null) {
        check(
          'JQBOX-02 1品ぶん（カードの段＋操作の段）が囲みで囲まれている',
          jqMonth.borderMin > 0 && jqMonth.radiusMin > 0,
          `線の太さ=${jqMonth.borderMin}px 角丸=${jqMonth.radiusMin}px`,
        )
        check(
          'JQBOX-02 1品の中より、品と品の間のほうが広い（近いほうが同じ品）',
          jqMonth.innerMax !== null && jqMonth.betweenMin !== null && jqMonth.betweenMin > jqMonth.innerMax,
          `1品の中=最大${jqMonth.innerMax}px / 品と品の間=最小${jqMonth.betweenMin}px`,
        )
        check(
          'JQBOX-02 1品の中は12px以上のまま（便IZ の押し間違え対策を縮めていない）',
          jqMonth.innerMin !== null && jqMonth.innerMin >= 12,
          `1品の中=最小${jqMonth.innerMin}px`,
        )
        check(
          'JQBOX-02 囲みを足しても料理名の幅が通常表示と同じ（幅を削って囲みを置いていない）',
          Array.isArray(jqMonthViewTitles) &&
            jqMonthViewTitles.length > 0 &&
            jqMonth.titleWidths.length > 0 &&
            // 2026-08-24 司令部: 上のJQBOX-01と同じ理由（空き枠の行の料理名は0px）
            jqMonth.titleWidths.filter((w) => w > 0).length > 0 &&
            jqMonth.titleWidths.filter((w) => w > 0).every((w) => jqMonthViewTitles.includes(w)),
          `編集=${JSON.stringify(jqMonth.titleWidths)} 通常=${JSON.stringify([...new Set(jqMonthViewTitles)])}`,
        )
      }

      // --- JQSAME-03: 週と月がそろっている（同じ部品なので片方だけ直さない） ---
      currentCheck = 'JQSAME-03'
      check(
        'JQSAME-03 前提: 週と月の両方を実測できた',
        jqWeek !== null && jqMonth !== null,
        `週=${JSON.stringify(jqWeek)} 月=${JSON.stringify(jqMonth)}`,
      )
      if (jqWeek !== null && jqMonth !== null) {
        check(
          'JQSAME-03 1品の中が週と月で同じ',
          jqWeek.innerMin === jqMonth.innerMin && jqWeek.innerMax === jqMonth.innerMax,
          `週=${jqWeek.innerMin}〜${jqWeek.innerMax}px 月=${jqMonth.innerMin}〜${jqMonth.innerMax}px`,
        )
        check(
          'JQSAME-03 品と品の間が週と月で同じ',
          jqWeek.betweenMin === jqMonth.betweenMin,
          `週=${jqWeek.betweenMin}px 月=${jqMonth.betweenMin}px`,
        )
        check(
          'JQSAME-03 囲みの線の太さと角丸が週と月で同じ',
          jqWeek.borderMin === jqMonth.borderMin && jqWeek.radiusMin === jqMonth.radiusMin,
          `週=線${jqWeek.borderMin}px/角${jqWeek.radiusMin}px 月=線${jqMonth.borderMin}px/角${jqMonth.radiusMin}px`,
        )
      }
    } finally {
      await jqContext.close()
      await jqBrowser.close()
    }
  }

  // --- JQTHEME-04(2026-08-23 便JQ): 1品ぶんの囲みが、5テーマとも後ろの面と見分けられる ---
  //
  // 2026-08-22 に「押せるものが背景と差0.0」という実例が出ている（便IU・③）。
  // 囲みは**見分けられて初めて意味がある**ので、線と後ろの面の差を5テーマぶん数値で見張る。
  // 直接の色の値は書かない＝色を変えたらここも直す、では見張りにならない。
  // 線は --border-card（border-edge-card。便JE が「図形の下限 3:1」を5テーマで満たす濃さにした）
  // を使っているので、その濃さがこの囲みにも効いていることを確かめる形になる。
  currentCheck = 'JQTHEME-04'
  {
    const jqtLum = (c) => {
      const f = (v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const jqtRatio = (a, b) => (Math.max(jqtLum(a), jqtLum(b)) + 0.05) / (Math.min(jqtLum(a), jqtLum(b)) + 0.05)
    const jqtHex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const jqtBrowser = await chromium.launch()
    try {
      for (const [jqtTheme, jqtLabel, jqtScheme] of [
        ['auto', '自動（端末=ライト）', 'light'],
        ['auto', '自動（端末=ダーク）', 'dark'],
        ['light', 'ライト', 'dark'],
        ['dark', 'ダーク', 'light'],
        ['brown', 'ブラウン', 'light'],
        ['green', 'グリーン', 'dark'],
      ]) {
        const jqtContext = await jqtBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: jqtScheme,
        })
        const jqtPage = await jqtContext.newPage()
        try {
          await jqtPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await jqtPage.waitForTimeout(2400)
          await jqtPage.evaluate(async (theme) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
            const cur = await P(idb.transaction('settings').objectStore('settings').get(1))
            await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({ ...(cur || {}), id: 1, theme }))
            idb.close()
          }, jqtTheme)
          // 生のIndexedDBへ書いたので読み込み直す（禁じ手⑥）
          await jqtPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
          await jqtPage.reload({ waitUntil: 'networkidle' })
          await jqtPage.waitForTimeout(1800)
          await jqtPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await jqtPage.waitForTimeout(1200)
          const jqtLayoutOk = await selectWeekLayout(jqtPage, ja.mealPlan.weekLayoutRolling)
          check(`JQTHEME-04 [${jqtLabel}] 前提: 週の区切りを「今日から7日間」にできた`, jqtLayoutOk === true, `結果=${jqtLayoutOk}`)
          await jqtPage.locator('[data-testid="week-fill-run"]').first().click()
          await jqtPage.waitForTimeout(3000)
          await openAllWeekDays(jqtPage)
          await jqtPage.waitForTimeout(600)
          const jqtToday = await jqtPage.evaluate(() => {
            const d = new Date()
            const p = (n) => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
          })
          const jqtEditOn = await openWeekDayEdit(jqtPage, jqtToday)
          check(`JQTHEME-04 [${jqtLabel}] 前提: 今日のカードを編集モードにできた`, jqtEditOn === true, `結果=${jqtEditOn}`)
          await jqtPage.waitForTimeout(600)
          const jqtSeen = await jqtPage.evaluate((date) => {
            const cvs = document.createElement('canvas').getContext('2d')
            const toRgb = (v) => {
              cvs.clearRect(0, 0, 1, 1)
              cvs.fillStyle = v
              cvs.fillRect(0, 0, 1, 1)
              const d = cvs.getImageData(0, 0, 1, 1).data
              return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
            }
            const behindOf = (el) => {
              let p = el.parentElement
              while (p) {
                const bg = getComputedStyle(p).backgroundColor
                if (toRgb(bg).a > 0) return toRgb(bg)
                p = p.parentElement
              }
              return toRgb('rgb(255,255,255)')
            }
            const section = document.querySelector(`section[data-date="${date}"]`)
            if (!section) return null
            return [...section.querySelectorAll('[data-testid="plan-row"]')].map((row) => {
              const cs = getComputedStyle(row)
              return {
                width: Math.round(parseFloat(cs.borderTopWidth) * 10) / 10,
                line: toRgb(cs.borderTopColor),
                behind: behindOf(row),
              }
            })
          }, jqtToday)
          check(
            `JQTHEME-04 [${jqtLabel}] 前提: 1品ぶんの囲みを掴めた`,
            Array.isArray(jqtSeen) && jqtSeen.length > 0,
            JSON.stringify(jqtSeen),
          )
          if (Array.isArray(jqtSeen) && jqtSeen.length > 0) {
            const jqtWorst = jqtSeen
              .map((s) => ({ ...s, ratio: jqtRatio(s.line, s.behind) }))
              .sort((a, b) => a.ratio - b.ratio)[0]
            check(
              `JQTHEME-04 [${jqtLabel}] 囲みの線が引かれている`,
              jqtSeen.every((s) => s.width > 0),
              `太さ=${JSON.stringify(jqtSeen.map((s) => s.width))}`,
            )
            check(
              `JQTHEME-04 [${jqtLabel}] 囲みの線が後ろの面と見分けられる（図形の下限 3:1 以上）`,
              jqtWorst.ratio >= 3,
              `線=${jqtHex(jqtWorst.line)} 後ろ=${jqtHex(jqtWorst.behind)} 差=${jqtWorst.ratio.toFixed(2)}:1`,
            )
          }
        } finally {
          await jqtContext.close()
        }
      }
    } finally {
      await jqtBrowser.close()
    }
  }


