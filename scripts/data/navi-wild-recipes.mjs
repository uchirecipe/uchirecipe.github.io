/**
 * 並行調理ナビ診断（2026-08-08 便p85/navi-audit）で使う「野生のレシピ」標本。
 *
 * 目的: 同梱の基本レシピ109品（minutes・memo・材料表記がすべて整っている）ではなく、
 * **ユーザーが実際に登録するレシピ**でナビがどこまで動くかを実測するための入力。
 *
 * 出典について: 実在のレシピ本文は一切転載していない。docs/29（貼り付けパーサーのコーパスと
 * 失敗分析）・docs/43（URL取り込み品質監査）で実測された**構造的な特徴**だけを再現し、
 * 本文はこの診断のために書き下ろした。
 *
 * 3類型:
 *   A = URL取り込み（workers/recipe-import が返す NormalizedRecipe の形。手順は文字列配列・
 *       minutes と memo は必ず空・時間は本文の中にだけある）
 *   B = 貼り付け取り込み（生の貼り付け文字列。src/logic/parseRecipeText.ts を実際に通して
 *       手順配列を作る＝パーサーの現実の出力で測る）
 *   C = 手入力（3〜5手順・minutes なし・memo なし・短文）
 *
 * 各標本が持つ「答え合わせ用」のデータ:
 *   truth      … 生成された手順1つずつに対する人間の判定（'wait'=その間コンロから離れてよい /
 *                'active'=手が塞がる・目を離せない）。手順数と長さが合わないときは診断側が検知する
 *   realWaits  … その料理に**本当にある**放置時間（手順の切れ方に関係なく、料理として存在する待ち）
 *   realMinutes… その料理を1品だけ作ったときに実際にかかるおおよその時間（分）
 */

