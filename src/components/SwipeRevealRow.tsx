import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'

/**
 * 行を左へ払うと、右から操作のボタンが出る器（2026-08-21 便IQ）。
 *
 * オーナー原文: 「横にスワイプして消せるのが楽なんですけどね。」
 *
 * **払い切っただけでは何も起きない**。出たボタンを押して初めて実行する。
 * 滑らせただけで消えることが原理的に起きない形にしてある（払う量の「しきい値」を
 * 実行の合図に使わないので、端末ごとの指の滑り方の違いで結果が変わらない）。
 *
 * 向きと起点の決め:
 * ・ブラウザ（iOSのSafari・Chromeとも）が取るのは**左端から右へ**の払い＝「戻る」。
 *   これはWebページ側からは検知も無効化もできない（2026-08-21 オーナーが実機で確認)。
 * ・こちらが使うのは**行の途中から左へ**の払い。**向きも起点も違うのでぶつからない**
 *   （iPhoneのメール・リマインダーと同じ形）。
 * ・それでも取り合いにならないよう、**起点が画面の左端 SWIPE_BACK_EDGE_PX 以内の指は
 *   最初から掴まない**＝ブラウザの「戻る」に譲る。
 *
 * 縦の指を奪わないための決め:
 * ・中身に `touch-action: pan-y pinch-zoom` を敷く＝**縦のスクロールと拡大縮小は
 *   ブラウザがそのまま受け持つ**。横に動いたぶんだけがこちらへ届く。
 * ・指を置いた直後は向きを決めずに待ち、AXIS_SLOP px 動いた時点で縦横のどちらが
 *   大きいかで決める。**縦が勝ったらその指は最後まで掴まない**。
 *
 * 払う操作しか無い形にはしない: 同じことは読み上げ・キーボードからも届く場所
 * （今日の献立なら「整理」の中の×）に必ず残す。ここのボタンは、開いているあいだだけ
 * 出す＝閉じているときは読み上げの順路にも入らない。
 */

/**
 * ブラウザの「戻る」に譲る左端の幅（px）。
 * iOSの端からの戻るジェスチャーは画面の左 0〜30px から始まる。
 * 今日の献立の行は左端 x=33px から始まるので、この幅を捨てても行の上で払える。
 */
export const SWIPE_BACK_EDGE_PX = 30
/** 出てくるボタンの幅（px）。44px（--tap-min）を大きく上回る */
export const SWIPE_ACTION_WIDTH = 88
/** 縦か横かを決めるまでの遊び（px）。ここまでは何も掴まない */
const AXIS_SLOP = 8

