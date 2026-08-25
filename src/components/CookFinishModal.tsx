import { useEffect, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronUp, Square, SquareCheck, X } from 'lucide-react'
import { ja } from '../i18n/ja'
import Collapse from './Collapse'
import { useScrollLock } from './useScrollLock'

/**
 * 段取りの最後の手順で「完成！」を押したときの窓（2026-08-12 便FX・オーナー実機
 * 「完成！を押した後の記録をつけますか？でOKとキャンセルしかない。
 * もとの完成！を押す直前の手順最終画面に戻る方法がない」）。
 *
 * それまではブラウザの確認（OK／キャンセル）で聞いていたので、行き先が2つしか作れず、
 * 「キャンセル」は**全画面を閉じて段取りの一覧へ戻る**に割り当てられていた
 * （2026-08-10 便EZ のオーナー指示「完成後、画面の戻り位置は『まとめて作った！』まで
 * スクロール」がここに乗っていたため）。押し間違えても、まだ確かめたいことがあっても、
 * 手順の画面には帰れなかった。
 *
 * 画面の中の窓にして行き先を3つにする:
 *   ①記録をつける ②調理を続ける（手順の画面がそのまま戻る）③記録をつけずに閉じる
 * ②を足しても①③は今までと同じ動きなので、便EZ の戻り位置もそのまま残る。
 *
 * 本文（何件に記録が付き、何が残るか＝規約F）は「まとめて作った！」ボタンの確認と
 * **同じ文字列**を受け取って出す（記録の中身の説明を2か所に書かない）。
 *
 * 2026-08-14 便GL: 動いているタイマーの扱いだけは、ここで**聞く**ようにした
 *（利用者テスト「『動いているタイマーはそのまま残ります』とは書いてあるけど、片づけ中に
 * 鳴ります。終了時に『止めますか』が欲しい」）。本文の側からはタイマーの一文が抜けており
 *（呼び出し側が {timers} を空で組む）、この窓の中の欄が消す／消さないの両方の結果を書く。
 * 「まとめて作った！」の確認は今までどおり「そのまま残ります」と書いて動きも変えていない。
 *
 * 2026-08-25 便KM: 説明を**畳んだ**（オーナー原文「完成押下後の窓の説明も長い。読みたい人だけ
 * 読めるように、折りたたんでしまうか、さらに別の窓で表示のにしたい。」）。
 * 2つの案のうち**折りたたみ**を選んだ理由:
 *   ・アプリの折りたたみは共通部品（components/Collapse）で作法が決まっている。設定の
 *     「Pro版でできること」も 2026-08-09 便EO でブラウザ標準の <details> からこちらへそろえた。
 *   ・この窓は全画面の調理中モードの上に重なっている。もう1枚重ねると窓が3枚になり、
 *     閉じる順番（別の窓→この窓→全画面）を台所で判断させることになる。
 *   ・畳んでも同じ窓の中なので、読んだあとそのまま「記録をつける」を押せる（行き来が要らない）。
 * 畳まないのは「どの品に記録が付くか」（body）＝押す前に要る情報。畳むのは消えるもの・
 * 残るもの・あとから編集できること（detail）で、**1文字も減らしていない**（読む人は開けば読める）。
 */
