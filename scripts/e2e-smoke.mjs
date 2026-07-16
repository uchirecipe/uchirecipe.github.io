// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / COUNT-01(一覧上部の総件数「全◯件」が絞り込み無しでも常に表示され、
//         絞り込み中は「◯件 / 全◯件」の形になる。2026-07-13 UI改善) /
//         QF-01(「時短レシピのみに絞る」絞り込みで件数が変わる。チップ文言は2026-07-13と
//         2026-07-16便T-5で変更) /
//         LAYOUT-01(一覧のグリッド/リスト表示切替。settingsに保存されリロード後も維持される。
//         2026-07-13 UI改善。同日オーナー実機フィードバックでリスト行にも主要食材チップ・
//         由来バッジ・タイトル2行折り返しを追加し、グリッドと同等の情報量になったことを確認。
//         切替ボタンは2026-07-16便T-2で件数表記の横の常設列へ移動) /
//         SORTDIR-01(並べ替えの昇順/降順トグル。「五十音順」既定は昇順、「降順」で並びが
//         ちょうど反転する。2026-07-13 UI改善。並び替えは2026-07-16便T-1で専用ボタン・
//         専用パネルに分離) /
//         SMK-02+03(登録・削除) /
//         SMK-04(貼り付け整形) / SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) /
//         KW-01(検索キーワード欄。保存→検索でヒットし、一覧・詳細には表示されないこと) /
//         INTRO-01(ひとこと説明・任意。2026-07-13。料理名だけでは中身が想像しにくい料理向けの
//         短い説明文。フォームで入力→保存→詳細の料理名見出しの直後に表示されること) /
//         ONEPOINT-01(メモ2区画化・2026-07オーナー承認済み設計: 「ワンポイント」(こつ・知識)と
//         「メモ」(保存方法・注意書き・安全)を別々に入力→保存→詳細で①ワンポイント→②メモの順に
//         見出し付きで表示されること・編集画面を開き直しても両方の入力が保持されること) /
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
//         RECIPESET-01(修正4・2026-07-14オーナー実機フィードバック: 「レシピセットを読み込む」欄の
//         「URLから読み込む」結果を読み込み欄の上部にテキストで表示し、以前の下部トーストとしては
//         二重に出ないこと。エラー(見つからない)・成功の両方を確認。2026-07-16修正1で
//         setId/setName付き取り込み後にテーマ名バッジ(sourceSetName)が出ることも確認) /
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
//         STEP0-01(手順0件のレシピ・2026-07バグ修正: 手順欄を空のまま保存(steps:[])しても、
//         詳細画面に「調理中モードで見る」ボタンが表示されない=空配列で調理中モードを開いて
//         クラッシュすることがないこと) /
//         NUTSORT-01(栄養並び替えの無料ティーザー・2026-07-16便T-4で5項目まとめてPro機能化:
//         無料では栄養価の選択肢が出ず、グレーの「栄養価で並び替え（Pro機能）」行だけが出て
//         タップ先が既存のPro案内であること) /
//         NUTSORT-02(栄養並び替え・Pro解錠済み: カロリー/たんぱく質/塩分/脂質/糖質の5項目が出る・
//         カロリー既定は昇順・たんぱく質既定は降順・算出不能レシピは昇順/降順とも末尾・
//         栄養価順の間はカードに並び替え中の値が出る=便T-7。2026-07-16便T-7-2で
//         「カロリー: ◯kcal」「たんぱく質: ◯g」のラベル付き表記に変更) /
//         TOMB-01(削除したセット品の再取込除外=トゥームストーン・2026-07-13 Fable設計:
//         テーマ取り込み→1品削除→再取込で復活しない(「削除済みの除外中1件」表示)→テーマ一覧の
//         「除外中1品・すべて戻す」で解除→再取込で復活する) /
//         ORPHAN-01(テーマ一括削除の孤児防止・2026-07バグ修正: テーマ収録品を週間献立・
//         今日の献立の両方に登録した状態でテーマごと削除しても、両テーブルに削除済み
//         レシピを指す孤児行が残らないことをIndexedDB直読みで確認) /
//         TODAYALL-01(「全て作った！」の一括反映・2026-07バグ修正: 記録追加(addCookedLog)と
//         今日の献立クリアを1トランザクションにまとめた後も、正常系で両方が揃って反映される
//         ことを確認。トランザクション途中断の再現は黒箱E2Eでは不可のため対象外) /
//         FOCUS-MEMO-01(調理中モードの▽折りたたみメモが詳細画面と同じ小窓タップで開閉し、
//         「｜」改行・「・」箇条書きも小窓内で効くこと。2026-07-12 Fable裁定) /
//         PRICE-01(食材価格マスタ。材料に価格未入力のレシピでもマスタ目安価格が詳細の
//         概算食費に反映され、マスタ編集に追従すること。2026-07-13
//         オーナー実機フィードバックで詳細画面の概算食費欄の「一部は目安価格から計算しています」
//         注記を削除、同日中に週の献立側も削除(mixedNote定義自体を撤去)したため、
//         その不在をMEALPLAN-01側でも確認する。2026-07-14修正3a/3bで、材料行ごとの
//         目安価格の注記(「（目安◯円）」)は表示しないこと・概算食費に「1食あたり」も
//         追加表示されること(既定人数2人で50÷2=25円等)を確認) /
//         INLINE-01(「食材と価格」一覧の行内編集。2026-07-12 UX改修で編集モーダルを廃止し、
//         価格欄への直接入力+Enter/blurで即保存。2026-07-13 UI改善で「目安」/「自分の価格」
//         バッジは廃止したため「デフォルトに戻す」ボタンの出現/消失で編集反映を確認・
//         検索絞り込みを確認。2026-07-14修正2a/2b/2cで、手入力で既定値に戻すと
//         「デフォルトに戻す」ボタンが消えること・正規化(前後空白/括弧除去)して同名の
//         食材は追加を拒否すること・追加入力欄が一覧より上に表示されることを確認) /
//         合わせ調味料ライン表示 /
//         PRO-FALLBACK-01(crypto.subtleが使えないinsecure context(LAN実機のhttp://等)でも、
//         純JSのSHA-256フォールバック(src/logic/sha256.ts)でPro解錠コード検証が動くこと。
//         2026-07-13。他チェックが使う既存サーバーとは別に自前でpreviewサーバーをport 4194で
//         起動して検証する) /
//         MEALPLAN-01(献立タブ・週プランナー。第4波ペルソナPDCA・2026-07-13裁定。2026-07-16
//         便U-1で献立タブは日/週/月の3タブ構成になり、既定は「日」タブ・週の検証は「週」タブへ
//         切り替えてから行う:
//         週移動の中央チップが「今週へ戻る」ボタンとして機能しaria-labelが状態に応じて出し分けられる
//         こと(Fix1)・概算食費セクションは未割当時は非表示で割当後に表示されること(Fix3)・
//         ピッカー再オープンで現在レシピに「選択中」バッジが出ること(Fix4)・フィルタ/トグル/
//         日週月タブのaria-pressed(Fix5。2026-07-13更新: 新規ユーザーは既定で夕食のみ
//         aria-pressed=true)・最後の食事帯フィルタを外そうとしたときの説明トースト(Fix6。
//         同日更新: 既定が夕食のみになったため夕食を外そうとするパターンで検証)・
//         「この帯の今週分を空にする」の帯選択+confirm+一括削除(便U-4)) /
//         MEALPLAN-02(献立タブ・月カレンダー。同波Fix2: 月移動の中央チップの「今月へ戻る」導線。
//         Pro解錠コード入力UI経由で解錠してから検証。2026-07-16便U-5: 日タップは即週ジャンプせず
//         その日の献立モーダル(朝昼夕・レシピ名リンク・「この週を開く」・献立なし文言)を出す) /
//         MEALPLAN-03(献立タブ・主菜+副菜構成。2026-07-13 Fable設計: 各枠が既定で主菜+副菜の
//         2行になっていること・「＋枠を追加」で行を増やせること・行単位のサイコロは他の行に
//         影響しないこと・枠が丸ごと空のときのサイコロ/まとめて献立を立てるは主菜+副菜のペアで
//         埋まること・まとめて献立を立てるのアイコンがDicesであること) /
//         MEALPLAN-04(修正1b・2026-07-14オーナー実機フィードバック: 「まとめて献立を立てる」は
//         以前は空き枠だけ埋めるため2回目以降のタップが無反応だった。押すたびに表示中の全枠
//         (手動選択枠も含む)を一旦クリアしてから再抽選することを、mealPlansの行idが
//         クリア→再作成で入れ替わることで確認する) /
//         MEALPLAN-05(日タブの週プラン自動取り込み・便U-3・2026-07-16 Fable設計: 日タブを開くと
//         今日の週プラン登録(表示帯のみ)が今日の献立へ自動で入ること・非表示帯は取り込まれない
//         こと・2回開いても重複しないこと(冪等)・取り込まれた品を消して開き直しても同じ日の
//         うちは再出現しないこと(settings.lastAutoImportDate)をIndexedDB直読みで確認) /
//         修正1a(献立タブの概算食費リンクの文言「食材と価格を編集する」・遷移先/pricesを
//         MEALPLAN-01内で確認) /
//         PRICEUNIT-01(「食材と価格」の単位入力UI改修・2026-07-15オーナー実機フィードバック:
//         単位欄が自由入力(「100g」等を数字ごと1欄に書く)だと不安・使いにくいため、
//         新規追加・行内編集の両方で「数量(数字)＋単位(選択)」に分離。保存形式は従来どおり
//         1つの文字列に合成(数量「2」+単位「個」→「2個」)されIndexedDBの実データで確認。
//         既存デフォルト行(玉ねぎ)の数量を変えると「デフォルトに戻す」が出現し、
//         押すと数量・単位・「デフォルトに戻す」の表示が投入時の状態に戻ることも確認) /
//         BACKUP-01(バックアップの全ユーザーデータ対応・2026-07-13データ堅牢性強化: 価格編集+
//         週献立割当+在庫品を実際の「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで
//         捕捉)で書き出し→まっさらな別プロファイルへ「読み込む(置き換え)」で復元し、
//         価格・週献立・在庫が実際に引き継がれることを確認。加えて、これらの項目が無い
//         旧形式のbackup JSONを、既に価格・在庫データのあるプロファイルへ読み込んでも
//         エラーにならず既存の価格・在庫データが消えない(後方互換)ことも確認する) /
//         PRICEVIEW-01(レシピ詳細の材料「価格ビュー」トグル・2026-07-15 オーナー要望「どの
//         食材が値段に反映されているか分からない」への対応。既定OFFで材料行に金額表示は無く、
//         見出し行の「価格を見る」チップを押すと各行右端に「約◯円」(価格が拾えない材料は
//         「価格なし」)が表示され、「食材と価格を編集する」への案内リンクも現れる。「価格を隠す」
//         で元に戻ることを確認。オーナー仕様変更(同日)で由来バッジ(目安/自分の価格)表示は
//         廃止したため、バッジの有無は確認対象外) /
//         FORMTABS-01(レシピ編集フォームの「かんたん/くわしく」タブ分け・2026-07-16 Fable裁定
//         docs/26・案A承認。(a)新規登録の初期表示は常に「かんたん」タブで、かんたんタブの入力
//         だけで保存が成功する (b)「くわしく」タブ側フィールドに入力があると見出し右に●が出て
//         空のうちは出ない(aria-label「入力済みの項目があります」で判定) (c)「くわしく」タブ
//         表示中に料理名未入力のまま保存すると、エラー表示とともに「かんたん」タブへ自動的に
//         戻る (d)両タブのDOMを常時マウントしhidden属性で切り替えるだけの実装のため、タブを
//         往復してもくわしくタブの入力内容が消えない(state維持)ことを確認。既存のKW-01/
//         INTRO-01/ONEPOINT-01/DISHTYPE-01もタブ分けで対象フィールドが「くわしく」タブの中に
//         入ったため、タブ切替の1手を追加済み) /
//         FORMRESET-01(レシピ編集画面の「デフォルトに戻す」・2026-07-15 オーナー要望。DBには
//         書き込まずフォームの入力値だけを差し替える安全設計。(a)基本レシピ「肉じゃが」の編集で
//         タイトル・材料を書き換え→ボタンは1回目「もう一度押すと戻します」に変化するだけで
//         まだ戻らない→2回目でstarterDefsの原本(タイトル・材料とも)に戻ること・保存前の
//         軽いフィードバック文言が出ること→保存せず一覧へ離脱しても実データ(DB)が
//         書き換わっていないこと(b)自作レシピを新規登録→編集でタイトルを変更→
//         「前回保存した内容に戻す」(自作は文言がスターターと異なる)で保存済みタイトルに
//         戻ることを確認)。
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

  // --- QF-01: 絞り込み「時短レシピのみに絞る」でカード件数が変わる(quickStepsを持つレシピだけに
  // 絞られる。UI改善バッチ 2026-07-11。チップ文言は2026-07-13「時短」→「時短レシピ」、
  // 2026-07-16便T-5で「時短レシピのみに絞る」に変更) ---
  currentCheck = 'QF-01'
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '時短レシピのみに絞る', exact: true }).click()
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
  await page.getByRole('button', { name: '時短レシピのみに絞る', exact: true }).click()
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

  // --- SORTDIR-01: 並べ替えの昇順/降順トグル(2026-07-13 UI改善)。「五十音順」(2026-07-16便T-5で
  // 「あいうえお順」から改称)を選ぶと既定で昇順(あ→ん)になり、「降順」を押すと並びがちょうど反転する
  // ことを確認する。便T-1で並び替えボタンが絞り込みボタンから分離したのでそちらを開く ---
  currentCheck = 'SORTDIR-01'
  const cardTitles = () =>
    page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '五十音順', exact: true }).click()
  await page.waitForTimeout(300)
  const ascActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '昇順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SORTDIR-01 「五十音順」を選ぶと既定で昇順が選択される', ascActive)
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
  // 詳細画面と挙動を統一)。「回鍋肉(ホイコーロー)」手順5の「▽たくさん作るとき」には「・」箇条書きと
  // 「｜」改行の両方が入っているため、これらが小窓の中でも効くことまで併せて確認する
  // (2026-07-13: 元は「蒸しなすの香味だれ」→用語辞書集約で削除→「鶏の照り焼き」に差し替え。
  //  2026-07-14: 鶏の照り焼きの▽も分割冗長文の横展開削除で｜構造が消えたため、同じ構造(手順範囲指定の
  //  例外として｜+・箇条書きを保持している)「回鍋肉」手順5に再度差し替えた) ---
  currentCheck = 'FOCUS-MEMO-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('回鍋肉')
  await page.waitForTimeout(300)
  await page.getByText('回鍋肉(ホイコーロー)', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '次へ' }).click() // 手順2へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順3へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順4へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順5(▽を含む手順)へ
  await page.waitForTimeout(300)
  const focusMemoFoldedText = await page.textContent('body')
  check(
    'FOCUS-MEMO-01 ▽はラベルのみ折りたたみ表示され詳細は隠れている',
    focusMemoFoldedText.includes('たくさん作るとき') &&
      !focusMemoFoldedText.includes('一度に炒められるのはフライパン'),
  )
  // 詳細画面の手順リスト(FocusModeの背後にDOM上は残ったまま)にも同じ▽ボタンがあるため、
  // FocusModeの全画面オーバーレイ(.fixed.inset-0.z-50)側だけに絞って押す
  await page.locator('.fixed.inset-0.z-50').getByRole('button', { name: 'たくさん作るとき' }).click()
  await page.waitForTimeout(300)
  const focusMemoOpenText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 タップで小窓が開き詳細(1文目)が見える',
    focusMemoOpenText.includes('一度に炒められるのはフライパン'),
  )
  check(
    'FOCUS-MEMO-01 「｜」改行後の2文目も「・」箇条書きとして見える',
    focusMemoOpenText.includes('人数が多いときは手順③〜⑤'),
  )
  await page.mouse.click(5, 5) // 小窓の外をタップ
  await page.waitForTimeout(300)
  const focusMemoClosedText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 外タップで小窓が閉じる',
    !focusMemoClosedText.includes('一度に炒められるのはフライパン'),
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

  // --- DET-01: 詳細の戻るボタン(2026-07-16オーナー改定)。
  // 従来(2026-07-10決定): 一覧以外の画面から来た場合でも常に一覧へ戻る
  // (ブラウザ履歴があると直前の画面に戻ってしまっていた不具合の再発防止)。
  // 改定(2026-07-16): ホームの候補カード(「今日なに作る?」)発だけは例外でホームへ戻る
  // (todayList方式の拡張)。それ以外(一覧・直接URL等、履歴/state無し)は従来どおり一覧へ ---
  currentCheck = 'DET-01'
  // (a) ホームの候補カードから詳細→戻る→ホーム(#/)へ戻る
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('a[href^="#/recipes/"]').first().click()
  await page.waitForTimeout(500)
  check(
    'DET-01 ホームの候補カードからレシピ詳細へ遷移',
    /#\/recipes\/\d+/.test(page.url()),
    `現在URL: ${page.url()}`,
  )
  const det01DetailUrl = page.url()
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01(2026-07-16改定) ホームの候補カード発の戻るはホーム(#/)へ戻る',
    page.url() === `${BASE}/#/`,
    `現在URL: ${page.url()}`,
  )

  // (b) 戻り先の保全: 直接URL(ブラウザ履歴なし・state無し)で詳細を開いた場合は従来どおり一覧へ
  await page.goto(det01DetailUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01(戻り先の保全) 直接URLで開いた詳細の戻るは従来どおり一覧へ',
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
  // 検索キーワード欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
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

  // --- INTRO-01: ひとこと説明(intro・任意。2026-07-13)。料理名だけでは中身が想像しにくい
  // 料理向けの短い説明文。フォームで入力→保存→詳細の料理名の直下に表示されることを確認する ---
  currentCheck = 'INTRO-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eひとこと説明確認レシピ')
  // ひとこと説明欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder('例: ヨーグルトに二種類のソースをかけた見た目も楽しいデザートです')
    .fill('E2E確認用のひとこと説明テキスト')
  await page.getByRole('tab', { name: 'かんたん' }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 2026-07-16 UI総点検A-8: introもwrapJaPhrases経由(ja-phrase)の描画になり、文節境界にZWSPが
  // 入るようになったため、他のMemoText系フィールドと同じくstripZwspしてから比較する
  const introDetailText = stripZwsp(await page.textContent('body'))
  check(
    'INTRO-01 保存後の詳細に料理名が表示される',
    introDetailText.includes('E2Eひとこと説明確認レシピ'),
  )
  check(
    'INTRO-01 保存後の詳細に料理名の下にひとこと説明が表示される',
    introDetailText.includes('E2E確認用のひとこと説明テキスト'),
  )
  const introHeading = page.getByRole('heading', { name: 'E2Eひとこと説明確認レシピ' })
  const introBelowTitle = stripZwsp(
    await introHeading.evaluate((el) => {
      const next = el.nextElementSibling
      return next?.textContent ?? ''
    }),
  )
  check(
    'INTRO-01 ひとこと説明は料理名見出しの直後の要素に表示される',
    introBelowTitle.includes('E2E確認用のひとこと説明テキスト'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- ONEPOINT-01: メモ2区画化(2026-07。オーナー承認済み設計)。「ワンポイント」
  // (こつ・知識)と「メモ」(保存方法・注意書き・安全)を別々に入力→保存→詳細画面で
  // ①ワンポイント→②メモの順で見出し付きで表示されること・編集画面を開き直しても
  // 両方の入力が保持されることを確認する ---
  currentCheck = 'ONEPOINT-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eワンポイントメモ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  // ワンポイント・メモ欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder('こつ・知識など。例: 味噌は煮立てると香りが飛ぶので最後に')
    .fill('E2E確認用のワンポイント本文')
  await page.getByPlaceholder('気づいたこと・アレンジなどを自由に').fill('E2E確認用のメモ本文')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 本文はMemoText(改行エンジン)経由でZWSPが挿入されるため、素のincludesでは一致しない。stripZwspで除去してから照合する
  const onePointDetailText = stripZwsp(await page.textContent('body'))
  check(
    'ONEPOINT-01 保存後の詳細にワンポイント本文が表示される',
    onePointDetailText.includes('E2E確認用のワンポイント本文'),
  )
  check(
    'ONEPOINT-01 保存後の詳細にメモ本文が表示される',
    onePointDetailText.includes('E2E確認用のメモ本文'),
  )
  const onePointHeadings = await page.locator('h2').allTextContents()
  const onePointIdx = onePointHeadings.indexOf('ワンポイント')
  const memoIdx = onePointHeadings.indexOf('メモ')
  check('ONEPOINT-01 「ワンポイント」見出しが存在する', onePointIdx !== -1)
  check('ONEPOINT-01 「メモ」見出しが存在する', memoIdx !== -1)
  check(
    'ONEPOINT-01 表示順は①ワンポイント→②メモ(オーナー承認済み設計)',
    onePointIdx !== -1 && memoIdx !== -1 && onePointIdx < memoIdx,
    `headings: ${JSON.stringify(onePointHeadings)}`,
  )

  // 編集画面を開き直しても両方の入力が保持される(DB保存の確認)。編集画面の初期表示は
  // 常に「かんたん」タブのため、ワンポイント・メモを確認するには「くわしく」への切替が必要
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const onePointEditValue = await page
    .getByPlaceholder('こつ・知識など。例: 味噌は煮立てると香りが飛ぶので最後に')
    .inputValue()
  const memoEditValue = await page.getByPlaceholder('気づいたこと・アレンジなどを自由に').inputValue()
  check(
    'ONEPOINT-01 編集画面のワンポイント欄に保存内容が復元される',
    onePointEditValue === 'E2E確認用のワンポイント本文',
    `実際の値: ${onePointEditValue}`,
  )
  check(
    'ONEPOINT-01 編集画面のメモ欄に保存内容が復元される',
    memoEditValue === 'E2E確認用のメモ本文',
    `実際の値: ${memoEditValue}`,
  )

  // 後始末: 検証用に作成したレシピを削除
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
  // 種別チップは「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
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
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const sideChipEdit = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 編集画面を開き直しても選択状態が保持される(DB保存の確認)', await isChipActive(sideChipEdit))
  await sideChipEdit.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 もう一度押すと選択が解除される', !(await isChipActive(sideChipEdit)))

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- STEP0-01: 手順0件のレシピ(バグ修正2026-07)。手順欄を空のまま保存すると
  // cleanInput()で空の手順行が除かれ steps:[] になる。この状態の詳細画面で
  // 「調理中モードで見る」ボタンが表示されず(押せてクラッシュすることがない)ことを確認する ---
  currentCheck = 'STEP0-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E手順0件確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  // 手順本文は空のまま保存する(このレシピが手順0件になる)
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const step0DetailText = await page.textContent('body')
  check(
    'STEP0-01 保存自体は成功する(詳細にタイトルが出る)',
    step0DetailText.includes('E2E手順0件確認レシピ'),
  )
  check(
    'STEP0-01 手順0件では「調理中モードで見る」ボタンが表示されない',
    !step0DetailText.includes('調理中モードで見る'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- NUTSORT-01: 栄養並び替えの無料ティーザー(2026-07-13 Fable設計→2026-07-16 便T-4で
  // カロリー・たんぱく質・塩分・脂質・糖質の5項目まとめてPro機能化。従来無料だったカロリー順も
  // Pro側へ=オーナー確定)。無料(未解錠)では並び替えパネルに栄養価の選択肢が一切出ず、
  // グレーの「栄養価で並び替え（Pro機能）」行だけが出て、タップ先が既存のPro案内
  // (設定のPro・パックタブ)であることを確認する。実際の並び順の検証はPro解錠済みの
  // NUTSORT-02側で行う ---
  currentCheck = 'NUTSORT-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  const nutSortPanelText = await page.textContent('body')
  check(
    'NUTSORT-01 無料ではグレーの「栄養価で並び替え（Pro機能）」ティーザーが出る',
    nutSortPanelText.includes('栄養価で並び替え（Pro機能）'),
  )
  const freeNutrientButtons = await page.evaluate(() => {
    const names = ['カロリー', 'たんぱく質', '塩分', '脂質', '糖質']
    const buttons = Array.from(document.querySelectorAll('button'))
    return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
  })
  check(
    'NUTSORT-01 無料では栄養価5項目が並び替えの選択肢に出ない(旧無料カロリー順もPro側へ)',
    freeNutrientButtons.length === 0,
    `出てしまった項目=${JSON.stringify(freeNutrientButtons)}`,
  )
  const teaserHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'))
    const teaser = links.find((a) => a.textContent?.includes('栄養価で並び替え（Pro機能）'))
    return teaser?.getAttribute('href') ?? null
  })
  check(
    'NUTSORT-01 ティーザーのタップ先は既存のPro案内(設定のPro・パックタブ)',
    teaserHref === '#/settings?section=pro',
    `href=${teaserHref}`,
  )
  // パネルを閉じ、以降のチェックに影響しないようにする(条件は何も変えていない)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)
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
  // REFRESH-APP-01: 「アプリを更新する」ボタン(2026-07-16新設。SWとキャッシュだけ消してリロード
  // する安全機能)がバックアップタブに存在し、データは消えない旨の説明文があること。
  // 実際のSW解除・reloadはheadlessでの副作用が大きいため、ボタンとconfirm文言の存在確認までとし、
  // クリックはしない(refreshApp()自体はscripts/test-logic.mjsのモックテストで検証済み)。
  check(
    'REFRESH-APP-01 「アプリを更新する」ボタンが見える',
    (await page.textContent('body')).includes('アプリを更新する'),
  )
  check(
    'REFRESH-APP-01 説明文に「データは消えません」相当がある',
    (await page.textContent('body')).includes('データは消えません'),
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
      await nutPage.getByPlaceholder('例: 肉じゃが').fill('E2E栄養並び替え確認レシピ')
      await nutPage.getByPlaceholder('例: じゃがいも').first().fill('謎のたべもの')
      await nutPage
        .getByPlaceholder('例: じゃがいもを一口大に切る')
        .first()
        .fill('謎のたべものを盛り付ける')
      await nutPage.getByRole('button', { name: '保存する' }).click()
      await nutPage.waitForTimeout(800)
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.locator('button[aria-label="並び替え"]').click()
      await nutPage.waitForTimeout(300)
      const proSortPanelText = await nutPage.textContent('body')
      check(
        'NUTSORT-02 Pro解錠済みでは「栄養価で並び替え」の区分見出しが出る',
        proSortPanelText.includes('栄養価で並び替え'),
      )
      check(
        'NUTSORT-02 Pro解錠済みではグレーのティーザー行(Pro機能)は出ない',
        !proSortPanelText.includes('栄養価で並び替え（Pro機能）'),
      )
      const proNutrientButtons = await nutPage.evaluate(() => {
        const names = ['カロリー', 'たんぱく質', '塩分', '脂質', '糖質']
        const buttons = Array.from(document.querySelectorAll('button'))
        return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
      })
      check(
        'NUTSORT-02 Pro解錠済みでは栄養価5項目すべてが選択肢に出る',
        proNutrientButtons.length === 5,
        `出た項目=${JSON.stringify(proNutrientButtons)}`,
      )
      // カロリー順: 既定は昇順(低い方から)。算出不能レシピは昇順・降順とも末尾
      await nutPage.getByRole('button', { name: 'カロリー', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalAscActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '昇順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 カロリー順の既定は昇順(低い方から)', kcalAscActive)
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
      const kcalBadgeInfo = await nutPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('div.grid.grid-cols-2 a')).filter((a) =>
          /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
        )
        const badgeOf = (a) =>
          Array.from(a.querySelectorAll('span')).find((s) =>
            /^カロリー: \d+(\.\d+)?kcal$/.test(s.textContent?.trim() ?? ''),
          )
        const unknownCard = links.find((a) => a.textContent?.includes('E2E栄養並び替え確認レシピ'))
        return {
          total: links.length,
          withBadge: links.filter((a) => badgeOf(a)).length,
          unknownHasBadge: unknownCard ? !!badgeOf(unknownCard) : null,
        }
      })
      check(
        'NUTSORT-02 カロリー順の間、カードに「カロリー: ◯kcal」のラベル付きの値が表示される(便T-7-2)',
        kcalBadgeInfo.withBadge > 0,
        `バッジ付き=${kcalBadgeInfo.withBadge}/${kcalBadgeInfo.total}`,
      )
      check(
        'NUTSORT-02 算出不能なレシピのカードには値バッジが出ない',
        kcalBadgeInfo.unknownHasBadge === false,
        `unknownHasBadge=${kcalBadgeInfo.unknownHasBadge}`,
      )
      await nutPage.getByRole('button', { name: '降順', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalDescTitles = await nutCardTitles()
      check(
        'NUTSORT-02 降順でも算出不能なレシピは末尾のまま',
        kcalDescTitles.length > 1 &&
          kcalDescTitles[kcalDescTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
        `末尾=${kcalDescTitles[kcalDescTitles.length - 1]}`,
      )
      check(
        'NUTSORT-02 昇順と降順で先頭が入れ替わる(実際にカロリー順で並んでいる)',
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
      const countGramBadges = () =>
        nutPage.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a')).filter((a) =>
            /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
          )
          return links.filter((a) =>
            Array.from(a.querySelectorAll('span')).some((s) =>
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
      // 便T-7: 一覧(リスト)表示に切り替えても並び替え中の栄養価の値(行の右下)が出る
      await nutPage.locator('button[aria-label="リスト表示に切り替え"]').click()
      await nutPage.waitForTimeout(400)
      check(
        'NUTSORT-02 一覧(リスト)表示でも並び替え中の栄養価の値が出る(便T-7)',
        (await countGramBadges()) > 0,
      )
      await nutPage.locator('button[aria-label="グリッド表示に切り替え"]').click()
      await nutPage.waitForTimeout(300)
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

  // --- ORPHAN-01: テーマ一括削除で週間献立・今日の献立に孤児が残らない(2026-07バグ修正)。
  // 従来はdeleteRecipesBySourceSetがdb.recipes.bulkDeleteのみで、削除済みレシピを指す
  // mealPlans/todayListの行が残ってしまっていた。テーマ「高たんぱくごはん」(kintore)を
  // 取り込み、収録品の1つを週間献立・今日の献立の両方に登録してからテーマごと削除し、
  // 両テーブルから該当行が消えている(IndexedDB直読み)ことを確認する。週間献立への登録は
  // UIのピッカー経路が長い(MEALPLAN-01/02で別途検証済み)ため、実データ形状に合わせて
  // IndexedDBへ直接1行だけ書き込んで再現する。テーマ取り込みには追加レシピパック解錠が
  // 必要なため、TOMB-01と同様settings.recipePackCodeを直接書き込む。他チェックに影響しない
  // よう専用のbrowser/contextで完結させる ---
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
      await obPage.waitForTimeout(1800) // 初回シード完了待ち
      await obPage.evaluate(async () => {
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

      // 1) テーマ「高たんぱくごはん」(kintore・10品)を取り込む
      await obPage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(2000)
      check(
        'ORPHAN-01 テーマの取り込み(10品追加)',
        (await obPage.textContent('body')).includes('10件追加しました'),
      )

      // 2) 収録品の1つ(漬けるだけ味玉)を「今日の献立に追加」ボタンで追加し、そのidを控える
      await obPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(600)
      await obPage.locator('input[type="search"]').fill('漬けるだけ味玉')
      await obPage.waitForTimeout(400)
      await obPage.getByText('漬けるだけ味玉', { exact: true }).first().click()
      await obPage.waitForTimeout(500)
      const targetRecipeId = Number(obPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await obPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await obPage.waitForTimeout(300)

      // 3) 同じレシピを週間献立にも登録する(IndexedDB直接書き込み。理由は上のコメント参照)
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

      // 4) テーマごと削除する(設定画面の「このテーマのレシピを削除」。確認ダイアログは自動承諾)
      await obPage.goto(`${BASE}/#/settings?section=themes`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(1000)
      await obPage.getByRole('button', { name: 'このテーマのレシピを削除' }).click()
      await obPage.waitForTimeout(800)
      check(
        'ORPHAN-01 テーマ削除の結果メッセージが出る',
        (await obPage.textContent('body')).includes('削除しました'),
      )

      // 5) 孤児が残っていない: 週間献立・今日の献立のどちらにも対象レシピの行が無い
      check(
        'ORPHAN-01 テーマ一括削除後、今日の献立に孤児が残らない',
        (await countByRecipeId('todayList')) === 0,
      )
      check(
        'ORPHAN-01 テーマ一括削除後、週間献立に孤児が残らない',
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
    try {
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(1800) // 初回シード完了待ち

      // 基本レシピ2品(肉じゃが・カレーライス)を「今日の献立に追加」ボタンで追加する
      await taPage.getByText('肉じゃが', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await taPage.waitForTimeout(300)
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(500)
      await taPage.getByText('カレーライス', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await taPage.waitForTimeout(300)

      await taPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(600)
      const beforeText = await taPage.textContent('body')
      check(
        'TODAYALL-01 前提: 今日の献立に2品とも表示される',
        beforeText.includes('肉じゃが') && beforeText.includes('カレーライス'),
      )

      await taPage.getByRole('button', { name: '全て作った！' }).click()
      await taPage.waitForTimeout(800)
      const afterText = await taPage.textContent('body')
      check(
        'TODAYALL-01 「全て作った！」の後、今日の献立が空になる(clearが実行される)',
        afterText.includes('まだ今日つくるものが決まっていません'),
      )

      // IndexedDBを直読みし、両方のレシピにcookedLogsが実際に追加され、todayListが空になったことを確認する
      const state = await taPage.evaluate(
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
      const nikujaga = state.recipes.find((r) => r.title === '肉じゃが')
      const curry = state.recipes.find((r) => r.title === 'カレーライス')
      check('TODAYALL-01 肉じゃがに作った記録が追加される', (nikujaga?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 カレーライスに作った記録が追加される', (curry?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 今日の献立テーブルが空になる(clear実行)', state.today.length === 0)
    } finally {
      await taBrowser.close()
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
      await bnPage.getByRole('button', { name: '週', exact: true }).click()
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
        'BACKNAV-01 戻った先に今日の献立セクションが見える',
        (await bnPage.textContent('body')).includes('今日の献立'),
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
  await page.getByRole('button', { name: '五十音順' }).click()
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
  await page.getByRole('button', { name: '戻る' }).click()
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
      '(2026-07-13 オーナー実機フィードバックで削除。週の献立側も同日中に削除)',
    !priceDetailBefore.includes('一部は目安価格から計算しています'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの目安価格の注記は表示しない' +
      '(2026-07-14 オーナー実機フィードバック「材料のメモ欄に目安価格が表示されている」の解消で機能削除)',
    !priceDetailBefore.includes('（目安50円）'),
  )
  // 修正3a: 概算食費(合計)に加えて「1食あたり」も表示される。既定servings=2なので50÷2=25円
  check(
    'PRICE-01(修正3a) 「1食あたり」の概算食費も表示される(既定人数2人・50÷2=約25円)',
    priceDetailBefore.includes('1食あたり 約25円'),
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

  // 修正2a: 手入力で既定値(50円)に戻すと「デフォルトに戻す」ボタンも消えることを確認する。
  // 以前は編集フラグが一方通行だったため、値を既定値に戻してもボタンが残るバグがあった
  await onionPriceInput.fill('50')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)
  check(
    'INLINE-01(修正2a) 手入力で既定値と一致させると「デフォルトに戻す」ボタンが消える',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  // 後続の検証用に再度999へ編集し直す
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)

  // 修正2b: 重複食材の登録防止。既に登録済みの「玉ねぎ」を追加しようとすると拒否される
  // exact:trueが必須(部分一致だと検索欄「食材名で絞り込む」や各行の「{name}の価格（円）」等と衝突する)
  // 2026-07-15 UI改修で単位欄が「数量(数字)＋単位(選択)」に分離されたため、addUnitInputは
  // 数量欄(addQtyInput)＋単位選択(addUnitSelect)の2つに置き換えた(PRICEUNIT-01参照)
  const addNameInput = page.getByLabel('食材名', { exact: true })
  const addPriceInput = page.getByLabel('価格（円）', { exact: true })
  const addQtyInput = page.getByLabel('数量', { exact: true })
  const addUnitSelect = page.getByLabel('単位', { exact: true })
  await addNameInput.fill('玉ねぎ')
  await addPriceInput.fill('80')
  await addQtyInput.fill('1')
  await addUnitSelect.selectOption('個')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 既に登録済みの食材名は追加を拒否し、案内メッセージが出る',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです'),
  )
  check(
    'INLINE-01(修正2b) 拒否後も「玉ねぎ」の行は1件のまま増えない',
    (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  // 前後の空白・括弧付きの表記ゆれも正規化して同一とみなし拒否される
  await addNameInput.fill('  玉ねぎ（小）  ')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 表記ゆれ(前後空白・括弧書き)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです') &&
      (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2b拡張(2026-07-15オーナー実機フィードバック): かな表記ゆれ(カタカナ⇄ひらがな)も
  // toHiraganaで正規化して重複と判定する。登録済み「白菜」に対してカタカナ「ハクサイ」を追加拒否する
  await addNameInput.fill('ハクサイ')
  await addPriceInput.fill('99')
  await addQtyInput.fill('1')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b拡張) かな表記ゆれ(カタカナ/ひらがな。白菜/ハクサイ)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「白菜」は既に登録済みです') &&
      (await page.locator('li', { hasText: '白菜' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2c: 追加入力欄が一覧より上に表示される(食材名欄のY座標 < 玉ねぎ行のY座標)
  const addNameBox = await addNameInput.boundingBox()
  const onionRowBoxForOrder = await onionRow.boundingBox()
  check(
    'INLINE-01(修正2c) 追加入力欄が一覧より上に表示される',
    !!addNameBox && !!onionRowBoxForOrder && addNameBox.y < onionRowBoxForOrder.y,
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

  // 詳細画面に戻り、編集後の価格が概算食費に反映されることを確認する(999円・1食あたり500円)
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
    'PRICE-01(修正3a) 「1食あたり」も編集後の価格に追従する(999÷2=約500円)',
    priceDetailAfter.includes('1食あたり 約500円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記は編集後も表示しない',
    !priceDetailAfter.includes('（999円）') && !priceDetailAfter.includes('（目安999円）'),
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

  // デフォルトに戻した後は、詳細の概算食費も50円(1食あたり25円)に戻ることを確認する。
  // 材料行ごとの目安価格由来の注記は2026-07-14に機能ごと削除したため、ここでは確認しない
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfterReset = await page.textContent('body')
  check(
    'INLINE-01 「デフォルトに戻す」後は詳細の概算食費も50円に戻る',
    priceDetailAfterReset.includes('約50円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記はデフォルト復元後も表示しない',
    !priceDetailAfterReset.includes('（目安50円）'),
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
  // で検証するため専用browser/contextを使う。2026-07-16 便U-1でタブ構成(日/週/月)に再設計。
  // 既定タブは「日」になったため、週タブの検証は明示的に「週」タブへ切り替えてから行う)。
  // Fix1: 週移動の中央チップ(以前は無ラベルの地の文だった)は、当週表示中はaria-labelなし、
  //       当週以外を見ているときだけaria-label(今週へ戻る)が付く「戻るボタン」になっていること
  // Fix3: 何も割り当てていない週は概算食費セクションが非表示、割り当てると表示されること
  // Fix4: 埋まった枠のピッカーを再度開くと、現在のレシピの行に「選択中」バッジが出ること
  // Fix5: 食事帯フィルタ・時短優先トグル・日/週/月タブにaria-pressedが付くこと(見た目は変更なし)
  // Fix6: 最後の1つの食事帯フィルタを外そうとすると無反応ではなく説明トーストが出ること
  // 便U-4: 週タブの「この帯の今週分を空にする」で帯選択+確認confirm→その帯の週エントリが
  //        全削除されること・他の帯には影響しないこと ---
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
    mpPage.on('dialog', (dialog) => dialog.accept()) // 便U-4の削除確認confirmを自動承認
    try {
      await mpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mpPage.waitForTimeout(1800) // 初回シード完了待ち

      // 便U-1: 既定は「日」タブ。以降の検証は週タブの内容が対象なので明示的に切り替える
      const dayTabBtn = mpPage.getByRole('button', { name: '日', exact: true })
      check('MEALPLAN-01(便U-1) 献立タブを開くと既定で「日」タブが選択されている', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')
      await mpPage.getByRole('button', { name: '週', exact: true }).click()
      await mpPage.waitForTimeout(300)

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
      check(
        'MEALPLAN-01(Fix3) 概算食費セクションにマスタ由来の注記は出ない' +
          '(2026-07-13 オーナー実機フィードバックで詳細に続き週の献立側も削除)',
        !mpAssignedText.includes('一部は目安価格から計算しています'),
      )

      // 2026-07-14: 概算食費欄のリンク文言を「食材と価格を編集する」に変更し、
      // 遷移先も/recipesから/prices(食材と価格ページ)に変更した
      const weekCostLink = mpPage.getByRole('link', { name: '食材と価格を編集する' })
      check(
        'MEALPLAN-01(修正1a) 概算食費欄のリンク文言が「食材と価格を編集する」になる',
        await weekCostLink.isVisible(),
      )
      check(
        'MEALPLAN-01(修正1a) リンクの遷移先が/prices(食材と価格ページ)になる',
        (await weekCostLink.getAttribute('href'))?.includes('/prices'),
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
      // 2026-07-16 UI総点検A-3: 提案条件6ボタンは既定折りたたみになったため、まず開く
      const suggestConditionsToggleBtn = mpPage.getByRole('button', { name: '提案の条件', exact: false })
      check(
        'MEALPLAN-01(A-3) 提案の条件トグルは既定でaria-expanded=false',
        (await suggestConditionsToggleBtn.getAttribute('aria-expanded')) === 'false',
      )
      await suggestConditionsToggleBtn.click()
      await mpPage.waitForTimeout(200)
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
      check(
        'MEALPLAN-01(Fix5・便U-1) 日/週/月タブにもaria-pressedが付く(週表示中はfalse/true/false)',
        (await dayTabBtn.getAttribute('aria-pressed')) === 'false' &&
          (await weekToggleBtn.getAttribute('aria-pressed')) === 'true' &&
          (await monthToggleBtn.getAttribute('aria-pressed')) === 'false',
      )

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

      // 便U-4: 「この帯の今週分を空にする」。ここまでの操作で月曜夕食の主菜行に「肉じゃが」が
      // 割り当て済み(Fix4)。帯選択は既定で「夕食」なので、選び直しは不要にconfirmだけ操作する。
      // aria-labelで対象の帯選択ボタン(表示帯フィルタの「夕食」ボタンとは別物)を特定する
      const clearDinnerTargetBtn = mpPage.getByRole('button', { name: '空にする帯として夕食を選ぶ' })
      check(
        'MEALPLAN-01(便U-4) 帯選択ボタンは既定で「夕食」がaria-pressed=true',
        (await clearDinnerTargetBtn.getAttribute('aria-pressed')) === 'true',
      )
      await mpPage.getByRole('button', { name: '空にする', exact: true }).click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(便U-4) 確認後、削除完了のトーストが出る',
        (await mpPage.textContent('body')).includes('夕食の今週分を削除しました'),
      )
      check(
        'MEALPLAN-01(便U-4) 夕食を空にすると割り当て済みだった「肉じゃが」も消える(未定に戻る)',
        (await mpPage.getByText('肉じゃが', { exact: true }).count()) === 0,
      )
    } finally {
      await mpBrowser.close()
    }
  }

  // --- MEALPLAN-02: 献立タブ・月カレンダー(第4波ペルソナPDCA Fix2)。Pro解錠(実際のコード入力UI経由)
  // →月表示→「前の月」→中央チップにaria-label(今月へ戻る)→タップで当月へ戻ることを確認する。
  // Pro解錠はPRO-FALLBACK-01と同じテスト用コード(docs/22記載・販売用ではない)を使う。
  // 便U-5(2026-07-16 Fable設計: 月タブの日タップは「その日の献立」を窓表示し、従来の
  // 即週ジャンプはモーダル内の「この週を開く」ボタンへ移動)も同じPro解錠済みブラウザで検証する ---
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

      // 便U-5: 月タブの日タップは窓表示(モーダル)。まず献立の無い日(今日)をタップ→
      // 「献立はありません」+「この週を開く」が出ること。従来の即週ジャンプが起きない
      // (=タップ直後も月タブのまま)ことも確認する
      const todayCell = mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first()
      await todayCell.click()
      await mp2Page.waitForTimeout(400)
      const monthTabBtn = mp2Page.getByRole('button', { name: '月', exact: true })
      check(
        'MEALPLAN-02(便U-5) 日をタップしても即週ジャンプせず月タブのまま(モーダルが開く)',
        (await monthTabBtn.getAttribute('aria-pressed')) === 'true',
      )
      const dayModal = mp2Page.locator('[role="dialog"]')
      check('MEALPLAN-02(便U-5) その日の献立モーダルが開く', await dayModal.isVisible())
      check(
        'MEALPLAN-02(便U-5) 献立の無い日は「献立はありません」と出る',
        (await dayModal.textContent()).includes('献立はありません'),
      )
      check(
        'MEALPLAN-02(便U-5) モーダルに「この週を開く」ボタンがある',
        await dayModal.getByRole('button', { name: 'この週を開く' }).isVisible(),
      )
      // ×で閉じられる
      await dayModal.locator('button[aria-label="閉じる"]').click()
      await mp2Page.waitForTimeout(300)
      check('MEALPLAN-02(便U-5) ×でモーダルが閉じる', !(await dayModal.isVisible()))

      // 献立のある日: 今日の日付の夕食に「肉じゃが」をIndexedDB直書きで投入してから
      // 同じ日をタップ→モーダルに食事帯ラベルとレシピ名リンクが出ること
      const mp2RecipeId = await mp2Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.find((r) => r.title === '肉じゃが')?.id)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await mp2Page.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const a = tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId, role: 'main' })
              a.onerror = () => reject(a.error)
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        mp2RecipeId,
      )
      // 素のIndexedDB直書きはDexieのliveQueryキャッシュに検知されない(ハッシュ遷移の
      // 開き直しは同一ドキュメントのためキャッシュも残る)ので、本物のreloadで反映させる
      await mp2Page.reload({ waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      await mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first().click()
      await mp2Page.waitForTimeout(400)
      const dayModalFilled = mp2Page.locator('[role="dialog"]')
      const dayModalFilledText = await dayModalFilled.textContent()
      check(
        'MEALPLAN-02(便U-5) 献立のある日は食事帯ラベル(夕食)とレシピ名が出る',
        dayModalFilledText.includes('夕食') && dayModalFilledText.includes('肉じゃが'),
      )
      check(
        'MEALPLAN-02(便U-5) レシピ名はタップで詳細へ行けるリンクになっている',
        (await dayModalFilled.locator('a[href*="/recipes/"]').count()) > 0,
      )
      // 「この週を開く」で週タブへ移動する(従来の週ジャンプはここへ移動した)
      await dayModalFilled.getByRole('button', { name: 'この週を開く' }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(便U-5) 「この週を開く」で週タブへ切り替わる',
        (await mp2Page.getByRole('button', { name: '週', exact: true }).getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MEALPLAN-02(便U-5) 開いた週に投入済みの肉じゃがが見える(今日を含む週が開いている)',
        (await mp2Page.getByText('肉じゃが', { exact: true }).count()) > 0,
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
      // 便U-1: 既定タブは「日」になったため、週プランナーの検証は「週」タブへ切り替えてから行う
      await mp3Page.getByRole('button', { name: '週', exact: true }).click()
      await mp3Page.waitForTimeout(300)

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

      // ジャンルチップ・高たんぱく優先は「提案の条件」トグルの中(2026-07-16 UI総点検A-3で既定折りたたみ化)。まず開く
      await mp3Page.getByRole('button', { name: '提案の条件', exact: false }).click()
      await mp3Page.waitForTimeout(200)

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

  // --- MEALPLAN-04: 「まとめて献立を立てる」の再抽選(修正1b・2026-07-14オーナー実機
  // フィードバック)。以前は空き枠だけ埋めるため2回目以降のタップが無反応だった。
  // 押すたびに表示中の全枠(手動で選んだ枠含む)の既存割り当てを一旦クリアしてから
  // 主菜+副菜のペアで埋め直す(再抽選)ことを、mealPlansテーブルの行idが
  // クリア→再作成で入れ替わる(削除+追加のため必ず新しいautoIncrement idになる)ことで検証する ---
  currentCheck = 'MEALPLAN-04'
  {
    const mp4Browser = await chromium.launch()
    const mp4Context = await mp4Browser.newContext()
    const mp4Page = await mp4Context.newPage()
    mp4Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-04] ${text}`)
    })
    mp4Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-04] ${err.message}`)
    })
    try {
      await mp4Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp4Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      // 便U-1: 既定タブは「日」になったため、「まとめて献立を立てる」がある「週」タブへ切り替える
      await mp4Page.getByRole('button', { name: '週', exact: true }).click()
      await mp4Page.waitForTimeout(300)

      const dinnerMealPlanIds = () =>
        mp4Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction('mealPlans', 'readonly')
                const getAllReq = tx.objectStore('mealPlans').getAll()
                getAllReq.onsuccess = () =>
                  resolve(
                    getAllReq.result.filter((row) => row.slot === 'dinner').map((row) => row.id),
                  )
                getAllReq.onerror = () => reject(getAllReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      const fillWeekBtn = mp4Page.getByRole('button', { name: 'まとめて献立を立てる' })
      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      check(
        'MEALPLAN-04 1回目の「まとめて献立を立てる」で全枠(7日×主菜+副菜=14件)が埋まる',
        (await mp4Page.getByText('未定', { exact: true }).count()) === 0,
      )
      const idsAfterFirst = await dinnerMealPlanIds()
      check('MEALPLAN-04 1回目の結果、mealPlansの行が14件作られる', idsAfterFirst.length === 14)

      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      check(
        'MEALPLAN-04 2回目のタップも無反応にならず、全枠が引き続き埋まっている(以前は無反応バグがあった)',
        (await mp4Page.getByText('未定', { exact: true }).count()) === 0,
      )
      const idsAfterSecond = await dinnerMealPlanIds()
      check('MEALPLAN-04 2回目の結果も、mealPlansの行が14件のまま', idsAfterSecond.length === 14)
      const overlappingIds = idsAfterSecond.filter((id) => idsAfterFirst.includes(id))
      check(
        'MEALPLAN-04 2回目は「全部埋まっているので無視」ではなく、全行を一旦クリアしてから' +
          '再作成する(旧idが1件も残らない=以前の「空き枠だけ埋める」実装なら2回目は無反応で' +
          'idが完全一致していたはず)',
        overlappingIds.length === 0,
        `overlap=${JSON.stringify(overlappingIds)}`,
      )
    } finally {
      await mp4Browser.close()
    }
  }

  // --- MEALPLAN-05: 日タブの週プラン自動取り込み(便U-3・2026-07-16 Fable設計)。
  // 日タブを開いたとき、今日の日付の週プラン登録(表示中の食事帯のみ)が今日の献立へ
  // 自動で取り込まれること。加えて冪等性の2点:
  //  (a) 2回開いても重複しない(importRecipeIdsToTodayListの重複スキップ+lastAutoImportDate)
  //  (b) 取り込まれた品をユーザーが消した後にもう一度開いても、その日のうちは再出現しない
  //      (settings.lastAutoImportDateに今日の日付が記録済みのため自動実行がスキップされる)
  // 非表示帯(朝食)の登録は取り込まれないことも確認する。まっさらプロファイル(新規ユーザー
  // 既定=夕食のみ表示)で検証するため専用browser/contextを使う ---
  currentCheck = 'MEALPLAN-05'
  {
    const mp5Browser = await chromium.launch()
    const mp5Context = await mp5Browser.newContext()
    const mp5Page = await mp5Context.newPage()
    mp5Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-05] ${text}`)
    })
    mp5Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-05] ${err.message}`)
    })
    try {
      // まずレシピ一覧で初回シードを済ませ、今日の週プランをIndexedDB直書きで用意する:
      // 夕食(表示帯)に肉じゃが(主菜)+カレーライス(副菜扱い)、朝食(非表示帯)に豚の生姜焼き
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1800) // 初回シード完了待ち
      const seeded = await mp5Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const byTitle = (t) => g.result.find((r) => r.title === t)?.id
                const nikujaga = byTitle('肉じゃが')
                const curry = byTitle('カレーライス')
                const shogayaki = byTitle('豚の生姜焼き')
                if (!nikujaga || !curry || !shogayaki) {
                  resolve({ ok: false })
                  return
                }
                const wtx = idb.transaction('mealPlans', 'readwrite')
                const store = wtx.objectStore('mealPlans')
                store.add({ date, slot: 'dinner', recipeId: nikujaga, role: 'main' })
                store.add({ date, slot: 'dinner', recipeId: curry, role: 'side' })
                store.add({ date, slot: 'breakfast', recipeId: shogayaki, role: 'main' })
                wtx.oncomplete = () => resolve({ ok: true })
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('MEALPLAN-05 前提: 今日の週プラン(夕食2件+朝食1件)を直接投入できる', seeded.ok)

      // todayListの実データを直接読むヘルパー(重複の有無を黒箱の見た目でなくDBで断定する)
      const todayListRecipeIds = () =>
        mp5Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('todayList', 'readonly')
                const g = tx.objectStore('todayList').getAll()
                g.onsuccess = () => resolve(g.result.map((row) => row.recipeId))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // 1回目: 献立タブを開く(既定=日タブ)→夕食の2件だけが自動で今日の献立に入る
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200) // 自動取り込み+liveQuery反映待ち
      const mp5BodyAfterFirst = await mp5Page.textContent('body')
      check(
        'MEALPLAN-05 日タブを開くと夕食(表示帯)の週プラン2件が今日の献立に自動で入る',
        mp5BodyAfterFirst.includes('肉じゃが') && mp5BodyAfterFirst.includes('カレーライス'),
      )
      check(
        'MEALPLAN-05 朝食(非表示帯)の登録は取り込まれない',
        !mp5BodyAfterFirst.includes('豚の生姜焼き'),
      )
      const idsAfterFirstOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05 todayListの実データは2件(夕食の2件のみ)',
        idsAfterFirstOpen.length === 2,
        `ids=${JSON.stringify(idsAfterFirstOpen)}`,
      )

      // 2回目: 一旦別ページへ抜けて開き直す(再マウント)→重複しない(冪等)
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterSecondOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(冪等) 2回開いてもtodayListは2件のまま重複しない',
        idsAfterSecondOpen.length === 2,
        `ids=${JSON.stringify(idsAfterSecondOpen)}`,
      )

      // 削除→開き直し: 肉じゃがを×で外す→開き直しても再出現しない
      // (lastAutoImportDateに今日が記録済みのため、その日のうちの自動再取り込みはスキップ)
      const removeButtons = mp5Page.locator('button[aria-label="この献立から外す"]')
      const removeCountBefore = await removeButtons.count()
      check('MEALPLAN-05 前提: 今日の献立に×ボタンが2つ出ている', removeCountBefore === 2)
      // 1行目(肉じゃが)の×を押す
      await removeButtons.first().click()
      await mp5Page.waitForTimeout(500)
      const idsAfterRemove = await todayListRecipeIds()
      check(
        'MEALPLAN-05 ×で1件外すとtodayListは1件になる',
        idsAfterRemove.length === 1,
        `ids=${JSON.stringify(idsAfterRemove)}`,
      )
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterReopen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(再出現防止) 削除後に日タブを開き直しても消した品は戻らない(1件のまま)',
        idsAfterReopen.length === 1 &&
          JSON.stringify(idsAfterReopen) === JSON.stringify(idsAfterRemove),
        `before=${JSON.stringify(idsAfterRemove)} after=${JSON.stringify(idsAfterReopen)}`,
      )
    } finally {
      await mp5Browser.close()
    }
  }

  // --- RECIPESET-01: 修正4(2026-07-14 オーナー実機フィードバック)。「レシピセットを読み込む」欄の
  // 「URLから読み込む」の結果を、読み込み欄の上部にテキストで表示する(以前は下部トーストのみで、
  // 縦に長いページでは気づきにくかった)。エラー(見つからない)・成功の両方で読み込み欄の上部に
  // 表示され、下部トースト(押して閉じるボタン)としては二重に出ないことを確認する。
  // 他の操作(テーマ追加・set=直リンク等)のトーストは変更していないため対象外。
  // review2.jsonを使い、専用のまっさらプロファイルで完結させる。2026-07-16修正1でreview*.jsonに
  // setId/setNameが付いたため課金ゲート対象になった(下見用途・Pro解錠済みオーナーのみ想定)。
  // 成功パスの検証にはPro解錠が必要なため、NUT-02と同じIndexedDB直書きで解錠済み状態を再現する ---
  currentCheck = 'RECIPESET-01'
  {
    const rsBrowser = await chromium.launch()
    const rsContext = await rsBrowser.newContext()
    const rsPage = await rsContext.newPage()
    rsPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@RECIPESET-01] ${text}`)
    })
    rsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@RECIPESET-01] ${err.message}`)
    })
    try {
      await rsPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(1000)
      await rsPage.getByRole('button', { name: 'レシピ', exact: true }).click()
      await rsPage.waitForTimeout(300)

      const urlInput = rsPage.getByPlaceholder('https://…')
      const loadUrlBtn = rsPage.getByRole('button', { name: 'URLから読み込む' })

      // エラー(見つからない)パス
      await urlInput.fill(`${BASE}/sets/data/does-not-exist-e2e.json`)
      await loadUrlBtn.click()
      await rsPage.waitForTimeout(600)
      check(
        'RECIPESET-01(修正4) 存在しないURLの結果が読み込み欄の上部にテキストで出る',
        (await rsPage.textContent('body')).includes(
          '指定されたURLにレシピセットが見つかりませんでした',
        ),
      )
      const errorMsgBox = await rsPage
        .getByText('指定されたURLにレシピセットが見つかりませんでした', { exact: false })
        .first()
        .boundingBox()
      const urlInputBox = await urlInput.boundingBox()
      check(
        'RECIPESET-01(修正4) 結果メッセージが読み込み欄(URL入力)より上に表示される',
        !!errorMsgBox && !!urlInputBox && errorMsgBox.y < urlInputBox.y,
      )
      check(
        'RECIPESET-01(修正4) 下部トースト(押して閉じるボタン)としては出ない(二重表示しない)',
        (await rsPage
          .getByRole('button', { name: '指定されたURLにレシピセットが見つかりませんでした', exact: false })
          .count()) === 0,
      )

      // Pro解錠(2026-07-16修正1: review2.jsonにsetIdが付いたため課金ゲート対象になった。
      // 実際のPro解錠コードは販売台帳の原本なのでリポジトリにコミットできないため、NUT-02と同様
      // settings.proCodeをIndexedDBへ直接書き込んで「解錠済み」状態だけを再現する)
      await rsPage.evaluate(async () => {
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
      await rsPage.reload({ waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(800)
      await rsPage.getByRole('button', { name: 'レシピ', exact: true }).click()
      await rsPage.waitForTimeout(300)

      // 成功パス(Pro解錠済みなのでsetId付きのreview2セットも取り込める)
      await urlInput.fill(`${BASE}/sets/data/review2.json`)
      await loadUrlBtn.click()
      await rsPage.waitForTimeout(1000)
      const afterSuccessText = await rsPage.textContent('body')
      check(
        'RECIPESET-01(修正4) 成功時も「◯件追加しました」が読み込み欄の上部に出る',
        /\d+件追加しました/.test(afterSuccessText),
      )
      check(
        'RECIPESET-01(修正4) 直前のエラーメッセージは成功後には残らない',
        !afterSuccessText.includes('指定されたURLにレシピセットが見つかりませんでした'),
      )

      // setName表示の確認(2026-07-16修正1): setId/setName付きで取り込んだレシピはsourceSetNameが
      // 入り、レシピ一覧カードのテーマ名バッジに反映される(基本レシピの「基本レシピ」バッジと混ざらない)
      await rsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(800)
      const importedCardText = await rsPage
        .locator('a[href^="#/recipes/"]', { hasText: '豆腐ときのこの和風あんかけ' })
        .first()
        .textContent()
      check(
        'RECIPESET-01(修正1) setId/setName付きセットの取り込み後、カードにテーマ名バッジ(setName)が出る',
        !!importedCardText && importedCardText.includes('【下見】第2弾 がまんしないダイエットごはん'),
        `カードテキスト=${importedCardText}`,
      )
    } finally {
      await rsBrowser.close()
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

  // --- PRICEUNIT-01: 「食材と価格」の単位入力UI改修(2026-07-15オーナー実機フィードバック:
  // 単位欄が自由入力だと不安・使いにくい)。新規追加フォームで数量(数字)＋単位(選択)を別々に
  // 入力して追加すると、保存形式は従来どおり1つの文字列に合成される(「2」＋「個」→「2個」)ことを
  // IndexedDBの実データで確認する。加えて、既存デフォルト行(玉ねぎ)の数量欄を新UIで書き換えると
  // 「デフォルトに戻す」ボタンが出現し、押すと数量・単位ともに投入時の状態(1個)へ戻り
  // ボタンも再び消えることを確認する。他チェックの解錠状態・データに影響しないよう
  // 専用のbrowser/contextで完結させる ---
  currentCheck = 'PRICEUNIT-01'
  {
    const puBrowser = await chromium.launch()
    try {
      const puContext = await puBrowser.newContext()
      const puPage = await puContext.newPage()
      puPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@PRICEUNIT-01] ${err.message}`)
      })
      await puPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(1800) // 初回シード完了待ち(食材価格マスタの初期投入含む)

      await puPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(500)

      // 新規追加: 名前「テスト食材」・価格「500」・数量「2」・単位「個」で追加する
      await puPage.getByLabel('食材名', { exact: true }).fill('テスト食材')
      await puPage.getByLabel('価格（円）', { exact: true }).fill('500')
      await puPage.getByLabel('数量', { exact: true }).fill('2')
      await puPage.getByLabel('単位', { exact: true }).selectOption('個')
      await puPage.getByRole('button', { name: '追加', exact: true }).click()
      await puPage.waitForTimeout(400)

      const testRow = puPage.locator('li', { hasText: 'テスト食材' })
      check('PRICEUNIT-01 追加した食材が一覧に並ぶ', (await testRow.count()) === 1)

      // 保存形式が従来どおり1つの文字列(「2個」)に合成されていることをIndexedDBの実データで確認
      // (updatePriceEntryのisDefault再判定が文字列比較のため、合成結果の完全一致が最重要)
      const savedTestEntry = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === 'テスト食材')
      })
      check(
        'PRICEUNIT-01 数量「2」+単位「個」が「2個」の1文字列に合成されて保存される',
        savedTestEntry?.unit === '2個' && savedTestEntry?.pricePerUnit === 500,
        `savedTestEntry=${JSON.stringify(savedTestEntry)}`,
      )

      // 一覧の行は「2個」を数量欄「2」＋単位選択「個」に分解して表示する(往復確認)
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を数量欄「2」に分解して表示する',
        (await testRow.getByLabel('テスト食材の数量').inputValue()) === '2',
      )
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を単位選択「個」に分解して表示する',
        (await testRow.getByLabel('テスト食材の単位').inputValue()) === '個',
      )

      // 既存のデフォルト行(玉ねぎ=1個50円)の数量を新UIで書き換えると「デフォルトに戻す」が出る
      const onionRow = puPage.locator('li', { hasText: '玉ねぎ' })
      check(
        'PRICEUNIT-01 編集前の玉ねぎ行には「デフォルトに戻す」が出ない',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const onionQtyInput = onionRow.getByLabel('玉ねぎの数量')
      await onionQtyInput.fill('3')
      await onionQtyInput.press('Enter') // Enterでblur→保存
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 数量欄(新UI)を書き換えると「デフォルトに戻す」が出る',
        (await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const savedOnionAfterEdit = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === '玉ねぎ')
      })
      check(
        'PRICEUNIT-01 数量「3」への書き換えが「3個」の1文字列に合成されて保存される',
        savedOnionAfterEdit?.unit === '3個',
        `savedOnionAfterEdit=${JSON.stringify(savedOnionAfterEdit)}`,
      )

      // 「デフォルトに戻す」で投入時の状態(数量「1」・単位「個」)に戻り、ボタンも再び消える
      await onionRow.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後はボタンが再び消える',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は数量欄が「1」に戻る',
        (await onionRow.getByLabel('玉ねぎの数量').inputValue()) === '1',
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は単位選択が「個」に戻る',
        (await onionRow.getByLabel('玉ねぎの単位').inputValue()) === '個',
      )
    } finally {
      await puBrowser.close()
    }
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

  // --- IMPORTCONFIRM-01: 「読み込む(今のデータと置き換え)」は押した瞬間に確認なしでファイル選択
  // ダイアログが開いてしまっていた穴(2026-07-16 UI総点検P6 高重要度所見・オーナーのデータ消失事故の
  // 再発防止)を、ファイル選択を開く前にwindow.confirmを挟むことで塞いだ。(a)ボタン押下で実際に
  // confirmダイアログが出ること (b)キャンセルするとファイル選択(filechooser)には進まないこと
  // (c)承認(accept)すると実際にファイル選択へ進むこと、の3点を確認する。承認後に実際のファイルを
  // 選んで復元まで成功することはBACKUP-01で確認済みのため、ここではfilechooserが開くところまでに留める ---
  currentCheck = 'IMPORTCONFIRM-01'
  {
    const icBrowser = await chromium.launch()
    try {
      const icContext = await icBrowser.newContext()
      const icPage = await icContext.newPage()
      icPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IMPORTCONFIRM-01] ${err.message}`)
      })
      await icPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(1800) // 初回シード完了待ち
      await icPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(500)
      await icPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await icPage.waitForTimeout(300)

      // (a)(b) ボタン押下でconfirmダイアログが実際に出ることを検知し、キャンセル(dismiss)する。
      // キャンセルした場合はファイル選択(filechooser)には進まないはず
      let dialogSeen = null
      icPage.once('dialog', (dialog) => {
        dialogSeen = { type: dialog.type(), message: dialog.message() }
        void dialog.dismiss()
      })
      let filechooserFired = false
      icPage.once('filechooser', () => {
        filechooserFired = true
      })
      await icPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click()
      await icPage.waitForTimeout(500)
      check(
        'IMPORTCONFIRM-01 置き換えボタン押下でconfirmダイアログが出る',
        dialogSeen?.type === 'confirm' && dialogSeen.message.includes('置き換えます'),
        `dialogSeen=${JSON.stringify(dialogSeen)}`,
      )
      check(
        'IMPORTCONFIRM-01 confirmをキャンセルするとファイル選択(filechooser)には進まない',
        !filechooserFired,
      )

      // (c) 同じボタンをもう一度押し、今度はconfirmを承認(accept)すると実際にファイル選択へ進むこと
      const [fileChooser] = await Promise.all([
        icPage.waitForEvent('filechooser'),
        (async () => {
          icPage.once('dialog', (dialog) => void dialog.accept())
          await icPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click()
        })(),
      ])
      check('IMPORTCONFIRM-01 confirmを承認するとファイル選択(filechooser)が開く', !!fileChooser)
    } finally {
      await icBrowser.close()
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

  // --- PRICEVIEW-01: レシピ詳細の材料「価格ビュー」トグル(2026-07-15 オーナー要望「どの食材が
  // 値段に反映されているか分からない」への対応)。材料行ごとの常時価格表示は「うるさい」の理由で
  // 2026-07-14に廃止済みのため、既定OFFのトグルチップで表示/非表示を切り替える方式。
  // 基本レシピ「肉じゃが」で、OFF時は材料セクションに金額表示が無いこと→「価格を見る」で
  // 「約◯円」の行が現れ「食材と価格を編集する」への案内リンクも出ること→「価格を隠す」で
  // 両方とも消えることを確認する。由来バッジ(目安/自分の価格)は同日のオーナー仕様変更で
  // 表示廃止になったため確認しない ---
  currentCheck = 'PRICEVIEW-01'
  {
    const pvBrowser = await chromium.launch()
    const pvContext = await pvBrowser.newContext()
    const pvPage = await pvContext.newPage()
    pvPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PRICEVIEW-01] ${err.message}`)
    })
    try {
      await pvPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pvPage.waitForTimeout(1800) // 初回シード完了待ち
      await pvPage.getByText('肉じゃが', { exact: true }).first().click()
      await pvPage.waitForTimeout(500)

      // 材料セクション(見出し「材料」を含むsection)だけを対象にする。ページ上部の
      // 概算食費(合計・1食あたり)は価格ビューと無関係に元から「約◯円」を表示するため、
      // body全体ではなくこのsectionに絞らないとOFF時の検証が誤って通ってしまう
      const ingredientsSection = pvPage.locator('section', {
        has: pvPage.getByRole('heading', { name: '材料', level: 2 }),
      })

      const beforeText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 既定OFF: 材料行に金額表示(約◯円)が無い',
        !/約[\d,]+円/.test(beforeText ?? ''),
        beforeText ?? '',
      )
      check(
        'PRICEVIEW-01 既定OFF: 「食材と価格を編集する」リンクが材料セクションに無い',
        !(beforeText ?? '').includes('食材と価格を編集する'),
      )

      await pvPage.getByRole('button', { name: '価格を見る' }).click()
      await pvPage.waitForTimeout(300)
      const onText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「価格を見る」ON: 「約◯円」の行が1つ以上ある',
        /約[\d,]+円/.test(onText ?? ''),
        onText ?? '',
      )
      check(
        'PRICEVIEW-01 「価格を見る」ON: マスタ不一致の材料(水)は「価格なし」になる',
        (onText ?? '').includes('価格なし'),
      )
      check(
        'PRICEVIEW-01 「価格を見る」ON: 「食材と価格を編集する」リンクが表示される',
        (onText ?? '').includes('食材と価格を編集する'),
      )
      check(
        'PRICEVIEW-01 ON: 登録人数の基準注記が表示される(2人分)',
        (onText ?? '').includes('登録人数（2人分）の材料の目安'),
      )

      await pvPage.getByRole('button', { name: '価格を隠す' }).click()
      await pvPage.waitForTimeout(300)
      const afterText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「価格を隠す」OFF: 金額表示が消える',
        !/約[\d,]+円/.test(afterText ?? ''),
        afterText ?? '',
      )
      check(
        'PRICEVIEW-01 「価格を隠す」OFF: 「食材と価格を編集する」リンクも消える',
        !(afterText ?? '').includes('食材と価格を編集する'),
      )
    } finally {
      await pvBrowser.close()
    }
  }

  // --- FORMTABS-01: レシピ編集フォームの「かんたん/くわしく」タブ分け(2026-07-16 Fable裁定
  // docs/26・案A承認)。(a)新規登録の初期表示は常に「かんたん」タブで、かんたんタブの入力だけで
  // 保存が成功すること (b)「くわしく」タブ側フィールドに入力があると見出し右の●
  // (aria-label「入力済みの項目があります」)が出ること・空のうちは出ないこと
  // (c)「くわしく」タブを表示中に料理名未入力のまま保存すると、エラー表示とともに
  // 「かんたん」タブへ自動的に戻ること (d)実装は両タブのDOMを常時マウントし`hidden`属性で
  // 切り替えるだけのため、くわしくタブの入力内容がタブ往復でも消えない(state維持)ことを確認する ---
  currentCheck = 'FORMTABS-01'
  {
    const ftBrowser = await chromium.launch()
    const ftContext = await ftBrowser.newContext()
    const ftPage = await ftContext.newPage()
    ftPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMTABS-01] ${err.message}`)
    })
    try {
      await ftPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1800) // 初回シード完了待ち

      // (a) 新規登録の初期表示は常に「かんたん」タブ。かんたんタブの入力だけで保存が成功する
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const simpleTab = ftPage.getByRole('tab', { name: 'かんたん' })
      const detailTab = ftPage.getByRole('tab', { name: 'くわしく' })
      check(
        'FORMTABS-01a 新規登録の初期表示は「かんたん」タブ(aria-selected)',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )
      await ftPage.getByPlaceholder('例: 肉じゃが').fill('E2Eタブかんたん保存確認レシピ')
      await ftPage.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
      await ftPage.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(800)
      check(
        'FORMTABS-01a かんたんタブの入力だけで保存が成功する(くわしくは未入力のまま)',
        (await ftPage.textContent('body')).includes('E2Eタブかんたん保存確認レシピ'),
      )
      // 後始末: 検証用に作成したレシピを削除
      await ftPage.locator('a[href*="/edit"]').first().click()
      await ftPage.waitForTimeout(500)
      await ftPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await ftPage.waitForTimeout(800)

      // (b) くわしくタブが空のうちは●が出ず、入力があると出る
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const dotBefore = await ftPage.locator('[aria-label="入力済みの項目があります"]').count()
      check('FORMTABS-01b くわしくタブが空のうちは●が出ない', dotBefore === 0)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByPlaceholder('気づいたこと・アレンジなどを自由に').fill('E2Eタブ確認メモ')
      await ftPage.waitForTimeout(200)
      const dotAfter = await ftPage.locator('[aria-label="入力済みの項目があります"]').count()
      check('FORMTABS-01b くわしくに入力があると見出し右に●が出る', dotAfter > 0)

      // (c) くわしくタブを表示中に料理名未入力のまま保存すると、エラー表示+「かんたん」タブへ戻る
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(300)
      check(
        'FORMTABS-01c 料理名未入力で保存するとエラーが表示される',
        (await ftPage.textContent('body')).includes('料理名を入力してください'),
      )
      check(
        'FORMTABS-01c 料理名未入力で保存すると「かんたん」タブへ自動的に戻る',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )

      // (d) タブ往復してもくわしくタブの入力内容が消えない(両タブのDOMを常時マウントし
      // hidden属性で切り替えているだけの実装であることの確認)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      const memoBeforeSwitch = await ftPage
        .getByPlaceholder('気づいたこと・アレンジなどを自由に')
        .inputValue()
      check(
        'FORMTABS-01d くわしくタブへ戻るとメモの入力内容がまだ残っている(切替前確認)',
        memoBeforeSwitch === 'E2Eタブ確認メモ',
      )
      await ftPage.getByRole('tab', { name: 'かんたん' }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      const memoAfterSwitch = await ftPage
        .getByPlaceholder('気づいたこと・アレンジなどを自由に')
        .inputValue()
      check(
        'FORMTABS-01d かんたん→くわしくと切り替えてもメモの入力内容が残っている(state維持)',
        memoAfterSwitch === 'E2Eタブ確認メモ',
      )
    } finally {
      await ftBrowser.close()
    }
  }

  // --- FORMRESET-01: レシピ編集画面の「デフォルトに戻す」(2026-07-15 オーナー要望)。
  // DBには書き込まずフォームの入力値だけを差し替える安全設計。window.confirmは使わず、
  // もう一度押す方式(1回目はラベルが確認文言に変わるだけ・2回目で実行)で誤操作を防ぐ ---
  currentCheck = 'FORMRESET-01'
  {
    const frBrowser = await chromium.launch()
    const frContext = await frBrowser.newContext()
    const frPage = await frContext.newPage()
    frPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMRESET-01] ${err.message}`)
    })
    try {
      // (a) 基本レシピ「肉じゃが」: タイトル・材料を書き換えてからリセット
      // → starterDefsの原本に戻り、保存しなければ実データ(DB)も壊れないことを確認
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(1800) // 初回シード完了待ち
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)

      const titleInput = frPage.getByPlaceholder('例: 肉じゃが')
      await titleInput.fill('テスト改名')
      const firstIngredientInput = frPage.getByPlaceholder('例: じゃがいも').first()
      await firstIngredientInput.fill('テスト材料')

      check(
        'FORMRESET-01a 基本レシピの編集画面に「デフォルトに戻す」ボタンが出る',
        await frPage.getByRole('button', { name: 'デフォルトに戻す' }).isVisible(),
      )
      await frPage.getByRole('button', { name: 'デフォルトに戻す' }).click()
      await frPage.waitForTimeout(200)
      check(
        'FORMRESET-01a 1回目のクリックでは実行されず「もう一度押すと戻します」に変わる',
        await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).isVisible(),
      )
      check(
        'FORMRESET-01a 確認待ちの間はまだ変更後のタイトルのまま',
        (await titleInput.inputValue()) === 'テスト改名',
      )

      await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).click()
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01a 2回目のクリックでタイトルが原本(肉じゃが)に戻る',
        (await titleInput.inputValue()) === '肉じゃが',
      )
      check(
        'FORMRESET-01a 材料も原本(じゃがいも)に戻る',
        (await firstIngredientInput.inputValue()) === 'じゃがいも',
      )
      check(
        'FORMRESET-01a 保存前の軽いフィードバックが表示される',
        (await frPage.textContent('body')).includes('まだ保存されていません。保存すると確定します'),
      )

      // 保存せずに一覧へ離脱しても実データが壊れていないことを確認
      // (テスト改名・テスト材料のどちらもDBに書き込まれていないこと)
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      const frListText = await frPage.textContent('body')
      check('FORMRESET-01a 離脱後も一覧に「肉じゃが」がそのまま残る', frListText.includes('肉じゃが'))
      check('FORMRESET-01a 離脱後、一覧に「テスト改名」は存在しない', !frListText.includes('テスト改名'))
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      const frDetailText = await frPage.textContent('body')
      check(
        'FORMRESET-01a 実データの材料も書き換わっていない(じゃがいもが残る・テスト材料は無い)',
        frDetailText.includes('じゃがいも') && !frDetailText.includes('テスト材料'),
      )

      // (b) 自作レシピ: 新規登録→保存→編集でタイトル変更→リセットで前回保存タイトルに戻ることを確認
      // (自作レシピはラベルが「前回保存した内容に戻す」で、スターターの「デフォルトに戻す」とは異なる)
      await frPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      await frPage.getByPlaceholder('例: 肉じゃが').fill('FORMRESET自作レシピ')
      await frPage.getByPlaceholder('例: じゃがいも').first().fill('にんじん')
      await frPage.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('切る')
      await frPage.getByRole('button', { name: '保存する' }).click()
      await frPage.waitForTimeout(800)
      check(
        'FORMRESET-01b 自作レシピの新規保存が成功する',
        (await frPage.textContent('body')).includes('FORMRESET自作レシピ'),
      )

      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)
      check(
        'FORMRESET-01b 自作レシピの編集画面は「前回保存した内容に戻す」ボタンになる',
        await frPage.getByRole('button', { name: '前回保存した内容に戻す' }).isVisible(),
      )
      const ownTitleInput = frPage.getByPlaceholder('例: 肉じゃが')
      await ownTitleInput.fill('FORMRESET改名後')
      await frPage.getByRole('button', { name: '前回保存した内容に戻す' }).click()
      await frPage.waitForTimeout(200)
      await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).click()
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01b 2回目のクリックで前回保存したタイトルに戻る',
        (await ownTitleInput.inputValue()) === 'FORMRESET自作レシピ',
      )
    } finally {
      await frBrowser.close()
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
