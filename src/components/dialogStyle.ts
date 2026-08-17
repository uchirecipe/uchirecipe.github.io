/**
 * 画面の中に出す窓の見た目（2026-08-14 便GL の ConfirmDialog で決め、2026-08-15 便GW で
 * アプリ全体34か所の確認をそろえた作法）。
 *
 * 2026-08-17 便HJ: 「確認」ではなく「選択肢」を出す窓（ChoiceDialog）を足すにあたり、
 * 同じ見た目を2つの部品に書き写さずに済むよう、クラス名だけをここへ出した。
 * 見た目を変えるときはこの1か所を変える＝2つの窓が別物に見えることが起きない。
 * 値そのものは便GL/GWから1文字も変えていない（既存の窓の見た目は変わらない）。
 */

/** 窓の後ろ。全面をおおって、後ろの画面のタップを受け止める */
export const DIALOG_BACKDROP_CLS =
  'fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]'

/** 窓そのもの（中央寄せの角丸カード） */
export const DIALOG_CARD_CLS =
  'max-h-[85vh] w-full max-w-sm min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md'

/** 見出し */
export const DIALOG_TITLE_CLS = 'ja-phrase text-lg font-bold'

/** ボタンの並び（縦に積む） */
export const DIALOG_ACTIONS_CLS = 'mt-[var(--space-md)] space-y-[var(--space-sm)]'

/** 主となるボタン（確認の「確認」／選択肢のいちばんの道）。塗りつぶし */
export const DIALOG_PRIMARY_BUTTON_CLS =
  'w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md'

/**
 * 主ではない選択肢のボタン（枠線だけ）。高さ・文字の大きさは主のボタンと同じにして、
 * どれも同じように選べる道であることを見た目で言う（押す面も同じ大きさになる）
 */
export const DIALOG_CHOICE_BUTTON_CLS =
  'w-full rounded-md border border-edge bg-surface py-4 text-lg font-bold text-accent-ink shadow-sm'

/** 「やめる」（何も起きない側） */
export const DIALOG_CANCEL_BUTTON_CLS =
  'w-full rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm'
