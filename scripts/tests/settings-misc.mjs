// 設定・お知らせ・共有・アプリ更新など（上のどれにも入らないもの）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import { formatAmountUnit } from '../../src/logic/amount.ts'
import { normalizeQuarterTurns, rotatedSize } from '../../src/logic/image.ts'
import { parseRecipeText } from '../../src/logic/parseRecipeText.ts'
import {
  normalizeProCode,
  isValidProCode,
  detectCodeKind,
  maskUnlockCode,
} from '../../src/logic/pro.ts'
import {
  isAtFreeLimit,
  freeLimitNoticeFor,
  freeLimitRemaining,
  countFreeLimitRecipes,
  FREE_LIMIT,
  FREE_LIMIT_NOTICE_COUNTS,
} from '../../src/logic/freeLimit.ts'
import { isNewsSuppressed, isNewsVisibleFor } from '../../src/logic/news.ts'
import { formatFileSize } from '../../src/logic/fileSize.ts'
import {
  totalCookedLogPhotoBytes,
  isOverCookedPhotoLimit,
  bytesToMB,
  COOKED_PHOTO_WARNING_BYTES,
} from '../../src/logic/cookedPhotoStorage.ts'
import { buildShareText } from '../../src/logic/share.ts'
import { ingredientColorToken } from '../../src/logic/ingredientColor.ts'
import { ja } from '../../src/i18n/ja.ts'
import { settingsLinkWithBack, resolveBackTarget } from '../../src/logic/backLink.ts'
import { isStandaloneDisplay } from '../../src/logic/standalone.ts'
import { shouldShowHomeScreenNotice } from '../../src/logic/homeScreenNotice.ts'
import {
  shouldShowFirstSetupNotice,
  hasChosenFirstSetup,
  FIRST_SETUP_NOTICE_SEEN_KEY,
} from '../../src/logic/firstSetupNotice.ts'
import { isImeConfirmKey } from '../../src/logic/imeKey.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// ---------- pro.ts(コード正規化) ----------
eq('Pro: 全角・小文字・空白ゆらぎ', normalizeProCode(' ｕｒ-ab12-cd34 '), 'UR-AB12-CD34')

// ---------- detectCodeKind(2026-07-17設定ゼロベース裁定#7の種別判定→2026-07-22全無料化でPro(UR-)のみ) ----------
// 2026-07-22: 収録レシピは全て無料になり、追加レシピパック(UP-)は製品廃止。有効なコードはPro(UR-)のみ。
eq('種別判定: UR-はpro', detectCodeKind('UR-AB12-CD34'), 'pro')
eq('種別判定: 廃止したUP-はunknown(2026-07-22全無料化でパック廃止)', detectCodeKind('UP-AB12-CD34'), 'unknown')
eq('種別判定: 全角・小文字ゆらぎでも判定できる(normalizeProCode経由)', detectCodeKind(' ｕｒ-ab12-cd34 '), 'pro')
eq('種別判定: どちらでもないprefixはunknown', detectCodeKind('XX-AB12-CD34'), 'unknown')
eq('種別判定: 空文字はunknown', detectCodeKind(''), 'unknown')
eq('種別判定: prefixのみ(ハイフン無し)はunknown', detectCodeKind('URXXXX'), 'unknown')

// ---------- maskUnlockCode(2026-07-17設定ゼロベース裁定#4: 解錠コードのマスク表示+コピー) ----------
// prefix非依存の純粋な文字列マスク(Proコードのマスク表示に使う)
eq('マスク: 標準形式は末尾4文字だけ見せる', maskUnlockCode('UR-AB12-CD34'), 'UR-****CD34')
eq('マスク: 4-4形式は末尾4文字だけ見せる', maskUnlockCode('UR-1234-5678'), 'UR-****5678')
eq('マスク: 残り4文字以下は全部隠す', maskUnlockCode('UR-AB'), 'UR-**')
eq('マスク: ハイフンが無いコードはそのまま返す', maskUnlockCode('URABCDEFGH'), 'URABCDEFGH')

// ---------- isNewsSuppressed(初回起動24時間はお知らせを出さない・2026-07-09ペルソナ第1波) ----------
const HOUR = 60 * 60 * 1000
eq('news: 初回起動直後は抑制', isNewsSuppressed(1000, 1000 + HOUR), true)
eq('news: 23時間後も抑制', isNewsSuppressed(1000, 1000 + 23 * HOUR), true)
eq('news: 24時間経過で表示', isNewsSuppressed(1000, 1000 + 25 * HOUR), false)
eq('news: 既存ユーザー(0)は抑制しない', isNewsSuppressed(0, Date.now()), false)
eq('news: 未記録(起動直後の一瞬)は抑制', isNewsSuppressed(undefined, Date.now()), true)

// ---------- freeLimit(2026-08-02 発売便DD: FREE_LIMIT_ENABLED=true) ----------
// 発売と同一リリースでフラグをONにした(docs/08 §2)。ONで変わるのは「新規追加のブロック」と
// 「予告バナー」だけで、既存レシピの閲覧・編集・削除・バックアップ復元は絶対に制限しない
// (それらはisAtFreeLimitを一切呼ばない=RecipeFormPageの新規保存パスだけが呼ぶ)
// 2026-08-08 便DZ(オーナー決定): 宣伝開始前に上限を50→30へ変更。アンケート・LP・説明書・
// お知らせと同じ数字であることが前提なので、上限の値そのものをテストで固定する
eq('上限は30件', FREE_LIMIT, 30)
eq('フラグON: 30件に達したら新規追加はブロックする', isAtFreeLimit(30, false), true)
eq('フラグON: 29件まではブロックしない', isAtFreeLimit(29, false), false)
eq('Pro解錠済みは30件でもブロックしない', isAtFreeLimit(30, true), false)
eq('Pro解錠済みは1000件でもブロックしない', isAtFreeLimit(1000, true), false)
eq('「あと◯件」: 20件時点はあと10件', freeLimitRemaining(20), 10)
eq('「あと◯件」: 27件時点はあと3件', freeLimitRemaining(27), 3)
eq('「あと◯件」: 30件以上でも負にならない', freeLimitRemaining(31), 0)

// 節目の案内(2026-08-08 オーナー指示「２０件目、２７件目、３０件目の登録完了時といった感じで」)。
// 旧仕様の「40件以上なら常時表示」をやめ、登録し終えた件数がちょうど節目のときだけ出す。
// 登録のたびに同じ案内が出ないこと(21件・26件で出ない)が、この変更のいちばんの目的
eq('節目は20件目と27件目', FREE_LIMIT_NOTICE_COUNTS.join(','), '20,27')
eq('19件目では案内を出さない', freeLimitNoticeFor(19, false), undefined)
eq('20件目で予告を出す', freeLimitNoticeFor(20, false), 'near')
eq('21件目では出さない(節目の次の登録では繰り返さない)', freeLimitNoticeFor(21, false), undefined)
eq('26件目では出さない', freeLimitNoticeFor(26, false), undefined)
eq('27件目で予告を出す', freeLimitNoticeFor(27, false), 'near')
eq('28件目では出さない', freeLimitNoticeFor(28, false), undefined)
eq('29件目では出さない', freeLimitNoticeFor(29, false), undefined)
eq('30件目は予告でなく上限到達の案内', freeLimitNoticeFor(30, false), 'reached')
eq('上限を超えた件数(復元等)では案内を出さない', freeLimitNoticeFor(31, false), undefined)
eq('Pro解錠済みには節目でも出さない(20件目)', freeLimitNoticeFor(20, true), undefined)
eq('Pro解錠済みには上限到達の案内も出さない', freeLimitNoticeFor(30, true), undefined)
eq('予約が無い(未設定)なら何も出さない', freeLimitNoticeFor(undefined, false), undefined)
eq('閉じたあとの0では何も出さない', freeLimitNoticeFor(0, false), undefined)
eq('壊れた値(NaN)でも何も出さない', freeLimitNoticeFor(NaN, false), undefined)
// 上限のカウント対象はisStarter=falseだけ(同梱の基本レシピは何品あっても上限に効かない)。
// 発売でフラグをONにしたため、この不変条件が破れると初回起動直後の人がいきなりブロックされる
eq(
  '基本レシピ(isStarter)は上限に数えない',
  countFreeLimitRecipes([
    ...Array.from({ length: 109 }, () => ({ isStarter: true })),
    { isStarter: false },
    {},
  ]),
  2,
)
eq(
  'フラグON: 基本レシピ109品だけならブロックしない',
  isAtFreeLimit(countFreeLimitRecipes(Array.from({ length: 109 }, () => ({ isStarter: true }))), false),
  false,
)

