// private/pro-codes-master.txt(scripts/generate-pro-codes.mjsが生成した原本・販売台帳)から
// 「まだ売れていない(行に「済」が付いていない)」コードだけを取り出し、
// KVにそのまま流し込めるJSON配列ファイル(private/pro-codes-pool.json)を作る。
//
// 実行: npx tsx workers/purchase-fulfill/scripts/build-pool-json.mjs
// (手順の全体は scripts/load-codes.md を参照。このスクリプト単体では何もKVに送信しない=安全)
//
// 出力先はリポジトリ(app/)の外(private/)なので、そのままではgit管理下に入らない
// (pro-codes-master.txtと同じ扱い。誤ってコミットする心配がない)。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const masterPath = path.join(__dirname, '..', '..', '..', '..', 'private', 'pro-codes-master.txt')
const outputPath = path.join(__dirname, '..', '..', '..', '..', 'private', 'pro-codes-pool.json')

const CODE_SHAPE_RE = /^UR-[A-Z0-9]{4}-[A-Z0-9]{4}$/

let text
try {
  text = await readFile(masterPath, 'utf8')
} catch {
  console.error(`原本が見つかりません: ${masterPath}`)
  console.error('先に scripts/generate-pro-codes.mjs でコードを生成しているか確認してください。')
  process.exit(1)
}

const codes = []
let skippedSold = 0
for (const rawLine of text.split(/\r?\n/)) {
  const line = rawLine.trim()
  if (!line || line.startsWith('#')) continue
  if (line.includes('済')) {
    skippedSold++
    continue
  }
  const code = line.split(/\s+/)[0]
  if (!CODE_SHAPE_RE.test(code)) {
    console.error(`想定外の形式の行をスキップしました: "${line}"`)
    continue
  }
  codes.push(code)
}

if (codes.length === 0) {
  console.error('未使用コードが1件も見つかりませんでした。処理を中止します。')
  process.exit(1)
}

await writeFile(outputPath, JSON.stringify(codes))
console.log(`未使用コード ${codes.length}件 を書き出しました: ${outputPath}`)
if (skippedSold > 0) console.log(`(「済」マーク済みで除外した行: ${skippedSold}件)`)
console.log('次は scripts/load-codes.md の手順どおり、このファイルをKVへアップロードしてください。')
