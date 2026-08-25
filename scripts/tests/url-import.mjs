// URLからの取り込み（JSON-LD 抽出・Worker側 normalize・取り込みの行）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq } from './_harness.mjs'
import { scaleAmount } from '../../src/logic/amount.ts'
import { leadingRangeAmount } from '../../src/logic/amount.ts'
import {
  parseRecipeText,
  splitQuantity,
  normalizeImportedIngredient,
} from '../../src/logic/parseRecipeText.ts'
import { parseAmountNumber, computeRecipeNutrition } from '../../src/logic/nutrition.ts'
import {
  extractRecipeFromHtml,
  extractServings,
  parseIso8601DurationToMinutes,
  extractImageUrl,
  splitIngredientAmount,
  normalizeIngredients,
  normalizeInstructions,
} from '../../workers/recipe-import/src/normalize.ts'
import { buildImageProxyUrl, isImageContentType } from '../../src/logic/urlImportImage.ts'
import { resolveImportErrorReason } from '../../src/logic/urlImportReason.ts'
import {
  buildImportedIngredientRows,
  filterImportedSteps,
  seasoningGroupFromLetter,
  countAmountlessRows,
  stripImportedMarkup,
} from '../../src/logic/urlImportRows.ts'
import { ja } from '../../src/i18n/ja.ts'

// ---- extractServings: recipeYieldの表記ゆれ ----
eq('servings: 「2人前」', extractServings('2人前'), 2)
eq('servings: 「4人分」', extractServings('4人分'), 4)
eq('servings: 全角「２人分」', extractServings('２人分'), 2)
eq('servings: 「4 servings」', extractServings('4 servings'), 4)
eq('servings: 「4(servings)」', extractServings('4(servings)'), 4)
eq('servings: 数字のみ「2」', extractServings('2'), 2)
// 「人分/人前」が無い裸の範囲(rakutenレシピの実例「2~3」相当)には人分直前ルールが使えないため、
// 単純に最初の数字(範囲の下限)を採用する(「人分」付きの範囲とは挙動が異なる。次のケースと対比)
eq('servings: 「人分」なし裸の範囲「2〜3」は最初の数字(下限)を採用', extractServings('2〜3'), 2)
eq('servings: 範囲「3〜4人分」は人分直前の数字を採用', extractServings('3〜4人分'), 4)
eq('servings: 数字なし「その他」はundefined(必須項目にしない)', extractServings('その他'), undefined)
eq('servings: 配列なら先頭要素', extractServings(['4人分', '4 servings']), 4)
eq('servings: undefined入力はundefined', extractServings(undefined), undefined)
// 2026-07-20 URL取り込み品質監査(docs/43)で実測: recipeYieldがJSON上の素の数値(文字列でない)の
// サイトがある(macaroni)。firstStringが数値を文字列化しないと丸ごと欠落していた
eq('servings: JSON数値そのもの(macaroni実測)', extractServings(2), 2)
// クックパッド「鶏もも肉600gで作る分量」→600人分、DELISH KITCHEN「26個分」→26人分のような
// 誤爆を実測(重量・個数の数字を人数と取り違える)。直後に重量・個数単位が続く数字は人数の
// フォールバック対象から除外し、他に使える数字が無ければundefinedを返す
eq('servings: 重量表記(600g)を人数と誤認しない', extractServings('鶏もも肉600gで作る分量'), undefined)
eq('servings: 「26個分」を人数と誤認しない', extractServings('26個分'), undefined)
eq(
  'servings: 重量の数字(先頭)を飛ばして後続の裸の数字を拾う',
  extractServings('600g / 3'),
  3,
)

// ---- parseIso8601DurationToMinutes: 分表記・秒表記の両対応(docs/39 DELISH KITCHENの秒表記対策) ----
eq('duration: 「PT30M」→30分', parseIso8601DurationToMinutes('PT30M'), 30)
eq('duration: 「PT1800S」(秒表記)→30分', parseIso8601DurationToMinutes('PT1800S'), 30)
eq('duration: 「PT1H」→60分', parseIso8601DurationToMinutes('PT1H'), 60)
eq('duration: 「PT1H15M」→75分', parseIso8601DurationToMinutes('PT1H15M'), 75)
eq('duration: 不正な文字列はundefined', parseIso8601DurationToMinutes('約30分'), undefined)
eq('duration: undefined入力はundefined', parseIso8601DurationToMinutes(undefined), undefined)

