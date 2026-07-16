import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'
import { formatAmountUnit } from './amount'
import { pickIconKey } from './icon'

/**
 * SNSシェア:
 * (a) テキスト共有 … 料理名＋材料＋アプリ名の文章
 * (b) 画像カード … Canvasで写真(またはアイコン帯)・料理名・材料を1枚の画像にする（アプリ名入り）
 * Web Share API が使えない環境では、コピー／ダウンロードに切り替える。
 *
 * シェアの選択式(2026-07-16 Fable裁定docs/30裁定3):
 * 固定=料理名・人数分・材料先頭8件。任意=画像(カードのみ)/調理時間/原価/栄養/材料すべて。
 * このモジュールは純ロジックに保つ(Dexie/priceIndex持ち込み禁止)。原価・栄養の実数値は
 * RecipeDetailPage側が既存のcostEstimate・computeRecipeNutritionから詰めて渡す。
 */

/** シェアに含める項目の選択(モーダルで選ぶ。開くたび既定値に初期化・永続化しない) */
export interface ShareOptions {
  /** レシピ画像（写真またはアイコン）。画像カード専用でテキスト共有には影響しない */
  image: boolean
  cookMinutes: boolean
  cost: boolean
  nutrition: boolean
  allIngredients: boolean
  /** 原価の全量(登録人数分・円)。RecipeDetailPageがestimateRecipeCost().totalを渡す */
  costTotalYen?: number
  /** 原価の1人分(登録人数基準・円)。表示人数には追従させない(裁定1と同値) */
  costPerServingYen?: number
  /** 1食あたりエネルギー(kcal・表示用丸め済み)。栄養はカロリー・塩分の2項目固定(Pro解錠でも) */
  kcalPerServing?: number
  /** 1食あたり食塩相当量(g・表示用丸め済み) */
  saltPerServing?: number
}

/** 選択された原価・栄養の行を組み立てる(テキスト・画像カード共通)。
 *  実数値が渡されていない場合(合計0円・計算対象0件等)はONでも行を出さない */
function buildCostNutritionLines(recipe: Recipe, opts: ShareOptions | undefined): string[] {
  if (!opts) return []
  const lines: string[] = []
  if (opts.cost && opts.costPerServingYen != null && opts.costTotalYen != null) {
    lines.push(
      ja.share.lineCost
        .replace('{n}', opts.costPerServingYen.toLocaleString())
        .replace('{s}', String(recipe.servings))
        .replace('{m}', opts.costTotalYen.toLocaleString()),
    )
  }
  if (opts.nutrition && opts.kcalPerServing != null && opts.saltPerServing != null) {
    lines.push(
      ja.share.lineNutrition
        .replace('{kcal}', opts.kcalPerServing.toLocaleString())
        .replace('{salt}', opts.saltPerServing.toLocaleString()),
    )
  }
  return lines
}

/** シェア用の文章を組み立てる。opts省略時は従来出力(固定項目のみ)と同一 */
export function buildShareText(recipe: Recipe, opts?: ShareOptions): string {
  const listed = opts?.allIngredients ? recipe.ingredients : recipe.ingredients.slice(0, 8)
  const ingredients = listed
    .map((i) => `・${i.name} ${formatAmountUnit(i.amount, i.unit)}`.trimEnd())
    .join('\n')
  const more =
    !opts?.allIngredients && recipe.ingredients.length > 8 ? `\n${ja.share.moreIngredients}` : ''
  // 任意行: 調理時間→原価→栄養(モーダルの並び順と同じ)。データが無いものはONでも出さない
  const optionalLines: string[] = []
  if (opts?.cookMinutes && recipe.cookMinutes != null && recipe.cookMinutes > 0) {
    optionalLines.push(ja.share.lineCookMinutes.replace('{n}', String(recipe.cookMinutes)))
  }
  optionalLines.push(...buildCostNutritionLines(recipe, opts))
  return ja.share.textTemplate
    .replace('{title}', recipe.title)
    .replace('{servings}', String(recipe.servings))
    .replace('{lines}', optionalLines.length > 0 ? `${optionalLines.join('\n')}\n` : '')
    .replace('{ingredients}', ingredients + more)
    .replace('{app}', ja.app.name)
    .replace('{url}', ja.app.url)
}

