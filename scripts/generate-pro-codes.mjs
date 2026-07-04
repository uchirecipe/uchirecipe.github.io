// Pro解錠コードを100個生成する。
// 実行: node scripts/generate-pro-codes.mjs
//
// 出力:
// - private/pro-codes-master.txt (リポジトリの外。原本・販売台帳。絶対にコミットしない)
// - src/logic/proCodes.ts (SHA-256ハッシュ配列のみ。原本は逆算不能なのでコミットしてよい)
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { randomBytes, createHash } from 'node:crypto'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const masterPath = path.join(__dirname, '..', '..', 'private', 'pro-codes-master.txt')
const hashesPath = path.join(__dirname, '..', 'src', 'logic', 'proCodes.ts')

const COUNT = 100
// 紛らわしい文字 0/O/1/I を除いた32文字(2の累乗なのでmod演算に偏りが出ない)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

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

const codes = new Set()
while (codes.size < COUNT) {
  codes.add(generateCode())
}
const codeList = [...codes]

await mkdir(path.dirname(masterPath), { recursive: true })
const masterContent =
  '# うちレシピ Pro解錠コード 原本・販売台帳\n' +
  '# 売れたらそのコードの行末に「済」を追記して管理する。このファイルは絶対に公開・コミットしないこと。\n\n' +
  codeList.join('\n') +
  '\n'
await writeFile(masterPath, masterContent)

const hashList = codeList.map(hashCode)
const hashesContent =
  '/** Pro解錠コードのSHA-256ハッシュ一覧。原本はリポジトリ外(private/pro-codes-master.txt)で管理 */\n' +
  'export const PRO_CODE_HASHES: string[] = [\n' +
  hashList.map((h) => `  '${h}',`).join('\n') +
  '\n]\n'
await writeFile(hashesPath, hashesContent)

console.log(`${COUNT}個のコードを生成しました`)
console.log(`原本: ${masterPath}`)
console.log(`ハッシュ: ${hashesPath}`)
