import { useEffect, useMemo, useState } from 'react'
import { Plus, RotateCcw, Search, X } from 'lucide-react'
import {
  usePriceEntries,
  addPriceEntry,
  updatePriceEntry,
  removePriceEntry,
  resetPriceEntryToDefault,
} from '../db/prices'
import { toHiragana } from '../logic/kana'
import { KNOWN_UNITS, decomposeUnit, composeUnit } from '../logic/unitForm'
import type { UnitFormState } from '../logic/unitForm'
import UnitQuantityFields from '../components/UnitQuantityFields'
import BackHeader from '../components/BackHeader'
import { ja } from '../i18n/ja'
import type { PriceEntry } from '../db/types'

const inputCls =
  'min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-2 text-base text-ink placeholder:text-ink-muted/60'

/** blurで保存 or Enterキーでも即保存できるようにする(Enterはネイティブのblurを誘発させる) */
const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
  if (e.key === 'Enter') e.currentTarget.blur()
}

// 2026-07-15 UI改修: 単位欄(自由入力)を「数量(数字)＋単位(選択)」に分離
// （オーナー実機フィードバック「単位が自由入力だと不安・使いにくい」への対応）。
// 2026-07-16 裁定1でKNOWN_UNITS/OTHER_UNIT/UnitFormState/decomposeUnit/composeUnitは
// logic/unitForm.tsへ、選択UI部はcomponents/UnitQuantityFields.tsxへ切り出した
// (原価ビューの編集モーダルとの共通化・単体テスト対象化。挙動変更ゼロ)。

/**
 * 「食材と価格」= 食材価格マスタの一覧・一括インライン編集・追加・削除。
 * ここで登録した目安価格は、レシピの「材料ごとの価格入力」が無い材料だけを補う
 * フォールバックとして、詳細画面・献立プランナーの概算食費に使われる（docs/20 §3）。
 *
 * 2026-07-12 UX改修: 編集モーダル（タップ→別窓で編集→保存）をやめ、一覧の各行の
 * 価格・単位を直接書き換えられる形にした（オーナー実機フィードバック: 「編集が面倒」）。
 * 各入力はuncontrolled(defaultValue)にして、確定した値が変わったときだけ
 * key(id-値)を変えて再マウントすることで、他の行の編集中に値が飛ばないようにしている。
 *
 * 2026-07-13 UI改善: 表記の簡素化。「目安」/「自分の価格」バッジを廃止し、代わりに
 * ページ冒頭の一文（ja.priceMaster.disclaimer）だけで説明する。上書き済みの行を戻す
 * ボタンの文言も「目安に戻す」→「デフォルトに戻す」に変更した
 *
 * 2026-07-14 オーナー実機フィードバック: (1)新規追加の入力欄を一覧の下から上へ移動、
 * (2)正規化(前後空白・括弧書き除去)して既存と同名の食材は追加を拒否し案内メッセージを出す
 * （db/prices.tsのaddPriceEntryが判定。二重登録を作らないことが目的）、
 * (3)「デフォルトに戻す」が消えないバグを修正（db/prices.tsのupdatePriceEntryが
 * 価格・単位を既定値と毎回比較してisDefaultを再判定するように変更）
 *
 * 2026-07-15 UI改修: 単位欄(自由入力1本)を「数量(数字)＋単位(選択)」に分離
 * （オーナー実機フィードバック: 自由入力だと不安・使いにくい）。保存はこれまでどおり
 * 1つの文字列(composeUnit)なのでDBスキーマ・按分計算(logic/priceEstimate.ts)は変更なし。
 */
