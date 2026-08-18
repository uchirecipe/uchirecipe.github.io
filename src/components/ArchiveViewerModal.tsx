import { X } from 'lucide-react'
import { ja } from '../i18n/ja'
import { archivePhotoDataUrl, type ArchivedCookedLog } from '../logic/cookedArchive'
import { useOverlayDismiss } from './useOverlayDismiss'
import { useScrollLock } from './useScrollLock'

type Props = {
  open: boolean
  logs: ArchivedCookedLog[]
  /** 読めなかった記録の件数（0なら出さない） */
  brokenCount: number
  onClose: () => void
}

/**
 * 書き出したアーカイブファイルの中身を、その場で読むだけの窓（2026-08-02 古い記録の書き出し）。
 *
 * 読み込み専用: 受け取った記録はこの窓が持っているだけで、IndexedDBには一切書かない。
 * 窓を閉じれば端末には何も残らない（写真もファイルの中のBase64をそのままdata URLで描くだけで、
 * Blobにも保存にも変換しない）。取り込みと取り違えられないよう、先頭に帯で明記する。
 *
 * 並びは日付の新しい順（parseArchiveFile / sortArchivedLogs で整えたものをそのまま描く）。
 */
export default function ArchiveViewerModal({ open, logs, brokenCount, onClose }: Props) {
  useOverlayDismiss(open, onClose)
  useScrollLock(open)
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.settings.archiveViewTitle}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-sm min-w-0 flex-col rounded-md border border-edge bg-surface shadow-md"
      >
        <div className="flex items-center justify-between gap-2 border-b border-edge px-[var(--space-md)] py-3">
          <h3 className="font-bold">{ja.settings.archiveViewTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="tap-target -mr-2 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* 「端末には保存されません」の帯。取り込みではないことを最初に伝える */}
        <p
          data-testid="archive-view-banner"
          className="border-b border-edge bg-app px-[var(--space-md)] py-2 text-sm font-bold text-accent-ink"
        >
          {ja.settings.archiveViewBanner}
        </p>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <p className="px-[var(--space-md)] pt-[var(--space-sm)] text-sm text-ink-muted">
            {ja.settings.archiveViewCount.replace('{n}', String(logs.length))}
          </p>
          {brokenCount > 0 && (
            <p className="px-[var(--space-md)] pt-1 text-sm font-bold text-warning">
              {ja.settings.archiveViewBroken.replace('{n}', String(brokenCount))}
            </p>
          )}
          {logs.length === 0 ? (
            <p className="px-[var(--space-md)] py-[var(--space-md)] text-sm text-ink-muted">
              {ja.settings.archiveViewEmpty}
            </p>
          ) : (
            <ul className="divide-y divide-edge">
              {logs.map((log) => {
                const photo = archivePhotoDataUrl(log)
                return (
                  <li
                    key={log.id}
                    className="flex items-start gap-[var(--space-sm)] px-[var(--space-md)] py-3"
                  >
                    {photo && (
                      <img
                        src={photo}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-sm object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{log.recipeTitle}</p>
                      {log.note && <p className="mt-0.5 text-sm text-ink-muted">{log.note}</p>}
                    </div>
                    <span className="shrink-0 text-right text-sm text-ink-muted">
                      {log.date.replaceAll('-', '/')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
