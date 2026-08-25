import type { Ingredient } from '../db/types'
import { leadingRangeAmount, normalizeAmountInput, resolveCalcAmount } from './amount'
import { stripIngredientNoise, toHiragana } from './kana'
import { normalizeUnit, normalizeUnitText, parseUnitQuantity, VOLUME_UNIT_FACTORS } from './unitGrams'
import { typicalAmountFor } from './amountAssumption'
// 栄養側の「1枚=◯g」等の目安量(文部科学省 日本食品標準成分表ベース・docs/47監査済み)を
// 原価の按分にも使うための参照。依存の向きは priceEstimate → nutrition の一方通行で、
// nutrition側は単位換算の定義を unitGrams.ts から取るため循環importにはならない
// （2026-07-28 便BY/COST-01。同じ材料の「量」を2つのエンジンが別々に解釈していたのを解消する）。
import { convertToGrams, isZeroIngredient, matchNutritionFood } from './nutrition'
// 「価格が分からない材料」のうち主材料はどれか（一覧カードの食材チップと同じ判定を使い回す）。
// 2026-08-22 便JG。mainIngredients は priceEstimate を読まないので循環importにはならない
import { pickMainIngredients } from './mainIngredients'
// 実効食数(枠ごとの食数 > 設定「ふだん作る人数」 > レシピの登録人数分)の判定は1か所に集約する
// （2026-08-03 便DK。買い物メモの分量と概算食費が違う人数分で計算されないようにするため）
import { effectiveMealServings } from './servings'

/**
 * 概算食費計算: レシピの「材料ごとの価格入力」(Ingredient.price)を優先し、
 * 未入力の材料だけ食材価格マスタ(PriceEntry)で補うフォールバック計算。
 * 優先度: レシピ個別入力 > マスタ一致 > なし（docs/20 実装設計書 §3）。
 */

/** 材料名の表示正規化: 括弧書き（全角/半角どちらも）を落として前後の空白を削る */
export function normalizeIngredientNameForPrice(name: string): string {
  return name
    .trim()
    .replace(/[（(][^）)]*[）)]/g, '')
    .trim()
}

/** マスタ照合用に正規化・整形済みの1件 */
export interface PriceIndexEntry {
  /**
   * 元になったPriceEntryのid(2026-07-16 裁定1「原価ビュー」追加)。マスタから作った索引なら
   * 必ず入っている想定だが、PRICE_DEFAULTSの生データ(idを持たない)から直接buildPriceIndexを
   * 呼ぶテスト用途もあるため任意項目のまま後方互換を保つ。原価ビューの編集チップは
   * matchPriceEntryで見つけたエントリのidからマスタ行を特定し、編集モーダルに渡す
   */
  id?: number
  normalizedName: string
  /**
   * 照合専用キー: normalizedName(括弧除去済みの表示名)をさらにtoHiraganaでかな正規化したもの
   * （カタカナ⇄ひらがな⇄辞書登録済み漢字の表記ゆれを吸収）。
   * H-2(Fable裁定): db/prices.tsの重複チェック(normalizeForDuplicateCheck)と同一の正規化に
   * 揃えることで、「たまねぎ」で登録した価格が材料名「玉ねぎ」にも一致するようにする
   * (登録時はかな正規化で重複ブロックされるのに照合時は一致しない、という袋小路の解消)。
   * normalizedNameは表示・デバッグ用にかな正規化前のまま保持する。
   */
  matchKey: string
  pricePerUnit: number
  unit: string
  /**
   * マスタ行が投入時の目安価格のままか(true)、ユーザーが価格・単位を上書きしたか(false)。
   * db/prices.tsのPriceEntry.isDefaultと同じ意味（未設定は「安全側」でfalse扱い。2026-07-13追加）
   */
  isDefault: boolean
}

/**
 * PriceEntry配列から照合用の索引を作る。
 * 照合キー(かな正規化後)が長いものを先に並べる（前方一致で複数ヒットしたとき、より具体的な名前を優先するため）。
 *
 * 2026-08-10 便FA: 照合キーが**同じ**行が2つ並んだときは、ユーザーが値を入れた行(isDefault=false)を
 * 先にする。名寄せした食材（「しいたけ」と「生しいたけ」、「三つ葉」と「みつば」、「人参」と
 * 「にんじん」）は、既存端末に旧名の行が残っていると同じ照合キーの行が2つできる。並び順まかせだと
 * 投入時の目安価格のほうが当たり、ユーザーが自分で入れた値段が使われないことがあった。
 * 「自分で入れた値段が優先される」を索引の作り方として固定する
 * （PRICE_DEFAULTS には同じ照合キーの項目が無いので、新規インストールの挙動は1円も変わらない）。
 */
export function buildPriceIndex(
  entries: { id?: number; name: string; pricePerUnit: number; unit: string; isDefault?: boolean }[],
): PriceIndexEntry[] {
  return entries
    .map((e) => {
      const normalizedName = normalizeIngredientNameForPrice(e.name)
      return {
        id: e.id,
        normalizedName,
        matchKey: toHiragana(normalizedName),
        pricePerUnit: e.pricePerUnit,
        unit: e.unit,
        isDefault: e.isDefault === true,
      }
    })
    .filter((e) => e.normalizedName && e.pricePerUnit > 0)
    .sort(
      (a, b) =>
        b.matchKey.length - a.matchKey.length ||
        Number(a.isDefault) - Number(b.isDefault),
    )
}

/**
 * 材料名からマスタの1件を探す。
 * 1) かな正規化後の完全一致 → 2) 材料名がマスタ名で始まる前方一致（例:「たまねぎ薄切り」→「たまねぎ」、
 * 「トウフ」で登録した材料が「とうふ」のマスタに一致 等）の順で照合する（H-2: db/prices.tsの
 * 重複チェックと同じかな正規化キーで比較する）。
 *
 * 【2026-08-25 便KX: 前方一致の順番を組み替えた】
 * 日本語の複合語は**主要語が末尾**にある（「ねぎ味噌」はみそ／「合わせ酢」は酢）。
 * 前方一致はその逆を見る仕組みなので、確かめずに先頭だけで決めると別の食材に当たる。
 * そこで確かめの強い順に並べ替え、**先頭で決めるのはいちばん最後**にした:
 *   ① 完全一致
 *   ② 成分表で同じ食品だと確認できた前方一致（matchPriceEntryExact）
 *   ③ 飾り語・記号を落としてから ①②
 *   ④ 成分表の食品名を経由（matchPriceEntryViaNutritionFood）
 *   ⑤ **末尾一致**（matchPriceEntryBySuffix。主要語は末尾。「ねぎ味噌」→みそ）
 *   ⑥ 確認できない前方一致（matchPriceEntryLoosePrefix。最後の手当て）
 * 実測は下の各関数のコメントに書いた。
 */
