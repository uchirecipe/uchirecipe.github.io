import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ChevronDown, ChevronUp, Lock } from 'lucide-react'
import {
  NUTRITION_TEASER_ENABLED,
  isNutritionUnlocked,
  computeRecipeNutrition,
  hasMaterialGap,
  saltSourceGaps,
  roundNutrient,
  nutritionSourceName,
  type ExcludedReason,
  type NutrientTotals,
  NUTRITION_DISPLAY_KEYS,
  nutritionLabelFor,
  nutritionUnitFor,
} from '../logic/nutrition'
import { roundVegetableGrams, vegetableGramsOf } from '../logic/nutritionBalance'
import type { Recipe, ServingsUnit } from '../db/types'
import { SCREEN_PANEL } from '../logic/navMemory'
import { useSettingsDetour } from './useScreenReturn'
import { useSettings, updateSettings } from '../db/settings'
import { canUseNutritionTrial } from '../logic/proTrial'
import Collapse from './Collapse'
import { ja } from '../i18n/ja'
import { servingsUnitText } from '../logic/servingsUnit'

/**
 * レシピ詳細に置く「栄養価の目安」枠（M6-1）。
 *
 * 折りたたみ式（2026-07-11 オーナー実機フィードバック「邪魔・面積を取りすぎる」）:
 * 既定は「{タイトル}（2人分レシピの1食あたり）: 498kcal・野菜約120g」の1行＋展開アイコンのみ
 * （2026-08-02 オーナー指示で野菜量を追加。無料で見える2項目＝線引きB'とそろえる）。
 * タップで、これまでの内容（数値の表・注記・出典・Pro案内・計算対象外等）を展開表示する。
 * 計算対象の材料が1つも無い（分量不明・成分データ無し等ですべて計算対象外）場合は、
 * 「0kcal」という誤解を招く数値を出さず、計算できなかった旨の1行にする。
 *
 * 状態は引き続き2つ:
 * 1. 未解錠（isNutritionUnlocked=false） … **エネルギーと野菜量(g)** を無料版でも実際に計算して
 *    表示する（2026-08-01 オーナー確定・線引きB'。従来の無料2項目「エネルギー・食塩相当量」から
 *    食塩相当量を外し、代わりに野菜量を無料側に置いた。野菜量は献立タブのバランス表示と同じ数え方）。
 *    残り7項目（たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウム・食塩相当量）はPro案内にとどめる。
 * 2. 解錠済み（NUTRITION_ENABLED && isPro） … 8項目＋野菜量の実パネル（2026-07-13 第2弾で
 *    食物繊維・鉄・カルシウムを追加、2026-08-01 で野菜量を追加）。
 *    「概算・目安」表記と計算対象外n件の明示が必須。
 *
 * 2026-08-08 便DZ: 未解錠の人が**好きなレシピ1つで1回だけ**、状態2と同じ8項目のフル表示を
 * 見られるお試しを足した（logic/proTrial.ts・並行調理ナビ3回/月間献立1回と同じ作法）。
 * 使ったことは端末内（settings.nutritionTrialUsed）にだけ残し、Proの表示ゲート
 * （isNutritionUnlocked）は変えない＝この画面を離れればロック表示に戻る。
 *
 * 数値の表は無料/Proで同じ部品（NutrientTable）を使い、行数だけを変える。
 * 同じ数字を2通りの見た目で出さないため（丸め・全量の掛け算規則も1か所に集約する）。
 */
