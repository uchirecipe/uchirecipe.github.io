/**
 * 食材価格マスタの初期値（同梱レシピの全食材の目安価格。2026-07-13に30件から拡大し、
 * 2026-07-23のテーマ全廃・2026-07-29の副菜6品追加でその都度足してきた）。
 *
 * 【件数はここに書かない】2026-08-09 便EI。「172件」と書いてあったが実際は170件で、
 * 追加・整理のたびにコメントだけが取り残されていた。件数の見張りは
 * scripts/test-price.mjs の PRICE_DEFAULTS_COUNT（実配列と突き合わせ、増減したらその場で落ちる）
 * に任せる。ここに数を書き戻さないこと。
 *
 * 一般的なスーパーの相場を基準にした「常識的な水準」の目安であり、地域・店舗・時期で
 * 実際の価格とはズレる。ユーザーはいつでも「食材と価格」画面から書き換え・削除できる
 * （db/prices.ts の seedPriceDefaultsIfNeeded が初回起動時に1度だけ投入する）。
 *
 * unit は「数量＋単位」の自由記述（例:「100g」「1個」「1/4個」）。logic/priceEstimate.ts が
 * 数量として解釈できる場合、レシピの分量に応じた按分計算に使う（分数表記「1/4個」も
 * 2026-07-28 便BY/COST-01 から数量0.25として解釈する）。
 * 単位の次元が食い違う組（レシピ「1枚」×マスタ「100g」等）は、栄養側の目安量で
 * 両者をグラムに寄せてから按分する。それでも解釈できない書式だけ、
 * そのままの金額を1行分の目安として使う（按分なし）。
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
 *
 * 【2026-08-10 便EY・版6】上の「別途設計判断」がここで必要になった。「1パック」「1袋」という
 * 単位は按分の受け皿にならず、レシピが「6個」「2枚」と書いていてもパック1つ分の金額が
 * まるごと1行に乗る(いちご6個=400円・生しいたけ2枚=100円)。単位を直しただけでは既存ユーザーの
 * マスタ行は古い単位のままなので、PRICE_DEFAULT_UNIT_FIXES(下記)を使った
 * 「単位だけを直す1回限りの移行」をdb/prices.tsに追加した。対象は
 * 「投入時の目安のまま(isDefault=true)で、価格も単位も旧既定と一致する行」だけで、
 * ユーザーが1円でも書き換えた行・単位を変えた行・消した行には一切触れない。
 *
 * 【2026-08-10 便FA・版7】同じ「生のしいたけ」に対して「しいたけ 150円」と「生しいたけ 100円」の
 * 2項目が並んでいた（同じ食材なのに値段が違う）。オーナー裁定「生と乾燥を別項目として持ち、
 * 名前で区別する」に沿って、生の側を「生しいたけ」1項目（100円）に寄せ、「乾燥しいたけ」を
 * 別項目として足した。既存ユーザーの重複行は PRICE_DEFAULT_MERGES(下記)を使った
 * 「名寄せの1回限りの移行」で1行に畳む（対象は目安のままの行だけ）。
 *
 * 【2026-08-10 便FB・版8】上の乾燥側の項目名を「乾燥しいたけ」→「干ししいたけ」へ変更した
 * （オーナー指示「基本レシピの乾燥しいたけは、干ししいたけで統一してください。こっちのほうが
 * 一般的でした」）。価格・単位・出典は1文字も変えていない（400円/30g）。成分表側の食品名も
 * 元から「干ししいたけ」で、公開ページ public/about/foods.html だけが成分表の名前で出ていた
 * ため、価格マスタとページで名前が食い違っていた。この変更で両者が揃う。
 * 版7は約30分だけ本番に出ていたので、版7で作られた「乾燥しいたけ」の行を持つ端末がある。
 * PRICE_DEFAULT_MERGES に1件足して、便FAと同じ作法で「干ししいたけ」へ畳む。
 * 旧名「乾燥しいたけ」は logic/ingredientReadings.ts の別名として残すので、その名前で
 * 書いたレシピ・ユーザー入力は引き続き同じ1件に価格解決する。
 */
export const PRICE_DEFAULTS_VERSION = 9

/** 単位だけを直す移行の1件分（旧単位に一致する既定行だけを新単位へ書き換える） */
export interface PriceDefaultUnitFix {
  name: string
  /** この価格のままの行だけが対象（価格を書き換えた行＝ユーザーの値には触れない） */
  pricePerUnit: number
  fromUnit: string
  toUnit: string
}

