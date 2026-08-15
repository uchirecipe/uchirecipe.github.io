import { useEffect } from 'react'
import { X } from 'lucide-react'
import StepBadge from './StepBadge'
import { MemoText } from './MemoText'
import NaviRecipeNotes from './NaviRecipeNotes'
import type { RecipeNote } from '../logic/naviRecipeNotes'
import { ja } from '../i18n/ja'

type Props = {
  /** 開くかどうか（false なら何も描かない） */
  open: boolean
  /** 段取りの通し番号（画面の大きいバッジと同じ数字） */
  order: number
  /** そのレシピ内の手順の呼び名（「3」「3-1」）。番号を持たない工程は undefined */
  stepLabel?: string
  recipeTitle: string
  /** その品の色（段取りの一覧・調理中の画面と同じ色） */
  color: string
  text: string
  memo?: string
  /** その手順に割り当てたレシピ本体のメモ（2026-08-11 便FM） */
  notes: readonly RecipeNote[]
  /** いま開いている手順の位置（1始まり）。閉じたあとに戻る場所として名乗る */
  currentNumber: number
  /** 段取りの手順数 */
  total: number
  onClose: () => void
}

/**
 * タイマーの手順を**見るだけ**で開く窓（2026-08-15 便GQ）。
 *
 * ## 直した不具合
 * 全画面の調理中モードで、手順1のタイマーを始めて段取り6まで進めたあと、タイマーの窓の
 * 「手順①（1）を開く」を押すと**現在地が手順1まで戻って**いた。このアプリは
 * 「済んだ手順＝現在地より前」で数えている（docs/69 の不変条件）ので、
 * 手順2〜6が「まだやっていない」に巻き戻り、他の品の「次の手順」の表示もつられて巻き戻る。
 * 戻す手立ては「次へ」を押し直すことしか無かった。
 *
 * ## この窓の役目
 * 鳴ったタイマーの手順は、たいてい**すでに通り過ぎた手順**で、そこでやりたいのは
 * 「読んで、その一手をやる」こと。だから読むための面だけを出し、**現在地は動かさない**。
 * 台所で見失わないために、置いているのは次の3つだけ:
 *   1. 見出しで「何を読んでいるのか」を言う（タイマーを始めた手順）
 *   2. 「調理中の手順は変わりません」を本文の前に置く
 *   3. 閉じるボタンが**帰る先を番号で名乗る**（画面上部の位置表示と同じ「段取り {n}/{t}」）
 *
 * 閉じ方は3つ（見出し横の✕・背景のタップ・下の大きなボタン）。濡れた手でも閉じられるよう、
 * 面の大部分がそのまま閉じる操作になっている。
 *
 * **新しい保存物は作らない**（docs/69）。この窓が開いているかどうかは画面の中だけの状態で、
 * 端末には残さない＝読み込み直せば消え、段取り・進み具合には何も足していない。
 */
export default function CookStepPeekModal({
  open,
  order,
  stepLabel,
  recipeTitle,
  color,
  text,
  memo,
  notes,
  currentNumber,
  total,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.cookNavi.sessionTimerPeekTitle}
        data-testid="cook-session-timer-peek"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm min-w-0 rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-bold">{ja.cookNavi.sessionTimerPeekTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        {/* 読んでいるのがどの手順かを、タイマーの窓と同じ並び（段取りの通し番号＋
            レシピ内の手順番号＋料理名）で出す＝2つの窓のあいだで番号を読み比べられる */}
        <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-1.5">
          <StepBadge number={order} size={30} />
          {stepLabel && <StepBadge number={stepLabel} size={24} color={color} />}
          {/* 料理名は中身の幅で置く（面いっぱいに伸ばすと、色の帯が見出しのように見える）。
              長い名前は途中で切らずに折り返す＝調理中モードの上部の帯と同じ扱い */}
          <span
            className="ja-phrase min-w-0 rounded-full px-2 py-0.5 text-xs font-bold leading-snug"
            style={{ backgroundColor: color, color: 'var(--chip-ink)' }}
          >
            {recipeTitle}
          </span>
        </div>
        <p
          data-testid="cook-session-timer-peek-note"
          className="mt-[var(--space-sm)] text-xs text-ink-muted"
        >
          {ja.cookNavi.sessionTimerPeekNote}
        </p>
        {/* 本文が長い手順でも窓が画面からはみ出さないよう、読む面だけを送れるようにする */}
        <div className="mt-1 max-h-[42vh] overflow-y-auto rounded-sm bg-app px-2 py-1.5">
          <p data-testid="cook-session-timer-peek-text" className="ja-phrase leading-relaxed">
            {text}
          </p>
          {memo && <MemoText text={memo} className="mt-1 text-sm text-ink-muted" />}
          <NaviRecipeNotes
            notes={notes}
            testId="cook-session-timer-peek-recipe-memo"
            className="mt-1"
          />
        </div>
        <button
          type="button"
          data-testid="cook-session-timer-peek-close"
          onClick={onClose}
          className="mt-[var(--space-md)] w-full rounded-md bg-accent py-4 text-lg font-bold text-on-accent shadow-md"
        >
          {ja.cookNavi.sessionTimerPeekClose
            .replace('{n}', String(currentNumber))
            .replace('{t}', String(total))}
        </button>
      </div>
    </div>
  )
}
