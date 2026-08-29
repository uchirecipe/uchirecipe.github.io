// ==========================================================================================
// e2e の節: URLからの取り込み・並行調理ナビ
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
// この中の節: ICONPICK-01, FORMRESET-01, PANTRY-BULK-01, URLIMPORT-01, URLIMPORT-02, URLIMPORT-03, URLIMPORT-04, URLIMPORT-04b, URLIMPORT-05, URLIMPORT-06, URLIMPORT-07, URLIMPORT-08, URLIMPORT-09, URLIMPORT-10, URLIMPORT-11, URLIMPORT-12, URLIMPORT-13, URLIMPORT-14, KG-C, URLIMPORT-15, URLIMPORT-16, NAVI-01, NAVI-03, NAVI-04, NAVI-05, KKNAVI-01, NAVI-06, NAVI-07, NAVI-08, NAVI-09, ES-01, ES-02
// ==========================================================================================
import './_shared.mjs'


  // --- ICONPICK-01: 「画像」3択UI(2026-07-16 Fable裁定docs/30 裁定2【画像の3択】)。
  // [カメラで撮る][アルバムから選ぶ][アイコンから選ぶ▾]の3等分タイルで、3つ目が折りたたみの
  // 開閉ボタンになっていること(aria-expanded)・展開でアイコングリッドが出ること・写真を設定した
  // 状態でアイコンをタップすると「写真ではなくアイコンを表示」(showIconInsteadOfPhoto)が自動で
  // ONになりプレビューが即座にアイコン表示へ切り替わること・保存後の詳細画面でもアイコン表示が
  // 維持される(showIconInsteadOfPhotoが実際にDBへ連動している)ことを確認する ---
  currentCheck = 'ICONPICK-01'
  {
    const ipBrowser = await chromium.launch()
    const ipContext = await ipBrowser.newContext()
    const ipPage = await ipContext.newPage()
    ipPage.on('dialog', (dialog) => dialog.accept())
    ipPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@ICONPICK-01] ${err.message}`)
    })
    try {
      // 1x1の最小PNG(LOG-PHOTO-01と同じダミー画像。resizePhotoが実際にデコードできる本物の
      // 画像である必要があるため、テキストダミーではなくPNGを使う)
      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      )
      await ipPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ipPage.waitForTimeout(800)

      // 見出しが「写真」ではなく「画像」に改称されている(photoLabel値変更。裁定2 ①)
      check(
        'ICONPICK-01 見出しが「画像」に改称されている',
        await ipPage.getByText(ja.form.photoLabel, { exact: true }).first().isVisible().catch(() => false),
      )

      await ipPage.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eアイコン選択確認レシピ')
      await ipPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
      await ipPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')

      // 「アルバムから選ぶ」用のinput(capture属性が無い方)に写真を投入する
      await ipPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: tinyPng })
      await ipPage.waitForTimeout(500)
      const previewPhotoImg = ipPage.locator('img[alt="E2Eアイコン選択確認レシピ"]')
      check(
        'ICONPICK-01 写真を設定するとプレビューに写真が出る',
        await previewPhotoImg.isVisible().catch(() => false),
      )

      // 3つ目のタイル「アイコンから選ぶ」は折りたたみの開閉ボタン(裁定2 ③)
      const iconToggle = ipPage.getByRole('button', { name: ja.form.iconPickOpen })
      check(
        'ICONPICK-01 「アイコンから選ぶ」は閉じた状態(aria-expanded=false)で始まる',
        (await iconToggle.getAttribute('aria-expanded')) === 'false',
      )
      await iconToggle.click()
      await ipPage.waitForTimeout(200)
      check(
        'ICONPICK-01 クリックでaria-expandedがtrueになりアイコングリッド(自動+15種)が開く',
        (await iconToggle.getAttribute('aria-expanded')) === 'true' &&
          (await ipPage.getByRole('button', { name: '自動' }).first().isVisible()),
      )

      // アイコン(ご飯・丼)をタップする。写真設定済みなのでshowIconInsteadOfPhotoが自動ONになるはず(裁定2 ④)
      await ipPage.getByRole('button', { name: ja.icon.rice, exact: true }).click()
      await ipPage.waitForTimeout(300)
      check(
        'ICONPICK-01 写真設定済みでアイコンを選ぶとプレビューが写真からアイコン表示に切り替わる',
        !(await previewPhotoImg.isVisible().catch(() => false)),
      )

      // くわしくタブの「写真ではなくアイコンを表示」トグル(このページで唯一のrole=switch)が
      // アイコンタップの副作用で自動的にONになっている(●が点く。オーナー報告に明記の仕様)
      await ipPage.getByRole('tab', { name: ja.form.formTabDetail }).click()
      await ipPage.waitForTimeout(200)
      const showIconSwitch = ipPage.locator('button[role="switch"]')
      check(
        'ICONPICK-01 くわしくタブの「写真ではなくアイコンを表示」トグルが自動でONになっている',
        (await showIconSwitch.getAttribute('aria-checked')) === 'true',
      )
      await ipPage.getByRole('tab', { name: ja.form.formTabSimple }).click()
      await ipPage.waitForTimeout(200)

      // 保存→詳細画面でもアイコン表示が維持されている(showIconInsteadOfPhotoが実際にDBへ連動)
      await ipPage.getByRole('button', { name: '保存する' }).click()
      await ipPage.waitForTimeout(800)
      const detailPhotoImg = ipPage.locator('img[alt="E2Eアイコン選択確認レシピ"]')
      check(
        'ICONPICK-01 保存後の詳細画面でも写真ではなくアイコンが表示される(DB連動)',
        !(await detailPhotoImg.isVisible().catch(() => false)),
      )
      check(
        'ICONPICK-01 保存後、詳細画面のタイトルが正しく表示される',
        (await ipPage.textContent('body')).includes('E2Eアイコン選択確認レシピ'),
      )

      // 後始末: 検証用に作成したレシピを削除
      await ipPage.locator('a[href*="/edit"]').first().click()
      await ipPage.waitForTimeout(500)
      await ipPage.getByRole('button', { name: ja.form.deleteRecipe }).click()
      await ipPage.waitForTimeout(800)
    } finally {
      await ipBrowser.close()
    }
  }

  // --- FORMRESET-01: レシピ編集画面の「デフォルトに戻す」(2026-07-15 オーナー要望)。
  // DBには書き込まずフォームの入力値だけを差し替える安全設計。window.confirmは使わず、
  // もう一度押す方式(1回目はラベルが確認文言に変わるだけ・2回目で実行)で誤操作を防ぐ ---
  currentCheck = 'FORMRESET-01'
  {
    const frBrowser = await chromium.launch()
    const frContext = await frBrowser.newContext()
    const frPage = await frContext.newPage()
    frPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMRESET-01] ${err.message}`)
    })
    try {
      // (a) 基本レシピ「肉じゃが」: タイトル・材料を書き換えてからリセット
      // → starterDefsの原本に戻り、保存しなければ実データ(DB)も壊れないことを確認
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(1800) // 初回シード完了待ち
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)

      const titleInput = frPage.getByPlaceholder(ja.form.namePlaceholder)
      await titleInput.fill('テスト改名')
      const firstIngredientInput = frPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first()
      await firstIngredientInput.fill('テスト材料')

      check(
        'FORMRESET-01a 基本レシピの編集画面に「デフォルトに戻す」ボタンが出る',
        await frPage.getByRole('button', { name: 'デフォルトに戻す' }).isVisible(),
      )
      // 2026-08-15 便GW（A-5・オーナー承認）で「もう一度押す」方式をやめ、他の破壊的操作と
      // 同じ画面の中の窓にそろえた。**確かめたいのは「1回押しただけでは戻らない」こと**なので、
      // 方式そのものではなく**その性質**で測る（禁じ手④）
      await setConfirmAnswer(frPage, 'off')
      await frPage.getByRole('button', { name: 'デフォルトに戻す' }).click()
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01a 1回押しただけでは戻らず、確認を出す',
        (await frPage.locator('[data-testid="confirm"]').count()) === 1,
      )
      check(
        'FORMRESET-01a 確認待ちの間はまだ変更後のタイトルのまま',
        (await titleInput.inputValue()) === 'テスト改名',
      )
      check(
        'FORMRESET-01a 確認には、残るものと、保存済みは変わらないことが書いてある（規約F）',
        // 2026-08-26 便LG・オーナー原文「「保存を押すまで保存済みのレシピは変わりません」が
        // 「変わらないもの」に書いてあるのはどういう意味？」で窓を作り直した。
        // 基本レシピの「デフォルトに戻す」は、名前から読み取れない**残るもの**（料理名と写真）
        // だけを書き、DBの話（保存を押すまで保存済みは変わらない）は補足として別に置く。
        // 文言は evaluate の**引数で渡す**（向こうには ja が無い＝JM-4）
        await frPage.evaluate(
          (texts) => {
            const t = (
              document.querySelector('[data-testid="confirm"]')?.textContent ?? ''
            ).replaceAll('\u200b', '')
            // 2026-08-29 便MQ: texts が空だと中身を1回も見ずに合格する（実測で緑のまま）。
            // 見たい行が1つも渡っていないのは正解ではないので、同じ判定式に下限を入れる
            return texts.length > 0 && texts.every((one) => t.includes(one))
          },
          [
            ja.form.resetConfirmKeptLabel,
            ja.form.resetConfirmKeptStarter,
            ja.form.resetConfirmSaveNote,
          ],
        ),
      )

      await frPage.locator('[data-testid="confirm-ok"]').click()
      await setConfirmAnswer(frPage, 'accept')
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01a 2回目のクリックでタイトルが原本(肉じゃが)に戻る',
        (await titleInput.inputValue()) === '肉じゃが',
      )
      check(
        'FORMRESET-01a 材料も原本(じゃがいも)に戻る',
        (await firstIngredientInput.inputValue()) === 'じゃがいも',
      )
      check(
        'FORMRESET-01a 保存前の軽いフィードバックが表示される',
        stripZwspText(await frPage.textContent('body')).includes(ja.form.resetFeedback),
      )

      // 保存せずに一覧へ離脱しても実データが壊れていないことを確認
      // (テスト改名・テスト材料のどちらもDBに書き込まれていないこと)
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      const frListText = await frPage.textContent('body')
      check('FORMRESET-01a 離脱後も一覧に「肉じゃが」がそのまま残る', frListText.includes('肉じゃが'))
      check('FORMRESET-01a 離脱後、一覧に「テスト改名」は存在しない', !frListText.includes('テスト改名'))
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      const frDetailText = await frPage.textContent('body')
      check(
        'FORMRESET-01a 実データの材料も書き換わっていない(じゃがいもが残る・テスト材料は無い)',
        frDetailText.includes('じゃがいも') && !frDetailText.includes('テスト材料'),
      )

      // (b) 自作レシピ: 新規登録→保存→編集でタイトル変更→リセットで前回保存タイトルに戻ることを確認
      // (自作レシピはラベルが「前回保存した内容に戻す」で、スターターの「デフォルトに戻す」とは異なる)
      await frPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      await frPage.getByPlaceholder(ja.form.namePlaceholder).fill('FORMRESET自作レシピ')
      await frPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('にんじん')
      await frPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('切る')
      await frPage.getByRole('button', { name: '保存する' }).click()
      await frPage.waitForTimeout(800)
      check(
        'FORMRESET-01b 自作レシピの新規保存が成功する',
        (await frPage.textContent('body')).includes('FORMRESET自作レシピ'),
      )

      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)
      check(
        'FORMRESET-01b 自作レシピの編集画面は「前回保存した内容に戻す」ボタンになる',
        await frPage.getByRole('button', { name: ja.form.resetToSavedLabel }).isVisible(),
      )
      const ownTitleInput = frPage.getByPlaceholder(ja.form.namePlaceholder)
      await ownTitleInput.fill('FORMRESET改名後')
      await frPage.getByRole('button', { name: ja.form.resetToSavedLabel }).click()
      // 2026-08-15 便GW で「もう一度押す」方式は窓にそろえた。ここは自動押しに任せる
      // （01a のように自動押しを止めていないので、自分で押しにいくと押す相手が既に消えている）
      await frPage.waitForTimeout(600)
      check(
        'FORMRESET-01b 2回目のクリックで前回保存したタイトルに戻る',
        (await ownTitleInput.inputValue()) === 'FORMRESET自作レシピ',
      )

      // --- LG-03f（2026-08-26 便LG）: 料理名と写真も含めて全部戻る ---
      //   オーナー原文「この機能でユーザーが期待するのは、料理名と写真も含めた、編集の
      //   巻き戻しです。すべて戻るようにしてください。」
      //   実測: 便GW の時点で写真と見える範囲も戻っていた（直す必要があったのは窓の文だけ）。
      //   **戻らなくなったら気づけるように**、ここで写真と見える範囲まで見張る
      currentCheck = 'LG-03f'
      // 写真を入れて保存する（これが「前回保存した内容」になる）
      await frPage.locator('input[type=file]').nth(1).setInputFiles({
        name: 'lg-a.png',
        mimeType: 'image/png',
        buffer: makeTestPng(120, 90),
      })
      await frPage.waitForTimeout(900)
      await frPage.getByRole('button', { name: ja.form.save }).click()
      await frPage.waitForTimeout(900)
      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(700)
      const lgObjectPosition = () =>
        frPage.evaluate(() => {
          const img = document.querySelector('[data-testid="photo-focus-open-form"]')
            ?.parentElement?.querySelector('img')
          return img ? getComputedStyle(img).objectPosition : ''
        })
      const lgSavedPosition = await lgObjectPosition()
      // 料理名・写真・見える範囲の3つを、保存後の状態から動かす
      await frPage.getByPlaceholder(ja.form.namePlaceholder).fill('LG巻き戻し前')
      await frPage.locator('input[type=file]').nth(1).setInputFiles({
        name: 'lg-b.png',
        mimeType: 'image/png',
        buffer: makeTestPng(200, 150),
      })
      await frPage.waitForTimeout(900)
      await frPage.locator('[data-testid="photo-focus-open-form"]').click()
      await frPage.waitForTimeout(500)
      const lgPicker = frPage.locator(`[aria-label="${ja.photoFocus.pickerAria}"]`)
      const lgBox = await lgPicker.boundingBox()
      await frPage.mouse.click(lgBox.x + lgBox.width * 0.85, lgBox.y + lgBox.height * 0.2)
      await frPage.waitForTimeout(300)
      await frPage.getByRole('button', { name: ja.photoFocus.apply }).click()
      await frPage.waitForTimeout(500)
      const lgMovedPosition = await lgObjectPosition()
      check(
        'LG-03f 前提: 見える範囲を動かせている（中央から離れた）',
        lgMovedPosition !== lgSavedPosition,
        `保存時=${lgSavedPosition} 動かした後=${lgMovedPosition}`,
      )
      await setConfirmAnswer(frPage, 'off')
      await frPage.getByRole('button', { name: ja.form.resetToSavedLabel }).click()
      await frPage.waitForTimeout(400)
      await frPage.locator('[data-testid="confirm-ok"]').click()
      await setConfirmAnswer(frPage, 'accept')
      await frPage.waitForTimeout(800)
      check(
        'LG-03f 料理名が前回保存した内容に戻る',
        (await frPage.getByPlaceholder(ja.form.namePlaceholder).inputValue()) ===
          'FORMRESET自作レシピ',
      )
      check(
        'LG-03f 見える範囲も前回保存した内容に戻る',
        (await lgObjectPosition()) === lgSavedPosition,
        `保存時=${lgSavedPosition} 戻したあと=${await lgObjectPosition()}`,
      )
      check(
        'LG-03f 写真そのものも残っている（消えない）',
        (await frPage.locator('[data-testid="photo-focus-open-form"]').count()) === 1,
      )
    } finally {
      await frBrowser.close()
    }
  }

  // --- PANTRY-BULK-01: 在庫チップ「まとめて状態設定」(2026-07-17 docs/35 §5 オーナー決定・案D)。
  // 整理モード中、選択したチップに「ある」「少ない」「ない」の3ボタンで一括状態変更できることを
  // 検証する。プリセット食材は既定levelが'none'のため、先に通常モード(単発タップ)で「ある」に
  // 変えてから一括「ない」を適用しないと、書き込みが実際に効いたことを証明できない点に注意。
  // 合わせて既存の整理モード一括削除も同じセッションで検証し、退行がないことを確認する ---
  currentCheck = 'PANTRY-BULK-01'
  {
    const pbBrowser = await chromium.launch()
    const pbContext = await pbBrowser.newContext()
    const pbPage = await pbContext.newPage()
    pbPage.on('dialog', (dialog) => dialog.accept())
    pbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRY-BULK-01] ${err.message}`)
    })
    const readPantryItems = () =>
      pbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return items
      })
    try {
      await pbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pbPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品も同時に投入される)
      await pbPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await pbPage.waitForTimeout(500)

      // 前提: 「食材の在庫」タブが既定で開いている(通常モード)。対象3品(卵・玉ねぎ・にんじん)を
      // 単発タップで「ない」→「ある」に変え、既定値のままでは一括更新の証明にならない問題を回避する
      for (const name of ['卵', '玉ねぎ', 'にんじん']) {
        await pbPage.getByRole('button', { name }).click()
        await pbPage.waitForTimeout(150)
      }
      const beforeBulk = await readPantryItems()
      check(
        'PANTRY-BULK-01 前提: 対象3品を単発タップで「ある」にできた',
        ['卵', '玉ねぎ', 'にんじん'].every(
          (name) => beforeBulk.find((p) => p.name === name)?.level === 'have',
        ),
        `beforeBulk=${JSON.stringify(beforeBulk)}`,
      )

      // 整理モードに入る
      await pbPage.getByRole('button', { name: '整理', exact: true }).click()
      await pbPage.waitForTimeout(300)
      check(
        'PANTRY-BULK-01 整理モードに入ると案内文が出る',
        (await pbPage.textContent('body')).includes(ja.pantry.organizeSelect),
      )

      const bulkButton = (label) => pbPage.getByRole('button', { name: label, exact: true })
      check(
        'PANTRY-BULK-01 0件選択時は「ある」「少ない」「ない」ボタンがdisabled',
        (await bulkButton('ある').isDisabled()) &&
          (await bulkButton('少ない').isDisabled()) &&
          (await bulkButton('ない').isDisabled()),
      )

      // 対象3品を整理モードのチップとして選択する
      for (const name of ['卵', '玉ねぎ', 'にんじん']) {
        await pbPage.getByRole('button', { name, exact: true }).click()
      }
      await pbPage.waitForTimeout(200)
      check(
        'PANTRY-BULK-01 3件選択するとボタンのdisabledが解除される',
        !(await bulkButton('ない').isDisabled()),
      )

      // 「ない」を適用する
      await bulkButton('ない').click()
      await pbPage.waitForTimeout(400)
      const toastText = await pbPage.textContent('body')
      check(
        'PANTRY-BULK-01 適用後にトーストが出る(3件を「ない」にしました)',
        toastText.includes('3件を『ない』にしました'),
        toastText.slice(0, 200),
      )
      check(
        'PANTRY-BULK-01 適用後は選択が解除されボタンが再びdisabledになる(整理モードは維持)',
        (await bulkButton('ない').isDisabled()) &&
          (await pbPage.getByRole('button', { name: '完了', exact: true }).isVisible()),
      )

      const afterBulk = await readPantryItems()
      check(
        'PANTRY-BULK-01 選択した3件が実際にIndexedDB上でlevel=noneになる',
        ['卵', '玉ねぎ', 'にんじん'].every(
          (name) => afterBulk.find((p) => p.name === name)?.level === 'none',
        ),
        `afterBulk=${JSON.stringify(afterBulk)}`,
      )
      check(
        'PANTRY-BULK-01 選択していない品(じゃがいも)は既定のnoneのまま変化しない',
        afterBulk.find((p) => p.name === 'じゃがいも')?.level === 'none',
      )

      // 整理モード一括削除。文言は「選択した食材◯件を削除」で、全選択/選択解除のすぐ下に出る(補足#15)
      const beforeDeleteCount = afterBulk.length
      await pbPage.getByRole('button', { name: 'じゃがいも', exact: true }).click()
      await pbPage.waitForTimeout(200)
      check(
        'PANTRY-BULK-01(delete) 1件選択で削除ボタン「選択した食材1件を削除」が出る(補足#15)',
        await pbPage.getByRole('button', { name: '選択した食材1件を削除', exact: true }).isVisible(),
      )
      await pbPage.getByRole('button', { name: '選択した食材1件を削除', exact: true }).click()
      await pbPage.waitForTimeout(400)
      const afterDelete = await readPantryItems()
      check(
        'PANTRY-BULK-01(delete) 削除した品(じゃがいも)がIndexedDBから消える',
        !afterDelete.some((p) => p.name === 'じゃがいも') && afterDelete.length === beforeDeleteCount - 1,
        `afterDelete件数=${afterDelete.length}`,
      )
      check(
        'PANTRY-BULK-01(delete) 削除後も整理モードのまま(2026-07-24 補足#16。片づけが中断されない)',
        (await pbPage.getByRole('button', { name: '完了', exact: true }).isVisible()) &&
          !(await pbPage.getByRole('button', { name: '整理', exact: true }).isVisible()),
      )

      // 2026-07-29 便CC/C5(QA S2): 全選択→全削除で0件になると「完了」ボタンが消える一方で
      // 整理モードは続き、画面上に抜ける手段が無くなっていた。0件になったら自動で抜ける
      await pbPage.getByRole('button', { name: '全選択', exact: true }).click()
      await pbPage.waitForTimeout(200)
      const deleteAllBtn = pbPage.getByRole('button', { name: jaRe(ja.pantry.organizeDeleteSelected, { n: '\\d+' }, { exact: true }) })
      await deleteAllBtn.click()
      await pbPage.waitForTimeout(500)
      check(
        'PANTRY-BULK-01(C5) 全削除で0件になると整理モードを自動で抜ける(閉じ込められない)',
        (await readPantryItems()).length === 0 &&
          !(await pbPage.getByRole('button', { name: '完了', exact: true }).isVisible()) &&
          !(await pbPage.getByText(ja.pantry.organizeSelect).isVisible()),
      )
    } finally {
      await pbBrowser.close()
    }
  }

  // --- URLIMPORT-01〜: 「URLから取り込む」。エンドポイント設定時の表示・取り込みフロー全体
  // (成功/no_recipe/fetch_failed)を、実際のCloudflare Workerを立てずに検証する。
  // VITE_RECIPE_IMPORT_ENDPOINT を(実在しない.invalidドメインの)ダミー値で焼き込んでビルドし、
  // page.route()でその宛先へのfetchだけをブラウザ内で横取りしてWorkerの応答を模す(実ネットワークには
  // 出ない)。他チェックが使うBASE・PRO-FALLBACK-01のpreviewとは別に、自前previewサーバーを
  // もう1つ立てる(ポートは空きをその場で取る。2026-08-09 便EM)
  // (CLAUDE.md運用ルール: 自分が起動したPIDのみkill・オーナーのdevサーバー(5173)には触れない) ---
  currentCheck = 'URLIMPORT-01'
  {
    const MOCK_ENDPOINT = 'https://recipe-import.example.invalid/api'
    // メインのdist/を上書きしない: 専用outDirへビルドする。以前は素のvite buildで
    // dist/をダミー値入りビルドで置き換えてしまい、後続実行のURLIMPORT-00(未設定なら
    // ボタンが出ない)が汚染distを見て落ちる順序依存フレークになっていた(2026-07-20発覚)
    const URLIMPORT_OUT_DIR = 'dist-urlimport-e2e'
    execSync(`npx vite build --outDir ${URLIMPORT_OUT_DIR} --emptyOutDir`, {
      cwd: appRoot,
      stdio: 'inherit',
      env: { ...process.env, VITE_RECIPE_IMPORT_ENDPOINT: MOCK_ENDPOINT },
    })

    // ポートは空きを取る(2026-08-09 便EM。旧: 4203固定)。E2E_URLIMPORT_PREVIEW_PORT で明示指定も可
    const { proc: urlImportPreviewProc, base: URLIMPORT_PREVIEW_BASE } = await startPreviewServer({
      envName: 'E2E_URLIMPORT_PREVIEW_PORT',
      label: 'URLIMPORT-01',
      extraArgs: ['--outDir', URLIMPORT_OUT_DIR],
    })

    try {
      const uiBrowser = await chromium.launch()
      try {
        const uiContext = await uiBrowser.newContext()
        const uiPage = await uiContext.newPage()

        // 1x1の実在する有効なPNG(透過)。resizePhoto(createImageBitmap経由)が壊れずデコードできる
        // 必要があるため、単なるダミーバイト列ではなく本物のPNGバイナリを使う
        const DUMMY_PNG_BASE64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

        // Worker応答のスタブ: 「url」クエリの中身で成功/no_recipe/fetch_failedを出し分ける。
        // 画像プロキシ(/image?url=)へのリクエストも同じMOCK_ENDPOINT配下に来るためpathnameで分岐する
        // (2026-07-21 URL取り込みでレシピ写真も一緒に取り込む対応。app側src/logic/urlImportImage.ts
        // がWorker側 GET /image?url= を叩く設計をそのまま模す)
        await uiPage.route(
          (url) => url.href.startsWith(MOCK_ENDPOINT),
          async (route) => {
            const requested = new URL(route.request().url())
            const target = requested.searchParams.get('url') ?? ''
            if (requested.pathname.endsWith('/image')) {
              // photo-markerを含むURLだけ画像を返す(それ以外はWorker側のinvalid_content_type相当=400)
              if (!target.includes('photo-marker')) {
                return route.fulfill({
                  status: 400,
                  contentType: 'application/json',
                  body: JSON.stringify({ ok: false, error: 'invalid_content_type' }),
                })
              }
              // slow-photo-marker: レシピ本体はすぐ返るが写真だけ遅れて届くケース(2026-07-30 便CK/②-2)。
              // 写真が届く前に別のURLで取り込み直すと、前のURLの写真が現在の内容の上に着弾していた
              if (target.includes('slow-photo-marker')) {
                await new Promise((resolve) => setTimeout(resolve, 1500))
              }
              return route.fulfill({
                status: 200,
                contentType: 'image/png',
                headers: { 'Cache-Control': 'public, max-age=86400' },
                body: Buffer.from(DUMMY_PNG_BASE64, 'base64'),
              })
            }
            // slow-recipe-marker: 読み込みに時間がかかるケース(2026-07-30 便CK/②-3)。
            // 読み込み中に保存・キャンセルが押せると、遷移先の画面に置き換え確認が割り込んでいた
            if (target.includes('slow-recipe-marker')) {
              await new Promise((resolve) => setTimeout(resolve, 2500))
            }
            // over-servings-marker: アプリの上限20を超える人数分を返すケース(2026-07-30 便CK/①-1)
            if (target.includes('over-servings-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: '大鍋のカレー',
                    ingredients: [{ name: 'じゃがいも', amount: '20個' }],
                    steps: ['全部切る', '煮る'],
                    servings: 48,
                    sourceUrl: target,
                  },
                }),
              })
            }
            if (target.includes('no-recipe-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'no_recipe' }),
              })
            }
            // colon-marker: おいしい健康(https://oishi-kenko.com/recipes/22619)相当のコロン書式・
            // 括弧グラム併記。Worker側は「末尾の空白で名前と分量を切る」ため name に分量が食い込んだ
            // 状態(木綿豆腐: 75 / g など)で返ってくるのを模す。app側 normalizeImportedIngredient が
            // 貼り付け経路と同じロジックで木綿豆腐/75/g・白ごま/小さじ1/3・ごま油/小さじ1/2 に修復すること
            if (target.includes('colon-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: 'コロン書式レシピ',
                    ingredients: [
                      { name: '木綿豆腐: 75', amount: 'g' },
                      { name: '白ごま: 小さじ1/3 (1', amount: 'g)' },
                      { name: 'ごま油: 小さじ1/2 (2', amount: 'g)' },
                    ],
                    steps: ['豆腐を切る', 'ごまをふる'],
                    servings: 2,
                    sourceUrl: target,
                  },
                }),
              })
            }
            // photo-fail-marker: imageUrlはあるが画像プロキシが画像を返さない(=写真だけ取れない)
            // ケース。「photo-marker」を含まないURLなので上の/image分岐は400を返す。
            // 便BX/C01: 従来は完全に無言だったのを、控えめなトーストで伝えることの回帰防止
            if (target.includes('photo-fail-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: '写真だけ失敗する鍋',
                    ingredients: [{ name: '鶏もも肉', amount: '300g' }],
                    steps: ['鶏肉を切る'],
                    imageUrl: 'https://example.com/not-an-image.html',
                    sourceUrl: target,
                  },
                }),
              })
            }
            // group-marker: 味の素パーク相当のグループ記号(「A水」)+ グループ見出し行 +
            // 手順に紛れ込んだSNS名の行。便BX/C07(ゴミ行除去の経路統一)・C08(グループの引き継ぎ)
            if (target.includes('group-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: 'グループ記号レシピ',
                    ingredients: [
                      { name: 'じゃがいも', amount: '3個' },
                      { name: '水', amount: '2カップ', group: 'A' },
                      { name: '関連レシピ' },
                      { name: '合わせ調味料' },
                      { name: 'しょうゆ', amount: '大さじ2' },
                    ],
                    steps: ['じゃがいもを切る', 'Instagram', '煮込む'],
                    sourceUrl: target,
                  },
                }),
              })
            }
            // amountless-marker: 分量が読み取れない材料を含むケース(便BX/C09ライト版)
            if (target.includes('amountless-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: '分量不明レシピ',
                    ingredients: [
                      { name: 'じゃがいも', amount: '3個' },
                      { name: '塩こしょう' },
                      { name: 'パセリ' },
                    ],
                    steps: ['じゃがいもを切る', '炒める'],
                    sourceUrl: target,
                  },
                }),
              })
            }
            if (target.includes('fetch-failed-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'fetch_failed' }),
              })
            }
            // 便BX/C05: Workerが上流ステータスを添えて返すケース。404(ページが無い)と
            // 403(サイト側の拒否)と一時障害で案内文が変わることの回帰防止
            if (target.includes('notfound-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'fetch_failed', status: 404 }),
              })
            }
            if (target.includes('blocked-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'fetch_failed', status: 403 }),
              })
            }
            // 便BX/C04: Workerは形式不正のURLをHTTP400+invalid_urlで返す。app側が本文を読む前に
            // 打ち切っていたため「URLの形式」の案内が本番で一度も出ていなかった回帰の防止
            if (target.includes('invalid-url-marker')) {
              return route.fulfill({
                status: 400,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'invalid_url' }),
              })
            }
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                ok: true,
                recipe: {
                  title: 'E2Eモック鍋',
                  ingredients: [
                    { name: '鶏もも肉', amount: '300g' },
                    { name: 'しょうゆ', amount: '大さじ2' },
                  ],
                  steps: ['鶏肉を切る', '煮込む'],
                  servings: 3,
                  cookMinutes: 25,
                  // photo-markerを含むURLで取り込んだときだけ画像ありのレシピを返す
                  // (slow-photo-markerのときは、画像プロキシ側でも遅延させるURLを渡す)
                  ...(target.includes('photo-marker')
                    ? {
                        imageUrl: target.includes('slow-photo-marker')
                          ? 'https://example.com/slow-photo-marker.jpg'
                          : 'https://example.com/photo-marker.jpg',
                      }
                    : {}),
                  sourceUrl: target,
                },
              }),
            })
          },
        )

        await uiPage.goto(`${URLIMPORT_PREVIEW_BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-01 エンドポイント設定時は「URLから取り込む」ボタンが出る',
          await uiPage.getByText(ja.urlImport.open).isVisible(),
        )

        // --- 成功パス ---
        currentCheck = 'URLIMPORT-02'
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/success-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const importedText = await uiPage.textContent('body')
        check(
          'URLIMPORT-02 成功時に材料2件・手順2件を読み込んだ旨のメッセージが出る',
          importedText.includes('材料2件・手順2件を読み込みました。内容を確認して修正してください'),
        )
        // 2026-08-02 オーナー指示(便DF→司令部差し替え): 取り込めたときだけ合わせ調味料の案内1行を出す
        check(
          'URLIMPORT-02(司令部差替) 取り込み成功時に合わせ調味料の案内1行が出る',
          importedText.includes(ja.form.importSeasoningGuide),
        )
        check(
          'URLIMPORT-02(2026-08-03改定) URL取り込み後の編集画面にも「食材と価格」への案内・リンクを置かない',
          (await uiPage.locator('a[href="#/prices"]').count()) === 0 &&
            !importedText.includes('価格は「食材と価格」ページでまとめて管理します') &&
            !importedText.includes('食材と価格を編集する'),
          `#/pricesリンク数=${await uiPage.locator('a[href="#/prices"]').count()}`,
        )
        check(
          'URLIMPORT-02 タイトルが自動入力される',
          (await uiPage.locator(`input[placeholder="${ja.form.namePlaceholder}"]`).inputValue()) === 'E2Eモック鍋',
        )
        check(
          'URLIMPORT-02 調理時間が自動入力される',
          (await uiPage.locator(`input[placeholder="${ja.form.cookMinutesPlaceholder}"]`).inputValue()) === '25',
        )
        check(
          'URLIMPORT-02 人数分が自動入力される(3人分)',
          (await uiPage.locator('span.min-w-14.text-center.text-lg.font-bold.text-ink').textContent()) === '3人分',
        )
        const ingNameInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientNamePlaceholder}"]`)
        const ingAmountInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientAmountPlaceholder}"]`)
        const ingUnitInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientUnitPlaceholder}"]`)
        check(
          'URLIMPORT-02 材料1件目: name=鶏もも肉・splitQuantityでamount=300/unit=g に分解される',
          (await ingNameInputs.nth(0).inputValue()) === '鶏もも肉' &&
            (await ingAmountInputs.nth(0).inputValue()) === '300' &&
            (await ingUnitInputs.nth(0).inputValue()) === 'g',
        )
        check(
          'URLIMPORT-02 材料2件目: name=しょうゆ・splitQuantityでamount=2/unit=大さじ に分解される',
          (await ingNameInputs.nth(1).inputValue()) === 'しょうゆ' &&
            (await ingAmountInputs.nth(1).inputValue()) === '2' &&
            (await ingUnitInputs.nth(1).inputValue()) === '大さじ',
        )
        const stepInputs = uiPage.locator(`textarea[placeholder="${ja.form.stepTextPlaceholder}"]`)
        check(
          'URLIMPORT-02 手順が2件とも自動入力される',
          (await stepInputs.nth(0).inputValue()) === '鶏肉を切る' &&
            (await stepInputs.nth(1).inputValue()) === '煮込む',
        )
        // sourceUrlは「くわしく」タブ内の欄(常時マウント・hidden属性のみで非表示)。inputValueは
        // 可視性を問わずDOMの値を読めるため、タブ切替なしでも自動セットされたことを確認できる
        const sourceUrlInputs = uiPage.locator('input[type="url"]')
        check(
          'URLIMPORT-02 取り込んだURLがsourceUrl欄へ自動セットされる',
          (await sourceUrlInputs.nth(1).inputValue()) === 'https://example.com/success-recipe',
        )

        // --- no_recipeパス: 貼り付け欄への案内文言(オーナー確定文言と一致することを確認) ---
        // ハッシュルーティングは同一URLへのgoto()だと同一文書内遷移扱いになりReact状態がリセット
        // されない(前の入力・開閉状態が残る)ため、確実にフォームを作り直すreload()を使う
        currentCheck = 'URLIMPORT-03'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/no-recipe-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        // 便BX/C10: サイト単位で「非対応」と断定しない(判定はページ単位)。同じサイトの
        // 別ページなら取り込めることと、貼り付け欄への導線の両方を伝える
        check(
          'URLIMPORT-03 no_recipe時はページ単位の言い回し+貼り付け欄への案内が出る',
          (await uiPage.textContent('body')).includes(ja.urlImport.errorNoRecipe),
        )

        // --- fetch_failedパス ---
        currentCheck = 'URLIMPORT-04'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/fetch-failed-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-04 fetch_failed(一時障害)時は待ち時間の目安つきで再試行を促す',
          (await uiPage.textContent('body')).includes(ja.urlImport.errorFetchFailed),
        )

        // --- URLIMPORT-04b(便BX/C04・C05): 404・403・形式不正でそれぞれ違う案内が出る ---
        currentCheck = 'URLIMPORT-04b'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/notfound-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const notFoundBody = await uiPage.textContent('body')
        check(
          'URLIMPORT-04b 上流404は「ページが見つかりません」でURL確認を促す(時間をおいて、とは言わない)',
          notFoundBody.includes(ja.urlImport.errorNotFound) &&
            !notFoundBody.includes('数分おいてから'),
        )
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/blocked-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const blockedBody = await uiPage.textContent('body')
        check(
          'URLIMPORT-04b 上流403は再試行を勧めず貼り付けへ案内する',
          blockedBody.includes(ja.urlImport.errorBlocked) && !blockedBody.includes('数分おいてから'),
        )
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/invalid-url-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-04b HTTP400+invalid_urlはURLの形式の案内が出る(死に文言だったものが到達する)',
          stripZwspText(await uiPage.textContent('body')).includes(ja.urlImport.errorInvalidUrl),
        )

        // --- 写真の自動取り込み(2026-07-21): imageUrlがあるレシピを取り込むと、
        // Worker側の画像プロキシ(/image?url=)経由で写真も自動セットされる。取得は非同期(ベストエフォート)
        // なので、取り込み結果メッセージが出た後にプレビュー<img>が現れるまで少し待つ。
        // 「写真も取り込む」チェックボックスは既定ONなので、このケースはON前提のまま検証する
        // (2026-07-21 チェックボックス追加。ON時の既存挙動が変わっていないことの確認) ---
        currentCheck = 'URLIMPORT-05'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        const fetchPhotoCheckbox = uiPage
          .locator('label', { hasText: ja.urlImport.fetchPhoto })
          .locator('input[type="checkbox"]')
        check('URLIMPORT-05 「写真も取り込む」チェックボックスは既定でON', await fetchPhotoCheckbox.isChecked())
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-05 レシピ本体の取り込み結果メッセージは写真を待たずに出る',
          (await uiPage.textContent('body')).includes('材料2件・手順2件を読み込みました'),
        )
        await uiPage.waitForTimeout(1000)
        check(
          'URLIMPORT-05 料理の写真を1枚取り込みました、の追記メッセージが出る',
          (await uiPage.textContent('body')).includes(ja.urlImport.photoImported),
        )
        // 2026-08-02 オーナー指示(便DF): 取り込むのは料理の写真1枚だけで手順の写真は取り込まない。
        // 2026-08-25 便KW・①(オーナー原文「改行や内容を絞って短く読みやすくしてください。」):
        // この但し書きは、結果の並びから**「写真も取り込む」の説明**へ移した。取り込む範囲は
        // 取り込む前に決める話で、取り込むたびに繰り返す必要が無い。画面から消したのではないので、
        // 「同じ画面に出ていること」をここで見張り続ける
        check(
          'URLIMPORT-05(便DF) 手順の写真は取り込まないことを同じ画面で伝える',
          (await uiPage.textContent('body')).includes(ja.urlImport.fetchPhotoNote),
        )
        check(
          'URLIMPORT-05(便KW) 結果の行は但し書きを繰り返さない（短くする）',
          !ja.urlImport.photoImported.includes('手順の写真'),
        )
        check(
          'URLIMPORT-05 取り込んだ写真がフォームのプレビューに表示される(アイコンでなくimg)',
          await uiPage.locator('img[alt="E2Eモック鍋"]').isVisible(),
        )

        // --- 「写真も取り込む」チェックOFF(2026-07-21 オーナー指示のスイッチ): OFFにしてから
        // imageUrlありのレシピを取り込んでも、レシピ本体は取り込まれるが写真は一切セットされない
        // (fetchImportedPhoto系を呼ばない設計)ことを確認する ---
        currentCheck = 'URLIMPORT-06'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        const fetchPhotoCheckboxOff = uiPage
          .locator('label', { hasText: ja.urlImport.fetchPhoto })
          .locator('input[type="checkbox"]')
        await fetchPhotoCheckboxOff.uncheck()
        check('URLIMPORT-06 チェックを外すとOFFになる', !(await fetchPhotoCheckboxOff.isChecked()))
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-06 チェックOFFでもレシピ本体の取り込み結果メッセージは出る',
          (await uiPage.textContent('body')).includes('材料2件・手順2件を読み込みました'),
        )
        await uiPage.waitForTimeout(1000)
        check(
          'URLIMPORT-06 チェックOFFなら「料理の写真を1枚取り込みました」の追記メッセージは出ない',
          !(await uiPage.textContent('body')).includes(ja.urlImport.photoImported),
        )
        check(
          'URLIMPORT-06 チェックOFFなら写真はセットされない(imgが出ずアイコン表示のまま)',
          !(await uiPage
            .locator('img[alt="E2Eモック鍋"]')
            .isVisible()
            .catch(() => false)),
        )

        // --- コロン書式・括弧グラム併記(おいしい健康 https://oishi-kenko.com/recipes/22619 相当)の
        // 経路統一。Worker側で name に分量が食い込んだ材料でも、app側 normalizeImportedIngredient が
        // 貼り付け経路と同じロジックで 名前/分量/単位 に修復することを確認する(2026-07-23) ---
        currentCheck = 'URLIMPORT-07'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/colon-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const colonNameInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientNamePlaceholder}"]`)
        const colonAmountInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientAmountPlaceholder}"]`)
        const colonUnitInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientUnitPlaceholder}"]`)
        check(
          'URLIMPORT-07 コロン書式「木綿豆腐: 75 g」→ name=木綿豆腐/amount=75/unit=g に修復',
          (await colonNameInputs.nth(0).inputValue()) === '木綿豆腐' &&
            (await colonAmountInputs.nth(0).inputValue()) === '75' &&
            (await colonUnitInputs.nth(0).inputValue()) === 'g',
        )
        check(
          'URLIMPORT-07 括弧グラム併記「白ごま: 小さじ1/3 (1 g)」→ name=白ごま/amount=1/3/unit=小さじ に修復',
          (await colonNameInputs.nth(1).inputValue()) === '白ごま' &&
            (await colonAmountInputs.nth(1).inputValue()) === '1/3' &&
            (await colonUnitInputs.nth(1).inputValue()) === '小さじ',
        )
        check(
          'URLIMPORT-07 括弧グラム併記「ごま油: 小さじ1/2 (2 g)」→ name=ごま油/amount=1/2/unit=小さじ に修復',
          (await colonNameInputs.nth(2).inputValue()) === 'ごま油' &&
            (await colonAmountInputs.nth(2).inputValue()) === '1/2' &&
            (await colonUnitInputs.nth(2).inputValue()) === '小さじ',
        )

        // --- URLIMPORT-08(便BX/C02・C17): 材料・手順以外に置き換わった項目(人数分・調理時間)を
        // 結果メッセージに書き添える。成功メッセージがrole="status"で読み上げ対象になる ---
        currentCheck = 'URLIMPORT-08'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/success-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(600)
        check(
          'URLIMPORT-08 人数分・調理時間も置き換わった旨が結果メッセージに出る(C02)',
          (await uiPage.textContent('body')).includes('人数分・調理時間も読み込んだ内容に合わせました'),
        )
        // 2026-08-25 便KS・⑧: 知らせが2つ以上あるときは「・」付きの並び（ul）で出すので、
        // pに限らず role="status" の入れ物を見る（1つの知らせだけのときは今までどおりp）
        const okMsg = uiPage.locator('[role="status"]', { hasText: '材料2件・手順2件を読み込みました' })
        check(
          'URLIMPORT-08 成功メッセージはrole="status"+aria-live="polite"で読み上げられる(C17)',
          (await okMsg.count()) === 1 && (await okMsg.first().getAttribute('aria-live')) === 'polite',
        )

        // --- URLIMPORT-09(便BX/C16): 置き換え確認をキャンセルしたら「中止した」と返事する ---
        currentCheck = 'URLIMPORT-09'
        await setConfirmAnswer(uiPage, 'cancel')
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/success-recipe-2')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(600)
        await setConfirmAnswer(uiPage, 'accept')
        check(
          'URLIMPORT-09 確認ダイアログをキャンセルすると中止した旨が出る(C16)',
          stripZwspText(await uiPage.textContent('body')).includes(ja.urlImport.canceled),
        )
        check(
          'URLIMPORT-09 キャンセルしたので参照元URLは前回のまま(置き換わらない)',
          (await uiPage.locator('input[type="url"]').nth(1).inputValue()) ===
            'https://example.com/success-recipe',
        )

        // --- URLIMPORT-10(便BX/C01): 「写真も取り込む」ONで写真だけ取れなかったとき、
        // レシピ本体の成功メッセージはそのままに、控えめなトーストで写真の失敗を伝える ---
        currentCheck = 'URLIMPORT-10'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-fail-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(1200)
        const photoFailBody = await uiPage.textContent('body')
        check(
          'URLIMPORT-10 写真だけ取れなかったときトーストで伝える(C01)',
          photoFailBody.includes(ja.urlImport.photoNotImported),
        )
        check(
          'URLIMPORT-10 レシピ本体の成功メッセージは従来どおり(写真の失敗で成功文言を変えない)',
          photoFailBody.includes('材料1件・手順1件を読み込みました') &&
            !photoFailBody.includes(ja.urlImport.photoImported),
        )

        // --- URLIMPORT-11(便BX/C07・C08): ゴミ行の除去とグループの引き継ぎ ---
        currentCheck = 'URLIMPORT-11'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/group-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(600)
        const groupNameInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientNamePlaceholder}"]`)
        const groupMemoInputs = uiPage.locator(`input[placeholder="${ja.form.ingredientMemoPlaceholder}"]`)
        check(
          'URLIMPORT-11 材料からゴミ行(関連レシピ)と見出し行(合わせ調味料)が落ちて3件になる(C07/C08)',
          (await groupNameInputs.count()) === 3 &&
            (await groupNameInputs.nth(0).inputValue()) === 'じゃがいも' &&
            (await groupNameInputs.nth(1).inputValue()) === '水' &&
            (await groupNameInputs.nth(2).inputValue()) === 'しょうゆ',
        )
        // 2026-08-26 便LG: 材料メモは「メモを追加」を押すまで出さない形になった
        // （**中身がある行は開いたまま**）。それまでは全行にメモ欄が出ていたので
        // `groupMemoInputs.nth(1)` で「2行目のメモ」を掴めたが、いまは**中身のある行の欄しか無い**ので
        // nth(1) は存在せず、`inputValue()` が30秒待って**フルe2eごと実行中断**していた（禁じ手④）。
        // 行の並び順に頼らず、**その材料の行の中**で掴む形にする
        const memoOfIngredient = async (name) => {
          const row = uiPage
            .locator('[data-testid="ingredient-row"]')
            .filter({ has: uiPage.locator(`input[value="${name}"]`) })
            .first()
          const memo = row.locator(`input[placeholder="${ja.form.ingredientMemoPlaceholder}"]`)
          return (await memo.count()) ? await memo.first().inputValue() : null
        }
        check(
          'URLIMPORT-11 グループ記号Aは材料名から外れてメモに残る(名前照合を壊さない・C08)',
          (await memoOfIngredient('水')) === 'A',
        )
        check(
          'URLIMPORT-11 メモが空の行では「メモを追加」の裏に隠れている(2026-08-26 便LG)',
          (await memoOfIngredient('じゃがいも')) === null,
        )
        const stepTextareas = uiPage.locator(`textarea[placeholder="${ja.form.stepTextPlaceholder}"]`)
        check(
          'URLIMPORT-11 手順に紛れたSNS名の行が落ちる(C07)',
          (await stepTextareas.count()) === 2 &&
            (await stepTextareas.nth(0).inputValue()) === 'じゃがいもを切る' &&
            (await stepTextareas.nth(1).inputValue()) === '煮込む',
        )
        check(
          'URLIMPORT-11 結果メッセージの件数は整形後の件数(材料3件・手順2件)',
          (await uiPage.textContent('body')).includes('材料3件・手順2件を読み込みました'),
        )

        // --- URLIMPORT-12(便BX/C09ライト版): 分量が読み取れなかった材料の内訳と、
        // 該当行の控えめな印。大掛かりなプレビューUIは作らない ---
        currentCheck = 'URLIMPORT-12'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/amountless-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(600)
        check(
          'URLIMPORT-12 結果メッセージに分量を読み取れなかった件数の内訳が出る',
          (await uiPage.textContent('body')).includes(
            '材料3件（うち2件は分量が読み取れず名前だけです）・手順2件を読み込みました',
          ),
        )
        const amountlessHints = uiPage.getByText(ja.form.importedAmountlessHint)
        check('URLIMPORT-12 該当の材料行にだけ控えめな印が付く(2件)', (await amountlessHints.count()) === 2)
        // 自分で分量を入れると印は消える(「まだ空のまま」を指す印なので)
        await uiPage.locator(`input[placeholder="${ja.form.ingredientAmountPlaceholder}"]`).nth(1).fill('少々')
        await uiPage.waitForTimeout(300)
        check('URLIMPORT-12 分量を入れた行の印は消える', (await amountlessHints.count()) === 1)

        // --- URLIMPORT-13(2026-07-30 便CK/①-1): 取り込んだ人数分もアプリの範囲(1〜20)に収める。
        // 従来は setServings(result.servings) にクランプが無く、48人分がそのままフォームとDBに入り、
        // 手では作れない値(＋ボタンは無効なのに範囲外)が保存できていた ---
        currentCheck = 'URLIMPORT-13'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/over-servings-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(600)
        const clampedServings = await uiPage
          .locator('span.min-w-14.text-center.text-lg.font-bold.text-ink')
          .textContent()
        check(
          'URLIMPORT-13 48人分を返すページを取り込んでも人数分は上限の20人分に収まる',
          clampedServings === '20人分',
          `実際=${clampedServings}`,
        )
        check(
          'URLIMPORT-13 上限に達しているので「＋」は押せない(手入力と同じ状態になる)',
          await uiPage.locator(`button[aria-label="${ja.detail.servingsUp}"]`).first().isDisabled(),
        )

        // --- URLIMPORT-14(2026-07-30 便CK/②-1・S1): 置き換え確認に写真の扱いを書く。
        // 従来の確認文は写真を「消えるもの」にも「残るもの」にも書いておらず、残るものを
        // 列挙しているぶん「写真は触られない」と読めた。実際は既存の写真が無条件に差し替わり、
        // 保存すると端末内にしか無い元の写真は復元できなくなっていた ---
        currentCheck = 'URLIMPORT-14'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-first')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(1500)
        check(
          'URLIMPORT-14 前提: 1回目の取り込みで写真が入る',
          await uiPage.locator('img[alt="E2Eモック鍋"]').isVisible(),
        )
        const ckBefore = (await readConfirms(uiPage)).length
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-second')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(800)
        const ckDialogs = (await readConfirms(uiPage)).slice(ckBefore)
        check(
          'URLIMPORT-14 写真が置き換わって消えることと、元に戻せないことを確認文に書く(規約F)',
          ckDialogs.length === 1 &&
            ckDialogs[0].includes(ja.urlImport.confirmPhotoReplace),
          JSON.stringify(ckDialogs),
        )
        check(
          'URLIMPORT-14 写真を守る方法(チェックを外す)も同じ確認文で伝える',
          ckDialogs[0]?.includes(ja.urlImport.confirmPhotoNote),
        )
        // 2026-08-25 便KS・⑦: 料理名・ひとこと説明・メモは「残るもの」から「消えるもの」へ移った。
        // 規約Fの「何が残るか」は、取り込みが触らない項目（タグ・季節・時間帯・種別）で書く
        check(
          'URLIMPORT-14 「何が残るか」も書かれている(規約F)',
          ckDialogs[0]?.includes(`${ja.paste.confirmReplaceKeptLabel}: ${ja.urlImport.confirmReplaceKept}`),
          JSON.stringify(ckDialogs),
        )
        check(
          'URLIMPORT-14 入力済みの料理名は「消えるもの」に入る(便KS・⑦)',
          ckDialogs[0]?.includes(ja.paste.replaceItemTitle) &&
            !ckDialogs[0]?.includes(`${ja.paste.confirmReplaceKeptLabel}: ${ja.paste.replaceItemTitle}`),
          JSON.stringify(ckDialogs),
        )
        check(
          'URLIMPORT-14 置き換わった写真は「取り込みました」ではなく「置き換わりました」と伝える',
          (await uiPage.textContent('body')).includes(ja.urlImport.photoReplaced),
        )
        // 「写真も取り込む」をOFFにすれば写真は守られる。そのことも確認文に書く(規約F「何が残るか」)
        await uiPage
          .locator('label', { hasText: ja.urlImport.fetchPhoto })
          .locator('input[type="checkbox"]')
          .uncheck()
        const ckOffBefore = (await readConfirms(uiPage)).length
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-third')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(800)
        const ckDialogsOff = (await readConfirms(uiPage)).slice(ckOffBefore)
        check(
          'URLIMPORT-14 チェックOFFなら「写真はそのまま残る」と書く(消える予告は出さない)',
          ckDialogsOff.length === 1 &&
            ckDialogsOff[0].includes(
              `${ja.paste.confirmReplaceKeptLabel}: ${ja.urlImport.confirmReplaceKeptWithPhoto}`,
            ) &&
            !ckDialogsOff[0].includes(ja.urlImport.confirmPhotoReplace),
          JSON.stringify(ckDialogsOff),
        )

        // --- KG-C(2026-08-23 便KG・影響範囲テストA/B/C): 取り込んだページに調理時間が
        // 書かれていないことを知らせる／写真が届くまで保存を止める ---
        //   ・実データではクックパッド25品すべてで調理時間が空だった（ページ側に無い。実測で確認）。
        //     貼り付け経路には同じ知らせがあるのに、URL取り込みには無かった。
        //   ・写真はレシピ本体の0.3〜0.8秒後に届くのに、その間も保存が押せていた
        //     （実データBでは30品中10品が写真なしで保存されていた）。
        currentCheck = 'KG-C'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/group-marker')
        await uiPage.getByRole('button', { name: ja.urlImport.apply }).click()
        await uiPage.waitForTimeout(600)
        // 2026-08-25 便KW・①: 人数分と調理時間は1行にまとまった。group-markerのモックは
        // 人数分も調理時間も返さないので、2つ並んだ形がそのまま出る
        check(
          'KG-C 取り込んだページに調理時間が無いとき、読み取れなかったものとして知らせる',
          stripZwspText(await uiPage.textContent('body')).includes(
            ja.urlImport.notImported.replace(
              '{items}',
              [ja.urlImport.itemServings, ja.urlImport.itemCookMinutes].join(ja.urlImport.itemSeparator),
            ),
          ),
        )
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/success-recipe')
        await uiPage.getByRole('button', { name: ja.urlImport.apply }).click()
        await uiPage.waitForTimeout(600)
        check(
          'KG-C 調理時間も人数分も読み込めたときは、その知らせを出さない',
          !stripZwspText(await uiPage.textContent('body')).includes(
            ja.urlImport.notImported.replace('{items}', ''),
          ),
        )
        // 写真が遅れて届く間は保存を止める（本体の読み込み中と同じ扱い）
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/slow-photo-marker')
        await uiPage.getByRole('button', { name: ja.urlImport.apply }).click()
        await uiPage.waitForTimeout(700) // 本体は入り、写真はまだ届いていない
        const kgPhotoWaitBody = stripZwspText(await uiPage.textContent('body'))
        check(
          'KG-C 写真が届くまでは「保存する」が押せない',
          await uiPage.getByRole('button', { name: ja.form.save }).isDisabled(),
          kgPhotoWaitBody.slice(0, 200),
        )
        check(
          'KG-C 押せない理由をその場に書く（写真を読み込み中であること）',
          kgPhotoWaitBody.includes(ja.form.urlImportPhotoBlocksSave),
        )
        // 写真が届いたら解ける（届かなかった場合も解ける＝待たせ続けない）
        await uiPage.waitForTimeout(2000)
        check(
          'KG-C 写真が届いたら「保存する」が押せるようになる',
          !(await uiPage.getByRole('button', { name: ja.form.save }).isDisabled()),
        )
        check(
          'KG-C 写真が届いたら、待たせていた知らせは消える',
          !stripZwspText(await uiPage.textContent('body')).includes(ja.form.urlImportPhotoBlocksSave),
        )

        // --- URLIMPORT-15(2026-07-30 便CK/②-2): 連続して取り込んだとき、前のURLの写真が
        // 後から現在の内容の上に着弾しない。従来は「材料は新しいレシピ・写真は前のレシピ」の
        // 取り合わせで保存でき、「料理の写真を1枚取り込みました」も二重に追記されていた ---
        currentCheck = 'URLIMPORT-15'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/slow-photo-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500) // 本体は入るが写真はまだ届いていない
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/second-no-photo')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(2500) // 前のURLの写真が届くだけの時間を置く
        const seqBody = await uiPage.textContent('body')
        check(
          'URLIMPORT-15 取り込み直したら、前のURLの写真は届いても捨てる',
          !(await uiPage
            .locator('img[alt="E2Eモック鍋"]')
            .isVisible()
            .catch(() => false)),
        )
        check(
          'URLIMPORT-15 「料理の写真を1枚取り込みました」が二重に追記されない',
          !seqBody.includes(ja.urlImport.photoImported) &&
            !seqBody.includes(ja.urlImport.photoReplaced),
        )
        check(
          'URLIMPORT-15 2回目の取り込み結果は従来どおり出る(結果が消えたりしない)',
          seqBody.includes('材料2件・手順2件を読み込みました'),
        )

        // --- URLIMPORT-16(2026-07-30 便CK/②-3): 読み込み中は保存・キャンセルを押せない。
        // また読み込み中に画面を離れたら、遷移先へ置き換え確認が割り込まない
        // (従来は詳細画面の上に「入力済みの材料1件・手順1件は…置き換わって消えます」が出て、
        // いま見ている保存済みレシピが壊されると誤解させ、取り込み結果も消えていた) ---
        currentCheck = 'URLIMPORT-16'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.locator(`input[placeholder="${ja.form.namePlaceholder}"]`).fill('手入力のレシピ')
        await uiPage.locator(`input[placeholder="${ja.form.ingredientNamePlaceholder}"]`).first().fill('じゃがいも')
        await uiPage
          .locator(`textarea[placeholder="${ja.form.stepTextPlaceholder}"]`)
          .first()
          .fill('切る')
        await uiPage.getByText(ja.urlImport.open).click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/slow-recipe-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(700)
        check(
          'URLIMPORT-16 読み込み中は「保存する」が押せない',
          await uiPage.getByRole('button', { name: '保存する' }).isDisabled(),
        )
        check(
          'URLIMPORT-16 読み込み中は「キャンセル」も押せない',
          await uiPage.getByRole('button', { name: 'キャンセル' }).isDisabled(),
        )
        check(
          'URLIMPORT-16 押せない理由をその場に書く',
          (await uiPage.textContent('body')).includes(ja.form.urlImportBlocksSave),
        )
        // 下部ナビ等で画面を離れた場合の「幽霊確認ダイアログ」の根絶
        // 画面を離れたあとに開いた側で確認の窓が出ていないこと(遷移で貯め口は空に戻る)
        await uiPage.goto(`${URLIMPORT_PREVIEW_BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(3000) // 取り込みが解決するだけの時間を置く
        const ghostDialogs = await readConfirms(uiPage)
        check(
          'URLIMPORT-16 読み込み中に画面を離れても、遷移先に置き換え確認が割り込まない',
          ghostDialogs.length === 0,
          JSON.stringify(ghostDialogs),
        )
      } finally {
        await uiBrowser.close()
      }
    } finally {
      urlImportPreviewProc.kill()
      // 専用ビルドの後片付け(メインdistは最初から触っていない)
      try { execSync(`rm -rf ${URLIMPORT_OUT_DIR}`, { cwd: appRoot }) } catch { /* 掃除失敗は無害 */ }
    }
  }

  // --- NAVI-01/02/03: 並行調理ナビ(Pro)の常駐タイマー連携(2026-07-23便BI)。
  //     報告バグ「ナビ実行中に動作中(=完了)タイマーをタップすると単品レシピ詳細へ飛ばされ
  //     ナビから離脱する」の回帰防止。期待挙動:
  //       NAVI-01 完了タイマーのタップ→ナビ内に留まり該当手順カードをハイライト(単品詳細へ離脱しない)
  //       NAVI-02 動作中タイマーのタップ→±調整の窓が開く(従来どおり・ナビ内)
  //       NAVI-03 タイムラインを畳んで該当カードが無いとき→従来どおり単品詳細へフォールバック
  //     解錠(proCode)・専用レシピ(短い秒タイマー)をIndexedDB直書きで用意し、専用browserで完結させる。
  //     生IDB書き込みはDexieのliveQueryを更新しないので、必ずreload()で読み直してから操作する ---
  currentCheck = 'NAVI-01'
  {
    const naviBrowser = await chromium.launch()
    const naviContext = await naviBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const naviPage = await naviContext.newPage()
    naviPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI] ${err.message}`)
    })
    naviPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@NAVI] ${t}`)
    })
    try {
      await naviPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await naviPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await naviPage.evaluate(async () => {
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
        // 「2秒煮る」= TimeTextの「2秒」ボタンで2秒タイマーを起動できる(素早く完了させるため)
        const idA = await P(store('recipes').add(mk('E2Eナビ煮物A', [
          { text: '材料を切る' }, { text: '鍋に入れて2秒煮る', minutes: 1 }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('E2Eナビ炒めB', [
          { text: 'フライパンを熱する' }, { text: '3分炒める', minutes: 3 }, { text: '皿に移す' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })

      // reload()で読み直してナビへ。段取りを組む
      await naviPage.goto(`${BASE}/#/cook-navi`)
      await naviPage.reload({ waitUntil: 'networkidle' })
      await naviPage.waitForTimeout(1200)
      check(
        'NAVI-01 Pro解錠済みでナビが開き2品が自動選択される',
        (await naviPage.textContent('body')).includes('2品を選択中'),
      )
      await naviPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await naviPage.waitForTimeout(600)
      check(
        'NAVI-01 2品のタイムラインが組める',
        (await naviPage.textContent('body')).includes('組み合わせる2品'),
      )

      // 「2秒」ボタンで短いタイマーを起動
      await naviPage.getByRole('button', { name: new RegExp(`2秒 ${reEscape(ja.timer.start)}`) }).first().click()
      await naviPage.waitForTimeout(400)

      // NAVI-02: 動作中タイマーの行タップ→±調整の窓が開く(ナビ内に留まる)
      await naviPage.locator(`[aria-label*="${ja.timer.adjustDialogTitle}"]`).first().click()
      await naviPage.waitForTimeout(400)
      check(
        'NAVI-02 動作中タイマーのタップで±調整の窓が開く(ナビ内)',
        await naviPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle }).isVisible().catch(() => false),
      )
      check('NAVI-02 このとき単品レシピ詳細へ遷移していない', naviPage.url().includes('/cook-navi'))
      await naviPage.keyboard.press('Escape')
      await naviPage.waitForTimeout(300)

      // タイマー完了を待つ(完了行=border-warning)
      await naviPage.waitForSelector('div.fixed button.border-warning', { timeout: 8000 })
      await naviPage.waitForTimeout(400)

      // NAVI-01(本題): 完了タイマー→ナビに留まり、該当手順カードがハイライトされる。
      // 2026-08-11 便FO: 帯そのもののタップは画面を変えず調整の窓を開くだけになったので、
      // 移動は窓の「手順◯を開く」から行う（着地先の決め方は便BIのまま変えていない）
      const urlBeforeDoneTap = naviPage.url()
      await naviPage.locator('div.fixed button.border-warning').first().click()
      await naviPage.waitForTimeout(400)
      check(
        'NAVI-01 完了タイマーの帯はタップしても画面が変わらない(調整の窓が開く)',
        (await naviPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle }).count()) === 1 &&
          naviPage.url() === urlBeforeDoneTap,
        `before=${urlBeforeDoneTap} after=${naviPage.url()}`,
      )
      await naviPage
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: TIMER_BACK_LINK_RE })
        .click()
      await naviPage.waitForTimeout(700)
      check(
        'NAVI-01 完了タイマーのタップでナビから離脱しない(単品詳細へ飛ばない)',
        naviPage.url().includes('/cook-navi') && !/#\/recipes\/\d+/.test(naviPage.url()),
        `before=${urlBeforeDoneTap} after=${naviPage.url()}`,
      )
      check(
        'NAVI-01 完了タイマーのタップでナビ内の該当手順カードがハイライトされる',
        (await naviPage.locator('li[class*="ring-2"]').count()) >= 1,
      )
      await naviPage.waitForTimeout(2200) // ハイライト消去を待つ

      // NAVI-03: タイムラインを畳む(該当カードがDOMから消える)と、完了タイマーのタップは
      // 従来どおり単品レシピ詳細へフォールバックする(ガードが両方向に効くことの確認)
      currentCheck = 'NAVI-03'
      await naviPage.getByRole('button', { name: 'レシピを選び直す' }).click()
      await naviPage.waitForTimeout(400)
      await naviPage.locator('div.fixed button.border-warning').first().click()
      await naviPage.waitForTimeout(400)
      await naviPage
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: TIMER_BACK_LINK_RE })
        .click()
      await naviPage.waitForTimeout(700)
      check(
        'NAVI-03 タイムラインが畳まれ該当カードが無いときは単品レシピ詳細へフォールバックする',
        /#\/recipes\/\d+/.test(naviPage.url()),
        `url=${naviPage.url()}`,
      )
    } finally {
      await naviBrowser.close()
    }
  }

  // --- NAVI-04: 段取り精度の改善(2026-07-23便BI・Fable裁定)。貼り付け/URL取り込みのレシピは
  //     step.minutesが空になる実態があり、従来は本文に「15分煮る」と書いてあっても待ちとして
  //     認識されず全手順が「手を動かす」の平坦な段取り＋誤った所要目安になっていた。
  //     minutesを持たない(=貼り付け相当)レシピでも、本文の時間表記+待ち動詞から待ちを認識し、
  //     隙間に別レシピの手作業が差し込まれることをブラウザ実UIで確認する ---
  currentCheck = 'NAVI-04'
  {
    const nav4Browser = await chromium.launch()
    const nav4Context = await nav4Browser.newContext({ viewport: { width: 390, height: 820 } })
    const nav4Page = await nav4Context.newPage()
    nav4Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-04] ${err.message}`)
    })
    try {
      await nav4Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nav4Page.waitForTimeout(1800)
      await nav4Page.evaluate(async () => {
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
        // 貼り付け相当: 時間は本文にあるが step.minutes は未設定(parseRecipeTextの実挙動)
        const idA = await P(store('recipes').add(mk('E2E貼付け煮物', [
          { text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('E2E貼付けサラダ', [
          { text: '野菜を切る' }, { text: 'ドレッシングと和える' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await nav4Page.goto(`${BASE}/#/cook-navi`)
      await nav4Page.reload({ waitUntil: 'networkidle' })
      await nav4Page.waitForTimeout(1200)
      await nav4Page.getByRole('button', { name: ja.cookNavi.build }).click()
      await nav4Page.waitForTimeout(600)
      const body = await nav4Page.textContent('body')
      check(
        'NAVI-04 minutes無の「鍋で15分煮る」が待ちとして認識される(約15分の待ち時間が出る)',
        body.includes('約15分の待ち時間'),
      )
      // 待ち(煮物 手順2)の隙間にサラダの手作業が差し込まれている=並行化されている。
      // 手順カード(タイムラインの<ol>直下<li>)の並び順(DOM順)で、煮物の待ちカードの直後に
      // サラダのカードが来ることを確認する。kind判定は「待ち」を先に見る(待ちカードの補助文言
      // 「この間に、次の手作業を…」に"手作業"が含まれるため順序が重要)
      const cards = await nav4Page.$$eval('ol > li', (lis) =>
        lis.map((li) => ({ text: li.textContent || '', isWait: (li.textContent || '').includes('待ち') })),
      )
      const simmerIdx = cards.findIndex((c) => c.isWait && c.text.includes('鍋で15分煮る') && c.text.includes('E2E貼付け煮物'))
      check(
        'NAVI-04 待ちの直後に別レシピ(サラダ)の手作業が差し込まれる=並行化される',
        simmerIdx >= 0 && (cards[simmerIdx + 1]?.text.includes('E2E貼付けサラダ') ?? false),
        `cards=${JSON.stringify(cards.map((c) => ({ wait: c.isWait, t: c.text.slice(0, 24) })))}`,
      )
    } finally {
      await nav4Browser.close()
    }
  }

  // --- NAVI-05: 並行できないときの正直表示(2026-08-08 便ED・docs/68 打ち手#4)。
  //     待ち時間が1つも見つからない組み合わせでは、1品ずつ順に作るのと1分も変わらないのに
  //     「全体の目安 約◯分」とだけ出ていた(縮んでいないのに縮んだように見える)。
  //     期待挙動: 理由の1文＋次の一手の1文が出る／段取りは1品ずつ完結する並びになり、
  //     加熱で仕上げる温かい品が最後に来る ---
  currentCheck = 'NAVI-05'
  {
    const nav5Browser = await chromium.launch()
    const nav5Context = await nav5Browser.newContext({ viewport: { width: 390, height: 820 } })
    const nav5Page = await nav5Context.newPage()
    nav5Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-05] ${err.message}`)
    })
    try {
      await nav5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nav5Page.waitForTimeout(1800)
      await nav5Page.evaluate(async () => {
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
        // 手入力そのもの: 短文・分数なし・時間表記なし=待ちが1つも見つからない2品。
        // 「炒めもの」は加熱で終わる=温かい品なので、正直表示では後ろに回るのが正解
        const idA = await P(store('recipes').add(mk('E2Eナビ炒めもの', [
          { text: '野菜を切る' }, { text: 'フライパンで炒める' },
        ])))
        const idB = await P(store('recipes').add(mk('E2Eナビ和えもの', [
          { text: 'きゅうりを切る' }, { text: 'ごまと和える' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await nav5Page.goto(`${BASE}/#/cook-navi`)
      await nav5Page.reload({ waitUntil: 'networkidle' })
      await nav5Page.waitForTimeout(1200)
      await nav5Page.getByRole('button', { name: ja.cookNavi.build }).click()
      await nav5Page.waitForTimeout(600)
      const body5 = await nav5Page.textContent('body')
      check(
        'NAVI-05 待ちが見つからない組み合わせでは理由を正直に出す',
        body5.includes('この2品では、手が空く待ち時間が見つかりませんでした。1品ずつ作る順番で表示します。'),
        body5.slice(0, 200),
      )
      check(
        'NAVI-05 次にどうすれば段取りが作れるかも書く',
        body5.includes(ja.cookNavi.noParallelHint),
      )
      check(
        'NAVI-05 正直表示の枠が出ている',
        (await nav5Page.locator('[data-testid="navi-no-parallel"]').count()) === 1,
      )
      const cards5 = await nav5Page.$$eval('ol > li', (lis) => lis.map((li) => li.textContent || ''))
      check(
        'NAVI-05 1品ずつ完結する並びになる(和えもの→炒めもの)',
        cards5.length === 4 &&
          cards5[0].includes('E2Eナビ和えもの') &&
          cards5[1].includes('E2Eナビ和えもの') &&
          cards5[2].includes('E2Eナビ炒めもの') &&
          cards5[3].includes('E2Eナビ炒めもの'),
        `cards=${JSON.stringify(cards5.map((t) => t.slice(0, 20)))}`,
      )
      check(
        'NAVI-05 加熱で仕上げる温かい品を最後にまわす',
        cards5[cards5.length - 1].includes('E2Eナビ炒めもの'),
      )
      check(
        'NAVI-05 番号の意味も1品ずつ作る場合の説明に切り替わる',
        body5.includes(ja.cookNavi.sequentialOrderNote),
      )
    } finally {
      await nav5Browser.close()
    }
  }

  // --- KKNAVI-01（2026-08-24 便KK・オーナー裁定A案「レンジが1台なので縮みません」＝理由を出す）。
  //
  // 2026-08-23 便KDで電子レンジの二重予約を直した結果、**待ちはあるのにレンジが空かない**ために
  // 1品ずつへ落ちる組が出た（実データ C_時短の人 30品では、並行に組める組が385→371へ）。
  // それまで画面に出ていたのは「手が空く待ち時間が見つかりませんでした」の1文だけで、
  // 器具が理由のときも同じ文だった＝利用者が自分のレシピを疑う。
  //
  // 測るのは「**理由ごとに違う文が出るか**」。文言は ja.ts から組み立てて突き合わせる（書き写さない）---
  currentCheck = 'KKNAVI-01'
  {
    const kkNaviBrowser = await chromium.launch()
    const kkNaviContext = await kkNaviBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const kkNaviPage = await kkNaviContext.newPage()
    kkNaviPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin'))
        return
      errors.push(`[pageerror@KKNAVI-01] ${err.message}`)
    })
    try {
      await kkNaviPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await kkNaviPage.waitForTimeout(1800)
      await kkNaviPage.evaluate(async () => {
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
        // 電子レンジしか使わない2品。レンジは1台なので、2品目は1品目が終わるまで始められない
        const idA = await P(store('recipes').add(mk('E2Eレンジ蒸し野菜', [
          { text: '耐熱ボウルに野菜を入れ、ラップをかけて電子レンジで15分加熱する。', minutes: 15 },
        ])))
        const idB = await P(store('recipes').add(mk('E2Eレンジ肉じゃが', [
          { text: '耐熱皿に材料を入れ、ラップをかけて電子レンジで15分加熱する。', minutes: 15 },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await kkNaviPage.goto(`${BASE}/#/cook-navi`)
      await kkNaviPage.reload({ waitUntil: 'networkidle' })
      await kkNaviPage.waitForTimeout(1200)
      await kkNaviPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await kkNaviPage.waitForTimeout(600)
      const kkNaviBody = stripZwspText(await kkNaviPage.textContent('body'))
      const kkExpected = ja.cookNavi.noParallelByApplianceNote
        .replace('{appliance}', ja.settings.kitchenMicrowave)
        .replace('{n}', '2')
      check(
        'KKNAVI-01 レンジ2品では、器具の名前を出して理由を書く',
        kkNaviBody.includes(kkExpected),
        `画面=${kkNaviBody.slice(0, 240)}`,
      )
      check(
        'KKNAVI-01 「待ち時間が見つかりませんでした」の文はもう出さない（理由が違うので嘘になる）',
        !kkNaviBody.includes(ja.cookNavi.noParallelNote.replace('{n}', '2')),
      )
      check(
        'KKNAVI-01 正直表示の枠そのものは出ている',
        (await kkNaviPage.locator('[data-testid="navi-no-parallel"]').count()) === 1,
      )
    } finally {
      await kkNaviBrowser.close()
    }
  }

  // --- NAVI-06: 取り込み時の分数自動入力(2026-08-08 便ED・docs/68 打ち手#2)。
  //     貼り付け取り込みは手順の「分」の欄が必ず空になり、本文に「15分煮る」と書いてあっても
  //     タイマーにも並行調理ナビにも使えていなかった。本文にある時間を「分」の欄へ写し、
  //     自動で入れたことが分かる表示が出て、書き換え・削除ができることを実UIで確認する ---
  currentCheck = 'NAVI-06'
  {
    const nav6Browser = await chromium.launch()
    const nav6Context = await nav6Browser.newContext({ viewport: { width: 390, height: 820 } })
    const nav6Page = await nav6Context.newPage()
    nav6Page.on('dialog', (dialog) => dialog.accept())
    nav6Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-06] ${err.message}`)
    })
    try {
      await nav6Page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await nav6Page.waitForTimeout(1500)
      await nav6Page.getByText(ja.paste.open).click()
      await nav6Page.waitForTimeout(300)
      await nav6Page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
        'E2E分数自動入力レシピ\n\n材料（2人分）\n・大根　1/4本\n・しょうゆ　大さじ2\n\n作り方\n1. 大根を切る\n2. 鍋に入れて15分煮る\n3. 器に盛る',
      )
      await nav6Page.getByRole('button', { name: ja.paste.apply }).click()
      await nav6Page.waitForTimeout(400)
      const minutesInputs = nav6Page.locator(`input[aria-label="${ja.form.stepMinutes}"]`)
      check(
        'NAVI-06 本文の「15分」が手順2の分数欄に入る',
        (await minutesInputs.nth(1).inputValue()) === '15',
        `値=${await minutesInputs.nth(1).inputValue()}`,
      )
      check(
        'NAVI-06 時間の書かれていない手順の分数欄は空のまま(推測値を入れない)',
        (await minutesInputs.nth(0).inputValue()) === '' &&
          (await minutesInputs.nth(2).inputValue()) === '',
      )
      const body6 = await nav6Page.textContent('body')
      check(
        'NAVI-06 自動で入れた分数であることが手順に表示される',
        body6.includes(ja.form.stepMinutesAuto),
      )
      // 2026-08-25 便KW・①: 件数の一言は結果の並びから外した（同じことを、直した手順の
      // その場（step-minutes-auto）が言っている＝黙って落としたのではない）
      check(
        'NAVI-06 結果の並びは件数の一言を繰り返さない（印は手順のその場に出る）',
        !body6.includes('本文の時間を「分」の欄に入れました'),
      )
      check(
        'NAVI-06 自動入力の印は1件だけ(時間のある手順のみ)',
        (await nav6Page.locator('[data-testid="step-minutes-auto"]').count()) === 1,
      )
      // 消せる: 分数欄を空にすると印も消える(ユーザーが保存前に直せる)
      await minutesInputs.nth(1).fill('')
      await nav6Page.waitForTimeout(300)
      check(
        'NAVI-06 分数を消すと自動入力の印も消える',
        (await nav6Page.locator('[data-testid="step-minutes-auto"]').count()) === 0,
      )
      // 直せる: 別の値を入れても印は出ない(ユーザーが入れた分数として扱う)
      await minutesInputs.nth(1).fill('8')
      await nav6Page.waitForTimeout(300)
      check(
        'NAVI-06 分数を書き換えると自動入力の印は出ない',
        (await nav6Page.locator('[data-testid="step-minutes-auto"]').count()) === 0 &&
          (await minutesInputs.nth(1).inputValue()) === '8',
      )
      // 手順の本文は書き換えていない(転記だけ)
      const stepTexts = await nav6Page.$$eval('textarea', (els) => els.map((e) => e.value))
      check(
        'NAVI-06 手順の本文は1文字も書き換えない',
        stepTexts.includes('鍋に入れて15分煮る'),
        `textareas=${JSON.stringify(stepTexts.slice(0, 5))}`,
      )
    } finally {
      await nav6Browser.close()
    }
  }

  // --- NAVI-07/08/09: 便ED第2段(2026-08-08 オーナー実機フィードバック)。
  //     NAVI-07 画面を移動しても作りかけの段取りが残る／「戻る」で終わる
  //     NAVI-08 ナビから始めたタイマーは、別の画面から押してもナビの該当手順へ戻る＋
  //             ハイライトが2秒で消える（タイマーを消しても色が戻らない不具合の回帰防止）
  //     NAVI-09 「まとめて作った！」で3品まとめて記録＋トーストの「元に戻す」で戻せる ---
  currentCheck = 'NAVI-07'
  {
    const nav7Browser = await chromium.launch()
    const nav7Context = await nav7Browser.newContext({ viewport: { width: 390, height: 820 } })
    const nav7Page = await nav7Context.newPage()
    let confirmText = ''
    await collectConfirms(nav7Page, (text) => {
      confirmText = text
    })
    nav7Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-07] ${err.message}`)
    })
    try {
      await nav7Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nav7Page.waitForTimeout(1800)
      await nav7Page.evaluate(async () => {
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
        // 「2秒煮る」= TimeTextの「2秒」ボタンで短いタイマーを起動できる
        const idA = await P(store('recipes').add(mk('E2E保持煮物', [
          { text: '材料を切る' }, { text: '鍋に入れて2秒煮る', minutes: 1 }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('E2E保持サラダ', [
          { text: '野菜を切る' }, { text: 'ドレッシングと和える' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await nav7Page.goto(`${BASE}/#/cook-navi`)
      await nav7Page.reload({ waitUntil: 'networkidle' })
      await nav7Page.waitForTimeout(1200)
      await nav7Page.getByRole('button', { name: ja.cookNavi.build }).click()
      await nav7Page.waitForTimeout(600)
      check(
        'NAVI-07 段取りが作れる',
        (await nav7Page.textContent('body')).includes('組み合わせる2品'),
      )
      // 別のタブへ移動して戻る＝段取りが残っている（作り直しにならない）
      await nav7Page.goto(`${BASE}/#/recipes`)
      await nav7Page.waitForTimeout(600)
      await nav7Page.goto(`${BASE}/#/cook-navi`)
      await nav7Page.waitForTimeout(900)
      check(
        'NAVI-07 画面を移動して戻っても段取りが残っている',
        (await nav7Page.textContent('body')).includes('組み合わせる2品'),
        (await nav7Page.textContent('body')).slice(0, 160),
      )

      // NAVI-08: ナビから2秒タイマーを起動→別の画面へ→完了タイマーをタップ→ナビへ戻る
      currentCheck = 'NAVI-08'
      await nav7Page.getByRole('button', { name: new RegExp(`2秒 ${reEscape(ja.timer.start)}`) }).first().click()
      await nav7Page.waitForTimeout(300)
      await nav7Page.goto(`${BASE}/#/shopping`)
      await nav7Page.waitForTimeout(500)
      await nav7Page.waitForSelector('div.fixed button.border-warning', { timeout: 8000 })
      await nav7Page.locator('div.fixed button.border-warning').first().click()
      await nav7Page.waitForTimeout(400)
      // 2026-08-11 便FO: 帯は窓を開くだけになったので、移動は窓の「手順◯を開く」から
      await nav7Page
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: TIMER_BACK_LINK_RE })
        .click()
      await nav7Page.waitForTimeout(900)
      check(
        'NAVI-08 別の画面から完了タイマーを押すとナビへ戻る(レシピ詳細へ飛ばない)',
        nav7Page.url().includes('/cook-navi') && !/#\/recipes\/\d+/.test(nav7Page.url()),
        `url=${nav7Page.url()}`,
      )
      check(
        'NAVI-08 戻ったナビに段取りが残っている(最初からになっていない)',
        (await nav7Page.textContent('body')).includes('組み合わせる2品'),
      )
      check(
        'NAVI-08 該当手順カードがハイライトされる',
        (await nav7Page.locator('li[class*="ring-2"]').count()) >= 1,
      )
      // ハイライトは2秒で消える（タイマーを消しても色が戻らない不具合の回帰防止）
      await nav7Page.waitForTimeout(2600)
      check(
        'NAVI-08 ハイライトは2秒ほどで消える(色が付いたまま残らない)',
        (await nav7Page.locator('li[class*="ring-2"]').count()) === 0,
      )

      // NAVI-09: まとめて作った！
      currentCheck = 'NAVI-09'
      await nav7Page.getByRole('button', { name: ja.cookNavi.markAllCooked }).click()
      await nav7Page.waitForTimeout(900)
      check(
        'NAVI-09 確認文に数・料理名・何が変わるかが書かれている(規約F)',
        hasCount(confirmText, 2) &&
          confirmText.includes('E2E保持煮物') &&
          confirmText.includes(ja.cookNavi.markAllCookedConfirm.split('。')[0].replace('{n}', '2')) &&
          confirmText.includes('記録をつける'),
        confirmText.slice(0, 200),
      )
      // 2026-08-12 便FX・オーナー指摘「まとめて作った！ので注意書きが出るなら、後から
      // 記録一覧から個別に編集できることをひとこと添えて」
      check(
        'FX-06 「まとめて作った！」の確認にも、あとから1件ずつ編集できることが書いてある',
        confirmText.includes(ja.cookNavi.markAllCookedConfirmEdit.trim()),
        confirmText.slice(0, 300),
      )
      const afterCooked = await nav7Page.textContent('body')
      check(
        'NAVI-09 数つきのトーストが出る',
        jaRe(ja.cookNavi.markAllCookedToast, { n: '2\\s*' }).test(afterCooked),
        afterCooked.slice(0, 120),
      )
      const cookedCount = await nav7Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const all = await new Promise((res, rej) => {
          const r = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        idb.close()
        return all.filter((r) => r.title.startsWith('E2E保持') && r.cookedLogs.length > 0).length
      })
      check('NAVI-09 2品とも作った記録が付く', cookedCount === 2, `記録が付いた品=${cookedCount}`)
      check(
        'NAVI-09 記録したら段取りは終わる(選び直しの状態に戻る)',
        !afterCooked.includes('組み合わせる2品'),
      )
      // トーストの「元に戻す」で記録を取り消せる
      await nav7Page.getByRole('button', { name: '元に戻す' }).click()
      await nav7Page.waitForTimeout(800)
      const undoneCount = await nav7Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const all = await new Promise((res, rej) => {
          const r = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
        idb.close()
        return all.filter((r) => r.title.startsWith('E2E保持') && r.cookedLogs.length > 0).length
      })
      check('NAVI-09 「元に戻す」で記録が取り消される', undoneCount === 0, `残った記録=${undoneCount}`)
      check(
        'NAVI-09 取り消した件数がトーストに出る',
        jaRe(ja.cookNavi.markAllCookedUndone, { n: '2\\s*' }).test(
          await nav7Page.textContent('body'),
        ),
      )

      // 「戻る」は画面を移るだけ＝段取りは残る(2026-08-09 便ES・オーナー実機報告
      // 「段取りを作る→戻る→今日の献立画面（再開ボタンが出ない）→並行調理ナビ→段取りが消えている」)。
      // 段取りを終える操作は「レシピを選び直す」と「まとめて作った！」の2つだけ
      currentCheck = 'NAVI-07'
      await nav7Page.goto(`${BASE}/#/cook-navi`)
      await nav7Page.reload({ waitUntil: 'networkidle' })
      await nav7Page.waitForTimeout(1200)
      await nav7Page.getByRole('button', { name: ja.cookNavi.build }).click()
      await nav7Page.waitForTimeout(600)
      await nav7Page.getByRole('button', { name: ja.common.back }).first().click()
      await nav7Page.waitForTimeout(800)
      check(
        'NAVI-07 「戻る」で献立タブに戻ったとき、再開の入口が出ている',
        (await nav7Page.locator('[data-testid="navi-resume"]').count()) === 1,
        `url=${nav7Page.url()}`,
      )
      await nav7Page.goto(`${BASE}/#/cook-navi`)
      await nav7Page.waitForTimeout(900)
      check(
        'NAVI-07 「戻る」を押しても段取りは残る',
        (await nav7Page.textContent('body')).includes('組み合わせる2品'),
      )
      // 「レシピを選び直す」を押すと段取りは終わる(＝再開の入口も消える)
      await nav7Page.getByRole('button', { name: 'レシピを選び直す' }).click()
      await nav7Page.waitForTimeout(600)
      await nav7Page.goto(`${BASE}/#/meal-plan`)
      await nav7Page.waitForTimeout(900)
      check(
        'NAVI-07 「レシピを選び直す」を押すと再開の入口は消える',
        (await nav7Page.locator('[data-testid="navi-resume"]').count()) === 0,
      )
    } finally {
      await nav7Browser.close()
    }
  }

  // --- ES-01: 段取りが消える重大バグの再発防止(2026-08-09 便ES・オーナー実機報告)。
  //     「調理中モード→×で閉じる→他の画面→献立タブ→ナビ再開」「段取りを作ったあと画面を
  //     離れて再開」「実行中のタイマーが終了」の3経路で、段取りが消えず単品レシピにも飛ばないこと。
  //     再現の肝は**今日の献立が「今週の献立の予定」だけで組まれている**状態。今日の献立リスト・
  //     今週の予定・レシピ本体は別々に読み込まれ、予定の読み込みだけが遅れる一瞬に
  //     「今日の献立が空になった」と読み違えて選択を全部捨てていた ---
  currentCheck = 'ES-01'
  {
    const esBrowser = await chromium.launch()
    const esContext = await esBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const esPage = await esContext.newPage()
    esPage.on('dialog', (dialog) => void dialog.accept())
    esPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@ES-01] ${err.message}`)
    })
    // 2026-08-12 便FT: 作りかけの段取りの覚え書きは localStorage（端末に残る側）へ移した
    const esSession = () =>
      esPage.evaluate(() => localStorage.getItem('uchi-recipe-cook-navi-session'))
    try {
      await esPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await esPage.waitForTimeout(1800)
      await esPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('ES予定煮物', [
          { text: '材料を切る' }, { text: '鍋に入れて2秒煮る', minutes: 10 }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('ES予定サラダ', [
          { text: '野菜を切る' }, { text: 'ドレッシングと和える' },
        ])))
        // 今日の献立は「今週の献立の予定」だけで組む(todayList には1件も入れない)
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        await P(store('mealPlans').add({ date: today, slot: 'dinner', recipeId: idA, role: 'main' }))
        await P(store('mealPlans').add({ date: today, slot: 'dinner', recipeId: idB, role: 'side' }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await esPage.goto(`${BASE}/#/cook-navi`)
      await esPage.reload({ waitUntil: 'networkidle' })
      await esPage.waitForTimeout(1400)
      await esPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await esPage.waitForTimeout(700)
      check(
        'ES-01 今週の献立の予定だけでも段取りが作れる',
        (await esPage.textContent('body')).includes('組み合わせる2品'),
      )

      // 経路①: 調理中モードを開いて×で閉じる→別の画面→献立タブ→再開
      await esPage.locator('[data-testid="cook-session-start"]').click()
      await esPage.waitForTimeout(600)
      check('ES-01 調理中モードが開く', (await esPage.locator('[data-testid="cook-session"]').count()) === 1)
      await esPage.locator('[data-testid="cook-session-close"]').click()
      await esPage.waitForTimeout(700)
      await esPage.locator('a[href="#/recipes"]').first().click()
      await esPage.waitForTimeout(700)
      await esPage.locator('a[href="#/meal-plan"]').first().click()
      await esPage.waitForTimeout(1100)
      check(
        'ES-01 調理中モードを×で閉じたあとも、献立タブに再開の入口が出る',
        (await esPage.locator('[data-testid="navi-resume"]').count()) === 1,
      )
      await esPage.locator('[data-testid="navi-resume"]').click()
      await esPage.waitForTimeout(1200)
      const esAfterSession = await esPage.textContent('body')
      check('ES-01 再開したナビに段取りが残っている', esAfterSession.includes('組み合わせる2品'))
      check(
        'ES-01 「今日の献立にない品を…外しました」が出ない(選択を捨てていない)',
        (await esPage.locator('[data-testid="navi-selection-dropped"]').count()) === 0,
      )

      // 経路②: 画面を離れて再開(読み込みの競争が毎回起きる冷えた状態を3回繰り返す)
      for (let i = 0; i < 3; i++) {
        await esPage.reload({ waitUntil: 'domcontentloaded' })
        await esPage.waitForTimeout(1300)
      }
      check(
        'ES-01 画面を離れて再開しても段取りが消えない(3回繰り返しても同じ)',
        (await esPage.textContent('body')).includes('組み合わせる2品') &&
          (await esPage.locator('[data-testid="navi-selection-dropped"]').count()) === 0,
        `session=${await esSession()}`,
      )

      // 経路③: 実行中のタイマーが終了→常駐バーの完了タイマーを押す→ナビの段取りへ戻る
      currentCheck = 'ES-02'
      await esPage.getByRole('button', { name: new RegExp(`2秒 ${reEscape(ja.timer.start)}`) }).first().click()
      await esPage.waitForTimeout(300)
      await esPage.goto(`${BASE}/#/shopping`)
      await esPage.waitForTimeout(500)
      await esPage.waitForSelector('div.fixed button.border-warning', { timeout: 8000 })
      await esPage.locator('div.fixed button.border-warning').first().click()
      await esPage.waitForTimeout(400)
      // 2026-08-11 便FO: 帯は窓を開くだけになったので、移動は窓の「手順◯を開く」から
      await esPage
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: TIMER_BACK_LINK_RE })
        .click()
      await esPage.waitForTimeout(1200)
      check(
        'ES-02 タイマー終了後のタップは段取りへ戻る(単品レシピの手順へ飛ばない)',
        esPage.url().includes('/cook-navi') && !/#\/recipes\/\d+/.test(esPage.url()),
        `url=${esPage.url()}`,
      )
      check(
        'ES-02 戻った先に段取りが残っている',
        (await esPage.textContent('body')).includes('組み合わせる2品'),
      )

      // 経路④: 「出ていないこと」の対（2026-08-29 便MO）。
      // 上の3経路は知らせが**出ない**ことしか見ていなかったので、src の目印を
      // navi-selection-droppedZZ に改名しても ES-01・ES-02 は 8/8件のまま緑だった（同日に実測）。
      // **本当に品が落ちたときは出る**ことを同じ節で一度だけ確かめて対にする。
      // ここは節のいちばん最後なので、後ろの判定を巻き添えにしない。
      // 作り方: 選んでいた2品のうち副菜を今日の献立から消す（週の予定と今日の献立の両方から。
      // 週の予定の品は今日の献立にも写されるので、片方だけ消しても候補に残る）
      currentCheck = 'ES-01'
      await esPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const recipes = await P(db.transaction('recipes').objectStore('recipes').getAll())
        const sideId = recipes.find((r) => r.title === 'ES予定サラダ')?.id
        for (const table of ['mealPlans', 'todayList']) {
          const rows = await P(db.transaction(table).objectStore(table).getAll())
          const store = db.transaction(table, 'readwrite').objectStore(table)
          for (const row of rows.filter((x) => x.recipeId === sideId)) await P(store.delete(row.id))
        }
        db.close()
      })
      // 生のIndexedDBへ書いたので、読み込み直したところで見る（禁じ手⑥）。
      // 別のタブで開くのは、全画面を開いているかどうかがタブごと（sessionStorage）だから
      // ＝調理中は記録を段取りへ逆流させない決まりがあり、開いたままだと突き合わせが働かない。
      // 覚えていた選択（localStorage）と献立（IndexedDB）はタブをまたいで同じものを見る
      const esTab2 = await esContext.newPage()
      esTab2.on('dialog', (dialog) => void dialog.accept())
      esTab2.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@ES-01] ${err.message}`)
      })
      await esTab2.goto(`${BASE}/#/cook-navi`, { waitUntil: 'networkidle' })
      await esTab2.waitForTimeout(1800)
      check(
        'ES-01 今日の献立から品が消えたときは「外しました」を黙って済ませない(出る側)',
        (await esTab2.locator('[data-testid="navi-selection-dropped"]').count()) === 1,
        `body=${((await esTab2.textContent('body')) ?? '').replace(/\u200B/g, '').slice(0, 200)}`,
      )
    } finally {
      await esBrowser.close()
    }
  }
