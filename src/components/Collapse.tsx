import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
 *
 * ---------------------------------------------------------------------------
 * ■ なぜ「useLayoutEffect ＋ 寸法の読み取り」という形なのか（2026-08-19 便IC）
 *
 * 高さのアニメーションは「0fr のときの高さ」と「1fr のときの高さ」の2つが
 * **別々のタイミングでブラウザに計算される**ことで初めて起きる。
 * 同じタイミングにまとめて渡すと、ブラウザには最初から 1fr だったようにしか見えず、
 * アニメーションは一度も出ない。
 *
 * 元の作りは「中身を置く → 次のフレーム → その次のフレームで 1fr」と、
 * requestAnimationFrame を二重に予約して2つのタイミングを作っていた。
 * これは**予約が順番どおりに消化されることを当てにした形**で、実際には成り立たない:
 *
 *   ・requestAnimationFrame は「描き直しの直前」に呼ばれるだけで、
 *     2つの予約のあいだに描き直しが挟まる保証はない（機械が混むと連続で消化される）。
 *   ・中身をDOMに置くのは React の再描画で、これは予約より**後ろに回されることがある**。
 *
 * 実測（2026-08-19 便IC・設定「機種変更するときは」を押したとき。数字は ms）:
 *   4622.5 中身を置く指示（open の効果）
 *   4667.4 1つ目の予約
 *   4668.0 2つ目の予約 → 1fr へ
 *   4668.0 ★ここで初めて中身がDOMに入った（＝React の再描画が予約に追い越された）
 *   → 「0fr の中身」は一度も存在せず、いきなり 1fr で現れる＝アニメーションが出ない。
 *   この画面では毎回そうなっていた（動いて見えていた他の画面も、機械が混めば同じになる）。
 *
 * いまの形は予約を一切使わない。順番はすべて**同じ処理の中**で決まる:
 *
 *   ① useLayoutEffect（描き直しの前に必ず走る）で中身をDOMに置き、高さを 0fr にする。
 *   ② 次の useLayoutEffect で、その要素の寸法を**読む**。
 *      読むにはスタイルを計算しないと答えられないので、ブラウザはこの時点で
 *      「0fr のときの高さ」を確定させる＝アニメーションの**開始値**がここで決まる。
 *   ③ 同じ処理の続きで 1fr にする。開始値（0fr）と違う値なので、必ず 0→1 の変化として
 *      扱われ、220ms かけて伸びる。
 *
 * ②と③のあいだに他の予約が割り込む余地が無いので、機械がどれだけ混んでいても
 * 順番が入れ替わらない。これが「たまたま動く」形との違い。
 * （②の読み取りを消すと、①と③がひとまとめに計算されてアニメーションは出なくなる。
 *   見た目に何もしていないように見えるが、消してはいけない1行）
 * ---------------------------------------------------------------------------
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
  /** 高さを伸ばした状態か（開くときは一度 false で置いてから true にして 0fr→1fr を作る） */
  const [expanded, setExpanded] = useState(open)
  /** 開き切ったか。開き切るまでは中身をはみ出させない（伸びる途中に下がのぞかないように） */
  const [settled, setSettled] = useState(open)
  /** 高さを持つ箱そのもの。0fr の高さを確定させるためにここの寸法を読む */
  const rootRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  /** 初回描画では動かさない（画面を開いた瞬間に勝手にスクロールしないため） */
  const firstRender = useRef(true)
  /**
   * この「開いている状態」について、もう位置合わせを済ませたか（2026-08-10 便FD）。
   *
   * 直したバグ: 開いた状態で**現れた**折りたたみ（週タブの7日分のカードなど）も
   * 位置合わせを走らせていた。`firstRender` は高さのアニメーション側の効果にしか無く、
   * 下の位置合わせの効果は初回描画でも素通りしていたため、週タブに切り替えた瞬間・
   * 週を移動した瞬間に7か所が同時に「自分を画面へ入れて」と要求し、最後の1つ（7日目）に
   * 引っぱられてページが最下部近くまで飛んでいた（オーナー実機「下へスクロールする」）。
   *
   * 最初の値は `open`＝**開いた状態で現れたものは済み扱い**にして動かさない。
   * いったん閉じてから開き直したときだけ、その1回に限って位置を合わせる
   * （components/useRevealOnOpen.ts と同じ「false→trueのときだけ」の規則）。
   */
  const revealDone = useRef(open)

  // ①開閉の指示を受け取る。**描き直しより前に**中身を置く／取り除くところまで決める。
  //   useEffect（描き直しの後）だと、React の再描画が後ろへ回されて
  //   「0fr の中身」が存在しないまま開き切ることがあった（先頭の説明を参照）。
  useLayoutEffect(() => {
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
      // まず「中身はあるが高さ0」の状態を作る。1fr にするのは下の②が引き継ぐ
      setMounted(true)
      setExpanded(false)
      setSettled(false)
      return
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

  // ②「高さ0」を確定させてから 1fr にする。①で中身が置かれた直後（まだ描き直しの前）に走る。
  //   予約（requestAnimationFrame・setTimeout）を挟まないので、混んでいる機械でも
  //   順番が入れ替わらない。
  useLayoutEffect(() => {
    if (!open || !mounted || expanded) return
    const el = rootRef.current
    // ★消してはいけない1行: 寸法を読むと、ブラウザはその場でスタイルを計算する。
    //   これで「0fr のときの高さ」が確定し、アニメーションの開始値になる。
    if (el) el.getBoundingClientRect()
    // 箱が見つからないときもここで開く。アニメーションは出ないが、
    // 高さ0のまま止まって中身が見えなくなる（開いたのに何も出ない）ことだけは避ける
    setExpanded(true)
  }, [open, mounted, expanded])

  // 開き切った合図。ここで初めて「はみ出しの許可」と「画面内への送り」を行う
  useEffect(() => {
    if (!open || !expanded || settled) return
    const t = window.setTimeout(() => setSettled(true), OPEN_MS + 20)
    return () => window.clearTimeout(t)
  }, [open, expanded, settled])

  useEffect(() => {
    if (!open) {
      // 閉じたら「次に開いたときに1回だけ動かす」へ戻す
      revealDone.current = false
      return
    }
    if (!settled || revealDone.current) return
    // 位置合わせをしない指定（reveal=false）でも「この開閉は処理済み」にする＝
    // あとから reveal が true に変わっても、開いたときを過ぎてから動き出さない
    revealDone.current = true
    if (!reveal) return
    const el = innerRef.current
    if (el) revealExpanded(el)
  }, [open, settled, reveal])

  if (!mounted) return null

  const clip = settled ? '' : 'overflow-hidden'
  return (
    <div
      ref={rootRef}
      // data-collapse: 見張り（scripts/e2e-smoke.mjs）が折りたたみを掴むための目印。
      // クラス名や入れ子の段数で掴む書き方は、見た目を直すたびにテストだけが赤くなるので使わない
      data-collapse=""
      // grid-cols-[minmax(0,1fr)]: 列を「親の幅ちょうど・それ以上には広がらない」と明示する
      // （2026-08-09 便ET・本番不具合の修正）。列を書かないと暗黙の1列は auto 扱いになり、
      // 最小幅が中身の min-content になる＝折り返せない中身（献立の週タブの料理名カードや
      // 「＋料理を追加」）があると親より広い列ができ、ページごと横スクロールした
      // （390px幅で document.scrollWidth が 512〜529px。料理名・×・栄養行の右端が画面外へ）。
      // 折りたたみに入れる前は普通のブロックだったので幅は親いっぱいで頭打ちだった。
      // minmax(0,1fr) はその「ブロックと同じ幅の決まり方」をグリッドで言い直したもの。
      // 中身側に min-w-0 を足す直し方もあるが、幅の決まり方は列の性質なので、
      // 列を宣言しているこの要素で決める（34か所ある呼び出し側が中身の作りを気にせずに済む）。
      className={`grid grid-cols-[minmax(0,1fr)] transition-[grid-template-rows] ease-out motion-reduce:transition-none ${clip}`}
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
