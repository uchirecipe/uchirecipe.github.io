import { useEffect, useRef } from 'react'

/** 積んだ履歴エントリを見分けるための連番（窓が重なっても取り違えないようにするため） */
let overlaySeq = 0

/**
 * 画面の上に重なる窓（レシピピッカー・テンプレの窓・日モーダル等）を、
 * Escapeキーと端末の「戻る」で閉じられるようにする共通フック（2026-07-30 便CH/C13）。
 *
 * 直った不具合: 便CB-1/CB-2で増えた重ね窓（ピッカー・テンプレ保存/流し込み）が
 * Escapeでも戻るでも閉じず、戻ると献立画面ごとレシピ一覧へ離脱していた
 * （月の表示位置＝何月を見ていたかも失われる）。日モーダルはEscapeだけ対応済みだった。
 *
 * 履歴の扱いは FocusMode.tsx（コミット a6aafcb・機能④診断C11）と同じ:
 *  ・開いている間だけ履歴を1つ積む
 *  ・戻る操作は積んだ1つを消費して「窓を閉じるだけ」に留める（ページは移動しない）
 *  ・✕やタップで自分から閉じたときは、積んだ履歴を自分で戻して残さない
 *
 * 窓が重なるのはこのページ特有（日モーダルの上にピッカー）なので、積むエントリに連番を入れて
 * 「今いる履歴が自分のエントリなら、まだ自分は閉じない」で判定する。これにより
 *  ・上の窓を閉じたとき、下の窓まで一緒に閉じる
 *  ・上の窓が自分で閉じたときの history.back() に下の窓が反応する
 * のどちらも起きない（1回の戻るで1枚だけ閉じる）。
 *
 * @param open その窓が開いているか
 * @param onClose 閉じる処理（毎回最新のものを呼ぶので、依存配列に入れなくてよい）
 */
export function useOverlayDismiss(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const myId = ++overlaySeq
    const currentOverlayId = () =>
      (window.history.state as { uchiOverlay?: number } | null)?.uchiOverlay
    // 自分のエントリが今の履歴なら、自分が一番上の窓（重なっているときは上の1枚だけが閉じる）
    const isTopMost = () => currentOverlayId() === myId
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopMost()) closeRef.current()
    }
    window.history.pushState({ uchiOverlay: myId }, '')
    window.addEventListener('keydown', onKey)
    const onPopState = () => {
      // 今いる履歴が自分のエントリなら、自分より上の窓が閉じただけ＝自分はまだ開いたまま
      if (isTopMost()) return
      // 戻る操作で履歴は既に消費済み。ここでは閉じるだけ（自分で history.back しない）
      closeRef.current()
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('popstate', onPopState)
      // 自分で閉じた場合だけ、積んだ履歴エントリを取り除く
      if (isTopMost()) window.history.back()
    }
  }, [open])
}