export default function IngredientPricesPage() {
  const entries = usePriceEntries()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!entries) return entries
    const normalizedQuery = toHiragana(query.trim())
    if (!normalizedQuery) return entries
    return entries.filter((entry) => toHiragana(entry.name).includes(normalizedQuery))
  }, [entries, query])

  const commitPrice = async (id: number, raw: string) => {
    const value = Number(raw)
    if (!(value > 0)) return
    await updatePriceEntry(id, { pricePerUnit: value })
  }
  const commitUnit = async (id: number, raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return
    await updatePriceEntry(id, { unit: trimmed })
  }

  // 新規追加
  const [newName, setNewName] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newUnit, setNewUnit] = useState<UnitFormState>({ qty: '', unitKind: KNOWN_UNITS[0], freeText: '' })
  const newUnitComposed = composeUnit(newUnit)
  // 重複登録を拒否したときの案内メッセージ(2026-07-14 オーナー実機フィードバック)。
  // 入力し直したら自然に消えるよう、各入力欄のonChangeでもクリアする
  const [addError, setAddError] = useState('')
  const addNew = async () => {
    const composed = composeUnit(newUnit)
    if (!composed) return
    const result = await addPriceEntry(newName, Number(newPrice) || 0, composed)
    if (result.status === 'invalid') return
    if (result.status === 'duplicate') {
      setAddError(ja.priceMaster.duplicateName.replace('{name}', result.existingName))
      return
    }
    setAddError('')
    setNewName('')
    setNewPrice('')
    setNewUnit({ qty: '', unitKind: KNOWN_UNITS[0], freeText: '' })
  }

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      <BackHeader fallback="/settings" title={ja.priceMaster.title} />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        <p className="rounded-sm border border-edge bg-surface px-3 py-2 text-sm text-ink-muted">
          {ja.priceMaster.disclaimer}
        </p>

        {/* 新規追加(2026-07-14 オーナー実機フィードバック: 一覧の下から上へ移動) */}
        <div className="mt-[var(--space-md)] space-y-2 rounded-md border border-edge bg-surface p-[var(--space-sm)]">
          <input
            type="text"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value)
              setAddError('')
            }}
            placeholder={ja.priceMaster.namePlaceholder}
            aria-label={ja.priceMaster.nameLabel}
            className={inputCls}
          />
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={newPrice}
              onChange={(e) => {
                setNewPrice(e.target.value)
                setAddError('')
              }}
              placeholder={ja.priceMaster.pricePlaceholder}
              aria-label={ja.priceMaster.priceLabel}
              className={inputCls}
            />
            <UnitQuantityFields
              value={newUnit}
              onChange={(next) => {
                setNewUnit(next)
                setAddError('')
              }}
              quantityAriaLabel={ja.priceMaster.quantityLabel}
              unitOtherAriaLabel={ja.priceMaster.unitLabel}
              unitTypeAriaLabel={ja.priceMaster.unitTypeLabel}
              quantityPlaceholder={ja.priceMaster.quantityPlaceholder}
              unitOtherPlaceholder={ja.priceMaster.unitPlaceholder}
              quantityClassName="w-20 shrink-0 rounded-sm border border-edge bg-app px-2 py-2 text-base text-ink placeholder:text-ink-muted/60"
              unitOtherClassName={inputCls}
              unitSelectClassName="shrink-0 rounded-sm border border-edge bg-app px-2 py-2 text-base text-ink"
            />
          </div>
          {addError && (
            <p role="alert" className="text-sm font-bold text-warning">
              {addError}
            </p>
          )}
          <button
            type="button"
            onClick={() => void addNew()}
            disabled={!newName.trim() || !newUnitComposed || !(Number(newPrice) > 0)}
            className="flex w-full items-center justify-center gap-1 rounded-sm border border-edge bg-app py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-40"
          >
            <Plus size={16} aria-hidden />
            {ja.priceMaster.add}
          </button>
        </div>

        {entries && entries.length === 0 && (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.priceMaster.empty}</p>
        )}

        {entries && entries.length > 0 && (
          <>
            <div className="relative mt-[var(--space-md)]">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ja.priceMaster.searchPlaceholder}
                aria-label={ja.priceMaster.searchLabel}
                className="w-full rounded-md border border-edge bg-surface py-2.5 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>

            {filtered && filtered.length === 0 && (
              <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.priceMaster.searchEmpty}</p>
            )}

            {filtered && filtered.length > 0 && (
              <ul className="mt-[var(--space-sm)] divide-y divide-edge rounded-md border border-edge bg-surface">
                {filtered.map((entry) => (
                  <PriceRow
                    key={entry.id}
                    entry={entry}
                    onCommitPrice={commitPrice}
                    onCommitUnit={commitUnit}
                    onReset={() => void resetPriceEntryToDefault(entry.id!)}
                    onRemove={() => void removePriceEntry(entry.id!)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** 一覧の1行分。価格・単位はその場でインライン編集でき、blur(またはEnter)で即保存する */
function PriceRow({
  entry,
  onCommitPrice,
  onCommitUnit,
  onReset,
  onRemove,
}: {
  entry: PriceEntry
  onCommitPrice: (id: number, raw: string) => void
  onCommitUnit: (id: number, raw: string) => void
  onReset: () => void
  onRemove: () => void
}) {
  const isDefault = entry.isDefault === true
  const canReset = !isDefault && entry.defaultPricePerUnit != null && entry.defaultUnit != null

  // 数量欄＋単位選択はqty/select/freeTextの3つの入力が互いに絡んで1つの文字列に合成されるため、
  // 価格欄のような単純なuncontrolled+key再マウント方式ではなくローカルstateで持つ。
  // entry.unit(DB由来の確定値)が外部要因(デフォルトに戻す・バックアップ復元等)で変わったときだけ
  // 分解し直す(このページの再描画自体はentries全体のlive queryで頻繁に起きるが、
  // entry.unitの値自体が変わらない限りeffectは再実行されないので編集中の入力が飛ぶことはない)
  const [unitState, setUnitState] = useState<UnitFormState>(() => decomposeUnit(entry.unit))
  useEffect(() => {
    setUnitState(decomposeUnit(entry.unit))
  }, [entry.unit])

  const commitUnitState = (next: UnitFormState) => {
    const composed = composeUnit(next)
    // 実質的な変更が無ければ書き込まない(isDefaultの不要な再判定・無用なupdatedAt更新を避ける)
    if (!composed || composed === entry.unit) return
    onCommitUnit(entry.id!, composed)
  }

  return (
    <li className="flex items-start gap-2 px-[var(--space-sm)] py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{entry.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <input
            key={`price-${entry.id}-${entry.pricePerUnit}`}
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={entry.pricePerUnit}
            onBlur={(e) => onCommitPrice(entry.id!, e.target.value)}
            onKeyDown={blurOnEnter}
            aria-label={ja.priceMaster.entryPriceAria.replace('{name}', entry.name)}
            className="w-16 rounded-sm border border-edge bg-app px-2 py-2 text-right text-base text-ink"
          />
          <span className="text-sm text-ink-muted">{ja.priceMaster.priceYen}/</span>
          <UnitQuantityFields
            value={unitState}
            onChange={setUnitState}
            onCommit={commitUnitState}
            otherFallbackText={entry.unit}
            quantityAriaLabel={ja.priceMaster.entryQuantityAria.replace('{name}', entry.name)}
            unitOtherAriaLabel={ja.priceMaster.entryUnitOtherAria.replace('{name}', entry.name)}
            unitTypeAriaLabel={ja.priceMaster.entryUnitAria.replace('{name}', entry.name)}
            quantityClassName="w-14 rounded-sm border border-edge bg-app px-2 py-2 text-right text-base text-ink"
            unitOtherClassName="w-20 rounded-sm border border-edge bg-app px-2 py-2 text-base text-ink"
            unitSelectClassName="rounded-sm border border-edge bg-app px-1 py-2 text-sm text-ink"
          />
        </div>
        {/* 「目安」/「自分の価格」バッジは廃止(2026-07-13 UI改善: ページ冒頭の一文で説明を代替) */}
        {canReset && (
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={onReset}
              aria-label={ja.priceMaster.resetToDefaultAria.replace('{name}', entry.name)}
              className="inline-flex items-center gap-0.5 text-xs font-bold text-accent underline"
            >
              <RotateCcw size={12} aria-hidden />
              {ja.priceMaster.resetToDefault}
            </button>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={ja.priceMaster.remove}
        className="shrink-0 rounded-full p-2 text-ink-muted"
      >
        <X size={18} aria-hidden />
      </button>
    </li>
  )
}
