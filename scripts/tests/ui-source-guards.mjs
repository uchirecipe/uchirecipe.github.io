// 画面のソースを読む見張り（配色トークン・折りたたみ・スクロール）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import { CARD_DENSITIES, densityForListLayout } from '../../src/logic/cardDensity.ts'
import {
  CARD_PART_KEYS,
  CARD_PLACE_PARTS,
  DEFAULT_CARD_PLACE,
  cardPartsFor,
} from '../../src/logic/cardParts.ts'
import { ja } from '../../src/i18n/ja.ts'
// 2026-08-27 便LR: 取り込み直後の欄の項目と、画面に出す行が1対1であることを見る（LR-2）
import { IMPORT_FIELD_KEYS } from '../../src/logic/importFieldGaps.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// ---------- 便CY: 配色トークンの取りこぼし防止(2026-08-02 オーナー確定の面別アクセント) ----------
// 色は src/index.css と public/about 配下7ファイルが「同じ値を別々に書き写している」構造で、
// 片方だけ直して見た目がずれる事故が実際に起きている(規約E-③)。ここで静的に突き合わせる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const css = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')

  // (1) 4テーマすべてが「面別」の2本を持つこと。1本だけの --accent-ink: <色> の直書きが
  //     残っていると、テーマを足したときに面別の切り替えから漏れる
  const themeBlocks = [
    ['ライト', /:root \{[\s\S]*?\n\}/],
    ['ダーク(端末設定)', /@media \(prefers-color-scheme: dark\) \{[\s\S]*?\n {2}\}\n\}/],
    ['ダーク(手動)', /:root\[data-theme="dark"\] \{[\s\S]*?\n\}/],
    ['ブラウン', /:root\[data-theme="brown"\] \{[\s\S]*?\n\}/],
    ['グリーン', /:root\[data-theme="green"\] \{[\s\S]*?\n\}/],
  ]
  for (const [name, re] of themeBlocks) {
    const block = css.match(re)?.[0] ?? ''
    eq(`CY 色 ${name}が--accent-ink-pageを持つ`, /--accent-ink-page:/.test(block), true)
    eq(`CY 色 ${name}が--accent-ink-surfaceを持つ`, /--accent-ink-surface:/.test(block), true)
  }

  // (2) オーナー確定値そのもの(2026-08-02・docs/色調整見本2_ブラウングリーン.html)
  const val = (block, name) => css.match(block)?.[0]?.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]
  eq('CY 色 ライトの塗り--accentは#cc3f01', val(/:root \{[\s\S]*?\n\}/, '--accent'), '#cc3f01')
  eq(
    'CY 色 ブラウンはページ背景用#833a00',
    val(/:root\[data-theme="brown"\] \{[\s\S]*?\n\}/, '--accent-ink-page'),
    '#833a00',
  )
  eq(
    'CY 色 ブラウンはカード面用#ad4e01',
    val(/:root\[data-theme="brown"\] \{[\s\S]*?\n\}/, '--accent-ink-surface'),
    '#ad4e01',
  )
  eq(
    'CY 色 グリーンは両面とも#c25200',
    [
      val(/:root\[data-theme="green"\] \{[\s\S]*?\n\}/, '--accent-ink-page'),
      val(/:root\[data-theme="green"\] \{[\s\S]*?\n\}/, '--accent-ink-surface'),
    ],
    ['#c25200', '#c25200'],
  )

  // (3) カード面で値を差し替えるスコープ規則が消えていないこと
  //     (これが無いとブラウンのカード面が濃すぎる方の色に戻る)
  eq(
    'CY 色 カード面スコープの規則がある',
    /\[class~="bg-surface"\][\s\S]{0,80}--accent-ink: var\(--accent-ink-surface\)/.test(css),
    true,
  )

  // (4) 静的ページ8ファイルが同じ値を書き写していること
  //     (foods.htmlは便CXで追加した機械生成ページ。生成元 scripts/gen-food-price-page.mjs にも
  //      同じ色定義が書いてあるので、色を変えるときは生成スクリプト側を直して再生成する)
  const aboutFiles = [
    'index.html',
    'manual.html',
    'terms.html',
    'unlock.html',
    'foods.html',
    'column/index.html',
    'column/kondate-kimaranai.html',
    'column/recipe-screenshot-seiri.html',
  ]
  const aboutDir = path.join(appRoot, 'public/about')
  const aboutColors = aboutFiles.map((f) => {
    const src = readFileSync(path.join(aboutDir, f), 'utf-8')
    const pick = (name) => (src.match(new RegExp(`${name}:\\s*([^;]+);`, 'g')) ?? []).map((s) => s.split(':')[1].trim().replace(';', ''))
    return { file: f, accent: pick('--accent'), page: pick('--accent-ink-page'), surface: pick('--accent-ink-surface') }
  })
  eq('CY 色 aboutは8ファイル', aboutColors.length, 8)
  for (const c of aboutColors) {
    // ライト→ダークの順に1回ずつ、計2つ出てくる
    eq(`CY 色 ${c.file} の塗り(ライト/ダーク)`, c.accent, ['#cc3f01', '#ff8a4c'])
    eq(`CY 色 ${c.file} のページ背景用文字色`, c.page, ['#b8380a', '#ff8a4c'])
    eq(`CY 色 ${c.file} のカード面用文字色`, c.surface, ['#b8380a', '#ff8a4c'])
  }
}

// ---------- 便GW: 確認の窓をアプリ全体で1つの見た目にそろえる ----------
// オーナー原文「アプリ全体に、確認などで表示される窓が見づらく、見ていて楽しくなる画面じゃない。
// 事実を的確に伝えるのも重要。見やすさも重要」／利用者テスト「アプリの中で急に素のポップアップが
// 出るのは違和感があります」。素のダイアログ(window.confirm)は文字しか出せず、太字も箇条書きも
// 作れないので、画面の中の窓(components/ConfirmDialog)へ全件移した。
//
// ここで測るのは「あとから素のダイアログに戻る事故」を防ぐことの1点。
// 置き場所や件数ではなく**src全体に1つも無いこと**を見るので、画面が増えても勝手に守られる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  /**
   * 素のダイアログを残してよい場所（残すと決めたものは理由つきでここに書く）。
   * いまは1つも無い。増やすときは「なぜ画面の中の窓にできないか」を必ず添えること
   */
  const RAW_DIALOG_ALLOWLIST = new Map()
  const collectSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...collectSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  const offenders = []
  for (const full of collectSources(path.join(appRoot, 'src'))) {
    const rel = path.relative(appRoot, full).split(path.sep).join('/')
    const lines = readFileSync(full, 'utf-8').split('\n')
    lines.forEach((line, i) => {
      // 説明のためにコメントへ書いた「window.confirm」は対象外(行頭が // や * のもの)
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return
      if (!/window\.(confirm|prompt)\s*\(/.test(line)) return
      if (RAW_DIALOG_ALLOWLIST.has(rel)) return
      offenders.push(`${rel}:${i + 1}`)
    })
  }
  eq('GW-1 素のダイアログ(window.confirm/prompt)がsrcに1つも残っていない', offenders, [])

  // 規約F「『よろしいですか？』だけは禁止」。窓になった今は、何をするかは見出しが、
  // 実行するかどうかは動詞のボタンが受け持つので、本文の末尾に置く定型句は要らなくなった。
  // ja.ts の値を丸ごと見るので、新しい確認文で書き足しても引っかかる
  const jaTexts = []
  const walkJa = (node) => {
    if (typeof node === 'string') jaTexts.push(node)
    else if (Array.isArray(node)) node.forEach(walkJa)
    else if (node && typeof node === 'object') Object.values(node).forEach(walkJa)
  }
  walkJa(ja)
  // BudouXのゼロ幅スペースが混じっても外れないよう、照合前に外す(禁じ手②)
  const stripZeroWidth = (text) => text.replaceAll('​', '')
  eq(
    'GW-2 UI文言に「よろしいですか」で終わる確認文が残っていない',
    jaTexts.filter((text) => stripZeroWidth(text).includes('よろしいですか')),
    [],
  )
}

// ---------- 便HD: 縦にだけ送る箱が、横にも動かせてしまう（2026-08-16 オーナー実機 iPhone SE2/Safari） ----------
// オーナー実機「作った！の窓の中の情報量が多すぎて、縦横にスクロールできる状態でした。
// 写真はわかりやすいように右下を表示したものなので、余白や見出しもちゃんとありました」。
//
// 起きていたこと（便HDが実測で突き止めた機序）:
//  ① `src/index.css` の body に `hanging-punctuation: allow-end` がある。行末の約物（」）。、）を
//     行の外へぶら下げる指定で、**Safari系だけが実装している**（Chromiumは未実装＝何も起きない）。
//  ② Safari はぶら下げたぶんを「右へのはみ出し」として記録する。実測で、文字14pxの行に対して13px、
//     文字18px太字の行に対して17px。**見た目にはみ出しているのは1px程度**で、残りは中身の無い余白。
//  ③ 窓は `overflow-y-auto` だけを指定していた。CSSの規定で、**片方の軸が visible でなくなると
//     もう片方の visible は auto に変わる**ため、`overflow-x` が auto になっていた
//     ＝窓は横にも送れる箱になっていた。
//  ④ ②のはみ出しが窓の左右の余白（16px＋枠1px）を超えると、窓が実際に横へ動く。
//     便HDの再現実験では 18px 太字の行で `scrollWidth - clientWidth = 1`、実際に横へ1px動いた。
//     どの行が余白を超えるかは端末の字形と折り返し位置しだいなので、Chromiumでも、
//     PCのSafariでも出ないのに実機だけで出る、という形になる。
//
// ここで測るのは「縦にだけ送るつもりの箱が、横にも動ける状態になっていないか」の1点。
// 置き場所や件数ではなく **src全体に1つも無いこと** を見るので、窓が増えても勝手に守られる。
// 見た目は変わらない（横に動かせないだけで、はみ出しはもともと余白の中に収まっている）。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const collectSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...collectSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  /**
   * 指定のかたまり（'...' "..." `...`）を取り出す。コメントの中の「'」を
   * 文字列の始まりと取り違えないよう、コメントと文字列を1文字ずつ見分けて拾う
   * （説明文に overflow-y-auto と書いただけの行を落とさないため）
   */
  const collectStringLiterals = (src) => {
    const out = []
    let i = 0
    let line = 1
    while (i < src.length) {
      const c = src[i]
      if (c === '\n') {
        line++
        i++
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++
      } else if (c === '/' && src[i + 1] === '*') {
        i += 2
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        const startLine = line
        const quote = c
        let value = ''
        i++
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') {
            i += 2
            continue
          }
          if (src[i] === '\n') line++
          value += src[i]
          i++
        }
        i++
        out.push({ value, line: startLine })
      } else i++
    }
    return out
  }
  /**
   * 横にも送れてよい箱は `overflow-x-auto` などを自分で書けば対象外になる
   * （判定は「同じ指定のかたまりの中に overflow-x-* があるか」）
   */
  const offenders = []
  for (const full of collectSources(path.join(appRoot, 'src'))) {
    const rel = path.relative(appRoot, full).split(path.sep).join('/')
    for (const { value, line } of collectStringLiterals(readFileSync(full, 'utf-8'))) {
      if (!value.includes('overflow-y-auto')) continue
      if (/overflow-x-(hidden|auto|scroll|clip)/.test(value)) continue
      offenders.push(`${rel}:${line}`)
    }
  }
  eq(
    'HD-1 縦にだけ送る箱(overflow-y-auto)は、横に動けないことも書いてある',
    offenders,
    [],
  )

  // 窓そのもの（利用者が「作った！」で開くもの）が、いま横に動けない指定になっていること。
  // 上の掃引はsrc全体を見るが、こちらは**オーナーが実機で触った窓**を名指しで押さえる
  const cookedLogSrc = readFileSync(
    path.join(appRoot, 'src/components/CookedLogModal.tsx'),
    'utf-8',
  )
  eq(
    'HD-2 「作った記録をつける」の窓は横に動かせない',
    /overflow-x-hidden[^"'`]*overflow-y-auto|overflow-y-auto[^"'`]*overflow-x-hidden/.test(
      cookedLogSrc,
    ),
    true,
  )
}

// --- 日付の欄が枠からはみ出さない（2026-08-16 オーナー実機・iPhone SE2）。
//     iOSでは中の値が独立した箱で描かれ、既定の余白と最小幅を持つため width:100% では抑えられない。
//     手元のブラウザでは再現しないので、**指定が消えていないこと**を見張る ---
{
  const heRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const css = readFileSync(path.join(heRoot, 'src/index.css'), 'utf-8')
  eq(
    'HE-1 日付の欄の中の値から、既定の余白と最小幅を外している',
    /::-webkit-date-and-time-value[\s\S]{0,120}margin:\s*0/.test(css) &&
      /::-webkit-date-and-time-value[\s\S]{0,120}min-width:\s*0/.test(css),
    true,
  )
  eq(
    'HE-1 iOSのときだけ日付欄の見た目の作り直しを外す（デスクトップの印を消さない）',
    /@supports \(-webkit-touch-callout: none\)[\s\S]{0,200}input\[type='date'\][\s\S]{0,120}appearance:\s*none/.test(
      css,
    ),
    true,
  )
  eq(
    'HE-1 日付の欄そのものにも縮む指定がある',
    /input\[type='date'\]\s*\{[\s\S]{0,120}min-width:\s*0/.test(css),
    true,
  )
}

// ---------- 便HE: 窓の中を送るつもりが、後ろの画面が動く（2026-08-16 オーナー実機 iPhone SE2/Safari） ----------
// オーナー原文「窓の見た目は直りました！しかし、窓内を縦にスクロールするつもりが、
// 後ろの画面が動いてしまうことがあります。」
//
// 便HEがWebKit(Safariと同じ描画エンジン・375x667)で測って分かった、後ろが動く2つの経路:
//  ① 窓の外側（暗い背景）の上で払うと、そのまま後ろの画面が送られる（400px送ると400px動いた）
//  ② 窓の中を下端まで送ったあとさらに払うと、送りが後ろの画面へ移る
//     （scroll chaining。600px送ると後ろが600px動いた）
// 「ことがあります」＝いつも起きるわけではない、の正体は②で、窓の中の余りが尽きた瞬間から
// 後ろへ移るため、中身が短い窓・下端まで送っていないときは起きない。
//
// ここで見張るのは、直し方が消えていないこと（実機の指の動きは手元では作れないため）:
//  HE-2 縦に送る箱には、送りが外へ移らない指定（overscroll-contain）がある … ②の対策
//  HE-3 全面の窓を描くファイルは、後ろの画面を止める共通の仕組みを使っている … ①の対策
//  HE-4 その共通の仕組みが「重なっても1回だけ」「閉じたら元の位置へ戻す」を守っている
{
  const heAppRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const heSources = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...heSources(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full)
    }
    return out
  }
  /** コメントの中の引用符を文字列の始まりと取り違えないよう、HD-1 と同じ拾い方をする */
  const heStringLiterals = (src) => {
    const out = []
    let i = 0
    let line = 1
    while (i < src.length) {
      const c = src[i]
      if (c === '\n') {
        line++
        i++
      } else if (c === '/' && src[i + 1] === '/') {
        while (i < src.length && src[i] !== '\n') i++
      } else if (c === '/' && src[i + 1] === '*') {
        i += 2
        while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
          if (src[i] === '\n') line++
          i++
        }
        i += 2
      } else if (c === "'" || c === '"' || c === '`') {
        const startLine = line
        const quote = c
        let value = ''
        i++
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') {
            i += 2
            continue
          }
          if (src[i] === '\n') line++
          value += src[i]
          i++
        }
        i++
        out.push({ value, line: startLine })
      } else i++
    }
    return out
  }

  // --- HE-2: 縦に送る箱は、端まで送っても送りが外へ移らない ---
  // 置き場所や件数ではなく **src全体に1つも無いこと** を見るので、箱が増えても勝手に守られる
  // （overflow-x-hidden を足した便HD の掃引と同じやり方）。
  // わざと外へ移したい箱は overscroll-auto と自分で書けば対象外になる。
  const heChainable = []
  for (const full of heSources(path.join(heAppRoot, 'src'))) {
    const rel = path.relative(heAppRoot, full).split(path.sep).join('/')
    for (const { value, line } of heStringLiterals(readFileSync(full, 'utf-8'))) {
      if (!value.includes('overflow-y-auto')) continue
      if (/overscroll-(y-)?(contain|none|auto)/.test(value)) continue
      heChainable.push(`${rel}:${line}`)
    }
  }
  eq('HE-2 縦に送る箱は、端まで送っても送りが後ろの画面へ移らない', heChainable, [])

  // --- HE-3: 全面の窓は、後ろの画面を止める共通の仕組みを通っている ---
  // 数え方は「そのファイルにある全面の窓の数」と「後ろの画面を止める呼び出しの数」の対応。
  // 窓が増えたら止める呼び出しも増やす必要があるので、20枚以上ある窓のどれかが取り残される
  // ことがない（窓ごとに同じ処理を書き写す形にはしない＝呼ぶのは共通のフック1つ）。
  const heOverlayExempt = new Map([
    [
      'src/components/TermPopover.tsx',
      // 語をタップして出す小さな吹き出し。中に送る箱を持たず、画面が送られたら
      // 語との位置がずれるので**自分から閉じる**作り。止めると閉じられなくなる
      '用語の吹き出しは送られたら閉じる作りのため',
    ],
    [
      'src/components/dialogStyle.ts',
      // 2026-08-17 便HJ: 窓の見た目（クラス名）だけを置く場所で、窓そのものは描かない。
      // このクラス名を使って窓を描く側（ConfirmDialog／ChoiceDialog）は下の数え方で
      // ちゃんと1枚ずつ数えられるので、見張りは弱くならない
      'クラス名だけを置く場所で窓を描かないため（使う側で数える）',
    ],
  ])
  // 2026-08-27 便LQ（docs/74 第4手）: 献立の画面は「画面に出す形（MealPlanPage.tsx）」と
  // 「状態と手続き（mealPlan/useMealPlanState.ts）」に分かれた（中身は1文字も動かしていない）。
  // 窓を描くのは前者・後ろの画面を止める呼び出しは後者にあるので、**2つで1つの画面**として
  // 数える＝分ける前と同じ数え方（窓が増えたら止める呼び出しも増やす必要があるのは変わらない）
  const heLockCompanion = new Map([
    ['src/pages/MealPlanPage.tsx', 'src/pages/mealPlan/useMealPlanState.ts'],
  ])
  eq(
    'HE-3 前提: 窓と止める呼び出しが別のファイルに分かれている画面の、相方を読める',
    heLockCompanion.size > 0 &&
      [...heLockCompanion.values()].every((rel) => existsSync(path.join(heAppRoot, rel))),
    true,
  )
  const heMissingLock = []
  for (const full of heSources(path.join(heAppRoot, 'src'))) {
    const rel = path.relative(heAppRoot, full).split(path.sep).join('/')
    const src = readFileSync(full, 'utf-8')
    // 2026-08-17 便HJ: 窓の後ろ（暗い背景）のクラス名を components/dialogStyle.ts で
    // 分け合う形にしたので、そのクラス名を**使っている**ファイルも窓1枚として数える
    // （読み込みの行は使ったことにならないので数から外す）。見張る中身は変えていない
    // 2026-08-19 便HU: **コメントも数から外す**。「なぜ全面の下敷きを置かないのか」を
    // 説明した文章の中にクラス名を書いたら、実在しない窓として数えられて赤くなった。
    // 見張りたいのは実際に描いている窓なので、読み込みの行と同じくコメントも落とす
    const heBody = src
      .replace(/import\s[\s\S]*?from\s+'[^']+'/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    const overlays =
      (heBody.match(/fixed inset-0/g) ?? []).length +
      (heBody.match(/DIALOG_BACKDROP_CLS/g) ?? []).length
    if (overlays === 0) continue
    if (heOverlayExempt.has(rel)) continue
    const heCompanion = heLockCompanion.get(rel)
    const heLockSrc = heCompanion
      ? `${src}\n${readFileSync(path.join(heAppRoot, heCompanion), 'utf-8')}`
      : src
    const locks = (heLockSrc.match(/useScrollLock\(/g) ?? []).length
    if (locks < overlays) heMissingLock.push(`${rel}(窓${overlays}/止める呼び出し${locks})`)
  }
  eq('HE-3 全面の窓はすべて、後ろの画面を止める共通の仕組みを通っている', heMissingLock, [])
  eq(
    'HE-3 対象外にしている窓は、理由付きで1か所にまとまっている',
    [...heOverlayExempt.values()].every((reason) => reason.length > 0),
    true,
  )

  // --- HE-4: 共通の仕組みそのもの（重なっても1回だけ／閉じたら元の位置へ戻す） ---
  // 本物のブラウザは要らない部分なので、body と window の代わりを置いて動かす。
  // 見るのは「利用者が確かめたいこと」＝止めているあいだ見た目が動かず、閉じたら元の場所に戻ること
  {
    const heFakeStyle = () => ({ position: '', top: '', left: '', width: '', overflow: '' })
    const body = { style: heFakeStyle() }
    const html = { style: heFakeStyle(), clientWidth: 375 }
    const scrolled = []
    const fakeWindow = {
      scrollY: 0,
      location: { hash: '#/recipes' },
      scrollTo: (_x, y) => {
        fakeWindow.scrollY = y
        scrolled.push(y)
      },
    }
    const prevWindow = globalThis.window
    const prevDocument = globalThis.document
    globalThis.window = fakeWindow
    globalThis.document = { body, documentElement: html }
    try {
      const { acquireScrollLock, releaseScrollLock, scrollLockDepth } = await import(
        '../../src/components/useScrollLock.ts'
      )

      // 一覧を途中まで送ったところで窓を開く
      fakeWindow.scrollY = 640
      acquireScrollLock()
      eq('HE-4 窓を開いているあいだ、後ろの画面は動かせない', body.style.position, 'fixed')
      eq(
        'HE-4 止めた瞬間に見た目がずれない（送っていた位置ぶん上へずらして固定する）',
        body.style.top,
        '-640px',
      )
      eq('HE-4 止めているあいだの横幅は、止める前の幅のまま', body.style.width, '375px')

      // 窓が重なっても、止め方は1回だけ（全画面の調理中モードの上に確認の窓が重なる形）
      acquireScrollLock()
      eq('HE-4 窓が重なった数を数えている', scrollLockDepth(), 2)
      releaseScrollLock()
      eq('HE-4 上の窓を閉じただけでは、まだ止まったまま', body.style.position, 'fixed')
      eq('HE-4 上の窓を閉じただけでは、まだ元の位置へ戻さない', scrolled, [])

      // 最後の1枚を閉じたら、開く前の位置に戻る（ここが壊れると「戻ったら先頭に飛ぶ」になる）
      releaseScrollLock()
      eq('HE-4 最後の窓を閉じたら、後ろの画面は元どおり動かせる', body.style.position, '')
      eq('HE-4 最後の窓を閉じたら、開く前の位置に戻る', scrolled, [640])
      eq('HE-4 止める前に入れた指定は残さない', [body.style.top, body.style.width], ['', ''])
      eq('HE-4 数え直しも0に戻っている', scrollLockDepth(), 0)

      // 窓の中から別の画面へ移ったときは、移った先の位置に触らない
      scrolled.length = 0
      fakeWindow.scrollY = 300
      acquireScrollLock()
      fakeWindow.location.hash = '#/recipes/12'
      releaseScrollLock()
      eq('HE-4 窓の中から別の画面へ移ったときは、移った先を勝手に送らない', scrolled, [])
      eq('HE-4 別の画面へ移っても、固定は必ず外す', body.style.position, '')
    } finally {
      globalThis.window = prevWindow
      globalThis.document = prevDocument
    }
  }
}

// ==========================================================================================
// 便HL: 説明のページに、無くなった操作の名前を残さない（GONEWORD-1〜3）
//
// なぜ要るか: 2026-08-17 の作り替え（便HG/HH/HI/HJ）でアプリから消えた操作の名前が、
// 使い方ページと複数の端末で使う方法にそのまま残っていた。読んだ人は画面で探して見つからず、
// 「自分の操作が悪い」と受け取ることになる。説明文が正しいかどうかは機械では測れないが、
// **消した名前が残っていないこと**は測れるので、そこだけを見張る。
//
// 見る先はユーザーが読むページの本文だけ（HTMLのコメントは内部の説明なので外す）。
// アプリ側の文言（ja.ts）は消した名前をコメントで経緯として残しているので対象にしない。
//
// 新しい名前が入っているかも一緒に見る（消しただけで書き直し忘れると、その操作の説明が
// ページから丸ごと落ちる）。期待値は ja.ts の実物から取る＝アプリで名前を変えたら赤になる。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const pages = ['public/about/manual.html', 'public/about/index.html', 'public/about/multi-device.html']
  const bodyOf = (rel) =>
    readFileSync(path.join(appRoot, rel), 'utf-8').replace(/<!--[\s\S]*?-->/g, '')

  /** 無くなった名前と、いま同じことをする操作の名前（読む人がどこを見ればよいか分かる形で書く） */
  const goneNames = [
    // 2026-08-17 便HI: 献立の「日」から無くなった操作
    ['別の提案を見る', '「おまかせで献立を組む」を押し直す'],
    ['もう1品さがす', '畳んだ「今日なに作る？」の見出し'],
    // 同・その日の献立が空のときの案内文（「今日の献立」の枠ごと出なくなった）
    ['まだ今日つくるものが決まっていません', '「今日なに作る？」と「今日の献立を探す」'],
    ['レシピ一覧からまとめて選べます', '同上'],
    // 2026-08-18 便HM: オーナー指示の改名（「選ぶ」→「探す」）と、
    // 1品／献立をひとつの節にまとめたときに要らなくなった見出し
    ['今日の献立を選ぶ', '今日の献立を探す'],
    ['おまかせで組んだ献立', '「献立」に切り替えたときに出る主菜・副菜の候補'],
    // 2026-08-17 便HH: 献立の「日」から外したボタン（行き先はレシピ一覧と、その絞り込みに残っている）
    ['「レシピを探す」', '下の並びの「レシピ」'],
    ['「在庫の食材から探す」', 'レシピ一覧の「在庫の食材で絞る」'],
    // 同・改名前の名前
    ['おまかせで提案', 'おまかせで献立を組む'],
    ['ほかの候補を見る', 'ランダムで1品出す'],
  ]
  for (const rel of pages) {
    const body = bodyOf(rel)
    for (const [gone, now] of goneNames) {
      eq(`GONEWORD-1 ${rel} に無くなった名前「${gone}」が残っていない（今は ${now}）`, body.includes(gone), false)
    }
  }

  // 2026-08-17 便HJ: 選び終わったあとの3つは、帯のボタン（「選択したレシピ◯品を…」）から
  // 窓の道（「ファイルに書き出す」「削除する」）へ移した。
  // 「選択したレシピ◯品を今日の献立に入れる」だけは残っている（献立から来た選択モードのボタン）ので、
  // 書き出し・削除の2つだけを見張る
  const goneSelectButtons = [
    [/選択したレシピ[^」]*を書き出す/, ja.recipes.selectActionExport],
    [/選択したレシピ[^」]*を削除/, ja.recipes.selectActionDelete],
  ]
  for (const rel of pages) {
    const body = bodyOf(rel)
    for (const [pattern, now] of goneSelectButtons) {
      const hit = body.match(pattern)
      eq(`GONEWORD-2 ${rel} に帯のころのボタン名が残っていない（今は「${now}」）`, hit?.[0] ?? null, null)
    }
  }

  // 書き直したあとの名前が入っているか。期待値はアプリの文言そのもの
  const manual = bodyOf('public/about/manual.html')
  const multiDevice = bodyOf('public/about/multi-device.html')
  const selectActionsTitle = ja.recipes.selectActionsTitle.replace('{n}', '◯')
  eq('GONEWORD-3 使い方ページに「選び終わる」が書いてある', manual.includes(ja.recipes.selectFinish), true)
  eq(`GONEWORD-3 使い方ページに「${selectActionsTitle}」が書いてある`, manual.includes(selectActionsTitle), true)
  eq('GONEWORD-3 使い方ページに窓の3つの道が書いてある', [
    manual.includes(ja.recipes.selectActionToToday),
    manual.includes(ja.recipes.selectActionExport),
    manual.includes(ja.recipes.selectActionDelete),
  ], [true, true, true])
  eq('GONEWORD-3 使い方ページに「選択をやめる」が書いてある', manual.includes(ja.recipes.selectExit), true)
  eq('GONEWORD-3 複数の端末で使う方法にも「選び終わる」が書いてある', multiDevice.includes(ja.recipes.selectFinish), true)
  eq(
    'GONEWORD-3 使い方ページに「レシピ一覧から追加」が書いてある',
    manual.includes(ja.mealPlan.todayAddMoreButton),
    true,
  )
  // 2026-08-18 便HM: 「今日なに作る？」を1品／献立の切り替え1つにまとめたので、
  // 使い方ページにも切り替えの名前と、まとめたあとのボタンの名前が要る
  eq(
    'GONEWORD-3 使い方ページに「1品」「献立」の切り替えが書いてある',
    [
      manual.includes(`「${ja.dayStart.modeOne}」`),
      manual.includes(`「${ja.dayStart.modePlan}」`),
    ],
    [true, true],
  )
  eq(
    'GONEWORD-3 使い方ページに「今日の献立を探す」が書いてある',
    manual.includes(ja.mealPlan.todayChooseButton),
    true,
  )
}

