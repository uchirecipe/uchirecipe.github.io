/**
 * 画面に表示する日本語の文言はすべてここに集める。
 * コンポーネント内に直接日本語を書かないこと（将来の英語対応のため）。
 */
export const ja = {
  app: {
    name: 'うちレシピ',
  },
  nav: {
    home: 'ホーム',
    recipes: 'レシピ',
    settings: '設定',
  },
  home: {
    title: 'ホーム',
    placeholder: 'ここに今日の献立やおすすめが表示されます（準備中）',
  },
  recipes: {
    title: 'レシピ',
    placeholder: 'ここにレシピの一覧が表示されます（準備中）',
  },
  settings: {
    title: '設定',
    placeholder: 'ここにテーマ切替やバックアップなどの設定が並びます（準備中）',
  },
} as const

export type Messages = typeof ja
