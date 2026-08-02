import type { Recipe } from '../db/types'

/**
 * 無料版の登録件数制限。Pro販売手段の公開と同一リリースでtrueにする（それまでは寝かせる）。
 * ONにしても: 新規追加だけをブロックし、既存データの閲覧・編集・削除とバックアップ復元は
 * 絶対に制限しない（docs/08 2-4）。
 *
 * 2026-08-02 発売準備便DD: 買い切り版の発売と同一リリースで true にした（docs/08 §2 発売ゲート）。
 * ONで変わるのは「新規追加のブロック(50件)」と「予告バナー(40件〜)」だけ。isStarter=true の
 * 基本レシピは countFreeLimitRecipes で数えないので、同梱109品は上限に一切影響しない。
 */
export const FREE_LIMIT_ENABLED = true
export const FREE_LIMIT = 50
/**
 * 予告バナーを出し始める件数（2026-07-23 便BJ・docs/55 CEO提案「50件上限は40件あたりから
 * あと◯件を静かに表示する。突然壁に当てるのが一番心証が悪い」を受けて45→40に引き下げ）。
 */
export const FREE_LIMIT_WARNING_THRESHOLD = 40

/** 上限のカウント対象になる件数（isStarter=trueのスターター・配布セットは数えない） */
export function countFreeLimitRecipes(recipes: Recipe[]): number {
  return recipes.filter((r) => !r.isStarter).length
}

/** あと何件登録できるか（予告バナーの「あと◯件」表示用）。負にはならない */
export function freeLimitRemaining(count: number): number {
  return Math.max(0, FREE_LIMIT - count)
}

/**
 * 予告バナーを出す件数域か（FREE_LIMIT_ENABLEDフラグは考慮しない純粋判定）。
 * 「40件以上・50件未満で予告」という件数域の定義を、フラグの状態に関係なく
 * 単体テストで固定できるよう、フラグ判定と分離してある。
 */
export function isInWarningRange(count: number): boolean {
  return count >= FREE_LIMIT_WARNING_THRESHOLD && count < FREE_LIMIT
}

/** 新規追加をブロックすべきか（Pro解錠済みなら常にfalse） */
export function isAtFreeLimit(count: number, isPro: boolean): boolean {
  if (!FREE_LIMIT_ENABLED || isPro) return false
  return count >= FREE_LIMIT
}

/** 予告バナーを出すべきか（上限にはまだ達していないが近い） */
export function isNearFreeLimit(count: number, isPro: boolean): boolean {
  if (!FREE_LIMIT_ENABLED || isPro) return false
  return isInWarningRange(count)
}
