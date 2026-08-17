import { ja } from '../i18n/ja'

/**
 * 「設定画面へ飛ばされたあと、元のページへ帰る」ための戻り先の受け渡し
 * （2026-08-02 オーナー指示・便DF）。
 *
 * 各ページのPro版の説明・注意書きから設定の該当欄へ飛べる導線（例: レシピ一覧の
 * 「たんぱく質・塩分・脂質・糖質で探す（Pro機能）」→ /settings?section=pro）は、
 * 着いた先の設定画面に帰り道が無く、下部のタブで別のタブへ移るしかなかった。
 * 呼び出し側が ?back= に自分のパスを載せ、設定画面がそれを読んで戻るボタンを出す。
 * 受け渡し方は月間サンプルデモ（/month-demo?back=…・2026-08-02 便DC）と同じ作法にそろえている。
 *
 * ここは純ロジック（scripts/test-logic.mjs で固定する）。画面名の文言は src/i18n/ja.ts が持つ。
 */

/**
 * 戻り先として受け付けるアプリ内のページ。判定はパスの先頭一致で行う。
 *
 * 2026-08-17 便HG: ホーム画面の廃止で「/」の行き先を外した。
 * 「/」は献立へ送るだけの通過点になり、そこへ戻すボタンを出す場面が無くなったため
 * （知らないパスは null＝戻るボタンを出さない、という従来の扱いのままにする）。
 */
const BACK_TARGETS: { match: (pathname: string) => boolean; label: () => string }[] = [
  // 長いパスから先に判定する（/recipes より /recipes/ が先）
  { match: (p) => p.startsWith('/recipes/'), label: () => ja.backLink.recipeDetail },
  { match: (p) => p.startsWith('/recipes'), label: () => ja.backLink.recipes },
  { match: (p) => p.startsWith('/meal-plan'), label: () => ja.backLink.mealPlan },
  { match: (p) => p.startsWith('/cook-navi'), label: () => ja.backLink.cookNavi },
  { match: (p) => p.startsWith('/shopping'), label: () => ja.backLink.shopping },
  { match: (p) => p.startsWith('/history'), label: () => ja.backLink.history },
  { match: (p) => p.startsWith('/prices'), label: () => ja.backLink.prices },
]

export interface BackTarget {
  /** 戻り先のパス（クエリ付きのこともある） */
  to: string
  /** 戻るボタンに出す文言（例: 「レシピ一覧に戻る」） */
  label: string
}

/**
 * 設定画面へのリンクに戻り先を載せる。
 * from はアプリ内のパス（`/` 始まり）。空・外部URLらしきものは載せない（開いた先で無視されるため）。
 */
export function settingsLinkWithBack(settingsPath: string, from: string): string {
  if (!isInAppPath(from)) return settingsPath
  const separator = settingsPath.includes('?') ? '&' : '?'
  return `${settingsPath}${separator}back=${encodeURIComponent(from)}`
}

/**
 * ?back= の値を戻り先に解決する。
 * アプリ内のパス（`/` 始まり・`//` で始まらない）だけを受け付け、それ以外は null を返す
 * （外部サイトへ飛ばす踏み台にしないため。month-demo と同じ判定）。
 */
export function resolveBackTarget(raw: string | null | undefined): BackTarget | null {
  if (!isInAppPath(raw)) return null
  const to = raw as string
  const pathname = to.split(/[?#]/)[0]
  const matched = BACK_TARGETS.find((target) => target.match(pathname))
  if (!matched) return null
  return { to, label: ja.backLink.backTo.replace('{page}', matched.label()) }
}

function isInAppPath(raw: string | null | undefined): raw is string {
  return !!raw && raw.startsWith('/') && !raw.startsWith('//')
}