// ---------- ingredientColorToken: 食材カテゴリ別チップ色(2026-07-11オーナー実機フィードバック) ----------
eq('鶏もも肉は肉カテゴリ', ingredientColorToken('鶏もも肉'), '--chip-food-meat')
eq('豚バラ薄切り肉は肉カテゴリ(読み辞書変換後も一致)', ingredientColorToken('豚バラ薄切り肉'), '--chip-food-meat')
eq('牛こま切れ肉は肉カテゴリ(読み辞書変換後も一致)', ingredientColorToken('牛こま切れ肉'), '--chip-food-meat')
// 牛乳はtoHiragana()で「ぎゅうにゅう」に変換されるため、肉カテゴリの「ぎゅう」に
// 誤ヒットしないことを確認する回帰ケース(実装時に発覚した衝突)
eq('牛乳は肉カテゴリに誤分類されない', ingredientColorToken('牛乳'), '--chip-neutral')
eq('生鮭(切り身)は魚介カテゴリ(読み辞書変換後も一致)', ingredientColorToken('生鮭(切り身)'), '--chip-food-seafood')
eq('むきえびは魚介カテゴリ', ingredientColorToken('むきえび'), '--chip-food-seafood')
eq('玉ねぎは根菜カテゴリ(茶)', ingredientColorToken('玉ねぎ'), '--chip-food-root')
eq('しめじは根菜カテゴリ(きのこ)', ingredientColorToken('しめじ'), '--chip-food-root')
eq('長ねぎは野菜カテゴリ(玉ねぎと違い根菜にはしない)', ingredientColorToken('長ねぎ'), '--chip-food-vegetable')
eq('キャベツは野菜カテゴリ', ingredientColorToken('キャベツ'), '--chip-food-vegetable')
eq('豆腐はカテゴリ外でニュートラル', ingredientColorToken('豆腐'), '--chip-neutral')
// 2026-07-12深夜フィードバック: にんじん・トマト系=オレンジ/卵=黄/なす=紫の3色を追加
eq('にんじんは根菜カテゴリ(茶)ではなくオレンジに移動', ingredientColorToken('にんじん'), '--chip-food-orange')
eq('人参(漢字・読み辞書変換後)もオレンジ', ingredientColorToken('人参'), '--chip-food-orange')
eq('トマトはオレンジ', ingredientColorToken('トマト'), '--chip-food-orange')
eq('ミニトマトもオレンジ(部分一致)', ingredientColorToken('ミニトマト'), '--chip-food-orange')
eq('赤パプリカはオレンジ(色を明記した場合のみ)', ingredientColorToken('赤パプリカ'), '--chip-food-orange')
eq('パプリカ(色未指定)は迷ったら野菜カテゴリのまま(赤系のみオレンジという裁定)', ingredientColorToken('パプリカ'), '--chip-food-vegetable')
eq('黄パプリカも野菜カテゴリのまま', ingredientColorToken('黄パプリカ'), '--chip-food-vegetable')
eq('卵は黄カテゴリ(ニュートラルではなくなった)', ingredientColorToken('卵'), '--chip-food-yellow')
eq('卵黄(読み辞書変換後も一致)も黄カテゴリ', ingredientColorToken('卵黄'), '--chip-food-yellow')
eq('たまご(かな表記)も黄カテゴリ', ingredientColorToken('たまご'), '--chip-food-yellow')
eq('なすは紫カテゴリ', ingredientColorToken('なす'), '--chip-food-purple')
eq('茄子(漢字・読み辞書変換後)も紫カテゴリ', ingredientColorToken('茄子'), '--chip-food-purple')
eq('紫キャベツは紫カテゴリ(キャベツの野菜カテゴリより優先)', ingredientColorToken('紫キャベツ'), '--chip-food-purple')

// ---------- 記録写真の容量ガード(docs/20 §4写真添付・自動削除はせず促すバナーのみ) ----------
{
  const blob = (bytes) => new Blob([new Uint8Array(bytes)])
  const recipesWithPhotos = [
    { cookedLogs: [{ date: '2026-01-01', photo: blob(10) }, { date: '2026-01-02' }] },
    { cookedLogs: [{ date: '2026-01-03', photo: blob(20) }] },
  ]
  eq('全レシピの記録写真バイト数を合算する', totalCookedLogPhotoBytes(recipesWithPhotos), 30)
  eq('記録写真が無ければ0', totalCookedLogPhotoBytes([{ cookedLogs: [{ date: '2026-01-01' }] }]), 0)
  eq('空配列は0', totalCookedLogPhotoBytes([]), 0)
  eq('閾値ちょうどは超過扱いにしない', isOverCookedPhotoLimit(COOKED_PHOTO_WARNING_BYTES), false)
  eq('閾値を1バイトでも超えたら超過', isOverCookedPhotoLimit(COOKED_PHOTO_WARNING_BYTES + 1), true)
  eq('閾値未満は超過ではない', isOverCookedPhotoLimit(1024), false)
  eq('MB換算は小数第1位に丸める', bytesToMB(52_450_000), 50)
  eq('MB換算の丸め(52.6MB相当)', bytesToMB(55_000_000), 52.5)
}

// ---------- SHA-256純JSフォールバック(2026-07-13 insecure context対応) ----------
// crypto.subtleはsecure context(https://またはlocalhost)でしか使えず、開発中LAN実機テスト
// (http://192.168.x.x:5173等)ではundefinedになりPro/パックのコード検証が動かなくなっていた。
// src/logic/sha256.ts の純JS実装がNIST既知ベクトル・Node crypto.subtleの出力と完全一致すること、
// および実際のコード検証(isValidProCode/isValidPackCode)がcrypto.subtle経由・フォールバック強制
// (第2引数forceFallback)の両経路で同じ結果になることを確認する。
{
  const { sha256Hex } = await import('../../src/logic/sha256.ts')
  const { webcrypto } = await import('node:crypto')

  const subtleHex = async (bytesOrText) => {
    const bytes = typeof bytesOrText === 'string' ? new TextEncoder().encode(bytesOrText) : bytesOrText
    const digest = await webcrypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // NIST既知ベクトル(値はNode crypto.createHashで再検証済み)
  eq('SHA-256 空文字列', sha256Hex(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  eq('SHA-256 "abc"', sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  eq(
    'SHA-256 2ブロック境界の既知ベクトル(56byte)',
    sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  )
  eq(
    'SHA-256 "a"を100万回繰り返す長文ベクトル(複数ブロック)',
    sha256Hex('a'.repeat(1_000_000)),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  )

  // Node crypto.subtleとの一致比較(パディング境界の長さを中心に数十ケース+ランダム長)
  const randomStr = (len) => {
    const chars =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789あいうえおアイウエオ漢字🍙'
    let s = ''
    for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)]
    return s
  }
  const boundaryLengths = [
    0, 1, 2, 15, 31, 32, 54, 55, 56, 57, 63, 64, 65, 100, 119, 120, 127, 128, 200, 300, 500,
  ]
  for (const len of boundaryLengths) {
    const s = randomStr(len)
    eq(`SHA-256 crypto.subtle一致(境界長さ${len})`, sha256Hex(s), await subtleHex(s))
  }
  for (let i = 0; i < 20; i++) {
    const s = randomStr(Math.floor(Math.random() * 400))
    eq(`SHA-256 crypto.subtle一致(ランダム${i})`, sha256Hex(s), await subtleHex(s))
  }
  // Uint8Array直接入力(文字列を経由しない生バイト列)でも一致すること
  for (const len of [0, 1, 55, 56, 64, 200]) {
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256)
    eq(`SHA-256 Uint8Array直接入力一致(長さ${len})`, sha256Hex(bytes), await subtleHex(bytes))
  }

  // isValidProCode: crypto.subtle経由(既定)とフォールバック強制の両方で同じ判定になること。
  // テスト用コードはdocs/22の実機確認チェックリストに記載のもの(販売用ではなく、既に
  // PRO_CODE_HASHESにハッシュが含まれている)。2026-07-22の全無料化で追加レシピパック(UP-)は
  // 製品廃止したため、isValidPackCodeのケースは削除した(コード検証はPro=UR-のみになった)。
  const validProCode = 'UR-96QS-2VSZ'

  eq('isValidProCode 正規コード(crypto.subtle)', await isValidProCode(validProCode), true)
  eq('isValidProCode 正規コード(フォールバック強制)', await isValidProCode(validProCode, true), true)
  eq(
    'isValidProCode 小文字+前後空白ゆらぎ(crypto.subtle)',
    await isValidProCode(' ur-96qs-2vsz '),
    true,
  )
  eq(
    'isValidProCode 小文字+前後空白ゆらぎ(フォールバック強制)',
    await isValidProCode(' ur-96qs-2vsz ', true),
    true,
  )
  eq('isValidProCode 不正コード(crypto.subtle)', await isValidProCode('UR-0000-0000'), false)
  eq('isValidProCode 不正コード(フォールバック強制)', await isValidProCode('UR-0000-0000', true), false)
  eq('isValidProCode 空文字列(crypto.subtle)', await isValidProCode(''), false)
  eq('isValidProCode 空文字列(フォールバック強制)', await isValidProCode('', true), false)
}

// ---------- appRefresh: 「アプリを更新する」ボタンの処理本体(2026-07-16新設) ----------
// SWとキャッシュストレージだけ消してreloadする安全な機能。ブラウザの「Cookieと他のサイトデータ」
// 削除でレシピ・購入コードを失った事故の再発防止として追加したため、IndexedDBには絶対に
// 触れないことをここで固定する。
{
  const { refreshApp } = await import('../../src/logic/appRefresh.ts')

  // ソースコードにIndexedDB/Dexie関連の文字列が一切現れないこと(触れないことの静的な担保)
  const appRefreshSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(scriptFileUrl)), '../src/logic/appRefresh.ts'),
    'utf-8',
  )
  eq(
    'appRefreshはindexedDB/Dexie/db配下を一切importせず、indexedDBのプロパティアクセスもしない',
    /from ['"]dexie['"]|from ['"]\.\.\/db|indexeddb\.\w/i.test(appRefreshSrc),
    false,
  )

  // ケース1: Service Worker/Cache Storage/window未対応環境(素のNode)でも例外を投げず完了する
  {
    let threw = false
    try {
      await refreshApp()
    } catch {
      threw = true
    }
    eq('未対応環境でも例外を投げない', threw, false)
  }

  // ケース2: SW登録2件・キャッシュ2件がある環境で、両方とも解除・削除されreloadが呼ばれること。
  // IndexedDBには絶対に触れないことも、呼んだら即例外を投げるダミーを仕込んで検証する
  {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    const unregisterCalls = []
    const registrations = [
      {
        unregister: async () => {
          unregisterCalls.push('reg1')
          return true
        },
      },
      {
        unregister: async () => {
          unregisterCalls.push('reg2')
          return true
        },
      },
    ]
    Object.defineProperty(globalThis, 'navigator', {
      value: { serviceWorker: { getRegistrations: async () => registrations } },
      configurable: true,
    })

    const deleteCalls = []
    globalThis.caches = {
      keys: async () => ['cache-a', 'cache-b'],
      delete: async (key) => {
        deleteCalls.push(key)
        return true
      },
    }

    let reloadCalls = 0
    globalThis.window = { location: { reload: () => { reloadCalls++ } } }

    globalThis.indexedDB = {
      open: () => {
        throw new Error('indexedDBに触れてはいけない(open)')
      },
      deleteDatabase: () => {
        throw new Error('indexedDBに触れてはいけない(deleteDatabase)')
      },
    }

    let threw = false
    let result
    try {
      result = await refreshApp()
    } catch {
      threw = true
    }

    eq('SW/キャッシュ削除・reloadで例外を投げない', threw, false)
    eq('SW登録が全て解除される', unregisterCalls.sort(), ['reg1', 'reg2'])
    eq('キャッシュが全て削除される', deleteCalls.sort(), ['cache-a', 'cache-b'])
    eq('reloadが呼ばれる', reloadCalls, 1)
    eq('オンライン時は\'done\'を返す', result, 'done')

    delete globalThis.caches
    delete globalThis.window
    delete globalThis.indexedDB
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  }

  // ケース3(M-2 2026-07-16 Fable品質監査再発防止): オフライン時はSW一覧取得・キャッシュ削除・
  // reloadのいずれも実行せず'offline'を返すこと。古いSW/Cacheを消してreloadすると、
  // オフラインでは新しいファイルを取得できず白画面になってしまうため、呼び出し前の早期returnを
  // 「削除APIが1回も呼ばれないこと」まで含めて確認する
  {
    const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    let getRegistrationsCalls = 0
    Object.defineProperty(globalThis, 'navigator', {
      value: {
        onLine: false,
        serviceWorker: {
          getRegistrations: async () => {
            getRegistrationsCalls++
            return []
          },
        },
      },
      configurable: true,
    })

    let cachesKeysCalls = 0
    globalThis.caches = {
      keys: async () => {
        cachesKeysCalls++
        return []
      },
      delete: async () => true,
    }

    let reloadCalls = 0
    globalThis.window = { location: { reload: () => { reloadCalls++ } } }

    const result = await refreshApp()

    eq("オフライン時は'offline'を返す", result, 'offline')
    eq('オフライン時はSW一覧取得すら呼ばれない', getRegistrationsCalls, 0)
    eq('オフライン時はキャッシュ一覧取得すら呼ばれない', cachesKeysCalls, 0)
    eq('オフライン時はreloadが呼ばれない', reloadCalls, 0)

    delete globalThis.caches
    delete globalThis.window
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  }
}