export function matchPriceEntry(name: string, index: PriceIndexEntry[]): PriceIndexEntry | undefined {
  const hit = matchPriceEntryExact(name, index)
  if (hit) return hit
  // 素の名前で当たらなかったときだけ、商品名の飾り語（オーガニック・微粒子・国産…）と
  // 合わせ調味料の印（★・〇・a. など）を落としてもう一度探す
  // （2026-08-20 便IL・③／記号は 2026-08-23 便KE で追加）。
  // 原価側の照合は「マスタ名で始まるか」の前方一致なので、名前の頭に飾りが付いているだけで
  // 1件も当たらなかった（「国産たまねぎ」→ 価格なし／影響範囲テストAでは `★酒` `〇酒` `a. 酒`
  // `〇コチュジャン（なくてもOK）` など7行が同じ理由で「価格なし」になっていた）。
  // 当たらなかったときの最後の手当てなので、これまで当たっていた材料の結果は変わらない
  const stripped = stripIngredientNoise(name)
  const strippedHit =
    stripped !== name.trim() ? matchPriceEntryExact(stripped, index) : undefined
  if (strippedHit) return strippedHit
  // それでも当たらなければ、栄養（成分表）の食品名を経由してもう一度探す（2026-08-22 便JG）
  const viaFood = matchPriceEntryViaNutritionFood(name, index)
  if (viaFood) return viaFood
  // ここから下は 2026-08-25 便KX。成分表で身元が分からなかった名前だけが来る
  const suffixHit = matchPriceEntryBySuffix(name, index)
  if (suffixHit) return suffixHit
  return (
    matchPriceEntryLoosePrefix(name, index) ??
    (stripped !== name.trim() ? matchPriceEntryLoosePrefix(stripped, index) : undefined)
  )
}

/**
 * 末尾一致（2026-08-25 便KX）。日本語の複合名詞は**主要語が末尾**にあるので、
 * 成分表で身元の分からない名前は、**先頭より末尾のほうが当たる**。
 *   「ねぎ味噌」→ ねぎ(100円/1本)ではなく みそ(11円/大さじ1)
 *   「塩さば」  → 塩(1円/小さじ1)ではなく さば(100円/1切れ)
 *   「酢みそ」  → 酢(340円/1L)ではなく みそ
 * 索引は照合キーの長い順に並んでいるので、いちばん長い末尾が採られる。
 *
 * **④の成分表経由より後に置くこと。**先に置くと「葉ねぎ」が末尾の「ねぎ」(100円/1本)に
 * 当たってしまい、成分表が知っている「青ねぎ」(80円/100g)に届かなくなる
 * （「細ねぎ→小ねぎ」「白ねぎ→長ねぎ」も同じ。実測で3件が壊れた）。
 */
function matchPriceEntryBySuffix(
  name: string,
  index: PriceIndexEntry[],
): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  const key = toHiragana(normalized)
  return index.find((e) => key.length > e.matchKey.length && key.endsWith(e.matchKey))
}

/**
 * 確認できない前方一致（2026-08-25 便KX）。**最後の手当て**。
 *
 * ここへ来るのは「材料名が成分表のどの食品にも解決できなかった」名前だけで、
 * 前方一致が正しいかどうかを確かめる手立てが無い。それでも落とさずに拾うのは、
 * オーナーの実データで**書き足し・並記が普通にある**から:
 *   「ねぎのみじん切り・大さじ2」(20g=20円) 「みそだれ」 「みそ、水 各」 「塩、酒」
 * これらは先頭の語がそのまま材料で、前方一致が正しい。
 *
 * ただし2つだけ条件を付ける。
 *
 * 【条件1】**切り取った残りが「別の語の始まり」なら認めない**（restStartsNewWord）。
 * 【条件2】**マスタ側の身元が成分表で分からない組は認めない**（entryFood が無いとき）。
 *   これで塞げた誤爆（2026-08-25 実測）:
 *     「ワインビネガー／白ワインビネガー／赤ワインビネガー／ぶどう酢」大さじ2 → 赤ワイン 600円/1L で18円
 *     （成分表は 17017 果実酢ぶどう酢 と正しく分かっているのに、価格マスタの「赤ワイン」は
 *       成分表に無いため素通りしていた。ワインとワインビネガーは別物）
 *   逆に、この条件を付けたことで当たらなくなった正しい組は、実測で1件も無かった。
 */
function matchPriceEntryLoosePrefix(
  name: string,
  index: PriceIndexEntry[],
): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  if (matchNutritionFood(normalized)) return undefined // ②で確かめ済み。ここは身元不明の名前だけ
  const key = toHiragana(normalized)
  return index.find(
    (e) =>
      key.startsWith(e.matchKey) &&
      !restStartsNewWord(normalized, e.matchKey) &&
      matchNutritionFood(e.normalizedName) != null,
  )
}

/**
 * 前方一致で切り取った「残り」が、**別の語の始まり**かどうかを見る（2026-08-25 便KX）。
 *
 * 日本語の書き分けをそのまま使う: **接尾辞・助詞・並記はひらがなや区切り記号で続き、
 * 新しい名詞は漢字かカタカナで始まる。**
 *   続き（＝前方一致でよい）… みそ**だれ** ／ ねぎ**の**みじん切り ／ みそ**、**水 各
 *   別の語（＝前方一致は誤り）… 塩**麹** ／ 米**粉** ／ さば**節** ／ 酢**豚** ／ ブリ**ットル**
 *
 * 2,235件（同梱109品＋価格マスタ＋成分表の別名＋八訂の全収載食品名の語）と、
 * オーナーの実データ121品の全材料で実測した結果:
 *   この条件で新しく塞げた誤爆 24件（塩麹・米粉・さば節・酢豚・みそ煮 ほか）
 *   この条件で当たらなくなった正しい組 0件
 * 実データの「塩麹 大さじ2 → 塩 1円/小さじ1 で6円」（2品で実発）もここで止まる。
 *
 * かな正規化した索引キーと元の名前は文字数が違う（「塩」1文字＝「しお」2文字）ので、
 * 元の名前を頭から1文字ずつ伸ばして、かな化した形が索引キーと一致する位置を探す。
 * 見つからなければ false（＝従来どおり通す）に倒す。
 */
