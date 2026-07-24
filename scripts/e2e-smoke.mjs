// L2: 恒久E2Eスモーク(docs/10 5章の回帰スモークセットのうち、自動化可能な中核部分)。
// 使い捨てスクリプトを毎回書き直す運用をやめ、この1本を育てる(PDCAの蓄積点)。
// 実行: 開発サーバー(npm run dev)またはpreviewを起動した状態で
//   npx tsx scripts/e2e-smoke.mjs             (既定: http://localhost:5173)
//   BASE_URL=http://localhost:4173 npx tsx scripts/e2e-smoke.mjs   (preview等)
// カバー: SMK-01(起動) / COUNT-01(一覧上部の総件数「全◯件」が絞り込み無しでも常に表示され、
//         絞り込み中は「◯件 / 全◯件」の形になる。2026-07-13 UI改善) /
//         QF-01(「時短レシピのみに絞る」絞り込みで件数が変わる。チップ文言は2026-07-13と
//         2026-07-16便T-5で変更) /
//         PANTRYFILTER-01(一覧の絞り込み「在庫の食材で絞る」チップ・2026-07-24 便BN・司令部追加:
//         在庫が空のうちは出ず、在庫を1品「ある」にすると出て、ONで在庫の食材を使うレシピだけに件数が絞られる) /
//         LAYOUT-01(一覧のグリッド/リスト表示切替。settingsに保存されリロード後も維持される。
//         2026-07-13 UI改善。同日オーナー実機フィードバックでリスト行にも主要食材チップ・
//         由来バッジ・タイトル2行折り返しを追加し、グリッドと同等の情報量になったことを確認。
//         切替ボタンは2026-07-16便T-2で件数表記の横の常設列へ移動) /
//         SORTDIR-01(並べ替えの昇順/降順トグル。「五十音順」既定は昇順、「降順」で並びが
//         ちょうど反転する。2026-07-13 UI改善。並び替えは2026-07-16便T-1で専用ボタン・
//         専用パネルに分離) /
//         SMK-02+03(登録・削除) /
//         SMK-04(貼り付け整形) / SMK-05(人数変更・帯分数表示) / SMK-08簡易(調理中モード) /
//         KW-01(検索キーワード欄。保存→検索でヒットし、一覧・詳細には表示されないこと) /
//         INTRO-01(ひとこと説明・任意。2026-07-13。料理名だけでは中身が想像しにくい料理向けの
//         短い説明文。フォームで入力→保存→詳細の料理名見出しの直後に表示されること) /
//         ONEPOINT-01(メモ2区画化・2026-07オーナー承認済み設計: 「ワンポイント」(こつ・知識)と
//         「メモ」(保存方法・注意書き・安全)を別々に入力→保存→詳細で①ワンポイント→②メモの順に
//         見出し付きで表示されること・編集画面を開き直しても両方の入力が保持されること) /
//         SMK-14(テーマ全廃2026-07-23: 初回シードで全103品が「平らな基本レシピ」で入る・旧テーマ由来の
//         代表品が同梱される・設定にテーマUIが一切存在しない・旧?set=付きURLは無害に設定へ着地する。
//         旧「?set=テーマ取り込み」検証はテーマ廃止に伴い「全品同梱・テーマUI不存在」の検証へ置き換え) /
//         SETTINGS-TAB-01(設定画面の1本スクロール化2026-07-17オーナー採用決定。旧: 上部タブ4分割。
//         全般/レシピ/バックアップ/Proの4節が1画面に同時に存在・上部の目次チップのタップで該当節へ
//         スクロール・?set=/?section=直リンクが該当節へ自動スクロール。「基本」→「全般」は2026-07-13 UIペルソナQA) /
//         TOAST-01(設定操作結果メッセージのトースト化。数秒で自動的に消えること。
//         自動非表示は2026-07-13 UIペルソナQAで4.5秒→6秒に延長) /
//         STARTER-RELOAD-01(「基本レシピを入れ直す」でユーザーデータ(お気に入り)が保持されること。
//         2026-07-13 削除→再追加からユーザーデータ保持方式への改修) /
//         UNLOCK-01(購入と解錠。2026-07-22全無料化でPro(UR-)のみ受け付ける: UR-以外/廃止したUP-は
//         コード形式エラー・UR-でPro解錠・解錠済みコードのマスク表示+コピー・Pro解錠済みなら入力欄が
//         消えPro機能一覧が常設される) /
//         RECIPESET-01(汎用の「レシピセットを読み込む」欄=バックアップ形式の追加読み込み。テーマ全廃
//         2026-07-23後も配布互換として存続。修正4・2026-07-14: 結果を読み込み欄の上部にテキストで表示し
//         下部トーストとしては二重に出ないこと。エラー(URLが見つからない)・成功(ファイル読み込み)の両方を
//         確認。取り込んだ品は「基本レシピ」バッジで表示され旧テーマ名(setName)は出ないことも確認) /
//         SMK-19(静的ページがアプリ本体にすり替わらない。SWが動くpreviewでの実行時に実質検証) /
//         SCROLL-01(一覧のスクロール位置復元。iPhone SE実機フィードバック 2026-07-11。
//         webkit+375x667ビューポートで検証。60秒滞在バリエーション込み。他のチェックはchromiumのまま) /
//         SCROLL-02(一覧の絞り込み・並べ替え条件が詳細→戻るを経ても保持される。
//         2026-07-12深夜フィードバック再調査で判明した本当の原因の再発防止。PC Chrome相当) /
//         TIMER-ADJ-01(実行中タイマーの±調整窓。タップで開き「+1分」「−30秒」で残り秒が変わる。
//         常駐バー行の「+1分」ミニボタン単体での即+60秒も確認。2026-07-13 UIペルソナQA) /
//         TIMER-CUSTOM-01(じぶんタイマー。入口Aから起動し、0未満にならない floor 挙動も確認。
//         2026-07-12秒刻み対応で±30秒・±10秒の分+秒表示・10秒未満にならない floor も確認) /
//         LOG-PHOTO-01(「作った！」記録への写真添付。選択→プレビュー→保存→一覧サムネイル→
//         原寸表示窓、圧縮後Blobと自動記録された表示人数をIndexedDBから直接検証。2026-07-12) /
//         LOG-EDIT-PHOTO-01(2026-07-16 便W-①: 既存記録の編集フローからも画像の削除・追加
//         (差し替え)ができること。削除→保存→サムネ消滅、再編集で追加→保存→サムネ再出現・
//         圧縮後Blobが新規作成時と同じ形式でIndexedDBに保存されることを確認) /
//         NUT-01(栄養価のめやす: 未解錠でもエネルギー・塩分の概算が閉じた1行から見え、
//         展開すると「めやす」表記・出典・Pro案内リンクが出る) /
//         NUT-02(栄養価のめやす: Pro解錠済みで8項目の実パネルが出る(2026-07-13 第2弾で
//         食物繊維・鉄・カルシウム+ビタミン注記を追加)・人数を変えても1人分の値は不変。
//         M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED有効化) /
//         STEP0-01(手順0件のレシピ・2026-07バグ修正: 手順欄を空のまま保存(steps:[])しても、
//         詳細画面に「調理中モードで見る」ボタンが表示されない=空配列で調理中モードを開いて
//         クラッシュすることがないこと) /
//         NUTSORT-01(栄養並び替えの無料ティーザー・2026-07-16便T-4で5項目まとめてPro機能化:
//         無料では栄養価の選択肢が出ず、グレーの「栄養価で並び替え（Pro機能）」行だけが出て
//         タップ先が既存のPro案内であること) /
//         NUTSORT-02(栄養並び替え・Pro解錠済み: カロリー/たんぱく質/塩分/脂質/糖質の5項目が出る・
//         カロリー既定は昇順・たんぱく質既定は降順・算出不能レシピは昇順/降順とも末尾・
//         栄養価順の間はカードに並び替え中の値が出る=便T-7。2026-07-16便T-7-2で
//         「カロリー: ◯kcal」「たんぱく質: ◯g」のラベル付き表記に変更) /
//         TOPUP-01(既存ユーザーへの差分投入・テーマ全廃2026-07-23: アップデート前状態を再現し、
//         起動時に不足分だけ1回投入される・トゥームストーンのある削除済みの品は復活させない・
//         二重投入しない(101→102)・1回だけ実行される、をIndexedDB直読みで確認。旧TOMB-01のテーマ
//         トゥームストーン検証はテーマUI撤去に伴い差分投入側で尊重する形へ置き換え) /
//         ORPHAN-01(レシピ削除の孤児防止・2026-07バグ修正・deleteRecipe: 基本レシピを週間献立・
//         今日の献立の両方に登録した状態で1品削除しても、両テーブルに削除済みレシピを指す孤児行が
//         残らないことをIndexedDB直読みで確認。旧「テーマ一括削除」はテーマUI撤去で1品削除経路へ置換) /
//         DASH-01(だし紐づけ・2026-07-23: 材料「だし汁」の行から収録レシピ「だしのとり方」の詳細へ
//         飛べるリンクが出てタップで遷移する・収録レシピを削除するとリンクは出ない) /
//         TODAYALL-01(「全て作った！」の一括反映・2026-07バグ修正: 記録追加(addCookedLog)と
//         今日の献立クリアを1トランザクションにまとめた後も、正常系で両方が揃って反映される
//         ことを確認。トランザクション途中断の再現は黒箱E2Eでは不可のため対象外) /
//         FOCUS-MEMO-01(調理中モードの▽折りたたみメモが詳細画面と同じ小窓タップで開閉し、
//         「｜」改行・「・」箇条書きも小窓内で効くこと。2026-07-12 Fable裁定) /
//         PRICE-01(食材価格マスタ。材料に価格未入力のレシピでもマスタ目安価格が詳細の
//         概算食費に反映され、マスタ編集に追従すること。2026-07-13
//         オーナー実機フィードバックで詳細画面の概算食費欄の「一部は目安価格から計算しています」
//         注記を削除、同日中に週の献立側も削除(mixedNote定義自体を撤去)したため、
//         その不在をMEALPLAN-01側でも確認する。2026-07-14修正3a/3bで、材料行ごとの
//         目安価格の注記(「（目安◯円）」)は表示しないこと・概算食費に「1食あたり」も
//         追加表示されること(既定人数2人で50÷2=25円等)を確認) /
//         INLINE-01(「食材と価格」一覧の行内編集。2026-07-12 UX改修で編集モーダルを廃止し、
//         価格欄への直接入力+Enter/blurで即保存。2026-07-13 UI改善で「目安」/「自分の価格」
//         バッジは廃止したため「デフォルトに戻す」ボタンの出現/消失で編集反映を確認・
//         検索絞り込みを確認。2026-07-14修正2a/2b/2cで、手入力で既定値に戻すと
//         「デフォルトに戻す」ボタンが消えること・正規化(前後空白/括弧除去)して同名の
//         食材は追加を拒否すること・追加入力欄が一覧より上に表示されることを確認) /
//         合わせ調味料ライン表示 /
//         PRO-FALLBACK-01(crypto.subtleが使えないinsecure context(LAN実機のhttp://等)でも、
//         純JSのSHA-256フォールバック(src/logic/sha256.ts)でPro解錠コード検証が動くこと。
//         2026-07-13。他チェックが使う既存サーバーとは別に自前でpreviewサーバーをport 4194で
//         起動して検証する) /
//         MEALPLAN-01(献立タブ・週プランナー。第4波ペルソナPDCA・2026-07-13裁定。2026-07-16
//         便U-1で献立タブは日/週/月の3タブ構成になり、既定は「日」タブ・週の検証は「週」タブへ
//         切り替えてから行う:
//         週移動の中央チップが「今週へ戻る」ボタンとして機能しaria-labelが状態に応じて出し分けられる
//         こと(Fix1)・概算食費セクションは未割当時は非表示で割当後に表示されること(Fix3)・
//         ピッカー再オープンで現在レシピに「選択中」バッジが出ること(Fix4)・フィルタ/トグル/
//         日週月タブのaria-pressed(Fix5。2026-07-13更新: 新規ユーザーは既定で夕食のみ
//         aria-pressed=true)・最後の食事帯フィルタを外そうとしたときの説明トースト(Fix6。
//         同日更新: 既定が夕食のみになったため夕食を外そうとするパターンで検証)・
//         「この帯の今週分を空にする」の帯選択+confirm+一括削除(便U-4)) /
//         MEALPLAN-02(献立タブ・月カレンダー。同波Fix2: 月移動の中央チップの「今月へ戻る」導線。
//         Pro解錠コード入力UI経由で解錠してから検証。2026-07-16便U-5: 日タップは即週ジャンプせず
//         その日の献立モーダル(朝昼夕・レシピ名リンク・「この週を開く」・献立なし文言)を出す) /
//         MEALPLAN-03(献立タブ・主菜+副菜構成。2026-07-13 Fable設計: 各枠が既定で主菜+副菜の
//         2行になっていること・「＋枠を追加」で行を増やせること・行単位のサイコロは他の行に
//         影響しないこと・枠が丸ごと空のときのサイコロ/まとめて献立を立てるは主菜+副菜のペアで
//         埋まること・まとめて献立を立てるのアイコンがDicesであること) /
//         MEALPLAN-04(修正1b・2026-07-14オーナー実機フィードバック: 「まとめて献立を立てる」は
//         以前は空き枠だけ埋めるため2回目以降のタップが無反応だった。押すたびに表示中の全枠
//         (手動選択枠も含む)を一旦クリアしてから再抽選することを、mealPlansの行idが
//         クリア→再作成で入れ替わることで確認する) /
//         MEALPLAN-05(日タブの週プラン自動取り込み・便U-3・2026-07-16 Fable設計: 日タブを開くと
//         今日の週プラン登録(表示帯のみ)が今日の献立へ自動で入ること・非表示帯は取り込まれない
//         こと・2回開いても重複しないこと(冪等)・取り込まれた品を消して開き直しても同じ日の
//         うちは再出現しないこと(settings.lastAutoImportDate)をIndexedDB直読みで確認) /
//         MEALPLAN-06(ランダム週献立の過去日保護・2026-07-16 便W-⑤a・オーナー指示2026-07-16夜:
//         「前の週」=全日程が過去日の週で、サイコロボタンが1つも出ないこと・「まとめて献立を
//         立てる」を押しても一切埋まらないこと(未定14件が不変)を確認。MEALPLAN-03/04は実行日の
//         曜日次第で当週の月曜が過去日になり得るため「次の週」へ進めてから検証するよう追随済み) /
//         修正1a(献立タブの概算食費リンクの文言「食材と価格を編集する」・遷移先/pricesを
//         MEALPLAN-01内で確認) /
//         PRICEUNIT-01(「食材と価格」の単位入力UI改修・2026-07-15オーナー実機フィードバック:
//         単位欄が自由入力(「100g」等を数字ごと1欄に書く)だと不安・使いにくいため、
//         新規追加・行内編集の両方で「数量(数字)＋単位(選択)」に分離。保存形式は従来どおり
//         1つの文字列に合成(数量「2」+単位「個」→「2個」)されIndexedDBの実データで確認。
//         既存デフォルト行(玉ねぎ)の数量を変えると「デフォルトに戻す」が出現し、
//         押すと数量・単位・「デフォルトに戻す」の表示が投入時の状態に戻ることも確認) /
//         BACKUP-01(バックアップの全ユーザーデータ対応・2026-07-13データ堅牢性強化: 価格編集+
//         週献立割当+在庫品を実際の「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで
//         捕捉)で書き出し→まっさらな別プロファイルへ「読み込む(置き換え)」で復元し、
//         価格・週献立・在庫が実際に引き継がれることを確認。加えて、これらの項目が無い
//         旧形式のbackup JSONを、既に価格・在庫データのあるプロファイルへ読み込んでも
//         エラーにならず既存の価格・在庫データが消えない(後方互換)ことも確認する。2026-07-17
//         バックアップ改修 修正1でPro解錠コードの往復(CODEBACKUP-01)も同じ書き出し元/復元先で
//         追加確認: 書き出しJSONにsettings.proCodeが含まれる・まっさらな未購入プロファイルへの
//         置き換え復元だけでPro解錠状態が戻る(IndexedDB直読み+Proタブの表示の両方で確認)) /
//         CODEMERGE-01(2026-07-17バックアップ改修 修正1: merge(「読み込む(今のデータに追加)」)でも
//         Pro解錠コードが戻ることを実UI経由で確認。(a)未購入プロファイル+コード入りバックアップを
//         mergeで解錠される (b)Pro解錠済みプロファイル+コード無し旧形式バックアップをmergeしても
//         解錠状態が消えない=mergeUnlockCodesの「バックアップに無ければ既存を保持」の実固定) /
//         FILESAVE-01(2026-07-17バックアップ改修 修正2+3: 保存先選択+前回の場所に上書き。
//         File System Access API(showSaveFilePicker)はheadless chromiumに実装が無いことを実測
//         確認済みのため、addInitScriptで注入して「対応ブラウザ」を模す。(a)保存先の記録が無い間は
//         「前回の場所に上書き」ボタンが出ず、IndexedDBのfileHandlesテーブルに記録すると
//         再訪問で出る(表示分岐の実コードを固定) (b)ピッカーのキャンセル(AbortError)・
//         上書き失敗時のピッカーへのフォールバックのどちらもエラー表示が出ない。
//         自作の偽handleは関数を含むとDataCloneErrorになりIndexedDBに保存できないため、
//         実際のJSON書き込み内容の往復まではここでは検証できない(scripts/test-logic.mjsの
//         単体テストとコードレビューで別途担保。報告に明記) /
//         BACKUPCARDS-01(2026-07-17バックアップ改修 修正5: バックアップタブを3カード
//         (①バックアップを取る/②バックアップから戻す/③困ったとき)に再構成。②で「追加」
//         「置き換え」ボタンが並んで見えること・①に購入コード注意文があることを確認) /
//         PRICEVIEW-01(レシピ詳細の材料「原価ビュー」トグル。2026-07-15新設・2026-07-16裁定1で
//         全面改修・2026-07-20 便AJ(docs/45)で再改修。既定は非表示で材料行に金額表示は無く、
//         見出し行の「原価を見る」チップを押すと各材料行の使用量表示が1食あたりの按分原価
//         (「約◯円」。登録人数固定・非インタラクティブ)に差し替わり、原価サマリーカードは
//         便AJで廃止済み(上部メタ行の概算食費と重複していたため)。「原価を編集」チップを押すと
//         (原価を見るとは排他)使用量表示が「{価格}円/{単位}」の編集チップ(マスタ不一致は
//         「価格なし＋登録」)に差し替わることを確認。チップタップ→編集モーダルで価格変更→保存
//         すると、その行のチップ・上部メタの概算食費・原価を見るモードの按分原価が同時に更新
//         されることも確認する(価格なし→「＋登録」→登録モーダル→保存でチップ化する経路も確認)。
//         選択中のチップをもう一度押すと非表示に戻ることを確認) /
//         FORMTABS-01(レシピ編集フォームの「かんたん/くわしく」タブ分け・2026-07-16 Fable裁定
//         docs/26・案A承認。(a)新規登録の初期表示は常に「かんたん」タブで、かんたんタブの入力
//         だけで保存が成功する (b)「くわしく」タブ側フィールドに入力があると見出し右に●が出て
//         空のうちは出ない(aria-label「入力済みの項目があります」で判定) (c)「くわしく」タブ
//         表示中に料理名未入力のまま保存すると、エラー表示とともに「かんたん」タブへ自動的に
//         戻る (d)両タブのDOMを常時マウントしhidden属性で切り替えるだけの実装のため、タブを
//         往復してもくわしくタブの入力内容が消えない(state維持)ことを確認。既存のKW-01/
//         INTRO-01/ONEPOINT-01/DISHTYPE-01もタブ分けで対象フィールドが「くわしく」タブの中に
//         入ったため、タブ切替の1手を追加済み) /
//         ICONPICK-01(「画像」3択UI・2026-07-16 Fable裁定docs/30 裁定2【画像の3択】。
//         [カメラで撮る][アルバムから選ぶ][アイコンから選ぶ▾]の3等分タイル。「アイコンから選ぶ」
//         クリックでaria-expandedが切り替わりアイコングリッド(自動+15種)が展開すること・
//         写真を設定→アイコンを選択すると自動でshowIconInsteadOfPhotoがONになりプレビューが
//         写真からアイコン表示に切り替わること・保存して詳細画面へ渡ってもアイコン表示のまま
//         (showIconInsteadOfPhotoが実際にDBへ連動)であることを確認) /
//         FORMRESET-01(レシピ編集画面の「デフォルトに戻す」・2026-07-15 オーナー要望。DBには
//         書き込まずフォームの入力値だけを差し替える安全設計。(a)基本レシピ「肉じゃが」の編集で
//         タイトル・材料を書き換え→ボタンは1回目「もう一度押すと戻します」に変化するだけで
//         まだ戻らない→2回目でstarterDefsの原本(タイトル・材料とも)に戻ること・保存前の
//         軽いフィードバック文言が出ること→保存せず一覧へ離脱しても実データ(DB)が
//         書き換わっていないこと(b)自作レシピを新規登録→編集でタイトルを変更→
//         「前回保存した内容に戻す」(自作は文言がスターターと異なる)で保存済みタイトルに
//         戻ることを確認) /
//         SLOTWIN-01(「今日の献立に追加」のスロット振り分け窓・2026-07-17 便Z-1・docs/35 §2:
//         ボタン押下で「どの食事に入れますか？」の窓が開き、「夕食」を選ぶと週プランの今日の
//         夕食枠(mealPlans・IndexedDB直読み)と今日の献立(todayList)の両方に入ること・日タブ/
//         週タブに反映されること・同じ枠に同じレシピが既にあるときは重複させずトーストで
//         案内されること(件数不変)・「決めない」は従来どおりtodayListへの直接追加のみで
//         週プランには入らないことを確認。既存のORPHAN-01/TODAYALL-01も窓経由になったため
//         「決めない」を選ぶ1手を追加済み) /
//         PASTLOG-01(週/月の過去振り返り・2026-07-17 便Z-2・docs/35 §3: 昨日の日付で
//         「作った！」記録を付け、週タブの昨日の枠に「作った記録」の薄いカード(レシピ名+✓)が
//         出ること・月タブ(Pro解錠)のカレンダー日に「記録あり」小マークが出ること・その日を
//         タップした日モーダルに作った記録が表示されることを確認。月間献立への機能追加は
//         Pro v2まで凍結が既定だったが、オーナー指示で解除して実装した分) /
//         SHARE-01(シェアの選択式モーダル・2026-07-16 Fable裁定docs/30 裁定3【シェアの選択式】。
//         詳細下部のシェアボタンで旧インライン2ボタンパネルではなく選択モーダルが開き、
//         固定項目の説明文言・「※画像カードのみ」併記・既定値(画像ON/調理時間ON/原価OFF/
//         栄養OFF/材料全部OFF)を確認。navigator.share非対応のchromiumでは「テキストでシェア」が
//         クリップボードへのコピーになるため、コピーされた文字列を直接検証する:
//         (a)既定選択で料理名・人数分(別行)・調理時間行・材料8件+…ほか・作り方(【作り方】)・
//            #うちレシピ・URLが入り、「作り方は全◯ステップ」行(裁定3で削除)・原価・栄養が入らないこと
//         (b)「材料をすべて載せる」+「原価」ONで、9件目の材料が入り…ほかが消え、
//            原価行(1人分/全量・登録人数基準)が入ること
//         (c)「画像カードでシェア」は非対応環境でPNGダウンロードに切り替わるため、
//            downloadイベントの発生=画像カード生成の成功のみ確認する
//         (d)往復(2026-07-23 便BJ・docs/55 CEO提案2-1): (b)の全文を新規レシピに貼り付け、自動振り分けで
//            材料・手順が過不足なく復元され料理名も戻ること=端末間で丸ごと取り込める形式であること)。
//         FOCUS-HINT-01(調理中モードの初回発見性・2026-07-23 便BJ・docs/55 CEO提案1-5: レシピ詳細を
//         初めて開いたときだけ「作りながら見るならこれ」の控えめなヒントが1回だけ出て、2品目以降は
//         出ないこと=cookModeHintSeenフラグで再表示しない) /
//         PANTRY-BULK-01(在庫チップ「まとめて状態設定」・2026-07-17 docs/35 §5 オーナー決定・
//         案D: 整理モード中に選択したチップへ「ある」「少ない」「ない」の3ボタンで一括状態変更
//         できること。0件選択時は3ボタンともdisabled・3件選択→「ない」適用で実際にIndexedDBの
//         levelが変わること(事前に「ある」へ変えてから検証し、既定値のnoneのままでは書き込みを
//         証明できない問題を回避)・適用後にトーストが出て選択が解除されるが整理モード自体は
//         維持されること(削除とは挙動が異なる意図的な仕様)。合わせて既存の整理モード一括削除も
//         同じセッションで検証し、まとめて状態設定の追加で退行していないことを確認する) /
//         MEALPLAN-07(献立タブ・月タブ「期間の食費」・2026-07-17 便AB・オーナー決定・docs/35 §5:
//         モードボタンで開始日→終了日の2タップ選択→範囲ハイライト+結果カード(期間の献立原価
//         合計・1日あたり平均・日数)が出ること。モード中は日タップが範囲選択に使われ既存の
//         日モーダル(便U-5)が出ないこと・モード解除で日モーダルが復活すること・終了日<開始日の
//         順にタップしても自動で入れ替わり結果が変わらないこと。原価は既存の週集計と同方式
//         (登録人数基準)のため、期間合計が肉じゃが単品の概算食費の2倍と一致することで検証する) /
//         MEALPLAN-08(手動配置の保護・2026-07-22 便BE・外部レビュー欠陥修正: 週の枠に手動で
//         レシピを入れた後「まとめて献立を立てる」を押しても、手動配置の行が上書き削除されず
//         同じid・同じレシピのまま残ること(旧実装は無警告で全消し)。空き枠は埋まり、手動枠を
//         残した旨のトーストが出ること。2回押しても手動枠は保護され続けることを確認する) /
//         (THEMESORT-01は「基本レシピ順」並び替えの廃止・2026-07-24 便BNに伴い削除) /
//         ZENKAKU-01(全角入力の自動正規化・2026-07-21 オーナー実機報告:「アサリ 300ｇ」の
//         全角ｇだと栄養計算に反映されない・数量も全角で入力できてしまう。材料の分量欄に全角数字
//         「３００」・単位欄に全角「ｇ」を入力→blurで自動的に半角「300」「g」に置き換わること、
//         保存後の栄養計算にも反映され「計算対象外」にならないことを確認する) /
//         console/pageerrorは全工程で監視(既知のCF計測CORSは除外)
import { chromium, webkit } from 'playwright'
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const appRoot = path.join(__dirname, '..')

const BASE = process.env.BASE_URL ?? 'http://localhost:5173'

// 事故防止ガード(2026-07-21): 環境変数名の誤り(E2E_BASE_URL等)でBASE_URL未指定のまま
// デフォルトの5173(オーナーの開発サーバー・不可侵)へ向けて走る事故が実際に起きた。
// 5173はvite devのためSW無し・/about/等のディレクトリURLがSPAシェルにフォールバックし、
// SMK-19が偽陽性で落ちる(previewのdistと挙動が違う)。previewポートを明示しない実行は
// 原則ミスなので、明示的な許可(ALLOW_DEV_SERVER=1)がない限り中断する。
console.log(`e2e対象: ${BASE}`)
if (/:5173(\/|$)/.test(BASE) && process.env.ALLOW_DEV_SERVER !== '1') {
  console.error(
    'BASE_URLが未指定またはポート5173(オーナーのdevサーバー)を指しています。' +
      'preview(例: BASE_URL=http://localhost:4173)を指定してください。' +
      '意図的にdevサーバーへ実行する場合のみ ALLOW_DEV_SERVER=1 を付けてください。',
  )
  process.exit(1)
}

const errors = []
const results = []
let currentCheck = ''
const ok = (label) => results.push({ label, pass: true })
const ng = (label, detail) => results.push({ label, pass: false, detail })
const check = (label, cond, detail = '') => (cond ? ok(label) : ng(label, detail))
// タイマーの残り表示("08:24"や"1:05:00")を秒数に変換する(TIMER-ADJ-01/TIMER-CUSTOM-01用)
const parseRemainingSeconds = (text) => {
  const m = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return null
  return m[3] !== undefined
    ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    : Number(m[1]) * 60 + Number(m[2])
}

const browser = await chromium.launch()
const context = await browser.newContext() // 毎回まっさらなストレージ(初回シードから検証)
const page = await context.newPage()
page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text()
  // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ
  if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
  errors.push(`[console@${currentCheck}] ${text}`)
})
page.on('pageerror', (err) => errors.push(`[pageerror@${currentCheck}] ${err.message}`))
page.on('dialog', (dialog) => dialog.accept())

try {
  // --- SMK-01: 起動・初回シード ---
  currentCheck = 'SMK-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1800) // 初回シード完了待ち
  const listText = await page.textContent('body')
  check('SMK-01 起動・基本レシピのシード', listText.includes('肉じゃが') && listText.includes('カレーライス'))

  // --- COUNT-01: 絞り込み無しでも一覧上部に総件数「全◯件」が常に表示される(2026-07-13 UI改善) ---
  currentCheck = 'COUNT-01'
  const allCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'COUNT-01 絞り込み無しで「全◯件」の総件数が表示される',
    (await page.textContent('body')).includes(`全${allCardCount}件`),
    `カード数=${allCardCount}`,
  )

  // --- QF-01: 絞り込み「時短レシピのみに絞る」でカード件数が変わる(quickStepsを持つレシピだけに
  // 絞られる。UI改善バッチ 2026-07-11。チップ文言は2026-07-13「時短」→「時短レシピ」、
  // 2026-07-16便T-5で「時短レシピのみに絞る」に変更) ---
  currentCheck = 'QF-01'
  await page.locator('button[aria-label="絞り込み"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '時短レシピのみに絞る', exact: true }).click()
  await page.waitForTimeout(400)
  const quickCardCount = await page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
  check(
    'QF-01 時短絞り込みで件数が変わる',
    quickCardCount > 0 && quickCardCount < allCardCount,
    `全件=${allCardCount} 時短=${quickCardCount}`,
  )
  check(
    'COUNT-01 絞り込み中は「結果件数 / 全件数」の形で表示される',
    (await page.textContent('body')).includes(`${quickCardCount}件 / 全${allCardCount}件`),
  )
  // 絞り込みを解除して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: '時短レシピのみに絞る', exact: true }).click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)

  // --- LAYOUT-01: 一覧の表示形式切替(グリッド/リスト。2026-07-13 UI改善)。settingsに保存され
  // リロード後(再訪)も維持されることを確認する ---
  currentCheck = 'LAYOUT-01'
  const layoutContainerInfo = () =>
    page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
        /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
      )
      const container = links[0]?.parentElement
      return { className: container?.className ?? '', count: links.length }
    })
  const layoutBefore = await layoutContainerInfo()
  check('LAYOUT-01 既定はグリッド表示', layoutBefore.className.includes('grid-cols-2'))
  await page.locator('button[aria-label="リスト表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterToList = await layoutContainerInfo()
  check(
    'LAYOUT-01 「リスト表示に切り替え」を押すと縦一列表示になる',
    layoutAfterToList.className.includes('flex-col') &&
      !layoutAfterToList.className.includes('grid-cols-2'),
  )
  check(
    'LAYOUT-01 リスト表示でもレシピ件数は変わらない',
    layoutAfterToList.count === layoutBefore.count,
    `グリッド=${layoutBefore.count} リスト=${layoutAfterToList.count}`,
  )
  // リスト表示の行がグリッドカードと同等の情報量を持つこと(2026-07-13 UI改善: 主要食材チップ・
  // 由来バッジ(基本レシピ)・タイトル2行折り返しをlist行にも追加)
  const listRowContent = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href^="#/recipes/"]')).filter((a) =>
      /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
    )
    return {
      anyChip: links.some((a) => a.querySelector('[style*="--chip-"]')),
      anyStarterBadge: links.some((a) => a.textContent?.includes('基本レシピ')),
      anyClampedTitle: links.some((a) => a.querySelector('p.line-clamp-2')),
    }
  })
  check('LAYOUT-01 リスト表示でも主要食材チップが見える', listRowContent.anyChip)
  check('LAYOUT-01 リスト表示でも由来バッジ(基本レシピ)が見える', listRowContent.anyStarterBadge)
  check(
    'LAYOUT-01 リスト表示でもタイトルが2行まで折り返す(line-clamp-2)',
    listRowContent.anyClampedTitle,
  )
  // リロードしても設定(settings.recipeListLayout)に保存されて維持されることを確認する
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const layoutAfterReload = await layoutContainerInfo()
  check(
    'LAYOUT-01 リロード後もリスト表示が維持される(settingsに保存)',
    layoutAfterReload.className.includes('flex-col'),
  )
  // グリッド表示に戻して以降のチェック(グリッド前提のセレクタ)に影響しないようにする
  await page.locator('button[aria-label="グリッド表示に切り替え"]').click()
  await page.waitForTimeout(300)
  const layoutAfterBackToGrid = await layoutContainerInfo()
  check('LAYOUT-01 グリッド表示に戻せる', layoutAfterBackToGrid.className.includes('grid-cols-2'))

  // --- SORTDIR-01: 並べ替えの昇順/降順トグル(2026-07-13 UI改善)。「五十音順」(2026-07-16便T-5で
  // 「あいうえお順」から改称)を選ぶと既定で昇順(あ→ん)になり、「降順」を押すと並びがちょうど反転する
  // ことを確認する。便T-1で並び替えボタンが絞り込みボタンから分離したのでそちらを開く ---
  currentCheck = 'SORTDIR-01'
  const cardTitles = () =>
    page.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '五十音順', exact: true }).click()
  await page.waitForTimeout(300)
  const ascActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '昇順')
    return target ? target.className.includes('border-accent') : false
  })
  check('SORTDIR-01 「五十音順」を選ぶと既定で昇順が選択される', ascActive)
  const ascTitles = await cardTitles()
  await page.getByRole('button', { name: '降順', exact: true }).click()
  await page.waitForTimeout(300)
  const descTitles = await cardTitles()
  check(
    'SORTDIR-01 「降順」を押すと並び順がちょうど反転する',
    ascTitles.length > 1 && JSON.stringify(descTitles) === JSON.stringify([...ascTitles].reverse()),
    `昇順=${JSON.stringify(ascTitles)} 降順=${JSON.stringify(descTitles)}`,
  )
  // 既定(更新順・降順)に戻して以降のチェックに影響しないようにする
  await page.getByRole('button', { name: '更新順', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)

  // --- SMK-05: 人数変更で帯分数表示(2人分→3人分でじゃがいも3個→4と1/2個) ---
  currentCheck = 'SMK-05'
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.locator('button[aria-label="人数を増やす"]').click()
  await page.waitForTimeout(400)
  const detailText = await page.textContent('body')
  check('SMK-05 人数変更の帯分数スケール', detailText.includes('4と1/2個'), `「4と1/2個」が見つからない`)
  check('SMK-05 g系は整数のまま', detailText.includes('300g'), '牛こま300g(200g×1.5)が見つからない')

  // --- 合わせ調味料の色ライン(共通説明文の表示) ---
  check('合わせ調味料ヒント表示', detailText.includes('先にまとめて計量してOK'))

  // --- NUT-01: 栄養価のめやす(未解錠・無料)。肉じゃがの詳細を開いたまま検証する
  // (M6-1 2026-07-12オーナー指示でNUTRITION_ENABLED=trueに前倒し有効化。エネルギー・食塩相当量の
  // 2項目は無料でも常時計算表示(2026-07-10バッチH-4)、残り3項目はPro案内にとどめる設計) ---
  currentCheck = 'NUT-01'
  check('NUT-01 栄養価のめやす見出しが閉じた状態から見える', detailText.includes('栄養価のめやす'))
  check('NUT-01 エネルギー(kcal)の概算が閉じた1行から見える', /\d+kcal/.test(detailText))
  check('NUT-01 塩分の概算が閉じた1行から見える', detailText.includes('塩分'))
  await page.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
  await page.waitForTimeout(300)
  const nutExpandedText = await page.textContent('body')
  check('NUT-01 展開すると断定しない「めやす」表記の注記が出る', nutExpandedText.includes('めやす'))
  check('NUT-01 出典表記がある', nutExpandedText.includes('出典'))
  check(
    'NUT-01 未解錠には月間献立と同じ「Pro版について見る」リンクが出る',
    nutExpandedText.includes('Pro版について見る'),
  )
  check(
    'NUT-01 未解錠案内にPro版で増える項目(たんぱく質・脂質・炭水化物)が明記される(2026-07-13 UIペルソナQA)',
    nutExpandedText.includes('Pro版では、たんぱく質・脂質・炭水化物・食物繊維・鉄・カルシウムのめやすも表示されます'),
  )
  await page.getByRole('button', { name: '栄養価のめやすを閉じる' }).click()
  await page.waitForTimeout(200)

  // --- ZENKAKU-01: 全角入力の自動正規化(2026-07-21 オーナー実機報告:「アサリ 300ｇ」の全角ｇだと
  // 栄養計算に反映されない・数量も全角で入力できてしまう)。材料の分量欄に全角数字「３００」・
  // 単位欄に全角「ｇ」を入力し、blur(フォーカスを外す)で自動的に半角「300」「g」に置き換わること、
  // 保存後の栄養計算にも反映され「計算対象外」にならないことを確認する(修正前は単位が全角のまま
  // だと半角の食品データと一致せず計算対象外になっていた=本バグの直接の再現ケース) ---
  currentCheck = 'ZENKAKU-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E全角正規化確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('アサリ')
  const zenkakuAmountInput = page.getByPlaceholder('例: 3', { exact: true }).first()
  const zenkakuUnitInput = page.getByPlaceholder('例: 個', { exact: true }).first()
  await zenkakuAmountInput.fill('３００') // 全角数字
  await zenkakuUnitInput.fill('ｇ') // 全角英字(半角gの全角形)
  // Tabでフォーカスを外し、実際のblurイベントを発火させる(IME確定後のblurと同じ経路。
  // compositionend後にしか発火しないため、変換中の文字が正規化で壊れることはない)
  await zenkakuUnitInput.press('Tab')
  await page.waitForTimeout(200)
  check(
    'ZENKAKU-01 全角数量「３００」はblurで半角「300」に置き換わる',
    (await zenkakuAmountInput.inputValue()) === '300',
    `実際の値=${await zenkakuAmountInput.inputValue()}`,
  )
  check(
    'ZENKAKU-01 全角単位「ｇ」はblurで半角「g」に置き換わる',
    (await zenkakuUnitInput.inputValue()) === 'g',
    `実際の値=${await zenkakuUnitInput.inputValue()}`,
  )
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('アサリを砂抜きする')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  check('ZENKAKU-01 保存後にレシピ詳細へ遷移する', page.url().includes('#/recipes/'))
  const zenkakuDetailText = await page.textContent('body')
  check('ZENKAKU-01 栄養価のめやす見出しが見える', zenkakuDetailText.includes('栄養価のめやす'))
  await page.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
  await page.waitForTimeout(300)
  const zenkakuNutritionText = await page.textContent('body')
  check(
    'ZENKAKU-01 全角で入力した「アサリ 300ｇ」が栄養計算対象外にならない(単位「ｇ」がgとして解釈される回帰)',
    !zenkakuNutritionText.includes('計算対象外'),
  )
  await page.getByRole('button', { name: '栄養価のめやすを閉じる' }).click()
  await page.waitForTimeout(200)

  // 以降のTERM-01が「肉じゃが」の詳細を開いたままである前提のため、その状態に戻す
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)

  // --- TERM-01: 用語タップでポップオーバーが開き、外タップで閉じる(用語タップ辞書 2026-07-11)。
  // 肉じゃが手順1「玉ねぎはくし形に切る」の「くし形」をタップして説明を確認する ---
  currentCheck = 'TERM-01'
  await page.getByRole('button', { name: 'くし形切りの説明を見る' }).click()
  await page.waitForTimeout(300)
  // 説明文はMemoText描画(2026-07-12)で文節境界にZWSPが入るため、比較前に除去する
  const stripZwsp = (s) => s.replace(/\u200b/g, '')
  const termOpenText = stripZwsp(await page.textContent('body'))
  check('TERM-01 用語タップでポップオーバーが開く', termOpenText.includes('縦半分に切った玉ねぎ'))
  await page.mouse.click(5, 5) // ポップオーバーの外をタップ
  await page.waitForTimeout(300)
  const termClosedText = stripZwsp(await page.textContent('body'))
  check('TERM-01 外タップでポップオーバーが閉じる', !termClosedText.includes('縦半分に切った玉ねぎ'))

  // --- SMK-08(簡易): 調理中モードを開いて手順送り・閉じる ---
  currentCheck = 'SMK-08'
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  const focusText = await page.textContent('body')
  check('SMK-08 調理中モードが開く', focusText.includes('手順 1/'))
  await page.getByRole('button', { name: '次へ' }).click()
  await page.waitForTimeout(300)
  check('SMK-08 手順送り', (await page.textContent('body')).includes('手順 2/'))
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)

  // --- FOCUS-MEMO-01: 調理中モードの▽折りたたみメモをタップすると詳細画面と同じ小窓(ポップオーバー)で
  // 開く(2026-07-12 Fable裁定: 1手順を大きく見せる調理中モードでメモ全文の常時展開は本文を圧迫するため、
  // 詳細画面と挙動を統一)。「回鍋肉(ホイコーロー)」手順5の「▽たくさん作るとき」には「・」箇条書きと
  // 「｜」改行の両方が入っているため、これらが小窓の中でも効くことまで併せて確認する
  // (2026-07-13: 元は「蒸しなすの香味だれ」→用語辞書集約で削除→「鶏の照り焼き」に差し替え。
  //  2026-07-14: 鶏の照り焼きの▽も分割冗長文の横展開削除で｜構造が消えたため、同じ構造(手順範囲指定の
  //  例外として｜+・箇条書きを保持している)「回鍋肉」手順5に再度差し替えた) ---
  currentCheck = 'FOCUS-MEMO-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('料理名・材料・タグで検索').fill('回鍋肉')
  await page.waitForTimeout(300)
  await page.getByText('回鍋肉(ホイコーロー)', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByText('調理中モードで見る').click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '次へ' }).click() // 手順2へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順3へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順4へ
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '次へ' }).click() // 手順5(▽を含む手順)へ
  await page.waitForTimeout(300)
  const focusMemoFoldedText = await page.textContent('body')
  check(
    'FOCUS-MEMO-01 ▽はラベルのみ折りたたみ表示され詳細は隠れている',
    focusMemoFoldedText.includes('たくさん作るとき') &&
      !focusMemoFoldedText.includes('一度に炒められるのはフライパン'),
  )
  // 詳細画面の手順リスト(FocusModeの背後にDOM上は残ったまま)にも同じ▽ボタンがあるため、
  // FocusModeの全画面オーバーレイ(.fixed.inset-0.z-50)側だけに絞って押す
  await page.locator('.fixed.inset-0.z-50').getByRole('button', { name: 'たくさん作るとき' }).click()
  await page.waitForTimeout(300)
  const focusMemoOpenText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 タップで小窓が開き詳細(1文目)が見える',
    focusMemoOpenText.includes('一度に炒められるのはフライパン'),
  )
  check(
    'FOCUS-MEMO-01 「｜」改行後の2文目も「・」箇条書きとして見える',
    focusMemoOpenText.includes('人数が多いときは手順③〜⑤'),
  )
  await page.mouse.click(5, 5) // 小窓の外をタップ
  await page.waitForTimeout(300)
  const focusMemoClosedText = stripZwsp(await page.textContent('body'))
  check(
    'FOCUS-MEMO-01 外タップで小窓が閉じる',
    !focusMemoClosedText.includes('一度に炒められるのはフライパン'),
  )
  await page.getByRole('button', { name: '閉じる' }).click()
  await page.waitForTimeout(300)
  // この検索語が一覧の状態(sessionStorage)に残ったままだと、以降のテスト(戻る動線・スクロール系)が
  // 「鶏の照り焼き」だけの絞り込み一覧を前提に動いてしまい無関係な失敗を招くため、必ず消しておく
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- TAB-01: 詳細を開いたままリロード→下タブ「レシピ」で一覧へ戻れる ---
  // (覚えた「最後のレシピパス」＝現在地となりタップが無反応になる回帰の防止。2026-07-09第2波)
  currentCheck = 'TAB-01'
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  check('TAB-01 リロードで詳細が復元される', /#\/recipes\/\d+/.test(page.url()))
  await page.locator('nav').getByText('レシピ', { exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'TAB-01 リロード後もレシピタブで一覧へ戻れる',
    page.url().includes('#/recipes') && !/#\/recipes\/\d/.test(page.url()),
    `現在URL: ${page.url()}`,
  )

  // --- DET-01: 詳細の戻るボタン(2026-07-16オーナー改定)。
  // 従来(2026-07-10決定): 一覧以外の画面から来た場合でも常に一覧へ戻る
  // (ブラウザ履歴があると直前の画面に戻ってしまっていた不具合の再発防止)。
  // 改定(2026-07-16): ホームの候補カード(「今日なに作る?」)発だけは例外でホームへ戻る
  // (todayList方式の拡張)。それ以外(一覧・直接URL等、履歴/state無し)は従来どおり一覧へ ---
  currentCheck = 'DET-01'
  // (a) ホームの候補カードから詳細→戻る→ホーム(#/)へ戻る
  await page.goto(`${BASE}/#/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.locator('a[href^="#/recipes/"]').first().click()
  await page.waitForTimeout(500)
  check(
    'DET-01 ホームの候補カードからレシピ詳細へ遷移',
    /#\/recipes\/\d+/.test(page.url()),
    `現在URL: ${page.url()}`,
  )
  const det01DetailUrl = page.url()
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01(2026-07-16改定) ホームの候補カード発の戻るはホーム(#/)へ戻る',
    page.url() === `${BASE}/#/`,
    `現在URL: ${page.url()}`,
  )

  // (b) 戻り先の保全: 直接URL(ブラウザ履歴なし・state無し)で詳細を開いた場合は従来どおり一覧へ
  await page.goto(det01DetailUrl, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(400)
  check(
    'DET-01(戻り先の保全) 直接URLで開いた詳細の戻るは従来どおり一覧へ',
    page.url().endsWith('#/recipes'),
    `現在URL: ${page.url()}`,
  )

  // --- URLIMPORT-00: VITE_RECIPE_IMPORT_ENDPOINT未設定(通常のdev/preview起動)では
  // 「URLから取り込む」ボタン自体が出ない(Workerデプロイ前でも壊れない設計。src/logic/urlImport.ts
  // のisUrlImportEnabled)。設定済みの場合の表示・取り込みフローはURLIMPORT-01以降(自前previewサーバー
  // port 4203・VITE_RECIPE_IMPORT_ENDPOINTをダミー値でビルド)で確認する ---
  currentCheck = 'URLIMPORT-00'
  // 2026-07-21改定: 本番Workerのデプロイに伴い .env.production にエンドポイントが設定された。
  // このチェックは「ビルド時の設定状態と表示が一致すること」を検証する適応型にする
  // (設定済みビルド=ボタンが出る/未設定ビルド=出ない。未設定側の分岐検証はURLIMPORT-01の
  // 専用ビルド側で担保)。.env.production を読んで期待値を決める
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  {
    const envFile = readFileSync(path.join(appRoot, '.env.production'), 'utf8')
    const m = envFile.match(/^VITE_RECIPE_IMPORT_ENDPOINT=(.*)$/m)
    const endpointConfigured = !!(m && m[1].trim())
    const btnVisible = await page.getByText('URLから取り込む').isVisible().catch(() => false)
    check(
      endpointConfigured
        ? 'URLIMPORT-00 エンドポイント設定済みビルドでは「URLから取り込む」ボタンが出る'
        : 'URLIMPORT-00 エンドポイント未設定では「URLから取り込む」ボタンが出ない',
      endpointConfigured ? btnVisible : !btnVisible,
    )
  }

  // --- SMK-04+02: テキスト貼り付け→登録 ---
  currentCheck = 'SMK-04'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('テキスト貼り付けで自動入力').click()
  await page.waitForTimeout(300)
  await page.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]').fill(
    'E2Eスモーク試験用レシピ\n\n材料（2人分）\n・にんじん　1本\n・しょうゆ　大さじ2\n\n作り方\n1. にんじんを切る\n2. 炒める',
  )
  await page.getByRole('button', { name: '自動で振り分ける' }).click()
  await page.waitForTimeout(300)
  const formText = await page.textContent('body')
  check('SMK-04 貼り付け整形の読み取り結果', formText.includes('材料2件・手順2件を読み取りました'))
  currentCheck = 'SMK-02'
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const savedText = await page.textContent('body')
  check('SMK-02 保存→詳細表示', savedText.includes('E2Eスモーク試験用レシピ') && savedText.includes('にんじん'))

  // --- SMK-03: 編集画面から削除(ダイアログは自動承諾) ---
  currentCheck = 'SMK-03'
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('SMK-03 削除が一覧に反映', !(await page.textContent('body')).includes('E2Eスモーク試験用レシピ'))

  // --- KW-01: 検索キーワード欄(keywords・2026-07-12バッチ)。一覧や詳細には表示されず、
  // 検索語に入力したときだけヒットすることを確認する ---
  currentCheck = 'KW-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eキーワード確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  // 検索キーワード欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const kwInput = page.getByPlaceholder('例: チンジャオロース、おつまみ など')
  await kwInput.fill('ずっきーにのひみつご')
  await kwInput.press('Enter') // タグと同じくEnterでチップ化(addKeyword)
  await page.waitForTimeout(200)
  const kwFormText = await page.textContent('body')
  check('KW-01 キーワードがチップとして追加される', kwFormText.includes('ずっきーにのひみつご'))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const kwDetailText = await page.textContent('body')
  check('KW-01 保存自体は成功する(詳細にタイトルが出る)', kwDetailText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 保存後の詳細画面にキーワード文字列が表示されない', !kwDetailText.includes('ずっきーにのひみつご'))

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  check('KW-01 一覧画面にもキーワード文字列が表示されない(検索前)', !(await page.textContent('body')).includes('ずっきーにのひみつご'))
  await page.locator('input[type="search"]').fill('ずっきーにのひみつご')
  await page.waitForTimeout(400)
  const kwSearchText = await page.textContent('body')
  check('KW-01 検索キーワードでレシピがヒットする', kwSearchText.includes('E2Eキーワード確認レシピ'))
  check('KW-01 検索結果表示でもキーワード文字列自体は表示されない', !kwSearchText.includes('ずっきーにのひみつご'))

  // 検索語をクリアしておく(一覧の検索条件はsessionStorageに保存され、この後の一覧系チェックが
  // 同じpage/contextを使い回すため、絞り込んだままだと後続チェックの「a[href^="#/recipes/"]」の
  // querySelectorが0件ヒットの一覧で「＋(新規登録)」リンクを拾ってしまい誤検出になる)
  await page.locator('input[type="search"]').fill('')
  await page.waitForTimeout(400)

  // 後始末: 検証用に作成したレシピを削除
  await page.getByText('E2Eキーワード確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- INTRO-01: ひとこと説明(intro・任意。2026-07-13)。料理名だけでは中身が想像しにくい
  // 料理向けの短い説明文。フォームで入力→保存→詳細の料理名の直下に表示されることを確認する ---
  currentCheck = 'INTRO-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eひとこと説明確認レシピ')
  // ひとこと説明欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder('例: ヨーグルトに二種類のソースをかけた見た目も楽しいデザートです')
    .fill('E2E確認用のひとこと説明テキスト')
  await page.getByRole('tab', { name: 'かんたん' }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 2026-07-16 UI総点検A-8: introもwrapJaPhrases経由(ja-phrase)の描画になり、文節境界にZWSPが
  // 入るようになったため、他のMemoText系フィールドと同じくstripZwspしてから比較する
  const introDetailText = stripZwsp(await page.textContent('body'))
  check(
    'INTRO-01 保存後の詳細に料理名が表示される',
    introDetailText.includes('E2Eひとこと説明確認レシピ'),
  )
  check(
    'INTRO-01 保存後の詳細に料理名の下にひとこと説明が表示される',
    introDetailText.includes('E2E確認用のひとこと説明テキスト'),
  )
  const introHeading = page.getByRole('heading', { name: 'E2Eひとこと説明確認レシピ' })
  const introBelowTitle = stripZwsp(
    await introHeading.evaluate((el) => {
      const next = el.nextElementSibling
      return next?.textContent ?? ''
    }),
  )
  check(
    'INTRO-01 ひとこと説明は料理名見出しの直後の要素に表示される',
    introBelowTitle.includes('E2E確認用のひとこと説明テキスト'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- ONEPOINT-01: メモ2区画化(2026-07。オーナー承認済み設計)。「ワンポイント」
  // (こつ・知識)と「メモ」(保存方法・注意書き・安全)を別々に入力→保存→詳細画面で
  // ①ワンポイント→②メモの順で見出し付きで表示されること・編集画面を開き直しても
  // 両方の入力が保持されることを確認する ---
  currentCheck = 'ONEPOINT-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2Eワンポイントメモ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  // ワンポイント・メモ欄は「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  await page
    .getByPlaceholder('こつ・知識など。例: 味噌は煮立てると香りが飛ぶので最後に')
    .fill('E2E確認用のワンポイント本文')
  await page.getByPlaceholder('気づいたこと・アレンジなどを自由に').fill('E2E確認用のメモ本文')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  // 本文はMemoText(改行エンジン)経由でZWSPが挿入されるため、素のincludesでは一致しない。stripZwspで除去してから照合する
  const onePointDetailText = stripZwsp(await page.textContent('body'))
  check(
    'ONEPOINT-01 保存後の詳細にワンポイント本文が表示される',
    onePointDetailText.includes('E2E確認用のワンポイント本文'),
  )
  check(
    'ONEPOINT-01 保存後の詳細にメモ本文が表示される',
    onePointDetailText.includes('E2E確認用のメモ本文'),
  )
  const onePointHeadings = await page.locator('h2').allTextContents()
  const onePointIdx = onePointHeadings.indexOf('ワンポイント')
  const memoIdx = onePointHeadings.indexOf('メモ')
  check('ONEPOINT-01 「ワンポイント」見出しが存在する', onePointIdx !== -1)
  check('ONEPOINT-01 「メモ」見出しが存在する', memoIdx !== -1)
  check(
    'ONEPOINT-01 表示順は①ワンポイント→②メモ(オーナー承認済み設計)',
    onePointIdx !== -1 && memoIdx !== -1 && onePointIdx < memoIdx,
    `headings: ${JSON.stringify(onePointHeadings)}`,
  )

  // 編集画面を開き直しても両方の入力が保持される(DB保存の確認)。編集画面の初期表示は
  // 常に「かんたん」タブのため、ワンポイント・メモを確認するには「くわしく」への切替が必要
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const onePointEditValue = await page
    .getByPlaceholder('こつ・知識など。例: 味噌は煮立てると香りが飛ぶので最後に')
    .inputValue()
  const memoEditValue = await page.getByPlaceholder('気づいたこと・アレンジなどを自由に').inputValue()
  check(
    'ONEPOINT-01 編集画面のワンポイント欄に保存内容が復元される',
    onePointEditValue === 'E2E確認用のワンポイント本文',
    `実際の値: ${onePointEditValue}`,
  )
  check(
    'ONEPOINT-01 編集画面のメモ欄に保存内容が復元される',
    memoEditValue === 'E2E確認用のメモ本文',
    `実際の値: ${memoEditValue}`,
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- DISHTYPE-01: レシピ種別チップ(主菜/副菜/汁物/デザート・任意選択。2026-07-13
  // 献立の主菜+副菜提案精度向上対応)。選択→保存→編集画面を開き直しても選択状態が
  // 保持される(DB保存の確認)こと、もう一度押すと解除できることを確認する ---
  currentCheck = 'DISHTYPE-01'
  const isChipActive = (locator) => locator.evaluate((el) => el.className.includes('border-accent'))
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E種別チップ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
  // 種別チップは「くわしく」タブの中(2026-07-16 かんたん/くわしくタブ分け)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const sideChip = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 保存前は「副菜」チップが未選択', !(await isChipActive(sideChip)))
  await sideChip.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 「副菜」チップをタップすると選択状態になる', await isChipActive(sideChip))
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  check(
    'DISHTYPE-01 保存自体は成功する(詳細にタイトルが出る)',
    (await page.textContent('body')).includes('E2E種別チップ確認レシピ'),
  )
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'くわしく' }).click()
  await page.waitForTimeout(200)
  const sideChipEdit = page.getByRole('button', { name: '副菜', exact: true })
  check('DISHTYPE-01 編集画面を開き直しても選択状態が保持される(DB保存の確認)', await isChipActive(sideChipEdit))
  await sideChipEdit.click()
  await page.waitForTimeout(200)
  check('DISHTYPE-01 もう一度押すと選択が解除される', !(await isChipActive(sideChipEdit)))

  // 後始末: 検証用に作成したレシピを削除
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- STEP0-01: 手順0件のレシピ(バグ修正2026-07)。手順欄を空のまま保存すると
  // cleanInput()で空の手順行が除かれ steps:[] になる。この状態の詳細画面で
  // 「調理中モードで見る」ボタンが表示されず(押せてクラッシュすることがない)ことを確認する ---
  currentCheck = 'STEP0-01'
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E手順0件確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
  // 手順本文は空のまま保存する(このレシピが手順0件になる)
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const step0DetailText = await page.textContent('body')
  check(
    'STEP0-01 保存自体は成功する(詳細にタイトルが出る)',
    step0DetailText.includes('E2E手順0件確認レシピ'),
  )
  check(
    'STEP0-01 手順0件では「調理中モードで見る」ボタンが表示されない',
    !step0DetailText.includes('調理中モードで見る'),
  )

  // 後始末: 検証用に作成したレシピを削除
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- NUTSORT-01: 栄養並び替えの無料ティーザー(2026-07-13 Fable設計→2026-07-16 便T-4で
  // カロリー・たんぱく質・塩分・脂質・糖質の5項目まとめてPro機能化。従来無料だったカロリー順も
  // Pro側へ=オーナー確定)。無料(未解錠)では並び替えパネルに栄養価の選択肢が一切出ず、
  // グレーの「栄養価で並び替え（Pro機能）」行だけが出て、タップ先が既存のPro案内
  // (設定のProタブ)であることを確認する。実際の並び順の検証はPro解錠済みの
  // NUTSORT-02側で行う ---
  currentCheck = 'NUTSORT-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.locator('button[aria-label="並び替え"]').click()
  await page.waitForTimeout(300)
  const nutSortPanelText = await page.textContent('body')
  check(
    'NUTSORT-01 無料ではグレーの「栄養価で並び替え（Pro機能）」ティーザーが出る',
    nutSortPanelText.includes('栄養価で並び替え（Pro機能）'),
  )
  const freeNutrientButtons = await page.evaluate(() => {
    const names = ['カロリー', 'たんぱく質', '塩分', '脂質', '糖質']
    const buttons = Array.from(document.querySelectorAll('button'))
    return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
  })
  check(
    'NUTSORT-01 無料では栄養価5項目が並び替えの選択肢に出ない(旧無料カロリー順もPro側へ)',
    freeNutrientButtons.length === 0,
    `出てしまった項目=${JSON.stringify(freeNutrientButtons)}`,
  )
  const teaserHref = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'))
    const teaser = links.find((a) => a.textContent?.includes('栄養価で並び替え（Pro機能）'))
    return teaser?.getAttribute('href') ?? null
  })
  check(
    'NUTSORT-01 ティーザーのタップ先は既存のPro案内(設定のPro節)',
    teaserHref === '#/settings?section=pro',
    `href=${teaserHref}`,
  )
  // パネルを閉じ、以降のチェックに影響しないようにする(条件は何も変えていない)
  await page.getByRole('button', { name: '決定' }).click()
  await page.waitForTimeout(300)
  await page.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))

  // --- SMK-14: テーマ・第◯弾の括りを全廃(2026-07-23オーナー確定)。旧配布テーマ(全52品)は
  // 同梱の「基本レシピ」に合流し、初回シードで全103品が入る。まっさらな状態で:
  //  (1) 初回シードで103品が全て「基本レシピ」(isStarter・sourceSetIdなし)として入る
  //  (2) 旧テーマ由来の代表品が基本レシピとして存在する
  //  (3) 設定にテーマ一覧・「すべて追加」等のテーマUIが一切存在しない
  //  (4) 旧配布ページの ?set= 付きURLで来ても、エラーにならず設定へ無害に着地する(取り込みは起きない)
  // を、専用のbrowser/contextで確認する(主フローのDBを汚さないため) ---
  currentCheck = 'SMK-14'
  {
    const freeBrowser = await chromium.launch()
    const freeContext = await freeBrowser.newContext()
    const freePage = await freeContext.newPage()
    freePage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SMK-14] ${err.message}`)
    })
    // ?set= 付きURLで確認ダイアログが出ないこと自体も仕様だが、万一出ても止まらないよう承諾しておく
    freePage.on('dialog', (dialog) => dialog.accept())
    try {
      await freePage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(2200) // 初回シード完了待ち(103品)

      // (1) 初回シードで103品が全て「平らな基本レシピ」(isStarter・sourceSetIdなし)として入る
      const seededStats = await freePage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getAll = tx.objectStore('recipes').getAll()
              getAll.onsuccess = () => {
                const rs = getAll.result
                resolve({
                  total: rs.length,
                  starters: rs.filter((r) => r.isStarter === true).length,
                  withSourceSet: rs.filter((r) => r.sourceSetId != null).length,
                  hasKintore: rs.some((r) => r.title === 'レンジ蒸し鶏（自家製サラダチキン）'),
                  hasDashi: rs.some((r) => r.title === 'だしのとり方'),
                })
              }
              getAll.onerror = () => reject(getAll.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check(
        'SMK-14 初回シードで103品が入る',
        seededStats.total === 103,
        `total=${seededStats.total}`,
      )
      check(
        'SMK-14 全品が「基本レシピ」(isStarter)で、テーマ由来のsourceSetIdは付かない(平ら)',
        seededStats.starters === 103 && seededStats.withSourceSet === 0,
        `starters=${seededStats.starters} withSourceSet=${seededStats.withSourceSet}`,
      )
      check(
        'SMK-14 旧テーマ由来の代表品(高たんぱく・だしのとり方)が基本レシピとして同梱される',
        seededStats.hasKintore && seededStats.hasDashi,
        `hasKintore=${seededStats.hasKintore} hasDashi=${seededStats.hasDashi}`,
      )

      // (3) 設定にテーマUI(テーマ一覧・すべて追加・テーマ一覧節)が一切存在しない
      await freePage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(800)
      const settingsBody = await freePage.textContent('body')
      const hasThemeSection = await freePage.evaluate(
        () => !!document.getElementById('theme-list-section'),
      )
      check(
        'SMK-14 設定にテーマ一覧・「すべて追加」等のテーマUIが存在しない',
        !settingsBody.includes('テーマ一覧') &&
          !settingsBody.includes('すべて追加') &&
          !hasThemeSection,
      )
      // 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)は配布互換として存続する
      check(
        'SMK-14 汎用の「レシピセットを読み込む」欄は存続する',
        settingsBody.includes('レシピセットを読み込む'),
      )

      // (4) 旧 ?set= 付きURLで来ても、エラーにならず設定へ無害に着地する(取り込みは起きない)
      await freePage.goto(`${BASE}/#/settings?set=kintore`, { waitUntil: 'networkidle' })
      await freePage.waitForTimeout(1000)
      const afterSetBody = await freePage.textContent('body')
      check(
        'SMK-14 ?set=付きURLは無害に設定へ着地する(取り込みは起きない・エラーも出ない)',
        !afterSetBody.includes('件追加しました') &&
          !afterSetBody.includes('見つかりませんでした') &&
          afterSetBody.includes('NG食材（アレルギー・苦手）'),
      )
      check(
        'SMK-14 ?set=付きURLの set パラメータは静かに取り除かれる',
        !freePage.url().includes('set=kintore'),
        `url=${freePage.url()}`,
      )
    } finally {
      await freeBrowser.close()
    }
  }

  // --- SETTINGS-TAB-01: 設定画面の1本スクロール化(2026-07-17オーナー採用決定。旧: 上部タブ4分割2026-07-12〜)。
  // 全般→レシピ→バックアップ→Proの4節が1画面に同時に存在し(=どれも隠れない)、上部の目次チップ
  // (全般/レシピ/バックアップ/Pro)のタップで該当節へスクロールすること・?section=/?set=直リンクが
  // 該当節へ自動スクロールすることを確認する。旧「他タブは隠れている」検証は「4節が同時に存在する」検証へ、
  // 旧aria-pressed検証はスクロール位置検証へ置き換えた(テスト意図: タブ選択→節スクロールに読み替え) ---
  currentCheck = 'SETTINGS-TAB-01'
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  {
    const body = await page.textContent('body')
    check(
      'SETTINGS-TAB-01 1本スクロール: 全般(NG食材)/レシピ(セット読み込み)/バックアップ(書き出し)/Pro(Pro版)の4節が同時に存在する',
      body.includes('NG食材（アレルギー・苦手）') &&
        body.includes('レシピセットを読み込む') &&
        body.includes('ファイルに書き出す') &&
        body.includes('Pro版'),
    )
  }
  check(
    'SETTINGS-TAB-01 目次チップ(全般/レシピ/バックアップ/Pro)が4つとも存在する',
    (await page.getByRole('button', { name: '全般', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'レシピ', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'バックアップ', exact: true }).count()) === 1 &&
      (await page.getByRole('button', { name: 'Pro', exact: true }).count()) === 1,
  )
  // 節の上端(viewport相対top)を返すヘルパ。sticky目次チップ(約88px)の下付近(<200)へ来たら
  // 「その節の先頭までスクロールした」とみなす(scroll-mt-24でチップ分だけ下げている)
  const settingsSectionTop = (id) =>
    page.evaluate((elId) => {
      const el = document.getElementById(elId)
      return el ? el.getBoundingClientRect().top : null
    }, id)
  // スムーズスクロールが落ち着く(window.scrollYが変化しなくなる)まで待つ。長距離のスムーズ
  // スクロールは固定待ちだとアニメーション途中で測ってしまうため(旧: 700ms固定で偽陰性)
  const waitScrollSettled = async () => {
    let last = -1
    for (let i = 0; i < 25; i++) {
      const y = await page.evaluate(() => Math.round(window.scrollY))
      if (y === last) return
      last = y
      await page.waitForTimeout(120)
    }
  }
  // 「Pro」チップ: 最上部から下部のPro節まで大きくスクロールする(topが大きく減る=下へ動いた)。
  // Pro節は最後尾なので先頭が上端(96px)まで届かず最下部で止まることがある→上端付近か最下部で合格
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  const proTopBefore = await settingsSectionTop('section-pro')
  await page.getByRole('button', { name: 'Pro', exact: true }).click()
  await waitScrollSettled()
  const proTopAfter = await settingsSectionTop('section-pro')
  const proAtBottom = await page.evaluate(
    () => window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 8,
  )
  check(
    'SETTINGS-TAB-01 「Pro」チップのタップで下部のPro節までスクロールする',
    proTopBefore !== null &&
      proTopAfter !== null &&
      proTopAfter < proTopBefore - 100 &&
      (proTopAfter < 200 || proAtBottom),
    `proTopBefore=${proTopBefore} proTopAfter=${proTopAfter} atBottom=${proAtBottom}`,
  )
  // 「バックアップ」チップ: バックアップ節の先頭が上端付近へ来る
  await page.getByRole('button', { name: 'バックアップ', exact: true }).click()
  await waitScrollSettled()
  const backupChipTop = await settingsSectionTop('section-backup')
  check(
    'SETTINGS-TAB-01 「バックアップ」チップのタップでバックアップ節の先頭が上端付近へ来る',
    backupChipTop !== null && backupChipTop >= -5 && backupChipTop < 200,
    `backupChipTop=${backupChipTop}`,
  )
  // 「レシピ」チップ: レシピ節の先頭が上端付近へ来る
  await page.getByRole('button', { name: 'レシピ', exact: true }).click()
  await waitScrollSettled()
  const recipeChipTop = await settingsSectionTop('section-recipe')
  check(
    'SETTINGS-TAB-01 「レシピ」チップのタップでレシピ節の先頭が上端付近へ来る',
    recipeChipTop !== null && recipeChipTop >= -5 && recipeChipTop < 200,
    `recipeChipTop=${recipeChipTop}`,
  )

  // --- BANNER-01(2026-07-17設定ゼロベース裁定#1): バックアップ状態バナー。目次チップの下・
  // 全節共通の常設バナー。未実施は「まだバックアップしていません」、「今すぐ保存」はどこからでも
  // バックアップ節の①書き出しカードへスクロールする(1本スクロール化でタブ切り替えは廃止) ---
  currentCheck = 'BANNER-01'
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.waitForTimeout(200)
  check(
    'BANNER-01 全節共通のバックアップ状態バナーが見える(未実施表示)',
    (await page.textContent('body')).includes('まだバックアップしていません'),
  )
  await page.getByRole('button', { name: '今すぐ保存', exact: true }).click()
  await waitScrollSettled()
  check(
    'BANNER-01 「今すぐ保存」でバックアップの①書き出しカードへスクロールする(ボタンがDOMにある)',
    (await page.textContent('body')).includes('ファイルに書き出す'),
  )
  {
    const exportCardTop = await settingsSectionTop('backup-section')
    check(
      'BANNER-01 「今すぐ保存」で①バックアップを取るカードが上端付近へ来る(旧aria-pressed検証をスクロール位置検証へ)',
      exportCardTop !== null && exportCardTop >= -5 && exportCardTop < 200,
      `exportCardTop=${exportCardTop}`,
    )
  }

  // 1本スクロールでは全節が常にDOMにあるため、以降の各節の内容は直接確認する(タブ切り替え不要)
  currentCheck = 'SETTINGS-TAB-01'
  // --- NGCOUNT-01(2026-07-17設定ゼロベース裁定#2): NG食材見出し行の件数常時表示。
  // 未登録は「未設定」(登録後の「◯件」表示はTOAST-01で確認する) ---
  currentCheck = 'NGCOUNT-01'
  check(
    'NGCOUNT-01 未登録は「未設定」表示',
    (await page.textContent('body')).includes('未設定'),
  )
  // --- ABOUT-01(2026-07-17設定ゼロベース裁定#3): 「このアプリについて」にバージョン+
  // データ件数(レシピ◯件・作った記録◯件)を表示する ---
  currentCheck = 'ABOUT-01'
  {
    const aboutText = await page.textContent('body')
    check('ABOUT-01 バージョン表示がある', /バージョン \S+/.test(aboutText))
    check(
      'ABOUT-01 データ件数表示(レシピ◯件・作った記録◯件)がある',
      /レシピ \d+件・作った記録 \d+件/.test(aboutText),
    )
  }
  // --- MOVEGUIDE-01(2026-07-17設定ゼロベース裁定#5): 機種変更・引っ越しガイド(折りたたみ)。
  // 既定は畳まれていて手順は見えず、タップで展開すると3ステップ+注意文が見えること ---
  currentCheck = 'MOVEGUIDE-01'
  check(
    'MOVEGUIDE-01 「機種変更するときは」の折りたたみ見出しが見える',
    (await page.textContent('body')).includes('機種変更するときは'),
  )
  check(
    'MOVEGUIDE-01 既定は畳まれていて手順は見えない',
    !(await page.textContent('body')).includes('この端末で「ファイルに書き出す」'),
  )
  await page.getByRole('button', { name: '機種変更するときは', exact: true }).click()
  await page.waitForTimeout(300)
  {
    const guideText = await page.textContent('body')
    check(
      'MOVEGUIDE-01 展開すると3ステップが見える',
      guideText.includes('この端末で「ファイルに書き出す」') &&
        guideText.includes('読み込む（置き換え）') &&
        guideText.includes('購入コードを入れ直す'),
    )
    check('MOVEGUIDE-01 注意文が見える', guideText.includes('先にレシピを登録していた場合は消える'))
  }
  // 畳んで元に戻す(以降のチェックに影響しないように)
  await page.getByRole('button', { name: '機種変更するときは', exact: true }).click()
  await page.waitForTimeout(200)

  currentCheck = 'BACKUPCARDS-01'
  // 修正5(2026-07-17バックアップ改修): バックアップタブが3カード
  // (①バックアップを取る/②バックアップから戻す/③困ったとき)に再構成されたこと
  check(
    'BACKUPCARDS-01 「バックアップから戻す」の見出しが見える(カード②)',
    (await page.textContent('body')).includes('バックアップから戻す'),
  )
  check(
    'BACKUPCARDS-01 「追加」「置き換え」の両ボタンが同時に見える(並べて配置)',
    (await page.textContent('body')).includes('読み込む（今のデータに追加）') &&
      (await page.textContent('body')).includes('読み込む（今のデータと置き換え）'),
  )
  check(
    'BACKUPCARDS-01 修正1: バックアップに購入コードが含まれる旨の注意文が見える',
    (await page.textContent('body')).includes('バックアップファイルには購入コードが含まれます'),
  )
  // REFRESH-APP-01: 「アプリの表示を修復する」ボタン(2026-07-16新設・2026-07-17修正4で文言全面改訂。
  // SWとキャッシュだけ消してリロードする安全機能)が③困ったときカードに存在し、消えるもの/残るものの
  // 説明があること。実際のSW解除・reloadはheadlessでの副作用が大きいため、ボタンとconfirm文言の
  // 存在確認までとし、クリックはしない(refreshApp()自体はscripts/test-logic.mjsのモックテストで検証済み)。
  check(
    'REFRESH-APP-01 「アプリの表示を修復する」ボタンが見える(2026-07-17文言変更)',
    (await page.textContent('body')).includes('アプリの表示を修復する'),
  )
  check(
    'REFRESH-APP-01 説明文に「消えるもの」「残るもの」の内訳がある(修正4)',
    (await page.textContent('body')).includes('消えるもの: 画面の一時ファイルだけです') &&
      (await page.textContent('body')).includes('残るもの: レシピ・価格・設定・購入コードなど'),
  )
  check(
    'REFRESH-APP-01 ブラウザのキャッシュクリアに関する注意(「Cookieと他のサイトデータ」)がある(修正4)',
    (await page.textContent('body')).includes('Cookieと他のサイトデータ」を消すとレシピなどのデータがすべて消えます'),
  )
  check(
    'REFRESH-APP-01 上書きボタン(前回の場所に上書き)はFile System Access API非対応のheadless環境では出ない',
    !(await page.textContent('body')).includes('前回の場所に上書き'),
  )
  // ?section=直リンクの自動スクロール(1本スクロール化後: タブ切り替えではなく該当節へ自動スクロール)。
  // 自動スクロールはSettingsPageの1マウントにつき一度だけ動く(scrolledToSectionRefのワンショット)ため、
  // 各?section=の検証の前に一度/recipesへ抜けてSettingsPageを再マウントさせ、毎回まっさらな状態で
  // 発火することを独立に確認する。unlock.html・NutritionTeaser・ホーム等の既存導線が使う互換パラメータ
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  // ?section=recipe は「レシピ」節へ自動スクロールする(テーマ全廃で ?section=themes は廃止したが、
  // 旧リンク互換として themes も recipe 節へ読み替えて着地させる=sectionDeepLinksのthemes→section-recipe)
  await page.goto(`${BASE}/#/settings?section=recipe`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  {
    const recipeSecTop = await settingsSectionTop('section-recipe')
    check(
      'SETTINGS-TAB-01 ?section=recipeはレシピ節へ自動スクロールする(見出しがDOMにあり上端付近)',
      (await page.textContent('body')).includes('レシピセットを読み込む') &&
        recipeSecTop !== null &&
        recipeSecTop >= -5 &&
        recipeSecTop < 220,
      `recipeSecTop=${recipeSecTop}`,
    )
  }
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  {
    const proSecTop = await settingsSectionTop('pro-section')
    const proSecAtBottom = await page.evaluate(
      () => window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 8,
    )
    check(
      'SETTINGS-TAB-01 ?section=proはPro節へ自動スクロールする(Pro版の見出しがDOMにあり上端付近か最下部)',
      (await page.textContent('body')).includes('Pro版') &&
        proSecTop !== null &&
        (proSecTop < 220 || proSecAtBottom),
      `proSecTop=${proSecTop} atBottom=${proSecAtBottom}`,
    )
  }
  check(
    'SETTINGS-TAB-01 1本スクロールなので?section=proでも全般節(NG食材)は同じページに存在する',
    (await page.textContent('body')).includes('NG食材（アレルギー・苦手）'),
  )

  // --- TOAST-01: 設定操作の結果メッセージがトーストで表示され、数秒で自動的に消える
  // (2026-07-12オーナー実機フィードバック。以前はページ最上部固定でスクロールしないと見えなかった。
  // 自動非表示は2026-07-13 UIペルソナQAで4.5秒→6秒に延長) ---
  currentCheck = 'TOAST-01'
  await page.getByRole('button', { name: '全般', exact: true }).click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('例: えび').fill('E2Eトースト確認食材')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'TOAST-01 NG食材追加でトーストが表示される',
    (await page.textContent('body')).includes('「E2Eトースト確認食材」を追加しました'),
  )
  check(
    'NGCOUNT-01 登録後は見出し行が「1件」表示になる(2026-07-17設定ゼロベース裁定#2)',
    (await page.textContent('body')).includes('1件'),
  )
  await page.waitForTimeout(6800) // Toastの自動非表示(AUTO_DISMISS_MS=6000ms)を超えて待つ
  check(
    'TOAST-01 トーストは数秒で自動的に消える',
    !(await page.textContent('body')).includes('「E2Eトースト確認食材」を追加しました'),
  )

  // --- STARTER-RELOAD-01: 「基本レシピを入れ直す」でユーザーデータが保持されること
  // (2026-07-13 Fable設計。従来は削除→再追加のため、基本レシピに付けたお気に入り・作った記録・
  // 写真・編集がすべて消えていた。同じtitleの基本レシピは内容だけ新版に差し替え、
  // お気に入り等は保持する方式に改修) ---
  currentCheck = 'STARTER-RELOAD-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'お気に入りに追加' }).click()
  await page.waitForTimeout(300)
  check(
    'STARTER-RELOAD-01 肉じゃがをお気に入りに追加できる',
    await page.getByRole('button', { name: 'お気に入りを解除' }).isVisible(),
  )

  await page.goto(`${BASE}/#/settings?section=recipe`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: '基本レシピを入れ直す', exact: true }).click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し完了のトーストが表示される',
    (await page.textContent('body')).includes('基本レシピを入れ直しました'),
  )

  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(500)
  check(
    'STARTER-RELOAD-01 入れ直し後もお気に入りのまま(ユーザーデータ保持)',
    await page.getByRole('button', { name: 'お気に入りを解除' }).isVisible(),
  )

  // --- SCROLL-01: 一覧のスクロール位置復元(iPhone SE2実機フィードバック 2026-07-11)。
  // 「詳細→戻る→スクロール位置が復元される」を、iOS Safari相当のwebkitエンジン+
  // iPhone SEのビューポート(375x667)で検証する(実機の不具合はwebkit固有の挙動だったため)。
  // 他のチェックと違うブラウザエンジンを使うので、ここだけ専用のbrowser/contextを開閉する ---
  currentCheck = 'SCROLL-01'
  {
    const wkBrowser = await webkit.launch()
    const wkContext = await wkBrowser.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage = await wkContext.newPage()
    wkPage.on('pageerror', (err) => {
      // Cloudflare計測ビーコンはlocalhostで常にCORSエラーになる既知の無害ノイズ。
      // webkitではconsoleではなくpageerrorとして表面化するため、こちらでも同様に除外する
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SCROLL-01] ${err.message}`)
    })
    try {
      await wkPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage.evaluate(() => window.scrollTo(0, 500))
      await wkPage.waitForTimeout(400) // スクロール位置保存(rAFスロットル)の反映待ち
      const scrollBefore = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 事前条件: 一覧がスクロールできている(iPhone SE相当)',
        scrollBefore > 100,
        `scrollY=${scrollBefore}`,
      )
      // Playwrightの.click()は要素を可視範囲へ自動スクロールしてしまい、テスト対象の
      // スクロール位置そのものを壊してしまうため、DOMのclick()を直接呼ぶ
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check('SCROLL-01 詳細へ遷移', /#\/recipes\/\d+/.test(wkPage.url()), `現在URL: ${wkPage.url()}`)
      await wkPage.getByRole('button', { name: '戻る' }).click()
      await wkPage.waitForTimeout(800)
      const scrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細→戻るで一覧のスクロール位置が復元される(iPhone SE 375x667・webkit)',
        Math.abs(scrollAfter - scrollBefore) < 60,
        `復元前=${scrollBefore} 復元後=${scrollAfter}`,
      )

      // --- 滞在時間バリエーション(2026-07-12深夜フィードバック「一定時間以上詳細画面に
      // いたとき一覧の位置がリセットされる感じ」の再現・再発防止ケース)。再調査の結果、
      // 実際のトリガーは滞在時間そのものではなく「離脱時に絞り込み条件が既定値でなかったこと」
      // だったが(下のSCROLL-02で別途固定)、時間経過そのものが無関係であることも
      // 恒久的に保証しておくため、実際に60秒待ってから戻る経路もここで検証する ---
      await wkPage.evaluate(() => window.scrollTo(0, 400))
      await wkPage.waitForTimeout(400)
      const longScrollBefore = await wkPage.evaluate(() => window.scrollY)
      await wkPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage.waitForTimeout(600)
      check(
        'SCROLL-01 (滞在60秒) 詳細へ遷移',
        /#\/recipes\/\d+/.test(wkPage.url()),
        `現在URL: ${wkPage.url()}`,
      )
      await wkPage.waitForTimeout(60000) // 詳細画面に実際に60秒滞在する
      await wkPage.getByRole('button', { name: '戻る' }).click()
      await wkPage.waitForTimeout(800)
      const longScrollAfter = await wkPage.evaluate(() => window.scrollY)
      check(
        'SCROLL-01 詳細に60秒滞在してから戻ってもスクロール位置が復元される',
        Math.abs(longScrollAfter - longScrollBefore) < 60,
        `復元前=${longScrollBefore} 復元後=${longScrollAfter}`,
      )
    } finally {
      await wkBrowser.close()
    }
  }

  // --- IPAD-01: iPadで「戻る」ヘッダーがマルチタスク操作ボタンに被らない
  // (オーナー実機フィードバック 2026-07-12: 「iPadから表示すると、画面サイズボタンと
  // 『戻る』ボタンが被る」→ iPad判定(:root.is-ipad)で上部に余白を足す対策の配線検証)。
  // PlaywrightのiPadエミュレーションはmaxTouchPoints=0を返すため、検出値は注入する
  // (検出式→クラス付与→CSS余白、の配線が壊れたら落ちる回帰テスト) ---
  currentCheck = 'IPAD-01'
  {
    const ipadBrowser = await webkit.launch()
    const ipadCtx = await ipadBrowser.newContext({
      viewport: { width: 820, height: 1180 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Safari/605.1.15',
    })
    const ipadPage = await ipadCtx.newPage()
    await ipadPage.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5 })
    })
    try {
      await ipadPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ipadPage.waitForTimeout(1800)
      check(
        'IPAD-01 iPad判定クラスが:rootに付く',
        await ipadPage.evaluate(() => document.documentElement.classList.contains('is-ipad')),
      )
      await ipadPage.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await ipadPage.waitForTimeout(600)
      const padTop = await ipadPage.evaluate(() => {
        const h = document.querySelector('.back-header')
        return h ? parseFloat(getComputedStyle(h).paddingTop) : -1
      })
      check('IPAD-01 戻るヘッダーに上部余白が付く(22px+)', padTop >= 22, `paddingTop=${padTop}`)
    } finally {
      await ipadBrowser.close()
    }
  }
  // 逆条件: 通常のスマホ(iPhone SE2相当)ではiPad用の余白が付かないこと(LOG-01のページで検証)

  // --- LOG-01: 「作った！」記録フォームの窓表示化(オーナー実機フィードバック 2026-07-12。
  // 「『作った！』の位置が最下層のため、押下すると画面全体の表示が動いて見づらい」
  // 「『作った！』の日付入力のバーの大きさが、はみだしている」の再発防止)。
  // ・押下前後でページのスクロール位置(window.scrollY)が変わらない(以前はインライン展開で
  //   scrollIntoViewが走り、レイアウトごと動いていた)
  // ・<input type="date">がiPhone SE2相当(375x667・webkit)の画面幅からはみ出さない
  // ・保存すると記録が一覧に反映される(既存の記録保存ロジックが壊れていないことの確認)
  currentCheck = 'LOG-01'
  {
    const wkBrowser2 = await webkit.launch()
    const wkContext2 = await wkBrowser2.newContext({ viewport: { width: 375, height: 667 } })
    const wkPage2 = await wkContext2.newPage()
    wkPage2.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-01] ${err.message}`)
    })
    try {
      await wkPage2.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await wkPage2.waitForTimeout(1800) // 初回シード完了待ち
      await wkPage2.evaluate(() => {
        const link = document.querySelector('a[href^="#/recipes/"]')
        if (link instanceof HTMLElement) link.click()
      })
      await wkPage2.waitForTimeout(600)
      await wkPage2.evaluate(() => window.scrollTo(0, 200))
      await wkPage2.waitForTimeout(300)
      const scrollBeforeOpen = await wkPage2.evaluate(() => window.scrollY)
      // 「作った！」はページ最下部のボタンなので、Playwrightの.click()に任せると
      // 可視範囲へ自動スクロールしてしまい検証したいスクロール位置そのものを壊す(SCROLL-01と同じ理由)。
      // DOMのclick()を直接呼んでスクロールを発生させない
      await wkPage2.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await wkPage2.waitForTimeout(400)
      const dialogText = await wkPage2.textContent('body')
      check('LOG-01 「作った！」で窓(モーダル)が開く', dialogText.includes('作った記録をつける'))
      const scrollAfterOpen = await wkPage2.evaluate(() => window.scrollY)
      check(
        'LOG-01 窓を開いてもページのスクロール位置が変わらない',
        scrollAfterOpen === scrollBeforeOpen,
        `開く前=${scrollBeforeOpen} 開いた後=${scrollAfterOpen}`,
      )
      const dateBox = await wkPage2.locator('input[type="date"]').boundingBox()
      check(
        'LOG-01 日付入力が画面幅(375px)からはみ出さない',
        !!dateBox && dateBox.x >= 0 && dateBox.x + dateBox.width <= 375,
        `x=${dateBox?.x} width=${dateBox?.width}`,
      )
      // 窓(モーダル)の保存ボタンは「記録する」(過去記録を後から編集するときの「保存する」とは別物)
      await wkPage2.getByRole('button', { name: '記録する', exact: true }).click()
      await wkPage2.waitForTimeout(500)
      const savedText = await wkPage2.textContent('body')
      check('LOG-01 保存すると「作った記録」に反映される', savedText.includes('作った記録'))
    } finally {
      await wkBrowser2.close()
    }
  }

  // --- LOG-PHOTO-01: 「作った！」記録への写真添付(2026-07-12・docs/20 §4)。
  // ・写真を選ぶと窓(CookedLogModal)内にプレビューが出て、保存すると記録一覧に64pxサムネイルが出る
  // ・サムネイルをタップすると原寸表示の窓が開く
  // ・記録フォームを開いた時点の表示人数(スケール後)がcookedLogs[].servingsに自動記録される
  // ・圧縮後の写真がcookedLogs[].photoとしてIndexedDBに実際に保存されている(Blobで実サイズ>0) ---
  currentCheck = 'LOG-PHOTO-01'
  {
    // 1x1の最小PNG(透明ドット)。resizePhoto(createImageBitmap→canvas.toBlob)が
    // 実際にデコードできる本物の画像である必要があるため、テキストダミーではなくPNGを使う
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const photoBrowser = await chromium.launch()
    const photoContext = await photoBrowser.newContext()
    const photoPage = await photoContext.newPage()
    photoPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@LOG-PHOTO-01] ${err.message}`)
    })
    try {
      await photoPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await photoPage.waitForTimeout(1800) // 初回シード完了待ち
      await photoPage.getByText('肉じゃが', { exact: true }).first().click()
      await photoPage.waitForTimeout(600)

      // 表示人数を既定から1つ増やしてから記録を開く(自動記録される人数がこの値と一致するか確認するため)
      const servingsBefore = await photoPage.locator('span.min-w-14').textContent()
      const servingsBeforeNum = Number((servingsBefore ?? '').match(/\d+/)?.[0])
      await photoPage.locator('button[aria-label="人数を増やす"]').click()
      await photoPage.waitForTimeout(300)
      const expectedServings = servingsBeforeNum + 1

      await photoPage.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(
          (b) => b.textContent?.trim() === '作った！',
        )
        if (btn instanceof HTMLElement) btn.click()
      })
      await photoPage.waitForTimeout(400)

      // 「アルバムから選ぶ」用のinput(capture属性が無い方)にテスト画像を投入する
      await photoPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: tinyPng })
      await photoPage.waitForTimeout(500)
      const previewVisible = await photoPage
        .locator('div[role="dialog"] img')
        .first()
        .isVisible()
        .catch(() => false)
      check('LOG-PHOTO-01 写真を選ぶと窓内にプレビューが出る', previewVisible)

      await photoPage.getByRole('button', { name: '記録する', exact: true }).click()
      await photoPage.waitForTimeout(500)
      const thumbButton = photoPage.locator('button[aria-label="写真を拡大表示"]').first()
      check('LOG-PHOTO-01 保存すると記録一覧にサムネイルが出る', await thumbButton.isVisible())

      await thumbButton.click()
      await photoPage.waitForTimeout(300)
      const viewerVisible = await photoPage
        .locator('div[role="dialog"][aria-label="写真を拡大表示"]')
        .isVisible()
        .catch(() => false)
      check('LOG-PHOTO-01 サムネイルをタップすると原寸表示の窓が開く', viewerVisible)
      await photoPage.keyboard.press('Escape')
      await photoPage.waitForTimeout(300)
      const viewerClosed = !(await photoPage
        .locator('div[role="dialog"][aria-label="写真を拡大表示"]')
        .isVisible()
        .catch(() => false))
      check('LOG-PHOTO-01 Escapeで原寸表示の窓が閉じる', viewerClosed)

      // IndexedDBを直接読み、圧縮後の写真Blobと自動記録された人数が実際に保存されていることを確認する
      const url = photoPage.url()
      const recipeId = Number(url.match(/#\/recipes\/(\d+)/)?.[1])
      const savedLog = await photoPage.evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getReq = tx.objectStore('recipes').get(id)
              getReq.onsuccess = () => {
                const recipe = getReq.result
                const log = recipe?.cookedLogs?.[0]
                resolve(
                  log
                    ? { hasPhoto: log.photo instanceof Blob, photoSize: log.photo?.size ?? 0, servings: log.servings }
                    : null,
                )
              }
              getReq.onerror = () => reject(getReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        recipeId,
      )
      check(
        'LOG-PHOTO-01 保存された記録に圧縮後の写真Blob(実サイズ>0)が入っている',
        !!savedLog?.hasPhoto && savedLog.photoSize > 0,
        `savedLog=${JSON.stringify(savedLog)}`,
      )
      check(
        'LOG-PHOTO-01 記録フォームを開いた時点の表示人数が自動記録される',
        savedLog?.servings === expectedServings,
        `期待=${expectedServings} 実際=${savedLog?.servings}`,
      )

      // --- LOG-EDIT-PHOTO-01(2026-07-16 便W-①): 既存記録の編集フローからも写真の削除・
      // 追加(差し替え)ができること(新規作成時のCookedLogModalと同じ保存形式)。直前に
      // 作った写真付きの記録(index 0)を使い、削除→保存→サムネ消滅、再度編集で追加→保存→
      // サムネ再出現、の一往復を確認する ---
      await photoPage.locator('button[aria-label="この記録を編集"]').first().click()
      await photoPage.waitForTimeout(300)
      const removePhotoBtn = photoPage.getByRole('button', { name: 'この記録の写真を削除' })
      check('LOG-EDIT-PHOTO-01 編集を開くと既存の写真の削除ボタンが出る', await removePhotoBtn.isVisible())
      await removePhotoBtn.click()
      await photoPage.waitForTimeout(200)
      check(
        'LOG-EDIT-PHOTO-01 削除すると削除ボタン自体も消える(未選択状態になる)',
        !(await removePhotoBtn.isVisible().catch(() => false)),
      )
      await photoPage.getByRole('button', { name: '保存する', exact: true }).click()
      await photoPage.waitForTimeout(400)
      check(
        'LOG-EDIT-PHOTO-01 削除して保存すると記録一覧のサムネイルが消える',
        (await photoPage.locator('button[aria-label="写真を拡大表示"]').count()) === 0,
      )

      // 再度編集を開き、今度はアルバムから新しい写真を選んで追加(差し替え)する
      await photoPage.locator('button[aria-label="この記録を編集"]').first().click()
      await photoPage.waitForTimeout(300)
      await photoPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test2.png', mimeType: 'image/png', buffer: tinyPng })
      // 画像はresizePhoto(canvas圧縮)を経由して非同期にstateへ入るため、固定500msでは
      // スイート負荷時に間に合わないことがある(単体では動作確認済み)。出現をポーリング待ちにする
      const reAddRemoveBtn = photoPage.getByRole('button', { name: 'この記録の写真を削除' })
      await reAddRemoveBtn.waitFor({ state: 'visible', timeout: 8000 }).catch(() => {})
      check(
        'LOG-EDIT-PHOTO-01 編集中に写真を選ぶとプレビューが出る',
        await reAddRemoveBtn.isVisible(),
      )
      await photoPage.getByRole('button', { name: '保存する', exact: true }).click()
      await photoPage.waitForTimeout(400)
      const reAddedThumb = photoPage.locator('button[aria-label="写真を拡大表示"]').first()
      check('LOG-EDIT-PHOTO-01 追加して保存すると記録一覧にサムネイルが再び出る', await reAddedThumb.isVisible())

      const reAddedUrl = photoPage.url()
      const reAddedRecipeId = Number(reAddedUrl.match(/#\/recipes\/(\d+)/)?.[1])
      const reAddedLog = await photoPage.evaluate(
        (id) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('recipes', 'readonly')
              const getReq = tx.objectStore('recipes').get(id)
              getReq.onsuccess = () => {
                const recipe = getReq.result
                const log = recipe?.cookedLogs?.[0]
                resolve(log ? { hasPhoto: log.photo instanceof Blob, photoSize: log.photo?.size ?? 0 } : null)
              }
              getReq.onerror = () => reject(getReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        reAddedRecipeId,
      )
      check(
        'LOG-EDIT-PHOTO-01 編集で追加した写真も圧縮後Blob(実サイズ>0)としてIndexedDBに保存される' +
          '(新規作成時と同じ保存形式)',
        !!reAddedLog?.hasPhoto && reAddedLog.photoSize > 0,
        `reAddedLog=${JSON.stringify(reAddedLog)}`,
      )
    } finally {
      await photoBrowser.close()
    }
  }

  // --- NUT-02: 栄養価のめやす(Pro解錠済み)。5項目の実パネル(たんぱく質・脂質・炭水化物を含む)が
  // 出ること、人数を変えても「1人分」の値は変わらないこと(全量だけが連動する)を確認する。
  // 実際のPro解錠コード(UR-...)は販売台帳の原本なのでリポジトリにコミットできないため、
  // ここではsettings.proCodeをIndexedDBへ直接書き込んで「解錠済み」状態だけを再現する
  // (コード検証ロジック自体はscripts/test-logic.mjsで別途確認済み)。他チェックのPro状態に
  // 影響しないよう、専用のbrowser/contextで完結させる(M6-1 2026-07-12) ---
  currentCheck = 'NUT-02'
  {
    const nutBrowser = await chromium.launch()
    const nutContext = await nutBrowser.newContext()
    const nutPage = await nutContext.newPage()
    nutPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NUT-02] ${err.message}`)
    })
    try {
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await nutPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            const putReq = store.put({ ...current, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await nutPage.reload({ waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.getByText('肉じゃが', { exact: true }).first().click()
      await nutPage.waitForTimeout(600)
      await nutPage.getByRole('button', { name: '栄養価のめやすを詳しく見る' }).click()
      await nutPage.waitForTimeout(300)
      const unlockedText = await nutPage.textContent('body')
      check('NUT-02 Pro解錠済みでたんぱく質が表示される', unlockedText.includes('たんぱく質'))
      check('NUT-02 Pro解錠済みで脂質が表示される', unlockedText.includes('脂質'))
      check('NUT-02 Pro解錠済みで炭水化物が表示される', unlockedText.includes('炭水化物'))
      check('NUT-02 Pro解錠済みで塩分相当量が表示される', unlockedText.includes('塩分相当量'))
      // 2026-07-13 第2弾(オーナー承認): 食物繊維(g)・鉄(mg)・カルシウム(mg)の3項目とビタミン注記
      check('NUT-02 Pro解錠済みで食物繊維が表示される', unlockedText.includes('食物繊維'))
      check('NUT-02 Pro解錠済みで鉄がmg単位で表示される', /鉄\s*[\d,.]+\s*mg/.test(unlockedText))
      check('NUT-02 Pro解錠済みでカルシウムがmg単位で表示される', /カルシウム\s*[\d,.]+\s*mg/.test(unlockedText))
      check(
        'NUT-02 ビタミン非表示の注記が出る(文面はオーナー確定・一字一句)',
        unlockedText.includes('ビタミンは調理による損失が大きく、材料からの計算では実際と大きくズレやすいため表示していません'),
      )
      check('NUT-02 断定しない「概算」バッジが出る', unlockedText.includes('概算'))
      check('NUT-02 「1人分」の内訳がある', unlockedText.includes('1人分'))
      check('NUT-02 「全量」の内訳もある(人数連動)', unlockedText.includes('全量'))

      // 人数を変えても「1人分」のエネルギーは変わらない(servings連動の検算。全量側だけが連動する)
      const perMatchBefore = unlockedText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      await nutPage.locator('button[aria-label="人数を増やす"]').click()
      await nutPage.waitForTimeout(400)
      const afterServingsText = await nutPage.textContent('body')
      const perMatchAfter = afterServingsText.match(/エネルギー\s*([\d,]+)\s*kcal/)
      check(
        'NUT-02 人数を変えても1人分のエネルギーは変わらない',
        !!perMatchBefore && !!perMatchAfter && perMatchBefore[1] === perMatchAfter[1],
        `変更前=${perMatchBefore?.[1]} 変更後=${perMatchAfter?.[1]}`,
      )

      // --- NUTSORT-02: 栄養並び替え(Pro解錠済み・2026-07-13 Fable設計→2026-07-16 便T-4で
      // カロリー・たんぱく質・塩分・脂質・糖質の5項目に拡張しPro機能化)。Pro解錠済みでは
      // 並び替えパネルに「栄養価で並び替え」区分と5項目が出ること、カロリー順の既定は昇順で
      // 算出不能レシピ(材料が成分表に名寄せできない自作レシピ)は昇順・降順とも末尾に回ること、
      // たんぱく質順の既定は降順(多い方から)であること、栄養価順の間はレシピカードに
      // 並び替え中の栄養価の値がラベル付き(「カロリー: ◯kcal」「たんぱく質: ◯g」)で
      // 表示されること(便T-7・2026-07-16 便T-7-2でラベル付き表示に変更)を確認する。
      // NUT-02と同じ解錠済みcontextを使う(無料側でティーザーだけになることはNUTSORT-01で検証済み) ---
      currentCheck = 'NUTSORT-02'
      // 算出不能なレシピを1件作る(材料名が成分表のどの食品にも名寄せできない)
      await nutPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(500)
      await nutPage.getByPlaceholder('例: 肉じゃが').fill('E2E栄養並び替え確認レシピ')
      await nutPage.getByPlaceholder('例: じゃがいも').first().fill('謎のたべもの')
      await nutPage
        .getByPlaceholder('例: じゃがいもを一口大に切る')
        .first()
        .fill('謎のたべものを盛り付ける')
      await nutPage.getByRole('button', { name: '保存する' }).click()
      await nutPage.waitForTimeout(800)
      await nutPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nutPage.waitForTimeout(800)
      await nutPage.locator('button[aria-label="並び替え"]').click()
      await nutPage.waitForTimeout(300)
      const proSortPanelText = await nutPage.textContent('body')
      check(
        'NUTSORT-02 Pro解錠済みでは「栄養価で並び替え」の区分見出しが出る',
        proSortPanelText.includes('栄養価で並び替え'),
      )
      check(
        'NUTSORT-02 Pro解錠済みではグレーのティーザー行(Pro機能)は出ない',
        !proSortPanelText.includes('栄養価で並び替え（Pro機能）'),
      )
      const proNutrientButtons = await nutPage.evaluate(() => {
        const names = ['カロリー', 'たんぱく質', '塩分', '脂質', '糖質']
        const buttons = Array.from(document.querySelectorAll('button'))
        return names.filter((n) => buttons.some((b) => b.textContent?.trim() === n))
      })
      check(
        'NUTSORT-02 Pro解錠済みでは栄養価5項目すべてが選択肢に出る',
        proNutrientButtons.length === 5,
        `出た項目=${JSON.stringify(proNutrientButtons)}`,
      )
      // カロリー順: 既定は昇順(低い方から)。算出不能レシピは昇順・降順とも末尾
      await nutPage.getByRole('button', { name: 'カロリー', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalAscActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '昇順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 カロリー順の既定は昇順(低い方から)', kcalAscActive)
      const nutCardTitles = () =>
        nutPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"] p.font-bold').allTextContents()
      const kcalAscTitles = await nutCardTitles()
      check(
        'NUTSORT-02 算出不能なレシピは昇順で末尾に回る',
        kcalAscTitles.length > 1 &&
          kcalAscTitles[kcalAscTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
        `末尾=${kcalAscTitles[kcalAscTitles.length - 1]}`,
      )
      // 便T-7-2(2026-07-16オーナー指示): カロリー順の間、グリッドカードの左上に
      // 「カロリー: ◯kcal」のラベル付きの値が出る。算出不能レシピには出ない
      const kcalBadgeInfo = await nutPage.evaluate(() => {
        const links = Array.from(document.querySelectorAll('div.grid.grid-cols-2 a')).filter((a) =>
          /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
        )
        const badgeOf = (a) =>
          Array.from(a.querySelectorAll('span')).find((s) =>
            /^カロリー: \d+(\.\d+)?kcal$/.test(s.textContent?.trim() ?? ''),
          )
        const unknownCard = links.find((a) => a.textContent?.includes('E2E栄養並び替え確認レシピ'))
        return {
          total: links.length,
          withBadge: links.filter((a) => badgeOf(a)).length,
          unknownHasBadge: unknownCard ? !!badgeOf(unknownCard) : null,
        }
      })
      check(
        'NUTSORT-02 カロリー順の間、カードに「カロリー: ◯kcal」のラベル付きの値が表示される(便T-7-2)',
        kcalBadgeInfo.withBadge > 0,
        `バッジ付き=${kcalBadgeInfo.withBadge}/${kcalBadgeInfo.total}`,
      )
      check(
        'NUTSORT-02 算出不能なレシピのカードには値バッジが出ない',
        kcalBadgeInfo.unknownHasBadge === false,
        `unknownHasBadge=${kcalBadgeInfo.unknownHasBadge}`,
      )
      await nutPage.getByRole('button', { name: '降順', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const kcalDescTitles = await nutCardTitles()
      check(
        'NUTSORT-02 降順でも算出不能なレシピは末尾のまま',
        kcalDescTitles.length > 1 &&
          kcalDescTitles[kcalDescTitles.length - 1] === 'E2E栄養並び替え確認レシピ',
        `末尾=${kcalDescTitles[kcalDescTitles.length - 1]}`,
      )
      check(
        'NUTSORT-02 昇順と降順で先頭が入れ替わる(実際にカロリー順で並んでいる)',
        kcalAscTitles.length > 1 && kcalAscTitles[0] !== kcalDescTitles[0],
        `昇順先頭=${kcalAscTitles[0]} 降順先頭=${kcalDescTitles[0]}`,
      )
      // たんぱく質順: 既定は降順(多い方から)。カードの値は「たんぱく質: ◯g」表記になる(便T-7-2)
      await nutPage.getByRole('button', { name: 'たんぱく質', exact: true }).click()
      await nutPage.waitForTimeout(500)
      const proteinDescActive = await nutPage.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const target = buttons.find((b) => b.textContent?.trim() === '降順')
        return target ? target.className.includes('border-accent') : false
      })
      check('NUTSORT-02 たんぱく質順の既定は降順(多い方から)', proteinDescActive)
      const countGramBadges = () =>
        nutPage.evaluate(() => {
          const links = Array.from(document.querySelectorAll('a')).filter((a) =>
            /^#\/recipes\/\d+$/.test(a.getAttribute('href') ?? ''),
          )
          return links.filter((a) =>
            Array.from(a.querySelectorAll('span')).some((s) =>
              /^たんぱく質: \d+(\.\d+)?g$/.test(s.textContent?.trim() ?? ''),
            ),
          ).length
        })
      check(
        'NUTSORT-02 たんぱく質順の間はカードの値が「たんぱく質: ◯g」表記になる(便T-7-2)',
        (await countGramBadges()) > 0,
      )
      const proteinTitles = await nutCardTitles()
      check(
        'NUTSORT-02 たんぱく質順でも一覧が表示される(console/pageerror監視でエラー0を担保)',
        proteinTitles.length > 0,
      )
      // 便T-7: 一覧(リスト)表示に切り替えても並び替え中の栄養価の値(行の右下)が出る
      await nutPage.locator('button[aria-label="リスト表示に切り替え"]').click()
      await nutPage.waitForTimeout(400)
      check(
        'NUTSORT-02 一覧(リスト)表示でも並び替え中の栄養価の値が出る(便T-7)',
        (await countGramBadges()) > 0,
      )
      await nutPage.locator('button[aria-label="グリッド表示に切り替え"]').click()
      await nutPage.waitForTimeout(300)
    } finally {
      await nutBrowser.close()
    }
  }

  // --- UNLOCK-01(2026-07-17設定ゼロベース裁定#4+#7の「購入と解錠」を継承→2026-07-22全無料化で
  // Pro(UR-)専用化): 収録レシピは全て無料になり、追加レシピパック(UP-)は製品廃止したため、
  // 受け付ける解錠コードはPro(UR-)のみになった。
  // (a) UR-以外のprefix・廃止したUP-パックコードはコード形式エラーになること・UR-でPro版が解錠でき
  //     解錠済みコードがマスク表示(UR-****2VSZ)+コピーで控えられること(クリップボードの実文字列まで
  //     確認)を、専用のbrowser/contextで確認する。テスト用コードはdocs/22記載・販売用ではない:
  //     Pro=UR-96QS-2VSZ。廃止したUP-2W3D-QZPRはもう解錠されないこと(コード形式エラー)も確認する
  // (b) Pro解錠済みのときは入力欄自体が消え、Pro版の機能一覧が解錠中ずっと表示され続けることを、
  //     別の専用browser/contextで確認する ---
  currentCheck = 'UNLOCK-01'
  {
    // (a) コード解錠の種別判定+マスク表示+コピー(Pro=UR-のみ有効)
    const ulBrowser = await chromium.launch()
    try {
      const ulContext = await ulBrowser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] })
      const ulPage = await ulContext.newPage()
      ulPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@UNLOCK-01(a)] ${err.message}`)
      })
      await ulPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ulPage.waitForTimeout(1800) // 初回シード完了待ち
      await ulPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await ulPage.waitForTimeout(800)

      check(
        'UNLOCK-01(a) 「購入と解錠」カードがある',
        (await ulPage.textContent('body')).includes('購入と解錠'),
      )
      check(
        'UNLOCK-01(a) 解錠前はPro版が「未解錠」表示(パック行は撤去済みで1つだけ)',
        (await ulPage.getByText('未解錠').count()) === 1,
      )

      const unlockInput = ulPage.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)')
      const unlockButton = ulPage.getByRole('button', { name: '解錠する', exact: true })

      // UR-以外のprefixはコード形式エラー
      await unlockInput.fill('XX-0000-0000')
      await unlockButton.click()
      await ulPage.waitForTimeout(500)
      check(
        'UNLOCK-01(a) UR-以外のprefixはコード形式エラーになる',
        (await ulPage.textContent('body')).includes('コードの形式が正しくありません'),
      )

      // 廃止したUP-パックコードももう受け付けない(2026-07-22全無料化・パック製品廃止でコード形式エラー扱い)
      await unlockInput.fill('UP-2W3D-QZPR')
      await unlockButton.click()
      await ulPage.waitForTimeout(500)
      const afterPackText = await ulPage.textContent('body')
      check(
        'UNLOCK-01(a) 廃止したUP-パックコードは受け付けない(コード形式エラー)',
        afterPackText.includes('コードの形式が正しくありません'),
      )
      check(
        'UNLOCK-01(a) UP-では解錠されない(解錠のお礼文言は出ない)',
        !afterPackText.includes('ご利用いただきありがとうございます'),
      )

      // UR-コードでPro版が解錠される
      await unlockInput.fill('UR-96QS-2VSZ')
      await unlockButton.click()
      await ulPage.waitForTimeout(800)
      const afterProText = await ulPage.textContent('body')
      check(
        'UNLOCK-01(a) UR-コードでPro版が解錠される',
        afterProText.includes('Pro版をご利用いただきありがとうございます'),
      )
      check(
        'UNLOCK-01(a) 解錠済みコードはマスク表示される(末尾4文字のみ・UR-****2VSZ)',
        afterProText.includes('UR-****2VSZ'),
      )
      check(
        'UNLOCK-01(a) Pro解錠後は入力欄が消える(Pro版がすべて含むため)',
        !(await unlockInput.isVisible().catch(() => false)),
      )

      // コピーボタンで生のコードがクリップボードへ入ること
      await ulPage.getByRole('button', { name: 'コピー', exact: true }).first().click()
      await ulPage.waitForTimeout(300)
      const copiedText = await ulPage.evaluate(() => navigator.clipboard.readText())
      check(
        'UNLOCK-01(a) コピーボタンで生のコードがクリップボードにコピーされる',
        copiedText === 'UR-96QS-2VSZ',
        `copiedText=${copiedText}`,
      )
      check(
        'UNLOCK-01(a) コピー後は「コピーしました」表示になる',
        (await ulPage.textContent('body')).includes('コピーしました'),
      )
    } finally {
      await ulBrowser.close()
    }

    // (b) Pro解錠済み。実際のPro解錠コードは販売台帳の原本なのでリポジトリにコミットできないため、
    // NUT-02と同様settings.proCodeをIndexedDBへ直接書き込んで再現する(コード検証自体は(a)で実UI経由済み)
    const ulbBrowser = await chromium.launch()
    try {
      const ulbContext = await ulbBrowser.newContext()
      const ulbPage = await ulbContext.newPage()
      ulbPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@UNLOCK-01(b)] ${err.message}`)
      })
      await ulbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ulbPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await ulbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            const putReq = store.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await ulbPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await ulbPage.waitForTimeout(800)
      const proSectionText = await ulbPage.textContent('body')
      check(
        'UNLOCK-01(b) Pro解錠済み時は入力欄自体が表示されない(旧: disabled入力の後継)',
        !(await ulbPage.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)').isVisible()),
      )
      check(
        'UNLOCK-01(b) Pro版の機能一覧が解錠中ずっと表示される(2026-07-13 UI改善: 一時表示から常設化)',
        proSectionText.includes('使えるようになった機能') && proSectionText.includes('並行調理ナビ'),
      )
    } finally {
      await ulbBrowser.close()
    }
  }

  // --- TOPUP-01: 既存ユーザーへの差分投入(テーマ全廃2026-07-23)。テーマ全廃より前に初回シード済みの
  // 端末には旧テーマ由来の基本レシピがまだ無いため、アップデート後の起動時に「不足分だけ」1回投入する
  // (topUpFlattenedStartersIfNeeded)。IndexedDBを直接いじって「アップデート前の端末」を再現し:
  //  (1) 削除済み(トゥームストーン記録あり)の品は差分投入で復活させない(削除した品を復活させない)
  //  (2) 未削除で不足している品は差分投入で戻る
  //  (3) 差分投入は1回だけ(starterFlattenSeededフラグ)で、二重投入されない
  // を確認する。旧TOMB-01(テーマ取り込み→削除→再取込のトゥームストーン)はテーマUI撤去に伴い、
  // トゥームストーンを尊重する経路を差分投入側で検証する形へ置き換えた。専用のbrowser/contextで完結させる ---
  currentCheck = 'TOPUP-01'
  {
    const tuBrowser = await chromium.launch()
    const tuContext = await tuBrowser.newContext()
    const tuPage = await tuContext.newPage()
    tuPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TOPUP-01] ${err.message}`)
    })
    try {
      await tuPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2200) // 初回シード完了待ち(103品・starterFlattenSeeded=true)

      // 「アップデート前の端末」を再現する: 旧テーマ由来の2品を消し、うち1品にトゥームストーン記録を残し、
      // 差分投入フラグ(starterFlattenSeeded)を未実施状態(false)に戻す。starterSeeded自体はtrueのまま
      const REVIVE = 'レンジ蒸し鶏（自家製サラダチキン）' // 旧kintore由来・トゥームストーン無し→戻るはず
      const DELETED = 'だしのとり方' // 旧summer由来・トゥームストーンあり→戻らないはず
      await tuPage.evaluate(
        ({ revive, deleted }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['recipes', 'setExclusions', 'settings'], 'readwrite')
              const recipes = tx.objectStore('recipes')
              const getAll = recipes.getAll()
              getAll.onsuccess = () => {
                for (const r of getAll.result) {
                  if (r.title === revive || r.title === deleted) recipes.delete(r.id)
                }
                // 削除した品にはトゥームストーン(再取込除外)記録を残す
                tx.objectStore('setExclusions').add({
                  setId: 'summer',
                  title: deleted,
                  excludedAt: Date.now(),
                })
                // 差分投入フラグを未実施へ戻す(starterSeededはtrueのまま=アップデート前の既存端末)
                const settings = tx.objectStore('settings')
                const getS = settings.get(1)
                getS.onsuccess = () => {
                  settings.put({ ...(getS.result || { id: 1 }), id: 1, starterFlattenSeeded: false })
                }
              }
              tx.oncomplete = () => {
                idb.close()
                resolve(undefined)
              }
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { revive: REVIVE, deleted: DELETED },
      )

      const countTitles = () =>
        tuPage.evaluate(
          ({ revive, deleted }) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('recipes', 'readonly')
                const getAll = tx.objectStore('recipes').getAll()
                getAll.onsuccess = () => {
                  const rs = getAll.result
                  resolve({
                    total: rs.length,
                    hasRevive: rs.some((r) => r.title === revive),
                    hasDeleted: rs.some((r) => r.title === deleted),
                  })
                }
                getAll.onerror = () => reject(getAll.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { revive: REVIVE, deleted: DELETED },
        )

      const before = await countTitles()
      check(
        'TOPUP-01 前提: アップデート前状態を再現(2品削除・101品)',
        before.total === 101 && !before.hasRevive && !before.hasDeleted,
        `before=${JSON.stringify(before)}`,
      )

      // アップデート後の起動を再現: フルリロードで App が再マウントされ topUpFlattenedStartersIfNeeded
      // が実行される(同じhash URLへの goto は文書を再読み込みしないため reload を使う)
      await tuPage.reload({ waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2200)
      const after = await countTitles()
      check(
        'TOPUP-01 差分投入: 未削除で不足していた品は戻る',
        after.hasRevive,
        `after=${JSON.stringify(after)}`,
      )
      check(
        'TOPUP-01 差分投入: トゥームストーンのある削除済みの品は復活させない',
        !after.hasDeleted,
        `after=${JSON.stringify(after)}`,
      )
      check(
        'TOPUP-01 差分投入は不足分だけ(101→102・二重投入しない)',
        after.total === 102,
        `total=${after.total}`,
      )

      // もう一度リロードしても差分投入は再実行されない(starterFlattenSeededフラグで1回だけ)
      await tuPage.reload({ waitUntil: 'networkidle' })
      await tuPage.waitForTimeout(2000)
      const again = await countTitles()
      check(
        'TOPUP-01 差分投入は1回だけ(再起動しても件数が増えない)',
        again.total === 102,
        `total=${again.total}`,
      )
    } finally {
      await tuBrowser.close()
    }
  }

  // --- ORPHAN-01: レシピ削除で週間献立・今日の献立に孤児が残らない(2026-07バグ修正・deleteRecipe)。
  // deleteRecipeは同一トランザクションで当該レシピを指すmealPlans/todayListの行も消す。テーマ全廃
  // (2026-07-23)でテーマ一括削除UIは撤去したため、1品削除(編集画面の「このレシピを削除」)で
  // 孤児掃除が効くことを検証する形へ置き換えた。基本レシピ(肉じゃが)を週間献立・今日の献立の
  // 両方に登録してから削除し、両テーブルから該当行が消えている(IndexedDB直読み)ことを確認する。
  // 週間献立への登録はUIのピッカー経路が長い(MEALPLAN-01/02で別途検証済み)ため、実データ形状に
  // 合わせてIndexedDBへ直接1行だけ書き込んで再現する。他チェックに影響しないよう専用のcontextで完結 ---
  currentCheck = 'ORPHAN-01'
  {
    const obBrowser = await chromium.launch()
    const obContext = await obBrowser.newContext()
    const obPage = await obContext.newPage()
    obPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@ORPHAN-01] ${err.message}`)
    })
    obPage.on('dialog', (dialog) => dialog.accept())
    try {
      await obPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(2200) // 初回シード完了待ち

      // 1) 基本レシピ(肉じゃが)を開いて「今日の献立に追加」し、そのidを控える
      await obPage.getByText('肉じゃが', { exact: true }).first().click()
      await obPage.waitForTimeout(500)
      const targetRecipeId = Number(obPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await obPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await obPage.waitForTimeout(300)
      // 2026-07-17 便Z-1: ボタン押下でスロット振り分け窓が開く。従来どおりの直接追加(枠なし)は「決めない」
      await obPage.getByRole('button', { name: '決めない' }).click()
      await obPage.waitForTimeout(300)

      // 2) 同じレシピを週間献立にも登録する(IndexedDB直接書き込み。理由は上のコメント参照)
      await obPage.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction('mealPlans', 'readwrite')
              const addReq = tx.objectStore('mealPlans').add({
                date: '2026-08-01',
                slot: 'dinner',
                recipeId,
                role: 'main',
              })
              addReq.onsuccess = () => resolve(undefined)
              addReq.onerror = () => reject(addReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
        targetRecipeId,
      )

      const countByRecipeId = (storeName) =>
        obPage.evaluate(
          ({ storeName, recipeId }) =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(storeName, 'readonly')
                const getAllReq = tx.objectStore(storeName).getAll()
                getAllReq.onsuccess = () =>
                  resolve(getAllReq.result.filter((row) => row.recipeId === recipeId).length)
                getAllReq.onerror = () => reject(getAllReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { storeName, recipeId: targetRecipeId },
        )

      // 前提確認: 削除前は両テーブルに対象レシピの行が実在する
      check('ORPHAN-01 前提: 今日の献立に対象レシピの行がある', (await countByRecipeId('todayList')) === 1)
      check('ORPHAN-01 前提: 週間献立に対象レシピの行がある', (await countByRecipeId('mealPlans')) === 1)

      // 3) 対象レシピを編集画面の「このレシピを削除」で削除する(確認ダイアログは自動承諾)
      await obPage.goto(`${BASE}/#/recipes/${targetRecipeId}/edit`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(600)
      await obPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await obPage.waitForTimeout(800)

      // 4) 孤児が残っていない: 週間献立・今日の献立のどちらにも対象レシピの行が無い
      check(
        'ORPHAN-01 レシピ削除後、今日の献立に孤児が残らない',
        (await countByRecipeId('todayList')) === 0,
      )
      check(
        'ORPHAN-01 レシピ削除後、週間献立に孤児が残らない',
        (await countByRecipeId('mealPlans')) === 0,
      )

      // 孤児データが残っていた場合の描画クラッシュも合わせて検出する(画面上は普通に表示される)
      await obPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await obPage.waitForTimeout(600)
      check(
        'ORPHAN-01 献立タブが孤児データでクラッシュせず表示される',
        (await obPage.textContent('body')).includes('今日の献立'),
      )
    } finally {
      await obBrowser.close()
    }
  }

  // --- TODAYALL-01: 「全て作った！」で記録の追加とリストのクリアが一括で反映される
  // (2026-07バグ修正)。従来はmarkAllTodayListCookedが記録ループ(addCookedLog)と
  // db.todayList.clear()を別トランザクションで行っていたため、途中で中断すると
  // 「一部だけ記録されてリストは残る/消える」不整合が起き得た。1つのトランザクションに
  // まとめたことで、正常系では記録とクリアが必ず両方揃って反映されることを確認する
  // (黒箱のE2Eではトランザクション途中の強制中断は再現できないため、原子性そのものは
  // markTodayListCookedと同じreentrantトランザクション方式であることをコードレビューで
  // 担保し、ここでは正常系の一括反映が壊れていないことを回帰確認する) ---
  currentCheck = 'TODAYALL-01'
  {
    const taBrowser = await chromium.launch()
    const taContext = await taBrowser.newContext()
    const taPage = await taContext.newPage()
    taPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@TODAYALL-01] ${err.message}`)
    })
    try {
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(1800) // 初回シード完了待ち

      // 基本レシピ2品(肉じゃが・カレーライス)を「今日の献立に追加」ボタンで追加する
      // (2026-07-17 便Z-1: ボタン押下でスロット振り分け窓が開くようになったため、
      // 従来どおりの直接追加=「決めない」を選ぶ1手が増えた)
      await taPage.getByText('肉じゃが', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await taPage.waitForTimeout(300)
      await taPage.getByRole('button', { name: '決めない' }).click()
      await taPage.waitForTimeout(300)
      await taPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(500)
      await taPage.getByText('カレーライス', { exact: true }).first().click()
      await taPage.waitForTimeout(500)
      await taPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await taPage.waitForTimeout(300)
      await taPage.getByRole('button', { name: '決めない' }).click()
      await taPage.waitForTimeout(300)

      await taPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await taPage.waitForTimeout(600)
      const beforeText = await taPage.textContent('body')
      check(
        'TODAYALL-01 前提: 今日の献立に2品とも表示される',
        beforeText.includes('肉じゃが') && beforeText.includes('カレーライス'),
      )

      await taPage.getByRole('button', { name: '全て作った！' }).click()
      await taPage.waitForTimeout(800)
      const afterText = await taPage.textContent('body')
      check(
        'TODAYALL-01 「全て作った！」の後、今日の献立が空になる(clearが実行される)',
        afterText.includes('まだ今日つくるものが決まっていません'),
      )

      // IndexedDBを直読みし、両方のレシピにcookedLogsが実際に追加され、todayListが空になったことを確認する
      const state = await taPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['recipes', 'todayList'], 'readonly')
              let recipes, today
              const recipesReq = tx.objectStore('recipes').getAll()
              const todayReq = tx.objectStore('todayList').getAll()
              recipesReq.onsuccess = () => {
                recipes = recipesReq.result
                if (today !== undefined) resolve({ recipes, today })
              }
              todayReq.onsuccess = () => {
                today = todayReq.result
                if (recipes !== undefined) resolve({ recipes, today })
              }
              recipesReq.onerror = () => reject(recipesReq.error)
              todayReq.onerror = () => reject(todayReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const nikujaga = state.recipes.find((r) => r.title === '肉じゃが')
      const curry = state.recipes.find((r) => r.title === 'カレーライス')
      check('TODAYALL-01 肉じゃがに作った記録が追加される', (nikujaga?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 カレーライスに作った記録が追加される', (curry?.cookedLogs?.length ?? 0) > 0)
      check('TODAYALL-01 今日の献立テーブルが空になる(clear実行)', state.today.length === 0)
    } finally {
      await taBrowser.close()
    }
  }

  // --- BACKNAV-01: 今日の献立からレシピを開いて戻ると今週の献立に飛ばされるバグの回帰
  // (2026-07-15オーナー実機フィードバック)。戻り遷移には ?focus=today が付き、これがあると
  // 「日」タブへ固定される(2026-07-16 便U-1でタブ構成に再設計。以前はスクロール制御だったが、
  // 今は「日」「週」「月」タブの選択制御になった。既定タブは元々「日」だが、?focus=todayは
  // 将来デフォルトが変わっても壊れないよう明示的に強制する・パラメータを必ず消費する、の
  // 2点を保証する回帰テストとして残す)。修正が無いと(b)の断定が失敗する ---
  currentCheck = 'BACKNAV-01'
  {
    const bnBrowser = await chromium.launch()
    const bnContext = await bnBrowser.newContext()
    const bnPage = await bnContext.newPage()
    bnPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@BACKNAV-01] ${err.message}`)
    })
    try {
      await bnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(1800) // 初回シード完了待ち

      // (a) 前提: 素の /#/meal-plan は既定で「日」タブが選択されている
      await bnPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(600)
      const dayTabBtn = bnPage.getByRole('button', { name: '日', exact: true })
      check('BACKNAV-01 前提: 素の献立タブは既定で「日」タブが選択されている', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')

      // 「週」タブへ切り替えてから離脱する(実アプリの戻り操作は別ルートを経由してMealPlanPageが
      // 再マウントされるため、タブ状態はリセットされる。それでも?focus=todayが「日」を
      // 強制することを確認するため、あえて別タブに切り替えた状態を経由する)
      await bnPage.getByRole('button', { name: '週', exact: true }).click()
      await bnPage.waitForTimeout(300)

      // (b) ?focus=today では「日」タブへ固定され、パラメータが消費される。
      // 実アプリの戻り操作はレシピ詳細(別ルート)を経由するため、MealPlanPageは必ず再マウント
      // されてinitialFocusRefが初期化される。テストでも一度別ページへ抜けてから戻ることで
      // その再マウントを再現する(ハッシュのクエリだけ変える遷移では再マウントされないため)
      await bnPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(300)
      await bnPage.goto(`${BASE}/#/meal-plan?focus=today`, { waitUntil: 'networkidle' })
      await bnPage.waitForTimeout(600)
      check('BACKNAV-01 ?focus=today では「日」タブへ固定される', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')
      check('BACKNAV-01 focus=today パラメータは消費されURLから消える', !bnPage.url().includes('focus=today'))
      check(
        'BACKNAV-01 戻った先に今日の献立セクションが見える',
        (await bnPage.textContent('body')).includes('今日の献立'),
      )
    } finally {
      await bnBrowser.close()
    }
  }

  // --- SCROLL-02: 一覧の絞り込み・並べ替え条件が「詳細→戻る」を経ても保持される
  // (2026-07-12深夜フィードバックの再調査で判明した本当の原因の再発防止テスト。PC Chrome相当・
  // デスクトップビューポート)。詳細の「戻る」は常に素の /recipes へ新規遷移するため、
  // 検索語や並べ替えなど何か1つでも既定値から変えていると、以前は復元判定のfiltersKeyが
  // 不一致になり、スクロール位置だけでなく絞り込み条件そのものが黙って消えていた
  // (オーナーは「長く滞在すると起きる」と感じていたが、実際は滞在時間に関係なく、絞り込み中に
  // 詳細を開いて戻るだけで即再現した。絞り込んで探すほど長時間読む対象に行き着きやすい、
  // という行動側の相関を「時間経過が原因」と体感していたと考えられる) ---
  currentCheck = 'SCROLL-02'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // 2026-07-16 便T-1で並び替えボタンが絞り込みボタンから分離したのでそちらを開く
  await page.getByRole('button', { name: '並び替え' }).click()
  await page.waitForTimeout(200)
  // 並べ替えを既定の「更新順」から変える(URLに載らない条件なので、これが復元できれば
  // filtersKey全体が保存・復元されていることの証明になる。文言は便T-5で「あいうえお順」→「五十音順」)
  await page.getByRole('button', { name: '五十音順' }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを閉じる
  await page.waitForTimeout(200)
  await page.evaluate(() => window.scrollTo(0, 300))
  await page.waitForTimeout(400)
  const s2ScrollBefore = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => {
    const link = document.querySelector('a[href^="#/recipes/"]')
    if (link instanceof HTMLElement) link.click()
  })
  await page.waitForTimeout(600)
  check('SCROLL-02 詳細へ遷移', /#\/recipes\/\d+/.test(page.url()), `現在URL: ${page.url()}`)
  await page.getByRole('button', { name: '戻る' }).click()
  await page.waitForTimeout(800)
  const s2ScrollAfter = await page.evaluate(() => window.scrollY)
  check(
    'SCROLL-02 詳細→戻るでスクロール位置が復元される(並べ替え変更中・PC Chrome相当)',
    Math.abs(s2ScrollAfter - s2ScrollBefore) < 60,
    `復元前=${s2ScrollBefore} 復元後=${s2ScrollAfter}`,
  )
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを再度開いて並べ替え状態を確認
  await page.waitForTimeout(200)
  // 2026-07-16 B分類の☑リスト化に追随: 選択状態はクラス(border-accent)でなく
  // aria-pressedで判定する(見た目の実装が変わっても壊れない)
  const sortStillActive = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'))
    const target = buttons.find((b) => b.textContent?.trim() === '五十音順')
    return target ? target.getAttribute('aria-pressed') === 'true' : false
  })
  check('SCROLL-02 詳細→戻るで並べ替え条件(五十音順)も保持される', sortStillActive)
  await page.getByRole('button', { name: '並び替え' }).click() // パネルを閉じる(後続チェックへの影響防止)
  await page.waitForTimeout(200)

  // --- TIMER-ADJ-01: 実行中タイマーの±調整(窓方式。2026-07-12タイマー自由設定・Fable設計docs/20 §6)。
  // 肉じゃが手順3「中火で15分煮る」の「15分」をタップしてタイマーを起動し、
  // 常駐バー(TimerBar)の表示をタップして窓を開き、「+1分」「−30秒」で残り秒が変わることを確認する ---
  currentCheck = 'TIMER-ADJ-01'
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('肉じゃが', { exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: '15分 タイマー開始' }).click()
  await page.waitForTimeout(500)
  // タイマー起動の初回だけ出る説明バナーが、次の正規表現セレクタと混同しないことも併せて確認
  const adjustOpenBtn = page.getByRole('button', { name: /のタイマーを調整/ })
  check('TIMER-ADJ-01 常駐バーにタイマー行が現れる(タップで調整窓が開く導線)', await adjustOpenBtn.isVisible())

  // 常駐バー行の「+1分」ミニボタン(2026-07-13 UIペルソナQA): 調整窓を開かずに即+60秒できる近道。
  // 行タップ(調整窓を開く)とは別の操作なので、窓を開く前にここで確認する
  const miniPlusOneBtn = page.getByRole('button', { name: '肉じゃがに1分追加' })
  check('TIMER-ADJ-01 常駐バー行に「+1分」ミニボタンが出る', await miniPlusOneBtn.isVisible())
  const miniBeforeSec = parseRemainingSeconds(await adjustOpenBtn.textContent())
  await miniPlusOneBtn.click()
  await page.waitForTimeout(300)
  const miniAfterSec = parseRemainingSeconds(await adjustOpenBtn.textContent())
  check(
    'TIMER-ADJ-01 「+1分」ミニボタンで残り秒が約60秒増える(調整窓を開かずに)',
    miniBeforeSec !== null && miniAfterSec !== null && miniAfterSec - miniBeforeSec >= 50,
    `押す前=${miniBeforeSec}s 押した後=${miniAfterSec}s`,
  )
  check(
    'TIMER-ADJ-01 「+1分」ミニボタンを押しても調整窓は開かない(行タップと独立)',
    !(await page.getByRole('dialog', { name: 'タイマーを調整' }).isVisible().catch(() => false)),
  )

  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  const adjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  check('TIMER-ADJ-01 タイマー調整の窓が開く(「作った！」と同じ様式)', await adjustDialog.isVisible())
  const adjBeforeSec = parseRemainingSeconds(await adjustDialog.textContent())
  await adjustDialog.getByRole('button', { name: '+1分' }).click()
  await page.waitForTimeout(200)
  const adjAfterPlusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「+1分」で残り秒が約60秒増える',
    adjBeforeSec !== null && adjAfterPlusSec !== null && adjAfterPlusSec - adjBeforeSec >= 50,
    `押す前=${adjBeforeSec}s 押した後=${adjAfterPlusSec}s`,
  )
  await adjustDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(200)
  const adjAfterMinusSec = parseRemainingSeconds(await adjustDialog.textContent())
  check(
    'TIMER-ADJ-01 「−30秒」で残り秒が約30秒減る',
    adjAfterMinusSec !== null && adjAfterPlusSec - adjAfterMinusSec >= 20,
    `「+1分」後=${adjAfterPlusSec}s 「−30秒」後=${adjAfterMinusSec}s`,
  )
  // 窓の外(背景)をタップして閉じる。常駐バーの表示はそのまま残る(タイマー自体は動作中のまま)
  await page.mouse.click(5, 5)
  await page.waitForTimeout(300)
  check('TIMER-ADJ-01 背景タップで窓が閉じる', !(await adjustDialog.isVisible().catch(() => false)))
  // 「停止」でタイマーごと消えることも確認する(後続のTIMER-CUSTOM-01に影響を残さないための後片付けも兼ねる)
  await adjustOpenBtn.click()
  await page.waitForTimeout(300)
  await adjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)
  check(
    'TIMER-ADJ-01 「停止」でタイマーが常駐バーから消える',
    !(await adjustOpenBtn.isVisible().catch(() => false)),
  )

  // --- TIMER-CUSTOM-01: じぶんタイマー(自由な分数で始めるタイマー。同バッチ)。
  // レシピ詳細のBackHeaderにあるタイマーアイコン(入口A)から開き、既定3分→1分まで減らして起動する。
  // 続けて同じ調整窓で「−30秒」を重ねても残りが0未満にならない(即完了扱いにしない)ことも確認する ---
  currentCheck = 'TIMER-CUSTOM-01'
  await page.getByRole('button', { name: 'じぶんタイマーを開く' }).click()
  await page.waitForTimeout(300)
  const customDialog = page.getByRole('dialog', { name: 'じぶんタイマー' })
  // 残り時間の表示だけを拾うロケータ(ボタン文言「−30秒」等と紛れないよう、表示専用のspanをクラスで狙う)
  const customCounter = customDialog.locator('.tabular-nums')
  check(
    'TIMER-CUSTOM-01 じぶんタイマーの窓が開く(初回既定3分)',
    (await customDialog.textContent()).includes('3分'),
  )
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 分数ステッパー(±1分)で1分まで減らせる',
    (await customDialog.textContent()).includes('1分'),
  )
  // --- 秒刻み(2026-07-12オーナー実機フィードバック追加分)。±30秒・±10秒で分+秒表示になり、
  // 一往復(+30+10-30-10=±0)で1分ちょうどに戻ることを確認する(以降の起動値を60秒に保つため) ---
  await customDialog.getByRole('button', { name: '+30秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+30秒」で1分→1分30秒', (await customCounter.textContent()) === '1分30秒')
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「+10秒」で1分30秒→1分40秒', (await customCounter.textContent()) === '1分40秒')
  await customDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−30秒」で1分40秒→1分10秒', (await customCounter.textContent()) === '1分10秒')
  await customDialog.getByRole('button', { name: '−10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 秒刻み「−10秒」で1分10秒→1分ちょうどに戻る', (await customCounter.textContent()) === '1分')
  // 開始前の秒数も10秒未満にならない(floor挙動)。−1分→10秒未満は10秒で止まる。その後+30+10+10=+50秒で1分に戻す
  await customDialog.getByRole('button', { name: 'じぶんタイマーの分数を減らす' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 開始前の秒数も10秒未満にならない(1分→10秒で床止め)', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: '−10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 10秒からさらに「−10秒」しても10秒のまま', (await customCounter.textContent()) === '10秒')
  await customDialog.getByRole('button', { name: '+30秒' }).click()
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await customDialog.getByRole('button', { name: '+10秒' }).click()
  await page.waitForTimeout(150)
  check('TIMER-CUSTOM-01 1分まで戻して開始する', (await customCounter.textContent()) === '1分')
  await customDialog.getByRole('button', { name: '開始' }).click()
  await page.waitForTimeout(400)
  const customBarText = await page.textContent('body')
  check(
    'TIMER-CUSTOM-01 じぶんタイマーが起動する(常駐バーに「じぶんタイマー」表示)',
    customBarText.includes('じぶんタイマー'),
  )
  await page.getByRole('button', { name: /のタイマーを調整/ }).click()
  await page.waitForTimeout(300)
  const customAdjustDialog = page.getByRole('dialog', { name: 'タイマーを調整' })
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click()
  await page.waitForTimeout(150)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 1分-30秒-30秒=0
  await page.waitForTimeout(150)
  const atFloorText = await customAdjustDialog.textContent()
  check('TIMER-CUSTOM-01 「−30秒」を重ねても残りは0で止まる', atFloorText.includes('00:00'), atFloorText)
  await customAdjustDialog.getByRole('button', { name: '−30秒' }).click() // 0からさらに押しても0のまま
  await page.waitForTimeout(150)
  check(
    'TIMER-CUSTOM-01 0からさらに「−30秒」しても0のまま(即完了扱いにしない)',
    (await customAdjustDialog.textContent()).includes('00:00'),
  )
  await customAdjustDialog.getByRole('button', { name: '停止' }).click()
  await page.waitForTimeout(300)

  // --- PRICE-01: 食材価格マスタ(「食材と価格」画面。docs/20 §3)。
  // 材料に価格を入力していないレシピでも、マスタの目安価格が詳細の概算食費に反映され、
  // マスタの価格を編集すると反映結果も追従することを確認する。
  // 2026-07-12 UX改修で編集モーダルを廃止し一覧の行内編集に変わったため、操作手順もそれに合わせた ---
  currentCheck = 'PRICE-01'
  // テスト用レシピ: 材料に価格を入力せず、マスタ初期値がある「玉ねぎ」だけを使う
  await page.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByPlaceholder('例: 肉じゃが').fill('E2E価格マスタ確認レシピ')
  await page.getByPlaceholder('例: じゃがいも').first().fill('玉ねぎ')
  await page.getByPlaceholder('例: 3').first().fill('1')
  await page.getByPlaceholder('例: 個').first().fill('個')
  await page.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('切る')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForTimeout(800)
  const priceDetailBefore = await page.textContent('body')
  check(
    'PRICE-01 マスタ初期値(玉ねぎ1個50円)が価格未入力の詳細の概算食費に反映される',
    priceDetailBefore.includes('約50円'),
  )
  check(
    'PRICE-01 詳細画面の概算食費欄にはマスタ由来の注記が出ない' +
      '(2026-07-13 オーナー実機フィードバックで削除。週の献立側も同日中に削除)',
    !priceDetailBefore.includes('一部は目安価格から計算しています'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの目安価格の注記は表示しない' +
      '(2026-07-14 オーナー実機フィードバック「材料のメモ欄に目安価格が表示されている」の解消で機能削除)',
    !priceDetailBefore.includes('（目安50円）'),
  )
  // 修正3a: 概算食費(合計)に加えて「1食あたり」も表示される。既定servings=2なので50÷2=25円
  check(
    'PRICE-01(修正3a) 「1食あたり」の概算食費も表示される(既定人数2人・50÷2=約25円)',
    priceDetailBefore.includes('1食あたり 約25円'),
  )

  // 設定から「食材と価格」を開き、初期値30件の投入と目安の注意書きを確認する。
  // 「食材と価格を編集する」リンクは既定タブ「全般」のNG食材の直下にある
  // (2026-07-13 UI改善で「レシピ」タブから移動)ため、タブ切り替え不要でそのまま開ける
  await page.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByRole('link', { name: '食材と価格を編集する' }).click()
  await page.waitForTimeout(500)
  check('PRICE-01 設定からの遷移でタイトルが表示される', page.url().includes('#/prices'))
  const priceListBefore = await page.textContent('body')
  check(
    'PRICE-01 初期値が投入されている(玉ねぎ・鶏もも肉を含む)',
    priceListBefore.includes('玉ねぎ') && priceListBefore.includes('鶏もも肉'),
  )
  check('PRICE-01 目安価格の注意書きが表示される', priceListBefore.includes('価格は目安です'))

  // --- INLINE-01: 一覧の行内編集(2026-07-12 UX改修)。玉ねぎの行を名前で特定し、
  // 編集ボタン・別窓を経由せず、価格欄に直接入力してEnter(=blur)で即保存できることを確認する。
  // 2026-07-13 UI改善で「目安」/「自分の価格」バッジは廃止したため、ここでは
  // 「デフォルトに戻す」ボタンの出現/消失(=上書き済みかどうか)で編集反映を確認する ---
  currentCheck = 'INLINE-01'
  const onionRow = page.locator('li', { hasText: '玉ねぎ' })
  check(
    'INLINE-01 初期状態(未編集)では「デフォルトに戻す」ボタンが出ない',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  const onionPriceInput = onionRow.getByLabel('玉ねぎの価格（円）')
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter') // Enterでblur→保存(モーダル・保存ボタンを経由しない)
  await page.waitForTimeout(400)
  const onionRowTextAfterEdit = await onionRow.textContent()
  check('INLINE-01 編集後は「デフォルトに戻す」ボタンが出る', onionRowTextAfterEdit.includes('デフォルトに戻す'))
  check(
    'INLINE-01 価格入力欄の値が999のまま保持される(再マウントで飛ばない)',
    (await onionPriceInput.inputValue()) === '999',
  )

  // 修正2a: 手入力で既定値(50円)に戻すと「デフォルトに戻す」ボタンも消えることを確認する。
  // 以前は編集フラグが一方通行だったため、値を既定値に戻してもボタンが残るバグがあった
  await onionPriceInput.fill('50')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)
  check(
    'INLINE-01(修正2a) 手入力で既定値と一致させると「デフォルトに戻す」ボタンが消える',
    !(await onionRow.textContent()).includes('デフォルトに戻す'),
  )
  // 後続の検証用に再度999へ編集し直す
  await onionPriceInput.fill('999')
  await onionPriceInput.press('Enter')
  await page.waitForTimeout(400)

  // 修正2b: 重複食材の登録防止。既に登録済みの「玉ねぎ」を追加しようとすると拒否される
  // exact:trueが必須(部分一致だと検索欄「食材名で絞り込む」や各行の「{name}の価格（円）」等と衝突する)
  // 2026-07-15 UI改修で単位欄が「数量(数字)＋単位(選択)」に分離されたため、addUnitInputは
  // 数量欄(addQtyInput)＋単位選択(addUnitSelect)の2つに置き換えた(PRICEUNIT-01参照)
  const addNameInput = page.getByLabel('食材名', { exact: true })
  const addPriceInput = page.getByLabel('価格（円）', { exact: true })
  const addQtyInput = page.getByLabel('数量', { exact: true })
  const addUnitSelect = page.getByLabel('単位', { exact: true })
  await addNameInput.fill('玉ねぎ')
  await addPriceInput.fill('80')
  await addQtyInput.fill('1')
  await addUnitSelect.selectOption('個')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 既に登録済みの食材名は追加を拒否し、案内メッセージが出る',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです'),
  )
  check(
    'INLINE-01(修正2b) 拒否後も「玉ねぎ」の行は1件のまま増えない',
    (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  // 前後の空白・括弧付きの表記ゆれも正規化して同一とみなし拒否される
  await addNameInput.fill('  玉ねぎ（小）  ')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b) 表記ゆれ(前後空白・括弧書き)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「玉ねぎ」は既に登録済みです') &&
      (await page.locator('li', { hasText: '玉ねぎ' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2b拡張(2026-07-15オーナー実機フィードバック): かな表記ゆれ(カタカナ⇄ひらがな)も
  // toHiraganaで正規化して重複と判定する。登録済み「白菜」に対してカタカナ「ハクサイ」を追加拒否する
  await addNameInput.fill('ハクサイ')
  await addPriceInput.fill('99')
  await addQtyInput.fill('1')
  await page.getByRole('button', { name: '追加', exact: true }).click()
  await page.waitForTimeout(300)
  check(
    'INLINE-01(修正2b拡張) かな表記ゆれ(カタカナ/ひらがな。白菜/ハクサイ)も正規化して重複と判定する',
    (await page.textContent('body')).includes('「白菜」は既に登録済みです') &&
      (await page.locator('li', { hasText: '白菜' }).count()) === 1,
  )
  await addNameInput.fill('')
  await addPriceInput.fill('')
  await addQtyInput.fill('')
  await page.waitForTimeout(200)

  // 修正2c: 追加入力欄が一覧より上に表示される(食材名欄のY座標 < 玉ねぎ行のY座標)
  const addNameBox = await addNameInput.boundingBox()
  const onionRowBoxForOrder = await onionRow.boundingBox()
  check(
    'INLINE-01(修正2c) 追加入力欄が一覧より上に表示される',
    !!addNameBox && !!onionRowBoxForOrder && addNameBox.y < onionRowBoxForOrder.y,
  )

  // 検索/絞り込み: 存在しない食材名で0件表示になることを確認してから解除する
  const searchInput = page.getByPlaceholder('食材名で絞り込む')
  await searchInput.fill('ぜったいにないよみとうしょくざい')
  await page.waitForTimeout(300)
  check(
    'INLINE-01 検索で該当なしのメッセージが出る',
    (await page.textContent('body')).includes('該当する食材が見つかりません'),
  )
  await searchInput.fill('')
  await page.waitForTimeout(300)

  // 詳細画面に戻り、編集後の価格が概算食費に反映されることを確認する(999円・1食あたり500円)
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfter = await page.textContent('body')
  check(
    'PRICE-01 マスタ編集後、詳細の概算食費が更新される(約999円)',
    priceDetailAfter.includes('約999円'),
  )
  check(
    'PRICE-01(修正3a) 「1食あたり」も編集後の価格に追従する(999÷2=約500円)',
    priceDetailAfter.includes('1食あたり 約500円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記は編集後も表示しない',
    !priceDetailAfter.includes('（999円）') && !priceDetailAfter.includes('（目安999円）'),
  )

  // 「デフォルトに戻す」で投入時の価格に復元できることを確認する
  await page.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  const onionRowAgain = page.locator('li', { hasText: '玉ねぎ' })
  await onionRowAgain.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
  await page.waitForTimeout(400)
  const onionRowTextAfterReset = await onionRowAgain.textContent()
  check(
    'INLINE-01 「デフォルトに戻す」後はボタンが再び消える(未編集扱いに戻る)',
    !onionRowTextAfterReset.includes('デフォルトに戻す'),
  )
  check(
    'INLINE-01 「デフォルトに戻す」で価格が50円に戻る',
    (await onionRowAgain.getByLabel('玉ねぎの価格（円）').inputValue()) === '50',
  )

  // デフォルトに戻した後は、詳細の概算食費も50円(1食あたり25円)に戻ることを確認する。
  // 材料行ごとの目安価格由来の注記は2026-07-14に機能ごと削除したため、ここでは確認しない
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  const priceDetailAfterReset = await page.textContent('body')
  check(
    'INLINE-01 「デフォルトに戻す」後は詳細の概算食費も50円に戻る',
    priceDetailAfterReset.includes('約50円'),
  )
  check(
    'PRICE-01(修正3b) 材料行ごとの注記はデフォルト復元後も表示しない',
    !priceDetailAfterReset.includes('（目安50円）'),
  )

  // 後始末: テスト用レシピを削除（削除は詳細画面からなので、いったんレシピ詳細に戻る）
  await page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(500)
  await page.getByText('E2E価格マスタ確認レシピ', { exact: true }).first().click()
  await page.waitForTimeout(500)
  await page.locator('a[href*="/edit"]').first().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'このレシピを削除' }).click()
  await page.waitForTimeout(800)

  // --- MEALPLAN-01: 献立タブ・週プランナー(第4波ペルソナPDCA Fix1/3/4/5/6。まっさらプロファイル
  // で検証するため専用browser/contextを使う。2026-07-16 便U-1でタブ構成(日/週/月)に再設計。
  // 既定タブは「日」になったため、週タブの検証は明示的に「週」タブへ切り替えてから行う)。
  // Fix1: 週移動の中央チップ(以前は無ラベルの地の文だった)は、当週表示中はaria-labelなし、
  //       当週以外を見ているときだけaria-label(今週へ戻る)が付く「戻るボタン」になっていること
  // Fix3: 何も割り当てていない週は概算食費セクションが非表示、割り当てると表示されること
  // Fix4: 埋まった枠のピッカーを再度開くと、現在のレシピの行に「選択中」バッジが出ること
  // Fix5: 食事帯フィルタ・時短優先トグル・日/週/月タブにaria-pressedが付くこと(見た目は変更なし)
  // Fix6: 最後の1つの食事帯フィルタを外そうとすると無反応ではなく説明トーストが出ること
  // 便U-4: 週タブの「この帯の今週分を空にする」で帯選択+確認confirm→その帯の週エントリが
  //        全削除されること・他の帯には影響しないこと ---
  currentCheck = 'MEALPLAN-01'
  {
    const mpBrowser = await chromium.launch()
    const mpContext = await mpBrowser.newContext()
    const mpPage = await mpContext.newPage()
    mpPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-01] ${text}`)
    })
    mpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-01] ${err.message}`)
    })
    mpPage.on('dialog', (dialog) => dialog.accept()) // 便U-4の削除確認confirmを自動承認
    try {
      await mpPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mpPage.waitForTimeout(1800) // 初回シード完了待ち

      // 便U-1: 既定は「日」タブ。以降の検証は週タブの内容が対象なので明示的に切り替える
      const dayTabBtn = mpPage.getByRole('button', { name: '日', exact: true })
      check('MEALPLAN-01(便U-1) 献立タブを開くと既定で「日」タブが選択されている', (await dayTabBtn.getAttribute('aria-pressed')) === 'true')
      await mpPage.getByRole('button', { name: '週', exact: true }).click()
      await mpPage.waitForTimeout(300)

      // Fix3: まっさらプロファイル・未割当時は概算食費セクションが無い
      const mpEmptyText = await mpPage.textContent('body')
      check(
        'MEALPLAN-01(Fix3) 未割当時は概算食費セクションが無い',
        !mpEmptyText.includes('今週の概算食費'),
      )

      // Fix1: 週移動の中央チップ。まず当週表示中はaria-labelが無いことを確認
      const weekCenterBtn = mpPage.locator('button', { hasText: '〜' }).first()
      const weekTextAtCurrent = (await weekCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-01(Fix1) 当週表示中は中央チップにaria-labelが無い',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )
      await mpPage.locator('button[aria-label="次の週"]').click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 「次の週」で来週へ→中央チップにaria-label(今週へ戻る)が付く',
        (await weekCenterBtn.getAttribute('aria-label')) === '今週へ戻る',
      )
      await weekCenterBtn.click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(Fix1) 中央チップをタップすると当週へ戻る(日付レンジが元に戻る)',
        (await weekCenterBtn.textContent())?.trim() === weekTextAtCurrent,
      )
      check(
        'MEALPLAN-01(Fix1) 当週へ戻った後は中央チップのaria-labelが再び消える',
        (await weekCenterBtn.getAttribute('aria-label')) === null,
      )

      // Fix4+Fix3: 空き枠に「肉じゃが」を割り当てる(ピッカー経由)。
      // 2026-07-24 便BH-3・タスク5: 空き枠は「未定」テキストから「レシピを選ぶ」ボタンに変わった
      await mpPage.getByRole('button', { name: 'レシピを選ぶ', exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      check('MEALPLAN-01(Fix4) ピッカーが開く', (await mpPage.textContent('body')).includes('レシピを選ぶ'))
      await mpPage.getByPlaceholder('レシピ名で絞り込み').fill('肉じゃが')
      await mpPage.waitForTimeout(300)
      await mpPage.getByText('肉じゃが', { exact: true }).first().click()
      await mpPage.waitForTimeout(400)
      const mpAssignedText = await mpPage.textContent('body')
      // 2026-07-24 便BH-3・タスク4: 概算食費は小さな折りたたみ(既定閉)になった。見出し(トグル)は
      // 割り当て後に出るが、金額・リンクは展開して初めて出る
      check('MEALPLAN-01(Fix3) 割り当てると概算食費セクションが出る', mpAssignedText.includes('今週の概算食費'))
      // タスク4: 折りたたみを展開してから金額・食数・リンクを確認する
      await mpPage.getByRole('button', { name: '今週の概算食費' }).click()
      await mpPage.waitForTimeout(300)
      const mpCostText = await mpPage.textContent('body')
      const costMatch = mpCostText.match(/約([\d,]+)円/)
      check(
        'MEALPLAN-01(Fix3) 表示された概算食費は0円ではない',
        !!costMatch && Number(costMatch[1].replace(/,/g, '')) > 0,
        `costMatch=${costMatch?.[0]}`,
      )
      check(
        'MEALPLAN-01(便BH-3・タスク8) 概算食費に「◯食分」が併記される',
        /\d+食分/.test(mpCostText),
      )
      check(
        'MEALPLAN-01(Fix3) 概算食費セクションにマスタ由来の注記は出ない' +
          '(2026-07-13 オーナー実機フィードバックで詳細に続き週の献立側も削除)',
        !mpCostText.includes('一部は目安価格から計算しています'),
      )

      // 2026-07-14: 概算食費欄のリンク文言を「食材と価格を編集する」に変更し、
      // 遷移先も/recipesから/prices(食材と価格ページ)に変更した
      const weekCostLink = mpPage.getByRole('link', { name: '食材と価格を編集する' })
      check(
        'MEALPLAN-01(修正1a) 概算食費欄のリンク文言が「食材と価格を編集する」になる',
        await weekCostLink.isVisible(),
      )
      check(
        'MEALPLAN-01(修正1a) リンクの遷移先が/prices(食材と価格ページ)になる',
        (await weekCostLink.getAttribute('href'))?.includes('/prices'),
      )

      // Fix4: 埋まった枠を再度開くと現在のレシピ行に「選択中」バッジが出る
      await mpPage.getByRole('button', { name: '肉じゃが' }).first().click()
      await mpPage.waitForTimeout(400)
      const currentPickRow = mpPage.locator('li', { hasText: '選択中' })
      check('MEALPLAN-01(Fix4) 「選択中」バッジが出る', await currentPickRow.isVisible())
      check(
        'MEALPLAN-01(Fix4) 「選択中」バッジは現在のレシピ(肉じゃが)の行に付く',
        (await currentPickRow.textContent())?.includes('肉じゃが'),
      )
      await mpPage.locator('button[aria-label="閉じる"]').click()
      await mpPage.waitForTimeout(300)

      // Fix5: aria-pressed(見た目は変更しない)
      // 2026-07-16 UI総点検A-3: 提案条件6ボタンは既定折りたたみになったため、まず開く
      const suggestConditionsToggleBtn = mpPage.getByRole('button', { name: '提案の条件', exact: false })
      check(
        'MEALPLAN-01(A-3) 提案の条件トグルは既定でaria-expanded=false',
        (await suggestConditionsToggleBtn.getAttribute('aria-expanded')) === 'false',
      )
      await suggestConditionsToggleBtn.click()
      await mpPage.waitForTimeout(200)
      const quickToggleBtn = mpPage.getByRole('button', { name: '自動提案は時短レシピ優先' })
      check('MEALPLAN-01(Fix5) 時短優先トグルは既定でaria-pressed=false', (await quickToggleBtn.getAttribute('aria-pressed')) === 'false')
      await quickToggleBtn.click()
      await mpPage.waitForTimeout(200)
      check('MEALPLAN-01(Fix5) 時短優先トグルON後はaria-pressed=true', (await quickToggleBtn.getAttribute('aria-pressed')) === 'true')
      await quickToggleBtn.click() // 元に戻す
      await mpPage.waitForTimeout(200)
      const breakfastFilterBtn = mpPage.getByRole('button', { name: '朝食', exact: true })
      const lunchFilterBtn = mpPage.getByRole('button', { name: '昼食', exact: true })
      const dinnerFilterBtn = mpPage.getByRole('button', { name: '夕食', exact: true })
      // 2026-07-13更新: 新規ユーザーの既定表示食事帯は「夕食のみ」(オーナー判断・プレッシャー軽減)。
      // まっさらプロファイルで検証しているこのテストでは朝食/昼食=false、夕食=trueが既定になる
      check(
        'MEALPLAN-01(Fix5・2026-07-13更新) 食事帯フィルタは新規ユーザーの既定で夕食だけaria-pressed=true',
        (await breakfastFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await lunchFilterBtn.getAttribute('aria-pressed')) === 'false' &&
          (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )
      const weekToggleBtn = mpPage.getByRole('button', { name: '週', exact: true })
      const monthToggleBtn = mpPage.getByRole('button', { name: '月', exact: true })
      check(
        'MEALPLAN-01(Fix5・便U-1) 日/週/月タブにもaria-pressedが付く(週表示中はfalse/true/false)',
        (await dayTabBtn.getAttribute('aria-pressed')) === 'false' &&
          (await weekToggleBtn.getAttribute('aria-pressed')) === 'true' &&
          (await monthToggleBtn.getAttribute('aria-pressed')) === 'false',
      )

      // Fix6(2026-07-13更新): 既定で夕食だけが表示中なので、その最後の1つを外そうとすると
      // 説明トーストが出て外れないことを直接確認する(以前は昼食/夕食を手動で外して朝食だけに
      // してから検証していたが、新既定で夕食のみのため不要になった)
      await dinnerFilterBtn.click() // 最後の1つ(夕食)を外そうとする
      await mpPage.waitForTimeout(300)
      check(
        'MEALPLAN-01(Fix6) 最後の1枠(夕食)を外そうとすると説明トーストが出る',
        (await mpPage.textContent('body')).includes('少なくとも1つの食事帯は表示します'),
      )
      check(
        'MEALPLAN-01(Fix6) 夕食フィルタは外れずaria-pressed=trueのまま',
        (await dinnerFilterBtn.getAttribute('aria-pressed')) === 'true',
      )

      // 便U-4: 「この帯の今週分を空にする」。ここまでの操作で月曜夕食の主菜行に「肉じゃが」が
      // 割り当て済み(Fix4)。帯選択は既定で「夕食」なので、選び直しは不要にconfirmだけ操作する。
      // aria-labelで対象の帯選択ボタン(表示帯フィルタの「夕食」ボタンとは別物)を特定する
      const clearDinnerTargetBtn = mpPage.getByRole('button', { name: '空にする帯として夕食を選ぶ' })
      check(
        'MEALPLAN-01(便U-4) 帯選択ボタンは既定で「夕食」がaria-pressed=true',
        (await clearDinnerTargetBtn.getAttribute('aria-pressed')) === 'true',
      )
      await mpPage.getByRole('button', { name: '空にする', exact: true }).click()
      await mpPage.waitForTimeout(400)
      check(
        'MEALPLAN-01(便U-4) 確認後、削除完了のトーストが出る',
        (await mpPage.textContent('body')).includes('夕食の今週分を削除しました'),
      )
      check(
        'MEALPLAN-01(便U-4) 夕食を空にすると割り当て済みだった「肉じゃが」も消える(未定に戻る)',
        (await mpPage.getByText('肉じゃが', { exact: true }).count()) === 0,
      )
    } finally {
      await mpBrowser.close()
    }
  }

  // --- MEALPLAN-02: 献立タブ・月カレンダー(第4波ペルソナPDCA Fix2)。Pro解錠(実際のコード入力UI経由)
  // →月表示→「前の月」→中央チップにaria-label(今月へ戻る)→タップで当月へ戻ることを確認する。
  // Pro解錠はPRO-FALLBACK-01と同じテスト用コード(docs/22記載・販売用ではない)を使う。
  // 便U-5(2026-07-16 Fable設計: 月タブの日タップは「その日の献立」を窓表示し、従来の
  // 即週ジャンプはモーダル内の「この週を開く」ボタンへ移動)も同じPro解錠済みブラウザで検証する ---
  currentCheck = 'MEALPLAN-02'
  {
    const mp2Browser = await chromium.launch()
    const mp2Context = await mp2Browser.newContext()
    const mp2Page = await mp2Context.newPage()
    mp2Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-02] ${text}`)
    })
    mp2Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-02] ${err.message}`)
    })
    try {
      await mp2Page.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(1500)
      // 2026-07-17設定ゼロベース裁定#7: Pro/追加レシピパックの入力欄が1つに統合された
      await mp2Page.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)').fill('UR-96QS-2VSZ')
      await mp2Page.getByRole('button', { name: '解錠する', exact: true }).first().click()
      await mp2Page.waitForTimeout(1000)
      check(
        'MEALPLAN-02 前提: Pro解錠が成功する',
        (await mp2Page.textContent('body')).includes('Pro版をご利用いただきありがとうございます'),
      )

      await mp2Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02 前提: Pro解錠済みで月カレンダーが開く(ゲートでない)',
        !(await mp2Page.textContent('body')).includes('月間表示はPro版の機能です'),
      )

      const monthCenterBtn = mp2Page.locator('button').filter({ hasText: '/' }).first()
      const monthTextAtCurrent = (await monthCenterBtn.textContent())?.trim()
      check(
        'MEALPLAN-02(Fix2) 当月表示中は中央チップにaria-labelが無い',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )
      await mp2Page.locator('button[aria-label="前の月"]').click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 「前の月」で先月へ→中央チップにaria-label(今月へ戻る)が付く',
        (await monthCenterBtn.getAttribute('aria-label')) === '今月へ戻る',
      )
      await monthCenterBtn.click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(Fix2) 中央チップをタップすると当月へ戻る(年月表示が元に戻る)',
        (await monthCenterBtn.textContent())?.trim() === monthTextAtCurrent,
      )
      check(
        'MEALPLAN-02(Fix2) 当月へ戻った後は中央チップのaria-labelが再び消える',
        (await monthCenterBtn.getAttribute('aria-label')) === null,
      )

      // 便U-5: 月タブの日タップは窓表示(モーダル)。まず献立の無い日(今日)をタップ→
      // 「献立はありません」+「この週を開く」が出ること。従来の即週ジャンプが起きない
      // (=タップ直後も月タブのまま)ことも確認する
      const todayCell = mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first()
      await todayCell.click()
      await mp2Page.waitForTimeout(400)
      const monthTabBtn = mp2Page.getByRole('button', { name: '月', exact: true })
      check(
        'MEALPLAN-02(便U-5) 日をタップしても即週ジャンプせず月タブのまま(モーダルが開く)',
        (await monthTabBtn.getAttribute('aria-pressed')) === 'true',
      )
      const dayModal = mp2Page.locator('[role="dialog"]')
      check('MEALPLAN-02(便U-5) その日の献立モーダルが開く', await dayModal.isVisible())
      check(
        'MEALPLAN-02(便U-5) 献立の無い日は「献立はありません」と出る',
        (await dayModal.textContent()).includes('献立はありません'),
      )
      check(
        'MEALPLAN-02(便U-5) モーダルに「この週を開く」ボタンがある',
        await dayModal.getByRole('button', { name: 'この週を開く' }).isVisible(),
      )
      // ×で閉じられる
      await dayModal.locator('button[aria-label="閉じる"]').click()
      await mp2Page.waitForTimeout(300)
      check('MEALPLAN-02(便U-5) ×でモーダルが閉じる', !(await dayModal.isVisible()))

      // 献立のある日: 今日の日付の夕食に「肉じゃが」をIndexedDB直書きで投入してから
      // 同じ日をタップ→モーダルに食事帯ラベルとレシピ名リンクが出ること
      const mp2RecipeId = await mp2Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.find((r) => r.title === '肉じゃが')?.id)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      await mp2Page.evaluate(
        (recipeId) =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const a = tx.objectStore('mealPlans').add({ date, slot: 'dinner', recipeId, role: 'main' })
              a.onerror = () => reject(a.error)
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        mp2RecipeId,
      )
      // 素のIndexedDB直書きはDexieのliveQueryキャッシュに検知されない(ハッシュ遷移の
      // 開き直しは同一ドキュメントのためキャッシュも残る)ので、本物のreloadで反映させる
      await mp2Page.reload({ waitUntil: 'networkidle' })
      await mp2Page.waitForTimeout(800)
      await mp2Page.getByRole('button', { name: '月', exact: true }).click()
      await mp2Page.waitForTimeout(400)
      await mp2Page.locator('div.grid.grid-cols-7 button.border-accent').first().click()
      await mp2Page.waitForTimeout(400)
      const dayModalFilled = mp2Page.locator('[role="dialog"]')
      const dayModalFilledText = await dayModalFilled.textContent()
      check(
        'MEALPLAN-02(便U-5) 献立のある日は食事帯ラベル(夕食)とレシピ名が出る',
        dayModalFilledText.includes('夕食') && dayModalFilledText.includes('肉じゃが'),
      )
      check(
        'MEALPLAN-02(便U-5) レシピ名はタップで詳細へ行けるリンクになっている',
        (await dayModalFilled.locator('a[href*="/recipes/"]').count()) > 0,
      )
      // 「この週を開く」で週タブへ移動する(従来の週ジャンプはここへ移動した)
      await dayModalFilled.getByRole('button', { name: 'この週を開く' }).click()
      await mp2Page.waitForTimeout(400)
      check(
        'MEALPLAN-02(便U-5) 「この週を開く」で週タブへ切り替わる',
        (await mp2Page.getByRole('button', { name: '週', exact: true }).getAttribute('aria-pressed')) === 'true',
      )
      check(
        'MEALPLAN-02(便U-5) 開いた週に投入済みの肉じゃがが見える(今日を含む週が開いている)',
        (await mp2Page.getByText('肉じゃが', { exact: true }).count()) > 0,
      )
    } finally {
      await mp2Browser.close()
    }
  }

  // --- MEALPLAN-03: 献立タブ・主菜+副菜構成(2026-07-13 Fable設計・オーナー要望。まっさら
  // プロファイルで検証するため専用browser/contextを使う)。
  // ・各枠は既定で「主菜」「副菜」の2行(未定×2)が並ぶこと
  // ・行単位のサイコロは対象の役割の行だけに作用する(枠が部分的に埋まっているとき)こと
  // ・枠が丸ごと空のときのサイコロは主菜+副菜のペアで一度に埋まること
  // ・「＋枠を追加」で行を増やせること
  // ・ジャンルチップ(指定なし/和食/洋食/中華)が単一選択で切り替わること
  // ・「まとめて献立を立てる」ボタンにDicesアイコンが付くこと(Sparklesから変更) ---
  currentCheck = 'MEALPLAN-03'
  {
    const mp3Browser = await chromium.launch()
    const mp3Context = await mp3Browser.newContext()
    const mp3Page = await mp3Context.newPage()
    mp3Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-03] ${text}`)
    })
    mp3Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-03] ${err.message}`)
    })
    try {
      await mp3Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp3Page.waitForTimeout(1800) // 初回シード完了待ち(この時点で表示食事帯は既定の「夕食のみ」)
      // 便U-1: 既定タブは「日」になったため、週プランナーの検証は「週」タブへ切り替えてから行う
      await mp3Page.getByRole('button', { name: '週', exact: true }).click()
      await mp3Page.waitForTimeout(300)
      // 2026-07-16 便W-⑤a: ランダム週献立(サイコロ/まとめて献立)は過去日の枠を対象外にした。
      // このテストは実行日の曜日次第で「当週の月曜」が過去日になりうる(例: 実行日が木曜なら
      // 月〜水は過去)ため、サイコロの行インデックス(nth)が曜日で変わってしまう。
      // 「次の週」へ1回進めば、その週の月曜は実行日が何曜日でも必ず未来日になり、テストが
      // 決定的になる(過去日保護そのものの検証はMEALPLAN-06で別途行う)
      await mp3Page.locator('button[aria-label="次の週"]').click()
      await mp3Page.waitForTimeout(300)

      // 各枠は既定で主菜+副菜の2行(未定×2)。既定表示は夕食のみなので7日×2行=14件
      check(
        'MEALPLAN-03 各枠は既定で主菜+副菜の2行(未定×2)が並ぶ',
        (await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()) === 14,
      )
      check(
        'MEALPLAN-03 行に「主菜」「副菜」のラベルが付く(7日分ずつ)',
        (await mp3Page.getByText('主菜', { exact: true }).count()) === 7 &&
          (await mp3Page.getByText('副菜', { exact: true }).count()) === 7,
      )

      // 「まとめて献立を立てる」ボタンにアイコン(svg)が付く(SparklesからDicesへ変更。2026-07-13)
      const fillWeekBtn = mp3Page.getByRole('button', { name: 'まとめて献立を立てる' })
      check(
        'MEALPLAN-03 「まとめて献立を立てる」ボタンにアイコンが付く',
        (await fillWeekBtn.locator('svg').count()) > 0,
      )

      // ジャンルチップ・高たんぱく優先は「提案の条件」トグルの中(2026-07-16 UI総点検A-3で既定折りたたみ化)。まず開く
      await mp3Page.getByRole('button', { name: '提案の条件', exact: false }).click()
      await mp3Page.waitForTimeout(200)

      // ジャンルチップ(指定なし/和食/洋食/中華)は単一選択
      const anyGenreBtn = mp3Page.getByRole('button', { name: '指定なし', exact: true })
      const japaneseGenreBtn = mp3Page.getByRole('button', { name: '和食', exact: true })
      check(
        'MEALPLAN-03 ジャンルチップは既定で「指定なし」がaria-pressed=true',
        (await anyGenreBtn.getAttribute('aria-pressed')) === 'true',
      )
      await japaneseGenreBtn.click()
      await mp3Page.waitForTimeout(200)
      check(
        'MEALPLAN-03 ジャンルチップ「和食」を選ぶと単一選択で「指定なし」が外れる',
        (await japaneseGenreBtn.getAttribute('aria-pressed')) === 'true' &&
          (await anyGenreBtn.getAttribute('aria-pressed')) === 'false',
      )
      await anyGenreBtn.click() // 以降の提案テストに影響しないよう「指定なし」に戻す
      await mp3Page.waitForTimeout(200)

      // 「高たんぱく優先」トグルが表示される
      const highProteinBtn = mp3Page.getByRole('button', { name: '高たんぱく優先', exact: true })
      check(
        'MEALPLAN-03 「高たんぱく優先」トグルは既定でaria-pressed=false',
        (await highProteinBtn.getAttribute('aria-pressed')) === 'false',
      )

      // 先頭の日(月曜)・夕食の主菜行(先頭の「未定」)に「肉じゃが」をピッカーで割り当てる
      await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).first().click()
      await mp3Page.waitForTimeout(400)
      await mp3Page.getByPlaceholder('レシピ名で絞り込み').fill('肉じゃが')
      await mp3Page.waitForTimeout(300)
      await mp3Page.getByText('肉じゃが', { exact: true }).first().click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03 主菜行に肉じゃがを割り当てられる',
        await mp3Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      check(
        'MEALPLAN-03 割り当て後は「未定」が1件減る(14→13)',
        (await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()) === 13,
      )

      // 行単位のサイコロ: 月曜の副菜行(2番目のサイコロ。主菜が埋まっているので枠は
      // 「丸ごと空」ではない)だけを振ると、副菜だけ埋まり主菜(肉じゃが)は変わらない
      const diceButtons = mp3Page.getByRole('button', { name: 'この行にレシピを自動提案する' })
      await diceButtons.nth(1).click()
      await mp3Page.waitForTimeout(400)
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜だけ自動提案しても主菜(肉じゃが)は変わらない',
        await mp3Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      const afterRowDiceEmptyCount = await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()
      check(
        'MEALPLAN-03(行単位のサイコロ) 副菜行が埋まり「未定」がさらに1件減る(13→12)',
        afterRowDiceEmptyCount === 12,
        `count=${afterRowDiceEmptyCount}`,
      )

      // 空き枠のペア提案: 火曜の夕食は主菜・副菜ともまだ未定→3番目のサイコロ(火曜の主菜行)を
      // 振ると、枠が丸ごと空だったため主菜(+副菜)で埋まる。便BH-2で「一品もの(カレー・丼・麺・鍋)の
      // 主菜が選ばれた枠は副菜を空ける」ようになったため、減る未定は2件(通常)か1件(一品もの)。
      // どちらでも主菜は必ず1件埋まる(=最低1件は未定が減る)ことを確認する
      await diceButtons.nth(2).click()
      await mp3Page.waitForTimeout(400)
      const afterPairEmptyCount = await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()
      const pairDelta = afterRowDiceEmptyCount - afterPairEmptyCount
      check(
        'MEALPLAN-03(空き枠のペア提案) サイコロ1回で主菜(+副菜)が埋まる(一品ものなら副菜は空く)',
        pairDelta === 1 || pairDelta === 2,
        `before=${afterRowDiceEmptyCount} after=${afterPairEmptyCount} delta=${pairDelta}`,
      )

      // ＋枠を追加: 水曜(3番目の「＋枠を追加」ボタン。まだ未着手の日)で主菜をもう1行追加すると
      // 「未定」が1件増える
      const addRowButtons = mp3Page.getByRole('button', { name: '＋枠を追加' })
      await addRowButtons.nth(2).click()
      await mp3Page.waitForTimeout(200)
      await mp3Page.getByRole('button', { name: '主菜', exact: true }).click()
      await mp3Page.waitForTimeout(300)
      check(
        'MEALPLAN-03(＋枠を追加) 行を追加すると「未定」が1件増える',
        (await mp3Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()) === afterPairEmptyCount + 1,
      )
    } finally {
      await mp3Browser.close()
    }
  }

  // --- MEALPLAN-04: 「まとめて献立を立てる」の再抽選(修正1b・2026-07-14オーナー実機
  // フィードバック)。以前は空き枠だけ埋めるため2回目以降のタップが無反応だった。
  // 押すたびに「自動提案由来の枠」を一旦クリアしてから主菜+副菜のペアで埋め直す(再抽選)。
  // 2026-07-22 便BEで「手動配置の枠は保護する」仕様が入ったが、このテストは手動配置が
  // 一切ない(全枠が自動提案由来)状態なので、全枠が再抽選対象になり従来どおり全idが入れ替わる。
  // mealPlansテーブルの行idがクリア→再作成で入れ替わる(削除+追加のため必ず新しいautoIncrement
  // idになる)ことで再抽選を検証する。手動枠が保護されることは MEALPLAN-08 で別途検証する ---
  currentCheck = 'MEALPLAN-04'
  {
    const mp4Browser = await chromium.launch()
    const mp4Context = await mp4Browser.newContext()
    const mp4Page = await mp4Context.newPage()
    mp4Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-04] ${text}`)
    })
    mp4Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-04] ${err.message}`)
    })
    try {
      await mp4Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp4Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      // 便U-1: 既定タブは「日」になったため、「まとめて献立を立てる」がある「週」タブへ切り替える
      await mp4Page.getByRole('button', { name: '週', exact: true }).click()
      await mp4Page.waitForTimeout(300)
      // 2026-07-16 便W-⑤a: 過去日はまとめて献立の対象外になったため、実行日の曜日に関係なく
      // 「7日×主菜+副菜=14件が全部埋まる」を保証するには表示中の週を全日程未来にする必要がある
      // (MEALPLAN-03と同じ理由。「次の週」に進めば当週の月曜は実行日に関わらず必ず未来日)
      await mp4Page.locator('button[aria-label="次の週"]').click()
      await mp4Page.waitForTimeout(300)

      // 便BH-2: 一品もの(カレー・丼・麺・鍋)の主菜が選ばれた枠は副菜を空けるため、埋まる件数は
      // 7(全部一品もの)〜14(全部通常)の範囲でばらつく。件数固定ではなく「毎日必ず主菜が1件立つ」
      // という不変条件で検証する。あわせて主菜・レシピのdishTypeも読む
      const dinnerRows = () =>
        mp4Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
                const mpReq = tx.objectStore('mealPlans').getAll()
                const rcReq = tx.objectStore('recipes').getAll()
                let mp, rc
                const done = () => {
                  if (mp === undefined || rc === undefined) return
                  const dishTypeById = new Map(rc.map((r) => [r.id, r.dishType]))
                  resolve(
                    mp
                      .filter((row) => row.slot === 'dinner')
                      .map((row) => ({
                        id: row.id,
                        role: row.role,
                        dishType: dishTypeById.get(row.recipeId),
                      })),
                  )
                }
                mpReq.onsuccess = () => {
                  mp = mpReq.result
                  done()
                }
                rcReq.onsuccess = () => {
                  rc = rcReq.result
                  done()
                }
                mpReq.onerror = () => reject(mpReq.error)
                rcReq.onerror = () => reject(rcReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      const fillWeekBtn = mp4Page.getByRole('button', { name: 'まとめて献立を立てる' })
      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      const rowsAfterFirst = await dinnerRows()
      const mainsAfterFirst = rowsAfterFirst.filter((r) => r.role === 'main')
      check(
        'MEALPLAN-04 1回目の「まとめて献立を立てる」で7日すべてに主菜が1件立つ',
        mainsAfterFirst.length === 7,
        `主菜=${mainsAfterFirst.length}件`,
      )
      check(
        'MEALPLAN-04 1回目の合計は7〜14件(一品ものの日は副菜が空く)',
        rowsAfterFirst.length >= 7 && rowsAfterFirst.length <= 14,
        `合計=${rowsAfterFirst.length}件`,
      )
      // 便BH-2 タスク2: 主菜スロットは必ずdishType=mainのレシピから選ばれる(野菜炒め=side等は主菜に来ない)
      check(
        'MEALPLAN-04 主菜は必ずdishType=mainのレシピから選ばれる',
        mainsAfterFirst.every((r) => r.dishType === 'main'),
        `主菜のdishType=${JSON.stringify(mainsAfterFirst.map((r) => r.dishType))}`,
      )
      const idsAfterFirst = rowsAfterFirst.map((r) => r.id)

      await fillWeekBtn.click()
      await mp4Page.waitForTimeout(1000)
      const rowsAfterSecond = await dinnerRows()
      check(
        'MEALPLAN-04 2回目のタップも無反応にならず、7日すべてに主菜が立つ(以前は無反応バグがあった)',
        rowsAfterSecond.filter((r) => r.role === 'main').length === 7,
      )
      const idsAfterSecond = rowsAfterSecond.map((r) => r.id)
      const overlappingIds = idsAfterSecond.filter((id) => idsAfterFirst.includes(id))
      check(
        'MEALPLAN-04 2回目は「全部埋まっているので無視」ではなく、全行を一旦クリアしてから' +
          '再作成する(旧idが1件も残らない=以前の「空き枠だけ埋める」実装なら2回目は無反応で' +
          'idが完全一致していたはず)',
        overlappingIds.length === 0,
        `overlap=${JSON.stringify(overlappingIds)}`,
      )
    } finally {
      await mp4Browser.close()
    }
  }

  // --- MEALPLAN-05: 日タブの週プラン自動取り込み(便U-3・2026-07-16 Fable設計)。
  // 日タブを開いたとき、今日の日付の週プラン登録(表示中の食事帯のみ)が今日の献立へ
  // 自動で取り込まれること。加えて冪等性の2点:
  //  (a) 2回開いても重複しない(importRecipeIdsToTodayListの重複スキップ+lastAutoImportDate)
  //  (b) 取り込まれた品をユーザーが消した後にもう一度開いても、その日のうちは再出現しない
  //      (settings.lastAutoImportDateに今日の日付が記録済みのため自動実行がスキップされる)
  // 非表示帯(朝食)の登録は取り込まれないことも確認する。まっさらプロファイル(新規ユーザー
  // 既定=夕食のみ表示)で検証するため専用browser/contextを使う ---
  currentCheck = 'MEALPLAN-05'
  {
    const mp5Browser = await chromium.launch()
    const mp5Context = await mp5Browser.newContext()
    const mp5Page = await mp5Context.newPage()
    mp5Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-05] ${text}`)
    })
    mp5Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-05] ${err.message}`)
    })
    try {
      // まずレシピ一覧で初回シードを済ませ、今日の週プランをIndexedDB直書きで用意する:
      // 夕食(表示帯)に肉じゃが(主菜)+カレーライス(副菜扱い)、朝食(非表示帯)に豚の生姜焼き
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1800) // 初回シード完了待ち
      const seeded = await mp5Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const d = new Date()
            const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const rtx = idb.transaction('recipes', 'readonly')
              const g = rtx.objectStore('recipes').getAll()
              g.onsuccess = () => {
                const byTitle = (t) => g.result.find((r) => r.title === t)?.id
                const nikujaga = byTitle('肉じゃが')
                const curry = byTitle('カレーライス')
                const shogayaki = byTitle('豚の生姜焼き')
                if (!nikujaga || !curry || !shogayaki) {
                  resolve({ ok: false })
                  return
                }
                const wtx = idb.transaction('mealPlans', 'readwrite')
                const store = wtx.objectStore('mealPlans')
                store.add({ date, slot: 'dinner', recipeId: nikujaga, role: 'main' })
                store.add({ date, slot: 'dinner', recipeId: curry, role: 'side' })
                store.add({ date, slot: 'breakfast', recipeId: shogayaki, role: 'main' })
                wtx.oncomplete = () => resolve({ ok: true })
                wtx.onerror = () => reject(wtx.error)
              }
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      check('MEALPLAN-05 前提: 今日の週プラン(夕食2件+朝食1件)を直接投入できる', seeded.ok)

      // todayListの実データを直接読むヘルパー(重複の有無を黒箱の見た目でなくDBで断定する)
      const todayListRecipeIds = () =>
        mp5Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('todayList', 'readonly')
                const g = tx.objectStore('todayList').getAll()
                g.onsuccess = () => resolve(g.result.map((row) => row.recipeId))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // 1回目: 献立タブを開く(既定=日タブ)→夕食の2件だけが自動で今日の献立に入る
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200) // 自動取り込み+liveQuery反映待ち
      const mp5BodyAfterFirst = await mp5Page.textContent('body')
      check(
        'MEALPLAN-05 日タブを開くと夕食(表示帯)の週プラン2件が今日の献立に自動で入る',
        mp5BodyAfterFirst.includes('肉じゃが') && mp5BodyAfterFirst.includes('カレーライス'),
      )
      check(
        'MEALPLAN-05 朝食(非表示帯)の登録は取り込まれない',
        !mp5BodyAfterFirst.includes('豚の生姜焼き'),
      )
      const idsAfterFirstOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05 todayListの実データは2件(夕食の2件のみ)',
        idsAfterFirstOpen.length === 2,
        `ids=${JSON.stringify(idsAfterFirstOpen)}`,
      )

      // 2回目: 一旦別ページへ抜けて開き直す(再マウント)→重複しない(冪等)
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterSecondOpen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(冪等) 2回開いてもtodayListは2件のまま重複しない',
        idsAfterSecondOpen.length === 2,
        `ids=${JSON.stringify(idsAfterSecondOpen)}`,
      )

      // 削除→開き直し: 肉じゃがを×で外す→開き直しても再出現しない
      // (lastAutoImportDateに今日が記録済みのため、その日のうちの自動再取り込みはスキップ)
      const removeButtons = mp5Page.locator('button[aria-label="この献立から外す"]')
      const removeCountBefore = await removeButtons.count()
      check('MEALPLAN-05 前提: 今日の献立に×ボタンが2つ出ている', removeCountBefore === 2)
      // 1行目(肉じゃが)の×を押す
      await removeButtons.first().click()
      await mp5Page.waitForTimeout(500)
      const idsAfterRemove = await todayListRecipeIds()
      check(
        'MEALPLAN-05 ×で1件外すとtodayListは1件になる',
        idsAfterRemove.length === 1,
        `ids=${JSON.stringify(idsAfterRemove)}`,
      )
      await mp5Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(300)
      await mp5Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp5Page.waitForTimeout(1200)
      const idsAfterReopen = await todayListRecipeIds()
      check(
        'MEALPLAN-05(再出現防止) 削除後に日タブを開き直しても消した品は戻らない(1件のまま)',
        idsAfterReopen.length === 1 &&
          JSON.stringify(idsAfterReopen) === JSON.stringify(idsAfterRemove),
        `before=${JSON.stringify(idsAfterRemove)} after=${JSON.stringify(idsAfterReopen)}`,
      )
    } finally {
      await mp5Browser.close()
    }
  }

  // --- MEALPLAN-06: ランダム週献立の過去日保護(2026-07-16 便W-⑤a・オーナー指示2026-07-16夜)。
  // 「まとめて献立」「サイコロ」は過去日(今日より前)の枠を対象外にする(上書きも新規埋めもしない)。
  // 「前の週」は実行日の曜日に関わらず必ず全7日が過去日になる(当週の月曜が実行日以前でも、
  // 前の週の日曜は必ずそれよりさらに前)ため、実行日に依存しない決定的なテストになる ---
  currentCheck = 'MEALPLAN-06'
  {
    const mp6Browser = await chromium.launch()
    const mp6Context = await mp6Browser.newContext()
    const mp6Page = await mp6Context.newPage()
    mp6Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-06] ${text}`)
    })
    mp6Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-06] ${err.message}`)
    })
    try {
      await mp6Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp6Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      await mp6Page.getByRole('button', { name: '週', exact: true }).click()
      await mp6Page.waitForTimeout(300)
      await mp6Page.locator('button[aria-label="前の週"]').click()
      await mp6Page.waitForTimeout(300)

      // 前提: 表示中の週は全日程が過去日(既定は夕食のみ表示なので7日×2行=14件の「未定」)
      check(
        'MEALPLAN-06 前提: 前の週(全日程過去日)も既定どおり7日×2行(未定×14)が並ぶ',
        (await mp6Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()) === 14,
      )
      // (a) 過去日にはサイコロ(行の自動提案)ボタン自体が出ない
      check(
        'MEALPLAN-06(過去日保護a) 過去週にはサイコロボタンが1つも出ない',
        (await mp6Page.getByRole('button', { name: 'この行にレシピを自動提案する' }).count()) === 0,
      )
      // (a) 「まとめて献立を立てる」を押しても過去週は一切埋まらない(上書きも新規埋めもしない)
      await mp6Page.getByRole('button', { name: 'まとめて献立を立てる' }).click()
      await mp6Page.waitForTimeout(600)
      check(
        'MEALPLAN-06(過去日保護a) 「まとめて献立を立てる」を押しても過去週は未定のまま(14件不変)',
        (await mp6Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).count()) === 14,
      )
    } finally {
      await mp6Browser.close()
    }
  }

  // --- MEALPLAN-08: 手動配置の保護(2026-07-22 便BE・外部レビューで見つかったUX欠陥の修正)。
  // 週の枠に手動でレシピ(肉じゃが)を入れた直後に「まとめて献立を立てる」を押しても、
  // その手動配置が無警告で上書き削除されず、同じmealPlans行id・同じレシピのまま残ることを
  // IndexedDB直読みで検証する。旧実装は表示中の全枠を一旦クリアしていたため手動配置が消えていた。
  // 併せて、空き枠は自動提案で埋まること・「手動で入れた◯枠は残した」トーストが出ること・
  // 2回押しても手動枠が保護され続けること(自動枠だけ再抽選)を確認する。
  // まっさらプロファイルで検証するため専用browser/contextを使う ---
  currentCheck = 'MEALPLAN-08'
  {
    const mp8Browser = await chromium.launch()
    const mp8Context = await mp8Browser.newContext()
    const mp8Page = await mp8Context.newPage()
    mp8Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-08] ${text}`)
    })
    mp8Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-08] ${err.message}`)
    })
    try {
      // 夕食枠の全mealPlans行(id・recipeId・auto)を読む(手動行が上書きされないことの検証用)
      const dinnerRows = () =>
        mp8Page.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const idb = req.result
                const tx = idb.transaction('mealPlans', 'readonly')
                const getAllReq = tx.objectStore('mealPlans').getAll()
                getAllReq.onsuccess = () =>
                  resolve(
                    getAllReq.result
                      .filter((row) => row.slot === 'dinner')
                      .map((row) => ({ id: row.id, date: row.date, recipeId: row.recipeId, role: row.role, auto: row.auto ?? false })),
                  )
                getAllReq.onerror = () => reject(getAllReq.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      await mp8Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp8Page.waitForTimeout(1800) // 初回シード完了待ち(既定表示は夕食のみ)
      await mp8Page.getByRole('button', { name: '週', exact: true }).click()
      await mp8Page.waitForTimeout(300)
      // 全日程を未来日にするため「次の週」へ(過去日保護と切り分ける。MEALPLAN-03/04と同じ理由)
      await mp8Page.locator('button[aria-label="次の週"]').click()
      await mp8Page.waitForTimeout(300)

      // 月曜・夕食の主菜行(先頭の「未定」)に肉じゃがを手動で割り当てる
      await mp8Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).first().click()
      await mp8Page.waitForTimeout(400)
      await mp8Page.getByPlaceholder('レシピ名で絞り込み').fill('肉じゃが')
      await mp8Page.waitForTimeout(300)
      await mp8Page.getByText('肉じゃが', { exact: true }).first().click()
      await mp8Page.waitForTimeout(400)

      const rowsBefore = await dinnerRows()
      check('MEALPLAN-08 前提: 手動配置の夕食行が1件だけある', rowsBefore.length === 1)
      const manual = rowsBefore[0]
      check('MEALPLAN-08 前提: 手動配置の行はauto=false(手動扱い)', manual.auto === false)

      // 「まとめて献立を立てる」を押す
      const fillWeekBtn = mp8Page.getByRole('button', { name: 'まとめて献立を立てる' })
      await fillWeekBtn.click()
      await mp8Page.waitForTimeout(1000)

      // 核心: 手動配置の行が同じid・同じレシピ・手動のまま残る(無警告で上書き削除されない)
      const rowsAfter = await dinnerRows()
      check(
        'MEALPLAN-08 手動配置の行が上書き削除されず、同じid・同じレシピのまま残る',
        rowsAfter.some((r) => r.id === manual.id && r.recipeId === manual.recipeId && r.auto === false),
      )
      // 肉じゃがが画面にも残っている
      check(
        'MEALPLAN-08 肉じゃがが週ビューに残って見える',
        await mp8Page.getByRole('button', { name: '肉じゃが' }).first().isVisible(),
      )
      // 空き枠は自動提案で埋まる(手動の1枠以外の夕食に自動行が増える)
      const autoRowsAfter = rowsAfter.filter((r) => r.auto === true)
      check(
        'MEALPLAN-08 空いていた枠は自動提案で埋まる(自動行が1件以上増える)',
        autoRowsAfter.length >= 1,
      )
      // 便BH-2(役割粒度の保護): 手動主菜(肉じゃが=一品ものでない)だけ入れた枠は、主菜を残したまま
      // 空いていた副菜だけが自動で埋まる。手動主菜と同じ日に、自動の副菜行が足される
      check(
        'MEALPLAN-08(役割粒度) 手動主菜だけの枠に副菜だけが自動提案で足される',
        rowsAfter.some(
          (r) => r.date === manual.date && r.role === 'side' && r.auto === true,
        ) && rowsAfter.some((r) => r.id === manual.id && r.role === 'main' && r.auto === false),
      )
      // 「手動で入れた◯枠は残した」トーストが出る(結果メッセージで明示)
      check(
        'MEALPLAN-08 手動枠を残した旨のトーストが出る',
        await mp8Page.getByText('手動で入れた', { exact: false }).first().isVisible(),
      )

      // 2回目のタップでも手動枠は保護され続ける(自動枠だけ再抽選される)
      await fillWeekBtn.click()
      await mp8Page.waitForTimeout(1000)
      const rowsAfter2 = await dinnerRows()
      check(
        'MEALPLAN-08 2回押しても手動配置の行(id・レシピ)は保護され続ける',
        rowsAfter2.some((r) => r.id === manual.id && r.recipeId === manual.recipeId && r.auto === false),
      )
    } finally {
      await mp8Browser.close()
    }
  }

  // --- MEALPLAN-09: 便BH-2の新仕様を決定的に検証する(docs/56)。
  //  (A) 一品もの(カレー)の主菜を手動で入れた枠は、まとめて献立でも副菜を足さない(1品で完結) /
  //  (B) 主菜と副菜のジャンルが食い違う枠には「ジャンル混在」バッジが控えめに出る ---
  currentCheck = 'MEALPLAN-09'
  {
    const mp9Browser = await chromium.launch()
    const mp9Context = await mp9Browser.newContext()
    const mp9Page = await mp9Context.newPage()
    mp9Page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-09] ${text}`)
    })
    mp9Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-09] ${err.message}`)
    })
    try {
      // 「先頭の未定」の行にレシピを手動割り当てするヘルパー(ピッカーで検索して選ぶ)
      const assign = async (title) => {
        await mp9Page.getByRole('button', { name: 'レシピを選ぶ', exact: true }).first().click()
        await mp9Page.waitForTimeout(400)
        await mp9Page.getByPlaceholder('レシピ名で絞り込み').fill(title)
        await mp9Page.waitForTimeout(300)
        await mp9Page.getByText(title, { exact: true }).first().click()
        await mp9Page.waitForTimeout(400)
      }

      await mp9Page.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await mp9Page.waitForTimeout(1800)
      await mp9Page.getByRole('button', { name: '週', exact: true }).click()
      await mp9Page.waitForTimeout(300)
      // 全日程を未来日にする(MEALPLAN-03/04/08と同じ理由)
      await mp9Page.locator('button[aria-label="次の週"]').click()
      await mp9Page.waitForTimeout(300)

      // (B) 月曜: 主菜=肉じゃが(和食)→副菜=ポテトサラダ(洋食)を手動で入れる(ジャンルが食い違う)。
      // 先頭の未定=月曜の主菜、次の先頭の未定=月曜の副菜(主菜が埋まると副菜が先頭になる)
      await assign('肉じゃが')
      await assign('ポテトサラダ')
      check(
        'MEALPLAN-09(B) 主菜(和食)と副菜(洋食)が食い違う枠に「ジャンル混在」バッジが出る',
        (await mp9Page.getByText('ジャンル混在', { exact: true }).count()) >= 1,
      )

      // (A) 火曜: 主菜=カレーライス(一品もの)を手動で入れる(次の先頭の未定=火曜の主菜)
      await assign('カレーライス')
      await mp9Page.getByRole('button', { name: 'まとめて献立を立てる' }).click()
      await mp9Page.waitForTimeout(1200)

      // カレーの入った枠(date)に副菜行が無いことをIndexedDBで確認
      const rows = await mp9Page.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const idb = req.result
              const tx = idb.transaction(['mealPlans', 'recipes'], 'readonly')
              const mpReq = tx.objectStore('mealPlans').getAll()
              const rcReq = tx.objectStore('recipes').getAll()
              let mp, rc
              const done = () => {
                if (mp === undefined || rc === undefined) return
                const titleById = new Map(rc.map((r) => [r.id, r.title]))
                resolve(
                  mp
                    .filter((r) => r.slot === 'dinner')
                    .map((r) => ({ date: r.date, role: r.role, title: titleById.get(r.recipeId) })),
                )
              }
              mpReq.onsuccess = () => {
                mp = mpReq.result
                done()
              }
              rcReq.onsuccess = () => {
                rc = rcReq.result
                done()
              }
              mpReq.onerror = () => reject(mpReq.error)
              rcReq.onerror = () => reject(rcReq.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )
      const curryRow = rows.find((r) => r.title === 'カレーライス')
      const curryDate = curryRow?.date
      const sidesOnCurryDay = rows.filter((r) => r.date === curryDate && r.role === 'side')
      check(
        'MEALPLAN-09(A) 一品もの(カレー)の主菜を入れた枠には、まとめて献立でも副菜が足されない',
        !!curryRow && sidesOnCurryDay.length === 0,
        `curryDate=${curryDate} sides=${JSON.stringify(sidesOnCurryDay)}`,
      )
    } finally {
      await mp9Browser.close()
    }
  }

  // --- SLOTWIN-01: 「今日の献立に追加」のスロット振り分け窓(2026-07-17 便Z-1・docs/35 §2)。
  // レシピ詳細のボタン押下で「どの食事に入れますか？」の窓が開き、
  // (a) 「夕食」を選ぶと週プランの今日の夕食枠に入り(IndexedDB直読み)、今日の献立(日タブ)にも
  //     反映される(=1操作で両方に反映)
  // (b) 同じ枠に同じレシピが既にあるときは重複させずトーストで案内される(件数不変)
  // (c) 「決めない」は従来どおりtodayListへの直接追加のみ(週プランには入らない) ---
  currentCheck = 'SLOTWIN-01'
  {
    const swBrowser = await chromium.launch()
    const swContext = await swBrowser.newContext()
    const swPage = await swContext.newPage()
    swPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@SLOTWIN-01] ${text}`)
    })
    swPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SLOTWIN-01] ${err.message}`)
    })
    try {
      await swPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(1800) // 初回シード完了待ち

      // mealPlans/todayListをIndexedDB直読みするヘルパー(今日の日付はブラウザ側で算出)
      const countTodaySlotEntries = (recipeId, slot) =>
        swPage.evaluate(
          ({ recipeId, slot }) =>
            new Promise((resolve, reject) => {
              const d = new Date()
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('mealPlans', 'readonly')
                const g = tx.objectStore('mealPlans').getAll()
                g.onsuccess = () =>
                  resolve(
                    g.result.filter(
                      (row) => row.date === date && row.slot === slot && row.recipeId === recipeId,
                    ).length,
                  )
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
          { recipeId, slot },
        )
      const todayListIds = () =>
        swPage.evaluate(
          () =>
            new Promise((resolve, reject) => {
              const req = indexedDB.open('uchi-recipe')
              req.onsuccess = () => {
                const tx = req.result.transaction('todayList', 'readonly')
                const g = tx.objectStore('todayList').getAll()
                g.onsuccess = () => resolve(g.result.map((row) => row.recipeId))
                g.onerror = () => reject(g.error)
              }
              req.onerror = () => reject(req.error)
            }),
        )

      // (a) 肉じゃがの詳細でボタン押下→窓→「夕食」
      await swPage.getByText('肉じゃが', { exact: true }).first().click()
      await swPage.waitForTimeout(500)
      const swRecipeId = Number(swPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await swPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await swPage.waitForTimeout(300)
      check(
        'SLOTWIN-01 ボタン押下で窓「どの食事に入れますか？」が開く',
        (await swPage.textContent('body')).includes('どの食事に入れますか？'),
      )
      await swPage.getByRole('button', { name: '夕食', exact: true }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01 「今日の夕食に追加しました」トーストが出る',
        (await swPage.textContent('body')).includes('今日の夕食に追加しました'),
      )
      check(
        'SLOTWIN-01 ボタンが「今日の献立に追加済み」表示に変わる',
        (await swPage.textContent('body')).includes('今日の献立に追加済み'),
      )
      check(
        'SLOTWIN-01 週プランの今日の夕食枠に入る(mealPlansに1件)',
        (await countTodaySlotEntries(swRecipeId, 'dinner')) === 1,
      )
      check(
        'SLOTWIN-01 今日の献立(todayList)にも入る(1操作で両方に反映)',
        (await todayListIds()).includes(swRecipeId),
      )

      // 日タブに反映されている(今日の献立セクションに肉じゃがが出る)
      await swPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(1200)
      check(
        'SLOTWIN-01 日タブの今日の献立に反映される',
        (await swPage.textContent('body')).includes('肉じゃが'),
      )
      // 週タブの今日の夕食枠にも見える
      await swPage.getByRole('button', { name: '週', exact: true }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01 週タブの今日の枠にも肉じゃがが見える',
        (await swPage.textContent('body')).includes('肉じゃが'),
      )

      // (b) 重複ガード: 今日の献立から一旦外し(ボタンを「追加」状態に戻す)、
      // もう一度窓→夕食を選ぶと、重複させずトーストで案内される
      await swPage.getByRole('button', { name: '日', exact: true }).click()
      await swPage.waitForTimeout(500)
      await swPage.locator('button[aria-label="この献立から外す"]').first().click()
      await swPage.waitForTimeout(500)
      await swPage.goto(`${BASE}/#/recipes/${swRecipeId}`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(500)
      await swPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await swPage.waitForTimeout(300)
      await swPage.getByRole('button', { name: '夕食', exact: true }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01(重複) 「今日の夕食にすでに入っています」トーストが出る',
        (await swPage.textContent('body')).includes('今日の夕食にすでに入っています'),
      )
      check(
        'SLOTWIN-01(重複) mealPlansの夕食枠は1件のまま増えない',
        (await countTodaySlotEntries(swRecipeId, 'dinner')) === 1,
      )
      check(
        'SLOTWIN-01(重複) 重複時はtodayListにも追加しない(トースト案内のみ)',
        !(await todayListIds()).includes(swRecipeId),
      )

      // (c) 「決めない」: カレーライスで窓→決めない→todayListのみ(週プランには入らない)
      await swPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await swPage.waitForTimeout(500)
      await swPage.getByText('カレーライス', { exact: true }).first().click()
      await swPage.waitForTimeout(500)
      const swCurryId = Number(swPage.url().match(/#\/recipes\/(\d+)/)?.[1])
      await swPage.getByRole('button', { name: '今日の献立に追加' }).click()
      await swPage.waitForTimeout(300)
      await swPage.getByRole('button', { name: '決めない' }).click()
      await swPage.waitForTimeout(500)
      check(
        'SLOTWIN-01(決めない) todayListへ直接追加される',
        (await todayListIds()).includes(swCurryId),
      )
      const swCurrySlotCounts = await Promise.all(
        ['breakfast', 'lunch', 'dinner'].map((slot) => countTodaySlotEntries(swCurryId, slot)),
      )
      check(
        'SLOTWIN-01(決めない) 週プランのどの枠にも入らない(従来どおりの枠なし追加)',
        swCurrySlotCounts.every((n) => n === 0),
        `counts=${JSON.stringify(swCurrySlotCounts)}`,
      )
    } finally {
      await swBrowser.close()
    }
  }

  // --- PASTLOG-01: 週/月の過去振り返り(2026-07-17 便Z-2・docs/35 §3)。
  // 昨日の日付で「作った！」記録を付け、
  // (a) 週タブの昨日の枠に「作った記録」の薄いカード(レシピ名+✓)が出ること
  //     (昨日が前週に当たる=実行日が月曜の場合は「前の週」へ移動してから確認)、
  // (b) 月タブ(Pro解錠)のカレンダー日に「記録あり」小マークが出て、その日をタップした
  //     日モーダルに作った記録が表示されること、を確認する。
  // 月間献立への機能追加はPro v2まで凍結が既定だったが、オーナー指示で解除して実装した分 ---
  currentCheck = 'PASTLOG-01'
  {
    const plBrowser = await chromium.launch()
    const plContext = await plBrowser.newContext()
    const plPage = await plContext.newPage()
    plPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@PASTLOG-01] ${text}`)
    })
    plPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PASTLOG-01] ${err.message}`)
    })
    try {
      const plPad = (n) => String(n).padStart(2, '0')
      const plToday = new Date()
      const plYd = new Date()
      plYd.setDate(plYd.getDate() - 1)
      const plYesterday = `${plYd.getFullYear()}-${plPad(plYd.getMonth() + 1)}-${plPad(plYd.getDate())}`
      const plYesterdaySlash = plYesterday.replaceAll('-', '/')

      await plPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await plPage.waitForTimeout(1800) // 初回シード完了待ち

      // 肉じゃがに「作った！」記録を昨日の日付で付ける(実UIのCookedLogModal経由)
      await plPage.getByText('肉じゃが', { exact: true }).first().click()
      await plPage.waitForTimeout(500)
      await plPage.getByRole('button', { name: '作った！' }).click()
      await plPage.waitForTimeout(300)
      await plPage.locator('input[type="date"]').fill(plYesterday)
      await plPage.getByRole('button', { name: '記録する' }).click()
      await plPage.waitForTimeout(500)
      check(
        'PASTLOG-01 前提: 昨日の日付で作った記録を保存できる',
        (await plPage.textContent('body')).includes('作った記録をつけました'),
      )

      // (a) 週タブ: 昨日の枠に「作った記録」カード(レシピ名+✓)が出る
      await plPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await plPage.waitForTimeout(800)
      await plPage.getByRole('button', { name: '週', exact: true }).click()
      await plPage.waitForTimeout(500)
      if (!(await plPage.textContent('body')).includes(plYesterdaySlash)) {
        // 実行日が月曜のときだけ、昨日(日曜)は前の週に表示される
        await plPage.locator('button[aria-label="前の週"]').click()
        await plPage.waitForTimeout(500)
      }
      const plDayCardText = await plPage
        .locator('section', { hasText: plYesterdaySlash })
        .first()
        .textContent()
      check(
        'PASTLOG-01 週タブの昨日の枠に「作った記録」+レシピ名が出る',
        !!plDayCardText && plDayCardText.includes('作った記録') && plDayCardText.includes('肉じゃが'),
        `昨日カード=${plDayCardText?.slice(0, 120)}`,
      )

      // (b) 月タブ: Pro解錠(月間はPro機能。実コードは台帳原本のためNUT-02等と同様
      // settings.proCodeの直書きで「解錠済み」状態だけ再現)→「記録あり」マーク→日モーダル
      await plPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            const putReq = store.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })
      await plPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await plPage.reload({ waitUntil: 'networkidle' })
      await plPage.waitForTimeout(800)
      await plPage.getByRole('button', { name: '月', exact: true }).click()
      await plPage.waitForTimeout(500)
      if (plYesterday.slice(0, 7) !== `${plToday.getFullYear()}-${plPad(plToday.getMonth() + 1)}`) {
        // 実行日が月初(1日)のときだけ、昨日は前の月に表示される
        await plPage.locator('button[aria-label="前の月"]').click()
        await plPage.waitForTimeout(500)
      }
      check(
        'PASTLOG-01 月カレンダーに「記録あり」小マークが出る',
        (await plPage.locator('[aria-label="記録あり"]').count()) >= 1,
      )
      // 「記録あり」マークの付いた日(=昨日)をタップ→日モーダルに作った記録が出る
      await plPage
        .locator('button', { has: plPage.locator('[aria-label="記録あり"]') })
        .first()
        .click()
      await plPage.waitForTimeout(500)
      const plModalText = await plPage.locator('[role="dialog"]').first().textContent()
      check(
        'PASTLOG-01 日モーダルにその日の「作った記録」が表示される',
        !!plModalText && plModalText.includes('作った記録') && plModalText.includes('肉じゃが'),
        `モーダル=${plModalText?.slice(0, 120)}`,
      )
    } finally {
      await plBrowser.close()
    }
  }

  // --- MEALPLAN-07: 献立タブ・月タブ「期間の食費」(2026-07-17 便AB・オーナー決定・docs/35 §5)。
  // モードボタンで開始日→終了日の2タップ選択→範囲ハイライト+結果カード(合計・1日あたり平均・
  // 日数)が出ること。モード中は日タップが範囲選択に使われ、既存の日モーダル(便U-5)が出ないこと。
  // モード解除で日モーダルが復活すること。終了日<開始日の順にタップしても自動で入れ替わり
  // 結果が変わらないことも確認する。概算食費は既存の週集計と同方式(登録人数基準・
  // sumMealPlanEntriesCost)のため、肉じゃがの詳細画面に出る「概算食費」の実測値を2倍した値と
  // 期間合計が一致することを検証する(価格マスタの初期値そのものに依存せず決定的に確認できる) ---
  currentCheck = 'MEALPLAN-07'
  {
    const rcBrowser = await chromium.launch()
    const rcContext = await rcBrowser.newContext()
    const rcPage = await rcContext.newPage()
    rcPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@MEALPLAN-07] ${text}`)
    })
    rcPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@MEALPLAN-07] ${err.message}`)
    })
    try {
      await rcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(1800) // 初回シード完了待ち

      // 肉じゃがの単品概算食費(登録人数基準)を実UIから読み取る
      await rcPage.getByText('肉じゃが', { exact: true }).first().click()
      await rcPage.waitForTimeout(500)
      const rcDetailText = (await rcPage.textContent('body')) ?? ''
      const rcSingleMatch = rcDetailText.match(/約([\d,]+)円/)
      const rcSingleCost = Number((rcSingleMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'MEALPLAN-07 前提: 肉じゃがの概算食費が読み取れる(0円ではない)',
        rcSingleCost > 0,
        `rcSingleCost=${rcSingleCost}`,
      )

      const rcRecipeId = await rcPage.evaluate(
        () =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readonly')
              const g = tx.objectStore('recipes').getAll()
              g.onsuccess = () => resolve(g.result.find((r) => r.title === '肉じゃが')?.id)
              g.onerror = () => reject(g.error)
            }
            req.onerror = () => reject(req.error)
          }),
      )

      // 表示中の月の3日・8日の夕食枠に肉じゃがを直接投入(2件・同じレシピ)。
      // どの月も28日以上あるため月末をまたがず安全に使える日付
      const rcNow = new Date()
      const rcPrefix = `${rcNow.getFullYear()}-${String(rcNow.getMonth() + 1).padStart(2, '0')}`
      const rcStartDate = `${rcPrefix}-03`
      const rcEndDate = `${rcPrefix}-08`
      await rcPage.evaluate(
        ({ recipeId, dates }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('mealPlans', 'readwrite')
              const store = tx.objectStore('mealPlans')
              dates.forEach((date) => store.add({ date, slot: 'dinner', recipeId, role: 'main' }))
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { recipeId: rcRecipeId, dates: [rcStartDate, rcEndDate] },
      )

      // Pro解錠(IndexedDB直書き。PASTLOG-01と同じ「解錠済み状態の再現」手法)
      await rcPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            const putReq = store.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
            putReq.onsuccess = () => resolve(undefined)
            putReq.onerror = () => reject(putReq.error)
          }
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
      })

      await rcPage.goto(`${BASE}/#/meal-plan`, { waitUntil: 'networkidle' })
      await rcPage.reload({ waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(800)
      await rcPage.getByRole('button', { name: '月', exact: true }).click()
      await rcPage.waitForTimeout(500)

      const rcMonthGrid = rcPage.locator('div.grid.grid-cols-7').last()
      // getByRole('button', {name})は使えない: 献立ありの日は「献立あり」マーク(dot)のaria-labelが
      // 合成されて役割名が「3 献立あり」等になるため。日の数字だけの完全一致はテキストで絞り込む
      const rcDayButton = (n) => rcMonthGrid.locator('button').filter({ hasText: new RegExp(`^${n}$`) })
      const rcModeBtn = rcPage.getByRole('button', { name: '期間の食費', exact: true })

      // モードON→開始日案内が出る
      await rcModeBtn.click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モードONで開始日案内が出る',
        ((await rcPage.textContent('body')) ?? '').includes('開始日をタップしてください'),
      )
      check('MEALPLAN-07 モードONはaria-pressed=true', (await rcModeBtn.getAttribute('aria-pressed')) === 'true')

      // 開始日(3日)タップ→終了日案内・日モーダルは出ない
      await rcDayButton('3').click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 開始日タップ後は終了日案内が出る',
        ((await rcPage.textContent('body')) ?? '').includes('終了日をタップしてください'),
      )
      check(
        'MEALPLAN-07 モード中は日モーダルが開かない(開始日タップ時点)',
        (await rcPage.locator('[role="dialog"]').count()) === 0,
      )

      // 終了日(8日)タップ→範囲ハイライト+結果カード(合計・1日あたり平均・日数)
      await rcDayButton('8').click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 終了日タップ後も日モーダルは開かない',
        (await rcPage.locator('[role="dialog"]').count()) === 0,
      )
      const rcResultText = (await rcPage.textContent('body')) ?? ''
      check('MEALPLAN-07 結果カードの見出しが出る', rcResultText.includes('期間の食費'))
      check('MEALPLAN-07 結果カードに日数(6日間)が出る', rcResultText.includes('6日間'))
      const rcTotalMatch = rcResultText.match(/約([\d,]+)円/)
      const rcTotal = Number((rcTotalMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'MEALPLAN-07 期間合計=肉じゃが単品概算食費の2倍(登録人数基準・既存の週集計と同方式)',
        rcTotal === rcSingleCost * 2,
        `rcTotal=${rcTotal} rcSingleCost*2=${rcSingleCost * 2}`,
      )
      const rcAvgMatch = rcResultText.match(/1日あたり 約([\d,]+)円/)
      const rcAvg = Number((rcAvgMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'MEALPLAN-07 1日あたり平均=合計÷6日(四捨五入)',
        rcAvg === Math.round(rcTotal / 6),
        `rcAvg=${rcAvg} total=${rcTotal}`,
      )

      // モード解除→日モーダルが復活する(3日タップ)
      await rcModeBtn.click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モード解除後はaria-pressed=false',
        (await rcModeBtn.getAttribute('aria-pressed')) === 'false',
      )
      await rcDayButton('3').click()
      await rcPage.waitForTimeout(300)
      check(
        'MEALPLAN-07 モード解除後は日タップで日モーダルが復活する',
        await rcPage.locator('[role="dialog"]').isVisible(),
      )
      await rcPage.locator('[role="dialog"] button[aria-label="閉じる"]').click()
      await rcPage.waitForTimeout(300)

      // 終了日<開始日の順にタップしても自動で入れ替わり同じ範囲・同じ合計になる
      await rcModeBtn.click()
      await rcPage.waitForTimeout(300)
      await rcDayButton('8').click()
      await rcPage.waitForTimeout(300)
      await rcDayButton('3').click()
      await rcPage.waitForTimeout(300)
      const rcSwappedText = (await rcPage.textContent('body')) ?? ''
      check(
        'MEALPLAN-07 終了日<開始日タップでも自動で入れ替わり同じ範囲になる(6日間)',
        rcSwappedText.includes('6日間'),
      )
      const rcSwappedTotalMatch = rcSwappedText.match(/約([\d,]+)円/)
      const rcSwappedTotal = Number((rcSwappedTotalMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'MEALPLAN-07 逆順タップでも合計は変わらない(自動入れ替え)',
        rcSwappedTotal === rcTotal,
        `rcSwappedTotal=${rcSwappedTotal} rcTotal=${rcTotal}`,
      )

      // 2026-07-24 便BH-3・タスク9: 基準を明示(予定ベース/実績ベース)。ここまでの範囲(3〜8日)には
      // 「作った記録」が無いので実績ベースは「まだ記録がありません」。予定ベースのラベルが出ること・
      // 実績ベースが空案内であることを確認する
      check('MEALPLAN-07(タスク9) 予定ベースのラベルが出る', rcSwappedText.includes('予定ベース'))
      check('MEALPLAN-07(タスク9) 実績ベースのラベルが出る', rcSwappedText.includes('実績ベース'))
      check(
        'MEALPLAN-07(タスク9) 記録が無い期間の実績ベースは「まだ記録がありません」',
        rcSwappedText.includes('この期間にはまだ「作った記録」がありません'),
      )
      check('MEALPLAN-07(タスク9) 予定ベースに「◯食分」が併記される', /\d+食分/.test(rcSwappedText))

      // 期間内(5日)に肉じゃがの「作った記録」を1件注入→再選択で実績ベースが出る。
      // 記録1件=1食、実績原価=肉じゃが単品概算食費、1食あたり=同額(count=1)になる
      await rcPage.evaluate(
        ({ recipeId, date }) =>
          new Promise((resolve, reject) => {
            const req = indexedDB.open('uchi-recipe')
            req.onsuccess = () => {
              const tx = req.result.transaction('recipes', 'readwrite')
              const store = tx.objectStore('recipes')
              const g = store.get(recipeId)
              g.onsuccess = () => {
                const r = g.result
                r.cookedLogs = [{ date }, ...(r.cookedLogs ?? [])]
                store.put(r)
              }
              tx.oncomplete = () => resolve(undefined)
              tx.onerror = () => reject(tx.error)
            }
            req.onerror = () => reject(req.error)
          }),
        { recipeId: rcRecipeId, date: `${rcPrefix}-05` },
      )
      await rcPage.reload({ waitUntil: 'networkidle' })
      await rcPage.waitForTimeout(800)
      await rcPage.getByRole('button', { name: '月', exact: true }).click()
      await rcPage.waitForTimeout(400)
      await rcPage.getByRole('button', { name: '期間の食費', exact: true }).click()
      await rcPage.waitForTimeout(300)
      const rcMonthGrid2 = rcPage.locator('div.grid.grid-cols-7').last()
      const rcDay2 = (n) => rcMonthGrid2.locator('button').filter({ hasText: new RegExp(`^${n}$`) })
      await rcDay2('3').click()
      await rcPage.waitForTimeout(300)
      await rcDay2('8').click()
      await rcPage.waitForTimeout(300)
      const rcActualText = (await rcPage.textContent('body')) ?? ''
      const rcActualMatch = rcActualText.match(/実績ベース（作った記録）\s*約([\d,]+)円（(\d+)食分・1食あたり 約([\d,]+)円）/)
      check(
        'MEALPLAN-07(タスク9) 記録注入後、実績ベースに「約◯円（◯食分・1食あたり 約◯円）」が出る',
        !!rcActualMatch,
        `actualText含む=${rcActualText.includes('実績ベース')} match=${rcActualMatch?.[0]}`,
      )
      if (rcActualMatch) {
        const actualTotal = Number(rcActualMatch[1].replace(/,/g, ''))
        const actualCount = Number(rcActualMatch[2])
        const actualPer = Number(rcActualMatch[3].replace(/,/g, ''))
        check(
          'MEALPLAN-07(タスク9) 実績原価=肉じゃが単品概算食費・食数1・1食あたり=同額',
          actualTotal === rcSingleCost && actualCount === 1 && actualPer === rcSingleCost,
          `total=${actualTotal} count=${actualCount} per=${actualPer} single=${rcSingleCost}`,
        )
      }
    } finally {
      await rcBrowser.close()
    }
  }

  // --- RECIPESET-01: 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)。テーマ全廃
  // (2026-07-23)でテーマ配布(?set=・配布JSON)は撤去したが、この汎用ローダーは配布互換として存続する。
  // 修正4(2026-07-14 オーナー実機フィードバック): 結果を読み込み欄の上部にテキストで表示し、下部トースト
  // (押して閉じるボタン)としては二重に出ないこと。エラー(URLが見つからない)・成功(ファイル読み込み)の
  // 両方を確認し、取り込んだ品が「基本レシピ」バッジで表示され旧テーマ名(setName)が出ないことも確認する。
  // 専用のまっさらプロファイルで完結させる ---
  currentCheck = 'RECIPESET-01'
  {
    const rsBrowser = await chromium.launch()
    const rsContext = await rsBrowser.newContext()
    const rsPage = await rsContext.newPage()
    rsPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (text.includes('cloudflareinsights') || text.includes('ERR_FAILED')) return
      errors.push(`[console@RECIPESET-01] ${text}`)
    })
    rsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@RECIPESET-01] ${err.message}`)
    })
    try {
      await rsPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(1000)
      await rsPage.getByRole('button', { name: 'レシピ', exact: true }).click()
      await rsPage.waitForTimeout(300)

      const urlInput = rsPage.getByPlaceholder('https://…')
      const loadUrlBtn = rsPage.getByRole('button', { name: 'URLから読み込む' })

      // エラー(見つからない)パス
      await urlInput.fill(`${BASE}/e2e-nonexistent-set.json`)
      await loadUrlBtn.click()
      await rsPage.waitForTimeout(600)
      check(
        'RECIPESET-01(修正4) 存在しないURLの結果が読み込み欄の上部にテキストで出る',
        (await rsPage.textContent('body')).includes(
          '指定されたURLにレシピセットが見つかりませんでした',
        ),
      )
      const errorMsgBox = await rsPage
        .getByText('指定されたURLにレシピセットが見つかりませんでした', { exact: false })
        .first()
        .boundingBox()
      const urlInputBox = await urlInput.boundingBox()
      check(
        'RECIPESET-01(修正4) 結果メッセージが読み込み欄(URL入力)より上に表示される',
        !!errorMsgBox && !!urlInputBox && errorMsgBox.y < urlInputBox.y,
      )
      check(
        'RECIPESET-01(修正4) 下部トースト(押して閉じるボタン)としては出ない(二重表示しない)',
        (await rsPage
          .getByRole('button', { name: '指定されたURLにレシピセットが見つかりませんでした', exact: false })
          .count()) === 0,
      )

      // 成功パス: 汎用の「レシピセットを読み込む」欄(バックアップ形式の追加読み込み)は、テーマ全廃
      // (2026-07-23)後も配布互換として存続する。配布JSON(/sets/data/*.json)は撤去したため、ファイル
      // 読み込み経路をバックアップ形式のJSONで検証する。setId/setName付きでも取り込んだ品は「基本レシピ」
      // として入り(isStarter)、テーマ名(setName)は出ない(RecipeCardが第◯弾/テーマ名を表示しない)
      const setJson = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        setId: 'e2e-generic-set',
        setName: 'E2Eテスト用セット',
        recipes: [
          {
            title: 'E2E読み込みテストレシピ',
            servings: 2,
            cookMinutes: 10,
            effortLevel: 'easy',
            tags: ['和食'],
            ingredients: [{ name: 'E2Eテスト食材', amount: '1', unit: '個' }],
            steps: [{ text: 'E2Eテスト手順。' }],
            cookedLogs: [],
          },
        ],
      })
      // 「レシピセットを読み込む」欄の隠しファイル入力(DOM上は設定画面で最初のファイル入力)へ直接投入する
      await rsPage.locator('input[type="file"][accept="application/json,.json"]').first().setInputFiles({
        name: 'e2e-set.json',
        mimeType: 'application/json',
        buffer: Buffer.from(setJson, 'utf-8'),
      })
      await rsPage.waitForTimeout(1000)
      const afterSuccessText = await rsPage.textContent('body')
      check(
        'RECIPESET-01 ファイル読み込み(バックアップ形式)が成功し「◯件追加しました」が上部に出る',
        /\d+件追加しました/.test(afterSuccessText),
      )
      check(
        'RECIPESET-01(修正4) 直前のエラーメッセージは成功後には残らない',
        !afterSuccessText.includes('指定されたURLにレシピセットが見つかりませんでした'),
      )

      // 基本レシピバッジの確認: setId/setName付きで取り込んでもカードは「基本レシピ」バッジに統一され、
      // 第◯弾/テーマ名(setName)は出ない(2026-07-23のテーマ全廃で表示上の括りを完全撤去)
      await rsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await rsPage.waitForTimeout(800)
      const importedCardText = await rsPage
        .locator('a[href^="#/recipes/"]', { hasText: 'E2E読み込みテストレシピ' })
        .first()
        .textContent()
      check(
        'RECIPESET-01 setId/setName付きセットの取り込み後もカードは「基本レシピ」バッジで、テーマ名(setName)は出ない',
        !!importedCardText &&
          importedCardText.includes('基本レシピ') &&
          !importedCardText.includes('E2Eテスト用セット'),
        `カードテキスト=${importedCardText}`,
      )
    } finally {
      await rsBrowser.close()
    }
  }

  // --- DASH-01: だし紐づけ(2026-07-23)。材料「だし汁」系の行から収録レシピ「だしのとり方」の詳細へ
  // 飛べる小さなリンクが出て、タップで遷移すること・収録レシピをユーザーが削除するとリンクが出ないこと
  // を確認する。専用のbrowser/contextで完結させる ---
  currentCheck = 'DASH-01'
  {
    const dsBrowser = await chromium.launch()
    const dsContext = await dsBrowser.newContext()
    const dsPage = await dsContext.newPage()
    dsPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@DASH-01] ${err.message}`)
    })
    dsPage.on('dialog', (dialog) => dialog.accept())
    try {
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(2200) // 初回シード完了待ち(103品・だし巻き卵/だしのとり方を含む)

      // 1) 「だし汁」を材料に持つ基本レシピ(だし巻き卵)を開く
      await dsPage.locator('input[type="search"]').fill('だし巻き卵')
      await dsPage.waitForTimeout(500)
      await dsPage.getByText('だし巻き卵', { exact: true }).first().click()
      await dsPage.waitForTimeout(600)

      // 2) 材料エリアに「だしのとり方」への小さなリンクが出る(だし汁の行)
      const dashiLink = dsPage.getByRole('link', { name: 'だしのとり方' })
      check('DASH-01 「だし汁」の材料行に「だしのとり方」へのリンクが出る', (await dashiLink.count()) > 0)

      // 3) リンクをタップすると収録レシピ「だしのとり方」の詳細へ遷移する
      await dashiLink.first().click()
      await dsPage.waitForTimeout(600)
      const dashiDetail = await dsPage.textContent('body')
      check(
        'DASH-01 リンクから「だしのとり方」の詳細へ遷移する(材料に昆布・かつお節がある)',
        dashiDetail.includes('だしのとり方') &&
          dashiDetail.includes('昆布') &&
          dashiDetail.includes('かつお節'),
      )
      const dashiRecipeId = Number(dsPage.url().match(/#\/recipes\/(\d+)/)?.[1])

      // 4) 収録レシピ「だしのとり方」をユーザーが削除するとリンクは出なくなる
      await dsPage.goto(`${BASE}/#/recipes/${dashiRecipeId}/edit`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(600)
      await dsPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await dsPage.waitForTimeout(800)
      await dsPage.evaluate(() => sessionStorage.removeItem('uchirecipe:recipesListState'))
      await dsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dsPage.waitForTimeout(500)
      await dsPage.locator('input[type="search"]').fill('だし巻き卵')
      await dsPage.waitForTimeout(500)
      await dsPage.getByText('だし巻き卵', { exact: true }).first().click()
      await dsPage.waitForTimeout(600)
      check(
        'DASH-01 収録レシピ「だしのとり方」を削除するとリンクは出ない(ユーザー削除を尊重)',
        (await dsPage.getByRole('link', { name: 'だしのとり方' }).count()) === 0,
      )
    } finally {
      await dsBrowser.close()
    }
  }

  // --- SMK-19: 静的ページ(/about/配下・/sets/)がSW有効でも200でアプリ本体にすり替わらない ---
  // アプリ本体のtitleは「うちレシピ」単独。静的ページは必ず「◯◯｜うちレシピ」形式のtitleを持つ
  currentCheck = 'SMK-19'
  const staticPages = [
    ['/about/', 'うちレシピについて'],
    ['/about/terms.html', '利用規約'],
    ['/about/column/', 'コラム'],
    ['/about/column/kondate-kimaranai.html', '献立が決められない'],
    ['/about/column/recipe-screenshot-seiri.html', 'スクショ'],
    // /sets/(配布ページ)は2026-07-23のテーマ全廃で撤去
  ]
  for (const [path, titleKeyword] of staticPages) {
    const res = await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const title = await page.title()
    check(
      `SMK-19 静的ページ ${path}`,
      res.status() === 200 && title.includes(titleKeyword),
      `status=${res.status()} title=「${title}」`,
    )
  }

  // --- PRICEUNIT-01: 「食材と価格」の単位入力UI改修(2026-07-15オーナー実機フィードバック:
  // 単位欄が自由入力だと不安・使いにくい)。新規追加フォームで数量(数字)＋単位(選択)を別々に
  // 入力して追加すると、保存形式は従来どおり1つの文字列に合成される(「2」＋「個」→「2個」)ことを
  // IndexedDBの実データで確認する。加えて、既存デフォルト行(玉ねぎ)の数量欄を新UIで書き換えると
  // 「デフォルトに戻す」ボタンが出現し、押すと数量・単位ともに投入時の状態(1個)へ戻り
  // ボタンも再び消えることを確認する。他チェックの解錠状態・データに影響しないよう
  // 専用のbrowser/contextで完結させる ---
  currentCheck = 'PRICEUNIT-01'
  {
    const puBrowser = await chromium.launch()
    try {
      const puContext = await puBrowser.newContext()
      const puPage = await puContext.newPage()
      puPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@PRICEUNIT-01] ${err.message}`)
      })
      await puPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(1800) // 初回シード完了待ち(食材価格マスタの初期投入含む)

      await puPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await puPage.waitForTimeout(500)

      // 新規追加: 名前「テスト食材」・価格「500」・数量「2」・単位「個」で追加する
      await puPage.getByLabel('食材名', { exact: true }).fill('テスト食材')
      await puPage.getByLabel('価格（円）', { exact: true }).fill('500')
      await puPage.getByLabel('数量', { exact: true }).fill('2')
      await puPage.getByLabel('単位', { exact: true }).selectOption('個')
      await puPage.getByRole('button', { name: '追加', exact: true }).click()
      await puPage.waitForTimeout(400)

      const testRow = puPage.locator('li', { hasText: 'テスト食材' })
      check('PRICEUNIT-01 追加した食材が一覧に並ぶ', (await testRow.count()) === 1)

      // 保存形式が従来どおり1つの文字列(「2個」)に合成されていることをIndexedDBの実データで確認
      // (updatePriceEntryのisDefault再判定が文字列比較のため、合成結果の完全一致が最重要)
      const savedTestEntry = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === 'テスト食材')
      })
      check(
        'PRICEUNIT-01 数量「2」+単位「個」が「2個」の1文字列に合成されて保存される',
        savedTestEntry?.unit === '2個' && savedTestEntry?.pricePerUnit === 500,
        `savedTestEntry=${JSON.stringify(savedTestEntry)}`,
      )

      // 一覧の行は「2個」を数量欄「2」＋単位選択「個」に分解して表示する(往復確認)
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を数量欄「2」に分解して表示する',
        (await testRow.getByLabel('テスト食材の数量').inputValue()) === '2',
      )
      check(
        'PRICEUNIT-01 一覧行は保存値「2個」を単位選択「個」に分解して表示する',
        (await testRow.getByLabel('テスト食材の単位').inputValue()) === '個',
      )

      // 既存のデフォルト行(玉ねぎ=1個50円)の数量を新UIで書き換えると「デフォルトに戻す」が出る
      const onionRow = puPage.locator('li', { hasText: '玉ねぎ' })
      check(
        'PRICEUNIT-01 編集前の玉ねぎ行には「デフォルトに戻す」が出ない',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const onionQtyInput = onionRow.getByLabel('玉ねぎの数量')
      await onionQtyInput.fill('3')
      await onionQtyInput.press('Enter') // Enterでblur→保存
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 数量欄(新UI)を書き換えると「デフォルトに戻す」が出る',
        (await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      const savedOnionAfterEdit = await puPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const all = await new Promise((resolve, reject) => {
          const getReq = idb.transaction('prices', 'readonly').objectStore('prices').getAll()
          getReq.onsuccess = () => resolve(getReq.result)
          getReq.onerror = () => reject(getReq.error)
        })
        idb.close()
        return all.find((p) => p.name === '玉ねぎ')
      })
      check(
        'PRICEUNIT-01 数量「3」への書き換えが「3個」の1文字列に合成されて保存される',
        savedOnionAfterEdit?.unit === '3個',
        `savedOnionAfterEdit=${JSON.stringify(savedOnionAfterEdit)}`,
      )

      // 「デフォルトに戻す」で投入時の状態(数量「1」・単位「個」)に戻り、ボタンも再び消える
      await onionRow.getByRole('button', { name: '玉ねぎをデフォルト価格に戻す' }).click()
      await puPage.waitForTimeout(400)
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後はボタンが再び消える',
        !(await onionRow.textContent()).includes('デフォルトに戻す'),
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は数量欄が「1」に戻る',
        (await onionRow.getByLabel('玉ねぎの数量').inputValue()) === '1',
      )
      check(
        'PRICEUNIT-01 「デフォルトに戻す」後は単位選択が「個」に戻る',
        (await onionRow.getByLabel('玉ねぎの単位').inputValue()) === '個',
      )
    } finally {
      await puBrowser.close()
    }
  }

  // --- BACKUP-01: バックアップの全ユーザーデータ対応(在庫・買い物メモ・週献立・今日の献立・
  // 食材価格マスタ。2026-07-13 データ堅牢性強化)。価格編集+週献立割当+在庫品を実際の
  // 「バックアップ」タブ→「ファイルに書き出す」ボタン(Playwrightのdownloadイベントで捕捉)で
  // 書き出し、まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元して
  // 実際に引き継がれることを確認する。加えて、これらの項目が無い旧形式のbackup JSONを
  // 既に価格・在庫データのあるプロファイルへ読み込んでもエラーにならず既存データが消えない
  // (後方互換)ことも確認する。他チェックへの影響を避けるため専用のbrowser/contextで完結させる。
  // 週献立・在庫ボード自体のUI操作はMEALPLAN-01〜03/INLINE-01等で別途カバー済みのため、
  // ここでは前提データの用意にIndexedDBへの直接書き込みを使い、バックアップ機構そのものの
  // 往復検証(実際のエクスポート/インポートUI経由)に的を絞る ---
  currentCheck = 'BACKUP-01'
  {
    let downloadedJson = ''

    // 1)〜3) 書き出し元プロファイル: 価格を1件編集・週献立に1枠割当・在庫に1品を用意し、
    // 実際の「ファイルに書き出す」ボタンでバックアップJSONを書き出す
    const srcBrowser = await chromium.launch()
    try {
      const srcContext = await srcBrowser.newContext({ acceptDownloads: true })
      const srcPage = await srcContext.newPage()
      srcPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(書き出し元)] ${err.message}`)
      })
      srcPage.on('dialog', (dialog) => dialog.accept())
      await srcPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(1800) // 初回シード完了待ち

      // 価格を1件編集(玉ねぎ→888円。「食材と価格」一覧の行内編集を実際のUIで行う)
      await srcPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      const srcOnionPriceInput = srcPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      await srcOnionPriceInput.fill('888')
      await srcOnionPriceInput.press('Enter')
      await srcPage.waitForTimeout(400)

      // 週献立に1枠割当・在庫に1品・Pro解錠コード(IndexedDBへ直接書き込み。理由は上のコメントの通り。
      // Pro解錠コードは2026-07-17バックアップ改修 修正1のコード往復確認用。実際の購入コードは
      // 販売台帳の原本のためNUT-02等と同様settings.proCodeの直書きで「解錠済み」を再現する)
      const setup = await srcPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const recipeId = await new Promise((resolve, reject) => {
          const cursorReq = idb.transaction('recipes', 'readonly').objectStore('recipes').openCursor()
          cursorReq.onsuccess = () => resolve(cursorReq.result ? cursorReq.result.primaryKey : null)
          cursorReq.onerror = () => reject(cursorReq.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['mealPlans', 'pantryItems', 'settings'], 'readwrite')
          tx.objectStore('mealPlans').add({ date: '2026-07-20', slot: 'dinner', recipeId, role: 'main' })
          tx.objectStore('pantryItems').add({ name: 'E2Eバックアップ確認在庫', level: 'have', isFrequent: true })
          const settingsStore = tx.objectStore('settings')
          const getReq = settingsStore.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            settingsStore.put({
              ...current,
              id: 1,
              proCode: 'UR-E2E-TEST-ONLY',
              proActivatedAt: Date.now(),
            })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
        return { recipeId }
      })
      check('BACKUP-01 前提: 割当先レシピIDを取得できた', typeof setup.recipeId === 'number')

      // 「バックアップ」タブ→「ファイルに書き出す」で実際に書き出す
      await srcPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await srcPage.waitForTimeout(500)
      await srcPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await srcPage.waitForTimeout(300)
      const [download] = await Promise.all([
        srcPage.waitForEvent('download'),
        srcPage.getByRole('button', { name: 'ファイルに書き出す' }).click(),
      ])
      downloadedJson = readFileSync(await download.path(), 'utf-8')
      const exported = JSON.parse(downloadedJson)
      const exportedOnion = (exported.prices ?? []).find((p) => p.name === '玉ねぎ')
      check(
        'BACKUP-01 書き出しJSONに編集後の価格(玉ねぎ888円)が含まれる',
        exportedOnion?.pricePerUnit === 888,
        `exportedOnion=${JSON.stringify(exportedOnion)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに割り当てた週献立の枠が含まれる',
        (exported.mealPlans ?? []).some(
          (m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.recipeId === setup.recipeId,
        ),
        `mealPlans=${JSON.stringify(exported.mealPlans)}`,
      )
      check(
        'BACKUP-01 書き出しJSONに追加した在庫品が含まれる',
        (exported.pantryItems ?? []).some((p) => p.name === 'E2Eバックアップ確認在庫'),
      )
      check(
        'BACKUP-01 書き出しJSONの新規5テーブルはid(自動採番)を含まない(復元先で振り直すため)',
        ['pantryItems', 'shoppingItems', 'mealPlans', 'todayList', 'prices'].every((key) =>
          (exported[key] ?? []).every((row) => !('id' in row)),
        ),
      )
      // CODEBACKUP-01(修正1): 書き出しJSONにPro解錠コードが含まれること(オーナー実害
      // 「ブラウザデータ消去→復元しても購入状態が戻らない」の再発防止。settings自体が
      // 従来からバックアップに含まれていたが、コード欄がちゃんと乗ることを明示的に固定する)
      check(
        'CODEBACKUP-01 書き出しJSONの settings.proCode に解錠コードが含まれる',
        exported.settings?.proCode === 'UR-E2E-TEST-ONLY',
        `exported.settings=${JSON.stringify(exported.settings)}`,
      )
    } finally {
      await srcBrowser.close()
    }

    // 4) まっさらな別プロファイルへ「読み込む(今のデータと置き換え)」で復元する
    const dstBrowser = await chromium.launch()
    try {
      const dstContext = await dstBrowser.newContext()
      const dstPage = await dstContext.newPage()
      dstPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(復元先)] ${err.message}`)
      })
      dstPage.on('dialog', (dialog) => dialog.accept())
      await dstPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(1800) // 初回シード完了待ち(まっさらな別プロファイル)
      await dstPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      await dstPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await dstPage.waitForTimeout(300)
      const [fileChooser] = await Promise.all([
        dstPage.waitForEvent('filechooser'),
        dstPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click(),
      ])
      await fileChooser.setFiles({
        name: 'uchi-recipe-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(downloadedJson, 'utf-8'),
      })
      await dstPage.waitForTimeout(800)
      const dstMessage = await dstPage.textContent('body')
      check('BACKUP-01 復元後に成功メッセージが出る(エラーにならない)', dstMessage.includes('品のレシピを読み込みました'))
      check('BACKUP-01 復元後にエラーメッセージは出ない', !dstMessage.includes('ファイルを読み込めませんでした'))

      // 価格が実際に復元されたことをUIで確認する(玉ねぎ888円)
      await dstPage.goto(`${BASE}/#/prices`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      const dstOnionPriceInput = dstPage
        .locator('li', { hasText: '玉ねぎ' })
        .getByLabel('玉ねぎの価格（円）')
      check('BACKUP-01 価格編集(玉ねぎ888円)が復元される', (await dstOnionPriceInput.inputValue()) === '888')

      // 週献立・在庫が実際に復元されたことをIndexedDBで直接確認する
      const restored = await dstPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        const [mealPlans, pantryItems] = await Promise.all([getAll('mealPlans'), getAll('pantryItems')])
        idb.close()
        return { mealPlans, pantryItems, settings }
      })
      check(
        'BACKUP-01 週献立の割当(2026-07-20夕食)が復元される',
        restored.mealPlans.some((m) => m.date === '2026-07-20' && m.slot === 'dinner' && m.role === 'main'),
        `mealPlans=${JSON.stringify(restored.mealPlans)}`,
      )
      check(
        'BACKUP-01 在庫の追加品が復元される',
        restored.pantryItems.some((p) => p.name === 'E2Eバックアップ確認在庫'),
        `pantryItems=${JSON.stringify(restored.pantryItems)}`,
      )
      // CODEBACKUP-01(修正1・最重要): 「ブラウザデータ消去→復元」を再現する本命シナリオ。
      // まっさらな(購入していない)別プロファイルへ「読み込む(置き換え)」で復元するだけで、
      // Pro解錠コードも一緒に戻り購入状態が回復することを確認する
      check(
        'CODEBACKUP-01 まっさらなプロファイルへの置き換え復元でPro解錠コードが戻る(オーナー実害の再発防止)',
        restored.settings?.proCode === 'UR-E2E-TEST-ONLY',
        `settings=${JSON.stringify(restored.settings)}`,
      )
      // UI側でも実際にPro解錠済み表示になっていることを確認する(IndexedDB直読みだけでなく
      // 画面表示にも反映されることの担保)
      await dstPage.goto(`${BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
      await dstPage.waitForTimeout(500)
      check(
        'CODEBACKUP-01 復元後、Pro節の表示も解錠済みになっている',
        (await dstPage.textContent('body')).includes('Pro版をご利用いただきありがとうございます'),
      )
    } finally {
      await dstBrowser.close()
    }

    // 5) 後方互換: 新5テーブルの項目が無い旧形式のbackup JSONを、既に価格・在庫データのある
    //    プロファイルへ読み込んでもエラーにならず、既存の価格・在庫データが消えないことを確認する
    const compatBrowser = await chromium.launch()
    try {
      const compatContext = await compatBrowser.newContext()
      const compatPage = await compatContext.newPage()
      compatPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@BACKUP-01(後方互換)] ${err.message}`)
      })
      compatPage.on('dialog', (dialog) => dialog.accept())
      await compatPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(1800) // 初回シード完了待ち

      // 復元前から価格マスタ・在庫ボードにデータがある状態を用意する(IndexedDBへ直接書き込み)
      await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction(['prices', 'pantryItems'], 'readwrite')
          tx.objectStore('prices').add({
            name: 'E2E後方互換確認価格',
            pricePerUnit: 321,
            unit: '1個',
            updatedAt: Date.now(),
            isDefault: false,
          })
          tx.objectStore('pantryItems').add({ name: 'E2E後方互換確認在庫', level: 'have', isFrequent: true })
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })

      // この対応より前の形式(新5テーブルの項目が一切無い)のbackup JSONを模す
      const oldFormatBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })

      await compatPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await compatPage.waitForTimeout(500)
      await compatPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await compatPage.waitForTimeout(300)
      const [compatFileChooser] = await Promise.all([
        compatPage.waitForEvent('filechooser'),
        compatPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click(),
      ])
      await compatFileChooser.setFiles({
        name: 'old-format-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(oldFormatBackup, 'utf-8'),
      })
      await compatPage.waitForTimeout(800)
      check(
        'BACKUP-01 旧形式(新5テーブル項目なし)のバックアップを読み込んでもエラーにならない',
        !(await compatPage.textContent('body')).includes('ファイルを読み込めませんでした'),
      )

      const afterCompat = await compatPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const getAll = (storeName) =>
          new Promise((resolve, reject) => {
            const req2 = idb.transaction(storeName, 'readonly').objectStore(storeName).getAll()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
        const [prices, pantryItems] = await Promise.all([getAll('prices'), getAll('pantryItems')])
        const recipeCount = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('recipes', 'readonly').objectStore('recipes').count()
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return { prices, pantryItems, recipeCount }
      })
      check(
        'BACKUP-01 旧形式の復元で既存の価格マスタが消えない(clearされない)',
        afterCompat.prices.some((p) => p.name === 'E2E後方互換確認価格'),
        `prices件数=${afterCompat.prices.length}`,
      )
      check(
        'BACKUP-01 旧形式の復元で既存の在庫ボードが消えない(clearされない)',
        afterCompat.pantryItems.some((p) => p.name === 'E2E後方互換確認在庫'),
        `pantryItems件数=${afterCompat.pantryItems.length}`,
      )
      check(
        'BACKUP-01 旧形式でもrecipesフィールド自体は従来どおり置き換わる(空配列→0件)',
        afterCompat.recipeCount === 0,
        `recipeCount=${afterCompat.recipeCount}`,
      )
    } finally {
      await compatBrowser.close()
    }
  }

  // --- REPLACEUNDO-01(2026-07-17設定ゼロベース裁定#6): 置き換え読み込みの安全三重化。
  // (a)確認文(pickImportFile・onImportFileの両方)に消える件数(レシピ・作った記録・価格)が
  //    具体的に入り、「何が残るか/どうなるか」も書かれていること(app/CLAUDE.md規約F)
  // (b)実行前に現データを内部(preImportSnapshotsテーブル)へ自動退避すること
  // (c)置き換え直後に1回だけ「元に戻す」が出て、押すと退避データから実際に復元できること
  // を、実際の「読み込む(今のデータと置き換え)」UIフローで確認する。他チェックに影響しない
  // よう専用のbrowser/contextで完結させる ---
  currentCheck = 'REPLACEUNDO-01'
  {
    const ruBrowser = await chromium.launch()
    try {
      const ruContext = await ruBrowser.newContext()
      const ruPage = await ruContext.newPage()
      ruPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@REPLACEUNDO-01] ${err.message}`)
      })
      const dialogMessages = []
      ruPage.on('dialog', (dialog) => {
        dialogMessages.push(dialog.message())
        void dialog.accept()
      })

      const countTable = async (storeName) =>
        ruPage.evaluate(async (name) => {
          const req = indexedDB.open('uchi-recipe')
          const idb = await new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result)
            req.onerror = () => reject(req.error)
          })
          const count = await new Promise((resolve, reject) => {
            const req2 = idb.transaction(name, 'readonly').objectStore(name).count()
            req2.onsuccess = () => resolve(req2.result)
            req2.onerror = () => reject(req2.error)
          })
          idb.close()
          return count
        }, storeName)

      await ruPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ruPage.waitForTimeout(1800) // 初回シード完了待ち

      const originalRecipeCount = await countTable('recipes')
      check(
        'REPLACEUNDO-01 前提: 基本レシピがシードされている',
        originalRecipeCount > 0,
        `originalRecipeCount=${originalRecipeCount}`,
      )

      await ruPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await ruPage.waitForTimeout(500)
      await ruPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await ruPage.waitForTimeout(300)

      const emptyBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })
      const [fileChooser] = await Promise.all([
        ruPage.waitForEvent('filechooser'),
        ruPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click(),
      ])
      await fileChooser.setFiles({
        name: 'empty-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(emptyBackup, 'utf-8'),
      })
      await ruPage.waitForTimeout(800)

      check(
        'REPLACEUNDO-01(a) 確認文(事前確認+実行前確認の2回とも)に消えるレシピ件数が具体的に入る(規約F)',
        dialogMessages.length === 2 &&
          dialogMessages.every((m) => m.includes(`今のレシピ${originalRecipeCount}件`)),
        `dialogMessages=${JSON.stringify(dialogMessages)}`,
      )
      check(
        'REPLACEUNDO-01(a) 確認文に「作った記録」「価格」の件数も入る',
        dialogMessages.every((m) => /作った記録\d+件・価格\d+件/.test(m)),
        `dialogMessages=${JSON.stringify(dialogMessages)}`,
      )
      check(
        'REPLACEUNDO-01(a) 確認文に「元に戻す」で戻せる旨(残る/どうなるか)も書かれている' +
          '(規約F。「よろしいですか？」だけの確認にしない)',
        dialogMessages.every((m) => m.includes('元に戻す') && m.includes('戻せます')),
      )

      check(
        'REPLACEUNDO-01 置き換え実行後に成功メッセージが出る(0品)',
        (await ruPage.textContent('body')).includes('0品のレシピを読み込みました'),
      )
      check(
        'REPLACEUNDO-01(c) 置き換え直後に「元に戻す」バナーが出る',
        (await ruPage.textContent('body')).includes('元に戻す'),
      )

      const afterReplaceRecipeCount = await countTable('recipes')
      const afterReplaceSnapshotCount = await countTable('preImportSnapshots')
      check(
        'REPLACEUNDO-01(b) 置き換え前に現データが内部へ自動退避されている(preImportSnapshotsに1件)',
        afterReplaceSnapshotCount === 1,
        `afterReplaceSnapshotCount=${afterReplaceSnapshotCount}`,
      )
      check(
        'REPLACEUNDO-01 置き換え後、実際にレシピが0件になっている(IndexedDB直読み)',
        afterReplaceRecipeCount === 0,
      )

      // 「元に戻す」を押す
      await ruPage.getByRole('button', { name: '元に戻す', exact: true }).click()
      await ruPage.waitForTimeout(800)
      check(
        'REPLACEUNDO-01(c) 「元に戻す」後に復元完了メッセージが出る',
        (await ruPage.textContent('body')).includes('元のデータに戻しました'),
      )
      const afterUndoRecipeCount = await countTable('recipes')
      const afterUndoSnapshotCount = await countTable('preImportSnapshots')
      check(
        'REPLACEUNDO-01(c) 「元に戻す」でレシピ件数が退避前と一致する',
        afterUndoRecipeCount === originalRecipeCount,
        `originalRecipeCount=${originalRecipeCount} afterUndoRecipeCount=${afterUndoRecipeCount}`,
      )
      check(
        'REPLACEUNDO-01 復元後は退避データが消える(1世代のみ保持)',
        afterUndoSnapshotCount === 0,
      )
    } finally {
      await ruBrowser.close()
    }
  }

  // --- CODEMERGE-01(2026-07-17バックアップ改修 修正1): merge復元(「読み込む(今のデータに追加)」)
  // でもPro解錠コードが戻ること、および旧形式(コード無し)バックアップをmergeしても既存の解錠
  // コードが消えない(後方互換)ことを、実際の「バックアップから戻す」UI経由で確認する。
  // (a) 既存プロファイルはコード未購入→コードを含むバックアップをmerge→復元後に解錠される
  // (b) 既存プロファイルはPro解錠済み→コードを含まない旧形式バックアップをmerge→解錠状態が
  //     消えない(mergeUnlockCodesの「バックアップに無ければ既存を保持」を実UIで固定する) ---
  currentCheck = 'CODEMERGE-01'
  {
    // (a) 未購入プロファイル + コード入りバックアップをmerge → 解錠される
    const cmaBrowser = await chromium.launch()
    try {
      const cmaContext = await cmaBrowser.newContext()
      const cmaPage = await cmaContext.newPage()
      cmaPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@CODEMERGE-01(a)] ${err.message}`)
      })
      cmaPage.on('dialog', (dialog) => dialog.accept())
      await cmaPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cmaPage.waitForTimeout(1800) // 初回シード完了待ち(未購入のまっさらなプロファイル)

      const backupWithCode = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        settings: { proCode: 'UR-E2E-MERGE-TEST', proActivatedAt: Date.now() },
        recipes: [],
      })
      await cmaPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await cmaPage.waitForTimeout(500)
      await cmaPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await cmaPage.waitForTimeout(300)
      const [cmaFileChooser] = await Promise.all([
        cmaPage.waitForEvent('filechooser'),
        cmaPage.getByRole('button', { name: '読み込む（今のデータに追加）' }).click(),
      ])
      await cmaFileChooser.setFiles({
        name: 'with-code-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(backupWithCode, 'utf-8'),
      })
      await cmaPage.waitForTimeout(800)
      const cmaProCode = await cmaPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return settings?.proCode
      })
      check(
        'CODEMERGE-01(a) 未購入プロファイルへのmerge復元でバックアップ側のPro解錠コードが設定される',
        cmaProCode === 'UR-E2E-MERGE-TEST',
        `proCode=${cmaProCode}`,
      )
    } finally {
      await cmaBrowser.close()
    }

    // (b) Pro解錠済みプロファイル + コード無し(旧形式)バックアップをmerge → 解錠状態が消えない
    const cmbBrowser = await chromium.launch()
    try {
      const cmbContext = await cmbBrowser.newContext()
      const cmbPage = await cmbContext.newPage()
      cmbPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@CODEMERGE-01(b)] ${err.message}`)
      })
      cmbPage.on('dialog', (dialog) => dialog.accept())
      await cmbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cmbPage.waitForTimeout(1800) // 初回シード完了待ち

      // 既にPro解錠済みの状態を用意する(IndexedDB直書き。実コードは販売台帳の原本のため
      // NUT-02等と同じ方式で「解錠済み」だけを再現する)
      await cmbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('settings', 'readwrite')
          const store = tx.objectStore('settings')
          const getReq = store.get(1)
          getReq.onsuccess = () => {
            const current = getReq.result || { id: 1 }
            store.put({ ...current, id: 1, proCode: 'UR-E2E-EXISTING', proActivatedAt: Date.now() })
          }
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })

      // コード欄もsettings欄も無い、この対応より前の旧形式バックアップを模す
      const oldFormatNoCodeBackup = JSON.stringify({
        app: 'uchi-recipe',
        version: 1,
        exportedAt: new Date().toISOString(),
        recipes: [],
      })
      await cmbPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await cmbPage.waitForTimeout(500)
      await cmbPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await cmbPage.waitForTimeout(300)
      const [cmbFileChooser] = await Promise.all([
        cmbPage.waitForEvent('filechooser'),
        cmbPage.getByRole('button', { name: '読み込む（今のデータに追加）' }).click(),
      ])
      await cmbFileChooser.setFiles({
        name: 'old-format-no-code-backup.json',
        mimeType: 'application/json',
        buffer: Buffer.from(oldFormatNoCodeBackup, 'utf-8'),
      })
      await cmbPage.waitForTimeout(800)
      check(
        'CODEMERGE-01(b) 旧形式バックアップのmerge復元でもエラーにならない',
        !(await cmbPage.textContent('body')).includes('ファイルを読み込めませんでした'),
      )
      const cmbProCode = await cmbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const settings = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return settings?.proCode
      })
      check(
        'CODEMERGE-01(b) 旧形式(コード無し)バックアップをmergeしても既存のPro解錠コードは消えない(空で上書きしない)',
        cmbProCode === 'UR-E2E-EXISTING',
        `proCode=${cmbProCode}`,
      )
    } finally {
      await cmbBrowser.close()
    }
  }

  // --- FILESAVE-01(2026-07-17バックアップ改修 修正2+3): 保存先選択+前回の場所に上書き。
  // 実ブラウザのFile System Access APIはネイティブのOS保存ダイアログを伴うため、Playwrightの
  // headless chromiumでは`showSaveFilePicker`自体が存在しない(=既定では非対応ブラウザ扱いになる。
  // 実測確認済み)。そのため、このチェックだけaddInitScriptで`window.showSaveFilePicker`を
  // 注入し「対応ブラウザ」を模して、以下2点を実コードで検証する:
  // (a) 保存先の記録が無い間は「前回の場所に上書き」ボタンが出ない→IndexedDBのfileHandles
  //     テーブルに記録を直接投入→再訪問でボタンが出る(表示分岐そのもの=hasSavedFileHandle/
  //     useEffectの実コードを通す)
  // (b) 「ファイルに書き出す」「前回の場所に上書き」を押しても、ピッカーがキャンセル
  //     (AbortError)扱いになったときエラー表示が出ない(isAbortErrorの実コードを通す)
  // 注意: 本物のFileSystemFileHandle(createWritable等のメソッド持ち)はブラウザネイティブの
  // structured clone対応があるためIndexedDBに保存できるが、JSで自作した偽handleは関数を
  // 持つとDataCloneErrorになり保存できない。そのため実際の書き込み内容(JSON)の往復までは
  // ここでは検証できず、その部分はscripts/test-logic.mjsの単体テスト(backupFileName/
  // isAbortError/supportsSaveFilePicker)とコードレビューで担保する(報告に明記) ---
  currentCheck = 'FILESAVE-01'
  {
    const fsBrowser = await chromium.launch()
    try {
      const fsContext = await fsBrowser.newContext()
      const fsPage = await fsContext.newPage()
      fsPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@FILESAVE-01] ${err.message}`)
      })
      fsPage.on('dialog', (dialog) => dialog.accept())
      // 「対応ブラウザ」を模す: showSaveFilePickerを注入する(呼ばれたら常にキャンセル扱い)
      await fsContext.addInitScript(() => {
        // webdriverガード(supportsSaveFilePicker)を明示フラグで解除し、偽ピッカーで
        // ピッカー経路のUI分岐を検証する(フラグ無しの通常e2eは常にDLフォールバック経路)
        window.__e2eForceFilePicker = true
        window.showSaveFilePicker = async () => {
          throw new DOMException('e2e fake picker: canceled', 'AbortError')
        }
      })

      await fsPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(1800) // 初回シード完了待ち
      await fsPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(500)
      await fsPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await fsPage.waitForTimeout(300)

      check(
        'FILESAVE-01(a) 保存先の記録が無い間は「前回の場所に上書き」ボタンが出ない',
        !(await fsPage.textContent('body')).includes('前回の場所に上書き'),
      )

      // 「ファイルに書き出す」→対応ブラウザ扱いなので注入したshowSaveFilePickerが呼ばれ、
      // AbortErrorでキャンセル扱いになる。エラートーストが出ないことを確認する
      await fsPage.getByRole('button', { name: 'ファイルに書き出す' }).click()
      await fsPage.waitForTimeout(500)
      check(
        'FILESAVE-01(b) ピッカーをキャンセル(AbortError)してもエラー表示が出ない',
        !(await fsPage.textContent('body')).includes('保存に失敗しました'),
      )

      // IndexedDBのfileHandlesテーブルに保存先ハンドルの記録を直接投入し(本物のhandleは
      // structured cloneでしか作れないため、表示分岐の検証用に中身を問わない記録だけを置く)、
      // 再訪問(再マウント)で「前回の場所に上書き」ボタンが出ることを確認する
      await fsPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        await new Promise((resolve, reject) => {
          const tx = idb.transaction('fileHandles', 'readwrite')
          tx.objectStore('fileHandles').put({ id: 1, handle: {}, savedAt: Date.now() })
          tx.oncomplete = () => resolve(undefined)
          tx.onerror = () => reject(tx.error)
        })
        idb.close()
      })
      // 既に#/settingsに居るためgotoではハッシュ同一=再マウントされない(Dexie/React側は
      // 初回マウント時の判定のまま)。本物のreloadで再マウントさせる(便Zと同じ既知の落とし穴)
      await fsPage.reload({ waitUntil: 'networkidle' })
      await fsPage.waitForTimeout(800)
      await fsPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await fsPage.waitForTimeout(300)
      check(
        'FILESAVE-01(a) 保存先の記録がある状態で再訪問すると「前回の場所に上書き」ボタンが出る',
        (await fsPage.textContent('body')).includes('前回の場所に上書き'),
      )

      // 「前回の場所に上書き」: 記録した偽handleにはrequestPermission等のメソッドが無いため
      // overwriteSavedFileが例外を投げ、保存先選択(注入したshowSaveFilePicker)へ
      // フォールバックする。そちらもAbortError扱いになるため、結局エラー表示は出ない
      await fsPage.getByRole('button', { name: '前回の場所に上書き' }).click()
      await fsPage.waitForTimeout(500)
      check(
        'FILESAVE-01(b) 上書き失敗→保存先選択へフォールバックしてもエラー表示が出ない',
        !(await fsPage.textContent('body')).includes('保存に失敗しました'),
      )
    } finally {
      await fsBrowser.close()
    }
  }

  // --- IMPORTCONFIRM-01: 「読み込む(今のデータと置き換え)」は押した瞬間に確認なしでファイル選択
  // ダイアログが開いてしまっていた穴(2026-07-16 UI総点検P6 高重要度所見・オーナーのデータ消失事故の
  // 再発防止)を、ファイル選択を開く前にwindow.confirmを挟むことで塞いだ。(a)ボタン押下で実際に
  // confirmダイアログが出ること (b)キャンセルするとファイル選択(filechooser)には進まないこと
  // (c)承認(accept)すると実際にファイル選択へ進むこと、の3点を確認する。承認後に実際のファイルを
  // 選んで復元まで成功することはBACKUP-01で確認済みのため、ここではfilechooserが開くところまでに留める ---
  currentCheck = 'IMPORTCONFIRM-01'
  {
    const icBrowser = await chromium.launch()
    try {
      const icContext = await icBrowser.newContext()
      const icPage = await icContext.newPage()
      icPage.on('pageerror', (err) => {
        if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
        errors.push(`[pageerror@IMPORTCONFIRM-01] ${err.message}`)
      })
      await icPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(1800) // 初回シード完了待ち
      await icPage.goto(`${BASE}/#/settings`, { waitUntil: 'networkidle' })
      await icPage.waitForTimeout(500)
      await icPage.getByRole('button', { name: 'バックアップ', exact: true }).click()
      await icPage.waitForTimeout(300)

      // (a)(b) ボタン押下でconfirmダイアログが実際に出ることを検知し、キャンセル(dismiss)する。
      // キャンセルした場合はファイル選択(filechooser)には進まないはず
      let dialogSeen = null
      icPage.once('dialog', (dialog) => {
        dialogSeen = { type: dialog.type(), message: dialog.message() }
        void dialog.dismiss()
      })
      let filechooserFired = false
      icPage.once('filechooser', () => {
        filechooserFired = true
      })
      await icPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click()
      await icPage.waitForTimeout(500)
      check(
        'IMPORTCONFIRM-01 置き換えボタン押下でconfirmダイアログが出る',
        dialogSeen?.type === 'confirm' && dialogSeen.message.includes('置き換えます'),
        `dialogSeen=${JSON.stringify(dialogSeen)}`,
      )
      check(
        'IMPORTCONFIRM-01 confirmをキャンセルするとファイル選択(filechooser)には進まない',
        !filechooserFired,
      )

      // (c) 同じボタンをもう一度押し、今度はconfirmを承認(accept)すると実際にファイル選択へ進むこと
      const [fileChooser] = await Promise.all([
        icPage.waitForEvent('filechooser'),
        (async () => {
          icPage.once('dialog', (dialog) => void dialog.accept())
          await icPage.getByRole('button', { name: '読み込む（今のデータと置き換え）' }).click()
        })(),
      ])
      check('IMPORTCONFIRM-01 confirmを承認するとファイル選択(filechooser)が開く', !!fileChooser)
    } finally {
      await icBrowser.close()
    }
  }

  // --- PRO-FALLBACK-01: crypto.subtleが使えないinsecure context(開発中LANのhttp://192.168.x.x
  // 等でのiPhone実機テストが該当。docs/22)でも、純JSのSHA-256フォールバック(src/logic/sha256.ts)
  // でPro解錠コード検証が最後まで動くことを確認する(2026-07-13)。crypto.subtleの有無自体は
  // オリジンがhttp/httpsかで決まらずaddInitScriptで直接再現できるが、production buildの
  // 挙動を見るため他チェックのdevサーバーとは別にpreviewサーバーを自前でport 4194に立てる ---
  currentCheck = 'PRO-FALLBACK-01'
  {
    const distIndex = path.join(appRoot, 'dist', 'index.html')
    if (!existsSync(distIndex)) {
      // このチェックはproductionビルド(dist)のpreview前提。無ければ先にビルドする
      execSync('npx vite build', { cwd: appRoot, stdio: 'inherit' })
    }

    const PREVIEW_PORT = 4194
    const PREVIEW_BASE = `http://localhost:${PREVIEW_PORT}`
    const previewProc = spawn(
      'npx',
      ['vite', 'preview', '--port', String(PREVIEW_PORT), '--strictPort'],
      { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let previewReady = false
    let previewOutput = ''
    previewProc.stdout.on('data', (buf) => {
      previewOutput += buf.toString()
      if (previewOutput.includes('Local:')) previewReady = true
    })
    previewProc.stderr.on('data', (buf) => (previewOutput += buf.toString()))

    try {
      const start = Date.now()
      while (!previewReady && Date.now() - start < 15000) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      if (!previewReady) {
        throw new Error(`previewサーバーが起動しなかった: ${previewOutput}`)
      }

      const fbBrowser = await chromium.launch()
      try {
        const fbContext = await fbBrowser.newContext()
        const fbPage = await fbContext.newPage()
        // insecure context相当を再現: crypto.subtleを未定義化する(実機LAN httpと同じ状況)
        await fbPage.addInitScript(() => {
          Object.defineProperty(window.crypto, 'subtle', { value: undefined, configurable: true })
        })
        await fbPage.goto(`${PREVIEW_BASE}/#/settings?section=pro`, { waitUntil: 'networkidle' })
        await fbPage.waitForTimeout(800)
        const subtleGone = await fbPage.evaluate(() => typeof window.crypto.subtle === 'undefined')
        check('PRO-FALLBACK-01 前提: crypto.subtleを無効化できている', subtleGone)

        // テスト用Pro解錠コード(docs/22の実機確認チェックリスト記載。販売用ではない)。
        // 2026-07-17設定ゼロベース裁定#7: Pro/追加レシピパックの入力欄が1つに統合された
        await fbPage.getByPlaceholder('解錠コード (例: UR-XXXX-XXXX)').fill('UR-96QS-2VSZ')
        await fbPage.getByRole('button', { name: '解錠する', exact: true }).first().click()
        await fbPage.waitForTimeout(1000)
        const fbText = await fbPage.textContent('body')
        check(
          'PRO-FALLBACK-01 crypto.subtle無効でも純JSフォールバックでPro解錠が通る',
          fbText.includes('Pro版をご利用いただきありがとうございます'),
          fbText.includes('コードが正しくありません')
            ? 'コード検証が失敗した(フォールバック不一致の疑い)'
            : `本文に成功メッセージなし: ${fbText.slice(0, 200)}`,
        )
      } finally {
        await fbBrowser.close()
      }
    } finally {
      previewProc.kill()
    }
  }

  // --- PRICEVIEW-01: レシピ詳細の材料「原価ビュー」トグル。2026-07-15新設・2026-07-16裁定1で
  // 全面改修・2026-07-20 便AJ(docs/45)で再改修。「原価を見る」(閲覧)/「原価を編集」(単価編集)の
  // 2チップに分離し、原価サマリーカードは廃止(上部メタ行の概算食費「約◯円」「1食あたり
  // 約◯円」と重複していたため)。2026-07-21 オーナー実機FBで、横並びの独立トグルから
  // 「見る」を押すと「編集」ボタンが出現する階層構造(hidden→view→edit)に変更。
  // 「見る」は開閉の親トグル(view/edit中に再度押すと編集ボタンごとhiddenへ両方解除)、
  // 「編集」はview⇔editの子トグル(見るを閉じない限り出続ける)。基本レシピ「肉じゃが」
  // (servings=2)で検証する: 非表示(既定)は材料セクションに金額表示が無く「原価を編集」
  // ボタンも存在しないこと→「原価を見る」ONで「原価を編集」ボタンが出現し、各材料行の
  // 使用量表示が1食あたりの按分原価(「約◯円」・登録人数固定・タップ不可)に差し替わり、
  // マスタ不一致(水)は「価格なし」になること→「原価を編集」ONで(「原価を見る」は選択中の
  // ままaria-pressed=true)使用量表示が「{価格}円/{単位}」チップ(マスタ不一致は
  // 「価格なし＋登録」)に差し替わることを確認したうえで、
  // (a)チップタップ→価格編集→保存で、その行のチップ・上部メタ行の概算食費・原価を見る側の
  //    按分原価が同時に更新されること、
  // (b)「価格なし」材料(水)の「＋登録」→登録モーダル→保存でチップ化すること、の2シナリオと、
  // 「原価を見る」を選択中にもう一度押すと「原価を編集」ボタンごと非表示に戻ることを確認する ---
  currentCheck = 'PRICEVIEW-01'
  {
    const pvBrowser = await chromium.launch()
    const pvContext = await pvBrowser.newContext()
    const pvPage = await pvContext.newPage()
    pvPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PRICEVIEW-01] ${err.message}`)
    })
    try {
      await pvPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pvPage.waitForTimeout(1800) // 初回シード完了待ち
      await pvPage.getByText('肉じゃが', { exact: true }).first().click()
      await pvPage.waitForTimeout(500)

      // 材料セクション(見出し「材料」を含むsection)だけを対象にする。ページ上部の
      // 概算食費(合計・1食あたり)は原価ビューと無関係に元から「約◯円」を表示するため、
      // body全体ではなくこのsectionに絞らないとOFF時の検証が誤って通ってしまう
      const ingredientsSection = pvPage.locator('section', {
        has: pvPage.getByRole('heading', { name: '材料', level: 2 }),
      })
      const viewButton = pvPage.getByRole('button', { name: '原価を見る' })
      const editButton = pvPage.getByRole('button', { name: '原価を編集' })
      const onionRow = ingredientsSection.locator('li', { hasText: '玉ねぎ' })
      const waterRow = ingredientsSection.locator('li', { hasText: '水' })

      const beforeText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 既定は非表示: 材料セクションに金額表示(円)が無い',
        !/[\d,]+円/.test(beforeText ?? ''),
        beforeText ?? '',
      )
      check('PRICEVIEW-01 既定は非表示: 玉ねぎの行は使用量(1個)のまま', (await onionRow.textContent())?.includes('1個') ?? false)
      check(
        'PRICEVIEW-01 既定は非表示: 「原価を編集」ボタンは存在しない(階層構造。見るを押すまで出現しない)',
        (await editButton.count()) === 0,
      )

      // ---------- 「原価を見る」ON: 「原価を編集」ボタンが出現し、各行が1食あたりの按分原価になる ----------
      await viewButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01 「原価を見る」ON: 押したボタンがaria-pressed=trueになる', (await viewButton.getAttribute('aria-pressed')) === 'true')
      check('PRICEVIEW-01 「原価を見る」ON: 「原価を編集」ボタンが出現する(階層構造)', (await editButton.count()) === 1)
      const onText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「原価を見る」ON: 材料行に「約◯円」の按分原価が表示される(編集チップの「◯円/単位」形式は無い)',
        /約[\d,]+円/.test(onText ?? '') && !/[\d,]+円\/\S+/.test(onText ?? ''),
        onText ?? '',
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: 玉ねぎの行が「約25円」になる(登録単価50円÷登録人数2人分)',
        (await onionRow.textContent())?.includes('約25円') ?? false,
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: マスタ不一致の材料(水)は「価格なし」になる(登録導線「＋登録」は出ない=非インタラクティブ)',
        ((await waterRow.textContent())?.includes('価格なし') ?? false) &&
          !((await waterRow.textContent())?.includes('＋登録') ?? false),
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: 材料行はタップしても何も起きない(ボタンが無い)',
        (await onionRow.getByRole('button').count()) === 0,
      )
      check(
        'PRICEVIEW-01 「原価を見る」ON: 原価サマリーカードは表示されない(便AJで廃止)',
        !(onText ?? '').includes('食材と価格を編集する') && !/1人分 約[\d,]+円/.test(onText ?? ''),
      )

      // ---------- 「原価を編集」ON: 階層構造なので「原価を見る」は選択中のまま、使用量表示だけチップに差し替わる ----------
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01 「原価を編集」ON: 「原価を見る」は選択中のまま(親トグルなのでaria-pressed=trueを維持)',
        (await viewButton.getAttribute('aria-pressed')) === 'true',
      )
      check('PRICEVIEW-01 「原価を編集」ON: 押したボタンがaria-pressed=trueになる', (await editButton.getAttribute('aria-pressed')) === 'true')
      const editText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 「原価を編集」ON: 按分原価「約◯円」は消え、チップ表(◯円/単位)に差し替わる',
        !/約[\d,]+円/.test(editText ?? '') && /[\d,]+円\/\S+/.test(editText ?? ''),
        editText ?? '',
      )
      check(
        'PRICEVIEW-01 「原価を編集」ON: 玉ねぎの行に登録単位と価格のチップ(50円/1個)が出る',
        (editText ?? '').includes('50円/1個'),
      )
      check(
        'PRICEVIEW-01 「原価を編集」ON: マスタ不一致の材料(水)は「価格なし＋登録」になる',
        (editText ?? '').includes('価格なし') && (editText ?? '').includes('＋登録'),
      )
      check(
        'PRICEVIEW-01 「原価を編集」ON: 「ここで変更した価格は「食材と価格」に保存されます」の説明が出る',
        (editText ?? '').includes('ここで変更した価格は「食材と価格」に保存されます'),
      )

      // (a) チップ→編集→行・上部メタ・原価を見る側が同時に変化。玉ねぎ(50円/1個)を70円/1個に変更する
      const topMetaBefore = await pvPage.textContent('body')
      const topTotalBeforeMatch = (topMetaBefore ?? '').match(/約([\d,]+)円/)
      const topPerServingBeforeMatch = (topMetaBefore ?? '').match(/1食あたり 約([\d,]+)円/)
      check('PRICEVIEW-01(a) 編集前の上部メタ合計を取得できる', !!topTotalBeforeMatch)
      check('PRICEVIEW-01(a) 編集前の上部メタ1食あたりを取得できる', !!topPerServingBeforeMatch)
      const topTotalBefore = Number((topTotalBeforeMatch?.[1] ?? '0').replace(/,/g, ''))
      const topPerServingBefore = Number((topPerServingBeforeMatch?.[1] ?? '0').replace(/,/g, ''))

      await onionRow.getByRole('button').click()
      await pvPage.waitForTimeout(300)
      const priceEditDialog = pvPage.getByRole('dialog')
      check(
        'PRICEVIEW-01(a) チップタップで編集モーダルが開き、タイトルが食材名(玉ねぎ)になる(名前は編集不可)',
        (await priceEditDialog.textContent())?.includes('玉ねぎ') ?? false,
      )
      check(
        'PRICEVIEW-01(a) 編集モーダルに現在の価格(50)が入っている',
        (await priceEditDialog.getByLabel('価格（円）').inputValue()) === '50',
      )
      await priceEditDialog.getByLabel('価格（円）').fill('70')
      await priceEditDialog.getByRole('button', { name: '保存する' }).click()
      await pvPage.waitForTimeout(400)
      check('PRICEVIEW-01(a) 保存後は編集モーダルが閉じる', (await pvPage.getByRole('dialog').count()) === 0)
      check(
        'PRICEVIEW-01(a) 保存後、玉ねぎの行のチップが70円/1個に変わる',
        ((await onionRow.textContent())?.includes('70円/1個') ?? false) &&
          !((await onionRow.textContent())?.includes('50円/1個') ?? false),
      )

      const topMetaAfter = await pvPage.textContent('body')
      const topTotalAfterMatch = (topMetaAfter ?? '').match(/約([\d,]+)円/)
      const topPerServingAfterMatch = (topMetaAfter ?? '').match(/1食あたり 約([\d,]+)円/)
      const topTotalAfter = Number((topTotalAfterMatch?.[1] ?? '0').replace(/,/g, ''))
      const topPerServingAfter = Number((topPerServingAfterMatch?.[1] ?? '0').replace(/,/g, ''))
      check(
        'PRICEVIEW-01(a) 価格編集で上部メタ合計が差分どおり増える(50→70円は+20)',
        topTotalAfter - topTotalBefore === 20,
        `before=${topTotalBefore} after=${topTotalAfter}`,
      )
      check(
        'PRICEVIEW-01(a) 価格編集で上部メタ1食あたりも増える(原価ビューと無関係に追従)',
        topPerServingAfter > topPerServingBefore,
        `before=${topPerServingBefore} after=${topPerServingAfter}`,
      )

      // 「原価を編集」をもう一度押して(子トグルでedit→view)「原価を見る」表示に戻ると、
      // 編集した70円がそのまま按分原価(70÷2人分=約35円)に反映される
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01(a) 編集を閉じてview表示に戻ると、「原価を見る」がaria-pressed=true・「原価を編集」がaria-pressed=falseになる',
        (await viewButton.getAttribute('aria-pressed')) === 'true' &&
          (await editButton.getAttribute('aria-pressed')) === 'false',
      )
      check(
        'PRICEVIEW-01(a) 「原価を見る」表示に戻ると、玉ねぎの按分原価が編集後の価格で再計算される(70÷2人分=約35円)',
        (await onionRow.textContent())?.includes('約35円') ?? false,
      )

      // (b) 価格なし→登録→チップ化。「水」に価格が無い状態から「原価を編集」の「＋登録」で新規登録する
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01(b) 登録前は「水」の行が「価格なし」', (await waterRow.textContent())?.includes('価格なし') ?? false)
      await waterRow.getByRole('button').click()
      await pvPage.waitForTimeout(300)
      const addDialog = pvPage.getByRole('dialog')
      check(
        'PRICEVIEW-01(b) 「＋登録」で登録モーダルが開き、名前欄に「水」が初期値で入る(編集可)',
        (await addDialog.getByLabel('食材名').inputValue()) === '水',
      )
      await addDialog.getByLabel('価格（円）').fill('10')
      await addDialog.getByLabel('数量', { exact: true }).fill('1')
      await addDialog.getByLabel('単位', { exact: true }).selectOption('L')
      await addDialog.getByRole('button', { name: '保存する' }).click()
      await pvPage.waitForTimeout(400)
      check('PRICEVIEW-01(b) 保存後は登録モーダルが閉じる', (await pvPage.getByRole('dialog').count()) === 0)
      check(
        'PRICEVIEW-01(b) 登録後、「水」の行が10円/1Lのチップに変わり「価格なし」は消える',
        ((await waterRow.textContent())?.includes('10円/1L') ?? false) &&
          !((await waterRow.textContent())?.includes('価格なし') ?? false),
      )

      // 「原価を編集」をもう一度押して(子トグルでedit→view)「原価を見る」表示に戻ると、
      // 登録した水(300ml分・10円/1L→3円÷2人分=1.5→四捨五入2円)も按分原価が出る
      await editButton.click()
      await pvPage.waitForTimeout(300)
      check(
        'PRICEVIEW-01(b) 登録後「原価を見る」表示で水の行にも按分原価が出る(300ml分3円÷2人分=約2円)',
        (await waterRow.textContent())?.includes('約2円') ?? false,
      )

      // ---------- 選択中の「原価を見る」をもう一度押すと「原価を編集」ボタンごと非表示に戻る ----------
      await viewButton.click()
      await pvPage.waitForTimeout(300)
      check('PRICEVIEW-01 「原価を見る」を再度押すと非表示になる: aria-pressed=false', (await viewButton.getAttribute('aria-pressed')) === 'false')
      check(
        'PRICEVIEW-01 非表示に戻る: 「原価を編集」ボタンも消える(階層構造)',
        (await editButton.count()) === 0,
      )
      const afterText = await ingredientsSection.textContent()
      check(
        'PRICEVIEW-01 非表示に戻る: 金額表示(按分原価・チップとも)が消える',
        !/[\d,]+円/.test(afterText ?? ''),
        afterText ?? '',
      )
      check('PRICEVIEW-01 非表示に戻る: 水の行は使用量(300ml)表示に戻る', (await waterRow.textContent())?.includes('300ml') ?? false)
    } finally {
      await pvBrowser.close()
    }
  }

  // --- SHARE-01: シェアの選択式モーダル(2026-07-16 Fable裁定docs/30 裁定3)。
  // 基本レシピ「豚汁」(材料9件・4人分・調理時間30分・材料に価格マスタのデフォルトあり)を使い、
  // (a)既定選択のテキストシェア(=chromiumではクリップボードへコピー)の文字列、
  // (b)「材料をすべて載せる」+「原価」ON時の文字列、(c)画像カードの生成成功(ダウンロード発生)
  // を確認する。クリップボードの読み取りにはcontextへの権限付与が必要 ---
  currentCheck = 'SHARE-01'
  {
    const shBrowser = await chromium.launch()
    const shContext = await shBrowser.newContext()
    await shContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
    const shPage = await shContext.newPage()
    shPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHARE-01] ${err.message}`)
    })
    try {
      await shPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await shPage.waitForTimeout(1800) // 初回シード完了待ち
      await shPage.getByText('豚汁', { exact: true }).first().click()
      await shPage.waitForTimeout(500)

      // シェアボタン→選択モーダル(旧インラインパネルは廃止)
      await shPage.locator('button[aria-label="シェア"]').click()
      await shPage.waitForTimeout(300)
      const shareDialog = shPage.getByRole('dialog', { name: 'シェアする内容' })
      check('SHARE-01 シェアボタンで選択モーダルが開く', (await shareDialog.count()) === 1)
      const dialogText = (await shareDialog.textContent()) ?? ''
      check(
        'SHARE-01 固定項目の説明文言(料理名・食数・材料8件・作り方)が出る',
        dialogText.includes('料理名・食数・材料（最初の8件）・作り方は常に入ります'),
      )
      check('SHARE-01 レシピ画像の行に「※画像カードのみ」が併記される', dialogText.includes('※画像カードのみ'))

      // 既定値: 画像ON・調理時間ON(豚汁はcookMinutesあり)・原価OFF・栄養OFF・材料全部OFF
      const optionCheckbox = (label) =>
        shareDialog.locator('label', { hasText: label }).locator('input[type="checkbox"]')
      check('SHARE-01 既定: レシピ画像ON', await optionCheckbox('レシピ画像').isChecked())
      check('SHARE-01 既定: 調理時間ON', await optionCheckbox('調理時間').isChecked())
      check('SHARE-01 既定: 原価OFF', !(await optionCheckbox('原価').isChecked()))
      check(
        'SHARE-01 既定: 栄養OFF(行はカロリー・塩分の文言で表示。チェック行ラベルから「（めやす）」は削除済み・シェア本文側は法務配慮で残す)',
        !(await optionCheckbox('1食あたりのカロリー・塩分').isChecked()),
      )
      check('SHARE-01 既定: 材料をすべて載せるOFF', !(await optionCheckbox('材料をすべて載せる').isChecked()))

      // (a) 既定選択のままテキストでシェア → chromiumはnavigator.share非対応のためコピーになる
      await shareDialog.getByRole('button', { name: 'テキストでシェア' }).click()
      await shPage.waitForTimeout(600)
      check(
        'SHARE-01(a) コピー完了メッセージがモーダル内に出る',
        ((await shareDialog.textContent()) ?? '').includes('レシピの文章をコピーしました'),
      )
      const copiedDefault = await shPage.evaluate(() => navigator.clipboard.readText())
      // 2026-07-23 便BJ・docs/55 CEO提案2-1: 料理名と人数分は別行(貼り付けパーサーが人数分だけの
      // 行として読み飛ばし、料理名を汚さないため)。作り方(全手順)も【作り方】見出しつきで入る
      check('SHARE-01(a) 料理名+人数分が別行', copiedDefault.includes('豚汁\n4人分'))
      check('SHARE-01(a) 調理時間行(既定ON)', copiedDefault.includes('調理時間 約30分'))
      check(
        'SHARE-01(a) 材料は8件+…ほか(9件目のごま油の材料行は入らない)',
        copiedDefault.includes('【材料】') &&
          copiedDefault.includes('…ほか') &&
          !copiedDefault.includes('・ごま油'),
      )
      check('SHARE-01(a) 作り方(全手順)が【作り方】見出しつきで入る', copiedDefault.includes('【作り方】'))
      check('SHARE-01(a) 「作り方は全◯ステップ」行が無い(裁定3で削除)', !copiedDefault.includes('作り方は全'))
      check(
        'SHARE-01(a) アプリ名とURLは必ず残る(宣伝枠)',
        copiedDefault.includes('#うちレシピ') && copiedDefault.includes('https://uchirecipe.com/'),
      )
      check(
        'SHARE-01(a) 原価・栄養は既定OFFで入らない',
        !copiedDefault.includes('原価') && !copiedDefault.includes('kcal'),
      )

      // (b) 材料をすべて載せる+原価ON → 全材料と原価行(登録人数4人分基準)が入る
      await optionCheckbox('材料をすべて載せる').check()
      await optionCheckbox('原価').check()
      await shareDialog.getByRole('button', { name: 'テキストでシェア' }).click()
      await shPage.waitForTimeout(600)
      const copiedFull = await shPage.evaluate(() => navigator.clipboard.readText())
      check(
        'SHARE-01(b) 全材料が入り…ほかが消える(9件目のごま油も入る)',
        copiedFull.includes('・ごま油') && !copiedFull.includes('…ほか'),
      )
      check(
        'SHARE-01(b) 原価行(1人分/全量・登録人数基準)が入る',
        /原価 1人分 約[\d,]+円／全量（4人分） 約[\d,]+円/.test(copiedFull),
      )

      // (c) 画像カードでシェア → 非対応環境ではPNGダウンロード(=生成成功のみ確認)
      const [download] = await Promise.all([
        shPage.waitForEvent('download', { timeout: 15000 }),
        shareDialog.getByRole('button', { name: '画像カードでシェア' }).click(),
      ])
      check(
        'SHARE-01(c) 画像カードが生成されPNGダウンロードに切り替わる',
        download.suggestedFilename().endsWith('.png'),
        download.suggestedFilename(),
      )

      // (d) 往復(round-trip・2026-07-23 便BJ・docs/55 CEO提案2-1): (b)でコピーした全文をそのまま
      // 新規レシピに貼り付け、自動振り分けで材料・手順が過不足なく復元される=テキスト共有が
      // 「見る専用」ではなく端末間で丸ごと取り込める形式であることの実DOM実証。
      const ingLineCount = copiedFull.split('\n').filter((l) => l.startsWith('・')).length
      const stepLineCount = copiedFull.split('\n').filter((l) => /^\d+\.\s/.test(l)).length
      await shPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await shPage.waitForTimeout(500)
      await shPage.getByText('テキスト貼り付けで自動入力').click()
      await shPage.waitForTimeout(300)
      await shPage.locator('textarea[placeholder="ここにレシピの文章を貼り付け"]').fill(copiedFull)
      await shPage.getByRole('button', { name: '自動で振り分ける' }).click()
      await shPage.waitForTimeout(400)
      const rtFormText = await shPage.textContent('body')
      check(
        'SHARE-01(d) 往復: 貼り付けで材料・手順が過不足なく復元される',
        rtFormText.includes(`材料${ingLineCount}件・手順${stepLineCount}件を読み取りました`),
        rtFormText,
      )
      check(
        'SHARE-01(d) 往復: 料理名も復元される(人数分の括弧に汚れない)',
        (await shPage.getByPlaceholder('例: 肉じゃが').inputValue()) === '豚汁',
      )
      check(
        'SHARE-01(d) 往復: 末尾の入口URLが手順に化けない(手順数=共有本文の手順行数)',
        stepLineCount > 0 && rtFormText.includes(`手順${stepLineCount}件`),
      )
    } finally {
      await shBrowser.close()
    }
  }

  // --- FOCUS-HINT-01: 調理中モードの初回発見性(2026-07-23 便BJ・docs/55 CEO提案1-5)。
  // レシピ詳細を初めて開いたときだけ「作りながら見るならこれ」の控えめなヒントを1回だけ出し、
  // 2品目以降は出さない(cookModeHintSeenフラグで再表示しない)。新規IndexedDBの独立ブラウザで検証 ---
  currentCheck = 'FOCUS-HINT-01'
  {
    const fhBrowser = await chromium.launch()
    const fhContext = await fhBrowser.newContext()
    const fhPage = await fhContext.newPage()
    fhPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FOCUS-HINT-01] ${err.message}`)
    })
    try {
      await fhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fhPage.waitForTimeout(1800) // 初回シード完了待ち
      // 1品目: 初回ヒントが出る
      await fhPage.getByText('肉じゃが', { exact: true }).first().click()
      await fhPage.waitForTimeout(600)
      check(
        'FOCUS-HINT-01 初回のレシピ詳細で「作りながら見るならこれ」ヒントが出る',
        (await fhPage.getByText('作りながら見るならこれ').count()) === 1,
      )
      // 2品目: もう出ない(1回だけ)
      await fhPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await fhPage.waitForTimeout(600)
      await fhPage.getByText('カレーライス', { exact: true }).first().click()
      await fhPage.waitForTimeout(600)
      check(
        'FOCUS-HINT-01 2品目以降はヒントが出ない(1回だけ)',
        (await fhPage.getByText('作りながら見るならこれ').count()) === 0,
      )
      // 調理中モードのボタン自体は毎回ある(ヒントが消えても機能は不変)
      check(
        'FOCUS-HINT-01 ヒントが消えても「調理中モードで見る」ボタンは残る',
        (await fhPage.getByText('調理中モードで見る').count()) >= 1,
      )
    } finally {
      await fhBrowser.close()
    }
  }

  // --- FORMTABS-01: レシピ編集フォームの「かんたん/くわしく」タブ分け(2026-07-16 Fable裁定
  // docs/26・案A承認)。(a)新規登録の初期表示は常に「かんたん」タブで、かんたんタブの入力だけで
  // 保存が成功すること (b)「くわしく」タブ側フィールドに入力があると見出し右の●
  // (aria-label「入力済みの項目があります」)が出ること・空のうちは出ないこと
  // (c)「くわしく」タブを表示中に料理名未入力のまま保存すると、エラー表示とともに
  // 「かんたん」タブへ自動的に戻ること (d)実装は両タブのDOMを常時マウントし`hidden`属性で
  // 切り替えるだけのため、くわしくタブの入力内容がタブ往復でも消えない(state維持)ことを確認する ---
  currentCheck = 'FORMTABS-01'
  {
    const ftBrowser = await chromium.launch()
    const ftContext = await ftBrowser.newContext()
    const ftPage = await ftContext.newPage()
    ftPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMTABS-01] ${err.message}`)
    })
    try {
      await ftPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(1800) // 初回シード完了待ち

      // (a) 新規登録の初期表示は常に「かんたん」タブ。かんたんタブの入力だけで保存が成功する
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const simpleTab = ftPage.getByRole('tab', { name: 'かんたん' })
      const detailTab = ftPage.getByRole('tab', { name: 'くわしく' })
      check(
        'FORMTABS-01a 新規登録の初期表示は「かんたん」タブ(aria-selected)',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )
      await ftPage.getByPlaceholder('例: 肉じゃが').fill('E2Eタブかんたん保存確認レシピ')
      await ftPage.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
      await ftPage.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(800)
      check(
        'FORMTABS-01a かんたんタブの入力だけで保存が成功する(くわしくは未入力のまま)',
        (await ftPage.textContent('body')).includes('E2Eタブかんたん保存確認レシピ'),
      )
      // 後始末: 検証用に作成したレシピを削除
      await ftPage.locator('a[href*="/edit"]').first().click()
      await ftPage.waitForTimeout(500)
      await ftPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await ftPage.waitForTimeout(800)

      // (b) くわしくタブが空のうちは●が出ず、入力があると出る
      await ftPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ftPage.waitForTimeout(500)
      const dotBefore = await ftPage.locator('[aria-label="入力済みの項目があります"]').count()
      check('FORMTABS-01b くわしくタブが空のうちは●が出ない', dotBefore === 0)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByPlaceholder('気づいたこと・アレンジなどを自由に').fill('E2Eタブ確認メモ')
      await ftPage.waitForTimeout(200)
      const dotAfter = await ftPage.locator('[aria-label="入力済みの項目があります"]').count()
      check('FORMTABS-01b くわしくに入力があると見出し右に●が出る', dotAfter > 0)

      // (c) くわしくタブを表示中に料理名未入力のまま保存すると、エラー表示+「かんたん」タブへ戻る
      await ftPage.getByRole('button', { name: '保存する' }).click()
      await ftPage.waitForTimeout(300)
      check(
        'FORMTABS-01c 料理名未入力で保存するとエラーが表示される',
        (await ftPage.textContent('body')).includes('料理名を入力してください'),
      )
      check(
        'FORMTABS-01c 料理名未入力で保存すると「かんたん」タブへ自動的に戻る',
        (await simpleTab.getAttribute('aria-selected')) === 'true' &&
          (await detailTab.getAttribute('aria-selected')) === 'false',
      )

      // (d) タブ往復してもくわしくタブの入力内容が消えない(両タブのDOMを常時マウントし
      // hidden属性で切り替えているだけの実装であることの確認)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      const memoBeforeSwitch = await ftPage
        .getByPlaceholder('気づいたこと・アレンジなどを自由に')
        .inputValue()
      check(
        'FORMTABS-01d くわしくタブへ戻るとメモの入力内容がまだ残っている(切替前確認)',
        memoBeforeSwitch === 'E2Eタブ確認メモ',
      )
      await ftPage.getByRole('tab', { name: 'かんたん' }).click()
      await ftPage.waitForTimeout(200)
      await ftPage.getByRole('tab', { name: 'くわしく' }).click()
      await ftPage.waitForTimeout(200)
      const memoAfterSwitch = await ftPage
        .getByPlaceholder('気づいたこと・アレンジなどを自由に')
        .inputValue()
      check(
        'FORMTABS-01d かんたん→くわしくと切り替えてもメモの入力内容が残っている(state維持)',
        memoAfterSwitch === 'E2Eタブ確認メモ',
      )
    } finally {
      await ftBrowser.close()
    }
  }

  // --- ICONPICK-01: 「画像」3択UI(2026-07-16 Fable裁定docs/30 裁定2【画像の3択】)。
  // [カメラで撮る][アルバムから選ぶ][アイコンから選ぶ▾]の3等分タイルで、3つ目が折りたたみの
  // 開閉ボタンになっていること(aria-expanded)・展開でアイコングリッドが出ること・写真を設定した
  // 状態でアイコンをタップすると「写真ではなくアイコンを表示」(showIconInsteadOfPhoto)が自動で
  // ONになりプレビューが即座にアイコン表示へ切り替わること・保存後の詳細画面でもアイコン表示が
  // 維持される(showIconInsteadOfPhotoが実際にDBへ連動している)ことを確認する ---
  currentCheck = 'ICONPICK-01'
  {
    const ipBrowser = await chromium.launch()
    const ipContext = await ipBrowser.newContext()
    const ipPage = await ipContext.newPage()
    ipPage.on('dialog', (dialog) => dialog.accept())
    ipPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@ICONPICK-01] ${err.message}`)
    })
    try {
      // 1x1の最小PNG(LOG-PHOTO-01と同じダミー画像。resizePhotoが実際にデコードできる本物の
      // 画像である必要があるため、テキストダミーではなくPNGを使う)
      const tinyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      )
      await ipPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await ipPage.waitForTimeout(800)

      // 見出しが「写真」ではなく「画像」に改称されている(photoLabel値変更。裁定2 ①)
      check(
        'ICONPICK-01 見出しが「画像」に改称されている',
        await ipPage.getByText('画像', { exact: true }).first().isVisible().catch(() => false),
      )

      await ipPage.getByPlaceholder('例: 肉じゃが').fill('E2Eアイコン選択確認レシピ')
      await ipPage.getByPlaceholder('例: じゃがいも').first().fill('テスト材料')
      await ipPage.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('テスト手順')

      // 「アルバムから選ぶ」用のinput(capture属性が無い方)に写真を投入する
      await ipPage
        .locator('input[type="file"]:not([capture])')
        .setInputFiles({ name: 'test.png', mimeType: 'image/png', buffer: tinyPng })
      await ipPage.waitForTimeout(500)
      const previewPhotoImg = ipPage.locator('img[alt="E2Eアイコン選択確認レシピ"]')
      check(
        'ICONPICK-01 写真を設定するとプレビューに写真が出る',
        await previewPhotoImg.isVisible().catch(() => false),
      )

      // 3つ目のタイル「アイコンから選ぶ」は折りたたみの開閉ボタン(裁定2 ③)
      const iconToggle = ipPage.getByRole('button', { name: 'アイコンから選ぶ' })
      check(
        'ICONPICK-01 「アイコンから選ぶ」は閉じた状態(aria-expanded=false)で始まる',
        (await iconToggle.getAttribute('aria-expanded')) === 'false',
      )
      await iconToggle.click()
      await ipPage.waitForTimeout(200)
      check(
        'ICONPICK-01 クリックでaria-expandedがtrueになりアイコングリッド(自動+15種)が開く',
        (await iconToggle.getAttribute('aria-expanded')) === 'true' &&
          (await ipPage.getByRole('button', { name: '自動' }).first().isVisible()),
      )

      // アイコン(ご飯・丼)をタップする。写真設定済みなのでshowIconInsteadOfPhotoが自動ONになるはず(裁定2 ④)
      await ipPage.getByRole('button', { name: 'ご飯・丼', exact: true }).click()
      await ipPage.waitForTimeout(300)
      check(
        'ICONPICK-01 写真設定済みでアイコンを選ぶとプレビューが写真からアイコン表示に切り替わる',
        !(await previewPhotoImg.isVisible().catch(() => false)),
      )

      // くわしくタブの「写真ではなくアイコンを表示」トグル(このページで唯一のrole=switch)が
      // アイコンタップの副作用で自動的にONになっている(●が点く。オーナー報告に明記の仕様)
      await ipPage.getByRole('tab', { name: 'くわしく' }).click()
      await ipPage.waitForTimeout(200)
      const showIconSwitch = ipPage.locator('button[role="switch"]')
      check(
        'ICONPICK-01 くわしくタブの「写真ではなくアイコンを表示」トグルが自動でONになっている',
        (await showIconSwitch.getAttribute('aria-checked')) === 'true',
      )
      await ipPage.getByRole('tab', { name: 'かんたん' }).click()
      await ipPage.waitForTimeout(200)

      // 保存→詳細画面でもアイコン表示が維持されている(showIconInsteadOfPhotoが実際にDBへ連動)
      await ipPage.getByRole('button', { name: '保存する' }).click()
      await ipPage.waitForTimeout(800)
      const detailPhotoImg = ipPage.locator('img[alt="E2Eアイコン選択確認レシピ"]')
      check(
        'ICONPICK-01 保存後の詳細画面でも写真ではなくアイコンが表示される(DB連動)',
        !(await detailPhotoImg.isVisible().catch(() => false)),
      )
      check(
        'ICONPICK-01 保存後、詳細画面のタイトルが正しく表示される',
        (await ipPage.textContent('body')).includes('E2Eアイコン選択確認レシピ'),
      )

      // 後始末: 検証用に作成したレシピを削除
      await ipPage.locator('a[href*="/edit"]').first().click()
      await ipPage.waitForTimeout(500)
      await ipPage.getByRole('button', { name: 'このレシピを削除' }).click()
      await ipPage.waitForTimeout(800)
    } finally {
      await ipBrowser.close()
    }
  }

  // --- FORMRESET-01: レシピ編集画面の「デフォルトに戻す」(2026-07-15 オーナー要望)。
  // DBには書き込まずフォームの入力値だけを差し替える安全設計。window.confirmは使わず、
  // もう一度押す方式(1回目はラベルが確認文言に変わるだけ・2回目で実行)で誤操作を防ぐ ---
  currentCheck = 'FORMRESET-01'
  {
    const frBrowser = await chromium.launch()
    const frContext = await frBrowser.newContext()
    const frPage = await frContext.newPage()
    frPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@FORMRESET-01] ${err.message}`)
    })
    try {
      // (a) 基本レシピ「肉じゃが」: タイトル・材料を書き換えてからリセット
      // → starterDefsの原本に戻り、保存しなければ実データ(DB)も壊れないことを確認
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(1800) // 初回シード完了待ち
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)

      const titleInput = frPage.getByPlaceholder('例: 肉じゃが')
      await titleInput.fill('テスト改名')
      const firstIngredientInput = frPage.getByPlaceholder('例: じゃがいも').first()
      await firstIngredientInput.fill('テスト材料')

      check(
        'FORMRESET-01a 基本レシピの編集画面に「デフォルトに戻す」ボタンが出る',
        await frPage.getByRole('button', { name: 'デフォルトに戻す' }).isVisible(),
      )
      await frPage.getByRole('button', { name: 'デフォルトに戻す' }).click()
      await frPage.waitForTimeout(200)
      check(
        'FORMRESET-01a 1回目のクリックでは実行されず「もう一度押すと戻します」に変わる',
        await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).isVisible(),
      )
      check(
        'FORMRESET-01a 確認待ちの間はまだ変更後のタイトルのまま',
        (await titleInput.inputValue()) === 'テスト改名',
      )

      await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).click()
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01a 2回目のクリックでタイトルが原本(肉じゃが)に戻る',
        (await titleInput.inputValue()) === '肉じゃが',
      )
      check(
        'FORMRESET-01a 材料も原本(じゃがいも)に戻る',
        (await firstIngredientInput.inputValue()) === 'じゃがいも',
      )
      check(
        'FORMRESET-01a 保存前の軽いフィードバックが表示される',
        (await frPage.textContent('body')).includes('まだ保存されていません。保存すると確定します'),
      )

      // 保存せずに一覧へ離脱しても実データが壊れていないことを確認
      // (テスト改名・テスト材料のどちらもDBに書き込まれていないこと)
      await frPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      const frListText = await frPage.textContent('body')
      check('FORMRESET-01a 離脱後も一覧に「肉じゃが」がそのまま残る', frListText.includes('肉じゃが'))
      check('FORMRESET-01a 離脱後、一覧に「テスト改名」は存在しない', !frListText.includes('テスト改名'))
      await frPage.getByText('肉じゃが', { exact: true }).first().click()
      await frPage.waitForTimeout(500)
      const frDetailText = await frPage.textContent('body')
      check(
        'FORMRESET-01a 実データの材料も書き換わっていない(じゃがいもが残る・テスト材料は無い)',
        frDetailText.includes('じゃがいも') && !frDetailText.includes('テスト材料'),
      )

      // (b) 自作レシピ: 新規登録→保存→編集でタイトル変更→リセットで前回保存タイトルに戻ることを確認
      // (自作レシピはラベルが「前回保存した内容に戻す」で、スターターの「デフォルトに戻す」とは異なる)
      await frPage.goto(`${BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
      await frPage.waitForTimeout(500)
      await frPage.getByPlaceholder('例: 肉じゃが').fill('FORMRESET自作レシピ')
      await frPage.getByPlaceholder('例: じゃがいも').first().fill('にんじん')
      await frPage.getByPlaceholder('例: じゃがいもを一口大に切る').first().fill('切る')
      await frPage.getByRole('button', { name: '保存する' }).click()
      await frPage.waitForTimeout(800)
      check(
        'FORMRESET-01b 自作レシピの新規保存が成功する',
        (await frPage.textContent('body')).includes('FORMRESET自作レシピ'),
      )

      await frPage.locator('a[href*="/edit"]').first().click()
      await frPage.waitForTimeout(500)
      check(
        'FORMRESET-01b 自作レシピの編集画面は「前回保存した内容に戻す」ボタンになる',
        await frPage.getByRole('button', { name: '前回保存した内容に戻す' }).isVisible(),
      )
      const ownTitleInput = frPage.getByPlaceholder('例: 肉じゃが')
      await ownTitleInput.fill('FORMRESET改名後')
      await frPage.getByRole('button', { name: '前回保存した内容に戻す' }).click()
      await frPage.waitForTimeout(200)
      await frPage.getByRole('button', { name: 'もう一度押すと戻します' }).click()
      await frPage.waitForTimeout(300)
      check(
        'FORMRESET-01b 2回目のクリックで前回保存したタイトルに戻る',
        (await ownTitleInput.inputValue()) === 'FORMRESET自作レシピ',
      )
    } finally {
      await frBrowser.close()
    }
  }

  // --- PANTRY-BULK-01: 在庫チップ「まとめて状態設定」(2026-07-17 docs/35 §5 オーナー決定・案D)。
  // 整理モード中、選択したチップに「ある」「少ない」「ない」の3ボタンで一括状態変更できることを
  // 検証する。プリセット食材は既定levelが'none'のため、先に通常モード(単発タップ)で「ある」に
  // 変えてから一括「ない」を適用しないと、書き込みが実際に効いたことを証明できない点に注意。
  // 合わせて既存の整理モード一括削除も同じセッションで検証し、退行がないことを確認する ---
  currentCheck = 'PANTRY-BULK-01'
  {
    const pbBrowser = await chromium.launch()
    const pbContext = await pbBrowser.newContext()
    const pbPage = await pbContext.newPage()
    pbPage.on('dialog', (dialog) => dialog.accept())
    pbPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRY-BULK-01] ${err.message}`)
    })
    const readPantryItems = () =>
      pbPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const req2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          req2.onsuccess = () => resolve(req2.result)
          req2.onerror = () => reject(req2.error)
        })
        idb.close()
        return items
      })
    try {
      await pbPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pbPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品も同時に投入される)
      await pbPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await pbPage.waitForTimeout(500)

      // 前提: 「食材の在庫」タブが既定で開いている(通常モード)。対象3品(卵・玉ねぎ・にんじん)を
      // 単発タップで「ない」→「ある」に変え、既定値のままでは一括更新の証明にならない問題を回避する
      for (const name of ['卵', '玉ねぎ', 'にんじん']) {
        await pbPage.getByRole('button', { name }).click()
        await pbPage.waitForTimeout(150)
      }
      const beforeBulk = await readPantryItems()
      check(
        'PANTRY-BULK-01 前提: 対象3品を単発タップで「ある」にできた',
        ['卵', '玉ねぎ', 'にんじん'].every(
          (name) => beforeBulk.find((p) => p.name === name)?.level === 'have',
        ),
        `beforeBulk=${JSON.stringify(beforeBulk)}`,
      )

      // 整理モードに入る
      await pbPage.getByRole('button', { name: '整理', exact: true }).click()
      await pbPage.waitForTimeout(300)
      check(
        'PANTRY-BULK-01 整理モードに入ると案内文が出る',
        (await pbPage.textContent('body')).includes('タップして選択'),
      )

      const bulkButton = (label) => pbPage.getByRole('button', { name: label, exact: true })
      check(
        'PANTRY-BULK-01 0件選択時は「ある」「少ない」「ない」ボタンがdisabled',
        (await bulkButton('ある').isDisabled()) &&
          (await bulkButton('少ない').isDisabled()) &&
          (await bulkButton('ない').isDisabled()),
      )

      // 対象3品を整理モードのチップとして選択する
      for (const name of ['卵', '玉ねぎ', 'にんじん']) {
        await pbPage.getByRole('button', { name, exact: true }).click()
      }
      await pbPage.waitForTimeout(200)
      check(
        'PANTRY-BULK-01 3件選択するとボタンのdisabledが解除される',
        !(await bulkButton('ない').isDisabled()),
      )

      // 「ない」を適用する
      await bulkButton('ない').click()
      await pbPage.waitForTimeout(400)
      const toastText = await pbPage.textContent('body')
      check(
        'PANTRY-BULK-01 適用後にトーストが出る(3件を「ない」にしました)',
        toastText.includes('3件を『ない』にしました'),
        toastText.slice(0, 200),
      )
      check(
        'PANTRY-BULK-01 適用後は選択が解除されボタンが再びdisabledになる(整理モードは維持)',
        (await bulkButton('ない').isDisabled()) &&
          (await pbPage.getByRole('button', { name: '完了', exact: true }).isVisible()),
      )

      const afterBulk = await readPantryItems()
      check(
        'PANTRY-BULK-01 選択した3件が実際にIndexedDB上でlevel=noneになる',
        ['卵', '玉ねぎ', 'にんじん'].every(
          (name) => afterBulk.find((p) => p.name === name)?.level === 'none',
        ),
        `afterBulk=${JSON.stringify(afterBulk)}`,
      )
      check(
        'PANTRY-BULK-01 選択していない品(じゃがいも)は既定のnoneのまま変化しない',
        afterBulk.find((p) => p.name === 'じゃがいも')?.level === 'none',
      )

      // 既存の整理モード一括削除が退行していないことを、同じ整理モードのまま続けて確認する
      const beforeDeleteCount = afterBulk.length
      await pbPage.getByRole('button', { name: 'じゃがいも', exact: true }).click()
      await pbPage.waitForTimeout(200)
      check(
        'PANTRY-BULK-01(delete) 1件選択で削除ボタンに件数が出る',
        await pbPage.getByRole('button', { name: '選択した1件を削除', exact: true }).isVisible(),
      )
      await pbPage.getByRole('button', { name: '選択した1件を削除', exact: true }).click()
      await pbPage.waitForTimeout(400)
      const afterDelete = await readPantryItems()
      check(
        'PANTRY-BULK-01(delete) 削除した品(じゃがいも)がIndexedDBから消える',
        !afterDelete.some((p) => p.name === 'じゃがいも') && afterDelete.length === beforeDeleteCount - 1,
        `afterDelete件数=${afterDelete.length}`,
      )
      check(
        'PANTRY-BULK-01(delete) 削除後は整理モード自体を抜ける(既存挙動どおり・まとめて状態設定とは異なる)',
        await pbPage.getByRole('button', { name: '整理', exact: true }).isVisible(),
      )
    } finally {
      await pbBrowser.close()
    }
  }

  // --- URLIMPORT-01〜: 「URLから取り込む」。エンドポイント設定時の表示・取り込みフロー全体
  // (成功/no_recipe/fetch_failed)を、実際のCloudflare Workerを立てずに検証する。
  // VITE_RECIPE_IMPORT_ENDPOINT を(実在しない.invalidドメインの)ダミー値で焼き込んでビルドし、
  // page.route()でその宛先へのfetchだけをブラウザ内で横取りしてWorkerの応答を模す(実ネットワークには
  // 出ない)。他チェックが使うBASE(通常5173。オーナー検証時等はport 4202を使うこともある)・
  // PRO-FALLBACK-01が使うport 4194とは別に、自前previewサーバーをport 4203に立てる
  // (CLAUDE.md運用ルール: 自分が起動したPIDのみkill・4190には触れない) ---
  currentCheck = 'URLIMPORT-01'
  {
    const MOCK_ENDPOINT = 'https://recipe-import.example.invalid/api'
    // メインのdist/を上書きしない: 専用outDirへビルドする。以前は素のvite buildで
    // dist/をダミー値入りビルドで置き換えてしまい、後続実行のURLIMPORT-00(未設定なら
    // ボタンが出ない)が汚染distを見て落ちる順序依存フレークになっていた(2026-07-20発覚)
    const URLIMPORT_OUT_DIR = 'dist-urlimport-e2e'
    execSync(`npx vite build --outDir ${URLIMPORT_OUT_DIR} --emptyOutDir`, {
      cwd: appRoot,
      stdio: 'inherit',
      env: { ...process.env, VITE_RECIPE_IMPORT_ENDPOINT: MOCK_ENDPOINT },
    })

    const URLIMPORT_PREVIEW_PORT = 4203
    const URLIMPORT_PREVIEW_BASE = `http://localhost:${URLIMPORT_PREVIEW_PORT}`
    const urlImportPreviewProc = spawn(
      'npx',
      ['vite', 'preview', '--port', String(URLIMPORT_PREVIEW_PORT), '--strictPort', '--outDir', URLIMPORT_OUT_DIR],
      { cwd: appRoot, stdio: ['ignore', 'pipe', 'pipe'] },
    )
    let uiPreviewReady = false
    let uiPreviewOutput = ''
    urlImportPreviewProc.stdout.on('data', (buf) => {
      uiPreviewOutput += buf.toString()
      if (uiPreviewOutput.includes('Local:')) uiPreviewReady = true
    })
    urlImportPreviewProc.stderr.on('data', (buf) => (uiPreviewOutput += buf.toString()))

    try {
      const start = Date.now()
      while (!uiPreviewReady && Date.now() - start < 15000) {
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      if (!uiPreviewReady) {
        throw new Error(`URLIMPORT用previewサーバーが起動しなかった: ${uiPreviewOutput}`)
      }

      const uiBrowser = await chromium.launch()
      try {
        const uiContext = await uiBrowser.newContext()
        const uiPage = await uiContext.newPage()

        // 1x1の実在する有効なPNG(透過)。resizePhoto(createImageBitmap経由)が壊れずデコードできる
        // 必要があるため、単なるダミーバイト列ではなく本物のPNGバイナリを使う
        const DUMMY_PNG_BASE64 =
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

        // Worker応答のスタブ: 「url」クエリの中身で成功/no_recipe/fetch_failedを出し分ける。
        // 画像プロキシ(/image?url=)へのリクエストも同じMOCK_ENDPOINT配下に来るためpathnameで分岐する
        // (2026-07-21 URL取り込みでレシピ写真も一緒に取り込む対応。app側src/logic/urlImportImage.ts
        // がWorker側 GET /image?url= を叩く設計をそのまま模す)
        await uiPage.route(
          (url) => url.href.startsWith(MOCK_ENDPOINT),
          (route) => {
            const requested = new URL(route.request().url())
            const target = requested.searchParams.get('url') ?? ''
            if (requested.pathname.endsWith('/image')) {
              // photo-markerを含むURLだけ画像を返す(それ以外はWorker側のinvalid_content_type相当=400)
              if (!target.includes('photo-marker')) {
                return route.fulfill({
                  status: 400,
                  contentType: 'application/json',
                  body: JSON.stringify({ ok: false, error: 'invalid_content_type' }),
                })
              }
              return route.fulfill({
                status: 200,
                contentType: 'image/png',
                headers: { 'Cache-Control': 'public, max-age=86400' },
                body: Buffer.from(DUMMY_PNG_BASE64, 'base64'),
              })
            }
            if (target.includes('no-recipe-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'no_recipe' }),
              })
            }
            // colon-marker: おいしい健康(https://oishi-kenko.com/recipes/22619)相当のコロン書式・
            // 括弧グラム併記。Worker側は「末尾の空白で名前と分量を切る」ため name に分量が食い込んだ
            // 状態(木綿豆腐: 75 / g など)で返ってくるのを模す。app側 normalizeImportedIngredient が
            // 貼り付け経路と同じロジックで木綿豆腐/75/g・白ごま/小さじ1/3・ごま油/小さじ1/2 に修復すること
            if (target.includes('colon-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                  ok: true,
                  recipe: {
                    title: 'コロン書式レシピ',
                    ingredients: [
                      { name: '木綿豆腐: 75', amount: 'g' },
                      { name: '白ごま: 小さじ1/3 (1', amount: 'g)' },
                      { name: 'ごま油: 小さじ1/2 (2', amount: 'g)' },
                    ],
                    steps: ['豆腐を切る', 'ごまをふる'],
                    servings: 2,
                    sourceUrl: target,
                  },
                }),
              })
            }
            if (target.includes('fetch-failed-marker')) {
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ok: false, error: 'fetch_failed' }),
              })
            }
            return route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({
                ok: true,
                recipe: {
                  title: 'E2Eモック鍋',
                  ingredients: [
                    { name: '鶏もも肉', amount: '300g' },
                    { name: 'しょうゆ', amount: '大さじ2' },
                  ],
                  steps: ['鶏肉を切る', '煮込む'],
                  servings: 3,
                  cookMinutes: 25,
                  // photo-markerを含むURLで取り込んだときだけ画像ありのレシピを返す
                  ...(target.includes('photo-marker') ? { imageUrl: 'https://example.com/photo-marker.jpg' } : {}),
                  sourceUrl: target,
                },
              }),
            })
          },
        )

        await uiPage.goto(`${URLIMPORT_PREVIEW_BASE}/#/recipes/new`, { waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-01 エンドポイント設定時は「URLから取り込む」ボタンが出る',
          await uiPage.getByText('URLから取り込む').isVisible(),
        )

        // --- 成功パス ---
        currentCheck = 'URLIMPORT-02'
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/success-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const importedText = await uiPage.textContent('body')
        check(
          'URLIMPORT-02 成功時に材料2件・手順2件を読み込んだ旨のメッセージが出る',
          importedText.includes('材料2件・手順2件を読み込みました。内容を確認して修正してください'),
        )
        check(
          'URLIMPORT-02 タイトルが自動入力される',
          (await uiPage.locator('input[placeholder="例: 肉じゃが"]').inputValue()) === 'E2Eモック鍋',
        )
        check(
          'URLIMPORT-02 調理時間が自動入力される',
          (await uiPage.locator('input[placeholder="例: 30"]').inputValue()) === '25',
        )
        check(
          'URLIMPORT-02 人数分が自動入力される(3人分)',
          (await uiPage.locator('span.min-w-14.text-center.text-lg.font-bold.text-ink').textContent()) === '3人分',
        )
        const ingNameInputs = uiPage.locator('input[placeholder="例: じゃがいも"]')
        const ingAmountInputs = uiPage.locator('input[placeholder="例: 3"]')
        const ingUnitInputs = uiPage.locator('input[placeholder="例: 個"]')
        check(
          'URLIMPORT-02 材料1件目: name=鶏もも肉・splitQuantityでamount=300/unit=g に分解される',
          (await ingNameInputs.nth(0).inputValue()) === '鶏もも肉' &&
            (await ingAmountInputs.nth(0).inputValue()) === '300' &&
            (await ingUnitInputs.nth(0).inputValue()) === 'g',
        )
        check(
          'URLIMPORT-02 材料2件目: name=しょうゆ・splitQuantityでamount=2/unit=大さじ に分解される',
          (await ingNameInputs.nth(1).inputValue()) === 'しょうゆ' &&
            (await ingAmountInputs.nth(1).inputValue()) === '2' &&
            (await ingUnitInputs.nth(1).inputValue()) === '大さじ',
        )
        const stepInputs = uiPage.locator('textarea[placeholder="例: じゃがいもを一口大に切る"]')
        check(
          'URLIMPORT-02 手順が2件とも自動入力される',
          (await stepInputs.nth(0).inputValue()) === '鶏肉を切る' &&
            (await stepInputs.nth(1).inputValue()) === '煮込む',
        )
        // sourceUrlは「くわしく」タブ内の欄(常時マウント・hidden属性のみで非表示)。inputValueは
        // 可視性を問わずDOMの値を読めるため、タブ切替なしでも自動セットされたことを確認できる
        const sourceUrlInputs = uiPage.locator('input[type="url"]')
        check(
          'URLIMPORT-02 取り込んだURLがsourceUrl欄へ自動セットされる',
          (await sourceUrlInputs.nth(1).inputValue()) === 'https://example.com/success-recipe',
        )

        // --- no_recipeパス: 貼り付け欄への案内文言(オーナー確定文言と一致することを確認) ---
        // ハッシュルーティングは同一URLへのgoto()だと同一文書内遷移扱いになりReact状態がリセット
        // されない(前の入力・開閉状態が残る)ため、確実にフォームを作り直すreload()を使う
        currentCheck = 'URLIMPORT-03'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/no-recipe-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-03 no_recipe時は貼り付け欄への案内文言が出る',
          (await uiPage.textContent('body')).includes(
            'このサイトは自動取り込みに対応していません。ページの文章をコピーして、下の貼り付け欄をお使いください',
          ),
        )

        // --- fetch_failedパス ---
        currentCheck = 'URLIMPORT-04'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/fetch-failed-marker')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-04 fetch_failed時は時間をおいて/貼り付けを促す文言が出る',
          (await uiPage.textContent('body')).includes(
            '読み込めませんでした。時間をおいて試すか、貼り付けをお使いください',
          ),
        )

        // --- 写真の自動取り込み(2026-07-21): imageUrlがあるレシピを取り込むと、
        // Worker側の画像プロキシ(/image?url=)経由で写真も自動セットされる。取得は非同期(ベストエフォート)
        // なので、取り込み結果メッセージが出た後にプレビュー<img>が現れるまで少し待つ。
        // 「写真も取り込む」チェックボックスは既定ONなので、このケースはON前提のまま検証する
        // (2026-07-21 チェックボックス追加。ON時の既存挙動が変わっていないことの確認) ---
        currentCheck = 'URLIMPORT-05'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        const fetchPhotoCheckbox = uiPage
          .locator('label', { hasText: '写真も取り込む' })
          .locator('input[type="checkbox"]')
        check('URLIMPORT-05 「写真も取り込む」チェックボックスは既定でON', await fetchPhotoCheckbox.isChecked())
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-05 レシピ本体の取り込み結果メッセージは写真を待たずに出る',
          (await uiPage.textContent('body')).includes('材料2件・手順2件を読み込みました'),
        )
        await uiPage.waitForTimeout(1000)
        check(
          'URLIMPORT-05 写真も取り込みました、の追記メッセージが出る',
          (await uiPage.textContent('body')).includes('写真も取り込みました'),
        )
        check(
          'URLIMPORT-05 取り込んだ写真がフォームのプレビューに表示される(アイコンでなくimg)',
          await uiPage.locator('img[alt="E2Eモック鍋"]').isVisible(),
        )

        // --- 「写真も取り込む」チェックOFF(2026-07-21 オーナー指示のスイッチ): OFFにしてから
        // imageUrlありのレシピを取り込んでも、レシピ本体は取り込まれるが写真は一切セットされない
        // (fetchImportedPhoto系を呼ばない設計)ことを確認する ---
        currentCheck = 'URLIMPORT-06'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        const fetchPhotoCheckboxOff = uiPage
          .locator('label', { hasText: '写真も取り込む' })
          .locator('input[type="checkbox"]')
        await fetchPhotoCheckboxOff.uncheck()
        check('URLIMPORT-06 チェックを外すとOFFになる', !(await fetchPhotoCheckboxOff.isChecked()))
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/photo-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        check(
          'URLIMPORT-06 チェックOFFでもレシピ本体の取り込み結果メッセージは出る',
          (await uiPage.textContent('body')).includes('材料2件・手順2件を読み込みました'),
        )
        await uiPage.waitForTimeout(1000)
        check(
          'URLIMPORT-06 チェックOFFなら「写真も取り込みました」の追記メッセージは出ない',
          !(await uiPage.textContent('body')).includes('写真も取り込みました'),
        )
        check(
          'URLIMPORT-06 チェックOFFなら写真はセットされない(imgが出ずアイコン表示のまま)',
          !(await uiPage
            .locator('img[alt="E2Eモック鍋"]')
            .isVisible()
            .catch(() => false)),
        )

        // --- コロン書式・括弧グラム併記(おいしい健康 https://oishi-kenko.com/recipes/22619 相当)の
        // 経路統一。Worker側で name に分量が食い込んだ材料でも、app側 normalizeImportedIngredient が
        // 貼り付け経路と同じロジックで 名前/分量/単位 に修復することを確認する(2026-07-23) ---
        currentCheck = 'URLIMPORT-07'
        await uiPage.reload({ waitUntil: 'networkidle' })
        await uiPage.waitForTimeout(500)
        await uiPage.getByText('URLから取り込む').click()
        await uiPage.waitForTimeout(300)
        await uiPage.locator('input[type="url"]').first().fill('https://example.com/colon-marker-recipe')
        await uiPage.getByRole('button', { name: '読み込む' }).click()
        await uiPage.waitForTimeout(500)
        const colonNameInputs = uiPage.locator('input[placeholder="例: じゃがいも"]')
        const colonAmountInputs = uiPage.locator('input[placeholder="例: 3"]')
        const colonUnitInputs = uiPage.locator('input[placeholder="例: 個"]')
        check(
          'URLIMPORT-07 コロン書式「木綿豆腐: 75 g」→ name=木綿豆腐/amount=75/unit=g に修復',
          (await colonNameInputs.nth(0).inputValue()) === '木綿豆腐' &&
            (await colonAmountInputs.nth(0).inputValue()) === '75' &&
            (await colonUnitInputs.nth(0).inputValue()) === 'g',
        )
        check(
          'URLIMPORT-07 括弧グラム併記「白ごま: 小さじ1/3 (1 g)」→ name=白ごま/amount=1/3/unit=小さじ に修復',
          (await colonNameInputs.nth(1).inputValue()) === '白ごま' &&
            (await colonAmountInputs.nth(1).inputValue()) === '1/3' &&
            (await colonUnitInputs.nth(1).inputValue()) === '小さじ',
        )
        check(
          'URLIMPORT-07 括弧グラム併記「ごま油: 小さじ1/2 (2 g)」→ name=ごま油/amount=1/2/unit=小さじ に修復',
          (await colonNameInputs.nth(2).inputValue()) === 'ごま油' &&
            (await colonAmountInputs.nth(2).inputValue()) === '1/2' &&
            (await colonUnitInputs.nth(2).inputValue()) === '小さじ',
        )
      } finally {
        await uiBrowser.close()
      }
    } finally {
      urlImportPreviewProc.kill()
      // 専用ビルドの後片付け(メインdistは最初から触っていない)
      try { execSync(`rm -rf ${URLIMPORT_OUT_DIR}`, { cwd: appRoot }) } catch { /* 掃除失敗は無害 */ }
    }
  }

  // --- NAVI-01/02/03: 並行調理ナビ(Pro)の常駐タイマー連携(2026-07-23便BI)。
  //     報告バグ「ナビ実行中に動作中(=完了)タイマーをタップすると単品レシピ詳細へ飛ばされ
  //     ナビから離脱する」の回帰防止。期待挙動:
  //       NAVI-01 完了タイマーのタップ→ナビ内に留まり該当手順カードをハイライト(単品詳細へ離脱しない)
  //       NAVI-02 動作中タイマーのタップ→±調整の窓が開く(従来どおり・ナビ内)
  //       NAVI-03 タイムラインを畳んで該当カードが無いとき→従来どおり単品詳細へフォールバック
  //     解錠(proCode)・専用レシピ(短い秒タイマー)をIndexedDB直書きで用意し、専用browserで完結させる。
  //     生IDB書き込みはDexieのliveQueryを更新しないので、必ずreload()で読み直してから操作する ---
  currentCheck = 'NAVI-01'
  {
    const naviBrowser = await chromium.launch()
    const naviContext = await naviBrowser.newContext({ viewport: { width: 390, height: 820 } })
    const naviPage = await naviContext.newPage()
    naviPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI] ${err.message}`)
    })
    naviPage.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const t = msg.text()
      if (t.includes('cloudflareinsights') || t.includes('ERR_FAILED')) return
      errors.push(`[console@NAVI] ${t}`)
    })
    try {
      await naviPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await naviPage.waitForTimeout(1800) // 初回シード完了待ち(settingsレコードもこの時点で作られる)
      await naviPage.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients: [], steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        // 「2秒煮る」= TimeTextの「2秒」ボタンで2秒タイマーを起動できる(素早く完了させるため)
        const idA = await P(store('recipes').add(mk('E2Eナビ煮物A', [
          { text: '材料を切る' }, { text: '鍋に入れて2秒煮る', minutes: 1 }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('E2Eナビ炒めB', [
          { text: 'フライパンを熱する' }, { text: '3分炒める', minutes: 3 }, { text: '皿に移す' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })

      // reload()で読み直してナビへ。段取りを組む
      await naviPage.goto(`${BASE}/#/cook-navi`)
      await naviPage.reload({ waitUntil: 'networkidle' })
      await naviPage.waitForTimeout(1200)
      check(
        'NAVI-01 Pro解錠済みでナビが開き2品が自動選択される',
        (await naviPage.textContent('body')).includes('2品を選択中'),
      )
      await naviPage.getByRole('button', { name: '段取りを作る' }).click()
      await naviPage.waitForTimeout(600)
      check(
        'NAVI-01 2品のタイムラインが組める',
        (await naviPage.textContent('body')).includes('組み合わせる2品'),
      )

      // 「2秒」ボタンで短いタイマーを起動
      await naviPage.getByRole('button', { name: /2秒 タイマー開始/ }).first().click()
      await naviPage.waitForTimeout(400)

      // NAVI-02: 動作中タイマーの行タップ→±調整の窓が開く(ナビ内に留まる)
      await naviPage.locator('[aria-label*="のタイマーを調整"]').first().click()
      await naviPage.waitForTimeout(400)
      check(
        'NAVI-02 動作中タイマーのタップで±調整の窓が開く(ナビ内)',
        await naviPage.getByRole('dialog', { name: 'タイマーを調整' }).isVisible().catch(() => false),
      )
      check('NAVI-02 このとき単品レシピ詳細へ遷移していない', naviPage.url().includes('/cook-navi'))
      await naviPage.keyboard.press('Escape')
      await naviPage.waitForTimeout(300)

      // タイマー完了を待つ(完了行=border-warning)
      await naviPage.waitForSelector('div.fixed button.border-warning', { timeout: 8000 })
      await naviPage.waitForTimeout(400)

      // NAVI-01(本題): 完了タイマーのタップ→ナビに留まり、該当手順カードがハイライトされる
      const urlBeforeDoneTap = naviPage.url()
      await naviPage.locator('div.fixed button.border-warning').first().click()
      await naviPage.waitForTimeout(700)
      check(
        'NAVI-01 完了タイマーのタップでナビから離脱しない(単品詳細へ飛ばない)',
        naviPage.url().includes('/cook-navi') && !/#\/recipes\/\d+/.test(naviPage.url()),
        `before=${urlBeforeDoneTap} after=${naviPage.url()}`,
      )
      check(
        'NAVI-01 完了タイマーのタップでナビ内の該当手順カードがハイライトされる',
        (await naviPage.locator('li[class*="ring-2"]').count()) >= 1,
      )
      await naviPage.waitForTimeout(2200) // ハイライト消去を待つ

      // NAVI-03: タイムラインを畳む(該当カードがDOMから消える)と、完了タイマーのタップは
      // 従来どおり単品レシピ詳細へフォールバックする(ガードが両方向に効くことの確認)
      currentCheck = 'NAVI-03'
      await naviPage.getByRole('button', { name: 'レシピを選び直す' }).click()
      await naviPage.waitForTimeout(400)
      await naviPage.locator('div.fixed button.border-warning').first().click()
      await naviPage.waitForTimeout(700)
      check(
        'NAVI-03 タイムラインが畳まれ該当カードが無いときは単品レシピ詳細へフォールバックする',
        /#\/recipes\/\d+/.test(naviPage.url()),
        `url=${naviPage.url()}`,
      )
    } finally {
      await naviBrowser.close()
    }
  }

  // --- NAVI-04: 段取り精度の改善(2026-07-23便BI・Fable裁定)。貼り付け/URL取り込みのレシピは
  //     step.minutesが空になる実態があり、従来は本文に「15分煮る」と書いてあっても待ちとして
  //     認識されず全手順が「手を動かす」の平坦な段取り＋誤った所要目安になっていた。
  //     minutesを持たない(=貼り付け相当)レシピでも、本文の時間表記+待ち動詞から待ちを認識し、
  //     隙間に別レシピの手作業が差し込まれることをブラウザ実UIで確認する ---
  currentCheck = 'NAVI-04'
  {
    const nav4Browser = await chromium.launch()
    const nav4Context = await nav4Browser.newContext({ viewport: { width: 390, height: 820 } })
    const nav4Page = await nav4Context.newPage()
    nav4Page.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@NAVI-04] ${err.message}`)
    })
    try {
      await nav4Page.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await nav4Page.waitForTimeout(1800)
      await nav4Page.evaluate(async () => {
        const openDb = () =>
          new Promise((resolve, reject) => {
            const r = indexedDB.open('uchi-recipe')
            r.onsuccess = () => resolve(r.result)
            r.onerror = () => reject(r.error)
          })
        const db = await openDb()
        const P = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error) })
        const store = (name) => db.transaction(name, 'readwrite').objectStore(name)
        const mk = (title, steps) => ({
          title, servings: 2, effortLevel: 'normal', tags: [], ingredients: [], steps,
          isFavorite: false, cookedLogs: [], searchWords: [], isStarter: false, updatedAt: Date.now(),
        })
        // 貼り付け相当: 時間は本文にあるが step.minutes は未設定(parseRecipeTextの実挙動)
        const idA = await P(store('recipes').add(mk('E2E貼付け煮物', [
          { text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛り付ける' },
        ])))
        const idB = await P(store('recipes').add(mk('E2E貼付けサラダ', [
          { text: '野菜を切る' }, { text: 'ドレッシングと和える' },
        ])))
        let addedAt = Date.now()
        await P(store('todayList').add({ recipeId: idA, addedAt: addedAt++ }))
        await P(store('todayList').add({ recipeId: idB, addedAt: addedAt++ }))
        const cur = (await P(store('settings').get(1))) || { id: 1 }
        await P(store('settings').put({ ...cur, id: 1, proCode: 'UR-E2E-TEST-ONLY', proActivatedAt: Date.now() }))
        db.close()
      })
      await nav4Page.goto(`${BASE}/#/cook-navi`)
      await nav4Page.reload({ waitUntil: 'networkidle' })
      await nav4Page.waitForTimeout(1200)
      await nav4Page.getByRole('button', { name: '段取りを作る' }).click()
      await nav4Page.waitForTimeout(600)
      const body = await nav4Page.textContent('body')
      check(
        'NAVI-04 minutes無の「鍋で15分煮る」が待ちとして認識される(約15分の待ち時間が出る)',
        body.includes('約15分の待ち時間'),
      )
      // 待ち(煮物 手順2)の隙間にサラダの手作業が差し込まれている=並行化されている。
      // 手順カード(タイムラインの<ol>直下<li>)の並び順(DOM順)で、煮物の待ちカードの直後に
      // サラダのカードが来ることを確認する。kind判定は「待ち」を先に見る(待ちカードの補助文言
      // 「この間に、次の手作業を…」に"手作業"が含まれるため順序が重要)
      const cards = await nav4Page.$$eval('ol > li', (lis) =>
        lis.map((li) => ({ text: li.textContent || '', isWait: (li.textContent || '').includes('待ち') })),
      )
      const simmerIdx = cards.findIndex((c) => c.isWait && c.text.includes('鍋で15分煮る') && c.text.includes('E2E貼付け煮物'))
      check(
        'NAVI-04 待ちの直後に別レシピ(サラダ)の手作業が差し込まれる=並行化される',
        simmerIdx >= 0 && (cards[simmerIdx + 1]?.text.includes('E2E貼付けサラダ') ?? false),
        `cards=${JSON.stringify(cards.map((c) => ({ wait: c.isWait, t: c.text.slice(0, 24) })))}`,
      )
    } finally {
      await nav4Browser.close()
    }
  }

  // --- PANTRY-GROUP-01: 在庫チップの大分類グループ(2026-07-23 オーナー実機FB #1)。
  // 通常表示でグループ見出し(肉・魚介／野菜・きのこ／調味料 …)が出ること、整理モードで選んだ
  // 食材を別グループへ手動移動でき(group手動指定)、IndexedDBに保存されトーストが出ることを確認する ---
  currentCheck = 'PANTRY-GROUP-01'
  {
    const grBrowser = await chromium.launch()
    const grContext = await grBrowser.newContext()
    const grPage = await grContext.newPage()
    grPage.on('dialog', (dialog) => dialog.accept())
    grPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRY-GROUP-01] ${err.message}`)
    })
    const readPantry = () =>
      grPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    try {
      await grPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await grPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品も投入される)
      await grPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await grPage.waitForTimeout(500)

      // 通常表示でグループ見出しが出る(プリセットは野菜・きのこ/肉・魚介/調味料/豆腐・卵・乳/主食・粉を含む)
      const body = await grPage.textContent('body')
      check('PANTRY-GROUP-01 グループ見出し「野菜・きのこ」が表示される', body.includes('野菜・きのこ'))
      check('PANTRY-GROUP-01 グループ見出し「肉・魚介」が表示される', body.includes('肉・魚介'))
      check('PANTRY-GROUP-01 グループ見出し「調味料」が表示される', body.includes('調味料'))
      // ざっくり3段階の説明の一言(#12)も同じ画面に出る
      check('PANTRY-GROUP-01 在庫のざっくり3段階の一言(#12)が出る', body.includes('ざっくり3段階で記録'))

      // 整理モードに入り、玉ねぎを選んで「調味料」グループへ移動する
      await grPage.getByRole('button', { name: '整理', exact: true }).click()
      await grPage.waitForTimeout(300)
      await grPage.getByRole('button', { name: '玉ねぎ', exact: true }).click()
      await grPage.waitForTimeout(150)
      await grPage.getByRole('button', { name: '調味料', exact: true }).click()
      await grPage.waitForTimeout(400)
      const toast = await grPage.textContent('body')
      check(
        'PANTRY-GROUP-01 グループ移動でトーストが出る',
        toast.includes('1件を「調味料」に移動しました'),
        toast.slice(0, 160),
      )
      const items = await readPantry()
      check(
        'PANTRY-GROUP-01 玉ねぎのgroupがseasoningに保存される(手動グループ変更)',
        items.find((p) => p.name === '玉ねぎ')?.group === 'seasoning',
        `玉ねぎ=${JSON.stringify(items.find((p) => p.name === '玉ねぎ'))}`,
      )
    } finally {
      await grBrowser.close()
    }
  }

  // --- PANTRYFILTER-01: レシピ一覧の絞り込みに「在庫の食材で絞る」チップ(2026-07-24 便BN・司令部追加)。
  // 在庫(ある/少ない)が1件も無いうちはチップを出さず、在庫を1品「ある」にするとチップが出て、ONに
  // すると在庫の食材を使うレシピだけに件数が絞られる(判定は在庫との一致順と同じ部分一致)ことを確認する。
  // 他チェックに影響しないよう専用のbrowser/contextで完結させる ---
  currentCheck = 'PANTRYFILTER-01'
  {
    const pfBrowser = await chromium.launch()
    const pfContext = await pfBrowser.newContext()
    const pfPage = await pfContext.newPage()
    pfPage.on('dialog', (dialog) => dialog.accept())
    pfPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@PANTRYFILTER-01] ${err.message}`)
    })
    const cardCount = () =>
      pfPage.locator('div.grid.grid-cols-2 a[href^="#/recipes/"]').count()
    try {
      await pfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(1800) // 初回シード完了待ち(在庫プリセット12品は全て「ない」で投入)

      // 1) 在庫が全て「ない」のうちは、絞り込みパネルに「在庫の食材で絞る」チップが出ない
      await pfPage.locator('button[aria-label="絞り込み"]').click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 在庫が空のうちはチップが出ない',
        !(await pfPage.textContent('body')).includes('在庫の食材で絞る'),
      )
      // パネルを閉じる
      await pfPage.getByRole('button', { name: '決定' }).click()
      await pfPage.waitForTimeout(200)

      // 2) 在庫の「玉ねぎ」を1タップして「ある」にする(none→have)
      await pfPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(500)
      await pfPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 玉ねぎを「ある」にできた',
        (await pfPage.textContent('body')).includes('玉ねぎ（ある）'),
      )

      // 3) レシピ一覧に戻ると、絞り込みパネルにチップが出る
      await pfPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await pfPage.waitForTimeout(800)
      const totalCards = await cardCount()
      await pfPage.locator('button[aria-label="絞り込み"]').click()
      await pfPage.waitForTimeout(300)
      check(
        'PANTRYFILTER-01 在庫があるとチップが出る',
        (await pfPage.textContent('body')).includes('在庫の食材で絞る'),
      )

      // 4) ONにすると在庫の食材(玉ねぎ)を使うレシピだけに件数が絞られる
      await pfPage.getByRole('button', { name: '在庫の食材で絞る', exact: true }).click()
      await pfPage.waitForTimeout(400)
      const filteredCards = await cardCount()
      check(
        'PANTRYFILTER-01 チップONで件数が絞られる(0<絞り込み後<全件)',
        filteredCards > 0 && filteredCards < totalCards,
        `全件=${totalCards} 絞り込み後=${filteredCards}`,
      )
    } finally {
      await pfBrowser.close()
    }
  }

  // --- SHOP-COUNT-01: 買い物メモ「レシピから追加」の食数+/-方式(2026-07-23 #3)と、
  // 「候補を作る」押下時のトースト(#4)。食数0では候補を作るがdisabled、+で1食にすると押せて、
  // 押すと候補(下書き)セクションとトーストが出ることを確認する ---
  currentCheck = 'SHOP-COUNT-01'
  {
    const scBrowser = await chromium.launch()
    const scContext = await scBrowser.newContext()
    const scPage = await scContext.newPage()
    scPage.on('dialog', (dialog) => dialog.accept())
    scPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOP-COUNT-01] ${err.message}`)
    })
    try {
      await scPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(1800)
      await scPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await scPage.waitForTimeout(400)
      // 買い物メモタブへ
      await scPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await scPage.waitForTimeout(300)
      // レシピから追加(ピッカー)を開く
      await scPage.getByRole('button', { name: 'レシピから追加', exact: true }).click()
      await scPage.waitForTimeout(400)

      const makeBtn = scPage.getByRole('button', { name: '候補を作る' })
      check('SHOP-COUNT-01 食数0では「候補を作る」がdisabled', await makeBtn.isDisabled())
      // 最初のレシピの食数を1にする
      await scPage.getByRole('button', { name: '食数を増やす' }).first().click()
      await scPage.waitForTimeout(200)
      check('SHOP-COUNT-01 食数1で「候補を作る」が押せる(1食以上で選択扱い)', !(await makeBtn.isDisabled()))
      await makeBtn.click()
      await scPage.waitForTimeout(500)
      const afterMake = await scPage.textContent('body')
      check('SHOP-COUNT-01 候補を作るとトーストが出る(#4)', afterMake.includes('買い物候補を作りました'))
      check('SHOP-COUNT-01 買い物候補(下書き)セクションが出る', afterMake.includes('買い物候補'))
    } finally {
      await scBrowser.close()
    }
  }

  // --- SHOP-COMPLETE-01: 買い物完了の中央モーダル(2026-07-23 #7)＋在庫反映で未登録食材の
  // チップを作って反映(#8)＋反映トースト(#9)。在庫に無い新食材を手入力→チェック→買い物完了→
  // モーダルで「反映する」を押すと、在庫チップが新規作成され(level=have)トーストが出ることを確認する ---
  currentCheck = 'SHOP-COMPLETE-01'
  {
    const cpBrowser = await chromium.launch()
    const cpContext = await cpBrowser.newContext()
    const cpPage = await cpContext.newPage()
    cpPage.on('dialog', (dialog) => dialog.accept())
    cpPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@SHOP-COMPLETE-01] ${err.message}`)
    })
    const readPantry = () =>
      cpPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    try {
      await cpPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(1800)
      await cpPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await cpPage.waitForTimeout(400)
      await cpPage.getByRole('button', { name: '買い物メモ', exact: true }).click()
      await cpPage.waitForTimeout(300)

      // 在庫に無い新食材を手入力で1件追加
      await cpPage.getByPlaceholder('食材を入力').fill('E2E新食材ペペロン')
      await cpPage.getByRole('button', { name: '追加', exact: true }).click()
      await cpPage.waitForTimeout(300)
      // チェックを入れる
      await cpPage.getByRole('button', { name: 'チェックの切り替え', exact: true }).click()
      await cpPage.waitForTimeout(200)
      // 買い物完了 → 中央モーダル
      await cpPage.getByRole('button', { name: '買い物完了', exact: true }).click()
      await cpPage.waitForTimeout(300)
      const modalBody = await cpPage.textContent('body')
      check(
        'SHOP-COMPLETE-01 買い物完了で確認モーダルが出る(#7)',
        modalBody.includes('食材の在庫に反映しますか？'),
      )
      // 反映する
      await cpPage.getByRole('button', { name: '反映する', exact: true }).click()
      await cpPage.waitForTimeout(500)
      const afterBody = await cpPage.textContent('body')
      check('SHOP-COMPLETE-01 反映するとトーストが出る(#9)', afterBody.includes('在庫に反映しました'))
      const items = await readPantry()
      const created = items.find((p) => p.name === 'E2E新食材ペペロン')
      check(
        'SHOP-COMPLETE-01 未登録食材のチップが新規作成され「ある」で反映される(#8)',
        !!created && created.level === 'have',
        `created=${JSON.stringify(created)}`,
      )
    } finally {
      await cpBrowser.close()
    }
  }

  // --- COOKED-REFLECT-01: 「作った！」の在庫反映スイッチ(2026-07-23 #11)。既定OFF・選択を記憶。
  // 在庫「玉ねぎ」を「ある」にしておき、玉ねぎを使う肉じゃがで作った!記録時にスイッチONで保存すると、
  // 使った食材の在庫が1段階下がる(ある→少ない)こと、スイッチ状態がsettingsに記憶されることを確認する ---
  currentCheck = 'COOKED-REFLECT-01'
  {
    const crBrowser = await chromium.launch()
    const crContext = await crBrowser.newContext()
    const crPage = await crContext.newPage()
    crPage.on('dialog', (dialog) => dialog.accept())
    crPage.on('pageerror', (err) => {
      if (err.message.includes('cloudflareinsights') || err.message.includes('Access-Control-Allow-Origin')) return
      errors.push(`[pageerror@COOKED-REFLECT-01] ${err.message}`)
    })
    const readPantry = () =>
      crPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const items = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('pantryItems', 'readonly').objectStore('pantryItems').getAll()
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return items
      })
    const readReflectSetting = () =>
      crPage.evaluate(async () => {
        const req = indexedDB.open('uchi-recipe')
        const idb = await new Promise((resolve, reject) => {
          req.onsuccess = () => resolve(req.result)
          req.onerror = () => reject(req.error)
        })
        const s = await new Promise((resolve, reject) => {
          const r2 = idb.transaction('settings', 'readonly').objectStore('settings').get(1)
          r2.onsuccess = () => resolve(r2.result)
          r2.onerror = () => reject(r2.error)
        })
        idb.close()
        return s
      })
    try {
      await crPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(1800)
      // 在庫「玉ねぎ」を1回タップして「ない」→「ある」にする
      await crPage.goto(`${BASE}/#/shopping`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(400)
      await crPage.getByRole('button', { name: '玉ねぎ' }).first().click()
      await crPage.waitForTimeout(250)
      const beforeItems = await readPantry()
      check(
        'COOKED-REFLECT-01 前提: 玉ねぎを「ある」にできた',
        beforeItems.find((p) => p.name === '玉ねぎ')?.level === 'have',
        `玉ねぎ=${JSON.stringify(beforeItems.find((p) => p.name === '玉ねぎ'))}`,
      )
      // 肉じゃがの詳細を開く
      await crPage.goto(`${BASE}/#/recipes`, { waitUntil: 'networkidle' })
      await crPage.waitForTimeout(500)
      await crPage.getByText('肉じゃが', { exact: true }).first().click()
      await crPage.waitForTimeout(500)
      // 作った!モーダルを開き、在庫反映スイッチをONにする
      await crPage.getByRole('button', { name: '作った！' }).first().click()
      await crPage.waitForTimeout(300)
      await crPage.getByRole('switch', { name: '使った食材の在庫を減らす' }).click()
      await crPage.waitForTimeout(300)
      const setting = await readReflectSetting()
      check(
        'COOKED-REFLECT-01 スイッチONがsettingsに記憶される(cookedReflectPantry=true)',
        setting?.cookedReflectPantry === true,
        `settings=${JSON.stringify({ cookedReflectPantry: setting?.cookedReflectPantry })}`,
      )
      // 記録する → 使った玉ねぎの在庫が1段階下がる(ある→少ない)
      await crPage.getByRole('button', { name: '記録する', exact: true }).click()
      await crPage.waitForTimeout(700)
      const afterItems = await readPantry()
      check(
        'COOKED-REFLECT-01 記録すると玉ねぎの在庫が1段階下がる(ある→少ない)',
        afterItems.find((p) => p.name === '玉ねぎ')?.level === 'low',
        `玉ねぎ=${JSON.stringify(afterItems.find((p) => p.name === '玉ねぎ'))}`,
      )
    } finally {
      await crBrowser.close()
    }
  }
} catch (err) {
  ng(`実行中断(${currentCheck})`, err.message)
} finally {
  await browser.close()
}

// --- 結果 ---
const failed = results.filter((r) => !r.pass)
console.log(`\n対象: ${BASE}`)
for (const r of results) console.log(`${r.pass ? 'OK ' : 'NG '} ${r.label}${r.detail ? ` — ${r.detail}` : ''}`)
console.log(`\n合格: ${results.length - failed.length}/${results.length}件 / console・pageerror: ${errors.length}件`)
for (const e of errors) console.log(`  ${e}`)
process.exit(failed.length > 0 || errors.length > 0 ? 1 : 0)
