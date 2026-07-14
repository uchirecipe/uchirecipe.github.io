import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings } from './types'
import type { PriceEntry } from './types'
import { PRICE_DEFAULTS } from '../data/priceDefaults'
import { toHiragana } from '../logic/kana'
import { normalizeIngredientNameForPrice } from '../logic/priceEstimate'

const collator = new Intl.Collator('ja')

/**
 * 初回起動時だけ、頻出食材の目安価格（PRICE_DEFAULTS）を食材価格マスタに投入する。
 * 既に投入済み、またはマスタに何か登録済みなら何もしない（pantry.tsのプリセット投入と同じ方式）。
 * 併せて、既存ユーザーの手持ちデータに「目安/自分の価格」バッジ用フラグを1回だけ後付けする
 * 移行処理も行う（2026-07-12 UX改修。新規投入分は最初からフラグ付きなので対象外）。
 */
export async function seedPriceDefaultsIfNeeded(): Promise<void> {
  await db.transaction('rw', db.prices, db.settings, async () => {
    let settings = { ...defaultSettings, ...(await db.settings.get(1)) }
    if (!settings.priceMasterSeeded) {
      const existingCount = await db.prices.count()
      if (existingCount === 0) {
        const now = Date.now()
        await db.prices.bulkAdd(
          PRICE_DEFAULTS.map((item) => ({
            ...item,
            updatedAt: now,
            isDefault: true,
            defaultPricePerUnit: item.pricePerUnit,
            defaultUnit: item.unit,
          })),
        )
      }
      settings = { ...settings, priceMasterSeeded: true }
      await db.settings.put({ ...settings, id: 1 })
    }

    // 既存ユーザー向け1回限りの移行: isDefaultが未設定の行のうち、現在のPRICE_DEFAULTSと
    // (名前・価格・単位)が完全一致するものだけ「目安のまま」とみなしてフラグを補う。
    // 既に編集済みの行はPRICE_DEFAULTSと一致しないので、自動的に「自分の価格」のまま扱われる（安全側）
    if (!settings.priceDefaultFlagsMigrated) {
      const untouched = (await db.prices.toArray()).filter((e) => e.isDefault === undefined)
      if (untouched.length > 0) {
        const byKey = new Map(
          PRICE_DEFAULTS.map((d) => [`${d.name} ${d.pricePerUnit} ${d.unit}`, d]),
        )
        for (const entry of untouched) {
          if (entry.id == null) continue
          const match = byKey.get(`${entry.name} ${entry.pricePerUnit} ${entry.unit}`)
          if (match) {
            await db.prices.update(entry.id, {
              isDefault: true,
              defaultPricePerUnit: match.pricePerUnit,
              defaultUnit: match.unit,
            })
          }
        }
      }
      await db.settings.put({ ...settings, priceDefaultFlagsMigrated: true, id: 1 })
    }
  })
}

/** 五十音順（読み仮名基準）で一覧を返す。読みが同じ場合はid順で安定させる */
export async function listPriceEntries(): Promise<PriceEntry[]> {
  const items = await db.prices.toArray()
  return items.sort(
    (a, b) =>
      collator.compare(toHiragana(a.name), toHiragana(b.name)) || (a.id ?? 0) - (b.id ?? 0),
  )
}

/** 食材価格マスタの一覧を取得するフック（変更されると自動で再描画） */
export function usePriceEntries() {
  return useLiveQuery(listPriceEntries, [])
}

/** addPriceEntryの結果種別（呼び出し側でメッセージを出し分けるため） */
export type AddPriceEntryResult =
  | { status: 'added' }
  | { status: 'duplicate'; existingName: string }
  | { status: 'invalid' }

/**
 * 重複判定用の正規化: 前後の空白除去・括弧書き除去（normalizeIngredientNameForPrice）に加えて、
 * カタカナ⇄ひらがなの表記ゆれも同一視するため toHiragana を噛ませる
 * （2026-07-15 オーナー実機フィードバック: 「とうふ」と「トウフ」を別々に登録できてしまう）。
 */