const NEW_WORD_HEAD = /[\u4e00-\u9fff\u3005\u30a1-\u30fa]/

function restStartsNewWord(normalized: string, matchKey: string): boolean {
  for (let i = 1; i <= normalized.length; i++) {
    if (toHiragana(normalized.slice(0, i)) !== matchKey) continue
    const next = normalized[i]
    return next != null && NEW_WORD_HEAD.test(next)
  }
  return false
}

/**
 * 材料名と食材価格マスタの項目名が「成分表で同じ食品か」を見る（2026-08-22 便JG）。
 *
 * 前方一致（材料名がマスタ名で始まる）は「たまねぎ薄切り→たまねぎ」のような書き足しを
 * 拾うための仕組みだが、**先頭がたまたま一致しただけの別食材**まで拾っていた。
 * オーナーの実データ31品で実測した誤爆:
 *   トマトケチャップ120g → 「トマト 60円/1個」 ／ トマト水煮缶 → 「トマト 60円/1個」
 *   昆布だし → 「昆布 400円/100g」 ／ 塩鮭2切れ → 「塩 1円/小さじ1」
 * どれも値段が桁で違う。両方が成分表の食品に解決できて、それが**別の食品**なら前方一致を
 * 認めない（同じ食品なら今までどおり通す）。
 *
 * どちらかが成分表に無いときは、**この段階では認めない**（2026-08-25 便KX で false に変更）。
 * 以前は true を返して素通りさせていたが、それが「ねぎ味噌→ねぎ」「塩さば→塩」「米粉→米」
 * の入口だった。素通りをやめた代わりに、matchPriceEntry の⑤末尾一致・⑥確認できない前方一致
 * （どちらもこの関数より後ろ）で拾い直すので、**正しく当たっていた材料は落ちない**
 * （同梱109品＋オーナーの実データ121品の全材料で実測。落ちた行は0件）。
 */
function isSameNutritionFood(ingredientName: string, entryName: string): boolean {
  const ingredientFood = matchNutritionFood(ingredientName)
  if (!ingredientFood) return false
  const entryFood = matchNutritionFood(entryName)
  if (!entryFood) return false
  return ingredientFood.id === entryFood.id
}

/**
 * 栄養（成分表）の食品名を経由して食材価格マスタを引き直す（2026-08-22 便JG）。
 *
 * 【なぜ要るか】同じ食材の書き方ちがいを吸収する表が、栄養と原価で別々だった。
 * 栄養側は成分表の食品ごとに別名（「スパゲッティ／スパゲティ／マカロニ」「砂糖／上白糖」
 * 「小麦粉／薄力粉」「長ねぎ／白ねぎ」「酒／料理酒」「えび／むきえび」…）を持っているのに、
 * 原価側は読み仮名辞書＋前方一致しか持たず、同じ材料が栄養では計算できて原価だけ
 * 「価格なし」になっていた（オーナー原文「カルボナーラ・スパゲティが原価なし。
 * ペペロンチーノにはあったのに。表記揺れ？」）。実測ではオーナーの31品で35種が該当した。
 *
 * **当たらなかったときの最後の手当て**なので、これまで当たっていた材料の結果は1件も変わらない。
 * 括弧書きを落としてから成分表を引くのが要点で（「アーモンドプードル(無い方は薄力粉で)」が
 * 括弧の中の語で小麦粉に当たるのを防ぐ）、見つけた食品の label と別名を順に価格マスタへ当てる。
 */
function matchPriceEntryViaNutritionFood(
  name: string,
  index: PriceIndexEntry[],
): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  const food = matchNutritionFood(normalized)
  if (!food) return undefined
  for (const alias of [food.label, ...(food.aliases ?? [])]) {
    const hit = matchPriceEntryExact(alias, index)
    if (hit) return hit
  }
  return undefined
}

function matchPriceEntryExact(
  name: string,
  index: PriceIndexEntry[],
): PriceIndexEntry | undefined {
  const normalized = normalizeIngredientNameForPrice(name)
  if (!normalized) return undefined
  const key = toHiragana(normalized)
  const exact = index.find((e) => e.matchKey === key)
  if (exact) return exact
  return index.find(
    (e) => key.startsWith(e.matchKey) && isSameNutritionFood(normalized, e.normalizedName),
  )
}

