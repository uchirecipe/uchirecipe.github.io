/**
 * 検索の「ゆらぎ」対策。
 * 「タマネギ」「玉ねぎ」「たまねぎ」を同じ言葉として扱えるよう、
 * カタカナ→ひらがな変換と表記の正規化を行う。
 */

/** カタカナをひらがなに変換し、全角英数を半角化・小文字化する */
export function toHiragana(input: string): string {
  return input
    .normalize('NFKC') // 全角英数・記号を半角に揃える
    .toLowerCase()
    .replace(/[ァ-ヶ]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0x60),
    )
}

/** 料理名・材料名・タグから検索用キーワード一覧を作る（保存時に呼ぶ） */
export function buildSearchWords(
  title: string,
  ingredients: ReadonlyArray<{ name: string }>,
  tags: readonly string[],
): string[] {
  const words = new Set<string>()
  for (const raw of [title, ...ingredients.map((i) => i.name), ...tags]) {
    const trimmed = raw.trim()
    if (trimmed) words.add(toHiragana(trimmed))
  }
  return [...words]
}
