/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import {
  Clock,
  Heart,
  TriangleAlert,
  CalendarCheck2,
  UtensilsCrossed,
  Soup,
  Salad,
  Fish,
  Beef,
  CakeSlice,
  Sandwich,
  Coffee,
  Utensils,
  CookingPot,
  Egg,
  Drumstick,
  Flower2,
  Sun,
  Leaf,
  Snowflake,
} from 'lucide-react'
import type { IconKey, Recipe, Season } from '../db/types'
import { hasNgIngredient } from '../logic/ng'
import { pickIconKey } from '../logic/icon'
import { ingredientColorToken } from '../logic/ingredientColor'
import { pickDisplayIngredientChips } from '../logic/mainIngredients'
import { ja } from '../i18n/ja'
import { usePhotoUrl } from './usePhotoUrl'

/* 写真がないレシピ（または「アイコン表示」を選んだレシピ）用のプレースホルダー:
   料理名・タグ・材料から選んだ料理アイコン＋タグ（なければ料理名）で決まる色の濃さ。
   色はアクセント色と背景色の混ぜ合わせだけで作る（トークン外の色は使わない） */
export const iconComponents: Record<IconKey, typeof UtensilsCrossed> = {
  rice: CookingPot,
  noodle: Utensils,
  bread: Sandwich,
  soup: Soup,
  salad: Salad,
  fish: Fish,
  egg: Egg,
  chicken: Drumstick,
  meat: Beef,
  dessert: CakeSlice,
  drink: Coffee,
  default: UtensilsCrossed,
}

/** 季節バッジのアイコン（「通年」は表示しないので含めない） */
export const seasonIcons: Record<Exclude<Season, 'all'>, typeof Flower2> = {
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
}

const mixRatios = [16, 26, 38, 52] as const

function hashString(text: string): number {
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(hash)
}

/** 写真なし（または表示優先）レシピの代わり絵。iconKey を指定すれば手動選択したアイコンで固定表示 */
export function RecipePlaceholder({
  recipe,
  iconSize = 48,
}: {
  recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients' | 'iconKey'>
  iconSize?: number
}) {
  const seed = recipe.tags[0] ?? recipe.title
  const hash = hashString(seed)
  const key = recipe.iconKey ?? pickIconKey(recipe)
  const Icon = iconComponents[key]
  const ratio = mixRatios[Math.floor(hash / 7) % mixRatios.length]
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: `color-mix(in oklab, var(--accent) ${ratio}%, var(--bg))` }}
    >
      <Icon size={iconSize} className="text-accent" aria-hidden />
    </div>
  )
}

type Props = {
  recipe: Recipe
  /** NG食材リスト（渡すと該当レシピに警告バッジが付く） */
  ngIngredients?: string[]
  /** カード下部に出す補足（例: 「食材 2/3 が使える」） */
  subLabel?: string
  /** 今日の献立（今日つくるリスト）に入っていればバッジを表示 */
  inTodayList?: boolean
  /**
   * 「時短」絞り込みが有効な間 true。true のときは調理時間をquickCookMinutes
   * （無ければcookMinutesを流用）に切り替え、「時短」ラベルを添えて表示する
   */
  showQuickTime?: boolean
}

/** レシピ一覧のカード1枚分（写真＋名前＋時間・手間バッジ） */
export default function RecipeCard({
  recipe,
  ngIngredients,
  subLabel,
  inTodayList,
  showQuickTime,
}: Props) {
  const photoUrl = usePhotoUrl(recipe.photo)
  const hasNg = ngIngredients ? hasNgIngredient(recipe, ngIngredients) : false
  const showPhoto = photoUrl && !recipe.showIconInsteadOfPhoto
  const topIngredients = pickDisplayIngredientChips(recipe.ingredients)
  const displayMinutes = showQuickTime
    ? recipe.quickCookMinutes ?? recipe.cookMinutes
    : recipe.cookMinutes

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="relative block overflow-hidden rounded-md bg-surface shadow-sm border border-edge"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {showPhoto ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} />
        )}
        {/* 同梱の基本レシピか、配布テーマ由来か、自分で登録したレシピかの見分け。
            テーマ由来(sourceSetNameあり)はセット名をそのまま表示する(長い名前はtruncate+title属性で全文) */}
        {(recipe.sourceSetName || recipe.isStarter) && (
          <span
            title={recipe.sourceSetName || undefined}
            className="absolute bottom-1.5 left-1.5 max-w-[70%] truncate rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-bold text-ink-muted shadow-sm"
          >
            {recipe.sourceSetName ?? ja.card.starterBadge}
          </span>
        )}
        {/* 主要食材チップ（先頭3つ）を写真の右下に重ねる */}
        {topIngredients.length > 0 && (
          <div className="absolute bottom-1.5 right-1.5 flex max-w-[80%] flex-col items-end gap-1">
            {topIngredients.map((ing, index) => (
              <span
                key={index}
                className="max-w-full truncate rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm"
                style={{
                  background: `var(${ingredientColorToken(ing.name)})`,
                  color: 'var(--chip-ink)',
                }}
              >
                {ing.name}
              </span>
            ))}
          </div>
        )}
      </div>
      {hasNg && (
        <span
          title={ja.card.ngBadge}
          aria-label={ja.card.ngBadge}
          className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-warning text-app shadow-sm"
        >
          <TriangleAlert size={16} aria-hidden />
        </span>
      )}
      {inTodayList && (
        <span
          title={ja.card.todayBadge}
          aria-label={ja.card.todayBadge}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-app shadow-sm"
        >
          <CalendarCheck2 size={16} aria-hidden />
        </span>
      )}
      <div className="p-[var(--space-sm)]">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 font-bold leading-snug">{recipe.title}</p>
          {recipe.isFavorite && (
            <Heart size={16} className="mt-0.5 shrink-0 text-accent" fill="currentColor" aria-hidden />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          {displayMinutes != null && displayMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={12} aria-hidden />
              {showQuickTime && ja.card.quickTimePrefix}
              {displayMinutes}
              {ja.recipes.minutesSuffix}
            </span>
          )}
          <span className="rounded-sm border border-edge px-1.5 py-0.5">
            {ja.effort[recipe.effortLevel]}
          </span>
          {recipe.season && recipe.season !== 'all' && (
            <span className="inline-flex items-center gap-0.5 rounded-sm border border-edge px-1.5 py-0.5">
              {(() => {
                const SeasonIcon = seasonIcons[recipe.season]
                return <SeasonIcon size={12} aria-hidden />
              })()}
              {ja.season[recipe.season]}
            </span>
          )}
        </div>
        {subLabel && <p className="mt-1 text-xs font-bold text-accent">{subLabel}</p>}
      </div>
    </Link>
  )
}
