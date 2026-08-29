// ==========================================================================================
// e2e の節: 古い記録の書き出し・価格の見え方・共有・フォーム
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
// この中の節: ARCHIVE-01, ARCHIVE-02, MERGEUID-01, JA-DUP-01, FILESAVE-01, IMPORTCONFIRM-01, PRO-FALLBACK-01, PRICEVIEW-01, JGCOST-01, SHARE-01, FOCUS-HINT-01, FORMTABS-01
// ==========================================================================================
import './_shared.mjs'


  // --- ARCHIVE-01(2026-08-02 古い記録の書き出し): 書き出し→削除→閲覧の一連。
  // 目的は端末容量の軽量化(直近だけ端末に残し、古い記録は写真ごとファイルへ出す)なので、
  // ①境目より前の記録だけが対象になる ②書き出す前は削除ボタンが出ない(2段階) ③書き出したファイルに
  // 種別マークと写真が入る ④削除で対象だけが端末から消え、境目以降の記録・レシピ本体は残る
  // ⑤「アーカイブを見る」は閲覧だけで、端末(IndexedDB)に書き戻さない、を実UI経由で確認する。
  // 前提の記録(古い記録・新しい記録・写真)はIndexedDBへ直接書き込む(記録UI自体はLOG-PHOTO-01等で
  // 別途カバー済みのため、ここはアーカイブ機構そのものに的を絞る) ---
  currentCheck = 'ARCHIVE-01'
  {
    const arBrowser = await chromium.launch()
    try {
      const arContext = await arBrowser.newContext({ acceptDownloads: true })
      const arPage = await arContext.newPage()
      arPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@ARCHIVE-01] ${err.message}`)
      })
      arPage.on('dialog', (dialog) => dialog.accept())
      await arPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await arPage.waitForTimeout(1800) // 初回シード完了待ち

      // 前提: 1品目に「古い記録2件(うち1件は写真つき)」と「今日の記録1件」を入れる。
      // 日付は実行日から数えて作る(固定日付だと日が経つほど境目との関係が変わるため)
      const arSetup = await arPage.evaluate(async () => {
        const ymd = (offsetDays) => {
          const d = new Date()
          d.setDate(d.getDate() - offsetDays)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const recipeId = await new Promise((resolve, reject) => {
          const cursorReq = idb.transaction('recipes', 'readonly').objectStore('recipes').openCursor()
          cursorReq.onsuccess = () => resolve(cursorReq.result ? cursorReq.result.primaryKey : null)
          cursorReq.onerror = () => reject(cursorReq.error)
        })
        // 1x1のJPEGを作って写真つきの記録にする(記録の写真がファイルへ入ることの確認用)
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const photo = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
        const dates = { old1: ymd(200), old2: ymd(100), recent: ymd(1) }
        const title = await new Promise((resolve, reject) => {
          const tx = idb.transaction('recipes', 'readwrite')
          const store = tx.objectStore('recipes')
          const getReq = store.get(recipeId)
          let recipeTitle = null
          getReq.onsuccess = () => {
            const recipe = getReq.result
            recipeTitle = recipe.title
            store.put({
              ...recipe,
              cookedLogs: [
                { date: dates.recent, note: 'E2E最近の記録' },
                // 2026-08-20 便IJ・①: 何人分もアーカイブファイルに入り、閲覧の窓で読めることを測る
                // （設定の「入るもの」に何人分を挙げている以上、読めなければ嘘になる）
                { date: dates.old2, note: 'E2E古い記録(写真つき)', photo, servings: 3 },
                { date: dates.old1, note: 'E2E古い記録' },
              ],
            })
          }
          tx.oncomplete = () => resolve(recipeTitle)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
        return { recipeId, title, dates }
      })
      check('ARCHIVE-01 前提: 記録を入れるレシピを取得できた', typeof arSetup.recipeId === 'number')

      // 記録はDexieを通さず直接書いたので、画面のライブクエリは気づかない。
      // 読み直させるためにページごと読み込み直す(shots-manual.mjsと同じ理由)
      await arPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await arPage.reload({ waitUntil: 'networkidle' })
      await arPage.waitForTimeout(1500)
      // 2026-08-22 便JJ: 「古い記録の書き出し（アーカイブ）」は既定で畳んである（オーナー指示）。
      // 中身を見る節は、必ず先に開いてから測る（「機種変更するときは」と同じ作法）
      await arPage.locator('[data-testid="archive-toggle"]').first().click()
      await arPage.waitForTimeout(600)
      const arCount = await arPage.locator('[data-testid="archive-target-count"]').textContent()
      check(
        'ARCHIVE-01 既定(1か月より前)で古い記録2件・写真1枚が対象になる',
        arCount.includes('2件') && arCount.includes('1枚'),
        `表示=${arCount}`,
      )
      check(
        // 2026-08-12 便FW: 「書き出す手順」の説明にボタン名を書いたので、本文の文字で
        // 有無を測ると必ず引っかかる。見たいのは「ボタンが出ているか」なのでボタンで数える
        'ARCHIVE-01 書き出す前は「書き出した記録を端末から消す」が出ない(2段階)',
        (await arPage.getByRole('button', { name: ja.settings.archiveDeleteButton }).count()) === 0,
      )

      // --- 2026-08-20 便IJ・①: 読みかたの制限が「書き出す前」に画面に出ていること ---
      // オーナー原文「アーカイブが一覧のみになるのは注意書きはありますか？写真の拡大もできないし、
      // 情報が削れるなら先に知りたい。」＝**押したあとに気づく形にしない**。
      // 掴み方は目印（並びの何番目・入れ子の段数には依らない）。文言は ja から読む。
      // 読み取れなかったとき（枠が無い・ボタンが無い）は、その場で不合格にする
      {
        const arFacts = arPage.locator('[data-testid="archive-file-facts"]')
        const arExportBtn = arPage.getByRole('button', { name: ja.settings.archiveExportButton })
        const arFactsBox = (await arFacts.count()) === 1 ? await arFacts.boundingBox() : null
        const arExportBox = (await arExportBtn.count()) === 1 ? await arExportBtn.boundingBox() : null
        check(
          'ARCHIVE-01(便IJ・①) 前提: 読みかたの説明と書き出しのボタンを両方掴めている',
          !!arFactsBox && !!arExportBox,
          `説明=${JSON.stringify(arFactsBox)} ボタン=${JSON.stringify(arExportBox)}`,
        )
        check(
          'ARCHIVE-01(便IJ・①) 読みかたの制限が「書き出す」ボタンより上に出ている',
          !!arFactsBox && !!arExportBox && arFactsBox.y + arFactsBox.height <= arExportBox.y,
          `説明の下端=${arFactsBox ? Math.round(arFactsBox.y + arFactsBox.height) : null} ボタンの上端=${
            arExportBox ? Math.round(arExportBox.y) : null
          }`,
        )
        const arFactsText = (
          (await arFacts.innerText().catch(() => '')) ?? ''
        ).replace(/\u200B/g, '')
        const arFactsMissing = ja.settings.archiveFileRows.filter(
          (row) => !arFactsText.includes(row.name) || !arFactsText.includes(row.body),
        )
        check(
          'ARCHIVE-01(便IJ・①) 何が入るか・どう読むか・戻せるかが、そこに書いてある',
          ja.settings.archiveFileRows.length >= 3 && arFactsMissing.length === 0,
          `画面に無い行=${JSON.stringify(arFactsMissing.map((r) => r.name))}`,
        )
        check(
          'ARCHIVE-01(便IJ・①) 消えるのは端末の記録のほうだと書いてある（情報が削れると読ませない）',
          (
            (await arPage
              .locator('[data-testid="archive-file-keep-note"]')
              .innerText()
              .catch(() => '')) ?? ''
          )
            .replace(/\u200B/g, '')
            .includes(ja.settings.archiveFileKeepNote),
        )
      }

      // 書き出し(保存先を選べない環境=自動ダウンロード経路)
      const [arDownload] = await Promise.all([
        arPage.waitForEvent('download'),
        arPage.getByRole('button', { name: ja.settings.archiveExportButton }).click(),
      ])
      const arJson = readFileSync(await arDownload.path(), 'utf-8')
      const arFile = JSON.parse(arJson)
      check(
        'ARCHIVE-01 書き出したファイルにアーカイブの種別マークが入る(バックアップと区別できる)',
        arFile.kind === 'cooked-log-archive' && arFile.app === 'uchi-recipe',
        `kind=${arFile.kind}`,
      )
      check('ARCHIVE-01 書き出したファイルに古い記録2件が入る', (arFile.logs ?? []).length === 2)
      check(
        'ARCHIVE-01 書き出したファイルは日付の新しい順',
        arFile.logs[0].date > arFile.logs[1].date,
        `${arFile.logs[0].date} / ${arFile.logs[1].date}`,
      )
      check(
        'ARCHIVE-01 書き出したファイルに記録の写真が入る',
        arFile.logs.some((l) => typeof l.photoBase64 === 'string' && l.photoBase64.length > 0),
      )
      check(
        'ARCHIVE-01 書き出したファイルに最近の記録は入らない',
        !arFile.logs.some((l) => l.date === arSetup.dates.recent),
      )
      check(
        'ARCHIVE-01 書き出しただけでは端末の記録は減らない',
        (
          await arPage.evaluate(async (recipeId) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const recipe = await new Promise((resolve, reject) => {
              const r = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
              r.onsuccess = () => resolve(r.result)
              r.onerror = () => reject(r.error)
            })
            idb.close()
            return recipe.cookedLogs.length
          }, arSetup.recipeId)
        ) === 3,
      )

      // 書き出しが済んで初めて出る削除ボタン→端末から消す
      const arDeleteBtn = arPage.getByRole('button', { name: ja.settings.archiveDeleteButton })
      check('ARCHIVE-01 書き出したあとに削除ボタンが出る', (await arDeleteBtn.count()) === 1)
      await arDeleteBtn.click()
      await arPage.waitForTimeout(900)
      // 2026-08-20 便IJ・①: 端末側の記録が無くなる最後の関門にも、読みかたの制限を出す
      {
        const arConfirmTexts = await readConfirms(arPage)
        check(
          'ARCHIVE-01(便IJ・①) 消す前の確認にも、消したあとの読みかたが出る',
          arConfirmTexts.some((t) => t.includes(ja.settings.archiveDeleteConfirmViewNote)),
          `出た確認の窓=${JSON.stringify(arConfirmTexts).slice(0, 200)}`,
        )
      }
      const arAfterDelete = await arPage.evaluate(async (recipeId) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const recipe = await new Promise((resolve, reject) => {
          const r = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        idb.close()
        return { title: recipe.title, dates: recipe.cookedLogs.map((l) => l.date) }
      }, arSetup.recipeId)
      check(
        'ARCHIVE-01 削除で古い記録だけが端末から消える',
        arAfterDelete.dates.length === 1 && arAfterDelete.dates[0] === arSetup.dates.recent,
        `残った記録=${JSON.stringify(arAfterDelete.dates)}`,
      )
      check('ARCHIVE-01 レシピ本体は残る', arAfterDelete.title === arSetup.title)
      const arAfterText = await arPage.textContent('body')
      check(
        // 便FWと同じ理由でボタンの数で見る（説明文にはボタン名が書いてある）
        'ARCHIVE-01 削除後は対象0件になり書き出しボタンが消える',
        new RegExp(ja.settings.archiveTargetNone.replace('{n}', '\\d+')).test(arAfterText) &&
          (await arPage.getByRole('button', { name: ja.settings.archiveExportButton }).count()) === 0,
      )

      // アーカイブを見る: 書き出したファイルを選ぶと中身が読める(端末には保存しない)
      const [arViewChooser] = await Promise.all([
        arPage.waitForEvent('filechooser'),
        arPage.getByRole('button', { name: ja.settings.archiveViewButton }).click(),
      ])
      // 2026-08-20 便IH・④: **自分で付け替えた名前**のファイルを選ぶ。
      // 読み込みは中身の種別マークだけを見ていて名前は見ていない、を画面で確かめる
      // （書き出しの名前は uchi-recipe-archive- だが、利用者が変えても読めなければならない）
      await arViewChooser.setFiles({
        name: 'わたしの記録.json',
        mimeType: 'application/json',
        buffer: Buffer.from(arJson, 'utf-8'),
      })
      await arPage.waitForTimeout(800)
      const arViewText = await arPage.textContent('body')
      check(
        'ARCHIVE-01(便IH・④) ファイル名を自分で付け替えても読める(名前ではなく中身で判断している)',
        arViewText.includes('記録2件'),
      )
      check(
        'ARCHIVE-01(便IH・④) ファイル名を変えてよいことが画面に書いてある',
        arViewText.replace(/​/g, '').includes(ja.settings.fileNameFreeNote),
      )
      check(
        'ARCHIVE-01 閲覧の窓に「端末には保存されません」の帯が出る',
        arViewText.includes(ja.settings.archiveViewBanner),
      )
      check('ARCHIVE-01 閲覧の窓に記録件数が出る', arViewText.includes('記録2件'))
      check(
        'ARCHIVE-01 閲覧の窓に書き出した記録のメモが出る',
        arViewText.includes('E2E古い記録(写真つき)'),
      )
      check(
        // 2026-08-20 便IJ・①: 設定の「入るもの」に何人分を挙げているので、閲覧の窓でも読めること。
        // 文言は ja から組み立てる（「3人分」を書き写さない）
        'ARCHIVE-01(便IJ・①) 閲覧の窓に何人分が出る（説明で「入るもの」に挙げているため）',
        arViewText.includes(ja.detail.cookedServingsValue.replace('{n}', '3')),
        `窓=${arViewText.slice(0, 160)}`,
      )
      check(
        'ARCHIVE-01 閲覧しても端末の記録は増えない(読み込み専用)',
        (
          await arPage.evaluate(async (recipeId) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const recipe = await new Promise((resolve, reject) => {
              const r = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
              r.onsuccess = () => resolve(r.result)
              r.onerror = () => reject(r.error)
            })
            idb.close()
            return recipe.cookedLogs.length
          }, arSetup.recipeId)
        ) === 1,
      )

      // バックアップファイルを「アーカイブを見る」に渡したときは、壊れている扱いにせず言い分ける
      const [arWrongChooser] = await Promise.all([
        arPage.waitForEvent('filechooser'),
        (async () => {
          await arPage.keyboard.press('Escape') // 閲覧の窓を閉じてから
          await arPage.waitForTimeout(400)
          await arPage.getByRole('button', { name: ja.settings.archiveViewButton }).click()
        })(),
      ])
      await arWrongChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ app: 'uchi-recipe', version: 1, exportedAt: '', recipes: [] }),
          'utf-8',
        ),
      })
      await arPage.waitForTimeout(600)
      check(
        'ARCHIVE-01 バックアップファイルを選んだときは「バックアップファイルです」と案内する',
        (await arPage.textContent('body')).includes(ja.settings.archiveFileErrorBackup),
      )
    } finally {
      await arBrowser.close()
    }
  }

  // --- ARCHIVE-02(2026-08-16 便HC): 古い記録の書き出しが「レシピを削除しても残った記録」も
  // 対象にする。この機能の目的は端末容量の軽量化で、残った記録は**レシピが無いぶん記録と写真だけが
  // 端末に残っている**状態なので、対象外だと目的を果たせない(便GZの積み残し①)。
  // ここでしか測れないのは「消す側」= detachedLogs テーブルからも消えること・記録が0件になった
  // まとまりが行ごと消えること。純ロジック(件数・ID・確認文)は scripts/test-logic.mjs が持つ。
  // 前提の記録はIndexedDBへ直接書き込む(記録UI自体は別の検証でカバー済み) ---
  currentCheck = 'ARCHIVE-02'
  {
    const a2Browser = await chromium.launch()
    try {
      const a2Context = await a2Browser.newContext({ acceptDownloads: true })
      const a2Page = await a2Context.newPage()
      a2Page.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@ARCHIVE-02] ${err.message}`)
      })
      a2Page.on('dialog', (dialog) => dialog.accept())
      await a2Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await a2Page.waitForTimeout(1800) // 初回シード完了待ち

      // 前提: レシピ側に古い記録1件(写真つき)＋最近の記録1件、
      //       残った記録は A=古い1件+最近1件(行は残るはず) / B=古い1件だけ(行ごと消えるはず)。
      // 日付は実行日から数えて作る(固定日付だと日が経つほど境目との関係が変わる)
      const a2Setup = await a2Page.evaluate(async () => {
        const ymd = (offsetDays) => {
          const d = new Date()
          d.setDate(d.getDate() - offsetDays)
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        }
        const dates = { old1: ymd(200), old2: ymd(150), recent: ymd(1) }
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const canvas = document.createElement('canvas')
        canvas.width = 1
        canvas.height = 1
        const photo = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
        const recipeId = await new Promise((resolve, reject) => {
          const cursorReq = idb.transaction('recipes', 'readonly').objectStore('recipes').openCursor()
          cursorReq.onsuccess = () => resolve(cursorReq.result ? cursorReq.result.primaryKey : null)
          cursorReq.onerror = () => reject(cursorReq.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('recipes', 'readwrite')
          const store = tx.objectStore('recipes')
          const getReq = store.get(recipeId)
          getReq.onsuccess = () => {
            store.put({
              ...getReq.result,
              cookedLogs: [
                { date: dates.recent, note: 'E2E最近の記録' },
                { date: dates.old1, note: 'E2Eレシピ側の古い記録', photo },
              ],
            })
          }
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('detachedLogs', 'readwrite')
          const store = tx.objectStore('detachedLogs')
          // 印は端末のレシピと一致しないものにする(起動時の結び直しで消えないように)
          store.add({
            recipeUid: 'u-e2e-gone-a',
            title: 'E2E消したレシピA',
            logs: [
              { date: dates.old2, note: 'E2E残った古い記録(写真つき)', photo },
              { date: dates.recent, note: 'E2E残った最近の記録' },
            ],
            detachedAt: Date.now(),
          })
          store.add({
            recipeUid: 'u-e2e-gone-b',
            title: 'E2E消したレシピB',
            logs: [{ date: dates.old1, note: 'E2E残った古い記録だけ' }],
            detachedAt: Date.now(),
          })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
        return { recipeId, dates }
      })
      check('ARCHIVE-02 前提: 記録を入れるレシピを取得できた', typeof a2Setup.recipeId === 'number')

      // 直接書き込んだのでライブクエリは気づかない。読み込み直して数え直させる
      await a2Page.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await a2Page.reload({ waitUntil: 'networkidle' })
      await a2Page.waitForTimeout(1500)
      // 2026-08-22 便JJ: 「古い記録の書き出し（アーカイブ）」は既定で畳んである（オーナー指示）。
      // 中身を見る節は、必ず先に開いてから測る（「機種変更するときは」と同じ作法）
      await a2Page.locator('[data-testid="archive-toggle"]').first().click()
      await a2Page.waitForTimeout(600)

      const a2Count = (await a2Page.locator('[data-testid="archive-target-count"]').textContent()).replace(/​/g, '')
      check(
        'ARCHIVE-02 残った記録も件数に入る(レシピ側1件＋残った記録2件＝3件・写真2枚)',
        a2Count.includes('3件') && a2Count.includes('2枚'),
        `表示=${a2Count}`,
      )
      const a2Note = a2Page.locator('[data-testid="archive-target-detached"]')
      const a2NoteText =
        (await a2Note.count()) > 0 ? (await a2Note.textContent()).replace(/​/g, '') : ''
      check(
        'ARCHIVE-02 そのうち残った記録が何件かを画面に出す',
        a2NoteText.includes(ja.settings.archiveTargetDetachedNote.replace('{d}', '2')),
        a2NoteText || '(出ていない)',
      )

      const [a2Download] = await Promise.all([
        a2Page.waitForEvent('download'),
        a2Page.getByRole('button', { name: ja.settings.archiveExportButton }).click(),
      ])
      const a2File = JSON.parse(readFileSync(await a2Download.path(), 'utf-8'))
      check(
        'ARCHIVE-02 書き出したファイルの形は変えない(版1・アーカイブの種別マーク)',
        a2File.version === 1 && a2File.kind === 'cooked-log-archive',
        `version=${a2File.version} kind=${a2File.kind}`,
      )
      check(
        'ARCHIVE-02 残った記録もファイルに入る(料理名つき)',
        (a2File.logs ?? []).length === 3 &&
          a2File.logs.some((l) => l.recipeTitle === 'E2E消したレシピA') &&
          a2File.logs.some((l) => l.recipeTitle === 'E2E消したレシピB'),
        JSON.stringify((a2File.logs ?? []).map((l) => l.recipeTitle)),
      )
      check(
        'ARCHIVE-02 残った記録の写真もファイルに入る',
        a2File.logs.filter((l) => typeof l.photoBase64 === 'string' && l.photoBase64.length > 0).length === 2,
      )
      check(
        'ARCHIVE-02 境目以降の記録は残った記録でも書き出さない',
        !a2File.logs.some((l) => l.date === a2Setup.dates.recent),
      )

      // 削除の確認文(規約F)。窓の文字は改行が消えるので、箇条書きは li ごとに読む
      await setConfirmAnswer(a2Page, 'off')
      await a2Page.getByRole('button', { name: ja.settings.archiveDeleteButton }).click()
      await a2Page.waitForTimeout(500)
      const a2Confirm = await a2Page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="confirm"]')
        if (!dialog) return null
        const clean = (el) => (el.textContent ?? '').replace(/​/g, '')
        return {
          bullets: Array.from(dialog.querySelectorAll('li')).map(clean),
          notes: Array.from(dialog.querySelectorAll('p')).map(clean),
        }
      })
      const a2Gone = (a2Confirm?.bullets ?? []).find((t) => t.startsWith('消えるもの')) ?? ''
      const a2Kept = (a2Confirm?.bullets ?? []).find((t) => t.startsWith('残るもの')) ?? ''
      check(
        'ARCHIVE-02 確認文の「消えるもの」に件数と写真の枚数が入る',
        a2Gone.includes('3件') && a2Gone.includes('2枚'),
        a2Gone,
      )
      check(
        'ARCHIVE-02 確認文の「残るもの」に境目以降の記録と書き出したファイルが入る',
        a2Kept.includes('以降の記録') && a2Kept.includes('書き出したファイル'),
        a2Kept,
      )
      check(
        'ARCHIVE-02 レシピ側の記録も消す回なので「レシピ本体」が残るものに入る',
        a2Kept.includes('レシピ本体'),
        a2Kept,
      )
      check(
        'ARCHIVE-02 残った記録が混じるときは内訳を補足に出す',
        (a2Confirm?.notes ?? []).some(
          (t) => t.includes(ja.settings.archiveDeleteConfirmDetachedNote.replace('{d}', '2')),
        ),
        JSON.stringify(a2Confirm?.notes ?? []),
      )
      await a2Page.locator('[data-testid="confirm-ok"]').click()
      await setConfirmAnswer(a2Page, 'accept')
      await a2Page.waitForTimeout(1500)

      const a2After = await a2Page.evaluate(async (recipeId) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const recipe = await new Promise((resolve, reject) => {
          const r = idb.transaction('recipes', 'readonly').objectStore('recipes').get(recipeId)
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const records = await new Promise((resolve, reject) => {
          const r = idb.transaction('detachedLogs', 'readonly').objectStore('detachedLogs').getAll()
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        idb.close()
        return {
          title: recipe.title,
          recipeNotes: recipe.cookedLogs.map((l) => l.note ?? l.date),
          records: records.map((rec) => ({
            title: rec.title,
            notes: rec.logs.map((l) => l.note ?? l.date),
          })),
        }
      }, a2Setup.recipeId)
      check(
        'ARCHIVE-02 レシピ側は古い記録だけ消え、境目以降の記録とレシピ本体は残る',
        a2After.recipeNotes.length === 1 &&
          a2After.recipeNotes[0] === 'E2E最近の記録' &&
          typeof a2After.title === 'string' &&
          a2After.title.length > 0,
        JSON.stringify(a2After.recipeNotes),
      )
      const a2RecordA = a2After.records.find((r) => r.title === 'E2E消したレシピA')
      check(
        'ARCHIVE-02 残った記録も古い分だけ端末から消える',
        !!a2RecordA && a2RecordA.notes.length === 1 && a2RecordA.notes[0] === 'E2E残った最近の記録',
        JSON.stringify(a2After.records),
      )
      check(
        'ARCHIVE-02 記録が0件になったまとまりは行ごと消える(空の行を残さない)',
        !a2After.records.some((r) => r.title === 'E2E消したレシピB'),
        JSON.stringify(a2After.records.map((r) => r.title)),
      )
      check(
        'ARCHIVE-02 消したあとは対象0件になる',
        new RegExp(ja.settings.archiveTargetNone.replace('{n}', '\\d+')).test(
          await a2Page.textContent('body'),
        ),
      )

      // 「アーカイブを見る」: 残った記録も読める(端末には書き戻さない)
      const [a2ViewChooser] = await Promise.all([
        a2Page.waitForEvent('filechooser'),
        a2Page.getByRole('button', { name: ja.settings.archiveViewButton }).click(),
      ])
      // 2026-08-20 便IH・④: **前の名前**（uchi-recipe-records-）で書き出したファイルを選ぶ。
      // 名前を変えたあとも、それまでに書き出したファイルが読めなくなっていないことを確かめる
      await a2ViewChooser.setFiles({
        name: 'uchi-recipe-records-2026-01-05.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(a2File), 'utf-8'),
      })
      await a2Page.waitForTimeout(800)
      const a2ViewText = (await a2Page.textContent('body')).replace(/​/g, '')
      check(
        'ARCHIVE-02(便IH・④) 前の名前(uchi-recipe-records-)で書き出したファイルも読める',
        a2ViewText.includes('E2E消したレシピA') && a2ViewText.includes('E2E消したレシピB'),
      )
      check(
        'ARCHIVE-02 閲覧しても端末には書き戻さない',
        (await a2Page.evaluate(async () => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const rows = await new Promise((resolve, reject) => {
            const r = idb.transaction('detachedLogs', 'readonly').objectStore('detachedLogs').getAll()
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
          idb.close()
          return rows.reduce((sum, row) => sum + row.logs.length, 0)
        })) === 1,
      )
    } finally {
      await a2Browser.close()
    }
  }

  // --- MERGEUID-01(2026-08-16 便HC): 「今のデータに追加」でのレシピの照合(印=Recipe.uid)。
  // 便GZの積み残し②。守るのは2つで、**どちらもデータを失いうる経路**なので実DBで見る:
  //  ・レシピは重複させない(印が食い違っても従来どおり同名・同IDの既存へ合流する)
  //  ・記録は印が一致するときだけ結ぶ(似た名前の違うレシピへつながらない。オーナーの懸念)
  // 場面A=既存もファイルも印を持ち、違う / 場面B=既存が印を持たない(印を引き継ぐ) /
  // 場面C=印を持たない古いバックアップ(従来どおり) ---
  currentCheck = 'MERGEUID-01'
  {
    const muBrowser = await chromium.launch()
    /** 端末の中身(この検証で入れたレシピと、残っている記録)を読む */
    const muReadDb = (page) =>
      page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = (name) =>
          new Promise((resolve, reject) => {
            const r = idb.transaction(name, 'readonly').objectStore(name).getAll()
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const recipes = await all('recipes')
        const detached = await all('detachedLogs')
        idb.close()
        return {
          recipes: recipes
            .filter((r) => r.title.startsWith('E2E照合'))
            .map((r) => ({ id: r.id, uid: r.uid, dates: r.cookedLogs.map((l) => l.date) })),
          detached: detached.map((d) => ({ uid: d.recipeUid, logs: d.logs.length })),
        }
      })
    /**
     * 場面を1つ流す。端末に「E2E照合肉じゃが」を1品と、印 u-e2e-file のまとまりで残った記録1件を
     * 入れてから、同じ料理名のレシピが入ったファイルを「今のデータに追加」で読み込む。
     * keepUidless=true の場面は、起動時の印付け(backfillRecipeUids)が走ると前提が崩れるので
     * 読み込み直さずに画面だけ移る。
     */
    const muRun = async ({ existingUid, fileUid, keepUidless = false }) => {
      const ctx = await muBrowser.newContext()
      const page = await ctx.newPage()
      page.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@MERGEUID-01] ${err.message}`)
      })
      await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(1800)
      const existingId = await page.evaluate(async (uid) => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const newId = await new Promise((resolve, reject) => {
          const tx = idb.transaction('recipes', 'readwrite')
          const addReq = tx.objectStore('recipes').add({
            ...(uid ? { uid } : {}),
            title: 'E2E照合肉じゃが',
            servings: 2,
            effortLevel: 'normal',
            tags: [],
            ingredients: [{ name: '牛肉', amount: '200', unit: 'g' }],
            steps: [{ text: '煮る' }],
            isFavorite: false,
            cookedLogs: [],
            searchWords: ['e2e'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          })
          tx.oncomplete = () => resolve(addReq.result)
          tx.onerror = () => reject(tx.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('detachedLogs', 'readwrite')
          tx.objectStore('detachedLogs').add({
            recipeUid: 'u-e2e-file',
            title: 'E2E照合肉じゃが',
            logs: [{ date: '2020-01-02', note: 'E2E残っていた記録' }],
            detachedAt: Date.now(),
          })
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
        return newId
      }, existingUid)
      if (keepUidless) {
        await page.evaluate(() => {
          window.location.hash = '#/settings?section=backup'
        })
      } else {
        await page.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
        await page.reload({ waitUntil: 'networkidle' })
      }
      await page.waitForTimeout(1500)
      // ファイル側: 同じ料理名・同じ番号のレシピ1品(印は場面ごとに変える)
      const backup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: '2026-08-16T00:00:00.000Z',
        recipes: [
          {
            id: existingId,
            ...(fileUid ? { uid: fileUid } : {}),
            title: 'E2E照合肉じゃが',
            servings: 2,
            effortLevel: 'normal',
            tags: [],
            ingredients: [{ name: '豚肉', amount: '200', unit: 'g' }],
            steps: [{ text: 'ファイル側の手順' }],
            isFavorite: false,
            cookedLogs: [{ date: '2020-01-03', note: 'E2Eファイル側の記録' }],
            searchWords: ['e2e'],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      })
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: ja.settings.backupImportMerge }).click(),
      ])
      await chooser.setFiles({
        name: 'uchi-recipe-backup-e2e.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backup, 'utf-8'),
      })
      // ファイルを選んだあとの確認の窓は、既定の自動押しに任せる
      await page.waitForTimeout(2500)
      const after = await muReadDb(page)
      await ctx.close()
      return { existingId, after }
    }

    try {
      // 場面A: 両方が印を持ち、違う。合流はする(重複を作らない)が、記録は結ばない
      const muA = await muRun({ existingUid: 'u-e2e-mine', fileUid: 'u-e2e-file' })
      check(
        'MERGEUID-01(A) 印が食い違っても同じ料理は1品のまま(重複を作らない)',
        muA.after.recipes.length === 1,
        JSON.stringify(muA.after.recipes),
      )
      check(
        'MERGEUID-01(A) 今のレシピの印は書き換えない',
        muA.after.recipes[0]?.uid === 'u-e2e-mine',
        JSON.stringify(muA.after.recipes),
      )
      check(
        'MERGEUID-01(A) ファイル側の記録は今のレシピへ足される(取り込みは従来どおり)',
        (muA.after.recipes[0]?.dates ?? []).includes('2020-01-03'),
        JSON.stringify(muA.after.recipes),
      )
      check(
        'MERGEUID-01(A) 印が違うレシピには、残っている記録を結ばない(似た名前の違うレシピにつながらない)',
        !(muA.after.recipes[0]?.dates ?? []).includes('2020-01-02'),
        JSON.stringify(muA.after.recipes),
      )
      check(
        'MERGEUID-01(A) 結ばなかった記録は消えずに残る',
        muA.after.detached.length === 1 && muA.after.detached[0].logs === 1,
        JSON.stringify(muA.after.detached),
      )

      // 場面B: 今のレシピが印を持たない。従来どおり同一とみなし、ファイル側の印を引き継ぐ
      const muB = await muRun({ existingUid: undefined, fileUid: 'u-e2e-file', keepUidless: true })
      check(
        'MERGEUID-01(B) 印を持たない同名レシピにも重複を作らない',
        muB.after.recipes.length === 1,
        JSON.stringify(muB.after.recipes),
      )
      check(
        'MERGEUID-01(B) ファイル側の印を引き継ぐ',
        muB.after.recipes[0]?.uid === 'u-e2e-file',
        JSON.stringify(muB.after.recipes),
      )
      check(
        'MERGEUID-01(B) 印が付いたので残っていた記録がそのレシピへ戻る',
        (muB.after.recipes[0]?.dates ?? []).includes('2020-01-02'),
        JSON.stringify(muB.after.recipes),
      )
      check(
        'MERGEUID-01(B) 戻ったまとまりの行は消える',
        muB.after.detached.length === 0,
        JSON.stringify(muB.after.detached),
      )

      // 場面C: 印を持たない古いバックアップ(便GZ以前)。判定を変えない
      const muC = await muRun({ existingUid: 'u-e2e-mine', fileUid: undefined })
      check(
        'MERGEUID-01(C) 印の無い古いファイルも従来どおり同名の既存へ合流する',
        muC.after.recipes.length === 1,
        JSON.stringify(muC.after.recipes),
      )
      check(
        'MERGEUID-01(C) 古いファイルの記録は今のレシピへ足される',
        (muC.after.recipes[0]?.dates ?? []).includes('2020-01-03'),
        JSON.stringify(muC.after.recipes),
      )
      check(
        'MERGEUID-01(C) 古いファイルで今のレシピの印を消さない',
        muC.after.recipes[0]?.uid === 'u-e2e-mine',
        JSON.stringify(muC.after.recipes),
      )
    } finally {
      await muBrowser.close()
    }
  }


  // --- JA-DUP-01(2026-08-22 便JA): 「今のデータに追加」で、同じ料理名のレシピが黙って入らない件。
  // オーナー原文「◯件入らなかったお知らせ→それでも入れるか聞く→はいで（２）、（３）...、とつけて
  // 入れる。いいえで重複して入れない。」／「懸念、『肉じゃが（２）』を重複で入れると、
  // 『肉じゃが（３）』ではなく『肉じゃが（２）（２）』になりそう。」
  // 実DBで守るのは5つ:
  //  ①追加できなかった品があれば、件数を出して「番号を付けて追加するか」を1回だけ聞く
  //  ②「はい」で番号が付いて入る／もとからある品は料理名も材料も変わらない
  //  ③1回の読み込みで同じ名前が2品あっても番号が続く／「(2) (2)」にならない（オーナーの懸念）
  //  ④中身まで同じ品では聞かない（自分のバックアップを読み直しただけで窓を出さない）
  //  ⑤「いいえ」なら1品も増えない（今までと同じ振る舞い） ---
  currentCheck = 'JA-DUP-01'
  {
    const jdBrowser = await chromium.launch()
    const JD_BASE = 'E2E重複肉じゃが'
    // 説明の括弧が付いた料理名（実在する品名の形。番号を外す処理がこれを壊さないこと）
    const JD_PAREN = 'E2Eレンジ蒸し鶏（自家製サラダチキン）'
    /** 端末に入っているこの検証のレシピを読む（料理名で並べる） */
    const jdRead = (page) =>
      page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const rows = await new Promise((resolve, reject) => {
          const r = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        idb.close()
        return rows
          .filter((r) => typeof r.title === 'string' && r.title.startsWith('E2E'))
          .map((r) => ({
            title: r.title,
            uid: r.uid,
            starter: r.isStarter === true,
            setId: r.sourceSetId,
            first: r.ingredients?.[0]?.name ?? '',
            logs: (r.cookedLogs ?? []).length,
            words: r.searchWords ?? [],
          }))
          .sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0))
      })
    /** ファイルの1品ぶんの形（中身は呼ぶ側が差し替える） */
    const jdRecipe = (over) => ({
      servings: 2,
      effortLevel: 'normal',
      tags: [],
      isFavorite: false,
      cookedLogs: [],
      searchWords: ['e2e'],
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      ...over,
    })
    /** 「今のデータに追加」でファイルを読み込む（ファイル選択後の確認は仕掛けの自動押しに任せる） */
    const jdImport = async (page, recipes) => {
      const [chooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: ja.settings.backupImportMerge }).click(),
      ])
      await chooser.setFiles({
        name: 'uchi-recipe-backup-ja.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ app: 'uchi-recipe', version: 1, exportedAt: '2026-08-22T00:00:00.000Z', recipes }),
          'utf-8',
        ),
      })
    }
    /**
     * 入らなかった品の窓（自前の目印なので仕掛けの自動押しは触らない）。
     * timeout を短くしすぎない＝写真の無い小さなファイルでも読み込みに数百msかかるため
     */
    const jdWindow = (page) => page.locator('[data-testid="confirm-duplicate-title"]')
    try {
      const jdCtx = await jdBrowser.newContext()
      const jdPage = await jdCtx.newPage()
      jdPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JA-DUP-01] ${err.message}`)
      })
      await jdPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jdPage.waitForTimeout(1800) // 初回シード完了待ち(まっさらなプロファイル)
      // 端末側の2品を直接入れる（Dexieを通さないので、このあと必ず読み込み直す＝禁じ手⑥）
      const jdIds = await jdPage.evaluate(
        async ([base, paren]) => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const add = (row) =>
            new Promise((resolve, reject) => {
              const tx = idb.transaction('recipes', 'readwrite')
              const r = tx.objectStore('recipes').add(row)
              tx.oncomplete = () => resolve(r.result)
              tx.onerror = () => reject(tx.error)
            })
          const common = {
            servings: 2,
            effortLevel: 'normal',
            tags: [],
            isFavorite: false,
            cookedLogs: [],
            searchWords: ['e2e'],
            createdAt: 1700000000000,
            updatedAt: 1700000000000,
          }
          const baseId = await add({
            ...common,
            uid: 'u-jd-mine',
            title: base,
            ingredients: [{ name: '牛こま切れ肉', amount: '200', unit: 'g' }],
            steps: [{ text: '今の端末の手順' }],
          })
          const parenId = await add({
            ...common,
            uid: 'u-jd-paren',
            title: paren,
            ingredients: [{ name: '鶏むね肉', amount: '1', unit: '枚' }],
            steps: [{ text: '今の端末の手順' }],
          })
          idb.close()
          return { baseId, parenId }
        },
        [JD_BASE, JD_PAREN],
      )
      await jdPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await jdPage.reload({ waitUntil: 'networkidle' }) // 生書き込みを画面へ届かせる（禁じ手⑥）
      await jdPage.waitForTimeout(1500)
      const jdBefore = await jdRead(jdPage)
      check('JA-DUP-01 前提: 端末に2品を入れられた', jdBefore.length === 2, JSON.stringify(jdBefore))

      // ---- ①②④: 中身が違う2品は聞く／中身が同じ1品は数に入れない ----
      await jdImport(jdPage, [
        jdRecipe({
          id: jdIds.baseId,
          uid: 'u-jd-file-a',
          title: JD_BASE,
          // 基本レシピの目印を付けたまま渡す（番号を付けた品では外れていること＝②の裏取り）
          isStarter: true,
          ingredients: [{ name: '豚こま切れ肉', amount: '200', unit: 'g' }],
          steps: [{ text: 'ファイル側の手順A' }],
          cookedLogs: [{ date: '2026-01-05', note: 'E2Eファイル側の記録' }],
        }),
        jdRecipe({
          id: jdIds.baseId,
          uid: 'u-jd-file-same',
          title: JD_BASE,
          // 端末にある品と中身がそっくり同じ＝入らなくても失うものが無いので数に入れない
          ingredients: [{ name: '牛こま切れ肉', amount: '200', unit: 'g' }],
          steps: [{ text: '今の端末の手順' }],
        }),
        jdRecipe({
          id: jdIds.parenId,
          uid: 'u-jd-file-p',
          title: JD_PAREN,
          ingredients: [{ name: '鶏もも肉', amount: '1', unit: '枚' }],
          steps: [{ text: 'ファイル側の手順P' }],
        }),
      ])
      await jdWindow(jdPage).waitFor({ state: 'visible', timeout: 15000 })
      const jdAskText = (await jdWindow(jdPage).textContent()).replaceAll('​', '')
      check(
        'JA-DUP-01① 入らなかった品数を出して聞く（中身まで同じ品は数に入れない）',
        /2品/.test(jdAskText) && !/3品/.test(jdAskText),
        jdAskText,
      )
      check(
        'JA-DUP-01① 押すと何が起きるかがボタンの言葉で分かる',
        (await jdPage.locator('[data-testid="confirm-duplicate-title-ok"]').innerText()).includes('番号'),
        await jdPage.locator('[data-testid="confirm-duplicate-title-ok"]').innerText(),
      )
      await jdPage.locator('[data-testid="confirm-duplicate-title-ok"]').click()
      await jdPage.waitForTimeout(1500)
      const jdAfter1 = await jdRead(jdPage)
      const jdTitles1 = jdAfter1.map((r) => r.title)
      check(
        'JA-DUP-01② 番号を付けた品が入る（説明の括弧が付いた料理名も壊さない）',
        jdTitles1.includes(`${JD_BASE} (2)`) && jdTitles1.includes(`${JD_PAREN} (2)`),
        JSON.stringify(jdTitles1),
      )
      const jdOriginal = jdAfter1.find((r) => r.title === JD_BASE)
      check(
        'JA-DUP-01② もとからある品は料理名も材料も変えない',
        jdOriginal?.first === '牛こま切れ肉',
        JSON.stringify(jdOriginal),
      )
      const jdCopy = jdAfter1.find((r) => r.title === `${JD_BASE} (2)`)
      check(
        'JA-DUP-01② 番号を付けた品にはファイル側の材料が入る',
        jdCopy?.first === '豚こま切れ肉',
        JSON.stringify(jdCopy),
      )
      check(
        'JA-DUP-01② 番号を付けた品は基本レシピ扱いにしない（「基本レシピを入れ直す」で消えないように）',
        jdCopy?.starter === false,
        JSON.stringify(jdCopy),
      )
      check(
        'JA-DUP-01② 番号を付けた品では作った記録を二重にしない（記録は今ある品へ足してある）',
        jdCopy?.logs === 0 && jdOriginal?.logs === 1,
        JSON.stringify([jdCopy?.logs, jdOriginal?.logs]),
      )
      check(
        'JA-DUP-01② 番号を付けた料理名で検索できる（検索語を作り直している）',
        (jdCopy?.words ?? []).some((w) => w.includes('(2)')),
        JSON.stringify(jdCopy?.words),
      )
      const jdBody1 = (await jdPage.textContent('body')).replaceAll('​', '')
      // 2026-08-27 便LS: 「足す」を「追加」にそろえた（オーナー指示）。文字を書き写さず
      // ja.ts の型紙に件数を埋めて突き合わせる
      const jdAdded2 = ja.settings.backupImportDuplicateAdded.replace('{n}', '2')
      const jdMergeLead = ja.settings.backupImportMergeResult.split('{a}')[0]
      check(
        'JA-DUP-01② 何品を追加したかを画面に残す',
        jdBody1.includes(jdAdded2),
        jdBody1.slice(jdBody1.indexOf(jdMergeLead), jdBody1.indexOf(jdMergeLead) + 160),
      )

      // ---- ④: 中身まで同じ品しか無いファイルでは聞かない（黙って読み込みが終わる） ----
      await jdImport(jdPage, [
        jdRecipe({
          id: jdIds.baseId,
          uid: 'u-jd-file-same2',
          title: JD_BASE,
          ingredients: [{ name: '牛こま切れ肉', amount: '200', unit: 'g' }],
          steps: [{ text: '今の端末の手順' }],
        }),
      ])
      await jdPage.waitForTimeout(2000)
      check(
        'JA-DUP-01④ 中身まで同じ品しか無いときは聞かない（読み直しただけで窓を出さない）',
        (await jdWindow(jdPage).count()) === 0,
        await jdWindow(jdPage).first().textContent().catch(() => ''),
      )

      // ---- ③: 「肉じゃが (2)」を入れ直しても「肉じゃが (2) (2)」にしない ----
      // 1回の読み込みで同じ元の名前の品が2つあるので、番号が (3)(4) と続くことも同時に見る
      await jdImport(jdPage, [
        jdRecipe({
          // ①で入れた「(2)」の品と印が一致する＝同じ品の書き換え版が届いた場面
          uid: 'u-jd-file-a',
          title: `${JD_BASE} (2)`,
          ingredients: [{ name: '合いびき肉', amount: '200', unit: 'g' }],
          steps: [{ text: 'ファイル側の手順A2' }],
        }),
        jdRecipe({
          id: jdIds.baseId,
          uid: 'u-jd-file-b',
          title: JD_BASE,
          ingredients: [{ name: '鶏ひき肉', amount: '200', unit: 'g' }],
          steps: [{ text: 'ファイル側の手順B' }],
        }),
      ])
      await jdWindow(jdPage).waitFor({ state: 'visible', timeout: 15000 })
      await jdPage.locator('[data-testid="confirm-duplicate-title-ok"]').click()
      await jdPage.waitForTimeout(1500)
      const jdTitles2 = (await jdRead(jdPage)).map((r) => r.title)
      const jdBaseTitles = jdTitles2.filter((t) => t.startsWith(JD_BASE))
      check(
        'JA-DUP-01③ 番号の付いた品を入れ直しても「(2) (2)」にならない（オーナーの懸念）',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        jdBaseTitles.length > 0 && jdBaseTitles.every((t) => !/\(\d+\)\s*\(\d+\)$/.test(t)),
        JSON.stringify(jdBaseTitles),
      )
      check(
        'JA-DUP-01③ 1回の読み込みで同じ名前が2品あっても番号が続く',
        jdBaseTitles.includes(`${JD_BASE} (3)`) && jdBaseTitles.includes(`${JD_BASE} (4)`),
        JSON.stringify(jdBaseTitles),
      )
      check(
        'JA-DUP-01③ 同じ料理名を2つ作らない',
        new Set(jdBaseTitles).size === jdBaseTitles.length,
        JSON.stringify(jdBaseTitles),
      )

      // ---- ⑤: 「いいえ」なら1品も増えない ----
      const jdCountBefore = (await jdRead(jdPage)).length
      await jdImport(jdPage, [
        jdRecipe({
          id: jdIds.baseId,
          uid: 'u-jd-file-c',
          title: JD_BASE,
          ingredients: [{ name: '豚バラ肉', amount: '200', unit: 'g' }],
          steps: [{ text: 'ファイル側の手順C' }],
        }),
      ])
      await jdWindow(jdPage).waitFor({ state: 'visible', timeout: 15000 })
      await jdPage.locator('[data-testid="confirm-duplicate-title-cancel"]').click()
      await jdPage.waitForTimeout(1200)
      check(
        'JA-DUP-01⑤ 「やめる」を選ぶと1品も増えない',
        (await jdRead(jdPage)).length === jdCountBefore,
        JSON.stringify((await jdRead(jdPage)).map((r) => r.title)),
      )
      const jdBody3 = (await jdPage.textContent('body')).replaceAll('​', '')
      check(
        'JA-DUP-01⑤ 追加しなかったことも画面に残す（黙って終わらせない）',
        jdBody3.includes(ja.settings.backupImportDuplicateDeclined.replace('{n}', '1')),
        jdBody3.slice(-200),
      )
    } finally {
      await jdBrowser.close()
    }
  }

  // --- FILESAVE-01(2026-07-17バックアップ改修 修正2+3): 保存先選択+前回の場所に上書き。
  // 実ブラウザのFile System Access APIはネイティブのOS保存ダイアログを伴うため、Playwrightの
  // headless chromiumでは`showSaveFilePicker`自体が存在しない(=既定では非対応ブラウザ扱いになる。
  // 実測確認済み)。そのため、このチェックだけaddInitScriptで`window.showSaveFilePicker`を
  // 注入し「対応ブラウザ」を模して、以下2点を実コードで検証する:
  // (a) 保存先の記録が無い間は「前回の場所に上書き」ボタンが出ない→IndexedDBのfileHandles
  //     テーブルに記録を直接投入→再訪問でボタンが出る(表示分岐そのもの=hasSavedFileHandle/
  //     useEffectの実コードを通す)
  // (b) 「ファイルに書き出す」「前回の場所に上書き」を押しても、ピッカーがキャンセル
  //     (AbortError)扱いになったときエラー表示が出ない(isAbortErrorの実コードを通す)
  // 注意: 本物のFileSystemFileHandle(createWritable等のメソッド持ち)はブラウザネイティブの
  // structured clone対応があるためIndexedDBに保存できるが、JSで自作した偽handleは関数を
  // 持つとDataCloneErrorになり保存できない。そのため実際の書き込み内容(JSON)の往復までは
  // ここでは検証できず、その部分はscripts/test-logic.mjsの単体テスト(backupFileName/
  // isAbortError/supportsSaveFilePicker)とコードレビューで担保する(報告に明記) ---
  currentCheck = 'FILESAVE-01'
  {
    const fsBrowser = await chromium.launch()
    try {
      const fsContext = await fsBrowser.newContext()
      const fsPage = await fsContext.newPage()
      fsPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FILESAVE-01] ${err.message}`)
      })
      fsPage.on('dialog', (dialog) => dialog.accept())
      // 「対応ブラウザ」を模す: showSaveFilePickerを注入する(呼ばれたら常にキャンセル扱い)
      await fsContext.addInitScript(() => {
        // webdriverガード(supportsSaveFilePicker)を明示フラグで解除し、偽ピッカーで
        // ピッカー経路のUI分岐を検証する(フラグ無しの通常e2eは常にDLフォールバック経路)
        window.__e2eForceFilePicker = true
        window.showSaveFilePicker = async () => {
          throw new DOMException('e2e fake picker: canceled', 'AbortError')
        }
      })

      await fsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(1800) // 初回シード完了待ち
      await fsPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(500)
      await fsPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await fsPage.waitForTimeout(300)

      check(
        'FILESAVE-01(a) 保存先の記録が無い間は「前回の場所に上書き」ボタンが出ない',
        !(await fsPage.textContent('body')).includes('前回の場所に上書き'),
      )

      // 「ファイルに書き出す」→対応ブラウザ扱いなので注入したshowSaveFilePickerが呼ばれ、
      // AbortErrorでキャンセル扱いになる。エラートーストが出ないことを確認する
      await fsPage.getByRole('button', { name: 'ファイルに書き出す' }).click()
      await fsPage.waitForTimeout(500)
      check(
        'FILESAVE-01(b) ピッカーをキャンセル(AbortError)してもエラー表示が出ない',
        !(await fsPage.textContent('body')).includes('保存に失敗しました'),
      )

      // IndexedDBのfileHandlesテーブルに保存先ハンドルの記録を直接投入し(本物のhandleは
      // structured cloneでしか作れないため、表示分岐の検証用に中身を問わない記録だけを置く)、
      // 再訪問(再マウント)で「前回の場所に上書き」ボタンが出ることを確認する
      await fsPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('fileHandles', 'readwrite')
          // 便CJ/C10: 注記にファイル名が出ることを確認するため、偽handleにもnameを持たせる
          tx.objectStore('fileHandles').put({
            id: 1,
            handle: { name: 'uchi-recipe-backup-e2e.json' },
            savedAt: Date.now(),
          })
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })
      // 既に#/settingsに居るためgotoではハッシュ同一=再マウントされない(Dexie/React側は
      // 初回マウント時の判定のまま)。本物のreloadで再マウントさせる(便Zと同じ既知の落とし穴)
      await fsPage.reload({ waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(800)
      await fsPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await fsPage.waitForTimeout(300)
      check(
        'FILESAVE-01(a) 保存先の記録がある状態で再訪問すると「前回の場所に上書き」ボタンが出る',
        (await fsPage.textContent('body')).includes('前回の場所に上書き'),
      )
      check(
        'FILESAVE-01(a) 便CJ/C10: 上書き先のファイル名が注記に出る(どのファイルに上書きされるか分かる)',
        (await fsPage.textContent('body')).includes(
          '前回選んだファイル「uchi-recipe-backup-e2e.json」にそのまま上書き保存します',
        ),
      )

      // 「前回の場所に上書き」: 記録した偽handleにはrequestPermission等のメソッドが無いため
      // overwriteSavedFileが例外を投げ、保存先選択(注入したshowSaveFilePicker)へ
      // フォールバックする。そちらもAbortError扱いになるため、結局エラー表示は出ない
      await fsPage.getByRole('button', { name: ja.settings.backupOverwrite }).click()
      await fsPage.waitForTimeout(500)
      check(
        'FILESAVE-01(b) 上書き失敗→保存先選択へフォールバックしてもエラー表示が出ない',
        !(await fsPage.textContent('body')).includes('保存に失敗しました'),
      )
    } finally {
      await fsBrowser.close()
    }
  }

  // --- IMPORTCONFIRM-01: 「読み込む(今のデータと置き換え)」は押した瞬間に確認なしでファイル選択
  // ダイアログが開いてしまっていた穴(2026-07-16 UI総点検P6 高重要度所見・オーナーのデータ消失事故の
  // 再発防止)を、ファイル選択を開く前にwindow.confirmを挟むことで塞いだ。(a)ボタン押下で実際に
  // confirmダイアログが出ること (b)キャンセルするとファイル選択(filechooser)には進まないこと
  // (c)承認(accept)すると実際にファイル選択へ進むこと、の3点を確認する。承認後に実際のファイルを
  // 選んで復元まで成功することはBACKUP-01で確認済みのため、ここではfilechooserが開くところまでに留める ---
  currentCheck = 'IMPORTCONFIRM-01'
  {
    const icBrowser = await chromium.launch()
    try {
      const icContext = await icBrowser.newContext()
      const icPage = await icContext.newPage()
      icPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IMPORTCONFIRM-01] ${err.message}`)
      })
      await icPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(1800) // 初回シード完了待ち
      await icPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(500)
      await icPage.getByRole('button', { name: ja.settings.tabBackup, exact: true }).click()
      await icPage.waitForTimeout(300)

      // (a)(b) ボタン押下でconfirmダイアログが実際に出ることを検知し、キャンセル(dismiss)する。
      // キャンセルした場合はファイル選択(filechooser)には進まないはず。
      // 2026-08-15 便GW: 確認は画面の中の窓になったので、窓を見て自分で押す
      // （仕掛けの自動押しはブラウザから「利用者の操作」として扱われず、ファイル選択が開けない）
      await setConfirmAnswer(icPage, 'off')
      let filechooserFired = false
      icPage.once('filechooser', () => {
        filechooserFired = true
      })
      await icPage.getByRole('button', { name: ja.settings.backupImportReplace }).click()
      await icPage.waitForTimeout(500)
      const icConfirm = icPage.locator('[data-testid="confirm"]')
      const icConfirmText = ((await icConfirm.textContent().catch(() => '')) ?? '').replaceAll('​', '')
      check(
        'IMPORTCONFIRM-01 置き換えボタン押下で画面の中の確認の窓が出る',
        (await icConfirm.count()) === 1 && icConfirmText.includes('内容で上書きします'),
        `confirm=${icConfirmText}`,
      )
      await icPage.locator('[data-testid="confirm-cancel"]').click()
      await icPage.waitForTimeout(400)
      check(
        'IMPORTCONFIRM-01 確認を「やめる」で閉じるとファイル選択(filechooser)には進まない',
        !filechooserFired,
      )
      check('IMPORTCONFIRM-01 「やめる」で窓が閉じる', (await icConfirm.count()) === 0)

      // (c) 同じボタンをもう一度押し、今度は「上書きする」を押すと実際にファイル選択へ進むこと
      const icChooser = icPage.waitForEvent('filechooser')
      await icPage.getByRole('button', { name: ja.settings.backupImportReplace }).click()
      await icPage.locator('[data-testid="confirm-ok"]').click()
      const fileChooser = await icChooser
      check('IMPORTCONFIRM-01 「上書きする」を押すとファイル選択(filechooser)が開く', !!fileChooser)
      await setConfirmAnswer(icPage, 'accept')
    } finally {
      await icBrowser.close()
    }
  }

  // --- PRO-FALLBACK-01: crypto.subtleが使えないinsecure context(開発中LANのhttp://192.168.x.x
  // 等でのiPhone実機テストが該当。docs/22)でも、純JSのSHA-256フォールバック(src/logic/sha256.ts)
  // でPro解錠コード検証が最後まで動くことを確認する(2026-07-13)。crypto.subtleの有無自体は
  // オリジンがhttp/httpsかで決まらずaddInitScriptで直接再現できるが、production buildの
  // 挙動を見るため他チェックのdevサーバーとは別にpreviewサーバーを自前で立てる(ポートは空きを取る) ---
  currentCheck = 'PRO-FALLBACK-01'
  {
    const distIndex = path.join(appRoot, 'dist', 'index.html')
    if (!existsSync(distIndex)) {
      // このチェックはproductionビルド(dist)のpreview前提。無ければ先にビルドする
      execSync('npx vite build', { cwd: appRoot, stdio: 'inherit' })
    }

    // ポートは空きを取る(2026-08-09 便EM。旧: 4194固定。並行して走る別のe2eと衝突して
    // 偽の失敗になっていた)。E2E_PREVIEW_PORT で明示指定もできる
    const { proc: previewProc, base: PREVIEW_BASE } = await startPreviewServer({
      envName: 'E2E_PREVIEW_PORT',
      label: 'PRO-FALLBACK-01',
    })

    try {
      const fbBrowser = await chromium.launch()
      try {
        const fbContext = await fbBrowser.newContext()
        const fbPage = await fbContext.newPage()
        // insecure context相当を再現: crypto.subtleを未定義化する(実機LAN httpと同じ状況)
        await fbPage.addInitScript(() => {
          Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true })
        })
        await fbPage.goto(`${PREVIEW_BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
        await fbPage.waitForTimeout(800)
        const subtleGone = await fbPage.evaluate(() => typeof window.crypto.subtle === 'undefined')
        check('PRO-FALLBACK-01 前提: crypto.subtleを無効化できている', subtleGone)

        // テスト用Pro解錠コード(docs/22の実機確認チェックリスト記載。販売用ではない)。
        // 2026-07-17設定ゼロベース裁定#7: Pro/追加レシピパックの入力欄が1つに統合された
        await fbPage.getByPlaceholder(ja.settings.unlockCodePlaceholder).fill('UR-96QS-2VSZ')
        await fbPage.getByRole('button', { name: ja.settings.unlockActivate, exact: true }).first().click()
        await fbPage.waitForTimeout(1000)
        const fbText = await fbPage.textContent('body')
        check(
          'PRO-FALLBACK-01 crypto.subtle無効でも純JSフォールバックでPro解錠が通る',
          fbText.includes(ja.settings.proActivatedTitle),
          fbText.includes(ja.settings.proInvalidCode)
            ? 'コード検証が失敗した(フォールバック不一致の疑い)'
            : `本文に成功メッセージなし: ${fbText.slice(0, 200)}`,
        )
      } finally {
        await fbBrowser.close()
      }
    } finally {
      previewProc.kill()
    }
  }

  // --- PRICEVIEW-01: レシピ詳細の材料「原価ビュー」トグル。2026-07-15新設・2026-07-16裁定1で
  // 全面改修・2026-07-20 便AJ(docs/45)で再改修。「原価を見る」(閲覧)/「原価を編集」(単価編集)の
  // 2チップに分離し、原価サマリーカードは廃止(上部メタ行の概算食費「約◯円」「1食あたり
  // 約◯円」と重複していたため)。2026-07-21 オーナー実機FBで、横並びの独立トグルから
  // 「見る」を押すと「編集」ボタンが出現する階層構造(hidden→view→edit)に変更。
  // 「見る」は開閉の親トグル(view/edit中に再度押すと編集ボタンごとhiddenへ両方解除)、
  // 「編集」はview⇔editの子トグル(見るを閉じない限り出続ける)。基本レシピ「肉じゃが」
  // (servings=2)で検証する: 非表示(既定)は材料セクションに金額表示が無く「原価を編集」
  // ボタンも存在しないこと→「原価を見る」ONで「原価を編集」ボタンが出現し、各材料行の
  // 使用量表示が1食あたりの按分原価(「約◯円」・登録人数固定・タップ不可)に差し替わり、
  // マスタ不一致(水)は「価格なし」になること→「原価を編集」ONで(「原価を見る」は選択中の
  // ままaria-pressed=true)使用量表示が「{価格}円/{単位}」チップ(マスタ不一致は
  // 「価格なし＋登録」)に差し替わることを確認したうえで、
  // (a)チップタップ→価格編集→保存で、その行のチップ・上部メタ行の概算食費・原価を見る側の
  //    按分原価が同時に更新されること、
  // (b)「価格なし」材料(水)の「＋登録」→登録モーダル→保存でチップ化すること、の2シナリオと、
  // 「原価を見る」を選択中にもう一度押すと「原価を編集」ボタンごと非表示に戻ることを確認する ---
  currentCheck = 'PRICEVIEW-01'
  {
    const pvBrowser = await chromium.launch()
    const pvContext = await pvBrowser.newContext()
    const pvPage = await pvContext.newPage()
    pvPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PRICEVIEW-01] ${err.message}`)
    })
    try {
      await pvPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pvPage.waitForTimeout(1800) // 初回シード完了待ち
      await pvPage.getByText('肉じゃが', { exact: true }).first().click()
      await pvPage.waitForTimeout(500)

      // 材料セクション(見出し「材料」を含むsection)だけを対象にする。ページ上部の
      // 概算食費(合計・1食あたり)は原価ビューと無関係に元から「約◯円」を表示するため、
      // body全体ではなくこのsectionに絞らないとOFF時の検証が誤って通ってしまう
      const ingredientsSection = pvPage.locator('section', {
        has: pvPage.getByRole('heading', { name: '材料', level: 2 }),
      })
      // 2026-08-03 オーナー指示: 「原価を見る」は押した状態でラベルが「材料に戻す」に
      // 入れ替わる同一ボタンのトグルになった。開閉どちらの表記でも同じボタンを掴めるようにする
      const viewButton = pvPage.getByRole('button', { name: new RegExp(`^(${ja.detail.priceViewShow}|${ja.detail.priceViewHide})$`) })
      const editButton = pvPage.getByRole('button', { name: ja.detail.priceEditShow })
      const onionRow = ingredientsSection.locator('li', { hasText: '玉ねぎ' })
      const waterRow = ingredientsSection.locator('li', { hasText: '水' })

      const beforeText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 既定は非表示: 材料セクションに金額表示(円)が無い',
        !/[\d,]+円/.test(beforeText ?? ''),
        beforeText ?? '',
      )
      check('PRICEVIEW-01 既定は非表示: 玉ねぎの行は使用量(1個)のまま', (await onionRow.textContent())?.includes('1個') ?? false)
      check(
        'PRICEVIEW-01 既定は非表示: 「原価を編集」ボタンは存在しない(階層構造。見るを押すまで出現しない)',
        (await editButton.count()) === 0,
      )

      check(
        'PRICEVIEW-01(2026-08-03) 既定は「原価を見る」表記(戻す側の表記は出ていない)',
        (await pvPage.getByRole('button', { name: ja.detail.priceViewShow }).count()) === 1 &&
          (await pvPage.getByRole('button', { name: ja.detail.priceViewHide }).count()) === 0,
      )

      // ---------- 「原価を見る」ON: 「原価を編集」ボタンが出現し、各行が1食あたりの按分原価になる ----------
      await viewButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01 「原価を見る」ON: 押したボタンがaria-pressed=trueになる', (await viewButton.getAttribute('aria-pressed')) === 'true')
      // 2026-08-03 オーナー指示「押しても場所が変わらず、表示中は戻し方が分かる表記にする」の再発防止
      // 2026-08-22 司令部: 文言を**書き写していた**ため、便JJで「材料に戻す」→「材料を表示」に
      // したときに落ちた（禁じ手②）。測っているのは「押したらラベルが入れ替わる」ことなので、
      // ja.ts から読む形にする（文言が変わっても意図は変わらない）
      check(
        'PRICEVIEW-01(2026-08-03) 原価表示中はラベルが戻し方の名前に入れ替わる',
        (await pvPage.getByRole('button', { name: ja.detail.priceViewHide }).count()) === 1 &&
          (await pvPage.getByRole('button', { name: ja.detail.priceViewShow }).count()) === 0,
        `いま出ているラベル=${ja.detail.priceViewHide}`,
      )
      check('PRICEVIEW-01 「原価を見る」ON: 「原価を編集」ボタンが出現する(階層構造)', (await editButton.count()) === 1)
      const onText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「原価を見る」ON: 材料行に「約◯円」の按分原価が表示される(編集チップの「◯円/単位」形式は無い)',
        /約[\d,]+円/.test(onText ?? '') && !/[\d,]+円\/\S+/.test(onText ?? ''),
        onText ?? '',
      )
      check(
        // 2026-08-22 便JG: 材料行の金額は「1食あたり(登録人数で割った固定値)」から
        // 「いま画面に出ている分量ぶん」へ変えた。肉じゃがは登録2人分で既定表示も2人分なので、
        // 玉ねぎ1個ぶんの金額がそのまま出る(旧: ÷2人分)
        // 2026-08-26 便LF: 玉ねぎの目安価格を50→77円/1個にした（オーナー裁定）
        'PRICEVIEW-01 「原価を見る」ON: 玉ねぎの行が「約77円」になる(いま出ている分量=1個ぶん。便LFの前は50円)',
        (await onionRow.textContent())?.includes('約77円') ?? false,
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: マスタ不一致の材料(水)は「価格なし」になる(登録導線「＋登録」は出ない=非インタラクティブ)',
        ((await waterRow.textContent())?.includes('価格なし') ?? false) &&
          !((await waterRow.textContent())?.includes('＋登録') ?? false),
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: 材料行はタップしても何も起きない(ボタンが無い)',
        (await onionRow.getByRole('button').count()) === 0,
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: 原価サマリーカードは表示されない(便AJで廃止)',
        !(onText ?? '').includes('食材と価格を編集する') && !/1人分 約[\d,]+円/.test(onText ?? ''),
      )

      // ---------- 「原価を編集」ON: 階層構造なので「原価を見る」は選択中のまま、使用量表示だけチップに差し替わる ----------
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01 「原価を編集」ON: 「原価を見る」は選択中のまま(親トグルなのでaria-pressed=trueを維持)',
        (await viewButton.getAttribute('aria-pressed')) === 'true',
      )
      check('PRICEVIEW-01 「原価を編集」ON: 押したボタンがaria-pressed=trueになる', (await editButton.getAttribute('aria-pressed')) === 'true')
      const editText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「原価を編集」ON: 按分原価「約◯円」は消え、チップ表(◯円/単位)に差し替わる',
        !/約[\d,]+円/.test(editText ?? '') && /[\d,]+円\/\S+/.test(editText ?? ''),
        editText ?? '',
      )
      check(
        'PRICEVIEW-01 「原価を編集」ON: 玉ねぎの行に登録単位と価格のチップ(77円/1個)が出る',
        (editText ?? '').includes('77円/1個'),
      )
      check(
        'PRICEVIEW-01 「原価を編集」ON: マスタ不一致の材料(水)は「価格なし＋登録」になる',
        (editText ?? '').includes('価格なし') && (editText ?? '').includes('＋登録'),
      )
      check(
        `PRICEVIEW-01 「原価を編集」ON: 「${ja.detail.priceEditNote}」の説明が出る`,
        (editText ?? '').includes(ja.detail.priceEditNote),
      )

      // (a) チップ→編集→行・上部メタ・原価を見る側が同時に変化。玉ねぎ(77円/1個)を97円/1個に変更する
      const topMetaBefore = await pvPage.textContent('body')
      const topTotalBeforeMatch = (topMetaBefore ?? '').match(/約([\d,]+)円/)
      const topPerServingBeforeMatch = (topMetaBefore ?? '').match(/1食あたり 約([\d,]+)円/)
      check('PRICEVIEW-01(a) 編集前の上部メタ合計を取得できる', !!topTotalBeforeMatch)
      check('PRICEVIEW-01(a) 編集前の上部メタ1食あたりを取得できる', !!topPerServingBeforeMatch)
      const topTotalBefore = Number((topTotalBeforeMatch?.[1] ?? '0').replace(/,/g, ''))
      const topPerServingBefore = Number((topPerServingBeforeMatch?.[1] ?? '0').replace(/,/g, ''))

      await onionRow.getByRole('button').click()
      await pvPage.waitForTimeout(300)
      const priceEditDialog = pvPage.getByRole('dialog')
      check(
        'PRICEVIEW-01(a) チップタップで編集モーダルが開き、タイトルが食材名(玉ねぎ)になる(名前は編集不可)',
        (await priceEditDialog.textContent())?.includes('玉ねぎ') ?? false,
      )
      check(
        'PRICEVIEW-01(a) 編集モーダルに現在の価格(77)が入っている',
        (await priceEditDialog.getByLabel(ja.priceMaster.priceLabel).inputValue()) === '77',
      )
      // 97円にすると差は+20円で、下の「差分どおり増える」の見方を変えずに済む
      await priceEditDialog.getByLabel(ja.priceMaster.priceLabel).fill('97')
      await priceEditDialog.getByRole('button', { name: '保存する' }).click()
      await pvPage.waitForTimeout(400)
      check('PRICEVIEW-01(a) 保存後は編集モーダルが閉じる', (await pvPage.getByRole('dialog').count()) === 0)
      check(
        'PRICEVIEW-01(a) 保存後、玉ねぎの行のチップが97円/1個に変わる',
        ((await onionRow.textContent())?.includes('97円/1個') ?? false) &&
          !((await onionRow.textContent())?.includes('77円/1個') ?? false),
      )

      const topMetaAfter = await pvPage.textContent('body')
      const topTotalAfterMatch = (topMetaAfter ?? '').match(/約([\d,]+)円/)
      const topPerServingAfterMatch = (topMetaAfter ?? '').match(/1食あたり 約([\d,]+)円/)
      const topTotalAfter = Number((topTotalAfterMatch?.[1] ?? '0').replace(/,/g, ''))
      const topPerServingAfter = Number((topPerServingAfterMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'PRICEVIEW-01(a) 価格編集で上部メタ合計が差分どおり増える(77→97円は+20)',
        topTotalAfter - topTotalBefore === 20,
        `before=${topTotalBefore} after=${topTotalAfter}`,
      )
      check(
        'PRICEVIEW-01(a) 価格編集で上部メタ1食あたりも増える(原価ビューと無関係に追従)',
        topPerServingAfter > topPerServingBefore,
        `before=${topPerServingBefore} after=${topPerServingAfter}`,
      )

      // 「原価を編集」をもう一度押して(子トグルでedit→view)「原価を見る」表示に戻ると、
      // 編集した97円がそのまま按分原価(97÷2人分=約49円)に反映される
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01(a) 編集を閉じてview表示に戻ると、「原価を見る」がaria-pressed=true・「原価を編集」がaria-pressed=falseになる',
        (await viewButton.getAttribute('aria-pressed')) === 'true' &&
          (await editButton.getAttribute('aria-pressed')) === 'false',
      )
      check(
        'PRICEVIEW-01(a) 「原価を見る」表示に戻ると、玉ねぎの金額が編集後の価格で再計算される(1個ぶん=約97円)',
        (await onionRow.textContent())?.includes('約97円') ?? false,
      )

      // (b) 価格なし→登録→チップ化。「水」に価格が無い状態から「原価を編集」の「＋登録」で新規登録する
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01(b) 登録前は「水」の行が「価格なし」', (await waterRow.textContent())?.includes('価格なし') ?? false)
      await waterRow.getByRole('button').click()
      await pvPage.waitForTimeout(300)
      const addDialog = pvPage.getByRole('dialog')
      check(
        'PRICEVIEW-01(b) 「＋登録」で登録モーダルが開き、名前欄に「水」が初期値で入る(編集可)',
        (await addDialog.getByLabel(ja.priceMaster.nameLabel).inputValue()) === '水',
      )
      await addDialog.getByLabel(ja.priceMaster.priceLabel).fill('10')
      await addDialog.getByLabel(ja.priceMaster.quantityLabel, { exact: true }).fill('1')
      await addDialog.getByLabel('単位', { exact: true }).selectOption('L')
      await addDialog.getByRole('button', { name: '保存する' }).click()
      await pvPage.waitForTimeout(400)
      check('PRICEVIEW-01(b) 保存後は登録モーダルが閉じる', (await pvPage.getByRole('dialog').count()) === 0)
      check(
        'PRICEVIEW-01(b) 登録後、「水」の行が10円/1Lのチップに変わり「価格なし」は消える',
        ((await waterRow.textContent())?.includes('10円/1L') ?? false) &&
          !((await waterRow.textContent())?.includes('価格なし') ?? false),
      )

      // 「原価を編集」をもう一度押して(子トグルでedit→view)「原価を見る」表示に戻ると、
      // 登録した水(300ml分・10円/1L→3円÷2人分=1.5→四捨五入2円)も按分原価が出る
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01(b) 登録後「原価を見る」表示で水の行にも金額が出る(300ml分=約3円)',
        (await waterRow.textContent())?.includes('約3円') ?? false,
      )

      // ---------- 選択中の「原価を見る」をもう一度押すと「原価を編集」ボタンごと非表示に戻る ----------
      await viewButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01 「原価を見る」を再度押すと非表示になる: aria-pressed=false', (await viewButton.getAttribute('aria-pressed')) === 'false')
      check(
        'PRICEVIEW-01(2026-08-03) 非表示に戻るとラベルも「原価を見る」に戻る',
        (await pvPage.getByRole('button', { name: ja.detail.priceViewShow }).count()) === 1 &&
          (await pvPage.getByRole('button', { name: ja.detail.priceViewHide }).count()) === 0,
      )
      check(
        'PRICEVIEW-01 非表示に戻る: 「原価を編集」ボタンも消える(階層構造)',
        (await editButton.count()) === 0,
      )
      const afterText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 非表示に戻る: 金額表示(按分原価・チップとも)が消える',
        !/[\d,]+円/.test(afterText ?? ''),
        afterText ?? '',
      )
      check('PRICEVIEW-01 非表示に戻る: 水の行は使用量(300ml)表示に戻る', (await waterRow.textContent())?.includes('300ml') ?? false)
    } finally {
      await pvBrowser.close()
    }
  }

  // --- JGCOST-01(2026-08-22 便JG): レシピ詳細の原価が「いま出ている人数分」に追随することと、
  // 価格が分からない材料があるときに金額へ印が付くこと。
  // オーナー原文「原価が、人数分の表示に合わせて計算されていない。人数の増減で数値が変わらない。
  // 何人分を表示しているの？」「写真下の原価表示は、『価格なし』が複数…ある場合には、
  // 目安とはいえ実際と大きく異なることを記号でお知らせして欲しい。NG食材の表記と場所の取り合いになる？」。
  // 肉じゃが(登録2人分・材料8件)で見る。①人数を動かすと材料行の金額と写真下の合計が一緒に動く
  // ②価格が分かる材料しか無いうちは印が出ない ③「食材と価格」からじゃがいもを消すと印と1行の説明が出る
  // ④印は金額の文字に添えるだけで、NG食材の札とは別（札を増やして行を折り返させない）---
  currentCheck = 'JGCOST-01'
  {
    const jgBrowser = await chromium.launch()
    const jgContext = await jgBrowser.newContext()
    const jgPage = await jgContext.newPage()
    jgPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JGCOST-01] ${err.message}`)
    })
    try {
      await jgPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jgPage.waitForTimeout(1800) // 初回シード完了待ち
      await jgPage.getByText('肉じゃが', { exact: true }).first().click()
      await jgPage.waitForTimeout(500)

      const jgIngredients = jgPage.locator('section', {
        has: jgPage.getByRole('heading', { name: '材料', level: 2 }),
      })
      const jgOnionRow = jgIngredients.locator('li', { hasText: '玉ねぎ' })
      const jgViewButton = jgPage.getByRole('button', { name: new RegExp(`^(${ja.detail.priceViewShow}|${ja.detail.priceViewHide})$`) })
      const jgUp = jgPage.getByRole('button', { name: ja.detail.servingsUp })
      const jgDown = jgPage.getByRole('button', { name: ja.detail.servingsDown })
      // 写真下の合計「約◯円」だけを読む（1食あたりの行と混ざらないよう、行の先頭側から取る）
      const readTotalYen = async () => {
        const body = (await jgPage.textContent('body')) ?? ''
        const m = body.match(/約([\d,]+)円/)
        return m ? Number(m[1].replace(/,/g, '')) : null
      }

      // ---------- ①人数を動かすと材料行の金額も写真下の合計も一緒に動く ----------
      await jgViewButton.click()
      await jgPage.waitForTimeout(300)
      const jgTotal2 = await readTotalYen()
      check(
        // 2026-08-26 便LF: 玉ねぎの目安価格を50→77円/1個にした（オーナー裁定「ORIGINAL_30 の
        // ピン留めを外して並の実勢へ」。根拠は src/data/priceDefaults.ts の玉ねぎの行のコメント）
        'JGCOST-01 既定(登録どおりの2人分)は玉ねぎ1個ぶんの77円',
        (await jgOnionRow.textContent())?.includes('約77円') ?? false,
        await jgOnionRow.textContent(),
      )
      await jgUp.click()
      await jgPage.waitForTimeout(300)
      const jgTotal3 = await readTotalYen()
      check(
        'JGCOST-01 3人分にすると玉ねぎの行が1.5倍(約116円)になる',
        (await jgOnionRow.textContent())?.includes('約116円') ?? false,
        await jgOnionRow.textContent(),
      )
      check(
        'JGCOST-01 写真下の合計も3人分ぶんに増える',
        jgTotal2 != null && jgTotal3 != null && jgTotal3 > jgTotal2,
        `2人分=${jgTotal2} 3人分=${jgTotal3}`,
      )
      await jgDown.click()
      await jgDown.click()
      await jgPage.waitForTimeout(300)
      check(
        'JGCOST-01 1人分にすると玉ねぎの行が半分(約39円)になる',
        (await jgOnionRow.textContent())?.includes('約39円') ?? false,
        await jgOnionRow.textContent(),
      )
      // 登録どおりの2人分に戻してから、印の検査へ進む
      await jgUp.click()
      await jgPage.waitForTimeout(300)

      // ---------- ②価格が分かる材料しか無いうちは印も説明も出ない ----------
      const jgBeforeBody = (await jgPage.textContent('body')) ?? ''
      check(
        'JGCOST-01 価格が全部そろっている品には「価格が分からない材料」の説明が出ない',
        !new RegExp(ja.detail.costPricelessNote.replace('{n}', '\\d+')).test(jgBeforeBody),
      )
      check(
        'JGCOST-01 そのときは金額のうしろに印も付かない',
        !/約[\d,]+円※/.test(jgBeforeBody),
        jgBeforeBody.slice(0, 200),
      )
      const jgTotalBefore = await readTotalYen()

      // ---------- ③「食材と価格」からじゃがいもを消す＝価格が分からない材料が1件できる ----------
      await jgPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await jgPage.waitForTimeout(1000)
      await jgPage.locator(`input[aria-label="${ja.priceMaster.searchLabel}"]`).fill('じゃがいも')
      await jgPage.waitForTimeout(400)
      await jgPage.locator(`button[aria-label="${ja.priceMaster.remove}"]`).first().click()
      await jgPage.waitForTimeout(500)
      await jgPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jgPage.waitForTimeout(800)
      await jgPage.getByText('肉じゃが', { exact: true }).first().click()
      await jgPage.waitForTimeout(600)
      const jgAfterBody = (await jgPage.textContent('body')) ?? ''
      check(
        'JGCOST-01 価格が分からない材料が1件できると、金額のうしろに印が付く',
        /約[\d,]+円※/.test(jgAfterBody),
        jgAfterBody.slice(0, 300),
      )
      check(
        `JGCOST-01 印の意味が1行で出る（${ja.detail.costPricelessNote.replace('{n}', '1')}）`,
        jgAfterBody.includes(ja.detail.costPricelessNote.replace('{n}', '1')),
      )
      const jgTotalAfter = await readTotalYen()
      check(
        'JGCOST-01 その材料の分は合計に1円も入らない(=金額は必ず実際より安く出る)',
        jgTotalBefore != null && jgTotalAfter != null && jgTotalAfter < jgTotalBefore,
        `削除前=${jgTotalBefore} 削除後=${jgTotalAfter}`,
      )
      // ---------- ④印はNG食材の札と場所を取り合わない（札を増やしていない） ----------
      check(
        'JGCOST-01 印のために新しい札(枠付き)を増やしていない＝NG食材の札とは別の見せ方',
        (await jgPage.getByText(ja.detail.ngWarning).count()) === 0 &&
          /約[\d,]+円※/.test(jgAfterBody),
      )
    } finally {
      await jgBrowser.close()
    }
  }

  // --- SHARE-01: シェアの選択式モーダル(2026-07-16 Fable裁定docs/30 裁定3)。
  // 基本レシピ「豚汁」(材料9件・4人分・調理時間30分・材料に価格マスタのデフォルトあり)を使い、
  // (a)既定選択のテキストシェア(=chromiumではクリップボードへコピー)の文字列、
  // (b)「材料をすべて載せる」+「原価」ON時の文字列、(c)画像カードの生成成功(ダウンロード発生)
  // を確認する。クリップボードの読み取りにはcontextへの権限付与が必要 ---
  currentCheck = 'SHARE-01'
  {
    const shBrowser = await chromium.launch()
    const shContext = await shBrowser.newContext()
    await shContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
    const shPage = await shContext.newPage()
    shPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHARE-01] ${err.message}`)
    })
    try {
      await shPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await shPage.waitForTimeout(1800) // 初回シード完了待ち
      await shPage.getByText('豚汁', { exact: true }).first().click()
      await shPage.waitForTimeout(500)

      // シェアボタン→選択モーダル(旧インラインパネルは廃止)
      await shPage.locator(`button[aria-label="${ja.share.button}"]`).click()
      await shPage.waitForTimeout(300)
      const shareDialog = shPage.getByRole('dialog', { name: ja.share.dialogTitle })
      check('SHARE-01 シェアボタンで選択モーダルが開く', (await shareDialog.count()) === 1)
      const dialogText = (await shareDialog.textContent()) ?? ''
      // 2026-07-29 便CI/C10: 旧文「…作り方は常に入ります」は画像カードでは事実と違った
      // (generateShareCardは手順を描かない)。テキストにだけ作り方が入ることを明記した文言に変更
      check(
        'SHARE-01 固定項目の説明文言(料理名・人数分・材料8件)が出る',
        dialogText.includes(ja.share.alwaysIncluded.split('。')[0]),
        dialogText,
      )
      check(
        'SHARE-01/C10 「作り方が入るのはテキストだけ」と明記されている(画像カードに手順は入らない)',
        dialogText.includes(ja.share.alwaysIncluded.split('。')[1]) &&
          !dialogText.includes('作り方は常に入ります'),
        dialogText,
      )
      check(
        'SHARE-01/C14 テキストは貼り付けで取り込める旨が案内されている',
        dialogText.includes(ja.paste.open) && dialogText.includes('取り込めます'),
        dialogText,
      )
      check('SHARE-01 レシピ画像の行に「※画像カードのみ」が併記される', dialogText.includes('※画像カードのみ'))

      // 既定値: 画像ON・調理時間ON(豚汁はcookMinutesあり)・原価OFF・栄養OFF・材料全部OFF
      const optionCheckbox = (label) =>
        shareDialog.locator('label', { hasText: label }).locator('input[type="checkbox"]')
      check('SHARE-01 既定: レシピ画像ON', await optionCheckbox('レシピ画像').isChecked())
      check('SHARE-01 既定: 調理時間ON', await optionCheckbox('調理時間').isChecked())
      check('SHARE-01 既定: 原価OFF', !(await optionCheckbox('原価').isChecked()))
      check(
        // 2026-08-01 線引きB': 無料の栄養は「1食あたりのカロリー」だけ(塩分はPro解錠時のみ入る)。
        // チェック行ラベルから「（目安）」は削除済み・シェア本文側は法務配慮で残す
        "SHARE-01(B') 既定: 栄養OFF・無料のラベルは「1食あたりのカロリー」(塩分を含まない)",
        !(await optionCheckbox('1食あたりのカロリー').isChecked()) &&
          !dialogText.includes(ja.share.optNutrition),
      )
      check('SHARE-01 既定: 材料をすべて載せるOFF', !(await optionCheckbox('材料をすべて載せる').isChecked()))

      // (a) 既定選択のままテキストでシェア → chromiumはnavigator.share非対応のためコピーになる
      await shareDialog.getByRole('button', { name: ja.share.textOption }).click()
      await shPage.waitForTimeout(600)
      check(
        'SHARE-01(a) コピー完了メッセージがモーダル内に出る',
        stripZwspText(await shareDialog.textContent()).includes(ja.share.copied),
      )
      const copiedDefault = await shPage.evaluate(() => navigator.clipboard.readText())
      // 2026-07-23 便BJ・docs/55 CEO提案2-1: 料理名と人数分は別行(貼り付けパーサーが人数分だけの
      // 行として読み飛ばし、料理名を汚さないため)。作り方(全手順)も【作り方】見出しつきで入る
      check('SHARE-01(a) 料理名+人数分が別行', copiedDefault.includes('豚汁\n4人分'))
      check('SHARE-01(a) 調理時間行(既定ON)', copiedDefault.includes('調理時間 約30分'))
      check(
        'SHARE-01(a) 材料は8件+…ほか(9件目のごま油の材料行は入らない)',
        copiedDefault.includes('【材料】') &&
          copiedDefault.includes('…ほか') &&
          !copiedDefault.includes('・ごま油'),
      )
      check('SHARE-01(a) 作り方(全手順)が【作り方】見出しつきで入る', copiedDefault.includes('【作り方】'))
      check('SHARE-01(a) 「作り方は全◯ステップ」行が無い(裁定3で削除)', !copiedDefault.includes('作り方は全'))
      check(
        'SHARE-01(a) アプリ名とURLは必ず残る(宣伝枠)',
        copiedDefault.includes('#うちレシピ') && copiedDefault.includes('https://uchirecipe.com/'),
      )
      check(
        'SHARE-01(a) 原価・栄養は既定OFFで入らない',
        !copiedDefault.includes('原価') && !copiedDefault.includes('kcal'),
      )

      // (b) 材料をすべて載せる+原価ON → 全材料と原価行(登録人数4人分基準)が入る
      await optionCheckbox('材料をすべて載せる').check()
      await optionCheckbox('原価').check()
      await shareDialog.getByRole('button', { name: ja.share.textOption }).click()
      await shPage.waitForTimeout(600)
      const copiedFull = await shPage.evaluate(() => navigator.clipboard.readText())
      check(
        'SHARE-01(b) 全材料が入り…ほかが消える(9件目のごま油も入る)',
        copiedFull.includes('・ごま油') && !copiedFull.includes('…ほか'),
      )
      check(
        'SHARE-01(b) 原価行(1人分/全量・登録人数基準)が入る',
        /原価 1人分 約[\d,]+円／全量（4人分） 約[\d,]+円/.test(copiedFull),
      )

      // (b-2) 栄養ON(無料視点) → カロリーだけの栄養行が入り、塩分は入らない(2026-08-01 線引きB')
      await optionCheckbox('1食あたりのカロリー').check()
      await shareDialog.getByRole('button', { name: ja.share.textOption }).click()
      await shPage.waitForTimeout(600)
      const copiedNutrition = await shPage.evaluate(() => navigator.clipboard.readText())
      check(
        "SHARE-01(b-2/B') 無料の栄養行はカロリーだけ(概算表記は残す)",
        /1食あたり 約[\d,]+kcal（概算(・一部の材料を除く)?）/.test(copiedNutrition),
        copiedNutrition.split('\n').find((l) => l.includes('kcal')) ?? '栄養行なし',
      )
      check(
        "SHARE-01(b-2/B') 無料のシェア文に塩分は入らない",
        !copiedNutrition.includes('塩分'),
      )
      await optionCheckbox('1食あたりのカロリー').uncheck()

      // (c) 画像カードでシェア → 非対応環境ではPNGダウンロード(=生成成功のみ確認)
      const [download] = await Promise.all([
        shPage.waitForEvent('download', { timeout: 15000 }),
        shareDialog.getByRole('button', { name: ja.share.imageOption }).click(),
      ])
      check(
        'SHARE-01(c) 画像カードが生成されPNGダウンロードに切り替わる',
        download.suggestedFilename().endsWith('.png'),
        download.suggestedFilename(),
      )

      // (d) 往復(round-trip・2026-07-23 便BJ・docs/55 CEO提案2-1): (b)でコピーした全文をそのまま
      // 新規レシピに貼り付け、自動振り分けで材料・手順が過不足なく復元される=テキスト共有が
      // 「見る専用」ではなく端末間で丸ごと取り込める形式であることの実DOM実証。
      const ingLineCount = copiedFull.split('\n').filter((l) => l.startsWith('・')).length
      const stepLineCount = copiedFull.split('\n').filter((l) => /^\d+\.\s/.test(l)).length
      await shPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await shPage.waitForTimeout(500)
      await shPage.getByText(ja.paste.open).click()
      await shPage.waitForTimeout(300)
      await shPage.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(copiedFull)
      await shPage.getByRole('button', { name: ja.paste.apply }).click()
      await shPage.waitForTimeout(400)
      const rtFormText = await shPage.textContent('body')
      check(
        'SHARE-01(d) 往復: 貼り付けで材料・手順が過不足なく復元される',
        rtFormText.includes(`材料${ingLineCount}件・手順${stepLineCount}件を読み取りました`),
        rtFormText,
      )
      check(
        'SHARE-01(d) 往復: 料理名も復元される(人数分の括弧に汚れない)',
        (await shPage.getByPlaceholder(ja.form.namePlaceholder).inputValue()) === '豚汁',
      )
      check(
        'SHARE-01(d) 往復: 末尾の入口URLが手順に化けない(手順数=共有本文の手順行数)',
        stepLineCount > 0 && rtFormText.includes(`手順${stepLineCount}件`),
      )
    } finally {
      await shBrowser.close()
    }
  }

  // --- FOCUS-HINT-01: 調理中モードの初回発見性(2026-07-23 便BJ・docs/55 CEO提案1-5)。
  // レシピ詳細を初めて開いたときだけ「作りながら見るならこれ」の控えめなヒントを1回だけ出し、
  // 2品目以降は出さない(cookModeHintSeenフラグで再表示しない)。新規IndexedDBの独立ブラウザで検証 ---
  currentCheck = 'FOCUS-HINT-01'
  {
    const fhBrowser = await chromium.launch()
    const fhContext = await fhBrowser.newContext()
    const fhPage = await fhContext.newPage()
    fhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FOCUS-HINT-01] ${err.message}`)
    })
    try {
      await fhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fhPage.waitForTimeout(1800) // 初回シード完了待ち
      // 1品目: 初回ヒントが出る
      await fhPage.getByText('肉じゃが', { exact: true }).first().click()
      await fhPage.waitForTimeout(600)
      check(
        'FOCUS-HINT-01 初回のレシピ詳細で「作りながら見るならこれ」ヒントが出る',
        (await fhPage.getByText(ja.focus.firstHint).count()) === 1,
      )
      // 2品目: もう出ない(1回だけ)
      await fhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fhPage.waitForTimeout(600)
      await fhPage.getByText('カレーライス', { exact: true }).first().click()
      await fhPage.waitForTimeout(600)
      check(
        'FOCUS-HINT-01 2品目以降はヒントが出ない(1回だけ)',
        (await fhPage.getByText(ja.focus.firstHint).count()) === 0,
      )
      // 調理中モードのボタン自体は毎回ある(ヒントが消えても機能は不変)
      check(
        'FOCUS-HINT-01 ヒントが消えても「調理中モードで見る」ボタンは残る',
        (await fhPage.getByText(ja.focus.open).count()) >= 1,
      )
    } finally {
      await fhBrowser.close()
    }
  }

  // --- FORMTABS-01: レシピ編集フォームの「かんたん/くわしく」タブ分け(2026-07-16 Fable裁定
  // docs/26・案A承認)。(a)新規登録の初期表示は常に「かんたん」タブで、かんたんタブの入力だけで
  // 保存が成功すること (b)「くわしく」タブ側フィールドに入力があると見出し右の●
  // (aria-label「入力済みの項目があります」)が出ること・空のうちは出ないこと
  // (c)「くわしく」タブを表示中に料理名未入力のまま保存すると、エラー表示とともに
  // 「かんたん」タブへ自動的に戻ること (d)実装は両タブのDOMを常時マウントし`hidden`属性で
  // 切り替えるだけのため、くわしくタブの入力内容がタブ往復でも消えない(state維持)ことを確認する ---
  currentCheck = 'FORMTABS-01'
  {
    const ftBrowser = await chromium.launch()
    const ftContext = await ftBrowser.newContext()
    const ftPage = await ftContext.newPage()
    ftPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMTABS-01] ${err.message}`)
    })
    try {
      await ftPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1800) // 初回シード完了待ち

      // (a) 新規登録の初期表示は常に「かんたん」タブ。かんたんタブの入力だけで保存が成功する
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const simpleTab = ftPage.getByRole('tab', { name: ja.form.formTabSimple })
      const detailTab = ftPage.getByRole('tab', { name: ja.form.formTabDetail })
      check(
        'FORMTABS-01a 新規登録の初期表示は「かんたん」タブ(aria-selected)',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )
      await ftPage.getByPlaceholder(ja.form.namePlaceholder).fill('E2Eタブかんたん保存確認レシピ')
      await ftPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('テスト材料')
      await ftPage.getByPlaceholder(ja.form.stepTextPlaceholder).first().fill('テスト手順')
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(800)
      check(
        'FORMTABS-01a かんたんタブの入力だけで保存が成功する(くわしくは未入力のまま)',
        (await ftPage.textContent('body')).includes('E2Eタブかんたん保存確認レシピ'),
      )
      // 後始末: 検証用に作成したレシピを削除
      await ftPage.locator('a[href*="/edit"]').first().click()
      await ftPage.waitForTimeout(500)
      await ftPage.getByRole('button', { name: ja.form.deleteRecipe }).click()
      await ftPage.waitForTimeout(800)

      // (b) くわしくタブが空のうちは●が出ず、入力があると出る
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const dotBefore = await ftPage.locator(`[aria-label="${ja.form.formTabDetailFilledHint}"]`).count()
      check('FORMTABS-01b くわしくタブが空のうちは●が出ない', dotBefore === 0)
      await ftPage.getByRole('tab', { name: ja.form.formTabDetail }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByPlaceholder(ja.form.memoPlaceholder).fill('E2Eタブ確認メモ')
      await ftPage.waitForTimeout(200)
      const dotAfter = await ftPage.locator(`[aria-label="${ja.form.formTabDetailFilledHint}"]`).count()
      check('FORMTABS-01b くわしくに入力があると見出し右に●が出る', dotAfter > 0)

      // (c) くわしくタブを表示中に料理名未入力のまま保存すると、エラー表示+「かんたん」タブへ戻る
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(300)
      check(
        'FORMTABS-01c 料理名未入力で保存するとエラーが表示される',
        stripZwspText(await ftPage.textContent('body')).includes(ja.form.nameRequired),
      )
      check(
        'FORMTABS-01c 料理名未入力で保存すると「かんたん」タブへ自動的に戻る',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )

      // (d) タブ往復してもくわしくタブの入力内容が消えない(両タブのDOMを常時マウントし
      // hidden属性で切り替えているだけの実装であることの確認)
      await ftPage.getByRole('tab', { name: ja.form.formTabDetail }).click()
      await ftPage.waitForTimeout(200)
      const memoBeforeSwitch = await ftPage
        .getByPlaceholder(ja.form.memoPlaceholder)
        .inputValue()
      check(
        'FORMTABS-01d くわしくタブへ戻るとメモの入力内容がまだ残っている(切替前確認)',
        memoBeforeSwitch === 'E2Eタブ確認メモ',
      )
      await ftPage.getByRole('tab', { name: ja.form.formTabSimple }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByRole('tab', { name: ja.form.formTabDetail }).click()
      await ftPage.waitForTimeout(200)
      const memoAfterSwitch = await ftPage
        .getByPlaceholder(ja.form.memoPlaceholder)
        .inputValue()
      check(
        'FORMTABS-01d かんたん→くわしくと切り替えてもメモの入力内容が残っている(state維持)',
        memoAfterSwitch === 'E2Eタブ確認メモ',
      )
    } finally {
      await ftBrowser.close()
    }
  }
