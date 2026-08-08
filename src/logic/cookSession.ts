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

/** 「調理をはじめる」＝段取りの先頭。手順が1つも無ければ undefined */
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
  const chars = [...text.trim()]
  if (maxChars <= 1 || chars.length <= maxChars) return chars.join('')
  const head = headChars ?? Math.ceil((maxChars - 1) * 0.55)
  const tail = Math.max(1, maxChars - 1 - head)
  return `${chars.slice(0, head).join('')}…${chars.slice(chars.length - tail).join('')}`
}
