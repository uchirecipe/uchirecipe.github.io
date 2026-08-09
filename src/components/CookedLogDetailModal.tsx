import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Maximize2, Pencil, X } from 'lucide-react'
import type { CookedLog, Recipe } from '../db/types'
import { usePhotoUrl } from './usePhotoUrl'
import { useOverlayDismiss } from './useOverlayDismiss'
import { ja } from '../i18n/ja'

/** 小窓に出す記録1件。logIndex は recipe.cookedLogs の添字（記録の編集を開くのに使う） */
export interface CookedLogDetailTarget {
  recipe: Recipe
  log: CookedLog
  logIndex: number
}

/**
 * 記録の写真を大きく見る窓（2026-08-09 便EQ）。
 * 見た目はレシピ詳細の原寸表示と同じ（角丸カード・枠線・shadow-md・中央寄せ）。
 * 重ね窓なので Escape と端末の「戻る」で1枚だけ閉じる（useOverlayDismiss）。
 */
function CookedPhotoViewer({ photo, onClose }: { photo: Blob; onClose: () => void }) {
  const url = usePhotoUrl(photo)
  useOverlayDismiss(true, onClose)
  if (!url) return null
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.detail.cookedPhotoView}
        onClick={(e) => e.stopPropagation()}
        className="relative max-h-[85vh] w-full max-w-full rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-md"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={ja.common.close}
          className="absolute -right-2 -top-2 rounded-full border border-edge bg-surface p-1.5 text-ink-muted shadow-sm"
        >
          <X size={18} aria-hidden />
        </button>
        {/* 画面の幅いっぱいまで使い、縦は画面に収まる範囲で切り取らずに全体を出す
            （小窓のサムネイルは横長に切り取っているので、縦長の写真ほど差が大きい） */}
        <img
          src={url}
          alt=""
          className="max-h-[80vh] w-full rounded-sm object-contain"
        />
      </div>
    </div>
  )
}

/** 「項目名／中身」の1行。入れていない欄も出す＝何を入れて何を入れていないかが読める */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function BlankValue() {
  return <span className="text-ink-muted">{ja.cookedDetail.blank}</span>
}

type Props = {
  target: CookedLogDetailTarget
  onClose: () => void
  /**
   * レシピ詳細へ持ち回る出所。献立の週タブのように「戻る」で呼び出し元へ帰したい画面が渡す
   * （RecipeDetailPage の backFallback が読む）。
   */
  linkState?: { from: string; fromPath: string }
  /** レシピ詳細・記録の編集へ移る直前の後片付け（居場所を覚える・下の窓を閉じる等） */
  onNavigate?: () => void
}

/**
 * 「作った記録」1件の中身をその場で開く小窓（2026-08-09 便EQ・オーナー実機）。
 *
 * オーナーの指摘は2つ。①料理名を押しても記録ではなくレシピ詳細が開く
 * ②写真を大きく見られる場所がレシピ詳細の中にしかない。
 * そこで、記録が並ぶ4か所（ホームの「最近作ったもの」・献立の作った！済みの枠・
 * 月タブの日の窓・作った記録の一覧）から同じこの小窓を開き、記録したときに入れた内容を
 * まとめて読めるようにした。一覧の画面へ移動はしない（オーナー「記録一覧にいくわけではない」）。
 *
 * 記録の編集はレシピ詳細が持っている編集フォームへ渡す（同じ入力欄を2つ作らない）。
 */
export default function CookedLogDetailModal({ target, onClose, linkState, onNavigate }: Props) {
  const { recipe, log, logIndex } = target
  const [zoomOpen, setZoomOpen] = useState(false)
  const photoUrl = usePhotoUrl(log.photo)
  useOverlayDismiss(true, onClose)

  // 端末に無いレシピ（月間サンプルデモの見本）は移動先が無いので操作を出さない
  const recipePath = recipe.id != null ? `/recipes/${recipe.id}` : null

  return (
    <>
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
        onClick={onClose}
        role="presentation"
      >
        <div
          role="dialog"
          aria-label={ja.cookedDetail.dialogAria.replace('{title}', recipe.title)}
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink-muted">{ja.cookedDetail.label}</p>
              <h3 className="text-lg font-bold">{recipe.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={ja.common.close}
              className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <dl className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
            <DetailRow label={ja.cookedDetail.date}>
              <span className="font-bold">{log.date.replaceAll('-', '/')}</span>
            </DetailRow>
            <DetailRow label={ja.cookedDetail.servings}>
              {log.servings != null ? (
                <span className="font-bold">
                  {ja.detail.cookedServingsValue.replace('{n}', String(log.servings))}
                </span>
              ) : (
                <BlankValue />
              )}
            </DetailRow>
            <DetailRow label={ja.cookedDetail.note}>
              {log.note ? <p className="break-words">{log.note}</p> : <BlankValue />}
            </DetailRow>
            <DetailRow label={ja.cookedDetail.photo}>
              {log.photo && photoUrl ? (
                // 押すと大きく開く。虫めがねの印を写真の上に重ねて「押せる」ことを見せる
                <button
                  type="button"
                  onClick={() => setZoomOpen(true)}
                  aria-label={ja.detail.cookedPhotoView}
                  className="relative block w-full overflow-hidden rounded-md shadow-sm"
                >
                  <img src={photoUrl} alt="" className="h-40 w-full object-cover" />
                  <span className="absolute bottom-1 right-1 rounded-full border border-edge bg-surface p-1.5 text-ink-muted">
                    <Maximize2 size={16} aria-hidden />
                  </span>
                </button>
              ) : (
                <BlankValue />
              )}
            </DetailRow>
          </dl>

          {recipePath && (
            <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
              {/* 記録を直す先はレシピ詳細の編集フォーム（?editLog= で開く記録を指定する） */}
              <Link
                to={`${recipePath}?editLog=${logIndex}`}
                state={linkState}
                onClick={onNavigate}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-app py-3 font-bold text-accent-ink shadow-sm"
              >
                <Pencil size={18} aria-hidden />
                {ja.cookedDetail.edit}
              </Link>
              <Link
                to={recipePath}
                state={linkState}
                onClick={onNavigate}
                className="flex w-full items-center justify-center gap-1 rounded-md border border-edge bg-app py-3 font-bold text-accent-ink shadow-sm"
              >
                {ja.cookedDetail.openRecipe}
                <ChevronRight size={18} aria-hidden />
              </Link>
            </div>
          )}
        </div>
      </div>
      {zoomOpen && log.photo && (
        <CookedPhotoViewer photo={log.photo} onClose={() => setZoomOpen(false)} />
      )}
    </>
  )
}
