import { stripIngredientNoise, toIngredientKey, toPantryKey } from './kana'
import { isSeasoningLike } from './mainIngredients'
import {
  formatAmountUnit,
  formatScaledAmount,
  normalizeAmountInput,
  parseAmountNumber,
  resolveCalcAmount,
} from './amount'
import { categorizePantryName, normalizeAisleOrder } from './pantryGroups'
import { normalizeUnit, normalizeUnitText } from './unitGrams'
import { shiftDate } from './mealPlan'
import { convertToGrams, matchNutritionFood } from './nutrition'
import { ja } from '../i18n/ja'
import type { Ingredient, MealSlot, PantryGroupKey, ShoppingItemSource } from '../db/types'

/**
 * 買い物メモを売り場順に自動整列する（2026-07-24 実機FB #11）。
 * 食材名から在庫グループを判定し（pantryGroups の分類を流用）、売り場順に並べる。
 * 同じグループ内は元の並び（＝既存の追加順）を保つ安定ソート。
 * 表示専用で、DBの保存順（order）は書き換えない。
 *
 * 2026-08-02 便CT/C15: 売り場の回り方は店ごと・家庭ごとに違うので、設定で並び順を
 * 入れ替えられるようにした。order を省略すると従来どおりの既定順（SHOPPING_AISLE_ORDER＝
 * 野菜・きのこ→肉・魚介→…）で並ぶ。渡された並びは normalizeAisleOrder で必ず6グループに
 * 整えてから使うので、保存値が欠けていても未知のキーが混ざっていても整列は壊れない。
 */
export function sortShoppingByAisle<T extends { name: string }>(
  items: T[],
  order?: readonly PantryGroupKey[],
): T[] {
  const rank = new Map(normalizeAisleOrder(order).map((key, index) => [key, index]))
  return items
    .map((item, index) => ({ item, index, group: categorizePantryName(item.name) }))
    .sort((a, b) => (rank.get(a.group)! - rank.get(b.group)!) || a.index - b.index)
    .map((entry) => entry.item)
}

/**
 * 買い物メモを売り場のグループごとのブロックに分ける
 * （2026-08-08 オーナー実機フィードバック①「売り場順ごとに食材をブロック分けして表示して。
 * たくさんの食材が羅列していて見づらい」）。
 *
 * 並びの規則は sortShoppingByAisle と同じ（設定の売り場順→normalizeAisleOrder→
 * グループ内は元の並び）で、平らな1本の配列を見出しつきの塊に切り直すだけ。
 * つまり groupShoppingByAisle(...).flatMap(g => g.items) は sortShoppingByAisle(...) と一致する
 * （並べ替えの既存挙動を変えないための取り決め。scripts/test-logic.mjs で固定してある）。
 * 中身が0件のグループは返さない（空の見出しを画面に出さないため）。
 * チェック済みの行も元のグループに残す（買ったものが別枠へ飛んで位置を見失わないようにする）。
 */
export function groupShoppingByAisle<T extends { name: string }>(
  items: T[],
  order?: readonly PantryGroupKey[],
): { key: PantryGroupKey; items: T[] }[] {
  const buckets = new Map<PantryGroupKey, T[]>()
  for (const item of items) {
    const key = categorizePantryName(item.name)
    const list = buckets.get(key)
    if (list) list.push(item)
    else buckets.set(key, [item])
  }
  return normalizeAisleOrder(order)
    .filter((key) => buckets.has(key))
    .map((key) => ({ key, items: buckets.get(key)! }))
}

/* ============================================================
   炊いたごはん → 生米のグラム換算（2026-08-08 オーナー実機フィードバック）

   オーナー原文: 「ご飯はお米換算（g）にして欲しい」

   レシピの材料欄は「ご飯 2杯」のように**炊きあがった重さ**で書く。そのまま買い物メモへ
   出すと店で買えない（売っているのは生米）ので、買い物メモに入る分だけ生米のグラムへ
   置き換える。レシピ本体・栄養計算・食費計算は炊きあがりのまま（そちらは食べる量の話）。
   ============================================================ */

/**
 * 炊きあがりの重さを生米の重さに戻すときの倍率。
 *
 * 【根拠】精白米は炊飯で水を吸い、重さが約2.2倍になる。日本食品標準成分表2020年版（八訂）の
 * 「こめ ［水稲穀粒］ 精白米」（01083）と「こめ ［水稲めし］ 精白米」（01088）が同じ関係で、
 * 1合＝生米150g → 炊きあがり約330g（150×2.2）、茶碗1杯＝炊きあがり150g → 生米約68g。
 * どちらの数字も logic/nutritionData.ts の unitGrams（米「合」＝150g／ご飯「杯」＝150g）と
 * 突き合わせて検算できる。倍率だけがこの1か所にあり、量そのものは成分表から機械的に引く。
 */
export const COOKED_RICE_TO_RAW_RATIO = 2.2

/** 成分表の「ご飯」（炊いたもの）。この食品に名寄せできた材料だけを生米に置き換える */
const COOKED_RICE_FOOD_ID = '01088'

/** 置き換え後の食材名。成分表の「米」（01083）のラベルと同じ語にして、在庫・価格とも噛み合わせる */
const RAW_RICE_NAME = '米'

