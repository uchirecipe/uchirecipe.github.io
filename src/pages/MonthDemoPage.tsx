import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { X } from 'lucide-react'
import MealPlanPage from './MealPlanPage'
import { buildMonthDemoData, DEMO_PHOTO_KEYS, type MonthDemoData } from '../logic/monthDemo'
import { ja } from '../i18n/ja'

/**
 * 月間画面のサンプルデモ（2026-08-02 便DC・オーナー採用:
 * 「記録5件でも写真がないと月間の魅力が伝わらない。デモがあればお試しを使い切った人も確認できる」）。
 *
 * この画面がしているのは次の2つだけ:
 *  1. 見本の1か月分（logic/monthDemo.ts）を組み立てて、本物の月タブ（MealPlanPage）へ渡す
 *  2. いま見ているものがサンプルであることを上の帯で言い切り、閉じたら元の画面へ戻す
 *
 * 端末のデータ（レシピ・記録・献立・設定・Pro解錠状態）は読み書きしない。
 * Proのゲートはこの画面の中だけ開き、1回だけのお試し（settings.monthTrialUsed）も消費しない。
 */
export default function MonthDemoPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [data, setData] = useState<MonthDemoData>()

  /** 閉じたときの戻り先。入口ごとに ?back= で渡す（アプリ内のパスだけを受け付ける） */
  const backTo = useMemo(() => {
    const raw = searchParams.get('back')
    return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/meal-plan'
  }, [searchParams])

  // サンプルの写真を読み込んでから見本データを組み立てる。読み込めない写真があっても
  // その分だけ料理カテゴリのアイコン表示になるだけで、画面は成立する
  useEffect(() => {
    let alive = true
    void (async () => {
      const photos = new Map<string, Blob>()
      await Promise.all(
        DEMO_PHOTO_KEYS.map(async (key) => {
          try {
            const res = await fetch(`/demo/${key}.webp`)
            if (res.ok) photos.set(key, await res.blob())
          } catch {
            // 写真なしで続ける（オフラインの初回表示など）
          }
        }),
      )
      if (alive) setData(buildMonthDemoData(photos))
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <>
      <div
        data-testid="month-demo-banner"
        // data-app-top-bar: 上端に貼り付く帯だと revealExpanded に知らせる。無いと、
        // 折りたたみを開いたときにこの帯の裏へ中身が潜る(2026-08-10 便ETの申し送り②)
        data-app-top-bar
        className="sticky top-0 z-40 border-b border-edge bg-accent px-[var(--space-md)] py-2 text-on-accent"
      >
        <div className="mx-auto flex w-full max-w-md items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{ja.mealPlan.monthDemoBannerTitle}</p>
            <p className="text-xs">{ja.mealPlan.monthDemoBannerNote}</p>
          </div>
          <button
            type="button"
            data-testid="month-demo-close"
            onClick={() => navigate(backTo)}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-on-accent px-3 py-2 text-sm font-bold"
          >
            <X size={16} aria-hidden />
            {ja.common.close}
          </button>
        </div>
      </div>
      {data ? (
        <>
          <MealPlanPage demo={data} />
          <p className="mx-auto w-full max-w-md px-[var(--space-md)] pb-[var(--space-md)] text-xs text-ink-muted">
            {ja.mealPlan.monthDemoPhotoCredit}
          </p>
        </>
      ) : (
        <p className="mx-auto w-full max-w-md px-[var(--space-md)] pt-[var(--space-lg)] text-sm text-ink-muted">
          {ja.mealPlan.monthDemoLoading}
        </p>
      )}
    </>
  )
}
