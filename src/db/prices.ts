import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { defaultSettings } from './types'
import type { PriceEntry } from './types'
import {
  PRICE_DEFAULTS,
  PRICE_DEFAULTS_VERSION,
  PRICE_DEFAULT_MERGES,
  PRICE_DEFAULT_UNIT_FIXES,
} from '../data/priceDefaults'
import type {
  PriceDefaultItem,
  PriceDefaultMerge,
  PriceDefaultUnitFix,
} from '../data/priceDefaults'
import { toHiragana } from '../logic/kana'
import { normalizeIngredientNameForPrice } from '../logic/priceEstimate'
import { planPriceRefresh, normalizePriceName } from '../logic/priceRefresh'
import type { PriceRefreshPlan } from '../logic/priceRefresh'

const collator = new Intl.Collator('ja')

/**
 * 重複判定用の正規化: 前後の空白除去・括弧書き除去（normalizeIngredientNameForPrice）に加えて、
 * カタカナ⇄ひらがなの表記ゆれも同一視するため toHiragana を噛ませる
 * （2026-07-15 オーナー実機フィードバック: 「とうふ」と「トウフ」を別々に登録できてしまう）。
 *
 * 2026-08-22 便JI: 中身は logic/priceRefresh.ts の normalizePriceName に1本化した
 * （「最新の目安価格に更新する」の突き合わせと同じキーで見るため。別々に持つと
 *  「追加のときは同じ食材、更新のときは別の食材」という食い違いが生まれる）。
 */
function normalizeForDuplicateCheck(name: string): string {
  return normalizePriceName(name)
}

/**
 * 既存マスタ(existing)に対して、defaults側のうち「名前が既存に一つも無いもの」だけを返す純粋関数
 * （2026-07-16 バージョン付きトップアップ移行用に切り出し。ユニットテストしやすいようexportする）。
 * 名前の一致判定はnormalizeForDuplicateCheck（かな表記ゆれ込み）で行う。価格・単位が既存と
 * 違っていても「名前があるなら追加しない」（ユーザーが編集した行を上書きしないため）。
 */
export function missingDefaults(
  existing: Pick<PriceEntry, 'name'>[],
  defaults: PriceDefaultItem[],
): PriceDefaultItem[] {
  const existingNames = new Set(existing.map((e) => normalizeForDuplicateCheck(e.name)))
  return defaults.filter((d) => !existingNames.has(normalizeForDuplicateCheck(d.name)))
}

/** unitFixesToApplyが返す「この行のこの単位を書き換える」1件分 */
export interface PriceUnitFixPlan {
  id: number
  name: string
  fromUnit: string
  toUnit: string
}

/**
 * 「単位だけを直す」1回限りの移行で、実際に書き換える行を決める純粋関数
 * （2026-08-10 便EY。ユニットテストしやすいようexportする）。
 *
 * 背景: マスタの単位が「1パック」「1袋」だと、レシピが「6個」「2枚」と書いていても
 * 按分の受け皿にならず、パック1つ分の金額がまるごと1行に乗っていた（いちご6個=400円）。
 * PRICE_DEFAULTS側の単位を直しても、トップアップ移行（missingDefaults）は
 * 「名前がまだ無い項目の追加」専用なので、既に行を持っている既存ユーザーには反映されない。
 *
 * 書き換える条件は、そのユーザーがまだ何も手を加えていないと言い切れる行だけに絞る:
 *  ① isDefault === true（投入時の目安のまま。ユーザーが上書きしたら必ずfalseになる）
 *  ② 価格が旧既定と同じ（1円でも変えていたら対象外）
 *  ③ 単位が旧既定の文字列と同じ（単位を自分で変えていたら対象外）
 * これに当てはまらない行——自分で価格を入れた行、単位を変えた行、消した行、自分で追加した
 * 同名の行——は1件も触らない（規約F。何が変わって何が残るかを明示するための線引き）。
 *
 * 名前の一致判定は missingDefaults と同じ normalizeForDuplicateCheck（かな表記ゆれ込み）。
 */