/**
 * 材料1行が「炊いたごはん」なら、生米のグラム表記（例:「米 70g」）に置き換える。
 *
 * 置き換えるのは、成分表で「ご飯」に名寄せでき、かつ量をグラムに換算できた行だけ。
 * 「ご飯 適量」のように量を数値にできない行は、勝手な量を作らず**そのまま返す**
 * （買う量を推測して書くより、レシピに書いてあるとおり出す方を採る）。
 * 「米 2合」のように最初から生米で書いてある行は名寄せ先が別の食品なので触らない。
 *
 * 丸めは他の材料と同じ formatScaledAmount（gは10g刻み・100g未満は5g刻み）に任せる。
 * 例: 2杯＝炊きあがり300g → 300÷2.2＝136.4g → 「米 140g」。
 * 食数スケールは、この丸めた後のグラム数に掛かる（合算する combineAmounts の規則）ので、
 * 何食分かを増やすと丸め1段ぶん（5g・10g）だけ多めに出ることがある。買う量なので多い側に
 * 寄せる方を採り、店頭で読める丸い数字を優先した。
 */
export function toRawRiceIngredient(ing: Ingredient): Ingredient {
  const food = matchNutritionFood(ing.name.trim())
  if (!food || food.id !== COOKED_RICE_FOOD_ID) return ing
  const calc = resolveCalcAmount(ing.amount, ing.unit)
  const value = calc ? calc.value : parseAmountNumber(ing.amount)
  const unit = calc ? calc.unit : ing.unit
  if (value == null || !(value > 0)) return ing
  const cookedGrams = convertToGrams(value, unit, food)
  if (cookedGrams == null || !(cookedGrams > 0)) return ing
  return {
    ...ing,
    name: RAW_RICE_NAME,
    amount: formatScaledAmount(cookedGrams / COOKED_RICE_TO_RAW_RATIO, 'g'),
    unit: 'g',
  }
}

/**
 * チェック済みの行を売り場ブロックから抜き出し、下にまとめるために切り分ける
 * （2026-08-08 オーナー実機フィードバック
 * 「買い物メモが多いと、カゴに入れた（チェックしてオレンジになった）食材の表示は邪魔になるので
 * 消したい。→スイッチで、チェックした商品をまとめてページの下方に表示し、
 * チェックしていない食材だけが上に残るようにしたい」）。
 *
 * 既定（スイッチOFF）ではこの関数を通さない＝従来どおりチェック済みも売り場ブロックに残る。
 * 抜き出したチェック済みは、抜き出す前の並び（売り場順→ブロック内の並び）をそのまま保つので、
 * groupShoppingByAisle の結果を平らにした並びの部分列になる。
 * 中身が全部チェック済みになった売り場は返さない（食材が1つも無い見出しを画面に出さないため）。
 */
export function splitCheckedShoppingItems<T extends { isChecked?: boolean }>(
  groups: readonly { key: PantryGroupKey; items: T[] }[],
): { groups: { key: PantryGroupKey; items: T[] }[]; checked: T[] } {
  const checked: T[] = []
  const rest: { key: PantryGroupKey; items: T[] }[] = []
  for (const group of groups) {
    const remaining: T[] = []
    for (const item of group.items) {
      if (item.isChecked) checked.push(item)
      else remaining.push(item)
    }
    if (remaining.length > 0) rest.push({ key: group.key, items: remaining })
  }
  return { groups: rest, checked }
}

export interface ShoppingCandidate {
  name: string
  /** 表示用にまとめた分量。単位が揃えば合計し、揃わなければ「・」で列挙する */
  amount: string
  recipeIds: number[]
  /**
   * レシピごとの内訳（2026-08-08 オーナー実機フィードバック②）。
   * recipeIds と同じ並びで、そのレシピが出した分量（指定食数で計算済み）を持つ。
   */
  sources: ShoppingItemSource[]
  /**
   * 全レシピでの使われ方が調味料的（大さじ/小さじ/単位なし/少々等）なら true。
   * true の候補は買い物候補でデフォルト未チェックになる
   */
  isSeasoningLike: boolean
}

/**
 * 買い物メモに出さない食材＝水道から出るもの（2026-08-22 便IX）。
 *
 * オーナーが実際のレシピサイトから取り込んだ31品で発覚した。クラシル「エビグラタン」は
 * マカロニをゆでるための「お湯 1000ml」まで材料に入っており、買い物メモの下書きに
 * 「お湯」が並んでいた。店で買うものではないので下書きに出さない。
 * （従来は「デフォルト未チェック」にするだけで、行そのものは並んでいた）
 *
 * **レシピの材料一覧からは消さない。** 「ゆでる湯 1000ml」は作るときに要る情報なので、
 * 落とすのは買い物メモの下書きを組み立てるこの関数の中だけにする。
 *
 * 落とす条件は**名前の完全一致だけ**（toPantryKey は括弧書きを外すので「水（分量外）」も同じ）。
 * 部分一致にすると「炭酸水」「ミネラルウォーター」「水菜」「水溶き片栗粉」「トマト水煮缶」
 * 「湯葉」まで巻き込む＝店で買うものが黙って消える。それが最悪の結果なので取らない。
 *
 * 落とさないもの:
 * - **塩・砂糖などの調味料**（ゆで塩も含む）… 切らしていれば買うため。
 * - **氷**… ロックアイスとして買う人がいるため（「氷水」は作るものなので落とす）。
 */
