/**
 * 「食数の設定」「台所の器具」を初回に1度だけ案内するかどうかの判定（2026-08-13 便GE・docs/65 A-4）。
 *
 * 背景: コンロの口数と食数は、決めてあるかどうかで段取りも材料の分量も変わるのに、
 * 設定画面を自分で開かないと存在に気づけない。オーナー指示は
 * 「初回のみ、いずれかのレシピ詳細などを開いた時に案内」「情報を詰めすぎると読まずに消される」。
 *
 * 出す場所をレシピ詳細にした理由（docs/65 A-4）: 食数の設定はレシピ詳細の人数に直接効く。
 * コンロの口数が効くのは並行調理ナビだが、ナビはPro機能で無料の人には届かない。
 *
 * 仕組みは2026-08-10のホーム画面追加のお知らせ（logic/homeScreenNotice.ts）と同じ作法。
 * 見た記録は端末内のみ（logic/noticeSeen.ts）で、閉じ方によらず一度出したら二度と出ない。
 *
 * ホーム画面追加の案内と違い、**パソコンにも出す**。あちらは「ホーム画面にアイコンを置ける
 * 操作環境か」が案内の前提だったが、食数と器具はどの端末で開いても同じように効くため、
 * 端末の種類で出し分ける理由がない。
 */

import { hasSeenNotice, markNoticeSeen } from './noticeSeen'

/** 見た記録の保存キー（localStorage・端末内のみ） */
export const FIRST_SETUP_NOTICE_SEEN_KEY = 'uchirecipe:firstSetupNoticeSeen'

/** この案内が扱う設定（db/types.ts の Settings のうち、食数の設定と台所の器具） */
export interface FirstSetupSettings {
  householdServings?: number
  kitchenBurners?: number
  kitchenNoMicrowave?: boolean
  kitchenNoGrill?: boolean
  kitchenNoToaster?: boolean
}

/**
 * 食数の設定・台所の器具のどれかを自分で決めているか。
 *
 * どれか1つでも決めていたら案内を出さない＝この案内は「設定画面にこの2つがあると知らない人」
 * にだけ意味があるため。片方だけ決めている人にも、もう片方の入口は画面側にある
 * （台所の器具は並行調理ナビの段取りの入口に、設定への行き先つきの一言が出る）。
 *
 * 「持っていない器具」は false（＝持っている、に戻した）も自分で決めた印として数える。
 * 未設定（undefined）だけが「まだ触っていない」。
 */
export function hasChosenFirstSetup(settings: FirstSetupSettings | null | undefined): boolean {
  if (!settings) return false
  return (
    settings.householdServings != null ||
    settings.kitchenBurners != null ||
    settings.kitchenNoMicrowave != null ||
    settings.kitchenNoGrill != null ||
    settings.kitchenNoToaster != null
  )
}

/** 判定材料 */
export interface FirstSetupNoticeEnv {
  /** 設定の読み込みが済んでいる（済むまでは判定しない＝出したり消したりしない） */
  settingsLoaded: boolean
  /** レシピが実際に表示されている（読み込み中・見つからない画面には出さない） */
  recipeShown: boolean
  /**
   * 用事があって開いた画面か（タイマーからの手順ジャンプ ?step= ・
   * 記録の編集 ?editLog= ）。料理中や記録の書き込み中に割り込まない。
   * ?editLog= は記録の編集の窓が開くので、窓が二重に重なるのも防ぐ
   */
  openedForTask: boolean
  /** この端末でこの案内を見たことがあるか */
  seen: boolean
  /** 食数の設定・台所の器具のどれかを自分で決めているか */
  settingsChosen: boolean
}

/** 初回の案内を出すか（5条件すべてを満たしたときだけ true） */
export function shouldShowFirstSetupNotice(env: FirstSetupNoticeEnv): boolean {
  return (
    env.settingsLoaded && env.recipeShown && !env.openedForTask && !env.seen && !env.settingsChosen
  )
}

/** この端末でこの案内を見たことがあるか */
export function hasSeenFirstSetupNotice(): boolean {
  return hasSeenNotice(FIRST_SETUP_NOTICE_SEEN_KEY)
}

/** 見た記録を残す（閉じ方によらず、一度出したら次からは出さない） */
export function markFirstSetupNoticeSeen(): void {
  markNoticeSeen(FIRST_SETUP_NOTICE_SEEN_KEY)
}
