import { useEffect, useState } from 'react'
import {
  Plus,
  Refrigerator,
  ChevronUp,
  ChevronDown,
  ListChecks,
  CheckCircle2,
  HelpCircle,
} from 'lucide-react'
import {
  usePantryItems,
  addFrequentIngredient,
  cyclePantryLevel,
  removePantryItems,
  setPantryItemsLevel,
  setPantryItemsGroup,
  setPantryItemNote,
  PANTRY_NOTE_MAX_LENGTH,
} from '../db/pantry'
import type { PantryGroupKey, PantryLevel } from '../db/types'
import { PANTRY_GROUP_ORDER, groupPantryItems } from '../logic/pantryGroups'
import { splitValues } from '../logic/textSplit'
import { isImeConfirmKey } from '../logic/imeKey'
import { ja } from '../i18n/ja'
import Toast from './Toast'

/** 整理モードの「まとめて状態設定」3ボタンの並び順(ある→少ない→ない) */
const BULK_SET_LEVELS: PantryLevel[] = ['have', 'low', 'none']

/** 3段階それぞれの見た目（デザイントークンのみ使用。新しい色相は増やさない） */
function levelClass(level: PantryLevel): string {
  if (level === 'have') return 'border-accent bg-accent text-on-accent'
  if (level === 'low') return 'border-accent text-accent-ink bg-app'
  return 'border-edge text-ink-muted bg-surface'
}

/**
 * 在庫ボード: よく使う食材をチップで並べ、タップで「ある→少ない→ない」を切り替える。
 * 数量は数えないので、棚卸しは数秒で終わる。
 * チップは通常表示・整理モードのどちらでも大分類グループ(肉・魚介／野菜・きのこ …)ごとに
 * まとめて並べる(2026-07-23 #1／2026-07-24 実機FB #5: 整理モードでもグループ表示を維持)。
 * 振り分けの情報源は栄養データベース=logic/pantryGroups。
 * 「整理」モード中はチップをタップで複数選択→一括削除／「ある」「少ない」「ない」の一括状態設定／
 * 大分類グループへの一括移動(手動グループ変更・#1)ができ、全選択・選択解除もできる。
 * 一括操作(状態設定・グループ移動・削除)はいずれも適用後も整理モードを維持し、選択だけ解除する
 * (2026-07-24 補足#16: 削除後も整理を抜けないように統一。途中で中断されると連続で片づけられないため)。
 * グループ表示化で並び順がグループ主体になったため、手動並び替えUIは廃止した(2026-07-24 実機FB #6)。
 */
