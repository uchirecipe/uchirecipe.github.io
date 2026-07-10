// 栄養価概算(M6-1)用: 「アプリの材料名 ⇄ 日本食品標準成分表（八訂）増補2023年の食品番号」対応表。
//
// ここが唯一の手作業キュレーション箇所。成分値そのものは一切書かない
// （ビルドスクリプト scripts/build-nutrition.mjs が文科省の公式Excelから毎回読み取る）。
// - id: 八訂の食品番号（5桁）。expect: ビルド時の照合用（公式の食品名にこの文字列が
//   含まれない場合はビルドが失敗する＝番号の書き間違い対策）
// - aliases: この食品に名寄せする材料名。実行時に toHiragana で正規化して照合するので
//   「玉ねぎ/玉葱/たまねぎ/タマネギ」のような表記ゆれは書き分けなくてよい（辞書が吸収する）
// - rawAliases: 正規化「前」の完全一致だけで照合する別名。正規化すると他の食品と
//   衝突する場合に使う（例:「鮭」と「酒」はどちらも「さけ」になる）
// - unitGrams: 単位1つあたりの重さ(g)。可食部（皮・殻・芯を除いた正味）の代表値で、
//   一般的な調理の目安量表に基づく概算。QA(管理栄養士ペルソナ)の見直し対象
// - gramsPerMl: 液体・半液体の 1mlあたりの重さ(g)。ml/cc のほか、明示の unitGrams が
//   無ければ 大さじ(15ml)/小さじ(5ml)/カップ(200ml) の換算にも使う
// - blend: 八訂に該当食品が無い混合品(合いびき肉等)を、公式収載品の加重平均で作る。
//   仮定(比率)は note に明記する
//
// 追加・変更したら scripts/build-nutrition.mjs → scripts/test-nutrition.mjs を必ず実行すること。

export const NUTRITION_DB_VERSION = 1

