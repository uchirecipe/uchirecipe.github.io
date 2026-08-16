import { ja } from '../i18n/ja'
import type { ConfirmContent } from './confirmContent'

/**
 * レシピをまとめて削除するときに「何が消えて何が残るか」を数える純ロジック
 * （2026-08-02 便CT・規約F）。文言そのものは src/i18n/ja.ts が持ち、ここは件数の勘定と
 * 差し込みだけを行う（scripts/test-logic.mjs で固定する）。
 *
 * 1品削除（RecipeFormPage の confirmDelete・2026-07-29 便CI/C01）と同じ範囲を数える:
 * db/recipes.ts の deleteRecipe / deleteRecipes は同じトランザクションで
 * 「作った記録（写真ごと）」「週の献立の予定」「今日の献立」も一緒に消すため、
 * まとめて削除でも同じものを件数付きで告げる必要がある。
 */

/** 削除の巻き添えを数えるのに必要な、レシピ1品分の最小情報 */
export interface RecipeDeleteTarget {
  /** 同梱の基本レシピか（配布セット由来もtrueなので sourceSetId と併せて判定する） */
  isStarter?: boolean
  /** 配布セット由来のレシピのセットID。あるものは削除でトゥームストーンが残り復活しない */
  sourceSetId?: string
  /** 「作った！」の記録（写真は各記録に埋め込まれている） */
  cookedLogs?: readonly { photo?: unknown }[]
}

export interface RecipeDeleteImpact {
  /** 削除するレシピの品数 */
  recipes: number
  /**
   * そのうち「設定画面の『基本レシピを入れ直す』で戻せる」品数。
   * = 同梱の基本レシピ（isStarter かつ sourceSetId なし）。配布セット由来（sourceSetId あり）は
   *   削除時にトゥームストーン（再取込除外の記録）が残り入れ直しでも復活しないので数に入れない。
   */
  restorableStarters: number
  /** 一緒に消える「作った！」記録の件数 */
  cookedLogs: number
  /** そのうち写真つきの枚数 */
  photos: number
  /** 一緒に消える週の献立の予定の件数 */
  mealPlanEntries: number
  /** 一緒に消える「今日の献立」の件数 */
  todayEntries: number
  /** 削除したあとに残るレシピの品数 */
  remaining: number
}

/** 「入れ直しで戻せる基本レシピ」か（配布セット由来はトゥームストーンで復活しないので false） */
export function isRestorableStarter(target: RecipeDeleteTarget): boolean {
  return target.isStarter === true && target.sourceSetId == null
}

/**
 * 削除対象のレシピと、周辺テーブルの件数から「消えるもの／残るもの」をまとめる。
 * 残るレシピ数は端末上の全レシピ数から削除対象を引いた実数（一覧の絞り込みや
 * 「基本レシピを表示しない」設定の影響を受けない生の件数）で数える。
 */
export function summarizeRecipeDeleteImpact(
  targets: readonly RecipeDeleteTarget[],
  counts: { totalRecipes: number; mealPlanEntries: number; todayEntries: number },
): RecipeDeleteImpact {
  let cookedLogs = 0
  let photos = 0
  let restorableStarters = 0
  for (const target of targets) {
    const logs = target.cookedLogs ?? []
    cookedLogs += logs.length
    photos += logs.filter((log) => !!log.photo).length
    if (isRestorableStarter(target)) restorableStarters += 1
  }
  return {
    recipes: targets.length,
    restorableStarters,
    cookedLogs,
    photos,
    mealPlanEntries: counts.mealPlanEntries,
    todayEntries: counts.todayEntries,
    remaining: Math.max(0, counts.totalRecipes - targets.length),
  }
}

/**
 * まとめて削除の確認の中身を組み立てる（規約F: 何が消えるか／何が残るかを件数つきで両方書く）。
 * 基本レシピが含まれるときだけ、入れ直しで戻せることを補足として足す。
 * 規約H: 場所は指示語ではなく画面名・ボタン名で言う。
 *
 * 2026-08-15 便GW: 素のダイアログ（window.confirm）から画面の中の窓へ移したので、
 * 1本の長い文ではなく「消えるもの」「残るもの」の2項目として返す。
 *
 * 2026-08-16 便GZ（オーナー承認）: 削除しても「作った記録」は端末に残るようになったので、
 * 記録の件数を「消えるもの」から「残るもの」へ移した。
 * 記録が0件のときは残り方の補足を出さない（残るものが無いのに残り方を説明しない）。
 */
export function buildBulkDeleteConfirm(impact: RecipeDeleteImpact): ConfirmContent {
  const t = ja.recipes
  const notes: string[] = []
  if (impact.cookedLogs > 0) notes.push(t.bulkDeleteConfirmLogsNote)
  if (impact.restorableStarters > 0) {
    notes.push(t.bulkDeleteConfirmStarter.replace('{s}', String(impact.restorableStarters)))
  }
  return {
    title: t.bulkDeleteConfirmTitle.replace('{r}', String(impact.recipes)),
    bullets: [
      {
        label: t.bulkDeleteConfirmGoneLabel,
        text: t.bulkDeleteConfirmGone
          .replace('{m}', String(impact.mealPlanEntries))
          .replace('{t}', String(impact.todayEntries)),
      },
      {
        label: t.bulkDeleteConfirmKeptLabel,
        text: t.bulkDeleteConfirmKept
          .replace('{n}', String(impact.cookedLogs))
          .replace('{p}', String(impact.photos))
          .replace('{rest}', String(impact.remaining)),
      },
    ],
    notes,
    confirmLabel: t.bulkDeleteConfirmOk,
  }
}

/**
 * 1品削除の確認の中身（RecipeFormPage の「このレシピを削除」）。
 * まとめて削除（buildBulkDeleteConfirm）と同じ規則で組み立てるため、画面側ではなくここに置く
 * （置き場所が分かれると、片方だけ直して2つの確認文の言うことが食い違う）。
 */
export function buildSingleDeleteConfirm(logs: {
  cookedLogs: number
  photos: number
}): ConfirmContent {
  const t = ja.form
  return {
    title: t.confirmDeleteTitle,
    bullets: [
      { label: t.confirmDeleteGoneLabel, text: t.confirmDeleteGone },
      {
        label: t.confirmDeleteKeptLabel,
        text: t.confirmDeleteKept
          .replace('{n}', String(logs.cookedLogs))
          .replace('{p}', String(logs.photos)),
      },
    ],
    notes: logs.cookedLogs > 0 ? [t.confirmDeleteLogsNote] : [],
    confirmLabel: t.confirmDeleteOk,
  }
}