// ---- extractImageUrl: 文字列/配列/オブジェクト/オブジェクト配列 ----
eq('image: 文字列', extractImageUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg')
eq('image: 文字列配列は先頭', extractImageUrl(['https://example.com/a.jpg', 'https://example.com/b.jpg']), 'https://example.com/a.jpg')
eq('image: {url}オブジェクト', extractImageUrl({ url: 'https://example.com/c.jpg' }), 'https://example.com/c.jpg')
eq('image: {@id}オブジェクト(ImageObjectの@id形式)', extractImageUrl({ '@id': 'https://example.com/id.jpg' }), 'https://example.com/id.jpg')
eq('image: {url}オブジェクトの配列', extractImageUrl([{ url: 'https://example.com/d.jpg' }]), 'https://example.com/d.jpg')
eq('image: undefinedはundefined', extractImageUrl(undefined), undefined)
// 2026-07-21 画像取り込み対応: 相対URLはbaseUrl(sourceUrl)を基準に絶対URL化する
eq(
  'image: 相対URL(ルート相対)をbaseUrlで絶対URL化',
  extractImageUrl('/img/recipe/123.jpg', 'https://cookpad.example.com/recipes/1'),
  'https://cookpad.example.com/img/recipe/123.jpg',
)
eq(
  'image: 相対URL(パス相対)をbaseUrlで絶対URL化',
  extractImageUrl('recipe123.jpg', 'https://example.com/recipes/'),
  'https://example.com/recipes/recipe123.jpg',
)
eq(
  'image: プロトコル相対URL(//)をbaseUrlのスキームで絶対URL化',
  extractImageUrl('//cdn.example.com/a.jpg', 'https://example.com/recipes/1'),
  'https://cdn.example.com/a.jpg',
)
eq(
  'image: 既に絶対URLならbaseUrlと違うドメインでもそのまま',
  extractImageUrl('https://cdn.other.com/a.jpg', 'https://example.com/recipes/1'),
  'https://cdn.other.com/a.jpg',
)
eq(
  'image: {url}オブジェクトの相対URLも絶対URL化される',
  extractImageUrl({ url: '/img/e.jpg' }, 'https://example.com/recipes/1'),
  'https://example.com/img/e.jpg',
)
eq('image: baseUrl未指定なら相対URLのまま返す(従来挙動を保つ)', extractImageUrl('/img/f.jpg'), '/img/f.jpg')
eq(
  'image: baseUrl自体が壊れていても元の文字列をそのまま返す',
  extractImageUrl('/img/g.jpg', 'not-a-url'),
  '/img/g.jpg',
)

// ---- splitIngredientAmount: name+amountの分離(unit分解はapp側splitQuantityに委ねる) ----
eq('ingredient: 空白区切り「しょうゆ 大さじ2」', splitIngredientAmount('しょうゆ 大さじ2'), { name: 'しょうゆ', amount: '大さじ2' })
eq('ingredient: 全角空白区切り「豚肉　200g」', splitIngredientAmount('豚肉　200g'), { name: '豚肉', amount: '200g' })
eq('ingredient: 全角数字「にんじん　１本」→半角化', splitIngredientAmount('にんじん　１本'), { name: 'にんじん', amount: '1本' })
eq('ingredient: くっつき(区切りなし)「そうめん4ワ」', splitIngredientAmount('そうめん4ワ'), { name: 'そうめん', amount: '4ワ' })
eq('ingredient: 三点リーダー区切り「じゃがいも…2個」', splitIngredientAmount('じゃがいも…2個'), { name: 'じゃがいも', amount: '2個' })
eq('ingredient: 分量なしのグループ見出し「合わせ調味料」', splitIngredientAmount('合わせ調味料'), { name: '合わせ調味料' })
eq('ingredient: 括弧付き分量「じゃがいも 3個(450g)」', splitIngredientAmount('じゃがいも 3個(450g)'), { name: 'じゃがいも', amount: '3個(450g)' })
eq('ingredient: 先頭の中黒を除去「・鶏もも肉 200g」', splitIngredientAmount('・鶏もも肉 200g'), { name: '鶏もも肉', amount: '200g' })
// 2026-07-20 URL取り込み品質監査(docs/43)で実測: 味の素パークは合わせ調味料のグループ記号(A/B)が
// 区切りなしで名前の先頭にくっつく(「Ａ水」「Bみりん」「A「ほんだし®」」)。オレンジページは
// グループ記号だけの行(「A」)が単独の配列要素として存在する
// 2026-07-28 便BX/C08: 記号は名前から剥がすが捨てずに group として返す(手順文の「Aを加えて」が
// どの材料を指すのか取り込み後に完全に失われていた。名前は無記号のままなので栄養・原価の照合は不変)
eq('ingredient: グループ記号は名前から剥がしgroupに残す「Ａ水　2カップ」', splitIngredientAmount('Ａ水　2カップ'), { name: '水', amount: '2カップ', group: 'A' })
eq('ingredient: グループ記号(半角)もgroupに残す「B砂糖 大さじ1」', splitIngredientAmount('B砂糖 大さじ1'), { name: '砂糖', amount: '大さじ1', group: 'B' })
eq(
  'ingredient: グループ記号+括弧書き商品名「A「ほんだし®」 小さじ1」',
  splitIngredientAmount('A「ほんだし®」 小さじ1'),
  { name: '「ほんだし®」', amount: '小さじ1', group: 'A' },
)
eq('ingredient: グループ記号が無ければgroupは付かない', splitIngredientAmount('しょうゆ 大さじ2'), { name: 'しょうゆ', amount: '大さじ2' })
// 2026-07-28 便BX/C15(楽天レシピ実測): 材料欄の区切り線が材料1件として取り込まれ、
// 保存後の材料表・買い物リストにも「ーーーーーーーーーー」が残っていた
eq('ingredient/C15: 全角長音符の区切り線は材料にしない', splitIngredientAmount('ーーーーーーーーーーーーーーーーーーー'), { name: '' })
eq('ingredient/C15: 全角イコールの区切り線も材料にしない', splitIngredientAmount('＝＝＝＝＝＝'), { name: '' })
eq('ingredient/C15: 記号2文字までは巻き込まない(実在の材料名を守る)', splitIngredientAmount('ーー'), { name: 'ーー' })
eq('ingredient/C15: 普通の材料名は影響なし', splitIngredientAmount('じゃがいも 3個'), { name: 'じゃがいも', amount: '3個' })
eq('ingredient: グループ記号のみの行は空扱い(呼び出し側で除外)', splitIngredientAmount('A'), { name: '' })
eq('ingredient: グループ記号のみ(全角)も空扱い', splitIngredientAmount('Ｂ'), { name: '' })
// レタスクラブ実測:「大さじ2　1/2」(整数と分数の間に区切りの空白)が入ると、素朴な「末尾の空白で
// 名前/分量を分ける」ロジックが整数側まで名前に取り込んでしまう不具合。整数+分数を先に1個の
// 小数トークンへ畳んでから分離することで正しく分かれる
eq(
  'ingredient: 空白区切りの帯分数「しょうゆ…大さじ2　1/2」を正しく分離',
  splitIngredientAmount('しょうゆ…大さじ2　1/2'),
  { name: 'しょうゆ', amount: '大さじ2.5' },
)

// ---- normalizeIngredients: 配列のまとめ処理(空要素・文字列以外は無視) ----
eq(
  'ingredients: 配列一括',
  normalizeIngredients(['じゃがいも 3個', 'しょうゆ 大さじ2', '塩　少々']),
  [
    { name: 'じゃがいも', amount: '3個' },
    { name: 'しょうゆ', amount: '大さじ2' },
    { name: '塩', amount: '少々' },
  ],
)
eq('ingredients: undefinedは空配列', normalizeIngredients(undefined), [])

// ---- normalizeImportedIngredient: URL取り込み(Worker側 name+amount)を貼り付け経路と同一資産で正規化 ----
// 経路統一の要(2026-07-23)。Worker側は「末尾の空白で名前と分量を切る」ため、コロン書式・括弧グラム
// 併記だとname側に分量が食い込む。normalizeImportedIngredientはname+amountを元の1行に組み直し、
// 貼り付け側のparseIngredientLine(コロン/全半角スペース/末尾括弧グラム併記対応)で解釈し直す。
eq('取り込み正規化: 既に正しく分かれている「鶏もも肉」+「300g」', normalizeImportedIngredient('鶏もも肉', '300g'), { name: '鶏もも肉', amount: '300', unit: 'g' })
eq('取り込み正規化: 前置単位「しょうゆ」+「大さじ2」', normalizeImportedIngredient('しょうゆ', '大さじ2'), { name: 'しょうゆ', amount: '2', unit: '大さじ' })
eq('取り込み正規化: コロン書式でnameに分量が食い込んだWorker出力「木綿豆腐: 75」+「g」', normalizeImportedIngredient('木綿豆腐: 75', 'g'), { name: '木綿豆腐', amount: '75', unit: 'g' })
eq('取り込み正規化: 括弧グラム併記(小さじ)「白ごま: 小さじ1/3 (1」+「g)」', normalizeImportedIngredient('白ごま: 小さじ1/3 (1', 'g)'), { name: '白ごま', amount: '1/3', unit: '小さじ', memo: '1 g' })
eq('取り込み正規化: 全角スペース区切り相当「木綿豆腐」+「75g」', normalizeImportedIngredient('木綿豆腐', '75g'), { name: '木綿豆腐', amount: '75', unit: 'g' })
eq('取り込み正規化: 分量なしのグループ見出しは名前だけ残す', normalizeImportedIngredient('合わせ調味料', undefined), { name: '合わせ調味料', amount: '', unit: '' })

// ---- 崩れ実例の再現(おいしい健康 https://oishi-kenko.com/recipes/22619)。schema.orgの材料文字列群を
// Worker splitIngredientAmount → client normalizeImportedIngredient のフルパイプラインに通し、
// 「木綿豆腐/75/g」「白ごま/小さじ1/3」「ごま油/小さじ1/2」に分解され、栄養計算対象外が0件になることを固定 ----
{
  const rawSchemaIngredients = ['木綿豆腐: 75 g', '白ごま: 小さじ1/3 (1 g)', 'ごま油: 小さじ1/2 (2 g)']
  const parsed = rawSchemaIngredients.map((raw) => {
    const w = splitIngredientAmount(raw) // Worker側の name+amount 分割(現状の実装のまま=コロン/括弧gに弱い)
    return normalizeImportedIngredient(w.name, w.amount) // client側で経路統一の正規化をかけて修復する
  })
  eq('URL崩れ再現: 木綿豆腐→75/g', parsed[0], { name: '木綿豆腐', amount: '75', unit: 'g' })
  eq('URL崩れ再現: 白ごま→小さじ1/3(括弧gはmemoへ)', parsed[1], { name: '白ごま', amount: '1/3', unit: '小さじ', memo: '1 g' })
  eq('URL崩れ再現: ごま油→小さじ1/2(括弧gはmemoへ)', parsed[2], { name: 'ごま油', amount: '1/2', unit: '小さじ', memo: '2 g' })
  const nut = computeRecipeNutrition({
    servings: 2,
    ingredients: parsed.map((p) => ({ name: p.name, amount: p.amount, unit: p.unit, memo: p.memo ?? '' })),
  })
  eq('URL崩れ再現: 栄養計算対象外が0件(白ごま・ごま油が数値化できる)', nut.excluded.length, 0)
  eq('URL崩れ再現: 3材料すべて栄養計算に含まれる', nut.items.length, 3)
}

// ---- normalizeInstructions: 文字列配列/HowToStep配列/HowToSection入れ子/単一長文字列 ----
eq(
  'instructions: 文字列配列',
  normalizeInstructions(['じゃがいもを切る', '鍋で煮る']),
  ['じゃがいもを切る', '鍋で煮る'],
)
eq(
  'instructions: HowToStep配列',
  normalizeInstructions([
    { '@type': 'HowToStep', text: 'じゃがいもを切る' },
    { '@type': 'HowToStep', text: '鍋で煮る' },
  ]),
  ['じゃがいもを切る', '鍋で煮る'],
)
eq(
  'instructions: HowToSection入れ子(itemListElementを展開)',
  normalizeInstructions([
    {
      '@type': 'HowToSection',
      name: '下ごしらえ',
      itemListElement: [
        { '@type': 'HowToStep', text: '野菜を切る' },
        { '@type': 'HowToStep', text: '肉を切る' },
      ],
    },
    { '@type': 'HowToStep', text: '炒める' },
  ]),
  ['野菜を切る', '肉を切る', '炒める'],
)
eq(
  'instructions: 単一長文字列を番号で分割(E・レシピ形式)',
  normalizeInstructions('作り方1. じゃがいもの皮をむいて切る。2. 鍋に入れて煮る。3. 味付けする。'),
  ['じゃがいもの皮をむいて切る。', '鍋に入れて煮る。', '味付けする。'],
)
eq(
  'instructions: HTMLタグ・実体参照を除去(nadia形式のリンク混入対策)',
  normalizeInstructions(['にんじんは<a href="/wordlist/乱切り">乱切り</a>にする&amp;混ぜる']),
  ['にんじんは乱切りにする&混ぜる'],
)
eq('instructions: undefinedは空配列', normalizeInstructions(undefined), [])

// 2026-07-28 便BX/C14(楽天レシピ実測): HowToStep配列の各要素の先頭に元サイトの番号(①②)が
// 付いていると、アプリ側が自前で振る番号と並んで「1 ①じゃがいもは…」の二重表示になる
eq(
  'instructions/C14: 各要素の先頭の丸数字を剥がす(アプリ側の番号と二重にしない)',
  normalizeInstructions([
    { '@type': 'HowToStep', text: '①じゃがいもは4等分し、水にさらす' },
    { '@type': 'HowToStep', text: '②鍋にサラダ油をひき、肉を炒める' },
  ]),
  ['じゃがいもは4等分し、水にさらす', '鍋にサラダ油をひき、肉を炒める'],
)
eq(
  'instructions/C14: 「1.」形式の先頭番号も剥がす',
  normalizeInstructions([{ '@type': 'HowToStep', text: '1. 材料を切る' }]),
  ['材料を切る'],
)
eq(
  'instructions/C14: 先頭以外の番号は本文なので残す',
  normalizeInstructions([{ '@type': 'HowToStep', text: 'フライパンに2を入れて炒める' }]),
  ['フライパンに2を入れて炒める'],
)
// C11: 1要素に複数手順が連結されているときだけ割る。分量表記(「大さじ2、みりん大さじ1」)を
// 手順番号と誤認しないよう、要素内の分割は丸数字・角括弧数字だけを手がかりにする
eq(
  'instructions/C11: 1要素に連結された複数手順(丸数字)を割る',
  normalizeInstructions([{ '@type': 'HowToStep', text: '①野菜を切る。②鍋で煮る。③盛り付ける。' }]),
  ['野菜を切る。', '鍋で煮る。', '盛り付ける。'],
)
eq(
  'instructions/C11: 分量の「大さじ2、」を手順番号と誤認して割らない',
  normalizeInstructions([
    { '@type': 'HowToStep', text: 'しょうゆ大さじ2、みりん大さじ1、砂糖大さじ1を加えて煮る' },
    { '@type': 'HowToStep', text: '器に盛る' },
  ]),
  ['しょうゆ大さじ2、みりん大さじ1、砂糖大さじ1を加えて煮る', '器に盛る'],
)
eq(
  'instructions/C11: マーカーが1個だけなら割らない(先頭剥がしのみ)',
  normalizeInstructions([{ '@type': 'HowToStep', text: '①玉ねぎは1cm幅に切る' }]),
  ['玉ねぎは1cm幅に切る'],
)

// 2026-07-28 便BX/C07(DELISH KITCHEN実測): 媒体そのものの宣伝が料理名に残り、レシピ一覧・
// 献立・買い物リストにまで出ていた。キャッチコピー全般ではなく完全一致リテラルだけを剥がす
{
  const titleOf = (name) =>
    extractRecipeFromHtml(
      `<script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name,
        recipeIngredient: ['じゃがいも 3個'],
        recipeInstructions: ['煮る'],
      })}</script>`,
      'https://example.com/r',
    ).title
  eq('title/C07: 「作り方が動画でわかる！」を剥がす', titleOf('作り方が動画でわかる！おすすめ具材で作る基本の肉じゃが'), 'おすすめ具材で作る基本の肉じゃが')
  eq('title/C07: レシピごとに違うキャッチコピーは剥がさない', titleOf('牛でも豚でも！ 簡単具材の肉じゃが'), '牛でも豚でも！ 簡単具材の肉じゃが')
  eq('title/C07: 「上品な仕上がり♪」も無傷', titleOf('上品な仕上がり♪ 白だしで作る肉じゃが'), '上品な仕上がり♪ 白だしで作る肉じゃが')
  eq('title/C07: 「簡単！肉じゃが」も無傷', titleOf('簡単！肉じゃが'), '簡単！肉じゃが')
  eq('title/C07: 末尾の定型句の除去は従来どおり', titleOf('肉じゃがの作り方'), '肉じゃが')
}

// 2026-07-20 URL取り込み品質監査(docs/43)で実測: ミツカンはHowToStepが1個しかなく、その中に
// 「[1]…[2]…」のように複数手順が角括弧番号でまとめて詰め込まれている。HowToStepが1個だけに
// なった結果へ番号分割を再適用することで正しく複数手順に割り直す(通常の複数HowToStep配列は
// これまでどおり触らない)
eq(
  'instructions: HowToStep1個に複数手順が角括弧番号でまとまっている場合は分割する(ミツカン形式)',
  normalizeInstructions([
    { '@type': 'HowToStep', text: '[1]野菜を切る。[2]鍋に油を熱し、[1]の野菜を炒める。[3]煮汁を加えて煮る。' },
  ]),
  ['野菜を切る。', '鍋に油を熱し、[1]の野菜を炒める。', '煮汁を加えて煮る。'],
)
// 「[2]鍋に油を熱し、[1]の野菜を炒める。」の中の「[1]の」は前の手順への参照であって新しい手順の
// 開始ではない(番号直後が助詞「の」で始まるため分割しない=STEP_MARKER_FOLLOWED_BY_PARTICLE)。
// 上のテストで手順2に「[1]の野菜を炒める」がそのまま残っていることが、参照ガードが効いている証拠
eq(
  'instructions: 角括弧番号は全角数字でも認識する',
  normalizeInstructions([{ '@type': 'HowToStep', text: '［１］下ごしらえをする。［２］焼く。' }]),
  ['下ごしらえをする。', '焼く。'],
)
// E・レシピ実測:「作り方1. …作り方2. …」のようにラベル語が番号ごとに繰り返されると、末尾の
// 「作り方」が前の手順の末尾に残ってしまっていた不具合(番号側にラベルがくっついていれば
// マーカーとしてまるごと消費する)
eq(
  'instructions: 番号ごとに繰り返されるラベル語が手順末尾に残らない(E・レシピ形式)',
  normalizeInstructions('作り方1. 材料を切る。 作り方2. 炒める。 作り方3. 盛り付ける。'),
  ['材料を切る。', '炒める。', '盛り付ける。'],
)
// E・レシピ実測:「(1)のタネを大さじ1位のせ」のような前の手順への参照を、新しい手順番号と
// 誤認して余計な空ステップ(「(」だけの手順)を作らないことの回帰確認
eq(
  'instructions: 「(1)の」参照は新しい手順として分割しない',
  normalizeInstructions('作り方1. 皮でタネを包む。 作り方2. (1)の生地を焼く。'),
  ['皮でタネを包む。', '(1)の生地を焼く。'],
)

// ---- extractRecipeFromHtml: JSON-LD抽出パイプライン全体(合成HTML) ----
function ldJsonHtml(json) {
  return `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`
}

{
  // 基本形: 単体Recipeオブジェクト・recipeYield「2人前」・cookTime分表記
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個', '牛こま切れ肉 200g', 'しょうゆ 大さじ2'],
    recipeInstructions: ['じゃがいもを切る', '鍋で煮る'],
    recipeYield: '2人前',
    cookTime: 'PT30M',
    image: 'https://example.com/nikujaga.jpg',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/1')
  eq('extractRecipeFromHtml: 基本形タイトル', r?.title, '肉じゃが')
  eq('extractRecipeFromHtml: 基本形材料3件', r?.ingredients, [
    { name: 'じゃがいも', amount: '3個' },
    { name: '牛こま切れ肉', amount: '200g' },
    { name: 'しょうゆ', amount: '大さじ2' },
  ])
  eq('extractRecipeFromHtml: 基本形手順2件', r?.steps, ['じゃがいもを切る', '鍋で煮る'])
  eq('extractRecipeFromHtml: 基本形servings', r?.servings, 2)
  eq('extractRecipeFromHtml: 基本形cookMinutes', r?.cookMinutes, 30)
  eq('extractRecipeFromHtml: 基本形imageUrl', r?.imageUrl, 'https://example.com/nikujaga.jpg')
  eq('extractRecipeFromHtml: 基本形sourceUrlは引数のURL', r?.sourceUrl, 'https://example.com/recipe/1')
}

{
  // @graph形式: WebSite等のノードに混ざってRecipeが入っている
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', name: 'サンプルレシピサイト' },
      {
        '@type': ['Recipe'],
        name: 'カレーライス',
        recipeIngredient: ['じゃがいも 2個', 'カレールー 1箱'],
        recipeInstructions: [
          { '@type': 'HowToStep', text: '野菜を切る' },
          { '@type': 'HowToStep', text: '煮込む' },
        ],
        recipeYield: '4 servings',
      },
    ],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/2')
  eq('extractRecipeFromHtml: @graph形式でもRecipeを発見', r?.title, 'カレーライス')
  eq('extractRecipeFromHtml: @graph形式・@typeが配列でも検出', r?.steps, ['野菜を切る', '煮込む'])
  eq('extractRecipeFromHtml: @graph形式のrecipeYield「4 servings」', r?.servings, 4)
}

