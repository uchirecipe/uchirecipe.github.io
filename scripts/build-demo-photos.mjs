// 月間画面のサンプルデモ（/#/month-demo）で「作った記録」の写真として使う画像を作るスクリプト。
// 出力: public/demo/*.webp （生成物はリポジトリにコミットする）
//
// 実行: export PATH="$HOME/.local/node/bin:$PATH" && npx tsx scripts/build-demo-photos.mjs
//
// ── 素材の出所について（2026-08-02 便DC）─────────────────────────────
// ここで作る画像は、このスクリプトが描いている**自前のイラスト**で、第三者の写真素材は
// 一切使っていない（＝権利者への確認・クレジット表記・再配布条件のいずれも発生しない）。
//
// 説明書のスクリーンショット撮影（scripts/shots-manual.mjs）ではフリー素材サイト「ぱくたそ」
// （https://www.pakutaso.com/）の料理写真を使っているが、次の2点からアプリ本体に同梱する
// 素材としては採用しなかった。オーナー判断が要る論点なので、判断がつくまでは自前イラストで動かす。
//   1. ぱくたその利用規約（https://www.pakutaso.com/userpolicy.html・2026-08-02 確認）は
//      商用利用可・加工可・クレジット表記は原則不要だが、禁止事項に
//      「フリー素材を自動化されたプログラム等により体系的に収集・複製・蓄積する行為」がある。
//      この便がスクリプトで素材を取得するのは、その禁止事項に触れる。
//   2. 同規約の「二次配布について」は、素材を第三者が利用可能な状態で配布する場合に
//      Sサイズのみ・最大100枚・クレジット表記・規約の提示と同意の取得を求めている。
//      アプリの配信ファイルに素材そのものを同梱する行為がこれに当たるかは解釈が分かれ、
//      本リポジトリはこれまで「素材そのものはリポジトリに置かない（再配布にあたりうるため）」
//      という方針で運用してきた（scripts/shots-manual.mjs 冒頭）。方針の変更は法務・対外公開の
//      判断なので、便の裁量では行わない。
//
// オーナーがぱくたそ等の写真に差し替えると決めた場合は、手元に置いた写真から同じファイル名で
// webpを書き出せばよい（DEMO_PHOTOS のキーと public/demo/ のファイル名だけ合っていればアプリ側は
// そのまま動く）。DEMO_PHOTO_DIR に <キー>.jpg を置いてこのスクリプトを実行すると、
// イラストの代わりにその写真を正方形に切り出して webp にする。
// ────────────────────────────────────────────────

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const OUT_DIR = path.join(ROOT, 'public/demo')
/** 差し替え用の写真置き場（任意）。<キー>.jpg があればイラストではなくその写真を使う */
const PHOTO_DIR = process.env.DEMO_PHOTO_DIR ?? path.join(ROOT, '.demo-photos')
/** 出力サイズ。月カレンダーのセルは実機で約46px、レシピ行のサムネは28pxなので240pxで十分足りる */
const SIZE = 240

fs.mkdirSync(OUT_DIR, { recursive: true })

