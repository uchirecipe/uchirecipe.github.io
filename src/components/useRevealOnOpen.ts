import { useEffect, useRef } from 'react'
import { revealExpanded } from '../logic/revealExpanded'

/**
 * 「押したら現れた領域」を、現れたあとで画面の中へ入れる共通フック（2026-08-09 便EO）。
 *
 * オーナー実機フィードバック③「編集ボタンを押しても編集画面が画面外に見切れてしまう」。
 * 折りたたみは `Collapse` が同じことを内蔵しているので、そちらでは要らない。
 * 折りたたみでない「押すと編集欄が生える」場所（作った記録の行内編集など）に使う。
 *
 * 使い方: `const ref = useRevealOnOpen(editing)` を書き、現れる領域そのものに `ref` を付ける。
 * 画面にすでに全部見えているときは何も動かさない。
 *
 * @param open その領域が出ているか。false→true に変わったときだけ位置を合わせる
 */
export function useRevealOnOpen<T extends HTMLElement = HTMLDivElement>(open: boolean) {
  const ref = useRef<T>(null)
  const wasOpen = useRef(open)

  useEffect(() => {
    const opened = open && !wasOpen.current
    wasOpen.current = open
    if (!opened) return
    // 現れた直後は高さが確定していないことがあるので、1フレーム待ってから測る
    const raf = requestAnimationFrame(() => {
      const el = ref.current
      if (el) revealExpanded(el)
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  return ref
}
