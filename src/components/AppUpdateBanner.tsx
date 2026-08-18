import { useEffect, useState } from 'react'
import { X, ArrowDownToLine } from 'lucide-react'
import { ja } from '../i18n/ja'
import { isAppBusy, subscribeAppBusy } from '../logic/appBusy'
import {
  applyAppUpdate,
  dismissAppUpdateBanner,
  isAppUpdateBannerDismissed,
  isAppUpdateReady,
  subscribeAppUpdate,
} from '../logic/appUpdate'
import { useTimers } from './TimerProvider'

/**
 * 文字を打ち込める場所にカーソルが入っているか。
 * チェックボックスやボタンは対象外(そこに触れているだけでは、作業が飛んで困るものはない)。
 */
function isTypingNow(): boolean {
  const active = document.activeElement
  if (!active) return false
  if (active instanceof HTMLTextAreaElement) return true
  if (active instanceof HTMLElement && active.isContentEditable) return true
  if (active instanceof HTMLInputElement) {
    const notTyping = ['checkbox', 'radio', 'button', 'submit', 'reset', 'file', 'range', 'color']
    return !notTyping.includes(active.type)
  }
  return false
}

/**
 * 新しいバージョンが入ったことを、画面下の帯で控えめに知らせる(2026-08-09 便ER)。
 *
 * 押すとその場で画面を読み込み直して最新になる。押さなくても、次にアプリを開き直したときには
 * 自動で新しいバージョンになる(src/logic/appUpdate.tsの説明を参照)。
 *
 * 出さない場面(作業を壊さないため・logic/appBusy.ts):
 * ・調理中モード / 並行調理ナビの段取り実行中
 * ・レシピの入力中(レシピを書く画面を開いている間・文字を打ち込む欄にカーソルがある間)
 * ・タイマーが動いている間
 * これらが終わると帯が出る。閉じるとそのセッションでは出さないが、
 * 設定の「アプリの更新」からはいつでも最新にできる。
 */
export default function AppUpdateBanner() {
  const { timers } = useTimers()
  const [ready, setReady] = useState(isAppUpdateReady)
  const [dismissed, setDismissed] = useState(isAppUpdateBannerDismissed)
  const [busy, setBusy] = useState(() => isAppBusy() || isTypingNow())

  // 新しいバージョンが入った / 帯を閉じた、を受け取る
  useEffect(
    () =>
      subscribeAppUpdate(() => {
        setReady(isAppUpdateReady())
        setDismissed(isAppUpdateBannerDismissed())
      }),
    [],
  )

  // 「中断されると困る作業」の増減と、文字入力欄への出入りを見る
  useEffect(() => {
    const sync = () => setBusy(isAppBusy() || isTypingNow())
    const unsubscribe = subscribeAppBusy(sync)
    document.addEventListener('focusin', sync)
    document.addEventListener('focusout', sync)
    return () => {
      unsubscribe()
      document.removeEventListener('focusin', sync)
      document.removeEventListener('focusout', sync)
    }
  }, [])

  if (!ready || dismissed || busy || timers.length > 0) return null

  return (
    <div
      data-testid="app-update-banner"
      /* 下部に固定される帯の印（2026-08-11 便FN）。ページの下余白がこの帯のぶんも空ける */
      data-app-bottom-bar
      className="fixed inset-x-0 z-[60] flex justify-center px-[var(--space-md)]"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm items-start gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-[var(--space-sm)] shadow-md motion-safe:animate-toast-in">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{ja.settings.appUpdateBannerTitle}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{ja.settings.appUpdateBannerNote}</p>
          <button
            type="button"
            data-testid="app-update-banner-apply"
            onClick={() => applyAppUpdate()}
            className="mt-[var(--space-sm)] flex w-full items-center justify-center gap-2 rounded-md border border-accent bg-surface py-2 text-sm font-bold text-accent-ink"
          >
            <ArrowDownToLine size={16} aria-hidden />
            {ja.settings.appUpdateBannerApply}
          </button>
        </div>
        <button
          type="button"
          data-testid="app-update-banner-dismiss"
          onClick={() => {
            dismissAppUpdateBanner()
            setDismissed(true)
          }}
          aria-label={ja.settings.appUpdateBannerDismiss}
          className="tap-target -mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
        >
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
