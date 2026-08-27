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
  // 2026-08-22 便JF・⑦: レシピの登録・編集の画面は /recipes/new・/recipes/:id/edit なので、
  // /recipes/ の先頭一致より**先に**判定する。後ろに置くと「レシピに戻る」と名乗って
  // レシピ詳細へ帰るように読めるが、実際に帰るのは書きかけの入力画面
  { match: (p) => p === '/recipes/new', label: () => ja.backLink.recipeNew },
  { match: (p) => p.startsWith('/recipes/') && p.endsWith('/edit'), label: () => ja.backLink.recipeEdit },
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

/**
 * 説明ページ（`/about/…` の静的なHTML）へのリンクに、アプリ側の帰り先を載せる
 * （2026-08-27 便LS）。
 *
 * 直した不具合（オーナー報告）: 設定の「バックアップの詳しい説明を見る」を押すと、
 * アプリ（`/#/…`）ではなく静的なページへ移るので、**戻る道が画面のどこにも無かった**。
 * オーナー原文「アプリではなくHPへ飛ばされるので、アプリを開きなおしたり、
 * 『アプリを開く』をHPから探さないといけない」。
 * ホーム画面に追加したアプリには、ブラウザの戻るボタンが出ないことがあるため、
 * **画面の上に帰り道を置く**必要がある。
 *
 * やり方は 2026-08-26 のレシピ詳細の帰り道と同じ「行き先に帰り先を持たせる」形にそろえた。
 * `?from=` にアプリ内のパスを載せ、受け取った説明ページが `/#<パス>` へのリンクを出す
 * （受け取り側は public/about/*.html の appReturn。アプリ内のパス以外は無視する）。
 *
 * 行き先の見出し（`#backup` のような目印）は**必ず末尾**に置き直す。
 * `?from=` を目印より後ろに付けると、目印の一部として読まれてページが飛ばなくなる。
 */
export function aboutLinkWithReturn(aboutHref: string, from: string): string {
  if (!isInAppPath(from)) return aboutHref
  const hashAt = aboutHref.indexOf('#')
  const base = hashAt === -1 ? aboutHref : aboutHref.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : aboutHref.slice(hashAt)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}from=${encodeURIComponent(from)}${hash}`
}
