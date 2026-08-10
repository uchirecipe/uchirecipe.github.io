/**
 * 調理中セッション（並行調理ナビの全画面表示）のカーソル遷移（2026-08-09 便EL・docs/69）。
 *
 * ここに**書ける状態は1つだけ**＝「いまどの手順にいるか」を指す `CookCursor`
 * （どのレシピの・そのレシピの何番目の手順か）。段取り・進捗・済んだ手順の一覧は
 * **保存しない**。理由は 2026-08-09 に実発した「献立タブで1品だけ『作った！』したら
 * 並行調理ナビの状態が壊れる」と同型の事故を、構造として起こせなくするため
 * （同じことを2か所に書くと、片方だけ更新される瞬間が必ずできる）。
 *
 *   - 段取り       … 毎回レシピの実データから組み直す（`buildCookPlan`）
 *   - 済んだ手順   … カーソルより前の**接頭辞**（別に集合を持たない）
 *   - 各品の次手順 … カーソルより後にある、その品の最初の手順（＝カーソルの投影）
 *
 * カーソルの遷移（次へ／戻る／復元）はこのファイルの純粋な関数だけが決める。
 * 画面（CookSessionOverlay）は結果を描くだけで、位置の計算を持たない。
 * 遷移表は `scripts/test-logic.mjs` に固定してある（docs/10 3章＝直す前にテストを足す）。
 */

import { normalizedSegments } from './jaWrap'

/** いま開いている手順の識別子。段取りの中の位置ではなく「どのレシピの何番目の手順か」で持つ */
export interface CookCursor {
  recipeId: number
  /**
   * 元レシピ内の手順の添字（0始まり）。ナビが段取りに足した工程は負の値
   * （`buildPlanSteps` が -1 を振る。1レシピにつき1つまでなので重複しない）。
   *
   * 段取りの通し番号（order）ではなく**レシピ側の識別子**で持つのは、
   * 段取りを組み直したときに並びが変わっても同じ手順を指し続けられるようにするため。
   */
  stepIndex: number
}

/** カーソルが指せる最小限の形。`TimelineItem` をそのまま渡せる */
export interface CursorTarget {
  recipeId: number
  stepIndex: number
}

/** 同じ手順を指しているか */
export function cursorEquals(a: CookCursor | undefined, b: CookCursor | undefined): boolean {
  if (!a || !b) return false
  return a.recipeId === b.recipeId && a.stepIndex === b.stepIndex
}

function toCursor(target: CursorTarget): CookCursor {
  return { recipeId: target.recipeId, stepIndex: target.stepIndex }
}

/** 段取りの中でカーソルが指す位置（見つからなければ -1） */
export function findCursorIndex(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): number {
  if (!cursor) return -1
  return items.findIndex(
    (item) => item.recipeId === cursor.recipeId && item.stepIndex === cursor.stepIndex,
  )
}

/** 「調理中モードで見る」＝段取りの先頭。手順が1つも無ければ undefined */
export function startCursor(items: readonly CursorTarget[]): CookCursor | undefined {
  return items.length > 0 ? toCursor(items[0]) : undefined
}

/**
 * 覚えていたカーソルを、組み直した段取りと突き合わせて復元する。
 * **見つからなければ undefined**＝推測して近い手順に移さない（docs/69）。
 * 台所で機械に位置を当てさせると、間違った手順を大きく出したまま作業が進んでしまうため、
 * 呼び出し側は段取りの一覧表示に戻す。
 */
export function resolveCursor(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): CookCursor | undefined {
  const index = findCursorIndex(items, cursor)
  return index === -1 ? undefined : toCursor(items[index])
}

/**
 * 「調理中モードで見る」を押したときに開く手順（2026-08-10 便FC・オーナー実機
 * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
 *
 * 覚えている手順が組み直した段取りにまだあれば**そこから再開**し、無ければ先頭から始める。
 * 位置の決め方を画面に書かず、ここ（純関数）に置くのは他の遷移と同じ理由
 * （台所で位置がずれる不具合は、遷移表を単体テストで固定してあれば起こせない）。
 *
 * 覚えていた手順が段取りから消えているとき、ここでは黙って先頭に落とす。
 * 「見つからなかったこと」を画面に知らせるのは呼び出し側（CookNaviPage）の役目で、
 * そちらは `resolveCursor` の undefined を見て一覧に戻す（docs/69「復元」）。
 */
export function resumeCursor(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): CookCursor | undefined {
  return resolveCursor(items, cursor) ?? startCursor(items)
}

/**
 * 次の手順へ。動かせない（段取りに無い・すでに最後）ときは undefined を返す
 * ＝呼び出し側はカーソルを変えない。
 */
