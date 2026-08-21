/**
 * うちレシピ「URLから取り込む」機能のCloudflare Worker。
 * GET /?url=<encoded> → 対象URLのHTMLを取得 → schema.org/Recipe(JSON-LD)を抽出 → 正規化JSONを返す。
 * GET /image?url=<encoded> → 対象URLの画像をそのまま中継する(ブラウザから外部画像を直接fetchすると
 * CORSで失敗するサイトが多いためのプロキシ。2026-07-21追加)。
 *
 * プライバシー方針: 取り込んだURLはログに一切残さない(console.log等は使わない。プラポリ整合)。
 * SSRF対策: http(s)以外のスキーム・localhost・プライベートIP帯へのアクセスは拒否する(validateTargetUrl
 * に共通化し、レシピ取り込み・画像プロキシの両ルートで共有する)。
 */
import { extractRecipeFromHtml } from './normalize'

// 検証(docs/39)と同じ条件のUA。一部サイトはbot判定でUAを見るため、一般的なブラウザに寄せる
const CHROME_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 8000
// 画像プロキシのサイズ上限(3MB)。Content-Length事前判定とストリーム打ち切りの両方で強制する
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

/**
 * Content-Typeが image/* でないときに、**先頭のバイト**で画像かどうかを見分けるための印
 * (2026-08-21 便IT・E・レシピ実測)。
 *
 * E・レシピは写真を `Content-Type: application/octet-stream` で返すため、中身はJPEGなのに
 * 画像の中継が invalid_content_type で弾いていた(レシピの写真だけが入らなかった)。
 * **何でも通す形にはしない**: ここに並べた形式の印で始まっていると確かめられたものだけ通し、
 * Content-Typeも見分けた形式に付け直す。
 *
 * SVGは意図的に入れていない(中にスクリプトを書ける形式で、先頭のバイトだけでは安全と言えない)。
 */
const IMAGE_SNIFF_BYTES = 16
const IMAGE_MAGIC: { type: string; match: (b: Uint8Array) => boolean }[] = [
  { type: 'image/jpeg', match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: 'image/png',
    match: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { type: 'image/gif', match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 },
  {
    type: 'image/webp',
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    // ISO Base Media形式: 4〜7バイトが "ftyp" で、続く印が avif / avis のときだけ通す
    type: 'image/avif',
    match: (b) => {
      if (!(b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70)) return false
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase()
      return brand === 'avif' || brand === 'avis'
    },
  },
]

/** 先頭のバイトから画像の種類を見分ける(見分けられなければ undefined) */
function sniffImageContentType(head: Uint8Array): string | undefined {
  if (head.length < IMAGE_SNIFF_BYTES) return undefined
  for (const { type, match } of IMAGE_MAGIC) {
    if (match(head)) return type
  }
  return undefined
}

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

/** GET /?url=<encoded>: 対象URLのHTMLを取得してschema.org/Recipeを抽出する(既存挙動) */
async function handleRecipeImport(requestUrl: URL, headers: Record<string, string>): Promise<Response> {
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
    // 上流のステータスをそのまま添えて返す(2026-07-28 便BX/C05)。
    // 404(ページが無い)と一時的な通信不調が同じ error:'fetch_failed' に潰れており、
    // app側が「時間をおいて試す」という404では絶対に解決しない案内しか出せなかった。
    // 数値のステータスだけなので、URLをログに残さないプライバシー方針には影響しない。
    if (!res.ok) return jsonResponse({ ok: false, error: 'fetch_failed', status: res.status }, 200, headers)
    html = await res.text()
  } catch {
    return jsonResponse({ ok: false, error: 'fetch_failed' }, 200, headers)
  }

  const recipe = extractRecipeFromHtml(html, validated.toString())
  if (!recipe) return jsonResponse({ ok: false, error: 'no_recipe' }, 200, headers)
  return jsonResponse({ ok: true, recipe }, 200, headers)
}