{
  // 配列ルート形式
  const html = ldJsonHtml([
    { '@type': 'Organization', name: 'サンプル' },
    {
      '@type': 'Recipe',
      name: '親子丼',
      recipeIngredient: ['卵 2個', '鶏もも肉 100g'],
      recipeInstructions: '作り方1. 鶏肉を煮る。2. 卵でとじる。',
      cookTime: 'PT1800S',
    },
  ])
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/3')
  eq('extractRecipeFromHtml: 配列ルート形式でもRecipeを発見', r?.title, '親子丼')
  eq('extractRecipeFromHtml: 単一長文字列instructionsも番号分割', r?.steps, ['鶏肉を煮る。', '卵でとじる。'])
  eq('extractRecipeFromHtml: cookTime秒表記(PT1800S)→30分', r?.cookMinutes, 30)
}

{
  // JSON-LD内に生の制御文字(改行)が文字列リテラル中に混入するケース(ミツカン実例の再現)。
  // JSON.stringifyでは作れないため、素朴なJSON.parseが失敗する壊れたJSON-LD文字列を直接組み立てる
  const brokenJsonLd =
    '{"@context":"https://schema.org","@type":"Recipe","name":"筑前煮",' +
    '"recipeIngredient":["れんこん 150g","鶏もも肉 300g"],' +
    '"recipeInstructions":["野菜を\n炒める","煮込む"]}'
  const html = `<!doctype html><html><head><script type="application/ld+json">${brokenJsonLd}</script></head><body></body></html>`
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/4')
  eq('extractRecipeFromHtml: 制御文字混入JSON-LDもサニタイズして復旧', r?.title, '筑前煮')
  // サニタイズでJSON.parse自体は復旧する。埋め込まれていた改行はcleanTextの空白正規化で
  // 半角スペース1つにまとまる(手順文を1行の読みやすい文として扱う設計。改行の保持が目的ではない)
  eq('extractRecipeFromHtml: サニタイズ後も手順が読める(改行は空白に正規化)', r?.steps, ['野菜を 炒める', '煮込む'])
}

