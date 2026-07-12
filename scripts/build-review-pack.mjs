// docs/12_基本レシピ増枠_原稿.md を解析し、レビュー用のレシピセットJSON(setIdなし=課金ゲート対象外)を生成する。
// 最終実装用ではなく、ユーザーが開発環境のアプリ上で内容を確認するためのレビューコピー
// (開発サーバー起動中に #/settings?set=review を開くとワンタップで41品取り込める)。
// 出力先はgitignore済みで、本番には決して混入しない。lint-recipes.mjsもこのJSONを自動で対象に含める。
// 実行: npx tsx scripts/build-review-pack.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
// 対象原稿: docs/18(第8弾+だし→review8.json)・docs/19(第2弾)・docs/21(第16弾)。同じ記法なのでまとめて生成する
// (docs/12は2026-07-12に本体へ実装済みのためTARGETSから除外・review.jsonも削除)
const TARGETS = [
  { doc: '18_第8弾_夏のさっぱり和食_原稿.md', out: 'review8.json' },
  { doc: '19_第2弾_がまんしないダイエットごはん_原稿.md', out: 'review2.json' },
  { doc: '21_第16弾_下味冷凍_原稿.md', out: 'review16.json' },
]

// 「### 1. タイトル」〜次の「### 」または「## 」の手前までを1レシピブロックとする
function parseBlocks(md) {
  const lines = md.split('\n')
  const blocks = []
  let current = null
  for (const line of lines) {
    const h3 = line.match(/^### \d+\.\s*(.+?)\s*$/)
    if (h3) {
      if (current) blocks.push(current)
      current = { title: h3[1].trim(), lines: [] }
      continue
    }
    if (/^## /.test(line)) {
      if (current) blocks.push(current)
      current = null
      continue
    }
    if (current) current.lines.push(line)
  }
  if (current) blocks.push(current)
  return blocks
}

// R12(2026-07-11): 原稿の1行記法ではmemo内の改行を literal「\n」で書く。ここで実改行へ変換する
function unescapeNewlines(s) {
  return s.replace(/\\n/g, '\n')
}

function cleanTitle(t) {
  // 「（第1弾パック「〜」差替用）」のような注記を除去
  return t.replace(/[（(][^（）()]*(パック|差替)[^（）()]*[）)]/g, '').trim()
}

function splitTopLevel(text, sep) {
  // 括弧の中は区切らない（材料memo内の「・」「、」等を誤分割しないため）
  const parts = []
  let depth = 0
  let buf = ''
  for (const ch of text) {
    if (ch === '(' || ch === '（' || ch === '[') depth++
    if (ch === ')' || ch === '）' || ch === ']') depth--
    if (ch === sep && depth === 0) {
      parts.push(buf)
      buf = ''
    } else {
      buf += ch
    }
  }
  if (buf) parts.push(buf)
  return parts
}

function parseIngredientToken(token) {
  let t = token.trim()
  let group
  const groupMatch = t.match(/\[(?:seasoningGroup|group):(\d+)\]\s*$/)
  if (groupMatch) {
    group = Number(groupMatch[1])
    t = t.slice(0, groupMatch.index).trim()
  }
  let memo
  const memoMatch = t.match(/\(材料memo:\s*(.+?)\)\s*$/)
  if (memoMatch) {
    memo = unescapeNewlines(memoMatch[1].trim())
    t = t.slice(0, memoMatch.index).trim()
  }
  // 「名前 数量 単位」の空白区切り(全角スペースも許容)。名前に半角/全角括弧の食材注記・ふりがなが付くことがある
  const m = t.match(/^(\S+(?:[ 　]?[（(][^）)]*[）)])?)\s*(?:[ 　]+(\S.*))?$/)
  const name = (m ? m[1] : t).trim()
  const rest = m && m[2] ? m[2].trim() : ''
  let amount = ''
  let unit = ''
  if (rest) {
    const qm = rest.match(/^([0-9./]+)\s*(.*)$/)
    if (qm) {
      amount = qm[1]
      unit = qm[2].trim()
    } else {
      amount = rest
    }
  }
  const ing = { name, amount, unit }
  if (memo) ing.memo = memo
  if (group) ing.seasoningGroup = group
  return ing
}

