import { Fragment, type ReactNode } from 'react'
import { splitByTerms } from '../logic/termSplit'
import { ZWSP } from '../logic/jaWrap'
import { renderJaUnits } from './jaUnits'
import { ja } from '../i18n/ja'
import type { OpenTerm } from './TermPopover'

type Props = {
  text: string
  /**
   * ブロック内(例: 1手順のtext+memo)で共有する既出用語の集合。
   * 渡さない場合はこの呼び出し内だけで完結する(材料memo・レシピmemo等、単独ブロック向け)。
   */
  seen?: Set<string>
  onOpenTerm: OpenTerm
  /**
   * 用語以外の部分の描画方法。省略時はwrapJaPhrasesのみ。
   * 手順本文(TimeTextの時間タップと共存させたい箇所)ではここにTimeTextを渡す。
   */
  renderPlain?: (text: string) => ReactNode
}

/**
 * 辞書語(src/data/cookingTerms.ts)を最長一致でタップ可能スパンに分割して描画する(2026-07-11)。
 * ・非用語部分はrenderPlain(省略時はwrapJaPhrases)を通すため、既存のBudouX文節折返しと共存する
 * ・用語スパンは点線下線+薄いアクセント背景。7文字以下は折返し禁止、超えるものは通常どおり折返し可
 * ・同じ語の2回目以降(seenに既出)はタップ不可の地の文として描画する(ノイズ防止)
 */
export default function TermText({ text, seen, onOpenTerm, renderPlain }: Props) {
  // propsのSetは書き換えない(StrictModeの二重実行対策)。既出判定はこの実行内のコピーで行う
  const localSeen = new Set(seen)
  const segments = splitByTerms(text, localSeen)
  const plain = renderPlain ?? ((t: string) => renderJaUnits(t))

  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg.type === 'text' ? (
            // 地の文が句読点で終わり、直後に用語スパンが続く場合はZWSPを挟む
            // (keep-allでは文末の「。」と次の用語が癒着し、文境界で折り返せなくなるため)
            <>
              {plain(seg.text)}
              {/[、。」』）)]$/.test(seg.text) && segments[i + 1]?.type === 'term'
                ? ZWSP
                : null}
            </>
          ) : !seg.tappable ? (
            plain(seg.match.text)
          ) : (
            // buttonはatomic inline(inline-block相当)で、keep-allでも前後が無条件の
            // 改行点になり「ねぎは小口切り|にする。」のような文節途中の折返しを生む
            // (2026-07-12 iPhoneSE2実機+プローブで確認)。spanなら通常のインラインとして
            // 前後のテキストと同じ行組みに参加するため、role=buttonのspanで実装する
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => onOpenTerm(seg.match.term, e.currentTarget)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenTerm(seg.match.term, e.currentTarget)
                }
              }}
              aria-label={ja.term.openAria.replace('{term}', seg.match.term.term)}
              // タップ可能と分かる見た目に強化(2026-07-21オーナー実機フィードバック):
              // 従来はdecoration-dottedのみで文字色が地の文と同じため薄く見えた。
              // 時間表記タップ(TimeText)のボタンと同じfont-bold text-accent+chip状の
              // 背景で統一しつつ、下線は点線のまま残して「用語=点線／タイマー=実線」の
              // 使い分け(MemoTextの▽ボタン・4語目以降チップと同じ規則)は維持する
              className={`cursor-pointer rounded-sm px-1 py-0.5 font-bold text-accent underline decoration-dotted underline-offset-2 ${
                seg.match.text.length <= 7 ? 'whitespace-nowrap' : ''
              }`}
              style={{ background: 'color-mix(in oklab, var(--accent) 10%, var(--bg))' }}
            >
              {seg.match.text}
            </span>
          )}
        </Fragment>
      ))}
    </>
  )
}
