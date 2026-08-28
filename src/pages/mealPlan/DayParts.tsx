/**
 * 献立タブ「日」まわりの部品（2026-08-25 便KZ）。
 *
 * MealPlanPage.tsx が9,906行あり、便が同じファイルに書き足し続けていたので、
 * 画面から**そのまま**切り出した（docs/74 第3手）。中身は1文字も変えていない
 * ＝見た目も動きも変わらない。変わったのは「どのファイルに書いてあるか」だけ。
 * 変えたのは import の書き方（相対パスが1つ深くなる）と、末尾の export だけ。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, ChevronRight, Trash2, X } from 'lucide-react'
import RecipeCard from '../../components/RecipeCard'
import { SwipeRevealRow } from '../../components/SwipeRevealRow'
import { usePhotoUrl } from '../../components/usePhotoUrl'
import { isImeConfirmKey } from '../../logic/imeKey'
import type { PlanSheet } from '../../logic/planSheet'
import type { CookedLog, DayNote, Recipe } from '../../db/types'
import { ja } from '../../i18n/ja'

/**
 * 今日の献立の1品（2026-08-19 便HW・A案＝2段）。
 *
 * 2026-08-03 便DH: 日タブを「レシピ一覧から選択中」と「今週の献立の予定」の縦一列に分けた。
 * footer には行の下に置く操作（レシピ一覧から選んだ品を今日の予定へ入れるボタン）を渡す。
 *
 * 2026-08-20 便IG・①（オーナー原文「「作った！」と×が邪魔。作った！をつけるときには
 * モード切り替えするようにしたら解決できる？全て作った！も含めて。」）:
 * ×は「今日の献立」の**整理モードのあいだだけ**出す（呼び出し側が onRemove を渡さなければ出ない）。
 *
 * 2026-08-20 便II・⑥（オーナーが実機を見て便IGの裁定をひっくり返した。原文
 *   「整理に作った！も入れたい。作った！が気軽にできないよりも、献立を１画面で確認できない方が
 *     問題では？」）:
 * **「作った！」も整理モードのあいだだけ**出す（onCooked を渡さなければ出ない）。
 * 整理モードでないときは「作った！」と×が消え、**料理名の行だけ**になる
 * ＝今日の献立を1画面で見渡せる。
 *
 * ただし footer（「◯食に入れる」）は**モードの外にも出したまま**にする（同便の裁定）。
 * 「整理」は減らす・終わらせる操作の集まりで、これから決める操作は性質が違う。
 * 「レシピ一覧から選択中」はレシピを選んだ直後の一時的な状態なので、次にやることを
 * モードの奥へ入れると、選んだ直後に手が止まる（流れの途中に行き止まりを作らない）。
 *
 * 2026-08-19 便HW（オーナー原文「場所や機能ごとにレシピカードの形や内容が変わっているのが
 * みづらい」／司令部の裁定「日タブの行はA案＝2段」）:
 * 自前で組んでいた「40pxサムネ＋料理名＋作った！＋×」の**1行**をやめ、
 *   1段目 … 共通のレシピカードの「標準」（レシピ一覧の一覧表示と同じ形。押すとレシピ詳細へ）
 *   2段目 … その料理に対する操作（「作った！」「×」と、今日の予定へ入れるボタン）
 * の2段にした。直った問題: 料理名とボタンが横一列だったため、料理名が
 * 「チンゲン菜としいたけの…」のように途中で切れていた（2段にすると名前が幅いっぱい使える）。
 * 押せる大きさ（「作った！」44px・×の tap-target）は変えていない。
 */