{
  // Recipe型のJSON-LDが存在しない(白ごはん.com・S&B相当) → no_recipeとして扱うためundefinedを返す
  const html = ldJsonHtml({ '@context': 'https://schema.org', '@type': 'Article', headline: 'コラム記事' })
  const r = extractRecipeFromHtml(html, 'https://example.com/article')
  eq('extractRecipeFromHtml: Recipe型が無ければundefined(no_recipe)', r, undefined)
}

{
  // JSON-LD自体が存在しない
  const html = '<!doctype html><html><head></head><body>レシピはありません</body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/none')
  eq('extractRecipeFromHtml: JSON-LDが無ければundefined', r, undefined)
}

{
  // Recipe型はあるが中核3項目(材料・手順)が空 → undefined(name/ingredients/stepsが必須)
  const html = ldJsonHtml({ '@context': 'https://schema.org', '@type': 'Recipe', name: 'タイトルのみ' })
  const r = extractRecipeFromHtml(html, 'https://example.com/incomplete')
  eq('extractRecipeFromHtml: 材料・手順が空ならundefined', r, undefined)
}

{
  // 2026-07-20 URL取り込み品質監査(docs/43)で実測: 山本ゆり(syunkon)は投稿名の末尾に「の作り方」が
  // 付いたままJSON-LDのnameに入っている。貼り付けパーサーM7(src/logic/parseRecipeText.ts)と同じ
  // 末尾整形資産をURL取り込み側にも適用し、末尾の定型句を落とす
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '究極のフライドポテトの作り方',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['切る', '揚げる'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/5')
  eq('extractRecipeFromHtml: タイトル末尾「の作り方」を除去(M7資産の流用)', r?.title, '究極のフライドポテト')
}

{
  // Nadia実測:「定番美味しい！基本の【ハンバーグ】のレシピ」のように、投稿者が定型句として
  // 「〇〇のレシピ」で終わるタイトルを付けるサイトがある。M7は空白区切りの「レシピ」しか
  // 剥がさないため(SMK-02回帰対策)、「の」接続も安全に剥がせる追加ケースとして対応する
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '基本のハンバーグのレシピ',
    recipeIngredient: ['合いびき肉 300g'],
    recipeInstructions: ['こねる', '焼く'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/6')
  eq('extractRecipeFromHtml: タイトル末尾「〇〇のレシピ」(の接続)を除去', r?.title, '基本のハンバーグ')
}

{
  // 2026-07-16 SMK-02回帰(便Iの事故)の再発防止: 空白なし・「の」なしで「レシピ」に連結している
  // 名前(「試験用レシピ」等、料理名の一部としてレシピで終わる名前)は剥がさない
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '試験用レシピ',
    recipeIngredient: ['塩 少々'],
    recipeInstructions: ['混ぜる'],
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/7')
  eq('extractRecipeFromHtml: SMK-02回帰確認・連結した「レシピ」は剥がさない', r?.title, '試験用レシピ')
}

{
  // 2026-07-20 URL取り込み品質監査(docs/43)で実測: NHK・キッコーマン・味の素パーク・ハウス食品・
  // 楽天レシピ・つくおき等はcookTimeが空でtotalTimeにだけ調理時間が入っている。cookTimeしか
  // 見ていなかった実装では7サイト分のcookMinutesが丸ごと欠落していた
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['煮る'],
    totalTime: 'PT25M',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/8')
  eq('extractRecipeFromHtml: cookTimeが無くてもtotalTimeから調理時間を拾う', r?.cookMinutes, 25)
}

{
  // 2026-07-21 画像取り込み対応: imageがルート相対URLのサイト実測(サイトによってはimageに
  // フルURLではなくパスのみを入れている)を想定し、sourceUrlを基準に絶対URL化されることを確認する
  const html = ldJsonHtml({
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: '肉じゃが',
    recipeIngredient: ['じゃがいも 3個'],
    recipeInstructions: ['煮る'],
    image: '/img/nikujaga.jpg',
  })
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/9')
  eq('extractRecipeFromHtml: 相対URLのimageはsourceUrlを基準に絶対URL化される', r?.imageUrl, 'https://example.com/img/nikujaga.jpg')
}

// ---- buildImageProxyUrl / isImageContentType(src/logic/urlImportImage.ts、写真自動取り込み2026-07-21) ----
eq(
  'buildImageProxyUrl: エンドポイント+/image?url=に画像URLをencodeURIComponentして付ける',
  buildImageProxyUrl('https://recipe-import.example.workers.dev', 'https://cdn.example.com/a b.jpg'),
  'https://recipe-import.example.workers.dev/image?url=https%3A%2F%2Fcdn.example.com%2Fa%20b.jpg',
)
eq('isImageContentType: image/jpegはtrue', isImageContentType('image/jpeg'), true)
eq('isImageContentType: セミコロン以降のcharset付きでもtrue', isImageContentType('image/png; charset=binary'), true)
eq('isImageContentType: 大文字混在でもtrue', isImageContentType('Image/WEBP'), true)
eq('isImageContentType: text/htmlはfalse', isImageContentType('text/html'), false)
eq('isImageContentType: nullはfalse', isImageContentType(null), false)
eq('isImageContentType: undefinedはfalse', isImageContentType(undefined), false)
eq('isImageContentType: 空文字はfalse', isImageContentType(''), false)

// ---- resolveImportErrorReason(src/logic/urlImportReason.ts、2026-07-28 便BX/C04・C05) ----
// 実機QAで「404・サイト側の拒否・一時的な通信不調・URLの打ち間違い」が全部同じ文言に潰れ、
// 404に対して「時間をおいて試す」という絶対に解決しない案内が出ていた回帰の防止。
eq('reason: 上流404はnot_found(URLを直すべき)', resolveImportErrorReason('fetch_failed', 404), 'not_found')
eq('reason: 上流410(消滅)もnot_found', resolveImportErrorReason('fetch_failed', 410), 'not_found')
eq('reason: 上流403(サイト側の拒否)はblocked', resolveImportErrorReason('fetch_failed', 403), 'blocked')
eq('reason: 上流401もblocked', resolveImportErrorReason('fetch_failed', 401), 'blocked')
eq('reason: 上流451もblocked', resolveImportErrorReason('fetch_failed', 451), 'blocked')
eq('reason: 上流500は一時障害扱いのままfetch_failed', resolveImportErrorReason('fetch_failed', 500), 'fetch_failed')
eq('reason: 上流503も一時障害扱い', resolveImportErrorReason('fetch_failed', 503), 'fetch_failed')
eq('reason: statusが無い(通信例外)ならfetch_failed', resolveImportErrorReason('fetch_failed', undefined), 'fetch_failed')
// invalid_url は「Workerがリクエストを受け付けなかった」判断なので、HTTPステータスで上書きしない
// (Workerは invalid_url を必ずHTTP400で返すため、ここを取り違えると死に文言に戻る)
eq('reason: invalid_urlはstatusに関係なくinvalid_url', resolveImportErrorReason('invalid_url', 400), 'invalid_url')
eq('reason: no_recipeはそのまま', resolveImportErrorReason('no_recipe', 200), 'no_recipe')
eq('reason: 未知のerror値はfetch_failedに落とす', resolveImportErrorReason('something_new', 404), 'not_found')
eq('reason: errorが無くてもfetch_failed', resolveImportErrorReason(undefined, undefined), 'fetch_failed')

// ---- urlImportRows(src/logic/urlImportRows.ts、2026-07-28 便BX/C07・C08・C09) ----
// C07: 貼り付け経路のゴミ行判定をURL取り込み経路にも通す(経路間の非対称の解消)
eq('rows/C07: SNS名だけの手順は落とす', filterImportedSteps(['鶏肉を切る', 'Instagram', '煮込む']), ['鶏肉を切る', '煮込む'])
eq('rows/C07: URLだけの手順は落とす', filterImportedSteps(['鶏肉を切る', 'https://example.com/ad']), ['鶏肉を切る'])
eq('rows/C07: ハッシュタグ行も落とす', filterImportedSteps(['鶏肉を切る', '#簡単レシピ']), ['鶏肉を切る'])
eq('rows/C07: 「関連レシピ」も落とす', filterImportedSteps(['鶏肉を切る', '関連レシピ']), ['鶏肉を切る'])
eq('rows/C07: 普通の手順は1件も落とさない', filterImportedSteps(['鍋に水を入れて沸かす', '弱火で20分煮る']), ['鍋に水を入れて沸かす', '弱火で20分煮る'])
// 安全弁: 判定が全部当たってしまったら疑って元のまま返す(取り込みが丸ごと空になる事故を防ぐ)
eq('rows/C07: 全部ゴミ判定になったら安全弁で元のまま', filterImportedSteps(['Instagram', '広告']), ['Instagram', '広告'])
eq('rows/C07: 空配列はそのまま', filterImportedSteps([]), [])

// C08: グループ記号 → 合わせ調味料グループ番号
eq('rows/C08: Aは1', seasoningGroupFromLetter('A'), 1)
eq('rows/C08: 全角Ａも1', seasoningGroupFromLetter('Ａ'), 1)
eq('rows/C08: Dは4(上限)', seasoningGroupFromLetter('D'), 4)
eq('rows/C08: 上限超え(E)は未設定(色が一周して見分けが付かないため)', seasoningGroupFromLetter('E'), undefined)
eq('rows/C08: 記号なしは未設定', seasoningGroupFromLetter(undefined), undefined)

// C08: 「A水」形式のグループ記号がグループ色+材料メモに引き継がれる(味の素パーク実測形)
eq(
  'rows/C08: グループ記号はグループ色に対応づけ、記号自体はメモに残す(名前は無記号のまま)',
  buildImportedIngredientRows([
    { name: '水', amount: '1.5カップ', group: 'A' },
    { name: '砂糖', amount: '大さじ1', group: 'B' },
    { name: '牛こま切れ肉', amount: '200g' },
  ]),
  [
    { name: '水', amount: '1.5', unit: 'カップ', memo: 'A', group: 1 },
    { name: '砂糖', amount: '1', unit: '大さじ', memo: 'B', group: 2 },
    { name: '牛こま切れ肉', amount: '200', unit: 'g', memo: '', group: undefined },
  ],
)
// C08: 分量を持たない見出し行(「合わせ調味料」等)は材料にせず、以降をひとまとまりにする
eq(
  'rows/C08: グループ見出し行は材料にせず、以降の材料をグループにまとめる',
  buildImportedIngredientRows([
    { name: 'じゃがいも', amount: '3個' },
    { name: '合わせ調味料' },
    { name: 'しょうゆ', amount: '大さじ2' },
    { name: 'みりん', amount: '大さじ2' },
  ]),
  [
    { name: 'じゃがいも', amount: '3', unit: '個', memo: '', group: undefined },
    { name: 'しょうゆ', amount: '2', unit: '大さじ', memo: '', group: 1 },
    { name: 'みりん', amount: '2', unit: '大さじ', memo: '', group: 1 },
  ],
)
eq(
  'rows/C08: 【A】形式の見出し行も同じ扱い',
  buildImportedIngredientRows([{ name: '【A】' }, { name: '酒', amount: '大さじ1' }]),
  [{ name: '酒', amount: '1', unit: '大さじ', memo: '', group: 1 }],
)
// 見出しに見えても分量を持つ行は材料(実材料を誤って消さないための条件)
eq(
  'rows/C08: 分量がある行は見出し語に一致しても材料として残す',
  buildImportedIngredientRows([{ name: '調味料', amount: '大さじ2' }]),
  [{ name: '調味料', amount: '2', unit: '大さじ', memo: '', group: undefined }],
)
eq(
  'rows/C07: 材料側のゴミ行も落とす',
  buildImportedIngredientRows([{ name: '関連レシピ' }, { name: '玉ねぎ', amount: '1個' }]),
  [{ name: '玉ねぎ', amount: '1', unit: '個', memo: '', group: undefined }],
)
// C09: 分量が読み取れなかった材料の件数(取り込み結果の内訳表示に使う)
// ---- C06(2026-07-28 便BX): 分量・単位の破損。本番Worker経由でクラシル/楽天/DELISHを再実測し、
// 実在した破損だけを対象にしている(帯分数・括弧グラム併記は設計どおりで破損ではないことを再確認済み) ----
// (1) カタカナ助数詞: クックパッドは「大きめ6コ」「大1コ」表記が多く、栄養・原価の両方が
//     「コ」を知らないため主材料が黙って計算対象外に落ちていた
eq('C06: 「6コ」→ unit=個に正規化', splitQuantity('6コ'), { amount: '6', unit: '個' })
eq('C06: 「3ヶ」→ unit=個に正規化', splitQuantity('3ヶ'), { amount: '3', unit: '個' })
eq('C06: 「4ワ」→ unit=束に正規化', splitQuantity('4ワ'), { amount: '4', unit: '束' })
eq('C06: 既知の単位はそのまま', splitQuantity('3個'), { amount: '3', unit: '個' })
// (2) 名前に残る大きさ修飾語: 楽天レシピ「にんじん 中1本」でWorkerが name=にんじん / amount=中1本 と
//     返し、1行に組み直すと「にんじん 中」が材料名になっていた
eq(
  'C06: 「にんじん」+「中1本」→ 名前は汚さずメモへ逃がす(楽天レシピ実測)',
  normalizeImportedIngredient('にんじん', '中1本'),
  { name: 'にんじん', amount: '1', unit: '本', memo: '中' },
)
eq(
  'C06: 「じゃがいも」+「中2個」も同じ',
  normalizeImportedIngredient('じゃがいも', '中2個'),
  { name: 'じゃがいも', amount: '2', unit: '個', memo: '中' },
)
eq(
  'C06: 分量が読めない行の末尾語には触らない(名前の一部の可能性を否定できないため)',
  normalizeImportedIngredient('大根 中'),
  { name: '大根 中', amount: '', unit: '' },
)
// (3) 範囲分量: 楽天レシピ「牛こま切れ 200〜250g」が栄養の対象外(reason=amount)に落ちていた。
//     表示・保存は原文のまま、計算だけ先頭値(少なめ側)を使う
eq('C06: 範囲分量の計算値は先頭値', leadingRangeAmount('200〜250'), '200')
eq('C06: 半角チルダの範囲も先頭値', leadingRangeAmount('200~250'), '200')
eq('C06: 全角チルダの範囲も先頭値', leadingRangeAmount('4～5'), '4')
eq('C06: 分数の範囲も先頭値', leadingRangeAmount('1/2〜1'), '1/2')
eq('C06: 範囲でなければそのまま', leadingRangeAmount('200'), '200')
eq('C06: 数値でない分量はそのまま', leadingRangeAmount('適量'), '適量')
eq('C06: 範囲分量が栄養計算で数値化できる(旧: null=対象外)', parseAmountNumber('200〜250'), 200)
eq('C06: 「4〜5」も先頭値', parseAmountNumber('4〜5'), 4)
// 表示・保存・人数スケールは従来どおり範囲のまま(F3の裁定を変えない)
eq('C06: 表示側の範囲は据え置き(人数変更しても原文のまま)', scaleAmount('4〜5', 2, 4, '個'), '4〜5')
eq('C06: splitQuantityは範囲を保持したまま単位だけ分ける', splitQuantity('200〜250g'), { amount: '200〜250', unit: 'g' })

eq(
  'rows/C09: 分量も単位も無い材料の件数を数える',
  countAmountlessRows(
    buildImportedIngredientRows([
      { name: '玉ねぎ', amount: '1個' },
      { name: '塩こしょう' },
      { name: 'サラダ油', amount: '適量' },
    ]),
  ),
  1,
)

// ============================================================================
// 便IT(2026-08-21): テスト用データ作りで見つかった取り込みの不具合。
// ①cotta(タグの外にRecipeを書くサイト) ②型の大きさを人数と読む ④丸数字の参照
// ⑤「◯◯の材料」「◯◯の作り方」の見出し ⑥手順に残る「**1**」
// ============================================================================

// ---- ①(便IT): <script type="application/ld+json"> の外に書かれたRecipeを拾う ----
// cotta実測: schema.org/Recipeの中身はHTMLソースに丸ごと載っているが、
// 「var rich_card_json = {…}」というJavaScriptの変数として書かれており、ページを開いてから
// JavaScriptがld+jsonのタグを作る。タグだけを見ていたWorkerには見つけられなかった。
{
  // (1) cottaのレシピページ相当: 素のJavaScriptの中の変数に丸ごと入っている
  const html =
    '<!doctype html><html><head></head><body>' +
    '<script charset="UTF-8" type="text/javascript">\n' +
    "    const s = document.createElement('script');\n" +
    "    s.setAttribute('type', 'application/ld+json');\n" +
    '\tvar rich_card_json ={"@context":"http:\\/\\/schema.org\\/","@type":"Recipe","name":"基本のマドレーヌ",' +
    '"image":"https:\\/\\/example.com\\/madeleine.jpg","recipeYield":"シェル型6〜9個分",' +
    '"recipeIngredient":["全卵1個分","砂糖50g","薄力粉50g"],' +
    '"recipeInstructions":[{"@type":"HowToStep","text":"卵を割りほぐし、砂糖を入れて混ぜる"},' +
    '{"@type":"HowToStep","text":"型に流して170度で13分焼く"}]};\n' +
    '    s.textContent = JSON.stringify(rich_card_json);\n' +
    '    document.head.appendChild(s);\n' +
    '</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/cotta1')
  eq('IT①: ld+jsonタグの外(JavaScriptの変数)に書かれたRecipeも拾える', r?.title, '基本のマドレーヌ')
  eq('IT①: 外から拾ったRecipeの材料3件', r?.ingredients, [
    { name: '全卵', amount: '1個分' },
    { name: '砂糖', amount: '50g' },
    { name: '薄力粉', amount: '50g' },
  ])
  eq('IT①: 外から拾ったRecipeの手順2件', r?.steps, [
    '卵を割りほぐし、砂糖を入れて混ぜる',
    '型に流して170度で13分焼く',
  ])
  eq('IT①: 外から拾ったRecipeの写真', r?.imageUrl, 'https://example.com/madeleine.jpg')
}

{
  // (2) JSON.stringify({…}) の形で引数に直接書かれている形も同じように拾える
  const html =
    '<!doctype html><html><head></head><body><script type="text/javascript">' +
    'x.textContent = JSON.stringify({"@context":"http:\\/\\/schema.org","@type":"Recipe","name":"かぼちゃの煮物",' +
    '"recipeIngredient":["かぼちゃ 1/4個"],"recipeInstructions":["ひと口大に切る","落としぶたをして煮る"]});' +
    '</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/cotta2')
  eq('IT①: JSON.stringify({…})の形でもRecipeを拾える', r?.title, 'かぼちゃの煮物')
  eq('IT①: JSON.stringify形の手順2件', r?.steps, ['ひと口大に切る', '落としぶたをして煮る'])
}

