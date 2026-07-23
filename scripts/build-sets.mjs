// 配布レシピセットの原稿(src/sets/*.ts)を読み込み、public/sets/data/*.json を生成する。
// あわせて public/sets/manifest.json の各テーマの items(料理名+調理分数)も原稿から自動更新する
// (未解錠でもテーマの中身が見えるようにするため。手動同期は不要。2026-07-09ペルソナ第2波)。
// 実行: npx tsx scripts/build-sets.mjs
// 原稿には isFavorite・cookedLogs・searchWords・createdAt・updatedAt を書かない
// (取り込み時にimportRecipeSetが実際の値へ再構築するため、ここではダミー値で補完するだけでよい)。
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'sets', 'data')

// 新しいセットを追加したら、ここに import を1行足す
const sets = [
  await import('../src/sets/kintore.ts'),
  await import('../src/sets/pack07.ts'),
  await import('../src/sets/diet.ts'), // 第2弾 がまんしないダイエットごはん（2026-07-23公開）
  await import('../src/sets/summer.ts'), // 第8弾 夏のさっぱり和食（2026-07-23公開）
  await import('../src/sets/freezer.ts'), // 第16弾 下味冷凍・まとめ作り置き（2026-07-23公開）
]

await mkdir(outDir, { recursive: true })

for (const mod of sets) {
  const { SET_ID, SET_NAME, SET_VERSION, recipes: recipeDefs } = mod

  const recipes = recipeDefs.map((def) => ({
    ...def,
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  }))

  const file = {
    app: 'uchi-recipe',
    version: 1,
    exportedAt: new Date().toISOString(),
    setId: SET_ID,
    setName: SET_NAME,
    setVersion: SET_VERSION,
    recipes,
  }

  const outPath = path.join(outDir, `${SET_ID}.json`)
  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n')
  console.log(`生成: ${path.relative(process.cwd(), outPath)}（${recipes.length}品）`)
}

// マニフェスト(テーマ一覧)の items を原稿と同期する。
// タイトル・説明・追加日は手書きのまま維持し、items だけを上書きする
const manifestPath = path.join(__dirname, '..', 'public', 'sets', 'manifest.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf-8'))
for (const mod of sets) {
  const entry = (manifest.themes ?? []).find((t) => t.id === mod.SET_ID)
  if (!entry) {
    console.warn(`注意: manifest.json にテーマ「${mod.SET_ID}」の項目が無いため items を書けません（手動で1件追記してから再実行）`)
    continue
  }
  entry.items = mod.recipes.map((r) => ({ title: r.title, cookMinutes: r.cookMinutes }))
}
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`更新: ${path.relative(process.cwd(), manifestPath)}（テーマのitemsを原稿と同期）`)
