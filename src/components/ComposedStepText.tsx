import { useMemo, useRef, type ReactNode } from 'react'
import { Timer as TimerIcon } from 'lucide-react'
import { findTimeTokens } from '../logic/time'
import { splitAroundTimeToken, ZWSP } from '../logic/jaWrap'
import { splitByTerms } from '../logic/termSplit'
import { underlineIngredients } from './jaUnits'
import { ja } from '../i18n/ja'
import type { OpenTerm } from './TermPopover'
import TimeText from './TimeText'
import TermText from './TermText'
import ComposedLines, { type BuiltAtom } from './ComposedLines'

// 読点優先・幅実測の行組みエンジンの「手順本文用アトム分解」層(2026-07-21 p9/line-compose)。
//
// 手順本文の描画は「用語(TermText)→時間(TimeText)→材料下線/ZWSP(renderWrapped)」の3層。
// このコンポーネントは、その3層が作る「アトム列」(テキスト片 + タイマー/用語の分割不能な箱)を
// 組み立てて ComposedLines に渡す。箱の中身(ボタン・下線・splitAroundTimeToken の結合規則)には
// 一切手を入れず、行への割り付けは共通土台 ComposedLines(logic/lineCompose)が決める。
//
// フォールバック: 機能フラグ OFF / コンテナ幅ゼロ / 例外時は、従来どおり TimeText・TermText を
// そのまま描く(FOUC 回避も兼ねる)。初回描画も測定が済むまでは従来描画(ComposedLines が担当)。
//
// コピー仕様の変更: 行が <span className="block"> になるため、範囲選択してコピーすると
// 行区切りが改行として入る(従来は1段落=改行なし)。手順は元々1文なので実害は小さい。

type Props = {
  text: string
  ingredientNames?: readonly string[]
  onOpenTerm: OpenTerm
  onStartTimer: (tokenText: string, seconds: number) => void
}

// タイマーボタンの箱(TimeText と同一の JSX。前後の結合文節ごと nowrap で1つの箱にする)
function timerChip(
  id: string,
  tokenText: string,
  seconds: number,
  bondPrev: string,
  bondNext: string,
  ingredientNames: readonly string[] | undefined,
  onStartTimer: (t: string, s: number) => void,
): ReactNode {
  return (
    <span className="whitespace-nowrap">
      {underlineIngredients(bondPrev, ingredientNames, `bp-${id}`)}
      <button
        type="button"
        onClick={() => onStartTimer(tokenText, seconds)}
        aria-label={`${tokenText} ${ja.timer.start}`}
        className="inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 font-bold text-accent underline underline-offset-2"
        style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
      >
        <TimerIcon size={16} aria-hidden />
        {tokenText}
      </button>
      {underlineIngredients(bondNext, ingredientNames, `bn-${id}`)}
    </span>
  )
}

// 用語スパンの箱(TermText の tappable 分岐と同一の JSX。display:inline のまま=atomic化しない)。
// メモの用語箱(ComposedMemoSentence)からも同じ箱を使えるよう export する。
export function termChip(match: ReturnType<typeof splitByTerms>[number], onOpenTerm: OpenTerm): ReactNode {
  if (match.type !== 'term') return null
  const term = match.match.term
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => onOpenTerm(term, e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenTerm(term, e.currentTarget)
        }
      }}
      aria-label={ja.term.openAria.replace('{term}', term.term)}
      className={`cursor-pointer rounded-sm px-1 py-0.5 font-bold text-accent underline decoration-dotted underline-offset-2 ${
        match.match.text.length <= 7 ? 'whitespace-nowrap' : ''
      }`}
      style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
    >
      {match.match.text}
    </span>
  )
}

/**
 * 手順テキストを「テキスト片 + 分割不能な箱(タイマー/用語)」のアトム列に分解する。
 * TermText(splitByTerms)→TimeText(findTimeTokens + splitAroundTimeToken)と同じ順序・同じ結合規則。
 * 箱の text は行復元・測定用の素の文字列、node は実描画ノード。
 */