{
  // (3) 入れ子の中にRecipeがあっても、そのRecipeだけを取り出せる
  const html =
    '<!doctype html><html><body><script>window.__DATA__ = {"page":{"id":12,' +
    '"recipe":{"@type":"Recipe","name":"きんぴらごぼう","recipeIngredient":["ごぼう 1本"],' +
    '"recipeInstructions":["ささがきにする","炒める"]}}};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/nested')
  eq('IT①: 入れ子の中のRecipeも拾える', r?.title, 'きんぴらごぼう')
}

{
  // (4) 拾いすぎない① ld+jsonタグに揃ったRecipeがあるときは、外は見に行かない
  //     (タグの中が正)。外に別のRecipeが転がっていても混ざらない
  const html =
    '<!doctype html><html><head><script type="application/ld+json">' +
    JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: '肉じゃが',
      recipeIngredient: ['じゃがいも 3個'],
      recipeInstructions: ['煮る'],
    }) +
    '</script></head><body><script>var other = {"@type":"Recipe","name":"よその料理",' +
    '"recipeIngredient":["塩 少々"],"recipeInstructions":["混ぜる"]};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/recipe/both')
  eq('IT①: タグの中が揃っていれば、そちらを使う(外のRecipeに乗っ取られない)', r?.title, '肉じゃが')
}

