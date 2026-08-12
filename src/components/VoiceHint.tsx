import { ja } from '../i18n/ja'

/**
 * 声で使える言葉の案内（2026-08-12 便FX・オーナー指摘「声で操作の説明、もっとシンプルに。
 * 読み上げ部分を目立たせて。タイマー説明はまとめて、タイマー操作、のみでも最悪伝わるので、
 * ストップで停止、のような個別説明はいらない」）。
 *
 * 出すのは3つだけ（手順の移動／読み上げ／タイマー操作）で、**真ん中の読み上げだけを
 * 太字・アクセント色**にする。台所で目をやったときに、いちばん使う1つが最初に見つかる形。
 *
 * 1品の調理中モード（FocusMode）と並行調理ナビの調理中モード（CookSessionOverlay）が
 * この部品を共有する＝片方だけ言い方が変わることが構造的に起きない。
 * ナビの画面だけに要る色の言い方（「青」「緑」「ピンク」）は `trailing` で足す
 * ＝色の無い1品の画面に色の案内が出ることも起きない。
 *
 * 文字の親（<p>）の中に流し込む前提なので、ここでは枠も余白も持たない。
 */
export default function VoiceHint({ trailing }: { trailing?: string }) {
  return (
    <>
      {ja.focus.micHintMove}、
      <span data-testid="voice-hint-read" className="font-bold text-accent-ink">
        {ja.focus.micHintRead}
      </span>
      、{ja.focus.micHintTimer}
      {trailing}
    </>
  )
}
