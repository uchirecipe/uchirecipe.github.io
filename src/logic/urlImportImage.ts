/**
 * 「URLから取り込む」で見つかったレシピ写真(ImportedRecipe.imageUrl)を、Worker側の画像プロキシ
 * (workers/recipe-import/src/index.ts の GET /image?url=)経由で取得する。
 *
 * ベストエフォート専用: 写真が取れなくてもレシピ本体の取り込みは成功のままにするため、
 * この関数はどんな失敗(ネットワークエラー・非2xx・非image Content-Type等)でも例外を投げず
 * undefinedを返す(呼び出し側は「写真だけ無し=従来どおりアイコン表示」として扱う)。
 *
 * urlImport.ts(IMPORT_ENDPOINTの解決にimport.meta.envを使う)とは独立させ、endpointを引数で受け取る
 * ことで、このファイル自体はvite依存ゼロにしてある(scripts/test-logic.mjsからtsxで直接テストできる)。
 */

/** Worker側の画像プロキシ(GET /image)へのURLを組み立てる */
export function buildImageProxyUrl(endpoint: string, imageUrl: string): string {
  return `${endpoint}/image?url=${encodeURIComponent(imageUrl)}`
}

/** レスポンスのContent-Typeが画像(image/*)かどうかを判定する */
export function isImageContentType(contentType: string | null | undefined): boolean {
  return !!contentType && contentType.toLowerCase().startsWith('image/')
}

/**
 * 画像プロキシから画像Blobを取得する。取れなければ(理由を問わず)undefinedを返す。
 * @param endpoint IMPORT_ENDPOINT(空文字なら常にundefined)
 * @param imageUrl 取り込んだレシピの元画像URL(絶対URL)
 */
export async function fetchImportedPhoto(endpoint: string, imageUrl: string): Promise<Blob | undefined> {
  if (!endpoint || !imageUrl) return undefined
  try {
    const res = await fetch(buildImageProxyUrl(endpoint, imageUrl))
    if (!res.ok) return undefined
    if (!isImageContentType(res.headers.get('Content-Type'))) return undefined
    return await res.blob()
  } catch {
    return undefined
  }
}