{
  // (5) 拾いすぎない② <script>の外(本文)に同じ字面があっても拾わない
  const html =
    '<!doctype html><html><body><p>このページは {"@type":"Recipe","name":"本文に書いただけ",' +
    '"recipeIngredient":["塩 少々"],"recipeInstructions":["混ぜる"]} という説明の記事です。</p></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/article')
  eq('IT①: <script>の外(本文)に転がっている同じ字面は拾わない', r, undefined)
}

{
  // (6) 拾いすぎない③ 中身が足りないRecipe(cottaの記事ページ実測: 名前と写真だけ)は
  //     これまでどおり no_recipe。貼り付け取り込みへ案内する
  const html =
    '<!doctype html><html><body><script>y.textContent = JSON.stringify({"@context":"http:\\/\\/schema.org",' +
    '"@type":"Recipe","name":"基本のシュークリームレシピ","image":"https://example.com/a.jpg",' +
    '"recipeCategory":"お菓子"});</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/column')
  eq('IT①: 名前だけのRecipe(材料・手順なし)はこれまでどおり取り込まない', r, undefined)
}

{
  // (7) 拾いすぎない④ JSONとして読めない書き方(素のJavaScriptのオブジェクト)は諦める(落ちない)
  const html =
    '<!doctype html><html><body><script>var z = {"@type":"Recipe", name: 基本の何か, ' +
    'recipeIngredient: [塩]};</script></body></html>'
  const r = extractRecipeFromHtml(html, 'https://example.com/broken')
  eq('IT①: JSONとして読めない書き方は拾わない(例外を投げない)', r, undefined)
}

