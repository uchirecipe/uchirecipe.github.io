/**
 * 取り込んだレシピに「入らなかった項目」を数える（2026-08-25 便KO・①②）。
 *
 * ## なぜ要るか（影響範囲テスト・取り込み実データ90品の実測）
 * URL取り込み・貼り付けで入るのは料理名・材料・手順・人数分・調理時間まで。
 * 献立の絞り込みが読む項目は、90品すべてで1つも入っていなかった。
 *   ジャンル（和食/洋食/中華）… 0件 ／ 季節・時間帯 … 0件
 *   手間レベル … 全品が既定値の「普通」のまま
 * そのため「和食だけ」で絞ると取り込んだ品が全部消え、「20分以内」で絞ると候補が枯れる。
 *
 * ## オーナーの裁定（原文）
 * 「タグを付ける道を作る（取り込み直後に1タップ）。絞り込みの挙動はいまのまま」
 * 「献立提案の絞り込みに必要な情報で、レシピの自動登録に対応していない項目は、自分で設定する
 *  ことをお勧めする説明が何処かで欲しい。ただ、毎回表示されると邪魔なので、初回のみにして、
 *  今後表示しないを押したら消せるくらいがいいと思う」
 *
 * ## ここが持つもの
 * ・入らなかった項目を数える純ロジック（画面もDexieも触らない）
 * ・説明を「初回のみ」にするための、この端末の見た記録（logic/noticeSeen.ts の作法に乗る）
 * 出す場所はレシピ登録画面の取り込みの結果（src/pages/RecipeFormPage.tsx）、
 * 戻せる場所は設定の「レシピ」節（src/pages/SettingsPage.tsx）。
 */

import type { DishType, EffortLevel, MealSlot, Season } from '../db/types'
import { MEAL_GENRES } from './mealPlan'
import type { MealGenre } from './mealPlan'
import { DEFAULT_EFFORT_LEVEL } from './effort'
import { hasSeenNotice, markNoticeSeen, forgetNoticeSeen } from './noticeSeen'

/**
 * 取り込みでは入らない項目（並びは画面に出す順）。
 *
 * 2026-08-26 便LG・オーナー原文「自動で登録できない項目に計量一緒にできる設定は含みますか」:
 * 含んでいなかったので `seasoningGroup`（合わせ調味料の組）を足した。
 * **ほかの5つと性質が違う**（ジャンルのようにボタンで1つ選ぶものではなく、材料の組み分け）ので、
 * 画面での出し方も違う＝選ぶ並びではなく「印から組を作る」ボタン1つにする
 * （src/pages/RecipeFormPage.tsx の importFollowUp）。
 * 組は最後に置く（材料の話なので、献立の絞り込みに使う5つと混ぜて読ませない）。
 */
export type ImportFieldKey =
  | 'genre'
  | 'season'
  | 'suitableFor'
  | 'dishType'
  | 'effort'
  | 'seasoningGroup'

export const IMPORT_FIELD_KEYS: readonly ImportFieldKey[] = [
  'genre',
  'season',
  'suitableFor',
  'dishType',
  'effort',
  'seasoningGroup',
]

/** いま登録画面に入っている値のうち、この判定に要るものだけ */
export interface ImportFieldValues {
  tags: readonly string[]
  season: Season | undefined
  suitableFor: readonly MealSlot[]
  /** 料理名からの自動提案を当てたあとの値（提案できたなら「入った」扱いにする） */
  dishType: DishType | undefined
  effortLevel: EffortLevel
  /**
   * 印（●・☆・A など）から作れる合わせ調味料の組の数（2026-08-26 便LG）。
   * すでに組が付いているとき・印が無いときは 0＝押しても何も起きないボタンを出さない。
   * 数え方は logic/seasoningRegroup.ts の countSeasoningGroupsFromMarks
   */
  seasoningGroupsFromMarks: number
}

/** レシピに付いているジャンル（タグの「和食」「洋食」「中華」。無ければ undefined） */
export function recipeGenreTag(tags: readonly string[]): MealGenre | undefined {
  return MEAL_GENRES.find((genre) => tags.includes(genre))
}

/** ジャンルのタグを1つだけにして入れ替える（同じものを押したら外す＝季節・種別と同じ操作） */
export function tagsWithGenre(tags: readonly string[], genre: MealGenre): string[] {
  const current = recipeGenreTag(tags)
  const without = tags.filter((tag) => !(MEAL_GENRES as readonly string[]).includes(tag))
  return current === genre ? without : [...without, genre]
}

/** 入らなかった項目だけを、画面に出す順で返す（何も足りなければ空） */
export function missingImportFields(values: ImportFieldValues): ImportFieldKey[] {
  const missing: ImportFieldKey[] = []
  if (recipeGenreTag(values.tags) === undefined) missing.push('genre')
  if (values.season === undefined) missing.push('season')
  if (values.suitableFor.length === 0) missing.push('suitableFor')
  if (values.dishType === undefined) missing.push('dishType')
  // 手間レベルは「選ばなければ普通」なので、普通のままなら人が選んでいない
  // （logic/effort.ts が同じ理由でカードのバッジを出していない）
  if (values.effortLevel === DEFAULT_EFFORT_LEVEL) missing.push('effort')
  // 合わせ調味料の組は、**印から実際に作れるときだけ**出す（2026-08-26 便LG）。
  // 印が無いレシピに「組が入っていません」とだけ言っても、1タップでできることが無い
  //（そのときの作り方は取り込み結果の案内 ja.form.importSeasoningGuide が持っている）
  if (values.seasoningGroupsFromMarks > 0) missing.push('seasoningGroup')
  return missing
}

/** 説明を「初回のみ」にするための見た記録（localStorage・この端末だけ） */
export const IMPORT_FIELD_NOTICE_SEEN_KEY = 'uchirecipe:importFieldNoticeSeen'

/** この端末で取り込みの説明を見たことがあるか */
export function isImportFieldNoticeSeen(): boolean {
  return hasSeenNotice(IMPORT_FIELD_NOTICE_SEEN_KEY)
}

/** 見た記録を残す（次の取り込みからは説明を出さない） */
export function markImportFieldNoticeSeen(): void {
  markNoticeSeen(IMPORT_FIELD_NOTICE_SEEN_KEY)
}

/** 見た記録を消す（設定から出し直す＝押した瞬間に二度と出せない形にしない） */
export function forgetImportFieldNoticeSeen(): void {
  forgetNoticeSeen(IMPORT_FIELD_NOTICE_SEEN_KEY)
}
