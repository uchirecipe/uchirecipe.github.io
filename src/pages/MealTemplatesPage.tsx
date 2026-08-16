import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Search, Trash2, X } from 'lucide-react'
import { listRecipes } from '../db/recipes'
import { useSettings } from '../db/settings'
import {
  useMealTemplates,
  renameMealTemplate,
  updateMealTemplateItems,
  deleteMealTemplate,
} from '../db/mealTemplates'
import {
  groupTemplateItems,
  removeTemplateItemAt,
  replaceTemplateItemRecipe,
  TEMPLATE_NAME_MAX_LENGTH,
} from '../logic/mealTemplate'
import { searchRecipes } from '../logic/search'
import BackHeader from '../components/BackHeader'
import Toast from '../components/Toast'
import { useOverlayDismiss } from '../components/useOverlayDismiss'
import { useConfirm } from '../components/ConfirmProvider'
import type { MealTemplate, Recipe } from '../db/types'
import { ja } from '../i18n/ja'

/**
 * 献立テンプレの中身を見る・直す画面（2026-08-02 便DE-9・オーナー指示）。
 *
 * 【置き場所の判断】設定ではなく献立（週タブ）からの遷移にした。テンプレを作るのも使うのも
 * 献立の画面で、直す場所だけ設定の奥にあると探せないため。設定画面は1本スクロールで既に長い。
 *
 * 【できること】名前の変更／1品ずつのレシピ差し替え／1品ずつの取り外し／テンプレごと削除。
 * どれも雛形だけを直す操作で、すでに献立へ入れた予定・作った記録には一切触らない。
 * 「どう直すか」の判断は純ロジック（logic/mealTemplate.ts）に置き、この画面は書き込むだけ。
 */
