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
import {
  useEffect,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import type { IconKey, Recipe, Season } from '../db/types'
import { toggleFavorite } from '../db/recipes'
import { hasNgIngredient } from '../logic/ng'
import { resolveIconKey } from '../logic/icon'
import { ingredientColorToken } from '../logic/ingredientColor'
import { pickDisplayIngredientChips } from '../logic/mainIngredients'
import type { CardDensity } from '../logic/cardDensity'
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
  // アプリが絵を持たない iconKey が入っていたら自動判定に落とす（2026-08-15 便GU）。
  // そのまま描こうとすると読めない画像をマスクに使うことになり、タイルが空白になる
  const key = resolveIconKey(recipe)
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: 'var(--icon-tile)' }}
    >
      <RecipeIcon iconKey={key} size={iconSize} />
    </div>
  )
}

/**
 * レシピ詳細の大きな絵（16:9）。カードではないが、**「写真があれば写真・無ければ代わり絵」の
 * 出し分けをアプリの中で1か所にする**ために、この部品と同じファイルに置く。
 * 画面ごとに自前で出し分けを書くと、そこから「その画面だけのカード」が生まれてきた
 * （2026-08-19 便HW。scripts/test-logic.mjs の HW-1 が、共通部品の外に出し分けが無いことを見張る）。
 */
