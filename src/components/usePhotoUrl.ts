import { useEffect, useState } from 'react'
import { perfCountMark } from '../logic/perfMarks'

/**
 * IndexedDB に保存した写真(Blob)を <img> で表示できる URL に変換するフック。
 * 使い終わった URL はメモリ節約のため自動で破棄する。
 */
export function usePhotoUrl(photo: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (!photo) {
      setUrl(undefined)
      return
    }
    const objectUrl = URL.createObjectURL(photo)
    // 計測の印（?perf=1 のときだけ。logic/perfMarks）。写真のURLを新しく作った＝
    // <img> がその写真を取得・デコードし直す回数を数える
    perfCountMark('photo:objectUrl')
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  return url
}

// ==========================================================================================
// 一覧カード用: 写真URLの使い回し（2026-09-02 便NB。便MV申し送り「写真URLの再デコード22回」）
//
// 背景: Dexie のライブ購読は届くたびに新しいオブジェクト（Blobも）を作る（cache 'cloned'）。
// そのため usePhotoUrl の [photo] 依存が一覧に戻るたびに外れ、同じ写真なのに URL を作り直していた。
// URL が変わると <img> は同じ中身でも取得とデコードをやり直す＝実測で1往復あたり22回
// （CPU4倍・140品・写真22品・買い物→一覧）。写真の中身は「そのレシピが保存し直されない限り
// 同じ」なので、「どのレシピの・いつ保存の・何バイトの写真か」を鍵に URL を使い回す。
//
// メモリの規律（usePhotoUrl の「使い終わったら破棄」を捨てない形にする）:
//  ・入れ物は上限つき（MAX_CACHED_PHOTO_URLS）。あふれたら一番使っていない URL から revoke
//  ・写真が差し替わったら（鍵は同じで判は違う）、その場で古い URL を revoke して作り直す
//  ・写真が外されたら（photo が undefined になったら）、その場で revoke して入れ物からも消す
//  ・レシピの削除ではその場では消えないが、上限があるので溜まり続けない（いずれ押し出される）
// URL が指す Blob は長辺1200pxのJPEG（logic/image.ts の resizePhoto の仕上がり）なので、
// 上限いっぱいでも押さえるのは縮小済み写真のぶんだけ。
// ==========================================================================================

/** 使い回す写真URLの上限。超えたぶんは一番使っていないものから破棄する */
export const MAX_CACHED_PHOTO_URLS = 60

/** 鍵（どのレシピか）→ { 判(いつ保存の・何バイトの写真か), URL }。Mapの並び順をLRUに使う */
const photoUrlCache = new Map<string, { stamp: string; url: string }>()

/** いま入れ物にあるURLの本数（見張り用） */
export function cachedPhotoUrlCount(): number {
  return photoUrlCache.size
}

/** 鍵と判が合う使い回しURLがあれば返す（作りも触りもしない。初回描画から写真を出すため） */
export function peekCachedPhotoUrl(key: string, stamp: string): string | undefined {
  const hit = photoUrlCache.get(key)
  return hit && hit.stamp === stamp ? hit.url : undefined
}

/** 使い回しURLを取り出す（無ければ作る。判が違えば古いURLをその場で破棄して作り直す） */
export function acquireCachedPhotoUrl(key: string, stamp: string, photo: Blob): string {
  const hit = photoUrlCache.get(key)
  if (hit && hit.stamp === stamp) {
    // LRU: 使ったものを一番新しい位置へ（Mapは挿入順を保つので入れ直すだけ）
    photoUrlCache.delete(key)
    photoUrlCache.set(key, hit)
    perfCountMark('photo:cacheHit')
    return hit.url
  }
  if (hit) URL.revokeObjectURL(hit.url) // 写真の差し替え: 前の写真のURLはすぐ破棄
  const url = URL.createObjectURL(photo)
  perfCountMark('photo:objectUrl')
  photoUrlCache.delete(key)
  photoUrlCache.set(key, { stamp, url })
  while (photoUrlCache.size > MAX_CACHED_PHOTO_URLS) {
    const oldestKey = photoUrlCache.keys().next().value
    if (oldestKey === undefined) break
    const oldest = photoUrlCache.get(oldestKey)
    photoUrlCache.delete(oldestKey)
    if (oldest) URL.revokeObjectURL(oldest.url)
  }
  return url
}

/** その鍵のURLを破棄して入れ物からも消す（写真が外されたとき） */
export function dropCachedPhotoUrl(key: string): void {
  const hit = photoUrlCache.get(key)
  if (!hit) return
  photoUrlCache.delete(key)
  URL.revokeObjectURL(hit.url)
}

/**
 * usePhotoUrl の使い回し版（一覧カード用）。
 *
 * @param photo   表示する写真（Dexieから届くたびに新しいBlobになる）
 * @param cacheId レシピの id。**未保存（undefined）なら使い回さず usePhotoUrl と同じ動き**
 * @param stamp   レシピの updatedAt。写真の差し替えは必ず保存（updateRecipe）を通って
 *                updatedAt が進むので、これが変われば「別の写真かもしれない」と判断できる。
 *                さらに photo.size も判に足す＝updatedAt が同じまま中身だけ違う写真が来る
 *                筋（バックアップの読み込み等）でも、バイト数の違いで作り直せる
 *
 * 返るURLの持ち主は上の入れ物（このフックではない）なので、アンマウントでは revoke しない。
 * だからこそ一覧→詳細→一覧のように出入りしても、同じURL＝デコード済みの写真をそのまま出せる。
 */
export function useCachedPhotoUrl(
  photo: Blob | undefined,
  cacheId: number | undefined,
  stamp: number,
): string | undefined {
  const key = cacheId === undefined ? undefined : `recipe:${cacheId}`
  const fullStamp = `${stamp}:${photo?.size ?? 0}`
  // 初回描画から使い回しURLで描く（effectを待つと「枠が出てから写真が入る」1回ぶんの
  // 描き直しが全カードで走る。便MV実測の「写真22」の再描画はここで消える）
  const [url, setUrl] = useState<string | undefined>(() =>
    photo && key !== undefined ? peekCachedPhotoUrl(key, fullStamp) : undefined,
  )

  useEffect(() => {
    if (!photo) {
      if (key !== undefined) dropCachedPhotoUrl(key)
      setUrl(undefined)
      return
    }
    if (key === undefined) {
      // 鍵が無い（未保存のレシピ等）: 従来どおり作って、使い終わったら破棄
      const objectUrl = URL.createObjectURL(photo)
      perfCountMark('photo:objectUrl')
      setUrl(objectUrl)
      return () => URL.revokeObjectURL(objectUrl)
    }
    // 同じURLなら setUrl は同じ値＝Reactは描き直さない（余計な1回が増えない）
    setUrl(acquireCachedPhotoUrl(key, fullStamp, photo))
  }, [photo, key, fullStamp])

  return url
}
