// ==========================================================================================
// e2e の節: 週の鍵・タイマー・調理中モード・読み上げ
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
// この中の節: WEEKLOCK, WEEKLOCK-BULK, WEEKLOCK-MONTH, BACKNAV-01, SCROLL-02, TIMER-ADJ-01, TIMER-CUSTOM-01, TIMER-KEEP-01, TIMER-ORDER-01, FOCUS-TIMER-01, TIMER-ADJ-02, FOCUS-KEEP-01, FOCUS-BACK-01, FOCUS-OTHER-01, FOCUS-NOTICE-01, FOCUSTOP-01, NAVITIMER-01, DS-MIC-01, DS-VOICE-01, DS-NAME-01, DS-MUTE-01, DS-BACK-01, DS-CUSTOMBTN-01, DS-VIB-01, DS-DONE-01, KECOST-01
// ==========================================================================================
import './_shared.mjs'

  // --- WEEKLOCK: 2026-08-08 便DX(オーナー提案)の献立のロック＋文言統一。
  //  LOCK-1 日付の右に日ごとの鍵・食事カードの右上に時間帯ごとの鍵がある
  //  LOCK-2 鍵を掛けると見た目でも分かる(鍵アイコンが閉じ、面の色が変わる)
  //  LOCK-3 「すべてロック」は「すべて折りたたむ」の隣。押すと7日分が掛かり、
  //         もう一度押すと「すべて解除」になる(トグル)
  //  LOCK-4 日ごとの鍵は、その日の朝食・昼食・夕食3つをまとめて掛ける
  //  LOCK-5 ロックした食事は「まとめて献立を入力(レシピを総入れ替え)」で変わらない
  //  LOCK-6 ロックは端末に残る(再読み込みしても掛かったまま)
  //  LOCK-7 文言統一: 画面に「畳む」が出ず「すべて折りたたむ」になっている
  //
  // 2026-08-09 便EJで見つかった落とし穴(必ず守ること):
  //  ・週タブの既定表示は月曜〜日曜の「週区切り」なので、今日が日曜だと、これからの日は
  //    今日1日しか出ない。その1日をロックすると総入れ替えの対象が0件になり、確認文が
  //    出ないまま「1品も変わらない」だけが素通りで合格する(＝守れている証明にならない)。
  //    そこでこのブロックは常に「次の週」へ送り、7日とも未来日の状態で検証する。
  //  ・ロックの検証は必ず「鍵の無い日が実際に入れ替わったこと」と対で断定する。
  //    行の照合には自動採番のid(uchi-recipe/mealPlansの主キー)も含める＝同じレシピが
  //    たまたま入り直しても「消して入れ直した」と「触っていない」を取り違えない ---
  currentCheck = 'WEEKLOCK'
  {
    const lkBrowser = await chromium.launch()
    const lkContext = await lkBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const lkPage = await lkContext.newPage()
    lkPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKLOCK] ${err.message}`)
    })
    const lkDialogs = []
    // 2026-08-15 便GW: 確認は画面の中の窓になったので、窓の文言をここへ貯める
    await collectConfirms(lkPage, lkDialogs)
    try {
      // 週タブを開き、必ず「次の週」へ送る(7日とも未来日にする)。
      // 曜日によって未来日の数が変わると検証の中身が変わってしまうため、日曜でも土曜でも
      // 同じ条件で回るようにここで固定する
      const lkOpenWeekTab = async () => {
        await lkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
        await openAllWeekDays(lkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await lkPage.waitForTimeout(700)
        await lkPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
        await openAllWeekDays(lkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await lkPage.waitForTimeout(800)
        return await lkPage.evaluate(() =>
          [...document.querySelectorAll('section[data-date]')].map((s) => s.getAttribute('data-date')),
        )
      }
      await lkPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await lkPage.waitForTimeout(1800) // 初回シード完了待ち
      const lkWeekDates = await lkOpenWeekTab()
      const lkTodayIso = await lkPage.evaluate(() => {
        const d = new Date()
        const p = (n) => String(n).padStart(2, '0')
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
      })
      check(
        'WEEKLOCK 前提: 次の週を開くと7日とも今日以降になる(曜日に左右されない土台)',
        lkWeekDates.length === 7 && lkWeekDates.every((d) => d > lkTodayIso),
        `dates=${JSON.stringify(lkWeekDates)} / today=${lkTodayIso}`,
      )

      // ---------- LOCK-7: 文言統一(「畳む」を残さない) ----------
      const lkBody = (await lkPage.textContent('body')) ?? ''
      check(
        'WEEKLOCK(LOCK-7) 週タブに「すべて折りたたむ」があり「畳む」は出ていない',
        lkBody.includes('すべて折りたたむ') && !lkBody.includes('畳む'),
      )

      // ---------- LOCK-1/3: 鍵の置き場所 ----------
      // 2026-08-22 便IV: 時間帯ごとの鍵は編集モードの中に移った（通常表示には小さな印だけ）。
      // 置き場所を測る前に、いちばん上の日を編集モードにする
      const lkEditFirst = await openWeekDayEdit(lkPage, lkWeekDates[0])
      check('WEEKLOCK 前提: 1日カードを編集モードにできた（便IV）', lkEditFirst === true)
      const lkPlacement = await lkPage.evaluate(() => {
        const dayLock = document.querySelector('[data-testid="day-lock"]')
        const dayHeading = dayLock?.closest('h2')
        const dateText = dayHeading?.querySelector('span')?.textContent ?? ''
        const slotLock = document.querySelector('[data-testid="slot-lock"]')
        const slotBlock = slotLock?.closest('[data-testid="slot-block"]')
        const lockAll = document.querySelector('[data-testid="lock-all"]')
        const collapseAll = [...document.querySelectorAll('button')].find(
          (b) => b.textContent?.trim() === 'すべて折りたたむ',
        )
        const blockRect = slotBlock?.getBoundingClientRect()
        const slotRect = slotLock?.getBoundingClientRect()
        return {
          hasDayLock: !!dayLock,
          // 日ごとの鍵は日付と同じ行(見出し)にあり、日付より右
          dayLockRightOfDate:
            !!dayHeading &&
            !!dayLock &&
            dayLock.getBoundingClientRect().left >
              (dayHeading.querySelector('span')?.getBoundingClientRect().left ?? 0),
          dateText: dateText.trim(),
          // 時間帯ごとの鍵は食事カードの右上(右端に寄り、カードの上半分にある)
          slotLockTopRight:
            !!blockRect &&
            !!slotRect &&
            blockRect.right - slotRect.right < 20 &&
            slotRect.top - blockRect.top < 20,
          // 「すべてロック」は「すべて折りたたむ」と同じ行
          lockAllNextToCollapse:
            !!lockAll && !!collapseAll && lockAll.parentElement === collapseAll.parentElement,
          lockAllText: lockAll?.textContent?.trim() ?? '',
        }
      })
      check(
        'WEEKLOCK(LOCK-1) 日付の右に日ごとの鍵がある',
        lkPlacement.hasDayLock && lkPlacement.dayLockRightOfDate,
        `placement=${JSON.stringify(lkPlacement)}`,
      )
      check(
        'WEEKLOCK(LOCK-1) 食事カードの右上に時間帯ごとの鍵がある',
        lkPlacement.slotLockTopRight,
        `placement=${JSON.stringify(lkPlacement)}`,
      )
      check(
        'WEEKLOCK(LOCK-3) 「すべてロック」は「すべて折りたたむ」の隣にある',
        lkPlacement.lockAllNextToCollapse && lkPlacement.lockAllText === 'すべてロック',
        `placement=${JSON.stringify(lkPlacement)}`,
      )

      // ---------- LOCK-2/4: 日ごとの鍵は3食まとめて掛かり、見た目でも分かる ----------
      // 鍵を掛ける日=週のいちばん最後の日／鍵を掛けない日=週のいちばん最初の日。
      // 総入れ替え(LOCK-5)では「鍵の日は動かない」と「鍵の無い日は実際に動いた」を対で見るので、
      // 対象の日を2つ取っておく
      const lkDate = lkWeekDates[lkWeekDates.length - 1]
      const lkFreeDate = lkWeekDates[0]
      // 先に献立を入れておく(ロックが「今ある献立を守る」ことを確かめるため)
      const lkFillBtn = lkPage.getByRole('button', { name: ja.mealPlan.fillWeek })
      await lkFillBtn.click()
      await lkPage.waitForTimeout(3000) // 7日ぶん書き込むので長めに待つ
      const lkSlotState = () =>
        lkPage.evaluate((date) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          const blocks = [...(section?.querySelectorAll('[data-testid="slot-block"]') ?? [])]
          return blocks.map((b) => ({
            slot: b.getAttribute('data-slot'),
            locked: b.getAttribute('data-locked') === 'true',
            bg: getComputedStyle(b).backgroundColor,
            pressed:
              b.querySelector('[data-testid="slot-lock"]')?.getAttribute('aria-pressed') === 'true',
          }))
        }, lkDate)
      // 便IV: 時間帯ごとの鍵の aria-pressed は編集モードの中にしか無いので、先に切り替える
      // （面の色＝data-locked と地色は通常表示でも同じなので、モードで測り方は変わらない）
      const lkEditTarget = await openWeekDayEdit(lkPage, lkDate)
      check('WEEKLOCK 前提: 鍵を掛ける日を編集モードにできた（便IV）', lkEditTarget === true)
      const lkBefore = await lkSlotState()
      await lkPage.locator(`[data-testid="day-lock"][data-date="${lkDate}"]`).click()
      await lkPage.waitForTimeout(600)
      const lkAfter = await lkSlotState()
      check(
        'WEEKLOCK(LOCK-4) 日ごとの鍵で、その日の表示中の食事がすべてロックされる',
        lkAfter.length > 0 && lkAfter.every((s) => s.locked && s.pressed),
        `after=${JSON.stringify(lkAfter)}`,
      )
      check(
        'WEEKLOCK(LOCK-2) ロック中の食事は面の色が変わる(鍵アイコンだけに頼らない)',
        lkBefore.length > 0 &&
          lkBefore.length === lkAfter.length &&
          lkBefore.every((s, i) => s.bg !== lkAfter[i].bg),
        `before=${JSON.stringify(lkBefore.map((s) => s.bg))} / after=${JSON.stringify(lkAfter.map((s) => s.bg))}`,
      )
      check(
        'WEEKLOCK(LOCK-2) ロックしたことを案内で伝える(何が変わらなくなるかも書く)',
        ((await lkPage.textContent('body')) ?? '').includes('ロックしました'),
      )

      // ---------- LOCK-6: 再読み込みしても掛かったまま(端末に残る) ----------
      // 再読み込みで表示週は当週へ戻るので、同じ手順でもう一度「次の週」へ送ってから見る
      await lkPage.reload({ waitUntil: 'networkidle' })
      await lkPage.waitForTimeout(1500)
      const lkWeekDatesReloaded = await lkOpenWeekTab()
      check(
        'WEEKLOCK(LOCK-6) 再読み込み後も同じ週を開き直せている(検証する日がずれていない)',
        JSON.stringify(lkWeekDatesReloaded) === JSON.stringify(lkWeekDates),
        `before=${JSON.stringify(lkWeekDates)} / after=${JSON.stringify(lkWeekDatesReloaded)}`,
      )
      const lkReloaded = await lkSlotState()
      check(
        'WEEKLOCK(LOCK-6) 再読み込みしてもロックは残る',
        lkReloaded.length > 0 && lkReloaded.every((s) => s.locked),
        `reloaded=${JSON.stringify(lkReloaded)}`,
      )

      // ---------- LOCK-5: 総入れ替えでもロックした食事は変わらない ----------
      // 行の照合には主キーのidも入れる。総入れ替えは「消してから入れ直す」ので、
      // 触られた行はidが必ず変わる＝同じレシピが引き直されても取り違えない
      const lkPlanOf = (date) =>
        lkPage.evaluate(
          (d) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result
                      .filter((e) => e.date === d)
                      .map((e) => `${e.slot}|${e.role ?? 'main'}|${e.recipeId}|id=${e.id}`)
                      .sort(),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          date,
        )
      const lkLockedPlan = await lkPlanOf(lkDate)
      const lkFreePlan = await lkPlanOf(lkFreeDate)
      check(
        'WEEKLOCK(LOCK-5) 前提: ロックした日には献立が入っている',
        lkLockedPlan.length > 0,
        `plan=${JSON.stringify(lkLockedPlan)}`,
      )
      // 「何も起きないので合格」を防ぐための前提。鍵を掛けていない日にも献立が入っていないと、
      // 総入れ替えは消すものが無くて確認文すら出さずに終わる(2026-08-09 便EJで実際に起きた)
      check(
        'WEEKLOCK(LOCK-5) 前提: ロックしていない日にも献立が入っている(入れ替える対象がある)',
        lkFreePlan.length > 0,
        `date=${lkFreeDate} / plan=${JSON.stringify(lkFreePlan)}`,
      )
      // 2026-08-09 便EN(オーナー指示): 「献立を提案」グループは既定で畳んである。
      // 中の操作(提案の条件・入れかた・先週コピー)を触る前に開く
      const lkOpenAuto = lkPage.getByRole('button', { name: '献立を提案を開く' })
      if ((await lkOpenAuto.count()) > 0) {
        await lkOpenAuto.first().click()
        await lkPage.waitForTimeout(400)
      }
      // 「総入れ替え」に切り替えて実行する(確認文は自動承認)。
      // 2026-08-20 便II・④: 入れかたはプルダウンになった
      const lkFillMode = lkPage.locator('[data-testid="fill-mode"]')
      await lkFillMode.selectOption('replaceAll')
      await lkPage.waitForTimeout(300)
      check(
        `WEEKLOCK(LOCK-5) 入れかたを「${ja.mealPlan.fillModeReplaceAll}」に切り替えられる`,
        (await lkFillMode.inputValue()) === 'replaceAll',
        `いまの入れかた=${await lkFillMode.inputValue()}`,
      )
      lkDialogs.length = 0
      await lkFillBtn.click()
      await lkPage.waitForTimeout(3500) // 消してから入れ直すので長めに待つ
      const lkAfterReplace = await lkPlanOf(lkDate)
      const lkFreeAfter = await lkPlanOf(lkFreeDate)
      // 先に「本当に総入れ替えが走った」ことを断定する。ここが通らないうちは
      // 下のロックの合格は「何も起きていないだけ」なので意味を持たない
      check(
        'WEEKLOCK(LOCK-5) 前提: ロックしていない日の献立は実際に入れ替わった(素通り防止)',
        lkFreeAfter.length > 0 &&
          lkFreeAfter.every((row) => !lkFreePlan.includes(row)) &&
          lkFreePlan.every((row) => !lkFreeAfter.includes(row)),
        `date=${lkFreeDate} / before=${JSON.stringify(lkFreePlan)} / after=${JSON.stringify(lkFreeAfter)}`,
      )
      check(
        'WEEKLOCK(LOCK-5) 総入れ替えでもロック中の日の献立は1品も変わらない',
        JSON.stringify(lkAfterReplace) === JSON.stringify(lkLockedPlan),
        `before=${JSON.stringify(lkLockedPlan)} / after=${JSON.stringify(lkAfterReplace)}`,
      )
      check(
        'WEEKLOCK(LOCK-5) 総入れ替えの確認文に「ロック中の◯食分は変わりません」がある(規約F)',
        lkDialogs.some((m) => jaRe(ja.mealPlan.lockedSlotNotice, { n: '\\d+' }).test(m)),
        `dialogs=${JSON.stringify(lkDialogs)}`,
      )
      // 規約F: 消えるものも件数つきで書く。「変わりません」だけでは片手落ち
      check(
        'WEEKLOCK(LOCK-5) 総入れ替えの確認文に消える品数と食分が入っている(規約F)',
        // 2026-08-27 便LT: 言い方は ja.ts の型紙から組み立てる（画面の字を書き写さない＝禁じ手②）。
        // 数字の入る形だけを見るので、文言を書き直しても数が出ているかぎり赤くならない
        lkDialogs.some((m) =>
          new RegExp(
            `消えるもの: ${ja.mealPlan.fillModeReplaceAllGone
              .replace('{s}', '[1-9]\\d*')
              .replace('{n}', '[1-9]\\d*')}`,
          ).test(m),
        ),
        `dialogs=${JSON.stringify(lkDialogs)}`,
      )
      /* 2026-08-27 便LT（オーナー原文「すべて未来の日付でも「今日以降の献立を」と文の途中に
         はいっていたり。…文に分けてみては？」）: 「今日以降」は見出しにも項目にも埋めず、
         過ぎた日が混ざるときだけ出す1行に分けた。**日付に左右されない形で見る**＝
         その語が出ているなら、必ずその1行の形で出ていること（禁じ手①よけ） */
      check(
        'WEEKLOCK(便LT) 「今日以降」は、見出しや項目の途中ではなく分けた1行でだけ出る',
        // 空の並びでも通る every にしない（窓を1つも読めていないなら、まず前提が崩れている）
        lkDialogs.length > 0 &&
          lkDialogs.every(
            (m) => !m.includes('今日以降') || m.includes(stripZwspText(ja.mealPlan.replaceAllPastNote)),
          ),
        `dialogs=${JSON.stringify(lkDialogs)}`,
      )

      // ---------- LOCK-3: すべてロック → すべて解除(トグル) ----------
      const lkLockAll = lkPage.locator('[data-testid="lock-all"]')
      await lkLockAll.click()
      await lkPage.waitForTimeout(800)
      check(
        'WEEKLOCK(LOCK-3) 「すべてロック」を押すとボタンが「すべて解除」に変わる',
        (await lkLockAll.textContent())?.trim() === 'すべて解除',
        `text=${await lkLockAll.textContent()}`,
      )
      // 数え方に注意: 食事カードが1枚も無いと every() は空配列で true を返し、
      // 「ロックできている」と「そもそも何も出ていない」を取り違える。必ず枚数も見る
      const lkBlockLockState = () =>
        lkPage.evaluate(() => {
          const blocks = [...document.querySelectorAll('[data-testid="slot-block"]')]
          return { total: blocks.length, locked: blocks.filter((b) => b.getAttribute('data-locked') === 'true').length }
        })
      const lkAllLocked = await lkBlockLockState()
      check(
        'WEEKLOCK(LOCK-3) 「すべてロック」で表示中の食事がすべてロックされる',
        lkAllLocked.total > 0 && lkAllLocked.locked === lkAllLocked.total,
        `state=${JSON.stringify(lkAllLocked)}`,
      )
      await lkLockAll.click()
      await lkPage.waitForTimeout(800)
      const lkAllReleased = await lkBlockLockState()
      check(
        'WEEKLOCK(LOCK-3) もう一度押すとすべて解除される(時間帯ごとの鍵も残さない)',
        lkAllReleased.total > 0 &&
          lkAllReleased.locked === 0 &&
          (await lkLockAll.textContent())?.trim() === 'すべてロック',
        `state=${JSON.stringify(lkAllReleased)}`,
      )

      // ---------- 便EA: ロックは「手での削除・変更」も止める(オーナー指示) ----------
      // 便DXの鍵は自動操作だけを止めており、×(削除)・料理名(差し替え)・食数・サイコロは
      // 押せたままだった。鍵を掛けたら全部止まり、外せば元どおり操作できることを固定する
      await lkPage.locator(`[data-testid="day-lock"][data-date="${lkDate}"]`).click()
      await lkPage.waitForTimeout(700)
      // 便IV: ×・料理名・食数・サイコロ・「＋料理を追加」は編集モードの中にある
      const lkEditForCtl = await openWeekDayEdit(lkPage, lkDate)
      check('WEEKLOCK(便EA) 前提: 操作を測る日を編集モードにできた（便IV）', lkEditForCtl === true)
      const lkControls = () =>
        // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（便JM）
        lkPage.evaluate(({ date, suggestAria, servingsAria }) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          const block = section?.querySelector('[data-testid="slot-block"]')
          if (!block) return null
          const buttons = [...block.querySelectorAll('button')]
          const remove = buttons.find((b) => b.getAttribute('aria-label') === 'この割り当てを外す')
          // 差し替えのボタン。2026-08-19 便HXまではクラス名(flex-1)で拾っていたが、
          // それは自前で組んでいた行の内部の書き方＝便HWで共通のレシピカードに寄せた時点で
          // 当たらなくなり、ロック中も解除後も null(=測れていない)になっていた。
          // 2026-08-25 便KU: 差し替えは料理名のカードから「レシピを変更」のボタンへ移った
          // （カードの押下はレシピ詳細＝鍵に関わらず読める）。掴む先だけを移す。
          // 見つからなければ null のまま＝下の判定(=== true / === false)はどちらも不合格になる
          const name = block.querySelector('[data-testid="slot-change-recipe"]')
          const servings = buttons.find((b) =>
            (b.getAttribute('aria-label') ?? '').includes(servingsAria),
          )
          const dice = buttons.find((b) => b.getAttribute('aria-label') === suggestAria)
          return {
            removeDisabled: remove ? remove.disabled : null,
            // ボタンでなくなっていたら(押せなくする口が無い形に変わっていたら) null＝不合格に倒す
            nameDisabled: name instanceof HTMLButtonElement ? name.disabled : null,
            servingsDisabled: servings ? servings.disabled : null,
            diceCount: dice ? 1 : 0,
            note: block.querySelector('[data-testid="slot-lock-note"]')?.textContent ?? '',
            addRow: [...block.querySelectorAll('button')].some(
              (b) => b.textContent?.trim() === '＋料理を追加',
            ),
          }
        },
        {
          date: lkDate,
          suggestAria: ja.mealPlan.suggestAria,
          // 食数のボタンの aria-label には人数が入る（「（いま{n}人分）」）ので、その手前までを渡す
          servingsAria: ja.mealPlan.servingsEditAria.split('（')[0],
        })
      const lkLockedCtl = await lkControls()
      check(
        'WEEKLOCK(便EA→便KU) ロック中は ×(削除)・レシピを変更・食数 が押せない',
        !!lkLockedCtl &&
          lkLockedCtl.removeDisabled === true &&
          lkLockedCtl.nameDisabled === true &&
          lkLockedCtl.servingsDisabled === true,
        `ctl=${JSON.stringify(lkLockedCtl)}`,
      )
      check(
        'WEEKLOCK(便EA) ロック中はサイコロと「＋料理を追加」を出さない',
        !!lkLockedCtl && lkLockedCtl.diceCount === 0 && lkLockedCtl.addRow === false,
        `ctl=${JSON.stringify(lkLockedCtl)}`,
      )
      check(
        'WEEKLOCK(便EA→便FD) ロック中の枠に「ロック中」の1行が出る',
        // 2026-08-10 便FD で期待値を更新（オーナー実機「文章が窮屈に感じる。
        // 「ロック中」のみで通じる」）。何ができなくなるかは鍵を掛けたときの案内が言う
        !!lkLockedCtl && lkLockedCtl.note === 'ロック中',
        `note=${lkLockedCtl?.note}`,
      )
      // 実際に消えないこと(DBの献立が1品も変わらない)。
      // 消える対象が1品も無ければ「消えなかった」に意味が無いので、件数も前提として見る
      const lkClickRemove = () =>
        lkPage.evaluate((date) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          const block = section?.querySelector('[data-testid="slot-block"]')
          const remove = [...(block?.querySelectorAll('button') ?? [])].find(
            (b) => b.getAttribute('aria-label') === 'この割り当てを外す',
          )
          if (!remove) return false
          remove.click()
          return true
        }, lkDate)
      const lkPlanBeforeManual = await lkPlanOf(lkDate)
      await lkClickRemove()
      await lkPage.waitForTimeout(700)
      check(
        'WEEKLOCK(便EA) ロック中は×を押しても献立が消えない',
        lkPlanBeforeManual.length > 0 &&
          JSON.stringify(await lkPlanOf(lkDate)) === JSON.stringify(lkPlanBeforeManual),
        `before=${JSON.stringify(lkPlanBeforeManual)}`,
      )
      // 2026-08-19 便HX: 差し替えは「押せない印が付いている」だけでなく、
      // **実際に押しても差し替えの画面が開かない**ことまで見る。
      // 便HWで掴み方が外れたとき、印だけを見る書き方では null(測れていない)で落ちるまで
      // 気付けなかった＝押した結果まで見ておくと、印の名前が変わっても意味が残る
      const lkClickName = () =>
        lkPage.evaluate((date) => {
          const section = document.querySelector(`section[data-date="${date}"]`)
          const name = section
            ?.querySelector('[data-testid="slot-block"]')
            ?.querySelector('[data-testid="slot-change-recipe"]')
          if (!name) return false
          name.click()
          return true
        }, lkDate)
      const lkNameClickedWhileLocked = await lkClickName()
      await lkPage.waitForTimeout(700)
      check(
        'WEEKLOCK(便EA→便KU) ロック中は「レシピを変更」を押しても差し替えの画面が開かない',
        lkNameClickedWhileLocked === true &&
          (await lkPage.locator('[data-testid="recipe-picker"]').count()) === 0,
        `押せた=${lkNameClickedWhileLocked}`,
      )

      // 鍵を外せば元どおり操作できる
      await lkPage.locator(`[data-testid="day-lock"][data-date="${lkDate}"]`).click()
      await lkPage.waitForTimeout(700)
      const lkUnlockedCtl = await lkControls()
      check(
        'WEEKLOCK(便EA) 鍵を外すと ×・料理名・食数 が元どおり押せる',
        !!lkUnlockedCtl &&
          lkUnlockedCtl.removeDisabled === false &&
          lkUnlockedCtl.nameDisabled === false &&
          lkUnlockedCtl.servingsDisabled === false &&
          lkUnlockedCtl.note === '',
        `ctl=${JSON.stringify(lkUnlockedCtl)}`,
      )
      // 「出さない」側の断定も、外したら戻ることまで見て対にする
      // (出ていないだけの状態と、鍵で消している状態を取り違えないため)
      check(
        'WEEKLOCK(便EA) 鍵を外すとサイコロと「＋料理を追加」も戻る',
        !!lkUnlockedCtl && lkUnlockedCtl.diceCount === 1 && lkUnlockedCtl.addRow === true,
        `ctl=${JSON.stringify(lkUnlockedCtl)}`,
      )
      // 対の確認(2026-08-19 便HX): 鍵を外せば同じ料理名で差し替えの画面がちゃんと開く
      // ＝「この料理名はもともと押しても何も起きない」ではないことの証明。開いたら閉じて戻す
      const lkNameClickedAfterUnlock = await lkClickName()
      await lkPage.waitForTimeout(700)
      const lkPickerOpened = (await lkPage.locator('[data-testid="recipe-picker"]').count()) === 1
      check(
        'WEEKLOCK(便EA) 鍵を外すと同じ料理名で差し替えの画面が開く(対の確認)',
        lkNameClickedAfterUnlock === true && lkPickerOpened,
        `押せた=${lkNameClickedAfterUnlock} / 開いた=${lkPickerOpened}`,
      )
      if (lkPickerOpened) {
        await lkPage
          .locator('[data-testid="recipe-picker"]')
          .getByRole('button', { name: ja.common.close })
          .first()
          .click()
        await lkPage.waitForTimeout(500)
      }

      // 素通り防止(2026-08-09 便EJ): 同じ×を、鍵を外した状態でもう一度押すと今度は実際に消える。
      // これが無いと「ロック中は消えない」は「×はもともと効かないボタン」でも合格してしまう
      const lkPlanBeforeRealRemove = await lkPlanOf(lkDate)
      await lkClickRemove()
      await lkPage.waitForTimeout(900)
      const lkPlanAfterRealRemove = await lkPlanOf(lkDate)
      check(
        'WEEKLOCK(便EA) 鍵を外すと同じ×で実際に1品消える(効かないボタンではないことの対の確認)',
        lkPlanBeforeRealRemove.length > 0 &&
          lkPlanAfterRealRemove.length === lkPlanBeforeRealRemove.length - 1,
        `before=${JSON.stringify(lkPlanBeforeRealRemove)} / after=${JSON.stringify(lkPlanAfterRealRemove)}`,
      )

      // ---------- 便EA: 押せるままのボタンから来ても、実処理の入口で止まる ----------
      // 週の行の×・料理名・食数はボタン自体を押せなくしているので、実処理側の関所
      // (blockedByLock)まで届かない。日タブの「◯食に入れる」は鍵が掛かっていても押せる
      // 作りなので、この経路で「関所で止まる・黙らず案内する」を確かめる。
      // 鍵を外すと同じ操作が通ることまで対で見る(2026-08-09 便EJ)
      const lkTodayDinner = () =>
        lkPage.evaluate(
          (d) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(g.result.filter((e) => e.date === d && e.slot === 'dinner').length)
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          lkTodayIso,
        ).catch(() => -1)
      // 「レシピ一覧から選択中」に1品置く(日タブの「夕食に入れる」を出すため)
      const lkSeeded = await lkPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const side = g.result.find((r) => r.title === 'ほうれん草のおひたし')
                if (!side) {
                  resolve(false)
                  return
                }
                const wtx = idb.transaction('todayList', 'readwrite')
                wtx.objectStore('todayList').add({ recipeId: side.id, addedAt: Date.now() })
                wtx.oncomplete = () => resolve(true)
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('WEEKLOCK(便EA) 前提: 日タブの「レシピ一覧から選択中」に1品置けた', lkSeeded === true)
      await lkPage.reload({ waitUntil: 'networkidle' })
      await lkPage.waitForTimeout(1500)
      // 今日の夕食に鍵を掛ける(週タブは再読み込みで当週へ戻っているのでそのまま使う)
      await lkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(lkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await lkPage.waitForTimeout(700)
      // 便IV: 時間帯ごとの鍵は編集モードの中
      check(
        'WEEKLOCK(便EA) 前提: 今日のカードを編集モードにできた（便IV）',
        (await openWeekDayEdit(lkPage, lkTodayIso)) === true,
      )
      const lkTodaySlotLock = lkPage.locator(
        `section[data-date="${lkTodayIso}"] [data-testid="slot-block"][data-slot="dinner"] [data-testid="slot-lock"]`,
      )
      await lkTodaySlotLock.click()
      await lkPage.waitForTimeout(700)
      check(
        'WEEKLOCK(便EA) 前提: 今日の夕食に鍵が掛かった',
        (await lkTodaySlotLock.getAttribute('aria-pressed')) === 'true',
      )
      const lkDinnerBeforeBlocked = await lkTodayDinner()
      await lkPage.getByRole('button', { name: '日', exact: true }).click()
      await lkPage.waitForTimeout(700)
      await lkPage.getByRole('button', { name: '夕食に入れる' }).first().click()
      await lkPage.waitForTimeout(900)
      check(
        'WEEKLOCK(便EA) 押せるままのボタンから来ても、鍵が掛かっていれば献立は増えない',
        (await lkTodayDinner()) === lkDinnerBeforeBlocked,
        `before=${lkDinnerBeforeBlocked} / after=${await lkTodayDinner()}`,
      )
      check(
        'WEEKLOCK(便EA) 止めたことを黙らず案内する(ロック中です。鍵を外すと変更できます)',
        stripZwspText(await lkPage.textContent('body')).includes(ja.mealPlan.lockedEditBlocked),
      )
      // 鍵を外すと同じ操作が通る＝「この経路はもともと動かない」ではないことの証明
      await lkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(lkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await lkPage.waitForTimeout(700)
      await openWeekDayEdit(lkPage, lkTodayIso) // 便IV: 時間帯ごとの鍵は編集モードの中
      await lkTodaySlotLock.click()
      await lkPage.waitForTimeout(700)
      await lkPage.getByRole('button', { name: '日', exact: true }).click()
      await lkPage.waitForTimeout(700)
      await lkPage.getByRole('button', { name: '夕食に入れる' }).first().click()
      await lkPage.waitForTimeout(900)
      check(
        'WEEKLOCK(便EA) 鍵を外すと同じボタンで今日の夕食に1品入る(対の確認)',
        (await lkTodayDinner()) === lkDinnerBeforeBlocked + 1,
        `before=${lkDinnerBeforeBlocked} / after=${await lkTodayDinner()}`,
      )
    } finally {
      await lkBrowser.close()
    }
  }

  // --- WEEKLOCK-BULK: 一括操作4経路のロックを「画面のボタンから」確かめる
  // (2026-08-09 便EK・便EJの申し送り)。
  // 純ロジック(logic/mealPlan.ts planCopyLastWeek/planClearMealSlots・
  // logic/mealTemplate.ts planTemplateFill)には単体テストがあるが、画面のボタンから同じ結果に
  // なるかは「まとめて献立を入力(レシピを総入れ替え)」(WEEKLOCK LOCK-5)しか見ていなかった。
  // 残る4経路 ①テンプレートを適用 ②別の週から入れる ③まとめて空にする
  // ④月の献立をまとめて提案 を、実際の操作で確かめる(④は月タブなので別ブロック)。
  //
  // 便EJが確立した「素通り不可能」の形をそのまま踏襲する:
  //  ①その操作が効くはずの前提(入る中身がある/消える中身がある)を先に断定
  //  ②鍵の無い日が実際に変わったことを先に断定(何も起きなくても合格、を防ぐ)
  //  ③そのうえで鍵の日が不変(主キーidまで同じ)であることを見る
  //  ④鍵を外すと同じ操作が鍵の日にも効く(=「この経路はもともと動かない」ではないことの証明)
  //
  // 日付依存を避けるため、週タブを「今日から7日間」表示にしてから「次の週」へ送る
  // (曜日に関係なく7日とも未来日になり、1週間前は必ず「今日から7日間」＝先に埋めた週になる) ---
  currentCheck = 'WEEKLOCK-BULK'
  {
    const bkBrowser = await chromium.launch()
    const bkContext = await bkBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const bkPage = await bkContext.newPage()
    bkPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKLOCK-BULK] ${err.message}`)
    })
    const bkDialogs = []
    await collectConfirms(bkPage, bkDialogs)
    try {
      // 献立(mealPlans)をその日付ぶんだけ、主キーidまで含めて読む。
      // idを混ぜるのは「消して入れ直した」と「触っていない」を取り違えないため(便EJ)
      const bkPlanOf = (date) =>
        bkPage.evaluate(
          (d) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result
                      .filter((e) => e.date === d)
                      .map((e) => `${e.slot}|${e.role ?? 'main'}|${e.recipeId}|id=${e.id}`)
                      .sort(),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          date,
        )
      const bkWeekDates = () =>
        bkPage.evaluate(() =>
          [...document.querySelectorAll('section[data-date]')].map((s) => s.getAttribute('data-date')),
        )
      // 折りたたみグループ(表示のしかた/献立を提案/別の週・テンプレートから入れる)を開く。
      // 開いているときは「◯◯を開く」ボタンが存在しない＝何もしない
      const bkOpenGroup = async (title) => {
        const btn = bkPage.getByRole('button', { name: `${title}を開く` })
        if ((await btn.count()) > 0) {
          await btn.first().click()
          await bkPage.waitForTimeout(400)
        }
      }
      const bkDayLock = (date) => bkPage.locator(`[data-testid="day-lock"][data-date="${date}"]`)
      const bkLockedState = (date) => bkDayLock(date).getAttribute('aria-pressed')
      const bkNextWeek = async () => {
        await bkPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
        await openAllWeekDays(bkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await bkPage.waitForTimeout(900)
      }

      await bkPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await bkPage.waitForTimeout(1800) // 初回シード完了待ち
      await bkPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(bkPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await bkPage.waitForTimeout(700)
      await bkOpenGroup(ja.mealPlan.weekGroupDisplayTitle)
      await selectWeekLayout(bkPage, ja.mealPlan.weekLayoutRolling)
      await bkPage.waitForTimeout(900)
      const bkWeekA = await bkWeekDates()
      check(
        'WEEKLOCK-BULK 前提: 「今日から7日間」で7日とも出る(曜日に左右されない土台)',
        bkWeekA.length === 7,
        `dates=${JSON.stringify(bkWeekA)}`,
      )

      // 土台: 今日から7日間を埋め、その週を献立テンプレートとして保存する
      // (テンプレート適用と先週コピーの「入れる中身」をここで作る)
      const bkFill = bkPage.getByRole('button', { name: ja.mealPlan.fillWeek })
      await bkFill.click()
      await bkPage.waitForTimeout(3500) // 7日ぶん書き込むので長めに待つ
      await bkOpenGroup(ja.mealPlan.weekGroupTemplateTitle)
      await bkPage.getByRole('button', { name: ja.mealPlan.templateSave }).click()
      await bkPage.waitForTimeout(500)
      await bkPage.getByPlaceholder(ja.mealPlan.templateNamePlaceholder).fill('EK検証用')
      await bkPage.getByRole('button', { name: '保存する', exact: true }).click()
      await bkPage.waitForTimeout(800)
      check(
        'WEEKLOCK-BULK 前提: 埋めた週をテンプレートとして保存できた',
        ((await bkPage.textContent('body')) ?? '').includes('テンプレート「EK検証用」を'),
      )

      // ---------- ① テンプレートを適用（非破壊＝空いているところにだけ入る） ----------
      await bkNextWeek()
      const bkWeekB = await bkWeekDates()
      const bkLockedB = bkWeekB[0]
      const bkFreeB = bkWeekB[1]
      check(
        'WEEKLOCK-BULK(テンプレ) 前提: 入れる先の週は空(鍵の日・鍵の無い日とも0件)',
        (await bkPlanOf(bkLockedB)).length === 0 && (await bkPlanOf(bkFreeB)).length === 0,
        `locked=${bkLockedB} free=${bkFreeB}`,
      )
      await bkDayLock(bkLockedB).click()
      await bkPage.waitForTimeout(700)
      check(
        'WEEKLOCK-BULK(テンプレ) 前提: 入れる先の1日に鍵を掛けた',
        (await bkLockedState(bkLockedB)) === 'true',
      )
      const bkApplyTemplate = async () => {
        await bkOpenGroup(ja.mealPlan.weekGroupTemplateTitle)
        await bkPage.getByRole('button', { name: 'テンプレートを適用', exact: true }).first().click()
        await bkPage.waitForTimeout(600)
        bkDialogs.length = 0
        await bkPage.getByRole('button', { name: '入れる', exact: true }).click()
        await bkPage.waitForTimeout(3000)
      }
      await bkApplyTemplate()
      // 先に「本当にテンプレートが入った」ことを断定する。ここが通らないうちは
      // 下のロックの合格は「何も起きていないだけ」なので意味を持たない
      check(
        'WEEKLOCK-BULK(テンプレ) 鍵の無い日にはテンプレートの献立が入った(素通り防止)',
        (await bkPlanOf(bkFreeB)).length > 0,
        `date=${bkFreeB} / plan=${JSON.stringify(await bkPlanOf(bkFreeB))}`,
      )
      check(
        'WEEKLOCK-BULK(テンプレ) 鍵の日にはテンプレートの献立が入らない',
        (await bkPlanOf(bkLockedB)).length === 0,
        `date=${bkLockedB} / plan=${JSON.stringify(await bkPlanOf(bkLockedB))}`,
      )
      check(
        'WEEKLOCK-BULK(テンプレ) 確認文に「ロック中の◯食分は変わりません」がある(規約F)',
        bkDialogs.some((m) => jaRe(ja.mealPlan.lockedSlotNotice, { n: '\\d+' }).test(m)),
        `dialogs=${JSON.stringify(bkDialogs)}`,
      )
      // 対の確認: 鍵を外すと同じ操作で入る＝「テンプレートがそもそも入らない日」ではない
      await bkDayLock(bkLockedB).click()
      await bkPage.waitForTimeout(700)
      await bkApplyTemplate()
      check(
        'WEEKLOCK-BULK(テンプレ) 鍵を外すと同じ操作で入る(対の確認)',
        (await bkPlanOf(bkLockedB)).length > 0,
        `date=${bkLockedB} / plan=${JSON.stringify(await bkPlanOf(bkLockedB))}`,
      )

      // ---------- ② 別の週から入れる（非破壊＝空いているところにだけ入る） ----------
      // 入れる中身の週は1週間前＝いまテンプレートで埋めた週
      await bkNextWeek()
      const bkWeekC = await bkWeekDates()
      const bkLockedC = bkWeekC[0]
      const bkFreeC = bkWeekC[1]
      check(
        'WEEKLOCK-BULK(別の週から入れる) 前提: 入れる中身の週(1週間前)の対象2日に献立がある',
        (await bkPlanOf(bkWeekB[0])).length > 0 && (await bkPlanOf(bkWeekB[1])).length > 0,
        `src=${JSON.stringify([bkWeekB[0], bkWeekB[1]])}`,
      )
      check(
        'WEEKLOCK-BULK(別の週から入れる) 前提: 入れ先の2日は空',
        (await bkPlanOf(bkLockedC)).length === 0 && (await bkPlanOf(bkFreeC)).length === 0,
        `locked=${bkLockedC} free=${bkFreeC}`,
      )
      await bkDayLock(bkLockedC).click()
      await bkPage.waitForTimeout(700)
      check(
        'WEEKLOCK-BULK(別の週から入れる) 前提: 入れ先の1日に鍵を掛けた',
        (await bkLockedState(bkLockedC)) === 'true',
      )
      // 2026-08-21 便IO: 別の週から入れる道は専用の画面へ移った。
      // 入口 → 1週間前の中身が出ている画面 → 「この週の献立を入れる」で実行し、
      // 終わると「週」の画面（入れ先の週）へ戻る
      // 2026-08-22 便IV: この入口はテンプレートの節の折りたたみの中へ戻った
      // （オーナー原文「テンプレートエリアは折りたたみ状態でボタンはなし。」）ので、先に開く
      const bkCopyFromOtherWeek = async () => {
        bkDialogs.length = 0
        await openWeekGroup(bkPage, ja.mealPlan.weekGroupTemplateTitle)
        await bkPage.locator('[data-testid="week-copy-pick"]').click()
        await bkPage.waitForTimeout(900)
        await bkPage.locator('[data-testid="copy-pick-run"]').click()
        await bkPage.waitForTimeout(3000)
      }
      await bkCopyFromOtherWeek()
      check(
        'WEEKLOCK-BULK(別の週から入れる) 鍵の無い日には前の週の献立が写った(素通り防止)',
        (await bkPlanOf(bkFreeC)).length > 0,
        `date=${bkFreeC} / plan=${JSON.stringify(await bkPlanOf(bkFreeC))}`,
      )
      check(
        'WEEKLOCK-BULK(別の週から入れる) 鍵の日には前の週の献立が写らない',
        (await bkPlanOf(bkLockedC)).length === 0,
        `date=${bkLockedC} / plan=${JSON.stringify(await bkPlanOf(bkLockedC))}`,
      )
      check(
        'WEEKLOCK-BULK(別の週から入れる) 確認文に「ロック中の◯食分は変わりません」がある(規約F)',
        bkDialogs.some((m) => jaRe(ja.mealPlan.lockedSlotNotice, { n: '\\d+' }).test(m)),
        `dialogs=${JSON.stringify(bkDialogs)}`,
      )
      // 対の確認: 鍵を外すと同じ操作で写る
      await bkDayLock(bkLockedC).click()
      await bkPage.waitForTimeout(700)
      await bkCopyFromOtherWeek()
      check(
        'WEEKLOCK-BULK(別の週から入れる) 鍵を外すと同じ操作で写る(対の確認)',
        (await bkPlanOf(bkLockedC)).length > 0,
        `date=${bkLockedC} / plan=${JSON.stringify(await bkPlanOf(bkLockedC))}`,
      )

      // ---------- ③ まとめて空にする（破壊的＝選んだ食事の予定を消す） ----------
      await bkDayLock(bkLockedC).click()
      await bkPage.waitForTimeout(700)
      check(
        'WEEKLOCK-BULK(まとめて空) 前提: 消す対象の週の1日に鍵を掛け直した',
        (await bkLockedState(bkLockedC)) === 'true',
      )
      // 2026-08-23 便JL: **消す前に、画面がまだ同じ週を出していることを断定する**。
      // 「まとめて空にする」が消すのは「表示している週」なので、ここで週がすり替わっていると
      // 下の判定は「別の週を消したかどうか」を見ることになる（実際にそうなっていた＝
      // 「別の週から入れる」から戻ると、今日から7日間の設定が届く前に月曜始まりの週へ
      // 着地していた）。曜日によっては消したい日がその週に紛れ込んで**緑に化ける**ので、
      // 日付ではなく「週が変わっていないこと」を測る
      check(
        'WEEKLOCK-BULK(まとめて空) 前提: 一括操作から戻っても、表示している週は変わっていない',
        JSON.stringify(await bkWeekDates()) === JSON.stringify(bkWeekC),
        `見ていた週=${JSON.stringify(bkWeekC)} / いま出ている週=${JSON.stringify(await bkWeekDates())}`,
      )
      const bkLockedCBefore = await bkPlanOf(bkLockedC)
      const bkFreeCBefore = await bkPlanOf(bkFreeC)
      check(
        'WEEKLOCK-BULK(まとめて空) 前提: 鍵の日・鍵の無い日とも献立が入っている',
        bkLockedCBefore.length > 0 && bkFreeCBefore.length > 0,
        `locked=${JSON.stringify(bkLockedCBefore)} / free=${JSON.stringify(bkFreeCBefore)}`,
      )
      await bkOpenGroup(ja.mealPlan.weekGroupDisplayTitle)
      bkDialogs.length = 0
      await bkPage.getByRole('button', { name: ja.mealPlan.clearWeekSlotButton, exact: true }).click()
      await bkPage.waitForTimeout(1500)
      check(
        'WEEKLOCK-BULK(まとめて空) 鍵の無い日の予定は実際に消えた(素通り防止)',
        (await bkPlanOf(bkFreeC)).length === 0,
        `date=${bkFreeC} / before=${JSON.stringify(bkFreeCBefore)} / after=${JSON.stringify(await bkPlanOf(bkFreeC))}`,
      )
      check(
        'WEEKLOCK-BULK(まとめて空) 鍵の日の献立は主キーidまで1つも変わらない',
        JSON.stringify(await bkPlanOf(bkLockedC)) === JSON.stringify(bkLockedCBefore),
        `before=${JSON.stringify(bkLockedCBefore)} / after=${JSON.stringify(await bkPlanOf(bkLockedC))}`,
      )
      check(
        'WEEKLOCK-BULK(まとめて空) 確認文に「ロック中の◯食分は変わりません」がある(規約F)',
        bkDialogs.some((m) => jaRe(ja.mealPlan.lockedSlotNotice, { n: '\\d+' }).test(m)),
        `dialogs=${JSON.stringify(bkDialogs)}`,
      )
      // 対の確認: 鍵を外すと同じ操作で消える
      await bkDayLock(bkLockedC).click()
      await bkPage.waitForTimeout(700)
      await bkPage.getByRole('button', { name: ja.mealPlan.clearWeekSlotButton, exact: true }).click()
      await bkPage.waitForTimeout(1500)
      check(
        'WEEKLOCK-BULK(まとめて空) 鍵を外すと同じ操作で消える(対の確認)',
        (await bkPlanOf(bkLockedC)).length === 0,
        `date=${bkLockedC} / after=${JSON.stringify(await bkPlanOf(bkLockedC))}`,
      )
    } finally {
      await bkBrowser.close()
    }
  }

  // --- WEEKLOCK-MONTH: 4経路目「月の献立をまとめて提案」のロックを画面から確かめる。
  // 月タブはPro版の機能なので解錠コードを入れてから使う。まっさらなプロファイルで、
  // 必ず「次の月」(まるごと未来の月＝全日が未定)を対象にする＝実行日の日付に左右されない。
  // 鍵は週タブにしか無いので、その月の連続2日が7日分に入るまで「次の週」を送ってから掛ける ---
  currentCheck = 'WEEKLOCK-MONTH'
  {
    const bmBrowser = await chromium.launch()
    const bmContext = await bmBrowser.newContext({ viewport: { width: 390, height: 844 } })
    const bmPage = await bmContext.newPage()
    bmPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@WEEKLOCK-MONTH] ${err.message}`)
    })
    const bmDialogs = []
    await collectConfirms(bmPage, bmDialogs)
    try {
      const bmPlanOf = (date) =>
        bmPage.evaluate(
          (d) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result
                      .filter((e) => e.date === d)
                      .map((e) => `${e.slot}|${e.role ?? 'main'}|${e.recipeId}|id=${e.id}`)
                      .sort(),
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          date,
        )
      // Pro解錠(月タブはPro版の機能)。コードはUNLOCK-01と同じ検証用の1本を使う
      await bmPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await bmPage.waitForTimeout(1800)
      await bmPage.getByPlaceholder(ja.settings.unlockCodePlaceholder).fill('UR-96QS-2VSZ')
      await bmPage.getByRole('button', { name: ja.settings.unlockActivate, exact: true }).click()
      await bmPage.waitForTimeout(900)
      check(
        'WEEKLOCK-MONTH 前提: Pro版を解錠した(月タブが使える)',
        stripZwspText(await bmPage.textContent('body')).includes(ja.settings.proActivatedTitle),
      )

      // 週タブで「次の月」の連続2日を探し、その最初の日に鍵を掛ける
      await bmPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await bmPage.waitForTimeout(1800)
      await bmPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(bmPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await bmPage.waitForTimeout(700)
      const bmNextMonth = await bmPage.evaluate(() => {
        const d = new Date()
        d.setDate(1)
        d.setMonth(d.getMonth() + 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
      let bmPair = null
      for (let i = 0; i < 8 && bmPair == null; i++) {
        const ds = await bmPage.evaluate(() =>
          [...document.querySelectorAll('section[data-date]')].map((s) => s.getAttribute('data-date')),
        )
        for (let j = 0; j + 1 < ds.length; j++) {
          if (ds[j].startsWith(bmNextMonth) && ds[j + 1].startsWith(bmNextMonth)) {
            bmPair = [ds[j], ds[j + 1]]
            break
          }
        }
        if (bmPair == null) {
          await bmPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
          await openAllWeekDays(bmPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
          await bmPage.waitForTimeout(800)
        }
      }
      check(
        'WEEKLOCK-MONTH 前提: 次の月の連続2日を週タブで開けた',
        bmPair != null,
        `nextMonth=${bmNextMonth}`,
      )
      const bmLocked = bmPair[0]
      const bmFree = bmPair[1]
      await bmPage.locator(`[data-testid="day-lock"][data-date="${bmLocked}"]`).click()
      await bmPage.waitForTimeout(700)
      check(
        'WEEKLOCK-MONTH 前提: 次の月の1日に鍵を掛けた',
        (await bmPage
          .locator(`[data-testid="day-lock"][data-date="${bmLocked}"]`)
          .getAttribute('aria-pressed')) === 'true',
      )
      check(
        'WEEKLOCK-MONTH 前提: 対象の2日はどちらも未定(0件)',
        (await bmPlanOf(bmLocked)).length === 0 && (await bmPlanOf(bmFree)).length === 0,
        `locked=${bmLocked} free=${bmFree}`,
      )

      // 月タブ→次の月→献立をまとめて提案。
      // 月タブの表示月はタブを離れても保たれるので、毎回「今月へ戻る」で起点をそろえてから
      // 1つだけ進める（そろえずに「次の月」を押すと2か月先へ行き、鍵の日と別の月を埋めてしまう）
      const bmOpenNextMonth = async () => {
        await bmPage.getByRole('button', { name: '月', exact: true }).click()
        await bmPage.waitForTimeout(1000)
        const backToThisMonth = bmPage.getByRole('button', { name: ja.mealPlan.thisMonth })
        if ((await backToThisMonth.count()) > 0) {
          await backToThisMonth.first().click()
          await bmPage.waitForTimeout(900)
        }
        await bmPage.getByRole('button', { name: ja.mealPlan.nextMonth }).click()
        await bmPage.waitForTimeout(1200)
      }
      await bmOpenNextMonth()
      check(
        'WEEKLOCK-MONTH 前提: 月タブに次の月のカレンダーが出ている',
        (await bmPage.locator(`[data-date="${bmLocked}"]`).count()) > 0 &&
          (await bmPage.locator(`[data-date="${bmFree}"]`).count()) > 0,
        `locked=${bmLocked} free=${bmFree}`,
      )
      const bmFillMonth = bmPage.getByRole('button', { name: ja.mealPlan.fillMonth })
      bmDialogs.length = 0
      await bmFillMonth.click()
      await bmPage.waitForTimeout(9000) // 1か月ぶん書き込むので長めに待つ
      check(
        'WEEKLOCK-MONTH 鍵の無い日には献立が入った(素通り防止)',
        (await bmPlanOf(bmFree)).length > 0,
        `date=${bmFree} / plan=${JSON.stringify(await bmPlanOf(bmFree))}`,
      )
      check(
        'WEEKLOCK-MONTH 鍵の日には献立が入らない',
        (await bmPlanOf(bmLocked)).length === 0,
        `date=${bmLocked} / plan=${JSON.stringify(await bmPlanOf(bmLocked))}`,
      )
      check(
        'WEEKLOCK-MONTH 確認文に「ロック中の◯食分は変わりません」がある(規約F)',
        bmDialogs.some((m) => jaRe(ja.mealPlan.lockedSlotNotice, { n: '\\d+' }).test(m)),
        `dialogs=${JSON.stringify(bmDialogs)}`,
      )
      // 対の確認: 鍵を外すと同じ操作で入る
      await bmPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(bmPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await bmPage.waitForTimeout(900)
      for (let i = 0; i < 8; i++) {
        if ((await bmPage.locator(`[data-testid="day-lock"][data-date="${bmLocked}"]`).count()) > 0) break
        await bmPage.getByRole('button', { name: ja.mealPlan.nextWeek }).click()
        await openAllWeekDays(bmPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
        await bmPage.waitForTimeout(800)
      }
      await bmPage.locator(`[data-testid="day-lock"][data-date="${bmLocked}"]`).click()
      await bmPage.waitForTimeout(700)
      check(
        'WEEKLOCK-MONTH 前提: 鍵を外せた(対の確認の前提)',
        (await bmPage
          .locator(`[data-testid="day-lock"][data-date="${bmLocked}"]`)
          .getAttribute('aria-pressed')) === 'false',
      )
      await bmOpenNextMonth()
      check(
        'WEEKLOCK-MONTH 前提: 対の確認も同じ月(次の月)を対象にしている',
        (await bmPage.locator(`[data-date="${bmLocked}"]`).count()) > 0,
        `date=${bmLocked}`,
      )
      await bmFillMonth.click()
      await bmPage.waitForTimeout(6000)
      check(
        'WEEKLOCK-MONTH 鍵を外すと同じ操作で入る(対の確認)',
        (await bmPlanOf(bmLocked)).length > 0,
        `date=${bmLocked} / plan=${JSON.stringify(await bmPlanOf(bmLocked))}`,
      )
    } finally {
      await bmBrowser.close()
    }
  }

  // --- BACKNAV-01: 今日の献立からレシピを開いて戻ると今週の献立に飛ばされるバグの回帰
  // (2026-07-15オーナー実機フィードバック)。戻り遷移には ?focus=today が付き、これがあると
  // 「日」タブへ固定される(2026-07-16 便U-1でタブ構成に再設計。以前はスクロール制御だったが、
  // 今は「日」「週」「月」タブの選択制御になった。既定タブは元々「日」だが、?focus=todayは
  // 将来デフォルトが変わっても壊れないよう明示的に強制する・パラメータを必ず消費する、の
  // 2点を保証する回帰テストとして残す)。修正が無いと(b)の断定が失敗する ---
  currentCheck = 'BACKNAV-01'
  {
    const bnBrowser = await chromium.launch()
    const bnContext = await bnBrowser.newContext()
    const bnPage = await bnContext.newPage()
    bnPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@BACKNAV-01] ${err.message}`)
    })
    try {
      await bnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(1800) // 初回シード完了待ち

      // (a) 前提: 素の /#/meal-plan は既定で「日」タブが選択されている
      await bnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(600)
      const dayTabBtn = bnPage.getByRole('button', { name: '日', exact: true })
      check('BACKNAV-01 前提: 素の献立タブは既定で「日」タブが選択されている', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')

      // 「週」タブへ切り替えてから離脱する(実アプリの戻り操作は別ルートを経由してMealPlanPageが
      // 再マウントされるため、タブ状態はリセットされる。それでも?focus=todayが「日」を
      // 強制することを確認するため、あえて別タブに切り替えた状態を経由する)
      await bnPage.getByRole('button', { name: ja.mealPlan.viewWeek, exact: true }).click()
      await openAllWeekDays(bnPage) // 便ID・⑦: 畳む既定になったので、カードの中を触る前に開く
      await bnPage.waitForTimeout(300)

      // (b) ?focus=today では「日」タブへ固定され、パラメータが消費される。
      // 実アプリの戻り操作はレシピ詳細(別ルート)を経由するため、MealPlanPageは必ず再マウント
      // されてinitialFocusRefが初期化される。テストでも一度別ページへ抜けてから戻ることで
      // その再マウントを再現する(ハッシュのクエリだけ変える遷移では再マウントされないため)
      await bnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(300)
      await bnPage.goto(`${BASE}/#/meal-plan?focus=today`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(600)
      check('BACKNAV-01 ?focus=today では「日」タブへ固定される', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')
      check('BACKNAV-01 focus=today パラメータは消費されURLから消える', !bnPage.url().includes('focus=today'))
      check(
        // 2026-08-17 便HI: 空の日は「今日の献立」の見出しを出さないので、
        // 「日」に着いたことは、どの日にも必ず出る「今日なに作る？」で測る
        'BACKNAV-01 戻った先が「日」の画面になっている',
        ((await bnPage.textContent('body')) ?? '').replaceAll('\u200b', '').includes('今日なに作る？'),
      )
    } finally {
      await bnBrowser.close()
    }
  }

  // --- SCROLL-02: 一覧の絞り込み・並べ替え条件が「詳細→戻る」を経ても保持される
  // (2026-07-12深夜フィードバックの再調査で判明した本当の原因の再発防止テスト。PC Chrome相当・
  // デスクトップビューポート)。詳細の「戻る」は常に素の /recipes へ新規遷移するため、
  // 検索語や並べ替えなど何か1つでも既定値から変えていると、以前は復元判定のfiltersKeyが
  // 不一致になり、スクロール位置だけでなく絞り込み条件そのものが黙って消えていた
  // (オーナーは「長く滞在すると起きる」と感じていたが、実際は滞在時間に関係なく、絞り込み中に
  // 詳細を開いて戻るだけで即再現した。絞り込んで探すほど長時間読む対象に行き着きやすい、
  // という行動側の相関を「時間経過が原因」と体感していたと考えられる) ---
  currentCheck = 'SCROLL-02'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // 2026-07-16 便T-1で並び替えボタンが絞り込みボタンから分離したのでそちらを開く
  await page.getByRole('button', { name: '並び替え' }).click()
  await page.waitForTimeout(200)
  // 並べ替えを既定の「更新順」から変える(URLに載らない条件なので、これが復元できれば
  // filtersKey全体が保存・復元されていることの証明になる。文言は便T-5で「あいうえお順」→「五十音順」)
  await page.getByRole('button', { name: ja.search.sortKana }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを閉じる
  await page.waitForTimeout(200)
  await page.evaluate(() => window.scrollTo(0, 300))
  await page.waitForTimeout(400)
  const s2ScrollBefore = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => {
    const link = document.querySelector('a[href^="#/recipes/"]')
    if (link instanceof HTMLElement) link.click()
  })
  await page.waitForTimeout(600)
  check('SCROLL-02 詳細へ遷移', /#\/recipes\/\d+/.test(page.url()), `現在URL: ${page.url()}`)
  await page.getByRole('button', { name: ja.common.back }).click()
  await page.waitForTimeout(800)
  const s2ScrollAfter = await page.evaluate(() => window.scrollY)
  check(
    'SCROLL-02 詳細→戻るでスクロール位置が復元される(並べ替え変更中・PC Chrome相当)',
    Math.abs(s2ScrollAfter - s2ScrollBefore) < 60,
    `復元前=${s2ScrollBefore} 復元後=${s2ScrollAfter}`,
  )
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを再度開いて並べ替え状態を確認
  await page.waitForTimeout(200)
  // 2026-07-16 B分類の☑リスト化に追随: 選択状態はクラス(border-accent)でなく
  // aria-pressedで判定する(見た目の実装が変わっても壊れない)
  const sortStillActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '五十音順')
    return target ? target.getAttribute('aria-pressed') === 'true' : false
  })
  check('SCROLL-02 詳細→戻るで並べ替え条件(五十音順)も保持される', sortStillActive)
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを閉じる(後続チェックへの影響防止)
  await page.waitForTimeout(200)

  // --- TIMER-ADJ-01: 実行中タイマーの±調整(窓方式。2026-07-12タイマー自由設定・Fable設計docs/20 §6)。
  // 肉じゃが手順3「中火で15分煮る」の「15分」をタップしてタイマーを起動し、
  // 常駐バー(TimerBar)の表示をタップして窓を開き、「+1分」「−30秒」で残り秒が変わることを確認する ---
  currentCheck = 'TIMER-ADJ-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '15分 タイマー開始' }).click()
  await page.waitForTimeout(500)
  // タイマー起動の初回だけ出る説明バナーが、次の正規表現セレクタと混同しないことも併せて確認
  const adjustOpenBtn = page.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) })
  check('TIMER-ADJ-01 常駐バーにタイマー行が現れる(タップで調整窓が開く導線)', await adjustOpenBtn.isVisible())

  // 常駐バー行の「+1分」ミニボタン(2026-07-13 UIペルソナQA): 調整窓を開かずに即+60秒できる近道。
  // 行タップ(調整窓を開く)とは別の操作なので、窓を開く前にここで確認する
  const miniPlusOneBtn = page.getByRole('button', { name: '肉じゃがに1分追加' })
  check('TIMER-ADJ-01 常駐バー行に「+1分」ミニボタンが出る', await miniPlusOneBtn.isVisible())
  const miniBeforeSec = parseRemainingSeconds(await adjustOpenBtn.textContent())
  await miniPlusOneBtn.click()
  await page.waitForTimeout(300)
  const miniAfterSec = parseRemainingSeconds(await adjustOpenBtn.textContent())
  check(
    'TIMER-ADJ-01 「+1分」ミニボタンで残り秒が約60秒増える(調整窓を開かずに)',
    miniBeforeSec !== null && miniAfterSec !== null && miniAfterSec - miniBeforeSec >= 50,
    `押す前=${miniBeforeSec}s 押した後=${miniAfterSec}s`,
  )
  check(
    'TIMER-ADJ-01 「+1分」ミニボタンを押しても調整窓は開かない(行タップと独立)',
    !(await page.getByRole('dialog', { name: ja.timer.adjustDialogTitle }).isVisible().catch(() => false)),
  )

  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  const adjustDialog = page.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
  check('TIMER-ADJ-01 タイマー調整の窓が開く(「作った！」と同じ様式)', await adjustDialog.isVisible())
  const adjBeforeSec = parseRemainingSeconds(await adjustDialog.textContent())
  await adjustDialog.getByRole('button', { name: ja.timer.plusOneMinute }).click()
  await page.waitForTimeout(200)
  const adjAfterPlusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「+1分」で残り秒が約60秒増える',
    adjBeforeSec !== null && adjAfterPlusSec !== null && adjAfterPlusSec - adjBeforeSec >= 50,
    `押す前=${adjBeforeSec}s 押した後=${adjAfterPlusSec}s`,
  )
  await adjustDialog.getByRole('button', { name: ja.timer.minusThirtySeconds }).click()
  await page.waitForTimeout(200)
  const adjAfterMinusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「−30秒」で残り秒が約30秒減る',
    adjAfterMinusSec !== null && adjAfterPlusSec - adjAfterMinusSec >= 20,
    `「+1分」後=${adjAfterPlusSec}s 「−30秒」後=${adjAfterMinusSec}s`,
  )
  // 窓の外(背景)をタップして閉じる。常駐バーの表示はそのまま残る(タイマー自体は動作中のまま)
  await page.mouse.click(5, 5)
  await page.waitForTimeout(300)
  check('TIMER-ADJ-01 背景タップで窓が閉じる', !(await adjustDialog.isVisible().catch(() => false)))
  // 「タイマーを消す」でタイマーごと消えることも確認する(後続のTIMER-CUSTOM-01に影響を
  // 残さないための後片付けも兼ねる。文言は2026-08-10 便FCで「停止」から言い換えた)
  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  await adjustDialog.getByRole('button', { name: ja.timer.stopTimer }).click()
  await page.waitForTimeout(300)
  check(
    'TIMER-ADJ-01 「タイマーを消す」でタイマーが常駐バーから消える',
    !(await adjustOpenBtn.isVisible().catch(() => false)),
  )

  // --- TIMER-CUSTOM-01: 自由な時間で始めるタイマー(ja.timer.customLabel「タイマー」)。
  // レシピ詳細のBackHeaderにあるタイマーアイコン(入口A)から開き、既定3分→1分まで減らして起動する。
  // 続けて同じ調整窓で「−30秒」を重ねても残りが0未満にならない(即完了扱いにしない)ことも確認する ---
  currentCheck = 'TIMER-CUSTOM-01'
  await page.getByRole('button', { name: ja.timer.customOpenAria }).click()
  await page.waitForTimeout(300)
  const customDialog = page.getByRole('dialog', { name: 'タイマー', exact: true })
  // 残り時間の表示だけを拾うロケータ(ボタン文言「−30秒」等と紛れないよう、表示専用のspanをクラスで狙う)
  const customCounter = customDialog.locator('.tabular-nums')
  check(
    'TIMER-CUSTOM-01 タイマーの窓が開く(初回既定3分)',
    (await customDialog.textContent()).includes('3分'),
  )
  await customDialog.getByRole('button', { name: ja.timer.customMinutesDown }).click()
  await customDialog.getByRole('button', { name: ja.timer.customMinutesDown }).click()
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 分数ステッパー(±1分)で1分まで減らせる',
    (await customDialog.textContent()).includes('1分'),
  )
  // --- 秒刻み(2026-07-12オーナー実機フィードバック追加分)。±30秒・±10秒で分+秒表示になり、
  // 一往復(+30+10-30-10=±0)で1分ちょうどに戻ることを確認する(以降の起動値を60秒に保つため) ---
  await customDialog.getByRole('button', { name: ja.timer.plusThirtySeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+30秒」で1分→1分30秒', (await customCounter.textContent()) === '1分30秒')
  await customDialog.getByRole('button', { name: ja.timer.plusTenSeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+10秒」で1分30秒→1分40秒', (await customCounter.textContent()) === '1分40秒')
  await customDialog.getByRole('button', { name: ja.timer.minusThirtySeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−30秒」で1分40秒→1分10秒', (await customCounter.textContent()) === '1分10秒')
  await customDialog.getByRole('button', { name: ja.timer.minusTenSeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−10秒」で1分10秒→1分ちょうどに戻る', (await customCounter.textContent()) === '1分')
  // 開始前の秒数も10秒未満にならない(floor挙動)。−1分→10秒未満は10秒で止まる。その後+30+10+10=+50秒で1分に戻す
  await customDialog.getByRole('button', { name: ja.timer.customMinutesDown }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 開始前の秒数も10秒未満にならない(1分→10秒で床止め)', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: ja.timer.minusTenSeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 10秒からさらに「−10秒」しても10秒のまま', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: ja.timer.plusThirtySeconds }).click()
  await customDialog.getByRole('button', { name: ja.timer.plusTenSeconds }).click()
  await customDialog.getByRole('button', { name: ja.timer.plusTenSeconds }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 1分まで戻して開始する', (await customCounter.textContent()) === '1分')
  await customDialog.getByRole('button', { name: ja.timer.customStart }).click()
  await page.waitForTimeout(400)
  // 「タイマー」への改名(2026-08-02)後は body 全文の includes だと「タイマー開始」等に当たって
  // 常に真になるため、常駐バーの行(=調整を開くボタン)のテキストに限定して確かめる
  const customBarRow = page.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) })
  const customBarText = await customBarRow.textContent()
  check(
    'TIMER-CUSTOM-01 タイマーが起動する(常駐バーに「タイマー」表示)',
    customBarText.includes('タイマー'),
    customBarText,
  )
  await page.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).click()
  await page.waitForTimeout(300)
  const customAdjustDialog = page.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
  await customAdjustDialog.getByRole('button', { name: ja.timer.minusThirtySeconds }).click()
  await page.waitForTimeout(150)
  await customAdjustDialog.getByRole('button', { name: ja.timer.minusThirtySeconds }).click() // 1分-30秒-30秒=0
  await page.waitForTimeout(150)
  const atFloorText = await customAdjustDialog.textContent()
  // 残りがマイナスにならないこと。0ちょうどになると通常の完了フローに乗るので、
  // 表示は「00:00」か終了文言のどちらか(どちらでも「マイナスに突き抜けていない」ことの確認になる)
  check(
    'TIMER-CUSTOM-01 「−30秒」を重ねても残りは0で止まる(マイナスにならない)',
    atFloorText.includes('00:00') || atFloorText.includes('終わり'),
    atFloorText,
  )
  // 2026-07-28 機能④診断C10: 0まで減って終わったあとの±は「押しても何も起きない死にボタン」に
  // していた。押せないと見て分かる状態にし、理由の一言を出す(「タイマーを消す」は引き続き押せる)
  // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
  const floorButtons = await customAdjustDialog.evaluate((dlg, finishedHint) => {
    const btns = Array.from(dlg.querySelectorAll('button'))
    const find = (t) => btns.find((b) => b.textContent.trim() === t)
    return {
      minus: find('−30秒')?.disabled,
      plus: find('+1分')?.disabled,
      stop: find('タイマーを消す')?.disabled,
      hasReason: dlg.textContent.includes(finishedHint),
    }
  }, ja.timer.adjustFinishedHint)
  check(
    'TIMER-CUSTOM-01 0まで減らして終わったら「−30秒」「+1分」は押せない状態になる(死にボタンにしない)',
    floorButtons.minus === true && floorButtons.plus === true,
    JSON.stringify(floorButtons),
  )
  check(
    'TIMER-CUSTOM-01 終わったあとも「タイマーを消す」は押せて、変えられない理由が出る',
    floorButtons.stop === false && floorButtons.hasReason,
    JSON.stringify(floorButtons),
  )
  await customAdjustDialog.getByRole('button', { name: ja.timer.stopTimer }).click()
  await page.waitForTimeout(300)

  // --- TIMER-KEEP-01 / TIMER-ORDER-01 / FOCUS-TIMER-01 / TIMER-ADJ-02:
  // 2026-07-28 機能④診断(第2群 タイマーの信頼性)の再発防止。まっさらな別プロファイルで:
  //  (1) C7 リロードでタイマーが全消滅しない(端末内に保存し、絶対時刻から残り時間を復元する)
  //  (2) C7 初回の注意書きが調理中モードの中にも出る(以前は常駐バーにしか無く、全画面に
  //      覆われたままフラグだけ立って二度と出せなくなっていた)
  //  (3) C6 複数タイマーの並びが起動順ではなく「残りが少ない順」になる
  //  (4) C5 調理中モードの終了バッジにベル+点滅が付く(常駐バーと同じ合図にそろえる)
  //  (5) C12 同じ時間表記の2度タップで、調理中モードの中でも既存タイマーが点滅する
  //  (6) C10 ±調整の窓を開いたままタイマーが終わったら、±が押せないと見て分かる
  currentCheck = 'TIMER-KEEP-01'
  {
    const tkBrowser = await chromium.launch()
    try {
      const tkContext = await tkBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const tkPage = await tkContext.newPage()
      const openNikujaga = async () => {
        await tkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await tkPage.waitForTimeout(1200)
        await tkPage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
        await tkPage.waitForTimeout(500)
        await tkPage.getByText('肉じゃが', { exact: true }).first().click()
        await tkPage.waitForTimeout(700)
      }
      await openNikujaga()
      await tkPage.getByRole('button', { name: '15分 タイマー開始' }).click()
      await tkPage.waitForTimeout(500)
      const barRow = tkPage.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) })
      const beforeReload = parseRemainingSeconds(await barRow.first().textContent())
      // (2) 初回の注意書きが、実態に合わせた文言になっている
      check(
        'TIMER-KEEP-01 初回の注意書きが「残り時間は続く／音と通知は開いている間だけ」になっている',
        (await tkPage.textContent('body')).includes(ja.timer.notice),
      )
      // (1) リロードしても残る
      await tkPage.reload({ waitUntil: 'networkidle' })
      await tkPage.waitForTimeout(1500)
      const afterReload = parseRemainingSeconds(await barRow.first().textContent().catch(() => ''))
      check(
        'TIMER-KEEP-01 リロードしてもタイマーが消えない',
        (await barRow.count()) === 1,
        `リロード後の行数=${await barRow.count()}`,
      )
      check(
        'TIMER-KEEP-01 リロード後も残り時間が続きから復元される(経過分だけ減っている)',
        beforeReload !== null && afterReload !== null && afterReload < beforeReload && beforeReload - afterReload < 60,
        `リロード前=${beforeReload}s リロード後=${afterReload}s`,
      )

      // (3) C6 並び順。15分の後に「タイマー1分」を足すと、後から起動した1分が上に来る
      currentCheck = 'TIMER-ORDER-01'
      await tkPage.getByRole('button', { name: ja.timer.customOpenAria }).first().click()
      await tkPage.waitForTimeout(300)
      {
        const dlg = tkPage.getByRole('dialog', { name: 'タイマー', exact: true })
        await dlg.getByRole('button', { name: ja.timer.customMinutesDown }).click()
        await dlg.getByRole('button', { name: ja.timer.customMinutesDown }).click()
        await tkPage.waitForTimeout(150)
        await dlg.getByRole('button', { name: ja.timer.customStart }).click()
      }
      await tkPage.waitForTimeout(500)
      const orderLabels = await tkPage.evaluate(
        // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
        (adjust) =>
          Array.from(
            document.querySelectorAll(`.fixed.inset-x-0.z-10 button[aria-label*="${adjust}"]`),
          ).map((b) => b.getAttribute('aria-label')),
        ja.timer.adjustDialogTitle,
      )
      check(
        'TIMER-ORDER-01 後から起動しても残りが少ないタイマーが上に来る(起動順ではない)',
        // 上に来るのが「自分で決めたタイマー」であることを、読み上げ名の言い回しに
        // 依存せずに見る（2026-08-16に「タイマーのタイマーを調整」→「タイマーを調整」へ）。
        // 手順のタイマーは料理名や手順が名前に入るので、そこで見分ける
        orderLabels.length === 2 &&
          !orderLabels[0].includes('手順') &&
          orderLabels[1].includes('手順'),
        JSON.stringify(orderLabels),
      )

      // (4)(5) 調理中モード内のタイマー表示
      currentCheck = 'FOCUS-TIMER-01'
      await tkPage.getByText(ja.focus.open).click()
      await tkPage.waitForTimeout(500)
      const focus = tkPage.locator('.fixed.inset-0.z-50')
      for (let i = 0; i < 2; i++) {
        await focus.getByRole('button', { name: ja.focus.next }).click()
        await tkPage.waitForTimeout(250)
      }
      // 同じ「15分」を押す = 既に動いているタイマーの重複起動 → 点滅で知らせる
      await focus.getByRole('button', { name: '15分 タイマー開始' }).click()
      await tkPage.waitForTimeout(300)
      const flashInFocus = await tkPage.evaluate(
        () => document.querySelector('.fixed.inset-0.z-50').querySelectorAll('.animate-pulse.ring-2').length,
      )
      check(
        'FOCUS-TIMER-01 重複タップの点滅が調理中モードの中でも見える(押しても無反応に見えない)',
        flashInFocus >= 1,
        `点滅要素=${flashInFocus}`,
      )
      // 自由な時間のタイマー10秒 → 終了バッジのベル+点滅
      await focus.getByRole('button', { name: ja.timer.customOpenAria }).click()
      await tkPage.waitForTimeout(300)
      {
        const dlg = tkPage.getByRole('dialog', { name: 'タイマー', exact: true })
        for (let i = 0; i < 3; i++)
          await dlg.getByRole('button', { name: ja.timer.customMinutesDown }).click()
        await tkPage.waitForTimeout(150)
        await dlg.getByRole('button', { name: ja.timer.customStart }).click()
      }
      await tkPage.waitForTimeout(11500)
      const donePill = await tkPage.evaluate(() => {
        const overlay = document.querySelector('.fixed.inset-0.z-50')
        const pill = Array.from(overlay.querySelectorAll('div.inline-flex')).find((p) =>
          p.className.includes('border-warning'),
        )
        if (!pill) return null
        const fill = getComputedStyle(pill).backgroundColor
        return {
          // 2026-08-03 便DS/実機FB⑧: チップ全体の点滅は文字ごと薄くして読めなくするのでやめた。
          // 点滅はベルだけに残し、代わりにチップを塗って一目で見分けられるようにした
          pillPulses: pill.className.includes('animate-pulse'),
          bell: !!pill.querySelector('svg.animate-pulse'),
          fill,
          filled: fill !== 'rgba(0, 0, 0, 0)' && fill !== 'transparent',
        }
      })
      check(
        'FOCUS-TIMER-01 調理中モードの終了バッジにベルの点滅が付く(常駐バーと同じ合図)',
        donePill != null && donePill.bell,
        JSON.stringify(donePill),
      )
      check(
        'FOCUS-TIMER-01 終了チップ全体は点滅させない(文字が薄くなって読めなくなるため。便DS⑧)',
        donePill != null && donePill.pillPulses === false,
        JSON.stringify(donePill),
      )
      check(
        'FOCUS-TIMER-01 終了チップは面が塗られていて一目で見分けられる(便DS⑧)',
        donePill != null && donePill.filled,
        JSON.stringify(donePill),
      )

      // (6) C10 ±調整の窓を開いたままタイマーが終わる
      currentCheck = 'TIMER-ADJ-02'
      await focus.getByRole('button', { name: ja.timer.customOpenAria }).click()
      await tkPage.waitForTimeout(300)
      {
        const dlg = tkPage.getByRole('dialog', { name: 'タイマー', exact: true })
        for (let i = 0; i < 3; i++)
          await dlg.getByRole('button', { name: ja.timer.customMinutesDown }).click()
        await tkPage.waitForTimeout(150)
        await dlg.getByRole('button', { name: ja.timer.customStart }).click()
      }
      await tkPage.waitForTimeout(500)
      await focus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).first().click()
      await tkPage.waitForTimeout(300)
      const zeroDialog = tkPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
      check('TIMER-ADJ-02 調整の窓が開く', await zeroDialog.isVisible())
      await tkPage.waitForTimeout(11000)
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
      const zeroState = await tkPage.evaluate((adjust) => {
        const dlg = document.querySelector(`[role="dialog"][aria-label="${adjust}"]`)
        if (!dlg) return null
        const btns = Array.from(dlg.querySelectorAll('button'))
        const find = (t) => btns.find((b) => b.textContent.trim() === t)
        return {
          plus: find('+1分')?.disabled,
          minus: find('−30秒')?.disabled,
          stop: find('タイマーを消す')?.disabled,
          text: dlg.textContent,
        }
      }, ja.timer.adjustDialogTitle)
      check(
        'TIMER-ADJ-02 窓を開いたまま終わったら「+1分」「−30秒」は押せない状態になる(死にボタンにしない)',
        zeroState != null && zeroState.plus === true && zeroState.minus === true,
        JSON.stringify(zeroState && { plus: zeroState.plus, minus: zeroState.minus }),
      )
      check(
        'TIMER-ADJ-02 窓の中でも終わったことが分かり、理由の一言が出る',
        zeroState != null && zeroState.text.includes(ja.timer.adjustFinishedHint),
      )
      check(
        'TIMER-ADJ-02 「タイマーを消す」は引き続き押せる(この窓から片付けられる)',
        zeroState != null && zeroState.stop === false,
      )
    } finally {
      await tkBrowser.close()
    }
  }

  // --- FOCUS-KEEP-01 / FOCUS-BACK-01 / FOCUS-OTHER-01:
  // 2026-07-28 機能④診断(第3群 複数品同時進行)の再発防止。
  //  (1) C3 調理中モードを閉じて開き直したら、閉じた手順から再開する(毎回手順1に戻らない)。
  //      「完成！」のあとと、別レシピへ移った後は手順1に戻す。
  //  (2) C11 端末の「戻る」で調理中モードだけが閉じる(レシピ一覧まで離脱しない)。
  //  (3) C4/C8 他の料理のタイマーも調理中モードの中に料理名つきで出て、タップで停止・±調整できる。
  currentCheck = 'FOCUS-KEEP-01'
  {
    const fkBrowser = await chromium.launch()
    try {
      const fkContext = await fkBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fkPage = await fkContext.newPage()
      const fkFocus = fkPage.locator('.fixed.inset-0.z-50')
      const fkStep = () => fkFocus.locator('text=/手順 \\d+\\/\\d+/').first().textContent()
      const fkOpen = async (name) => {
        await fkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await fkPage.waitForTimeout(1200)
        await fkPage.getByPlaceholder(ja.search.placeholder).fill(name)
        await fkPage.waitForTimeout(500)
        await fkPage.getByText(name, { exact: true }).first().click()
        await fkPage.waitForTimeout(700)
      }
      await fkOpen('肉じゃが')
      await fkPage.getByText(ja.focus.open).click()
      await fkPage.waitForTimeout(500)
      for (let i = 0; i < 2; i++) {
        await fkFocus.getByRole('button', { name: ja.focus.next }).click()
        await fkPage.waitForTimeout(250)
      }
      const beforeClose = await fkStep()
      await fkFocus.getByRole('button', { name: ja.common.close }).first().click()
      await fkPage.waitForTimeout(500)
      await fkPage.getByText(ja.focus.open).click()
      await fkPage.waitForTimeout(500)
      const afterReopen = await fkStep()
      check(
        'FOCUS-KEEP-01 閉じて開き直しても閉じた手順から再開する(毎回手順1に戻らない)',
        beforeClose === '手順 3/4' && afterReopen === beforeClose,
        `閉じる前=${beforeClose} 開き直し=${afterReopen}`,
      )

      // (2) C11 端末の戻る: 1回目は調理中モードだけが閉じ、URLは詳細のまま
      currentCheck = 'FOCUS-BACK-01'
      await fkPage.goBack()
      await fkPage.waitForTimeout(700)
      const backState = {
        hash: fkPage.url().split('#')[1] ?? '',
        overlays: await fkPage.locator('.fixed.inset-0.z-50').count(),
      }
      check(
        'FOCUS-BACK-01 端末の「戻る」で調理中モードだけが閉じる(レシピ一覧まで離脱しない)',
        backState.overlays === 0 && backState.hash.startsWith('/recipes/'),
        JSON.stringify(backState),
      )
      await fkPage.goBack()
      await fkPage.waitForTimeout(700)
      check(
        'FOCUS-BACK-01 もう一度「戻る」で従来どおりレシピ一覧へ戻る',
        (fkPage.url().split('#')[1] ?? '').startsWith('/recipes') &&
          !(fkPage.url().split('#')[1] ?? '').match(/^\/recipes\/\d/),
        fkPage.url(),
      )

      // (1続き) 「完成！」のあとは手順1に戻る
      currentCheck = 'FOCUS-KEEP-01'
      await fkOpen('肉じゃが')
      await fkPage.getByText(ja.focus.open).click()
      await fkPage.waitForTimeout(500)
      check(
        'FOCUS-KEEP-01 別のレシピを経由して開き直した場合は手順1から',
        (await fkStep()) === '手順 1/4',
        await fkStep(),
      )
      for (let i = 0; i < 5; i++) {
        const next = fkFocus.getByRole('button', { name: ja.focus.next })
        if (!(await next.isVisible().catch(() => false))) break
        await next.click()
        await fkPage.waitForTimeout(200)
      }
      await fkFocus.getByRole('button', { name: ja.focus.complete }).click()
      await fkPage.waitForTimeout(700)
      await fkPage
        .getByRole('dialog', { name: ja.detail.cookedDialogTitle })
        .getByRole('button', { name: ja.common.close })
        .first()
        .click()
      await fkPage.waitForTimeout(400)
      await fkPage.getByText(ja.focus.open).click()
      await fkPage.waitForTimeout(500)
      check(
        'FOCUS-KEEP-01 「完成！」のあとに開き直すと手順1から始まる',
        (await fkStep()) === '手順 1/4',
        await fkStep(),
      )
      await fkFocus.getByRole('button', { name: ja.common.close }).first().click()
      await fkPage.waitForTimeout(400)

      // (3) C4/C8 他レシピのタイマー
      currentCheck = 'FOCUS-OTHER-01'
      await fkOpen('肉じゃが')
      await fkPage.getByRole('button', { name: '15分 タイマー開始' }).click()
      await fkPage.waitForTimeout(500)
      await fkOpen('カレーライス')
      await fkPage.getByText(ja.focus.open).click()
      await fkPage.waitForTimeout(700)
      const otherPills = await fkPage.evaluate(() =>
        Array.from(
          document.querySelector('.fixed.inset-0.z-50').querySelectorAll('div.inline-flex.rounded-full'),
        ).map((p) => p.textContent.replace(/\s+/g, ' ').trim()),
      )
      check(
        'FOCUS-OTHER-01 別の料理のタイマーも調理中モードの中に出る(覆い隠されない)',
        otherPills.length >= 1,
        JSON.stringify(otherPills),
      )
      check(
        'FOCUS-OTHER-01 別の料理の分は料理名が併記され、どれの残り時間か分かる',
        otherPills.some((t) => t.includes('肉じゃが')),
        JSON.stringify(otherPills),
      )
      await fkFocus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).first().click()
      await fkPage.waitForTimeout(400)
      const otherDialog = fkPage.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
      check(
        'FOCUS-OTHER-01 別の料理のタイマーをタップすると調整の窓が開く(手順の誤ジャンプをしない)',
        (await otherDialog.isVisible()) && (await otherDialog.textContent()).includes('肉じゃが'),
        await otherDialog.textContent().catch(() => 'なし'),
      )
      await otherDialog.getByRole('button', { name: ja.timer.stopTimer }).click()
      await fkPage.waitForTimeout(400)
      check(
        'FOCUS-OTHER-01 調理中モードから出ずに別の料理のタイマーを停止できる',
        (await fkFocus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).count()) === 0,
      )
    } finally {
      await fkBrowser.close()
    }
  }

  // --- FOCUS-NOTICE-01: 初回のタイマー注意書きを、調理中モードから初めて起動した場合でも
  // 見える場所に出す(2026-07-28 機能④診断C7)。まっさらなプロファイルで、常駐バーを覆う
  // 全画面の中に同じ案内が現れることを確認する ---
  currentCheck = 'FOCUS-NOTICE-01'
  {
    const fnBrowser = await chromium.launch()
    try {
      const fnContext = await fnBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const fnPage = await fnContext.newPage()
      await fnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fnPage.waitForTimeout(1200)
      await fnPage.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
      await fnPage.waitForTimeout(500)
      await fnPage.getByText('肉じゃが', { exact: true }).first().click()
      await fnPage.waitForTimeout(700)
      await fnPage.getByText(ja.focus.open).click()
      await fnPage.waitForTimeout(500)
      const fnFocus = fnPage.locator('.fixed.inset-0.z-50')
      for (let i = 0; i < 2; i++) {
        await fnFocus.getByRole('button', { name: ja.focus.next }).click()
        await fnPage.waitForTimeout(250)
      }
      await fnFocus.getByRole('button', { name: '15分 タイマー開始' }).click()
      await fnPage.waitForTimeout(500)
      // 文言は ja.ts から読むが、evaluate の中はブラウザ側なので引数で渡す（JM-4）
      const noticeSeen = await fnPage.evaluate((timerNotice) => {
        const overlay = document.querySelector('.fixed.inset-0.z-50')
        const span = Array.from(overlay.querySelectorAll('span')).find((s) =>
          s.textContent.includes(timerNotice),
        )
        if (!span) return { found: false }
        const r = span.getBoundingClientRect()
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        return { found: true, covered: !(span === top || span.contains(top) || top?.contains(span)) }
      }, ja.timer.notice)
      check(
        'FOCUS-NOTICE-01 調理中モードから初めてタイマーを起動しても注意書きが出る',
        noticeSeen.found,
        JSON.stringify(noticeSeen),
      )
      check(
        'FOCUS-NOTICE-01 その注意書きは全画面に覆われず読める',
        noticeSeen.found && !noticeSeen.covered,
        JSON.stringify(noticeSeen),
      )
    } finally {
      await fnBrowser.close()
    }
  }

  // --- FOCUSTOP-01: 調理中モードの上側が、長い料理名を隠さない(2026-08-15 便GX・オーナー実機
  //   「調理中モードでじぶんタイマー(起動していない時のアイコン)は横一列潰さずに、アイコンだけ
  //    表示にできませんか？ただでさえ狭い画面の上側一列に文字を表示できなくて、文字数が多いと
  //    隠れてしまいます」)。
  //
  //   測るのは「どこにあるか」ではなく次の3つ。置き場所が変わっても同じ判定になる形にする:
  //     ①長い料理名が1文字も隠れていない(切り詰め・はみ出しで欠けない)
  //     ②自由な時間のタイマーのボタンが、1列を単独で占有していない
  //       (上側の他の操作ボタンと同じ高さの帯に収まっている)
  //     ③そのボタンに押せる大きさ(44px角)と読み上げ名がある(画面に文字を出さない代わり)
  //   ①〜③は動作中のタイマーがあってもなくても同じように成り立つ(タイマーを1本動かして再測)。
  //   料理名は同梱レシピの名前の長さに左右されないよう、この検証の中で長い名前を登録して作る ---
  currentCheck = 'FOCUSTOP-01'
  {
    const ftBrowser = await chromium.launch()
    try {
      const ftContext = await ftBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const ftPage = await ftContext.newPage()
      ftPage.on('dialog', (dialog) => dialog.accept())
      const ftTitle = '鶏むね肉としめじの香味だれかけ蒸し（作り置きにも）'
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1000)
      await ftPage.getByText(ja.paste.open).click()
      await ftPage.waitForTimeout(300)
      await ftPage
        .locator(`textarea[placeholder="${ja.paste.placeholder}"]`)
        .fill(
          `${ftTitle}\n\n材料（2人分）\n・鶏むね肉　1枚\n・しめじ　1袋\n\n作り方\n1. 鶏むね肉をそぎ切りにする\n2. しめじをほぐして耐熱皿に広げる\n3. 蒸し上げる`,
        )
      await ftPage.getByRole('button', { name: ja.paste.apply }).click()
      await ftPage.waitForTimeout(400)
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(1200)
      await ftPage.getByText(ja.focus.open).click()
      await ftPage.waitForTimeout(700)

      /**
       * 上側の実測。料理名は「その文字列だけを持つ最も内側の要素」を探して掴む
       * (見出しの階層や置き場所が変わっても同じものを掴める)。
       * ZWSPは文節折返しで差し込まれることがあるので、照合前に外す。
       */
      const ftMeasure = async () =>
        await ftPage.evaluate((title) => {
          const overlay = document.querySelector('.fixed.inset-0.z-50')
          if (!overlay) return { overlay: false }
          const strip = (s) => (s || '').replace(/​/g, '').trim()
          const titleEl = Array.from(overlay.querySelectorAll('*')).find(
            (el) => el.children.length === 0 && strip(el.textContent) === title,
          )
          const timerBtn = Array.from(overlay.querySelectorAll('button')).find(
            (b) => b.getAttribute('aria-label') === 'タイマーを開く',
          )
          const rect = (el) => {
            const r = el.getBoundingClientRect()
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }
          }
          const titleRect = titleEl ? rect(titleEl) : null
          const timerRect = timerBtn ? rect(timerBtn) : null
          // タイマーのボタンと同じ高さの帯に、他の操作ボタンが居るか(＝1列を独り占めしていない)
          const sharesRow =
            timerBtn != null &&
            Array.from(overlay.querySelectorAll('button')).some((b) => {
              if (b === timerBtn || timerBtn.contains(b) || b.contains(timerBtn)) return false
              const r = b.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) return false
              const top = Math.max(r.top, timerRect.top)
              const bottom = Math.min(r.bottom, timerRect.bottom)
              return bottom - top >= 8
            })
          return {
            overlay: true,
            titleFound: titleEl != null,
            // 切り詰め(truncate)・枠からのはみ出しで欠けていないか
            titleClipped:
              titleEl != null &&
              (titleEl.scrollWidth > titleEl.clientWidth + 1 ||
                titleEl.scrollHeight > titleEl.clientHeight + 1),
            titleInViewport:
              titleRect != null && titleRect.top >= 0 && titleRect.bottom <= window.innerHeight,
            titleRect,
            timerFound: timerBtn != null,
            timerRect,
            timerTapOk: timerRect != null && timerRect.w >= 44 && timerRect.h >= 44,
            timerAriaLabel: timerBtn?.getAttribute('aria-label') ?? '',
            timerHasVisibleText: strip(timerBtn?.textContent) !== '',
            sharesRow,
          }
        }, ftTitle)

      const ftIdle = await ftMeasure()
      check(
        'FOCUSTOP-01 長い料理名が調理中モードで1文字も隠れない(タイマー0本)',
        ftIdle.titleFound && !ftIdle.titleClipped && ftIdle.titleInViewport,
        JSON.stringify(ftIdle),
      )
      check(
        'FOCUSTOP-01 起動していないタイマーのボタンが横一列を独り占めしない(他の操作と同じ帯に収まる)',
        ftIdle.timerFound && ftIdle.sharesRow,
        JSON.stringify(ftIdle),
      )
      check(
        'FOCUSTOP-01 そのボタンは44px角以上で押せる',
        ftIdle.timerTapOk,
        JSON.stringify(ftIdle.timerRect),
      )
      check(
        'FOCUSTOP-01 画面に文字を出さない代わりに読み上げ名がある',
        ftIdle.timerAriaLabel.length > 0,
        JSON.stringify({ aria: ftIdle.timerAriaLabel, text: ftIdle.timerHasVisibleText }),
      )

      // タイマーを1本動かしても、料理名は隠れずボタンも押せるまま(動作中の見え方を壊さない)
      await ftPage.locator('.fixed.inset-0.z-50').getByRole('button', { name: ja.timer.customOpenAria }).click()
      await ftPage.waitForTimeout(400)
      await ftPage
        .getByRole('dialog', { name: 'タイマー', exact: true })
        .getByRole('button', { name: ja.timer.customStart })
        .click()
      await ftPage.waitForTimeout(700)
      const ftRunning = await ftMeasure()
      check(
        'FOCUSTOP-01 タイマーが動いていても長い料理名は隠れない',
        ftRunning.titleFound && !ftRunning.titleClipped && ftRunning.titleInViewport,
        JSON.stringify(ftRunning),
      )
      check(
        'FOCUSTOP-01 タイマーが動いていても残り時間のチップが読める',
        await ftPage
          .locator('.fixed.inset-0.z-50')
          .getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) })
          .first()
          .isVisible(),
      )
    } finally {
      await ftBrowser.close()
    }
  }

  // --- NAVITIMER-01: 並行調理ナビの調理中モードからも、自由な時間のタイマーを始められる
  //   (2026-08-16 便HB。レシピ詳細・段取りの一覧・1品の調理中モードには入口があり、
  //    並行調理ナビの調理中モードだけ無かった＝「ゆで時間だけ計りたい」がこの画面でだけできなかった)。
  //
  //   測るのは次の2つ。どちらも「どこに置いてあるか」ではなく、利用者が確かめたいことで測る:
  //     ①この画面から自由な時間のタイマーを始められる
  //       (入口を押す→3画面と同じ窓が開く→開始→この画面に残り時間が出て、調整の窓も開ける)
  //     ②入口を足しても画面が狭くなっていない
  //       (手順の枠が、その上に積まれた帯の合計より広い/入口が横一列を独り占めしない/
  //        長い料理名が1文字も隠れない)
  //   ②は見出しの行に置くと必ず落ちる: 390px幅のこの画面の見出しの行は空きが無く、
  //   44px角を1つ足すと料理名の枠が96px→48pxになって折り返しが増える
  //   (実測: 25文字の料理名で手順の枠が417px→24px)。
  //   料理名の長さは同梱レシピに左右されないよう、この検証の中で長い名前を登録して作る。
  //   タイマーが動いている状態でも同じ判定になることまで見る(置き場所が動かないこと) ---
  currentCheck = 'NAVITIMER-01'
  {
    const ntBrowser = await chromium.launch()
    try {
      const ntContext = await ntBrowser.newContext({ viewport: { width: 390, height: 844 } })
      const ntPage = await ntContext.newPage()
      ntPage.on('dialog', (dialog) => dialog.accept())
      const ntLongTitle = '鶏むね肉としめじの香味だれかけ蒸し（作り置きにも）'
      await ntPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ntPage.waitForTimeout(1800)
      await ntPage.evaluate(async (long) => {
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
        const idA = await P(store('recipes').add(mk(long, [
          { text: '鶏むね肉の厚みを開く。' },
          { text: 'フライパンで皮目から5分焼く。', minutes: 5 },
          { text: 'たれをからめて器に盛る。' },
        ], [{ name: '鶏むね肉', amount: '250', unit: 'g' }])))
        const idB = await P(store('recipes').add(mk('HB煮物', [
          { text: '大根は一口大に切る。' },
          { text: '鍋に入れて中火で15分煮る。', minutes: 15 },
          { text: '火を止めて器に盛る。' },
        ], [{ name: '大根', amount: '1/3', unit: '本' }])))
        let addedAt = Date.now()
        for (const id of [idA, idB]) await P(store('todayList').add({ recipeId: id, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      }, ntLongTitle)

      await ntPage.goto(`${BASE}/#/cook-navi`)
      await ntPage.reload({ waitUntil: 'networkidle' })
      await ntPage.waitForTimeout(1200)
      await ntPage.getByRole('button', { name: ja.cookNavi.build }).click()
      await ntPage.waitForTimeout(700)
      await ntPage.locator('[data-testid="cook-session-start"]').click()
      await ntPage.waitForTimeout(700)

      const ntStrip = (s) => (s || '').replace(/​/g, '').trim()
      // 長い料理名の品の手順が出るまで送る(上限は保険。段取りが伸びても届く)
      for (let i = 0; i < 40; i++) {
        const t = ntStrip(await ntPage.locator('[data-testid="cook-session-recipe"]').innerText())
        if (t === ntLongTitle) break
        await ntPage.locator('[data-testid="cook-session-next"]').click()
        await ntPage.waitForTimeout(150)
      }

      /**
       * 上下の帯と手順の枠の実測。掴み方は「上から◯番目の帯」ではなく
       * 「手順の本文が入っている帯」で決める＝並びが変わっても同じものを測る。
       */
      const ntMeasure = async () =>
        await ntPage.evaluate((title) => {
          const overlay = document.querySelector('[data-testid="cook-session"]')
          if (!overlay) return { overlay: false }
          const strip = (s) => (s || '').replace(/​/g, '').trim()
          const rect = (el) => {
            const r = el.getBoundingClientRect()
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }
          }
          const timerBtn = Array.from(overlay.querySelectorAll('button')).find(
            (b) => b.getAttribute('aria-label') === 'タイマーを開く',
          )
          const stepText = overlay.querySelector('[data-testid="cook-session-step-text"]')
          const stepBand = Array.from(overlay.children).find((c) => stepText && c.contains(stepText))
          const titleEl = overlay.querySelector('[data-testid="cook-session-recipe"]')
          const timerRect = timerBtn ? rect(timerBtn) : null
          // 入口が横一列を独り占めしていないか(同じ高さの帯に別の押せるものが居るか)
          const sharesRow =
            timerBtn != null &&
            Array.from(overlay.querySelectorAll('button')).some((b) => {
              if (b === timerBtn || timerBtn.contains(b) || b.contains(timerBtn)) return false
              const r = b.getBoundingClientRect()
              if (r.width === 0 || r.height === 0) return false
              return Math.min(r.bottom, timerRect.bottom) - Math.max(r.top, timerRect.top) >= 8
            })
          return {
            overlay: true,
            timerFound: timerBtn != null,
            timerRect,
            timerTapOk: timerRect != null && timerRect.w >= 44 && timerRect.h >= 44,
            timerAria: timerBtn?.getAttribute('aria-label') ?? '',
            sharesRow,
            titleShown: titleEl ? strip(titleEl.textContent) === title : false,
            titleClipped: titleEl
              ? titleEl.scrollWidth > titleEl.clientWidth + 1 ||
                titleEl.scrollHeight > titleEl.clientHeight + 1
              : null,
            stepBandH: stepBand ? rect(stepBand).h : null,
            // 手順の枠の上に積まれている帯(見出し・案内・動作中タイマー)の合計
            bandsAbove: stepBand ? rect(stepBand).top : null,
          }
        }, ntLongTitle)

      const ntIdle = await ntMeasure()
      check(
        'NAVITIMER-01 並行調理ナビの調理中モードに自由な時間のタイマーの入口がある',
        ntIdle.timerFound,
        JSON.stringify(ntIdle),
      )
      check(
        'NAVITIMER-01 その入口は44px角以上で押せて読み上げ名がある',
        ntIdle.timerTapOk && ntIdle.timerAria.length > 0,
        JSON.stringify({ rect: ntIdle.timerRect, aria: ntIdle.timerAria }),
      )
      check(
        'NAVITIMER-01 入口が横一列を独り占めしない(他の操作と同じ帯に収まる)',
        ntIdle.sharesRow,
        JSON.stringify(ntIdle),
      )
      check(
        'NAVITIMER-01 長い料理名でも手順の枠が上の帯より広い(画面が狭くなっていない)',
        ntIdle.stepBandH != null && ntIdle.bandsAbove != null && ntIdle.stepBandH >= ntIdle.bandsAbove,
        JSON.stringify({ 手順の枠: ntIdle.stepBandH, 上の帯: ntIdle.bandsAbove }),
      )
      check(
        'NAVITIMER-01 長い料理名が1文字も隠れない',
        ntIdle.titleShown && ntIdle.titleClipped === false,
        JSON.stringify(ntIdle),
      )

      // 押した先は3画面と同じ窓。開始まで通して、この画面に残り時間が出ることを見る
      await ntPage
        .locator('[data-testid="cook-session"]')
        .getByRole('button', { name: ja.timer.customOpenAria })
        .click()
      await ntPage.waitForTimeout(400)
      const ntDialog = ntPage.getByRole('dialog', { name: 'タイマー', exact: true })
      check('NAVITIMER-01 押すと自由な時間のタイマーの窓が開く', await ntDialog.isVisible())
      await ntDialog.getByRole('button', { name: ja.timer.customStart }).click()
      await ntPage.waitForTimeout(800)
      const ntSessionText = await ntPage.locator('[data-testid="cook-session"]').innerText()
      check(
        'NAVITIMER-01 始めたタイマーの残り時間がこの画面に出る',
        /\d+:\d\d/.test(ntSessionText),
        ntSessionText.slice(0, 120),
      )
      check(
        'NAVITIMER-01 そのタイマーはこの画面から開いて調整できる',
        (await ntPage
          .locator(`[data-testid="cook-session"] button[aria-label*="${ja.timer.adjustDialogTitle}"]`)
          .count()) > 0,
      )
      const ntRunning = await ntMeasure()
      check(
        'NAVITIMER-01 タイマーが動いていても手順の枠が上の帯より広い',
        ntRunning.stepBandH != null &&
          ntRunning.bandsAbove != null &&
          ntRunning.stepBandH >= ntRunning.bandsAbove,
        JSON.stringify({ 手順の枠: ntRunning.stepBandH, 上の帯: ntRunning.bandsAbove }),
      )
      check(
        'NAVITIMER-01 タイマーが動いていても入口の置き場所は動かない(同じ帯のまま)',
        ntRunning.timerFound && ntRunning.sharesRow && ntRunning.timerTapOk,
        JSON.stringify(ntRunning),
      )
    } finally {
      await ntBrowser.close()
    }
  }

  // --- 便DS: 2026-08-03 オーナー実機フィードバック8件(調理中モード・タイマー・声で操作)の再発防止。
  //  DS-MIC-01(①マイクを一度断ると押しても無反応に見えた → 断られている状態を見つけて直し方を出す) /
  //  DS-VOICE-01(⑤時間の書かれていない手順で「タイマー」と言うと無反応だった → 言い方の案内) /
  //  DS-NAME-01(②どのレシピのタイマーか分からない → この料理の分にも名前を出す) /
  //  DS-BACK-01(③動作中タイマーからレシピの手順へ戻れない(2026-07-12の退行) → 調整の窓に導線) /
  //  DS-MUTE-01(④調理中モードから消音できない → チップと調整の窓の両方に切り替え) /
  //  DS-CUSTOMBTN-01(⑥「タイマー」ボタンがアイコンのみ・定位置で動かない) /
  //  DS-VIB-01(⑦終了時にバイブレーションを呼ぶ・画面に戻ったときの鳴らし直し) /
  //  DS-DONE-01(⑧終わりの表示が390pxで重ならない・文字が薄くならない) ---
  {
    const dsBrowser = await chromium.launch()
    try {
      // 声で操作の実機挙動は自動では再現できないため、SpeechRecognition と
      // navigator.permissions を差し替えて画面側の分岐だけを固定する
      const micStubs = (permissionState) => `
        (() => {
          class FakeRecognition {
            constructor() { window.__recognition = this; this.started = 0 }
            start() { this.started++; window.__recognitionStarts = (window.__recognitionStarts || 0) + 1 }
            stop() {}
            abort() {}
          }
          window.SpeechRecognition = FakeRecognition
          window.webkitSpeechRecognition = FakeRecognition
          const state = ${JSON.stringify(permissionState)}
          if (state === null) {
            Object.defineProperty(navigator, 'permissions', { value: undefined, configurable: true })
          } else {
            Object.defineProperty(navigator, 'permissions', {
              value: { query: async () => ({ state, addEventListener() {}, removeEventListener() {} }) },
              configurable: true,
            })
          }
          window.__vibrations = []
          Object.defineProperty(navigator, 'vibrate', {
            value: (pattern) => { window.__vibrations.push(pattern); return true },
            configurable: true,
          })
        })()
      `
      const openFocus = async (p, name) => {
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1400)
        await p.getByPlaceholder(ja.search.placeholder).fill(name)
        await p.waitForTimeout(500)
        await p.getByText(name, { exact: true }).first().click()
        await p.waitForTimeout(700)
        await p.getByText(ja.focus.open).click()
        await p.waitForTimeout(500)
      }

      // --- DS-MIC-01(a): ブラウザに断られていることが分かる場合。押した時点で案内を出す ---
      currentCheck = 'DS-MIC-01'
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        await ctx.addInitScript(micStubs('denied'))
        const p = await ctx.newPage()
        await openFocus(p, '肉じゃが')
        const focus = p.locator('.fixed.inset-0.z-50')
        await focus.getByRole('button', { name: ja.focus.micStart }).click()
        await p.waitForTimeout(600)
        const guide = await focus.textContent()
        check(
          'DS-MIC-01 断られている状態で押すと、原因と直し方の案内が出る(無反応にしない)',
          guide.includes(ja.focus.micDeniedTitle) &&
            guide.includes(ja.focus.micDeniedBody),
        )
        check(
          'DS-MIC-01 端末ごとの開き方が1行ずつ添えられている(iPhone/Android)',
          guide.includes('iPhone（Safari）') && guide.includes('Android（Chrome）'),
        )
        check(
          'DS-MIC-01 断られたまま聞き取りを始めない(聞いています…にならない)',
          !guide.includes('聞いています…'),
        )
        // 短い手応えのように数秒で消えないこと(以前は流れて気づけなかった)
        await p.waitForTimeout(4000)
        check(
          'DS-MIC-01 案内は数秒で消えない(閉じるまで残る)',
          stripZwspText(await focus.textContent()).includes(ja.focus.micDeniedTitle),
        )
        // 2回目に押しても同じ案内が出る(押しても何も起きないボタンにしない)
        await focus.locator('div.border-warning').getByRole('button', { name: ja.common.close }).click()
        await p.waitForTimeout(300)
        check(
          'DS-MIC-01 案内は閉じられる(閉じたら消える)',
          !(await focus.textContent()).includes(ja.focus.micDeniedTitle),
        )
        await focus.getByRole('button', { name: ja.focus.micStart }).click()
        await p.waitForTimeout(600)
        check(
          'DS-MIC-01 2回目に押しても同じ案内が出る(黙って失敗しない)',
          stripZwspText(await focus.textContent()).includes(ja.focus.micDeniedTitle),
        )
        await ctx.close()
      }

      // --- DS-MIC-01(b): 許可の状態を調べられないブラウザ(Safari等)。開始して失敗してから案内 ---
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        await ctx.addInitScript(micStubs(null))
        const p = await ctx.newPage()
        await openFocus(p, '肉じゃが')
        const focus = p.locator('.fixed.inset-0.z-50')
        await focus.getByRole('button', { name: ja.focus.micStart }).click()
        await p.waitForTimeout(500)
        // ブラウザが「許可されていません」を返した想定
        const restarts = await p.evaluate(() => {
          window.__recognition.onerror({ error: 'not-allowed' })
          const before = window.__recognitionStarts
          window.__recognition.onend()
          return { before, after: window.__recognitionStarts }
        })
        await p.waitForTimeout(500)
        check(
          'DS-MIC-01 許可の状態を調べられない環境でも、失敗を受けて案内が出る',
          stripZwspText(await focus.textContent()).includes(ja.focus.micDeniedTitle),
        )
        check(
          'DS-MIC-01 断られた後は自動再開を止める(開始→即失敗の繰り返しにしない)',
          restarts.before === restarts.after,
          JSON.stringify(restarts),
        )
        await ctx.close()
      }

      // --- DS-VOICE-01(⑤) / DS-NAME-01(②) / DS-MUTE-01(④) / DS-BACK-01(③調理中モード側) ---
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        await ctx.addInitScript(micStubs('granted'))
        const p = await ctx.newPage()
        await openFocus(p, '肉じゃが')
        const focus = p.locator('.fixed.inset-0.z-50')

        // ⑤ 時間の書かれていない手順(手順1)で「タイマー」とだけ言う → 言い方の案内
        currentCheck = 'DS-VOICE-01'
        await focus.getByRole('button', { name: ja.focus.micStart }).click()
        await p.waitForTimeout(600)
        const say = async (text) => {
          await p.evaluate((t) => {
            window.__recognition.onresult({ results: [[{ transcript: t }]] })
          }, text)
          await p.waitForTimeout(500)
        }
        await say('タイマー')
        check(
          'DS-VOICE-01 時間の手掛かりが無い手順で「タイマー」と言うと言い方の案内が出る(無反応にしない)',
          stripZwspText(await focus.textContent()).includes(ja.focus.micTimerHint),
          await focus.textContent(),
        )
        check(
          'DS-VOICE-01 案内だけでタイマーは起動しない(0秒タイマーを作らない)',
          (await focus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).count()) === 0,
        )
        // 言い方どおりに言えば起動する
        await say('3分タイマー')
        check(
          'DS-VOICE-01 案内どおり「3分タイマー」と言えばタイマーが起動する',
          (await focus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).count()) === 1,
        )

        // ② この料理のタイマーにも料理名が出る
        currentCheck = 'DS-NAME-01'
        const ownPill = await p.evaluate(() => {
          const overlay = document.querySelector('.fixed.inset-0.z-50')
          const pill = Array.from(overlay.querySelectorAll('div.inline-flex.rounded-full'))[0]
          return pill ? pill.textContent.replace(/\s+/g, ' ').trim() : null
        })
        check(
          'DS-NAME-01 この料理のタイマーにも料理名が出る(どのレシピの分か分かる)',
          ownPill != null && ownPill.includes('肉じゃが'),
          JSON.stringify(ownPill),
        )

        // ④ 調理中モードから消音できる(チップの切り替え・調整の窓の切り替えの両方)
        currentCheck = 'DS-MUTE-01'
        const muteBtn = focus.getByRole('button', { name: ja.timer.mute })
        check('DS-MUTE-01 調理中モードのタイマーに消音の切り替えがある', await muteBtn.isVisible())
        await muteBtn.click()
        await p.waitForTimeout(300)
        check(
          'DS-MUTE-01 押すと「音を戻す」に変わる(消音できている)',
          await focus.getByRole('button', { name: ja.timer.unmute }).isVisible(),
        )
        await focus.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).click()
        await p.waitForTimeout(400)
        const dsDialog = p.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        check(
          'DS-MUTE-01 調整の窓からも消音を切り替えられる(常駐バーと同じ働き)',
          await dsDialog.getByRole('button', { name: ja.timer.unmute }).isVisible(),
        )
        await dsDialog.getByRole('button', { name: ja.timer.unmute }).click()
        await p.waitForTimeout(300)
        check(
          'DS-MUTE-01 窓の中で音を戻すと表示も戻る',
          await dsDialog.getByRole('button', { name: ja.timer.mute }).isVisible(),
        )

        // ③ 調整の窓から手順へ戻る(調理中モードの中では手順が移動する)
        currentCheck = 'DS-BACK-01'
        check(
          'DS-BACK-01 調整の窓に手順へ戻る導線がある',
          await dsDialog.getByRole('button', { name: jaRe(ja.timer.goToStep) }).isVisible(),
        )
        await ctx.close()
      }

      // --- DS-CUSTOMBTN-01(⑥): 「タイマー」ボタンはアイコンのみ・タイマーが増減しても定位置 ---
      // 声で操作の入り切りは案内文の行数を変えてタイマー行ごと上下させるため、
      // ここでは声には触れず「タイマーの本数だけが変わる」条件で位置を測る
      currentCheck = 'DS-CUSTOMBTN-01'
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        await openFocus(p, '肉じゃが')
        const focus = p.locator('.fixed.inset-0.z-50')
        const customBtn = focus.getByRole('button', { name: ja.timer.customOpenAria })
        check(
          'DS-CUSTOMBTN-01 調理中モードの「タイマー」ボタンはアイコンのみ(文字を出さない)',
          (await customBtn.textContent()).trim() === '',
          JSON.stringify(await customBtn.textContent()),
        )
        const before = await customBtn.boundingBox()
        await customBtn.click()
        await p.waitForTimeout(400)
        await p
          .getByRole('dialog', { name: 'タイマー', exact: true })
          .getByRole('button', { name: ja.timer.customStart })
          .click()
        await p.waitForTimeout(600)
        const after = await customBtn.boundingBox()
        check(
          'DS-CUSTOMBTN-01 タイマーが増えても「タイマー」ボタンの位置は動かない(定位置)',
          before != null &&
            after != null &&
            Math.abs(before.x - after.x) < 1 &&
            Math.abs(before.y - after.y) < 1,
          JSON.stringify({ before, after }),
        )
        // 折り返しの列に混ざっていないこと(チップが増えても押し出されない)。
        // 2026-08-15 便GX: 旧版は「タイマーの列の中で、チップより右端」という置き場所そのものを
        // 固定していたため、ボタンを見出しの行へ移した時点で落ちた(アプリは正常)。測るのは
        // 置き場所ではなく「チップと同じ入れ物に居ない・重ならない」＝FB⑥の意図そのものにする
        const pinned = await p.evaluate(() => {
          const overlay = document.querySelector('.fixed.inset-0.z-50')
          const btn = Array.from(overlay.querySelectorAll('button')).find(
            (b) => b.getAttribute('aria-label') === 'タイマーを開く',
          )
          const chips = Array.from(overlay.querySelectorAll('div.inline-flex.rounded-full'))
          const r = btn.getBoundingClientRect()
          return {
            chips: chips.length,
            insideChip: chips.some((c) => c.contains(btn)),
            overlapsChip: chips.some((c) => {
              const cr = c.getBoundingClientRect()
              return !(cr.right <= r.left || cr.left >= r.right || cr.bottom <= r.top || cr.top >= r.bottom)
            }),
          }
        })
        check(
          'DS-CUSTOMBTN-01 「タイマー」ボタンは折り返しの列の外(チップが増えても押し出されない)',
          pinned.chips > 0 && !pinned.insideChip && !pinned.overlapsChip,
          JSON.stringify(pinned),
        )
        await ctx.close()
      }

      // --- DS-BACK-01(③): 他の画面(食材)からタイマーを触ってレシピの該当手順へ戻る ---
      currentCheck = 'DS-BACK-01'
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1400)
        await p.getByPlaceholder(ja.search.placeholder).fill('肉じゃが')
        await p.waitForTimeout(500)
        await p.getByText('肉じゃが', { exact: true }).first().click()
        await p.waitForTimeout(700)
        const recipeHash = p.url().split('#')[1]
        await p.getByRole('button', { name: '15分 タイマー開始' }).click()
        await p.waitForTimeout(500)
        // 別の画面へ移ってから常駐バーのタイマーを触る
        // (2026-08-17 便HG: ホーム画面を廃止したので「レシピから離れた画面」は食材にした)
        await p.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(900)
        await p.getByRole('button', { name: jaRe(ja.timer.adjustDialogTitle) }).first().click()
        await p.waitForTimeout(400)
        const barDialog = p.getByRole('dialog', { name: ja.timer.adjustDialogTitle })
        const goBtn = barDialog.getByRole('button', { name: jaRe(ja.timer.goToStep) })
        check(
          'DS-BACK-01 他の画面でも動作中タイマーから「手順◯を開く」が出る(2026-07-12の退行の復活)',
          await goBtn.isVisible(),
          await barDialog.textContent().catch(() => 'なし'),
        )
        await goBtn.click()
        await p.waitForTimeout(1200)
        check(
          'DS-BACK-01 押すとそのタイマーのレシピ詳細へ戻る',
          (p.url().split('#')[1] ?? '').startsWith(recipeHash),
          p.url(),
        )
        check(
          'DS-BACK-01 該当手順が一時的に目立つ状態になる(?step=は使い終わったら消える)',
          !(p.url().split('#')[1] ?? '').includes('step='),
          p.url(),
        )
        await ctx.close()
      }

      // --- DS-VIB-01(⑦): 終了時にバイブレーションを呼ぶ / 画面に戻ったときの鳴らし直し ---
      currentCheck = 'DS-VIB-01'
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        await ctx.addInitScript(micStubs('granted'))
        const p = await ctx.newPage()
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1400)
        // 2秒後に終わるタイマーを仕込んで読み直す(15分待たずに終了の合図だけを見る)
        await p.evaluate(() => {
          localStorage.setItem(
            'uchirecipe:activeTimers',
            JSON.stringify([
              {
                id: 901,
                key: 'vib',
                label: '肉じゃが',
                doneLabel: '煮込み終わり',
                recipeId: 1,
                stepNumber: 3,
                endsAt: Date.now() + 2500,
                totalSeconds: 900,
                done: false,
                muted: false,
              },
            ]),
          )
        })
        await p.reload({ waitUntil: 'networkidle' })
        await p.waitForTimeout(5000)
        const vibrations = await p.evaluate(() => window.__vibrations)
        check(
          'DS-VIB-01 タイマー終了で振動を呼ぶ(対応端末で震える)',
          Array.isArray(vibrations) && vibrations.length >= 1,
          JSON.stringify(vibrations),
        )
        check(
          'DS-VIB-01 振動は複数拍の並び(短い1回で終わらせない)',
          Array.isArray(vibrations) && Array.isArray(vibrations[0]) && vibrations[0].length >= 3,
          JSON.stringify(vibrations),
        )
        await ctx.close()
      }

      // --- DS-DONE-01(⑧): 390pxの実DOMで、終わったタイマーの表示が重ならず読める ---
      currentCheck = 'DS-DONE-01'
      {
        const ctx = await dsBrowser.newContext({ viewport: { width: 390, height: 844 } })
        const p = await ctx.newPage()
        await p.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
        await p.waitForTimeout(1400)
        // 終わったタイマー2本(この料理の手順 / 自分で決めた時間)＋動作中1本(別の料理)を並べる
        await p.evaluate(() => {
          const now = Date.now()
          localStorage.setItem(
            'uchirecipe:activeTimers',
            JSON.stringify([
              { id: 801, key: 'a', label: '肉じゃが', doneLabel: '煮込み終わり', recipeId: 1, stepNumber: 3, endsAt: now - 4000, totalSeconds: 900, done: true, muted: false },
              { id: 802, key: 'b', label: 'タイマー', doneLabel: '終わり', recipeId: 1, stepNumber: 1, endsAt: now - 3000, totalSeconds: 180, done: true, muted: false, isCustom: true },
              { id: 803, key: 'c', label: 'カレーライス', doneLabel: '煮込み終わり', recipeId: 2, stepNumber: 5, endsAt: now + 600000, totalSeconds: 900, done: false, muted: false },
            ]),
          )
        })
        await p.goto(`${BASE}/#/recipes/1`, { waitUntil: 'networkidle' })
        await p.reload({ waitUntil: 'networkidle' })
        await p.waitForTimeout(1500)
        await p.getByText(ja.focus.open).click()
        await p.waitForTimeout(700)
        const layout = await p.evaluate(() => {
          const overlay = document.querySelector('.fixed.inset-0.z-50')
          const row = Array.from(overlay.children).find((el) =>
            el.className.includes('items-start gap-2'),
          )
          if (!row) return { error: 'タイマー行が見つからない' }
          const leaves = []
          const walk = (el) => {
            const kids = Array.from(el.children)
            const ownText = Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())
            // アイコン(svg)は1つの塊として数える。中の線同士は「×」の形そのものが交差しているので
            // 掘り下げると必ず重なり判定になってしまう
            const isIcon = el.tagName.toLowerCase() === 'svg'
            if (kids.length === 0 || ownText || isIcon) {
              const r = el.getBoundingClientRect()
              if (r.width > 0 && r.height > 0)
                leaves.push({ text: (el.textContent || '').trim().slice(0, 12) || el.tagName.toLowerCase(), r: { x: r.x, y: r.y, w: r.width, h: r.height } })
            }
            if (!isIcon) kids.forEach(walk)
          }
          walk(row)
          const bad = []
          for (let i = 0; i < leaves.length; i++)
            for (let j = i + 1; j < leaves.length; j++) {
              const a = leaves[i].r
              const b = leaves[j].r
              const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
              const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
              if (ox > 0.5 && oy > 0.5) bad.push(`${leaves[i].text}×${leaves[j].text}`)
            }
          // 終わったチップの文字が薄くなっていないか(透明度を下げる演出を残していないか)
          const donePills = Array.from(overlay.querySelectorAll('div.inline-flex.rounded-full')).filter((el) =>
            el.className.includes('border-warning'),
          )
          const faded = donePills.filter((el) => Number(getComputedStyle(el).opacity) < 1).length
          return {
            bad,
            faded,
            donePills: donePills.length,
            texts: donePills.map((el) => el.textContent.replace(/\s+/g, ' ').trim()),
            pageScrollWidth: document.documentElement.scrollWidth,
            pageClientWidth: document.documentElement.clientWidth,
          }
        })
        check(
          'DS-DONE-01 390pxで終わったタイマーの表示が重ならない(バッジ・名前・終わり・閉じる)',
          layout.bad != null && layout.bad.length === 0,
          JSON.stringify(layout.bad ?? layout),
        )
        check(
          'DS-DONE-01 終わったタイマーの文字が薄くならない(点滅で読めなくならない)',
          layout.faded === 0,
          JSON.stringify(layout),
        )
        check(
          'DS-DONE-01 終わったタイマーに名前と終了の文言が両方出る',
          layout.texts != null &&
            layout.texts.some((t) => t.includes('肉じゃが') && t.includes('煮込み終わり')) &&
            layout.texts.some((t) => t.includes('タイマー') && t.includes('終わり')),
          JSON.stringify(layout.texts),
        )
        check(
          'DS-DONE-01 タイマーが3本並んでも390pxで横あふれしない',
          layout.pageScrollWidth <= layout.pageClientWidth,
          JSON.stringify(layout),
        )
        await ctx.close()
      }
    } finally {
      await dsBrowser.close()
    }
  }

  // --- KECOST-01: 分量が読めない材料に「1本まるごとの値段」が乗らない（2026-08-23 便KE） ---
  // 影響範囲テストA（食費を切り詰めたい人の実データ30品）で実測した不具合を、画面の数字で見張る。
  // 直す前の同じレシピ: 醤油「大匙1」に しょうゆ1L1本ぶんの400円、酒「大匙2」に 260円、
  // にんにく「少々」に1玉60円、ねぎ「大1」に1本100円が乗り、2人分で1食410円と出ていた
  // （厚揚げは食材価格マスタに1件も無く「価格なし」だった）。
  // 直したあと: 厚揚げ1枚60円＋醤油6円＋酒8円＝74円、1食37円。
  // 2026-08-26 便LF: しょうゆを400→278円/1L（全国銘柄の並）にしたので醤油大匙1が6→4円になり、
  // 合計72円・1食36円になった。**この節が見張っているのは「1本まるごとの値段が乗らないこと」**で、
  // 値そのものではない（直す前は1食410円だった）。278円の根拠は src/data/priceDefaults.ts の
  // しょうゆの行のコメント
  // にんにく「少々」とねぎ「大さじ1」は量が決まらないので金額に入れず「価格が分からない材料」に数える
  {
    currentCheck = 'KECOST-01'
    await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(500)
    await page.getByText(ja.paste.open).click()
    await page.waitForTimeout(300)
    await page.locator(`textarea[placeholder="${ja.paste.placeholder}"]`).fill(
      'KE原価確認レシピ\n\n材料（2人分）\n・厚揚げ　1枚\n・醤油　大匙1\n・酒　大匙2\n・にんにく　少々\n・ねぎ　大1\n\n作り方\n1. 炒める',
    )
    await page.getByRole('button', { name: ja.paste.apply }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: ja.form.save }).click()
    await page.waitForTimeout(800)
    const keCostText = stripZwspText(await page.textContent('body'))
    const perServing = (n) => ja.detail.pricePerServing.replace('{s}', '2').replace('{n}', String(n))
    check(
      'KECOST-01 「大匙」を大さじとして読み、1食36円になる（便LFの前は37円）',
      keCostText.includes(perServing(36)),
      keCostText.slice(0, 400),
    )
    check(
      'KECOST-01 醤油1L・酒1Lの満額が乗った1食410円にならない',
      !keCostText.includes(perServing(410)),
    )
    check(
      'KECOST-01 量が決まらない2件は「価格が分からない材料」として知らせる',
      keCostText.includes(ja.detail.costPricelessNote.replace('{n}', '2')),
    )
    check(
      'KECOST-01 金額のうしろに印が付く',
      keCostText.includes(ja.detail.costRoughMark),
    )
  }
