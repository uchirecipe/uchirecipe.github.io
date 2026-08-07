// タイマーの「表示順」と「端末内保存の読み書き」の純ロジック（2026-07-28 機能④診断C6/C7）。
// Reactに依存しない純粋関数にして、scripts/test-logic.mjs から直接検証できるようにしてある。
import { ja } from '../i18n/ja'

/** 並べ替えに必要な最小限の形（ActiveTimer はこれを満たす） */
export interface TimerOrderFields {
  done: boolean
  endsAt: number
}

/**
 * 表示用の並び順（機能④診断C6）。
 * 終わったもの（気づいて片付けてほしいもの）を先頭に、続けて残りが少ない順に並べる。
 * 以前は起動順のままだったため、先に鳴るタイマーが最下段に来ることがあり、
 * 複数同時進行のときに毎回3つの数字を読み比べる必要があった。
 * 元の配列は書き換えず、新しい配列を返す（TimerProvider の状態は並べ替えない）。
 */
export function sortTimersForDisplay<T extends TimerOrderFields>(timers: readonly T[]): T[] {
  return [...timers].sort((a, b) => Number(b.done) - Number(a.done) || a.endsAt - b.endsAt)
}

/** 端末内に保存するタイマー1本分の形（TimerProvider の ActiveTimer と同じ） */
export interface StoredTimer {
  id: number
  key: string
  label: string
  doneLabel: string
  recipeId: number
  stepNumber: number
  endsAt: number
  totalSeconds: number
  done: boolean
  muted: boolean
  /** 自分で時間を決めて始めたタイマー（2026-08-03 実機FB②）。古い保存には無いので任意 */
  isCustom?: boolean
}

/** localStorage のキー */
export const TIMERS_STORAGE_KEY = 'uchirecipe:activeTimers'

/** 終了からこれ以上経ったタイマーは復元しない（翌日に古い「終わり」が並ばないようにする） */
export const RESTORE_GRACE_MS = 60 * 60 * 1000

/**
 * 保存しておいたタイマーを読み戻す（機能④診断C7）。
 * endsAt は絶対時刻なので、そのまま戻すだけで残り時間が正しく続く。
 * ・壊れた値・古い形式の行は黙って捨てる（読めない保存で起動できなくならないように）
 * ・終了からRESTORE_GRACE_MSより古いものは捨てる
 * ・既に終了時刻を過ぎている分は done で戻す（開いた瞬間にいきなりチャイムが鳴らないように）
 */
export function parseStoredTimers(raw: string | null | undefined, now: number): StoredTimer[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const restored: StoredTimer[] = []
  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue
    const t = item as Partial<StoredTimer>
    if (typeof t.id !== 'number' || typeof t.endsAt !== 'number') continue
    if (!Number.isFinite(t.id) || !Number.isFinite(t.endsAt)) continue
    if (t.endsAt <= now - RESTORE_GRACE_MS) continue
    restored.push({
      id: t.id,
      key: typeof t.key === 'string' ? t.key : `restored-${t.id}`,
      label: typeof t.label === 'string' ? t.label : ja.timer.customLabel,
      doneLabel: typeof t.doneLabel === 'string' ? t.doneLabel : ja.timer.done,
      recipeId: typeof t.recipeId === 'number' ? t.recipeId : 0,
      stepNumber: typeof t.stepNumber === 'number' ? t.stepNumber : 0,
      endsAt: t.endsAt,
      totalSeconds: typeof t.totalSeconds === 'number' ? t.totalSeconds : 0,
      done: t.endsAt <= now,
      muted: t.muted === true,
      // 印が無い古い保存は「手順のタイマー」として読み戻す（従来どおりの見た目に戻る）
      isCustom: t.isCustom === true,
    })
  }
  return restored
}
