/**
 * 用語タップ辞書(2026-07-11)。
 * 本文への括弧説明（例:「小口切り（端から薄い輪切りにすること）」）を、将来的に
 * 「用語をタップすると説明が出る」方式へ置き換えるための基盤データ。
 *
 * 収載方針:
 * ・starters.ts / sets/kintore.ts / public/sets/data/review.json・review8.json の
 *   手順文・memoにある既存の括弧説明／定義文から抽出した(勝手な書き下ろしはしない)。
 * ・説明文は既存の文言を正とする。「〜こと。〜(補足)」のように定義本体のあとに
 *   補足文が続く場合は定義本体のみを採用し、同じ語に複数の説明がある場合は
 *   最も丁寧なものを採用した。
 * ・readingは一般的な読み(辞書的知識)。将来の読み上げ誤読対策用で未使用でも害はない。
 * ・「筋」「あく/アク」「わた」「ガク」「コシ」のような短い語は、他の一般語との
 *   誤マッチ(例:「筋トレ」に含まれる「筋」)が無いか実カタログを確認済み。
 *   「筋」は今のところ衝突が無いが、将来「筋肉」等を含む文言が追加されると
 *   誤って部分マッチする可能性がある(観察事項。発生したら辞書側で対処する)。
 */

export interface CookingTerm {
  /** 表示語(例: '小口切り') */
  term: string
  /** 読み仮名(例: 'こぐちぎり'。読み上げ誤読対策に将来使用) */
  reading?: string
  /** 説明(例: '端から薄い輪切りにすること') */
  description: string
  /** 表記ゆれ・別表記(例: ['小口切りに']) */
  aliases?: string[]
}

export const COOKING_TERMS: CookingTerm[] = [
  // --- 切り方 ---
  { term: '小口切り', reading: 'こぐちぎり', description: '端から薄い輪切りにすること' },
  { term: 'せん切り', reading: 'せんぎり', description: '細い糸状に切ること' },
  {
    term: 'いちょう切り',
    reading: 'いちょうぎり',
    description: '輪切りを十字に4等分した扇形',
  },
  {
    term: 'くし形切り',
    reading: 'くしがたぎり',
    description: '縦半分に切った玉ねぎを切り口から放射状に等分する切り方（みかんの房のような形）',
    aliases: ['くし形'],
  },
  {
    term: 'さいの目切り',
    reading: 'さいのめぎり',
    description: '1cm角ほどのサイコロ状に切る切り方',
    aliases: ['さいの目'],
  },
  { term: '短冊切り', reading: 'たんざくぎり', description: '薄く細長い長方形に切ること' },
  {
    term: 'そぎ切り',
    reading: 'そぎぎり',
    description: '包丁を斜めに寝かせて削ぐように薄く切る切り方',
  },
  { term: 'みじん切り', reading: 'みじんぎり', description: 'できるだけ細かく刻むこと' },
  {
    term: '乱切り',
    reading: 'らんぎり',
    description: '向きを変えながら、一口大の斜め切りにすること',
  },
  {
    term: 'ささがき',
    description: '鉛筆を削るようにごぼうを回しながら薄くそぐ切り方',
  },
  { term: '俵形', reading: 'たわらがた', description: '丸い筒のような形' },

  // --- 下ごしらえ ---
  { term: '油抜き', reading: 'あぶらぬき', description: '表面の余分な油を熱湯で洗い流すこと' },
  { term: '下茹で', reading: 'したゆで', description: '軽く茹でて水分やアクを抜くこと' },
  {
    term: '湯むき',
    reading: 'ゆむき',
    description: '皮に切り込みを入れて短時間湯にくぐらせ、冷水で冷やして皮をむきやすくする方法',
  },
  {
    term: '板ずり',
    reading: 'いたずり',
    description: '塩をなじませながら表面のうぶ毛を取ること',
  },
  {
    term: '塩もみ',
    reading: 'しおもみ',
    description: '薄切りきゅうりに塩少々をまぶして5分ほどおき、出てきた水気をぎゅっと絞ること',
  },
  {
    term: '粉ふき',
    reading: 'こなふき',
    description: '湯を切って鍋を弱火に戻して揺すり、表面の水気を飛ばすこと',
  },
  { term: '石づき', reading: 'いしづき', description: '根元のかたい部分' },
  {
    term: '背わた',
    reading: 'せわた',
    description: '背中を通る黒い筋。消化管の一部',
  },
  {
    term: '筋',
    reading: 'すじ',
    description: '（ささみの）白い帯状の部分',
  },
  {
    term: 'ガク',
    description: 'オクラのヘタの付け根にある硬い部分',
  },
  {
    term: 'わた',
    description: 'ゴーヤの内側にある白い部分と種',
  },

  // --- 加熱・煮る ---
  {
    term: '乾煎り',
    reading: 'からいり',
    description: '油をひかずに炒って水分を飛ばすこと',
  },
  {
    term: '炒り煮',
    reading: 'いりに',
    description: '炒めてから調味料を加えて汁気がなくなるまで煮ること',
  },
  {
    term: '炒め煮',
    reading: 'いために',
    description: '炒めてから調味料を加えて煮詰めること',
  },
  {
    term: '含め煮',
    reading: 'ふくめに',
    description: 'だしをたっぷり含ませるように、じっくり煮て味をしみ込ませる煮物の技法',
  },
  {
    term: '落としぶた',
    reading: 'おとしぶた',
    description: '鍋の中身に直接のせる小さめのふたやアルミホイル',
    aliases: ['落とし蓋'],
  },
  {
    term: '揚げ焼き',
    reading: 'あげやき',
    description: '少なめの油で、揚げるように焼くこと',
  },
  {
    term: 'アク',
    description:
      '①煮汁に浮く泡(茶色や白っぽいことも) ②野菜の切り口から出る、変色やえぐみのもとになる成分',
    aliases: ['あく'],
  },
  {
    term: '半熟',
    reading: 'はんじゅく',
    description: '表面がまだとろりとした状態',
  },
  {
    term: '粗熱',
    reading: 'あらねつ',
    description: 'さわれるくらいの温度まで冷めた状態',
  },
  {
    term: '乳化',
    reading: 'にゅうか',
    description: '油とゆで汁が混ざって白っぽくとろりとすること',
  },
  {
    term: '「す」',
    description: '卵液に空気の穴があいてスポンジ状になること(茶碗蒸し等)',
  },

  // --- 合わせ調味料・その他 ---
  {
    term: '土佐酢',
    reading: 'とさず',
    description: '酢にだし汁やみりん・しょうゆなどを加えてまろやかにした合わせ酢のこと',
  },
  {
    term: 'ハリハリ漬け',
    reading: 'はりはりづけ',
    description: '切り干し大根のパリパリとした歯ごたえが名前の由来の漬物',
  },
  {
    term: 'コシ',
    description: '卵白のぷるんとした塊のこと',
  },
]
