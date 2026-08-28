/**
 * 取り込んだ・自分で登録したレシピに、**危険が既知の組み合わせ**のときだけ注記を添える
 * （2026-08-22 便JH）。
 *
 * きっかけ（オーナーの書き溜め・原文）:
 *   「レンジ温泉卵
 *    ・卵をレンジ加熱なら、卵黄に爪楊枝で穴を開けないと爆発しそう」
 *
 * 根は1品の話ではない。**同梱の基本レシピ（109品）には CLAUDE.md D-④ の安全注記が
 * 入っているのに、URL・文章から取り込んだレシピには1つも付かない**こと。
 * オーナーの実データ31品を測ると、D-④に該当する26品の**26品すべてに注記が無い**
 * （同梱109品は該当81品のうち75品に注記あり）。取り込みが増えるほど穴は広がる。
 *
 * 【この仕組みの決めごと】
 * - **利用者が書いた手順の本文もメモも1文字も書き換えない**。ここは「添える文」を
 *   組み立てるだけで、レシピのデータには何も書き込まない（表示のたびに組み直す）。
 * - **同梱の基本レシピ（isStarter）には出さない**。あちらは原稿に注記が入っているので、
 *   ここで出すと同じ話が二重になる。
 * - **狭く取る**。「たぶん危ない」では出さない。入れてよいのは、材料と手順の
 *   組み合わせで危険が公に知られているものだけ。誤検出で毎回注記が出ると、
 *   本当に必要なときに読まれなくなる。
 * - 文体・置き場所は D-④ に従う。簡潔な常体1〜2文、必須は「〜こと」・推奨は「〜と安心」、
 *   菌名・恐怖・効能誇大は書かない。火通りの目安は**その手順**へ、
 *   保存・再加熱・対象者の案内は**レシピ全体**へ。
 * - 文言は `src/i18n/ja.ts` の `ja.safety`（ハードコード禁止）。
 *
 * 見張りは `scripts/test-logic.mjs` の JH-1〜JH-11（誤検出の見張りは JH-8）。
 *
 * 2026-08-28 便MC: 生・半生で食べる料理を3つ足した（鶏とレバー・豚・しめさば）。
 * オーナー原文（足すかどうかの問いに）「足してください」。
 * **広げすぎないことがこの3つの肝**で、どれも料理名を名指しで取る。
 * 「刺身」全体には広げない（司令部の裁定）——刺身のレシピすべてに注意が出ると、
 * 毎回出る注意になって読み飛ばされ、本当に効かせたい注意まで効かなくなる。
 */

import { ja } from '../i18n/ja'

/** どの決まりで出た注記か（見張り・報告で1件ずつ数えられるようにする） */
export type SafetyRuleId =
  | 'microwaveEgg'
  | 'microwaveBurst'
  | 'microwaveRawMeat'
  | 'runnyEgg'
  | 'honey'
  | 'bigBatchStew'
  | 'rawChickenLiver'
  | 'rawPork'
  | 'shimesaba'

export interface SafetyNote {
  rule: SafetyRuleId
  text: string
  /** 手順に添えるものは 0 始まりの添字。レシピ全体に添えるものは undefined */
  stepIndex?: number
}

/** 判定に使うぶんだけのレシピの形（Recipe をそのまま渡せる） */
export interface SafetyNoteTarget {
  title: string
  servings?: number
  ingredients: readonly { name: string }[]
  steps: readonly { text: string; memo?: string }[]
  isStarter?: boolean
}

// ---- 語の表 -----------------------------------------------------------------
// 足すときは**1件ずつ「なぜ危険か」を書く**こと。理由なしで足さない。

/** 電子レンジで加熱していると読める手順 */
const MICROWAVE = ['電子レンジ', 'レンジ', 'レンチン']
/**
 * 「レンジ」を含むが電子レンジではない語。先に落としてから照合する
 * （「オレンジ」で毎回誤検出する。実際に取り込みレシピの材料に出る）
 */
