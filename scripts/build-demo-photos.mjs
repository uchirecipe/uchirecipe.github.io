// 月間画面のサンプルデモ（/#/month-demo）で「作った記録」の写真として使う画像を作るスクリプト。
// 入力: .demo-photos/<キー>.jpg （原本。リポジトリには置かない＝.gitignore）
// 出力: public/demo/*.webp （240px角・生成物はリポジトリにコミットする）
//
// 実行: export PATH="$HOME/.local/node/bin:$PATH" && npx tsx scripts/build-demo-photos.mjs
//
// ── 素材の出所（2026-08-03 便DL）──────────────────────────────────
// 素材はフリー素材サイト「ぱくたそ」（https://www.pakutaso.com/）の写真素材10枚。
// 説明書のスクリーンショット（scripts/shots-manual.mjs）と同じ素材元・同じ取り方。
//
// 利用規約の確認（https://www.pakutaso.com/userpolicy.html・規約の最終更新 2026-04-15 /
// 本文を読んで確認したのは 2026-08-03）。この10枚に効く条項だけ抜き出すと:
//   - 商用利用可。ただし「商品化して販売」は不可（＝素材をほぼそのままの状態で売る行為。
//     例に挙がっているのはカレンダー・ポストカード・ポスター・写真集・グッズ）。
//     ここでの使い方は、アプリのサンプル画面に敷く240px角のサムネイルで、写真を売っては
//     いないため素材利用の範囲。
//   - 「加工、合成、変形または変換して利用いただけます」＝切り出し・再圧縮は可。
//   - クレジット表記は「二次配布や本の装丁以外では必須ではない」。
//   - 正規の取得は「ぱくたその各素材ページから直接取得したもの」。下の手順はこれに沿っている。
//   - 禁止事項に「フリー素材を自動化されたプログラム等により体系的に収集・複製・蓄積する行為」
//     と「ネットワーク又はシステムなどに過度な負荷をかける行為」がある。
//     → **一括クロール・URLの直叩きによる量産・並列取得はしない**（下の手順を守ること）。
//   - 禁止事項に「フリー素材を直接リンクする利用」がある。
//     → ぱくたそのURLを参照せず、public/demo/ に置いた自前のファイルを配信している。
//   - 「二次配布について」＝素材を第三者が利用可能な状態で配布する場合は
//     Sサイズのみ・最大100枚・クレジット表記・規約の提示と同意の取得。
//     ここで配るのは素材そのものではなく **240px角に切り出して再圧縮した webp 10枚**
//     （Sサイズの800pxより小さい・枚数も10枚）で、二次配布の上限は下回っている。
//     原本（Sサイズのjpg）はリポジトリに置かない。
//     ※ アプリに同梱して配信する行為が二次配布に当たるかは解釈が分かれる。当たると読むなら
//       クレジット表記が要る。クレジットを出すかは対外表記＝オーナー判断（2026-08-03 時点で未定）。
//
// 取得方法（2026-08-03・オーナー承認済みの手順。以後も同じやり方で差し替えること）:
//   1. ぱくたそのトップページを開き、検索ボックスに料理名を打って検索する
//   2. 検索結果のサムネイルを見て、料理が合っているものを1枚選ぶ
//   3. その写真ページを開いて写真の中身を確認する
//   4. ページ内の「S 長辺 800 px ［ JPG ］」ダウンロードボタンをクリックして保存する
//   5. 次の1枚まで数秒あける
//   ※ 全面広告（Google Vignette）がボタンのクリックを横取りすることがある。
//      広告配信のリクエストを止めた状態（広告ブロッカー入りのブラウザと同じ）で操作する。
//
// 取得した10枚（すべて2026-08-03取得・Sサイズ長辺800px）:
//   curry       カレーライス   https://www.pakutaso.com/20251010299post-55605.html
//               「白いお皿に盛られた福神漬とカレーライス」
//   hamburg     ハンバーグ     https://www.pakutaso.com/20250535143post-54483.html
//               「鉄板の上に置かれたハンバーグと野菜の料理」
//   nikujaga    肉じゃが       https://www.pakutaso.com/20170358089post-10811.html
//               「旅館栄太郎の季節の煮物の炊き合わせ～かぼちゃと大根と筍」
//               ※ ぱくたそに肉じゃがの写真が無いため、見た目の近い和風の煮物で代用
//   salmon      鮭の塩焼き     https://www.pakutaso.com/20140412111post-4082.html
//               「レモンを添えた焼き魚の一皿」
//               ※ 鮭の塩焼きそのものが無いため、皿に盛った焼き魚で代用
//   mabo        麻婆豆腐       https://www.pakutaso.com/20250638167post-54632.html
//               「刻みネギをトッピングした熱々の手作り麻婆豆腐」
//   napolitan   ナポリタン     https://www.pakutaso.com/20260624173post-57583.html
//               「ベーコンとピーマンのナポリタン」
//   tonjiru     豚汁           https://www.pakutaso.com/20150952261post-6067.html
//               「豚汁に入った里芋と豆腐と豚肉の具だくさん和食料理」
//   karaage     鶏の唐揚げ     https://www.pakutaso.com/20250840216post-54866.html
//               「木皿に盛られた鶏の唐揚げ」
//   potatosalad ポテトサラダ   https://www.pakutaso.com/20200806227post-30280.html
//               「スーパーで買ってきたポテサラを食卓に並べた様子」
//               ※ ぱくたそのポテトサラダは惣菜パックの写真しか無い。容器が写り込まない
//                 ところまで寄せて切り出している（下の CROPS）
//   oyakodon    親子丼         https://www.pakutaso.com/20110604180post-307.html
//               「赤い椀に盛った生卵のせの親子丼」
//
// 原本を無くしたとき: 上のURLから同じ手順で取り直し、.demo-photos/<キー>.jpg として置く。
// キー名は src/logic/monthDemo.ts の DEMO_PHOTO_KEYS と一致させること。
// ────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/demo')
/** 原本の置き場。リポジトリには入れない（.gitignore） */
const PHOTO_DIR = process.env.DEMO_PHOTO_DIR ?? path.join(ROOT, '.demo-photos')
/** 出力サイズ。月カレンダーのセルは実機で約46px、レシピ行のサムネは28pxなので240pxで足りる */
const SIZE = 240

