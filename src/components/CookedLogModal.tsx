import { useEffect, useRef, useState } from 'react'
import { X, Camera, Image as ImageIcon, Minus, Plus, RotateCw } from 'lucide-react'
import SwapLabel from './SwapLabel'
import { ja } from '../i18n/ja'
import { resizePhoto, rotatePhoto } from '../logic/image'
import { usePhotoUrl } from './usePhotoUrl'
import { useScrollLock } from './useScrollLock'

// 記録写真は長辺1280px・JPEG品質0.8に圧縮する（docs/20 §4。レシピ写真本体の
// resizePhoto既定値・長辺1200px/品質0.85とはあえて別値。記録写真は数が増えやすいため）。
// 既存記録の編集フロー（RecipeDetailPageの記録編集）でも同じ保存形式にするためexportする
// （2026-07-16 便W-①）
export const LOG_PHOTO_MAX_EDGE = 1280
export const LOG_PHOTO_QUALITY = 0.8

type Props = {
  open: boolean
  date: string
  note: string
  photo?: Blob
  /**
   * 何人分作ったか（2026-07-29 便CI/C05）。従来は詳細画面の表示人数が黙って保存されるだけで、
   * 記録窓にも記録一覧にも出ず、ユーザーは値の存在も誤りも見えなかった。
   * onServingsChange を渡したときだけステッパー行を出す（渡さない呼び出し元との後方互換）
   */
  servings?: number
  onServingsChange?: (value: number) => void
  onDateChange: (value: string) => void
  onNoteChange: (value: string) => void
  onPhotoChange: (photo: Blob | undefined) => void
  onSave: () => void
  onClose: () => void
  /**
   * 在庫反映スイッチの状態（2026-07-23 オーナー実機FB #11）。onReflectPantryChange を渡した
   * ときだけスイッチUIを表示する（渡さない呼び出し元との後方互換のため両方とも任意）。
   */
  reflectPantry?: boolean
  onReflectPantryChange?: (value: boolean) => void
  /**
   * このレシピが「今日の献立」に入っているか（2026-07-29 便CI/R02）。
   * true のときだけ「記録すると今日の献立から外れる」旨を先に出す。
   * 実挙動は RecipeDetailPage の saveLog が removeFromTodayList を呼ぶところ（献立ページの
   * 「作った」も db/todayList.ts で同じことをする）で、どこにも書かれていなかった
   */
  inTodayList?: boolean
}

/**
 * 「作った！」記録の入力窓(2026-07-12)。
 * 以前はレシピ詳細の最下部にインライン展開していたが、展開のたびに画面全体のレイアウトが
 * 動いて見づらい、というオーナー実機フィードバックを受け、用語タップ辞書(TermPopover)と
 * 同じ見た目(角丸カード・枠線・shadow-md)を流用した中央寄せの窓表示に変更。
 * TermPopoverは「タップした語の近く」に出すポップオーバーだが、こちらは入力フォームで
 * 常に画面中央に出す方が扱いやすいため、位置決めロジックは共通化せずスタイルのみ流用する。
 * 背景タップ・×ボタン・Escapeで閉じる。フォーム内部のタップ(入力欄など)では閉じない。
 */
