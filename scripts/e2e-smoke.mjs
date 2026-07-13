// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / COUNT-01(一覧上部の総件数「全◯件」が絞り込み無しでも常に表示され、
//         絞り込み中は「◯件 / 全◯件」の形になる。2026-07-13 UI改善) /
//         QF-01(「時短レシピ」絞り込みで件数が変わる。チップ文言は2026-07-13変更) /
//         LAYOUT-01(一覧のグリッド/リスト表示切替。settingsに保存されリロード後も維持される。
//         2026-07-13 UI改善。同日オーナー実機フィードバックでリスト行にも主要食材チップ・
//         由来バッジ・タイトル2行折り返しを追加し、グリッドと同等の情報量になったことを確認) /
//         SORTDIR-01(並べ替えの昇順/降順トグル。「あいうえお順」既定は昇順、「降順」で並びが
//         ちょうど反転する。2026-07-13 UI改善) /
//         SMK-02+03(登録・削除) /
//         SMK-04(貼り付け整形) / SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) /
//         KW-01(検索キーワード欄。保存→検索でヒットし、一覧・詳細には表示されないこと) /
//         SMK-14簡易(未解錠ゲート) /
//         SETTINGS-TAB-01(設定画面のタブ分割。?set=/?section=直リンクが該当タブを自動で開く・
//         4タブの手動切替・トーストのタップ閉じ。2026-07-12オーナー実機フィードバック。
//         タブ名「基本」→「全般」は2026-07-13 UIペルソナQA。同日「全般」タブ内はNG食材の直下に
//         「食材と価格」「週の食費予算」を移動、タブバーはsticky化＋タブごとのスクロール位置復元) /
//         TOAST-01(設定操作結果メッセージのトースト化。数秒で自動的に消えること。
//         自動非表示は2026-07-13 UIペルソナQAで4.5秒→6秒に延長) /
//         STARTER-RELOAD-01(「基本レシピを入れ直す」でユーザーデータ(お気に入り)が保持されること。
//         2026-07-13 削除→再追加からユーザーデータ保持方式への改修) /
//         PACK-01(Pro解錠済み・パック未解錠のとき追加レシピパックのコード入力欄がdisabledになり
//         案内文が出ること、Pro版の機能一覧が解錠中ずっと表示され続けること。2026-07-13 UI改善) /
//         SMK-19(静的ページがアプリ本体にすり替わらない。SWが動くpreviewでの実行時に実質検証) /
//         SCROLL-01(一覧のスクロール位置復元。iPhone SE実機フィードバック 2026-07-11。
//         webkit+375x667ビューポートで検証。60秒滞在バリエーション込み。他のチェックはchromiumのまま) /
//         SCROLL-02(一覧の絞り込み・並べ替え条件が詳細→戻るを経ても保持される。
//         2026-07-12深夜フィードバック再調査で判明した本当の原因の再発防止。PC Chrome相当) /
//         TIMER-ADJ-01(実行中タイマーの±調整窓。タップで開き「+1分」「−30秒」で残り秒が変わる。
//         常駐バー行の「+1分」ミニボタン単体での即+60秒も確認。2026-07-13 UIペルソナQA) /
//         TIMER-CUSTOM-01(じぶんタイマー。入口Aから起動し、0未満にならない floor 挙動も確認。
//         2026-07-12秒刻み対応で±30秒・±10秒の分+秒表示・10秒未満にならない floor も確認) /
//         LOG-PHOTO-01(「作った！」記録への写真添付。選択→プレビュー→保存→一覧サムネイル→
//         原寸表示窓、圧縮後Blobと自動記録された表示人数をIndexedDBから直接検証。2026-07-12) /
//         NUT-01(栄養価のめやす: 未解錠でもエネルギー・塩分の概算が閉じた1行から見え、
//         展開すると「めやす」表記・出典・Pro案内リンクが出る) /
//         NUT-02(栄養価のめやす: Pro解錠済みで8項目の実パネルが出る(2026-07-13 第2弾で
//         食物繊維・鉄・カルシウム+ビタミン注記を追加)・人数を変えても1人分の値は不変。
//         M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED有効化) /
//         NUTSORT-01(栄養並び替え・2026-07-13 Fable設計: 無料では「カロリー(1食)」だけが並べ替えに
//         出て「たんぱく質(1食)」は出ない・カロリー順の既定は昇順・算出不能レシピは昇順/降順とも末尾) /
//         NUTSORT-02(栄養並び替え・Pro解錠済み: 「たんぱく質(1食)」が出て既定は降順) /
//         TOMB-01(削除したセット品の再取込除外=トゥームストーン・2026-07-13 Fable設計:
//         テーマ取り込み→1品削除→再取込で復活しない(「削除済みの除外中1件」表示)→テーマ一覧の
//         「除外中1品・すべて戻す」で解除→再取込で復活する) /
//         FOCUS-MEMO-01(調理中モードの▽折りたたみメモが詳細画面と同じ小窓タップで開閉し、
//         「｜」改行・「・」箇条書きも小窓内で効くこと。2026-07-12 Fable裁定) /
//         PRICE-01(食材価格マスタ。材料に価格未入力のレシピでもマスタ目安価格が詳細の
//         概算食費・材料行の注記に反映され、マスタ編集に追従すること。2026-07-13
//         オーナー実機フィードバックで詳細画面の概算食費欄の「一部は目安価格から計算しています」
//         注記は削除(週の献立側は維持)したため、その不在も確認する) /
//         INLINE-01(「食材と価格」一覧の行内編集。2026-07-12 UX改修で編集モーダルを廃止し、
//         価格欄への直接入力+Enter/blurで即保存。2026-07-13 UI改善で「目安」/「自分の価格」
//         バッジは廃止したため「デフォルトに戻す」ボタンの出現/消失で編集反映を確認・
//         検索絞り込みを確認) /
//         合わせ調味料ライン表示 /
//         PRO-FALLBACK-01(crypto.subtleが使えないinsecure context(LAN実機のhttp://等)でも、
//         純JSのSHA-256フォールバック(src/logic/sha256.ts)でPro解錠コード検証が動くこと。
//         2026-07-13。他チェックが使う既存サーバーとは別に自前でpreviewサーバーをport 4194で
//         起動して検証する) /
//         MEALPLAN-01(献立タブ・週プランナー。第4波ペルソナPDCA・2026-07-13裁定:
//         週移動の中央チップが「今週へ戻る」ボタンとして機能しaria-labelが状態に応じて出し分けられる
//         こと(Fix1)・概算食費セクションは未割当時は非表示で割当後に表示されること(Fix3)・
//         ピッカー再オープンで現在レシピに「選択中」バッジが出ること(Fix4)・フィルタ/トグルの
//         aria-pressed(Fix5。2026-07-13更新: 新規ユーザーは既定で夕食のみaria-pressed=true)・
//         最後の食事帯フィルタを外そうとしたときの説明トースト(Fix6。同日更新: 既定が夕食のみに
//         なったため夕食を外そうとするパターンで検証)) /
//         MEALPLAN-02(献立タブ・月カレンダー。同波Fix2: 月移動の中央チップの「今月へ戻る」導線。
//         Pro解錠コード入力UI経由で解錠してから検証) /
//         MEALPLAN-03(献立タブ・主菜+副菜構成。2026-07-13 Fable設計: 各枠が既定で主菜+副菜の
//         2行になっていること・「＋枠を追加」で行を増やせること・行単位のサイコロは他の行に
//         影響しないこと・枠が丸ごと空のときのサイコロ/まとめて献立を立てるは主菜+副菜のペアで
//         埋まること・まとめて献立を立てるのアイコンがDicesであること) /
//         BACKUP-01(バックアップの全ユーザーデータ対応・2026-07-13データ堅牢性強化: 価格編集+
//         週献立割当+在庫品を実際の「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで
//         捕捉)で書き出し→まっさらな別プロファイルへ「読み込む(置き換え)」で復元し、
//         価格・週献立・在庫が実際に引き継がれることを確認。加えて、これらの項目が無い
//         旧形式のbackup JSONを、既に価格・在庫データのあるプロファイルへ読み込んでも
//         エラーにならず既存の価格・在庫データが消えない(後方互換)ことも確認する)。
//         console/pageerrorは全工程で監視(既知のCF計測CORSは除外)
import { chromium, webkit } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.join(__dirname, '..')

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

const errors = []
const results = []
let currentCheck = ''
const ok = (label) => results.push({ label, pass: true })
const ng = (label, detail) => results.push({ label, pass: false, detail })
const check = (label, cond, detail = '') => (cond ? ok(label) : ng(label, detail))
// タイマーの残り表示("08:24"や"1:05:00")を秒数に変換する(TIMER-ADJ-01/TIMER-CUSTOM-01用)
const parseRemainingSeconds = (text) => {
  const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return m[3] !== undefined
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2])
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

