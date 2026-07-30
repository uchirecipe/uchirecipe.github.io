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
 */
export function replaceConfirmTargets(input: {
  filledIngredients: number
  filledSteps: number
  parsedIngredients: number
  parsedSteps: number
  photoPlan: PhotoReplacePlan
}): ReplaceConfirmTargets {
  return {
    ingredients: input.parsedIngredients > 0 && input.filledIngredients > 0,
    steps: input.parsedSteps > 0 && input.filledSteps > 0,
    photo: input.photoPlan === 'replace',
  }
}

/** 確認ダイアログを出す必要があるか（消えるものが1つも無ければ黙って進めてよい） */
export function needsReplaceConfirm(targets: ReplaceConfirmTargets): boolean {
  return targets.ingredients || targets.steps || targets.photo
}
