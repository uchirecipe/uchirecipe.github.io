/**
 * 月タブの「日の窓」で何を変えたかを数える（2026-08-07 便DU・オーナー指示
 * 「同じ画面の変更をキャンセルで取り消し・保存で確定できるように」）。
 *
 * 日の窓の編集（レシピの追加・差し替え・外す・食数の変更・日付メモ）は、窓を開いている間に
 * その場でDBへ入る。「キャンセル」は窓を開いた時点の控えへ戻す操作なので、
 * 規約F（何が消えるか・何が残るかを件数つきで両方書く）の確認文を組むために、
 * 「開いたとき」と「いま」を突き合わせて件数を出す。ここは画面もDBも触らない純関数。
 */

/** 突き合わせに使う献立1行ぶん（MealPlanEntry のうち、日の窓で変わりうる項目だけ） */
export type DayEntrySnapshot = {
  id?: number
  slot: string
  role?: string
  recipeId: number
  servings?: number
}

export type DayEditState = {
  entries: DayEntrySnapshot[]
  /** その日の日付メモ（無ければ空文字） */
  note: string
}

export type DayEditDiff = {
  /** 開いてから増えた品数 */
  added: number
  /** 開いてから外した品数 */
  removed: number
  /** 同じ枠のままレシピ・食数が変わった品数 */
  changed: number
  /** 日付メモが変わったか */
  noteChanged: boolean
  /** 1つでも変わっていれば true（＝「キャンセル」「保存」を出すかどうかの判定） */
  dirty: boolean
}

const sameEntry = (a: DayEntrySnapshot, b: DayEntrySnapshot): boolean =>
  a.recipeId === b.recipeId &&
  a.slot === b.slot &&
  (a.role ?? 'main') === (b.role ?? 'main') &&
  a.servings === b.servings

/**
 * 「開いたとき」と「いま」を突き合わせる。行はidで対応付ける
 * （差し替えは同じidのままレシピだけが変わるため、idで見ないと「1品外して1品足した」に見える）。
 * idを持たない行（保存前の理論値。実運用では発生しない）は、突き合わせ対象にせず
 * before側は削除・after側は追加として数える。
 */
export function diffDayEdit(before: DayEditState, after: DayEditState): DayEditDiff {
  const beforeById = new Map<number, DayEntrySnapshot>()
  let beforeUnkeyed = 0
  for (const entry of before.entries) {
    if (entry.id == null) beforeUnkeyed += 1
    else beforeById.set(entry.id, entry)
  }
  let added = 0
  let changed = 0
  const seen = new Set<number>()
  for (const entry of after.entries) {
    if (entry.id == null) {
      added += 1
      continue
    }
    const previous = beforeById.get(entry.id)
    if (!previous) {
      added += 1
      continue
    }
    seen.add(entry.id)
    if (!sameEntry(previous, entry)) changed += 1
  }
  const removed = beforeUnkeyed + [...beforeById.keys()].filter((id) => !seen.has(id)).length
  const noteChanged = before.note.trim() !== after.note.trim()
  return {
    added,
    removed,
    changed,
    noteChanged,
    dirty: added > 0 || removed > 0 || changed > 0 || noteChanged,
  }
}