export function unitFixesToApply(
  existing: Pick<
    PriceEntry,
    'id' | 'name' | 'pricePerUnit' | 'unit' | 'isDefault' | 'defaultPricePerUnit' | 'defaultUnit'
  >[],
  fixes: PriceDefaultUnitFix[],
): PriceUnitFixPlan[] {
  const byName = new Map(fixes.map((f) => [normalizeForDuplicateCheck(f.name), f]))
  const plans: PriceUnitFixPlan[] = []
  for (const entry of existing) {
    if (entry.id == null) continue
    const fix = byName.get(normalizeForDuplicateCheck(entry.name))
    if (!fix) continue
    if (entry.isDefault !== true) continue
    if (entry.pricePerUnit !== fix.pricePerUnit) continue
    if (entry.unit !== fix.fromUnit) continue
    plans.push({ id: entry.id, name: entry.name, fromUnit: fix.fromUnit, toUnit: fix.toUnit })
  }
  return plans
}

/** nameMergesToApplyが返す「この行をこうする」1件分（2026-08-10 便FA） */
export type PriceNameMergePlan =
  /** 統合先の行が既にあるので、畳まれる側の行を消す */
  | { kind: 'delete'; id: number; name: string; toName: string }
  /** 統合先の行が無いので、畳まれる側の行を統合先の名前・目安価格・単位に書き換える */
  | {
      kind: 'rename'
      id: number
      name: string
      toName: string
      pricePerUnit: number
      unit: string
    }

/**
 * 「2つに分かれていた同じ食材を1行に畳む」1回限りの移行で、実際に手を入れる行を決める純粋関数
 * （2026-08-10 便FA。ユニットテストしやすいようexportする）。
 *
 * 背景: 「しいたけ 150円」と「生しいたけ 100円」が同じ生のしいたけに対する別項目として並び、
 * 同じ食材なのに値段が違っていた。PRICE_DEFAULTS からは畳まれる側を落としたが、既に行を持って
 * いる既存ユーザーには反映されない（トップアップ移行は「名前がまだ無い項目の追加」専用）。
 *
 * 手を入れる条件は unitFixesToApply と同じで、そのユーザーがまだ何も触っていない行だけに絞る:
 *  ① isDefault === true（投入時の目安のまま）
 *  ② 価格が旧既定と同じ ③ 単位が旧既定と同じ
 * 自分で価格を入れた行・単位を変えた行・消した行・自分で追加した行は1件も触らない（規約F）。
 *
 * 統合先の行が既にあれば畳まれる側を消し（価格の情報は統合先に残る）、統合先が無ければ
 * （ユーザーが統合先だけを消していた場合）畳まれる側を統合先の名前・目安価格・単位へ
 * 書き換える＝その食材の行を1つも持たない状態にはしない。
 *
 * 名前の突き合わせは normalizeIngredientNameForPrice（括弧書きと前後の空白だけを落とす）で行う。
 * unitFixesToApply が使う normalizeForDuplicateCheck は読み仮名辞書まで通すため、
 * この移行の主役である「しいたけ」と「生しいたけ」が同じキーに潰れて区別できない。
 */
export function nameMergesToApply(
  existing: Pick<PriceEntry, 'id' | 'name' | 'pricePerUnit' | 'unit' | 'isDefault'>[],
  merges: PriceDefaultMerge[],
  defaults: PriceDefaultItem[],
): PriceNameMergePlan[] {
  const defaultByName = new Map(
    defaults.map((d) => [normalizeIngredientNameForPrice(d.name), d]),
  )
  const plans: PriceNameMergePlan[] = []
  // 統合先の行がこの端末に在るか（畳んだ結果として増える分も数える）
  const presentNames = new Set(existing.map((e) => normalizeIngredientNameForPrice(e.name)))
  const removedIds = new Set<number>()
  for (const merge of merges) {
    const fromKey = normalizeIngredientNameForPrice(merge.fromName)
    const toKey = normalizeIngredientNameForPrice(merge.toName)
    for (const entry of existing) {
      if (entry.id == null || removedIds.has(entry.id)) continue
      if (normalizeIngredientNameForPrice(entry.name) !== fromKey) continue
      if (entry.isDefault !== true) continue
      if (entry.pricePerUnit !== merge.fromPricePerUnit) continue
      if (entry.unit !== merge.fromUnit) continue
      if (presentNames.has(toKey)) {
        plans.push({ kind: 'delete', id: entry.id, name: entry.name, toName: merge.toName })
      } else {
        const target = defaultByName.get(toKey)
        if (!target) continue // 統合先がPRICE_DEFAULTSに無い＝設定ミス。何もしない（安全側）
        // 【2026-08-26 便LF・不具合の修正】書き換えるのは**名前だけ**。金額と単位はその行が
        // 持っている値のまま運ぶ。
        // ここは以前 target（＝いまのPRICE_DEFAULTS）の価格・単位を入れていた。
        // 呼び名を統一するだけの移行なのに、**版番号を上げたときに目安価格まで黙って
        // 新しい値に変わってしまう**——2026-08-22 に決めた「新しい目安価格は、利用者が
        // 『最新の目安価格に更新する』を押したときだけ届く」という設計と食い違う。
        // 便LFが目安価格を42件動かすまでは、旧既定と今の既定が同じ値だったので表に出ていなかった
        // （e2e FB-1c「金額は1円も動かさない」・FB-2「目安価格は400円/30gのまま(呼び名だけを変えた)」
        //  が、この食い違いを見張っていた節）。
        // 名前が変わった行も、そのあと「最新の目安価格に更新する」を押せば新しい値になる
        // （planPriceRefresh は名前で突き合わせるので、畳んだ後の名前で対象に入る）。
        plans.push({
          kind: 'rename',
          id: entry.id,
          name: entry.name,
          toName: target.name,
          pricePerUnit: entry.pricePerUnit,
          unit: entry.unit,
        })
        presentNames.add(toKey)
      }
      removedIds.add(entry.id)
    }
  }
  return plans
}

