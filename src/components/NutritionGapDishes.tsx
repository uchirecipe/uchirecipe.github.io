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
  linkState,
  onNavigate,
}: {
  sum: Pick<PersonalNutritionSum, 'gapDishes'>
  kind: NutritionGapKind
  /**
   * 「この名前はどの画面から押されたか」（2026-08-28 便MA）。
   *
   * 直した不具合（オーナー原文「選んだ期間の栄養など、計算できなかった材料がある
   * レシピ名をタップした後のレシピ詳細から、戻るで同じ画面に戻るようにして。
   * レシピ一覧に飛んでしまう。」）: ここは `<Link to>` だけを書いていて、**出所を
   * まったく載せていなかった**。レシピ詳細の「戻る」は `location.state` の出所で
   * 行き先を決める（RecipeDetailPage の BACK_TO_ORIGIN_FROM）ので、出所が無い＝
   * 必ずレシピ一覧へ着地していた（実測: 詳細の state が null、戻ると /#/recipes）。
   * 献立の中の他のレシピへの入口（曜日カード・日の窓・記録の小窓）は前から
   * `linkState` と `onNavigate` の2つを渡していたので、**同じ名前・同じ渡し方**にそろえる。
   * 渡さない画面は今までどおりレシピ一覧へ戻る。
   */
  linkState?: { from: string; fromPath: string }
  /** 押した瞬間に居場所（見ていたタブ・月・縦位置・折りたたみ）を覚える。上と対で渡す */
  onNavigate?: () => void
}) {
  const dishes = gapDishList(sum, kind)
  if (dishes.length === 0) return null
  return (
    <ul>
      {dishes.map((dish) => (
        <li key={dish.id}>
          <Link
            to={`/recipes/${dish.id}`}
            state={linkState}
            onClick={onNavigate}
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