const NOT_MICROWAVE_WORDS = ['オレンジ']
/**
 * 電子レンジのオーブン機能で焼く手順は、破裂・加熱ムラの話ではないので対象外
 * （取り込みデータ「簡単紅茶スコーンリピートレシピ♪」に実在する書き方）
 */
const OVEN_FUNCTION = ['オーブン機能']

/** 卵 */
const EGG = ['卵', 'たまご', '玉子']
/**
 * 卵の膜がすでに壊れている書き方。破裂しないので出さない
 * （溶き卵をレンジにかけるのはごく普通の手順で、ここで出すと毎回出てしまう）
 */
const EGG_ALREADY_BROKEN = ['溶き卵', '溶いた卵', 'とき卵', '卵液', '溶きほぐ', '割りほぐ', 'スクランブル']
/** すでに手当てが本文に書いてあるとき（二重に言わない） */
const ALREADY_PIERCED = ['穴を開け', '穴をあけ', '穴を空け', '爪楊枝', 'つまようじ', '切れ目を入れ']

/**
 * 皮や薄い膜に包まれていて、電子レンジ加熱で破裂することが知られている食品。
 * 中の水分が急に沸騰し、逃げ場のない蒸気が皮・膜を破る（取り出したあとに破裂することもある）。
 */
const BURST_FOODS = ['ウインナー', 'ウィンナー', 'ソーセージ', 'たらこ', 'タラコ', '明太子', 'めんたいこ', '栗', 'ぎんなん', '銀杏', 'いくら', 'イクラ']
/** 皮のついた野菜を「丸ごと」レンジにかけるとき（同じ理屈で破裂する） */
const WHOLE = ['丸ごと', 'まるごと', '丸のまま']
const SKIN_VEGETABLES = ['ピーマン', 'トマト', 'なす', 'ナス', 'じゃがいも', 'さつまいも', 'かぼちゃ', 'とうもろこし']

/**
 * 生のまま加熱する肉・魚介。電子レンジは火の通りにムラが出るため、
 * 大きいもの・厚みのあるものは中心が生のまま残りやすい（D-④①②と同じ話）。
 * ベーコン・ハムのような加熱済みのものは入れない。
 */
const RAW_MEAT_FISH = [
  '鶏むね', '鶏胸', 'むね肉', '鶏もも', 'もも肉', '鶏肉', 'ささみ', '手羽',
  '豚肉', '豚こま', '豚バラ', '豚ロース', '豚ひき', 'ひき肉', '挽き肉', '合いびき', '合挽',
  '牛肉', '牛こま', '牛切り落とし',
  '鮭', 'サーモン', 'さば', 'サバ', 'ぶり', 'ブリ', 'えび', 'エビ', '海老',
]
/** 火の通りの目安が本文にすでに書いてあるとき（二重に言わない） */
const ALREADY_DONENESS = ['赤み', '赤い', '火が通', '火を通', '中まで', '生焼け', '色が変わるまで']
/** 加熱ではなく解凍・温め直しの手順（生の肉を火にかける話ではない） */
const NOT_COOKING = ['解凍', '温め直']

/** 半熟・生の卵。強い語（それだけで卵の話だと分かるもの） */
const RUNNY_EGG_STRONG = ['温泉卵', '温玉', '生卵', '半熟卵', '半熟たまご', '半熟玉子', '月見', '卵黄をのせ', '黄身をのせ']
/** 弱い語（同じ文に卵の語があるときだけ拾う。「半熟チーズケーキ」のような食感の話と分けるため） */
const RUNNY_EGG_WEAK = ['半熟']

/** はちみつ（1歳未満に与えない。加熱しても変わらないので加熱の有無は見ない） */
const HONEY = ['はちみつ', '蜂蜜', 'ハチミツ']

/**
 * 大鍋で作って置くことが多い煮込み。作り置き・大量に作った分を常温に置くと傷みやすい。
 * 料理名で取る（材料からは「大鍋で作り置きする料理か」が読めない）。
 */