// ==========================================================================================
// PLANWORD-1: 「何も起きないもの」を確認文・お知らせに書かない（2026-08-18 オーナー指摘）
//
// オーナー原文:「今日の献立からレシピを削除したときにでる『〜外しました（作った記録は残ります）』、
//              作った記録もするということ？消すだけですよね。嘘書かないで。」
//
// 献立の予定（mealPlans / todayList）を消す・入れ替えるだけの操作は、作った記録（cookedLogs）に
// 一切触らない。触らないものを「残ります」「消えません」と書くと、**危なかったように読める**。
// 規約Fが求めるのは「消えるものと残るものを両方書く」ことで、
// **もともと何も起きないものを書き足すことではない**。
//
// 測るのは「その操作が触らない種類のデータの名前が、文に混ざっていないこと」。
// 文言そのものの言い回しは見ない＝書き直しても、規則を守っているかぎり赤にならない。
// ==========================================================================================
{
  /** 献立の予定だけを触る操作（作った記録には触らない）の、押す前の説明と押したあとの知らせ */
  const planOnlyTexts = [
    ['日タブ・×の説明', ja.mealPlan.todayPlannedRemoveHint],
    ['日タブ・×のお知らせ', ja.mealPlan.todayPlannedRemovedToast],
    ['週タブ・まとめて空にする（食事を選んだとき）', ja.mealPlan.clearWeekSlotConfirm],
    ['週タブ・まとめて空にする（全部の食事）', ja.mealPlan.clearWeekSlotConfirmAll],
    ['週タブ・まとめて献立を入力の説明', ja.mealPlan.fillModeReplaceAllHint],
    ['月タブ・献立をまとめて提案', ja.mealPlan.fillMonthConfirm],
    ['月タブ・献立をまとめて提案（残る献立が無いとき）', ja.mealPlan.fillMonthConfirmNoKept],
    // 2026-08-26 便LH: 残る献立の有無で文を分けるのをやめ、1つにまとめた。
    // 2026-08-28 便LV: 本文そのものを無くしたので、残った見出しを見る
    ['テンプレートを入れる', ja.mealPlan.templateApplyConfirmTitle],
  ]
  for (const [where, text] of planOnlyTexts) {
    eq(
      `PLANWORD-1 ${where}: 献立の予定しか触らないので「記録」の話を書かない`,
      /記録/.test(text ?? ''),
      false,
    )
  }
  // 在庫の整理も同じ（消えるのは在庫の食材だけ。レシピにも作った記録にも触らない）
  eq(
    'PLANWORD-1 在庫の整理: 在庫の食材しか触らないので「レシピ」「作った記録」の話を書かない',
    /レシピ|作った記録/.test(ja.pantry.organizeConfirm ?? ''),
    false,
  )
  // 逆に、本当に片方が消えて片方が残る操作では書いたままにする（規約Fの本来の役目）。
  // レシピを消すと、そのレシピの作った記録は残る＝「消えると思って当然」なので必ず書く
  eq(
    'PLANWORD-1 レシピの削除では「作った記録が残る」ことを書く（本当に消えると思う場面）',
    [/作った記録/.test(ja.form.confirmDeleteKept), /作った記録/.test(ja.recipes.bulkDeleteConfirmKept)],
    [true, true],
  )
}

// ==========================================================================================
// HN-1: 同じ役目のボタンは、同じ塗り方にする（2026-08-18 オーナー指摘）
//
// オーナー原文:「『作った！』と『全て作った！』など、同じような機能は色を同じにした方が、
//              パッとみてわかりやすいと思う。ここに限らず。」
//
// 測り方の決めごと（色の値は決め打ちしない）:
//   ・アプリの色はテーマで変わるので、「#cc3f01であること」のような測り方はしない。
//   ・代わりに、そのボタンが**どの塗り方（トークンの組み合わせ）を選んでいるか**を読み取り、
//     **同じ役目のボタンどうしで一致しているか**だけを見る。
//   ・塗り方を変えたくなったときは、その役目の全部を一緒に変えれば緑のまま通る
//     ＝「今の形」ではなく「そろっているか」を測っている。
//
// 拾い方: UI文言（src/i18n/ja.ts のキー）が書かれている場所から**手前にさかのぼって**
// いちばん近い <button の開きタグを見つけ、その className を読む。
// ボタンの中身（アイコン・字）が増えても、置き場所が変わっても、同じ判定になる。
// ==========================================================================================
{
  const hnRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const hnFile = (rel) => readFileSync(path.join(hnRoot, rel), 'utf-8')

  /**
   * 目印（JSXに書かれた文言の式）を持つボタンの className を取り出す。
   *
   * 見た目が状態で変わるボタン（`className={`… ${押した? 'A' : 'B'}`}`）は、
   * **まだ押していないときの見た目**＝ else 側（: のあと。並びのいちばん最後）を読む。
   * 押したあとの見た目（「追加済み ✓」等）は役目が変わるので、そろえる対象ではない。
   */
  const buttonClassFor = (src, marker) => {
    const at = src.indexOf(marker)
    if (at < 0) return { error: `目印が見つからない: ${marker}` }
    const openAt = src.lastIndexOf('<button', at)
    if (openAt < 0) return { error: `ボタンの開きタグが見つからない: ${marker}` }
    const head = src.slice(openAt, at)
    const plain = head.match(/className="([^"]*)"/)
    if (plain) return { cls: plain[1] }
    const tpl = head.match(/className=\{`([\s\S]*?)`\}/)
    if (!tpl) return { error: `className が読めない: ${marker}` }
    const expr = tpl[1]
    // 条件の外にそのまま書いてある部分＋条件のいちばん最後のかたまり（＝else側）
    const base = expr.replace(/\$\{[\s\S]*?\}/g, ' ')
    const branches = [...expr.matchAll(/'([^']*)'/g)].map((m) => m[1])
    return { cls: `${base} ${branches.at(-1) ?? ''}`.replace(/\s+/g, ' ').trim() }
  }

  /**
   * 塗り方の呼び名。トークンの組み合わせだけで決める（具体的な色は見ない）。
   *  ・塗り   … 地をアクセントで塗り、字はアクセントの上用（bg-accent + text-on-accent）
   *  ・枠だけ … 地はカード面のまま、枠と字にアクセント（border-accent + text-accent-ink）
   *  ・地味枠 … 枠は区切り線の色で、字だけアクセント（border-edge + text-accent-ink）
   */
  const toneOf = (cls) => {
    const filled = /(^|\s)bg-accent(\s|$)/.test(cls) && /(^|\s)text-on-accent(\s|$)/.test(cls)
    const accentEdge = /(^|\s)border-accent(\s|$)/.test(cls)
    const plainEdge = /(^|\s)border-edge(\s|$)/.test(cls)
    const accentInk = /(^|\s)text-accent-ink(\s|$)/.test(cls)
    if (filled) return '塗り'
    if (accentEdge && accentInk) return '枠だけ'
    if (plainEdge && accentInk) return '地味枠'
    return `判別できない(${cls})`
  }

  /** 役目ごとのボタン一覧。[どこにあるか, ファイル, JSXに書かれた文言の式] */
  const HN_ROLES = [
    [
      '作った記録をつける',
      [
        ['レシピ詳細の「作った！」', 'src/pages/RecipeDetailPage.tsx', '{ja.detail.cooked}'],
        [
          // 今日の献立の1品（TodayListRow）は 2026-08-25 便KZ で src/pages/mealPlan/DayParts.tsx へ移した
          '献立・日タブの1品ごとの「作った！」',
          'src/pages/mealPlan/DayParts.tsx',
          '{ja.mealPlan.todayMarkCooked}',
        ],
        [
          '献立・日タブの「全て作った！」',
          'src/pages/MealPlanPage.tsx',
          '{ja.mealPlan.todayMarkAllCooked}',
        ],
        [
          '並行調理ナビの「まとめて作った！」',
          'src/pages/CookNaviPage.tsx',
          '{ja.cookNavi.markAllCooked}',
        ],
        [
          '調理を終えた窓の記録ボタン',
          'src/components/CookFinishModal.tsx',
          '{ja.cookNavi.sessionFinishRecord}',
        ],
        ['記録の窓の保存ボタン', 'src/components/CookedLogModal.tsx', '{ja.detail.cookedSave}'],
      ],
    ],
    [
      '今日の献立に入れる',
      [
        [
          'レシピ詳細の「今日の献立に追加」',
          'src/pages/RecipeDetailPage.tsx',
          '{isInTodayList ? `${ja.detail.todayAdded} ✓` : ja.detail.todayAdd}',
        ],
        [
          '献立・日タブの「レシピ一覧から追加」',
          'src/pages/MealPlanPage.tsx',
          '{ja.mealPlan.todayAddMoreButton}',
        ],
        [
          '「今日なに作る？」の「今日の献立に入れる」',
          'src/components/TodaySuggestPanel.tsx',
          '{ja.mealPlan.todaySuggestApply}',
        ],
      ],
    ],
  ]

  for (const [role, buttons] of HN_ROLES) {
    const found = buttons.map(([where, rel, marker]) => {
      const r = buttonClassFor(hnFile(rel), marker)
      return `${where}=${r.error ?? toneOf(r.cls)}`
    })
    const kinds = new Set(found.map((f) => f.slice(f.indexOf('=') + 1)))
    // そろっていれば空の配列。ずれていたら「どこが何色か」を全部並べて出す
    eq(`HN-1 「${role}」のボタンは全部そろった塗り方`, kinds.size === 1 ? [] : found, [])
  }

  // ==========================================================================================
  // HN-2: レシピカードの形は「密度」の1軸・3つだけ（2026-08-18 便HN）
  //
  // オーナー原文:「場所や機能ごとにレシピカードの形や内容が変わっているのがみづらい。
  //              パターン２つ（もしくは３つ）に絞って。」
  //
  // 値が4つ目に増えるのは「密度」以外の軸を混ぜてしまった合図なので、数そのものを見張る。
  // あわせて、共通部品が3つとも扱っていること・レシピ一覧が設定値をこの写し方で渡していること
  // （＝一覧の見え方が従来のまま保たれる道すじ）を見る。
  // ==========================================================================================
  eq('HN-2 カードの密度は3つまで（4つ目が要るなら設計を見直す）', CARD_DENSITIES.length, 3)
  eq(
    'HN-2 レシピ一覧の表示形式は、従来と同じ見え方の密度に写る',
    ['grid', 'list'].map(densityForListLayout),
    ['large', 'standard'],
  )
  {
    const card = hnFile('src/components/RecipeCard.tsx')
    const missing = CARD_DENSITIES.filter((d) => !card.includes(`'${d}'`))
    eq('HN-2 共通のカードは3つの密度をすべて描き分けている', missing, [])
    // 「密度」以外の言葉で形を切り替える口を増やしていないこと（旧 layout='grid'|'list' の置き換え）
    eq('HN-2 共通のカードの形を決める口は「密度」だけ', /\blayout\??:/.test(card), false)
    const recipes = hnFile('src/pages/RecipesPage.tsx')
    eq(
      'HN-2 レシピ一覧は、設定の表示形式を密度に写してからカードへ渡す',
      /density=\{densityForListLayout\(/.test(recipes),
      true,
    )
  }

  // ==========================================================================================
  // IG-1: 「小」のカードの絵は、入れ物の高さではなく実寸で決める（2026-08-20 便IG・⑫）
  //
  // オーナー実機報告:「月の日の窓を開くと、作った記録の写真が窓いっぱいに縦長で表示され、
  //                 料理名が出ていない」
  //
  // 直す前は絵の枠が `aspect-square h-full min-h-[var(--tap-min)]`（＝カードの高さいっぱいの
  // 正方形）で、親の高さが中身で決まる場所では高さ100%が解けず、中の<img>が**写真そのものの
  // 大きさ**で並んだ結果、正方形の一辺が600pxになり、料理名の幅が4pxまで潰れていた。
  // 写真のある「小」のカードならどこでも起きる（週タブの過ぎた日でも同じ実測が出た）。
  //
  // 実際の大きさは e2e の CARDSMALL-01 が測る。ここはその手前の安い見張りで、
  // **絵の枠が入れ物の高さに頼る書き方へ戻っていないこと**だけを見る。
  // ==========================================================================================
  {
    const card = hnFile('src/components/RecipeCard.tsx')
    // 「小」の枝（density === 'small'）から、次の密度の枝までを切り出して見る
    const smallStart = card.indexOf("if (density === 'small')")
    const smallEnd = card.indexOf("if (density === 'standard')")
    eq('IG-1 「小」の枝を読み取れている', smallStart > 0 && smallEnd > smallStart, true)
    const small = card.slice(smallStart, smallEnd)
    eq(
      'IG-1 「小」の絵は押せる大きさ（--tap-min）の正方形を実寸で持つ',
      /h-\[var\(--tap-min\)\]\s+w-\[var\(--tap-min\)\]/.test(small),
      true,
    )
    eq(
      'IG-1 「小」の絵の枠が、入れ物の高さ頼み（aspect-square + h-full）へ戻っていない',
      /aspect-square[^'`]*h-full/.test(small),
      false,
    )
  }
}

// ==========================================================================================
// HW-1〜HW-3: 「同じ役目のカードは同じ形をしている」の見張り（2026-08-19 便HW）
//
// オーナー原文:
//   「場所や機能ごとにレシピカードの形や内容が変わっているのがみづらい。
//     パターン２つ（もしくは３つ）に絞って。」
//   「表記揺れを直すように、レシピカードなど、同じ情報なら形もできるだけ揃えることを徹底したい」
//
// 便HN（1段目）で「密度」＝大／標準／小の3つを共通部品に作り、便HW（2〜3段目）で
// 画面ごとに自前で組んでいたカードを全部そこへ寄せた。
//
// **測り方の決めごと**（カードの種類を書き写して並べない＝画面が増えても当たる形にする）:
//   HW-1 … 「料理の絵」を自前で描いている画面が1つも無いこと。
//          カードが増えるときは必ずこの部品を通るので、**新しい画面が自前で組んだら赤**になる。
//   HW-2 … カードを出しているすべての場所が、3つの密度のどれかに解決できること。
//   HW-3 … **1つの並びの中で形を混ぜていない**こと（同じ一覧に別々の形が並ぶのが
//          オーナーの言う「みづらい」の中身）。
//
// **読み取りに失敗したら必ず落ちる**ようにしてある（2026-08-18に、数を読めなかった便が
// -1 を返して4件のテストが「何も測らないまま合格」した失敗の再発防止）。
// 走査できたファイル数・拾えた呼び出し数が0なら、その場で不合格にする。
//
// HW_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る。
// 「この見張りが、直す前のコードに当てると本当に赤くなるか」を確かめるための口。
// ==========================================================================================
{
  const hwScriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const hwRoot = process.env.HW_SRC_ROOT ?? path.join(hwScriptDir, '..')
  const hwSrcDir = path.join(hwRoot, 'src')

  /** src配下の .tsx を再帰的に集める（リポジトリ内の相対パスで返す） */
  const listTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...listTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const hwFiles = listTsx(hwSrcDir).map((full) => ({
    rel: path.relative(hwRoot, full).split(path.sep).join('/'),
    src: readFileSync(full, 'utf-8'),
  }))
  // 走査そのものが壊れていたら（0件・ほんの数件しか読めていない）、ここで落とす。
  // 下の3つは「見つからなければ緑」の形をしているので、走査が空だと全部素通りしてしまう
  eq('HW-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', hwFiles.length > 0, true)

  // ---- HW-1: 料理の絵（写真か代わり絵か）を描いているのは共通部品だけ --------------------
  // 自前のカードは例外なく「写真があれば <img>、無ければ代わり絵」を自分で書くところから
  // 始まる。その1行が共通部品の外に出た瞬間に赤くする＝「その画面だけのカード」が生まれない。
  const hwPlaceholderUsers = hwFiles
    .filter(({ src }) => /<RecipePlaceholder\b/.test(src))
    .map(({ rel }) => rel)
  eq(
    'HW-1 料理の絵を描いているのは共通のカード部品だけ（自前のカードが無い）',
    hwPlaceholderUsers,
    ['src/components/RecipeCard.tsx'],
  )

  // ---- HW-2: カードを出す場所は、必ず3つの密度のどれかに解決できる ------------------------
  /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `=>` に釣られない） */
  const cardOpenTags = (src) => {
    const tags = []
    let at = src.indexOf('<RecipeCard')
    while (at >= 0) {
      let depth = 0
      let end = -1
      for (let i = at; i < src.length; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) {
          end = i
          break
        }
      }
      if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
      tags.push({ at, text: src.slice(at, end + 1) })
      at = src.indexOf('<RecipeCard', end)
    }
    return { tags }
  }
  /** 開きタグ1つぶんの密度。読めなければ理由を返す（黙って既定に倒さない） */
  const densityOf = (tag) => {
    const literal = tag.match(/density="([a-z]+)"/)
    if (literal) {
      return CARD_DENSITIES.includes(literal[1])
        ? { density: literal[1] }
        : { error: `知らない密度: ${literal[1]}` }
    }
    const expr = tag.match(/density=\{([^}]*)\}/)
    if (expr) {
      // 設定の表示形式から写す道（レシピ一覧）。写し先は densityForListLayout が受け持つ
      if (/densityForListLayout\(/.test(expr[1])) return { density: 'listLayout' }
      return { error: `密度の式が読めない: ${expr[1].trim()}` }
    }
    // 省略時は既定の「大」
    return { density: 'large' }
  }

  const hwCalls = []
  const hwTagErrors = []
  for (const { rel, src } of hwFiles) {
    const found = cardOpenTags(src)
    if (found.error) {
      hwTagErrors.push(`${rel}: ${found.error}`)
      continue
    }
    for (const tag of found.tags) {
      const d = densityOf(tag.text)
      hwCalls.push({ rel, at: tag.at, ...d })
    }
  }
  eq('HW-2 カードの呼び出しを切り出せている（切り出せない書き方が無い）', hwTagErrors, [])
  eq(
    'HW-2 カードを出している場所を1つ以上拾えている（0件なら見張りが壊れている）',
    hwCalls.length > 0,
    true,
  )
  eq(
    'HW-2 すべての場所が3つの密度のどれかに解決できる',
    hwCalls.filter((c) => c.error).map((c) => `${c.rel}: ${c.error}`),
    [],
  )

  // ---- HW-3: 一覧の行は、例外なく共通のカードを通る ---------------------------------------
  // 「同じ情報なら同じ形」が崩れるときは、いつも**一覧の1行だけを自前で組む小さな部品**から
  // 始まる（便HWで直したのは、まさにその4つ: 今日の献立の行・作った記録のカード・
  // 最近作ったものの行・作った記録の一覧の行）。
  // そこで「レシピを受け取って一覧の行（<li>）を返す部品は、必ず共通のカードを描いている」
  // を規則にする。次に一覧が増えたときも、自前で組めばその場で赤くなる。
  const hwRowOffenders = []
  for (const { rel, src } of hwFiles) {
    if (rel === 'src/components/RecipeCard.tsx') continue
    // 「recipe: Recipe を受け取る部品」の宣言を拾う（function 宣言・アロー関数のどちらも）
    const decls = [...src.matchAll(/(?:function|const)\s+([A-Z][A-Za-z0-9]*)\b/g)]
    for (let i = 0; i < decls.length; i++) {
      const from = decls[i].index
      const to = i + 1 < decls.length ? decls[i + 1].index : src.length
      const body = src.slice(from, to)
      // レシピを1品受け取り、一覧の行（<li）を返している部品だけを見る
      if (!/\brecipe:\s*Recipe\b/.test(body)) continue
      if (!/<li\b/.test(body)) continue
      if (/<RecipeCard\b/.test(body)) continue
      hwRowOffenders.push(`${rel} の ${decls[i][1]}`)
    }
  }
  eq('HW-3 一覧の1行は、どの画面でも共通のカードを通っている', hwRowOffenders, [])

  // ---- HW-5: 公開するページに、マージの競合の印が残っていない ----------------------------
  // 2026-08-19 便HW で、public/about/manual.html に `<<<<<<< HEAD` … `>>>>>>> ブランチ名` が
  // 1組そのまま残っているのを見つけた（利用者にその記号ごと表示される）。
  // 人の目では見落とすので、公開するHTML・JSONを機械で掃く。
  {
    const publicDir = path.join(hwRoot, 'public')
    const listPublicText = (dir) => {
      const out = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...listPublicText(full))
        else if (/\.(html|json|txt|webmanifest)$/.test(entry.name)) out.push(full)
      }
      return out.sort()
    }
    const publicFiles = listPublicText(publicDir)
    eq('HW-5 公開するページを走査できている（0件なら見張りが壊れている）', publicFiles.length > 0, true)
    const conflicted = publicFiles.filter((full) =>
      /^(<{7}|={7}|>{7})( |$)/m.test(readFileSync(full, 'utf-8')),
    )
    eq(
      'HW-5 公開するページにマージの競合の印が残っていない',
      conflicted.map((full) => path.relative(hwRoot, full).split(path.sep).join('/')),
      [],
    )
  }

  // ---- HW-4: カードの形を外からいじる口を増やしていない -----------------------------------
  // 密度を3つに絞っても、呼び出し側が見た目を上書きできる口（className・大きさ・変種）が
  // 開いていれば、そこから4つ目の形がこっそり生える。**口そのものが無い**ことを見張る。
  {
    const cardSrc = hwFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')
    eq('HW-4 共通のカード部品を読めている', cardSrc != null, true)
    const propsAt = cardSrc ? cardSrc.src.indexOf('type Props = {') : -1
    eq('HW-4 カードの受け口（Props）を読めている', propsAt >= 0, true)
    const propsBlock = propsAt >= 0 ? cardSrc.src.slice(propsAt, cardSrc.src.indexOf('\n}', propsAt)) : ''
    const forbidden = ['className', 'style', 'size', 'variant', 'compact', 'layout', 'width', 'height']
    eq(
      'HW-4 カードの形を外から変える口を持たない（形は「密度」だけで決める）',
      forbidden.filter((name) => new RegExp(`(^|\\s)${name}\\??:`, 'm').test(propsBlock)),
      [],
    )
  }

  // ---- HX-1: カードに「重ねて」出す表示が、指を素通りさせている ---------------------------
  // 2026-08-19 便HXで実際に出た後戻り: 便HWで骨格を組み替えたとき、栄養価の値バッジが
  // 押せる面（レシピ詳細へのリンク）の**外側**へ出た。「大」は指を素通りさせていたが
  // 「標準」は素通りさせておらず、一覧(リスト)表示ではバッジの上だけ押しても何も起きない
  // 死角になっていた（390px幅の実機で、押してもレシピ詳細へ行かないことを実測）。
  // 見えているかどうかだけを見ていると、この種の後戻りは一切引っかからない。
  {
    const cardSrc = hwFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')?.src ?? ''
    eq('HX-1 共通のカード部品を読めている', cardSrc.length > 0, true)
    // 値バッジを出している場所（「大」「標準」の2か所）を全部拾う。0件なら見張りが壊れている
    const badgeSpots = [...cardSrc.matchAll(/\{sortBadgeText &&/g)].map((m) => m.index)
    eq('HX-1 値バッジを出している場所を拾えている（0件なら見張りが壊れている）', badgeSpots.length >= 2, true)
    // 「標準」はバッジ自身が、「大」は外側の重ねの箱が pointer-events-none を持つので、
    // 直後のclassと直前のclassの**どちらか**にあれば通す（持たせ方を1つに縛らない）。
    // 見るのは class の中身だけ＝説明のコメントに同じ言葉が書いてあっても通らない
    const classAfter = (at) => cardSrc.slice(at, at + 600).match(/className="([^"]*)"/)?.[1] ?? ''
    const classBefore = (at) => {
      const found = [...cardSrc.slice(Math.max(0, at - 600), at).matchAll(/className="([^"]*)"/g)]
      return found.length > 0 ? found[found.length - 1][1] : ''
    }
    eq(
      'HX-1 カードに重ねる値バッジは指を素通りさせる（押せる面の外に死角を作らない）',
      badgeSpots.filter(
        (at) =>
          !classAfter(at).includes('pointer-events-none') &&
          !classBefore(at).includes('pointer-events-none'),
      ).length,
      0,
    )
  }
}

// ==========================================================================================
// HY-1〜HY-5: 「どの場所で、カードに何を載せるか」は1つの表で決まる（2026-08-19 便HY）
//
// オーナー原文:
//   「レシピカードはフォーマットが揃っていれば、それぞれの場所で不要な情報はなくして
//     シンプルにしたいのですが、どうでしょう？『今日なに作る？』だったら『基本レシピ』と
//     食材表記はいらないように感じました。」
//
// 便HN/便HWで**形**は3つの密度にそろった。便HYはその先の**引き算**で、決めごとは
// 「**削るのは自由・足すのは共通部品を通す**」。表は src/logic/cardParts.ts の1か所。
//
// **測り方の決めごと**（項目名を画面ごとに書き写して並べない＝場所が増えても当たる形にする）:
//   HY-1 … カードを出しているすべての場所が、表の「場所」のどれかに解決できること
//   HY-2 … 共通のカード部品が、表を通してからでないとその項目を描かないこと
//   HY-3 … 表に、カードが用意していない項目を書けないこと（＝その場で足せない）
//   HY-4 … 表に書いたのに一度も使われていない項目が無いこと（書いただけで効かない列を作らない）
//   HY-5 … **どの場所も、レシピを探す一覧より情報を増やしていない**こと。そのうえで
//          「今日なに作る？」の候補は、レシピを探す一覧より**少ない**こと（今回の引き算そのもの）
//
// **読み取りに失敗したら必ず落ちる**形にしてある（拾えた呼び出しが0件・描いている場所が0件なら
// その場で不合格。「見つからなかった＝合格」に倒れる書き方をしない）。
//
// HY_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る
// （この見張りが直す前のコードで本当に赤くなるかを確かめるための口）。
// ==========================================================================================
{
  const hyScriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const hyRoot = process.env.HY_SRC_ROOT ?? path.join(hyScriptDir, '..')
  const hySrcDir = path.join(hyRoot, 'src')

  const hyListTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...hyListTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const hyFiles = hyListTsx(hySrcDir).map((full) => ({
    rel: path.relative(hyRoot, full).split(path.sep).join('/'),
    src: readFileSync(full, 'utf-8'),
  }))
  eq('HY-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', hyFiles.length > 0, true)

  // ---- HY-1: カードを出す場所は、必ず表の「場所」に解決できる ----------------------------
  /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `>` に釣られない） */
  const hyCardOpenTags = (src) => {
    const tags = []
    let at = src.indexOf('<RecipeCard')
    while (at >= 0) {
      let depth = 0
      let end = -1
      for (let i = at; i < src.length; i++) {
        const ch = src[i]
        if (ch === '{') depth++
        else if (ch === '}') depth--
        else if (ch === '>' && depth === 0) {
          end = i
          break
        }
      }
      if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
      tags.push(src.slice(at, end + 1))
      at = src.indexOf('<RecipeCard', end)
    }
    return { tags }
  }
  /** 開きタグ1つぶんの場所。読めなければ理由を返す（黙って既定に倒さない） */
  const hyPlaceOf = (tag) => {
    const literal = tag.match(/\bplace="([A-Za-z]+)"/)
    if (literal) {
      return Object.hasOwn(CARD_PLACE_PARTS, literal[1])
        ? { place: literal[1] }
        : { error: `表に無い場所: ${literal[1]}` }
    }
    // 省略は「レシピ一覧と同じ＝いちばん情報の多い側」。式で渡すのは読めないので不合格にする
    const expr = tag.match(/\bplace=\{([^}]*)\}/)
    if (expr) return { error: `場所の式が読めない: ${expr[1].trim()}` }
    return { place: DEFAULT_CARD_PLACE }
  }

  const hyCalls = []
  const hyTagErrors = []
  for (const { rel, src } of hyFiles) {
    if (rel === 'src/components/RecipeCard.tsx') continue
    const found = hyCardOpenTags(src)
    if (found.error) {
      hyTagErrors.push(`${rel}: ${found.error}`)
      continue
    }
    for (const tag of found.tags) hyCalls.push({ rel, ...hyPlaceOf(tag) })
  }
  eq('HY-1 カードの呼び出しを切り出せている（切り出せない書き方が無い）', hyTagErrors, [])
  eq(
    'HY-1 カードを出している場所を1つ以上拾えている（0件なら見張りが壊れている）',
    hyCalls.length > 0,
    true,
  )
  eq(
    'HY-1 すべての場所が表のどれかに解決できる（表に無い場所でカードを出していない）',
    hyCalls.filter((c) => c.error).map((c) => `${c.rel}: ${c.error}`),
    [],
  )

  // ---- HY-2: カード部品は、表を通してからでないとその項目を描かない ----------------------
  // 「その項目を実際に画面へ出している一行」を項目ごとに1つ決めて、そこへ辿り着く前に
  // 必ず表の判定（shows('◯◯')）を通っていることを見る。表を素通りして描き足した瞬間に赤くなる。
  {
    const hyCardSrc = hyFiles.find((f) => f.rel === 'src/components/RecipeCard.tsx')?.src ?? ''
    eq('HY-2 共通のカード部品を読めている', hyCardSrc.length > 0, true)
    /** 項目ごとの「画面へ出している印」。コメントではなく、描画に使っている式そのものを見る */
    const hyRenderMarks = {
      time: 'ja.recipes.minutesSuffix',
      effort: 'ja.effort[',
      season: 'ja.season[',
      starter: 'ja.card.starterBadge',
      ingredients: 'ingredientColorToken(',
    }
    // 表の項目と、印を持っている項目がぴったり一致していること
    // （どちらかにしか無い＝この見張りが片方を測っていない）
    eq(
      'HY-2 カタログの項目すべてに「画面へ出している印」がある（測り漏れが無い）',
      CARD_PART_KEYS.filter((key) => !(key in hyRenderMarks)),
      [],
    )
    eq(
      'HY-2 印の側に、カタログに無い項目が紛れていない',
      Object.keys(hyRenderMarks).filter((key) => !CARD_PART_KEYS.includes(key)),
      [],
    )
    const hyUnguarded = []
    const hyNotDrawn = []
    for (const [key, mark] of Object.entries(hyRenderMarks)) {
      const spots = []
      let at = hyCardSrc.indexOf(mark)
      while (at >= 0) {
        spots.push(at)
        at = hyCardSrc.indexOf(mark, at + mark.length)
      }
      // 描いている場所が1つも無い＝印が古い（見張りが何も測っていない）ので不合格にする
      if (spots.length === 0) {
        hyNotDrawn.push(`${key}（印: ${mark}）`)
        continue
      }
      for (const spot of spots) {
        // 直前800文字のあいだに表の判定があるか。密度ごとに書き方が違っても当たるよう、
        // 「どの入れ子の何段目か」ではなく**手前にあるか**だけで見る
        const before = hyCardSrc.slice(Math.max(0, spot - 800), spot)
        if (!before.includes(`shows('${key}')`)) hyUnguarded.push(`${key} @${spot}`)
      }
    }
    eq('HY-2 印が古くなっていない（どの項目も1か所以上で描かれている）', hyNotDrawn, [])
    eq(
      'HY-2 カタログの項目は、表を通してからでないと描かれない（表の外で描き足せない）',
      hyUnguarded,
      [],
    )
  }

  // ---- HY-3/HY-4: 表そのものの決まりごと -------------------------------------------------
  const hyPlaces = Object.keys(CARD_PLACE_PARTS)
  eq('HY-3 表に場所が1つ以上ある（0件なら見張りが壊れている）', hyPlaces.length > 0, true)
  eq(
    'HY-3 表に、カードが用意していない項目は書けない（その場で新しい項目を足せない）',
    hyPlaces.flatMap((place) =>
      CARD_PLACE_PARTS[place]
        .filter((key) => !CARD_PART_KEYS.includes(key))
        .map((key) => `${place}: ${key}`),
    ),
    [],
  )
  eq(
    'HY-3 同じ項目を1つの場所に2回書いていない',
    hyPlaces.filter((place) => new Set(CARD_PLACE_PARTS[place]).size !== CARD_PLACE_PARTS[place].length),
    [],
  )
  eq(
    'HY-4 表に書いたのに、どの場所でも使われていない項目が無い',
    CARD_PART_KEYS.filter((key) => !hyPlaces.some((place) => cardPartsFor(place).has(key))),
    [],
  )
  eq(
    'HY-4 省略したときの場所が表に載っている',
    Object.hasOwn(CARD_PLACE_PARTS, DEFAULT_CARD_PLACE),
    true,
  )

  // ---- HY-5: 引き算の向き（増やす方向へは動かない・候補は実際に減っている） ---------------
  // 「どの場所で何が出るか」を項目名で書き写すと、項目が増えた瞬間に写し直しが要る。
  // ここでは**場所どうしの大小**だけで測る＝新しい項目が増えても、場所が増えても当たる。
  {
    const hyFull = cardPartsFor(DEFAULT_CARD_PLACE)
    const hyGrew = hyPlaces.filter((place) =>
      [...cardPartsFor(place)].some((key) => !hyFull.has(key)),
    )
    eq(
      'HY-5 どの場所も、レシピを探す一覧より情報を増やしていない（削る方向だけ）',
      hyGrew,
      [],
    )
    const hySuggest = cardPartsFor('todaySuggest')
    eq(
      'HY-5 「今日なに作る？」の候補は、レシピを探す一覧より載せる情報が少ない（2026-08-19 オーナー指示）',
      hySuggest.size < hyFull.size && [...hySuggest].every((key) => hyFull.has(key)),
      true,
    )
  }
}