const NOT_FOR_SHOPPING_NAMES = new Set(
  ['水', 'お湯', '湯', 'ぬるま湯', '熱湯', '氷水', '冷水'].map(toPantryKey),
)

/** その食材名が「買いに行かないもの（水道から出るもの）」か（2026-08-22 便IX） */
export function isNotForShoppingName(name: string): boolean {
  return NOT_FOR_SHOPPING_NAMES.has(toPantryKey(name.trim()))
}

/** 買い物候補づくりの内部で扱う、1材料分の分量パーツ（scale=食数スケール、既定1） */
interface AmountPart {
  amount: string
  unit: string
  /** そのレシピの「指定食数 ÷ 登録人数」。数値化できる分量にだけ掛ける（2026-07-23 #3） */
  scale: number
}

/** 合算のために解釈し直した1パーツ（2026-07-29 便CC/C1・C11・C12） */
interface ResolvedPart {
  /** 数値化できないときや等倍1件のときに、そのまま見せる表示文字列 */
  original: string
  /** 合算のまとまりを決める単位（「大2」等の略記は「大さじ」に解決した後の単位） */
  unit: string
  /** 数値化できた分量。できなければ null（「少々」「200〜250」等） */
  value: number | null
  scale: number
}

/**
 * 1パーツを合算用に解釈する。
 * 「大2」「小1/2」のような略記と「ひとかけ」のような和語の個数詞は、レシピ詳細の人数変更
 * （scaleAmount）と同じ resolveCalcAmount で正式な単位に解決してから合算対象にする
 * （2026-07-29 便CC/C12。従来はここを通さないため単位なしのまま扱われ、食数スケールが
 * 掛からず「大2」のまま出ていた）。
 */
function resolvePart(part: AmountPart): ResolvedPart {
  const original = formatAmountUnit(normalizeAmountInput(part.amount.trim()), part.unit)
  const calc = resolveCalcAmount(part.amount, part.unit)
  if (calc) return { original, unit: calc.unit, value: calc.value, scale: part.scale }
  // 単位欄は normalizeUnitText で下ごしらえする（2026-08-23 便KE）。元ページの「100g～」が
  // 分量「100」＋単位「g～」に割れていて、同じ食材の「170g」と別枠に並んでいた
  return {
    original,
    unit: normalizeUnitText(part.unit),
    value: parseAmountNumber(part.amount),
    scale: part.scale,
  }
}

/**
 * 同じ次元（質量どうし・体積どうし）の単位を1つにまとめるための表示単位を選ぶ（2026-08-23 便KE）。
 * - 質量は g に寄せる（買い物メモは「◯g買う」で読むため。kg・mg は g に換算される）
 * - 体積は、並んでいる単位のうち **合計が1以上になるいちばん大きい単位** を選ぶ
 *   （小さじ1＋大さじ1＝20ml なら「大さじ1と1/4」。1未満にしかならなければいちばん小さい単位）
 * 個数（個・本・枚…）は次元をまたいで足せないので、この関数の対象外＝従来どおり並べて出す。
 */
function pickMergedUnit(units: string[], totalBase: number, factorOf: (unit: string) => number | null): string {
  // 質量どうし（g・kg・mg）は同じ単位の書き方ちがいなので、店頭で読む「g」に寄せて候補を1つにする
  const candidates = units.map((unit) => (normalizeUnit(1, unit)?.dim === 'mass' ? 'g' : unit))
  const factors = [...new Set(candidates)]
    .map((unit) => ({ unit, factor: factorOf(unit) }))
    .filter((u): u is { unit: string; factor: number } => u.factor != null && u.factor > 0)
    .sort((a, b) => b.factor - a.factor)
  if (factors.length === 0) return units[0]
  return (factors.find((u) => totalBase / u.factor >= 1) ?? factors[factors.length - 1]).unit
}

/**
 * 単位ごとにグループ化し、数値化できるものはグループ内で合計する
 * （例:「大さじ2」+「大さじ3」+「小さじ1」→「大さじ5と1/3」）。
 * 数値化できないもの（「少々」等）はそのまま列挙する。
 * 各パーツの scale（指定食数スケール）は数値化できる分量にのみ掛ける。
 *
 * 2026-07-29 便CC で3点修正（診断 C1・C11・C12）:
 * - 分量の数値化を amount.ts の parseAmountNumber に寄せた。従来の `Number.parseFloat` は
 *   分母を読めず `parseFloat('1/2')=1` となり、分数表記の材料が必要量の2〜4倍で出ていた（S1）。
 * - 丸めを formatScaledAmount（単位ごとの丸め幅）に寄せた。従来の小数第1位丸めでは
 *   「62.5g」「0.3箱」のような店頭で行動に移せない粒度が出ていた（C11）。
 * - 同じ単位に数値化できない分量が1つでも混ざるとグループ全体が原文列挙になり、数値側の
 *   食数スケールまで落ちていたのを、数値側と原文側を分けて両方出すようにした（C12）。
 *
 * 2026-08-23 便KE で2点追加（影響範囲テストA。36行のうち12行が「何をいくつ買えばよいか
 * 決められない」行だった）:
 * - **同じ次元の単位を足す**。`酢 小さじ1・大さじ1` `サラダ油 大さじ2・小さじ1` のように、
 *   換算できる単位どうしが別々に並んでいた（unitGrams.ts に換算表があるのに使っていなかった）。
 * - **同じ言葉は1つに畳む**。`塩コショウ 少々・少々・少々・少々・少々・少々・少々` のように
 *   同じ文字が7つ並ぶことがあり、読む人が困るだけで情報が増えていなかった。
 */
