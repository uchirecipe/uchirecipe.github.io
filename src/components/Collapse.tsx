import { useEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion, revealExpanded } from '../logic/revealExpanded'

/**
 * 折りたたみの中身を、高さのアニメーションで開閉する共通部品（2026-08-09 便EO）。
 *
 * オーナーの指摘（実機）: 「折りたたみを開くと下に書いてあった文字が開いた下に移動→
 * 見失って知らない画面にきたように感じる。ワンクッション操作の動きがあると見失わない」
 *
 * やっていること:
 *  1. 開くとき: 中身を置いてから高さを 0 →（中身の高さ）へ 220ms かけて伸ばす。
 *     下にあった文字は一瞬で飛ばず、押し出されていく様子を目で追える。
 *  2. 閉じるとき: 高さを 0 へ 160ms で縮めてから中身を取り除く。
 *     閉じる側を短くしたのは、戻る動きは待たされると鈍く感じるためと、
 *     畳んだ中身がDOMに残っている時間を最小限にするため。
 *  3. 開き切ってから、伸びた部分が画面の外にはみ出していれば画面内へ送る
 *     （`revealExpanded`）。伸びている最中に動かすと二重に動いて余計に見失うので、
 *     必ず**開き切ってから**行う。
 *  4. 動きを減らす設定（prefers-reduced-motion）のときはアニメーションを出さず、
 *     従来どおり即座に開閉する（位置合わせだけは一瞬で行う）。
 *
 * 高さの伸縮は `grid-template-rows: 0fr → 1fr` で行う。中身の高さを測って px を入れる方式と違い、
 * 中身が後から変わっても（画像の読み込み・文字の折り返し）ずれない。
 *
 * 閉じているあいだ中身はDOMに置かない（従来の `{open && ...}` と同じ）。
 * 畳んだ中身が読み上げソフトやページ内検索に残る状態を作らないため。
 */

/** 開くときの長さ（ms）。オーナー指定の目安200〜250msの中で、実機で目が追えた値 */
const OPEN_MS = 220
/** 閉じるときの長さ（ms） */
const CLOSE_MS = 160

type Props = {
  /** 開いているか */
  open: boolean
  /** 折りたたみの中身。閉じているあいだは描画しない */
  children: ReactNode
  /** 中身を包む箱に足すクラス（上の余白などはここに持たせる＝閉じているときは余白も消える） */
  className?: string
  /** トグルボタンの aria-controls から指すためのid */
  id?: string
  /**
   * 開き切ったあと、伸びた部分を画面内へ入れるか（既定: 入れる）。
   * すでに画面に収まっているときは何も動かさないので、基本は既定のままでよい。
   */
  reveal?: boolean
}

export default function Collapse({ open, children, className, id, reveal = true }: Props) {
  /** 中身をDOMに置いているか（閉じるアニメーションのあいだだけ open=false でも true） */
  const [mounted, setMounted] = useState(open)
  /** 高さを伸ばした状態か（開く1フレーム目だけ false にして 0fr→1fr の変化を作る） */
  const [expanded, setExpanded] = useState(open)
  /** 開き切ったか。開き切るまでは中身をはみ出させない（伸びる途中に下がのぞかないように） */
  const [settled, setSettled] = useState(open)
  const innerRef = useRef<HTMLDivElement>(null)
  /** 初回描画では動かさない（画面を開いた瞬間に勝手にスクロールしないため） */
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const reduced = prefersReducedMotion()

    if (open) {
      if (reduced) {
        // 中身を置くのと同時に開いた高さにする＝変化前の値が無いのでアニメーションは起きない
        setMounted(true)
        setExpanded(true)
        setSettled(true)
        return
      }
      setMounted(true)
      setExpanded(false)
      setSettled(false)
      // 中身を置いた次のフレームで 0fr→1fr にする（同じフレームだと変化とみなされない）
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setExpanded(true))
      })
      return () => {
        cancelAnimationFrame(raf1)
        cancelAnimationFrame(raf2)
      }
    }

    setSettled(false)
    setExpanded(false)
    if (reduced) {
      setMounted(false)
      return
    }
    const t = window.setTimeout(() => setMounted(false), CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [open])

  // 開き切った合図。ここで初めて「はみ出しの許可」と「画面内への送り」を行う
  useEffect(() => {
    if (!open || !expanded || settled) return
    const t = window.setTimeout(() => setSettled(true), OPEN_MS + 20)
    return () => window.clearTimeout(t)
  }, [open, expanded, settled])

  useEffect(() => {
    if (!open || !settled || !reveal) return
    const el = innerRef.current
    if (el) revealExpanded(el)
  }, [open, settled, reveal])

  if (!mounted) return null

  const clip = settled ? '' : 'overflow-hidden'
  return (
    <div
      className={`grid transition-[grid-template-rows] ease-out motion-reduce:transition-none ${clip}`}
      style={{
        gridTemplateRows: expanded ? '1fr' : '0fr',
        transitionDuration: `${open ? OPEN_MS : CLOSE_MS}ms`,
      }}
    >
      {/* min-h-0 が無いとグリッドの行が中身の高さより小さくならない（＝畳めない） */}
      <div ref={innerRef} id={id} className={`min-h-0 ${clip} ${className ?? ''}`}>
        {children}
      </div>
    </div>
  )
}
