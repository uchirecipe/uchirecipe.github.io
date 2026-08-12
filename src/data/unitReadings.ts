/**
 * 読み上げ（SpeechSynthesis）専用の、単位・数の読み替え表（2026-08-12 便FX）。
 *
 * オーナー実機「読み上げ精度なんとかならない？『cm』をシーエムと読むくらいに酷い」。
 * 端末の音声は英字の単位を字のまま読む（cm＝シーエム、g＝ジー）ので、**読み上げに渡す前に
 * 日本語の読みへ置き換える**。同梱109品の手順本文には cm が24か所・mm が5か所・L が3か所・
 * kg が1か所あり、いちばん多い cm がそのまま「シーエム」になっていた。
 *
 * **用語タップ辞書（data/cookingTerms.ts）には入れない**。あちらは「語をタップすると説明が出る」
 * 辞書で、載せた語は本文中で下線つきのタップ対象になる。単位を載せると手順本文の「200g」の
 * 「g」がタップ対象になり、押すと「グラム」とだけ出る窓が開く＝読み上げを直すために
 * 画面の読み心地を壊すことになる。読み替えは読み上げの経路だけで行う。
 *
 * 置き換えの掛け方:
 *   - 単位は**数字のあとに来たときだけ**当てる（「1L」は当てるが、英単語の中の l は当てない）
 *   - 長い表記から順に当てる（kg→g、ml→L、mm→m の取りこぼしを作らない）
 *   - 表示テキストは1文字も変えない（置き換えるのは読み上げに渡す文字列だけ）
 *
 * 誤読が報告されたら、ここに1行足すだけで直る（cookingTerms.ts の reading と同じ運用）。
 */

/** 数字のあとに来た単位の読み。**上から順に当てる**（長い表記が先） */
const UNIT_READINGS: readonly (readonly [RegExp, string])[] = [
  [/(\d)\s*kg/g, '$1キロ'],
  [/(\d)\s*cm/g, '$1センチ'],
  [/(\d)\s*mm/g, '$1ミリ'],
  [/(\d)\s*(?:ml|mL|ML|Ml)/g, '$1ミリリットル'],
  [/(\d)\s*cc/g, '$1シーシー'],
  [/(\d)\s*[lLℓ](?![a-zA-Z])/g, '$1リットル'],
  [/(\d)\s*g(?![a-zA-Z])/g, '$1グラム'],
  [/(\d)\s*(?:℃|°C)/g, '$1度'],
  [/(\d)\s*%/g, '$1パーセント'],
]

/**
 * 数字が要らない読み替え。
 * 「大さじ」は端末によって「だいさじ」、「小さじ」は「しょうさじ」と読まれることがある。
 */
const WORD_READINGS: readonly (readonly [RegExp, string])[] = [
  [/大さじ/g, 'おおさじ'],
  [/小さじ/g, 'こさじ'],
]

/**
 * 分数（「卵液の1/3を流して」）。字のままだと「1スラッシュ3」「いちぶんのさん」など
 * 端末ごとにばらつく。日本語の言い方（3分の1）に直す。
 */
const FRACTION_PATTERN = /(\d+)\s*\/\s*(\d+)/g

/** 単位・数の読みを当てた文字列を返す（表示テキストには使わない） */
export function applyUnitReadings(text: string): string {
  let result = text.replace(FRACTION_PATTERN, '$2分の$1')
  for (const [pattern, reading] of UNIT_READINGS) result = result.replace(pattern, reading)
  for (const [pattern, reading] of WORD_READINGS) result = result.replace(pattern, reading)
  return result
}
