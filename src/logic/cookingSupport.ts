/**
 * 「料理中」の設定（画面を暗くしない・タイマー音）が実際に働くかどうかの判定
 * （2026-08-04 便DV・オーナー指示6/7）。
 *
 * 3段階を区別する:
 *  ① ブラウザが機能自体を持っていない（非対応）… スイッチを入れても働かないので「対応していません」を出す
 *  ② 機能はあるが、ブラウザ・端末側の許可が下りていない … 許可の取り方を案内する
 *  ③ 使える … 注記は何も出さない（対応ブラウザに「対応ブラウザのみ」と書き続けない）
 */

/** 許可の状態。unknown＝まだ調べていない／調べようがない（このときは案内を出さない） */
export type CapabilityPermission = 'unknown' | 'granted' | 'blocked'

/**
 * 許可を促す案内を出すか（2026-08-04 便DV-7）。
 * スイッチがONで、ブラウザは対応していて、許可だけが下りていないときにだけ出す。
 * OFFのあいだや、許可が下りている間、調べられなかった間は出さない（常時出す注記にしない）。
 */
export function shouldShowPermissionHelp(
  switchOn: boolean,
  supported: boolean,
  permission: CapabilityPermission,
): boolean {
  return switchOn && supported && permission === 'blocked'
}

/**
 * 「対応していません」の注記を出すか（2026-08-04 便DV-6）。
 * 非対応のときだけ出す＝対応ブラウザでは注記そのものを出さない。
 */
export function shouldShowUnsupportedNote(supported: boolean): boolean {
  return !supported
}

/** Wake Lock API（画面の自動消灯を防ぐ）を持つブラウザか */
export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator
}

/** Web Audio（タイマー音）を持つブラウザか */
export function audioSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.AudioContext === 'function'
}

/**
 * Vibration API（タイマー終了時の振動）を持つブラウザか（2026-08-08 便DW・オーナー実機報告）。
 * iOS Safari は Vibration API を持たないため、iPhone では何をしても振動しない。
 * Android Chrome など対応ブラウザでは動くので、非対応のときだけ注記を出す
 * （wakeLockSupported と同じ出し分け＝shouldShowUnsupportedNote に渡す）。
 */
export function vibrationSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

/**
 * 画面をつけたままにする許可が下りているかを実際に試して確かめる。
 * 取得できたらすぐ解放するので、設定画面が画面を占有し続けることはない。
 * 低電力モード・タブが非表示のときなどは失敗する（＝許可が下りていない）。
 */
export async function probeWakeLockPermission(): Promise<CapabilityPermission> {
  if (!wakeLockSupported()) return 'unknown'
  try {
    const sentinel = await navigator.wakeLock.request('screen')
    await sentinel.release()
    return 'granted'
  } catch {
    return 'blocked'
  }
}

/**
 * 音を鳴らす許可が下りているかを確かめる。
 * ブラウザの自動再生の制限でサイトの音が止められていると、AudioContext が suspended のまま戻る。
 */
export async function probeAudioPermission(): Promise<CapabilityPermission> {
  if (!audioSupported()) return 'unknown'
  let ctx: AudioContext | undefined
  try {
    ctx = new AudioContext()
    if (ctx.state === 'suspended') await ctx.resume()
    return ctx.state === 'running' ? 'granted' : 'blocked'
  } catch {
    return 'blocked'
  } finally {
    void ctx?.close().catch(() => {})
  }
}
