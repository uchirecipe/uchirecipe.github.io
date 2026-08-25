// 栄養価概算(M6-1)用: 文部科学省「日本食品標準成分表（八訂）増補2023年」の公式Excelから、
// scripts/nutrition-foods.mjs で指定した食品だけを抜き出して src/logic/nutritionData.ts を生成する。
//
// 実行: npx tsx scripts/build-nutrition.mjs
//   （2026-08-25 便KY で node → npx tsx に変えた。下の「身元の確かめ表」を作るのに
//     src/logic/kana.ts の材料名の正規化をそのまま使うため。外部ライブラリは要らないまま）
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
import { FOODS, NUTRITION_DB_VERSION, OTHER_FOODS } from './nutrition-foods.mjs'
// 材料名の正規化は実行時とまったく同じものを使う（ここで別に書くと必ず食い違う）
import { toIngredientKey } from '../src/logic/kana.ts'

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
// "14.0†"の「†」は、公式の凡例(備考欄)によると「規定法による測定値」を示す注記。
// 数値自体は有効なのでマーカーだけ落とす(2026-07-13 第2弾で食物繊維列を読むようになり遭遇)。
// 2026-07-28 便BY/NUT-04で確認: このファイル内で†が付くセルは 03032(還元水あめ)の3セルだけで、
// アプリはこの食品を使っていない。分析法(AOAC2011.25法かどうか)は成分値ではなく備考欄(BJ列)に
// 書かれており、†とは別物(以前のコメントは意味が逆だった)
function parseNutrientValue(raw) {
  if (raw === undefined || raw === null) return 0
  const s = String(raw).trim().replace(/[()†]/g, '')
  if (s === '' || s === 'Tr' || s === '-' || s === '*') return 0
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`成分値を数値化できません: "${raw}"`)
  return Math.round(n * 10) / 10 // 浮動小数の桁ゴミ(4.099999...)を小数1桁に整える
}

// ---------- 身元の確かめ表の作り方（2026-08-25 便KY） ----------

// 八訂の収載食品名「こむぎ ［小麦粉］ 薄力粉 １等」を語に割る
function officialNameTokens(name) {
  return name
    .replace(/[［\[\]］＜＞<>（）()]/g, ' ')
    .split(/[\s,、･・]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2)
}

// 100gあたりの値が「同じ数字」と言えるか。ここを超えたら1人分の表示が実際に変わる
// （八訂の食品群が違うときは、値が近くても「別の分類の食べ物」として扱う。
//   りんご酢(調味料17)とりんご(果実07)、麻婆豆腐(調理済み18)と木綿豆腐(豆04)のような組で、
//   アプリは食品群で野菜量を数えている＝logic/nutritionBalance.ts の VEGETABLE_GROUP_CODE ので、
//   群が違うまま当てると野菜量まで狂う）
function numbersDiffer(a, b) {
  const dk = Math.abs(a.kcal - b.kcal)
  if (dk > 30 && dk / Math.max(a.kcal, b.kcal, 1) > 0.3) return true
  if (Math.abs(a.saltG - b.saltG) > 2) return true
  if (Math.abs(a.proteinG - b.proteinG) > 5) return true
  if (Math.abs(a.fatG - b.fatG) > 5) return true
  return false
}

