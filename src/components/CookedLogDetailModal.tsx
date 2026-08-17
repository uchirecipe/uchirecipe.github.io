import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Maximize2, Pencil, Trash2, X } from 'lucide-react'
import type { CookedLog, Recipe } from '../db/types'
import { db } from '../db/db'
import { usePhotoUrl } from './usePhotoUrl'
import { useOverlayDismiss } from './useOverlayDismiss'
import { useScrollLock } from './useScrollLock'
import { useConfirm } from './ConfirmProvider'
import CookedLogEditor from './CookedLogEditor'
import { deleteDetachedLog } from '../db/detachedLogs'
import { ja } from '../i18n/ja'

/** 小窓に出す記録1件。logIndex は recipe.cookedLogs の添字（記録の編集を開くのに使う） */
export interface CookedLogDetailTarget {
  recipe: Recipe
  log: CookedLog
  logIndex: number
  /**
   * レシピを削除したあとも残っている記録なら、そのまとまりの番号（detachedLogs テーブルの id。
   * 2026-08-16 便GZ）。このとき recipe は「削除された時点の料理名を持つだけの形」
   * （logic/detachedLogs.ts の detachedRecipeStub）で id を持たないので、
   * レシピ詳細への行き先も、レシピ側へ書き戻す編集も出さない。
   */
  detachedRecordId?: number
}

/**
 * 記録の写真を大きく見る窓（2026-08-09 便EQ）。
 * 見た目はレシピ詳細の原寸表示と同じ（角丸カード・枠線・shadow-md・中央寄せ）。
 * 重ね窓なので Escape と端末の「戻る」で1枚だけ閉じる（useOverlayDismiss）。
 */
