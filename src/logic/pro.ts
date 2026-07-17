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

/**
 * 入力コードがPro用(UR-)か追加レシピパック用(UP-)かを判定する（純ロジック。
 * 2026-07-17設定ゼロベース裁定#7）。「購入と解錠」1画面統合で、入力欄1つに入れたコードを
 * どちらの解錠フローへ回すか自動判定するために使う。既存の相互判定ヒント
 * （proCodeIsPackCode/packCodeIsProCode。SettingsPageのactivatePro/activatePack内で
 * .startsWith('UP-')/.startsWith('UR-')を見ていた判定）と同じ正規化・同じprefix判定を
 * 流用し、「ヒントを出す」から「そのまま正しい方で解錠する」へ発展させたもの。
 * コード形式はdocs/08 2-6で`UR-XXXX-XXXX`/`UP-XXXX-XXXX`に固定されているため、
 * prefix以外の判定（桁数等）は行わない（実際の正当性はisValidProCode/isValidPackCodeが担う）
 */
export function detectCodeKind(code: string): 'pro' | 'pack' | 'unknown' {
  const normalized = normalizeProCode(code)
  if (normalized.startsWith('UR-')) return 'pro'
  if (normalized.startsWith('UP-')) return 'pack'
  return 'unknown'
}

/**
 * 解錠コードをマスク表示する（純ロジック。2026-07-17設定ゼロベース裁定#4）。
 * 「UR-XXXX-XXXX」形式のうち先頭のprefix(UR-/UP-)は残し、末尾4文字だけ見せて残りを*にする
 * （例: "UR-AB12-CD34" → "UR-****CD34"）。ハイフンを含まない/短いコードにも耐えるよう、
 * prefix以外の文字数が4以下ならすべて*にする。機種変更時に「自分のコードだ」と識別できる
 * 最小限だけ見せつつ、画面越し(盗み見・スクリーンショット)での総当たり材料にならないようにする
 */
export function maskUnlockCode(code: string): string {
  const hyphenIndex = code.indexOf('-')
  if (hyphenIndex === -1) return code
  const prefix = code.slice(0, hyphenIndex)
  const rest = code.slice(hyphenIndex + 1).replace(/-/g, '')
  if (rest.length <= 4) return `${prefix}-${'*'.repeat(rest.length)}`
  const visible = rest.slice(-4)
  const hidden = '*'.repeat(rest.length - 4)
  return `${prefix}-${hidden}${visible}`
}
