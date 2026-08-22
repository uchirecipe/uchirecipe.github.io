/* eslint-disable react-refresh/only-export-components */
import { Link } from 'react-router-dom'
import {
  Clock,
  Crop,
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
import { cardPartsFor, type CardPartKey, type CardPlace } from '../logic/cardParts'
import { photoObjectPosition } from '../logic/photoFocus'
import { ja } from '../i18n/ja'
import { usePhotoUrl } from './usePhotoUrl'

/*
 * カードの角丸と枠（2026-08-22 便JE・オーナー確定）
 *
 * 3つの密度（大／標準／小）はどれも「同じ形がたくさん並ぶカード」なので、
 * 角丸は --radius-card（rounded-card＝4px）、枠は --border-card（border-edge-card）で統一する。
 *  ・角丸 … オーナー原文「②：４px。（中略）外側の『夕食』などのカードも同様に。」
 *    入れ子（曜日カード → 朝食/昼食/夕食の枠 → このカード → 中の写真）まで同じ値にそろえる
 *  ・枠 … オーナー原文「レシピカードの線を濃く（太く？）すると、レシピカードが見分けやすいかも」
 *    **濃くする方**を採った。太くする（1px→2px）と、カードの中に残る幅が2px縮んで
 *    料理名の幅が削れる（オーナーが直させたばかりの箇所）。濃さは5テーマとも 3:1 以上。
 * どちらも値は src/index.css の1か所（トークン）にあり、ここには px も色も書かない。
 */

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
export function RecipeHeroPhoto({
  recipe,
  onAdjustPhoto,
}: {
  recipe: Recipe
  /**
   * 「見える範囲」を決める窓を開く（2026-08-22 便JK）。渡したときだけ、写真の右下に
   * 入口の丸ボタンを重ねる。**写真の無いレシピ・アイコン優先のレシピでは何も出さない**
   * （代わり絵には調整するものが無いため）。
   * 写真の中に重ねるので、**料理名・材料の位置は1pxも動かない**（オーナー指示）。
   */
  onAdjustPhoto?: () => void
}) {
  const photoUrl = usePhotoUrl(recipe.photo)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [photoUrl])
  const showPhoto = photoUrl && !recipe.showIconInsteadOfPhoto && !broken
  if (!showPhoto) {
    return (
      <div className="aspect-video w-full">
        <RecipePlaceholder recipe={recipe} iconSize={56} />
      </div>
    )
  }
  return (
    <div className="relative">
      <img
        src={photoUrl}
        alt={recipe.title}
        onError={() => setBroken(true)}
        style={{ objectPosition: photoObjectPosition(recipe.photoFocus) }}
        className="aspect-video w-full object-cover"
      />
      {onAdjustPhoto && (
        <button
          type="button"
          onClick={onAdjustPhoto}
          data-testid="photo-focus-open"
          aria-label={ja.photoFocus.openAria}
          className="tap-target absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full border border-edge bg-surface/90 text-accent-ink shadow-md"
        >
          <Crop size={20} aria-hidden />
        </button>
      )}
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
   * カードを出す**場所**（2026-08-19 便HY・オーナー原文「レシピカードはフォーマットが
   * 揃っていれば、それぞれの場所で不要な情報はなくしてシンプルにしたい」）。
   *
   * 形（密度）はそのままに、**載せる情報だけ**をこの場所ごとに切り替える。
   * どこで何を載せるかは src/logic/cardParts.ts の1つの表にまとめてあり、
   * ここで新しい項目を足すことはできない（**削るのは自由・足すのは共通部品を通す**）。
   * 省略するとレシピ一覧と同じ＝いちばん情報の多い側になる（黙って減らさない）。
   */
  place?: CardPlace
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
  //
  // 2026-08-19 便HY（オーナー承認済み）で、これに**引き算の口**（place）が1つ増えた。
  // レシピの属性（時間・手間・季節・基本レシピ・主要食材）のうち、その場所で出すものを
  // src/logic/cardParts.ts の表から選ぶ。**削るのは自由・足すのは共通部品を通す**。
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
  place,
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
  /**
   * この場所で載せる情報（2026-08-19 便HY）。**カードが用意した中から選ぶだけ**で、
   * 場所ごとに新しい項目を足すことはできない。表は src/logic/cardParts.ts の1か所。
   */
  const parts = cardPartsFor(place)
  const shows = (key: CardPartKey) => parts.has(key)
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
          // 見える範囲（2026-08-22 便JK）。詳細画面と**同じ1つの値**を使う＝
          // 同じ写真を2回調整させない。未設定のレシピは '50% 50%'＝いままでどおり中央
          style={{ objectPosition: photoObjectPosition(recipe.photoFocus) }}
          className="h-full w-full object-cover"
        />
      ) : (
        <RecipePlaceholder recipe={recipe} iconSize={iconSize} />
      )}
    </span>
  )

  /**
   * NG食材の印（2026-08-20 便IJ・②）。
   *
   * オーナー原文:
   *   「レシピから追加のNG食材について、マークだけあっても意味がわからない。
   *     NG食材あり、など超短く説明欲しい。」
   *
   * 直す前は三角の印だけで、`ja.card.ngBadge`（NG食材を含む）は読み上げ用の名前にしか
   * 使っておらず、**画面には1文字も出ていなかった**。印の隣に短い言葉（ngBadgeShort）を出す。
   *
   * 出す・出さないは密度で分ける（実測は scripts/e2e-smoke.mjs の NGWORD-01）:
   *  ・「大」「標準」… 印＋言葉。どちらも1行ぶんの横幅に余裕がある
   *  ・「小」………… 印だけ。週の枠・月の日の窓は料理名がすでに詰めて出ている行で、
   *                  言葉を足すと**料理名のほうが削れる**（判断の材料が減る）。
   *                  読み上げと指を置いたときの吹き出しでは「小」でも同じ説明が出る
   *
   * 掴み方を並びに依らせないため、どの密度でも同じ目印（data-testid="ng-badge"）を付ける。
   * `role="img"` を付けるのは、文字を持たない「小」でも aria-label が確実に名前になるようにするため。
   */
  const ngBadge = (opts: { withWord: boolean; iconSize: number; cls: string }) => (
    <span
      data-testid="ng-badge"
      role="img"
      title={ja.card.ngBadge}
      aria-label={ja.card.ngBadge}
      className={opts.cls}
    >
      <TriangleAlert size={opts.iconSize} aria-hidden />
      {opts.withWord && (
        <span data-testid="ng-badge-word" className="whitespace-nowrap">
          {ja.card.ngBadgeShort}
        </span>
      )}
    </span>
  )

  /** 調理時間・手間・季節の1行（「大」「標準」の既定の補助情報）。1つずつ場所の表を通す */
  const defaultInfoRow = (
    <>
      {shows('time') && displayMinutes != null && displayMinutes > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <Clock size={12} aria-hidden />
          {showQuickTime && ja.card.quickTimePrefix}
          {displayMinutes}
          {ja.recipes.minutesSuffix}
        </span>
      )}
      {shows('effort') && (
        <span className="rounded-sm border border-edge px-1.5 py-0.5">
          {ja.effort[recipe.effortLevel]}
        </span>
      )}
      {shows('season') && recipe.season && recipe.season !== 'all' && (
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
   * 「小」（2026-08-18 便HN）。週の枠・月の日の窓のように、**1行ぶんの高さしか無い**場所のための形。
   *
   * 絵は押せる大きさ（--tap-min＝44px）の正方形で、その右に料理名を1行。
   *
   * 2026-08-20 便IG・⑫（オーナー実機報告「月の日の窓を開くと、作った記録の写真が窓いっぱいに
   * 縦長で表示され、料理名が出ていない」）で、絵の枠の書き方を直した。
   * 直す前は `aspect-square h-full min-h-[var(--tap-min)]`（＝カードの高さいっぱいの正方形）で、
   * 「入れ物が正方形なら絵が全面に広がり、名前は出ない」形だと書いてあった。実際には
   * **入れ物の形とは関係なく**次の順で膨らんでいた:
   *   ①カードもその親も高さが中身で決まる（＝高さが未定）ので、`h-full`（高さ100%）は解けず auto になる
   *   ②中の <img> も `h-full w-full` で同じく解けず、**写真そのものの大きさ**（実測600px）で並ぶ
   *   ③`aspect-square` がその600pxを一辺にして、行が600px超の正方形になる
   *   ④料理名に残る幅は4px（実測）＝画面から消える
   * 写真のある記録なら**どこでも**起きる不具合で、月の日の窓だけでなく週タブの過ぎた日でも
   * 同じ実測が出た（scripts/e2e-smoke.mjs の CARDSMALL-01 が両方を測る）。
   * 「入れ物が正方形なら全面に広がる」を当てにしている場所は1つも無い
   * （月のカレンダーのマスは RecipeCard ではなく MealPlanPage の MonthDayCell が描いている）ので、
   * **絵の一辺を 44px に決め打つ**形へ直した＝入れ物の高さが決まっていてもいなくても同じ大きさになる。
   *
   * 載せるのは絵と名前だけ。時間・手間・季節・食材チップ・お気に入りは出さない
   * （出すと1行に収まらず、狭い場所ほど読めなくなる）。NG食材の警告だけは安全に関わるので、
   * 場所を取らない小さな印として角に重ねる。
   */
  if (density === 'small') {
    const tone = muted
      ? 'border-edge-card bg-app/60 text-ink-muted opacity-70'
      : 'border-edge-card bg-surface text-ink'
    return pressable(
      `relative flex h-full min-h-[var(--tap-min)] w-full min-w-0 items-stretch gap-1 overflow-hidden rounded-card border ${tone} ${
        disabled ? 'opacity-40' : ''
      }`,
      <>
        {/* 絵は「押せる大きさ（44px）の正方形」。縦横とも実寸で決め打つ＝写真の元の大きさにも
            入れ物の高さにも左右されない（便IG・⑫）。行が名前や印で44pxより高くなる場所では
            上端に貼り付かないよう縦中央に置く */}
        {thumb(
          16,
          'h-[var(--tap-min)] w-[var(--tap-min)] shrink-0 self-center overflow-hidden',
        )}
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
        {hasNg &&
          ngBadge({
            withWord: false,
            iconSize: 10,
            cls: 'absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-warning text-app',
          })}
      </>,
      testId ? { 'data-testid': testId } : undefined,
    )
  }

  if (density === 'standard') {
    const tone = muted
      ? 'border-edge-card bg-app/60 text-ink-muted opacity-70'
      : 'border-edge-card bg-surface text-ink'
    return (
      <div
        data-testid={testId}
        className={`relative rounded-card border shadow-sm ${tone} ${disabled ? 'opacity-40' : ''}`}
      >
        {pressable(
          'flex w-full items-center gap-[var(--space-sm)] p-[var(--space-sm)]',
          <>
            {thumb(24, 'h-14 w-14 shrink-0 overflow-hidden rounded-card')}
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
                    {hasNg &&
                      ngBadge({
                        withWord: true,
                        iconSize: 12,
                        cls: 'inline-flex h-5 shrink-0 items-center gap-0.5 rounded-full bg-warning px-1.5 font-bold text-app',
                      })}
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
                  {shows('starter') && recipe.isStarter && (
                    <p className="mt-1 truncate text-[10px] font-bold text-ink-muted">
                      {ja.card.starterBadge}
                    </p>
                  )}
                  {shows('ingredients') && topIngredients.length > 0 && (
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
            カード幅を超えないようにする。
            pointer-events-none は必須(2026-08-19 便HX): このバッジは便HWで押せる面の**外**に
            出たので、指を素通りさせないとバッジの上だけレシピ詳細へ行けない死角になる
            (390px幅の実機で、リスト表示のバッジを押しても何も起きないことを実測)。
            「大」の同じ役目の重ね表示は最初からこの扱いなので、そちらに揃える */}
        {nutrientBadgeText && (
          <span className="pointer-events-none absolute bottom-1.5 right-1.5 max-w-[50%] truncate rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-on-accent shadow-sm">
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
      className="relative h-full overflow-hidden rounded-card bg-surface shadow-sm border border-edge-card"
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
            {shows('starter') && recipe.isStarter && (
              <span className="absolute bottom-1.5 left-1.5 line-clamp-2 max-w-[70%] rounded-full bg-surface/90 px-2 py-0.5 text-[10px] font-bold text-ink-muted shadow-sm">
                {ja.card.starterBadge}
              </span>
            )}
            {/* 主要食材チップ（先頭3つ）を写真の右下に重ねる */}
            {shows('ingredients') && topIngredients.length > 0 && (
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
          {hasNg &&
            ngBadge({
              withWord: true,
              iconSize: 14,
              cls: 'flex h-7 max-w-full items-center gap-1 rounded-full bg-warning px-2 text-[10px] font-bold text-app shadow-sm',
            })}
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
