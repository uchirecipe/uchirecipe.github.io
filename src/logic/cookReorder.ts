/**
 * 段取りを手で並べ替える（2026-08-14 便GJ・docs/71 の R3 / R4）。
 *
 * 利用者2体が同じことを言っている:
 *   R3「段取りを手で並べ替える手段がない。上下ボタンもドラッグもなし。出てきた順番が
 *       気に入らなくても直せません。」
 *   R4「『火加減や進み具合に合わせて順番は前後してかまいません』と書いてありますが、
 *       前後させると番号が合わなくなり、調理中モードは元の順で進みます。」
 *
 * ## 状態の持ち方（docs/69 の不変条件を動かさない）
 * **並べ替えた段取りそのものは保存しない。** 保存するのは 2026-08-10 便FI が入れた
 * `pulls`（`StepPull` の並び＝「どの手順を、どの手順の直前へ動かしたか」）だけで、
 * 段取りは今までどおり毎回組み直し、そこへこの指示を当て直す（`applyStepPulls`）。
 * 手で動かす操作も**同じ `pulls` に1件足すだけ**にして、覚え書きに新しい項目を作らない
 * ＝「書ける状態は `cookNaviSession` ＋ `current` ＋ `pulls` だけ」を保つ。
 *
 * 上下どちらの移動も `StepPull` 1件で言い表せる:
 *   - 1つ上へ … その手順を、1つ上の手順の直前へ動かす
 *   - 1つ下へ … **1つ下の手順を、その手順の直前へ動かす**（＝2つが入れ替わる）
 * 下へを「2つ下の直前へ」と書かずに済むので、いちばん下の手順が相手でも同じ形で書ける。
 *
 * ## 動かした結果が「うちの台所では無理」になったときの扱い
 * **止めない。印を出して伝える。**（司令部の判断。理由は docs/71 R2〜R4 が
 * 「自分のほうが正しい」と考えて順番を直しにくるため。止めると要望そのものを潰す）
 * ここでは「印を出す場所」を決めるだけで、押させない・書き換えるといったことはしない。
 *
 * 見るのは3つ:
 *   1. その品の手順が、レシピに書いた順番より前に出た（＝切る前に炒める）
 *   2. 設定した器具の台数を超えて、同じ器具を同時に使う
 *   3. 火にかけたまま、次にその品へ手を戻すまでが空きすぎる
 *
 * 2と3は時刻を見ないと分からないので、**表示している並びのまま上から順に手を付けた場合**を
 * その場で数え直す（保存しない導出値）。この数え直しは本体の段取りエンジンより粗いので、
 * **自動で組んだ並びを同じやり方で数えた結果との差だけ**を出す＝数え方の粗さが印になって
 * 出てこない（自動の段取りは器具の重なり0件・火にかけたままの放置0件で検査済み）。
 */

import {
  ApplianceSchedule,
  stepApplianceFor,
  type ApplianceKey,
  type KitchenEquipment,
} from './cookAppliance'
import {
  HEAT_HOLD_ALLOWANCE,
  hasParallelCue,
  heatOffAtEnd,
  stepHeatShift,
  waitOverrunAllowance,
  waitUrgency,
  type TimelineItem,
} from './cookNavi'
import type { CursorTarget, StepPull } from './cookSession'

/** 手順の識別子だけを取り出す（段取りの通し番号ではなく、レシピ側の識別子で持つ） */
function targetOf(item: CursorTarget): CursorTarget {
  return { recipeId: item.recipeId, stepIndex: item.stepIndex }
}

/** 覚え書きのキー（手順1つを指す） */
export function reorderStepKey(item: CursorTarget): string {
  return `${item.recipeId}-${item.stepIndex}`
}

/**
 * 「1つ上へ」の指示。いちばん上の手順では動かせない（undefined＝押しても何もしない）。
 */
export function moveStepUpPull(
  items: readonly CursorTarget[],
  index: number,
): StepPull | undefined {
  if (index <= 0 || index >= items.length) return undefined
  return { before: targetOf(items[index - 1]), target: targetOf(items[index]) }
}

/**
 * 「1つ下へ」の指示。**1つ下の手順を自分の直前へ引き寄せる**ので、いちばん下の手順が
 * 相手でも同じ形で書ける（2つ下の手順を指さなくてよい）。
 */