/** 乱数（見た目を毎回同じにするため、キーから決まる疑似乱数を使う） */
function makeRandom(seed) {
  let s = 0
  for (const ch of seed) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/** 中心(cx,cy)のまわりに、少しゆがんだ円（食材の塊）を描くパス */
function blob(rand, cx, cy, r, fill, opacity = 1) {
  const points = 9
  const parts = []
  for (let i = 0; i < points; i++) {
    const angle = (Math.PI * 2 * i) / points
    const radius = r * (0.82 + rand() * 0.32)
    const x = cx + Math.cos(angle) * radius
    const y = cy + Math.sin(angle) * radius
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
  }
  return `<path d="${parts.join(' ')}Z" fill="${fill}" opacity="${opacity}"/>`
}

/** 料理ごとの絵柄。table=卓の色 / vessel=器の色 / items=器の上に散らす食材 */
const DISHES = {
  curry: {
    table: '#c9b090',
    vessel: '#fffdf8',
    items: [
      { n: 1, color: '#ede0bd', r: 62, cx: -34, cy: 4 },
      { n: 1, color: '#8a4a1c', r: 60, cx: 34, cy: 4 },
      { n: 4, color: '#c8791f', r: 12, cx: 36, cy: 6, spread: 34 },
      { n: 3, color: '#e8cf92', r: 11, cx: 30, cy: -14, spread: 30 },
    ],
  },
  hamburg: {
    table: '#bfa98a',
    vessel: '#fffdf8',
    items: [
      { n: 1, color: '#6b3d21', r: 56, cx: -8, cy: 6 },
      { n: 1, color: '#4a2715', r: 44, cx: -8, cy: 10 },
      { n: 3, color: '#4f7a35', r: 17, cx: 52, cy: -26, spread: 22 },
      { n: 2, color: '#d97a20', r: 14, cx: 48, cy: 34, spread: 20 },
    ],
  },
  nikujaga: {
    table: '#c0a882',
    vessel: '#efe6d5',
    items: [
      { n: 3, color: '#e7d59a', r: 26, cx: -18, cy: -6, spread: 34 },
      { n: 3, color: '#c8791f', r: 17, cx: 26, cy: 18, spread: 30 },
      { n: 3, color: '#7b4a2a', r: 20, cx: 14, cy: -24, spread: 30 },
      { n: 3, color: '#5d8b3a', r: 9, cx: 0, cy: 30, spread: 34 },
    ],
  },
  salmon: {
    table: '#c9b090',
    vessel: '#fffdf8',
    items: [
      { n: 1, color: '#d97a52', r: 58, cx: -6, cy: 2 },
      { n: 3, color: '#e8a184', r: 10, cx: -6, cy: 2, spread: 40 },
      { n: 1, color: '#e8c93c', r: 20, cx: 54, cy: 40 },
      { n: 2, color: '#4f7a35', r: 14, cx: -46, cy: 44, spread: 18 },
    ],
  },
  mabo: {
    table: '#b8a184',
    vessel: '#f3ece0',
    items: [
      { n: 1, color: '#a8391c', r: 66, cx: 0, cy: 4 },
      { n: 6, color: '#f5f0e2', r: 15, cx: 0, cy: 4, spread: 44 },
      { n: 5, color: '#5d8b3a', r: 7, cx: 0, cy: -8, spread: 46 },
    ],
  },
  napolitan: {
    table: '#c9b090',
    vessel: '#fffdf8',
    items: [
      { n: 10, color: '#d4641f', r: 17, cx: 0, cy: 2, spread: 46 },
      { n: 6, color: '#e07c2c', r: 12, cx: 4, cy: -6, spread: 48 },
      { n: 3, color: '#4f7a35', r: 12, cx: -20, cy: 26, spread: 34 },
      { n: 3, color: '#b8452c', r: 11, cx: 26, cy: -22, spread: 30 },
    ],
  },
  tonjiru: {
    table: '#b8a184',
    vessel: '#4a3328',
    items: [
      { n: 1, color: '#a97b46', r: 62, cx: 0, cy: 2 },
      { n: 3, color: '#efe6d5', r: 14, cx: -14, cy: 6, spread: 40 },
      { n: 3, color: '#c8791f', r: 11, cx: 20, cy: -6, spread: 36 },
      { n: 4, color: '#5d8b3a', r: 7, cx: 0, cy: 10, spread: 40 },
    ],
  },
  karaage: {
    table: '#c9b090',
    vessel: '#fffdf8',
    items: [
      { n: 5, color: '#b9762a', r: 26, cx: 4, cy: 4, spread: 38 },
      { n: 4, color: '#d29a4c', r: 15, cx: 4, cy: -2, spread: 36 },
      { n: 2, color: '#6f9b46', r: 20, cx: -46, cy: 40, spread: 18 },
      { n: 1, color: '#e8c93c', r: 17, cx: 52, cy: 42 },
    ],
  },
  potatosalad: {
    table: '#c0a882',
    vessel: '#f3ece0',
    items: [
      { n: 1, color: '#f0e3c4', r: 62, cx: 0, cy: 4 },
      { n: 4, color: '#c8791f', r: 8, cx: 0, cy: 0, spread: 40 },
      { n: 4, color: '#6f9b46', r: 10, cx: 4, cy: 10, spread: 42 },
    ],
  },
  oyakodon: {
    table: '#b8a184',
    vessel: '#3f5a4a',
    items: [
      { n: 1, color: '#f7f2e4', r: 64, cx: 0, cy: 4 },
      { n: 1, color: '#e8b93c', r: 52, cx: 2, cy: 2 },
      { n: 4, color: '#c88a3a', r: 15, cx: 0, cy: 4, spread: 34 },
      { n: 3, color: '#5d8b3a', r: 8, cx: 0, cy: -6, spread: 36 },
    ],
  },
}

/** 1品ぶんのSVGを組み立てる */
function buildSvg(key, dish) {
  const rand = makeRandom(key)
  const c = SIZE / 2
  const parts = []
  parts.push(`<rect width="${SIZE}" height="${SIZE}" fill="${dish.table}"/>`)
  // 卓の質感（濃淡の帯）
  for (let i = 0; i < 6; i++) {
    const y = rand() * SIZE
    parts.push(
      `<rect x="0" y="${y.toFixed(1)}" width="${SIZE}" height="${(6 + rand() * 14).toFixed(1)}" fill="#000" opacity="0.035"/>`,
    )
  }
  // 器の影と器
  parts.push(`<ellipse cx="${c + 3}" cy="${c + 6}" rx="104" ry="104" fill="#000" opacity="0.12"/>`)
  parts.push(`<circle cx="${c}" cy="${c}" r="102" fill="${dish.vessel}"/>`)
  parts.push(
    `<circle cx="${c}" cy="${c}" r="102" fill="none" stroke="#000" stroke-opacity="0.08" stroke-width="3"/>`,
  )
  parts.push(`<circle cx="${c}" cy="${c}" r="86" fill="#000" opacity="0.04"/>`)
  // 食材
  for (const item of dish.items) {
    for (let i = 0; i < item.n; i++) {
      const spread = item.spread ?? 0
      const angle = rand() * Math.PI * 2
      const dist = spread === 0 ? 0 : spread * (0.35 + rand() * 0.65)
      const cx = c + item.cx + Math.cos(angle) * dist
      const cy = c + item.cy + Math.sin(angle) * dist
      parts.push(blob(rand, cx, cy, item.r * (0.85 + rand() * 0.3), item.color))
      // 上面のハイライト（立体感）
      parts.push(
        blob(rand, cx - item.r * 0.2, cy - item.r * 0.28, item.r * 0.42, '#ffffff', 0.14),
      )
    }
  }
  // 全体の光（左上から）
  parts.push(
    `<radialGradient id="lg" cx="30%" cy="24%" r="80%"><stop offset="0%" stop-color="#fff" stop-opacity="0.18"/><stop offset="100%" stop-color="#000" stop-opacity="0.14"/></radialGradient>`,
    `<rect width="${SIZE}" height="${SIZE}" fill="url(#lg)"/>`,
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">${parts.join('')}</svg>`
}

let total = 0
const rows = []
for (const [key, dish] of Object.entries(DISHES)) {
  const replacement = path.join(PHOTO_DIR, `${key}.jpg`)
  const source = fs.existsSync(replacement)
    ? sharp(replacement).resize(SIZE, SIZE, { fit: 'cover' })
    : sharp(Buffer.from(buildSvg(key, dish)))
  const webp = await source.webp({ quality: 72, effort: 6 }).toBuffer()
  fs.writeFileSync(path.join(OUT_DIR, `${key}.webp`), webp)
  total += webp.length
  rows.push([key, webp.length, fs.existsSync(replacement) ? '写真(差し替え)' : 'イラスト(自前)'])
}

for (const [key, size, kind] of rows) {
  console.log(`  ${key}.webp  ${(size / 1024).toFixed(1)}KB  ${kind}`)
}
console.log(`合計 ${(total / 1024).toFixed(1)}KB / ${rows.length}枚`)
if (total > 200 * 1024) {
  console.error('合計が200KBを超えました（同梱サイズの上限）')
  process.exit(1)
}
