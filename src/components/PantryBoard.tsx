import { useState } from 'react'
import {
  Plus,
  Refrigerator,
  ArrowUpDown,
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
  movePantryItem,
} from '../db/pantry'
import type { PantryGroupKey, PantryLevel } from '../db/types'
import { PANTRY_GROUP_ORDER, groupPantryItems } from '../logic/pantryGroups'
import { splitValues } from '../logic/textSplit'
import { ja } from '../i18n/ja'
import Toast from './Toast'

/** 整理モードの「まとめて状態設定」3ボタンの並び順(ある→少ない→ない) */
const BULK_SET_LEVELS: PantryLevel[] = ['have', 'low', 'none']

/** 3段階それぞれの見た目（デザイントークンのみ使用。新しい色相は増やさない） */
function levelClass(level: PantryLevel): string {
  if (level === 'have') return 'border-accent bg-accent text-on-accent'
  if (level === 'low') return 'border-accent text-accent bg-app'
  return 'border-edge text-ink-muted bg-surface'
}

/**
 * 在庫ボード: よく使う食材をチップで並べ、タップで「ある→少ない→ない」を切り替える。
 * 数量は数えないので、棚卸しは数秒で終わる。
 * 通常表示では大分類グループ(肉・魚介／野菜・きのこ …)ごとにチップをまとめる
 * (2026-07-23 オーナー実機FB #1。振り分けの情報源は栄養データベース=logic/pantryGroups)。
 * 「並び替え」モード中は縦一列にして矢印ボタンで手動並び替えできる。
 * 「整理」モード中はチップをタップで複数選択→一括削除／「ある」「少ない」「ない」の一括状態設定／
 * 大分類グループへの一括移動(手動グループ変更・#1)ができ、全選択・選択解除もできる(#10)。
 * まとめて状態設定・グループ移動は適用後も整理モードを維持し選択だけ解除する
 * (削除は整理モードごと抜ける。用途が違うため意図的に挙動を分けている)。
 */
export default function PantryBoard() {
  const items = usePantryItems()
  const [text, setText] = useState('')
  const [reordering, setReordering] = useState(false)
  const [organizing, setOrganizing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [message, setMessage] = useState('')
  // 説明文の折りたたみ(2026-07-16 UI総点検B-5)。既定は閉。他の折りたたみ同様、
  // 永続化はしない軽量実装(オーナー決定: 実装が軽い方でよい)
  const [showDescription, setShowDescription] = useState(false)

  const toggleReordering = () => {
    setReordering((v) => !v)
    setOrganizing(false)
    setSelectedIds([])
  }
  const toggleOrganizing = () => {
    setOrganizing((v) => !v)
    setReordering(false)
    setSelectedIds([])
  }
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]))
  }
  const selectAll = () => setSelectedIds((items ?? []).map((item) => item.id!))
  const clearSelection = () => setSelectedIds([])
  const deleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(ja.pantry.organizeConfirm.replace('{n}', String(selectedIds.length)))) return
    await removePantryItems(selectedIds)
    setSelectedIds([])
    setOrganizing(false)
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
  // 大分類グループへの一括移動(2026-07-23 #1 手動グループ変更)。状態設定と同じく整理モードは維持する
  const applyGroup = async (group: PantryGroupKey) => {
    if (selectedIds.length === 0) return
    const count = selectedIds.length
    await setPantryItemsGroup(selectedIds, group)
    setSelectedIds([])
    setMessage(
      ja.pantry.organizeMoveGroupToast
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

  return (
    <>
    <section className="mt-[var(--space-md)] rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-bold">
          <Refrigerator size={20} className="text-accent" aria-hidden />
          {ja.pantry.title}
        </h2>
        {items && items.length > 0 && (
          <div className="flex shrink-0 items-center gap-1">
            {items.length > 1 && (
              <button
                type="button"
                onClick={toggleReordering}
                aria-pressed={reordering}
                className={`inline-flex items-center gap-1 rounded-sm border px-3 py-2 text-sm font-bold ${
                  reordering ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
                }`}
              >
                <ArrowUpDown size={14} aria-hidden />
                {reordering ? ja.pantry.reorderDone : ja.pantry.reorderToggle}
              </button>
            )}
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
      {organizing && <p className="mt-1 text-sm text-ink-muted">{ja.pantry.organizeSelect}</p>}

      {items !== undefined &&
        (items.length === 0 ? (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.pantry.empty}</p>
        ) : reordering ? (
          <ul className="mt-[var(--space-md)] divide-y divide-edge rounded-md border border-edge bg-app">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-1 px-[var(--space-sm)] py-2">
                <span className="min-w-0 flex-1 truncate font-bold">{item.name}</span>
                <button
                  type="button"
                  onClick={() => void movePantryItem(items, index, -1)}
                  disabled={index === 0}
                  aria-label={ja.form.moveUp}
                  className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                >
                  <ChevronUp size={18} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void movePantryItem(items, index, 1)}
                  disabled={index === items.length - 1}
                  aria-label={ja.form.moveDown}
                  className="rounded-full p-2 text-ink-muted disabled:opacity-30"
                >
                  <ChevronDown size={18} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : organizing ? (
          // 整理モードは全食材をフラットなグリッドで出す(グループをまたいで一括選択したいため)
          <div className="mt-[var(--space-md)] flex flex-wrap gap-[var(--space-sm)]">
            {items.map((item) => {
              const selected = selectedIds.includes(item.id!)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSelected(item.id!)}
                  aria-pressed={selected}
                  className={`inline-flex items-center gap-1 rounded-full border-2 py-2 px-3 text-sm font-bold shadow-sm ${
                    selected ? 'border-accent bg-accent/10 text-accent' : 'border-edge bg-surface text-ink-muted'
                  }`}
                >
                  {selected && <CheckCircle2 size={16} aria-hidden />}
                  {item.name}
                </button>
              )
            })}
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
                      <span className="ml-1 font-normal opacity-80">（{ja.pantry.level[item.level]}）</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}

      {organizing && (
        <div className="mt-[var(--space-md)] flex flex-col gap-2">
          {/* 全選択・選択解除(2026-07-23 #10) */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={items !== undefined && selectedIds.length === items.length}
              className="rounded-md border border-edge bg-surface py-2 text-sm font-bold text-accent shadow-sm disabled:opacity-40"
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
          {/* まとめて状態設定(docs/35 §5 案D): 0件選択時はdisabled。スマホ幅でも崩れないよう3等分グリッド */}
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
          </div>
          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void deleteSelected()}
              className="w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent shadow-sm"
            >
              {ja.pantry.organizeDeleteSelected.replace('{n}', String(selectedIds.length))}
            </button>
          )}
        </div>
      )}

      <div className="mt-[var(--space-md)] flex gap-[var(--space-sm)]">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
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
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-edge bg-surface px-3 font-bold text-accent shadow-sm"
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