/** テキストを共有（非対応ならクリップボードへコピー）。戻り値は 'shared' | 'copied' */
export async function shareText(recipe: Recipe, opts?: ShareOptions): Promise<'shared' | 'copied'> {
  const text = buildShareText(recipe, opts)
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

/** アイコン帯用にPNG線画を読み込む(失敗してもカード生成全体は失敗させず帯背景のみにする) */
function loadIconImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

/** レシピの画像カード（PNG）を生成する。含める項目はopts(選択モーダル)に従う */
export async function generateShareCard(recipe: Recipe, opts: ShareOptions): Promise<Blob> {
  const width = 1080
  const pad = 72
  // 画像欄(裁定3): 画像ON時、写真(表示優先)があれば写真620px。写真なし・アイコン表示優先の
  // レシピはアイコン帯(約360px・--icon-tile背景+--accentティントの線画)。画像OFFなら帯なし
  const hasPhoto = opts.image && !!recipe.photo && !recipe.showIconInsteadOfPhoto
  const hasIconBand = opts.image && !hasPhoto
  const imageHeight = hasPhoto ? 620 : hasIconBand ? 360 : 0
  // 材料: 「材料をすべて載せる」ONは全件(件数×56pxで縦長カード許容・分割/縮小なし)
  const ingredients = opts.allIngredients ? recipe.ingredients : recipe.ingredients.slice(0, 8)
  const hasMoreIngredients = !opts.allIngredients && recipe.ingredients.length > 8
  const bandHeight = 96

  // サイズ計算専用のcanvas（本描画の前にタイトルの折り返し行数を測るため）
  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx) throw new Error('canvas unavailable')
  measureCtx.font = 'bold 72px system-ui, sans-serif'
  const titleLines = countWrappedLines(measureCtx, recipe.title, width - pad * 2, 2)

  // 原価・栄養の任意行(各1行=56px)。高さ計算に加算する
  const infoLines = buildCostNutritionLines(recipe, opts)

  // 内容量に応じて高さを決める（固定高だと材料が多い/写真が無い場合に下の帯へ隠れてしまうため）
  const contentTop = imageHeight + (imageHeight > 0 ? 110 : 96)
  const afterTitle = contentTop + titleLines * 92 + 8
  const afterMeta = afterTitle + 84
  const afterInfo = afterMeta + infoLines.length * 56
  const afterHeader = afterInfo + 64
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

  // 写真（画像ONかつ写真表示のレシピだけ上部に大きく表示）
  if (hasPhoto && recipe.photo) {
    const bitmap = await createImageBitmap(recipe.photo)
    // はみ出す部分を切ってぴったり収める（cover）
    const scale = Math.max(width / bitmap.width, imageHeight / bitmap.height)
    const drawW = bitmap.width * scale
    const drawH = bitmap.height * scale
    ctx.drawImage(bitmap, (width - drawW) / 2, (imageHeight - drawH) / 2, drawW, drawH)
    bitmap.close()
  }

  // アイコン帯（画像ONで写真が使えないレシピ。一覧・詳細のプレースホルダーと同じ見た目:
  // --icon-tile背景に、線画PNGをsource-inで--accent色にティントして中央240pxで置く）
  if (hasIconBand) {
    ctx.fillStyle = tokenColor('--icon-tile', '#ece7df')
    ctx.fillRect(0, 0, width, imageHeight)
    const iconKey = recipe.iconKey ?? pickIconKey(recipe)
    const iconImage = await loadIconImage(`/icons/${iconKey}.png`)
    if (iconImage) {
      const iconSize = 240
      const tile = document.createElement('canvas')
      tile.width = iconSize
      tile.height = iconSize
      const tileCtx = tile.getContext('2d')
      if (tileCtx) {
        tileCtx.drawImage(iconImage, 0, 0, iconSize, iconSize)
        // 線画の不透明部分だけをアクセント色で塗る(RecipeIconのCSSマスクと同じ効果)
        tileCtx.globalCompositeOperation = 'source-in'
        tileCtx.fillStyle = accent
        tileCtx.fillRect(0, 0, iconSize, iconSize)
        ctx.drawImage(tile, (width - iconSize) / 2, (imageHeight - iconSize) / 2)
      }
    }
  }

  let y = contentTop

  // 料理名
  ctx.fillStyle = ink
  ctx.font = 'bold 72px system-ui, sans-serif'
  drawWrappedText(ctx, recipe.title, pad, y, width - pad * 2, 92, 2)
  y += titleLines * 92 + 8

  // メタ行: 人数分(+選択時のみ調理時間)。手間レベルは載せない(裁定3・オーナー列挙に無い)
  ctx.fillStyle = muted
  ctx.font = '40px system-ui, sans-serif'
  const meta = [
    opts.cookMinutes && recipe.cookMinutes ? `${recipe.cookMinutes}${ja.detail.minutesSuffix}` : '',
    `${recipe.servings}${ja.detail.servingsUnit}`,
  ]
    .filter(Boolean)
    .join('　')
  ctx.fillText(meta, pad, y)
  y += 84

  // 原価・栄養の任意行(選択時のみ・各1行)
  for (const line of infoLines) {
    drawWrappedText(ctx, line, pad, y, width - pad * 2, 56, 1)
    y += 56
  }

  // 材料（全部 or 最大8つ）
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
  opts: ShareOptions,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const blob = await generateShareCard(recipe, opts)
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
