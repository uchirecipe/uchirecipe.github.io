/**
 * 画面をまたぐ「短期の記憶」（2026-08-07 便DT-2・オーナー指示）。
 *
 * どちらも sessionStorage に置く＝タブを閉じたら消える一時的な覚え書きで、
 * 端末に残すユーザーデータ（IndexedDB）には一切書かない。
 * ここには**保存する形と読み方の規則だけ**を置き、実際の読み書きは呼び出し側が行う
 * （純ロジックとして scripts/test-logic.mjs で固定できるようにするため）。
 */

/**
 * sessionStorage の読み書き（プライベートモード等で例外になる環境があるので必ず包む）。
 * 覚えられなかった／読めなかったときは「覚えていない」として扱う＝機能が止まらない。
 */
export function readSessionItem(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeSessionItem(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // 覚えられなくても操作自体は続けられる（復元しないだけ）
  }
}

export function removeSessionItem(key: string): void {
  try {
    sessionStorage.removeItem(key)
  } catch {
    // 同上
  }
}

// ---------- ①「レシピ」タブが覚えている行き先 ----------

/**
 * 「レシピ」タブが「直前に見ていたレシピ」を覚えておくキー（components/TabBar.tsx）。
 * 一覧・詳細・編集のどこにいたかを覚え、他のタブを経由してから戻ってきたときに
 * その場所へ帰れるようにするための記憶。
 */
export const LAST_RECIPES_PATH_KEY = 'tabbar:lastRecipesPath'

/**
 * 覚えている行き先を捨てる（＝次に「レシピ」タブを押したらレシピ一覧が開く）。
 *
 * 2026-08-07 便DT-2（オーナー指示）で追加した。献立タブの週からレシピ詳細を開き、
 * 詳細の「戻る」で週へ帰ったあと「レシピ」タブを押すと、さっき閉じたはずの詳細が
 * また開いていた。「戻る」を押した時点でその詳細はもう見終わっているので、
 * 覚えている行き先も一緒に捨てる。
 */
export function forgetRecipesTabPath(): void {
  removeSessionItem(LAST_RECIPES_PATH_KEY)
}

// ---------- ②献立タブ・週の「戻ってきたときの居場所」 ----------

/**
 * 離れたときに画面のどこを見ていたかの目印（2026-08-14 便GH）。
 *
 * 直したバグ: 週タブの「レシピを見る」からレシピ詳細へ行き「戻る」で帰ると、
 * 離れる前とまったく別の場所に着地することがあった（実測で最大695pxのずれ）。
 *
 * 真因: 覚えていたのが**ページの先頭からの距離（scrollY）だけ**だったこと。
 * 離れている間にページの高さが変わると、同じ距離まで戻しても映るものが変わる。
 * 高さは実際に変わる——「この日の栄養の概算を詳しく見る」で開いた明細は、
 * 画面を離れると閉じた状態に戻る（開閉はその場かぎりの状態）ので、
 * 戻ったときのページは開いていた明細のぶん（実測695px）短い。
 * 見ていたカードより上でこれが起きると、同じ距離＝別のカードになる。
 *
 * 直し方: 「見ていた曜日カードが画面のどこにあったか」を一緒に覚え、
 * 戻ったらそのカードを同じ高さに戻す。上で何が伸び縮みしても、映るものは同じになる。
 */
export interface ReturnAnchor {
  /** 目印にした曜日カードの日付（YYYY-MM-DD） */
  date: string
  /** そのカードの上端が画面のどこにあったか（px。画面の下にあることもある） */
  top: number
}

/** 週タブを離れたときの居場所（戻ってきたら同じ週・同じ場所に復元する） */
export interface WeekReturnPoint {
  /** 見ていた週の起点（YYYY-MM-DD） */
  weekStart: string
  /** 離れたときの縦スクロール位置（px。0以上の整数） */
  scrollY: number
  /**
   * 見ていたカードの目印（任意）。目印にできるカードが無いとき（＝最後のカードの中まで
   * 送っているとき）は入らない。入っていないときは従来どおり scrollY だけで戻す
   */
  anchor?: ReturnAnchor
}

/**
 * 目印にするカードを選ぶ（2026-08-14 便GH）。
 * **上端が画面の中（またはその下）から始まるカードのうち、いちばん上のもの**を選ぶ。
 *
 * 「画面に残っているいちばん上のカード」ではない理由（作りながら実測して分かったこと）:
 * 上端が画面より上にあるカードは、**そのカードの中で高さが変わる部分も画面より上**にある。
 * 実測では、今日のカードの中の栄養の明細（695px）が画面の上に隠れていて、明細が閉じても
 * カードの上端は動かない＝目印にしても何も直らなかった（金曜で -644px のずれのまま）。
 * 上端が画面の中から始まるカードなら、その上で伸び縮みしたぶんがそのままずれの量になり、
 * 同じ高さへ戻せば画面に映るものも元どおりになる。
 *
 * 画面いっぱいに1枚のカードが広がっていて、上端が見えるカードが1枚も無いときは、
 * **画面の下にある次のカード**が選ばれる（同じ理屈で、その上のずれをそのまま打ち消せる）。
 * それも無い（最後のカードの中まで送っている）ときだけ目印なしにして、縦位置での復元に任せる。
 *
 * @param cards 曜日カードの位置（**画面に並んでいる順**。top は画面の上端からのpx）
 * @param visibleTop 画面のうち中身が見え始める高さ（上に貼り付く帯の下端。既定0）
 */
export function pickReturnAnchor(
  cards: { date: string; top: number }[],
  visibleTop = 0,
): ReturnAnchor | null {
  for (const card of cards) {
    if (!card.date) continue
    if (card.top >= visibleTop) return { date: card.date, top: Math.round(card.top) }
  }
  return null
}

