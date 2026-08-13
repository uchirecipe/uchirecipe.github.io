/**
 * 台所の器具の占有（2026-08-13 便GC・docs/72 第3段）。
 *
 * きっかけ（docs/71 R2・コンロ1口の家）:
 * 「回鍋肉＋味噌汁で段取りを作ったら…⑤鍋で2分煮る（待ち）→⑥フライパンで豚肉を炒める→⑦また鍋
 * →⑧またフライパン。うちは1口なので、この段取りはそもそも成立しません。警告もヒントも一切なし。」
 *
 * 段取りは「料理人が1人」だけを前提にしていて、**器具が何台あるか**を見ていなかった。
 * ここでは手順1つが**どの器具をどれだけ占有するか**を見分け、段取りの側（cookNavi.ts）が
 * 設定された台数を超えないように組めるようにする。
 *
 * 数える器具は4つ（docs/72 §3・オーナー承認済み。**変えない**）:
 *   コンロ（口数）・電子レンジ・魚焼きグリル・トースター
 * ＝同時に1つしか使えず、かつ**持っていない家がある**器具に限る。
 * **炊飯器は数えない**（ほぼ全家庭に1台あり他と競合しない／炊飯器の待ちは手が空く）。
 *
 * 見分けを外したときの被害は左右で大きく違う。
 *   - 占有を**見落とす**（本当は使っているのに空いていると読む）
 *     → 1口の家に「同時に2つ火にかける」段取りを出す＝**その家では作れない**
 *   - 占有を**多めに数える**（使っていないのに使っていると読む）
 *     → 段取りが少し長くなるだけ
 * したがって**迷ったら占有している側に倒す**。
 */

/** 数える器具。docs/72 §3 の4つ */
export type ApplianceKey = 'stove' | 'microwave' | 'grill' | 'toaster'

/** 台所にある器具の台数（設定画面で決める） */
export interface KitchenEquipment {
  /** コンロ（IH含む）の口数 */
  burners: number
  /** 電子レンジがある */
  microwave: boolean
  /** 魚焼きグリルがある */
  grill: boolean
  /** トースターがある */
  toaster: boolean
}

/** コンロの口数として選べる範囲 */
export const MIN_BURNERS = 1
export const MAX_BURNERS = 4

/**
 * 既定の台所（docs/72 §3「既定値は2口」・オーナー承認）。
 * レンジ・グリル・トースターは**持っている**を既定にする（設定を触っていない人の段取りを
 * いきなり変えないため。この3つは日本の家庭でほぼ標準の器具）。
 */
export const DEFAULT_KITCHEN: KitchenEquipment = {
  burners: 2,
  microwave: true,
  grill: true,
  toaster: true,
}

export function clampBurners(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_KITCHEN.burners
  return Math.min(MAX_BURNERS, Math.max(MIN_BURNERS, Math.round(n)))
}

/**
 * 設定から台所の器具を組み立てる。
 * 設定は「**持っていない**」だけを持つ（`kitchenNo◯◯`）ので、未設定の端末＝従来どおり
 * 「2口・3つとも持っている」になり、マイグレーションが要らない。
 */
export function kitchenFromSettings(
  settings:
    | {
        kitchenBurners?: number
        kitchenNoMicrowave?: boolean
        kitchenNoGrill?: boolean
        kitchenNoToaster?: boolean
      }
    | undefined
    | null,
): KitchenEquipment {
  if (!settings) return DEFAULT_KITCHEN
  return {
    burners: settings.kitchenBurners != null ? clampBurners(settings.kitchenBurners) : DEFAULT_KITCHEN.burners,
    microwave: !settings.kitchenNoMicrowave,
    grill: !settings.kitchenNoGrill,
    toaster: !settings.kitchenNoToaster,
  }
}

/** その器具を同時にいくつ使えるか（持っていない器具は0） */
export function applianceCapacity(kitchen: KitchenEquipment, key: ApplianceKey): number {
  switch (key) {
    case 'stove':
      return clampBurners(kitchen.burners)
    case 'microwave':
      return kitchen.microwave ? 1 : 0
    case 'grill':
      return kitchen.grill ? 1 : 0
    case 'toaster':
      return kitchen.toaster ? 1 : 0
  }
}

/**
 * 器具の字は入っているが、その器具を使うわけではない言葉。判定の前に同じ長さの伏せ字にする
 * （`cookNavi.ts` の伏せ字と同じ考え方。文字位置をずらさない）。
 *
 * 入っているもの:
 *   - 材料名（油揚げ・厚揚げ・焼きのり・炒りごま・ゆで卵・焼き豆腐・煮干し・めんつゆ ほか）
 *     ＝「油揚げは短冊切りにする」を**コンロ使用**と読んでしまう
 *   - 器具の名前が付いた別の道具（オーブンシート・グリルパン＝コンロで使う鉄板・鍋つかみ・鍋敷き）
 *   - フレンチトースト（フライパンで焼く。トースターではない）
 */
