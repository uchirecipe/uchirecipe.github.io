// ==========================================================================================
// e2e の節: 便IZ〜JI（週の編集モード・行の高さ・安全）
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
// この中の節: IZEDIT-01, IZTHEME-02, IZSTATE-03, JFPAST-01, JFMARK-02, JFUI-03, JELINE-02, JECARD-01, JEPART-03, JEGAP-04, JFASSIGN-04, JFBACK-05, JFLOCK-06, JFDEL-07, JFLOCKEDIT-08, JFCLEAR-09, JHSAFE-01, JIPRICE-01
// ==========================================================================================
import './_shared.mjs'

  // --- IZEDIT-01(2026-08-22 便IZ): 週タブの**編集モード**でも料理名が読める・操作が指で押せる ---
  //
  // 便IV は通常表示だけを直し、編集モードには**直す前の数字がそのまま残っていた**。
  // 実測（この節を足す前）: 料理名の幅は 390pxで119px＝7文字・320pxで49px＝3文字
  // （「肉じゃが」すら切れる）。オーナーが最初に挙げた困りごと
  // 「「豆腐ときの…」「レンジ蒸し…」「鶏胸肉の…」だとなんなのかわからない」そのもので、
  // 編集モードは「気になるところのレシピを変更する」画面なので、どの料理を差し替えようと
  // しているのかが読めないと用をなさない。
  // あわせて、同じ横1行に操作が詰まっていた（サイコロ34px角・食数27×15px・
  // 「レシピを見る」高さ16px・サイコロと×の間隔3px）。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①編集モードの料理名が、通常表示と**同じ幅**で読める（片方だけ広い、を作らない）
  //   ②狭い画面(320px＝古いiPhone SE相当)でも、通常表示・編集モードとも横スクロールが出ない
  //   ③編集モードの押せるものが**すべて44px以上**で、隣の操作と**12px以上**離れている
  //     （2026-08-22に「作った！」と×が8pxまで詰まっていた実例の再発防止）
  //   ④長い料理名（16〜17字）でも行が2行に崩れない
  // 禁じ手よけ: 文字数・品数・押す回数を決め打ちしない／曜日・月替わりに依らない（今日のカードを使う。
  // 今日は必ず表示中の週にある）／ゼロ幅スペースを外してから測る／畳み方が落ち着いてから掴む
  currentCheck = 'IZEDIT-01'
  {
    const izBrowser = await chromium.launch()
    try {
      for (const izWidth of [390, 320]) {
        const izContext = await izBrowser.newContext({ viewport: { width: izWidth, height: 844 } })
        const izPage = await izContext.newPage()
        izPage.on('pageerror', (err) => {
          if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
          errors.push(`[pageerror@IZEDIT-01/${izWidth}] ${err.message}`)
        })
        try {
          await izPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await izPage.waitForTimeout(2400) // 初回シード完了待ち
          await izPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
          await izPage.reload({ waitUntil: 'networkidle' })
          await izPage.waitForTimeout(1800)
          await izPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await izPage.waitForTimeout(1200)
          // 測る対象（献立の入った日）を作ってから測る
          await izPage.locator('[data-testid="week-fill-run"]').first().click()
          await izPage.waitForTimeout(2600)
          await openAllWeekDays(izPage)
          await izPage.waitForTimeout(600)
          const izToday = await izPage.evaluate(() => {
            const d = new Date()
            const p = (n) => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
          })

          /** 今日のカードの1品カードを実測する（料理名の幅・その幅に何文字入るか・行の高さ） */
          const izCards = () =>
            izPage.evaluate((date) => {
              const section = document.querySelector(`section[data-date="${date}"]`)
              if (!section) return null
              const cvs = document.createElement('canvas').getContext('2d')
              return [...section.querySelectorAll('[data-testid="row-recipe"]')].map((el) => {
                const title = el.querySelector('[data-testid="row-title"]')
                const cs = title ? getComputedStyle(title) : null
                if (cs) cvs.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
                const text = (title?.textContent ?? '').replaceAll('​', '')
                const tw = title ? title.getBoundingClientRect().width : 0
                let fit = 0
                if (cs) {
                  for (let i = 1; i <= Math.max(text.length, 24); i++) {
                    const probe = i <= text.length ? text.slice(0, i) : text + 'あ'.repeat(i - text.length)
                    if (cvs.measureText(probe).width <= tw) fit = i
                    else break
                  }
                }
                const r = el.getBoundingClientRect()
                return { title: text, titleWidth: Math.round(tw), fit, height: Math.round(r.height) }
              })
            }, izToday)

          const izView = await izCards()
          check(
            `IZEDIT-01 [${izWidth}px] 前提: 通常表示の1品カードを実測できた`,
            Array.isArray(izView) && izView.length > 0 && izView.every((c) => c.title.length > 0 && c.titleWidth > 0),
            JSON.stringify(izView),
          )
          const izHscroll = () =>
            izPage.evaluate(() => ({
              doc: document.documentElement.scrollWidth,
              client: document.documentElement.clientWidth,
            }))
          const izViewScroll = await izHscroll()
          check(
            `IZEDIT-01 [${izWidth}px] 通常表示で横スクロールが出ない`,
            izViewScroll.doc <= izViewScroll.client,
            JSON.stringify(izViewScroll),
          )

          // 編集モードへ
          const izEditBtn = izPage.locator(`[data-testid="week-day-edit"][data-date="${izToday}"]`)
          check(`IZEDIT-01 [${izWidth}px] 前提: 今日の編集の切り替えを掴めた`, (await izEditBtn.count()) === 1)
          if ((await izEditBtn.count()) === 1) {
            await izEditBtn.click()
            await izPage.waitForTimeout(900)
          }
          const izEdit = await izCards()
          check(
            `IZEDIT-01 [${izWidth}px] 前提: 編集モードの1品カードを実測できた`,
            Array.isArray(izEdit) && izEdit.length > 0 && izEdit.every((c) => c.titleWidth > 0),
            JSON.stringify(izEdit),
          )
          // ①料理名の幅は通常表示と同じ（操作に幅を削られていない）。
          //   直す前は 通常251px / 編集119px（390px幅）と、モードで倍以上ちがっていた
          const izViewW = Array.isArray(izView) && izView.length > 0 ? izView[0].titleWidth : -1
          const izEditW = Array.isArray(izEdit) && izEdit.length > 0 ? izEdit[0].titleWidth : -2
          check(
            `IZEDIT-01 [${izWidth}px] 編集モードの料理名が、通常表示と同じ幅で読める`,
            izViewW > 0 && izEditW === izViewW,
            `通常=${izViewW}px 編集=${izEditW}px`,
          )
          const izEditFit = Array.isArray(izEdit) && izEdit.length > 0 ? Math.min(...izEdit.map((c) => c.fit)) : 0
          const izViewFit = Array.isArray(izView) && izView.length > 0 ? Math.min(...izView.map((c) => c.fit)) : 0
          // 上限を決め打ちしない＝「直す前(390px=7文字 / 320px=3文字)より確実に多い」の向きだけ見る。
          // 狭い画面のほうが少なくなるのは当たり前なので、下限は画面の幅で分ける
          const izNeed = izWidth >= 390 ? 12 : 9
          check(
            `IZEDIT-01 [${izWidth}px] 編集モードで料理名が${izNeed}文字以上読める（直す前は390px=7文字・320px=3文字）`,
            izEditFit >= izNeed,
            `編集=${izEditFit}文字 / 通常=${izViewFit}文字`,
          )
          // ④長い料理名でも1行のまま（行が2行に割れて他の品と重ならない）
          const izTallest = Array.isArray(izEdit) && izEdit.length > 0 ? Math.max(...izEdit.map((c) => c.height)) : 0
          check(
            `IZEDIT-01 [${izWidth}px] 長い料理名でも1品カードの行が崩れない（高さが揃っている）`,
            Array.isArray(izEdit) &&
              izEdit.length > 0 &&
              izTallest < 60 &&
              new Set(izEdit.map((c) => c.height)).size === 1,
            JSON.stringify(izEdit.map((c) => ({ len: c.title.length, h: c.height }))),
          )
          const izEditScroll = await izHscroll()
          check(
            `IZEDIT-01 [${izWidth}px] 編集モードでも横スクロールが出ない`,
            izEditScroll.doc <= izEditScroll.client,
            JSON.stringify(izEditScroll),
          )

          // ③押せる大きさと間隔。今日のカードの中に出ている押せるものを全部測る
          const izTaps = await izPage.evaluate(
            ({ date }) => {
              const section = document.querySelector(`section[data-date="${date}"]`)
              if (!section) return null
              /** 押せる面の実寸。器(.tap-target)を着けたものは ::after が広げるぶんまで含めて測る */
              const tapBox = (el) => {
                const r = el.getBoundingClientRect()
                let l = r.left
                let t = r.top
                let w = r.width
                let h = r.height
                if (el.classList.contains('tap-target')) {
                  const cs = getComputedStyle(el, '::after')
                  const aw = parseFloat(cs.width) || 0
                  const ah = parseFloat(cs.height) || 0
                  if (aw > w) { l -= (aw - w) / 2; w = aw }
                  if (ah > h) { t -= (ah - h) / 2; h = ah }
                }
                return { l, t, w, h }
              }
              const items = [...section.querySelectorAll('button, a, select, input')]
                .filter((el) => el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0)
                .map((el) => ({
                  name: ((el.getAttribute('aria-label') || el.textContent) ?? '')
                    .replaceAll('​', '')
                    .trim()
                    .slice(0, 24) || el.tagName,
                  ...tapBox(el),
                }))
              const small = items
                .filter((a) => a.w < 44 || a.h < 44)
                .map((a) => ({ name: a.name, size: `${Math.round(a.w)}x${Math.round(a.h)}` }))
              const near = []
              for (let i = 0; i < items.length; i++) {
                for (let j = i + 1; j < items.length; j++) {
                  const a = items[i]
                  const b = items[j]
                  const gx = Math.max(0, Math.max(a.l, b.l) - Math.min(a.l + a.w, b.l + b.w))
                  const gy = Math.max(0, Math.max(a.t, b.t) - Math.min(a.t + a.h, b.t + b.h))
                  if (gx === 0 && gy === 0) continue // 入れ子・重なりは間隔ではない
                  const g = Math.hypot(gx, gy)
                  if (g < 12) near.push({ a: a.name, b: b.name, gap: Math.round(g) })
                }
              }
              return { count: items.length, small, near }
            },
            { date: izToday },
          )
          check(
            `IZEDIT-01 [${izWidth}px] 前提: 編集モードの押せるものを読めた`,
            izTaps !== null && izTaps.count > 0,
            JSON.stringify(izTaps),
          )
          check(
            `IZEDIT-01 [${izWidth}px] 編集モードの操作がすべて指で押せる大きさ(44px以上)`,
            izTaps !== null && izTaps.small.length === 0,
            `44px未満=${JSON.stringify(izTaps?.small)}`,
          )
          check(
            `IZEDIT-01 [${izWidth}px] 12px未満に密着した操作の組が無い（押し間違えない）`,
            izTaps !== null && izTaps.near.length === 0,
            `近すぎる組=${JSON.stringify(izTaps?.near)}`,
          )
        } finally {
          await izContext.close()
        }
      }
    } finally {
      await izBrowser.close()
    }
  }

  // --- IZTHEME-02(2026-08-22 便IZ): 週タブの新しい部品が、5テーマとも背景と見分けられる ---
  //
  // 2026-08-21（便IU・③）に「プルダウンの地色が置かれている面と枠1本しか違わない」＝
  // オーナーが「気のせい？」と言ったものが気のせいではなかった実例がある（差15.3／16.9）。
  // 同じ見落としが便IVの新しい部品（鍵の印・編集の切り替え）に無いかを**数値で**見張る。
  // 測るのは**実際に塗られる色**（color-mix()の計算値はoklab()で返るので、キャンバスに1px塗って
  // ブラウザが本当に描く値を読み出す）。直接の色の値は書かない＝**見分けが付くか**と
  // **文字・図形が読めるか**だけを測る（テーマの色を変えたらここも直す、では見張りにならない）。
  //
  // 実測（この節を足した時点。390×844）:
  //   鍵の印と後ろの面の差 … ライト303.0 / ダーク230.3 / ブラウン260.0 / グリーン266.4
  //   鍵の中のアイコン（図形）のコントラスト … ライト4.52 / ダーク7.36 / ブラウン3.26 / グリーン3.25
  //   編集の切り替えの文字 … ライト5.10 / ダーク5.34 / ブラウン5.49 / グリーン6.25
  // ブラウン・グリーンの鍵のアイコンは 3.25 と下限すれすれなので、これ以上薄くしたら赤くなる
  currentCheck = 'IZTHEME-02'
  {
    const izDist = (a, b) => Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2)
    const izLum = (c) => {
      const f = (v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const izRatio = (a, b) => (Math.max(izLum(a), izLum(b)) + 0.05) / (Math.min(izLum(a), izLum(b)) + 0.05)
    const izHex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const izBrowser = await chromium.launch()
    try {
      for (const [izTheme, izLabel, izScheme] of [
        ['auto', '自動（端末=ライト）', 'light'],
        ['auto', '自動（端末=ダーク）', 'dark'],
        ['light', 'ライト', 'dark'],
        ['dark', 'ダーク', 'light'],
        ['brown', 'ブラウン', 'light'],
        ['green', 'グリーン', 'dark'],
      ]) {
        const izContext = await izBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: izScheme,
        })
        const izPage = await izContext.newPage()
        try {
          await izPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await izPage.waitForTimeout(2400)
          await izPage.evaluate(async (theme) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
            const cur = await P(idb.transaction('settings').objectStore('settings').get(1))
            await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({ ...(cur || {}), id: 1, theme }))
            idb.close()
          }, izTheme)
          await izPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
          await izPage.reload({ waitUntil: 'networkidle' })
          await izPage.waitForTimeout(1800)
          await izPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
          await izPage.waitForTimeout(1200)
          await izPage.locator('[data-testid="week-fill-run"]').first().click()
          await izPage.waitForTimeout(2600)
          await openAllWeekDays(izPage)
          await izPage.waitForTimeout(600)
          const izToday = await izPage.evaluate(() => {
            const d = new Date()
            const p = (n) => String(n).padStart(2, '0')
            return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
          })
          // 鍵の印は「鍵の掛かった食事」にしか出ないので、今日の鍵を掛けてから測る
          const izDayLock = izPage.locator(`[data-testid="day-lock"][data-date="${izToday}"]`)
          if ((await izDayLock.count()) === 1) {
            await izDayLock.click()
            await izPage.waitForTimeout(1200)
          }
          const izSeen = await izPage.evaluate((date) => {
            const cvs = document.createElement('canvas').getContext('2d')
            const toRgb = (v) => {
              cvs.clearRect(0, 0, 1, 1)
              cvs.fillStyle = v
              cvs.fillRect(0, 0, 1, 1)
              const d = cvs.getImageData(0, 0, 1, 1).data
              return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
            }
            // 後ろの面＝透けていない親をさかのぼって最初に見つかった地色
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
            const pick = (el) => {
              if (!el) return null
              const cs = getComputedStyle(el)
              return { bg: toRgb(cs.backgroundColor), behind: behindOf(el), color: toRgb(cs.color) }
            }
            const lock = section.querySelector('[data-testid="slot-lock-mark"]')
            const edit = section.querySelector('[data-testid="week-day-edit"]')
            return {
              lock: pick(lock),
              edit: pick(edit),
              lockAria: lock?.getAttribute('aria-label') ?? null,
              lockIcon: (() => {
                const svg = lock?.querySelector('svg')
                if (!svg) return null
                const r = svg.getBoundingClientRect()
                return { w: Math.round(r.width), h: Math.round(r.height) }
              })(),
            }
          }, izToday)
          check(
            `IZTHEME-02 [${izLabel}] 前提: 鍵の印と編集の切り替えを掴めた`,
            izSeen !== null && izSeen.lock !== null && izSeen.edit !== null,
            JSON.stringify(izSeen),
          )
          if (izSeen === null || izSeen.lock === null || izSeen.edit === null) {
            await izContext.close()
            continue
          }
          check(
            `IZTHEME-02 [${izLabel}] 鍵の印が後ろの面と見分けられる`,
            izDist(izSeen.lock.bg, izSeen.lock.behind) >= 20,
            `印=${izHex(izSeen.lock.bg)} 後ろの面=${izHex(izSeen.lock.behind)} 差=${izDist(izSeen.lock.bg, izSeen.lock.behind).toFixed(1)}`,
          )
          check(
            `IZTHEME-02 [${izLabel}] 鍵の絵が読める（図形の下限 3:1 以上）`,
            izRatio(izSeen.lock.color, izSeen.lock.bg) >= 3,
            `${izRatio(izSeen.lock.color, izSeen.lock.bg).toFixed(2)}:1`,
          )
          check(
            `IZTHEME-02 [${izLabel}] 鍵の印に読み上げの名前が付いている`,
            typeof izSeen.lockAria === 'string' && izSeen.lockAria.length > 0,
            `名前=${izSeen.lockAria}`,
          )
          check(
            `IZTHEME-02 [${izLabel}] 鍵の絵が小さすぎない（14px以上）`,
            izSeen.lockIcon !== null && izSeen.lockIcon.w >= 14 && izSeen.lockIcon.h >= 14,
            JSON.stringify(izSeen.lockIcon),
          )
          check(
            `IZTHEME-02 [${izLabel}] 編集の切り替えの文字が読める（AA 4.5:1以上）`,
            izRatio(izSeen.edit.color, izSeen.edit.bg) >= 4.5,
            `${izRatio(izSeen.edit.color, izSeen.edit.bg).toFixed(2)}:1`,
          )
        } finally {
          await izContext.close()
        }
      }
    } finally {
      await izBrowser.close()
    }
  }

  // --- IZSTATE-03(2026-08-22 便IZ): 編集モードのままあちこち動いても、おかしな状態にならない ---
  //
  // 見るのは「編集モードに入ったまま」①別の日の編集を押す ②週を送って戻る ③日タブへ行って戻る
  // ④画面ごと出て戻る ⑤その日を畳んで開き直す、の5つ。
  // 覚えているのは日付そのもの（logic/mealPlan.ts の planToggleDayEdit）なので、
  // 送った先の週にその日が無ければ編集モードのカードは出ない＝この節はその実際の姿を確かめる。
  // 曜日・月替わりに依らない: 使うのは「今日」と「今日より後で表示中の週にある日」だけ。
  currentCheck = 'IZSTATE-03'
  {
    const izBrowser = await chromium.launch()
    const izContext = await izBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const izPage = await izContext.newPage()
    izPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@IZSTATE-03] ${err.message}`)
    })
    const izEditOn = async (date) => {
      const l = izPage.locator(`[data-testid="week-day-edit"][data-date="${date}"]`)
      return (await l.count()) === 1 ? (await l.getAttribute('aria-pressed')) === 'true' : null
    }
    const izOpenWeek = async () => {
      await izPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await izPage.waitForTimeout(1200)
      await openAllWeekDays(izPage)
      await izPage.waitForTimeout(400)
    }
    try {
      await izPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await izPage.waitForTimeout(2400)
      await izPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await izPage.reload({ waitUntil: 'networkidle' })
      await izPage.waitForTimeout(1800)
      await izOpenWeek()
      await izPage.locator('[data-testid="week-fill-run"]').first().click()
      await izPage.waitForTimeout(2600)
      await openAllWeekDays(izPage)
      await izPage.waitForTimeout(600)
      const izToday = await izPage.evaluate(() => {
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      })
      // 2026-08-23 司令部（禁じ手①）: 上と同じ理由。日曜だと「今日より先の日」が同じ週に0日
      await selectWeekLayout(izPage, ja.mealPlan.weekLayoutRolling)
      await izPage.waitForTimeout(800)
      await izPage.locator('[data-testid="week-fill-run"]').first().click()
      await izPage.waitForTimeout(2600)
      await openAllWeekDays(izPage)
      await izPage.waitForTimeout(400)
      const izLater = await izPage.evaluate((today) => {
        for (const s of document.querySelectorAll('section[data-date]')) {
          const d = s.getAttribute('data-date')
          if (d && d > today) return d
        }
        return null
      }, izToday)
      check('IZSTATE-03 前提: 今日と、同じ週の先の日を掴めた', izLater !== null, `先の日=${izLater}`)
      const izPress = async (date) => {
        await izPage.locator(`[data-testid="week-day-edit"][data-date="${date}"]`).click()
        await izPage.waitForTimeout(700)
      }
      await izPress(izToday)
      check('IZSTATE-03 前提: 今日が編集モードに入った', (await izEditOn(izToday)) === true)

      // ①別の日の編集を押す → そちらへ移り、前の日は通常表示へ戻る（同時に2日が編集にならない）
      if (izLater) {
        await izPress(izLater)
        check(
          'IZSTATE-03 別の日の編集を押すと、前の日は通常表示へ戻る（編集は一度に1日だけ）',
          (await izEditOn(izToday)) === false && (await izEditOn(izLater)) === true,
          `今日=${await izEditOn(izToday)} 先の日=${await izEditOn(izLater)}`,
        )
        await izPress(izLater)
      }

      // ②編集モードのまま週を送る → 送った先に編集モードの日は無い。戻すと元どおり編集モード
      await izPress(izToday)
      const izNext = izPage.locator(`button[aria-label="${ja.mealPlan.nextWeek}"]`).first()
      const izPrev = izPage.locator(`button[aria-label="${ja.mealPlan.prevWeek}"]`).first()
      check(
        'IZSTATE-03 前提: 週を送る／戻すボタンを掴めた',
        (await izNext.count()) === 1 && (await izPrev.count()) === 1,
      )
      await izNext.click()
      await izPage.waitForTimeout(1600)
      await openAllWeekDays(izPage)
      await izPage.waitForTimeout(400)
      check(
        'IZSTATE-03 編集モードのまま週を送ると、送った先に編集モードの日が残らない',
        (await izPage.locator('[data-testid="week-day-edit"][aria-pressed="true"]').count()) === 0 &&
          (await izPage.locator(`section[data-date="${izToday}"]`).count()) === 0,
        `編集中=${await izPage.locator('[data-testid="week-day-edit"][aria-pressed="true"]').count()}件`,
      )
      await izPrev.click()
      await izPage.waitForTimeout(1600)
      await openAllWeekDays(izPage)
      await izPage.waitForTimeout(400)
      check(
        'IZSTATE-03 週を戻すと、編集していた日がそのまま編集モードで出る（作業の続きに戻れる）',
        (await izEditOn(izToday)) === true,
        `今日=${await izEditOn(izToday)}`,
      )

      // ③編集モードのまま日タブへ行って戻る
      await izPage.getByRole('button', { name: '日', exact: true }).click()
      await izPage.waitForTimeout(900)
      await izOpenWeek()
      check(
        'IZSTATE-03 日タブへ行って週タブへ戻っても、編集モードの日は同じ（勝手に別の日へ移らない）',
        (await izEditOn(izToday)) === true,
        `今日=${await izEditOn(izToday)}`,
      )

      // ④画面ごと出て戻る → 通常表示から始まる（編集モードで開きっぱなしにしない）
      await izPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await izPage.waitForTimeout(1200)
      await izPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await izPage.waitForTimeout(1800)
      await izOpenWeek()
      check(
        'IZSTATE-03 別の画面へ出て戻ると、通常表示から始まる',
        (await izEditOn(izToday)) === false,
        `今日=${await izEditOn(izToday)}`,
      )

      // ⑤編集モードのままその日を畳む → 切り替えは消えるが、開き直せば編集モードのまま
      //   （畳んだ行に押しても中身の見えない操作を並べない・行き止まりも作らない）
      await izPress(izToday)
      const izToggle = izPage.locator(`[data-testid="week-day-toggle"][data-date="${izToday}"]`)
      await izToggle.click()
      await izPage.waitForTimeout(700)
      check(
        'IZSTATE-03 畳んだ日には編集の切り替えを出さない',
        (await izPage.locator(`[data-testid="week-day-edit"][data-date="${izToday}"]`).count()) === 0,
      )
      await izToggle.click()
      await izPage.waitForTimeout(700)
      check(
        'IZSTATE-03 開き直すと編集モードのまま戻る（行き止まりにならない）',
        (await izEditOn(izToday)) === true,
        `今日=${await izEditOn(izToday)}`,
      )
    } finally {
      await izBrowser.close()
    }
  }


  // --- JFPAST-01: 過ぎた日の編集モードから「作った記録」を後から足せる（便JF・①） ---
  // 司令部の訂正: 芯は「編集モードのおかげで普段の見え方をシンプルに保てる」こと。
  // なので**通常表示には入口を1つも出さない**ことと、編集モードで足せることを両方測る。
  // 週は「前の週」へ1回送って測る＝週区切り(既定)なら曜日に関係なく7日とも過ぎた日になる
  // （今日が月曜だと今週に過ぎた日が1日も無い。禁じ手①＝曜日の前提を置かない）
  currentCheck = 'JFPAST-01'
  {
    const jaBrowser = await chromium.launch()
    const jaContext = await jaBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jaPage = await jaContext.newPage()
    jaPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFPAST-01] ${err.message}`)
    })
    try {
      await jaPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jaPage.waitForTimeout(2400) // 初回シード完了待ち
      await jaPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jaPage.waitForTimeout(900)
      await jaPage.getByRole('button', { name: ja.mealPlan.prevWeek, exact: true }).click()
      await openAllWeekDays(jaPage)
      await jaPage.waitForTimeout(700)
      // 掴む日は「画面に出ている日のうち今日より前のもの」＝並び順にも曜日にも依らない
      const jaPastDate = await jaPage.evaluate(() => {
        const d = new Date()
        const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const dates = [...document.querySelectorAll('section[data-date]')].map((el) =>
          el.getAttribute('data-date'),
        )
        return dates.find((x) => x && x < today) ?? null
      })
      check('JFPAST-01 前提: 過ぎた日のカードを掴めた', jaPastDate !== null, `date=${jaPastDate}`)
      const jaCard = jaPage.locator(`section[data-date="${jaPastDate}"]`)
      const jaAdd = jaCard.locator('[data-testid="past-record-add"]')
      check(
        'JFPAST-01 通常表示には「作った記録を追加」を出さない（普段の見え方は今までどおり）',
        (await jaAdd.count()) === 0,
        `入口=${await jaAdd.count()}件`,
      )
      const jaEditBtn = jaCard.locator('[data-testid="week-day-edit"]')
      check(
        'JFPAST-01 過ぎた日にも編集モードの切り替えがある',
        (await jaEditBtn.count()) === 1,
        `編集ボタン=${await jaEditBtn.count()}件`,
      )
      await jaEditBtn.first().click()
      await jaPage.waitForTimeout(500)
      check(
        'JFPAST-01 編集モードにすると「作った記録を追加」が出る',
        (await jaAdd.count()) === 1 && (await jaAdd.first().isVisible()),
        `入口=${await jaAdd.count()}件`,
      )
      check(
        'JFPAST-01 その入口は指で押せる大きさ(44px以上)',
        Math.round((await jaAdd.first().boundingBox())?.height ?? 0) >= 44,
        `高さ=${Math.round((await jaAdd.first().boundingBox())?.height ?? 0)}px`,
      )
      // 過ぎた日は献立の枠を出さない（今までの決めごとを編集モードでも崩さない）
      check(
        'JFPAST-01 過ぎた日の編集モードでも、献立の枠は出さない',
        (await jaCard.locator('[data-testid="slot-block"]').count()) === 0,
        `枠=${await jaCard.locator('[data-testid="slot-block"]').count()}件`,
      )
      const jaLogsBefore = await jaCard.locator('[data-testid="cooked-log-card"]').count()
      await jaAdd.first().click()
      await jaPage.waitForTimeout(700)
      check(
        'JFPAST-01 レシピを選ぶ一覧が開く',
        (await jaPage.locator('[data-testid="recipe-picker"]').count()) === 1,
      )
      await jaPage.locator('[data-testid="recipe-picker"] [data-testid="picker-item"]').first().click()
      await jaPage.waitForTimeout(1000)
      const jaLogsAfter = await jaCard.locator('[data-testid="cooked-log-card"]').count()
      check(
        'JFPAST-01 選んだ料理が、その日の「作った記録」に増える',
        jaLogsAfter === jaLogsBefore + 1,
        `前=${jaLogsBefore}件 後=${jaLogsAfter}件`,
      )
      const jaUndo = jaPage.getByRole('button', { name: '元に戻す', exact: true })
      check(
        'JFPAST-01 足したあとのトーストから1回で戻せる',
        (await jaUndo.count()) === 1,
        `元に戻す=${await jaUndo.count()}件`,
      )
      await jaUndo.first().click()
      await jaPage.waitForTimeout(900)
      check(
        'JFPAST-01 「元に戻す」で足した記録が消える',
        (await jaCard.locator('[data-testid="cooked-log-card"]').count()) === jaLogsBefore,
        `戻したあと=${await jaCard.locator('[data-testid="cooked-log-card"]').count()}件`,
      )
    } finally {
      await jaBrowser.close()
    }
  }

  // --- JFMARK-02: 記録がある日の印の大きさ（②）と、過ぎた日の面の色（③） ---
  currentCheck = 'JFMARK-02'
  {
    const jbBrowser = await chromium.launch()
    const jbContext = await jbBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jbPage = await jbContext.newPage()
    jbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFMARK-02] ${err.message}`)
    })
    /** 2つの色（'rgb(r, g, b)'）のコントラスト比。WCAGの式そのまま */
    const jbContrast = (a, b) => {
      const lum = (css) => {
        const [r, g, bl] = (css.match(/\d+(\.\d+)?/g) ?? [0, 0, 0]).slice(0, 3).map(Number)
        const ch = (v) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(bl)
      }
      const l1 = lum(a)
      const l2 = lum(b)
      return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100
    }
    try {
      await jbPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jbPage.waitForTimeout(2400)
      // 過ぎた日に記録を仕込む（生のIndexedDBへ書いたので必ず読み込み直す・禁じ手⑥）
      const jbSeed = await jbPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            d.setDate(d.getDate() - 8) // 「前の週」に必ず入る日（曜日に依らない）
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const r = g.result.find((x) => x.title === 'カレーライス')
                if (!r) {
                  reject(new Error('カレーライスが見つからない'))
                  return
                }
                r.cookedLogs = [{ date }, ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(date)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await jbPage.reload({ waitUntil: 'networkidle' })
      await jbPage.waitForTimeout(1400)
      await jbPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jbPage.waitForTimeout(900)
      // 仕込んだ日のカードが出る週まで送る（前後どちらへも送れる形にする）
      for (let i = 0; i < 4; i++) {
        if ((await jbPage.locator(`section[data-date="${jbSeed}"]`).count()) > 0) break
        const shown = await jbPage.locator('section[data-date]').first().getAttribute('data-date')
        await jbPage.locator(`button[aria-label="${shown && jbSeed < shown ? '前の週' : '次の週'}"]`).click()
        await jbPage.waitForTimeout(700)
      }
      check(
        'JFMARK-02 前提: 記録を仕込んだ過ぎた日のカードを出せる',
        (await jbPage.locator(`section[data-date="${jbSeed}"]`).count()) > 0,
        `仕込んだ日=${jbSeed}`,
      )
      // 印は畳んでいる日にだけ出る。過ぎた日の既定は「畳む」なので、そのまま測る
      const jbMark = jbPage.locator(`[data-testid="week-day-mark"][data-date="${jbSeed}"][data-mark="cooked"]`)
      check(
        'JFMARK-02 前提: 記録がある日の印を掴めた',
        (await jbMark.count()) === 1,
        `印=${await jbMark.count()}件`,
      )
      const jbMarkBox = await jbMark.locator('svg').first().boundingBox()
      check(
        'JFMARK-02 記録の印は16px以上（直す前は14px。一段階だけ上げる）',
        Math.round(jbMarkBox?.width ?? 0) >= 16 && Math.round(jbMarkBox?.height ?? 0) >= 16,
        `印の大きさ=${Math.round(jbMarkBox?.width ?? 0)}×${Math.round(jbMarkBox?.height ?? 0)}px`,
      )
      const jbMarkStroke = await jbMark.locator('svg').first().evaluate((el) => el.getAttribute('stroke-width'))
      check(
        'JFMARK-02 線も一段階だけ太くする（直す前は2）',
        Number(jbMarkStroke) > 2,
        `stroke-width=${jbMarkStroke}`,
      )
      // ③ 過ぎた日の面の色。今日以降のカードと違い、文字の色は変えていないこと
      /**
       * 面の色は color-mix で作っているので、getComputedStyle は oklab(...) のまま返す
       * （rgb に解いてくれない）。ブラウザ自身に1px塗らせて実際の色を読み出す
       * ＝2026-08-02 便CY と同じ測り方（近似の計算を自分で書かない）。
       */
      const jbResolve = (page, css) =>
        page.evaluate((value) => {
          const canvas = document.createElement('canvas')
          canvas.width = 1
          canvas.height = 1
          const ctx = canvas.getContext('2d')
          ctx.fillStyle = value
          ctx.fillRect(0, 0, 1, 1)
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
          return `rgb(${r}, ${g}, ${b})`
        }, css)
      const jbRead = async (date) => {
        const raw = await jbPage
          .locator(`section[data-date="${date}"]`)
          .first()
          .evaluate((el) => {
            const h = el.querySelector('h2')
            return {
              bg: getComputedStyle(el).backgroundColor,
              title: h ? getComputedStyle(h).color : null,
            }
          })
        return {
          bg: await jbResolve(jbPage, raw.bg),
          title: raw.title ? await jbResolve(jbPage, raw.title) : null,
        }
      }
      const jbPast = await jbRead(jbSeed)
      // 先の日のカードは「次の週」へ送って読む（今日が何曜日でも必ず全日が先の日になる）
      await jbPage.locator('button[aria-label="次の週"]').click()
      await jbPage.waitForTimeout(700)
      await jbPage.locator('button[aria-label="次の週"]').click()
      await jbPage.waitForTimeout(700)
      const jbFutureDate = await jbPage.locator('section[data-date]').first().getAttribute('data-date')
      const jbFuture = await jbRead(jbFutureDate)
      check(
        'JFMARK-02 前提: 過ぎた日と先の日のカードを両方測れた',
        jbPast.bg !== null && jbFuture.bg !== null && jbPast.title !== null,
        JSON.stringify({ jbPast, jbFuture }),
      )
      check(
        'JFMARK-02 過ぎた日の面の色は、先の日のカードと違う（一段階変える）',
        jbPast.bg !== jbFuture.bg,
        `過ぎた日=${jbPast.bg} / 先の日=${jbFuture.bg}`,
      )
      check(
        'JFMARK-02 文字の色は薄くしない（過ぎた日も先の日と同じ）',
        jbPast.title === jbFuture.title,
        `過ぎた日=${jbPast.title} / 先の日=${jbFuture.title}`,
      )
      check(
        'JFMARK-02 過ぎた日の面でも日付が読める(AA 4.5:1以上)',
        jbContrast(jbPast.title, jbPast.bg) >= 4.5,
        `コントラスト比=${jbContrast(jbPast.title, jbPast.bg)}:1（文字=${jbPast.title} 面=${jbPast.bg}）`,
      )
      // 「押せないように見えない」＝過ぎた日のカードの押せるものが、面の上で読めること
      await jbPage.locator('button[aria-label="前の週"]').click()
      await jbPage.waitForTimeout(700)
      await jbPage.locator('button[aria-label="前の週"]').click()
      await jbPage.waitForTimeout(700)
      await openAllWeekDays(jbPage)
      await jbPage.waitForTimeout(500)
      const jbEdit = jbPage.locator(`section[data-date="${jbSeed}"] [data-testid="week-day-edit"]`)
      const jbEditColor = await jbResolve(
        jbPage,
        await jbEdit.first().evaluate((el) => getComputedStyle(el).color),
      )
      check(
        'JFMARK-02 過ぎた日の「編集」が面の上で読める(AA 4.5:1以上＝押せるものが押せるように見える)',
        jbContrast(jbEditColor, jbPast.bg) >= 4.5,
        `コントラスト比=${jbContrast(jbEditColor, jbPast.bg)}:1（文字=${jbEditColor} 面=${jbPast.bg}）`,
      )
    } finally {
      await jbBrowser.close()
    }
  }

  // --- JFUI-03: 「表示のしかた」の週の区切りはプルダウン（便JF・⑤） ---
  currentCheck = 'JFUI-03'
  {
    const jcBrowser = await chromium.launch()
    const jcContext = await jcBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jcPage = await jcContext.newPage()
    jcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFUI-03] ${err.message}`)
    })
    try {
      await jcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jcPage.waitForTimeout(2400)
      await jcPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jcPage.waitForTimeout(900)
      await openWeekGroup(jcPage, ja.mealPlan.weekGroupDisplayTitle)
      await jcPage.waitForTimeout(500)
      const jcSelect = jcPage.locator('[data-testid="week-layout"]')
      check(
        'JFUI-03 週の区切りの選び方がプルダウンになっている',
        (await jcSelect.count()) === 1 &&
          (await jcSelect.first().evaluate((el) => el.tagName.toLowerCase())) === 'select',
        `見つかった数=${await jcSelect.count()}`,
      )
      const jcOptions = await jcSelect.first().evaluate((el) =>
        [...el.querySelectorAll('option')].map((o) => o.textContent?.trim()),
      )
      check(
        'JFUI-03 選べるのは今までと同じ2つ',
        JSON.stringify(jcOptions) ===
          JSON.stringify([ja.mealPlan.weekLayoutCalendar, ja.mealPlan.weekLayoutRolling]),
        `選べる字=${JSON.stringify(jcOptions)}`,
      )
      check(
        'JFUI-03 プルダウンは指で押せる大きさ(44px以上)',
        Math.round((await jcSelect.first().boundingBox())?.height ?? 0) >= 44,
        `高さ=${Math.round((await jcSelect.first().boundingBox())?.height ?? 0)}px`,
      )
      // 選ぶと本当に切り替わる（先頭の日付が今日になる）
      await jcSelect.first().selectOption({ label: ja.mealPlan.weekLayoutRolling })
      await jcPage.waitForTimeout(1000)
      const jcFirst = await jcPage.locator('section[data-date]').first().getAttribute('data-date')
      const jcToday = await jcPage.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      check(
        'JFUI-03 「今日から7日間」を選ぶと先頭が今日になる',
        jcFirst === jcToday,
        `先頭=${jcFirst} 今日=${jcToday}`,
      )
      check(
        'JFUI-03 選んだ字がプルダウンに残る',
        (await jcSelect.first().inputValue()) === 'rolling',
        `値=${await jcSelect.first().inputValue()}`,
      )
      // 押して選ぶ形が残っていない（チップの2択に戻っていない）
      check(
        'JFUI-03 2つのボタンを押し分ける形は残っていない',
        (await jcPage.getByRole('button', { name: ja.mealPlan.weekLayoutCalendar, exact: true }).count()) === 0,
      )
    } finally {
      await jcBrowser.close()
    }
  }

  // --- JELINE-02(2026-08-22 便JE): レシピカードの線が、後ろの面と見分けられる（5テーマ） ---
  //
  // オーナー原文「レシピカードの線を濃く（太く？）すると、レシピカードが見分けやすいかも」。
  // 直す前の実測では、レシピカードの枠とカード面の差は **1.02〜1.30:1** しかなかった
  // （＝並んだカードが何枚あるのかを線から読み取れない）。図形・部品の輪郭の下限とされる
  // 3:1 を、5テーマすべてで超えているかを見張る。
  // 測るのは**実際に塗られる色**（color-mix() の計算値は oklab() で返るので、キャンバスに
  // 1px 塗ってブラウザが本当に描く値を読み出す）。色の値そのものは書かない
  // ＝「テーマの色を変えたらここも直す」では見張りにならないため。
  //
  // 太さは 1px のままであることも一緒に見張る: 枠を 2px にすると、カードの中に残る幅が
  // 2px 縮んで**料理名の幅が削れる**（オーナーが直させたばかりの箇所）。
  //
  // 実測（この節を足した時点。390×844・カード面との比）:
  //   一覧(大) ライト2.98 / ダーク3.63 / 自動3.63 / ブラウン3.36 / グリーン3.28
  //   一覧(標準) ライト3.50 / ダーク4.38 / 自動4.38 / ブラウン3.60 / グリーン3.45
  currentCheck = 'JELINE-02'
  {
    const jlLum = (c) => {
      const f = (v) => {
        const x = v / 255
        return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
      }
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
    }
    const jlRatio = (a, b) => (Math.max(jlLum(a), jlLum(b)) + 0.05) / (Math.min(jlLum(a), jlLum(b)) + 0.05)
    const jlHex = (c) => `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
    const jlBrowser = await chromium.launch()
    try {
      for (const [jlTheme, jlLabel, jlScheme] of [
        ['auto', '自動（端末=ダーク）', 'dark'],
        ['light', 'ライト', 'dark'],
        ['dark', 'ダーク', 'light'],
        ['brown', 'ブラウン', 'light'],
        ['green', 'グリーン', 'dark'],
      ]) {
        const jlContext = await jlBrowser.newContext({
          viewport: { width: 390, height: 844 },
          colorScheme: jlScheme,
        })
        const jlPage = await jlContext.newPage()
        try {
          await jlPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
          await jlPage.waitForTimeout(2400)
          await jlPage.evaluate(async (theme) => {
            const req = indexedDB.open('uchi-recipe')
            const idb = await new Promise((resolve, reject) => {
              req.onsuccess = () => resolve(req.result)
              req.onerror = () => reject(req.error)
            })
            const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
            const cur = await P(idb.transaction('settings').objectStore('settings').get(1))
            await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({ ...(cur || {}), id: 1, theme }))
            idb.close()
          }, jlTheme)
          await jlPage.reload({ waitUntil: 'networkidle' })
          await jlPage.waitForTimeout(2400)

          for (const [jlWhere, jlSwitchLabel] of [
            ['一覧（大）', null],
            ['一覧（標準）', ja.search.layoutToggleToList],
          ]) {
            if (jlSwitchLabel) {
              await jlPage.getByRole('button', { name: jlSwitchLabel }).first().click()
              await jlPage.waitForTimeout(1000)
            }
            const jlSeen = await jlPage.evaluate(() => {
              const cvs = document.createElement('canvas').getContext('2d')
              const toRgb = (v) => {
                cvs.clearRect(0, 0, 1, 1)
                cvs.fillStyle = v
                cvs.fillRect(0, 0, 1, 1)
                const d = cvs.getImageData(0, 0, 1, 1).data
                return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
              }
              const mix = (fg, bg) => ({
                r: Math.round(fg.r * fg.a + bg.r * (1 - fg.a)),
                g: Math.round(fg.g * fg.a + bg.g * (1 - fg.a)),
                b: Math.round(fg.b * fg.a + bg.b * (1 - fg.a)),
                a: 1,
              })
              // 透けていない親をさかのぼって、後ろの地色を求める
              const behindOf = (el) => {
                let p = el.parentElement
                while (p) {
                  const c = toRgb(getComputedStyle(p).backgroundColor)
                  if (c.a > 0) return c
                  p = p.parentElement
                }
                return { r: 255, g: 255, b: 255, a: 1 }
              }
              const card = document.querySelector('[data-testid="recipe-list-card"]')
              if (!card) return null
              const cs = getComputedStyle(card)
              const behind = behindOf(card)
              const own = toRgb(cs.backgroundColor)
              return {
                border: mix(toRgb(cs.borderTopColor), behind),
                surface: own.a > 0 ? mix(own, behind) : behind,
                borderWidth: parseFloat(cs.borderTopWidth),
              }
            })
            check(
              `JELINE-02 [${jlLabel}] ${jlWhere} 前提: レシピカードを掴めた`,
              jlSeen !== null,
              JSON.stringify(jlSeen),
            )
            if (jlSeen === null) continue
            check(
              `JELINE-02 [${jlLabel}] ${jlWhere} 枠が面と見分けられる（3:1以上）`,
              jlRatio(jlSeen.border, jlSeen.surface) >= 3,
              `${jlRatio(jlSeen.border, jlSeen.surface).toFixed(2)}:1 枠=${jlHex(jlSeen.border)} 面=${jlHex(jlSeen.surface)}`,
            )
            check(
              `JELINE-02 [${jlLabel}] ${jlWhere} 枠を太くしていない（料理名の幅を削らない）`,
              jlSeen.borderWidth <= 1,
              `${jlSeen.borderWidth}px`,
            )
          }
        } finally {
          await jlContext.close()
        }
      }
    } finally {
      await jlBrowser.close()
    }
  }

  // --- JECARD-01 / JEPART-03 / JEGAP-04(2026-08-22 便JE) ---
  //
  // オーナー確定の見た目（原文）:
  //   「①：面でまとめる。月も同じように。」
  //   「②：４px。見本では角が消えて見えていたものがあるため、実装時に上手くいかない可能性が心配。
  //     外側の「夕食」などのカードも同様に。」
  //   「影なし」「週献立の日ごとカードとレシピ一覧のカードの間隔を開けるのも見やすかった。」
  //
  // JECARD-01 … 並ぶカードの角が**直角に戻っていない**こと・全部が同じトークンの値であること・
  //             入れ子（曜日カード → 夕食などの枠 → レシピカード）で**中のほうが丸い**が無いこと。
  //             `rounded-card` の登録が外れると角は直角に戻る＝オーナーの心配がそのまま起きるので、
  //             クラス名ではなく**実際に描かれている角の大きさ**で見張る。
  // JEPART-03 … 設定パートが**1枚の面**にまとまり、その面の中に週の移動・曜日カード・
  //             カレンダーが入っていないこと（＝面が終わるところが境目になっている）。
  //             面の掴み方はクラス名に依らず「地色と枠を持つ、いちばん近い親」で辿る。
  // JEGAP-04 … カード同士の間隔が、カードの中の余白より広いこと（近いものほど1つの塊に見えるため）。
  //             レシピ一覧のグリッドは**横の間隔を広げない**（広げるとカードの幅＝料理名の幅が縮む）。
  //             読むだけの入れ物には影が無く、押せるものには影があること。
  currentCheck = 'JECARD-01'
  {
    const jlnBrowser = await chromium.launch()
    try {
      const jlnContext = await jlnBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jlnPage = await jlnContext.newPage()
      try {
        await jlnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await jlnPage.waitForTimeout(2400)
        const jlnToday = await jlnPage.evaluate(() => {
          const d = new Date()
          const p = (n) => String(n).padStart(2, '0')
          return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
        })
        // 先の日を献立で埋める（過ぎた日は予定を出さない作りなので、次の週で測る）。
        // 取引はaddごとに開き直す（awaitを挟むと取引が閉じて2件目以降が黙って捨てられる）
        await jlnPage.evaluate(async (today) => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
          const P = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
          const cur = (await P(idb.transaction('settings').objectStore('settings').get(1))) || { id: 1 }
          await P(idb.transaction('settings', 'readwrite').objectStore('settings').put({
            ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now(),
          }))
          const all = await P(idb.transaction('recipes').objectStore('recipes').getAll())
          const usable = all.filter((r) => (r.ingredients?.length ?? 0) > 3)
          await P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').clear())
          const put = (v) => P(idb.transaction('mealPlans', 'readwrite').objectStore('mealPlans').add(v))
          for (let i = 1; i <= 14; i++) {
            const d = new Date(today)
            d.setDate(d.getDate() + i)
            const p = (n) => String(n).padStart(2, '0')
            const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
            await put({ date, slot: 'dinner', recipeId: usable[(i * 2) % usable.length].id, role: 'main' })
            await put({ date, slot: 'dinner', recipeId: usable[(i * 2 + 1) % usable.length].id, role: 'side' })
          }
          idb.close()
        }, jlnToday)
        await jlnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
        await jlnPage.reload({ waitUntil: 'networkidle' })
        await jlnPage.waitForTimeout(2200)
        await jlnPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).first().click()
        await jlnPage.waitForTimeout(1600)
        await jlnPage.getByRole('button', { name: ja.mealPlan.nextWeek }).first().click()
        await jlnPage.waitForTimeout(1400)
        await openAllWeekDays(jlnPage)
        await jlnPage.waitForTimeout(600)

        // 画面の中で測る道具（クラス名に依らず、実際に描かれている値と親子関係で見る）
        const jlnProbe = `(() => {
          const radius = (el) => (el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : null)
          const shadow = (el) => (el ? getComputedStyle(el).boxShadow : null)
          const cvs = document.createElement('canvas').getContext('2d')
          const toRgb = (v) => {
            cvs.clearRect(0, 0, 1, 1); cvs.fillStyle = v; cvs.fillRect(0, 0, 1, 1)
            const d = cvs.getImageData(0, 0, 1, 1).data
            return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }
          }
          /** 「地色と枠を持つ、いちばん近い親」＝その部品が載っている面 */
          const panelOf = (el) => {
            let p = el ? el.parentElement : null
            while (p && p !== document.body) {
              const cs = getComputedStyle(p)
              if (toRgb(cs.backgroundColor).a > 0 && parseFloat(cs.borderTopWidth) > 0) return p
              p = p.parentElement
            }
            return null
          }
          const byText = (text) =>
            [...document.querySelectorAll('span, p, button')].find(
              (e) => (e.textContent || '').replace(/\\u200b/g, '').trim() === text,
            ) || null
          return { radius, shadow, panelOf, byText }
        })()`

        const jlnWeek = await jlnPage.evaluate(
          ({ probeSrc, titles, nextWeekAria }) => {
            // eslint-disable-next-line no-eval
            const P = eval(probeSrc)
            const day = document.querySelector('section[data-date]')
            const slot = day ? day.querySelector('[data-testid="slot-block"]') : null
            const card = slot ? slot.querySelector('[data-testid="row-recipe"]') : null
            const days = [...document.querySelectorAll('section[data-date]')]
            const gap =
              days.length >= 2
                ? Math.round(days[1].getBoundingClientRect().top - days[0].getBoundingClientRect().bottom)
                : null
            const pad = day ? parseFloat(getComputedStyle(day).paddingTop) : null
            const panels = titles.map((t) => P.panelOf(P.byText(t)))
            const nextBtn = document.querySelector(`[aria-label="${nextWeekAria}"]`)
            return {
              cardToken: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius-card')),
              dayRadius: P.radius(day),
              slotRadius: P.radius(slot),
              cardRadius: P.radius(card),
              dayShadow: P.shadow(day),
              navShadow: P.shadow(nextBtn),
              gap,
              pad,
              panelSame: panels[0] != null && panels.every((p) => p === panels[0]),
              panelFound: panels.map((p) => p != null),
              panelHasNav: panels[0] != null && nextBtn != null ? panels[0].contains(nextBtn) : null,
              panelHasDay: panels[0] != null && day != null ? panels[0].contains(day) : null,
            }
          },
          {
            probeSrc: jlnProbe,
            titles: [
              ja.mealPlan.weekGroupDisplayTitle,
              ja.mealPlan.weekGroupAutoTitle,
              ja.mealPlan.weekGroupTemplateTitle,
            ],
            nextWeekAria: ja.mealPlan.nextWeek,
          },
        )

        check(
          'JECARD-01 前提: 曜日カード・食事の枠・レシピカードを掴めた',
          jlnWeek.dayRadius != null && jlnWeek.slotRadius != null && jlnWeek.cardRadius != null,
          JSON.stringify(jlnWeek),
        )
        check(
          'JECARD-01 並ぶカードの角が直角に戻っていない',
          jlnWeek.cardToken > 0 && jlnWeek.dayRadius > 0 && jlnWeek.slotRadius > 0 && jlnWeek.cardRadius > 0,
          `トークン=${jlnWeek.cardToken} 曜日カード=${jlnWeek.dayRadius} 食事の枠=${jlnWeek.slotRadius} レシピカード=${jlnWeek.cardRadius}`,
        )
        check(
          'JECARD-01 入れ子（曜日カード→夕食などの枠→レシピカード）の角がそろっている',
          jlnWeek.dayRadius === jlnWeek.cardToken &&
            jlnWeek.slotRadius === jlnWeek.cardToken &&
            jlnWeek.cardRadius === jlnWeek.cardToken,
          `トークン=${jlnWeek.cardToken} 曜日カード=${jlnWeek.dayRadius} 食事の枠=${jlnWeek.slotRadius} レシピカード=${jlnWeek.cardRadius}`,
        )
        check(
          'JEPART-03 週の設定3節が1枚の面にまとまっている',
          jlnWeek.panelSame,
          `見つかった面=${JSON.stringify(jlnWeek.panelFound)}`,
        )
        check(
          'JEPART-03 その面に週の移動と曜日カードは入っていない（面が終わるところが境目）',
          jlnWeek.panelHasNav === false && jlnWeek.panelHasDay === false,
          `週の移動=${jlnWeek.panelHasNav} 曜日カード=${jlnWeek.panelHasDay}`,
        )
        check(
          'JEGAP-04 曜日カード同士の間隔が、カードの中の余白より広い',
          jlnWeek.gap != null && jlnWeek.pad != null && jlnWeek.gap > jlnWeek.pad,
          `間隔=${jlnWeek.gap}px 中の余白=${jlnWeek.pad}px`,
        )
        check(
          'JEGAP-04 読むだけの曜日カードに影が無い／押せる週の移動には影がある',
          jlnWeek.dayShadow === 'none' && jlnWeek.navShadow !== 'none',
          `曜日カード=${jlnWeek.dayShadow} 週の移動=${jlnWeek.navShadow}`,
        )

        // --- 月タブ ---
        currentCheck = 'JEPART-03'
        await jlnPage.getByRole('button', { name: '月', exact: true }).first().click()
        await jlnPage.waitForTimeout(1600)
        const jlnMonth = await jlnPage.evaluate(
          ({ probeSrc, titles }) => {
            // eslint-disable-next-line no-eval
            const P = eval(probeSrc)
            const cell = document.querySelector('button[data-date]')
            const panels = titles.map((t) => P.panelOf(P.byText(t)))
            return {
              cardToken: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--radius-card')),
              cellRadius: P.radius(cell),
              panelSame: panels[0] != null && panels.every((p) => p === panels[0]),
              panelFound: panels.map((p) => p != null),
              panelHasCalendar: panels[0] != null && cell != null ? panels[0].contains(cell) : null,
            }
          },
          { probeSrc: jlnProbe, titles: [ja.mealPlan.monthCellModeLabel, ja.mealPlan.rangeCostToggle] },
        )
        check(
          'JECARD-01 月のカレンダーのマスの角も同じ値',
          jlnMonth.cellRadius === jlnMonth.cardToken && jlnMonth.cardToken > 0,
          `トークン=${jlnMonth.cardToken} マス=${jlnMonth.cellRadius}`,
        )
        check(
          'JEPART-03 月の設定も1枚の面にまとまっている',
          jlnMonth.panelSame,
          `見つかった面=${JSON.stringify(jlnMonth.panelFound)}`,
        )
        check(
          'JEPART-03 その面にカレンダーは入っていない（面が終わるところが境目）',
          jlnMonth.panelHasCalendar === false,
          `カレンダー=${jlnMonth.panelHasCalendar}`,
        )

        // --- レシピ一覧 ---
        currentCheck = 'JEGAP-04'
        await jlnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await jlnPage.waitForTimeout(2000)
        const jlnList = await jlnPage.evaluate(() => {
          const cards = [...document.querySelectorAll('[data-testid="recipe-list-card"]')]
          if (cards.length < 3) return null
          const box = cards.map((c) => c.getBoundingClientRect())
          // グリッドは2列。縦の間隔＝1行目の下端と2行目の上端／横の間隔＝左右のカードの隙間
          const rowGap = Math.round(box[2].top - box[0].bottom)
          const colGap = Math.round(box[1].left - box[0].right)
          // カードの「中の余白」＝カードの中でいちばん広く取っている余白
          const pad = Math.max(
            0,
            ...[...cards[0].querySelectorAll('*')].map((e) => parseFloat(getComputedStyle(e).paddingTop) || 0),
          )
          return { rowGap, colGap, pad }
        })
        check(
          'JEGAP-04 前提: レシピ一覧のカードを3枚以上掴めた',
          jlnList !== null,
          JSON.stringify(jlnList),
        )
        if (jlnList !== null) {
          check(
            'JEGAP-04 レシピ一覧の縦の間隔が、カードの中の余白より広い',
            jlnList.pad != null && jlnList.rowGap > jlnList.pad,
            `縦の間隔=${jlnList.rowGap}px 中の余白=${jlnList.pad}px`,
          )
          check(
            'JEGAP-04 横の間隔は縦より狭いまま（横を広げるとカードの幅＝料理名の幅が縮む）',
            jlnList.colGap < jlnList.rowGap,
            `横の間隔=${jlnList.colGap}px 縦の間隔=${jlnList.rowGap}px`,
          )
        }
      } finally {
        await jlnContext.close()
      }
    } finally {
      await jlnBrowser.close()
    }
  }

  // --- JFASSIGN-04: 「◯食に入れる」のあとに戻せる（便JF・⑥） ---
  currentCheck = 'JFASSIGN-04'
  {
    const jdBrowser = await chromium.launch()
    const jdContext = await jdBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jdPage = await jdContext.newPage()
    jdPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFASSIGN-04] ${err.message}`)
    })
    try {
      await jdPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jdPage.waitForTimeout(2400)
      // 「レシピ一覧から選択中」に1品だけ置く（生のIndexedDBへ書いたので読み込み直す・禁じ手⑥）
      await jdPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const g = idb.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () => {
                const r = g.result.find((x) => x.title === '肉じゃが')
                if (!r) {
                  reject(new Error('肉じゃがが見つからない'))
                  return
                }
                const wtx = idb.transaction('todayList', 'readwrite')
                wtx.objectStore('todayList').add({ recipeId: r.id, addedAt: Date.now() })
                wtx.oncomplete = () => resolve(undefined)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await jdPage.reload({ waitUntil: 'networkidle' })
      await jdPage.waitForTimeout(1400)
      check(
        'JFASSIGN-04 前提: 「レシピ一覧から選択中」に1品ある',
        ((await jdPage.locator('[data-testid="day-picked"]').textContent()) ?? '').includes('肉じゃが'),
      )
      await jdPage.getByRole('button', { name: '朝食に入れる', exact: true }).first().click()
      await jdPage.waitForTimeout(900)
      // 戻したあとは「今週の献立の予定」の節ごと消えるので、無いときも測れる形にする
      const jdPlanned = async () => {
        const node = jdPage.locator('[data-testid="day-planned"]')
        if ((await node.count()) === 0) return false
        return ((await node.first().textContent()) ?? '').includes('肉じゃが')
      }
      check('JFASSIGN-04 「朝食に入れる」で今週の献立の予定に入る', await jdPlanned())
      const jdUndo = jdPage.getByRole('button', { name: '元に戻す', exact: true })
      check(
        'JFASSIGN-04 入れたあとのトーストに「元に戻す」が出る',
        (await jdUndo.count()) === 1,
        `元に戻す=${await jdUndo.count()}件`,
      )
      await jdUndo.first().click()
      await jdPage.waitForTimeout(1000)
      check('JFASSIGN-04 「元に戻す」で今週の献立の予定から消える', (await jdPlanned()) === false)
      check(
        'JFASSIGN-04 戻すと「レシピ一覧から選択中」に残る（選んだこと自体は消さない）',
        ((await jdPage.locator('[data-testid="day-picked"]').textContent()) ?? '').includes('肉じゃが'),
      )
    } finally {
      await jdBrowser.close()
    }
  }

  // --- JFBACK-05: Pro案内から飛んだ先の「戻る」で、押す前の画面に帰る（便JF・⑦） ---
  currentCheck = 'JFBACK-05'
  {
    const jeBrowser = await chromium.launch()
    const jeContext = await jeBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jePage = await jeContext.newPage()
    jePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFBACK-05] ${err.message}`)
    })
    try {
      await jePage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jePage.waitForTimeout(2400)
      // 献立の「月」→ Pro案内 → 設定 → 戻る で献立へ帰る
      await jePage.getByRole('button', { name: '月', exact: true }).click()
      await jePage.waitForTimeout(900)
      await jePage.getByRole('link', { name: ja.mealPlan.monthProGateLink }).first().click()
      await jePage.waitForTimeout(1200)
      check('JFBACK-05 献立のPro案内から設定が開く', jePage.url().includes('#/settings'), `url=${jePage.url()}`)
      const jeBack = jePage.locator('[data-testid="settings-back"]')
      check(
        'JFBACK-05 設定に「献立に戻る」が出る',
        (await jeBack.count()) === 1 && ((await jeBack.first().textContent()) ?? '').includes('献立'),
        `戻るボタン=${(await jeBack.count()) === 1 ? await jeBack.first().textContent() : 'なし'}`,
      )
      // その設定画面からサンプルデモへ入り、閉じたときに**帰り道を持ったまま**設定へ戻る
      await jePage.locator('[data-testid="settings-month-demo-link"]').first().click()
      await jePage.waitForTimeout(1400)
      check(
        'JFBACK-05 設定からサンプルデモが開く',
        jePage.url().includes('#/month-demo'),
        `url=${jePage.url()}`,
      )
      await jePage.locator('[data-testid="month-demo-close"]').first().click()
      await jePage.waitForTimeout(1200)
      check(
        'JFBACK-05 サンプルデモを閉じると設定へ戻る',
        jePage.url().includes('#/settings'),
        `url=${jePage.url()}`,
      )
      check(
        'JFBACK-05 戻った設定にも「献立に戻る」が残っている（帰り道を落とさない）',
        (await jePage.locator('[data-testid="settings-back"]').count()) === 1,
        `url=${jePage.url()}`,
      )
      await jePage.locator('[data-testid="settings-back"]').first().click()
      await jePage.waitForTimeout(1200)
      check(
        'JFBACK-05 「献立に戻る」で押す前の献立へ帰る',
        jePage.url().includes('#/meal-plan'),
        `url=${jePage.url()}`,
      )
    } finally {
      await jeBrowser.close()
    }
  }


  // --- JFLOCK-06: 過去だけの週にも鍵を出す（便IF・⑪の巻き戻し。便JF追加指示①） ---
  // 週区切り(既定)で「前の週」へ1回送れば、今日が何曜日でも7日とも過ぎた日になる（禁じ手①）
  currentCheck = 'JFLOCK-06'
  {
    const jfBrowser = await chromium.launch()
    const jfContext = await jfBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jfPage = await jfContext.newPage()
    jfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFLOCK-06] ${err.message}`)
    })
    try {
      await jfPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jfPage.waitForTimeout(2400)
      await jfPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jfPage.waitForTimeout(900)
      await jfPage.getByRole('button', { name: ja.mealPlan.prevWeek, exact: true }).click()
      await openAllWeekDays(jfPage)
      await jfPage.waitForTimeout(700)
      const jfDates = await jfPage.locator('section[data-date]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-date')),
      )
      const jfToday = await jfPage.evaluate(() => {
        const d = new Date()
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      })
      check(
        'JFLOCK-06 前提: 7日とも過ぎた日の週を出せた',
        jfDates.length === 7 && jfDates.every((d) => d < jfToday),
        `週=${jfDates.join(',')} 今日=${jfToday}`,
      )
      const jfDayLocks = jfPage.locator('[data-testid="day-lock"]')
      check(
        'JFLOCK-06 過去だけの週でも、日ごとの鍵が7日ぶん出る',
        (await jfDayLocks.count()) === 7,
        `鍵=${await jfDayLocks.count()}件`,
      )
      check(
        'JFLOCK-06 過去だけの週でも「すべてロック」が出る',
        (await jfPage.locator('[data-testid="lock-all"]').count()) === 1,
      )
      // 掛けられること（押しても何も起きないボタンを置かない）
      const jfFirstLock = jfPage.locator(`[data-testid="day-lock"][data-date="${jfDates[0]}"]`)
      check(
        'JFLOCK-06 前提: 押す前は掛かっていない',
        (await jfFirstLock.first().getAttribute('aria-pressed')) === 'false',
      )
      await jfFirstLock.first().click()
      await jfPage.waitForTimeout(800)
      check(
        'JFLOCK-06 過ぎた日にも鍵を掛けられる',
        (await jfFirstLock.first().getAttribute('aria-pressed')) === 'true',
        `aria-pressed=${await jfFirstLock.first().getAttribute('aria-pressed')}`,
      )
      // 週を送って戻っても掛かったまま（見た目だけの印になっていない＝端末に残っている）
      await jfPage.locator('button[aria-label="次の週"]').click()
      await jfPage.waitForTimeout(700)
      await jfPage.locator('button[aria-label="前の週"]').click()
      await openAllWeekDays(jfPage)
      await jfPage.waitForTimeout(700)
      check(
        'JFLOCK-06 掛けた鍵は週を送って戻っても残る',
        (await jfPage
          .locator(`[data-testid="day-lock"][data-date="${jfDates[0]}"]`)
          .first()
          .getAttribute('aria-pressed')) === 'true',
      )
      // 鍵の効きめ: 「まとめて空にする」は表示している週の全日を対象にするので、
      // 鍵を掛けた過ぎた日の献立はそこで守られる（過去だけの週で守る手段がこれしかなかった）
      await jfPage.getByRole('button', { name: `${ja.mealPlan.weekGroupDisplayTitle}を開く` }).click()
      await jfPage.waitForTimeout(400)
      check(
        'JFLOCK-06 同じ週に「まとめて空にする」もある（鍵が守る相手）',
        (await jfPage.locator('[data-testid="week-clear-slot"]').count()) === 1,
      )
    } finally {
      await jfBrowser.close()
    }
  }

  // --- JFDEL-07: 過ぎた日の編集モードから記録を削除できる（便JF追加指示②） ---
  currentCheck = 'JFDEL-07'
  {
    const jgBrowser = await chromium.launch()
    const jgContext = await jgBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jgPage = await jgContext.newPage()
    jgPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFDEL-07] ${err.message}`)
    })
    try {
      await jgPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jgPage.waitForTimeout(2400)
      // 過ぎた日に記録を2件仕込む（1件消しても「残るもの」を数えられるようにする）。
      // 生のIndexedDBへ書いたので必ず読み込み直す（禁じ手⑥）
      const jgSeed = await jgPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            d.setDate(d.getDate() - 9)
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const a = g.result.find((x) => x.title === 'カレーライス')
                const b = g.result.find((x) => x.title === '肉じゃが')
                if (!a || !b) {
                  reject(new Error('仕込むレシピが見つからない'))
                  return
                }
                a.cookedLogs = [{ date }, ...(a.cookedLogs ?? [])]
                b.cookedLogs = [{ date }, ...(b.cookedLogs ?? [])]
                store.put(a)
                store.put(b)
              }
              tx.oncomplete = () => resolve(date)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await jgPage.reload({ waitUntil: 'networkidle' })
      await jgPage.waitForTimeout(1400)
      await jgPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jgPage.waitForTimeout(900)
      for (let i = 0; i < 4; i++) {
        if ((await jgPage.locator(`section[data-date="${jgSeed}"]`).count()) > 0) break
        const shown = await jgPage.locator('section[data-date]').first().getAttribute('data-date')
        await jgPage.locator(`button[aria-label="${shown && jgSeed < shown ? '前の週' : '次の週'}"]`).click()
        await jgPage.waitForTimeout(700)
      }
      await openAllWeekDays(jgPage)
      await jgPage.waitForTimeout(700)
      const jgCard = jgPage.locator(`section[data-date="${jgSeed}"]`)
      check(
        'JFDEL-07 前提: 記録を2件仕込んだ過ぎた日のカードを開けた',
        (await jgCard.locator('[data-testid="cooked-log-card"]').count()) === 2,
        `記録=${await jgCard.locator('[data-testid="cooked-log-card"]').count()}件（${jgSeed}）`,
      )
      check(
        'JFDEL-07 通常表示には削除の入口を出さない（普段の見え方は今までどおり）',
        (await jgCard.locator('[data-testid="past-record-delete"]').count()) === 0,
      )
      await jgCard.locator('[data-testid="week-day-edit"]').first().click()
      await jgPage.waitForTimeout(600)
      const jgDelete = jgCard.locator('[data-testid="past-record-delete"]')
      check(
        'JFDEL-07 編集モードにすると、記録1件ごとに削除が出る',
        (await jgDelete.count()) === 2,
        `削除=${await jgDelete.count()}件`,
      )
      check(
        'JFDEL-07 削除は指で押せる大きさ(44px以上)',
        Math.round((await jgDelete.first().boundingBox())?.height ?? 0) >= 44,
        `高さ=${Math.round((await jgDelete.first().boundingBox())?.height ?? 0)}px`,
      )
      // 消す前に確かめる（規約F: 何が消えて何が残るかを件数つきで両方書く）
      await setConfirmAnswer(jgPage, 'off')
      await jgDelete.first().click()
      await jgPage.waitForTimeout(700)
      const jgConfirmText = ((await jgPage.locator('[data-testid="confirm"]').textContent()) ?? '')
        .replaceAll('​', '')
      check(
        'JFDEL-07 消す前に確認の窓が出る',
        jgConfirmText.length > 0,
        `確認文=${jgConfirmText.slice(0, 120)}`,
      )
      check(
        'JFDEL-07 確認文に「消えるもの」と「残るもの」が両方あり、件数が入っている（規約F）',
        jgConfirmText.includes('消えるもの') &&
          jgConfirmText.includes('残るもの') &&
          /\d+件/.test(jgConfirmText),
        `確認文=${jgConfirmText}`,
      )
      check(
        'JFDEL-07 戻せるので「元に戻せません」とは言わない',
        !jgConfirmText.includes('元に戻せません'),
        `確認文=${jgConfirmText}`,
      )
      await jgPage.locator('[data-testid="confirm-ok"]').click()
      await setConfirmAnswer(jgPage, 'accept')
      await jgPage.waitForTimeout(1000)
      check(
        'JFDEL-07 確認して押すと、その記録が1件だけ消える',
        (await jgCard.locator('[data-testid="cooked-log-card"]').count()) === 1,
        `残り=${await jgCard.locator('[data-testid="cooked-log-card"]').count()}件`,
      )
      const jgUndo = jgPage.getByRole('button', { name: '元に戻す', exact: true })
      check(
        'JFDEL-07 消したあとのトーストから1回で戻せる',
        (await jgUndo.count()) === 1,
        `元に戻す=${await jgUndo.count()}件`,
      )
      await jgUndo.first().click()
      await jgPage.waitForTimeout(1000)
      check(
        'JFDEL-07 「元に戻す」で消した記録が戻る',
        (await jgCard.locator('[data-testid="cooked-log-card"]').count()) === 2,
        `戻したあと=${await jgCard.locator('[data-testid="cooked-log-card"]').count()}件`,
      )
    } finally {
      await jgBrowser.close()
    }
  }


  // --- JFLOCKEDIT-08: 鍵を掛けた日は記録も編集できない（オーナー原文
  //     「記録は編集モードで消せる。鍵をかけたら編集もできなくなるようにして。」） ---
  currentCheck = 'JFLOCKEDIT-08'
  {
    const jhBrowser = await chromium.launch()
    const jhContext = await jhBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jhPage = await jhContext.newPage()
    jhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFLOCKEDIT-08] ${err.message}`)
    })
    try {
      await jhPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(2400)
      // 過ぎた日に記録を1件仕込む（生のIndexedDBへ書いたので必ず読み込み直す・禁じ手⑥）
      const jhSeed = await jhPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            d.setDate(d.getDate() - 10)
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const r = g.result.find((x) => x.title === 'カレーライス')
                if (!r) {
                  reject(new Error('カレーライスが見つからない'))
                  return
                }
                r.cookedLogs = [{ date }, ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(date)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await jhPage.reload({ waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1400)
      await jhPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jhPage.waitForTimeout(900)
      for (let i = 0; i < 4; i++) {
        if ((await jhPage.locator(`section[data-date="${jhSeed}"]`).count()) > 0) break
        const shown = await jhPage.locator('section[data-date]').first().getAttribute('data-date')
        await jhPage.locator(`button[aria-label="${shown && jhSeed < shown ? '前の週' : '次の週'}"]`).click()
        await jhPage.waitForTimeout(700)
      }
      await openAllWeekDays(jhPage)
      await jhPage.waitForTimeout(700)
      const jhCard = jhPage.locator(`section[data-date="${jhSeed}"]`)
      await jhCard.locator('[data-testid="week-day-edit"]').first().click()
      await jhPage.waitForTimeout(600)
      const jhAdd = jhCard.locator('[data-testid="past-record-add"]')
      const jhDel = jhCard.locator('[data-testid="past-record-delete"]')
      const jhNote = jhCard.locator('[data-testid="past-record-locked-note"]')
      check(
        'JFLOCKEDIT-08 前提: 鍵を掛ける前は、足すのも消すのも押せる',
        (await jhAdd.count()) === 1 &&
          (await jhAdd.first().isEnabled()) &&
          (await jhDel.count()) === 1 &&
          (await jhDel.first().isEnabled()),
        `足す=${await jhAdd.count()}件 消す=${await jhDel.count()}件`,
      )
      check('JFLOCKEDIT-08 前提: 鍵を掛ける前は理由の1行を出さない', (await jhNote.count()) === 0)
      const jhLock = jhPage.locator(`[data-testid="day-lock"][data-date="${jhSeed}"]`)
      check('JFLOCKEDIT-08 前提: その日の鍵を掴めた', (await jhLock.count()) === 1)
      await jhLock.first().click()
      await jhPage.waitForTimeout(900)
      check(
        'JFLOCKEDIT-08 鍵を掛けると、記録を足せなくなる',
        (await jhAdd.count()) === 1 && (await jhAdd.first().isDisabled()),
        `押せる=${(await jhAdd.count()) === 1 ? await jhAdd.first().isEnabled() : '掴めない'}`,
      )
      check(
        'JFLOCKEDIT-08 鍵を掛けると、記録を消せなくなる',
        (await jhDel.count()) === 1 && (await jhDel.first().isDisabled()),
        `押せる=${(await jhDel.count()) === 1 ? await jhDel.first().isEnabled() : '掴めない'}`,
      )
      check(
        'JFLOCKEDIT-08 押せない理由が、同じカードの中で読める',
        (await jhNote.count()) === 1 && (await jhNote.first().isVisible()),
        `理由の1行=${(await jhNote.count()) === 1 ? await jhNote.first().textContent() : 'なし'}`,
      )
      // 鍵は可逆（外せばすぐ元どおり）
      await jhLock.first().click()
      await jhPage.waitForTimeout(900)
      check(
        'JFLOCKEDIT-08 鍵を外すと、また足せる・消せる（掛け外しは自由）',
        (await jhAdd.first().isEnabled()) &&
          (await jhDel.first().isEnabled()) &&
          (await jhNote.count()) === 0,
        `足す=${await jhAdd.first().isEnabled()} 消す=${await jhDel.first().isEnabled()}`,
      )
    } finally {
      await jhBrowser.close()
    }
  }

  // --- JFCLEAR-09: 「まとめて空にする」は作った記録を消さない（オーナー原文
  //     「まとめて献立を空ににする機能の対象外にしたい。献立を変種していたら
  //       誤って記録まで消してしまう事故が起こりそう」） ---
  currentCheck = 'JFCLEAR-09'
  {
    const jiBrowser = await chromium.launch()
    const jiContext = await jiBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jiPage = await jiContext.newPage()
    jiPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JFCLEAR-09] ${err.message}`)
    })
    /** 端末に入っている「作った記録」の総件数（読むだけなので読み込み直しは要らない） */
    const jiCookedCount = () =>
      jiPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const g = req.result.transaction('recipes', 'readonly').objectStore('recipes').getAll()
              g.onsuccess = () =>
                resolve(g.result.reduce((n, r) => n + (r.cookedLogs?.length ?? 0), 0))
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    /** 端末に入っている献立の行数 */
    const jiPlanCount = () =>
      jiPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const g = req.result.transaction('mealPlans', 'readonly').objectStore('mealPlans').getAll()
              g.onsuccess = () => resolve(g.result.length)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
    try {
      await jiPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await jiPage.waitForTimeout(2400)
      // 今日と昨日に作った記録を仕込む（生のIndexedDBへ書いたので読み込み直す・禁じ手⑥）
      await jiPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const iso = (offset) => {
              const d = new Date()
              d.setDate(d.getDate() + offset)
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            }
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.getAll()
              g.onsuccess = () => {
                const a = g.result.find((x) => x.title === 'カレーライス')
                const b = g.result.find((x) => x.title === '肉じゃが')
                if (!a || !b) {
                  reject(new Error('仕込むレシピが見つからない'))
                  return
                }
                a.cookedLogs = [{ date: iso(0) }, ...(a.cookedLogs ?? [])]
                b.cookedLogs = [{ date: iso(-1) }, ...(b.cookedLogs ?? [])]
                store.put(a)
                store.put(b)
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await jiPage.reload({ waitUntil: 'networkidle' })
      await jiPage.waitForTimeout(1400)
      await jiPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await jiPage.waitForTimeout(900)
      // 献立を7日ぶん入れる（消す相手を作る）
      await openWeekGroup(jiPage, ja.mealPlan.weekGroupAutoTitle)
      await jiPage.getByRole('button', { name: ja.mealPlan.fillWeek }).click()
      await jiPage.waitForTimeout(3200)
      const jiPlanBefore = await jiPlanCount()
      const jiCookedBefore = await jiCookedCount()
      check(
        'JFCLEAR-09 前提: 消す相手の献立と、守る相手の作った記録が両方ある',
        jiPlanBefore > 0 && jiCookedBefore >= 2,
        `献立=${jiPlanBefore}行 作った記録=${jiCookedBefore}件`,
      )
      // 朝食・昼食・夕食を全部選んでから「空にする」
      await openWeekGroup(jiPage, ja.mealPlan.weekGroupDisplayTitle)
      await jiPage.waitForTimeout(400)
      for (const slot of ['朝食', '昼食', '夕食']) {
        const chip = jiPage.getByRole('button', { name: `空にする食事として${slot}を選ぶ` })
        if ((await chip.count()) === 1 && (await chip.first().getAttribute('aria-pressed')) !== 'true') {
          await chip.first().click()
          await jiPage.waitForTimeout(250)
        }
      }
      await setConfirmAnswer(jiPage, 'off')
      await jiPage.locator('[data-testid="week-clear-slot"]').click()
      await jiPage.waitForTimeout(800)
      const jiConfirmText = ((await jiPage.locator('[data-testid="confirm"]').textContent()) ?? '')
        .replaceAll('​', '')
      // 消す相手は見出しで名指しする（「予定◯品を削除します」）。
      // 「作った記録は残ります」とは**書かない**——2026-08-18 のオーナー指摘
      // 「『〜外しました（作った記録は残ります）』、作った記録もするということ？
      //   消すだけですよね。嘘書かないで。」で、触らないものを「残ります」と書くのは
      // 禁じ手になっている（見張り＝test-logic の PLANWORD-1）。
      // 記録に触らないことは、下の実データの数え比べで見張る
      check(
        'JFCLEAR-09 押す前に、消す相手を「予定」と名指ししている',
        jiConfirmText.includes('予定') && jiConfirmText.includes('削除します'),
        `確認文=${jiConfirmText}`,
      )
      check(
        'JFCLEAR-09 触らない「作った記録」の話は確認文に混ぜない（2026-08-18 オーナー指摘）',
        !jiConfirmText.includes('作った記録'),
        `確認文=${jiConfirmText}`,
      )
      await jiPage.locator('[data-testid="confirm-ok"]').click()
      await setConfirmAnswer(jiPage, 'accept')
      await jiPage.waitForTimeout(1600)
      const jiPlanAfter = await jiPlanCount()
      const jiCookedAfter = await jiCookedCount()
      check(
        'JFCLEAR-09 前提: 「空にする」が実際に献立を消している（何も起きていないのに合格にしない）',
        jiPlanAfter < jiPlanBefore,
        `献立 前=${jiPlanBefore}行 後=${jiPlanAfter}行`,
      )
      check(
        'JFCLEAR-09 作った記録は1件も消えない',
        jiCookedAfter === jiCookedBefore,
        `作った記録 前=${jiCookedBefore}件 後=${jiCookedAfter}件`,
      )
    } finally {
      await jiBrowser.close()
    }
  }

  // --- JHSAFE-01(2026-08-22 便JH): 取り込んだレシピにもアプリが添える注意が出る ---
  //
  // オーナー原文:
  //   「レンジ温泉卵
  //    ・卵をレンジ加熱なら、卵黄に爪楊枝で穴を開けないと爆発しそう」
  //
  // 根は1品の話ではない。同梱の基本レシピには CLAUDE.md D-④ の安全注記が原稿に入っているのに、
  // URL・文章から取り込んだレシピには1つも付かない（オーナーの実データ31品では、D-④に
  // 該当する26品の26品すべてに注記が無かった）。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①レンジ加熱の手順に卵がある品を開くと、その手順に注記が出る
  //   ②注記が出ても、利用者が書いた手順の本文は1文字も変わっていない
  //   ③危なくない品・同梱の基本レシピには**1件も出ない**（誤検出で毎回出ると読まれなくなる）
  //   ④料理中に見る画面（調理中モード）でも同じ注記が読める
  //   ⑤余計だと思う人は設定で消せる（消したあと、同じ場所で戻せる）
  // 禁じ手よけ: 生のIndexedDBへ書いたあとに必ず読み込み直す／掴むのは data-testid だけで
  // 並び順・入れ子に依らない／曜日・月替わりに依らない
  currentCheck = 'JHSAFE-01'
  {
    const jhBrowser = await chromium.launch()
    const jhContext = await jhBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const jhPage = await jhContext.newPage()
    jhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@JHSAFE-01] ${err.message}`)
    })
    try {
      const JH_MICROWAVE_STEP = '器に卵と水を入れ、電子レンジ600Wで50秒加熱する'
      await jhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(2400) // 初回シード完了待ち
      const jhIds = await jhPage.evaluate(async (stepText) => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, ingredients, steps, extra) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients, steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false,
          createdAt: Date.now(), updatedAt: Date.now(), ...extra,
        })
        // ①取り込み相当（レンジ＋卵）／②同じ材料でもレンジを使わない品／③同梱の基本レシピ
        const risky = await P(store('recipes').add(mk('E2Eレンジで温泉卵', [{ name: '卵', amount: '1', unit: '個' }], [{ text: stepText }])))
        const plain = await P(store('recipes').add(mk('E2Eフライパンの卵焼き', [{ name: '卵', amount: '2', unit: '個' }], [{ text: '卵を溶き、フライパンで焼く' }])))
        const starter = await P(store('recipes').add(mk('E2E同梱のレンジ卵', [{ name: '卵', amount: '1', unit: '個' }], [{ text: stepText }], { isStarter: true })))
        db.close()
        return { risky, plain, starter }
      }, JH_MICROWAVE_STEP)
      // 生のIndexedDBへ書いたので必ず読み込み直す（Dexieのライブ購読はDexie経由の書き込みしか見ない）
      await jhPage.goto(`${BASE}/#/recipes/${jhIds.risky}`)
      await jhPage.reload({ waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1400)

      // ① 手順に注記が出る
      const jhStepNote = jhPage.locator('[data-testid="safety-step-0"]')
      check('JHSAFE-01 前提: 取り込み相当のレシピを開けた', (await jhPage.textContent('body')).includes('E2Eレンジで温泉卵'))
      check('JHSAFE-01 レンジ加熱＋卵の手順に注意が出る', (await jhStepNote.count()) === 1)
      const jhStepText = ((await jhStepNote.count()) === 1 ? await jhStepNote.textContent() : '').replaceAll('​', '')
      check(
        'JHSAFE-01 注記に、穴を開けることが書いてある',
        jhStepText.includes('穴を開け'),
        `注記=${jhStepText}`,
      )
      check(
        'JHSAFE-01 注記に見出しが付いていて、利用者が書いた文と区別できる',
        jhStepText.includes(ja.safety.title),
        `注記=${jhStepText}`,
      )
      // ② 手順の本文は1文字も変わっていない
      const jhBody = (await jhPage.textContent('body')).replaceAll('​', '')
      check(
        'JHSAFE-01 利用者が書いた手順の本文が1文字も変わっていない',
        jhBody.includes(JH_MICROWAVE_STEP),
        `本文=${JH_MICROWAVE_STEP}`,
      )
      // レシピ全体の注記（半熟・生の卵の対象者案内）はメモの並びに出る
      const jhRecipeNote = jhPage.locator('[data-testid="safety-recipe"]')
      check('JHSAFE-01 対象者の案内はレシピ全体の枠に出る', (await jhRecipeNote.count()) === 1)
      const jhRecipeText = ((await jhRecipeNote.count()) === 1 ? await jhRecipeNote.textContent() : '').replaceAll('​', '')
      check(
        'JHSAFE-01 レシピ全体の枠に、誰が添えた文なのかが書いてある',
        jhRecipeText.includes(ja.safety.source),
        `枠=${jhRecipeText}`,
      )

      // ④ 料理中に見る画面でも同じ注記が読める
      await jhPage.getByRole('button', { name: ja.focus.open }).click()
      await jhPage.waitForTimeout(900)
      const jhFocusNote = jhPage.locator('[data-testid="focus-safety-step-0"]')
      check('JHSAFE-01 調理中モードでも同じ注記が読める', (await jhFocusNote.count()) === 1)
      check(
        'JHSAFE-01 調理中モードの注記も、穴を開けることが書いてある',
        ((await jhFocusNote.count()) === 1 ? await jhFocusNote.textContent() : '').replaceAll('​', '').includes('穴を開け'),
      )
      await jhPage.keyboard.press('Escape')
      await jhPage.waitForTimeout(500)

      // ③ 危なくない品・同梱の基本レシピには1件も出ない
      for (const [jhLabel, jhId] of [['レンジを使わない卵料理', jhIds.plain], ['同梱の基本レシピ', jhIds.starter]]) {
        await jhPage.goto(`${BASE}/#/recipes/${jhId}`)
        await jhPage.reload({ waitUntil: 'networkidle' })
        await jhPage.waitForTimeout(1200)
        check(
          `JHSAFE-01 ${jhLabel}には手順の注記が1件も出ない`,
          (await jhPage.locator('[data-testid^="safety-step-"]').count()) === 0,
        )
        check(
          `JHSAFE-01 ${jhLabel}にはレシピ全体の注記も出ない`,
          (await jhPage.locator('[data-testid="safety-recipe"]').count()) === 0,
        )
      }

      // ⑤ 余計だと思う人は設定で消せる（消したあと、同じ場所で戻せる）
      await jhPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1200)
      const jhSwitch = jhPage.getByRole('switch', { name: ja.settings.safetyShow })
      check('JHSAFE-01 前提: 設定に入り切りの切り替えがある', (await jhSwitch.count()) === 1)
      check('JHSAFE-01 既定は表示する側になっている', (await jhSwitch.getAttribute('aria-checked')) === 'true')
      await jhSwitch.click()
      await jhPage.waitForTimeout(700)
      await jhPage.goto(`${BASE}/#/recipes/${jhIds.risky}`)
      await jhPage.reload({ waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1200)
      check(
        'JHSAFE-01 切ると、注記がどこにも出なくなる',
        (await jhPage.locator('[data-testid^="safety-step-"]').count()) === 0 &&
          (await jhPage.locator('[data-testid="safety-recipe"]').count()) === 0,
      )
      check(
        'JHSAFE-01 切っても、利用者が書いた手順の本文はそのまま残る',
        (await jhPage.textContent('body')).replaceAll('​', '').includes(JH_MICROWAVE_STEP),
      )
      await jhPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1200)
      await jhPage.getByRole('switch', { name: ja.settings.safetyShow }).click()
      await jhPage.waitForTimeout(700)
      await jhPage.goto(`${BASE}/#/recipes/${jhIds.risky}`)
      await jhPage.reload({ waitUntil: 'networkidle' })
      await jhPage.waitForTimeout(1200)
      check(
        'JHSAFE-01 同じ場所で戻せる（押した瞬間に二度と出せなくなる形にしない）',
        (await jhPage.locator('[data-testid="safety-step-0"]').count()) === 1,
      )
    } finally {
      await jhBrowser.close()
    }
  }

  // --- JIPRICE-01(2026-08-22 便JI): 古い目安価格を持っている端末で「最新の目安価格に更新する」 ---
  //
  // オーナー裁定「判断待ち １A ２A」の①。それまでの仕組み（バージョン付きトップアップ移行）は
  // 「名前がまだ無い食材の追加」しかできず、既に行を持っている端末は目安価格を直しても
  // 古い値のまま取り残されていた。しかも「デフォルトに戻す」を押しても旧値に戻るだけだった。
  //
  // 測るのは「利用者が確かめたいこと」:
  //   ①古い目安のままの端末で押したら、新しい目安価格に変わる
  //   ②自分で直した価格は1円も変わらない
  //   ③押す前に「変わるもの／変わらないもの」が件数つきで読める（規約F）
  //   ④押したあとに何件変えたかを言う／その場で取り消せる
  //   ⑤更新したあとに自分で直して「デフォルトに戻す」を押すと、**新しい値**に戻る（②の後半）
  // 禁じ手よけ: 生のIndexedDBへ書いたら必ず読み込み直す（⑥）／件数は画面の表示から読む（③）／
  //             行は名前のaria-labelで掴む（④・並び順に依らない）／曜日・月替わりに依らない
  currentCheck = 'JIPRICE-01'
  {
    const jpBrowser = await chromium.launch()
    try {
      const jpContext = await jpBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const jpPage = await jpContext.newPage()
      jpPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@JIPRICE-01] ${err.message}`)
      })
      try {
        await jpPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
        await jpPage.waitForTimeout(2600) // 初回シード完了待ち

        // 「古い目安価格を持っている端末」を作る。旧値は 2026-08-22 便JI で直す前の実データ。
        // 片栗粉だけは「自分で直した行」にして、1円も動かないことを見る
        const jpSeeded = await jpPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('prices', 'readwrite')
                const store = tx.objectStore('prices')
                const all = store.getAll()
                const written = []
                all.onsuccess = () => {
                  const olds = {
                    小麦粉: [10, '大さじ1'],
                    きな粉: [15, '大さじ1'],
                    バター: [250, '200g'],
                    片栗粉: [10, '大さじ1'],
                  }
                  for (const row of all.result) {
                    const old = olds[row.name]
                    if (!old) continue
                    const isCustom = row.name === '片栗粉'
                    store.put({
                      ...row,
                      pricePerUnit: isCustom ? 777 : old[0],
                      unit: old[1],
                      isDefault: !isCustom,
                      defaultPricePerUnit: old[0],
                      defaultUnit: old[1],
                    })
                    written.push(row.name)
                  }
                }
                all.onerror = () => reject(all.error)
                tx.oncomplete = () => resolve(written.sort())
                tx.onerror = () => reject(tx.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )
        check(
          'JIPRICE-01 前提: 旧値を持つ端末を作れた（小麦粉・きな粉・バター＋自分で直した片栗粉）',
          Array.isArray(jpSeeded) && jpSeeded.length === 4,
          JSON.stringify(jpSeeded),
        )
        // Dexieのライブ購読はDexie経由の書き込みしか見ていないので、必ず読み込み直す（禁じ手⑥）
        await jpPage.reload({ waitUntil: 'networkidle' })
        await jpPage.waitForTimeout(1800)

        const jpPrice = (name) => jpPage.getByLabel(`${name}の価格（円）`, { exact: true })
        const jpValue = async (name) => (await jpPrice(name).inputValue())
        const jpStatus = () => jpPage.locator('[data-testid="price-refresh-status"]').innerText()
        const jpButton = jpPage.locator('[data-testid="price-refresh"]')

        check(
          'JIPRICE-01 前提: 画面が旧値を出している（小麦粉10円・きな粉15円・バター250円）',
          (await jpValue('小麦粉')) === '10' && (await jpValue('きな粉')) === '15' && (await jpValue('バター')) === '250',
          `小麦粉=${await jpValue('小麦粉')} きな粉=${await jpValue('きな粉')} バター=${await jpValue('バター')}`,
        )
        check('JIPRICE-01 前提: 自分で直した片栗粉は777円', (await jpValue('片栗粉')) === '777')

        // ③押す前に何件変わるかが読める
        const jpStatusBefore = (await jpStatus()).replaceAll('​', '')
        check(
          'JIPRICE-01 押す前に「新しい目安価格が3件あります」と件数が出る（自分で直した片栗粉は数えない）',
          jpStatusBefore.includes('3'),
          `状態=${jpStatusBefore}`,
        )
        check('JIPRICE-01 更新できるときはボタンを押せる', await jpButton.isEnabled())

        // 確認の窓は仕掛け（installConfirmAutoPress）が出た瞬間に押してしまうので、
        // 窓そのものを掴まず、貯め口（readConfirms）から出た文言を読む
        await jpButton.click()
        await jpPage.waitForTimeout(900)
        const jpConfirm = (await readConfirms(jpPage)).at(-1) ?? ''
        check(
          'JIPRICE-01 確認に「変わるもの」「変わらないもの」が件数つきで両方出る（規約F）',
          jpConfirm.includes(ja.priceMaster.refreshChangedLabel) &&
            jpConfirm.includes(ja.priceMaster.refreshKeptLabel) &&
            jpConfirm.includes('3'),
          `確認=${jpConfirm}`,
        )
        check(
          'JIPRICE-01 確認に、何が変わるのかが食材名でも出る',
          jpConfirm.includes('小麦粉'),
          `確認=${jpConfirm}`,
        )
        check(
          'JIPRICE-01 確認は「よろしいですか？」だけにしない（取り消せることも添える）',
          jpConfirm.includes(ja.common.undo),
          `確認=${jpConfirm}`,
        )

        // ①新しい目安価格に変わる ②自分で直した行は変わらない
        check(
          'JIPRICE-01 押したら新しい目安価格になる（小麦粉2円・きな粉7円・バター600円）',
          (await jpValue('小麦粉')) === '2' && (await jpValue('きな粉')) === '7' && (await jpValue('バター')) === '600',
          `小麦粉=${await jpValue('小麦粉')} きな粉=${await jpValue('きな粉')} バター=${await jpValue('バター')}`,
        )
        check(
          'JIPRICE-01 自分で直した片栗粉は1円も変わらない',
          (await jpValue('片栗粉')) === '777',
          `片栗粉=${await jpValue('片栗粉')}`,
        )
        // ④何件変えたかを言う
        const jpBodyAfter = (await jpPage.textContent('body')).replaceAll('​', '')
        check(
          'JIPRICE-01 押したあとに何件変えたかを言う',
          jpBodyAfter.includes(ja.priceMaster.refreshedToast.replace('{n}', '3')),
          `本文に「${ja.priceMaster.refreshedToast.replace('{n}', '3')}」が無い`,
        )
        const jpStatusAfter = (await jpStatus()).replaceAll('​', '')
        check(
          'JIPRICE-01 更新したあとは「すべて最新」になり、ボタンは押せなくなる',
          jpStatusAfter.includes(ja.priceMaster.refreshUpToDate) && (await jpButton.isDisabled()),
          `状態=${jpStatusAfter}`,
        )

        // ④その場で取り消せる
        await jpPage.getByRole('button', { name: ja.common.undo, exact: true }).click()
        await jpPage.waitForTimeout(900)
        check(
          'JIPRICE-01 「元に戻す」で更新前の値に戻る',
          (await jpValue('小麦粉')) === '10' && (await jpValue('バター')) === '250',
          `小麦粉=${await jpValue('小麦粉')} バター=${await jpValue('バター')}`,
        )
        check(
          'JIPRICE-01 取り消しても、自分で直した片栗粉は777円のまま',
          (await jpValue('片栗粉')) === '777',
        )

        // もう一度更新して、⑤「デフォルトに戻す」の戻り先まで新しくなっていることを見る
        await jpButton.click()
        await jpPage.waitForTimeout(1200)
        check('JIPRICE-01 もう一度押しても同じ姿になる', (await jpValue('小麦粉')) === '2')

        const jpFlourRow = jpPage.locator('li', { hasText: '小麦粉' }).first()
        check(
          'JIPRICE-01 更新しただけの行には「デフォルトに戻す」が出ない（未編集の見え方が変わらない）',
          !(await jpFlourRow.textContent()).includes(ja.priceMaster.resetToDefault),
        )
        await jpPrice('小麦粉').fill('999')
        await jpPrice('小麦粉').press('Enter')
        await jpPage.waitForTimeout(600)
        check(
          'JIPRICE-01 前提: 自分で直したので「デフォルトに戻す」が出る',
          stripZwspText(await jpFlourRow.textContent()).includes(ja.priceMaster.resetToDefault),
        )
        await jpFlourRow.getByRole('button', { name: ja.priceMaster.resetToDefaultAria.replace('{name}', '小麦粉') }).click()
        await jpPage.waitForTimeout(700)
        check(
          'JIPRICE-01 「デフォルトに戻す」で戻るのは新しい目安価格（2円）＝古い10円に戻らない',
          (await jpValue('小麦粉')) === '2',
          `小麦粉=${await jpValue('小麦粉')}`,
        )
      } finally {
        await jpContext.close()
      }
    } finally {
      await jpBrowser.close()
    }
  }