/**
 * 目印のカードを離れたときと同じ高さに戻すための縦スクロール位置（2026-08-14 便GH）。
 * いまの縦位置に「カードが本来あるべき高さとのずれ」を足すだけ＝ページの高さに依らない。
 */
export function scrollTargetForAnchor(
  currentScrollY: number,
  anchorTopNow: number,
  anchor: ReturnAnchor,
): number {
  return Math.max(0, Math.round(currentScrollY + anchorTopNow - anchor.top))
}

/** 週タブの居場所を覚えておくキー */
export const WEEK_RETURN_KEY = 'mealPlan:weekReturn'

/**
 * 週タブへ戻ってきたことを表すクエリ。`?focus=week` だけだと
 * 献立テンプレート画面・作った記録の一覧からの「戻る」も同じ形になり、
 * それらまでスクロール位置を動かしてしまうので、復元するときだけ付ける印を分けている。
 */
export const WEEK_RETURN_PARAM = 'restore'

export function serializeWeekReturn(point: WeekReturnPoint): string {
  return JSON.stringify({
    weekStart: point.weekStart,
    scrollY: Math.max(0, Math.round(point.scrollY)),
    // 目印が無いときは書かない＝以前の版と同じ形のまま
    ...(point.anchor
      ? { anchor: { date: point.anchor.date, top: Math.round(point.anchor.top) } }
      : {}),
  })
}

/**
 * 覚えた居場所を読み出す。壊れた値・別の形の値は null にして無視する
 * （復元できないときは「何もしない」＝週タブを普通に開くのが正しい振る舞い）。
 *
 * ただし**目印だけが壊れている場合は目印を捨てて残りを返す**。目印は後から足したもので、
 * これが読めないだけで「同じ週へ戻る」まで諦めるのは、以前より悪くなるため。
 */
export function parseWeekReturn(raw: string | null | undefined): WeekReturnPoint | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { weekStart, scrollY, anchor } = parsed as {
    weekStart?: unknown
    scrollY?: unknown
    anchor?: unknown
  }
  if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || scrollY < 0) return null
  const validAnchor = parseReturnAnchor(anchor)
  return {
    weekStart,
    scrollY: Math.round(scrollY),
    ...(validAnchor ? { anchor: validAnchor } : {}),
  }
}

/** 目印の読み出し（形が違えば「目印なし」として扱う。上端は画面外を指す負の値もありうる） */
function parseReturnAnchor(value: unknown): ReturnAnchor | null {
  if (typeof value !== 'object' || value === null) return null
  const { date, top } = value as { date?: unknown; top?: unknown }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (typeof top !== 'number' || !Number.isFinite(top)) return null
  return { date, top: Math.round(top) }
}

// ---------- ③「作った記録の一覧」へ行く前の居場所 ----------

/**
 * 一覧へ移る直前の居場所（2026-08-09 便EQ・オーナー指示「戻るのも該当場所のスクロール位置まで」）。
 *
 * `anchor` は画面ごとの目印で、献立の月タブなら「見ていた月の日付」を入れる。
 * ホームや献立の日タブのように目印が要らない画面は空文字を入れる。
 * 週タブだけは以前から専用の WeekReturnPoint を使っており、そのままにしてある
 * （週は「見ていた週の起点」を日付の形で検査する必要があるため）。
 */
export interface ViewReturnPoint {
  anchor: string
  scrollY: number
  /**
   * 離れたときに開いていた小窓の目印（任意・2026-08-10 便FD・オーナー実機
   * 「レシピを見るから戻るボタンで同じ画面に戻って来たい」）。
   *
   * 献立の月タブは「日の窓」を開いた中にレシピ詳細への入口があるので、月と縦位置だけを
   * 戻しても窓が閉じたカレンダーに着地していた。ここに日付（YYYY-MM-DD）を入れておくと、
   * 戻ったときに同じ日の窓を開き直せる。窓を開いていなければ入れない。
   */
  openDate?: string
}

/** ホームが居場所を覚えるキー */
export const HOME_RETURN_KEY = 'home:return'
/** 献立の月タブが居場所を覚えるキー */
export const MONTH_RETURN_KEY = 'mealPlan:monthReturn'
/** 献立の日タブが居場所を覚えるキー */
export const DAY_RETURN_KEY = 'mealPlan:dayReturn'

export function serializeViewReturn(point: ViewReturnPoint): string {
  return JSON.stringify({
    anchor: point.anchor,
    scrollY: Math.max(0, Math.round(point.scrollY)),
    // 開いていた窓が無いときは書かない＝以前の版と同じ形のまま
    ...(point.openDate ? { openDate: point.openDate } : {}),
  })
}

/**
 * 覚えた居場所を読み出す。壊れた値・別の形の値は null にして無視する
 * （復元できないときは「何もしない」＝その画面を普通に開くのが正しい振る舞い）。
 */
export function parseViewReturn(raw: string | null | undefined): ViewReturnPoint | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { anchor, scrollY, openDate } = parsed as {
    anchor?: unknown
    scrollY?: unknown
    openDate?: unknown
  }
  if (typeof anchor !== 'string') return null
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || scrollY < 0) return null
  // 開いていた窓の目印は任意。形が違えば「窓は開いていなかった」として扱う（復元をあきらめる）
  const validOpenDate =
    typeof openDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(openDate) ? openDate : undefined
  return { anchor, scrollY: Math.round(scrollY), ...(validOpenDate ? { openDate: validOpenDate } : {}) }
}