export default function MealTemplatesPage() {
  const confirm = useConfirm()
  const templates = useMealTemplates()
  const recipes = useLiveQuery(listRecipes, [])
  const settings = useSettings()
  const [message, setMessage] = useState('')
  /** レシピ差し替えの対象（テンプレのidと、そのテンプレの中身での位置） */
  const [replaceTarget, setReplaceTarget] = useState<{
    templateId: number
    index: number
    currentTitle: string
  } | null>(null)
  const [pickerQuery, setPickerQuery] = useState('')

  const recipeById = useMemo(() => {
    const map = new Map<number, Recipe>()
    ;(recipes ?? []).forEach((r) => map.set(r.id!, r))
    return map
  }, [recipes])

  // 差し替えのピッカーは「一覧に出す対象」と同じ絞り込み（基本レシピを隠す設定を尊重する）
  const visibleRecipes = useMemo(() => {
    if (!recipes) return []
    return settings?.hideStarters ? recipes.filter((r) => !r.isStarter) : recipes
  }, [recipes, settings?.hideStarters])
  const pickerResults = useMemo(
    () =>
      searchRecipes(visibleRecipes, {
        query: pickerQuery,
        ingredients: '',
        time: 'all',
        effort: 'all',
        tag: 'all',
        favoriteOnly: false,
        excludeNg: false,
        quickOnly: false,
        ngIngredients: settings?.ngIngredients ?? [],
      }).map((r) => r.recipe),
    [visibleRecipes, pickerQuery, settings?.ngIngredients],
  )

  useOverlayDismiss(replaceTarget != null, () => setReplaceTarget(null))

  const saveName = async (template: MealTemplate, name: string) => {
    const trimmed = name.trim()
    if (trimmed === '') {
      setMessage(ja.mealTemplates.nameRequired)
      return
    }
    await renameMealTemplate(template.id!, trimmed)
    setMessage(ja.mealTemplates.nameSaved.replace('{name}', trimmed))
  }

  const removeItem = async (template: MealTemplate, index: number, title: string) => {
    const ok = await confirm({
      title: ja.mealTemplates.removeConfirmTitle
        .replace('{name}', template.name)
        .replace('{title}', title),
      body: ja.mealTemplates.removeConfirm,
      confirmLabel: ja.mealTemplates.removeConfirmOk,
    })
    if (!ok) return
    await updateMealTemplateItems(template.id!, removeTemplateItemAt(template.items, index))
    setMessage(
      ja.mealTemplates.removeDone.replace('{name}', template.name).replace('{title}', title),
    )
  }

  const pickReplacement = async (recipeId: number) => {
    if (!replaceTarget) return
    const template = (templates ?? []).find((t) => t.id === replaceTarget.templateId)
    if (!template) return
    await updateMealTemplateItems(
      template.id!,
      replaceTemplateItemRecipe(template.items, replaceTarget.index, recipeId),
    )
    setMessage(
      ja.mealTemplates.replaceDone
        .replace('{from}', replaceTarget.currentTitle)
        .replace('{to}', recipeById.get(recipeId)?.title ?? ''),
    )
    setReplaceTarget(null)
  }

  const removeTemplate = async (template: MealTemplate) => {
    const ok = await confirm({
      title: ja.mealPlan.templateDeleteConfirmTitle
        .replace('{name}', template.name)
        .replace('{n}', String(template.items.length)),
      body: ja.mealPlan.templateDeleteConfirm,
      confirmLabel: ja.mealPlan.templateDeleteConfirmOk,
    })
    if (!ok) return
    await deleteMealTemplate(template.id!)
    setMessage(ja.mealPlan.templateDeleteDone.replace('{name}', template.name))
  }

  return (
    <div className="mx-auto w-full max-w-md pb-[var(--space-lg)]">
      {/* 戻るは呼び出し元の「週」タブへ返す（2026-08-02 便DE-11と同じ作法） */}
      <BackHeader fallback="/meal-plan?focus=week" alwaysFallback title={ja.mealTemplates.title} />

      <div className="px-[var(--space-md)] pt-[var(--space-md)]">
        <p className="text-sm text-ink-muted">{ja.mealTemplates.description}</p>

        {(templates?.length ?? 0) === 0 ? (
          <p className="mt-[var(--space-md)] text-sm text-ink-muted">{ja.mealTemplates.empty}</p>
        ) : (
          <div className="mt-[var(--space-md)] space-y-[var(--space-md)]">
            {(templates ?? []).map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                recipeById={recipeById}
                onSaveName={(name) => void saveName(template, name)}
                onReplace={(index, currentTitle) =>
                  setReplaceTarget({ templateId: template.id!, index, currentTitle })
                }
                onRemoveItem={(index, title) => void removeItem(template, index, title)}
                onDelete={() => void removeTemplate(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* レシピの差し替えピッカー（献立タブのピッカーと同じ全画面の形） */}
      {replaceTarget && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-app">
          <div className="flex items-center justify-between px-[var(--space-md)] py-[var(--space-sm)]">
            <h2 className="text-lg font-bold">{ja.mealPlan.pickTitle}</h2>
            <button
              type="button"
              onClick={() => setReplaceTarget(null)}
              aria-label={ja.common.close}
              className="rounded-full p-2 text-ink-muted"
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="px-[var(--space-md)]">
            <div className="relative">
              <Search
                size={18}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                aria-hidden
              />
              <input
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder={ja.mealPlan.pickSearchPlaceholder}
                className="w-full rounded-md border border-edge bg-surface py-3 pl-10 pr-3 text-base text-ink placeholder:text-ink-muted/60 shadow-sm"
              />
            </div>
          </div>
          <div className="mt-[var(--space-sm)] flex-1 overflow-x-hidden overflow-y-auto px-[var(--space-md)]">
            {pickerResults.length === 0 ? (
              <p className="mt-[var(--space-md)] text-center text-ink-muted">
                {visibleRecipes.length === 0 ? ja.mealPlan.pickEmpty : ja.mealPlan.pickNoMatch}
              </p>
            ) : (
              <ul className="divide-y divide-edge rounded-md border border-edge bg-surface shadow-sm">
                {pickerResults.map((recipe) => (
                  <li key={recipe.id}>
                    <button
                      type="button"
                      onClick={() => void pickReplacement(recipe.id!)}
                      className="flex w-full items-center gap-2 px-[var(--space-md)] py-3 text-left"
                    >
                      <span className="min-w-0 flex-1 truncate font-bold">{recipe.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Toast message={message} onClose={() => setMessage('')} />
    </div>
  )
}

/** テンプレ1本ぶんのカード（名前の編集＋曜日ごとの中身＋削除） */
function TemplateCard({
  template,
  recipeById,
  onSaveName,
  onReplace,
  onRemoveItem,
  onDelete,
}: {
  template: MealTemplate
  recipeById: Map<number, Recipe>
  onSaveName: (name: string) => void
  onReplace: (index: number, currentTitle: string) => void
  onRemoveItem: (index: number, title: string) => void
  onDelete: () => void
}) {
  const [name, setName] = useState(template.name)
  const groups = useMemo(() => groupTemplateItems(template.items), [template.items])
  return (
    <section
      data-testid="template-card"
      className="rounded-md border border-edge bg-surface p-[var(--space-md)] shadow-sm"
    >
      <label className="block text-sm font-bold text-ink-muted">
        {ja.mealTemplates.nameLabel}
        <input
          type="text"
          value={name}
          maxLength={TEMPLATE_NAME_MAX_LENGTH}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-sm border border-edge bg-app px-2 py-2 text-base font-normal text-ink"
        />
      </label>
      <div className="mt-[var(--space-sm)] flex flex-wrap items-center gap-[var(--space-sm)]">
        <button
          type="button"
          onClick={() => onSaveName(name)}
          disabled={name.trim() === template.name}
          className="rounded-sm border border-edge bg-app px-3 py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
        >
          {ja.mealTemplates.nameSave}
        </button>
        <span className="text-sm text-ink-muted">
          {ja.mealPlan.templateItemCount.replace('{n}', String(template.items.length))}
        </span>
      </div>

      {template.items.length === 0 ? (
        <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
          {ja.mealTemplates.emptyItems}
        </p>
      ) : (
        <ul className="mt-[var(--space-sm)] space-y-[var(--space-sm)]">
          {groups.map((group) => (
            <li key={group.dow}>
              <p className="text-sm font-bold text-accent-ink">{ja.mealPlan.dow[group.dow]}</p>
              {group.slots.map((slotGroup) => (
                <div key={slotGroup.slot} className="mt-1">
                  <p className="text-xs text-ink-muted">{ja.mealPlan.slot[slotGroup.slot]}</p>
                  <ul className="mt-0.5 space-y-1">
                    {slotGroup.items.map(({ index, item }) => {
                      const title =
                        recipeById.get(item.recipeId)?.title ?? ja.mealTemplates.missingRecipe
                      return (
                        <li key={index} className="flex items-center gap-2">
                          <span className="w-10 shrink-0 text-xs font-bold text-ink-muted">
                            {ja.mealPlan.role[item.role]}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-bold">{title}</span>
                          <button
                            type="button"
                            onClick={() => onReplace(index, title)}
                            className="shrink-0 rounded-sm border border-edge bg-app px-2 py-1 text-xs font-bold text-accent-ink"
                          >
                            {ja.mealTemplates.replaceItem}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(index, title)}
                            aria-label={ja.mealTemplates.removeItem}
                            className="shrink-0 rounded-full p-2 text-ink-muted"
                          >
                            <X size={16} aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onDelete}
        className="mt-[var(--space-md)] inline-flex items-center gap-1 text-sm font-bold text-warning underline"
      >
        <Trash2 size={14} aria-hidden />
        {ja.mealPlan.templateDelete}
      </button>
    </section>
  )
}
