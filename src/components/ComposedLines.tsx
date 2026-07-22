import { Fragment, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ZWSP } from '../logic/jaWrap'
import { renderWrapped } from './jaUnits'
import {
  composeLines,
  LINE_COMPOSE_ENABLED,
  type ComposeAtom,
  type LinePiece,
} from '../logic/lineCompose'

// 読点優先・幅実測の行組みエンジンの「描画・計測の共通土台」(2026-07-22 p12/memo-compose で抽出)。
//
// もともと ComposedStepText.tsx にあった「アトム列を測って composeLines で行に割り、各行を
// <span className="block"> として描き直す」機構(ResizeObserver・フォント確定後の再計測・
// canvas 測定器・隠し測定層・フォールバック)を、手順本文とメモの両方から使えるよう切り出したもの。
// アトム列(text 片 + 分割不能な箱)をどう作るか(手順=タイマー/用語/材料下線、メモ=用語のみ)は
// 呼び出し側が決め、ここは「作られたアトム列と実描画ノード・フォールバックノード」を受け取って
// 行に割り付けるだけ。手順側の入出力は抽出前と完全に同一(builtAtoms・ingredientNames・fallback を
// そのまま渡す=1ミリも挙動を変えない)。
//
// フォールバック: 機能フラグ OFF / コンテナ幅ゼロ / 例外時は、呼び出し側が渡した fallback を
// そのまま描く(FOUC 回避も兼ねる)。初回描画も測定が済むまでは fallback。

/** 描画層が受け取るアトム。text=可分割テキスト / atom=分割不能な箱(実描画ノード node を持つ) */
export type BuiltAtom =
  | { kind: 'text'; text: string }
  | { kind: 'atom'; id: string; text: string; node: ReactNode }

// 本文フォントで文字幅を測る canvas 測定器を作る(材料下線・ZWSP は幅に影響しない)。
// 要件E: canvas の measureText は letter-spacing を無視するため、computed style の
// letterSpacing が normal 以外なら「measureText + letterSpacing × 文字数」で補正する。
// これを塞がないと実測が過小になり、語中の緊急折返し(overflow-wrap:anywhere)を誘発しうる。
let sharedCanvas: HTMLCanvasElement | null = null
function makeMeasurer(el: HTMLElement): (t: string) => number {
  const cs = getComputedStyle(el)
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
  sharedCanvas ??= document.createElement('canvas')
  const ctx = sharedCanvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context 取得不可')
  ctx.font = font
  const zwsp = new RegExp(ZWSP, 'g')
  const lsRaw = cs.letterSpacing
  const ls = lsRaw && lsRaw !== 'normal' ? parseFloat(lsRaw) : 0
  return (t: string) => {
    const s = t.replace(zwsp, '')
    const base = ctx.measureText(s).width
    return ls ? base + ls * [...s].length : base
  }
}

// 1行(LinePiece列)を描画ノードへ。連続するテキスト片は1本のランにまとめ、
// renderWrapped で材料下線+文節ZWSP(微小な測定ズレ時のフォールバック折返し点)を付ける。
// 箱は id で実ノードを引く。アイテム間には ZWSP を挟み、万一のはみ出し時に文節境界で折れるようにする。
// ingredientNames を渡さない(メモ)なら renderWrapped は下線なし=素の ZWSP 描画になる。
function renderLine(
  line: LinePiece[],
  nodeById: Map<string, ReactNode>,
  ingredientNames: readonly string[] | undefined,
): ReactNode {
  type Item = { type: 'run'; units: string[] } | { type: 'atom'; id: string }
  const items: Item[] = []
  for (const p of line) {
    if (p.kind === 'text') {
      const last = items[items.length - 1]
      if (last && last.type === 'run') last.units.push(p.text)
      else items.push({ type: 'run', units: [p.text] })
    } else {
      items.push({ type: 'atom', id: p.id })
    }
  }
  return items.map((item, idx) => (
    <Fragment key={idx}>
      {idx > 0 ? ZWSP : null}
      {item.type === 'run'
        ? renderWrapped(item.units.join(ZWSP), ingredientNames)
        : nodeById.get(item.id)}
    </Fragment>
  ))
}

type Props = {
  /** アトム列(text 片 + 実描画ノードつきの箱)。呼び出し側で組み立てる */
  builtAtoms: BuiltAtom[]
  /** 機能フラグ OFF・計測前・例外時に描くノード(手順=TermText+TimeText、メモ=TermText/素) */
  fallback: ReactNode
  /** 材料名(手順のみ)。渡すと text ランに控えめな下線を付ける。メモは undefined=下線なし */
  ingredientNames?: readonly string[]
}

