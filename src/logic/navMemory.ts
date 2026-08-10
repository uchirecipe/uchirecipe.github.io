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

/** 週タブを離れたときの居場所（戻ってきたら同じ週・同じスクロール位置に復元する） */
export interface WeekReturnPoint {
  /** 見ていた週の起点（YYYY-MM-DD） */
  weekStart: string
  /** 離れたときの縦スクロール位置（px。0以上の整数） */
  scrollY: number
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
  return JSON.stringify({ weekStart: point.weekStart, scrollY: Math.max(0, Math.round(point.scrollY)) })
}

/**
 * 覚えた居場所を読み出す。壊れた値・別の形の値は null にして無視する
 * （復元できないときは「何もしない」＝週タブを普通に開くのが正しい振る舞い）。
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
  const { weekStart, scrollY } = parsed as { weekStart?: unknown; scrollY?: unknown }
  if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || scrollY < 0) return null
  return { weekStart, scrollY: Math.round(scrollY) }
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
