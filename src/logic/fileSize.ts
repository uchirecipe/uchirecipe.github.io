/**
 * ファイルの大きさの表し方（2026-08-15 便GV・オーナー実機「ファイルのサイズも書いてあると親切」）。
 *
 * 見積りではなく**実際に作ったデータのバイト数**を渡して使う。桁を選ぶ基準は
 * 「読んだ人が大きさの感覚をつかめること」だけで、正確な小数は要らないので
 * KBは整数・MBは小数第1位まで（1.0MBのような無意味な小数は出さない）。
 * 「約」などの言い回しは付けない（画面の文言は src/i18n/ja.ts が持つ）。
 */
export function formatFileSize(bytes: number): string {
  const safe = Math.max(0, Math.round(bytes))
  if (safe < 1024) return `${safe}B`
  if (safe < 1024 * 1024) return `${Math.round(safe / 1024)}KB`
  const mb = safe / (1024 * 1024)
  // 小数第1位まで。ちょうど1MBのような値で「1.0MB」と出さない
  return `${Math.round(mb * 10) / 10}MB`
}
