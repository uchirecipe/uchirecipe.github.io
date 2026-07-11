import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import MaintenancePage from './MaintenancePage.tsx'
import { MAINTENANCE_MODE } from './logic/maintenance.ts'

// iPadでは、iPadOSのマルチタスク操作ボタン(ウィンドウ上部に重なる「…」「●●●」)が
// アプリの「戻る」ヘッダーに被る(2026-07-12オーナー実機報告)。CSSからは検知できないため、
// iPadだけ:rootにクラスを立てて上部に余白を足す。iPadOSのSafari系はUAが「Macintosh」を
// 名乗る(デスクトップ版UA)ので、タッチ点数との組み合わせで判定する(Macは maxTouchPoints=0、iPhoneはUAに Macintosh/iPad を含まないため対象外)
if (navigator.maxTouchPoints > 0 && /Macintosh|iPad/.test(navigator.userAgent)) {
  document.documentElement.classList.add('is-ipad')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>{MAINTENANCE_MODE ? <MaintenancePage /> : <App />}</StrictMode>,
)
