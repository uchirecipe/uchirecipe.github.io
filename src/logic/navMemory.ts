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

// ---------- ①-2 下の並びの「献立」を押したことの合図 ----------

/**
 * 下の並びの「献立」を押したことを、献立の画面へ伝える合図（2026-08-17 便HI・オーナー実機
 * 「週や月の献立を表示中に献立タブをタップしたら、日に戻るようにして」）。
 *
 * 献立の画面は日/週/月をこの画面の中の状態として持っているので、すでに献立にいるときに
 * 「献立」を押しても、行き先（/meal-plan）が同じなので何も起きなかった。押した合図を
 * ここへ置き、画面の側が「日へ戻してページの先頭を出す」を行う。
 *
 * 行き先にクエリ（?focus=today）を足す形は採らなかった。あのクエリは
 * 「レシピ詳細・記録の一覧から帰ってきた」ことを表す印として使われていて、
 * 覚えた縦位置の復元（restore=1）とも組みになっている。タブを押しただけの操作に
 * 同じ印を使うと、2つの意味が1つのクエリに混ざる。
 */
export const MEAL_PLAN_TAB_TAP_KEY = 'mealPlan:tabTap'

// ---------- ①-3「今日なに作る？」で見ていた候補 ----------

/**
 * 「今日なに作る？」の候補カードからレシピ詳細へ移るとき、そのとき出ていた候補を覚える
 * （2026-08-17 便HI・オーナー実機「今日なに作るのレシピ詳細から戻ってきた時だけは、
 * ランダムでレシピが変わらないようにして」）。
 *
 * 直すバグ: 候補はくじ（毎回引き直す乱数）で決まるため、詳細へ移って戻ってくると
 * **さっきタップした料理が画面から消えていた**。「これにしようか」と見に行った本人が、
 * 戻った瞬間にその料理を見失う。
 *
 * 覚えるのは**カードから開いた1品のレシピID**だけにしてある。くじの種と絞り込みの状態を
 * 全部覚えて引き直しを再現する形も考えたが、間にレシピを消す・条件が変わるなど
 * 「同じ結果にならない」道が増えるほど、肝心の「さっきの料理が出ている」が崩れる。
 * 出す料理そのものを覚えれば、何が変わっても戻ったときの見え方は同じになる。
 *
 * 効くのは**戻ってきた1回だけ**。「ランダムで1品出す」を押す・条件を変えると外れて、
 * ふだんどおりくじを引く。
 *
 * ---- どこから戻ったときに保つのか（2026-08-21 便IP・①の線引き） ----
 * **日タブの中のリンク・ボタンで開いた画面から「戻る」で帰ってきたとき**は保つ。
 * レシピ詳細だけでなく、**作った記録の一覧・記録の中身・記録の編集**も同じ扱いにする
 * （便IIの実測: 一覧へ行って戻るたびに別の献立を組み直し、主菜が一品ものだと副菜が
 * 付かないので節の高さが156〜170px→74px、ページの下端が82px上がっていた）。
 *
 * **下の並び（タブバー）を押して自分から離れたときは保たない。** 献立の画面に着くたびに
 * この覚えを捨てるので、覚えが残るのは「離れて1回帰ってくる」あいだだけになる。
 * 読むのも `?focus=today` が付いているときだけで、この印は**日タブから開いた画面の
 * 「戻る」だけ**が付ける（タブを押した合図は上の MEAL_PLAN_TAB_TAP_KEY が別に持つ）。
 * ＝タブで離れた人が何日も前の提案を見せられることはない。
 */
export const DAY_SUGGEST_PIN_KEY = 'mealPlan:daySuggest'

