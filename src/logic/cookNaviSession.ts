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

/**
 * レシピ詳細を見に行くときの「ナビのどこを見ていたか」（2026-08-08 便EG・オーナー実機報告
 * 「レシピ詳細リンクから戻ると、ナビの末尾に戻りたい。現在は別の場所に戻る」）。
 *
 * 段取りの下にあるレシピ名のリンクは、タイムラインを最後まで読んでから押すことが多い。
 * 押した時点の縦スクロール位置を覚えておき、戻ってきたら同じ位置に戻す
 * （週タブの居場所の覚え方 logic/navMemory.ts と同じ作法）。読んだら消す＝1回だけ効く。
 */
export const COOK_NAVI_SCROLL_KEY = 'uchi-recipe-cook-navi-scroll'

export function saveCookNaviScroll(scrollY: number): void {
  try {
    sessionStorage.setItem(COOK_NAVI_SCROLL_KEY, String(Math.max(0, Math.round(scrollY))))
  } catch {
    /* 覚えられない環境では、戻ったときに先頭から読むだけ */
  }
}

/** 覚えた位置を読み出して消す。覚えていない・壊れているときは undefined */
export function takeCookNaviScroll(): number | undefined {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(COOK_NAVI_SCROLL_KEY)
    sessionStorage.removeItem(COOK_NAVI_SCROLL_KEY)
  } catch {
    return undefined
  }
  if (raw == null) return undefined
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : undefined
}
