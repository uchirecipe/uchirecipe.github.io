import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import {
  NUTRITION_TEASER_ENABLED,
  isNutritionUnlocked,
  computeRecipeNutrition,
  hasMaterialGap,
  roundNutrient,
  nutritionSourceName,
  type ExcludedReason,
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
 * 2. 解錠済み（NUTRITION_ENABLED && isPro） … 8項目の実パネル（2026-07-13 第2弾で
 *    食物繊維・鉄・カルシウムを追加）。material内訳は出さないが、
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
  // 表示中の人数(材料の人数変更に追従)。1人分の値そのものは人数を変えても動かないが、
  // 「何人分を1食に分けた値なのか」を要約行に常時出すために使う(2026-07-28 便BY/COST-03)
  const displayServings = servings != null && servings > 0 ? servings : nutrition.servings
  // 計算に含められた材料が1つも無ければ「0kcal」表示は誤解を招くため出さない
  const canShowSummary = nutrition.items.length > 0
  const summaryText = canShowSummary
    ? `${roundNutrient('kcal', per.kcal).toLocaleString()}${ja.nutrition.kcalUnit}・${
        ja.nutrition.saltShortLabel
      }${roundNutrient('saltG', per.saltG).toLocaleString()}${ja.nutrition.gramUnit}`
    : ja.nutrition.unavailableSummary
  // 量が書いてあるのに計算できなかった材料(主材料の脱落)がある状態。
  // 折りたたんだ既定の1行でも分かるようにする(2026-07-28 便BY/NUT-01)
  const materialGap = hasMaterialGap(nutrition)
  const gapCount = nutrition.excluded.filter(
    (e) => e.reason === 'food' || e.reason === 'unit',
  ).length

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
            {ja.nutrition.summaryLabel.replace('{s}', String(displayServings))}
            {summaryText}
            {canShowSummary && materialGap && (
              <span className="ml-1 whitespace-nowrap font-bold text-warning">
                {ja.nutrition.materialGapBadge.replace('{n}', String(gapCount))}
              </span>
            )}
          </span>
          <ChevronIcon size={20} className="shrink-0 text-ink-muted" aria-hidden />
        </button>

        {expanded && (
          <div className="border-t border-edge p-[var(--space-md)] pt-[var(--space-sm)]">
            {unlocked ? (
              <UnlockedBody nutrition={nutrition} displayServings={displayServings} />
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
      <p className="text-sm font-bold text-accent">
        {ja.nutrition.assumedLabel.replace('{n}', String(nutrition.assumed.length))}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted">{ja.nutrition.assumedHint}</p>
      <p className="mt-0.5 text-sm">
        {nutrition.assumed.map((a) => `${a.name}（${a.note}）`).join('、')}
      </p>
    </div>
  )
}

/** 計算に含めていない理由の表示順（重い順: 量が書いてあるのに計算できなかったものを先に出す） */
const EXCLUDED_REASON_ORDER: ExcludedReason[] = ['food', 'unit', 'amount', 'prep']
const EXCLUDED_REASON_LABEL: Record<ExcludedReason, string> = {
  food: ja.nutrition.excludedReasonFood,
  unit: ja.nutrition.excludedReasonUnit,
  amount: ja.nutrition.excludedReasonAmount,
  prep: ja.nutrition.excludedReasonPrep,
}

/**
 * 計算に含めていない材料一覧（両状態で共通のブロック）。
 * 2026-07-28 便BY/NUT-02: 理由ごとにグループ分けし、保存されている分量テキストを併記する。
 * 「鶏むね肉＝単位を換算できない」と「秘伝のタレ＝成分データが無い」では直し方が正反対なので、
 * 一般文をまとめて出すのではなく材料ごとに理由が分かる形にする。
 * 併せて、除外は必ず「引く」側にしか働かない＝めやすは下限側であることを1文で明示する。
 */
function ExcludedBlock({ nutrition }: { nutrition: Nutrition }) {
  if (nutrition.excluded.length === 0) return null
  const groups = EXCLUDED_REASON_ORDER.map((reason) => ({
    reason,
    items: nutrition.excluded.filter((e) => e.reason === reason),
  })).filter((g) => g.items.length > 0)
  return (
    <div className="rounded-md border-2 border-dashed border-edge p-[var(--space-sm)]">
      <p className="text-sm font-bold text-ink-muted">
        {ja.nutrition.excludedLabel.replace('{n}', String(nutrition.excluded.length))}
      </p>
      <ul className="mt-0.5 space-y-1">
        {groups.map((g) => (
          <li key={g.reason} className="text-sm">
            <span className="text-xs text-ink-muted">{EXCLUDED_REASON_LABEL[g.reason]}: </span>
            {g.items
              .map((e) => (e.amountText ? `${e.name}（${e.amountText}）` : e.name))
              .join('、')}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.excludedDirectionNote}</p>
    </div>
  )
}

/** 量が書いてあるのに計算できなかった材料があるときだけ出す注意（2026-07-28 便BY/NUT-01） */
function MaterialGapNote({ nutrition }: { nutrition: Nutrition }) {
  if (!hasMaterialGap(nutrition)) return null
  return <p className="text-sm font-bold text-warning">{ja.nutrition.materialGapNote}</p>
}

/** 出典表記（両状態で共通・2026-07-28 便BY/NUT-05で内訳と精度感を明記） */
function SourceNote() {
  return (
    <div className="space-y-0.5 text-xs text-ink-muted">
      <p>
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
      </p>
      <p>{ja.nutrition.sourceOfficialNote}</p>
      <p>{ja.nutrition.sourceCommercialNote}</p>
      <p>{ja.nutrition.precisionNote}</p>
    </div>
  )
}

/** 状態1: 未解錠（無料版）。エネルギー・食塩相当量は既に見出し行に出ているので、
 *  展開後は注記・出典・Pro案内・計算対象外だけを出す */
function LockedBody({ nutrition, isPro }: { nutrition: Nutrition; isPro: boolean }) {
  return (
    <div className="space-y-[var(--space-sm)]">
      {/* Pro版で増える項目の明示(2026-07-13 UIペルソナQA)。詳しい提供時期の話(freeDescription系)より
          先に、まず「何が増えるか」を1文で伝える */}
      <p className="text-sm text-ink-muted">{ja.nutrition.proNutrientHighlight}</p>
      <MaterialGapNote nutrition={nutrition} />
      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />
      <p className="text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <SourceNote />
      {/* Pro未解錠のユーザーには、これらのめやすが買い切りのPro版で表示されること
          (設定のProタブから解錠できること)を伝える。isProの分岐は栄養フル版の公開フラグを
          落としたとき用の保険(通常は未解錠=非ProなのでfreeDescription側が出る) */}
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

/** 状態2: Pro解錠済み。8項目の実内訳（1人分・全量）＋計算対象外・注記・出典
 *  (2026-07-13 第2弾: 食物繊維・鉄・カルシウムを追加。オーナー承認・Fable設計) */
function UnlockedBody({ nutrition, displayServings }: { nutrition: Nutrition; displayServings: number }) {
  const per = nutrition.perServing
  // 全量は「表示している1人分の値 × 人数」で作る(2026-07-28 便BY/NUT-06)。
  // 従来は丸める前の値に人数を掛けてから個別に丸めていたため、画面の1人分を掛け算した結果と
  // 一致しなかった(塩分 4.1×4=16.4 なのに全量が16.6 と出る等)。暗算で検算する人には
  // 計算ミスに見えるので、表示どうしが必ず噛み合う側に揃える(どちらも同じ「めやす」の精度内)
  const scaleForDisplay = (key: keyof NutrientTotals): number =>
    roundNutrient(key, per[key]) * displayServings
  const totalForDisplay: NutrientTotals = {
    kcal: scaleForDisplay('kcal'),
    proteinG: scaleForDisplay('proteinG'),
    fatG: scaleForDisplay('fatG'),
    carbG: scaleForDisplay('carbG'),
    saltG: scaleForDisplay('saltG'),
    fiberG: scaleForDisplay('fiberG'),
    ironMg: scaleForDisplay('ironMg'),
    calciumMg: scaleForDisplay('calciumMg'),
  }

  // 食物繊維・鉄・カルシウムは既存のたんぱく質・脂質・炭水化物の並びに続けて置き、
  // 塩分相当量は従来どおり最後に置く(注意して見る項目なので末尾で目に留まりやすく)
  const rows: { key: keyof NutrientTotals; label: string }[] = [
    { key: 'kcal', label: ja.nutrition.kcalLabel },
    { key: 'proteinG', label: ja.nutrition.proteinLabel },
    { key: 'fatG', label: ja.nutrition.fatLabel },
    { key: 'carbG', label: ja.nutrition.carbLabel },
    { key: 'fiberG', label: ja.nutrition.fiberLabel },
    { key: 'ironMg', label: ja.nutrition.ironLabel },
    { key: 'calciumMg', label: ja.nutrition.calciumLabel },
    { key: 'saltG', label: ja.nutrition.saltLabel },
  ]

  const fmt = (key: keyof NutrientTotals, value: number): string => {
    const n = roundNutrient(key, value).toLocaleString()
    if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
    if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
    return `${n} ${ja.nutrition.gramUnit}`
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

      <MaterialGapNote nutrition={nutrition} />
      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />

      <p className="text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      {/* ビタミン非表示の理由(2026-07-13オーナー指示)。Pro解錠時のみ表示(無料側は栄養3項目が
          見えていないので注記も不要) */}
      <p className="text-xs text-ink-muted">{ja.nutrition.vitaminNote}</p>
      <SourceNote />
    </div>
  )
}
