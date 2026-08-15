/**
 * 確認の窓に流し込む中身（2026-08-15 便GW）。
 *
 * 窓を出すのは components/ConfirmDialog、出す合図を配るのは components/ConfirmProvider。
 * ここが持つのは**中身の形だけ**で、画面にもDexieにも触らない。
 * 件数を数えて文を組み立てる処理（logic/backup.ts・logic/recipeDelete.ts・db/starters.ts）は
 * この形で返すので、scripts/test-logic.mjs から画面を立ち上げずに文言を測れる。
 */
export interface ConfirmContent {
  /** 何をするのかを言い切る1行。「よろしいですか？」だけにしない（規約F） */
  title: string
  /** 補いの本文（改行はそのまま出る）。箇条書きだけで足りるなら省く */
  body?: string
  /** 箇条書き（label は太字の見出しとして行頭に出る。窓の中で label は重複させない） */
  bullets?: readonly { label: string; text: string }[]
  /** 補足（箇条書きの下に小さめの文字で1行ずつ） */
  notes?: readonly string[]
  /** 実行側のボタン。何が起きるかが分かる動詞にする */
  confirmLabel?: string
}

/**
 * 窓に出る文字を1本につないだもの。**読む量を測る**ためのもので、画面には使わない。
 * 素のダイアログだった頃の文字数と比べられるよう、見出し・箇条書き・補足を
 * 画面と同じ並び（見出し→本文→箇条書き→補足）でつなぐ。
 */
export function confirmContentText(content: ConfirmContent): string {
  return [
    content.title,
    content.body ?? '',
    ...(content.bullets ?? []).map((bullet) => `${bullet.label}: ${bullet.text}`),
    ...(content.notes ?? []),
  ]
    .filter((line) => line !== '')
    .join('\n')
}