function TodayListRow({
  recipe,
  ngIngredients,
  onCooked,
  onRemove,
  removeLabel,
  footer,
  swipeOpen,
  onSwipeOpenChange,
  onSwipeRemove,
}: {
  recipe: Recipe
  /**
   * 設定「食べられない食材」（2026-08-19 便IA）。引っかかる品にはカードが警告の印を出す。
   * レシピ一覧・献立の枠・「レシピを選ぶ」画面には最初から出ていたのに、ここと
   * 「今日なに作る？」の候補だけ渡し忘れていて、**今日これを作ると決めた品**について
   * 何も言わない画面になっていた。
   */
  ngIngredients: string[]
  /** 「作った！」（2026-08-20 便II・⑥。整理モードのあいだだけ渡す＝渡さなければ出ない） */
  onCooked?: () => void
  onRemove?: () => void
  /**
   * ×の読み上げ名（2026-08-17 便HI）。既定は「この献立から外す」＝今日の献立からだけ外す。
   * 「今週の献立の予定」の行は今日と今週の両方から外れるので、呼び出し側が別の名前を渡す
   * （同じ形の×で違うことが起きるのを、読み上げでも見分けられるようにする）。
   */
  removeLabel?: string
  footer?: ReactNode
  /**
   * 行を左へ払うと右から出る「外す」（2026-08-21 便IQ。オーナー原文
   * 「横にスワイプして消せるのが楽なんですけどね。」）。
   *
   * **整理モードの外でも効かせる**＝モードに入らずに外せることが「楽」の中身。
   * 出るのはボタンだけで、**押して初めて外れる**（払い切っただけでは何も起きない）。
   * 開いている行は同時に1つだけなので、開いている行の合図は画面側が持つ。
   * onSwipeRemove を渡さなければ、その行は払っても何も出ない。
   */
  swipeOpen?: boolean
  onSwipeOpenChange?: (open: boolean) => void
  onSwipeRemove?: () => void
}) {
  // state.from/fromPathで「今日の献立から開いた」ことを詳細画面へ持ち回る。
  // RecipeDetailPageの戻るボタンが、通常の「常に一覧へ」ではなくここ(献立タブ)へ
  // 戻るために参照する（2026-07-12オーナー指示）。
  // ?focus=today を付けて「今日の献立から戻ってきた」ことをMealPlanPageに伝える。
  // これが付いていると、日タブを必ず選択した状態に固定する
  // （2026-07-15オーナー実機フィードバック: 今日の献立からレシピを開いて戻ると
  // 今週の献立に飛ばされる、の恒久対策。2026-07-16便U-1でタブ構成に再設計後もこの
  // 「戻ったら必ず日タブ」という保証は維持する）
  const fromState = { from: 'todayList' as const, fromPath: '/meal-plan?focus=today' }
  const card = (
    <RecipeCard
      recipe={recipe}
      density="standard"
      place="todayPlan"
      ngIngredients={ngIngredients}
      // 検査用の目印（2026-08-19 便HY・CARDPARTS-01）。「今日なに作る？」の候補と
      // 同じレシピのカードを見比べて、場所ごとに載せる情報が違うことを機械で見張る
      testId="day-plan-card"
      titleTestId="day-plan-card-title"
      linkState={fromState}
      /* 2026-08-20 便II・⑥: 操作が1つも無いとき（＝整理モードでないとき）は2段目そのものを
         作らない＝料理名の行だけになる */
      actions={
        onCooked || onRemove || footer ? (
          <>
            {/* 「作った！」と×は**行の右へ寄せる**（2026-08-21 便IU・②。オーナー原文
                「・整理画面の「作った！」と×は右に寄せて。」）。
                2つをひと塊にして ml-auto で右端まで送る＝左に空きができ、料理名の下が
                すっきりする。押せる大きさ（「作った！」44px・×の tap-target）は変えていない。
                「◯食に入れる」（footer）は w-full なので、これまでどおり次の行に回る＝
                右へ寄るのはオーナーが名指しした2つだけ。
                **2つの間隔（gap）は必ず残す**（2026-08-22 司令部）: 塊にする前は外側の行の
                gap-[var(--space-sm)] と ×の ml-2 が足されて16px空いていた。塊にした時点で
                外側のgapが効かなくなり8pxまで詰まる＝「作った！」(記録が残る)と×(確認なしで消える)が
                密着する。2026-07-29 便CD/MP-21で広げたのと同じ穴なので、内側にも同じgapを置く */}
            {(onCooked || onRemove) && (
              <div className="ml-auto flex shrink-0 items-center gap-[var(--space-sm)]">
                {/* 2026-08-03 便DP-3(オーナー指示): ☑アイコンだけでは操作できるものに見えなかったので、
                    枠・地色・文字ラベルの付いたボタンにした。高さは44px(min-h-11)＝従来のp-3のアイコン
                    ボタンと同じ当たり判定を下回らないようにする。
                    2026-08-18 便HN（オーナー指摘「『作った！』と『全て作った！』など、同じような機能は
                    色を同じにした方が、パッとみてわかりやすい」）: 記録をつけるボタンはアプリ全体で
                    6か所あり、多数側＝アクセントの塗りに合わせている */}
                {onCooked && (
                  <button
                    type="button"
                    onClick={onCooked}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-sm bg-accent px-2.5 py-2 text-sm font-bold text-on-accent shadow-sm"
                  >
                    <CheckCircle2 size={16} aria-hidden />
                    {ja.mealPlan.todayMarkCooked}
                  </button>
                )}
                {/* 2026-07-29 便CD/MP-21: 「作った」(記録が残る)と「この献立から外す」(確認なしで消える)は
                    破壊度が違うのに36px・間隔8pxで密着していた。両方44px(p-3)にし、間の余白も広げて
                    押し間違いを減らす */}
                {onRemove && (
                  <button
                    type="button"
                    onClick={onRemove}
                    aria-label={removeLabel ?? ja.mealPlan.todayRemove}
                    className="tap-target ml-2 shrink-0 rounded-full p-3 text-ink-muted"
                  >
                    <X size={20} aria-hidden />
                  </button>
                )}
              </div>
            )}
            {footer}
          </>
        ) : undefined
      }
    />
  )
  // 払っても何も出さない行（onSwipeRemove を渡していない場所）は、これまでどおりそのまま出す
  if (!onSwipeRemove) return <li>{card}</li>
  return (
    <li>
      <SwipeRevealRow
        testId="day-swipe-row"
        open={swipeOpen ?? false}
        onOpenChange={(next) => onSwipeOpenChange?.(next)}
        actionLabel={ja.mealPlan.todaySwipeRemove}
        /* 読み上げの名前は×とそろえる＝同じ「外す」でも、外れる範囲が違うことが耳でも分かる
           （「この献立から外す」／「今日と今週の献立から外す」） */
        actionAriaLabel={removeLabel ?? ja.mealPlan.todayRemove}
        actionTestId="day-swipe-remove"
        onAction={onSwipeRemove}
      >
        {card}
      </SwipeRevealRow>
    </li>
  )
}

