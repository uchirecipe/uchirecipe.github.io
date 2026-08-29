// ==========================================================================================
// e2e の節: 設定のトースト・記録と写真・栄養(Pro)・解錠・今日の献立
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
// この中の節: TOAST-01, STARTER-RELOAD-01, SCROLL-01, IPAD-01, LOG-01, MODALX-01, SCROLLLOCK-02, LOG-PHOTO-01, NUT-02, NUTSORT-02, UNLOCK-01, TOPUP-01, ORPHAN-01, TODAYALL-01, TODAYUNDO-01, PLANUNDO-01, DAYORG-01
// ==========================================================================================
import './_shared.mjs'

  // --- TOAST-01: 設定操作の結果メッセージがトーストで表示され、数秒で自動的に消える
  // (2026-07-12オーナー実機フィードバック。以前はページ最上部固定でスクロールしないと見えなかった。
  // 自動非表示は2026-07-13 UIペルソナQAで4.5秒→6秒に延長) ---
  currentCheck = 'TOAST-01'
  await page.getByRole('button', { name: ja.settings.tabBasic, exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder(ja.settings.ngPlaceholder).fill('E2Eトースト確認食材')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'TOAST-01 NG食材追加でトーストが表示される',
    (await page.textContent('body')).includes('「E2Eトースト確認食材」を追加しました'),
  )
  check(
    'NGCOUNT-01 登録後は見出し行が「1件」表示になる(2026-07-17設定ゼロベース裁定#2)',
    (await page.textContent('body')).includes('1件'),
  )
  await page.waitForTimeout(6800) // Toastの自動非表示(AUTO_DISMISS_MS=6000ms)を超えて待つ
  check(
    'TOAST-01 トーストは数秒で自動的に消える',
    !(await page.textContent('body')).includes('「E2Eトースト確認食材」を追加しました'),
  )

  // --- STARTER-RELOAD-01: 「基本レシピを入れ直す」でユーザーデータが保持されること
  // (2026-07-13 Fable設計。従来は削除→再追加のため、基本レシピに付けたお気に入り・作った記録・
  // 写真・編集がすべて消えていた。同じtitleの基本レシピは内容だけ新版に差し替え、
  // お気に入り等は保持する方式に改修) ---
  currentCheck = 'STARTER-RELOAD-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: ja.detail.favoriteOn }).click()
  await page.waitForTimeout(300)
  check(
    'STARTER-RELOAD-01 肉じゃがをお気に入りに追加できる',
    await page.getByRole('button', { name: ja.detail.favoriteOff }).isVisible(),
  )

  await page.goto(`${BASE}/#/settings?section=recipe`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: ja.settings.starterReload, exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し完了のトーストが表示される',
    stripZwspText(await page.textContent('body')).includes(ja.settings.starterReloadDone),
  )

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し後もお気に入りのまま(ユーザーデータ保持)',
    await page.getByRole('button', { name: ja.detail.favoriteOff }).isVisible(),
  )

  // --- SCROLL-01: 一覧のスクロール位置復元(iPhone SE2実機フィードバック 2026-07-11)。
  // 「詳細→戻る→スクロール位置が復元される」を、iOS Safari相当のwebkitエンジン+
  // iPhone SEのビューポート(375x667)で検証する(実機の不具合はwebkit固有の挙動だったため)。
  // 他のチェックと違うブラウザエンジンを使うので、ここだけ専用のbrowser/contextを開閉する ---
  currentCheck = 'SCROLL-01'
  {
    const wkBrowser = await webkit.launch()
    const wkContext = await wkBrowser.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage = await wkContext.newPage()
    wkPage.on('pageerror', (err) => {
      // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ。
      // webkitではconsoleではなくpageerrorとして表面化するため、こちらでも同様に除外する
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SCROLL-01] ${err.message}`)
    })
    try {
      await wkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage.evaluate(() => window.scrollTo(0, 500))
      await wkPage.waitForTimeout(400) // スクロール位置保存(rAFスロットル)の反映待ち
      const scrollBefore = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 事前条件: 一覧がスクロールできている(iPhone SE相当)',
        scrollBefore > 100,
        `scrollY=${scrollBefore}`,
      )
      // Playwrightの.click()は要素を可視範囲へ自動スクロールしてしまい、テスト対象の
      // スクロール位置そのものを壊してしまうため、DOMのclick()を直接呼ぶ
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check('SCROLL-01 詳細へ遷移', /#\/recipes\/\d+/.test(wkPage.url()), `現在URL: ${wkPage.url()}`)
      await wkPage.getByRole('button', { name: ja.common.back }).click()
      await wkPage.waitForTimeout(800)
      const scrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細→戻るで一覧のスクロール位置が復元される(iPhone SE 375x667・webkit)',
        Math.abs(scrollAfter - scrollBefore) < 60,
        `復元前=${scrollBefore} 復元後=${scrollAfter}`,
      )

      // --- 滞在時間バリエーション(2026-07-12深夜フィードバック「一定時間以上詳細画面に
      // いたとき一覧の位置がリセットされる感じ」の再現・再発防止ケース)。再調査の結果、
      // 実際のトリガーは滞在時間そのものではなく「離脱時に絞り込み条件が既定値でなかったこと」
      // だったが(下のSCROLL-02で別途固定)、時間経過そのものが無関係であることも
      // 恒久的に保証しておくため、実際に60秒待ってから戻る経路もここで検証する ---
      await wkPage.evaluate(() => window.scrollTo(0, 400))
      await wkPage.waitForTimeout(400)
      const longScrollBefore = await wkPage.evaluate(() => window.scrollY)
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check(
        'SCROLL-01 (滞在60秒) 詳細へ遷移',
        /#\/recipes\/\d+/.test(wkPage.url()),
        `現在URL: ${wkPage.url()}`,
      )
      await wkPage.waitForTimeout(60000) // 詳細画面に実際に60秒滞在する
      await wkPage.getByRole('button', { name: ja.common.back }).click()
      await wkPage.waitForTimeout(800)
      const longScrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細に60秒滞在してから戻ってもスクロール位置が復元される',
        Math.abs(longScrollAfter - longScrollBefore) < 60,
        `復元前=${longScrollBefore} 復元後=${longScrollAfter}`,
      )
    } finally {
      await wkBrowser.close()
    }
  }

  // --- IPAD-01: iPadで「戻る」ヘッダーがマルチタスク操作ボタンに被らない
  // (オーナー実機フィードバック 2026-07-12: 「iPadから表示すると、画面サイズボタンと
  // 『戻る』ボタンが被る」→ iPad判定(:root.is-ipad)で上部に余白を足す対策の配線検証)。
  // PlaywrightのiPadエミュレーションはmaxTouchPoints=0を返すため、検出値は注入する
  // (検出式→クラス付与→CSS余白、の配線が壊れたら落ちる回帰テスト) ---
  currentCheck = 'IPAD-01'
  {
    const ipadBrowser = await webkit.launch()
    const ipadCtx = await ipadBrowser.newContext({
      viewport: { width: 820, height: 1180 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    })
    const ipadPage = await ipadCtx.newPage()
    await ipadPage.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 })
    })
    try {
      await ipadPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ipadPage.waitForTimeout(1800)
      check(
        'IPAD-01 iPad判定クラスが:rootに付く',
        await ipadPage.evaluate(() => document.documentElement.classList.contains('is-ipad')),
      )
      await ipadPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await ipadPage.waitForTimeout(600)
      const padTop = await ipadPage.evaluate(() => {
        const h = document.querySelector('.back-header')
        return h ? parseFloat(getComputedStyle(h).paddingTop) : -1
      })
      check('IPAD-01 戻るヘッダーに上部余白が付く(22px+)', padTop >= 22, `paddingTop=${padTop}`)
    } finally {
      await ipadBrowser.close()
    }
  }
  // 逆条件: 通常のスマホ(iPhone SE2相当)ではiPad用の余白が付かないこと(LOG-01のページで検証)

  // --- LOG-01: 「作った！」記録フォームの窓表示化(オーナー実機フィードバック 2026-07-12。
  // 「『作った！』の位置が最下層のため、押下すると画面全体の表示が動いて見づらい」
  // 「『作った！』の日付入力のバーの大きさが、はみだしている」の再発防止)。
  // ・押下前後でページのスクロール位置(window.scrollY)が変わらない(以前はインライン展開で
  //   scrollIntoViewが走り、レイアウトごと動いていた)
  // ・<input type="date">がiPhone SE2相当(375x667・webkit)の画面幅からはみ出さない
  // ・保存すると記録が一覧に反映される(既存の記録保存ロジックが壊れていないことの確認)
  currentCheck = 'LOG-01'
  {
    const wkBrowser2 = await webkit.launch()
    const wkContext2 = await wkBrowser2.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage2 = await wkContext2.newPage()
    wkPage2.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-01] ${err.message}`)
    })
    try {
      await wkPage2.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage2.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage2.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage2.waitForTimeout(600)
      await wkPage2.evaluate(() => window.scrollTo(0, 200))
      await wkPage2.waitForTimeout(300)
      // 2026-08-16 便HE: 窓が開いている間は後ろの画面を固定する（iOSは overflow:hidden では止まらないので
      // 本体を position:fixed にする）。この作りでは `window.scrollY` は 0 になるが、**見た目は1pxも動かない**。
      // 測りたいのは「**開いてもページの見た目が動かない**」ことなので、
      // 数字ではなく**画面の中の実際の位置**（見出しがどこに見えているか）で見る（CLAUDE.md 禁じ手④）
      // **同じ要素を測り続ける**こと（窓を開くとDOMが増えるので、その場で探すと
      // 別の要素を掴んで「動いた」ように見える。2026-08-16に実際に踏んだ）
      await wkPage2.evaluate(() => {
        const h = document.querySelector('main h1, main h2')
        if (h) h.setAttribute('data-e2e-anchor', '1')
      })
      const seenTop = () =>
        wkPage2.evaluate(() => {
          const h = document.querySelector('[data-e2e-anchor="1"]')
          return h ? Math.round(h.getBoundingClientRect().top) : null
        })
      const scrollBeforeOpen = await seenTop()
      // 「作った！」はページ最下部のボタンなので、Playwrightの.click()に任せると
      // 可視範囲へ自動スクロールしてしまい検証したいスクロール位置そのものを壊す(SCROLL-01と同じ理由)。
      // DOMのclick()を直接呼んでスクロールを発生させない
      await wkPage2.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await wkPage2.waitForTimeout(400)
      const dialogText = await wkPage2.textContent('body')
      check('LOG-01 「作った！」で窓(モーダル)が開く', dialogText.includes('作った記録をつける'))
      const scrollAfterOpen = await seenTop()
      check(
        'LOG-01 窓を開いてもページの見た目が動かない',
        scrollBeforeOpen != null && Math.abs(scrollAfterOpen - scrollBeforeOpen) <= 1,
        `開く前=${scrollBeforeOpen} 開いた後=${scrollAfterOpen}（画面の中の位置）`,
      )
      const dateBox = await wkPage2.locator('input[type="date"]').boundingBox()
      check(
        'LOG-01 日付入力が画面幅(375px)からはみ出さない',
        !!dateBox && dateBox.x >= 0 && dateBox.x + dateBox.width <= 375,
        `x=${dateBox?.x} width=${dateBox?.width}`,
      )
      // 窓(モーダル)の保存ボタンは「記録する」(過去記録を後から編集するときの「保存する」とは別物)
      await wkPage2.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await wkPage2.waitForTimeout(500)
      const savedText = await wkPage2.textContent('body')
      check('LOG-01 保存すると「作った記録」に反映される', savedText.includes('作った記録'))
    } finally {
      await wkBrowser2.close()
    }
  }

  // --- MODALX-01: 「作った記録をつける」の窓を、横には動かせない(2026-08-16 便HD)。
  // オーナー実機 iPhone SE2/Safari「作った！の窓の中の情報量が多すぎて、縦横にスクロールできる
  // 状態でした。写真はわかりやすいように右下を表示したものなので、余白や見出しもちゃんとありました」。
  //
  // なぜ**Safariの描画エンジン(webkit)で**測るか: 原因の一つ(src/index.css の
  // hanging-punctuation: allow-end による行末約物のぶら下げ)は**Safari系しか実装していない**。
  // Chromiumでは何も起きないので、Chromiumだけで測っても永久に気づけない。
  //
  // 測るのは2つ:
  //  ① いまの中身が窓より広くなっていないこと(はみ出しそのもの)
  //  ② **窓より広いものが入っても横には動かないこと**(窓の作りとしての保証)。
  //     ①だけでは、実機でしか出ない字形の差でまた横に動く状態に戻っても気づけない。
  //     ②は中身に何を入れても成り立つので、窓の中身が増えても勝手に守られる
  currentCheck = 'MODALX-01'
  {
    const mxBrowser = await webkit.launch()
    try {
      // 高さの低い画面(Safariのアドレスバーぶん低い場合)も含めて見る
      for (const size of [
        { width: 375, height: 667 },
        { width: 320, height: 568 },
      ]) {
        const mxContext = await mxBrowser.newContext({ viewport: size })
        const mxPage = await mxContext.newPage()
        mxPage.on('pageerror', (err) => {
          if (
            err.message.includes('cloudflareinsights') ||
            err.message.includes('Access-Control-Allow-Origin')
          )
            return
          errors.push(`[pageerror@MODALX-01] ${err.message}`)
        })
        try {
          await mxPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await mxPage.waitForTimeout(1800) // 初回シード完了待ち
          await mxPage.evaluate(() => {
            const link = document.querySelector('a[href^="#/recipes/"]')
            if (link instanceof HTMLElement) link.click()
          })
          await mxPage.waitForTimeout(600)
          await mxPage.evaluate(() => {
            const btn = Array.from(document.querySelectorAll('button')).find(
              (b) => b.textContent?.trim() === '作った！',
            )
            if (btn instanceof HTMLElement) btn.click()
          })
          await mxPage.waitForTimeout(400)
          const widthOver = await mxPage.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')
            return dialog ? dialog.scrollWidth - dialog.clientWidth : null
          })
          check(
            `MODALX-01 (${size.width}x${size.height}) 窓の中身が窓より広くない`,
            widthOver !== null && widthOver <= 0,
            `scrollWidth-clientWidth=${widthOver}`,
          )
          // 窓より広いものを一時的に入れてから、**実際に横へ払う操作**をして動かないことを見る。
          // 実機でだけ出るはみ出し(Safariの行末約物のぶら下げ)は手元では作れないので、
          // 「はみ出しが起きたらどうなるか」を窓の側で押さえる。
          // scrollLeft に直接代入する形では測れない(横に動かせない指定でも代入だけは通るため)
          await mxPage.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')
            const probe = document.createElement('div')
            probe.dataset.e2eWideProbe = '1'
            probe.style.width = '3000px'
            probe.style.height = '1px'
            dialog?.appendChild(probe)
            if (dialog) dialog.scrollLeft = 0
          })
          const dialogBox = await mxPage.locator('[role="dialog"]').boundingBox()
          await mxPage.mouse.move(
            dialogBox.x + dialogBox.width / 2,
            dialogBox.y + dialogBox.height / 2,
          )
          await mxPage.mouse.wheel(300, 0)
          await mxPage.waitForTimeout(300)
          const movedSideways = await mxPage.evaluate(() => {
            const dialog = document.querySelector('[role="dialog"]')
            const moved = dialog?.scrollLeft ?? null
            document.querySelector('[data-e2e-wide-probe]')?.remove()
            return moved
          })
          check(
            `MODALX-01 (${size.width}x${size.height}) 窓より広いものが入っても、横に払っても動かない`,
            movedSideways === 0,
            `横に払ったあとの位置=${movedSideways}`,
          )
        } finally {
          await mxContext.close()
        }
      }
    } finally {
      await mxBrowser.close()
    }
  }

  // --- SCROLLLOCK-02: 窓の中を送るつもりが、後ろの画面が動く
  // (2026-08-16 便HE・オーナー実機 iPhone SE2/Safari
  // 「窓内を縦にスクロールするつもりが、後ろの画面が動いてしまうことがあります」)。
  //
  // なぜ**Safariの描画エンジン(webkit)で**測るか: 便HEが直す前に測った実測値は
  // Chromiumではなくwebkitで取ったもので、後ろの画面が動く2つの経路が両方出た(375x667):
  //  ・A 窓の外側(暗い背景)の上で400px払う → 後ろの画面が400px動いた
  //  ・B 窓の中を下端まで送ってからさらに600px払う → 後ろの画面が600px動いた(送りが外へ移る)
  //  ・結果、閉じたときの着地点が 400 → 1400 とまるで違う場所になった
  // 「ことがあります」＝いつも起きるわけではない、の正体はBで、窓の中の余りが尽きた瞬間から
  // 後ろへ移るため、中身が短い窓・下端まで送っていないときは起きない。
  //
  // 測るのは「後ろの画面が見た目で動いていないか」。窓を開いているあいだ window.scrollY は
  // 0 に固定されるので、その数値ではなく**後ろの要素が画面のどこに見えているか**で見る。
  currentCheck = 'SCROLLLOCK-02'
  {
    const slBrowser = await webkit.launch()
    try {
      const slContext = await slBrowser.newContext({ viewport: { width: 375, height: 667 } })
      const slPage = await slContext.newPage()
      slPage.on('pageerror', (err) => {
        if (
          err.message.includes('cloudflareinsights') ||
          err.message.includes('Access-Control-Allow-Origin')
        )
          return
        errors.push(`[pageerror@SCROLLLOCK-02] ${err.message}`)
      })
      try {
        await slPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await slPage.waitForTimeout(1800) // 初回シード完了待ち
        await slPage.evaluate(() => {
          const link = document.querySelector('a[href^="#/recipes/"]')
          if (link instanceof HTMLElement) link.click()
        })
        await slPage.waitForTimeout(700)
        // 送る位置は画面の長さから決める(決め打ちの数値にしない)
        await slPage.evaluate(() => {
          const reachable = document.documentElement.scrollHeight - window.innerHeight
          window.scrollTo(0, Math.round(Math.min(reachable, window.innerHeight) / 2))
        })
        await slPage.waitForTimeout(300)
        const slBefore = await slPage.evaluate(() => ({
          y: window.scrollY,
          mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
        }))
        check(
          'SCROLLLOCK-02 前提: 窓を開く前にレシピ詳細を途中まで送れている',
          slBefore.y > 0,
          JSON.stringify(slBefore),
        )
        await slPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === '作った！',
          )
          if (btn instanceof HTMLElement) btn.click()
        })
        await slPage.waitForTimeout(500)

        // A: 窓の外側(暗い背景)の上で払う。払う場所は窓の実際の位置から決める
        // (窓の高さは中身しだいで変わるので、決め打ちの座標にすると窓の中を払ってしまう)
        const slDialogBox = await slPage.locator('[role="dialog"]').boundingBox()
        const slBackdropY = Math.max(2, Math.round(slDialogBox.y / 2))
        check(
          'SCROLLLOCK-02 前提: 窓の外側(暗い背景)を払える隙間がある',
          slDialogBox.y >= 4,
          JSON.stringify({ dialogTop: slDialogBox.y, backdropY: slBackdropY }),
        )
        await slPage.mouse.move(
          Math.round(slDialogBox.x + slDialogBox.width / 2),
          slBackdropY,
        )
        await slPage.mouse.wheel(0, 400)
        await slPage.waitForTimeout(400)
        const slAfterBackdrop = await slPage.evaluate(() =>
          Math.round(document.querySelector('main').getBoundingClientRect().top),
        )
        check(
          'SCROLLLOCK-02 窓の外側を払っても、後ろのレシピ詳細は動かない',
          slAfterBackdrop === slBefore.mainTop,
          JSON.stringify({ before: slBefore.mainTop, after: slAfterBackdrop }),
        )

        // B: 窓の中を下端まで送ってから、さらに払う(送りが後ろへ移らないこと)。
        // 中身の量に関わらず成り立つよう、まず「窓より高いもの」をその場で入れて
        // 必ず送れる状態にしてから下端まで送る(中身が増減しても同じ判定になる形)
        const slBox = slDialogBox
        await slPage.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]')
          const probe = document.createElement('div')
          probe.dataset.e2eTallProbe = '1'
          probe.style.height = '2000px'
          dialog?.appendChild(probe)
          if (dialog) dialog.scrollTop = dialog.scrollHeight
        })
        await slPage.waitForTimeout(200)
        const slAtEnd = await slPage.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]')
          return dialog.scrollTop >= dialog.scrollHeight - dialog.clientHeight - 1
        })
        check('SCROLLLOCK-02 前提: 窓の中を下端まで送れている', slAtEnd)
        if (slBox) {
          await slPage.mouse.move(slBox.x + slBox.width / 2, slBox.y + slBox.height / 2)
          await slPage.mouse.wheel(0, 600)
          await slPage.waitForTimeout(400)
        }
        const slAfterChain = await slPage.evaluate(() => {
          const top = Math.round(document.querySelector('main').getBoundingClientRect().top)
          document.querySelector('[data-e2e-tall-probe]')?.remove()
          return top
        })
        check(
          'SCROLLLOCK-02 窓の中を端まで送ったあとさらに送っても、後ろへ移らない',
          slAfterChain === slBefore.mainTop,
          JSON.stringify({ before: slBefore.mainTop, after: slAfterChain }),
        )

        // C: 閉じたら、開く前に見ていた位置に戻る
        await slPage.evaluate(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(
            (b) => b.textContent?.trim() === 'やめる',
          )
          if (btn instanceof HTMLElement) btn.click()
        })
        await slPage.waitForTimeout(600)
        const slAfterClose = await slPage.evaluate(() => ({
          y: window.scrollY,
          mainTop: Math.round(document.querySelector('main').getBoundingClientRect().top),
          bodyPosition: getComputedStyle(document.body).position,
        }))
        check(
          'SCROLLLOCK-02 窓を閉じたら、開く前に見ていた位置に戻っている',
          slAfterClose.y === slBefore.y &&
            slAfterClose.mainTop === slBefore.mainTop &&
            slAfterClose.bodyPosition !== 'fixed',
          JSON.stringify({ before: slBefore, after: slAfterClose }),
        )
      } finally {
        await slContext.close()
      }
    } finally {
      await slBrowser.close()
    }
  }

  // --- LOG-PHOTO-01: 「作った！」記録への写真添付(2026-07-12・docs/20 §4)。
  // ・写真を選ぶと窓(CookedLogModal)内にプレビューが出て、保存すると記録一覧に64pxサムネイルが出る
  // ・サムネイルをタップすると原寸表示の窓が開く
  // ・記録フォームを開いた時点の表示人数(スケール後)がcookedLogs[].servingsに自動記録される
  // ・圧縮後の写真がcookedLogs[].photoとしてIndexedDBに実際に保存されている(Blobで実サイズ>0) ---
  currentCheck = 'LOG-PHOTO-01'
  {
    // 1x1の最小PNG(透明ドット)。resizePhoto(createImageBitmap→canvas.toBlob)が
    // 実際にデコードできる本物の画像である必要があるため、テキストダミーではなくPNGを使う
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const photoBrowser = await chromium.launch()
    const photoContext = await photoBrowser.newContext()
    const photoPage = await photoContext.newPage()
    photoPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-PHOTO-01] ${err.message}`)
    })
    try {
      await photoPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await photoPage.waitForTimeout(1800) // 初回シード完了待ち
      await photoPage.getByText('肉じゃが', { exact: true }).first().click()
      await photoPage.waitForTimeout(600)

      // 表示人数を既定から1つ増やしてから記録を開く(自動記録される人数がこの値と一致するか確認するため)
      const servingsBefore = await photoPage.locator('span.min-w-14').textContent()
      const servingsBeforeNum = Number((servingsBefore ?? '').match(/\d+/)?.[0])
      await photoPage.locator(`button[aria-label="${ja.detail.servingsUp}"]`).click()
      await photoPage.waitForTimeout(300)
      const expectedServings = servingsBeforeNum + 1

      await photoPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await photoPage.waitForTimeout(400)

      // 「アルバムから選ぶ」用のinput(capture属性が無い方)にテスト画像を投入する
      await photoPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: tinyPng })
      await photoPage.waitForTimeout(500)
      const previewVisible = await photoPage
        .locator('div[role="dialog"] img')
        .first()
        .isVisible()
        .catch(() => false)
      check('LOG-PHOTO-01 写真を選ぶと窓内にプレビューが出る', previewVisible)

      await photoPage.getByRole('button', { name: ja.detail.cookedSave, exact: true }).click()
      await photoPage.waitForTimeout(500)
      const thumbButton = photoPage.locator(`button[aria-label="${ja.detail.cookedPhotoView}"]`).first()
      check('LOG-PHOTO-01 保存すると記録一覧にサムネイルが出る', await thumbButton.isVisible())

      await thumbButton.click()
      await photoPage.waitForTimeout(300)
      const viewerVisible = await photoPage
        .locator(`div[role="dialog"][aria-label="${ja.detail.cookedPhotoView}"]`)
        .isVisible()
        .catch(() => false)
      check('LOG-PHOTO-01 サムネイルをタップすると原寸表示の窓が開く', viewerVisible)
      await photoPage.keyboard.press('Escape')
      await photoPage.waitForTimeout(300)
      const viewerClosed = !(await photoPage
        .locator(`div[role="dialog"][aria-label="${ja.detail.cookedPhotoView}"]`)
        .isVisible()
        .catch(() => false))
      check('LOG-PHOTO-01 Escapeで原寸表示の窓が閉じる', viewerClosed)

      // IndexedDBを直接読み、圧縮後の写真Blobと自動記録された人数が実際に保存されていることを確認する
      const url = photoPage.url()
      const recipeId = Number(url.match(/#\/recipes\/(\d+)/)?.[1])
      const savedLog = await photoPage.evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getReq = tx.objectStore('recipes').get(id)
              getReq.onsuccess = () => {
                const recipe = getReq.result
                const log = recipe?.cookedLogs?.[0]
                resolve(
                  log
                    ? { hasPhoto: log.photo instanceof Blob, photoSize: log.photo?.size ?? 0, servings: log.servings }
                    : null,
                )
              }
              getReq.onerror = () => reject(getReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        recipeId,
      )
      check(
        'LOG-PHOTO-01 保存された記録に圧縮後の写真Blob(実サイズ>0)が入っている',
        !!savedLog?.hasPhoto && savedLog.photoSize > 0,
        `savedLog=${JSON.stringify(savedLog)}`,
      )
      check(
        'LOG-PHOTO-01 記録フォームを開いた時点の表示人数が自動記録される',
        savedLog?.servings === expectedServings,
        `期待=${expectedServings} 実際=${savedLog?.servings}`,
      )

      // --- LOG-EDIT-PHOTO-01(2026-07-16 便W-①): 既存記録の編集フローからも写真の削除・
      // 追加(差し替え)ができること(新規作成時のCookedLogModalと同じ保存形式)。直前に
      // 作った写真付きの記録(index 0)を使い、削除→保存→サムネ消滅、再度編集で追加→保存→
      // サムネ再出現、の一往復を確認する ---
      await photoPage.locator(`button[aria-label="${ja.detail.cookedLogEdit}"]`).first().click()
      await photoPage.waitForTimeout(300)
      const removePhotoBtn = photoPage.getByRole('button', { name: ja.detail.cookedLogPhotoRemove })
      check('LOG-EDIT-PHOTO-01 編集を開くと既存の写真の削除ボタンが出る', await removePhotoBtn.isVisible())
      await removePhotoBtn.click()
      await photoPage.waitForTimeout(200)
      check(
        'LOG-EDIT-PHOTO-01 削除すると削除ボタン自体も消える(未選択状態になる)',
        !(await removePhotoBtn.isVisible().catch(() => false)),
      )
      await photoPage.getByRole('button', { name: '保存する', exact: true }).click()
      await photoPage.waitForTimeout(400)
      check(
        'LOG-EDIT-PHOTO-01 削除して保存すると記録一覧のサムネイルが消える',
        (await photoPage.locator(`button[aria-label="${ja.detail.cookedPhotoView}"]`).count()) === 0,
      )

      // 再度編集を開き、今度はアルバムから新しい写真を選んで追加(差し替え)する
      await photoPage.locator(`button[aria-label="${ja.detail.cookedLogEdit}"]`).first().click()
      await photoPage.waitForTimeout(300)
      await photoPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test2.png', mimeType: 'image/png', buffer: tinyPng })
      // 画像はresizePhoto(canvas圧縮)を経由して非同期にstateへ入るため、固定500msでは
      // スイート負荷時に間に合わないことがある(単体では動作確認済み)。出現をポーリング待ちにする
      const reAddRemoveBtn = photoPage.getByRole('button', { name: ja.detail.cookedLogPhotoRemove })
      await reAddRemoveBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
      check(
        'LOG-EDIT-PHOTO-01 編集中に写真を選ぶとプレビューが出る',
        await reAddRemoveBtn.isVisible(),
      )
      await photoPage.getByRole('button', { name: '保存する', exact: true }).click()
      await photoPage.waitForTimeout(400)
      const reAddedThumb = photoPage.locator(`button[aria-label="${ja.detail.cookedPhotoView}"]`).first()
      check('LOG-EDIT-PHOTO-01 追加して保存すると記録一覧にサムネイルが再び出る', await reAddedThumb.isVisible())

      const reAddedUrl = photoPage.url()
      const reAddedRecipeId = Number(reAddedUrl.match(/#\/recipes\/(\d+)/)?.[1])
      const reAddedLog = await photoPage.evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getReq = tx.objectStore('recipes').get(id)
              getReq.onsuccess = () => {
                const recipe = getReq.result
                const log = recipe?.cookedLogs?.[0]
                resolve(log ? { hasPhoto: log.photo instanceof Blob, photoSize: log.photo?.size ?? 0 } : null)
              }
              getReq.onerror = () => reject(getReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        reAddedRecipeId,
      )
      check(
        'LOG-EDIT-PHOTO-01 編集で追加した写真も圧縮後Blob(実サイズ>0)としてIndexedDBに保存される' +
          '(新規作成時と同じ保存形式)',
        !!reAddedLog?.hasPhoto && reAddedLog.photoSize > 0,
        `reAddedLog=${JSON.stringify(reAddedLog)}`,
      )
    } finally {
      await photoBrowser.close()
    }
  }

  // --- NUT-02: 栄養価の概算(Pro解錠済み)。5項目の実パネル(たんぱく質・脂質・炭水化物を含む)が
  // 出ること、人数を変えても「1人分」の値は変わらないこと(全量だけが連動する)を確認する。
  // 実際のPro解錠コード(UR-...)は販売台帳の原本なのでリポジトリにコミットできないため、
  // ここではsettings.proCodeをIndexedDBへ直接書き込んで「解錠済み」状態だけを再現する
  // (コード検証ロジック自体はscripts/test-logic.mjsで別途確認済み)。他チェックのPro状態に
  // 影響しないよう、専用のbrowser/contextで完結させる(M6-1 2026-07-12) ---
  currentCheck = 'NUT-02'
  // 栄養価の表示に出ている項目名（2026-08-19 便HU・⑯）。NUT-02で読み取り、NUTSORT-02で
  // 「並び替えの顔ぶれと同じか」を照合する。読み取れないままだと下限の判定で落ちる
  let nutritionPanelLabels = []
  {
    const nutBrowser = await chromium.launch()
    const nutContext = await nutBrowser.newContext()
    const nutPage = await nutContext.newPage()
    nutPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUT-02] ${err.message}`)
    })
    try {
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await nutPage.evaluate(async () => {
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
            const putReq = store.put({ ...current, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await nutPage.reload({ waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.getByText('肉じゃが', { exact: true }).first().click()
      await nutPage.waitForTimeout(600)
      await nutPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
      await nutPage.waitForTimeout(300)
      const unlockedText = await nutPage.textContent('body')
      check('NUT-02 Pro解錠済みでたんぱく質が表示される', unlockedText.includes('たんぱく質'))
      // 2026-08-19 便HU・⑯: 栄養価の表示に出ている項目名をそのまま読み取り、
      // このあとのNUTSORT-02で「並び替えの顔ぶれと同じか」を照合するのに使う。
      // 読み取れなかったときは空配列のまま＝NUTSORT-02側の下限(8項目以上)で必ず落ちる
      nutritionPanelLabels = await nutPage.evaluate(() =>
        Array.from(document.querySelectorAll('[data-nutrient-label]')).map(
          (el) => el.textContent?.trim() ?? '',
        ),
      )
      check(
        'NUT-02(便HU⑯) 栄養価の表示の項目名を読み取れている(8項目)',
        nutritionPanelLabels.length === 8,
        `読み取れた項目=${JSON.stringify(nutritionPanelLabels)}`,
      )
      // DISC-01(2026-07-28 便BY): 解錠後に8項目表・期間の集計へ届く入口が設定のPro節にある
      {
        await nutPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
        await nutPage.waitForTimeout(600)
        const proSectionText = (await nutPage.textContent('body')) ?? ''
        check(
          'DISC-01 解錠後の「使えるようになった機能」に8項目表の見つけ方が書かれている',
          proSectionText.includes('栄養価の8項目表示') &&
            proSectionText.includes(ja.settings.proActivatedFeatureGroups[0].features[1].hint),
        )
        check(
          // 2026-07-28 便CA → 2026-08-03 便DR: 月タブのボタン名を変えたため、案内文の期待値も更新
          // 2026-08-10 便FJ: ユーザー向け文言から「タブ」を掃引したので「献立の画面」に更新
          'DISC-01 解錠後の案内に期間の集計(期間の食費と栄養)への行き方が書かれている',
          proSectionText.includes('期間の食費と栄養') &&
            // 2026-08-19 便HV・⑦: ボタン名が「期間で絞る」に変わったので道順の名前もそろえる
            proSectionText.includes(ja.settings.proActivatedFeatureGroups[1].features[1].hint),
        )
        const discLinks = await nutPage.evaluate(() => {
          const hrefs = Array.from(document.querySelectorAll('#pro-section a')).map((a) =>
            a.getAttribute('href'),
          )
          return { recipes: hrefs.includes('#/recipes'), mealPlan: hrefs.includes('#/meal-plan') }
        })
        check(
          'DISC-01 解錠後の案内からレシピ一覧・献立へ直接飛べる入口がある',
          discLinks.recipes && discLinks.mealPlan,
          JSON.stringify(discLinks),
        )
        // 元の画面に戻す(以降のNUT-02チェックに影響させない)
        await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await nutPage.waitForTimeout(600)
        await nutPage.getByText('肉じゃが', { exact: true }).first().click()
        await nutPage.waitForTimeout(600)
        await nutPage.getByRole('button', { name: ja.nutrition.toggleExpand }).click()
        await nutPage.waitForTimeout(300)
      }
      check('NUT-02 Pro解錠済みで脂質が表示される', unlockedText.includes('脂質'))
      check('NUT-02 Pro解錠済みで炭水化物が表示される', unlockedText.includes('炭水化物'))
      // 2026-08-01 線引きB': 塩分相当量は無料側から外してPro側へ移した。
      // 「語が出ている」だけだとPro案内の文言でも通ってしまうので、値が続いていることまで見る
      check(
        "NUT-02(B') Pro解錠済みで塩分相当量が値つきで表示される",
        /塩分相当量\s*[\d,.]+\s*g/.test(unlockedText),
      )
      // 野菜量は無料・Proとも出す(2026-08-01 線引きB')
      check(
        "NUT-02(B') Pro解錠済みでも野菜量(g)が表示される",
        /野菜\s*[\d,]+\s*g/.test(unlockedText),
      )
      // 2026-07-13 第2弾(オーナー承認): 食物繊維(g)・鉄(mg)・カルシウム(mg)の3項目とビタミン注記
      check('NUT-02 Pro解錠済みで食物繊維が表示される', unlockedText.includes('食物繊維'))
      check('NUT-02 Pro解錠済みで鉄がmg単位で表示される', /鉄\s*[\d,.]+\s*mg/.test(unlockedText))
      check('NUT-02 Pro解錠済みでカルシウムがmg単位で表示される', /カルシウム\s*[\d,.]+\s*mg/.test(unlockedText))
      // 2026-08-28 便MC: 説明・注記・出典は「注記と出典」の折りたたみへ入れた
      // （オーナー原文「栄養の説明と注記は折りたたみにしてコンパクトに」）。
      // 畳んでいるあいだ中身はDOMに無いので、開く前・開いた後の両方を測る
      check(
        'NUT-02(便MC) 説明と注記・出典は畳んである(開くまでビタミンの注記は出ない)',
        !unlockedText.includes(ja.nutrition.vitaminNote),
      )
      await nutPage.getByRole('button', { name: ja.nutritionBalance.notesToggle }).first().click()
      await nutPage.waitForTimeout(400)
      const unlockedNotesText = (await nutPage.textContent('body')) ?? ''
      check(
        'NUT-02 ビタミン非表示の注記が出る(文面はオーナー確定・一字一句)',
        unlockedNotesText.includes(ja.nutrition.vitaminNote),
      )
      check('NUT-02 断定しない「概算」バッジが出る', unlockedText.includes('概算'))
      check('NUT-02 「1人分」の内訳がある', unlockedText.includes('1人分'))
      check('NUT-02 「全量」の内訳もある(人数連動)', unlockedText.includes('全量'))

      // 人数を変えても「1人分」のエネルギーは変わらない(servings連動の検算。全量側だけが連動する)
      const perMatchBefore = unlockedText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      await nutPage.locator(`button[aria-label="${ja.detail.servingsUp}"]`).click()
      await nutPage.waitForTimeout(400)
      const afterServingsText = await nutPage.textContent('body')
      const perMatchAfter = afterServingsText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      check(
        'NUT-02 人数を変えても1人分のエネルギーは変わらない',
        !!perMatchBefore && !!perMatchAfter && perMatchBefore[1] === perMatchAfter[1],
        `変更前=${perMatchBefore?.[1]} 変更後=${perMatchAfter?.[1]}`,
      )

      // --- NUTSORT-02: 栄養並び替え(Pro解錠済み・2026-07-13 Fable設計→2026-07-16 便T-4で
      // カロリー・たんぱく質・塩分・脂質・糖質の5項目に拡張しPro機能化)。Pro解錠済みでは
      // 並び替えパネルに「栄養価で並び替え」区分と5項目が出ること、カロリー順の既定は昇順で
      // 算出不能レシピ(材料が成分表に名寄せできない自作レシピ)は昇順・降順とも末尾に回ること、
      // たんぱく質順の既定は降順(多い方から)であること、栄養価順の間はレシピカードに
      // 並び替え中の栄養価の値がラベル付き(「カロリー: ◯kcal」「たんぱく質: ◯g」)で
      // 表示されること(便T-7・2026-07-16 便T-7-2でラベル付き表示に変更)を確認する。
      // NUT-02と同じ解錠済みcontextを使う(無料側でティーザーだけになることはNUTSORT-01で検証済み) ---
      currentCheck = 'NUTSORT-02'
      // 算出不能なレシピを1件作る(材料名が成分表のどの食品にも名寄せできない)
      await nutPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(500)
      await nutPage.getByPlaceholder(ja.form.namePlaceholder).fill('E2E栄養並び替え確認レシピ')
      await nutPage.getByPlaceholder(ja.form.ingredientNamePlaceholder).first().fill('謎のたべもの')
      await nutPage
        .getByPlaceholder(ja.form.stepTextPlaceholder)
        .first()
        .fill('謎のたべものを盛り付ける')
      await nutPage.getByRole('button', { name: '保存する' }).click()
      await nutPage.waitForTimeout(800)
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.locator(`button[aria-label="${ja.search.sortToggle}"]`).click()
      await nutPage.waitForTimeout(300)
      const proSortPanelText = await nutPage.textContent('body')
      check(
        'NUTSORT-02 Pro解錠済みでは「栄養価で並び替え」の区分見出しが出る',
        proSortPanelText.includes('栄養価で並び替え'),
      )
      check(
        'NUTSORT-02 Pro解錠済みではグレーのティーザー行(Pro機能)は出ない',
        !proSortPanelText.includes('（Pro機能）'),
      )
      // 2026-08-19 便HZ・①: 用途の1行は無料・Proの両方とも削除した(片方だけ残すと、
      // 解錠しているかどうかで説明の有無が変わる)
      check(
        'NUTSORT-02(便HZ①) 解錠後も用途の1行は出ない',
        !proSortPanelText.includes('目的からレシピを探せます'),
      )
      // 2026-08-19 便HU・⑯: 顔ぶれを栄養価の表示と同じ8項目にそろえた。
      // ここでは「レシピを開いたときの栄養価の表示に出ている項目名」を実際に読み取り、
      // その全部が並び替えの選択肢にも出ていることを見る＝顔ぶれを書き写して並べない
      // (項目が増えても、書き写しが古くなって当たらなくなることがない)
      const proNutrientButtons = await nutPage.evaluate((names) => {
        const buttons = Array.from(document.querySelectorAll('button'))
        return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
      }, nutritionPanelLabels)
      check(
        'NUTSORT-02(便HU⑯) 並び替えの顔ぶれが栄養価の表示の顔ぶれと同じ',
        nutritionPanelLabels.length >= 8 &&
          proNutrientButtons.length === nutritionPanelLabels.length,
        `栄養価の表示=${JSON.stringify(nutritionPanelLabels)} 並び替えに出た項目=${JSON.stringify(proNutrientButtons)}`,
      )
      // エネルギー順: 既定は昇順(低い方から)。算出不能レシピは昇順・降順とも末尾
      await nutPage.getByRole('button', { name: 'エネルギー', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalAscActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '昇順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 エネルギー順の既定は昇順(低い方から)', kcalAscActive)
      const nutCardTitles = () =>
        nutPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
      const kcalAscTitles = await nutCardTitles()
      check(
        'NUTSORT-02 算出不能なレシピは昇順で末尾に回る',
        kcalAscTitles.length > 1 &&
          kcalAscTitles[kcalAscTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
        `末尾=${kcalAscTitles[kcalAscTitles.length - 1]}`,
      )
      // 便T-7-2(2026-07-16オーナー指示): カロリー順の間、グリッドカードの左上に
      // 「カロリー: ◯kcal」のラベル付きの値が出る。算出不能レシピには出ない
      // 2026-08-19 便HX: 値のバッジは「カードの外枠に重ねる」作りで、便HWの共通カード化で
      // レシピ詳細へのリンク(<a>)の**外側**へ移った。リンクの中だけを探すと、実際には
      // 110枚すべてに出ていても0件と数えてしまう(実機で確認済み)。
      // カード1枚ぶん＝**そのカードのリンクだけを抱えているいちばん外側の要素**まで
      // 広げてから探す＝リンクとバッジの前後関係が変わっても当たる(禁じ手④への対処)
      const kcalBadgeInfo = await nutPage.evaluate(() => {
        const cardLinks = (root) =>
          Array.from((root ?? document).querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
            /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
          )
        const cardRootOf = (a) => {
          let el = a
          while (el.parentElement && cardLinks(el.parentElement).length === 1) el = el.parentElement
          return el
        }
        const links = cardLinks()
        const badgeOf = (a) =>
          Array.from(cardRootOf(a).querySelectorAll('span')).find((s) =>
            /^エネルギー: \d+(\.\d+)?kcal$/.test(s.textContent?.trim() ?? ''),
          )
        const unknownCard = links.find((a) => a.textContent?.includes('E2E栄養並び替え確認レシピ'))
        return {
          total: links.length,
          withBadge: links.filter((a) => badgeOf(a)).length,
          unknownHasBadge: unknownCard ? !!badgeOf(unknownCard) : null,
        }
      })
      check(
        'NUTSORT-02 エネルギー順の間、カードに「エネルギー: ◯kcal」のラベル付きの値が表示される(便T-7-2)',
        kcalBadgeInfo.withBadge > 0,
        `バッジ付き=${kcalBadgeInfo.withBadge}/${kcalBadgeInfo.total}`,
      )
      check(
        // 「1枚も出ていない」状態でも合格してしまわないよう、出ているカードがあることを
        // 同じ条件の中で対にする(2026-08-19 便HX。実際に0/110で素通りしていた)
        'NUTSORT-02 算出不能なレシピのカードには値バッジが出ない',
        kcalBadgeInfo.unknownHasBadge === false && kcalBadgeInfo.withBadge > 0,
        `unknownHasBadge=${kcalBadgeInfo.unknownHasBadge} バッジ付き=${kcalBadgeInfo.withBadge}/${kcalBadgeInfo.total}`,
      )
      await nutPage.getByRole('button', { name: ja.search.sortDesc, exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalDescTitles = await nutCardTitles()
      check(
        'NUTSORT-02 降順でも算出不能なレシピは末尾のまま',
        kcalDescTitles.length > 1 &&
          kcalDescTitles[kcalDescTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
        `末尾=${kcalDescTitles[kcalDescTitles.length - 1]}`,
      )
      check(
        'NUTSORT-02 昇順と降順で先頭が入れ替わる(実際にエネルギー順で並んでいる)',
        kcalAscTitles.length > 1 && kcalAscTitles[0] !== kcalDescTitles[0],
        `昇順先頭=${kcalAscTitles[0]} 降順先頭=${kcalDescTitles[0]}`,
      )
      // たんぱく質順: 既定は降順(多い方から)。カードの値は「たんぱく質: ◯g」表記になる(便T-7-2)
      await nutPage.getByRole('button', { name: 'たんぱく質', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const proteinDescActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '降順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 たんぱく質順の既定は降順(多い方から)', proteinDescActive)
      // kcal側と同じ理由(便HX)でカード1枚ぶんまで広げてから探す
      const countGramBadges = () =>
        nutPage.evaluate(() => {
          const cardLinks = (root) =>
            Array.from((root ?? document).querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
              /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
            )
          const cardRootOf = (a) => {
            let el = a
            while (el.parentElement && cardLinks(el.parentElement).length === 1)
              el = el.parentElement
            return el
          }
          return cardLinks().filter((a) =>
            Array.from(cardRootOf(a).querySelectorAll('span')).some((s) =>
              /^たんぱく質: \d+(\.\d+)?g$/.test(s.textContent?.trim() ?? ''),
            ),
          ).length
        })
      check(
        'NUTSORT-02 たんぱく質順の間はカードの値が「たんぱく質: ◯g」表記になる(便T-7-2)',
        (await countGramBadges()) > 0,
      )
      const proteinTitles = await nutCardTitles()
      check(
        'NUTSORT-02 たんぱく質順でも一覧が表示される(console/pageerror監視でエラー0を担保)',
        proteinTitles.length > 0,
      )
      // 便T-7: 一覧(リスト)表示に切り替えても並び替え中の栄養価の値(行の右下)が出る。
      // 2026-08-10 便FF: 並べ替えパネルは一覧の上に重ねて出るようになり、開いている間は
      // 件数の行(表示形式の切替もここにある)がパネルの下に隠れる。先にパネルを閉じてから押す
      await nutPage.locator('[data-testid="sort-panel-close"]').click()
      await nutPage.waitForTimeout(400)
      await nutPage.locator(`button[aria-label="${ja.search.layoutToggleToList}"]`).click()
      await nutPage.waitForTimeout(400)
      check(
        'NUTSORT-02 一覧(リスト)表示でも並び替え中の栄養価の値が出る(便T-7)',
        (await countGramBadges()) > 0,
      )
      // 2026-08-19 便HX(再発防止): 値のバッジはカードに**重ねて**出しているので、
      // その上を押したときに指が素通りしてレシピ詳細へ行けることまで見る。
      // 便HWでバッジが押せる面の外へ出たとき、リスト表示のバッジの上だけが
      // 「押しても何も起きない死角」になっていた(390px幅の実機で実測)。
      // 「バッジが見えている」だけを見ていると、この種の後戻りは一切引っかからない
      const tapBadgeOpensRecipe = async () => {
        const point = await nutPage.evaluate(() => {
          const badge = Array.from(document.querySelectorAll('span')).find((s) =>
            /^(エネルギー|たんぱく質): /.test(s.textContent?.trim() ?? ''),
          )
          if (!badge) return null
          const r = badge.getBoundingClientRect()
          if (r.width <= 0 || r.height <= 0) return null
          return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
        })
        if (!point) return { tapped: false, opened: false }
        await nutPage.mouse.click(point.x, point.y)
        await nutPage.waitForTimeout(800)
        const opened = /#\/recipes\/\d+$/.test(nutPage.url())
        // 一覧へ戻す。goBack()はHashRouterだとURLが動かないことがある(実測)ので、
        // 一覧のURLを開き直す。検索・絞り込み・並べ替えはsessionStorageから復元されるため、
        // 開き直しても並び替え中の状態は続く
        await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await nutPage.waitForTimeout(800)
        return { tapped: true, opened }
      }
      const listBadgeTap = await tapBadgeOpensRecipe()
      check(
        'NUTSORT-02(便HX) 一覧(リスト)表示で値のバッジを押してもレシピ詳細へ行ける(重ねた表示が死角にならない)',
        listBadgeTap.tapped && listBadgeTap.opened,
        `tap=${JSON.stringify(listBadgeTap)}`,
      )
      await nutPage.locator(`button[aria-label="${ja.search.layoutToggleToGrid}"]`).click()
      await nutPage.waitForTimeout(300)
      const gridBadgeTap = await tapBadgeOpensRecipe()
      check(
        'NUTSORT-02(便HX) グリッド表示でも値のバッジを押してレシピ詳細へ行ける',
        gridBadgeTap.tapped && gridBadgeTap.opened,
        `tap=${JSON.stringify(gridBadgeTap)}`,
      )
    } finally {
      await nutBrowser.close()
    }
  }

  // --- UNLOCK-01(2026-07-17設定ゼロベース裁定#4+#7の「購入と解錠」を継承→2026-07-22全無料化で
  // Pro(UR-)専用化): 収録レシピは全て無料になり、追加レシピパック(UP-)は製品廃止したため、
  // 受け付ける解錠コードはPro(UR-)のみになった。
  // (a) UR-以外のprefix・廃止したUP-パックコードはコード形式エラーになること・UR-でPro版が解錠でき
  //     解錠済みコードがマスク表示(UR-****2VSZ)+コピーで控えられること(クリップボードの実文字列まで
  //     確認)を、専用のbrowser/contextで確認する。テスト用コードはdocs/22記載・販売用ではない:
  //     Pro=UR-96QS-2VSZ。廃止したUP-2W3D-QZPRはもう解錠されないこと(コード形式エラー)も確認する
  // (b) Pro解錠済みのときは入力欄自体が消え、Pro版の機能一覧が解錠中ずっと表示され続けることを、
  //     別の専用browser/contextで確認する ---
  currentCheck = 'UNLOCK-01'
  {
    // (a) コード解錠の種別判定+マスク表示+コピー(Pro=UR-のみ有効)
    const ulBrowser = await chromium.launch()
    try {
      const ulContext = await ulBrowser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
      const ulPage = await ulContext.newPage()
      ulPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@UNLOCK-01(a)] ${err.message}`)
      })
      await ulPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ulPage.waitForTimeout(1800) // 初回シード完了待ち
      await ulPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await ulPage.waitForTimeout(800)

      check(
        'UNLOCK-01(a) 「購入と解錠」カードがある',
        (await ulPage.textContent('body')).includes('購入と解錠'),
      )
      // 2026-08-03 便DN: 未解錠の枠は「Pro版の一言→精度開示→購入ボタン→解錠コード入力欄」に
      // 再構成した(旧「未解錠」バッジ付きのPro版行は撤去)。購入ボタンと入力欄の両方が
      // 同じ枠にあり、解錠済みのお礼文言はまだ出ていないことで未解錠を判定する
      check(
        'UNLOCK-01(a) 未解錠のときは購入ボタンと解錠コード入力欄が同じ枠に出る(便DN)',
        (await ulPage.locator('[data-testid="pro-buy-link"]').count()) === 1 &&
          (await ulPage.locator('[data-testid="unlock-code-row"]').count()) === 1,
      )
      check(
        'UNLOCK-01(a) 未解錠のときは解錠のお礼文言が出ない',
        !(await ulPage.textContent('body')).includes(ja.settings.proActivatedTitle),
      )
      // オーナー指示(2026-08-03)の核: 購入ボタンとコード入力欄を隣り合わせにする。
      // DOM上で購入ボタンの次の要素が入力欄の行であること＝間に他の要素を挟んでいないこと
      check(
        'UNLOCK-01(a) 購入ボタンの直後が解錠コード入力欄(間に他の要素を挟まない・便DN)',
        await ulPage.evaluate(() => {
          const buy = document.querySelector('[data-testid="pro-buy-link"]')
          return buy?.nextElementSibling?.getAttribute('data-testid') === 'unlock-code-row'
        }),
      )
      check(
        'UNLOCK-01(a) 機能説明と月間サンプルの入口は「購入と解錠」の枠の外にある(便DN)',
        await ulPage.evaluate(() => {
          const card = document.querySelector('#pro-section')
          const details = document.querySelector('[data-testid="pro-features-details"]')
          const demo = document.querySelector('[data-testid="settings-month-demo-link"]')
          return !!card && !!details && !!demo && !card.contains(details) && !card.contains(demo)
        }),
      )

      const unlockInput = ulPage.getByPlaceholder(ja.settings.unlockCodePlaceholder)
      const unlockButton = ulPage.getByRole('button', { name: ja.settings.unlockActivate, exact: true })

      // UR-以外のprefixはコード形式エラー
      await unlockInput.fill('XX-0000-0000')
      await unlockButton.click()
      await ulPage.waitForTimeout(500)
      check(
        'UNLOCK-01(a) UR-以外のprefixはコード形式エラーになる',
        (await ulPage.textContent('body')).includes(ja.settings.unlockUnknownCode),
      )

      // 廃止したUP-パックコードももう受け付けない(2026-07-22全無料化・パック製品廃止でコード形式エラー扱い)
      await unlockInput.fill('UP-2W3D-QZPR')
      await unlockButton.click()
      await ulPage.waitForTimeout(500)
      const afterPackText = await ulPage.textContent('body')
      check(
        'UNLOCK-01(a) 廃止したUP-パックコードは受け付けない(コード形式エラー)',
        afterPackText.includes(ja.settings.unlockUnknownCode),
      )
      check(
        'UNLOCK-01(a) UP-では解錠されない(解錠のお礼文言は出ない)',
        !afterPackText.includes(ja.settings.proActivatedTitle),
      )

      // UR-コードでPro版が解錠される
      await unlockInput.fill('UR-96QS-2VSZ')
      await unlockButton.click()
      await ulPage.waitForTimeout(800)
      const afterProText = await ulPage.textContent('body')
      check(
        'UNLOCK-01(a) UR-コードでPro版が解錠される',
        afterProText.includes(ja.settings.proActivatedTitle),
      )
      check(
        'UNLOCK-01(a) 解錠済みコードはマスク表示される(末尾4文字のみ・UR-****2VSZ)',
        afterProText.includes('UR-****2VSZ'),
      )
      check(
        'UNLOCK-01(a) Pro解錠後は入力欄が消える(Pro版がすべて含むため)',
        !(await unlockInput.isVisible().catch(() => false)),
      )

      // コピーボタンで生のコードがクリップボードへ入ること
      await ulPage.getByRole('button', { name: ja.settings.unlockCodeCopy, exact: true }).first().click()
      await ulPage.waitForTimeout(300)
      const copiedText = await ulPage.evaluate(() => navigator.clipboard.readText())
      check(
        'UNLOCK-01(a) コピーボタンで生のコードがクリップボードにコピーされる',
        copiedText === 'UR-96QS-2VSZ',
        `copiedText=${copiedText}`,
      )
      check(
        'UNLOCK-01(a) コピー後は「コピーしました」表示になる',
        (await ulPage.textContent('body')).includes('コピーしました'),
      )
    } finally {
      await ulBrowser.close()
    }

    // (b) Pro解錠済み。実際のPro解錠コードは販売台帳の原本なのでリポジトリにコミットできないため、
    // NUT-02と同様settings.proCodeをIndexedDBへ直接書き込んで再現する(コード検証自体は(a)で実UI経由済み)
    const ulbBrowser = await chromium.launch()
    try {
      const ulbContext = await ulbBrowser.newContext()
      const ulbPage = await ulbContext.newPage()
      ulbPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@UNLOCK-01(b)] ${err.message}`)
      })
      await ulbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ulbPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await ulbPage.evaluate(async () => {
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
            const putReq = store.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await ulbPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await ulbPage.waitForTimeout(800)
      const proSectionText = await ulbPage.textContent('body')
      check(
        'UNLOCK-01(b) Pro解錠済み時は入力欄自体が表示されない(旧: disabled入力の後継)',
        !(await ulbPage.getByPlaceholder(ja.settings.unlockCodePlaceholder).isVisible()),
      )
      check(
        'UNLOCK-01(b) Pro版の機能一覧が解錠中ずっと表示される(2026-07-13 UI改善: 一時表示から常設化)',
        proSectionText.includes(ja.settings.proActivatedFeaturesTitle) && proSectionText.includes('並行調理ナビ'),
      )
    } finally {
      await ulbBrowser.close()
    }
  }

  // --- TOPUP-01: 既存ユーザーへの差分投入(テーマ全廃2026-07-23)。テーマ全廃より前に初回シード済みの
  // 端末には旧テーマ由来の基本レシピがまだ無いため、アップデート後の起動時に「不足分だけ」1回投入する
  // (topUpFlattenedStartersIfNeeded)。IndexedDBを直接いじって「アップデート前の端末」を再現し:
  //  (1) 削除済み(トゥームストーン記録あり)の品は差分投入で復活させない(削除した品を復活させない)
  //  (2) 未削除で不足している品は差分投入で戻る
  //  (3) 差分投入は1回だけ(starterFlattenSeededフラグ)で、二重投入されない
  // を確認する。旧TOMB-01(テーマ取り込み→削除→再取込のトゥームストーン)はテーマUI撤去に伴い、
  // トゥームストーンを尊重する経路を差分投入側で検証する形へ置き換えた。専用のbrowser/contextで完結させる ---
  currentCheck = 'TOPUP-01'
  {
    const tuBrowser = await chromium.launch()
    const tuContext = await tuBrowser.newContext()
    const tuPage = await tuContext.newPage()
    tuPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TOPUP-01] ${err.message}`)
    })
    try {
      await tuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2200) // 初回シード完了待ち(109品・starterFlattenSeeded=true)

      // 「アップデート前の端末」を再現する: 旧テーマ由来の2品を消し、うち1品にトゥームストーン記録を残し、
      // 差分投入フラグ(starterFlattenSeeded)を未実施状態(false)に戻す。starterSeeded自体はtrueのまま
      const REVIVE = 'レンジ蒸し鶏（自家製サラダチキン）' // 旧kintore由来・トゥームストーン無し→戻るはず
      const DELETED = 'だしのとり方' // 旧summer由来・トゥームストーンあり→戻らないはず
      await tuPage.evaluate(
        ({ revive, deleted }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['recipes', 'setExclusions', 'settings'], 'readwrite')
              const recipes = tx.objectStore('recipes')
              const getAll = recipes.getAll()
              getAll.onsuccess = () => {
                for (const r of getAll.result) {
                  if (r.title === revive || r.title === deleted) recipes.delete(r.id)
                }
                // 削除した品にはトゥームストーン(再取込除外)記録を残す
                tx.objectStore('setExclusions').add({
                  setId: 'summer',
                  title: deleted,
                  excludedAt: Date.now(),
                })
                // 差分投入フラグを未実施へ戻す(starterSeededはtrueのまま=アップデート前の既存端末)
                const settings = tx.objectStore('settings')
                const getS = settings.get(1)
                getS.onsuccess = () => {
                  settings.put({ ...(getS.result || { id: 1 }), id: 1, starterFlattenSeeded: false })
                }
              }
              tx.oncomplete = () => {
                idb.close()
                resolve(undefined)
              }
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { revive: REVIVE, deleted: DELETED },
      )

      const countTitles = () =>
        tuPage.evaluate(
          ({ revive, deleted }) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('recipes', 'readonly')
                const getAll = tx.objectStore('recipes').getAll()
                getAll.onsuccess = () => {
                  const rs = getAll.result
                  resolve({
                    total: rs.length,
                    hasRevive: rs.some((r) => r.title === revive),
                    hasDeleted: rs.some((r) => r.title === deleted),
                  })
                }
                getAll.onerror = () => reject(getAll.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { revive: REVIVE, deleted: DELETED },
        )

      const before = await countTitles()
      check(
        'TOPUP-01 前提: アップデート前状態を再現(2品削除・107品)',
        before.total === 107 && !before.hasRevive && !before.hasDeleted,
        `before=${JSON.stringify(before)}`,
      )

      // アップデート後の起動を再現: フルリロードで App が再マウントされ topUpFlattenedStartersIfNeeded
      // が実行される(同じhash URLへの goto は文書を再読み込みしないため reload を使う)
      await tuPage.reload({ waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2200)
      const after = await countTitles()
      check(
        'TOPUP-01 差分投入: 未削除で不足していた品は戻る',
        after.hasRevive,
        `after=${JSON.stringify(after)}`,
      )
      check(
        'TOPUP-01 差分投入: トゥームストーンのある削除済みの品は復活させない',
        !after.hasDeleted,
        `after=${JSON.stringify(after)}`,
      )
      check(
        'TOPUP-01 差分投入は不足分だけ(107→108・二重投入しない)',
        after.total === 108,
        `total=${after.total}`,
      )

      // もう一度リロードしても差分投入は再実行されない(starterFlattenSeededフラグで1回だけ)
      await tuPage.reload({ waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2000)
      const again = await countTitles()
      check(
        'TOPUP-01 差分投入は1回だけ(再起動しても件数が増えない)',
        again.total === 108,
        `total=${again.total}`,
      )
    } finally {
      await tuBrowser.close()
    }
  }

  // --- ORPHAN-01: レシピ削除で週間献立・今日の献立に孤児が残らない(2026-07バグ修正・deleteRecipe)。
  // deleteRecipeは同一トランザクションで当該レシピを指すmealPlans/todayListの行も消す。テーマ全廃
  // (2026-07-23)でテーマ一括削除UIは撤去したため、1品削除(編集画面の「このレシピを削除」)で
  // 孤児掃除が効くことを検証する形へ置き換えた。基本レシピ(肉じゃが)を週間献立・今日の献立の
  // 両方に登録してから削除し、両テーブルから該当行が消えている(IndexedDB直読み)ことを確認する。
  // 週間献立への登録はUIのピッカー経路が長い(MEALPLAN-01/02で別途検証済み)ため、実データ形状に
  // 合わせてIndexedDBへ直接1行だけ書き込んで再現する。他チェックに影響しないよう専用のcontextで完結 ---
  currentCheck = 'ORPHAN-01'
  {
    const obBrowser = await chromium.launch()
    const obContext = await obBrowser.newContext()
    const obPage = await obContext.newPage()
    obPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@ORPHAN-01] ${err.message}`)
    })
    obPage.on('dialog', (dialog) => dialog.accept())
    try {
      await obPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(2200) // 初回シード完了待ち

      // 1) 基本レシピ(肉じゃが)を開いて「今日の献立に追加」し、そのidを控える
      await obPage.getByText('肉じゃが', { exact: true }).first().click()
      await obPage.waitForTimeout(500)
      const targetRecipeId = Number(obPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await obPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await obPage.waitForTimeout(300)
      // 2026-07-17 便Z-1: ボタン押下でスロット振り分け窓が開く。従来どおりの直接追加(枠なし)は「決めない」
      await obPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await obPage.waitForTimeout(300)

      // 2) 同じレシピを週間献立にも登録する(IndexedDB直接書き込み。理由は上のコメント参照)
      await obPage.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('mealPlans', 'readwrite')
              const addReq = tx.objectStore('mealPlans').add({
                date: '2026-08-01',
                slot: 'dinner',
                recipeId,
                role: 'main',
              })
              addReq.onsuccess = () => resolve(undefined)
              addReq.onerror = () => reject(addReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        targetRecipeId,
      )

      const countByRecipeId = (storeName) =>
        obPage.evaluate(
          ({ storeName, recipeId }) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(storeName, 'readonly')
                const getAllReq = tx.objectStore(storeName).getAll()
                getAllReq.onsuccess = () =>
                  resolve(getAllReq.result.filter((row) => row.recipeId === recipeId).length)
                getAllReq.onerror = () => reject(getAllReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { storeName, recipeId: targetRecipeId },
        )

      // 前提確認: 削除前は両テーブルに対象レシピの行が実在する
      check('ORPHAN-01 前提: 今日の献立に対象レシピの行がある', (await countByRecipeId('todayList')) === 1)
      check('ORPHAN-01 前提: 週間献立に対象レシピの行がある', (await countByRecipeId('mealPlans')) === 1)

      // 3) 対象レシピを編集画面の「このレシピを削除」で削除する(確認ダイアログは自動承諾)
      await obPage.goto(`${BASE}/#/recipes/${targetRecipeId}/edit`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(600)
      await obPage.getByRole('button', { name: ja.form.deleteRecipe }).click()
      await obPage.waitForTimeout(800)

      // 4) 孤児が残っていない: 週間献立・今日の献立のどちらにも対象レシピの行が無い
      check(
        'ORPHAN-01 レシピ削除後、今日の献立に孤児が残らない',
        (await countByRecipeId('todayList')) === 0,
      )
      check(
        'ORPHAN-01 レシピ削除後、週間献立に孤児が残らない',
        (await countByRecipeId('mealPlans')) === 0,
      )

      // 孤児データが残っていた場合の描画クラッシュも合わせて検出する(画面上は普通に表示される)
      await obPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(600)
      check(
        'ORPHAN-01 献立タブが孤児データでクラッシュせず表示される',
        (await obPage.textContent('body')).includes('今日の献立'),
      )
    } finally {
      await obBrowser.close()
    }
  }

  // --- TODAYALL-01: 「全て作った！」で記録の追加とリストのクリアが一括で反映される
  // (2026-07バグ修正)。従来はmarkAllTodayListCookedが記録ループ(addCookedLog)と
  // db.todayList.clear()を別トランザクションで行っていたため、途中で中断すると
  // 「一部だけ記録されてリストは残る/消える」不整合が起き得た。1つのトランザクションに
  // まとめたことで、正常系では記録とクリアが必ず両方揃って反映されることを確認する
  // (黒箱のE2Eではトランザクション途中の強制中断は再現できないため、原子性そのものは
  // markTodayListCookedと同じreentrantトランザクション方式であることをコードレビューで
  // 担保し、ここでは正常系の一括反映が壊れていないことを回帰確認する) ---
  currentCheck = 'TODAYALL-01'
  {
    const taBrowser = await chromium.launch()
    const taContext = await taBrowser.newContext()
    const taPage = await taContext.newPage()
    taPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TODAYALL-01] ${err.message}`)
    })
    // 2026-08-03 便DP-1: 「全て作った！」に規約Fの確認文を付けた。確認文の中身も検査する
    let taConfirmText = ''
    await collectConfirms(taPage, (text) => {
      taConfirmText = text
    })
    try {
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(1800) // 初回シード完了待ち

      // 基本レシピ2品(肉じゃが・カレーライス)を「今日の献立に追加」ボタンで追加する
      // (2026-07-17 便Z-1: ボタン押下でスロット振り分け窓が開くようになったため、
      // 従来どおりの直接追加=「決めない」を選ぶ1手が増えた)
      await taPage.getByText('肉じゃが', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await taPage.waitForTimeout(300)
      await taPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await taPage.waitForTimeout(300)
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(500)
      await taPage.getByText('カレーライス', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await taPage.waitForTimeout(300)
      await taPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await taPage.waitForTimeout(300)

      await taPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(600)
      const beforeText = await taPage.textContent('body')
      check(
        'TODAYALL-01 前提: 今日の献立に2品とも表示される',
        beforeText.includes('肉じゃが') && beforeText.includes('カレーライス'),
      )

      // 2026-08-20 便II・⑥: 「全て作った！」は整理モードの中に移った
      await openDayOrganize(taPage)
      await taPage.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked }).click()
      await taPage.waitForTimeout(800)
      // 便DP-1: 押す前の確認文が規約F(何件・何が消える・何が残る)を満たす
      check(
        'TODAYALL-01(便DP-1) 「全て作った！」の前に件数つきの確認が出る',
        taConfirmText.includes('2品に、作った記録をつけます'),
        `confirm=${JSON.stringify(taConfirmText)}`,
      )
      check(
        'TODAYALL-01(便DP-1) 確認文に「消えるもの」と「残るもの」が件数つきで両方ある(規約F)',
        taConfirmText.includes('消えるもの: 今日の献立の2品') &&
          taConfirmText.includes('残るもの: 作った記録2件') &&
          taConfirmText.includes(ja.mealPlan.todayMarkAllCookedKept.split('。')[1]),
        `confirm=${JSON.stringify(taConfirmText)}`,
      )
      const afterText = await taPage.textContent('body')
      // 2026-08-17 便HI(オーナー指示「『今日の献立』がない時には表示しない」): 空になった合図は
      // 案内文ではなく「今日の献立」の見出しごと消えること。文言ではなく見出しの有無で測る
      check(
        'TODAYALL-01 「全て作った！」の後、今日の献立が空になる(clearが実行される)',
        // 料理名は「最近作ったもの」にも出るので、本文の有無では測らない(禁じ手②)
        (await taPage.getByRole('heading', { name: ja.mealPlan.todayTitle }).count()) === 0,
      )
      // 便DP-1: 記録したあとは件数つきのトーストと「元に戻す」を出す
      check(
        'TODAYALL-01(便DP-1) 件数つきのトーストと「元に戻す」が出る',
        afterText.includes('2件の作った記録をつけました') && afterText.includes('元に戻す'),
      )

      // IndexedDBを直読みし、両方のレシピにcookedLogsが実際に追加され、todayListが空になったことを確認する
      const taReadState = () =>
        taPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['recipes', 'todayList'], 'readonly')
                let recipes, today
                const recipesReq = tx.objectStore('recipes').getAll()
                const todayReq = tx.objectStore('todayList').getAll()
                recipesReq.onsuccess = () => {
                  recipes = recipesReq.result
                  if (today !== undefined) resolve({ recipes, today })
                }
                todayReq.onsuccess = () => {
                  today = todayReq.result
                  if (recipes !== undefined) resolve({ recipes, today })
                }
                recipesReq.onerror = () => reject(recipesReq.error)
                todayReq.onerror = () => reject(todayReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
      const state = await taReadState()
      const nikujaga = state.recipes.find((r) => r.title === '肉じゃが')
      const curry = state.recipes.find((r) => r.title === 'カレーライス')
      check('TODAYALL-01 肉じゃがに作った記録が追加される', (nikujaga?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 カレーライスに作った記録が追加される', (curry?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 今日の献立テーブルが空になる(clear実行)', state.today.length === 0)

      // 便DP-1: 複数件の「元に戻す」＝2件の記録が消え、2品とも今日の献立へ戻る
      await taPage.getByRole('button', { name: '元に戻す' }).click()
      await taPage.waitForTimeout(900)
      const taUndone = await taReadState()
      const taNikujaga2 = taUndone.recipes.find((r) => r.title === '肉じゃが')
      const taCurry2 = taUndone.recipes.find((r) => r.title === 'カレーライス')
      check(
        'TODAYALL-01(便DP-1) 「元に戻す」で2件の記録がまとめて消える',
        (taNikujaga2?.cookedLogs?.length ?? 0) === 0 && (taCurry2?.cookedLogs?.length ?? 0) === 0,
      )
      check(
        'TODAYALL-01(便DP-1) 「元に戻す」で2品とも今日の献立へ戻る',
        taUndone.today.length === 2,
        `today=${JSON.stringify(taUndone.today)}`,
      )
      check(
        'TODAYALL-01(便DP-1) 取り消した品数を結果メッセージで伝える',
        ((await taPage.textContent('body')) ?? '').includes(
          '2件の作った記録を取り消して、今日の献立に戻しました',
        ),
      )
    } finally {
      await taBrowser.close()
    }
  }

  // --- TODAYUNDO-01: 今日の献立の☑(作った)に「元に戻す」を添える(2026-08-02 便DE-3・オーナー指示)。
  // 押すと行が消えるだけで記録が付いたのか分からず、押し間違いを戻す手段も無かった。
  // トーストの「元に戻す」で ①今日の日付の記録が1件消える ②その品が今日の献立へ戻る、を実データで確認する ---
  currentCheck = 'TODAYUNDO-01'
  {
    const tuBrowser = await chromium.launch()
    const tuContext = await tuBrowser.newContext()
    const tuPage = await tuContext.newPage()
    tuPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TODAYUNDO-01] ${err.message}`)
    })
    try {
      await tuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(1800) // 初回シード完了待ち
      await tuPage.getByText('肉じゃが', { exact: true }).first().click()
      await tuPage.waitForTimeout(500)
      await tuPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await tuPage.waitForTimeout(300)
      await tuPage.getByRole('button', { name: ja.detail.todaySlotUndecided }).click()
      await tuPage.waitForTimeout(300)

      await tuPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(800)
      // 2026-08-03 便DP-3: 行の☑アイコンを、枠と文字ラベルの付いたボタン「作った！」にした
      // （オーナー実機「☑アイコンだけでは操作できるものに見えなかった」）。
      // 2026-08-18 便HN（オーナー指示「同じような機能は色を同じに」）で、記録をつける6か所を
      // **塗り**にそろえた。**見た目の指定そのものを固定すると、そろえるたびに落ちる**ので、
      // ここが見たいこと＝**押せるものだと分かる見た目である**ことで測る（CLAUDE.md 禁じ手④）。
      // 「同じ役目どうしが同じ塗り方か」は test-logic の HN-1 が受け持つ
      // 2026-08-20 便II・⑥: 行の「作った！」も整理モードの中に移った
      await openDayOrganize(tuPage)
      const tuCookedBtn = tuPage.getByRole('button', { name: '作った！', exact: true }).first()
      const tuBtnCls = (await tuCookedBtn.getAttribute('class')) ?? ''
      const tuBtnBox = await tuCookedBtn.boundingBox()
      check(
        'TODAYUNDO-01(便DP-3) 行の「作った！」が、押せると分かる見た目のボタンになっている',
        // 塗り（bg-accent）か枠（border-accent）のどちらかを持ち、文字ラベルがあり、押せる高さがある
        (tuBtnCls.includes('bg-accent') || tuBtnCls.includes('border-accent')) &&
          (await tuCookedBtn.innerText()).includes('作った') &&
          !!tuBtnBox &&
          tuBtnBox.height >= 44,
        `class=${tuBtnCls} h=${tuBtnBox?.height}`,
      )
      check(
        'TODAYUNDO-01(便DP-3) 「作った！」が何をするかの1行説明が添えてある',
        ((await tuPage.textContent('body')) ?? '').includes(ja.mealPlan.todayMarkCookedHint),
      )
      await tuCookedBtn.click()
      await tuPage.waitForTimeout(700)
      const tuAfterCooked = (await tuPage.textContent('body')) ?? ''
      check(
        'TODAYUNDO-01 ☑で記録した直後にトーストと「元に戻す」が出る',
        tuAfterCooked.includes('作った記録をつけました') && tuAfterCooked.includes('元に戻す'),
      )
      const readState = () =>
        tuPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction(['recipes', 'todayList'], 'readonly')
                let recipes, today
                const rq = tx.objectStore('recipes').getAll()
                const tq = tx.objectStore('todayList').getAll()
                rq.onsuccess = () => {
                  recipes = rq.result
                  if (today !== undefined) resolve({ recipes, today })
                }
                tq.onsuccess = () => {
                  today = tq.result
                  if (recipes !== undefined) resolve({ recipes, today })
                }
                rq.onerror = () => reject(rq.error)
                tq.onerror = () => reject(tq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
      const tuCooked = await readState()
      const tuNikujaga = tuCooked.recipes.find((r) => r.title === '肉じゃが')
      check('TODAYUNDO-01 前提: 記録が1件付き、今日の献立から消える', 
        (tuNikujaga?.cookedLogs?.length ?? 0) === 1 && tuCooked.today.length === 0)

      await tuPage.getByRole('button', { name: '元に戻す' }).click()
      await tuPage.waitForTimeout(800)
      const tuUndone = await readState()
      const tuNikujaga2 = tuUndone.recipes.find((r) => r.title === '肉じゃが')
      check(
        'TODAYUNDO-01 「元に戻す」で作った記録が消える',
        (tuNikujaga2?.cookedLogs?.length ?? 0) === 0,
        `logs=${JSON.stringify(tuNikujaga2?.cookedLogs ?? [])}`,
      )
      check(
        'TODAYUNDO-01 「元に戻す」でその品が今日の献立へ戻る',
        tuUndone.today.length === 1 && tuUndone.today[0].recipeId === tuNikujaga2?.id,
      )
      check(
        'TODAYUNDO-01 取り消したことを結果メッセージで伝える',
        stripZwspText(await tuPage.textContent('body')).includes(ja.mealPlan.todayCookedUndone),
      )
    } finally {
      await tuBrowser.close()
    }
  }

  // --- PLANUNDO-01: 献立の×で外したものを、そのトーストから1回で戻せる(2026-08-18 便HQ・軸1)。
  // それまでは「作った！」(記録が増えるだけ・あとから消せる)に「元に戻す」が付いていて、
  // 本当に献立が消える×の側には無かった＝守りが逆向きに付いていた。
  // 日タブの「今週の献立の予定」の×(今日と今週の両方から外す)と、週タブの行の×
  // (それまでトーストすら出ず、消えたのかどうかも分からなかった)の2つを、戻した結果まで確かめる ---
  currentCheck = 'PLANUNDO-01'
  {
    const puBrowser = await chromium.launch()
    const puContext = await puBrowser.newContext()
    const puPage = await puContext.newPage()
    puPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PLANUNDO-01] ${err.message}`)
    })
    const puRead = () =>
      puPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction(['mealPlans', 'todayList'], 'readonly')
              let plans, today
              const pq = tx.objectStore('mealPlans').getAll()
              const tq = tx.objectStore('todayList').getAll()
              pq.onsuccess = () => {
                plans = pq.result
                if (today !== undefined) resolve({ plans, today })
              }
              tq.onsuccess = () => {
                today = tq.result
                if (plans !== undefined) resolve({ plans, today })
              }
              pq.onerror = () => reject(pq.error)
              tq.onerror = () => reject(tq.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await puPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(1800) // 初回シード完了待ち
      await puPage.getByText('肉じゃが', { exact: true }).first().click()
      await puPage.waitForTimeout(500)
      await puPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await puPage.waitForTimeout(300)
      await slotBtnExceptFill(puPage, ja.mealPlan.slot.dinner).click()
      await puPage.waitForTimeout(500)
      await puPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(1200)
      const puBefore = await puRead()
      check(
        'PLANUNDO-01 前提: 今週の予定と今日の献立の両方に入っている',
        puBefore.plans.length === 1 && puBefore.today.length === 1,
        JSON.stringify(puBefore),
      )

      // (1) 日タブ「今週の献立の予定」の×
      // 2026-08-20 便IG・①: ×は「整理」モードの中にしか出ないので、先に整理へ入る
      await openDayOrganize(puPage)
      await puPage
        .locator(`[data-testid="day-planned"] button[aria-label="${ja.mealPlan.todayPlannedRemove}"]`)
        .first()
        .click()
      await puPage.waitForTimeout(600)
      const puRemoved = await puRead()
      check(
        'PLANUNDO-01 日タブの×で、今週の予定と今日の献立の両方から外れる',
        puRemoved.plans.length === 0 && puRemoved.today.length === 0,
        JSON.stringify(puRemoved),
      )
      check(
        'PLANUNDO-01 外したことをトーストで伝える',
        ((await puPage.textContent('body')) ?? '').includes(
          ja.mealPlan.todayPlannedRemovedToast.replace('「{title}」', ''),
        ),
      )
      const puUndo = puPage.getByRole('button', { name: '元に戻す' })
      check('PLANUNDO-01 そのトーストに「元に戻す」が出る', (await puUndo.count()) > 0)
      if ((await puUndo.count()) > 0) {
        await puUndo.first().click()
        await puPage.waitForTimeout(800)
        const puUndone = await puRead()
        check(
          'PLANUNDO-01 「元に戻す」で今週の予定が同じ日・同じ食事へ戻る',
          puUndone.plans.length === 1 &&
            puUndone.plans[0].date === puBefore.plans[0].date &&
            puUndone.plans[0].slot === puBefore.plans[0].slot &&
            puUndone.plans[0].recipeId === puBefore.plans[0].recipeId,
          JSON.stringify(puUndone.plans),
        )
        check(
          'PLANUNDO-01 「元に戻す」で今日の献立にも戻る',
          puUndone.today.length === 1 &&
            puUndone.today[0].recipeId === puBefore.today[0].recipeId,
          JSON.stringify(puUndone.today),
        )
        check(
          'PLANUNDO-01 日タブの「今週の献立の予定」に料理名が戻っている',
          ((await puPage.locator('[data-testid="day-planned"]').textContent()) ?? '').includes(
            '肉じゃが',
          ),
        )
      }

      // (2) 週タブの行の×(旧: 無言で消えていた)
      await puPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(puPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await puPage.waitForTimeout(800)
      // 2026-08-22 便IV: ×（献立から外す）は編集モードの中にしか出さない
      const puToday = await puPage.evaluate(() => {
        const d = new Date()
        const p2 = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
      })
      check(
        'PLANUNDO-01 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(puPage, puToday)) === true,
      )
      const puWeekClear = puPage.locator(`button[aria-label="${ja.mealPlan.clear}"]`).first()
      check('PLANUNDO-01 前提: 週タブに割り当ての×がある', (await puWeekClear.count()) > 0)
      if ((await puWeekClear.count()) > 0) {
        await puWeekClear.click()
        await puPage.waitForTimeout(600)
        check('PLANUNDO-01 週タブの×で予定が減る', (await puRead()).plans.length === 0)
        check(
          'PLANUNDO-01 週タブの×でも、外したことをトーストで伝える',
          ((await puPage.textContent('body')) ?? '').includes('から「肉じゃが」を外しました'),
        )
        const puWeekUndo = puPage.getByRole('button', { name: '元に戻す' })
        check('PLANUNDO-01 週タブの×のトーストにも「元に戻す」が出る', (await puWeekUndo.count()) > 0)
        if ((await puWeekUndo.count()) > 0) {
          await puWeekUndo.first().click()
          await puPage.waitForTimeout(800)
          const puWeekUndone = await puRead()
          check(
            'PLANUNDO-01 「元に戻す」で、同じ日・同じ食事・同じ役割の枠へ戻る',
            puWeekUndone.plans.length === 1 &&
              puWeekUndone.plans[0].date === puBefore.plans[0].date &&
              puWeekUndone.plans[0].slot === puBefore.plans[0].slot &&
              puWeekUndone.plans[0].role === puBefore.plans[0].role &&
              puWeekUndone.plans[0].recipeId === puBefore.plans[0].recipeId,
            JSON.stringify(puWeekUndone.plans),
          )
          check(
            'PLANUNDO-01 週タブの画面にも料理名が戻っている',
            ((await puPage.textContent('body')) ?? '').includes('肉じゃが'),
          )
        }
      }
    } finally {
      await puBrowser.close()
    }
  }


  // --- DAYORG-01: 「今日の献立」の「作った！」と×は「整理」の中だけに出す
  // (2026-08-20 便IG・① → 便II・⑥で「作った！」「全て作った！」も中へ)。
  // オーナー原文(便IG)「「作った！」と×が邪魔。作った！をつけるときにはモード切り替えするようにしたら
  // 解決できる？全て作った！も含めて。」→ 便IGはA案＝**×だけ**をモードの中へ移したが、
  // オーナーが実機を見て裁定をひっくり返した(便II・⑥の原文「整理に作った！も入れたい。
  // 作った！が気軽にできないよりも、献立を１画面で確認できない方が問題では？」)。
  // 見張るのは ①整理でないときは「作った！」も「全て作った！」も×も出ていない(料理名の行だけ)
  // ②整理にすると3つとも出る ③外した後に元に戻せる ④「完了」で3つとも引っ込む。
  // **対で見るもの**: 「◯食に入れる」は整理モードの外にも出したまま(司令部の裁定)。
  // 「整理」は減らす・終わらせる操作の集まりで、「これから決める」操作は性質が違う。
  // 「レシピ一覧から選択中」はレシピを選んだ直後の一時的な状態なので、次にやることを
  // モードの奥に入れると、選んだ直後に手が止まる(流れの途中に行き止まりを作らない)。
  // 掴み方は読み上げの名前(aria-label)と ja.ts の文言だけ＝どの入れ子・どの並びに出ていても
  // 同じ判定になる(禁じ手④)。数え上げが0件で素通りしないよう、前提(2品の料理名が並んでいる)を
  // 先に測ってから本題に入る(禁じ手「見つからなかった＝合格」対策) ---
  currentCheck = 'DAYORG-01'
  {
    const doBrowser = await chromium.launch()
    const doContext = await doBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const doPage = await doContext.newPage()
    doPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DAYORG-01] ${err.message}`)
    })
    const doRead = (table) =>
      doPage.evaluate(
        (name) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const store = req.result.transaction(name, 'readonly').objectStore(name)
              const q = store.getAll()
              q.onsuccess = () => resolve(q.result)
              q.onerror = () => reject(q.error)
            }
            req.onerror = () => reject(req.error)
          }),
        table,
      )
    const doRemoveButtons = () =>
      doPage.locator(
        `button[aria-label="${ja.mealPlan.todayRemove}"], button[aria-label="${ja.mealPlan.todayPlannedRemove}"]`,
      )
    // 「朝食に入れる」「昼食に入れる」「夕食に入れる」。名前は ja.ts から組み立てる
    // （画面の字を書き写さない。食事の呼び名が変わってもこの検査は動く）
    const doSlotNames = ['breakfast', 'lunch', 'dinner'].map((slot) =>
      ja.mealPlan.planMismatchAddToSlot.replace('{slot}', ja.mealPlan.slot[slot]),
    )
    const doSlotButtons = () =>
      doPage.locator(doSlotNames.map((n) => `button:text-is("${n}")`).join(', '))
    try {
      await doPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await doPage.waitForTimeout(1800) // 初回シード完了待ち
      // ①今週の献立の予定に入る品(夕食) ②レシピ一覧から選択中に入る品(食事を決めずに追加)
      await doPage.getByText('肉じゃが', { exact: true }).first().click()
      await doPage.waitForTimeout(500)
      await doPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await doPage.waitForTimeout(300)
      await slotBtnExceptFill(doPage, ja.mealPlan.slot.dinner).click()
      await doPage.waitForTimeout(600)
      await doPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await doPage.waitForTimeout(900)
      await doPage.getByText('ほうれん草のおひたし', { exact: true }).first().click()
      await doPage.waitForTimeout(500)
      await doPage.getByRole('button', { name: ja.detail.todayAdd }).click()
      await doPage.waitForTimeout(300)
      await doPage
        .getByRole('button', { name: ja.detail.todaySlotUndecided })
        .click()
      await doPage.waitForTimeout(600)

      await doPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await doPage.waitForTimeout(1500)
      const doCooked = doPage.getByRole('button', { name: ja.mealPlan.todayMarkCooked, exact: true })
      const doAll = doPage.getByRole('button', { name: ja.mealPlan.todayMarkAllCooked, exact: true })
      const doBody0 = ((await doPage.textContent('body')) ?? '').replaceAll('​', '')
      check(
        'DAYORG-01 前提: 今日の献立に2品の料理名が並んでいる',
        doBody0.includes('肉じゃが') && doBody0.includes('ほうれん草のおひたし'),
        `本文に肉じゃが=${doBody0.includes('肉じゃが')} ほうれん草のおひたし=${doBody0.includes('ほうれん草のおひたし')}`,
      )

      // ---------- ① 整理でないときは、料理名の行だけ(2026-08-20 便II・⑥) ----------
      check(
        'DAYORG-01(①) 整理モードでないときは、献立から外す×がどこにも出ていない',
        (await doRemoveButtons().count()) === 0,
        `×=${await doRemoveButtons().count()}`,
      )
      check(
        'DAYORG-01(⑥) 整理モードでないときは、行の「作った！」がどこにも出ていない',
        (await doCooked.count()) === 0,
        `作った！=${await doCooked.count()}`,
      )
      check(
        'DAYORG-01(⑥) 整理モードでないときは、「全て作った！」も出ていない',
        (await doAll.count()) === 0,
        `全て作った！=${await doAll.count()}`,
      )
      check(
        'DAYORG-01(⑥) 整理モードでないときは、「作った！」の説明の1行も出ていない(出ていない操作の説明を先に読ませない)',
        !doBody0.includes(ja.mealPlan.todayMarkCookedHint),
      )
      // 「◯食に入れる」だけは整理モードの外にも出す(司令部の裁定)。
      // 3つの食事ぶんそろって出ることまで見る＝1つだけ残った状態を合格にしない
      check(
        'DAYORG-01(裁定) 整理モードでなくても「◯食に入れる」は出したまま(選んだ直後の行き止まりを作らない)',
        (await doSlotButtons().count()) === doSlotNames.length,
        `◯食に入れる=${await doSlotButtons().count()} / 期待=${doSlotNames.length}`,
      )

      // ---------- ② 整理にすると出る ----------
      const doToggle = doPage.getByRole('button', {
        name: ja.mealPlan.todayOrganizeToggle,
        exact: true,
      })
      const doToggleBox = (await doToggle.count()) === 1 ? await doToggle.boundingBox() : null
      check(
        'DAYORG-01(①) 「今日の献立」に整理へ入るボタンが1つあり、指で押せる大きさ(44px以上)',
        (await doToggle.count()) === 1 && !!doToggleBox && doToggleBox.height >= 44,
        `数=${await doToggle.count()} 高さ=${doToggleBox?.height}`,
      )
      if ((await doToggle.count()) === 1) {
        await doToggle.click()
        await doPage.waitForTimeout(500)
      }
      check(
        'DAYORG-01(①) 整理モードにすると、2品ぶんの×が出る',
        (await doRemoveButtons().count()) === 2,
        `×=${await doRemoveButtons().count()}`,
      )
      check(
        'DAYORG-01(⑥) 整理モードにすると、2品ぶんの「作った！」が出る',
        (await doCooked.count()) === 2 && (await doCooked.first().isVisible()),
        `作った！=${await doCooked.count()}`,
      )
      check(
        'DAYORG-01(⑥) 整理モードにすると、「全て作った！」も出る',
        (await doAll.count()) === 1 && (await doAll.isVisible()),
        `全て作った！=${await doAll.count()}`,
      )
      check(
        'DAYORG-01(裁定) 整理モードにしても「◯食に入れる」は消えない(モードの内と外で同じ場所にある)',
        (await doSlotButtons().count()) === doSlotNames.length,
        `◯食に入れる=${await doSlotButtons().count()}`,
      )
      const doBody1 = ((await doPage.textContent('body')) ?? '').replaceAll('​', '')
      check(
        'DAYORG-01(①) 整理モードで何ができるかの1行が読める',
        doBody1.includes(ja.mealPlan.todayOrganizeHint),
      )
      check(
        'DAYORG-01(⑥) 整理モードでは「作った！」の説明の1行も読める',
        doBody1.includes(ja.mealPlan.todayMarkCookedHint),
      )

      // ---------- ③ 外した後に元に戻せる(便HQの「元に戻す」が遠くならない) ----------
      const doBefore = { today: await doRead('todayList'), plans: await doRead('mealPlans') }
      check(
        'DAYORG-01 前提: 今日の献立2件・今週の予定1件が端末に入っている',
        doBefore.today.length === 2 && doBefore.plans.length === 1,
        `today=${doBefore.today.length} plans=${doBefore.plans.length}`,
      )
      const doPlannedRemove = doPage.locator(
        `button[aria-label="${ja.mealPlan.todayPlannedRemove}"]`,
      )
      if ((await doPlannedRemove.count()) > 0) {
        await doPlannedRemove.first().click()
        await doPage.waitForTimeout(900)
        const doAfter = { today: await doRead('todayList'), plans: await doRead('mealPlans') }
        check(
          'DAYORG-01(①) 整理モードの×で、今日と今週の献立の両方から外れる',
          doAfter.today.length === 1 && doAfter.plans.length === 0,
          `today=${doAfter.today.length} plans=${doAfter.plans.length}`,
        )
        const doUndo = doPage.getByRole('button', { name: ja.common.undo, exact: true })
        check('DAYORG-01(①) 外した直後のお知らせに「元に戻す」が出る', (await doUndo.count()) === 1)
        if ((await doUndo.count()) === 1) {
          await doUndo.click()
          await doPage.waitForTimeout(1000)
          const doUndone = { today: await doRead('todayList'), plans: await doRead('mealPlans') }
          check(
            'DAYORG-01(①) 「元に戻す」で今日の献立にも今週の予定にも戻る',
            doUndone.today.length === 2 &&
              doUndone.plans.length === 1 &&
              doUndone.plans[0].date === doBefore.plans[0].date &&
              doUndone.plans[0].slot === doBefore.plans[0].slot &&
              doUndone.plans[0].recipeId === doBefore.plans[0].recipeId,
            `today=${doUndone.today.length} plans=${JSON.stringify(doUndone.plans)}`,
          )
        }
      }

      // ---------- 「完了」で元の並びに戻る ----------
      const doDone = doPage.getByRole('button', { name: ja.mealPlan.todayOrganizeDone, exact: true })
      check('DAYORG-01(①) 整理モード中は「完了」で抜けられる', (await doDone.count()) === 1)
      if ((await doDone.count()) === 1) {
        await doDone.click()
        await doPage.waitForTimeout(500)
        check(
          'DAYORG-01(⑥) 「完了」で×も「作った！」も「全て作った！」も引っ込む(料理名の行だけに戻る)',
          (await doRemoveButtons().count()) === 0 &&
            (await doCooked.count()) === 0 &&
            (await doAll.count()) === 0,
          `×=${await doRemoveButtons().count()} 作った！=${await doCooked.count()} 全て作った！=${await doAll.count()}`,
        )
        check(
          'DAYORG-01(⑥) 「完了」で引っ込むのは操作だけで、料理名の行は残る',
          ((await doPage.textContent('body')) ?? '').replaceAll('​', '').includes('肉じゃが'),
        )
        check(
          'DAYORG-01(裁定) 「完了」で戻しても「◯食に入れる」は残る',
          (await doSlotButtons().count()) === doSlotNames.length,
          `◯食に入れる=${await doSlotButtons().count()}`,
        )
      }
    } finally {
      await doBrowser.close()
    }
  }
