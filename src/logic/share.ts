import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'
import { formatAmountUnit } from './amount'

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
    .map((i) => `・${i.name} ${formatAmountUnit(i.amount, i.unit)}`.trimEnd())
    .join('\n')
  const more = recipe.ingredients.length > 8 ? `\n${ja.share.moreIngredients}` : ''
  return ja.share.textTemplate
    .replace('{title}', recipe.title)
    .replace('{servings}', String(recipe.servings))
    .replace('{ingredients}', ingredients + more)
    .replace('{steps}', String(recipe.steps.length))
    .replace('{app}', ja.app.name)
    .replace('{url}', ja.app.url)
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

/** 折り返した場合の行数だけを数える（描画はしない。サイズ計算用） */
function countWrappedLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): number {
  let line = ''
  let lines = 0
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines++
      if (lines >= maxLines) return lines
      line = ch
    } else {
      line += ch
    }
  }
  if (line) lines++
  return lines
}

/** レシピの画像カード（PNG）を生成する */
export async function generateShareCard(recipe: Recipe): Promise<Blob> {
  const width = 1080
  const pad = 72
  // 写真が無い（アイコン表示の）レシピでは、情報量の無い大きな画像欄を作らない
  const hasPhoto = !!recipe.photo
  const photoHeight = hasPhoto ? 620 : 0
  const ingredients = recipe.ingredients.slice(0, 8)
  const hasMoreIngredients = recipe.ingredients.length > 8
  const bandHeight = 96

  // サイズ計算専用のcanvas（本描画の前にタイトルの折り返し行数を測るため）
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('canvas unavailable')
  measureCtx.font = 'bold 72px system-ui, sans-serif'
  const titleLines = countWrappedLines(measureCtx, recipe.title, width - pad * 2, 2)

  // 内容量に応じて高さを決める（固定高だと材料が多い/写真が無い場合に下の帯へ隠れてしまうため）
  const contentTop = photoHeight + (hasPhoto ? 110 : 96)
  const afterTitle = contentTop + titleLines * 92 + 8
  const afterMeta = afterTitle + 84
  const afterHeader = afterMeta + 64
  const afterIngredients = afterHeader + ingredients.length * 56 + (hasMoreIngredients ? 56 : 0)
  const height = afterIngredients + 56 + bandHeight

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

  // 写真（あるときだけ上部に大きく表示。無ければ画像欄自体を作らない）
  if (hasPhoto && recipe.photo) {
    const bitmap = await createImageBitmap(recipe.photo)
    // はみ出す部分を切ってぴったり収める（cover）
    const scale = Math.max(width / bitmap.width, photoHeight / bitmap.height)
    const drawW = bitmap.width * scale
    const drawH = bitmap.height * scale
    ctx.drawImage(bitmap, (width - drawW) / 2, (photoHeight - drawH) / 2, drawW, drawH)
    bitmap.close()
  }

  let y = contentTop

  // 料理名
  ctx.fillStyle = ink
  ctx.font = 'bold 72px system-ui, sans-serif'
  drawWrappedText(ctx, recipe.title, pad, y, width - pad * 2, 92, 2)
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
  for (const ing of ingredients) {
    const line = `・${ing.name}　${formatAmountUnit(ing.amount, ing.unit)}`.trimEnd()
    drawWrappedText(ctx, line, pad, y, width - pad * 2, 56, 1)
    y += 56
  }
  if (hasMoreIngredients) {
    ctx.fillStyle = muted
    ctx.fillText(ja.share.moreIngredients, pad, y)
  }

  // 下部の帯: アプリ名｜ドメイン
  ctx.fillStyle = accent
  ctx.fillRect(0, height - bandHeight, width, bandHeight)
  ctx.fillStyle = bg
  ctx.font = 'bold 44px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${ja.app.name}｜${ja.app.url}`, width / 2, height - 34)

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
      'image/png',
    )
  })
}

/** 画像カードを共有（非対応ならダウンロード）。戻り値は 'shared' | 'downloaded' | 'cancelled' */
export async function shareImageCard(
  recipe: Recipe,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await generateShareCard(recipe)
  const file = new File([blob], `${ja.app.name}-${recipe.title}.png`, { type: 'image/png' })

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: recipe.title })
      return 'shared'
    } catch (err) {
      // 共有シートでのキャンセル(AbortError)は正常な選択なので、ダウンロードに切り替えない
      // (これをダウンロードにフォールバックすると、キャンセルするたびに端末に画像が保存されてしまう)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return 'cancelled'
      }
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