function buildOtherFoodNames(outFoods, byId) {
  // アプリが持っている食品番号（blendは「番号+番号」なので割って全部入れる）
  const ourIds = new Set()
  for (const f of outFoods) for (const id of String(f.id).split('+')) if (/^\d{5}$/.test(id)) ourIds.add(id)

  // 実行時と同じ索引（完全一致・部分一致）を組む
  const exact = new Map()
  for (const f of outFoods) for (const a of f.aliases) {
    const k = toIngredientKey(a)
    if (!exact.has(k)) exact.set(k, f)
  }
  const partialKeys = [...exact.keys()].filter((k) => k.length >= 3).sort((a, b) => b.length - a.length)
  const partialHit = (key) => {
    for (const p of partialKeys) if (key.includes(p)) return exact.get(p)
    return null
  }

  // 八訂の収載食品名の語 → その語を名乗る食品番号
  const idsByToken = new Map()
  for (const [id, food] of byId) {
    for (const t of officialNameTokens(food.name)) {
      if (!idsByToken.has(t)) idsByToken.set(t, new Set())
      idsByToken.get(t).add(id)
    }
  }

  const names = new Set()
  for (const [token, ids] of idsByToken) {
    if ([...ids].some((id) => ourIds.has(id))) continue // ①アプリが持っている食品の名前は塞がない
    const key = toIngredientKey(token)
    if (!key || exact.has(key)) continue // 別名として登録済みなら完全一致が先に当たる
    const hit = partialHit(key)
    if (!hit) continue // そもそも部分一致しないなら塞ぐ必要が無い
    // ②その名前を名乗るどの八訂の食品とも数字が合わないときだけ塞ぐ
    const hitGroup = String(hit.id).match(/\d{5}/)?.[0].slice(0, 2)
    const anyClose = [...ids].some(
      (id) =>
        (hitGroup === undefined || id.slice(0, 2) === hitGroup) &&
        !numbersDiffer(hit.per100g, byId.get(id).per100g),
    )
    if (anyClose) continue
    names.add(key)
  }

  // 八訂に収載が無いために機械では分からない分（手書き・理由つき）
  for (const entry of OTHER_FOODS ?? []) {
    if (!entry.note) throw new Error(`OTHER_FOODS「${entry.name}」: note(理由)が必須です`)
    const key = toIngredientKey(entry.name)
    if (exact.has(key)) throw new Error(`OTHER_FOODS「${entry.name}」はFOODSの別名と重なっています`)
    names.add(key)
  }
  return [...names].sort()
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
  // 2026-07-13 第2弾: 食物繊維(FIB-=総量,g)・鉄(FE,mg)・カルシウム(CA,mg)を追加
  const NEED = {
    kcal: 'ENERC_KCAL', protein: 'PROT-', fat: 'FAT-', carb: 'CHOCDF-', salt: 'NACL_EQ',
    fiber: 'FIB-', iron: 'FE', calcium: 'CA',
  }
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
        fiberG: parseNutrientValue(r[colOf[NEED.fiber]]),
        ironMg: parseNutrientValue(r[colOf[NEED.iron]]),
        calciumMg: parseNutrientValue(r[colOf[NEED.calcium]]),
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
      per100g = { kcal: 0, proteinG: 0, fatG: 0, carbG: 0, saltG: 0, fiberG: 0, ironMg: 0, calciumMg: 0 }
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

    // 食物繊維だけ別番号から採る例外(2026-07-28 便BY/NUT-04・じゃがいもの生↔加熱後)。
    // 採用元を必ずnoteに残して出典を追えるようにする
    let fiberNote
    if (def.fiberFrom) {
      if (def.custom || def.blend) throw new Error(`${def.label}: fiberFromはcustom/blendと併用できません`)
      const fiberHit = resolve(def.fiberFrom.id, def.fiberFrom.expect)
      per100g = { ...per100g, fiberG: fiberHit.per100g.fiberG }
      fiberNote = `食物繊維のみ ${def.fiberFrom.id}「${fiberHit.name}」から採用（${fiberHit.per100g.fiberG}g/100g）`
    }
    const note = [def.note, fiberNote].filter(Boolean).join(' / ') || undefined

    outFoods.push({
      id: mextId,
      label: def.label,
      mextName,
      aliases: def.aliases ?? [],
      ...(def.rawAliases ? { rawAliases: def.rawAliases } : {}),
      per100g,
      ...(def.unitGrams ? { unitGrams: def.unitGrams } : {}),
      ...(def.gramsPerMl ? { gramsPerMl: def.gramsPerMl } : {}),
      ...(note ? { note } : {}),
    })
  }

  // ---------- 5. 身元の確かめ表を作る（2026-08-25 便KY） ----------
  // 材料名のどこかに成分表の別名(3文字以上)が入っているだけで成分値を当てる「部分一致」は、
  // 日本語の複合語（別の食材名＋食材名）で別の食べ物に当たる（杏仁豆腐→木綿豆腐／りんご酢→りんご）。
  // 八訂に収載がある名前なら「別の食品だ」と機械で分かるので、公式Excelから洗い出して表にする。
  //
  // 表に入れる条件は2つとも満たすもの:
  //   ①その名前を名乗る八訂の食品を、アプリが1品も持っていない
  //   ②その名前を部分一致に通すと、**栄養の数字が実際に狂う**（下の numbersDiffer）
  // ②を付けているのは**塞ぎすぎないため**。値が同じなら当てても表示は変わらないので塞ぐ理由が無い
  // （「赤たまねぎ→玉ねぎ」「黒砂糖→砂糖」「かに風味かまぼこ→かまぼこ」は今までどおり当たる）。
  const otherFoodNames = buildOtherFoodNames(outFoods, byId)

  const data = {
    source: SOURCE_NAME,
    sourcePage: SOURCE_PAGE,
    sourceFile: SOURCE_XLSX,
    generatedAt: new Date().toISOString().slice(0, 10),
    dbVersion: NUTRITION_DB_VERSION,
    foods: outFoods,
    otherFoodNames,
  }

  const banner = `// このファイルは自動生成です。手で編集しないこと。
// 生成: npx tsx scripts/build-nutrition.mjs
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
  /** 食物繊維総量(g)。2026-07-13 第2弾で追加 */
  fiberG: number
  /** 鉄(mg) */
  ironMg: number
  /** カルシウム(mg) */
  calciumMg: number
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
  /**
   * 身元の確かめ表（2026-08-25 便KY）。**この名前には部分一致を使わない**。
   * 中身は「その名前を名乗る八訂の食品をアプリが1品も持っておらず、
   * 部分一致に通すと栄養の数字が実際に狂う」名前を、公式Excelから機械で洗い出したもの
   * （＋八訂に収載が無いため機械では分からないものを scripts/nutrition-foods.mjs の
   * OTHER_FOODS に理由つきで手書きした分）。材料名の正規化後の形で持つ。
   */
  otherFoodNames: string[]
}

export const NUTRITION_DATA: NutritionData = ${JSON.stringify(data, null, 2)}
`
  await writeFile(OUT_PATH, body)
  console.log(`生成: ${path.relative(process.cwd(), OUT_PATH)}（${outFoods.length}食品）`)
}

await main()
