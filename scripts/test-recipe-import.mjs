// Cloudflare Worker「うちレシピURL取り込み」(workers/recipe-import/src/index.ts)の単体回帰テスト。
// 実行: npx tsx scripts/test-recipe-import.mjs
// 実ネットワークには一切出ない: globalThis.fetch をテストごとに差し替えて上流(対象URL)の応答を模す。
// normalize.ts側のJSON-LD抽出ロジック自体はscripts/test-logic.mjsで別途カバー済みのため、
// ここではWorkerのリクエスト/レスポンス配線(ルーティング・CORS・SSRF拒否・画像プロキシの
// Content-Type/サイズ検証)に絞って検証する。
import worker from '../workers/recipe-import/src/index.ts'

let passed = 0
const failures = []
function ok(label, cond, detail) {
  if (cond) {
    passed++
  } else {
    failures.push(detail ? `${label}: ${detail}` : label)
  }
}

const originalFetch = globalThis.fetch
function withMockFetch(handler, run) {
  globalThis.fetch = handler
  return run().finally(() => {
    globalThis.fetch = originalFetch
  })
}

const WORKER_BASE = 'http://worker.local'
function req(path, init) {
  return new Request(WORKER_BASE + path, init)
}
const PROD_ORIGIN = 'https://uchirecipe.com'
const DEV_ORIGIN = 'http://localhost:5173'

function ldJsonHtml(json) {
  return `<!doctype html><html><head><script type="application/ld+json">${JSON.stringify(json)}</script></head><body></body></html>`
}
const VALID_RECIPE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'Recipe',
  name: 'テストレシピ',
  recipeIngredient: ['じゃがいも 3個'],
  recipeInstructions: ['煮る'],
}

// ==================== 共通: メソッド・OPTIONS・CORS ====================

await (async () => {
  const res = await worker.fetch(req('/?url=https://example.com/a', { headers: { Origin: PROD_ORIGIN } , method: 'OPTIONS'}))
  ok('OPTIONS: 204を返す', res.status === 204)
  ok('OPTIONS: 本番オリジンにAccess-Control-Allow-Originを返す', res.headers.get('Access-Control-Allow-Origin') === PROD_ORIGIN)
})()

await (async () => {
  const res = await worker.fetch(req('/?url=https://example.com/a', { method: 'POST' }))
  ok('POST: 405', res.status === 405)
  const body = await res.json()
  ok('POST: ok=false/error=invalid_url', body.ok === false && body.error === 'invalid_url')
})()

await (async () => {
  const res = await worker.fetch(req('/?url=https://example.com/a', { headers: { Origin: 'https://evil.example.com' } }))
  ok(
    '未許可オリジン: Access-Control-Allow-Originを付けない(レスポンス自体は返す)',
    !res.headers.has('Access-Control-Allow-Origin'),
  )
})()

await (async () => {
  const res = await worker.fetch(req('/?url=https://example.com/a', { headers: { Origin: DEV_ORIGIN } }))
  ok('開発オリジン(localhost:任意ポート)も許可される', res.headers.get('Access-Control-Allow-Origin') === DEV_ORIGIN)
})()

// ==================== GET /?url=: レシピ取り込み(既存挙動の回帰) ====================

await (async () => {
  const res = await worker.fetch(req('/', { headers: { Origin: PROD_ORIGIN } }))
  const body = await res.json()
  ok('/?urlパラメータ無し: 400/invalid_url', res.status === 400 && body.ok === false && body.error === 'invalid_url')
})()

await (async () => {
  const res = await worker.fetch(req('/?url=' + encodeURIComponent('ftp://example.com/a'), { headers: { Origin: PROD_ORIGIN } }))
  const body = await res.json()
  ok('/: http(s)以外のスキームは400/invalid_url', res.status === 400 && body.error === 'invalid_url')
})()