/**
 * 覚える形（後から項目を足せるようにオブジェクトで持つ）。
 *
 * `recipeId` … カードから開いた1品（「1品」側で出し直すもの）
 * `planRecipeIds` … そのとき「献立」側に出ていた主菜・副菜（2026-08-19 便HT・オーナー原文
 * 「提案された献立→レシピ詳細→戻る、の流れで、献立『今日なに作る？』の提案が
 * 変更されないようにして。」）。
 *
 * 献立側のために新しい覚え場所を作らず、**1品側と同じ記録の中に項目を足した**。
 * 理由は、覚えるきっかけ（カードからレシピ詳細へ移る）と、読むきっかけ
 * （?focus=today で帰ってくる）と、捨てるきっかけ（画面に着いたら1回きりで捨てる）が
 * まったく同じだから。別々のキーに分けると、片方だけ消え残る道ができる。
 * 組が無いとき（1品側から開いたとき）は項目そのものを書かない＝以前の版と同じ形のまま。
 *
 * 2026-08-21 便IP・①: `recipeId` を**入れないこともできる**ようにした。
 * レシピ詳細へ移るとき以外（作った記録の一覧へ移るときなど）は「開いた1品」が無く、
 * それでも「献立」側の組は残したいため。1品側がまだ何も出していないときも同じ形になる。
 * 入れない項目は書かない＝読み出し側（parseSuggestionPin）は今までどおり null を返す。
 */
export function serializeSuggestionPin(
  recipeId: number | null,
  planRecipeIds: number[] = [],
): string {
  return JSON.stringify({
    ...(recipeId != null ? { recipeId } : {}),
    ...(planRecipeIds.length > 0 ? { planRecipeIds } : {}),
  })
}

/**
 * 覚えた「献立」側の組を読み出す（2026-08-19 便HT）。
 * 読めないときは**空**にして無視する＝ふつうに組み直すのが正しい振る舞い。
 *
 * IDに使えない値が1つでも混じっていたら、通った分だけを返さずに空にする。
 * 主菜だけ・副菜だけが戻るのは「さっきの献立がそのまま出ている」ではなく、
 * **黙って別の献立に変わった**ように見えるため。
 */
export function parseSuggestionPlanPin(raw: string | null | undefined): number[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (typeof parsed !== 'object' || parsed === null) return []
  const { planRecipeIds } = parsed as { planRecipeIds?: unknown }
  if (!Array.isArray(planRecipeIds) || planRecipeIds.length === 0) return []
  const usable = planRecipeIds.every(
    (id) => typeof id === 'number' && Number.isInteger(id) && id > 0,
  )
  return usable ? (planRecipeIds as number[]) : []
}

/**
 * 覚えた候補を読み出す。壊れた値・別の形の値・IDとして使えない値は null にして無視する
 * （読めないときは「覚えていない」＝ふつうにくじを引くのが正しい振る舞い）。
 */
