import { useEffect } from 'react'

/**
 * 窓（画面の上に重なるもの）が開いているあいだ、後ろの画面を動かなくする共通フック
 * （2026-08-16 便HE）。
 *
 * オーナー実機（iPhone SE2 / Safari）「窓内を縦にスクロールするつもりが、後ろの画面が
 * 動いてしまうことがあります」。便HEがWebKitで測ったところ、後ろの画面は2つの経路で動いていた:
 *  ① 窓の外側（暗い背景）の上で払うと、そのまま後ろの画面が送られる（375x667で400px送ると400px動いた）
 *  ② 窓の中を下端まで送ったあとさらに払うと、送りが後ろの画面へ移る
 *     （scroll chaining。600px送ると後ろが600px動いた）
 * ②は各スクロール箱の `overscroll-contain` で止める。①はこのフックで止める。
 * どちらも直さないと、閉じたときに開く前と違う場所へ着地する（実測で 400 → 1400 になった）。
 *
 * ■ なぜ本体（body）を固定するのか
 * `overflow: hidden` だけでは iOS Safari は後ろの画面を送れてしまう（実装上の既知の差）。
 * 確実に止まるのは body を `position: fixed` にする形だけ。
 *
 * ■ 「閉じたら先頭に飛ぶ」を起こさないための担保
 * body を固定した瞬間、ブラウザから見た画面の位置は 0 になる。そのままだと閉じたときに
 * 一覧の先頭へ飛ぶので、
 *  ・固定する直前の位置を控え、`top: -位置px` を当てて**見た目を1pxも動かさない**
 *  ・閉じるときに控えた位置へ `scrollTo` で戻す
 * の2つで元いた場所に戻す。ただし窓を開いているあいだに**別の画面へ移った**ときは戻さない
 * （移った先の画面を勝手に送ってしまうため）。移ったかどうかは URL の # で見分ける
 * （このアプリは HashRouter。窓が積む履歴は # を変えないので、窓の開閉では変わらない）。
 *
 * ■ 窓が重なっても壊れないこと
 * 全画面の調理中モード（CookSessionOverlay / FocusMode）の上に確認の窓が重なる、
 * 献立の日の窓の上にレシピピッカーが重なる、といった重なりがあるので、
 * **開いている窓の数を数えて**、最初の1枚で固定し、最後の1枚が閉じたときだけ元に戻す。
 * 二重に固定して二重に戻すことは起きない。
 *
 * ■ 使い方
 *   useScrollLock(open)            // open のときだけ効く
 *   useScrollLock(true)            // 開いているあいだだけ描かれる窓
 * 見た目には何も足さない（クラス名も要素も増やさない）ので、位置・幅は変わらない。
 */

/** いま開いている窓の数（重なりのぶんだけ増える） */
let lockCount = 0

/** 固定する前の状態。最後の1枚が閉じたときにここへ戻す */
let savedState: {
  scrollY: number
  hash: string
  bodyPosition: string
  bodyTop: string
  bodyLeft: string
  bodyWidth: string
  bodyOverflow: string
  htmlOverflow: string
} | null = null

/**
 * 後ろの画面を止める。**通常は下の `useScrollLock` を使う**。
 * 直接呼んでよいのは、閉じるときの `releaseScrollLock` と対になることを自分で保証できるときだけ
 * （数え忘れると後ろの画面が止まったままになる）。
 */
export function acquireScrollLock(): void {
  lockCount++
  if (lockCount > 1) return // すでに別の窓が固定している（重なった窓は数えるだけ）
  const { body, documentElement: html } = document
  const scrollY = window.scrollY
  // 固定すると縦の並びが消えるぶん、横幅が広がることがある（PCの縦スクロールバーぶん）。
  // 固定する前の幅をそのまま当てて、中身の折り返し位置が動かないようにする
  const width = html.clientWidth
  savedState = {
    scrollY,
    hash: window.location.hash,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyWidth: body.style.width,
    bodyOverflow: body.style.overflow,
    htmlOverflow: html.style.overflow,
  }
  body.style.position = 'fixed'
  body.style.top = `${-scrollY}px`
  body.style.left = '0'
  body.style.width = `${width}px`
  body.style.overflow = 'hidden'
  html.style.overflow = 'hidden'
}

/** 後ろの画面の固定を1枚ぶん外す（最後の1枚なら元の位置へ戻す）。`acquireScrollLock` と対で使う */
export function releaseScrollLock(): void {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || savedState === null) return
  const { body, documentElement: html } = document
  const saved = savedState
  savedState = null
  body.style.position = saved.bodyPosition
  body.style.top = saved.bodyTop
  body.style.left = saved.bodyLeft
  body.style.width = saved.bodyWidth
  body.style.overflow = saved.bodyOverflow
  html.style.overflow = saved.htmlOverflow
  // 元いた場所へ戻す。別の画面へ移っていたら、その画面の位置には触らない
  if (window.location.hash === saved.hash) window.scrollTo(0, saved.scrollY)
}

export function useScrollLock(open: boolean): void {
  useEffect(() => {
    if (!open) return
    acquireScrollLock()
    return releaseScrollLock
  }, [open])
}

/** いま何枚の窓が後ろの画面を止めているか（検証用） */
export function scrollLockDepth(): number {
  return lockCount
}