export default function CookFinishModal({
  open,
  body,
  detail,
  runningTimers,
  onRecord,
  onBack,
  onClose,
}: {
  open: boolean
  /** どの品に記録が付くか（畳まずに出す。呼び出し側が「まとめて作った！」と同じ組み立てで作る） */
  body: string
  /** 何が消えて何が残るか・あとから編集できること（読みたい人だけが開く。2026-08-25 便KM） */
  detail: string
  /**
   * まだ動いているタイマー（2026-08-14 便GL・利用者テスト
   * 「『動いているタイマーはそのまま残ります』とは書いてあるけど、片づけ中に鳴ります。
   * 終了時に『止めますか』が欲しい」）。1本も無ければこの欄自体を出さない
   */
  runningTimers: readonly { id: number; label: string }[]
  /** 記録をつける（動いているタイマーも消すかどうかを渡す） */
  onRecord: (stopTimers: boolean) => void
  /** 手順の画面へ帰る（何も起きない＝窓を閉じるだけ） */
  onBack: () => void
  /** 記録をつけずに全画面を閉じる（同じくタイマーの扱いを渡す） */
  onClose: (stopTimers: boolean) => void
}) {
  /**
   * 動いているタイマーも消すか。**既定は消さない**＝今までの動き（そのまま残る）を変えない。
   * 窓を開くたびに選び直す（前回の選択を持ち越すと、押し間違いで残り時間を失う）
   */
  const [stopTimers, setStopTimers] = useState(false)
  /** 詳しい説明を開いているか。**窓を開くたびに畳んだ状態から始める**（2026-08-25 便KM） */
  const [detailOpen, setDetailOpen] = useState(false)
  useEffect(() => {
    if (open) {
      setStopTimers(false)
      setDetailOpen(false)
    }
  }, [open])
  /**
   * Escape は「調理を続ける」と同じ扱い（何も起きない側に倒す）。
   * **履歴は積まない**（useOverlayDismiss を使わない）: この窓は全画面の調理中モードの上に
   * 重なるが、全画面は自前で履歴を1つ積んでいて、その戻り先で全画面を閉じる作りになっている。
   * ここでも積むと、窓を閉じたときの history.back() を全画面側が「戻る操作」と受け取り、
   * 「調理を続ける」で調理中モードごと閉じてしまう。自由な時間のタイマーの窓
   *（CustomTimerModal）と同じ扱いにそろえる
   */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onBack])
  useScrollLock(open)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onBack}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.cookNavi.sessionFinishTitle}
        onClick={(e) => e.stopPropagation()}
        data-testid="cook-finish-modal"
        className="max-h-[85vh] w-full max-w-sm min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <p className="text-lg font-bold">{ja.cookNavi.sessionFinishTitle}</p>
        {/* 畳まずに出すのは「どの品に記録が付くか」だけ（2026-08-25 便KM）。
            改行はそのまま出す（「まとめて作った！」の確認と同じ文面） */}
        <p
          data-testid="cook-finish-modal-body"
          className="ja-phrase mt-[var(--space-sm)] whitespace-pre-line text-sm text-ink-muted"
        >
          {body.trim()}
        </p>
        {/* 消えるもの・残るもの・あとから編集できることは、読みたい人だけが開く（同）。
            開閉の作法はアプリ共通の折りたたみ（Collapse）にそろえる。
            reveal={false}: この窓は自分でスクロールする箱なので、開いた先へページごと動かさない */}
        <button
          type="button"
          data-testid="cook-finish-detail-toggle"
          onClick={() => setDetailOpen((prev) => !prev)}
          aria-expanded={detailOpen}
          aria-controls="cook-finish-detail"
          className="tap-target mt-[var(--space-sm)] flex items-center gap-1 text-sm font-bold text-accent-ink"
        >
          {detailOpen ? (
            <ChevronUp size={16} className="shrink-0" aria-hidden />
          ) : (
            <ChevronDown size={16} className="shrink-0" aria-hidden />
          )}
          <span className="ja-phrase">
            {detailOpen ? ja.cookNavi.sessionFinishDetailClose : ja.cookNavi.sessionFinishDetailOpen}
          </span>
        </button>
        <Collapse open={detailOpen} id="cook-finish-detail" reveal={false}>
          <p
            data-testid="cook-finish-modal-detail"
            className="ja-phrase mt-[var(--space-sm)] whitespace-pre-line text-sm text-ink-muted"
          >
            {detail.trim()}
          </p>
        </Collapse>
        {/* 動いているタイマーをどうするか（2026-08-14 便GL）。1本も無ければ出さない。
            消す側・消さない側の両方の結果を書く（規約F）。押す場所は指で押せる高さにする */}
        {runningTimers.length > 0 && (
          <div
            data-testid="cook-finish-timers"
            className="mt-[var(--space-md)] rounded-md border border-edge bg-app p-[var(--space-sm)]"
          >
            <p className="text-sm font-bold">
              {ja.cookNavi.sessionFinishTimersTitle.replace('{n}', String(runningTimers.length))}
            </p>
            <p
              data-testid="cook-finish-timers-list"
              className="ja-phrase mt-0.5 text-xs text-ink-muted"
            >
              {runningTimers.map((t) => t.label).join('・')}
            </p>
            <button
              type="button"
              role="checkbox"
              aria-checked={stopTimers}
              data-testid="cook-finish-timers-stop"
              onClick={() => setStopTimers((prev) => !prev)}
              className="mt-[var(--space-sm)] flex w-full items-center gap-2 rounded-md border border-edge bg-surface px-2 py-3 text-left text-sm font-bold text-accent-ink shadow-sm"
            >
              {stopTimers ? (
                <SquareCheck size={22} className="shrink-0" aria-hidden />
              ) : (
                <Square size={22} className="shrink-0 text-ink-muted" aria-hidden />
              )}
              <span className="ja-phrase min-w-0 flex-1">
                {ja.cookNavi.sessionFinishTimersStop}
              </span>
            </button>
            <p
              data-testid="cook-finish-timers-note"
              className="ja-phrase mt-1 text-xs text-ink-muted"
            >
              {stopTimers
                ? ja.cookNavi.sessionFinishTimersStopNote
                : ja.cookNavi.sessionFinishTimersKeepNote}
            </p>
          </div>
        )}
        <div className="mt-[var(--space-md)] space-y-[var(--space-sm)]">
          <button
            type="button"
            data-testid="cook-finish-record"
            onClick={() => onRecord(stopTimers)}
            className="flex w-full items-center justify-center gap-1 rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
          >
            <Check size={20} aria-hidden />
            {ja.cookNavi.sessionFinishRecord}
          </button>
          <button
            type="button"
            data-testid="cook-finish-back"
            onClick={onBack}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-accent bg-surface py-3 font-bold text-accent-ink shadow-sm"
          >
            <ChevronLeft size={18} aria-hidden />
            {ja.cookNavi.sessionFinishBack}
          </button>
          <button
            type="button"
            data-testid="cook-finish-close"
            onClick={() => onClose(stopTimers)}
            className="flex w-full items-center justify-center gap-1 rounded-md border border-edge bg-surface py-3 font-bold text-ink-muted shadow-sm"
          >
            <X size={18} aria-hidden />
            {ja.cookNavi.sessionFinishClose}
          </button>
        </div>
      </div>
    </div>
  )
}
