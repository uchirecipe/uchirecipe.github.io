// ==========================================================================================
// レシピ一覧の「絞り込み」パネル（2026-08-27 便LM で src/pages/RecipesPage.tsx から切り出した）。
//
// 切り出した理由: 同じパネルを「レシピから追加」の選択画面にも出したいのに、
// 2,567行の画面ファイルに直書きされていて持ち出せなかった。
// **見た目も動きも1つも変えていない**（どのファイルに書いてあるかだけを変えた）。
//
// 【状態の持ち方】絞り込みの条件そのものは RecipeFilterValues という1つの形にまとめ、
// 「いまの値（values）」と「変わった分だけを返す（onChange）」の2つで受け渡す。
// 条件は11個あり、値と書き換えの受け口を1つずつ渡すと props が22個になる＝
// 同じパネルを載せる画面が増えるたびに、その22個を書き写すことになるため。
// 一方、タグの顔ぶれ・登録したタグの削除・在庫の食材のように**画面の外（DBや設定）を
// 読み書きするもの**は条件ではないので、これまでどおり個別の props で受け取る。
// ==========================================================================================
import { Refrigerator, Trash2 } from 'lucide-react'
import Collapse from './Collapse'
import ChipInput from './ChipInput'
import { FilterSelect, PANEL_CLS, chipCls } from './recipePanelParts'
import { DISH_TYPE_OPTIONS } from '../logic/homeSuggest'
import { EFFORT_FILTER_LEVELS } from '../logic/effort'
import type {
  DishTypeFilter,
  EffortFilter,
  TagMatchMode,
  TimeFilter,
} from '../logic/search'
import { ja } from '../i18n/ja'

const timeOptions: { value: TimeFilter; label: string }[] = [
  { value: 'all', label: ja.search.timeAll },
  { value: 'under10', label: ja.search.timeUnder10 },
  { value: 'under30', label: ja.search.timeUnder30 },
  { value: 'over30', label: ja.search.timeOver30 },
]

/* 絞り込みに出す手間レベル（2026-08-23 便JP・②追補・オーナー指示「絞り込みからも普通はずして」）。
   顔ぶれは logic/effort.ts の EFFORT_FILTER_LEVELS が決める＝カードにバッジを出す規則と同じ1か所。
   既定値の「普通」には、選んだ品と選ばなかった品が混ざって落ちてくるので条件にならない */
const effortOptions: { value: EffortFilter; label: string }[] = [
  { value: 'all', label: ja.search.effortAll },
  ...EFFORT_FILTER_LEVELS.map((level) => ({ value: level, label: ja.effort[level] })),
]

/**
 * 料理の種別の絞り込み（2026-08-10 便FF・オーナー要望「主菜副菜などでも絞り込みしたい」）。
 * 区分と並びはレシピ登録の「料理の種別」・献立の「今日なに作る？」と同じ4つを使う
 * （logic/homeSuggest.ts DISH_TYPE_OPTIONS）。4区分は互いに重ならず、合わせると全レシピを覆う。
 *
 * 2026-08-19 便HU・⑬（オーナー「料理の種別については複数選択できても良いと思う」）:
 * **複数選べるチップ**にした（調理時間・手間レベルはプルダウンへ）。複数選べるプルダウンは
 * スマホで押しづらく、選んでいる中身も閉じた状態から読めないため、種別だけはチップのまま残す。
 * 押す回数は選ぶ1回で変わらない（従来の☑リストと同じ）。
 */
const dishTypeOptions: { value: DishTypeFilter; label: string }[] = DISH_TYPE_OPTIONS.map(
  (value) => ({ value, label: ja.dishType[value] }),
)

/**
 * 絞り込みの条件そのもの（2026-08-27 便LM）。
 * この11個がそろえば「一覧に何が出るか」が決まる＝logic/search.ts の searchRecipes に渡す顔ぶれと同じ。
 * どの画面でも同じ形で持てるように、パネルの側では持たず、値として受け取る。
 */
export type RecipeFilterValues = {
  ingredients: string[]
  time: TimeFilter
  effort: EffortFilter
  tags: string[]
  keywords: string[]
  tagMatch: TagMatchMode
  dishTypes: DishTypeFilter[]
  favoriteOnly: boolean
  excludeNg: boolean
  quickOnly: boolean
  pantryOnly: boolean
}

/** チップの顔ぶれ（名前と、その名前で絞ったときの品数を入れた見出し） */
export type RecipeFilterTagOption = { value: string; label: string }

