import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// 「このアプリについて」に表示するアプリバージョン(2026-07-17設定ゼロベース裁定#3)。
// package.jsonのversionをビルド時の文字列定数として埋め込む(実行時にpackage.json自体を
// fetchしない)。readFileSync+JSON.parseを使うのは、import assertions("with { type: 'json' }")の
// 対応状況がNode/TSのバージョンに依存し不安定なため(vite.config.ts自体はNode上で実行される
// 設定ファイルなので、ここだけはNode組み込みAPIで素直に読む)
const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  // ── GitHub Pages で公開するときの設定 ──────────────────────
  // リポジトリ名を uchirecipe.github.io にしたので、パス無しのルートURL
  // （https://uchirecipe.github.io/）で公開される。base は '/' のままでよい。
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 新しいバージョンを公開したら、開いているアプリを自動で更新する。
      // 'autoUpdate' は新しいService Workerが待たずに有効になる方式(skipWaiting + clientsClaim)で、
      // 次にアプリを開き直したときには必ず新しい版になる。
      // 2026-08-09 便ER: これは維持したまま、src/logic/appUpdate.ts が virtual:pwa-register の
      // registerSW() で登録を引き受けるようにした(仮想モジュールをアプリ側でimportすると、
      // この設定が自動で差し込む registerSW.js は出力されなくなる)。
      // 目的は2つ。(a)新しい版が入ったことを画面下の帯で知らせ、ワンタップで即座に反映できるようにする
      // (b)registerSWが既定で行う「有効になった瞬間の自動リロード」を onNeedReload で止め、
      // 調理中・段取り実行中・入力中に画面が作り直されて作業が飛ぶことを防ぐ
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'うちレシピ',
        short_name: 'うちレシピ',
        description: 'おうちのレシピをまとめて管理できるレシピ帳アプリ',
        // ── ホーム画面のアイコンから開く行き先(2026-08-17 便HK) ──────────────
        // オーナー実機フィードバック「ホーム画面に追加のURLを献立ホーム変更」。
        // 2026-08-17 便HG でアプリのホーム画面を廃止し、献立の「日」が入口になったので、
        // アイコンから開く行き先も献立を直に指す。
        //
        // id を先に足しているのが要点。manifest に id が無いとブラウザは start_url を
        // 「そのアプリの見分け」として使うため、start_url だけを変えると
        // すでにホーム画面へ追加してある人のアイコンが別アプリ扱いになり、
        // 更新が届かない/追加し直しになる。これまでの見分けと同じ値 '/' を明示して固定してから
        // start_url を動かすことで、追加済みのアイコンはそのまま使い続けられる。
        //
        // 追加済みの人が壊れないことは二重に担保している:
        //   ・iPhone/iPadは追加した時点のURLを覚えるので、既存のアイコンは今までどおり '/' を開く
        //   ・'/' は HashRouter の '#/' から献立へ送られる(src/App.tsx の Navigate・便HG)ので、
        //     どちらの行き先でも着く先は同じ献立の「日」になる
        // e2eの HK-PWA が「start_urlが献立を指す」「'/'も献立に着く」「idが '/' のまま」の3点を見張る
        id: '/',
        start_url: '/#/meal-plan',
        lang: 'ja',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf5ec',
        theme_color: '#d9480f',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-maskable.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // ビルドされた HTML / JS / CSS / SVG をオフライン用にキャッシュする。
        // webp を足したのは月間画面のサンプルデモ用の写真(public/demo/*.webp・合計23KB)だけを
        // オフラインでも出すため(2026-08-02 便DC)。説明書・LPのスクリーンショット
        // (public/about/img/**・約2MB)は読み物側の画像なので、アプリ本体の事前キャッシュには入れない
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webp}'],
        globIgnores: ['about/img/**'],
        /**
         * 説明ページの絵だけ、**一度読めたものを貯めて次から使う**（2026-08-28 便MA）。
         *
         * オーナー報告「献立を提案の画像がでない → （後日）再表示何度かしたら直りました。」
         * 原因（実測）: 説明ページのHTMLは先読み(precache)に入っているので端末から開けるのに、
         * 絵は上の globIgnores で先読みから外してあり、**毎回ネットワークから取りに行く**。
         * 取りそこねても `loading="lazy"` の絵は自分で拾い直さないので、そのまま出ないまま残る。
         * 実測（通信を切って開き直す＝取りそこねと同じ状態）: 14枚中10枚が出なかった。
         *
         * **先読みには入れない**。`public/about/img/` は50ファイル・約1.4MBあり、
         * いまの先読み（57件・約3.0MB）に足すと**アプリを入れる全員の初回が約1.5倍**になる。
         * 読み物の絵のために、アプリを使うだけの人の通信を増やさない。
         *
         * 貯め方は StaleWhileRevalidate＝**貯めたものをすぐ出しつつ、裏で取り直す**。
         * ・一度読めた絵は、あとで取りそこねても必ず出る（オーナーの報告そのものが直る）
         * ・撮り直したら、その裏で取り直したものが次に開いたときに出る
         *   （CacheFirst にすると期限が切れるまで古い絵が残るので採らない）
         * ・貯めるのは `/about/img/` の下だけ。アプリ本体のバンドル・写真には触らない
         * ・上限は60件・30日（絵は50ファイルなので全部入っても収まり、端末の容量を食い潰さない）
         */
        runtimeCaching: [
          {
            // 同じサイトの `/about/img/…` だけに当てる（絵の置き場所はここ1か所）
            urlPattern: /\/about\/img\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'uchi-about-img',
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // 失敗した応答を貯めない（貯めると、出ない絵が居座る）
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
        // /sets/ ・ /about/ 配下(アプリ本体ではないSPA外の静的ページ)は、
        // Service Workerの「未知の遷移はアプリ本体にフォールバック」対象から外す
        // (外さないと、配布ページ等を開いたつもりがアプリ本体の白紙/ホーム画面に化けてしまう)
        navigateFallbackDenylist: [/^\/sets\//, /^\/about\//],
      },
    }),
  ],
})
