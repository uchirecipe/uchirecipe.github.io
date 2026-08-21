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
// 使い方:
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-part.mjs IZEDIT-01 IZTHEME-02
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-part.mjs '^IV'      （正規表現も可）
//   npx tsx scripts/e2e-part.mjs --list                 （節の名前と行の範囲を並べるだけ）
//
// この道具が守ること（切り出しの失敗を「緑」に化けさせないため）:
//   ①切り出しの土台（try / catch の目印・節の区切り）が見つからなければ、その場で落ちる
//   ②指定した名前に当たる節が1つも無ければ落ちる（0件で素通りしない）
//   ③走ったあとに、指定した名前の判定が1件も出ていなければ落ちる
//     （節は切り出せたのに中身が走らなかった、を見逃さない）
//   ④実行した節の名前と件数を必ず出す（後から「何を測ったのか」が分かる形にする）
// ==========================================================================================
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(__dirname, 'e2e-smoke.mjs')
// 相対import（../src/i18n/ja.ts など）を解かせるため、切り出したものは scripts/ の中に置く
const OUT = path.join(__dirname, 'e2e-part.tmp.mjs')

const die = (message) => {
  console.error(`e2e-part: ${message}`)
  process.exit(1)
}

const lines = readFileSync(SRC, 'utf-8').split('\n')
// 本体は「try {」から「} catch (err) {」まで。目印が動いたら黙って0件にせず落とす
const tryAt = lines.indexOf('try {')
const catchAt = lines.indexOf('} catch (err) {')
if (tryAt < 0 || catchAt < 0 || catchAt <= tryAt) {
  die(`scripts/e2e-smoke.mjs の切り出しの目印が見つかりません（try=${tryAt} catch=${catchAt}）`)
}

/**
 * 本体を「いちばん外側の { } の塊」で区切る。1つの塊が1つの節（節名を2つ以上持つ塊もある＝
 * IVCARD-02 → IVEDIT-03 → IVLOCK-04 のように、同じブラウザを使い回して続けて測るもの）。
 * 塊の直前に付いている「--- 節名: 説明 ---」のコメントも一緒に持っていく（何を測る節かが残る）。
 */
const blocks = []
for (let i = tryAt + 1; i < catchAt; i++) {
  if (lines[i] !== '  {') continue
  let end = i + 1
  while (end < catchAt && lines[end] !== '  }') end += 1
  if (end >= catchAt) die(`閉じていない節が ${i + 1} 行目にあります`)
  let start = i
  for (let k = i - 1; k > tryAt; k--) {
    const t = lines[k]
    if (/^\s*$/.test(t)) { if (start !== i) break; else continue }
    if (/^\s*(\/\/|currentCheck\s*=)/.test(t)) start = k
    else break
  }
  const body = lines.slice(start, end + 1).join('\n')
  const names = [...new Set([...body.matchAll(/currentCheck = '([^']+)'/g)].map((m) => m[1]))]
  blocks.push({ start: start + 1, end: end + 1, names, body })
  i = end
}
if (blocks.length === 0) die('節を1つも切り出せませんでした（e2e-smoke.mjs の書き方が変わった可能性）')

const args = process.argv.slice(2)
if (args.includes('--list') || args.length === 0) {
  for (const b of blocks) {
    console.log(`${String(b.start).padStart(6)}-${String(b.end).padEnd(6)} ${b.names.join(', ') || '(名前なし)'}`)
  }
  console.log(`\n節の数: ${blocks.length}`)
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
selected.sort((a, b) => a.start - b.start)

const picked = selected.flatMap((b) => b.names)
console.log(`切り出した節: ${picked.join(', ')}`)
console.log(`切り出した行: ${selected.map((b) => `${b.start}-${b.end}`).join(' ')}`)

const head = lines.slice(0, tryAt + 1)
const tail = lines.slice(catchAt)
const body = selected.flatMap((b) => [`  // ===== 切り出し: ${b.names.join(', ')} (${b.start}-${b.end}) =====`, b.body])
writeFileSync(OUT, [...head, ...body, ...tail].join('\n'))

let run
try {
  run = spawnSync('npx', ['tsx', OUT], { stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf-8' })
} finally {
  rmSync(OUT, { force: true })
}
const stdout = run.stdout ?? ''
process.stdout.write(stdout)

// 走ったあとの見張り（③④）: 判定の行を数え、指定した節の名前が本当に出ているかを確かめる
const results = stdout.split('\n').filter((l) => /^(OK|NG) /.test(l))
const countOf = (name) => results.filter((l) => l.includes(name)).length
console.log('\n--- e2e-part: 実行した節と件数 ---')
let missing = []
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
