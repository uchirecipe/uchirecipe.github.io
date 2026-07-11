import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
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
 * レシピ詳細に置く「栄養価のめやす」枠（M6-1）。
 *
 * 折りたたみ式（2026-07-11 オーナー実機フィードバック「邪魔・面積を取りすぎる」）:
 * 既定は「{タイトル}（1食あたり）: 498kcal・塩分4.1g」の1行＋展開アイコンのみ。
 * タップで、これまでの内容（注記・出典・Pro案内・計算対象外・Pro解錠済みの内訳等）を展開表示する。
 * 計算対象の材料が1つも無い（分量不明・成分データ無し等ですべて計算対象外）場合は、
 * 「0kcal」という誤解を招く数値を出さず、計算できなかった旨の1行にする。
 *
 * 状態は引き続き2つ:
 * 1. 未解錠（isNutritionUnlocked=false。フル版公開までは全員がここ） …
 *    エネルギー・食塩相当量の2項目は無料版でも実際に計算して表示し（2026-07-10 オーナー確定・
 *    バッチH-4）、残り3項目（たんぱく質・脂質・炭水化物）はPro案内にとどめる。
 * 2. 解錠済み（NUTRITION_ENABLED && isPro） … 5項目の実パネル。material内訳は出さないが、
 *    「概算・めやす」表記と計算対象外n件の明示が必須。デザイン変更はしない（現行のまま）
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
  const [expanded, setExpanded] = useState(false)
  const unlocked = isNutritionUnlocked(isPro)

  if (!unlocked && !NUTRITION_TEASER_ENABLED) return null

  const nutrition = computeRecipeNutrition(recipe)
  const per = nutrition.perServing
  // 計算に含められた材料が1つも無ければ「0kcal」表示は誤解を招くため出さない
  const canShowSummary = nutrition.items.length > 0
  const summaryText = canShowSummary
    ? `${roundNutrient('kcal', per.kcal).toLocaleString()}${ja.nutrition.kcalUnit}・${
        ja.nutrition.saltShortLabel
      }${roundNutrient('saltG', per.saltG).toLocaleString()}${ja.nutrition.gramUnit}`
    : ja.nutrition.unavailableSummary

  const ChevronIcon = expanded ? ChevronUp : ChevronDown

  return (
    <section className="mt-[var(--space-lg)]">
      <div className="rounded-md border border-edge bg-surface shadow-sm">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? ja.nutrition.toggleCollapse : ja.nutrition.toggleExpand}
          className="flex w-full items-center justify-between gap-2 p-[var(--space-md)] text-left"
        >
          <span className="min-w-0 flex-1 text-sm font-bold">
            <Sparkles size={14} className="mr-1 inline-block shrink-0 text-accent" aria-hidden />
            {ja.nutrition.title}
            {ja.nutrition.summaryLabel}
            {summaryText}
          </span>
          <ChevronIcon size={20} className="shrink-0 text-ink-muted" aria-hidden />
        </button>

        {expanded && (
          <div className="border-t border-edge p-[var(--space-md)] pt-[var(--space-sm)]">
            {unlocked ? (
              <UnlockedBody nutrition={nutrition} servings={servings} />
            ) : (
              <LockedBody nutrition={nutrition} isPro={isPro} />
            )}
          </div>
        )}
      </div>
    </section>
  )
}

type Nutrition = ReturnType<typeof computeRecipeNutrition>

/** 仮の目安量で計算に含めた材料一覧（両状態で共通のブロック・2026-07-11） */
function AssumedBlock({ nutrition }: { nutrition: Nutrition }) {
  if (nutrition.assumed.length === 0) return null
  return (
    <div className="rounded-md border border-edge p-[var(--space-sm)]">
      <p className="text-sm font-bold text-ink-muted">
        {ja.nutrition.assumedLabel.replace('{n}', String(nutrition.assumed.length))}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{ja.nutrition.assumedHint}</p>
      <p className="mt-0.5 text-sm">
        {nutrition.assumed.map((a) => `${a.name}（${a.note}）`).join('、')}
      </p>
    </div>
  )
}

/** 計算対象外の材料一覧（両状態で共通のブロック） */
function ExcludedBlock({ nutrition }: { nutrition: Nutrition }) {
  if (nutrition.excluded.length === 0) return null
  return (
    <div className="rounded-md border border-edge p-[var(--space-sm)]">
      <p className="text-sm font-bold text-ink-muted">
        {ja.nutrition.excludedLabel.replace('{n}', String(nutrition.excluded.length))}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{ja.nutrition.excludedHint}</p>
      <p className="mt-0.5 text-sm">{nutrition.excluded.map((e) => e.name).join('、')}</p>
    </div>
  )
}

/** 状態1: 未解錠（無料版）。エネルギー・食塩相当量は既に見出し行に出ているので、
 *  展開後は注記・出典・Pro案内・計算対象外だけを出す */
function LockedBody({ nutrition, isPro }: { nutrition: Nutrition; isPro: boolean }) {
  return (
    <div className="space-y-[var(--space-sm)]">
      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />
      <p className="text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <p className="text-xs text-ink-muted">
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
      </p>
      {/* 解錠済みユーザーには「Pro特典として開発中・公開時に自動で使える」ことを明示する
          (「解錠したのに残りが見えない」という誤解を防ぐ。2026-07-09ペルソナ第2波を踏襲) */}
      <p className="text-sm text-ink-muted">
        {isPro ? ja.nutrition.freeDescriptionPro : ja.nutrition.freeDescription}
      </p>
      {!isPro && (
        <Link to="/settings?section=pro" className="inline-block text-sm font-bold text-accent underline">
          {ja.nutrition.gateLink}
        </Link>
      )}
    </div>
  )
}

/** 状態2: Pro解錠済み。5項目の実内訳（1人分・全量）＋計算対象外・注記・出典 */
function UnlockedBody({ nutrition, servings }: { nutrition: Nutrition; servings?: number }) {
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
    <div className="space-y-[var(--space-sm)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-edge px-2 py-0.5 text-xs font-bold text-accent">
          {ja.nutrition.proBadge}
        </span>
        <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
          {ja.nutrition.estimateBadge}
        </span>
      </div>

      {/* 栄養素の数値（1人分を主役に、全量も併記）。アクセントを薄く敷いて並行調理ナビと統一感を出す */}
      <div
        className="rounded-md border border-edge p-[var(--space-sm)]"
        style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 gap-y-2">
          <span aria-hidden />
          <span className="text-right text-xs font-bold text-accent">{ja.nutrition.servingHeader}</span>
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

      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />

      <p className="text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <p className="text-xs text-ink-muted">
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
      </p>
    </div>
  )
}
