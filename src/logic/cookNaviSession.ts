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
 * ## 保存先と寿命（2026-08-12 便FT・利用者テスト「アプリを開き直すと、段取りも途中の位置も
 * 消える。タイマーの残り時間は開き直しても続いているのに、段取りだけ消えるのはちぐはぐ」）
 *
 * 便EDからここまでは sessionStorage（タブを閉じると消える置き場）だったため、料理中に
 * アプリが切り替わる・落ちるだけで段取りが失われていた。**localStorage（端末に残る置き場）へ移す**。
 *
 * ただしこの機能で怖いのは「消えること」より**間違ったものが残ること**なので、
 * 残す前に**捨てる条件**を決める。読み戻さないのは次の場合:
 *   1. 覚え書きの形の版（COOK_NAVI_SESSION_VERSION）が今のアプリと違う
 *      ＝古い形の位置を今の段取りに当てて、別の手順を開いてしまうのを防ぐ
 *   2. **覚えた日が今日でない**（昨日の段取りが today の献立の上に復活しない）
 *   3. 版・日付が読めない、JSONが壊れている、選んだ品が1品も無い
 *   4. 段取りを出していない（showTimeline が false）のに位置だけある不整合 → 位置と並べ替えを捨てる
 *      （並べ替えは段取りに付くものなので、**調理中の位置が無くても段取りがあれば読む**。
 *        2026-08-14 便GJ で段取りの一覧から手で並べ替えられるようにしたときに直した）
 * さらに読み戻したあとも、選択は今日の献立と突き合わせ（resolveCookNaviSelection）、
 * 位置は組み直した段取りに無ければ捨てる（cookSession.ts の resolveCursor）＝どちらも迂回しない。
 *
 * 日付は「最後に操作した日」を入れる（保存のたびに入れ直す）。日をまたいで使い続けている間は
 * 覚え書きもその日のものとして残り、いったんアプリを閉じて翌日に開くと捨てられる。
 *
 * 覚え書きが消えるのは次のとき:
 *   - ナビで「レシピを選び直す」を押したとき（選択が空になる）
 *   - 「まとめて作った！」で記録したとき
 *   - 日付が変わったあとにアプリを開いたとき（そのことは画面で知らせる）
 * **バックアップ（logic/backup.ts）には入れない**。作りかけの段取りはその日限りの覚え書きで、
 * 別の端末や別の日に持ち込むものではないため（2026-08-10 便FI でも同じ線を引いている）。
 */

import { todayString } from './date'
import type { CookCursor, StepPull } from './cookSession'

export const COOK_NAVI_SESSION_KEY = 'uchi-recipe-cook-navi-session'

/**
 * 覚え書きの形の版（2026-08-12 便FT）。端末に残るようになったぶん、**アプリを更新したあとに
 * 古い形の覚え書きを読んでしまう**ことがありうる。位置（current）や引き寄せ（pulls）の
 * 意味づけを変えるときはこの数字を1つ上げる＝古い覚え書きは読まずに捨てる。
 */
export const COOK_NAVI_SESSION_VERSION = 1

/**
 * 全画面の調理中モードを**いま開いているか**（2026-08-10 便FC・オーナー実機
 * 「一回閉じて再度開くと①に戻ってしまう。前回閉じた時の手順から再開したい」）。
 *
 * 2026-08-12 便FT: ここだけは **sessionStorage のまま**（タブを閉じると消える）にする。
 * 段取りと調理中の位置は端末に残すが、**アプリを開き直したときは必ず段取りの一覧に着地**し、
 * 「調理中モードの続きから見る」を本人が押して全画面に入る形にそろえるため。
 * 台所で位置を機械に当てさせない（docs/69「復元できなければ推測せずタイムラインへ」）のと
 * 同じ考えで、開き直した直後にいきなり大きな手順を出さず、段取り全体を見てから入れるようにする。
 * 読み込み直し（同じタブ）では今までどおり開いたまま続く。
 */
export const COOK_NAVI_OPEN_KEY = 'uchi-recipe-cook-navi-open'

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

/**
 * 保存された文字列を**形として**読む（形が違う・壊れているときは undefined＝覚えていない扱い）。
 * 版と日付で捨てるかどうかを決めるのは `restoreCookNaviSession` の役目で、画面はそちらを使う。
 * ここは「どこまでを読み取り、どこを不整合として落とすか」の規則を単体テストで固定するための入口。
 */
export function parseCookNaviSession(raw: string | null): CookNaviSession | undefined {
  if (!raw) return undefined
  try {
    const data = JSON.parse(raw) as Partial<CookNaviSession> | null
    return readCookNaviSession(data)
  } catch {
    return undefined
  }
}

