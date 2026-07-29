import { hasNgIngredient } from './ng'
import { cookedWithinDays } from './cooked'
import { currentSeason } from './season'
import { pickIconKey } from './icon'
import { pickMainIngredients } from './mainIngredients'
import type { DishType, IconKey, MealPlanEntry, MealRole, MealSlot, Recipe, Season } from '../db/types'

export const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'] as const

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

/** 「高たんぱく優先」トグルが参照するタグ（sets/kintore.ts等で実際に使われている） */
const HIGH_PROTEIN_TAG = '高たんぱく'

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
  /** 「高たんぱく」タグの品を優先するか（任意・無ければ他も許可） */
  preferHighProtein?: boolean
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
 * レシピが主菜候補か（外部公開版・2026-07-23 便BH-2）。ホームの「今日なに作る?」の
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
 * 「たんぱく源の分散」「高たんぱく優先」の順で優先度を絞り込み（いずれも該当が無ければ
 * 絞り込み前に戻す＝0件にはしない）、
 * 続けて「昨日の週プランに入っていたレシピを除外」（2026-07-16 便W-⑤b・こちらも
 * 除外して尽きれば解除）、その中で「最近作ってない」「週内で重複しない」の順にも絞り込む。
 * 候補が無くなったら段階的に条件を緩めて必ず何か返す（季節外しか無い場合を除き0件にはしない）。
 */
export function suggestForSlot(recipes: Recipe[], options: SuggestOptions): Recipe | undefined {
  const season = options.season ?? currentSeason()
  const base = recipes.filter((r) => {
    // 季節外（例: 8月に冬タグのシチュー）は提案しない。通年・未設定は常に対象
    if (r.season && r.season !== 'all' && r.season !== season) return false
    // ハード除外（同じ枠の主菜と副菜に同じ料理を入れない。便CD/MP-09）
    if (r.id != null && options.excludeRecipeIds?.includes(r.id)) return false
    if (options.excludeNg && hasNgIngredient(r, options.ngIngredients)) return false
    if (options.quickOnly && !(r.cookMinutes != null && r.cookMinutes > 0 && r.cookMinutes <= 15))
      return false
    return true
  })
  if (base.length === 0) return undefined

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
  } else if (options.role === 'side') {
    const sides = slotPool.filter((r) => isSideCandidate(r))
    rolePool = sides.length > 0 ? sides : withoutDessert()
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

  // 高たんぱく優先
  let proteinPool = proteinSourcePool
  if (options.preferHighProtein) {
    const matched = proteinSourcePool.filter((r) => r.tags.includes(HIGH_PROTEIN_TAG))
    if (matched.length > 0) proteinPool = matched
  }

  // 「昨日の週プランに入っていたレシピ」を除外（2026-07-16 便W-⑤b。直近の繰り返し防止。
  // 除外して候補が尽きる場合はexcludeYesterdayPlanRecipes内部で自動的に解除される）
  const yesterdayFiltered = options.yesterdayRecipeIds
    ? excludeYesterdayPlanRecipes(proteinPool, options.yesterdayRecipeIds)
    : proteinPool

  const notUsedThisWeek = yesterdayFiltered.filter((r) => !options.usedRecipeIds.includes(r.id!))
  const freshAndUnused = notUsedThisWeek.filter((r) => !cookedWithinDays(r, 14))

  const pool =
    freshAndUnused.length > 0
      ? freshAndUnused
      : notUsedThisWeek.length > 0
        ? notUsedThisWeek
        : yesterdayFiltered
  return pool[Math.floor(Math.random() * pool.length)]
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
  /** 埋め直す役割に残っている「自動提案由来」エントリのid（削除してから提案し直す） */
  autoEntryIdsToRemove: number[]
  /** 重複回避で used とみなす recipeId（対象外の枠＋残す手動役割の中身）。提案の同一週内重複を避ける */
  usedRecipeIds: number[]
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
 */
export function planWeekFill(
  entries: MealPlanEntry[],
  weekDatesArr: string[],
  visibleSlots: MealSlot[],
  today: string,
): FillWeekPlan {
  const futureDates = weekDatesArr.filter((date) => !isPastDate(date, today))
  const touchedKeys = new Set(
    futureDates.flatMap((date) => visibleSlots.map((slot) => `${date}|${slot}`)),
  )

  const slotsToFill: { date: string; slot: MealSlot }[] = []
  const partialFills: { date: string; slot: MealSlot; fillRole: MealRole }[] = []
  const preservedSlotKeys = new Set<string>()
  const autoEntryIdsToRemove: number[] = []
  const usedRecipeIds: number[] = []

  // 対象外の枠（過去日・非表示帯）のレシピは触らない＝重複回避のusedに入れるだけ
  for (const e of entries) {
    if (!touchedKeys.has(`${e.date}|${e.slot}`)) usedRecipeIds.push(e.recipeId)
  }

  // 対象枠を役割（main/side）単位で仕分ける
  const roles: MealRole[] = ['main', 'side']
  for (const date of futureDates) {
    for (const slot of visibleSlots) {
      const slotEntries = entries.filter((e) => e.date === date && e.slot === slot)
      let hasManualAnything = false
      const fillable: Record<MealRole, boolean> = { main: false, side: false }
      for (const role of roles) {
        const roleEntries = slotEntries.filter((e) => (e.role ?? 'main') === role)
        const hasManual = roleEntries.some((e) => !e.auto)
        if (hasManual) {
          // 手動で埋まっている役割: 同役割のエントリ（手動+自動とも）を残し、重複回避のusedに入れる
          hasManualAnything = true
          for (const e of roleEntries) usedRecipeIds.push(e.recipeId)
        } else {
          // 空 or 自動提案由来だけの役割 = 埋め対象。自動行は削除してから提案し直す（再抽選）
          fillable[role] = true
          for (const e of roleEntries) if (e.auto && e.id != null) autoEntryIdsToRemove.push(e.id)
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

  return { slotsToFill, partialFills, preservedSlotKeys, autoEntryIdsToRemove, usedRecipeIds }
}

/**
 * 「今日の献立」（todayList）と週間プランの今日の枠が食い違っているレシピIDを返す。
 * 週プランの今日の枠が1件も無いとき（＝週プランを使っていない）は食い違い扱いにしない
 * （毎回警告が出て煩わしくなるのを防ぐため）。同期はしない設計を維持し、
 * この結果はあくまで「気づかせる」表示にのみ使う。
 */
export function todayPlanMismatch(todayListIds: number[], todayPlanRecipeIds: number[]): number[] {
  if (todayPlanRecipeIds.length === 0) return []
  return todayListIds.filter((id) => !todayPlanRecipeIds.includes(id))
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
  const roleRank = (role: MealRole | undefined) => ((role ?? 'main') === 'main' ? 0 : 1)
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