const APPLIANCE_NOUN_MASK =
  /フレンチトースト|グリルパン|グリル鍋|オーブンシート|オーブンペーパー|オーブン用|鍋つかみ|鍋敷き|鍋しき|土鍋風|油揚げ|厚揚げ|薄揚げ|揚げ玉|揚げ球|さつま揚げ|がんもどき|焼きのり|焼き海苔|焼のり|焼き豆腐|焼き麩|焼きそば麺|焼きうどん麺|炒りごま|炒りゴマ|いりごま|いりゴマ|煮干し|煮汁|煮物|煮もの|蒸し器|蒸し布|蒸しパン|蒸し鶏|蒸しタオル|ゆで卵|茹で卵|ゆでうどん|ゆで麺|ゆでだこ|めんつゆ|そうめんつゆ|つゆの素|しょうゆ|漬け汁|漬けだれ|漬けタレ|漬けダレ|お浸し|焼き肉のたれ|焼肉のたれ|照り焼きのたれ/g

function maskApplianceNouns(text: string): string {
  return text.replace(APPLIANCE_NOUN_MASK, (m) => '＊'.repeat(m.length))
}

/** トースター（オーブントースターを含む）。「トーストする」もこの器具 */
const TOASTER_PATTERN = /トースター|トースト/
/** 電子レンジ。ワット数の表記（600W）もレンジの合図 */
const MICROWAVE_PATTERN = /電子レンジ|レンジ|チンす|チンし|チンし|[0-9０-９]\s*[WＷ]/
/** 魚焼きグリル */
const GRILL_PATTERN = /グリル/
/**
 * オーブン。docs/72 が数える4器具には入っていないが、家庭でいちばん多いのは
 * **オーブンレンジ（1台でレンジとオーブンを兼ねる）**なので、**電子レンジと同じ1台**として数える。
 * 別々に持っている家では段取りが少し長くなるだけで、成立しない段取りは出ない（安全側）。
 */
const OVEN_PATTERN = /オーブン/

/**
 * コンロ（IH含む）を使っていると読む合図。
 *
 * 便FZが計測用に作った見分けは「火の語が本文にあるとき**だけ**」数えていた
 * （＝少なめに数える側。本人が報告済み）。本体に入れるにあたって次の2つを足した:
 *   1. 火の言い回しの取りこぼし（湯せん・ゆがく・ひと煮立ち・とろみがつくまで・水分をとばす ほか）
 *   2. **鍋・フライパンの語がある手順**（下の VESSEL_PATTERN）。「鍋にだし汁を入れる」のように
 *      火の語が1つも無くても、鍋は火の上にある。**火を下ろす合図**（火を止める・器に盛る・
 *      取り出す・ざるにあげる・冷ます）があるときだけ、占有していないと読む
 */
const STOVE_HEAT_PATTERN =
  /火にかけ|火に掛け|火をつけ|火を入れ|点火|強火|中火|弱火|とろ火|火加減|火を通|火が通|煮立|ひと煮|沸か|沸騰|グツグツ|ぐつぐつ|ふつふつ|煮|茹|ゆで|ゆが|湯がく|湯通し|湯せん|湯煎|炒め|炒る|炒り|揚げ|焼く|焼き|焼い|焼け|蒸す|蒸し焼|蒸し煮|蒸し上|蒸して|蒸した|蒸しま|蒸らし|蒸らす|蒸せ|蒸気|熱し|熱する|加熱|温め|あたため|とろみがつ|とろみが付|とろみをつ|とろみを付|照りが出|照りを出|水分をとば|水分を飛ば|アルコールをとば|アルコールを飛ば|煮切|回し入れ|火を止め|火をとめ|火を消|火からおろ|火から下ろ/

/** 鍋・フライパンの語（コンロの上に載る器） */
const VESSEL_PATTERN = /フライパン|中華鍋|片手鍋|両手鍋|雪平|行平|圧力鍋|土鍋|小鍋|鍋|やかん|ケトル/
/**
 * 器具の名前が付いているが、実際はコンロにのせて使う道具。上の伏せ字で消えるので**伏せる前の本文**で見る
 * （グリルパンは魚焼きグリルではなく、コンロにのせる焼き板）。
 */
