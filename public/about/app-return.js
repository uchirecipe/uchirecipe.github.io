/*
 * 説明ページ（/about/ 配下）に「アプリへ帰る道」を出す共通の部品（2026-08-28 便LW）。
 *
 * 直した不具合（オーナー報告・2026-08-27）: 設定の「バックアップの詳しい説明を見る」を押すと、
 * アプリ（/#/…）ではなく静的なページへ移るので、戻る道が画面のどこにも無かった。
 * オーナー原文「アプリではなくHPへ飛ばされるので、アプリを開きなおしたり、
 * 『アプリを開く』をHPから探さないといけない」。
 * ホーム画面に追加したアプリにはブラウザの戻るボタンが出ないことがあるため、
 * ページの上に固定して常に見える帰り道を置く。
 *
 * 2026-08-27 便LS が manual.html と multi-device.html の2枚に同じものを直に書いていたのを、
 * 便LW がこのファイルへ切り出した。/about/ は素のHTMLでビルドを通っていないので、
 * 共通化の手段は「各ページから読み込む1本のスクリプト」しかない。
 * 各ページは <script defer src="/about/app-return.js"></script> の1行だけを持つ。
 * 見た目（CSS）も帰り道の要素も、このファイルが作って差し込む
 * （11ページに同じ20行のCSSを書き写すと、色や形を直すときに必ず取りこぼすため）。
 *
 * 受け渡し方は「行き先に帰り先を持たせる」形（app/src/logic/backLink.ts の aboutLinkWithReturn）。
 * ?from= に載っているアプリ内のパスへ /#<パス> で帰す。
 * アプリ内のパス以外は無視する＝外部サイトへ飛ばす踏み台にしない。
 */
;(function () {
  'use strict'

  // 受け付けるのはアプリ内のパスだけ（"/" で始まり "//" で始まらない）。
  // 判定は app/src/logic/backLink.ts の isInAppPath と同じ規則にそろえてある。
  var from = null
  try {
    from = new URLSearchParams(window.location.search).get('from')
  } catch {
    // 古いブラウザで URLSearchParams が使えないときは、帰り道を出さずに素のページのままにする
    return
  }
  if (!from || from.charAt(0) !== '/' || from.slice(0, 2) === '//') return

  // 色は各ページが持っているトークン（--surface / --border / --accent-ink-surface）に乗せる。
  // ページの本文より手前に置きたいので、印刷のときだけは消す。
  var style = document.createElement('style')
  style.textContent =
    '.app-return{position:fixed;left:12px;bottom:12px;z-index:60;display:inline-flex;' +
    'align-items:center;gap:6px;padding:10px 16px;border-radius:999px;background:var(--surface);' +
    'color:var(--accent-ink-surface);border:1px solid var(--border);' +
    'box-shadow:0 4px 14px rgba(67,54,42,0.18);font-weight:bold;font-size:15px;text-decoration:none}' +
    '.app-return[hidden]{display:none}' +
    '@media print{.app-return{display:none !important}}'
  document.head.appendChild(style)

  var link = document.createElement('a')
  link.id = 'appReturn'
  link.className = 'app-return'
  link.setAttribute('href', '/#' + from)
  link.textContent = '← うちレシピに戻る'
  // 読み上げの順は「本文へ移動」（skip）の次。skip が無いページでは先頭に置く
  var skip = document.querySelector('body > a.skip')
  if (skip) {
    document.body.insertBefore(link, skip.nextSibling)
  } else {
    document.body.insertBefore(link, document.body.firstChild)
  }

  // 帰り先を、説明ページどうしのリンクにも引き継ぐ（2026-08-28 便LW）。
  // 使い方ページは解錠コードの使い方・食品と目安価格の一覧・コラムへリンクしており、
  // 1歩進んだだけで帰り道が消えると、オーナーが報告した状態にそのまま戻る。
  // 書き替えるのは href が "/about/" で始まるものだけ＝同じページ内の目印（#…）や
  // 外部サイトには触れない（目印を書き替えると、その場で飛ぶはずが読み込み直しになる）。
  // 目印（#…）は必ず末尾に置き直す＝backLink.ts の aboutLinkWithReturn と同じ組み立て。
  var anchors = document.querySelectorAll('a[href^="/about/"]')
  for (var i = 0; i < anchors.length; i++) {
    var href = anchors[i].getAttribute('href')
    if (!href || href.indexOf('from=') !== -1) continue
    var hashAt = href.indexOf('#')
    var base = hashAt === -1 ? href : href.slice(0, hashAt)
    var hash = hashAt === -1 ? '' : href.slice(hashAt)
    var separator = base.indexOf('?') === -1 ? '?' : '&'
    anchors[i].setAttribute('href', base + separator + 'from=' + encodeURIComponent(from) + hash)
  }
})()
