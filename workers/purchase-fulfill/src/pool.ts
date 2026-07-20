/**
 * KVコードプールからのコード払い出し(冪等)。
 *
 * KVレイアウト:
 * - `pool`            : 未使用コードのJSON配列(例: ["UR-XXXX-XXXX", ...])。払い出すたびに1件popして書き戻す。
 * - `session:{id}`     : そのCheckout Sessionに割り当てたコードのJSON(`{ code, allocatedAt }`)。
 *                        これが既にあれば新規に払い出さず同じコードを返す(= 再読込・二重発行防止の冪等キー)。
 *
 * 原子性についての注意(設計どおりbest-effort。docs/44参照):
 * CloudflareのKVは単一キーに対する read→modify→write を原子的に行う機能を持たない
 * (トランザクションが無い)。そのため理論上は、同一セッションに対する2つのリクエストが
 * ほぼ同時に到達すると、両方が `session:{id}` 未存在と判定してそれぞれpoolから1件ずつpopし、
 * 後勝ちの書き込みが`session:{id}`を上書きする(先勝ちの1件は「消費されたがどのセッションにも
 * 紐付かない」形で失われる)ことがありうる。購入者に届くコードが二重発行されるわけではない
 * (常に1顧客=1コード)ため実害は小さく、想定volume(個人開発規模)ではこのレースはほぼ起こらない。
 * 完全な原子性が必要になった場合はDurable Objectへの置き換えを検討する(現時点ではオーバースペック)。
 */

const POOL_KEY = 'pool'
const sessionKey = (sessionId: string): string => `session:${sessionId}`

export type AllocationResult =
  | { status: 'allocated'; code: string }
  | { status: 'already_allocated'; code: string }
  | { status: 'out_of_stock' }

interface SessionRecord {
  code: string
  allocatedAt: number
}

/**
 * 指定したCheckout Sessionにコードを1つ割り当てる(冪等)。
 * 既に割り当て済みなら同じコードを返し、プールを消費しない。
 * GET /success と POST /webhook の両方から同じロジックとして呼ばれる想定。
 */
export async function allocateCodeForSession(kv: KVNamespace, sessionId: string): Promise<AllocationResult> {
  const existingRaw = await kv.get(sessionKey(sessionId))
  if (existingRaw) {
    const existing = JSON.parse(existingRaw) as SessionRecord
    return { status: 'already_allocated', code: existing.code }
  }

  const poolRaw = await kv.get(POOL_KEY)
  const pool: string[] = poolRaw ? (JSON.parse(poolRaw) as string[]) : []
  if (pool.length === 0) {
    return { status: 'out_of_stock' }
  }

  const code = pool.shift()
  if (!code) {
    return { status: 'out_of_stock' }
  }

  await kv.put(POOL_KEY, JSON.stringify(pool))
  const record: SessionRecord = { code, allocatedAt: Date.now() }
  await kv.put(sessionKey(sessionId), JSON.stringify(record))

  return { status: 'allocated', code }
}