export function moveStepDownPull(
  items: readonly CursorTarget[],
  index: number,
): StepPull | undefined {
  if (index < 0 || index >= items.length - 1) return undefined
  return { before: targetOf(items[index]), target: targetOf(items[index + 1]) }
}

/** 印の種類 */
export type ReorderIssueKind =
  /** その品の手順が、レシピに書いた順番より前に出ている */
  | 'recipeOrder'
  /** 設定した器具の台数を超えて同時に使う */
  | 'appliance'
  /** 火にかけたまま、次にその品へ手を戻すまでが空きすぎる */
  | 'unattended'

export interface ReorderIssue {
  recipeId: number
  stepIndex: number
  kind: ReorderIssueKind
  /** kind === 'appliance' のときだけ、足りない器具 */
  appliance?: ApplianceKey
}

function issueKey(issue: ReorderIssue): string {
  return `${issue.recipeId}-${issue.stepIndex}-${issue.kind}-${issue.appliance ?? ''}`
}

/**
 * その品の手順が、レシピに書いた順番より前に出ていないか。
 * 自動で組んだ段取り（`base`）は各品の手順を必ずレシピの順で並べるので、**そこでの位置**を
 * 物差しにする。あとに来る同じ品の手順のほうが物差しで前なら、その手順は前に出ている。
 */
function recipeOrderIssues(
  base: readonly TimelineItem[],
  shown: readonly TimelineItem[],
): ReorderIssue[] {
  const rank = new Map<string, number>()
  base.forEach((item, index) => rank.set(reorderStepKey(item), index))
  const byRecipe = new Map<number, TimelineItem[]>()
  for (const item of shown) {
    const list = byRecipe.get(item.recipeId)
    if (list) list.push(item)
    else byRecipe.set(item.recipeId, [item])
  }
  const issues: ReorderIssue[] = []
  for (const list of byRecipe.values()) {
    for (let i = 0; i < list.length; i++) {
      const mine = rank.get(reorderStepKey(list[i]))
      if (mine == null) continue
      for (let j = i + 1; j < list.length; j++) {
        const later = rank.get(reorderStepKey(list[j]))
        if (later == null) continue
        if (later < mine) {
          issues.push({ recipeId: list[i].recipeId, stepIndex: list[i].stepIndex, kind: 'recipeOrder' })
          break
        }
      }
    }
  }
  return issues
}

/**
 * 表示している並びのまま、上から順に手を付けた場合をなぞる（保存しない導出値）。
 *
 * 料理人は1人。手作業の間は次へ進めず、待ちを仕掛けたらその場で次の手順に移る
 * ＝画面に書いてある「番号は手を付ける順番の目安です。待ち時間の間は、次の番号の作業と
 * 並行して進みます。」をそのまま数える。
 */
