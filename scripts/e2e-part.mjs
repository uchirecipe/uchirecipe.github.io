// ==========================================================================================
// e2eの「節だけ」を切り出して走らせる道具（2026-08-22 便IZ で常設化）
//
// **これはフルe2e（scripts/e2e-smoke.mjs の全体・`npm run test:e2e`）の代わりにはならない。**
// 節どうしの繋がり（前の節が作った端末の中身を次の節が使う、画面の状態が持ち越される）は
// 切り出すと再現しないので、ここが緑でも全体が緑とは限らない。
// 使いどころは「直している最中に、関係する節だけを何度も当てる」ことだけで、
// 統合前・本番前の判定は必ずフルe2eを1本流して行う（同時に2本走らせない・CLAUDE.md 規約E-⑤）。
//
// なぜ常設にしたか: 便IW・便IV・便IZ がそれぞれ同じ道具を scratchpad に書き直していた
// （毎回作り直し＝そのたびに「切り出せていないのに0件で緑」を作り込む危険がある）。
//
// --- 2026-08-26 便LC（docs/74 第2手）で作り直した ---
// e2e が 54,483行の1ファイルから「入口 scripts/e2e-smoke.mjs ＋ 節のファイル scripts/e2e/*.mjs」へ
// 分かれたので、**切り出しの土台を「入口が持っている節のファイルの一覧」に置き換えた**。
// 節のファイルは分ける前の字下げのままなので、その中の `  { … }` の塊＝1つの節の区切りは
// 今までと同じように使える。
//
// あわせて**取りこぼしを1つ直した**（便LBが実測して見つけた）: 節の直前にある
// `let nutritionPanelLabels = []` のような**宣言の行を拾えず**、NUTSORT-02 が
// 「実行中断（nutritionPanelLabels is not defined）」になっていた。
// 塊の手前を遡るときに、コメントと `currentCheck =` に加えて **`let` / `const` / `var` の行**も
// 一緒に持ってくる（宣言だけ手前に置いて、中身は塊の中で入れる書き方がいくつかある）。
//
// 使い方:
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-part.mjs IZEDIT-01 IZTHEME-02
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-part.mjs '^IV'      （正規表現も可）
//   npx tsx scripts/e2e-part.mjs --list                 （節の名前と、どのファイルの何行目かを並べるだけ）
//
// この道具が守ること（切り出しの失敗を「緑」に化けさせないため）:
//   ①切り出しの土台（入口の節のファイルの一覧・try / catch の目印・節の区切り）が
//     見つからなければ、その場で落ちる
//   ②指定した名前に当たる節が1つも無ければ落ちる（0件で素通りしない）
//   ③走ったあとに、指定した名前の判定が1件も出ていなければ落ちる
//     （節は切り出せたのに中身が走らなかった、を見逃さない）
//   ④実行した節の名前と件数を必ず出す（後から「何を測ったのか」が分かる形にする）
//
// **切り出せない節が在ること自体は構わない。**（例: ABOUT-01 は前の節が開いた画面を引き継ぐので、
// 単独で切り出すと落ちる。TOAST-01 のように節の外に直書きされているものは、そもそも塊になって
// いないので選べない。）ただし**そのときは必ず③で赤くなる**＝緑には化けない。
// ==========================================================================================
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ENTRY = path.join(__dirname, 'e2e-smoke.mjs')
// 相対import（./e2e/_shared.mjs や ../src/i18n/ja.ts）を解かせるため、切り出したものは scripts/ の中に置く
const OUT = path.join(__dirname, 'e2e-part.tmp.mjs')

const die = (message) => {
  console.error(`e2e-part: ${message}`)
  process.exit(1)
}

// --- ① 土台その1: 入口の形（節のファイルの一覧・try / catch の目印）。動いたら黙って0件にせず落とす
const entryLines = readFileSync(ENTRY, 'utf-8').split('\n')
const IMPORT_LINE = /^\s*await import\('\.\/e2e\/([\w-]+)\.mjs'\)/
const partFiles = entryLines.flatMap((line) => {
  const m = line.match(IMPORT_LINE)
  return m ? [m[1]] : []
})
if (partFiles.length === 0) {
  die("scripts/e2e-smoke.mjs に節のファイルの読み込み（await import('./e2e/….mjs')）が1つも見つかりません")
}
const tryAt = entryLines.indexOf('try {')
const catchAt = entryLines.indexOf('} catch (err) {')
if (tryAt < 0 || catchAt < 0 || catchAt <= tryAt) {
  die(`scripts/e2e-smoke.mjs の切り出しの目印が見つかりません（try=${tryAt} catch=${catchAt}）`)
}

/**
 * 節のファイルを「いちばん外側の { } の塊」で区切る。1つの塊が1つの節（節名を2つ以上持つ塊もある＝
 * IVCARD-02 → IVEDIT-03 → IVLOCK-04 のように、同じブラウザを使い回して続けて測るもの）。
 * 塊の直前に付いている「--- 節名: 説明 ---」のコメント・`currentCheck =`・
 * **`let` / `const` / `var` の宣言**も一緒に持っていく（何を測る節かが残り、宣言も欠けない）。
 */