/** A: URL取り込み（Worker の NormalizedRecipe 相当。steps は文字列配列で minutes/memo は無い） */
export const urlSamples = [
  {
    id: 'A1',
    title: '豚肉と大根の煮もの',
    servings: 2,
    cookMinutes: 40,
    ingredients: [
      { name: '豚バラ薄切り肉', amount: '200g' },
      { name: '大根', amount: '1/3本' },
      { name: 'しょうが', amount: '1かけ' },
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ2' },
      { name: '砂糖', amount: '大さじ1' },
      { name: '水', amount: '400ml' },
      { name: 'サラダ油', amount: '小さじ1' },
    ],
    steps: [
      '大根は1.5cm厚さの半月切りにし、しょうがは薄切りにします。豚バラ薄切り肉は食べやすい長さに切ります。',
      '鍋にサラダ油を熱し、豚バラ薄切り肉を色が変わるまで炒めます。',
      '大根としょうが、水と調味料をすべて加え、煮立ったら浮いてきたアクを取ります。',
      'ふたをずらしてのせ、弱めの中火で20分煮ます。',
      '大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。',
      '器に盛りつけて出来上がりです。',
    ],
    truth: ['active', 'active', 'active', 'wait', 'wait', 'active'],
    realWaits: [
      { minutes: 20, label: '弱めの中火で煮る20分' },
      { minutes: 10, label: '火を止めて味を含ませる10分' },
    ],
    realMinutes: 40,
  },
  {
    id: 'A2',
    title: '鶏むね肉のから揚げ',
    servings: 3,
    cookMinutes: 30,
    ingredients: [
      { name: '鶏むね肉', amount: '1枚' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: '酒', amount: '大さじ1' },
      { name: 'おろしにんにく', amount: '小さじ1/2' },
      { name: '片栗粉', amount: '大さじ4' },
      { name: '揚げ油', amount: '適量' },
      { name: 'レモン', amount: '1/4個' },
    ],
    steps: [
      '鶏むね肉はひと口大のそぎ切りにします。',
      'ポリ袋に鶏むね肉としょうゆ、酒、おろしにんにくを入れてもみ込み、15分おきます。',
      '袋に片栗粉を加え、袋の口を閉じて全体にまぶします。',
      '揚げ油を170度に熱し、鶏むね肉を入れて3分ほど揚げます。',
      '一度取り出して2分休ませ、油の温度を上げてもう1分揚げます。',
      '油をきって器に盛り、くし形に切ったレモンを添えます。',
    ],
    truth: ['active', 'wait', 'active', 'active', 'wait', 'active'],
    realWaits: [
      { minutes: 15, label: '下味をもみ込んでおく15分' },
      { minutes: 2, label: '揚げ油から出して休ませる2分' },
    ],
    realMinutes: 30,
  },
  {
    id: 'A3',
    title: 'ほうれん草とにんじんのナムル',
    servings: 2,
    cookMinutes: 15,
    ingredients: [
      { name: 'ほうれん草', amount: '1束' },
      { name: 'にんじん', amount: '1/2本' },
      { name: 'ごま油', amount: '大さじ1' },
      { name: '鶏がらスープの素', amount: '小さじ1' },
      { name: 'いりごま', amount: '小さじ1' },
      { name: '塩', amount: '少々' },
    ],
    steps: [
      'にんじんは細切りにします。',
      '鍋にたっぷりの湯を沸かし、塩を入れてにんじんを1分、ほうれん草を30秒ゆでます。',
      'ほうれん草は冷水にとってから水気をしっかり絞り、4cm長さに切ります。',
      'ボウルにほうれん草とにんじん、ごま油、鶏がらスープの素、いりごまを入れて和えます。',
      '味をみて足りなければ塩でととのえ、器に盛ります。',
    ],
    truth: ['active', 'active', 'active', 'active', 'active'],
    realWaits: [],
    realMinutes: 15,
  },
  {
    id: 'A4',
    title: '基本のミートソースパスタ',
    servings: 2,
    cookMinutes: 45,
    ingredients: [
      { name: '合いびき肉', amount: '250g' },
      { name: '玉ねぎ', amount: '1個' },
      { name: 'にんじん', amount: '1/2本' },
      { name: 'にんにく', amount: '1かけ' },
      { name: 'カットトマト缶', amount: '1缶' },
      { name: '赤ワイン', amount: '50ml' },
      { name: 'コンソメ', amount: '1個' },
      { name: 'スパゲッティ', amount: '200g' },
      { name: 'オリーブオイル', amount: '大さじ1' },
      { name: '塩', amount: '小さじ1' },
      { name: 'こしょう', amount: '少々' },
    ],
    steps: [
      '玉ねぎ、にんじん、にんにくはすべてみじん切りにします。',
      '鍋にオリーブオイルとにんにくを入れて弱火にかけ、香りが立ったら玉ねぎとにんじんを加えてしんなりするまで炒めます。',
      '合いびき肉を加え、ほぐしながら色が変わるまで炒めます。',
      '赤ワインを注いでアルコールをとばし、カットトマト缶とコンソメを加えます。',
      'ふたをせずに弱火で25分煮込み、ときどき混ぜながら水分をとばします。',
      '別の鍋に湯を沸かして塩を加え、スパゲッティを表示時間どおり8分ゆでます。',
      'ゆで上がったスパゲッティを器に盛り、ソースをかけてこしょうをふります。',
    ],
    truth: ['active', 'active', 'active', 'active', 'wait', 'wait', 'active'],
    realWaits: [
      { minutes: 25, label: 'ソースを弱火で煮込む25分' },
      { minutes: 8, label: 'パスタをゆでる8分' },
    ],
    realMinutes: 45,
  },
  {
    id: 'A5',
    title: 'かぼちゃの煮つけ',
    servings: 4,
    cookMinutes: 25,
    ingredients: [
      { name: 'かぼちゃ', amount: '1/4個' },
      { name: 'だし汁', amount: '200ml' },
      { name: '砂糖', amount: '大さじ2' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
    ],
    steps: [
      'かぼちゃは種とわたを取り、3cm角に切ります。皮は所々むきます。',
      '鍋にかぼちゃを皮を下にして並べ、だし汁と砂糖、しょうゆ、みりんを加えます。',
      '落としぶたをして中火にかけ、煮汁が少なくなるまで煮ます。',
      '火を止めて、そのまま冷ましながら味を含ませます。',
    ],
    truth: ['active', 'active', 'wait', 'wait'],
    realWaits: [
      { minutes: 15, label: '煮汁が少なくなるまで煮る（時間の記載なし）' },
      { minutes: 10, label: '冷ましながら味を含ませる（時間の記載なし）' },
    ],
    realMinutes: 25,
  },
  {
    id: 'A6',
    title: '豆腐とわかめのみそ汁',
    servings: 2,
    cookMinutes: 10,
    ingredients: [
      { name: '木綿豆腐', amount: '1/2丁' },
      { name: '乾燥わかめ', amount: '2g' },
      { name: 'だし汁', amount: '400ml' },
      { name: 'みそ', amount: '大さじ2' },
      { name: '細ねぎ', amount: '1本' },
    ],
    steps: [
      '木綿豆腐は1.5cm角に切り、細ねぎは小口切りにします。',
      '乾燥わかめは水でもどしておきます。',
      '鍋にだし汁を入れて火にかけ、煮立ったら木綿豆腐とわかめを加えます。',
      '弱火にしてみそを溶き入れ、煮立つ直前で火を止めます。',
      '椀によそい、細ねぎを散らします。',
      'このレシピの続きはアプリでご覧いただけます',
    ],
    truth: ['active', 'wait', 'active', 'active', 'active'],
    realWaits: [{ minutes: 5, label: 'わかめをもどす5分' }],
    realMinutes: 10,
  },
]

/** B: 貼り付け取り込み（生の貼り付け文字列。parseRecipeText を実際に通して手順配列を作る） */
export const pasteSamples = [
  {
    id: 'B1',
    note: '地の文一段落（docs/29 F2）。改行がまったく無い文章をそのまま貼った場合',
    raw: 'なすとひき肉の甘辛炒め。材料は2人分でなす3本、豚ひき肉150g、しょうゆ大さじ1、みりん大さじ1、砂糖小さじ2、みそ小さじ1、サラダ油大さじ1です。まずなすを乱切りにして水に5分さらし、水気をふきます。フライパンにサラダ油を熱してなすを入れ、しんなりするまで3分炒めます。豚ひき肉を加えてほぐしながら炒め、色が変わったらしょうゆとみりん、砂糖、みそを加えて全体にからめます。汁気がなくなったら火を止めて器に盛ります。',
    truth: ['active'],
    realWaits: [{ minutes: 5, label: 'なすを水にさらす5分' }],
    realMinutes: 20,
  },
  {
    id: 'B2',
    note: '番号＋半角スペース区切り（docs/29 F1 の最頻出形式）。時間表記が本文にある',
    raw: `鶏もも肉のトマト煮
材料（2人分）
鶏もも肉 300g
玉ねぎ 1個
しめじ 1パック
カットトマト缶 1缶
オリーブオイル 大さじ1
塩 小さじ1/2
こしょう 少々
ローリエ 1枚

作り方
1 鶏もも肉はひと口大に切り、塩とこしょうをふる
2 玉ねぎは薄切り、しめじは石づきを落としてほぐす
3 フライパンにオリーブオイルを熱し、鶏もも肉を皮目から焼く
4 焼き色がついたら玉ねぎとしめじを加えてさっと炒める
5 カットトマト缶とローリエを入れ、ふたをして弱火で20分煮込む
6 塩で味をととのえ、器に盛る`,
    truth: ['active', 'active', 'active', 'active', 'wait', 'active'],
    realWaits: [{ minutes: 20, label: 'ふたをして弱火で煮込む20分' }],
    realMinutes: 35,
  },
  {
    id: 'B3',
    note: '番号だけの行＋次行に本文（丸数字）。時間表記が曖昧な言い方（ひと煮立ち・しばらく）',
    raw: `切り干し大根の煮もの
材料
切り干し大根 30g
にんじん 1/3本
油揚げ 1枚
だし汁 200ml
しょうゆ 大さじ1
みりん 大さじ1
砂糖 小さじ2
ごま油 小さじ1

作り方
①
切り干し大根はたっぷりの水につけてもどし、水気を絞ってざく切りにする
②
にんじんは細切り、油揚げは短冊切りにする
③
鍋にごま油を熱し、切り干し大根とにんじん、油揚げを軽く炒める
④
だし汁と調味料を加えてひと煮立ちさせ、落としぶたをしてしばらく煮る
⑤
煮汁がほとんどなくなったら火を止め、そのまま冷ます`,
    truth: ['wait', 'active', 'active', 'wait', 'wait'],
    realWaits: [
      { minutes: 15, label: '切り干し大根を水でもどす15分' },
      { minutes: 12, label: '落としぶたをして煮る（時間の記載なし）' },
      { minutes: 15, label: '火を止めて冷ます（時間の記載なし）' },
    ],
    realMinutes: 45,
  },
  {
    id: 'B4',
    note: '中黒手順・短文（docs/29 E形式）。時間表記がまったく無い',
    raw: `キャベツとツナのごまあえ
材料 2人分
キャベツ 1/4個
ツナ缶 1缶
すりごま 大さじ2
しょうゆ 小さじ2
砂糖 小さじ1

作り方
・キャベツをざく切りにする
・熱湯でさっとゆでる
・冷水にとって水気を絞る
・ツナ缶は油をきる
・調味料とすべてを混ぜ合わせる`,
    truth: ['active', 'active', 'active', 'active', 'active'],
    realWaits: [],
    realMinutes: 12,
  },
  {
    id: 'B5',
    note: 'ブログ調の長文。1手順に複数の動作と長い待ちが混ざる',
    raw: `おうちで作る煮豚

材料
豚肩ロースかたまり肉 500g
長ねぎの青い部分 1本分
しょうが 2かけ
しょうゆ 100ml
酒 100ml
砂糖 大さじ3
水 400ml

作り方
1. 豚肩ロースかたまり肉はたこ糸で軽く縛っておきます。フライパンを強めの中火にかけ、表面全体に焼き色をつけていきます。ここで焼き固めておくと煮くずれしにくくなるので、面倒でも6面すべてに焼き色をつけてください。
2. 鍋に豚肩ロースかたまり肉と長ねぎの青い部分、しょうが、しょうゆ、酒、砂糖、水を入れて火にかけます。煮立ったらアクをすくい、落としぶたをして弱火に落とし、そこから60分ゆっくり煮ていきます。途中で上下を返すと色むらがなくなります。
3. 火を止めたらふたをしたまま粗熱が取れるまでおきます。急いで切ると肉汁が流れ出てしまうので、最低でも30分はそのままにしておくのがおすすめです。
4. 食べやすい厚さに切り、煮汁を煮詰めたたれをかけていただきます。`,
    truth: ['active', 'wait', 'wait', 'active'],
    realWaits: [
      { minutes: 60, label: '落としぶたをして弱火で煮る60分' },
      { minutes: 30, label: '火を止めて粗熱が取れるまでおく30分' },
    ],
    realMinutes: 100,
  },
  {
    id: 'B6',
    note: '見出しなし・手順が2行に固まっている（材料先頭・番号なし）',
    raw: `厚揚げ 1枚
ピーマン 2個
豚こま切れ肉 100g
オイスターソース 大さじ1
しょうゆ 小さじ1
サラダ油 小さじ2

厚揚げは食べやすい大きさに切り、ピーマンは細切りにします。フライパンにサラダ油を熱して豚こま切れ肉を炒め、色が変わったら厚揚げとピーマンを加えて2分ほど炒め合わせます。
オイスターソースとしょうゆを回し入れ、強火で手早くからめたら火を止めて器に盛ります。`,
    truth: ['active', 'active'],
    realWaits: [],
    realMinutes: 15,
  },
]

/** C: 手入力（3〜5手順・minutes なし・memo なし・短文） */
export const manualSamples = [
  {
    id: 'C1',
    title: '野菜炒め',
    servings: 2,
    ingredients: [
      { name: 'キャベツ', amount: '1/4', unit: '個' },
      { name: 'にんじん', amount: '1/3', unit: '本' },
      { name: 'ピーマン', amount: '2', unit: '個' },
      { name: '豚こま切れ肉', amount: '150', unit: 'g' },
      { name: '塩こしょう', amount: '少々', unit: '' },
      { name: 'サラダ油', amount: '大さじ1', unit: '' },
    ],
    steps: ['材料を切る', '肉を炒める', '野菜を入れて炒める', '塩こしょうで味をつける', '皿に盛る'],
    truth: ['active', 'active', 'active', 'active', 'active'],
    realWaits: [],
    realMinutes: 15,
  },
  {
    id: 'C2',
    title: 'カレー',
    servings: 4,
    ingredients: [
      { name: '玉ねぎ', amount: '2', unit: '個' },
      { name: 'じゃがいも', amount: '2', unit: '個' },
      { name: 'にんじん', amount: '1', unit: '本' },
      { name: '豚こま切れ肉', amount: '300', unit: 'g' },
      { name: 'カレールー', amount: '1/2', unit: '箱' },
      { name: '水', amount: '600', unit: 'ml' },
    ],
    steps: ['野菜を切る', '肉と野菜を炒める', '水を入れて煮る', 'ルーを入れる', 'ご飯にかける'],
    truth: ['active', 'active', 'wait', 'active', 'active'],
    realWaits: [{ minutes: 20, label: '水を入れて野菜がやわらかくなるまで煮る' }],
    realMinutes: 40,
  },
  {
    id: 'C3',
    title: 'ゆで卵',
    servings: 2,
    ingredients: [
      { name: '卵', amount: '4', unit: '個' },
      { name: '水', amount: '適量', unit: '' },
    ],
    steps: ['鍋に水を入れて沸かす', '卵を入れる', '好みのかたさになるまでゆでる', '冷水につけて殻をむく'],
    truth: ['wait', 'active', 'wait', 'active'],
    realWaits: [
      { minutes: 5, label: '水が沸くまで待つ5分' },
      { minutes: 9, label: 'ゆでる（時間の記載なし）' },
    ],
    realMinutes: 15,
  },
  {
    id: 'C4',
    title: 'ポテトサラダ',
    servings: 3,
    ingredients: [
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: 'きゅうり', amount: '1', unit: '本' },
      { name: 'ハム', amount: '3', unit: '枚' },
      { name: 'マヨネーズ', amount: '大さじ3', unit: '' },
      { name: '塩こしょう', amount: '少々', unit: '' },
    ],
    steps: ['じゃがいもをゆでる', 'つぶす', 'きゅうりとハムを切る', '全部混ぜる'],
    truth: ['wait', 'active', 'active', 'active'],
    realWaits: [{ minutes: 20, label: 'じゃがいもをゆでる（時間の記載なし）' }],
    realMinutes: 30,
  },
  {
    id: 'C5',
    title: 'ハンバーグ',
    servings: 2,
    ingredients: [
      { name: '合いびき肉', amount: '300', unit: 'g' },
      { name: '玉ねぎ', amount: '1/2', unit: '個' },
      { name: 'パン粉', amount: '大さじ3', unit: '' },
      { name: '卵', amount: '1', unit: '個' },
      { name: '塩こしょう', amount: '少々', unit: '' },
      { name: 'ケチャップ', amount: '大さじ2', unit: '' },
      { name: 'ソース', amount: '大さじ2', unit: '' },
    ],
    steps: ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける'],
    truth: ['active', 'active', 'active', 'active', 'active'],
    realWaits: [{ minutes: 8, label: 'ふたをして蒸し焼きにする（手順文に書かれていない）' }],
    realMinutes: 30,
  },
  {
    id: 'C6',
    title: 'みそ汁',
    servings: 2,
    ingredients: [
      { name: '豆腐', amount: '1/2', unit: '丁' },
      { name: 'わかめ', amount: '少々', unit: '' },
      { name: 'だしの素', amount: '小さじ1', unit: '' },
      { name: 'みそ', amount: '大さじ2', unit: '' },
      { name: '水', amount: '400', unit: 'ml' },
    ],
    steps: ['水を沸かす', '具を入れる', 'みそを溶く'],
    truth: ['wait', 'active', 'active'],
    realWaits: [{ minutes: 5, label: '水が沸くまで待つ5分' }],
    realMinutes: 8,
  },
]
