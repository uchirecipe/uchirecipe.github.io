/**
 * 押されたEnterが「日本語入力の変換を確定するEnter」かどうか（2026-08-02 オーナー実機FB
 * 「エンターで行が増えて注力しづらい」の対策）。
 *
 * 変換中のEnterで行・チップ・食材を作ってしまうと、変換を確定しただけのつもりが勝手に増える。
 * Enterで何かを確定する入力欄は、必ず `e.key === 'Enter' && !isImeConfirmKey(e)` の形で守ること。
 *
 * isComposing が本命で、keyCode 229 は compositionend が keydown より先に来る環境向けの保険。
 *
 * 2026-08-09 便EI: レシピ登録画面(RecipeFormPage)にしか無く、ChipInput（レシピ一覧の
 * 食材しぼり込み）・在庫ボード（食材の追加／一言メモ）・設定のNG食材が未対応で残っていたため、
 * 判定をこのモジュールへ切り出して全箇所で同じものを使う（単体テストもここに集約する）。
 *
 * 引数はReactのKeyboardEventがそのまま渡せる形（nativeEvent.isComposing + keyCode）にしてある。
 * React非依存の純関数なので scripts/test-logic.mjs から直接呼んで固定できる。
 */
export function isImeConfirmKey(e: {
  nativeEvent: { isComposing: boolean }
  keyCode: number
}): boolean {
  return e.nativeEvent.isComposing || e.keyCode === 229
}
