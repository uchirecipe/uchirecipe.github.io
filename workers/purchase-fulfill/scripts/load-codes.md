# 購入後コード自動配信Worker セットアップ手順(オーナー向け・初心者向け)

「購入後に解錠コードを自動で渡す」機能(うちレシピを買うと、決済完了後の画面にそのままコードが
表示される仕組み)は、Cloudflare Workers 上の小さなプログラム(`app/workers/purchase-fulfill/`)と、
Stripeの設定変更の両方が揃って初めて動く。設計の背景は `../../../docs/44_購入後コード自動配信_設計.md` を参照。

この手順は上から順番にやれば大丈夫。**必ず「①〜④ KVとWorkerの準備」→「⑤ テストモードで通し確認」→
「⑥ 本番切り替え」の順で進める**こと(いきなり本番の100コードを投入しない。理由は⑤で説明する)。
「⑦ メール自動送付の設定」(購入者のメールアドレスにもコードを送る)は独立していて、いつやってもよい。

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
npx wrangler kv key put pool '["TEST-0001","TEST-0002"]' --namespace-id <①でコピーしたid> --remote
```

(`<①でコピーしたid>` の部分は実際のidに置き換える。以下同様)

## ⑤ テストモードで通し確認する(実際にお金は動かない)

> **重要(2026-08-03追記)**: wrangler v4では `kv key` コマンドは**既定で手元の疑似ストア**に読み書きします。本番KVを操作するときは**必ず `--remote` を付ける**こと。付け忘れると「投入したのに本番は空」になります(発売初日に実発生・検収で発見)。本番Workerが見ている在庫数は `curl https://uchirecipe-purchase-fulfill.hapillust.workers.dev/stock` でいつでも確認できます(コード本体は返しません)。

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
- [ ] `npx wrangler kv key get pool --namespace-id <①のid> --remote` を実行し、残りが1個(消費された分だけ減っている)ことを確認

うまくいかない場合は下の「よくあるトラブル」を見る。ここで問題が起きた場合、
`docs/44_購入後コード自動配信_設計.md` の「未確定・検証事項」(Managed Paymentsのリダイレクトで
session_idが渡るか等)に関わる可能性があるので、結果をそのまま開発チャットに報告してほしい。

### ⑤-6 テストの後片付け

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler kv key delete pool --namespace-id <①のid> --remote
```

(`session:cs_test_...` のキーも残るが、実害はないのでそのままで問題ない。気になる場合は
`npx wrangler kv key list --namespace-id <①のid> --remote` で一覧を見て `wrangler kv key delete` で消してもよい)

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
npx wrangler kv key put pool --path ../../../private/pro-codes-pool.json --namespace-id <①のid> --remote
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

- `npx wrangler kv key get pool --namespace-id <①のid> --remote` で100件入っていることを確認
- 可能であれば本番でごく少額の実購入(自分で購入)を1回行い、コードが届くこと・
  `private/pro-codes-master.txt` 上でそのコードに「済」を手動で書き足すことを確認する
  (在庫管理は今までどおりこのファイルへの手動追記が正=KVのpoolはあくまで配信用のコピー)

## ⑦ メール自動送付の設定(Resend)

購入が完了すると、**Stripeに登録された購入者のメールアドレス宛に解錠コードのメールが自動で届く**
ようになる(2026-08-03 追加)。決済後の画面でコードを表示する仕組みはそのまま残るので、
これは「ブラウザを閉じてしまった人にも必ずコードが残る」ための控えの経路。

この⑦は**いつやってもよい**(①〜⑥より後でも先でもよい)。設定していない間はメールが送られないだけで、
決済後の画面表示はこれまでどおり動く。

### ⑦-1 Resendに無料登録する

1. ブラウザで <https://resend.com/> を開き、右上の「Sign Up」から登録する(GitHubアカウントか
   メールアドレスで登録できる。クレジットカードの登録は不要)
2. 登録したメールアドレス宛に確認メールが届くので、中のリンクを開いて有効化する

無料プランで**1日100通・月3,000通**まで送れる。うちレシピの購入数はこの範囲に十分収まるので、
費用は発生しない。

### ⑦-2 ドメイン(uchirecipe.com)を登録してDNSレコードを貼る

「うちレシピから送ったメール」として届くようにするための設定。

1. Resendの左メニュー「Domains」→「Add Domain」を押す
2. ドメイン名の欄に `uchirecipe.com` と入力する(`www` などは付けない)。リージョンは初期値のままでよい
3. 「Add」を押すと、**貼り付けるDNSレコードの一覧(3件ほど)**が表になって表示される。この画面は
   開いたままにしておく

次に、Cloudflare側にこの表の内容を写す。

4. 別のタブで <https://dash.cloudflare.com/> を開く → `uchirecipe.com` をクリック →
   左メニューの「DNS」→「レコード」
5. Resendの表の**1行につき1回**、Cloudflareで「レコードを追加」を押して次のように入れる
   - **種類(Type)**: Resendの表の「Type」と同じもの(`MX` か `TXT`)を選ぶ
   - **名前(Name)**: Resendの表の「Name」をそのままコピーして貼る(`send` や `resend._domainkey`
     のような短い文字列。Cloudflareが自動で `send.uchirecipe.com` の形にしてくれるので、
     `.uchirecipe.com` を自分で足さない)
   - **内容(Content / 値)**: Resendの表の「Value」をそのままコピーして貼る
     (前後に引用符 `"` を自分で足さない)
   - **優先度(Priority)**: `MX` の行にだけ入力欄が出る。Resendの表の数字(`10` など)を入れる
   - 「保存」を押す
