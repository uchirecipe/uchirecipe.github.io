import { useState } from 'react'
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react'
import {
  NUTRITION_TEASER_ENABLED,
  isNutritionUnlocked,
  nutritionSourceName,
  roundNutrient,
  type NutrientTotals,
  NUTRITION_DISPLAY_KEYS,
  nutritionLabelFor,
  nutritionUnitFor,
} from '../logic/nutrition'
import {
  DAILY_GUIDES,
  riceServingGrams,
  roundVegetableGrams,
  type BalanceBasis,
  type BalanceSum,
  type SlotBalance,
} from '../logic/nutritionBalance'
import Collapse from './Collapse'
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
 * - **1日のめやす（食塩相当量・野菜量）は説明文1行で書く**（2026-08-02 便CW-7・オーナー指示。
 *   従来の「1日のめやすとくらべる」＝値ごとの並置UIは廃止した）。食塩相当量のめやすは
 *   Pro解錠時のみ出す（値そのものがPro側なので、めやすだけ先に出すと無料側に塩分の話が残る）。
 *   エネルギー・たんぱく質・脂質・炭水化物にはめやすの線を引かない（docs/60 §1-2）。
 * - 不足・過多は断定しない。色でも善悪を表さない。
 * - **食事（朝食/昼食/夕食）ごとの小計はPro解錠時のみ**（2026-08-02 便CW-6・オーナー要望）。
 */
