import { useState } from 'react'
import { X } from 'lucide-react'
import { useSettings, updateSettings } from '../db/settings'
import { ja } from '../i18n/ja'

/**
 * 読み上げの読み方についての案内（2026-08-12 便FX・オーナー実機
 * 「読み上げ精度なんとかならない？『cm』をシーエムと読むくらいに酷い。端末依存であれば、
 * 端末の設定見直してね、って教えてくれるだけでも信頼度変わるよ」）。
 *
 * 単位の読み（cm・g・ml・L・℃・大さじ・小さじ・cc・分数）は data/unitReadings.ts で
 * アプリ側が直している。ここに置くのは、**それでも読み方が合わないときの直し方**。
 *
 * 出し方（しつこくしない）:
 *   - 読み上げを**実際に使ったあと**だけ（使っていない人には出さない）
 *   - **端末につき1回**。閉じると settings に印を残し、以後は出さない
 *   - 出す場所は調理中モードの画面の上。1品の調理中モードと並行調理ナビで同じ部品を使う
 */
export default function SpeechReadingHint({ used }: { used: boolean }) {
  const settings = useSettings()
  const [closed, setClosed] = useState(false)
  if (!used || closed || settings == null || settings.speechReadingHintSeen) return null
  const dismiss = () => {
    setClosed(true)
    void updateSettings({ speechReadingHintSeen: true })
  }
  return (
    <div
      data-testid="speech-reading-hint"
      className="mx-[var(--space-md)] mb-1 flex items-start gap-2 rounded-md border border-edge bg-surface px-[var(--space-md)] py-2 text-xs"
    >
      <div className="min-w-0 flex-1">
        <p className="font-bold text-accent-ink">{ja.focus.readingHintTitle}</p>
        <p className="ja-phrase mt-0.5 text-ink-muted">{ja.focus.readingHintBody}</p>
        <p className="mt-0.5 text-ink-muted">{ja.focus.readingHintIphone}</p>
        <p className="text-ink-muted">{ja.focus.readingHintAndroid}</p>
      </div>
      <button
        type="button"
        data-testid="speech-reading-hint-close"
        onClick={dismiss}
        aria-label={ja.focus.close}
        className="tap-target shrink-0 rounded-full p-1 text-ink-muted"
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  )
}
