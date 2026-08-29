// ==========================================================================================
// e2e の節: 便FW〜GS・ホーム画面の廃止
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
// この中の節: FW-01, FW-02, FW-03, FW-04, FW-05, GJ-01, GJ-07, GJ-08, GJ-06, GJ-02, GJ-03, GJ-05, GJ-04, GL-01, GL-03, GL-02, GL-07, GL-05, GL-08, GL-04, GL-06, GS-03, GS-01, GS-02, GS-04, NOHOME-01
// ==========================================================================================
import './_shared.mjs'


  // FW（2026-08-12 便FW・オーナー実機フィードバック）
  //   FW-01 設定のPro節: 「使えるようになった機能」を開く画面ごとの束にまとめ、入口リンクは
  //         束ごとに1本だけ。機能紹介の一番下にPro版の詳しい説明へのリンクを置く
  //   FW-02 バックアップの説明を短く（長文が戻っていないことも見張る）・「今のデータに追加」の
  //         説明文は出さない・詳しい説明はリンク先に任せる
  //   FW-03 古い記録の書き出し: オーナーの4つの疑問（①バックアップと何が違うのか
  //         ②範囲を選んだあとどこを押すのか ③アーカイブとバックアップファイルは違うのか
  //         ④どこに保存されているのか）すべてに画面の上で答える
  //   FW-04 食材の在庫の「「作った！」で在庫を減らす」スイッチ。レシピ詳細のスイッチと連動し、
  //         献立の「全て作った！」にも効く（毎回の小窓は増やさない）
  //   FW-05 段取りを作っていないとき（候補として選んだだけ）は、日の「作った！」で
  //         段取りの小窓を出さない
  // ============================================================================
  currentCheck = 'FW-01'
  {
    const fwBrowser = await chromium.launch()
    const fwCtx = await fwBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fwPage = await fwCtx.newPage()
    fwPage.on('dialog', (d) => void d.accept())
    fwPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FW] ${err.message}`)
    })
    /** 節の中の段落を1つずつ取り出す（規約H: 長い文が戻っていないかを機械で見張るため） */
    const fwParagraphs = (sel) =>
      fwPage.evaluate((s) => {
        const root = document.querySelector(s)
        if (!root) return null
        return Array.from(root.querySelectorAll('p, li, dd, [data-testid="backup-photos-note"]'))
          .map((el) => (el.textContent ?? '').replace(/\u200B/g, '').trim())
          .filter(Boolean)
      }, sel)
    /** 1かたまりの文字数の上限（今の最長は約86字。100字を超えたら長文へ逆戻りしている） */
    const FW_PARAGRAPH_MAX = 100
    try {
      await fwPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fwPage.waitForTimeout(1800)
      // 「使えるようになった機能」は解錠中だけ出るので、Pro解錠済みの状態を作る
      await fwPage.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = () => idb.transaction('settings', 'readwrite').objectStore('settings')
        const cur = (await P(store().get(1))) || { id: 1 }
        await P(store().put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        idb.close()
      })
      // 生のIndexedDBへ書いた変更はDexieの購読に伝わらないので、必ず読み込み直してから見る
      await fwPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await fwPage.reload({ waitUntil: 'networkidle' })
      await fwPage.waitForTimeout(1500)

      const fwGroups = await fwPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="pro-feature-group"]')).map((el) => ({
          title: (el.querySelector('p')?.textContent ?? '').replace(/\u200B/g, '').trim(),
          linkCount: el.querySelectorAll('a').length,
          linkLabel: (el.querySelector('a')?.textContent ?? '').trim(),
          linkHref: el.querySelector('a')?.getAttribute('href') ?? '',
          featureCount: el.querySelectorAll('li').length,
        })),
      )
      check(
        'FW-01 「使えるようになった機能」が開く画面ごとの2つの束になっている',
        fwGroups.length === 2,
        JSON.stringify(fwGroups.map((g) => g.title)),
      )
      check(
        'FW-01 束の見出しが「レシピに増えた機能」「献立に増えた機能」',
        fwGroups[0]?.title === 'レシピに増えた機能' && fwGroups[1]?.title === '献立に増えた機能',
        JSON.stringify(fwGroups.map((g) => g.title)),
      )
      check(
        'FW-01 入口のリンクは束ごとに1本だけ（同じリンクが並ばない）',
        fwGroups.every((g) => g.linkCount === 1),
        JSON.stringify(fwGroups.map((g) => g.linkCount)),
      )
      check(
        'FW-01 束のリンクは「レシピ一覧を開く」→レシピ一覧、「献立を開く」→献立',
        fwGroups[0]?.linkLabel === 'レシピ一覧を開く' && fwGroups[0]?.linkHref === '#/recipes' &&
          fwGroups[1]?.linkLabel === '献立を開く' && fwGroups[1]?.linkHref === '#/meal-plan',
        JSON.stringify(fwGroups.map((g) => `${g.linkLabel}=${g.linkHref}`)),
      )
      check(
        'FW-01 束の中に機能がすべて残っている（まとめ直しで機能を落としていない）',
        (fwGroups[0]?.featureCount ?? 0) === 3 && (fwGroups[1]?.featureCount ?? 0) === 4,
        JSON.stringify(fwGroups.map((g) => g.featureCount)),
      )
      const fwProText = (
        (await fwPage.locator('#section-pro').innerText().catch(() => '')) ?? ''
      ).replace(/\u200B/g, '')
      // 2026-08-29 便MP: リンクの名前を書き写していた（JM-10）。**どの名前かは ja.ts が持つ**ので、
      // 束の数ぶんだけ ja.ts から名前を取り、それぞれが1回ずつしか出ていないことを見る
      const fwLinkCounts = ja.settings.proActivatedFeatureGroups.map((g) => ({
        label: g.linkLabel,
        count: (fwProText.match(new RegExp(reEscape(g.linkLabel), 'g')) ?? []).length,
      }))
      check(
        'FW-01 同じ入口リンクが繰り返し並んでいない（「レシピ一覧を開く」「献立を開く」は各1回）',
        fwLinkCounts.length > 0 && fwLinkCounts.every((l) => l.count === 1),
        fwLinkCounts.map((l) => `${l.label}=${l.count}`).join(' '),
      )
      check(
        'FW-01 束の見出しに「タブ」という内部の言い方を使っていない',
        !fwProText.includes('タブ'),
      )
      // 機能紹介の一番下のリンク（オーナー指示「pro版の詳しい説明はこちら、みたいな感じで」）
      const fwProLink = fwPage.locator('[data-testid="pro-detail-link-activated"]')
      const fwProHref = (await fwProLink.count()) > 0 ? await fwProLink.getAttribute('href') : null
      check(
        // 2026-08-28 便LW: このリンクは別窓をやめて帰り先（?from=）を載せたので、
        // 行き先そのもの（パスと見出しの目印）で見る（完全一致だと帰り先の有無で落ちる）
        'FW-01 機能紹介の一番下にPro版の詳しい説明へのリンクがある',
        typeof fwProHref === 'string' &&
          fwProHref.split('?')[0] === '/about/manual.html' &&
          fwProHref.endsWith('#pro'),
        String(fwProHref),
      )
      check(
        'FW-01 そのリンクが、アプリへの帰り先を持っている（便LW）',
        typeof fwProHref === 'string' &&
          fwProHref.includes(`from=${encodeURIComponent('/settings?section=pro')}`),
        String(fwProHref),
      )
      check(
        'FW-01 リンクの文言が行き先の中身を言っている',
        ((await fwProLink.textContent().catch(() => '')) ?? '').trim() === ja.settings.proDetailLinkActivated,
      )
      const fwProRes = await fwPage.request.get(`${BASE}/about/manual.html`)
      const fwProBody = fwProRes.ok() ? await fwProRes.text() : ''
      check(
        'FW-01 リンク先の見出し（id="pro"）が実在する',
        fwProRes.status() === 200 && fwProBody.includes('id="pro"') && fwProBody.includes('無料で使える範囲とPro版'),
        `status=${fwProRes.status()}`,
      )

      // --- FW-02: バックアップの説明 ---
      currentCheck = 'FW-02'
      await fwPage.goto(`${BASE}/#/settings?section=backup`, { waitUntil: 'networkidle' })
      await fwPage.waitForTimeout(1200)
      // 2026-08-27 便LS: 注意書きと詳しい説明のリンクは折りたたみに入った（中身は減っていない）
      const fwNotice = fwPage.locator('[data-testid="backup-notice-toggle"]')
      check('FW-02 注意点と詳しい説明の折りたたみがある（便LS）', (await fwNotice.count()) === 1)
      if ((await fwNotice.count()) === 1) {
        await fwNotice.click()
        await fwPage.waitForTimeout(500)
      }
      const fwBackupText = ((await fwPage.textContent('body')) ?? '').replace(/\u200B/g, '')
      check(
        'FW-02 バックアップの説明が「何が入るファイルか」を1文で言っている',
        fwBackupText.includes(ja.settings.backupDescription),
      )
      check(
        'FW-02 「今のデータに追加」のボタンは残っている',
        (await fwPage.getByRole('button', { name: ja.settings.backupImportMerge }).count()) === 1,
      )
      check(
        'FW-02 「今のデータに追加」の下の説明文は出さない（オーナー指示で削除）',
        !fwBackupText.includes('「まだ無いもの」だけを足します'),
      )
      check(
        'FW-02 短くしても事実は落としていない: 解錠コードが含まれる注意は残っている（規約F）',
        fwBackupText.includes(ja.settings.backupContainsCodeNotice),
      )
      check(
        // 2026-08-20 便IJ・③: 文字を書き写していたので ja から読む形にした（注記を
        // 「OFFのまま／ONにする／毎回」の3行に分けた時点で、書き写しの側が落ちた＝禁じ手②）
        'FW-02 短くしても事実は落としていない: 写真は既定で入らないことが残っている',
        ja.settings.backupIncludeCookedPhotosNotes.every((note) => fwBackupText.includes(note)),
        `画面に無い行=${JSON.stringify(
          ja.settings.backupIncludeCookedPhotosNotes.filter((note) => !fwBackupText.includes(note)),
        )}`,
      )
      const fwBackupParas = await fwParagraphs('#backup-section')
      const fwBackupLong = (fwBackupParas ?? []).filter((t) => t.length > FW_PARAGRAPH_MAX)
      check(
        `FW-02 長文が戻っていない（1かたまり${FW_PARAGRAPH_MAX}字以内）`,
        fwBackupParas !== null && fwBackupLong.length === 0,
        fwBackupLong.map((t) => `${t.length}字: ${t.slice(0, 30)}…`).join(' / '),
      )
      const fwBackupLink = fwPage.locator('[data-testid="backup-detail-link"]')
      const fwBackupHref = (await fwBackupLink.count()) > 0 ? await fwBackupLink.getAttribute('href') : null
      check(
        // 2026-08-27 便LS: リンクに帰り先（?from=）が載るようになったので、行き先そのもの
        // （パスと見出しの目印）で見る。帰り先の受け渡しは scripts/tests/ui-source-guards.mjs LS-3
        'FW-02 詳しい説明のリンクが使い方ページの「バックアップと機種変更」を指す',
        typeof fwBackupHref === 'string' &&
          fwBackupHref.startsWith('/about/manual.html') &&
          fwBackupHref.endsWith('#backup'),
        String(fwBackupHref),
      )
      check(
        'FW-02 詳しい説明のリンクが、アプリへの帰り先を持っている（便LS）',
        typeof fwBackupHref === 'string' &&
          fwBackupHref.includes(`from=${encodeURIComponent('/settings?section=backup')}`),
        String(fwBackupHref),
      )
      check(
        'FW-02 リンク先の見出し（id="backup"）が実在する',
        fwProBody.includes('id="backup"') && fwProBody.includes('バックアップと機種変更'),
      )

      // --- FW-03: 古い記録の書き出し（4つの疑問すべてに画面で答える） ---
      currentCheck = 'FW-03'
      // 2026-08-22 便JJ: 「古い記録の書き出し（アーカイブ）」は既定で畳んである（オーナー指示）。
      // 中身を見る節は、必ず先に開いてから測る（「機種変更するときは」と同じ作法）
      await fwPage.locator('[data-testid="archive-toggle"]').first().click()
      await fwPage.waitForTimeout(600)
      const fwArchiveText = (
        (await fwPage.locator('#archive-section').innerText().catch(() => '')) ?? ''
      ).replace(/\u200B/g, '')
      // 疑問①「バックアップと何が違うのか」・疑問③「別のファイルなのか」
      // 2026-08-20 便IJ・①: アーカイブファイルの説明を1つの表にまとめ直した
      // （入るもの／読みかた／アプリに戻す／バックアップとの違い）。文言は ja から読む
      const fwVs = (
        (await fwPage.locator('[data-testid="archive-file-facts"]').innerText().catch(() => '')) ?? ''
      ).replace(/\u200B/g, '')
      const fwVsMissing = ja.settings.archiveFileRows.filter(
        (row) => !fwVs.includes(row.name) || !fwVs.includes(row.body),
      )
      check(
        'FW-03(疑問①) アーカイブファイルの説明が、jaの行どおりに表で出ている',
        ja.settings.archiveFileRows.length >= 3 && fwVsMissing.length === 0,
        `画面に無い行=${JSON.stringify(fwVsMissing.map((r) => r.name))} 画面=${fwVs.slice(0, 120)}`,
      )
      check(
        // 2026-08-20 司令部: ファイル名を書き写していたため、アーカイブの名前を
        // records → archive に変えた便IHのあとも古い名前を探し続けて落ちた（禁じ手②）。
        // 画面に出るのは ja の1文なので、その1文が出ているかで見る。
        // 「その1文に書いてある名前が、実際に書き出す名前と一致しているか」は
        // scripts/test-logic.mjs の IH-4 が別に見張っている（役割を二重にしない）
        'FW-03(疑問③) 2つが別のファイルであることと、名前の見分け方が書いてある',
        fwArchiveText.includes(ja.settings.archiveVsBackupNote.replace(/\u200B/g, '')),
        `画面=${fwArchiveText.slice(0, 160)}`,
      )
      // 疑問②「範囲を選んだあとどこを押すのか」
      const fwSteps = await fwPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-testid="archive-steps"] li')).map((el) =>
          (el.textContent ?? '').replace(/\u200B/g, '').trim(),
        ),
      )
      check(
        'FW-03(疑問②) 押す順に手順が3つ並んでいる',
        fwSteps.length === 3,
        JSON.stringify(fwSteps),
      )
      check(
        'FW-03(疑問②) 範囲を選んだあとに押すボタンの名前が書いてある',
        (fwSteps[0] ?? '').includes(ja.settings.archiveSteps[0]) &&
          (fwSteps[1] ?? '').includes(ja.settings.archiveSteps[1]) &&
          (fwSteps[2] ?? '').includes(ja.settings.archiveSteps[2]),
        JSON.stringify(fwSteps),
      )
      check(
        'FW-03(疑問②) 削除のボタンが最初は無い理由（②を済ませると現れること）も書いてある',
        (fwSteps[2] ?? '').includes(ja.settings.archiveSteps[2].split('（')[1].replace('）', '')),
        fwSteps[2] ?? '',
      )
      // 疑問④「どこに保存されているのか」。
      // 2026-08-26 便LI（オーナー指示「『端末が軽くなるのは』削除。『ファイルの場所』に内容だけ
      // 箇条書きで移動」）で、見出しの語は「ファイルの場所」1つになり、本文は箇条書きになった
      const fwWhere = (
        (await fwPage.locator('[data-testid="archive-where-saved"]').innerText().catch(() => '')) ?? ''
      ).replace(/\u200B/g, '')
      check(
        'FW-03(疑問④) ファイルがアプリの中ではなく、選んだ場所／ダウンロードに入ることが書いてある',
        fwWhere.includes('アプリの中ではなく') && fwWhere.includes('選んだ場所') &&
          fwWhere.includes('ダウンロード'),
        fwWhere,
      )
      // 「書き出したあとに端末から消すと、その分の空き容量が戻ります」の書き直し
      check(
        'FW-03 日本語のおかしかった旧文（空き容量が戻ります）を出していない',
        !fwArchiveText.includes('空き容量が戻ります'),
      )
      check(
        'FW-03 端末が軽くなる条件を「端末の外へ移してから消す」と書いている',
        fwWhere.includes('端末の外へ移し') && fwWhere.includes('端末の記録を消す'),
        fwWhere,
      )
      check(
        'FW-03(便LI) 「端末が軽くなるのは」の見出しの語は出していない',
        !fwArchiveText.includes('端末が軽くなるのは'),
      )
      const fwArchiveParas = await fwParagraphs('#archive-section')
      const fwArchiveLong = (fwArchiveParas ?? []).filter((t) => t.length > FW_PARAGRAPH_MAX)
      check(
        `FW-03 長文が戻っていない（1かたまり${FW_PARAGRAPH_MAX}字以内）`,
        fwArchiveParas !== null && fwArchiveLong.length === 0,
        fwArchiveLong.map((t) => `${t.length}字: ${t.slice(0, 30)}…`).join(' / '),
      )
      const fwArchiveLink = fwPage.locator('[data-testid="archive-detail-link"]')
      const fwArchiveHref =
        (await fwArchiveLink.count()) > 0 ? await fwArchiveLink.getAttribute('href') : null
      check(
        // 2026-08-28 便LW: このリンクにも帰り先（?from=）が載ったので、FW-02 と同じく
        // 行き先そのもの（パスと見出しの目印）で見る
        'FW-03 詳しい説明のリンクが使い方ページの「古い記録の書き出し」を指す',
        typeof fwArchiveHref === 'string' &&
          fwArchiveHref.startsWith('/about/manual.html') &&
          fwArchiveHref.endsWith('#archive'),
        String(fwArchiveHref),
      )
      check(
        'FW-03 詳しい説明のリンクが、アプリへの帰り先を持っている（便LW）',
        typeof fwArchiveHref === 'string' &&
          fwArchiveHref.includes(`from=${encodeURIComponent('/settings?section=archive')}`),
        String(fwArchiveHref),
      )
      check(
        'FW-03 リンク先の見出し（id="archive"）が実在する',
        // 2026-08-29 便MH: 節の名前は ja.settings.archiveTitle が正（画面が「（アーカイブ）」に変わったのに
        // ここが「（端末を軽くする）」を書き写したままで、説明書を画面に合わせた瞬間に落ちていた＝禁じ手②）
        fwProBody.includes('id="archive"') && fwProBody.includes(ja.settings.archiveTitle),
      )
    } finally {
      await fwBrowser.close()
    }
  }

  // --- FW-04: 食材の在庫の「「作った！」で在庫を減らす」スイッチ ---
  // オーナー指摘「まとめて作った！・レシピ詳細以外から作った！した時に、食材の在庫から減らすか
  // 聞かれない。何度も質問の小窓が出るのも大変なので、食材の在庫に…スイッチでもつくる？
  // レシピ詳細の作った！のONOFFとも連動させたほうがいいかな？」
  currentCheck = 'FW-04'
  {
    const fpBrowser = await chromium.launch()
    const fpCtx = await fpBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fpPage = await fpCtx.newPage()
    const fpDialogs = []
    await collectConfirms(fpPage, fpDialogs)
    fpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FW-04] ${err.message}`)
    })
    const fpRead = (storeName, key) =>
      fpPage.evaluate(async ([name, k]) => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const st = idb.transaction(name, 'readonly').objectStore(name)
        const out = k === undefined ? await P(st.getAll()) : await P(st.get(k))
        idb.close()
        return out
      }, [storeName, key])
    try {
      await fpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(1800)
      await fpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(600)
      const fpSwitch = fpPage.locator('[data-testid="pantry-cooked-reflect-switch"]')
      check(
        'FW-04 食材の在庫に「「作った！」で在庫を減らす」のスイッチがある',
        (await fpSwitch.count()) === 1,
      )
      check(
        'FW-04 既定はOFF（勝手に在庫を動かさない）',
        (await fpSwitch.getAttribute('aria-checked')) === 'false',
      )
      const fpBoardText = ((await fpPage.textContent('body')) ?? '').replace(/\u200B/g, '')
      check(
        'FW-04 何がどう減るのかがスイッチのそばに書いてある（規約F）',
        fpBoardText.includes(ja.pantry.cookedReflectHint),
      )
      check(
        'FW-04 どの「作った！」にも効くこと・レシピ詳細のスイッチと同じ設定であることが書いてある',
        // 2026-08-29: 画面の文言そのものを書き写していたので ja.ts から読む（禁じ手②）。
        // 「出る」→「ある」に直した瞬間にここが落ちた
        fpBoardText.includes(ja.pantry.cookedReflectScope),
      )
      // ONにすると設定に記憶される
      await fpSwitch.click()
      await fpPage.waitForTimeout(400)
      check(
        'FW-04 ONにすると設定(cookedReflectPantry)に記憶される',
        (await fpRead('settings', 1))?.cookedReflectPantry === true,
      )
      // レシピ詳細の「作った！」のスイッチと連動している（同じ設定を見ている）
      await fpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(600)
      await fpPage.getByText('肉じゃが', { exact: true }).first().click()
      await fpPage.waitForTimeout(600)
      await fpPage.getByRole('button', { name: '作った！' }).first().click()
      await fpPage.waitForTimeout(400)
      const fpDetailSwitch = fpPage.getByRole('switch', { name: ja.detail.cookedReflectPantryLabel })
      check(
        'FW-04 在庫でONにすると、レシピ詳細の「作った！」のスイッチもONになっている（連動）',
        (await fpDetailSwitch.getAttribute('aria-checked')) === 'true',
      )
      // 逆向きにも連動する（レシピ詳細で切ると在庫の画面も切れる）
      await fpDetailSwitch.click()
      await fpPage.waitForTimeout(400)
      await fpPage.getByRole('button', { name: ja.common.confirmCancel }).first().click()
      await fpPage.waitForTimeout(300)
      await fpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(600)
      check(
        'FW-04 レシピ詳細でOFFにすると、在庫のスイッチもOFFになっている（連動は両方向）',
        (await fpPage.locator('[data-testid="pantry-cooked-reflect-switch"]').getAttribute('aria-checked')) === 'false',
      )
      // もう一度ONにして、「レシピ詳細以外の作った！」でも在庫が下がることを確かめる
      await fpPage.locator('[data-testid="pantry-cooked-reflect-switch"]').click()
      await fpPage.waitForTimeout(400)
      await fpPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await fpPage.waitForTimeout(300)
      check(
        'FW-04 前提: 玉ねぎを「ある」にできた',
        ((await fpRead('pantryItems')) ?? []).find((p) => p.name === '玉ねぎ')?.level === 'have',
      )
      // 今日の献立に肉じゃがを入れて、献立の「全て作った！」で記録する
      await fpPage.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const recipes = await P(idb.transaction('recipes', 'readonly').objectStore('recipes').getAll())
        const target = recipes.find((r) => r.title === '肉じゃが')
        await P(idb.transaction('todayList', 'readwrite').objectStore('todayList').add({ recipeId: target.id, addedAt: Date.now() }))
        idb.close()
      })
      await fpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await fpPage.reload({ waitUntil: 'networkidle' })
      await fpPage.waitForTimeout(1800)
      // 2026-08-20 便II・⑥: 「作った！」「全て作った！」と、その断り書きは整理モードの中に入った。
      // ここで見たいのは**断り書きの中身**（どの設定でどう減るか）なので、読める場所まで
      // 進めるためにモードへ入るだけにする（置き場所を測るのは DAYORG-01 の役目）
      await openDayOrganize(fpPage)
      check(
        'FW-04 設定がONのときは、1品ずつの「作った！」の前にも在庫が減ることが書いてある（小窓は出さない）',
        (await fpPage.locator('[data-testid="day-pantry-cooked-hint"]').count()) === 1,
      )
      fpDialogs.length = 0
      await fpPage.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked }).first().click()
      await fpPage.waitForTimeout(1200)
      check(
        'FW-04 「全て作った！」の確認文が、どの設定で在庫が減るのかを名前で言う',
        fpDialogs.some((m) => m.includes(ja.mealPlan.todayMarkAllCookedConfirmPantry)),
        fpDialogs.join(' | ').slice(0, 200),
      )
      check(
        'FW-04 レシピ詳細以外の「作った！」でも在庫が1段階下がる（ある→少ない）',
        ((await fpRead('pantryItems')) ?? []).find((p) => p.name === '玉ねぎ')?.level === 'low',
        JSON.stringify(((await fpRead('pantryItems')) ?? []).find((p) => p.name === '玉ねぎ')),
      )
    } finally {
      await fpBrowser.close()
    }
  }

  // --- FW-05: 段取りを作っていないときは、日の「作った！」で段取りの小窓を出さない ---
  // オーナー指摘「日・今日の献立から作った！したとき、並行調理ナビの段取り（候補）からも外れる旨の
  // 説明はいらない（調理ナビで段取りが作成されていない場合）」
  currentCheck = 'FW-05'
  {
    const fnBrowser = await chromium.launch()
    const fnCtx = await fnBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const fnPage = await fnCtx.newPage()
    const fnDialogs = []
    await collectConfirms(fnPage, fnDialogs)
    fnPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FW-05] ${err.message}`)
    })
    try {
      await fnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fnPage.waitForTimeout(1800)
      // 今日の献立に3品入れる（並行調理ナビで選べる状態を作る）
      const fnIds = await fnPage.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const recipes = await P(idb.transaction('recipes', 'readonly').objectStore('recipes').getAll())
        const ids = recipes.slice(0, 3).map((r) => r.id)
        let addedAt = Date.now()
        for (const id of ids) {
          await P(idb.transaction('todayList', 'readwrite').objectStore('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        }
        idb.close()
        return ids
      })
      /** 覚え書きを置き直す（showTimeline=段取りを作ったかどうか） */
      const fnPutSession = (showTimeline) =>
        fnPage.evaluate(([ids, show]) => {
          const d = new Date()
          const pad = (n) => String(n).padStart(2, '0')
          localStorage.setItem(
            'uchi-recipe-cook-navi-session',
            JSON.stringify({
              v: 1,
              date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
              selectedIds: ids,
              showTimeline: show,
              trialActive: false,
            }),
          )
        }, [fnIds, showTimeline])

      // ①段取りを作っていない（候補として選んだだけ）→ 小窓は出さない
      await fnPutSession(false)
      await fnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await fnPage.reload({ waitUntil: 'networkidle' })
      await fnPage.waitForTimeout(1800)
      // 2026-08-20 便II・⑥: 行の「作った！」と説明の1行は整理モードの中に移った
      await openDayOrganize(fnPage)
      check(
        'FW-05 段取りを作っていないときは、日の説明に段取りの話を出さない',
        (await fnPage.locator('[data-testid="day-navi-cooked-hint"]').count()) === 0,
      )
      fnDialogs.length = 0
      await fnPage.getByRole('button', { name: '作った！', exact: true }).first().click()
      await fnPage.waitForTimeout(1200)
      check(
        'FW-05 段取りを作っていないときは、「作った！」で段取りの小窓を出さない',
        !fnDialogs.some((m) => m.includes('段取り')),
        fnDialogs.join(' | ').slice(0, 200),
      )
      const fnAfter = await fnPage.evaluate(async () => {
        const idb = await new Promise((resolve, reject) => {
          const r = indexedDB.open('uchi-recipe')
          r.onsuccess = () => resolve(r.result)
          r.onerror = () => reject(r.error)
        })
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const list = await P(idb.transaction('todayList', 'readonly').objectStore('todayList').getAll())
        idb.close()
        return list.length
      })
      check(
        'FW-05 小窓を出さなくても記録は付き、今日の献立から外れる（黙って何も起きないのではない）',
        fnAfter === 2,
        `今日の献立=${fnAfter}品`,
      )

      // ②段取りを作ってある → 従来どおり、外れることを先に伝える
      await fnPutSession(true)
      await fnPage.reload({ waitUntil: 'networkidle' })
      await fnPage.waitForTimeout(1500)
      // 2026-08-20 便II・⑥: 行の「作った！」と説明の1行は整理モードの中に移った
      await openDayOrganize(fnPage)
      check(
        'FW-05 段取りを作ってあるときは、日の説明に段取りの話が出る',
        (await fnPage.locator('[data-testid="day-navi-cooked-hint"]').count()) === 1,
      )
      fnDialogs.length = 0
      await fnPage.getByRole('button', { name: '作った！', exact: true }).first().click()
      await fnPage.waitForTimeout(1200)
      check(
        'FW-05 段取りを作ってあるときは、従来どおり段取りから外れることを先に伝える',
        fnDialogs.some((m) => m.includes('段取り')),
        fnDialogs.join(' | ').slice(0, 200),
      )
    } finally {
      await fnBrowser.close()
    }
  }

  // ============================================================================
  // GJ-01〜08: 段取りを手で並べ替える（2026-08-14 便GJ・docs/71 R3/R4）
  //
  //   R3「段取りを手で並べ替える手段がない。上下ボタンもドラッグもなし。」
  //   R4「順番の入れ替えもできません。前後させると番号が合わなくなり、
  //       調理中モードは元の順で進みます。」
  //
  //   GJ-01 段取りの各手順に「上へ」「下へ」があり、押すと順番が変わる（390pxで押せる）
  //   GJ-02 変えた順番のまま調理中モードが進む（R4の「元の順で進みます」への答え）
  //   GJ-03 画面を移って戻っても・読み込み直しても、その日のうちは並びが残る
  //   GJ-04 日付が変わったら並びごと捨てる（推測しない）
  //   GJ-05 「1つ前の並びに戻す」で1回ずつ戻せる／「自動の並びに戻す」で白紙に戻せる（規約F）
  //   GJ-06 うちの台所では続けられなくなる並びは、止めずに印を出す
  //   GJ-07 自動で組んだ並びのままなら、印も並べ替えの欄も出ない（自動の段取りを変えていない）
  //   GJ-08 何回動かしても手順は1つも消えない
  // ============================================================================
  currentCheck = 'GJ-01'
  {
    const gjBrowser = await chromium.launch()
    const gjCtx = await gjBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const gjPage = await gjCtx.newPage()
    let gjDialog = ''
    let gjAnswer = 'accept'
    gjPage.on('dialog', (d) => { gjDialog = d.message(); void (gjAnswer === 'accept' ? d.accept() : d.dismiss()) })
    gjPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@GJ] ${err.message}`)
    })
    gjPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@GJ] ${t}`)
    })
    // BudouX が文節の切れ目にゼロ幅スペースを挿すので、照合の前に外す（CLAUDE.md の禁じ手②）
    const noZw = (t) => (t ?? '').replace(/\u200B/g, '')
    /** 段取りに出ている手順の本文（ゼロ幅スペース・改行を外して比べる） */
    const gjOrder = async () =>
      (await gjPage.locator('[data-testid="navi-step-text"]').allInnerTexts()).map((t) =>
        noZw(t).replace(/\s+/g, ''),
      )
    try {
      await gjPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await gjPage.waitForTimeout(1800)
      // コンロ1口の家＋どちらもコンロを使う2品（手で動かすと口が足りなくなる形を作る）
      await gjPage.evaluate(async () => {
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
        const a = await P(store('recipes').add(mk('GJ煮物', [
          { text: '大根を一口大に切る。', minutes: 4 },
          { text: '鍋に大根とだしを入れて中火で12分煮る。', minutes: 12 },
          { text: '器に盛る。', minutes: 2 },
        ])))
        const b = await P(store('recipes').add(mk('GJ炒めもの', [
          { text: 'にんじんを細切りにする。', minutes: 3 },
          { text: 'フライパンで豚肉を炒める。', minutes: 5 },
          { text: '器に盛る。', minutes: 2 },
        ])))
        let addedAt = Date.now()
        for (const id of [a, b]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({
          ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now(), kitchenBurners: 1,
        }))
        db.close()
      })
      await gjPage.goto(`${BASE}/#/cook-navi`)
      await gjPage.reload({ waitUntil: 'networkidle' })
      await gjPage.waitForTimeout(1500)
      await gjPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await gjPage.waitForTimeout(1000)

      const gjAuto = await gjOrder()
      check('GJ 前提: 段取りが組める', gjAuto.length >= 4, gjAuto.join(' | '))

      // --- GJ-07: 自動で組んだ並びのままなら、印も並べ替えの欄も出ない ---
      currentCheck = 'GJ-07'
      check(
        'GJ-07 動かす前は、無理の印を1つも出さない（自動の段取りの見え方を変えていない）',
        (await gjPage.locator('[data-testid="navi-step-issue"]').count()) === 0,
      )
      check(
        'GJ-07 動かす前は、並べ替えの状態の欄も出さない',
        (await gjPage.locator('[data-testid="navi-reorder-state"]').count()) === 0,
      )
      check(
        'GJ-07 順番を変えられることは、動かす前から書いてある',
        noZw(await gjPage.locator('[data-testid="navi-reorder-hint"]').innerText()) ===
          ja.cookNavi.reorderHint,
        noZw(await gjPage.locator('[data-testid="navi-reorder-hint"]').innerText()),
      )

      // --- GJ-01: 上へ・下へで順番が変わる／390pxで押せる大きさ ---
      currentCheck = 'GJ-01'
      const gjBtn = await gjPage.evaluate(() => {
        const up = document.querySelectorAll('[data-testid="navi-step-up"]')[1]
        const down = document.querySelectorAll('[data-testid="navi-step-down"]')[1]
        const box = (el) => {
          const b = el.getBoundingClientRect()
          el.scrollIntoView({ block: 'center', inline: 'center' })
          const r = el.getBoundingClientRect()
          const cx = r.left + r.width / 2
          const cy = r.top + r.height / 2
          // 2026-08-25 便KM: 見た目を低くして .tap-target で44pxの当たり判定を作る形にした
          //（オーナー原文「上へ下へボタンの縦幅低くして。これのせいでページ全体が無駄に長い。」）。
          // 測るのは**押せるかどうか**なので、中心から上下21pxの点を突いて確かめる
          const dead = [[cx, cy - 21], [cx, cy + 21]].filter(([x, y]) => {
            const hit = document.elementFromPoint(x, y)
            return !(hit && (hit === el || el.contains(hit)))
          }).length
          return {
            w: Math.round(b.width),
            h: Math.round(b.height),
            left: Math.round(b.left),
            right: Math.round(b.right),
            dead,
          }
        }
        return { up: box(up), down: box(down) }
      })
      check(
        'GJ-01 「上へ」「下へ」は指で押せる大きさ（実測 幅70px以上・当たり判定44px）',
        gjBtn.up.w >= 70 && gjBtn.down.w >= 70 && gjBtn.up.dead === 0 && gjBtn.down.dead === 0,
        JSON.stringify(gjBtn),
      )
      check(
        'GJ-01 2つのボタンは離してある（濡れた手の押し間違い対策・実測6px以上）',
        gjBtn.down.left - gjBtn.up.right >= 6,
        String(gjBtn.down.left - gjBtn.up.right),
      )
      check(
        'GJ-01 いちばん上の手順は「上へ」を押せない',
        await gjPage.locator('[data-testid="navi-step-up"]').first().isDisabled(),
      )
      check(
        'GJ-01 いちばん下の手順は「下へ」を押せない',
        await gjPage.locator('[data-testid="navi-step-down"]').last().isDisabled(),
      )
      await gjPage.locator('[data-testid="navi-step-down"]').nth(0).click()
      await gjPage.waitForTimeout(600)
      const gjMoved = await gjOrder()
      check(
        'GJ-01 「下へ」を押すと、その手順が1つ後ろへ動く',
        gjMoved[0] === gjAuto[1] && gjMoved[1] === gjAuto[0],
        `${gjAuto.slice(0, 2).join(' / ')} → ${gjMoved.slice(0, 2).join(' / ')}`,
      )
      await gjPage.locator('[data-testid="navi-step-up"]').nth(1).click()
      await gjPage.waitForTimeout(600)
      check(
        'GJ-01 「上へ」で押し返すと元の並びに戻る（押しすぎても戻せる）',
        (await gjOrder()).join('|') === gjAuto.join('|'),
        (await gjOrder()).join(' | '),
      )
      // 以降のためにもう一度動かしておく
      await gjPage.locator('[data-testid="navi-step-down"]').nth(0).click()
      await gjPage.waitForTimeout(600)
      // 2026-08-27 便LO: 「並べ替えの状態の欄が出ない」を見る節（GJ-07・GJ-05）に、
      // **出る場面**を対で置く。対が無いと、欄そのものが消えても改名されても
      // 「出さない」は必ず緑になる＝何も測っていない
      check(
        'GJ-01 手で動かすと、並べ替えの状態の欄が出る（GJ-07・GJ-05の「出ない」と対）',
        (await gjPage.locator('[data-testid="navi-reorder-state"]').count()) === 1,
      )

      // --- GJ-08: 何回動かしても手順は消えない ---
      currentCheck = 'GJ-08'
      for (const i of [2, 3, 4]) {
        await gjPage.locator('[data-testid="navi-step-up"]').nth(i).click()
        await gjPage.waitForTimeout(350)
      }
      const gjAfterMany = await gjOrder()
      check(
        'GJ-08 4回動かしても手順は1つも消えない・増えない',
        gjAfterMany.length === gjAuto.length &&
          [...gjAfterMany].sort().join('|') === [...gjAuto].sort().join('|'),
        `${gjAuto.length}→${gjAfterMany.length}`,
      )

      // --- GJ-06: 無理になる並びは止めずに印を出す ---
      currentCheck = 'GJ-06'
      const gjIssues = (await gjPage.locator('[data-testid="navi-step-issue"]').allInnerTexts()).map(noZw)
      check(
        'GJ-06 うちの台所では続けられなくなる並びに、印が出る',
        gjIssues.length > 0,
        gjIssues.join(' / '),
      )
      check(
        'GJ-06 印の文は理由を名指しする（レシピの順／コンロ・レンジ・グリル・トースター／火にかけたまま）',
        gjIssues.every((t) =>
          t.includes(ja.cookNavi.reorderIssueRecipeOrder) ||
          t.includes(ja.cookNavi.reorderIssueStove) ||
          t.includes(ja.cookNavi.reorderIssueMicrowave) ||
          t.includes(ja.cookNavi.reorderIssueGrill) ||
          t.includes(ja.cookNavi.reorderIssueToaster) ||
          t.includes(ja.cookNavi.reorderIssueUnattended),
        ),
        gjIssues.join(' / '),
      )
      const gjIssueNote = noZw(await gjPage.locator('[data-testid="navi-reorder-issue-note"]').innerText())
      check(
        'GJ-06 まとめの行に、そのまま進めることもできると書いてある（止めない）',
        gjIssueNote.includes(ja.cookNavi.reorderIssueNote.split('。')[1]),
        gjIssueNote,
      )
      check(
        'GJ-06 印が出ても、動かす手立ては押せるまま（止めない）',
        !(await gjPage.locator('[data-testid="navi-step-down"]').nth(0).isDisabled()),
      )
      // 2026-08-14 便GL: 目安の分数が何の数字かは、**数字と同じ枠の中**で言うようになった
      // （便GJ は手順リストの直前に1行で書いていたが、数字は画面のずっと上にあった）
      check(
        'GJ-06 目安の分数が何の数字かを書いてある',
        noZw(await gjPage.locator('[data-testid="navi-total-estimate-stale"]').innerText()).includes(
          ja.cookNavi.estimateStaleNote,
        ),
        noZw(await gjPage.locator('[data-testid="navi-total-estimate-stale"]').innerText()),
      )

      // --- GJ-02: 変えた順番のまま調理中モードが進む ---
      currentCheck = 'GJ-02'
      const gjShown = await gjOrder()
      await gjPage.locator('[data-testid="cook-session-start"]').click()
      await gjPage.waitForTimeout(900)
      const gjSessionTexts = []
      for (let i = 0; i < 3; i++) {
        gjSessionTexts.push(noZw(await gjPage.locator('[data-testid="cook-session-step-text"]').innerText()).replace(/\s+/g, ''))
        if (i < 2) {
          await gjPage.locator('[data-testid="cook-session-next"]').click()
          await gjPage.waitForTimeout(500)
        }
      }
      check(
        'GJ-02 調理中モードは、手で変えた順番のまま進む（元の順に戻らない）',
        // 便LK: 空だと every は中身を1回も見ずに true になる（測れていないのに緑）
        gjSessionTexts.length > 0 &&
          gjSessionTexts.every((t, i) => gjShown[i].includes(t) || t.includes(gjShown[i])),
        `一覧=${gjShown.slice(0, 3).join(' / ')} 調理中=${gjSessionTexts.join(' / ')}`,
      )
      check(
        'GJ-02 段取りの通し番号も、変えた順番で数え直されている',
        /^段取り 3\//.test(await gjPage.locator('[data-testid="cook-session-counter"]').innerText()),
        await gjPage.locator('[data-testid="cook-session-counter"]').innerText(),
      )
      await gjPage.locator('[data-testid="cook-session-close"]').click()
      await gjPage.waitForTimeout(700)

      // --- GJ-03: その日のうちは残る ---
      currentCheck = 'GJ-03'
      await gjPage.goto(`${BASE}/#/meal-plan`)
      await gjPage.waitForTimeout(1000)
      await gjPage.goto(`${BASE}/#/cook-navi`)
      await gjPage.waitForTimeout(1400)
      check(
        'GJ-03 画面を移って戻っても、手で変えた並びが残る',
        (await gjOrder()).join('|') === gjShown.join('|'),
        (await gjOrder()).join(' | '),
      )
      await gjPage.reload({ waitUntil: 'networkidle' })
      await gjPage.waitForTimeout(1600)
      check(
        'GJ-03 読み込み直しても、手で変えた並びが残る',
        (await gjOrder()).join('|') === gjShown.join('|'),
        (await gjOrder()).join(' | '),
      )

      // --- GJ-05: 元に戻せる ---
      currentCheck = 'GJ-05'
      await gjPage.locator('[data-testid="navi-reorder-undo"]').click()
      await gjPage.waitForTimeout(600)
      const gjUndoneOne = await gjOrder()
      check(
        'GJ-05 「1つ前の並びに戻す」で、直前の1回だけが取り消される',
        gjUndoneOne.join('|') !== gjShown.join('|') && gjUndoneOne.join('|') !== gjAuto.join('|'),
        gjUndoneOne.join(' | '),
      )
      // 2026-08-14 便GL: 確認はブラウザの素の窓ではなく、画面の中の窓（便FXの「完成！」と同じ作法）
      await gjPage.locator('[data-testid="navi-reorder-reset"]').click()
      await gjPage.waitForTimeout(700)
      const gjResetModal = noZw(
        await gjPage.locator('[data-testid="navi-reorder-reset-modal"]').innerText(),
      )
      check(
        'GJ-05 「自動の並びに戻す」の確認は、何が消えて何が残るかを両方書く（規約F）',
        gjResetModal.includes('手で動かした') &&
          gjResetModal.includes('取り消します') &&
          gjResetModal.includes(ja.cookNavi.reorderUndoAllConfirm.split('{m}品')[1]),
        gjResetModal,
      )
      await gjPage.locator('[data-testid="navi-reorder-reset-modal-cancel"]').click()
      await gjPage.waitForTimeout(500)
      check(
        'GJ-05 確認でやめると、並びは変わらない',
        (await gjOrder()).join('|') === gjUndoneOne.join('|'),
        (await gjOrder()).join(' | '),
      )
      await gjPage.locator('[data-testid="navi-reorder-reset"]').click()
      await gjPage.waitForTimeout(500)
      await gjPage.locator('[data-testid="navi-reorder-reset-modal-ok"]').click()
      await gjPage.waitForTimeout(800)
      check(
        'GJ-05 「自動の並びに戻す」で、自動で組んだ並びに戻る',
        (await gjOrder()).join('|') === gjAuto.join('|'),
        (await gjOrder()).join(' | '),
      )
      check(
        'GJ-05 戻したあとは、印も並べ替えの状態の欄も消える',
        (await gjPage.locator('[data-testid="navi-reorder-state"]').count()) === 0 &&
          (await gjPage.locator('[data-testid="navi-step-issue"]').count()) === 0,
      )

      // --- GJ-04: 日付が変わったら捨てる（推測しない） ---
      currentCheck = 'GJ-04'
      await gjPage.locator('[data-testid="navi-step-down"]').nth(0).click()
      await gjPage.waitForTimeout(600)
      await gjPage.evaluate(() => {
        const key = 'uchi-recipe-cook-navi-session'
        const raw = JSON.parse(localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify({ ...raw, date: '2020-01-01' }))
      })
      await gjPage.reload({ waitUntil: 'networkidle' })
      await gjPage.waitForTimeout(1600)
      check(
        'GJ-04 日付が変わったら、手で変えた並びごと捨てる（段取りを出さない）',
        (await gjPage.locator('[data-testid="navi-step-text"]').count()) === 0,
      )
      // 文面は「調理の途中だったか」で2通りある（便FT）。どちらでも同じ判定になる形で見る
      const gjExpired = noZw(await gjPage.locator('[data-testid="navi-restore-expired"]').innerText())
      check(
        'GJ-04 捨てたことは黙らない（理由と、何が残るかを1行で出す）',
        gjExpired.includes('日付が変わったため') &&
          gjExpired.includes('残していません') &&
          gjExpired.includes(ja.cookNavi.restoreExpiredByDate.split('。')[1]),
        gjExpired,
      )
      // 組み直すと、自動で組んだ並びから始まる（昨日の並びを当てにいかない）
      await gjPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await gjPage.waitForTimeout(1000)
      check(
        'GJ-04 組み直すと、自動で組んだ並びから始まる',
        (await gjOrder()).join('|') === gjAuto.join('|'),
        (await gjOrder()).join(' | '),
      )
    } finally {
      await gjBrowser.close()
    }
  }

  // ============================================================================
  // GL-01〜03: 並べ替えの見え方（2026-08-14 便GL・実操作テスト3回目）
  //
  //   GL-01 並べ替えたあと、目安の分数と**同じ枠の中**に印が出て、分数は灰色になる
  //         （「数字が載っているカードには何の印もない。上へスクロールしたら私は17分後だと信じます」）
  //   GL-02 「自動の並びに戻す」の確認は画面の中の窓（ブラウザの素の確認を出さない）
  //   GL-03 「1つ前の並びに戻す」は連打で戻れる／押す場所が動かない
  //         （「あと◯回」は 2026-08-25 便KT・オーナー指示で消した。KT-2 が戻っていないかを見る）
  // ============================================================================
  currentCheck = 'GL-01'
  {
    const glBrowser = await chromium.launch()
    const glCtx = await glBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const glPage = await glCtx.newPage()
    /** ブラウザの素の確認・警告が出たら記録する（GL-02 は「出ないこと」を見る） */
    const glNativeDialogs = []
    glPage.on('dialog', (d) => { glNativeDialogs.push(d.message()); void d.accept() })
    glPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@GL] ${err.message}`)
    })
    glPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@GL] ${t}`)
    })
    const noZw = (t) => (t ?? '').replace(/​/g, '')
    const glOrder = async () =>
      (await glPage.locator('[data-testid="navi-step-text"]').allInnerTexts()).map((t) =>
        noZw(t).replace(/\s+/g, ''),
      )
    try {
      await glPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await glPage.waitForTimeout(1800)
      // docs/71 R3 と同じ形（グリル15分・レンジ・鍋）の3品を、利用者の書き方で入れる
      await glPage.evaluate(async () => {
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
        const a = await P(store('recipes').add(mk('GL鶏のみそマヨ焼き', [
          { text: '鶏むね肉をそぎ切りにする。塩こしょうと酒をふって10分ほどおく。', minutes: 10 },
          { text: 'みそとマヨネーズを混ぜ合わせる。', minutes: 2 },
          { text: '魚焼きグリルで15分焼く。', minutes: 15 },
          { text: '焼けたら乾燥パセリをふる。', minutes: 1 },
        ])))
        // 1品だけ「沸騰したお湯で」＝ナビが湯沸かしの待ちを足す形にする（GL-07 で使う）
        const b = await P(store('recipes').add(mk('GLごま和え', [
          { text: 'ほうれん草とにんじんを切る。', minutes: 4 },
          { text: 'たっぷりのお湯でほうれん草を1分ゆでる。', minutes: 1 },
          { text: 'すりごまと醤油で和える。', minutes: 2 },
        ])))
        const c = await P(store('recipes').add(mk('GLみそ汁', [
          { text: '鍋に水とだしの素を入れて中火にかける。', minutes: 2 },
          { text: '豆腐とわかめを入れて2分煮る。', minutes: 2 },
          { text: 'みそを溶き入れる。', minutes: 2 },
        ])))
        let addedAt = Date.now()
        for (const id of [a, b, c]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await glPage.goto(`${BASE}/#/cook-navi`)
      await glPage.reload({ waitUntil: 'networkidle' })
      await glPage.waitForTimeout(1600)
      await glPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await glPage.waitForTimeout(1200)

      // --- GL-01: 目安の分数につく印 ---
      currentCheck = 'GL-01'
      const glAuto = await glOrder()
      check('GL 前提: 3品の段取りが組める', glAuto.length >= 6, String(glAuto.length))
      check(
        'GL-01 自動の並びのままなら、目安の分数に印は付かない',
        (await glPage.locator('[data-testid="navi-total-estimate-stale"]').count()) === 0,
      )
      /** 分数の色（灰色になったか）を実DOMで測る */
      const glMinutesColor = async (sel) =>
        glPage.evaluate((s) => {
          const el = document.querySelector(s)
          return el ? getComputedStyle(el).color : ''
        }, sel)
      const glTotalColorBefore = await glMinutesColor('[data-testid="navi-total-estimate"]')
      // 手で1回動かす
      await glPage.locator('[data-testid="navi-step-down"]').nth(0).click()
      await glPage.waitForTimeout(600)
      check(
        'GL-01 並べ替えたあとは「全体の目安」と同じ枠の中に印が出る',
        noZw(await glPage.locator('[data-testid="navi-total-estimate-stale"]').innerText()) ===
          ja.cookNavi.estimateStaleNote,
        noZw(await glPage.locator('[data-testid="navi-total-estimate-stale"]').innerText()),
      )
      // 2026-08-25 便KT: 「できあがりの目安」の枠はオーナー指示で消したので、その枠の中の
      // 印と色を見ていた3件は落とした。**残す側**（全体の調理時間と同じ枠の中に印が出る・
      // 分数そのものも灰色になる）は便GLの要点そのものなので、そのまま見張る
      const glTotalColorAfter = await glMinutesColor('[data-testid="navi-total-estimate"]')
      check(
        'GL-01 分数そのものの色も変わる（灰色にして、いまの並びの答えでないと見て分かる）',
        glTotalColorAfter !== glTotalColorBefore,
        `全体 ${glTotalColorBefore}→${glTotalColorAfter}`,
      )
      check(
        'GL-01 印は、数字と同じ枠の中にある（手順リストの手前ではなく）',
        await glPage.evaluate(() => {
          const card = document.querySelector('[data-testid="navi-total-card"]')
          const mark = document.querySelector('[data-testid="navi-total-estimate-stale"]')
          return Boolean(card && mark && card.contains(mark))
        }),
      )

      // --- GL-03: 連打で戻れる／押す場所が動かない ---
      currentCheck = 'GL-03'
      for (let i = 0; i < 4; i++) {
        await glPage.locator('[data-testid="navi-step-down"]').nth(i + 1).click()
        await glPage.waitForTimeout(350)
      }
      const glMoved = await glOrder()
      // 2026-08-25 便KT・オーナー原文「並行調理の手順変更「１つ前の並びに戻す」→（あと◯回）削除」。
      // 残り回数は消した。**押せる回数の上限は元から無い**ので、下の連打の検査がそのまま
      // 「何度でも戻せる」を見張る。ここでは残り回数が戻っていないことだけを見る
      check(
        'KT-2 戻すボタンに残り回数を書かない（ボタン名は ja.ts のとおり）',
        noZw(await glPage.locator('[data-testid="navi-reorder-undo"]').innerText()) ===
          noZw(ja.cookNavi.reorderUndoOne),
        noZw(await glPage.locator('[data-testid="navi-reorder-undo"]').innerText()),
      )
      // 押す場所を動かさないまま、同じ座標を5回押せるか（連打の再現）
      const glUndoBox = await glPage.locator('[data-testid="navi-reorder-undo"]').boundingBox()
      await glPage.locator('[data-testid="navi-reorder-undo"]').scrollIntoViewIfNeeded()
      await glPage.waitForTimeout(200)
      const glBoxes = []
      let glTaps = 0
      for (let i = 0; i < 5; i++) {
        const box = await glPage.locator('[data-testid="navi-reorder-undo"]').boundingBox()
        if (!box) break
        glBoxes.push(Math.round(box.y))
        // **同じ座標を叩く**（要素を掴み直さない＝指を動かさない人と同じ押し方）
        await glPage.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        glTaps++
        await glPage.waitForTimeout(400)
      }
      check(
        'GL-03 「1つ前の並びに戻す」は連打で戻れる（5回動かしたら5回とも押せる）',
        glTaps === 5 && (await glOrder()).join('|') === glAuto.join('|'),
        `押せた回数=${glTaps} 並び=${(await glOrder()).slice(0, 3).join(' / ')}`,
      )
      check(
        'GL-03 連打の間、ボタンの位置が動かない（実測390pxで縦のずれ4px以内）',
        Math.max(...glBoxes) - Math.min(...glBoxes) <= 4,
        glBoxes.join(','),
      )
      check(
        'GL-03 全部戻したら、並べ替えの欄も印も消える',
        (await glPage.locator('[data-testid="navi-reorder-state"]').count()) === 0 &&
          (await glPage.locator('[data-testid="navi-total-estimate-stale"]').count()) === 0,
      )
      void glMoved
      void glUndoBox

      // --- GL-02: 「自動の並びに戻す」は画面の中の窓 ---
      currentCheck = 'GL-02'
      await glPage.locator('[data-testid="navi-step-down"]').nth(0).click()
      await glPage.waitForTimeout(500)
      glNativeDialogs.length = 0
      await glPage.locator('[data-testid="navi-reorder-reset"]').click()
      await glPage.waitForTimeout(700)
      check(
        'GL-02 「自動の並びに戻す」でブラウザの素の確認が出ない',
        glNativeDialogs.length === 0,
        glNativeDialogs.join(' | '),
      )
      check(
        'GL-02 代わりに画面の中の窓が開く（便FXの「完成！」と同じ作法）',
        (await glPage.locator('[data-testid="navi-reorder-reset-modal"]').count()) === 1,
      )
      const glResetText = noZw(
        await glPage.locator('[data-testid="navi-reorder-reset-modal"]').innerText(),
      )
      check(
        'GL-02 窓の中に、何が消えて何が残るかが件数つきで書いてある（規約F）',
        // 2026-08-29 便MN: 文言を書き写していたので ja.ts から組み立てる（禁じ手②）。
        // 見たい事実は「手で動かした回数（1回）を取り消すと書いてある」ことなので、
        // 差し込み {n} に 1 を入れた形をそのまま作る
        glResetText.includes(ja.cookNavi.reorderUndoAllConfirm.split('。')[0].replace('{n}', '1')) &&
          glResetText.includes('選んでいる3品') &&
          glResetText.includes(ja.cookNavi.reorderUndoAllConfirm.split('{m}品')[1]),
        glResetText,
      )
      check(
        'GL-02 行き先は2つとも言葉で書いてある（OK／キャンセルではない）',
        glResetText.includes('自動の並びに戻す') && glResetText.includes(ja.cookNavi.reorderUndoAllCancel),
        glResetText,
      )
      await glPage.locator('[data-testid="navi-reorder-reset-modal-cancel"]').click()
      await glPage.waitForTimeout(400)
      check(
        'GL-02 「並べ替えたままにする」を選ぶと、並びはそのまま',
        (await glPage.locator('[data-testid="navi-reorder-state"]').count()) === 1,
      )
      await glPage.locator('[data-testid="navi-reorder-reset"]').click()
      await glPage.waitForTimeout(400)
      await glPage.locator('[data-testid="navi-reorder-reset-modal-ok"]').click()
      await glPage.waitForTimeout(700)
      check(
        'GL-02 「自動の並びに戻す」を選ぶと、自動で組んだ並びに戻る',
        (await glOrder()).join('|') === glAuto.join('|'),
        (await glOrder()).slice(0, 3).join(' / '),
      )

      // --- GL-07: 「沸くまでの待ち時間」は、押す前に何分ではかるかが読める ---
      //   「押すと5分固定で始まるが、事前に分数がどこにも書いていない（押すまで分からない）」
      //   ※沸くまでの時間そのものは言い切らない（オーナー指示D-3）ので、タイマーの分数を書く
      currentCheck = 'GL-07'
      const glBoilNote = noZw(
        await glPage.locator('[data-testid="navi-boil-note"]').first().innerText(),
      )
      check(
        'GL-07 押す前に、タイマーが何分ではかるかが書いてある',
        glBoilNote.includes('タイマーは5分ではかります'),
        glBoilNote,
      )
      check(
        'GL-07 沸くまでの時間そのものは言い切らない（火力と量で変わる）',
        glBoilNote.includes(noZw(ja.cookNavi.waitBlockBoilNote).split('。')[2]),
        glBoilNote,
      )
      // 測りたいのは「押す前に目に入る」こと。ボタンからの距離をpxで決め打ちすると、
      // あいだに別の説明（範囲タイマーの一文・並行の案内）が正当に入った瞬間に落ちる
      // （CLAUDE.mdの禁じ手④。2026-08-15に実際に落ちた）。同じ待ちのブロックの中にあり、
      // ボタンと同時に画面へ入ることで測る
      await glPage
        .locator('[data-testid="navi-boil-note"]')
        .first()
        .scrollIntoViewIfNeeded()
      await glPage.waitForTimeout(300)
      check(
        'GL-07 その一文は、タイマーのボタンと同時に画面に入る＝押す前に目に入る',
        await glPage.evaluate(() => {
          const note = document.querySelector('[data-testid="navi-boil-note"]')
          if (!note) return false
          const card = note.closest('li') ?? note.parentElement
          const btn = [...(card?.querySelectorAll('button') ?? [])].find((b) =>
            (b.textContent ?? '').includes('タイマーを始める'),
          )
          if (!btn) return false
          const n = note.getBoundingClientRect()
          const b = btn.getBoundingClientRect()
          const inView = (r) => r.top >= 0 && r.bottom <= window.innerHeight
          return card.contains(btn) && inView(n) && inView(b)
        }),
      )

      // --- GL-04〜06・08: 調理中モードのタイマーまわり ---
      currentCheck = 'GL-05'
      await glPage.locator('[data-testid="cook-session-start"]').click()
      await glPage.waitForTimeout(1000)
      /** いまの手順に「タイマーを始める」が出ているか */
      const glHasTimerButton = async () =>
        (await glPage
          .locator('[data-testid="cook-session-wait-block"]')
          .getByRole('button', { name: ja.cookNavi.startTimer })
          .count()) > 0
      // 待ちのタイマーが出る手順まで進む（何手順目かは段取り次第なので決め打ちにしない）
      let glSteps = 0
      while (!(await glHasTimerButton()) && glSteps < 20) {
        if ((await glPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await glPage.locator('[data-testid="cook-session-next"]').click()
        await glPage.waitForTimeout(400)
        glSteps++
      }
      check('GL 前提: タイマーを出す待ちの手順まで進める', await glHasTimerButton())
      const glTimerRecipe = await glPage.locator('[data-testid="cook-session-recipe"]').innerText()
      // **押さずに**次へ
      await glPage.locator('[data-testid="cook-session-next"]').click()
      await glPage.waitForTimeout(600)
      const glNotice = noZw(
        await glPage.locator('[data-testid="cook-session-timer-notice"]').innerText(),
      )
      check(
        'GL-05 タイマーを押さずに次へ進めると、その場で伝える（止めはしない）',
        glNotice.includes(ja.cookNavi.sessionTimerNotStarted.replace('{title}の「{wait}」は、', '')) &&
          glNotice.includes(noZw(glTimerRecipe)),
        glNotice,
      )
      check(
        'GL-05 伝えても進む手は止めない（次の手順が開いている）',
        (await glPage.locator('[data-testid="cook-session-step-text"]').count()) === 1 &&
          (await glPage.locator('[data-testid="cook-finish-modal"]').count()) === 0,
      )
      check(
        'GL-05 その場で始める道が1つ添えてある（戻って押し直さなくてよい）',
        (await glPage.locator('[data-testid="cook-session-timer-notice-start"]').count()) === 1,
      )
      await glPage.locator('[data-testid="cook-session-timer-notice-start"]').click()
      await glPage.waitForTimeout(700)
      check(
        'GL-05 「いまから始める」で始まり、一言は役目を終えて消える',
        (await glPage.locator('[data-testid="cook-session-timer-notice"]').count()) === 0,
      )

      // --- GL-08: タイマーの読み上げ名（2つの番号を別の名前で呼ぶ） ---
      currentCheck = 'GL-08'
      const glAria = await glPage.evaluate(() =>
        [...document.querySelectorAll('[aria-label]')]
          .map((el) => el.getAttribute('aria-label') ?? '')
          .filter((t) => t.includes('のタイマーを調整') && t.includes('段取り')),
      )
      check(
        'GL-08 読み上げ名は、段取りの番号とレシピの手順番号を別の名前で呼ぶ',
        glAria.length > 0 && glAria.every((t) => /段取り\d+/.test(t) && t.includes('手順')),
        glAria.join(' | ') || '(段取りを含む読み上げ名が無い)',
      )
      check(
        'GL-08 1つの「手順」に2つの番号がぶら下がる形（手順⑨（1-2））は読み上げ名に残っていない',
        glAria.every((t) => !/手順[①-⑳㉑-㉟㊱-㊿]/.test(t)),
        glAria.join(' | '),
      )

      // --- GL-04: 動いているタイマーが「他の品の次の手順」に混ざって見えない ---
      currentCheck = 'GL-04'
      // 始めたタイマーの品が下部の行に回るまで進める（別の品の手順を開いた状態にする）
      let glHops = 0
      while (
        (await glPage.locator('[data-testid="cook-session-other-timers"]').count()) === 0 &&
        glHops < 8
      ) {
        if ((await glPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await glPage.locator('[data-testid="cook-session-next"]').click()
        await glPage.waitForTimeout(400)
        glHops++
      }
      check(
        'GL 前提: 他の品の行にタイマーが付いた状態を作れる',
        (await glPage.locator('[data-testid="cook-session-other-timers"]').count()) > 0,
      )
      check(
        'GL-04 行に付くタイマーには「動いているタイマー」の見出しが付く（手順の行と読み分かれる）',
        noZw(
          await glPage.locator('[data-testid="cook-session-other-timers-title"]').first().innerText(),
        ) === '動いているタイマー',
      )
      check(
        'GL-04 タイマーは、その品の行の中にある（品と品のあいだに挟まらない）',
        await glPage.evaluate(() => {
          const box = document.querySelector('[data-testid="cook-session-other-timers"]')
          const row = box?.parentElement
          // 行の枠（色の線を引いている箱）の中に、その品の手順の行と一緒に入っている
          return Boolean(row && row.querySelector('[data-testid="cook-session-other-row"]'))
        }),
      )
      check(
        'GL-04 手順の行のような並び（料理名の繰り返し）にしない',
        await glPage.evaluate(() => {
          const box = document.querySelector('[data-testid="cook-session-other-timers"]')
          const row = box?.parentElement
          const title = row?.querySelector('[data-testid="cook-session-other-row"]')
          const name = (title?.textContent ?? '').replace(/\s+/g, '')
          const chips = (box?.textContent ?? '').replace(/\s+/g, '')
          // 行の見出しに出ている料理名が、タイマーの中で繰り返されていない
          const dish = name.match(/GL[^\d]{1,12}/)?.[0] ?? ''
          return dish.length > 2 && !chips.replace('動いているタイマー', '').includes(dish)
        }),
      )

      // --- GL-06: 終わるときに、動いているタイマーをどうするか聞く ---
      currentCheck = 'GL-06'
      let glGuard = 0
      while (
        (await glPage.locator('[data-testid="cook-session-finish"]').count()) === 0 &&
        glGuard < 20
      ) {
        await glPage.locator('[data-testid="cook-session-next"]').click()
        await glPage.waitForTimeout(300)
        glGuard++
      }
      check('GL 前提: 最後の手順まで進める', (await glPage.locator('[data-testid="cook-session-finish"]').count()) === 1)
      await glPage.locator('[data-testid="cook-session-finish"]').click()
      await glPage.waitForTimeout(800)
      // GL-05 の「途中で次へ進めても終わりの窓は出ない」（count()===0）の対（2026-08-29 便MO）。
      // 目印を cook-finish-modalZZ に改名しても GL の節は 36/36件のまま緑だった＝出ない側だけでは
      // 何も測れていない。**最後まで進めて終えたときは出る**のを同じ節で1つ測って対にする。
      // 段取りを終わらせるのはこの GL-06 の役目なので、GL-05 の場で終わらせて
      // 後ろの GL-08・GL-04 を測れなくする必要はない
      check(
        'GL-06 最後まで進めて「完成！」を押すと、終わりの窓がその場に出る',
        (await glPage.locator('[data-testid="cook-finish-modal"]').count()) === 1,
      )
      check(
        'GL-06 「完成！」の窓で、動いているタイマーのことを聞く',
        (await glPage.locator('[data-testid="cook-finish-timers"]').count()) === 1,
      )
      const glFinishTimers = noZw(
        await glPage.locator('[data-testid="cook-finish-timers"]').innerText(),
      )
      check(
        'GL-06 何本あるか・どの料理のものかを書いてある',
        jaRe(ja.cookNavi.sessionFinishTimersTitle, { n: '\\d+' }).test(glFinishTimers) &&
          glFinishTimers.includes('GL'),
        glFinishTimers,
      )
      check(
        'GL-06 既定は消さない（押し間違いで残り時間を失わない）',
        (await glPage.locator('[data-testid="cook-finish-timers-stop"]').getAttribute('aria-checked')) ===
          'false',
      )
      check(
        'GL-06 消さない側の結果が書いてある（規約F）',
        noZw(await glPage.locator('[data-testid="cook-finish-timers-note"]').innerText()).includes(
          ja.cookNavi.sessionFinishTimersKeepNote,
        ),
        noZw(await glPage.locator('[data-testid="cook-finish-timers-note"]').innerText()),
      )
      await glPage.locator('[data-testid="cook-finish-timers-stop"]').click()
      await glPage.waitForTimeout(400)
      check(
        'GL-06 消す側を選ぶと、消したときの結果に書き替わる（規約F）',
        noZw(await glPage.locator('[data-testid="cook-finish-timers-note"]').innerText()).includes(
          ja.cookNavi.sessionFinishTimersStopNote,
        ),
        noZw(await glPage.locator('[data-testid="cook-finish-timers-note"]').innerText()),
      )
      // 記録はつけずに終える（作った記録に触らずタイマーの扱いだけを見る）
      await glPage.locator('[data-testid="cook-finish-close"]').click()
      await glPage.waitForTimeout(1000)
      check(
        'GL-06 選んだとおり、動いていたタイマーは消えている',
        (await glPage.evaluate(() =>
          [...document.querySelectorAll('[aria-label]')]
            .map((el) => el.getAttribute('aria-label') ?? '')
            .filter((t) => t.includes('のタイマーを調整')).length,
        )) === 0,
      )
    } finally {
      await glBrowser.close()
    }
  }

  // ============================================================================
  // 便GS（2026-08-15 オーナー実機・iPhone SE2 / Chrome）: 声で操作の3点
  //   ①「戻る『戻って』『戻る』の他に『前へ』『前』も対応したい（ボタンと同じ表記にも対応したい）」
  //   ②「読み上げをストップする方法が、音声にない。タイマーの停止と混同しそうなので、
  //     片方優先するならタイマー」＝**「ストップ」単独はタイマーのまま**にしたうえで、
  //     「読み上げ」の語と一緒に言われたときだけ読み上げを止める
  //   ③ 声の案内の出し方を、並行調理ナビの調理中モード（FO-03）にそろえる＝聞いている間だけ。
  //     マイクを切っているのに「『次へ』で手順の移動」と出ていると、その言葉はいま何も
  //     起きないので、画面が実態と違うことを言っている状態になる
  //   ④ 電池の一言は使い方ページ（public/about/manual.html）に置く（オーナー判断
  //     「調理中モードの中だと画面がごちゃつく→HPに説明がひとことあればいい」）
  //
  // 声の実機挙動は自動では再現できないため、FOCUSVOICE-01 と同じく window.SpeechRecognition を
  // 偽装して onresult に文字列を注入する。
  // ============================================================================
  currentCheck = 'GS-03'
  {
    const gsBrowser = await chromium.launch()
    const gsContext = await gsBrowser.newContext({ viewport: { width: 375, height: 667 } })
    await gsContext.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = ''
          this.continuous = false
          this.interimResults = false
        }
        start() {
          window.__fakeRecognition = this
        }
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRecognition
      window.webkitSpeechRecognition = FakeRecognition
      window.__emitVoice = (text) => {
        const r = window.__fakeRecognition
        if (!r || typeof r.onresult !== 'function') return false
        r.onresult({ results: [[{ transcript: text }]] })
        return true
      }
    })
    const gsPage = await gsContext.newPage()
    gsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@便GS] ${err.message}`)
    })
    // BudouX がゼロ幅スペースを差し込むので、照合の前に必ず外す（禁じ手②）
    const noZw = (t) => (t ?? '').replace(/​/g, '')
    const gsBody = async () => noZw(await gsPage.textContent('body'))
    /** 声を注入して、画面が反応するのを待つ */
    const gsEmit = async (text) => {
      const emitted = await gsPage.evaluate((t) => window.__emitVoice(t), text)
      await gsPage.waitForTimeout(450)
      return emitted
    }
    /** いま何手順目か（手順数を決め打ちしない＝手順が増減しても同じ判定になる。禁じ手③） */
    const gsStep = async () => {
      const m = (await gsBody()).match(/手順\s*(\d+)\/(\d+)/)
      return m ? { n: Number(m[1]), total: Number(m[2]) } : null
    }
    /** この画面で止まっているタイマー（一時停止中だけ「再開」ボタンが出る） */
    const gsPausedCount = () => gsPage.locator('[data-testid="focus-timer-resume"]').count()
    try {
      await gsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await gsPage.waitForTimeout(2000)
      await gsPage.getByText('肉じゃが', { exact: true }).first().click()
      await gsPage.waitForTimeout(700)
      await gsPage.getByText(ja.focus.open).click()
      await gsPage.waitForTimeout(600)

      // --- GS-03: 案内を出す条件を、並行調理ナビ（FO-03）とそろえる ---
      check(
        'GS-03 前提: 1品の調理中モードに「声で操作」のボタンが常にある（声を使えることの入口）',
        (await gsPage.locator(`button[aria-label="${ja.focus.micStart}"]`).count()) === 1,
      )
      check(
        'GS-03 声を切っている間は、言葉の一覧を画面に出さない（ナビと同じ）',
        !(await gsBody()).includes('声で操作:'),
        (await gsBody()).slice(0, 160),
      )
      await gsPage.locator(`button[aria-label="${ja.focus.micStart}"]`).click()
      await gsPage.waitForTimeout(500)
      check(
        'GS-03 「声で操作」を押すと言葉の一覧が出る（使う人だけが読む）',
        (await gsBody()).includes('声で操作:') && (await gsBody()).includes('聞いています'),
      )
      check(
        'GS-03 1品の画面には色の言い方を出さない（色が無い画面なので）',
        !(await gsBody()).includes(ja.cookNavi.sessionMicColorHint),
      )
      await gsPage.locator(`button[aria-label="${ja.focus.micStop}"]`).click()
      await gsPage.waitForTimeout(500)
      check(
        'GS-03 もう一度押して切ると、案内もまた消える',
        !(await gsBody()).includes('声で操作:'),
        (await gsBody()).slice(0, 160),
      )
      // 以降の検証のため、聞いている状態に戻す
      await gsPage.locator(`button[aria-label="${ja.focus.micStart}"]`).click()
      await gsPage.waitForTimeout(500)

      // --- GS-01: 画面のボタンの表記そのままで手順を動かせる ---
      currentCheck = 'GS-01'
      const gsFirstStep = await gsStep()
      check(
        'GS 前提: 手順が3つ以上あるレシピで見ている（3手順ぶんの移動を見るため）',
        Boolean(gsFirstStep) && gsFirstStep.n === 1 && gsFirstStep.total >= 3,
        JSON.stringify(gsFirstStep),
      )
      await gsEmit('次へ')
      check('GS-01 「次へ」は従来どおり手順を進める', (await gsStep())?.n === 2, JSON.stringify(await gsStep()))
      await gsEmit('前')
      check(
        'GS-01 漢字1文字の「前」で手順が戻る（ボタンの「前へ」と同じ言い方）',
        (await gsStep())?.n === 1,
        JSON.stringify(await gsStep()),
      )
      await gsEmit('名前')
      check(
        'GS-01 「名前」では手順が動かない（部分一致にしていない）',
        (await gsStep())?.n === 1,
        JSON.stringify(await gsStep()),
      )
      check(
        'GS-01 「名前」は対応外の言葉として返す（マイクは届いていると分かる）',
        (await gsBody()).includes('「名前」は声で使える言葉ではありません'),
      )
      await gsEmit('次へ')
      await gsEmit('次へ')
      check('GS-01 前提: 3手順目まで進める', (await gsStep())?.n === 3, JSON.stringify(await gsStep()))
      await gsEmit('前に')
      check('GS-01 「前に」でも戻る', (await gsStep())?.n === 2, JSON.stringify(await gsStep()))
      await gsEmit('最初の手順へ')
      check(
        'GS-01 ナビのボタンと同じ「最初の手順へ」で先頭に戻る',
        (await gsStep())?.n === 1,
        JSON.stringify(await gsStep()),
      )

      // --- GS-02: 読み上げを止める声を足しても、「ストップ」単独はタイマーのまま ---
      currentCheck = 'GS-02'
      await gsEmit('3分タイマー')
      const gsTimerCount = await gsPage.evaluate(
        () =>
          [...document.querySelectorAll('[aria-label]')].filter((el) =>
            (el.getAttribute('aria-label') ?? '').includes('のタイマーを調整'),
          ).length,
      )
      check('GS-02 前提: 声でタイマーを1本動かせた', gsTimerCount > 0, `本数=${gsTimerCount}`)
      check('GS-02 前提: まだ一時停止していない', (await gsPausedCount()) === 0)
      await gsEmit('読み上げストップ')
      check(
        'GS-02 「読み上げストップ」ではタイマーを止めない（止めるのは読み上げだけ）',
        (await gsPausedCount()) === 0,
      )
      check(
        'GS-02 「読み上げストップ」は聞き取れている（無反応ではない）',
        (await gsBody()).includes('「読み上げストップ」を聞き取りました'),
        (await gsBody()).slice(0, 200),
      )
      await gsEmit('ストップ')
      check(
        'GS-02 「ストップ」単独は今までどおりタイマーを一時停止する（オーナー「片方優先するならタイマー」）',
        (await gsPausedCount()) === 1,
      )
      check(
        'GS-02 どのタイマーを止めたかを名前で返す',
        (await gsBody()).includes(ja.focus.micTimerPaused.replace('{label}', '')),
        (await gsBody()).slice(0, 200),
      )

      // --- GS-04: 電池の一言と、声で使える言葉の説明は使い方ページに載せる ---
      currentCheck = 'GS-04'
      const gsManual = await (await gsPage.request.get(`${BASE}/about/manual.html`)).text()
      check(
        'GS-04 使い方ページに、声で操作がONの間は電池の減りが速くなることが書いてある',
        gsManual.includes('電池の減りが速くなります'),
      )
      check(
        'GS-04 使い方ページの声の言葉に「前へ」「前」が載っている',
        gsManual.includes('「前へ」「前」'),
      )
      check(
        'GS-04 使い方ページの声の言葉に「最初の手順へ」が載っている',
        gsManual.includes('<li>「最初の手順へ」'),
      )
      check(
        'GS-04 使い方ページの声の言葉に「読み上げストップ」が載っている',
        gsManual.includes('<li>「読み上げストップ」'),
      )
      check(
        'GS-04 使い方ページに、声の案内が聞いている間だけ出ることが書いてある',
        // 2026-08-29: 語尾（「出ます」）まで書き写していたので、**事実（押している間だけ）**で見る形にした。
        // 表記の基準で「出ます」→「表示します」にそろえた瞬間に落ちるのは、見張りが文体を縛っていたため（禁じ手②）
        gsManual.includes('を押している間だけ'),
      )
    } finally {
      await gsBrowser.close()
    }
  }


  // --- NOHOME-01: ホーム画面の廃止と、その役目の引き継ぎ(2026-08-17 便HG・オーナー決定
  // 「先にホーム画面なくします。タブの順番は、献立＞レシピ＞食材＞設定」
  //  「献立（日）の画面に、現在のホーム画面の機能をそのまま入れてください。『今日なに作る？』と
  //   『レシピを探す』『在庫の食材から探す』は、献立がない時のみに出る。献立があれば、これまで通りの
  //   献立タブにあった『今日の献立』。『最近作ったもの』は常に表示」)。
  // 骨格の変更なので、①着地 ②並び ③出し分け ④残骸、の4つを1本の流れで見る。
  // まっさらプロファイルで通しで確認する ---
  currentCheck = 'NOHOME-01'
  {
    const nhBrowser = await chromium.launch()
    const nhContext = await nhBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const nhPage = await nhContext.newPage()
    nhPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@NOHOME-01] ${text}`)
    })
    nhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NOHOME-01] ${err.message}`)
    })
    // BudouXのゼロ幅スペースを外してから照合する(禁じ手②)
    const nhBody = async () => ((await nhPage.textContent('body')) ?? '').replaceAll('​', '')
    // 「日」が選ばれているかは選択状態(aria-pressed)で見る＝見出しの置き場所には縛られない(禁じ手④)
    const nhDayPressed = async () => {
      const loc = nhPage.getByRole('button', { name: '日', exact: true })
      if ((await loc.count()) !== 1) return false
      return (await loc.getAttribute('aria-pressed')) === 'true'
    }
    try {
      // (1) 旧ホームを指していたURL(#/)を開く＝アプリを素で開いたときと同じ
      await nhPage.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(2200) // 初回シード完了待ち
      check(
        'NOHOME-01 「#/」で開くと献立の「日」に着く',
        await nhDayPressed(),
        `hash=${await nhPage.evaluate(() => location.hash)}`,
      )
      check(
        'NOHOME-01 「#/」に留まらない(献立の画面のURLへ移る)',
        (await nhPage.evaluate(() => location.hash)).startsWith('#/meal-plan'),
        `hash=${await nhPage.evaluate(() => location.hash)}`,
      )

      // (2) 下の並びは4つで、献立→レシピ→食材→設定(順番はオーナー指定なので並びごと見る)
      const nhTabs = await nhPage.$$eval('[data-app-bottom-bar] a', (els) =>
        els.map((el) => (el.textContent ?? '').replaceAll('​', '').trim()),
      )
      check(
        'NOHOME-01 下の並びは4つ・献立→レシピ→食材→設定(ホームは無い)',
        JSON.stringify(nhTabs) === JSON.stringify(['献立', 'レシピ', '食材', '設定']),
        JSON.stringify(nhTabs),
      )

      // (3) その日の献立が空の日: 3つが出る。以降は献立の画面を名指しで開いて測る
      await nhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1500)
      {
        const body = await nhBody()
        check('NOHOME-01 献立が無い日は「今日なに作る？」が出る', body.includes('今日なに作る？'))
        // 2026-08-17 便HH: 「レシピを探す」「在庫の食材から探す」は行き先が重なっていたので外した。
        // 移設そのもの(ホームにあった提案が「日」に居ること)はこの上の1件で見る。
        // 外した2つが戻ってこないことと、決め方が減っていないことは DAYLAYOUT-01 が見る
      }
      // 在庫を1品「ある」にする(「今日なに作る？」の在庫の絞り込みが出る条件)
      await nhPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('pantryItems', 'readwrite')
              const store = tx.objectStore('pantryItems')
              const g = store.getAll()
              g.onsuccess = () => {
                store.put({ ...g.result[0], level: 'have' })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await nhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nhPage.reload({ waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1400)
      // 2026-08-19 便IA: 在庫の絞り込みは「条件をしぼる」の窓の中へ移した
      // （同じ絞り込みなのに片方だけ外に残すと、押したときに後ろが動く/動かないが割れるため）
      {
        const nhConditions = nhPage.getByRole('button', { name: jaRe(ja.dayStart.conditionsToggle) })
        check('NOHOME-01 前提: 「今日なに作る？」に「条件をしぼる」がある', (await nhConditions.count()) === 1)
        if ((await nhConditions.count()) === 1) {
          await nhConditions.click()
          await nhPage.waitForTimeout(700)
        }
      }
      check(
        'NOHOME-01 在庫があるときは「今日なに作る？」の絞り込みに在庫の絞り込みが出る',
        (await nhBody()).includes('在庫の食材から'),
      )
      {
        const nhClose = nhPage.locator('[data-testid="day-conditions-close"]')
        if ((await nhClose.count()) === 1) {
          await nhClose.click()
          await nhPage.waitForTimeout(600)
        }
      }

      // (4) 「最近作ったもの」は献立が無い日でも出る
      const nhCooked = await nhPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const target = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                store.put({ ...target, cookedLogs: [{ date }], updatedAt: Date.now() })
                tx.oncomplete = () => resolve(target.title)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        // 「今日」はブラウザの中で作らず、ここで組んだ日付をそのまま渡す(曜日・月替わりに依らない)
        (() => {
          const d = new Date()
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })(),
      )
      await nhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nhPage.reload({ waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1600)
      {
        const body = await nhBody()
        check(
          'NOHOME-01 献立が無い日でも「最近作ったもの」が出る',
          body.includes('最近作ったもの') && body.includes(nhCooked),
        )
      }

      // (5) 今日の夕食に予定を入れる → 「今日の献立」が出て、探す系の3つは引っ込む
      await nhPage.evaluate(
        (date) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const main = g.result.find((r) => r.title === '肉じゃが')
                const tx = idb.transaction('mealPlans', 'readwrite')
                tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId: main.id, role: 'main' })
                tx.oncomplete = () => resolve(true)
                tx.onerror = () => reject(tx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
        (() => {
          const d = new Date()
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        })(),
      )
      await nhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await nhPage.reload({ waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1800)
      {
        const body = await nhBody()
        check(
          'NOHOME-01 献立がある日は「今日の献立」の中身が出る',
          body.includes('今日の献立') && body.includes('肉じゃが'),
        )
        // 2026-08-17 便HI: 献立がある日は節ごと畳んでおく(見出しを押すと開く)。
        // 開けることは DAYLAYOUT-01 が見る
        check(
          'NOHOME-01 献立がある日は「今日なに作る？」を開いたまま出さない',
          !body.includes('おまかせで1品出す'),
        )
        check('NOHOME-01 献立がある日も「最近作ったもの」は出る', body.includes('最近作ったもの'))
      }

      // (6) 設定から「ホーム画面のカスタマイズ」が残骸なく消えている。
      // 端末のホーム画面への追加案内(別物)は残っていること
      await nhPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1200)
      {
        const body = await nhBody()
        check(
          'NOHOME-01 設定に「ホーム画面のカスタマイズ」が無い',
          !body.includes('ホーム画面のカスタマイズ'),
        )
        check(
          'NOHOME-01 その中にあった説明・初期化・「出すとき」の残骸も無い',
          !body.includes('表示するパーツを選び') && !body.includes('「今日なに作る？」を出すとき'),
        )
        check(
          'NOHOME-01 端末のホーム画面への追加案内は残る(別物なので消さない)',
          body.includes(ja.settings.installPageLink),
        )
      }

      // (7) 知らない行き先(ホームを指していた古いブックマーク等)でも同じ場所に着く
      await nhPage.goto(`${BASE}/#/home`, { waitUntil: 'networkidle' })
      await nhPage.waitForTimeout(1500)
      check(
        'NOHOME-01 知らない行き先を開いても献立の「日」に着く',
        await nhDayPressed(),
        `hash=${await nhPage.evaluate(() => location.hash)}`,
      )
    } finally {
      await nhBrowser.close()
    }
  }

