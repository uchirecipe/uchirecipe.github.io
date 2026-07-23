/**
 * 食材価格マスタの初期値（公式レシピ全食材=168件の目安価格。2026-07-13に30件から拡大、
 * 2026-07-23のテーマ全廃で旧配布テーマ由来の食材32件を追加して168件に）。
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

/**
 * PRICE_DEFAULTSの「版番号」(2026-07-16 バージョン付きトップアップ移行)。
 * 古い時期にマスタを作った既存ユーザーは、その後追加されたPRICE_DEFAULTSの新項目が
 * 反映されず「価格なし」が多発する問題への対応。この番号を上げるたびに、
 * db/prices.tsのseedPriceDefaultsIfNeededが「まだ無い項目だけ」を1回だけ追加で投入する
 * (ユーザーが編集・追加した行や、意図的に削除した既定は一切触らない)。
 * 新しい項目をPRICE_DEFAULTSへ追加したときは、この番号をインクリメントすること。
 *
 * 【重要な既知の限界】このトップアップ機構は「名前がまだ無い項目の追加」専用であり、
 * 既存項目の価格・単位の「更新」には使われない(db/prices.tsのmissingDefaultsは名前の
 * 存在チェックのみ)。2026-07-21の調味料価格改定(3への昇格。docs/49参照)で酒・しょうゆ・塩
 * 等の値を実勢価格ベースに引き下げたが、既にisDefault=trueでマスタ行を持つ既存ユーザーは
 * この版番号を上げても「新値」には自動更新されない(名前は既に存在するため対象外になる)。
 * 新規インストールのユーザーだけが新値の恩恵を受ける。既存ユーザーへの反映は
 * 「食材と価格」画面の「デフォルトに戻す」操作（isDefault行のみ表示）でも、旧デフォルト値に
 * 戻るだけで新値にはならない(defaultPricePerUnit/defaultUnitがシード時点の値のまま)。
 * 既存ユーザー全員に新値を反映する専用の再シード処理は今回は実装していない
 * (影響範囲が「価格マスタの数値」のみで実害が小さいことと、既存のトップアップ機構の
 * 設計思想[ユーザーが編集した値を勝手に上書きしない]と、価格改定のたびに既存行を
 * 強制上書きする挙動が両立しないため。必要になった場合は別途設計判断が要る)。
 */
