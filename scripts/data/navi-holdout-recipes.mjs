/**
 * 並行調理ナビ 修繕の合格判定に使う**ホールドアウト標本**（2026-08-08 便ED）。
 *
 * docs/68 末尾の合格ライン「合格の追加条件: ホールドアウト標本」への対応。
 * `navi-wild-recipes.mjs` の18品は打ち手の設計に使った標本なので、それに合わせた調整が
 * 効いていないことを確かめるために、**修繕後に書き下ろした初見の9品**をここに置く。
 *
 * 書き方の条件は元の標本と同じ（実在レシピの本文は転載せず、構造の特徴だけを再現）:
 *   A = URL取り込み（手順は1〜2文・minutes と memo は空・時間は本文の中にだけある）
 *   B = 貼り付け取り込み（生テキストを parseRecipeText に通す）
 *   C = 手入力（3〜5手順・短文・分数なし）
 *
 * truth / realWaits / realMinutes の意味は navi-wild-recipes.mjs と同じ。
 * **数字が良くなるように本文を選び直すことはしない**（初見であることが標本の価値そのもの）。
 */

/** A: URL取り込み */
export const urlSamples = [
  {
    id: 'HA1',
    title: '豚汁',
    servings: 4,
    cookMinutes: 30,
    ingredients: [
      { name: '豚バラ薄切り肉', amount: '150g' },
      { name: '大根', amount: '1/4本' },
      { name: 'にんじん', amount: '1/2本' },
      { name: 'ごぼう', amount: '1/2本' },
      { name: '長ねぎ', amount: '1/2本' },
      { name: 'だしの素', amount: '小さじ2' },
      { name: 'みそ', amount: '大さじ3' },
      { name: 'ごま油', amount: '大さじ1' },
      { name: '水', amount: '800ml' },
    ],
    steps: [
      '大根とにんじんはいちょう切り、ごぼうはささがきにして水にさらします。長ねぎは小口切りにします。',
      '鍋にごま油を熱し、豚バラ薄切り肉を色が変わるまで炒めます。',
      '大根、にんじん、ごぼうを加えて全体に油がまわるまで炒め合わせます。',
      '水とだしの素を入れ、煮立ったら浮いてきたアクを取ります。',
      '弱めの中火で12分、野菜がやわらかくなるまで煮ます。',
      '火を弱めてみそを溶き入れ、長ねぎを加えてひと煮したら火を止めます。',
    ],
    truth: ['active', 'active', 'active', 'active', 'wait', 'active'],
    realWaits: [{ minutes: 12, label: '野菜がやわらかくなるまで煮る12分' }],
    realMinutes: 30,
  },
  {
    id: 'HA2',
    title: 'たらのホイル焼き',
    servings: 2,
    cookMinutes: 25,
    ingredients: [
      { name: 'たらの切り身', amount: '2切れ' },
      { name: '玉ねぎ', amount: '1/2個' },
      { name: 'しめじ', amount: '1/2パック' },
      { name: 'バター', amount: '10g' },
      { name: '塩', amount: '少々' },
      { name: 'こしょう', amount: '少々' },
      { name: 'しょうゆ', amount: '小さじ1' },
    ],
    steps: [
      '玉ねぎは薄切りにし、しめじは石づきを落としてほぐします。',
      'アルミホイルに玉ねぎ、たらの切り身、しめじの順にのせ、塩こしょうをふってバターをのせます。',
      'アルミホイルの口をしっかり閉じて、包みを2つ作ります。',
      'フライパンに水を1cmほど張り、包みを並べてふたをし、中火で15分蒸し焼きにします。',
      '包みを器にのせ、開けてしょうゆを少しかけます。',
    ],
    truth: ['active', 'active', 'active', 'wait', 'active'],
    realWaits: [{ minutes: 15, label: 'ふたをして蒸し焼き15分' }],
    realMinutes: 25,
  },
  {
    id: 'HA3',
    title: 'きんぴらごぼう',
    servings: 3,
    cookMinutes: 15,
    ingredients: [
      { name: 'ごぼう', amount: '1本' },
      { name: 'にんじん', amount: '1/3本' },
      { name: 'ごま油', amount: '大さじ1' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ2' },
      { name: 'いりごま', amount: '小さじ1' },
    ],
    steps: [
      'ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります。',
      'フライパンにごま油を熱し、ごぼうとにんじんを2分炒めます。',
      'しょうゆ、みりん、砂糖を加え、汁気がなくなるまで炒め合わせます。',
      '仕上げにいりごまをふり、器に盛ります。',
    ],
    truth: ['active', 'active', 'active', 'active'],
    realWaits: [{ minutes: 5, label: 'ごぼうを水にさらす5分' }],
    realMinutes: 15,
  },
]

/** B: 貼り付け取り込み（生テキスト。手順は parseRecipeText の出力で測る） */
export const pasteSamples = [
  {
    id: 'HB1',
    note: '番号＋半角スペース区切り。乾物のもどしと煮ものの待ちが本文に書いてある',
    raw: `ひじきの煮もの
材料（4人分）
乾燥ひじき 20g
にんじん 1/3本
油揚げ 1枚
だし汁 200ml
しょうゆ 大さじ2
みりん 大さじ2
砂糖 大さじ1
ごま油 小さじ2

作り方
1 乾燥ひじきはたっぷりの水に20分つけてもどし、水気をきる
2 にんじんは細切り、油揚げは短冊切りにする
3 鍋にごま油を熱し、ひじきとにんじん、油揚げを炒める
4 だし汁と調味料を加え、落としぶたをして弱火で15分煮る
5 火を止め、そのまま10分おいて味を含ませる`,
    truth: ['wait', 'active', 'active', 'wait', 'wait'],
    realWaits: [
      { minutes: 20, label: '乾燥ひじきをもどす20分' },
      { minutes: 15, label: '落としぶたをして煮る15分' },
      { minutes: 10, label: '火を止めて味を含ませる10分' },
    ],
    realMinutes: 55,
  },
  {
    id: 'HB2',
    note: '丸数字の手順。浸す待ちが本文にあり、焼きは付きっきり',
    raw: `フレンチトースト
材料 2人分
食パン 2枚
卵 2個
牛乳 150ml
砂糖 大さじ1
バター 10g
はちみつ 適量

作り方
①ボウルに卵と牛乳、砂糖を入れてよく混ぜ、卵液を作る
②食パンを卵液に浸し、途中で裏返しながら15分ほど吸わせる
③フライパンにバターを溶かし、弱めの中火で片面3分ずつ焼く
④器に盛り、お好みではちみつをかける`,
    truth: ['active', 'wait', 'active', 'active'],
    realWaits: [{ minutes: 15, label: '卵液に浸す15分' }],
    realMinutes: 25,
  },
  {
    id: 'HB3',
    note: 'ブログ調の長文。余熱で火を通す長い放置が文中に埋もれている',
    raw: `しっとりゆで鶏

材料
鶏むね肉 1枚
塩 小さじ1/2
砂糖 小さじ1/2
酒 大さじ1
水 1リットル

作り方
1. 鶏むね肉に塩と砂糖をすり込み、常温に20分ほどおきます。冷たいままゆでると縮んで硬くなるので、この時間をとると仕上がりがまったく違います。
2. 鍋に水と酒を入れて沸かし、沸騰したら鶏むね肉を入れます。再び煮立ったらすぐに火を止め、ふたをしてそのまま40分おき、余熱で中まで火を通します。
3. 鍋から取り出して薄切りにし、器に盛ります。ゆで汁はスープに使えるので取っておくとよいです。`,
    truth: ['wait', 'wait', 'active'],
    realWaits: [
      { minutes: 20, label: '常温にもどす20分' },
      { minutes: 40, label: 'ふたをして余熱で火を通す40分' },
    ],
    realMinutes: 65,
  },
]

/** C: 手入力（短文・分数なし・注意書きなし） */
export const manualSamples = [
  {
    id: 'HC1',
    title: 'チャーハン',
    servings: 2,
    ingredients: [
      { name: 'ご飯', amount: '2', unit: '杯分' },
      { name: '卵', amount: '2', unit: '個' },
      { name: 'ハム', amount: '3', unit: '枚' },
      { name: '長ねぎ', amount: '1/2', unit: '本' },
      { name: 'しょうゆ', amount: '小さじ2', unit: '' },
      { name: 'サラダ油', amount: '大さじ1', unit: '' },
    ],
    steps: ['ハムと長ねぎを切る', '卵を溶く', 'フライパンで炒める', 'しょうゆで味をつける', '皿に盛る'],
    truth: ['active', 'active', 'active', 'active', 'active'],
    realWaits: [],
    realMinutes: 15,
  },
  {
    id: 'HC2',
    title: '肉じゃが',
    servings: 3,
    ingredients: [
      { name: '牛こま切れ肉', amount: '200', unit: 'g' },
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: '玉ねぎ', amount: '1', unit: '個' },
      { name: 'にんじん', amount: '1/2', unit: '本' },
      { name: 'しょうゆ', amount: '大さじ3', unit: '' },
      { name: '砂糖', amount: '大さじ2', unit: '' },
      { name: '水', amount: '300', unit: 'ml' },
    ],
    steps: ['じゃがいもと玉ねぎを切る', '肉を炒める', '野菜を入れて炒める', '水と調味料を入れて煮る', '味をみる'],
    truth: ['active', 'active', 'active', 'wait', 'active'],
    realWaits: [{ minutes: 15, label: '野菜がやわらかくなるまで煮る' }],
    realMinutes: 30,
  },
  {
    id: 'HC3',
    title: 'そうめん',
    servings: 2,
    ingredients: [
      { name: 'そうめん', amount: '3', unit: '束' },
      { name: 'めんつゆ', amount: '適量', unit: '' },
      { name: 'みょうが', amount: '1', unit: '個' },
      { name: '水', amount: '適量', unit: '' },
    ],
    // 「そうめんをゆでる」は1〜2分で吹きこぼれるため、実際には鍋から離れられない
    steps: ['お湯を沸かす', 'そうめんをゆでる', '冷水で洗う', 'めんつゆとみょうがを用意する'],
    truth: ['wait', 'active', 'active', 'active'],
    realWaits: [{ minutes: 5, label: '湯が沸くまで待つ5分' }],
    realMinutes: 10,
  },
]