// ---------- buildShareText(シェアの選択式・2026-07-16 Fable裁定docs/30裁定3) ----------
// 2026-07-23 便BJ・docs/55 CEO提案2-1: テキスト共有を「貼り付けで丸ごと取り込める形式」に変更。
// 料理名と人数分を別行にし、作り方(全手順)を【作り方】見出しつきで常に含める。末尾のアプリ名(#)と
// 入口URLは宣伝枠として残しつつ、取り込み時に自動除去される(下の「share往復」テストで実証)。
{
  const shareRecipe = {
    id: 1,
    title: '肉じゃが',
    servings: 2,
    cookMinutes: 30,
    effortLevel: 'normal',
    tags: [],
    ingredients: [
      { name: '牛こま切れ肉', amount: '200', unit: 'g' },
      { name: 'じゃがいも', amount: '3', unit: '個' },
      { name: '玉ねぎ', amount: '1', unit: '個' },
      { name: 'にんじん', amount: '1', unit: '本' },
      { name: 'しらたき', amount: '1', unit: '袋' },
      { name: 'サラダ油', amount: '1', unit: '大さじ' },
      { name: '砂糖', amount: '2', unit: '大さじ' },
      { name: 'しょうゆ', amount: '3', unit: '大さじ' },
      { name: '水', amount: '300', unit: 'ml' },
    ],
    steps: [{ text: '切る' }, { text: '炒める' }, { text: '煮る' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  }

  const expectedDefault = [
    '肉じゃが',
    '2人分',
    '【材料】',
    '・牛こま切れ肉 200g',
    '・じゃがいも 3個',
    '・玉ねぎ 1個',
    '・にんじん 1本',
    '・しらたき 1袋',
    '・サラダ油 大さじ1',
    '・砂糖 大さじ2',
    '・しょうゆ 大さじ3',
    '…ほか',
    '【作り方】',
    '1. 切る',
    '2. 炒める',
    '3. 煮る',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: opts省略は料理名/人数分/材料8件+…ほか/作り方の取り込み可能形式', buildShareText(shareRecipe), expectedDefault)

  // 全項目OFF(既定はテキストに任意行なし)のoptsを渡してもopts省略と同じ出力になる。
  // 「レシピ画像」は画像カード専用オプションで、テキスト出力には一切影響しない(仕様の※併記)
  const offOpts = { image: false, cookMinutes: false, cost: false, nutrition: false, allIngredients: false }
  eq('share: 全OFFのoptsはopts省略と同一', buildShareText(shareRecipe, offOpts), expectedDefault)
  eq('share: 画像ONはテキストに影響しない(画像カード専用)', buildShareText(shareRecipe, { ...offOpts, image: true }), expectedDefault)

  // 組合せ1: 調理時間ON → 人数分の直後に「調理時間 約◯分」が入る
  const expectedWithCook = expectedDefault.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n調理時間 約30分\n【材料】',
  )
  eq('share: 調理時間ONで行が入る', buildShareText(shareRecipe, { ...offOpts, cookMinutes: true }), expectedWithCook)
  // 調理時間のデータが無いレシピではONを渡しても行が出ない(グレーアウトの防波堤)
  eq(
    'share: 調理時間なしレシピはONでも行なし',
    buildShareText({ ...shareRecipe, cookMinutes: undefined }, { ...offOpts, cookMinutes: true }),
    expectedDefault,
  )

  // 組合せ2: 原価ON → 登録人数基準の1人分/全量(実数値はRecipeDetailPage側が渡す)
  const expectedWithCost = expectedDefault.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n原価 1人分 約210円／全量（2人分） 約420円\n【材料】',
  )
  eq(
    'share: 原価ONで1人分/全量の行が入る',
    buildShareText(shareRecipe, { ...offOpts, cost: true, costPerServingYen: 210, costTotalYen: 420 }),
    expectedWithCost,
  )
  // 実数値が渡されなければ(合計0円等)ONでも行が出ない
  eq('share: 原価の実数値なしはONでも行なし', buildShareText(shareRecipe, { ...offOpts, cost: true }), expectedDefault)

  // 組合せ3: 栄養ON → カロリー・塩分の2項目のみ+「目安」表記必須
  const expectedWithNutrition = expectedDefault.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n1食あたり 約498kcal・塩分 約4.1g（概算）\n【材料】',
  )
  eq(
    'share: 栄養ONでカロリー・塩分(目安)の行が入る',
    buildShareText(shareRecipe, { ...offOpts, nutrition: true, kcalPerServing: 498, saltPerServing: 4.1 }),
    expectedWithNutrition,
  )
  eq('share: 栄養の実数値なしはONでも行なし', buildShareText(shareRecipe, { ...offOpts, nutrition: true }), expectedDefault)

  // 組合せ4: 材料をすべて載せる → 9件全部が並び「…ほか」は消える
  const expectedAll = [
    '肉じゃが',
    '2人分',
    '【材料】',
    '・牛こま切れ肉 200g',
    '・じゃがいも 3個',
    '・玉ねぎ 1個',
    '・にんじん 1本',
    '・しらたき 1袋',
    '・サラダ油 大さじ1',
    '・砂糖 大さじ2',
    '・しょうゆ 大さじ3',
    '・水 300ml',
    '【作り方】',
    '1. 切る',
    '2. 炒める',
    '3. 煮る',
    '',
    '#うちレシピ',
    'https://uchirecipe.com/',
  ].join('\n')
  eq('share: 材料をすべて載せる', buildShareText(shareRecipe, { ...offOpts, allIngredients: true }), expectedAll)

  // 全部ON: 任意行の順序は 調理時間→原価→栄養(仕様のモーダル並び順と同じ)
  const expectedFull = expectedAll.replace(
    '肉じゃが\n2人分\n【材料】',
    '肉じゃが\n2人分\n調理時間 約30分\n原価 1人分 約210円／全量（2人分） 約420円\n1食あたり 約498kcal・塩分 約4.1g（概算）\n【材料】',
  )
  eq(
    'share: 全部ONの行順は調理時間→原価→栄養',
    buildShareText(shareRecipe, {
      image: true,
      cookMinutes: true,
      cost: true,
      nutrition: true,
      allIngredients: true,
      costPerServingYen: 210,
      costTotalYen: 420,
      kcalPerServing: 498,
      saltPerServing: 4.1,
    }),
    expectedFull,
  )

  // share往復(2026-07-23 便BJ・docs/55 CEO提案2-1): コピーした全文をそのまま貼り付けパーサーに
  // 通すと、料理名・人数分・材料・作り方が過不足なく復元される(=見る専用でなく取り込める形式)。
  // 末尾のアプリ名(#)・入口URLは宣伝枠として残るが、取り込み時に手順へ化けず自動除去される。
  {
    const shared = buildShareText(shareRecipe, { ...offOpts, allIngredients: true })
    const parsed = parseRecipeText(shared)
    eq('share往復: 料理名が(人数分の括弧に汚れず)復元', parsed.title, '肉じゃが')
    eq('share往復: 人数分が復元', parsed.servings, 2)
    eq(
      'share往復: 材料名が全件復元',
      parsed.ingredients.map((i) => i.name),
      shareRecipe.ingredients.map((i) => i.name),
    )
    eq(
      'share往復: 材料の分量+単位が復元(大さじの並び順も一致)',
      parsed.ingredients.map((i) => formatAmountUnit(i.amount, i.unit)),
      shareRecipe.ingredients.map((i) => formatAmountUnit(i.amount, i.unit)),
    )
    eq(
      'share往復: 作り方が全手順復元',
      parsed.steps,
      shareRecipe.steps.map((s) => s.text),
    )
    eq('share往復: 末尾のアプリ名(#)・URLは手順に混ざらない', parsed.steps.length, shareRecipe.steps.length)
  }

  // 手順が1つも無いレシピでは【作り方】見出しごと省く(空見出しを残さない)。往復も材料まで成立する
  {
    const noSteps = { ...shareRecipe, steps: [] }
    const text = buildShareText(noSteps, { ...offOpts, allIngredients: true })
    eq('share: 手順なしレシピは【作り方】見出しが出ない', text.includes('【作り方】'), false)
    const parsed = parseRecipeText(text)
    eq('share往復(手順なし): 料理名が復元', parsed.title, '肉じゃが')
    eq(
      'share往復(手順なし): 材料は全件復元',
      parsed.ingredients.map((i) => i.name),
      noSteps.ingredients.map((i) => i.name),
    )
    eq('share往復(手順なし): 作り方は空', parsed.steps, [])
  }
}

// ============================================================================
// URLから取り込む(workers/recipe-import/src/normalize.ts)。docs/39検証で確認した実世界の
// ばらつき(schema.org/Recipe JSON-LDの@graph/配列/HowToStep/HowToSection/文字列instructions/
// ISO8601 duration/recipeYield表記ゆれ)を、実サイトHTMLの丸写しではなく構造を模した合成
// JSON-LDフィクスチャで網羅する。Workerからもこのファイルからも同じロジックを使う(共有資産)。
// ============================================================================

