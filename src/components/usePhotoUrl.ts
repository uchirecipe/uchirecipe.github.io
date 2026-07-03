import { useEffect, useState } from 'react'

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
    setUrl(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [photo])

  return url
}