function combineAmounts(parts: AmountPart[], name?: string): string {
  const nonEmpty = parts.filter((p) => p.amount.trim() || p.unit.trim())
  if (nonEmpty.length === 0) return ''

  const groups = new Map<string, ResolvedPart[]>()
  for (const part of nonEmpty) {
    const resolved = resolvePart(part)
    const list = groups.get(resolved.unit)
    if (list) list.push(resolved)
    else groups.set(resolved.unit, [resolved])
  }

  // その食材の目安量（「1袋=200g」「1枚=150g」。成分表＝栄養側が持っている値）。
  // 単位の名前だけでは足せない組（もやし「600g」と「4と1/2袋」）を足すのに使う。
  // 新しい重さは作らず、アプリが既に持っている目安量をそのまま使う（2026-08-23 便KE）
  const food = name ? matchNutritionFood(name) : undefined
  /** その単位1つぶんが、まとまりの基準量（質量ならg・体積ならml）でいくつぶんか */
  const factorOf = (unit: string): number | null => {
    const normalized = normalizeUnit(1, unit)
    if (normalized?.dim === 'mass' || normalized?.dim === 'volume') return normalized.base
    return food ? convertToGrams(1, unit, food) : null
  }
  const dimensionKeyOf = (unit: string): string => {
    const dim = normalizeUnit(1, unit)?.dim
    if (dim === 'mass' || dim === 'volume') return `次元:${dim}`
    // 個数の単位でも、その食材の目安量（もやし1袋=200g・厚揚げ1枚=150g）があればグラムに寄せて足せる
    const grams = food ? convertToGrams(1, unit, food) : null
    return grams != null && grams > 0 ? '次元:mass' : `単位:${unit}`
  }

  // 数値化できたぶんを次元ごとにまとめ直す。足せない単位（「1個」と「1本」のように
  // 目安量が無くて比べられないもの）は単位名ごとに分けたまま並べる。
  // 出す順番は元の並び（最初に出てきた順）を保つ
  interface Bucket { units: string[]; items: ResolvedPart[] }
  const slots: ({ kind: 'bucket'; bucket: Bucket } | { kind: 'raw'; text: string })[] = []
  const bucketByKey = new Map<string, Bucket>()
  for (const [unit, items] of groups) {
    const numeric = items.filter((p) => p.value != null)
    if (numeric.length > 0) {
      const key = dimensionKeyOf(unit)
      let bucket = bucketByKey.get(key)
      if (!bucket) {
        bucket = { units: [], items: [] }
        bucketByKey.set(key, bucket)
        slots.push({ kind: 'bucket', bucket })
      }
      if (!bucket.units.includes(unit)) bucket.units.push(unit)
      bucket.items.push(...numeric)
    }
    // 「少々」など数値化できない分量は食数スケールを掛けられないので原文のまま併記する
    for (const p of items) if (p.value == null) slots.push({ kind: 'raw', text: p.original })
  }

  const texts: string[] = []
  const push = (text: string) => {
    // 同じ文字が並ぶだけの行（「少々・少々・…」）は1つに畳む
    if (!texts.includes(text)) texts.push(text)
  }
  for (const slot of slots) {
    if (slot.kind === 'raw') {
      push(slot.text)
      continue
    }
    const { units, items } = slot.bucket
    if (items.length === 1 && items[0].scale === 1) {
      // 等倍（指定食数＝レシピの登録人数）で1レシピ分だけなら、計算する必要がないので原文を
      // そのまま見せる。「1/3本」を丸めて「1/2本」にしてしまわず、レシピ詳細の表示と一致する
      push(items[0].original)
      continue
    }
    if (units.length === 1) {
      const unit = units[0]
      const total = items.reduce((sum, p) => sum + p.value! * p.scale, 0)
      push(formatAmountUnit(formatScaledAmount(total, unit), unit))
      continue
    }
    // 単位が混ざっているので、いったん基準量（g・ml）で足してから表示単位を選ぶ
    const totalBase = items.reduce(
      (sum, p) => sum + (factorOf(p.unit) ?? 0) * p.value! * p.scale,
      0,
    )
    const unit = pickMergedUnit(units, totalBase, factorOf)
    const factor = factorOf(unit) ?? 1
    push(formatAmountUnit(formatScaledAmount(totalBase / factor, unit), unit))
  }
  return texts.join('・')
}

/** 「大さじ2」のように単位が前に来る表記（formatAmountUnit と同じ並び）を切り出すための単位 */
const LEADING_UNITS = ['大さじ', '小さじ', 'カップ', 'おおさじ', 'こさじ']

/**
 * 「200g」「1/2本」「大さじ2」のような表示用の分量文字列を、分量と単位に切り分ける。
 * 買い物メモに確定した後は分量が1つの文字列にまとまっているため、重複行を合算するとき
 * （C14）に元の amount / unit へ戻す必要がある。切り分けられない文字列（「少々」等）は
 * 分量だけにして単位を空にする＝合算対象外として原文のまま扱われる。
 */
