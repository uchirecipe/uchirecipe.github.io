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
 * 見張りは `scripts/test-logic.mjs` の JH-1〜JH-7。
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

/** レシピ全体を1つの文字列にする（料理名・材料名・手順本文。メモは見ない＝利用者の書いた注記を判定材料にしない） */
function wholeText(recipe: SafetyNoteTarget): string {
  return [
    recipe.title,
    ...recipe.ingredients.map((i) => i.name),
    ...recipe.steps.map((s) => s.text),
  ].join('\n')
}

/** 半熟・生の卵を使うレシピか（強い語はそのまま、弱い語は同じ文に卵があるときだけ） */
function usesRunnyEgg(recipe: SafetyNoteTarget): boolean {
  const parts = [recipe.title, ...recipe.ingredients.map((i) => i.name), ...recipe.steps.map((s) => s.text)]
  return parts.some(
    (part) => has(part, RUNNY_EGG_STRONG) || (has(part, RUNNY_EGG_WEAK) && has(part, EGG)),
  )
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
