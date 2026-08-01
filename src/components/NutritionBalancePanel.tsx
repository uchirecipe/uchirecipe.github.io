import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import {
  NUTRITION_TEASER_ENABLED,
  isNutritionUnlocked,
  nutritionSourceName,
  roundNutrient,
  type NutrientTotals,
} from '../logic/nutrition'
import {
  DAILY_GUIDES,
  guideForDays,
  roundVegetableGrams,
  type BalanceBasis,
  type BalanceSum,
} from '../logic/nutritionBalance'
import { ProNutrientTeaser } from './NutritionTeaser'
import { ja } from '../i18n/ja'

/**
 * 献立タブに置く「栄養バランスのめやす」パネル（2026-07-30 便CL・docs/60 第1段「見える化」）。
 * 週タブの各日カードと週まとめの両方で同じ部品を使う（同じ数字の出し方を2か所に書かないため）。
 *
 * 【表示の作法】
 * - 既定は1行だけ（無料「約◯kcal・野菜約◯g」／Pro「約◯kcal・塩分約◯g・野菜約◯g」）。
 *   めやすとの並置は展開時のみ。
 *   2026-07-11 にレシピ詳細の栄養パネルを「面積を取りすぎる」で折りたたんだ経緯があり、
 *   7日分のカードに常時展開のパネルを並べると同じ問題が7倍で起きる。
 * - **無料＝エネルギー・野菜量の2値／Pro＝8項目＋野菜量**（2026-08-01 オーナー確定・線引きB'。
 *   食塩相当量は無料側から外してPro側へ移した。野菜量は無料のまま＝docs/60 §7 未決#3＝(a)
 *   オーナー承認済み。第2段のエンジンが使う基準そのものなので、無料ユーザーにも見えないと
 *   選定理由が説明できない）。
 * - **めやすを並置するのは食塩相当量と野菜量だけ**（docs/60 §7 未決#2＝(a)）。
 *   このうち食塩相当量のめやすはPro解錠時のみ出す（値そのものがPro側なので、めやすだけ先に
 *   出すと無料側に塩分の話が残ってしまう）。野菜量のめやすは無料でも出す。
 *   エネルギー・たんぱく質・脂質・炭水化物にはめやすの線を引かない（docs/60 §1-2）。
 * - 不足・過多は断定しない。色でも善悪を表さない（数値の並置のみ）。
 * - 計算できない品が混ざる日は、めやすとの並置自体を出さない（docs/60 §5・NUT-01/02の作法）。
 */
