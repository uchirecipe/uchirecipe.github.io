/**
 * 参照元URLの検証（2026-07-28 便BW/C-19）。
 *
 * 実機QAで「javascript:alert(1)」や「これはURLではない」がそのまま保存でき、詳細ページに
 * 押しても何も起きない「参照元」リンクが出ることが分かったため、保存前の指摘と詳細ページの
 * リンク化の両方でこの判定を使う（http / https のみリンクとして扱う）。
 *
 * 保存済みデータは書き換えない: 判定に外れた文字列は「リンクにしない」だけで、
 * 詳細ページでは文字としてそのまま見えるようにする（勝手に消さない）。
 */
export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}
