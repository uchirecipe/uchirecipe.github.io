import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { X } from 'lucide-react'
import type { PhotoFocus } from '../db/types'
import {
  PHOTO_FOCUS_CENTER,
  PHOTO_FOCUS_KEY_STEP,
  clampPhotoFocus,
  isPhotoFocusCentered,
  movePhotoFocus,
  photoObjectPosition,
} from '../logic/photoFocus'
import { ja } from '../i18n/ja'
import {
  DIALOG_BACKDROP_CLS,
  DIALOG_CANCEL_BUTTON_CLS,
  DIALOG_CARD_CLS,
  DIALOG_CHOICE_BUTTON_CLS,
  DIALOG_PRIMARY_BUTTON_CLS,
  DIALOG_TITLE_CLS,
} from './dialogStyle'
import { useOverlayDismiss } from './useOverlayDismiss'
import { useScrollLock } from './useScrollLock'
import { usePhotoUrl } from './usePhotoUrl'

/**
 * 写真の「見える範囲」を決める窓（2026-08-22 便JK）。
 *
 * **操作の形をなぜこれにしたか**（実測して決めた。報告に数字を載せてある）:
 *  ・実データ22品の写真は 正方形11・横10・縦1。詳細画面は 16:9、レシピ一覧のマスは 1:1 で
 *    形が違うため、**同じ写真でも切れる向きが画面ごとに違う**（詳細で上下が落ちる17品／
 *    一覧で左右が落ちる10品）。片方の枠の中で写真をなぞって動かす形（＝ふつうの「トリミング」）だと、
 *    その枠ではみ出していない向きは動かせない＝**もう片方の画面で必要な向きが決められない**。
 *  ・そこで「写真全体を出して、見せたい場所を1点指す」形にした。指した1点から、
 *    両方の形の切り取りが同時に決まる。押せる面は写真全体（390pxの画面で 352×幅なり）で、
 *    44pxの下限を大きく上回る。
 *  ・押した場所がそのまま見せたい場所になる（指の位置＝その点）。細かく詰めるときは
 *    そのままなぞる／矢印キーでも動く。
 *
 * 出来上がりは**その場で2つ並べて見せる**（詳細＝16:9、一覧＝1:1）。1つの値が2つの画面に
 * どう効くのかを、押す前に見て確かめられるようにするため。
 */
