import { useEffect } from 'react'

/**
 * 「いま中断されると困る作業をしている」ことを、画面をまたいで共有する小さな仕組み
 * (2026-08-09 便ER)。
 *
 * 使い道: アプリの更新のお知らせ(AppUpdateBanner)を、調理中モード・並行調理ナビの段取り実行中・
 * レシピの入力中には出さないため。更新そのものはボタンを押したときにしか起きないが、
 * 手が離せない場面で帯が出て誤タップを誘うのを避ける。
 *
 * 数え方: 対象の画面がマウントされている間だけ +1 する(useAppBusyWhileMounted)。
 * 複数が同時に開くこともある(調理中モードでタイマー調整の窓を開く等)ので、真偽値ではなく件数で持つ。
 */
let busyCount = 0
const listeners = new Set<() => void>()

function notifyBusyChanged(): void {
  for (const listener of listeners) listener()
}

/** いま「中断されると困る作業」が1つ以上あるか */
export function isAppBusy(): boolean {
  return busyCount > 0
}

/** 件数が変わったときに呼ばれる購読を登録する。戻り値を呼ぶと解除する */
export function subscribeAppBusy(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * この画面(コンポーネント)が表示されている間、「中断されると困る作業」として数える。
 * 使う側は先頭で呼ぶだけでよい。閉じる(アンマウント)と自動で数えなくなる。
 */
export function useAppBusyWhileMounted(): void {
  useEffect(() => {
    busyCount += 1
    notifyBusyChanged()
    return () => {
      busyCount -= 1
      notifyBusyChanged()
    }
  }, [])
}