/**
 * 2026-08-10 便EY「1パック丸ごと計上」の是正で単位だけを書き換えた項目（出典はdocs/49の
 * 2026-08-10節）。価格(円)は1件も変えていない＝「いくらか」ではなく「その金額が何に対する
 * 値段か」の書き方だけを直したので、既存ユーザーのマスタを更新しても金額の目安は動かず、
 * レシピ側の按分だけが正しくなる。
 * この配列はPRICE_DEFAULTS_VERSIONを上げたときに1回だけ適用される（db/prices.ts）。
 */
export const PRICE_DEFAULT_UNIT_FIXES: PriceDefaultUnitFix[] = [
  { name: 'いちご', pricePerUnit: 400, fromUnit: '1パック', toUnit: '280g' },
  // 2026-08-10 便FAで「しいたけ」は「生しいたけ」へ名寄せしたため、この1件は版7以降は空振りする
  // （読み仮名辞書で両者が同じキーになり、下の「生しいたけ」の指定に吸収される。
  //  版7の移行では PRICE_DEFAULT_MERGES が先に走って「しいたけ」の行そのものを畳むので、
  //  版5の端末から版7へ上がる場合もこの行を通らずに正しい姿になる）。
  // 便EYが何をしたかの記録として残す＝この配列から消さない
  { name: 'しいたけ', pricePerUnit: 150, fromUnit: '1パック', toUnit: '6枚' },
  { name: '生しいたけ', pricePerUnit: 100, fromUnit: '1パック', toUnit: '6枚' },
  { name: 'オクラ', pricePerUnit: 130, fromUnit: '1袋', toUnit: '10本' },
  { name: '小ねぎ', pricePerUnit: 80, fromUnit: '1袋', toUnit: '100g' },
  { name: '粉寒天', pricePerUnit: 50, fromUnit: '1袋', toUnit: '4g' },
  { name: 'ブルーベリー', pricePerUnit: 300, fromUnit: '1パック', toUnit: '100g' },
]

/**
 * 2つに分かれていた同じ食材を1行に畳む移行の1件分（2026-08-10 便FA）。
 * 項目名を変えたとき（便FB「乾燥しいたけ」→「干ししいたけ」）に旧名の行を新名へ移すのにも使う。
 */
export interface PriceDefaultMerge {
  /** 畳まれる側の項目名（この名前の行だけが対象。名前は完全一致で見る＝下の注記参照） */
  fromName: string
  /** 畳まれる側の旧既定の価格（この価格のままの行だけが対象） */
  fromPricePerUnit: number
  /** 畳まれる側の旧既定の単位（この単位のままの行だけが対象。版によって違うぶんは複数件並べる） */
  fromUnit: string
  /** 統合先の項目名（PRICE_DEFAULTS に在る名前） */
  toName: string
}

/**
 * 名寄せの1回限りの移行（2026-08-10 便FA）。
 *
 * 「しいたけ 150円」と「生しいたけ 100円」は同じ生のしいたけで、目安価格だけが違っていた。
 * PRICE_DEFAULTS からは「しいたけ」を落として「生しいたけ 100円」1本にしたが、
 * 既存ユーザーのマスタには「しいたけ」の行が残るため、この移行で1行に畳む。
 *
 * 畳む条件は unitFixesToApply と同じ「まだ何も手を加えていないと言い切れる行」だけ:
 * 価格・単位が旧既定のままで isDefault=true の行に限る。自分で価格を入れた行・単位を変えた行は
 * 1件も触らない（規約F。何が変わって何が残るかを説明できる線引きにする）。
 *
 * fromUnit を版ごとに2件並べているのは、版5の端末（単位が「1パック」のまま）と
 * 版6の端末（便EYで「6枚」に直った後）のどちらから上がってきても畳めるようにするため。
 *
 * 【名前は完全一致で見る】unitFixesToApply が使う「かな表記ゆれ込みの正規化」は、
 * 読み仮名辞書で「生しいたけ」も「しいたけ」も同じキーになるため、畳む側と統合先を区別できない。
 * ここだけは括弧と前後の空白を落とした素の名前で突き合わせる（対象は投入時の目安行なので、
 * 名前は投入したときの文字列そのままである）。
 *
 * 【2026-08-10 便FB】3件目は項目名の変更（「乾燥しいたけ」→「干ししいたけ」）の受け皿。
 * 版7が本番に出ていた短い間に「乾燥しいたけ 400円/30g」の行を受け取った端末があるので、
 * 目安のままのその行を「干ししいたけ」へ書き換える（統合先の行が無いので kind は rename に
 * なる＝行が増えも減りもしない）。版5・版6の端末はそもそもこの行を持たないので空振りし、
 * 下のトップアップ移行が「干ししいたけ」を1行追加する。どの版から上がっても同じ姿になる。
 */
