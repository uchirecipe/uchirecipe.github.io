/**
 * URL取り込みの結果(Worker応答)をフォームの行へ落とし込む前処理(2026-07-28 便BX/C07・C08・C09)。
 *
 * RecipeFormPage.tsx から切り出して vite非依存にしてあり、scripts/test-logic.mjs から
 * 直接テストできる(urlImportImage.ts・urlImportReason.ts と同じ作法)。
 *
 * ここでやること:
 * - C07: 貼り付け経路のゴミ行判定(EXACT/PREFIX/REGEX)を材料・手順にも通す(経路間の非対称の解消)
 * - C08: 材料のグループ情報(「A水」のA / 「合わせ調味料」等の見出し行)を、捨てずに
 *        合わせ調味料グループ(seasoningGroup)と材料メモへ引き継ぐ
 * - C09: 分量を読み取れなかった材料の件数を数えられるようにする(取り込み結果の内訳表示用)
 */
import {
  assignSeasoningGroupsByMark,
  isImportGomiLine,
  isIngredientGroupHeading,
  normalizeImportedIngredient,
} from './parseRecipeText'
import { MAX_SEASONING_GROUP } from './seasoningGroup'

/** Worker応答の材料1件(src/logic/urlImport.ts の ImportedIngredient と同じ形) */
export interface ImportedIngredientLike {
  name: string
  amount?: string
  group?: string
}

/** フォームの材料行(RecipeFormPage.tsx の IngredientRow と同じ形) */
export interface ImportedIngredientRow {
  name: string
  amount: string
  unit: string
  memo: string
  group: number | undefined
}

/**
 * グループ記号(A/B/…)を合わせ調味料グループ番号(1〜MAX_SEASONING_GROUP)に対応づける。
 * 上限を超える記号(Eより後ろ)は色が一周して別グループと見分けが付かなくなるため未設定にする
 * (記号自体は材料メモに残るので情報は失われない)。
 */
export function seasoningGroupFromLetter(letter: string | undefined): number | undefined {
  if (!letter) return undefined
  const normalized = letter.trim().normalize('NFKC').toUpperCase()
  if (!/^[A-Z]$/.test(normalized)) return undefined
  const index = normalized.charCodeAt(0) - 'A'.charCodeAt(0) + 1
  return index <= MAX_SEASONING_GROUP ? index : undefined
}

/**
 * 手順の配列からゴミ行(SNS名だけの行・URLだけの行・ハッシュタグ行など)を落とす。
 * 全部落ちてしまう場合だけは判定を疑って元のまま返す(取り込みが丸ごと空になる事故を防ぐ安全弁)。
 */
export function filterImportedSteps(steps: string[]): string[] {
  const kept = steps.filter((text) => !isImportGomiLine(text))
  return kept.length > 0 || steps.length === 0 ? kept : steps
}

/**
 * Worker応答の材料をフォームの行に変換する。
 * - ゴミ行は落とす(C07)
 * - 分量を持たないグループ見出し行(「合わせ調味料」「【A】」等)は材料にせず、
 *   それ以降の材料を1つのグループとしてまとめる(C08)
 * - 「A水」のようにグループ記号が付いていた材料は、記号をメモに残しつつグループ色を割り当てる(C08)
 *
 * 材料が1件も残らない場合は判定を疑い、ゴミ除去も見出し判定もしない素の変換に戻す(安全弁)。
 */
export function buildImportedIngredientRows(
  ingredients: ImportedIngredientLike[],
): ImportedIngredientRow[] {
  const toRow = (
    ing: ImportedIngredientLike,
    group: number | undefined,
    keepGroupLabel: boolean,
  ): ImportedIngredientRow => {
    const parsed = normalizeImportedIngredient(ing.name, ing.amount)
    // グループ記号は材料名には戻さない(栄養・原価の名前照合を壊さないため)。
    // 手順文の「Aを加えて」を材料側から追えるよう、メモの先頭にだけ残す
    const memo = [keepGroupLabel ? ing.group : undefined, parsed.memo].filter(Boolean).join(' ')
    return {
      name: parsed.name,
      amount: parsed.amount,
      unit: parsed.unit,
      memo,
      group,
    }
  }

  const rows: ImportedIngredientRow[] = []
  /** 印から組を決めるための控え(行と同じ並び。2026-08-14 便GF) */
  const marks: (string | undefined)[] = []
  let headingGroup = 0
  let hasExplicitGroup = false
  for (const ing of ingredients) {
    if (isImportGomiLine(ing.name)) continue
    const parsed = normalizeImportedIngredient(ing.name, ing.amount)
    // 見出しと判定してよいのは「分量も単位も持たない行」だけ(実材料を誤って消さないための条件)
    if (!parsed.amount && !parsed.unit && isIngredientGroupHeading(parsed.name)) {
      headingGroup++
      continue
    }
    const letterGroup = seasoningGroupFromLetter(ing.group)
    const currentHeadingGroup =
      headingGroup >= 1 && headingGroup <= MAX_SEASONING_GROUP ? headingGroup : undefined
    const group = letterGroup ?? currentHeadingGroup
    if (group != null) hasExplicitGroup = true
    rows.push(toRow(ing, group, true))
    marks.push(parsed.mark)
  }
  if (rows.length === 0 && ingredients.length > 0) {
    return ingredients.map((ing) => toRow(ing, seasoningGroupFromLetter(ing.group), true))
  }
  // 取り込み元がグループを持たないとき(見出しも「A水」の記号も無い)だけ、材料名の先頭に
  // 付いた印(☆・◎・A等)から組を決める(2026-08-14 便GF・貼り付け取り込みと同じ規則)。
  // 取り込み元の組と混ぜると番号が衝突するので、**どちらか一方だけ**を使う
  if (!hasExplicitGroup) {
    const marked = assignSeasoningGroupsByMark(
      rows.map((row, i) => ({
        name: row.name,
        amount: row.amount,
        unit: row.unit,
        ...(row.memo ? { memo: row.memo } : {}),
        ...(marks[i] ? { mark: marks[i] } : {}),
      })),
    )
    return rows.map((row, i) => ({
      ...row,
      name: marked[i].name,
      memo: marked[i].memo ?? '',
      group: marked[i].group,
    }))
  }
  return rows
}

/** 分量も単位も読み取れなかった材料(名前だけの行)の件数。取り込み結果の内訳表示に使う(C09) */
export function countAmountlessRows(rows: ImportedIngredientRow[]): number {
  return rows.filter((row) => !row.amount.trim() && !row.unit.trim()).length
}
