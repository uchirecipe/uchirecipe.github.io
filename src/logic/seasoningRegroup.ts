/**
 * 材料の並びを見て、印（●・☆・A など）から合わせ調味料の組を作り直す（2026-08-26 便LG）。
 *
 * ## なぜ要るか（オーナー原文・ビビンバ）
 * 「調味料の頭の印を削除するようにしたが、手順に『●の調味料を合わせておく』とあり、
 *  合わせ調味料の設定は自動で出来ていないので、これではただ目印が消えただけになっている。」
 *
 * 実測（2026-08-26 便LG）: 貼り付け取り込み（logic/parseRecipeText.ts の
 * assignSeasoningGroupsByMark）と URL取り込み（logic/urlImportRows.ts）は、印から組を
 * 正しく作っていた。**組にならず印だけ消えるのは、この2つを通らない道**だった:
 *   ①材料の速記入力（1行ずつ足す「まとめて入力」）＝印はメモへ移るが組は常に付かない。
 *     1行ずつ足すので「同じ印が2件以上」の判定を**その1行だけ**では下しようがない。
 *   ②取り込み元が見出し（「【A】」「合わせ調味料」）で組を持っていた回（hasExplicitGroup）や、
 *     4組を超えた印。あとから印で作り直す道が画面のどこにも無かった。
 * どちらも「印は名前から外して残っているのに、組にならない」＝オーナーの言うとおりの状態になる。
 *
 * ## ここが持つもの
 * すでにフォームの行になっている材料（名前・メモ・組）を受け取り、**印から組を作り直す**純ロジック。
 * 判定の規則そのものは貼り付け取り込みと同じもの（assignSeasoningGroupsByMark）を使う
 * ＝同じレシピが、貼り付けたときと速記入力で違う組になることが構造的に起きない。
 */

import { assignSeasoningGroupsByMark } from './parseRecipeText'
import { SEASONING_MARK_CHARS } from './seasoningGroup'

/** メモの先頭に残した印（「● なければ〜」の●）。取り込みも速記入力もここへ残す */
const MEMO_MARK_HEAD = new RegExp(`^([${SEASONING_MARK_CHARS}])[ 　\t]*`)

/** 組を作り直せる材料の行（RecipeFormPage の IngredientRow と同じ形の一部） */
export interface SeasoningRow {
  name: string
  memo: string
  group: number | undefined
}

/**
 * 印から組を作り直す。**材料が出そろってから1回だけ**呼ぶ（押されたときだけ）。
 *
 * - **すでに組が1つでも付いていたら何もしない**。取り込み元が決めた組や、丸ボタンで人が
 *   決めた色を、印の都合で塗り替えないため（取り込み側の「どちらか一方だけを使う」と同じ考え方）。
 * - 印はメモの先頭から読む（名前からは取り込み時点で外れている）。英字の印は名前の先頭から
 *   assignSeasoningGroupsByMark が読む。
 * - **組にならなかった行は、名前もメモも1文字も変えずに返す**。判定の本体
 *   （assignSeasoningGroupsByMark）は、全部の材料に付いた飾りの印をメモから落とす作りだが、
 *   ここは既にフォームに入っている行を触るので、落とすと**人が書いた文字が消える**。
 *
 * **1行足すたびに呼んではいけない**（2026-08-26 便LG・実測）。材料が3件そろう前に呼ぶと、
 * ①2件そろった時点で「全部の材料に同じ印」＝飾り扱いになり、印がメモから消える
 * ②先に組が1つできると、上の歯止めで以降の行が組にならない
 * の2つが起きて、4件の●が2件しか組にならなかった。**押されたときだけ・並び全体で**判定する。
 */
export function regroupIngredientRowsByMark<T extends SeasoningRow>(rows: readonly T[]): T[] {
  if (rows.some((row) => row.group != null)) return rows.slice()
  const parsed = rows.map((row) => {
    const matched = row.memo.match(MEMO_MARK_HEAD)
    return {
      name: row.name,
      // 分量・単位は組の判定に使わないので空で渡す（返ってきた値も読まない）
      amount: '',
      unit: '',
      // 印はいったんメモから外して mark として渡す（外さないと組にしたときに二重に付く）
      memo: matched ? row.memo.slice(matched[0].length) : row.memo,
      ...(matched ? { mark: matched[1] } : {}),
    }
  })
  const marked = assignSeasoningGroupsByMark(parsed)
  return rows.map((row, i) =>
    marked[i].group == null
      ? row // 組にならなかった行は元のまま（メモの印も名前も触らない）
      : { ...row, name: marked[i].name, memo: marked[i].memo ?? '', group: marked[i].group },
  )
}

/**
 * 印から作れる組の数（実際には作らない）。
 * 「印から組を作る」ボタンを出すかどうかの判定に使う＝押しても何も起きないボタンを出さないため。
 */
export function countSeasoningGroupsFromMarks(rows: readonly SeasoningRow[]): number {
  if (rows.some((row) => row.group != null)) return 0
  const grouped = regroupIngredientRowsByMark(rows)
  return new Set(grouped.map((row) => row.group).filter((g): g is number => g != null)).size
}
