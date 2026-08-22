import type { PhotoFocus } from '../db/types'

/**
 * 写真の「見える範囲」＝どこを見せるかの1点（2026-08-22 便JK）。
 *
 * オーナー原文:
 *   「画像の中心ズレについて、画像のサイズの真ん中ではなく、画像の中で被写体が
 *     真ん中に写っていない、ということです。これは自動ではどうにもできない部分だと思うので、
 *     ゆーざーが見える範囲を微調整（トリミングっぽい感じ）できたら嬉しい、ということです。」
 *
 * **写真そのものは切らない。** 覚えるのは「写真のどこを見せるか」の1点だけなので、
 * 何度でも直せる／中央に戻せる（元の画像データは1バイトも書き換えない）。
 *
 * 値の中身: x・y とも 0〜100 の割合。CSS の object-position と同じ意味で、
 * 「写真の x% の位置」を「入れ物の x% の位置」に合わせる。
 *  ・x=0 … 写真の左端が入れ物の左端にそろう（＝左側が見える）
 *  ・x=100 … 写真の右端が入れ物の右端にそろう（＝右側が見える）
 *  ・50/50 … 中央（未設定のレシピと同じ見え方）
 *
 * **1つの値で詳細も一覧も決める**（司令部の裁定）。CSS の割合指定は、その向きに
 * はみ出しが無ければ何も起こさないので、同じ値を形の違う入れ物へそのまま渡せる。
 *
 * なぜ縦だけでなく横も持つのか（実データ22品の実測・便JK）:
 *   詳細画面は 16:9、レシピ一覧のマスは 1:1 で、**同じ写真でも切れる向きが違う**。
 *    ・詳細（16:9）… 上下が落ちる 17品 ／ 左右が落ちる 3品 ／ 落ちない 2品
 *    ・一覧（1:1） … 上下が落ちる 1品 ／ 左右が落ちる 10品 ／ 落ちない 11品
 *   1割以上落ちる品を数えると 上下方向 17品・左右方向 10品。片方だけでは10品が直せない。
 */

/** 未設定のレシピの見え方（＝いままでどおり中央） */
export const PHOTO_FOCUS_CENTER: PhotoFocus = { x: 50, y: 50 }

/** 0〜100 に収めて整数にする（保存する値を1%刻みにそろえる） */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 50
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** 受け取った値を、保存してよい形（0〜100の整数2つ）に整える */
export function clampPhotoFocus(focus: Partial<PhotoFocus> | undefined): PhotoFocus {
  return { x: clampPercent(focus?.x ?? 50), y: clampPercent(focus?.y ?? 50) }
}

/** 中央のままか（＝調整していないか）。中央なら保存の値を持たせない */
export function isPhotoFocusCentered(focus: PhotoFocus | undefined): boolean {
  const v = clampPhotoFocus(focus)
  return v.x === PHOTO_FOCUS_CENTER.x && v.y === PHOTO_FOCUS_CENTER.y
}

/**
 * 保存する値に直す。中央のときは undefined を返す＝**調整していないレシピは値を持たない**
 * （既存のレシピの見え方も、書き出すファイルの中身も、いままでと変わらない）
 */
export function toStoredPhotoFocus(focus: PhotoFocus | undefined): PhotoFocus | undefined {
  if (!focus) return undefined
  const v = clampPhotoFocus(focus)
  return isPhotoFocusCentered(v) ? undefined : v
}

/**
 * <img> に渡す object-position の値。未設定なら '50% 50%'（中央）。
 * 写真を描くところは必ずこれを通す＝画面ごとに違う見え方にならない
 * （見張りは scripts/test-logic.mjs の JK-4）。
 */
export function photoObjectPosition(focus: PhotoFocus | undefined): string {
  const v = clampPhotoFocus(focus)
  return `${v.x}% ${v.y}%`
}

/**
 * 写真のうち、その形の入れ物に実際に見えている範囲（写真全体を1とした割合）。
 * 調整画面のプレビューと、1枚絵（logic/share.ts）の切り取りが同じ答えを出すために使う。
 *
 * @param imageWidth  写真の元の幅
 * @param imageHeight 写真の元の高さ
 * @param boxRatio    入れ物の 横÷縦（詳細画面＝16/9、レシピ一覧のマス＝1）
 */
export function photoVisibleRect(
  imageWidth: number,
  imageHeight: number,
  boxRatio: number,
  focus: PhotoFocus | undefined,
): { left: number; top: number; width: number; height: number } {
  const v = clampPhotoFocus(focus)
  if (!(imageWidth > 0) || !(imageHeight > 0) || !(boxRatio > 0)) {
    return { left: 0, top: 0, width: 1, height: 1 }
  }
  const imageRatio = imageWidth / imageHeight
  if (imageRatio > boxRatio) {
    // 写真のほうが横長＝左右が落ちる
    const width = boxRatio / imageRatio
    return { left: (1 - width) * (v.x / 100), top: 0, width, height: 1 }
  }
  // 写真のほうが縦長（同じ形なら落ちない＝height=1）＝上下が落ちる
  const height = imageRatio / boxRatio
  return { left: 0, top: (1 - height) * (v.y / 100), width: 1, height }
}

/** 矢印キーで動かす1回ぶんの割合（指でのなぞりと別に、細かく詰められるようにするため） */
export const PHOTO_FOCUS_KEY_STEP = 2

/** 矢印キーぶん動かした値を返す（0〜100を越えない） */
export function movePhotoFocus(focus: PhotoFocus | undefined, dx: number, dy: number): PhotoFocus {
  const v = clampPhotoFocus(focus)
  return clampPhotoFocus({ x: v.x + dx, y: v.y + dy })
}