export default function PhotoFocusModal({
  open,
  photo,
  title,
  focus,
  onApply,
  onClose,
}: {
  open: boolean
  /** 調整する写真。無いときは呼び出し側が窓ごと出さない */
  photo: Blob | undefined
  /** 読み上げ用の料理名 */
  title: string
  /** いまの見える範囲（未設定＝中央） */
  focus: PhotoFocus | undefined
  /** 決めた値を返す。中央に戻したときは undefined（＝値を持たない状態に戻す） */
  onApply: (next: PhotoFocus | undefined) => void
  onClose: () => void
}) {
  const photoUrl = usePhotoUrl(photo)
  const [value, setValue] = useState<PhotoFocus>(() => clampPhotoFocus(focus))
  const imageRef = useRef<HTMLImageElement>(null)
  const draggingRef = useRef(false)

  /**
   * 開くたびに、いま保存されている値から始める（前に開いたときの触りかけを持ち越さない）。
   * 見張る先を数（x・y）にしてあるのは、**入れ物の作り直しでなぞっている途中が消えない**ようにするため
   * （レシピはDBの購読で届くので、中身が同じでも別の入れ物として届くことがある）。
   */
  useEffect(() => {
    if (open) setValue(clampPhotoFocus(focus))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, focus?.x, focus?.y])

  useOverlayDismiss(open, onClose)
  useScrollLock(open)

  if (!open || !photoUrl) return null

  /** 指（マウス）の位置を、そのまま「見せたい場所」にする */
  const applyFromPointer = (clientX: number, clientY: number) => {
    const el = imageRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    setValue(
      clampPhotoFocus({
        x: ((clientX - rect.left) / rect.width) * 100,
        y: ((clientY - rect.top) / rect.height) * 100,
      }),
    )
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = true
    e.currentTarget.setPointerCapture?.(e.pointerId)
    applyFromPointer(e.clientX, e.clientY)
  }
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return
    applyFromPointer(e.clientX, e.clientY)
  }
  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  const position = photoObjectPosition(value)
  const centered = isPhotoFocusCentered(value)
  /**
   * 窓のボタンは共通の見た目（components/dialogStyle）を使うが、この窓だけは2つを横に並べる。
   * 共通の定義は「1つで1行を占める」形なので幅の指定（w-full）だけ外す
   * ＝色・角丸・影・文字の太さは今までどおり1か所のまま。
   * 外さないと w-full が勝って、右のボタンが窓からはみ出して押せなくなる（実測で判明）。
   */
  const inRow = (cls: string) => cls.replace('w-full ', '')

  return (
    <div className={DIALOG_BACKDROP_CLS} onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-label={ja.photoFocus.title}
        data-testid="photo-focus-modal"
        onClick={(e) => e.stopPropagation()}
        className={DIALOG_CARD_CLS}
      >
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className={DIALOG_TITLE_CLS}>{ja.photoFocus.title}</p>
            <p className="ja-phrase mt-0.5 text-xs text-ink-muted">{ja.photoFocus.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="tap-target shrink-0 rounded-full p-1 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* 写真ぜんぶ。ここをなぞって「見せたい場所」を決める。
            touchAction:'none' … なぞっている間に窓ごとスクロールしないようにする */}
        <div
          data-testid="photo-focus-picker"
          role="group"
          tabIndex={0}
          aria-label={ja.photoFocus.pickerAria}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(e) => {
            const step = PHOTO_FOCUS_KEY_STEP
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            }
            const move = moves[e.key]
            if (!move) return
            e.preventDefault()
            setValue((prev) => movePhotoFocus(prev, move[0], move[1]))
          }}
          style={{ touchAction: 'none' }}
          className="relative mx-auto mt-[var(--space-md)] block w-fit cursor-crosshair select-none"
        >
          <img
            ref={imageRef}
            src={photoUrl}
            alt={title}
            draggable={false}
            className="block max-h-[28vh] w-auto max-w-full rounded-sm"
          />
          {/* 指した場所の印。指が乗っていても見えるよう、中を抜いた輪にする */}
          <span
            data-testid="photo-focus-marker"
            aria-hidden
            style={{ left: `${value.x}%`, top: `${value.y}%` }}
            className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent shadow-md ring-2 ring-white/90"
          />
        </div>

        {/* 出来上がり。1つの値が2つの画面にどう効くのかを、押す前に並べて見せる。
            **窓の高さは390×844の画面で決めた**（写真・見本・ボタンがスクロールなしで収まる大きさ） */}
        <div className="mt-[var(--space-md)] flex items-start justify-center gap-[var(--space-sm)]">
          <div className="w-40 shrink-0">
            <span className="block aspect-video w-full overflow-hidden rounded-card border border-edge-card">
              <img
                data-testid="photo-focus-preview-detail"
                src={photoUrl}
                alt=""
                style={{ objectPosition: position }}
                className="h-full w-full object-cover"
              />
            </span>
            <p className="mt-0.5 text-center text-xs text-ink-muted">
              {ja.photoFocus.previewDetail}
            </p>
          </div>
          <div className="shrink-0">
            <span className="block aspect-square w-16 overflow-hidden rounded-card border border-edge-card">
              <img
                data-testid="photo-focus-preview-list"
                src={photoUrl}
                alt=""
                style={{ objectPosition: position }}
                className="h-full w-full object-cover"
              />
            </span>
            <p className="mt-0.5 text-center text-xs text-ink-muted">{ja.photoFocus.previewList}</p>
          </div>
        </div>

        {/* やり直す道（中央に戻す）は、決める道と同じ行に並べる＝**決めるボタンが
            スクロールしないと押せない位置に落ちない**（390×844で実測して決めた並び） */}
        <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          <div className="flex gap-[var(--space-sm)]">
            <button
              type="button"
              data-testid="photo-focus-reset"
              disabled={centered}
              onClick={() => setValue(PHOTO_FOCUS_CENTER)}
              className={`${inRow(DIALOG_CHOICE_BUTTON_CLS)} w-2/5 shrink-0 py-3 text-base disabled:opacity-40`}
            >
              {ja.photoFocus.reset}
            </button>
            <button
              type="button"
              data-testid="photo-focus-apply"
              onClick={() => onApply(centered ? undefined : value)}
              className={`${inRow(DIALOG_PRIMARY_BUTTON_CLS)} min-w-0 flex-1 py-3 text-base`}
            >
              {ja.photoFocus.apply}
            </button>
          </div>
          <button type="button" onClick={onClose} className={DIALOG_CANCEL_BUTTON_CLS}>
            {ja.common.confirmCancel}
          </button>
        </div>
      </div>
    </div>
  )
}
