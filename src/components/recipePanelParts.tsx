// ==========================================================================================
// レシピ一覧の「並び替え」「絞り込み」パネルが共通で使う部品（2026-08-27 便LM）。
//
// 2026-08-10 便FF で分かれた2つのパネルは、どちらも
//   ・貼り付く検索バーの下に重ねて出す（PANEL_CLS・usePanelMaxHeight）
//   ・チップ（chipCls）・☑付きの単一選択リスト（CheckList）・プルダウン（FilterSelect）
// という同じ作りをしている。**2つのパネルを別のファイルへ出すと、この共通の部分が
// 2か所に写ってしまう**ので、先にここへ1か所として置く。
//
// ここに置いてあるものは 2026-08-27 より前は src/pages/RecipesPage.tsx の中にあった。
// **見た目も動きも1つも変えていない**（どのファイルに書いてあるかだけを変えた）。
// ==========================================================================================
import { useEffect, useRef, useState, type RefObject } from 'react'
import { ChevronDown, Square, SquareCheck } from 'lucide-react'

/**
 * 並び替え／絞り込みパネルの箱（2026-08-10 便FF）。
 *
 * 一覧の上に重ねて出すので、
 *  - pointer-events-auto: 親の入れ物で切ったタップをパネルの中だけ戻す
 *  - bg-surface: 下の一覧が透けないよう不透明にする（重ねる以上、透けると読めない）
 *  - overflow-y-auto: 画面からはみ出す長さのときはパネルの中だけをスクロールさせる
 *    （高さは下の usePanelMaxHeight が実測して入れる。calc の値は測り終わるまでの控え）
 *  - overscroll-contain: パネルの端まで送っても、後ろの一覧が動かないようにする
 *    ＝開いている間にスクロール位置が変わらない
 */
export const PANEL_CLS =
  'pointer-events-auto mt-[var(--space-sm)] max-h-[calc(100dvh-14rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-md border border-edge bg-surface px-[var(--space-md)] pb-[var(--space-md)] shadow-md'

/** パネルと画面の縁（貼り付く検索バー・下のタブナビ）のあいだに残す余白（px） */
const PANEL_EDGE_GAP = 8
/** これ以上は縮めない高さ（px）。極端に低い画面でもパネルが潰れて読めなくならないように */
const PANEL_MIN_HEIGHT = 240

/**
 * 重ねて出すパネルの高さの上限を実測する（2026-08-10 便FF）。
 *
 * パネルの上端は検索バーの下端。検索バーは画面上部に貼り付くので、上端の位置は
 * 「一覧のどこを見ているか」で変わる（先頭では見出しのぶん下、スクロール中は画面の上）。
 * さらにレシピの登録件数の案内が出ている日は検索バーがもう一段下がる。
 * そのため固定値では決められず、開いている間だけ実際の位置を測って上限を入れる。
 * 下はタブナビ・タイマーの浮遊バー（`data-app-bottom-bar`）の手前で止める。
 */
