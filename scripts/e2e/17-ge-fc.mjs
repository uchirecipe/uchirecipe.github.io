// ==========================================================================================
// e2e の節: 初回の案内・紹介ページ・便EY〜FC
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
// この中の節: GE-01, NOASK-EX, LPTEXT-EX, BUBBLE-EX, EY-01, EY-02, EZ-01, EZ-02, EZ-03, EZ-04, EZ-05, FA-1, FA-1b, FA-2, FA-3, FB-1c, FB-2, FC-01, FC-06, FC-03, FC-04, FC-05, GQ-02, FC-08, FC-07
// ==========================================================================================
import './_shared.mjs'


  // --- GE-01: 「食数の設定」「台所の器具」の初回の案内(2026-08-13 便GE・docs/65 A-4)。
  // レシピ詳細を初めて開いたときに1回だけ出す。見るのは次の8点:
  //  (a) 初回のレシピ詳細で出る・中身がそろっている・文字数が上限内
  //  (b) 閉じたら二度と出ない(「このまま使う」・✕・カード外のタップ・Escapeの4通り)
  //  (c) すでに設定を自分で決めている人には出ない(食数の設定/コンロの口数のどちらでも)
  //  (d) パソコンにも出る(ホーム画面追加の案内と違う点。人数も口数はどの端末でも同じく効く)
  //  (e) 「個人設定を開く」が「食数の設定」へ着き、その下に「台所の器具」が続く・レシピへ帰れる
  //  (f) ライト/ダークの両方で文字が読める(コントラスト比4.5:1以上)
  //  (g) 390pxで画面から出ない
  //  (h) 用事があって開いた画面(タイマーの手順・記録の編集)と、レシピ詳細以外の画面には出ない
  currentCheck = 'GE-01'
  {
    const geBrowser = await chromium.launch()
    // 相対輝度からコントラスト比を出す(WCAG 2.x)。EW-01と同じ計算
    const geContrast = (fg, bg) => {
      const lum = (css) => {
        const [r, g, b] = css.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
        const ch = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
      }
      const a = lum(fg)
      const b = lum(bg)
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    }
    const gePhone = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
    // 初回の状態(案内をまだ見ていない)から始める入れ物。基本レシピの投入を待ってから詳細を開く
    const geOpen = async (ctx, path = '/#/recipes/1') => {
      const p = await ctx.newPage()
      p.on('pageerror', (err) => errors.push(`[pageerror@GE-01] ${err.message}`))
      await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(2500)
      return p
    }
    const geVisible = (p) => p.locator('[data-testid="first-setup-notice"]').isVisible()
    // 閉じたあと、別のレシピを開いても出ないこと(「この画面だけ出ない」で終わらせない)
    const geGoneAfterReopen = async (p) => {
      await p.goto(`${BASE}/#/recipes/2`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(1500)
      return (await p.locator('[data-testid="first-setup-notice"]').count()) === 0
    }

    try {
      // (a) 初回に出る・中身がそろっている
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p1 = await geOpen(ctx)
        check('GE-01(a) レシピ詳細を初めて開くと案内が出る', await geVisible(p1))
        const info = await p1.evaluate(() => {
          const box = document.querySelector('[data-testid="first-setup-notice"]')
          if (!box) return null
          const link = box.querySelector('[data-testid="first-setup-notice-settings"]')
          const ps = [...box.querySelectorAll('p')]
          return {
            role: box.getAttribute('role'),
            title: box.querySelector('h2')?.textContent?.trim() ?? '',
            body: ps[0]?.textContent?.trim() ?? '',
            note: ps[ps.length - 1]?.textContent?.trim() ?? '',
            linkHref: link?.getAttribute('href') ?? '',
            linkLabel: link?.textContent?.trim() ?? '',
            dismissLabel:
              box.querySelector('[data-testid="first-setup-notice-dismiss"]')?.textContent?.trim() ??
              '',
            hasClose: !!box.querySelector('[data-testid="first-setup-notice-close"]'),
          }
        })
        check('GE-01(a) 重ね窓として名乗っている(role=dialog)', info?.role === 'dialog', String(info?.role))
        check(
          'GE-01(a) 見出しが人数と台所の器具を設定できる話になっている',
          info?.title === ja.firstSetupNotice.title,
          String(info?.title),
        )
        check(
          'GE-01(a) 本文が2つの設定の効く先(材料の分量・段取り)を言っている',
          info?.body === ja.firstSetupNotice.body,
          String(info?.body),
        )
        check(
          'GE-01(a) ボタンは「個人設定を開く」と「このまま使う」の2つ＋✕がある',
          info?.linkLabel === '個人設定を開く' &&
            info?.dismissLabel === 'このまま使う' &&
            info?.hasClose === true,
          JSON.stringify({ link: info?.linkLabel, dismiss: info?.dismissLabel, close: info?.hasClose }),
        )
        check(
          'GE-01(a) 閉じてもあとから変えられる場所を、設定の欄の名前のまま書いてある',
          info?.note === ja.firstSetupNotice.laterNote,
          String(info?.note),
        )
        // 文字数の上限(便GEで決定。オーナー「情報詰めすぎると読まずに消される」)
        const geLen = (s) => [...s].length
        const geTotal =
          geLen(info?.title ?? '') +
          geLen(info?.body ?? '') +
          geLen(info?.linkLabel ?? '') +
          geLen(info?.dismissLabel ?? '') +
          geLen(info?.note ?? '')
        check(
          'GE-01(a) 画面に出ている文字が上限内(見出し20/本文45/ボタン各12/一言40/合計120)',
          geLen(info?.title ?? '') <= 20 &&
            geLen(info?.body ?? '') <= 45 &&
            geLen(info?.linkLabel ?? '') <= 12 &&
            geLen(info?.dismissLabel ?? '') <= 12 &&
            geLen(info?.note ?? '') <= 40 &&
            geTotal <= 120,
          `合計${geTotal}字`,
        )
        check(
          'GE-01(a) 設定へのリンクが「食数の設定」の欄を指し、レシピへの帰り道も持っている',
          (info?.linkHref ?? '').includes('section=household') &&
            (info?.linkHref ?? '').includes('back=%2Frecipes%2F1'),
          String(info?.linkHref),
        )

        // (g) 390pxで画面から出ない
        const geFits = await p1.evaluate(() => {
          const r = document
            .querySelector('[data-testid="first-setup-notice"]')
            .getBoundingClientRect()
          return {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            right: Math.round(r.right),
            h: window.innerHeight,
            w: window.innerWidth,
          }
        })
        check(
          'GE-01(g) 390px幅で案内が画面に収まっている',
          geFits.top >= 0 && geFits.bottom <= geFits.h && geFits.right <= geFits.w,
          JSON.stringify(geFits),
        )

        // (b-1) 「このまま使う」で閉じたら、別のレシピを開いても出ない
        await p1.locator('[data-testid="first-setup-notice-dismiss"]').click()
        await p1.waitForTimeout(400)
        check('GE-01(b) 「このまま使う」で閉じられる', (await geVisible(p1)) === false)
        check('GE-01(b) 閉じたあとは別のレシピを開いても出ない', await geGoneAfterReopen(p1))
        const geSeen = await p1.evaluate((key) => ({
          local: localStorage.getItem(key),
          session: sessionStorage.getItem(key),
        }), FIRST_SETUP_NOTICE_SEEN_KEY)
        check(
          'GE-01(b) 見た記録はlocalStorageに残る(端末内のみ)',
          geSeen.local === '1' && geSeen.session === null,
          JSON.stringify(geSeen),
        )
        await ctx.close()
      }

      // (b-2) ✕・カード外のタップ・Escapeでも「見た」扱いになる
      for (const [how, close] of [
        ['✕', async (p) => p.locator('[data-testid="first-setup-notice-close"]').click()],
        ['カード外のタップ', async (p) => p.mouse.click(195, 40)],
        ['Escape', async (p) => p.keyboard.press('Escape')],
      ]) {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p2 = await geOpen(ctx)
        check(`GE-01(b) ${how}: まっさらな端末では案内が出る`, await geVisible(p2))
        await close(p2)
        await p2.waitForTimeout(500)
        check(`GE-01(b) ${how}で閉じられる`, (await geVisible(p2)) === false)
        check(`GE-01(b) ${how}で閉じたあとも出ない`, await geGoneAfterReopen(p2))
        await ctx.close()
      }

      // (c) すでに設定を自分で決めている人には出ない(この案内は2つの設定を知らない人にだけ意味がある)
      for (const [label, setUp] of [
        [
          '食数の設定',
          async (p) => {
            await p.goto(`${BASE}/#/settings?section=household`, { waitUntil: 'networkidle' })
            await p.waitForTimeout(1200)
            await p.getByLabel(ja.settings.householdServingsTitle).selectOption('4')
          },
        ],
        [
          'コンロの口数',
          async (p) => {
            await p.goto(`${BASE}/#/settings?section=kitchen`, { waitUntil: 'networkidle' })
            await p.waitForTimeout(1200)
            await p.locator('[data-testid="kitchen-burners"]').selectOption('1')
          },
        ],
        [
          '持っている器具',
          async (p) => {
            await p.goto(`${BASE}/#/settings?section=kitchen`, { waitUntil: 'networkidle' })
            await p.waitForTimeout(1200)
            await p.locator('[data-testid="kitchen-kitchenNoToaster"]').click()
          },
        ],
      ]) {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p3 = await ctx.newPage()
        p3.on('pageerror', (err) => errors.push(`[pageerror@GE-01] ${err.message}`))
        await p3.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
        await p3.waitForTimeout(2000)
        await setUp(p3)
        await p3.waitForTimeout(700)
        await p3.goto(`${BASE}/#/recipes/1`, { waitUntil: 'networkidle' })
        await p3.waitForTimeout(2000)
        check(
          `GE-01(c) 「${label}」を自分で決めている人には出ない`,
          (await p3.locator('[data-testid="first-setup-notice"]').count()) === 0,
        )
        await ctx.close()
      }

      // (d) パソコン(マウス・1280px)にも出る。ホーム画面追加の案内と違い、人数も口数も
      // どの端末で開いても同じように効くので、端末の種類で出し分ける理由がない
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, {
          viewport: { width: 1280, height: 800 },
        })
        const p4 = await geOpen(ctx)
        check('GE-01(d) パソコン幅(マウス操作)でも案内が出る', await geVisible(p4))
        await ctx.close()
      }

      // (e) 「個人設定を開く」の着地点。案内した2つの欄が続けて見えること＝
      // 1回のタップで両方が視界に入る(上の固定帯に見出しが隠れていないことも見る)
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p5 = await geOpen(ctx)
        await p5.locator('[data-testid="first-setup-notice-settings"]').click()
        await p5.waitForTimeout(2000)
        check(
          'GE-01(e) 押すと設定の「食数の設定」へ移る',
          p5.url().includes('/settings') && p5.url().includes('section=household'),
          p5.url(),
        )
        const geLanding = await p5.evaluate(() => {
          const bar = document.querySelector('[data-app-top-bar]')?.getBoundingClientRect()
          const pick = (id) => {
            const h = document.querySelector(`#${id} h2`)
            if (!h) return null
            const r = h.getBoundingClientRect()
            return { text: h.textContent?.trim() ?? '', top: Math.round(r.top), bottom: Math.round(r.bottom) }
          }
          return {
            barBottom: Math.round(bar?.bottom ?? 0),
            household: pick('household-section'),
            kitchen: pick('kitchen-section'),
            h: window.innerHeight,
          }
        })
        check(
          'GE-01(e) 「食数の設定」の見出しが上の固定帯に隠れていない',
          geLanding.household?.text === '食数の設定' &&
            geLanding.household.top >= geLanding.barBottom,
          JSON.stringify(geLanding),
        )
        check(
          'GE-01(e) その下に「台所の器具」が続けて見える(1回のタップで両方が視界に入る)',
          geLanding.kitchen?.text === '台所の器具' &&
            geLanding.kitchen.top > geLanding.household.top &&
            geLanding.kitchen.bottom <= geLanding.h,
          JSON.stringify(geLanding),
        )
        // 読んでいたレシピへ帰れる(?back=)
        await p5.locator('[data-testid="settings-back"]').click()
        await p5.waitForTimeout(1200)
        check(
          'GE-01(e) 設定から読んでいたレシピへ帰れる',
          p5.url().includes('/recipes/1'),
          p5.url(),
        )
        check(
          'GE-01(e) 設定を見に行った人には、帰ってきても案内を出さない',
          (await p5.locator('[data-testid="first-setup-notice"]').count()) === 0,
        )
        await ctx.close()
      }

      // (f) ライト/ダークの両方で読める
      for (const scheme of ['light', 'dark']) {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, {
          ...gePhone,
          colorScheme: scheme,
        })
        const p6 = await geOpen(ctx)
        check(`GE-01(f) ${scheme}: 案内が出る`, await geVisible(p6))
        const geColors = await p6.evaluate(() => {
          const box = document.querySelector('[data-testid="first-setup-notice"]')
          const pick = (el) => {
            if (!el) return null
            const s = getComputedStyle(el)
            return { color: s.color, bg: s.backgroundColor }
          }
          const ps = [...box.querySelectorAll('p')]
          return {
            card: getComputedStyle(box).backgroundColor,
            title: pick(box.querySelector('h2')),
            body: pick(ps[0]),
            note: pick(ps[ps.length - 1]),
            link: pick(box.querySelector('[data-testid="first-setup-notice-settings"]')),
            dismiss: pick(box.querySelector('[data-testid="first-setup-notice-dismiss"]')),
          }
        })
        for (const [name, part, bg] of [
          ['見出し', geColors.title, geColors.card],
          ['本文', geColors.body, geColors.card],
          ['あとから変える場所の一言', geColors.note, geColors.card],
          ['「個人設定を開く」', geColors.link, geColors.link?.bg],
          ['「このまま使う」', geColors.dismiss, geColors.dismiss?.bg],
        ]) {
          const ratio = geContrast(part.color, bg)
          check(
            `GE-01(f) ${scheme}: ${name}のコントラストが4.5:1以上`,
            ratio >= 4.5,
            `比=${ratio.toFixed(2)} 文字=${part.color} 地=${bg}`,
          )
        }
        await ctx.close()
      }

      // (h) 用事があって開いた画面には割り込まない・レシピ詳細以外には出さない
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p7 = await geOpen(ctx, '/#/recipes/1?step=2')
        check(
          'GE-01(h) タイマーから手順を開いたとき(?step=)には出ない',
          (await p7.locator('[data-testid="first-setup-notice"]').count()) === 0,
        )
        await ctx.close()
      }
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p8 = await geOpen(ctx, '/#/recipes/1?editLog=0')
        check(
          'GE-01(h) 記録の編集を開いたとき(?editLog=)には出ない',
          (await p8.locator('[data-testid="first-setup-notice"]').count()) === 0,
        )
        await ctx.close()
      }
      {
        const ctx = await newContextWithFirstSetupNotice(geBrowser, gePhone)
        const p9 = await ctx.newPage()
        p9.on('pageerror', (err) => errors.push(`[pageerror@GE-01] ${err.message}`))
        for (const [label, path] of [
          ['献立', '/#/meal-plan'],
          ['レシピ一覧', '/#/recipes'],
          ['献立', '/#/meal-plan'],
          ['設定', '/#/settings'],
        ]) {
          await p9.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
          await p9.waitForTimeout(1500)
          check(
            `GE-01(h) ${label}には出ない(出す場所はレシピ詳細だけ)`,
            (await p9.locator('[data-testid="first-setup-notice"]').count()) === 0,
          )
        }
        // 最後にレシピ詳細を開けば出る＝上の4画面で「見た」扱いにしていないことの裏取り
        await p9.goto(`${BASE}/#/recipes/1`, { waitUntil: 'networkidle' })
        await p9.waitForTimeout(2000)
        check(
          'GE-01(h) 他の画面を見て回ったあとでも、レシピ詳細を開けば出る',
          await p9.locator('[data-testid="first-setup-notice"]').isVisible(),
        )
        await ctx.close()
      }
    } finally {
      await geBrowser.close()
    }
  }

  // ================================================================================
  // --- 便EX(2026-08-10 オーナー指示): 紹介ページのコピー改訂・悩みの吹き出しの作り直し・
  //     ページ上の割り込み2択の撤去 ---
  // ================================================================================

  // --- NOASK-EX: 「無料で使ってみる」は何も尋ねずにうちレシピを開く。
  // 押した先で「追加方法を見る／このまま開く」を尋ねていた小窓(2026-08-09 便EP)は撤去した。
  // 撤去し忘れ・部分的な取り残し(CSSだけ残る/スクリプトだけ残る)を機械で見張る ---
  currentCheck = 'NOASK-EX'
  {
    const noAskBrowser = await chromium.launch()
    try {
      const noAskCtx = await noAskBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const noAskPage = await noAskCtx.newPage()
      noAskPage.on('pageerror', (err) => errors.push(`[pageerror@NOASK-EX] ${err.message}`))
      await noAskPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
      const lpEx = await (await noAskPage.request.get(`${BASE}/about/`)).text()
      check(
        'NOASK-EX 割り込みの小窓がHTMLに残っていない',
        !lpEx.includes('install-ask') &&
          !lpEx.includes('data-ask') &&
          !lpEx.includes('installAsk') &&
          !lpEx.includes('ask__card'),
      )
      check(
        'NOASK-EX 2択の文言が残っていない',
        !lpEx.includes('追加方法を見る') && !lpEx.includes('このまま開く'),
      )
      check(
        'NOASK-EX ボタンはうちレシピを指すただのリンク',
        (await noAskPage.locator('a.cta').first().getAttribute('href')) === '/' &&
          (await noAskPage.locator('a.cta').first().getAttribute('data-ask')) === null,
      )
      await noAskPage.getByRole('link', { name: '無料で使ってみる' }).click()
      await noAskPage.waitForLoadState('networkidle')
      check(
        'NOASK-EX 押すと何も尋ねずにうちレシピが開く',
        new URL(noAskPage.url()).pathname === '/',
        noAskPage.url(),
      )
      // 撤去しても「ホーム画面への追加方法」への導線自体は紹介ページに残す(SMK-19cと対)
      check(
        'NOASK-EX ホーム画面への追加方法へのリンクは残っている',
        lpEx.includes('/about/install.html'),
      )
    } finally {
      await noAskBrowser.close()
    }
  }

  // --- LPTEXT-EX: 紹介ページのコピー(2026-08-10 オーナー指示) ---
  currentCheck = 'LPTEXT-EX'
  {
    await page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
    const h1Ex = ((await page.locator('h1').textContent()) ?? '').replace(/\s+/g, '')
    check(
      // 2026-08-10 便FA(オーナー指示): 文末にも句点を足した
      'LPTEXT-EX 見出しが「レシピを集めて登録。もう献立に迷わない。」',
      h1Ex === 'レシピを集めて登録。もう献立に迷わない。',
      h1Ex,
    )
    const leadEx = ((await page.locator('.lead').textContent()) ?? '').replace(/\s+/g, '')
    check(
      'LPTEXT-EX リード文の1文目に「スマホを触らずに調理できる形」が入っている',
      leadEx.includes('スマホを触らずに調理できる形に整えます'),
      leadEx,
    )
    check(
      'LPTEXT-EX リード文で「レシピ」を繰り返していない',
      (leadEx.match(/レシピ/g) ?? []).length === 1,
      `回数=${(leadEx.match(/レシピ/g) ?? []).length}`,
    )
    const painsH2 = ((await page.locator('.pains').locator('xpath=../h2').textContent()) ?? '').trim()
    check('LPTEXT-EX 見出しが「こんなこと、ありませんか」', painsH2 === 'こんなこと、ありませんか', painsH2)
    check(
      'LPTEXT-EX 「まず、集めて登録する」が「好きなレシピを登録する」になっている',
      ((await page.locator('.eyebrow').first().textContent()) ?? '').trim() === '好きなレシピを登録する',
      (await page.locator('.eyebrow').first().textContent()) ?? '(なし)',
    )
  }

  // --- BUBBLE-EX: 悩みの吹き出し(2026-08-10 オーナー指示)。
  // ①4つある ②文の区切りは句読点ではなく改行 ③しっぽは三角ではなく丸い粒2つ
  // ④角が大きく丸い ⑤等間隔・同じ大きさに並べていない(大きさ・傾き・左右の位置が散っている)
  // ⑥390pxで横にはみ出さない ⑦文字が地に対して読める濃さ(ライト/ダークとも) ---
  currentCheck = 'BUBBLE-EX'
  {
    const bubBrowser = await chromium.launch()
    try {
      for (const scheme of ['light', 'dark']) {
        const bubCtx = await bubBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: scheme,
        })
        const bubPage = await bubCtx.newPage()
        bubPage.on('pageerror', (err) => errors.push(`[pageerror@BUBBLE-EX] ${err.message}`))
        await bubPage.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
        const bub = await bubPage.evaluate(() => {
          const srgb = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
          const lum = (c) => {
            const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map((n) => srgb(Number(n) / 255))
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
          }
          const ratio = (a, b) => {
            const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
            return (x + 0.05) / (y + 0.05)
          }
          const items = Array.from(document.querySelectorAll('.pains li'))
          const sec = document.querySelector('.pains').closest('.sec')
          const secBox = sec.getBoundingClientRect()
          return {
            count: items.length,
            docW: document.documentElement.scrollWidth,
            winW: window.innerWidth,
            secLeft: secBox.left,
            secRight: secBox.right,
            items: items.map((li) => {
              const b = li.querySelector('b')
              const cs = getComputedStyle(li)
              const before = getComputedStyle(li, '::before')
              const after = getComputedStyle(li, '::after')
              const r = li.getBoundingClientRect()
              return {
                html: b.innerHTML,
                text: b.textContent,
                left: Math.round(r.left),
                right: Math.round(r.right),
                width: Math.round(r.width),
                font: parseFloat(getComputedStyle(b).fontSize),
                transform: cs.transform,
                radius: parseFloat(cs.borderTopLeftRadius),
                // しっぽ: 三角(border-width で描く)ではなく丸い粒(border-radius:50% + 地色)
                tailRound:
                  before.borderRadius.includes('50%') &&
                  after.borderRadius.includes('50%') &&
                  parseFloat(before.width) > 8 &&
                  parseFloat(after.width) > 4 &&
                  parseFloat(after.width) < parseFloat(before.width),
                tailNotTriangle:
                  before.width !== '0px' && before.height !== '0px' && after.width !== '0px',
                contrast: ratio(getComputedStyle(b).color, cs.backgroundColor),
              }
            }),
          }
        })
        check(`BUBBLE-EX(${scheme}) 吹き出しが4つある`, bub.count === 4, `個数=${bub.count}`)
        check(
          `BUBBLE-EX(${scheme}) 句読点を使わず改行で区切っている`,
          bub.items.every((i) => !/[、。]/.test(i.text)) &&
            bub.items.filter((i) => i.html.includes('<br>')).length >= 3,
          bub.items.map((i) => i.text).join(' | '),
        )
        check(
          `BUBBLE-EX(${scheme}) しっぽが三角ではなく丸い粒2つ`,
          bub.items.every((i) => i.tailRound && i.tailNotTriangle),
        )
        check(
          `BUBBLE-EX(${scheme}) 角が大きく丸い(半径24px以上)`,
          bub.items.every((i) => i.radius >= 24),
          bub.items.map((i) => i.radius).join(','),
        )
        check(
          `BUBBLE-EX(${scheme}) 同じ大きさで機械的に並べていない(文字の大きさと幅が散っている)`,
          new Set(bub.items.map((i) => i.font)).size >= 3 &&
            new Set(bub.items.map((i) => i.width)).size >= 3,
          `文字=${bub.items.map((i) => i.font).join(',')} 幅=${bub.items.map((i) => i.width).join(',')}`,
        )
        check(
          `BUBBLE-EX(${scheme}) 1つずつ傾きが違う(整列していない)`,
          bub.items.every((i) => i.transform !== 'none') &&
            new Set(bub.items.map((i) => i.transform)).size === 4,
        )
        check(
          `BUBBLE-EX(${scheme}) 左右の位置が散っている(左端がそろっていない)`,
          new Set(bub.items.map((i) => i.left)).size >= 3,
          bub.items.map((i) => i.left).join(','),
        )
        check(
          `BUBBLE-EX(${scheme}) 390pxで横にはみ出さない`,
          bub.docW <= bub.winW &&
            bub.items.every((i) => i.left >= bub.secLeft - 1 && i.right <= bub.secRight + 1),
          `scrollW=${bub.docW} 枠=${Math.round(bub.secLeft)}〜${Math.round(bub.secRight)} 各=${bub.items
            .map((i) => `${i.left}-${i.right}`)
            .join(' ')}`,
        )
        check(
          `BUBBLE-EX(${scheme}) 吹き出しの中の文字が地に対してAA(4.5:1)以上`,
          bub.items.every((i) => i.contrast >= 4.5),
          bub.items.map((i) => i.contrast.toFixed(2)).join(','),
        )
        await bubCtx.close()
      }
    } finally {
      await bubBrowser.close()
    }
  }

  // --- EY-01: 「1パック丸ごと計上」の是正が画面の金額に出ていること(2026-08-10 便EY) ---
  // マスタの単位が「1パック」「1袋」だと、レシピが「2枚」「8本」と書いていても按分できず
  // パック1つ分の金額が1行に乗っていた。単位を1パックの実内容量(出典はdocs/49の2026-08-10節)へ
  // 直したので、該当食材を使うレシピの1食あたりが下がる。数字そのものをここで固定する
  // (下がりすぎ・戻りの両方に気づけるようにするため、「約◯円」の文字列で見る)
  currentCheck = 'EY-01'
  {
    const eyBrowser = await chromium.launch()
    try {
      const eyCtx = await eyBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const eyPage = await eyCtx.newPage()
      eyPage.on('pageerror', (err) => errors.push(`[pageerror@EY-01] ${err.message}`))
      await eyPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await eyPage.waitForTimeout(2000) // 初回シード(レシピ109品＋価格マスタ)の完了待ち

      // 生しいたけ2枚を使うレシピ。修正前は1パック満額100円が乗り1食あたり212円だった
      const eyOpen = async (title) => {
        await eyPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await eyPage.waitForTimeout(600)
        await eyPage.getByPlaceholder(ja.search.placeholder).fill(title)
        await eyPage.waitForTimeout(700)
        await eyPage.getByText(title, { exact: true }).first().click()
        await eyPage.waitForTimeout(800)
        return (await eyPage.textContent('body')) ?? ''
      }
      const eyChawanmushi = await eyOpen('冷やし茶碗蒸し')
      // 2026-08-22 便JG・便JIで既定価格と名寄せが変わり、179円→**178円**になった
      // （1円ぶんは片栗粉 10→5円/大さじ1 の実勢反映。按分が効いていること自体は変わらない）。
      // 「按分前の212円のままではない」を測るのがこの判定の役目なので、そこは残す
      check(
        // 2026-08-24 司令部: 便KEで「単位が噛み合わないときの満額フォールバック」をやめたので
        // 178→128円。按分が効いていること（按分前の212円ではない）を測る役目はそのまま
        // 2026-08-26 便LF: 生しいたけ100→245円/6枚・干ししいたけ400→700円/30g（並のグレードで
        // 測り直した実勢。根拠は src/data/priceDefaults.ts の各行）。**この節が見張っているのは
        // 按分が効いていること**で、金額そのものではない
        'EY-01 冷やし茶碗蒸しの1食あたりが生しいたけの按分後の金額になる(便LFの前は128円→164円)',
        eyChawanmushi.includes(ja.detail.pricePerServing.replace('{n}', '164')),
        eyChawanmushi.includes('約212円') ? '按分前の212円のまま' : '',
      )
      // 原価ビューで材料行そのものの金額も見る(1食あたり=全量33円÷2人分)
      await eyPage.getByRole('button', { name: ja.detail.priceViewShow }).click()
      await eyPage.waitForTimeout(500)
      const eyRow = await eyPage.locator('li', { hasText: '生しいたけ' }).first().textContent()
      // 2026-08-22 便JG: 行の金額の意味が「1食あたり(全量÷登録人数)」から
      // **「いま画面に出ている分量ぶん」**へ変わった（オーナー「原価が、人数分の表示に合わせて
      // 計算されていない。人数の増減で数値が変わらない」＝同じ行の中で分量と金額が別の人数を
      // 指していた）。2人分表示なので 17円×2人分＝約33円が正しい
      check(
        // 2026-08-26 便LF: 生しいたけを100→245円/6枚にしたので33→82円。
        // **1パック(6枚)まるごとの245円が乗っていないこと**が、この判定の役目。
        // 金額のほかに「1パック満額でないこと」も見て、次に価格が動いても役目が残る形にした
        'EY-01 材料行「生しいたけ」の原価が、出ている分量ぶん(2人分＝2枚)の約82円',
        (eyRow ?? '').includes('約82円') && !(eyRow ?? '').includes('約245円'),
        String(eyRow),
      )

      // オクラ8本(1袋10本前後のうち8本)
      const eyOkra = await eyOpen('オクラと長芋の梅肉あえ')
      check(
        // 2026-08-24 司令部: 便KEで 152→144円
        'EY-01 オクラと長芋の梅肉あえの1食あたり(按分前165円→144円)',
        eyOkra.includes(ja.detail.pricePerServing.replace('{n}', '144')),
        eyOkra.includes('約165円') ? '修正前の165円のまま' : '',
      )
      // いちご6個(1パック280gのうち90g)
      const eyBark = await eyOpen('フルーツヨーグルトバーク')
      check(
        // 2026-08-24 司令部: 便KEで 327→127円（いちご「6個」が販売単位のマスタに噛み合わず、
        // 1パックまるごとの金額が乗っていた分が抜けた）
        // 2026-08-26 便LF: プレーンヨーグルト50→60円/100gほかの調べ直しで127→137円
        // 2026-08-27 便LL: キウイ100→170円/1個の調べ直しで 137→148円
        //
        // **この節が本当に見張っているのは金額そのものではない**（便KEの直し＝
        // 「いちご6個」が販売単位のマスタに噛み合わず**1パックまるごとの金額が乗っていた**のを、
        // 出ている分量ぶんに按分する形にしたこと）。金額をベタ書きしていると
        // **材料の目安価格を1つ動かすたびにここが落ちる**（2026-08-26〜27 で3回落ちた）。
        // 数字は残しつつ、**按分が効いていること自体**も別に見る形にした
        'EY-01 フルーツヨーグルトバークの1食あたり(按分前395円→便KEで127円→148円)',
        eyBark.includes(ja.detail.pricePerServing.replace('{n}', '148')),
        eyBark.includes('約395円') ? '修正前の395円のまま' : '',
      )
      {
        // いちご1パック(400円/280g)のうち90gしか使わないので、
        // **1食あたりにパック満額の400円が乗っていたら按分が壊れている**。
        // 2人分の按分ぶんは 400×90/280÷2 ≒ 64円なので、
        // 1食あたりがパック満額を超えることは、按分が効いていればあり得ない
        const eyStrawberry = PRICE_DEFAULTS.find((d) => d.name === 'いちご')
        const eyShown = Number(
          (eyBark.match(/1食あたり\s*約([\d,]+)円/) ?? [])[1]?.replace(/,/g, '') ?? NaN,
        )
        check(
          'EY-01 1食あたりに、いちご1パック満額(400円)が乗っていない（按分が効いている）',
          Number.isFinite(eyShown) && eyStrawberry != null && eyShown < eyStrawberry.pricePerUnit,
          `1食あたり=${eyShown}円 / いちご1パック=${eyStrawberry?.pricePerUnit}円`,
        )
      }
      // 「食材と価格」の単位表記も新しい内容量になっていること
      await eyPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await eyPage.waitForTimeout(900)
      // 単位は「数量欄＋単位の選択」に分かれて表示される(PRICEUNIT-01と同じ読み方をする。
      // 行のテキストを見ると選択肢の一覧まで拾ってしまうため、入力値で確かめる)
      const eyIchigoRow = eyPage.locator('li', { hasText: 'いちご' }).first()
      const eyIchigoQty = await eyIchigoRow.getByLabel('いちごの数量').inputValue()
      const eyIchigoUnit = await eyIchigoRow.getByLabel('いちごの単位').inputValue()
      check(
        'EY-01 「食材と価格」のいちごの単位が280g(1パックの標準内容量)になっている',
        eyIchigoQty === '280' && eyIchigoUnit === 'g',
        `数量=${eyIchigoQty} 単位=${eyIchigoUnit}`,
      )
      const eyIchigoPrice = await eyIchigoRow.getByLabel('いちごの価格（円）').inputValue()
      check(
        'EY-01 いちごの価格は400円のまま(単位の書き方だけを直したので金額は動かない)',
        eyIchigoPrice === '400',
        String(eyIchigoPrice),
      )
    } finally {
      await eyBrowser.close()
    }
  }

  // --- EY-02: 単位を直す移行が「自分で編集した価格」を上書きしないこと(2026-08-10 便EY) ---
  // 既存端末のマスタ行は古い単位のまま残るため、PRICE_DEFAULTS_VERSIONを上げたときに
  // 単位だけを揃える移行を入れた。対象は「目安のまま(isDefault=true)で価格も単位も旧既定と
  // 同じ行」だけ。ここでは旧バージョンの端末を作り直して、直る行と残る行の両方を確認する
  currentCheck = 'EY-02'
  {
    const ey2Browser = await chromium.launch()
    try {
      const ey2Ctx = await ey2Browser.newContext({ viewport: { width: 390, height: 844 } })
      const ey2Page = await ey2Ctx.newPage()
      ey2Page.on('pageerror', (err) => errors.push(`[pageerror@EY-02] ${err.message}`))
      await ey2Page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await ey2Page.waitForTimeout(2000)

      // 版5の端末を再現する: いちご=目安のまま旧単位「1パック」/ しいたけ=自分で999円に編集済み
      // (単位も旧「1パック」のまま)。settings.priceDefaultsVersionを5へ戻して移行を未実行にする
      await ey2Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['prices', 'settings'], 'readwrite')
          const prices = tx.objectStore('prices')
          const all = prices.getAll()
          all.onsuccess = () => {
            for (const row of all.result) {
              if (row.name === 'いちご') {
                prices.put({
                  ...row,
                  pricePerUnit: 400,
                  unit: '1パック',
                  isDefault: true,
                  defaultPricePerUnit: 400,
                  defaultUnit: '1パック',
                })
              }
            }
            // 2026-08-10 便FA: 「しいたけ」は「生しいたけ」へ名寄せしたので、新規インストールの
            // マスタにこの行は無い。版5の端末を再現するため、自分で999円に編集済みの行として作る
            // （名寄せの移行も単位の移行も、この行には触らないのが正しい姿）
            prices.put({
              name: 'しいたけ',
              pricePerUnit: 999,
              unit: '1パック',
              isDefault: false,
              defaultPricePerUnit: 150,
              defaultUnit: '1パック',
              updatedAt: Date.now(),
            })
            const settings = tx.objectStore('settings')
            const getReq = settings.get(1)
            getReq.onsuccess = () => {
              const current = getReq.result || { id: 1 }
              settings.put({ ...current, id: 1, priceDefaultsVersion: 5 })
            }
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })
      // 再読み込みで seedPriceDefaultsIfNeeded が走り、版5→6の移行が1回だけ実行される
      await ey2Page.reload({ waitUntil: 'networkidle' })
      await ey2Page.waitForTimeout(2000)
      const ey2Rows = await ey2Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const rows = await new Promise((resolve, reject) => {
          const tx = idb.transaction('prices', 'readonly')
          const all = tx.objectStore('prices').getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => reject(all.error)
        })
        idb.close()
        const pick = (name) => {
          const r = rows.find((x) => x.name === name)
          return r
            ? { unit: r.unit, price: r.pricePerUnit, isDefault: r.isDefault, defaultUnit: r.defaultUnit }
            : null
        }
        return { ichigo: pick('いちご'), shiitake: pick('しいたけ') }
      })
      check(
        'EY-02 目安のままの行(いちご)は単位だけが新しい内容量に揃う',
        ey2Rows.ichigo?.unit === '280g' && ey2Rows.ichigo?.isDefault === true,
        JSON.stringify(ey2Rows.ichigo),
      )
      check(
        'EY-02 単位を直しても価格の数字は動かさない(いちごは400円のまま)',
        ey2Rows.ichigo?.price === 400,
        JSON.stringify(ey2Rows.ichigo),
      )
      check(
        'EY-02 「デフォルトに戻す」の戻り先も新しい単位になる',
        ey2Rows.ichigo?.defaultUnit === '280g',
        JSON.stringify(ey2Rows.ichigo),
      )
      check(
        'EY-02 自分で編集した価格(しいたけ999円)は移行後もそのまま残る',
        ey2Rows.shiitake?.price === 999 && ey2Rows.shiitake?.isDefault === false,
        JSON.stringify(ey2Rows.shiitake),
      )
      check(
        'EY-02 自分で編集した行は単位も勝手に書き換えない(しいたけは1パックのまま)',
        ey2Rows.shiitake?.unit === '1パック',
        JSON.stringify(ey2Rows.shiitake),
      )
      // 画面でも「自分の価格」が残っていること(999円が入力欄に出る)。
      // 2026-08-10 便FA: 一覧には「生しいたけ」「干ししいたけ」も並ぶので、行ではなく
      // ラベル完全一致で「しいたけ」の行の入力欄を掴む（部分一致だと別の行を拾う）
      const ey2Value = await ey2Page
        .getByLabel('しいたけの価格（円）', { exact: true })
        .inputValue()
      check('EY-02 画面上も自分で入れた999円が残っている', ey2Value === '999', String(ey2Value))
    } finally {
      await ey2Browser.close()
    }
  }


  // --- EZ-01〜05: 2026-08-10 便EZ・オーナー実機フィードバック4件 ---
  //     EZ-01 声の「ストップ」で動作中のタイマーが一時停止する（真因: 'stop' が読み上げの停止に
  //           しか繋がっておらず、タイマーには一切触れていなかった）。止めても消えず「再開」で戻せる
  //     EZ-02 タイマーが指す手順の呼び方が「手順⑦3-1」になり、「段取りの◯番目」が消えている
  //     EZ-03 調理中モードの最終手順のボタンが、1品のときと同じ「完成！」になっている
  //     EZ-04 「完成！」のあと、並行調理ナビの「まとめて作った！」が画面内に入る（帯の裏に隠れない）
  //     EZ-05 献立の週カード・月タブの日モーダルの枠から、レシピ詳細へ行ける
  currentCheck = 'EZ-01'
  {
    const ezBrowser = await chromium.launch()
    const ezContext = await ezBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const ezPage = await ezContext.newPage()
    // 2026-08-11 便FO: 「完成！」がその場で作った記録の確認を出すようになったため、
    // 確認に「はい」と答えるか「やめる」と答えるかを場面ごとに切り替えられるようにする
    let ezDialogAnswer = 'accept'
    ezPage.on('dialog', (d) => void (ezDialogAnswer === 'accept' ? d.accept() : d.dismiss()))
    ezPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@EZ] ${err.message}`)
    })
    ezPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@EZ] ${t}`)
    })
    try {
      await ezPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ezPage.waitForTimeout(1800)
      const ezSeed = await ezPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('EZ照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('EZ煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('EZマリネ', [
          { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
          { text: 'パプリカときゅうりを細切りにする。' },
          { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
        ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        // 週タブの検査用に、今日の夕食へ2品入れておく（日付は端末の暦で作る＝週の表示範囲と揃える）
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        await P(store('mealPlans').add({ date: today, slot: 'dinner', role: 'main', recipeId: idA }))
        await P(store('mealPlans').add({ date: today, slot: 'dinner', role: 'side', recipeId: idC }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
        return { idA, idB, idC, today }
      })

      // 段取り→調理中モード→「15分煮る」の手順でタイマーを起動する
      await ezPage.goto(`${BASE}/#/cook-navi`)
      await ezPage.reload({ waitUntil: 'networkidle' })
      await ezPage.waitForTimeout(1200)
      await ezPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await ezPage.waitForTimeout(700)
      await ezPage.locator('[data-testid="cook-session-start"]').click()
      await ezPage.waitForTimeout(600)
      for (let i = 0; i < 10; i++) {
        if (/煮る/.test(await ezPage.locator('[data-testid="cook-session"]').innerText())) break
        await ezPage.locator('[data-testid="cook-session-next"]').click()
        await ezPage.waitForTimeout(200)
      }
      await ezPage.locator('[data-testid="cook-session"] button[aria-label*="タイマー"]').first().click()
      await ezPage.waitForTimeout(600)
      const ezChip = ezPage.locator('[data-testid="cook-session-current-timers"]')
      check(
        'EZ-01 調理中モードでタイマーが動き出す',
        /\d\d:\d\d/.test(await ezChip.innerText()),
        await ezChip.innerText(),
      )
      // 声の「ストップ」は、聞き取り(matchVoiceCommand)ではなく画面側の処理が抜けていたのが真因。
      // マイクは自動テストで鳴らせないので、同じ道筋（一時停止→再開）をボタンで確かめる
      await ezPage.locator('[data-testid="cook-session-current-timers"] button').first().click()
      await ezPage.waitForTimeout(400)
      const ezDialog = ezPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
      const ezBeforePause = parseRemainingSeconds(await ezDialog.textContent())
      await ezPage.locator('[data-testid="timer-adjust-pause"]').click()
      await ezPage.waitForTimeout(1500)
      const ezPausedText = await ezDialog.textContent()
      const ezAfterPause = parseRemainingSeconds(ezPausedText)
      check(
        'EZ-01 いったん止めると残り時間が減らなくなる（時計が止まる）',
        ezBeforePause !== null && ezAfterPause !== null && ezBeforePause - ezAfterPause <= 1,
        `止める前=${ezBeforePause}s 1.5秒後=${ezAfterPause}s`,
      )
      check(
        'EZ-01 止めていることが窓の中で分かる',
        ezPausedText.includes('止めています'),
        ezPausedText.slice(0, 120),
      )
      check(
        'EZ-01 止めても消えない（「再開」で戻せる＝取り消せる操作）',
        (await ezPage.locator('[data-testid="timer-adjust-pause"]').innerText()).includes('再開'),
      )
      await ezPage.locator('[data-testid="timer-adjust-pause"]').click()
      await ezPage.waitForTimeout(1500)
      const ezResumed = parseRemainingSeconds(await ezDialog.textContent())
      check(
        'EZ-01 「再開」で止めた残りから動き出す',
        ezResumed !== null && ezAfterPause - ezResumed >= 1,
        `止めていた残り=${ezAfterPause}s 再開1.5秒後=${ezResumed}s`,
      )

      // EZ-02: タイマーが指す手順の呼び方（「手順⑦3-1」）。「段取りの◯番目」は消えていること
      currentCheck = 'EZ-02'
      const ezDialogText = await ezDialog.textContent()
      check(
        'EZ-02 タイマーの窓が「手順②2」のように段取りの丸数字＋レシピ内の手順番号で呼ぶ',
        /手順[①-⑳㉑-㉟㊱-㊿]/.test(ezDialogText),
        ezDialogText.slice(0, 160),
      )
      check(
        'EZ-02 「段取りの◯番目」という言い方が消えている（窓）',
        !/段取りの\d+番目/.test(ezDialogText),
        ezDialogText.slice(0, 160),
      )
      await ezPage.keyboard.press('Escape')
      await ezPage.waitForTimeout(300)
      // 常駐バー側（調理中モードを閉じると出る）
      await ezPage.locator('[data-testid="cook-session-close"]').click()
      await ezPage.waitForTimeout(800)
      const ezBarRow = ezPage.locator('button[aria-label*="タイマーを調整"]').first()
      const ezBarAria = await ezBarRow.getAttribute('aria-label')
      // 2026-08-14 便GL: **読み上げ名だけ**は2つの番号をそれぞれの名前で呼ぶ形に変えた
      // （利用者テスト「タイマーの読み上げ名『手順⑨（1-2）』が、同じ『手順』で2つの番号を
      // 指していて紛らわしい」）。画面の文字は便EZ のまま（下の窓の検査がそれを見ている）
      check(
        'EZ-02 常駐バーの読み上げ名は、段取りの番号とレシピの手順番号を別の名前で呼ぶ',
        /段取り\d+/.test(ezBarAria) &&
          ezBarAria.includes('手順') &&
          !/段取りの\d+番目/.test(ezBarAria),
        String(ezBarAria),
      )
      await ezBarRow.click()
      await ezPage.waitForTimeout(400)
      const ezBarDialogText = await ezPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle }).textContent()
      check(
        'EZ-02 「段取りの◯番目を開く」が「手順⑦（3-1）を〜」の形になっている',
        // 2026-08-15 便GQ: 調理の途中は「見る」（現在地を動かさない）に言い分けたので、
        // ここで見るのは**番号の呼び方**だけにする（動きの語まで固定しない）
        /手順[①-⑳㉑-㉟㊱-㊿][^を]*を(開く|見る)/.test(ezBarDialogText) &&
          !/段取りの\d+番目/.test(ezBarDialogText),
        ezBarDialogText.slice(0, 200),
      )
      // 片付け（後続の検査にタイマーを持ち越さない）
      await ezPage
        .getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        .getByRole('button', { name: ja.timer.stopTimer })
        .click()
      await ezPage.waitForTimeout(400)

      // EZ-03: 最終手順のボタンが1品のときと同じ「完成！」
      currentCheck = 'EZ-03'
      await ezPage.evaluate(() => window.scrollTo(0, 0))
      await ezPage.waitForTimeout(200)
      await ezPage.locator('[data-testid="cook-session-start"]').click()
      await ezPage.waitForTimeout(600)
      for (let i = 0; i < 40; i++) {
        if ((await ezPage.locator('[data-testid="cook-session-finish"]').count()) > 0) break
        await ezPage.locator('[data-testid="cook-session-next"]').click()
        await ezPage.waitForTimeout(120)
      }
      const ezFinishLabel = await ezPage.locator('[data-testid="cook-session-finish"]').innerText()
      check('EZ-03 最終手順のボタンが「完成！」になっている', ezFinishLabel.trim() === '完成！', ezFinishLabel)
      check(
        'EZ-03 「調理を終える」がボタンの文言として残っていない',
        !(await ezPage.locator('[data-testid="cook-session"]').innerText()).includes('調理を終える'),
      )

      // EZ-04: 「完成！」のあとの戻り位置＝「まとめて作った！」が画面内に入る
      //   2026-08-11 便FO: 「完成！」はまず作った記録の確認を出す。**記録しないほうを選んだとき**の
      //   戻り位置がここで見ている挙動（オーナー指示「完成後、画面の戻り位置は並行ナビ下部
      //   『まとめて作った！』までスクロール」）なので、確認では記録しないほうを選んで確かめる。
      //   2026-08-12 便FX: 確認はブラウザの窓から画面の中の窓（3つの行き先）に変わったので、
      //   「記録をつけずに閉じる」を押す
      currentCheck = 'EZ-04'
      const ezScrollBefore = await ezPage.evaluate(() => window.scrollY)
      await ezPage.locator('[data-testid="cook-session-finish"]').click()
      await ezPage.waitForTimeout(600)
      await ezPage.locator('[data-testid="cook-finish-close"]').click()
      await ezPage.waitForTimeout(1500)
      const ezGeom = await ezPage.evaluate(() => {
        const el = document.querySelector('[data-testid="navi-mark-all-cooked"]')
        if (!el) return null
        const r = el.getBoundingClientRect()
        let bottomBar = window.innerHeight
        for (const b of document.querySelectorAll('[data-app-bottom-bar]')) {
          const br = b.getBoundingClientRect()
          if (br.height > 0 && br.top < bottomBar) bottomBar = br.top
        }
        let topBar = 0
        for (const b of document.querySelectorAll('[data-app-top-bar]')) {
          const br = b.getBoundingClientRect()
          if (br.height > 0) topBar = Math.max(topBar, br.bottom)
        }
        return { top: r.top, bottom: r.bottom, topBar, bottomBar, scrollY: window.scrollY }
      })
      check(
        'EZ-04 「完成！」のあと画面が「まとめて作った！」まで送られる',
        ezGeom != null && ezGeom.scrollY > ezScrollBefore,
        `スクロール ${ezScrollBefore}→${ezGeom && ezGeom.scrollY}`,
      )
      check(
        'EZ-04 「まとめて作った！」が上下の固定帯の裏に隠れず全部見えている',
        ezGeom != null && ezGeom.top >= ezGeom.topBar && ezGeom.bottom <= ezGeom.bottomBar,
        JSON.stringify(ezGeom),
      )
      check(
        'EZ-04 全画面の調理中モードは閉じている（記録はまだ付いていない）',
        (await ezPage.locator('[data-testid="cook-session"]').count()) === 0,
      )

      // EZ-05: 献立カードの枠からレシピ詳細へ
      currentCheck = 'EZ-05'
      await ezPage.goto(`${BASE}/#/meal-plan`)
      await ezPage.reload({ waitUntil: 'networkidle' })
      await ezPage.waitForTimeout(1500)
      await ezPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(ezPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await ezPage.waitForTimeout(1000)
      const ezTodaySection = ezPage.locator(`section[data-date="${ezSeed.today}"]`)
      // 2026-08-22 便IV（オーナー原文「週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ
      // （タップでレシピ詳細画面につながる）。」）: 通常表示では**カードそのものが**レシピ詳細への
      // 入口になった。2026-08-25 便KU で編集モードのカードも同じ行き先になり、
      // 1品ごとの操作（レシピを変更・引き直し・外す・食数）だけが編集モードに残っている
      const ezCards = ezTodaySection.locator('[data-testid="row-recipe"]')
      check(
        'EZ-05(便IV→便KU) 通常表示には1品ごとの操作を出さない（カードだけが入口）',
        (await ezTodaySection.locator('[data-testid="slot-change-recipe"]').count()) === 0,
        `件数=${await ezTodaySection.locator('[data-testid="slot-change-recipe"]').count()}`,
      )
      check(
        'EZ-05(便IV) 通常表示に、レシピが入っている枠のカードが並ぶ',
        (await ezCards.count()) === 2,
        `件数=${await ezCards.count()}`,
      )
      check(
        'EZ-05(便IV) カードは押すとレシピ詳細へ移るリンクになっている',
        (await ezTodaySection.locator('a[data-testid="row-recipe"]').count()) === 2,
        `リンク=${await ezTodaySection.locator('a[data-testid="row-recipe"]').count()}`,
      )
      await ezTodaySection
        .locator('[data-testid="row-recipe"]')
        .filter({ hasText: 'EZ照り焼き' })
        .first()
        .click()
      await ezPage.waitForTimeout(900)
      check(
        'EZ-05 通常表示のカードでそのレシピの詳細へ移る',
        ezPage.url().includes(`/recipes/${ezSeed.idA}`),
        ezPage.url(),
      )
      check(
        'EZ-05 開いた先が枠に入っていたレシピになっている',
        ((await ezPage.textContent('body')) ?? '').includes('EZ照り焼き'),
      )
      // 詳細画面の「戻る」で、開いた元＝献立の週タブへ帰ること（WEEK_RETURN_LINK_STATE を
      // 渡しているので、レシピ一覧ではなく週タブに戻る。便DT-2 と同じ帰り道を使う）
      await ezPage.getByRole('button', { name: ja.common.back }).first().click()
      await ezPage.waitForTimeout(1500)
      check(
        'EZ-05 詳細の「戻る」で献立の週タブに帰る（レシピ一覧へ飛ばされない）',
        (await ezPage.locator(`section[data-date="${ezSeed.today}"]`).count()) === 1,
        ezPage.url(),
      )
      // 編集モード側（2026-08-25 便KU・オーナー原文「編集画面、ここだけレシピカードをタップで
      // レシピ詳細に行かない。他はレシピカードから必ずレシピ詳細に行くので揃えるべきでは。
      // 「レシピを見る」→「レシピを変更」」）:
      // **カードの押下は通常表示と同じレシピ詳細**になり、差し替えは「レシピを変更」が持つ。
      // 便DP-5の裁定（差し替えの道を奪わない）は、名前の付いたボタンとして残すことで満たす
      // 「戻る」で週タブへ帰ってきた直後なので、そのまま曜日カードを開いて編集モードへ入る
      await openAllWeekDays(ezPage)
      check(
        'EZ-05(便IV) 前提: 今日のカードを編集モードにできた',
        (await openWeekDayEdit(ezPage, ezSeed.today)) === true,
      )
      const ezChangeRecipe = ezTodaySection.locator('[data-testid="slot-change-recipe"]')
      check(
        'EZ-05(便KU) 編集モードでは、レシピが入っている枠に「レシピを変更」が出る',
        (await ezChangeRecipe.count()) === 2,
        `件数=${await ezChangeRecipe.count()}`,
      )
      check(
        'EZ-05(便KU) 空いている枠には出さない（差し替える中身が無いため）',
        (await ezChangeRecipe.count()) ===
          (await ezTodaySection.locator('[data-testid="row-thumb"]').count()) -
            (await ezTodaySection
              .getByRole('button', { name: ja.mealPlan.emptyAssign })
              .count()),
        `レシピを変更=${await ezChangeRecipe.count()} サムネ=${await ezTodaySection.locator('[data-testid="row-thumb"]').count()}`,
      )
      check(
        'EZ-05(便KU) 編集モードでもカードはレシピ詳細へのリンク（通常表示と同じ行き先）',
        (await ezTodaySection.locator('a[data-testid="row-recipe"]').count()) === 2,
        `リンク=${await ezTodaySection.locator('a[data-testid="row-recipe"]').count()}`,
      )
      // 「レシピを変更」を押すと、差し替えの画面（レシピを選ぶ）が開く＝入れ替えの道は残っている
      await ezChangeRecipe.first().click()
      await ezPage.waitForTimeout(1200)
      check(
        'EZ-05(便KU) 「レシピを変更」で差し替えの画面が開く（入れ替えの道を奪っていない）',
        (await ezPage.locator('[data-testid="recipe-picker"]').count()) === 1,
        `ピッカー=${await ezPage.locator('[data-testid="recipe-picker"]').count()}`,
      )
      await ezPage.keyboard.press('Escape')
      await ezPage.waitForTimeout(800)
      await ezTodaySection.locator('a[data-testid="row-recipe"]').first().click()
      await ezPage.waitForTimeout(1200)
      check(
        'EZ-05(便KU) 編集モードのカードを押すとレシピ詳細が開く',
        /#\/recipes\/\d+/.test(ezPage.url()),
        ezPage.url(),
      )
    } finally {
      await ezBrowser.close()
    }
  }


  // --- FA-1: しいたけの名寄せ(2026-08-10 オーナー裁定「生と乾燥を別項目として名前で区別する」) ---
  // 価格マスタに「しいたけ 150円/6枚」と「生しいたけ 100円/6枚」が同じ食材のまま並び、
  // 同じものなのに値段が違っていた。生の側は「生しいたけ 100円」1本へ寄せ(オーナー指定
  // 「どちらかなら生しいたけ」)、乾燥は価格帯が全く違うので別項目で持つ。
  // 2026-08-10 便FB: その乾燥側の項目名を「干ししいたけ 400円/30g」に統一した(オーナー指示)。
  // 素の「しいたけ」と書いたレシピ(同梱の寄せ鍋)も同じ1件に価格解決することまで見る
  currentCheck = 'FA-1'
  {
    const faBrowser = await chromium.launch()
    try {
      const faCtx = await faBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const faPage = await faCtx.newPage()
      faPage.on('pageerror', (err) => errors.push(`[pageerror@FA-1] ${err.message}`))
      await faPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await faPage.waitForTimeout(2000) // 初回シード(レシピ109品＋価格マスタ)の完了待ち

      // 「食材と価格」: 生と乾燥が別の行で並び、素の「しいたけ」だけの行はもう無い
      check(
        'FA-1 「食材と価格」に素の「しいたけ」の行が無い(生しいたけへ名寄せ済み)',
        (await faPage.getByLabel('しいたけの価格（円）', { exact: true }).count()) === 0,
      )
      const faFreshYen = await faPage.getByLabel('生しいたけの価格（円）', { exact: true }).inputValue()
      const faFreshQty = await faPage.getByLabel('生しいたけの数量', { exact: true }).inputValue()
      const faFreshUnit = await faPage.getByLabel('生しいたけの単位', { exact: true }).inputValue()
      check(
        // 2026-08-26 便LF: 並のグレードで測り直して100→245円/6枚。
        // 便FAが決めたのは「生の項目を1つに寄せること」で、値段そのものはあとから実勢に合わせてよい
        'FA-1 「生しいたけ」は1項目で245円/6枚(便FAで名寄せ・2026-08-26 便LFで実勢に合わせた)',
        faFreshYen === '245' && faFreshQty === '6' && faFreshUnit === '枚',
        `${faFreshYen}円 / ${faFreshQty}${faFreshUnit}`,
      )
      const faDryYen = await faPage.getByLabel('干ししいたけの価格（円）', { exact: true }).inputValue()
      const faDryQty = await faPage.getByLabel('干ししいたけの数量', { exact: true }).inputValue()
      const faDryUnit = await faPage.getByLabel('干ししいたけの単位', { exact: true }).inputValue()
      check(
        // 2026-08-26 便LF: 並のグレードで測り直して400→700円/30g
        'FA-1 「干ししいたけ」が別項目として並ぶ(700円/30g・生とは価格帯が違う)',
        faDryYen === '700' && faDryQty === '30' && faDryUnit === 'g',
        `${faDryYen}円 / ${faDryQty}${faDryUnit}`,
      )
      check(
        'FB-1 旧名「乾燥しいたけ」の行は「食材と価格」に並ばない(呼び名を統一した)',
        (await faPage.getByLabel('乾燥しいたけの価格（円）', { exact: true }).count()) === 0,
      )

      // 素の「しいたけ4枚」と書いてある寄せ鍋が、生しいたけの単価で按分される
      await faPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await faPage.waitForTimeout(600)
      await faPage.getByPlaceholder(ja.search.placeholder).fill('しいたけ')
      await faPage.waitForTimeout(800)
      const faSearchBody = (await faPage.textContent('body')) ?? ''
      check(
        'FA-1 「しいたけ」で検索すると素の表記の寄せ鍋も生しいたけ表記のレシピも出る(名寄せで検索が壊れていない)',
        faSearchBody.includes('寄せ鍋') && faSearchBody.includes('チンゲン菜としいたけのにんにく炒め'),
        faSearchBody.includes('寄せ鍋') ? '炒めが出ない' : '寄せ鍋が出ない',
      )
      await faPage.getByText('寄せ鍋', { exact: true }).first().click()
      await faPage.waitForTimeout(800)
      const faNabe = (await faPage.textContent('body')) ?? ''
      check(
        // 2026-08-26 便LF: 生しいたけほかの調べ直しで217→315円
        'FA-1 寄せ鍋の1食あたりが生しいたけの単価での按分になる(名寄せ前226円→便LFの前は217円→315円)',
        faNabe.includes(ja.detail.pricePerServing.replace('{n}', '315')),
        faNabe.includes('約226円') ? '名寄せ前の226円のまま' : '',
      )
      await faPage.getByRole('button', { name: ja.detail.priceViewShow }).click()
      await faPage.waitForTimeout(500)
      const faNabeRow = await faPage.locator('li', { hasText: 'しいたけ' }).first().textContent()
      check(
        // 2026-08-22 便JG: 上のEY-01と同じ理由で、行の金額は「出ている分量ぶん」になった
        // 2026-08-26 便LF: 生しいたけを100→245円/6枚にしたので67→163円。
        // **1パック(6枚)まるごとの245円が乗っていないこと**が、この判定の役目
        'FA-1 材料行「しいたけ」の原価が、出ている分量ぶん(4人分＝4枚)の約163円',
        (faNabeRow ?? '').includes('約163円') && !(faNabeRow ?? '').includes('約245円'),
        String(faNabeRow),
      )
    } finally {
      await faBrowser.close()
    }
  }

  // --- FA-1b: 既存端末の重複行を1行に畳む移行(版7)。規約F: 何が消えて何が残るか ---
  // 版6の端末には「しいたけ 150円/6枚」と「生しいたけ 100円/6枚」の2行が残っている。
  // 目安のままの「しいたけ」だけを消し、「生しいたけ」は1円も動かさない
  currentCheck = 'FA-1b'
  {
    const fa2Browser = await chromium.launch()
    try {
      const fa2Ctx = await fa2Browser.newContext({ viewport: { width: 390, height: 844 } })
      const fa2Page = await fa2Ctx.newPage()
      fa2Page.on('pageerror', (err) => errors.push(`[pageerror@FA-1b] ${err.message}`))
      await fa2Page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await fa2Page.waitForTimeout(2000)

      // 版6の端末を再現する: 目安のままの「しいたけ 150円/6枚」を足して版番号を6へ戻す
      await fa2Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['prices', 'settings'], 'readwrite')
          tx.objectStore('prices').put({
            name: 'しいたけ',
            pricePerUnit: 150,
            unit: '6枚',
            isDefault: true,
            defaultPricePerUnit: 150,
            defaultUnit: '6枚',
            updatedAt: Date.now(),
          })
          const settings = tx.objectStore('settings')
          const getReq = settings.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            settings.put({ ...current, id: 1, priceDefaultsVersion: 6 })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })
      // 2026-08-26 便LF: **移行の前に「生しいたけ」の値を控えておく。**
      // ここは「移行が金額を動かさないこと」を見る節なので、金額をベタ書きせず**前後の関係**で見る。
      // （この行は最初の投入で作られるので、いくらで入っているかは目安価格を直すたびに変わる。
      //   便LFが100→245円にしたとき、ベタ書きの100円で落ちて気づいた）
      const fa2Before = await fa2Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const rows = await new Promise((resolve, reject) => {
          const tx = idb.transaction('prices', 'readonly')
          const all = tx.objectStore('prices').getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => reject(all.error)
        })
        idb.close()
        const r = rows.find((x) => x.name === '生しいたけ')
        return r ? { unit: r.unit, price: r.pricePerUnit } : null
      })
      await fa2Page.reload({ waitUntil: 'networkidle' })
      await fa2Page.waitForTimeout(2000)
      const fa2Rows = await fa2Page.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const rows = await new Promise((resolve, reject) => {
          const tx = idb.transaction('prices', 'readonly')
          const all = tx.objectStore('prices').getAll()
          all.onsuccess = () => resolve(all.result)
          all.onerror = () => reject(all.error)
        })
        idb.close()
        const pick = (name) => {
          const r = rows.find((x) => x.name === name)
          return r ? { unit: r.unit, price: r.pricePerUnit, isDefault: r.isDefault } : null
        }
        return {
          plain: pick('しいたけ'),
          fresh: pick('生しいたけ'),
          dry: pick('干ししいたけ'),
          oldDry: pick('乾燥しいたけ'),
          shiitakeRows: rows.filter((r) => String(r.name).includes('しいたけ')).map((r) => r.name),
        }
      })
      check(
        'FA-1b 目安のままの重複行「しいたけ」は移行で1行に畳まれる(消える)',
        fa2Rows.plain === null,
        JSON.stringify(fa2Rows.plain),
      )
      check(
        'FA-1b 残る「生しいたけ」は移行の前と1円も変わらない(移行で金額を動かさない)',
        fa2Before != null &&
          fa2Rows.fresh?.price === fa2Before.price &&
          fa2Rows.fresh?.unit === fa2Before.unit,
        `前=${JSON.stringify(fa2Before)} 後=${JSON.stringify(fa2Rows.fresh)}`,
      )
      check(
        // 2026-08-26 便LF: **新しく作られる行は、そのときの目安価格を取るのが正しい**
        // （まだ持っていない食材が増えるだけで、持っている行の金額を書き換えてはいない）。
        // 便LFで干ししいたけを400→700円/30gにしたので、ここも700円になる
        'FA-1b 新項目「干ししいたけ」が既存端末にも追加される(いまの目安価格700円/30gで入る)',
        fa2Rows.dry?.price === 700 && fa2Rows.dry?.unit === '30g',
        JSON.stringify(fa2Rows.dry),
      )
      check(
        'FB-1b 版6の端末に旧名「乾燥しいたけ」の行はできない(統一後の名前で1行だけ入る)',
        fa2Rows.oldDry === null,
        JSON.stringify(fa2Rows.oldDry),
      )
      check(
        'FA-1b しいたけ系の行は「生しいたけ」「干ししいたけ」の2行だけになる',
        fa2Rows.shiitakeRows.length === 2,
        fa2Rows.shiitakeRows.join('/'),
      )
    } finally {
      await fa2Browser.close()
    }
  }

  // --- FA-2: 紹介ページの見出しの句点(2026-08-10 オーナー指示) ---
  // 文末に「。」を足しても、スマホ(390px)でもパソコン(1280px)でも2行のままで
  // 横スクロールが出ないこと(折り返しが崩れていないこと)を実測する
  currentCheck = 'FA-2'
  {
    const fa3Browser = await chromium.launch()
    try {
      for (const [w, h] of [[390, 844], [1280, 900]]) {
        const fa3Ctx = await fa3Browser.newContext({ viewport: { width: w, height: h } })
        const fa3Page = await fa3Ctx.newPage()
        fa3Page.on('pageerror', (err) => errors.push(`[pageerror@FA-2] ${err.message}`))
        await fa3Page.goto(`${BASE}/about/`, { waitUntil: 'networkidle' })
        const fa3 = await fa3Page.evaluate(() => {
          const h1 = document.querySelector('h1')
          const rect = h1.getBoundingClientRect()
          const lineHeight = parseFloat(getComputedStyle(h1).lineHeight)
          return {
            text: (h1.textContent ?? '').replace(/\s+/g, ''),
            lines: Math.round(rect.height / lineHeight),
            overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          }
        })
        check(
          `FA-2(${w}px) 見出しの文末に句点がある`,
          fa3.text === 'レシピを集めて登録。もう献立に迷わない。',
          fa3.text,
        )
        check(`FA-2(${w}px) 見出しは2行のまま(折り返しが増えていない)`, fa3.lines === 2, `行数=${fa3.lines}`)
        check(`FA-2(${w}px) 横スクロールが出ていない`, fa3.overflowX === false)
        await fa3Ctx.close()
      }
    } finally {
      await fa3Browser.close()
    }
  }

  // --- FA-3: 書き出したレシピの扱い(2026-08-10 オーナー承認・docs/65 A-2) ---
  // ①利用規約に「書き出したファイルの取り扱いは書き出した本人の責任」の1文がある
  // ② 書き出し(選び終わったあとの窓の「ファイルに書き出す」)の確認文に軽い一言が出る
  //    (重い警告にしない・解錠コードの話はしない)
  currentCheck = 'FA-3'
  {
    const fa4Browser = await chromium.launch()
    try {
      const fa4Ctx = await fa4Browser.newContext({ viewport: { width: 390, height: 844 } })
      const fa4Page = await fa4Ctx.newPage()
      fa4Page.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FA-3] ${err.message}`)
      })
      await fa4Page.goto(`${BASE}/about/terms.html`, { waitUntil: 'networkidle' })
      const fa4Terms = (await fa4Page.textContent('body')) ?? ''
      check(
        'FA-3 利用規約に書き出したファイルの取り扱いについての1文がある',
        fa4Terms.includes(
          'レシピを書き出したファイルには収録レシピや取り込んだレシピの内容がそのまま入るため、ファイルの保管・配布・公開は書き出したご本人の責任で行ってください。',
        ),
      )
      check(
        'FA-3 追記した1文は「著作権」の節に置いてある(免責事項とは分ける)',
        fa4Terms.indexOf('著作権') < fa4Terms.indexOf('書き出したご本人の責任') &&
          fa4Terms.indexOf('書き出したご本人の責任') < fa4Terms.indexOf('規約の変更'),
      )

      // 書き出しの確認(画面の中の窓・2026-08-15 便GV)。「やめる」で閉じる＝ファイルは作らない
      let fa4Dialog = ''
      fa4Page.on('dialog', (dialog) => {
        fa4Dialog = dialog.message()
        void dialog.dismiss()
      })
      await fa4Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fa4Page.waitForTimeout(1800)
      await fa4Page.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await fa4Page.waitForTimeout(700)
      const fa4Picked = await fa4Page.locator('main a[href^="#/recipes/"]:not([href$="/new"])').count()
      check('FA-3 前提: 検索で対象を絞れている', fa4Picked > 0 && fa4Picked < 10, `件数=${fa4Picked}`)
      await fa4Page.getByRole('button', { name: ja.recipes.selectToggle, exact: true }).click()
      await fa4Page.waitForTimeout(400)
      await fa4Page.getByRole('button', { name: '全選択', exact: true }).click()
      await fa4Page.waitForTimeout(400)
      await fa4Page.getByTestId('selection-finish').click()
      await fa4Page.waitForTimeout(400)
      await fa4Page.getByTestId('selection-actions-export').click()
      await fa4Page.waitForTimeout(1000)
      const fa4Confirm = fa4Page.getByTestId('recipes-export-confirm')
      const fa4Text = (await fa4Confirm.innerText()) ?? ''
      check(
        'FA-3 書き出しの確認に人へ渡すときの一言が出る',
        fa4Text.includes('人に渡す・公開するときは中身をご確認ください'),
        fa4Text,
      )
      check(
        'FA-3 一言は1文だけ(重い警告にしない)',
        fa4Text.split('ご確認ください').length - 1 === 1,
        fa4Text,
      )
      check('FA-3 選択レシピの書き出しでは解錠コードの話をしない(このファイルには入らない)', !fa4Text.includes('解錠コード'), fa4Text)
      check('FA-3 書き出しの確認でブラウザの素のダイアログを出さない', fa4Dialog === '', fa4Dialog)
      await fa4Page.getByTestId('recipes-export-confirm-cancel').click()
      await fa4Page.waitForTimeout(400)
      check(
        'FA-3 閉じれば何も書き出されない(端末のレシピも減らない)',
        (await fa4Page.getByTestId('recipes-export-confirm').count()) === 0 &&
          (await fa4Page.locator('main a[href^="#/recipes/"]:not([href$="/new"])').count()) === fa4Picked,
      )
      // 全体のバックアップは言うべきことが違う: 解錠コードが入るので渡さないと言い切る
      await fa4Page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await fa4Page.waitForTimeout(900)
      // 2026-08-27 便LS: 解錠コードの注意は「バックアップを取る」カードの折りたたみに入った
      // （中身は減っていない）。開いてから読む
      const fa4Notice = fa4Page.locator('[data-testid="backup-notice-toggle"]')
      if ((await fa4Notice.count()) === 1) {
        await fa4Notice.click()
        await fa4Page.waitForTimeout(400)
      }
      const fa4Settings = (await fa4Page.textContent('body')) ?? ''
      check(
        'FA-3 全体のバックアップは「他の人に渡さないでください」のまま(解錠コードが入るため)',
        fa4Settings.includes(ja.settings.backupContainsCodeNotice),
      )
    } finally {
      await fa4Browser.close()
    }
  }

  // --- FB-1c: 版7の端末からの移行(2026-08-10 便FB。呼び名を「干ししいたけ」に統一) ---
  // 版7(「乾燥しいたけ 400円/30g」を含む)は本番に約30分だけ出ていたので、その行を受け取った
  // 端末が実在する。目安のままの行は「干ししいたけ」に畳み、自分で値段を入れた行は1件も触らない
  currentCheck = 'FB-1c'
  {
    const fbBrowser = await chromium.launch()
    try {
      // 版7の端末を作り直す共通処理: 「干ししいたけ」を消して「乾燥しいたけ」を置き、版番号を7へ戻す
      const makeV7Device = async (page, dryRow) => {
        await page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
        await page.waitForTimeout(2000) // 初回シード(レシピ109品＋価格マスタ)の完了待ち
        await page.evaluate(async (row) => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const all = await new Promise((resolve, reject) => {
            const tx = idb.transaction('prices', 'readonly')
            const get = tx.objectStore('prices').getAll()
            get.onsuccess = () => resolve(get.result)
            get.onerror = () => reject(get.error)
          })
          const hoshi = all.find((r) => r.name === '干ししいたけ')
          await new Promise((resolve, reject) => {
            const tx = idb.transaction(['prices', 'settings'], 'readwrite')
            const prices = tx.objectStore('prices')
            if (hoshi) prices.delete(hoshi.id)
            prices.put({ ...row, updatedAt: Date.now() })
            const settings = tx.objectStore('settings')
            const getReq = settings.get(1)
            getReq.onsuccess = () => {
              const current = getReq.result || { id: 1 }
              settings.put({ ...current, id: 1, priceDefaultsVersion: 7 })
            }
            tx.oncomplete = () => resolve(undefined)
            tx.onerror = () => reject(tx.error)
          })
          idb.close()
        }, dryRow)
        await page.reload({ waitUntil: 'networkidle' })
        await page.waitForTimeout(2000)
        return page.evaluate(async () => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const rows = await new Promise((resolve, reject) => {
            const tx = idb.transaction('prices', 'readonly')
            const all = tx.objectStore('prices').getAll()
            all.onsuccess = () => resolve(all.result)
            all.onerror = () => reject(all.error)
          })
          idb.close()
          const pick = (name) => {
            const r = rows.find((x) => x.name === name)
            return r ? { unit: r.unit, price: r.pricePerUnit, isDefault: r.isDefault } : null
          }
          return {
            hoshi: pick('干ししいたけ'),
            oldDry: pick('乾燥しいたけ'),
            fresh: pick('生しいたけ'),
            shiitakeRows: rows.filter((r) => String(r.name).includes('しいたけ')).map((r) => r.name),
          }
        })
      }

      // ① 目安のままの行 → 「干ししいたけ」に畳まれる(価格・単位は動かさない)
      const fbCtx = await fbBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fbPage = await fbCtx.newPage()
      fbPage.on('pageerror', (err) => errors.push(`[pageerror@FB-1c] ${err.message}`))
      const fbPlain = await makeV7Device(fbPage, {
        name: '乾燥しいたけ',
        pricePerUnit: 400,
        unit: '30g',
        isDefault: true,
        defaultPricePerUnit: 400,
        defaultUnit: '30g',
      })
      check(
        'FB-1c 版7の端末: 目安のままの「乾燥しいたけ」の行は消える',
        fbPlain.oldDry === null,
        JSON.stringify(fbPlain.oldDry),
      )
      check(
        'FB-1c 版7の端末: 代わりに「干ししいたけ」が400円/30gで残る(金額は1円も動かさない)',
        fbPlain.hoshi?.price === 400 && fbPlain.hoshi?.unit === '30g' && fbPlain.hoshi?.isDefault === true,
        JSON.stringify(fbPlain.hoshi),
      )
      check(
        'FB-1c 版7の端末: しいたけ系は「生しいたけ」「干ししいたけ」の2行だけ(行は増えも減りもしない)',
        fbPlain.shiitakeRows.length === 2 && fbPlain.hoshi !== null && fbPlain.fresh !== null,
        fbPlain.shiitakeRows.join('/'),
      )
      const fbHoshiYen = await fbPage.getByLabel('干ししいたけの価格（円）', { exact: true }).inputValue()
      check('FB-1c 版7の端末: 画面にも「干ししいたけ 400円」で出る', fbHoshiYen === '400', String(fbHoshiYen))

      // ② 自分で価格を入れた行 → 1件も触らない(その端末では旧名のまま自分の値段が残る)
      const fbCtx2 = await fbBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fbPage2 = await fbCtx2.newPage()
      fbPage2.on('pageerror', (err) => errors.push(`[pageerror@FB-1c] ${err.message}`))
      const fbEdited = await makeV7Device(fbPage2, {
        name: '乾燥しいたけ',
        pricePerUnit: 250,
        unit: '30g',
        isDefault: false,
        defaultPricePerUnit: 400,
        defaultUnit: '30g',
      })
      check(
        'FB-1c 自分で入れた価格の行は移行で消さない(乾燥しいたけ250円がそのまま残る)',
        fbEdited.oldDry?.price === 250 && fbEdited.oldDry?.isDefault === false,
        JSON.stringify(fbEdited.oldDry),
      )
      check(
        'FB-1c 自分の行がある端末では「干ししいたけ」を重ねて増やさない(同じ食材が2行にならない)',
        fbEdited.hoshi === null && fbEdited.shiitakeRows.length === 2,
        fbEdited.shiitakeRows.join('/'),
      )
      const fbEditedYen = await fbPage2.getByLabel('乾燥しいたけの価格（円）', { exact: true }).inputValue()
      check('FB-1c 画面上も自分で入れた250円が残っている', fbEditedYen === '250', String(fbEditedYen))
    } finally {
      await fbBrowser.close()
    }
  }

  // --- FB-2: 食品と目安価格の一覧(公開ページ)の呼び名と別名(2026-08-10 便FB) ---
  // 成分表側は元から「干ししいたけ」で、価格マスタの「乾燥しいたけ」と名前が食い違っていた。
  // 統一後は同じ名前で並び、旧名は別名欄に出る(アプリが受け付ける書き方とページの記載が揃う)
  currentCheck = 'FB-2'
  {
    const fb2Browser = await chromium.launch()
    try {
      const fb2Ctx = await fb2Browser.newContext({ viewport: { width: 390, height: 844 } })
      const fb2Page = await fb2Ctx.newPage()
      fb2Page.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FB-2] ${err.message}`)
      })
      await fb2Page.goto(`${BASE}/about/foods.html`, { waitUntil: 'networkidle' })
      const fb2 = await fb2Page.evaluate(() => {
        const rows = [...document.querySelectorAll('tr')]
        const target = rows.find((tr) => tr.querySelector('.nm')?.childNodes[0]?.textContent?.trim() === '干ししいたけ')
        const aliasSection = document.querySelector('#alias')
        return {
          found: !!target,
          alias: target?.querySelector('.al')?.textContent?.trim() ?? '',
          price: target?.querySelector('.p')?.textContent?.trim() ?? '',
          names: rows.map((tr) => tr.querySelector('.nm')?.childNodes[0]?.textContent?.trim() ?? ''),
          aliasSectionText: aliasSection?.textContent ?? '',
        }
      })
      check('FB-2 一覧に「干ししいたけ」の行がある', fb2.found)
      check(
        'FB-2 別名欄に旧名「乾燥しいたけ」が載っている',
        fb2.alias.includes('乾燥しいたけ'),
        fb2.alias,
      )
      check(
        'FB-2 別名欄は成分表の呼び方も残す(乾しいたけ・干し椎茸)',
        fb2.alias.includes('乾しいたけ') && fb2.alias.includes('干し椎茸'),
        fb2.alias,
      )
      check(
        // 2026-08-26 便LF: このページはいまの価格マスタを映すので、便LFが干ししいたけを
        // 400→700円/30gにしたぶんだけ動く。**便FBが見張っていた「呼び名を変えただけでは
        // 金額が動かないこと」は、移行の側（FB-1c）で見ている**——そちらは 400円のまま緑。
        // ここは「ページとマスタが食い違っていないこと」を見る場所
        'FB-2 目安価格はいまのマスタと同じ700円/30g(便FBの呼び名の統一では動かしていない)',
        fb2.price.replace(/\s/g, '') === '700円/30g',
        fb2.price,
      )
      check(
        'FB-2 食品名として「乾燥しいたけ」の行は無い(価格マスタとページで名前が揃った)',
        !fb2.names.includes('乾燥しいたけ'),
        fb2.names.filter((n) => n.includes('しいたけ')).join('/'),
      )
      check(
        'FB-2 「別の名前でも登録している目安価格」にしいたけは出ない(価格マスタの名前で完全一致する)',
        !fb2.aliasSectionText.includes('しいたけ'),
      )
    } finally {
      await fb2Browser.close()
    }
  }

  // ============================================================================
  // 便FC（2026-08-10 オーナー実機フィードバック8件）:
  //   タイマー3件 …… ①「いったん止める」→「一時停止」（並ぶ「停止」は「タイマーを消す」へ）
  //                   ②一時停止のあと声で再開できない ③「もう一度」→「読み上げ」
  //   調理中モード5件 … ④閉じて開き直すと①に戻る→続きから ⑤タイマーからの戻り先を調理中モードへ
  //                   ⑥左上に「手順①へ」 ⑦他の品の「作り終えました」→料理名の横に「完成」で1行
  //                   ⑧他の品の次の手順を開いたら、タイマーは手順の下
  // ============================================================================
  currentCheck = 'FC-01'
  {
    const fcBrowser = await chromium.launch()
    const fcContext = await fcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    // 2026-08-11 便FO: 声の案内は「声で操作」をONにしている間だけ出すようにしたので、
    // FC-01〜03の案内文を読むために聞き取りを偽装して確実にONにできるようにする（FIと同じ手口）
    await fcContext.addInitScript(() => {
      class FakeRecognition {
        constructor() {
          this.lang = ''
          this.continuous = false
          this.interimResults = false
        }
        start() {}
        stop() {}
        abort() {}
      }
      window.SpeechRecognition = FakeRecognition
      window.webkitSpeechRecognition = FakeRecognition
    })
    const fcPage = await fcContext.newPage()
    fcPage.on('dialog', (d) => void d.accept())
    fcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FC] ${err.message}`)
    })
    fcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@FC] ${t}`)
    })
    const fcCounter = () => fcPage.locator('[data-testid="cook-session-counter"]').innerText()
    const fcRecipe = () => fcPage.locator('[data-testid="cook-session-recipe"]').innerText()
    const fcOpenSession = async () => {
      await fcPage.locator('[data-testid="cook-session-start"]').click()
      await fcPage.waitForTimeout(600)
    }
    const fcNext = async (n = 1) => {
      for (let i = 0; i < n; i++) {
        await fcPage.locator('[data-testid="cook-session-next"]').click()
        await fcPage.waitForTimeout(250)
      }
    }
    try {
      await fcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1800)
      await fcPage.evaluate(async () => {
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
        const idA = await P(store('recipes').add(mk('FC照り焼き', [
          { text: '鶏もも肉は厚みを開いて、フォークで数か所穴を開ける。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれを加えて煮からめ、器に盛る。' },
        ], [{ name: '鶏もも肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('FC煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に大根とだしを入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて10分おき、器に盛る。', minutes: 10 },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        const idC = await P(store('recipes').add(mk('FCマリネ', [
          { text: 'ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。' },
          { text: 'パプリカときゅうりを細切りにする。' },
          { text: 'マリネ液と和えて冷蔵庫で20分冷やす。', minutes: 20 },
        ], [{ name: 'パプリカ', amount: '1', unit: '個' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB, idC]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await fcPage.goto(`${BASE}/#/cook-navi`)
      await fcPage.reload({ waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1200)
      await fcPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await fcPage.waitForTimeout(700)
      await fcOpenSession()

      // --- FC-06: 左上の「最初の手順へ」（オーナー実機「左上に、①に戻るボタンを設置したい」） ---
      //     2026-08-11 便FO で呼び方だけ「手順①へ」から改めた（利用者テスト「押すまで意味不明。
      //     丸囲みの①はこのアプリの他のどこにも出てこない」）。置き場所と働きは便FCのまま
      currentCheck = 'FC-06'
      const fcToFirst = fcPage.locator('[data-testid="cook-session-to-first"]')
      check(
        'FC-06 左上に「最初の手順へ」がある（押す前に何が起きるか読める）',
        (await fcToFirst.innerText()).trim() === '最初の手順へ',
        await fcToFirst.innerText(),
      )
      check(
        'FC-06 「戻る」の語を使わない（すぐ下の「前へ」・端末の戻ると読み分けられなくなるため）',
        !(await fcToFirst.innerText()).includes('戻'),
        await fcToFirst.innerText(),
      )
      const fcToFirstBox = await fcToFirst.boundingBox()
      const fcCloseBox = await fcPage.locator('[data-testid="cook-session-close"]').boundingBox()
      check(
        'FC-06 置き場所は左上（✕のとなり・画面の左半分）',
        fcToFirstBox != null && fcCloseBox != null &&
          fcToFirstBox.x > fcCloseBox.x && fcToFirstBox.x < 195 && fcToFirstBox.y < 120,
        JSON.stringify({ toFirst: fcToFirstBox, close: fcCloseBox }),
      )
      check('FC-06 先頭の手順では押せない', await fcToFirst.isDisabled())
      await fcNext(3)
      const fcMoved = await fcCounter()
      check('FC-06 前提: 3つ進んでいる', /^段取り 4\//.test(fcMoved), fcMoved)
      check('FC-06 先頭から離れると押せるようになる', !(await fcToFirst.isDisabled()))
      await fcToFirst.click()
      await fcPage.waitForTimeout(400)
      check(
        'FC-06 押すと段取りの最初の手順に戻る',
        /^段取り 1\//.test(await fcCounter()),
        await fcCounter(),
      )

      // --- FC-02/03: 声の案内（画面に出ている語を言えば効く。判定の語形は単体テストで固定） ---
      //     2026-08-11 便FO: 案内は「声で操作」をONにしている間だけ出す（利用者テスト
      //     「声を使わないのに、画面の上5行がずっと声の説明で埋まっている」）ので、先にONにする
      currentCheck = 'FC-03'
      const fcMicStart = fcPage.locator('button[aria-label="声で操作する"]')
      if ((await fcMicStart.count()) > 0) {
        await fcMicStart.click()
        await fcPage.waitForTimeout(400)
      }
      const fcHint = fcPage.locator('[data-testid="cook-session"] p', { hasText: ja.focus.micLabel }).first()
      if ((await fcHint.count()) > 0) {
        const fcHintText = await fcHint.innerText()
        check(
          'FC-03 読み上げの声の案内が「読み上げ」になっている（「もう一回」で案内しない）',
          fcHintText.includes(ja.focus.micHintRead) && !fcHintText.includes('もう一回'),
          fcHintText,
        )
        check(
          'FC-02 止めたタイマーを動かし直す声（「再開」）が案内に載っている',
          fcHintText.includes(ja.focus.micHintTimer),
          fcHintText,
        )
        // 2026-08-12 便FX（オーナー指摘「タイマー説明はまとめて、タイマー操作、のみでも
        // 最悪伝わるので、ストップで停止、のような個別説明はいらない」）:
        // タイマーの言葉は3つを1つにまとめ、1語ずつの説明は出さない
        check(
          'FX-02 タイマーの説明を1語ずつ並べない（言葉としては受け続ける）',
          !fcHintText.includes('で時間をはかる') &&
            !fcHintText.includes('で読み上げとタイマーを一時停止') &&
            !fcHintText.includes('で止めたタイマーを動かし直す') &&
            !fcHintText.includes('いったん止める'),
          fcHintText,
        )
      } else {
        check('FC-03 声の案内が画面に出ている', false, 'micHintが見つからない')
      }

      // --- FC-04: 閉じて開き直すと、前回閉じた手順から始まる ---
      currentCheck = 'FC-04'
      await fcNext(4)
      const fcResumeAt = await fcCounter()
      const fcResumeRecipe = await fcRecipe()
      await fcPage.locator('[data-testid="cook-session-close"]').click()
      await fcPage.waitForTimeout(700)
      check(
        'FC-04 ✕で全画面が閉じる（確認は出ない＝消えるものが無い）',
        (await fcPage.locator('[data-testid="cook-session"]').count()) === 0,
      )
      check(
        'FC-04 入口のボタンが「続きから」に変わる',
        (await fcPage.locator('[data-testid="cook-session-start"]').innerText()).includes(ja.cookNavi.sessionResume),
        await fcPage.locator('[data-testid="cook-session-start"]').innerText(),
      )
      const fcResumeHint = await fcPage.locator('[data-testid="cook-session-start-hint"]').innerText()
      check(
        'FC-04 どの手順から始まるかを、画面のバッジと同じ丸数字で添える',
        /前に開いていた手順[①-⑳㉑-㉟㊱-㊿]/.test(fcResumeHint),
        fcResumeHint,
      )
      // 読み込み直しても「閉じている」ままで、勝手に全画面が開かない
      await fcPage.reload({ waitUntil: 'networkidle' })
      await fcPage.waitForTimeout(1500)
      check(
        'FC-04 読み込み直しても閉じたまま（覚えているのは手順だけ）',
        (await fcPage.locator('[data-testid="cook-session"]').count()) === 0,
      )
      await fcOpenSession()
      check(
        'FC-04 開き直すと前回閉じた手順から始まる（①に戻らない）',
        (await fcCounter()) === fcResumeAt && (await fcRecipe()) === fcResumeRecipe,
        `閉じたとき=${fcResumeAt}/${fcResumeRecipe} 開き直し=${await fcCounter()}/${await fcRecipe()}`,
      )

      // --- FC-01: タイマーの窓の文言（「一時停止」と、消す操作の読み分け） ---
      currentCheck = 'FC-01'
      // 「15分煮る」の手順まで送って、本文の時間をタップしてタイマーを始める
      await fcToFirst.click()
      await fcPage.waitForTimeout(400)
      // 「煮る」を**いま開いている手順の本文**で探す。画面全体で探すと「他の品の次の手順」の行に
      // 当たって手前で止まり、そのあと押すタイマーが別の品のものになる（2026-08-15。
      // 手順を割る変更が入って実際に起きた）
      for (let i = 0; i < 20; i++) {
        if (/煮る/.test(await fcPage.locator('[data-testid="cook-session-step-text"]').innerText())) break
        await fcNext(1)
      }
      const fcTimerAt = await fcCounter()
      const fcTimerRecipe = await fcRecipe()
      // BudouX がゼロ幅スペースを差し込むので、突き合わせる前に必ず外す（CLAUDE.md 禁じ手②）
      const fcNoZw = (t) => (t ?? '').replace(/\u200B/g, '')
      /**
       * 本文どうしを突き合わせるときは、**空白と改行も外してから**比べる（CLAUDE.md 禁じ手②）。
       * 手順カードの本文には時間のボタンが埋まっていて innerText に改行が入るが、
       * 見るだけの窓はただの文字なので改行が入らない。同じ一文でも文字列としては一致しない
       * （2026-08-15。手順を割る変更のあとに実際に落ちた）
       */
      const fcFlat = (t) => fcNoZw(t).replace(/\s+/g, '')
      // タイマーを始めた手順の本文（あとで「見るだけ」の窓に出ているかを突き合わせる）
      const fcTimerText = fcNoZw(
        await fcPage.locator('[data-testid="cook-session-step-text"]').innerText(),
      ).trim()
      // **いま開いている手順の中**のタイマーを押す（画面のどこかにある最初のタイマーだと、
      // 他の品のものを押してしまい、上で控えた本文と食い違う）
      await fcPage
        .locator('[data-testid="cook-session-step-text"] button[aria-label*="タイマー開始"]')
        .first()
        .click()
      await fcPage.waitForTimeout(600)
      check(
        'FC-01 前提: 調理中モードでタイマーが動き出す',
        /\d\d:\d\d/.test(await fcPage.locator('[data-testid="cook-session-current-timers"]').innerText()),
        await fcPage.locator('[data-testid="cook-session-current-timers"]').innerText(),
      )
      await fcPage.locator('[data-testid="cook-session-current-timers"] button').first().click()
      await fcPage.waitForTimeout(400)
      const fcDialog = fcPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
      const fcButtons = await fcDialog.evaluate((dlg) =>
        Array.from(dlg.querySelectorAll('button')).map((b) => b.textContent.trim()),
      )
      check(
        'FC-01 「いったん止める」→「一時停止」になっている',
        fcButtons.includes('一時停止') && !fcButtons.some((t) => t.includes('いったん止める')),
        JSON.stringify(fcButtons),
      )
      check(
        'FC-01 並んでいる消す操作は「停止」ではなく「タイマーを消す」（読み分けが崩れない）',
        fcButtons.includes('タイマーを消す') && !fcButtons.includes('停止'),
        JSON.stringify(fcButtons),
      )
      // 一時停止→再開がこの窓の中で完結する（声の「再開」と同じ道筋）
      await fcPage.locator('[data-testid="timer-adjust-pause"]').click()
      await fcPage.waitForTimeout(400)
      check(
        'FC-01 一時停止すると、その場で「再開」に切り替わる（声の「再開」の受け皿）',
        (await fcPage.locator('[data-testid="timer-adjust-pause"]').innerText()).includes('再開'),
      )
      await fcPage.locator('[data-testid="timer-adjust-pause"]').click()
      await fcPage.waitForTimeout(400)

      // --- FC-05 / GQ-01・GQ-02: タイマーの手順は「見るだけ」で開く（現在地を動かさない） ---
      //   便FC のオーナー実機指示「調理中モードでスタートしたタイマーからの戻り先が、
      //   調理中モードの手順にしたい」＝**段取りの一覧ではなく全画面に着地する**は生かす。
      //   2026-08-15 便GQ・オーナー判断A案で変えたのは「現在地を、鳴ったタイマーの手順まで
      //   動かす」ところだけ。このアプリは「済んだ手順＝現在地より前」で数える（docs/69）ので、
      //   通り過ぎた手順のタイマーから開くと、そこまでの進み具合がまるごと巻き戻っていた。
      //
      //   測るのは**タイマーから手順を見たあとも、どこに居るかが変わっていないこと**。
      //   表示の文字を決め打ちで照合せず、見る前の見え方一式を控えて突き合わせる。
      currentCheck = 'FC-05'
      const fcGoStep = fcDialog.locator('[data-testid="timer-adjust-go-step"]')
      check(
        'FC-05 調理中モードのタイマーの窓から、その手順を開く道がある',
        (await fcGoStep.count()) === 1,
        await fcDialog.textContent(),
      )
      check(
        'GQ-01 その道は「見る」と名乗る（押しても現在地が動かないことが名前から分かる）',
        /見る$/.test(fcNoZw(await fcGoStep.innerText()).trim()),
        await fcGoStep.innerText(),
      )
      await fcPage.keyboard.press('Escape')
      await fcPage.waitForTimeout(300)

      // オーナーの再現手順: タイマーを始めた手順から「次へ」で先へ進む。
      // 何回進むかは段取りの長さ次第なので決め打ちせず、別の品の手順に届いたら止める
      // （上限は保険。CLAUDE.md「押す回数の決め打ち」を避ける）
      let fcAdvanced = 0
      for (let i = 0; i < 8; i++) {
        if ((await fcPage.locator('[data-testid="cook-session-next"]').count()) === 0) break
        await fcNext(1)
        fcAdvanced++
        if ((await fcRecipe()) !== fcTimerRecipe) break
      }
      check(
        'GQ-01 前提: タイマーを始めた手順より先へ進んでいる',
        fcAdvanced > 0 && (await fcCounter()) !== fcTimerAt,
        `タイマーの手順=${fcTimerAt} 進んだ先=${await fcCounter()}（${fcAdvanced}回）`,
      )

      /**
       * 「いま、どこに居るか」の見え方一式。段取りの中の位置・大きく出ている品と手順本文・
       * 他の品の次の手順（＝済んだ手順の裏返しの投影）をまとめて控える。
       * 巻き戻しが起きるとこのどれかが必ず変わる
       */
      const fcWhere = async () => ({
        counter: fcNoZw(await fcCounter()).trim(),
        recipe: fcNoZw(await fcRecipe()).trim(),
        step: fcNoZw(
          await fcPage.locator('[data-testid="cook-session-step-text"]').innerText(),
        ).trim(),
        others: (
          await fcPage.locator('[data-testid="cook-session-other-row"]').allInnerTexts()
        ).map((t) => fcNoZw(t).trim()),
      })
      const fcBeforePeek = await fcWhere()

      // 全画面の中のタイマーをタップ（画面上部でも「他の品の〜」の行でも、
      // どこに出ていても同じ操作になる形で掴む＝置き場所に固定しない）
      await fcPage
        .locator('[data-testid="cook-session"] button[aria-label*="タイマーを調整"]')
        .first()
        .click()
      await fcPage.waitForTimeout(400)
      await fcPage.locator('[data-testid="timer-adjust-go-step"]').click()
      await fcPage.waitForTimeout(600)
      const fcPeek = fcPage.locator('[data-testid="cook-session-timer-peek"]')
      check('GQ-01 タイマーの手順が読める窓が出る', (await fcPeek.count()) === 1)
      check(
        'GQ-01 窓に出るのは、そのタイマーを始めた手順の本文',
        fcFlat(await fcPage.locator('[data-testid="cook-session-timer-peek-text"]').innerText()) ===
          fcFlat(fcTimerText),
        `窓=${fcNoZw(await fcPage.locator('[data-testid="cook-session-timer-peek-text"]').innerText()).trim()} / タイマーの手順=${fcTimerText}`,
      )
      check(
        'GQ-01 窓を開いても、いる場所は1つも動かない（進み具合が巻き戻らない）',
        JSON.stringify(await fcWhere()) === JSON.stringify(fcBeforePeek),
        `見る前=${JSON.stringify(fcBeforePeek)} 見た後=${JSON.stringify(await fcWhere())}`,
      )
      check(
        'GQ-01 閉じたあとに帰る場所を、窓の中で番号で名乗る',
        fcNoZw(
          await fcPage.locator('[data-testid="cook-session-timer-peek-close"]').innerText(),
        ).includes(fcBeforePeek.counter),
        `${await fcPage.locator('[data-testid="cook-session-timer-peek-close"]').innerText()} / いる場所=${fcBeforePeek.counter}`,
      )
      await fcPage.locator('[data-testid="cook-session-timer-peek-close"]').click()
      await fcPage.waitForTimeout(400)
      check(
        'GQ-01 閉じると、見る前と同じ手順にそのまま居る',
        (await fcPeek.count()) === 0 &&
          JSON.stringify(await fcWhere()) === JSON.stringify(fcBeforePeek),
        `見る前=${JSON.stringify(fcBeforePeek)} 閉じた後=${JSON.stringify(await fcWhere())}`,
      )

      // --- GQ-02: 別の場所（常駐タイマーバー）から開いても同じ ---
      //   全画面を閉じている間にタイマーを押したときも、着地は全画面の調理中モード（便FC）で、
      //   現在地はそのまま。ここが以前は setCurrent でカーソルごと引き戻していた
      currentCheck = 'GQ-02'
      const fcBeforeBar = await fcWhere()
      await fcPage.locator('[data-testid="cook-session-close"]').click()
      await fcPage.waitForTimeout(700)
      check(
        'GQ-02 前提: 調理中モードを閉じると常駐タイマーバーが見える',
        (await fcPage.locator('button[aria-label*="タイマーを調整"]').count()) > 0,
      )
      await fcPage.locator('button[aria-label*="タイマーを調整"]').first().click()
      await fcPage.waitForTimeout(400)
      const fcBarGoStep = fcPage.locator('[data-testid="timer-adjust-go-step"]')
      check(
        'GQ-02 常駐バーの窓でも「見る」と名乗る（調理の途中だから現在地は動かない）',
        /見る$/.test(fcNoZw(await fcBarGoStep.innerText()).trim()),
        await fcBarGoStep.innerText(),
      )
      await fcBarGoStep.click()
      await fcPage.waitForTimeout(1200)
      check(
        'FC-05 タイマーから戻ると、段取りの一覧ではなく調理中モードが開く',
        (await fcPage.locator('[data-testid="cook-session"]').count()) === 1,
      )
      check(
        'GQ-02 戻り先は閉じたときと同じ手順（タイマーの手順まで引き戻されない）',
        JSON.stringify(await fcWhere()) === JSON.stringify(fcBeforeBar),
        `閉じたとき=${JSON.stringify(fcBeforeBar)} 戻り先=${JSON.stringify(await fcWhere())}`,
      )
      check(
        'GQ-02 そのタイマーの手順は、見るだけの窓で読める',
        (await fcPage.locator('[data-testid="cook-session-timer-peek"]').count()) === 1 &&
          fcFlat(
            await fcPage.locator('[data-testid="cook-session-timer-peek-text"]').innerText(),
          ) === fcFlat(fcTimerText),
        fcNoZw(
          await fcPage
            .locator('[data-testid="cook-session-timer-peek-text"]')
            .innerText()
            .catch(() => 'なし'),
        ).trim(),
      )
      await fcPage.locator('[data-testid="cook-session-timer-peek-close"]').click()
      await fcPage.waitForTimeout(400)

      // 戻ったあとに手順を動かせること（2026-08-10 便FCで実際に踏んだ不具合の再発防止）。
      // 全画面を開くのと同じ処理の中で ?focusStep= を消すと、画面遷移の仕組みだけが古いURLを
      // 握り続け、カーソルが動くたびに同じ手順へ引き戻されて「次へが効かない」状態になった
      const fcAfterReturn = await fcCounter()
      await fcNext(1)
      check(
        'FC-05 タイマーから戻ったあとも「次へ」で手順が進む（同じ手順に引き戻されない）',
        (await fcCounter()) !== fcAfterReturn,
        `戻り先=${fcAfterReturn} 次へ=${await fcCounter()}`,
      )
      await fcPage.getByRole('button', { name: ja.focus.prev }).click()
      await fcPage.waitForTimeout(300)

      // --- FC-08: 他の品の次の手順を開いたら、その品のタイマーは手順の下に来る ---
      currentCheck = 'FC-08'
      for (let i = 0; i < 12 && (await fcRecipe()) === fcTimerRecipe; i++) await fcNext(1)
      check(
        'FC-08 前提: 別の品の手順に移り、タイマーは「他の品の次の手順」の行に付く',
        (await fcPage.locator('[data-testid="cook-session-other-timers"]').count()) === 1,
        await fcPage.locator('[data-testid="cook-session-others"]').innerText(),
      )
      const fcTimerRow = fcPage
        .locator('[data-testid="cook-session-others"] > div')
        .filter({ has: fcPage.locator('[data-testid="cook-session-other-timers"]') })
      await fcTimerRow.locator('[data-testid="cook-session-other-row"]').click()
      await fcPage.waitForTimeout(700)
      const fcPeekBox = await fcPage.locator('[data-testid="cook-session-peek"]').boundingBox()
      const fcRowTimerBox = await fcPage.locator('[data-testid="cook-session-other-timers"]').boundingBox()
      check(
        'FC-08 開いた手順の全文より下にタイマーが来る',
        fcPeekBox != null && fcRowTimerBox != null && fcRowTimerBox.y >= fcPeekBox.y + fcPeekBox.height - 2,
        JSON.stringify({ peek: fcPeekBox, timer: fcRowTimerBox }),
      )
      await fcTimerRow.locator('[data-testid="cook-session-other-row"]').click()
      await fcPage.waitForTimeout(500)

      // --- FC-07: 作り終えた品は、料理名の横に「完成」で1行（コンパクト） ---
      currentCheck = 'FC-07'
      for (let i = 0; i < 40; i++) {
        if ((await fcPage.locator('[data-testid="cook-session-finish"]').count()) > 0) break
        await fcNext(1)
      }
      const fcOthersText = await fcPage.locator('[data-testid="cook-session-others"]').innerText()
      check(
        'FC-07 作り終えた品は「完成」で示す（「作り終えました」の文は出さない）',
        (await fcPage.locator('[data-testid="cook-session-other-done"]').count()) === 2 &&
          !fcOthersText.includes('作り終えました'),
        fcOthersText,
      )
      const fcDoneGeom = await fcPage.evaluate(() => {
        const row = document.querySelector('[data-testid="cook-session-other-row"]')
        const chip = document.querySelector('[data-testid="cook-session-other-done"]')
        if (!row || !chip) return null
        const title = row.querySelector('span > span.truncate')
        const r = row.getBoundingClientRect()
        const c = chip.getBoundingClientRect()
        const t = title ? title.getBoundingClientRect() : null
        return { rowHeight: r.height, chipMid: c.top + c.height / 2, titleMid: t ? t.top + t.height / 2 : null }
      })
      check(
        'FC-07 料理名と「完成」が同じ行に並ぶ（1列になる）',
        fcDoneGeom != null && fcDoneGeom.titleMid != null &&
          Math.abs(fcDoneGeom.chipMid - fcDoneGeom.titleMid) < 6,
        JSON.stringify(fcDoneGeom),
      )
      check(
        'FC-07 終わった品の行はコンパクト（2行ぶんの高さを取らない）',
        fcDoneGeom != null && fcDoneGeom.rowHeight <= 34,
        JSON.stringify(fcDoneGeom),
      )
    } finally {
      await fcBrowser.close()
    }
  }
