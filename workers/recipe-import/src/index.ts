/**
 * うちレシピ「URLから取り込む」機能のCloudflare Worker。
 * GET /?url=<encoded> → 対象URLのHTMLを取得 → schema.org/Recipe(JSON-LD)を抽出 → 正規化JSONを返す。
 *
 * プライバシー方針: 取り込んだURLはログに一切残さない(console.log等は使わない。プラポリ整合)。
 * SSRF対策: http(s)以外のスキーム・localhost・プライベートIP帯へのアクセスは拒否する。
 */
import { extractRecipeFromHtml } from './normalize'

// 検証(docs/39)と同じ条件のUA。一部サイトはbot判定でUAを見るため、一般的なブラウザに寄せる
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 8000

// 開発オリジン(Vite dev既定5173・preview既定4173等)は localhost の任意ポートを許可する。
// 本番オリジンはうちレシピの固定ドメインのみ(CLAUDE.mdの取り決め: オリジン変更禁止)
const PROD_ORIGIN = 'https://uchirecipe.com'
const DEV_ORIGIN_RE = /^http:\/\/localhost:\d+$/

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && (origin === PROD_ORIGIN || DEV_ORIGIN_RE.test(origin))) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Vary'] = 'Origin'
  }
  return headers
}

function jsonResponse(body: unknown, status: number, extraHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  })
}

const PRIVATE_HOSTNAME_RE =
  /^(localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|0\.0\.0\.0|\[?::1\]?|\[?fc[0-9a-f]{2}:.*|\[?fe80:.*)$/i

/** SSRF対策: http(s)以外・localhost/プライベートIP帯を拒否した上でURLを返す(不正なら null) */
function validateTargetUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const hostname = url.hostname.toLowerCase()
  if (PRIVATE_HOSTNAME_RE.test(hostname) || hostname.endsWith('.localhost')) return null
  return url
}

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin')
    const headers = corsHeaders(origin)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers })
    }
    if (request.method !== 'GET') {
      return jsonResponse({ ok: false, error: 'invalid_url' }, 405, headers)
    }

    const requestUrl = new URL(request.url)
    const target = requestUrl.searchParams.get('url')
    if (!target) return jsonResponse({ ok: false, error: 'invalid_url' }, 400, headers)

    const validated = validateTargetUrl(target)
    if (!validated) return jsonResponse({ ok: false, error: 'invalid_url' }, 400, headers)

    let html: string
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      let res: Response
      try {
        res = await fetch(validated.toString(), {
          headers: { 'User-Agent': CHROME_UA, 'Accept-Language': 'ja' },
          redirect: 'follow',
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timeoutId)
      }
      if (!res.ok) return jsonResponse({ ok: false, error: 'fetch_failed' }, 200, headers)
      html = await res.text()
    } catch {
      return jsonResponse({ ok: false, error: 'fetch_failed' }, 200, headers)
    }

    const recipe = extractRecipeFromHtml(html, validated.toString())
    if (!recipe) return jsonResponse({ ok: false, error: 'no_recipe' }, 200, headers)
    return jsonResponse({ ok: true, recipe }, 200, headers)
  },
}
