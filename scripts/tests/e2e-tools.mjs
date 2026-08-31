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

// ==========================================================================================
// 「週」と「月」を同じ節で組み立てると重なる（2026-08-31 便MR・禁じ手①）
//
// 何が起きたか（実測）: MEALPLAN-A1B2 は「表示中の週の金曜に肉じゃが」を仕込み、
// 別に「翌月の最初の金曜に先約」を仕込んでいた。今日が月末に近いと表示中の週の金曜が
// 翌月へはみ出し、**その2つが同じ日になる**。2026-08-31（月曜かつ月の最終日）は
// 週が 8/31〜9/6・金曜が 9/4 で、9月の最初の金曜と一致した。1日に2品入ってテンプレートが
// 2品ではなく3品になり、節の16件のうち7件が総崩れになった（フルe2eでは11件）。
// **走らせた日でしか出ない**ので、その日が来るまで気づけない形だった。
//
// ここで見張るのは「同じ形をもう一度作らないこと」。字ではなく**算数の性質**で見る:
// 表示中の週は今日から前後6日以内にしか広がらないので、**2か月以上離れた月**とは
// 決して重ならない。逆に隣の月（±1）は、月によって必ず重なる日がある。
// ==========================================================================================
{
  const RealDate = Date
  const mondayOf = (d) => {
    const m = new RealDate(d)
    m.setDate(d.getDate() + (d.getDay() === 0 ? -6 : 1 - d.getDay()))
    return m
  }
  /** その日の「表示中の週」（月曜〜日曜）が跨いでいる月を全部返す */
  const monthsOfWeek = (d) => {
    const monday = mondayOf(d)
    const set = new Set()
    for (let i = 0; i < 7; i++) {
      const x = new RealDate(monday)
      x.setDate(monday.getDate() + i)
      set.add(`${x.getFullYear()}-${x.getMonth()}`)
    }
    return set
  }
  /** 「getMonth() + n 月の1日」で作った月が、表示中の週と重なるか */
  const overlaps = (d, n) => {
    const anchor = new RealDate(d.getFullYear(), d.getMonth() + n, 1)
    return monthsOfWeek(d).has(`${anchor.getFullYear()}-${anchor.getMonth()}`)
  }
  const countOverlapDays = (n) => {
    let hit = 0
    const cursor = new RealDate(2026, 0, 1)
    const last = new RealDate(2036, 0, 1)
    while (cursor < last) {
      if (overlaps(cursor, n)) hit++
      cursor.setDate(cursor.getDate() + 1)
    }
    return hit
  }
  eq('MR-1 隣の月(+1)は、10年ぶんのどこかで表示中の週と重なる日がある', countOverlapDays(1) > 0, true)
  eq('MR-1 前の月(-1)も重なる日がある（過去へ送る節も同じ穴に落ちる）', countOverlapDays(-1) > 0, true)
  eq('MR-1 2か月先(+2)は10年ぶんで1日も重ならない', countOverlapDays(2), 0)
  eq('MR-1 2か月前(-2)も1日も重ならない', countOverlapDays(-2), 0)
  // 司令部が実測した3日を、そのまま算数で言い直しておく（見立ての裏取りが残る形にする）
  eq(
    'MR-1 2026-08-31(月・月末)は隣の月と重なる＝この日だけ落ちていた',
    overlaps(new RealDate(2026, 7, 31), 1),
    true,
  )
  eq(
    'MR-1 2026-09-01〜09-06 も週は月をまたぐが、隣の月(10月)とは重ならない',
    [1, 2, 3, 4, 5, 6].map((day) => overlaps(new RealDate(2026, 8, day), 1)),
    [false, false, false, false, false, false],
  )
  eq('MR-1 2026-08-19(水・月半ば)は重ならない', overlaps(new RealDate(2026, 7, 19), 1), false)
}

// ==========================================================================================
// e2eの節そのものを読む見張り（便MR）。**字ではなく作りを見る**。
// ①週の頭を getDay() から組み立てている節は、月のアンカーを ±1 で作らない（上の MR-1 の裏返し）
// ②月ごとに回数の変わるもの（第◯曜日の数など）から決まる品数を、数字リテラルで書かない
//   ＝ 2026-09-15 に落ちていた1件がこれ。金曜が5回ある月では 3 ではなく 4 になる
// ==========================================================================================
{
  const { readFileSync, readdirSync } = await import('node:fs')
  const path = await import('node:path')
  const { appRoot } = await import('./_harness.mjs')
  const e2eDir = path.join(appRoot, 'scripts/e2e')
  const files = readdirSync(e2eDir).filter((f) => /^\d/.test(f) && f.endsWith('.mjs'))
  eq('MR-2 前提: 節のファイルを読めている', files.length > 0, true)
  /** コメントを外す（説明文の中の書き方を拾わない） */
  const stripComments = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  /** 節の塊（e2e-part.mjs と同じ区切り）に分ける */
  const blocksOf = (text) => {
    const lines = text.split('\n')
    const out = []
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== '  {') continue
      let end = i + 1
      while (end < lines.length && lines[end] !== '  }') end += 1
      const body = lines.slice(i, end + 1).join('\n')
      const names = [...new Set([...body.matchAll(/currentCheck = '([^']+)'/g)].map((m) => m[1]))]
      // 節の名前は塊の手前に書いてあることが多いので、手前も少し見る
      const head = lines.slice(Math.max(0, i - 8), i).join('\n')
      const headNames = [...new Set([...head.matchAll(/currentCheck = '([^']+)'/g)].map((m) => m[1]))]
      out.push({ names: names.length ? names : headNames, body })
      i = end
    }
    return out
  }
  const weekAndNeighborMonth = []
  for (const file of files) {
    for (const b of blocksOf(readFileSync(path.join(e2eDir, file), 'utf-8'))) {
      const code = stripComments(b.body)
      const buildsWeekHead = /getDay\(\)/.test(code) && /setDate\(/.test(code)
      if (!buildsWeekHead) continue
      // `new Date(x.getFullYear(), x.getMonth() + n, 1)` の形だけを見る
      // （`… + 1, 0)` は「その月の末日」を出す常套句なので対象外）
      for (const m of code.matchAll(/getMonth\(\)\s*([+-])\s*(\d+)\s*,\s*1\s*\)/g)) {
        const n = Number(m[2])
        if (n < 2) weekAndNeighborMonth.push(`${file}:${b.names.join(',') || '(名前なし)'} ${m[0].trim()}`)
      }
    }
  }
  eq(
    'MR-2 週の頭を組み立てる節が、隣の月(±1)を掴んでいない（掴むと必ず重なる日が来る）',
    weekAndNeighborMonth,
    [],
  )

  const a1b2 = blocksOf(readFileSync(path.join(e2eDir, '07-kitchen-mealplan-auto.mjs'), 'utf-8')).find(
    (b) => b.names.includes('MEALPLAN-A1B2'),
  )
  eq('MR-3 前提: MEALPLAN-A1B2 の節を読めている', a1b2 !== undefined, true)
  eq(
    'MR-3 テンプレートを入れる確認文の品数を、数字リテラルで書いていない（金曜は月4回のときも5回のときもある）',
    [...stripComments(a1b2?.body ?? '').matchAll(/\.replace\(\s*'\{n\}'\s*,\s*'(\d+)'\s*\)/g)].map(
      (m) => m[1],
    ),
    [],
  )
}
