import { ja } from '../i18n/ja'
import { countWrappedLines, drawWrappedText, tokenColor } from './share'
import { planSheetLines, type PlanSheet } from './planSheet'

/**
 * 献立表の画像化（2026-07-29 便CB-2・docs/59 A-4）。
 *
 * 既存の「レシピの画像カード」（logic/share.ts の generateShareCard）と同じ機構をそのまま流用する:
 * Canvasにテーマ色（デザイントークン）で描き、下部にアプリ名｜ドメインの帯を敷き、
 * Web Share APIが使えれば共有・使えなければPNGダウンロードに切り替える。
 * 折り返し・行数計算のヘルパー（drawWrappedText / countWrappedLines / tokenColor）も
 * share.ts から公開してもらって共用している＝1枚絵の作法を2か所に分けて持たない。
 *
 * 中身（何をどの順で載せるか）は純ロジック logic/planSheet.ts が決め、ここは描くだけ。
 * 画面・印刷のHTMLと同じ planSheetLines を読むので、紙・画面・画像で内容がずれない。
 */

const WIDTH = 1080
const PAD = 64
const BAND_HEIGHT = 96
const TITLE_FONT = 'bold 60px system-ui, sans-serif'
const DAY_FONT = 'bold 42px system-ui, sans-serif'
const DISH_FONT = '38px system-ui, sans-serif'
const NOTE_FONT = '34px system-ui, sans-serif'
const LINE_HEIGHT = { day: 62, dish: 52, note: 48 } as const
/**
 * 1行が長い場合の最大行数（料理名が多い日でも表が縦に伸びすぎないようにする）。
 *
 * 2026-07-30 便CH/C6: 一律2行だったため、料理名の行だけが「…」で打ち切られ、
 * 画面プレビューと印刷には出ている品が画像からだけ欠けていた（送った先で初めて気づく）。
 * 献立表は「冷蔵庫に貼る・家族に送る」ためのものなので、料理名は欠けさせない＝dishだけ3行許す。
 * 全種別を一律に増やさないのは、月シートが31日×3食ぶん縦に伸びるとキャンバス面積が
 * iOS Safariの上限（約16.7Mpx）に触れ、画像生成そのものが失敗しうるため。
 */
export const MAX_WRAP_LINES = { day: 2, dish: 3, note: 2 } as const

/**
 * 画像1行に入る全角文字数のめやす（38px・折り返し幅920pxをブラウザで実測して26字）。
 * 描画には使わない（実際の折り返しはCanvasの実測幅で決まる）。料理名が画像から欠けていないかを
 * 文字数で見張る回帰テスト（scripts/test-logic.mjs）のために公開している。
 */
export const IMAGE_WIDE_CHARS_PER_LINE = 26

function fontOf(kind: 'day' | 'dish' | 'note'): string {
  return kind === 'day' ? DAY_FONT : kind === 'dish' ? DISH_FONT : NOTE_FONT
}

/** 献立表のPNGを生成する（週・月のどちらでも同じ関数で作る） */
export async function generatePlanSheetImage(sheet: PlanSheet): Promise<Blob> {
  const lines = planSheetLines(sheet)
  const contentWidth = WIDTH - PAD * 2

  // 高さを先に測る（日数・品数で縦が伸びるため固定高にできない）
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('canvas unavailable')
  measureCtx.font = TITLE_FONT
  const titleLines = countWrappedLines(measureCtx, sheet.title, contentWidth, 2)
  // 「本文のインデント幅」ぶん狭い幅で折り返す（日付見出しだけ左端から）
  const wrapCounts = lines.map((line) => {
    measureCtx.font = fontOf(line.kind)
    const width = line.kind === 'day' ? contentWidth : contentWidth - 32
    return countWrappedLines(measureCtx, line.text, width, MAX_WRAP_LINES[line.kind])
  })
  const bodyHeight = lines.reduce(
    (sum, line, i) => sum + wrapCounts[i] * LINE_HEIGHT[line.kind] + (line.kind === 'day' ? 8 : 0),
    0,
  )
  const headerHeight = 72 + titleLines * 76 + 52
  const height = headerHeight + bodyHeight + 48 + BAND_HEIGHT

  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  const bg = tokenColor('--bg', '#faf5ec')
  const ink = tokenColor('--text', '#43362a')
  // 帯の「塗り」は--accent、日付見出しの「文字」は文字用に濃くした--accent-ink(2026-07-30)
  const accent = tokenColor('--accent', '#d9480f')
  const accentInk = tokenColor('--accent-ink', '#b8380a')
  const muted = tokenColor('--text-muted', '#7c6a56')

  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, height)

  let y = 72 + 48
  ctx.fillStyle = ink
  ctx.font = TITLE_FONT
  drawWrappedText(ctx, sheet.title, PAD, y, contentWidth, 76, 2)
  y += titleLines * 76 + 52

  for (const [i, line] of lines.entries()) {
    ctx.font = fontOf(line.kind)
    if (line.kind === 'day') {
      y += 8
      ctx.fillStyle = accentInk
      drawWrappedText(ctx, line.text, PAD, y, contentWidth, LINE_HEIGHT.day, MAX_WRAP_LINES.day)
    } else {
      ctx.fillStyle = line.kind === 'note' ? muted : ink
      drawWrappedText(
        ctx,
        line.text,
        PAD + 32,
        y,
        contentWidth - 32,
        LINE_HEIGHT[line.kind],
        MAX_WRAP_LINES[line.kind],
      )
    }
    y += wrapCounts[i] * LINE_HEIGHT[line.kind]
  }

  // 下部の帯: アプリ名｜ドメイン（レシピの画像カードと同じ作法）
  ctx.fillStyle = accent
  ctx.fillRect(0, height - BAND_HEIGHT, WIDTH, BAND_HEIGHT)
  ctx.fillStyle = bg
  ctx.font = 'bold 40px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${ja.app.name}｜${ja.app.url}`, WIDTH / 2, height - 34)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
      'image/png',
    )
  })
}

/**
 * 献立表の画像を共有する（非対応環境ではPNGダウンロード）。
 * 共有シートでのキャンセル（AbortError）はダウンロードに切り替えない
 * （切り替えると、やめるたびに端末に画像が残る。share.ts shareImageCard と同じ判断）。
 */
export async function sharePlanSheetImage(
  sheet: PlanSheet,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await generatePlanSheetImage(sheet)
  const file = new File([blob], `${ja.app.name}-${sheet.title}.png`, { type: 'image/png' })

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: sheet.title })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
      /* それ以外のエラー(非対応環境など)はダウンロードに切り替え */
    }
  }
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.name
  anchor.click()
  URL.revokeObjectURL(url)
  return 'downloaded'
}
