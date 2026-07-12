import { useEffect, useRef, useState } from 'react'
import { X, Camera, Image as ImageIcon } from 'lucide-react'
import { ja } from '../i18n/ja'
import { resizePhoto } from '../logic/image'
import { usePhotoUrl } from './usePhotoUrl'

// 記録写真は長辺1280px・JPEG品質0.8に圧縮する（docs/20 §4。レシピ写真本体の
// resizePhoto既定値・長辺1200px/品質0.85とはあえて別値。記録写真は数が増えやすいため）
const LOG_PHOTO_MAX_EDGE = 1280
const LOG_PHOTO_QUALITY = 0.8

type Props = {
  open: boolean
  date: string
  note: string
  photo?: Blob
  onDateChange: (value: string) => void
  onNoteChange: (value: string) => void
  onPhotoChange: (photo: Blob | undefined) => void
  onSave: () => void
  onClose: () => void
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
  onDateChange,
  onNoteChange,
  onPhotoChange,
  onSave,
  onClose,
}: Props) {
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)
  const [photoError, setPhotoError] = useState('')
  const photoUrl = usePhotoUrl(photo)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

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

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.detail.cookedDialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
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
              <Camera size={18} className="text-accent" aria-hidden />
              {ja.form.photoTake}
            </button>
            <button
              type="button"
              onClick={() => albumInputRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-app py-2 text-sm font-bold shadow-sm"
            >
              <ImageIcon size={18} className="text-accent" aria-hidden />
              {ja.form.photoPick}
            </button>
          </div>
          {photo && (
            <button
              type="button"
              onClick={() => onPhotoChange(undefined)}
              className="mt-2 text-sm text-warning underline"
            >
              {ja.form.photoRemove}
            </button>
          )}
          {photoError && <p className="mt-1 text-sm text-warning">{photoError}</p>}
        </div>
        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            onClick={onSave}
            className="flex-1 rounded-md bg-accent py-3 text-lg font-bold text-app shadow-sm"
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