/**
 * アトム列を測って composeLines で行に割り、各行を <span className="block"> として描く。
 * DOM 計測(幅監視・フォント確定後の再計測)を担う描画の共通土台。純ロジックは logic/lineCompose。
 */
export default function ComposedLines({ builtAtoms, fallback, ingredientNames }: Props) {
  const nodeById = useMemo(() => {
    const m = new Map<string, ReactNode>()
    for (const a of builtAtoms) if (a.kind === 'atom') m.set(a.id, a.node)
    return m
  }, [builtAtoms])

  const rootRef = useRef<HTMLSpanElement>(null)
  const boxRefs = useRef<Map<string, HTMLElement>>(new Map())
  const lastWidthRef = useRef(-1)
  const [version, setVersion] = useState(0) // 幅変化・フォント確定で再計測を促す
  const [lines, setLines] = useState<LinePiece[][] | null>(null)

  const enabled = LINE_COMPOSE_ENABLED

  // コンテナ幅の監視(回転・リサイズ)と、フォント確定後の1回再計測。
  // 幅が実際に変わったときだけ version を上げる=自分の再描画(高さ変化)ではループしない。
  useLayoutEffect(() => {
    if (!enabled) return
    const el = rootRef.current
    if (!el) return
    const onResize = () => {
      const w = el.clientWidth
      if (Math.abs(w - lastWidthRef.current) >= 1) {
        lastWidthRef.current = w
        setVersion((v) => v + 1)
      }
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(el)
    let cancelled = false
    // フォント確定後に一度だけ再計測(初回計測はフォールバックフォントの幅かもしれないため)
    const fontsReady = document.fonts?.ready
    if (fontsReady) {
      fontsReady.then(() => { if (!cancelled) setVersion((v) => v + 1) }).catch(() => {})
    }
    return () => {
      cancelled = true
      ro.disconnect()
    }
  }, [enabled])

  // 計測 → composeLines → 行の確定。例外時は lines=null にして従来描画へ落とす。
  useLayoutEffect(() => {
    if (!enabled) {
      setLines(null)
      return
    }
    const el = rootRef.current
    if (!el) return
    try {
      const width = el.clientWidth
      if (width <= 0) {
        setLines(null)
        return
      }
      const measure = makeMeasurer(el)
      // 要件4: 行末の読点/句点を枠外にぶら下げる hanging-punctuation:allow-end に対応する
      // ブラウザ(WebKit系)でだけ、行末の「、」「。」1字分をぶら下げ幅として収まり判定から差し引く。
      // Chromium 等は非対応なので false=従来判定(句読点も1字として数える)に倒し、はみ出しを防ぐ。
      const hangingPunct =
        typeof CSS !== 'undefined' &&
        typeof CSS.supports === 'function' &&
        CSS.supports('hanging-punctuation', 'allow-end')
      const composeAtoms: ComposeAtom[] = builtAtoms.map((a) =>
        a.kind === 'text'
          ? { kind: 'text', text: a.text }
          : {
              kind: 'atom',
              id: a.id,
              text: a.text,
              width: boxRefs.current.get(a.id)?.getBoundingClientRect().width ?? measure(a.text),
            },
      )
      setLines(composeLines(composeAtoms, width, measure, { eps: 1, hangingPunct }))
    } catch {
      setLines(null) // 測定不能・例外時は従来 ZWSP 描画のまま(フォールバック)
    }
    // version を依存に入れて幅変化・フォント確定で再計測する
  }, [enabled, builtAtoms, ingredientNames, version])

  if (!enabled) return <>{fallback}</>

  return (
    <span ref={rootRef} className="block" data-compose-root="">
      {lines === null
        ? fallback
        : lines.map((line, li) => (
            <span key={li} className="block" data-compose-line="">
              {renderLine(line, nodeById, ingredientNames)}
            </span>
          ))}
      {/* 箱の実幅を測る隠し層。aria-hidden で支援技術・Playwright の role 検索から除外し、
          可視の箱(合成後 or フォールバック)とロールが二重にならないようにする。
          visibility:hidden はレイアウト(幅)を保つので getBoundingClientRect で測れる。 */}
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: -9999,
          top: 0,
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {builtAtoms.map((a) =>
          a.kind === 'atom' ? (
            <span
              key={a.id}
              ref={(node) => {
                if (node) boxRefs.current.set(a.id, node)
                else boxRefs.current.delete(a.id)
              }}
            >
              {a.node}
            </span>
          ) : null,
        )}
      </span>
    </span>
  )
}
