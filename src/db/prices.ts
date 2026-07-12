import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings } from './types'
import type { PriceEntry } from './types'
import { PRICE_DEFAULTS } from '../data/priceDefaults'
import { toHiragana } from '../logic/kana'

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

/** 新規追加。名前・単位が空、または価格が0以下なら何もしない。新規行は常に「自分の価格」扱い */
export async function addPriceEntry(name: string, pricePerUnit: number, unit: string): Promise<void> {
  const trimmedName = name.trim()
  const trimmedUnit = unit.trim()
  if (!trimmedName || !trimmedUnit || !(pricePerUnit > 0)) return
  await db.prices.add({
    name: trimmedName,
    pricePerUnit,
    unit: trimmedUnit,
    updatedAt: Date.now(),
    isDefault: false,
  })
}

/**
 * 既存の1件を部分更新する（一覧のインライン編集用。渡したフィールドだけ書き換える）。
 * 目安価格(isDefault)の行の価格・単位を書き換えると、以後は「自分の価格」扱いになる
 * （名前だけの変更ではバッジは変わらない。目安バッジは価格・単位が目安のままかどうかの印のため）
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
  const priceOrUnitChanged =
    (patch.pricePerUnit !== undefined && patch.pricePerUnit !== current.pricePerUnit) ||
    (patch.unit !== undefined && nextUnit !== current.unit)
  await db.prices.update(id, {
    name: nextName,
    pricePerUnit: nextPrice,
    unit: nextUnit,
    updatedAt: Date.now(),
    ...(priceOrUnitChanged && current.isDefault ? { isDefault: false } : {}),
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
