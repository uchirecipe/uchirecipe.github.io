// 栄養価概算(M6-1)用: 文部科学省「日本食品標準成分表（八訂）増補2023年」の公式Excelから、
// scripts/nutrition-foods.mjs で指定した食品だけを抜き出して src/logic/nutritionData.ts を生成する。
//
// 実行: node scripts/build-nutrition.mjs   （Node 24。外部ライブラリ不要）
//
// - 公式Excelは scripts/data/mext-honpyo-2023.xlsx にキャッシュする（無ければ自動ダウンロード。
//   バイナリなのでリポジトリにはコミットしない=.gitignore対象）
// - 成分値を手で書き写すことはせず、必ずこのスクリプト経由で公式ファイルから読み取る
//   （出典の追跡可能性と転記ミス防止のため。docs/09 M6-1「公式データ使用」条件）
// - 対応表の食品番号が公式の食品名と食い違う場合はビルドを失敗させる（expect照合）
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { inflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { FOODS, NUTRITION_DB_VERSION } from './nutrition-foods.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 出典（文科省の公開ページと、そこからリンクされている「第2章（データ）」のExcel）
const SOURCE_NAME = '日本食品標準成分表（八訂）増補2023年（文部科学省）'
const SOURCE_PAGE = 'https://www.mext.go.jp/a_menu/syokuhinseibun/mext_00001.html'
const SOURCE_XLSX = 'https://www.mext.go.jp/content/20260327-mxt_kagsei-mext-000029402_02.xlsx'

const CACHE_PATH = path.join(__dirname, 'data', 'mext-honpyo-2023.xlsx')
const OUT_PATH = path.join(__dirname, '..', 'src', 'logic', 'nutritionData.ts')

// ---------- 1. 公式Excelを用意する（キャッシュ優先） ----------
async function loadXlsx() {
  try {
    await access(CACHE_PATH)
    console.log(`キャッシュを使用: ${path.relative(process.cwd(), CACHE_PATH)}`)
  } catch {
    console.log(`公式Excelをダウンロード中: ${SOURCE_XLSX}`)
    const res = await fetch(SOURCE_XLSX)
    if (!res.ok) throw new Error(`ダウンロード失敗: HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 100000) throw new Error('ダウンロードしたファイルが小さすぎます（内容を確認してください）')
    await mkdir(path.dirname(CACHE_PATH), { recursive: true })
    await writeFile(CACHE_PATH, buf)
    console.log(`保存: ${path.relative(process.cwd(), CACHE_PATH)} (${buf.length} bytes)`)
  }
  return readFile(CACHE_PATH)
}

// ---------- 2. 最小限のzip(xlsx)リーダー ----------
// xlsxはzip書庫。End of Central Directoryから各エントリを辿り、deflate圧縮を展開する。
function unzip(buf) {
  // EOCDシグネチャ 0x06054b50 を末尾から探す
  let eocd = -1
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip形式ではありません(EOCDが見つからない)')
  const count = buf.readUInt16LE(eocd + 10)
  let offset = buf.readUInt32LE(eocd + 16)
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('セントラルディレクトリが壊れています')
    const method = buf.readUInt16LE(offset + 10)
    const compSize = buf.readUInt32LE(offset + 20)
    const nameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLen)
    entries.set(name, { method, compSize, localOffset })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return function read(name) {
    const e = entries.get(name)
    if (!e) throw new Error(`zip内に見つかりません: ${name}`)
    // ローカルヘッダを読んでデータ位置を求める
    const lh = e.localOffset
    if (buf.readUInt32LE(lh) !== 0x04034b50) throw new Error('ローカルヘッダが壊れています')
    const nameLen = buf.readUInt16LE(lh + 26)
    const extraLen = buf.readUInt16LE(lh + 28)
    const start = lh + 30 + nameLen + extraLen
    const data = buf.subarray(start, start + e.compSize)
    if (e.method === 0) return data.toString('utf8')
    if (e.method === 8) return inflateRawSync(data).toString('utf8')
    throw new Error(`未対応の圧縮方式: ${e.method}`)
  }
}

// ---------- 3. 「表全体」シートを読み取る ----------
function decodeXmlEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, '&')
}

function parseSharedStrings(xml) {
  const shared = []
  for (const [, si] of xml.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
    const clean = si.replace(/<rPh[\s\S]*?<\/rPh>/g, '') // ふりがな(phonetic)を除外
    const texts = [...clean.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodeXmlEntities(m[1]))
    shared.push(texts.join(''))
  }
  return shared
}

function parseSheetRows(xml, shared) {
  const rows = []
  for (const [, rowXml] of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = {}
    for (const m of rowXml.matchAll(
      /<c r="([A-Z]+)\d+"(?:[^>]*t="([^"]*)")?[^>]*>(?:<f>[\s\S]*?<\/f>)?(?:<v>([\s\S]*?)<\/v>)?<\/c>/g,
    )) {
      const [, col, type, v] = m
      if (type === 's' && v !== undefined) cells[col] = shared[Number(v)]
      else if (v !== undefined) cells[col] = decodeXmlEntities(v)
    }
    rows.push(cells)
  }
  return rows
}

// 成分値の表記ゆれを数値化する: "Tr"(微量)→0, "-"(未測定)→0, "(1.2)"(推計値)→1.2
function parseNutrientValue(raw) {
  if (raw === undefined || raw === null) return 0
  const s = String(raw).trim().replace(/[()]/g, '')
  if (s === '' || s === 'Tr' || s === '-' || s === '*') return 0
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`成分値を数値化できません: "${raw}"`)
  return Math.round(n * 10) / 10 // 浮動小数の桁ゴミ(4.099999...)を小数1桁に整える
}

async function main() {
  const buf = await loadXlsx()
  const read = unzip(buf)

  // 「表全体」シートのファイル名をworkbook relsから特定する
  const wb = read('xl/workbook.xml')
  const sheetMatch = wb.match(/<sheet name="表全体"[^>]*r:id="(rId\d+)"/)
  if (!sheetMatch) throw new Error('シート「表全体」が見つかりません（公式ファイルの構成が変わった可能性）')
  const rels = read('xl/_rels/workbook.xml.rels')
  const relMatch = rels.match(new RegExp(`Id="${sheetMatch[1]}"[^>]*Target="(worksheets/[^"]+)"`))
  if (!relMatch) throw new Error('シートの参照が解決できません')

  const shared = parseSharedStrings(read('xl/sharedStrings.xml'))
  const rows = parseSheetRows(read(`xl/${relMatch[1]}`), shared)

  // 「成分識別子」行から列位置を特定する（列の並び替えに追従できるように固定位置は使わない）
  const idRow = rows.find((r) => typeof r.D === 'string' && r.D.startsWith('成分識別子'))
  if (!idRow) throw new Error('成分識別子の行が見つかりません')
  const colOf = {}
  for (const [col, val] of Object.entries(idRow)) colOf[String(val).trim()] = col
  const NEED = { kcal: 'ENERC_KCAL', protein: 'PROT-', fat: 'FAT-', carb: 'CHOCDF-', salt: 'NACL_EQ' }
  for (const ident of Object.values(NEED)) {
    if (!colOf[ident]) throw new Error(`成分識別子 ${ident} の列が見つかりません`)
  }

  // 食品番号(B列・5桁) → {name, per100g} の索引を作る
  const byId = new Map()
  for (const r of rows) {
    const id = String(r.B ?? '').trim()
    if (!/^\d{5}$/.test(id)) continue
    const name = String(r.D ?? '').replace(/　/g, ' ').trim()
    byId.set(id, {
      name,
      per100g: {
        kcal: parseNutrientValue(r[colOf[NEED.kcal]]),
        proteinG: parseNutrientValue(r[colOf[NEED.protein]]),
        fatG: parseNutrientValue(r[colOf[NEED.fat]]),
        carbG: parseNutrientValue(r[colOf[NEED.carb]]),
        saltG: parseNutrientValue(r[colOf[NEED.salt]]),
      },
    })
  }
  console.log(`公式データ読み取り: ${byId.size}食品`)

  // 対応表の各食品を照合・抽出する
  function resolve(id, expect) {
    const hit = byId.get(id)
    if (!hit) throw new Error(`食品番号 ${id} が公式データにありません`)
    if (!hit.name.includes(expect)) {
      throw new Error(`食品番号 ${id} の照合失敗: 公式名「${hit.name}」に「${expect}」が含まれません（番号の書き間違い?）`)
    }
    return hit
  }

  const outFoods = []
  const seenLabels = new Set()
  for (const def of FOODS) {
    if (seenLabels.has(def.label)) throw new Error(`labelが重複: ${def.label}`)
    seenLabels.add(def.label)

    let per100g
    let mextName
    let mextId
    if (def.custom) {
      // 八訂に該当食品が一切無い(香料・エッセンス等)場合の例外ルート。公式データに基づかないため
      // note必須(でたらめ防止。推定の根拠を必ず書くこと)。id先頭に"custom:"を付けて出典が
      // 八訂ではないことをデータ上も分かるようにする。
      if (!def.note) throw new Error(`${def.label}: customはnote(推定根拠)が必須です`)
      per100g = { ...def.custom.per100g }
      mextName = def.custom.mextName
      mextId = `custom:${def.label}`
    } else if (def.blend) {
      const total = def.blend.reduce((s, b) => s + b.ratio, 0)
      if (Math.abs(total - 1) > 1e-9) throw new Error(`${def.label}: blendの比率合計が1ではありません`)
      const parts = def.blend.map((b) => ({ ...b, hit: resolve(b.id, b.expect) }))
      per100g = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, saltG: 0 }
      for (const p of parts) {
        for (const k of Object.keys(per100g)) per100g[k] += p.hit.per100g[k] * p.ratio
      }
      for (const k of Object.keys(per100g)) per100g[k] = Math.round(per100g[k] * 10) / 10
      per100g.kcal = Math.round(per100g.kcal)
      mextName = parts.map((p) => `${p.hit.name}(${p.ratio})`).join(' + ')
      mextId = def.blend.map((b) => b.id).join('+')
    } else {
      const hit = resolve(def.id, def.expect)
      per100g = { ...hit.per100g, kcal: Math.round(hit.per100g.kcal) }
      mextName = hit.name
      mextId = def.id
    }

    outFoods.push({
      id: mextId,
      label: def.label,
      mextName,
      aliases: def.aliases ?? [],
      ...(def.rawAliases ? { rawAliases: def.rawAliases } : {}),
      per100g,
      ...(def.unitGrams ? { unitGrams: def.unitGrams } : {}),
      ...(def.gramsPerMl ? { gramsPerMl: def.gramsPerMl } : {}),
      ...(def.note ? { note: def.note } : {}),
    })
  }

  const data = {
    source: SOURCE_NAME,
    sourcePage: SOURCE_PAGE,
    sourceFile: SOURCE_XLSX,
    generatedAt: new Date().toISOString().slice(0, 10),
    dbVersion: NUTRITION_DB_VERSION,
    foods: outFoods,
  }

  const banner = `// このファイルは自動生成です。手で編集しないこと。
// 生成: node scripts/build-nutrition.mjs
// 対応表(どの食品を載せるか): scripts/nutrition-foods.mjs
// 出典: ${SOURCE_NAME}
//       ${SOURCE_PAGE}
// 成分値は上記公式Excelの「表全体」シートから機械的に抽出したもの（可食部100gあたり）。
// Tr(微量)・-(未測定)は0として扱い、()付きの推計値はそのまま数値として使っている。
`
  const body = `${banner}
export interface NutritionPer100g {
  kcal: number
  proteinG: number
  fatG: number
  carbG: number
  saltG: number
}

export interface NutritionFood {
  /** 八訂の食品番号（blendの場合は "番号+番号"） */
  id: string
  /** アプリでの表示名 */
  label: string
  /** 公式の収載食品名（照合の証跡） */
  mextName: string
  /** この食品に名寄せする材料名（実行時にtoHiraganaで正規化して使う） */
  aliases: string[]
  /** 正規化前の完全一致だけで照合する別名（「鮭」vs「酒」のような衝突回避用） */
  rawAliases?: string[]
  /** 可食部100gあたりの成分値 */
  per100g: NutritionPer100g
  /** 単位1つあたりの重さ(g)。可食部の代表値による概算 */
  unitGrams?: Record<string, number>
  /** 1mlあたりの重さ(g)。ml/cc、および大さじ15ml/小さじ5ml/カップ200mlの換算に使う */
  gramsPerMl?: number
  note?: string
}

export interface NutritionData {
  source: string
  sourcePage: string
  sourceFile: string
  generatedAt: string
  dbVersion: number
  foods: NutritionFood[]
}

export const NUTRITION_DATA: NutritionData = ${JSON.stringify(data, null, 2)}
`
  await writeFile(OUT_PATH, body)
  console.log(`生成: ${path.relative(process.cwd(), OUT_PATH)}（${outFoods.length}食品）`)
}

await main()
