import { matchNutritionFood } from './nutrition'
import { toPantryKey } from './kana'
import type { PantryGroupKey, PantryItem } from '../db/types'

/**
 * 在庫チップの大分類グループ（2026-07-23 オーナー実機FB #1）。
 *
 * 【分類の情報源】栄養データベース scripts/nutrition-foods.mjs のセクション分類
 * （// ==== 野菜 ====・肉・魚介・調味料 …）を、アプリの在庫チップ向けに6グループへ寄せたもの。
 * 食材名は matchNutritionFood で栄養食品に名寄せ（表記ゆれ・部分一致に強い）し、
 * その食品の label からグループを引く。名寄せできない未知の食材は 'other'（その他）。
 *
 * 新しい食品が nutrition-foods.mjs に追加されたら GROUP_LABELS にも足すこと
 * （scripts/test-logic.mjs のカバレッジテストが、未登録のlabelがあれば検知する）。
 */

/** グループの表示順（通常表示で上からこの順に並べる。空グループは出さない） */
export const PANTRY_GROUP_ORDER: PantryGroupKey[] = [
  'meatFish',
  'vegetable',
  'soyEgg',
  'staple',
  'seasoning',
  'other',
]

/**
 * 買い物メモの売り場順（一般的なスーパーの導線: 野菜・きのこ→肉・魚介→豆腐・卵・乳→
 * 主食・粉→調味料→その他。2026-07-24 実機FB #11）。
 * 在庫チップの分類（categorizePantryName）をそのまま流用し、並び順だけ買い物向けに
 * 組み替える。在庫ボードの表示順（PANTRY_GROUP_ORDER＝肉・魚介が先頭）とは意図的に別物。
 */
export const SHOPPING_AISLE_ORDER: PantryGroupKey[] = [
  'vegetable',
  'meatFish',
  'soyEgg',
  'staple',
  'seasoning',
  'other',
]

/**
 * 設定に保存した売り場順（Settings.shoppingAisleOrder・2026-08-02 便CT/C15）を、
 * 必ず6グループ揃った並びに整えて返す純ロジック。
 * 店の回り方は家庭ごとに違うので順番だけ入れ替えられるようにしたが、保存値には
 * ①未設定 ②将来グループが増減したときの欠け・余り ③壊れた値、が混ざりうる。
 * 保存済みの並び（db/settings.ts の sanitizeHomeWidgets）と同じ考え方で、
 * 知らないキーは黙って捨て、足りないキーは既定順（SHOPPING_AISLE_ORDER）の並びで末尾に補う。
 * 重複したキーは最初の1つだけ残す（同じグループが2回並ぶと整列が不定になるため）。
 */
export function normalizeAisleOrder(saved: readonly PantryGroupKey[] | undefined): PantryGroupKey[] {
  if (!saved || saved.length === 0) return [...SHOPPING_AISLE_ORDER]
  const known = new Set<PantryGroupKey>(SHOPPING_AISLE_ORDER)
  const seen = new Set<PantryGroupKey>()
  const order: PantryGroupKey[] = []
  for (const key of saved) {
    if (!known.has(key) || seen.has(key)) continue
    seen.add(key)
    order.push(key)
  }
  for (const key of SHOPPING_AISLE_ORDER) {
    if (!seen.has(key)) order.push(key)
  }
  return order
}

/**
 * 売り場順の1グループを上（-1）／下（+1）へ1つ動かした並びを返す純ロジック。
 * 端で押しても並びは変えない（呼び出し側のボタンもdisabledにする）。
 * 「上下の入れ替え」方式で並びを変える。
 */