export function RecipeHeroPhoto({ recipe }: { recipe: Recipe }) {
  const photoUrl = usePhotoUrl(recipe.photo)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [photoUrl])
  const showPhoto = photoUrl && !recipe.showIconInsteadOfPhoto && !broken
  return showPhoto ? (
    <img
      src={photoUrl}
      alt={recipe.title}
      onError={() => setBroken(true)}
      className="aspect-video w-full object-cover"
    />
  ) : (
    <div className="aspect-video w-full">
      <RecipePlaceholder recipe={recipe} iconSize={56} />
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
   * カードの密度（2026-08-18 便HN。旧 layout='grid'|'list' を置き換えた）。
   * 値の意味と「3つまで」の歯止めは src/logic/cardDensity.ts に書いてある。
   *
   *  large    … 正方形の写真＋料理名（2行ぶん）＋補助情報。旧 layout='grid' と同じ見た目。
   *  standard … 中くらいのサムネ＋料理名（2行ぶん）＋補助情報の1行。旧 layout='list' と同じ見た目。
   *  small    … 小さい絵＋料理名1行。週の枠・月のマスのように、1行ぶんの高さしか無い場所用。
   *
   * 旧 layout から名前を変えたのは、切り替えていたのが「並べ方」ではなく
   * **1枚に載せる情報の多さ**だったため。設定に保存している 'grid'|'list' の値は変えていない
   * （RecipesPage が densityForListLayout で写して渡す）。
   */
  density?: CardDensity
  /**
   * 栄養価並び替え中（Pro機能。2026-07-16 便T）に表示する、並び替えに使っている栄養価の値
   * （例:「カロリー: 320kcal」「たんぱく質: 18.5g」。ラベル+値の形式で呼び出し側(RecipesPage)が
   * 整形済みの文字列を渡す。2026-07-16オーナー指示でラベル付き表示に変更）。
   * 「大」ではカード左上、「標準」では行の右下に出す。「小」では出さない（幅に載らない）。
   * 算出不能なレシピはRecipesPage側で undefinedのまま渡す（バッジ自体を出さない）
   */
  nutrientBadgeText?: string

  // ------------------------------------------------------------------------
  // 2026-08-19 便HW（オーナー原文「場所や機能ごとにレシピカードの形や内容が変わっている
  // のがみづらい」「同じ情報なら形もできるだけ揃えることを徹底したい」）。
  //
  // 画面ごとに自前で組んでいた「サムネ＋料理名の行」を、この1つの部品に寄せるための口。
  // **形を増やす口ではない**（形＝密度の3つだけ）。増やせるのは
  //   ・押したときに何が起きるか（レシピ詳細へ／その場で選ぶ／押せない見本）
  //   ・その画面ならではの短い情報と操作（記録の日付・献立の役割・「作った！」ボタン等）
  // の2つで、どちらもカードの骨格（絵の大きさ・名前の行数・余白）には手を触れない。
  // ------------------------------------------------------------------------

  /**
   * 押したときにレシピ詳細ではなく別のことを起こす（＝カードを <button> で描く）。
   * 例: 献立の枠（押すとレシピを選び直す）・記録の一覧（押すと記録の中身が開く）・
   * レシピを選ぶ一覧（押すとその品に決まる）。
   * 渡したときはお気に入りのハートを出さない（ボタンの中にボタンを置かないため）。
   */
  onSelect?: () => void
  /** onSelect のときの読み上げ名。省略するとカードの中身（料理名）がそのまま名前になる */
  selectAriaLabel?: string
  /** onSelect のカードを押せなくする（鍵の掛かった献立の枠） */
  disabled?: boolean
  /** レシピ詳細へ移るときに持ち回る出所（戻るボタンの行き先。react-router の state） */
  linkState?: unknown
  /** レシピ詳細へ移る直前に呼ぶ（見ていた位置の記憶など） */
  onNavigate?: () => void
  /** 押せない見本として描く（サンプルデモ。行き先が端末に無いレシピを指すため） */
  readOnly?: boolean

  /**
   * 補助情報の行を差し替える（「大」「標準」）。省略（undefined）時は調理時間・手間・季節・
   * 基本レシピ・主要食材チップの既定の並び。**null を渡すと補助情報を出さない**。
   * 記録の一覧のように「レシピの属性ではなく、その記録の情報」を出す場所で渡す。
   */
  infoLine?: ReactNode
  /** 料理名の前に置く小さな印（献立の役割・「作った」バッジ・「選択中」など） */
  titleBadges?: ReactNode
  /** 行の右端に添える短い情報（作った日・何人分など）。操作は入れない（押せなくなるため） */
  meta?: ReactNode
  /**
   * カードの下の段に置く操作（2026-08-19 便HW・献立の「日」のA案＝2段）。
   * カードの押下（レシピ詳細へ）とぶつからないよう、押せる面の**外側**に置かれる。
   * 「標準」でだけ使える（「小」「大」は1段のまま）。
   */
  actions?: ReactNode
  /** 淡い表示にする（作り終えた献立の枠・作った記録のカード） */
  muted?: boolean
  /**
   * サムネに、レシピの写真の代わりに出す写真（作った記録に添えた写真）。
   * 「作った記録」を並べる場所は、その日に撮った写真を優先して出す（無ければレシピの写真→代わり絵）。
   */
  photoOverride?: Blob
  /** 検査用の目印（カードの外枠に付く） */
  testId?: string
  /** 検査用の目印（料理名に付く） */
  titleTestId?: string
  /** 検査用の目印（絵の枠に付く） */
  thumbTestId?: string
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

/**
 * レシピカード1枚分。密度（density）で載せる情報の多さを切り替える。
 *  large    … 写真＋名前＋時間・手間バッジ（レシピ一覧のグリッド）
 *  standard … サムネ＋名前＋同じバッジの1行（レシピ一覧の一覧表示・候補・記録の一覧・献立の「日」）
 *  small    … 小さい絵＋名前1行（週・月の献立の枠のような、狭い場所用）
 */
export default function RecipeCard({
  recipe,
  ngIngredients,
  subLabel,
  inTodayList,
  showQuickTime,
  density = 'large',
  nutrientBadgeText,
  onSelect,
  selectAriaLabel,
  disabled,
  linkState,
  onNavigate,
  readOnly,
  infoLine,
  titleBadges,
  meta,
  actions,
  muted,
  photoOverride,
  testId,
  titleTestId,
  thumbTestId,
}: Props) {
  const recipePhotoUrl = usePhotoUrl(recipe.photo)
  const overridePhotoUrl = usePhotoUrl(photoOverride)
  const hasNg = ngIngredients ? hasNgIngredient(recipe, ngIngredients) : false
  /**
   * 写真が表示できなかったとき（2026-08-15 便GU・オーナー実機フィードバック
   * 「レシピカードにアイコンも何も表示されていないものがある」）。
   *
   * 写真つきのカードは <img> だけを出しており、その写真が読めないとカードの絵の枠が
   * 丸ごと空白になっていた（代わり絵に戻る道が無かった）。読めなかったときは、
   * 写真の無いレシピと同じ代わり絵（料理カテゴリの線画）に切り替える。
   * 別のレシピを描き直すときのために、写真が変わったら判定をやり直す
   */
  const [photoBroken, setPhotoBroken] = useState(false)
  // 「レシピの絵で出す」設定（showIconInsteadOfPhoto）が効くのはレシピの写真だけ。
  // 記録に添えた写真は、その日に撮った証拠なのでそのまま出す
  const photoUrl =
    overridePhotoUrl ?? (recipe.showIconInsteadOfPhoto ? undefined : recipePhotoUrl)
  useEffect(() => setPhotoBroken(false), [photoUrl])
  const showPhoto = photoUrl && !photoBroken
  const topIngredients = pickDisplayIngredientChips(recipe.ingredients)
  const displayMinutes = showQuickTime
    ? recipe.quickCookMinutes ?? recipe.cookMinutes
    : recipe.cookMinutes

  /**
   * カードの押せる面。3通りだけで、**どれも同じ中身・同じ骨格**を包む。
   *  ・レシピ詳細へのリンク（既定）
   *  ・その場で何かを起こすボタン（献立の枠・記録の一覧・レシピを選ぶ一覧）
   *  ・押せない箱（サンプルデモ）
   */
  const isLink = !readOnly && !onSelect
  const pressable = (cls: string, children: ReactNode, extra?: Record<string, string>) => {
    if (readOnly) {
      return (
        <div className={cls} {...extra}>
          {children}
        </div>
      )
    }
    if (onSelect) {
      return (
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled}
          aria-label={selectAriaLabel}
          className={`${cls} text-left`}
          {...extra}
        >
          {children}
        </button>
      )
    }
    return (
      <Link
        to={`/recipes/${recipe.id}`}
        state={linkState}
        onClick={onNavigate}
        className={cls}
        {...extra}
      >
        {children}
      </Link>
    )
  }

  const thumb = (iconSize: number, cls: string) => (
    <span data-testid={thumbTestId} className={cls}>
      {showPhoto ? (
        <img
          src={photoUrl}
          alt={recipe.title}
          onError={() => setPhotoBroken(true)}
          // 記録の一覧のように件数の上限が無い一覧でも、画面外の写真をデコードさせない
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <RecipePlaceholder recipe={recipe} iconSize={iconSize} />
      )}
    </span>
  )

  /** 調理時間・手間・季節の1行（「大」「標準」の既定の補助情報） */
  const defaultInfoRow = (
    <>
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
    </>
  )

  /**
   * 「小」（2026-08-18 便HN）。週の枠・月のマスのように、**1行ぶんの高さしか無い**場所のための形。
   *
   * 絵は正方形で、カードの高さいっぱいに広がる（`aspect-square` ＋ 縦は伸ばす）。
   * これで、同じ1つの書き方が入れ物に応じて2つの見え方になる:
   *   ・週の枠のように高さが中身で決まる場所 … 絵は押せる高さ（44px）＝小さいサムネ＋名前1行
   *   ・月のマスのように正方形の入れ物 ……… 絵がマス全体に広がり、名前は幅ゼロで出ない＝写真だけ
   * 月のマス（390px幅の画面で実測47.7px角）に「サムネ＋名前」の1行を入れると
   * 名前に十数pxしか残らないため、**入れ物側が正方形なら絵だけになる**のが正しい形になる。
   *
   * 高さの下限は --tap-min（44px）＝アプリ共通の押せる大きさ。2026-08-19 便HWで
   * 献立の週・月の枠をこの形に寄せたとき、32pxまで縮むと従来（py-2.5の行＝約44px）より
   * 押しにくくなるため、下限をアプリ共通の値にそろえた。
   *
   * 載せるのは絵と名前だけ。時間・手間・季節・食材チップ・お気に入りは出さない
   * （出すと1行に収まらず、狭い場所ほど読めなくなる）。NG食材の警告だけは安全に関わるので、
   * 場所を取らない小さな印として角に重ねる。
   */
  if (density === 'small') {
    const tone = muted
      ? 'border-edge bg-app/60 text-ink-muted opacity-70'
      : 'border-edge bg-surface text-ink'
    return pressable(
      `relative flex h-full min-h-[var(--tap-min)] w-full min-w-0 items-stretch gap-1 overflow-hidden rounded-sm border ${tone} ${
        disabled ? 'opacity-40' : ''
      }`,
      <>
        {/* 絵は「カードの高さと同じ正方形」。h-full と min-h の両方を書くのは、
            高さの決まった入れ物（月のマス）では h-full が、高さが中身で決まる場所（週の枠）では
            min-h が、それぞれ正方形の一辺を決めるため。どちらか片方だけだと、
            高さが決まらない側で幅が0になる（390px幅の実測で確認済み） */}
        {thumb(16, 'aspect-square h-full min-h-[var(--tap-min)] shrink-0 overflow-hidden')}
        {titleBadges && (
          <span className="flex shrink-0 items-center gap-1 self-center">{titleBadges}</span>
        )}
        <span
          data-testid={titleTestId}
          className="min-w-0 flex-1 self-center truncate pr-1 text-base font-bold leading-tight"
        >
          {recipe.title}
        </span>
        {meta && (
          <span className="shrink-0 self-center pr-1 text-xs text-ink-muted">{meta}</span>
        )}
        {hasNg && (
          <span
            title={ja.card.ngBadge}
            aria-label={ja.card.ngBadge}
            className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-app"
          >
            <TriangleAlert size={10} aria-hidden />
          </span>
        )}
      </>,
      testId ? { 'data-testid': testId } : undefined,
    )
  }

  if (density === 'standard') {
    const tone = muted
      ? 'border-edge bg-app/60 text-ink-muted opacity-70'
      : 'border-edge bg-surface text-ink'
    return (
      <div
        data-testid={testId}
        className={`relative rounded-md border shadow-sm ${tone} ${disabled ? 'opacity-40' : ''}`}
      >
        {pressable(
          'flex w-full items-center gap-[var(--space-sm)] p-[var(--space-sm)]',
          <>
            {thumb(24, 'h-14 w-14 shrink-0 overflow-hidden rounded-sm')}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-1">
                {titleBadges && (
                  <span className="flex shrink-0 flex-wrap items-center gap-1">{titleBadges}</span>
                )}
                <p
                  data-testid={titleTestId}
                  className="line-clamp-2 min-w-0 flex-1 font-bold leading-snug"
                >
                  {recipe.title}
                </p>
                {meta && (
                  <span className="shrink-0 text-right text-sm text-ink-muted">{meta}</span>
                )}
                {isLink && (
                  <span className="mt-0.5 shrink-0">
                    <FavoriteToggle recipe={recipe} />
                  </span>
                )}
              </div>
              {infoLine !== undefined ? (
                infoLine
              ) : (
                <>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                    {defaultInfoRow}
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
                </>
              )}
              {subLabel && <p className="mt-1 text-xs font-bold text-accent-ink">{subLabel}</p>}
            </div>
          </>,
        )}
        {/* 2段目（2026-08-19 便HW）。カードの押下は「レシピ詳細へ」のままにしたいので、
            操作は押せる面の外に置く。区切り線1本で、上の段（何の料理か）と
            下の段（その料理に何をするか）を読み分けられるようにする */}
        {actions && (
          <div className="flex flex-wrap items-center gap-[var(--space-sm)] border-t border-edge px-[var(--space-sm)] py-[var(--space-sm)]">
            {actions}
          </div>
        )}
        {/* 栄養価並び替え中の値(2026-07-16 便T-7): 「標準」は行の右下に重ねる。
            便T-7-2でラベル付き表示("たんぱく質: 24g")に変更し長くなったため、max-width+truncateで
            カード幅を超えないようにする */}
        {nutrientBadgeText && (
          <span className="absolute bottom-1.5 right-1.5 max-w-[50%] truncate rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent shadow-sm">
            {nutrientBadgeText}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      data-testid={testId}
      // h-full: 一覧のグリッドは行の高さを全カードで揃えている(RecipesPage の grid-auto-rows:1fr)。
      // カード自身が行いっぱいに伸びないと、中身の短いカードだけ枠が途中で切れて見える
      // (2026-08-09 オーナー実機「レシピカードの大きさがレシピ名の長さによって変わる」)
      className="relative h-full overflow-hidden rounded-md bg-surface shadow-sm border border-edge"
    >
      {pressable(
        'block h-full',
        <>
          <div className="relative aspect-square w-full overflow-hidden">
            {thumb(48, 'block h-full w-full')}
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
          <div className="p-[var(--space-sm)]">
            <div className="flex items-start justify-between gap-1">
              {titleBadges && (
                <span className="flex shrink-0 flex-wrap items-center gap-1">{titleBadges}</span>
              )}
              {/* 料理名の枠は常に2行ぶんの高さを取る(2026-08-09 オーナー実機
                  「レシピカードの大きさがレシピ名の長さによって変わる→カードをレシピ名2行のサイズで
                  統一し、はみ出る分は省略する」)。line-clamp-2 で3行目以降は「…」で省き、
                  min-h で1行の名前でも高さが縮まないようにする。
                  2.75em = leading-snug(1.375) × 2行。px直書きにしないのは、端末の文字サイズ設定で
                  1行の高さが変わっても2行ぶんであり続けるため */}
              <p
                data-testid={titleTestId}
                className="line-clamp-2 min-h-[2.75em] min-w-0 flex-1 font-bold leading-snug"
              >
                {recipe.title}
              </p>
              {isLink && (
                <span className="mt-0.5 shrink-0">
                  <FavoriteToggle recipe={recipe} />
                </span>
              )}
            </div>
            {infoLine !== undefined ? (
              infoLine
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-1 text-xs text-ink-muted">
                {defaultInfoRow}
              </div>
            )}
            {subLabel && <p className="mt-1 text-xs font-bold text-accent-ink">{subLabel}</p>}
          </div>
        </>,
      )}
      {/* 栄養価並び替え中の値(2026-07-16 便T-7)とNG食材警告は同じ左上角に出るため縦積みにする。
          便T-7-2でラベル付き表示("たんぱく質: 24g")に変更し長くなったため、max-width+truncateで
          カード幅を超えないようにする */}
      {(nutrientBadgeText || hasNg) && (
        <div className="pointer-events-none absolute left-1.5 top-1.5 flex max-w-[70%] flex-col items-start gap-1">
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
          className="pointer-events-none absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-accent text-on-accent shadow-sm"
        >
          <CalendarCheck2 size={16} aria-hidden />
        </span>
      )}
      {actions && (
        <div className="flex flex-wrap items-center gap-[var(--space-sm)] border-t border-edge px-[var(--space-sm)] py-[var(--space-sm)]">
          {actions}
        </div>
      )}
    </div>
  )
}
