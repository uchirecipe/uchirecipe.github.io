/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import ConfirmDialog from './ConfirmDialog'
import type { ConfirmContent } from '../logic/confirmContent'
import { ja } from '../i18n/ja'

/**
 * 確認の窓をアプリ全体で1つの見た目にそろえるための土台（2026-08-15 便GW）。
 *
 * なぜ要るか（オーナー原文「アプリ全体に、確認などで表示される窓が見づらく、見ていて
 * 楽しくなる画面じゃない。事実を的確に伝えるのも重要。見やすさも重要」／利用者テスト
 * 「アプリの中で急に素のポップアップが出るのは違和感があります」）:
 * ブラウザの素のダイアログ（window.confirm）は**ただの文字しか出せない**ので、
 * 見出し・太字の項目・小さめの補足を作れない。置き換えないと上の要望は満たせない。
 *
 * 窓そのものは 2026-08-14 便GL の `ConfirmDialog`（便GVが bullets／notes を追加）を
 * **そのまま**使う。新しい見た目は作らない。ここが足すのは「呼び方」だけ:
 *
 *   const confirm = useConfirm()
 *   if (!(await confirm({ title, body, bullets, notes, confirmLabel }))) return
 *
 * `window.confirm` と同じ1行の形で書けるので、置き換えで処理の流れが変わらない
 * （＝取り違えの事故が起きにくい）。返事は Promise で、確認なら true・やめるなら false。
 *
 * 「押した直後」を保てること: 窓の「確認」ボタンの onClick の中で resolve するので、
 * 続きの処理は**同じクリックの中**で走る。ファイル選択（input.click）や保存先を選ぶ画面
 * （showSaveFilePicker）は「利用者の操作の直後」でないと開けないブラウザがあるため、
 * この性質が要る（便GVが SelectedRecipesExport で踏んだ落とし穴と同じもの）。
 *
 * 窓は1度に1つだけ。前の窓が残ったまま次を頼まれたら、前の窓は「やめる」で閉じた扱いにする
 * （待っている側が永久に返事を受け取れない状態を作らない）。
 *
 * 目印（data-testid）は既定で `confirm` に固定してある。窓は1度に1つなので、
 * どの操作の確認でも e2e は同じ目印（`confirm-ok` / `confirm-cancel`）で押せる。
 */

export interface ConfirmRequest extends ConfirmContent {
  cancelLabel?: string
  /** 目印を変えたいときだけ渡す（既定は `confirm`） */
  testId?: string
}

type AskConfirm = (request: ConfirmRequest) => Promise<boolean>

const ConfirmContext = createContext<AskConfirm>(() => Promise.resolve(false))

/** 確認の窓を出して、返事（確認=true／やめる=false）を待つ */
export function useConfirm(): AskConfirm {
  return useContext(ConfirmContext)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest>()
  const resolveRef = useRef<((ok: boolean) => void) | undefined>(undefined)

  const ask = useCallback<AskConfirm>((next) => {
    // 前の窓が残っていたら「やめる」で閉じた扱いにする（返事を待ったまま止まらないように）
    resolveRef.current?.(false)
    resolveRef.current = undefined
    setRequest(next)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const close = useCallback((ok: boolean) => {
    const resolve = resolveRef.current
    resolveRef.current = undefined
    setRequest(undefined)
    // resolve は同期で呼ぶ（続きの処理を同じクリックの中で走らせるため。上のコメント参照）
    resolve?.(ok)
  }, [])

  return (
    <ConfirmContext.Provider value={ask}>
      {children}
      <ConfirmDialog
        open={request !== undefined}
        title={request?.title ?? ''}
        body={request?.body ?? ''}
        bullets={request?.bullets}
        notes={request?.notes}
        confirmLabel={request?.confirmLabel ?? ja.common.confirmOk}
        cancelLabel={request?.cancelLabel ?? ja.common.confirmCancel}
        testId={request?.testId ?? 'confirm'}
        onConfirm={() => close(true)}
        onCancel={() => close(false)}
      />
    </ConfirmContext.Provider>
  )
}
