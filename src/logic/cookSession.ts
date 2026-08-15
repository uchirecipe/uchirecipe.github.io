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
 * タイマーの窓から「その手順を見る」を押したときの行き先（2026-08-15 便GQ）。
 *
 * ## なぜ「見るだけ」なのか
 * タイマーが鳴る手順は、**すでに通り過ぎた手順**であることがほとんど（先に火にかけて、
 * 別の品を進めている最中に鳴る）。そこでやりたいのは「その手順を読んで、その一手をやる」
 * ことであって、調理の現在地を戻すことではない。
 *
 * ところが便FC〜便GO のあいだ、この導線は**カーソルそのものを動かして**いた。
 * このアプリは「済んだ手順＝現在地より前」という導出で数える（docs/69 の不変条件）ので、
 * 現在地が戻ると**通り過ぎたはずの手順が「まだやっていない」に巻き戻り**、他の品の
 * 「次の手順」の表示もつられて巻き戻る。戻す手立ては「次へ」を押し直すことしか無かった。
 *
 * ## 前へ進む向きも同じく動かさない
 * 現在地より**後ろ**の手順のタイマー（段取りの一覧から先の手順のタイマーを始めたとき）でも
 * 同じく見るだけにする。理由は3つ:
 *   1. 同じ導出の裏返しで、前へ飛ばすと**やっていない手順が「済んだ」に化ける**
 *      ＝壊れ方の向きが違うだけで、巻き戻しと同じ事故になる
 *   2. 1つのボタンが、押す時々で「移る」「見る」に変わると、台所で結果を予測できない
 *   3. 手順に移りたいときの道は別にある（下部の行を開いた中の「この手順を先にする」＝引き寄せ）。
 *      引き寄せは手順を1つも消さずに順番を組み替えるので、進み具合が壊れない
 *
 * 戻り値に**カーソルを入れない**のは、呼び出し側に現在地を動かす材料を渡さないため
 * （型として「見るだけ」しか表せない＝同じ不具合を構造的に作れなくする）。
 */
export type CookTimerStepLanding =
  /** 調理中（カーソルがある）＝全画面の中でその手順を見るだけ。現在地は動かさない */
  | { kind: 'peek'; target: CookCursor }
  /**
   * 調理していない（カーソルが無い）・段取りにその手順が無い＝
   * 従来どおり段取りの一覧の該当カードへ送ってハイライトする。
   * 巻き戻す現在地が無いので、こちらは今までの動きのままでよい
   */
  | { kind: 'list' }

export function resolveTimerStepLanding(
  items: readonly CursorTarget[],
  cursor: CookCursor | undefined,
  target: CursorTarget | undefined,
): CookTimerStepLanding {
  if (!target) return { kind: 'list' }
  // 覚えている現在地が組み直した段取りに無いときは「調理中ではない」と同じ扱い（docs/69）
  if (findCursorIndex(items, cursor) === -1) return { kind: 'list' }
  const index = findCursorIndex(items, target)
  if (index === -1) return { kind: 'list' }
  return { kind: 'peek', target: toCursor(items[index]) }
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
 * 「色で引き寄せた」1回ぶん（2026-08-10 便FI・docs/69 第3段
 * 「色で実行を引き寄せる＝並べ替え」）。
 *
 * **カーソルを先へ飛ばすのではなく、言われた品の手順をいまの位置へ引き寄せる**。
 * 飛ばす形にすると、間にある他の品の手順が「カーソルより前＝済んだ手順」に化けてしまい、
 * 作っていない品が「完成」と出る（実機で確認済み。docs/69 の状態の持ち方では、
 * 済み＝カーソルより前、という決め方しかできないため構造的にそうなる）。
 * 引き寄せる形なら**手順は1つも消えず**、間の手順はそのまま後ろに残る。
 *
 * 引き寄せは保存しない。段取りは毎回組み直すので、この記録も
 * 「どの手順を、どの手順の直前へ動かしたか」だけを持ち、組み直した段取りに毎回当て直す
 * （手順が消えていたらその1件を飛ばす）。
 */
export interface StepPull {
  /** この手順の直前に差し込む（＝色を言ったときに開いていた手順） */
  before: CursorTarget
  /** 引き寄せる手順（＝言われた色の品の、次の手順） */
  target: CursorTarget
}

/**
 * 引き寄せを段取りに当てる（純関数）。順番に当てるので、何回言い直しても同じ結果になる。
 * 当てられない1件（手順が段取りから消えた・すでにその位置にある）は黙って飛ばす。
 */
export function applyStepPulls<T extends CursorTarget>(
  items: readonly T[],
  pulls: readonly StepPull[],
): readonly T[] {
  if (pulls.length === 0) return items
  const list = [...items]
  for (const pull of pulls) {
    const targetIndex = findCursorIndex(list, pull.target)
    const beforeIndex = findCursorIndex(list, pull.before)
    if (targetIndex === -1 || beforeIndex === -1 || targetIndex === beforeIndex) continue
    const [moved] = list.splice(targetIndex, 1)
    // 取り除いたぶん、差し込み先が1つ手前にずれることがある
    const insertAt = targetIndex < beforeIndex ? beforeIndex - 1 : beforeIndex
    list.splice(insertAt, 0, moved)
  }
  return list
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
 * 移り方は**引き寄せ**（`StepPull`）＝その手順をいまの位置へ持ってくる。開いていた手順は
 * 1つ後ろに下がるだけで消えない。手順が消えず、記録もタイマーの削除もセッションの終了も
 * 起きない（docs/69「音声で受けるのは、間違っても戻れる操作だけ」）。言い直せば別の品へ移れる。
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