// ---------- buildShareText: 共有は表示している人数の分量で出す(2026-07-29 便CI/C18) ----------
{
  const c18Recipe = {
    id: 1,
    title: 'さわらの西京焼き',
    servings: 2,
    effortLevel: 'normal',
    tags: [],
    ingredients: [
      { name: 'さわら(切り身)', amount: '2', unit: '切れ' },
      { name: 'みそ', amount: '2', unit: '大さじ' },
    ],
    steps: [{ text: '漬ける' }],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
  }
  const opts = { image: true, cookMinutes: false, cost: false, nutrition: false, allIngredients: true }
  const asRegistered = buildShareText(c18Recipe, opts)
  eq('C18 人数を渡さなければ従来どおり登録人数で出る', asRegistered.includes('\n2人分\n'), true)
  eq('C18 登録人数のままなら分量の表記も変わらない', asRegistered.includes('・さわら(切り身) 2切れ'), true)
  const asShown = buildShareText(c18Recipe, { ...opts, servings: 4 })
  eq('C18 表示人数4人分で共有すると「4人分」になる', asShown.includes('\n4人分\n'), true)
  eq('C18 材料の分量も4人分にスケールする', asShown.includes('・さわら(切り身) 4切れ'), true)
  eq('C18 調味料も一緒にスケールする', asShown.includes('・みそ 大さじ4'), true)
}

// ---------- 設定画面からの帰り道(2026-08-02 オーナー指示・便DF) ----------
// 各ページのPro版の説明などから設定の該当欄へ飛んだあと、元のページへ戻れるようにする受け渡し。
// 外部URLへ飛ばす踏み台にならないこと・画面名が入った文言になることを固定する
{
  eq(
    'DF-BACK レシピ一覧からのPro案内リンクに戻り先が載る',
    settingsLinkWithBack('/settings?section=pro', '/recipes'),
    '/settings?section=pro&back=%2Frecipes',
  )
  eq(
    'DF-BACK クエリの無い設定リンクでは?で付ける',
    settingsLinkWithBack('/settings', '/shopping'),
    '/settings?back=%2Fshopping',
  )
  eq(
    'DF-BACK 検索条件つきの現在地もそのまま持ち回れる',
    settingsLinkWithBack('/settings?section=pro', '/recipes?q=鶏'),
    '/settings?section=pro&back=%2Frecipes%3Fq%3D%E9%B6%8F',
  )
  eq(
    'DF-BACK アプリ外のURLは戻り先に載せない',
    settingsLinkWithBack('/settings?section=pro', 'https://example.com'),
    '/settings?section=pro',
  )
  eq('DF-BACK 空の現在地は載せない', settingsLinkWithBack('/settings', ''), '/settings')

  eq('DF-BACK ?back=無しでは戻るボタンを出さない(null)', resolveBackTarget(null), null)
  eq('DF-BACK 外部URLは受け付けない', resolveBackTarget('https://example.com'), null)
  eq('DF-BACK //で始まる値(プロトコル相対)も受け付けない', resolveBackTarget('//example.com'), null)
  eq('DF-BACK 知らないパスは受け付けない', resolveBackTarget('/unknown-page'), null)
  eq('DF-BACK レシピ一覧', resolveBackTarget('/recipes'), {
    to: '/recipes',
    label: 'レシピ一覧に戻る',
  })
  eq('DF-BACK レシピ詳細は一覧と区別する', resolveBackTarget('/recipes/12'), {
    to: '/recipes/12',
    label: 'レシピに戻る',
  })
  eq('DF-BACK 献立', resolveBackTarget('/meal-plan'), { to: '/meal-plan', label: '献立に戻る' })
  eq('DF-BACK 並行調理ナビ', resolveBackTarget('/cook-navi'), {
    to: '/cook-navi',
    label: '並行調理ナビに戻る',
  })
  eq('DF-BACK 食材(買い物メモ)', resolveBackTarget('/shopping'), {
    to: '/shopping',
    label: '食材に戻る',
  })
  // 2026-08-17 便HG: ホーム画面を廃止し、「/」は献立へ送るだけの通過点になった。
  // 戻り先としては受け付けない＝「ホームに戻る」というボタンが残らないことを固定する
  eq('DF-BACK 「/」は戻り先として受け付けない(ホーム画面は無い)', resolveBackTarget('/'), null)
  eq('DF-BACK クエリ付きの戻り先はクエリごと戻す', resolveBackTarget('/recipes?q=鶏'), {
    to: '/recipes?q=鶏',
    label: 'レシピ一覧に戻る',
  })
  // 実際の受け渡し(付けて→読む)が往復で壊れないこと
  const roundTrip = new URLSearchParams(
    settingsLinkWithBack('/settings?section=pro', '/recipes?q=鶏 もも').split('?')[1],
  ).get('back')
  eq('DF-BACK 付けた戻り先をそのまま読み戻せる', resolveBackTarget(roundTrip), {
    to: '/recipes?q=鶏 もも',
    label: 'レシピ一覧に戻る',
  })
}

// ---------- 便HG: 設定「ホーム画面のカスタマイズ」は 2026-08-17 に廃止した ----------
// ホーム画面そのものを無くしたので、「表示するパーツ」「並び順」「戻す」を持つ意味が無くなった。
// 並べ替えの入れ先を決めていた logic/homeWidgets.ts とその検査（旧 DH-HOMEW）も一緒に落としている。
// 保存項目 settings.homeWidgets は、書き出したバックアップを読めるようにするため残してある
// （db/types.ts の HomeWidgetKey のコメント参照）。設定から残骸なく消えたことは e2e の NOHOME-01 が見る。