const STOVE_TOOL_PATTERN = /グリルパン|グリル鍋/
/**
 * 火から下りている合図。鍋・フライパンの語があっても、これがあれば占有と読まない。
 * （「鍋に移して冷ます」「フライパンから取り出す」「火を止めて器に盛る」）
 */
const OFF_HEAT_PATTERN =
  /火を止め|火をとめ|火から|火を消|火からおろ|冷ま|粗熱|取り出|とり出|器に盛|皿に盛|椀に|ざるにあげ|ざるに上げ|ざるにとり|ザルにあげ|ザルに上げ|湯を切|湯をき|水気をき|水気を切|洗う|洗い|洗っ/

/**
 * その手順が使う器具（使っていなければ null）。
 * 見る順番はトースター→レンジ／オーブン→グリル→コンロ。
 * 「オーブントースター」はトースター、「オーブンレンジ」はレンジとして読む（先に当たった方）。
 */
export function stepAppliance(text: string): ApplianceKey | null {
  const t = maskApplianceNouns(text ?? '')
  if (TOASTER_PATTERN.test(t)) return 'toaster'
  if (MICROWAVE_PATTERN.test(t) || OVEN_PATTERN.test(t)) return 'microwave'
  if (GRILL_PATTERN.test(t)) return 'grill'
  if (STOVE_HEAT_PATTERN.test(t)) return 'stove'
  const onStove = VESSEL_PATTERN.test(t) || STOVE_TOOL_PATTERN.test(text ?? '')
  if (onStove && !OFF_HEAT_PATTERN.test(t)) return 'stove'
  return null
}

/**
 * 設定に合わせた器具（持っていない器具の工程は**コンロ1口**として数える）。
 *
 * 魚焼きグリルの無い家は、その工程をフライパンか魚焼き用の鍋でやることになる＝コンロが1口ふさがる。
 * トースター・電子レンジも同じ。持っていない器具を「制約なし」と読むと、
 * 持っていない家ほど無理な段取りが出る（＝設定した意味が反対になる）。
 */
export function stepApplianceFor(text: string, kitchen: KitchenEquipment): ApplianceKey | null {
  const key = stepAppliance(text)
  if (key == null) return null
  return applianceCapacity(kitchen, key) === 0 ? 'stove' : key
}

/** 器具の名前（画面に出す文言は i18n 側に置く。ここは記録・検査用の識別名） */
export const APPLIANCE_KEYS: ApplianceKey[] = ['stove', 'microwave', 'grill', 'toaster']

/** 占有している区間（分） */
export interface ApplianceUse {
  key: ApplianceKey
  start: number
  end: number
}

/**
 * 予定表。器具ごとに「いつからいつまで使うか」を持ち、空きがあるかを答える。
 * 端が接するだけ（前の工程が終わった瞬間に次が始まる）は重なりとしない。
 */
export class ApplianceSchedule {
  private uses: ApplianceUse[] = []
  private kitchen: KitchenEquipment

  constructor(kitchen: KitchenEquipment) {
    this.kitchen = kitchen
  }

  /** [start, end) の間ずっと空きがあるか */
  canUse(key: ApplianceKey, start: number, end: number): boolean {
    const capacity = applianceCapacity(this.kitchen, key)
    if (capacity <= 0) return false
    if (end <= start) return true
    const overlapping = this.uses.filter((u) => u.key === key && u.start < end && u.end > start)
    if (overlapping.length === 0) return true
    // 区間の切れ目ごとに同時使用数を数える（切れ目以外で最大にはならない）
    const points = [start, ...overlapping.map((u) => u.start).filter((x) => x > start && x < end)]
    for (const at of points) {
      const busy = overlapping.filter((u) => u.start <= at && u.end > at).length
      if (busy + 1 > capacity) return false
    }
    return true
  }

  /** 使う予定を書き込む */
  occupy(key: ApplianceKey, start: number, end: number): void {
    if (end <= start) return
    this.uses.push({ key, start, end })
  }

  /**
   * その器具が `from` 以降でいちばん早く空く時刻（空くことが無ければ undefined）。
   * 手が空いたまま時計だけを進めるときの行き先に使う。
   */
  nextFreeAt(key: ApplianceKey, from: number): number | undefined {
    const ends = this.uses.filter((u) => u.key === key && u.end > from).map((u) => u.end)
    return ends.length === 0 ? undefined : Math.min(...ends)
  }

  /** いま（at 時点で）その器具に空きがあるか。B（口数に余裕があるとき）の判定に使う */
  hasSpare(key: ApplianceKey, at: number): boolean {
    const capacity = applianceCapacity(this.kitchen, key)
    if (capacity <= 0) return false
    const busy = this.uses.filter((u) => u.key === key && u.start <= at && u.end > at).length
    return busy < capacity
  }
}
