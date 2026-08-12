/**
 * レシピ本体のメモ（`recipe.memo`）を、並行調理ナビの段取りの「効く手順」へ配る
 * （2026-08-11 便FM）。
 *
 * 直した不具合: レシピ詳細では出ている本体のメモが、**並行調理ナビの段取りにも
 * 調理中モードにも1行も出ていなかった**（両画面が描いていたのは手順ごとの注意書き
 * `item.memo` だけ）。同梱109品のうち94品が本体のメモを持ち、その多くが
 * 「生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。」のような
 * 扱いの注意で、**複数の品を同時に進める並行調理でこそ要る**行だった。
 *
 * 置き方の設計（全手順に出すと邪魔になり、読まれずに素通りされる）:
 *   - **1行につき1手順**。行の中身を見て、その行が効く手順1つにだけ出す
 *     （＝同じ行が段取りの中に2回出ない・1行も落とさない）
 *   - 交差汚染（洗う・取り箸）＝**その生の食材を最初に扱う手順**。触る前に読める位置に置く
 *   - 材料の選び方（どの状態のものを使う・どれは使わない）＝**その品の最初の手順**
 *     （2026-08-12 便FR。保存の語が入っていても、作り始める前に読む話なので後ろへ回さない）
 *   - 火通し（半熟・中まで火を通す）＝**その食材を最後に加熱する手順**（火加減を決める場所）
 *   - 保存・作り置き・お弁当・温め直し＝**その品の最後の手順**（「完成」の印が出る手順）
 *   - どれでもない行（料理の由来・材料の代えなど）＝**その品の最初の手順**（作り始めに読む）
 *
 * ここは**表示の割り当てだけ**を決める。メモ本文は1文字も変えない（改行で行に分け、
 * 行はそのまま渡す）。レシピの中身を変えるのはオーナー承認が要る別の話。
 *
 * ユーザーが自分で登録したレシピ（メモが空・安全の語が無い）でも壊れない:
 * メモが無ければ何も返さず、当てはまる語が無い行は「その品の最初の手順」に落ちる。
 */

import { buildIngredientNames, findIngredientMatches } from './ingredientSpans'

/** メモ1行の種類。置き場所の決め方がこれで変わる */
export type RecipeNoteKind =
  /** 交差汚染・生の食材の扱い（洗う・取り箸・手袋） */
  | 'raw'
  /** 材料の選び方（どの状態のものを使う／どれは使わない） */
  | 'pick'
  /** 火通し（半熟・中まで火を通す） */
  | 'heat'
  /** 保存・作り置き・お弁当・温め直し */
  | 'keep'
  /** 上のどれでもない（料理の由来・材料の代え・分量の上限など） */
  | 'other'

/** 割り当てに使うレシピ側の材料（本体のメモと材料名だけあればよい） */
export interface RecipeNoteSource {
  memo?: string
  ingredients: readonly { name: string }[]
}

/** 手順1つに出す、本体のメモの1行 */
export interface RecipeNote {
  /** メモ本文の1行（**そのまま**。「・」の行頭記号も落とさない） */
  text: string
  kind: RecipeNoteKind
}

/** 割り当て先になれる手順の最小限の形（`TimelineItem` をそのまま渡せる） */
export interface RecipeNoteStep {
  recipeId: number
  /** 元レシピ内の手順の添字（0始まり）。ナビが足した工程は負の値 */
  stepIndex: number
  /** ナビが段取りに足した工程か（レシピの手順ではないので割り当て先にしない） */
  addedByNavi: boolean
  text: string
}

/** 手順ごとの割り当てを引くときのキー（手順ごとの材料と同じ組み立て方） */
export function recipeNoteStepKey(step: { recipeId: number; stepIndex: number }): string {
  return `${step.recipeId}-${step.stepIndex}`
}

