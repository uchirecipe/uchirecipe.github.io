import { normalizeAmountInput } from './amount'

/**
 * 単位換算の共有モジュール（2026-07-28 便BY/COST-01）。
 *
 * 【なぜ切り出したか】栄養価(nutrition.ts)と原価(priceEstimate.ts)は、どちらも
 * 「分量＋単位」を扱うのに換算の土台が別々だった。そのため同じ材料が同じ画面で
 * 別々の量として計算される状態が生まれていた（例:「鶏むね肉 1枚」を栄養は250gとして
 * 計算し、原価は100g分の価格しか乗せない）。両方が同じ換算表を見るように、
 * 単位の定義・正規化だけをここへ集約する。
 *
 * 【なぜ priceEstimate.ts に置いたままにしないか】原価側から栄養側の
 * unitGrams（食品ごとの「1枚=◯g」）を参照する必要が出たため、
 * nutrition.ts → priceEstimate.ts → nutrition.ts の循環importになってしまう。
 * 依存の向きを nutrition.ts / priceEstimate.ts → unitGrams.ts の一方通行にして解消した。
 */

/**
 * 質量: 基準はg。kg=1000g・mg=0.001gはSI(国際単位系)の接頭辞(キロ=10^3・ミリ=10^-3)そのもので、
 * 「調べて決める値」ではなく単位の定義から一意に決まる値（根拠調査の対象外）。
 */
const MASS_UNIT_FACTORS: Record<string, number> = {
  g: 1,
  kg: 1000,
  mg: 0.001,
}

/**
 * 体積: 基準はml。
 * - ml/cc/l/L/リットルはSI(国際単位系)の定義そのもの（1cc=1ml、1L=1000ml。根拠調査の対象外）。
 * - 大さじ=15ml・小さじ=5ml・カップ=200mlは、1948年制定のJIS S 2052「家庭用計量スプーン」
 *   （大さじ15ml±0.5ml・小さじ5ml±0.2ml）で正式に統一された日本の家庭料理の標準値。
 *   計量カップ200mlも同JIS由来で、大手レシピサイト・文部科学省「日本食品標準成分表」の
 *   目安量表でも共通してこの値が使われる（米を量る「合(180ml)」や欧米の1カップ(約237ml)とは
 *   別物なので注意）。2026-07-21 単位換算監査(docs/48)でオーナー指定値と突き合わせ済み。
 * nutrition.ts の SPOON_ML（栄養価側のg換算に使う大さじ/小さじ/カップ）もこの値を使う
 * （数値を2箇所に手書きで重複させると片方だけ変更されて食い違う事故が起きるため、
 * VOLUME_UNIT_FACTORSをexportして両者が参照する一本化構成にしている）。
 */
export const VOLUME_UNIT_FACTORS: Record<string, number> = {
  ml: 1,
  cc: 1,
  l: 1000,
  L: 1000,
  リットル: 1000,
  大さじ: 15,
  小さじ: 5,
  カップ: 200,
  // 「大匙」「小匙」は「大さじ」「小さじ」の漢字表記（2026-08-23 便KE）。
  // 新しい換算値ではなく同じ値の書き方ちがいで、上のJIS値をそのまま指す。
  // クックパッドの実レシピで普通に使われており、影響範囲テストA（30品）では
  // 「醤油 大匙1」に しょうゆ1L1本ぶんの400円が乗っていた
  大匙: 15,
  小匙: 5,
}

/**
 * 個数: 単位名ごとに別物として扱う（「1個」と「1本」は同じ「1」でも重さが違うため換算不可。
 * 数値換算表ではなく、按分に使ってよい単位名の許可リストという性質のもの）。
 * ここに列挙した名前はunitForm.ts(食材と価格の単位入力UI)のKNOWN_UNITSと対応する
 * レシピ側の助数詞表記を拾うための一覧で、値の大小を調べる根拠は不要（単位名の一致判定のみに使う）。
 */
const COUNT_UNIT_NAMES = new Set([
  '個', '本', '枚', '玉', '束', 'パック', 'かけ', '片', '株', '尾', '切れ', '丁', '袋', '缶', '房', '節',
])

/** 単位の次元。質量・体積は基準単位(g・ml)に換算して按分し、個数は単位名が一致する時だけ按分する */
export type UnitDimension = 'mass' | 'volume' | 'count'

/**
 * 単位正規化の結果。mass/volumeは基準量(g・ml換算後の数値)に統一されるので次元さえ揃えば
 * そのまま比率計算できる。countは「1個」と「1本」が別物のため、単位名(unit)も保持する。
 */
export type NormalizedUnit =
  | { dim: 'mass'; base: number }
  | { dim: 'volume'; base: number }
  | { dim: 'count'; unit: string; base: number }

