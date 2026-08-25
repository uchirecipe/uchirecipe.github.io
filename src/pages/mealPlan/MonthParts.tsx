/**
 * 献立タブ「月」まわりの部品（2026-08-25 便KZ）。
 *
 * MealPlanPage.tsx から**そのまま**切り出した（docs/74 第3手）。中身は1文字も変えていない
 * ＝見た目も動きも変わらない。変えたのは import の書き方と、末尾の export だけ。
 * 栄養の数字の書き方（formatNutrient）は栄養・食費の部品と同じものを読む
 * ＝カレンダーのマスと栄養カードで丸め方・単位がずれない。
 */
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
import { usePhotoUrl } from '../../components/usePhotoUrl'
import { nutritionUnitFor, roundNutrient, type NutrientTotals } from '../../logic/nutrition'
import type { DayIntake } from '../../logic/rangeSummary'
import type { MonthCellMode } from '../../db/types'
import { ja } from '../../i18n/ja'
import { formatNutrient } from './IntakeParts'

/**
 * 月タブの常設カード（食費・栄養）の見出し兼開閉ボタン（2026-08-07 便DU・オーナー指示
 * 「食費・栄養をそれぞれ折りたたみ可能に」）。
 *
 * 見出しは畳んでいても出したままにして、そこに何があるのかを畳んだ状態でも読めるようにする。
 * 「概算」バッジも見出しと一緒に常に見せる（数字を開く前に、これが概算だと分かるようにする）。
 */
/**
 * 月カード（食費・栄養）の見出し行。
 *
 * 2026-08-20 便IG・⑬（オーナー原文「◯月の食費・栄養の折りたたみで表示される数値は、
 * ◯月の食費（栄養）の横に表示して。縦長にしない。」）:
 * 畳んでいるときの数値（figure）を**この見出しの中**に置く。直す前は見出しの下に
 * 別の枠（名前を値の上に置く2段組み）で出していたため、畳んでいるのにカードが縦に伸びていた。
 *
 * 「縦長にしない」を守るための作り:
 *  ・数値は右端（ml-auto）に置き、縮まない（shrink-0）＝桁が増えても折り返さない
 *  ・見出しの文字だけが縮む（min-w-0 truncate）＝どんな桁数でも1行に収まる
 *  ・出すのは**数値だけ**で、行の名前（「全員分」「エネルギー」）は開いたときの表・パネルに任せる
 *    （390px幅では名前まで並べると1行に入らず、折り返して縦長に戻ってしまう）
 */
function MonthCardHeader({
  title,
  open,
  onToggle,
  figure,
  figureTestId,
}: {
  title: string
  open: boolean
  onToggle: () => void
  /** 畳んでいるときだけ見出しの横に出す数値（開いているときは表・パネルが出すので渡さない） */
  figure?: string
  figureTestId?: string
}) {
  return (
    <h2>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 text-left font-bold"
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-xs font-normal text-ink-muted">
          {ja.nutrition.estimateBadge}
        </span>
        {figure && (
          <span
            data-testid={figureTestId}
            className="ml-auto shrink-0 whitespace-nowrap text-sm text-accent-ink tabular-nums"
          >
            {figure}
          </span>
        )}
        <span className={`shrink-0 text-ink-muted ${figure ? '' : 'ml-auto'}`}>
          {open ? <ChevronUp size={20} aria-hidden /> : <ChevronDown size={20} aria-hidden />}
        </span>
      </button>
    </h2>
  )
}

/**
 * 月カレンダーの1日分のセル(2026-07-24 便BS・タスク4/5)。その日に「作った記録」があれば写真サムネを
 * セル全面に敷き(日記のように写真で振り返れる)、日付を左上の小バッジに出す。写真の無い記録は従来の
 * 「記録あり」チェックで表す。予定(献立あり)は showPlanDot が true の日(今日・未来日)だけ出し、
 * 2026-07-25 便BU・S-1(docs/59)で点から主菜名(無ければ件数)のプレビューへ強化した
 * (過去日の未達成予定はカレンダーからも消す=便BS・タスク2の方針。mealPlansデータは非破壊で残す)。
 * S-2(docs/59): 予定も記録も無い未来日(isEmptyFuture)は控えめな点線枠で「まだ決めていない日」を可視化する。
 * usePhotoUrlはループ内で直接呼べないため、親でBlobを解決してこのセル単位で1回だけ呼ぶ。
 *
 * 2026-07-28 便CA・タスク2(オーナー指示): mode で表示内容を切り替える。
 *  'photo'   = 既定。従来どおり写真＞献立プレビュー。
 *  'nutrition'/'cost' = その日に1人が食べる分のエネルギー／食費を数字で出す(stat)。
 * 数字モードでは写真を敷かない(小さい文字が写真に埋もれて読めないため・視認性優先)。
 * 数字の色で基準を見分けられるようにする: 実績(作った記録)=accent、予定(登録した献立)=控えめな文字色。
 *
 * 2026-07-29 便CB-1・docs/59 A-2: 日付メモのある日は右上に小さな点だけを出す(hasNote)。
 * 写真モードの主役は写真なので、文字は出さず点1つ＝写真の邪魔をしない大きさに留める。
 *
 * 2026-08-23 便JN: 3つの分岐（数字／写真あり／写真なし）のどれで描かれても
 * `data-testid="month-day-cell"` を必ず付ける。検査がマスを掴むのに Tailwind のクラス
 * （.grid-cols-7 や .border-accent）を頼っていたので、並べ方や色の当て方を変えるたびに
 * 掴めなくなっていた（掴めないと30秒待って実行が中断する＝CLAUDE.md 禁じ手④）。
 * どのモードでも同じ目印で掴める形にしておく。
 *
 * **マスの中身は週の1品カードには寄せない**（便JNの判断）。マスの実測は390pxで48px角・
 * 320pxで38px角しかなく、いま出している9pxの料理名で読めるのは**390pxで5文字・320pxで3文字**。
 * 週の1品カード（幅251px・15文字）と同じ「写真＋料理名」を同時に入れると、写真を24pxまで
 * 潰したうえで料理名が2文字になる。カレンダーは1か月を見渡す一覧なので、
 * 料理名を読む場所は日の窓のほうに置き、そこを週の曜日カードと同じ2モードにした。
 */