export function SwipeRevealRow({
  open,
  onOpenChange,
  actionLabel,
  actionAriaLabel,
  onAction,
  actionTestId,
  testId,
  children,
}: {
  /** いまこの行がボタンを出しているか（同時に1行だけ開くので、開いている行は呼び出し側が持つ） */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ボタンに出す文字 */
  actionLabel: string
  /**
   * ボタンの読み上げ名。同じ形のボタンでも結果が違う場所があるので、呼び出し側が分ける
   * （今日の献立なら「この献立から外す」と「今日と今週の献立から外す」）。
   */
  actionAriaLabel?: string
  onAction: () => void
  actionTestId?: string
  testId?: string
  children: ReactNode
}) {
  /** 指で動かしている途中のずれ（0 か負の値） */
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragXRef = useRef(0)
  const startRef = useRef<{ x: number; y: number; axis: 'x' | 'y' | null; base: number } | null>(
    null,
  )
  /** 直前の指が横に動いたか（動いていたら、その指の終わりのタップは行の押下に渡さない） */
  const movedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  /** 開いているかを、付けっぱなしの見張りから読むための控え（描き直しのたびに写す） */
  const openRef = useRef(open)
  const onOpenChangeRef = useRef(onOpenChange)
  useEffect(() => {
    openRef.current = open
    onOpenChangeRef.current = onOpenChange
  })
  /** 開いているときに外を触った1回のタップは、閉じるだけに使い切る */
  const swallowRef = useRef(false)

  // 他の行（や画面のどこか）を触ったら閉じる。
  // **その1回のタップは閉じるだけに使い、下にあるものへ渡さない**＝閉じるつもりのタップで
  // 別のレシピが開いてしまうことがない（RecipesPage の並び替え/絞り込みの窓と同じ作法）。
  // 見張りは開いている間だけでなく**付けっぱなし**にする。閉じた瞬間に外すと、
  // その直後に飛んでくるタップを受け止める相手がいなくなる。
  useEffect(() => {
    const isOutside = (target: EventTarget | null) =>
      target instanceof Node ? !rootRef.current?.contains(target) : false
    const onDocPointerDown = (e: PointerEvent) => {
      if (!openRef.current || !isOutside(e.target)) {
        swallowRef.current = false
        return
      }
      swallowRef.current = true
      onOpenChangeRef.current(false)
    }
    const onDocClickCapture = (e: MouseEvent) => {
      if (!swallowRef.current) return
      swallowRef.current = false
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('pointerdown', onDocPointerDown, true)
    document.addEventListener('click', onDocClickCapture, true)
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown, true)
      document.removeEventListener('click', onDocClickCapture, true)
      swallowRef.current = false
    }
  }, [])

  // 画面を離れたら閉じる（払ったまま別のアプリ・別のタブへ行って戻ったとき、
  // 出しっぱなしのボタンが最初の1タップを奪わないようにする）
  useEffect(() => {
    if (!open) return
    const close = () => onOpenChange(false)
    document.addEventListener('visibilitychange', close)
    window.addEventListener('pagehide', close)
    return () => {
      document.removeEventListener('visibilitychange', close)
      window.removeEventListener('pagehide', close)
    }
  }, [open, onOpenChange])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    movedRef.current = false
    startRef.current = null
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // 起点が左端なら何も掴まない＝ブラウザの「戻る」に譲る
    if (e.clientX <= SWIPE_BACK_EDGE_PX) return
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      axis: null,
      base: open ? -SWIPE_ACTION_WIDTH : 0,
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const start = startRef.current
    if (!start) return
    const dx = e.clientX - start.x
    const dy = e.clientY - start.y
    if (start.axis === null) {
      if (Math.abs(dx) < AXIS_SLOP && Math.abs(dy) < AXIS_SLOP) return
      // 縦のほうが大きい＝一覧をスクロールする指。最後まで掴まない
      if (Math.abs(dy) >= Math.abs(dx)) {
        startRef.current = null
        return
      }
      start.axis = 'x'
      setDragging(true)
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        // 掴めない環境でも、要素の上で動かしているあいだは動きが届く
      }
    }
    movedRef.current = true
    const next = Math.min(0, Math.max(-SWIPE_ACTION_WIDTH, start.base + dx))
    dragXRef.current = next
    setDragX(next)
  }

  /**
   * 指を離したときの落とし所。**払い切ったかどうかは「開くか閉じるか」だけに使い、
   * 外すかどうかには使わない**（押して初めて外れる）。
   */
  const finish = (commit: boolean) => {
    const start = startRef.current
    startRef.current = null
    setDragging(false)
    setDragX(0)
    const wasX = start?.axis === 'x'
    const moved = dragXRef.current
    dragXRef.current = 0
    if (!wasX) return
    onOpenChange(commit ? moved <= -SWIPE_ACTION_WIDTH / 2 : open)
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    // 払ったあとに続けて飛んでくるタップは、行の押下（レシピ詳細へ）に渡さない
    if (movedRef.current) {
      movedRef.current = false
      e.preventDefault()
      e.stopPropagation()
      return
    }
    // 開いているときに行そのものを触ったら、閉じるだけに使う
    if (open) {
      e.preventDefault()
      e.stopPropagation()
      onOpenChange(false)
    }
  }

  const offset = dragging ? dragX : open ? -SWIPE_ACTION_WIDTH : 0

  return (
    /* 角丸は中身のカードと**同じトークン**にする（2026-08-23 便JP・①）。
       オーナー実機「今日の献立のレシピカードの角が消えています。」の原因はここだった。
       この器は払った行を切り取る（overflow-hidden）ので、器のほうが丸いと、中のカードの
       角＝1pxの線が弧の外へ出て消える。実測（3倍で撮り、角から斜め45度）:
       レシピ一覧のカードは上辺2px・左辺1px・斜め0.67pxで線が出るのに、今日の献立の行は
       上辺10px・左辺10px・斜め10pxまで何も出ていなかった（線が角のまわり約11pxぶん欠けていた）。
       2026-08-21 便IQ でこの器を足したときは rounded-md（14px）で、翌日の便JEが並ぶカードを
       --radius-card（4px）にしたときに、この器だけ一緒に直っていなかった。
       見張りは scripts/test-logic.mjs の JP-1 と scripts/e2e-smoke.mjs の JPCARD-01 */
    <div ref={rootRef} data-testid={testId} className="relative overflow-hidden rounded-card">
      {(open || dragging) && (
        <div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ width: SWIPE_ACTION_WIDTH }}
        >
          <button
            type="button"
            data-testid={actionTestId}
            aria-label={actionAriaLabel}
            onClick={() => {
              onOpenChange(false)
              onAction()
            }}
            className="tap-target flex min-h-11 w-full items-center justify-center rounded-md bg-warning font-bold text-app"
          >
            {actionLabel}
          </button>
        </div>
      )}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => finish(true)}
        onPointerCancel={() => finish(false)}
        /* 行の中にはレシピへのリンクと写真があり、どちらもブラウザが「つまんで運ぶもの」として
           扱う。押したまま横へ動かすと運ぶ動作が始まり、その瞬間に指の追跡が打ち切られる
           （pointercancel）＝払いが1回も成立しない。実測で確かめた並びは
           pointerdown → pointermove → dragstart → pointercancel。
           運ぶ動作を断ると打ち切りも起きない。指の操作では起きないが、パソコンのマウスでは必ず起きる */
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={onClickCapture}
        style={{
          // 縦のスクロールと拡大縮小はブラウザに任せる（横だけこちらへ届く）
          touchAction: 'pan-y pinch-zoom',
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 150ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