export function usePanelMaxHeight(
  open: boolean,
  barRef: RefObject<HTMLDivElement | null>,
  /**
   * 下の縁を決める要素（2026-08-27 便LN）。渡さなければ従来どおり `[data-app-bottom-bar]` を測る。
   *
   * 「レシピから追加」の選択画面のように**画面いっぱいの窓の中**にパネルを出すときは、
   * 下の縁がタブナビではなく**その窓自身の下のボタン**になる。窓はタブナビの上に重なっているので、
   * `[data-app-bottom-bar]` を測ると窓の中に無い帯の高さで止めてしまい、
   * パネルが窓の下のボタンに潜り込む（またはその手前で余計に縮む）。
   */
  bottomRef?: RefObject<HTMLElement | null>,
) {
  const [maxHeight, setMaxHeight] = useState<number>()
  useEffect(() => {
    if (!open) return
    const update = () => {
      const bar = barRef.current
      if (!bar) return
      const top = bar.getBoundingClientRect().bottom + PANEL_EDGE_GAP
      let bottomInset = 0
      const ownBottom = bottomRef?.current
      if (ownBottom) {
        const r = ownBottom.getBoundingClientRect()
        if (r.height > 0) bottomInset = Math.max(0, window.innerHeight - r.top)
      } else {
        for (const el of document.querySelectorAll<HTMLElement>('[data-app-bottom-bar]')) {
          const r = el.getBoundingClientRect()
          if (r.height > 0 && r.top < window.innerHeight)
            bottomInset = Math.max(bottomInset, window.innerHeight - r.top)
        }
      }
      const bottom = window.innerHeight - bottomInset - PANEL_EDGE_GAP
      setMaxHeight(Math.max(PANEL_MIN_HEIGHT, Math.round(bottom - top)))
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [open, barRef, bottomRef])
  return maxHeight
}

/**
 * 窓の外をタップしたら閉じる（2026-08-19 便HU・⑰ オーナー「並び替えと絞り込みの窓は、
 * 窓の外タップでも閉じるようにして」。2026-08-27 便LN で src/pages/RecipesPage.tsx から
 * ここへ出した＝「レシピから追加」の選択画面でも**同じ閉じ方**にするため。中身は変えていない）。
 *
 * 「窓の中か外か」は**指を置いた時点（pointerdown）で決める**。押した中身が押した結果
 * 消えることがあるため（例:「条件をクリア」は押すと条件が無くなってボタン自体が消える）、
 * 離した後（click）に調べると「もう画面に無い＝窓の外」と誤って読み、窓が勝手に閉じる。
 * 実際に便HUの実機確認で「条件をクリアを押すと絞り込みの窓ごと閉じる」が起きた。
 *
 * 閉じるのは離したとき（click）だけ: 指を滑らせて一覧をスクロールしただけでは閉じない
 * （料理中に片手で触る画面なので、スクロールの押し始めが「閉じる」に化けないようにする）。
 * 並び替え/絞り込みのボタン自身は自前で開閉を持っているので、ここでは触らない
 * （両方が働くと、押した瞬間に開いてすぐ閉じる）＝目印は `data-panel-toggle`。
 *
 * 【画面いっぱいの下敷き（透明な板）を置かない理由・2026-08-19 便HU】
 * はじめは窓の外のタップを受け止めるために `fixed inset-0` の下敷きを開くときだけ
 * 置いていた。ところがそのぶんの描き直しでブラウザが数十ミリ秒ふさがり、
 * **折りたたみが開くときのアニメーション（Collapse）が出なくなった**
 * （中身を置く描き直しより先に「開き切った高さ」の指示が届き、0→高さの変化が起きない。
 * オーナー実機指摘で入った動きなので、消してはいけないもの。e2eのEO-01が捕まえた）。
 * 下敷きを置く代わりに、いちばん外側でタップを掴み取って（capture）その1回を使い切る形にした。
 * 画面に足すものが無いので、開くときの描き直しは元のまま＝アニメーションが戻る。
 */
export function useOutsidePanelClose(
  open: boolean,
  wrapRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const pressedOutsideRef = useRef(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    if (!open) return
    const isOutside = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      if (wrapRef.current?.contains(target)) return false
      if (target.closest('[data-panel-toggle]')) return false
      return true
    }
    const onPointerDown = (e: PointerEvent) => {
      pressedOutsideRef.current = isOutside(e.target)
    }
    const onClickCapture = (e: MouseEvent) => {
      const outside = pressedOutsideRef.current
      // キーボード操作など、指を置いた記録が無いまま来たときは閉じない側に倒す
      pressedOutsideRef.current = false
      if (!outside) return
      // 窓の外の1回目のタップは「窓を閉じる」だけに使い、その下にあるものには渡さない
      // （レシピのカードの上で閉じたつもりが、そのレシピが開いてしまうのを防ぐ）。
      // いちばん外側の掴み取り（capture）なので、画面側のどの操作よりも先に決められる
      e.preventDefault()
      e.stopPropagation()
      closeRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('click', onClickCapture, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('click', onClickCapture, true)
      pressedOutsideRef.current = false
    }
  }, [open, wrapRef])
}


export const chipCls = (active: boolean) =>
  `rounded-sm border px-3 py-2 text-sm font-bold ${
    active ? 'border-accent bg-accent text-on-accent' : 'border-edge bg-surface text-ink-muted'
  }`

/**
 * 並べ替え・調理時間・手間レベルの単一選択UI(2026-07-16 UI総点検B-7オーナー個別指示)。
 * 従来はチップ/ボタン並びだったが、選択中の項目が一目で分かる☑付き縦リストに変更する
 * (radioの見た目を☑にするだけで、複数選択にはしない。AskUserで確認済み)。
 * 選択中の行はアクセント背景+白文字(bg-accent text-on-accent。2026-07-16 便T-6オーナー指示。
 * 行の背景が角からはみ出さないようコンテナにoverflow-hiddenを併せて付ける)
 */
export function CheckList<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: { value: T; label: string }[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <div className="mt-1 divide-y divide-edge overflow-hidden rounded-md border border-edge bg-app">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold ${
              selected ? 'bg-accent text-on-accent' : 'text-ink-muted'
            }`}
          >
            {selected ? (
              <SquareCheck size={18} className="shrink-0" aria-hidden />
            ) : (
              <Square size={18} className="shrink-0 opacity-40" aria-hidden />
            )}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 1つだけ選ぶ絞り込みのプルダウン（2026-08-19 便HU・⑬ オーナー
 * 「料理の種別・時間・手間レベルは複数選択できないのでプルダウンにして見た目をシンプルに」）。
 *
 * 調理時間・手間レベルは1つしか選べないので、☑付きの縦リスト（CheckList）だと
 * 選択肢の数だけ縦に伸びる。閉じた1行にすると絞り込みパネル全体が短くなり、
 * 下にある欄までスクロールせずに届く。
 *
 * 高さは .tap-target（44px）と同じ 3rem を下限にして、押せる大きさを小さくしない。
 * appearance-none + 自前の▼で、端末ごとに違う既定の見た目に引きずられないようにする。
 */
export function FilterSelect<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <div className="relative mt-1">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onSelect(e.target.value as T)}
        className="tap-target w-full appearance-none rounded-md border border-edge bg-app py-3 pl-3 pr-10 text-sm font-bold text-ink"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
      />
    </div>
  )
}