function normalizeForDuplicateCheck(name: string): string {
  return toHiragana(normalizeIngredientNameForPrice(name))
}

/**
 * 新規追加。名前・単位が空、または価格が0以下なら何もしない({status:'invalid'}。
 * 呼び出し側のボタンは既にこの条件でdisabledにしているため通常は起きない)。新規行は常に「自分の価格」扱い。
 *
 * 二重登録防止(2026-07-14 オーナー実機フィードバック、2026-07-15 かな正規化を追加):
 * 正規化後の名前（前後の空白除去・括弧書き除去＋カタカナ⇄ひらがな正規化。
 * normalizeForDuplicateCheck）が既存のマスタ行と一致する場合は追加せず{status:'duplicate'}を返す。
 * 既存の行を優先し、重複行は作らない方針（どちらが優先されるか曖昧という不安の解消が目的）。
 */
export async function addPriceEntry(
  name: string,
  pricePerUnit: number,
  unit: string,
): Promise<AddPriceEntryResult> {
  const trimmedName = name.trim()
  const trimmedUnit = unit.trim()
  if (!trimmedName || !trimmedUnit || !(pricePerUnit > 0)) return { status: 'invalid' }
  const normalized = normalizeForDuplicateCheck(trimmedName)
  const existing = (await db.prices.toArray()).find(
    (e) => normalizeForDuplicateCheck(e.name) === normalized,
  )
  if (existing) return { status: 'duplicate', existingName: existing.name }
  await db.prices.add({
    name: trimmedName,
    pricePerUnit,
    unit: trimmedUnit,
    updatedAt: Date.now(),
    isDefault: false,
  })
  return { status: 'added' }
}

/**
 * 既存の1件を部分更新する（一覧のインライン編集用。渡したフィールドだけ書き換える）。
 * 価格・単位が投入時の既定値(defaultPricePerUnit/defaultUnit)と一致するかどうかで
 * isDefaultを毎回再判定する（名前だけの変更では判定に使う値が変わらないため結果も変わらない）。
 *
 * 2026-07-14 オーナー実機フィードバックで修正: 以前は「編集したらfalseにする」だけの
 * 一方通行だったため、手で既定値に戻しても「デフォルトに戻す」ボタンが消えないバグがあった。
 * 既定値情報が無い行(ユーザーが追加した独自食材等)はdefaultPricePerUnit/defaultUnitが
 * 無いため常にisDefault=falseになる（従来どおり「デフォルトに戻す」は出ない）。
 */
export async function updatePriceEntry(
  id: number,
  patch: Partial<Pick<PriceEntry, 'name' | 'pricePerUnit' | 'unit'>>,
): Promise<void> {
  const current = await db.prices.get(id)
  if (!current) return
  const nextName = patch.name !== undefined ? patch.name.trim() : current.name
  const nextUnit = patch.unit !== undefined ? patch.unit.trim() : current.unit
  const nextPrice = patch.pricePerUnit !== undefined ? patch.pricePerUnit : current.pricePerUnit
  if (!nextName || !nextUnit || !(nextPrice > 0)) return
  const matchesDefault =
    current.defaultPricePerUnit != null &&
    current.defaultUnit != null &&
    nextPrice === current.defaultPricePerUnit &&
    nextUnit === current.defaultUnit
  await db.prices.update(id, {
    name: nextName,
    pricePerUnit: nextPrice,
    unit: nextUnit,
    updatedAt: Date.now(),
    isDefault: matchesDefault,
  })
}

/** 「自分の価格」に上書きした行を、投入時の目安価格・単位に戻す */
export async function resetPriceEntryToDefault(id: number): Promise<void> {
  const current = await db.prices.get(id)
  if (!current || current.defaultPricePerUnit == null || !current.defaultUnit) return
  await db.prices.update(id, {
    pricePerUnit: current.defaultPricePerUnit,
    unit: current.defaultUnit,
    isDefault: true,
    updatedAt: Date.now(),
  })
}

export async function removePriceEntry(id: number): Promise<void> {
  await db.prices.delete(id)
}
