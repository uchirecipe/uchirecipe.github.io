import { useEffect } from 'react'

/** 高さが足りるまで待つ上限（データが少ない画面では永遠に足りないため諦める） */
const RESTORE_MAX_FRAMES = 60

/**
 * 覚えていた縦スクロール位置まで戻す（2026-08-09 便EQ）。
 *
 * レシピ・献立・作った記録は liveQuery で後から届くので、描画直後は本文がまだ短く、
 * その時点で scrollTo しても指定の位置まで下がれない。ページの高さが足りるまで
 * 数フレーム待ってから1回だけ動かし、諦める上限も置く。
 * 献立の週タブが持っていた復元処理（2026-08-07 便DT-2）と同じ考え方を部品にしたもの。
 *
 * @param targetY 戻したい縦位置（null なら何もしない）
 * @param ready   その画面が復元してよい状態か（タブの切替が済んでいるか等）
 * @param onDone  戻し終えたときに呼ぶ（呼び出し側が targetY を null に戻す）
 */
export function useScrollRestore(targetY: number | null, ready: boolean, onDone: () => void): void {
  useEffect(() => {
    if (targetY == null || !ready) return
    let frames = 0
    let raf = 0
    const tick = () => {
      const reachable = document.documentElement.scrollHeight - window.innerHeight
      if (reachable >= targetY || frames >= RESTORE_MAX_FRAMES) {
        window.scrollTo(0, Math.min(targetY, Math.max(0, reachable)))
        onDone()
        return
      }
      frames++
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // onDone は毎回新しい関数になりうるが、1回動かして終わる処理なので依存に入れない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetY, ready])
}
