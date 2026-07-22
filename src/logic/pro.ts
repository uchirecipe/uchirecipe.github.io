import { PRO_CODE_HASHES } from './proCodes'
import { sha256Hex as sha256HexFallback } from './sha256'

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

/**
 * 入力コードがPro解錠コード(UR-)かどうかを判定する（純ロジック。2026-07-17設定ゼロベース裁定#7）。
 * 「購入と解錠」の入力欄に入れたコードを解錠フローへ回すか判定するために使う。
 * 2026-07-22の全無料化(収録レシピは全て無料・有料はPro機能のみ)で追加レシピパック(UP-)は製品として
 * 廃止したため、有効なコード種別はPro(UR-)のみになった。コード形式はdocs/08 2-6で`UR-XXXX-XXXX`に
 * 固定されているため、prefix以外の判定（桁数等）は行わない（実際の正当性はisValidProCodeが担う）。
 */
export function detectCodeKind(code: string): 'pro' | 'unknown' {
  const normalized = normalizeProCode(code)
  if (normalized.startsWith('UR-')) return 'pro'
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
