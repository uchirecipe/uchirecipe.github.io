import type { RecipeListLayout } from '../db/types'

/**
 * レシピ一覧の「表示形式」と「基本レシピを表示しない」の鏡（2026-09-01 便MV・調査C）。
 *
 * なぜ要るか: 設定の実体は Dexie の settings（非同期）にあり、他の画面から一覧へ戻ると
 * **必ず**レシピの方が先に届く（Dexieはレシピ一覧の問い合わせをキャッシュするが、設定の
 * get はキャッシュしない非対称がある）。そのため一覧を1列に設定していても、初回の描画は
 * 既定の2列で140枚を組み、設定が届いてから1列で全部作り直していた＝「一瞬2列が見える」。
 *
 * 直し方: 検索語やスクロール位置が sessionStorage から同期で読めるのと同じ作法で、
 * この2つだけ localStorage に写しを置き、初回の描画から正しい列数・正しい絞り込みで描く。
 *
 * **Dexieの settings が正**。ここにあるのは「初回描画のための写し」でしかない:
 *  - 読むのは settings が届く前の描画だけ（届いたら settings の値が勝つ）
 *  - settings が届くたびに写しを書き直す（別の端末で変えた値・バックアップ復元も、
 *    一覧を1回開けば写しに反映される。ずれても「今までと同じ挙動が1回だけ」で悪化しない）
 *  - localStorage が使えない環境（プライベートブラウズ等）は今までどおりの既定値で描く
 *    （logic/noticeSeen.ts と同じ try/catch の作法）
 *
 * 2つの値は別々のキーに置く（別の設定なので同じキーに混ぜない）。
 */

/** 表示形式の写しの保存キー（localStorage・端末内のみ） */
export const LIST_LAYOUT_MIRROR_KEY = 'uchirecipe:listLayoutMirror'
/** 「基本レシピを表示しない」の写しの保存キー（localStorage・端末内のみ） */
export const HIDE_STARTERS_MIRROR_KEY = 'uchirecipe:hideStartersMirror'

/** 表示形式の写しを読む（無い・読めない・壊れているときは従来の既定値 'grid'） */
export function readListLayoutMirror(): RecipeListLayout {
  try {
    return window.localStorage.getItem(LIST_LAYOUT_MIRROR_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

/** 「基本レシピを表示しない」の写しを読む（無い・読めないときは従来の既定値 false） */
export function readHideStartersMirror(): boolean {
  try {
    return window.localStorage.getItem(HIDE_STARTERS_MIRROR_KEY) === '1'
  } catch {
    return false
  }
}

/** 写しを書き直す（settings が届くたびに呼ぶ。書けない環境では黙って諦める＝従来の挙動のまま） */
export function writeListPrefsMirror(layout: RecipeListLayout, hideStarters: boolean): void {
  try {
    window.localStorage.setItem(LIST_LAYOUT_MIRROR_KEY, layout)
    window.localStorage.setItem(HIDE_STARTERS_MIRROR_KEY, hideStarters ? '1' : '0')
  } catch {
    // 書けなくても、初回描画が今までどおりの既定値になるだけで、失われるものはない
  }
}
