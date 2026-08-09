/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import {
  Clock,
  Heart,
  TriangleAlert,
  CalendarCheck2,
  Flower2,
  Sun,
  Leaf,
  Snowflake,
} from 'lucide-react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import type { IconKey, Recipe, Season } from '../db/types'
import { toggleFavorite } from '../db/recipes'
import { hasNgIngredient } from '../logic/ng'
import { pickIconKey } from '../logic/icon'
import { ingredientColorToken } from '../logic/ingredientColor'
import { pickDisplayIngredientChips } from '../logic/mainIngredients'
import { ja } from '../i18n/ja'
import { usePhotoUrl } from './usePhotoUrl'

/** 季節バッジのアイコン（「通年」は表示しないので含めない） */
export const seasonIcons: Record<Exclude<Season, 'all'>, typeof Flower2> = {
  spring: Flower2,
  summer: Sun,
  autumn: Leaf,
  winter: Snowflake,
}

/** 料理カテゴリの線画（Freepikのspecial-lineal PNG・512px透過・public/icons/配下）を
   CSSマスクで描画する。塗り色は既定でvar(--accent)（線画=図形なので、文字用に濃くした
   --accent-inkではなく塗り用のアクセントをそのまま使う。テーマ追従）。
   RecipeFormPageのアイコン選択UIのように、ボタンの選択状態で文字色が変わる場所では
   colorを渡して合わせる（未選択時はtext-ink-mutedのミュートグレー等）。
   iOS Safari向けに-webkit-mask-*プレフィックスを必須で併記する */
export function RecipeIcon({
  iconKey,
  size = 48,
  color = 'var(--accent)',
}: {
  iconKey: IconKey
  size?: number
  color?: string
}) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        backgroundColor: color,
        WebkitMaskImage: `url(/icons/${iconKey}.png)`,
        maskImage: `url(/icons/${iconKey}.png)`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  )
}

/** 写真なし（または表示優先）レシピの代わり絵。iconKey を指定すれば手動選択したアイコンで固定表示 */
export function RecipePlaceholder({
  recipe,
  iconSize = 48,
}: {
  recipe: Pick<Recipe, 'title' | 'tags' | 'ingredients' | 'iconKey'>
  iconSize?: number
}) {
  const key = recipe.iconKey ?? pickIconKey(recipe)
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: 'var(--icon-tile)' }}
    >
      <RecipeIcon iconKey={key} size={iconSize} />
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
  /**
   * 一覧の表示形式（2026-07-13 UI改善）。'list' のときは小さい写真＋タイトル＋
   * 既存のメタ（時間・手間レベル・季節）だけの縦一列の行として表示する。省略時は従来どおりのグリッドカード
   */
  layout?: 'grid' | 'list'
  /**
   * 栄養価並び替え中（Pro機能。2026-07-16 便T）に表示する、並び替えに使っている栄養価の値
   * （例:「カロリー: 320kcal」「たんぱく質: 18.5g」。ラベル+値の形式で呼び出し側(RecipesPage)が
   * 整形済みの文字列を渡す。2026-07-16オーナー指示でラベル付き表示に変更）。
   * グリッド表示ではカード左上、一覧（list）表示では右下に出す。算出不能なレシピはRecipesPage側で
   * undefinedのまま渡す（バッジ自体を出さない）
   */
  nutrientBadgeText?: string
}

/**
 * 一覧カードのお気に入りトグル（2026-07-29 便CI/C15）。
 * 従来はハートが「お気に入り済みのときだけ出る表示専用アイコン」で、押しても詳細へ遷移するだけ
 * だった（付け外しは詳細画面のハート1か所のみ＝10件整理するのに詳細を10回開くしかない）。
 * カード全体が <Link> なので、遷移させないよう preventDefault + stopPropagation する。
 * 一覧側のスクロール位置保存（RecipesPage の onClickCapture）はキャプチャ段階で走るため、
 * そちら側でボタンのクリックを除外している。
 */
function FavoriteToggle({ recipe }: { recipe: Recipe }) {
  const onClick = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (recipe.id === undefined) return
    void toggleFavorite(recipe.id)
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={!!recipe.isFavorite}
      aria-label={recipe.isFavorite ? ja.detail.favoriteOff : ja.detail.favoriteOn}
      className={`-m-2 shrink-0 p-2 ${recipe.isFavorite ? 'text-accent-ink' : 'text-ink-muted'}`}
    >
      <Heart
        size={16}
        fill={recipe.isFavorite ? 'currentColor' : 'none'}
        className={recipe.isFavorite ? '' : 'opacity-50'}
        aria-hidden
      />
    </button>
  )
}

