import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import {
  NUTRITION_TEASER_ENABLED,
  isNutritionUnlocked,
  computeRecipeNutrition,
  roundNutrient,
  nutritionSourceName,
  type NutrientTotals,
} from '../logic/nutrition'
import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/**
 * レシピ詳細に置く「栄養価のめやす」枠（M6-1）。状態は2つ:
 *
 * 1. 未解錠（isNutritionUnlocked=false。フル版公開までは全員がここ） …
 *    エネルギー・食塩相当量の2項目は無料版でも実際に計算して表示し（2026-07-10 オーナー確定・
 *    バッチH-4）、残り3項目（たんぱく質・脂質・炭水化物）はPro案内にとどめる。
 * 2. 解錠済み（NUTRITION_ENABLED && isPro） … 5項目の実パネル。material内訳は出さないが、
 *    「概算・めやす」表記と計算対象外n件の明示が必須。デザインは変更しない（現行のまま）
 */
export default function NutritionTeaser({
  isPro,
  recipe,
  servings,
}: {
  isPro: boolean
  /** レシピ本体（実計算に使う。materials/servingsだけ参照） */
  recipe: Pick<Recipe, 'ingredients' | 'servings'>
  /** 詳細画面で現在表示中の人数（全量の表示に使う）。未指定ならレシピ登録時の人数 */
  servings?: number
}) {
  const unlocked = isNutritionUnlocked(isPro)

  if (!unlocked) {
    if (!NUTRITION_TEASER_ENABLED) return null
    // 状態1: 誰でもエネルギー・食塩相当量の2項目は見られる実パネル（控えめな1枚カード）。
    // 無料版は1食あたりのみ表示する（全量表示はPro解錠済みパネルの差別化として残す）
    const nutrition = computeRecipeNutrition(recipe)
    const per = nutrition.perServing
    const basicRows: { key: 'kcal' | 'saltG'; label: string }[] = [
      { key: 'kcal', label: ja.nutrition.kcalLabel },
      { key: 'saltG', label: ja.nutrition.saltLabel },
    ]
    const fmtBasic = (key: 'kcal' | 'saltG', value: number): string => {
      const n = roundNutrient(key, value).toLocaleString()
      return key === 'kcal' ? `${n} ${ja.nutrition.kcalUnit}` : `${n} ${ja.nutrition.gramUnit}`
    }

    return (
      <section className="mt-[var(--space-lg)]">
        <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles size={18} className="text-accent" aria-hidden />
            <h2 className="font-bold">{ja.nutrition.title}</h2>
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
              {ja.nutrition.estimateBadge}
            </span>
          </div>

          <div
            className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]"
            style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
          >
            <p className="text-xs font-bold text-accent">{ja.nutrition.perServingLabel}</p>
            <div className="mt-1 grid grid-cols-[1fr_auto] items-baseline gap-x-4 gap-y-1">
              {basicRows.map(({ key, label }) => (
                <div key={key} className="contents">
                  <span className="text-sm">{label}</span>
                  <span className="text-right text-base font-bold text-accent tabular-nums">
                    {fmtBasic(key, per[key])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 計算対象外の材料は隠さず件数と材料名で明示（docs/09 M6-1 必須） */}
          {nutrition.excluded.length > 0 && (
            <div className="mt-[var(--space-sm)] rounded-md border border-edge p-[var(--space-sm)]">
              <p className="text-sm font-bold text-ink-muted">
                {ja.nutrition.excludedLabel.replace('{n}', String(nutrition.excluded.length))}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted">{ja.nutrition.excludedHint}</p>
              <p className="mt-0.5 text-sm">{nutrition.excluded.map((e) => e.name).join('、')}</p>
            </div>
          )}

          <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
          <p className="mt-1 text-xs text-ink-muted">
            {ja.nutrition.sourcePrefix}
            {nutritionSourceName()}
          </p>

          {/* 解錠済みユーザーには「Pro特典として開発中・公開時に自動で使える」ことを明示する
              (「解錠したのに残りが見えない」という誤解を防ぐ。2026-07-09ペルソナ第2波を踏襲) */}
          <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
            {isPro ? ja.nutrition.freeDescriptionPro : ja.nutrition.freeDescription}
          </p>
          {!isPro && (
            <Link
              to="/settings?section=pro"
              className="mt-1 inline-block text-sm font-bold text-accent underline"
            >
              {ja.nutrition.gateLink}
            </Link>
          )}
        </div>
      </section>
    )
  }

  // 状態2: Pro解錠済み（NUTRITION_ENABLED && isPro）の実パネル。
  // computeRecipeNutrition は「1人分（perServing）」を基準に返すので、
  // 全量は現在表示中の人数（servings）を掛けて出す＝材料の人数変更とめやすが連動する。
  const nutrition = computeRecipeNutrition(recipe)
  const displayServings = servings != null && servings > 0 ? servings : nutrition.servings
  const per = nutrition.perServing
  const totalForDisplay: NutrientTotals = {
    kcal: per.kcal * displayServings,
    proteinG: per.proteinG * displayServings,
    fatG: per.fatG * displayServings,
    carbG: per.carbG * displayServings,
    saltG: per.saltG * displayServings,
  }

  const rows: { key: keyof NutrientTotals; label: string }[] = [
    { key: 'kcal', label: ja.nutrition.kcalLabel },
    { key: 'proteinG', label: ja.nutrition.proteinLabel },
    { key: 'fatG', label: ja.nutrition.fatLabel },
    { key: 'carbG', label: ja.nutrition.carbLabel },
    { key: 'saltG', label: ja.nutrition.saltLabel },
  ]

  const fmt = (key: keyof NutrientTotals, value: number): string => {
    const n = roundNutrient(key, value).toLocaleString()
    return key === 'kcal' ? `${n} ${ja.nutrition.kcalUnit}` : `${n} ${ja.nutrition.gramUnit}`
  }

  return (
    <section className="mt-[var(--space-lg)]">
      <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles size={18} className="text-accent" aria-hidden />
          <h2 className="font-bold">{ja.nutrition.title}</h2>
          <span className="rounded-full border border-edge px-2 py-0.5 text-xs font-bold text-accent">
            {ja.nutrition.proBadge}
          </span>
          <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
            {ja.nutrition.estimateBadge}
          </span>
        </div>

        {/* 栄養素の数値（1人分を主役に、全量も併記）。アクセントを薄く敷いて並行調理ナビと統一感を出す */}
        <div
          className="mt-[var(--space-md)] rounded-md border border-edge p-[var(--space-sm)]"
          style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
        >
          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-2">
            <span aria-hidden />
            <span className="text-right text-xs font-bold text-accent">
              {ja.nutrition.servingHeader}
            </span>
            <span className="text-right text-xs text-ink-muted">
              {ja.nutrition.totalHeader.replace('{n}', String(displayServings))}
            </span>
            {rows.map(({ key, label }) => (
              <div key={key} className="contents">
                <span className="text-sm">{label}</span>
                <span className="text-right text-base font-bold text-accent tabular-nums">
                  {fmt(key, per[key])}
                </span>
                <span className="text-right text-sm text-ink-muted tabular-nums">
                  {fmt(key, totalForDisplay[key])}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 計算対象外の材料は隠さず件数と材料名で明示（docs/09 M6-1 必須） */}
        {nutrition.excluded.length > 0 && (
          <div className="mt-[var(--space-sm)] rounded-md border border-edge p-[var(--space-sm)]">
            <p className="text-sm font-bold text-ink-muted">
              {ja.nutrition.excludedLabel.replace('{n}', String(nutrition.excluded.length))}
            </p>
            <p className="mt-0.5 text-xs text-ink-muted">{ja.nutrition.excludedHint}</p>
            <p className="mt-0.5 text-sm">
              {nutrition.excluded.map((e) => e.name).join('、')}
            </p>
          </div>
        )}

        <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
        <p className="mt-1 text-xs text-ink-muted">
          {ja.nutrition.sourcePrefix}
          {nutritionSourceName()}
        </p>
      </div>
    </section>
  )
}