function MonthDayCell({
  date,
  dayNum,
  isToday,
  inRange,
  mode,
  nutrient,
  stat,
  showPlanDot,
  planPreview,
  isEmptyFuture,
  hasLog,
  hasNote,
  coverPhoto,
  onClick,
}: {
  /** YYYY-MM-DD。e2eからセルを一意に掴むための data-date にも使う */
  date: string
  dayNum: number
  isToday: boolean
  inRange: boolean
  /** セルに出す情報(便CA・タスク2)。既定は 'photo' */
  mode: MonthCellMode
  /** 'nutrition' のときにマスへ出す栄養の項目(2026-08-19 便HV・⑥。既定はエネルギー) */
  nutrient: keyof NutrientTotals
  /** 'nutrition'/'cost' のときに出す、その日の1人分の数字(無い日はundefined) */
  stat?: DayIntake
  showPlanDot: boolean
  /** S-1(docs/59): 今日・未来日の予定プレビュー（主菜名／無ければ「◯件」）。showPlanDotのときだけ出す */
  planPreview?: string
  /** S-2(docs/59): 予定も記録も無い未来日か（＝まだ献立を決めていない日。控えめな点線枠で可視化する） */
  isEmptyFuture: boolean
  hasLog: boolean
  /** A-2(docs/59): その日に日付メモがあるか（右上の小さな点で控えめに示す） */
  hasNote: boolean
  coverPhoto: Blob | undefined
  onClick: () => void
}) {
  const photoUrl = usePhotoUrl(coverPhoto)
  // 2026-08-22 便JE: 同じ形が並ぶカード＝角丸は --radius-card（rounded-card）
  const base =
    'relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-card border text-sm'
  // メモありの印(A-2)。どの表示モード・写真の有無に関わらず同じ位置(右上)に同じ大きさの点を出す。
  // 写真の上でも沈まないよう周りに細い縁を付ける。今日のセルだけは背景がアクセント色で塗り
  // つぶされている(点が同色で消える)ため、色を反転させる
  const noteMark = (onAccentFill = false) =>
    hasNote ? (
      <span
        aria-label={ja.mealPlan.monthDayHasNote}
        className={`absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full ring-1 ${
          onAccentFill ? 'bg-on-accent ring-accent' : 'bg-accent ring-app'
        }`}
      />
    ) : null

  // 栄養／食費モード: その日の1人分の数字を主役にする(写真は敷かない=視認性優先)
  if (mode !== 'photo') {
    // 7列のセルは375px幅で約46px。「498kcal」を1行に入れると途中で切れるので、
    // 数字の下に単位だけを小さく置く(2026-08-08 便EA・オーナー「なんの栄養価かわからない」)。
    // 項目名(エネルギー/たんぱく質…)は幅に入らないので、ボタンのすぐ下の凡例と
    // 読み上げ(aria-label)が言う。
    // 2026-08-19 便HV・⑥: 出す栄養の項目を選べるようにしたので、丸め方も単位も項目から引く
    // (栄養カードの formatNutrient / 並び替えの単位とまったく同じ1か所から取る)
    const cellText = stat
      ? mode === 'nutrition'
        ? roundNutrient(nutrient, stat.nutrition[nutrient]).toLocaleString()
        : stat.yen.toLocaleString()
      : null
    const cellUnit =
      mode === 'nutrition' ? nutritionUnitFor(nutrient) : ja.mealPlan.monthCellYenUnit
    const value = stat
      ? mode === 'nutrition'
        ? formatNutrient(nutrient, stat.nutrition[nutrient])
        : ja.mealPlan.monthCellYen.replace('{n}', stat.yen.toLocaleString())
      : null
    const ariaTemplate = !stat
      ? ja.mealPlan.monthDayStatAriaEmpty
      : stat.basis === 'actual'
        ? ja.mealPlan.monthDayStatAriaActual
        : ja.mealPlan.monthDayStatAriaPlan
    const tone = isToday
      ? 'border-accent bg-accent/20 text-ink'
      : inRange
        ? 'border-accent bg-accent/20 text-ink'
        : stat
          ? 'border-edge bg-surface text-ink'
          : 'border-dashed border-edge bg-surface text-ink-muted'
    // 2026-07-30 便CH/C3: 「作った記録あり」の印は表示モードに関わらず出す。
    // 写真モードだけに出していたため、食費/栄養に切り替えると印が消え、今日のように
    // 数字が予定側で計算される日は「記録が無かったこと」になって見えていた
    const ariaLabel = `${ariaTemplate.replace('{d}', String(dayNum)).replace('{v}', value ?? '')}${
      hasLog ? ` ${ja.mealPlan.monthDayStatAriaLogged}` : ''
    }`
    return (
      <button
        type="button"
        data-testid="month-day-cell"
        data-date={date}
        onClick={onClick}
        aria-label={ariaLabel}
        // baseのjustify-centerとぶつからないよう、数字セルはここで独立したクラス列を組む
        className={`relative flex aspect-square flex-col items-center justify-between overflow-hidden rounded-card border py-1 text-sm ${tone}`}
      >
        {isToday && (
          <span className="absolute inset-0 rounded-card ring-2 ring-inset ring-accent" aria-hidden />
        )}
        {/* 作った記録の印(便CH/C3)。メモの点と同じ「小さな印」の作法で、位置だけ左上に分ける */}
        {hasLog && (
          <span aria-hidden className="absolute left-0.5 top-0.5 text-accent-ink">
            <Check size={10} strokeWidth={3} aria-hidden />
          </span>
        )}
        <span
          aria-hidden
          className={`text-[10px] leading-none ${isToday ? 'font-bold text-accent-ink' : 'text-ink-muted'}`}
        >
          {dayNum}
        </span>
        {cellText && (
          <span
            aria-hidden
            className={`flex w-full flex-col items-center px-0.5 ${
              stat?.basis === 'actual' ? 'text-accent-ink' : 'text-ink-muted'
            }`}
          >
            <span className="w-full truncate text-center text-[10px] font-bold leading-tight tabular-nums">
              {cellText}
            </span>
            <span className="text-[8px] leading-none">{cellUnit}</span>
          </span>
        )}
        {noteMark()}
      </button>
    )
  }

  if (photoUrl) {
    // 写真あり: 全面に写真、日付は左上の小バッジ(スクリムで可読性確保)。「記録あり」のaria-labelは維持する
    return (
      <button
        type="button"
        data-testid="month-day-cell"
        data-date={date}
        onClick={onClick}
        aria-label={ja.mealPlan.monthDayHasLog}
        className={`${base} ${isToday ? 'border-accent' : 'border-edge'}`}
      >
        <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        {inRange && <span className="absolute inset-0 bg-accent/40" aria-hidden />}
        {isToday && (
          <span className="absolute inset-0 rounded-card ring-2 ring-inset ring-accent" aria-hidden />
        )}
        <span
          className={`absolute left-0.5 top-0.5 rounded-sm px-1 text-xs font-bold ${
            isToday ? 'bg-accent text-on-accent' : 'bg-black/55 text-white'
          }`}
        >
          {dayNum}
        </span>
        {noteMark()}
      </button>
    )
  }
  const tone = isToday
    ? 'border-accent bg-accent text-on-accent font-bold'
    : inRange
      ? 'border-accent bg-accent/20 text-ink'
      : isEmptyFuture
        ? // S-2(docs/59): 予定も記録も無い未来日は「まだ決めていない日」が一目で分かる控えめな点線枠＋
          // 淡い数字にする（押し付けがましいバッジは付けない＝規約H）
          'border-dashed border-edge bg-surface text-ink-muted'
        : 'border-edge bg-surface text-ink'
  return (
    <button
      type="button"
      data-testid="month-day-cell"
      data-date={date}
      onClick={onClick}
      className={`${base} ${tone}`}
    >
      <span className="leading-none">{dayNum}</span>
      {/* S-1(docs/59): 今日・未来日の予定は、点ではなく主菜名（無ければ「◯件」）でプレビューし、
          先の予定を月表で読めるようにする（過去日の写真日記＝上の分岐には出さない）。
          従来の点の「献立あり」ラベルはこのプレビューへ引き継ぐ */}
      {showPlanDot && planPreview && (
        <span
          aria-label={ja.mealPlan.monthDayHasPlan}
          className={`mt-0.5 w-full truncate px-0.5 text-center text-[9px] leading-tight ${
            isToday ? 'text-on-accent' : 'text-ink-muted'
          }`}
        >
          {planPreview}
        </span>
      )}
      {hasLog && (
        <span
          aria-label={ja.mealPlan.monthDayHasLog}
          className={`mt-0.5 ${isToday ? 'text-on-accent' : 'text-accent-ink'}`}
        >
          <Check size={10} strokeWidth={3} aria-hidden />
        </span>
      )}
      {noteMark(isToday)}
    </button>
  )
}

export { MonthCardHeader, MonthDayCell }