/** レシピ一覧のカード1枚分（写真＋名前＋時間・手間バッジ）。layout='list'なら縦一列の行表示 */
export default function RecipeCard({
  recipe,
  ngIngredients,
  subLabel,
  inTodayList,
  showQuickTime,
  layout = 'grid',
  nutrientBadgeText,
}: Props) {
  const photoUrl = usePhotoUrl(recipe.photo)
  const hasNg = ngIngredients ? hasNgIngredient(recipe, ngIngredients) : false
  const showPhoto = photoUrl && !recipe.showIconInsteadOfPhoto
  const topIngredients = pickDisplayIngredientChips(recipe.ingredients)
  const displayMinutes = showQuickTime
    ? recipe.quickCookMinutes ?? recipe.cookMinutes
    : recipe.cookMinutes

  if (layout === 'list') {
    return (
      <Link
        to={`/recipes/${recipe.id}`}
        className="relative flex items-center gap-[var(--space-sm)] rounded-md border border-edge bg-surface p-[var(--space-sm)] shadow-sm"
      >
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm">
          {showPhoto ? (
            <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
          ) : (
            <RecipePlaceholder recipe={recipe} iconSize={24} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="line-clamp-2 font-bold leading-snug">{recipe.title}</p>
            <span className="mt-0.5 shrink-0">
              <FavoriteToggle recipe={recipe} />
            </span>
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
            {hasNg && (
              <span
                title={ja.card.ngBadge}
                aria-label={ja.card.ngBadge}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning text-app"
              >
                <TriangleAlert size={12} aria-hidden />
              </span>
            )}
            {inTodayList && (
              <span
                title={ja.card.todayBadge}
                aria-label={ja.card.todayBadge}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
              >
                <CalendarCheck2 size={12} aria-hidden />
              </span>
            )}
          </div>
          {recipe.isStarter && (
            <p className="mt-1 truncate text-[10px] font-bold text-ink-muted">
              {ja.card.starterBadge}
            </p>
          )}
          {topIngredients.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
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
          {subLabel && <p className="mt-1 text-xs font-bold text-accent-ink">{subLabel}</p>}
        </div>
        {/* 栄養価並び替え中の値(2026-07-16 便T-7): 一覧(list)表示は行の右下に重ねる。
            便T-7-2でラベル付き表示("たんぱく質: 24g")に変更し長くなったため、max-width+truncateで
            カード幅を超えないようにする */}
        {nutrientBadgeText && (
          <span className="absolute bottom-1.5 right-1.5 max-w-[50%] truncate rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent shadow-sm">
            {nutrientBadgeText}
          </span>
        )}
      </Link>
    )
  }

  return (
    <Link
      to={`/recipes/${recipe.id}`}
      // h-full: 一覧のグリッドは行の高さを全カードで揃えている(RecipesPage の grid-auto-rows:1fr)。
      // カード自身が行いっぱいに伸びないと、中身の短いカードだけ枠が途中で切れて見える
      // (2026-08-09 オーナー実機「レシピカードの大きさがレシピ名の長さによって変わる」)
      className="relative block h-full overflow-hidden rounded-md bg-surface shadow-sm border border-edge"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {showPhoto ? (
          <img src={photoUrl} alt={recipe.title} className="h-full w-full object-cover" />
        ) : (
          <RecipePlaceholder recipe={recipe} />
        )}
        {/* 公式(isStarter)か自分で登録したレシピかの見分け。第◯弾/テーマの括りは廃止し、
            公式は配布テーマ由来かどうかに関わらず全て「基本レシピ」で表示する
            (2026-07-20 便AM: 商品が全部込み買い切りになりテーマ区別が販売上不要になったため。
            データ側のsourceSetName/sourceSetIdは読み込み・削除・再配信の単位として維持している) */}
        {recipe.isStarter && (
          <span className="absolute bottom-1.5 left-1.5 line-clamp-2 max-w-[70%] rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-bold text-ink-muted shadow-sm">
            {ja.card.starterBadge}
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
      {/* 栄養価並び替え中の値(2026-07-16 便T-7)とNG食材警告は同じ左上角に出るため縦積みにする。
          便T-7-2でラベル付き表示("たんぱく質: 24g")に変更し長くなったため、max-width+truncateで
          カード幅を超えないようにする */}
      {(nutrientBadgeText || hasNg) && (
        <div className="absolute left-1.5 top-1.5 flex max-w-[70%] flex-col items-start gap-1">
          {nutrientBadgeText && (
            <span className="max-w-full truncate rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent shadow-sm">
              {nutrientBadgeText}
            </span>
          )}
          {hasNg && (
            <span
              title={ja.card.ngBadge}
              aria-label={ja.card.ngBadge}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-warning text-app shadow-sm"
            >
              <TriangleAlert size={16} aria-hidden />
            </span>
          )}
        </div>
      )}
      {inTodayList && (
        <span
          title={ja.card.todayBadge}
          aria-label={ja.card.todayBadge}
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
        >
          <CalendarCheck2 size={16} aria-hidden />
        </span>
      )}
      <div className="p-[var(--space-sm)]">
        <div className="flex items-start justify-between gap-1">
          {/* 料理名の枠は常に2行ぶんの高さを取る(2026-08-09 オーナー実機
              「レシピカードの大きさがレシピ名の長さによって変わる→カードをレシピ名2行のサイズで
              統一し、はみ出る分は省略する」)。line-clamp-2 で3行目以降は「…」で省き、
              min-h で1行の名前でも高さが縮まないようにする。
              2.75em = leading-snug(1.375) × 2行。px直書きにしないのは、端末の文字サイズ設定で
              1行の高さが変わっても2行ぶんであり続けるため */}
          <p className="line-clamp-2 min-h-[2.75em] font-bold leading-snug">{recipe.title}</p>
          <span className="mt-0.5 shrink-0">
            <FavoriteToggle recipe={recipe} />
          </span>
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
        {subLabel && <p className="mt-1 text-xs font-bold text-accent-ink">{subLabel}</p>}
      </div>
    </Link>
  )
}
