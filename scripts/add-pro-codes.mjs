// Pro解錠コードを「追加で」発行する(2回目以降のバッチ)。
//
// 実行:
//   export PATH="$HOME/.local/node/bin:$PATH"
//   npx tsx scripts/add-pro-codes.mjs --count=100 --dry-run   … 何が起きるか見るだけ(書き込まない)
//   npx tsx scripts/add-pro-codes.mjs --count=100             … 実際に追加する
//
// scripts/generate-pro-codes.mjs との違い(ここが要点):
//   generate-pro-codes.mjs は「初回の100件を作る」スクリプトで、実行するたびに
//   private/pro-codes-master.txt と src/logic/proCodes.ts を**丸ごと作り直す**。
//   在庫の補充に使うと、それまでに販売したコードのハッシュが proCodes.ts から消え、
//   **購入済みのお客様のコードが解錠に使えなくなる**(取り返しがつかない)。
//   このスクリプトは既存の台帳を1行も消さず、**新しいぶんだけを末尾に足す**。
//
// このスクリプトが書き換えるもの:
//   1. private/pro-codes-master.txt … 末尾に「追加バッチ」の節を足す(既存行は触らない)
//   2. src/logic/proCodes.ts        … 台帳にある全コード + 新しいコードのハッシュに作り直す
//                                     (既存のハッシュが1つでも欠ける計算になったら中止する)
//   3. private/pro-codes-add-<日付>.json … 今回足したぶんだけのJSON配列(KVへ足すときに使う)
//
// private/ 配下はリポジトリの外なので、コミットされる心配はない。
// **原本 private/pro-codes-master.txt は絶対にコミットしないこと。**
//
// このあとの手順(順番が大事)は workers/purchase-fulfill/scripts/load-codes.md の
// 「在庫が減ってきたら(2回目以降のコード追加)」を参照。
// **先にアプリを本番へ出してからKVへ足す**(逆にすると、アプリがまだ知らないコードが
// お客様に渡り「コードが正しくありません」と出る)。
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomBytes, createHash } from 'node:crypto'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const masterPath = path.join(__dirname, '..', '..', 'private', 'pro-codes-master.txt')
const hashesPath = path.join(__dirname, '..', 'src', 'logic', 'proCodes.ts')

// e2e(UNLOCK-01)用の固定テストコード。generate-pro-codes.mjs と必ず同じ値にすること
const TEST_RESERVED_CODE = 'UR-96QS-2VSZ'
// 紛らわしい文字 0/O/1/I を除いた32文字(2の累乗なのでmod演算に偏りが出ない)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_SHAPE_RE = /^UR-[A-Z0-9]{4}-[A-Z0-9]{4}$/

function randomChar() {
  const [byte] = randomBytes(1)
  return ALPHABET[byte % ALPHABET.length]
}

function generateCode() {
  const chars = Array.from({ length: 8 }, randomChar).join('')
  return `UR-${chars.slice(0, 4)}-${chars.slice(4)}`
}

// logic/pro.ts の isValidProCode と必ず同じ正規化・ハッシュ手順にすること
function normalizeCode(code) {
  return code.normalize('NFKC').toUpperCase().trim()
}

function hashCode(code) {
  return createHash('sha256').update(`uchirecipe-pro:${normalizeCode(code)}`).digest('hex')
}

/** 台帳の本文から、書かれている順にコードを拾う(「済」「予約」の行も含めて全部) */
export function readLedgerCodes(text) {
  const codes = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const code = line.split(/\s+/)[0]
    if (CODE_SHAPE_RE.test(code)) codes.push(code)
  }
  return codes
}

/** proCodes.ts に載っているハッシュを拾う(取りこぼしの検査に使う) */
export function readExistingHashes(text) {
  return [...text.matchAll(/'([0-9a-f]{64})'/g)].map((m) => m[1])
}

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const countArg = args.find((a) => a.startsWith('--count='))
const count = countArg ? Number(countArg.slice('--count='.length)) : 100
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  console.error('--count= は1〜1000の整数で指定してください(既定100)')
  process.exit(1)
}

let masterText
try {
  masterText = await readFile(masterPath, 'utf8')
} catch {
  console.error(`原本(販売台帳)が見つかりません: ${masterPath}`)
  console.error('初回の発行は scripts/generate-pro-codes.mjs です。追加はこのスクリプトを使います。')
  process.exit(1)
}

