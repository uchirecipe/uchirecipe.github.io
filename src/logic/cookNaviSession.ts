/**
 * 並行調理ナビの「作りかけの段取り」を端末内に覚えておく（2026-08-08 便ED・オーナー実機
 * フィードバック「並行調理ナビは、戻るかまとめて作った！ボタン押下するまで献立タブに
 * 残ったままにしたい。画面移動するたびに段取りを作るところからやり直しになって面倒」）。
 *
 * 覚えるのは「どの品を選んだか」「段取りを表示中か」「お試しで使っている最中か」と、
 * 調理中の位置・色で並べ替えた指示だけで、段取りそのもの（タイムライン）は保存しない。
 * レシピを直したら次に開いたときに組み直したいので、**ユーザーが出した指示だけを覚えて
 * 計算はそのつどやり直す**（2026-08-10 便FI で並べ替えの指示を足したときも、この線は動かしていない）。
 *
 * 保存先は sessionStorage（レシピ登録フォームの下書きと同じ置き場）。
 * 消えるのは次の3つのときだけ:
 *   - ナビの「戻る」を押したとき
 *   - 「まとめて作った！」で記録したとき
 *   - タブ（アプリのウィンドウ）を閉じたとき
 * 他のタブへ移動しても、レシピを見に行っても残る。
 */

import type { CookCursor, StepPull } from './cookSession'

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
  /**
   * 調理中の手順（2026-08-09 便EL・docs/69）。全画面の調理中セッションを開いている間だけ入る。
   *
   * **書き込める調理の状態はこの1つだけ**にする。進み具合（済んだ手順の一覧）も、
   * 各品の次の手順も、段取りそのものも保存しない＝すべてこの1点から導く。
   * 覚えた手順が組み直した段取りに見つからないときは、推測せずカーソルを捨てて
   * 段取りの一覧表示に戻す（logic/cookSession.ts の resolveCursor）。
   */
  current?: CookCursor
  /**
   * 全画面の調理中モードを**いま開いているか**（2026-08-10 便FC・オーナー実機
   * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
   *
   * 便ELでは「カーソルが入っている＝開いている」と決めて閉じるときにカーソルを捨てていたため、
   * 開き直すと必ず①からになっていた。**捨てるのをやめる**と、位置と開閉が別のことになる。
   *
   * docs/69 の不変条件「書ける状態は1つだけ」は**調理の位置**についての決まりで、
   * ここはそれを破らない: 位置は今までどおり `current` の1か所だけに書き、
   * この値は `showTimeline` と同じ**画面の見せ方**の覚え書き（位置を持たない）。
   * `current` が無いときは意味を持たない＝保存も復元もしない、で二重管理を避ける。
   *
   * 覚えていないとき（この項目が無い古い覚え書き）は**開いていた扱い**にする。
   * 便ELまでは「カーソルがある＝開いている」だったので、その状態のまま更新した人が
   * 調理の途中で全画面を失わないようにするため。
   */
  sessionOpen?: boolean
  /**
   * 色で引き寄せた手順の並び（2026-08-10 便FI・docs/69 第3段）。
   * 「青」「緑」「ピンク」と言われたときに、その品の手順をいまの位置へ動かした記録で、
   * 1件ぶんは「どの手順を、どの手順の直前へ動かしたか」だけ。
   *
   * **これは導出できるものではなく、ユーザーが出した指示**なので `current` と同じ性質として
   * ここに置く（docs/69 の不変条件が禁じているのは、段取り・進み具合・済んだ手順の一覧という
   * **導出できるものを二重に持つこと**）。段取りは今までどおり毎回組み直し、そこへこの指示を
   * 当て直す（logic/cookSession.ts の applyStepPulls）ので、導出の一本道は変わらない。
   *
   * 保存しないと、読み込み直したときに並びだけが元へ戻り、カーソルより前の品が
   * 「作っていないのに完成」と出る（便FIで実機確認した症状）。
   *
   * 当て直せない1件（レシピを直して手順が消えた等）は黙って捨てる＝推測で近い場所に当てない。
   */
  pulls?: StepPull[]
}

/** 保存された値がカーソルの形をしているか（stepIndex はナビが足した工程で負になる） */
function parseCursor(value: unknown): CookCursor | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { recipeId, stepIndex } = value as Partial<CookCursor>
  if (typeof recipeId !== 'number' || !Number.isFinite(recipeId)) return undefined
  if (typeof stepIndex !== 'number' || !Number.isFinite(stepIndex)) return undefined
  return { recipeId, stepIndex }
}

/**
 * 保存された引き寄せの並びを読む（2026-08-10 便FI）。
 * 形が違う1件だけを捨て、残りは**保存された順のまま**返す（順番を変えると当て直した結果が変わる）。
 * この項目が無い古い覚え書きは空＝並べ替え無しとして読む。
 */
