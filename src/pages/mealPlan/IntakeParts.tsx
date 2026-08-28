/**
 * 献立タブの「栄養と食費」まわりの部品（2026-08-25 便KZ）。
 *
 * MealPlanPage.tsx から**そのまま**切り出した（docs/74 第3手）。中身は1文字も変えていない
 * ＝見た目も動きも変わらない。変えたのは import の書き方と、末尾の export だけ。
 * 月タブの常設カードと、期間を選んで見る集計カードが同じものを使う。
 */
import { Link } from 'react-router-dom'
import { ChevronDown, ChevronUp } from 'lucide-react'
import NutritionGapDishes from '../../components/NutritionGapDishes'
import SwapLabel from '../../components/SwapLabel'
import { nutritionSourceName, roundNutrient, type NutrientTotals } from '../../logic/nutrition'
import type { RangeIntakeSummary } from '../../logic/rangeSummary'
import { ja } from '../../i18n/ja'

/**
 * 期間の集計「期間内に摂取できた栄養（1人分）」の表示行（8項目。NutritionTeaserと同じ並び）。
 * 2026-07-24 便BS・タスク3で新設し、2026-07-28 便CAで「1食あたりの平均」から
 * 「1人が期間内に食べた分の合計」へ意味を変えた（行の並び自体は据え置き）。
 */
const PERIOD_NUTRIENT_ROWS: { key: keyof NutrientTotals; label: string }[] = [
  { key: 'kcal', label: ja.nutrition.kcalLabel },
  { key: 'proteinG', label: ja.nutrition.proteinLabel },
  { key: 'fatG', label: ja.nutrition.fatLabel },
  { key: 'carbG', label: ja.nutrition.carbLabel },
  { key: 'fiberG', label: ja.nutrition.fiberLabel },
  { key: 'ironMg', label: ja.nutrition.ironLabel },
  { key: 'calciumMg', label: ja.nutrition.calciumLabel },
  { key: 'saltG', label: ja.nutrition.saltLabel },
]

const formatNutrient = (key: keyof NutrientTotals, value: number): string => {
  const n = roundNutrient(key, value).toLocaleString()
  if (key === 'kcal') return `${n} ${ja.nutrition.kcalUnit}`
  if (key === 'ironMg' || key === 'calciumMg') return `${n} ${ja.nutrition.mgUnit}`
  return `${n} ${ja.nutrition.gramUnit}`
}

/**
 * 栄養（1人分・8項目）のパネル（2026-07-28 便CAの表示をそのまま部品化）。
 * 期間を選んで見る集計カードと、2026-07-29 便CB-1・docs/59 B-3で常設にした月間サマリーの
 * 両方から使う（同じ数え方・同じ「目安／概算」表記を1か所で守るため）。
 * 呼び出し側で「栄養が解錠されているか(isNutritionUnlocked)」と「計算できた品数>0」を判定してから使う。
 * 何を集計した数字なのかは呼び出し側の見出しが言い切るので、パネル自身は見出しを持たない
 * （2026-08-03 便DQで月タブ・便DRで期間カードの見出しへ集約した）。
 */
