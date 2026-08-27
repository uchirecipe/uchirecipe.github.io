import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { settingsLinkWithBack } from '../logic/backLink'
import {
  SCREEN_RETURN_KEY,
  WEEK_RETURN_PARAM,
  parseScreenReturn,
  readSessionItem,
  removeSessionItem,
  serializeScreenReturn,
  withScreenReturnParam,
  writeSessionItem,
} from '../logic/navMemory'

/**
 * 「Pro版について見る」などで設定へ寄り道して、**元の画面の同じ場所へ帰ってくる**ための道具
 * （2026-08-27 便LU）。覚える形と読み方の規則は logic/navMemory.ts（純ロジック）が持ち、
 * ここは React の側（いつ覚えるか・いつ戻すか）だけを受け持つ。
 *
 * 献立のように「どのタブの・どの週の・どのカードを見ていたか」を専用に覚える仕組みを
 * すでに持つ画面はそちらを使う。ここを使うのは、縦位置と折りたたみだけで元どおりになる画面。
 */

/**
 * 設定へ寄り道する側（リンクを出す側）。どの画面・どの部品からでも呼べる。
 *
 * - `linkTo(settingsPath)` … `?back=` に**印つきの現在地**を載せた行き先を作る
 * - `remember(openPanels)` … 押した瞬間の縦位置と、開いている折りたたみを覚える
 */
export function useSettingsDetour() {
  const location = useLocation()
  const from = location.pathname + location.search

  const linkTo = useCallback(
    (settingsPath: string) => settingsLinkWithBack(settingsPath, withScreenReturnParam(from)),
    [from],
  )

  /**
   * 離れる直前の居場所を覚える。
   *
   * @param openPanels 開いている折りたたみの名前（SCREEN_PANEL）
   * @param scrollY 縦位置。窓を開いて後ろの画面を固定しているあいだは `window.scrollY` が
   *   0 になるので、固定する前に控えた位置を渡せるようにしてある
   */
  const remember = useCallback(
    (openPanels: string[] = [], scrollY: number = window.scrollY) => {
      writeSessionItem(
        SCREEN_RETURN_KEY,
        serializeScreenReturn({ path: location.pathname, scrollY, openPanels }),
      )
    },
    [location.pathname],
  )

  return { linkTo, remember }
}

/** 覚えた場所へ戻す側の返り値 */
export interface ScreenReturn {
  /** 離れたときにその折りたたみが開いていたか（最初の描画から答えられる） */
  wasOpen: (panel: string) => boolean
}

/**
 * 設定から帰ってきた画面の側。**画面ごとに1回だけ**呼ぶ（同じ画面で2回呼ぶと二重に戻す）。
 *
 * `?restore=1` が付いていて、覚えた画面と帰り着いた画面が同じときだけ働く。
 * 覚えは読んだ時点で捨て、印もURLから消す＝次にこの画面を素で開いたときは何も起きない。
 *
 * 縦位置を戻すのは**ページの高さが落ち着いてから**（禁じ手⑤）。レシピ・献立・記録は
 * 後から届くので、描画直後に戻しても本文が短くて指定の位置まで下がれない。
 */
export function useScreenReturn(): ScreenReturn {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  /**
   * 覚えを読むのは**最初の描画のとき1回だけ**。折りたたみは最初の描画で開いた形にしたいので、
   * 効果（useEffect）ではなく状態の初期値として読む。捨てるのは下の効果で行う
   * （初期値の計算はやり直されることがあるので、そこで消すと2回目に読めなくなる）。
   */
  const [point] = useState(() =>
    searchParams.get(WEEK_RETURN_PARAM) === '1'
      ? parseScreenReturn(readSessionItem(SCREEN_RETURN_KEY), location.pathname)
      : null,
  )
  const [pendingScrollY, setPendingScrollY] = useState<number | null>(point?.scrollY ?? null)
  const consumedRef = useRef(false)

  useEffect(() => {
    if (consumedRef.current) return
    consumedRef.current = true
    if (searchParams.get(WEEK_RETURN_PARAM) !== '1') return
    removeSessionItem(SCREEN_RETURN_KEY)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(WEEK_RETURN_PARAM)
        return next
      },
      { replace: true },
    )
    // 画面に着いた直後の1回だけ（consumedRef）。消した印をもう一度読ませない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, setSearchParams])

  /**
   * 覚えていた縦位置まで戻す（献立の週タブが使っているのと同じ待ち方）。
   * 高さが数フレーム変わらなくなってから1回だけ動かし、諦める上限も置く
   * （データが少ない画面では、覚えた位置まで永遠に伸びないため）。
   */
  useEffect(() => {
    if (pendingScrollY == null) return
    if (pendingScrollY === 0) {
      setPendingScrollY(null)
      return
    }
    const RESTORE_MAX_FRAMES = 60
    const RESTORE_STABLE_FRAMES = 3
    let frames = 0
    let lastHeight = -1
    let stable = 0
    let raf = 0
    const tick = () => {
      const height = document.documentElement.scrollHeight
      stable = height === lastHeight ? stable + 1 : 0
      lastHeight = height
      const reachable = height - window.innerHeight
      if ((stable >= RESTORE_STABLE_FRAMES && reachable >= pendingScrollY) || frames >= RESTORE_MAX_FRAMES) {
        window.scrollTo(0, Math.min(pendingScrollY, Math.max(0, reachable)))
        setPendingScrollY(null)
        return
      }
      frames++
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [pendingScrollY])

  const wasOpen = useCallback(
    (panel: string) => point?.openPanels?.includes(panel) === true,
    [point],
  )

  return { wasOpen }
}
