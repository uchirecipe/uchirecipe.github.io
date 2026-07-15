/**
 * 食材価格マスタの初期値（公式レシピ全食材=136件の目安価格。2026-07-13に30件から拡大）。
 * 一般的なスーパーの相場を基準にした「常識的な水準」の目安であり、地域・店舗・時期で
 * 実際の価格とはズレる。ユーザーはいつでも「食材と価格」画面から書き換え・削除できる
 * （db/prices.ts の seedPriceDefaultsIfNeeded が初回起動時に1度だけ投入する）。
 *
 * unit は「数量＋単位」の自由記述（例:「100g」「1個」）。logic/priceEstimate.ts が
 * 数量として解釈できる場合（例:「100g」)のみ、レシピの分量に応じた按分計算に使う。
 * 「1/4個」のような解釈できない書式は、そのままの金額を1行分の目安として使う（按分なし）。
 */
export interface PriceDefaultItem {
  name: string
  pricePerUnit: number
  unit: string
}

export const PRICE_DEFAULTS: PriceDefaultItem[] = [
  // 野菜
  { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
  { name: 'にんじん', pricePerUnit: 40, unit: '1本' },
  { name: 'じゃがいも', pricePerUnit: 40, unit: '1個' },
  { name: 'キャベツ', pricePerUnit: 130, unit: '1/4個' },
  { name: '白菜', pricePerUnit: 150, unit: '1/4個' },
  { name: '大根', pricePerUnit: 100, unit: '1/2本' },
  { name: 'もやし', pricePerUnit: 30, unit: '1袋' },
  { name: 'きゅうり', pricePerUnit: 40, unit: '1本' },
  { name: 'トマト', pricePerUnit: 60, unit: '1個' },
  { name: 'ピーマン', pricePerUnit: 30, unit: '1個' },
  { name: 'なす', pricePerUnit: 50, unit: '1本' },
  { name: 'ねぎ', pricePerUnit: 100, unit: '1本' },
  { name: 'ほうれん草', pricePerUnit: 100, unit: '1束' },
  { name: 'しめじ', pricePerUnit: 100, unit: '1パック' },
  { name: 'えのき', pricePerUnit: 80, unit: '1袋' },
  // 肉
  { name: '鶏もも肉', pricePerUnit: 130, unit: '100g' },
  { name: '鶏むね肉', pricePerUnit: 90, unit: '100g' },
  { name: '豚バラ肉', pricePerUnit: 150, unit: '100g' },
  { name: '豚こま切れ肉', pricePerUnit: 110, unit: '100g' },
  { name: '牛こま切れ肉', pricePerUnit: 200, unit: '100g' },
  { name: '合いびき肉', pricePerUnit: 130, unit: '100g' },
  // 魚介
  { name: '鮭', pricePerUnit: 120, unit: '1切れ' },
  { name: 'さば', pricePerUnit: 100, unit: '1切れ' },
  // 卵・乳製品・豆腐
  { name: '卵', pricePerUnit: 25, unit: '1個' },
  { name: '牛乳', pricePerUnit: 200, unit: '1L' },
  { name: 'バター', pricePerUnit: 250, unit: '200g' },
  { name: '豆腐', pricePerUnit: 40, unit: '1丁' },
  // 主食・調味料
  { name: '米', pricePerUnit: 60, unit: '1合' },
  { name: 'しょうゆ', pricePerUnit: 20, unit: '大さじ1' },
  { name: 'みそ', pricePerUnit: 15, unit: '大さじ1' },

  // ============ 2026-07-13 データ整備: 基本51品+全パックの価格カバー100%対応 ============
  // 既存30件(上記)は値を変更しない(E2E PRICE-01が「玉ねぎ1個50円」に依存)。
  // 「1回のレシピで使う現実的な量」を単位にする(既存のしょうゆ/みそ=大さじ1と同じ考え方。
  // 「少々」「お好みで」等の非数値な分量は按分できず、そのままの金額が1行分の目安になる
  // (logic/priceEstimate.tsのestimateIngredientYen参照)ため、小さめの実勢価格にしてある。

  // 野菜・きのこ・薬味
  { name: 'ごぼう', pricePerUnit: 150, unit: '1本' },
  { name: 'こんにゃく', pricePerUnit: 60, unit: '1枚' },
  { name: 'しいたけ', pricePerUnit: 150, unit: '1パック' },
  { name: 'にら', pricePerUnit: 100, unit: '1束' },
  { name: 'にんにく', pricePerUnit: 60, unit: '1個' },
  { name: 'ブロッコリー', pricePerUnit: 200, unit: '1株' },
  { name: 'れんこん', pricePerUnit: 200, unit: '1節' },
  { name: '赤唐辛子', pricePerUnit: 10, unit: '1本' },
  { name: 'しょうが', pricePerUnit: 20, unit: '1かけ' },
  { name: '小ねぎ', pricePerUnit: 80, unit: '1袋' },
  { name: 'パセリ', pricePerUnit: 50, unit: '1束' },
  { name: '三つ葉', pricePerUnit: 80, unit: '1束' },
  { name: 'なめこ', pricePerUnit: 100, unit: '1袋' },
  { name: 'さつまいも', pricePerUnit: 100, unit: '1本' },
  { name: 'さんま', pricePerUnit: 150, unit: '1尾' },
  { name: 'すだち', pricePerUnit: 30, unit: '1個' },
  { name: '人参', pricePerUnit: 40, unit: '1本' },
  { name: '青じそ', pricePerUnit: 100, unit: '1パック' },
  { name: 'みょうが', pricePerUnit: 30, unit: '1個' },
  { name: '大葉', pricePerUnit: 100, unit: '1パック' },
  { name: '刻みねぎ', pricePerUnit: 15, unit: '少々' },
  { name: '長ねぎ', pricePerUnit: 100, unit: '1本' },

  // 肉・魚・練り物
  { name: '牛薄切り肉', pricePerUnit: 200, unit: '100g' },
  { name: '豚ひき肉', pricePerUnit: 120, unit: '100g' },
  { name: '豚バラ薄切り', pricePerUnit: 150, unit: '100g' },
  { name: '豚ロース薄切り', pricePerUnit: 180, unit: '100g' },
  { name: '鶏ひき肉', pricePerUnit: 100, unit: '100g' },
  { name: '生鮭', pricePerUnit: 120, unit: '1切れ' },
  { name: '鶏手羽先', pricePerUnit: 40, unit: '1本' },
  { name: 'ちくわ', pricePerUnit: 25, unit: '1本' },
  { name: 'ハム', pricePerUnit: 150, unit: '1パック' },
  { name: 'ベーコン', pricePerUnit: 200, unit: '1パック' },
  { name: 'ウインナー', pricePerUnit: 25, unit: '1本' },
  { name: 'むきえび', pricePerUnit: 200, unit: '100g' },
  { name: '鶏ささみ', pricePerUnit: 40, unit: '1本' },
  { name: 'サバ水煮缶', pricePerUnit: 150, unit: '1缶' },

  // 卵・豆腐・豆製品
  { name: '木綿豆腐', pricePerUnit: 40, unit: '1丁' },
  { name: '油揚げ', pricePerUnit: 20, unit: '1枚' },
  { name: '高野豆腐', pricePerUnit: 150, unit: '5枚' },
  { name: '生おから', pricePerUnit: 80, unit: '300g' },
  { name: '錦糸卵', pricePerUnit: 30, unit: '1個分' },
  { name: '絹ごし豆腐', pricePerUnit: 40, unit: '1丁' },
  { name: '蒸し大豆', pricePerUnit: 80, unit: '1パック' },

  // ご飯・粉物・乾物
  { name: 'ご飯', pricePerUnit: 30, unit: '1杯' },
  { name: 'スパゲッティ', pricePerUnit: 45, unit: '100g' },
  { name: '春雨', pricePerUnit: 120, unit: '100g' },
  { name: '冷凍うどん', pricePerUnit: 100, unit: '1玉' },
  { name: '食パン', pricePerUnit: 30, unit: '1枚' },
  { name: 'パン粉', pricePerUnit: 30, unit: '50g' },
  { name: '小麦粉', pricePerUnit: 10, unit: '大さじ1' },
  { name: '片栗粉', pricePerUnit: 10, unit: '大さじ1' },
  { name: 'オートミール', pricePerUnit: 80, unit: '100g' },
  { name: '切り干し大根', pricePerUnit: 130, unit: '50g' },
  { name: '乾燥わかめ', pricePerUnit: 15, unit: '10g' },
  { name: 'カットわかめ', pricePerUnit: 15, unit: '10g' },
  { name: '乾燥芽ひじき', pricePerUnit: 25, unit: '10g' },
  { name: '塩昆布', pricePerUnit: 30, unit: '10g' },
  { name: 'きな粉', pricePerUnit: 15, unit: '大さじ1' },
  { name: '粉寒天', pricePerUnit: 50, unit: '1袋' },

  // 調味料・香辛料・油
  { name: 'サラダ油', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'ごま油', pricePerUnit: 25, unit: '大さじ1' },
  { name: 'オリーブオイル', pricePerUnit: 30, unit: '大さじ1' },
  { name: '揚げ油', pricePerUnit: 40, unit: '使用分' },
  { name: '酒', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'みりん', pricePerUnit: 20, unit: '大さじ1' },
  { name: '酢', pricePerUnit: 10, unit: '大さじ1' },
  { name: '味噌', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'だしの素', pricePerUnit: 10, unit: '小さじ1' },
  { name: 'だし汁', pricePerUnit: 20, unit: '200ml' },
  { name: '水またはだし汁', pricePerUnit: 15, unit: '200ml' },
  // 2026-07-15修正: 他の小さじ表記(だしの素・塩など)と揃え「小さじ1」に統一
  // (単位先行表記。数量＋単位選択UIの合成結果と完全一致させるため)
  { name: 'コンソメ', pricePerUnit: 15, unit: '小さじ1' },
  { name: '中濃ソース', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'ケチャップ', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'マヨネーズ', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'ポン酢', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'めんつゆ', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'カレールー', pricePerUnit: 200, unit: '1箱' },
  { name: 'シチュールー', pricePerUnit: 250, unit: '1箱' },
  { name: '鶏がらスープの素', pricePerUnit: 10, unit: '小さじ1' },
  { name: 'おろしにんにく', pricePerUnit: 15, unit: '少々' },
  { name: '塩', pricePerUnit: 5, unit: '小さじ1' },
  { name: '塩こしょう', pricePerUnit: 5, unit: '少々' },
  { name: 'こしょう', pricePerUnit: 10, unit: '小さじ1' },
  { name: '七味唐辛子', pricePerUnit: 10, unit: '少々' },
  { name: '砂糖', pricePerUnit: 5, unit: '大さじ1' },
  { name: '甜麺醤', pricePerUnit: 20, unit: '大さじ1' },
  { name: '豆板醤', pricePerUnit: 15, unit: '小さじ1' },
  { name: '粉山椒', pricePerUnit: 15, unit: '少々' },
  { name: 'ラー油', pricePerUnit: 10, unit: '少々' },
  { name: '紅しょうが', pricePerUnit: 20, unit: '少々' },
  { name: '刻みのり', pricePerUnit: 15, unit: '少々' },
  { name: 'かつお節', pricePerUnit: 15, unit: '1袋' },
  { name: '白いりごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: '白ごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: '白すりごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'すりごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: '黒いりごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'いりごま', pricePerUnit: 15, unit: '大さじ1' },
  { name: '白練りごま', pricePerUnit: 40, unit: '大さじ1' },

  // 缶詰・加工品・その他
  { name: 'ツナ缶', pricePerUnit: 100, unit: '1缶' },
  { name: 'カットトマト缶', pricePerUnit: 100, unit: '1缶' },
  { name: 'みかん缶', pricePerUnit: 150, unit: '1缶' },
  { name: 'メープルシロップ', pricePerUnit: 40, unit: '大さじ1' },
  { name: '黒みつ', pricePerUnit: 20, unit: '大さじ1' },
  { name: 'アーモンドエッセンス', pricePerUnit: 30, unit: '1本' },
]
