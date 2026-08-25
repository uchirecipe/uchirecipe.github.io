// 検査の共通の道具（判定器・合否の集計・最後の結果表示）。
// 2026-08-26 便LA が scripts/test-logic.mjs から**そのまま**出したもので、判定のしかたは1つも変えていない。
//
// ここには「検査そのもの」を書かない。検査は scripts/tests/<中身の名前>.mjs に書く。
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * 検査が読むファイル（src/… や scripts/data/… ）の位置を決める起点。
 *
 * 分ける前は各節が `import.meta.url`（＝ scripts/test-logic.mjs の場所）から相対で数えていた。
 * 検査を scripts/tests/ へ移すと `import.meta.url` が1つ深くなって全部ずれるので、
 * **元の場所の値を1か所で持ち**、各節の `import.meta.url` をこれに置き換えてある。
 * これで `'../src/…'` `'./data/…'` のような書き方が分ける前とそのまま同じ意味になる。
 */
export const scriptFileUrl = new URL('../test-logic.mjs', import.meta.url).href

/** app/ の場所。新しい検査はこれを読めばよい（各節が同じ式を書き写さなくて済む） */
export const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')

let passed = 0
const failures = []
export function eq(label, actual, expected) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    passed++
  } else {
    failures.push(`${label}: 実際=${a} 期待=${e}`)
  }
}

/** 「同じであってはいけない」検査(名寄せキーが別食材どうしでぶつかっていないか等) */
export function neq(label, actual, notExpected) {
  if (JSON.stringify(actual) !== JSON.stringify(notExpected)) {
    passed++
  } else {
    failures.push(`${label}: 実際=${JSON.stringify(actual)} 期待=これ以外`)
  }
}

/** 結果を出して終わる。scripts/test-logic.mjs が最後に1回だけ呼ぶ */
export function reportAndExit() {
  console.log(`合格: ${passed}件 / 失敗: ${failures.length}件`)
  for (const f of failures) console.log(`  NG ${f}`)
  process.exit(failures.length > 0 ? 1 : 0)
}