try {
  // --- SMK-01: 起動・初回シード ---
  currentCheck = 'SMK-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800) // 初回シード完了待ち
  const listText = await page.textContent('body')
  check('SMK-01 起動・基本レシピのシード', listText.includes('肉じゃが') && listText.includes('カレーライス'))

  // --- COUNT-01: 絞り込み無しでも一覧上部に総件数「全◯件」が常に表示される(2026-07-13 UI改善) ---
  currentCheck = 'COUNT-01'
  const allCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'COUNT-01 絞り込み無しで「全◯件」の総件数が表示される',
    (await page.textContent('body')).includes(`全${allCardCount}件`),
    `カード数=${allCardCount}`,
  )

  // --- QF-01: 絞り込み「時短レシピ」でカード件数が変わる(quickStepsを持つレシピだけに絞られる。
  // UI改善バッチ 2026-07-11。チップ文言は2026-07-13「時短」→「時短レシピ」に変更) ---
  currentCheck = 'QF-01'
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '時短レシピ', exact: true }).click()
  await page.waitForTimeout(400)
  const quickCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'QF-01 時短絞り込みで件数が変わる',
    quickCardCount > 0 && quickCardCount < allCardCount,
    `全件=${allCardCount} 時短=${quickCardCount}`,
  )
  check(
    'COUNT-01 絞り込み中は「結果件数 / 全件数」の形で表示される',
    (await page.textContent('body')).includes(`${quickCardCount}件 / 全${allCardCount}件`),
  )
  // 絞り込みを解除して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: '時短レシピ', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)

  // --- LAYOUT-01: 一覧の表示形式切替(グリッド/リスト。2026-07-13 UI改善)。settingsに保存され
  // リロード後(再訪)も維持されることを確認する ---
  currentCheck = 'LAYOUT-01'
  const layoutContainerInfo = () =>
    page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
        /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
      )
      const container = links[0]?.parentElement
      return { className: container?.className ?? '', count: links.length }
    })
  const layoutBefore = await layoutContainerInfo()
  check('LAYOUT-01 既定はグリッド表示', layoutBefore.className.includes('grid-cols-2'))
  await page.locator('button[aria-label="リスト表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterToList = await layoutContainerInfo()
  check(
    'LAYOUT-01 「リスト表示に切り替え」を押すと縦一列表示になる',
    layoutAfterToList.className.includes('flex-col') &&
      !layoutAfterToList.className.includes('grid-cols-2'),
  )
  check(
    'LAYOUT-01 リスト表示でもレシピ件数は変わらない',
    layoutAfterToList.count === layoutBefore.count,
    `グリッド=${layoutBefore.count} リスト=${layoutAfterToList.count}`,
  )
  // リスト表示の行がグリッドカードと同等の情報量を持つこと(2026-07-13 UI改善: 主要食材チップ・
  // 由来バッジ(基本レシピ)・タイトル2行折り返しをlist行にも追加)
  const listRowContent = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
      /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
    )
    return {
      anyChip: links.some((a) => a.querySelector('[style*="--chip-"]')),
      anyStarterBadge: links.some((a) => a.textContent?.includes('基本レシピ')),
      anyClampedTitle: links.some((a) => a.querySelector('p.line-clamp-2')),
    }
  })
  check('LAYOUT-01 リスト表示でも主要食材チップが見える', listRowContent.anyChip)
  check('LAYOUT-01 リスト表示でも由来バッジ(基本レシピ)が見える', listRowContent.anyStarterBadge)
  check(
    'LAYOUT-01 リスト表示でもタイトルが2行まで折り返す(line-clamp-2)',
    listRowContent.anyClampedTitle,
  )
  // リロードしても設定(settings.recipeListLayout)に保存されて維持されることを確認する
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const layoutAfterReload = await layoutContainerInfo()
  check(
    'LAYOUT-01 リロード後もリスト表示が維持される(settingsに保存)',
    layoutAfterReload.className.includes('flex-col'),
  )
  // グリッド表示に戻して以降のチェック(グリッド前提のセレクタ)に影響しないようにする
  await page.locator('button[aria-label="グリッド表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterBackToGrid = await layoutContainerInfo()
  check('LAYOUT-01 グリッド表示に戻せる', layoutAfterBackToGrid.className.includes('grid-cols-2'))

  // --- SORTDIR-01: 並べ替えの昇順/降順トグル(2026-07-13 UI改善)。「あいうえお順」を選ぶと
  // 既定で昇順(あ→ん)になり、「降順」を押すと並びがちょうど反転することを確認する ---
  currentCheck = 'SORTDIR-01'
  const cardTitles = () =>
    page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: 'あいうえお順', exact: true }).click()
  await page.waitForTimeout(300)
  const ascActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '昇順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SORTDIR-01 「あいうえお順」を選ぶと既定で昇順が選択される', ascActive)
  const ascTitles = await cardTitles()
  await page.getByRole('button', { name: '降順', exact: true }).click()
  await page.waitForTimeout(300)
  const descTitles = await cardTitles()
  check(
    'SORTDIR-01 「降順」を押すと並び順がちょうど反転する',
    ascTitles.length > 1 && JSON.stringify(descTitles) === JSON.stringify([...ascTitles].reverse()),
    `昇順=${JSON.stringify(ascTitles)} 降順=${JSON.stringify(descTitles)}`,
  )
  // 既定(更新順・降順)に戻して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: '更新順', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)

  // --- SMK-05: 人数変更で帯分数表示(2人分→3人分でじゃがいも3個→4と1/2個) ---
  currentCheck = 'SMK-05'
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.locator('button[aria-label="人数を増やす"]').click()
  await page.waitForTimeout(400)
  const detailText = await page.textContent('body')
  check('SMK-05 人数変更の帯分数スケール', detailText.includes('4と1/2個'), `「4と1/2個」が見つからない`)
  check('SMK-05 g系は整数のまま', detailText.includes('300g'), '牛こま300g(200g×1.5)が見つからない')

  // --- 合わせ調味料の色ライン(共通説明文の表示) ---
  check('合わせ調味料ヒント表示', detailText.includes('先にまとめて計量してOK'))

  // --- NUT-01: 栄養価のめやす(未解錠・無料)。肉じゃがの詳細を開いたまま検証する
  // (M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED=trueに前倒し有効化。エネルギー・食塩相当量の
  // 2項目は無料でも常時計算表示(2026-07-10バッチH-4)、残り3項目はPro案内にとどめる設計) ---
  currentCheck = 'NUT-01'
  check('NUT-01 栄養価のめやす見出しが閉じた状態から見える', detailText.includes('栄養価のめやす'))
  check('NUT-01 エネルギー(kcal)の概算が閉じた1行から見える', /\d+kcal/.test(detailText))
  check('NUT-01 塩分の概算が閉じた1行から見える', detailText.includes('塩分'))
  await page.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
  await page.waitForTimeout(300)
  const nutExpandedText = await page.textContent('body')
  check('NUT-01 展開すると断定しない「めやす」表記の注記が出る', nutExpandedText.includes('めやす'))
  check('NUT-01 出典表記がある', nutExpandedText.includes('出典'))
  check(
    'NUT-01 未解錠には月間献立と同じ「Pro版について見る」リンクが出る',
    nutExpandedText.includes('Pro版について見る'),
  )
  check(
    'NUT-01 未解錠案内にPro版で増える項目(たんぱく質・脂質・炭水化物)が明記される(2026-07-13 UIペルソナQA)',
    nutExpandedText.includes('Pro版では、たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウムのめやすも表示されます'),
  )
  await page.getByRole('button', { name: '栄養価のめやすを閉じる' }).click()
  await page.waitForTimeout(200)

  // --- TERM-01: 用語タップでポップオーバーが開き、外タップで閉じる(用語タップ辞書 2026-07-11)。
  // 肉じゃが手順1「玉ねぎはくし形に切る」の「くし形」をタップして説明を確認する ---
  currentCheck = 'TERM-01'
  await page.getByRole('button', { name: 'くし形切りの説明を見る' }).click()
  await page.waitForTimeout(300)
  // 説明文はMemoText描画(2026-07-12)で文節境界にZWSPが入るため、比較前に除去する
  const stripZwsp = (s) => s.replace(/\u200b/g, '')
  const termOpenText = stripZwsp(await page.textContent('body'))
  check('TERM-01 用語タップでポップオーバーが開く', termOpenText.includes('縦半分に切った玉ねぎ'))
  await page.mouse.click(5, 5) // ポップオーバーの外をタップ
  await page.waitForTimeout(300)
  const termClosedText = stripZwsp(await page.textContent('body'))
  check('TERM-01 外タップでポップオーバーが閉じる', !termClosedText.includes('縦半分に切った玉ねぎ'))

  // --- SMK-08(簡易): 調理中モードを開いて手順送り・閉じる ---
  currentCheck = 'SMK-08'
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  const focusText = await page.textContent('body')
  check('SMK-08 調理中モードが開く', focusText.includes('手順 1/'))
  await page.getByRole('button', { name: '次へ' }).click()
  await page.waitForTimeout(300)
  check('SMK-08 手順送り', (await page.textContent('body')).includes('手順 2/'))
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)

  // --- FOCUS-MEMO-01: 調理中モードの▽折りたたみメモをタップすると詳細画面と同じ小窓(ポップオーバー)で
  // 開く(2026-07-12 Fable裁定: 1手順を大きく見せる調理中モードでメモ全文の常時展開は本文を圧迫するため、
  // 詳細画面と挙動を統一)。「鶏の照り焼き」手順3の「▽たくさん作るとき」には「・」箇条書きと
  // 「｜」改行の両方が入っているため、これらが小窓の中でも効くことまで併せて確認する
  // (2026-07-13: 元は「蒸しなすの香味だれ」手順2で確認していたが、その▽内容は用語辞書「電子レンジ」への
  // 集約に伴い削除されたため、同じ構造(・箇条書き+｜改行)を持つ「鶏の照り焼き」に検証対象を差し替えた) ---
  currentCheck = 'FOCUS-MEMO-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('鶏の照り焼き')
  await page.waitForTimeout(300)
  await page.getByText('鶏の照り焼き', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '次へ' }).click() // 手順2へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順3(▽を含む手順)へ
  await page.waitForTimeout(300)
  const focusMemoFoldedText = await page.textContent('body')
  check(
    'FOCUS-MEMO-01 ▽はラベルのみ折りたたみ表示され詳細は隠れている',
    focusMemoFoldedText.includes('たくさん作るとき') &&
      !focusMemoFoldedText.includes('たれも回数に応じて分けて使う'),
  )
  // 詳細画面の手順リスト(FocusModeの背後にDOM上は残ったまま)にも同じ▽ボタンがあるため、
  // FocusModeの全画面オーバーレイ(.fixed.inset-0.z-50)側だけに絞って押す
  await page.locator('.fixed.inset-0.z-50').getByRole('button', { name: 'たくさん作るとき' }).click()
  await page.waitForTimeout(300)
  const focusMemoOpenText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 タップで小窓が開き詳細(1文目)が見える',
    focusMemoOpenText.includes('焼く→裏返す→たれをからめる'),
  )
  check(
    'FOCUS-MEMO-01 「｜」改行後の2文目も「・」箇条書きとして見える',
    focusMemoOpenText.includes('たれも回数に応じて分けて使う'),
  )
  await page.mouse.click(5, 5) // 小窓の外をタップ
  await page.waitForTimeout(300)
  const focusMemoClosedText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 外タップで小窓が閉じる',
    !focusMemoClosedText.includes('たれも回数に応じて分けて使う'),
  )
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)
  // この検索語が一覧の状態(sessionStorage)に残ったままだと、以降のテスト(戻る動線・スクロール系)が
  // 「鶏の照り焼き」だけの絞り込み一覧を前提に動いてしまい無関係な失敗を招くため、必ず消しておく
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- TAB-01: 詳細を開いたままリロード→下タブ「レシピ」で一覧へ戻れる ---
  // (覚えた「最後のレシピパス」＝現在地となりタップが無反応になる回帰の防止。2026-07-09第2波)
  currentCheck = 'TAB-01'
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('TAB-01 リロードで詳細が復元される', /#\/recipes\/\d+/.test(page.url()))
  await page.locator('nav').getByText('レシピ', { exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'TAB-01 リロード後もレシピタブで一覧へ戻れる',
    page.url().includes('#/recipes') && !/#\/recipes\/\d/.test(page.url()),
    `現在URL: ${page.url()}`,
  )

  // --- DET-01: 詳細の戻るボタンは、一覧以外の画面(ホーム)から来た場合でも常に一覧へ戻る ---
  // (ブラウザ履歴があると直前の画面に戻ってしまっていた不具合の再発防止。2026-07-10)
  currentCheck = 'DET-01'
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('a[href^="#/recipes/"]').first().click()
  await page.waitForTimeout(500)
  check('DET-01 ホームからレシピ詳細へ遷移', /#\/recipes\/\d+/.test(page.url()), `現在URL: ${page.url()}`)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01 詳細の戻るボタンは常に一覧へ(直前の画面(ホーム)には戻らない)',
    page.url().endsWith('#/recipes'),
    `現在URL: ${page.url()}`,
  )

  // --- SMK-04+02: テキスト貼り付け→登録 ---
  currentCheck = 'SMK-04'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('テキスト貼り付けで自動入力').click()
  await page.waitForTimeout(300)
  await page.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]').fill(
    'E2Eスモーク試験用レシピ\n\n材料（2人分）\n・にんじん　1本\n・しょうゆ　大さじ2\n\n作り方\n1. にんじんを切る\n2. 炒める',
  )
  await page.getByRole('button', { name: '自動で振り分ける' }).click()
  await page.waitForTimeout(300)
  const formText = await page.textContent('body')
  check('SMK-04 貼り付け整形の読み取り結果', formText.includes('材料2件・手順2件を読み取りました'))
  currentCheck = 'SMK-02'
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const savedText = await page.textContent('body')
  check('SMK-02 保存→詳細表示', savedText.includes('E2Eスモーク試験用レシピ') && savedText.includes('にんじん'))

  // --- SMK-03: 編集画面から削除(ダイアログは自動承諾) ---
  currentCheck = 'SMK-03'
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('SMK-03 削除が一覧に反映', !(await page.textContent('body')).includes('E2Eスモーク試験用レシピ'))

  // --- KW-01: 検索キーワード欄(keywords・2026-07-12バッチ)。一覧や詳細には表示されず、
  // 検索語に入力したときだけヒットすることを確認する ---
  currentCheck = 'KW-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eキーワード確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  const kwInput = page.getByPlaceholder('例: チンジャオロース、おつまみ など')
  await kwInput.fill('ずっきーにのひみつご')
  await kwInput.press('Enter') // タグと同じくEnterでチップ化(addKeyword)
  await page.waitForTimeout(200)
  const kwFormText = await page.textContent('body')
  check('KW-01 キーワードがチップとして追加される', kwFormText.includes('ずっきーにのひみつご'))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const kwDetailText = await page.textContent('body')
  check('KW-01 保存自体は成功する(詳細にタイトルが出る)', kwDetailText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 保存後の詳細画面にキーワード文字列が表示されない', !kwDetailText.includes('ずっきーにのひみつご'))

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('KW-01 一覧画面にもキーワード文字列が表示されない(検索前)', !(await page.textContent('body')).includes('ずっきーにのひみつご'))
  await page.locator('input[type="search"]').fill('ずっきーにのひみつご')
  await page.waitForTimeout(400)
  const kwSearchText = await page.textContent('body')
  check('KW-01 検索キーワードでレシピがヒットする', kwSearchText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 検索結果表示でもキーワード文字列自体は表示されない', !kwSearchText.includes('ずっきーにのひみつご'))

  // 検索語をクリアしておく(一覧の検索条件はsessionStorageに保存され、この後の一覧系チェックが
  // 同じpage/contextを使い回すため、絞り込んだままだと後続チェックの「a[href^="#/recipes/"]」の
  // querySelectorが0件ヒットの一覧で「＋(新規登録)」リンクを拾ってしまい誤検出になる)
  await page.locator('input[type="search"]').fill('')
  await page.waitForTimeout(400)

  // 後始末: 検証用に作成したレシピを削除
  await page.getByText('E2Eキーワード確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- DISHTYPE-01: レシピ種別チップ(主菜/副菜/汁物/デザート・任意選択。2026-07-13
  // 献立の主菜+副菜提案精度向上対応)。選択→保存→編集画面を開き直しても選択状態が
  // 保持される(DB保存の確認)こと、もう一度押すと解除できることを確認する ---
  currentCheck = 'DISHTYPE-01'
  const isChipActive = (locator) => locator.evaluate((el) => el.className.includes('border-accent'))
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E種別チップ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  const sideChip = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 保存前は「副菜」チップが未選択', !(await isChipActive(sideChip)))
  await sideChip.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 「副菜」チップをタップすると選択状態になる', await isChipActive(sideChip))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  check(
    'DISHTYPE-01 保存自体は成功する(詳細にタイトルが出る)',
    (await page.textContent('body')).includes('E2E種別チップ確認レシピ'),
  )
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  const sideChipEdit = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 編集画面を開き直しても選択状態が保持される(DB保存の確認)', await isChipActive(sideChipEdit))
  await sideChipEdit.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 もう一度押すと選択が解除される', !(await isChipActive(sideChipEdit)))

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- NUTSORT-01: 栄養並び替え(2026-07-13 Fable設計)。無料(未解錠)では「カロリー(1食)」だけが
  // 並べ替えに出て「たんぱく質(1食)」は出ない(Pro解錠時のみ)こと、カロリー順の既定は昇順で、
  // 栄養を算出できないレシピ(材料が成分表に名寄せできない自作レシピ)は昇順・降順どちらでも
  // 末尾に回ることを確認する ---
  currentCheck = 'NUTSORT-01'
  // 算出不能なレシピを1件作る(材料名が成分表のどの食品にも名寄せできない)
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E栄養並び替え確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('謎のたべもの')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('謎のたべものを盛り付ける')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  const nutSortPanelText = await page.textContent('body')
  check(
    'NUTSORT-01 並べ替えに「カロリー(1食)」が出る(栄養機能が有効なら無料でも表示)',
    nutSortPanelText.includes('カロリー(1食)'),
  )
  check(
    'NUTSORT-01 未解錠では「たんぱく質(1食)」は出ない(Pro解錠時のみ)',
    !nutSortPanelText.includes('たんぱく質(1食)'),
  )
  await page.getByRole('button', { name: 'カロリー(1食)', exact: true }).click()
  await page.waitForTimeout(500)
  const kcalAscActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '昇順')
    return target ? target.className.includes('border-accent') : false
  })
  check('NUTSORT-01 カロリー順の既定は昇順(低い方から)', kcalAscActive)
  const nutCardTitles = () =>
    page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
  const kcalAscTitles = await nutCardTitles()
  check(
    'NUTSORT-01 算出不能なレシピは昇順で末尾に回る',
    kcalAscTitles.length > 1 && kcalAscTitles[kcalAscTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
    `末尾=${kcalAscTitles[kcalAscTitles.length - 1]}`,
  )
  await page.getByRole('button', { name: '降順', exact: true }).click()
  await page.waitForTimeout(500)
  const kcalDescTitles = await nutCardTitles()
  check(
    'NUTSORT-01 降順でも算出不能なレシピは末尾のまま',
    kcalDescTitles.length > 1 &&
      kcalDescTitles[kcalDescTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
    `末尾=${kcalDescTitles[kcalDescTitles.length - 1]}`,
  )
  check(
    'NUTSORT-01 昇順と降順で先頭が入れ替わる(実際にカロリー順で並んでいる)',
    kcalAscTitles.length > 1 && kcalAscTitles[0] !== kcalDescTitles[0],
    `昇順先頭=${kcalAscTitles[0]} 降順先頭=${kcalDescTitles[0]}`,
  )
  // 後始末: 並べ替えを既定に戻してパネルを閉じ、検証用レシピを削除する
  await page.getByRole('button', { name: '更新順', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)
  await page.getByText('E2E栄養並び替え確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- SMK-14(簡易): 未解錠でのセット取り込みは丁寧にブロックされる ---
  currentCheck = 'SMK-14'
  await page.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check(
    'SMK-14 未解錠ゲート',
    (await page.textContent('body')).includes('追加レシピパックまたはPro版の解錠が必要'),
  )

  // --- SETTINGS-TAB-01: 設定画面のタブ分割(2026-07-12オーナー実機フィードバック)。
  // ?set=直リンクで開いたときに「レシピ」タブが自動で開くこと(「全般」タブの内容は隠れる)、
  // 4タブを手動で切り替えられること、?section=pro/?section=themesの直リンクも
  // 該当タブを自動で開くことを確認する。タブ名「基本」→「全般」は2026-07-13 UIペルソナQA ---
  currentCheck = 'SETTINGS-TAB-01'
  check(
    'SETTINGS-TAB-01 ?set=直リンクは「レシピ」タブを自動で開く(セット読み込みの見出しが見える)',
    (await page.textContent('body')).includes('レシピセットを読み込む'),
  )
  check(
    'SETTINGS-TAB-01 このとき「全般」タブの内容は隠れている(NG食材の見出しが見えない)',
    !(await page.textContent('body')).includes('NG食材（アレルギー・苦手）'),
  )
  // トースト化(2026-07-12: setMessage表示をページ上部固定からトーストに変更)。タップで閉じる。
  // 「追加レシピパックまたはPro版の解錠が必要」という語句自体はテーマ一覧の説明文にも登場するため、
  // トースト本文にしか出ない先頭部分「このレシピセットの追加には」で一意に狙う
  await page.getByRole('button', { name: 'このレシピセットの追加には' }).click()
  await page.waitForTimeout(200)
  check(
    'SETTINGS-TAB-01 トーストはタップで閉じる',
    !(await page.textContent('body')).includes('このレシピセットの追加には'),
  )

  // タブを手動で一通り切り替え、それぞれの代表コンテンツが出ることを確認する
  await page.getByRole('button', { name: '全般', exact: true }).click()
  await page.waitForTimeout(200)
  check(
    'SETTINGS-TAB-01 「全般」タブでNG食材の見出しが見える',
    (await page.textContent('body')).includes('NG食材（アレルギー・苦手）'),
  )
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click()
  await page.waitForTimeout(200)
  check(
    'SETTINGS-TAB-01 「バックアップ」タブで書き出しボタンが見える',
    (await page.textContent('body')).includes('ファイルに書き出す'),
  )
  await page.getByRole('button', { name: 'Pro・パック', exact: true }).click()
  await page.waitForTimeout(200)
  check(
    'SETTINGS-TAB-01 「Pro・パック」タブでPro版の見出しが見える',
    (await page.textContent('body')).includes('Pro版'),
  )

  // ?section=直リンクの自動タブ切り替え(既存のスクロール挙動は維持しつつ、タブ化後も動くことを確認)
  await page.goto(`${BASE}/#/settings?section=themes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check(
    'SETTINGS-TAB-01 ?section=themesは「レシピ」タブを自動で開く(テーマ一覧の見出しが見える)',
    (await page.textContent('body')).includes('テーマ一覧'),
  )
  await page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check(
    'SETTINGS-TAB-01 ?section=proは「Pro・パック」タブを自動で開く(Pro版の見出しが見える)',
    (await page.textContent('body')).includes('Pro版'),
  )
  check(
    'SETTINGS-TAB-01 ?section=proでは「全般」タブの内容が隠れている',
    !(await page.textContent('body')).includes('NG食材（アレルギー・苦手）'),
  )

  // --- TOAST-01: 設定操作の結果メッセージがトーストで表示され、数秒で自動的に消える
  // (2026-07-12オーナー実機フィードバック。以前はページ最上部固定でスクロールしないと見えなかった。
  // 自動非表示は2026-07-13 UIペルソナQAで4.5秒→6秒に延長) ---
  currentCheck = 'TOAST-01'
  await page.getByRole('button', { name: '全般', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('例: えび').fill('E2Eトースト確認食材')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'TOAST-01 NG食材追加でトーストが表示される',
    (await page.textContent('body')).includes('「E2Eトースト確認食材」を追加しました'),
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
  await page.getByRole('button', { name: 'お気に入りに追加' }).click()
  await page.waitForTimeout(300)
  check(
    'STARTER-RELOAD-01 肉じゃがをお気に入りに追加できる',
    await page.getByRole('button', { name: 'お気に入りを解除' }).isVisible(),
  )

  await page.goto(`${BASE}/#/settings?section=themes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '基本レシピを入れ直す', exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し完了のトーストが表示される',
    (await page.textContent('body')).includes('基本レシピを入れ直しました'),
  )

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し後もお気に入りのまま(ユーザーデータ保持)',
    await page.getByRole('button', { name: 'お気に入りを解除' }).isVisible(),
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
      await wkPage.getByRole('button', { name: '戻る' }).click()
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
      await wkPage.getByRole('button', { name: '戻る' }).click()
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
      const scrollBeforeOpen = await wkPage2.evaluate(() => window.scrollY)
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
      const scrollAfterOpen = await wkPage2.evaluate(() => window.scrollY)
      check(
        'LOG-01 窓を開いてもページのスクロール位置が変わらない',
        scrollAfterOpen === scrollBeforeOpen,
        `開く前=${scrollBeforeOpen} 開いた後=${scrollAfterOpen}`,
      )
      const dateBox = await wkPage2.locator('input[type="date"]').boundingBox()
      check(
        'LOG-01 日付入力が画面幅(375px)からはみ出さない',
        !!dateBox && dateBox.x >= 0 && dateBox.x + dateBox.width <= 375,
        `x=${dateBox?.x} width=${dateBox?.width}`,
      )
      // 窓(モーダル)の保存ボタンは「記録する」(過去記録を後から編集するときの「保存する」とは別物)
      await wkPage2.getByRole('button', { name: '記録する', exact: true }).click()
      await wkPage2.waitForTimeout(500)
      const savedText = await wkPage2.textContent('body')
      check('LOG-01 保存すると「作った記録」に反映される', savedText.includes('作った記録'))
    } finally {
      await wkBrowser2.close()
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
      await photoPage.locator('button[aria-label="人数を増やす"]').click()
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

      await photoPage.getByRole('button', { name: '記録する', exact: true }).click()
      await photoPage.waitForTimeout(500)
      const thumbButton = photoPage.locator('button[aria-label="写真を拡大表示"]').first()
      check('LOG-PHOTO-01 保存すると記録一覧にサムネイルが出る', await thumbButton.isVisible())

      await thumbButton.click()
      await photoPage.waitForTimeout(300)
      const viewerVisible = await photoPage
        .locator('div[role="dialog"][aria-label="写真を拡大表示"]')
        .isVisible()
        .catch(() => false)
      check('LOG-PHOTO-01 サムネイルをタップすると原寸表示の窓が開く', viewerVisible)
      await photoPage.keyboard.press('Escape')
      await photoPage.waitForTimeout(300)
      const viewerClosed = !(await photoPage
        .locator('div[role="dialog"][aria-label="写真を拡大表示"]')
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
    } finally {
      await photoBrowser.close()
    }
  }

  // --- NUT-02: 栄養価のめやす(Pro解錠済み)。5項目の実パネル(たんぱく質・脂質・炭水化物を含む)が
  // 出ること、人数を変えても「1人分」の値は変わらないこと(全量だけが連動する)を確認する。
  // 実際のPro解錠コード(UR-...)は販売台帳の原本なのでリポジトリにコミットできないため、
  // ここではsettings.proCodeをIndexedDBへ直接書き込んで「解錠済み」状態だけを再現する
  // (コード検証ロジック自体はscripts/test-logic.mjsで別途確認済み)。他チェックのPro状態に
  // 影響しないよう、専用のbrowser/contextで完結させる(M6-1 2026-07-12) ---
  currentCheck = 'NUT-02'
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
      await nutPage.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
      await nutPage.waitForTimeout(300)
      const unlockedText = await nutPage.textContent('body')
      check('NUT-02 Pro解錠済みでたんぱく質が表示される', unlockedText.includes('たんぱく質'))
      check('NUT-02 Pro解錠済みで脂質が表示される', unlockedText.includes('脂質'))
      check('NUT-02 Pro解錠済みで炭水化物が表示される', unlockedText.includes('炭水化物'))
      check('NUT-02 Pro解錠済みで塩分相当量が表示される', unlockedText.includes('塩分相当量'))
      // 2026-07-13 第2弾(オーナー承認): 食物繊維(g)・鉄(mg)・カルシウム(mg)の3項目とビタミン注記
      check('NUT-02 Pro解錠済みで食物繊維が表示される', unlockedText.includes('食物繊維'))
      check('NUT-02 Pro解錠済みで鉄がmg単位で表示される', /鉄\s*[\d,.]+\s*mg/.test(unlockedText))
      check('NUT-02 Pro解錠済みでカルシウムがmg単位で表示される', /カルシウム\s*[\d,.]+\s*mg/.test(unlockedText))
      check(
        'NUT-02 ビタミン非表示の注記が出る(文面はオーナー確定・一字一句)',
        unlockedText.includes('ビタミンは調理による損失が大きく、材料からの計算では実際と大きくズレやすいため表示していません'),
      )
      check('NUT-02 断定しない「概算」バッジが出る', unlockedText.includes('概算'))
      check('NUT-02 「1人分」の内訳がある', unlockedText.includes('1人分'))
      check('NUT-02 「全量」の内訳もある(人数連動)', unlockedText.includes('全量'))

      // 人数を変えても「1人分」のエネルギーは変わらない(servings連動の検算。全量側だけが連動する)
      const perMatchBefore = unlockedText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      await nutPage.locator('button[aria-label="人数を増やす"]').click()
      await nutPage.waitForTimeout(400)
      const afterServingsText = await nutPage.textContent('body')
      const perMatchAfter = afterServingsText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      check(
        'NUT-02 人数を変えても1人分のエネルギーは変わらない',
        !!perMatchBefore && !!perMatchAfter && perMatchBefore[1] === perMatchAfter[1],
        `変更前=${perMatchBefore?.[1]} 変更後=${perMatchAfter?.[1]}`,
      )

      // --- NUTSORT-02: 栄養並び替え(Pro解錠済み・2026-07-13 Fable設計)。
      // 「たんぱく質(1食)」が並べ替えの選択肢に出て、選ぶと既定が降順(多い方から)になることを
      // 確認する(無料側で出ないことはNUTSORT-01で検証済み)。NUT-02と同じ解錠済みcontextを使う ---
      currentCheck = 'NUTSORT-02'
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.locator('button[aria-label="絞り込み"]').click()
      await nutPage.waitForTimeout(300)
      const proSortPanelText = await nutPage.textContent('body')
      check(
        'NUTSORT-02 Pro解錠済みでは「たんぱく質(1食)」が並べ替えに出る',
        proSortPanelText.includes('たんぱく質(1食)'),
      )
      check(
        'NUTSORT-02 「カロリー(1食)」も引き続き出る',
        proSortPanelText.includes('カロリー(1食)'),
      )
      await nutPage.getByRole('button', { name: 'たんぱく質(1食)', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const proteinDescActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '降順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 たんぱく質順の既定は降順(多い方から)', proteinDescActive)
      const proteinTitles = await nutPage
        .locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold')
        .allTextContents()
      check(
        'NUTSORT-02 たんぱく質順でも一覧が表示される(console/pageerror監視でエラー0を担保)',
        proteinTitles.length > 0,
      )
    } finally {
      await nutBrowser.close()
    }
  }

  // --- PACK-01: Pro解錠済み(パック未解錠)のとき、追加レシピパックのコード入力欄がdisabledになり
  // 「パックコードの入力は不要です」の案内が出ること、Pro版の機能一覧が(解錠直後だけでなく)
  // 解錠中ずっと表示され続けることを確認する(2026-07-13 UI改善)。実際のPro解錠コードは
  // 販売台帳の原本なのでリポジトリにコミットできないため、NUT-02と同様settings.proCodeを
  // IndexedDBへ直接書き込んで「Pro解錠済み・パック未解錠」状態を再現する。他チェックのPro状態に
  // 影響しないよう、専用のbrowser/contextで完結させる ---
  currentCheck = 'PACK-01'
  {
    const packBrowser = await chromium.launch()
    const packContext = await packBrowser.newContext()
    const packPage = await packContext.newPage()
    packPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PACK-01] ${err.message}`)
    })
    try {
      await packPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await packPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await packPage.evaluate(async () => {
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
      await packPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await packPage.waitForTimeout(800)
      const packSectionText = await packPage.textContent('body')
      check(
        'PACK-01 Pro解錠済み時に「パックコードの入力は不要です」の案内が出る',
        packSectionText.includes('パックコードの入力は不要です'),
      )
      const packInputDisabled = await packPage
        .getByPlaceholder('解錠コード (例: UP-XXXX-XXXX)')
        .isDisabled()
      check('PACK-01 パックコード入力欄がdisabledになる', packInputDisabled)
      check(
        'PACK-01 Pro版の機能一覧が解錠中ずっと表示される(2026-07-13 UI改善: 一時表示から常設化)',
        packSectionText.includes('使えるようになった機能') && packSectionText.includes('並行調理ナビ'),
      )
    } finally {
      await packBrowser.close()
    }
  }

  // --- TOMB-01: 削除したセット品の再取込除外(トゥームストーン・2026-07-13 Fable設計)。
  // テーマ「高たんぱくごはん」(kintore・10品)を取り込む→1品(漬けるだけ味玉)を削除→
  // 再取込(#/settings?set=直リンク)しても復活せず「削除済みの除外中1件」と出る→
  // テーマ一覧の「除外中1品・すべて戻す」で解除(次の取込で戻る旨のトースト)→
  // もう一度取り込むと復活する、の一連を確認する。テーマ取り込みには追加レシピパック解錠が
  // 必要なため、NUT-02と同様settings.recipePackCodeをIndexedDBへ直接書き込んで再現する。
  // 他チェックの解錠状態・レシピに影響しないよう、専用のbrowser/contextで完結させる ---
  currentCheck = 'TOMB-01'
  {
    const tbBrowser = await chromium.launch()
    const tbContext = await tbBrowser.newContext()
    const tbPage = await tbContext.newPage()
    tbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TOMB-01] ${err.message}`)
    })
    // 削除確認・?set=直リンクの取り込み確認ダイアログを自動承諾する
    tbPage.on('dialog', (dialog) => dialog.accept())
    try {
      await tbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await tbPage.evaluate(async () => {
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
              recipePackCode: 'UP-E2E-TEST-ONLY',
              recipePackActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })

      // 1) テーマを取り込む(?set=直リンク。確認ダイアログは自動承諾)
      await tbPage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(2000)
      check(
        'TOMB-01 テーマの初回取り込み(10品追加)',
        (await tbPage.textContent('body')).includes('10件追加しました'),
      )

      // 2) 取り込んだうち1品(漬けるだけ味玉)を編集画面から削除する(確認ダイアログは自動承諾)
      await tbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(600)
      await tbPage.locator('input[type="search"]').fill('漬けるだけ味玉')
      await tbPage.waitForTimeout(400)
      await tbPage.getByText('漬けるだけ味玉', { exact: true }).first().click()
      await tbPage.waitForTimeout(500)
      await tbPage.locator('a[href*="/edit"]').first().click()
      await tbPage.waitForTimeout(500)
      await tbPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await tbPage.waitForTimeout(800)
      // 一覧の検索条件(sessionStorage)に検索語が残ると以降の一覧確認が絞り込まれたままになるため消す
      await tbPage.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

      // 3) 再取込しても復活せず、「削除済みの除外中1件」と表示される
      await tbPage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(2000)
      check(
        'TOMB-01 再取込の結果に「削除済みの除外中1件」が出る',
        (await tbPage.textContent('body')).includes('削除済みの除外中1件'),
      )
      await tbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(600)
      check(
        'TOMB-01 再取込しても削除した品は復活しない',
        !(await tbPage.textContent('body')).includes('漬けるだけ味玉'),
      )

      // 4) テーマ一覧の「除外中1品・すべて戻す」で解除→トーストで「次に取り込むと戻る」旨を案内
      await tbPage.goto(`${BASE}/#/settings?section=themes`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(1000)
      const restoreButton = tbPage.getByRole('button', { name: '除外中1品・すべて戻す' })
      check('TOMB-01 テーマ一覧に「除外中1品・すべて戻す」ボタンが出る', await restoreButton.isVisible())
      await restoreButton.click()
      await tbPage.waitForTimeout(400)
      check(
        'TOMB-01 解除すると「次にこのテーマを取り込むと戻ります」のトーストが出る',
        (await tbPage.textContent('body')).includes('次にこのテーマを取り込むと戻ります'),
      )
      check(
        'TOMB-01 解除後は「除外中」ボタンが消える',
        !(await restoreButton.isVisible().catch(() => false)),
      )

      // 5) もう一度取り込むと削除していた品が復活する
      await tbPage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(2000)
      check(
        'TOMB-01 解除後の再取込で1件追加される',
        (await tbPage.textContent('body')).includes('1件追加しました'),
      )
      await tbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tbPage.waitForTimeout(600)
      check(
        'TOMB-01 解除→再取込で削除した品が復活する',
        (await tbPage.textContent('body')).includes('漬けるだけ味玉'),
      )
    } finally {
      await tbBrowser.close()
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
  await page.getByRole('button', { name: '絞り込み' }).click()
  await page.waitForTimeout(200)
  // 並べ替えを既定の「更新順」から変える(URLに載らない絞り込みなので、これが復元できれば
  // filtersKey全体が保存・復元されていることの証明になる)
  await page.getByRole('button', { name: 'あいうえお順' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを閉じる
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
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(800)
  const s2ScrollAfter = await page.evaluate(() => window.scrollY)
  check(
    'SCROLL-02 詳細→戻るでスクロール位置が復元される(並べ替え変更中・PC Chrome相当)',
    Math.abs(s2ScrollAfter - s2ScrollBefore) < 60,
    `復元前=${s2ScrollBefore} 復元後=${s2ScrollAfter}`,
  )
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを再度開いて並べ替え状態を確認
  await page.waitForTimeout(200)
  const sortStillActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === 'あいうえお順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SCROLL-02 詳細→戻るで並べ替え条件(あいうえお順)も保持される', sortStillActive)
  await page.getByRole('button', { name: '絞り込み' }).click() // パネルを閉じる(後続チェックへの影響防止)
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
  const adjustOpenBtn = page.getByRole('button', { name: /のタイマーを調整/ })
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
    !(await page.getByRole('dialog', { name: 'タイマーを調整' }).isVisible().catch(() => false)),
  )

  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  const adjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  check('TIMER-ADJ-01 タイマー調整の窓が開く(「作った！」と同じ様式)', await adjustDialog.isVisible())
  const adjBeforeSec = parseRemainingSeconds(await adjustDialog.textContent())
  await adjustDialog.getByRole('button', { name: '+1分' }).click()
  await page.waitForTimeout(200)
  const adjAfterPlusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「+1分」で残り秒が約60秒増える',
    adjBeforeSec !== null && adjAfterPlusSec !== null && adjAfterPlusSec - adjBeforeSec >= 50,
    `押す前=${adjBeforeSec}s 押した後=${adjAfterPlusSec}s`,
  )
  await adjustDialog.getByRole('button', { name: '−30秒' }).click()
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
  // 「停止」でタイマーごと消えることも確認する(後続のTIMER-CUSTOM-01に影響を残さないための後片付けも兼ねる)
  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  await adjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)
  check(
    'TIMER-ADJ-01 「停止」でタイマーが常駐バーから消える',
    !(await adjustOpenBtn.isVisible().catch(() => false)),
  )

  // --- TIMER-CUSTOM-01: じぶんタイマー(自由な分数で始めるタイマー。同バッチ)。
  // レシピ詳細のBackHeaderにあるタイマーアイコン(入口A)から開き、既定3分→1分まで減らして起動する。
  // 続けて同じ調整窓で「−30秒」を重ねても残りが0未満にならない(即完了扱いにしない)ことも確認する ---
  currentCheck = 'TIMER-CUSTOM-01'
  await page.getByRole('button', { name: 'じぶんタイマーを開く' }).click()
  await page.waitForTimeout(300)
  const customDialog = page.getByRole('dialog', { name: 'じぶんタイマー' })
  // 残り時間の表示だけを拾うロケータ(ボタン文言「−30秒」等と紛れないよう、表示専用のspanをクラスで狙う)
  const customCounter = customDialog.locator('.tabular-nums')
  check(
    'TIMER-CUSTOM-01 じぶんタイマーの窓が開く(初回既定3分)',
    (await customDialog.textContent()).includes('3分'),
  )
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 分数ステッパー(±1分)で1分まで減らせる',
    (await customDialog.textContent()).includes('1分'),
  )
  // --- 秒刻み(2026-07-12オーナー実機フィードバック追加分)。±30秒・±10秒で分+秒表示になり、
  // 一往復(+30+10-30-10=±0)で1分ちょうどに戻ることを確認する(以降の起動値を60秒に保つため) ---
  await customDialog.getByRole('button', { name: '+30秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+30秒」で1分→1分30秒', (await customCounter.textContent()) === '1分30秒')
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+10秒」で1分30秒→1分40秒', (await customCounter.textContent()) === '1分40秒')
  await customDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−30秒」で1分40秒→1分10秒', (await customCounter.textContent()) === '1分10秒')
  await customDialog.getByRole('button', { name: '−10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−10秒」で1分10秒→1分ちょうどに戻る', (await customCounter.textContent()) === '1分')
  // 開始前の秒数も10秒未満にならない(floor挙動)。−1分→10秒未満は10秒で止まる。その後+30+10+10=+50秒で1分に戻す
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 開始前の秒数も10秒未満にならない(1分→10秒で床止め)', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: '−10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 10秒からさらに「−10秒」しても10秒のまま', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: '+30秒' }).click()
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 1分まで戻して開始する', (await customCounter.textContent()) === '1分')
  await customDialog.getByRole('button', { name: '開始' }).click()
  await page.waitForTimeout(400)
  const customBarText = await page.textContent('body')
  check(
    'TIMER-CUSTOM-01 じぶんタイマーが起動する(常駐バーに「じぶんタイマー」表示)',
    customBarText.includes('じぶんタイマー'),
  )
  await page.getByRole('button', { name: /のタイマーを調整/ }).click()
  await page.waitForTimeout(300)
  const customAdjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(150)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 1分-30秒-30秒=0
  await page.waitForTimeout(150)
  const atFloorText = await customAdjustDialog.textContent()
  check('TIMER-CUSTOM-01 「−30秒」を重ねても残りは0で止まる', atFloorText.includes('00:00'), atFloorText)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 0からさらに押しても0のまま
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 0からさらに「−30秒」しても0のまま(即完了扱いにしない)',
    (await customAdjustDialog.textContent()).includes('00:00'),
  )
  await customAdjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)

  // --- PRICE-01: 食材価格マスタ(「食材と価格」画面。docs/20 §3)。
  // 材料に価格を入力していないレシピでも、マスタの目安価格が詳細の概算食費に反映され、
  // マスタの価格を編集すると反映結果も追従することを確認する。
  // 2026-07-12 UX改修で編集モーダルを廃止し一覧の行内編集に変わったため、操作手順もそれに合わせた ---
  currentCheck = 'PRICE-01'
  // テスト用レシピ: 材料に価格を入力せず、マスタ初期値がある「玉ねぎ」だけを使う
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E価格マスタ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('玉ねぎ')
  await page.getByPlaceholder('例: 3').first().fill('1')
  await page.getByPlaceholder('例: 個').first().fill('個')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('切る')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const priceDetailBefore = await page.textContent('body')
  check(
    'PRICE-01 マスタ初期値(玉ねぎ1個50円)が価格未入力の詳細の概算食費に反映される',
    priceDetailBefore.includes('約50円'),
  )
  check(
    'PRICE-01 詳細画面の概算食費欄にはマスタ由来の注記が出ない' +
      '(2026-07-13 オーナー実機フィードバックで削除。週の献立側は維持)',
    !priceDetailBefore.includes('一部は目安価格から計算しています'),
  )
  check(
    'PRICE-01 材料行にも目安価格由来の注記が出る(2026-07-12 UX改修)',
    priceDetailBefore.includes('（目安50円）'),
  )

  // 設定から「食材と価格」を開き、初期値30件の投入と目安の注意書きを確認する。
  // 「食材と価格を編集する」リンクは既定タブ「全般」のNG食材の直下にある
  // (2026-07-13 UI改善で「レシピ」タブから移動)ため、タブ切り替え不要でそのまま開ける
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: '食材と価格を編集する' }).click()
  await page.waitForTimeout(500)
  check('PRICE-01 設定からの遷移でタイトルが表示される', page.url().includes('#/prices'))
  const priceListBefore = await page.textContent('body')
  check(
    'PRICE-01 初期値が投入されている(玉ねぎ・鶏もも肉を含む)',
    priceListBefore.includes('玉ねぎ') && priceListBefore.includes('鶏もも肉'),
  )
  check('PRICE-01 目安価格の注意書きが表示される', priceListBefore.includes('価格は目安です'))

  // --- INLINE-01: 一覧の行内編集(2026-07-12 UX改修)。玉ねぎの行を名前で特定し、
  // 編集ボタン・別窓を経由せず、価格欄に直接入力してEnter(=blur)で即保存できることを確認する。
  // 2026-07-13 UI改善で「目安」/「自分の価格」バッジは廃止したため、ここでは
  // 「デフォルトに戻す」ボタンの出現/消失(=上書き済みかどうか)で編集反映を確認する ---
  currentCheck = 'INLINE-01'
  const onionRow = page.locator('li', { hasText: '玉ねぎ' })
  check(
    'INLINE-01 初期状態(未編集)では「デフォルトに戻す」ボタンが出ない',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  const onionPriceInput = onionRow.getByLabel('玉ねぎの価格（円）')
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter') // Enterでblur→保存(モーダル・保存ボタンを経由しない)
  await page.waitForTimeout(400)
  const onionRowTextAfterEdit = await onionRow.textContent()
  check('INLINE-01 編集後は「デフォルトに戻す」ボタンが出る', onionRowTextAfterEdit.includes('デフォルトに戻す'))
  check(
    'INLINE-01 価格入力欄の値が999のまま保持される(再マウントで飛ばない)',
    (await onionPriceInput.inputValue()) === '999',
  )

  // 検索/絞り込み: 存在しない食材名で0件表示になることを確認してから解除する
  const searchInput = page.getByPlaceholder('食材名で絞り込む')
  await searchInput.fill('ぜったいにないよみとうしょくざい')
  await page.waitForTimeout(300)
  check(
    'INLINE-01 検索で該当なしのメッセージが出る',
    (await page.textContent('body')).includes('該当する食材が見つかりません'),
  )
  await searchInput.fill('')
  await page.waitForTimeout(300)

  // 詳細画面に戻り、編集後の価格が概算食費・材料行の注記に反映されることを確認する。
  // 由来種別の出し分け(2026-07-13 UIペルソナQA): ユーザーが上書きした価格なので
  // 「目安」の語は付かず「（999円）」になる(「（目安999円）」にはならない)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfter = await page.textContent('body')
  check(
    'PRICE-01 マスタ編集後、詳細の概算食費が更新される(約999円)',
    priceDetailAfter.includes('約999円'),
  )
  check(
    'INLINE-01 上書き価格由来の行は「目安」を外した注記になる(（999円）)',
    priceDetailAfter.includes('（999円）') && !priceDetailAfter.includes('（目安999円）'),
  )

  // 「デフォルトに戻す」で投入時の価格に復元できることを確認する
  await page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const onionRowAgain = page.locator('li', { hasText: '玉ねぎ' })
  await onionRowAgain.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
  await page.waitForTimeout(400)
  const onionRowTextAfterReset = await onionRowAgain.textContent()
  check(
    'INLINE-01 「デフォルトに戻す」後はボタンが再び消える(未編集扱いに戻る)',
    !onionRowTextAfterReset.includes('デフォルトに戻す'),
  )
  check(
    'INLINE-01 「デフォルトに戻す」で価格が50円に戻る',
    (await onionRowAgain.getByLabel('玉ねぎの価格（円）').inputValue()) === '50',
  )

  // 目安に戻した後は、詳細の注記も「目安」表記に戻ることを確認する(由来種別の往復)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  check(
    'INLINE-01 「目安に戻す」後は詳細の注記も「目安」表記に戻る(（目安50円）)',
    (await page.textContent('body')).includes('（目安50円）'),
  )

  // 後始末: テスト用レシピを削除（削除は詳細画面からなので、いったんレシピ詳細に戻る）
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- MEALPLAN-01: 献立タブ・週プランナー(第4波ペルソナPDCA Fix1/3/4/5/6。まっさらプロファイル
  // で検証するため専用browser/contextを使う)。
  // Fix1: 週移動の中央チップ(以前は無ラベルの地の文だった)は、当週表示中はaria-labelなし、
  //       当週以外を見ているときだけaria-label(今週へ戻る)が付く「戻るボタン」になっていること
  // Fix3: 何も割り当てていない週は概算食費セクションが非表示、割り当てると表示されること
  // Fix4: 埋まった枠のピッカーを再度開くと、現在のレシピの行に「選択中」バッジが出ること
  // Fix5: 食事帯フィルタ・時短優先トグル・週/月トグルにaria-pressedが付くこと(見た目は変更なし)
  // Fix6: 最後の1つの食事帯フィルタを外そうとすると無反応ではなく説明トーストが出ること ---
  currentCheck = 'MEALPLAN-01'
  {
    const mpBrowser = await chromium.launch()
    const mpContext = await mpBrowser.newContext()
    const mpPage = await mpContext.newPage()
    mpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-01] ${text}`)
    })
    mpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-01] ${err.message}`)
    })
    try {
      await mpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mpPage.waitForTimeout(1800) // 初回シード完了待ち

      // Fix3: まっさらプロファイル・未割当時は概算食費セクションが無い
      const mpEmptyText = await mpPage.textContent('body')
      check(
        'MEALPLAN-01(Fix3) 未割当時は概算食費セクションが無い',
        !mpEmptyText.includes('今週の概算食費'),
      )

      // Fix1: 週移動の中央チップ。まず当週表示中はaria-labelが無いことを確認
      const weekCenterBtn = mpPage.locator('button', { hasText: '〜' }).first()
      const weekTextAtCurrent = (await weekCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-01(Fix1) 当週表示中は中央チップにaria-labelが無い',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )
      await mpPage.locator('button[aria-label="次の週"]').click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 「次の週」で来週へ→中央チップにaria-label(今週へ戻る)が付く',
        (await weekCenterBtn.getAttribute('aria-label')) === '今週へ戻る',
      )
      await weekCenterBtn.click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 中央チップをタップすると当週へ戻る(日付レンジが元に戻る)',
        (await weekCenterBtn.textContent())?.trim() === weekTextAtCurrent,
      )
      check(
        'MEALPLAN-01(Fix1) 当週へ戻った後は中央チップのaria-labelが再び消える',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )

      // Fix4+Fix3: 空き枠に「肉じゃが」を割り当てる(ピッカー経由)
      await mpPage.getByText('未定', { exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      check('MEALPLAN-01(Fix4) ピッカーが開く', (await mpPage.textContent('body')).includes('レシピを選ぶ'))
      await mpPage.getByPlaceholder('レシピ名で絞り込み').fill('肉じゃが')
      await mpPage.waitForTimeout(300)
      await mpPage.getByText('肉じゃが', { exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      const mpAssignedText = await mpPage.textContent('body')
      check('MEALPLAN-01(Fix3) 割り当てると概算食費セクションが出る', mpAssignedText.includes('今週の概算食費'))
      const costMatch = mpAssignedText.match(/約([\d,]+)円/)
      check(
        'MEALPLAN-01(Fix3) 表示された概算食費は0円ではない',
        !!costMatch && Number(costMatch[1].replace(/,/g, '')) > 0,
        `costMatch=${costMatch?.[0]}`,
      )

      // Fix4: 埋まった枠を再度開くと現在のレシピ行に「選択中」バッジが出る
      await mpPage.getByRole('button', { name: '肉じゃが' }).first().click()
      await mpPage.waitForTimeout(400)
      const currentPickRow = mpPage.locator('li', { hasText: '選択中' })
      check('MEALPLAN-01(Fix4) 「選択中」バッジが出る', await currentPickRow.isVisible())
      check(
        'MEALPLAN-01(Fix4) 「選択中」バッジは現在のレシピ(肉じゃが)の行に付く',
        (await currentPickRow.textContent())?.includes('肉じゃが'),
      )
      await mpPage.locator('button[aria-label="閉じる"]').click()
      await mpPage.waitForTimeout(300)

      // Fix5: aria-pressed(見た目は変更しない)
      const quickToggleBtn = mpPage.getByRole('button', { name: '自動提案は時短レシピ優先' })
      check('MEALPLAN-01(Fix5) 時短優先トグルは既定でaria-pressed=false', (await quickToggleBtn.getAttribute('aria-pressed')) === 'false')
      await quickToggleBtn.click()
      await mpPage.waitForTimeout(200)
      check('MEALPLAN-01(Fix5) 時短優先トグルON後はaria-pressed=true', (await quickToggleBtn.getAttribute('aria-pressed')) === 'true')
      await quickToggleBtn.click() // 元に戻す
      await mpPage.waitForTimeout(200)
      const breakfastFilterBtn = mpPage.getByRole('button', { name: '朝食', exact: true })
      const lunchFilterBtn = mpPage.getByRole('button', { name: '昼食', exact: true })
      const dinnerFilterBtn = mpPage.getByRole('button', { name: '夕食', exact: true })
      // 2026-07-13更新: 新規ユーザーの既定表示食事帯は「夕食のみ」(オーナー判断・プレッシャー軽減)。
      // まっさらプロファイルで検証しているこのテストでは朝食/昼食=false、夕食=trueが既定になる
      check(
        'MEALPLAN-01(Fix5・2026-07-13更新) 食事帯フィルタは新規ユーザーの既定で夕食だけaria-pressed=true',
        (await breakfastFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await lunchFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )
      const weekToggleBtn = mpPage.getByRole('button', { name: '週', exact: true })
      const monthToggleBtn = mpPage.getByRole('button', { name: '月', exact: true })
      check('MEALPLAN-01(Fix5) 週/月トグルにもaria-pressedが付く(週表示中はtrue/false)', (await weekToggleBtn.getAttribute('aria-pressed')) === 'true' && (await monthToggleBtn.getAttribute('aria-pressed')) === 'false')

      // Fix6(2026-07-13更新): 既定で夕食だけが表示中なので、その最後の1つを外そうとすると
      // 説明トーストが出て外れないことを直接確認する(以前は昼食/夕食を手動で外して朝食だけに
      // してから検証していたが、新既定で夕食のみのため不要になった)
      await dinnerFilterBtn.click() // 最後の1つ(夕食)を外そうとする
      await mpPage.waitForTimeout(300)
      check(
        'MEALPLAN-01(Fix6) 最後の1枠(夕食)を外そうとすると説明トーストが出る',
        (await mpPage.textContent('body')).includes('少なくとも1つの食事帯は表示します'),
      )
      check(
        'MEALPLAN-01(Fix6) 夕食フィルタは外れずaria-pressed=trueのまま',
        (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )
    } finally {
      await mpBrowser.close()
    }
  }

  // --- MEALPLAN-02: 献立タブ・月カレンダー(第4波ペルソナPDCA Fix2)。Pro解錠(実際のコード入力UI経由)
  // →月表示→「前の月」→中央チップにaria-label(今月へ戻る)→タップで当月へ戻ることを確認する。
  // Pro解錠はPRO-FALLBACK-01と同じテスト用コード(docs/22記載・販売用ではない)を使う ---
  currentCheck = 'MEALPLAN-02'
  {
    const mp2Browser = await chromium.launch()
    const mp2Context = await mp2Browser.newContext()
    const mp2Page = await mp2Context.newPage()
    mp2Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-02] ${text}`)
    })
    mp2Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-02] ${err.message}`)
    })
    try {
      await mp2Page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(1500)
      await mp2Page.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)').fill('UR-96QS-2VSZ')
      await mp2Page.getByRole('button', { name: '解錠する', exact: true }).first().click()
      await mp2Page.waitForTimeout(1000)
      check(
        'MEALPLAN-02 前提: Pro解錠が成功する',
        (await mp2Page.textContent('body')).includes('Pro版をご利用いただきありがとうございます'),
      )

      await mp2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02 前提: Pro解錠済みで月カレンダーが開く(ゲートでない)',
        !(await mp2Page.textContent('body')).includes('月間表示はPro版の機能です'),
      )

      const monthCenterBtn = mp2Page.locator('button').filter({ hasText: '/' }).first()
      const monthTextAtCurrent = (await monthCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-02(Fix2) 当月表示中は中央チップにaria-labelが無い',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )
      await mp2Page.locator('button[aria-label="前の月"]').click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 「前の月」で先月へ→中央チップにaria-label(今月へ戻る)が付く',
        (await monthCenterBtn.getAttribute('aria-label')) === '今月へ戻る',
      )
      await monthCenterBtn.click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 中央チップをタップすると当月へ戻る(年月表示が元に戻る)',
        (await monthCenterBtn.textContent())?.trim() === monthTextAtCurrent,
      )
      check(
        'MEALPLAN-02(Fix2) 当月へ戻った後は中央チップのaria-labelが再び消える',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )
    } finally {
      await mp2Browser.close()
    }
  }

  // --- MEALPLAN-03: 献立タブ・主菜+副菜構成(2026-07-13 Fable設計・オーナー要望。まっさら
  // プロファイルで検証するため専用browser/contextを使う)。
  // ・各枠は既定で「主菜」「副菜」の2行(未定×2)が並ぶこと
  // ・行単位のサイコロは対象の役割の行だけに作用する(枠が部分的に埋まっているとき)こと
  // ・枠が丸ごと空のときのサイコロは主菜+副菜のペアで一度に埋まること
  // ・「＋枠を追加」で行を増やせること
  // ・ジャンルチップ(指定なし/和食/洋食/中華)が単一選択で切り替わること
  // ・「まとめて献立を立てる」ボタンにDicesアイコンが付くこと(Sparklesから変更) ---
  currentCheck = 'MEALPLAN-03'
  {
    const mp3Browser = await chromium.launch()
    const mp3Context = await mp3Browser.newContext()
    const mp3Page = await mp3Context.newPage()
    mp3Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-03] ${text}`)
    })
    mp3Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-03] ${err.message}`)
    })
    try {
      await mp3Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp3Page.waitForTimeout(1800) // 初回シード完了待ち(この時点で表示食事帯は既定の「夕食のみ」)

      // 各枠は既定で主菜+副菜の2行(未定×2)。既定表示は夕食のみなので7日×2行=14件
      check(
        'MEALPLAN-03 各枠は既定で主菜+副菜の2行(未定×2)が並ぶ',
        (await mp3Page.getByText('未定', { exact: true }).count()) === 14,
      )
      check(
        'MEALPLAN-03 行に「主菜」「副菜」のラベルが付く(7日分ずつ)',
        (await mp3Page.getByText('主菜', { exact: true }).count()) === 7 &&
          (await mp3Page.getByText('副菜', { exact: true }).count()) === 7,
      )

      // 「まとめて献立を立てる」ボタンにアイコン(svg)が付く(SparklesからDicesへ変更。2026-07-13)
      const fillWeekBtn = mp3Page.getByRole('button', { name: 'まとめて献立を立てる' })
      check(
        'MEALPLAN-03 「まとめて献立を立てる」ボタンにアイコンが付く',
        (await fillWeekBtn.locator('svg').count()) > 0,
      )

      // ジャンルチップ(指定なし/和食/洋食/中華)は単一選択
      const anyGenreBtn = mp3Page.getByRole('button', { name: '指定なし', exact: true })
      const japaneseGenreBtn = mp3Page.getByRole('button', { name: '和食', exact: true })
      check(
        'MEALPLAN-03 ジャンルチップは既定で「指定なし」がaria-pressed=true',
        (await anyGenreBtn.getAttribute('aria-pressed')) === 'true',
      )
      await japaneseGenreBtn.click()
      await mp3Page.waitForTimeout(200)
      check(
        'MEALPLAN-03 ジャンルチップ「和食」を選ぶと単一選択で「指定なし」が外れる',
        (await japaneseGenreBtn.getAttribute('aria-pressed')) === 'true' &&
          (await anyGenreBtn.getAttribute('aria-pressed')) === 'false',
      )
      await anyGenreBtn.click() // 以降の提案テストに影響しないよう「指定なし」に戻す
      await mp3Page.waitForTimeout(200)

      // 「高たんぱく優先」トグルが表示される
      const highProteinBtn = mp3Page.getByRole('button', { name: '高たんぱく優先', exact: true })
      check(
        'MEALPLAN-03 「高たんぱく優先」トグルは既定でaria-pressed=false',
        (await highProteinBtn.getAttribute('aria-pressed')) === 'false',
      )

      // 先頭の日(月曜)・夕食の主菜行(先頭の「未定」)に「肉じゃが」をピッカーで割り当てる
      await mp3Page.getByText('未定', { exact: true }).first().click()
      await mp3Page.waitForTimeout(400)
      await mp3Page.getByPlaceholder('レシピ名で絞り込み').fill('肉じゃが')
      await mp3Page.waitForTimeout(300)
      await mp3Page.getByText('肉じゃが', { exact: true }).first().click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03 主菜行に肉じゃがを割り当てられる',
        await mp3Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      check(
        'MEALPLAN-03 割り当て後は「未定」が1件減る(14→13)',
        (await mp3Page.getByText('未定', { exact: true }).count()) === 13,
      )

      // 行単位のサイコロ: 月曜の副菜行(2番目のサイコロ。主菜が埋まっているので枠は
      // 「丸ごと空」ではない)だけを振ると、副菜だけ埋まり主菜(肉じゃが)は変わらない
      const diceButtons = mp3Page.getByRole('button', { name: 'この行にレシピを自動提案する' })
      await diceButtons.nth(1).click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜だけ自動提案しても主菜(肉じゃが)は変わらない',
        await mp3Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      const afterRowDiceEmptyCount = await mp3Page.getByText('未定', { exact: true }).count()
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜行が埋まり「未定」がさらに1件減る(13→12)',
        afterRowDiceEmptyCount === 12,
        `count=${afterRowDiceEmptyCount}`,
      )

      // 空き枠のペア提案: 火曜の夕食は主菜・副菜ともまだ未定→3番目のサイコロ(火曜の主菜行)を
      // 振ると、枠が丸ごと空だったため主菜+副菜のペアで一度に埋まる(未定が2件減る)
      await diceButtons.nth(2).click()
      await mp3Page.waitForTimeout(400)
      const afterPairEmptyCount = await mp3Page.getByText('未定', { exact: true }).count()
      check(
        'MEALPLAN-03(空き枠のペア提案) サイコロ1回で主菜+副菜の両方が埋まる(未定が2件減る)',
        afterRowDiceEmptyCount - afterPairEmptyCount === 2,
        `before=${afterRowDiceEmptyCount} after=${afterPairEmptyCount}`,
      )

      // ＋枠を追加: 水曜(3番目の「＋枠を追加」ボタン。まだ未着手の日)で主菜をもう1行追加すると
      // 「未定」が1件増える
      const addRowButtons = mp3Page.getByRole('button', { name: '＋枠を追加' })
      await addRowButtons.nth(2).click()
      await mp3Page.waitForTimeout(200)
      await mp3Page.getByRole('button', { name: '主菜', exact: true }).click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03(＋枠を追加) 行を追加すると「未定」が1件増える',
        (await mp3Page.getByText('未定', { exact: true }).count()) === afterPairEmptyCount + 1,
      )
    } finally {
      await mp3Browser.close()
    }
  }

  // --- SMK-19: 静的ページ(/about/配下・/sets/)がSW有効でも200でアプリ本体にすり替わらない ---
  // アプリ本体のtitleは「うちレシピ」単独。静的ページは必ず「◯◯｜うちレシピ」形式のtitleを持つ
  currentCheck = 'SMK-19'
  const staticPages = [
    ['/about/', 'うちレシピについて'],
    ['/about/terms.html', '利用規約'],
    ['/about/column/', 'コラム'],
    ['/about/column/kondate-kimaranai.html', '献立が決められない'],
    ['/about/column/recipe-screenshot-seiri.html', 'スクショ'],
    ['/sets/', 'レシピセット'],
  ]
  for (const [path, titleKeyword] of staticPages) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const title = await page.title()
    check(
      `SMK-19 静的ページ ${path}`,
      res.status() === 200 && title.includes(titleKeyword),
      `status=${res.status()} title=「${title}」`,
    )
  }

  // --- BACKUP-01: バックアップの全ユーザーデータ対応(在庫・買い物メモ・週献立・今日の献立・
  // 食材価格マスタ。2026-07-13 データ堅牢性強化)。価格編集+週献立割当+在庫品を実際の
  // 「バックアップ」タブ→「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで捕捉)で
  // 書き出し、まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元して
  // 実際に引き継がれることを確認する。加えて、これらの項目が無い旧形式のbackup JSONを
  // 既に価格・在庫データのあるプロファイルへ読み込んでもエラーにならず既存データが消えない
  // (後方互換)ことも確認する。他チェックへの影響を避けるため専用のbrowser/contextで完結させる。
  // 週献立・在庫ボード自体のUI操作はMEALPLAN-01〜03/INLINE-01等で別途カバー済みのため、
  // ここでは前提データの用意にIndexedDBへの直接書き込みを使い、バックアップ機構そのものの
  // 往復検証(実際のエクスポート/インポートUI経由)に的を絞る ---
  currentCheck = 'BACKUP-01'
  {
    let downloadedJson = ''

    // 1)〜3) 書き出し元プロファイル: 価格を1件編集・週献立に1枠割当・在庫に1品を用意し、
    // 実際の「ファイルに書き出す」ボタンでバックアップJSONを書き出す
    const srcBrowser = await chromium.launch()
    try {
      const srcContext = await srcBrowser.newContext({ acceptDownloads: true })
      const srcPage = await srcContext.newPage()
      srcPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(書き出し元)] ${err.message}`)
      })
      srcPage.on('dialog', (dialog) => dialog.accept())
      await srcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(1800) // 初回シード完了待ち

      // 価格を1件編集(玉ねぎ→888円。「食材と価格」一覧の行内編集を実際のUIで行う)
      await srcPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      const srcOnionPriceInput = srcPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      await srcOnionPriceInput.fill('888')
      await srcOnionPriceInput.press('Enter')
      await srcPage.waitForTimeout(400)

      // 週献立に1枠割当・在庫に1品(IndexedDBへ直接書き込み。理由は上のコメントの通り)
      const setup = await srcPage.evaluate(async () => {
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
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['mealPlans', 'pantryItems'], 'readwrite')
          tx.objectStore('mealPlans').add({ date: '2026-07-20', slot: 'dinner', recipeId, role: 'main' })
          tx.objectStore('pantryItems').add({ name: 'E2Eバックアップ確認在庫', level: 'have', isFrequent: true })
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
        return { recipeId }
      })
      check('BACKUP-01 前提: 割当先レシピIDを取得できた', typeof setup.recipeId === 'number')

      // 「バックアップ」タブ→「ファイルに書き出す」で実際に書き出す
      await srcPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      await srcPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await srcPage.waitForTimeout(300)
      const [download] = await Promise.all([
        srcPage.waitForEvent('download'),
        srcPage.getByRole('button', { name: 'ファイルに書き出す' }).click(),
      ])
      downloadedJson = readFileSync(await download.path(), 'utf-8')
      const exported = JSON.parse(downloadedJson)
      const exportedOnion = (exported.prices ?? []).find((p) => p.name === '玉ねぎ')
      check(
        'BACKUP-01 書き出しJSONに編集後の価格(玉ねぎ888円)が含まれる',
        exportedOnion?.pricePerUnit === 888,
        `exportedOnion=${JSON.stringify(exportedOnion)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに割り当てた週献立の枠が含まれる',
        (exported.mealPlans ?? []).some(
          (m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.recipeId === setup.recipeId,
        ),
        `mealPlans=${JSON.stringify(exported.mealPlans)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに追加した在庫品が含まれる',
        (exported.pantryItems ?? []).some((p) => p.name === 'E2Eバックアップ確認在庫'),
      )
      check(
        'BACKUP-01 書き出しJSONの新規5テーブルはid(自動採番)を含まない(復元先で振り直すため)',
        ['pantryItems', 'shoppingItems', 'mealPlans', 'todayList', 'prices'].every((key) =>
          (exported[key] ?? []).every((row) => !('id' in row)),
        ),
      )
    } finally {
      await srcBrowser.close()
    }

    // 4) まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元する
    const dstBrowser = await chromium.launch()
    try {
      const dstContext = await dstBrowser.newContext()
      const dstPage = await dstContext.newPage()
      dstPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(復元先)] ${err.message}`)
      })
      dstPage.on('dialog', (dialog) => dialog.accept())
      await dstPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(1800) // 初回シード完了待ち(まっさらな別プロファイル)
      await dstPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      await dstPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await dstPage.waitForTimeout(300)
      const [fileChooser] = await Promise.all([
        dstPage.waitForEvent('filechooser'),
        dstPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click(),
      ])
      await fileChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(downloadedJson, 'utf-8'),
      })
      await dstPage.waitForTimeout(800)
      const dstMessage = await dstPage.textContent('body')
      check('BACKUP-01 復元後に成功メッセージが出る(エラーにならない)', dstMessage.includes('品のレシピを読み込みました'))
      check('BACKUP-01 復元後にエラーメッセージは出ない', !dstMessage.includes('ファイルを読み込めませんでした'))

      // 価格が実際に復元されたことをUIで確認する(玉ねぎ888円)
      await dstPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      const dstOnionPriceInput = dstPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      check('BACKUP-01 価格編集(玉ねぎ888円)が復元される', (await dstOnionPriceInput.inputValue()) === '888')

      // 週献立・在庫が実際に復元されたことをIndexedDBで直接確認する
      const restored = await dstPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const [mealPlans, pantryItems] = await Promise.all([getAll('mealPlans'), getAll('pantryItems')])
        idb.close()
        return { mealPlans, pantryItems }
      })
      check(
        'BACKUP-01 週献立の割当(2026-07-20夕食)が復元される',
        restored.mealPlans.some((m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.role === 'main'),
        `mealPlans=${JSON.stringify(restored.mealPlans)}`,
      )
      check(
        'BACKUP-01 在庫の追加品が復元される',
        restored.pantryItems.some((p) => p.name === 'E2Eバックアップ確認在庫'),
        `pantryItems=${JSON.stringify(restored.pantryItems)}`,
      )
    } finally {
      await dstBrowser.close()
    }

    // 5) 後方互換: 新5テーブルの項目が無い旧形式のbackup JSONを、既に価格・在庫データのある
    //    プロファイルへ読み込んでもエラーにならず、既存の価格・在庫データが消えないことを確認する
    const compatBrowser = await chromium.launch()
    try {
      const compatContext = await compatBrowser.newContext()
      const compatPage = await compatContext.newPage()
      compatPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(後方互換)] ${err.message}`)
      })
      compatPage.on('dialog', (dialog) => dialog.accept())
      await compatPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(1800) // 初回シード完了待ち

      // 復元前から価格マスタ・在庫ボードにデータがある状態を用意する(IndexedDBへ直接書き込み)
      await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['prices', 'pantryItems'], 'readwrite')
          tx.objectStore('prices').add({
            name: 'E2E後方互換確認価格',
            pricePerUnit: 321,
            unit: '1個',
            updatedAt: Date.now(),
            isDefault: false,
          })
          tx.objectStore('pantryItems').add({ name: 'E2E後方互換確認在庫', level: 'have', isFrequent: true })
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })

      // この対応より前の形式(新5テーブルの項目が一切無い)のbackup JSONを模す
      const oldFormatBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })

      await compatPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(500)
      await compatPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await compatPage.waitForTimeout(300)
      const [compatFileChooser] = await Promise.all([
        compatPage.waitForEvent('filechooser'),
        compatPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click(),
      ])
      await compatFileChooser.setFiles({
        name: 'old-format-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(oldFormatBackup, 'utf-8'),
      })
      await compatPage.waitForTimeout(800)
      check(
        'BACKUP-01 旧形式(新5テーブル項目なし)のバックアップを読み込んでもエラーにならない',
        !(await compatPage.textContent('body')).includes('ファイルを読み込めませんでした'),
      )

      const afterCompat = await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const [prices, pantryItems] = await Promise.all([getAll('prices'), getAll('pantryItems')])
        const recipeCount = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('recipes', 'readonly').objectStore('recipes').count()
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return { prices, pantryItems, recipeCount }
      })
      check(
        'BACKUP-01 旧形式の復元で既存の価格マスタが消えない(clearされない)',
        afterCompat.prices.some((p) => p.name === 'E2E後方互換確認価格'),
        `prices件数=${afterCompat.prices.length}`,
      )
      check(
        'BACKUP-01 旧形式の復元で既存の在庫ボードが消えない(clearされない)',
        afterCompat.pantryItems.some((p) => p.name === 'E2E後方互換確認在庫'),
        `pantryItems件数=${afterCompat.pantryItems.length}`,
      )
      check(
        'BACKUP-01 旧形式でもrecipesフィールド自体は従来どおり置き換わる(空配列→0件)',
        afterCompat.recipeCount === 0,
        `recipeCount=${afterCompat.recipeCount}`,
      )
    } finally {
      await compatBrowser.close()
    }
  }

  // --- PRO-FALLBACK-01: crypto.subtleが使えないinsecure context(開発中LANのhttp://192.168.x.x
  // 等でのiPhone実機テストが該当。docs/22)でも、純JSのSHA-256フォールバック(src/logic/sha256.ts)
  // でPro解錠コード検証が最後まで動くことを確認する(2026-07-13)。crypto.subtleの有無自体は
  // オリジンがhttp/httpsかで決まらずaddInitScriptで直接再現できるが、production buildの
  // 挙動を見るため他チェックのdevサーバーとは別にpreviewサーバーを自前でport 4194に立てる ---
  currentCheck = 'PRO-FALLBACK-01'
  {
    const distIndex = path.join(appRoot, 'dist', 'index.html')
    if (!existsSync(distIndex)) {
      // このチェックはproductionビルド(dist)のpreview前提。無ければ先にビルドする
      execSync('npx vite build', { cwd: appRoot, stdio: 'inherit' })
    }

    const PREVIEW_PORT = 4194
    const PREVIEW_BASE = `http://localhost:${PREVIEW_PORT}`
    const previewProc = spawn(
      'npx',
      ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let previewReady = false
    let previewOutput = ''
    previewProc.stdout.on('data', (buf) => {
      previewOutput += buf.toString()
      if (previewOutput.includes('Local:')) previewReady = true
    })
    previewProc.stderr.on('data', (buf) => (previewOutput += buf.toString()))

    try {
      const start = Date.now()
      while (!previewReady && Date.now() - start < 15000) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      if (!previewReady) {
        throw new Error(`previewサーバーが起動しなかった: ${previewOutput}`)
      }

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

        // テスト用Pro解錠コード(docs/22の実機確認チェックリスト記載。販売用ではない)
        await fbPage.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)').fill('UR-96QS-2VSZ')
        await fbPage.getByRole('button', { name: '解錠する', exact: true }).first().click()
        await fbPage.waitForTimeout(1000)
        const fbText = await fbPage.textContent('body')
        check(
          'PRO-FALLBACK-01 crypto.subtle無効でも純JSフォールバックでPro解錠が通る',
          fbText.includes('Pro版をご利用いただきありがとうございます'),
          fbText.includes('コードが正しくありません')
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
} catch (err) {
  ng(`実行中断(${currentCheck})`, err.message)
} finally {
  await browser.close()
}

// --- 結果 ---
const failed = results.filter((r) => !r.pass)
console.log(`\n対象: ${BASE}`)
for (const r of results) console.log(`${r.pass ? 'OK ' : 'NG '} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`\n合格: ${results.length - failed.length}/${results.length}件 / console・pageerror: ${errors.length}件`)
for (const e of errors) console.log(`  ${e}`)
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0)
