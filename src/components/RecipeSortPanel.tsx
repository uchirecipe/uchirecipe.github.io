// ==========================================================================================
// レシピ一覧の「並び替え」パネル（2026-08-27 便LM で src/pages/RecipesPage.tsx から切り出した）。
//
// 切り出した理由: 同じパネルを「レシピから追加」の選択画面にも出したいのに、
// 2,567行の画面ファイルに直書きされていて持ち出せなかった。
// **見た目も動きも1つも変えていない**（どのファイルに書いてあるかだけを変えた）。
//
// 状態（いまの並べ替え・昇順/降順）はこの部品では持たず、呼び出す画面から渡す。
// レシピ一覧は sessionStorage への保存・URLへの反映・復元まで背負っているので、
// その持ち方を部品の側で決めてしまうと、別の画面（選択画面）が同じ持ち方を強いられる。
// ==========================================================================================
import { Link } from 'react-router-dom'
import { ArrowUpNarrowWide, ArrowDownWideNarrow, Lock } from 'lucide-react'
import Collapse from './Collapse'
import { CheckList, PANEL_CLS, chipCls } from './recipePanelParts'
import {
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_LABELS,
  type RecipeSortOption,
  type SortDirection,
} from '../logic/recipeSort'
import { ja } from '../i18n/ja'

const baseSortOptions: { value: RecipeSortOption; label: string }[] = [
  { value: 'updated', label: ja.search.sortUpdated },
  { value: 'pantryMatch', label: ja.search.sortPantryMatch },
  { value: 'kana', label: ja.search.sortKana },
  { value: 'cooked', label: ja.search.sortCooked },
  // 最近作った順(2026-08-03 オーナー指示)。回数で数える「よく使う順」の隣に置く
  { value: 'recentCooked', label: ja.search.sortRecentCooked },
  // 1食あたりの原価順(2026-08-25 便KS・②。オーナー原文「原価で並び替えもほしい」)。
  // 栄養の並び替えと違って**無料**なので、Proの区分ではなくこちらの並びに入れる
  { value: 'cost', label: ja.search.sortCost },
  // 「基本レシピ順」は2026-07-24 便BN・タスク4で廃止(配布テーマ全廃で無意味化)
]

/**
 * 栄養並び替えの項目（2026-08-19 便HU・⑯で栄養価の表示と同じ8項目にそろえた）。
 * 顔ぶれも名前も logic/recipeSort.ts が栄養表示（logic/nutrition.ts）から引くので、
 * この画面で項目名を書き写さない＝表示と並び替えで違う名前が出ない
 */
const nutrientSortOptions: { value: RecipeSortOption; label: string }[] = NUTRIENT_SORT_OPTIONS.map(
  (value) => ({ value, label: NUTRIENT_SORT_LABELS[value] }),
)
/** 無料版で選べる栄養並び替え（2026-08-01 線引きB': エネルギー順のみ） */
const freeNutrientSortOptions: { value: RecipeSortOption; label: string }[] =
  FREE_NUTRIENT_SORT_OPTIONS.map((value) => ({ value, label: NUTRIENT_SORT_LABELS[value] }))


export type RecipeSortPanelProps = {
  /** 開いているか。閉じているあいだも中身は残す（Collapse の作りをそのまま使う） */
  open: boolean
  /** パネルの高さの上限（px）。usePanelMaxHeight が実測した値。測り終わるまでは undefined */
  maxHeight?: number
  sort: RecipeSortOption
  sortDirection: SortDirection
  /**
   * 並べ替えの種類を選んだとき。
   * 呼ばれた側で「その種類の既定方向に戻す」までを行う（2026-07-13 UI改善）。
   * 例:「五十音順」は常にあ→んから始まる、というこれまでの見え方を保つ
   */
  onSortChange: (sort: RecipeSortOption) => void
  onSortDirectionChange: (direction: SortDirection) => void
  /** 栄養8項目の並び替えが使えるか（無料版はカロリー順だけ・2026-08-01 線引きB'） */
  nutritionUnlocked: boolean
  /** 無料版のときに出す、Pro案内への行き先 */
  proLinkTo: string
  onClose: () => void
}

