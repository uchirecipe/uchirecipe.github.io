import { PRO_CODE_HASHES } from './proCodes'

/** コード入力のゆらぎ(全角・小文字・前後の空白)を吸収する */
export function normalizeProCode(code: string): string {
  return code.normalize('NFKC').toUpperCase().trim()
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** 入力されたコードが有効なPro解錠コードか判定する（完全オフラインで動作） */
export async function isValidProCode(code: string): Promise<boolean> {
  const normalized = normalizeProCode(code)
  if (!normalized) return false
  const hash = await sha256Hex(`uchirecipe-pro:${normalized}`)
  return PRO_CODE_HASHES.includes(hash)
}
