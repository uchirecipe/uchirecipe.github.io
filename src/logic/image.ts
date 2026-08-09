/** 写真の保存前処理: 長辺1200pxに縮小してデータ容量を抑える */

const MAX_EDGE = 1200
const JPEG_QUALITY = 0.85

export async function resizePhoto(
  file: Blob,
  maxEdge = MAX_EDGE,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  // imageOrientation: 'from-image' → スマホ写真の向き情報を反映して回転を直す
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    ctx.drawImage(bitmap, 0, 0, width, height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}

// ---------- 保存済みの写真を回す（2026-08-09 便EN・オーナー要望「記録した写真を回転させる
// ことは可能?」）。カメラの向き情報が付いていない写真（貼り付け・古い端末・すでに保存済みの
// JPEG）は自動では直せないので、本人が90度ずつ回して保存し直せるようにする ----------

/** 「右に90度」を押した回数を0〜3に畳む（4回で必ず元の向きに戻る） */
export function normalizeQuarterTurns(turns: number): number {
  return ((Math.round(turns) % 4) + 4) % 4
}

/** 回したあとの見た目の大きさ。90度・270度は縦横が入れ替わる */
export function rotatedSize(
  width: number,
  height: number,
  quarterTurns: number,
): { width: number; height: number } {
  return normalizeQuarterTurns(quarterTurns) % 2 === 1
    ? { width: height, height: width }
    : { width, height }
}

/**
 * 写真を時計回りに90度ずつ回した新しいJPEGを作る。
 *
 * 回すたびに再エンコードするので、品質は取り込み時と同じ値を渡して劣化の進み方をそろえる
 * （記録写真は CookedLogModal の LOG_PHOTO_QUALITY）。縮小はしない＝回すだけで
 * 画素数が減らないようにする（4回押せば元の向き・元の大きさに戻る）。
 */
export async function rotatePhoto(
  file: Blob,
  quarterTurns = 1,
  quality = JPEG_QUALITY,
): Promise<Blob> {
  const turns = normalizeQuarterTurns(quarterTurns)
  if (turns === 0) return file
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const { width, height } = rotatedSize(bitmap.width, bitmap.height, turns)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas 2d context unavailable')
    // 回転の中心を画像の中心に合わせてから描く（左上を原点に回すと画像が枠の外へ出る）
    ctx.translate(width / 2, height / 2)
    ctx.rotate((turns * Math.PI) / 2)
    ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('image encode failed'))),
        'image/jpeg',
        quality,
      )
    })
  } finally {
    bitmap.close()
  }
}