/** 洗う・取り箸・手袋＝道具と手の扱いを言っている行 */
const WASH_PATTERN = /洗う|洗い|取り箸|手袋/
/** その洗う対象が「食材にふれたもの」だと分かる語（洗い物一般の話と分ける） */
const HANDLING_PATTERN = /生の|まな板|包丁|手|ボウル|箸|トレー|保存袋/
/**
 * 材料の選び方＝「どの状態のものを使うか」「どれは使わないか」を言っている行
 * （2026-08-12 便FR・利用者テスト「チャーハンの『ご飯は炊きたてか冷蔵保存のものを使い、
 * 常温に長く置いたご飯は使わないこと。』が段取りの最後に出る」）。
 *
 * この行は「冷蔵」「常温」を含むため保存の行と判定され、完成の手順へ寄っていた。
 * 中身は**どのご飯を使うか**＝作り始める前に読む話なので、保存より先に見分ける。
 *
 * 「使い切る」「使い捨て」は材料の選択ではない（食べ切る話・道具の話）ので外す。
 */
const PICK_PATTERN = /使わない|使わず|(?:もの|物)を使(?!い切|いき|い捨)/
/** 保存・作り置き・お弁当・温め直し＝作り終えてからの話 */
const KEEP_PATTERN =
  /冷蔵|冷凍|保存|日持ち|食べ切|食べき|作り置き|温め直|再加熱|弁当|粗熱|常温|解凍|冷まし|冷やし固め|当日中|その日のうち/
/** 火通し＝加熱の程度の話 */
const HEAT_PATTERN = /火を通|火が通|加熱|半熟|沸騰|中まで/
/** 肉・魚介の材料名（行が食材を名指ししていないときの寄せ先を探すのに使う） */
const MEAT_NAME_PATTERN =
  /肉|鶏|豚|牛|ひき|魚|鮭|さば|さんま|たら|さわら|ぶり|あじ|いわし|えび|いか|たこ|ささみ|手羽|ベーコン|ハム|ソーセージ/
/**
 * 「生の◯◯にふれた」の◯◯を取り出す。材料名と綴りが違う言い方
 * （材料は「豚こま切れ肉」なのにメモは「生の肉」）でも手順を探せるようにするための保険。
 */
const RAW_FOOD_PATTERN = /生の?([ぁ-んァ-ヶー一-龥]{1,6}?)(?=に|を|は|が|や|と|も|、|。|・)/g

/**
 * メモを行に分ける。**中身は変えない**（前後の空白も含めてそのまま。空行だけ落とす）。
 * レシピ詳細と同じ改行の扱いにして、2つの画面で同じ行が出るようにする。
 */
export function splitRecipeNoteLines(memo: string | undefined): string[] {
  if (!memo) return []
  return memo.split('\n').filter((line) => line.trim().length > 0)
}

/**
 * メモ1行の種類を決める。**交差汚染を最優先**にする（「生の鶏肉にふれた…洗うこと。
 * 冷蔵庫で1〜2日ほどで食べ切ること。」のように保存の語と同居する行があり、
 * 保存の側で判定すると洗う話が最後の手順まで出てこなくなるため）。
 *
 * 2026-08-12 便FR: **材料の選び方を保存より先に**見分ける（同じ理由。「ご飯は炊きたてか
 * 冷蔵保存のものを使い、常温に長く置いたご飯は使わないこと。」が保存の行と判定され、
 * 作り始める前に読むべき行が完成の手順へ寄っていた）。交差汚染より後に置くのは、
 * 両方に当てはまる行なら「その生の食材を最初に扱う手順」のほうが置き場所として細かいため
 * （その品の最初の手順が、生の食材を触らない工程のことがある）。
 */
export function classifyRecipeNote(line: string): RecipeNoteKind {
  if (WASH_PATTERN.test(line) && HANDLING_PATTERN.test(line)) return 'raw'
  if (PICK_PATTERN.test(line)) return 'pick'
  if (KEEP_PATTERN.test(line)) return 'keep'
  if (HEAT_PATTERN.test(line)) return 'heat'
  return 'other'
}