function splitAmountUnit(text: string): { amount: string; unit: string } {
  const trimmed = text.trim()
  for (const unit of LEADING_UNITS) {
    if (trimmed.startsWith(unit)) return { amount: trimmed.slice(unit.length).trim(), unit }
  }
  const match = trimmed.match(/^([0-9０-９.．/／〜~～と]+)\s*(.*)$/)
  if (match) return { amount: match[1], unit: match[2].trim() }
  return { amount: trimmed, unit: '' }
}

/**
 * 買い物メモに入っている表示用の分量文字列どうしを合算する（2026-07-29 便CC/C14）。
 * 下書きの中では同名の材料をまとめるのに、買い物メモに入れた後は同じ食材を足しても
 * 別行で並ぶだけで合算されず、売り場順で離れた位置に重複が出ていた。
 * 合算の規則は下書きと同じ（combineAmounts）で、単位が揃えば足し、揃わなければ「・」で並べる。
 */
export function combineAmountTexts(texts: (string | undefined)[]): string {
  const parts: AmountPart[] = []
  for (const text of texts) {
    for (const token of (text ?? '').split('・')) {
      if (!token.trim()) continue
      parts.push({ ...splitAmountUnit(token), scale: 1 })
    }
  }
  return combineAmounts(parts)
}

/**
 * 献立の「この週の買い物リストを作る」から渡る ?recipeIds= を解釈する（2026-07-29 便CC/C10）。
 * 「1,2,3」に加えて「1x3」（同じレシピを週に3回作る＝材料3回分）の形を受け付ける。
 * 従来はレシピIDの重複を捨てて常に1回分（scale=1固定）で計算していたため、
 * 週に何度も作る料理の材料が足りない量で下書きに出ていた。
 * 同じIDが複数回並んだ場合（旧形式で重複が残っていた場合）も回数として足し合わせる。
 */
export function parseRecipeIdsParam(raw: string): { id: number; times: number }[] {
  const counts = new Map<number, number>()
  for (const token of raw.split(',')) {
    const [idPart, timesPart] = token.split('x')
    const id = Number(idPart)
    if (!Number.isFinite(id) || !idPart.trim()) continue
    const times = Number(timesPart)
    const add = timesPart !== undefined && Number.isFinite(times) && times > 0 ? Math.floor(times) : 1
    counts.set(id, (counts.get(id) ?? 0) + add)
  }
  return [...counts].map(([id, times]) => ({ id, times }))
}

/**
 * 献立の「この週の買い物リストを作る」から渡る ?servings= を解釈する
 * （2026-08-03 便DJ・食数設定）。形は「レシピID:その週に作る食数の合計」をカンマで並べたもの
 * （例: "1:8,3:4" ＝ レシピ1を合計8人分、レシピ3を合計4人分）。
 *
 * recipeIds の「回数」だけでは、1回を何人分作るかを変えた枠を表せない
 * （2人分のレシピを4人分作る日がある、など）。回数はそのまま残し、人数の合計をこちらで渡す。
 * このパラメータが無い＝食数を触っていない古い形の呼び出しで、その場合は呼び出し側が
 * 従来どおり「回数 × レシピの登録人数」で計算する。
 *
 * 0以下・数値でない値は捨てる（分量が0や負になる計算に進ませない）。
 */
export function parseServingsParam(raw: string): Map<number, number> {
  const map = new Map<number, number>()
  for (const token of raw.split(',')) {
    const [idPart, servingsPart] = token.split(':')
    const id = Number(idPart)
    const servings = Number(servingsPart)
    if (!Number.isFinite(id) || !idPart?.trim()) continue
    if (!Number.isFinite(servings) || servings <= 0) continue
    map.set(id, (map.get(id) ?? 0) + servings)
  }
  return map
}

/* ============================================================
   買い物リストの範囲えらび（2026-08-08 便EA・オーナー要望）

   オーナー原文: 「選択した日付や時間帯レシピから買い物リスト作成したい。3日分とか、
   １週間分まとめて買い物とは限らない」

   規則:
   - 既定は「絞っていない」＝ null。表示中の週ぜんぶ・表示している食事ぜんぶで、
     従来と1gも変わらない分量を出す（選ばない人の手数を増やさない）。
   - 絞ったときだけ、選んだ日付と食事に入っている献立で集計する。
   - 献立のロック（mealPlanLocks）とは無関係。買い物は献立を読むだけで書き換えないので鍵は見ない。
   ============================================================ */

/** 買い物リストに入れる範囲。どちらも null/undefined ＝「絞っていない」 */
export interface ShoppingRange {
  /** 選んだ日付（YYYY-MM-DD）。null＝表示中の週ぜんぶ */
  dates?: readonly string[] | null
  /** 選んだ食事。null＝表示している食事ぜんぶ */
  slots?: readonly MealSlot[] | null
}

/**
 * 買い物の集計に入れる献立の枠だけを残す。
 * 表示していない食事（設定「表示する食事」で外したもの）は、絞る前から対象外なので常に落とす。
 */