/**
 * 単位欄を解釈するための下ごしらえ（2026-08-23 便KE）。
 * NFKC正規化と前後の空白落としに加えて、**末尾に残った範囲の印**（「〜」「～」「~」）を落とす。
 *
 * 実データ（影響範囲テストA・節約したい人の30品）では、元ページの「豚こま肉 100g～」
 * 「ニラ 1/2束～」が取り込みで分量「100」＋単位「g～」に割れており、単位として読めないため
 * 質量・個数のどちらにも解決できず、金額が満額フォールバックへ落ちていた。
 * 分量側の範囲は leadingRangeAmount が「先頭の値を採る（少なめ側＝過大に見せない）」という
 * 同じ考え方で処理しているので、単位側もそれに揃える。
 * **解釈専用**（保存データそのものは書き換えない）。
 */
export function normalizeUnitText(unit: string): string {
  return normalizeAmountInput((unit ?? '').trim())
    .replace(/[〜～~]+$/, '')
    .trim()
}

/**
 * 数量+単位を「次元(mass/volume/count)＋基準量」に正規化する。
 * - 質量(g/kg/mg)・体積(ml/cc/l/L/リットル/大さじ/小さじ/カップ)は基準単位換算後の数値を返すので、
 *   同じ次元同士なら基準量の比でそのまま按分できる（kg↔g・L↔ml・大さじ↔小さじ 等）。
 * - 個数（個/本/枚/玉/束/パック/かけ/片/株/尾/切れ/丁/袋/缶/房/節）は単位名込みで返す
 *   （呼び出し側で単位名が一致する時だけ按分に使うこと。「1個」と「1本」は別物）。
 * - 「少々」「適量」等の解釈できない単位・0以下の数量はnull（呼び出し側でフォールバック）。
 *
 * unitはNFKC正規化してから比較する(2026-07-21全角対応: 全角「ｇ」「ｍｌ」等でも半角と同じ
 * 単位名に一致させるため。保存データ自体は書き換えない)。
 */
export function normalizeUnit(amount: number, unit: string): NormalizedUnit | null {
  if (!Number.isFinite(amount) || amount <= 0) return null
  const trimmed = normalizeUnitText(unit)
  if (!trimmed) return null

  const massFactor = MASS_UNIT_FACTORS[trimmed]
  if (massFactor != null) return { dim: 'mass', base: amount * massFactor }

  const volumeFactor = VOLUME_UNIT_FACTORS[trimmed]
  if (volumeFactor != null) return { dim: 'volume', base: amount * volumeFactor }

  if (COUNT_UNIT_NAMES.has(trimmed)) return { dim: 'count', unit: trimmed, base: amount }

  return null
}

/**
 * マスタの unit（例:「100g」「1個」「1/4個」「大さじ1」「1小さじ」）を数量と単位に分解する。
 * 先頭が数字の「数量+単位」（100g・1個）だけでなく、末尾が数字の「単位+数量」
 * （大さじ1・小さじ1）も解釈する（PRICE_DEFAULTSに両方の書式が混在しているため）。
 * どちらの書式にも当てはまらなければ、qty=1・baseUnit=元の文字列のまま返す
 * （後続の按分計算では ingredient.unit と一致しない限り使われないので実害はない）。
 *
 * 先頭の数量は分数(「1/4個」「1/2本」)も解釈する(2026-07-28 便BY/COST-01)。
 * 従来は `1/4個` を `{qty:1, baseUnit:'/4個'}` と読んでいたため、キャベツ・白菜・大根は
 * レシピ側にどんな分量を書いても按分できず、常にマスタ金額の満額が1行分に乗っていた。
 *
 * IngredientPricesPage（「食材と価格」の数量＋単位選択UI。2026-07-15）でも、既存行の
 * unit文字列を編集フォームの初期値（数量欄＋単位選択）へ分解するのに共用する
 * （二重実装を避けるためexport）。
 */
export function parseUnitQuantity(unit: string): { qty: number; baseUnit: string } {
  const trimmed = normalizeAmountInput(unit.trim())
  const leading = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?(.*)$/)
  if (leading) {
    let qty = Number.parseFloat(leading[1])
    const denominator = leading[2] ? Number.parseFloat(leading[2]) : undefined
    if (denominator !== undefined && denominator !== 0) qty /= denominator
    const baseUnit = leading[3].trim()
    return { qty: qty > 0 ? qty : 1, baseUnit: baseUnit || trimmed }
  }
  const trailing = trimmed.match(/^(\D+?)(\d+(?:\.\d+)?)$/)
  if (trailing) {
    const baseUnit = trailing[1].trim()
    const qty = Number.parseFloat(trailing[2])
    if (baseUnit) return { qty: qty > 0 ? qty : 1, baseUnit }
  }
  return { qty: 1, baseUnit: trimmed }
}
