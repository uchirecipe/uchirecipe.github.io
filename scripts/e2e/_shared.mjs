// ==========================================================================================
// e2e（scripts/e2e-smoke.mjs）が使う**共有の道具**。2026-08-26 便LC が 54,483行の1ファイルから
// **そのまま**出したもので、道具の中身は1つも変えていない（変えたのは「どのファイルに
// 書いてあるか」だけ）。docs/74 第2手。
//
// ここに置いてあるもの:
//   ・対象URL（BASE）と5173ガード ・時計を合わせる入口（E2E_FAKE_TODAY。道具本体は ./fakeToday.mjs）
//   ・自前のpreviewサーバーを立てる道具 ・合否の記録（ok / ng / check / results / errors）
//   ・画面を触る共通の手順（openAllWeekDays など） ・数の読み取り ・確認の窓の自動押し
//   ・全節が使い回すブラウザ（browser / context / page）とconsole/pageerrorの監視
//
// **節（検査そのもの）はここに書かない。** 節は scripts/e2e/<番号>-<中身>.mjs に書く。
//
// --- 節から道具をどう使うか ---
// 節のファイルは `import './_shared.mjs'` と1行書くだけで、page・check・ja・currentCheck…を
// 分ける前とまったく同じ名前で使える（このファイルの最後で globalThis に載せている）。
// **わざと名前で受け取らない**のは、53,332行ある節の本文を1文字も書き換えずに移すため。
// 名前で受け取る形にすると、節ごとに import の行を足すことになり、
// 「移しただけ」なのか「中身を変えた」のかが機械で突き合わせられなくなる。
// ==========================================================================================
import { chromium, webkit } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import path from 'node:path'
// 2026-08-27: 金額を検査に書き写すと、価格を動かすたびに落ちる（2026-08-26〜27 で3回）。
// **マスタから読める**ようにここで持つ。節のファイル側で import しても
// `scripts/e2e-part.mjs` は節ファイルの import を持っていかないので、共有側に置く
import { PRICE_DEFAULTS } from '../../src/data/priceDefaults.ts'
import zlib from 'node:zlib'
// 文言は src/i18n/ja.ts の1か所から読む（規約H。画面の字を書き写して二重管理しない）
import { ja } from '../../src/i18n/ja.ts'
// 栄養の顔ぶれ・名前は表示側の1か所(便HU・⑯)から読む（画面の字を書き写さない）
import { NUTRITION_DISPLAY_KEYS, nutritionLabelFor } from '../../src/logic/nutrition.ts'
// カードに出る主要食材のチップ（2026-08-19 便HY・CARDPARTS-01）。画面に出る名前は
// この関数が決めるので、検査側でも同じ関数を通して突き合わせる（書き写さない）
import { pickDisplayIngredientChips } from '../../src/logic/mainIngredients.ts'
// 無料の登録上限（2026-08-21 便IR）。お知らせに出る数字は、この1か所から読む（書き写さない）
import { FREE_LIMIT } from '../../src/logic/freeLimit.ts'
// 便IY: 選べる料理のジャンル（画面の字を書き写さず、実装と同じ一覧から引く）
import { MEAL_GENRES } from '../../src/logic/mealPlan.ts'
// 便KD（レンジの二重予約）で、段取りの工程がどの器具を使うかを見分けるのに使う
import { stepAppliance } from '../../src/logic/cookAppliance.ts'
// 便KQ（熱い品が先に仕上がって冷める）で、その品を熱いうちに食べたい品として扱うかを見分ける
import { recipeServeTemp } from '../../src/logic/cookNavi.ts'
// 栄養の公的基準値の文言は、ja.ts の型紙に DAILY_GUIDES の数値を埋めて作る
// （画面の日本語も基準値も書き写さない。2026-08-25 便KV）
import { DAILY_GUIDES } from '../../src/logic/nutritionBalance.ts'
const NB_GUIDE_VEG = ja.nutritionBalance.guideNoteFree.replace(
  '{veg}',
  DAILY_GUIDES.vegetableG.perDayG.toLocaleString(),
)
const NB_GUIDE_FULL = ja.nutritionBalance.guideNote
  .replace('{male}', DAILY_GUIDES.saltG.male.toLocaleString())
  .replace('{female}', DAILY_GUIDES.saltG.female.toLocaleString())
  .replace('{veg}', DAILY_GUIDES.vegetableG.perDayG.toLocaleString())

// 時計の道具（E2E_FAKE_TODAY）。**道具そのものの検査は scripts/tests/e2e-tools.mjs にある**
import { installFakeToday } from './fakeToday.mjs'

/**
 * 検査が読むファイル（.env.production・dist/・src/… ）の位置を決める起点。
 *
 * 分ける前は `import.meta.url`（＝ scripts/e2e-smoke.mjs の場所）から数えていた。
 * この道具を scripts/e2e/ へ移すと1つ深くなって全部ずれるので、**元の場所の値を1か所で持つ**
 * （2026-08-26 便LA が scripts/tests/_harness.mjs でやったのと同じ形）。
 * これで appRoot の意味が分ける前とそのまま同じになる。
 */
const scriptFileUrl = new URL('../e2e-smoke.mjs', import.meta.url).href
const __dirname = path.dirname(fileURLToPath(scriptFileUrl))
const appRoot = path.join(__dirname, '..')

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