export function filterShoppingEntries<T extends { date: string; slot: MealSlot }>(
  entries: readonly T[],
  visibleSlots: readonly MealSlot[],
  range?: ShoppingRange,
): T[] {
  const dates = range?.dates ? new Set(range.dates) : null
  const slots = range?.slots ? new Set(range.slots) : null
  return entries.filter(
    (e) =>
      visibleSlots.includes(e.slot) &&
      (!dates || dates.has(e.date)) &&
      (!slots || slots.has(e.slot)),
  )
}

/**
 * 「今日の献立」（今日つくるリスト）の分も買い物に足すか。
 *
 * 今日の献立には食事（朝食/昼食/夕食）の情報が無い。食事で絞ったときにこれを丸ごと足すと、
 * 選んだ範囲より多く買わせることになるので足さない。日付で絞ったときは、今日を選んで
 * いれば足す。絞っていなければ従来どおり必ず足す。
 */
export function shoppingRangeIncludesTodayList(today: string, range?: ShoppingRange): boolean {
  if (range?.slots) return false
  if (range?.dates) return range.dates.includes(today)
  return true
}

/** 範囲を絞っているか（選んだ日付・食事が、絞る前の全部と同じなら絞っていない扱い） */
export function isShoppingRangeNarrowed(
  range: ShoppingRange | undefined,
  allDates: readonly string[],
  visibleSlots: readonly MealSlot[],
): boolean {
  const narrowed = (picked: readonly string[] | null | undefined, all: readonly string[]) =>
    picked != null && !all.every((v) => picked.includes(v))
  return narrowed(range?.dates, allDates) || narrowed(range?.slots, visibleSlots)
}

