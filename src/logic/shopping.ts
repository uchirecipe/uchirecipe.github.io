import { toHiragana } from './kana'
import { isSeasoningLike } from './mainIngredients'
import {
  formatAmountUnit,
  formatScaledAmount,
  normalizeAmountInput,
  parseAmountNumber,
  resolveCalcAmount,
} from './amount'
import { categorizePantryName, SHOPPING_AISLE_ORDER } from './pantryGroups'
import type { Ingredient } from '../db/types'

/**
 * 買い物メモを一般的なスーパーの売り場順に自動整列する（2026-07-24 実機FB #11）。
 * 食材名から在庫グループを判定し（pantryGroups の分類を流用）、SHOPPING_AISLE_ORDER の
 * 順に並べる。同じグループ内は元の並び（＝既存の追加順）を保つ安定ソート。
 * 表示専用で、DBの保存順（order）は書き換えない。
 */
export function sortShoppingByAisle<T extends { name: string }>(items: T[]): T[] {
  const rank = new Map(SHOPPING_AISLE_ORDER.map((key, index) => [key, index]))
  return items
    .map((item, index) => ({ item, index, group: categorizePantryName(item.name) }))
    .sort((a, b) => (rank.get(a.group)! - rank.get(b.group)!) || a.index - b.index)
    .map((entry) => entry.item)
}

export interface ShoppingCandidate {
  name: string
  /** 表示用にまとめた分量。単位が揃えば合計し、揃わなければ「・」で列挙する */
  amount: string
  recipeIds: number[]
  /**
   * 全レシピでの使われ方が調味料的（大さじ/小さじ/単位なし/少々等）、
   * または水道から出るもの（水・お湯・湯）なら true。
   * true の候補は買い物候補でデフォルト未チェックになる
   */
  isSeasoningLike: boolean
}

/**
 * 買うものではないのに分量が数値（600ml等）のせいで主材料扱いされてしまう食材。
 * 調味料と同じくデフォルト未チェックにする（2026-07-09ペルソナ第2波: 「水」がチェック済みで入る）
 */
const TAP_WATER_NAMES = new Set(['水', 'お湯', '湯'].map(toHiragana))

/** 買い物候補づくりの内部で扱う、1材料分の分量パーツ（scale=食数スケール、既定1） */
interface AmountPart {
  amount: string
  unit: string
  /** そのレシピの「指定食数 ÷ 登録人数」。数値化できる分量にだけ掛ける（2026-07-23 #3） */
  scale: number
}

/** 合算のために解釈し直した1パーツ（2026-07-29 便CC/C1・C11・C12） */
interface ResolvedPart {
  /** 数値化できないときや等倍1件のときに、そのまま見せる表示文字列 */
  original: string
  /** 合算のまとまりを決める単位（「大2」等の略記は「大さじ」に解決した後の単位） */
  unit: string
  /** 数値化できた分量。できなければ null（「少々」「200〜250」等） */
  value: number | null
  scale: number
}

/**
 * 1パーツを合算用に解釈する。
 * 「大2」「小1/2」のような略記と「ひとかけ」のような和語の個数詞は、レシピ詳細の人数変更
 * （scaleAmount）と同じ resolveCalcAmount で正式な単位に解決してから合算対象にする
 * （2026-07-29 便CC/C12。従来はここを通さないため単位なしのまま扱われ、食数スケールが
 * 掛からず「大2」のまま出ていた）。
 */
function resolvePart(part: AmountPart): ResolvedPart {
  const original = formatAmountUnit(normalizeAmountInput(part.amount.trim()), part.unit)
  const calc = resolveCalcAmount(part.amount, part.unit)
  if (calc) return { original, unit: calc.unit, value: calc.value, scale: part.scale }
  return { original, unit: part.unit.trim(), value: parseAmountNumber(part.amount), scale: part.scale }
}