const existingCodes = readLedgerCodes(masterText)
if (existingCodes.length === 0) {
  console.error('台帳からコードを1件も読み取れませんでした。中止します。')
  process.exit(1)
}

// 新しいコードを作る(台帳にある全コード・テスト用コードとは重複させない)
const known = new Set([...existingCodes, TEST_RESERVED_CODE])
const fresh = []
while (fresh.length < count) {
  const c = generateCode()
  if (known.has(c)) continue
  known.add(c)
  fresh.push(c)
}

// ハッシュ一覧は「台帳の全コード + 今回のぶん」で作り直す。
// 販売済み(「済」付き)のコードも必ず残す = 購入済みのお客様が解錠できなくならないため
const allCodes = [...existingCodes, ...fresh]
if (!allCodes.includes(TEST_RESERVED_CODE)) allCodes.push(TEST_RESERVED_CODE)
const nextHashes = allCodes.map(hashCode)

// 安全装置: いま proCodes.ts に載っているハッシュが1つでも欠ける計算なら中止する。
// (台帳を手で編集して行を消してしまった等の事故を、書き込む前に止める)
let currentHashes = []
try {
  currentHashes = readExistingHashes(await readFile(hashesPath, 'utf8'))
} catch {
  console.error(`${hashesPath} が読めませんでした。中止します。`)
  process.exit(1)
}
const nextSet = new Set(nextHashes)
const dropped = currentHashes.filter((h) => !nextSet.has(h))
if (dropped.length > 0) {
  console.error(`中止しました: いま有効なコードのうち ${dropped.length}件 がハッシュ一覧から消える計算です。`)
  console.error('販売済みのコードが解錠に使えなくなるため、書き込みを行いませんでした。')
  console.error(`原本(${masterPath})から行が消えていないか確認してください。`)
  process.exit(1)
}

const today = new Date()
const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
const addPath = path.join(__dirname, '..', '..', 'private', `pro-codes-add-${stamp}.json`)

const soldCount = masterText.split(/\r?\n/).filter((l) => /^UR-/.test(l.trim()) && /済/.test(l)).length
console.log('--- 追加の内容 ---')
console.log(`台帳にある既存コード: ${existingCodes.length}件(うち「済」= ${soldCount}件)`)
console.log(`今回あらたに作るコード: ${fresh.length}件`)
console.log(`ハッシュ一覧に載る合計: ${nextHashes.length}件(既存の${currentHashes.length}件はすべて残る)`)

if (dryRun) {
  console.log('\n--dry-run のため、ファイルは1つも書き換えていません。')
  console.log(`本番で実行すると次を書き換えます:\n  ${masterPath}\n  ${hashesPath}\n  ${addPath}`)
  process.exit(0)
}

// 1. 台帳の末尾に追加バッチの節を足す(既存の行はそのまま)
const appended =
  masterText.replace(/\s*$/, '\n') +
  `\n# --- 追加バッチ ${stamp}(${fresh.length}件) ---\n` +
  fresh.join('\n') +
  '\n'
await writeFile(masterPath, appended)

// 2. ハッシュ一覧を作り直す
const hashesContent =
  '/** Pro解錠コードのSHA-256ハッシュ一覧。原本はリポジトリ外(private/pro-codes-master.txt)で管理 */\n' +
  'export const PRO_CODE_HASHES: string[] = [\n' +
  nextHashes.map((h) => `  '${h}',`).join('\n') +
  '\n]\n'
await writeFile(hashesPath, hashesContent)

// 3. 今回のぶんだけのJSON(KVのプールへ足すときに使う)
await writeFile(addPath, JSON.stringify(fresh))

console.log('\n--- 書き換えました ---')
console.log(`台帳(追記): ${masterPath}`)
console.log(`ハッシュ  : ${hashesPath}`)
console.log(`追加分JSON: ${addPath}`)
console.log('\n次の順番で進めてください(workers/purchase-fulfill/scripts/load-codes.md の「在庫が減ってきたら」):')
console.log('  1. proCodes.ts をコミットして本番(main)へ出す ← 先にこれ')
console.log('  2. そのあとで KVのプールに追加分を足す')
console.log('  ※ 原本(pro-codes-master.txt)と追加分JSONは絶対にコミットしないこと')