/** "200" "1.5" "1/2" のような数字の分量を数値化する（人数換算不要の素の値） */
function parseNumericAmount(amount: string): number | undefined {
  // 範囲分量(「200〜250」)は先頭の値で計算する(2026-07-28 便BX/C06。栄養側と同じ扱い)
  const trimmed = leadingRangeAmount(normalizeAmountInput(amount.trim()))
  const match = trimmed.match(/^(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?$/)
  if (!match) return undefined
  let value = Number.parseFloat(match[1])
  const denominator = match[2] ? Number.parseFloat(match[2]) : undefined
  if (denominator) {
    if (denominator === 0) return undefined
    value /= denominator
  }
  return value
}

/** マスタ行が投入時の目安のままか(default)、ユーザーが上書きした価格か(user)の由来種別 */
export type PriceSource = 'default' | 'user'

/** マスタ由来の1行分の見積もり（金額＋由来種別。2026-07-13 UIペルソナQA: 表示側の「目安」表記の出し分けに使う） */
export interface IngredientPriceEstimate {
  yen: number
  /**
   * 四捨五入する前の按分額（2026-07-28 便BY/COST-02）。
   * 0 < rawYen < 0.5 の材料（例: 砂糖 小さじ1/2 = 0.33円）を「価格なし」ではなく
   * 「1円未満」(ja.detail.costUnderOneYen)へ振り分けるために使う。
   * 合計計算(estimateRecipeCost)は従来どおりyenを使うので、表示金額は1円も変わらない。
   */
  rawYen: number
  source: PriceSource
}

/**
 * 「数量+単位」を、栄養側の目安量(NutritionFood.unitGrams・gramsPerMl)でグラムに換算する。
 * foodは材料名とマスタ名の両方で名寄せを試す(材料名が「鶏むね肉(皮なし)」のような
 * 書き方でも、マスタ名「鶏むね肉」で拾えるようにするため)。
 */
function toGramsForPrice(
  ingredientName: string,
  entryName: string,
  value: number,
  unit: string,
): number | null {
  const food = matchNutritionFood(ingredientName) ?? matchNutritionFood(entryName)
  if (!food) return null
  const direct = convertToGrams(value, unit, food)
  if (direct != null) return direct
  // ここから下は 2026-08-22 便JG で足した最後の手当て。
  // 【直す前に何が起きていたか】マスタが販売単位「1L」で、レシピがグラムで書いてある組
  // （ケチャップ 960円/1L × 「トマトケチャップ 120g」）は、栄養側の換算(convertToGrams)が
  // リットルを知らないため換算できず、**ボトル1本ぶんの960円**が1行に乗っていた。
  // ①単位を基準量(g・ml)へ直してからもう一度換算する
  const normalized = normalizeUnit(value, unit)
  if (normalized == null) return null
  if (normalized.dim === 'mass') return normalized.base
  if (normalized.dim !== 'volume') return null
  // ②1mlあたりの重さを持たない食品は、成分表の目安量「大さじ1=◯g」(=15ml)から作る。
  // 新しい数値を発明せず、アプリが既に持っている目安量とJISの大さじ15ml・小さじ5mlだけで出す
  const gramsPerMl =
    food.gramsPerMl ??
    (food.unitGrams?.['大さじ'] != null
      ? food.unitGrams['大さじ'] / VOLUME_UNIT_FACTORS.大さじ
      : food.unitGrams?.['小さじ'] != null
        ? food.unitGrams['小さじ'] / VOLUME_UNIT_FACTORS.小さじ
        : undefined)
  return gramsPerMl != null ? normalized.base * gramsPerMl : null
}

/** 按分額から戻り値を作る（表示・合計に使う四捨五入後のyenと、丸め前のrawYenの両方を持たせる） */
function prorated(rawYen: number, source: PriceSource): IngredientPriceEstimate {
  return { yen: Math.round(rawYen), rawYen, source }
}

/**
 * 食材価格マスタの登録単位のうち「1回の調理で使う量」で登録されているもの（2026-08-23 便KE）。
 *
 * 【なぜ要るか】2026-08-23の影響範囲テストA（節約したい人の実データ30品）で、
 * 分量・単位が噛み合わなかった材料に**マスタの登録単位ぶんの満額**が乗っていた:
 *   醤油「大匙1」→ 400円（しょうゆ 400円/1L＝1本まるごと）／酒「大匙2」→ 260円
 *   にんにく「少々」→ 60円（1玉）／ねぎ「大1」→ 100円（1本）
 *   逆に 鶏胸肉「1｜枚300g」→ 90円（鶏むね肉 90円/100g の満額＝300gの肉が90円）
 * 厚揚げニラ玉が1食417円、つくねの照り焼きが1食386円になり、しかも
 * 「価格が分からない材料」は0〜1件なので**※印は1つも付かなかった**。
 * 「安全側のフォールバック」のつもりが、マスタの登録単位が大きければ過大・小さければ過小に、
 * 印も出さずに外れる作りだった。
 *
 * 【どう分けるか】マスタの登録単位は2種類ある。
 *  ①1回に使う量（大さじ1・小さじ1・少々・1かけ・1個分・使用分・1杯）
 *    …満額＝1回分なので、量が読めなくてもその金額でよい。現在の最高額は40円
 *    （白練りごま・はちみつ・メープルシロップ 大さじ1／揚げ油 使用分）で、
 *    外れても1行40円までにしか響かない。
 *  ②販売単位（1L・1玉・1本・1袋・100g・1/4個…）
 *    …満額＝買ってきた1つぶんなので、1行に乗せると桁で外れる。
 * ②は金額を出さず「価格が分からない材料」に数える。
 * **数字を出さないほうが正しい**——概算食費は利用者が買い物の判断に使う数字で、
 * 少なく出すのも多く出すのも同じくらい悪く、分からないなら分からないと出すべきだから。
 * 「価格が分からない材料」に数えると※印と「食材と価格を編集する」の案内が出るので、
 * 利用者が自分の相場を入れて解消できる（黙って外れた数字を出すと解消しようがない）。
 *
 * 単位名はPRICE_DEFAULTSに実在するものだけを並べる（新しい単位を発明しない）。
 * 「大匙」「小匙」は「大さじ」「小さじ」の漢字表記（便KE）。
 */
const SINGLE_USE_MASTER_UNITS = new Set([
  '大さじ', '小さじ', '大匙', '小匙', 'おおさじ', 'こさじ',
  '少々', 'かけ', '個分', '使用分', '杯',
  // 2026-08-25 便KX: 「みそ汁の素 18円/1食分」を足したので「食分」も並べる。
  // 名前のとおり1回に使う量そのもの（小袋1つ＝1食分でしか売っていない商品の登録単位）
  '食分',
])

function isSingleUseMasterUnit(baseUnit: string): boolean {
  return SINGLE_USE_MASTER_UNITS.has(normalizeAmountInput((baseUnit ?? '').trim()))
}

/**
 * マスタ一致した材料1行分の金額を見積もる。
 * ingredientの分量・単位がマスタのunitと数量として噛み合えば按分計算し、
 * 最後まで噛み合わなければマスタの金額をそのまま1行分の目安として使う。
 * sourceは一致したマスタ行がisDefaultのままか(user='default')、ユーザーが上書き済みか('user')を表す。
 *
 * 按分の優先順位（1〜2は2026-07-14 単位正規化・オーナー要望「kgが混ざっても平気か不安」への対応。
 * 3〜4は2026-07-28 便BY/COST-01で追加）:
 * 1) normalizeUnitで両者を正規化し、同じ次元（質量↔質量・体積↔体積）なら基準量換算で按分。
 *    個数(count)同士は単位名も一致する時だけ按分する（「1個」と「1本」は換算不可）。
 * 2) どちらか（または両方）がnormalizeUnitで解釈できない単位でも、文字列として完全一致するなら
 *    従来どおり按分する（「1杯」「1合」「1箱」等、mass/volume/countの対応表に無い単位の後方互換。
 *    既存の"完全一致で按分"の挙動を正規化に置き換えるのではなく包含するため）。
 * 3) 次元も単位名も食い違うときは、両者を栄養側の目安量でグラムに寄せて質量比で按分する
 *    （「鶏むね肉 1枚」とマスタ「100g」のように、個数と重さで書かれていて比べられなかった組。
 *    従来はここでマスタ金額の満額＝100g分の90円が1枚に乗り、実勢の1/2〜1/5という過小計上に
 *    なっていた。栄養側は同じ材料を250gとして計算しており、同じ画面の2つの数字が
 *    食い違う原因でもあった）。
 * 4) 分量が数値で書かれていない（「適量」「少々」）材料は、1回の調理で使う量
 *    （amountAssumption.tsのtypicalAmountFor）を持っていればその量で按分する
 *    （登録単位が販売単位のサラダ油・ごま油・オリーブオイルで、「適量」1行にボトル1本分の
 *    金額が乗るのを止める）。
 * 5) それでも量が噛み合わないときは、**マスタの登録単位が「1回に使う量」のときだけ**
 *    その金額をそのまま1行分として使う（isSingleUseMasterUnit）。登録単位が販売単位
 *    （1L・1玉・1本・100g…）なら金額を出さず undefined を返す＝「価格が分からない材料」に数える。
 *    2026-08-23 便KE。詳しい理由は isSingleUseMasterUnit のコメント。
 */
export function estimateIngredientYen(
  ingredient: Pick<Ingredient, 'name' | 'amount' | 'unit'>,
  index: PriceIndexEntry[],
): IngredientPriceEstimate | undefined {
  const entry = matchPriceEntry(ingredient.name, index)
  if (!entry) return undefined
  const { qty: baseQty, baseUnit } = parseUnitQuantity(entry.unit)
  // 「大2」「小1/2」(大さじ/小さじの略記)・「ひとかけ」等の和語の個数詞(単位欄が空の時のみ該当)は、
  // resolveCalcAmountが展開した単位(大さじ/小さじ/かけ 等)をingUnitとして使う(2026-07-21分量表記拡充)。
  // 該当しなければingredient.unitをNFKC正規化したもの(2026-07-21全角対応: 下のingUnit===baseUnitの
  // 完全一致フォールバックはbaseUnit(parseUnitQuantityで正規化済み)と比較するため、ingUnit側も
  // 同じ正規化形にしておく必要がある)
  const resolved = resolveCalcAmount(ingredient.amount ?? '', ingredient.unit)
  // 単位欄は normalizeUnitText で下ごしらえする(NFKC＋末尾の範囲の印「〜」落とし。2026-08-23 便KE)
  const ingUnit = resolved ? resolved.unit : normalizeUnitText(ingredient.unit ?? '')
  const amountNum = resolved ? resolved.value : parseNumericAmount(ingredient.amount ?? '')
  const source: PriceSource = entry.isDefault ? 'default' : 'user'
  const masterNorm = baseUnit ? normalizeUnit(baseQty, baseUnit) : null

  if (amountNum != null && amountNum > 0 && ingUnit && baseUnit) {
    const recipeNorm = normalizeUnit(amountNum, ingUnit)
    if (recipeNorm != null && masterNorm != null && recipeNorm.dim === masterNorm.dim) {
      if (recipeNorm.dim === 'count') {
        if (masterNorm.dim === 'count' && recipeNorm.unit === masterNorm.unit) {
          return prorated(entry.pricePerUnit * (recipeNorm.base / masterNorm.base), source)
        }
        // 個数系だが単位名が違う（例:「1個」vs「1本」）→ グラム換算の按分へ
      } else {
        return prorated(entry.pricePerUnit * (recipeNorm.base / masterNorm.base), source)
      }
    } else if (ingUnit === baseUnit) {
      return prorated(entry.pricePerUnit * (amountNum / baseQty), source)
    }
    // 3) グラム換算での按分
    const recipeGrams = toGramsForPrice(ingredient.name, entry.normalizedName, amountNum, ingUnit)
    const masterGrams = toGramsForPrice(ingredient.name, entry.normalizedName, baseQty, baseUnit)
    if (recipeGrams != null && masterGrams != null && masterGrams > 0) {
      return prorated(entry.pricePerUnit * (recipeGrams / masterGrams), source)
    }
  } else if (baseUnit) {
    // 4) 「適量」「少々」を1回の使用量で按分
    const typical = typicalAmountFor(entry.normalizedName)
    if (typical) {
      const { qty: typQty, baseUnit: typUnit } = parseUnitQuantity(typical)
      const typNorm = normalizeUnit(typQty, typUnit)
      if (
        typNorm != null &&
        masterNorm != null &&
        typNorm.dim === masterNorm.dim &&
        (typNorm.dim !== 'count' ||
          (masterNorm.dim === 'count' && typNorm.unit === masterNorm.unit))
      ) {
        return prorated(entry.pricePerUnit * (typNorm.base / masterNorm.base), source)
      }
      const typGrams = toGramsForPrice(ingredient.name, entry.normalizedName, typQty, typUnit)
      const masterGrams = toGramsForPrice(ingredient.name, entry.normalizedName, baseQty, baseUnit)
      if (typGrams != null && masterGrams != null && masterGrams > 0) {
        return prorated(entry.pricePerUnit * (typGrams / masterGrams), source)
      }
    }
  }
  // 5) 量が噛み合わなかったときの最後の受け皿。
  // 登録単位が「1回に使う量」なら、その金額＝1回分なのでそのまま使う。
  // 販売単位（1L・1玉・1本・100g…）なら金額を出さない＝「価格が分からない材料」に数える
  if (isSingleUseMasterUnit(baseUnit)) {
    return { yen: entry.pricePerUnit, rawYen: entry.pricePerUnit, source }
  }
  return undefined
}

/** レシピ1品分の概算食費（材料ごとの内訳を集計した結果） */
export interface RecipeCostEstimate {
  /** 円換算の合計（レシピ登録時の基準人数分） */
  total: number
  /** マスタ価格で補完した材料の件数（0件なら注記は不要） */
  fromMasterCount: number
  /** 価格情報（個別入力・マスタ一致のどちらか）が1件でもあるか */
  hasAnyPriceInfo: boolean
}

/**
 * 材料一覧から概算食費を計算する。優先度: 個別入力(price) > マスタ一致 > なし。
 * RecipeDetailPage（1レシピの概算食費）・MealPlanPage（週の概算食費の合算）の両方から使う。
 */
export function estimateRecipeCost(
  ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[],
  index: PriceIndexEntry[],
): RecipeCostEstimate {
  let total = 0
  let fromMasterCount = 0
  let hasAnyPriceInfo = false
  for (const ing of ingredients) {
    if (ing.price != null && ing.price > 0) {
      total += ing.price
      hasAnyPriceInfo = true
      continue
    }
    const estimated = estimateIngredientYen(ing, index)
    if (estimated != null && estimated.yen > 0) {
      total += estimated.yen
      fromMasterCount++
      hasAnyPriceInfo = true
    }
  }
  return { total, fromMasterCount, hasAnyPriceInfo }
}

/**
 * 材料1行分の「1食あたりの按分原価」(2026-07-20 便AJ「原価ビュー」再改修・docs/45)。
 * 「原価を見る」ON時、材料行の計量表記の位置に表示する値の計算本体。
 * 優先度はestimateRecipeCostと同じ(個別入力(ing.price) > マスタ一致 > なし)。
 * 全量(登録時のamount・レシピ登録人数=servings分)の金額をservingsで割った値
 * (=1食あたりの按分原価)を返す。servingsで割ってからさらに表示側の人数変更(servingsOverride)
 * には追従させない設計のため、呼び出し側は必ずrecipe.servings(登録人数)を渡すこと
 * (仕様書「2食分などの変動値は出さない」)。
 * 価格情報が無い(マスタ不一致かつ個別入力も無い)材料はundefinedを返す
 * (estimateRecipeCostの合計計算から除外される材料と同じ扱い)。
 *
 * 2026-07-28 便BY/COST-02: 「マスタに価格が無い(=価格なし)」と「価格はあるが按分額が1円未満」を
 * 区別できるようにした。従来は estimated.yen <= 0 でどちらもundefinedにしていたため、
 * マスタに登録済みの砂糖(小さじ1/2 = 0.33円)や塩(小さじ1/4 = 0.25円)まで「価格なし」と表示され、
 * 「登録し忘れている」という誤ったシグナルになっていた(同梱103品で14行)。
 * docs/45のオーナー指示「四捨五入・1円未満は『1円未満』」に用意されていた表示が、
 * この経路では一度も出ていなかったのを実際に到達させる修正。
 */
export interface IngredientRowCostEstimate {
  /** 全量(登録量)の金額。個別入力ならその値、マスタ一致ならestimateIngredientYenの結果 */
  totalYen: number
  /** totalYen ÷ servings を四捨五入した1食あたりの按分原価。0(=1円未満)なら
   *  呼び出し側は金額の代わりに「1円未満」を表示する想定(仕様書「四捨五入・1円未満は「1円未満」」) */
  perServingYen: number
  /**
   * いま画面に出ている分量ぶんの金額（2026-08-22 便JG）。
   * 全量 × 表示人数 ÷ 登録人数。表示人数を指定しなければ登録人数と同じ＝全量ぶん。
   * 0(=1円未満)なら呼び出し側は「1円未満」を表示する。
   */
  shownYen: number
}

/**
 * 2026-08-22 便JG（オーナー原文「原価が、人数分の表示に合わせて計算されていない。
 * 人数の増減で数値が変わらない。何人分を表示しているの？」「シフォンケーキ・卵が半量で６円」）。
 *
 * 【直す前に何が起きていたか（実測）】レシピ詳細の材料の行は、
 *  ・分量  … 表示中の人数分にスケールした量（scaleAmount）
 *  ・原価  … 全量 ÷ **登録人数** で固定（表示人数に追随しない）
 * という別々の基準で並んでいた。登録17人分のシフォンケーキを2人分で表示すると
 * 「卵 1/2個」の行に「約6円」（100円÷17人分）が出る＝半分の卵の値段（約12円）と合わない。
 * 人数を増減しても金額だけ動かないのはこのため。
 *
 * そこで shownYen（画面に出ている分量ぶんの金額）を足し、画面はこちらを出す。
 * 分量と金額が同じ人数分を指すので「その量でいくらか」がそのまま読める。
 * perServingYen（1食あたり＝登録人数で割った値）は従来どおり返すので、
 * これを使っている計算・表示は1円も変わらない。
 */
export function estimateIngredientRowCost(
  ingredient: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>,
  index: PriceIndexEntry[],
  servings: number,
  shownServings?: number,
): IngredientRowCostEstimate | undefined {
  let rawTotal: number
  if (ingredient.price != null && ingredient.price > 0) {
    rawTotal = ingredient.price
  } else {
    const estimated = estimateIngredientYen(ingredient, index)
    // マスタ不一致(=本当に価格情報が無い)ときだけundefined。
    // 按分額が1円未満へ丸まる材料は perServingYen=0 で返し、呼び出し側に「1円未満」を出させる
    if (estimated == null || estimated.rawYen <= 0) return undefined
    rawTotal = estimated.rawYen
  }
  // 丸め前のrawTotalから直接割る(yenを丸めてからservingsで割る二重丸めを避ける)
  const totalYen = Math.round(rawTotal)
  const registered = servings > 0 ? servings : 1
  const shown = shownServings != null && shownServings > 0 ? shownServings : registered
  const perServingYen = Math.round(servings > 0 ? rawTotal / servings : rawTotal)
  const shownYen = Math.round((rawTotal * shown) / registered)
  return { totalYen, perServingYen, shownYen }
}

/**
 * 概算食費の「どれくらい当てになるか」（2026-08-22 便JG）。
 *
 * オーナー原文「写真下の原価表示は、『価格なし』が複数（１つだったとしても金額によっては
 * 大きいが）ある場合には、目安とはいえ実際と大きく異なることを記号でお知らせして欲しい」
 * 「ティラミスとか、１食４円なわけない。チーズがたくさん」。
 *
 * 価格が分からない材料は合計に1円も入っていないので、その品の金額は必ず実際より安く出る。
 *
 * 【2026-08-25 便KS・⑤でオーナー指示により条件を変えた】
 * オーナー原文「価格なし材料が１つでもあるのに※表記がない（２つ以上だと※がつくのに）と、
 * 何を基準に表記しているのかユーザーとしては不安になります。やはり１つでも価格なしに
 * なったら表記しましょう」。
 *  旧: 2件以上 または（1件でもそれが主材料）→ 知らせる
 *  新: **1件でも** 知らせる
 * 旧条件は「主材料かどうか」を機械が判定していたため、画面からは何を基準に印が出ているのかが
 * 読めなかった（同じ「価格が分からない材料1件」でも、材料の書き方次第で印が出たり出なかったり
 * する）。数えた件数はそのまま注記に出るので、条件を件数だけにすると印と注記が一致する。
 * 同梱109品は全材料に価格があるので、この変更でも1品も印は出ない（scripts/test-logic.mjs JG-6）。
 *
 * hasPricelessMainIngredient は判定には使わなくなったが、返す値としては残す
 * （どの品で主材料の価格が抜けているかを測るのに使える。表示には出していない）。
 * 水・湯・氷は価格を付ける対象ではないので数えない（pricelessIngredientNamesOfRecipes と同じ）。
 */
export interface RecipeCostConfidence {
  /** 価格が分からない材料の件数（同じ名前は1件） */
  pricelessCount: number
  /** そのうち主材料が1件でもあるか */
  hasPricelessMainIngredient: boolean
  /** 金額が実際と大きく違うおそれを知らせるか */
  shouldWarn: boolean
}

export function recipeCostConfidence(
  ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[],
  index: PriceIndexEntry[],
): RecipeCostConfidence {
  const pricelessNames = new Set(
    pricelessIngredientNamesOfRecipes([{ ingredients }], index),
  )
  const mainNames = new Set(
    pickMainIngredients(
      ingredients.map((ing) => ({
        name: ing.name,
        amount: ing.amount ?? '',
        unit: ing.unit ?? '',
      })),
      Number.MAX_SAFE_INTEGER,
    ).map((ing) => ing.name),
  )
  let hasPricelessMainIngredient = false
  for (const name of pricelessNames) {
    if (mainNames.has(name)) hasPricelessMainIngredient = true
  }
  const pricelessCount = pricelessNames.size
  return {
    pricelessCount,
    hasPricelessMainIngredient,
    // 2026-08-25 便KS・⑤（オーナー指示で条件を変えた）: 1件でも知らせる
    shouldWarn: pricelessCount >= 1,
  }
}

/** 献立エントリ群(mealPlans)の概算食費の合計・内訳 */
export interface MealPlanCostSum {
  /**
   * 円換算の合計（作る食数ぶん＝実効食数で数えた金額）。
   * 2026-08-03 便DK以前は「レシピ登録時の基準人数分」固定だった。枠ごとの食数も
   * 設定「ふだん作る人数」も無いときは実効食数＝登録人数分なので、その場合の値は従来と同じ。
   */
  total: number
  /** マスタ価格で補完した材料の件数の合計 */
  fromMasterCount: number
  /** 合計に数えた実効食数の総和（人分・2026-08-03 便DK。「作る食数ぶん」の内訳表示に使う） */
  servingsTotal: number
  /**
   * 1人分の合計（円・2026-07-28 便CA）。料理1品につき「合計÷登録人数」を1回だけ足した金額。
   * 「1人が期間内に食べた分の食費」を出すために使う（栄養の sumPersonalNutrition と同じ数え方）。
   * レシピの登録人数が分からない・不正(0以下)なら1人分として扱う。
   */
  personalTotal: number
  /** 合計に入れた品数（料理1品＝1。人数では数えない・2026-07-28 便CA） */
  dishCount: number
}

/**
 * 献立エントリ群(mealPlans)の概算食費合計。エントリのrecipeIdから該当レシピを引き、
 * estimateRecipeCost(レシピ登録時の基準人数分)を合算する。週の概算食費(MealPlanPageの
 * weekCostEstimate)と期間の食費(2026-07-17 便AB・docs/35 §5「期間の食費」のrangeCostEstimate)が
 * 共通で使う集計ロジック。recipeが見つからないエントリ(削除済みレシピ等を指す孤児行)はスキップする。
 *
 * 2026-07-28 便CA: 「1人が期間内に食べた分の食費」を出すため personalTotal（合計÷登録人数を
 * 品ごとに1回足した金額）と dishCount も返す。personalTotalは丸め誤差を溜めないよう最後に一度だけ
 * 四捨五入する。
 *
 * 2026-08-03 便DK（オーナー確定「3人家族なら予算や買い物メモは3人分で計算した数値が必要」）:
 * total を「作る食数ぶん」にした＝1人分の単価に実効食数（枠ごとの食数 > 設定「ふだん作る人数」 >
 * レシピの登録人数分）を掛けて足す。枠ごとの食数も「ふだん作る人数」も無いときは実効食数が
 * 登録人数分そのものなので、従来と1円も変わらない（後方互換）。
 * personalTotal（1人分）は栄養と対になる数字なのでここでも変えない。
 */
export function sumMealPlanEntriesCost<E extends { recipeId: number; servings?: number }>(
  entries: E[],
  recipeById: Map<
    number,
    { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[]; servings?: number }
  >,
  index: PriceIndexEntry[],
  householdServings?: number,
): MealPlanCostSum {
  let totalRaw = 0
  let fromMasterCount = 0
  let personalRaw = 0
  let dishCount = 0
  let servingsTotal = 0
  for (const e of entries) {
    const recipe = recipeById.get(e.recipeId)
    if (!recipe) continue
    const estimate = estimateRecipeCost(recipe.ingredients, index)
    const registered = recipe.servings != null && recipe.servings > 0 ? recipe.servings : 1
    const servings = effectiveMealServings(e.servings, householdServings, recipe.servings)
    const perServing = estimate.total / registered
    totalRaw += perServing * servings
    fromMasterCount += estimate.fromMasterCount
    personalRaw += perServing
    dishCount++
    servingsTotal += servings
  }
  return {
    total: Math.round(totalRaw),
    fromMasterCount,
    servingsTotal,
    personalTotal: Math.round(personalRaw),
    dishCount,
  }
}

/**
 * 献立エントリ群のうち「価格が分からない材料」の名前を重複なしで返す（2026-07-29 便CD/MP-11）。
 * 個別入力(ing.price)もマスタ一致もない材料＝概算食費の合計に1円も入っていない材料。
 * 「概算食費は実質使えない」（金額の信頼度が伝わらない）という指摘への対応で、
 * 画面に「価格が分からない材料◯種類を除いた概算です」と正直に添えるために使う。
 * 同じ材料名は何品に出てきても1件として数える（ユーザーが登録すべき件数と一致させるため）。
 */
export function pricelessIngredientNames<E extends { recipeId: number }>(
  entries: E[],
  recipeById: Map<
    number,
    { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[]; servings?: number }
  >,
  index: PriceIndexEntry[],
): string[] {
  const recipes: { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[] }[] = []
  for (const e of entries) {
    const recipe = recipeById.get(e.recipeId)
    if (recipe) recipes.push(recipe)
  }
  return pricelessIngredientNamesOfRecipes(recipes, index)
}

/**
 * 「お好みで」と書かれた材料か（2026-08-23 便KE）。
 * amountAssumption.ts の matchAssumedGrams と同じ判定（材料名・分量のどちらかに「お好みで」）。
 */
function isOptionalIngredient(name: string, amount?: string): boolean {
  return /お好みで/.test(name) || /お好みで/.test(amount ?? '')
}

/**
 * レシピの配列そのものから「価格が分からない材料」の名前を返す（2026-07-30 便CH/C2）。
 * 月間サマリー・期間の集計は献立エントリではなく「作った記録＋登録した献立のレシピ」を数えるため、
 * recipeId を持たないこちらの形が要る（pricelessIngredientNames は同じ判定をこの関数に委ねる）。
 *
 * 判定は「個別入力(ing.price)もマスタ一致も無い」＝概算に1円も入っていない材料だけ。
 * 丸め前の rawYen で見るのが要点で、四捨五入後の yen で判定すると、マスタに載っていて
 * 小口按分で0円に丸まる材料（塩 小さじ1=約1円・砂糖 大さじ1=約2円の一部）まで
 * 「価格が分からない」に数えてしまい、注記が実態より多い件数を出していた。
 *
 * 2026-07-30 便CK/③-1: 水・湯・氷（isZeroIngredient）は数えない。栄養側は同じ材料を
 * 「計算上ゼロ扱い・対象外件数にも数えない」と決めており（nutrition.ts）、この関数だけ
 * 適用漏れだった。同梱109品のうち22品で「価格が分からない材料1種類を除いた概算です」＋
 * 「食材と価格を編集する」が常時出ていたが、水の価格は登録できない（PriceEditModalは
 * price>0必須）ためユーザーには解消できず、1円で登録すれば22品の原価が水の分だけ狂う——
 * どちらにも進めない案内になっていた。
 */
export function pricelessIngredientNamesOfRecipes(
  recipes: { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[] }[],
  index: PriceIndexEntry[],
): string[] {
  const names = new Set<string>()
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (ing.price != null && ing.price > 0) continue
      // 水・ぬるま湯・お湯・湯・熱湯・氷は価格を付ける対象ではない（便CK/③-1）
      if (isZeroIngredient(ing.name)) continue
      // 「お好みで」と書かれた材料は数えない（2026-08-23 便KE）。
      // 使うかどうかがそもそも決まっていない添え物なので、これを「価格が分からない材料」に
      // 数えると、印と「食材と価格を編集する」の案内が出ても利用者に直しようがない。
      // 栄養側は同じ理由で「お好みで」を仮の量の対象外にしている（amountAssumption.ts
      // matchAssumedGrams の「お好みで表記は食べるか不明なため対象外」）。判定もそこと同じ形にする
      if (isOptionalIngredient(ing.name, ing.amount)) continue
      const estimated = estimateIngredientYen(ing, index)
      if (estimated != null && estimated.rawYen > 0) continue
      names.add(ing.name)
    }
  }
  return Array.from(names)
}