6. すべての行を入れ終わったらResendの画面に戻り、「Verify DNS Records」を押す

各行の状態が **Verified(緑)** になれば完了。すぐに緑にならないときは数分待ってからもう一度
「Verify DNS Records」を押す(DNSの反映待ちで、長いと30分ほどかかることがある)。

> Cloudflareの「プロキシ状態(オレンジの雲)」はMX・TXTレコードには出てこないので、気にしなくてよい。
> 既にあるレコード(サイト表示用のAレコード等)は消さずそのまま残すこと。

### ⑦-3 APIキーを作ってWorkerに登録する

1. Resendの左メニュー「API Keys」→「Create API Key」
2. 名前: 何でもよい(例: `uchirecipe-purchase-fulfill`)
3. Permission(権限): **「Sending access」(送信のみ)** を選ぶ
4. Domain: `uchirecipe.com` を選ぶ
5. 「Add」を押すと `re_` から始まるキーが表示される(**この画面を閉じると二度と表示されないので、
   すぐ次のコマンドで登録する**)

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler secret put RESEND_API_KEY
```

値の入力を求められるので、コピーした `re_...` を貼り付けてEnter。

**secretは常に本番のWorkerに設定される**(Stripeのようなテスト/本番の切り替えはない)。つまり
このキーを登録した時点から、テストモードの購入でも**入力したメールアドレスに本物のメールが届く**。
テスト購入するときは自分のメールアドレスを使うこと。

6. 最後にWorkerを配り直す(メール送付の機能を含んだ最新のコードを本番に反映する)

```bash
npx wrangler deploy
```

### ⑦-4 届いているか確認する

- **Resendの左メニュー「Emails」**に送信履歴が出る(宛先・件名・開封状況)
- **Stripeダッシュボード → 開発者 → Webhooks** で該当イベントを開くと、うちレシピ側が返した
  レスポンスに `"email":"sent"` と入っている
- 実際に届いたメールの件名は「うちレシピ Pro版 解錠コード」

うまくいかないときは、Stripeのwebhook画面に出るレスポンスの `email` の値を見ると原因が分かる。

| 表示 | 意味 | 対処 |
| --- | --- | --- |
| `sent` | 送信できた | 迷惑メールフォルダも確認する |
| `skipped_not_configured` | APIキーが未登録 | ⑦-3をやり直す(登録後に `npx wrangler deploy` も必要) |
| `skipped_no_customer_email` | Stripeから購入者のメールアドレスが渡っていない | 決済リンクの設定でメールアドレスの入力が必須になっているか確認する |
| `skipped_already_emailed` | 同じ購入に対して送信済み(二重送信の防止が働いた) | 正常。対処不要 |
| `send_failed` | Resendが受け付けなかった | ⑦-2のドメインがVerified(緑)か、APIキーが正しいかを確認する |

在庫切れのときはメールを送らない(送るコードが無いため)。この場合は決済後の画面に
「コードの準備中です」と出て、レスポンスに `"alert":"out-of-stock"` が入る。**在庫を足したうえで、
購入者のメールアドレス宛に手動でコードを送ること**(画面ではそう案内している)。

## 在庫が減ってきたら(2回目以降のコード追加)

在庫は `curl https://uchirecipe-purchase-fulfill.hapillust.workers.dev/stock` でいつでも見られる。
**残りが20件を切ったら**この手順で足す(在庫0で購入されると、決済後の画面が「コードの準備中です」に
なり、手作業でのお詫び対応が必要になる)。

> **`scripts/generate-pro-codes.mjs` を補充に使ってはいけない。**
> あれは初回の100件を作るスクリプトで、実行するたびに台帳とハッシュ一覧を**丸ごと作り直す**。
> 補充に使うと、それまでに販売したコードのハッシュが `src/logic/proCodes.ts` から消え、
> **購入済みのお客様のコードが解錠に使えなくなる**。補充は下の `add-pro-codes.mjs` を使う。

