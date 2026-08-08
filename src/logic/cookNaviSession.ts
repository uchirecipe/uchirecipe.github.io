/**
 * 並行調理ナビの「作りかけの段取り」を端末内に覚えておく（2026-08-08 便ED・オーナー実機
 * フィードバック「並行調理ナビは、戻るかまとめて作った！ボタン押下するまで献立タブに
 * 残ったままにしたい。画面移動するたびに段取りを作るところからやり直しになって面倒」）。
 *
 * 覚えるのは「どの品を選んだか」「段取りを表示中か」「お試しで使っている最中か」の3つだけで、
 * 段取りそのもの（タイムライン）は保存しない。レシピを直したら次に開いたときに組み直したいので、
 * 選択だけ覚えて計算はそのつどやり直す。
 *
 * 保存先は sessionStorage（レシピ登録フォームの下書きと同じ置き場）。
 * 消えるのは次の3つのときだけ:
 *   - ナビの「戻る」を押したとき
 *   - 「まとめて作った！」で記録したとき
 *   - タブ（アプリのウィンドウ）を閉じたとき
 * 他のタブへ移動しても、レシピを見に行っても残る。
 */

export const COOK_NAVI_SESSION_KEY = 'uchi-recipe-cook-navi-session'

export interface CookNaviSession {
  /** 選んでいるレシピID（選んだ順＝色の順） */
  selectedIds: number[]
  /** 段取りを表示中か（「段取りを作る」を押した状態） */
  showTimeline: boolean
  /**
   * お試し（未解錠で3回まで）で使っている最中か。
   * これを覚えていないと、他のタブへ行って戻るたびにお試しの回数を1回ずつ失う。
   */
  trialActive: boolean
}

/** 保存された文字列を読む（形が違う・壊れているときは undefined＝覚えていない扱い） */
export function parseCookNaviSession(raw: string | null): CookNaviSession | undefined {
  if (!raw) return undefined
  try {
    const data = JSON.parse(raw) as Partial<CookNaviSession> | null
    if (!data || !Array.isArray(data.selectedIds)) return undefined
    const selectedIds = data.selectedIds.filter(
      (id): id is number => typeof id === 'number' && Number.isFinite(id),
    )
    if (selectedIds.length === 0) return undefined
    return {
      selectedIds,
      showTimeline: data.showTimeline === true,
      trialActive: data.trialActive === true,
    }
  } catch {
    return undefined
  }
}

export function loadCookNaviSession(): CookNaviSession | undefined {
  try {
    return parseCookNaviSession(sessionStorage.getItem(COOK_NAVI_SESSION_KEY))
  } catch {
    return undefined
  }
}

export function saveCookNaviSession(session: CookNaviSession): void {
  try {
    if (session.selectedIds.length === 0) {
      sessionStorage.removeItem(COOK_NAVI_SESSION_KEY)
      return
    }
    sessionStorage.setItem(COOK_NAVI_SESSION_KEY, JSON.stringify(session))
  } catch {
    /* 保存できない環境では覚えないだけ（従来どおり毎回組み直しになる） */
  }
}

export function clearCookNaviSession(): void {
  try {
    sessionStorage.removeItem(COOK_NAVI_SESSION_KEY)
  } catch {
    /* 何もしない */
  }
}

/** 段取りの続きが残っているか（常駐タイマーの戻り先をナビにするかの判断に使う） */
export function hasCookNaviTimeline(): boolean {
  return loadCookNaviSession()?.showTimeline === true
}
