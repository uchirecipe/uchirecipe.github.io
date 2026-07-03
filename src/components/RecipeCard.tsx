import { Link } from 'react-router-dom'
import {
  Clock,
  Heart,
  UtensilsCrossed,
  Soup,
  Salad,
  Fish,
  Beef,
  CakeSlice,
  Sandwich,
  Coffee,
} from 'lucide-react'
import type { Recipe } from '../db/types'
import { ja } from '../i18n/ja'
import { usePhotoUrl } from './usePhotoUrl'

/* 写真がないレシピ用のプレースホルダー:
   タグ（なければ料理名）から決まる色の濃さ＋料理アイコンで見栄えを保つ。
   色はアクセント色と背景色の混ぜ合わせだけで作る（トークン外の色は使わない） */
const placeholderIcons = [
  UtensilsCrossed,
  Soup,
  Salad,
  Fish,
  Beef,
  CakeSlice,
  Sandwich,
  Coffee,
] as const

const mixRatios = [16, 26, 38, 52] as const

function hashString(text: string): number {
  let hash = 0
  for (const ch of text) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(hash)
}

function Placeholder({ seed }: { seed: string }) {
  const hash = hashString(seed)
  const Icon = placeholderIcons[hash % placeholderIcons.length]
  const ratio = mixRatios[Math.floor(hash / 7) % mixRatios.length]
  return (
    <div
      className="flex aspect-square w-full items-center justify-center"
      style={{ background: `color-mix(in oklab, var(--accent) ${ratio}%, var(--bg))` }}
    >
      <Icon size={48} className="text-accent" aria-hidden />
    </div>
  )
}

/** レシピ一覧のカード1枚分（写真＋名前＋時間・手間バッジ） */
export default function RecipeCard({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  const seed = recipe.tags[0] ?? recipe.title

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      className="block overflow-hidden rounded-md bg-surface shadow-sm border border-edge"
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={recipe.title}
          className="aspect-square w-full object-cover"
        />
      ) : (
        <Placeholder seed={seed} />
      )}
      <div className="p-[var(--space-sm)]">
        <div className="flex items-start justify-between gap-1">
          <p className="line-clamp-2 font-bold leading-snug">{recipe.title}</p>
          {recipe.isFavorite && (
            <Heart size={16} className="mt-0.5 shrink-0 text-accent" fill="currentColor" aria-hidden />
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
          {recipe.cookMinutes != null && recipe.cookMinutes > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Clock size={12} aria-hidden />
              {recipe.cookMinutes}
              {ja.recipes.minutesSuffix}
            </span>
          )}
          <span className="rounded-sm border border-edge px-1.5 py-0.5">
            {ja.effort[recipe.effortLevel]}
          </span>
        </div>
      </div>
    </Link>
  )
}