export type RecipeFilterPanelProps = {
  /** 開いているか。閉じているあいだも中身は残す（Collapse の作りをそのまま使う） */
  open: boolean
  /** パネルの高さの上限（px）。usePanelMaxHeight が実測した値。測り終わるまでは undefined */
  maxHeight?: number
  values: RecipeFilterValues
  /** 変わった条件だけを返す。受け取った側が自分の持ち方（useState・保存）に書き込む */
  onChange: (patch: Partial<RecipeFilterValues>) => void
  /** 「条件をクリア」を出すか（並べ替えと「自分で登録したレシピのみ」も含めた判定） */
  anyConditionActive: boolean
  onClear: () => void
  /** 上端に貼り付く行の品数。絞り込み中は「◯品 / 全◯品」、そうでなければ「全◯品」 */
  filterActive: boolean
  resultCount?: number
  totalCount?: number
  /** 「自分で登録したレシピのみ」。条件ではなく設定に保存する項目なので別に受け取る */
  hideStarters: boolean
  onToggleHideStarters: () => void
  /** もとからあるタグ／自分で登録したタグのチップ */
  tagOptions: RecipeFilterTagOption[]
  savedTagOptions: RecipeFilterTagOption[]
  onRemoveSavedSearch: (name: string) => void
  /** 以前の版がレシピ本体に書き込んだタグ（残っているものだけ） */
  legacyTagUsages: { tag: string; count: number }[]
  onRemoveLegacyTag: (name: string, count: number) => void
  /** タグの書き換え中は押せなくする */
  tagBusy: boolean
  /** 在庫（ある／少ない）の食材名。1件も無ければ在庫の欄を出さない */
  pantryNames: string[]
  onClose: () => void
}