// ==========================================================================================
// 便HQ-3: 押せる面の共通の器（2026-08-18・軸7）
//
// 同じ役目の「閉じる／外す ✕」が 22px〜48px の7段階に散り、同じファイルの中で32pxと44pxが
// 混ざっていた（44px側にだけ「44px四方に広げる」意図のコメントが付いていた＝片方だけ直した跡）。
// 原因は **44px確保の共通の器が無く、毎回手書きだった** こと（`min-h-11` / `h-11 w-11` /
// `p-3` / `-m-2 p-3.5` の4通りが併存）。器（src/index.css の .tap-target）を1つ作って
// 全部そこへ載せたので、ここでは **クラス名の有無ではなく、1つずつ大きさを出して** 見張る。
//
// 測り方: ボタンに書いてあるクラスから、そのボタンが実際に何px四方になるかを出す
// （アイコンの大きさ＋padding、または h-/w-/min-h-/min-w- の指定。器を着けているものは
// 器が保証する大きさまで当たり判定が広がる＝その値は index.css から読む）。
// 対象は「文字のラベルを持たない＝アイコンだけのボタン」の ✕ とチェックの丸。
// 文字ラベル付きのボタンは高さを変えると見た目が変わるので、ここでは測らない。
//
// 実画面での当たり判定は scripts/e2e-smoke.mjs の TAP-44 が受け持つ（中心から21pxの点を
// 実際に突いて、押しても何も起きない場所が無いかを見る）。ここは e2e が開かない画面まで含めて
// 1つも取りこぼさないための静的な見張り。
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const css = readFileSync(path.join(appRoot, 'src/index.css'), 'utf-8')
  // 守る大きさ（44px）はここで決め、器が本当にその大きさを配っているかを index.css で確かめる。
  // 器が壊れたら「押せる面が広がっている」根拠が無くなるので、全部の✕がその場で赤くなる
  const REQUIRED = 44
  const tapMin = Number(css.match(/--tap-min:\s*(\d+)px/)?.[1] ?? 0)
  eq('HQ-3 押せる面の大きさは index.css の1か所で決めてある', tapMin, REQUIRED)
  eq(
    'HQ-3 器はその値で当たり判定を広げる（箱を大きくしない＝見た目を変えない）',
    /\.tap-target::after\s*\{[^}]*width:\s*var\(--tap-min\)[^}]*height:\s*var\(--tap-min\)[^}]*\}/.test(
      css,
    ),
    true,
  )

  // Tailwind の間隔は 1 = 4px（h-11 = 44px・p-3.5 = 14px）
  const spacing = (v) => Number(v) * 4
  const sizeOf = (cls, iconPx) => {
    const pick = (name) => {
      const m = cls.match(new RegExp(`(?:^|[\\s\`{])${name}-(\\d+(?:\\.\\d+)?)(?![\\w.-])`))
      return m ? spacing(m[1]) : undefined
    }
    const p = pick('p')
    const px = pick('px')
    const py = pick('py')
    const border = /(?:^|[\s`{])border(?![\w-])/.test(cls) ? 2 : 0
    const width = Math.max(pick('w') ?? iconPx + 2 * (px ?? p ?? 0) + border, pick('min-w') ?? 0)
    const height = Math.max(pick('h') ?? iconPx + 2 * (py ?? p ?? 0) + border, pick('min-h') ?? 0)
    // 器を着けているボタンは、箱が小さくても押せる面は器の大きさまで広がる
    const held = /(?:^|[\s`{])tap-target(?![\w-])/.test(cls) ? tapMin : 0
    return { width: Math.max(width, held), height: Math.max(height, held) }
  }

  /** JSXの開きタグの終わり（属性の中の { } と文字列は数えない） */
  const openTagEnd = (src, from) => {
    let depth = 0
    for (let i = from; i < src.length; i++) {
      const c = src[i]
      if (c === '{') depth += 1
      else if (c === '}') depth -= 1
      else if (c === '"' || c === "'" || c === '`') {
        const quote = c
        i += 1
        while (i < src.length && src[i] !== quote) {
          if (src[i] === '\\') i += 1
          i += 1
        }
      } else if (c === '>' && depth === 0) return i + 1
    }
    return -1
  }

  const tsxFiles = []
  const walk = (dir) => {
    for (const name of readdirSync(dir, { withFileTypes: true })) {
      if (name.isDirectory()) walk(path.join(dir, name.name))
      else if (name.name.endsWith('.tsx')) tsxFiles.push(path.join(dir, name.name))
    }
  }
  walk(path.join(appRoot, 'src'))
  tsxFiles.sort()

  // アイコンだけのボタン＝押す場所そのもの。✕（閉じる・外す・消す）とチェックの丸を測る
  const ICONS = ['X', 'CheckCircle2']
  const tooSmall = []
  let measured = 0
  for (const file of tsxFiles) {
    const src = readFileSync(file, 'utf-8')
    const rel = path.relative(appRoot, file)
    // 同じファイルの中でクラス文字列を定数にまとめている場合（iconBtnCls 等）に備えて先に読む
    const consts = {}
    for (const m of src.matchAll(/const (\w+) =\s*\n?\s*'([^']*)'/g)) consts[m[1]] = m[2]
    for (const icon of ICONS) {
      const iconRe = new RegExp(`<${icon} size=\\{(\\d+)\\}`, 'g')
      for (const m of src.matchAll(iconRe)) {
        const iconPx = Number(m[1])
        const at = m.index
        // 押す場所は <button> だけとは限らない。役割だけ button に見せた <span>・<div>・<a> があり、
        // **いちばん小さかった32pxの✕がまさにその形**だった（DayStartNotices の「閉じる」）。
        // タグ名で探すと、直したい当のものを測り漏らす。
        // そこで、アイコンの手前の開きタグを1つずつさかのぼり、
        // 最初に見つかった「押せる要素」（button/Link、または onClick か role="button" を持つもの）を持ち主とする。
        // 途中に見た目だけの入れ物（<span className>）が挟まっていても、その奥のボタンまで届く
        const HOLDERS = ['button', 'Link', 'span', 'div', 'a', 'label']
        let openIdx = -1
        let tagName = ''
        let cursor = at
        while (cursor > 0) {
          let best = -1
          let bestTag = ''
          for (const t of HOLDERS) {
            const i = src.lastIndexOf(`<${t}`, cursor - 1)
            // `<a` が `<article` に当たらないよう、タグ名の直後が空白か > であることを確かめる
            if (i > best && /[\s>/]/.test(src[i + 1 + t.length] ?? '')) {
              best = i
              bestTag = t
            }
          }
          if (best < 0) break
          const holderEnd = openTagEnd(src, best)
          const holderAttrs = holderEnd > 0 ? src.slice(best, holderEnd) : ''
          const clickable =
            bestTag === 'button' ||
            bestTag === 'Link' ||
            /onClick/.test(holderAttrs) ||
            /role="button"/.test(holderAttrs)
          if (clickable) {
            openIdx = best
            tagName = bestTag
            break
          }
          cursor = best
        }
        if (openIdx < 0) continue
        const bodyStart = openTagEnd(src, openIdx)
        const bodyEnd = src.indexOf(`</${tagName}>`, at)
        if (bodyStart < 0 || bodyEnd < 0 || bodyStart > at) continue
        // 文字のラベルを持つボタンは対象外（高さを変えると見た目が変わるため）
        const body = src
          .slice(bodyStart, bodyEnd)
          .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
          .replace(/<[A-Za-z][^>]*\/>/g, '')
        if (body.trim() !== '') continue
        const attrs = src.slice(openIdx, bodyStart)
        let cls =
          attrs.match(/className=\{`([\s\S]*?)`\}/)?.[1] ??
          attrs.match(/className="([^"]*)"/)?.[1] ??
          attrs.match(/className=\{(\w+)\}/)?.[1] ??
          ''
        if (consts[cls]) cls = consts[cls]
        cls = cls.replace(/\$\{(\w+)\}/g, (_, name) => ` ${consts[name] ?? ''} `)
        const line = src.slice(0, at).split('\n').length
        const { width, height } = sizeOf(cls, iconPx)
        measured += 1
        if (width < REQUIRED || height < REQUIRED)
          tooSmall.push(`${rel}:${line} ${width}x${height}`)
      }
    }
  }
  // 数そのものは決め打ちしない（画面が増えれば増える）。「1つも小さいものが無い」ことだけを見る
  eq('HQ-3 ✕とチェックの丸を1つ残らず測れている', measured > 30, true)
  eq('HQ-3 44px未満の✕・チェックの丸が1つも無い', tooSmall, [])
}

// ---------- IC-1: 折りたたみの開閉が「予約の追い越し」で消えないこと（2026-08-19 便IC） ----------
//
// 直したバグ: 折りたたみ（src/components/Collapse.tsx・34か所で使う共通部品）は
// 「中身を置く→高さ0のまま1フレーム待つ→伸ばす」を requestAnimationFrame の二重予約で
// 表していた。予約は描き直しの順番を保証しないので、機械が混むと
// 「高さ0の中身」が一度も作られないまま開き切り、**アニメーションが丸ごと消えていた**
// （設定の「機種変更するときは」は混んでいなくても毎回消えていた）。
//
// いまは useLayoutEffect（描き直しの前に必ず走る）の中で、中身を置く → 寸法を読んで
// 「高さ0」をブラウザに確定させる → 1fr にする、を**同じ処理の中で**順に行う。
// 予約を挟まないので順番が入れ替わらない。
//
// ここは「動きが出るか」ではなく「予約に戻していないか」だけを見る見張り
// （動きそのものは scripts/e2e-smoke.mjs の EO-01 が実機で測る）。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const raw = readFileSync(path.join(appRoot, 'src/components/Collapse.tsx'), 'utf-8')
  if (raw.length < 500) throw new Error(`Collapse.tsx を読み取れていない(長さ=${raw.length})`)
  // 説明のコメントに書いた言葉を数えないよう、コメントを落としてから読む
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
  if (code.length < 300) throw new Error('Collapse.tsx のコメントを落としたら中身が残らない')
  // 前提の確認（同じ読み方で、いま在るものが「在る」と読めること＝見張りの空振り防止）
  eq('IC-1 前提: Collapse.tsx の中身を読めている', /export default function Collapse/.test(code), true)

  eq(
    'IC-1 開くときの順番を requestAnimationFrame の予約で作っていない',
    /requestAnimationFrame/.test(code),
    false,
  )
  eq(
    'IC-1 開閉の指示は描き直しの前に片づける（useLayoutEffect を使う）',
    /useLayoutEffect\s*\(/.test(code),
    true,
  )
  eq(
    'IC-1 「高さ0」を確定させる寸法の読み取りが残っている（消すとアニメーションが出なくなる）',
    /getBoundingClientRect\(\)/.test(code),
    true,
  )
}

// ==========================================================================================
// IA-1〜IA-5: 献立の「日」の絞り込みを窓にした回の見張り（2026-08-19 便IA）
//
// オーナー原文（実機）:
//   ①「今日なに作るで、条件を絞るボタンをぽちぽち色々試すたびに、説明文や追加の選択肢が出現して
//      ボタンや献立のレシピカードの場所が変わるので見づらく感じる」
//   ②「1品も条件ぽちぽち帰るたびに候補が変わらないようにして」
//   ③「月や週の献立で、サイコロ押してレシピを変更した後に、元に戻すトースト？出してほしい」
//   ⑤「④OKフォーマットそのままで情報減らすなどコンパクトにする努力はして」
//
// **実際に動かして測るのは e2e**（DAYCOND-01・DAYONE-02・WEEKDICE-03・SUGGESTNG-04・
// PICKCOMPACT-05）が受け持つ。ここは e2e が開かない場所まで含めて、**決めごとが
// 書き換わっていないか**を静的に見張る。読み取りに失敗したら必ず落ちる形にしてある。
// ==========================================================================================
{
  const iaRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const iaRead = (rel) => readFileSync(path.join(iaRoot, rel), 'utf-8')

  // ---- IA-1: 「レシピを選ぶ」画面の引き算（⑤） ------------------------------------------
  // 項目名を並べ立てるのではなく、**場所どうしの大小**と「決め手が残っているか」で測る。
  {
    const iaFull = cardPartsFor('recipeList')
    const iaPicker = cardPartsFor('recipePicker')
    const iaSuggest = cardPartsFor('todaySuggest')
    eq(
      'IA-1 「レシピを選ぶ」画面は、レシピ一覧より載せる情報が少ない（2026-08-19 オーナー指示の引き算）',
      iaPicker.size < iaFull.size && [...iaPicker].every((key) => iaFull.has(key)),
      true,
    )
    eq(
      'IA-1 「レシピを選ぶ」画面にも調理時間は残っている（決め手まで消していない）',
      iaPicker.has('time'),
      true,
    )
    // 「1品を選ぶ」場所は2つある（今日なに作る？の候補・レシピを選ぶ画面）。
    // 同じ役目なので載せる情報も同じにする＝片方だけ増減させない
    eq(
      'IA-1 「1品を選ぶ」2か所（今日なに作る？の候補・レシピを選ぶ画面）は同じだけ載せる',
      [...iaPicker].sort().join(','),
      [...iaSuggest].sort().join(','),
    )
  }

  // ---- IA-2: 「変えた条件は…」の1行（①②・規約H） ---------------------------------------
  // 押すボタンの名前で場所を言う（「ここ」「これ」等の指示語で言わない）。
  // 1品側と献立側で、同じことを違う言い方にしない（型がそろっているかを見る）。
  {
    // 文言そのものが無いときは、その場で不合格にする（undefined を空文字に倒して素通りさせない）
    const iaText = (value) => (typeof value === 'string' ? value : '')
    const iaNotices = [
      { label: '1品', text: iaText(ja.dayStart.conditionChanged), button: iaText(ja.dayStart.shuffle) },
      {
        label: '献立',
        text: iaText(ja.mealPlan.todaySuggestConditionChanged),
        button: iaText(ja.mealPlan.todaySuggestButton),
      },
    ]
    eq(
      'IA-2 「変えた条件は…」の1行が1品側と献立側の両方にある',
      iaNotices.filter((n) => n.text.length === 0 || n.button.length === 0).map((n) => n.label),
      [],
    )
    eq(
      'IA-2 「変えた条件は…」の1行は、押すボタンの名前を書いている（規約H）',
      iaNotices.filter((n) => !n.text.includes(n.button)).map((n) => n.label),
      [],
    )
    eq(
      'IA-2 その1行で場所を指示語（ここ・これ・上の・下の）で示していない（規約H）',
      iaNotices.filter((n) => /ここ|これ|上の|下の/.test(n.text)).map((n) => n.label),
      [],
    )
    // ボタン名を外した残り（言い回し）が1品側と献立側で同じ＝同じことを違う言葉で言わない
    const iaShape = (n) => n.text.replace(n.button, '')
    eq(
      'IA-2 1品側と献立側で、言い回しはそろっている（違うのはボタンの名前だけ）',
      iaShape(iaNotices[0]),
      iaShape(iaNotices[1]),
    )
  }

  // ---- IA-3: サイコロの知らせと「元に戻す」（③・規約F） -----------------------------------
  // 週・月は複数の日が同時に見えているので、**いつの・どの食事の枠か**を必ず言う。
  // 取り消しの文言は、起きたことと対になっている（入れた↔外した／変えた↔戻した）。
  {
    const iaSuggestToasts = {
      suggestReplacedToast: ['{before}', '{after}'],
      suggestReplaceUndoneToast: ['{title}'],
      suggestAddedToast: ['{title}'],
      suggestAddedPairToast: ['{main}', '{side}'],
      suggestAddUndoneToast: ['{title}'],
      suggestAddPairUndoneToast: ['{main}', '{side}'],
    }
    const iaMissingSlot = Object.keys(iaSuggestToasts).filter((key) => {
      const text = ja.mealPlan[key]
      return typeof text !== 'string' || !['{m}', '{d}', '{slot}'].every((ph) => text.includes(ph))
    })
    eq(
      'IA-3 サイコロの知らせは、いつの・どの食事の枠かを必ず書いている（週・月は日が並んでいる）',
      iaMissingSlot,
      [],
    )
    const iaMissingTitles = Object.entries(iaSuggestToasts).filter(
      ([key, holes]) => !holes.every((ph) => (typeof ja.mealPlan[key] === 'string' ? ja.mealPlan[key] : '').includes(ph)),
    )
    eq(
      'IA-3 サイコロの知らせは、どの料理のことかを書いている（規約F: 何が戻るのかが分かる）',
      iaMissingTitles.map(([key]) => key),
      [],
    )
    const iaReplaced = typeof ja.mealPlan.suggestReplacedToast === 'string' ? ja.mealPlan.suggestReplacedToast : ''
    const iaReplaceUndone =
      typeof ja.mealPlan.suggestReplaceUndoneToast === 'string' ? ja.mealPlan.suggestReplaceUndoneToast : ''
    eq(
      'IA-3 入れ替えの知らせは、前の料理名と後の料理名を両方書いている（元に戻すと何が戻るか）',
      iaReplaced.includes('{before}') &&
        iaReplaced.includes('{after}') &&
        iaReplaceUndone.includes('{title}'),
      true,
    )
  }

  // ---- IA-4: 窓の作りを新しく発明していない（①） -----------------------------------------
  // 「条件をしぼる」は**すでにある窓の作法**に乗せる約束。共通の3点セット
  // （端末の「戻る」で閉じる・後ろの画面を止める・見た目）を使っていることを見る。
  {
    const iaPanel = iaRead('src/components/TodaySuggestPanel.tsx')
    eq('IA-4 「今日なに作る？」の節を読めている（0文字なら見張りが壊れている）', iaPanel.length > 0, true)
    const iaWindowParts = [
      ['端末の「戻る」・Escapeで閉じる', 'useOverlayDismiss('],
      ['後ろの画面を止める', 'useScrollLock('],
      ['窓の見た目（共通）', 'DIALOG_CARD_CLS'],
      ['窓の後ろ（共通）', 'DIALOG_BACKDROP_CLS'],
    ]
    eq(
      'IA-4 「条件をしぼる」の窓は、すでにある窓の作法に乗っている（新しい窓を作っていない）',
      iaWindowParts.filter(([, needle]) => !iaPanel.includes(needle)).map(([label]) => label),
      [],
    )
    // 絞り込みのチップ（条件・分数・料理の種別・在庫）は、**窓の中にだけ**置く。
    // 節の側（折りたたみ）へ戻すと、開いた瞬間に下が押し下がる形に逆戻りする。
    // JSXは書いた順に画面へ出るので、チップの呼び出しが窓の目印より後ろにあることで見る
    const iaModalAt = iaPanel.indexOf('data-testid="day-conditions-modal"')
    const iaChipUses = [...iaPanel.matchAll(/conditionChipCls\(/g)].map((m) => m.index)
    eq(
      'IA-4 絞り込みのチップは窓の中だけにある（節の側の折りたたみへ戻していない）',
      iaModalAt > 0 && iaChipUses.length > 0 && iaChipUses.every((at) => at > iaModalAt),
      true,
    )
  }

  // ---- IA-5: NG食材の警告を渡し漏れていない（④・2026-08-19 便IEで対象を全画面へ広げた） ----
  // 測るのは1つだけ:「**これから作る品を出すカードは、どの画面にあっても
  // 設定『食べられない食材』を受け取っている**」。
  //
  // 便IAの時点では献立の2ファイルだけを名指しで見ていたため、買い物メモの「レシピを選ぶ」の
  // 渡し漏れが素通りした（同じ渡し漏れが別の画面で起きても当たらない書き方だった）。
  // ファイル名を書き写して並べるのをやめ、**src/ の .tsx を全部走査して、カードを出す
  // 「場所」(place) で対象かどうかを決める**形にする。画面が増えても当たる。
  //
  // 対象外は2つだけ:
  //  ・**作った記録** … place="cookedLog"（記録の一覧）と、献立の枠に収まっているのが
  //    記録のカード（photoOverride で記録の写真を出しているもの）。もう作ったものに
  //    「食べられない食材が入っています」と出しても直す先が無い
  //  ・**押せない見本** … 献立の枠(planSlot)の readOnly。サンプルデモの月の日の窓と
  //    献立テンプレの中身で、指しているレシピが端末に無いこともある見本
  //  ※「レシピを選ぶ」一覧の readOnly は見本ではない。行の中の＋/−で食数を決める作りなので
  //    カードごと押せなくしてあるだけで、出しているのはこれから作る品そのもの。だから対象。
  //
  // 場所の名前を並べただけだと、表(src/logic/cardParts.ts)に新しい場所が増えたときに
  // 黙って素通りする。**表のすべての場所を「要る／要らない」に仕分けてあるか**を先に見て、
  // 仕分けの無い場所が1つでもあればその場で不合格にする。
  //
  // IA_SRC_ROOT に別のディレクトリを渡すと、そこの src を測る
  // （この見張りが直す前のコードで本当に赤くなるかを確かめるための口）。
  {
    const iaSrcRoot = process.env.IA_SRC_ROOT ?? iaRoot
    const iaListTsx = (dir) => {
      const out = []
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...iaListTsx(full))
        else if (entry.name.endsWith('.tsx')) out.push(full)
      }
      return out.sort()
    }
    const iaFiles = iaListTsx(path.join(iaSrcRoot, 'src')).map((full) => ({
      rel: path.relative(iaSrcRoot, full).split(path.sep).join('/'),
      src: readFileSync(full, 'utf-8'),
    }))
    eq('IA-5 走査できた画面ファイルがある（0件なら見張りが壊れている）', iaFiles.length > 0, true)

    // 「これから作る品を出す場所」＝ここに並ぶもの。表の場所はすべてどちらかに入れる
    const iaNgNeeded = new Set(['recipeList', 'recipePicker', 'todayPlan', 'todaySuggest', 'planSlot'])
    const iaNgNotNeeded = new Set(['cookedLog'])
    eq(
      'IA-5 カードを出す場所すべてが「NG食材が要る／要らない」に仕分けてある（新しい場所が黙って素通りしない）',
      Object.keys(CARD_PLACE_PARTS).filter(
        (place) => !iaNgNeeded.has(place) && !iaNgNotNeeded.has(place),
      ),
      [],
    )
    eq(
      'IA-5 仕分けに書いた場所は、すべて表に実在する（消えた場所を見張り続けない）',
      [...iaNgNeeded, ...iaNgNotNeeded].filter((place) => !Object.hasOwn(CARD_PLACE_PARTS, place)),
      [],
    )

    /** `<RecipeCard` の開きタグを、波かっこの深さを見ながら切り出す（属性の中の `>` に釣られない） */
    const iaCardOpenTags = (src) => {
      const tags = []
      let at = src.indexOf('<RecipeCard')
      while (at >= 0) {
        let depth = 0
        let end = -1
        for (let i = at; i < src.length; i++) {
          const ch = src[i]
          if (ch === '{') depth++
          else if (ch === '}') depth--
          else if (ch === '>' && depth === 0) {
            end = i
            break
          }
        }
        if (end < 0) return { error: `開きタグの終わりが見つからない（位置 ${at}）` }
        tags.push(src.slice(at, end + 1))
        at = src.indexOf('<RecipeCard', end)
      }
      return { tags }
    }

    const iaCalls = []
    const iaReadErrors = []
    for (const { rel, src } of iaFiles) {
      if (rel === 'src/components/RecipeCard.tsx') continue
      const found = iaCardOpenTags(src)
      if (found.error) {
        iaReadErrors.push(`${rel}: ${found.error}`)
        continue
      }
      for (const tag of found.tags) {
        const literal = tag.match(/\bplace="([A-Za-z]+)"/)
        // 式で渡されると読めない＝黙って既定に倒さず、その場で不合格にする
        const expr = tag.match(/\bplace=\{([^}]*)\}/)
        if (expr) {
          iaReadErrors.push(`${rel}: 場所の式が読めない: ${expr[1].trim()}`)
          continue
        }
        const place = literal ? literal[1] : DEFAULT_CARD_PLACE
        if (!Object.hasOwn(CARD_PLACE_PARTS, place)) {
          iaReadErrors.push(`${rel}: 表に無い場所: ${place}`)
          continue
        }
        iaCalls.push({ rel, place, tag })
      }
    }
    eq('IA-5 カードの呼び出しを切り出せている（読めない書き方が無い）', iaReadErrors, [])
    eq('IA-5 カードの呼び出しを1つ以上拾えている（0件なら見張りが壊れている）', iaCalls.length > 0, true)

    /** 作った記録のカード（記録の一覧・献立の枠に収まった記録） */
    const iaIsCookedLog = (c) => iaNgNotNeeded.has(c.place) || /\bphotoOverride=/.test(c.tag)
    /** 押せない見本（献立の枠の readOnly） */
    const iaIsSample = (c) => c.place === 'planSlot' && /\breadOnly\b/.test(c.tag)
    const iaMust = iaCalls.filter((c) => !iaIsCookedLog(c) && !iaIsSample(c))
    const iaWhere = (c) =>
      `${c.rel} place=${c.place} ${c.tag.replace(/\s+/g, ' ').slice(0, 70)}…`

    eq('IA-5 NG食材を渡すべきカードが1つ以上ある（全部が対象外に倒れていない）', iaMust.length > 0, true)
    eq(
      'IA-5 対象外の判定が空振りしていない（作った記録・押せない見本を1つも拾えていないなら書き方が変わっている）',
      iaCalls.filter(iaIsCookedLog).length > 0 && iaCalls.filter(iaIsSample).length > 0,
      true,
    )
    eq(
      'IA-5 これから作る品を出すカードは、どの画面にあっても必ずNG食材を受け取っている',
      iaMust.filter((c) => !/\bngIngredients=/.test(c.tag)).map(iaWhere),
      [],
    )
  }
}

