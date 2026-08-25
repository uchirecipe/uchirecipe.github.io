// L1: 純ロジックの単体回帰テスト(docs/10 3章のL1追加候補①③⑤の常設化)。
// DOM・Dexie不要のロジックだけを対象にする。実行: npx tsx scripts/test-logic.mjs
// 新しいバグを直したら、必ずここに再発防止のケースを1行足すこと(PDCAの蓄積点)。
//
// 2026-08-26 便LA: 33,927行の1ファイルを、中身ごとに scripts/tests/*.mjs へ分けた。
// **検査の中身は1つも変えていない**（変えたのは「どのファイルに書いてあるか」だけ）。
// 分けた理由: 便が全員このファイルの末尾に足していたので、同じ日に2便以上走ると必ず競合していた
// （2026-08-25 だけで15回触られ、マージ競合が3回）。
//
// **新しい検査は、下の一覧から中身の合うファイルの末尾に足すこと。**
// 判定器(eq / neq)・合否の集計・結果の表示は scripts/tests/_harness.mjs にある。
// ソースを読む検査で使う app/ の位置も _harness.mjs（appRoot / scriptFileUrl）が1か所で持っている。
//
// 読み込む順番は分ける前の並びのまま。1つずつ await して読むのは、
// 節の中に `await import(...)` があるため——まとめて import すると読み込みが交互に進みうるので、
// 分ける前と同じ「上から順に1本で走る」形を保つ。
await import('./tests/amount.mjs')            // 分量と単位の読み取り
await import('./tests/import-paste.mjs')      // 貼り付けからの取り込み
await import('./tests/search-sort.mjs')       // 検索・絞り込み・並び替え
await import('./tests/settings-misc.mjs')     // 設定・お知らせ・共有・アプリ更新など
await import('./tests/meal-plan.mjs')         // 献立
await import('./tests/shopping-pantry.mjs')   // 買い物メモと在庫
await import('./tests/cooking-mode.mjs')      // 調理中モード
await import('./tests/cook-navi.mjs')         // 並行調理ナビ
await import('./tests/recipe-data.mjs')       // レシピ本体と記録
await import('./tests/backup-restore.mjs')    // バックアップと書き出し
await import('./tests/text-layout.mjs')       // 文言と表記の規律
await import('./tests/nutrition.mjs')         // 栄養
await import('./tests/price-cost.mjs')        // 価格と原価
await import('./tests/url-import.mjs')        // URLからの取り込み
await import('./tests/ui-source-guards.mjs')  // 画面のソースを読む見張り
await import('./tests/e2e-tools.mjs')         // e2eの道具そのものの検査(時計を合わせる道具)

// ---------- 結果 ----------
const { reportAndExit } = await import('./tests/_harness.mjs')
reportAndExit()
