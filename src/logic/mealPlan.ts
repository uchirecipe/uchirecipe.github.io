import { hasNgIngredient } from './ng'
import { cookedWithinDays } from './cooked'
import { currentSeason } from './season'
import { pickIconKey } from './icon'
import { guessDishType } from './dishTypeGuess'
import { pickMainIngredients } from './mainIngredients'
import {
  AUTO_FILL_ROLES,
  MEAL_ROLES,
  type AutoFillRole,
  type DishType,
  type IconKey,
  type MealPlanEntry,
  type MealRole,
  type MealSlot,
  type Recipe,
  type Season,
} from '../db/types'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const

/* ============================================================
   献立のロック（2026-08-08 便DX・オーナー指示）
   鍵の掛かった食事は「自動でまとめて動かす操作」の対象から外れる:
     まとめて献立を入力（空き枠だけ／レシピを総入れ替えの両方）・テンプレートを適用・
     先週の献立をコピー・まとめて空にする・献立をまとめて提案（月）
   手での追加・差し替え・削除は鍵が掛かっていても自由（鍵は自動入力から守るためのもの）。
   保存の粒度は「日付×食事」の1階層だけ（db/types.ts MealPlanLock 参照）。
   画面の「日ごと」は、その日の朝食・昼食・夕食3件をまとめて掛け外しする操作として表す。
   ============================================================ */

/** ロックの記録キー（'YYYY-MM-DD|slot'）。DBの主キーであり、画面・計画の照合キーでもある */
export function mealLockKey(date: string, slot: MealSlot): string {
  return `${date}|${slot}`
}

/** その日その食事に鍵が掛かっているか */
export function isMealSlotLocked(
  lockedKeys: ReadonlySet<string>,
  date: string,
  slot: MealSlot,
): boolean {
  return lockedKeys.has(mealLockKey(date, slot))
}

/**
 * 鍵が掛かっている食事で止める「手での操作」の種類（2026-08-08 便EA・オーナー指示
 * 「ロックしたら、手動削除もできなくして」）。
 *
 * 便DX（2026-08-08）の鍵は自動でまとめて動かす操作だけを止めていたが、手で削除・差し替え
 * できたままだったので「ロックした」と言えなかった。ここに並べた操作は鍵が掛かっているあいだ
 * すべて止める＝鍵を外せば従来どおり全部できる（鍵は掛け外しが自由な可逆の操作）。
 */
export const MEAL_SLOT_EDITS = ['add', 'replace', 'remove', 'servings', 'suggest'] as const
export type MealSlotEdit = (typeof MEAL_SLOT_EDITS)[number]

/**
 * その食事に対する手での操作が、鍵で止まるか。
 * 止まる操作は MEAL_SLOT_EDITS のすべて（追加・差し替え・削除・食数変更・行のサイコロ）。
 */
export function isMealEditBlocked(
  lockedKeys: ReadonlySet<string>,
  date: string,
  slot: MealSlot,
  _edit: MealSlotEdit,
): boolean {
  return isMealSlotLocked(lockedKeys, date, slot)
}

/**
 * その日が「日ごとのロック」状態か＝朝食・昼食・夕食の3つとも鍵が掛かっているか。
 * 表示している食事だけでは数えない（画面に出していない食事の鍵が外れたまま
 * 「この日はロック済み」と見せると、表示を増やした瞬間に嘘になるため）。
 */
export function isDayMealLocked(lockedKeys: ReadonlySet<string>, date: string): boolean {
  return MEAL_SLOTS.every((slot) => isMealSlotLocked(lockedKeys, date, slot))
}

/** ロックの掛け外しの計画（呼び出し側はこの通りにDBへ書く。空配列なら何もしない） */
export interface MealLockToggle {
  /** これから鍵を掛ける食事 */
  lock: { date: string; slot: MealSlot }[]
  /** これから鍵を外す食事 */
  unlock: { date: string; slot: MealSlot }[]
}

/**
 * 日付の横の鍵ボタンの計画（日ごとの掛け外し）。
 * その日が3食とも鍵なら全部外し、そうでなければ掛かっていない食事に掛ける
 * （＝押すたびに「その日ぜんぶ施錠」⇄「その日ぜんぶ解錠」を行き来する）。
 */
export function planDayLockToggle(
  lockedKeys: ReadonlySet<string>,
  date: string,
): MealLockToggle {
  if (isDayMealLocked(lockedKeys, date)) {
    return { lock: [], unlock: MEAL_SLOTS.map((slot) => ({ date, slot })) }
  }
  return {
    lock: MEAL_SLOTS.filter((slot) => !isMealSlotLocked(lockedKeys, date, slot)).map((slot) => ({
      date,
      slot,
    })),
    unlock: [],
  }
}

/** 食事カードの鍵ボタンの計画（時間帯ごとの掛け外し）。掛かっていれば外す・無ければ掛ける */
export function planSlotLockToggle(
  lockedKeys: ReadonlySet<string>,
  date: string,
  slot: MealSlot,
): MealLockToggle {
  return isMealSlotLocked(lockedKeys, date, slot)
    ? { lock: [], unlock: [{ date, slot }] }
    : { lock: [{ date, slot }], unlock: [] }
}

/**
 * 「すべてロック」ボタンの計画（表示中の7日ぶん）。
 * 7日とも3食に鍵が掛かっていれば全部外し（＝「すべて解除」）、1つでも外れていれば全部掛ける。
 * 解除のときは、日ごと・時間帯ごとのどちらで掛けた鍵も残さず外す
 * （ボタンが「すべて解除」と言っている以上、押した後に鍵が残っていてはいけない）。
 */
export function planAllLockToggle(
  lockedKeys: ReadonlySet<string>,
  dates: string[],
): MealLockToggle {
  const allLocked = dates.length > 0 && dates.every((date) => isDayMealLocked(lockedKeys, date))
  const pairs = dates.flatMap((date) => MEAL_SLOTS.map((slot) => ({ date, slot })))
  if (allLocked) return { lock: [], unlock: pairs }
  return {
    lock: pairs.filter(({ date, slot }) => !isMealSlotLocked(lockedKeys, date, slot)),
    unlock: [],
  }
}

/**
 * 食事帯を必ず 朝食→昼食→夕食 の順に並べ直す（2026-07-29 便CD/MP-10）。
 * 「表示する食事帯」は押した順に配列へ足されるだけだったため、あとから朝食・昼食を
 * 足すと各日のカードが「夕食→朝食→昼食」の順で並び、設定に保存されて直せなかった。
 * 保存時と読み出し時の両方でこの関数を通し、既存の設定値もその場で正しい順に見せる。
 */
export function sortMealSlots(slots: MealSlot[]): MealSlot[] {
  return [...slots].sort((a, b) => MEAL_SLOTS.indexOf(a) - MEAL_SLOTS.indexOf(b))
}

/**
 * 自動提案のジャンル指定（和食/洋食/中華）。starters.ts/sets配下の実データで
 * 実際に使われているタグのみを採用する（2026-07-13献立の主菜+副菜構成対応）
 */
export const MEAL_GENRES = ['和食', '洋食', '中華'] as const
export type MealGenre = (typeof MEAL_GENRES)[number]

/**
 * 「調理時間◯分以内を優先」で選べる分数（2026-08-19 便HT・オーナー指示
 * 「調理時間15分いないを優先は、時間だけプルダウンで変更できるようにしたい」）。
 *
 * 並びと値は「今日なに作る？」の「◯分以内」（components/TodaySuggestPanel の
 * QUICK_MINUTES_OPTIONS）とそろえてある＝同じ「調理時間で絞る」を、画面ごとに
 * 違う分数で選ばせない。
 */
export const PLAN_QUICK_MINUTES_OPTIONS = [10, 15, 20, 30] as const

/**
 * 「過去の献立をコピー」で、どこまでさかのぼれるか（2026-08-21 便IO）。
 *
 * 2026-08-20 便II・⑤の第1段階は「1〜4週間前」の固定のプルダウンだったが、
 * オーナー原文「先週に限らず、ユーザーが選んだ７日間を指定（献立一覧で表示して、今表示している
 * ７日間の献立を今週に反映、と言った感じ？献立の中身も確認できるし。）」を受けて、
 * **中身を見ながら週を送って選ぶ画面**（pages/MealPlanCopyWeekPage.tsx）に置き換えた。
 * さかのぼれる先は数で決め打ちせず、**献立のデータがある一番古い日**で決める:
 *  ・献立の行は日付で消したりしない（db/mealPlan.ts に期間での掃除は無い）ので、
 *    アプリを使い始めた週まで届く＝「去年の同じ時期」も選べる
 *  ・データより前の週へは送れない＝送っても必ず空の週しか出ない道を作らない
 *
 * @param targetStart 入れ先の週の初日（YYYY-MM-DD）
 * @param earliestPlanDate 献立が入っている一番古い日（1件も無ければ undefined）
 * @returns 何週間前まで見られるか（最低でも1＝1週間前は必ず見られる）
 */
export function maxCopySourceWeeksBack(targetStart: string, earliestPlanDate?: string): number {
  if (!earliestPlanDate || earliestPlanDate >= targetStart) return 1
  // 夏時間のある地域で1時間ずれても日数を取り違えないよう、丸めてから日数にする
  const days = Math.round(
    (new Date(`${targetStart}T00:00:00`).getTime() -
      new Date(`${earliestPlanDate}T00:00:00`).getTime()) /
      86400000,
  )
  return Math.max(1, Math.ceil(days / 7))
}

/** 「過去の献立をコピー」の画面が並べる、その週の1日ぶんの中身 */
export interface CopySourceDay {
  date: string
  /** その日に入っている食事（表示している食事だけ・献立の無い食事は並べない） */
  slots: { slot: MealSlot; recipeIds: number[] }[]
}

/**
 * 選んだ週の中身を、画面に並べる形へまとめる（2026-08-21 便IO）。
 *
 * 守ること:
 * - **dates に含まれない日の献立は捨てる**。週を送るたびに範囲で引き直すので、取得範囲の
 *   重なりで別の週の献立が混ざると「見えているもの」と「入るもの」が食い違う
 * - **表示していない食事は並べない**。その食事には入らない（planCopyLastWeek が visibleSlots で
 *   絞る）ので、入らないものを見せない
 * - 並びは 日付 → 食事（MEAL_SLOTS の順）→ 受け取った行の順。行の順を変えないのは、
 *   planCopyLastWeek が写す順と1対1にそろえるため＝**見えている中身がそのまま入る**
 * - 献立の無い日も空のまま残す（7日ぶんの日付が抜けると、どの日が空なのかが読めない）
 */
