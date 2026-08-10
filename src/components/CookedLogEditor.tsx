import { useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Minus, Plus, RotateCw } from 'lucide-react'
import type { CookedLog } from '../db/types'
import { deleteCookedLog, updateCookedLog } from '../db/recipes'
import { resizePhoto, rotatePhoto } from '../logic/image'
import { usePhotoUrl } from './usePhotoUrl'
import { LOG_PHOTO_MAX_EDGE, LOG_PHOTO_QUALITY } from './CookedLogModal'
import { ja } from '../i18n/ja'

/**
 * 「作った記録」1件を直す入力欄（2026-08-10 便FD で共通部品に切り出した）。
 *
 * 経緯: 記録を直す欄はレシピ詳細の中にしか無く、カレンダー（月タブの日の窓）や
 * 記録の小窓から「この記録を編集する」を押すと、レシピ詳細まで飛ばされていた
 * （オーナー実機「カレンダーなどから編集するを選択すると、問答無用でレシピ詳細画面に
 * 飛ばされる。カレンダーなどの元の画面で編集が完結できるようにして」）。
 * 同じ入力欄を2つ書かないために、レシピ詳細が持っていた欄をそのままこの部品にし、
 * 記録の小窓からも同じものを開く。
 *
 * 直せるのは記録そのもの（日付・何人分・ひとことメモ・写真）だけで、
 * 献立の枠には触らない（記録と予定を混ぜない。docs/69「記録は一方通行」と同じ向き）。
 */