// ---- ②(便IT): 型の大きさ(cm)・「1台分」を人数と読まない ----
// 実測: DELISH KITCHEN「直径17cmのシフォン型1台分」→17人分、macaroni「18cm×18cmの容器1台分」→18人分。
// 1食あたりの原価が約8円になり、数字が明らかに変だった。docs/43で「26個分」は直っているが
// cm表記が残っていた
eq('IT②: 「直径17cmのシフォン型1台分」を人数と読まない', extractServings('直径17cmのシフォン型1台分'), undefined)
eq('IT②: 「18cm×18cmの容器1台分」を人数と読まない', extractServings('18cm×18cmの容器1台分'), undefined)
eq('IT②: 「21cmのパウンド型1台分」も読まない', extractServings('21cmのパウンド型1台分'), undefined)
eq('IT②: 「天板1枚分」も読まない(既存の枚)', extractServings('天板1枚分'), undefined)
// 範囲の後ろに個数の単位が来る形(cotta「シェル型6〜9個分」実測)。範囲の先頭の数字だけを見ていると
// 6人分になっていた
eq('IT②: 「シェル型6〜9個分」を人数と読まない', extractServings('シェル型6〜9個分'), undefined)
eq('IT②: 「200〜250g」も読まない', extractServings('200〜250g'), undefined)
// 既存の挙動は変えない(人数として読めるものは読む)
eq('IT②: 「4人分」はこれまでどおり4', extractServings('4人分'), 4)
eq('IT②: 単位なしの範囲「2〜3」はこれまでどおり2', extractServings('2〜3'), 2)
eq('IT②: 「600g / 3」はこれまでどおり3', extractServings('600g / 3'), 3)

