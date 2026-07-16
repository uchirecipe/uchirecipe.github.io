import { useEffect, useState } from 'react'
import { RotateCcw, X } from 'lucide-react'
import { addPriceEntry, updatePriceEntry, resetPriceEntryToDefault } from '../db/prices'
import type { PriceEntry } from '../db/types'
import { KNOWN_UNITS, decomposeUnit, composeUnit } from '../logic/unitForm'
import type { UnitFormState } from '../logic/unitForm'
import UnitQuantityFields from './UnitQuantityFields'
import { ja } from '../i18n/ja'

/** RecipeDetailPageが持つモーダルの開閉state。entryIdあり=編集モード/なし=登録モード(裁定1) */
export interface PriceEditTarget {
  /** 登録モードの名前欄の初期値(編集モードでは未使用。表示名はentries側の現在値を使う) */
  name: string
  /** マスタ行のid。あれば編集モード、無ければ登録モード */
  entryId?: number
  /** 直前の操作(duplicate切替)で出す案内文。無ければ何も出さない */
  notice?: string
}

interface Props {
  target: PriceEditTarget
  entries: PriceEntry[] | undefined
  onChangeTarget: (next: PriceEditTarget | null) => void
}

const fieldInputCls =
  'mt-1 block w-full min-w-0 max-w-full rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60'

/**
 * 材料行の価格チップ・「＋登録」タップで開く価格編集モーダル(2026-07-16 裁定1「原価ビュー」
 * 全面改修)。CookedLogModalと同じ中央カード窓の様式。インライン編集を不採用にした理由は
 * 「料理中に読む画面に価格inputを常設すると誤編集・blur暴発のリスクがある」+「原価ビューOFF時は
 * 表示を1pxも変えない原則と噛み合わない」(仕様書 docs/30 裁定1)。
 *
 * 編集モード(entry有り=マスタ一致行): 名前は編集不可(タイトルとして食材名を出すだけ。
 * 名前変更でmatchが外れて突然「価格なし」化する事故を防ぐため。名前変更は/prices側で行う)。
 * 登録モード(entry無し=「＋登録」): 名前欄も編集可(初期値はnormalizeIngredientNameForPriceで
 * 括弧書きを落とした表示名)。
 *
 * 現在値は毎回entries(usePriceEntriesのlive query)からentryIdで引く(DBが正)。ただし入力途中の
 * 値を毎レンダー上書きしないよう、フォームのローカルstateはマウント時に1回だけ初期化する
 * (呼び出し側がtarget.entryId/target.nameが変わるたびにこのコンポーネントをkey付きで
 * 再マウントする前提。duplicate検出→編集モード切替もこの再マウントで反映する)。
 */