// 事故防止ガード(2026-07-21): 環境変数名の誤り(E2E_BASE_URL等)でBASE_URL未指定のまま
// デフォルトの5173(オーナーの開発サーバー・不可侵)へ向けて走る事故が実際に起きた。
// 5173はvite devのためSW無し・/about/等のディレクトリURLがSPAシェルにフォールバックし、
// SMK-19が偽陽性で落ちる(previewのdistと挙動が違う)。previewポートを明示しない実行は
// 原則ミスなので、明示的な許可(ALLOW_DEV_SERVER=1)がない限り中断する。
console.log(`e2e対象: ${BASE}`)
if (/:5173(\/|$)/.test(BASE) && process.env.ALLOW_DEV_SERVER !== '1') {
  console.error(
    'BASE_URLが未指定またはポート5173(オーナーのdevサーバー)を指しています。' +
      'preview(例: BASE_URL=http://localhost:4173)を指定してください。' +
      '意図的にdevサーバーへ実行する場合のみ ALLOW_DEV_SERVER=1 を付けてください。',
  )
  process.exit(1)
}

/**
 * 「今日」を指定の日に合わせて e2e を走らせる（2026-08-24 便KH）。既定では**何もしない**。
 *
 * 使い方: `E2E_FAKE_TODAY=2026-08-24 BASE_URL=... npx tsx scripts/e2e-part.mjs EQ-01`
 * （`scripts/e2e-part.mjs` は同じ入口を通るので、こちらにも効く）
 *
 * 道具の中身と、なぜブラウザ側と e2e 側の両方を合わせるのかは ./fakeToday.mjs に書いてある。
 * **環境変数が無いときは包まない**＝普段の実行に一切影響しない。
 */
const FAKE_TODAY = process.env.E2E_FAKE_TODAY
if (FAKE_TODAY) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(FAKE_TODAY)) {
    console.error(`E2E_FAKE_TODAY は YYYY-MM-DD で指定してください: ${FAKE_TODAY}`)
    process.exit(1)
  }
  console.log(`e2e: 時計を ${FAKE_TODAY} 10:00 に合わせます（曜日の前提の見張り用）`)
  installFakeToday({ fakeToday: FAKE_TODAY, browserTypes: [chromium, webkit] })
}

/**
 * このスクリプトが自前で立てるpreviewサーバーのポートを決める(2026-08-09 便EM)。
 *
 * 直していること: PRO-FALLBACK-01(旧4194)とURLIMPORT-01(旧4203)が固定ポートだったため、
 * 別の作業ブランチのe2eと同時に走ると「previewサーバーが起動しなかった」で落ちていた
 * (--strictPortなので先着が居ると即失敗する)。実装の不具合ではないのに赤くなるので、
 * 原因調査に何度も時間を取られていた。既定はOSに空きポートを聞いて取る。
 *
 * 環境変数(E2E_PREVIEW_PORT / E2E_URLIMPORT_PREVIEW_PORT)で明示指定もできる
 * (BASE_URLと同じ流儀。特定のポートで動かしたいときのため)。
 * 5173(オーナーのdevサーバー)は指定されても使わない。
 */
async function pickFreePort(envName) {
  const specified = process.env[envName]
  if (specified) {
    const port = Number(specified)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error(`${envName} にポート番号として使えない値が入っています: ${specified}`)
    }
    if (port === 5173) {
      throw new Error(`${envName}=5173 は使えません(オーナーのdevサーバー・不可侵)`)
    }
    return port
  }
  return await new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

/**
 * 自前のpreviewサーバーを立てて、起動を待ってから返す(2026-08-09 便EM)。
 * 空きポートを取ってから実際にlistenするまでの隙に別プロセスが同じポートを掴むことは
 * ありうるので、ポートを取り直して数回やり直す(環境変数で明示指定されたときは
 * 指定を尊重して別ポートへ逃げない)。killするのは自分が起動したPIDだけ。
 */