export default function RecipeSortPanel({
  open,
  maxHeight,
  sort,
  sortDirection,
  onSortChange,
  onSortDirectionChange,
  nutritionUnlocked,
  proLinkTo,
  onClose,
}: RecipeSortPanelProps) {
  // 並び替えパネル(2026-07-16 便T-1で絞り込みパネルから分離)
  return (
    <Collapse open={open} reveal={false}>
      <div
        data-testid="recipes-sort-panel"
        // 絞り込みパネルは上端に貼り付く行(件数)が上余白を持つので、PANEL_CLS には上余白を
        // 入れていない。並べ替えパネルにはその行が無いのでここで足す
        className={`${PANEL_CLS} pt-[var(--space-md)]`}
        style={maxHeight != null ? { maxHeight } : undefined}
      >
        {/* 昇順/降順(2026-08-02 便DFで件数表記の横からこのパネル内へ移動 → 2026-08-03
            オーナー指示でパネルの一番上へ。従来はパネル末尾(栄養価の区分より下)にあり、
            スクロールしないと見えなかった) */}
        <p className="text-sm font-bold text-ink-muted">{ja.search.sortDirectionTitle}</p>
        <div className="mt-1 flex flex-wrap gap-[var(--space-sm)]">
          <button
            type="button"
            onClick={() => onSortDirectionChange('asc')}
            aria-pressed={sortDirection === 'asc'}
            className={`inline-flex items-center gap-1 ${chipCls(sortDirection === 'asc')}`}
          >
            <ArrowUpNarrowWide size={16} aria-hidden />
            {ja.search.sortAsc}
          </button>
          <button
            type="button"
            onClick={() => onSortDirectionChange('desc')}
            aria-pressed={sortDirection === 'desc'}
            className={`inline-flex items-center gap-1 ${chipCls(sortDirection === 'desc')}`}
          >
            <ArrowDownWideNarrow size={16} aria-hidden />
            {ja.search.sortDesc}
          </button>
        </div>

        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.sortTitle}
        </p>
        <CheckList
          options={baseSortOptions}
          value={sort}
          onSelect={onSortChange}
        />
        {/* 「よく使う順」が何を数えた順かを一言で示す(2026-07-29 便CI/C13) */}
        <p className="mt-1 text-xs text-ink-muted">{ja.search.sortCookedHint}</p>
        {/* 原価順を選んでいるあいだだけ、並び方の決めごとを1行で出す(2026-08-25 便KS・②)。
            価格が分からない材料がある品は金額が実際より安く出るので、金額がそろっている品の
            あとにまとめている。常時出すと並び替えの並びが説明文で埋まるため、選んだときだけ */}
        {sort === 'cost' && (
          <p data-testid="sort-cost-hint" className="mt-1 text-xs text-ink-muted">
            {ja.search.sortCostHint}
          </p>
        )}

        {/* 栄養価並び替え(便T-4で5項目をPro機能化 → 2026-08-01 線引きB'でカロリー順のみ無料開放)。
            無料版は「カロリー」だけを選べる欄＋残り4項目のグレーのティーザー行を出し、
            タップで既存のProゲート表現(Lock+ミュート色)からPro案内へ送る */}
        <p className="mt-[var(--space-md)] text-sm font-bold text-ink-muted">
          {ja.search.sortNutritionTitle}
        </p>
        {/* 2026-08-19 便HZ・①(オーナー「並び替え『たんぱく質が多い順〜探せます』削除。
            タイトルのみで目的がわかるため」): 見出しの下に添えていた用途の1行(旧
            sortNutritionHint / sortNutritionFreeHint)を、無料・Proの両方とも消した */}
        <CheckList
          options={nutritionUnlocked ? nutrientSortOptions : freeNutrientSortOptions}
          value={sort}
          onSelect={onSortChange}
        />
        {!nutritionUnlocked && (
          <Link
            to={proLinkTo}
            className="mt-[var(--space-sm)] flex w-full items-start gap-2 rounded-md border border-edge bg-app px-3 py-2.5 text-left text-sm text-ink-muted opacity-60"
          >
            <Lock size={16} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              <span className="font-bold">{ja.search.sortNutritionGate}</span>
              <span className="block text-xs">{ja.search.sortNutritionGateHint}</span>
            </span>
          </Link>
        )}

        {/* 2026-08-19 便HU・⑰: 旧「決定」を廃止。選んだ時点で並び替えは既に効いていて、
            このボタンは閉じるだけだったので、名前を動作に合わせた。
            窓の外のタップと同じ closePanels を呼ぶ＝どちらで閉じても結果は変わらない。
            押したことで何かが決まる見た目にしないよう、塗りではなく枠のボタンにする */}
        <button
          type="button"
          data-testid="sort-panel-close"
          onClick={onClose}
          className="tap-target mt-[var(--space-md)] w-full rounded-md border border-edge bg-surface py-3 font-bold text-accent-ink shadow-sm"
        >
          {ja.common.close}
        </button>
      </div>
    </Collapse>
  )
}