export default function PantryBoard() {
  const items = usePantryItems()
  const [text, setText] = useState('')
  const [organizing, setOrganizing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  // 説明文の折りたたみ(2026-07-16 UI総点検B-5)。既定は閉。他の折りたたみ同様、
  // 永続化はしない軽量実装(オーナー決定: 実装が軽い方でよい)
  const [showDescription, setShowDescription] = useState(false)
  // 在庫チップの一言メモ(2026-07-29 便CC/C8)。整理モードで1件だけ選んだときに編集する。
  // チップ内に編集ボタンは置かない(2026-07-16 B-10で誤操作の元として廃止済みのため)
  const [noteDraft, setNoteDraft] = useState('')

  // 全削除で0件になったら整理モードを自動で抜ける(2026-07-29 便CC/C5・QA S2)。
  // 0件だと見出し横の「完了」ボタンが消える一方で整理モードは続くため、画面上に抜ける手段が
  // 無くなっていた(残るのはdisabledの一括操作パネルと「タップして選択」だけ)
  useEffect(() => {
    if (organizing && items?.length === 0) {
      setOrganizing(false)
      setSelectedIds([])
    }
  }, [organizing, items])

  // 選択が「1件だけ」になったら、その食材の現在のメモを編集欄に読み込む
  const singleSelected =
    selectedIds.length === 1 ? (items ?? []).find((item) => item.id === selectedIds[0]) : undefined
  useEffect(() => {
    setNoteDraft(singleSelected?.note ?? '')
  }, [singleSelected?.id, singleSelected?.note])

  const saveNote = async () => {
    if (!singleSelected?.id) return
    const trimmed = noteDraft.trim()
    await setPantryItemNote(singleSelected.id, trimmed)
    setMessage(trimmed ? ja.pantry.organizeNoteSavedToast : ja.pantry.organizeNoteClearedToast)
  }

  const toggleOrganizing = () => {
    setOrganizing((v) => !v)
    setSelectedIds([])
  }
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }
  const selectAll = () => setSelectedIds((items ?? []).map((item) => item.id!))
  const clearSelection = () => setSelectedIds([])
  // 一括削除。他の一括操作(状態設定・グループ移動)と同じく、実行後も整理モードは維持し
  // 選択だけ解除する(2026-07-24 補足#16。片づけの途中で中断されないように)
  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(ja.pantry.organizeConfirm.replace('{n}', String(selectedIds.length)))) return
    await removePantryItems(selectedIds)
    setSelectedIds([])
  }
  // まとめて状態設定(docs/35 §5 案D): 選択中の食材全部を指定の状態に一括更新する。
  // 削除と違って整理モードは維持したまま選択だけ解除する(続けて別の一括操作をしやすくするため)
  const applyBulkLevel = async (level: PantryLevel) => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    await setPantryItemsLevel(selectedIds, level)
    setSelectedIds([])
    setMessage(
      ja.pantry.organizeBulkSetToast.replace('{n}', String(count)).replace('{level}', ja.pantry.level[level]),
    )
  }
  // 大分類グループへの一括移動(2026-07-23 #1 手動グループ変更)。状態設定と同じく整理モードは維持する。
  // group が undefined のときは手動指定を消して食材名からの自動振り分けに戻す(2026-07-29 便CC/C6)
  const applyGroup = async (group: PantryGroupKey | undefined) => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    await setPantryItemsGroup(selectedIds, group)
    setSelectedIds([])
    setMessage(
      group === undefined
        ? ja.pantry.organizeGroupAutoToast.replace('{n}', String(count))
        : ja.pantry.organizeMoveGroupToast
            .replace('{n}', String(count))
            .replace('{group}', ja.pantry.group[group]),
    )
  }

  // スペース・カンマ・読点区切りで複数まとめて入力しても、それぞれ別の食材として登録する
  const add = async () => {
    const values = splitValues(text)
    for (const value of values) {
      await addFrequentIngredient(value)
    }
    setText('')
  }

  const grouped = items ? groupPantryItems(items) : []
  const allSelected = items !== undefined && items.length > 0 && selectedIds.length === items.length

  return (
    <>
    <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Refrigerator size={20} className="text-accent-ink" aria-hidden />
          {ja.pantry.title}
        </h2>
        {items && items.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={toggleOrganizing}
              aria-pressed={organizing}
              className={`inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                organizing ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
              }`}
            >
              <ListChecks size={14} aria-hidden />
              {organizing ? ja.pantry.organizeDone : ja.pantry.organizeToggle}
            </button>
          </div>
        )}
      </div>

      {/* 通常モードの「使い方」(タップで3段階を切り替える説明)。整理モード中はタップの意味が
          「選択」に変わり説明と食い違うので隠す(2026-07-24 実機FB #4)。代わりに下の
          organizeSelect(タップして選択)を出す */}
      {!organizing && (
        <>
          <button
            type="button"
            onClick={() => setShowDescription((v) => !v)}
            aria-expanded={showDescription}
            className="mt-1 inline-flex items-center gap-1 text-sm text-ink-muted"
          >
            <HelpCircle size={14} aria-hidden />
            {ja.common.usageHint}
            {showDescription ? <ChevronUp size={14} aria-hidden /> : <ChevronDown size={14} aria-hidden />}
          </button>
          {showDescription && <p className="mt-1 text-sm text-ink-muted">{ja.pantry.description}</p>}
        </>
      )}
      {organizing && <p className="mt-1 text-sm text-ink-muted">{ja.pantry.organizeSelect}</p>}

      {/* 全選択・選択解除(2026-07-23 #10 → 2026-07-24 実機FB #1: チップ列の上部へ移動。
          下までスクロールしなくても全選択できるように、案内文のすぐ下・チップの上に置く)。
          「選択した食材◯件を削除」も、この選択操作のすぐ下に置く(2026-07-24 補足#15) */}
      {organizing && items && items.length > 0 && (
        <div className="mt-[var(--space-sm)] flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={allSelected}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              {ja.pantry.organizeSelectAll}
            </button>
            <button
              type="button"
              onClick={clearSelection}
              disabled={selectedIds.length === 0}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-ink-muted shadow-sm disabled:opacity-40"
            >
              {ja.pantry.organizeClearSelection}
            </button>
          </div>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void deleteSelected()}
              className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
            >
              {ja.pantry.organizeDeleteSelected.replace('{n}', String(selectedIds.length))}
            </button>
          )}
        </div>
      )}

      {items !== undefined &&
        (items.length === 0 ? (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.pantry.empty}</p>
        ) : organizing ? (
          // 整理モードでも大分類グループごとにまとめて表示する(2026-07-24 実機FB #5)。
          // チップはタップで複数選択でき、選択の印(チェック)はチップの寸法を変えずに角へ重ねる
          // (2026-07-24 実機FB #2: 選択でサイズ・位置がズレて連打しづらい問題の対策=絶対配置で重ねる)
          <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
            {grouped.map(({ key, items: groupItems }) => (
              <div key={key}>
                <h3 className="text-sm font-bold text-ink-muted">{ja.pantry.group[key]}</h3>
                <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                  {groupItems.map((item) => {
                    const selected = selectedIds.includes(item.id!)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleSelected(item.id!)}
                        aria-pressed={selected}
                        className={`relative inline-flex items-center rounded-full border-2 py-2 px-3 text-sm font-bold shadow-sm ${
                          selected ? 'border-accent bg-accent/10 text-accent-ink' : 'border-edge bg-surface text-ink-muted'
                        }`}
                      >
                        {item.name}
                        {selected && (
                          <CheckCircle2
                            size={16}
                            className="absolute -right-1.5 -top-1.5 rounded-full bg-surface text-accent-ink"
                            aria-hidden
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          // 通常表示: 大分類グループごとにまとめてチップを並べる(2026-07-23 #1)
          <div className="mt-[var(--space-md)] flex flex-col gap-[var(--space-md)]">
            {grouped.map(({ key, items: groupItems }) => (
              <div key={key}>
                <h3 className="text-sm font-bold text-ink-muted">{ja.pantry.group[key]}</h3>
                <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
                  {groupItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void cyclePantryLevel(item.id!)}
                      className={`inline-flex items-center gap-1 rounded-full border py-2 px-3 text-sm font-bold shadow-sm ${levelClass(item.level)}`}
                    >
                      {item.name}
                      {/* メモを付けた食材のチップだけ幅が伸びる(2026-07-29 便CC/C8。2列詰めの盤面を壊さない) */}
                      <span className="ml-1 font-normal opacity-80">
                        （{ja.pantry.level[item.level]}
                        {item.note ? `・${item.note}` : ''}）
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

      {organizing && (
        <div className="mt-[var(--space-md)] flex flex-col gap-2">
          {/* まとめて状態設定(docs/35 §5 案D): 0件選択時はdisabled。スマホ幅でも崩れないよう3等分グリッド。
              「選んだ食材の在庫状況をまとめて変更」の見出しを3ボタンの上に添える
              (2026-07-24 実機FB #3・グループ移動の見出しと同様式) */}
          <p className="mt-1 text-sm text-ink-muted">{ja.pantry.organizeBulkSetTitle}</p>
          <div className="grid grid-cols-3 gap-2">
            {BULK_SET_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => void applyBulkLevel(level)}
                disabled={selectedIds.length === 0}
                className={`rounded-md border py-3 text-sm font-bold shadow-sm disabled:opacity-40 ${levelClass(level)}`}
              >
                {ja.pantry.level[level]}
              </button>
            ))}
          </div>
          {/* 大分類グループへ移動(2026-07-23 #1 手動グループ変更)。0件選択時はdisabled */}
          <p className="mt-1 text-sm text-ink-muted">{ja.pantry.organizeMoveGroupTitle}</p>
          <div className="grid grid-cols-3 gap-2">
            {PANTRY_GROUP_ORDER.map((group) => (
              <button
                key={group}
                type="button"
                onClick={() => void applyGroup(group)}
                disabled={selectedIds.length === 0}
                className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-ink-muted shadow-sm disabled:opacity-40"
              >
                {ja.pantry.group[group]}
              </button>
            ))}
            {/* 手動で移したグループを自動振り分けに戻す(2026-07-29 便CC/C6)。
                「任せる」に戻す言い方が画面に無く、一方向の操作に見えていた */}
            <button
              type="button"
              onClick={() => void applyGroup(undefined)}
              disabled={selectedIds.length === 0}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
            >
              {ja.pantry.organizeGroupAuto}
            </button>
          </div>
          {/* 移動が一方向に見えないよう、戻し方と調味料グループの副作用をここで一言添える */}
          <p className="text-xs text-ink-muted">{ja.pantry.organizeMoveGroupNote}</p>

          {/* 一言メモ(2026-07-29 便CC/C8)。1件だけ選んだときに編集できる */}
          <p className="mt-1 text-sm text-ink-muted">{ja.pantry.organizeNoteTitle}</p>
          {singleSelected ? (
            <>
              <div className="flex gap-[var(--space-sm)]">
                <input
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    // 変換確定のEnterでは保存しない(2026-08-09 便EI。レシピ登録画面と同じガード)
                    if (e.key === 'Enter' && !isImeConfirmKey(e)) {
                      e.preventDefault()
                      void saveNote()
                    }
                  }}
                  maxLength={PANTRY_NOTE_MAX_LENGTH}
                  placeholder={ja.pantry.organizeNotePlaceholder}
                  aria-label={ja.pantry.organizeNoteTitle}
                  className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
                />
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  className="shrink-0 rounded-sm border border-edge bg-surface px-3 font-bold text-accent-ink shadow-sm"
                >
                  {ja.pantry.organizeNoteSave}
                </button>
              </div>
              <p className="text-xs text-ink-muted">{ja.pantry.organizeNoteNote}</p>
            </>
          ) : (
            <p className="text-xs text-ink-muted">{ja.pantry.organizeNoteMultiHint}</p>
          )}
        </div>
      )}

      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // 変換確定のEnterでは食材を足さない(2026-08-09 便EI。レシピ登録画面と同じガード。
            // 「にんじん」を変換した時点で登録されてしまうのを止める)
            if (e.key === 'Enter' && !isImeConfirmKey(e)) {
              e.preventDefault()
              void add()
            }
          }}
          placeholder={ja.pantry.addPlaceholder}
          className="min-w-0 flex-1 rounded-sm border border-edge bg-app px-3 py-3 text-base text-ink placeholder:text-ink-muted/60"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent-ink shadow-sm"
        >
          <Plus size={18} aria-hidden />
          {ja.pantry.add}
        </button>
      </div>

      {/* 在庫欄の下部の一言(2026-07-23 #12→07-24訂正。「ざっくり3段階」という機能の性質だけを伝える。規約H: 自己卑下的な表現(おまけ等)をUI文言に使わない) */}
      <p className="mt-[var(--space-sm)] text-xs text-ink-muted">{ja.pantry.omakeNote}</p>
    </section>
    <Toast message={message} onClose={() => setMessage('')} />
    </>
  )
}