function CookedPhotoViewer({ photo, onClose }: { photo: Blob; onClose: () => void }) {
  const url = usePhotoUrl(photo)
  useOverlayDismiss(true, onClose)
  useScrollLock(true)
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

/**
 * 「項目名／中身」の1行。
 * 2026-08-10 便FD（オーナー実機「コンパクトに」）: 空の欄は行ごと出さないので、
 * ここへ来るのは中身がある欄だけになった。
 */
function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

type Props = {
  target: CookedLogDetailTarget
  onClose: () => void
  /**
   * レシピ詳細へ持ち回る出所。献立の週タブのように「戻る」で呼び出し元へ帰したい画面が渡す
   * （RecipeDetailPage の backFallback が読む）。
   */
  linkState?: { from: string; fromPath: string }
  /** レシピ詳細へ移る直前の後片付け（居場所を覚える・下の窓を閉じる等） */
  onNavigate?: () => void
  /** 記録を直した・消したときの一言（呼び出し側のトーストに出す） */
  onMessage?: (text: string) => void
}

/**
 * 「作った記録」1件の中身をその場で開く小窓（2026-08-09 便EQ・オーナー実機）。
 *
 * 記録が並ぶ4か所（献立の「日」の「最近作ったもの」・献立の作った！済みの枠・
 * 月タブの日の窓・作った記録の一覧）から同じこの小窓を開き、記録したときに入れた内容を
 * まとめて読めるようにしてある。一覧の画面へ移動はしない。
 *
 * 2026-08-10 便FD（オーナー実機）で2つ直した:
 *  ①コンパクトに。食数は料理名の横へ（「きんぴらごぼう（3人分）」）、
 *    入れていない欄（ひとことメモ・写真）は行ごと省く。
 *  ②「この記録を編集する」でレシピ詳細へ飛ばさず、**この窓の中で直して終われる**ようにした
 *    （オーナー「カレンダーなどの元の画面で編集が完結できるようにして」）。
 *    入力欄はレシピ詳細と同じ共通部品（CookedLogEditor）＝同じ欄を2つ持たない。
 */
export default function CookedLogDetailModal({
  target,
  onClose,
  linkState,
  onNavigate,
  onMessage,
}: Props) {
  const { recipe, detachedRecordId } = target
  const confirm = useConfirm()
  const [zoomOpen, setZoomOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  /** 直したあとは並び順が変わりうるので、いま見ている記録の位置は窓側で持ち直す */
  const [logIndex, setLogIndex] = useState(target.logIndex)
  useOverlayDismiss(true, onClose)
  useScrollLock(true)

  // 直した内容をその場で出し直すため、記録は端末から読み直す（開いたときの写しを見続けない）。
  // まだ届いていない・レシピが消えた等で読めないときは、開いたときの写しをそのまま使う
  const liveRecipe = useLiveQuery(
    async () => (recipe.id != null ? ((await db.recipes.get(recipe.id)) ?? null) : null),
    [recipe.id],
  )
  const log = liveRecipe?.cookedLogs[logIndex] ?? target.log
  const logCount = liveRecipe?.cookedLogs.length ?? 1
  const photoUrl = usePhotoUrl(log.photo)

  // 端末に無いレシピ（月間サンプルデモの見本・削除済みレシピの記録）は移動先が無いので操作を出さない
  const recipePath = recipe.id != null ? `/recipes/${recipe.id}` : null

  /**
   * 削除済みレシピの記録を1件だけ消す（2026-08-16 便GZ）。
   * これが無いと、レシピを消したあとの記録は二度と減らせない（レシピ側の「この記録を削除」と対）。
   * 確認文は規約F: 何が消えて何が残るかを件数つきで両方書く。
   */
  const removeDetachedLog = async () => {
    if (detachedRecordId == null) return
    const t = ja.cookedDetail
    const ok = await confirm({
      title: t.deletedRecipeLogDeleteTitle.replace('{date}', log.date.replaceAll('-', '/')),
      bullets: [
        {
          label: t.deletedRecipeLogDeleteGoneLabel,
          text: t.deletedRecipeLogDeleteGone.replace(
            '{p}',
            log.photo ? t.deletedRecipeLogDeleteGonePhoto : '',
          ),
        },
        {
          label: t.deletedRecipeLogDeleteKeptLabel,
          text: t.deletedRecipeLogDeleteKept.replace(
            '{n}',
            String(Math.max(0, recipe.cookedLogs.length - 1)),
          ),
        },
      ],
      confirmLabel: t.deletedRecipeLogDeleteOk,
    })
    if (!ok) return
    await deleteDetachedLog(detachedRecordId, logIndex)
    onClose()
    onMessage?.(ja.detail.cookedLogDeletedToast)
  }

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
          className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-ink-muted">{ja.cookedDetail.label}</p>
              {/* 食数は料理名の横に添える（2026-08-10 便FD・オーナー実機
                  「「きんぴらごぼう　（3食分）」のように食数は簡略」）。
                  単位は記録に付いている「◯人分」のまま＝アプリの他の場所と同じ言い方にする */}
              <h3 data-testid="cooked-detail-title" className="text-lg font-bold">
                {recipe.title}
                {log.servings != null && (
                  <span className="ml-1 text-base">
                    （{ja.detail.cookedServingsValue.replace('{n}', String(log.servings))}）
                  </span>
                )}
              </h3>
              <p className="mt-0.5 text-sm text-ink-muted">{log.date.replaceAll('-', '/')}</p>
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

          {editing && recipe.id != null ? (
            <div className="mt-[var(--space-md)]">
              <CookedLogEditor
                recipeId={recipe.id}
                logIndex={logIndex}
                log={log}
                fallbackServings={recipe.servings}
                totalLogCount={logCount}
                onSaved={(newIndex) => {
                  setLogIndex(newIndex)
                  setEditing(false)
                  onMessage?.(ja.cookedDetail.savedToast)
                }}
                onCancel={() => setEditing(false)}
                onDeleted={() => {
                  setEditing(false)
                  onClose()
                  onMessage?.(ja.detail.cookedLogDeletedToast)
                }}
              />
            </div>
          ) : (
            <>
              {/* 入れていない欄は出さない（2026-08-10 便FD「コンパクトに」）。
                  入れ忘れに気づいたら「この記録を編集する」で足せる＝欄が消えても行き止まりにならない */}
              {(log.note || (log.photo && photoUrl)) && (
                <dl className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                  {log.note && (
                    <DetailRow label={ja.cookedDetail.note}>
                      <p className="break-words">{log.note}</p>
                    </DetailRow>
                  )}
                  {log.photo && photoUrl && (
                    <DetailRow label={ja.cookedDetail.photo}>
                      {/* 押すと大きく開く。虫めがねの印を写真の上に重ねて「押せる」ことを見せる */}
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
                    </DetailRow>
                  )}
                </dl>
              )}

              {/* レシピを削除したあとも残っている記録（2026-08-16 便GZ）。
                  レシピ詳細への行き先が無い理由を書いておく＝行けないことが読んで分かる */}
              {detachedRecordId != null && (
                <div
                  data-testid="cooked-detail-deleted-recipe"
                  className="mt-[var(--space-md)] rounded-md border border-edge bg-app p-[var(--space-sm)]"
                >
                  <p className="text-sm font-bold">{ja.cookedDetail.deletedRecipeLabel}</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {ja.cookedDetail.deletedRecipeNote}
                  </p>
                </div>
              )}

              <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
                {/* 直す場所はこの窓の中（2026-08-10 便FD）。カレンダーから開いても
                    レシピ詳細へ移らずに終われる */}
                {recipe.id != null && (
                  <button
                    type="button"
                    data-testid="cooked-detail-edit"
                    onClick={() => setEditing(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-app py-3 font-bold text-accent-ink shadow-sm"
                  >
                    <Pencil size={18} aria-hidden />
                    {ja.cookedDetail.edit}
                  </button>
                )}
                {recipePath && (
                  <Link
                    to={recipePath}
                    state={linkState}
                    onClick={onNavigate}
                    className="flex w-full items-center justify-center gap-1 rounded-md border border-edge bg-app py-3 font-bold text-accent-ink shadow-sm"
                  >
                    {ja.cookedDetail.openRecipe}
                    <ChevronRight size={18} aria-hidden />
                  </Link>
                )}
                {/* 残った記録を減らす唯一の手立て（2026-08-16 便GZ）。
                    レシピ側の「この記録を削除」と同じ位置づけなので、同じ確認の作法で消す */}
                {detachedRecordId != null && (
                  <button
                    type="button"
                    data-testid="cooked-detail-delete-detached"
                    onClick={() => void removeDetachedLog()}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-app py-3 font-bold text-ink-muted shadow-sm"
                  >
                    <Trash2 size={18} aria-hidden />
                    {ja.cookedDetail.deletedRecipeLogDelete}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {zoomOpen && log.photo && (
        <CookedPhotoViewer photo={log.photo} onClose={() => setZoomOpen(false)} />
      )}
    </>
  )
}
