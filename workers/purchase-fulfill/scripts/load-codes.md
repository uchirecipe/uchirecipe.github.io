# 購入後コード自動配信Worker セットアップ手順(オーナー向け・初心者向け)

「購入後に解錠コードを自動で渡す」機能(うちレシピを買うと、決済完了後の画面にそのままコードが
表示される仕組み)は、Cloudflare Workers 上の小さなプログラム(`app/workers/purchase-fulfill/`)と、
Stripeの設定変更の両方が揃って初めて動く。設計の背景は `../../../docs/44_購入後コード自動配信_設計.md` を参照。

この手順は上から順番にやれば大丈夫。**必ず「①〜④ KVとWorkerの準備」→「⑤ テストモードで通し確認」→
「⑥ 本番切り替え」の順で進める**こと(いきなり本番の100コードを投入しない。理由は⑤で説明する)。

## 事前準備

- Cloudflareアカウントは `docs/41_URL取り込み_デプロイ手順.md` の「事前準備」と同じ(`uchirecipe.com` がある
  アカウントをそのまま使う。新規アカウント不要)。
- `private/pro-codes-master.txt`(`app/scripts/generate-pro-codes.mjs` で生成済みのはず)が
  `app/` フォルダと同じ階層の `private/` フォルダにあることを確認しておく。

## ① KVネームスペースを作る(コードの保管庫)

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler login
npx wrangler kv namespace create PRO_CODES
```

`npx wrangler kv namespace create PRO_CODES` を実行すると、こんな出力が出る。

```
🌀 Creating namespace with title "uchirecipe-purchase-fulfill-PRO_CODES"
✨ Success!
Add the following to your configuration file:
[[kv_namespaces]]
binding = "PRO_CODES"
id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

この `id = "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"` の値をコピーする。

## ② wrangler.toml にKVのidを書き込む

`app/workers/purchase-fulfill/wrangler.toml` をテキストエディタで開き、下のほうにある

```
id = "REPLACE_WITH_KV_NAMESPACE_ID"
```

の行を、①でコピーした本物のidに書き換えて保存する。保存したら他の変更と同じように
`git add`・`git commit` してよい(idそのものは秘密情報ではない)。

## ③ Workerをデプロイする

まだStripeの秘密鍵(secret)を設定していない状態でも一旦デプロイできる(secret未設定の間は、
アクセスされても「確認できませんでした」ページを安全に返すだけで、エラーで壊れたりしない設計)。

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler deploy
```

最後に表示される `https://uchirecipe-purchase-fulfill.あなたのサブドメイン.workers.dev` を
コピーしておく(以降の手順で何度も使う。この文書では `<worker-url>` と書く)。

## ④ コードをテスト用に少しだけKVへ入れる(本番の100コードはまだ入れない)

**理由**: もしいきなり本番の100コードをKVに入れてテスト購入すると、テスト購入1回につき
本物のコードが1つ消費されてしまう(お客様に売れるはずのコードが減る)。そのため、まずは
ダミーの2〜3個で配信の仕組みだけを確認し、確認が終わってから本番コードを入れ直す。

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler kv key put pool '["TEST-0001","TEST-0002"]' --namespace-id <①でコピーしたid>
```

(`<①でコピーしたid>` の部分は実際のidに置き換える。以下同様)

## ⑤ テストモードで通し確認する(実際にお金は動かない)

これは `docs/44_購入後コード自動配信_設計.md` に書かれている「未確定・検証事項」を確かめる
いちばん重要なステップ。Stripeの「テストモード」を使えば、本物のクレジットカードなしで
本番と同じ流れを試せる。

### ⑤-1 Stripeを「テストモード」にする

Stripeダッシュボードの右上に「テスト環境」「本番環境」の切り替えスイッチがある(無い場合は
「テストデータを表示」のようなトグル)。これを**テスト側**にする。以降の⑤の作業はすべて
テストモードの画面上で行う(本番の決済リンクやAPIキーには一切触らない)。

### ⑤-2 テスト用の制限付きAPIキーを作る

Stripeダッシュボード → 開発者(Developers) → APIキー(API keys) → 「制限付きキーを作成」
(Create restricted key)。

- 名前: 何でもよい(例: `purchase-fulfill-test`)
- 権限: 「Checkout Sessions」を「読み取り」(Read)のみに絞る(それ以外は「なし」のままでよい)
- 作成すると `sk_test_...` から始まるキーが表示される(**この画面を閉じると二度と表示されないので、
  すぐ次のコマンドでWorkerに登録する**)

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler secret put STRIPE_SECRET_KEY
```

実行すると値の入力を求められるので、コピーした `sk_test_...` を貼り付けてEnter。

### ⑤-3 テスト用のPayment Link(決済リンク)を作る

Stripeダッシュボード(テストモードのまま) → 商品カタログ or 決済リンク → 新規作成。

- 金額: **800円**(本番と同じ。金額が違うとWorkerの「なりすまし防止チェック」に弾かれて
  意図的に確認できるので、まずは本番と同じ800円で作るのが確認として自然)
- 通貨: 円(JPY)
- 「完了後」の設定で「ウェブサイトにリダイレクト」を選び、URLに以下を入力:

```
<worker-url>/success?session_id={CHECKOUT_SESSION_ID}
```

(`{CHECKOUT_SESSION_ID}` はそのまま文字どおり入力する。Stripeが自動で実際のIDに置き換えてくれる)

### ⑤-4 テスト用のWebhookを作る

