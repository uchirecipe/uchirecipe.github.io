import { useMemo, useRef } from 'react'
import { splitByTerms } from '../logic/termSplit'
import { renderJaUnits } from './jaUnits'
import TermText from './TermText'
import ComposedLines, { type BuiltAtom } from './ComposedLines'
import { termChip } from './ComposedStepText'
import type { OpenTerm } from './TermPopover'

// メモ1文用の行組み(2026-07-22 p12/memo-compose・オーナー要望「メモなどにも設定を反映」)。
//
// 手順本文(ComposedStepText)と同じ読点優先・幅実測エンジン(共通土台 ComposedLines / logic/lineCompose)を
// メモにも広げる。ただしメモの意味論は手順と違うので、アトム列は「用語箱のみ」に絞る:
//   ・用語ボタン(タップで説明)は残す = タップ可能な用語だけを分割不能な箱(atom)にする
//   ・タイマーボタンは付けない = 時間表記(「1分ずつ追加」等)は素のテキストのまま(箱化しない)
//   ・材料下線も付けない = ingredientNames を ComposedLines に渡さない(renderJaUnits names 無しと同じ)
// これで、手順が持つ「時間→タイマー化」「材料→下線」という副作用をメモに持ち込まずに折り位置だけ揃える。
//
// フォールバック(機能フラグ OFF・幅ゼロ・例外時)は従来のメモ描画に完全一致させる:
//   ・onOpenTerm あり → <TermText>(用語タップ可・renderPlain 既定=renderJaUnits names 無し)
//   ・onOpenTerm なし → renderJaUnits(素の ZWSP 文節折返し。TermPopover の説明文など)
// 用語の既出(seen)判定は TermText と同じく splitByTerms(text, seen) に委ねるため、呼び出し側
// (MemoText)の seen 更新ロジックをそのまま使えば、どの用語がタップ可能かは従来と1件も変わらない。

type Props = {
  /** メモの1文(MemoText の splitSentences が返す各要素) */
  text: string
  /** 用語タップ辞書。渡すと辞書語がタップ可能な箱になる。省略時は素のテキストとして組む */
  onOpenTerm?: OpenTerm
  /** ブロック内(手順 text+memo 等)で共有する既出用語の集合(タップ可否判定用) */
  seen?: Set<string>
}

/**
 * メモ1文を「テキスト片 + タップ可能な用語箱」のアトム列に分解する。
 * タイマー(findTimeTokens)も材料下線も一切通さない=手順本文の副作用を持ち込まない。
 * onOpenTerm が無い文脈では用語箱を作らず、素のテキスト1本にする(=単純に折り位置だけ組む)。
 */
function buildMemoAtoms(
  text: string,
  onOpenTerm: OpenTerm | undefined,
  seen: Set<string> | undefined,
): BuiltAtom[] {
  if (!onOpenTerm) return text ? [{ kind: 'text', text }] : []
  const atoms: BuiltAtom[] = []
  let n = 0
  for (const seg of splitByTerms(text, new Set(seen))) {
    if (seg.type === 'term' && seg.tappable) {
      atoms.push({ kind: 'atom', id: `t${n++}`, text: seg.match.text, node: termChip(seg, onOpenTerm) })
    } else {
      const t = seg.type === 'text' ? seg.text : seg.match.text
      if (t) atoms.push({ kind: 'text', text: t })
    }
  }
  return atoms
}

export default function ComposedMemoSentence({ text, onOpenTerm, seen }: Props) {
  // onOpenTerm は ref 経由の安定ラッパーで包み、アトム(=用語箱)を text/seen だけに依存させる。
  const onOpenTermRef = useRef(onOpenTerm)
  onOpenTermRef.current = onOpenTerm

  const hasTerm = !!onOpenTerm
  // seen は Set(識別子は毎描画で変わりうる)なので中身をキー化して useMemo の依存にする。
  const seenKey = seen ? [...seen].join('') : ''
  const builtAtoms = useMemo(
    () =>
      buildMemoAtoms(
        text,
        hasTerm ? (term, anchor) => onOpenTermRef.current!(term, anchor) : undefined,
        seen,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, hasTerm, seenKey],
  )

  // フォールバック(従来のメモ描画に一致)。ingredientNames は渡さない=材料下線なし(現状維持)。
  const fallback = onOpenTerm ? (
    <TermText text={text} seen={seen} onOpenTerm={onOpenTerm} />
  ) : (
    <>{renderJaUnits(text)}</>
  )

  return <ComposedLines builtAtoms={builtAtoms} fallback={fallback} />
}
