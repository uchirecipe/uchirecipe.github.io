import { db } from '../db/db'

/**
 * バックアップの保存先を選ぶ／前回の場所に上書きする機能（2026-07-17バックアップ改修 修正2+3）。
 *
 * 背景: 従来の「ファイルに書き出す」はブラウザの自動ダウンロード（毎回ダウンロードフォルダに
 * 新しいファイルとして保存）任せだった。File System Access API対応ブラウザ（Chrome/Edge等）
 * では、保存先を選べるようにし、次回以降は選んだ場所へワンタップで上書きできるようにする。
 * 非対応ブラウザ（Safari/Firefox）は従来どおりの自動ダウンロードのままにする
 * （呼び出し側のsupportsSaveFilePicker()の分岐に従う。このファイル自体はDOM側APIが
 * 存在しない環境で呼ばれない前提で、存在チェックは呼び出し側の責務とする）。
 *
 * 保存先ハンドル（FileSystemFileHandle）はJSON化できないため、バックアップ本体とは別に
 * IndexedDBの専用テーブル（db.fileHandles）へオブジェクトのままstructured cloneで保存する。
 */

const HANDLE_ID = 1

/** File System Access API（保存先選択・上書き）に対応しているブラウザか（Chrome/Edge等） */
export function supportsSaveFilePicker(): boolean {
  // navigator.webdriver(自動テスト環境)ではピッカーを使わない: headless Chromiumは
  // showSaveFilePickerが例外も投げずに応答しないことがあり(BACKUP-01で実測)、
  // フォールバックにも到達できない。自動化環境では常に従来の自動ダウンロード経路にする
  // (実ユーザーには影響なし。ピッカーUI自体は自動テストで検証不能なため方針として妥当)
  // ただしe2eが偽ピッカーを注入して明示フラグを立てた場合は有効化する(FILESAVE-01が
  // ピッカー経路のUI分岐を検証するため。フラグ無しの自動化=通常のe2eは常にDL経路)
  const forced =
    typeof window !== 'undefined' &&
    (window as unknown as { __e2eForceFilePicker?: boolean }).__e2eForceFilePicker === true
  if (typeof navigator !== 'undefined' && navigator.webdriver && !forced) return false
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function'
}

/** バックアップファイルの既定ファイル名（書き出し日基準。exportBackupのJSON本体とは独立） */
export function backupFileName(date: Date = new Date()): string {
  const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  return `uchi-recipe-backup-${stamp}.json`
}

/** キャンセル（ユーザーがピッカーを閉じた）ことを示すDOMExceptionか */
export function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

async function writeJsonToHandle(handle: FileSystemFileHandle, json: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(json)
  await writable.close()
}

async function rememberHandle(handle: FileSystemFileHandle): Promise<void> {
  await db.fileHandles.put({ id: HANDLE_ID, handle, savedAt: Date.now() })
}

/** 前回選んだ保存先ハンドルの記録があるか（「前回の場所に上書き」ボタンの表示判定に使う） */
export async function hasSavedFileHandle(): Promise<boolean> {
  return (await db.fileHandles.get(HANDLE_ID)) !== undefined
}

/**
 * 保存先を選んでファイルに書き込む。選んだ場所は次回の「前回の場所に上書き」用に記録する。
 * ユーザーがピッカーをキャンセルするとAbortErrorを投げる（呼び出し側はisAbortErrorで判定し、
 * 何も起きなかった扱い＝エラー表示しない）
 */
export async function saveWithPicker(json: string, suggestedName: string): Promise<void> {
  const handle = await window.showSaveFilePicker!({
    suggestedName,
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
  })
  await writeJsonToHandle(handle, json)
  await rememberHandle(handle)
}

/**
 * 前回選んだ場所に上書き保存する。書き込み権限を確認(requestPermission)し、
 * 許可されなければ例外を投げる。記録が無い場合も例外を投げる。
 * 呼び出し側は失敗時に saveWithPicker（保存先選択）へフォールバックすること
 * （拒否・ファイル移動/削除などによるハンドル失効の両方をこの1つの例外経路でカバーする）
 */
export async function overwriteSavedFile(json: string): Promise<void> {
  const record = await db.fileHandles.get(HANDLE_ID)
  if (!record) throw new Error('no saved file handle')
  const permission = await record.handle.requestPermission({ mode: 'readwrite' })
  if (permission !== 'granted') throw new Error('permission not granted')
  await writeJsonToHandle(record.handle, json)
  await rememberHandle(record.handle) // savedAtを更新
}
