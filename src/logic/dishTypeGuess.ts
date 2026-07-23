import { pickIconKey } from './icon'
import type { DishType, Ingredient } from '../db/types'

/**
 * 料理の役割（dishType）の自動判定（2026-07-23 献立エンジン再設計・便BH-1／docs/56 §3-2）。
 * 既存のアイコン自動判定（logic/icon.ts の pickIconKey）の結果を役割へ写像するだけの薄い関数。
 * pickIconKey は「たんぱく源（魚・卵・豆腐・鶏・肉）を野菜の調理法語より先に取る」14段
 * ヒューリスティックが完成しているため、それを流用すると同梱103品でおおむね現行 dishType と
 * 一致する（docs/56 §2 の実証: 71品で63一致・残り8品＝人間でも割れる「要裁定」品）。
 *
 * これは **新規レシピ登録・URL/テキスト取り込み時の初期値提案** に使う（ユーザーはフォームの
 * 選択チップでいつでも直せる）。**既存レシピの dishType は書き換えない**（未設定のレシピだけが
 * 献立エンジン側でこの手の推定にフォールバックする）。同梱レシピの dishType は手作業で確定済み
 * （db/starters.ts・src/sets/*.ts）なので、この関数の推定はそちらを上書きしない。
 *
 * 既知の限界（初期値提案なので実害は小さい・ユーザー修正で吸収）:
 * - だし巻き卵・味玉などの「卵の小鉢」は egg → 'main' に寄る（実運用は副菜）
 * - 卯の花・高野豆腐の含め煮などの「豆腐の脇役使い」は tofu → 'main' に寄る（実運用は副菜）
 * - 鮭フレーク・冷や汁などの魚/汁の変則品も見た目重視で寄る
 * これらは同梱データ側でオーナー裁定どおりの値を手当てしてある（docs/56 §2-3）。
 */
export function guessDishType(input: {
  title: string
  tags: readonly string[]
  ingredients: readonly Pick<Ingredient, 'name'>[]
}): DishType {
  const icon = pickIconKey(input)
  switch (icon) {
    case 'soup':
      return 'soup'
    case 'salad':
    case 'vegetable':
      return 'side'
    case 'dessert':
    case 'drink':
    case 'bread':
      // dessert は UI 上「その他（おやつ・ご飯のお供など）」の役割枠。献立エンジンでは
      // 主菜・副菜どちらのプールにも入らない（logic/mealPlan.ts）。
      return 'dessert'
    case 'fish':
    case 'egg':
    case 'tofu':
    case 'chicken':
    case 'meat':
    case 'rice':
    case 'pasta':
    case 'noodle':
      return 'main'
    default:
      // default（どのアイコンにも当たらない）は主菜を初期値にする。副菜の取りこぼしより、
      // 主菜枠が埋まらない体験の方を避ける（docs/56 §3-2）。
      return 'main'
  }
}