async function startPreviewServer({ envName, label, extraArgs = [], attempts = 3 }) {
  let lastOutput = ''
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const port = await pickFreePort(envName)
    const base = `http://localhost:${port}`
    const proc = spawn(
      'npx',
      ['vite', 'preview', '--port', String(port), '--strictPort', ...extraArgs],
      { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let ready = false
    let exited = false
    let output = ''
    proc.stdout.on('data', (buf) => {
      output += buf.toString()
      if (output.includes('Local:')) ready = true
    })
    proc.stderr.on('data', (buf) => (output += buf.toString()))
    proc.on('exit', () => (exited = true))
    const start = Date.now()
    while (!ready && !exited && Date.now() - start < 15000) {
      await new Promise((resolve) => setTimeout(resolve, 200))
    }
    if (ready) return { proc, base, port }
    proc.kill()
    lastOutput = output
    if (process.env[envName]) break // 明示指定は尊重する(勝手に別ポートへ移らない)
  }
  throw new Error(`${label}のpreviewサーバーが起動しなかった: ${lastOutput}`)
}

const errors = []
const results = []
// いま測っている節の名前。**節のファイルからそのまま `currentCheck = '…'` と書き換えられる**よう、
// 変数ではなく globalThis の持ちものにしてある（分ける前の書き方を1文字も変えないため）。
globalThis.currentCheck = ''
const ok = (label) => results.push({ label, pass: true })
const ng = (label, detail) => results.push({ label, pass: false, detail })
const check = (label, cond, detail = '') => (cond ? ok(label) : ng(label, detail))
/**
 * 画面から読んだ文字を照合する前の下ごしらえ（禁じ手②・2026-08-23 便JM）。
 *
 * BudouX（logic/jaWrap.ts）が折返しのためにゼロ幅スペース(U+200B)を文の途中へ差し込むので、
 * 素の `includes` は**同じ文なのに外れる**。しかも「出ていないこと」を測る向きでは
 * 外れたまま素通りで合格になる（間違いに気づけない）。読んだ側を必ずここに通す。
 * null が返る textContent() をそのまま渡せるよう、null は空文字にする。
 */
const stripZwspText = (s) => (s ?? '').replaceAll('\u200b', '')
/**
 * ja.ts の文言から正規表現を組み立てるときの下ごしらえ（2026-08-29 便MM）。
 *
 * 掴む側で `new RegExp(...)` を作るとき、文言に `.` `(` `?` などが入っていると
 * **正規表現の記号として効いてしまい、要素を掴めず30秒待って実行が中断する**。
 * ja.ts には「（」ではなく半角の「(」を含む文言（例: ja.form.stepMinutes は「分（任意）」だが
 * 半角括弧を使う文言も多い）があるので、必ずここを通してから RegExp に入れる。
 */
const reEscape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/**
 * ja.ts の文言から**掴む側の正規表現**を組み立てる（2026-08-29 便MM）。
 *
 * `getByRole(…, { name: /正規表現/ })` の正規表現リテラルは、JM-1 の網（引用符の中）に
 * 掛からないので、**画面の日本語をそのまま書いた46か所が見えていなかった**。
 * ここを通せば文言は ja.ts が正になる。
 *
 * ・文言の記号（`.` `(` `?` など）は reEscape で外す＝正規表現の記号として効かせない
 * ・`{n}` のような差し込みは subs で「何を当てるか」を指定する
 *   （`{ n: '\\d+' }` なら数字、`{ m: '' }` なら**その場所を見ない**＝前は書き写していた
 *    「月の食費」のように、差し込みの手前や後ろだけを見ていた形をそのまま残せる）
 *   指定が無い差し込みは `.+` を当てる
 * ・`{ exact: true }` で前後を `^…$` で挟む
 */
const jaRe = (text, subs = {}, opt = {}) => {
  const body = String(text)
    .split(/(\{[a-zA-Z]+\})/)
    .map((part) => {
      const hole = /^\{([a-zA-Z]+)\}$/.exec(part)
      if (!hole) return reEscape(part)
      return subs[hole[1]] ?? '.+'
    })
    .join('')
  const start = opt.exact || opt.start ? '^' : ''
  const end = opt.exact || opt.end ? '$' : ''
  return new RegExp(`${start}${body}${end}`, opt.flags ?? '')
}
/**
 * 週タブの曜日カードを全部開く（2026-08-19 便ID・⑦）。
 *
 * 便IDでオーナー指示により曜日カードの既定が変わった（過ぎた日・献立の無い未来の日は畳む）。
 * カードの**中**（枠・サイコロ・食数・メモ）を触る検査は、まずここで開いてから触る
 * ＝畳む前と同じ土台に戻してから測る（既定の畳み方そのものは WEEKFOLD-01 が受け持つ）。
 *
 * 掴み方は data-testid と aria-expanded だけ（並び順・入れ子の段数・クラス名に依らない）。
 * 押す回数は決め打ちせず「畳んでいるカードが無くなるまで」＝日数が変わっても届く
 * （上限12回は保険。7日分より多く押すことは無い）。週タブ以外では何も見つからず素通りする。
 *
 * 2026-08-21 便IO: **畳み方が落ち着くのを待ってから掴む**ようにした（下の settleFold）。
 * 曜日カードの既定は献立がDBから届いてから決まるので、届く前に掴むと掴んだ要素が
 * アプリ自身の手で消え、30秒待って中断していた。あわせて、**終わったときに畳んだカードが
 * 1枚も残っていないことをこの道具自身が確かめる**（開けていないのに黙って戻らない）。
 */
const openAllWeekDays = async (page) => {
  // 押すと Playwright がその要素を画面へ入れるので縦位置が動く。開き終えたら元の位置へ戻す
  // （縦位置そのものを測る検査＝FD-07/FD-09 を、この道具のせいで落とさないため）
  const before = await page.evaluate(() => window.scrollY)
  /** いまの7日の畳み方（'日付:true,日付:false,…'）。週タブ以外では空文字 */
  const readFold = () =>
    page
      .locator('[data-testid="week-day-toggle"]')
      .evaluateAll((els) =>
        els
          .map((el) => `${el.getAttribute('data-date')}:${el.getAttribute('aria-expanded')}`)
          .join(','),
      )
  /**
   * 畳み方が落ち着く（2回続けて同じになる）まで待って、そのときの状態を返す。
   *
   * 2026-08-21 便IO・実測で見つけた道具側の欠陥への手当て:
   * 曜日カードの既定（便ID: 過ぎた日は畳む／今日は開く／献立のある先の日は開く）は
   * **献立がDBから届いてから**決まる。届く前は全部が畳んで見えるので、
   * その瞬間に「畳んでいるカード」を掴むと、直後にアプリが自分でそれを開き、
   * 掴んでいた要素が消えて**30秒待ちで中断**する（`await folded.first().click()` が
   * 「waiting for locator(...)」のまま返ってこない）。
   * SHOPRANGE-EA は「次の週を献立で埋めてから、その週へ戻る」ので7日とも
   * 「開く」条件に当たり、この窓を毎回踏んでいた（実行のたびに中断する場所が変わっていた。
   * dev=75de4b1 の時点でも同じ確率で起きることを実測済み＝アプリの後戻りではない）。
   * 落ち着いてから掴めば、掴んだ要素が消えることが無い。
   */
  const settleFold = async () => {
    let prev = await readFold()
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(150)
      const now = await readFold()
      if (now === prev) return now
      prev = now
    }
    return prev
  }
  let opened = false
  let fold = await settleFold()
  for (let i = 0; i < 12 && fold.includes(':false'); i++) {
    const folded = page.locator('[data-testid="week-day-toggle"][aria-expanded="false"]')
    try {
      // 1枚あたりは短く待つ。落ち着いてから掴んでいるので普通は待たずに押せる
      await folded.first().click({ timeout: 3000 })
      opened = true
    } catch {
      // 押す前にアプリ側が開いた＝押す必要が無くなっただけ。状態を読み直して続ける
    }
    fold = await settleFold()
  }
  // この道具の目的は「7日とも開いた状態にする」こと。開けないまま黙って戻らない
  // （旧版は上限12回で素通りしていたので、開けていないことが呼び出し側の別の赤に化けていた）
  if (fold.includes(':false')) {
    throw new Error(`openAllWeekDays: 開けなかった曜日カードが残っています fold=${fold}`)
  }
  if (opened) {
    await page.evaluate((y) => window.scrollTo(0, y), before)
    await page.waitForTimeout(200)
  }
}
/**
 * 週タブの操作グループ（表示のしかた／献立を提案／別の週・テンプレートから入れる）を開く（2026-08-19 便IF）。
 *
 * 「献立を提案」は便IF・⑤⑥で既定が「開く」に戻った（実行ボタンがグループの中へ移ったため）。
 * **閉じているときだけ押す**＝既定がどちらでも、この呼び出しで「開いた状態」にたどり着ける。
 * 押す回数を決め打ちしない（禁じ手③）。
 */