const STEW_NAMES = ['カレー', 'シチュー', 'ハヤシ', 'ポトフ', 'おでん', '豚汁', 'けんちん汁', 'ミネストローネ']
/** 作り置きと書いてあれば人数分によらず対象にする */
const MAKE_AHEAD = ['作り置き', 'つくりおき', '作りおき', '常備菜']
/** 何人分から「大鍋」と見るか（D-④④ の「4人前以上」） */
const BIG_BATCH_SERVINGS = 4

/**
 * 鶏肉・レバーを生／半生のまま食べる料理名（2026-08-28 便MC）。
 *
 * なぜ危険か: 日本の食中毒で**件数がいちばん多いのがカンピロバクター**で、その主な
 * 出どころが鶏の生・半生（鶏刺し・鶏わさ・鶏のたたき）と生のレバー。新しさ・見た目では
 * 見分けられず、中心まで加熱する以外に確かな手当てが無い。
 *
 * **料理名を名指しで取る**（「鶏」＋「生」のような組み合わせでは取らない）。
 * 「生の鶏肉を切る」「鶏肉に火が通るまで」のような普通の手順と見分けが付かず、
 * 鶏を使うレシピすべてに注意が出る＝毎回出る注意になって読み飛ばされる。
 * 「たたき」を単独で取らないのも同じ理由（かつおのたたき・たたききゅうり・梅たたきなど、
 * 生の鶏とは無関係の料理のほうが多い）。
 */
const RAW_CHICKEN_LIVER = [
  '鶏刺し', '鶏さし', 'とり刺し', 'とりさし', '鳥刺し', '鳥さし',
  '鶏わさ', 'とりわさ', '鳥わさ', '鶏ワサ', 'トリワサ',
  'レバ刺し', 'レバー刺し', 'レバさし', '生レバ',
  '鶏のたたき', '鶏たたき', 'とりのたたき', 'とりたたき', '鳥のたたき', '鳥たたき',
  'ささみのたたき', 'むね肉のたたき', 'もも肉のたたき', 'レバーのたたき', 'レバたたき',
]

/**
 * 豚肉を生／半生のまま食べる料理名（2026-08-28 便MC）。
 *
 * なぜ危険か: **豚の生食は国が禁じている**（2015年の規格基準で、生食用としての
 * 販売・提供ができなくなった）。E型肝炎ウイルスと寄生虫が理由で、どちらも
 * 中心まで加熱する以外に避ける方法が無い。
 *
 * こちらも料理名を名指しで取る。「生の豚」のような形で取ると
 * 「生の豚肉を扱ったまな板は洗う」といった**交差汚染の注意そのもの**に当たってしまう。
 * 「生ハム」は塩漬け・乾燥した加工品でこの話とは別なので、語の表に入れない
 * （名指しなので、そもそも当たらない）。
 */
const RAW_PORK = [
  '豚刺し', '豚さし', '豚の刺身',
  '豚のたたき', '豚たたき', 'ポークのたたき', 'ポークたたき',
  'レアポーク', '豚の生食', '豚肉の生食',
]

/**
 * 「中まで火を通す」と本文に書いてある＝生・半生で食べる料理ではないとき（鶏・豚の除外）。
 *
 * 「火を通」だけで見ないのは、たたきの手順が「**表面だけ**火を通す」と書くため。
 * そこで消すと、いちばん注意が要るレシピでだけ出なくなる（既存の ALREADY_DONENESS を
 * そのまま使うと、まさにこの形になる）。
 */
const FULLY_COOKED = [
  '中まで火を通', '中心まで火を通', 'しっかり火を通', '完全に火を通',
  '中まで火が通', '中心まで火が通', '中まで加熱', '中心まで加熱',
]

/**
 * しめさば（2026-08-28 便MC）。
 *
 * なぜ危険か: **アニサキス**（魚の寄生虫）は酢では死なない。「酢でしめてある＝
 * 生ではない」と読まれやすいのに、実際は生の魚のまま。避けられるのは冷凍か加熱だけ。
 *
 * **「刺身」全体には広げない**（司令部の裁定）。刺身のレシピすべてに注意が出ると、
 * 毎回出る注意になって読み飛ばされ、本当に効かせたいものまで効かなくなる。
 * ここで取るのは「酢でしめてあるので生ではない、と読み違えられる」しめさばだけ。
 */