/**
 * 初回起動時だけ、頻出食材の目安価格（PRICE_DEFAULTS）を食材価格マスタに投入する。
 * 既に投入済み、またはマスタに何か登録済みなら何もしない（pantry.tsのプリセット投入と同じ方式）。
 * 併せて、既存ユーザーの手持ちデータに「目安/自分の価格」バッジ用フラグを1回だけ後付けする
 * 移行処理も行う（2026-07-12 UX改修。新規投入分は最初からフラグ付きなので対象外）。
 * さらに、PRICE_DEFAULTS_VERSIONが上がったときだけ「まだ無い項目だけ」を追加投入する
 * バージョン付きトップアップ移行も行う（2026-07-16。古い時期にマスタを作った既存ユーザーは、
 * その後追加されたPRICE_DEFAULTSが反映されず「価格なし」が多発するための対応）。
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
      settings = { ...settings, priceDefaultFlagsMigrated: true }
      await db.settings.put({ ...settings, id: 1 })
    }

    // バージョン付きトップアップ移行: 既存の行（ユーザーが編集・追加したもの含む）は一切触らず、
    // 名前がまだ無いPRICE_DEFAULTSの項目だけを追加する。バージョンが上がった時だけ実行するため、
    // ユーザーが過去に消した既定はそのバージョン内では再追加しない
    if ((settings.priceDefaultsVersion ?? 0) < PRICE_DEFAULTS_VERSION) {
      // 名寄せの移行（2026-08-10 便FA）。同じ食材が2行に分かれていたものを1行に畳む。
      // 単位の修正・追加より先に走らせる（畳んだ後の姿に対して残りの移行を掛けるため）。
      // 対象は目安のままの行だけで、ユーザーが手を入れた行には触らない（nameMergesToApply）
      for (const plan of nameMergesToApply(
        await db.prices.toArray(),
        PRICE_DEFAULT_MERGES,
        PRICE_DEFAULTS,
      )) {
        if (plan.kind === 'delete') {
          await db.prices.delete(plan.id)
        } else {
          await db.prices.update(plan.id, {
            name: plan.toName,
            pricePerUnit: plan.pricePerUnit,
            unit: plan.unit,
            defaultPricePerUnit: plan.pricePerUnit,
            defaultUnit: plan.unit,
            isDefault: true,
            updatedAt: Date.now(),
          })
        }
      }
      const existing = await db.prices.toArray()
      // 単位だけを直す移行（2026-08-10 便EY）。追加より先に走らせて、旧単位のまま残っている
      // 目安行を新単位へ揃える（価格は変えない）。ユーザーが手を入れた行は unitFixesToApply が
      // 対象から外すので触らない。defaultUnitも一緒に更新するので、この行の
      // 「デフォルトに戻す」の戻り先も新しい単位になる（isDefaultはtrueのままなので、
      // 一覧では今までどおり「デフォルトに戻す」が出ない＝未編集の見え方が変わらない）
      for (const plan of unitFixesToApply(existing, PRICE_DEFAULT_UNIT_FIXES)) {
        await db.prices.update(plan.id, {
          unit: plan.toUnit,
          defaultUnit: plan.toUnit,
          isDefault: true,
          updatedAt: Date.now(),
        })
      }
      const missing = missingDefaults(existing, PRICE_DEFAULTS)
      if (missing.length > 0) {
        const now = Date.now()
        await db.prices.bulkAdd(
          missing.map((item) => ({
            name: item.name,
            pricePerUnit: item.pricePerUnit,
            unit: item.unit,
            updatedAt: now,
            isDefault: true,
            defaultPricePerUnit: item.pricePerUnit,
            defaultUnit: item.unit,
          })),
        )
      }
      settings = { ...settings, priceDefaultsVersion: PRICE_DEFAULTS_VERSION }
      await db.settings.put({ ...settings, id: 1 })
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

/**
 * いま「最新の目安価格に更新する」を押したら何が変わるかを数える（画面のボタンの出し分け・
 * 押す前の件数・確認の窓の中身に使う。2026-08-22 便JI）。
 * entries は usePriceEntries の結果をそのまま渡してよい（読み込み中の undefined も受ける）。
 */