export function advanceCursor(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): CookCursor | undefined {
  const index = findCursorIndex(items, cursor)
  if (index === -1 || index >= items.length - 1) return undefined
  return toCursor(items[index + 1])
}

/** ひとつ前の手順へ。動かせない（段取りに無い・すでに先頭）ときは undefined */
export function backCursor(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): CookCursor | undefined {
  const index = findCursorIndex(items, cursor)
  if (index <= 0) return undefined
  return toCursor(items[index - 1])
}

/** 段取りの最後の手順にいるか（カーソルが段取りに無いときは false） */
export function isCursorAtLast(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): boolean {
  const index = findCursorIndex(items, cursor)
  return index !== -1 && index === items.length - 1
}

/** 段取りの先頭にいるか（カーソルが段取りに無いときは false） */
export function isCursorAtFirst(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
): boolean {
  return findCursorIndex(items, cursor) === 0
}

/** その品の、カーソルより後にある最初の手順（＝カーソルの投影。保存しない導出値） */
export interface NextStepProjection<T> {
  recipeId: number
  /** カーソルより後に残っている最初の手順。すべて済んでいれば undefined */
  item: T | undefined
}

/**
 * 他の品の「次にやる手順」を1つずつ求める。
 * 済んだ手順＝カーソルより前、という決め方だけを使うので、済みの集合を別に持たない。
 * カーソルが段取りに無いときは空配列（＝呼び出し側は下部の行を出さない）。
 *
 * 並び順は渡された `recipeIds` の順（＝レシピの色の順）で固定する。
 * 進むたびに行が入れ替わると、下部を見て手が止まるため。
 */
export function nextStepsByRecipe<T extends CursorTarget>(
  items: readonly T[],
  cursor: CookCursor | undefined,
  recipeIds: readonly number[],
): NextStepProjection<T>[] {
  const index = findCursorIndex(items, cursor)
  if (index === -1) return []
  const currentRecipeId = items[index].recipeId
  return recipeIds
    .filter((recipeId) => recipeId !== currentRecipeId)
    .map((recipeId) => ({
      recipeId,
      item: items.slice(index + 1).find((item) => item.recipeId === recipeId),
    }))
}

/** 色を言われたときに、その色の品をどう扱うか */
export type CookColorMove =
  /** その品の次の手順へカーソルを動かす */
  | { kind: 'move'; recipeId: number; cursor: CookCursor }
  /** その品の手順は、いま大きく出している＝動かない */
  | { kind: 'current'; recipeId: number }
  /** その品はもう残りの手順が無い（下部の行に「完成」と出ている状態） */
  | { kind: 'done'; recipeId: number }
  /** その色の品が段取りに無い（2品しか組んでいないのに3色目を言った等） */
  | { kind: 'none' }

/**
 * 色（「青」「緑」「ピンク」）を言われたときの行き先を決める
 * （2026-08-10 便FI・docs/69 第3段「色で実行を引き寄せる」。オーナー要望
 * 「並行調理ナビ調理中モードの、色で手順入れ替えはいつ実装しますか？」）。
 *
 * **行き先は、下部にその色で出ている行の手順そのもの**にする（`nextStepsByRecipe` と
 * まったく同じ決め方＝カーソルより後にある、その品の最初の手順）。
 * 画面に見えていない手順へ飛ばすと、なぜそこが開いたのか台所で説明がつかない。
 * 「見えている行が開く」だけなら、言う前に行き先を目で確かめられる。
 *
 * 動くのはカーソルだけ＝**記録もタイマーの削除もセッションの終了も起きない**
 * （docs/69「音声で受けるのは、間違っても戻れる操作だけ」）。言い直せば別の品へ移れる。
 *
 * 行き先が無いときも「何も起きない」で終わらせず、理由（いま開いている／完成している／
 * その色の品が無い）を返す。呼び出し側はそれを短い文にしてその場に出す。
 */
export function resolveColorMove<T extends CursorTarget>(
  items: readonly T[],
  cursor: CookCursor | undefined,
  colorIndex: number,
  recipes: readonly { id: number; colorIndex: number }[],
): CookColorMove {
  const recipe = recipes.find((r) => r.colorIndex === colorIndex)
  if (!recipe) return { kind: 'none' }
  const index = findCursorIndex(items, cursor)
  // カーソルが段取りに無い状態（組み直しで手順が消えた等）では、画面そのものが
  // 一覧表示に戻る。声の行き先も決めない
  if (index === -1) return { kind: 'none' }
  if (items[index].recipeId === recipe.id) return { kind: 'current', recipeId: recipe.id }
  const next = items.slice(index + 1).find((item) => item.recipeId === recipe.id)
  if (!next) return { kind: 'done', recipeId: recipe.id }
  return { kind: 'move', recipeId: recipe.id, cursor: toCursor(next) }
}