export default function PriceEditModal({ target, entries, onChangeTarget }: Props) {
  const entry = target.entryId != null ? entries?.find((e) => e.id === target.entryId) : undefined
  const isAddMode = !entry

  const [name, setName] = useState(target.name)
  const [price, setPrice] = useState(() => (entry ? String(entry.pricePerUnit) : ''))
  // 編集モードは現在値を分解、登録モードは「食材と価格」の追加フォームと同じ既定(先頭の単位=g)
  // から始める(decomposeUnit('')だと「その他」自由入力に落ちてしまい、数量欄+単位選択という
  // 仕様書の見た目にならないため)
  const [unit, setUnit] = useState<UnitFormState>(() =>
    entry ? decomposeUnit(entry.unit) : { qty: '', unitKind: KNOWN_UNITS[0], freeText: '' },
  )
  const [notice, setNotice] = useState(target.notice ?? '')
  const composedUnit = composeUnit(unit)
  const canReset =
    !isAddMode && entry?.isDefault !== true && entry?.defaultPricePerUnit != null && entry?.defaultUnit != null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onChangeTarget(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => onChangeTarget(null)

  const handleSave = async () => {
    const priceNum = Number(price)
    if (!(priceNum > 0) || !composedUnit) return
    if (isAddMode) {
      if (!name.trim()) return
      const result = await addPriceEntry(name, priceNum, composedUnit)
      if (result.status === 'invalid') return
      if (result.status === 'duplicate') {
        // かな揺れでmatchは外れたがマスタに実在した場合: 編集モードへ切り替える(仕様書edge case2)
        const found = entries?.find((e) => e.name === result.existingName)
        onChangeTarget({
          name: result.existingName,
          entryId: found?.id,
          notice: ja.detail.costEditExists.replace('{name}', result.existingName),
        })
        return
      }
      close()
      return
    }
    if (entry?.id != null) {
      await updatePriceEntry(entry.id, { pricePerUnit: priceNum, unit: composedUnit })
      close()
    }
  }

  const handleReset = async () => {
    if (!entry?.id || entry.defaultPricePerUnit == null || !entry.defaultUnit) return
    await resetPriceEntryToDefault(entry.id)
    setPrice(String(entry.defaultPricePerUnit))
    setUnit(decomposeUnit(entry.defaultUnit))
  }

  const dialogTitle = isAddMode
    ? ja.detail.costAddTitle
    : ja.detail.costEditTitle.replace('{name}', entry?.name ?? target.name)

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={dialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{isAddMode ? ja.detail.costAddTitle : (entry?.name ?? target.name)}</h3>
          <button
            type="button"
            onClick={close}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {notice && (
          <p role="status" className="mt-2 text-sm font-bold text-accent">
            {notice}
          </p>
        )}

        {isAddMode && (
          <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
            {ja.priceMaster.nameLabel}
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNotice('')
              }}
              placeholder={ja.priceMaster.namePlaceholder}
              className={fieldInputCls}
            />
          </label>
        )}

        <label className="mt-[var(--space-sm)] block text-sm text-ink-muted">
          {ja.priceMaster.priceLabel}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={price}
            onChange={(e) => {
              setPrice(e.target.value)
              setNotice('')
            }}
            placeholder={ja.priceMaster.pricePlaceholder}
            className={fieldInputCls}
          />
        </label>

        <div className="mt-[var(--space-sm)]">
          <span className="block text-sm text-ink-muted">{ja.priceMaster.unitTypeLabel}</span>
          <div className="mt-1 flex gap-2">
            <UnitQuantityFields
              value={unit}
              onChange={(next) => {
                setUnit(next)
                setNotice('')
              }}
              quantityAriaLabel={ja.priceMaster.quantityLabel}
              unitOtherAriaLabel={ja.priceMaster.unitLabel}
              unitTypeAriaLabel={ja.priceMaster.unitTypeLabel}
              quantityPlaceholder={ja.priceMaster.quantityPlaceholder}
              unitOtherPlaceholder={ja.priceMaster.unitPlaceholder}
              quantityClassName="w-20 shrink-0 rounded-sm border border-edge bg-app px-2 py-3 text-base text-ink placeholder:text-ink-muted/60"
              unitOtherClassName="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
              unitSelectClassName="shrink-0 rounded-sm border border-edge bg-app px-2 py-3 text-base text-ink"
            />
          </div>
        </div>

        {canReset && (
          <button
            type="button"
            onClick={() => void handleReset()}
            className="mt-2 inline-flex items-center gap-0.5 text-xs font-bold text-accent underline"
          >
            <RotateCcw size={12} aria-hidden />
            {ja.priceMaster.resetToDefault}
          </button>
        )}

        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!(Number(price) > 0) || !composedUnit || (isAddMode && !name.trim())}
            className="flex-1 rounded-md bg-accent py-3 text-lg font-bold text-on-accent shadow-sm disabled:opacity-60"
          >
            {ja.form.save}
          </button>
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-edge bg-surface px-4 py-3 text-ink-muted"
          >
            {ja.form.cancel}
          </button>
        </div>
      </div>
    </div>
  )
}
