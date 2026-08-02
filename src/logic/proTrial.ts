/**
 * 恒常の「お試し」2種の純ロジック（2026-08-02 便CP-2・docs/62 決定③）。
 *
 * 期間限定キャンペーンではなく**恒常の仕組み**にする（正式ユーザーが0人の段階では
 * 「締切」は誰にも届かないため）。状態は端末内の設定（Settings）に持つだけで、
 * データ消去でリセットされる緩い鍵。解錠コードと同じく善良なユーザーを前提にし、
 * サーバー照合はしない（個人データを外に出さない方針も維持）。
 *
 *  1. 並行調理ナビ … 期限なしで COOK_NAVI_TRIAL_LIMIT 回まで。1回目は操作を覚えて終わることが
 *     多く、価値が分かるのは2〜3回目なので回数制にする（時限だと試す前に失効する）。
 *  2. 月間献立 … 本人の実データが入った本物の月タブを1回だけフル表示する。
 *     7日間トライアルにすると「空のカレンダー」というもっとも貧しい状態を見せてしまうため。
 *     同じ理由で、「作った記録」が MONTH_TRIAL_MIN_COOKED 件たまるまでは入口を出さない
 *     （2026-08-02 オーナー指摘。記録0件で1回きりのお試しを使い切る事故を防ぐ）。
 *
 * この層は数だけを扱う純関数に閉じる（保存はdb/settings.ts・表示はページ側）。
 */

/** 並行調理ナビのお試し回数（期限なし・端末内） */
export const COOK_NAVI_TRIAL_LIMIT = 3

/** 月間献立のお試し表示の回数（1回だけ） */
export const MONTH_TRIAL_LIMIT = 1

/**
 * 月間献立のお試しを出し始める「作った記録」の件数（2026-08-02 オーナー指摘）。
 *
 * お試しは「本人の実データが入った本物の月タブ」を見せる仕組みなので、記録が0〜数件の状態で
 * 使うと、1回きりのお試しを消費したのに空に近いカレンダーしか見えない。
 * 機能の価値ではなくデータの薄さを見せて終わることになるため、記録がこの件数たまるまでは
 * 入口を出さない（お試しを取り上げるのではなく、出す時期をずらすだけ）。
 */
export const MONTH_TRIAL_MIN_COOKED = 5

/**
 * 月間献立のお試しを出してよい状態か（「作った記録」が十分たまっているか）。
 * 記録が無い/少ない端末では false。負の数・未定義は0件として扱う。
 */
export function isMonthTrialReady(cookedCount: number | undefined): boolean {
  const count = Number.isFinite(cookedCount) && cookedCount != null ? cookedCount : 0
  return count >= MONTH_TRIAL_MIN_COOKED
}

/**
 * 並行調理ナビのお試しが「あと何回使えるか」。
 * 未設定（この項目導入前の既存ユーザーを含む）は0回使用として扱う。
 * 記録が上限を超えていても負の数は返さない（表示にそのまま使える値にする）。
 */
export function cookNaviTrialRemaining(used: number | undefined): number {
  const count = Number.isFinite(used) && used != null && used > 0 ? Math.floor(used) : 0
  return Math.max(0, COOK_NAVI_TRIAL_LIMIT - count)
}

/** 並行調理ナビのお試しをまだ使えるか（未解錠ユーザー向けの判定） */
export function canUseCookNaviTrial(used: number | undefined): boolean {
  return cookNaviTrialRemaining(used) > 0
}

/**
 * お試しを1回使ったあとの回数。上限を超えて増やさない
 * （何度押しても COOK_NAVI_TRIAL_LIMIT で止まる＝負債にならない）。
 */
export function consumeCookNaviTrial(used: number | undefined): number {
  const count = Number.isFinite(used) && used != null && used > 0 ? Math.floor(used) : 0
  return Math.min(COOK_NAVI_TRIAL_LIMIT, count + 1)
}

/** 並行調理ナビのお試しを使い切ったか（「お試しは終了しました」を出す判定） */
export function isCookNaviTrialExhausted(used: number | undefined): boolean {
  return cookNaviTrialRemaining(used) === 0
}

/** 月間献立のお試し表示をまだ使えるか（未設定＝まだ使っていない） */
export function canUseMonthTrial(used: boolean | undefined): boolean {
  return used !== true
}
