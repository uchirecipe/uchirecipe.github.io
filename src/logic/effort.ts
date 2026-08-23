import type { EffortLevel } from '../db/types'
import type { EffortFilter } from './search'

/**
 * 手間レベルを「レシピカードに出すか」の決めごと（2026-08-23 便JP・③）。
 *
 * オーナー原文: 「③（手間レベル）推奨通り。絞り込みでどういう扱いになる？」
 * ＝司令部の推奨（手間レベルの推定はせず、既定値のバッジは出さない）どおり。
 *
 * 「普通」は**レシピを登録するときに何も選ばなければそうなる値**で、人が選んだ結果ではない
 * （src/pages/RecipeFormPage.tsx も 'normal' を未入力扱いとして数えている）。
 * 並ぶカードの大半が同じ「普通」で埋まると、見比べるときの手がかりにならないので出さない。
 *
 * **変えるのは表示だけ**。絞り込み（logic/search.ts）はこの決めごとを一切見ない
 * ＝「普通」で絞れば、バッジが出ていない品もこれまでどおり出る。
 * レシピ詳細も従来どおり3つとも出す（1品を読む場所なので、見比べのための引き算は当たらない。
 * ここで消すと、編集画面を開かないとその品の手間レベルが分からなくなる）。
 *
 * 見張りは scripts/test-logic.mjs の JP-3 と scripts/e2e-smoke.mjs の JPEFFORT-03。
 */

/** 手間レベルの既定値（レシピを登録するとき、選ばなければこれになる） */
export const DEFAULT_EFFORT_LEVEL: EffortLevel = 'normal'

/** レシピカードに手間レベルのバッジを出すか（既定値のままの品には出さない） */
export function showsEffortBadge(level: EffortLevel): boolean {
  return level !== DEFAULT_EFFORT_LEVEL
}

/** 手間レベルの全部（レシピを登録するときに選べる3つ。並びは軽いほうから） */
export const EFFORT_LEVELS = ['easy', 'normal', 'fancy'] as const satisfies readonly EffortLevel[]

/**
 * 絞り込みで選べる手間レベル（2026-08-23 便JP・②追補・オーナー指示「絞り込みからも普通はずして」）。
 *
 * バッジを出す条件とまったく同じ規則で決める＝**画面に出ない値では絞れない**という形を、
 * 2か所に書かずに1か所で守る。既定値の「普通」には、選ばなかった品と選んだ品が混ざって
 * 落ちてくるので、絞り込みの条件としては品を選り分けられない。
 *
 * **レシピのデータは触らない**（「普通」を選んで保存した品はそのまま。表示と絞り込みの選択肢だけ）。
 */
export const EFFORT_FILTER_LEVELS: readonly EffortLevel[] = EFFORT_LEVELS.filter((level) =>
  showsEffortBadge(level),
)

/**
 * 保存されていた絞り込みを、いま選べる形に直す（2026-08-23 便JP・②追補）。
 *
 * レシピ一覧は絞り込みをセッションに覚えていて、開き直すとそのまま戻る。
 * 「普通」で絞った状態が残っている端末では、選択肢から消したあとも条件だけが生き残り、
 * **一覧が空のまま、外す手立てが画面に無い**状態になりうる。選べない値は「すべて」に戻す。
 */
export function normalizeEffortFilter(value: EffortFilter | undefined | null): EffortFilter {
  if (value == null || value === 'all') return 'all'
  return EFFORT_FILTER_LEVELS.includes(value) ? value : 'all'
}
