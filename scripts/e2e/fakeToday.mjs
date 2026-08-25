// ==========================================================================================
// e2e の時計の道具（`E2E_FAKE_TODAY`）。2026-08-26 便LC が scripts/e2e-smoke.mjs から出した。
//
// **この道具そのものの検査は scripts/tests/e2e-tools.mjs にある**（`npm test` で走る側）。
// なぜ独立したファイルにしたか: 2026-08-25 に見つかった不具合の**根本の原因**は
// 「54,483行の1ファイルに道具が埋まっていて、道具そのものを検査する場所が無かった」こと
// （docs/74 第2手）。道具をここへ出して、道具の検査を持てる形にしてある。
//
// --- ここから下は分ける前の説明をそのまま持ってきたもの ---
//
// なぜ要るか: 禁じ手①（曜日・月替わりの前提）で赤くなった節が、2026-08-09 以降で
// 5回作り込まれた（LOCK-5・EQ-01・WEEKUI-DT、そして 2026-08-24 の EQ-01 再発）。
// どれも「実行した日の曜日でしか起きない」ので、その曜日が来るまで気づけず、
// 気づいたときには**実行が中断**して以降の1,700件が走っていなかった。
//
// 合わせるのは**ブラウザ側と e2e 側の両方**。どちらも**止めずにずらす**
// ＝時計の針は今までどおり進み、日付だけが指定の日になる。
// 止めて（固定して）しまうと、残り時間を Date から数えている調理タイマーが1秒も減らず、
// 曜日と関係ないところが赤くなる（2026-08-24 実測: EZ-01「再開で動き出す」と
// FT-07「開き直しても残り時間が続く」が、固定にした版でだけ落ちた）。
// ブラウザ側は clock.install(時刻) のあと clock.resume() で針を進め直す。
// newContext / newPage を包むので、節ごとに launch している今の書き方のまま全節に効く。
// ==========================================================================================

/** 効かなかったときの既定の落とし方。**黙って進めない**（検査からは差し替えられる） */
const exitOnFail = (message) => {
  console.error(message)
  process.exit(1)
}

/**
 * 「ブラウザ側の今日が本当に指定の日になっているか」をその場で確かめる道具を作る。
 * 効いていなければ `fail` を呼ぶ（既定はその場で落とす）。
 */
export const makeAssertClockApplied =
  (fakeToday, fail = exitOnFail) =>
  async (page) => {
    const shown = await page.evaluate(() => {
      const n = new Date()
      const p = (v) => String(v).padStart(2, '0')
      return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`
    })
    if (shown !== fakeToday) {
      fail(
        `e2e: ブラウザの時計を ${fakeToday} に合わせられませんでした（画面側の今日=${shown}）。` +
          'この状態で走らせると、e2e側の今日と画面の今日が食い違ったまま測ることになります',
      )
    }
    return shown
  }

/**
 * 「今日」を指定の日に合わせる（2026-08-24 便KH）。
 *
 * `browserTypes`（chromium / webkit）の launch() を包み、そこから作られる入れ物とページに
 * ブラウザ側の時計を仕込む。あわせて node 側の `globalThis.Date` もずらす
 * （節の多くが node で「今日／昨日」を組み立ててそれを端末へ仕込むので、ブラウザだけずらすと
 * **仕込む日と画面の今日が食い違う**）。止めずに**ずらす**（差を足すだけ）のは、
 * Playwright の待ち時間の計算が Date.now() の進みに依存しうるため＝固定すると待ちが返らなくなる恐れがある。
 *
 * 戻り値の `restore()` は、node の Date と launch() を元に戻す（検査が後始末に使う）。
 */
export const installFakeToday = ({ fakeToday, browserTypes, fail = exitOnFail }) => {
  const fixedAt = new Date(`${fakeToday}T10:00:00`)
  const RealDate = Date
  {
    const offset = fixedAt.getTime() - RealDate.now()
    class ShiftedDate extends RealDate {
      constructor(...args) {
        if (args.length === 0) super(RealDate.now() + offset)
        else super(...args)
      }
      static now() {
        return RealDate.now() + offset
      }
    }
    globalThis.Date = ShiftedDate
  }
  /**
   * **2026-08-25 に見つかった不具合の修正**（これが無いと、この道具は半分しか効かない）。
   *
   * `globalThis.Date` をずらしたまま Playwright の `clock.install()` を呼ぶと、
   * **Playwright 自身が内部で使う `Date` もずれている**ため、ずらした分がちょうど打ち消され、
   * ブラウザ側の時計は**実際の今日のまま**になる。実測（2026-08-25 18:5x）:
   *   node の今日 = 2026-08-24（ずれている） / ブラウザの今日 = 2026-08-25（ずれていない）
   * つまり `E2E_FAKE_TODAY` は 2026-08-24 の新設以来、**e2e側の日付しか動かしていなかった**。
   * 「月曜と日曜の両方を当てた」検証は、**node は月曜・画面は実際の曜日**という
   * ちぐはぐな状態を測っていたことになる（偽の緑も偽の赤も出うる）。
   * 気づけたのは WEEKUI-01 だけ＝**e2e側の今日と画面の塗り分けを突き合わせる唯一の節**だったため。
   *
   * 直し方: Playwright を呼ぶあいだだけ `globalThis.Date` を本物へ戻す。
   */
  const withRealDate = async (fn) => {
    const shifted = globalThis.Date
    globalThis.Date = RealDate
    try {
      return await fn()
    } finally {
      globalThis.Date = shifted
    }
  }
  /** 時計が本当に効いたかをその場で確かめる。効いていなければ**黙って進めず落とす** */
  const assertClockApplied = makeAssertClockApplied(fakeToday, fail)
  const originals = []
  for (const browserType of browserTypes) {
    const launch = browserType.launch.bind(browserType)
    originals.push([browserType, browserType.launch])
    browserType.launch = async (...args) => {
      const browser = await launch(...args)
      const newContext = browser.newContext.bind(browser)
      browser.newContext = async (...contextArgs) => {
        const context = await newContext(...contextArgs)
        await withRealDate(async () => {
          await context.clock.install({ time: fixedAt })
          await context.clock.resume()
        })
        const newPageOfContext = context.newPage.bind(context)
        let checked = false
        context.newPage = async (...pageArgs) => {
          const page = await newPageOfContext(...pageArgs)
          if (!checked) {
            checked = true
            await assertClockApplied(page)
          }
          return page
        }
        return context
      }
      const newPage = browser.newPage.bind(browser)
      browser.newPage = async (...pageArgs) => {
        const page = await newPage(...pageArgs)
        await withRealDate(async () => {
          await page.clock.install({ time: fixedAt })
          await page.clock.resume()
        })
        await assertClockApplied(page)
        return page
      }
      return browser
    }
  }
  const restore = () => {
    globalThis.Date = RealDate
    for (const [browserType, original] of originals) browserType.launch = original
  }
  return { fixedAt, withRealDate, assertClockApplied, restore }
}