/**
 * 過去振り返り(2026-07-17 便Z-2・docs/35 §3)の「作った記録」1件分の薄いカード。
 * 週タブの過去日の枠と、月タブの日モーダルの両方で使う。
 * 予定(エントリ)との視覚区別: ✓マーク+淡い表示(薄いカード)。
 * サムネは記録に添付された写真を優先し、無ければレシピ写真→アイコンにフォールバックする。
 *
 * 2026-08-19 便HW（オーナー原文「同じ情報なら形もできるだけ揃える」）: 自前で組んでいた
 * 「32pxサムネ＋料理名＋✓」の行をやめ、共通のレシピカードの「小」に寄せた。
 * すぐ上に並ぶ**献立の枠と同じ形**になり、淡い表示（muted）で予定と記録を見分ける。
 */
function CookedLogCard({
  recipe,
  log,
  onNavigate,
  linkState,
  readOnly = false,
  onOpenDetail,
  onDelete,
  deleteDisabled = false,
  detailAs = 'card',
}: {
  recipe: Recipe
  log: CookedLog
  onNavigate?: () => void
  /**
   * レシピ詳細へ持ち回る出所（2026-08-07 便DT-2）。週タブから開いたときだけ渡し、
   * 詳細画面の「戻る」が週タブへ帰るようにする（RecipeDetailPage の backFallback）。
   */
  linkState?: { from: string; fromPath: string }
  /**
   * レシピ詳細へのリンクにしない（2026-08-02 便DC）。サンプルデモの記録はメモリ上の見本で、
   * 端末に無いレシピを指すため、押せる見た目にすると行き止まりになる
   */
  readOnly?: boolean
  /**
   * 「作った記録」の中身の小窓を開く（2026-08-09 便EQ・オーナー実機
   * 「献立名をタップで整理された記録（記録、日付、食数など、入力した情報全て）を見られるように」）。
   */
  onOpenDetail?: () => void
  /**
   * この記録を1件だけ消す（2026-08-22 便JF・オーナー追加指示「削除ボタンも入れて」）。
   * **渡したときだけ**削除のボタンが出る＝過ぎた日の編集モードの中でしか出ない
   * （通常表示は今までどおり、記録のカードが並ぶだけ）。
   */
  onDelete?: () => void
  /**
   * 削除を出したまま押せなくする（2026-08-22 便JF・オーナー原文
   * 「鍵をかけたら編集もできなくなるようにして。」）。
   * 止め方は、鍵の掛かった献立の×・食数・サイコロとまったく同じ（2026-08-08 便EA）
   * ＝ボタンは同じ場所に出したまま押せなくする。押せない理由は呼び出し側が1行で添える。
   */
  deleteDisabled?: boolean
  /**
   * 小窓の開き方。
   *  'card'  … カードそのものを押すと小窓が開く（月タブの日の窓）
   *  'below' … カードはレシピ詳細へのリンクのまま、すぐ下に小窓を開く1行を足す（週タブの過去日）
   */
  detailAs?: 'card' | 'below'
}) {
  const openDetailAria = ja.cookedDetail.openAria.replace('{title}', recipe.title)
  const asButton = !readOnly && onOpenDetail != null && detailAs === 'card'
  return (
    // 検査用の目印（2026-08-22 便JF）。その日の記録が何件並んでいるかを、
    // クラス名や入れ子の段数ではなくこの目印で数える
    <li data-testid="cooked-log-card">
      <RecipeCard
        recipe={recipe}
        density="small"
        place="planSlot"
        muted
        photoOverride={log.photo}
        readOnly={readOnly}
        // 2026-08-09 便EQ: 料理名を押すと、その記録の中身（日付・何人分・メモ・写真）が開く
        onSelect={asButton ? onOpenDetail : undefined}
        selectAriaLabel={asButton ? openDetailAria : undefined}
        linkState={linkState}
        onNavigate={onNavigate}
        // 検査用の目印（2026-08-25 便KU）。この記録カードから「レシピ詳細へ移って戻る」道を
        // 機械で見張る。献立の枠のカード（row-recipe）とは役割が違うので別の名前にする
        testId="cooked-log-recipe"
        titleBadges={<CheckCircle2 size={16} className="text-accent-ink" aria-hidden />}
      />
      {/* カードの押下にレシピ詳細という別の役割があるところ（週タブの過去日・月タブの日の窓）では、
          記録の中身への入口を1行足す（2026-08-09 便EQ）。
          2026-08-22 便JF: 編集モードのときは、その隣に削除を並べる。
          間隔は12px（gap-3）＝押し間違いが起きる近さを作らない（便IZと同じ作法）。

          2026-08-25 便KU（オーナー原文「窓の「作った記録を見る」を右に寄せて」
          「作った記録のレシピと「作った記録を見る」の縦幅が同じくらいなので、レシピ数が多いと
          それだけ無駄に縦長になる。「作った記録を見る」の場所が上下のレシピの真ん中あたりなので、
          どっちについているのかわかりづらい」）で3つ直した:
           ①**右端へ**寄せる（justify-end）。直す前は左から48px（ml-12）の位置に置いていた
           ②**行の高さを実測44px→20px**にする。直す前は min-h-11 でカード（実測46px）と
             ほぼ同じ高さがあり、記録が5件並ぶと入口の行だけで220px使っていた。
             小さくしても押せるよう、当たり判定は器（.tap-target）で44pxのまま保つ
             （2026-08-24 便KJ が記録の窓の「レシピを見る」で採った作法と同じ）
           ③カードの**すぐ下**（mt-0.5＝2px）に付ける。記録どうしの間は12px空けてあるので、
             「間が狭いほうが同じ記録」＝どのレシピの入口かが距離で読める
             （便JQ が献立の1品で採った「1品の中 < 品と品の間」と同じ考え方） */}
      {!readOnly && (onDelete || (onOpenDetail && detailAs === 'below')) && (
        <div className="mt-0.5 flex flex-wrap items-center justify-end gap-3">
          {onOpenDetail && detailAs === 'below' && (
            <button
              type="button"
              data-testid="cooked-log-open-detail"
              onClick={onOpenDetail}
              aria-label={openDetailAria}
              className="tap-target inline-flex items-center gap-0.5 text-xs font-bold text-accent-ink underline"
            >
              {ja.cookedDetail.openFromPlan}
              <ChevronRight size={14} aria-hidden />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              data-testid="past-record-delete"
              onClick={onDelete}
              disabled={deleteDisabled}
              aria-label={ja.mealPlan.pastRecordDeleteAria
                .replace('{m}', String(Number(log.date.slice(5, 7))))
                .replace('{d}', String(Number(log.date.slice(8, 10))))
                .replace('{title}', recipe.title)}
              /* 削除は**実寸で44px**のまま（2026-08-25 便KU で低くしたのは「作った記録を見る」だけ）。
                 消える操作なので、当たり判定だけを広げる形（.tap-target）にはしない
                 ＝押せる面が見た目より広いと、消すつもりのない場所で消えることが起きうる。
                 この削除は編集モードでしか出ないので、オーナーが縦長を指摘した通常表示の高さには
                 効かない（scripts/e2e-smoke.mjs の JFDEL-07 が実寸44pxを見張る） */
              className={`inline-flex min-h-11 items-center gap-1 text-xs font-bold text-warning underline ${
                deleteDisabled ? 'opacity-40' : ''
              }`}
            >
              <Trash2 size={14} aria-hidden />
              {ja.mealPlan.pastRecordDelete}
            </button>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * 「カレンダーに出す写真」の候補1枚（2026-08-07 便DU・オーナー指示
 * 「カレンダーのサムネに使うレシピを日ごとに選べるように」）。
 * その日に写真の候補が2つ以上あるときだけ、月タブの日の窓に並べる。
 * usePhotoUrl（フック）を呼ぶため、並べる側から切り出した部品にしている。
 */
function DayCoverOption({
  title,
  photo,
  selected,
  onSelect,
}: {
  title: string
  photo: Blob
  selected: boolean
  onSelect: () => void
}) {
  const photoUrl = usePhotoUrl(photo)
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={ja.mealPlan.monthDayCoverOptionAria.replace('{title}', title)}
      className={`w-20 shrink-0 rounded-sm border p-1 text-left ${
        selected ? 'border-accent bg-accent/15' : 'border-edge bg-app'
      }`}
    >
      <span className="block h-14 w-full overflow-hidden rounded-sm bg-surface">
        {photoUrl && <img src={photoUrl} alt="" className="h-full w-full object-cover" />}
      </span>
      <span className="mt-0.5 block truncate text-[10px] leading-tight text-ink-muted">
        {title}
      </span>
    </button>
  )
}

/** 日付メモの上限文字数（1行メモの想定。「外食」「実家に行く」等が十分入る長さ） */
const DAY_NOTE_MAX_LENGTH = 40

/**
 * 日付メモの入力欄（2026-07-29 便CB-1・docs/59 A-2）。
 * 週タブの各日カードと月タブの日モーダルの両方で同じものを使う。
 *
 * 保存の考え方: 「保存」ボタンを置かず、入力欄から離れた時点（blur）で保存する。
 * 週タブには7日分の入力欄が並ぶため、日ごとにボタンを増やすと画面が重くなるのと、
 * 1行メモは書いたらすぐ他へ移る使い方が自然なため。ただし黙って保存すると保存されたか
 * 分からないので、保存・削除のどちらをしたかは呼び出し側でトーストに出す。
 * Escapeキー等でblurを経ずに窓が閉じる経路でも書きかけを落とさないよう、
 * アンマウント時にも差分があれば保存する。
 */
function DayNoteEditor({
  date,
  note,
  onSave,
}: {
  /** YYYY-MM-DD */
  date: string
  /** 保存済みのメモ（無ければundefined） */
  note: DayNote | undefined
  /** 保存の実行（トーストの出し分けは呼び出し側） */
  onSave: (date: string, text: string) => void
}) {
  const saved = note?.text ?? ''
  const [draft, setDraft] = useState(saved)
  // 保存済みの内容が外から変わったら入力欄も追従する（バックアップ復元・別の窓での編集）。
  // 入力中は保存済みの値が変わらないので、打っている途中で消えることはない
  useEffect(() => setDraft(saved), [saved])
  // アンマウント時の取りこぼし保存用に、最新の値をrefへ写す（依存配列に入れて再購読させない）
  const draftRef = useRef(draft)
  draftRef.current = draft
  const savedRef = useRef(saved)
  savedRef.current = saved
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  useEffect(
    () => () => {
      if (draftRef.current.trim() !== savedRef.current) onSaveRef.current(date, draftRef.current)
    },
    [date],
  )
  const commit = () => {
    if (draft.trim() === saved) return
    onSave(date, draft)
  }
  return (
    <div>
      <p className="text-xs font-bold text-ink-muted">{ja.mealPlan.dayNoteLabel}</p>
      <input
        type="text"
        value={draft}
        maxLength={DAY_NOTE_MAX_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          // Enterでも確定できるようにする（フォーム送信は無いのでblurで保存経路にそろえる）。
          // 日本語入力の変換を確定しただけのEnterでは閉じない（2026-08-09 便EK・便EIと同じ判定）
          if (e.key === 'Enter' && !isImeConfirmKey(e)) e.currentTarget.blur()
        }}
        placeholder={ja.mealPlan.dayNotePlaceholder}
        aria-label={ja.mealPlan.dayNoteAria
          .replace('{m}', String(Number(date.slice(5, 7))))
          .replace('{d}', String(Number(date.slice(8, 10))))}
        /* 2026-08-22 便IZ: 実測 高さ38px で、指で押せる大きさ(44px・--tap-min)を下回っていた。
           文字を打ち込む欄も「押して開くもの」なので、他のボタン・プルダウン
           （.select-control も min-height: var(--tap-min)）と同じだけの当たり判定を持たせる */
        className="mt-1 min-h-11 w-full rounded-sm border border-edge bg-app px-2 py-2 text-sm text-ink placeholder:text-ink-muted/60"
      />
    </div>
  )
}

/**
 * 献立表（2026-07-29 便CB-2・docs/59 A-4）の1枚分の中身。
 * 画面のプレビュー（.plan-sheet-preview）と、印刷用にbody直下へポータルで置く1枚
 * （.plan-sheet-print）の両方がこの同じ中身を描く。何を載せるかは純ロジック
 * logic/planSheet.ts が決めるので、画像保存（logic/planSheetImage.ts）とも内容がずれない。
 *
 * 印刷時は index.css 側で文字色を黒・背景を白に固定する（ダークテーマのまま紙に出すと
 * 白地に白文字になって読めないため）。ここでは画面用のテーマ色だけを指定する。
 */
function PlanSheetView({ sheet }: { sheet: PlanSheet }) {
  /**
   * 1行分。左から「食事のラベル／役割のラベル／本文」の3列で、ラベルは本文より小さく薄くする
   * （2026-08-02 オーナー指示: 「朝食」「主菜」が料理名と同じ大きさで数珠つなぎになっていた）。
   * 料理は1品につき1行にし、同じ食事の2品目以降はラベルの列を空けたまま料理名の位置をそろえる。
   * 画像（logic/planSheetImage.ts）も planSheetLines を通して同じ3列で描く。
   */
  const row = (key: string, label: string, role: string, body: ReactNode, note = false) => (
    <div key={key} className={`sheet-row mt-0.5 flex gap-2 pl-2 ${note ? 'text-xs' : 'text-sm'}`}>
      {/* 2026-08-26 便LH（オーナー原文「朝食昼食夕食の文字は太字に。」）:
          食事のラベルだけ太字にする。同じ列に出る「この日のメモ」は太字にしない
          （note=true の行）＝どの行が食事の区切りかが、字の太さだけで拾える */}
      <span
        className={`sheet-row-label w-16 shrink-0 pt-[3px] text-[10px] leading-tight text-ink-muted ${
          note ? '' : 'sheet-slot-label font-bold'
        }`}
      >
        {label}
      </span>
      <span className="sheet-role w-8 shrink-0 pt-[3px] text-[10px] leading-tight text-ink-muted">
        {role}
      </span>
      <span className="min-w-0 flex-1">{body}</span>
    </div>
  )
  return (
    <>
      <h3 className="sheet-title text-lg font-bold">{sheet.title}</h3>
      {/* 何を載せた1枚かの名乗り。文は logic/planSheet.ts が決める（2026-08-28 便MD）＝
          「載せる食事」で絞ったときに、絞ったことが紙の上からも読める */}
      <p className="sheet-basis mt-0.5 text-[10px] text-ink-muted">{sheet.basisNote}</p>
      <ul className="mt-[var(--space-sm)] divide-y divide-edge">
        {sheet.days.map((day) => (
          <li key={day.date} className="sheet-day py-1.5">
            <p className="sheet-day-label text-sm font-bold text-accent-ink">{day.label}</p>
            {day.slots.map((slotRow) =>
              slotRow.dishes.map((dish, i) =>
                row(
                  `${slotRow.slot}-${i}`,
                  i === 0 ? slotRow.label : '',
                  ja.mealPlan.role[dish.role],
                  dish.title,
                ),
              ),
            )}
            {day.note && row('note', ja.mealPlan.dayNoteLabel, '', day.note, true)}
          </li>
        ))}
      </ul>
      <p className="mt-[var(--space-sm)] text-[10px] text-ink-muted">
        {ja.app.name}｜{ja.app.url}
      </p>
    </>
  )
}

export { TodayListRow, CookedLogCard, DayCoverOption, DayNoteEditor, PlanSheetView }
