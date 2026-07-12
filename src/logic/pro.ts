import { PRO_CODE_HASHES } from './proCodes'
import { RECIPE_PACK_CODE_HASHES } from './recipePackCodes'
import { sha256Hex as sha256HexFallback } from './sha256'
import type { Settings } from '../db/types'

/** コード入力のゆらぎ(全角・小文字・前後の空白)を吸収する */
export function normalizeProCode(code: string): string {
  return code.normalize('NFKC').toUpperCase().trim()
}

/**
 * crypto.subtleがあればそれを使い、無ければ純JS実装(sha256.ts)にフォールバックする。
 * crypto.subtleはsecure context(https://またはlocalhost)でしか使えず、開発中LANの
 * http://192.168.x.x:5173 のような実機テストでは undefined になるため(2026-07-13対応)。
 * forceFallbackはテスト用の注入フック(scripts/test-logic.mjsから両経路を検証するため)で、
 * 通常の呼び出しでは指定しない(=自動判定)。
 */
async function sha256Hex(text: string, forceFallback = false): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  if (!forceFallback && typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
  return sha256HexFallback(bytes)
}

/** 入力されたコードが有効なPro解錠コードか判定する（完全オフラインで動作） */
export async function isValidProCode(code: string, forceFallback = false): Promise<boolean> {
  const normalized = normalizeProCode(code)
  if (!normalized) return false
  const hash = await sha256Hex(`uchirecipe-pro:${normalized}`, forceFallback)
  return PRO_CODE_HASHES.includes(hash)
}

/** コード入力のゆらぎを吸収する（追加レシピパック用。Proコードと同じ正規化） */
export function normalizePackCode(code: string): string {
  return code.normalize('NFKC').toUpperCase().trim()
}

/** 入力されたコードが有効な追加レシピパック解錠コードか判定する（完全オフラインで動作） */
export async function isValidPackCode(code: string, forceFallback = false): Promise<boolean> {
  const normalized = normalizePackCode(code)
  if (!normalized) return false
  const hash = await sha256Hex(`uchirecipe-pack:${normalized}`, forceFallback)
  return RECIPE_PACK_CODE_HASHES.includes(hash)
}

/**
 * 配布レシピ（セット）の取り込みが可能か: Pro解錠済み、または追加レシピパック解錠済みなら常に可。
 * 課金モデル（docs/08 2-8）: 無料=基本レシピのみ／追加レシピパック(単体)＋Pro(パック込み)で配布セットが使える
 */
export function hasPaidRecipeAccess(settings: Pick<Settings, 'proCode' | 'recipePackCode'>): boolean {
  return !!settings.proCode || !!settings.recipePackCode
}
