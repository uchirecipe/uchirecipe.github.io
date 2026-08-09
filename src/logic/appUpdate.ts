import { registerSW } from 'virtual:pwa-register'

/**
 * アプリの更新をワンタップで反映するための土台(2026-08-09 便ER)。
 *
 * ## これまでの動き
 * vite.config.ts は `registerType: 'autoUpdate'` のまま維持している。新しい版を公開すると
 * Service Workerが自動で入れ替わる(skipWaiting + clientsClaim)ので、**次にアプリを開き直したときには
 * 必ず新しい版になる**。ただし入れ替わった時点で画面が作り直されるわけではないため、
 * ホーム画面のアイコンから使うPWAのように「完全に閉じる」機会が少ない使い方では、
 * 開きっぱなしの画面が古い版のまま残り続けていた。
 *
 * ## ここで足したもの
 * 1. 新しい版が入ったことを検知して、画面下の帯(AppUpdateBanner)で知らせる
 * 2. 帯を押す・設定の「最新の状態にする」を押すと、その場で画面を読み込み直して即座に反映する
 *
 * ## 勝手に画面を読み込み直さない
 * `virtual:pwa-register` の registerSW は、既定では新しいService Workerが有効になった瞬間に
 * `window.location.reload()` を呼ぶ。調理中・段取り実行中・入力中にこれをやられると作業が飛ぶので、
 * `onNeedReload` を渡してその既定動作を止め、**読み込み直すタイミングは利用者のタップに委ねる**。
 * 自動で新しい版に入れ替わること自体はこれまでどおり続く(次に開き直したときに反映される)。
 *
 * ## データには触れない
 * ここで行うのは「Service Workerの更新確認」と「画面の読み込み直し」だけで、
 * IndexedDB(レシピ・価格・設定・解錠コード)には一切触れない。
 * 表示不具合の最後の手段としてSW/キャッシュを消す機能は別にある(src/logic/appRefresh.ts)。
 */

/** 設定の「最新の状態にする」を押したときの結果 */
export type AppUpdateCheckResult =
  /** 新しい版が見つかった(このあと画面を読み込み直せば反映される) */
  | 'found'
  /** すでに最新だった */
  | 'latest'
  /** オフラインで確認できない */
  | 'offline'
  /** Service Workerが使えない環境(開発サーバー・非対応ブラウザ) */
  | 'unavailable'
  /** 通信や取得に失敗した */
  | 'failed'

/** 新しい版が入ったかどうかを見に行く間隔(1時間)。復帰時の確認にも同じ間隔を使う */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/** 新しいService Workerが有効になるのを待つときの上限(20秒) */
const ACTIVATION_TIMEOUT_MS = 20000

let started = false
let registration: ServiceWorkerRegistration | undefined
let updateReady = false
let bannerDismissed = false
let lastCheckAt = 0
let reloading = false
const listeners = new Set<() => void>()

function notifyUpdateChanged(): void {
  for (const listener of listeners) listener()
}

/** 新しい版が入っていて、あとは画面を読み込み直すだけの状態か */
export function isAppUpdateReady(): boolean {
  return updateReady
}

/** 更新のお知らせの帯を、このセッションでは閉じたか */
export function isAppUpdateBannerDismissed(): boolean {
  return bannerDismissed
}

/**
 * 更新のお知らせの帯を閉じる。同じセッションの間は二度と出さない
 * (アプリを開き直すと、まだ読み込み直していなければまた出る)。
 * 閉じたあとも設定の「最新の状態にする」からいつでも反映できる。
 */
export function dismissAppUpdateBanner(): void {
  if (bannerDismissed) return
  bannerDismissed = true
  notifyUpdateChanged()
}