export function copySourceWeekView(
  entries: Pick<MealPlanEntry, 'date' | 'slot' | 'recipeId'>[],
  dates: string[],
  visibleSlots: MealSlot[],
): CopySourceDay[] {
  const byKey = new Map<string, number[]>()
  const target = new Set(dates)
  for (const e of entries) {
    if (!target.has(e.date)) continue
    if (!visibleSlots.includes(e.slot)) continue
    const key = `${e.date}|${e.slot}`
    const list = byKey.get(key)
    if (list) list.push(e.recipeId)
    else byKey.set(key, [e.recipeId])
  }
  const slotOrder = MEAL_SLOTS.filter((slot) => visibleSlots.includes(slot))
  return dates.map((date) => ({
    date,
    slots: slotOrder
      .map((slot) => ({ slot, recipeIds: byKey.get(`${date}|${slot}`) ?? [] }))
      .filter((s) => s.recipeIds.length > 0),
  }))
}

/**
 * 分数を指定しなかったときの「◯分以内」（2026-08-19 便HT）。
 * 15分は便DE-7でオーナーが決めた値で、そのまま既定にしている
 * ＝分数を選べるようにしても、これまで使っていた人の結果は変わらない。
 */
export const DEFAULT_PLAN_QUICK_MINUTES = 15

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 引数の日付を含む週（月曜始まり・7日分）をYYYY-MM-DDの配列で返す */
export function weekDates(reference: Date): string[] {
  const day = reference.getDay() // 0=日 1=月 ... 6=土
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(reference)
  monday.setDate(reference.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return toDateString(d)
  })
}

/**
 * YYYY-MM-DD の曜日を「月曜始まりのインデックス」(0=月, 1=火 … 6=日)で返す
 * （2026-07-29 便CD/MP-02）。`ja.mealPlan.dow` が月曜始まりの配列なので、曜日ラベルは
 * 必ずこの関数で日付から引くこと。以前は7日カードの並び順(配列インデックス)で曜日を
 * 引いていたため、「今日から7日間」表示では今日が月曜の日以外は全行の曜日が嘘になっていた。
 */
export function dowIndex(dateStr: string): number {
  return (new Date(`${dateStr}T00:00:00`).getDay() + 6) % 7
}

/** YYYY-MM-DD を weeks 週分だけ前後にずらす */
export function shiftWeek(dateStr: string, weeks: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + weeks * 7)
  return toDateString(d)
}

