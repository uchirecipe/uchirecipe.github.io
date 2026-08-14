/** 便GL 作業中の絞り込み実行（e2e-smoke.mjs から GL ブロックだけを切り出して流す。作業後に削除） */
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.BASE_URL || 'http://localhost:4382'
const src = readFileSync(new URL('./scripts/e2e-smoke.mjs', import.meta.url), 'utf8')
const start = src.indexOf('  currentCheck = \'GL-01\'')
const end = src.indexOf('\n} catch (err) {', start)
if (start === -1 || end === -1) throw new Error('GL ブロックが見つからない')
const block = src.slice(start, end)

const results = []
const errors = []
let currentCheck = ''
const check = (label, pass, detail) => results.push({ label, pass: Boolean(pass), detail })
const ng = (label, detail) => results.push({ label, pass: false, detail })

const fn = new Function('chromium', 'BASE', 'check', 'ng', 'errors', 'currentCheck', `
  return (async () => {
    try {
${block}
    } catch (err) {
      ng('実行中断(' + currentCheck + ')', err.message)
    }
  })()
`)
await fn(chromium, BASE, check, ng, errors, currentCheck)

for (const r of results) console.log(`${r.pass ? 'OK ' : 'NG '} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`\n合格: ${results.filter((r) => r.pass).length}/${results.length}件 / console・pageerror: ${errors.length}件`)
for (const e of errors) console.log(`  ${e}`)
