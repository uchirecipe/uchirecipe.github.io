import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/**
 * SNSシェア:
 * (a) テキスト共有 … 料理名＋材料＋手順数＋アプリ名の文章
 * (b) 画像カード … Canvasで写真・料理名・材料を1枚の画像にする（アプリ名入り）
 * Web Share API が使えない環境では、コピー／ダウンロードに切り替える。
 */

/** シェア用の文章を組み立てる */
export function buildShareText(recipe: Recipe): string {
  const ingredients = recipe.ingredients
    .slice(0, 8)
    .map((i) => `・${i.name} ${i.amount}${i.unit}`.trimEnd())
    .join('\n')
  const more = recipe.ingredients.length > 8 ? `\n${ja.share.moreIngredients}` : ''
  return ja.share.textTemplate
    .replace('{title}', recipe.title)
    .replace('{servings}', String(recipe.servings))
    .replace('{ingredients}', ingredients + more)
    .replace('{steps}', String(recipe.steps.length))
    .replace('{app}', ja.app.name)
}

/** テキストを共有（非対応ならクリップボードへコピー）。戻り値は 'shared' | 'copied' */
export async function shareText(recipe: Recipe): Promise<'shared' | 'copied'> {
  const text = buildShareText(recipe)
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text })
      return 'shared'
    } catch {
      /* キャンセル時などはコピーに切り替え */
    }
  }
  await navigator.clipboard.writeText(text)
  return 'copied'
}

/** 現在のテーマのデザイントークン（CSS変数）から色を読む */
function tokenColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

/** 折り返しながら文字を描く。描いた行数を返す */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): number {
  let line = ''
  let lines = 0
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      ctx.fillText(lines + 1 === maxLines ? `${line}…` : line, x, y + lines * lineHeight)
      lines++
      if (lines >= maxLines) return lines
      line = ch
    } else {
      line += ch
    }
  }
  if (line) {
    ctx.fillText(line, x, y + lines * lineHeight)
    lines++
  }
  return lines
}

/** レシピの画像カード（PNG）を生成する */
export async function generateShareCard(recipe: Recipe): Promise<Blob> {
  const width = 1080
  const height = 1350
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas unavailable')

  const bg = tokenColor('--bg', '#faf5ec')
  const ink = tokenColor('--text', '#43362a')
  const accent = tokenColor('--accent', '#d9480f')
  const muted = tokenColor('--text-muted', '#8c7b69')

  // 背景
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  // 写真（あれば上部に大きく。なければアクセント色の帯）
  const photoHeight = 620
  if (recipe.photo) {
    const bitmap = await createImageBitmap(recipe.photo)
    // はみ出す部分を切ってぴったり収める（cover）
    const scale = Math.max(width / bitmap.width, photoHeight / bitmap.height)
    const drawW = bitmap.width * scale
    const drawH = bitmap.height * scale
    ctx.drawImage(bitmap, (width - drawW) / 2, (photoHeight - drawH) / 2, drawW, drawH)
    bitmap.close()
  } else {
    ctx.fillStyle = accent
    ctx.globalAlpha = 0.18
    ctx.fillRect(0, 0, width, photoHeight)
    ctx.globalAlpha = 1
    ctx.fillStyle = accent
    ctx.font = 'bold 220px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('🍲', width / 2, photoHeight / 2 + 80)
    ctx.textAlign = 'left'
  }

  const pad = 72
  let y = photoHeight + 110

  // 料理名
  ctx.fillStyle = ink
  ctx.font = 'bold 72px system-ui, sans-serif'
  const titleLines = drawWrappedText(ctx, recipe.title, pad, y, width - pad * 2, 92, 2)
  y += titleLines * 92 + 8

  // 時間・手間
  ctx.fillStyle = muted
  ctx.font = '40px system-ui, sans-serif'
  const meta = [
    recipe.cookMinutes ? `${recipe.cookMinutes}${ja.detail.minutesSuffix}` : '',
    ja.effort[recipe.effortLevel],
    `${recipe.servings}${ja.detail.servingsUnit}`,
  ]
    .filter(Boolean)
    .join('　')
  ctx.fillText(meta, pad, y)
  y += 84

  // 材料（最大8つ）
  ctx.fillStyle = accent
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.fillText(ja.detail.ingredients, pad, y)
  y += 64
  ctx.fillStyle = ink
  ctx.font = '40px system-ui, sans-serif'
  for (const ing of recipe.ingredients.slice(0, 8)) {
    const line = `・${ing.name}　${ing.amount}${ing.unit}`.trimEnd()
    drawWrappedText(ctx, line, pad, y, width - pad * 2, 56, 1)
    y += 56
  }
  if (recipe.ingredients.length > 8) {
    ctx.fillStyle = muted
    ctx.fillText(ja.share.moreIngredients, pad, y)
  }

  // 下部の帯: アプリ名
  ctx.fillStyle = accent
  ctx.fillRect(0, height - 96, width, 96)
  ctx.fillStyle = bg
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(ja.app.name, width / 2, height - 34)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
      'image/png',
    )
  })
}

/** 画像カードを共有（非対応ならダウンロード）。戻り値は 'shared' | 'downloaded' */
export async function shareImageCard(recipe: Recipe): Promise<'shared' | 'downloaded'> {
  const blob = await generateShareCard(recipe)
  const file = new File([blob], `${ja.app.name}-${recipe.title}.png`, { type: 'image/png' })

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: recipe.title })
      return 'shared'
    } catch {
      /* キャンセル時などはダウンロードに切り替え */
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
