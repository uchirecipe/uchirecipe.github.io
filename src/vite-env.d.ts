/// <reference types="vite/client" />

/**
 * アプリバージョン(package.jsonのversion)。vite.config.tsのdefineでビルド時に文字列として
 * 埋め込まれる(2026-07-17設定ゼロベース裁定#3。「このアプリについて」の表示に使う)
 */
declare const __APP_VERSION__: string