export const FOODS = [
  // ============ 野菜 ============
  { id: '06153', expect: 'たまねぎ りん茎 生', label: '玉ねぎ', aliases: ['玉ねぎ', '新玉ねぎ'], unitGrams: { 個: 200, 玉: 200 } },
  { id: '02017', expect: 'じゃがいも 塊茎 皮なし 生', label: 'じゃがいも', aliases: ['じゃがいも', 'じゃが芋', 'メークイン', '男爵いも'], unitGrams: { 個: 135 } },
  { id: '06212', expect: 'にんじん 根 皮つき 生', label: 'にんじん', aliases: ['にんじん'], unitGrams: { 本: 135 } },
  { id: '06061', expect: 'キャベツ 結球葉 生', label: 'キャベツ', aliases: ['キャベツ', '春キャベツ'], unitGrams: { 枚: 50, 玉: 1000, 個: 1000 } },
  { id: '06132', expect: 'だいこん 根 皮つき 生', label: '大根', aliases: ['大根'], unitGrams: { 本: 750 } },
  { id: '06233', expect: 'はくさい 結球葉 生', label: '白菜', aliases: ['白菜'], unitGrams: { 枚: 100, 株: 1900, 個: 1900 } },
  { id: '06226', expect: '根深ねぎ 葉 軟白 生', label: '長ねぎ', aliases: ['長ねぎ', '白ねぎ', '根深ねぎ', '長葱'], unitGrams: { 本: 100 } },
  { id: '06227', expect: '葉ねぎ 葉 生', label: '青ねぎ', aliases: ['青ねぎ', '葉ねぎ', '刻みねぎ'], unitGrams: { 本: 10 } },
  { id: '06228', expect: 'こねぎ 葉 生', label: '小ねぎ', aliases: ['小ねぎ', 'こねぎ', '万能ねぎ', '細ねぎ'], unitGrams: { 本: 5 } },
  { id: '06103', expect: 'しょうが 根茎 皮なし 生', label: 'しょうが', aliases: ['しょうが'], unitGrams: { かけ: 10, 片: 10 } },
  { id: '06223', expect: 'にんにく りん茎 生', label: 'にんにく', aliases: ['にんにく'], unitGrams: { かけ: 6, 片: 6, 玉: 45 } },
  { id: '06245', expect: '青ピーマン 果実 生', label: 'ピーマン', aliases: ['ピーマン'], unitGrams: { 個: 30 } },
  { id: '06182', expect: '赤色トマト 果実 生', label: 'トマト', aliases: ['トマト'], unitGrams: { 個: 150 } },
  { id: '06183', expect: '赤色ミニトマト 果実 生', label: 'ミニトマト', aliases: ['ミニトマト', 'プチトマト'], unitGrams: { 個: 15 } },
  { id: '06065', expect: 'きゅうり 果実 生', label: 'きゅうり', aliases: ['きゅうり'], unitGrams: { 本: 100 } },
  { id: '06191', expect: 'なす 果実 生', label: 'なす', aliases: ['なす'], unitGrams: { 本: 80 } },
  { id: '06048', expect: '西洋かぼちゃ 果実 生', label: 'かぼちゃ', aliases: ['かぼちゃ'], unitGrams: { 個: 1000 } },
  { id: '06084', expect: 'ごぼう 根 生', label: 'ごぼう', aliases: ['ごぼう'], unitGrams: { 本: 140 } },
  { id: '06317', expect: 'れんこん 根茎 生', label: 'れんこん', aliases: ['れんこん'], unitGrams: { 節: 150 } },
  { id: '06291', expect: 'りょくとうもやし 生', label: 'もやし', aliases: ['もやし'], unitGrams: { 袋: 200 } },
  { id: '06287', expect: 'だいずもやし 生', label: '豆もやし', aliases: ['豆もやし'], unitGrams: { 袋: 200 } },
  { id: '06263', expect: 'ブロッコリー 花序 生', label: 'ブロッコリー', aliases: ['ブロッコリー'], unitGrams: { 株: 200, 房: 15 } },
  { id: '06267', expect: 'ほうれんそう 葉 通年平均 生', label: 'ほうれん草', aliases: ['ほうれん草'], unitGrams: { 束: 180, 株: 20 } },
  { id: '06086', expect: 'こまつな 葉 生', label: '小松菜', aliases: ['小松菜'], unitGrams: { 束: 250, 株: 40 } },
  { id: '06072', expect: 'みずな 葉 生', label: '水菜', aliases: ['水菜', 'みずな'], unitGrams: { 束: 200, 株: 40 } },
  { id: '06160', expect: 'チンゲンサイ 葉 生', label: 'チンゲン菜', aliases: ['チンゲン菜', 'チンゲンサイ', '青梗菜'], unitGrams: { 株: 85 } },
  { id: '06207', expect: 'にら 葉 生', label: 'ニラ', aliases: ['ニラ', '韮'], unitGrams: { 束: 95 } },
  { id: '06312', expect: 'レタス 土耕栽培 結球葉 生', label: 'レタス', aliases: ['レタス'], unitGrams: { 枚: 30, 玉: 300, 個: 300 } },
  { id: '06315', expect: 'サニーレタス 葉 生', label: 'サニーレタス', aliases: ['サニーレタス'], unitGrams: { 枚: 15 } },
  { id: '06119', expect: 'セロリ 葉柄 生', label: 'セロリ', aliases: ['セロリ'], unitGrams: { 本: 65 } },
  { id: '06007', expect: 'アスパラガス 若茎 生', label: 'アスパラガス', aliases: ['アスパラガス', 'アスパラ'], unitGrams: { 本: 20 } },
  { id: '06010', expect: 'さやいんげん 若ざや 生', label: 'いんげん', aliases: ['いんげん', 'さやいんげん'], unitGrams: { 本: 7 } },
  { id: '06020', expect: 'さやえんどう 若ざや 生', label: '絹さや', aliases: ['絹さや', 'さやえんどう'], unitGrams: { 枚: 2 } },
  { id: '06023', expect: 'グリンピース 生', label: 'グリーンピース', aliases: ['グリーンピース', 'グリンピース'] },
  { id: '06032', expect: 'オクラ 果実 生', label: 'オクラ', aliases: ['オクラ'], unitGrams: { 本: 7 } },
  { id: '06036', expect: 'かぶ 根 皮つき 生', label: 'かぶ', aliases: ['かぶ', '蕪'], unitGrams: { 個: 75 } },
  { id: '06116', expect: 'ズッキーニ 果実 生', label: 'ズッキーニ', aliases: ['ズッキーニ'], unitGrams: { 本: 200 } },
  { id: '06095', expect: 'しそ 葉 生', label: '大葉', aliases: ['大葉', 'しそ', '青じそ'], unitGrams: { 枚: 1 } },
  { id: '06280', expect: 'みょうが 花穂 生', label: 'みょうが', aliases: ['みょうが'], unitGrams: { 個: 15 } },
  { id: '06239', expect: 'パセリ 葉 生', label: 'パセリ', aliases: ['パセリ'], unitGrams: { 枝: 5 } },
  { id: '06172', expect: 'とうがらし 果実 乾', label: '赤唐辛子', aliases: ['赤唐辛子', '唐辛子', '鷹の爪'], unitGrams: { 本: 0.5 } },
  { id: '06180', expect: 'スイートコーン 缶詰 ホールカーネルスタイル', label: 'コーン缶', aliases: ['コーン缶', 'コーン', 'ホールコーン'], unitGrams: { 缶: 120 } },
  { id: '06015', expect: 'えだまめ 生', label: '枝豆', aliases: ['枝豆'], note: 'さや付きで量る場合は約半分が可食部' },
  { id: '02006', expect: 'さつまいも 塊根 皮なし 生', label: 'さつまいも', aliases: ['さつまいも'], unitGrams: { 本: 180 } },
  { id: '02010', expect: 'さといも 球茎 生', label: '里芋', aliases: ['里芋'], unitGrams: { 個: 40 } },
  { id: '02023', expect: 'ながいも 塊根 生', label: '長いも', aliases: ['長いも', '長芋', '山芋'] },

  // ============ きのこ ============
  { id: '08039', expect: '生しいたけ 菌床栽培 生', label: 'しいたけ', aliases: ['しいたけ', '生しいたけ'], unitGrams: { 枚: 12, 個: 12 } },
  { id: '08013', expect: '乾しいたけ 乾', label: '干ししいたけ', aliases: ['干ししいたけ', '乾しいたけ', '干し椎茸'], unitGrams: { 枚: 3, 個: 3 } },
  { id: '08016', expect: 'ぶなしめじ 生', label: 'しめじ', aliases: ['しめじ', 'ぶなしめじ'], unitGrams: { 袋: 90, パック: 90, 株: 90 } },
  { id: '08001', expect: 'えのきたけ 生', label: 'えのき', aliases: ['えのき'], unitGrams: { 袋: 85, 株: 85 } },
  { id: '08028', expect: 'まいたけ 生', label: 'まいたけ', aliases: ['まいたけ'], unitGrams: { 袋: 90, パック: 90, 株: 90 } },
  { id: '08025', expect: 'エリンギ 生', label: 'エリンギ', aliases: ['エリンギ'], unitGrams: { 本: 30, パック: 90 } },

  // ============ 肉 ============
  { id: '11221', expect: '若どり・主品目］ もも 皮つき 生', label: '鶏もも肉', aliases: ['鶏もも肉', 'とりもも'], unitGrams: { 枚: 250 } },
  { id: '11219', expect: '若どり・主品目］ むね 皮つき 生', label: '鶏むね肉', aliases: ['鶏むね肉'], unitGrams: { 枚: 250 } },
  { id: '11227', expect: '若どり・副品目］ ささみ 生', label: '鶏ささみ', aliases: ['鶏ささみ', 'ささみ', 'ささ身'], unitGrams: { 本: 45 } },
  { id: '11230', expect: 'にわとり ［二次品目］ ひき肉 生', label: '鶏ひき肉', aliases: ['鶏ひき肉', '鶏ミンチ'] },
  { id: '11285', expect: '手羽さき 皮つき 生', label: '手羽先', aliases: ['手羽先'], unitGrams: { 本: 35 } },
  { id: '11286', expect: '手羽もと 皮つき 生', label: '手羽元', aliases: ['手羽元'], unitGrams: { 本: 40 } },
  { id: '11163', expect: 'ぶた ［ひき肉］ 生', label: '豚ひき肉', aliases: ['豚ひき肉', '豚ミンチ'] },
  { id: '11089', expect: 'うし ［ひき肉］ 生', label: '牛ひき肉', aliases: ['牛ひき肉'] },
  {
    blend: [
      { id: '11089', expect: 'うし ［ひき肉］ 生', ratio: 0.5 },
      { id: '11163', expect: 'ぶた ［ひき肉］ 生', ratio: 0.5 },
    ],
    label: '合いびき肉', aliases: ['合いびき肉', '合挽き肉', '合い挽き肉', '合びき肉'],
    note: '八訂に合いびき肉の収載が無いため、牛ひき肉と豚ひき肉を半々と仮定した加重平均',
  },
  { id: '11115', expect: 'ぶた ［大型種肉］ かた 脂身つき 生', label: '豚こま切れ肉', aliases: ['豚こま切れ肉', '豚こま', '豚小間', '豚切り落とし'], note: 'こま切れは部位混合のため、かた(脂身つき)で代表' },
  { id: '11129', expect: 'ぶた ［大型種肉］ ばら 脂身つき 生', label: '豚バラ肉', aliases: ['豚バラ肉', '豚バラ薄切り', '豚ばら肉'], unitGrams: { 枚: 20 } },
  { id: '11123', expect: 'ぶた ［大型種肉］ ロース 脂身つき 生', label: '豚ロース肉', aliases: ['豚ロース肉', '豚ロース薄切り', '豚ロース'], unitGrams: { 枚: 30 } },
  { id: '11030', expect: 'うし ［乳用肥育牛肉］ かた 脂身つき 生', label: '牛こま切れ肉', aliases: ['牛こま切れ肉', '牛こま', '牛切り落とし'], note: 'こま切れは部位混合のため、かた(脂身つき)で代表' },
  { id: '11046', expect: 'うし ［乳用肥育牛肉］ ばら 脂身つき 生', label: '牛バラ肉', aliases: ['牛バラ肉', '牛ばら肉'] },
  { id: '11176', expect: 'ロースハム ロースハム', label: 'ハム', aliases: ['ハム', 'ロースハム'], unitGrams: { 枚: 10 } },
  { id: '11183', expect: 'ばらベーコン ばらベーコン', label: 'ベーコン', aliases: ['ベーコン'], unitGrams: { 枚: 18 } },
  { id: '11186', expect: 'ウインナーソーセージ ウインナーソーセージ', label: 'ウインナー', aliases: ['ウインナー', 'ウィンナー', 'ソーセージ'], unitGrams: { 本: 20 } },

  // ============ 魚介 ============
  { id: '10134', expect: 'しろさけ 生', label: '鮭', aliases: ['生鮭', '鮭切り身'], rawAliases: ['鮭', 'さけ(切り身)', '鮭(切り身)'], unitGrams: { 切れ: 80 }, note: '「鮭」は正規化すると「酒」と同じ読みになるため rawAliases で対応' },
  { id: '10154', expect: 'まさば 生', label: 'さば', aliases: ['さば', '鯖'], unitGrams: { 切れ: 80 } },
  { id: '10205', expect: 'まだら 生', label: 'たら', aliases: ['たら', '鱈'], unitGrams: { 切れ: 80 } },
  { id: '10241', expect: 'ぶり 成魚 生', label: 'ぶり', aliases: ['ぶり', '鰤'], unitGrams: { 切れ: 80 } },
  { id: '10415', expect: 'バナメイえび 養殖 生', label: 'えび', aliases: ['えび', 'むきえび', 'バナメイえび'], unitGrams: { 尾: 10 } },
  { id: '10345', expect: 'するめいか 生', label: 'いか', aliases: ['いか', 'するめいか'], unitGrams: { 杯: 210 } },
  { id: '10281', expect: 'あさり 生', label: 'あさり', aliases: ['あさり'], note: 'むき身(殻なし)のグラム数で計算すること' },
  { id: '10313', expect: 'ほたてがい 貝柱 生', label: 'ほたて', aliases: ['ほたて', 'ほたて貝柱'], unitGrams: { 個: 30 } },
  { id: '10164', expect: '（さば類） 缶詰 水煮', label: 'サバ水煮缶', aliases: ['サバ水煮缶', 'さば缶', '鯖缶'], unitGrams: { 缶: 190 } },
  { id: '10263', expect: '缶詰 油漬 フレーク ライト', label: 'ツナ缶（油漬け）', aliases: ['ツナ缶', 'ツナ'], unitGrams: { 缶: 70 } },
  { id: '10260', expect: '缶詰 水煮 フレーク ライト', label: 'ツナ缶（水煮）', aliases: ['ツナ水煮缶', 'ノンオイルツナ'], unitGrams: { 缶: 70 } },
  { id: '10055', expect: 'しらす干し 微乾燥品', label: 'しらす', aliases: ['しらす', 'しらす干し'], unitGrams: { 大さじ: 5 } },
  { id: '10091', expect: '加工品 かつお節', label: 'かつお節', aliases: ['かつお節', '削り節'], unitGrams: { パック: 3, 大さじ: 2 } },
  { id: '10379', expect: '蒸しかまぼこ', label: 'かまぼこ', aliases: ['かまぼこ'], unitGrams: { 本: 100 } },
  { id: '10381', expect: '焼き竹輪', label: 'ちくわ', aliases: ['ちくわ'], unitGrams: { 本: 30 } },
  { id: '10385', expect: 'はんぺん', label: 'はんぺん', aliases: ['はんぺん'], unitGrams: { 枚: 100 } },
  { id: '10386', expect: 'さつま揚げ', label: 'さつま揚げ', aliases: ['さつま揚げ'], unitGrams: { 枚: 60 } },

  // ============ 卵・乳・大豆製品 ============
  { id: '12004', expect: '鶏卵 全卵 生', label: '卵', aliases: ['卵', '鶏卵'], unitGrams: { 個: 50 } },
  { id: '13003', expect: '普通牛乳', label: '牛乳', aliases: ['牛乳'], gramsPerMl: 1.03 },
  { id: '13014', expect: 'クリーム 乳脂肪', label: '生クリーム', aliases: ['生クリーム'], gramsPerMl: 1.0 },
  { id: '13025', expect: 'ヨーグルト 全脂無糖', label: 'ヨーグルト', aliases: ['ヨーグルト', 'プレーンヨーグルト'], gramsPerMl: 1.0, unitGrams: { パック: 400 } },
  { id: '13040', expect: 'プロセスチーズ', label: 'チーズ', aliases: ['チーズ', 'プロセスチーズ', 'スライスチーズ'], unitGrams: { 枚: 18, 個: 17 } },
  { id: '14017', expect: '無発酵バター 有塩バター', label: 'バター', aliases: ['バター'], unitGrams: { 大さじ: 12, 小さじ: 4, かけ: 10 } },
  { id: '04032', expect: '木綿豆腐', label: '木綿豆腐', aliases: ['木綿豆腐', '豆腐'], unitGrams: { 丁: 350 }, note: '「豆腐」とだけ書かれた場合は木綿豆腐で代表' },
  { id: '04033', expect: '絹ごし豆腐', label: '絹ごし豆腐', aliases: ['絹ごし豆腐', '絹豆腐'], unitGrams: { 丁: 350 } },
  { id: '04040', expect: '油揚げ 生', label: '油揚げ', aliases: ['油揚げ', 'うすあげ'], unitGrams: { 枚: 20 } },
  { id: '04051', expect: 'おから 生', label: '生おから', aliases: ['生おから', 'おから'], note: 'B4卯の花で初登場(2026-07-10)。「おからパウダー(乾燥)」は別食品なので流用しない' },
  { id: '04039', expect: '生揚げ', label: '厚揚げ', aliases: ['厚揚げ', '生揚げ'], unitGrams: { 枚: 150 } },
  { id: '04046', expect: '糸引き納豆', label: '納豆', aliases: ['納豆'], unitGrams: { パック: 45, 個: 45 } },
  { id: '02003', expect: '板こんにゃく 精粉こんにゃく', label: 'こんにゃく', aliases: ['こんにゃく'], unitGrams: { 枚: 250 } },
  { id: '02005', expect: 'こんにゃく しらたき', label: 'しらたき', aliases: ['しらたき', '糸こんにゃく'], unitGrams: { 袋: 200 } },

  // ============ ご飯・パン・麺・粉 ============
  { id: '01088', expect: '水稲めし］ 精白米 うるち米', label: 'ご飯', aliases: ['ご飯', '白ご飯', '白飯', '温かいご飯'], unitGrams: { 杯: 150, 膳: 150 } },
  { id: '01083', expect: '水稲穀粒］ 精白米 うるち米', label: '米', aliases: ['米', '精白米', '白米'], unitGrams: { 合: 150 } },
  { id: '01026', expect: '角形食パン 食パン', label: '食パン', aliases: ['食パン', 'パン'], unitGrams: { 枚: 60, 斤: 360 }, note: '1枚=6枚切りの目安' },
  { id: '01034', expect: 'ロールパン', label: 'ロールパン', aliases: ['ロールパン'], unitGrams: { 個: 30 } },
  { id: '01015', expect: '薄力粉 1等', label: '小麦粉', aliases: ['小麦粉', '薄力粉'], unitGrams: { 大さじ: 9, 小さじ: 3, カップ: 110 } },
  { id: '01020', expect: '強力粉 1等', label: '強力粉', aliases: ['強力粉'], unitGrams: { 大さじ: 9, 小さじ: 3, カップ: 110 } },
  { id: '02034', expect: 'じゃがいもでん粉', label: '片栗粉', aliases: ['片栗粉'], unitGrams: { 大さじ: 9, 小さじ: 3 } },
  { id: '01079', expect: 'パン粉 乾燥', label: 'パン粉', aliases: ['パン粉'], unitGrams: { 大さじ: 3, カップ: 40 } },
  { id: '01039', expect: 'うどん ゆで', label: 'うどん', aliases: ['うどん', 'ゆでうどん'], unitGrams: { 玉: 200 } },
  { id: '01043', expect: 'そうめん・ひやむぎ 乾', label: 'そうめん', aliases: ['そうめん', 'ひやむぎ'], unitGrams: { 束: 50 } },
  { id: '01047', expect: '中華めん 生', label: '中華麺', aliases: ['中華麺', '中華めん'], unitGrams: { 玉: 120 } },
  { id: '01049', expect: '蒸し中華めん 蒸し中華めん', label: '焼きそば麺', aliases: ['焼きそば麺', '蒸し中華めん', '蒸し麺'], unitGrams: { 玉: 150 } },
  { id: '01063', expect: 'マカロニ・スパゲッティ 乾', label: 'スパゲッティ', aliases: ['スパゲッティ', 'スパゲティ', 'パスタ', 'マカロニ'] },
  { id: '01074', expect: 'ぎょうざの皮 生', label: '餃子の皮', aliases: ['餃子の皮'], unitGrams: { 枚: 6 } },
  { id: '02040', expect: 'はるさめ 普通はるさめ 乾', label: '春雨', aliases: ['春雨'] },
  { id: '01004', expect: 'えんばく オートミール', label: 'オートミール', aliases: ['オートミール'], unitGrams: { 大さじ: 6, カップ: 80 } },

  // ============ 海藻・乾物 ============
  { id: '09044', expect: 'カットわかめ 乾', label: '乾燥わかめ', aliases: ['乾燥わかめ', 'カットわかめ'], unitGrams: { 大さじ: 3, 小さじ: 1 }, note: '乾燥品の値。生わかめ・塩蔵わかめには使わない' },
  { id: '09002', expect: 'あおのり 素干し', label: '青のり', aliases: ['青のり'], unitGrams: { 大さじ: 2, 小さじ: 1 } },
  { id: '09004', expect: 'あまのり 焼きのり', label: '焼きのり', aliases: ['焼きのり', '海苔'], unitGrams: { 枚: 3 } },
  { id: '09017', expect: 'まこんぶ 素干し 乾', label: '昆布', aliases: ['昆布', 'だし昆布'], unitGrams: { 枚: 10 } },
  { id: '09050', expect: 'ほしひじき ステンレス釜 乾', label: 'ひじき', aliases: ['ひじき', '芽ひじき'], unitGrams: { 大さじ: 3 } },

  // ============ 調味料 ============
  { id: '17007', expect: 'こいくちしょうゆ', label: 'しょうゆ', aliases: ['しょうゆ', '濃口醤油'], gramsPerMl: 1.2 },
  { id: '17008', expect: 'うすくちしょうゆ', label: '薄口しょうゆ', aliases: ['薄口しょうゆ', '薄口醤油'], gramsPerMl: 1.2 },
  { id: '17045', expect: '米みそ 淡色辛みそ', label: '味噌', aliases: ['味噌', '合わせ味噌', '信州味噌'], unitGrams: { 大さじ: 18, 小さじ: 6 }, note: '「味噌」とだけ書かれた場合は淡色辛みそで代表' },
  { id: '17044', expect: '米みそ 甘みそ', label: '白味噌', aliases: ['白味噌', '甘みそ'], unitGrams: { 大さじ: 18, 小さじ: 6 } },
  { id: '17046', expect: '米みそ 赤色辛みそ', label: '赤味噌', aliases: ['赤味噌'], unitGrams: { 大さじ: 18, 小さじ: 6 } },
  { id: '03003', expect: '車糖 上白糖', label: '砂糖', aliases: ['砂糖', '上白糖'], unitGrams: { 大さじ: 9, 小さじ: 3, カップ: 130 } },
  { id: '17012', expect: '（食塩類） 食塩', label: '塩', aliases: ['塩', '食塩', '塩こしょう'], unitGrams: { 大さじ: 18, 小さじ: 6 }, note: '「塩こしょう」は主成分の塩で代表(こしょう分はごく少量のため)' },
  { id: '16001', expect: '清酒 普通酒', label: '酒', aliases: ['酒', '料理酒', '日本酒'], gramsPerMl: 1.0 },
  { id: '16025', expect: 'みりん 本みりん', label: 'みりん', aliases: ['みりん', '本みりん'], gramsPerMl: 1.2 },
  { id: '17054', expect: 'みりん風調味料', label: 'みりん風調味料', aliases: ['みりん風調味料'], gramsPerMl: 1.2 },
  { id: '17015', expect: '穀物酢', label: '酢', aliases: ['酢', '穀物酢'], gramsPerMl: 1.0 },
  { id: '17016', expect: '米酢', label: '米酢', aliases: ['米酢'], gramsPerMl: 1.0 },
  { id: '14006', expect: '調合油', label: 'サラダ油', aliases: ['サラダ油', '植物油'], rawAliases: ['油'], gramsPerMl: 0.8, note: '大さじ1=12gの慣用値に合わせて0.8g/ml' },
  { id: '14002', expect: '（植物油脂類） ごま油', label: 'ごま油', aliases: ['ごま油'], gramsPerMl: 0.8 },
  { id: '14001', expect: 'オリーブ油', label: 'オリーブオイル', aliases: ['オリーブオイル', 'オリーブ油'], gramsPerMl: 0.8 },
  { id: '17036', expect: 'トマトケチャップ', label: 'ケチャップ', aliases: ['ケチャップ', 'トマトケチャップ'], unitGrams: { 大さじ: 15, 小さじ: 5 } },
  { id: '17042', expect: 'マヨネーズ 全卵型', label: 'マヨネーズ', aliases: ['マヨネーズ'], unitGrams: { 大さじ: 12, 小さじ: 4 } },
  { id: '17001', expect: 'ウスターソース', label: 'ウスターソース', aliases: ['ウスターソース'], gramsPerMl: 1.2 },
  { id: '17002', expect: '中濃ソース', label: '中濃ソース', aliases: ['中濃ソース'], rawAliases: ['ソース'], gramsPerMl: 1.2, note: '「ソース」とだけ書かれた場合は中濃ソースで代表' },
  { id: '17031', expect: 'オイスターソース', label: 'オイスターソース', aliases: ['オイスターソース'], unitGrams: { 大さじ: 18, 小さじ: 6 } },
  { id: '17137', expect: 'ぽん酢しょうゆ 市販品', label: 'ポン酢', aliases: ['ポン酢', 'ポン酢しょうゆ'], gramsPerMl: 1.1 },
  { id: '17029', expect: 'めんつゆ ストレート', label: 'めんつゆ（ストレート）', aliases: ['めんつゆ(ストレート)', 'ストレートめんつゆ'], gramsPerMl: 1.1 },
  { id: '17141', expect: 'めんつゆ 二倍濃縮', label: 'めんつゆ（2倍濃縮）', aliases: ['めんつゆ(2倍濃縮)', 'めんつゆ2倍濃縮', 'めんつゆ二倍濃縮', 'めんつゆ'], gramsPerMl: 1.1, note: '濃縮倍率の記載が無い「めんつゆ」は2倍濃縮で代表' },
  { id: '17030', expect: 'めんつゆ 三倍濃縮', label: 'めんつゆ（3倍濃縮）', aliases: ['めんつゆ(3倍濃縮)', 'めんつゆ3倍濃縮', 'めんつゆ三倍濃縮'], gramsPerMl: 1.1 },
  { id: '17028', expect: '顆粒和風だし', label: '和風だしの素', aliases: ['だしの素', '顆粒だし', '和風だし', 'ほんだし'], unitGrams: { 大さじ: 9, 小さじ: 3 } },
  { id: '17093', expect: '顆粒中華だし', label: '鶏がらスープの素', aliases: ['鶏がらスープの素', '中華だし', '中華スープの素', '鶏がらだしの素'], unitGrams: { 大さじ: 9, 小さじ: 3 } },
  { id: '17027', expect: '固形ブイヨン', label: 'コンソメ', aliases: ['コンソメ', '固形コンソメ', 'ブイヨン'], unitGrams: { 個: 5, 大さじ: 9, 小さじ: 3 } },
  { id: '17021', expect: 'かつお・昆布だし 荒節・昆布だし', label: 'だし汁', aliases: ['だし汁', '出汁', 'かつおだし', '昆布だし'], gramsPerMl: 1.0 },
  { id: '17051', expect: 'カレールウ', label: 'カレールー', aliases: ['カレールー', 'カレールウ'], unitGrams: { 箱: 200, かけ: 20, 皿分: 20 } },
  { id: '17052', expect: 'ハヤシルウ', label: 'ハヤシライスルー', aliases: ['ハヤシライスルー', 'ハヤシルー'], unitGrams: { 箱: 200, かけ: 20 } },
  { id: '17061', expect: 'カレー粉', label: 'カレー粉', aliases: ['カレー粉'], unitGrams: { 大さじ: 6, 小さじ: 2 } },
  { id: '17065', expect: 'こしょう 混合 粉', label: 'こしょう', aliases: ['こしょう', 'ブラックペッパー', '黒こしょう'], unitGrams: { 小さじ: 2 } },
  { id: '17069', expect: 'しょうが おろし', label: 'おろししょうが（チューブ）', aliases: ['おろししょうが', 'しょうがチューブ', 'チューブしょうが'], unitGrams: { 大さじ: 15, 小さじ: 5 } },
  { id: '17076', expect: 'にんにく おろし', label: 'おろしにんにく（チューブ）', aliases: ['おろしにんにく', 'にんにくチューブ', 'チューブにんにく'], unitGrams: { 大さじ: 15, 小さじ: 5 } },
  { id: '03022', expect: 'はちみつ', label: 'はちみつ', aliases: ['はちみつ'], unitGrams: { 大さじ: 21, 小さじ: 7 } },
  { id: '05018', expect: 'ごま いり', label: 'いりごま', aliases: ['いりごま', '白ごま', '黒ごま', 'すりごま', '炒りごま'], unitGrams: { 大さじ: 9, 小さじ: 3 } },
  { id: '05042', expect: 'ごま ねり', label: '練りごま', aliases: ['練りごま'], unitGrams: { 大さじ: 18, 小さじ: 6 } },

  // ============ 果物・その他 ============
  { id: '07022', expect: '梅干し 塩漬', label: '梅干し', aliases: ['梅干し', '梅干'], unitGrams: { 個: 10 } },
  { id: '07156', expect: 'レモン 果汁 生', label: 'レモン汁', aliases: ['レモン汁', 'レモン果汁'], gramsPerMl: 1.0 },
  { id: '07107', expect: 'バナナ 生', label: 'バナナ', aliases: ['バナナ'], unitGrams: { 本: 90 } },
  { id: '07148', expect: 'りんご 皮なし 生', label: 'りんご', aliases: ['りんご'], unitGrams: { 個: 220 } },
  { id: '06184', expect: '（トマト類） 加工品 ホール 食塩無添加', label: 'トマト缶', aliases: ['トマト缶', 'カットトマト缶', 'ホールトマト缶', 'トマト水煮缶'], unitGrams: { 缶: 400 } },
]