const openWeekGroup = async (page, title) => {
  const opener = page.getByRole('button', { name: `${title}を開く` })
  if ((await opener.count()) > 0) {
    await opener.first().click()
    await page.waitForTimeout(350)
  }
}
/**
 * 日タブの「今日の献立」を整理モードにする（2026-08-20 便IG・①）。
 *
 * ×（献立から外す）は整理モードの中にしか出さなくなったので、×を触る検査は先にここを通す
 * （×そのものが「整理でないときは出ない／整理にすると出る」ことは DAYORG-01 が受け持つ）。
 * **すでに整理モードなら押さない**＝押す回数を決め打ちしない。ボタンが無い画面では素通りする。
 */
/**
 * 週の「表示のしかた」の週の区切り（週区切り／今日から7日間）を選ぶ。
 *
 * 2026-08-22 便JF・⑤（オーナー原文「表示のしかたの、週区切りと今日から7日間は、プルダウン」）で
 * 押し分ける2つのチップからプルダウンになったので、押し方をここ1か所にまとめる
 * （6か所が同じ2行を書き写していた＝形が変わるたびに6か所を直すことになる）。
 * 節が畳んであれば先に開く。**選べていなければ false を返す**（黙って合格に倒さない）。
 */
const selectWeekLayout = async (page, label) => {
  await openWeekGroup(page, ja.mealPlan.weekGroupDisplayTitle)
  const select = page.locator('[data-testid="week-layout"]')
  if ((await select.count()) === 0) return false
  await select.first().selectOption({ label })
  await page.waitForTimeout(600)
  // 本当にその値になったかまで見る（選べていないのに true を返さない）
  const wanted = label === ja.mealPlan.weekLayoutRolling ? 'rolling' : 'calendar'
  return (await select.first().inputValue()) === wanted
}
const openDayOrganize = async (page) => {
  const toggle = page.locator('[data-testid="day-organize"]')
  if ((await toggle.count()) === 0) return
  if ((await toggle.first().getAttribute('aria-pressed')) === 'true') return
  await toggle.first().click()
  await page.waitForTimeout(350)
}
/**
 * 週タブの1日カードを編集モードにする（2026-08-22 便IV）。
 *
 * オーナー原文「週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ（略）。
 * 1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、選んだレシピの追加や
 * 書き換えができるようにする。」に沿って、**サイコロ・×・食数・役割・時間帯ごとの鍵・
 * 「＋料理を追加」・「レシピを見る」は編集モードの中にしか出さなくなった**。
 * それらを触る検査は、まずここを通してから触る（モードそのものは IVEDIT-03 が受け持つ）。
 *
 * 掴み方は data-testid と aria の状態だけ（並び順・入れ子の段数・クラス名に依らない）。
 * **すでに編集モードなら押さない**＝押す回数を決め打ちしない。
 * 編集モードは一度に1日だけなので、別の日を渡すとそちらへ移る（前の日は通常表示に戻る）。
 * 畳んでいる日は切り替えボタンが出ないので、先に開く。
 * 週タブ以外では false を返す（黙って合格に倒さないよう、呼び出し側で見ること）。
 * 2026-08-22 便JF・①: 過ぎた日にも編集モードが付いた（中身は「作った記録を追加」で、
 * 献立の枠は出ない）。この道具は「編集モードに入れたか」だけを返すので、過ぎた日でも true になる。
 */