/**
 * 畳んだ1行の書式（2026-08-09 オーナー決定・docs/69 の項目6を上書き）。
 * オーナー原文:「文頭には材料がくるが、文末なら動詞がきやすい。文頭⋯文末、の形ではどうか？」
 *
 * 「動詞のみ」（＝手順を分類して動詞を当てる）も「先頭だけの省略」も採らない。
 * 前者は診断（docs/68 2-7）で分類不明が12〜31%あり、「和える」を「加熱」と出す誤表示が起きる。
 * 後者は文末の動作が落ちて「何をするのか」が消える。
 * **この書式は手順本文をそのまま切り出すだけで、何も推定しない＝誤表示が構造的に起きない。**
 *
 *   「玉ねぎをみじん切りにする。」            → そのまま（上限内なので切らない）
 *   「ボウルにオリーブオイルと…マリネ液を作る。」→「ボウルにオリーブオイル…マリネ液を作る。」
 *
 * @param maxChars 1行に出す上限の文字数（実DOM 390px で決める）
 * @param headChars 文頭に残す文字数。既定は上限の約55%（残りが文末側）
 */
export function collapseStepText(text: string, maxChars: number, headChars?: number): string {
  const trimmed = text.trim()
  const chars = [...trimmed]
  if (maxChars <= 1 || chars.length <= maxChars) return chars.join('')
  const headBudget = headChars ?? Math.ceil((maxChars - 1) * 0.55)
  const byPhrase = collapseAtPhraseBoundary(trimmed, headBudget, maxChars)
  if (byPhrase) return byPhrase
  // 文節1つが枠に入りきらないとき（長い1語・記号ばかりの手順）だけ、従来どおり文字数で切る
  const tailBudget = Math.max(1, maxChars - 1 - headBudget)
  return `${chars.slice(0, headBudget).join('')}…${chars.slice(chars.length - tailBudget).join('')}`
}

/**
 * 文節の切れ目で畳む（2026-08-09 便ES・オーナー指示E-8
 * 「省略を文節で区切る。『じん切りにする。』のような切れ方をなくす」）。
 *
 * 文字数だけで切ると「玉ねぎをみ…じん切りにする。」のように語の途中で切れ、
 * 何をする手順なのかが読み取れなくなっていた。折り返しと同じ文節分割
 * （logic/jaWrap.ts の normalizedSegments＝BudouX＋うちレシピの結合ルール）を使い、
 * **文節の切れ目でだけ**切る。文節1つが枠に入りきらないとき（長い1語など）は
 * undefined を返し、呼び出し側が従来どおり文字数で切る。
 */
function collapseAtPhraseBoundary(
  text: string,
  headBudget: number,
  maxChars: number,
): string | undefined {
  const segments = normalizedSegments(text)
  if (segments.length < 2) return undefined
  let headEnd = 0
  let headLength = 0
  while (headEnd < segments.length) {
    const next = headLength + [...segments[headEnd]].length
    if (next > headBudget) break
    headLength = next
    headEnd++
  }
  if (headEnd === 0) {
    // 先頭の文節が既定の割り当てより長い（「塩こしょうとしょうゆで」など）。
    // ここで諦めると文字数で切ることになり、語の途中で切れてしまう。
    // 末尾の1文節が残る範囲なら、先頭の文節をまるごと入れる
    const first = [...segments[0]].length
    const last = [...segments[segments.length - 1]].length
    if (first + 1 + last > maxChars) return undefined
    headEnd = 1
    headLength = first
  }
  // 文頭を文節で切ると割り当てが余ることが多いので、余りは文末側に回す
  // （文末には動詞が来やすい＝残せるほど「何をする手順か」が分かる）
  const tailBudget = Math.max(1, maxChars - 1 - headLength)
  let tailStart = segments.length
  let tailLength = 0
  while (tailStart > headEnd) {
    const next = tailLength + [...segments[tailStart - 1]].length
    if (next > tailBudget) break
    tailLength = next
    tailStart--
  }
  if (headEnd === 0 || tailStart === segments.length) return undefined
  // 全部入るなら省略しない（呼び出し側の文字数判定と食い違わないための保険）
  if (headEnd >= tailStart) return text
  return `${segments.slice(0, headEnd).join('')}…${segments.slice(tailStart).join('')}`
}
