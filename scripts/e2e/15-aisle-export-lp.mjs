// ==========================================================================================
// e2e の節: 売り場・書き出し・紹介ページ/追加方法ページ
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
// この中の節: DY-01, DY-02, DY-03, EE-01, EI-01, EL-01, EL-02, EL-03, EL-06, EL-04, EL-05, EN-01, EN-02, RECIPEEXPORT-EM, LPTEXT-EP, INSTALLTEXT-EP, NOINSTALLFREE-EP, SHOTSIZE-EP, NOTABWORD-EP, SHOTMARK-EP
// ==========================================================================================
import './_shared.mjs'


  // --- DY-01: 買い物メモの売り場ブロック(2026-08-08 オーナー実機フィードバック①)。
  // 「売り場順ごとに食材をブロック分けして表示して。たくさんの食材が羅列していて見づらい」。
  // 売り場名+件数の見出しつきの塊に分かれること、中身が0件の売り場は出ないこと、
  // ブロックを跨いだ並びは従来の売り場順のままであること。
  // あわせて、手で足した食材の出所の小窓が「自分で追加」を出すこと(FB②の一部)も見る ---
  currentCheck = 'DY-01'
  {
    const dyBrowser = await chromium.launch()
    const dyContext = await dyBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dyPage = await dyContext.newPage()
    dyPage.on('dialog', (dialog) => dialog.accept())
    dyPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DY-01] ${err.message}`)
    })
    try {
      await dyPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await dyPage.waitForTimeout(1800)
      await dyPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await dyPage.waitForTimeout(400)
      // わざと売り場順と違う順で手入力する(調味料→野菜→肉→野菜)
      for (const name of ['しょうゆ', '玉ねぎ', '豚こま切れ肉', 'にんじん']) {
        await dyPage.getByPlaceholder(ja.shopping.manualPlaceholder).fill(name)
        await dyPage.getByRole('button', { name: '追加', exact: true }).click()
        await dyPage.waitForTimeout(350)
      }
      // ブロックの見出し(売り場名・件数)は、各リストの直前の要素にある
      const dyBlocks = () =>
        dyPage.evaluate(() =>
          Array.from(document.querySelectorAll('ul.divide-y')).map((ul) => {
            const spans = ul.previousElementSibling
              ? Array.from(ul.previousElementSibling.querySelectorAll('span'))
              : []
            return {
              group: spans[0]?.textContent ?? '',
              count: spans[1]?.textContent ?? '',
              names: Array.from(ul.querySelectorAll('li > button > span.font-bold')).map(
                (el) => el.textContent,
              ),
            }
          }),
        )
      const blocks = await dyBlocks()
      check(
        'DY-01 売り場名の見出しが売り場順に並び、中身が0件の売り場(豆腐卵乳・主食粉・その他)は出ない',
        JSON.stringify(blocks.map((b) => b.group)) ===
          JSON.stringify(['野菜・きのこ', '肉・魚介', '調味料']),
        JSON.stringify(blocks.map((b) => b.group)),
      )
      check(
        'DY-01 見出しにそのブロックの件数が出る',
        JSON.stringify(blocks.map((b) => b.count)) === JSON.stringify(['2件', '1件', '1件']),
        JSON.stringify(blocks.map((b) => b.count)),
      )
      check(
        'DY-01 ブロックを跨いだ並びは従来の売り場順のまま(グループ内は追加順)',
        JSON.stringify(blocks.flatMap((b) => b.names)) ===
          JSON.stringify(['玉ねぎ', 'にんじん', '豚こま切れ肉', 'しょうゆ']),
        JSON.stringify(blocks.flatMap((b) => b.names)),
      )
      // チェックを入れても、買ったものが別枠へ飛ばずそのブロックに残る
      await dyPage.getByRole('button', { name: ja.shopping.toggleCheck, exact: true }).first().click()
      await dyPage.waitForTimeout(400)
      const afterCheck = await dyBlocks()
      check(
        'DY-01 チェック済みも元の売り場ブロックに残る(並びが変わらない)',
        JSON.stringify(afterCheck.flatMap((b) => b.names)) ===
          JSON.stringify(['玉ねぎ', 'にんじん', '豚こま切れ肉', 'しょうゆ']),
        JSON.stringify(afterCheck.flatMap((b) => b.names)),
      )

      // 手で足した食材の出所は「自分で追加」と正直に出す
      await dyPage.getByRole('button', { name: ja.shopping.memoSourceOpen }).first().click()
      await dyPage.waitForTimeout(350)
      const dyManualPopup = dyPage.getByRole('dialog')
      check(
        'DY-01 手で足した食材の小窓は「自分で追加」を出す',
        (await dyManualPopup.isVisible()) &&
          ((await dyManualPopup.textContent()) ?? '').includes('自分で追加'),
        (await dyManualPopup.textContent()) ?? '(小窓が出ていない)',
      )
      await dyPage.keyboard.press('Escape')
      await dyPage.waitForTimeout(250)
    } finally {
      await dyBrowser.close()
    }
  }

  // --- DY-02: 買い物メモの出所の小窓(2026-08-08 オーナー実機フィードバック②)。
  // 「食材をタップしたら、どのレシピから登録したのか確認できるように小窓出して欲しい」。
  // レシピから確定した行をタップすると、レシピ名とそのレシピでの分量が出て、
  // レシピ名からレシピ詳細へ移動できること ---
  currentCheck = 'DY-02'
  {
    const dsBrowser = await chromium.launch()
    const dsContext = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dsPage = await dsContext.newPage()
    dsPage.on('dialog', (dialog) => dialog.accept())
    dsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DY-02] ${err.message}`)
    })
    try {
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(1800)
      await dsPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(500)
      await dsPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await dsPage.waitForTimeout(300)
      await dsPage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await dsPage.waitForTimeout(500)
      // ピッカーの先頭のレシピを1食で選ぶ(料理名は小窓の照合に使う)。
      // 2026-08-19 便HW: ピッカーの行を共通のレシピカード(「標準」)に寄せたので、
      // 「span.line-clamp-2」のような**置き場所への固定**をやめ、
      // 「食数を増やす」ボタンと同じ行(li)にある料理名として掴む(CLAUDE.md 禁じ手④)
      const dsTitle = await dsPage.evaluate(() => {
        const plus = [...document.querySelectorAll('button')].find(
          (b) => b.getAttribute('aria-label') === '食数を増やす',
        )
        const li = plus?.closest('li')
        const title = li?.querySelector('p')
        return title?.textContent?.replace(/\u200B/g, '').trim() ?? ''
      })
      await dsPage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await dsPage.waitForTimeout(250)
      await dsPage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await dsPage.waitForTimeout(600)
      await dsPage.getByRole('button', { name: ja.shopping.addConfirmed, exact: true }).click()
      await dsPage.waitForTimeout(700)

      // 買い物メモの先頭の食材をタップ→出所の小窓
      await dsPage.getByRole('button', { name: ja.shopping.memoSourceOpen }).first().click()
      await dsPage.waitForTimeout(400)
      const dsPopup = dsPage.getByRole('dialog')
      const dsPopupText = (await dsPopup.textContent()) ?? ''
      check(
        'DY-02 買い物メモの食材タップで出所の小窓が出る',
        (await dsPopup.isVisible()) && dsPopupText.includes(ja.shopping.memoSourceTitle),
        dsPopupText,
      )
      check(
        'DY-02 小窓に、その食材を追加したレシピ名が出る',
        dsTitle.length > 0 && dsPopupText.includes(dsTitle),
        `title=${dsTitle} popup=${dsPopupText}`,
      )
      // レシピ名の右にそのレシピでの分量が並ぶ(数量+単位。「少々」等もありうるので存在だけ見る)
      const dsRow = dsPopup.locator('li a')
      check(
        'DY-02 小窓のレシピ名はレシピ詳細へのリンクになっている',
        (await dsRow.count()) === 1 &&
          ((await dsRow.first().getAttribute('href')) ?? '').includes('/recipes/'),
        (await dsRow.first().getAttribute('href')) ?? '(リンクなし)',
      )
      check(
        'DY-02 小窓に手入力の印(自分で追加)は出ない(レシピ由来の行なので)',
        !dsPopupText.includes('自分で追加'),
        dsPopupText,
      )
      // レシピ名を押すとレシピ詳細へ移動する
      await dsRow.first().click()
      await dsPage.waitForTimeout(900)
      check(
        'DY-02 小窓のレシピ名からレシピ詳細へ移動できる',
        dsPage.url().includes('/recipes/') &&
          ((await dsPage.textContent('body')) ?? '').includes(dsTitle),
        dsPage.url(),
      )
    } finally {
      await dsBrowser.close()
    }
  }

  // --- DY-03: タイマー音の音量・鳴る長さ(2026-08-08 オーナー実機フィードバック③)。
  // 「タイマー音量や長さは、設定から調整や確認できるようにしたい」。
  // 設定「料理中」の「タイマー音」から音量3段階・長さ3段階を選べ、その場で試聴でき、
  // 選択が保存され、タイマー音をOFFにすると触れなくなること ---
  currentCheck = 'DY-03'
  {
    const dtBrowser = await chromium.launch()
    const dtContext = await dtBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const dtPage = await dtContext.newPage()
    dtPage.on('dialog', (dialog) => dialog.accept())
    dtPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      // 音の出せない実行環境(ヘッドレス)のAudioContext関連は本筋ではないので拾わない
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      if (text.includes('AudioContext') || text.includes('audio')) return
      errors.push(`[console@DY-03] ${text}`)
    })
    dtPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DY-03] ${err.message}`)
    })
    const readTimerSound = () =>
      dtPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const s = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return { volume: s?.timerSoundVolume, length: s?.timerSoundLength }
      })
    try {
      await dtPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await dtPage.waitForTimeout(1800)
      const dtBody = (await dtPage.textContent('body')) ?? ''
      check(
        'DY-03 タイマー音に音量・鳴る長さ・試聴ボタンがある',
        dtBody.includes('音量') && dtBody.includes('鳴る長さ') && dtBody.includes(ja.settings.timerSoundPreview),
      )
      check(
        'DY-03 鳴る長さの選択肢は秒数で書かれている(約1秒/約3秒/約5秒)',
        dtBody.includes('約1秒') && dtBody.includes('約3秒') && dtBody.includes('約5秒'),
      )
      // 初期状態は従来の音(ふつう・約1秒)が選ばれている＝既存ユーザーの音を勝手に変えない
      check(
        `DY-03 初期は従来の音(${ja.settings.timerSoundVolumeNormal}・約1秒)が選ばれている`,
        (await dtPage
          .getByRole('button', { name: ja.settings.timerSoundVolumeNormal, exact: true })
          .getAttribute('aria-pressed')) ===
          'true' &&
          (await dtPage.getByRole('button', { name: '約1秒', exact: true }).getAttribute('aria-pressed')) ===
            'true',
      )
      check('DY-03 初期は設定に何も保存されていない(既定のまま)', JSON.stringify(await readTimerSound()) === JSON.stringify({}), JSON.stringify(await readTimerSound()))

      await dtPage.getByRole('button', { name: '大きめ', exact: true }).click()
      await dtPage.waitForTimeout(400)
      await dtPage.getByRole('button', { name: '約3秒', exact: true }).click()
      await dtPage.waitForTimeout(400)
      check(
        'DY-03 選んだ音量・長さが設定に保存される',
        JSON.stringify(await readTimerSound()) ===
          JSON.stringify({ volume: 'high', length: 'medium' }),
        JSON.stringify(await readTimerSound()),
      )
      // 試聴ボタンはエラーにならず押せる(音そのものは実行環境に依存するので押せることだけ見る)
      await dtPage.getByRole('button', { name: ja.settings.timerSoundPreview, exact: true }).click()
      await dtPage.waitForTimeout(500)

      await dtPage.reload({ waitUntil: 'networkidle' })
      await dtPage.waitForTimeout(1500)
      check(
        'DY-03 リロードしても選択が維持される',
        (await dtPage.getByRole('button', { name: '大きめ', exact: true }).getAttribute('aria-pressed')) ===
          'true' &&
          (await dtPage.getByRole('button', { name: '約3秒', exact: true }).getAttribute('aria-pressed')) ===
            'true',
      )

      // タイマー音をOFFにすると音量・長さ・試聴は触れなくなり、理由が出る
      await dtPage.getByRole('switch', { name: ja.settings.timerSoundTitle, exact: true }).click()
      await dtPage.waitForTimeout(500)
      check(
        'DY-03 タイマー音をOFFにすると音量・長さ・試聴が押せなくなる',
        (await dtPage.getByRole('button', { name: '大きめ', exact: true }).isDisabled()) &&
          (await dtPage.getByRole('button', { name: '約3秒', exact: true }).isDisabled()) &&
          (await dtPage.getByRole('button', { name: ja.settings.timerSoundPreview, exact: true }).isDisabled()),
      )
      check(
        'DY-03 押せない理由が書かれている(無言で灰色にしない)',
        ((await dtPage.textContent('body')) ?? '').includes(
          '「タイマー音」をオンにすると、音量と鳴る長さを選べます',
        ),
      )
    } finally {
      await dtBrowser.close()
    }
  }

  // --- EE-01: 買い物メモの3件(2026-08-08 オーナー実機フィードバック)。
  //  ② ごはん→お米換算: 「牛丼」(ご飯2杯分)から下書きを作ると「米 140g」で出る
  //  ⑤ チェックした食材を下にまとめるスイッチ: 既定OFF・ONで「チェック済み」ブロックへ移る・
  //     設定に保存されリロードしても維持される・買い物メモから件数は減らない
  //  ③④ 買い物完了の確認: ボタンごとに行が分かれ、「あとにする」は何も書き換えない ---
  currentCheck = 'EE-01'
  {
    const eeBrowser = await chromium.launch()
    const eeContext = await eeBrowser.newContext()
    const eePage = await eeContext.newPage()
    eePage.on('dialog', (dialog) => dialog.accept())
    eePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EE-01] ${err.message}`)
    })
    try {
      await eePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eePage.waitForTimeout(1800)
      await eePage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await eePage.waitForTimeout(400)
      await eePage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await eePage.waitForTimeout(300)

      // ② ごはん→お米換算
      await eePage.getByRole('button', { name: ja.shopping.fromRecipeTitle, exact: true }).click()
      await eePage.waitForTimeout(400)
      await eePage.getByPlaceholder(ja.search.placeholder).fill('牛丼')
      await eePage.waitForTimeout(500)
      await eePage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await eePage.getByRole('button', { name: ja.shopping.pickerServingUp }).first().click()
      await eePage.waitForTimeout(200)
      await eePage.getByRole('button', { name: ja.shopping.makeCandidates }).click()
      await eePage.waitForTimeout(600)
      const eeDraft = eePage.locator('section', { hasText: ja.shopping.candidateTitle })
      const eeDraftText = (await eeDraft.textContent()) ?? ''
      check(
        'EE-01(②) 下書きの食材名が「ご飯」ではなく「米」になる',
        eeDraftText.includes('米') && !eeDraftText.includes('ご飯'),
        `下書き=${eeDraftText.slice(0, 160)}`,
      )
      const eeRiceAmount = await eeDraft
        .locator('li', { hasText: '米' })
        .first()
        .locator('textarea')
        .inputValue()
      check(
        'EE-01(②) 生米のグラム(炊きあがり300g÷2.2→140g)で出る',
        eeRiceAmount === '140g',
        `分量=${eeRiceAmount}`,
      )
      await eePage.getByRole('button', { name: ja.shopping.addConfirmed }).click()
      await eePage.waitForTimeout(600)

      // ⑤ チェックした食材を下にまとめるスイッチ
      const eeSwitch = eePage.getByRole('switch', { name: ja.shopping.checkedAtBottomLabel })
      check('EE-01(⑤) スイッチは既定でOFF', (await eeSwitch.getAttribute('aria-checked')) === 'false')
      const eeMemoSection = eePage.locator('section', { hasText: '買い物メモ' }).first()
      const eeRowCount = await eeMemoSection.locator('ul > li').count()
      // 1件だけカゴに入れる
      await eePage.locator('[aria-label="チェックの切り替え"]').first().click()
      await eePage.waitForTimeout(300)
      check(
        'EE-01(⑤) OFFのあいだはチェック済みも売り場ブロックに残る(従来どおり)',
        (await eePage.locator('[data-testid="memo-checked-block"]').count()) === 0,
      )
      await eeSwitch.click()
      await eePage.waitForTimeout(400)
      const eeCheckedBlock = eePage.locator('[data-testid="memo-checked-block"]')
      check('EE-01(⑤) ONでチェック済みブロックが下に出る', (await eeCheckedBlock.count()) === 1)
      check(
        'EE-01(⑤) チェック済みブロックに移るだけで件数は減らない',
        (await eeMemoSection.locator('ul > li').count()) === eeRowCount,
        `件数=${await eeMemoSection.locator('ul > li').count()} / 元=${eeRowCount}`,
      )
      check(
        'EE-01(⑤) チェック済みブロックの中身は1件',
        (await eeCheckedBlock.locator('li').count()) === 1,
      )
      await eePage.reload({ waitUntil: 'networkidle' })
      await eePage.waitForTimeout(1200)
      await eePage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await eePage.waitForTimeout(400)
      check(
        'EE-01(⑤) スイッチの状態は設定に保存されリロードしても維持される',
        (await eePage
          .getByRole('switch', { name: ja.shopping.checkedAtBottomLabel })
          .getAttribute('aria-checked')) === 'true' &&
          (await eePage.locator('[data-testid="memo-checked-block"]').count()) === 1,
      )

      // ③④ 買い物完了の確認モーダル
      await eePage.getByRole('button', { name: ja.shopping.complete, exact: true }).click()
      await eePage.waitForTimeout(400)
      const eeDialog = eePage.getByRole('dialog', { name: ja.shopping.completeConfirmTitle })
      const eeDialogText = (await eeDialog.innerText()) ?? ''
      // 2026-08-26 便LI（オーナー指示・書き溜め0826）: 「「反映せず完了」を押すと〜」は削除した
      // （ボタンの名前で意味が分かる＝規約Fの例外）。在庫に入るほうの結果だけを行で書く
      check(
        'EE-01(③) 確認は「反映する」を押したときの結果を行で書く',
        eeDialogText.includes('「反映する」を押すと'),
        `本文=${eeDialogText.slice(0, 200)}`,
      )
      check(
        'EE-01(③・便LI) 「反映せず完了」の説明は並べ立てない',
        !eeDialogText.includes('「反映せず完了」を押すと'),
        `本文=${eeDialogText.slice(0, 200)}`,
      )
      check(
        'EE-01(③) 消える件数と残る件数を両方書く(規約F)',
        /チェック済みの1件は買い物メモから消えます/.test(eeDialogText) &&
          /未チェックの\d+件は買い物メモに残ります/.test(eeDialogText),
      )
      // 2026-08-26 便LI（オーナー指示・書き溜め0826「ボタンの名前で意味がわかるため、
      // 説明文２つも削除」）: 「あとにする」の下の説明2行は出さない。押しても何も書き換えない
      // ことは、下の実挙動の検査がそのまま見張る
      check(
        'EE-01(④・便LI) 「あとにする」の下に説明文を出していない',
        !eeDialogText.includes('「あとにする」を押すと') &&
          !eeDialogText.includes('「買い物完了」を押して「反映する」を選びます'),
        `本文=${eeDialogText.slice(-200)}`,
      )
      check(
        'EE-01(④・便LI) ボタン「あとにする」自体は残っている',
        (await eePage.getByRole('button', { name: ja.shopping.completeLater, exact: true }).count()) === 1,
      )
      // 実挙動: 「あとにする」は買い物メモも在庫も書き換えない
      const eePantryBefore = await eePage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const get = (name) => new Promise((res, rej) => { const r = idb.transaction(name, 'readonly').objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const out = { pantry: (await get('pantryItems')).length, memo: (await get('shoppingItems')).length }
        idb.close()
        return out
      })
      await eePage.getByRole('button', { name: ja.shopping.completeLater, exact: true }).click()
      await eePage.waitForTimeout(600)
      const eePantryAfter = await eePage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const get = (name) => new Promise((res, rej) => { const r = idb.transaction(name, 'readonly').objectStore(name).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const items = await get('shoppingItems')
        const out = { pantry: (await get('pantryItems')).length, memo: items.length, checked: items.filter((i) => i.isChecked).length }
        idb.close()
        return out
      })
      check(
        'EE-01(④) 「あとにする」は買い物メモも食材の在庫も1件も書き換えない',
        eePantryAfter.memo === eePantryBefore.memo &&
          eePantryAfter.pantry === eePantryBefore.pantry &&
          eePantryAfter.checked === 1,
        `前=${JSON.stringify(eePantryBefore)} 後=${JSON.stringify(eePantryAfter)}`,
      )
      // トーストが自動で消えるのを待ってから押し直す(下部の固定トーストがボタンに重なるため)
      await eePage.waitForTimeout(6500)
      check(
        'EE-01(④) 書いてあるとおり「買い物完了」を押し直すと同じ確認が出る',
        await (async () => {
          await eePage.getByRole('button', { name: ja.shopping.complete, exact: true }).click()
          await eePage.waitForTimeout(400)
          return eePage.getByRole('dialog', { name: ja.shopping.completeConfirmTitle }).isVisible()
        })(),
      )
      await eePage.keyboard.press('Escape')
      await eePage.waitForTimeout(200)

      // ⑦ 設定のタイマー音: 音が鳴るボタンの注意書き
      await eePage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await eePage.waitForTimeout(1500)
      // 2026-08-28 便MC: 文言を書き写していたので ja.ts から読む形にした（禁じ手②）。
      // オーナー指示で2文目（「音を鳴らして確かめる」の説明）を消したときに、
      // 書き写しのままだとここが赤くなるだけで、何を見張っていたのかが分からなくなる
      check(
        'EE-01(⑦) 音量・鳴る長さのボタンでは鳴らない、という注意書きが出ている',
        stripZwspText((await eePage.textContent('body')) ?? '').includes(
          ja.settings.timerSoundPreviewNote,
        ),
      )

      // ① 月タブ: 畳んだままでも数値が読める。
      // 月タブはPro機能なので、他のブロックと同じやり方で先に解錠しておく
      // (未解錠だと月タブはPro案内に差し替わり、食費カードそのものが存在しない)
      await eePage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const cur = (await P(idb.transaction('settings', 'readonly').objectStore('settings').get(1))) || { id: 1 }
        await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        idb.close()
      })
      await eePage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await eePage.reload({ waitUntil: 'networkidle' })
      await eePage.waitForTimeout(1800)
      await eePage.getByRole('button', { name: '月', exact: true }).first().click()
      await eePage.waitForTimeout(1200)
      const eeCostCardBtn = eePage.getByRole('button', { name: /月の食費/ })
      await eeCostCardBtn.waitFor({ state: 'visible', timeout: 15000 })
      check(
        'EE-01(①) 月の食費カードは畳まれたまま',
        (await eeCostCardBtn.getAttribute('aria-expanded')) === 'false',
      )
      // 献立も記録も無い月なので数値は出ないが、畳んだ側にも理由が書かれている
      check(
        'EE-01(①) 数字が無い月は、畳んだままでも理由が読める',
        ((await eePage.textContent('body')) ?? '').includes(
          'この月には、作った記録も登録した献立もまだありません',
        ),
      )
      // 献立を1枠入れると、畳んだままでも金額が出る
      await eePage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
        const all = await P(idb.transaction('recipes', 'readonly').objectStore('recipes').getAll())
        const target = all.find((r) => (r.ingredients?.length ?? 0) > 3)
        const d = new Date()
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        await P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').add({ date: iso, slot: 'dinner', recipeId: target.id, role: 'main' }))
        idb.close()
      })
      await eePage.reload({ waitUntil: 'networkidle' })
      await eePage.waitForTimeout(1800)
      await eePage.getByRole('button', { name: '月', exact: true }).first().click()
      await eePage.waitForTimeout(1200)
      await eePage.locator('[data-testid="month-cost-folded"]').waitFor({ state: 'visible', timeout: 15000 })
      const eeFolded = eePage.locator('[data-testid="month-cost-folded"]')
      const eeFoldedText = (await eeFolded.count()) ? await eeFolded.innerText() : ''
      check(
        // 2026-08-19 便HV・⑨: 畳んだ側は「食費の合計」1つだけ(オーナー指示)
        // 2026-08-20 便IG・⑬: その金額は見出しの横に出る(行の名前「全員分」は開いたときの表に任せた)
        'EE-01(①・便HV) 畳んだままでも食費の合計が読める',
        /約[\d,]+円/.test(eeFoldedText),
        `畳んだ食費=${eeFoldedText.replace(/\n/g, ' / ')}`,
      )
      check(
        'EE-01(①) 畳んだ数値は、開いたときの表と同じ金額を出す',
        await (async () => {
          const folded = (eeFoldedText.match(/約[\d,]+円/g) ?? [])[0]
          await eeCostCardBtn.click()
          await eePage.waitForTimeout(500)
          const table = (await eePage.locator('[data-testid="month-cost-table"]').innerText()) ?? ''
          return !!folded && table.includes(folded)
        })(),
      )
    } finally {
      await eeBrowser.close()
    }
  }

  // --- EI-01: 日本語入力の変換確定Enterのガードの適用漏れ(2026-08-09 便EI)。
  // 2026-08-02にレシピ登録画面で直した「変換確定のEnterで行/タグが増える」が、
  // ChipInput(レシピタブの絞り込み「使いたい食材」)・在庫ボードの食材追加欄・
  // 設定のNG食材の3箇所に当たっていなかった。FORMING-01(d)と同じやり方で、
  // isComposing=true のEnterを直接dispatchして「増えないこと」と「確定後は増えること」を見る。
  // あわせて設定「うちレシピについて」に足した「ホーム画面への追加方法」の導線も確かめる ---
  currentCheck = 'EI-01'
  {
    const eiBrowser = await chromium.launch()
    const eiContext = await eiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const eiPage = await eiContext.newPage()
    eiPage.on('dialog', (dialog) => dialog.accept())
    eiPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EI-01] ${err.message}`)
    })
    /** IMEで変換中に押したEnter(isComposing=true)を、指定の入力欄へそのまま流し込む */
    const imeEnter = (selector) =>
      eiPage.evaluate((sel) => {
        document
          .querySelector(sel)
          .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }))
      }, selector)
    try {
      // (a) ChipInput: レシピタブの絞り込みパネル「使いたい食材」
      await eiPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eiPage.waitForTimeout(1800) // 初回シード完了待ち
      await eiPage.locator('button[aria-label="絞り込み"]').click()
      await eiPage.waitForTimeout(400)
      const chipSel = 'input[placeholder="食材を1つずつ入力"]'
      const chipCount = () => eiPage.getByRole('button', { name: ja.chip.remove }).count()
      await eiPage.fill(chipSel, 'たまねぎ')
      await imeEnter(chipSel)
      await eiPage.waitForTimeout(400)
      check(
        'EI-01(a) ChipInput 変換確定のEnterではチップにならない',
        (await chipCount()) === 0 && (await eiPage.inputValue(chipSel)) === 'たまねぎ',
        `チップ${await chipCount()}件 / 欄の値=${await eiPage.inputValue(chipSel)}`,
      )
      await eiPage.press(chipSel, 'Enter')
      await eiPage.waitForTimeout(400)
      check(
        'EI-01(a) ChipInput 確定後のEnterでは従来どおりチップになる',
        (await chipCount()) === 1 && (await eiPage.inputValue(chipSel)) === '',
        `チップ${await chipCount()}件 / 欄の値=${await eiPage.inputValue(chipSel)}`,
      )

      // (b) 在庫ボード: 食材タブの「よく使う食材」追加欄。増減はIndexedDBの実データで見る
      const pantryCount = () =>
        eiPage.evaluate(async () => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((res, rej) => {
            req.onsuccess = () => res(req.result)
            req.onerror = () => rej(req.error)
          })
          const items = await new Promise((res, rej) => {
            const r = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
            r.onsuccess = () => res(r.result)
            r.onerror = () => rej(r.error)
          })
          idb.close()
          return items.length
        })
      await eiPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await eiPage.waitForTimeout(1200)
      const pantrySel = 'input[placeholder="例: 豚肉"]'
      const beforePantry = await pantryCount()
      await eiPage.fill(pantrySel, 'ずいき')
      await imeEnter(pantrySel)
      await eiPage.waitForTimeout(600)
      check(
        'EI-01(b) 在庫ボード 変換確定のEnterでは食材が増えない',
        (await pantryCount()) === beforePantry && (await eiPage.inputValue(pantrySel)) === 'ずいき',
        `件数 ${beforePantry}→${await pantryCount()} / 欄の値=${await eiPage.inputValue(pantrySel)}`,
      )
      await eiPage.press(pantrySel, 'Enter')
      await eiPage.waitForTimeout(800)
      check(
        'EI-01(b) 在庫ボード 確定後のEnterでは従来どおり食材が増える',
        (await pantryCount()) === beforePantry + 1 && (await eiPage.inputValue(pantrySel)) === '',
        `件数 ${beforePantry}→${await pantryCount()} / 欄の値=${await eiPage.inputValue(pantrySel)}`,
      )

      // (c) 設定のNG食材
      await eiPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await eiPage.waitForTimeout(1200)
      const ngSel = 'input[placeholder="例: えび"]'
      const ngCount = () => eiPage.getByRole('button', { name: ja.settings.ngRemove }).count()
      const beforeNg = await ngCount()
      await eiPage.fill(ngSel, 'かき')
      await imeEnter(ngSel)
      await eiPage.waitForTimeout(500)
      check(
        'EI-01(c) 設定のNG食材 変換確定のEnterでは増えない',
        (await ngCount()) === beforeNg && (await eiPage.inputValue(ngSel)) === 'かき',
        `件数 ${beforeNg}→${await ngCount()} / 欄の値=${await eiPage.inputValue(ngSel)}`,
      )
      await eiPage.press(ngSel, 'Enter')
      await eiPage.waitForTimeout(600)
      check(
        'EI-01(c) 設定のNG食材 確定後のEnterでは従来どおり増える',
        (await ngCount()) === beforeNg + 1 && (await eiPage.inputValue(ngSel)) === '',
        `件数 ${beforeNg}→${await ngCount()} / 欄の値=${await eiPage.inputValue(ngSel)}`,
      )

      // (d) 設定「うちレシピについて」の「ホーム画面への追加方法」(便EIの導線追加)。
      // ブラウザのタブで開いている状態＝アイコン起動ではないので出る
      const installLink = eiPage.locator('[data-testid="settings-install-link"]')
      // 2026-08-28 便LW: リンクに帰り先（?from=）が載るようになったので、**行き先のパス**で見る
      // （完全一致だと帰り先の有無で落ちる。帰り先そのものの見張りは LW-01・LW-2）
      const eiInstallHref = (await installLink.getAttribute('href')) ?? ''
      check(
        'EI-01(d) 設定に「ホーム画面への追加方法」のリンクがある',
        (await installLink.count()) === 1 &&
          eiInstallHref.split('?')[0] === '/about/install.html' &&
          stripZwspText(await installLink.innerText()).includes(ja.settings.installPageLink),
        `件数=${await installLink.count()} href=${eiInstallHref}`,
      )
      check(
        'EI-01(d) 先に追加したほうがよい理由(iOSでデータが分かれる)が添えてある',
        ((await eiPage.textContent('body')) ?? '').includes(
          'iPhone・iPadでは、Safariで登録したレシピと、ホーム画面のアイコンから開いたときのレシピが別々に保存されます',
        ),
      )
      const installRes = await eiPage.request.get(`${BASE}/about/install.html`)
      check('EI-01(d) リンク先の手順ページが開ける', installRes.status() === 200, `status=${installRes.status()}`)
    } finally {
      await eiBrowser.close()
    }
  }


  // --- EL-01〜06: 並行調理ナビの「調理中セッション」(2026-08-09 便EL・docs/69 第1段) ---
  //     EL-01 「調理をはじめる」で全画面が開き、現在手順1枚＋ほかの品の次の手順が1行ずつ出る
  //     EL-02 次へ／前へでカーソルが1つずつ動き、下部の投影も一緒に動く（手順飛ばしが起きない）
  //     EL-03 下部の行をタップしても現在手順は変わらない（全文が出るだけ）
  //     EL-04 **調理中に1品へ「作った記録」が付いても段取りが変わらない**（記録は一方通行）。
  //           終えたあとは、今日の献立から外れた品が従来どおり候補から落ちる
  //           （2026-08-11 便FN: 落ちる理由を「記録が付いた」から「今日の献立に無い」へそろえた）
  //     EL-05 覚えていた手順が段取りに見つからないときは、推測せず一覧に戻して理由を出す
  //     EL-06 この画面から単品レシピ詳細へ離脱する導線が無い
  currentCheck = 'EL-01'
  {
    const elBrowser = await chromium.launch()
    const elContext = await elBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const elPage = await elContext.newPage()
    elPage.on('dialog', (d) => void d.accept())
    elPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EL] ${err.message}`)
    })
    elPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@EL] ${t}`)
    })
    const counter = () => elPage.locator('[data-testid="cook-session-counter"]').innerText()
    const rowTexts = () =>
      elPage.locator('[data-testid="cook-session-other-row"]').allInnerTexts()
    try {
      await elPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await elPage.waitForTimeout(1800)
      const ids = await elPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('EL照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('EL煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、味をしみ込ませてから器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('ELマリネ', [
          { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
          { text: 'パプリカときゅうりを細切りにする。' },
          { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
        ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return { idA, idB, idC }
      })

      await elPage.goto(`${BASE}/#/cook-navi`)
      await elPage.reload({ waitUntil: 'networkidle' })
      await elPage.waitForTimeout(1200)
      await elPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await elPage.waitForTimeout(700)
      check(
        'EL-01 段取りの一覧に「調理中モードで見る」の入口がある',
        (await elPage.locator('[data-testid="cook-session-start"]').count()) === 1,
      )
      await elPage.locator('[data-testid="cook-session-start"]').click()
      await elPage.waitForTimeout(600)
      check(
        'EL-01 全画面の調理中セッションが開く',
        (await elPage.locator('[data-testid="cook-session"]').count()) === 1,
      )
      const first = await counter()
      check('EL-01 段取りの先頭から始まる', /^段取り 1\//.test(first), `表示=${first}`)
      const rows1 = await rowTexts()
      check(
        'EL-01 ほかの2品の次の手順が1行ずつ出る',
        rows1.length === 2,
        `行数=${rows1.length} / ${JSON.stringify(rows1)}`,
      )
      // どの品が先頭に来るかは段取り次第なので、品名で決め打ちしない
      // （2026-08-14 便GK。混在手順を割るようになって並びが変わり、決め打ちが落ちた。
      //   CLAUDE.md「要素の置き場所への固定」＝どこに出ていても同じ判定になる形にする）
      const elLongSteps = [
        'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。',
        '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。',
      ]
      check(
        'EL-01 長い手順は「文頭…文末」に畳んで1行に収める',
        rows1.some((t) => t.includes('…')) && !rows1.some((t) => elLongSteps.some((s) => t.includes(s))),
        JSON.stringify(rows1),
      )
      const elOpenTitle = (await elPage.locator('[data-testid="cook-session-recipe"]').innerText()).trim()
      check(
        'EL-01 いま開いている品は下部に出さない',
        elOpenTitle !== '' && !rows1.some((t) => t.includes(elOpenTitle)),
        `開いている品=${elOpenTitle} / ${JSON.stringify(rows1)}`,
      )

      // EL-02: 次へ→前へで元の手順に帰る（手順飛ばし・戻り先の誤りが起きない）
      currentCheck = 'EL-02'
      await elPage.locator('[data-testid="cook-session-next"]').click()
      await elPage.waitForTimeout(400)
      const second = await counter()
      check('EL-02 「次へ」で1つ進む', second === first.replace('1/', '2/'), `${first}→${second}`)
      await elPage.getByRole('button', { name: ja.focus.prev }).click()
      await elPage.waitForTimeout(400)
      check('EL-02 「前へ」で元の手順に帰る', (await counter()) === first, `表示=${await counter()}`)
      check(
        'EL-02 下部の行も元に戻る（戻り先が別の手順にならない）',
        JSON.stringify(await rowTexts()) === JSON.stringify(rows1),
      )
      // 下部の行は「カーソルの投影」なので、別の品の手順を通り過ぎたときに動く
      // （同じ品の中を進んでいる間は、ほかの品の次の手順は変わらないのが正しい）
      const recipeTitle = () => elPage.locator('[data-testid="cook-session-recipe"]').innerText()
      const startTitle = await recipeTitle()
      for (let i = 0; i < 12 && (await recipeTitle()) === startTitle; i++) {
        await elPage.locator('[data-testid="cook-session-next"]').click()
        await elPage.waitForTimeout(300)
      }
      const movedTitle = await recipeTitle()
      const rows2 = await rowTexts()
      check('EL-02 別の品の手順に移る', movedTitle !== startTitle, `${startTitle}→${movedTitle}`)
      check(
        'EL-02 いま開いている品は下部から消える',
        // 行頭にはナビとレシピの2種類の番号が付く(便ES)。先頭一致だと必ず外れて
        // 「何も無いから合格」の素通りになるので、含むかどうかで見る
        !rows2.some((t) => t.includes(movedTitle)),
        JSON.stringify(rows2),
      )
      check(
        'EL-02 直前まで開いていた品が下部に出る（済んだ手順ではなく次の手順）',
        rows2.some((t) => t.includes(startTitle)) &&
          !rows2.some((t) => t.includes('大根は一口大に切る')),
        JSON.stringify(rows2),
      )

      // EL-03: 下部の行をタップしても現在手順は変わらない（見るだけ）
      currentCheck = 'EL-03'
      const beforePeek = await counter()
      await elPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await elPage.waitForTimeout(400)
      check(
        'EL-03 タップで手順の全文が出る',
        (await elPage.locator('[data-testid="cook-session-peek"]').count()) === 1,
      )
      check(
        'EL-03 全文を開いても調理中の手順は動かない',
        (await counter()) === beforePeek,
        `${beforePeek}→${await counter()}`,
      )
      // 2026-08-26 便LG・オーナー原文「「タップすると全文が出ます〜」削除。触ればわかること。」。
      // 便ES がここで見ていた見出し横の案内は消した。**戻っていないこと**を見る
      check(
        'LG-02 「タップすると全文が出ます〜」の案内は画面に出ていない（2026-08-26 オーナー指示で削除）',
        (await elPage.locator('[data-testid="cook-session-others-hint"]').count()) === 0 &&
          !stripZwspText(await elPage.textContent('body')).includes('タップすると全文が出ます'),
      )
      // 見出しは ja.ts から読む（書き写さない＝JM-2）。「品」から「レシピ」に変わったことは
      // 語そのもので見る＝文全体を書き写さずに、呼び名の入れ替わりだけを見張る
      check(
        `LG-02 見出しは「${ja.cookNavi.sessionOthersTitle}」（呼び名は「レシピ」）`,
        stripZwspText(
          await elPage.locator('[data-testid="cook-session-others"]').innerText(),
        ).includes(ja.cookNavi.sessionOthersTitle) &&
          ja.cookNavi.sessionOthersTitle.includes('レシピ') &&
          !ja.cookNavi.sessionOthersTitle.includes('品'),
        ja.cookNavi.sessionOthersTitle,
      )
      // LG-02: 枠の外を押しても閉じる（オーナー原文「もう一度タップの他に、エリア外をタップでも
      // 元の大きさに戻るようにして。」）。押す場所は上部の手順の枠＝行の外
      await elPage.locator('[data-testid="cook-session-step-text"]').click()
      await elPage.waitForTimeout(400)
      check(
        'LG-02 枠の外をタップすると開いていた全文が閉じる',
        (await elPage.locator('[data-testid="cook-session-peek"]').count()) === 0,
      )
      check(
        'LG-02 外をタップして閉じても調理中の手順は動かない',
        (await counter()) === beforePeek,
        `${beforePeek}→${await counter()}`,
      )
      // もう一度タップで閉じる道も今までどおり残っている
      await elPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await elPage.waitForTimeout(400)
      check(
        'LG-02 前提: もう一度開ける',
        (await elPage.locator('[data-testid="cook-session-peek"]').count()) === 1,
      )
      await elPage.locator('[data-testid="cook-session-other-row"]').first().click()
      await elPage.waitForTimeout(400)
      check(
        'LG-02 もう一度タップでも閉じる（今までどおり）',
        (await elPage.locator('[data-testid="cook-session-peek"]').count()) === 0,
      )

      // EL-06: この画面から単品レシピ詳細へ離脱する導線を置かない
      currentCheck = 'EL-06'
      check(
        'EL-06 調理中セッションの中にレシピ詳細への遷移が無い',
        (await elPage.locator('[data-testid="cook-session"] a').count()) === 0,
      )

      // EL-04: 調理中に1品へ「作った記録」が付いても段取りが変わらない（記録は一方通行）
      currentCheck = 'EL-04'
      await elPage.locator('[data-testid="cook-session-next"]').click()
      await elPage.waitForTimeout(300)
      await elPage.locator('[data-testid="cook-session-next"]').click()
      await elPage.waitForTimeout(400)
      const beforeCooked = await counter()
      // 「作った」を付ける経路（献立の作った！／全て作った！／ナビのまとめて作った！／
      // レシピ詳細の記録フォーム）は、**どれも記録と同時にその品を今日の献立から外す**。
      // 2026-08-11 便FN でその2つは意味が分かれた: 記録が付いているだけでは候補から落とさず、
      // 落ちる理由は「今日の献立に無いこと」になった（作り終えた品を自分で入れ直したら、
      // その日のうちにもう一度段取りを組める＝利用者テストで見つかったバグの修正）。
      // ここも実際の経路と同じ状態を作る＝記録を足し、同時に今日の献立から外す
      await elPage.evaluate(async (recipeId) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = db.transaction('recipes', 'readwrite').objectStore('recipes')
        const recipe = await P(store.get(recipeId))
        const now = new Date()
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        recipe.cookedLogs = [...(recipe.cookedLogs ?? []), { date: today }]
        await P(store.put(recipe))
        const list = db.transaction('todayList', 'readwrite').objectStore('todayList')
        for (const item of await P(list.getAll())) {
          if (item.recipeId === recipeId) await P(list.delete(item.id))
        }
        db.close()
      }, ids.idC)
      await elPage.reload({ waitUntil: 'networkidle' })
      await elPage.waitForTimeout(1500)
      check(
        'EL-04 記録が付いても調理中セッションは開いたまま復元される',
        (await elPage.locator('[data-testid="cook-session"]').count()) === 1,
      )
      check(
        'EL-04 調理中の手順が同じ位置に戻る（段取りが組み替わらない）',
        (await counter()) === beforeCooked,
        `${beforeCooked}→${await counter()}`,
      )
      check(
        'EL-04 記録が付いた品も段取りに残る（母集合は選んだ3品のまま）',
        ((await elPage.textContent('[data-testid="cook-session"]')) ?? '').includes('ELマリネ') ||
          (await rowTexts()).some((t) => t.includes('ELマリネ')),
        JSON.stringify(await rowTexts()),
      )
      // 一方通行が効く範囲は「全画面を開いている間」（2026-08-12 便FT で便ELの文面どおりに戻した）。
      // 便FCで位置を閉じても残すようにしたとき、ここは「位置が残っている＝まだ調理中」と
      // 読める形になっていたが、段取りと位置を端末に残すようになると
      // **一度でも調理中モードを開いたらその日いっぱい整合が働かない**ことになる。
      // ✕で閉じた時点で段取りの一覧に戻る＝そこは組み直した姿を見せる場所なので、そこで整える
      await elPage.locator('[data-testid="cook-session-close"]').click()
      await elPage.waitForTimeout(900)
      check(
        'EL-04 ✕で全画面が閉じる',
        (await elPage.locator('[data-testid="cook-session"]').count()) === 0,
      )
      check(
        'EL-04 閉じて一覧に戻ると、今日の献立から外れた品が組み合わせから落ちる',
        (await elPage.locator('[data-testid="navi-selection-dropped"]').count()) === 1,
        (await elPage.textContent('body')).includes('今日の献立にない品') ? '文言あり' : '文言なし',
      )
      await elPage.getByRole('button', { name: 'レシピを選び直す' }).click()
      await elPage.waitForTimeout(900)

      // EL-05: 覚えていた手順が段取りに無いときは推測せず一覧に戻す
      currentCheck = 'EL-05'
      await elPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await elPage.waitForTimeout(700)
      // 2026-08-12 便FT: 覚え書きの置き場が localStorage（端末に残る側）に移った
      await elPage.evaluate(() => {
        const key = 'uchi-recipe-cook-navi-session'
        const raw = JSON.parse(localStorage.getItem(key))
        localStorage.setItem(
          key,
          JSON.stringify({ ...raw, showTimeline: true, current: { recipeId: raw.selectedIds[0], stepIndex: 98 } }),
        )
      })
      await elPage.reload({ waitUntil: 'networkidle' })
      await elPage.waitForTimeout(1500)
      check(
        'EL-05 見つからない手順は推測せず、全画面を開かない',
        (await elPage.locator('[data-testid="cook-session"]').count()) === 0,
      )
      check(
        'EL-05 段取りの一覧に戻したことと理由を画面に出す',
        (await elPage.locator('[data-testid="cook-session-lost"]').count()) === 1 &&
          // 2026-08-25: 画面の日本語を書き写していた（禁じ手②）。便KTが
          // 「調理中だった手順」→「調理中モードで開いていた手順」に言い直した
          stripZwspText((await elPage.textContent('body')) ?? '').includes(
            stripZwspText(ja.cookNavi.sessionLost),
          ),
      )
    } finally {
      await elBrowser.close()
    }
  }

  // ============================================================================
  // 便EN（2026-08-09 オーナー実機）: 週タブの「選択と実行」の描き分け・条件の説明の出し方・
  // 鍵の見分け・週まとめの大きさ・記録写真の回転
  // ============================================================================

  // --- EN-01: 週タブ。①3グループとも既定で畳む ②畳んだままでも実行ボタンとPro行は見える
  //  ③選ぶチップと実行ボタンは見た目が違う（塗りつぶしは実行ボタンだけ・チップにはチェック印）
  //  ④条件の説明は、その条件を選んでいるあいだだけ出る
  //  ⑤「高たんぱく優先」の絞り込みは削除済み（2026-08-09 便EO・オーナー指示）
  //  ⑥鍵は掛けると塗りつぶしになる ⑦週まとめの栄養は日カードより大きい ---
  currentCheck = 'EN-01'
  {
    const enBrowser = await chromium.launch()
    const enContext = await enBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const enPage = await enContext.newPage()
    enPage.on('pageerror', (err) => errors.push(`[pageerror@EN-01] ${err.message}`))
    enPage.on('dialog', (d) => void d.accept())
    try {
      await enPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await enPage.waitForTimeout(1800)
      await enPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await enPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(enPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await enPage.waitForTimeout(600)

      // 2026-08-19 便IF・⑤⑥では「献立を提案」だけ既定で開いていた。
      // 2026-08-22 便IV（オーナー原文「でふぉるとで設定３種は、折りたたんだ表示にして」）で
      // **3つとも畳んだ状態から始まる**に戻した。実行ボタンは見出しの横に出ているので、
      // 畳んだままでも押すものは画面から消えない
      check(
        'EN-01(項目10→便IV) 週の操作3節は既定で全部畳んでいる',
        (await enPage.getByRole('button', { name: '表示のしかたを開く' }).count()) === 1 &&
          (await enPage.getByRole('button', { name: '献立を提案を開く' }).count()) === 1 &&
          (await enPage
            .getByRole('button', { name: `${ja.mealPlan.weekGroupTemplateTitle}を開く` })
            .count()) === 1,
      )
      check(
        'EN-01(項目10→便IF・⑥) 「まとめて献立を入力」は押せる位置にある',
        await enPage.locator('[data-testid="week-fill-run"]').isVisible(),
      )

      await openWeekGroup(enPage, ja.mealPlan.weekGroupAutoTitle)
      await enPage.locator('[data-testid="plan-conditions-open"]').click()
      await enPage.waitForTimeout(500)
      // 2026-08-19 便IF・②(オーナー原文「無料版でpro機能の案内が折りたたみでも表示されていて
      // 邪魔。しまって。」): 鍵付きの入口は条件の窓の中へ移した＝消してはいない(docs/62 決定②)
      check(
        'EN-01(項目10→便IF・②) 「栄養から組む（Pro）」の入口は、条件の窓の中に残っている',
        await enPage
          .locator('[data-testid="plan-conditions-modal"] [data-testid="purpose-locked-row"]')
          .isVisible(),
      )
      check(
        'EN-01(項目5) Proの入口の呼称が「栄養から組む」になっている（「目的」を使わない）',
        ((await enPage.locator('[data-testid="purpose-locked-row"]').textContent()) ?? '').includes(
          '栄養から組む',
        ),
      )

      // 2026-08-20 便II・①: 「優先します」→ 実装どおりの「◯分以内のレシピから選びます」。
      // 文言そのものは ja.ts から読む（画面の字を書き写さない）
      const enQuickHint = ja.mealPlan.quickOnlyHint.replace('{n}', '15')
      const enProteinHint = 'レシピに「高たんぱく」タグが付いた料理を優先します'
      const enBody = async () => (await enPage.textContent('body')) ?? ''
      /**
       * 説明の1行が**見えているか**。2026-08-19 便ID・④で、この1行は出ていないあいだも
       * 同じ場所を取る形（見えなくするだけ）になった＝窓の中身が伸び縮みしないようにするため。
       * よって「文字がDOMに無いこと」ではなく「見えていないこと」で測る（オーナーの不満は
       * 見た目の話＝選んでいないのに説明が読めること）。読めなければ null にして必ず落とす
       */
      const enQuickHintVisible = async () => {
        const loc = enPage.locator('[data-testid="plan-quick-hint"]')
        if ((await loc.count()) !== 1) return null
        return await loc.evaluate((el) => getComputedStyle(el).visibility !== 'hidden')
      }
      check(
        'EN-01(項目3) 調理時間を指定していないうちは説明を見せない',
        (await enQuickHintVisible()) === false,
        `見えている=${await enQuickHintVisible()}`,
      )
      // 2026-08-09 便EO(オーナー指示): 「高たんぱく優先」の絞り込みごと削除した。
      // 説明もチップも画面から消えていることを確かめる(項目2の後継)
      check(
        'EN-01(項目2→便EO) 「高たんぱく優先」のチップも説明も出さない(削除済み)',
        (await enPage.getByRole('button', { name: '高たんぱく優先', exact: true }).count()) === 0 &&
          !(await enBody()).includes(enProteinHint),
      )

      // 2026-08-20 便II・①: 調理時間はプルダウン1つになった
      const enQuick = enPage.locator('[data-testid="plan-quick-minutes"]')
      await enQuick.selectOption('15')
      await enPage.waitForTimeout(250)
      check(
        'EN-01(項目3) 調理時間を指定したときだけ、その条件の説明が出る',
        (await enQuickHintVisible()) === true && (await enBody()).includes(enQuickHint),
        `説明=${enQuickHint}`,
      )
      // 便II・①の要: 説明は「優先」ではなく実際の動き（外れる側）を言う
      check(
        'EN-01(便II・①) 説明は、調理時間を入れていないレシピが外れることまで言う',
        (await enBody()).includes('調理時間を入れていないレシピは選ばれません'),
      )
      // 項目1（2026-08-09 便EN「選んでいる条件のチップが実行ボタンと見分けが付かない」）は、
      // 条件がプルダウンになったことで**チップそのものが無くなった**＝塗りの見比べは要らない。
      // 見るのは「条件の欄が、実行ボタンと同じ塗りのボタンではないこと」に置き換える
      const enLook = await enPage.evaluate(() => {
        const fill = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'まとめて献立を入力',
        )
        const quick = document.querySelector('[data-testid="plan-quick-minutes"]')
        if (!fill || !quick) return null
        const cs = (el) => {
          const s = getComputedStyle(el)
          return { tag: el.tagName, bg: s.backgroundColor, color: s.color }
        }
        return { fill: cs(fill), quick: cs(quick) }
      })
      check(
        'EN-01(項目1→便II・①) 条件はプルダウンで、実行ボタンと同じ塗りにはならない',
        !!enLook && enLook.quick.tag === 'SELECT' && enLook.fill.bg !== enLook.quick.bg,
        `look=${JSON.stringify(enLook)}`,
      )
      await enQuick.selectOption('')
      await enPage.waitForTimeout(250)
      // 窓を閉じてから、後ろの画面の実行ボタンを押す（2026-08-19 便ID・④）
      await enPage.locator('[data-testid="plan-conditions-close"]').click()
      await enPage.waitForTimeout(500)

      await enPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await enPage.waitForTimeout(2500)

      const enLockBg = () =>
        enPage.evaluate(() => {
          const el = document.querySelector('[data-testid="day-lock"]')
          return el ? getComputedStyle(el).backgroundColor : 'none'
        })
      const enLockBefore = await enLockBg()
      await enPage.locator('[data-testid="day-lock"]').first().click()
      await enPage.waitForTimeout(800)
      const enLockAfter = await enLockBg()
      check(
        'EN-01(項目6) 鍵が外れているあいだは面を塗らない',
        enLockBefore === 'rgba(0, 0, 0, 0)' || enLockBefore === 'transparent',
        `before=${enLockBefore}`,
      )
      check(
        'EN-01(項目6) 鍵を掛けると塗りつぶしになる（外れているときと面の色が違う）',
        enLockAfter !== enLockBefore &&
          enLockAfter !== 'rgba(0, 0, 0, 0)' &&
          enLockAfter !== 'transparent',
        `before=${enLockBefore} after=${enLockAfter}`,
      )
      await enPage.locator('[data-testid="day-lock"]').first().click()
      await enPage.waitForTimeout(700)

      // 2026-08-25 便KU: 週まとめの栄養は節の中（既定は畳んである。節の名前は便LHで「栄養」）
      await openWeekGroup(enPage, ja.mealPlan.weekGroupNutritionTitle)
      await enPage.waitForTimeout(600)
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（便JM）
      const enPanel = await enPage.evaluate((weekToggleAria) => {
        const btns = [...document.querySelectorAll('button[aria-label]')]
        const week = btns.find(
          (b) => b.getAttribute('aria-label') === weekToggleAria,
        )
        const day = btns.find((b) => (b.getAttribute('aria-label') ?? '').startsWith('この日（'))
        if (!week || !day) return null
        const maxFont = (el) =>
          Math.max(
            ...[el, ...el.querySelectorAll('*')].map((n) =>
              parseFloat(getComputedStyle(n).fontSize),
            ),
          )
        return {
          weekFont: maxFont(week),
          dayFont: maxFont(day),
          weekHeight: Math.round(week.getBoundingClientRect().height),
          dayHeight: Math.round(day.getBoundingClientRect().height),
        }
      }, ja.nutritionBalance.weekToggleExpand)
      check(
        'EN-01(項目9) 週まとめの栄養は日ごとの栄養より文字が大きい',
        !!enPanel && enPanel.weekFont > enPanel.dayFont,
        `panel=${JSON.stringify(enPanel)}`,
      )
      check(
        'EN-01(項目9) 週まとめの栄養は日ごとの栄養より縦幅が大きい',
        !!enPanel && enPanel.weekHeight > enPanel.dayHeight,
        `panel=${JSON.stringify(enPanel)}`,
      )
    } finally {
      await enBrowser.close()
    }
  }

  // --- EN-02: 記録した写真の回転（2026-08-09 オーナー要望「記録した写真を回転させることは可能?」）。
  // 記録窓で写真を付けて右に90度ずつ回すと縦横が入れ替わり、4回で元の向きに戻る。
  // 保存済みの記録も編集フォームから回して保存し直せる。 ---
  currentCheck = 'EN-02'
  {
    const { deflateSync } = await import('node:zlib')
    // 横長(400x200)のPNGをその場で作る。回すと 200x400 になるので向きが数字で分かる
    const enCrcTable = (() => {
      const t = new Int32Array(256)
      for (let n = 0; n < 256; n++) {
        let c = n
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
        t[n] = c
      }
      return t
    })()
    const enCrc32 = (buf) => {
      let c = 0xffffffff
      for (const b of buf) c = enCrcTable[(c ^ b) & 0xff] ^ (c >>> 8)
      return (c ^ 0xffffffff) >>> 0
    }
    const enPngChunk = (type, data) => {
      const len = Buffer.alloc(4)
      len.writeUInt32BE(data.length)
      const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
      const crc = Buffer.alloc(4)
      crc.writeUInt32BE(enCrc32(body))
      return Buffer.concat([len, body, crc])
    }
    const enMakePng = (width, height) => {
      const raw = Buffer.alloc((width * 3 + 1) * height)
      let p = 0
      for (let y = 0; y < height; y++) {
        raw[p++] = 0
        for (let x = 0; x < width; x++) {
          const left = x < width / 2
          raw[p++] = left ? 220 : 40
          raw[p++] = left ? 90 : 120
          raw[p++] = left ? 30 : 200
        }
      }
      const ihdr = Buffer.alloc(13)
      ihdr.writeUInt32BE(width, 0)
      ihdr.writeUInt32BE(height, 4)
      ihdr[8] = 8
      ihdr[9] = 2
      return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        enPngChunk('IHDR', ihdr),
        enPngChunk('IDAT', deflateSync(raw)),
        enPngChunk('IEND', Buffer.alloc(0)),
      ])
    }

    const roBrowser = await chromium.launch()
    const roContext = await roBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const roPage = await roContext.newPage()
    roPage.on('pageerror', (err) => errors.push(`[pageerror@EN-02] ${err.message}`))
    try {
      await roPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await roPage.waitForTimeout(1800)
      await roPage
        .locator('a[href*="#/recipes/"]')
        .filter({ hasText: 'カレーライス' })
        .first()
        .click()
      await roPage.waitForTimeout(1200)
      await roPage.getByRole('button', { name: '作った！', exact: true }).first().click()
      await roPage.waitForTimeout(700)
      await roPage
        .locator('div[role="dialog"] input[type="file"]')
        .last()
        .setInputFiles({
          name: 'e2e-rotate.png',
          mimeType: 'image/png',
          buffer: enMakePng(400, 200),
        })
      await roPage.waitForTimeout(1300)
      const roSize = () =>
        roPage.evaluate(() => {
          const img = document.querySelector('div[role="dialog"] img')
          return img ? `${img.naturalWidth}x${img.naturalHeight}` : 'none'
        })
      const roBefore = await roSize()
      check('EN-02 記録窓に付けた写真は横長のまま取り込まれる', roBefore === '400x200', `size=${roBefore}`)
      const roRotate = roPage.getByRole('button', { name: ja.detail.cookedLogPhotoRotate })
      check('EN-02 記録窓に「写真を右に90度回す」がある', await roRotate.isVisible())
      await roRotate.click()
      await roPage.waitForTimeout(1300)
      const roOnce = await roSize()
      check(
        'EN-02 1回押すと縦横が入れ替わる（横長→縦長）',
        roOnce === '200x400',
        `before=${roBefore} after=${roOnce}`,
      )
      for (let i = 0; i < 3; i++) {
        await roRotate.click()
        await roPage.waitForTimeout(1100)
      }
      const roBack = await roSize()
      check(
        'EN-02 4回押すと元の向きに戻る（オーナー確認事項）',
        roBack === roBefore,
        `before=${roBefore} after4=${roBack}`,
      )

      // 保存済みの記録でも同じ操作ができる（編集フォームから回して保存し直す）
      await roPage.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await roPage.waitForTimeout(1800)
      // 記録一覧のサムネイル（タップで原寸表示になるボタンの中の画像）で向きを見る
      const roLogSize = () =>
        roPage.evaluate(() => {
          const img = document.querySelector('button[aria-label="写真を拡大表示"] img')
          return img ? `${img.naturalWidth}x${img.naturalHeight}` : 'none'
        })
      const roLogBefore = await roLogSize()
      check(
        'EN-02 記録した写真が一覧のサムネイルに出る（保存直後は横長）',
        roLogBefore === '400x200',
        `size=${roLogBefore}`,
      )
      await roPage.getByRole('button', { name: ja.detail.cookedLogEdit }).first().click()
      await roPage.waitForTimeout(700)
      const roEditRotate = roPage.getByRole('button', { name: ja.detail.cookedLogPhotoRotate })
      check('EN-02 保存済みの記録の編集にも回転ボタンがある', await roEditRotate.isVisible())
      await roEditRotate.click()
      await roPage.waitForTimeout(1300)
      check(
        'EN-02 回しただけでは残らないことを画面で伝える（規約H）',
        ((await roPage.textContent('body')) ?? '').includes(
          '回した向きは「保存する」を押すと残ります',
        ),
      )
      await roPage.getByRole('button', { name: '保存する', exact: true }).first().click()
      await roPage.waitForTimeout(1800)
      const roLogAfter = await roLogSize()
      check(
        'EN-02 保存すると回した向きが記録に残る（縦横が入れ替わる）',
        roLogAfter === '200x400',
        `before=${roLogBefore} after=${roLogAfter}`,
      )
    } finally {
      await roBrowser.close()
    }
  }


  // --- RECIPEEXPORT-EM: 「選択したレシピの書き出し」(2026-08-09 便EM。2026-08-02 オーナー決定
  // 「バックアップの内容分割は見送り・選択レシピの書き出しが代替」)。
  // 確かめること:
  //  (a) レシピ一覧の「選択」に書き出しボタンが出て、確認が規約F(入るもの/入らないもの)を満たす
  //      (2026-08-15 便GVで、確認は素のダイアログから画面の中の窓へ移った)
  //  (b) 書き出したファイルは選んだ品だけで、設定(=Pro解錠コード)も他テーブルも入っていない
  //  (c) 書き出しても端末のレシピは1品も減らない
  //  (d) そのファイルが既存の読み込み経路(設定「バックアップを読み込む」→「今のデータに追加」)に
  //      そのまま載る＝消したレシピが戻る（新しい読み込み口を作っていないことの確認） ---
  currentCheck = 'RECIPEEXPORT-EM'
  {
    const reBrowser = await chromium.launch()
    try {
      const reContext = await reBrowser.newContext({ acceptDownloads: true })
      const rePage = await reContext.newPage()
      rePage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@RECIPEEXPORT-EM] ${err.message}`)
      })
      let lastDialog = ''
      await collectConfirms(rePage, (text) => {
        lastDialog = text
      })

      await rePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rePage.waitForTimeout(1800) // 初回シード完了待ち

      // Pro解錠コードを入れておく(書き出したファイルに混ざらないことを確かめるため)。
      // 実際の販売コードは台帳の原本なので、他チェックと同じくsettingsへ直書きで再現する
      await rePage.evaluate(async () => {
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
            store.put({ ...current, id: 1, proCode: 'UR-E2E-EXPORT-ONLY', proActivatedAt: Date.now() })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })
      await rePage.reload({ waitUntil: 'networkidle' })
      await rePage.waitForTimeout(1200)

      // 検索で対象を絞ってから「選択」→「全選択」。絞った結果の枚数がそのまま書き出す品数になる
      await rePage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await rePage.waitForTimeout(700)
      // 右下の新規登録ボタン(#/recipes/new)も同じ入れ子に居るので数から外す
      const reCardSel = 'main a[href^="#/recipes/"]:not([href$="/new"])'
      const rePicked = await rePage.locator(reCardSel).count()
      check('RECIPEEXPORT-EM 前提: 検索で対象を絞れている', rePicked > 0 && rePicked < 10, `件数=${rePicked}`)
      const rePickedTitles = await rePage.locator(reCardSel).locator('h3, p.font-bold').allTextContents()

      await rePage.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
      await rePage.waitForTimeout(400)
      await rePage.getByRole('button', { name: '全選択', exact: true }).click()
      await rePage.waitForTimeout(400)

      // 2026-08-17 便HJ: 書き出しは「選び終わる」を押した先の窓の中の道の1つになった
      await rePage.getByTestId('selection-finish').click()
      await rePage.waitForTimeout(400)
      const reExportBtn = rePage.getByTestId('selection-actions-export')
      check(
        'RECIPEEXPORT-EM(a) 選び終わったあとの窓に「ファイルに書き出す」が出る',
        (await reExportBtn.isVisible()) &&
          ((await rePage.getByTestId('selection-actions').innerText()) ?? '').includes(
            `選んだ${rePicked}品`,
          ),
        await rePage.getByTestId('selection-actions').innerText().catch(() => ''),
      )

      // 2026-08-15 便GV: 確認はブラウザの素のダイアログから画面の中の窓へ移した
      // (オーナー実機「文章が長い。箇条書きや太字で読みやすくして」。素のダイアログでは
      // 太字も箇条書きも作れない)。押す→中身を作る→窓→保存、の順になる
      await reExportBtn.click()
      await rePage.waitForTimeout(1000)
      const reConfirm = rePage.getByTestId('recipes-export-confirm')
      check('RECIPEEXPORT-EM(a) 確認は画面の中の窓で出る(素のポップアップを出さない)', await reConfirm.isVisible())
      check(
        'RECIPEEXPORT-EM(a) 書き出しでブラウザの素のダイアログを出さない',
        lastDialog === '',
        lastDialog,
      )
      const reConfirmText = (await reConfirm.innerText()) ?? ''

      // (a) 確認の中身(規約F): 入るもの・入らないもの・端末のレシピが減らないこと・戻し方
      check(
        'RECIPEEXPORT-EM(a) 確認に「入るもの」と「入らないもの」が両方ある',
        reConfirmText.includes('入るもの') && reConfirmText.includes('入らないもの'),
        reConfirmText,
      )
      // 「設定」は戻し方の補足(設定の「バックアップを読み込む」)にも出るので、
      // 入らないものの行の中に書いてあることまで見る
      check(
        'RECIPEEXPORT-EM(a) 確認に作った記録の写真・設定が入らないと書いてある',
        /入らないもの:[^\n]*作った記録の写真/.test(reConfirmText) && /入らないもの:[^\n]*設定/.test(reConfirmText),
        reConfirmText,
      )
      check(
        'RECIPEEXPORT-EM(a) 確認に端末のレシピが減らないことと戻し方が書いてある',
        reConfirmText.includes('端末のレシピは減りません') &&
          reConfirmText.includes('設定の「バックアップを読み込む」の「今のデータに追加」'),
        reConfirmText,
      )
      // 2026-08-15 便GV(オーナー実機「ファイルのサイズも書いてあると親切」)。
      // 実測値なので数字そのものは決め打ちせず、大きさの行が出ていることだけを見る
      check(
        'RECIPEEXPORT-EM(a) 確認にファイルの大きさが出る',
        /ファイルの大きさ:\s*約\d+(\.\d+)?(B|KB|MB)/.test(reConfirmText),
        reConfirmText,
      )
      // 保存先の言い分け(2026-08-15 便GV)。e2eは自動化環境なので必ず自動ダウンロード側になる
      // (logic/fileSave.ts の supportsSaveFilePicker が navigator.webdriver を見るため)。
      // 対応していない環境で「選べます」と書かないことを、この経路で確かめる
      check(
        'RECIPEEXPORT-EM(a) 保存先を選べない環境では「選べます」と書かない',
        reConfirmText.includes('保存先') && !reConfirmText.includes('選べます'),
        reConfirmText,
      )

      const [reDownload] = await Promise.all([
        rePage.waitForEvent('download'),
        rePage.getByTestId('recipes-export-confirm-ok').click(),
      ])
      await rePage.waitForTimeout(600)
      check(
        'RECIPEEXPORT-EM(b) ファイル名が全体のバックアップと見分けられる',
        /^uchi-recipe-recipes-\d{4}-\d{2}-\d{2}\.json$/.test(reDownload.suggestedFilename()),
        reDownload.suggestedFilename(),
      )

      const reJson = readFileSync(await reDownload.path(), 'utf-8')
      const reFile = JSON.parse(reJson)
      check(
        'RECIPEEXPORT-EM(b) バックアップと同じ書式で書き出される',
        reFile.app === 'uchi-recipe' && reFile.version === 1 && Array.isArray(reFile.recipes),
        `app=${reFile.app} version=${reFile.version}`,
      )
      check(
        'RECIPEEXPORT-EM(b) 選んだ品だけが入る',
        reFile.recipes.length === rePicked &&
          rePickedTitles.every((t) => reFile.recipes.some((r) => r.title === t)),
        `件数=${reFile.recipes.length}/${rePicked}`,
      )
      check(
        'RECIPEEXPORT-EM(b) 設定(Pro解錠コード)は入らない',
        reFile.settings === undefined && !reJson.includes('UR-E2E-EXPORT-ONLY'),
        `settings=${JSON.stringify(reFile.settings)}`,
      )
      check(
        'RECIPEEXPORT-EM(b) 在庫・買い物メモ・献立・価格などの項目自体を持たない(上書きで消さないため)',
        ['pantryItems', 'shoppingItems', 'mealPlans', 'todayList', 'prices', 'dayNotes', 'mealTemplates', 'mealPlanLocks'].every(
          (key) => reFile[key] === undefined,
        ),
      )
      check(
        'RECIPEEXPORT-EM(b) レシピには「作った記録」の配列が付いている(記録も一緒に持ち出せる)',
        reFile.recipes.every((r) => Array.isArray(r.cookedLogs)),
      )
      check('RECIPEEXPORT-EM(c) 書き出し完了の知らせが出る', ((await rePage.textContent('body')) ?? '').includes('書き出しました'))

      // (c) 端末のレシピは減らない
      await rePage.getByPlaceholder(ja.search.placeholder).fill('')
      await rePage.waitForTimeout(600)
      const reTotalAfterExport = await rePage.locator(reCardSel).count()
      check(
        'RECIPEEXPORT-EM(c) 書き出しても端末のレシピは減らない',
        reTotalAfterExport > rePicked,
        `件数=${reTotalAfterExport}`,
      )

      // (d) 消してから、既存の読み込み経路(「今のデータに追加」)で戻す。
      // 絞り込みを戻しても選択は残る(見えている品は落とさない)ので、「全選択」は
      // 押せない状態になっている。押せるときだけ押す
      await rePage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await rePage.waitForTimeout(700)
      const reSelectAll = rePage.getByRole('button', { name: '全選択', exact: true })
      if (await reSelectAll.isEnabled()) {
        await reSelectAll.click()
        await rePage.waitForTimeout(300)
      }
      await rePage.getByTestId('selection-finish').click()
      await rePage.waitForTimeout(400)
      await rePage.getByTestId('selection-actions-delete').click()
      await rePage.waitForTimeout(1200)
      check(
        'RECIPEEXPORT-EM(d) 前提: 書き出した品を削除できた',
        (await rePage.locator(reCardSel).count()) === 0,
        `残り=${await rePage.locator(reCardSel).count()}`,
      )

      await rePage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await rePage.waitForTimeout(600)
      await rePage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await rePage.waitForTimeout(300)
      const [reChooser] = await Promise.all([
        rePage.waitForEvent('filechooser'),
        rePage.getByRole('button', { name: /今のデータに追加/ }).first().click(),
      ])
      await reChooser.setFiles({
        name: reDownload.suggestedFilename(),
        mimeType: 'application/json',
        buffer: Buffer.from(reJson, 'utf-8'),
      })
      await rePage.waitForTimeout(1400)
      check(
        'RECIPEEXPORT-EM(d) 既存の読み込み経路でエラーにならない',
        !((await rePage.textContent('body')) ?? '').includes('ファイルを読み込めませんでした'),
      )
      await rePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rePage.waitForTimeout(1200)
      await rePage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await rePage.waitForTimeout(700)
      check(
        'RECIPEEXPORT-EM(d) 書き出したファイルから消したレシピが戻る',
        (await rePage.locator(reCardSel).count()) === rePicked,
        `戻った件数=${await rePage.locator(reCardSel).count()}/${rePicked}`,
      )
    } finally {
      await reBrowser.close()
    }
  }

  // ================================================================================
  // --- 便EP(2026-08-09 オーナー実機): 紹介ページ・ホーム画面追加ページ・使い方ページの手直し ---
  // ================================================================================

  // --- INSTALLASK-EP(撤去): 「無料で使ってみる」を押した先で「追加方法を見る／このまま開く」を
  // 尋ねていた小窓は 2026-08-10 便EX で撤去した(オーナー裁定「方式はいいが画面がだめ。
  // うちレシピのホーム画面に移動した直後にお知らせを出したい」)。代わりの案内はアプリ側に置く。
  // 撤去できていることの検査は末尾の NOASK-EX にある ---

  // --- LPTEXT-EP: 紹介ページの文言(オーナー実機の指摘4件) ---
  {
    currentCheck = 'LPTEXT-EP'
    await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
    const lpEp = await (await page.request.get(`${BASE}/about/`)).text()
    check(
      'LPTEXT-EP 30品の注記の主文から「基本レシピは数えません」が抜けている',
      !/無料で登録できるレシピは30品までです<\/strong>\s*最初から入っている/.test(lpEp),
    )
    // 2026-08-10 便FG(オーナー指示): この※は「基本レシピの紹介のほうに注釈として付ける」に
    // 変わったので、Pro版の注記の中ではなく基本レシピの紹介(.starters)の末尾で見る。
    // 30品という数字を別の節から参照する形になったため、文面も自己完結する言い方に直した
    check(
      'LPTEXT-EP 「基本レシピは30品に数えない」は基本レシピの紹介の末尾に※として置いてある',
      ((await page.locator('.starters .tiny').first().textContent()) ?? '')
        .trim()
        .startsWith('※最初から入っている基本レシピは、無料で登録できる30品には数えません。'),
      (await page.locator('.starters .tiny').first().textContent()) ?? '(なし)',
    )
    check(
      'LPTEXT-EP 「30品を超えて登録するときは、Pro版をご利用ください」を出さない',
      !lpEp.includes('30品を超えて登録するときは'),
    )
    // 2026-08-10 便EX: 見出しは「こんなこと、ありませんか」・項目は4つ・しっぽは三角から
    // 丸い粒に変わった。形の検査は末尾の BUBBLE-EX に移したので、ここでは吹き出しが
    // 消えていないことだけを見る
    check(
      'LPTEXT-EP 「こんなこと、ありませんか」が吹き出しの形で並んでいる',
      (await page.locator('.pains li').count()) >= 3,
      `個数=${await page.locator('.pains li').count()}`,
    )
    // 2026-08-10 便FE(オーナー指示): 「まとめて登録しておくと〜解消に役立ちます」は意味が
    // 分かりにくいので言い切る形にした。「3つに限定しない」という便EPの趣旨はそのまま
    check(
      'LPTEXT-EP 3つの悩みに限定した書き方をしていない',
      !lpEp.includes('この3つをまとめて引き受けます') &&
        lpEp.includes('うちレシピなら、このような困りごとを解決できます。'),
    )
  }

  // --- INSTALLTEXT-EP: ホーム画面追加ページの文言(オーナー実機の指摘) ---
  {
    currentCheck = 'INSTALLTEXT-EP'
    const insEp = await (await page.request.get(`${BASE}/about/install.html`)).text()
    check(
      'INSTALLTEXT-EP ホーム画面への追加が「おすすめ」だと言い切っている',
      insEp.includes('ホーム画面に追加してお使いいただくのがおすすめです'),
    )
    // 2026-08-21 便IR(オーナー書き溜め③「アプリの説明は省く」): 便EPで冒頭に入れた
    // アプリの説明は、手順の前に読ませる4段落174字の一部だった。冒頭からは外し、
    // 同じ事実は下の「追加したあとの使い方」が言う。**事実が消えていないこと**と
    // **冒頭に戻っていないこと**の両方を見る
    const insHeadEnd = insEp.indexOf('id="iphone"')
    // 直した経緯は作り手向けのコメントに書いてあるので、コメントを外してから見る
    const insHead = insEp.slice(insEp.indexOf('<h1'), insHeadEnd).replace(/<!--[\s\S]*?-->/g, ' ')
    check(
      'INSTALLTEXT-EP アプリと同じように使えることは「追加したあとの使い方」に書いてある',
      insHeadEnd > 0 && insEp.includes('アプリと同じ見た目で使えます'),
    )
    check(
      'INSTALLTEXT-EP 冒頭にアプリの説明を戻していない',
      insHead.length > 0 &&
        !insHead.includes('ブラウザで動くWebアプリ') &&
        !insHead.includes('他のアプリと同じようにご利用いただけます'),
    )
    check(
      'INSTALLTEXT-EP 「追加しなくてもブラウザのまま」は※の注記に下げてある',
      insEp.includes('※ホーム画面に追加しなくても、ブラウザのままご利用いただけます'),
    )
    check(
      'INSTALLTEXT-EP 「図は説明のために描いたものです」を出さない',
      !insEp.includes('図は説明のために描いたものです') &&
        insEp.includes('実際の画面は、端末とブラウザの版によって少し違います'),
    )
    check(
      'INSTALLTEXT-EP iPhone・iPadのChromeでも追加できることが書いてある',
      insEp.includes('iPhone・iPadのChromeでも、同じ共有ボタン'),
    )
    check(
      'INSTALLTEXT-EP ボタンの下の「うちレシピの画面を開いてから追加します」を出さない',
      !insEp.includes('うちレシピの画面を開いてから追加します'),
    )
    check(
      'INSTALLTEXT-EP パソコンで追加したあとの姿(オレンジ色の帯とアイコン)が図と説明にある',
      insEp.includes('パソコンではうちレシピだけの窓で開きます') &&
        insEp.includes('オレンジ色の帯に鍋のマークのアイコン'),
    )
  }

  // --- NOINSTALLFREE-EP: 「インストール不要」の掃引。
  // Android・パソコンでは「インストール」を押してもらう案内をしているので、
  // 「インストールは不要／いりません」は嘘になる(2026-08-09 オーナー指摘)。
  // アプリストアからのダウンロードが不要である旨の言い方に統一する ---
  {
    currentCheck = 'NOINSTALLFREE-EP'
    const LIE = /インストール[^。<]{0,12}(不要|いりません|要りません)/
    for (const p of [
      '/about/',
      '/about/install.html',
      '/about/manual.html',
      '/about/terms.html',
      '/about/tokushoho.html',
      '/about/column/',
    ]) {
      const res = await page.request.get(`${BASE}${p}`)
      const html = await res.text()
      check(
        `NOINSTALLFREE-EP ${p} に「インストール不要」の言い方が残っていない`,
        res.status() === 200 && !LIE.test(html),
        `残存=${html.match(LIE)?.[0] ?? 'なし'}`,
      )
    }
    const lpTop = await (await page.request.get(`${BASE}/about/`)).text()
    check(
      'NOINSTALLFREE-EP 紹介ページの上部はアプリストアからのダウンロードが不要である旨になっている',
      lpTop.includes('ブラウザで開くだけ。アプリストアからのダウンロードも会員登録もいりません'),
    )
  }

  // --- SHOTSIZE-EP: 図の実寸と、HTMLに書いた width/height が食い違っていない。
  // 図を描き直すと寸法が変わる。属性の書き換えを忘れると、読み込み中に文字が飛ぶ。
  // 2026-08-10 便FJ: 対象を「説明書の1枚だけ」から、図を載せている静的ページ全部に広げた。
  // 撮り直しで背が変わったカット(タイマー窓・調理中モードの上部・週の日カード等)の
  // width/height が置き去りになっていたため ---
  {
    currentCheck = 'SHOTSIZE-EP'
    for (const [pagePath, selector] of [
      ['/about/install.html', 'figure.shot img'],
      ['/about/manual.html', 'figure.shot img'],
      ['/about/', 'figure.shot img'],
      ['/about/multi-device.html', 'figure.shot img'],
    ]) {
      await page.goto(`${BASE}${pagePath}`, { waitUntil: 'networkidle' })
      // 画面に出ている img そのものの naturalWidth は見ない(2026-08-10 便FJ)。
      // 図は loading="lazy" なので、画面の外にあるうちは読み込みが始まらず naturalWidth が0のまま。
      // load を待つと永久に返ってこない(実際にe2eが止まった)。別に Image() を作って
      // 実寸だけを取り、失敗しても必ず返るようにする(1枚10秒で打ち切り)
      const gaps = await page.evaluate(async (sel) => {
        const imgs = Array.from(document.querySelectorAll(sel))
        const out = []
        for (const el of imgs) {
          const src = el.getAttribute('src')
          const size = await new Promise((resolve) => {
            const probe = new Image()
            const done = () => resolve({ w: probe.naturalWidth, h: probe.naturalHeight })
            probe.onload = done
            probe.onerror = () => resolve({ w: 0, h: 0 })
            setTimeout(() => resolve({ w: -1, h: -1 }), 10000)
            probe.src = src
          })
          const w = Number(el.getAttribute('width'))
          const h = Number(el.getAttribute('height'))
          if (size.w !== w || size.h !== h) out.push(`${src} 実寸${size.w}x${size.h} 記述${w}x${h}`)
        }
        return out
      }, selector)
      check(`SHOTSIZE-EP ${pagePath} の図の寸法が合っている`, gaps.length === 0, gaps.join(' / '))
    }
  }

  // --- NOTABWORD-EP: ユーザーの目に触れる文言に「タブ」を出さない
  // (2026-08-10 オーナー指示「「タブ」は内部表現なのでさけたい」)。
  // 画面の呼び方は、アプリが同じ画面に付けている名前(レシピ一覧／献立／食材)と、
  // 献立の中の「日」「週」「月」の画面にそろえる。
  //
  // 見る先:
  //  - src/i18n/ja.ts の文字列リテラル(UI文言はすべてここに集約する規約なので、
  //    ここが空ならアプリ内の文言に「タブ」は出ない)
  //  - 静的ページ(紹介・使い方・複数の端末で使う方法・規約など)の本文
  // 見ない先: コードとHTMLのコメント(内部の説明なのでそのまま残してよい)。
  //
  // 除外(端末のブラウザのタブそのものを説明している2か所。ブラウザの実物の名前なので、
  // 言い換えると画面と食い違う):
  //  - 「新しいタブ」= Chromeのメニューに実際に並ぶ項目名(ホーム画面への追加方法の図の説明)
  //  - 「アドレスバーやタブが出ない」= 追加したあとに全画面で開くことの説明 ---
  {
    currentCheck = 'NOTABWORD-EP'
    const jaSrc = readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')
    const literals = []
    let buf = null
    let quote = ''
    for (let i = 0; i < jaSrc.length; i++) {
      const c = jaSrc[i]
      if (quote) {
        if (c === '\\') {
          buf += jaSrc[i + 1] ?? ''
          i++
          continue
        }
        if (c === quote) {
          literals.push(buf)
          buf = null
          quote = ''
          continue
        }
        buf += c
        continue
      }
      if (c === '/' && jaSrc[i + 1] === '/') {
        const e = jaSrc.indexOf('\n', i)
        if (e < 0) break
        i = e
        continue
      }
      if (c === '/' && jaSrc[i + 1] === '*') {
        const e = jaSrc.indexOf('*/', i + 2)
        i = e < 0 ? jaSrc.length : e + 1
        continue
      }
      if (c === "'" || c === '"' || c === '`') {
        quote = c
        buf = ''
        continue
      }
    }
    const jaHits = literals.filter((s) => s.includes('タブ'))
    check(
      'NOTABWORD-EP ja.ts のUI文言に「タブ」が残っていない',
      literals.length > 500 && jaHits.length === 0,
      jaHits.join(' / ') || `文字列${literals.length}件`,
    )

    const BROWSER_TAB_OK = ['「新しいタブ」', 'アドレスバーやタブが出ない']
    for (const p of [
      '/news.json', // アプリ内のお知らせ(本文もユーザーの目に触れる)
      '/about/',
      '/about/manual.html',
      '/about/install.html',
      '/about/multi-device.html',
      '/about/foods.html',
      '/about/unlock.html',
      '/about/terms.html',
      '/about/tokushoho.html',
      '/about/column/',
    ]) {
      const res = await page.request.get(`${BASE}${p}`)
      let html = (await res.text()).replace(/<!--[\s\S]*?-->/g, '')
      for (const okPhrase of BROWSER_TAB_OK) html = html.split(okPhrase).join('')
      const hit = html.match(/.{0,16}タブ.{0,10}/)
      check(
        `NOTABWORD-EP ${p} の本文に「タブ」が残っていない`,
        res.status() === 200 && !hit,
        hit?.[0] ?? '',
      )
    }
  }

  // --- SHOTMARK-EP: 説明図の「押す場所を囲む枠」が一覧のふちで切られない作りのままか。
  // 囲みは要素の外側に描く(outline + ぼかし)ので、入れ物に overflow:hidden があると
  // 左右や下が切られて囲みが閉じていない絵になる(2026-08-09 オーナー実機報告で発覚) ---
  {
    currentCheck = 'SHOTMARK-EP'
    const shotsSrc = readFileSync(path.join(appRoot, 'scripts/shots-install.mjs'), 'utf-8')
    for (const cls of ['.sheet-list', '.and-menu']) {
      const rule = shotsSrc.match(new RegExp(`\\${cls}\\{[^}]*\\}`, 's'))
      check(
        `SHOTMARK-EP ${cls} に overflow:hidden を戻していない`,
        rule !== null && !rule[0].includes('overflow:hidden'),
        rule?.[0] ?? '(規則が見つからない)',
      )
    }
  }


