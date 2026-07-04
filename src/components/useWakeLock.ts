import { useEffect, useRef } from 'react'

/**
 * enabled の間、画面の自動消灯を防ぐ（Wake Lock API。非対応ブラウザでは何もしない）。
 * onResume は、他アプリ等から画面に戻ってきた瞬間に呼ばれる（時計の再同期などに使う）。
 */
export function useWakeLock(enabled: boolean, onResume?: () => void): void {
  const onResumeRef = useRef(onResume)
  useEffect(() => {
    onResumeRef.current = onResume
  }, [onResume])

  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let released = false
    const acquire = async () => {
      try {
        sentinel = await navigator.wakeLock.request('screen')
      } catch {
        /* 非対応・省電力モードなどで失敗したら静かに無視 */
      }
    }
    // 他アプリから戻ってきたときに取得し直す
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !released) {
        void acquire()
        onResumeRef.current?.()
      }
    }
    void acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      released = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [enabled])
}