export const PRICE_DEFAULT_MERGES: PriceDefaultMerge[] = [
  { fromName: 'しいたけ', fromPricePerUnit: 150, fromUnit: '6枚', toName: '生しいたけ' },
  { fromName: 'しいたけ', fromPricePerUnit: 150, fromUnit: '1パック', toName: '生しいたけ' },
  { fromName: '乾燥しいたけ', fromPricePerUnit: 400, fromUnit: '30g', toName: '干ししいたけ' },
]

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
  // 2026-08-10 便EY: 「1パック」は栄養側の目安量に無く按分できないため、1パックの中身の
  // 実数量(6枚前後)へ。価格は据え置き(出典・計算はdocs/49の2026-08-10節)
  // 2026-08-10 便FA: 旧「しいたけ 150円」と旧「生しいたけ 100円」は同じ生のしいたけだったので
  // 「生しいたけ 100円」1項目に名寄せした(オーナー指定「どちらかなら生しいたけ」)。
  // 素の「しいたけ」と書いたレシピも読み仮名辞書の名寄せでこの1件に解決する。
  // 乾燥のほうは下の乾物の並びに「干ししいたけ」として別項目で持つ(価格帯が全く違うため。
  // 2026-08-10 便FBで項目名を「乾燥しいたけ」から「干ししいたけ」へ変更した)
  { name: '生しいたけ', pricePerUnit: 100, unit: '6枚' },
  { name: 'にら', pricePerUnit: 100, unit: '1束' },
  // 2026-07-28 便BY/COST-01: 単位を「1個」→「1玉」へ。栄養側の目安量(nutritionData.tsの
  // にんにく unitGrams: 玉=45g・かけ=6g)が「個」を持たないため、レシピの「1かけ」から
  // 按分できず1かけでもマスタ金額60円が丸ごと乗っていた(同梱103品で15行)。
  // 価格は据え置き(にんにく1玉=1個で指すものは同じ)。「1玉」なら玉↔かけの換算が通り、
  // 「にんにく1かけ」は8円になる。
  { name: 'にんにく', pricePerUnit: 60, unit: '1玉' },
  { name: 'ブロッコリー', pricePerUnit: 200, unit: '1株' },
  { name: 'れんこん', pricePerUnit: 200, unit: '1節' },
  { name: '赤唐辛子', pricePerUnit: 10, unit: '1本' },
  { name: 'しょうが', pricePerUnit: 20, unit: '1かけ' },
  // 2026-08-10 便EY: 同上。1袋の実勢内容量(100g前後)へ。栄養側の目安量(小ねぎ 1本=5g)で
  // レシピの「2本」からグラムに寄せて按分できる。価格は据え置き
  { name: '小ねぎ', pricePerUnit: 80, unit: '100g' },
  { name: 'パセリ', pricePerUnit: 50, unit: '1束' },
  // 「三つ葉」(旧80円/1束)は下の「みつば」(100円/1束・docs/49の実売中央値)へ名寄せ統合した
  // (2026-07-23 便BH-1)。表記ゆれは logic/ingredientReadings.ts の「三つ葉→みつば」で吸収するので、
  // レシピ材料名が「三つ葉」でも「みつば」でも同じ1件に価格解決する(二重登録を解消)。
  { name: 'なめこ', pricePerUnit: 100, unit: '1袋' },
  { name: 'さつまいも', pricePerUnit: 100, unit: '1本' },
  { name: 'さんま', pricePerUnit: 150, unit: '1尾' },
  { name: 'すだち', pricePerUnit: 30, unit: '1個' },
  // 「人参」(40円/1本)は上の「にんじん」へ名寄せ統合した(2026-08-09 便EI。上の「三つ葉→みつば」と
  // 同じ整理)。表記ゆれは logic/ingredientReadings.ts の「人参→にんじん」で吸収するので、
  // レシピ材料名が「人参」でも同じ1件に価格解決する(二重登録の解消。値は両方40円/1本で同じだった)
  // 2026-07-28 便BY/COST-01: 「1パック」は栄養側の目安量に無く按分できないため、
  // 一般的な小売規格である枚数表記へ(価格は据え置き)。大葉・青じそは同じ食材の別表記。
  { name: '青じそ', pricePerUnit: 100, unit: '10枚' },
  { name: 'みょうが', pricePerUnit: 30, unit: '1個' },
  { name: '大葉', pricePerUnit: 100, unit: '10枚' },
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
  // 2026-07-28 便BY/COST-01: 同上。スライスの販売規格(4枚入り)で登録し、
  // レシピの「1枚」「2枚」から按分できるようにする(価格は据え置き)。
  { name: 'ハム', pricePerUnit: 150, unit: '4枚' },
  { name: 'ベーコン', pricePerUnit: 200, unit: '4枚' },
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
  // 2026-08-10 便FA: 生と乾燥を名前で区別する（オーナー裁定）にあたって足した乾燥の側。
  // 生しいたけ(100円/6枚)とは価格帯が全く違うので同じ値は使えない。スーパーの実売調査
  // （出典・計算はdocs/49の2026-08-10節「干ししいたけ」）で最も一般的な販売規格が30gで、
  // その実売が398円・415円だったため400円/30gに置く。栄養側の目安量(干ししいたけ 1枚=3g)で
  // レシピの「2枚」からグラムに寄せて按分できる（2枚=6g=80円）
  // 2026-08-10 便FB: 項目名を「乾燥しいたけ」→「干ししいたけ」に変更（オーナー指示。こちらが
  // 一般的な表記で、成分表・公開ページの食品名とも揃う）。価格・単位・出典は変えていない。
  // 旧名「乾燥しいたけ」は読み仮名辞書の別名として残るので、その表記のレシピもここに解決する
  { name: '干ししいたけ', pricePerUnit: 400, unit: '30g' },
  { name: 'きな粉', pricePerUnit: 15, unit: '大さじ1' },
  // 2026-08-10 便EY: 分包の規格(1本=4g)をそのまま単位にした。中身と同梱レシピの分量が元から
  // 一致していたため金額は変わらないが、4g以外を書いたときも按分が通るようになる
  { name: '粉寒天', pricePerUnit: 50, unit: '4g' },

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
  // 「味噌」(11円/大さじ1)は上の「みそ」へ名寄せ統合した(2026-08-09 便EI)。
  // 表記ゆれは logic/ingredientReadings.ts の「味噌→みそ」で吸収する(値は両方同じだった)
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
  // 2026-08-21 オーナー承認: 取り込んだレシピの「微粒子グラニュー糖」等が栄養では砂糖に
  // 当たるようになったのに、原価だけ当たらなかった（価格マスタに行が無かった）。
  // 目安価格は砂糖と同じ値にする（実売はやや高いことが多いが、目安なので設定の
  // 「食材の値段」でいつでも直せる、というのがオーナーの了承した前提）
  { name: 'グラニュー糖', pricePerUnit: 2, unit: '大さじ1' },
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
  // 2026-08-10 便EY: 1袋の実勢内容量(10本前後)へ。レシピの「8本」で按分104円になる
  { name: 'オクラ', pricePerUnit: 130, unit: '10本' },
  { name: '長芋', pricePerUnit: 80, unit: '100g' },
  // 「三つ葉」と「みつば」の名寄せ統合先(2026-07-23 便BH-1)。値はdocs/49の実売中央値=100円/1束。
  // ingredientReadings.ts の「三つ葉→みつば」で旧表記「三つ葉」もこの1件に価格解決する。
  { name: 'みつば', pricePerUnit: 100, unit: '1束' },
  { name: '万能ねぎ', pricePerUnit: 100, unit: '1束' },
  { name: 'まいたけ', pricePerUnit: 130, unit: '1パック' },
  { name: 'エリンギ', pricePerUnit: 100, unit: '1パック' },
  // 2026-08-10 便FA: ここにあった2件目の「生しいたけ」は上の野菜・きのこの並びへ1本化した
  // （便EYの時点では「しいたけ 150円」と「生しいたけ 100円」が同じ食材のまま並んでいた）
  { name: 'しらたき', pricePerUnit: 80, unit: '1袋' },
  { name: '昆布', pricePerUnit: 400, unit: '100g' },
  { name: '梅干し', pricePerUnit: 30, unit: '1個' },
  { name: 'プレーンヨーグルト', pricePerUnit: 50, unit: '100g' },
  { name: 'ピザ用チーズ', pricePerUnit: 300, unit: '200g' },
  { name: '豆乳', pricePerUnit: 200, unit: '1L' },
  { name: 'そうめん', pricePerUnit: 50, unit: '1束' },
  { name: 'グラノーラ', pricePerUnit: 500, unit: '1袋' },
  { name: 'こしあん', pricePerUnit: 450, unit: '300g' },
  // 2026-08-10 便EY: 1パックの実勢内容量(標準250〜300g・代表値280g)へ。栄養側の目安量
  // (いちご 1個=15g)でレシピの「6個」=90gに寄せて按分できる。価格は据え置き。
  // 粒数ではなく重量を単位にしたのは、いちごが重量で売られていて出典も重量が一次だから
  // (粒数はサイズで12〜50粒と幅が大きく、アプリ側の1個=15gと組み合わせると内容量が
  // 出典の250〜300gから外れてしまう)
  { name: 'いちご', pricePerUnit: 400, unit: '280g' },
  // 2026-08-10 便EY: 1パックの実勢内容量(100g前後)へ。同梱レシピでは「適量(お好みで)」でしか
  // 使っておらず金額は変わらないが、自分で登録したレシピがグラムで書いたときに按分が通る
  { name: 'ブルーベリー', pricePerUnit: 300, unit: '100g' },
  { name: 'キウイ', pricePerUnit: 100, unit: '1個' },
  { name: 'はちみつ', pricePerUnit: 40, unit: '大さじ1' },
  { name: 'オイスターソース', pricePerUnit: 30, unit: '大さじ1' },
  { name: 'コチュジャン', pricePerUnit: 10, unit: '小さじ1' },
  { name: 'カレー粉', pricePerUnit: 15, unit: '小さじ1' },
  { name: '白みそ', pricePerUnit: 15, unit: '大さじ1' },
  { name: 'レモン汁', pricePerUnit: 15, unit: '大さじ1' },
  { name: '粗びき黒こしょう', pricePerUnit: 10, unit: '小さじ1' },
  { name: '乾燥ハーブ', pricePerUnit: 20, unit: '小さじ1' },

  // ============ 2026-07-29 副菜6品(中華3・洋食3)の追加食材4件(PRICE_DEFAULTS_VERSION 4→5) ============
  // docs/61の副菜6品(チンゲン菜としいたけのにんにく炒め/白菜とにんじんの中華とろみ煮/
  // パプリカといんげんのオイスター炒め/かぼちゃのミルク煮/ラタトゥイユ/ブロッコリーとにんじんの
  // ハーブマリネ)で使う材料のうち、マスタに無かった4件。他の材料は登録済み。
  // docs/49と同じ流儀でWebSearchによる実売調査(スーパー/ネットスーパーの現行価格帯・販売単位ベースの
  // 中央値)を行い、レシピ内の実使用量でestimateIngredientYenが按分できる単位を選んである
  // (出典・計算はdocs/49 §2026-07-29)。
  // ・チンゲン菜: 1袋(2〜3株)の実勢中央≒170円税込 ÷ 中央2.5株 ≒ 68円/株 → 70円。レシピ「3株」で按分210円
  { name: 'チンゲン菜', pricePerUnit: 70, unit: '1株' },
  // ・赤パプリカ: 1個の実勢中央≒200円税込(輸入標準品。国内産は高級域)。レシピ「1個」で按分200円
  { name: '赤パプリカ', pricePerUnit: 200, unit: '1個' },
  // ・さやいんげん: 100gあたりの実勢中央≒200円税込。単位を「100g」にすることで、レシピの「15本」を
  //   栄養側の目安量(1本=7g)でグラムに寄せて按分できる(1袋等だと換算が通らず満額表示になる)
  { name: 'さやいんげん', pricePerUnit: 200, unit: '100g' },
  // ・かぼちゃ: 1/4カットの実勢中央≒210円税込。マスタの「1/4個」は栄養側の1個=可食部1000g基準で
  //   250g相当＝実売の400gカットよりやや小さいため、中央値をやや下回る200円にした。レシピ「1/4個」で按分200円
  { name: 'かぼちゃ', pricePerUnit: 200, unit: '1/4個' },
]