Stripeダッシュボード(テストモードのまま) → 開発者(Developers) → Webhooks → 「エンドポイントを追加」。

- エンドポイントURL: `<worker-url>/webhook`
- 送信するイベント: `checkout.session.completed` だけを選択
- 作成すると「署名シークレット(Signing secret)」が `whsec_...` の形式で表示される

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

コピーした `whsec_...` を貼り付けてEnter。

### ⑤-5 実際にテスト購入してみる

⑤-3で作ったテスト用Payment Linkを開き、Stripeのテスト用カード番号
`4242 4242 4242 4242`(有効期限は未来の日付なら何でもよい、CVCは任意の3桁)で決済する。

確認すること:

- [ ] 決済後、`<worker-url>/success?session_id=...` に自動で飛び、「ご購入ありがとうございます」画面に
      `TEST-0001` または `TEST-0002` が大きく表示される
- [ ] そのページを再読み込みしても同じコードが表示され続ける(2回目でコードが変わらない=冪等の確認)
- [ ] Stripeダッシュボードの Webhooks の画面で、さきほどのイベントが「200 成功」で届いていることを確認
- [ ] `npx wrangler kv key get pool --namespace-id <①のid>` を実行し、残りが1個(消費された分だけ減っている)ことを確認

うまくいかない場合は下の「よくあるトラブル」を見る。ここで問題が起きた場合、
`docs/44_購入後コード自動配信_設計.md` の「未確定・検証事項」(Managed Paymentsのリダイレクトで
session_idが渡るか等)に関わる可能性があるので、結果をそのまま開発チャットに報告してほしい。

### ⑤-6 テストの後片付け

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler kv key delete pool --namespace-id <①のid>
```

(`session:cs_test_...` のキーも残るが、実害はないのでそのままで問題ない。気になる場合は
`npx wrangler kv key list --namespace-id <①のid>` で一覧を見て `wrangler kv key delete` で消してもよい)

## ⑥ 本番切り替え

### ⑥-1 本番の100コードをKVへ投入する

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app
npx tsx workers/purchase-fulfill/scripts/build-pool-json.mjs
```

`private/pro-codes-pool.json` というファイルができる(まだ「済」が付いていない=未販売のコードだけの
JSON配列。このファイルもリポジトリの外にあるのでコミットの心配はない)。これをKVへ入れる。

```bash
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler kv key put pool --path ../../../private/pro-codes-pool.json --namespace-id <①のid>
```

### ⑥-2 本番用の制限付きAPIキー・Webhookシークレットに差し替える

Stripeダッシュボードを**本番モード**に切り替え、⑤-2・⑤-4と同じ手順で
(a) 本番用の制限付きAPIキー(Checkout Sessions読み取りのみ)、
(b) 本番用のWebhookエンドポイント(URLは同じ `<worker-url>/webhook`、イベントは
`checkout.session.completed`)を作成し、それぞれ

```bash
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
```

で**上書き**する(テストモードの値は本番では使えないので、必ず本番モードの画面で取得した値に
差し替える)。

### ⑥-3 本番のPayment Linkのリダイレクト先を設定する

既存の本番決済リンク(`https://buy.stripe.com/9B69AV8idaXva3wa4KdQQ00`)の「完了後」設定を開き、
⑤-3と同じ形式でリダイレクト先を設定する:

```
<worker-url>/success?session_id={CHECKOUT_SESSION_ID}
```

### ⑥-4 最終確認

- `npx wrangler kv key get pool --namespace-id <①のid>` で100件入っていることを確認
- 可能であれば本番でごく少額の実購入(自分で購入)を1回行い、コードが届くこと・
  `private/pro-codes-master.txt` 上でそのコードに「済」を手動で書き足すことを確認する
  (在庫管理は今までどおりこのファイルへの手動追記が正=KVのpoolはあくまで配信用のコピー)

## 在庫が減ってきたら

現状、コードの追加投入(2回目以降のバッチ生成)の手順は未整備(`generate-pro-codes.mjs` は
実行するたびに100件を丸ごと新規生成し直す作りで、そのまま使うと既存の販売済みコードの整合性に
関わる)。残りが少なくなってきたら追加投入は別途相談すること。

## よくあるトラブル

- **`/success` にリダイレクトされるが「ご購入内容を確認できませんでした」と出る**:
  Payment Linkの金額が800円・円建て・通常の支払い(サブスクではない)になっているか確認する。
  それでも直らない場合はStripe APIキーの権限(Checkout Sessions読み取り)を確認する。
- **「まだお支払いが確認できません」と出続ける**: Managed Paymentsの決済確認に時間がかかっている
  可能性がある。1〜2分待って再読み込みしてみる。改善しない場合は
  `docs/44_購入後コード自動配信_設計.md` の未確定事項に該当する可能性があるため報告する。
- **Webhookが「署名不一致」で失敗する**: `STRIPE_WEBHOOK_SECRET` がテストモード用/本番用を
  取り違えていないか確認する(モードごとに別の値になる)。
- **`wrangler secret put` や `wrangler kv` コマンドが権限エラーになる**: `npx wrangler login` を
  やり直す。複数のCloudflareアカウントがある場合は `npx wrangler whoami` で意図したアカウントか確認する。

## 費用について

Cloudflare Workers・KVともに無料枠(Workersは1日10万リクエスト、KVは1日10万回読み取り・
1000回書き込みまで無料)の範囲に収まる想定規模なので、追加費用は発生しない。
