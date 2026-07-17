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
      // 新しいバージョンを公開したら、開いているアプリを自動で更新する
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'うちレシピ',
        short_name: 'うちレシピ',
        description: 'おうちのレシピをまとめて管理できるレシピ帳アプリ',
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
        // ビルドされた HTML / JS / CSS / SVG をオフライン用にキャッシュする
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // /sets/ ・ /about/ 配下(アプリ本体ではないSPA外の静的ページ)は、
        // Service Workerの「未知の遷移はアプリ本体にフォールバック」対象から外す
        // (外さないと、配布ページ等を開いたつもりがアプリ本体の白紙/ホーム画面に化けてしまう)
        navigateFallbackDenylist: [/^\/sets\//, /^\/about\//],
      },
    }),
  ],
})