function scanPhysicalIssues(
  items: readonly TimelineItem[],
  kitchen: KitchenEquipment,
): ReorderIssue[] {
  const schedule = new ApplianceSchedule(kitchen)
  /** その品の次の手順に取りかかれる時刻 */
  const readyAt = new Map<number, number>()
  /** その品がいまコンロの上で火にかかっているか */
  const onHeat = new Map<number, boolean>()
  /** 遅くともこの時刻までにその品へ手を戻す（と、その締め切りを作った手順） */
  const attend = new Map<number, { at: number; item: TimelineItem }>()
  const issues: ReorderIssue[] = []
  /** 料理人の手が空く時刻 */
  let handAt = 0

  items.forEach((item, index) => {
    const step = { text: item.text, minutes: item.minutes, memo: item.memo }
    const applianceKey = stepApplianceFor(item.text, kitchen)
    const isWait = item.kind === 'wait'
    const span = isWait ? item.waitMinutes : item.activeMinutes
    // 器具をふさぐか（本体 buildJobs と同じ判定）
    const occupies =
      applianceKey != null &&
      (isWait
        ? !item.longRest && item.waitMinutes > 0 && waitUrgency(step) !== 'relaxed'
        : item.activeMinutes > 0)
    const start = Math.max(handAt, readyAt.get(item.recipeId) ?? 0)
    const end = start + span

    // 火にかけたまま、手を戻すのが遅れていないか（この手順に取りかかった時点で判定する）
    const due = attend.get(item.recipeId)
    if (due) {
      if (start > due.at) {
        issues.push({ recipeId: due.item.recipeId, stepIndex: due.item.stepIndex, kind: 'unattended' })
      }
      attend.delete(item.recipeId)
    }

    // 器具の空き
    const heldByMe = onHeat.get(item.recipeId) === true && applianceKey === 'stove'
    if (occupies && applianceKey != null && !heldByMe) {
      if (!schedule.canUse(applianceKey, start, end, item.recipeId)) {
        issues.push({
          recipeId: item.recipeId,
          stepIndex: item.stepIndex,
          kind: 'appliance',
          appliance: applianceKey,
        })
      }
    }

    // 火にかけたままの鍋は、火を止めるまでその口をふさぎ続ける（本体と同じ扱い）
    const shift = stepHeatShift(step, kitchen)
    const stays = applianceKey === 'stove' && (shift === 'on' || (shift === 'keep' && heldByMe))
    if (stays) schedule.hold('stove', item.recipeId, start)
    else if (occupies && applianceKey != null && !heldByMe) schedule.occupy(applianceKey, start, end)
    if (shift === 'on') onHeat.set(item.recipeId, true)
    else if (shift === 'off') onHeat.set(item.recipeId, false)
    if (onHeat.get(item.recipeId) !== true) {
      schedule.release(item.recipeId, start + (heatOffAtEnd(step) ? span : 0))
    }

    // 次の手順に取りかかれる時刻と、手を戻す締め切り
    const isLastOfRecipe = !items.slice(index + 1).some((x) => x.recipeId === item.recipeId)
    if (isWait) {
      // 利用者が「その間に」と書いた手順は、この待ちの中でやる（本体 buildJobs と同じ扱い）
      const nextOfRecipe = items.slice(index + 1).find((x) => x.recipeId === item.recipeId)
      const fillsWait =
        nextOfRecipe != null &&
        nextOfRecipe.kind === 'active' &&
        (item.addedByNavi || hasParallelCue(nextOfRecipe.text))
      readyAt.set(item.recipeId, fillsWait ? start : end)
      const limit = start + item.waitMinutes + waitOverrunAllowance(step, item.waitMinutes)
      if (!item.longRest && item.waitMinutes > 0 && Number.isFinite(limit) && !isLastOfRecipe) {
        attend.set(item.recipeId, { at: limit, item })
      }
    } else {
      readyAt.set(item.recipeId, end)
      handAt = end
      // 火にかけたまま次の手順へ進んだ＝そこから締め切りが始まる（本体と同じ猶予）
      if (onHeat.get(item.recipeId) === true && !isLastOfRecipe) {
        attend.set(item.recipeId, { at: end + HEAT_HOLD_ALLOWANCE, item })
      }
    }
    // その品を最後まで出し終えたら、火にかけたままでも口を返す（食卓に出す＝火から下りる）
    if (isLastOfRecipe) {
      onHeat.set(item.recipeId, false)
      schedule.release(item.recipeId, start + span)
    }
  })
  return issues
}

/**
 * 手で並べ替えたことで**新しく**出てきた無理を返す。
 *
 * @param base  自動で組んだそのままの段取り（`buildCookPlan` の items）
 * @param shown 画面に出している段取り（`applyStepPulls` を当てたあと）
 *
 * 自動の段取りを同じやり方で数えた結果と引き算するので、この数え直しが本体より粗いぶんは
 * 印にならない（自動の段取りは監査で器具の重なり0件・火にかけたままの放置0件を確認済み）。
 */
export function reorderIssues(
  base: readonly TimelineItem[],
  shown: readonly TimelineItem[],
  kitchen: KitchenEquipment,
): ReorderIssue[] {
  if (base.length === 0 || shown.length === 0) return []
  const known = new Set(scanPhysicalIssues(base, kitchen).map(issueKey))
  const physical = scanPhysicalIssues(shown, kitchen).filter((i) => !known.has(issueKey(i)))
  return [...recipeOrderIssues(base, shown), ...physical]
}

/** 手順ごとに印をまとめる（画面はこの表を引くだけ） */
export function reorderIssuesByStep(issues: readonly ReorderIssue[]): Map<string, ReorderIssue[]> {
  const map = new Map<string, ReorderIssue[]>()
  for (const issue of issues) {
    const key = reorderStepKey(issue)
    const list = map.get(key)
    if (list) list.push(issue)
    else map.set(key, [issue])
  }
  return map
}
