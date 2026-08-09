// KVのコードプールに「追加分だけ」を足したJSONを作る(2回目以降の在庫補充用)。
//
// 実行:
//   npx tsx workers/purchase-fulfill/scripts/merge-pool-json.mjs \
//     ../../../private/pool-now.json ../../../private/pro-codes-add-2026-08-09.json
//   (パスは app/ から見た相対でも絶対でもよい)
//
// 出力: private/pro-codes-pool.json(KVへ `wrangler kv key put pool --path` で流し込むファイル)
// このスクリプト単体では何もKVに送信しない(=安全)。
//
// なぜ build-pool-json.mjs をそのまま使わないか:
//   build-pool-json.mjs は台帳から「済」の付いていない行を集めてプールを**作り直す**。
//   台帳の「済」はオーナーが手で書き足す運用なので、**売れたのにまだ手で印を付けていない
//   コードが台帳上は未販売のまま**になっていることがある。その状態で作り直すと、
//   すでにお客様へ渡したコードがプールに戻り、別の人にも同じコードが配られる。
//   そのため補充では「いまKVに入っているプール」を土台にして、新しいぶんを後ろに足す。
//
// 安全のためにここで確かめること:
//   - どちらのファイルもコードの配列であること・形が UR-XXXX-XXXX であること
//   - 2つのファイルの間、およびそれぞれの中で重複が無いこと
//   - 追加分に、台帳で「済」「予約」「テスト」「無効」の注記が付いたコードが混ざっていないこと
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const privateDir = path.join(__dirname, '..', '..', '..', '..', 'private')
const masterPath = path.join(privateDir, 'pro-codes-master.txt')
const outputPath = path.join(privateDir, 'pro-codes-pool.json')

const CODE_SHAPE_RE = /^UR-[A-Z0-9]{4}-[A-Z0-9]{4}$/

const [currentArg, addArg] = process.argv.slice(2)
if (!currentArg || !addArg) {
  console.error('使い方: npx tsx workers/purchase-fulfill/scripts/merge-pool-json.mjs <いまのプール.json> <追加分.json>')
  console.error('いまのプールは次で取り出せます(--remote を必ず付ける):')
  console.error('  npx wrangler kv key get pool --namespace-id <id> --remote > ../../../private/pool-now.json')
  process.exit(1)
}

async function readCodeArray(file, label) {
  let raw
  try {
    raw = await readFile(path.resolve(file), 'utf8')
  } catch {
    console.error(`${label}が読めません: ${file}`)
    process.exit(1)
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.error(`${label}がJSONとして読めません: ${file}`)
    console.error('wrangler の出力をそのまま保存したファイルか確認してください。')
    process.exit(1)
  }
  if (!Array.isArray(parsed) || parsed.some((c) => typeof c !== 'string')) {
    console.error(`${label}が文字列の配列ではありません: ${file}`)
    process.exit(1)
  }
  const bad = parsed.filter((c) => !CODE_SHAPE_RE.test(c))
  if (bad.length > 0) {
    console.error(`${label}に想定外の形のコードが ${bad.length}件 あります。中止します。`)
    process.exit(1)
  }
  return parsed
}

const current = await readCodeArray(currentArg, 'いまのプール')
const add = await readCodeArray(addArg, '追加分')

// 台帳で「済」「予約」「テスト」「無効」が付いたコードは配ってはいけない
let blocked = new Set()
try {
  const masterText = await readFile(masterPath, 'utf8')
  for (const rawLine of masterText.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const code = line.split(/\s+/)[0]
    if (CODE_SHAPE_RE.test(code) && /済|予約|テスト|無効/.test(line)) blocked.add(code)
  }
} catch {
  console.error(`原本(販売台帳)が見つかりません: ${masterPath}`)
  console.error('台帳と突き合わせずにプールを書き換えるのは危険なため中止します。')
  process.exit(1)
}

const blockedInAdd = add.filter((c) => blocked.has(c))
if (blockedInAdd.length > 0) {
  console.error(`追加分に、台帳で「済/予約/テスト/無効」の注記が付いたコードが ${blockedInAdd.length}件 あります。中止します。`)
  process.exit(1)
}

const seen = new Set()
const merged = []
let duplicates = 0
for (const code of [...current, ...add]) {
  if (seen.has(code)) {
    duplicates++
    continue
  }
  seen.add(code)
  merged.push(code)
}

const blockedInCurrent = current.filter((c) => blocked.has(c))

await writeFile(outputPath, JSON.stringify(merged))
console.log(`いまのプール ${current.length}件 + 追加分 ${add.length}件 = 合計 ${merged.length}件 を書き出しました`)
console.log(`出力: ${outputPath}`)
if (duplicates > 0) console.log(`(重複していて1件にまとめたもの: ${duplicates}件)`)
if (blockedInCurrent.length > 0) {
  console.log(`⚠ いまのプールに、台帳で「済」等が付いたコードが ${blockedInCurrent.length}件 残っています。`)
  console.log('  お客様に渡したコードに手で「済」を付けたあと、KVから消し忘れている可能性があります。内容を確認してください。')
}
console.log('次は load-codes.md の「在庫が減ってきたら」に従って、このファイルをKVへ書き戻してください(--remote を忘れない)。')