/**
 * 単位ごとにグループ化し、数値化できるものはグループ内で合計する
 * （例:「大さじ2」+「大さじ3」+「小さじ1」→「大さじ5・小さじ1」）。
 * 数値化できないもの（「少々」等）はそのまま列挙する。
 * 各パーツの scale（指定食数スケール）は数値化できる分量にのみ掛ける。
 *
 * 2026-07-29 便CC で3点修正（診断 C1・C11・C12）:
 * - 分量の数値化を amount.ts の parseAmountNumber に寄せた。従来の `Number.parseFloat` は
 *   分母を読めず `parseFloat('1/2')=1` となり、分数表記の材料が必要量の2〜4倍で出ていた（S1）。
 * - 丸めを formatScaledAmount（単位ごとの丸め幅）に寄せた。従来の小数第1位丸めでは
 *   「62.5g」「0.3箱」のような店頭で行動に移せない粒度が出ていた（C11）。
 * - 同じ単位に数値化できない分量が1つでも混ざるとグループ全体が原文列挙になり、数値側の
 *   食数スケールまで落ちていたのを、数値側と原文側を分けて両方出すようにした（C12）。
 */
function combineAmounts(parts: AmountPart[]): string {
  const nonEmpty = parts.filter((p) => p.amount.trim() || p.unit.trim())
  if (nonEmpty.length === 0) return ''

  const groups = new Map<string, ResolvedPart[]>()
  for (const part of nonEmpty) {
    const resolved = resolvePart(part)
    const list = groups.get(resolved.unit)
    if (list) list.push(resolved)
    else groups.set(resolved.unit, [resolved])
  }

  const texts: string[] = []
  for (const [unit, items] of groups) {
    const numeric = items.filter((p) => p.value != null)
    const raw = items.filter((p) => p.value == null)
    if (numeric.length === 1 && numeric[0].scale === 1) {
      // 等倍（指定食数＝レシピの登録人数）で1レシピ分だけなら、計算する必要がないので原文を
      // そのまま見せる。「1/3本」を丸めて「1/2本」にしてしまわず、レシピ詳細の表示と一致する
      texts.push(numeric[0].original)
    } else if (numeric.length > 0) {
      const total = numeric.reduce((sum, p) => sum + p.value! * p.scale, 0)
      texts.push(formatAmountUnit(formatScaledAmount(total, unit), unit))
    }
    // 「少々」など数値化できない分量は食数スケールを掛けられないので原文のまま併記する
    texts.push(...raw.map((p) => p.original))
  }
  return texts.join('・')
}

/**
 * 選んだレシピの材料を名前でまとめ、在庫「ある」の食材を除いた買い物候補を作る。
 * ここで作った候補はまだ買い物メモではなく、確認してから確定してもらう「下書き」。
 *
 * 各レシピは任意で scale（指定食数スケール。2026-07-23 #3「食数の+/-」方式で
 * targetServings ÷ recipe.servings を渡す）を持てる。未指定は1（＝1回分そのまま）。
 */
export function buildShoppingCandidates(
  recipes: { id: number; ingredients: Ingredient[]; scale?: number }[],
  pantryHaveNames: string[],
): ShoppingCandidate[] {
  const haveKeys = new Set(pantryHaveNames.map(toHiragana))
  const order: string[] = []
  const map = new Map<
    string,
    { name: string; parts: AmountPart[]; recipeIds: number[] }
  >()

  for (const recipe of recipes) {
    const scale = recipe.scale && recipe.scale > 0 ? recipe.scale : 1
    for (const ing of recipe.ingredients) {
      const trimmedName = ing.name.trim()
      if (!trimmedName) continue
      const key = toHiragana(trimmedName)
      if (haveKeys.has(key)) continue // 在庫「ある」は候補に出さない

      let entry = map.get(key)
      if (!entry) {
        entry = { name: trimmedName, parts: [], recipeIds: [] }
        map.set(key, entry)
        order.push(key)
      }
      entry.parts.push({ amount: ing.amount, unit: ing.unit, scale })
      if (!entry.recipeIds.includes(recipe.id)) entry.recipeIds.push(recipe.id)
    }
  }

  return order.map((key) => {
    const entry = map.get(key)!
    return {
      name: entry.name,
      amount: combineAmounts(entry.parts),
      recipeIds: entry.recipeIds,
      isSeasoningLike: TAP_WATER_NAMES.has(key) || entry.parts.every(isSeasoningLike),
    }
  })
}