// ---------- 便IN: 折りたたみの中にしか無い操作が無いか（COLLAPSE-1） ----------
/**
 * オーナーの原則（2026-08-20）:
 *   「アプリ全体で、折りたたみを一切開かなくても、最低限一通りすべての機能を触れる
 *     （使いこなすために開く）ようにしたい。」
 *
 * **2026-08-22 オーナーの訂正（便IV）**:
 *   「折りたたみの状態でも最低限使えるように、というのは、まとめてやテンプレートのような
 *     初心者が使わないような機能はしまっておく、という意味合いでした。」
 * ＝この原則は「**毎日使うものは畳んでも押せる**」であって、「すべての操作を外に出す」では
 * なかった。便IN（2026-08-21）が後者と読んで、週タブの「空にする」「テンプレートとして保存」
 * 「テンプレートを適用」「過去の献立をコピー」を折りたたみの外へ出したが、
 * 便IVでオーナーの訂正どおり中へ戻した。**下の一覧はその訂正の受け皿でもある**。
 *
 * この見張りは**5か所を名前で並べるのではなく、規則で掃く**:
 *   ① `src/**\/*.tsx` から `<Collapse>…</Collapse>` の中身の範囲を取る（畳むと消える場所）
 *   ② 「畳むと消える場所でしか使われていない部品」も同じ扱いにする（何段でもたどる）。
 *      例: レシピ詳細の栄養枠は Collapse の中で `<LockedBody>` を描き、その中で
 *      `<ProNutrientTeaser>` を描く。中身は別の関数に書いてあるが、画面では二重に隠れている
 *   ③ その範囲にある**操作の要素**（button / Link / select / input / textarea / label）が
 *      使っている文言キー（`ja.○○.△△`）を集める
 *   ④ そのキーが**折りたたみの外に1つも出てこない**なら、「開かないと触れない操作」とみなす
 *
 * 文言そのものは書き写さない（キーで測る）＝ja.ts の文を直しても、この見張りは赤くならない。
 *
 * 外に出てきても「入口」と数えないもの: 読み上げ名（aria-label）と見出し（h1〜h6）。
 * ボタンを押して開く窓が、そのボタンと同じ文言を見出し・読み上げ名に使うため
 * （例「表示している週をテンプレートとして保存」）、数えると入口が有るように見えてしまう。
 *
 * 開いてから、でよいものは下の一覧に**理由つきで**書く。ここに足すこと自体が
 * 「畳んだままでは触れない」と認めた記録になる（黙って通せない形にしてある）。
 */
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  /** 開いてから、でよい操作（キー → そう決めた理由） */
  const OPEN_TO_REFINE = {
    // --- 献立の「週」 ---
    // 表示起点の切替は「見え方の好み」で、既定（週区切り）のままでも週の中身は全部読める。
    // 「表示のしかた」の見出しの横は表示する食事のチップで埋まっており、
    // そこへ選び方をもう1つ出すと、同じ場所に2種類の選び方が並んでどちらがどちらか読めなくなる。
    // 2026-08-22 便JF・⑤: 2つのチップからプルダウンにした（欄の名前 weekLayoutLabel が増えた）
    'ja.mealPlan.weekLayoutLabel': '表示起点の切替は見え方の好み。既定のままでも週の中身は全部読める',
    'ja.mealPlan.weekLayoutCalendar': '表示起点の切替は見え方の好み。既定のままでも週の中身は全部読める',
    'ja.mealPlan.weekLayoutRolling': '表示起点の切替は見え方の好み。既定のままでも週の中身は全部読める',
    // 2026-08-22 便JF・①: 過ぎた日に作った記録を後から足す入口。曜日カードを開いて
    // 「編集」を押した先にある＝畳んでいるカードから触れないのは「畳む」機能そのもの。
    // 押す入口（曜日カードの「編集」）は畳んでいない日には必ず見出しの行に出ている
    'ja.mealPlan.pastRecordAdd': '曜日カードを開いて「編集」を押した先の操作。畳んだ日の中身が見えないのは畳む機能そのもの',
    // 2026-08-22 便IV（オーナー原文「「表示のしかた」の折りたたんだ表示には、空にする項目を
    // 入れないで」）: 週の献立をまとめて消す操作は**しまう側**。毎日押すものではなく、
    // 訂正の原文が名指しした「初心者が使わないような機能」に当たる。
    // 開けば「何が消えるか」の1行・対象の食事のチップ・ボタンが同じ場所にそろって出る
    'ja.mealPlan.clearWeekSlotButton': '週の献立をまとめて消す操作。毎日押すものではないのでしまう（便IVのオーナーの訂正）',
    'ja.mealPlan.clearWeekSlotTargetAria': '同上（「空にする」の対象を選び直すチップ）',
    // 2026-08-22 便IV（オーナー原文「テンプレートエリアは折りたたみ状態でボタンはなし。」）:
    // テンプレートの節は、訂正の原文が名指しでしまう側に挙げている
    'ja.mealPlan.templateSave': '「まとめてやテンプレートのような初心者が使わないような機能はしまっておく」（便IVのオーナーの訂正）',
    'ja.mealPlan.templateApplyWeek': '同上',
    'ja.mealPlan.copyPickTitle': '同上（過去の献立をコピー。テンプレートと同じ節にある）',
    // 2026-08-26 便LH（オーナー原文「献立関連のボタンがバラバラに配置してあるように見えるので、
    // １グループにまとめて。折りたたみの見える部分は「献立をまとめて提案」のみ。」）:
    // 月タブのテンプレートも、週タブと同じ「しまっておく」側へ入った。
    // 畳んでいても押せるのは「献立をまとめて提案」だけ、というオーナーの名指しどおりの形
    'ja.mealPlan.templateApplyMonth': '月タブの献立の節も「見える部分は献立をまとめて提案のみ」（便LHのオーナー指示）',
    'ja.mealPlan.templateApplyRange': '同上（期間で絞っているときの同じボタン）',
    // 「まとめて献立を入力」の実行ボタンは折りたたみの外＝節の見出しの横にある
    // （2026-08-20 便II・③ → 2026-08-22 便IVで見出しの横へ。オーナー原文
    //  「「まとめて献立てを入力」ボタンは「献立を提案」の横にして、１列におさめて。」）。
    // 入れかたと条件は、その1つのボタンの効き方を細かく決めるもの＝使いこなすために開く側
    'ja.mealPlan.fillModeTitle': '「まとめて献立を入力」の効き方を決める欄。実行ボタンは見出しの横に常に出ている',
    'ja.mealPlan.fillModeFillEmpty': '同上',
    'ja.mealPlan.fillModeReplaceAll': '同上',
    // 献立表・期間の集計・概算食費は、節の見出しがそのまま機能の名前になっている
    // （見出しを読めば何ができるか分かり、開くのは実行の直前の一手）
    'ja.mealPlan.planSheetPrint': '節の見出し「献立表（印刷・画像で保存）」が機能の名前そのもの',
    'ja.mealPlan.planSheetImage': '同上',
    'ja.mealPlan.planSheetIncludeEmptyDays': '同上（載せる中身の細かい指定）',
    'ja.mealPlan.rangeDateStartLabel': '期間の集計の日付欄。節の見出しが機能の名前そのもの',
    'ja.mealPlan.rangeDateEndLabel': '同上',
    'ja.mealPlan.weekCostNoteLink': '概算食費の中の案内。食材と価格の画面は設定からも開ける',
    'ja.mealPlan.budgetSetLink': '概算食費の中の案内。週の食費予算は設定の同じ欄からも入れられる',
    'ja.mealPlan.shopRangeReset': '買い物メモの範囲を狭めた人にだけ出る戻し方。狭める操作と同じ場所にある',
    // --- 設定「古い記録の書き出し（アーカイブ）」（2026-08-22 便JJ） ---
    // オーナー原文:「『古い記録の書き出し』→『古い記録の書き出し（アーカイブ）』にして、
    // 折りたたんで。機種変のように、一部の人がたまにしか触らない機能のため。」
    // 開閉ボタン（archiveToggle）が機能の名前そのもので、その1つの機能を行うための
    // 一続きの操作（期間を選ぶ→書き出す→確かめてから消す→あとで読む）が中に入っている
    'ja.settings.archivePeriodOption': '「古い記録の書き出し（アーカイブ）」の中。たまにしか触らない機能なので畳む（オーナー指示）',
    'ja.settings.archiveExportButton': '同上（書き出す本体）',
    'ja.settings.archiveExportBusy': '同上',
    'ja.settings.archiveAppendButton': '同上（前回のファイルに足す）',
    'ja.settings.archiveAppendClear': '同上',
    'ja.settings.archiveDeleteButton': '同上（書き出したあとに端末から消す）',
    'ja.settings.archiveViewButton': '同上（書き出したファイルを読む）',
    // --- レシピ一覧の絞り込み ---
    // 「絞り込み」の開閉ボタンは常に見えていて、中身は絞り込みそのもの
    'ja.search.sortAsc': 'レシピ一覧の絞り込みパネル。開閉ボタンは常に見えており、中身が機能そのもの',
    'ja.search.sortDesc': '同上',
    'ja.search.sortNutritionGate': '同上（Pro案内。設定のProからも同じ場所へ行ける）',
    'ja.search.sortNutritionGateHint': '同上',
    'ja.search.favoriteOnly': '同上',
    'ja.search.excludeNg': '同上',
    'ja.search.myRecipesOnly': '同上',
    'ja.search.dishTypeAll': '同上',
    'ja.search.quickOnly': '同上',
    'ja.search.pantryFilter': '同上',
    'ja.search.pantryToIngredients': '同上',
    'ja.search.tagMatchAllSwitch': '同上',
    'ja.search.savedSearchRemoveAria': '同上（保存した条件の削除）',
    'ja.search.legacyTagRemove': '同上（古いタグの削除）',
    'ja.search.legacyTagRemoveAria': '同上',
    // --- レシピの登録 ---
    'ja.paste.placeholder': 'レシピ登録の「文章から取り込む」欄。開閉ボタンが取り込みの名前そのもの',
    'ja.paste.apply': '同上',
    // 取り込みが成功したあとに「自動で振り分ける」「読み込む」の場所へ出る、パネルを閉じるだけの
    // ボタン（2026-09-01 便MS・③）。取り込みの結果と同じ場所なので、開いていなければ用が無い
    'ja.paste.finish': '同上',
    'ja.urlImport.placeholder': 'レシピ登録の「URLから取り込む」欄。開閉ボタンが取り込みの名前そのもの',
    'ja.urlImport.apply': '同上',
    'ja.urlImport.loading': '同上',
    'ja.urlImport.fetchPhoto': '同上（取り込むときの細かい指定）',
    'ja.urlImport.fetchPhotoNote': '同上',
    'ja.form.iconAuto': 'レシピ登録の絵の選び直し。既定は料理名から自動で選ばれており、開かなくても絵は付く',
    'ja.chip.remove': 'チップ入力欄の✕。欄そのものが見えていれば✕も見えている（欄の部品）',
    // --- 並行調理ナビ ---
    'ja.cookNavi.ingredientsServings': '材料の一覧の見出しに出る人数。押すのは開閉だけで、操作ではない',
    /**
     * 「この手順を先にする」（他の品の次の手順を開いた中）。**畳んだままでは触れないと認める。**
     *
     * 直さない理由（2026-08-11 便FO・オーナー承認済みの設計をそのまま守る）:
     *   下部の行は「タップ＝全文を見る」だけの意味にしてある。
     *   components/CookSessionOverlay.tsx の peekRecipeId の説明にあるとおり、
     *   「同じ行に『見る』と『移る』の2つの意味を持たせると、台所で押し間違えたときに
     *     どちらが起きたのか分からなくなる」。
     *   行の横に「先にする」を常設すると、まさにその2つの意味が1行に並ぶ。
     *   押し間違えると調理中の段取りが別の品へ移って番号が振り直されるので、
     *   濡れた手で触る画面では取り返しがつきにくい。
     *   2026-08-26 便LG・オーナー原文「「タップすると全文が出ます〜」削除。触ればわかること。」で、
     *   常設していた案内（ja.cookNavi.sessionOthersHint）そのものを消した。行を押せば全文と
     *   一緒にこのボタンが出るので、先に予告はしない
     *   ＝**畳んだままでは触れないことは今までどおり認める**。
     */
    'ja.cookNavi.sessionPeekMove': '調理中の押し間違いを避けるため、開いた中に残す',
    // --- 栄養 ---
    'ja.nutritionBalance.notesToggle': '注記と出典の開閉。読むものであって操作ではない',
    'ja.nutrition.gateLink': 'Pro版の案内リンク。設定の「Pro」から同じ場所へ行ける',
  }

  const tsxFiles = []
  const walkTsx = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walkTsx(p)
      else if (entry.name.endsWith('.tsx')) tsxFiles.push(p)
    }
  }
  walkTsx(path.join(appRoot, 'src'))

  /** 文字列・コメントの終わりの次を返す（違えば -1） */
  const skipLiteral = (src, i) => {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i)
      return e === -1 ? src.length : e
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      return e === -1 ? src.length : e + 2
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue }
        if (src[j] === c) return j + 1
        j++
      }
      return src.length
    }
    return -1
  }
  /** 宣言の先頭から、その本体の { } の範囲を返す */
  const bodySpan = (src, from) => {
    let i = from
    let paren = 0
    let started = false
    let depth = 0
    while (i < src.length) {
      const sk = skipLiteral(src, i)
      if (sk !== -1) { i = sk; continue }
      const c = src[i]
      if (!started) {
        if (c === '(') paren++
        else if (c === ')') paren--
        else if (c === '{' && paren === 0) { started = true; depth = 1 }
        else if (c === ';' && paren === 0) return null
      } else if (c === '{') depth++
      else if (c === '}') { depth--; if (depth === 0) return [from, i + 1] }
      i++
    }
    return null
  }
  /** 開始タグの `>` の位置（属性の中の {} と '' は飛ばす） */
  const endOfOpenTag = (src, from) => {
    let i = from
    let depth = 0
    let quote = null
    while (i < src.length) {
      const c = src[i]
      if (quote) {
        if (c === quote) quote = null
        else if (c === '\\') i++
      } else if (c === '"' || c === "'" || c === '`') quote = c
      else if (c === '{') depth++
      else if (c === '}') depth--
      else if (c === '>' && depth === 0) return i
      i++
    }
    return -1
  }
  /** 同じ名前の入れ子を数えて、対応する終了タグの位置を返す */
  const matchingClose = (src, tag, afterOpen) => {
    const openRe = new RegExp(`<${tag}\\b`, 'g')
    const closeRe = new RegExp(`</${tag}\\s*>`, 'g')
    let depth = 1
    let i = afterOpen
    while (i < src.length) {
      openRe.lastIndex = i
      closeRe.lastIndex = i
      const o = openRe.exec(src)
      const c = closeRe.exec(src)
      if (!c) return -1
      if (o && o.index < c.index) {
        const e = endOfOpenTag(src, o.index)
        if (e !== -1 && src[e - 1] === '/') { i = e + 1; continue }
        depth++
        i = o.index + 1
        continue
      }
      depth--
      if (depth === 0) return c.index
      i = c.index + 1
    }
    return -1
  }
  /** その要素の中身の範囲（自己終了は開始タグだけ） */
  const elementSpan = (src, start, tag) => {
    const e = endOfOpenTag(src, start)
    if (e === -1) return [start, src.length]
    if (src[e - 1] === '/') return [start, e + 1]
    const close = matchingClose(src, tag, e + 1)
    return [start, close === -1 ? e + 1 : close]
  }

  const JA_KEY = /\bja\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+/g
  const INTERACTIVE = /<(button|Link|select|input|textarea|label)\b/g
  const JSX_COMPONENT = /<([A-Z][A-Za-z0-9_]*)\b/g
  const normalizeKey = (key) => key.replace(/\.(replace|replaceAll|toLocaleString)$/, '')

  const parsed = tsxFiles.map((file) => {
    const src = readFileSync(file, 'utf-8')
    const collapse = []
    const re = /<Collapse\b/g
    let m
    while ((m = re.exec(src))) {
      const e = endOfOpenTag(src, m.index)
      if (e === -1) continue
      if (src[e - 1] === '/') { re.lastIndex = e + 1; continue }
      const close = matchingClose(src, 'Collapse', e + 1)
      if (close === -1) continue
      collapse.push([e + 1, close])
      re.lastIndex = e + 1
    }
    const comps = new Map()
    for (const decl of [
      /^(?:export\s+)?(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)/gm,
      /^(?:export\s+)?const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/gm,
    ]) {
      let d
      while ((d = decl.exec(src))) {
        if (comps.has(d[1])) continue
        const span = bodySpan(src, d.index)
        if (span) comps.set(d[1], span)
      }
    }
    return { file, src, collapse, comps }
  })

  // 2026-08-27 便LQ（docs/74 第4手）: 献立の画面の状態と手続きは
  // src/pages/mealPlan/useMealPlanState.ts（.ts）へ移した。折りたたみ（<Collapse>）も部品も
  // JSXの側に残っているので、こちらは**「畳んでいない場所で使っている文言」を数えるためだけ**に
  // 読む（部品の定義としては数えない＝同じ名前の取り違えで見張りが緩まないようにする）。
  // ここを読まないと、画面の外へ出しただけの文言が「開かないと触れない」に見えて赤くなる
  const COLLAPSE_PLAIN_SOURCES = ['src/pages/mealPlan/useMealPlanState.ts']
  eq(
    'COLLAPSE-1 前提: 折りたたみの外で文言を使う場所（画面の状態と手続き）を読めている',
    COLLAPSE_PLAIN_SOURCES.length > 0 &&
      COLLAPSE_PLAIN_SOURCES.every((rel) => existsSync(path.join(appRoot, rel))),
    true,
  )
  for (const rel of COLLAPSE_PLAIN_SOURCES) {
    const file = path.join(appRoot, rel)
    parsed.push({ file, src: readFileSync(file, 'utf-8'), collapse: [], comps: new Map() })
  }

  // 同じ名前の部品が2つ以上あるファイルは、どちらを指しているか決められないので見ない
  const defs = new Map()
  for (const p of parsed) {
    for (const [name, span] of p.comps) {
      if (defs.has(name)) defs.set(name, null)
      else defs.set(name, { file: p.file, span })
    }
  }

  // 「畳むと消える範囲」を、部品をたどって広げる（動かなくなるまで繰り返す）
  const hidden = new Map(parsed.map((p) => [p.file, p.collapse.map((r) => r.slice())]))
  const inHidden = (file, i) => (hidden.get(file) ?? []).some(([a, b]) => i >= a && i < b)
  for (let round = 0; round < 8; round++) {
    let changed = false
    for (const [name, def] of defs) {
      if (!def) continue
      if ((hidden.get(def.file) ?? []).some(([a, b]) => def.span[0] >= a && def.span[1] <= b)) continue
      let uses = 0
      let hiddenUses = 0
      for (const p of parsed) {
        JSX_COMPONENT.lastIndex = 0
        let u
        while ((u = JSX_COMPONENT.exec(p.src))) {
          if (u[1] !== name) continue
          uses++
          if (inHidden(p.file, u.index)) hiddenUses++
        }
      }
      if (uses > 0 && uses === hiddenUses) {
        hidden.get(def.file).push([def.span[0], def.span[1]])
        changed = true
      }
    }
    if (!changed) break
  }

  const reachable = new Set()
  const hiddenOps = new Map()
  for (const p of parsed) {
    // 読み上げ名と見出しは「入口」と数えない（押して開く窓が同じ文言を使うため）
    const notEntry = []
    for (const re of [/aria-label=\{[^}]*\}/g, /<h[3-6][^>]*>[\s\S]*?<\/h[3-6]>/g]) {
      let s
      while ((s = re.exec(p.src))) notEntry.push([s.index, s.index + s[0].length])
    }
    JA_KEY.lastIndex = 0
    let k
    while ((k = JA_KEY.exec(p.src))) {
      if (inHidden(p.file, k.index)) continue
      if (notEntry.some(([a, b]) => k.index >= a && k.index < b)) continue
      reachable.add(normalizeKey(k[0]))
    }
    for (const [a, b] of hidden.get(p.file)) {
      const body = p.src.slice(a, b)
      INTERACTIVE.lastIndex = 0
      let im
      while ((im = INTERACTIVE.exec(body))) {
        const [s, t] = elementSpan(body, im.index, im[1])
        const chunk = body.slice(s, t)
        JA_KEY.lastIndex = 0
        let j
        while ((j = JA_KEY.exec(chunk))) {
          const key = normalizeKey(j[0])
          const line = p.src.slice(0, a + s).split('\n').length
          if (!hiddenOps.has(key)) hiddenOps.set(key, new Set())
          hiddenOps.get(key).add(`${path.relative(appRoot, p.file)}:${line}`)
        }
        INTERACTIVE.lastIndex = im.index + 1
      }
    }
  }

  const unreachable = [...hiddenOps.keys()]
    .filter((key) => !reachable.has(key) && !(key in OPEN_TO_REFINE))
    .sort()
  eq(
    'COLLAPSE-1 折りたたみを開かないと触れない操作が無い（開いてよいものは理由つきで一覧に書く）',
    unreachable.map((key) => `${key} (${[...hiddenOps.get(key)].join(' , ')})`),
    [],
  )
  // 一覧のほうが古くなっていないか（直したのに理由が残っていると、次の人が読み違える）
  const stale = Object.keys(OPEN_TO_REFINE).filter((key) => !hiddenOps.has(key)).sort()
  eq('COLLAPSE-1 「開いてから」の一覧に、もう当てはまらないものが残っていない', stale, [])
  // 見張りそのものが動いているか（掴み損ねて素通りの合格に倒れない）
  eq('COLLAPSE-1 折りたたみの中の操作を掴めている', hiddenOps.size > 20, true)

  /**
   * IV-4: オーナーが「しまっておく」と名指しした4つが、本当に折りたたみの中にあること
   * （2026-08-22 便IV）。
   *
   * 上の unreachable / stale は「外に出ているのに一覧に書いてある」を拾うが、
   * **一覧ごと消して外へ出し直す**と、どちらも赤くならずに便INの形へ戻ってしまう。
   * ここは名指しの4つを直接見る＝戻したらその場で分かる。
   */
  const IV_MUST_BE_INSIDE = [
    'ja.mealPlan.clearWeekSlotButton',
    'ja.mealPlan.templateSave',
    'ja.mealPlan.templateApplyWeek',
    'ja.mealPlan.copyPickTitle',
  ]
  eq(
    'IV-4 「空にする」「テンプレート保存」「テンプレート適用」「過去の献立をコピー」は折りたたみの中にある',
    IV_MUST_BE_INSIDE.filter(
      (key) =>
        ![...(hiddenOps.get(key) ?? [])].some((where) => where.startsWith('src/pages/MealPlanPage.tsx')),
    ),
    [],
  )
  /**
   * 逆に「まとめて献立を入力」は、畳んだままでも押せる場所に出したままであること
   * （オーナーの訂正は「毎日使うものまでしまえ」ではない）。
   * MealPlanPage.tsx の折りたたみの中で使われていないことで見る。
   */
  eq(
    'IV-4 「まとめて献立を入力」は折りたたみの中に入れていない（毎日押すものはしまわない）',
    [...(hiddenOps.get('ja.mealPlan.fillWeek') ?? [])].filter((where) =>
      where.startsWith('src/pages/MealPlanPage.tsx'),
    ),
    [],
  )
}

// ==========================================================================================
// IQ-1〜IQ-8: 「行を左へ払うと『外す』が出る」の見張り（2026-08-21 便IQ）
//
// オーナー原文: 「横にスワイプして消せるのが楽なんですけどね。」
// オーナーが実機で確かめた事実: 献立の行を**左端から右へ**払うと「ChromeでもSafariでも戻ります」
// ＝端からの戻るジェスチャーはWebページ側では検知も無効化もできない。
// そこで**向きと起点を変えて**ぶつからない形にした（行の途中から左へ払う）。
//
// ここで見張るのは「作りで守ること」＝**壊れたら黙って消える性質**だけを、
// 実画面を立てずに読み取れる形で置いてある（動きそのものは e2e の DAYSWIPE-01 が測る）。
//   IQ-1 … ブラウザの「戻る」に譲る左端の幅が残っていること（30px）
//   IQ-2 … 起点が左端のときは何も掴まないこと（判定そのものが消えていない）
//   IQ-3 … 縦の指をブラウザに残すこと（touch-action に pan-y が敷いてある）
//   IQ-4 … **押して初めて外れる**こと（外す処理を呼ぶのはボタンの押下だけ。指を離す処理からは呼ばない）
//   IQ-5 … 今日の献立の行がこの器を通っていること
//   IQ-6 … **付けすぎていない**こと（この器を使うのは今日の献立の行だけ。
//           買い物メモの品目・食材の在庫には付けない＝同じ払いが別の場所で違う結果になるのを防ぐ）
//   IQ-7 … 払う以外の道が残っていること（整理モードの×＝キーボード・読み上げの順路）
//   IQ-8 … ボタンの文言が規約H-2に沿っていること（意味を担う語は漢字・短い）
//
// 読み取りに失敗したら必ず落ちる（ファイルが無ければ IQ-0 が赤になり、残りも空振りで赤になる）。
// ==========================================================================================
{
  const iqScriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const iqRoot = process.env.IQ_SRC_ROOT ?? path.join(iqScriptDir, '..')
  const iqRowPath = path.join(iqRoot, 'src/components/SwipeRevealRow.tsx')
  // 献立の画面は2026-08-25 便KZ（docs/74 第3手）で、画面の本体と src/pages/mealPlan/ の部品に
  // 分かれた（中身は1文字も動かしていない）。今日の献立の行（TodayListRow）は DayParts.tsx に
  // あるので、ここは**画面一式**を1つの本文として読む＝分ける前と同じものを見ている
  const iqPagePaths = [
    'src/pages/MealPlanPage.tsx',
    'src/pages/mealPlan/DayParts.tsx',
    'src/pages/mealPlan/IntakeParts.tsx',
    'src/pages/mealPlan/MonthParts.tsx',
  ].map((rel) => path.join(iqRoot, rel))
  eq('IQ-0 払いの器のファイルが読める（無ければ以下は全部空振りになる）', existsSync(iqRowPath), true)
  const iqRow = existsSync(iqRowPath) ? readFileSync(iqRowPath, 'utf-8') : ''
  const iqPage = iqPagePaths
    .map((full) => (existsSync(full) ? readFileSync(full, 'utf-8') : ''))
    .join('\n')

  // ---- IQ-1: ブラウザの「戻る」に譲る左端の幅 ----------------------------------------------
  // iOSの端からの戻るジェスチャーは左0〜30pxから始まり、献立の行は左端x=33pxから始まる。
  // ここを0にすると、行の左端で始めた払いが「戻る」と取り合いになる
  eq(
    'IQ-1 ブラウザの「戻る」に譲る左端の幅が30pxで残っている',
    /export const SWIPE_BACK_EDGE_PX = 30\b/.test(iqRow),
    true,
  )
  // ---- IQ-2: 起点が左端なら何も掴まない ----------------------------------------------------
  eq(
    'IQ-2 起点が左端のときは払いを掴まない（判定が消えていない）',
    /clientX <= SWIPE_BACK_EDGE_PX/.test(iqRow),
    true,
  )
  // ---- IQ-3: 縦の指はブラウザに残す --------------------------------------------------------
  // touch-action から pan-y が落ちると、一覧の縦スクロールがこの行の上だけ効かなくなる
  eq(
    'IQ-3 縦のスクロールはブラウザが受け持つ（touch-action に pan-y が敷いてある）',
    /touchAction: 'pan-y[^']*'/.test(iqRow),
    true,
  )
  // ---- IQ-4: 押して初めて外れる ------------------------------------------------------------
  // 「払い切ったら外れる」に変わっていないか。外す処理の呼び出しは1か所だけで、
  // それはボタンの中にある（指を離す処理＝finish からは呼ばない）
  const iqActionCalls = (iqRow.match(/onAction\(\)/g) ?? []).length
  const iqButtonStart = iqRow.indexOf('<button')
  const iqButtonEnd = iqRow.indexOf('</button>')
  const iqButton = iqButtonStart >= 0 && iqButtonEnd > iqButtonStart ? iqRow.slice(iqButtonStart, iqButtonEnd) : ''
  eq(
    'IQ-4 外すのはボタンを押したときだけ（払い切っただけでは外れない）',
    iqActionCalls === 1 && iqButton.includes('onAction()'),
    true,
  )
  // ---- IQ-5: 今日の献立の行がこの器を通っている --------------------------------------------
  eq('IQ-5 今日の献立の行が払いの器を通っている', /<SwipeRevealRow\b/.test(iqPage), true)
  // ---- IQ-6: 付けすぎていない --------------------------------------------------------------
  // 同じ払いが別の場所で違う結果になるのを防ぐため、いまは今日の献立の行だけに付ける。
  // 増やすときは、ここの一覧を意図して書き換える（黙って増えない）
  /** src配下の .tsx を集める（この見張り専用。他の見張りの走査に依らない） */
  const iqListTsx = (dir) => {
    const out = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) out.push(...iqListTsx(full))
      else if (entry.name.endsWith('.tsx')) out.push(full)
    }
    return out.sort()
  }
  const iqAllTsx = iqListTsx(path.join(iqRoot, 'src'))
  eq('IQ-0 走査できた画面ファイルがある（0件なら見張りが壊れている）', iqAllTsx.length > 0, true)
  const iqUsers = iqAllTsx
    .filter((full) => /<SwipeRevealRow\b/.test(readFileSync(full, 'utf-8')))
    .map((full) => path.relative(iqRoot, full).split(path.sep).join('/'))
  eq('IQ-6 払いで外せるのは今日の献立の行だけ（買い物メモ・食材の在庫には付けない）', iqUsers, [
    // 今日の献立の行（TodayListRow）は 2026-08-25 便KZ で src/pages/mealPlan/DayParts.tsx へ移した
    'src/pages/mealPlan/DayParts.tsx',
  ])
  // ---- IQ-7: 払う以外の道が残っている ------------------------------------------------------
  // 整理モードの×＝キーボードでも読み上げでも届く順路。払う操作しか無い形にしない
  eq(
    'IQ-7 払う以外の道（整理モードの×）が残っている',
    iqPage.includes('ja.mealPlan.todayOrganizeToggle') &&
      /aria-label=\{removeLabel \?\? ja\.mealPlan\.todayRemove\}/.test(iqPage),
    true,
  )
  // ---- IQ-8: ボタンの文言（規約H-2） -------------------------------------------------------
  // 88pxの幅に収める短さで、意味を担う語は漢字（「はずす」と開かない）
  eq('IQ-8 払って出るボタンの文言', ja.mealPlan.todaySwipeRemove, '外す')
}

