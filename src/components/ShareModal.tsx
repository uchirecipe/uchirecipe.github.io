import { useEffect, useState } from 'react'
import { X, MessageSquareText, Image as ImageIcon } from 'lucide-react'
import { ja } from '../i18n/ja'
import type { ShareOptions } from '../logic/share'

/** モーダルで選ぶ項目(実数値はRecipeDetailPage側が詰めるので、ここでは選択フラグのみ扱う) */
export type ShareSelection = Pick<
  ShareOptions,
  'image' | 'cookMinutes' | 'cost' | 'nutrition' | 'allIngredients'
>

type Props = {
  open: boolean
  /** 調理時間のデータがあるか(無ければグレーアウト) */
  cookMinutesAvailable: boolean
  /** 原価の概算合計が0円より大きいか(0ならグレーアウト) */
  costAvailable: boolean
  /** 栄養行そのものを出すか(NUTRITION_TEASER_ENABLED=falseなら行ごと非表示) */
  nutritionRowVisible: boolean
  /** 栄養の計算対象材料が1件以上あるか(0件ならグレーアウト) */
  nutritionAvailable: boolean
  sharing: boolean
  /** コピー完了・画像生成中などの結果メッセージ(空なら非表示) */
  message: string
  onShare: (kind: 'text' | 'image', selection: ShareSelection) => void
  onClose: () => void
}

/**
 * シェアの選択式モーダル(2026-07-16 Fable裁定docs/30裁定3)。
 * 以前は詳細画面の下部にテキスト/画像カードの2ボタンをインライン展開していたが、
 * 「何を載せるか」を選べるようCookedLogModalと同じ中央カード型の窓に変更。
 * 固定=料理名・人数分・材料先頭8件(文言のみ)。任意=レシピ画像(画像カード専用・※併記)/
 * 調理時間/原価/栄養(カロリー・塩分のめやす)/材料すべて。
 * データが無い項目はdisabled+opacity-40で行は見せたまま選べなくする。
 * 選択は開くたびに既定値へ初期化し、永続化しない(裁定3)。
 */
export default function ShareModal({
  open,
  cookMinutesAvailable,
  costAvailable,
  nutritionRowVisible,
  nutritionAvailable,
  sharing,
  message,
  onShare,
  onClose,
}: Props) {
  const [image, setImage] = useState(true)
  const [cookMinutes, setCookMinutes] = useState(false)
  const [cost, setCost] = useState(false)
  const [nutrition, setNutrition] = useState(false)
  const [allIngredients, setAllIngredients] = useState(false)

  // 既定値(開くたび初期化・永続化しない): 画像ON・調理時間ON(あれば)・原価OFF・栄養OFF・材料全部OFF
  useEffect(() => {
    if (!open) return
    setImage(true)
    setCookMinutes(cookMinutesAvailable)
    setCost(false)
    setNutrition(false)
    setAllIngredients(false)
  }, [open, cookMinutesAvailable])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const selection: ShareSelection = { image, cookMinutes, cost, nutrition, allIngredients }

  const optionRow = (
    label: string,
    checked: boolean,
    onChange: (value: boolean) => void,
    options?: { disabled?: boolean; note?: string },
  ) => (
    <label
      className={`flex items-start gap-2 py-1.5 ${options?.disabled ? 'opacity-40' : ''}`}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={options?.disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 text-sm">
        {label}
        {options?.note && <span className="ml-1 text-xs text-ink-muted">{options.note}</span>}
      </span>
    </label>
  )

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-[var(--space-md)]"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-label={ja.share.dialogTitle}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-sm min-w-0 overflow-y-auto rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-md"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold">{ja.share.dialogTitle}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label={ja.common.close}
            className="-mr-2 -mt-1 shrink-0 rounded-full p-2 text-ink-muted"
          >
            <X size={20} aria-hidden />
          </button>
        </div>

        {/* 固定項目(チェックなし・文言のみ) */}
        <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.share.alwaysIncluded}</p>

        <div className="mt-[var(--space-sm)]">
          {optionRow(ja.share.optImage, image, setImage, { note: ja.share.optImageCardOnly })}
          {optionRow(ja.share.optCookMinutes, cookMinutes, setCookMinutes, {
            disabled: !cookMinutesAvailable,
          })}
          {optionRow(ja.share.optCost, cost, setCost, { disabled: !costAvailable })}
          {nutritionRowVisible &&
            optionRow(ja.share.optNutrition, nutrition, setNutrition, {
              disabled: !nutritionAvailable,
            })}
          {optionRow(ja.share.optAllIngredients, allIngredients, setAllIngredients)}
        </div>

        <div className="mt-[var(--space-md)] flex gap-2">
          <button
            type="button"
            disabled={sharing}
            onClick={() => onShare('text', selection)}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 text-sm font-bold text-accent shadow-sm disabled:opacity-60"
          >
            <MessageSquareText size={20} aria-hidden />
            {ja.share.textOption}
          </button>
          <button
            type="button"
            disabled={sharing}
            onClick={() => onShare('image', selection)}
            className="flex flex-1 items-center justify-center gap-2 rounded-md border border-edge bg-surface py-3 text-sm font-bold text-accent shadow-sm disabled:opacity-60"
          >
            <ImageIcon size={20} aria-hidden />
            {ja.share.imageOption}
          </button>
        </div>
        {message && (
          <p className="mt-[var(--space-sm)] text-sm font-bold text-accent">{message}</p>
        )}
      </div>
    </div>
  )
}
