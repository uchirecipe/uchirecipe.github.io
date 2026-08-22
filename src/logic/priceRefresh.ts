import { ja } from '../i18n/ja'
import type { ConfirmContent } from './confirmContent'
import type { PriceDefaultItem } from '../data/priceDefaults'
import { toHiragana } from './kana'
import { normalizeIngredientNameForPrice } from './priceEstimate'

/**
 * 「最新の目安価格に更新する」の計画づくり（2026-08-22 便JI・オーナー裁定「1＝A案」）。
 *
 * ここが解く問題（src/data/priceDefaults.ts 冒頭に元から書いてあった限界）:
 * バージョン付きトップアップ移行（db/prices.ts の seedPriceDefaultsIfNeeded）は
 * 「名前がまだ無い食材の追加」専用で、既存項目の価格・単位の「更新」には使われない。
 * そのため、古い時期にマスタを作った端末は目安価格を直しても旧値のまま取り残され、
 * 「デフォルトに戻す」を押しても旧値に戻るだけだった（戻り先 defaultPricePerUnit /
 * defaultUnit がシード時点の値のままだから）。
 *
 * オーナー裁定（原文）:
 *   「再投入の仕組みを作る。『食材と価格』に『最新の目安値に更新する』を置き、
 *     自分で直した値は上書きしない（既定のままの行だけ入れ替える）」
 *
 * 自動では走らせない（＝この計画を使うのは利用者がボタンを押したときだけ）。
 * 価格改定のたびに既存行を黙って書き換える作りは、トップアップ機構の設計思想
 * 「ユーザーが編集した値を勝手に上書きしない」と両立しないため。
 *
 * 画面にもDexieにも触らない純ロジックなので、scripts/test-logic.mjs（JI-2〜JI-6）が
 * 画面を立ち上げずに「何が変わって何が変わらないか」を測れる。
 */

/**
 * 食材名の突き合わせキー。db/prices.ts の重複判定・トップアップ移行（missingDefaults）と
 * **同じ正規化**を使う（前後の空白と括弧書きを落とし、カタカナ⇄ひらがな・読み仮名辞書で寄せる）。
 * 別の正規化を作ると「追加のときは同じ食材、更新のときは別の食材」という食い違いが生まれる。
 *
 * PRICE_DEFAULTS の中でこのキーがぶつかる二重登録が無いことは
 * scripts/test-price.mjs の 1-c が見張っている（ぶつかると入れ替え先が定まらないため）。
 */
export function normalizePriceName(name: string): string {
  return toHiragana(normalizeIngredientNameForPrice(name))
}

/** 計画を立てるのに必要な、食材価格マスタ1行分の情報 */
export interface PriceRefreshEntry {
  id?: number
  name: string
  pricePerUnit: number
  unit: string
  /** 投入時の目安のままか。ユーザーが1円でも書き換えると false になる */
  isDefault?: boolean
  defaultPricePerUnit?: number
  defaultUnit?: string
}

/** 入れ替える1行分（画面のトーストと確認の窓が、名前と件数をここから読む） */
export interface PriceRefreshTarget {
  id: number
  name: string
  fromPricePerUnit: number
  fromUnit: string
  /** 今の目安価格。行の価格・単位と、戻り先（defaultPricePerUnit / defaultUnit）の両方に入れる */
  toPricePerUnit: number
  toUnit: string
}

export interface PriceRefreshPlan {
  /** 入れ替える行 */
  targets: PriceRefreshTarget[]
  /** 自分で直した価格・自分で追加した食材の件数（1件も触らない） */
  keptByUser: number
  /** 既に今の目安価格と同じ行の件数（触る必要がない） */
  alreadyCurrent: number
}

/** 確認の窓に並べる食材名の上限（窓を長文にしないため・規約H） */
export const PRICE_REFRESH_NAME_LIMIT = 3

/**
 * 「どの行を今の目安価格へ入れ替えるか」を決める。
 *
 * 入れ替える条件は、そのユーザーがまだ何も手を加えていないと言い切れる行だけに絞る
 * （db/prices.ts の unitFixesToApply / nameMergesToApply と同じ線引き）:
 *  ① isDefault === true（投入時の目安のまま。1円でも書き換えたら必ず false になる）
 *  ② 同じ名前の項目が今の PRICE_DEFAULTS にある
 *  ③ 価格か単位が今の目安と違う
 * 自分で価格を入れた行・単位を変えた行・自分で追加した食材・isDefault が未設定の古い行は
 * 1件も触らない（isDefault 未設定は既存の作法どおり「自分の価格」として安全側に扱う）。
 */
export function planPriceRefresh(
  existing: readonly PriceRefreshEntry[],
  defaults: readonly PriceDefaultItem[],
): PriceRefreshPlan {
  const byName = new Map(defaults.map((d) => [normalizePriceName(d.name), d]))
  const targets: PriceRefreshTarget[] = []
  let keptByUser = 0
  let alreadyCurrent = 0
  for (const entry of existing) {
    if (entry.isDefault !== true) {
      keptByUser += 1
      continue
    }
    const target = entry.id == null ? undefined : byName.get(normalizePriceName(entry.name))
    if (!target || (entry.pricePerUnit === target.pricePerUnit && entry.unit === target.unit)) {
      alreadyCurrent += 1
      continue
    }
    targets.push({
      id: entry.id!,
      name: entry.name,
      fromPricePerUnit: entry.pricePerUnit,
      fromUnit: entry.unit,
      toPricePerUnit: target.pricePerUnit,
      toUnit: target.unit,
    })
  }
  return { targets, keptByUser, alreadyCurrent }
}

/**
 * 押す前に出す確認の中身（規約F: 変わるもの・変わらないものを件数つきで両方書く）。
 * 文言そのものは src/i18n/ja.ts が持ち、ここは件数と食材名の差し込みだけを行う。
 */
export function priceRefreshConfirm(plan: PriceRefreshPlan): ConfirmContent {
  const count = plan.targets.length
  const shownNames = plan.targets
    .slice(0, PRICE_REFRESH_NAME_LIMIT)
    .map((target) => target.name)
    .join('・')
  const names =
    count > PRICE_REFRESH_NAME_LIMIT ? `${shownNames}${ja.priceMaster.refreshMoreNames}` : shownNames
  return {
    title: ja.priceMaster.refreshConfirmTitle.replace('{n}', String(count)),
    bullets: [
      {
        label: ja.priceMaster.refreshChangedLabel,
        text: ja.priceMaster.refreshChanged.replace('{n}', String(count)).replace('{names}', names),
      },
      {
        label: ja.priceMaster.refreshKeptLabel,
        text: ja.priceMaster.refreshKept.replace('{n}', String(plan.keptByUser)),
      },
    ],
    notes: [ja.priceMaster.refreshUndoNote],
    confirmLabel: ja.priceMaster.refreshConfirmAction,
  }
}