export function parseSuggestionPin(raw: string | null | undefined): number | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { recipeId } = parsed as { recipeId?: unknown }
  if (typeof recipeId !== 'number' || !Number.isInteger(recipeId) || recipeId <= 0) return null
  return recipeId
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
  /**
   * 人が開け閉めした曜日カード（日付→畳んでいるか。2026-08-19 便ID・⑦）。
   *
   * 曜日カードの既定が「過ぎた日・献立の無い未来の日は畳む」に変わったので、
   * 人が開いたぶんを覚えずに戻ると、戻った先でその日がまた畳まれる＝ページの高さが変わり、
   * 覚えた縦位置に戻しても違う場所に着く（実測で130pxずれた）。
   * 押した結果も「居場所」の一部として一緒に覚える。触っていなければ空で、書かない。
   */
  dayFold?: Record<string, boolean>
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
  const dayFold = point.dayFold ?? {}
  return JSON.stringify({
    weekStart: point.weekStart,
    scrollY: Math.max(0, Math.round(point.scrollY)),
    // 目印が無いときは書かない＝以前の版と同じ形のまま
    ...(point.anchor
      ? { anchor: { date: point.anchor.date, top: Math.round(point.anchor.top) } }
      : {}),
    // 曜日カードを1つも触っていなければ書かない（以前の版と同じ形のまま）
    ...(Object.keys(dayFold).length > 0 ? { dayFold } : {}),
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
  const { weekStart, scrollY, anchor, dayFold } = parsed as {
    weekStart?: unknown
    scrollY?: unknown
    anchor?: unknown
    dayFold?: unknown
  }
  if (typeof weekStart !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || scrollY < 0) return null
  const validAnchor = parseReturnAnchor(anchor)
  const validDayFold = parseDayFold(dayFold)
  return {
    weekStart,
    scrollY: Math.round(scrollY),
    ...(validAnchor ? { anchor: validAnchor } : {}),
    ...(validDayFold ? { dayFold: validDayFold } : {}),
  }
}

/**
 * 覚えていた曜日カードの開け閉めを読み出す（2026-08-19 便ID・⑦）。
 * 日付の形をしていない鍵・真偽でない値は**その1件だけ捨てる**（残りは活かす）。
 * 1件も残らなければ null＝「触っていない」と同じ扱いにして、既定の畳み方に任せる。
 */
function parseDayFold(raw: unknown): Record<string, boolean> | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const out: Record<string, boolean> = {}
  for (const [date, folded] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (typeof folded !== 'boolean') continue
    out[date] = folded
  }
  return Object.keys(out).length > 0 ? out : null
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
 * 献立の日タブのように目印が要らない画面は空文字を入れる。
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

// ---------- ④ 買い物メモの「食材の窓」へ帰るための居場所 ----------

/**
 * 買い物メモで開いていた「食材の窓」（食材名を押すと出る、全文と出所のレシピの小窓）と、
 * そのときの縦位置（2026-08-25 便KU・オーナー原文
 * 「材料→窓のレシピ→レシピ詳細→戻る→買い物メモの窓まで戻して表示」）。
 *
 * 直す前は、窓の中のレシピを押してレシピ詳細へ移ると、詳細の「戻る」が必ずレシピ一覧へ行き、
 * 買い物メモにも窓にも帰れなかった（RecipeDetailPage の backFallback が出所を知らないため）。
 * 献立の月タブが「日の窓」ごと開き直す仕組み（ViewReturnPoint の openDate）と同じ考え方で、
 * **どのタブの・どの食材の窓だったか**を覚えておく。
 *
 * 覚えるのは食材の名前だけ（窓の中身は帰ってから作り直す）＝離れているあいだに
 * 買い物メモが変わっていても、古い中身をそのまま出すことがない。
 * その食材がもう無ければ窓は開かない（画面だけ戻る）。
 */
export interface ShoppingReturnPoint {
  /** 'pantry'（食材の在庫）/ 'memo'（買い物メモ）のどちらのタブを見ていたか */
  tab: 'pantry' | 'memo'
  /** 窓の出所。'draft'＝下書きの行 / 'memo'＝確定した買い物メモの行 */
  kind: 'draft' | 'memo'
  /** 窓を開いた食材の名前 */
  name: string
  scrollY: number
}

/** 買い物メモが居場所を覚えるキー */
export const SHOPPING_RETURN_KEY = 'shopping:return'

export function serializeShoppingReturn(point: ShoppingReturnPoint): string {
  return JSON.stringify({
    tab: point.tab,
    kind: point.kind,
    name: point.name,
    scrollY: Math.max(0, Math.round(point.scrollY)),
  })
}

/**
 * 覚えた居場所を読み出す。壊れた値・別の形の値は null にして無視する
 * （復元できないときは「何もしない」＝買い物メモを普通に開くのが正しい振る舞い）。
 */
export function parseShoppingReturn(raw: string | null | undefined): ShoppingReturnPoint | null {
  if (!raw) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const { tab, kind, name, scrollY } = parsed as {
    tab?: unknown
    kind?: unknown
    name?: unknown
    scrollY?: unknown
  }
  if (tab !== 'pantry' && tab !== 'memo') return null
  if (kind !== 'draft' && kind !== 'memo') return null
  if (typeof name !== 'string' || name === '') return null
  if (typeof scrollY !== 'number' || !Number.isFinite(scrollY) || scrollY < 0) return null
  return { tab, kind, name, scrollY: Math.round(scrollY) }
}