export function moveAisleGroup(
  order: readonly PantryGroupKey[],
  index: number,
  direction: -1 | 1,
): PantryGroupKey[] {
  const target = index + direction
  if (index < 0 || index >= order.length || target < 0 || target >= order.length) return [...order]
  const next = [...order]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

/** 保存済みの売り場順が既定（SHOPPING_AISLE_ORDER）と同じかどうか（「既定に戻す」の出し分け用） */
export function isDefaultAisleOrder(order: readonly PantryGroupKey[] | undefined): boolean {
  const normalized = normalizeAisleOrder(order)
  return normalized.every((key, index) => key === SHOPPING_AISLE_ORDER[index])
}

/**
 * グループ → そのグループに属する栄養食品の label 一覧。
 * label は src/logic/nutritionData.ts（= scripts/nutrition-foods.mjs）の表示名そのまま。
 */
const GROUP_LABELS: Record<PantryGroupKey, string[]> = {
  // 肉・魚介（nutrition-foods の「肉」「魚介」セクション + 後日追加のたこ・あさり水煮缶）
  meatFish: [
    '鶏もも肉', '鶏むね肉', '鶏ささみ', '鶏ひき肉', '手羽先', '手羽元',
    '豚ひき肉', '牛ひき肉', '合いびき肉', '豚こま切れ肉', '豚バラ肉', '豚ロース肉',
    '牛こま切れ肉', '牛バラ肉', 'ハム', 'ベーコン', 'ウインナー',
    '鮭', 'さば', 'たら', 'さわら', 'ぶり', 'さんま', 'えび', 'いか', 'あさり', 'ほたて',
    'サバ水煮缶', 'ツナ缶（油漬け）', 'ツナ缶（水煮）', 'しらす', 'かつお節',
    'かまぼこ', 'ちくわ', 'はんぺん', 'さつま揚げ', 'たこ', 'あさり水煮缶',
    // 2026-08-23 便KF
    '塩鮭',
  ],
  // 野菜・きのこ（「野菜」「きのこ」セクション + なめこ・三つ葉・切り干し大根・とうもろこし・赤パプリカ・トマト缶）
  vegetable: [
    '玉ねぎ', 'じゃがいも', 'にんじん', 'キャベツ', '大根', '白菜', '長ねぎ', '青ねぎ', '小ねぎ',
    'しょうが', 'にんにく', 'ピーマン', 'トマト', 'ミニトマト', 'きゅうり', 'なす', 'かぼちゃ',
    'ごぼう', 'れんこん', 'もやし', '豆もやし', 'ブロッコリー', 'ほうれん草', '小松菜', '水菜',
    'チンゲン菜', 'ニラ', 'レタス', 'サニーレタス', 'セロリ', 'アスパラガス', 'いんげん', '絹さや',
    'グリーンピース', 'オクラ', 'ゴーヤ', 'かぶ', 'ズッキーニ', '大葉', 'みょうが', 'パセリ',
    '赤唐辛子', 'コーン缶', '枝豆', 'さつまいも', '里芋', '長いも',
    'しいたけ', '干ししいたけ', 'しめじ', 'えのき', 'まいたけ', 'エリンギ',
    'なめこ', '三つ葉', '切り干し大根', 'とうもろこし', '赤パプリカ', 'トマト缶',
  ],
  // 豆腐・卵・乳（「卵・乳・大豆製品」セクションの大豆製品・卵・乳 + きな粉・蒸し大豆・高野豆腐・豆乳）
  soyEgg: [
    '卵', '牛乳', '生クリーム', 'ヨーグルト', 'チーズ', 'バター',
    '木綿豆腐', '絹ごし豆腐', '油揚げ', '生おから', '厚揚げ', '納豆',
    'きな粉', '蒸し大豆', '高野豆腐', '豆乳',
    // 2026-08-23 便KF
    '大豆（水煮）',
  ],
  // 主食・粉（「ご飯・パン・麺・粉」セクション + グラノーラ）
  staple: [
    'ご飯', '米', '食パン', 'ロールパン', '小麦粉', '強力粉', '片栗粉', 'パン粉',
    'うどん', 'そうめん', '中華麺', '焼きそば麺', 'スパゲッティ', '餃子の皮', '春雨',
    'オートミール', 'グラノーラ',
  ],
  // 調味料（「調味料」セクション + 油脂・だし・ごま類 + レモン汁/すだち等の酸味・後日追加の各種ジャン）
  seasoning: [
    'しょうゆ', '薄口しょうゆ', '味噌', '白味噌', '赤味噌', '砂糖', '塩', '酒', 'みりん',
    'みりん風調味料', '酢', '米酢', 'サラダ油', 'ごま油', 'オリーブオイル', 'ケチャップ',
    'マヨネーズ', 'ウスターソース', '中濃ソース', 'オイスターソース', 'ポン酢',
    'めんつゆ（ストレート）', 'めんつゆ（2倍濃縮）', 'めんつゆ（3倍濃縮）',
    '和風だしの素', '鶏がらスープの素', 'コンソメ', 'だし汁', 'カレールー', 'ハヤシライスルー',
    'カレー粉', 'こしょう', '黒こしょう', 'おろししょうが（チューブ）', 'おろしにんにく（チューブ）',
    'はちみつ', 'こしあん', '粉寒天', 'いりごま', '練りごま',
    'レモン汁', 'すだち', 'メープルシロップ', 'ラー油', '甜麺醤', '粉山椒', '豆板醤', '黒みつ',
    'シチュールー', 'アーモンドエッセンス', '乾燥ハーブ', 'パプリカ(粉)', 'コチュジャン',
    // 2026-08-23 便KF
    '白だし', 'ワインビネガー',
    // 2026-08-25 便KL
    '減塩しょうゆ', '減塩みそ',
  ],
  // その他（「海藻・乾物」「果物」セクション + こんにゃく類。名寄せできない未知の食材もここ）
  other: [
    '乾燥わかめ', '青のり', '焼きのり', '昆布', '塩昆布', 'ひじき',
    '梅干し', 'バナナ', 'りんご', 'みかん缶', 'いちご', 'キウイ', 'ブルーベリー',
    'こんにゃく', 'しらたき',
  ],
}

/** label → グループ の逆引き（モジュール読み込み時に一度だけ構築） */
const LABEL_TO_GROUP: Map<string, PantryGroupKey> = (() => {
  const map = new Map<string, PantryGroupKey>()
  for (const key of PANTRY_GROUP_ORDER) {
    for (const label of GROUP_LABELS[key]) map.set(label, key)
  }
  return map
})()

/** テスト（カバレッジ確認）用に、分類済みの全labelを返す */
export function categorizedFoodLabels(): Set<string> {
  return new Set(LABEL_TO_GROUP.keys())
}

/**
 * 栄養DBに名寄せできない一般的な食材名（「豚肉」「鶏肉」「魚」など、栄養DBは部位別で
 * 総称を持たない）向けの、キーワードによる控えめなフォールバック分類。
 * matchNutritionFood が外れたときだけ使う（名寄せできたものは栄養DBの分類が優先）。
 */
function keywordGroup(name: string): PantryGroupKey | null {
  if (/肉|豚|鶏|牛|ひき|ミンチ|ハム|ベーコン|ソーセージ|ウインナー/.test(name)) return 'meatFish'
  if (/魚|鮭|さけ|さば|まぐろ|マグロ|ツナ|えび|いか|たこ|貝|しらす|ちくわ|かまぼこ|干物/.test(name)) return 'meatFish'
  if (/豆腐|納豆|厚揚げ|油揚げ|卵|たまご|チーズ|ヨーグルト|牛乳|豆乳|大豆/.test(name)) return 'soyEgg'
  if (/野菜|きのこ|茸/.test(name)) return 'vegetable'
  if (/ご飯|ごはん|米|パン|麺|めん|うどん|そば|パスタ|そうめん|粉/.test(name)) return 'staple'
  if (/油|だし|しょうゆ|醤油|みそ|味噌|塩|砂糖|酢|ソース|たれ|ケチャップ|マヨ|スパイス|こしょう|胡椒|香辛料/.test(name)) return 'seasoning'
  return null
}

/**
 * かな書きの総称語（2026-07-29 便CC/C4。QA S3）。
 * 栄養DBは部位別（鶏もも肉…）で総称を持たず、keywordGroup の正規表現は漢字前提のため、
 * かなで入力・保存された総称語がどちらにも当たらず「その他」に落ちていた
 * （実測: 買い物メモに「とりにく」と手入力すると肉売り場に並ばない）。
 * 部分一致にすると「にんにく」が肉になってしまうので、キーの**完全一致**だけで引く。
 */
const KANA_GENERIC_GROUP: Record<string, PantryGroupKey> = {
  とりにく: 'meatFish',
  ぶたにく: 'meatFish',
  ぎゅうにく: 'meatFish',
  ひきにく: 'meatFish',
  あいびきにく: 'meatFish',
  さかな: 'meatFish',
  やさい: 'vegetable',
  きのこ: 'vegetable',
  とうふ: 'soyEgg',
  たまご: 'soyEgg',
  ぎゅうにゅう: 'soyEgg',
  こめ: 'staple',
  ごはん: 'staple',
  しょうゆ: 'seasoning',
  みそ: 'seasoning',
  さとう: 'seasoning',
  しお: 'seasoning',
  あぶら: 'seasoning',
}

/**
 * 食材名を大分類グループへ自動振り分けする。
 * ① matchNutritionFood で栄養食品に名寄せ→そのlabelのグループ（栄養DBの分類が最優先）
 * ② 名寄せできなければキーワードによる控えめなフォールバック（総称語の救済）
 * ③ かな書きの総称語は専用の表から完全一致で引く（②の正規表現が漢字前提のため）
 * ④ どれも外れたら 'other'（その他）
 */
export function categorizePantryName(name: string): PantryGroupKey {
  const food = matchNutritionFood(name)
  if (food) {
    const byFood = LABEL_TO_GROUP.get(food.label)
    if (byFood) return byFood
  }
  return keywordGroup(name) ?? KANA_GENERIC_GROUP[toPantryKey(name)] ?? 'other'
}

/**
 * 在庫チップの総称語（「豚肉」「鶏肉」「豆腐」…）と、具体名の材料名を結びつける表
 * （2026-07-29 便CC/C3・C4）。
 *
 * 初期プリセットの「豚肉」「鶏肉」チップは、同梱103品の肉材料がほぼ部位名（豚こま切れ肉・
 * 鶏もも肉…）のため「作った！」の在庫反映で一度も減らなかった（QA実測: 一致0件）。
 * 一方で単純な部分一致に戻すと「ねぎ」チップが玉ねぎで減るような誤爆が復活するので、
 * 総称として扱う語を明示し、次の3条件をすべて満たすときだけ成立させる:
 *   ① 在庫チップ名がこの表の総称語であること
 *   ② 材料側が栄養DBの食品に名寄せでき、その食品が総称と同じグループであること
 *      （これで「鶏がらスープの素」のような調味料の巻き添えを防ぐ）
 *   ③ pattern に当たり、except（別物として扱う例外）に当たらないこと
 */
const GENERIC_PANTRY_CHIPS: Record<
  string,
  { group: PantryGroupKey; pattern: RegExp; except?: RegExp }
> = {
  ぶたにく: { group: 'meatFish', pattern: /豚|ぶた|ポーク/ },
  とりにく: { group: 'meatFish', pattern: /鶏|とり|チキン/ },
  ぎゅうにく: { group: 'meatFish', pattern: /牛|ぎゅう|ビーフ/ },
  ひきにく: { group: 'meatFish', pattern: /ひき肉|挽き肉|ミンチ/ },
  // 「高野豆腐（凍り豆腐）」は乾物で用途も別物なので、豆腐の在庫とは結びつけない
  とうふ: { group: 'soyEgg', pattern: /豆腐/, except: /高野豆腐|凍り豆腐/ },
}

/** 在庫チップが総称語で、材料名がその総称に収まる具体名かどうか（上のコメント参照） */
export function matchesGenericPantryChip(chipKey: string, ingredientName: string): boolean {
  const generic = GENERIC_PANTRY_CHIPS[chipKey]
  if (!generic) return false
  const food = matchNutritionFood(ingredientName)
  if (!food || LABEL_TO_GROUP.get(food.label) !== generic.group) return false
  if (generic.except?.test(ingredientName) || generic.except?.test(food.label)) return false
  return generic.pattern.test(ingredientName) || generic.pattern.test(food.label)
}

/** 在庫チップの実効グループ: 手動指定（group）があればそれ、無ければ名前から自動判定 */
export function resolvePantryGroup(item: Pick<PantryItem, 'name' | 'group'>): PantryGroupKey {
  return item.group ?? categorizePantryName(item.name)
}

/**
 * 在庫チップをグループごとにまとめる（表示順はPANTRY_GROUP_ORDER、各グループ内は元の並び順を維持）。
 * 空のグループは返さない。
 */
export function groupPantryItems<T extends Pick<PantryItem, 'name' | 'group'>>(
  items: T[],
): { key: PantryGroupKey; items: T[] }[] {
  const buckets = new Map<PantryGroupKey, T[]>()
  for (const item of items) {
    const key = resolvePantryGroup(item)
    const list = buckets.get(key)
    if (list) list.push(item)
    else buckets.set(key, [item])
  }
  return PANTRY_GROUP_ORDER.filter((key) => buckets.has(key)).map((key) => ({
    key,
    items: buckets.get(key)!,
  }))
}