export default function CookedLogModal({
  open,
  date,
  note,
  photo,
  servings,
  onServingsChange,
  onDateChange,
  onNoteChange,
  onPhotoChange,
  onSave,
  onClose,
  reflectPantry,
  onReflectPantryChange,
  inTodayList,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState('')
  // 写真の回転(2026-08-09 便EN)。記録の編集フォーム(RecipeDetailPage)と同じ操作を、
  // 撮った直後のこの窓でも使えるようにする（向きを直してから記録できる）
  const [rotating, setRotating] = useState(false)
  const photoUrl = usePhotoUrl(photo)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useScrollLock(open)
  if (!open) return null

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    try {
      onPhotoChange(await resizePhoto(file, LOG_PHOTO_MAX_EDGE, LOG_PHOTO_QUALITY))
      setPhotoError('')
    } catch {
      setPhotoError(ja.form.photoError)
    }
  }

  /** 時計回りに90度回す。4回押せば元の向きに戻る（2026-08-09 便EN・オーナー要望） */
  const rotateCurrentPhoto = async () => {
    if (!photo || rotating) return
    setRotating(true)
    try {
      onPhotoChange(await rotatePhoto(photo, 1, LOG_PHOTO_QUALITY))
      setPhotoError('')
    } catch {
      setPhotoError(ja.form.photoError)
    } finally {
      setRotating(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      {/* overflow-x-hidden は「横には動かせない」ことをはっきり書くためのもの(2026-08-16 便HD・
          オーナー実機 iPhone SE2/Safari「作った！の窓の中の情報量が多すぎて、縦横にスクロール
          できる状態でした。写真はわかりやすいように右下を表示したものなので、余白や見出しも
          ちゃんとありました」)。
          縦に送る指定(overflow-y-auto)だけを書くと、CSSの規定でもう片方の軸の visible が auto に
          変わる＝横にも送れる箱になる。そこへ Safari だけが持つ行末約物のぶら下げ
          (src/index.css の hanging-punctuation: allow-end)のはみ出しが乗ると、中身は何も無いのに
          横へ動く。見た目は変わらない(はみ出しはもともと余白の中に収まっている)。
          同じ形の箱は src 全体で揃えてある(scripts/test-logic.mjs の HD-1 が見張る) */}
      <div
        role="dialog"
        aria-label={ja.detail.cookedDialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{ja.detail.cookedDialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
          {ja.detail.cookedDate}
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 block w-full min-w-0 max-w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink"
          />
        </label>
        {/* 何人分作ったか(2026-07-29 便CI/C05)。初期値は記録窓を開いた時点の詳細画面の表示人数 */}
        {onServingsChange && (
          <div className="mt-[var(--space-sm)]">
            <span className="block text-sm text-ink-muted">{ja.detail.cookedServings}</span>
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onServingsChange(Math.max(1, (servings ?? 1) - 1))}
                aria-label={ja.detail.servingsDown}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-app text-accent-ink shadow-sm"
              >
                <Minus size={20} aria-hidden />
              </button>
              <span className="min-w-14 text-center text-lg font-bold">
                {servings ?? 1}
                {ja.detail.servingsUnit}
              </span>
              <button
                type="button"
                onClick={() => onServingsChange((servings ?? 1) + 1)}
                aria-label={ja.detail.servingsUp}
                className="flex h-11 w-11 items-center justify-center rounded-md border border-edge bg-app text-accent-ink shadow-sm"
              >
                <Plus size={20} aria-hidden />
              </button>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{ja.detail.cookedServingsHint}</p>
          </div>
        )}
        <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
          {ja.detail.cookedNote}
          <input
            type="text"
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={ja.detail.cookedNotePlaceholder}
            className="mt-1 block w-full min-w-0 max-w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink"
          />
        </label>
        <div className="mt-[var(--space-sm)]">
          <span className="block text-sm text-ink-muted">{ja.detail.cookedPhotoLabel}</span>
          {photoUrl && (
            <img
              src={photoUrl}
              alt=""
              className="mt-1 aspect-video w-full rounded-md object-cover shadow-sm"
            />
          )}
          <div className="mt-2 flex gap-2">
            {/* capture="environment" 付き → スマホでカメラが直接開く（RecipeFormPageの写真欄と同じ仕組み） */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                void onPhotoSelected(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <input
              ref={albumInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPhotoSelected(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-app py-2 text-sm font-bold shadow-sm"
            >
              <Camera size={18} className="text-accent-ink" aria-hidden />
              {ja.form.photoTake}
            </button>
            <button
              type="button"
              onClick={() => albumInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-app py-2 text-sm font-bold shadow-sm"
            >
              <ImageIcon size={18} className="text-accent-ink" aria-hidden />
              {ja.form.photoPick}
            </button>
          </div>
          {photo && (
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              {/* 向きを直してから記録できるようにする(2026-08-09 便EN)。押すたびに時計回りに90度 */}
              <button
                type="button"
                onClick={() => void rotateCurrentPhoto()}
                disabled={rotating}
                className="inline-flex items-center gap-1 text-sm font-bold text-accent-ink disabled:opacity-40"
              >
                <RotateCw size={16} aria-hidden />
                {/* 回している間だけ文言が短くなり、右隣の削除ボタンが飛び込んできていた
                    （2026-08-09 便EO）。長い方の幅で固定する */}
                <SwapLabel
                  current={
                    rotating ? ja.detail.cookedLogPhotoRotating : ja.detail.cookedLogPhotoRotate
                  }
                  labels={[ja.detail.cookedLogPhotoRotate, ja.detail.cookedLogPhotoRotating]}
                />
              </button>
              <button
                type="button"
                onClick={() => onPhotoChange(undefined)}
                className="text-sm text-warning underline"
              >
                {ja.detail.cookedLogPhotoRemove}
              </button>
            </div>
          )}
          {photoError && <p className="mt-1 text-sm text-warning">{photoError}</p>}
        </div>
        {/* 在庫反映スイッチ(2026-07-23 オーナー実機FB #11)。既定OFF・選択を記憶。
            ON時、記録すると使った食材の在庫を1段階下げる(調味料系は対象外) */}
        {onReflectPantryChange && (
          <div className="mt-[var(--space-md)] flex items-center justify-between gap-3 rounded-md border border-edge bg-app p-[var(--space-sm)]">
            <div className="min-w-0">
              <span className="font-bold">{ja.detail.cookedReflectPantryLabel}</span>
              <p className="mt-1 text-sm text-ink-muted">{ja.detail.cookedReflectPantryHint}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!reflectPantry}
              aria-label={ja.detail.cookedReflectPantryLabel}
              onClick={() => onReflectPantryChange(!reflectPantry)}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                reflectPantry ? 'bg-accent' : 'bg-edge'
              }`}
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                  reflectPantry ? 'left-7' : 'left-1'
                }`}
              />
            </button>
          </div>
        )}
        {/* 今日の献立に入っている料理だけ、記録すると外れることを先に伝える(便CI/R02) */}
        {inTodayList && (
          <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
            {ja.detail.cookedTodayListNote}
          </p>
        )}
        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-md bg-accent py-3 text-lg font-bold text-on-accent shadow-sm"
          >
            {ja.detail.cookedSave}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted"
          >
            {ja.detail.cookedCancel}
          </button>
        </div>
      </div>
    </div>
  )
}