/**
 * 段取りの各手順に、レシピ本体のメモを1行ずつ割り当てる。
 * 返すのは `${recipeId}-${stepIndex}` → その手順に出す行の並び。
 *
 * **段取りの並び順には依存しない**（色で手順を引き寄せても割り当ては動かない）。
 * 各品の手順をレシピ内の順（stepIndex）に並べ直してから位置を決める。
 */
export function assignRecipeNotes(
  items: readonly RecipeNoteStep[],
  sources: ReadonlyMap<number, RecipeNoteSource>,
): Map<string, RecipeNote[]> {
  const assigned = new Map<string, RecipeNote[]>()
  const stepsByRecipeId = new Map<number, RecipeNoteStep[]>()
  for (const item of items) {
    // ナビが段取りに足した工程（湯を沸かす）はレシピの手順ではないので割り当て先にしない
    if (item.addedByNavi || item.stepIndex < 0) continue
    const list = stepsByRecipeId.get(item.recipeId)
    if (list) list.push(item)
    else stepsByRecipeId.set(item.recipeId, [item])
  }

  for (const [recipeId, list] of stepsByRecipeId) {
    const source = sources.get(recipeId)
    const lines = splitRecipeNoteLines(source?.memo)
    if (!source || lines.length === 0) continue
    const steps = [...list].sort((a, b) => a.stepIndex - b.stepIndex)

    // 材料名は「同じ材料の言い換え」をひとまとめにして持つ（材料が「鶏むね肉」で
    // メモが「生の鶏肉」でも同じ材料として扱う＝手順本文の下線と同じ照合の仕組みを使う）
    const groups = source.ingredients.map((ing) => buildIngredientNames([ing]))
    const names = buildIngredientNames(source.ingredients)
    const groupByName = new Map<string, readonly string[]>()
    for (const group of groups) for (const name of group) groupByName.set(name, group)
    const meatNames = new Set<string>()
    for (const group of groups) {
      if (!group.some((name) => MEAT_NAME_PATTERN.test(name))) continue
      for (const name of group) meatNames.add(name)
    }
    const stepNames = steps.map(
      (step) => new Set(findIngredientMatches(step.text, names).map((m) => m.text)),
    )
    const stepHas = (index: number, target: ReadonlySet<string>) => {
      for (const name of stepNames[index]) if (target.has(name)) return true
      return false
    }

    for (const line of lines) {
      const kind = classifyRecipeNote(line)
      const target = new Set<string>()
      for (const match of findIngredientMatches(line, names)) {
        for (const name of groupByName.get(match.text) ?? [match.text]) target.add(name)
      }

      let index = -1
      if (kind === 'keep') {
        // 保存・お弁当・温め直しは、その品ができあがってからの話
        index = steps.length - 1
      } else if (kind === 'other' || kind === 'pick') {
        // 材料の選び方は、その材料に手をつける前＝作り始めに読む（2026-08-12 便FR）
        index = 0
      } else if (kind === 'heat') {
        // 火加減を決めるのは、その食材を**最後に**加熱する手順
        for (let i = steps.length - 1; i >= 0; i--) {
          if (stepHas(i, target)) {
            index = i
            break
          }
        }
        if (index === -1) index = steps.length - 1
      } else {
        // 交差汚染は、その生の食材を**最初に**扱う手順（触る前に読める位置）
        index = steps.findIndex((_, i) => stepHas(i, target))
        if (index === -1) {
          const words = [...line.matchAll(RAW_FOOD_PATTERN)].map((m) => m[1]).filter(Boolean)
          if (words.length > 0) {
            index = steps.findIndex((step) => words.some((word) => step.text.includes(word)))
          }
        }
        if (index === -1 && meatNames.size > 0) {
          index = steps.findIndex((_, i) => stepHas(i, meatNames))
        }
        // 手がかりが無い行は、その品の最初の手順に出す（遅れるより早いほうを選ぶ）
        if (index === -1) index = 0
      }

      const key = recipeNoteStepKey(steps[index])
      const notes = assigned.get(key)
      if (notes) notes.push({ text: line, kind })
      else assigned.set(key, [{ text: line, kind }])
    }
  }
  return assigned
}