/** 「8/8」の形（先頭の0を付けない。既存の日付表示と同じ見た目） */
function monthDayLabel(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(m)}/${Number(d)}`
}

/**
 * 買い物リストの範囲の日付部分を短く言い表す。
 * 連続していれば「8/8〜8/14」、飛んでいれば「8/8・8/10・8/12」。
 */
export function formatShoppingRangeDates(dates: readonly string[]): string {
  const sorted = [...new Set(dates)].sort()
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return monthDayLabel(sorted[0])
  const contiguous = sorted.every((d, i) => i === 0 || shiftDate(sorted[i - 1], 1) === d)
  return contiguous
    ? `${monthDayLabel(sorted[0])}〜${monthDayLabel(sorted[sorted.length - 1])}`
    : sorted.map(monthDayLabel).join('・')
}

/**
 * 買い物メモの下書きに添える「どの範囲から作ったか」の1行（2026-08-08 便EA）。
 * 献立から作ったときだけ渡す（レシピを手で選んで作った下書きには付けない）。
 * 対象の日付が1日も無いときは空文字＝行を出さない。
 */
export function formatShoppingRangeLabel(input: {
  /** 実際に集計した日付 */
  dates: readonly string[]
  /** 実際に集計した食事 */
  slots: readonly MealSlot[]
  /** 「今日の献立」の分も入れたか */
  includesTodayList: boolean
}): string {
  const dateText = formatShoppingRangeDates(input.dates)
  if (!dateText) return ''
  const slotText = input.slots.map((slot) => ja.mealPlan.slot[slot]).join('・')
  const base = ja.shopping.fromMealPlanRange
    .replace('{dates}', dateText)
    .replace('{slots}', slotText)
  return input.includesTodayList ? base + ja.shopping.fromMealPlanRangeToday : base
}

/**
 * 選んだレシピの材料を名前でまとめ、在庫「ある」の食材を除いた買い物候補を作る。
 * ここで作った候補はまだ買い物メモではなく、確認してから確定してもらう「下書き」。
 *
 * 各レシピは任意で scale（指定食数スケール。2026-07-23 #3「食数の+/-」方式で
 * targetServings ÷ recipe.servings を渡す）を持てる。未指定は1（＝1回分そのまま）。
 */
/**
 * 買い物メモで「同じ食材か」を見るときの照合キー（2026-08-23 便KE）。
 *
 * 【なぜ toPantryKey だけでは足りないか】影響範囲テストA（節約したい人の実データ30品）の
 * 買い物メモは113行あり、そのうち19組・のべ70行が「同じ食材なのに別の行」だった。
 * 名寄せの仕組み自体は動いていて（醤油＝しょうゆ、しょうが＝生姜は1行になっていた）、
 * 弾かれていたのは **名前に飾りが残った行** と **書き方が違うだけの行** の2種類:
 *   `★酒` `〇酒` `a. 酒` が `酒` と別行（合わせ調味料の印）
 *   `厚揚げ 二個入りの` `豚こま 約` `最後にごま油` `おろし生姜 なくてもOK` が本体と別行
 *   `ほんだし` `和風顆粒だし` `だしの素` が3行（同じ和風だしの素）
 *
 * そこで①飾りを落とし（stripIngredientNoise）、②それでも文字が違うものは
 * **成分表（栄養）の食品**に解決して、同じ食品なら同じキーにする。
 * ②は原価側が既に持っている手当て（priceEstimate.ts の matchPriceEntryViaNutritionFood）と
 * 同じ考え方で、成分表の名寄せは docs/47 で監査済み。**部分一致には寄せない**ので、
 * 在庫「豆腐」が「高野豆腐」に、「卵」が「砂糖（卵用）」に当たることは起きない
 * （どちらも成分表では別の食品に解決する＝実測で確認済み）。
 * 成分表に無い食材（豆苗・キムチ・炒め油 など）は従来どおり toPantryKey の完全一致に落ちる。
 */
/**
 * 成分表では同じ食品に解決するが、**店では別に買うもの**（2026-08-23 便KE）。
 * 成分表の別名は「栄養の値としては同じでよい」という基準で作られているので、
 * 買い物メモの名寄せにそのまま使うと売り場で別の商品どうしが1行になる。
 * 影響範囲テストA・B・Cと同梱109品の材料名435種を1件ずつ見て、実際に起きた組だけを挙げる:
 *  ・塩こしょう … 成分表に無く「塩」に解決する（食材価格マスタは別項目で持っている）
 *  ・すりごま／白すりごま … 成分表では「いりごま」の別名。売り場では擂ったものと粒のもので別
 *  ・刻みのり … 成分表では「焼きのり」の別名。売り場では別の袋
 *  ・ひき肉 … 成分表では部位の肉に寄る（鶏ももひき肉→鶏もも肉）。売り場では別のパック
 *  ・顆粒のだし … 成分表では「だし汁」に寄る（カツオだし（顆粒）→だし汁）。だし汁は作るもの
 */
const SHOP_SEPARATELY_WORDS = ['しおこしょう', 'すりごま', '刻みのり', 'ひきにく', 'ひき肉'].map(
  (word) => toPantryKey(word),
)
/** 括弧書きに入っていることが多いので、括弧を落とす前の名前で見る語 */
const SHOP_SEPARATELY_RAW_WORDS = ['顆粒', '粉末']

function isShopSeparately(key: string, cleaned: string): boolean {
  return (
    SHOP_SEPARATELY_WORDS.some((word) => key.includes(word)) ||
    SHOP_SEPARATELY_RAW_WORDS.some((word) => cleaned.includes(word))
  )
}

export function toShoppingKey(name: string): string {
  const cleaned = stripIngredientNoise(name)
  const key = toPantryKey(cleaned)
  if (isShopSeparately(key, cleaned)) return key
  const food = matchNutritionFood(cleaned) ?? matchNutritionFood(name)
  if (!food) return key
  // 成分表の食品名（正式名か別名）で**始まっている**ときだけ同じ食品として扱う。
  // 「厚揚げ 二個入りの」「豚こま 約」「おろし生姜 なくてもOK」のように但し書きが
  // 後ろに付いただけの名前を拾い、**似た別の商品まで巻き込まない**ための線引き。
  // 成分表の名寄せは「栄養の値としていちばん近い食品」を返すので、これを無条件に使うと
  // 実測（材料名435種）で「粉チーズ→ピザ用チーズ」「紅しょうが→しょうが」
  // 「一味唐辛子→赤唐辛子」「鶏ももひき肉→鶏もも肉」のように、店で別に買うものが
  // 1行にまとまってしまう（栄養としては近くても、買い物メモとしては間違い）
  const stems = [food.label, ...(food.aliases ?? [])].map(toIngredientKey)
  return stems.some((stem) => stem && key.startsWith(stem)) ? `食品:${food.id}` : key
}

/**
 * まとまった行に出す名前を選ぶ（2026-08-23 便KE）。
 * 飾りを落とした形がいちばん短いものを採る（同じ長さなら先に出てきたほう）。
 * `厚揚げ` と `厚揚げ 二個入りの` なら `厚揚げ`、`ごま油` と `最後にごま油` なら `ごま油`。
 * 利用者が書いた言葉の中から選ぶだけで、こちらで名前を作り替えることはしない。
 */
function betterShoppingName(current: string, candidate: string): string {
  const a = stripIngredientNoise(current)
  const b = stripIngredientNoise(candidate)
  return b.length < a.length ? b : a
}

export function buildShoppingCandidates(
  recipes: { id: number; ingredients: Ingredient[]; scale?: number }[],
  pantryHaveNames: string[],
): ShoppingCandidate[] {
  // 在庫との照合は買い物メモの照合キー(toShoppingKey)の完全一致に統一する
  // (2026-07-29 便CC/C4 の toPantryKey 完全一致を、2026-08-23 便KE で飾り落とし＋成分表経由に広げた)。
  // 従来の toHiragana 完全一致では「長ねぎ（白い部分）」のような括弧付きの材料名が
  // 在庫チップ「長ねぎ」と別物になり、在庫「ある」にしても候補に出続けていた
  const haveKeys = new Set(pantryHaveNames.map(toShoppingKey))
  const order: string[] = []
  const map = new Map<
    string,
    { name: string; parts: AmountPart[]; partsByRecipe: Map<number, AmountPart[]> }
  >()

  for (const recipe of recipes) {
    const scale = recipe.scale && recipe.scale > 0 ? recipe.scale : 1
    for (const raw of recipe.ingredients) {
      const rawName = raw.name.trim()
      if (!rawName) continue
      // 水・お湯のように店で買わないものは買い物メモに出さない（2026-08-22 便IX）。
      // レシピの材料一覧は触らないので、作るときに要る「ゆでる湯」の情報は残る
      if (isNotForShoppingName(rawName)) continue
      if (haveKeys.has(toShoppingKey(rawName))) continue // 在庫「ある」は候補に出さない
      // 炊いたごはんは、店で買える形＝生米のグラムに置き換えてから集計する
      // （2026-08-08 オーナー実機フィードバック。該当しない材料はそのまま返る）
      const ing = toRawRiceIngredient(raw)
      const trimmedName = ing.name.trim()
      const key = toShoppingKey(trimmedName)
      // 置き換え後の名前（米）で在庫「ある」にしてある場合も候補に出さない
      if (haveKeys.has(key)) continue

      let entry = map.get(key)
      if (!entry) {
        entry = { name: stripIngredientNoise(trimmedName), parts: [], partsByRecipe: new Map() }
        map.set(key, entry)
        order.push(key)
      } else {
        entry.name = betterShoppingName(entry.name, trimmedName)
      }
      const part = { amount: ing.amount, unit: ing.unit, scale }
      entry.parts.push(part)
      // レシピごとの内訳も同時に貯める（同じレシピが同じ材料を2行書いていたらそこで合算する）
      const own = entry.partsByRecipe.get(recipe.id)
      if (own) own.push(part)
      else entry.partsByRecipe.set(recipe.id, [part])
    }
  }

  return order.map((key) => {
    const entry = map.get(key)!
    const sources = [...entry.partsByRecipe].map(([recipeId, parts]) => ({
      recipeId,
      amount: combineAmounts(parts, entry.name),
    }))
    return {
      name: entry.name,
      amount: combineAmounts(entry.parts, entry.name),
      recipeIds: sources.map((s) => s.recipeId),
      sources,
      isSeasoningLike: entry.parts.every(isSeasoningLike),
    }
  })
}

/** 出所の小窓に出す1件（レシピ名と、そのレシピでの分量） */
export interface ShoppingSourceView {
  recipeId: number
  title: string
  /** そのレシピでの分量。分からなければ空文字 */
  amount: string
}

export interface ShoppingSourceResult {
  recipes: ShoppingSourceView[]
  /** 手で足した分が含まれるか（レシピ由来が1件も無い行もここが true になる） */
  manual: boolean
  /** 記録は残っているのに、レシピ側が見つからなかった件数（削除されたレシピ） */
  missing: number
}

/**
 * 買い物メモ・下書きの1行から「どのレシピから来たか」を組み立てる
 * （2026-08-08 オーナー実機フィードバック②）。
 *
 * 出所の持ち方は3世代ある。どれで保存された行でも同じ形に揃えて返す:
 *  ① sources（2026-08-08以降）… レシピごとの分量まで持っている。そのまま使う
 *  ② recipeIds だけ（2026-07-29〜）… レシピの並びしか無いので、分量はそのレシピの材料欄から読む
 *  ③ どちらも無い … 手入力で足した行。manual を立てる
 * ②の分量は「レシピに登録されている分量（登録人数のまま）」で、買い物メモの合計とは
 * 食数のぶんだけ違いうる。分からない分量を作文するより、レシピの値をそのまま見せる方を採る。
 *
 * 削除されたレシピ（recipeById に無いID）は一覧から落とし、件数だけ missing で返す
 * （名前が出せないものを「不明」と並べても行動に繋がらないため）。
 */
export function resolveShoppingSources(
  item: {
    name: string
    sources?: readonly ShoppingItemSource[]
    recipeIds?: readonly number[]
    manualAdded?: boolean
  },
  recipeById: ReadonlyMap<number, { title: string; ingredients: Ingredient[] }>,
): ShoppingSourceResult {
  const raw: ShoppingItemSource[] =
    item.sources && item.sources.length > 0
      ? [...item.sources]
      : [...(item.recipeIds ?? [])].map((recipeId) => ({ recipeId }))
  const key = toPantryKey(item.name)
  const recipes: ShoppingSourceView[] = []
  let missing = 0
  for (const source of raw) {
    const recipe = recipeById.get(source.recipeId)
    if (!recipe) {
      missing++
      continue
    }
    const amount = source.amount?.trim() || ingredientAmountInRecipe(recipe.ingredients, key)
    recipes.push({ recipeId: source.recipeId, title: recipe.title, amount })
  }
  return { recipes, manual: item.manualAdded === true || raw.length === 0, missing }
}

/**
 * レシピの材料欄から、その食材の分量を読む（同名が複数行あれば合算する。無ければ空文字）。
 * 買い物メモ側の行は炊いたごはんを「米」に置き換えてあるので、照合するレシピの材料も
 * 同じ置き換えを通してから名前を合わせる（2026-08-08 オーナー実機フィードバック）。
 * 置き換える前の名前で一致する行（この変更より前に「ご飯」で保存された買い物メモ）は、
 * 置き換えずレシピに書いてあるままの分量を出す＝行の見た目と小窓の中身が食い違わない。
 */
function ingredientAmountInRecipe(ingredients: Ingredient[], pantryKey: string): string {
  const parts = ingredients
    .map((ing) => (toPantryKey(ing.name.trim()) === pantryKey ? ing : toRawRiceIngredient(ing)))
    .filter((ing) => toPantryKey(ing.name.trim()) === pantryKey)
    .map((ing) => ({ amount: ing.amount, unit: ing.unit, scale: 1 }))
  return parts.length > 0 ? combineAmounts(parts) : ''
}