export function pendingPriceRefresh(entries: readonly PriceEntry[] | undefined): PriceRefreshPlan {
  return planPriceRefresh(entries ?? [], PRICE_DEFAULTS)
}

/** refreshDefaultPrices の結果（updated=入れ替えた件数・previous=取り消し用の入れ替え前の行） */
export interface PriceRefreshOutcome {
  updated: number
  previous: PriceEntry[]
}

/**
 * 「投入時の目安のままの行」だけを今の目安価格（PRICE_DEFAULTS）へ入れ替える
 * （2026-08-22 便JI・オーナー裁定「1＝A案」）。**利用者がボタンを押したときだけ走る**。
 *
 * 価格・単位と一緒に defaultPricePerUnit / defaultUnit も新値にするのが要点で、
 * ここを揃えないと、入れ替えたあとに自分で直して「デフォルトに戻す」を押したとき
 * また古い値に戻ってしまう（src/data/priceDefaults.ts 冒頭の「かつての既知の限界」の後半）。
 *
 * どの行を入れ替えるかは planPriceRefresh が決める。計画は**このトランザクションの中で
 * 立て直す**（画面が持っていた古い計画で書き換えると、その間に編集した行を壊しうるため）。
 * 入れ替える前の行はそのまま返すので、呼び出し側は restorePriceEntries で取り消せる。
 */
export async function refreshDefaultPrices(): Promise<PriceRefreshOutcome> {
  return db.transaction('rw', db.prices, async () => {
    const entries = await db.prices.toArray()
    const plan = planPriceRefresh(entries, PRICE_DEFAULTS)
    const byId = new Map(entries.map((entry) => [entry.id, entry]))
    const previous: PriceEntry[] = []
    const now = Date.now()
    for (const target of plan.targets) {
      const before = byId.get(target.id)
      if (before) previous.push({ ...before })
      await db.prices.update(target.id, {
        pricePerUnit: target.toPricePerUnit,
        unit: target.toUnit,
        defaultPricePerUnit: target.toPricePerUnit,
        defaultUnit: target.toUnit,
        isDefault: true,
        updatedAt: now,
      })
    }
    return { updated: plan.targets.length, previous }
  })
}

/**
 * 「最新の目安価格に更新する」を取り消す（2026-08-22 便JI）。入れ替える前の行をそのまま
 * 書き戻すので、価格・単位だけでなく戻り先（defaultPricePerUnit / defaultUnit）まで元の姿に戻る。
 * 行削除の取り消し（restorePriceEntry）と同じ「消して（変えて）から戻せる」作法。
 */
export async function restorePriceEntries(entries: readonly PriceEntry[]): Promise<void> {
  if (entries.length === 0) return
  await db.prices.bulkPut([...entries])
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

/**
 * 削除した1件を元に戻す（2026-07-30 便CK/③-2。買い物メモの restoreShoppingItem と同じ作法）。
 * 削除直後のidはまだ空いているので、同じidで書き戻せば目安価格(defaultPricePerUnit)・
 * 単位・isDefaultまで削除前の姿でそろって戻る。
 *
 * これが無かったため、行右端のXを1タップした時点で目安価格の原本ごと消え、
 * アプリ内には復旧導線が無かった（seedPriceDefaultsIfNeededは初回起動と
 * PRICE_DEFAULTS_VERSION更新時しか走らない＝バックアップ復元か次の既定価格更新待ちしかない）。
 */
export async function restorePriceEntry(entry: PriceEntry): Promise<void> {
  await db.prices.put(entry)
}
