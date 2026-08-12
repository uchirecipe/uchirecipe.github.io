// タイマーの「表示順」と「端末内保存の読み書き」の純ロジック（2026-07-28 機能④診断C6/C7）。
// Reactに依存しない純粋関数にして、scripts/test-logic.mjs から直接検証できるようにしてある。
import { ja } from '../i18n/ja'

/** 並べ替えに必要な最小限の形（ActiveTimer はこれを満たす） */
export interface TimerOrderFields {
  done: boolean
  endsAt: number
  /** 一時停止中の残り（ミリ秒）。2026-08-10 便EZ。値が入っている間は時計が止まっている */
  pausedRemainingMs?: number
}

/**
 * 表示用の並び順（機能④診断C6）。
 * 終わったもの（気づいて片付けてほしいもの）を先頭に、続けて残りが少ない順に並べる。
 * 以前は起動順のままだったため、先に鳴るタイマーが最下段に来ることがあり、
 * 複数同時進行のときに毎回3つの数字を読み比べる必要があった。
 * 元の配列は書き換えず、新しい配列を返す（TimerProvider の状態は並べ替えない）。
 *
 * 2026-08-10 便EZ: 一時停止中のものは動いているものより後ろに置く。止まっている以上
 * もう鳴らないので、「次に鳴る順」に読みたい列の途中に混ざると読み違えるため。
 */
export function sortTimersForDisplay<T extends TimerOrderFields>(timers: readonly T[]): T[] {
  return [...timers].sort(
    (a, b) =>
      Number(b.done) - Number(a.done) ||
      Number(a.pausedRemainingMs != null) - Number(b.pausedRemainingMs != null) ||
      a.endsAt - b.endsAt,
  )
}

/**
 * 画面に出す残り秒数（2026-08-10 便EZ）。
 * 一時停止中は時計を止めるので、`endsAt` からの引き算ではなく止めた時点の残りを返す。
 * 動作中は従来どおり終了予定時刻までの差。0未満にはしない（終わった行は「終わり」を出すため）。
 */
export function timerRemainingSeconds(
  timer: { endsAt: number; pausedRemainingMs?: number },
  now: number,
): number {
  const ms = timer.pausedRemainingMs ?? timer.endsAt - now
  return Math.max(0, Math.ceil(ms / 1000))
}

/**
 * 手順のタイマーの重複防止キー（レシピ・手順・長さが同じなら同じキー＝二重に立たない）。
 * レシピ詳細・調理中モード・並行調理ナビが同じ形で作るので、1か所に集約してある。
 */
export function stepTimerKey(recipeId: number, stepIndex: number, seconds: number): string {
  return `${recipeId}-${stepIndex}-${seconds}`
}

/**
 * その手順のタイマーが**いま動いているか**を返す（2026-08-12 便FS-5・利用者テスト
 * 「タイマーが動いていても、手順の中のボタンが『タイマーを始める』のまま。
 * もう一度押しても何も起きない」）。
 *
 * 長さはキーの末尾に入る（同じ手順でも本文の時間表記から始めると別の長さになりうる）ので、
 * **レシピと手順まで**を突き合わせる。鳴り終わったタイマーは含めない
 * ＝終わったあとは「タイマーを始める」に戻り、もう一度はかり直せる。
 */
export function findRunningStepTimer<T extends { key: string; done: boolean }>(
  timers: readonly T[],
  recipeId: number,
  stepIndex: number,
): T | undefined {
  const prefix = `${recipeId}-${stepIndex}-`
  return timers.find((t) => !t.done && t.key.startsWith(prefix))
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
  /** 並行調理ナビから始めたタイマー（2026-08-08 便ED）。戻り先をナビの手順にするために持つ */
  fromNavi?: boolean
  /** ナビのレシピ色の添字（0,1,2）。常駐バーの左端の色に使う */
  naviColorIndex?: number
  /** ナビの段取りでの通し番号（2026-08-09 便EH）。常駐バーの番号バッジに出す */
  naviOrder?: number
  /** そのレシピ内での手順番号の表示（「3」「3-1」。2026-08-09 便ES）。段取りの番号と並べて出す */
  naviStepLabel?: string
  /**
   * 一時停止中の残り（ミリ秒。2026-08-10 便EZ）。
   * 声の「ストップ」で止められる。`endsAt` は止めた時点の終了予定時刻のまま据え置くので、
   * 「終了から1時間より古いものは捨てる」の判定はそのまま働く（止めたまま放置した分は消える）。
   */
  pausedRemainingMs?: number
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
    // 一時停止中の残り（2026-08-10 便EZ）。0以下・数値でないものは「止まっていない」に倒す
    const pausedRemainingMs =
      typeof t.pausedRemainingMs === 'number' &&
      Number.isFinite(t.pausedRemainingMs) &&
      t.pausedRemainingMs > 0
        ? t.pausedRemainingMs
        : undefined
    restored.push({
      id: t.id,
      key: typeof t.key === 'string' ? t.key : `restored-${t.id}`,
      label: typeof t.label === 'string' ? t.label : ja.timer.customLabel,
      doneLabel: typeof t.doneLabel === 'string' ? t.doneLabel : ja.timer.done,
      recipeId: typeof t.recipeId === 'number' ? t.recipeId : 0,
      stepNumber: typeof t.stepNumber === 'number' ? t.stepNumber : 0,
      // 一時停止中は時計が止まっているので、読み戻した時点から残りぶんを数え直す。
      // 据え置いた endsAt をそのまま使うと、止めていた間の経過ぶんだけ勝手に進んでしまう
      endsAt: pausedRemainingMs != null ? now + pausedRemainingMs : t.endsAt,
      totalSeconds: typeof t.totalSeconds === 'number' ? t.totalSeconds : 0,
      // 止まっているタイマーは、いくら時間が経っていても「終わり」にはしない
      done: pausedRemainingMs != null ? false : t.endsAt <= now,
      muted: t.muted === true,
      pausedRemainingMs,
      // 印が無い古い保存は「手順のタイマー」として読み戻す（従来どおりの見た目に戻る）
      isCustom: t.isCustom === true,
      // ナビ由来の印と色（古い保存には無い＝従来どおりレシピ詳細へ戻る・色は付かない）
      fromNavi: t.fromNavi === true,
      naviColorIndex:
        typeof t.naviColorIndex === 'number' && Number.isFinite(t.naviColorIndex)
          ? t.naviColorIndex
          : undefined,
      // 通し番号が無い古い保存は、従来どおりレシピ内の手順番号を出す
      naviOrder:
        typeof t.naviOrder === 'number' && Number.isFinite(t.naviOrder) && t.naviOrder > 0
          ? t.naviOrder
          : undefined,
      // レシピ内の手順番号の表示。古い保存には無いので、そのときは stepNumber から作り直す
      naviStepLabel:
        typeof t.naviStepLabel === 'string' && t.naviStepLabel !== ''
          ? t.naviStepLabel
          : undefined,
    })
  }
  return restored
}