### 手順の全体像(この順番を守る)

1. コードを追加で発行する(台帳に追記・ハッシュ一覧を作り直す)
2. **アプリを本番(main)へ出す** ← 先にこれ
3. そのあとで KVのプールに追加分を足す

**2と3を逆にしない。** アプリより先にKVへ入れると、アプリがまだ知らないコードがお客様に渡り、
入力しても「コードが正しくありません」となる。逆の順(2→3)なら、KVに入るまで在庫が増えないだけで
実害は出ない。

### ① コードを追加で発行する

まず何が起きるかだけ見る(ファイルは書き換わらない)。

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app
npx tsx scripts/add-pro-codes.mjs --count=100 --dry-run
```

「既存◯件・今回◯件・合計◯件(既存の◯件はすべて残る)」が出る。数が想定どおりなら本番実行する。

```bash
npx tsx scripts/add-pro-codes.mjs --count=100
```

書き換わるのは次の3つ。

| ファイル | 何が起きるか | コミット |
| --- | --- | --- |
| `private/pro-codes-master.txt` | 末尾に「追加バッチ ◯◯◯◯-◯◯-◯◯」の節が足される(既存行は1行も消えない) | **絶対にしない** |
| `src/logic/proCodes.ts` | 台帳の全コード + 今回ぶんのハッシュに作り直される | **する**(②で使う) |
| `private/pro-codes-add-<日付>.json` | 今回足したぶんだけのJSON配列 | **絶対にしない** |

このスクリプトは、いま `proCodes.ts` に載っているハッシュが1つでも欠ける計算になったら
**書き込む前に中止する**(台帳から行が消えていた等の事故を止めるため)。中止が出たら、
原本 `private/pro-codes-master.txt` から行が消えていないか確認する。

### ② アプリを本番へ出す(先にこちら)

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app
npx tsc -b && npm run build && npm test
git add src/logic/proCodes.ts
git commit -m "Pro解錠コードを100件追加"
git push origin dev
```

そのうえで `dev` を `main` にマージして `main` を push する(このpushが本番デプロイ)。
デプロイが終わってから③へ進む。

> `git status` に `private/` の中身が出てこないことを確認する(`private/` は `app/` の外なので
> 通常は出てこない)。もし出てきたら**コミットせずに開発チャットへ報告**すること。

### ③ KVのプールに追加分を足す

**いま入っているプールを消して入れ直すのではなく、後ろに足す。**
台帳の「済」は手で書き足す運用なので、売れたのに印を付け忘れているコードがある場合、
台帳から作り直すと**すでに渡したコードがプールに戻り、別の人にも同じコードが配られる**。

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill

# ③-1 いま本番KVに入っているプールを手元に取り出す(--remote 必須)
npx wrangler kv key get pool --namespace-id <①でコピーしたid> --remote > ../../../private/pool-now.json

# ③-2 いまのプール + 追加分 を1つのファイルにまとめる(重複と「済」の混入を検査する)
cd ~/Documents/Claude/Projects/料理アプリ/app
npx tsx workers/purchase-fulfill/scripts/merge-pool-json.mjs \
  ../private/pool-now.json ../private/pro-codes-add-<日付>.json

# ③-3 まとめたファイルを本番KVへ書き戻す(--remote 必須)
cd ~/Documents/Claude/Projects/料理アプリ/app/workers/purchase-fulfill
npx wrangler kv key put pool --path ../../../private/pro-codes-pool.json --namespace-id <①のid> --remote
```

`<日付>` は①で作られたファイル名(`pro-codes-add-2026-08-09.json` のような形)に置き換える。

> **`--remote` を忘れない。** wrangler v4 の `kv key` は既定で**手元の疑似ストア**を読み書きする。
> 付け忘れると「入れたのに本番は空のまま」になる(発売初日に実発生)。

### ④ 足せたことを確かめる

```bash
curl https://uchirecipe-purchase-fulfill.hapillust.workers.dev/stock
```

表示された在庫が「もとの残り + 今回足した件数」になっていれば完了。
念のため、追加したコードのうち1つを自分の端末の設定画面に入れて解錠できるかも見ておく
(解錠できなければ②のデプロイがまだ反映されていない。数分待ってから再読み込みする)。
確認に使ったコードは台帳のその行に「テスト」と書き足し、KVのプールからも外しておく。

### 補充のときに使わないもの

`workers/purchase-fulfill/scripts/build-pool-json.mjs` は**初回投入(⑥-1)専用**。
台帳の未販売行からプールを作り直すため、補充で使うと上に書いた「渡したコードが戻る」事故になる。
補充では `merge-pool-json.mjs` を使う。

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
