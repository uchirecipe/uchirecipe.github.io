import type { FocusEvent, KeyboardEvent } from 'react'
import { KNOWN_UNITS, OTHER_UNIT, composeUnit } from '../logic/unitForm'
import type { UnitFormState } from '../logic/unitForm'
import { normalizeAmountInput } from '../logic/amount'
import { ja } from '../i18n/ja'

/** blurで保存 or Enterキーでも即保存できるようにする(Enterはネイティブのblurを誘発させる) */
const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur()
}

interface UnitQuantityFieldsProps {
  value: UnitFormState
  /** 毎キー入力・選択のたびに呼ぶ(呼び出し側でローカルstateを更新する) */
  onChange: (next: UnitFormState) => void
  /**
   * 値を確定させたいタイミング(数量/自由入力欄のblur・単位選択の変更直後)で呼ぶ。
   * 省略時は何も確定させない(「追加」ボタン等でまとめて確定するフォーム向け)
   */
  onCommit?: (next: UnitFormState) => void
  /**
   * 単位選択を「その他」に切り替えたとき、数量欄の内容を合成できない場合の
   * 自由入力欄フォールバック値。省略時はvalue.freeText(追加フォーム向けの挙動)。
   * 既存行の編集(IngredientPricesPageのPriceRow)ではentry.unit(確定済みの元の文字列)を渡す。
   */
  otherFallbackText?: string
  quantityAriaLabel: string
  unitOtherAriaLabel: string
  unitTypeAriaLabel: string
  quantityPlaceholder?: string
  unitOtherPlaceholder?: string
  quantityClassName: string
  unitOtherClassName: string
  unitSelectClassName: string
}

/**
 * 「数量(数字)＋単位(選択、その他は自由入力)」の共通UI。
 * 2026-07-16 裁定1(原価ビュー全面改修)でIngredientPricesPage.tsxから切り出し、
 * レシピ詳細の価格編集モーダル(PriceEditModal)とも共用する(挙動変更ゼロが前提)。
 * 値の保持・確定タイミングは呼び出し側に委ねる: onChangeは毎キー入力の反映、
 * onCommitはIngredientPricesPageの行内編集のような即時DB保存に使う。
 */
export default function UnitQuantityFields({
  value,
  onChange,
  onCommit,
  otherFallbackText,
  quantityAriaLabel,
  unitOtherAriaLabel,
  unitTypeAriaLabel,
  quantityPlaceholder,
  unitOtherPlaceholder,
  quantityClassName,
  unitOtherClassName,
  unitSelectClassName,
}: UnitQuantityFieldsProps) {
  /**
   * 数量欄・単位(その他)自由入力欄のblurで、全角入力を自動でNFKC半角化する(2026-07-21全角対応。
   * 「食材と価格」の数量・単位欄も計算の入口になるため、RecipeFormPageの材料欄と同じ扱いにする)。
   * onChangeではなくonBlurでだけ発火するため、IME変換中(compositionstart〜end)には介入しない
   * (blurは常にIMEのcompositionend後に発火するため、確定前の文字が正規化で壊れることはない)。
   * 正規化で値が変わらない場合は、従来どおりonCommitだけ呼ぶ(挙動変更ゼロを維持)。
   */
  const commitField = (field: 'freeText' | 'qty', e: FocusEvent<HTMLInputElement>) => {
    const raw = e.target.value
    const normalized = normalizeAmountInput(raw)
    if (normalized === raw) {
      onCommit?.(value)
      return
    }
    const next = { ...value, [field]: normalized }
    onChange(next)
    onCommit?.(next)
  }

  return (
    <>
      {value.unitKind === OTHER_UNIT ? (
        <input
          type="text"
          value={value.freeText}
          onChange={(e) => onChange({ ...value, freeText: e.target.value })}
          onBlur={(e) => commitField('freeText', e)}
          onKeyDown={blurOnEnter}
          placeholder={unitOtherPlaceholder}
          aria-label={unitOtherAriaLabel}
          className={unitOtherClassName}
        />
      ) : (
        <input
          type="number"
          inputMode="decimal"
          min={0}
          value={value.qty}
          onChange={(e) => onChange({ ...value, qty: e.target.value })}
          onBlur={(e) => commitField('qty', e)}
          onKeyDown={blurOnEnter}
          placeholder={quantityPlaceholder}
          aria-label={quantityAriaLabel}
          className={quantityClassName}
        />
      )}
      <select
        value={value.unitKind}
        onChange={(e) => {
          const unitKind = e.target.value
          const next: UnitFormState =
            unitKind === OTHER_UNIT
              ? { ...value, unitKind, freeText: composeUnit(value) ?? (otherFallbackText ?? value.freeText) }
              : { ...value, unitKind }
          onChange(next)
          onCommit?.(next)
        }}
        aria-label={unitTypeAriaLabel}
        className={unitSelectClassName}
      >
        {KNOWN_UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
        <option value={OTHER_UNIT}>{ja.priceMaster.unitOther}</option>
      </select>
    </>
  )
}