export default function RecipeFilterPanel({
  open,
  maxHeight,
  values,
  onChange,
  anyConditionActive,
  onClear,
  filterActive,
  resultCount,
  totalCount,
  hideStarters,
  onToggleHideStarters,
  tagOptions,
  savedTagOptions,
  onRemoveSavedSearch,
  legacyTagUsages,
  onRemoveLegacyTag,
  tagBusy,
  pantryNames,
  onClose,
}: RecipeFilterPanelProps) {
  const {
    ingredients,
    time,
    effort,
    tags,
    keywords,
    tagMatch,
    dishTypes,
    favoriteOnly,
    excludeNg,
    quickOnly,
    pantryOnly,
  } = values
  /** 押すたびに入れ替える（もともと画面の側にあった toggleTag / toggleKeyword / toggleDishType と同じ中身） */
  const toggleIn = <T,>(list: T[], value: T) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  // 絞り込みパネル(2026-07-16 便T-3: 「条件をクリア」を欄の上方に移動)
  return (
    <Collapse open={open} reveal={false}>
      <div
        data-testid="recipes-filter-panel"
        className={PANEL_CLS}
        style={maxHeight != null ? { maxHeight } : undefined}
      >
        {/* パネルの上端に貼り付く行(2026-08-10 便FF)。一覧の上に重ねて出すようになり、
            一覧の上に常設している件数の行がパネルに隠れるため、いま何件になっているかを
            パネルの中でも見られるようにする。条件を変えるたびに動く数字なので、
            パネルを下まで送っても見えるよう上端に貼り付ける。
            「条件をクリア」は2026-07-16 便T-3で欄の上方へ置いたものを、この行にまとめた */}
        <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-2 bg-surface px-4 pb-2 pt-4">
          {anyConditionActive ? (
            <button
              type="button"
              onClick={onClear}
              className="text-sm font-bold text-accent-ink underline"
            >
              {ja.search.clear}
            </button>
          ) : (
            <span />
          )}
          {resultCount !== undefined && totalCount !== undefined && (
            <span data-testid="filter-panel-count" className="shrink-0 text-sm text-ink-muted">
              {filterActive
                ? ja.search.resultCountWithTotal
                    .replace('{n}', String(resultCount))
                    .replace('{t}', String(totalCount))
                : ja.search.totalCount.replace('{n}', String(totalCount))}
            </span>
          )}
        </div>

        {/* --- 区分①「どのレシピから探すか」 ---
            2026-08-03 オーナー指示でパネルの最上段に置いた区分(「お気に入り」など毎回使う
            条件が一番下にあって見えていなかったため)。位置はそのまま。
            2026-08-10 便FF(オーナー「在庫の食材、NG食材隠しのタグ、登録したレシピのみ、が
            同列で並んでいるのもわかりにくくしている」): 性質の違う「在庫の食材で絞る」を
            区分③「食材で絞り込む」へ移し、ここは『一覧に出すレシピの母集団を決める』3つだけにした */}
        <p className="text-sm font-bold text-ink-muted">{ja.search.shownRecipesTitle}</p>
        <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => onChange({ favoriteOnly: !favoriteOnly })}
            aria-pressed={favoriteOnly}
            className={chipCls(favoriteOnly)}
          >
            {ja.search.favoriteOnly}
          </button>
          <button
            type="button"
            onClick={() => onChange({ excludeNg: !excludeNg })}
            aria-pressed={excludeNg}
            className={chipCls(excludeNg)}
          >
            {ja.search.excludeNg}
          </button>
          <button
            type="button"
            onClick={onToggleHideStarters}
            aria-pressed={hideStarters}
            className={chipCls(hideStarters)}
          >
            {ja.search.myRecipesOnly}
          </button>
        </div>

        {/* --- 区分②「料理の種別」(2026-08-10 便FF・オーナー要望
            「主菜副菜などでも絞り込みしたい（タグ）」) ---
            主菜/副菜はタグではなくレシピの項目(dishType)なので、タグのチップに混ぜず
            専用の区分にする。区分名と選択肢はレシピ登録の「料理の種別」と同じ4つ。

            2026-08-19 便HU・⑬(オーナー「料理の種別については複数選択できても良いと思う」):
            **複数選べるチップ**にした。「主菜と汁物だけ見たい」のように、まとめて見たい組み合わせが
            あるため。調理時間・手間レベルは1つしか選べないのでプルダウンにしたが、種別は
            複数選べる以上プルダウンにすると「いま何を選んでいるか」が閉じた状態から読めない。
            1つ選ぶのに要る操作は1回のままで、☑付きリストのときから増えていない */}
        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.dishTypeTitle}
        </p>
        <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
          {/* 選んだ区分をまとめて外して元に戻すチップ。何も選んでいない＝すべて */}
          <button
            type="button"
            data-testid="recipes-dishtype-chip"
            onClick={() => onChange({ dishTypes: [] })}
            aria-pressed={dishTypes.length === 0}
            className={chipCls(dishTypes.length === 0)}
          >
            {ja.search.dishTypeAll}
          </button>
          {dishTypeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              data-testid="recipes-dishtype-chip"
              onClick={() => onChange({ dishTypes: toggleIn(dishTypes, option.value) })}
              aria-pressed={dishTypes.includes(option.value)}
              className={chipCls(dishTypes.includes(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* --- 区分③「タグ」(2026-07-24 便BN・タスク3で絞り込みパネルの上部へ移動 →
            2026-08-03 使用件数の集計に変更 → 2026-08-10 便FFで件数を併記・見出しを改称 →
            2026-08-19 便HZ・③で複数選択に → 便IB・②で「自分で登録したタグ」もこの並びへ) ---

            便IB・②(オーナー実機フィードバック「絞り込みタグは、実質キーワード検索？
            説明に『タグが付いているレシピの品数』とあるので、表現を揃えたい。やりたいことは
            『好きなキーワードをよく使うタグとして絞り込みに登録したい』):
            直す前は、同じ「タグ」でも**押したときの効き方が違う2つ**が別々の欄に並んでいた
            (もとからあるタグ=複数選択に入る／登録したタグ=検索欄に言葉が入るだけ)。
            利用者から見ればどちらも「絞り込みに使うタグ」なので、1つの並びにまとめ、
            押したときの効き方(複数選択・下のスイッチ)も数字の出し方もそろえる。
            並び順は「登録したタグ→もとからあるタグ(品数の多い順)」。登録したタグは数が少なく、
            消す操作もここにあるので、件数で埋もれない先頭に固定する。
            チップの数字はどちらも「そのタグだけで絞り込んだときの品数」で意味が同じ */}
        {(tagOptions.length > 0 || savedTagOptions.length > 0) && (
          <>
            <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
              {ja.search.tagTitle}
            </p>
            <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
              <button
                type="button"
                data-testid="recipes-tag-chip"
                onClick={() => onChange({ tags: [], keywords: [] })}
                aria-pressed={tags.length === 0 && keywords.length === 0}
                className={chipCls(tags.length === 0 && keywords.length === 0)}
              >
                {ja.search.tagAll}
              </button>
              {/* 自分で登録したタグ。チップの形はもとからあるタグと同じにし、
                  自分で作ったものだけ消せるように削除ボタンを隣に添える
                  (押せる大きさは tap-target で確保する) */}
              {savedTagOptions.map((option) => (
                <span key={option.value} className="inline-flex items-center">
                  <button
                    type="button"
                    data-testid="recipes-saved-search-chip"
                    onClick={() => onChange({ keywords: toggleIn(keywords, option.value) })}
                    aria-pressed={keywords.includes(option.value)}
                    className={chipCls(keywords.includes(option.value))}
                  >
                    {option.label}
                  </button>
                  <button
                    type="button"
                    data-testid="recipes-saved-search-remove"
                    onClick={() => onRemoveSavedSearch(option.value)}
                    disabled={tagBusy}
                    aria-label={ja.search.savedSearchRemoveAria.replace('{name}', option.value)}
                    className="tap-target rounded-sm px-1.5 py-2 text-ink-muted disabled:opacity-40"
                  >
                    <Trash2 size={16} aria-hidden />
                  </button>
                </span>
              ))}
              {tagOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  data-testid="recipes-tag-chip"
                  onClick={() => onChange({ tags: toggleIn(tags, option.value) })}
                  aria-pressed={tags.includes(option.value)}
                  className={chipCls(tags.includes(option.value))}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* チップの数字が何を指すのか(2026-08-19 便HZ・③ → 便IB・②)。複数選べるので
                「押したら何品になるか」と読み違えられるため、数字の意味を1行で示す。
                この数字は選んでいるタグや下のスイッチでは変わらない */}
            <p className="mt-1 text-xs text-ink-muted">{ja.search.tagCountHint}</p>
            {/* タグを2つ以上選んだときの選び方(2026-08-19 便HZ・③ → 便IB・① オーナー実機
                フィードバック「絞り込みタグ複数選択のANDとORの切り替えは、『すべてのタグを含む』と
                ON/OFFスイッチの方がわかりやすいかも」)。2つのチップからスイッチ1つにした。
                形はアプリに既にあるON/OFFスイッチ(設定の「画面を暗くしない」等)と同じ作法
                ——role="switch"+aria-checked、見出しの右にスイッチ、押せる面は tap-target。
                1つしか選んでいないときも出したままにする: 入れても結果は変わらないだけで
                間違った結果にはならず、タグを押すたびに欄が出入りして押す位置がずれる方が危ない */}
            <label className="mt-[var(--space-sm)] flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm font-bold text-ink-muted">
                {ja.search.tagMatchAllSwitch}
              </span>
              <button
                type="button"
                role="switch"
                data-testid="recipes-tag-match"
                aria-checked={tagMatch === 'all'}
                aria-label={ja.search.tagMatchAllSwitch}
                onClick={() => onChange({ tagMatch: tagMatch === 'all' ? 'any' : 'all' })}
                className={`tap-target relative h-8 w-14 shrink-0 rounded-full transition-colors ${
                  tagMatch === 'all' ? 'bg-accent' : 'bg-edge'
                }`}
              >
                <span
                  className={`absolute top-1 h-6 w-6 rounded-full bg-surface shadow-sm transition-all ${
                    tagMatch === 'all' ? 'left-7' : 'left-1'
                  }`}
                />
              </button>
            </label>
          </>
        )}

        {/* 以前の版(便HU・⑭)がレシピ本体に書き込んだタグの後始末(2026-08-19 便HZ・②)。
            書き込まれたタグを作り直しに合わせて黙って外すとデータを失うので、
            残したままにもできる形にして、外したいときだけ外せる道をここに置く。
            残っていなければ欄ごと出さない＝使ったことのない人には最初から出ない */}
        {legacyTagUsages.length > 0 && (
          <>
            <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
              {ja.search.legacyTagTitle}
            </p>
            <p className="mt-1 text-xs text-ink-muted">{ja.search.legacyTagHint}</p>
            <div className="mt-1 flex flex-col gap-[var(--space-sm)]">
              {legacyTagUsages.map(({ tag: name, count }) => (
                <button
                  key={name}
                  type="button"
                  data-testid="recipes-legacy-tag-remove"
                  onClick={() => onRemoveLegacyTag(name, count)}
                  disabled={tagBusy}
                  aria-label={ja.search.legacyTagRemoveAria
                    .replace('{name}', name)
                    .replace('{n}', String(count))}
                  className="tap-target flex w-full items-center justify-between gap-[var(--space-sm)] rounded-sm border border-edge bg-surface px-3 py-2 text-left text-sm font-bold text-ink-muted disabled:opacity-40"
                >
                  <span className="min-w-0 truncate">{name}</span>
                  <span className="shrink-0 text-accent-ink">
                    {ja.search.legacyTagRemove.replace('{n}', String(count))}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* --- 区分④「食材で絞り込む」 ---
            2026-08-10 便FF: 「在庫の食材で絞る」を区分①からここへ移した。
            どちらも食材で一覧を絞る操作で、「食材の在庫から入れる」とも隣り合う */}
        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.ingredientTitle}
        </p>
        {/* 在庫の食材で絞る(2026-07-24 便BN・司令部追加)。在庫(ある/少ない)が1件以上あるときだけ出す */}
        {pantryNames.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
            <button
              type="button"
              onClick={() => onChange({ pantryOnly: !pantryOnly })}
              aria-pressed={pantryOnly}
              className={`inline-flex items-center gap-1 ${chipCls(pantryOnly)}`}
            >
              <Refrigerator size={16} aria-hidden />
              {ja.search.pantryFilter}
            </button>
          </div>
        )}
        <p className="mt-[var(--space-sm)] text-sm text-ink-muted">
          {ja.search.ingredientSubTitle}
        </p>
        <div className="mt-1">
          <ChipInput
            values={ingredients}
            onChange={(next) => onChange({ ingredients: next })}
            placeholder={ja.search.ingredientPlaceholder}
            addLabel={ja.search.ingredientAdd}
          />
          {/* 食材の在庫にある食材を、この欄へ1タップで入れる(2026-08-02 オーナー指示・便DF)。
              従来も同じボタンがあったが、①文言が「在庫から追加」で何がどこへ入るのか読めず
              ②「ある/少ない」が1件も無いと消えていて、押せない理由も分からなかった。
              ボタンは常に出し、入れられる食材が無いときは押せない状態＋理由を1行で示す */}
          <button
            type="button"
            onClick={() => onChange({ ingredients: Array.from(new Set([...ingredients, ...pantryNames])) })}
            disabled={pantryNames.length === 0}
            className="mt-[var(--space-sm)] inline-flex items-center gap-1 rounded-sm border border-edge bg-surface px-3 py-2 text-sm font-bold text-accent-ink shadow-sm disabled:opacity-40"
          >
            <Refrigerator size={16} aria-hidden />
            {ja.search.pantryToIngredients}
          </button>
          {pantryNames.length === 0 && (
            <p className="mt-1 text-xs text-ink-muted">{ja.search.pantryToIngredientsEmpty}</p>
          )}
        </div>

        {/* --- 区分⑤「調理時間」(2026-07-16 UI総点検B-7: ☑付き単一選択リスト →
            2026-08-19 便HU・⑬でプルダウン。1つしか選べない欄なので、閉じた1行にして
            パネル全体を短くする) --- */}
        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.timeTitle}
        </p>
        <FilterSelect
          label={ja.search.timeTitle}
          options={timeOptions}
          value={time}
          onSelect={(next) => onChange({ time: next })}
        />
        {/* 時短版の手順(quickSteps)があるレシピだけに絞る独立トグル。単一選択の並べ替え・時間・
            手間とは別枠のON/OFFなのでチップのまま維持する。有効な間は一覧カードの調理時間表示も
            quickCookMinutesに切り替わる(2026-07-11 オーナー実機フィードバック) */}
        <div className="mt-[var(--space-sm)] flex flex-wrap gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => onChange({ quickOnly: !quickOnly })}
            className={chipCls(quickOnly)}
          >
            {ja.search.quickOnly}
          </button>
        </div>

        {/* --- 区分⑥「手間レベル」(2026-07-16 UI総点検B-7: ☑付き単一選択リスト →
            2026-08-19 便HU・⑬でプルダウン。調理時間と同じ理由) --- */}
        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.effortTitle}
        </p>
        <FilterSelect
          label={ja.search.effortTitle}
          options={effortOptions}
          value={effort}
          onSelect={(next) => onChange({ effort: next })}
        />

        {/* 2026-08-19 便HU・⑰: 旧「決定」を廃止（並び替えパネルと同じ理由・同じ形） */}
        <button
          type="button"
          data-testid="filter-panel-close"
          onClick={onClose}
          className="tap-target mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
        >
          {ja.common.close}
        </button>
      </div>
    </Collapse>
  )
}
