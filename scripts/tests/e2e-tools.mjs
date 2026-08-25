// ==========================================================================================
// e2eの「道具そのもの」の検査（2026-08-26 便LC・docs/74 第2手）
//
// なぜ要るか: 2026-08-25 に、時計の道具（E2E_FAKE_TODAY）が**半分しか効いていなかった**
// ことが分かった。`globalThis.Date` をずらしたまま Playwright の `clock.install()` を呼ぶと、
// **Playwright 自身が使う `Date` もずれている**ため打ち消され、
// **ブラウザ側の時計は実際の今日のまま**になっていた。
// 2026-08-24 の新設以来ずっとで、規約が求めていた「月曜と日曜の両方を当ててから統合する」は
// **node は指定の曜日・画面は実際の曜日**というちぐはぐな状態を測っていた（偽の緑も偽の赤も出うる）。
// 根本の原因は「54,483行の1ファイルに道具が埋まっていて、**道具そのものを検査する場所が無かった**」こと。
// 道具は scripts/e2e/fakeToday.mjs に出したので、その検査をここに置く。
//
// **なぜ実際にブラウザを立てて測るか**（重い形をあえて選んだ理由）:
// この不具合は node 側だけを見ていると正しく見える（node の今日は指定どおりになっていた）。
// 打ち消しは Playwright の**中**で起きるので、本物のブラウザに「今日は何日か」を聞く以外に、
// 効いているかどうかを確かめる方法が無い。打ち消しの条件を純粋な計算で真似る形も考えたが、
// **真似た側が間違っていても気づけない**（同じ穴をもう一度掘ることになる）。
// 立てるのはブラウザ1つ・ページ1枚だけなので、npm test に足す重さは数秒に収まる。
// 一方、「効かなかったときに落ちること」はブラウザが要らない（画面の答えを差し替えれば測れる）ので、
// そちらは立てずに測る。
// ==========================================================================================
import { chromium } from 'playwright'
import { eq } from './_harness.mjs'
import { installFakeToday, makeAssertClockApplied } from '../e2e/fakeToday.mjs'

{
  const RealDate = Date
  const ymd = (d) => {
    const p = (v) => String(v).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  // 実際の今日と**必ず違う日**を選ぶ。同じ日を指定すると、道具が1つも効いていなくても合格してしまう
  const FAKE = ymd(new RealDate(RealDate.now() - 100 * 24 * 60 * 60 * 1000))
  eq(
    'E2E-CLOCK-0 前提: 合わせる日は実際の今日と違う（同じ日だと効いていなくても合格になる）',
    FAKE !== ymd(new RealDate()),
    true,
  )

  let nodeToday = null
  let browserToday = null
  let keptTicking = false
  let tool = null
  try {
    // 効かなかったときは落とさず投げてもらう（この検査では NG として拾いたい）
    tool = installFakeToday({
      fakeToday: FAKE,
      browserTypes: [chromium],
      fail: (message) => {
        throw new Error(message)
      },
    })
    nodeToday = ymd(new Date())
    const before = Date.now()
    await new Promise((resolve) => setTimeout(resolve, 30))
    keptTicking = Date.now() > before
    const browser = await chromium.launch()
    try {
      const page = await browser.newPage()
      browserToday = await page.evaluate(() => {
        const n = new Date()
        const p = (v) => String(v).padStart(2, '0')
        return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`
      })
    } finally {
      await browser.close()
    }
  } catch (err) {
    browserToday = `落ちた: ${err.message}`
  } finally {
    // 後始末は必ず行う（この検査のあとに走る検査へ、ずらした Date を持ち越さない）
    tool?.restore()
    globalThis.Date = RealDate
  }
  eq('E2E-CLOCK-1 node 側の今日が、指定した日になる', nodeToday, FAKE)
  eq(
    'E2E-CLOCK-1 ブラウザ側の今日も、指定した日になる（globalThis.Date をずらした状態でも打ち消されない）',
    browserToday,
    FAKE,
  )
  eq(
    'E2E-CLOCK-1 時計は止めずにずらす（Date.now が進み続ける。止めると調理タイマーが1秒も減らない）',
    keptTicking,
    true,
  )
  eq('E2E-CLOCK-1 使い終わったら本物の Date に戻せる', Date === RealDate, true)

  // ---- 効かなかったときに、黙って進めず落ちること（ブラウザを立てずに測る） ----
  {
    const fakePage = (shown) => ({ evaluate: async () => shown })
    const said = []
    const assertClockApplied = makeAssertClockApplied(FAKE, (message) => said.push(message))
    await assertClockApplied(fakePage(FAKE))
    eq('E2E-CLOCK-2 画面の今日が指定どおりなら、何も言わずに通る', said, [])
    await assertClockApplied(fakePage('2000-01-01'))
    eq('E2E-CLOCK-2 画面の今日が指定と違えば落とす（黙って進めない）', said.length, 1)
    eq(
      'E2E-CLOCK-2 落とすときは、画面側の今日が何だったかを言う（原因が分かる形にする）',
      said[0]?.includes('2000-01-01') && said[0]?.includes(FAKE),
      true,
    )
  }
}