/**
 * YYYY-MM-DD を days 日分だけ前後にずらす（2026-07-16 便W-⑤: 「昨日」の日付算出、
 * ランダム週献立の過去日判定に使う）
 */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`)
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

/**
 * 対象日が今日より前(過去日)か。YYYY-MM-DD文字列同士は辞書式比較=日付比較として成立する
 * （2026-07-16 便W-⑤a・オーナー指示: ランダム週献立の「まとめて献立」「サイコロ」は
 * 過去日の枠を対象外にする＝上書きも新規埋めもしない）
 */
export function isPastDate(date: string, today: string): boolean {
  return date < today
}

/**
 * 週タブの曜日カードを、開いた時点でどれだけ畳んでおくか（2026-08-19 便ID・オーナー原文
 * 「デフォルト表示は、過去の日付は折りたたみ（入力があれば☑️マーク）、献立が空欄の未来の
 *  日付も折りたたみ、献立ありの未来の日付は開いて表示にしたい。」）。
 *
 * 決め方は3つだけ:
 *  ① 過ぎた日 → 畳む（予定は表示しない日なので、開いても記録とメモしか無い）
 *  ② 今日 → 必ず開く。オーナーの3つの規則は「過去」と「未来」しか言っておらず、今日はどちらでもない。
 *     今日のカードは太い枠と「今日」の印を付けて画面の主役に置いているので、
 *     献立がまだ空でも畳まない（いちばん触る日を1タップ遠ざけない）
 *  ③ 今日より先 → 献立が入っていれば開く／空なら畳む
 *
 * **曜日にも月替わりにも依存しない**: 判定は「文字列の日付の大小」だけで、
 * 週の始まりが月曜か今日かも、月をまたぐかも見ていない（isPastDate と同じ比べ方）。
 * 呼び出し側が持っている「今日」をそのまま渡す形にして、この関数の中で日付を作らない
 * （テストが実行日に左右されないようにするため）。
 *
 * 返すのは「畳む日」の一覧。人が触って開け閉めしたぶんは呼び出し側が別に覚えていて、
 * そちらを優先する＝この既定は「まだ触っていない日」にだけ効く。
 */
export function planDefaultFoldedDates(options: {
  /** 表示している7日（YYYY-MM-DD） */
  dates: string[]
  /** YYYY-MM-DD（今日） */
  today: string
  /** 献立が1品以上入っている日（表示している食事のぶんだけ数えたもの） */
  datesWithPlan: ReadonlySet<string>
}): string[] {
  const { dates, today, datesWithPlan } = options
  return dates.filter((date) => {
    if (isPastDate(date, today)) return true
    if (date === today) return false
    return !datesWithPlan.has(date)
  })
}

/**
 * 週タブの操作3節（表示のしかた／献立を提案／過去の献立・テンプレートから入れる）を、
 * 画面を開いた時点でどれだけ開いておくか（2026-08-22 便IV・オーナー原文
 * 「でふぉるとで設定３種は、折りたたんだ表示にして」）。
 *
 * 2026-08-09 便EN → 2026-08-19 便IF・⑤⑥ で「献立を提案」だけ既定で開いていた。
 * オーナーが上の原文で3つとも畳むほうへ訂正したので、既定を1か所にまとめて持つ
 * （画面の中に散らばった真偽値ではなく、名前の付いた値として置く＝見張れる形にする）。
 *
 * **畳んでも「まとめて献立を入力」は見出しの横に出したまま**にしてある。
 * オーナーが同じ書き溜めで「折りたたみの状態でも最低限使えるように、というのは、
 * まとめてやテンプレートのような初心者が使わないような機能はしまっておく、
 * という意味合いでした。」と言っているとおり、しまうのは
 * 「空にする」「テンプレート」の側で、毎回押すものはしまわない。
 */
export const WEEK_GROUP_DEFAULT_OPEN = {
  display: false,
  auto: false,
  template: false,
} as const

/**
 * 週タブの「1日ずつの編集モード」の切り替え（2026-08-22 便IV・オーナー原文
 * 「1日分にそれぞれ編集モード切り替えボタン作って、ランダムと削除、選んだレシピの追加や
 *  書き換えができるようにする。」）。
 *
 * 編集モードに入れるのは**一度に1日だけ**（他の日は通常表示のまま）。
 *  ・同じ日をもう一度押す → 通常表示へ戻る
 *  ・別の日を押す ……… そちらへ移り、前の日は通常表示へ戻る
 * 覚えるのは日付そのものなので、週を送れば（その週にその日付が無いので）自動で通常表示に戻る。
 */
export function planToggleDayEdit(current: string | null, date: string): string | null {
  return current === date ? null : date
}

/**
 * 週タブの通常表示に並べる1品（2026-08-22 便IV）。
 *
 * オーナー原文: 「週献立は、通常表示はレシピカード（レシピ名と画像のみ）のみ
 *   （タップでレシピ詳細画面につながる）。」
 *
 * 入っている品だけを、役割（主菜→副菜→汁物→その他）の順に並べて返す。
 * **空き枠は返さない**＝通常表示は「決まっているものを読む」画面で、
 * 空きを埋める操作は編集モードが受け持つ。
 * 役割で並べ替えるのは、編集モードと通常表示で品の並びが入れ替わらないようにするため。
 */
export function planViewRows<T extends { role?: MealRole }>(entries: readonly T[]): T[] {
  return MEAL_ROLES.flatMap((role) => entries.filter((e) => (e.role ?? 'main') === role))
}

/**
 * 候補から「昨日の週プランに入っていたレシピ」を除外する（2026-07-16 便W-⑤b・
 * 直近の繰り返し防止）。除外した結果0件になる場合は除外前のpoolをそのまま返す
 * （オーナー指示: 空振りより重複のほうがマシ）。yesterdayRecipeIdsが空なら素通し
 */
export function excludeYesterdayPlanRecipes<T extends { id?: number }>(
  pool: T[],
  yesterdayRecipeIds: number[],
): T[] {
  if (yesterdayRecipeIds.length === 0) return pool
  const filtered = pool.filter((r) => r.id == null || !yesterdayRecipeIds.includes(r.id))
  return filtered.length > 0 ? filtered : pool
}

/** 引数の日付を含む月の全日付（1日〜月末）をYYYY-MM-DDの配列で返す */
export function monthDates(reference: Date): string[] {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: lastDay }, (_, i) => toDateString(new Date(year, month, i + 1)))
}

/** YYYY-MM-DD を months ヶ月分だけ前後にずらす（同じ日にちが無い月は月末に丸める） */
export function shiftMonth(dateStr: string, months: number): string {
  const original = new Date(`${dateStr}T00:00:00`)
  const day = original.getDate()
  const shifted = new Date(original.getFullYear(), original.getMonth() + months, 1)
  const lastDay = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate()
  shifted.setDate(Math.min(day, lastDay))
  return toDateString(shifted)
}

/** 引数の日付を含む月の1日が、月曜始まりのカレンダーで何列目か（先頭の空白セル数） */
export function monthLeadingBlanks(reference: Date): number {
  const firstDay = new Date(reference.getFullYear(), reference.getMonth(), 1).getDay() // 0=日 1=月...
  return firstDay === 0 ? 6 : firstDay - 1
}

/**
 * 2つの日付(YYYY-MM-DD)を開始<=終了の順に並べ替える(2026-07-17 便AB・docs/35 §5「期間の食費」:
 * 「終了日<開始日は自動で入れ替え」用)。YYYY-MM-DD文字列同士は辞書式比較=日付比較として成立する
 * （isPastDateと同じ前提）
 */
export function normalizeDateRange(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

/**
 * 開始日〜終了日(両端を含む)の日数。期間の食費(便AB)の「日数」表示、および
 * 「1日あたり平均」の割り算に使う
 */
export function rangeDayCount(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00`).getTime()
  const endMs = new Date(`${end}T00:00:00`).getTime()
  return Math.round((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1
}

export interface SuggestOptions {
  quickOnly: boolean
  /**
   * quickOnly のときの上限（分・任意・2026-08-19 便HT）。
   * 渡さなければ DEFAULT_PLAN_QUICK_MINUTES（15分）＝この項目が無かった頃と同じ結果になる。
   */
  quickMinutes?: number
  excludeNg: boolean
  ngIngredients: string[]
  /** この週で既に使っているレシピID（同じ主菜が続かないように避けたい） */
  usedRecipeIds: number[]
  /** どの食事帯の枠か。朝から鍋が出る、のようなミスマッチを避けるために使う */
  slot: MealSlot
  /** 今の季節（省略時は現在日時から判定）。季節指定がall以外で一致しないレシピは提案しない */
  season?: Exclude<Season, 'all'>
  /**
   * 主菜/副菜どちらの枠への提案か（任意・2026-07-13献立の主菜+副菜構成対応）。
   * 省略時は従来どおり「夕食・昼食枠は主菜になりうるレシピを優先」の後方互換ロジックを使う
   */
  role?: MealRole
  /**
   * ジャンル（和食/洋食/中華）の優先指定（任意）。一致するレシピを優先するが、
   * 無ければ他ジャンルも許可する（絞り込みすぎて提案0件にしないため）
   */
  genre?: MealGenre
  /**
   * この役割で優先したいdishType（任意・2026-07-23 便BH-2）。副菜スロットを純粋な副菜
   * （dishType:'side'）に寄せるために使う。一致0件なら緩和する（汁物しか無い日は汁物を
   * 副菜として許す）＝提案0件にはしない現行の安全設計を保つ。
   */
  preferDishType?: DishType
  /**
   * 主菜のたんぱく源（肉/魚/卵/豆腐）の週内分散用（任意・2026-07-23 便BH-2・docs/56 §3-6）。
   * ここに挙げたソースの主菜を優先する。fillWeekが「今週まだ少ないソース」を渡すことで、
   * 肉→肉→肉と連続で偏るのを防ぐ。該当0件なら緩和する（0件回避優先）。
   */
  preferProteinSources?: ProteinSource[]
  /**
   * 同じ食事の中で重ねたくない特徴キー（任意・2026-07-29 便CD/MP-04・dishAvoidKeys の戻り値）。
   * 主菜が決まったあと、その主菜のたんぱく源・食感キーを渡すことで、同じ特徴を持つ副菜を
   * 後回しにする（「しらたきのチャプチェ風＋春雨サラダ」「えび主菜＋ツナ副菜」の回避）。
   * 一致しない候補が0件なら緩和する＝0件回避を優先する既存の段階的緩和と同じ作法。
   */
  avoidKeys?: string[]
  /**
   * 候補から必ず外すレシピID（任意・2026-07-29 便CD/MP-09・ハード除外）。
   * 段階的緩和で復活する usedRecipeIds と違い、こちらは絶対に提案しない。
   * 「同じ枠の主菜と副菜に同じ料理が入る」（レシピが極端に少ないときに起きる）を防ぐ。
   */
  excludeRecipeIds?: number[]
  /**
   * 「昨日の週プランに入っていたレシピ」のID（任意・2026-07-16 便W-⑤b）。指定があれば
   * 候補から除外し、直近の繰り返し（一昨日食べたものが翌日また出る）を防ぐ。
   * 除外すると候補が尽きる場合は除外を解く（excludeYesterdayPlanRecipes参照）
   */
  yesterdayRecipeIds?: number[]
}

/**
 * 夕食・昼食の枠で「単品の主菜」になりにくいタグ。
 * これらを含むレシピは夕食・昼食枠の主菜提案では後回しにする
 * （8月の夕食にサラダ単品、のようなミスマッチを避ける。2026-07-09ペルソナ第2波）。
 * 「副菜」を表す専用タグはデータ上存在しない（starters.ts/sets配下を実際にgrepして確認済み）
 * ため、副菜の提案プールは汁物・サラダで代用する。**おやつは主菜からも副菜からも外す**
 * （夕食の副菜に杏仁豆腐が提案されるのを防ぐ。2026-07-13 Fable裁定）。
 * dishType未設定のレシピ（主にユーザー自作）のフォールバックとしてのみ使う
 * （dishType設定済みのレシピはisMainCandidate/isSideCandidateがこちらを見ない。
 * 2026-07-13 dishType導入：きんぴら等の「作り置き副菜」がタグでは判別できず
 * 主菜側に混ざっていた問題は、公式レシピへのdishType付与で解消した）
 */
const NON_MAIN_TAGS = ['汁物', 'サラダ', 'おやつ']
const SIDE_SUGGEST_TAGS = ['汁物', 'サラダ']

function isSideDishRecipe(r: Recipe): boolean {
  return r.tags.some((tag) => NON_MAIN_TAGS.includes(tag))
}

/** 副菜枠の提案対象にしてよいレシピ（おやつは含めない） */
function isSideSuggestable(r: Recipe): boolean {
  return r.tags.some((tag) => SIDE_SUGGEST_TAGS.includes(tag))
}

/** 副菜枠の提案対象になりうるdishType（デザートは含めない） */
const SIDE_DISH_TYPES: DishType[] = ['side', 'soup']

/**
 * デザート・おやつか（2026-07-29 便CD/MP-09）。「おやつは主菜からも副菜からも外す」
 * （2026-07-13 Fable裁定）は、役割の絞り込みが成立したときだけ効いていて、
 * 主菜候補/副菜候補が0件になったときの緩和段では効いていなかった。そのため
 * 「肉じゃが1品＋水ようかん1品」しか無い状態では水ようかんが副菜として提案されていた。
 * 緩和段でもこの判定でデザートだけは除き続ける（結果0件＝副菜なしのほうが正しい）。
 */
function isDessertRecipe(r: Recipe): boolean {
  if (r.dishType) return r.dishType === 'dessert'
  return r.tags.includes('おやつ')
}

/**
 * レシピが主菜候補か。dishTypeがあれば最優先（'main'のみ主菜）で使い、
 * 無ければ現行のタグヒューリスティックにフォールバックする（既存挙動を維持）
 */
function isMainCandidate(r: Recipe): boolean {
  if (r.dishType) return r.dishType === 'main'
  return !isSideDishRecipe(r)
}

/**
 * レシピが副菜枠の提案対象か。dishTypeがあれば最優先（'side'または'soup'）で使い、
 * 無ければ現行のタグヒューリスティックにフォールバックする（既存挙動を維持）。
 * dishType='dessert'はどちらの判定でもfalseになる（主菜からも副菜からも除外）
 */
function isSideCandidate(r: Recipe): boolean {
  if (r.dishType) return SIDE_DISH_TYPES.includes(r.dishType)
  return isSideSuggestable(r)
}

/** レシピが持つジャンルタグ（和食/洋食/中華のいずれか。無ければundefined） */
export function recipeGenre(r: Pick<Recipe, 'tags'>): MealGenre | undefined {
  return MEAL_GENRES.find((g) => r.tags.includes(g))
}

/**
 * レシピが主菜候補か（外部公開版・2026-07-23 便BH-2）。献立の「今日なに作る?」の
 * 「主菜から提案」など、献立エンジン外でも同じ主菜判定を使うために公開する。
 * 中身は献立エンジンの isMainCandidate と同一（dishType優先・未設定はタグフォールバック）。
 */
export function isMainDish(r: Recipe): boolean {
  return isMainCandidate(r)
}

/** 主菜のたんぱく源（週内分散の集計単位・2026-07-23 便BH-2・docs/56 §3-6） */
export type ProteinSource = '肉' | '魚' | '卵' | '豆腐' | 'その他'

/** アイコン種別 → たんぱく源。野菜・主食・汁物・菓子など該当しないものはundefined */
function iconToProtein(icon: IconKey): ProteinSource | undefined {
  switch (icon) {
    case 'fish':
      return '魚'
    case 'egg':
      return '卵'
    case 'tofu':
      return '豆腐'
    case 'chicken':
    case 'meat':
      return '肉'
    default:
      return undefined
  }
}

/**
 * 主菜のたんぱく源（肉/魚/卵/豆腐/その他）を判定する純関数（2026-07-23 便BH-2・docs/56 §3-6）。
 * 既存のアイコン自動判定（logic/icon.ts の pickIconKey）を流用する。丼・麺・パスタなどの
 * 一品ものはアイコンが主食（rice/pasta/noodle）に寄るため、その場合だけ主材料
 * （pickMainIngredients・調味料を除いた先頭材料）を1件ずつアイコン判定し直して肉/魚/卵/豆腐を拾う。
 * どれにも当たらなければ 'その他'（野菜が主役の主菜・分類不能）。
 */
export function proteinSourceOf(
  recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients'>,
): ProteinSource {
  const icon = pickIconKey(recipe)
  const direct = iconToProtein(icon)
  if (direct) return direct
  if (icon === 'rice' || icon === 'pasta' || icon === 'noodle') {
    for (const ing of pickMainIngredients(recipe.ingredients, 4)) {
      const p = iconToProtein(pickIconKey({ title: ing.name, tags: [], ingredients: [] }))
      if (p) return p
    }
  }
  return 'その他'
}

/**
 * 「今週まだ少ないたんぱく源」を返す純関数（2026-07-29 便CD/MP-03・docs/56 §3-6）。
 * fillWeek が週内の主菜のたんぱく源の集計を渡し、その結果を suggestForSlot の
 * preferProteinSources に載せる。
 *
 * 従来は ①'その他'（ツナキャベツ丼・ペペロンチーノ・寄せ鍋・クリームシチュー・冷しゃぶサラダ・
 * 冷や汁・ゴーヤチャンプルー・梅おろしぶっかけうどん など、野菜や主食が主役の主菜）を候補に
 * 入れておらず ②「最少ちょうど」のソースだけに絞っていた。①のせいでその8品は「まとめて献立」から
 * 構造的に出なくなり、②のせいで主菜プールが 肉→魚→卵→豆腐 の強制ローテーションに縛られて
 * 「振り直しても代わり映えしない」原因になっていた（中華指定では麻婆豆腐が毎回必ず出る等）。
 * docs/56 §3-6 は「軽く優先」「厳格化すると0件回避で結局崩れる」と書いており、
 * 最少ちょうどの絞り込みはその設計意図からの逸脱だった。'その他'を候補に入れ、
 * 「最少＋1まで」に緩めて設計意図へ戻す。
 */
export function preferredProteinSources(
  counts: Record<ProteinSource, number>,
): ProteinSource[] {
  const sources: ProteinSource[] = ['肉', '魚', '卵', '豆腐', 'その他']
  const min = Math.min(...sources.map((s) => counts[s]))
  return sources.filter((s) => counts[s] <= min + 1)
}

/**
 * 「つるっと系」（麺状で噛みごたえの少ない）主材料を使う料理か（2026-07-29 便CD/MP-04）。
 * しらたき・春雨・くずきり・そうめん・ところてん等は、材料名も pantryGroup も iconKey も
 * 別々に分類されるため、既存のどの名寄せでも「同じ食感が重なった」を検出できない。
 * 食感の重なり（例:「しらたきのチャプチェ風」＋「春雨サラダ」＝噛みごたえがゼロの日）を
 * 避けるためだけの、食感に特化した判定として新設する。
 */
export function isSlipperyDish(recipe: Pick<Recipe, 'title' | 'ingredients'>): boolean {
  const words = ['しらたき', '白滝', '糸こんにゃく', 'こんにゃく', '蒟蒻', '春雨', 'はるさめ', 'くずきり', '葛切り', 'そうめん', '素麺', 'ところてん', '心太']
  const hit = (text: string) => words.some((w) => text.includes(w))
  if (hit(recipe.title)) return true
  return recipe.ingredients.some((i) => hit(i.name))
}

/**
 * 同じ食事の中で重ねたくない「特徴キー」（2026-07-29 便CD/MP-04）。
 * 主菜に対して呼び、その結果を副菜提案の avoidKeys に渡す。
 * - たんぱく源（肉/魚/卵/豆腐）: 「えび主菜＋ツナ副菜」のような魚介の重複を避ける。
 *   'その他'（野菜が主役）は副菜のほとんどが該当してしまい絞り込みとして機能しないので入れない。
 * - つるっと系: 「しらたき＋春雨」のような食感の重複を避ける。
 * 差し替え理由の69%がこの2種類の重複だったため（PDCA2周目・T1実測）。
 */
export function dishAvoidKeys(
  recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients'>,
): string[] {
  const keys: string[] = []
  const protein = avoidProteinSourceOf(recipe)
  if (protein !== 'その他') keys.push(`protein:${protein}`)
  if (isSlipperyDish(recipe)) keys.push('texture:つるっと')
  return keys
}

/**
 * 重複回避用のたんぱく源判定（2026-07-29 便CD/MP-04）。proteinSourceOf は主菜の週内分散
 * （便BH-2）のための判定で、主食アイコン（丼・麺・パスタ）のときしか材料を見に行かない。
 * そのため「ツナと蒸し大豆の香味サラダ」はサラダのアイコンになり 'その他' 判定で、
 * 「えび主菜＋ツナ副菜」という魚介の重複を拾えなかった。
 * ここでは 'その他' になったときに主材料まで見に行って、副菜側のたんぱく源も拾う。
 * proteinSourceOf 自体には手を入れない（週内分散の挙動＝BH-2の回帰を動かさないため）。
 */
function avoidProteinSourceOf(
  recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients'>,
): ProteinSource {
  const direct = proteinSourceOf(recipe)
  if (direct !== 'その他') return direct
  for (const ing of pickMainIngredients(recipe.ingredients, 4)) {
    const supplement = AVOID_PROTEIN_WORDS.find(([word]) => ing.name.includes(word))
    if (supplement) return supplement[1]
    const p = iconToProtein(pickIconKey({ title: ing.name, tags: [], ingredients: [] }))
    if (p) return p
  }
  return 'その他'
}

/**
 * アイコン辞書が（アイコンの都合で）たんぱく源として拾わない加工品の補い
 * （2026-07-29 便CD/MP-04・重複回避の判定でだけ使う）。
 * icon.ts の魚リストは「ちくわ等の練り物は含めない（あえ物と衝突するため）」という
 * アイコン表示側の都合で作られており、ツナ缶もそこに入っていない。そのため
 * 「えびの主菜＋ツナの副菜」という魚介の重なりを拾えなかった（差し替え理由の3件）。
 * アイコン表示そのもの（icon.ts）と週内分散（proteinSourceOf）には影響させたくないので、
 * 重複回避専用の最小の補いとしてここに置く。
 */
const AVOID_PROTEIN_WORDS: [string, ProteinSource][] = [['ツナ', '魚']]

/**
 * その枠の主菜と、それ以外の品（副菜・汁物）のジャンルが食い違っているか
 * （「ジャンル混在」バッジ表示用・2026-07-23 便BH-2・docs/56 §3-10）。
 * 主菜のジャンルが定まっていて、他の品のいずれかが「別ジャンル」なら true。
 * ジャンルタグの無い品は「どのジャンルにも合う万能枠」として不一致に数えない
 * （黙って1品だけ他ジャンル、を正直に見せるための判定。主菜が無い/ジャンル無しなら混在なし）。
 */
export function detectGenreMix(
  mainRecipe: Pick<Recipe, 'tags'> | undefined,
  otherRecipes: (Pick<Recipe, 'tags'> | undefined)[],
): boolean {
  if (!mainRecipe) return false
  const mainGenre = recipeGenre(mainRecipe)
  if (!mainGenre) return false
  return otherRecipes.some((r) => {
    if (!r) return false
    const g = recipeGenre(r)
    return g !== undefined && g !== mainGenre
  })
}

/**
 * 「一品もの」（丼・麺・鍋・カレー・シチュー等、それ1品で食事が完結する主菜）を表すタグ。
 * 献立エンジン（便BH-2）が「一品ものの日は主菜1品で完結。副菜・汁物の自動枠を空ける」判定に使う
 * （カレーの隣に主菜をもう1品…を防ぐ。docs/56 §3-8）。
 */
const ONE_DISH_TAGS = ['ご飯もの', '麺', '鍋']
/**
 * タグに現れないがタイトルで「一品もの」と分かる語（クリームシチュー等）。タグ方式（ONE_DISH_TAGS）を
 * 主にしつつ、シチュー・カレーはタイトルで補う（クリームシチューは 鍋/ご飯もの タグを持たないため。
 * オーナー裁定 2026-07-23: 寄せ鍋・クリームシチューは「一品もの」扱いの主菜）。
 */
const ONE_DISH_TITLE_WORDS = ['カレー', 'シチュー']

/**
 * レシピが「一品もの」か（純関数・dishType非依存）。タグ（ご飯もの/麺/鍋）またはタイトル
 * （カレー/シチュー）で判定する。同梱品だけでなくユーザー自作・取り込みレシピにも効くよう、
 * タグに加えてタイトル語も見る（丼・麺・鍋はタグが確実に付くが、シチュー系はタグが無いため）。
 */
export function isOneDish(recipe: Pick<Recipe, 'title' | 'tags'>): boolean {
  if (recipe.tags.some((tag) => ONE_DISH_TAGS.includes(tag))) return true
  return ONE_DISH_TITLE_WORDS.some((word) => recipe.title.includes(word))
}

/**
 * 空き枠の自動提案。
 * まず「季節が合わない（all以外で不一致）」のレシピを除外し、「NG除外」「時短」で
 * 絞り込んだ後、「向いている時間帯」が一致するものを優先（未設定のレシピは制限なし
 * として扱う）。続けて「主菜/副菜の役割」「ジャンル」「役割のdishType純化(副菜=side)」
 * 「たんぱく源の分散」の順で優先度を絞り込み（いずれも該当が無ければ
 * 絞り込み前に戻す＝0件にはしない）、
 * 続けて「昨日の週プランに入っていたレシピを除外」（2026-07-16 便W-⑤b・こちらも
 * 除外して尽きれば解除）、その中で「最近作ってない」「週内で重複しない」の順にも絞り込む。
 * 候補が無くなったら段階的に条件を緩めて必ず何か返す（季節外しか無い場合を除き0件にはしない）。
 *
 * 絞り込みの中身は suggestCandidates（2026-08-02 便DE-5で切り出し）。ここは最後の抽選だけを行う。
 */
export function suggestForSlot(recipes: Recipe[], options: SuggestOptions): Recipe | undefined {
  const pool = suggestCandidates(recipes, options)
  if (pool.length === 0) return undefined
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * suggestForSlot が最後にくじを引く「候補の一覧」をそのまま返す（2026-08-02 便DE-5）。
 * 抽選（Math.random）だけを suggestForSlot に残し、絞り込みはすべてこちらに置く＝
 * **提案の中身は1ミリも変えずに**、候補が何品あるのかを画面に出せるようにするための分離。
 *
 * 何のために要るか: 候補が2品しかない状態でサイコロを何度も押すと、同じ料理が続けて出る。
 * これが「壊れている」ように見える（オーナー指摘）ので、画面に「候補◯品」を出して
 * 変わらない理由が分かるようにする。
 */
export function suggestCandidates(recipes: Recipe[], options: SuggestOptions): Recipe[] {
  const season = options.season ?? currentSeason()
  const base = recipes.filter((r) => {
    // 季節外（例: 8月に冬タグのシチュー）は提案しない。通年・未設定は常に対象
    if (r.season && r.season !== 'all' && r.season !== season) return false
    // ハード除外（同じ枠の主菜と副菜に同じ料理を入れない。便CD/MP-09）
    if (r.id != null && options.excludeRecipeIds?.includes(r.id)) return false
    if (options.excludeNg && hasNgIngredient(r, options.ngIngredients)) return false
    // 上限は呼び出し側が選んだ分数（2026-08-19 便HT）。渡されなければ従来どおり15分
    const quickLimit = options.quickMinutes ?? DEFAULT_PLAN_QUICK_MINUTES
    if (
      options.quickOnly &&
      !(r.cookMinutes != null && r.cookMinutes > 0 && r.cookMinutes <= quickLimit)
    )
      return false
    return true
  })
  if (base.length === 0) return []

  // 時間帯が一致する(または未設定の)レシピを優先。無ければ全体まで含める
  const slotMatched = base.filter(
    (r) => !r.suitableFor || r.suitableFor.length === 0 || r.suitableFor.includes(options.slot),
  )
  const slotPool = slotMatched.length > 0 ? slotMatched : base

  // 主菜/副菜の役割で絞り込む（dishType優先・未設定はタグヒューリスティックにフォールバック。
  // isMainCandidate/isSideCandidate参照）。roleが指定されていればそれを優先し、未指定時は
  // 従来どおり夕食・昼食枠だけ主菜を優先する後方互換ロジックを使う
  // 緩和段（該当0件で役割の絞り込みを解くとき）でも、おやつ・デザートだけは主菜にも副菜にも
  // 出さない（2026-07-13 Fable裁定を緩和段にも適用。便CD/MP-09）。それも0件なら何も返さない
  // ＝「副菜なし」のほうが「夕食の副菜に水ようかん」より正しい
  const withoutDessert = () => slotPool.filter((r) => !isDessertRecipe(r))
  let rolePool = slotPool
  if (options.role === 'main') {
    const mains = slotPool.filter((r) => isMainCandidate(r))
    rolePool = mains.length > 0 ? mains : withoutDessert()
  } else if (options.role === 'side' || options.role === 'soup') {
    // 汁物の行(2026-08-02 便DE-4)も副菜と同じプール(dishType: side/soup)から選ぶ。
    // 「汁物だけ」に絞るのは呼び出し側の preferDishType:'soup' で行う（0件なら自動で緩む）
    const sides = slotPool.filter((r) => isSideCandidate(r))
    rolePool = sides.length > 0 ? sides : withoutDessert()
  } else if (options.role === 'other') {
    // 「その他」の行(便DE-4)は分類の受け皿なので役割で絞らない（デザートも選べる）
    rolePool = slotPool
  } else if (options.slot === 'dinner' || options.slot === 'lunch') {
    const mains = slotPool.filter((r) => isMainCandidate(r))
    rolePool = mains.length > 0 ? mains : withoutDessert()
  }

  // ジャンル（和食/洋食/中華）の優先指定
  let genrePool = rolePool
  if (options.genre) {
    const genre = options.genre
    const matched = rolePool.filter((r) => r.tags.includes(genre))
    if (matched.length > 0) genrePool = matched
  }

  // 役割のdishType純化（副菜スロットを純粋な副菜dishType:'side'に寄せる。2026-07-23 便BH-2・
  // docs/56 §2「副菜スロットはsideのみ」。一致0件なら緩和＝汁物しか無い日は汁物を副菜として許す）
  let dishTypePool = genrePool
  if (options.preferDishType) {
    const wanted = options.preferDishType
    const matched = genrePool.filter((r) => r.dishType === wanted)
    if (matched.length > 0) dishTypePool = matched
  }

  // 同じ食事の中での食材・食感の重複回避（2026-07-29 便CD/MP-04）。主菜のたんぱく源・食感キーと
  // 重ならない品を優先する。一致0件なら緩和＝0件回避を優先（洋食・中華の副菜は3品しかないので、
  // 1品外しても2品残る＝通常は緩和段に落ちない）
  let avoidPool = dishTypePool
  if (options.avoidKeys && options.avoidKeys.length > 0) {
    const avoid = options.avoidKeys
    const matched = dishTypePool.filter((r) => !dishAvoidKeys(r).some((k) => avoid.includes(k)))
    if (matched.length > 0) avoidPool = matched
  }

  // たんぱく源の週内分散（今週まだ少ないソースの主菜を優先。2026-07-23 便BH-2・docs/56 §3-6。
  // 該当0件なら緩和＝0件回避を優先。魚・卵・豆腐の主菜が限られるため厳格化はしない）
  let proteinSourcePool = avoidPool
  if (options.preferProteinSources && options.preferProteinSources.length > 0) {
    const wanted = options.preferProteinSources
    const matched = avoidPool.filter((r) => wanted.includes(proteinSourceOf(r)))
    if (matched.length > 0) proteinSourcePool = matched
  }

  // 「昨日の週プランに入っていたレシピ」を除外（2026-07-16 便W-⑤b。直近の繰り返し防止。
  // 除外して候補が尽きる場合はexcludeYesterdayPlanRecipes内部で自動的に解除される）
  const yesterdayFiltered = options.yesterdayRecipeIds
    ? excludeYesterdayPlanRecipes(proteinSourcePool, options.yesterdayRecipeIds)
    : proteinSourcePool

  const notUsedThisWeek = yesterdayFiltered.filter((r) => !options.usedRecipeIds.includes(r.id!))
  const freshAndUnused = notUsedThisWeek.filter((r) => !cookedWithinDays(r, 14))

  return freshAndUnused.length > 0
    ? freshAndUnused
    : notUsedThisWeek.length > 0
      ? notUsedThisWeek
      : yesterdayFiltered
}

export interface SuggestPairResult {
  main?: Recipe
  side?: Recipe
}

/**
 * 主菜+副菜のペア提案（2026-07-13献立の主菜+副菜構成対応・2026-07-23 便BH-2で日単位の
 * ジャンル統一・一品もの・副菜純化を追加）。まず主菜を提案し:
 * - 主菜が「一品もの」（丼・麺・鍋・カレー・シチュー）なら、それ1品で食事が完結するので
 *   副菜は付けない（カレーの隣に主菜/副菜をもう1品…を防ぐ。docs/56 §3-8）。
 * - そうでなければ、ユーザーがジャンルを指定していない限り、選ばれた主菜のジャンル
 *   （和食/洋食/中華）に副菜のジャンルを揃える（一致する副菜が無ければ他ジャンルも許可＝混在）。
 *   副菜スロットは純粋な副菜（dishType:'side'）に寄せる（docs/56 §2「副菜スロットはsideのみ」）。
 * 主菜が提案できない（季節・NG等で候補が0件の）ときは副菜だけ提案を試みる。
 */
export function suggestPairForSlot(
  recipes: Recipe[],
  options: Omit<SuggestOptions, 'role'>,
): SuggestPairResult {
  const main = suggestForSlot(recipes, { ...options, role: 'main' })
  // 一品ものの主菜は副菜を空ける（主菜1品で完結）
  if (main && isOneDish(main)) return { main }
  const side = suggestForSlot(recipes, {
    ...options,
    role: 'side',
    // 副菜スロットは純粋な副菜に寄せる。たんぱく源分散は主菜だけの都合なので副菜には効かせない
    preferDishType: 'side',
    preferProteinSources: undefined,
    // 主菜と食材（たんぱく源）・食感が重ならない副菜を優先する（便CD/MP-04）
    avoidKeys: main ? dishAvoidKeys(main) : undefined,
    // 同じ枠に同じ料理が2回入るのを必ず防ぐ（便CD/MP-09。usedRecipeIdsは緩和段で復活しうる）
    excludeRecipeIds: main?.id != null ? [...(options.excludeRecipeIds ?? []), main.id] : options.excludeRecipeIds,
    usedRecipeIds: main ? [...options.usedRecipeIds, main.id!] : options.usedRecipeIds,
    genre: options.genre ?? (main ? recipeGenre(main) : undefined),
  })
  return { main, side }
}

/**
 * 目的モード（docs/62 決定②）の引き直し回数 k。docs/60 §3-2-3 の実測でk=3を推奨:
 * kを上げるほど目的の軸には沿うが、同じ料理ばかり出るようになる（上位10品のシェアが
 * k=1で28.8%→k=10で55.4%）。便CD/MP-03で直したばかりの「振り直しても代わり映えしない」を
 * 逆走させないための上限として3で止める。
 */
export const PURPOSE_REDRAW_ATTEMPTS = 3

/**
 * 【引き直し方式】同じ枠を最大 attempts 回引き直し、penalty が最も小さいペアを採る純関数
 * （2026-08-02 便CP-2・docs/60 §3-2-2 案A）。
 *
 * この関数の存在意義は「**献立エンジン本体を1行も変えない**」こと。
 * suggestForSlot / suggestPairForSlot の段階的緩和・0件回避・ジャンル統一・副菜のdishType純化・
 * 重複回避・たんぱく源分散は一切触らず、その**呼び出し側のラッパー**としてだけ選び直す。
 * attempts=1 なら1回目をそのまま返す＝現行と完全に等価（いつでも無効化できる）。
 *
 * @param draw    1回ぶんの抽選（= () => suggestPairForSlot(recipes, options)）。呼ぶたびに違う結果が出る
 * @param penalty ペアの「目的からの遠さ」。**小さいほど目的に沿う**。0以下＝理想としてそこで打ち切る
 * @param attempts 最大の抽選回数 k
 *
 * 【ガード1: 一品もの（docs/60 §3-2-2「一品ものガード（必須）」）】
 *   1回目に引いた主菜が一品もの（丼・麺・鍋・カレー・シチュー）なら、引き直さずそのまま採る。
 *   2回目以降に一品ものが出たら候補にしない。
 *   理由（docs/60の実測）: ガード無しで最適化すると一品ものの日が25.3%→17.9%に減る。
 *   一品ものは野菜が少なく塩分が高いので構造的に締め出されるが、カレー・丼が出にくくなるのは
 *   献立の性格を変える副作用であり、オーナー要望のどこにも書かれていない。
 *
 * 【ガード2: 構成（本便で追加）】
 *   2回目以降は「主菜がある」かつ「1回目に副菜があったなら副菜もある」ものだけを候補にする。
 *   これが無いと「塩分をひかえめに」の軸で**品数の少ないペア（主菜だけ・0件）が常に勝つ**——
 *   料理を減らせば塩分は必ず下がるため。目的モードは献立の組み合わせを選ぶ機能であって、
 *   品数を削る機能ではないので、比べる対象を同じ構成のペアどうしに揃える。
 *
 * どちらのガードでも候補が1つも残らなければ1回目の結果を返す（0件回避は既存のまま＝提案が消えない）。
 */
export function chooseBalancedPair(
  draw: () => SuggestPairResult,
  penalty: (pair: SuggestPairResult) => number,
  attempts: number,
): SuggestPairResult {
  const first = draw()
  if (attempts <= 1) return first
  // ガード1: 1回目が一品ものなら引き直さない（その日はそれで完結する献立）
  if (first.main && isOneDish(first.main)) return first
  // 主菜が引けなかった枠（季節・NG等で候補0件）は引き直しても同じなので触らない
  if (!first.main) return first

  const wantSide = first.side != null
  let best = first
  let bestPenalty = penalty(first)
  if (bestPenalty <= 0) return best // 理想に届いたらそこで打ち切る
  for (let i = 1; i < attempts; i++) {
    const next = draw()
    if (!next.main) continue // ガード2: 主菜のないペアとは比べない
    if (isOneDish(next.main)) continue // ガード1: 2回目以降の一品ものは捨てる
    if (wantSide && !next.side) continue // ガード2: 副菜を削って軸を稼がない
    const p = penalty(next)
    if (p < bestPenalty) {
      best = next
      bestPenalty = p
    }
    if (bestPenalty <= 0) break
  }
  return best
}

/** 「まとめて献立を立てる」の埋め方を決める計画（planWeekFill の戻り値） */
export interface FillWeekPlan {
  /**
   * 主菜+副菜のペアで埋める枠（主菜・副菜のどちらの役割も空 or 自動提案由来だけの枠。
   * 日付順→食事帯順）。fillWeek はここを suggestPairForSlot で埋める。
   */
  slotsToFill: { date: string; slot: MealSlot }[]
  /**
   * 片方の役割だけを追加で埋める枠（2026-07-23 便BH-2・docs/56 §3-9: 保護粒度を
   * 「枠」から「枠×役割」へ細分化）。例: 手動で主菜だけ入れた枠は、主菜は残したまま
   * 空いている副菜だけを自動提案で埋める。fillRole=埋める役割。手動主菜のジャンルに副菜を
   * 揃える等はfillWeek側で（recipe本体を引ける側で）解決する。
   */
  partialFills: { date: string; slot: MealSlot; fillRole: MealRole }[]
  /** 手動配置がある（＝丸ごとは消さない）枠のキー("date|slot")の集合。件数はメッセージにも使う */
  preservedSlotKeys: Set<string>
  /**
   * 埋め直す役割に残っていて、提案し直す前に削除するエントリのid。
   * 既定では「自動提案由来」の行だけが入る（手動配置は消さない）。
   * replaceAll=true（2026-08-07 便DT-8「レシピを総入れ替え」）のときだけ、対象範囲の
   * 手動配置の行も入る＝スイッチを入れて確認に答えたときにしか手動配置は消えない。
   */
  entryIdsToRemove: number[]
  /** 重複回避で used とみなす recipeId（対象外の枠＋残す手動役割の中身）。提案の同一週内重複を避ける */
  usedRecipeIds: number[]
  /**
   * options.skipDates で対象から外した日（過去日は元から対象外なので含めない）。
   * 「メモを書いた◯日には入れません」と確認文に書くための件数に使う（2026-07-30 便CH/C10）。
   */
  skippedDates: string[]
  /**
   * 鍵が掛かっていて対象から外した食事の数（2026-08-08 便DX）。
   * 「ロック中の◯食分は変わりません」と確認文に書くための件数に使う（規約F）。
   * 料理が入っていない食事も数える（鍵は「触らない」印なので、空でも変わらないことに変わりはない）。
   */
  lockedSlotCount: number
}

/**
 * 「まとめて献立を立てる」の計画を立てる純ロジック（2026-07-22 便BE・手動配置の無警告上書き対策）。
 *
 * 挙動:
 * - 過去日(今日より前)の枠は対象外（既存仕様。上書きも新規埋めもしない）
 * - 対象=未来日×表示中の食事帯。そのうち
 *   - 手動配置(auto以外の行)が1件でもある枠は「丸ごと残す」＝提案で埋め直さない（手動を守る）
 *   - それ以外の枠（空 or 自動提案由来だけ）は、自動提案由来の既存行を消してから提案で埋め直す
 *     （＝2回目以降のタップでも自動枠は再抽選される。2026-07-14の再抽選仕様を自動枠に限って維持）
 *
 * これで「手動で入れた献立を無警告で上書きして消す」欠陥をなくしつつ、
 * 「まとめて献立を立てるを押すたびに新しい提案に振り直せる」再抽選の使い勝手も保つ。
 * 未設定(auto未指定)の既存データは手動扱い＝保護側に倒す（非破壊が既定）。
 *
 * 2026-07-23 便BH-2（docs/56 §3-9・保護粒度を「枠」から「枠×役割」へ細分化）:
 * 手動で主菜だけ入れた枠は、主菜は残したまま空いている副菜だけを自動で足せるようにした。
 * 判定を役割（main/side）単位で行い、手動で埋まっている役割だけを残し、空 or 自動だけの役割を
 * 埋め対象にする。両役割とも埋め対象なら slotsToFill（ペア）、片方だけなら partialFills（単役割）。
 * 便BEの非破壊原則（手動配置は消さない）はそのまま：手動役割のエントリは削除対象にしない。
 *
 * 2026-07-30 便CH/C1（月の一括提案の総入れ替え対策）: options.keepAuto を追加した。
 * true にすると自動提案由来の枠も「すでに決まっている」側として保護する＝1品も消さない。
 * 月タブの「献立をまとめて提案」（fillMonth）だけがこれを使う。理由:
 *  - ボタン名（献立をまとめて提案）・ヒント（まだ決まっていない日に入れます）・docs/59 A-5 は
 *    三つとも「空いているところだけ」を約束しているのに、週の再抽選仕様をそのまま共有したせいで
 *    2回目のタップで自動配置分が丸ごと入れ替わっていた（確認文「今ある献立は消えません」が嘘になる）。
 *  - 週タブの「まとめて献立を立てる」は押すたびに振り直せる再抽選が2026-07-14の確定仕様なので、
 *    既定値 false のまま一切変えない。入れ替えたい人は週タブで振り直せる。
 */
export function planWeekFill(
  entries: MealPlanEntry[],
  weekDatesArr: string[],
  visibleSlots: MealSlot[],
  today: string,
  options: {
    /** 自動提案由来の枠も保護する（消さない）。月の一括提案と、週タブの「まだ決まっていない枠だけ埋める」 */
    keepAuto?: boolean
    /**
     * 対象範囲の献立を、手動配置も含めて全部消してから入れ直す
     * （2026-08-07 便DT-8「レシピを総入れ替え」・オーナー指示）。
     *
     * 既定は false＝2026-07-22 便BEの非破壊原則（手動配置は無警告で消さない）のまま。
     * true にできるのは、ユーザーが週タブのスイッチを「レシピを総入れ替え」に倒し、
     * 規約Fの確認文（何が消えて何が残るか・件数つき）に「はい」と答えたときだけ。
     * 対象範囲の定義は変えない＝過去日・表示していない食事・メモで外した日には触らない。
     * keepAuto と同時に true にしても意味が矛盾するので、replaceAll を優先する。
     */
    replaceAll?: boolean
    /**
     * 丸ごと対象から外す日（2026-07-30 便CH/C10）。月の一括提案が「その日のメモ」を書いた日
     * （外食・実家に帰る等）に献立を入れてしまうのを防ぐために使う。
     * 外した日の献立は触らないだけ＝非破壊で、重複回避の used にだけ入る。
     */
    skipDates?: string[]
    /**
     * 鍵の掛かっている食事（'YYYY-MM-DD|slot' の集合。2026-08-08 便DX・オーナー指示）。
     * ここに入っている食事は、総入れ替え（replaceAll）でも触らない＝1品も消さず1品も入れない。
     * 中身は重複回避の used にだけ数える（鍵の中の料理と同じものを隣の日に出さないため）。
     */
    lockedKeys?: ReadonlySet<string>
  } = {},
): FillWeekPlan {
  const replaceAll = options.replaceAll ?? false
  const keepAuto = !replaceAll && (options.keepAuto ?? false)
  const skipDates = new Set(options.skipDates ?? [])
  const lockedKeys = options.lockedKeys ?? EMPTY_LOCK_KEYS
  const notPastDates = weekDatesArr.filter((date) => !isPastDate(date, today))
  const skippedDates = notPastDates.filter((date) => skipDates.has(date))
  const futureDates = notPastDates.filter((date) => !skipDates.has(date))
  const touchedKeys = new Set(
    futureDates.flatMap((date) => visibleSlots.map((slot) => `${date}|${slot}`)),
  )

  const slotsToFill: { date: string; slot: MealSlot }[] = []
  const partialFills: { date: string; slot: MealSlot; fillRole: MealRole }[] = []
  const preservedSlotKeys = new Set<string>()
  const entryIdsToRemove: number[] = []
  const usedRecipeIds: number[] = []
  let lockedSlotCount = 0

  // 対象外の枠（過去日・非表示帯）のレシピは触らない＝重複回避のusedに入れるだけ
  for (const e of entries) {
    if (!touchedKeys.has(`${e.date}|${e.slot}`)) usedRecipeIds.push(e.recipeId)
  }

  // 対象枠を役割（main/side）単位で仕分ける。
  // 汁物・その他（2026-08-02 便DE-4）は自動提案が入れない役割なので、ここでは仕分けず
  // 「触らないが重複回避には数える」扱いにする（勝手に消さないし、勝手に増やさない）
  const roles = AUTO_FILL_ROLES
  for (const date of futureDates) {
    for (const slot of visibleSlots) {
      const slotEntries = entries.filter((e) => e.date === date && e.slot === slot)
      // 鍵の掛かっている食事（2026-08-08 便DX）は、総入れ替えでも一切触らない。
      // 過去日・非表示帯と同じ「対象外」の扱いにそろえ、中身は重複回避のusedにだけ数える
      if (lockedKeys.has(`${date}|${slot}`)) {
        lockedSlotCount++
        for (const e of slotEntries) usedRecipeIds.push(e.recipeId)
        continue
      }
      let hasManualAnything = false
      const fillable: Record<AutoFillRole, boolean> = { main: false, side: false }
      for (const e of slotEntries) {
        const role = e.role ?? 'main'
        // 汁物・その他は自動提案が入れない役割なので、既定では触らず重複回避にだけ数える。
        // 総入れ替え（便DT-8）は「この枠の献立を全部入れ直す」なので、この2役割も消す
        // （主菜・副菜だけ入れ替わって汁物が前のまま残ると、総入れ替えになっていない）
        if (role !== 'main' && role !== 'side') {
          if (replaceAll && e.id != null) entryIdsToRemove.push(e.id)
          else usedRecipeIds.push(e.recipeId)
        }
      }
      for (const role of roles) {
        const roleEntries = slotEntries.filter((e) => (e.role ?? 'main') === role)
        // keepAuto=true のときは、自動提案で入った行も「すでに決まっている」として保護する。
        // replaceAll=true のときは何も保護しない＝全役割が埋め対象になる
        const hasManual = !replaceAll && roleEntries.some((e) => keepAuto || !e.auto)
        if (hasManual) {
          // 手動で埋まっている役割: 同役割のエントリ（手動+自動とも）を残し、重複回避のusedに入れる
          hasManualAnything = true
          for (const e of roleEntries) usedRecipeIds.push(e.recipeId)
        } else {
          // 空 or 自動提案由来だけの役割 = 埋め対象。自動行は削除してから提案し直す（再抽選）。
          // 総入れ替えでは手動配置の行も削除対象にする（スイッチ＋確認を経たときだけここへ来る）
          fillable[role] = true
          for (const e of roleEntries) {
            if ((replaceAll || e.auto) && e.id != null) entryIdsToRemove.push(e.id)
          }
        }
      }
      if (hasManualAnything) preservedSlotKeys.add(`${date}|${slot}`)
      if (fillable.main && fillable.side) {
        slotsToFill.push({ date, slot }) // 両役割が空/自動 → ペアで埋める
      } else if (fillable.main) {
        partialFills.push({ date, slot, fillRole: 'main' }) // 手動副菜が残る枠に主菜だけ
      } else if (fillable.side) {
        partialFills.push({ date, slot, fillRole: 'side' }) // 手動主菜が残る枠に副菜だけ
      }
    }
  }

  return {
    slotsToFill,
    partialFills,
    preservedSlotKeys,
    entryIdsToRemove,
    usedRecipeIds,
    skippedDates,
    lockedSlotCount,
  }
}

/** ロック未指定の呼び出し用の空集合（毎回 new Set しないための共有インスタンス） */
const EMPTY_LOCK_KEYS: ReadonlySet<string> = new Set<string>()

/** 「別の週の献立をコピー」の計画（planCopyLastWeek の戻り値） */
export interface CopyLastWeekPlan {
  /** 実際に追加する行。空ならコピーするものが無い */
  ops: { date: string; slot: MealSlot; recipeId: number; role: MealRole }[]
  /** コピー元（選んだ週の同じ曜日）にあった品数。0なら「その週に献立が無い」 */
  sourceTotal: number
  /** 鍵が掛かっていて対象から外した食事の数（確認文の件数に使う。2026-08-08 便DX） */
  lockedSlotCount: number
  /**
   * 総入れ替え（replaceAll）で消す行のid（2026-08-19 便IF・⑧）。
   * 「空いた枠だけ」を選んでいるあいだは必ず空＝1件も消さない。
   */
  entryIdsToRemove: number[]
  /** 総入れ替えで中身を入れ替える食事の数（規約Fの確認文の件数に使う） */
  replacedSlotCount: number
}

/**
 * S-3「別の週の献立をコピー」の計画を立てる純ロジック
 * （2026-07-25 便BU・docs/59。2026-08-08 便DXでロック対応と同時に画面から切り出した）。
 *
 * 守ること:
 * - 過去日（今日より前）は対象外。表示していない食事にも入れない（週タブの編集範囲と同じ）。
 * - 鍵の掛かっている食事には入れない（2026-08-08 便DX）。空いていても入れない
 *   ＝「この食事は自分で決めるから自動で入れないで」を守る。総入れ替えでも消さない。
 *
 * 2026-08-19 便IF・⑧（オーナー原文「『先週の献立をコピー』で、すでに決まっている日も
 * 上書きできる選択ができない」）: 週タブの「入れかた」がコピーにも効くようにした。
 * - replaceAll なし（既定＝空いた枠だけ）… すでに1品でも入っている食事には入れない＝上書きしない
 * - replaceAll あり（総入れ替え）… その食事に今ある行を消してから、コピー元の献立を入れる。
 *   コピー元が空の食事は空になる（自動提案の総入れ替え＝planWeekFill と同じ意味にそろえる）。
 *   消す操作なので、呼び出し側は規約Fの確認（何が消えて何が残るか・件数つき）を必ず通す。
 *
 * 2026-08-20 便II・⑤（オーナー原文「先週をコピーは、先週以外を今週に反映したい時に使えない。
 * 表示している週をコピーにはできない？」）: コピー元を**何週間前か**で選べるようにした
 * （weeksBack。既定は1＝これまでと同じ先週）。コピー先は表示している週のままなので、
 * 「先々週の献立を今週へ」がこの画面のままできる。呼び出し側は prevEntries に
 * **選んだ週の7日分**を渡すこと（範囲の取得と weeksBack がずれると、写る中身が食い違う）。
 */
export function planCopyLastWeek(options: {
  /** コピー先の日付（表示中の週の7日） */
  dates: string[]
  /** YYYY-MM-DD（今日） */
  today: string
  /** 表示中の食事 */
  visibleSlots: MealSlot[]
  /** コピー先に今ある献立（総入れ替えでは id を使って消す） */
  entries: Pick<MealPlanEntry, 'id' | 'date' | 'slot'>[]
  /** コピー元（weeksBack で選んだ週）の献立 */
  prevEntries: Pick<MealPlanEntry, 'date' | 'slot' | 'recipeId' | 'role'>[]
  /**
   * コピー元が何週間前か（2026-08-20 便II・⑤。既定は1＝先週）。
   * 1日ずつではなく必ず7日単位で戻す＝どの表示のしかた（週区切り／今日を先頭に7日間）でも
   * 「同じ曜日」を指す。
   */
  weeksBack?: number
  /** 鍵の掛かっている食事（'YYYY-MM-DD|slot'） */
  lockedKeys?: ReadonlySet<string>
  /** すでに決まっている食事も入れ替える（2026-08-19 便IF・⑧。既定は false＝非破壊） */
  replaceAll?: boolean
}): CopyLastWeekPlan {
  const { dates, today, visibleSlots, entries, prevEntries } = options
  const lockedKeys = options.lockedKeys ?? EMPTY_LOCK_KEYS
  const replaceAll = options.replaceAll ?? false
  // 何週間前から写すか。1未満・整数でない値が来ても1週間前に倒す（コピーが止まらないようにする）
  const weeksBack =
    Number.isInteger(options.weeksBack) && (options.weeksBack as number) >= 1
      ? (options.weeksBack as number)
      : 1
  const filledKeys = new Set(entries.map((e) => `${e.date}|${e.slot}`))
  const entriesByKey = new Map<string, typeof entries>()
  for (const e of entries) {
    const key = `${e.date}|${e.slot}`
    const list = entriesByKey.get(key)
    if (list) list.push(e)
    else entriesByKey.set(key, [e])
  }
  const prevByKey = new Map<string, typeof prevEntries>()
  for (const e of prevEntries) {
    const key = `${e.date}|${e.slot}`
    const list = prevByKey.get(key)
    if (list) list.push(e)
    else prevByKey.set(key, [e])
  }
  const ops: CopyLastWeekPlan['ops'] = []
  const entryIdsToRemove: number[] = []
  let sourceTotal = 0
  let lockedSlotCount = 0
  let replacedSlotCount = 0
  for (const date of dates) {
    if (isPastDate(date, today)) continue
    const src = shiftDate(date, -7 * weeksBack)
    for (const slot of visibleSlots) {
      const srcEntries = prevByKey.get(`${src}|${slot}`) ?? []
      sourceTotal += srcEntries.length
      if (lockedKeys.has(`${date}|${slot}`)) {
        lockedSlotCount++
        continue
      }
      if (replaceAll) {
        // 総入れ替え: いま入っている行を消してから入れ直す（鍵と過去日は上で外してある）
        const here = entriesByKey.get(`${date}|${slot}`) ?? []
        const ids = here.map((e) => e.id).filter((id): id is number => id != null)
        if (ids.length > 0) {
          entryIdsToRemove.push(...ids)
          replacedSlotCount++
        }
      } else if (filledKeys.has(`${date}|${slot}`)) {
        // 既にある食事は上書きしない（手動・自動とも残す）。空いている食事にだけ先週の分を入れる
        continue
      }
      for (const e of srcEntries) {
        ops.push({ date, slot, recipeId: e.recipeId, role: e.role ?? 'main' })
      }
    }
  }
  return { ops, sourceTotal, lockedSlotCount, entryIdsToRemove, replacedSlotCount }
}

/**
 * 表示している週で、鍵（ロック）のボタンを出すか（2026-08-19 便IF・⑪。オーナー原文
 * 「過去の日付の１週間表示では、ロック機能使いませんよね？残しておく意味ある？」）。
 *
 * 過ぎた日は週タブで予定のグリッドそのものを出しておらず、手で足す・変える・消すができない。
 * まとめて動かす操作のうち「まとめて献立を入力」（planWeekFill）と「先週の献立をコピー」
 * （planCopyLastWeek）も、過ぎた日を初めから対象外にしている。
 * ＝7日とも過ぎている週では、鍵で守るものが画面に1つも無い。
 *
 * **機能そのものは消さない**（掛かっている鍵は保存されたまま効き続ける）。
 * 出すか出さないかだけをここで決める。今日・未来日が1日でも混ざる週（＝今週）では出す。
 */
export function planShowWeekLock(dates: string[], today: string): boolean {
  return dates.some((date) => !isPastDate(date, today))
}

/** 「まとめて空にする」の計画（planClearMealSlots の戻り値） */
export interface ClearMealSlotsPlan {
  /** 実際に消す行のid */
  entryIdsToRemove: number[]
  /** 消す品数（＝entryIdsToRemove.length。確認文・結果の件数に使う） */
  targetCount: number
  /** 鍵が掛かっていて消さずに残す品数 */
  lockedEntryCount: number
  /** 鍵が掛かっていて対象から外した食事の数（確認文の件数に使う） */
  lockedSlotCount: number
}

/**
 * 週タブ「この週の◯◯をまとめて空にする」の計画を立てる純ロジック
 * （2026-07-16 便U-4。2026-08-08 便DXでロック対応と同時に画面から切り出した）。
 *
 * 選んだ食事の行だけを消す。鍵の掛かっている食事は消さない（2026-08-08 便DX・
 * 「自動でまとめて動かす操作は鍵の中に入らない」という一貫規則）。手で1行ずつ消すのは自由。
 * 対象は渡した期間の全日（過去日を含む）＝従来どおりの範囲を変えない。
 */
export function planClearMealSlots(
  entries: Pick<MealPlanEntry, 'id' | 'date' | 'slot'>[],
  slots: MealSlot[],
  lockedKeys: ReadonlySet<string> = EMPTY_LOCK_KEYS,
): ClearMealSlotsPlan {
  const targets = new Set(slots)
  const entryIdsToRemove: number[] = []
  let lockedEntryCount = 0
  const lockedSlotKeys = new Set<string>()
  for (const e of entries) {
    if (!targets.has(e.slot)) continue
    const key = `${e.date}|${e.slot}`
    if (lockedKeys.has(key)) {
      lockedEntryCount++
      lockedSlotKeys.add(key)
      continue
    }
    if (e.id != null) entryIdsToRemove.push(e.id)
  }
  return {
    entryIdsToRemove,
    targetCount: entryIdsToRemove.length,
    lockedEntryCount,
    lockedSlotCount: lockedSlotKeys.size,
  }
}

/**
 * 「今日の献立」（todayList）のうち、**レシピ一覧から自分で選んだ分**のレシピIDを返す
 * （＝今日の週プランには入っていない分。2026-08-03 便DH）。
 *
 * 献立タブの日タブは、今日つくるものを
 *   ①「レシピ一覧から選択中」＝この関数の結果
 *   ②「今週の献立の予定」＝今日の週プラン（朝食・昼食・夕食）
 * の2つに分けて縦に並べる。日タブを開くと今日の週プランは todayList へ自動取り込みされる
 * （便U-3）ので、todayList から週プランぶんを引くと①だけが残る。
 *
 * 旧 todayPlanMismatch との違い: 週プランの今日の枠が0件でも空配列にせず、todayList を
 * そのまま①として返す。旧関数は「食い違いの警告」を出すためのもので、週プランを使って
 * いない人に警告を出さないよう0件時は空にしていた。いまは警告ではなく**内訳の見出し**
 * なので、週プランが空でも「レシピ一覧から選択中」として並べる必要がある。
 *
 * ---
 * 2026-08-11 便FN（利用者テストのバグ修正「『全て作った！』のあと、その日の献立に同じレシピを
 * 戻せない」）。引き算の相手を「今日の予定ぜんぶ」から「**②にいま出ている予定**」へ変えた。
 *
 * 直したバグ: ②は今日すでに作った品を出さない（作った後は予定でなく記録）。一方この関数は
 * 今日の予定に載っているレシピIDを無条件で引いていたため、「全て作った！」で今日の献立が
 * 空になったあとに同じ品を入れ直しても、①からも②からも消えたまま画面に出てこなかった。
 * ②に出ていない予定は引かない＝作り終えた品を自分で入れ直せば①に並ぶ。
 *
 * 予定の写し（fromPlan・自動取り込みで入った品）は、その予定が残っているかぎり①に出さない。
 * 写しは自分で選んだ品ではないので、②から消えた（＝作った）のを機に①へ回すと、
 * 記録したはずの品が「レシピ一覧から選択中」として並び直してしまう（便DP-4で直した退行）。
 */
export function todayListPickedIds(
  todayListItems: readonly { recipeId: number; fromPlan?: boolean }[],
  /** ②「今週の献立の予定」としていま画面に出ているレシピID */
  plannedShownRecipeIds: readonly number[],
  /** 今日の予定に載っている全レシピID（省略時は②と同じ＝予定を隠さない画面向け） */
  todayPlanRecipeIds: readonly number[] = plannedShownRecipeIds,
): number[] {
  return todayListItems
    .filter((item) => !plannedShownRecipeIds.includes(item.recipeId))
    .filter((item) => !(item.fromPlan === true && todayPlanRecipeIds.includes(item.recipeId)))
    .map((item) => item.recipeId)
}

/**
 * そのレシピが「今日つくるもの」に入っているか（2026-08-21 便IU・⑦）。
 *
 * オーナー原文:
 *   「週で献立組む→今日の献立にレシピが表示される→レシピ詳細も「今日の献立に追加済み」に
 *     して。はずすと週の献立ごと編集されるようにしたい。」
 *
 * 直している穴: レシピ詳細は「今日の献立」の表（todayList）だけを見ていた。**週で組んだ予定が
 * その表へ写るのは、献立の「日」を開いたときの自動取り込み1本だけ**（1日1回・表示している
 * 食事だけ）なので、週タブで組んだあとレシピ詳細を開いても「追加済み」にならなかった。
 * 日タブは①今日の献立の表 ②今日の予定 の両方を並べているのに、詳細だけ①しか見ていない
 * ＝**同じ「今日つくるもの」を、画面によって違う数え方をしていた**。
 *
 * 判定はこの1か所に置く（画面ごとに書くと、また片方だけ直る）。
 */
export function isRecipeInToday(
  recipeId: number,
  /** 「今日の献立」の表に入っているレシピID */
  todayListRecipeIds: readonly number[],
  /** 今日の週の予定に入っているレシピID */
  todayPlanRecipeIds: readonly number[],
  /** その料理を今日すでに作ったか（作った記録が今日の日付である） */
  cookedToday = false,
): boolean {
  const inList = todayListRecipeIds.includes(recipeId)
  if (inList) return true
  // 今日すでに作った品は、献立の「日」でも予定の行が消える（showsCookedPlanRowToday）。
  // そちらに並んでいないものを「追加済み」と言うと、また画面ごとに数え方が食い違う
  return todayPlanRecipeIds.includes(recipeId) && showsCookedPlanRowToday(cookedToday, inList)
}

/**
 * 献立の日タブの「今週の献立の予定」に、今日すでに作った品の行を出すか
 * （2026-08-12 便FS-1・利用者テストのバグ修正）。
 *
 * 直したバグ: レシピ詳細で「今日の献立に追加」→「夕食」を選ぶと「今日の夕食に戻しました」と
 * 出るのに、その品は「今週の献立の予定／夕食」ではなく「レシピ一覧から選択中」に並び、
 * 「朝食に入れる／昼食に入れる／夕食に入れる」が未選択のまま付いていた
 * ＝夕食と言われた直後に、また夕食を選べと出る画面になっていた。
 *
 * 予定の行を隠す規則は「今日すでに作った品は出さない（作った後は予定でなく記録）」だが、
 * 隠す条件を**作ったかどうかだけ**にしていたため、作り終えたあとに自分で入れ直した品まで
 * 隠れ続けていた。条件に「いま今日の献立に入っているか」を足す。
 *
 * 「作った」を押すとその品は今日の献立から外れるので、ふつうに作り終えた品は今までどおり
 * 消える。自分で入れ直したときだけ、その食事の行として戻る（週の予定の行は増えない＝
 * 週タブに同じ品が2行並ばない）。
 *
 * 作っていない品の見え方は、この判定の前後で1つも変わらない。
 */
export function showsCookedPlanRowToday(cookedToday: boolean, inTodayList: boolean): boolean {
  return !cookedToday || inTodayList
}

/** todaySlotAddPlan の結果（呼び出し側はこれを見て操作とお知らせを決める） */
export type TodaySlotAddPlan = 'add' | 'restore' | 'duplicate'

/**
 * レシピ詳細の「今日の献立に追加」で朝食/昼食/夕食を選んだときに何をするかを決める純関数
 * （2026-08-11 便FN・利用者テストのバグ修正）。
 *
 * 直したバグ: 「全て作った！」で今日の献立を空にしたあと、同じレシピを同じ食事へ入れ直そうと
 * すると「今日の夕食にすでに入っています」とだけ出て、日タブは空のまま何も起きなかった。
 * 週の予定の行は記録をつけても残る（記録として「作った」の見た目で残す仕様）ため、
 * 「同じ日×同じ食事にその行があるか」だけで重複と判定すると、**作り終えた行が同じ品の
 * 入れ直しを永久に拒む**。日タブから消えている品なのに追加を断る＝画面が自分で矛盾を言う。
 *
 *   add       … その食事にまだ無い。予定の行を足し、今日の献立にも入れる
 *   restore   … 行はあるが今日すでに作った品。**行は増やさず**今日の献立に戻す
 *                （同じ品が予定に2行並ぶと、週タブでどちらも「作った」に見えてしまう）。
 *                日タブでは、いま持っているその食事の行がそのまま戻る
 *                （2026-08-12 便FS-1・showsCookedPlanRowToday）
 *   duplicate … 行があり、まだ作っていない＝ほんとうに二重。何もしない
 */
export function todaySlotAddPlan(
  sameSlotRecipeIds: readonly number[],
  recipeId: number,
  cookedToday: boolean,
): TodaySlotAddPlan {
  if (!sameSlotRecipeIds.includes(recipeId)) return 'add'
  return cookedToday ? 'restore' : 'duplicate'
}

/**
 * 「今日の献立」に取り残された、**予定の写しだけ**のレシピIDを返す（2026-08-03 便DP-4）。
 *
 * 直したバグ: 週の予定を消したあと、その品が今日の献立に「レシピ一覧から選択中」として
 * 残り続けた。日タブを開くと今日の予定は今日の献立へ自動取り込みされる（便U-3）が、
 * 予定を消したときにその写しを片付ける経路がどこにも無かったため、写しだけが孤立し、
 * 今日の予定に無い＝自分で選んだ分（todayListPickedIds）として並んでしまっていた。
 *
 * 対象は fromPlan の印が付いた品だけ＝自動取り込みで入った写しだけを片付ける。
 * 自分でレシピ一覧から足した品（印なし）は、今日の予定に無くても残す（消したのは予定であって、
 * 自分で選んだ「今日つくるもの」ではないため）。印は自動取り込みのときだけ付く（db/todayList.ts）。
 */
export function staleTodayListFromPlanIds(
  todayListItems: { recipeId: number; fromPlan?: boolean }[],
  todayPlanRecipeIds: number[],
): number[] {
  return todayListItems
    .filter((item) => item.fromPlan === true && !todayPlanRecipeIds.includes(item.recipeId))
    .map((item) => item.recipeId)
}

/**
 * レシピの「料理の種別」を4区分（主菜・副菜・汁物・その他）で確定させる（2026-08-03 便DH）。
 * 登録済みの dishType を最優先で使い、未設定のレシピ（主にユーザー自作）は
 * 新規登録時の初期値提案と同じ推定（logic/dishTypeGuess.ts）に倒す。
 *
 * 献立の「今日なに作る？」の種別しぼりが使う。4つのチップが**互いに重ならない**ことが
 * 前提の表示なので、主菜だけ別判定（isMainDish）にせず、4区分すべてをこの1関数で決める。
 * 同梱の基本レシピは全品 dishType を持つため、既定（主菜のみON）の見え方は変わらない。
 */
export function recipeDishType(r: Recipe): DishType {
  return r.dishType ?? guessDishType(r)
}

/**
 * レシピを献立の行の役割（主菜/副菜/汁物/その他）に置き換える（2026-08-11 便FP）。
 *
 * 直したバグ: レシピ詳細の「今日の献立に追加」で朝食/昼食/夕食を選んで入れた品が、
 * 料理の種別にかかわらず**すべて主菜の行**になっていた（週タブで「ほうれん草のおひたし」も
 * 「豆腐とわかめの味噌汁」も主菜と表示された）。役割を呼び出し側で 'main' に決め打ちしていた
 * のが原因で、レシピ側の「料理の種別」を見ていなかった。
 *
 * 種別（DishType）と役割（MealRole）は区分名も並びも同じにしてあり、違うのは
 * 種別の「その他（おやつ・ご飯のお供など）」が dessert という名前を持つ1点だけなので、
 * ここで役割側の 'other' に読み替える。
 * 未設定のレシピは recipeDishType と同じく登録時の初期値提案（dishTypeGuess）に倒す。
 */
export function mealRoleForRecipe(r: Recipe): MealRole {
  const dishType = recipeDishType(r)
  return dishType === 'dessert' ? 'other' : dishType
}

/** planRoleAssign の結果（呼び出し側はこれを見て DB 操作を1つだけ行う） */
export type RoleAssignPlan =
  | { kind: 'duplicate' }
  | { kind: 'replace'; entryId: number }
  | { kind: 'add' }

/**
 * 「その日×その食事に、この料理をこの役割で入れる」ときに何をするかを決める純関数
 * （2026-07-29 便CB-1。便CDで見つかった不具合の再発防止）。
 *
 * 直った不具合: 日タブの「今日の献立と今週の予定が食い違っています」の食事ボタンが、
 * 料理の種類にかかわらず「その枠の主菜を置き換える」処理（旧 db/mealPlan.ts setMainMeal）を
 * 呼んでいた。そのため副菜（きんぴら等）を押すと、その日の夕食の主菜（肉じゃが）が
 * 副菜に置き換わって消えていた。役割（主菜/副菜）の粒度を守るのがこの関数の責任:
 *  - 主菜の料理 … その枠の主菜があれば差し替え、無ければ追加（従来の主菜の挙動）
 *  - 副菜の料理 … 既存の主菜・副菜には触らず追加する（消さない＝非破壊）
 *  - 同じ料理が既にその枠にある … 何もしない（同じ料理を2行に増やさない）
 * role未設定の既存データは主菜として扱う（2026-07-13の後方互換ルールを踏襲）。
 */
export function planRoleAssign(
  slotEntries: Pick<MealPlanEntry, 'id' | 'recipeId' | 'role'>[],
  recipeId: number,
  role: MealRole,
): RoleAssignPlan {
  if (slotEntries.some((e) => e.recipeId === recipeId)) return { kind: 'duplicate' }
  if (role === 'main') {
    const existingMain = slotEntries.find((e) => (e.role ?? 'main') === 'main')
    if (existingMain?.id != null) return { kind: 'replace', entryId: existingMain.id }
  }
  return { kind: 'add' }
}

/**
 * 週ビューの「作った見た目」対応付け（2026-07-24 便BH-3・タスク2）。
 * ある日付の献立エントリ群を、その日の「作った記録」の件数だけ「作った枠」に対応付ける
 * （表示専用・非破壊。エントリ自体は消さない）。同名（同一レシピ）が複数枠にあるとき、
 * 記録の件数ぶんだけ枠順（朝→昼→夕・主菜→副菜・id昇順）に先着で消費する
 * （1回だけ作った品が2枠に予定されていても、片方だけを作った見た目にする＝「同名複数に注意」）。
 * @param dayEntries その日の全エントリ
 * @param cookedCounts recipeId → その日の「作った記録」件数
 * @returns 作った見た目にするエントリidの集合
 */
export function cookedPlanEntryIds(
  dayEntries: Pick<MealPlanEntry, 'id' | 'slot' | 'role' | 'recipeId'>[],
  cookedCounts: Map<number, number>,
): Set<number> {
  const remaining = new Map(cookedCounts)
  const slotRank = (slot: MealSlot) => MEAL_SLOTS.indexOf(slot)
  const roleRank = (role: MealRole | undefined) => MEAL_ROLES.indexOf(role ?? 'main')
  const ordered = [...dayEntries].sort(
    (a, b) =>
      slotRank(a.slot) - slotRank(b.slot) ||
      roleRank(a.role) - roleRank(b.role) ||
      (a.id ?? 0) - (b.id ?? 0),
  )
  const cooked = new Set<number>()
  for (const e of ordered) {
    if (e.id == null) continue
    const left = remaining.get(e.recipeId) ?? 0
    if (left > 0) {
      cooked.add(e.id)
      remaining.set(e.recipeId, left - 1)
    }
  }
  return cooked
}

/**
 * 献立エントリ群がカバーする「食事の回数」（=食数。2026-07-24 便BH-3・タスク8/9）。
 * 同じ日×枠は主菜+副菜が並んでも1食として数える（1回の食事＝1食分）。概算食費・期間の食費に
 * 「◯食分」を併記するのに使う。
 */
export function mealOccasionCount(entries: Pick<MealPlanEntry, 'date' | 'slot'>[]): number {
  return new Set(entries.map((e) => `${e.date}|${e.slot}`)).size
}