// ---------- JE-1: 並ぶカードの「角」と「線」がトークンの1か所で決まっている ----------
//
// 2026-08-22 便JE（オーナー確定「②：４px。（中略）見本では角が消えて見えていたものがあるため、
// 実装時に上手くいかない可能性が心配。」／「レシピカードの線を濃く（太く？）すると、
// レシピカードが見分けやすいかも」）。
//
// ここで見張るのは**決まりごとの側**（画面の見え方は e2e の JECARD-01 / JELINE-02 が測る）:
//  ①角と線が src/index.css の1か所（--radius-card / --border-card）で決まっていること
//  ②その2つが @theme inline に登録されていること
//    ＝登録が消えると `rounded-card` `border-edge-card` は**何もしないクラス**になり、
//      角は直角に戻り、線は消える（オーナーが心配した「角が消えて見える」がそのまま起きる）
//  ③線の色を直に書いていないこと（既存トークンの混合で作る＝5テーマとも自動で追従する）
//  ④画面側のファイルに、角の px を直に書いた抜け道が無いこと
{
  const jeRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const jeCss = readFileSync(path.join(jeRoot, 'src/index.css'), 'utf-8')
  const jeDecl = (name) => {
    const m = jeCss.match(new RegExp(`^\\s*${name}:\\s*([^;]+);`, 'm'))
    return m ? m[1].trim() : null
  }
  eq('JE-1 並ぶカードの角丸のトークン（--radius-card）がある', jeDecl('--radius-card') !== null, true)
  eq('JE-1 並ぶカードの線のトークン（--border-card）がある', jeDecl('--border-card') !== null, true)
  // @theme inline に登録されていないと、rounded-card / border-edge-card は何もしないクラスになる
  const jeTheme = jeCss.slice(jeCss.indexOf('@theme inline'))
  eq(
    'JE-1 rounded-card が使えるように登録されている',
    /--radius-card:\s*var\(--radius-card\)/.test(jeTheme),
    true,
  )
  eq(
    'JE-1 border-edge-card が使えるように登録されている',
    /--color-edge-card:\s*var\(--border-card\)/.test(jeTheme),
    true,
  )
  // 線の色は既存トークンの混合で作る（直に色を書かない＝テーマを変えたら自動で追従する）
  const jeBorderCard = jeDecl('--border-card') ?? ''
  eq('JE-1 線の色を直に書いていない', /#[0-9a-fA-F]{3,8}|\brgb\(/.test(jeBorderCard), false)
  eq(
    'JE-1 線の色を既存のトークンから作っている',
    /var\(--text\)/.test(jeBorderCard) && /var\(--border\)/.test(jeBorderCard),
    true,
  )
  // 画面側に角の px を直に書いた抜け道が無いか（トークンを変えても直らない場所を作らない）
  const jeFiles = [
    'src/components/RecipeCard.tsx',
    'src/pages/MealPlanPage.tsx',
    // 献立の画面から切り出した部品（2026-08-25 便KZ）。抜け道を作らないので一緒に見る
    'src/pages/mealPlan/DayParts.tsx',
    'src/pages/mealPlan/IntakeParts.tsx',
    'src/pages/mealPlan/MonthParts.tsx',
    // 状態と手続き（2026-08-27 便LQ・docs/74 第4手）。JSXは無いが、角のpxを直に書いた
    // 値をここへ置けば素通りしてしまうので、切り出した先はここにも足す
    'src/pages/mealPlan/useMealPlanState.ts',
    'src/pages/RecipesPage.tsx',
    // レシピ一覧から切り出した並び替え／絞り込みパネル（2026-08-25 便KZ の献立と同じ形・2026-08-27 便LM）。
    // ここへ足さないと、角の px を直に書く抜け道が「別のファイルへ移せば素通りする」形で残る
    'src/components/RecipeSortPanel.tsx',
    'src/components/RecipeFilterPanel.tsx',
    'src/components/recipePanelParts.tsx',
    'src/pages/MealTemplatesPage.tsx',
    'src/pages/MealPlanCopyWeekPage.tsx',
  ]
  const jeHardCoded = []
  for (const f of jeFiles) {
    const src = readFileSync(path.join(jeRoot, f), 'utf-8')
    for (const m of src.matchAll(/rounded-\[[^\]]*\]/g)) jeHardCoded.push(`${f}: ${m[0]}`)
    for (const m of src.matchAll(/borderRadius:\s*'[^']*'/g)) jeHardCoded.push(`${f}: ${m[0]}`)
  }
  eq('JE-1 角の大きさを直に書いた場所が無い', jeHardCoded, [])
}

// ---------- JP-1: 今日の献立の行を包む「払いの器」が、カードの角を切り落としていない ----------
//
// オーナー原文: 「① 今日の献立のレシピカードの角が消えています。」
//
// 実測（3倍で撮り、角から斜め45度に進んで地の色から変わるまでの距離）:
//   レシピ一覧のカード   … 上辺2px・左辺1px・斜め0.67px で線が出る（4pxの角がそのまま見える）
//   今日なに作る？の候補 … 上辺2px・左辺1px・斜め0.67px（同上）
//   今日の献立のカード   … 上辺10px・左辺10px・斜め10px まで**何も出ない**
//     （斜め10pxで最初に出るのはカードの中の絵の色で、線の色ではない
//      ＝1pxの線が角のまわり約11pxぶん切り落とされ、角そのものが無くなっていた）
//
// 原因は 2026-08-21 便IQ で足した「左へ払うと外すボタンが出る器」（SwipeRevealRow）。
// **overflow-hidden で切り取る器の角丸が rounded-md（14px）のまま**で、翌日の便JEが
// 並ぶカードを --radius-card（4px）にしたときに、この器だけ一緒に直っていなかった。
// 切り取る側のほうが丸いと、中のカードの角（線）は弧の外に出て消える。
//
// ここで見張るのは「切り取る器の角丸が、中のカードと同じトークンであること」。
// 画面の見え方そのものは e2e の JPCARD-01 が実測で受け持つ。
{
  const jpRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const jpSwipe = readFileSync(path.join(jpRoot, 'src/components/SwipeRevealRow.tsx'), 'utf-8')
  /** className の中の rounded-◯◯ を全部拾う（切り取る器かどうかは overflow-hidden で見る） */
  const jpClipRounded = []
  for (const m of jpSwipe.matchAll(/className="([^"]*)"/g)) {
    const cls = m[1]
    if (!/\boverflow-hidden\b|\boverflow-clip\b/.test(cls)) continue
    jpClipRounded.push(...(cls.match(/\brounded-[a-z0-9[\]-]+/g) ?? ['(角丸なし)']))
  }
  eq(
    'JP-1 払いの器の「切り取る枠」を読めている（0件ならこの見張りが壊れている）',
    jpClipRounded.length > 0,
    true,
  )
  eq(
    'JP-1 切り取る器の角丸は、並ぶカードと同じトークン（rounded-card）だけ',
    jpClipRounded.filter((c) => c !== 'rounded-card'),
    [],
  )
}


// ---------- LJ-1: 「未保存の変更」の判定に、写真と見える範囲が入っている ----------
//
// 2026-08-26 便LJ・②（便LGの申し送りを実測で確かめた不具合）。
//
// 直す前の実測（レシピの編集を開いて1つだけ変え、上の「戻る」を押したときに引き止めが出るか）:
//   写真を差し替える            … 出ない（下書きも書かれない）
//   写真を消す                  … 出ない
//   見える範囲を変える          … 出ない
//   写真ではなくアイコンを出す設定 … 出る
//   アイコンを選ぶ              … 出る
//   料理名を変える（対照）      … 出る
// ＝**写真を選んだだけで画面を離れると、引き止めも下書きも無いまま消えていた。**
//
// 原因は、変更の有無を「下書きに保存する形（FormDraft）をJSON化した文字列」の比較だけで
// 決めていたこと。写真(Blob)は大きすぎて下書きに入れられないので、この文字列に写真が入らない。
//
// 直し方は「写真を比較の文字列に入れる」ではなく、**写真だけ別に、入れ物（Blob）が
// 同じものかどうかで見る**（photoBaselineRef）。理由:
//   ・データURLにして文字列へ混ぜると、1文字打つたびに数十万文字を作り直すことになる
//   ・入れ物が同じかどうかは1回の比較で済み、写真の中身は1バイトも読まない
//   ・同じ写真をもう一度選び直したときは「変更あり」に倒れるが、出るのは引き止めだけで
//     データは失われない（安全側に倒れる）
//
// ここで見張るのは「判定に写真と見える範囲が入っていること」。画面の実際の動きは
// e2e の LJPHOTO-01 が受け持つ。
{
  const ljRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const ljForm = readFileSync(path.join(ljRoot, 'src/pages/RecipeFormPage.tsx'), 'utf-8')
  // 「未保存の変更」を組み立てている行（dirtyRef.current = …）を丸ごと取り出す
  const ljDirty = ljForm.match(/dirtyRef\.current =\s*\n?[^\n]*(\n\s+[^\n]*)*?(?=\n\s*(?:useEffect|\/\*\*|\/\/|const|}))/)
  eq('LJ-1 「未保存の変更」を決めている行を読めている（0件ならこの見張りが壊れている）', ljDirty != null, true)
  const ljDirtyText = ljDirty?.[0] ?? ''
  eq(
    'LJ-1 「未保存の変更」の判定に写真が入っている',
    /photoDirty|photoBaselineRef/.test(ljDirtyText),
    true,
    ljDirtyText.slice(0, 200),
  )
  // 写真そのものと見える範囲の両方を、基準と見比べていること
  eq(
    'LJ-1 写真の基準（写真そのものと見える範囲）を控えている',
    /photoBaselineRef[\s\S]{0,400}?photo[\s\S]{0,200}?focus/.test(ljForm),
    true,
  )
  // 写真をデータURL・base64にして比較の文字列へ混ぜ戻していない（1文字ごとの作り直しが重くなる）
  eq(
    'LJ-1 写真を比較の文字列（currentSerialized）へ混ぜていない',
    /const currentSerialized = useMemo\([\s\S]*?\n {2}\)/.test(ljForm) &&
      !/const currentSerialized = useMemo\(([\s\S]*?)\n {2}\)/.exec(ljForm)?.[1].includes('photo'),
    true,
  )
}

// ---------- 便LK: 「中身が無くても通ってしまう検査」を増やさない見張り（LK-1〜LK-4） ----------
//
// なぜ要るか（2026-08-25〜26 の実測）: 素通りで合格していた検査が2件見つかった
// （KU-3＝読む先を間違えてファイル全体を見ていた ／ MEALPLAN-A5＝6秒で消えるトーストを
// 消えたあとに読んでいた）。どちらも**偶然**見つかったもので、同じ形が他に何件あるかは
// 誰も知らなかった。2026-08-27 便LK が 1万件を機械で走査し、標本を1件ずつ壊して実測した
// ところ、次の2つが「壊しても緑のまま」と確定した:
//
//   ①e2e の「その要素が出ていない」（count() === 0）は、**目印(data-testid)を書き間違えても
//     必ず緑**になる。実測: LG-03a・EG-01・JHSAFE-01・KFSALT-01・ES-01・EL-06・JNPAST-04 の
//     7節で目印を存在しない名前に変えたところ、**7節すべてが緑のまま**だった。
//   ②`.every(...)` は受け手が空だと中身を1回も見ずに true になる。実測: npm test 側の38件を
//     空配列に差し替えたところ**33件が緑のまま**で、うち7件は受け手が本当に空になりうる形だった
//     （その7件は同じ便で直し、直したあと再度空にして全部が赤になることを確かめてある）。
//
// 便LK が 1万件（npm test 6,951件＋フルe2e 4,312件）を走査して数えた表。**次の便はここから続けられる。**
// 走査は check / eq / neq の呼び出し 9,668か所を acorn で構文解析して、判定式の形で分類した。
//
//   型                                   件数   標本を壊して実測した結果
//   ①探す語が空になりうる includes         4件   4件とも手前に「空でないこと」の検査があり素通りしない
//   ②探される側が空になりうる（否定）     85件   Playwright の locator は要素が無いと **例外**を投げるので
//                                               `?? ''` は実際には空にならない（MEALPLAN-07 で実測。中断＝赤）
//   ③indexOf の -1 を区別していない       18件   17件は `at > 0 &&` 等で守られている。残り1件（KU-3）は
//                                               前提の行が受け止めていたが、便LK で -1 を渡さない形に直した
//   ④「その要素が出ていない」count()===0 146件   うち26件は**そのセレクタを「在ること」の側で1度も使っていない**。
//                                               7節で目印を偽の名前に変えたところ**7節すべて緑のまま**＝素通り確定
//                                               【2026-08-27 便LO が数え直した】この26種は**数え過ぎ**だった。
//                                               `const x = page.locator('[data-testid="…"]')` の変数と、
//                                               `[data-testid^="safety-step-"]` の前方一致を解くと、
//                                               e2e 全体で「在ること」を1度も見ていない目印は4種しかない。
//                                               本当に残っているのは「**同じ節の中で**出る場面を1度も
//                                               測っていない」形＝19箇所/15種で、これは LO-1 が数えている。
//                                               また、便LKの壊し方（e2e 側のセレクタを偽名にする）は
//                                               **src の改名を再現していない**。src を改名すると、同じ目印を
//                                               positive に見ている別の節が落ちる（LK-1 とは別に受け止められる）
//   ⑤空の並びでも通る every              264件   受け手が固定の並びのものを除くと137件。npm test 側38件を
//                                               空配列にしたところ33件が緑のまま。うち受け手が本当に空になり
//                                               うる7件と、e2e 側10件を便LKで直した
//   ⑥await 漏れ（Promiseは常に真）         0件   —
//   ⑦?. の undefined どうしの比較          3件   1件（TODAYSYNC-01）で実測、素通り。ただし同じ節の別の検査が
//                                               同じ名前を positive に見ているので改名は受け止められる
//   ⑧try{…}catch{} で失敗を握り潰す        0件   —
//   ⑨定数条件（check(…, true)）            1件   MEALPLAN-07 の「今日が月初/月末なら省略」＝意図した分岐
//   ⑩要素が消えたあとに文字を読む          0件   MEALPLAN-A5 は 2026-08-26 に直り済み
//
// ここで見張るのは「**残りが増えていないこと**」。一覧は scripts/data/e2e-vacuous-known.json。
// 他の見張り（e2e-ja-copy-known.json / ja-meyasu-known.json）と同じ作法で、
// **増えたら赤・直したら一覧から消す（減っても赤にして一覧の更新を促す）**。
//
// **LK-4 はこの見張り自身が素通りしないことを毎回その場で確かめる**（便KVと同じ形）。
// 走査が壊れて0件になったら「違反なし＝緑」に倒れてしまうので、架空の1件を必ず見つける
// ことを実行のたびに測る。
{
  const lkRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lkRequire = createRequire(scriptFileUrl)
  let lkAcorn = null
  try {
    lkAcorn = lkRequire('acorn')
  } catch {
    lkAcorn = null
  }
  eq('LK 前提: 構文解析の道具(acorn)を読める（読めないと見張りが素通りする）', lkAcorn !== null, true)

  const lkKnown = JSON.parse(
    readFileSync(path.join(lkRoot, 'scripts/data/e2e-vacuous-known.json'), 'utf-8'),
  )

  /** 木を隅々まで歩く（acorn-walk は入っていないので自前。JM-4 と同じ形） */
  const lkWalk = (node, fn) => {
    if (!node || typeof node.type !== 'string') return
    fn(node)
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue
      const v = node[k]
      if (Array.isArray(v)) {
        for (const c of v) if (c && typeof c.type === 'string') lkWalk(c, fn)
      } else if (v && typeof v.type === 'string') lkWalk(v, fn)
    }
  }
  const lkParse = (code) =>
    lkAcorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  /**
   * ①「その要素が出ていない」検査が見ている data-testid を集める。
   * `check(ラベル, (await …locator('[data-testid="X"]').count()) === 0)` の X を拾う。
   */
  const lkCollectAbsenceTestIds = (code, where) => {
    const found = []
    lkWalk(lkParse(code), (n) => {
      if (n.type !== 'CallExpression') return
      if (n.callee.type !== 'Identifier' || n.callee.name !== 'check') return
      const cond = n.arguments[1]
      if (!cond) return
      lkWalk(cond, (m) => {
        if (m.type !== 'BinaryExpression' || (m.operator !== '===' && m.operator !== '==')) return
        const zeroSide =
          m.right.type === 'Literal' && m.right.value === 0
            ? m.left
            : m.left.type === 'Literal' && m.left.value === 0
              ? m.right
              : null
        if (!zeroSide) return
        const text = code.slice(zeroSide.start, zeroSide.end)
        if (!/\.count\(\)/.test(text)) return
        for (const hit of text.matchAll(/data-testid[\^$*~|]?="([^"]+)"|getByTestId\(\s*'([^']+)'/g)) {
          found.push({ id: hit[1] ?? hit[2], at: `${where}:${n.loc.start.line}行目` })
        }
      })
    })
    return found
  }

  /**
   * ②「空の並びでも通る every」を数える。
   * 受け手が固定の並び（`[…]` / `Array.from`）でなく、同じ判定式で長さも見ていないものだけ。
   */
  const lkCountBareEvery = (code, fnNames = ['eq', 'neq']) => {
    let count = 0
    lkWalk(lkParse(code), (n) => {
      if (n.type !== 'CallExpression') return
      if (n.callee.type !== 'Identifier' || !fnNames.includes(n.callee.name)) return
      for (const cond of [n.arguments[1], n.arguments[2]].filter(Boolean)) {
        const condText = code.slice(cond.start, cond.end)
        lkWalk(cond, (m) => {
          if (m.type !== 'CallExpression') return
          const prop =
            m.callee.type === 'MemberExpression' && m.callee.property.type === 'Identifier'
              ? m.callee.property.name
              : null
          if (prop !== 'every') return
          const recv = code.slice(m.callee.object.start, m.callee.object.end).trim()
          const fixedLength = recv.startsWith('[') || /Array\.from/.test(recv)
          if (!fixedLength && !/\.length/.test(condText)) count++
        })
      }
    })
    return count
  }

  if (lkAcorn) {
    // ---- LK-4: 見張り自身が素通りしないことを、その場で確かめる（0件で緑に倒れないか） ----
    // 架空の検査を1件ずつ食わせて、走査が**必ず拾うこと**を測る。
    // ここが緑のまま拾えなくなったら、上の2つの数え上げは「違反なし」に化ける。
    const lkFakeAbsence = `
      check('架空', (await p.locator('[data-testid="lk-fake-testid"]').count()) === 0)
      check('架空2', (await p.getByTestId('lk-fake-two').count()) === 0)
    `
    eq(
      'LK-4 見張り自身の確かめ: 架空の「出ていないこと」検査から目印を拾える',
      lkCollectAbsenceTestIds(lkFakeAbsence, '架空').map((x) => x.id),
      ['lk-fake-testid', 'lk-fake-two'],
    )
    eq(
      'LK-4 見張り自身の確かめ: 架空の「空でも通る every」を1件と数える',
      lkCountBareEvery(`eq('架空', rows.every((r) => r.ok), true)`),
      1,
    )
    // 逆に、**直した形は数えない**（直しても件数が減らないなら見張りが役に立たない）
    eq(
      'LK-4 見張り自身の確かめ: 長さを見ている every は数えない',
      lkCountBareEvery(`eq('架空', rows.length > 0 && rows.every((r) => r.ok), true)`),
      0,
    )
    eq(
      'LK-4 見張り自身の確かめ: 受け手が固定の並びの every も数えない',
      lkCountBareEvery(`eq('架空', [1, 2].every((r) => r > 0), true)`),
      0,
    )

    // ---- LK-1: 「出ていないこと」の検査が見ている目印が、画面のソースに実在すること ----
    //
    // 目印が src のどこにも無いと、その検査は**何が起きても必ず緑**になる（改名の取り残し・
    // 書き間違いが「合格」の顔をして残る）。意図して機能を消したものだけを一覧に残す。
    const lkSrcText = (() => {
      const chunks = []
      const rd = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const p = path.join(dir, entry.name)
          if (entry.isDirectory()) rd(p)
          else if (/\.(tsx?|css)$/.test(entry.name)) chunks.push(readFileSync(p, 'utf-8'))
        }
      }
      rd(path.join(lkRoot, 'src'))
      return chunks.join('\n')
    })()
    eq('LK-1 前提: 画面のソースを読めている（0文字なら見張りが壊れている）', lkSrcText.length > 100000, true)

    /**
     * 目印が src に**そのものとして**在るか。
     *
     * **2026-08-28 便LX の実測でここを直した。**それまでは `lkSrcText.includes(id)` の
     * 部分一致で見ており、**目印の後ろに文字を足す形の改名を1件も拾えなかった**
     * （`data-testid="purpose-picker"` → `"purpose-pickerZZ"` にすると、
     * `includes('purpose-picker')` は**当たったまま**なので「src に在る」と判定される）。
     * 実測: `day-modal-close` `purpose-picker` `month-trial-start` `navi-selection-dropped`
     * `search-match-word` の5つを src で改名して `npm test` を走らせたところ、
     * **LK-1 は5件とも取り逃した**（赤くなったのは別の見張り KJ-3 の1件だけ）。
     *
     * 直した形は「**引用符で囲まれた1つの語として在るか**」で見る。
     * `data-testid="x"` / `testId="x"` / `testId={'x'}` / `testId: 'x'` のどれでも当たり、
     * `"xZZ"` には当たらない。`data-testid={`safety-step-${i}`}` のように組み立てるものは
     * 前方一致の頭（`safety-step-`）を別に集めて受け止める。
     */
    const lkMarkPrefixes = (text) =>
      [...text.matchAll(/[`"']([A-Za-z][\w-]*-)\$\{/g)].map((m) => m[1])
    const lkHasMarkIn = (text, id, prefixes) =>
      new RegExp(`(["'\`])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\1`).test(text) ||
      prefixes.some((prefix) => id.startsWith(prefix))
    const lkSrcTemplatePrefixes = lkMarkPrefixes(lkSrcText)
    const lkSrcHasMark = (id) => lkHasMarkIn(lkSrcText, id, lkSrcTemplatePrefixes)

    // この当て方そのものが素通りしないことを、その場で確かめる（LK-4 と同じ形）。
    // 実物の目印ではなく**架空のソース**で測る（実物を使うと、その目印を直した日に
    // 見張り自身が赤くなって、何が壊れたのか分からなくなる）
    {
      const lkFakeSrc = '<div data-testid="lx-fake-mark" />\n<Row testId={`lx-row-${i}`} />'
      const lkFakePrefixes = lkMarkPrefixes(lkFakeSrc)
      eq(
        'LK-1 見張り自身の確かめ: 引用符で囲まれた目印は「在る」と読める',
        lkHasMarkIn(lkFakeSrc, 'lx-fake-mark', lkFakePrefixes),
        true,
      )
      eq(
        'LK-1 見張り自身の確かめ: 後ろに文字を足した名前は「在る」と読まない（部分一致で見逃さない）',
        lkHasMarkIn(lkFakeSrc, 'lx-fake-mar', lkFakePrefixes),
        false,
      )
      eq(
        'LK-1 見張り自身の確かめ: 組み立てる目印は前方一致で受け止める',
        lkHasMarkIn(lkFakeSrc, 'lx-row-3', lkFakePrefixes),
        true,
      )
    }

    const lkE2eDir = path.join(lkRoot, 'scripts/e2e')
    const lkAbsence = []
    for (const file of readdirSync(lkE2eDir).filter((f) => f.endsWith('.mjs'))) {
      lkAbsence.push(
        ...lkCollectAbsenceTestIds(readFileSync(path.join(lkE2eDir, file), 'utf-8'), file),
      )
    }
    // 走査そのものが動いていること（e2e の作りが変わって0件になったら気づけるように）
    eq(
      'LK-1 前提: e2e の「出ていないこと」検査を拾えている（0件なら見張りが壊れている）',
      lkAbsence.length > 40,
      true,
    )

    const lkKnownAbsent = lkKnown['画面に無い目印を見ている「出ていないこと」の検査'] ?? {}
    const lkMissing = new Map()
    for (const { id, at } of lkAbsence) {
      if (lkSrcHasMark(id)) continue
      if (!lkMissing.has(id)) lkMissing.set(id, [])
      lkMissing.get(id).push(at)
    }
    const lkGrew = [...lkMissing]
      .filter(([id]) => !(id in lkKnownAbsent))
      .map(
        ([id, at]) =>
          `目印「${id}」は src のどこにも無いので、この検査は何があっても緑になる（${at.join(' / ')}）。` +
          '改名の取り残しなら検査のほうを直し、意図して機能を消したのなら scripts/data/e2e-vacuous-known.json に理由を書いて足すこと',
      )
    const lkShrank = Object.keys(lkKnownAbsent)
      .filter((id) => id !== 'これは何' && !lkMissing.has(id))
      .map(
        (id) =>
          `目印「${id}」はもう「画面に無い」ではなくなった（機能が戻ったか検査を直したか）。scripts/data/e2e-vacuous-known.json から消してください`,
      )
    eq('LK-1 画面に無い目印を見ている「出ていないこと」の検査が増えていない', lkGrew, [])
    eq('LK-1 その一覧に、もう当てはまらないものが残っていない', lkShrank, [])

    // ---- LK-2: 「空の並びでも通る every」が増えていないこと（npm test 側と e2e 側の両方） ----
    const lkEveryCounts = [
      ['npm test 側', 'scripts/tests', ['eq', 'neq'], 'npm test 側の件数'],
      ['e2e 側', 'scripts/e2e', ['check'], 'e2e 側の件数'],
    ]
    for (const [where, dir, fns, knownKey] of lkEveryCounts) {
      let now = 0
      for (const file of readdirSync(path.join(lkRoot, dir)).filter((f) => f.endsWith('.mjs'))) {
        now += lkCountBareEvery(readFileSync(path.join(lkRoot, dir, file), 'utf-8'), fns)
      }
      const known = lkKnown['空の並びでも通る every の残り'][knownKey]
      // 走査そのものが動いていること（0件になったら「違反なし」に化ける）
      eq(`LK-2 前提: ${where}の every を数えられている`, now > 20, true)
      eq(
        `LK-2 ${where}の「空の並びでも通る every」が増えていない（一覧は${known}件）`,
        now <= known
          ? []
          : [
              `${known}→${now}件に増えた。新しい検査は「長さも同じ条件で見る」形` +
                '（例: rows.length > 0 && rows.every(…)）にすること',
            ],
        [],
      )
      eq(
        `LK-2 ${where}で直したぶんは一覧の件数も下げる（下げないと次の1件が隠れる）`,
        now >= known
          ? []
          : [`${known}→${now}件に減った。scripts/data/e2e-vacuous-known.json の「${knownKey}」を ${now} に直してください`],
        [],
      )
    }

    // ---- LK-3: 素通りの見つけ方そのものを書き残しておく（次の便が同じ走査をやり直せるように） ----
    // 走査の型と、実測でどれが当たりだったかは CLAUDE.md ではなくこの見張りの頭のコメントにある。
    // ここでは「一覧のファイルが在ること」だけを見る（消えたら上の突き合わせが全部素通りするため）。
    eq(
      'LK-3 素通りの残りの一覧（scripts/data/e2e-vacuous-known.json）が在る',
      existsSync(path.join(lkRoot, 'scripts/data/e2e-vacuous-known.json')),
      true,
    )
  }
}

// ---------- LN-2（2026-08-27 便LN）: 「レシピから追加」の選択画面は、レシピタブと同じ道具で探す ----------
//
// オーナー原文「レシピから追加のレシピ選択画面は、検索と絞り込み、並び替えの使い勝手を
// レシピタブと同じにしたい。レシピの表示の仕方は今のまま、食数増減できる状態で。」
//
// 直す前のこの画面は、レシピタブと**別の探し方**を持っていた:
//   ・検索が `r.title.includes(q)` の素の部分一致（かなの正規化も別名も材料も見ない）
//   ・絞り込みが1つも無い
//   ・並び替えが4種だけの自前のプルダウン（レシピタブは基本8種＋栄養＋昇降）
// 画面ごとに探し方を持つと、同じ言葉を打っても画面によって出る品が違う。
// ここで見張るのは「同じ道具を使っていること」と「オーナーが名指しで“今のまま”と言った2つ」。
{
  const lnRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lnShopping = readFileSync(path.join(lnRoot, 'src/pages/ShoppingPage.tsx'), 'utf-8')

  // ① 検索は logic/search.ts の searchRecipes を使う（画面ごとに別の検索を持たない）
  eq(
    'LN-2 ①選択画面は searchRecipes で探している',
    /searchRecipes\(/.test(lnShopping) && /from '\.\.\/logic\/search'/.test(lnShopping),
    true,
  )
  // ② 画面独自の素の部分一致が残っていない（戻したら赤くなる）
  eq(
    'LN-2 ②画面独自の「料理名だけの部分一致」が残っていない',
    /\.title\.includes\(/.test(lnShopping),
    false,
  )
  // ③ 並び替え・絞り込みはレシピ一覧と同じ部品（顔ぶれもProの線も1か所で決まる）
  eq(
    'LN-2 ③レシピ一覧と同じ並び替え／絞り込みのパネルを出している',
    ['<RecipeSortPanel', '<RecipeFilterPanel'].filter((tag) => !lnShopping.includes(tag)),
    [],
  )
  // ④ 栄養の並び替えの解錠は共通の判定から渡す（Proの線を画面ごとに書き写さない）
  eq(
    'LN-2 ④栄養の並び替えの解錠は isNutritionUnlocked から渡している',
    /isNutritionUnlocked\(!!settings\?\.proCode\)/.test(lnShopping),
    true,
  )
  // ⑤⑥ オーナーが名指しで「今のまま」と言った2つ＝レシピの見せ方（標準のカード）と食数の±
  eq(
    'LN-2 ⑤レシピの見せ方は今のまま（標準のカード・place="recipePicker"）',
    /density="standard"/.test(lnShopping) && /place="recipePicker"/.test(lnShopping),
    true,
  )
  eq(
    'LN-2 ⑥食数の±も今のまま',
    ['pickerServingUp', 'pickerServingDown', 'pickerServingUnit'].filter(
      (key) => !lnShopping.includes(key),
    ),
    [],
  )
  // ⑦ 選択画面は、レシピ一覧が背負っている「条件の保存・URLへの反映・復元」を持ち込まない
  //    （便LMの申し送り）。条件は1本の useState で持ち、窓を開くたびに何も絞っていない状態へ戻す。
  //    ここが崩れると、前に選んだ条件が残ったまま窓が開き、「レシピが出てこない」の原因が
  //    窓の外から読めなくなる（レシピ一覧は一覧の上に条件が全部見えているので同じ形にはならない）
  eq(
    'LN-2 ⑦条件は RecipeFilterValues 1本で持つ',
    /useState<RecipeFilterValues>\(EMPTY_RECIPE_FILTER_VALUES\)/.test(lnShopping),
    true,
  )
  eq(
    'LN-2 ⑦窓を開くたびに条件を初期値へ戻している',
    (lnShopping.match(/resetPickerConditions\(\)/g) ?? []).length >= 3,
    true,
  )

  // ⑧ 絞り込みの条件を**1つ残らず**検索へ渡している。
  //    パネルに並ぶチップは RecipeFilterValues の項目そのものなので、渡し忘れた項目は
  //    「押せるのに何も起きないチップ」になる（押しても品数が変わらないので、
  //    利用者からは壊れているのか条件に合う品が無いのか区別がつかない）。
  //    項目が増えたときも、渡し先を足すまでここが赤くなる
  {
    const lnPanel = readFileSync(path.join(lnRoot, 'src/components/RecipeFilterPanel.tsx'), 'utf-8')
    const lnValuesBlock = lnPanel.match(/export type RecipeFilterValues = \{([\s\S]*?)\n\}/)?.[1] ?? ''
    const lnFields = [...lnValuesBlock.matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
    eq('LN-2 ⑧前提: 絞り込みの条件を読み取れている（11項目）', lnFields.length, 11)
    const lnCall = lnShopping.match(/searchRecipes\(visibleRecipes, \{([\s\S]*?)\n\s*\}\)/)?.[1] ?? ''
    eq(
      'LN-2 ⑧絞り込みの条件を1つ残らず検索へ渡している',
      lnFields.filter((f) => !new RegExp(`\\b${f}:\\s*pickerFilters\\.${f}`).test(lnCall)),
      [],
    )
    // 「使いたい食材」だけは配列を空白区切りの1文字にして渡す（searchRecipes の受け口の形）
    eq(
      'LN-2 ⑧「使いたい食材」は空白区切りにして渡している（searchRecipesの受け口の形）',
      /ingredients:\s*pickerFilters\.ingredients\.join\(' '\)/.test(lnCall),
      true,
    )
  }
}

// ---------- 便LO（2026-08-27）: 「出ていないこと」の検査が、同じ節で「出ること」を1度も見ていない残り ----------
//
// なぜ要るか: 便LK が ④「count() === 0 の検査は目印を書き間違えても必ず緑」を実測で確かめ、
// LK-1（目印が src に在るか）を置いた。ただし LK-1 が拾えるのは**目印が src から丸ごと消えた**ときだけで、
// 「その節が、その目印の出る場面を1度も測っていない」ことは拾えない。
// 出ない場面しか測っていない検査は、**画面に着けていなくても・要素が丸ごと消えても緑**になる
// （2026-08-27 便LO の実測: PURPOSE-02 は「解錠済みなら鍵付き行は出さない」を**条件の窓を開く前**に
//  測っていて、そこは未解錠でも0件だった＝Proの線が壊れても必ず緑だった）。
//
// ここで見るのは「**出る場面と対にしていない検査が増えていないこと**」。
// 便LK の走査との違いは2つで、どちらも数え過ぎを取り除くためのもの:
//   ①`const x = page.locator('[data-testid="…"]')` の**変数を解く**（便LKの26種はここを解かず数えていた）
//   ②`[data-testid^="safety-step-"]` のような**前方一致**を、`safety-step-0` の positive と突き合わせる
// 数えるのは「同じ節（ファイルのいちばん外側の { } の塊）の中で、その目印が
// **check の判定式にも、click / textContent などの『在ることが前提の操作』にも1度も出てこない**」もの。
//
// 直したら scripts/data/e2e-vacuous-known.json の「件数」を下げる（下げないと次の1件が隠れる）。
// LO-2 は、この見張り自身が0件に倒れて「違反なし＝緑」に化けないことを毎回その場で測る（LK-4 と同じ形）。
{
  const loRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const loRequire = createRequire(scriptFileUrl)
  let loAcorn = null
  try {
    loAcorn = loRequire('acorn')
  } catch {
    loAcorn = null
  }
  eq('LO 前提: 構文解析の道具(acorn)を読める（読めないと見張りが素通りする）', loAcorn !== null, true)

  const loWalk = (node, fn) => {
    if (!node || typeof node.type !== 'string') return
    fn(node)
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue
      const value = node[key]
      if (Array.isArray(value)) {
        for (const child of value) if (child && typeof child.type === 'string') loWalk(child, fn)
      } else if (value && typeof value.type === 'string') loWalk(value, fn)
    }
  }
  const loParse = (code) =>
    loAcorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true })

  /** 目印の取り出し。前方一致(^=)・部分一致(*=)・テンプレートリテラルはそのことも持ち帰る */
  const loMarksOf = (text) => {
    const marks = []
    for (const hit of text.matchAll(/data-testid([\^$*~|]?)="([^"]+)"/g))
      marks.push({ op: hit[1], id: hit[2] })
    for (const hit of text.matchAll(/getByTestId\(\s*'([^']+)'/g)) marks.push({ op: '', id: hit[1] })
    for (const hit of text.matchAll(/data-testid="([^"$]*)\$\{/g)) marks.push({ op: '^', id: hit[1] })
    return marks
  }
  /** 集めた目印の中に、この目印を受け止めるものが在るか（前方一致はどちら向きでも当てる） */
  const loCovered = (mark, ids) =>
    [...ids].some((id) =>
      mark.op === '^'
        ? id.startsWith(mark.id)
        : mark.op === '*' || mark.op === '~'
          ? id.includes(mark.id)
          : mark.op === '$'
            ? id.endsWith(mark.id)
            : id === mark.id,
    )
  /** 「在ることが前提の操作」＝掴めないと例外か30秒待ちになるもの */
  const LO_LOUD = [
    'click', 'textContent', 'innerText', 'isVisible', 'fill', 'press', 'waitFor', 'boundingBox',
    'hover', 'inputValue', 'tap', 'selectOption', 'getAttribute', 'isChecked', 'isEnabled',
    'allTextContents', 'allInnerTexts', 'scrollIntoViewIfNeeded', 'first', 'nth', 'last',
  ]

  /**
   * 1つのファイルから「同じ節で出る場面と対になっていない『出ていないこと』の検査」を拾う。
   * 節はいちばん外側の { } の塊（scripts/e2e-part.mjs の切り出しと同じ区切り）。
   */
  const loFindLonelyAbsence = (code) => {
    const ast = loParse(code)
    const varToMarks = new Map()
    loWalk(ast, (n) => {
      if (n.type !== 'VariableDeclarator' || n.id.type !== 'Identifier' || !n.init) return
      const marks = loMarksOf(code.slice(n.init.start, n.init.end))
      if (marks.length > 0) varToMarks.set(n.id.name, marks)
    })
    const blocks = ast.body
      .filter((n) => n.type === 'BlockStatement')
      .map((n) => ({ start: n.start, end: n.end }))
    const keyOf = (blk) => (blk ? blk.start : -1)
    const seen = new Map() // 節 → その節で「在ること」に使われた目印
    const add = (blk, id) => {
      const key = keyOf(blk)
      if (!seen.has(key)) seen.set(key, new Set())
      seen.get(key).add(id)
    }
    const absence = []
    loWalk(ast, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'Identifier' || n.callee.name !== 'check')
        return
      const cond = n.arguments[1]
      if (!cond) return
      const blk = blocks.find((b) => cond.start >= b.start && cond.end <= b.end)
      const zeroParts = []
      loWalk(cond, (m) => {
        if (m.type !== 'BinaryExpression' || (m.operator !== '===' && m.operator !== '==')) return
        const zeroSide =
          m.right.type === 'Literal' && m.right.value === 0
            ? m.left
            : m.left.type === 'Literal' && m.left.value === 0
              ? m.right
              : null
        if (!zeroSide) return
        const text = code.slice(zeroSide.start, zeroSide.end)
        if (!/\.count\(\)/.test(text)) return
        zeroParts.push([zeroSide.start, zeroSide.end, text])
      })
      // 判定式のうち「出ていないこと」以外に出てくる目印は、その節の positive に数える
      let rest = code.slice(cond.start, cond.end)
      for (const [s, e] of [...zeroParts].sort((a, b) => b[0] - a[0]))
        rest = rest.slice(0, s - cond.start) + ' '.repeat(e - s) + rest.slice(e - cond.start)
      for (const mark of loMarksOf(rest)) add(blk, mark.id)
      loWalk(cond, (m) => {
        if (m.type !== 'Identifier' || !varToMarks.has(m.name)) return
        if (zeroParts.some(([s, e]) => m.start >= s && m.end <= e)) return
        for (const mark of varToMarks.get(m.name)) add(blk, mark.id)
      })
      for (const [s, e, text] of zeroParts) {
        const marks = loMarksOf(text)
        loWalk(cond, (m) => {
          if (m.type === 'Identifier' && varToMarks.has(m.name) && m.start >= s && m.end <= e)
            marks.push(...varToMarks.get(m.name))
        })
        for (const mark of marks)
          absence.push({ mark, blk, line: n.loc.start.line, label: n.arguments[0]?.value ?? '' })
      }
    })
    loWalk(ast, (n) => {
      if (n.type !== 'CallExpression' || n.callee.type !== 'MemberExpression') return
      if (n.callee.property.type !== 'Identifier' || !LO_LOUD.includes(n.callee.property.name)) return
      const blk = blocks.find((b) => n.start >= b.start && n.end <= b.end)
      const objText = code.slice(n.callee.object.start, n.callee.object.end)
      for (const mark of loMarksOf(objText)) add(blk, mark.id)
      loWalk(n.callee.object, (m) => {
        if (m.type === 'Identifier' && varToMarks.has(m.name))
          for (const mark of varToMarks.get(m.name)) add(blk, mark.id)
      })
    })
    return absence.filter((a) => !loCovered(a.mark, seen.get(keyOf(a.blk)) ?? new Set()))
  }

  if (loAcorn) {
    // ---- LO-2: 見張り自身が0件に倒れないことを、その場で確かめる ----
    const loFakeLonely = `
      {
        check('架空', (await p.locator('[data-testid="lo-fake-mark"]').count()) === 0)
      }
    `
    const loFakePaired = `
      {
        check('架空: 出る場面', (await p.locator('[data-testid="lo-fake-mark"]').count()) === 1)
        check('架空: 出ない場面', (await p.locator('[data-testid="lo-fake-mark"]').count()) === 0)
      }
    `
    const loFakeByVar = `
      {
        const mark = p.locator('[data-testid="lo-fake-mark"]')
        check('架空: 掴んで読む', (await mark.textContent()).includes('あ'))
        check('架空: 出ない場面', (await mark.count()) === 0)
      }
    `
    eq(
      'LO-2 見張り自身の確かめ: 対になっていない「出ていないこと」を1件と数える',
      loFindLonelyAbsence(loFakeLonely).map((a) => a.mark.id),
      ['lo-fake-mark'],
    )
    eq(
      'LO-2 見張り自身の確かめ: 同じ節に「出る場面」があるものは数えない',
      loFindLonelyAbsence(loFakePaired).length,
      0,
    )
    eq(
      'LO-2 見張り自身の確かめ: 変数に入れて掴んでいるものも「在ること」として数える',
      loFindLonelyAbsence(loFakeByVar).length,
      0,
    )

    // ---- LO-1: 対になっていない「出ていないこと」の検査が増えていないこと ----
    const loKnown = JSON.parse(
      readFileSync(path.join(loRoot, 'scripts/data/e2e-vacuous-known.json'), 'utf-8'),
    )['同じ節で「在ること」を一度も確かめていない「出ていないこと」の検査']
    const loE2eDir = path.join(loRoot, 'scripts/e2e')
    const loSrcText = (() => {
      const chunks = []
      const read = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) read(full)
          else if (/\.(tsx?|css)$/.test(entry.name)) chunks.push(readFileSync(full, 'utf-8'))
        }
      }
      read(path.join(loRoot, 'src'))
      return chunks.join('\n')
    })()
    const loHits = []
    for (const file of readdirSync(loE2eDir).filter((f) => f.endsWith('.mjs'))) {
      for (const hit of loFindLonelyAbsence(readFileSync(path.join(loE2eDir, file), 'utf-8'))) {
        // src から消えた目印は LK-1 の担当なので、ここでは二重に数えない
        if (!loSrcText.includes(hit.mark.id)) continue
        loHits.push(`${file}:${hit.line}行目 目印「${hit.mark.op}${hit.mark.id}」（${hit.label}）`)
      }
    }
    const loNow = loHits.length
    const loFloor = loKnown['件数']
    eq(
      `LO-1 「出る場面と対にしていない出ていないこと」の検査が増えていない（一覧は${loFloor}件）`,
      loNow <= loFloor
        ? []
        : [
            `${loFloor}→${loNow}件に増えた。新しい「出ていないこと」の検査は、同じ節で` +
              'その目印が出る場面も1つ測ること（出る場面と出ない場面を対にする）',
            ...loHits.slice(0, 5),
          ],
      [],
    )
    eq(
      'LO-1 直したぶんは一覧の件数も下げる（下げないと次の1件が隠れる）',
      loNow >= loFloor
        ? []
        : [
            `${loFloor}→${loNow}件に減った。scripts/data/e2e-vacuous-known.json の` +
              `「同じ節で「在ること」を一度も確かめていない「出ていないこと」の検査」の「件数」を ${loNow} に直してください`,
          ],
      [],
    )
  }
}


