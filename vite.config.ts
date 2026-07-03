import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // ── GitHub Pages で公開するときの設定 ──────────────────────
  // GitHub Pages に公開するときは、下の base を '/リポジトリ名/' に変更してください。
  // 例: リポジトリ名が「uchi-recipe」なら → base: '/uchi-recipe/'
  // 手元での開発中（npm run dev）は '/' のままで OK です。
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 新しいバージョンを公開したら、開いているアプリを自動で更新する
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-maskable.svg'],
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
        ],
      },
      workbox: {
        // ビルドされた HTML / JS / CSS / SVG をオフライン用にキャッシュする
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
      },
    }),
  ],
})