/** 読み込んだJSONを覚え書きの形に整える（版・日付の判断は restoreCookNaviSession が先に済ませる） */
function readCookNaviSession(data: Partial<CookNaviSession> | null): CookNaviSession | undefined {
  if (!data || !Array.isArray(data.selectedIds)) return undefined
  const selectedIds = data.selectedIds.filter(
    (id): id is number => typeof id === 'number' && Number.isFinite(id),
  )
  if (selectedIds.length === 0) return undefined
  const current = parseCursor(data.current)
  // 段取りを表示していない状態で調理中の手順だけが残ることはない（不整合は捨てる）
  const showTimeline = data.showTimeline === true
  const keepCursor = showTimeline && current != null
  /**
   * 並べ替えは**段取りに付く**もので、調理中の手順があるかどうかとは関係ない
   * （2026-08-14 便GJ）。便FI では並べ替えの手立てが調理中モードの中にしか無かったので
   * 「位置があるときだけ読む」でも辻褄が合っていたが、段取りの一覧で手順を上下に動かせる
   * ようになった今、その読み方だと**調理中モードを開かずに並べ替えた人の並びだけが
   * 読み込み直しで消える**（画面を移って戻るたびに自動の並びへ戻ってしまう）。
   * 段取りを出していない覚え書きに並べ替えだけが残ることはない、という線はそのまま。
   */
  const pulls = showTimeline ? parseStepPulls(data.pulls) : []
  return {
    selectedIds,
    showTimeline,
    trialActive: data.trialActive === true,
    ...(keepCursor ? { current } : {}),
    ...(pulls.length > 0 ? { pulls } : {}),
  }
}

/**
 * 覚え書きを読み戻した結果（2026-08-12 便FT）。
 * 「読めなかった」と「捨てた」を分けて返すのは、**捨てたことを黙らない**ため
 * （黙って消すと 2026-08-09 の「段取りが毎回消える」と同じ見え方になる）。
 */
export type CookNaviRestore =
  /** 覚え書きが無い・うちの形ではない・中身が空（知らせることは何もない） */
  | { kind: 'none' }
  /**
   * 覚えていたが捨てた。`reason` は捨てた理由、`hadTimeline` / `hadCursor` は
   * 「利用者が失ったものがあるか」＝知らせを出すかどうかと、その言い方の判断に使う。
   */
  | { kind: 'expired'; reason: 'date' | 'version'; hadTimeline: boolean; hadCursor: boolean }
  | { kind: 'ok'; session: CookNaviSession }

/** 覚え書きに書き出す形（版と、最後に操作した日を添える） */
export function serializeCookNaviSession(session: CookNaviSession, today: string): string {
  return JSON.stringify({ v: COOK_NAVI_SESSION_VERSION, date: today, ...session })
}

/**
 * 保存された覚え書きを、**捨てる条件にかけてから**読み戻す（2026-08-12 便FT）。
 * 判断はこの純関数1か所に集め、画面側は結果を受け取るだけにする。
 */
export function restoreCookNaviSession(raw: string | null, today: string): CookNaviRestore {
  if (!raw) return { kind: 'none' }
  let data: (Partial<CookNaviSession> & { v?: unknown; date?: unknown }) | null
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { kind: 'none' }
  }
  if (!data || typeof data !== 'object') return { kind: 'none' }
  // 版も日付も無いものは、うちが書いた覚え書きではない扱いで黙って捨てる
  if (typeof data.v !== 'number' || typeof data.date !== 'string') return { kind: 'none' }
  // 中身の形が読めるかを先に見る（何を失うのかを知らせに書けるようにするため）
  const session = readCookNaviSession(data)
  const hadTimeline = session?.showTimeline === true
  const hadCursor = hadTimeline && session?.current != null
  if (data.v !== COOK_NAVI_SESSION_VERSION) {
    return { kind: 'expired', reason: 'version', hadTimeline, hadCursor }
  }
  if (data.date !== today) {
    return { kind: 'expired', reason: 'date', hadTimeline, hadCursor }
  }
  if (!session) return { kind: 'none' }
  return { kind: 'ok', session }
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
 * **`cookingInProgress` は「全画面をいま開いているか」**（2026-08-12 便FT で言葉どおりに戻した）。
 * 「調理中の位置を覚えているか」で判断すると、位置を端末に残すようになった今、
 * 一度でも調理中モードを開いた日は整合が一日中働かない＝今日の献立から消えた品が
 * 段取りに残り続ける。全画面を閉じて段取りの一覧に戻った時点で、組み直した姿を見せる。
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

/** 一度に組み合わせられる品数の上限 */
export const COOK_NAVI_MAX_RECIPES = 3

