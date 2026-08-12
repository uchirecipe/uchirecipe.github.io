/**
 * 「その間に」「〜している間に」を**本文に書いた**レシピの標本（2026-08-13 便FZ）。
 *
 * なぜ要るか: N6（利用者の並行指示・docs/72 §2）を測ろうとしたところ、
 * 既存の野生標本18品にもホールドアウト9品にも **「その間に」型の指示が1件も無かった**。
 * 分母が0では測れないので、その言い回しを含むレシピだけを書き下ろした標本を別に用意する。
 * ここはN6を測るための標本であって、既存の標本（`navi-wild-recipes.mjs` /
 * `navi-holdout-recipes.mjs`）には**1文字も手を加えていない**（既存7項目の数値を動かさないため）。
 *
 * 書き方の条件は既存標本と同じ（実在レシピの本文は転載せず、構造の特徴だけを再現）。
 * 「その間に」の使い方は、家庭のレシピでいちばん多い形＝**直前の手順の待ち時間を指す**にそろえた。
 */

/** A相当: URL取り込み（手順は文字列だけ・minutes と memo は空） */
export const urlSamples = [
  {
    id: 'P1',
    title: '牛肉と野菜の煮もの',
    servings: 2,
    cookMinutes: 35,
    ingredients: [
      { name: '牛こま切れ肉', amount: '150g' },
      { name: 'じゃがいも', amount: '3個' },
      { name: 'にんじん', amount: '1/2本' },
      { name: '玉ねぎ', amount: '1個' },
      { name: '絹さや', amount: '6枚' },
      { name: 'しょうゆ', amount: '大さじ2' },
      { name: 'みりん', amount: '大さじ2' },
      { name: '水', amount: '300ml' },
      { name: 'サラダ油', amount: '大さじ1' },
    ],
    steps: [
      'じゃがいもは4つ割り、にんじんは乱切り、玉ねぎはくし形に切ります。',
      '鍋にサラダ油を熱し、牛こま切れ肉を色が変わるまで炒めます。',
      '野菜と水、しょうゆ、みりんを加え、落としぶたをして中火で15分煮ます。',
      'その間に絹さやのすじを取り、へたを落としておきます。',
      '煮汁が少なくなったら火を止め、器に盛って絹さやを散らします。',
    ],
    truth: ['active', 'active', 'wait', 'active', 'active'],
    realWaits: [{ minutes: 15, label: '落としぶたをして煮る15分' }],
    realMinutes: 35,
  },
  {
    id: 'P2',
    title: '鶏の照り焼き丼',
    servings: 2,
    cookMinutes: 30,
    ingredients: [
      { name: '鶏もも肉', amount: '1枚' },
      { name: 'しょうゆ', amount: '大さじ1' },
      { name: 'みりん', amount: '大さじ1' },
      { name: '砂糖', amount: '小さじ2' },
      { name: 'キャベツ', amount: '2枚' },
      { name: 'ご飯', amount: '2膳' },
      { name: 'サラダ油', amount: '小さじ1' },
    ],
    steps: [
      'ポリ袋に鶏もも肉としょうゆ、みりん、砂糖を入れてもみ込み、20分漬けます。',
      '漬けている間にキャベツをせん切りにし、水にさらして水気をきります。',
      'フライパンにサラダ油を熱し、鶏もも肉を皮目から焼きます。',
      '裏返して中まで火を通し、食べやすい大きさに切ります。',
      'ご飯にキャベツと鶏もも肉をのせ、フライパンに残ったたれをかけます。',
    ],
    truth: ['wait', 'active', 'active', 'active', 'active'],
    realWaits: [{ minutes: 20, label: 'たれに漬ける20分' }],
    realMinutes: 30,
  },
]

/** B相当: 貼り付け取り込み（生テキストを parseRecipeText に通す） */
export const pasteSamples = [
  {
    id: 'P3',
    note: '番号＋半角スペース区切り。待ちの手順の次に「その間に」を書く形',
    raw: `かぼちゃの煮もの
材料（2人分）
かぼちゃ 1/4個
だし汁 200ml
しょうゆ 大さじ1
みりん 大さじ1
砂糖 大さじ1
小ねぎ 少々

作り方
1 かぼちゃは種を取り、3cm角に切る
2 鍋にかぼちゃとだし汁、調味料を入れ、落としぶたをして弱火で12分煮る
3 その間に小ねぎを小口切りにする
4 竹串がすっと通ったら火を止め、器に盛って小ねぎを散らす`,
    truth: ['active', 'wait', 'active', 'active'],
    realWaits: [{ minutes: 12, label: '落としぶたをして煮る12分' }],
    realMinutes: 25,
  },
  {
    id: 'P4',
    note: '丸数字。炊飯器の待ちを指す「炊いている間に」',
    raw: `豚バラ大根丼
材料（2人分）
米 1合
豚バラ薄切り肉 150g
大根 1/4本
しょうゆ 大さじ1と1/2
酒 大さじ1
おろししょうが 小さじ1

作り方
① 米を研いで炊飯器にセットし、普通に炊く。
② 炊いている間に大根を短冊切りにし、豚バラ薄切り肉を食べやすい長さに切る。
③ フライパンで豚バラ薄切り肉を炒め、大根としょうゆ、酒、おろししょうがを加えて煮からめる。
④ 炊き上がったご飯にのせる。`,
    truth: ['wait', 'active', 'active', 'active'],
    realWaits: [{ minutes: 30, label: 'ご飯を炊く30分' }],
    realMinutes: 40,
  },
]

/** C相当: 手入力（短文・分数なし） */
export const manualSamples = [
  {
    id: 'P5',
    title: '和風パスタ',
    servings: 2,
    ingredients: [
      { name: 'スパゲティ', amount: '200', unit: 'g' },
      { name: 'しめじ', amount: '1', unit: 'パック' },
      { name: 'ベーコン', amount: '2', unit: '枚' },
      { name: 'しょうゆ', amount: '大さじ1', unit: '' },
      { name: 'バター', amount: '10', unit: 'g' },
    ],
    steps: ['お湯を沸かしてスパゲティを8分ゆでる', 'ゆでている間にしめじとベーコンを切る', 'フライパンで炒める', 'ゆで上がったパスタとしょうゆ、バターを加えて混ぜる'],
    truth: ['wait', 'active', 'active', 'active'],
    realWaits: [{ minutes: 8, label: 'スパゲティをゆでる8分' }],
    realMinutes: 20,
  },
  {
    id: 'P6',
    title: 'なすの煮びたし',
    servings: 2,
    ingredients: [
      { name: 'なす', amount: '3', unit: '本' },
      { name: 'めんつゆ', amount: '100', unit: 'ml' },
      { name: '水', amount: '100', unit: 'ml' },
      { name: 'しょうが', amount: '1', unit: 'かけ' },
    ],
    steps: ['なすを切って水に10分さらす', 'その間にしょうがをすりおろす', 'なすとめんつゆと水を鍋に入れて10分煮る', '粗熱を取って器に盛る'],
    truth: ['wait', 'active', 'wait', 'active'],
    realWaits: [
      { minutes: 10, label: 'なすを水にさらす10分' },
      { minutes: 10, label: '煮る10分' },
    ],
    realMinutes: 25,
  },
]