/**
 * GET /image?url=<encoded>: 対象URLの画像をそのまま中継する。
 * - Content-Typeがimage/*でなければ400
 * - 3MB超は拒否する(Content-Length事前判定 + 実際の受信バイト数によるストリーム打ち切りの両方)
 * - 成功時はContent-Typeを透過し、CORSは既存と同じ許可オリジン・Cache-Control: public, max-age=86400を付ける
 */
async function handleImageProxy(requestUrl: URL, headers: Record<string, string>): Promise<Response> {
  const target = requestUrl.searchParams.get('url')
  if (!target) return jsonResponse({ ok: false, error: 'invalid_url' }, 400, headers)

  const validated = validateTargetUrl(target)
  if (!validated) return jsonResponse({ ok: false, error: 'invalid_url' }, 400, headers)

  let res: Response
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      res = await fetch(validated.toString(), {
        headers: { 'User-Agent': CHROME_UA },
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }
  } catch {
    return jsonResponse({ ok: false, error: 'fetch_failed' }, 502, headers)
  }
  if (!res.ok || !res.body) return jsonResponse({ ok: false, error: 'fetch_failed' }, 502, headers)

  const upstreamType = res.headers.get('Content-Type') ?? ''
  const declaredImage = upstreamType.toLowerCase().startsWith('image/')

  const upstreamReader = res.body.getReader()
  // 便IT: Content-Typeが image/* でないときは、先頭のバイトを読んでから通すか決める。
  // 先に読んだぶんは捨てられないので、あとで組み直すストリームの先頭に必ず戻す。
  const head: Uint8Array[] = []
  let received = 0
  let contentTypeOut: string
  if (!declaredImage) {
    let ended = false
    while (received < IMAGE_SNIFF_BYTES && !ended) {
      const { done, value } = await upstreamReader.read()
      if (done || !value) {
        ended = true
        break
      }
      head.push(value)
      received += value.byteLength
    }
    const peek = new Uint8Array(received)
    let at = 0
    for (const chunk of head) {
      peek.set(chunk, at)
      at += chunk.byteLength
    }
    const sniffed = sniffImageContentType(peek)
    if (!sniffed) {
      await upstreamReader.cancel()
      return jsonResponse({ ok: false, error: 'invalid_content_type' }, 400, headers)
    }
    contentTypeOut = sniffed
  } else {
    contentTypeOut = upstreamType
  }

  const contentLength = res.headers.get('Content-Length')
  // 見分けのために先に読んだぶんだけで上限を超えていたら、その場で止める
  if ((contentLength && Number(contentLength) > MAX_IMAGE_BYTES) || received > MAX_IMAGE_BYTES) {
    await upstreamReader.cancel()
    return jsonResponse({ ok: false, error: 'too_large' }, 413, headers)
  }

  // Content-Lengthが無い/実態と違う場合に備え、受信しながら実バイト数を数えて上限超で打ち切る
  // (見分けのために先に読んだぶんも received に数え済み)
  const boundedStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const buffered = head.shift()
      if (buffered) {
        controller.enqueue(buffered)
        return
      }
      const { done, value } = await upstreamReader.read()
      if (done) {
        controller.close()
        return
      }
      received += value.byteLength
      if (received > MAX_IMAGE_BYTES) {
        controller.error(new Error('image too large'))
        await upstreamReader.cancel()
        return
      }
      controller.enqueue(value)
    },
    cancel(reason) {
      return upstreamReader.cancel(reason)
    },
  })

  return new Response(boundedStream, {
    status: 200,
    headers: {
      'Content-Type': contentTypeOut,
      'Cache-Control': 'public, max-age=86400',
      // 見分けた種類のとおりに扱わせる(ブラウザ側で別の種類として読み直させない)
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
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
    if (requestUrl.pathname === '/image') {
      return handleImageProxy(requestUrl, headers)
    }
    return handleRecipeImport(requestUrl, headers)
  },
}
