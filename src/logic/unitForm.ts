import { parseUnitQuantity } from './priceEstimate'

/**
 * 「食材と価格」の単位入力UI(数量＋単位選択)の純関数部分。
 * 2026-07-15にIngredientPricesPage.tsx内で作った「単位欄(自由入力)を数量(数字)＋単位(選択)に
 * 分離する」仕組みを、2026-07-16裁定1(原価ビュー全面改修)の編集モーダルからも使うため
 * IngredientPricesPageから切り出した(単体テスト対象・UnitQuantityFieldsコンポーネントと対で使う)。
 * 挙動はIngredientPricesPageの2026-07-15実装から一切変えていない(オーナー指示: 挙動変更ゼロ)。
 * 並び順は使用頻度順(Fable設計確定)。保存形式はDBスキーマ変更なしを保つため
 * 従来どおり1つの文字列に合成する。
 */
export const KNOWN_UNITS = [
  'g', 'kg', '個', '本', '枚', 'ml', 'L', '大さじ', '小さじ', 'カップ',
  '玉', '束', 'パック', 'かけ', '片', '株', '尾', '切れ', '丁', '袋', '缶', '房', '節',
] as const
const KNOWN_UNIT_SET = new Set<string>(KNOWN_UNITS)
/** 大さじ/小さじ/カップだけ単位が先(例:「大さじ1」)。それ以外は数量が先(例:「100g」「1個」) */
export const UNIT_FIRST = new Set<string>(['大さじ', '小さじ', 'カップ'])
/** 単位選択で「その他」を選んだ状態を表す内部値(表示文言=ja.priceMaster.unitOtherとは独立させる) */
export const OTHER_UNIT = 'other'

export interface UnitFormState {
  /** 数量入力欄の生の文字列(その他選択時は使わない) */
  qty: string
  /** KNOWN_UNITSのいずれか、またはOTHER_UNIT */
  unitKind: string
  /** その他選択時の自由入力欄の文字列 */
  freeText: string
}

/**
 * 保存済みのunit文字列(例:「100g」「1個」「大さじ1」)を編集フォームの初期値に分解する。
 * priceEstimate.tsのparseUnitQuantityで数量+単位に分解できて、かつ単位が選択肢にある
 * 場合だけ数量欄＋単位選択で表せる。それ以外(「1杯」「少々」「1/4個」等、選択肢に無い単位や
 * 分解できない書式)は「その他」＋自由入力欄へフォールバックし、元の文字列をそのまま見せる。
 */
export function decomposeUnit(raw: string): UnitFormState {
  const trimmed = raw.trim()
  if (trimmed) {
    const { qty, baseUnit } = parseUnitQuantity(trimmed)
    if (qty > 0 && KNOWN_UNIT_SET.has(baseUnit)) {
      return { qty: String(qty), unitKind: baseUnit, freeText: '' }
    }
  }
  return { qty: '', unitKind: OTHER_UNIT, freeText: trimmed }
}

/**
 * 数量欄＋単位選択(またはその他の自由入力)を、保存用の1つの文字列に合成する。
 * PRICE_DEFAULTSの既存表記(「100g」「1個」「大さじ1」等)と完全一致する形にすることが必須
 * （db/prices.tsのupdatePriceEntryのisDefault再判定が文字列比較のため。
 * 「デフォルトに戻す」表示条件に直結する）。
 * 数量が空・0以下、またはその他選択時に自由入力が空なら未入力扱いでundefinedを返す
 * （呼び出し側で「空・0以下は保存しない」既存挙動を踏襲する）。
 */
export function composeUnit(state: UnitFormState): string | undefined {
  if (state.unitKind === OTHER_UNIT) {
    const trimmed = state.freeText.trim()
    return trimmed || undefined
  }
  const qty = Number(state.qty)
  if (!(qty > 0)) return undefined
  const qtyStr = String(qty)
  return UNIT_FIRST.has(state.unitKind) ? `${state.unitKind}${qtyStr}` : `${qtyStr}${state.unitKind}`
}