// ---------- 便DV-10: Pro版の販売のお知らせを解錠済みの人に出さない(2026-08-04 オーナー指摘) ----------
{
  const news = (over = {}) => ({ id: 'x', date: '2026-08-02', title: 't', body: 'b', ...over })
  eq(
    'DV-NEWS 販売のお知らせは解錠済みには出さない',
    isNewsVisibleFor(news({ hideWhenPro: true }), true),
    false,
  )
  eq(
    'DV-NEWS 販売のお知らせは未解錠には出す',
    isNewsVisibleFor(news({ hideWhenPro: true }), false),
    true,
  )
  eq('DV-NEWS 印の無いお知らせは解錠済みにも出す', isNewsVisibleFor(news(), true), true)
  eq('DV-NEWS 印の無いお知らせは未解錠にも出す', isNewsVisibleFor(news(), false), true)
  eq(
    'DV-NEWS hideWhenPro:false は印なしと同じ扱い',
    isNewsVisibleFor(news({ hideWhenPro: false }), true),
    true,
  )
  // 配信中の public/news.json 側に印が付いていること（アプリ側だけ直して取りこぼす事故の防止）。
  // 2026-08-21 オーナー指示（A案）: **発売前にPro版のお知らせを出さない**ため、
  // 「Pro版を公開しました」は取り下げた（オーナー原文「まだ正式なユーザーはいません。
  // このような表現は、宣伝をした後になります」）。id を書き写して1件だけを見る形だと、
  // 取り下げた瞬間に赤くなる（禁じ手②）ので、**Pro版に触れるお知らせが在れば印が要る**という
  // 規則で見る。1件も無い今は空振りだが、次に足したときその場で効く
  {
    const items = JSON.parse(readFileSync(new URL('../public/news.json', scriptFileUrl), 'utf8'))
    // 「Pro版の売り込み」＝Proの案内へ連れて行くお知らせ。既に買った人に見せない印が要る。
    // 機能の紹介文の中で「(Pro版の機能)」と触れるだけのもの（並行調理ナビ等）は売り込みではないので対象外
    const proPitch = items.filter((n) => /section=pro|manual\.html#pro/.test(n.link ?? ''))
    eq(
      'DV-NEWS Proの案内へ連れて行くお知らせには hideWhenPro が付いている',
      proPitch.filter((n) => n.hideWhenPro !== true).map((n) => n.id),
      [],
    )
    eq(
      'DV-NEWS その手のお知らせは解錠済みには表示されない(実データで確認)',
      proPitch.filter((n) => isNewsVisibleFor(n, true)).map((n) => n.id),
      [],
    )
    // 発売前は「Pro版そのもの」を題で知らせない（オーナー指示A案）。発売したら消してよい行
    eq(
      'DV-NEWS 発売前はPro版そのものを題にしたお知らせを配らない',
      items.filter((n) => /Pro版/.test(n.title ?? '')).map((n) => n.id),
      [],
    )
  }
}

// ---------- 便EI-1: ホーム画面から起動しているかの判定(設定の追加案内の出し分け) ----------
// 設定「うちレシピについて」の「ホーム画面への追加方法」は、すでに端末のホーム画面のアイコンから起動している人には
// 出さない。判定材料はAndroid/PC=display-mode、iOS=navigator.standaloneの2本で、
// どちらか一方でも真ならアイコン起動(iOSは古い版でdisplay-modeを返さないことがあるため)。
{
  const env = (displayModeStandalone, navigatorStandalone) => ({ displayModeStandalone, navigatorStandalone })
  eq('EI-1 ブラウザのタブで開いている(両方false)＝案内を出す', isStandaloneDisplay(env(false, false)), false)
  eq('EI-1 display-mode:standalone＝アイコン起動', isStandaloneDisplay(env(true, false)), true)
  eq('EI-1 iOSのnavigator.standalone＝アイコン起動', isStandaloneDisplay(env(false, true)), true)
  eq('EI-1 両方true＝アイコン起動', isStandaloneDisplay(env(true, true)), true)
  // 案内の中身: 手順ページへのリンクと、先に追加したほうがよい理由(iOSでデータが分かれる)
  eq('EI-1 リンク名が手順ページと同じ表記', ja.settings.installPageLink, 'ホーム画面への追加方法')
  eq('EI-1 案内文がiOSのデータ分離に触れている', ja.settings.installPageNote.includes('別々に保存されます'), true)
  eq('EI-1 案内文が「使い始める前に」を伝えている', ja.settings.installPageNote.includes('使い始める前に'), true)
}

// ---------- 便EI-2: 日本語入力の変換確定Enterのガード ----------
// 2026-08-02にレシピ登録画面で直した「変換確定のEnterで行/タグが増える」を、
// ChipInput・在庫ボード・設定のNG食材でも同じ判定で止める(logic/imeKey.tsへ集約)。
// isComposing が本命・keyCode 229 は compositionend が先に来る環境向けの保険。
{
  const key = (isComposing, keyCode = 13) => ({ nativeEvent: { isComposing }, keyCode })
  eq('EI-2 変換中のEnter(isComposing=true)は確定用と判定', isImeConfirmKey(key(true)), true)
  eq('EI-2 確定後のEnterは通常のEnter', isImeConfirmKey(key(false)), false)
  eq('EI-2 keyCode 229(compositionendが先に来る環境)も確定用と判定', isImeConfirmKey(key(false, 229)), true)
  eq('EI-2 変換中かつ229でも確定用', isImeConfirmKey(key(true, 229)), true)
  // Enterで確定する入力欄すべてに当てているか(適用漏れの再発防止)。
  // 「e.key === 'Enter'」で始まる分岐が isImeConfirmKey で守られていることをソースで機械検査する。
  // 対象はテキスト入力欄のEnterだけで、ボタン相当要素のEnter/Space(role=button)は対象外
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  // 2026-08-09 便EK: 献立タブ(日付メモ・献立テンプレートの名前)と、単位の自由入力欄
  // (UnitQuantityFields=レシピ登録・食材と価格の両方が使う)も同じ穴だったので対象に足す。
  // IngredientPricesPage は当て先が数字の欄だけだが、同じ blurOnEnter を持つので一緒に見る
  const imeGuardTargets = [
    'src/components/ChipInput.tsx',
    'src/components/PantryBoard.tsx',
    'src/components/UnitQuantityFields.tsx',
    'src/pages/SettingsPage.tsx',
    'src/pages/RecipeFormPage.tsx',
    'src/pages/MealPlanPage.tsx',
    // 日付メモの入力欄（DayNoteEditor）は 2026-08-25 便KZ で切り出した先にある
    'src/pages/mealPlan/DayParts.tsx',
    'src/pages/IngredientPricesPage.tsx',
  ]
  for (const rel of imeGuardTargets) {
    const src = readFileSync(path.join(appRoot, rel), 'utf-8')
    const enterBranches = src.match(/e\.key === 'Enter'[^\n]*/g) ?? []
    const unguarded = enterBranches.filter(
      (line) => !line.includes('isImeConfirmKey') && !line.includes("e.key === ' '"),
    )
    eq(`EI-2 ${rel} に未ガードのEnter分岐が無い`, unguarded, [])
  }
}

// ---------- 便EN: 記録写真の回転(2026-08-09 オーナー要望「記録した写真を回転させることは可能?」) ----------
// 「4回押すと元の向きに戻る」ことと、90度・270度で縦横が入れ替わることを固定する。
// 実際の描画(canvas)はブラウザ側なのでここでは扱わず、向きと大きさの計算だけを見張る。
{
  eq('EN-ROT 1回押すと90度(1/4回転)', normalizeQuarterTurns(1), 1)
  eq('EN-ROT 4回押すと元の向きに戻る', normalizeQuarterTurns(4), 0)
  eq('EN-ROT 5回押すと1回押したのと同じ', normalizeQuarterTurns(5), 1)
  eq('EN-ROT 8回押しても元の向き', normalizeQuarterTurns(8), 0)
  eq('EN-ROT 左に1回(-1)は右に3回と同じ', normalizeQuarterTurns(-1), 3)
  eq('EN-ROT 90度は縦横が入れ替わる', rotatedSize(1280, 960, 1), { width: 960, height: 1280 })
  eq('EN-ROT 270度も縦横が入れ替わる', rotatedSize(1280, 960, 3), { width: 960, height: 1280 })
  eq('EN-ROT 180度は縦横そのまま', rotatedSize(1280, 960, 2), { width: 1280, height: 960 })
  eq('EN-ROT 4回で元の大きさに戻る', rotatedSize(1280, 960, 4), { width: 1280, height: 960 })
}

// ---------- 便ER: アプリの更新(2026-08-09) ----------
// 更新の仕組みは「Service Workerの入れ替わりを見て、画面を読み込み直す」だけで、
// レシピ・価格・設定・解錠コード(IndexedDB)には触れない。appRefreshと同じく、
// 触れないことをソースの静的検査で固定する(触れる実装に変わったらここで落ちる)。
// また、勝手に画面が作り直されないことの要は onNeedReload を渡していることなので、
// これが外されたら気づけるようにしておく(外すとregisterSWが即座にreloadを呼ぶ)。
{
  const scriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const appUpdateSrc = readFileSync(path.join(scriptDir, '../src/logic/appUpdate.ts'), 'utf-8')
  eq(
    'ER-UPDATE appUpdateはdexie/db配下をimportせず、indexedDBのプロパティアクセスもしない',
    /from ['"]dexie['"]|from ['"]\.\.\/db|indexeddb\.\w/i.test(appUpdateSrc),
    false,
  )
  eq(
    'ER-UPDATE registerSWにonNeedReloadを渡している(既定の自動リロードを止める要)',
    appUpdateSrc.includes('onNeedReload'),
    true,
  )
  // 帯を出さない場面の判定は、この2つの入口だけで決まる(調理中・段取り中・入力中)
  const bannerSrc = readFileSync(
    path.join(scriptDir, '../src/components/AppUpdateBanner.tsx'),
    'utf-8',
  )
  eq(
    'ER-UPDATE 帯は「中断されると困る作業」とタイマーの両方を見て出し分ける',
    bannerSrc.includes('isAppBusy') && bannerSrc.includes('timers.length'),
    true,
  )
  for (const [label, file] of [
    ['調理中モード', '../src/components/FocusMode.tsx'],
    ['並行調理ナビの段取り実行中', '../src/components/CookSessionOverlay.tsx'],
    ['レシピを書く画面', '../src/pages/RecipeFormPage.tsx'],
  ]) {
    eq(
      `ER-UPDATE ${label}は「中断されると困る作業」として数える`,
      readFileSync(path.join(scriptDir, file), 'utf-8').includes('useAppBusyWhileMounted()'),
      true,
    )
  }
}

// ---------- HOMENOTICE: ホーム画面への追加の初回お知らせ(2026-08-10 便EW) ----------
{
  const scriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const base = { touchPrimary: true, launchedFromHomeScreen: false, seen: false }
  eq('HOMENOTICE 3条件をすべて満たすと出す', shouldShowHomeScreenNotice(base), true)
  eq(
    'HOMENOTICE パソコン(指で操作しない)には出さない',
    shouldShowHomeScreenNotice({ ...base, touchPrimary: false }),
    false,
  )
  eq(
    'HOMENOTICE すでにホーム画面のアイコンから開いているときは出さない',
    shouldShowHomeScreenNotice({ ...base, launchedFromHomeScreen: true }),
    false,
  )
  eq(
    'HOMENOTICE 一度見たら出さない',
    shouldShowHomeScreenNotice({ ...base, seen: true }),
    false,
  )
  eq(
    'HOMENOTICE 見ていてもパソコンでも、条件が2つ欠ければ当然出さない',
    shouldShowHomeScreenNotice({ touchPrimary: false, launchedFromHomeScreen: true, seen: true }),
    false,
  )

  // 端末の判定にユーザーエージェント文字列を使わない(UAは別の端末を名乗ることがある)。
  // 入力装置の性質3つ((pointer:coarse)・(hover:none)・maxTouchPoints)だけで決める
  const noticeSrc = readFileSync(path.join(scriptDir, '../src/logic/homeScreenNotice.ts'), 'utf-8')
  eq(
    'HOMENOTICE 端末の判定にuserAgentを使っていない',
    /navigator\.userAgent|userAgentData/.test(noticeSrc),
    false,
  )
  for (const signal of ['(pointer: coarse)', '(hover: none)', 'maxTouchPoints']) {
    eq(`HOMENOTICE 判定材料に ${signal} を見ている`, noticeSrc.includes(signal), true)
  }

  // 見た記録は端末内(localStorage)だけ。設定(Dexie)に置くとバックアップの中身に混ざる。
  // 読み書き自体は logic/noticeSeen.ts に集約した(2026-08-13 便GE)ので、そちらで見る
  const seenSrc = readFileSync(path.join(scriptDir, '../src/logic/noticeSeen.ts'), 'utf-8')
  eq('HOMENOTICE 見た記録はlocalStorageに置く', seenSrc.includes('window.localStorage'), true)
  eq(
    'HOMENOTICE 見た記録の読み書きは共通の1か所に寄せてある',
    noticeSrc.includes("from './noticeSeen'") &&
      noticeSrc.includes('hasSeenNotice(HOME_SCREEN_NOTICE_SEEN_KEY)') &&
      noticeSrc.includes('markNoticeSeen(HOME_SCREEN_NOTICE_SEEN_KEY)'),
    true,
  )
  eq(
    'HOMENOTICE 記録を読めない端末は「見た」扱い(毎回出る窓にしない)',
    /catch\s*\{\s*return true/.test(seenSrc),
    true,
  )
  const backupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const typesSrc = readFileSync(path.join(scriptDir, '../src/db/types.ts'), 'utf-8')
  eq(
    'HOMENOTICE 見た記録がバックアップ・設定の器に入り込んでいない',
    /homeScreenNotice/i.test(backupSrc) || /homeScreenNotice/i.test(typesSrc),
    false,
  )

  // お知らせの文言(規約H・オーナー確認用にここで固定する)
  eq(
    'HOMENOTICE 見出しは「インストール」「アプリとして」と言わない',
    /インストール|アプリとして/.test(ja.homeScreenNotice.title),
    false,
  )
  eq(
    'HOMENOTICE 「必須」「推奨」「おすすめ」等の押す言葉を使っていない',
    /必須|推奨|おすすめ|してください[^。]*$/.test(
      `${ja.homeScreenNotice.title}${ja.homeScreenNotice.body}${ja.homeScreenNotice.dismissButton}`,
    ),
    false,
  )
  // 2026-08-21 便IR: 一文まるごとの照合をやめた（言い回しを直すたびに、アプリは正常なのに
  // ここだけ赤くなる＝禁じ手②）。見たいのは「アプリストアからのダウンロードではないと
  // 言っているか」なので、その形だけを見る
  eq(
    'HOMENOTICE 本文はアプリストアからのダウンロードではないと伝える(「インストール不要」とは言わない)',
    /アプリストアからのダウンロード[^。]{0,6}(必要ありません|ありません|不要)/.test(ja.homeScreenNotice.body) &&
      !/インストール[^。]{0,12}(不要|いりません)/.test(ja.homeScreenNotice.body),
    true,
  )
  eq(
    'HOMENOTICE あとから見る場所を、設定のリンク名そのままで案内している',
    ja.homeScreenNotice.laterNote.includes(ja.settings.installPageLink),
    true,
  )
  eq(
    'HOMENOTICE 案内文が「ここ」「これ」で場所を示していない',
    /(^|[^そあど])ここ|これ(から)?を?(見|開)/.test(ja.homeScreenNotice.laterNote),
    false,
  )

  // 窓の作り: エラー・警告に見える色を使わない(条件反射で閉じたくなる画面にしない)。
  // 窓そのもの(カード・✕・閉じ方の3通り)は共通の NoticeDialog.tsx に移した(2026-08-13 便GE)
  const noticeUi = readFileSync(
    path.join(scriptDir, '../src/components/HomeScreenNotice.tsx'),
    'utf-8',
  )
  const dialogUi = readFileSync(path.join(scriptDir, '../src/components/NoticeDialog.tsx'), 'utf-8')
  eq(
    'HOMENOTICE 警告色・全面の黒地を使っていない',
    /warning|bg-black|text-red|AlertTriangle/.test(noticeUi + dialogUi),
    false,
  )
  eq(
    'HOMENOTICE 窓は✕・カード外のタップ・端末の戻る(Escape)の3通りで閉じられる',
    dialogUi.includes('useOverlayDismiss(true, onClose)') &&
      dialogUi.split('onClick={onClose}').length - 1 >= 2,
    true,
  )
  eq(
    'HOMENOTICE ✕・カード外のタップ・端末の戻る・「このまま使う」のどれで閉じても見た記録を残す',
    noticeUi.includes('markHomeScreenNoticeSeen()') &&
      noticeUi.includes('onClose={close}') &&
      noticeUi.includes('onClick={close}'),
    true,
  )
}

// ---------- FIRSTSETUP: 「食数の設定」「台所の器具」の初回の案内(2026-08-13 便GE・docs/65 A-4) ----------
{
  const scriptDir = path.dirname(fileURLToPath(scriptFileUrl))
  const base = {
    settingsLoaded: true,
    recipeShown: true,
    openedForTask: false,
    seen: false,
    settingsChosen: false,
  }
  eq('FIRSTSETUP 条件をすべて満たすと出す', shouldShowFirstSetupNotice(base), true)
  eq(
    'FIRSTSETUP 設定の読み込みが済むまでは出さない',
    shouldShowFirstSetupNotice({ ...base, settingsLoaded: false }),
    false,
  )
  eq(
    'FIRSTSETUP レシピが表示されていない画面(読み込み中・見つからない)には出さない',
    shouldShowFirstSetupNotice({ ...base, recipeShown: false }),
    false,
  )
  eq(
    'FIRSTSETUP 用事があって開いた画面(タイマーの手順・記録の編集)には割り込まない',
    shouldShowFirstSetupNotice({ ...base, openedForTask: true }),
    false,
  )
  eq('FIRSTSETUP 一度見たら出さない', shouldShowFirstSetupNotice({ ...base, seen: true }), false)
  eq(
    'FIRSTSETUP すでに設定を自分で決めている人には出さない',
    shouldShowFirstSetupNotice({ ...base, settingsChosen: true }),
    false,
  )

  // 「自分で決めている」の見分け(5項目のどれか1つでも決めていれば出さない)
  eq('FIRSTSETUP まっさらな設定は「まだ決めていない」', hasChosenFirstSetup({}), false)
  eq('FIRSTSETUP 設定が読めていないときも「まだ決めていない」', hasChosenFirstSetup(undefined), false)
  for (const [label, patch] of [
    ['食数の設定', { householdServings: 2 }],
    ['コンロの口数', { kitchenBurners: 1 }],
    ['電子レンジ(持っていない)', { kitchenNoMicrowave: true }],
    ['魚焼きグリル(持っていない)', { kitchenNoGrill: true }],
    ['トースター(持っていない)', { kitchenNoToaster: true }],
  ]) {
    eq(`FIRSTSETUP ${label}を決めていたら出さない`, hasChosenFirstSetup(patch), true)
  }
  // 既定と同じ値に戻した場合も「自分で決めた」＝案内は出さない(触った人には用のない窓)
  eq(
    'FIRSTSETUP 既定と同じ値(2口)を選び直した人も「決めた」扱い',
    hasChosenFirstSetup({ kitchenBurners: 2 }),
    true,
  )
  eq(
    'FIRSTSETUP 「持っている」に戻した(false)人も「決めた」扱い',
    hasChosenFirstSetup({ kitchenNoToaster: false }),
    true,
  )

  // 見た記録は端末内(localStorage)だけ。設定(Dexie)＝バックアップの中身には入れない
  const fsSrc = readFileSync(path.join(scriptDir, '../src/logic/firstSetupNotice.ts'), 'utf-8')
  eq(
    'FIRSTSETUP 見た記録は端末内(localStorage)の共通の仕組みに載せる',
    fsSrc.includes("from './noticeSeen'") &&
      fsSrc.includes('hasSeenNotice(FIRST_SETUP_NOTICE_SEEN_KEY)') &&
      fsSrc.includes('markNoticeSeen(FIRST_SETUP_NOTICE_SEEN_KEY)'),
    true,
  )
  eq('FIRSTSETUP 保存キーが他の案内と重なっていない', FIRST_SETUP_NOTICE_SEEN_KEY, 'uchirecipe:firstSetupNoticeSeen')
  const fsBackupSrc = readFileSync(path.join(scriptDir, '../src/logic/backup.ts'), 'utf-8')
  const fsTypesSrc = readFileSync(path.join(scriptDir, '../src/db/types.ts'), 'utf-8')
  eq(
    'FIRSTSETUP 見た記録がバックアップ・設定の器に入り込んでいない',
    /firstSetupNotice/i.test(fsBackupSrc) || /firstSetupNotice/i.test(fsTypesSrc),
    false,
  )

  /**
   * 文言(規約H)。オーナー指示「ここに情報詰めすぎると、読まずに消されるので、
   * 必要最低限の文字数で、的確な場所に案内を出したい」に対して、便GEで上限を決めた。
   * 上限を超えたらここで落ちる＝あとから一言足していく形での肥大化を止める
   */
  const n = (s) => [...s].length
  const fsText = ja.firstSetupNotice
  eq(`FIRSTSETUP 見出しは20字以内(実測${n(fsText.title)}字)`, n(fsText.title) <= 20, true)
  eq(`FIRSTSETUP 本文は45字以内(実測${n(fsText.body)}字)`, n(fsText.body) <= 45, true)
  eq(
    `FIRSTSETUP ボタンは各12字以内(実測${n(fsText.settingsButton)}字/${n(fsText.dismissButton)}字)`,
    n(fsText.settingsButton) <= 12 && n(fsText.dismissButton) <= 12,
    true,
  )
  eq(
    `FIRSTSETUP あとから変える場所の一言は40字以内(実測${n(fsText.laterNote)}字)`,
    n(fsText.laterNote) <= 40,
    true,
  )
  const fsTotal =
    n(fsText.title) +
    n(fsText.body) +
    n(fsText.settingsButton) +
    n(fsText.dismissButton) +
    n(fsText.laterNote)
  eq(`FIRSTSETUP 窓の文字は合計120字以内(実測${fsTotal}字)`, fsTotal <= 120, true)

  eq(
    'FIRSTSETUP 「必須」「推奨」「おすすめ」等の押す言葉を使っていない',
    /必須|推奨|おすすめ|ぜひ|しましょう/.test(
      `${fsText.title}${fsText.body}${fsText.settingsButton}${fsText.dismissButton}${fsText.laterNote}`,
    ),
    false,
  )
  eq(
    'FIRSTSETUP 本文は2つの設定がどこに効くかを言っている',
    fsText.body.includes('分量') && fsText.body.includes('段取り'),
    true,
  )
  eq(
    'FIRSTSETUP あとから変える場所を、設定の欄の名前そのままで案内している',
    fsText.laterNote.includes(ja.settings.householdServingsTitle) &&
      fsText.laterNote.includes(ja.settings.kitchenTitle) &&
      fsText.laterNote.includes(ja.settings.tabBasic),
    true,
  )
  eq(
    'FIRSTSETUP 案内文が「ここ」「これ」で場所を示していない',
    /(^|[^そあど])ここ|これ(から)?を?(見|開)/.test(`${fsText.body}${fsText.laterNote}`),
    false,
  )
  eq(
    'FIRSTSETUP 「タブ」という言い方をしていない(設定は1本スクロール)',
    /タブ/.test(`${fsText.title}${fsText.body}${fsText.laterNote}`),
    false,
  )

  // 窓の作り(端末のホーム画面追加の案内と同じ NoticeDialog に載せる)と、設定への行き先
  const fsUi = readFileSync(path.join(scriptDir, '../src/components/FirstSetupNotice.tsx'), 'utf-8')
  eq(
    'FIRSTSETUP 警告色・全面の黒地を使っていない',
    /warning|bg-black|text-red|AlertTriangle/.test(fsUi),
    false,
  )
  eq(
    'FIRSTSETUP ✕・カード外のタップ・端末の戻る・「このまま使う」のどれで閉じても見た記録を残す',
    fsUi.includes('markFirstSetupNoticeSeen()') &&
      fsUi.includes('onClose={close}') &&
      fsUi.includes('onClick={close}'),
    true,
  )
  eq(
    'FIRSTSETUP 設定へのリンクを押した時点でも見た記録を残す(見た人に次回また出さない)',
    fsUi.includes('onClick={markFirstSetupNoticeSeen}'),
    true,
  )
  eq(
    'FIRSTSETUP 設定への行き先は「食数の設定」の欄(?section=household)',
    fsUi.includes("'/settings?section=household'"),
    true,
  )
  eq(
    'FIRSTSETUP 設定から今読んでいたレシピへ帰れる(?back=を載せている)',
    fsUi.includes('settingsLinkWithBack('),
    true,
  )
  // 1回のタップで両方の欄が視界に入ること＝設定画面で「食数の設定」の次が「台所の器具」であること。
  // 間に別の欄が挟まると、案内した2つのうち片方までしか届かない
  const fsSettingsSrc = readFileSync(path.join(scriptDir, '../src/pages/SettingsPage.tsx'), 'utf-8')
  eq(
    'FIRSTSETUP 設定の直リンク(?section=household)の着地点がある',
    /household:\s*'household-section'/.test(fsSettingsSrc) &&
      fsSettingsSrc.includes('id="household-section"'),
    true,
  )
  const fsHouseholdAt = fsSettingsSrc.indexOf('id="household-section"')
  const fsKitchenAt = fsSettingsSrc.indexOf('id="kitchen-section"')
  eq(
    'FIRSTSETUP 「食数の設定」のすぐ次が「台所の器具」になっている',
    fsHouseholdAt > 0 &&
      fsKitchenAt > fsHouseholdAt &&
      !/id="(?!kitchen-section)[a-z-]+-section"/.test(
        fsSettingsSrc.slice(fsHouseholdAt + 1, fsKitchenAt),
      ),
    true,
  )
  // 出す場所はレシピ詳細だけ(他の画面へ広げない)。docs/65 A-4の決定
  const fsDetailSrc = readFileSync(path.join(scriptDir, '../src/pages/RecipeDetailPage.tsx'), 'utf-8')
  eq('FIRSTSETUP レシピ詳細から呼んでいる', fsDetailSrc.includes('<FirstSetupNotice'), true)
  eq(
    'FIRSTSETUP 用事の有無は最初の描画時のクエリで見る(?step=・?editLog=は使い終わると消えるため)',
    fsDetailSrc.includes(
      "useRef(searchParams.has('step') || searchParams.has('editLog'))",
    ),
    true,
  )
  // 2026-08-17 便HG: HomePage.tsx はホーム画面の廃止で無くなったので外した
  for (const page of ['RecipesPage.tsx', 'MealPlanPage.tsx', 'CookNaviPage.tsx']) {
    eq(
      `FIRSTSETUP ${page} には出していない`,
      readFileSync(path.join(scriptDir, `../src/pages/${page}`), 'utf-8').includes(
        'FirstSetupNotice',
      ),
      false,
    )
  }
}

// ---------- 便GV-2: ファイルの大きさの表し方 ----------
{
  eq('GV-2 1KB未満はバイトで出す', formatFileSize(512), '512B')
  eq('GV-2 1KB以上はKBで出す(小数は出さない)', formatFileSize(1024 * 128 + 400), '128KB')
  eq('GV-2 1MB以上はMBで小数第1位まで出す', formatFileSize(1024 * 1024 * 1.53), '1.5MB')
  eq('GV-2 ちょうど1MBは1.0MBではなく1MB', formatFileSize(1024 * 1024), '1MB')
  eq('GV-2 0バイトでも壊れない', formatFileSize(0), '0B')
}

// ---------- JO-1: 画面を離れる前の引き止め（2026-08-23 便JO・src/logic/leaveGuard.ts） ----------
//
// オーナー原文:
//   「編集終わりのつもりでそのまま保存をせずにページを離れそう。一時保存はされるが、
//     反映されていないことに気づきにくい。」
//
// レシピ編集の画面が「書きかけがあるときだけ引き止める」ための受け口。ここで測るのは
// **利用者が閉じ込められないこと**:
//   ・引き止めを登録していない画面では、必ずそのまま離れられる
//   ・画面を離れたあと（解除したあと）は、前の画面の引き止めが残らない
//   ・引き止めの中で例外が起きても、離れられなくならない（画面から出られなくなるのが最悪の壊れ方）
{
  const { setLeaveGuard, askBeforeLeave, hasLeaveGuard } = await import('../../src/logic/leaveGuard.ts')
  setLeaveGuard(null)
  eq('JO-1 引き止めが無いときは、そのまま離れられる', await askBeforeLeave(), true)
  eq('JO-1 引き止めが無いことを外から読める', hasLeaveGuard(), false)

  let asked = 0
  setLeaveGuard(async () => {
    asked++
    return false
  })
  eq('JO-1 引き止めがあることを外から読める', hasLeaveGuard(), true)
  eq('JO-1 引き止めが「いいえ」と答えたら離れない', await askBeforeLeave(), false)
  eq('JO-1 引き止めは1回だけ聞かれる', asked, 1)

  // 2つ目を登録したら、聞かれるのは新しいほうだけ（古い画面の引き止めが二重に出ない）
  let secondAsked = 0
  setLeaveGuard(async () => {
    secondAsked++
    return true
  })
  eq('JO-1 あとから登録したほうが答える', await askBeforeLeave(), true)
  eq('JO-1 前の引き止めはもう聞かれない', asked, 1)
  eq('JO-1 新しい引き止めが聞かれている', secondAsked, 1)

  // 画面を離れたら解除する＝次の画面に前の引き止めを持ち越さない
  setLeaveGuard(null)
  eq('JO-1 解除したら、そのまま離れられる', await askBeforeLeave(), true)
  eq('JO-1 解除したことを外から読める', hasLeaveGuard(), false)

  // 引き止めの中で例外が起きても、閉じ込めない（何も聞けなかったら通す側に倒す）
  setLeaveGuard(() => {
    throw new Error('わざと壊す')
  })
  eq('JO-1 引き止めが壊れても画面から出られる', await askBeforeLeave(), true)
  setLeaveGuard(null)
}

// ==========================================================================================
// 便JN: 月タブの「日の窓」を、週の曜日カードと同じ2モードにする
//       （2026-08-23 オーナー原文「献立／月／・見た目を週に寄せて、編集ボタンをつけて。」）
//
// 週タブは 2026-08-22 便IV で「通常表示＝写真と料理名だけ／『編集』で1品ごとの操作が出る」に、
// 便JF で「過ぎた日の編集モードは作った記録を触る／鍵を掛けた日は編集は押せるが中が止まる」に
// なった。月タブの日の窓だけが**開いた瞬間から全部の操作が出ている**古い形で残っていたので、
// 同じ決めごとを1か所（monthDayWindowView）に置いて両方から使う。
//
// 画面の見え方（料理名で何文字読めるか・押せる大きさ・鍵の止まり方）は e2e の
// JNVIEW-01／JNEDIT-02／JNLOCK-03／JNPAST-04 が実測で受け持つ。
// ここでは**日付にも画面にも依らない決めごと**だけを見る。
// ==========================================================================================
{
  const jnLogic = await import('../../src/logic/mealPlan.ts')
  // 読み取りに失敗したら必ず落ちる形にする（「関数が無いので測れませんでした」で素通りしない）
  eq(
    'JN-0 月の日の窓の決めごとを読める（無ければ以下は測れていない）',
    typeof jnLogic.monthDayWindowView,
    'function',
  )
  const { monthDayWindowView, planToggleDayEdit } = jnLogic
  const JN_TODAY = '2026-08-23'
  const jnView = (patch) =>
    monthDayWindowView({ date: JN_TODAY, today: JN_TODAY, editing: false, isDemo: false, ...patch })

  // --- JN-1: 窓を開いた直後は通常表示（週の曜日カードと同じ既定） ---
  eq('JN-1 今日の窓の既定は通常表示（写真と料理名だけ）', jnView({}).plan, 'view')
  eq('JN-1 先の日の窓の既定も通常表示', jnView({ date: '2026-09-01' }).plan, 'view')
  eq('JN-1 通常表示にも「編集」の切り替えは出す', jnView({}).editToggle, true)
  eq(
    'JN-1 通常表示には、記録の追加・削除も、カレンダーに出す写真の指名も出さない',
    [jnView({}).recordAdd, jnView({}).recordDelete, jnView({}).cover],
    [false, false, false],
  )

  // --- JN-2: 「編集」を押すと1品ごとの操作の面になる ---
  eq('JN-2 編集モードでは1品ごとの操作が出る面に変わる', jnView({ editing: true }).plan, 'editor')
  eq(
    'JN-2 カレンダーに出す写真の指名は編集モードの中（普段の見え方に足さない）',
    jnView({ editing: true }).cover,
    true,
  )
  eq(
    'JN-2 今日・先の日の編集モードで触るのは献立だけ（作った記録の追加・削除は出さない）',
    [jnView({ editing: true }).recordAdd, jnView({ editing: true }).recordDelete],
    [false, false],
  )

  // --- JN-3: 過ぎた日は「作った記録だけが残る」画面のまま（便BS・便JFの決めごとを崩さない） ---
  const jnPast = (editing) => jnView({ date: '2026-08-22', editing })
  eq('JN-3 過ぎた日の窓には献立の枠を出さない（通常表示）', jnPast(false).plan, 'none')
  eq('JN-3 過ぎた日の窓には献立の枠を出さない（編集モードでも）', jnPast(true).plan, 'none')
  eq('JN-3 過ぎた日にも「編集」は出す（便JF・①で記録を足せるようになった）', jnPast(false).editToggle, true)
  eq(
    'JN-3 記録の追加・削除は編集モードの中だけ',
    [jnPast(false).recordAdd, jnPast(false).recordDelete, jnPast(true).recordAdd, jnPast(true).recordDelete],
    [false, false, true, true],
  )

  // --- JN-4: サンプルの1か月は読むだけ（書き込み先が無いので編集の入口を出さない） ---
  const jnDemo = monthDayWindowView({ date: JN_TODAY, today: JN_TODAY, editing: true, isDemo: true })
  eq('JN-4 サンプルには「編集」を出さない', jnDemo.editToggle, false)
  eq('JN-4 サンプルは読むだけの並べ方', jnDemo.plan, 'demo')
  eq(
    'JN-4 サンプルでは、編集モードにしても何も触れない',
    [jnDemo.recordAdd, jnDemo.recordDelete, jnDemo.cover],
    [false, false, false],
  )
  // サンプルの過ぎた日は、本物と同じく「作った記録だけが残る」見え方のまま
  const jnDemoPast = monthDayWindowView({
    date: '2026-08-22',
    today: JN_TODAY,
    editing: true,
    isDemo: true,
  })
  eq(
    'JN-4 サンプルの過ぎた日も、献立の枠を出さず編集の入口も出さない',
    [jnDemoPast.plan, jnDemoPast.editToggle, jnDemoPast.recordAdd],
    ['none', false, false],
  )

  // --- JN-5: 切り替えの決め方は週と同じ1か所（同じものを2つ作らない） ---
  // 窓は1日ぶんしか開かないので「覚えるのは日付1つ」で足りる＝週の planToggleDayEdit をそのまま使う。
  // 別の日の窓を開けば前の日には当たらないので、開き直すたび必ず通常表示から始まる
  eq('JN-5 通常表示の窓で押すと、その日が編集モードになる', planToggleDayEdit(null, JN_TODAY), JN_TODAY)
  eq('JN-5 もう一度押すと通常表示に戻る', planToggleDayEdit(JN_TODAY, JN_TODAY), null)
  eq(
    'JN-5 別の日の窓を開いたら、前の日の編集モードは持ち越さない',
    planToggleDayEdit(JN_TODAY, '2026-08-24') === '2026-08-24' &&
      monthDayWindowView({ date: JN_TODAY, today: JN_TODAY, editing: false, isDemo: false }).plan ===
        'view',
    true,
  )
}


// ==========================================================================================
// JP-1〜JP-3: 2026-08-23 便JP（オーナー実機の3件）
// ==========================================================================================


// ==========================================================================================
// LI-1〜LI-6: 2026-08-26 便LI（オーナーの書き溜め0826・買い物メモ／設定／バックアップ／
//             アーカイブ／アプリの更新の文言）
//
// ここで見張るのは「直した言い回し」ではなく、**直した理由が壊れていないこと**:
//  LI-1 一度もバックアップしていない人に、いきなり警告を出さない（初回は「すすめ」）
//  LI-2 「基本レシピを入れ直す」の確認は、見出しの語を並べずに1文＋残るものの1行
//  LI-3 機種変更の注意に、上書きで消えるときの逃げ道（「今のデータに追加」）が書いてある
//  LI-4 ブラウザの設定の注意が「何を消すとき」を言っている（主語の欠けを戻さない）
//  LI-5 アーカイブの「アプリに戻す」が、書き出しと削除は別の操作だと先に言っている
//  LI-6 「自動で更新します」が実装（registerType: 'autoUpdate'）と食い違っていない
// ==========================================================================================
{
  const liRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const liRead = (rel) => readFileSync(path.join(liRoot, rel), 'utf-8')

  // ---- LI-1: 初回は警告にしない ----------------------------------------------------------
  // オーナー原文「いきなり『まだ〜』と出てきても、まだも何も何も説明受けてないけど？、と
  // 思ってしまう。初回のみ、バックアップのすすめと説明にすべきでは？」
  {
    eq('LI-1 「まだバックアップしていません」は残っていない', 'backupNever' in ja.settings, false)
    const liNotYet = [ja.settings.bannerBackupNotYet, ja.settings.backupNotYet]
    eq(
      'LI-1 未実施のときの文言が2か所（バナー・書き出しカード）そろっている',
      liNotYet.filter((t) => typeof t !== 'string' || t.length === 0),
      [],
    )
    eq(
      'LI-1 未実施の文言が「まだ〜していません」と責める形になっていない',
      liNotYet.filter((t) => /まだ/.test(t)),
      [],
    )
    // バナーは1行に収まる場所なので、短さも見る（長いと truncate で読めない）
    eq(
      'LI-1 バナーの文言が1行に収まる長さ（20字以内）',
      ja.settings.bannerBackupNotYet.replace(/​/g, '').length <= 20,
      true,
    )
    // 画面側: 未実施（日数が null）を警告色の条件から外している
    const liSettingsSrc = liRead('src/pages/SettingsPage.tsx')
    eq(
      'LI-1 未実施を警告色の条件に入れていない',
      /const backupBannerWarning = backupDaysAgo !== null && backupDaysAgo > 30/.test(liSettingsSrc),
      true,
    )
    // 2回目以降（一度は書き出した人がしばらく空けたとき）は、これまでどおり警告のまま
    eq(
      'LI-1 日数が出るときの文言は今までどおり残っている',
      [ja.settings.bannerLastBackupToday, ja.settings.bannerLastBackupDaysAgo].filter(
        (t) => typeof t !== 'string' || t.length === 0,
      ),
      [],
    )
  }

  // ---- LI-2: 「基本レシピを入れ直す」の確認 ------------------------------------------------
  // オーナー原文「『戻るもの〜』→『基本レシピの内容を初期設置に戻します』。『残るもの』削除。
  // 『お気に入り〜』は残す。」
  // 規約Fの例外（2026-08-25 差し戻しD）に当たるのは**残る側の「自分で登録したレシピ」**だけ。
  // 消える側（料理名を変えた品が削除される）はボタンの名前から読み取れないので、そのまま残す。
  {
    eq(
      'LI-2 「戻るもの」「残るもの」の見出しの語は残っていない',
      ['starterReloadConfirmBackLabel', 'starterReloadConfirmKept', 'starterReloadConfirmStaysLabel'].filter(
        (k) => k in ja.settings,
      ),
      [],
    )
    eq(
      'LI-2 何をする操作かを1文で言い切っている',
      ja.settings.starterReloadConfirm,
      '基本レシピの内容を初期設定に戻します',
    )
    eq(
      'LI-2 残るものは、名前から読み取れないものだけ（お気に入り・作った記録・写真）',
      ja.settings.starterReloadConfirmStays,
      'お気に入り・作った記録・写真は残ります',
    )
    // 消える側は落とさない（ボタンの名前「基本レシピを入れ直す」からは読み取れない）
    eq(
      'LI-2 消える側（料理名が一致しない品）は件数つきで残っている',
      ja.settings.starterReloadConfirmRemoved.includes('{d}') &&
        ja.settings.starterReloadConfirmRemovedLabel === '消えるもの',
      true,
    )
  }

  // ---- LI-3: 機種変更の逃げ道 --------------------------------------------------------------
  // オーナー原文「『新しい端末で先に登録したレシピは消えます』→『〜がある場合は「今のデータに
  // 追加」をしてください』ではないの？内容的に間違い？」
  // 内容は正しい（③＝上書きなので実際に消える）。足りていなかったのは逃げ道のほう。
  {
    const liMove = (Array.isArray(ja.settings.moveGuideNotes) ? ja.settings.moveGuideNotes : []).join('\n')
    eq('LI-3 上書きで消えることは書いたまま', /上書き/.test(liMove) && /消えます/.test(liMove), true)
    eq(
      'LI-3 逃げ道（「今のデータに追加」を押す）が書いてある',
      liMove.includes(`「${ja.settings.backupImportMerge}」`),
      true,
    )
    eq(
      'LI-3 逃げ道の行が、上書きのボタン名と並べて書いてある',
      liMove.includes(`「${ja.settings.backupImportReplace}」`),
      true,
    )
    // 逃げ道が本当（logic/backup.ts の merge は今のデータを消さない）ことを、実装の説明で裏取りする
    eq(
      'LI-3 「今のデータに追加」は今のデータを消さない（実装の建て付け）',
      ja.settings.backupImportMergeKept.includes('1件も消えず'),
      true,
    )
  }

  // ---- LI-4: 「何を消すとき」の主語 --------------------------------------------------------
  // オーナー原文「『ブラウザの設定で消すときは〜』→何を消すとき？」
  {
    const liWarn = Array.isArray(ja.settings.refreshAppCacheClearWarnings)
      ? ja.settings.refreshAppCacheClearWarnings
      : []
    const liTarget = liWarn.find((t) => t.includes('キャッシュされた画像とファイル')) ?? ''
    eq('LI-4 「キャッシュされた画像とファイル」だけにする案内がある', liTarget.length > 0, true)
    eq('LI-4 何を消すのか（消す項目）を言っている', /消す項目/.test(liTarget), true)
    eq('LI-4 主語の抜けた「消すときは」に戻っていない', /設定で消すときは/.test(liTarget), false)
  }

  // ---- LI-5: アーカイブの「アプリに戻す」 --------------------------------------------------
  // オーナー原文「アーカイブしたあとで本体のデータを消すから二重にならないのでは？」
  // 事実: 書き出す（archiveExportButton）と端末から消す（archiveDeleteButton）は別のボタン。
  // 書き出しただけでは端末に残るので、二重になるのは正しい。理由を消さずに書き換える。
  {
    const liRows = Array.isArray(ja.settings.archiveFileRows) ? ja.settings.archiveFileRows : []
    const liBack = liRows.find((r) => r?.name === 'アプリに戻す')?.body ?? ''
    eq('LI-5 「アプリに戻す」の行がある', liBack.length > 0, true)
    eq('LI-5 戻せない理由（二重になる）を消していない', /二重/.test(liBack), true)
    eq('LI-5 「書き出しても端末の記録は消えない」が理由より先に読める', /書き出しても端末の記録は消えない/.test(liBack), true)
    eq('LI-5 見出しは「読みかた」ではなく「について」', ja.settings.archiveFileTitle, 'アーカイブファイルについて')
    // 「一覧として読みます」→「一覧表示します」を2か所そろえる（同じことを2通りで言わない）
    eq(
      'LI-5 一覧の言い方を2か所でそろえている',
      [
        liRows.some((r) => (r?.body ?? '').includes('一覧表示します')),
        ja.settings.archiveDeleteConfirmViewNote.includes('一覧表示します'),
      ],
      [true, true],
    )
    eq(
      'LI-5 「一覧として読みます」は残っていない',
      [...liRows.map((r) => r?.body ?? ''), ja.settings.archiveDeleteConfirmViewNote].filter((t) =>
        t.includes('一覧として読みます'),
      ),
      [],
    )
  }

  // ---- LI-6: 「自動で更新します」が実装と合っている ----------------------------------------
  // 書いてあることが本当か: vite.config.ts が registerType: 'autoUpdate'（skipWaiting +
  // clientsClaim）なので、次に開き直したときには必ず新しい版になる。
  // ここが 'prompt' 等に変わったら、この文言は嘘になるので落とす。
  {
    eq(
      'LI-6 更新の説明が「開き直したときに自動で更新する」と書いている',
      /開き直したときに自動で更新します/.test(ja.settings.appUpdateAutoNote),
      true,
    )
    eq(
      'LI-6 その説明の根拠（registerType: \'autoUpdate\'）が実装に残っている',
      /registerType:\s*'autoUpdate'/.test(liRead('vite.config.ts')),
      true,
    )
    eq(
      'LI-6 表示の乱れの行き先は「困ったとき」の修復のまま',
      ja.settings.appUpdateVsRefreshNote.includes(`「${ja.settings.refreshAppTitle}」`) &&
        ja.settings.appUpdateVsRefreshNote.includes(`「${ja.settings.refreshAppButton}」`),
      true,
    )
  }
}
