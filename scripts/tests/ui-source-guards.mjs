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
    const locks = (src.match(/useScrollLock\(/g) ?? []).length
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
    // 2026-08-26 便LH: 残る献立の有無で文を分けるのをやめ、1つにまとめた
    ['テンプレートを入れる', ja.mealPlan.templateApplyConfirm],
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
    'src/pages/RecipesPage.tsx',
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
      if (lkSrcText.includes(id)) continue
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
