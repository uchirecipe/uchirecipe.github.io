import type { Recipe } from '../db/types'

/**
 * 無料版の登録件数制限。Pro販売手段の公開と同一リリースでtrueにする（それまでは寝かせる）。
 * ONにしても: 新規追加だけをブロックし、既存データの閲覧・編集・削除とバックアップ復元は
 * 絶対に制限しない（docs/08 2-4）。
 *
 * 2026-08-02 発売準備便DD: Pro版の発売と同一リリースで true にした（docs/08 §2 発売ゲート）。
 * ONで変わるのは「新規追加のブロック」と「予告バナー」だけ。isStarter=true の
 * 基本レシピは countFreeLimitRecipes で数えないので、同梱109品は上限に一切影響しない。
 */
export const FREE_LIMIT_ENABLED = true
/**
 * 無料で登録できる件数（2026-08-08 オーナー決定・便DZ）。
 * 宣伝開始前に 50 → 30 へ変更した（配布するアンケートの記載に合わせ、アプリ・紹介ページ・
 * 使い方・お知らせを同一リリースで揃える）。数値を読み替えるのはこの定数1か所だけで、
 * 文言側は src/i18n/ja.ts と public/about/*.html が持つ。
 */
export const FREE_LIMIT = 30
/**
 * 予告を出す件数の節目（2026-08-08 オーナー指示・便DZ）。
 *
 * 旧仕様は「40件以上なら一覧を開くたびに常時表示」だったが、登録するたび・一覧を見るたびに
 * 同じ案内が出るのは煩わしい（オーナー指示「２０件目、２７件目、３０件目の登録完了時といった
 * 感じで」）。登録し終えた時点の件数がちょうどこの数のときだけ1回出し、閉じたら再表示しない。
 *
 * 20件目＝残り10件（買うか決める時間を長く取る）、27件目＝残り3件（そろそろ手を打つ合図）。
 * 30件目は予告ではなく上限到達の案内（FREE_LIMIT と同値なので、この配列には入れない）。
 */
export const FREE_LIMIT_NOTICE_COUNTS: readonly number[] = [20, 27]

/** 登録完了時に出す案内の種類。'near'＝あと◯件の予告 / 'reached'＝上限に達した案内 */
export type FreeLimitNotice = 'near' | 'reached'

/** 上限のカウント対象になる件数（isStarter=trueのスターター・配布セットは数えない） */
export function countFreeLimitRecipes(recipes: Recipe[]): number {
  return recipes.filter((r) => !r.isStarter).length
}

/** あと何件登録できるか（予告の「あと◯件」表示用）。負にはならない */
export function freeLimitRemaining(count: number): number {
  return Math.max(0, FREE_LIMIT - count)
}

/**
 * 登録し終えた時点の件数に対して出す案内（節目でなければ undefined＝何も出さない）。
 *
 * 「件数域に入っていれば出す」ではなく「節目とちょうど一致したときだけ出す」ので、
 * 21件・26件のような節目の次の登録では何も出ない。Pro解錠済み・フラグOFFでは常に出さない。
 * 保存した件数を settings.freeLimitNoticeCount に控えておき、表示側はこの関数に通してから出す
 * （後から解錠した人に古い予告が出ないよう、表示のたびに isPro で判定し直す）。
 */
export function freeLimitNoticeFor(
  count: number | undefined,
  isPro: boolean,
): FreeLimitNotice | undefined {
  if (!FREE_LIMIT_ENABLED || isPro) return undefined
  if (count === undefined || !Number.isFinite(count)) return undefined
  if (count === FREE_LIMIT) return 'reached'
  return FREE_LIMIT_NOTICE_COUNTS.includes(count) ? 'near' : undefined
}

/** 新規追加をブロックすべきか（Pro解錠済みなら常にfalse） */
export function isAtFreeLimit(count: number, isPro: boolean): boolean {
  if (!FREE_LIMIT_ENABLED || isPro) return false
  return count >= FREE_LIMIT
}
