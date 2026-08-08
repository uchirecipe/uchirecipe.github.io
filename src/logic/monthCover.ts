/**
 * 月カレンダーの各セルに敷く「その日の1枚」の選び方（2026-08-07 便DU・オーナー指示）。
 *
 * オーナー指示は3つ:
 *  ① その日の「作った記録」の写真 ＞ レシピに登録されている写真、の順で選ぶ
 *  ② 「レシピの写真は使わない」を選んだら、作った記録の写真だけを出す
 *  ③ その日に複数品あるときは、どの料理の写真をカレンダーに出すか日ごとに選べる
 *
 * 便DU以前の実装は「その日の**先頭の記録**の写真 ?? その先頭の記録のレシピの写真」だったため、
 * 1品目に写真が無く2品目に写真がある日は、自分で撮った写真ではなくレシピの写真が出ていた
 * （＝オーナーの言う「レシピのサムネしか出ない」の実際の原因）。ここでは日の記録すべてを
 * 見て「記録の写真」を先に探し切ってから、レシピの写真に落ちる。
 *
 * 画面（MealPlanPage）から切り出した純関数で、Blobの中身は一切見ない
 * （テストしやすいように写真の型を差し替えられる形にしてある）。
 */

/** カレンダーの1日ぶんの写真候補。並びは「その日の記録の並び順」＝先に作った順ではなく取得順 */
export type DayCoverCandidate<TPhoto = Blob> = {
  /** その記録が指すレシピのid。日ごとの「どれを出すか」の選択を覚える鍵にもなる */
  recipeId: number
  /** 作った記録に添付された写真（自分で撮った写真）。無ければ undefined */
  logPhoto?: TPhoto
  /** レシピに登録されている写真。無ければ undefined */
  recipePhoto?: TPhoto
}

/** 選ばれた1枚と、それがどちらの写真なのか */
export type DayCoverPick<TPhoto = Blob> = {
  photo: TPhoto
  /** 'log'＝作った記録の写真 / 'recipe'＝レシピに登録されている写真 */
  source: 'log' | 'recipe'
  recipeId: number
}

export type DayCoverOptions = {
  /**
   * この日にユーザーが選んだレシピのid（③）。その候補から写真が取れればそれを使う。
   * 選んだ料理の写真が後から消された等で1枚も取れないときは、既定の優先順に落とす
   * （選択が残っているせいでカレンダーの写真が消える、という分かりにくい状態を作らない）。
   */
  chosenRecipeId?: number
  /** 「レシピの写真は使わない」（②）。true なら recipePhoto は一切使わない */
  hideRecipePhoto?: boolean
}

/** 1件の候補から1枚取り出す（記録の写真＞レシピの写真） */
function pickFrom<TPhoto>(
  candidate: DayCoverCandidate<TPhoto>,
  hideRecipePhoto: boolean,
): DayCoverPick<TPhoto> | undefined {
  if (candidate.logPhoto) {
    return { photo: candidate.logPhoto, source: 'log', recipeId: candidate.recipeId }
  }
  if (!hideRecipePhoto && candidate.recipePhoto) {
    return { photo: candidate.recipePhoto, source: 'recipe', recipeId: candidate.recipeId }
  }
  return undefined
}

/**
 * その日のカレンダーセルに敷く1枚を決める。1枚も無ければ undefined（＝セルは従来の文字表示）。
 */
export function pickDayCoverPhoto<TPhoto>(
  candidates: DayCoverCandidate<TPhoto>[],
  options: DayCoverOptions = {},
): DayCoverPick<TPhoto> | undefined {
  const hideRecipePhoto = options.hideRecipePhoto === true
  // ③ 日ごとの選択が最優先。同じレシピを1日に2回作った日は、写真のある方を採る
  if (options.chosenRecipeId != null) {
    const chosen = candidates.filter((c) => c.recipeId === options.chosenRecipeId)
    for (const candidate of chosen) {
      const pick = pickFrom(candidate, hideRecipePhoto)
      if (pick) return pick
    }
  }
  // ① 記録の写真をその日ぜんぶから先に探す
  for (const candidate of candidates) {
    if (candidate.logPhoto) {
      return { photo: candidate.logPhoto, source: 'log', recipeId: candidate.recipeId }
    }
  }
  // ② レシピの写真は「使わない」を選んでいなければフォールバックとして使う
  if (hideRecipePhoto) return undefined
  for (const candidate of candidates) {
    if (candidate.recipePhoto) {
      return { photo: candidate.recipePhoto, source: 'recipe', recipeId: candidate.recipeId }
    }
  }
  return undefined
}

/**
 * 「この日はどの料理の写真を出すか」の選択（日付→レシピid）を更新した新しい記録を返す。
 * recipeId に undefined を渡すと、その日の選択を消して既定の優先順（自動）に戻す。
 * 選んでいない日は記録に載せない＝設定を無駄に太らせない。
 */
export function setDayCoverChoice(
  current: Record<string, number> | undefined,
  date: string,
  recipeId: number | undefined,
): Record<string, number> {
  const next = { ...(current ?? {}) }
  if (recipeId == null) delete next[date]
  else next[date] = recipeId
  return next
}
