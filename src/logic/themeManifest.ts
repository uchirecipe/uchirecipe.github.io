/** 配布レシピのテーマ一覧（追加レシピパック/Pro解錠者がテーマ単位で選んで取り込むためのカタログ） */

/** テーマに収録されているレシピ1品分（scripts/build-sets.mjsが原稿から自動生成する） */
export interface ThemeManifestItem {
  title: string
  cookMinutes?: number
}

export interface ThemeManifestEntry {
  id: string
  file: string
  title: string
  description: string
  addedDate: string
  /** 収録レシピの一覧。未解錠でも「中身が何か」を確認できるようテーマ一覧で表示する */
  items?: ThemeManifestItem[]
}

interface ThemeManifestFile {
  themes: ThemeManifestEntry[]
}

/** マニフェストを取得する。オフライン・取得失敗時は静かに空配列を返す(news.tsと同じ割り切り) */
export async function fetchThemeManifest(): Promise<ThemeManifestEntry[]> {
  try {
    const res = await fetch('/sets/manifest.json')
    if (!res.ok) return []
    const data = (await res.json()) as Partial<ThemeManifestFile>
    return Array.isArray(data.themes) ? data.themes : []
  } catch {
    return []
  }
}