for (const host of ['127.0.0.1', 'localhost', '192.168.1.10', '10.0.0.5', '169.254.169.254', '[::1]']) {
  await (async () => {
    let fetchCalled = false
    await withMockFetch(
      async () => {
        fetchCalled = true
        throw new Error('should not be called')
      },
      async () => {
        const res = await worker.fetch(
          req('/?url=' + encodeURIComponent(`http://${host}/secret`), { headers: { Origin: PROD_ORIGIN } }),
        )
        const body = await res.json()
        ok(`/: SSRF拒否(${host}) 400/invalid_url`, res.status === 400 && body.error === 'invalid_url')
        ok(`/: SSRF拒否(${host}) 実際に上流fetchしない`, !fetchCalled)
      },
    )
  })()
}

await (async () => {
  await withMockFetch(
    async () => new Response(ldJsonHtml(VALID_RECIPE_JSONLD), { status: 200 }),
    async () => {
      const res = await worker.fetch(
        req('/?url=' + encodeURIComponent('https://example.com/recipe'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/: 成功時200/ok=true', res.status === 200 && body.ok === true)
      ok('/: 成功時recipe.titleが読める', body.recipe?.title === 'テストレシピ')
      ok('/: Content-Typeはapplication/json', (res.headers.get('Content-Type') ?? '').startsWith('application/json'))
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => new Response('not found', { status: 404 }),
    async () => {
      const res = await worker.fetch(
        req('/?url=' + encodeURIComponent('https://example.com/missing'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      // 既存挙動: 上流が失敗してもWorker自体は200を返しok=falseで理由を伝える(温存)。
      // 2026-07-28 便BX/C05: 上流のステータスを status として添える(app側が404と一時障害を
      // 書き分けるために必要。URL自体はログにも応答にも残さないのでプラポリ影響なし)
      ok(
        '/: 上流404はステータス200のままok=false/fetch_failed + status:404',
        res.status === 200 && body.ok === false && body.error === 'fetch_failed' && body.status === 404,
      )
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => new Response('forbidden', { status: 403 }),
    async () => {
      const res = await worker.fetch(
        req('/?url=' + encodeURIComponent('https://example.com/blocked'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      // 便BX/C05: サイト側の拒否(403)も上流ステータスを添える。app側はこれを見て
      // 「待てば直る」ではなく貼り付けへ案内する
      ok(
        '/: 上流403も200/fetch_failed + status:403',
        res.status === 200 && body.ok === false && body.error === 'fetch_failed' && body.status === 403,
      )
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => {
      throw new Error('network down')
    },
    async () => {
      const res = await worker.fetch(
        req('/?url=' + encodeURIComponent('https://example.com/down'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      // 通信例外にはHTTPステータスが存在しないので status は付かない
      // (app側はこれを「一時的な不調」として扱い、数分後の再試行を勧める)
      ok(
        '/: 上流fetch例外も200/fetch_failed(statusは付かない)',
        res.status === 200 && body.ok === false && body.error === 'fetch_failed' && body.status === undefined,
      )
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => new Response('<html><body>レシピはありません</body></html>', { status: 200 }),
    async () => {
      const res = await worker.fetch(
        req('/?url=' + encodeURIComponent('https://example.com/article'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/: Recipe型が無ければ200/no_recipe', res.status === 200 && body.ok === false && body.error === 'no_recipe')
    },
  )
})()

// ==================== GET /image?url=: 画像プロキシ(新設) ====================

await (async () => {
  const res = await worker.fetch(req('/image', { headers: { Origin: PROD_ORIGIN } }))
  const body = await res.json()
  ok('/image: urlパラメータ無し 400/invalid_url', res.status === 400 && body.error === 'invalid_url')
})()

await (async () => {
  let fetchCalled = false
  await withMockFetch(
    async () => {
      fetchCalled = true
      throw new Error('should not be called')
    },
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('http://127.0.0.1:8080/x.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image: SSRF拒否 400/invalid_url', res.status === 400 && body.error === 'invalid_url')
      ok('/image: SSRF拒否は上流fetchしない', !fetchCalled)
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => new Response('<html>not an image</html>', { status: 200, headers: { 'Content-Type': 'text/html' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/page.html'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image: image/*以外のContent-Typeは400', res.status === 400 && body.error === 'invalid_content_type')
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => new Response(null, { status: 404 }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/missing.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image: 上流404は502/fetch_failed', res.status === 502 && body.error === 'fetch_failed')
    },
  )
})()

await (async () => {
  await withMockFetch(
    async () => {
      throw new Error('network down')
    },
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/down.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image: 上流fetch例外は502/fetch_failed', res.status === 502 && body.error === 'fetch_failed')
    },
  )
})()

await (async () => {
  // Content-Length事前判定: ヘッダーだけで3MB超を宣言していれば本文を読まずに413で拒否する
  await withMockFetch(
    async () =>
      new Response(new Uint8Array(10), {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(5 * 1024 * 1024) },
      }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/huge.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image: Content-Length宣言が3MB超なら413/too_large', res.status === 413 && body.error === 'too_large')
    },
  )
})()

await (async () => {
  // ストリーム打ち切り: Content-Lengthが無い(または実態と違う)まま3MB超のバイト列が流れてきても、
  // 受信しながら数えて上限超でストリームをエラー終了させる(ヘッダーが確定済みなのでstatusは200のまま)
  await withMockFetch(
    async () => {
      const chunk = new Uint8Array(1_000_000)
      let sent = 0
      const stream = new ReadableStream({
        pull(controller) {
          if (sent >= 4) {
            controller.close()
            return
          }
          sent++
          controller.enqueue(chunk)
        },
      })
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'image/png' } })
    },
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/stream-huge.png'), { headers: { Origin: PROD_ORIGIN } }),
      )
      ok('/image: ストリーム打ち切りケースはヘッダー確定済みのため200で開始', res.status === 200)
      let rejected = false
      try {
        await res.arrayBuffer()
      } catch {
        rejected = true
      }
      ok('/image: 3MB超で本文の読み取り自体が失敗する(打ち切り)', rejected)
    },
  )
})()

await (async () => {
  // 正常系: 3MB以内の画像はそのまま透過される(Content-Type・Cache-Control・CORS込み)
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  await withMockFetch(
    async () =>
      new Response(bytes, {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(bytes.length) },
      }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/photo.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      ok('/image: 正常系200', res.status === 200)
      ok('/image: Content-Typeを透過する', res.headers.get('Content-Type') === 'image/jpeg')
      ok('/image: Cache-Controlが付く', res.headers.get('Cache-Control') === 'public, max-age=86400')
      ok('/image: CORS(本番オリジン)が付く', res.headers.get('Access-Control-Allow-Origin') === PROD_ORIGIN)
      const buf = new Uint8Array(await res.arrayBuffer())
      ok('/image: 画像バイトがそのまま届く', buf.length === bytes.length && buf.every((b, i) => b === bytes[i]))
    },
  )
})()

await (async () => {
  // Content-Typeにcharset等が付いていても image/ 前方一致で許可する
  const bytes = new Uint8Array([9, 9, 9])
  await withMockFetch(
    async () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/photo.svg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      ok('/image: image/svg+xml; charset=utf-8 も許可される', res.status === 200)
    },
  )
})()

// ==================== ③(便IT 2026-08-21): Content-Typeが application/octet-stream の画像 ====================
// E・レシピ実測: 画像が `Content-Type: application/octet-stream` で返るため、
// 中身はJPEGなのに invalid_content_type で弾いていた(レシピの写真だけが入らない)。
// 何でも通す形にはせず、**先頭のバイト**で画像だと確かめてから通す。

/** 先頭に印(マジックバイト)を置いた本文を作る */
function bytesWithHead(head, extra = 32) {
  const out = new Uint8Array(head.length + extra)
  out.set(head, 0)
  return out
}
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0]
const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const GIF_HEAD = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]
const WEBP_HEAD = [0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]

for (const [label, head, expected] of [
  ['JPEG', JPEG_HEAD, 'image/jpeg'],
  ['PNG', PNG_HEAD, 'image/png'],
  ['GIF', GIF_HEAD, 'image/gif'],
  ['WebP', WEBP_HEAD, 'image/webp'],
]) {
  await (async () => {
    const bytes = bytesWithHead(head)
    await withMockFetch(
      async () =>
        new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }),
      async () => {
        const res = await worker.fetch(
          req('/image?url=' + encodeURIComponent('https://example.com/photo.bin'), { headers: { Origin: PROD_ORIGIN } }),
        )
        ok(`/image IT③: application/octet-stream でも中身が${label}なら通す`, res.status === 200)
        ok(`/image IT③: ${label}と見分けたContent-Typeを付け直す`, res.headers.get('Content-Type') === expected)
        const buf = new Uint8Array(await res.arrayBuffer())
        ok(
          `/image IT③: ${label}のバイトが1バイトも欠けずに届く`,
          buf.length === bytes.length && buf.every((b, i) => b === bytes[i]),
        )
      },
    )
  })()
}

await (async () => {
  // 画像でないものを画像として扱わない: HTMLはこれまでどおり400
  const bytes = new TextEncoder().encode('<!doctype html><html><body>not an image</body></html>')
  await withMockFetch(
    async () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/page.bin'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image IT③: 中身がHTMLなら400/invalid_content_type のまま', res.status === 400 && body.error === 'invalid_content_type')
    },
  )
})()

await (async () => {
  // SVGは通さない(中にスクリプトを書ける形式なので、印だけでは安全と言えない)
  const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
  await withMockFetch(
    async () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/x.bin'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image IT③: 中身がSVGでも通さない(400)', res.status === 400 && body.error === 'invalid_content_type')
    },
  )
})()

await (async () => {
  // 中身の判別に足りない短さ(2バイト)は通さない
  await withMockFetch(
    async () => new Response(new Uint8Array([0xff, 0xd8]), { status: 200, headers: { 'Content-Type': 'application/octet-stream' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/tiny.bin'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image IT③: 見分けが付かない短さは通さない(400)', res.status === 400 && body.error === 'invalid_content_type')
    },
  )
})()

await (async () => {
  // 3MBの上限は見分けた側でも効く(Content-Length宣言)
  await withMockFetch(
    async () =>
      new Response(bytesWithHead(JPEG_HEAD), {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(5 * 1024 * 1024) },
      }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/huge.bin'), { headers: { Origin: PROD_ORIGIN } }),
      )
      const body = await res.json()
      ok('/image IT③: 見分けた画像でも3MB超は413/too_large', res.status === 413 && body.error === 'too_large')
    },
  )
})()

await (async () => {
  // 上限超のストリーム(Content-Lengthなし)も、見分けた側で打ち切られる
  await withMockFetch(
    async () => {
      const first = bytesWithHead(JPEG_HEAD, 1_000_000)
      const chunk = new Uint8Array(1_000_000)
      let sent = 0
      const stream = new ReadableStream({
        pull(controller) {
          if (sent === 0) {
            sent++
            controller.enqueue(first)
            return
          }
          if (sent >= 4) {
            controller.close()
            return
          }
          sent++
          controller.enqueue(chunk)
        },
      })
      return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
    },
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/stream.bin'), { headers: { Origin: PROD_ORIGIN } }),
      )
      ok('/image IT③: 見分けた画像のストリームも200で始まる', res.status === 200)
      let rejected = false
      try {
        await res.arrayBuffer()
      } catch {
        rejected = true
      }
      ok('/image IT③: 3MB超で本文の読み取りが打ち切られる', rejected)
    },
  )
})()

await (async () => {
  // Content-Typeが image/* のときは、これまでどおりそのまま透過する(中身は見に行かない)
  const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
  await withMockFetch(
    async () => new Response(bytes, { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
    async () => {
      const res = await worker.fetch(
        req('/image?url=' + encodeURIComponent('https://example.com/photo.jpg'), { headers: { Origin: PROD_ORIGIN } }),
      )
      ok('/image IT③: image/*はこれまでどおり透過(回帰)', res.status === 200 && res.headers.get('Content-Type') === 'image/jpeg')
      const buf = new Uint8Array(await res.arrayBuffer())
      ok('/image IT③: image/*のバイトもそのまま(回帰)', buf.length === bytes.length && buf.every((b, i) => b === bytes[i]))
    },
  )
})()


// ---------- 結果 ----------
console.log(`合格: ${passed}件 / 失敗: ${failures.length}件`)
for (const f of failures) console.log(`  NG ${f}`)
process.exit(failures.length > 0 ? 1 : 0)