// ==========================================================================================
// LR-2: 取り込み直後の欄に「出せない行」を置かない（2026-08-27 便LR）
//
// ## 来歴（同じ形をもう1度作らないための見張り）
// 2026-08-26 に「合わせ調味料の組」の行をこの欄へ足したが、`importGapFields` にその名前が
// 入る道が無く、**画面に1度も出ないボタン**になっていた（押せないボタンではなく出ないボタン）。
// 便LO が「e2e が『出ること』を1度も測っていない目印」を数えて見つけ、便LR が
// 貼り付け・URLの2経路 693通りで「どの経路でも出ない」ことを実測して落とした。
//
// ## ここで見ること（LR-1 と対になる）
//   LR-1（scripts/tests/import-paste.mjs）= 一覧の項目が**取り込みで実際に出せる**こと
//   LR-2（ここ）                          = 一覧の項目と**画面の行が1対1**であること
// この2つで「出せない項目を足す」「一覧に無い名前で行を書く」のどちらも赤になる。
// ==========================================================================================
{
  const lrRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lrForm = readFileSync(path.join(lrRoot, 'src/pages/RecipeFormPage.tsx'), 'utf-8')
  /** 画面が「この名前の行を出す」と書いている名前（importGapFields.includes('…') の中身） */
  const lrDrawn = [...lrForm.matchAll(/importGapFields\.includes\('([^']+)'\)/g)].map((m) => m[1])

  eq(
    'LR-2 画面が出す行は、すべて一覧（IMPORT_FIELD_KEYS）にある名前',
    lrDrawn.filter((key) => !IMPORT_FIELD_KEYS.includes(key)),
    [],
  )
  eq(
    'LR-2 一覧の項目は、すべて画面に出す行を持っている',
    IMPORT_FIELD_KEYS.filter((key) => !lrDrawn.includes(key)),
    [],
  )
  eq(
    'LR-2 出す行に重複が無い（同じ項目を2か所に描かない）',
    lrDrawn.length,
    new Set(lrDrawn).size,
  )
  eq(
    'LR-2 項目の見出しの文言も、一覧の項目とちょうど同じだけ持っている',
    Object.keys(ja.form.importGapField).sort(),
    [...IMPORT_FIELD_KEYS].sort(),
  )
  // 落とした「合わせ調味料の組」が、画面・文言・一覧のどこにも戻っていないこと。
  // 戻すなら、まず取り込みの経路で出せるようにしてから（LR-1 が測る）
  eq(
    'LR-2 到達できなかった「合わせ調味料の組」は画面にも文言にも戻っていない',
    [
      lrDrawn.includes('seasoningGroup'),
      'seasoningGroup' in ja.form.importGapField,
      IMPORT_FIELD_KEYS.includes('seasoningGroup'),
    ],
    [false, false, false],
  )
  // 印から組を作り直す入口そのものは**材料の欄に1か所だけ**残っている（本命のほう）
  eq(
    'LR-2 印から組を作る入口は材料の欄に1か所だけある',
    (lrForm.match(/data-testid="ingredient-seasoning-run"/g) ?? []).length,
    1,
  )
  eq(
    'LR-2 その入口の文言は残っている（落としたのは取り込みの結果の中の重複だけ）',
    [
      typeof ja.form.importGapSeasoningButton === 'string' && ja.form.importGapSeasoningButton.length > 0,
      ja.form.importGapSeasoningDone.includes('{n}'),
      lrForm.includes('ja.form.importGapSeasoningButton'),
    ],
    [true, true, true],
  )
}

// ==========================================================================================
// LS-1〜LS-4: オーナーの書き溜め（2026-08-27 便LS）
// 設定の「料理中」のスイッチの位置・バックアップの常設バナーの文字切れ・
// 「バックアップを取る」カードの並び・説明ページからの帰り道。
//
// 直した不具合が2つあるので、**同じ形が戻ったら赤になる**ように、
// 画面のソースの側から見る（文言ではなく作りを測る）。
//   LS-1 「料理中」の3枚は、スイッチをサブタイトルと同じ行に置く（説明文の幅を削らない）
//   LS-2 バックアップの常設バナーは truncate で1行に押し込まない（全文が読めない形に戻さない）
//   LS-3 説明ページへのリンクは帰り先を持ち、説明ページはそれを受け取って帰り道を出す
//   LS-4 折りたたみに入れた注意書きは、畳んだだけで1つも消していない
// ==========================================================================================
{
  const lsRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lsRead = (rel) => readFileSync(path.join(lsRoot, rel), 'utf-8')
  const lsSettings = lsRead('src/pages/SettingsPage.tsx')

  // ---- LS-1: スイッチはサブタイトルの真横 ----------------------------------------------
  // オーナー原文「スイッチはサブタイトルの真横にして。特にタイマー音は、説明文のスペースを
  // 狭くしているのが目立つ」。
  // 直す前は「サブタイトル＋説明文」の塊とスイッチを左右に並べていたので、説明文の折り返し幅が
  // スイッチのぶんだけ狭かった（390px幅で実測 256px・タイマー音は4行）。
  // 見るのは**並べ方**そのもの: 見出し(h2)とスイッチが同じ1行の箱に入っていること。
  {
    const LS_CARDS = [
      ['料理中に画面を暗くしない', 'setting-keep-screen-on', 'screenTitle', 'screenDescription'],
      ['タイマー中は画面を暗くしない', 'setting-timer-wake-lock', 'timerWakeLockTitle', 'timerWakeLockDescription'],
      ['タイマー音', 'setting-timer-sound', 'timerSoundTitle', 'timerSoundDescription'],
    ]
    for (const [name, testid, titleKey, descKey] of LS_CARDS) {
      const at = lsSettings.indexOf(`data-testid="${testid}"`)
      eq(`LS-1 ${name}のカードを掴めている（-1なら見張りが壊れている）`, at >= 0, true)
      // カード1枚分（次の </label> まで）を切り出して、その中の並びだけを見る
      const card = at >= 0 ? lsSettings.slice(at, lsSettings.indexOf('</label>', at)) : ''
      const titleAt = card.indexOf(`ja.settings.${titleKey}}</h2>`)
      const switchAt = card.indexOf('role="switch"')
      const descAt = card.indexOf(`ja.settings.${descKey}`)
      eq(
        `LS-1 ${name}: 見出し・スイッチ・説明文が1枚の中に全部ある`,
        [titleAt >= 0, switchAt >= 0, descAt >= 0],
        [true, true, true],
      )
      // 並び順: 見出し → スイッチ → 説明文（説明文がスイッチより前にあると、
      // 左右に並べる古い形＝説明文の幅が削られる形に戻っている）
      eq(`LS-1 ${name}: スイッチが見出しのすぐ横（説明文より前）にある`, titleAt < switchAt && switchAt < descAt, true)
      // 見出しとスイッチを包む箱が1行の並び（flex）であること
      eq(
        `LS-1 ${name}: 見出しとスイッチが同じ1行の箱に入っている`,
        /<div className="flex items-center justify-between gap-3">\s*<h2/.test(card),
        true,
      )
      // 説明文がその箱の外＝カードの幅いっぱいを使う位置にあること
      eq(
        `LS-1 ${name}: 説明文が、幅を分け合う箱の中に戻っていない`,
        card.slice(descAt).startsWith(`ja.settings.${descKey}`) &&
          card.lastIndexOf('</div>', descAt) < switchAt + 4000,
        true,
      )
    }
  }

  // ---- LS-2: 常設バナーの文字切れ（★不具合） ---------------------------------------------
  // オーナー原文「設定画面のバックアップのお知らせ：文字が切れている。タップしたら全文表示ではなく
  // 移動なので、全文読む方法がない（小さい画面だから？）」。
  // 実測: bannerBackupNotYet は18字で、390px幅では16字目から・320px幅では11字目から切れていた。
  // 押すと書き出しへ移動するだけなので、全文を読む手段が画面のどこにも無かった。
  {
    const at = lsSettings.indexOf('data-testid="backup-banner-text"')
    eq('LS-2 常設バナーの文字を掴めている（-1なら見張りが壊れている）', at >= 0, true)
    const btn = at >= 0 ? lsSettings.slice(at, lsSettings.indexOf('</button>', at)) : ''
    eq('LS-2 バナーの文字を1行に押し込んでいない（truncate を使わない）', /truncate/.test(btn), false)
    eq('LS-2 バナーの文字が省略記号で切られていない（line-clamp も使わない）', /line-clamp/.test(btn), false)
    // 折り返して2行になっても、アイコンと「書き出しへ」が縦にずれないこと
    eq(
      'LS-2 折り返した2行目にアイコンが引っぱられない（items-start で上ぞろえ）',
      /flex items-start gap-2 rounded-md border/.test(lsSettings),
      true,
    )
    // 出している文言そのものは、1行で読み切れる短さのまま（LI-1 の20字と対）
    eq(
      'LS-2 未実施のバナーの文言が短いまま',
      ja.settings.bannerBackupNotYet.replace(/​/g, '').length <= 20,
      true,
    )
  }

  // ---- LS-3: 説明ページからの帰り道（★不具合） --------------------------------------------
  // オーナー原文「『バックアップの詳しい説明を見る』から現在地へ戻る手段がない。アプリではなく
  // HPへ飛ばされるので、アプリを開きなおしたり、『アプリを開く』をHPから探さないといけない」。
  // 直し方は 2026-08-26 のレシピ詳細の帰り道と同じ「行き先に帰り先を持たせる」形。
  {
    /*
     * 2026-08-29 便MJ: **道具の名前で見ない**（禁じ手②の書き写し）。
     * 見るのは「その行き先が、帰り先を運ぶ口を通っているか」という事実だけにする。
     * 便MJが折りたたみの復元を足したことで口が aboutLinkWithReturn から
     * aboutDetourHref（中で aboutLinkWithReturn を呼ぶ）に変わり、
     * 中身は良くなったのにこの2件が落ちた。口の名前は今後も変わりうる。
     */
    const RETURN_HREF_CALL = String.raw`(?:aboutLinkWithReturn|aboutDetourHref)\(\s*`
    const carriesReturn = (path) =>
      new RegExp(RETURN_HREF_CALL + `'${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(lsSettings)
    eq('LS-3 説明ページへのリンクが、帰り先を載せて作られている', carriesReturn('/about/manual.html#backup'), true)
    eq(
      'LS-3 機種変更の「複数の端末で使う方法」も同じ帰り道を持っている',
      carriesReturn('/about/multi-device.html'),
      true,
    )
    // 帰り先を持たない裸のリンクに戻っていないこと（この2ページだけを見る）
    eq(
      'LS-3 帰り先を持たない裸のリンクに戻っていない',
      [/href="\/about\/manual\.html#backup"/, /href="\/about\/multi-device\.html"/].filter((re) =>
        re.test(lsSettings),
      ),
      [],
    )
    // 受け取り側は 2026-08-28 便LW が public/about/app-return.js へ切り出したので、
    // 中身の見張りは下の LW-1 が持つ（ここでは「読み込んでいること」だけを見る）
    for (const rel of ['public/about/manual.html', 'public/about/multi-device.html']) {
      eq(
        `LS-3 ${rel} が帰り道の部品を読み込んでいる`,
        /<script defer src="\/about\/app-return\.js"><\/script>/.test(lsRead(rel)),
        true,
      )
    }
  }

  // ---- LS-4: 畳んだだけで消していない ------------------------------------------------------
  // オーナー原文「バックアップの注意書きと詳しい説明へのリンクは折りたたみにして隠して。
  // 写真の選択と『ファイルに書き出す』ボタンが一番目立って欲しい」／
  // 「アプリの更新、困ったとき、の押すとき残るものの説明は、折りたたみにして」。
  // 畳むのは**読ませ方**の話なので、中身が1つでも減っていたら赤にする
  // （事実そのものの見張りは scripts/tests/meal-plan.mjs の IJ-3 が別に持っている）。
  {
    const LS_FOLDED = [
      ['バックアップの注意点と詳しい説明', 'backup-notice-toggle', 'backupNoticeOpen', [
        'ja.settings.backupContainsCodeNotice',
        'ja.settings.fileNameFreeNote',
        'ja.settings.refreshAppCacheClearWarnings',
        'ja.settings.backupDetailLink',
      ]],
      ['アプリの更新の説明', 'app-update-detail-toggle', 'appUpdateDetailOpen', [
        'ja.settings.appUpdateWhenToUse',
        'ja.settings.appUpdateWhatHappens',
        'ja.settings.appUpdateWhatRemains',
      ]],
      ['困ったときの説明', 'refresh-app-detail-toggle', 'refreshAppDetailOpen', [
        'ja.settings.refreshAppWhenToUse',
        'ja.settings.refreshAppWhatIsCleared',
        'ja.settings.refreshAppWhatRemains',
      ]],
    ]
    for (const [name, testid, stateName, keys] of LS_FOLDED) {
      eq(`LS-4 ${name}の開閉ボタンがある`, lsSettings.includes(`data-testid="${testid}"`), true)
      eq(`LS-4 ${name}が共通の折りたたみ（Collapse）に入っている`, lsSettings.includes(`<Collapse open={${stateName}}>`), true)
      eq(`LS-4 ${name}の中身が1つも消えていない`, keys.filter((k) => !lsSettings.includes(k)), [])
    }
    // 開閉ボタンの見出しは1つの文言を2枚で使い回す（同じ文字を2か所で定義しない）
    eq(
      'LS-4 「押すとどうなるか」の見出しを2枚のカードで使い回している',
      (lsSettings.match(/ja\.settings\.pressEffectToggle/g) ?? []).length,
      2,
    )
    // 「写真の選択」と「ファイルに書き出す」は畳まない（いちばん目立つ位置に置いたまま）
    const cardAt = lsSettings.indexOf('<section id="backup-section"')
    const noticeAt = lsSettings.indexOf('data-testid="backup-notice-toggle"')
    const photoAt = lsSettings.indexOf('ja.settings.backupIncludeCookedPhotos}', cardAt)
    const exportAt = lsSettings.indexOf('ja.settings.backupExport}', cardAt)
    eq(
      'LS-4 写真のチェックと「ファイルに書き出す」を掴めている',
      [cardAt >= 0, noticeAt >= 0, photoAt >= 0, exportAt >= 0],
      [true, true, true, true],
    )
    eq(
      'LS-4 写真のチェックと「ファイルに書き出す」が、折りたたみより前にある',
      photoAt < exportAt && exportAt < noticeAt,
      true,
    )
    // 一度もバックアップしていない人への1行は、このカードから外れている（お知らせへ移した）
    eq(
      'LS-4 書き出しカードの中の旧 backupNotYet は残っていない',
      /ja\.settings\.backupNotYet/.test(lsSettings),
      false,
    )
  }
}

// ==========================================================================================
// 便LT（2026-08-27 オーナーの書き溜め: 献立の「週」・テンプレート・過去の献立をコピー）
//
// ここで見張るのは**画面のソースに残る形**だけ（見え方のpxは e2e と実測が受け持つ）。
//  ①「現在の条件」が、すぐ上の「入れかた」と同じ形（太字の小見出し＋横いっぱい）で出ている
//  ②テンプレートの選択が、並べる形ではなくプルダウンである（適用の窓・内容の画面の両方）
//  ③テンプレートの内容が「確認」と「編集」で分かれている
//  ④「過去の献立をコピー」に、この1回で入れる食事を選ぶ並びがある
// ==========================================================================================
{
  const ltRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const ltRead = (rel) => readFileSync(path.join(ltRoot, rel), 'utf-8')
  const ltPlan = ltRead('src/pages/MealPlanPage.tsx')
  const ltTemplates = ltRead('src/pages/MealTemplatesPage.tsx')
  const ltCopy = ltRead('src/pages/MealPlanCopyWeekPage.tsx')

  // --- ① 「現在の条件」の存在感（オーナー原文「ここで設定できることに気づけない」） ---
  // 直す前は名前と値を1つの小さな枠に詰めていた（180×38px）。すぐ上の「入れかた」は
  // 太字の小見出し＋横いっぱいのプルダウンなので、同じ節の中で形が違い、埋もれていた。
  // **名前を小見出しへ出し、押すところを横いっぱい・44pxにする**という形そのものを見張る
  {
    const ltCondBlock = ltPlan.slice(
      ltPlan.indexOf('data-testid="plan-conditions-open"') - 800,
      ltPlan.indexOf('data-testid="plan-conditions-open"') + 900,
    )
    eq(
      'LT-1 「現在の条件」の名前が、太字の小見出しとして押すところの外に出ている',
      /text-sm font-bold text-ink-muted[\s\S]*ja\.mealPlan\.suggestConditionsToggle/.test(
        ltCondBlock,
      ),
      true,
    )
    eq(
      'LT-1 押すところは横いっぱい・44px（すぐ上の「入れかた」と同じ大きさ）',
      /min-h-11 w-full/.test(ltCondBlock),
      true,
    )
    eq(
      'LT-1 押すところに残すのは、いま効いている条件だけ（名前は小見出しが持つ）',
      /<span className="min-w-0 flex-1 truncate">\s*\{conditionsSummary \|\| ja\.mealPlan\.suggestConditionsNone\}/.test(
        ltCondBlock,
      ),
      true,
    )
    eq(
      'LT-1 読み上げ名は名前と値をつないで持つ（値だけのボタンにしない）',
      /aria-label=\{`\$\{ja\.mealPlan\.suggestConditionsToggle\}: /.test(ltCondBlock),
      true,
    )
  }

  // --- ② テンプレートの選択はプルダウン（オーナー原文「作成したテンプレートの選択方法は
  //     プルダウンに。多くなったときにスクロール長くなるので。」） ---
  {
    eq(
      'LT-2 「テンプレートを適用」の窓で、テンプレートをプルダウンで選ぶ',
      ltPlan.includes('data-testid="template-apply-pick"') &&
        /<select[\s\S]{0,200}data-testid="template-apply-pick"/.test(ltPlan),
      true,
    )
    eq(
      'LT-2 「テンプレートの内容」の画面でも、同じくプルダウンで選ぶ',
      ltTemplates.includes('data-testid="template-pick"') &&
        /<select[\s\S]{0,200}data-testid="template-pick"/.test(ltTemplates),
      true,
    )
    eq(
      'LT-2 保存したテンプレートを1本ずつ押して選ぶ形（aria-pressed の並び）に戻っていない',
      /aria-pressed=\{isSelected\}/.test(ltPlan),
      false,
    )
    eq(
      'LT-2 内容の画面が、保存した全部を縦に積む形に戻っていない',
      /\(templates \?\? \[\]\)\.map\(\(template\) => \(\s*<TemplateCard/.test(ltTemplates),
      false,
    )
  }

  // --- ③ 内容の「確認」と「編集」（オーナー原文「レシピ名が短すぎて読めない。
  //     →確認と編集でモード分け？」） ---
  {
    eq(
      'LT-3 内容の画面に、確認と編集の切り替えがある',
      ltTemplates.includes('data-testid="template-edit-toggle"'),
      true,
    )
    eq(
      'LT-3 直す操作（レシピを変える・×）は、編集のあいだだけ出す',
      /\{editing && \([\s\S]{0,800}ja\.mealTemplates\.replaceItem[\s\S]{0,600}ja\.mealTemplates\.removeItem/.test(
        ltTemplates,
      ),
      true,
    )
    eq(
      'LT-3 直す操作は2段目に置く（1段目を料理名だけにして、狭い画面でも幅を減らさない）',
      /<div className="mt-1 flex items-center justify-end gap-2">/.test(ltTemplates),
      true,
    )
    eq(
      'LT-3 料理名そのものを押して差し替える形にはしない（2026-08-25 便KUのオーナー裁定）',
      /onSelect=\{[\s\S]{0,60}onReplace/.test(ltTemplates),
      false,
    )
  }

  // --- ④ コピーする食事（オーナー原文「入れかたの下に、対象にする食事（朝昼夕）の
  //     選択ボタンが欲しい。」） ---
  {
    eq(
      'LT-4 「過去の献立をコピー」に、この1回で入れる食事を選ぶ並びがある',
      ltCopy.includes('data-testid="copy-pick-slot"'),
      true,
    )
    eq(
      'LT-4 選んだ食事が、実際に入る範囲（planCopyLastWeek）にそのまま渡っている',
      /visibleSlots: targetSlots/.test(ltCopy),
      true,
    )
    eq(
      'LT-4 選んだ食事が、上に並ぶ週の中身にも効く（見えているものと入るものを食い違わせない）',
      /copySourceWeekView\(sourceEntries \?\? \[\], sourceDates, targetSlots\)/.test(ltCopy),
      true,
    )
    eq(
      'LT-4 「表示する食事」を二重に持たない（設定はそのまま読み、その中から絞るだけ）',
      /\(pickedSlots \?\? visibleSlots\)\.filter\(\(s\) => visibleSlots\.includes\(s\)\)/.test(ltCopy),
      true,
    )
    eq(
      'LT-4 食事を1つも選んでいなければ実行を押せない（入る先が無いまま走らせない）',
      /disabled=\{targetSlots\.length === 0\}/.test(ltCopy),
      true,
    )
    eq(
      'LT-4 入れかたの下にあった説明の1行は、両方の画面から消えている',
      ltPlan.includes('data-testid="fill-hint"') || ltCopy.includes('data-testid="copy-pick-hint"'),
      false,
    )
  }
}

// ==========================================================================================
// 便LW（2026-08-28）: 説明ページの帰り道を全部に ／ タイマー音の説明を3行に
// ==========================================================================================
{
  const lwRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lwRead = (rel) => readFileSync(path.join(lwRoot, rel), 'utf-8')

  // ---- LW-1: 帰り道の部品が1本にまとまっていて、全部の説明ページが読み込んでいる ----------
  // オーナー原文（2026-08-27）「アプリではなくHPへ飛ばされるので、アプリを開きなおしたり、
  // 『アプリを開く』をHPから探さないといけない」。便LSは manual.html と multi-device.html の
  // 2枚だけを直したので、他の説明ページへ飛ばされると同じ行き止まりになっていた。
  // /about/ は素のHTMLでビルドを通っていないため、共通化の手段は「1本のスクリプトを各ページから
  // 読み込む」形しかない。ここでは (a) 部品の中身 (b) 全ページが読み込んでいること
  // (c) 書き写しが復活していないこと の3つを見る。
  {
    const lwShared = lwRead('public/about/app-return.js')
    // (a) 部品の中身。判定の規則は src/logic/backLink.ts の isInAppPath と同じにそろえる
    eq('LW-1 帰り道の部品が ?from= を読んでいる', /URLSearchParams\(window\.location\.search\)/.test(lwShared), true)
    eq('LW-1 帰り道をアプリのURL（/#…）に組み立てている', /'\/#' \+ from/.test(lwShared), true)
    eq(
      'LW-1 アプリ内のパス以外は受け付けない（外部サイトへの踏み台にしない）',
      /from\.charAt\(0\) !== '\/'/.test(lwShared) && /from\.slice\(0, 2\) === '\/\/'/.test(lwShared),
      true,
    )
    eq(
      'LW-1 アプリから来ていないときは何も作らない（判定より前に要素を作らない）',
      lwShared.indexOf("from.charAt(0) !== '/'") < lwShared.indexOf("createElement('a')"),
      true,
    )
    // 帰り先を次のページへ引き継ぐ。書き替えるのは href が /about/ で始まるものだけ
    // （同じページ内の目印を書き替えると、その場で飛ぶはずが読み込み直しになる）
    eq(
      'LW-1 帰り先を、説明ページどうしのリンクにも引き継ぐ',
      /querySelectorAll\('a\[href\^="\/about\/"\]'\)/.test(lwShared),
      true,
    )
    eq(
      'LW-1 引き継ぐときも目印（#…）を末尾に置き直す（backLink.ts と同じ組み立て）',
      /base \+ separator \+ 'from=' \+ encodeURIComponent\(from\) \+ hash/.test(lwShared),
      true,
    )

    // (b) 説明ページを1枚も取りこぼしていない。並べた一覧ではなく**実在するファイルを数え上げて**
    //     見るので、ページが増えても勝手に守られる（増やした人が読み込みを忘れたら赤になる）
    const lwAboutDir = path.join(lwRoot, 'public/about')
    const lwPages = [
      ...readdirSync(lwAboutDir).filter((f) => f.endsWith('.html')).map((f) => `public/about/${f}`),
      ...readdirSync(path.join(lwAboutDir, 'column'))
        .filter((f) => f.endsWith('.html'))
        .map((f) => `public/about/column/${f}`),
    ].sort()
    eq('LW-1 説明ページを数えられている（0枚なら見張りが壊れている）', lwPages.length >= 11, true)
    const lwNoLoad = lwPages.filter(
      (rel) => !/<script defer src="\/about\/app-return\.js"><\/script>/.test(lwRead(rel)),
    )
    eq('LW-1 説明ページ全部が帰り道の部品を読み込んでいる', lwNoLoad, [])

    // (c) 書き写しが復活していない。11枚に同じCSSと同じ関数を貼る形に戻ると、
    //     色や形を直すときに必ず取りこぼす（規約E-③と同じ事故）
    const lwCopied = lwPages.filter((rel) => {
      const page = lwRead(rel)
      return /\.app-return\s*\{/.test(page) || /getElementById\('appReturn'\)/.test(page)
    })
    eq('LW-1 帰り道の見た目と処理を各ページへ書き写していない', lwCopied, [])

    // foods.html は機械生成なので、直す先は生成スクリプト側（手で直すと次の生成で消える）
    eq(
      'LW-1 生成ページ（foods.html）は生成スクリプト側にも読み込みが入っている',
      /<script defer src="\/about\/app-return\.js"><\/script>/.test(
        lwRead('scripts/gen-food-price-page.mjs'),
      ),
      true,
    )
  }

  // ---- LW-2: 出す側。同じ窓で移るリンクは全部が帰り先を持つ -------------------------------
  // この画面の既定は**同じ窓**（ホーム画面に追加したアプリの別窓はブラウザ側で開き、
  // iOSではデータの置き場所が別になるため。SettingsPage.tsx の「うちレシピについて」の注記）。
  // 例外は**購入の枠の中の2本だけ**で、理由は「すぐ上に解錠コードの入力欄があり、
  // 同じ窓で移ると打ちかけのコードが消える」の1つ。守るものがあるから例外にしている。
  // 別窓には ?from= も載せない（別窓の行き先で帰り道を出すと、ホーム画面に追加したアプリでは
  // ブラウザ側の空のうちレシピが開く）。
  // 2026-08-28 司令部の裁定: 解錠済み側の「詳しい説明」は入力欄が無い枝なので、
  // 守るものが無いまま例外になっていた＝同じ窓へ戻した。
  {
    const lwSettings = lwRead('src/pages/SettingsPage.tsx')
    const lwNotice = lwRead('src/components/HomeScreenNotice.tsx')
    /*
     * 同じ窓で移る7本。**帰り先を運ぶ口の名前では見ない**（2026-08-29 便MJ・禁じ手②）。
     * 見るのは①その行き先が帰り先を運ぶ口を通っていること ②運んでいる帰り先が
     * この画面の `?section=` であること、の2つの事実。
     * 口の名前を書き写していたせいで、便MJが折りたたみの復元を足して口を
     * aboutDetourHref（中で aboutLinkWithReturn を呼ぶ）にした瞬間に7本とも落ちた。
     */
    const lwEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const lwReturnCall = (path, back) =>
      new RegExp(
        String.raw`(?:aboutLinkWithReturn|aboutDetourHref)\(\s*'${lwEsc(path)}',\s*'${lwEsc(back)}'`,
      )
    for (const [name, path, back] of [
      ['バックアップの詳しい説明', '/about/manual.html#backup', '/settings?section=backup'],
      ['古い記録の書き出しの詳しい説明', '/about/manual.html#archive', '/settings?section=archive'],
      ['複数の端末で使う方法', '/about/multi-device.html', '/settings?section=backup'],
      ['解錠済みのPro版の詳しい説明', '/about/manual.html#pro', '/settings?section=pro'],
      ['紹介ページ', '/about/', '/settings?section=about'],
      ['ホーム画面に追加する方法', '/about/install.html', '/settings?section=about'],
      ['利用規約', '/about/terms.html', '/settings?section=about'],
    ]) {
      eq(`LW-2 設定の「${name}」が帰り先を持っている`, lwReturnCall(path, back).test(lwSettings), true)
    }
    eq(
      'LW-2 ホーム画面追加のお知らせの手順ページも帰り先を持つ（出る場所を決め打ちにしない）',
      /aboutLinkWithReturn\('\/about\/install\.html', location\.pathname \+ location\.search\)/.test(lwNotice),
      true,
    )
    // 帰り先の行き先（?section=archive）が実在すること＝空振りで設定の先頭に着かない
    eq(
      'LW-2 ?section=archive の着地点が用意されている',
      /archive: 'archive-section'/.test(lwSettings) && /id="archive-section"/.test(lwSettings),
      true,
    )
    // 解錠済み側の「詳しい説明」が、また別窓に戻っていないこと
    eq(
      'LW-2 解錠済みのPro版の詳しい説明が別窓に戻っていない（この画面の既定は同じ窓）',
      /data-testid="pro-detail-link-activated"/.test(lwSettings) &&
        !/target="_blank"[\s\S]{0,120}data-testid="pro-detail-link-activated"/.test(lwSettings),
      true,
    )
    eq(
      'LW-2 ?section=pro の着地点が用意されている',
      /pro: 'pro-section'/.test(lwSettings) && /id="pro-section"/.test(lwSettings),
      true,
    )
    // 裸のリンクに戻っていないこと。**同じ窓で移るもの**だけを見るので、
    // target="_blank" の2本（購入の枠の中のPro版の説明・特商法表記）は数に入れない
    const lwBare = [...lwSettings.matchAll(/href="(\/about\/[^"]*)"/g)].map((m) => m[1])
    const lwBareSameWindow = lwBare.filter((href) => {
      const at = lwSettings.indexOf(`href="${href}"`)
      // リンクの終わりまでの間に target="_blank" があるかどうかで見分ける
      const tag = lwSettings.slice(at, lwSettings.indexOf('>', lwSettings.indexOf('className', at)))
      return !tag.includes('target="_blank"')
    })
    eq('LW-2 同じ窓で移るのに帰り先を持たない裸のリンクが無い', lwBareSameWindow, [])
    eq(
      'LW-2 見分けの前提: 別窓の裸のリンクは2本ある（0本なら見張りが空振りしている）',
      lwBare.length,
      2,
    )
    // **残す2本は別窓のまま**であること。ここは「打ちかけの解錠コードを守るために、あえて
    // 例外にしている」場所なので、あとから誰かが「この画面の既定は同じ窓だから」と
    // 揃えて直してしまわないように、別窓であること自体を見張る。
    // 守っている中身（解錠コードの入力欄が同じ枠の中にあること）も一緒に見る＝
    // 入力欄が別の場所へ移ったら、この例外の根拠が消えるので赤にする
    for (const testid of ['pro-detail-link', 'proBuyLegalLink']) {
      const anchor =
        testid === 'pro-detail-link'
          ? /target="_blank"[\s\S]{0,120}data-testid="pro-detail-link"/
          : /href="\/about\/tokushoho\.html"\s*\n\s*target="_blank"/
      eq(`LW-2 購入の枠の中の「${testid}」は別窓のまま（打ちかけのコードを守るため）`, anchor.test(lwSettings), true)
    }
    {
      // 守るもの＝解錠コードの入力欄が、この2本と同じ枠（未解錠の枝）の中にあること。
      // 位置ではなく**並び順**で見る（入力欄が先・リンクが後ろ）ので、間に何が増えても崩れない
      const lwInputAt = lwSettings.indexOf('data-testid="unlock-code-row"')
      const lwLegalAt = lwSettings.indexOf('href="/about/tokushoho.html"')
      eq(
        'LW-2 別窓のままにする理由が生きている（解錠コードの入力欄が同じ枠の中にある）',
        lwInputAt > 0 && lwLegalAt > lwInputAt,
        true,
      )
    }
  }

  // ---- LW-3: タイマー音の説明が担う2つの事実 -----------------------------------------------
  // 390pxで4行になっていたので詰めた（実測 73字4行 → 70字3行）。短くするために事実を落とすと
  // 害のほうが大きいので、**2つの事実が残っていること**を見張る。
  // 行数そのものの実測は e2e の LW-01 が持つ（折り返しは字数では決まらないため）。
  {
    const lwDesc = ja.settings.timerSoundDescription.replace(/​/g, '')
    eq('LW-3 タイマーごとの消音が常駐バーの🔔でできることが残っている', /タイマーごとの消音/.test(lwDesc) && /常駐バーの🔔/.test(lwDesc), true)
    eq(
      'LW-3 音を消しても振動対応の端末は振動で知らせることが残っている',
      /音を消しても/.test(lwDesc) && /振動に対応した端末/.test(lwDesc) && /振動でお知らせ/.test(lwDesc),
      true,
    )
    // 字数は行数の代わりにならない（同じ70字でも切れ目の位置で3行にも4行にもなる）。
    // ここは**書き足して元の長さに戻る**ことだけを止める保険で、合否は e2e LW-01 の行数が決める
    eq('LW-3 保険: 直す前の長さ（73字）に戻っていない', lwDesc.length <= 70, true)
  }
}

// ==========================================================================================
// 便LV（2026-08-28）
//  LV-3 献立の折りたたみが、寄り道の覚え（ScreenReturnPoint）に**配線されている**
//
// 直したこと: 便LUで「どのタブ・どの週・どの縦位置」までは帰るようになったが、
// **折りたたみは畳まれたまま**だった（実測 2026-08-28: 週タブで6つの節と栄養パネルを開いて
// Pro案内へ出て帰ると、6つとも畳まれ、縦位置も 2407 → 1331 とずれていた）。
//
// ここで見るのは「覚える側」と「戻す側」の両方が居ること。**片方だけ直すと黙って戻らなくなる**
// （覚えているのに読まない／読んでいるのに覚えない、はどちらも画面には何も出ない）。
// 節の数・並び順には依らない書き方にする（禁じ手③④）。
// ==========================================================================================
{
  const lvRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lvRead = (rel) => readFileSync(path.join(lvRoot, rel), 'utf-8')
  const lvState = lvRead('src/pages/mealPlan/useMealPlanState.ts')
  const lvPage = lvRead('src/pages/MealPlanPage.tsx')
  const lvPanel = lvRead('src/components/NutritionBalancePanel.tsx')

  // --- 覚える側: この画面を離れる道（週・月・日）が全部、折りたたみも一緒に覚える ---
  const lvRememberFns = ['rememberWeekReturn', 'rememberMonthReturn', 'rememberDayReturn']
  for (const fn of lvRememberFns) {
    const at = lvState.indexOf(`const ${fn} = () => {`)
    const body = at < 0 ? '' : lvState.slice(at, at + 400)
    eq(
      `LV-3 ${fn} が、開いていた折りたたみも覚える`,
      body.includes('rememberOpenPanels()'),
      true,
    )
  }
  eq(
    'LV-3 覚えは共通の形（ScreenReturnPoint）に載せる（この画面だけの覚え方を作らない）',
    /const rememberOpenPanels = \(\) => \{[\s\S]*?serializeScreenReturn\(\{ path: location\.pathname, scrollY: 0, openPanels: open \}\)/.test(
      lvState,
    ),
    true,
  )
  // 形は共通でも、**しまう場所は献立専用**にする。同じキーだと、途中にはさんだ画面
  // （レシピ詳細のPro案内）の覚えが献立の覚えを上書きし、節だけが畳まれて帰る
  // （2026-08-28 に実測: 週と縦位置は戻るのに開いていた6つが0になった）
  eq(
    'LV-3 折りたたみの覚えは献立専用のキーに置く（途中の画面に上書きされない）',
    lvState.includes('MEAL_PLAN_PANEL_KEY') && !lvState.includes('SCREEN_RETURN_KEY'),
    true,
  )

  // --- 戻す側: 最初の描画から開いた形にする（あとから開き直すと一瞬畳まれて見える） ---
  eq(
    'LV-3 覚えを読むのは最初の描画のとき1回だけ（効果ではなく状態の初期値）',
    /const \[restoredPanels\] = useState<string\[\]>\(\(\) =>[\s\S]{0,300}?parseScreenReturn\(readSessionItem\(MEAL_PLAN_PANEL_KEY\), location\.pathname\)/.test(
      lvState,
    ),
    true,
  )
  eq(
    'LV-3 読んだ覚えは捨てる（次にこの画面を素で開いたときに蘇らない）',
    /if \(searchParams\.get\(WEEK_RETURN_PARAM\) === '1'\) removeSessionItem\(MEAL_PLAN_PANEL_KEY\)/.test(
      lvState,
    ),
    true,
  )
  // 週タブの節は「節の名前」でひとつずつ戻す＝節が増えても書き足しが要らない
  eq(
    'LV-3 週タブの節が、節の名前で開き直される',
    /wasPanelOpen\(screenPanelName\(SCREEN_PANEL\.mealPlanWeekGroup, key\)\)/.test(lvState),
    true,
  )
  for (const [name, panel] of [
    ['月タブの「献立の入れかた」', 'mealPlanMonthGroup'],
    ['月タブの栄養のカード', 'mealPlanMonthNutrition'],
    ['月タブの食費のカード', 'mealPlanMonthCost'],
  ]) {
    eq(
      `LV-3 ${name}が開き直される`,
      lvState.includes(`wasPanelOpen(SCREEN_PANEL.${panel})`),
      true,
    )
  }

  // --- 栄養バランスのパネル: 開閉を画面が持ち、パネルはそれを受け取る ---
  eq(
    'LV-3 栄養バランスのパネルは、渡されたときだけ外の開閉に従う（渡さない画面は今までどおり）',
    lvPanel.includes('const expanded = expandedProp ?? selfExpanded'),
    true,
  )
  eq(
    'LV-3 献立が、栄養バランスのパネルの開閉を持っている（週まとめも曜日カードも）',
    (lvPage.match(/expanded=\{nutritionPanelOpen\[nutritionPanelName\(/g) ?? []).length >= 2 &&
      (lvPage.match(/onExpandedChange=\{\(next\) =>/g) ?? []).length >= 2,
    true,
  )
  eq(
    'LV-3 曜日カードのパネルは、その日の日付で覚える（並び順で覚えない）',
    /expanded=\{nutritionPanelOpen\[nutritionPanelName\(date\)\] === true\}/.test(lvPage),
    true,
  )
  eq(
    'LV-3 覚えた名前をそのまま鍵に使う（覚える側と戻す側で名前の作り方が食い違わない）',
    /restoredPanels\s*\n?\s*\.filter\(\(name\) => name\.startsWith\(`\$\{SCREEN_PANEL\.mealPlanNutritionPanel\}:`\)\)/.test(
      lvState,
    ),
    true,
  )
}

// ==========================================================================================
// 便MA（2026-08-28）: オーナーが実機で見つけた3つの穴を、ソースの側から固定する
//  MA-2 説明ページの絵の貯め方（先読みは増やさない・貯めたものが古いまま残らない）
//  MA-3 栄養の「計算できなかった料理」の名前が、押した画面へ帰る出所を持っている
//  MA-4 テンプレートの内容の画面が、帰り先を書き切っていない
//
// どれも「片方だけ直すと黙って効かなくなる」形（渡す側と受け取る側が離れている）なので、
// **両側が居ること**を見る。並び順・行数には依らない書き方にする（禁じ手③④）。
// ==========================================================================================
{
  const maRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const maRead = (rel) => readFileSync(path.join(maRoot, rel), 'utf-8')

  // ---- MA-2: 説明ページの絵（オーナー原文「献立を提案の画像がでない」） ---------------------
  //
  // 直す前の実測（2026-08-28）: 説明ページのHTMLは先読みに入っているのに、絵は globIgnores で
  // 先読みから外され、貯める規則も無かった＝**毎回ネットワーク頼み**。通信を切って開き直すと
  // 14枚中10枚が出なかった。`loading="lazy"` の絵は取りそこねても自分で拾い直さない。
  //
  // 直しかた: 先読みには入れず（50ファイル・約1.4MB。いまの先読み57件・約3.0MBが1.5倍になる）、
  // **一度読めたものを貯める規則（runtimeCaching）**を `/about/img/` の下だけに足した。
  {
    const maVite = maRead('vite.config.ts')
    eq(
      'MA-2 説明ページの絵は、いまも先読み（precache）に入れていない',
      /globIgnores:\s*\['about\/img\/\*\*'\]/.test(maVite),
      true,
    )
    eq(
      'MA-2 一度読めた絵を貯める規則がある（runtimeCaching）',
      /runtimeCaching:\s*\[/.test(maVite),
      true,
    )
    eq(
      'MA-2 貯める対象は /about/img/ の下だけ（アプリ本体のバンドルには当てない）',
      /urlPattern:\s*\/\\\/about\\\/img\\\/\//.test(maVite),
      true,
    )
    // 貯めたものが古いまま残らない貯め方であること。CacheFirst は期限が切れるまで
    // 撮り直した絵が出ないので使わない（実測: StaleWhileRevalidate なら次に開いたときに新しくなる）
    eq(
      'MA-2 貯め方は「出しながら裏で取り直す」（撮り直した絵が次に開いたとき出る）',
      /handler:\s*'StaleWhileRevalidate'/.test(maVite),
      true,
    )
    eq('MA-2 期限の切れない貯め方（CacheFirst）にしていない', /handler:\s*'CacheFirst'/.test(maVite), false)
    // 端末の容量を食い潰さない上限（枚数と日数）
    eq('MA-2 貯める枚数に上限がある', /maxEntries:\s*\d+/.test(maVite), true)
    eq('MA-2 貯める日数に上限がある', /maxAgeSeconds:/.test(maVite), true)
    // 失敗した応答を貯めない（貯めると、出ない絵が居座る）
    eq('MA-2 うまく取れた応答だけを貯める', /cacheableResponse:\s*\{\s*statuses:\s*\[200\]\s*\}/.test(maVite), true)
  }

  // ---- MA-3: 栄養の「計算できなかった料理」の名前の帰り道 ------------------------------------
  //
  // オーナー原文「選んだ期間の栄養など、計算できなかった材料があるレシピ名をタップした後の
  // レシピ詳細から、戻るで同じ画面に戻るようにして。レシピ一覧に飛んでしまう。」
  // 直す前は名前のリンクが出所（location.state）を1つも載せていなかったので、
  // レシピ詳細の「戻る」は必ずレシピ一覧へ着地していた（実測: 戻ると /#/recipes）。
  {
    const maGap = maRead('src/components/NutritionGapDishes.tsx')
    const maPanel = maRead('src/components/NutritionBalancePanel.tsx')
    const maIntake = maRead('src/pages/mealPlan/IntakeParts.tsx')
    const maPage = maRead('src/pages/MealPlanPage.tsx')
    eq(
      'MA-3 料理名のリンクが、押した画面の出所を載せる',
      /state=\{linkState\}/.test(maGap) && /onClick=\{onNavigate\}/.test(maGap),
      true,
    )
    // 出所を渡す先は3か所（週まとめ・曜日カード・月/期間のカード）。どこも同じ名前で渡す
    eq(
      'MA-3 栄養バランスのパネルが、受け取った帰り道を料理名へ渡す',
      (maPanel.match(/<NutritionGapDishes sum=\{sum\} kind="\w+" \{\.\.\.dishLink\} \/>/g) ?? []).length,
      2,
    )
    eq(
      'MA-3 期間・月の栄養のパネルも、受け取った帰り道を料理名へ渡す',
      (maIntake.match(/<NutritionGapDishes[\s\S]{0,80}?\{\.\.\.dishLink\} \/>/g) ?? []).length,
      2,
    )
    // 献立の画面が「見ていたタブへ帰す出所」と「居場所を覚える手当て」を対で渡していること。
    // 片方だけだと、帰れてもタブや縦位置が落ちる（便LU・便LVが直したのと同じ形の穴）
    eq(
      'MA-3 献立が、見ていたタブへ帰す出所と居場所の覚えを対で渡す',
      /const gapDishLink = \{\s*\n\s*linkState: logDetailLinkState,\s*\n\s*onNavigate: rememberLogDetailReturn,\s*\n\s*\}/.test(
        maPage,
      ),
      true,
    )
    eq(
      'MA-3 渡し先は3か所（週まとめ・曜日カード・月/期間のカード）',
      (maPage.match(/dishLink=\{gapDishLink\}/g) ?? []).length,
      3,
    )
    // 月タブは「期間で絞る」で読んでいたカードごと帰す＝期間も覚えに載せる
    const maState = maRead('src/pages/mealPlan/useMealPlanState.ts')
    eq(
      'MA-3 月タブは、選んでいた期間も一緒に覚える',
      /range:\s*\n?\s*costMode && rangeStart != null && rangeEnd != null/.test(maState),
      true,
    )
    eq(
      'MA-3 帰ってきたら、その期間で絞り直す',
      /if \(monthPoint\.range\) \{[\s\S]{0,200}?setCostMode\(true\)/.test(maState),
      true,
    )
  }

  // ---- MA-4: テンプレートの内容の画面の帰り先 -------------------------------------------------
  //
  // オーナー原文「テンプレートをこの月に入れる→テンプレートの中身を見る→ここから戻るで
  // 週に飛んでしまう。」。帰り先が `'/meal-plan?focus=week'` と書き切ってあり、
  // 月から入っても必ず週へ着いていた（実測: 押されているタブが「週」）。
  {
    const maTpl = maRead('src/pages/MealTemplatesPage.tsx')
    const maPage = maRead('src/pages/MealPlanPage.tsx')
    const maHistory = maRead('src/pages/HistoryPage.tsx')
    eq(
      'MA-4 テンプレートの画面の戻る先が、来たタブから決まる（週と書き切っていない）',
      /fallback=\{backTo\}/.test(maTpl) && /mealPlanTabBackPath\(backParams\.get\('back'\)\)/.test(maTpl),
      true,
    )
    eq(
      'MA-4 呼び出し側が、開いたタブを ?back= で運ぶ（週の入口・窓の中の入口の2か所）',
      (maPage.match(/to=[{"]`?\/meal-templates\?back=/g) ?? []).length,
      2,
    )
    eq(
      'MA-4 窓の中の入口は、窓を開いたタブ（週／月）で行き先を変える',
      /\/meal-templates\?back=\$\{templateApplyScope === 'month' \? 'month' : 'week'\}/.test(maPage),
      true,
    )
    // 帰り先の変換は1か所（記録の一覧と共有）。書き写しが復活していないこと
    eq(
      'MA-4 タブの帰り先の変換は logic/backLink.ts の1か所だけ',
      /function backTargetOf/.test(maHistory) || /function backTargetOf/.test(maTpl),
      false,
    )
    eq(
      'MA-4 記録の一覧も同じ変換を使っている',
      /mealPlanTabBackPath\(searchParams\.get\('back'\)\)/.test(maHistory),
      true,
    )
  }
}


// ---------- 便MC: レシピ詳細の栄養の「説明と注記」を折りたたみへ（MC-2） ----------
// オーナー原文:
//   「栄養の説明と注記は折りたたみにしてコンパクトに。他に個所でやってる「注記と出典」と
//     同じように」
//
// 見張るのは3つ:
//   ① **新しい形を作っていない**＝開閉の言い方は献立の栄養バランスパネルと同じものを使う
//      （同じものを2つの名前で呼ばない。文言そのものは書き写さず、キーで測る）
//   ② 折りたたみは `Collapse` で作る＝**閉じているあいだ中身をDOMに置かない**
//      （読み上げソフトとページ内検索に畳んだ中身が残らないようにする作法）
//   ③ **⚠の注意と材料の一覧は中に入れない**。⚠は「いま出ている数字が実際より小さい」という
//      数字の読み方そのもので、畳んだ1行の印（materialGapBadge / saltGapBadge）と対になっている。
//      材料の一覧は logic/nutrition.ts 冒頭の決めごと
//      「計算できなかった材料は隠さず必ず表示に含めること」に当たる。
//   画面での見え方（畳んでいる間は出ない／開くと出る）は e2e の NUT-01・NUT-02 で測る。
{
  const mcRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const mcTeaser = readFileSync(path.join(mcRoot, 'src/components/NutritionTeaser.tsx'), 'utf-8')
  const mcPanel = readFileSync(path.join(mcRoot, 'src/components/NutritionBalancePanel.tsx'), 'utf-8')

  eq(
    'MC-2 レシピ詳細の栄養に、注記と出典の折りたたみがある',
    /function NutritionNotes\(/.test(mcTeaser),
    true,
  )
  eq(
    'MC-2 開閉の言い方は献立の栄養パネルと同じものを使う（新しい形を作らない）',
    mcTeaser.includes('ja.nutritionBalance.notesToggle') &&
      mcPanel.includes('ja.nutritionBalance.notesToggle'),
    true,
  )
  // NutritionNotes の中身だけを切り出して、何が畳まれるのかを見る
  const mcNotesBody = mcTeaser.slice(
    mcTeaser.indexOf('function NutritionNotes('),
    mcTeaser.indexOf('function SourceNote('),
  )
  eq('MC-2 前提: 折りたたみの中身を切り出せている', mcNotesBody.length > 200, true)
  eq(
    'MC-2 折りたたみは Collapse で作る（閉じているあいだ中身をDOMに置かない）',
    /<Collapse open=\{notesOpen\}>/.test(mcNotesBody),
    true,
  )
  // 折りたたみへ渡している中身（<NutritionNotes> … </NutritionNotes>）を全部取り出す
  const mcInside = [...mcTeaser.matchAll(/<NutritionNotes>([\s\S]*?)<\/NutritionNotes>/g)].map(
    (m) => m[1],
  )
  eq('MC-2 前提: 折りたたみに渡している中身を拾えている（無料・Proの2か所）', mcInside.length, 2)
  eq(
    'MC-2 どのレシピでも同じことを言う説明・注記・出典が中に入っている',
    mcInside.length === 2 &&
      mcInside.every(
        (body) =>
          body.includes('ja.nutrition.estimateNote') &&
          body.includes('<VegetableCountNote />') &&
          body.includes('<SourceNote />'),
      ),
    true,
  )
  eq(
    'MC-2 ⚠の注意と材料の一覧は折りたたみの外に残す（数字の読み方と、隠さない決めごと）',
    mcInside.filter((body) =>
      ['<MaterialGapNote', '<SaltGapNote', '<AssumedBlock', '<ExcludedBlock'].some((tag) =>
        body.includes(tag),
      ),
    ),
    [],
  )
}

// ---------- 便MB: ON/OFFの入切はスイッチ・名札の下・内訳の文字（2026-08-28 オーナー） ----------
// オーナー原文:
//   「『レシピの写真は使わない』など、ONOFFするタイプのボタンはスイッチ
//     （またはチェック入れるタイプ）にしてください。（アプリ全体）」
//   「週の『表示のしかた』に合わせた表記への修正でした。」
//   「主役のはずの内訳の文字が小さくて見つけにくい。文字をちょっぴり大きくして」
// 司令部裁定: **設定の入切（押すと状態が残るもの）だけ**をスイッチにする。
// 絞り込みのチップ（複数選べる・その場だけ）はチップのまま＝全部スイッチにすると縦に伸びる。
{
  const mbRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const mbPage = readFileSync(path.join(mbRoot, 'src/pages/MealPlanPage.tsx'), 'utf-8')
  const mbParts = readFileSync(path.join(mbRoot, 'src/pages/mealPlan/IntakeParts.tsx'), 'utf-8')

  // ---- MB-6: 「レシピの写真は使わない」は設定に残る入切なのでスイッチ ----
  // 押されているかどうかの伝え方も、アプリの他のスイッチと同じ aria-checked にそろえる
  // （aria-pressed のままだと、同じ形のスイッチが2通りの読み上げ方をすることになる）
  const mbToggleStart = mbPage.indexOf('data-testid="month-hide-recipe-photo"')
  eq('MB-6 前提: 「レシピの写真は使わない」の切り替えが画面にある', mbToggleStart > 0, true)
  {
    // その切り替えを書いている <button ...> の中だけを見る
    const mbBtnOpen = mbPage.lastIndexOf('<button', mbToggleStart)
    const mbBtnAttrs = mbPage.slice(mbBtnOpen, mbPage.indexOf('>', mbToggleStart))
    eq('MB-6 「レシピの写真は使わない」がスイッチ（role="switch"）', mbBtnAttrs.includes('role="switch"'), true)
    eq('MB-6 入切の伝え方が他のスイッチと同じ（aria-checked）', mbBtnAttrs.includes('aria-checked='), true)
    eq('MB-6 押した状態を aria-pressed で二重に言っていない', mbBtnAttrs.includes('aria-pressed'), false)
  }

  // ---- MB-7: その切り替えが、名札「カレンダーの表示のしかた」の内側にある ----
  // 名前だけ変えると、**表示の設定なのに名札の外にあるもの**が残る（司令部裁定）。
  // 入れ子は数えて確かめる（前後の並びだけを見ると、外に出したのに気づけない）
  {
    const mbGroupTag = 'role="group" aria-labelledby="month-cell-mode-label"'
    const mbGroupAt = mbPage.indexOf(mbGroupTag)
    eq('MB-7 前提: 名札(month-cell-mode-label)の囲みがある', mbGroupAt > 0, true)
    let depth = 0
    let end = -1
    const mbRe = /<div\b|<\/div>/g
    mbRe.lastIndex = mbPage.lastIndexOf('<div', mbGroupAt)
    for (let m = mbRe.exec(mbPage); m; m = mbRe.exec(mbPage)) {
      depth += m[0] === '</div>' ? -1 : 1
      if (depth === 0) {
        end = m.index
        break
      }
    }
    eq('MB-7 前提: 名札の囲みの終わりを数えられている', end > mbGroupAt, true)
    eq(
      'MB-7 「レシピの写真は使わない」が名札の囲みの中にある',
      mbToggleStart > mbGroupAt && mbToggleStart < end,
      true,
    )
    // 同じく表示の設定である「マスに出す栄養の項目」も名札の中に入っていること
    const mbNutrientAt = mbPage.indexOf('data-testid="month-cell-nutrient"')
    eq(
      'MB-7 「マスに出す栄養の項目」も名札の囲みの中にある',
      mbNutrientAt > mbGroupAt && mbNutrientAt < end,
      true,
    )
  }

  // ---- MB-8: 内訳の開閉ボタンの字を1段上げた（大きさだけ・色と太さは動かさない） ----
  {
    const mbDiscAt = mbParts.indexOf('function IntakeDisclosureButton')
    eq('MB-8 前提: 内訳の開閉ボタンの部品がある', mbDiscAt > 0, true)
    const mbDisc = mbParts.slice(mbDiscAt, mbDiscAt + 2400)
    eq('MB-8 内訳の開閉ボタンの字が1段上（text-base）', /className="[^"]*\btext-base\b/.test(mbDisc), true)
    eq('MB-8 元の大きさ（text-sm）に戻っていない', /className="[^"]*\btext-sm\b/.test(mbDisc), false)
    eq('MB-8 色は変えていない（text-accent-ink のまま）', mbDisc.includes('text-accent-ink'), true)
    eq('MB-8 太さは変えていない（font-bold のまま）', mbDisc.includes('font-bold'), true)
  }

  // ---- MB-9: 概算の但し書きを、内訳の外にもう1行置かない ----
  // オーナー「内訳の中にも同じ内容の文があるため」。内訳（IntakeCostDetails）の weekCostNote が
  // 同じ中身を言っているので、表のすぐ下には置かない
  eq(
    'MB-9 消した但し書き(intakeCostEstimateNote)を画面が呼び出していない',
    mbPage.includes('intakeCostEstimateNote'),
    false,
  )
  eq('MB-9 同じ中身は内訳の中の1行が持っている', mbParts.includes('ja.mealPlan.weekCostNote'), true)
}


// ---------- 便MJ（2026-08-29）: 選ぶチップの塗りつぶし／設定の折りたたみの復元 ----------
{
  const mjRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const mjRead = (rel) => readFileSync(path.join(mjRoot, rel), 'utf-8')
  const mjPlan = mjRead('src/pages/MealPlanPage.tsx')
  const mjSettings = mjRead('src/pages/SettingsPage.tsx')

  /* ---- MJ-2: 買い物メモの範囲えらびのチップが塗りつぶしに戻っていない ----
   *
   * 前の便（便MD）の申し送り:「買い物メモの範囲えらびのチップは塗りつぶし（実行ボタンと
   * 同じ見た目）のままです。便ENの作法から外れていますが、担当外なので触っていません。」
   *
   * 2026-08-09 便EN の作法:「**塗りつぶしを使うのは実行ボタンだけ**にする＝塗ってあるものは
   * 押すと何かが起きる、と見た目だけで読み取れるようにする」。
   * 直す理由が強いのは、**同じ節のすぐ下に実行ボタンが並んでいる**から
   * （実測 2026-08-29・390px: 選択中のチップの地 rgb(204,63,1)、実行ボタン
   * 「選んだ範囲の買い物メモを作る」の地も rgb(204,63,1) で、文字色まで同じ rgb(250,245,236)）。
   *
   * 見るのは**範囲えらびの中だけ**を切り出して、そこに塗りつぶしの組が無いこと。
   * 画面全体で見ると実行ボタン（塗ってよい側）まで拾ってしまう。 */
  {
    const mjRangeAt = mjPlan.indexOf('const renderShopRange = ()')
    eq('MJ-2 前提: 買い物メモの範囲えらびを切り出せている', mjRangeAt > 0, true)
    const mjRangeEnd = mjPlan.indexOf('const renderRow = (', mjRangeAt)
    const mjRange = mjPlan.slice(mjRangeAt, mjRangeEnd)
    eq('MJ-2 前提: 日付と食事のチップが両方この中にある',
      mjRange.includes('data-testid="shop-range-date"') && mjRange.includes('data-testid="shop-range-slot"'),
      true)
    // 塗りつぶしの組（面を塗る bg-accent と、その上に乗る文字色）が1つも無いこと
    eq('MJ-2 範囲えらびに塗りつぶし（bg-accent）が無い', /\bbg-accent\b/.test(mjRange), false)
    eq('MJ-2 範囲えらびに塗りつぶしの文字色（text-on-accent）が無い', /\btext-on-accent\b/.test(mjRange), false)
    // 「選ぶボタン」の作法（便EN）を、画面が自分で持たずに共通の定義から通していること
    eq('MJ-2 チップの見た目は共通の chipClass から取る', (mjRange.match(/chipClass\(/g) ?? []).length, 2)
    eq('MJ-2 選択中の薄い地も共通の chipStyle から取る', (mjRange.match(/chipStyle\(/g) ?? []).length, 2)
    // 形でも選択が分かる（色だけに頼らない）。押しても幅が動かないのは ChipCheck 側の作り
    eq('MJ-2 選んだ印（ChipCheck）が日付と食事の両方に付いている', (mjRange.match(/<ChipCheck /g) ?? []).length, 2)
    // 実行ボタンの側は塗りつぶしのまま（作法の片側だけを消していない）
    const mjShopSectionAt = mjPlan.indexOf("'shop-range-toggle',")
    const mjShopSection = mjPlan.slice(mjShopSectionAt, mjShopSectionAt + 1600)
    eq('MJ-2 実行ボタン（買い物メモを作る）は塗りつぶしのまま', /bg-accent[\s\S]{0,80}text-on-accent/.test(mjShopSection), true)
  }

  /* ---- MJ-3: 設定へ帰ると、開いていた折りたたみが開いたまま ----
   *
   * 司令部の裁定（2026-08-28）:「開いたまま帰します。理由は、便LVが献立側で同じ原則を
   * 通したから——『開いていた折りたたみは、寄り道から帰っても開いたまま』」。
   * 「既定は畳む」（便JJ・便LS）とは別のことなので、**素で開いたときの姿は変えない**。
   *
   * 実測（2026-08-29・390px・4581番のプレビュー）:
   *   ?section=archive … 出る前 true → 帰った後 true（直す前は false）
   *   ?section=backup  … 出る前 true → 帰った後 true（直す前は false）
   *   素で ?section=archive を開く … archive も backup も false（既定は畳んだまま） */
  {
    // ①折りたたみの初期値が「離れたときに開いていたか」から決まる（6つ全部）
    const mjPanels = [
      'settingsMoveGuide', 'settingsArchive', 'settingsProFeatures',
      'settingsBackupNotice', 'settingsAppUpdateDetail', 'settingsRefreshAppDetail',
    ]
    for (const panel of mjPanels) {
      eq(
        `MJ-3 折りたたみ「${panel}」の初期値が覚えから決まる`,
        new RegExp(String.raw`useState\(\(\)\s*=>\s*[\s\S]{0,40}wasOpen\(SCREEN_PANEL\.${panel}\)`).test(mjSettings),
        true,
      )
      // 覚える側にも同じ名前が出る（片側だけ足すと、覚えても戻らない／戻す先が無い）
      eq(
        `MJ-3 折りたたみ「${panel}」は離れるときにも覚える`,
        mjSettings.includes(`SCREEN_PANEL.${panel}]`),
        true,
      )
    }
    // ②離れる直前に覚えていること。/about/ へ出るリンク全部に同じ形で付ける
    const mjAboutLinks = (mjSettings.match(/href=\{aboutDetourHref\(/g) ?? []).length
    eq('MJ-3 説明ページへ出るリンクは7本', mjAboutLinks, 7)
    eq('MJ-3 その7本すべてが、離れる直前に開いている折りたたみを覚える',
      (mjSettings.match(/onClick=\{rememberSettingsPanels\}/g) ?? []).length, 7)
    // ③帰り先に「覚えた場所へ戻す」印が乗る（印が無いと、覚えていても読まれない）
    eq('MJ-3 帰り先に restore の印を足している',
      /aboutLinkWithReturn\(aboutHref, withScreenReturnParam\(settingsPath\)\)/.test(mjSettings), true)
    // ④覚えるのは折りたたみだけ。**縦位置は覚えない**（着地する場所は便LWが実測して
    //   `?section=` で決めてあり、縦位置まで戻すとその決めごとを上書きしてしまう。
    //   実測 2026-08-29: 覚えるとPro版の枠の上端が -643.5px になり e2e の LW-01 が落ちた）
    eq('MJ-3 覚えるのは折りたたみだけで、縦位置は覚えない（着地の決めごとを上書きしない）',
      /rememberDetour\(openSettingsPanels\(\), 0\)/.test(mjSettings), true)
    // ⑤仕組みは献立・レシピ詳細と同じ1つ（設定だけ別の覚え方を作らない）
    eq('MJ-3 覚えと復元は共通の仕組み（useScreenReturn / useSettingsDetour）に乗せる',
      /useScreenReturn\(\)/.test(mjSettings) && /useSettingsDetour\(\)/.test(mjSettings), true)
    // ⑥「既定は畳む」は変えていない＝素で開いたら閉じている（true 直書きに戻っていない）
    eq('MJ-3 折りたたみの初期値を true に直書きしていない（既定は畳むまま）',
      /const \[(?:archiveOpen|backupNoticeOpen|moveGuideOpen|proFeaturesOpen)[^\]]*\] = useState\(true\)/.test(mjSettings),
      false)
  }
}

// ==========================================================================================
// 計測タグ（2026-08-30）: **本番のドメインでだけ鳴らす**
//
// それまでは `<script defer src=…beacon.min.js>` を直に置いており、**localhost（開発サーバー・
// プレビュー・e2e）からも同じトークンで送っていた**。Cloudflare の画面で
// **localhost/ が最も多いURL**になっており（フルe2eは1回で733回ページを開く）、
// 「訪問が少ないのか、訴求が弱いのか」の切り分けができない状態だった。
// ==========================================================================================
{
  const cfRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const cfRead = (rel) => readFileSync(path.join(cfRoot, rel), 'utf-8')
  const cfPages = [
    'index.html',
    ...readdirSync(path.join(cfRoot, 'public/about'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `public/about/${f}`),
    ...readdirSync(path.join(cfRoot, 'public/about/column'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `public/about/column/${f}`),
  ].sort()
  eq('CF-1 計測を入れるページを数えられている（0枚なら見張りが壊れている）', cfPages.length >= 12, true)

  // (a) 素の script タグに戻っていない（戻ると localhost からも鳴る）
  const cfBare = cfPages.filter((rel) =>
    /<script defer src='https:\/\/static\.cloudflareinsights\.com/.test(cfRead(rel)),
  )
  eq('CF-1 計測タグを素の script で置いていない（本番のドメインの判定を通す）', cfBare, [])

  // (b) 計測を入れているページは、必ずドメインの判定つき
  const cfHasBeacon = cfPages.filter((rel) => cfRead(rel).includes('cloudflareinsights.com'))
  const cfNoGuard = cfHasBeacon.filter(
    (rel) => !cfRead(rel).includes("location.hostname === 'uchirecipe.com'"),
  )
  eq('CF-1 計測を入れたページは全部が本番のドメインでだけ鳴る', cfNoGuard, [])
  eq('CF-1 前提: 計測を入れているページがある（0枚なら見張りが空振り）', cfHasBeacon.length >= 11, true)

  // (c) 生成物 foods.html の直す先は生成スクリプト側（直しても gen を忘れると本番に出ない）
  eq(
    'CF-1 生成スクリプト側にもドメインの判定が入っている',
    cfRead('scripts/gen-food-price-page.mjs').includes("location.hostname === 'uchirecipe.com'"),
    true,
  )
}

// ==========================================================================================
// SEO の土台（2026-08-30）: 検索に載せたいページが sitemap から漏れていないか
//
// 2026-08-30 に実発: `about/foods.html`（食品と目安価格の一覧＝「◯◯ 値段 目安」と相性がよい）が
// sitemap から漏れていた。**生成物なので、作り直すたびに見落とされていた**。
// `robots.txt` も無く、sitemap の在り処を検索エンジンに伝えていなかった。
// ==========================================================================================
{
  const seoRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const seoRead = (rel) => readFileSync(path.join(seoRoot, rel), 'utf-8')
  const seoMap = seoRead('public/sitemap.xml')
  const seoLocs = [...seoMap.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1])
  eq('SEO-1 sitemap を読めている（0件なら見張りが壊れている）', seoLocs.length >= 9, true)

  eq(
    'SEO-1 robots.txt があり、sitemap の在り処を伝えている',
    seoRead('public/robots.txt').includes('Sitemap: https://uchirecipe.com/sitemap.xml'),
    true,
  )

  // noindex を付けていない公開ページは、全部 sitemap に載っている
  const seoPages = [
    ...readdirSync(path.join(seoRoot, 'public/about'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `about/${f}`),
    ...readdirSync(path.join(seoRoot, 'public/about/column'))
      .filter((f) => f.endsWith('.html'))
      .map((f) => `about/column/${f}`),
  ]
  const seoMissing = seoPages.filter((rel) => {
    if (seoRead(`public/${rel}`).includes('name="robots" content="noindex')) return false
    if (rel === 'about/unlock.html') return false // 買ったあとに読む案内。検索から来る人には用が無い
    const url = `https://uchirecipe.com/${rel}`
    return !seoLocs.includes(url) && !seoLocs.includes(url.replace('/index.html', '/'))
  })
  eq('SEO-1 検索に載せたい公開ページが sitemap から漏れていない', seoMissing, [])
}

// ==========================================================================================
// ART-1（2026-09-01）: **記事に書いた数は、全部「出どころ」を持つ**
//
// 2026-08-31 に実発: 司令部が書いたZenn記事の下書きに、**数字の誤りが4か所**あった。
//   ・「4,547件すべて緑だったが23件は素通り」→ 4,547 は直し切ったあとの数。**その瞬間は無かった**
//   ・「本当は4,547件走るはず」→ 実測は 4,540件
//   ・「素通り23件」→ 23件は1回目だけ。実際は3回で58件
//   ・「769→118件」→ 途中経過。**いまの値は37件で0ではない**
// **どれも司令部が気をつけていれば防げたものではなく、別の目（Fable）が読んだから見つかった。**
// オーナーは内容を検算できない（「私には指摘のしようがない」）ので、**機械で止める**。
//
// 決まり: `確認して/<記事>.md` に**2桁以上の数**を書いたら、
//        `確認して/<記事>.出どころ.md` の表に**その数と出どころ**が要る。
//        1桁（「1件だけ落ちた」など）は文の一部なので対象外。
// ==========================================================================================
{
  const artRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '../..', '確認して')
  const artFiles = existsSync(artRoot)
    ? readdirSync(artRoot).filter((f) => f.endsWith('.md') && !f.endsWith('.出どころ.md') && f !== 'README.md')
    : []
  eq('ART-1 前提: 確認してフォルダを読めている', existsSync(artRoot), true)

  const artNums = (text) => {
    let t = text
    const i = t.indexOf('---', 3)
    if (t.startsWith('---') && i > 0) t = t.slice(i + 3) // front matter を外す
    t = t.replace(/```[\s\S]*?```/g, '')                // コードは数えない
    t = t.replace(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g, '')    // 日付は数えない
    t = t.replace(/\d{4}年\d{1,2}月\d{1,2}日/g, '')
    const out = new Set()
    for (const m of t.matchAll(/(?<![\d,])([\d,]{2,})\s*(?=件|品|組|行|か所|回|日|字|分|円|種|本|コミット|人|秒)/g)) {
      out.add(m[1])
    }
    return out
  }

  const artMissing = []
  for (const f of artFiles) {
    const srcPath = path.join(artRoot, f.replace(/\.md$/, '.出どころ.md'))
    const nums = artNums(readFileSync(path.join(artRoot, f), 'utf-8'))
    if (nums.size === 0) continue // 数を書いていない読みものは対象外
    if (!existsSync(srcPath)) {
      artMissing.push(`${f}: 数を${nums.size}種 書いているのに「出どころ」の表が無い`)
      continue
    }
    const listed = new Set(
      [...readFileSync(srcPath, 'utf-8').matchAll(/^\| ([\d,]+) \|/gm)].map((m) => m[1]),
    )
    for (const n of [...nums].sort()) {
      if (!listed.has(n)) artMissing.push(`${f}: 「${n}」の出どころが表に無い`)
    }
  }
  eq('ART-1 記事に書いた数は、全部「出どころ」の表に載っている', artMissing, [])

  // ART-2（2026-09-01）: **目的を果たす仕掛けが、記事の中にあるか**
  //
  // オーナー指摘: 「どの用に流入を予定していますか？…アプリへの流れがわかりません」。
  // 司令部は「Zenn記事の目的は拡散と被リンク」と言いながら、**リンク0本・アプリ名0回**の記事を書いていた。
  // **数字も因果も正しいが、目的を果たさない記事**だった。ART-1 は「間違っていないか」しか見ていない。
  const artNoLink = []
  for (const f of artFiles) {
    const text = readFileSync(path.join(artRoot, f), 'utf-8')
    if (!/^title:/m.test(text)) continue // 外へ出す記事（front matter を持つもの）だけを見る
    if (!/https?:\/\//.test(text)) artNoLink.push(`${f}: 外向きのリンクが1本も無い`)
    if (!text.includes('うちレシピ')) artNoLink.push(`${f}: 作ったものの名前が1度も出てこない`)
  }
  eq('ART-2 外へ出す記事に、作ったものの名前と行き先がある', artNoLink, [])
}