/** 「作った記録」群の実績原価合計と食数（1人1食＝1食）。2026-07-24 便BH-3・タスク9 */
export interface CookedLogsCostSum {
  /** 実績原価の合計（記録した人数分にスケールした金額を合算する＝家族全員分） */
  total: number
  /** 食数（=延べ人数。2人分作った記録は2食と数える） */
  count: number
  /**
   * 1人分の合計（円・2026-07-28 便CA）。料理1品につき「全量÷登録人数」を1回だけ足した金額。
   * 何人分作ったかに関係なく「1人が食べた分」を数えるので、記録時の人数ではスケールしない。
   */
  personalTotal: number
  /** 品数（作った記録1件＝1品。人数では数えない・2026-07-28 便CA） */
  dishCount: number
}

/**
 * 「作った記録」（cookedLogs）群の実績ベースの概算食費合計と食数を出す（2026-07-24 便BH-3・タスク9・
 * 期間の食費の「実績ベース」表示用）。渡す配列は「記録1件につきそのレシピ1件」（同じレシピを2回
 * 作った記録があれば同じレシピが2件並ぶ）を想定する。
 *
 * 2026-07-28 便BY/RANGE-01: 「1食あたり」の分母を記録件数から延べ人数（1人1食）へ直した。
 * 従来は2人分のレシピ全量を「1食」として数えており、同じカードに並ぶ「摂取できた栄養（1食あたり）」が
 * 1人分基準なのに対し、食費だけ人数分まとめた額が「1食あたり」として出ていた
 * （2人分レシピ3品で 約4,951円・1食あたり約1,650円＝正しくは約825円）。
 * うちレシピの「1食あたり」は2026-07-06のオーナー裁定で1人分に確定しており（docs/12）、
 * レシピ詳細の原価も 合計÷recipe.servings で1人分を出している。ここだけ基準が違っていた。
 * docs/35 §段階2 の「作った記録×保存人数で按分」という仕様どおりの実装でもある。
 *
 * 金額は記録時の人数(log.servings)に合わせてスケールする。
 * 記録時の人数が無い古い記録（2026-07-12以前）はレシピの登録人数で代替する。
 *
 * 2026-07-28 便CA: 「1人が期間内に食べた分の食費」を出す personalTotal と、その品数 dishCount を
 * 追加した。personalTotalは何人分作ったかに関係なく「全量÷登録人数」を1品につき1回だけ足す
 * （栄養の sumPersonalNutrition と同じ数え方）。従来の total/count（全体の金額と延べ人数の食数）は
 * オーナー指示で残す＝「作った食数の合算(全体食費)」として引き続き表示する。
 */
export function sumCookedRecipesCost(
  logsWithRecipe: {
    recipe: { ingredients: Pick<Ingredient, 'name' | 'amount' | 'unit' | 'price'>[]; servings: number }
    log?: { servings?: number }
  }[],
  index: PriceIndexEntry[],
): CookedLogsCostSum {
  let total = 0
  let count = 0
  let personalRaw = 0
  let dishCount = 0
  for (const { recipe, log } of logsWithRecipe) {
    const registered = recipe.servings > 0 ? recipe.servings : 1
    const cooked = log?.servings != null && log.servings > 0 ? log.servings : registered
    const whole = estimateRecipeCost(recipe.ingredients, index).total
    total += whole * (cooked / registered)
    count += cooked
    personalRaw += whole / registered
    dishCount++
  }
  return {
    total: Math.round(total),
    count,
    personalTotal: Math.round(personalRaw),
    dishCount,
  }
}