export default function NutritionBalancePanel({
  scope,
  basis,
  dateLabel,
  isPro,
  balance,
  comparable,
  guideDays,
}: {
  /** 'day' = 週タブの各日カード / 'week' = 週まとめ */
  scope: 'day' | 'week'
  /** 'day' のとき、その日を数えた基準（過去日=作った記録・今日以降=登録した献立） */
  basis?: BalanceBasis
  /** 'day' のとき、開閉ボタンの読み上げ名に入れる日付表記（7日分が同名で並ぶのを避ける） */
  dateLabel?: string
  isPro: boolean
  balance: BalanceSum
  /** めやすとの並置を出してよいか（canCompareDay / canCompareRange の結果） */
  comparable: boolean
  /** めやすを何日ぶんに伸ばすか（day=1・week=献立や記録がある日数） */
  guideDays: number
}) {
  const [expanded, setExpanded] = useState(false)
  const unlocked = isNutritionUnlocked(isPro)
  if (!unlocked && !NUTRITION_TEASER_ENABLED) return null

  const sum = balance.nutrition
  // 数える対象が1品も無い日・週は、パネルごと出さない（空の「0kcal」を7日並べない）
  if (sum.dishCount === 0 && sum.excludedDishCount === 0) return null

  const per = sum.total
  const vegetableG = roundVegetableGrams(balance.vegetableG)
  // 1品も計算できなかったときは「0kcal」という誤解を招く数値を出さない（NutritionTeaserと同じ作法）
  const canShowNumbers = sum.dishCount > 0
  // 合計が下振れしている原因になった品数（丸ごと計算できない品＋量が書いてあるのに落ちた材料がある品）
  const gapDishCount = sum.excludedDishCount + sum.partialDishCount
  const title =
    scope === 'week'
      ? ja.nutritionBalance.weekTitle
      : basis === 'actual'
        ? ja.nutritionBalance.dayTitleActual
        : ja.nutritionBalance.dayTitlePlan
  // 各値は「約516kcal」「塩分約0g」のように語と数字の途中で改行されないよう、値ごとに折り返し禁止で置く
  // （390px幅では「塩分約」で改行されて読みにくかった）。
  // 塩分はPro解錠時のみ（2026-08-01 線引きB'。無料は「約◯kcal・野菜約◯g」の2値）
  const summaryValues = canShowNumbers
    ? [
        ja.nutritionBalance.summaryKcal.replace(
          '{n}',
          roundNutrient('kcal', per.kcal).toLocaleString(),
        ),
        ...(unlocked
          ? [
              ja.nutritionBalance.summarySalt.replace(
                '{n}',
                roundNutrient('saltG', per.saltG).toLocaleString(),
              ),
            ]
          : []),
        ja.nutritionBalance.summaryVegetable.replace('{n}', vegetableG.toLocaleString()),
      ]
    : [ja.nutrition.unavailableSummary]

  const ChevronIcon = expanded ? ChevronUp : ChevronDown
  const toggleLabel =
    scope === 'week'
      ? expanded
        ? ja.nutritionBalance.weekToggleCollapse
        : ja.nutritionBalance.weekToggleExpand
      : (expanded
          ? ja.nutritionBalance.dayToggleCollapse
          : ja.nutritionBalance.dayToggleExpand
        ).replace('{d}', dateLabel ?? '')

  return (
    <div className="rounded-md border border-edge bg-app">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={toggleLabel}
        className="flex w-full items-center justify-between gap-2 p-[var(--space-sm)] text-left"
      >
        <span className="min-w-0 flex-1 text-xs text-ink-muted">
          <Sparkles size={12} className="mr-1 inline-block shrink-0 text-accent-ink" aria-hidden />
          <span className="font-bold">{title}</span>:{' '}
          {summaryValues.map((value, i) => (
            <span key={value} className="whitespace-nowrap">
              {i > 0 && ja.nutritionBalance.summarySeparator}
              {value}
            </span>
          ))}
          {/* 折りたたんだままでも「この数字は下振れしている」と分かるようにする
              （便BY/NUT-01と同じ作法。展開しないと分からない状態にしない） */}
          {canShowNumbers && gapDishCount > 0 && (
            <span className="ml-1 whitespace-nowrap font-bold text-warning">
              {ja.nutritionBalance.gapBadge.replace('{n}', String(gapDishCount))}
            </span>
          )}
        </span>
        <ChevronIcon size={16} className="shrink-0 text-ink-muted" aria-hidden />
      </button>

      {expanded && (
        <div className="space-y-[var(--space-sm)] border-t border-edge p-[var(--space-sm)]">
          {canShowNumbers && (
            <NutrientRows totals={per} vegetableG={vegetableG} unlocked={unlocked} />
          )}
          {!unlocked && <ProNutrientTeaser isPro={isPro} />}
          {canShowNumbers &&
            (comparable ? (
              <GuideBlock
                totals={per}
                vegetableG={vegetableG}
                guideDays={guideDays}
                showDaysNote={scope === 'week'}
                unlocked={unlocked}
              />
            ) : (
              <p className="text-xs text-ink-muted">
                {scope === 'week'
                  ? ja.nutritionBalance.noCompareRange
                  : ja.nutritionBalance.noCompareDay}
              </p>
            ))}
          <div className="space-y-0.5 text-xs text-ink-muted">
            <p>
              {scope === 'week'
                ? ja.nutritionBalance.weekBasisNote
                : basis === 'actual'
                  ? ja.nutritionBalance.basisNoteActual
                  : ja.nutritionBalance.basisNotePlan}
            </p>
            {/* 計算できなかった品の件数（既存の月タブと同じ文言・同じ作法で明示する） */}
            {sum.excludedDishCount > 0 && (
              <p>
                {ja.mealPlan.rangeIntakeNutritionExcluded.replace(
                  '{n}',
                  String(sum.excludedDishCount),
                )}
              </p>
            )}
            {sum.partialDishCount > 0 && (
              <p>
                {ja.mealPlan.rangeIntakeNutritionPartial.replace(
                  '{n}',
                  String(sum.partialDishCount),
                )}
              </p>
            )}
            <p>{ja.nutritionBalance.registeredOnlyNote}</p>
            <p>{ja.nutritionBalance.registeredOnlyMealNote}</p>
            {/* 除外した材料の分は合計に入っていない＝この数字は下限側であることの明示
                （docs/60 §1-3-4: レシピ詳細と同じ方向の但し書きを日・週の合計にも出す） */}
            <p>{ja.nutrition.excludedDirectionNote}</p>
            <p>{ja.nutritionBalance.vegetableCountNote}</p>
            <p>{ja.nutrition.estimateNote}</p>
            {/* 成分値の出典と「めやす」の出典は必ず別行にする（docs/60 §1-1。2つの出典を混ぜない）。
                めやすの出典は、画面に出しているめやすの分だけ挙げる
                （無料は野菜量のめやすしか出していないので、塩分側の出典は挙げない） */}
            <p>
              {ja.nutrition.sourcePrefix}
              {nutritionSourceName()}
            </p>
            <p>
              {ja.nutritionBalance.guideSourcePrefix}
              {unlocked
                ? `${DAILY_GUIDES.saltG.source}${ja.nutritionBalance.guideSourceSeparator}${DAILY_GUIDES.vegetableG.source}`
                : DAILY_GUIDES.vegetableG.source}
            </p>
            <p>{ja.nutritionBalance.guideScopeNote}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** 表示用の単位付き整形（NutritionTeaserのUnlockedBodyと同じ規則） */
function formatNutrient(key: keyof NutrientTotals, value: number): string {
  const n = roundNutrient(key, value).toLocaleString()
  if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
  if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
  return `${n} ${ja.nutrition.gramUnit}`
}

/**
 * 数値の一覧（1人分のみ）。
 * 無料＝エネルギー・野菜量／Pro＝8項目＋野菜量（2026-08-01 線引きB'）。並びはNutritionTeaserと同じ
 * （たんぱく質→脂質→炭水化物→食物繊維→鉄→カルシウム、食塩相当量は末尾）。
 * 野菜量は栄養8項目には含まれない新しい指標なので、いちばん最後に置く。
 */
function NutrientRows({
  totals,
  vegetableG,
  unlocked,
}: {
  totals: NutrientTotals
  vegetableG: number
  unlocked: boolean
}) {
  // 食塩相当量もPro側（2026-08-01 線引きB'）。8項目の末尾に置く並びは従来どおり
  const proRows: { key: keyof NutrientTotals; label: string }[] = [
    { key: 'proteinG', label: ja.nutrition.proteinLabel },
    { key: 'fatG', label: ja.nutrition.fatLabel },
    { key: 'carbG', label: ja.nutrition.carbLabel },
    { key: 'fiberG', label: ja.nutrition.fiberLabel },
    { key: 'ironMg', label: ja.nutrition.ironLabel },
    { key: 'calciumMg', label: ja.nutrition.calciumLabel },
    { key: 'saltG', label: ja.nutrition.saltLabel },
  ]
  const rows: { key: keyof NutrientTotals; label: string }[] = [
    { key: 'kcal', label: ja.nutrition.kcalLabel },
    ...(unlocked ? proRows : []),
  ]
  return (
    <div
      className="rounded-md border border-edge p-[var(--space-sm)]"
      style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {unlocked && (
          <span className="rounded-full border border-edge px-2 py-0.5 text-xs font-bold text-accent-ink">
            {ja.nutrition.proBadge}
          </span>
        )}
        <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
          {ja.nutrition.estimateBadge}
        </span>
        <span className="text-xs font-bold text-accent-ink">{ja.nutrition.servingHeader}</span>
      </div>
      <dl className="mt-1 grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1">
        {rows.map(({ key, label }) => (
          <div key={key} className="contents">
            <dt className="text-sm">{label}</dt>
            <dd className="text-right text-sm font-bold text-accent-ink tabular-nums">
              {formatNutrient(key, totals[key])}
            </dd>
          </div>
        ))}
        {/* 野菜量は無料でも出す（docs/60 §7 未決#3＝(a)・2026-08-01 線引きB'でも無料のまま） */}
        <div className="contents">
          <dt className="text-sm">{ja.nutritionBalance.vegetableLabel}</dt>
          <dd className="text-right text-sm font-bold text-accent-ink tabular-nums">
            {vegetableG.toLocaleString()} {ja.nutrition.gramUnit}
          </dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * めやすとの並置（食塩相当量・野菜量のみ）。
 * 不足・過多は断定せず、バーや色による達成表示も出さない＝数値を並べるだけ（docs/60 §1-3-2）。
 * 男女の値は併記する（第3段の「めやすの基準」を作るまでは、どちらか一方に丸めると
 * 「自分の値ではない数字」を出すことになるため。docs/60 §7 未決#5＝(b)）。
 *
 * 2026-08-01 線引きB': 食塩相当量の行はPro解錠時のみ。無料では野菜量のめやすだけを並べる。
 */
function GuideBlock({
  totals,
  vegetableG,
  guideDays,
  showDaysNote,
  unlocked,
}: {
  totals: NutrientTotals
  vegetableG: number
  guideDays: number
  showDaysNote: boolean
  unlocked: boolean
}) {
  const days = guideDays > 0 ? guideDays : 1
  const round1 = (v: number) => Math.round(v * 10) / 10
  const saltMale = round1(guideForDays(DAILY_GUIDES.saltG.male, days))
  const saltFemale = round1(guideForDays(DAILY_GUIDES.saltG.female, days))
  const vegetableGuide = guideForDays(DAILY_GUIDES.vegetableG.perDayG, days)
  return (
    <div className="rounded-md border border-edge p-[var(--space-sm)]">
      <p className="text-sm font-bold text-ink-muted">
        {days === 1
          ? ja.nutritionBalance.guideTitleDay
          : ja.nutritionBalance.guideTitleDays.replace('{n}', String(days))}
      </p>
      {unlocked && (
        <p className="mt-1 text-sm tabular-nums">
          {ja.nutritionBalance.guideSaltRow
            .replace('{v}', roundNutrient('saltG', totals.saltG).toLocaleString())
            .replace('{male}', saltMale.toLocaleString())
            .replace('{female}', saltFemale.toLocaleString())}
        </p>
      )}
      {/* 塩分の行が出るときは行間を詰め、無料（野菜だけ）のときは見出しからの間隔を空ける */}
      <p className={`${unlocked ? 'mt-0.5' : 'mt-1'} text-sm tabular-nums`}>
        {ja.nutritionBalance.guideVegetableRow
          .replace('{v}', vegetableG.toLocaleString())
          .replace('{guide}', vegetableGuide.toLocaleString())}
      </p>
      {showDaysNote && (
        <p className="mt-1 text-xs text-ink-muted">
          {ja.nutritionBalance.guideDaysNote.replace('{n}', String(days))}
        </p>
      )}
    </div>
  )
}
