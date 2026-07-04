/**
 * 空白・カンマ・読点区切りで複数の値をまとめて入力できるようにする共通の分割処理。
 * 在庫ボード・チップ入力・食材検索など、1行にまとめて入力する箇所すべてで使う。
 */
export function splitValues(input: string): string[] {
  return input
    .split(/[\s,、]+/u)
    .map((v) => v.trim())
    .filter(Boolean)
}
