import type { TimerSoundLength, TimerSoundVolume } from '../db/types'

/**
 * タイマー終了音の音量と長さ（2026-08-08 オーナー実機フィードバック③
 * 「タイマー音量や長さは、設定から調整や確認できるようにしたい」）。
 *
 * 鳴らし方そのもの（Web Audioの組み立て）は components/TimerProvider.tsx にあり、
 * ここは「設定値 → 実際に使う数値」の対応表だけを持つ純ロジック
 * （scripts/test-logic.mjs で既定値＝従来の音のままであることを固定する）。
 *
 * 既定値は必ず従来と同じ音にする＝設定を触っていない既存ユーザーの音を勝手に変えない。
 * 従来の音: 880Hzの「ピ」を0.45秒間隔で3回・ピークの音量0.4。
 */

/** 音量の選択肢（表示順） */
export const TIMER_SOUND_VOLUMES: TimerSoundVolume[] = ['low', 'normal', 'high']

/** 鳴る長さの選択肢（表示順） */
export const TIMER_SOUND_LENGTHS: TimerSoundLength[] = ['short', 'medium', 'long']

/** 音を鳴らす間隔（秒）。1回あたりの長さの計算にも使う */
export const TIMER_BEEP_INTERVAL_SECONDS = 0.45

/**
 * ピークの音量（Web Audio の GainNode に渡す値）。
 * 'normal' は従来値の 0.4。小さめは半分以下、大きめは歪まない範囲で上げる。
 */
const VOLUME_GAIN: Record<TimerSoundVolume, number> = {
  low: 0.15,
  normal: 0.4,
  high: 0.9,
}

/** 「ピ」を鳴らす回数。'short' は従来値の3回 */
const LENGTH_BEEPS: Record<TimerSoundLength, number> = {
  short: 3,
  medium: 7,
  long: 11,
}

/** 設定値（未設定なら従来どおり）→ ピークの音量 */
export function timerSoundGain(volume?: TimerSoundVolume): number {
  return VOLUME_GAIN[volume ?? 'normal'] ?? VOLUME_GAIN.normal
}

/** 設定値（未設定なら従来どおり）→ 鳴らす回数 */
export function timerSoundBeepCount(length?: TimerSoundLength): number {
  return LENGTH_BEEPS[length ?? 'short'] ?? LENGTH_BEEPS.short
}

/**
 * 鳴っている時間のめやす（秒）。設定画面の選択肢の見出しに使う。
 * 最後の1回が鳴り終わるまでを数えるので「間隔×(回数-1)＋1回分の長さ(0.4秒)」。
 * 表示は小数点以下を丸めた整数（3回=約1秒／7回=約3秒／11回=約5秒）。
 */
export function timerSoundSeconds(length?: TimerSoundLength): number {
  const beeps = timerSoundBeepCount(length)
  return Math.round((beeps - 1) * TIMER_BEEP_INTERVAL_SECONDS + 0.4)
}
