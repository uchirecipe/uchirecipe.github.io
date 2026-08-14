/**
 * 手順を進めたときに、タイマーのことだけを一言伝える（2026-08-14 便GL・docs/71 の実操作テスト）。
 *
 * 利用者の言葉（原文）:
 *   「グリル15分のタイマーを押さずに次へ進めてしまった。何も止められません。魚焼きグリルに
 *     火が入ったまま段取りだけ先へ行く。ここは『タイマーを押していませんが進みますか』
 *     くらい言ってほしい。」
 *   「その料理の次の手順に進んでも、前のタイマーは動いたまま・警告なし。段取り6に進んだ
 *     時点で、鶏の下味10分タイマーがまだ09:12残っていました。」
 *
 * ## 決めたこと
 * **止めない。伝えるだけ。**（2026-08-14 の並べ替えの印と同じ考え方＝利用者の手を止めない）
 * 確認の窓は出さない。進んだ直後に1行出して、しばらくすると自分で消える。
 *
 * **うるさくしない**ために、見るのは次の2つだけ。どちらも当てはまらない手順では何も返さない:
 *   ①離れた手順が「約◯分の待ち時間」で、そのタイマーを始めていない
 *   ②いま開いた手順の品に、別の手順から動いているタイマーが残っている
 *
 * ②には除き方がある。**段取りが「その待ちの中でやる」と決めて置いた手順**
 *（利用者が「その間に」と書いた手順・ナビが足した湯沸かしの次の手順）は、
 * 待ちが終わっていないのが**正しい**状態なので何も言わない。
 * 判定はエンジン側の言い方（`hasParallelCue` / `addedByNavi`）をそのまま借りる
 * ＝段取りの組み方（logic/cookNavi.ts）には手を入れず、同じ物差しで黙る。
 */
import { hasParallelCue, recipeStepLabel, showsWaitTimerButton, type TimelineItem } from './cookNavi'
import { findCursorIndex, type CookCursor } from './cookSession'

/** 一言の中身。画面はこの指し先から、そのときの手順・タイマーを引き直して描く */
export type CookTimerNotice =
  /** 離れた手順の待ちに、タイマーを始めていない（その手順を指す） */
  | { kind: 'notStarted'; recipeId: number; stepIndex: number }
  /** いま開いた品のタイマーがまだ動いている（そのタイマーを指す） */
  | { kind: 'stillRunning'; timerId: number }

/** タイマー1本のうち、この判定に要るところだけ */
export interface NoticeTimer {
  id: number
  /** `${recipeId}-${stepIndex}-${秒数}`（logic/timerOrder.ts と同じ形） */
  key: string
  recipeId: number
  done: boolean
  /** 一時停止中はミリ秒が入る（動いていない＝急かさない） */
  pausedRemainingMs?: number
  /** そのレシピ内での手順番号の表示（「3」「3-1」）。どの手順のタイマーかを引くのに使う */
  naviStepLabel?: string
}

/** そのタイマーが、この手順のものか（キーの前半で見る＝表示の文字に頼らない） */
function isForStep(timer: NoticeTimer, item: { recipeId: number; stepIndex: number }): boolean {
  return timer.key.startsWith(`${item.recipeId}-${item.stepIndex}-`)
}

/** そのタイマーを始めた手順（段取りの中の1つ）。見つからないこともある */
function stepOfTimer(
  items: readonly TimelineItem[],
  timer: NoticeTimer,
): TimelineItem | undefined {
  const byKey = items.find((x) => isForStep(timer, x))
  if (byKey) return byKey
  return items.find(
    (x) => x.recipeId === timer.recipeId && (recipeStepLabel(x) ?? '') === (timer.naviStepLabel ?? ''),
  )
}

/**
 * 「次へ」で進んだときに出す一言（無ければ null）。
 *
 * @param items   画面に出している段取り（手で並べ替えたあとの並び）
 * @param from    離れる手順
 * @param to      進んだ先の手順
 * @param timers  いまあるタイマー
 */
export function timerNoticeOnAdvance(
  items: readonly TimelineItem[],
  from: CookCursor,
  to: CookCursor,
  timers: readonly NoticeTimer[],
): CookTimerNotice | null {
  const fromIndex = findCursorIndex(items, from)
  const toIndex = findCursorIndex(items, to)
  if (fromIndex === -1 || toIndex === -1) return null
  const left = items[fromIndex]
  const arrived = items[toIndex]

  // ① 離れた手順が「約◯分の待ち時間」なのに、そのタイマーを始めていない。
  //    分数を名乗らない長い待ち（半日〜一晩）はタイマーのボタン自体が無いので対象外
  //    （showsWaitTimerButton が画面と同じ判定を持っている）
  if (showsWaitTimerButton(left) && !timers.some((t) => !t.done && isForStep(t, left))) {
    return { kind: 'notStarted', recipeId: left.recipeId, stepIndex: left.stepIndex }
  }

  // ② いま開いた手順の品に、別の手順から動いているタイマーが残っている
  const running = timers.find(
    (t) =>
      !t.done &&
      t.pausedRemainingMs == null &&
      t.recipeId === arrived.recipeId &&
      !isForStep(t, arrived),
  )
  if (!running) return null
  // 段取りが「その待ちの中でやる」と決めて置いた手順では黙る（正しい状態なので言わない）
  const waitStep = stepOfTimer(items, running)
  if (arrived.kind === 'active' && (waitStep?.addedByNavi || hasParallelCue(arrived.text))) {
    return null
  }
  return { kind: 'stillRunning', timerId: running.id }
}