const openWeekDayEdit = async (page, date) => {
  const toggle = page.locator(`[data-testid="week-day-toggle"][data-date="${date}"]`)
  if ((await toggle.count()) === 1 && (await toggle.first().getAttribute('aria-expanded')) === 'false') {
    await toggle.first().click()
    await page.waitForTimeout(350)
  }
  const edit = page.locator(`[data-testid="week-day-edit"][data-date="${date}"]`)
  if ((await edit.count()) === 0) return false
  if ((await edit.first().getAttribute('aria-pressed')) !== 'true') {
    await edit.first().click()
    await page.waitForTimeout(350)
  }
  return (await edit.first().getAttribute('aria-pressed')) === 'true'
}
/**
 * 月タブの日の窓を編集モードにする（2026-08-23 便JN）。
 *
 * オーナー原文「献立／月／・見た目を週に寄せて、編集ボタンをつけて。」に沿って、
 * 窓は**通常表示（写真と料理名だけ）で開く**ようになった。サイコロ・×・食数・役割・
 * 時間帯の鍵・「＋料理を追加」・「レシピを見る」・「カレンダーに出す写真」は
 * 編集モードの中にしか出ない。それらを触る検査は、まずここを通してから触る
 * （モードそのものは JNVIEW-01／JNEDIT-02 が受け持つ）。
 *
 * 掴み方は data-testid と aria の状態だけ（並び順・入れ子の段数・クラス名に依らない）。
 * **すでに編集モードなら押さない**＝押す回数を決め打ちしない。
 * 窓が開いていない・サンプルの1か月では切り替えが無いので false を返す
 * （黙って合格に倒さないよう、呼び出し側で見ること）。
 */
const openMonthDayEdit = async (page) => {
  const edit = page.locator('[data-testid="day-modal-edit"]')
  if ((await edit.count()) === 0) return false
  if ((await edit.first().getAttribute('aria-pressed')) !== 'true') {
    await edit.first().click()
    await page.waitForTimeout(400)
  }
  return (await edit.first().getAttribute('aria-pressed')) === 'true'
}
/**
 * 画面に出ている数を「助数詞に依らず」読むための道具（2026-08-18 便HR）。
 *
 * 2026-08-08と2026-08-18の2回、**数え方を見直すたびにe2eが赤くなった**。
 * 落ちたのはアプリではなく、期待文字列に「◯件」と書いてあったテストのほうだった。
 * ここで確かめたいのは **数が出ているか・その数が合っているか** であって、
 * 品と件のどちらで書いてあるかではない。**助数詞そのものの正しさは
 * scripts/test-logic.mjs の HR-1/HR-2 が規則で掃いて受け持つ**ので、役割を分ける。
 *
 * なお、数の取り出しに失敗したときに -1 や NaN を返して「小さいから合格」に
 * 倒れると、赤にならず素通りする（2026-08-18 FS-06 で実際に起きた）。
 * 読めなかったことが分かるよう、呼び出し側で null / NaN を必ず不合格として扱うこと。
 */