const SHIMESABA = [
  'しめさば', 'しめサバ', 'しめ鯖',
  '〆さば', '〆サバ', '〆鯖',
  '締めさば', '締めサバ', '締め鯖',
  'シメサバ',
]
/** さばそのもの（下の「冷凍」と同じ文にあるときだけ除外に使う） */
const SABA = ['さば', 'サバ', '鯖']
/** 一度冷凍してあると読める書き方（注記の中身と同じことが既に書いてある） */
const FROZEN = ['冷凍']

// ---- 判定 -------------------------------------------------------------------

function has(haystack: string, words: readonly string[]): boolean {
  return words.some((w) => haystack.includes(w))
}

/** 電子レンジで加熱している手順か */
function isMicrowaveStep(text: string): boolean {
  if (has(text, OVEN_FUNCTION)) return false
  let cleaned = text
  for (const w of NOT_MICROWAVE_WORDS) cleaned = cleaned.split(w).join('')
  return has(cleaned, MICROWAVE)
}

/** 料理名・材料名・手順本文を1つずつ（メモは入れない＝利用者の書いた注記を判定材料にしない） */
function textParts(recipe: SafetyNoteTarget): string[] {
  return [
    recipe.title,
    ...recipe.ingredients.map((i) => i.name),
    ...recipe.steps.map((s) => s.text),
  ]
}

/** レシピ全体を1つの文字列にする（料理名・材料名・手順本文。メモは見ない＝利用者の書いた注記を判定材料にしない） */
function wholeText(recipe: SafetyNoteTarget): string {
  return textParts(recipe).join('\n')
}

/**
 * **除外の判定にだけ**使う文字列（手順のメモも足す）。
 * 「もう書いてある」を見るときは利用者のメモも数えてよい（二重に言わないため）。
 * 注記を**出す**側の判定には使わない（メモを材料にすると、利用者が書いた注記で注記が増える）。
 */
function wholeTextWithMemo(recipe: SafetyNoteTarget): string {
  return [wholeText(recipe), ...recipe.steps.map((s) => s.memo ?? '')].join('\n')
}

/** 半熟・生の卵を使うレシピか（強い語はそのまま、弱い語は同じ文に卵があるときだけ） */
function usesRunnyEgg(recipe: SafetyNoteTarget): boolean {
  return textParts(recipe).some(
    (part) => has(part, RUNNY_EGG_STRONG) || (has(part, RUNNY_EGG_WEAK) && has(part, EGG)),
  )
}

/**
 * 鶏肉・レバーを生／半生で食べるレシピか。
 * 「中まで火を通す」と書いてあるレシピには出さない（たたき風で実際は火を通す品がある）。
 */
function usesRawChickenOrLiver(recipe: SafetyNoteTarget): boolean {
  if (!has(wholeText(recipe), RAW_CHICKEN_LIVER)) return false
  return !has(wholeTextWithMemo(recipe), FULLY_COOKED)
}

/** 豚肉を生／半生で食べるレシピか（除外の考え方は鶏・レバーと同じ） */
function usesRawPork(recipe: SafetyNoteTarget): boolean {
  if (!has(wholeText(recipe), RAW_PORK)) return false
  return !has(wholeTextWithMemo(recipe), FULLY_COOKED)
}

/**
 * しめさばを使うレシピか。
 * 「さばを一度冷凍する」と**同じ文**に書いてあれば出さない（注記の中身と同じことが既にある）。
 * 「冷凍」だけで見ないのは、「冷凍庫で保存できます」のような別の話で消えてしまうため。
 */
function usesShimesaba(recipe: SafetyNoteTarget): boolean {
  const parts = textParts(recipe)
  if (!parts.some((part) => has(part, SHIMESABA))) return false
  const frozenFish = [...parts, ...recipe.steps.map((s) => s.memo ?? '')].some(
    (part) => has(part, FROZEN) && has(part, SABA),
  )
  return !frozenFish
}