function parseHeader(text) {
  const out = {}
  const servings = text.match(/servings:\s*(\d+)/)
  const cookMinutes = text.match(/cookMinutes:\s*(\d+)/)
  const effortLevel = text.match(/effortLevel:\s*(\w+)/)
  const tags = text.match(/tags:\s*(.+?)\s*\//)
  const season = text.match(/season:\s*(\w+)/)
  // suitableForは末尾に「 / keywords: ...」が続くことがあるため、そこで打ち切る(無ければ改行/文末まで)
  const suitableFor = text.match(/suitableFor:\s*([^\n]+?)(?=\s*\/\s*keywords:|\n|$)/)
  const keywords = text.match(/keywords:\s*([^\n]+)/)
  if (servings) out.servings = Number(servings[1])
  if (cookMinutes) out.cookMinutes = Number(cookMinutes[1])
  if (effortLevel) out.effortLevel = effortLevel[1]
  if (tags) out.tags = tags[1].split(/[・、]/).map((s) => s.trim()).filter(Boolean)
  if (season) out.season = season[1]
  const slotMap = { 朝: 'breakfast', 昼: 'lunch', 夜: 'dinner' }
  if (suitableFor) {
    out.suitableFor = suitableFor[1]
      .split(/[・、]/)
      .map((s) => slotMap[s.trim()])
      .filter(Boolean)
  }
  if (keywords) {
    out.keywords = keywords[1].split(/[・、]/).map((s) => s.trim()).filter(Boolean)
  }
  return out
}

function parseStepLine(raw) {
  let t = raw.replace(/^\s*\d+\.\s*/, '').trim()
  let minutes
  let memo
  // 末尾の (Nmin)  / (Nmin／手順memo: ...) / (手順memo: ...) を取り出す
  const trailing = t.match(/\s*\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/)
  if (trailing) {
    const inner = trailing[1]
    const minMatch = inner.match(/^(\d+)分/)
    const memoMatch = inner.match(/手順memo:\s*(.+)$/)
    if (minMatch) minutes = Number(minMatch[1])
    if (memoMatch) memo = unescapeNewlines(memoMatch[1].trim())
    if (minMatch || memoMatch) t = t.slice(0, trailing.index).trim()
  }
  const step = { text: t }
  if (minutes) step.minutes = minutes
  if (memo) step.memo = memo
  return step
}

for (const target of TARGETS) {
  const docPath = path.join(__dirname, '..', '..', 'docs', target.doc)
  const outPath = path.join(__dirname, '..', 'public', 'sets', 'data', target.out)
  const md = readFileSync(docPath, 'utf-8')
  const blocks = parseBlocks(md)

  const recipes = []
  for (const block of blocks) {
  const text = block.lines.join('\n')
  const header = parseHeader(text)

  const ingLineMatch = text.match(/^-\s*材料\([^)]*\):\s*(.+)$/m)
  const ingredients = ingLineMatch
    ? splitTopLevel(ingLineMatch[1], '／').map(parseIngredientToken).filter((i) => i.name)
    : []

  const stepsBlockMatch = text.match(/-\s*手順:\n((?:\s*\d+\.\s.+\n?)+)/)
  const steps = []
  if (stepsBlockMatch) {
    for (const line of stepsBlockMatch[1].split('\n')) {
      if (/^\s*\d+\.\s/.test(line)) steps.push(parseStepLine(line))
    }
  }

  const memoMatch = text.match(/^-\s*レシピmemo:\s*(.+)$/m)

  recipes.push({
    title: cleanTitle(block.title),
    servings: header.servings ?? 2,
    cookMinutes: header.cookMinutes,
    effortLevel: header.effortLevel ?? 'easy',
    tags: header.tags ?? [],
    season: header.season ?? 'all',
    ...(header.suitableFor && header.suitableFor.length ? { suitableFor: header.suitableFor } : {}),
    ...(header.keywords && header.keywords.length ? { keywords: header.keywords } : {}),
    ingredients,
    steps,
    ...(memoMatch ? { memo: unescapeNewlines(memoMatch[1].trim()) } : {}),
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  })
}

  const file = {
    app: 'uchi-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    // setIdをあえて付けない: 課金ゲート(hasPaidRecipeAccess)の対象外にするため(レビュー専用)
    recipes,
  }

  mkdirSync(path.dirname(outPath), { recursive: true })
  writeFileSync(outPath, JSON.stringify(file, null, 2) + '\n')
  console.log(`生成: ${outPath}（${recipes.length}品）`)
  for (const r of recipes) {
    console.log(`  - ${r.title}（材料${r.ingredients.length}・手順${r.steps.length}）`)
  }
}