const ZW = /\u200B/g
const COUNTER = '[品件]'
/** 「全109品」「全109件」のどちらでも総数だけを読む。読めなければ null */
const readTotalCount = (text) => {
  const m = (text ?? '').replace(ZW, '').match(new RegExp(`全\\s*(\\d+)\\s*${COUNTER}`))
  return m ? Number(m[1]) : null
}
/** 「12品 / 全109品」「12件 / 全109件」のどちらでも {shown, total} を読む。読めなければ null */
const readResultCount = (text) => {
  const m = (text ?? '')
    .replace(ZW, '')
    .match(new RegExp(`(\\d+)\\s*${COUNTER}\\s*/\\s*全\\s*(\\d+)\\s*${COUNTER}`))
  return m ? { shown: Number(m[1]), total: Number(m[2]) } : null
}
/** 「献立の予定2品」「献立の予定2件」のどちらでも、その語のうしろの数が n かを見る */
const hasCountAfter = (text, label, n) =>
  new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*${n}\\s*${COUNTER}`).test(
    (text ?? '').replace(ZW, ''),
  )
/** 語を伴わない「2品」「2件」のどちらでも、その数が出ているかを見る */
const hasCount = (text, n) =>
  new RegExp(`(?:^|[^0-9])${n}\\s*${COUNTER}`).test((text ?? '').replace(ZW, ''))

// タイマーの残り表示("08:24"や"1:05:00")を秒数に変換する(TIMER-ADJ-01/TIMER-CUSTOM-01用)
const parseRemainingSeconds = (text) => {
  const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return m[3] !== undefined
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2])
}

/**
 * レシピ詳細の初回の案内(2026-08-13 便GE「食数の設定」「台所の器具」)を、
 * **既定では「見た」状態**にしてからページを開く。
 *
 * この案内はレシピ詳細に重なる窓なので、そのままだとレシピ詳細を開く他の検証が
 * ことごとく窓に阻まれる(押したい要素が窓の下になる)。他の検証が見たいのは
 * 「案内を見たあとの、ふだんの画面」なので、ここでまとめて既定を寄せる。
 * 案内そのものの検証(GE-01)だけが、この既定を外して初回の状態から確かめる。
 *
 * 仕込む場所は「新しく作ったブラウザの入れ物(context)」で、addInitScriptは
 * ページのスクリプトより先に走るため、アプリが読む前に記録が入る。
 * launch()を包む形にしてあるので、検証ごとに増える入れ物を数え漏らさない。
 */
const FIRST_SETUP_NOTICE_SEEN_KEY = 'uchirecipe:firstSetupNoticeSeen'

/**
 * 画面の中の確認の窓（2026-08-15 便GW・components/ConfirmDialog）を、出たらすぐ押す仕掛け。
 *
 * 便GWでアプリ全体の確認をブラウザの素のダイアログ（window.confirm）から画面の中の窓へ移した。
 * それまでの検証は `page.on('dialog', (d) => d.accept())` で素のダイアログを自動で押していたので、
 * **同じ役目を窓に対して果たすもの**をここに置く（検証ごとに押す行を書き足さなくて済む）。
 *
 * 切り替えは localStorage の 'e2e:confirmAuto' で行う:
 *   （未設定・'accept'）… 「実行」側を押す（旧 dialog.accept()）
 *   'cancel'            … 「やめる」側を押す（旧 dialog.dismiss()）
 *   'off'               … 何もしない（窓を見て自分で押す検証用）
 * 押した窓の文字は window.__confirmDialogs に貯め、page.exposeFunction('__e2eConfirmSeen') を
 * 用意している検証にはそちらへも渡す（旧 dialog.message() の置き換え）。
 *
 * 目印は既定の `confirm` だけを見る。書き出しの確認（recipes-export-confirm）や
 * 並行調理ナビの並び戻し（navi-reorder-reset-modal）は自分の目印を持ち、
 * それぞれの検証が自分で押しているので、ここでは触らない。
 */
const installConfirmAutoPress = () => {
  const pressed = new WeakSet()
  const pump = () => {
    const dialog = document.querySelector('[data-testid="confirm"]')
    if (!dialog || pressed.has(dialog)) return
    let mode = 'accept'
    try {
      mode = localStorage.getItem('e2e:confirmAuto') || 'accept'
    } catch {
      mode = 'accept'
    }
    if (mode === 'off') return
    pressed.add(dialog)
    // BudouXのゼロ幅スペースが混じっても照合が外れないよう、貯める前に外す(禁じ手②)
    const text = (dialog.textContent ?? '').replaceAll('​', '')
    window.__confirmDialogs = window.__confirmDialogs || []
    window.__confirmDialogs.push(text)
    try {
      window.__e2eConfirmSeen?.(text)
    } catch {
      // 受け取り口を用意していない検証では何もしない
    }
    const target = mode === 'cancel' ? 'confirm-cancel' : 'confirm-ok'
    dialog.querySelector(`[data-testid="${target}"]`)?.click()
  }
  const start = () => {
    new MutationObserver(pump).observe(document.body, { childList: true, subtree: true })
    pump()
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
}

/**
 * 確認の窓の文言を配列へ貯める受け取り口を用意する（旧 page.on('dialog', d => arr.push(d.message()))）。
 * ページを開く前に呼ぶこと（addInitScriptの仕掛けが最初に窓を見つけたときには用意できている必要がある）
 */
const collectConfirms = (targetPage, sink) =>
  targetPage.exposeFunction('__e2eConfirmSeen', (text) => {
    // 呼ぶ側は「配列に貯める」も「その場で受け取る関数」も使う（旧 page.on('dialog') の置き換えで
    // 両方の書き方が残っている）。**関数を渡された入れ物で push を呼ぶと、ページ側に
    // 例外が返って pageerror になる**（2026-08-15に6件発生）ので、両方を受ける
    if (typeof sink === 'function') sink(text)
    else sink.push(text)
  })

/** 確認の窓の答え方を切り替える（'accept' 既定 / 'cancel' / 'off'）。ページを開いたあとに呼ぶ */
const setConfirmAnswer = (targetPage, mode) =>
  targetPage.evaluate((value) => {
    localStorage.setItem('e2e:confirmAuto', value)
  }, mode)

/** その入れ物で出た確認の窓の文言（貯め口を用意していない検証でも後から読める） */
const readConfirms = (targetPage) => targetPage.evaluate(() => window.__confirmDialogs ?? [])

/**
 * 「データを上書き」→ 確認の窓の「上書きする」→ ファイル選択、をこの順で押す。
 * ファイル選択の画面は「利用者が押した直後」でないとブラウザが開かせないので、
 * ここだけは仕掛けの自動押しに任せず**本物のクリック**で窓を押す
 * （仕掛けのクリックは利用者の操作として扱われず、ファイル選択が開かない）。
 */
const clickReplaceImport = async (targetPage) => {
  await setConfirmAnswer(targetPage, 'off')
  const chooser = targetPage.waitForEvent('filechooser')
  await targetPage.getByRole('button', { name: ja.settings.backupImportReplace }).click()
  // 自動押しを止めているぶん、**1回目の確認文が貯め口に入らない**。手で押す前に自分で渡す
  // （でないと「2回とも件数が入っているか」を測れない。2026-08-15）
  await targetPage.evaluate(() => {
    const t = (document.querySelector('[data-testid="confirm"]')?.textContent ?? '').replaceAll(
      '\u200b',
      '',
    )
    if (t) {
      window.__confirmDialogs = window.__confirmDialogs || []
      window.__confirmDialogs.push(t)
      try {
        window.__e2eConfirmSeen?.(t)
      } catch {
        /* 受け取り口を用意していない検証では何もしない */
      }
    }
  })
  await targetPage.locator('[data-testid="confirm-ok"]').click()
  const fileChooser = await chooser
  // ファイルを選んだあとに出る2回目の確認は、今までどおり仕掛けに任せる
  await setConfirmAnswer(targetPage, 'accept')
  return fileChooser
}
const markNoticesSeenByDefault = (browserType) => {
  const origLaunch = browserType.launch.bind(browserType)
  browserType.launch = async (...launchArgs) => {
    const launched = await origLaunch(...launchArgs)
    const origNewContext = launched.newContext.bind(launched)
    launched.newContext = async (...contextArgs) => {
      const ctx = await origNewContext(...contextArgs)
      await ctx.addInitScript((key) => {
        try {
          localStorage.setItem(key, '1')
        } catch {
          // ストレージを使えない設定の入れ物では何もしない(案内が出るだけ)
        }
      }, FIRST_SETUP_NOTICE_SEEN_KEY)
      await ctx.addInitScript(installConfirmAutoPress)
      return ctx
    }
    return launched
  }
}
markNoticesSeenByDefault(chromium)
markNoticesSeenByDefault(webkit)
/** GE-01専用: 初回の状態(案内をまだ見ていない)から始める入れ物を作る */
const newContextWithFirstSetupNotice = async (browserInstance, options) => {
  const ctx = await browserInstance.newContext(options)
  await ctx.addInitScript((key) => {
    try {
      localStorage.removeItem(key)
    } catch {
      // 何もしない
    }
  }, FIRST_SETUP_NOTICE_SEEN_KEY)
  return ctx
}

/**
 * 検査用のPNGを作る（2026-08-22 便JK）。写真の「見える範囲」は**大きさのある写真**でないと
 * 測れない（1x1の点だと画面に1pxでしか出ず、なぞる面も持てない）。
 * 上下・左右で色が違う縞にしてあるので、切り取り位置が変わったことを絵でも確かめられる。
 */
function makeTestPng(width, height) {
  const crcTable = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crcTable[n] = c >>> 0
  }
  const crc32 = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 1色8ビット
  ihdr[9] = 2 // RGB
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) {
    const rowStart = y * (width * 3 + 1)
    raw[rowStart] = 0 // フィルタなし
    for (let x = 0; x < width; x++) {
      const at = rowStart + 1 + x * 3
      raw[at] = Math.round((x / Math.max(1, width - 1)) * 255)
      raw[at + 1] = Math.round((y / Math.max(1, height - 1)) * 255)
      raw[at + 2] = (Math.floor(y / 8) + Math.floor(x / 8)) % 2 === 0 ? 40 : 220
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const browser = await chromium.launch()
const context = await browser.newContext() // 毎回まっさらなストレージ(初回シードから検証)
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ
  if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
  errors.push(`[console@${currentCheck}] ${text}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror@${currentCheck}] ${err.message}`))
page.on('dialog', (dialog) => dialog.accept())

// ------------------------------------------------------------------------------------------
// 節のファイルから、分ける前とまったく同じ名前で使えるようにする。
// ここに並んでいるものが「節が使ってよい道具の一覧」＝分ける前に try { } の外にあったもの。
// ------------------------------------------------------------------------------------------
Object.assign(globalThis, {
  BASE, FIRST_SETUP_NOTICE_SEEN_KEY, FREE_LIMIT, MEAL_GENRES, NB_GUIDE_FULL, NB_GUIDE_VEG,
  NUTRITION_DISPLAY_KEYS, PRICE_DEFAULTS, appRoot, browser, check, chromium, clickReplaceImport,
  collectConfirms, context, errors, execSync, existsSync, hasCount,
  hasCountAfter, installConfirmAutoPress, ja, makeTestPng, newContextWithFirstSetupNotice, ng,
  nutritionLabelFor, ok, openAllWeekDays, openDayOrganize, openMonthDayEdit, openWeekDayEdit,
  openWeekGroup, page, parseRemainingSeconds, path, pickDisplayIngredientChips, pickFreePort,
  readConfirms, readFileSync, readResultCount, readTotalCount, recipeServeTemp, results,
  jaRe, reEscape, selectWeekLayout, setConfirmAnswer, startPreviewServer, stepAppliance,
  stripZwspText,
  webkit,
  zlib,
})

/**
 * 月タブの「献立の入れかた」の折りたたみを開く（2026-08-26 便LH）。
 *
 * オーナー原文「献立関連のボタンがバラバラに配置してあるように見えるので、1グループにまとめて。
 * **折りたたみの見える部分は「献立をまとめて提案」のみ**」に沿って、
 * 「現在の条件」「テンプレート」は畳んだ中に入った。**畳んだままだと掴めず30秒待って
 * 実行中断する**（2026-08-26 に WEEKCOND-02 と PURPOSE-02 で実発。フルe2eが3,451件で止まった）。
 * すでに開いていれば押さない＝押す回数を決め打ちしない（禁じ手③）。
 */
export const openMonthPlanGroup = async (page) => {
  const opener = page.getByRole('button', {
    name: ja.mealPlan.weekGroupToggleOpenAria.replace('{group}', ja.mealPlan.monthPlanGroupTitle),
  })
  if ((await opener.count()) > 0) {
    await opener.first().click()
    await page.waitForTimeout(350)
  }
}
globalThis.openMonthPlanGroup = openMonthPlanGroup

/**
 * 「朝食」「昼食」「夕食」の名前のボタンは、2026-08-29 から**同じ画面に2組**並ぶことがある
 * （前からある「表示する食事」と、便MK が足した週の「入れる食事」）。
 * 名前だけで掴むと strict mode violation で**その節が丸ごと実行中断**する（統合時に MEALPLAN-01 で実発）。
 * この道具は**前からあるほう**を指す＝新しいチップ（week-fill-slot）を外す。
 * 新しいチップを掴みたいときは testid で直接掴むこと。
 */
globalThis.slotBtnExceptFill = (scope, name) =>
  scope
    .getByRole('button', { name, exact: true })
    .and(scope.locator(':not([data-testid="week-fill-slot"])'))

/**
 * 「今日の献立に入れる」で開く、**食事の枠を選ぶ窓**のボタン（2026-08-29 便MM）。
 *
 * 名前だけで掴んで `.first()` を付けていた6か所（13-trial-demo-day ×2・14-dayplan-card-bulk ×2・
 * 23-ii-iy・25-jj-jq）を、この道具に寄せた。**実測（2026-08-29・6か所とも）では
 * 「夕食」という名前のボタンは画面に1つしか無く、`.first()` は正しいほうを掴めていた。**
 * それでも寄せるのは、`.first()` が**同じ名前が2つになった瞬間に中断せず、
 * 黙って別のボタンを掴んで緑のまま通る**形だから（週の「入れる食事」を足した 2026-08-29 に
 * `MEALPLAN-01` が同じ形で倒れている）。窓のボタン（data-testid="today-slot-button"）
 * だけを見るようにすれば、窓の外に同じ名前が増えても当たらない。
 */
globalThis.todaySlotBtn = (scope, name) =>
  scope
    .getByRole('button', { name, exact: true })
    .and(scope.locator('[data-testid="today-slot-button"]'))

/**
 * 合わせ調味料の組の丸ボタンの aria-label の**共通の頭**（2026-08-29 便MM）。
 * 画面には「合わせ調味料グループ1（…）」（ja.form.ingredientGroupSet）と
 * 「合わせ調味料グループ: なし（押して設定）」（ja.form.ingredientGroupNone）の2つが出る。
 * 前方一致で掴む・数えるときの頭を **ja.ts から作る**（画面の字を書き写さない）。
 */
globalThis.INGREDIENT_GROUP_PREFIX = ja.form.ingredientGroupSet.split('{n}')[0]
globalThis.INGREDIENT_GROUP_RE = new RegExp(`^${reEscape(globalThis.INGREDIENT_GROUP_PREFIX)}[0-9]`)

/**
 * タイマーの調整の窓にある「戻る導線」のボタン名（2026-08-29 便MM）。
 * 画面によって3つのうちどれかが出る（手順へ移る goToStep ／ 見るだけの peekStep ／
 * 単品レシピへ飛ぶ goToRecipe）ので、**3つとも ja.ts から読んで並べる**。
 * 前は `/を(開く|見る)/` と書き写していた＝文言を直すと掴めず30秒待って実行中断する形だった。
 */
globalThis.TIMER_BACK_LINK_RE = new RegExp(
  [ja.timer.goToStep, ja.timer.peekStep, ja.timer.goToRecipe].map((t) => jaRe(t).source).join('|'),
)

/**
 * 期間の栄養の注記（2026-08-29 便MP）。「作った記録◯件と登録した献立◯品の栄養価を、
 * 1食分ずつ足して算出した数値です」は**記録だけ／献立だけ／両方**の3通りあり、
 * 検査は「実際にはどれが出ていたか」を失敗の説明に載せたい。
 * **3つとも ja.ts から読んで並べる**（前は `/.{0,20}1食分ずつ足して…/` と書き写していた＝
 * 文末の言い回しを直すと、説明が undefined になって何も読めなくなる形だった）。
 * 節をまたいで使うので、節のファイルではなくここに置く（scripts/e2e-part.mjs は
 * 節の塊の直前の行しか持っていかないため、節のファイルの先頭に置くと切り出しで欠ける）。
 */
globalThis.RANGE_NUTRITION_NOTE_ANY_RE = new RegExp(
  [
    ja.mealPlan.rangeIntakeNutritionCountBoth,
    ja.mealPlan.rangeIntakeNutritionCountActual,
    ja.mealPlan.rangeIntakeNutritionCountPlan,
  ]
    .map((t) => jaRe(t, { a: '\\d+', p: '\\d+' }).source)
    .join('|'),
)
/**
 * 期間の「数え方の基準」の1行（2026-08-29 便MP）。混在／先の期間だけ／今日から先／今日 の
 * 4通りを ja.ts から読んで並べる。日付の差し込みにだけ `\d+/\d+` を当てる（`.+` は使わない）。
 */
globalThis.RANGE_BASIS_ANY_RE = new RegExp(
  [
    ja.mealPlan.rangeBasisBoth,
    ja.mealPlan.rangeBasisFutureRange,
    ja.mealPlan.rangeBasisPlanOnly,
    ja.mealPlan.rangeBasisToday,
  ]
    .map(
      (t) =>
        jaRe(t, { ps: '\\d+/\\d+', pe: '\\d+/\\d+', fs: '\\d+/\\d+', fe: '\\d+/\\d+' }).source,
    )
    .join('|'),
)

/**
 * 要素の上端（viewport相対の top）を id で読む（2026-08-29 便MQ）。
 *
 * 設定の1本スクロールで「その節の先頭までスクロールしたか」を測るのに使う
 * （sticky目次チップ約88pxの下付近＝200未満なら着いたとみなす。scroll-mt-24 でチップ分だけ下げている）。
 * **元は 01-start-list-settings.mjs の節の途中に `const` で書いてあった。**
 * そのままだと、その道具を使う塊を `e2e-part` で切り出したとき
 * **「settingsSectionTop is not defined」で実行中断**し、切り出せても中身が測れない
 * （2026-08-29 に SETTINGS-TAB-01 で実測）。共有の道具に置けば、どの塊を切り出しても使える。
 */
globalThis.settingsSectionTop = (id) =>
  page.evaluate((elId) => {
    const el = document.getElementById(elId)
    return el ? el.getBoundingClientRect().top : null
  }, id)

/**
 * スムーズスクロールが落ち着く（window.scrollY が変化しなくなる）まで待つ（2026-08-29 便MQ）。
 *
 * 長距離のスムーズスクロールは固定待ちだとアニメーションの途中で測ってしまう（旧: 700ms固定で偽陰性）。
 * settingsSectionTop と同じ理由で、節の途中の `const` から共有の道具へ移した。
 */
globalThis.waitScrollSettled = async () => {
  let last = -1
  for (let i = 0; i < 25; i++) {
    const y = await page.evaluate(() => Math.round(window.scrollY))
    if (y === last) return
    last = y
    await page.waitForTimeout(120)
  }
}
