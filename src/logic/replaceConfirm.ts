/**
 * 貼り付け・URL取り込みで「入力済みの内容が置き換わる」ときの確認の判定（規約F・便BW/C-04 →
 * 2026-07-30 便CK/②-1）。文言そのものは src/i18n/ja.ts が持ち、ここは
 * 「何が置き換わるのか」だけを決める純ロジック（scripts/test-logic.mjs で固定する）。
 *
 * 便CK/②-1(S1): 判定・確認文のどちらにも写真が入っていなかったため、写真つきの既存レシピを
 * 編集中にURL取り込みすると、確認も予告もなく写真が差し替わっていた。写真は端末内にしか無く
 * 再取得できないので、気づかずに保存した時点でデータ消失になる。
 */

/** URL取り込みで既存の写真がどうなるか（規約F: 消えるもの／残るものを両方伝えるための判定） */
export type PhotoReplacePlan =
  /** いまの写真が読み込んだ写真に置き換わる（＝消える。確認が必要） */
  | 'replace'
  /** 「写真も取り込む」がOFFなので、いまの写真はそのまま残る */
  | 'kept'
  /** そもそも写真が無いので写真については何も起きない */
  | 'none'

export function photoReplacePlan(hasPhoto: boolean, fetchPhoto: boolean): PhotoReplacePlan {
  if (!hasPhoto) return 'none'
  return fetchPhoto ? 'replace' : 'kept'
}

export interface ReplaceConfirmTargets {
  /** 入力済みの料理名が、読み取った料理名に置き換わって消える */
  title: boolean
  /** 入力済みのひとこと説明が消える（取り込みでは決して入らない欄なので、空になる） */
  intro: boolean
  /** 入力済みのメモが消える（読み取れたメモに置き換わる／読み取れなければ空になる） */
  memo: boolean
  /** 入力済みの材料が置き換わって消える */
  ingredients: boolean
  /** 入力済みの手順が置き換わって消える */
  steps: boolean
  /** いまの写真が置き換わって消える */
  photo: boolean
}

/**
 * 実際に「消えるもの」がどれかを判定する。
 * 材料・手順は「取り込んだ側に中身があり、かつ入力済みの側も埋まっている」ときだけ消える
 * （空のフォームへの取り込みで確認を出さないのは便BW/C-04からの仕様）。
 *
 * 【2026-08-25 便KS・⑦で料理名・ひとこと説明・メモを置き換えの対象に加えた】
 * オーナー原文（差し戻しC）:「URL取り込みで期待するのは、URLからの情報のみです。余計な情報が
 * 残ることはむしろマイナス。何度もURLやコピペをするのは、その情報だけで上書きしたいからでは？
 * のこすべきなら、すべて消すボタンも作って。そしたら同じことができるので」。
 * 従来は「入力済みなら手を付けない」＝取り込んだ料理の材料・手順に、前の料理の名前と説明が
 * 付いたレシピができていた。
 *
 * ただし**料理名だけは、読み取れなかったときに消さない**（parsedTitle=false のとき）:
 *  ・料理名は保存に必須の欄で、空になると保存そのものができない
 *  ・貼り付けは本文に料理名が書かれていないことがある（材料と作り方だけをコピーした形。
 *    アプリ自身も「ページの文章をコピーして貼り付け欄へ」と案内している）
 *  ・そのとき消すと、**代わりに入る情報が無いまま**手で入れた名前だけが失われる
 * ひとこと説明・メモは保存に必須ではなく、前の料理の説明が残るほうが実害が大きいので、
 * 読み取れなくても空にする（＝取り込んだ内容だけが残る）。
 */
export function replaceConfirmTargets(input: {
  filledTitle: boolean
  filledIntro: boolean
  filledMemo: boolean
  filledIngredients: number
  filledSteps: number
  /** 取り込んだ側が料理名を読み取れたか */
  parsedTitle: boolean
  parsedIngredients: number
  parsedSteps: number
  photoPlan: PhotoReplacePlan
}): ReplaceConfirmTargets {
  return {
    // 呼び出し側から真偽が渡らない書き方（テスト・古い呼び出し）でも undefined を返さないよう、
    // 必ず true/false に落とす
    title: input.filledTitle === true && input.parsedTitle === true,
    intro: input.filledIntro === true,
    memo: input.filledMemo === true,
    ingredients: input.parsedIngredients > 0 && input.filledIngredients > 0,
    steps: input.parsedSteps > 0 && input.filledSteps > 0,
    photo: input.photoPlan === 'replace',
  }
}

/** 確認ダイアログを出す必要があるか（消えるものが1つも無ければ黙って進めてよい） */
export function needsReplaceConfirm(targets: ReplaceConfirmTargets): boolean {
  return (
    targets.title ||
    targets.intro ||
    targets.memo ||
    targets.ingredients ||
    targets.steps ||
    targets.photo
  )
}
