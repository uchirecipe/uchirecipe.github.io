import { Link } from 'react-router-dom'
import { Sparkles, Lock } from 'lucide-react'
import {
  NUTRITION_ENABLED,
  NUTRITION_TEASER_ENABLED,
  computeRecipeNutrition,
  roundNutrient,
  nutritionSourceName,
  type NutrientTotals,
} from '../logic/nutrition'
import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/**
 * レシピ詳細に置く「栄養価のめやす」枠（M6-1）。状態は3つ:
 *
 * 1. 機能公開前(NUTRITION_ENABLED=false) … 無料/Proを問わず「Pro・近日公開」のティーザーを表示
 *    （2026-07 ユーザー決定: 無料ユーザーがPro機能の存在に気づくきっかけにする。
 *    ティーザー自体も NUTRITION_TEASER_ENABLED でOFFにできる）
 * 2. 公開後・未解錠 … 月間献立と同じ様式のProゲート（説明＋設定へのリンク）
 * 3. 公開後・解錠済み … 実際の栄養値パネル。ここはM6-1のUI統合(③)で
 *    Opusサブエージェントが実装する（computeRecipeNutrition の結果表示。
 *    「概算・めやす」表記と計算対象外n件の明示が必須。それまでは何も出さない）
 */
export default function NutritionTeaser({
  isPro,
  recipe,
  servings,
}: {
  isPro: boolean
  /** レシピ本体（状態3の実計算に使う。materials/servingsだけ参照） */
  recipe: Pick<Recipe, 'ingredients' | 'servings'>
  /** 詳細画面で現在表示中の人数（全量の表示に使う）。未指定ならレシピ登録時の人数 */
  servings?: number
}) {
  if (!NUTRITION_ENABLED) {
    if (!NUTRITION_TEASER_ENABLED) return null
    // 状態1: ティーザー（控えめな1枚カード。タップ要素は置かず、期待だけ持ってもらう）
    return (
      <section className="mt-[var(--space-lg)]">
        <div className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-accent" aria-hidden />
            <h2 className="font-bold">{ja.nutrition.title}</h2>
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs font-bold text-accent">
              {ja.nutrition.proBadge}
            </span>
            <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
              {ja.nutrition.comingSoonBadge}
            </span>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{ja.nutrition.teaserDescription}</p>
        </div>
      </section>
    )
  }

  if (!isPro) {
    // 状態2: Proゲート（月間献立ゲートの様式踏襲）
    return (
      <section className="mt-[var(--space-lg)]">
        <div className="rounded-md border border-edge bg-surface p-[var(--space-lg)] text-center shadow-sm">
          <Lock size={28} className="mx-auto text-ink-muted" aria-hidden />
          <p className="mt-[var(--space-sm)] font-bold">{ja.nutrition.gateTitle}</p>
          <p className="mt-1 text-sm text-ink-muted">{ja.nutrition.gateDescription}</p>
          <Link
            to="/settings?section=pro"
            className="mt-[var(--space-sm)] inline-block text-sm font-bold text-accent underline"
          >
            {ja.nutrition.gateLink}
          </Link>
        </div>
      </section>
    )
  }

  // 状態3: Pro解錠済み（NUTRITION_ENABLED && isPro）の実パネル。
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
