import type { CookedLog, Recipe } from '../db/types'

/**
 * ボタン1回で付いた「作った！」の記録か（2026-08-10 便FF）。
 *
 * 献立の「作った！」「全て作った！」、並行調理ナビの「まとめて作った！」が付ける記録は、
 * 日付だけが入っていてメモも写真も無い。この形の記録は
 *  ①トーストの「元に戻す」で取り消してよい記録
 *  ②同じ日にもう一度押しても二重に付けない（2026-08-09 便EH）
 * の判定に使う。
 *
 * 判定材料に**食数（servings）を入れない**のが要点。便FFから、ボタン1回の記録にも
 * 食数が必ず入るようになった（枠に決めた食数、無ければ設定「食数の設定」の人数）。
 * 従来どおり「食数が未設定であること」を条件に残すと、便FF以降に付いた記録が
 * どちらの判定からも外れ、取り消せない・同じ日に何度でも二重に付く、という形で壊れる。
 *
 * メモ・写真のどちらかが入っている記録＝記録フォームで自分で書いた記録は対象外のまま
 * （押し間違いの取り消しが、手で書いた記録を巻き込まないようにするための歯止め）。
 */
export function isOneTapCookedLog(log: CookedLog, date: string): boolean {
  return log.date === date && log.note == null && log.photo == null
}

/**
 * 直近 days 日以内に「作った」記録があれば true。
 *
 * 2026-07-29 便CI/C08: 以前は cookedLogs[0] の1件だけを見ていたが、addCookedLog が
 * 日付を見ずに先頭へ積んでいたため、過去の日付を後から記録すると先頭＝最新ではなくなり
 * 「今日作ったばかりのレシピが14日以上作っていない扱い」になっていた。
 * 保存側（db/recipes.ts）を日付順に直したうえで、ここも保険として全件の最大日付を見る
 * （すでに順序が崩れて保存済みのデータでも正しく判定できるようにするため）。
 */
export function cookedWithinDays(recipe: Recipe, days: number): boolean {
  const last = recipe.cookedLogs.reduce<string | undefined>(
    (max, log) => (max !== undefined && max >= log.date ? max : log.date),
    undefined,
  )
  if (!last) return false
  const elapsed = Date.now() - new Date(last).getTime()
  return elapsed < days * 24 * 60 * 60 * 1000
}
