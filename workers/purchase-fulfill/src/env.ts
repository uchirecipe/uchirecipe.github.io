/** このWorkerが使うbinding/secretの型。wrangler.tomlのkv_namespacesとsecretに対応する。 */
export interface Env {
  /** コードプール(pool キー)とセッション割当(session:{id} キー)を保存するKV。 */
  PRO_CODES: KVNamespace
  /** Stripeの制限付きAPIキー(secret)。Checkout Session取得に使う。 */
  STRIPE_SECRET_KEY: string
  /** StripeのWebhook署名検証用シークレット(secret)。 */
  STRIPE_WEBHOOK_SECRET: string
  /**
   * Resendの送信用APIキー(secret・任意)。未設定なら解錠コードのメール送付をスキップし、
   * /success ページでのその場表示だけの従来動作になる(設定前にデプロイしても壊れない)。
   */
  RESEND_API_KEY?: string
}