export default function CookedLogEditor({
  recipeId,
  logIndex,
  log,
  fallbackServings,
  totalLogCount,
  onSaved,
  onCancel,
  onDeleted,
}: {
  recipeId: number
  /** recipe.cookedLogs の中での添字（保存すると日付順に並べ直すので変わりうる） */
  logIndex: number
  log: CookedLog
  /** 人数が記録されていない古い記録の初期値（レシピの登録人数分。便CI/C05） */
  fallbackServings: number
  /** そのレシピの記録の総件数（削除の確認文で「残る件数」を出すのに使う。規約F） */
  totalLogCount: number
  /** 保存できた。引数は並べ直したあとの添字（開いたまま見せ続ける画面が使う） */
  onSaved: (newIndex: number) => void
  /** 「やめる」を押した（何も書き込んでいない） */
  onCancel: () => void
  /** 記録を1件消した */
  onDeleted: () => void
}) {
  const [date, setDate] = useState(log.date)
  const [note, setNote] = useState(log.note ?? '')
  const [servings, setServings] = useState<number>(log.servings ?? fallbackServings)
  // 既存写真で初期化し、新しく選べば差し替え・undefinedにすれば削除。
  // 保存時は常にこの値を photo として書き戻す（新規作成時＝CookedLogModalと同じ保存形式）
  const [photo, setPhoto] = useState<Blob | undefined>(log.photo)
  const [photoError, setPhotoError] = useState('')
  // 「保存前に回したか」だけを持つ＝保存を押さずに閉じると元の向きのままだと、その場で伝える
  const [photoRotated, setPhotoRotated] = useState(false)
  const [rotating, setRotating] = useState(false)
  const photoUrl = usePhotoUrl(photo)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const albumInputRef = useRef<HTMLInputElement>(null)

  const onPhotoSelected = async (file: File | undefined) => {
    if (!file) return
    try {
      setPhoto(await resizePhoto(file, LOG_PHOTO_MAX_EDGE, LOG_PHOTO_QUALITY))
      setPhotoError('')
      setPhotoRotated(false)
    } catch {
      setPhotoError(ja.form.photoError)
    }
  }

  /**
   * 写真を時計回りに90度回す（2026-08-09 便EN）。4回押せば元の向きに戻る。
   * 書き戻すのは保存のときだけなので、回しただけで閉じれば元の写真のまま。
   */
  const rotate = async () => {
    if (!photo || rotating) return
    setRotating(true)
    try {
      setPhoto(await rotatePhoto(photo, 1, LOG_PHOTO_QUALITY))
      setPhotoError('')
      setPhotoRotated(true)
    } catch {
      setPhotoError(ja.form.photoError)
    } finally {
      setRotating(false)
    }
  }

  const save = async () => {
    if (!date) return
    const newIndex = await updateCookedLog(recipeId, logIndex, {
      date,
      note: note.trim() || undefined,
      photo,
      servings,
    })
    onSaved(newIndex ?? logIndex)
  }

  /** 元に戻せない操作なので、規約Fに沿って「何が消えるか」「何が残るか」を件数つきで確認する */
  const remove = async () => {
    const message = ja.detail.cookedLogDeleteConfirm
      .replace('{date}', log.date.replaceAll('-', '/'))
      .replace('{p}', log.photo ? ja.detail.cookedLogDeleteConfirmPhoto : '')
      .replace('{n}', String(Math.max(0, totalLogCount - 1)))
    if (!window.confirm(message)) return
    await deleteCookedLog(recipeId, logIndex)
    onDeleted()
  }

  return (
    <div data-testid="cooked-log-editor" className="space-y-2">
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink"
      />
      {/* 何人分作ったか(2026-07-29 便CI/C05)。人数の入力漏れ・持ち越しを後から直せる唯一の場所 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-muted">{ja.detail.cookedServings}</span>
        <button
          type="button"
          onClick={() => setServings(Math.max(1, servings - 1))}
          aria-label={ja.detail.servingsDown}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-edge bg-app text-accent-ink shadow-sm"
        >
          <Minus size={16} aria-hidden />
        </button>
        <span className="min-w-12 text-center font-bold">
          {servings}
          {ja.detail.servingsUnit}
        </span>
        <button
          type="button"
          onClick={() => setServings(servings + 1)}
          aria-label={ja.detail.servingsUp}
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-edge bg-app text-accent-ink shadow-sm"
        >
          <Plus size={16} aria-hidden />
        </button>
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={ja.detail.cookedLogNotePlaceholder}
        className="block w-full rounded-sm border border-edge bg-app px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60"
      />
      {/* 写真: 追加・差し替え・削除に対応(2026-07-16 便W-①。新規作成時と同じ操作・保存形式) */}
      <div>
        {photoUrl && (
          <img src={photoUrl} alt="" className="h-16 w-16 shrink-0 rounded-sm object-cover shadow-sm" />
        )}
        <div className="mt-2 flex gap-2">
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
            className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold shadow-sm"
          >
            <Camera size={16} className="text-accent-ink" aria-hidden />
            {ja.form.photoTake}
          </button>
          <button
            type="button"
            onClick={() => albumInputRef.current?.click()}
            className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold shadow-sm"
          >
            <ImageIcon size={16} className="text-accent-ink" aria-hidden />
            {ja.form.photoPick}
          </button>
        </div>
        {photo && (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => void rotate()}
                disabled={rotating}
                className="inline-flex items-center gap-1 text-sm font-bold text-accent-ink disabled:opacity-40"
              >
                <RotateCw size={16} aria-hidden />
                {rotating ? ja.detail.cookedLogPhotoRotating : ja.detail.cookedLogPhotoRotate}
              </button>
              <button
                type="button"
                onClick={() => setPhoto(undefined)}
                className="text-sm text-warning underline"
              >
                {ja.detail.cookedLogPhotoRemove}
              </button>
            </div>
            {/* 回しただけでは残らないので、保存を押す必要をその場で伝える */}
            {photoRotated && (
              <p className="mt-1 text-sm text-ink-muted">{ja.detail.cookedLogPhotoRotateUnsaved}</p>
            )}
          </>
        )}
        {photoError && <p className="mt-1 text-sm text-warning">{photoError}</p>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="flex-1 rounded-sm bg-accent py-2 text-sm font-bold text-on-accent shadow-sm"
        >
          {ja.detail.cookedLogSave}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-sm border border-edge px-3 py-2 text-sm text-ink-muted"
        >
          {ja.detail.cookedLogCancel}
        </button>
      </div>
      {/* 記録そのものの削除(2026-07-29 便CI/C02)。確認文は規約F(何が消えて何が残るかを件数つきで) */}
      <button
        type="button"
        onClick={() => void remove()}
        className="text-sm text-warning underline"
      >
        {ja.detail.cookedLogDelete}
      </button>
    </div>
  )
}
