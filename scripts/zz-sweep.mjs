// 合格ラインの主要2指標だけを素早く測る（同梱109品 500通り / 野生混合200通りは省略）
import { buildCookTimeline, buildCookPlan } from '../src/logic/cookNavi.ts'
import { starterDefs } from '../src/db/starters.ts'

let nextId = 1
const list = starterDefs.map((d) => ({
  id: nextId++, title: d.title, servings: d.servings, cookMinutes: d.cookMinutes,
  effortLevel: 'normal', tags: [], ingredients: d.ingredients, steps: d.steps,
  isFavorite: false, cookedLogs: [], createdAt: 0, updatedAt: 0,
}))

function lcg(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296)
}
function sampleTriples(l, count, seed) {
  const rnd = lcg(seed)
  const seen = new Set()
  const out = []
  let guard = 0
  while (out.length < count && guard++ < count * 50) {
    const idx = []
    while (idx.length < 3) {
      const n = Math.floor(rnd() * l.length)
      if (!idx.includes(n)) idx.push(n)
    }
    idx.sort((a, b) => a - b)
    const key = idx.join(',')
    if (seen.has(key)) continue
    seen.add(key)
    out.push(idx.map((n) => l[n]))
  }
  return out
}
const solo = new Map(list.map((r) => [r.id, buildCookTimeline([r]).totalMinutes]))
const trios = sampleTriples(list, 500, 20260808)
let gain = 0
let honest = 0
let seqSum = 0
let parSum = 0
for (const t of trios) {
  const par = buildCookTimeline(t).totalMinutes
  const seq = t.reduce((a, r) => a + solo.get(r.id), 0)
  gain += seq > 0 ? ((seq - par) / seq) * 100 : 0
  seqSum += seq
  parSum += par
  if (buildCookPlan(t).mode === 'sequential') honest++
}
console.log(
  `同梱109品500通り: 順${(seqSum / trios.length).toFixed(1)}分 ナビ${(parSum / trios.length).toFixed(1)}分 短縮${(gain / trios.length).toFixed(1)}% 正直表示${((honest / trios.length) * 100).toFixed(1)}%`,
)