function IntakeNutritionPanel({
  summary,
  notes = 'full',
  dishLink,
}: {
  summary: RangeIntakeSummary
  /**
   * 添える注記の量（2026-08-03 便DQ・規約H「長文は折りたたみ・表で構成する」）。
   * 'full'=算出方法＋概算の但し書き＋出典まで。
   * 'brief'=数と警告だけ。長い但し書きと出典は呼び出し側の折りたたみ（NutritionSourceNotes）へ移す
   */
  notes?: 'full' | 'brief'
  /**
   * 「計算できなかった料理」の名前を押したときの帰り道（2026-08-28 便MA）。
   * 週タブの NutritionBalancePanel に渡すものと同じ形・同じ名前。
   * 渡さなければ今までどおりレシピ一覧へ戻る。
   */
  dishLink?: { linkState?: { from: string; fromPath: string }; onNavigate?: () => void }
}) {
  return (
    <div>
      <div
        className="mt-1 rounded-md border border-edge p-[var(--space-sm)]"
        style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
      >
        {/* 期間合計は1食分より桁が大きく(1か月で数万kcal)、ラベルと値を横並びにすると
            375px幅で「エネルギー」が途中改行される。項目名の上に値を置く2段組にして
            桁が伸びても崩れないようにする(2026-07-28 便CA・視認性優先) */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {PERIOD_NUTRIENT_ROWS.map(({ key, label }) => (
            <div key={key} className="flex flex-col">
              <span className="text-xs text-ink-muted">{label}</span>
              <span className="text-sm font-bold text-accent-ink tabular-nums">
                {formatNutrient(key, summary.nutrition.total[key])}
              </span>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {(summary.actual.nutrition.dishCount > 0 && summary.plan.nutrition.dishCount > 0
          ? ja.mealPlan.rangeIntakeNutritionCountBoth
          : summary.actual.nutrition.dishCount > 0
            ? ja.mealPlan.rangeIntakeNutritionCountActual
            : ja.mealPlan.rangeIntakeNutritionCountPlan
        )
          .replace('{a}', String(summary.actual.nutrition.dishCount))
          .replace('{p}', String(summary.plan.nutrition.dishCount))}
      </p>
      {/* 2026-08-23 便JP・②: 件数の1行のすぐ下に、**どの料理か**を料理名で並べる
          （週タブの栄養パネルとまったく同じ部品・同じ並べ方。同じものを2つ作らない） */}
      {summary.nutrition.excludedDishCount > 0 && (
        <>
          <p className="mt-0.5 text-xs text-ink-muted">
            {ja.mealPlan.rangeIntakeNutritionExcluded.replace(
              '{n}',
              String(summary.nutrition.excludedDishCount),
            )}
          </p>
          <NutritionGapDishes sum={summary.nutrition} kind="excluded" {...dishLink} />
        </>
      )}
      {/* 量が書いてあるのに計算できなかった材料があるレシピは、合計を静かに下げる。
          既にある「除いた品数」の明示と同じ作法で件数を出す(2026-07-28 便BY/NUT-01) */}
      {summary.nutrition.partialDishCount > 0 && (
        <>
          <p className="mt-0.5 text-xs font-bold text-warning">
            {ja.mealPlan.rangeIntakeNutritionPartial.replace(
              '{n}',
              String(summary.nutrition.partialDishCount),
            )}
          </p>
          <NutritionGapDishes sum={summary.nutrition} kind="partial" {...dishLink} />
        </>
      )}
      {notes === 'full' && <NutritionSourceNotes />}
    </div>
  )
}

/**
 * 栄養の数字の但し書きと出典（2026-08-03 便DQで部品化）。
 * 期間の集計カードは従来どおり数値のすぐ下に置き、月タブの栄養カードは折りたたみの中に置く
 * （オーナー指示「文字が多すぎ。ここでユーザーが見たいのは数値です」・規約H）。
 * どちらの置き場所でも文面は同じで、出典を落とすことはしない。
 */
function NutritionSourceNotes() {
  return (
    <>
      <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.estimateNote}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {ja.nutrition.sourcePrefix}
        {nutritionSourceName()}
        {'　'}
        {ja.nutrition.sourceCommercialNote}
      </p>
    </>
  )
}

/**
 * 食費の表の1行（2026-08-03 便DQで月タブに導入 → 便DRで期間カードと共用の部品にした）。
 * 見出しは「label＝何の数字か」「note＝数え方」の2段。meals を省く/nullにすると食数の列は空になる
 * （割り算で出した平均のように、食数を持たない行のため）。
 */
type IntakeCostRow = {
  label: string
  /** 数え方。「◯÷◯」を含む文は割り算の記号で折り返す(390px幅で「日」だけが次行に落ちないように) */
  note: string
  yen: number
  meals?: string | null
}

/**
 * 食費の表（2026-08-03 便DR）。月タブの常設カードと、期間を選んで見る集計カードで共用する。
 * オーナー指示「ここでユーザーが見たいのは数値です」(便DQ)の体裁＝項目/金額/食数の3列を1か所で守り、
 * どの行を出すかだけを呼び出し側が決める（月＝その月ぜんぶ・期間＝選んだ範囲で行の中身が違うため）。
 *
 * 2026-08-19 便HV（オーナー書き溜め⑧⑨「過去と未来に分けない表示のみでいいのでは？
 * 過去の数値が知りたい人は過去の期間のみで絞り込みするし、これからの予算が知りたい人も然り。
 * その方が表示がシンプルでわかりやすいと思う」）: 表の下段に分けていた
 * 「これから作る予定」をやめ、行は1組だけにした。金額も食数も、作った記録ぶんと
 * これから作る予定ぶんを足した1つの数字を出す（logic/rangeSummary.ts の householdYen/mealCount）。
 */
function IntakeCostTable({
  testId,
  rows,
}: {
  testId: string
  rows: IntakeCostRow[]
}) {
  const renderRow = (row: IntakeCostRow) => {
    const divided = row.note.split('÷')
    return (
      <tr key={`${row.label}-${row.note}`} className="border-b border-edge">
        <th scope="row" className="py-1.5 text-left align-top font-normal">
          <span className="block font-bold">{row.label}</span>
          <span className="block text-xs text-ink-muted">
            {divided.length === 2 ? (
              <>
                <span className="whitespace-nowrap">{divided[0]}÷</span>
                <span className="whitespace-nowrap">{divided[1]}</span>
              </>
            ) : (
              row.note
            )}
          </span>
        </th>
        <td className="py-1.5 pl-2 text-right align-top font-bold whitespace-nowrap text-accent-ink tabular-nums">
          {ja.mealPlan.intakeCostYen.replace('{n}', row.yen.toLocaleString())}
        </td>
        {row.meals != null ? (
          <td className="py-1.5 pl-2 text-right align-top whitespace-nowrap tabular-nums">
            {row.meals}
          </td>
        ) : (
          <td className="py-1.5 pl-2 text-right align-top" />
        )}
      </tr>
    )
  }
  return (
    <table
      data-testid={testId}
      className="mt-[var(--space-sm)] w-full border-collapse text-sm"
    >
      <thead>
        <tr className="border-b border-edge text-xs text-ink-muted">
          <th scope="col" className="pb-1 text-left font-normal">
            {ja.mealPlan.intakeCostColItem}
          </th>
          <th scope="col" className="pb-1 pl-2 text-right font-normal">
            {ja.mealPlan.intakeCostColYen}
          </th>
          <th scope="col" className="pb-1 pl-2 text-right font-normal">
            {ja.mealPlan.intakeCostColMeals}
          </th>
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  )
}

/**
 * 折りたたみの開閉ボタン（2026-08-03 便DR）。月タブの食費・栄養カードと期間カードで、
 * 「畳んである中身がある」ことの見え方を1か所にそろえる（規約H・長文は折りたたみへ）。
 */
function IntakeDisclosureButton({
  open,
  onToggle,
  openLabel,
  closeLabel,
}: {
  open: boolean
  onToggle: () => void
  /** 畳んでいるときに出す文言（押すと開く） */
  openLabel: string
  /** 開いているときに出す文言（押すと閉じる） */
  closeLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      /* 2026-08-28 オーナー原文「主役のはずの内訳の文字が小さくて見つけにくい。
         文字をちょっぴり大きくして」: 字の大きさの段を1つ上げた（text-sm 14px → text-base 16px）。
         色（text-accent-ink）と太さ（font-bold）は動かしていない＝大きさだけの話。
         このボタンは「内訳を見る」と「注記と出典」で共用しており、2つの見え方を1か所で
         そろえるために置いてある部品なので、片方だけ別の大きさにはしない
         （同じ操作が2つの大きさで並ぶほうが読みにくい）。見張りは MB-8 */
      className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-app px-3 py-2 text-base font-bold text-accent-ink shadow-sm"
    >
      {/* 「内訳を見る」⇔「内訳を閉じる」で文字数が変わってもボタンの幅は動かさない（便EO） */}
      <SwapLabel current={open ? closeLabel : openLabel} labels={[openLabel, closeLabel]} />
      {open ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
    </button>
  )
}

/**
 * 食費の折りたたみの中身（2026-08-03 便DR）。表の「1人分」を実績ぶんと予定ぶんに割った内訳と、
 * この金額に何が入っていないか（価格が分からない材料）の注記。月タブと期間カードで共用する。
 */
function IntakeCostDetails({
  summary,
  pricelessCount,
}: {
  summary: RangeIntakeSummary
  pricelessCount: number
}) {
  return (
    <div className="mt-[var(--space-sm)]">
      <p className="text-xs text-ink-muted">
        {ja.mealPlan.rangeIntakeCostBreakdown
          .replace('{a}', summary.actual.personalYen.toLocaleString())
          .replace('{an}', String(summary.actual.dishCount))
          .replace('{p}', summary.plan.personalYen.toLocaleString())
          .replace('{pn}', String(summary.plan.dishCount))}
      </p>
      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.mealPlan.weekCostNote}</p>
      {/* 価格が分からない材料の分は1円も入っていない＝この金額の信頼度を必ず添える
          (2026-07-30 便CH/C2。週の概算食費にだけ入っていた注記を揃えた) */}
      {pricelessCount > 0 && (
        <p className="mt-1 text-xs text-ink-muted">
          {ja.mealPlan.weekCostPriceless.replace('{n}', String(pricelessCount))}
        </p>
      )}
      <Link to="/prices" className="mt-1 inline-block text-xs font-bold text-accent-ink underline">
        {ja.mealPlan.weekCostNoteLink}
      </Link>
    </div>
  )
}

export {
  formatNutrient,
  IntakeNutritionPanel,
  NutritionSourceNotes,
  IntakeCostTable,
  IntakeDisclosureButton,
  IntakeCostDetails,
}
export type { IntakeCostRow }