export default function NutritionBalancePanel({
  scope,
  basis,
  isToday,
  dateLabel,
  isPro,
  balance,
  includeRice,
  onToggleIncludeRice,
  riceServings = 0,
  slotBreakdown,
}: {
  /** 'day' = 週タブの各日カード / 'week' = 週まとめ */
  scope: 'day' | 'week'
  /** 'day' のとき、その日を数えた基準（作った記録／登録した献立／今日で両方＝mixed） */
  basis?: BalanceBasis
  /**
   * 今日を含むか（'day'＝その日が今日／'week'＝表示中の週に今日が入っている。2026-08-09 便EK）。
   * 今日だけは「作った記録があるものは記録、まだのものは登録した献立」で数えるので、
   * 数え方の1行を過ぎた日・先の日と書き分ける。
   */
  isToday?: boolean
  /** 'day' のとき、開閉ボタンの読み上げ名に入れる日付表記（7日分が同名で並ぶのを避ける） */
  dateLabel?: string
  isPro: boolean
  balance: BalanceSum
  /** 「ごはんを含めて計算する」の現在値（2026-08-02 便CW-10。無料・既定OFF） */
  includeRice: boolean
  /** 同チェックの切り替え（設定に保存する。押した瞬間から日・週・食費の数字に効く） */
  onToggleIncludeRice: (next: boolean) => void
  /**
   * いま出している合計に足したごはんの杯数（2026-08-10 便FD・オーナー実機）。
   * 呼び出し側が合計を作ったときの実数をそのまま渡す＝ここでは数え直さない。
   * 0（＝チェックがOFF、または足す食事が1つも無い）のときは行を出さない。
   */
  riceServings?: number
  /**
   * 食事ごとの小計（2026-08-02 便CW-6。Pro解錠時だけ展開部に出す）。
   * 2つ以上の食事に献立があるときだけ渡す＝1食だけの日は1日の合計と同じ数字になるので出さない。
   * 作った記録には食事の情報が無いため、過ぎた日と、献立に無い料理を作った記録がある日には渡らない
   * （小計を足しても1日の合計にならない日には出さない。2026-08-09 便EK）
   */
  slotBreakdown?: SlotBalance[]
}) {
  const [expanded, setExpanded] = useState(false)
  // 但し書きと出典の折りたたみ（2026-08-09 便EN）。既定は畳む
  const [notesOpen, setNotesOpen] = useState(false)
  // 週まとめは「この週ぜんぶを振り返る主役の数字」なので、日カードより大きく組む
  // （2026-08-09 便EN・オーナー実機「文字を大きく・縦幅を曜日ごとの献立より大きく」）
  const isWeek = scope === 'week'
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
      : basis === 'mixed'
        ? ja.nutritionBalance.dayTitleMixed
        : basis === 'actual'
          ? ja.nutritionBalance.dayTitleActual
          : ja.nutritionBalance.dayTitlePlan
  // 各値は「約516kcal」「塩分約0g」のように語と数字の途中で改行されないよう、値ごとに折り返し禁止で置く
  // （390px幅では「塩分約」で改行されて読みにくかった）。
  // 塩分はPro解錠時のみ（2026-08-01 線引きB'。無料は「約◯kcal・野菜約◯g」の2値）
  const summaryValues = canShowNumbers
    ? summaryValuesOf(balance, unlocked)
    : [ja.nutrition.unavailableSummary]
  // 1日のめやす（食塩相当量・野菜量）の説明文1行（2026-08-02 便CW-7）。
  // 数値は DAILY_GUIDES から埋める＝基準値をUIに直書きしない（docs/60 §1-1）
  const guideNote = unlocked
    ? ja.nutritionBalance.guideNote
        .replace('{male}', DAILY_GUIDES.saltG.male.toLocaleString())
        .replace('{female}', DAILY_GUIDES.saltG.female.toLocaleString())
        .replace('{veg}', DAILY_GUIDES.vegetableG.perDayG.toLocaleString())
    : ja.nutritionBalance.guideNoteFree.replace(
        '{veg}',
        DAILY_GUIDES.vegetableG.perDayG.toLocaleString(),
      )

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

  // 折りたたんだままでも「この数字は下振れしている」と分かるようにする
  // （便BY/NUT-01と同じ作法。展開しないと分からない状態にしない）
  const gapBadge = canShowNumbers && gapDishCount > 0 && (
    <span className="ml-1 whitespace-nowrap font-bold text-warning">
      {ja.nutritionBalance.gapBadge.replace('{n}', String(gapDishCount))}
    </span>
  )
  const valueSpans = summaryValues.map((value, i) => (
    <span key={value} className="whitespace-nowrap">
      {i > 0 && ja.nutritionBalance.summarySeparator}
      {value}
    </span>
  ))

  return (
    <div className="rounded-md border border-edge bg-app">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={toggleLabel}
        className={`flex w-full items-center justify-between gap-2 text-left ${
          isWeek ? 'p-[var(--space-md)]' : 'p-[var(--space-sm)]'
        }`}
      >
        {isWeek ? (
          /* 週まとめ: 見出しと数字を2段に分け、数字を大きく置く（日カードは1行のまま） */
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1 text-sm font-bold text-ink-muted">
              <Sparkles size={14} className="shrink-0 text-accent-ink" aria-hidden />
              {title}
            </span>
            <span className="mt-1 block text-lg font-bold">
              {valueSpans}
              {gapBadge}
            </span>
          </span>
        ) : (
          <span className="min-w-0 flex-1 text-xs text-ink-muted">
            <Sparkles size={12} className="mr-1 inline-block shrink-0 text-accent-ink" aria-hidden />
            <span className="font-bold">{title}</span>: {valueSpans}
            {gapBadge}
          </span>
        )}
        <ChevronIcon size={isWeek ? 20 : 16} className="shrink-0 text-ink-muted" aria-hidden />
      </button>

      <Collapse open={expanded}>
        <div className="space-y-[var(--space-sm)] border-t border-edge p-[var(--space-sm)]">
          {canShowNumbers && (
            <NutrientRows totals={per} vegetableG={vegetableG} unlocked={unlocked} />
          )}
          {/* 食事ごとの小計（Pro・2026-08-02 便CW-6）。1日の合計のすぐ下に置く */}
          {canShowNumbers && unlocked && slotBreakdown && slotBreakdown.length > 1 && (
            <SlotBreakdown slots={slotBreakdown} />
          )}
          {!unlocked && <ProNutrientTeaser isPro={isPro} />}
          {/* ごはんを含めて計算する（2026-08-02 便CW-10・無料・既定OFF）。
              選択は設定に残り、日・週の合計と週の概算食費に同時に効く */}
          <div className="rounded-md border border-edge p-[var(--space-sm)]">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={includeRice}
                onChange={(e) => onToggleIncludeRice(e.target.checked)}
                data-testid="include-rice"
                className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
              />
              <span className="text-sm font-bold">
                {ja.nutritionBalance.includeRiceLabel.replace('{g}', String(riceServingGrams()))}
              </span>
            </label>
            <p className="mt-1 text-xs text-ink-muted">{ja.nutritionBalance.includeRiceHint}</p>
          </div>
          {/* 1日のめやすは説明文1行だけにする（2026-08-02 便CW-7・オーナー指示）。
              自分の数値との並置・良し悪しの判定はしない */}
          {canShowNumbers && <p className="text-xs text-ink-muted">{guideNote}</p>}
          <div className="space-y-0.5 text-xs text-ink-muted">
            {/* どの基準で数えたか。今日だけは記録と献立が同居しうるので1行を分ける
                （2026-08-09 便EK。期間カードの基準行と同じ言い方にそろえてある） */}
            <p>
              {scope === 'week'
                ? ja.nutritionBalance.weekBasisNote
                : isToday
                  ? ja.nutritionBalance.basisNoteToday
                  : basis === 'actual'
                    ? ja.nutritionBalance.basisNoteActual
                    : ja.nutritionBalance.basisNotePlan}
            </p>
            {scope === 'week' && isToday && <p>{ja.nutritionBalance.basisNoteToday}</p>}
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
            {/* 2026-08-02 便DE-12(オーナー指示): 「何が入っていないか」の行だけ太字にする。
                合計に含めていないもの（ごはん・飲みもの・おやつ・外食／野菜に数えない食品群）は、
                数字の読み方が変わる情報なのに、ほかの注記と同じ細い小文字で埋もれていた。
                2026-08-09 便EN: 残りの但し書き・出典は折りたたみへ移したが、この1行だけは
                「合計に何が入っていないか」＝数字の意味そのものなので畳まずに残す */}
            <p className="font-bold">
              {includeRice
                ? ja.nutritionBalance.registeredOnlyNoteWithRice
                : ja.nutritionBalance.registeredOnlyNote}
            </p>
            {/* 何杯ぶん足したか（2026-08-10 便FD・オーナー実機）。「1食につき1杯」の規則だけでは
                その日に何杯入るのかが読めないので、実際に合計へ積んだ杯数をそのまま出す */}
            {includeRice && riceServings > 0 && (
              <p data-testid="rice-added-note" className="font-bold">
                {(isWeek
                  ? ja.nutritionBalance.riceAddedNoteWeek
                  : ja.nutritionBalance.riceAddedNoteDay
                ).replace('{n}', String(riceServings))}
              </p>
            )}
          </div>
          {/* 但し書きと出典（2026-08-09 便EN・オーナー実機「注意説明が長い」）。
              月タブの栄養カードと同じ文言・同じ作法で畳む */}
          <div>
            <button
              type="button"
              onClick={() => setNotesOpen((v) => !v)}
              aria-expanded={notesOpen}
              className="inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-xs font-bold text-accent-ink shadow-sm"
            >
              {ja.nutritionBalance.notesToggle}
              {notesOpen ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
            </button>
            <Collapse open={notesOpen}>
              <div className="mt-[var(--space-sm)] space-y-0.5 text-xs text-ink-muted">
                <p>{ja.nutritionBalance.registeredOnlyMealNote}</p>
                {/* 除外した材料の分は合計に入っていない＝この数字は下限側であることの明示
                    （docs/60 §1-3-4: レシピ詳細と同じ方向の但し書きを日・週の合計にも出す） */}
                <p>{ja.nutrition.excludedDirectionNote}</p>
                <p className="font-bold">{ja.nutritionBalance.vegetableCountNote}</p>
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
            </Collapse>
          </div>
        </div>
      </Collapse>
    </div>
  )
}

/** 表示用の単位付き整形（単位も logic/nutrition.ts に一本化・2026-08-19 便HU・⑯） */
function formatNutrient(key: keyof NutrientTotals, value: number): string {
  return `${roundNutrient(key, value).toLocaleString()} ${nutritionUnitFor(key)}`
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
  // 食塩相当量もPro側（2026-08-01 線引きB'）。顔ぶれ・名前は logic/nutrition.ts に一本化
  // （2026-08-19 便HU・⑯。栄養価の表示とレシピ一覧の並び替えで違う顔ぶれを出さない）
  const rows: { key: keyof NutrientTotals; label: string }[] = NUTRITION_DISPLAY_KEYS.filter(
    (key) => unlocked || key === 'kcal',
  ).map((key) => ({ key, label: nutritionLabelFor(key) }))
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
 * 折りたたんだ1行と同じ値の並び（「約516kcal・塩分約2.1g・野菜約120g」）を組み立てる。
 * 1日の合計にも食事ごとの小計にも同じ関数を使う＝同じ数字の出し方を2か所に書かない。
 * 塩分はPro解錠時のみ（2026-08-01 線引きB'）。
 */
function summaryValuesOf(balance: BalanceSum, unlocked: boolean): string[] {
  const per = balance.nutrition.total
  return [
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
    ja.nutritionBalance.summaryVegetable.replace(
      '{n}',
      roundVegetableGrams(balance.vegetableG).toLocaleString(),
    ),
  ]
}

/**
 * 食事（朝食/昼食/夕食）ごとの小計（2026-08-02 便CW-6・オーナー要望。Pro解錠時のみ）。
 * 1日の合計と同じ値の並びを、食事ごとに1行ずつ出すだけ＝新しい計算も新しい判定も足さない。
 */
function SlotBreakdown({ slots }: { slots: SlotBalance[] }) {
  return (
    <div className="rounded-md border border-edge p-[var(--space-sm)]">
      <p className="text-sm font-bold text-ink-muted">
        {ja.nutritionBalance.slotBreakdownTitle}
      </p>
      <dl className="mt-1 space-y-0.5">
        {slots.map(({ slot, balance }) => (
          <div key={slot} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="text-sm font-bold">{ja.mealPlan.slot[slot]}</dt>
            <dd className="text-sm tabular-nums text-ink-muted">
              {summaryValuesOf(balance, true).map((value, i) => (
                <span key={value} className="whitespace-nowrap">
                  {i > 0 && ja.nutritionBalance.summarySeparator}
                  {value}
                </span>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
