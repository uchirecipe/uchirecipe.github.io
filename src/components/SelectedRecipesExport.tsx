import { useState } from 'react'
import { Download } from 'lucide-react'
import { ja } from '../i18n/ja'
import {
  exportSelectedRecipes,
  buildSelectedRecipesExportConfirm,
  type SelectedRecipesExportConfirm,
} from '../logic/backup'
import {
  supportsSaveFilePicker,
  saveJsonWithPicker,
  downloadJson,
  isAbortError,
  selectedRecipesFileName,
} from '../logic/fileSave'
import ConfirmDialog from './ConfirmDialog'

/**
 * 選んだレシピだけをファイルに書き出す（2026-08-09 便EM → 2026-08-15 便GVで全体を切り出し）。
 *
 * 書式は全体のバックアップと同じで、読み込みも設定の「バックアップを読み込む」を使う
 * （新しい読み込み口は作らない）。バックアップの「前回の場所に上書き」の行き先は塗り替えない
 * （saveJsonWithPicker）。「最終バックアップ」の日時も更新しない＝全体のバックアップを
 * 取ったことにはしない。実行しても端末のレシピは1品も減らない。
 *
 * 押してから保存までの順番（2026-08-15 便GV。オーナー実機「どこに保存するのか選べるようにして。
 * バックアップファイルと同じように」への対応）:
 *   ①押す → ②書き出すデータを作る → ③確認の窓（大きさ・保存先つき）→ ④保存先を選ぶ画面
 * 確認より先にデータを作るのは、**実測の大きさ**を確認に出すため。
 * そして保存先を選ぶ画面（showSaveFilePicker）は**確認の窓の「書き出す」を押した直後**に呼ぶ。
 * 以前は素の確認のあとにデータ作り（写真のBase64化。品数が多いと時間がかかる）を挟んでいて、
 * その間に「利用者の操作の直後」という扱いが切れると保存先を選ぶ画面が開けず、
 * 例外の受け皿から自動ダウンロードへ落ちていた＝黙ってダウンロードに入るように見えていた。
 *
 * 保存先を選べるのは File System Access API に対応した端末（Chrome/Edge等）だけで、
 * iPhone・iPad・Firefox 等は従来どおり自動ダウンロード。確認の窓の「保存先」の行も
 * その判定で言い分ける（対応していない端末で「選べます」と書かない）。
 */
export default function SelectedRecipesExport({
  selectedIds,
  totalCount,
  onMessage,
}: {
  selectedIds: number[]
  /** 端末に入っているレシピの総数（「選んでいないレシピ◯品」の計算に使う） */
  totalCount: number
  onMessage: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  // 確認の窓に出す中身と、確認が通ったときに書き込む中身。窓を開く前に作っておく
  const [pending, setPending] = useState<{
    json: string
    count: number
    canPickLocation: boolean
    confirm: SelectedRecipesExportConfirm
  }>()

  const prepare = async () => {
    if (selectedIds.length === 0 || busy) return
    setBusy(true)
    try {
      const { json, count } = await exportSelectedRecipes(selectedIds)
      if (count === 0) {
        onMessage(ja.recipes.exportSelectedError)
        return
      }
      const canPickLocation = supportsSaveFilePicker()
      setPending({
        json,
        count,
        canPickLocation,
        confirm: buildSelectedRecipesExportConfirm({
          selected: count,
          remaining: Math.max(0, totalCount - count),
          // 見積りではなく、いま作ったデータそのものの大きさ（UTF-8のバイト数）
          bytes: new Blob([json]).size,
          canPickLocation,
        }),
      })
    } catch {
      onMessage(ja.recipes.exportSelectedError)
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!pending) return
    const { json, count, canPickLocation } = pending
    setPending(undefined)
    setBusy(true)
    try {
      const name = selectedRecipesFileName()
      let picked = false
      if (canPickLocation) {
        try {
          await saveJsonWithPicker(json, name)
          picked = true
        } catch (err) {
          if (isAbortError(err)) return // 保存先選択を閉じた: 何も起きなかった扱い
          downloadJson(json, name) // 権限拒否・ピッカーが使えない環境はダウンロードへ切り替える
        }
      } else {
        downloadJson(json, name)
      }
      onMessage(
        (picked
          ? ja.recipes.exportSelectedDonePicked
          : ja.recipes.exportSelectedDoneDownloaded
        ).replace('{r}', String(count)),
      )
    } catch {
      onMessage(ja.recipes.exportSelectedError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void prepare()}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm disabled:opacity-40"
      >
        <Download size={16} aria-hidden />
        {ja.recipes.exportSelected.replace('{r}', String(selectedIds.length))}
      </button>
      <ConfirmDialog
        open={pending !== undefined}
        title={pending?.confirm.title ?? ''}
        body=""
        bullets={pending?.confirm.bullets}
        notes={pending?.confirm.notes}
        confirmLabel={ja.recipes.exportSelectedConfirmOk}
        cancelLabel={ja.recipes.exportSelectedConfirmCancel}
        testId="recipes-export-confirm"
        onConfirm={() => void save()}
        onCancel={() => setPending(undefined)}
      />
    </>
  )
}