/** 状態が変わったときに呼ばれる購読を登録する。戻り値を呼ぶと解除する */
export function subscribeAppUpdate(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function markUpdateReady(): void {
  if (updateReady) return
  updateReady = true
  notifyUpdateChanged()
}

/**
 * アプリ起動時に1回だけ呼ぶ。Service Workerを登録し、新しい版が入ったら知らせる。
 * 2回目以降の呼び出しは何もしない(React StrictModeの二重実行対策も兼ねる)。
 */
export function startAppUpdateWatch(): void {
  if (started) return
  started = true
  lastCheckAt = Date.now()

  // 起動時点でService Workerが画面を制御していたか。
  // 初回訪問(制御なし)のclientsClaimでもcontrollerchangeは起きるので、
  // 「入れ替わった」と「初めて入った」を取り違えないために覚えておく。
  const hadController =
    typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller

  registerSW({
    // 既定の「有効になった瞬間に画面を読み込み直す」を止めて、帯でのお知らせに差し替える
    onNeedReload() {
      markUpdateReady()
    },
    onRegisteredSW(_swScriptUrl, swRegistration) {
      registration = swRegistration
      watchForUpdates()
    },
    onRegisterError() {
      // 登録できない環境(非対応ブラウザ・開発サーバー)では更新の確認自体を行わない
    },
  })

  // 保険の検知経路: 新しいService Workerが画面の制御を引き継いだ時点でも「新しい版が入った」と分かる。
  // vite-plugin-pwa/workboxの内部判定に依らないので、更新の確認を自分から呼んだ場合でも取りこぼさない。
  if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return
      markUpdateReady()
    })
  }
}

/** 定期的に、また画面に戻ってきたときに、新しい版が出ていないか静かに見に行く */
function watchForUpdates(): void {
  if (typeof window === 'undefined') return
  window.setInterval(() => {
    void quietCheck()
  }, CHECK_INTERVAL_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    if (Date.now() - lastCheckAt < CHECK_INTERVAL_MS) return
    void quietCheck()
  })
}

async function quietCheck(): Promise<void> {
  if (updateReady || !registration) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return
  lastCheckAt = Date.now()
  try {
    await registration.update()
  } catch {
    // 通信できないときは何もしない(次の機会に見に行く)
  }
}

/**
 * 新しいService Workerが有効になる(= 新しい版が入る)まで待つ。
 * 使えなくなった(redundant)場合と時間切れの場合は false を返す。
 */
function waitForActivation(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (activated: boolean) => {
      if (settled) return
      settled = true
      worker.removeEventListener('statechange', onStateChange)
      window.clearTimeout(timeoutId)
      resolve(activated)
    }
    const onStateChange = () => {
      if (worker.state === 'activated') finish(true)
      else if (worker.state === 'redundant') finish(false)
    }
    worker.addEventListener('statechange', onStateChange)
    const timeoutId = window.setTimeout(() => finish(false), ACTIVATION_TIMEOUT_MS)
    if (worker.state === 'activated') finish(true)
    else if (worker.state === 'redundant') finish(false)
  })
}

/**
 * 設定の「最新の状態にする」から呼ぶ。新しい版が出ていないかその場で確認する。
 * 見つかった場合は入れ替えまで済ませて 'found' を返す(画面の読み込み直しは applyAppUpdate)。
 */
export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  if (updateReady) return 'found'
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline'
  if (!registration) return 'unavailable'
  lastCheckAt = Date.now()
  try {
    await registration.update()
  } catch {
    return 'failed'
  }
  if (updateReady) return 'found'
  // update()を抜けた時点ではまだ取得・インストールの途中のことがあるので、有効になるまで待つ
  const worker = registration.installing ?? registration.waiting
  if (worker && (await waitForActivation(worker))) return 'found'
  return updateReady ? 'found' : 'latest'
}

/**
 * 新しい版を画面に反映する。新しいService Workerはすでに有効になっているので、
 * 画面を読み込み直せば新しいファイルで開き直る。
 * 二重に走らないよう1回だけ実行する。
 */
export function applyAppUpdate(): void {
  if (reloading) return
  reloading = true
  window.location.reload()
}