/** 作る画像のキー（src/logic/monthDemo.ts の DEMO_PHOTO_KEYS と対応） */
const KEYS = [
  'curry',
  'hamburg',
  'nikujaga',
  'salmon',
  'mabo',
  'napolitan',
  'tonjiru',
  'karaage',
  'potatosalad',
  'oyakodon',
]

/**
 * 中央を正方形に切ると料理が入りきらない写真だけ、切り出す位置を指定する。
 * 値は原本（長辺800px）での [左, 上, 一辺] px。指定が無いキーは中央から正方形に切る。
 */
const CROPS = {
  // 惣菜パックの容器が写り込まないところまで寄せる
  potatosalad: [260, 130, 240],
  // 器のふたが写り込まないよう、器の中身だけにする
  nikujaga: [60, 90, 440],
}

fs.mkdirSync(OUT_DIR, { recursive: true })

const missing = KEYS.filter((k) => !fs.existsSync(path.join(PHOTO_DIR, `${k}.jpg`)))
if (missing.length > 0) {
  console.error(`原本が見つかりません: ${missing.join(', ')}`)
  console.error(`置き場: ${PHOTO_DIR}（取り直し方はこのファイル冒頭のコメントを参照）`)
  console.error('public/demo/*.webp は書き換えずに終了します。')
  process.exit(1)
}

let total = 0
const rows = []
for (const key of KEYS) {
  const src = path.join(PHOTO_DIR, `${key}.jpg`)
  let image = sharp(src)
  const crop = CROPS[key]
  if (crop) {
    const [left, top, side] = crop
    image = image.extract({ left, top, width: side, height: side })
  }
  const webp = await image
    .resize(SIZE, SIZE, { fit: 'cover' })
    .webp({ quality: 72, effort: 6 })
    .toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${key}.webp`), webp)
  total += webp.length
  rows.push([key, webp.length, crop ? `切り出し指定 ${crop.join(',')}` : '中央から正方形'])
}

for (const [key, size, how] of rows) {
  console.log(`  ${key}.webp  ${(size / 1024).toFixed(1)}KB  ${how}`)
}
console.log(`合計 ${(total / 1024).toFixed(1)}KB / ${rows.length}枚`)
if (total > 200 * 1024) {
  console.error('合計が200KBを超えました（同梱サイズの上限）')
  process.exit(1)
}
