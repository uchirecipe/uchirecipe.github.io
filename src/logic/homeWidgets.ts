import { defaultHomeWidgets, type HomeWidgetKey } from '../db/types'

/**
 * 標準の並び（defaultHomeWidgets）での位置。標準に無いキー（過去の設定に残った未知のキー）は
 * 末尾扱いにして、既知のパーツより後ろへ寄せる。
 */
function defaultRank(key: HomeWidgetKey): number {
  const index = defaultHomeWidgets.indexOf(key)
  return index < 0 ? defaultHomeWidgets.length : index
}

/**
 * 設定「ホーム画面のカスタマイズ」で、いったん「表示しない」にしたパーツを
 * 「表示する」に戻すときの入れ先を決める（2026-08-03 便DH・オーナー指示）。
 *
 * 従来は配列の末尾に足していたため、「今日の献立」を戻すと最近作ったものより下＝
 * ホームのいちばん下に出ていた。戻したパーツは**標準の並びでの位置**へ返す:
 * いま表示中のパーツを標準の並び順で見て、戻すパーツより後ろに来る最初のパーツの
 * 直前へ入れる（そういうパーツが無ければ末尾）。
 *
 * ユーザーが手で入れ替えた並びは崩さない（既に表示中のパーツの相対順は一切動かさない）。
 * 例: 表示中が [最近作ったもの, レシピを探す] のように標準と逆順でも、「今日の献立」は
 * 標準で最も前のパーツなので先頭に入る。
 */
export function restoreHomeWidget(
  current: HomeWidgetKey[],
  key: HomeWidgetKey,
): HomeWidgetKey[] {
  if (current.includes(key)) return current
  const rank = defaultRank(key)
  const at = current.findIndex((k) => defaultRank(k) > rank)
  if (at < 0) return [...current, key]
  return [...current.slice(0, at), key, ...current.slice(at)]
}
