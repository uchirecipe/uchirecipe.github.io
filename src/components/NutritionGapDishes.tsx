import { Link } from 'react-router-dom'
import {
  gapDishList,
  type NutritionGapKind,
  type PersonalNutritionSum,
} from '../logic/nutrition'

/**
 * 栄養を計算しきれなかった料理の名前（2026-08-23 便JP・②）。
 *
 * オーナー原文:
 *   「計算できない料理が表示されるようになりましたが、どれが計算できなかったのかわかりません。
 *     折りたたみ開いたらレシピ名（カードでなく文字だけ。そのままリンクになっている）出して欲しいです。」
 *
 * 決めごと:
 *  ・**カードにしない**（オーナーが名指し）。写真も枠も出さず、料理名そのものをリンクにする
 *  ・件数を言う1行のすぐ下に置く＝見出しは付けない（何の一覧かは上の1行が言い切っている）
 *  ・**理由ごとに分ける**（1品も計算できない品／量が書いてあるのに落ちた材料がある品）。
 *    どちらも「計算できない」だが、合計に入っているかどうかが違う
 *  ・同じ料理が何日も出ても名前は1回だけ（重複は gapDishList が畳む。件数のほうは延べのまま）
 *  ・押せる高さは他のボタンと同じ44px（--tap-min）を下回らない
 *
 * 折りたたみの中にしか置かない（畳んでいるあいだは1行の要約のまま）。
 * 見張りは scripts/e2e-smoke.mjs の JPGAP-02。
 */
export default function NutritionGapDishes({
  sum,
  kind,
}: {
  sum: Pick<PersonalNutritionSum, 'gapDishes'>
  kind: NutritionGapKind
}) {
  const dishes = gapDishList(sum, kind)
  if (dishes.length === 0) return null
  return (
    <ul>
      {dishes.map((dish) => (
        <li key={dish.id}>
          <Link
            to={`/recipes/${dish.id}`}
            data-testid="nutrition-gap-dish"
            className="flex min-h-[var(--tap-min)] items-center text-sm font-bold text-accent-ink underline"
          >
            {dish.title}
          </Link>
        </li>
      ))}
    </ul>
  )
}