/** 大鍋の煮込み（作り置き、または4人分以上）か */
function isBigBatchStew(recipe: SafetyNoteTarget): boolean {
  if (!has(recipe.title, STEW_NAMES)) return false
  if (has(recipe.title, MAKE_AHEAD)) return true
  return (recipe.servings ?? 0) >= BIG_BATCH_SERVINGS
}

/**
 * そのレシピに添える安全注記を組み立てる。
 * 同梱の基本レシピ（isStarter）には何も出さない。
 */
export function safetyNotesFor(recipe: SafetyNoteTarget): SafetyNote[] {
  if (recipe.isStarter) return []
  const notes: SafetyNote[] = []

  // --- 手順に添えるもの（火通り・加熱の目安） ---
  recipe.steps.forEach((step, stepIndex) => {
    const text = step.text
    if (!isMicrowaveStep(text)) return

    // ①電子レンジ＋卵: 黄身が薄い膜に包まれたまま加熱されると破裂する
    if (has(text, EGG) && !has(text, EGG_ALREADY_BROKEN) && !has(text, ALREADY_PIERCED)) {
      notes.push({ rule: 'microwaveEgg', text: ja.safety.microwaveEgg, stepIndex })
    }

    // ②電子レンジ＋皮・膜に包まれたもの: 同じ理屈で破裂する
    const wholeSkinVegetable = has(text, WHOLE) && has(text, SKIN_VEGETABLES)
    if ((has(text, BURST_FOODS) || wholeSkinVegetable) && !has(text, ALREADY_PIERCED)) {
      notes.push({ rule: 'microwaveBurst', text: ja.safety.microwaveBurst, stepIndex })
    }

    // ③電子レンジ＋生の肉・魚: 加熱ムラで中心が生のまま残りやすい
    if (
      has(text, RAW_MEAT_FISH) &&
      !has(text, NOT_COOKING) &&
      !has(text, ALREADY_DONENESS) &&
      !has(step.memo ?? '', ALREADY_DONENESS)
    ) {
      notes.push({ rule: 'microwaveRawMeat', text: ja.safety.microwaveRawMeat, stepIndex })
    }
  })

  // --- レシピ全体に添えるもの（対象者・保存・再加熱） ---
  if (usesRunnyEgg(recipe)) {
    notes.push({ rule: 'runnyEgg', text: ja.safety.runnyEgg })
  }
  // ⑦鶏・レバーの生／半生: カンピロバクターの出どころで、加熱以外に確かな手当てが無い
  if (usesRawChickenOrLiver(recipe)) {
    notes.push({ rule: 'rawChickenLiver', text: ja.safety.rawChickenLiver })
  }
  // ⑧豚の生／半生: 生食は国が禁じている（E型肝炎・寄生虫）
  if (usesRawPork(recipe)) {
    notes.push({ rule: 'rawPork', text: ja.safety.rawPork })
  }
  // ⑨しめさば: 酢では寄生虫（アニサキス）は死なない＝酢でしめても生の魚のまま
  if (usesShimesaba(recipe)) {
    notes.push({ rule: 'shimesaba', text: ja.safety.shimesaba })
  }
  if (has(wholeText(recipe), HONEY)) {
    notes.push({ rule: 'honey', text: ja.safety.honey })
  }
  if (isBigBatchStew(recipe)) {
    notes.push({ rule: 'bigBatchStew', text: ja.safety.bigBatchStew })
  }

  return notes
}

/** その手順に添える注記だけを取り出す */
export function stepSafetyNotes(notes: readonly SafetyNote[], stepIndex: number): SafetyNote[] {
  return notes.filter((n) => n.stepIndex === stepIndex)
}

/** レシピ全体に添える注記だけを取り出す */
export function wholeRecipeSafetyNotes(notes: readonly SafetyNote[]): SafetyNote[] {
  return notes.filter((n) => n.stepIndex === undefined)
}