function parseStepPulls(value: unknown): StepPull[] {
  if (!Array.isArray(value)) return []
  const pulls: StepPull[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const { before, target } = entry as Partial<StepPull>
    const parsedBefore = parseCursor(before)
    const parsedTarget = parseCursor(target)
    if (!parsedBefore || !parsedTarget) continue
    pulls.push({ before: parsedBefore, target: parsedTarget })
  }
  return pulls
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
    const current = parseCursor(data.current)
    // 段取りを表示していない状態で調理中の手順だけが残ることはない（不整合は捨てる）
    const showTimeline = data.showTimeline === true
    const keepCursor = showTimeline && current != null
    // 並べ替えも調理中の位置と同じで、段取りを表示していない状態だけが残ることはない
    const pulls = keepCursor ? parseStepPulls(data.pulls) : []
    return {
      selectedIds,
      showTimeline,
      trialActive: data.trialActive === true,
      ...(keepCursor ? { current } : {}),
      // 開閉はカーソルがあるときだけ意味を持つ。覚えていなければ「開いていた」に倒す（上の解説）
      ...(keepCursor ? { sessionOpen: data.sessionOpen !== false } : {}),
      ...(pulls.length > 0 ? { pulls } : {}),
    }
  } catch {
    return undefined
  }
}

/**
 * 覚えている選択を、いま選べる品と突き合わせて整える（2026-08-09 便EH・オーナー実機報告
 * 「並行調理中に献立タブから1品だけ『作った！』すると、候補からは消えるのに段取りには
 * 組み込まれたまま。段取りを作るを押しても無反応。選び直しても作った品が残り、削除できない。
 * まとめて作った！するとその品が再度記録され、記録が2つになる」）。
 *
 * 原因は、覚えていた選択（selectedIds）と、いま選べる品（今日の献立から、今日すでに作った品を
 * 除いたもの）を**一度も突き合わせていなかった**こと。作った記録が付いた品は候補一覧から
 * 消えるので画面からは外せなくなり、段取りと「まとめて作った！」の対象にだけ残り続けていた。
 *
 * ここでは「いま選べる品に無いIDを落とす」だけを行う純粋な関数にして、
 * 画面・端末内の覚え書きの両方が同じ規則で整えられるようにする。
 */
export function reconcileSelectedIds(
  selectedIds: readonly number[],
  availableIds: readonly number[],
): number[] {
  const available = new Set(availableIds)
  return selectedIds.filter((id) => available.has(id))
}

/**
 * 調理中（全画面のセッションを開いている間）は、**記録を段取りへ逆流させない**
 * （2026-08-09 便EL・docs/69「記録は一方通行」）。
 *
 * 実行中の段取りの母集合は `selectedIds` だけと決める。調理の最中に献立タブや別の端末操作で
 * 1品に「作った！」が付くと、その品は候補一覧（今日の献立から今日作った品を除いたもの）から
 * 消える。ここで選択まで落とすと、**作りかけの段取りが目の前で組み替わる**
 * ＝2026-08-09 に実発した重大バグと同じ壊れ方になる。
 *
 * 調理を終える（カーソルを捨てる）と、次に整合を取るときに従来どおり落ちる。
 *
 * **`availableIds` が undefined のときは何も落とさない**（2026-08-09 便ES・オーナー実機報告
 * 「画面を離れて戻ると段取りが消える／『今日の献立にない品を、組み合わせから外しました。』が出る」
 * の根本原因）。今日の献立の候補は「今日の献立リスト」「今週の献立の予定」「レシピ本体」の
 * 3つの読み込みが揃って初めて決まる。1つでも読み込み中なら候補は**まだ分からない**のであって、
 * 「候補ゼロ」ではない。読み込み中を候補ゼロと読むと、画面を開いた一瞬で選択を全部落とし、
 * 段取りも覚え書きも消える（docs/69「レシピ未読込を候補ゼロと誤読しない」）。
 */
export function reconcileSelectedIdsForSession(
  selectedIds: readonly number[],
  availableIds: readonly number[] | undefined,
  cookingInProgress: boolean,
): number[] {
  // 候補がまだ読めていない（undefined）＝「候補ゼロ」ではない。ここを取り違えると、
  // 画面を開き直したその一瞬に選択を全部捨ててしまう（2026-08-09 便ES・下の解説）
  if (availableIds === undefined) return [...selectedIds]
  if (cookingInProgress) return [...selectedIds]
  return reconcileSelectedIds(selectedIds, availableIds)
}

/** 段取りを組める品数（これ未満になったら段取りは出せない） */
export const COOK_NAVI_MIN_RECIPES = 2

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

/**
 * お試し（未解錠で3回まで）の1回ぶんを終える（2026-08-09 便ES）。**段取りは残す**。
 *
 * 便ED では「戻る」で覚え書きごと消していたので、お試しの1回もそこで終わっていた。
 * 便ES で「戻る」は画面を移るだけに変えた（段取りが消えるとオーナー報告の不具合になる）ため、
 * お試しの区切りだけをここで付ける。次に並行調理ナビを開くと残り回数の案内に戻り、
 * もう一度お試しを始めれば、覚えていた段取りの続きから使える。
 */
export function endCookNaviTrial(): void {
  const session = loadCookNaviSession()
  if (!session?.trialActive) return
  saveCookNaviSession({ ...session, trialActive: false })
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