export const PRICE_DEFAULTS_VERSION = 4

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
  // 2026-07-21 調味料既定価格改定(docs/49): 販売単位(1L)の実勢中央値ベースに変更。
  // 大さじ1相当は400×15/1000=6円(旧20円から実勢並みに引き下げ)。
  { name: 'しょうゆ', pricePerUnit: 400, unit: '1L' },
  // 2026-07-21 調味料既定価格改定(docs/49): 実勢kg中央値(617円/kg)×大さじ1=18g換算。
  // 大さじ表記のまま単価のみ実勢に合わせた(体積↔質量は按分できない設計のため単位は維持。
  // 詳細はdocs/49の「単位を維持した理由」参照)。
  { name: 'みそ', pricePerUnit: 11, unit: '大さじ1' },

  // ============ 2026-07-13 データ整備: 基本51品+全パックの価格カバー100%対応 ============
  // 既存30件(上記)は原則値を変更しない(E2E PRICE-01が「玉ねぎ1個50円」に依存)。
  // 例外: しょうゆ・みそのみ2026-07-21の調味料既定価格改定(docs/49)で単価を更新した
  // (E2E PRICE-01は玉ねぎのみに依存するため無関係。scripts/test-price.mjsのORIGINAL_30も
  // この2件だけ新値に更新済み)。
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
  // 「三つ葉」(旧80円/1束)は下の「みつば」(100円/1束・docs/49の実売中央値)へ名寄せ統合した
  // (2026-07-23 便BH-1)。表記ゆれは logic/ingredientReadings.ts の「三つ葉→みつば」で吸収するので、
  // レシピ材料名が「三つ葉」でも「みつば」でも同じ1件に価格解決する(二重登録を解消)。
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
  // 2026-07-21 調味料既定価格改定(docs/49・オーナー指摘「酒・塩・醤油の原価が高く感じる」への
  // 対応。実売価格調査に基づき販売単位ベースの中央値へ改定): 液体調味料(サラダ油〜めんつゆ・
  // ポン酢・中濃ソース・マヨネーズ・ケチャップ)はレシピ側も大さじ/小さじ(体積)でしか使われて
  // いないことを確認済みのため、登録単位を実際の販売単位「1L」に変更(体積↔体積の按分がそのまま
  // 効くため換算精度を落とさず実現できる)。塩・砂糖・味噌・だしの素・鶏がらスープの素・コンソメは
  // 販売単位が重量(kg/g)だが、レシピ側は例外なく大さじ/小さじ(体積)で使われており、原価計算
  // (estimateIngredientYen)は質量↔質量・体積↔体積でしか按分できない設計(docs/48 §7-1で
  // 対応不要と判断済みの既知の制限)。単位を「1kg」化すると次元が食い違い按分できず、1行あたり
  // 「1kg分の価格がそのまま」表示される重大な回帰になるため、これらは単位は据え置き、
  // 単価だけを実勢kg中央値×大さじ/小さじの実重量換算(docs/48で確定済みの換算値)で再計算した。
  { name: 'サラダ油', pricePerUnit: 400, unit: '1L' },
  { name: 'ごま油', pricePerUnit: 1200, unit: '1L' },
  { name: 'オリーブオイル', pricePerUnit: 1400, unit: '1L' },
  { name: '揚げ油', pricePerUnit: 40, unit: '使用分' },
  { name: '酒', pricePerUnit: 260, unit: '1L' },
  { name: 'みりん', pricePerUnit: 390, unit: '1L' },
  { name: '酢', pricePerUnit: 340, unit: '1L' },
  { name: '味噌', pricePerUnit: 11, unit: '大さじ1' },
  { name: 'だしの素', pricePerUnit: 10, unit: '小さじ1' },
  { name: 'だし汁', pricePerUnit: 20, unit: '200ml' },
  { name: '水またはだし汁', pricePerUnit: 15, unit: '200ml' },
  // 2026-07-15修正: 他の小さじ表記(だしの素・塩など)と揃え「小さじ1」に統一
  // (単位先行表記。数量＋単位選択UIの合成結果と完全一致させるため)
  { name: 'コンソメ', pricePerUnit: 10, unit: '小さじ1' },
  { name: '中濃ソース', pricePerUnit: 780, unit: '1L' },
  { name: 'ケチャップ', pricePerUnit: 960, unit: '1L' },
  { name: 'マヨネーズ', pricePerUnit: 680, unit: '1L' },
  { name: 'ポン酢', pricePerUnit: 890, unit: '1L' },
  { name: 'めんつゆ', pricePerUnit: 420, unit: '1L' },
  { name: 'カレールー', pricePerUnit: 200, unit: '1箱' },
  { name: 'シチュールー', pricePerUnit: 250, unit: '1箱' },
  { name: '鶏がらスープの素', pricePerUnit: 9, unit: '小さじ1' },
  { name: 'おろしにんにく', pricePerUnit: 15, unit: '少々' },
  { name: '塩', pricePerUnit: 1, unit: '小さじ1' },
  { name: '塩こしょう', pricePerUnit: 5, unit: '少々' },
  { name: 'こしょう', pricePerUnit: 10, unit: '小さじ1' },
  { name: '七味唐辛子', pricePerUnit: 10, unit: '少々' },
  { name: '砂糖', pricePerUnit: 2, unit: '大さじ1' },
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

  // 旧配布テーマ(第◯弾)由来の基本レシピ(2026-07-23のテーマ全廃で同梱に合流)で使う食材の目安価格。
  // 2026-07-23にWebSearchで実売価格(スーパー/ネットスーパーの現行価格帯)を全数調査し、販売単位ベースの
  // 中央値と各レシピの実使用量(g/ml/大さじ/小さじ/個数)を突き合わせて検証した(出典・計算はdocs/49 §2026-07-23)。
  // 既存値と±20%以内の28件は据え置き、大きくズレた4件のみ補正(長芋100→80・こしあん200→450・キウイ80→100・
  // オイスターソース15→30)。「適量」「少々」等の非按分の薬味は満額表示になるため、販売1単位の実勢より小さめの
  // 目安にしてある(既存の薬味と同じ方針。docs/49参照)。分量が g/ml/大さじ/小さじ の食材は按分できるよう単位を数量付きにしている。
  // v4はまだ未リリース(本ブランチ内)のため版番号は据え置き、初回シードで補正後の値が投入される。
  { name: '牛切り落とし肉', pricePerUnit: 200, unit: '100g' },
  { name: 'さわら', pricePerUnit: 200, unit: '1切れ' },
  { name: '生だら', pricePerUnit: 120, unit: '1切れ' },
  { name: 'レタス', pricePerUnit: 150, unit: '1個' },
  { name: 'ゴーヤ', pricePerUnit: 130, unit: '1本' },
  { name: 'オクラ', pricePerUnit: 130, unit: '1袋' },
  { name: '長芋', pricePerUnit: 80, unit: '100g' },
  // 「三つ葉」と「みつば」の名寄せ統合先(2026-07-23 便BH-1)。値はdocs/49の実売中央値=100円/1束。
  // ingredientReadings.ts の「三つ葉→みつば」で旧表記「三つ葉」もこの1件に価格解決する。
  { name: 'みつば', pricePerUnit: 100, unit: '1束' },
  { name: '万能ねぎ', pricePerUnit: 100, unit: '1束' },
  { name: 'まいたけ', pricePerUnit: 130, unit: '1パック' },
  { name: 'エリンギ', pricePerUnit: 100, unit: '1パック' },
  { name: '生しいたけ', pricePerUnit: 100, unit: '1パック' },
  { name: 'しらたき', pricePerUnit: 80, unit: '1袋' },
  { name: '昆布', pricePerUnit: 400, unit: '100g' },
  { name: '梅干し', pricePerUnit: 30, unit: '1個' },
  { name: 'プレーンヨーグルト', pricePerUnit: 50, unit: '100g' },
  { name: 'ピザ用チーズ', pricePerUnit: 300, unit: '200g' },
  { name: '豆乳', pricePerUnit: 200, unit: '1L' },
  { name: 'そうめん', pricePerUnit: 50, unit: '1束' },
  { name: 'グラノーラ', pricePerUnit: 500, unit: '1袋' },
  { name: 'こしあん', pricePerUnit: 450, unit: '300g' },
  { name: 'いちご', pricePerUnit: 400, unit: '1パック' },
  { name: 'ブルーベリー', pricePerUnit: 300, unit: '1パック' },
  { name: 'キウイ', pricePerUnit: 100, unit: '1個' },
  { name: 'はちみつ', pricePerUnit: 40, unit: '大さじ1' },
  { name: 'オイスターソース', pricePerUnit: 30, unit: '大さじ1' },
  { name: 'コチュジャン', pricePerUnit: 10, unit: '小さじ1' },
  { name: 'カレー粉', pricePerUnit: 15, unit: '小さじ1' },
  { name: '白みそ', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'レモン汁', pricePerUnit: 15, unit: '大さじ1' },
  { name: '粗びき黒こしょう', pricePerUnit: 10, unit: '小さじ1' },
  { name: '乾燥ハーブ', pricePerUnit: 20, unit: '小さじ1' },
]
