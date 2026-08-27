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
 * 取り込みでは入らない項目（並びは画面に出す順）。**献立の絞り込みが読む項目だけ**を並べる。
 *
 * ### 2026-08-27 便LR: 「合わせ調味料の組」(`seasoningGroup`) をここから外した
 * 2026-08-26 に、オーナーの問い「自動で登録できない項目に計量一緒にできる設定は含みますか」を
 * 受けて足したが、**どの取り込み経路でも出せない項目**だった。
 * 出す条件は `countSeasoningGroupsFromMarks(取り込み直後の行) > 0` で、この関数は
 * 「すでに組が1つでも付いていたら0」を返す。ところが貼り付け取り込み・URL取り込みは
 * どちらも**印を見つけた時点で必ず組を付ける**ので、組が作れるときは必ず0になる。
 * 実測（便LR・693通り: 貼り付けとURLの2経路 × 印14種 × 材料2〜8件 × 印の付いた件数0〜8、
 * および見出し【A】・Worker のグループ記号・4組の上限超え・行頭の飾り）で**1度も出なかった**。
 * 出せない欄を持ち続けると、画面・文言・検査だけが残って読む人を惑わせるので落とした。
 *
 * 印から組を作り直す道そのものは**材料の欄に残っている**（`ingredient-seasoning-run`）。
 * 速記入力・手入力・取り込み元が見出しで組を持っていた回など、印が残っているのに組が
 * 付かない並びは、そちらの入口から1タップでまとめられる（logic/seasoningRegroup.ts）。
 */
export type ImportFieldKey = 'genre' | 'season' | 'suitableFor' | 'dishType' | 'effort'

export const IMPORT_FIELD_KEYS: readonly ImportFieldKey[] = [
  'genre',
  'season',
  'suitableFor',
  'dishType',
  'effort',
]

/** いま登録画面に入っている値のうち、この判定に要るものだけ */
export interface ImportFieldValues {
  tags: readonly string[]
  season: Season | undefined
  suitableFor: readonly MealSlot[]
  /** 料理名からの自動提案を当てたあとの値（提案できたなら「入った」扱いにする） */
  dishType: DishType | undefined
  effortLevel: EffortLevel
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
