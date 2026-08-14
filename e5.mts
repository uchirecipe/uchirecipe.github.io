import { buildCookTimeline } from './src/logic/cookNavi.ts'
import { starterDefs } from './src/db/starters.ts'
let id = 1
const recipes = starterDefs.map((d: any) => ({ id: id++, title: d.title, servings: d.servings, steps: d.steps, dishType: d.dishType, ingredients: d.ingredients }))
function lcg(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
const rnd = lcg(20260808)
const trips: any[] = []
const seen = new Set<string>()
while (trips.length < 500) {
  const idx = [0,0,0].map(() => Math.floor(rnd() * recipes.length))
  if (new Set(idx).size < 3) continue
  const key = idx.slice().sort((a,b)=>a-b).join(',')
  if (seen.has(key)) continue
  seen.add(key)
  trips.push(idx.map((i) => recipes[i]))
}
const solo = new Map<number, number>()
const soloOf = (r: any) => { if (!solo.has(r.id)) solo.set(r.id, buildCookTimeline([r]).totalMinutes); return solo.get(r.id)! }
let sum = 0
for (const t of trips) {
  const seq = t.reduce((a: number, r: any) => a + soloOf(r), 0)
  const par = buildCookTimeline(t).totalMinutes
  sum += ((seq - par) / seq) * 100
}
console.log('E5(同梱・500通り・この標本の作り方は監査と別なので絶対値は比較用):', (sum / trips.length).toFixed(2) + '%')