const blocks = []
for (const file of partFiles) {
  const full = path.join(__dirname, 'e2e', `${file}.mjs`)
  if (!existsSync(full)) die(`入口が読もうとしているファイルがありません: scripts/e2e/${file}.mjs`)
  const lines = readFileSync(full, 'utf-8').split('\n')
  const head = lines.indexOf("import './_shared.mjs'")
  if (head < 0) die(`scripts/e2e/${file}.mjs に共有の道具の読み込み（import './_shared.mjs'）がありません`)
  for (let i = head + 1; i < lines.length; i++) {
    if (lines[i] !== '  {') continue
    let end = i + 1
    while (end < lines.length && lines[end] !== '  }') end += 1
    if (end >= lines.length) die(`閉じていない節が scripts/e2e/${file}.mjs の ${i + 1} 行目にあります`)
    let start = i
    for (let k = i - 1; k > head; k--) {
      const t = lines[k]
      if (/^\s*$/.test(t)) { if (start !== i) break; else continue }
      if (/^\s*(\/\/|currentCheck\s*=|let\s|const\s|var\s)/.test(t)) start = k
      else break
    }
    const body = lines.slice(start, end + 1).join('\n')
    const names = [...new Set([...body.matchAll(/currentCheck = '([^']+)'/g)].map((m) => m[1]))]
    blocks.push({ file, start: start + 1, end: end + 1, names, body })
    i = end
  }
}
if (blocks.length === 0) die('節を1つも切り出せませんでした（節のファイルの書き方が変わった可能性）')

const args = process.argv.slice(2)
if (args.includes('--list') || args.length === 0) {
  for (const b of blocks) {
    console.log(
      `${b.file.padEnd(28)} ${String(b.start).padStart(5)}-${String(b.end).padEnd(5)} ${b.names.join(', ') || '(名前なし)'}`,
    )
  }
  console.log(`\n節の塊: ${blocks.length}個 / 節のファイル: ${partFiles.length}本`)
  console.log('※ 塊になっていない直書きの節（SMK-01・TOAST-01 など）はここには出ない＝単独では選べない')
  if (args.length === 0) die('走らせる節の名前を指定してください（例: npx tsx scripts/e2e-part.mjs IZEDIT-01）')
  process.exit(0)
}

// 指定は「節名そのもの」または正規表現。1つでも当たらないものがあれば落とす（②）
const selected = []
for (const arg of args) {
  const re = new RegExp(arg)
  const hit = blocks.filter((b) => b.names.some((n) => re.test(n)))
  if (hit.length === 0) {
    die(`「${arg}」に当たる節がありません。使える名前は --list で見られます`)
  }
  for (const b of hit) if (!selected.includes(b)) selected.push(b)
}
// 入口に並んでいる順（＝分ける前の並び）を保つ
selected.sort((a, b) => partFiles.indexOf(a.file) - partFiles.indexOf(b.file) || a.start - b.start)

const picked = selected.flatMap((b) => b.names)
console.log(`切り出した節: ${picked.join(', ')}`)
console.log(`切り出した場所: ${selected.map((b) => `${b.file}:${b.start}-${b.end}`).join(' ')}`)

// 入口の前置き（共有の道具の読み込み）と後始末・結果の出し方はそのまま使い、
// 節のファイルの読み込みだけを、切り出した塊の中身に差し替える
// （字下げが分ける前のままなので、try { } の中へそのまま置ける）
const head = entryLines.slice(0, tryAt + 1)
const tail = entryLines.slice(catchAt)
const body = selected.flatMap((b) => [
  `  // ===== 切り出し: ${b.names.join(', ')} (${b.file}:${b.start}-${b.end}) =====`,
  b.body,
])
writeFileSync(OUT, [...head, ...body, ...tail].join('\n'))

let run
try {
  // 2026-08-26: 入口の末尾に「判定の件数が前より少なければ落とす」見張りを足した。
  // **節だけ走らせるこの道具では必ず少なくなる**ので、そこだけ外す目印を渡す
  // （見張りの狙いは『フルe2eが途中で実行中断していないか』なので、部分実行には効かせない）。
  run = spawnSync('npx', ['tsx', OUT], {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf-8',
    env: { ...process.env, E2E_PART: '1' },
  })
} finally {
  rmSync(OUT, { force: true })
}
const stdout = run.stdout ?? ''
process.stdout.write(stdout)

// 走ったあとの見張り（③④）: 判定の行を数え、指定した節の名前が本当に出ているかを確かめる
const results = stdout.split('\n').filter((l) => /^(OK|NG) /.test(l))
const countOf = (name) => results.filter((l) => l.includes(name)).length
console.log('\n--- e2e-part: 実行した節と件数 ---')
const missing = []
for (const name of picked) {
  const n = countOf(name)
  console.log(`  ${name}: ${n}件`)
  if (n === 0) missing.push(name)
}
console.log(`  合計: ${results.length}件（NG ${results.filter((l) => l.startsWith('NG ')).length}件）`)
console.log('※ これはフルe2eの代わりにはならない（節どうしの繋がりは再現しない）')
if (results.length === 0) die('判定が1件も出ませんでした（切り出しに失敗しています）')
if (missing.length > 0) die(`次の節の判定が1件も出ませんでした: ${missing.join(', ')}`)
process.exit(run.status === 0 ? 0 : 1)