function buildAtoms(
  text: string,
  ingredientNames: readonly string[] | undefined,
  onOpenTerm: OpenTerm,
  onStartTimer: (t: string, s: number) => void,
): BuiltAtom[] {
  const atoms: BuiltAtom[] = []
  let n = 0
  const seen = new Set<string>()
  for (const seg of splitByTerms(text, seen)) {
    if (seg.type === 'term' && seg.tappable) {
      const id = `t${n++}`
      atoms.push({ kind: 'atom', id, text: seg.match.text, node: termChip(seg, onOpenTerm) })
      continue
    }
    // 地の文(テキスト or 非タップ用語)を TimeText と同じ手順で時間トークン分割する
    const plain = seg.type === 'text' ? seg.text : seg.match.text
    const tokens = findTimeTokens(plain)
    if (tokens.length === 0) {
      if (plain) atoms.push({ kind: 'text', text: plain })
      continue
    }
    let cursor = 0
    tokens.forEach((token, i) => {
      const before = plain.slice(cursor, token.start)
      const afterEnd = i + 1 < tokens.length ? tokens[i + 1].start : plain.length
      const after = plain.slice(token.start + token.text.length, afterEnd)
      const tokenText = token.text.trim()
      const { pre, bondPrev, bondNext, post } = splitAroundTimeToken(before, after, tokenText.length)
      const preRaw = pre.replace(new RegExp(ZWSP, 'g'), '')
      if (preRaw) atoms.push({ kind: 'text', text: preRaw })
      // 要件2(便BA): bondNext の「ほど/くらい/ぐらい/程度」接尾より後ろに吸収された先頭文節が
      // 一定長(4字以上)で、かつ句読点で終わらないなら、箱から出して別の text アトムにする。
      // splitAroundTimeToken は旧方式(ブラウザ任せ折返し)向けに「[◯分]しっかり」まで箱へ密着させるが、
      // 新エンジンでは箱が肥大化して行に収まらず「しっかり|煮て」を割る(水ようかん)・「油で[1分]…」が
      // 巨大ユニット化して泣き別れる。読点/句点止まり(「[10分]煮て、」=3字)は #1 と整合させ箱に残す。
      // bondPrev 側は「[◯分]の直前修飾を密着させて泣き別れを防ぐ」ための存在なので、出すと逆効果
      // (「の / 油で」を招く)。よって bondPrev は据え置き、bondNext だけをスリム化する(便BA判断)。
      const suffix = bondNext.match(/^(ほど|くらい|ぐらい|程度)/)?.[0] ?? ''
      const absorbed = bondNext.slice(suffix.length)
      let boxBondNext = bondNext
      let pulled = ''
      if (absorbed && [...absorbed].length >= 4 && !/[、。]$/.test(absorbed)) {
        boxBondNext = suffix
        pulled = absorbed
      }
      const id = `m${n++}`
      atoms.push({
        kind: 'atom',
        id,
        text: bondPrev + tokenText + boxBondNext,
        node: timerChip(id, tokenText, token.seconds, bondPrev, boxBondNext, ingredientNames, onStartTimer),
      })
      const postRaw = pulled + post.replace(new RegExp(ZWSP, 'g'), '')
      if (postRaw) atoms.push({ kind: 'text', text: postRaw })
      cursor = afterEnd
    })
  }
  return mergeTildeBoxes(atoms)
}

/**
 * 要件9(便BA): タイマー箱・「〜」・タイマー箱の並びを1つの分割不能アトムに接着する。
 * 「冷蔵庫で[30分]〜[1時間]ほど漬ける。」の「〜」は範囲つなぎで、前後で行が割れてはいけない。
 * composeLines 上は「〜」境界削除で既に1ユニットだが、renderLine が箱アトム間に改行機会(ZWSP+
 * keep-all下のatomic inline境界)を作るため、実DOMでは箱の間で割れうる。両箱を1つの whitespace-nowrap
 * ノードにまとめて改行機会をなくす(テキストの「〜」前後不可分ルールの箱版)。中黒「〜」が独立した
 * text アトムとして挟まる形にも対応する。
 */
function mergeTildeBoxes(atoms: BuiltAtom[]): BuiltAtom[] {
  const out: BuiltAtom[] = []
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i]
    // パターンA: [「〜」で終わる箱][箱] / パターンB: [箱][text「〜」][箱]
    const b = atoms[i + 1]
    const c = atoms[i + 2]
    let left: BuiltAtom | null = null
    let midText = ''
    let right: BuiltAtom | null = null
    if (a.kind === 'atom' && a.text.endsWith('〜') && b && b.kind === 'atom') {
      left = a
      right = b
    } else if (a.kind === 'atom' && b && b.kind === 'text' && b.text === '〜' && c && c.kind === 'atom') {
      left = a
      midText = b.text
      right = c
    }
    if (left && right) {
      out.push({
        kind: 'atom',
        id: left.id,
        text: left.text + midText + right.text,
        node: (
          <span className="whitespace-nowrap">
            {left.node}
            {midText}
            {right.node}
          </span>
        ),
      })
      i += midText ? 2 : 1
      continue
    }
    out.push(a)
  }
  return out
}

export default function ComposedStepText({ text, ingredientNames, onOpenTerm, onStartTimer }: Props) {
  // コールバックは ref 経由の安定ラッパーで包み、アトム(=箱ノード)を text/材料名だけに依存させる。
  // (RecipeDetailPage は onStartTimer/ingredientNames を毎描画で作り直すため、素で依存すると
  //  アトムが毎回作り直され再計測が無駄に走る)
  const onOpenTermRef = useRef(onOpenTerm)
  const onStartTimerRef = useRef(onStartTimer)
  onOpenTermRef.current = onOpenTerm
  onStartTimerRef.current = onStartTimer

  const namesKey = ingredientNames ? ingredientNames.join('') : ''
  const builtAtoms = useMemo(
    () =>
      buildAtoms(
        text,
        ingredientNames,
        (term, anchor) => onOpenTermRef.current(term, anchor),
        (t, s) => onStartTimerRef.current(t, s),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, namesKey],
  )

  // 従来描画(フォールバック兼 FOUC 回避)。機能フラグ OFF・計測前・例外時に ComposedLines が使う。
  const fallback = (
    <TermText
      text={text}
      onOpenTerm={onOpenTerm}
      renderPlain={(t) => (
        <TimeText text={t} ingredientNames={ingredientNames} onStart={onStartTimer} />
      )}
    />
  )

  return <ComposedLines builtAtoms={builtAtoms} fallback={fallback} ingredientNames={ingredientNames} />
}