export default function NutritionTeaser({
  isPro,
  recipe,
  servings,
  defaultExpanded = false,
}: {
  isPro: boolean
  /** レシピ本体（実計算に使う。ingredients/servings/steps と、1食に分けない品・人数分未確認の印だけ参照。
   * steps は「食べずに捨てる塩」（ゆで湯用/下ごしらえ用）の判定に使う（2026-09-01 便MT）。
   * servingsUnread は「人数分は未確認」の注意（2026-09-01 便MU） */
  recipe: Pick<
    Recipe,
    'ingredients' | 'servings' | 'servingsUnread' | 'servingsUnit' | 'wholeBatch' | 'steps'
  >
  /** 詳細画面で現在表示中の人数（全量の表示に使う）。未指定ならレシピ登録時の人数 */
  servings?: number
  /**
   * 開いた状態で描き始めるか（2026-08-27 便LU）。設定の「Pro版について見る」から
   * この画面へ帰ってきたときに、離れる前と同じ「開いている」姿で迎えるために使う
   * （オーナー原文「折りたたみが閉じてしまう…のもやめて」）。
   */
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // お試しで8項目を開いている状態（2026-08-08 便DZ）。この画面の中だけの状態なので、
  // 別のレシピを開けばロック表示に戻る（RecipeDetailPage側でレシピごとに作り直している）
  const [trialActive, setTrialActive] = useState(false)
  const settings = useSettings()
  const proUnlocked = isNutritionUnlocked(isPro)
  const unlocked = proUnlocked || trialActive

  if (!proUnlocked && !NUTRITION_TEASER_ENABLED) return null

  const nutrition = computeRecipeNutrition(recipe)
  const per = nutrition.perServing
  // 表示中の人数(材料の人数変更に追従)。1人分の値そのものは人数を変えても動かないが、
  // 「何人分を1食に分けた値なのか」を要約行に常時出すために使う(2026-07-28 便BY/COST-03)
  const displayServings = servings != null && servings > 0 ? servings : nutrition.servings
  // 計算に含められた材料が1つも無ければ「0kcal」表示は誤解を招くため出さない
  const canShowSummary = nutrition.items.length > 0
  /**
   * 「1食」に分けて食べる品ではない（だしのとり方など・2026-08-25 便KS・④）。
   *
   * オーナー原文「１食あたり７０円とあるが、出汁だけで１食とは言わない」。
   * 引っかかっているのは金額ではなく**「1食」という数え方そのもの**なので、
   * 金額（detail.priceWholeBatch）と同じ印で、栄養の言い方と数値も切り替える。
   * 出す値は「表示している1人分 × 表示している人数」＝でき上がり全体ぶん
   * （数値の表の「全量」と同じ作り方。画面の数字どうしが必ず噛み合う）。
   */
  const wholeBatch = recipe.wholeBatch === true
  const summaryScale = wholeBatch ? displayServings : 1
  // 人/個の名札の出し分け（2026-09-01 便MW・オーナー裁定★2）。数値は今までと同じ perServing で、
  // 個で数える品は言い方だけ「1個あたり」「1個分」になる。出し分けは logic/servingsUnit.ts の1か所
  const unitText = servingsUnitText(recipe.servingsUnit)
  // 折りたたんだ1行に出すのは無料で見える2値＝エネルギーと野菜量（2026-08-02 オーナー指示）。
  // 線引きB'（無料＝エネルギー＋野菜量）と一致させ、展開しないと野菜量が分からない状態をなくす。
  // 塩分はPro側の8項目表にあるのでここには出さない
  const summaryText = canShowSummary
    ? [
        `${(roundNutrient('kcal', per.kcal) * summaryScale).toLocaleString()}${ja.nutrition.kcalUnit}`,
        ja.nutritionBalance.summaryVegetable.replace(
          '{n}',
          (roundVegetableGrams(vegetableGramsOf(nutrition)) * summaryScale).toLocaleString(),
        ),
      ].join(ja.nutritionBalance.summarySeparator)
    : ja.nutrition.unavailableSummary
  // 量が書いてあるのに計算できなかった材料(主材料の脱落)がある状態。
  // 折りたたんだ既定の1行でも分かるようにする(2026-07-28 便BY/NUT-01)
  const materialGap = hasMaterialGap(nutrition)
  const gapCount = nutrition.excluded.filter(
    (e) => e.reason === 'food' || e.reason === 'unit',
  ).length
  // 落ちたのが**塩分を持つ調味料**のときは、印のほうも専用のものに差し替える(2026-08-23 便KF)。
  // 印は1つだけにする(2つ並べると1行に収まらず、どちらも読まれなくなる)。
  // 塩分の側を優先するのは、少なく出るのがいちばん悪い出方だから。
  // 内訳(材料と理由の一覧)は折りたたみの中に今までどおり全部出る
  const saltGaps = saltSourceGaps(nutrition)
  const saltGap = saltGaps.length > 0

  /**
   * 8項目のお試し表示（1回だけ・2026-08-08 便DZ）。
   * 入口は「数値が出るレシピ」でだけ出す: 分量不明・成分データ無しで1品も計算できないレシピで
   * 使うと、数字が並ばない画面を見て1回きりのお試しを使い切ってしまう
   * （月間献立のお試しを「作った記録が5件たまるまで出さない」のと同じ考え方）。
   */
  const trialUnused = !isPro && canUseNutritionTrial(settings?.nutritionTrialUsed)
  const trialAvailable = trialUnused && canShowSummary
  const trialExhausted = !isPro && !trialUnused
  const startTrial = () => {
    if (!trialAvailable) return
    setTrialActive(true)
    // 押した人が必ず中身を見られるようにする（2026-08-21 便IN）。
    // 入口を折りたたみの外へ出したので、畳んだまま押されることがある。
    // 開かずに使ったことにすると、1回きりのお試しを何も見ないまま使い切ってしまう
    setExpanded(true)
    void updateSettings({ nutritionTrialUsed: true })
  }

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
            <Sparkles size={14} className="mr-1 inline-block shrink-0 text-accent-ink" aria-hidden />
            {ja.nutrition.title}
            {/* 2026-08-25 便KN: 「◯人分で作るときの1食あたり」→「1食あたり」。
                人数分はレシピ詳細の人数ステッパーに出ている。
                2026-08-25 便KS・④: でき上がりを何回かに分けて使う品は「1食あたり」で
                割っても意味を成さないので、印（Recipe.wholeBatch）で言い方を変える */}
            {wholeBatch ? ja.nutrition.summaryLabelWholeBatch : unitText.nutritionSummaryLabel}
            {summaryText}
            {canShowSummary && (saltGap || materialGap) && (
              <span
                className="ml-1 whitespace-nowrap font-bold text-warning"
                data-testid={saltGap ? 'nutrition-salt-gap-badge' : 'nutrition-material-gap-badge'}
              >
                {saltGap
                  ? ja.nutrition.saltGapBadge.replace('{n}', String(saltGaps.length))
                  : ja.nutrition.materialGapBadge.replace('{n}', String(gapCount))}
              </span>
            )}
          </span>
          <ChevronIcon size={20} className="shrink-0 text-ink-muted" aria-hidden />
        </button>

        {/* 人数分が取り込み元から読み取れないまま保存された品（Recipe.servingsUnread・2026-09-01 便MU）。
            上の要約行の「1食あたり」は登録の人数分で割った値なので、その人数が仮なら
            数字もその倍率でずれうる。折りたたみを開かなくても読める位置（カードの中・要約の直下）に
            出す。文言は原価のそば（レシピ詳細の金額の下）と同じ1つだけを使う */}
        {recipe.servingsUnread === true && (
          <p
            data-testid="nutrition-servings-unread"
            className="px-[var(--space-md)] pb-[var(--space-md)] text-sm font-bold text-warning"
          >
            {unitText.servingsUnreadNote.replace('{n}', String(recipe.servings))}
          </p>
        )}

        {/* 8項目のお試しの入口（2026-08-08 便DZ）。
            2026-08-21 便IN: **折りたたみの外**へ出した。オーナーの原則
            「アプリ全体で、折りたたみを一切開かなくても、最低限一通りすべての機能を触れる
              （使いこなすために開く）ようにしたい」に、この入口だけが反していた
            （並行調理ナビ・月間献立のお試しは、どちらもロックの案内が畳まれずに出ている）。
            出るのは**まだ使っていない人だけ**なので、1回使えば二度と出ない
            ＝毎回の面積は増えない。無料/Proの線引きは1つも動かしていない
            （見られる中身も回数も便DZのまま。表示のゲート isNutritionUnlocked も触っていない）。
            押すと折りたたみも開く（startTrial）＝畳んだまま押しても中身が見られる */}
        {trialAvailable && (
          <div className="px-[var(--space-md)] pb-[var(--space-md)]">
            <button
              type="button"
              data-testid="nutrition-trial-button"
              onClick={startTrial}
              className="inline-flex items-center gap-1 rounded-md border border-accent bg-surface px-4 py-3 text-sm font-bold text-accent-ink shadow-sm"
            >
              {ja.nutrition.trialButton}
            </button>
          </div>
        )}

        <Collapse open={expanded}>
          <div className="border-t border-edge p-[var(--space-md)] pt-[var(--space-sm)]">
            {unlocked ? (
              <UnlockedBody
                nutrition={nutrition}
                displayServings={displayServings}
                wholeBatch={wholeBatch}
                servingsUnit={recipe.servingsUnit}
                trialActive={trialActive}
              />
            ) : (
              <LockedBody
                nutrition={nutrition}
                displayServings={displayServings}
                wholeBatch={wholeBatch}
                servingsUnit={recipe.servingsUnit}
                isPro={isPro}
                trialExhausted={trialExhausted}
              />
            )}
          </div>
        </Collapse>
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
      <p className="text-sm font-bold text-accent-ink">
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
const EXCLUDED_REASON_ORDER: ExcludedReason[] = ['food', 'unit', 'amount', 'prep', 'boil']
const EXCLUDED_REASON_LABEL: Record<ExcludedReason, string> = {
  food: ja.nutrition.excludedReasonFood,
  unit: ja.nutrition.excludedReasonUnit,
  amount: ja.nutrition.excludedReasonAmount,
  prep: ja.nutrition.excludedReasonPrep,
  boil: ja.nutrition.excludedReasonBoil,
}

/**
 * 計算に含めていない材料一覧（両状態で共通のブロック）。
 * 2026-07-28 便BY/NUT-02: 理由ごとにグループ分けし、保存されている分量テキストを併記する。
 * 「鶏むね肉＝単位を換算できない」と「秘伝のタレ＝成分データが無い」では直し方が正反対なので、
 * 一般文をまとめて出すのではなく材料ごとに理由が分かる形にする。
 * 併せて、除外は必ず「引く」側にしか働かない＝目安は下限側であることを1文で明示する。
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

/**
 * 塩分を持つ調味料が計算に入っていないときだけ出す、強いほうの注意（2026-08-23 便KF）。
 *
 * 置き場所を**数値の表の上**にしてあるのが、既存の MaterialGapNote（表の下）との違い。
 * 数字を読む前に「この塩分は実際より小さい」と分かる位置でなければ、
 * 「塩分0.0g」を見て安心したあとに注意書きを読むことになる。
 *
 * 落ちた調味料の名前も並べる（「何を足せば正しくなるか」が分かるようにする。
 * 折りたたみの中の一覧と重複するが、こちらは数値のすぐ上で読める1行として置く）。
 */
function SaltGapNote({ nutrition, showsSalt }: { nutrition: Nutrition; showsSalt: boolean }) {
  const gaps = saltSourceGaps(nutrition)
  if (gaps.length === 0) return null
  return (
    <div
      data-testid="nutrition-salt-gap-note"
      className="rounded-md border-2 border-warning p-[var(--space-sm)]"
    >
      <p className="text-sm font-bold text-warning">
        {ja.nutrition.saltGapNote}
        {showsSalt ? ja.nutrition.saltGapNoteSalt : ''}
      </p>
      <p className="mt-0.5 text-sm">
        {ja.nutrition.saltGapNames.replace(
          '{names}',
          gaps
            .map((e) => (e.amountText ? `${e.name}（${e.amountText}）` : e.name))
            .join(ja.nutrition.saltGapNameSeparator),
        )}
      </p>
    </div>
  )
}

/** 量が書いてあるのに計算できなかった材料があるときだけ出す注意（2026-07-28 便BY/NUT-01） */
function MaterialGapNote({ nutrition }: { nutrition: Nutrition }) {
  if (!hasMaterialGap(nutrition)) return null
  return <p className="text-sm font-bold text-warning">{ja.nutrition.materialGapNote}</p>
}

/** 野菜量の数え方（無料・Proとも野菜量を出すので両状態で共通。献立タブと同じ文言を使う） */
function VegetableCountNote() {
  return <p className="text-xs text-ink-muted">{ja.nutritionBalance.vegetableCountNote}</p>
}

/**
 * 数値の表（1人分を主役に、全量も併記）。無料＝エネルギー＋野菜量／
 * Pro＝8項目＋野菜量（2026-08-01 線引きB'）で同じ部品を使い、行数だけを変える。
 *
 * 全量は「表示している1人分の値 × 人数」で作る(2026-07-28 便BY/NUT-06)。
 * 従来は丸める前の値に人数を掛けてから個別に丸めていたため、画面の1人分を掛け算した結果と
 * 一致しなかった(塩分 4.1×4=16.4 なのに全量が16.6 と出る等)。暗算で検算する人には
 * 計算ミスに見えるので、表示どうしが必ず噛み合う側に揃える(どちらも同じ「目安」の精度内)。
 *
 * 野菜量は栄養8項目には含まれない別の指標なので、献立タブのパネルと同じく末尾に置く。
 */
function NutrientTable({
  nutrition,
  displayServings,
  wholeBatch,
  servingsUnit,
  unlocked,
}: {
  nutrition: Nutrition
  displayServings: number
  /**
   * 「1食」に分けて食べる品ではない（2026-08-25 便KS・④）。
   * 1人分の列は意味を成さないので**出さず**、でき上がり全体の1列だけにする
   * （数字そのものは今までの「全量」の列と同じ値。列の名前と本数だけが変わる）。
   */
  wholeBatch: boolean
  /** 人数分の数え方（2026-09-01 便MW）。個で数える品は見出しが「1個分」「全量（◯個分）」 */
  servingsUnit?: ServingsUnit
  unlocked: boolean
}) {
  const unitText = servingsUnitText(servingsUnit)
  const per = nutrition.perServing
  const scaleForDisplay = (key: keyof NutrientTotals): number =>
    roundNutrient(key, per[key]) * displayServings

  // 顔ぶれ(食物繊維・鉄・カルシウムを含む8項目)と名前・単位は logic/nutrition.ts に一本化する
  // (2026-08-19 便HU・⑯)。レシピ一覧の「栄養価で並び替え」も同じ顔ぶれを使うので、
  // ここに項目を足せば並び替えの選択肢にも同じ名前で出る(食い違ったら test-logic の⑯が赤くなる)。
  // 無料版で出すのはエネルギーだけ(2026-08-01 線引きB')
  const rows: { key: keyof NutrientTotals; label: string }[] = NUTRITION_DISPLAY_KEYS.filter(
    (key) => unlocked || key === 'kcal',
  ).map((key) => ({ key, label: nutritionLabelFor(key) }))

  const fmt = (key: keyof NutrientTotals, value: number): string => {
    const n = roundNutrient(key, value).toLocaleString()
    return `${n} ${nutritionUnitFor(key)}`
  }
  // 野菜量も「1人分 × 人数」で全量を作る（栄養8項目と同じ規則。表示どうしが噛み合うように）
  const vegetablePerServing = roundVegetableGrams(vegetableGramsOf(nutrition))

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {unlocked && (
          <span className="rounded-full border border-edge px-2 py-0.5 text-xs font-bold text-accent-ink">
            {ja.nutrition.proBadge}
          </span>
        )}
        <span className="rounded-full border border-edge px-2 py-0.5 text-xs text-ink-muted">
          {ja.nutrition.estimateBadge}
        </span>
      </div>

      {/* 栄養素の数値（1人分を主役に、全量も併記）。アクセントを薄く敷いて並行調理ナビと統一感を出す */}
      <div
        className="mt-[var(--space-sm)] rounded-md border border-edge p-[var(--space-sm)]"
        style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
      >
        <div
          className={`grid items-baseline gap-x-4 gap-y-2 ${
            wholeBatch ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_auto_auto]'
          }`}
        >
          <span aria-hidden />
          {wholeBatch ? (
            <span className="text-right text-xs font-bold text-accent-ink">
              {ja.nutrition.wholeBatchHeader}
            </span>
          ) : (
            <>
              {/* レシピ表用のキー（recipeServingHeader）。献立の栄養パネル用のキー
                  （nutrition.servingHeader）とは分けてある（司令部裁定3・巻き添え防止） */}
              <span className="text-right text-xs font-bold text-accent-ink">
                {unitText.nutritionServingHeader}
              </span>
              <span className="text-right text-xs text-ink-muted">
                {unitText.nutritionTotalHeader.replace('{n}', String(displayServings))}
              </span>
            </>
          )}
          {rows.map(({ key, label }) => (
            <div key={key} className="contents">
              {/* data-nutrient-label: 栄養価の表示に出ている項目の顔ぶれを、画面から読み取れるようにする
                  印（2026-08-19 便HU・⑯）。レシピ一覧の「栄養価で並び替え」の顔ぶれが
                  これと一致していることを scripts/e2e-smoke.mjs が確かめる */}
              <span className="text-sm" data-nutrient-label={key}>
                {label}
              </span>
              {wholeBatch ? (
                <span className="text-right text-base font-bold text-accent-ink tabular-nums">
                  {fmt(key, scaleForDisplay(key))}
                </span>
              ) : (
                <>
                  <span className="text-right text-base font-bold text-accent-ink tabular-nums">
                    {fmt(key, per[key])}
                  </span>
                  <span className="text-right text-sm text-ink-muted tabular-nums">
                    {fmt(key, scaleForDisplay(key))}
                  </span>
                </>
              )}
            </div>
          ))}
          {/* 野菜量は無料でも出す（2026-08-01 線引きB'・docs/60 §7 未決#3＝(a)） */}
          <div className="contents">
            <span className="text-sm">{ja.nutritionBalance.vegetableLabel}</span>
            {wholeBatch ? (
              <span className="text-right text-base font-bold text-accent-ink tabular-nums">
                {(vegetablePerServing * displayServings).toLocaleString()} {ja.nutrition.gramUnit}
              </span>
            ) : (
              <>
                <span className="text-right text-base font-bold text-accent-ink tabular-nums">
                  {vegetablePerServing.toLocaleString()} {ja.nutrition.gramUnit}
                </span>
                <span className="text-right text-sm text-ink-muted tabular-nums">
                  {(vegetablePerServing * displayServings).toLocaleString()} {ja.nutrition.gramUnit}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * 説明と注記・出典の折りたたみ（2026-08-28 便MC）。
 *
 * オーナー原文「栄養の説明と注記は折りたたみにしてコンパクトに。他に個所でやってる
 * 「注記と出典」と同じように」。**献立の栄養バランスパネル（NutritionBalancePanel）と
 * 同じ文言・同じ見た目・同じ開閉**にそろえる（新しい形を作らない）。
 * 開閉の言い方も `ja.nutritionBalance.notesToggle` をそのまま使う
 * ＝同じものを2つの名前で呼ばないため、ここで文言を作り直さない。
 *
 * **中へ入れるのは「どのレシピでも同じことを言う説明・注記・出典」だけ**。
 * このレシピ固有の話（⚠の注意・仮の量で計算した材料・計算に含めていない材料）は外に残す。
 * 理由は下の LockedBody / UnlockedBody のコメントに書いた。
 */
function NutritionNotes({ children }: { children: ReactNode }) {
  const [notesOpen, setNotesOpen] = useState(false)
  return (
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
      {/* 閉じているあいだ中身をDOMに置かない（Collapse の作法）。
          読み上げソフトとページ内検索に畳んだ中身が残らないようにするため */}
      <Collapse open={notesOpen}>
        <div className="mt-[var(--space-sm)] space-y-0.5 text-xs text-ink-muted">{children}</div>
      </Collapse>
    </div>
  )
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

/**
 * Pro側で増える6項目のティーザー（2026-07-28 便BY/PRO-01）。
 * MealPlanPageの月間献立ゲートと同じ「ぼかした本体＋Lockバッジ＋見出し＋説明＋リンク」の様式に揃える。
 * 従来はテキスト1行だけで、同じPro導線なのに画面ごとに表現が3種類あった。
 * ぼかす中身は数値ではなく項目名と値の位置を示すバーで、実データは出さない（サンプル表示）。
 *
 * 2026-07-30 便CL: 献立タブの栄養バランスパネル（NutritionBalancePanel）からも同じ部品を使う。
 * 鍵付き導線の表現を1つに保つため、同じ見た目を作り直さずここから流用する（PRO-01の作法）。
 *
 * 2026-08-01 線引きB': 食塩相当量が無料側からPro側へ移ったので、ぼかしのサンプルも7項目にする
 * （無料で見えるのはエネルギーと野菜量だけ＝ここに並ぶのがPro側で増える項目の全部になる）。
 */
export function ProNutrientTeaser({
  isPro,
  trialExhausted,
  detour,
  openPanels,
}: {
  isPro: boolean
  /**
   * 8項目を1回だけ開くお試しを、もう使い切っているか（2026-08-08 便DZ）。渡された場所にだけ出す。
   * レシピ詳細の栄養枠からは渡し、献立タブの栄養バランスパネルからは渡さない
   * （お試しは「1つのレシピの8項目を見る」体験なので、案内も栄養価の枠に置く）。
   *
   * 2026-08-21 便IN: **押すボタンはここから折りたたみの外へ移した**（畳んだままでも触れるように）。
   * ここに残すのは使い切ったあとの一言だけ＝入口が消えた理由が、開いた人には読める。
   */
  trialExhausted?: boolean
  /**
   * 「Pro版について見る」の行き先と、押した瞬間に居場所を覚える手当て（2026-08-27 便LU）。
   * 帰り方が画面ごとに違うので、**専用の覚え方を持つ画面（献立）だけ外から渡す**。
   * 渡さなければ下の既定（現在地＋縦位置＋折りたたみ）で帰る。
   */
  detour?: { to: string; onClick?: () => void }
  /** 既定の帰り方のときに「開いていた折りたたみ」として覚える名前（SCREEN_PANEL） */
  openPanels?: string[]
}) {
  // Pro案内から設定へ飛んだあと、いま見ている画面の**同じ場所**へ帰れるようにする
  // (2026-08-02 便DF → 2026-08-27 便LU で縦位置と折りたたみも覚えるようにした)。
  // この部品はレシピ詳細・献立の栄養バランスパネルの両方で使う
  const { linkTo, remember } = useSettingsDetour()
  const proLinkTo = detour?.to ?? linkTo('/settings?section=pro')
  const onProLinkClick = detour?.onClick ?? (() => remember(openPanels))
  const sampleLabels = [
    ja.nutrition.proteinLabel,
    ja.nutrition.fatLabel,
    ja.nutrition.carbLabel,
    ja.nutrition.fiberLabel,
    ja.nutrition.ironLabel,
    ja.nutrition.calciumLabel,
    ja.nutrition.saltLabel,
  ]
  return (
    <div className="relative overflow-hidden rounded-md border border-edge">
      {/* ぼかす対象のサンプル(実データは出さない)。案内文の高さで枠が決まるよう背面に敷く */}
      <div
        aria-hidden
        className="absolute inset-0 grid grid-cols-2 content-start gap-x-4 gap-y-2 p-[var(--space-sm)]"
        style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
      >
        {sampleLabels.map((label) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <span className="text-sm">{label}</span>
            <span className="h-3 w-10 rounded-sm bg-accent/40" />
          </div>
        ))}
      </div>
      <div className="relative flex flex-col items-center justify-center gap-1 bg-app/40 p-[var(--space-md)] text-center backdrop-blur-[2px]">
        <span className="inline-flex items-center gap-1 rounded-full border border-accent bg-surface px-3 py-1 text-sm font-bold text-accent-ink shadow-sm">
          <Lock size={14} aria-hidden />
          {ja.nutrition.lockedBadge}
        </span>
        <p className="mt-1 font-bold">{ja.nutrition.lockedTitle}</p>
        <p className="text-sm text-ink-muted">{ja.nutrition.proNutrientHighlight}</p>
        {/* 買う前に中身を確かめられる1回だけのお試し(2026-08-08 便DZ)。
            押すボタンは折りたたみの外にある(2026-08-21 便IN)。
            使い切ったあとの一言だけをここに置く(入口が消えて理由が分からなくなるのを避ける) */}
        {trialExhausted && (
          <p className="mt-1 text-xs text-ink-muted">{ja.nutrition.trialUsedNote}</p>
        )}
        {!isPro && (
          <Link
            to={proLinkTo}
            onClick={onProLinkClick}
            className="mt-1 inline-block text-sm font-bold text-accent-ink underline"
          >
            {ja.nutrition.gateLink}
          </Link>
        )}
      </div>
    </div>
  )
}

/** 状態1: 未解錠（無料版）。エネルギーと野菜量の表＋注記・出典・Pro案内・計算対象外を出す
 *  （2026-08-01 線引きB'。エネルギーは見出し行にも出るが、全量との対応と野菜量を同じ表で
 *   読めるようにするため、Pro側と同じ表の形で置く） */
function LockedBody({
  nutrition,
  displayServings,
  wholeBatch,
  servingsUnit,
  isPro,
  trialExhausted,
}: {
  nutrition: Nutrition
  displayServings: number
  /** 「1食」に分けて食べる品ではない（2026-08-25 便KS・④）。表を1列（でき上がり全体）にする */
  wholeBatch: boolean
  /** 人数分の数え方（2026-09-01 便MW）。個で数える品は表の見出しが「1個分」「全量（◯個分）」 */
  servingsUnit?: ServingsUnit
  isPro: boolean
  trialExhausted: boolean
}) {
  return (
    <div className="space-y-[var(--space-sm)]">
      {/* 塩分を持つ調味料が落ちているときは、数値より先に読める位置に注意を置く(便KF)。
          無料側は塩分相当量そのものが出ていないので、「小さく出ている」の1文は足さない */}
      <SaltGapNote nutrition={nutrition} showsSalt={false} />
      {/* 計算できた材料が1つも無いレシピは「0kcal」を出さない(見出し行と同じ判定) */}
      {nutrition.items.length > 0 && (
        <NutrientTable
          nutrition={nutrition}
          displayServings={displayServings}
          wholeBatch={wholeBatch}
          servingsUnit={servingsUnit}
          unlocked={false}
        />
      )}
      {/* Pro版で増える項目のティーザー(2026-07-28 便BY/PRO-01で blur+Lock 様式に統一)。
          詳しい提供時期の話(freeDescription系)より先に、まず「何が増えるか」を見せる */}
      {/* この行は「栄養価の概算」の折りたたみの中にしか出ないので、押した時点でその
          折りたたみは必ず開いている＝帰ってきたときも開いた姿で迎える（2026-08-27 便LU） */}
      <ProNutrientTeaser
        isPro={isPro}
        trialExhausted={trialExhausted}
        openPanels={[SCREEN_PANEL.nutrition]}
      />
      {/* ⚠の注意・材料の一覧は**折りたたみの外に残す**（2026-08-28 便MC）。
          ・⚠は「いま出ている数字が実際より小さい」という**数字の読み方そのもの**で、
            折りたたんだ1行の印（materialGapBadge / saltGapBadge）と対になっている。
            中へ入れると、印だけ出ていて理由が読めない状態になる
          ・材料の一覧は logic/nutrition.ts 冒頭の決めごと
            「計算できなかった材料は隠さず必ず表示に含めること」に当たる */}
      <MaterialGapNote nutrition={nutrition} />
      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />
      {/* どのレシピでも同じことを言う説明・注記・出典は折りたたみの中へ（オーナー指示） */}
      <NutritionNotes>
        <p>{ja.nutrition.estimateNote}</p>
        <VegetableCountNote />
        <SourceNote />
      </NutritionNotes>
      {/* Pro未解錠のユーザーには、これらの目安が買い切りのPro版で表示されること
          (設定のProタブから解錠できること)を伝える。isProの分岐は栄養フル版の公開フラグを
          落としたとき用の保険(通常は未解錠=非ProなのでfreeDescription側が出る) */}
      {/* ティーザー内に「Pro版について見る」リンクを置いたので、ここは説明だけにする
          (同じリンクを2つ並べない) */}
      <p className="text-sm text-ink-muted">
        {isPro ? ja.nutrition.freeDescriptionPro : ja.nutrition.freeDescription}
      </p>
    </div>
  )
}

/** 状態2: Pro解錠済み。8項目＋野菜量の実内訳（1人分・全量）＋計算対象外・注記・出典
 *  (2026-07-13 第2弾: 食物繊維・鉄・カルシウムを追加。オーナー承認・Fable設計。
 *   2026-08-01 線引きB': 表そのものは無料側と共用のNutrientTableに寄せ、野菜量の行を追加) */
function UnlockedBody({
  nutrition,
  displayServings,
  wholeBatch,
  servingsUnit,
  trialActive,
}: {
  nutrition: Nutrition
  displayServings: number
  /** 「1食」に分けて食べる品ではない（2026-08-25 便KS・④）。表を1列（でき上がり全体）にする */
  wholeBatch: boolean
  /** 人数分の数え方（2026-09-01 便MW）。個で数える品は表の見出しが「1個分」「全量（◯個分）」 */
  servingsUnit?: ServingsUnit
  /** お試しで開いている状態か（2026-08-08 便DZ）。1回だけの表示であることを画面上でも伝える */
  trialActive?: boolean
}) {
  return (
    <div className="space-y-[var(--space-sm)]">
      {trialActive && (
        <p
          data-testid="nutrition-trial-active"
          className="rounded-sm border border-accent px-3 py-2 text-sm font-bold text-accent-ink"
        >
          {ja.nutrition.trialActiveNote}
        </p>
      )}
      {/* 塩分相当量の数値を読む前に届く位置へ置く(便KF)。ここは8項目が実際に出ている状態なので、
          「表示している塩分相当量は実際より小さい」まで言い切る */}
      <SaltGapNote nutrition={nutrition} showsSalt />
      <NutrientTable
        nutrition={nutrition}
        displayServings={displayServings}
        wholeBatch={wholeBatch}
        servingsUnit={servingsUnit}
        unlocked
      />

      {/* ⚠の注意・材料の一覧は折りたたみの外に残す（理由は LockedBody 側のコメント） */}
      <MaterialGapNote nutrition={nutrition} />
      <AssumedBlock nutrition={nutrition} />
      <ExcludedBlock nutrition={nutrition} />

      {/* どのレシピでも同じことを言う説明・注記・出典は折りたたみの中へ（2026-08-28 便MC） */}
      <NutritionNotes>
        <p>{ja.nutrition.estimateNote}</p>
        {/* ビタミン非表示の理由(2026-07-13オーナー指示)。Pro解錠時のみ表示(無料側は栄養の内訳が
            見えていないので注記も不要) */}
        <p>{ja.nutrition.vitaminNote}</p>
        <VegetableCountNote />
        <SourceNote />
      </NutritionNotes>
    </div>
  )
}