// ---- ⑥(便IT): 手順に残る「**1**」(NHK実測) ----
// みんなのきょうの料理は、前の手順を指す番号を JSON-LD 側で「**1**」と書いている。
// 番号は残し、印(**)だけを落とす。番号ごと落とすと「の野菜類を加える」になって文が壊れる
eq(
  'IT⑥: 手順の「**1**」は印だけ落として番号を残す',
  normalizeInstructions(['ボウルにひき肉、塩を入れてよく練る。**1**の野菜類を加える。']),
  ['ボウルにひき肉、塩を入れてよく練る。1の野菜類を加える。'],
)
eq(
  'IT⑥: 行頭の「**2**の…」も番号を残す(手順番号として剥がさない)',
  normalizeInstructions(['**2**のキャベツの軸をそぎ落とす。', '**4**の巻き終わりを下にして並べる。']),
  ['2のキャベツの軸をそぎ落とす。', '4の巻き終わりを下にして並べる。'],
)
// アプリ側の保険(便IL/①と同じ考え方): アプリはWorkerを差し替えずに更新されうるので、
// 受け取った側でももう一度落とす。印が無い文は1文字も変わらない
eq(
  'IT⑥: アプリ側でも「**1**」の印を落として番号を残す(Workerが出るまでの保険)',
  filterImportedSteps(['ボウルにひき肉を練る。**1**の野菜類を加える。', '**2**を俵形に整える。']),
  ['ボウルにひき肉を練る。1の野菜類を加える。', '2を俵形に整える。'],
)
eq('IT⑥: 印が無い文はアプリ側でも変わらない', stripImportedMarkup('鍋に水を入れて沸かす'), '鍋に水を入れて沸かす')
eq('IT⑥: 3桁以上の数字は強調の印とみなさない', stripImportedMarkup('**170**度で焼く'), '**170**度で焼く')

// ---- ④(便IT): 丸数字の参照が剥がれて手順の文が壊れる(貼り付け) ----
// 白ごはん.com実測「②で準備した野菜を炒めます。」→「で準備した野菜を炒めます。」。
// M4のガードが「(1)」「1.」の形にしか効いておらず、丸数字と「で」が対象外だった
{
  const r = parseRecipeText('鮭の南蛮漬け\n作り方\n①南蛮酢を作る。\n②で準備した野菜を炒めます。\n②の鮭に小麦粉をまぶします。')
  eq('IT④: 丸数字+「で」始まりは前の手順への参照(番号を剥がさない)', r.steps[1], '②で準備した野菜を炒めます。')
  eq('IT④: 丸数字+「の」始まりも参照(番号を剥がさない)', r.steps[2], '②の鮭に小麦粉をまぶします。')
  eq('IT④: ふつうの丸数字手順はこれまでどおり番号を剥がす', r.steps[0], '南蛮酢を作る。')
}
{
  // 誤爆の歯止め: 「に」「で」は食材名の出だしにもなる。直後がひらがななら参照とみなさない
  const r = parseRecipeText('豚汁\n作り方\n①にんじんを切る\n②でんぷんを水で溶く\n③に加えて混ぜる')
  eq('IT④: 「①にんじんを切る」は参照ではない(番号を剥がす)', r.steps[0], 'にんじんを切る')
  eq('IT④: 「②でんぷんを水で溶く」も参照ではない(番号を剥がす)', r.steps[1], 'でんぷんを水で溶く')
  eq('IT④: 「③に加えて混ぜる」は参照(番号を剥がさない)', r.steps[2], '③に加えて混ぜる')
}

// ---- ⑤(便IT): 「◯◯の材料」「◯◯の作り方」が見出しと認識されない(貼り付け) ----
// 白ごはん.com実測: 料理名が「鮭の南蛮漬けの材料 (作りやすい分量)」になり、
// 「揚げずに作る、鮭の南蛮漬けの作り方」「南蛮酢の作り方」が材料の行に混じっていた
{
  const r = parseRecipeText(
    [
      '鮭の南蛮漬けの材料 (作りやすい分量)',
      '【 鮭の南蛮漬けの材料 】',
      '生鮭 … 3切',
      '玉ねぎ … 1/2個',
      '【 南蛮酢の材料 】',
      '酢 … 150ml',
      '揚げずに作る、鮭の南蛮漬けの作り方',
      '南蛮酢の作り方',
      '上記レシピの分量を鍋に合わせ、一度沸騰させて作ります。',
      '鮭の南蛮漬けの作り方（まずは野菜を炒めます）',
      '野菜はそれぞれ食べやすい太さの千切りにしておきます。',
    ].join('\n'),
  )
  eq('IT⑤: 料理名は見出しの「の材料 (…)」を外したもの', r.title, '鮭の南蛮漬け')
  eq('IT⑤: 見出し行が材料に混ざらない', r.ingredients, [
    { name: '生鮭', amount: '3', unit: '切' },
    { name: '玉ねぎ', amount: '1/2', unit: '個' },
    { name: '酢', amount: '150', unit: 'ml' },
  ])
  eq('IT⑤: 見出し行が手順にも混ざらない', r.steps, [
    '上記レシピの分量を鍋に合わせ、一度沸騰させて作ります。',
    '野菜はそれぞれ食べやすい太さの千切りにしておきます。',
  ])
}
{
  // 誤爆の歯止め: 文の途中に「の作り方」が出てくる行は見出しにしない
  const r = parseRecipeText(
    '肉じゃが\nじゃがいも 3個\n作り方\n詳しい南蛮酢の作り方はこちらから。\n水を加えて15分煮る',
  )
  eq('IT⑤: 「〜の作り方はこちらから。」は見出しにしない(手順として残る)', r.steps, [
    '詳しい南蛮酢の作り方はこちらから。',
    '水を加えて15分煮る',
  ])
}
{
  // ⑤の付け合わせ(便IT): 「このレシピの材料」を見出しと読めるようになったぶん、その直下にある
  // 「数量：シェル型6〜9個分」(cotta実測)が材料の1行目に入るようになったので、材料として拾わない
  const r = parseRecipeText('基本のマドレーヌ\nこのレシピの材料\n数量：シェル型6〜9個分\n全卵 1個分\n砂糖 50g')
  eq('IT⑤: 「数量：…」の行は材料にしない', r.ingredients, [
    { name: '全卵', amount: '1', unit: '個分' },
    { name: '砂糖', amount: '50', unit: 'g' },
  ])
  eq('IT⑤: 「数量：…」を落としても料理名は残る', r.title, '基本のマドレーヌ')
}
{
  // 人数が書いてあるときは、値の側だけ残して人数として読む
  const r = parseRecipeText('肉じゃが\nこのレシピの材料\n数量：4人分\nじゃがいも 3個')
  eq('IT⑤: 「数量：4人分」は人数として読む', r.servings, 4)
  eq('IT⑤: 「数量：4人分」は材料に混ざらない', r.ingredients, [{ name: 'じゃがいも', amount: '3', unit: '個' }])
}

// ---------- KG-6: 写真が届く前に保存できてしまう ----------
// 実データB: 30品中10品が写真なしで保存された（4サイトとも取り直せば取得できた＝取りこぼし）。
// レシピ本体の読み込み中は保存を止めているのに、写真の読み込み中は止めていなかった。
{
  eq('KG-6 本体の読み込み中に保存を止める知らせがある', ja.form.urlImportBlocksSave.includes('保存'), true)
  eq('KG-6 写真の読み込み中に保存を止める知らせもある', typeof ja.form.urlImportPhotoBlocksSave === 'string' && ja.form.urlImportPhotoBlocksSave !== '', true)
  eq('KG-6 写真の知らせは「写真」を名指ししている', (ja.form.urlImportPhotoBlocksSave ?? '').includes('写真'), true)
}


