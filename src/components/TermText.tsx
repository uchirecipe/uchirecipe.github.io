import { Fragment, type ReactNode } from 'react'
import { splitByTerms } from '../logic/termSplit'
import { wrapJaPhrases } from '../logic/jaWrap'
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
  const plain = renderPlain ?? ((t: string) => wrapJaPhrases(t))

  return (
    <>
      {segments.map((seg, i) => (
        <Fragment key={i}>
          {seg.type === 'text' ? (
            plain(seg.text)
          ) : !seg.tappable ? (
            plain(seg.match.text)
          ) : (
            <button
              type="button"
              onClick={(e) => onOpenTerm(seg.match.term, e.currentTarget)}
              aria-label={ja.term.openAria.replace('{term}', seg.match.term.term)}
              className={`rounded-sm underline decoration-dotted underline-offset-2 ${
                seg.match.text.length <= 7 ? 'whitespace-nowrap' : ''
              }`}
              style={{ background: 'color-mix(in oklab, var(--accent) 8%, var(--bg))' }}
            >
              {seg.match.text}
            </button>
          )}
        </Fragment>
      ))}
    </>
  )
}