/**
 * 何も選んでいないところから、あらかじめ選んでおく品（今日の献立の先頭から上限まで）。
 * 画面を初めて開いたときと、覚えていた選択が1品も残らなかったときの両方でこれを使う
 * ＝「初めて開いた状態」の作り方を1か所に持つ。
 */
export function pickDefaultSelectedIds(availableIds: readonly number[]): number[] {
  return availableIds.slice(0, COOK_NAVI_MAX_RECIPES)
}

/**
 * 画面を開いたときに、結局どの品を選んだ状態にするかを決める（2026-08-12 便FR・
 * 利用者テスト「今日の献立を3品とも入れ替えてナビへ戻ると『0品を選択中』で
 * 『段取りを作る』が押せない。もう一度どこかへ行って戻ると3品が選ばれて押せる」）。
 *
 * 起きていたこと: 覚えていた選択があると「初回の自動選択はしない」という札が立つ。
 * ところが**覚えていた選択が整合で1品残らず落ちた後も札は立ったまま**なので、
 * その1回の表示だけ自動選択が抑止されて0品で開いていた。次に開き直すと覚え書きが
 * 消えている（1品も選んでいない状態は保存しない）ため初回扱いになり自動選択が効く
 * ＝**同じ画面が来るたびに違う状態で開く**。
 *
 * 決め方はこの1か所にまとめる:
 *   - 1品でも残っていれば、その選択（並び＝色の順も）をそのまま使う
 *   - 覚えていた選択が1品も残らなかったら、初めて開いたときと同じく今日の献立の先頭から選ぶ
 *   - もともと1品も選んでいない（自分で全部外した）ときは選び直さない
 *   - 候補がまだ読めていない（undefined）ときは何もしない（docs/69「読み込み中を候補ゼロと読まない」）
 *   - 調理中は `reconcileSelectedIdsForSession` が1品も落とさないので、ここへは来ない
 *     （docs/69「記録は一方通行」＝作りかけの段取りは目の前で組み替わらない）
 */
export function resolveCookNaviSelection(
  selectedIds: readonly number[],
  availableIds: readonly number[] | undefined,
  cookingInProgress: boolean,
): number[] {
  const kept = reconcileSelectedIdsForSession(selectedIds, availableIds, cookingInProgress)
  if (kept.length > 0) return kept
  // 候補が未読込＝「候補ゼロ」ではない。ここで選び直すと、開いた一瞬の見た目が毎回変わる
  if (availableIds === undefined) return kept
  // 自分で全部外した状態を、勝手に選び直さない
  if (selectedIds.length === 0) return kept
  return pickDefaultSelectedIds(availableIds)
}

/**
 * 端末に残した覚え書きを、捨てる条件にかけて読み戻す（2026-08-12 便FT）。
 * 画面はこの結果を見て、続きを出すか・捨てたことを知らせるかを決める。
 */
export function loadCookNaviRestore(): CookNaviRestore {
  try {
    return restoreCookNaviSession(localStorage.getItem(COOK_NAVI_SESSION_KEY), todayString())
  } catch {
    return { kind: 'none' }
  }
}

/** 続きとして使える覚え書きだけを返す（捨てた理由が要らない読み手はこちら） */
export function loadCookNaviSession(): CookNaviSession | undefined {
  const restored = loadCookNaviRestore()
  return restored.kind === 'ok' ? restored.session : undefined
}

export function saveCookNaviSession(session: CookNaviSession): void {
  try {
    if (session.selectedIds.length === 0) {
      localStorage.removeItem(COOK_NAVI_SESSION_KEY)
      return
    }
    localStorage.setItem(COOK_NAVI_SESSION_KEY, serializeCookNaviSession(session, todayString()))
  } catch {
    /* 保存できない環境では覚えないだけ（従来どおり毎回組み直しになる） */
  }
}

/** 全画面の調理中モードを開いているか（タブを閉じるまでの覚え書き。上の解説を参照） */
export function loadCookNaviSessionOpen(): boolean {
  try {
    return sessionStorage.getItem(COOK_NAVI_OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function saveCookNaviSessionOpen(open: boolean): void {
  try {
    if (open) sessionStorage.setItem(COOK_NAVI_OPEN_KEY, '1')
    else sessionStorage.removeItem(COOK_NAVI_OPEN_KEY)
  } catch {
    /* 覚えられない環境では、読み込み直したときに段取りの一覧から入り直すだけ */
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
    localStorage.removeItem(COOK_NAVI_SESSION_KEY)
  } catch {
    /* 何もしない */
  }
  // 位置が無くなれば全画面も意味を持たない（開いた印だけが残らないようにする）
  saveCookNaviSessionOpen(false)
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
