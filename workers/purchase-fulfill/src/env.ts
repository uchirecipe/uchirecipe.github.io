/** このWorkerが使うbinding/secretの型。wrangler.tomlのkv_namespacesとsecretに対応する。 */
export interface Env {
  /** コードプール(pool キー)とセッション割当(session:{id} キー)を保存するKV。 */
  PRO_CODES: KVNamespace
  /** Stripeの制限付きAPIキー(secret)。Checkout Session取得に使う。 */
  STRIPE_SECRET_KEY: string
  /** StripeのWebhook署名検証用シークレット(secret)。 */
  STRIPE_WEBHOOK_SECRET: string
}
