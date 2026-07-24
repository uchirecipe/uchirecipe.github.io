import { matchNutritionFood } from './nutrition'
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
 * 食材名を大分類グループへ自動振り分けする。
 * ① matchNutritionFood で栄養食品に名寄せ→そのlabelのグループ（栄養DBの分類が最優先）
 * ② 名寄せできなければキーワードによる控えめなフォールバック（総称語の救済）
 * ③ どちらも外れたら 'other'（その他）
 */
export function categorizePantryName(name: string): PantryGroupKey {
  const food = matchNutritionFood(name)
  if (food) {
    const byFood = LABEL_TO_GROUP.get(food.label)
    if (byFood) return byFood
  }
  return keywordGroup(name) ?? 'other'
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
