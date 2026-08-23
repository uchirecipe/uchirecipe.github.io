import { pickIconKey } from './icon'
import type { DishType, IconKey, Ingredient } from '../db/types'

/**
 * 料理の役割（dishType）の自動判定（2026-07-23 献立エンジン再設計・便BH-1／docs/56 §3-2）。
 *
 * 元は「アイコンの自動判定（logic/icon.ts の pickIconKey）の結果を役割へ写像するだけ」の薄い関数
 * だった。2026-08-23 便KG で、**料理名に書いてある役割を先に読む**層を足してある（下の理由）。
 *
 * ## 2026-08-23 便KG（影響範囲テストA/B/C・取り込み実データ90品の実測）
 * 取り込み中心の使い方で、3体すべてが同じ壊れ方をした（A: 30品中19品が主菜／C: 24品が主菜。
 * その結果「20分以内」で絞ると副菜の候補が3品まで枯れ、主菜の枠にサラダや浅漬けが入った）。
 *
 * 90品を数えたところ、主菜に倒れる原因は「どのルールにも当たらないときの既定（default→主菜）」
 * **ではなかった**（default に落ちたのは90品中2品だけ）。実際の内訳は次の4つ:
 *   ① 料理名に「副菜」「常備菜」と書いてあるのに読んでいない（4品）
 *   ② 材料の「だしの素」「白だし」で汁物になる（1品。にんじんしりしり）
 *   ③ 料理名の「お鍋に放置」の鍋を鍋料理と読む（1品）
 *   ④ あえ物・サラダなのに、たんぱく源の材料が先に取られて主菜になる（2品。さばマヨ水菜サラダ等）
 * そこで、アイコンの判定（見た目の分類）には手を触れず、**役割だけを決める層**をこの関数に足した。
 *
 * ## 決め方（上から順に。最初に決まったものを採る）
 *   1. 料理名に役割そのものが書いてある（「副菜」「常備菜」「おつまみ」等）→ その役割
 *   2. 料理名があえ物・サラダ・漬物の形を示している → 副菜（たんぱく源の材料より先に取る）
 *   3. アイコンの自動判定（pickIconKey）→ 役割へ写像。ただし
 *      3a. 料理名の「お鍋に」「鍋で」は道具の言い方なので、鍋料理として読まない
 *      3b. 材料の名前だけで汁物になったときは、だしの調味料を除いて判定し直す
 *   4. どれにも当たらない → **保留（undefined）**。機械が決めずに利用者に選んでもらう
 *
 * これは **新規レシピ登録・URL/テキスト取り込み時の初期値提案** に使う（ユーザーはフォームの
 * 選択チップでいつでも直せる）。**既存レシピの dishType は書き換えない**（未設定のレシピだけが
 * 献立エンジン側でこの手の推定にフォールバックする）。同梱レシピの dishType は手作業で確定済み
 * （db/starters.ts・src/sets/*.ts）なので、この関数の推定はそちらを上書きしない。
 *
 * 既知の限界（初期値提案なので実害は小さい・ユーザー修正で吸収）:
 * - だし巻き卵・味玉などの「卵の小鉢」は egg → 'main' に寄る（実運用は副菜）
 * - 卯の花・高野豆腐の含め煮などの「豆腐の脇役使い」は tofu → 'main' に寄る（実運用は副菜）
 * - 鮭フレーク・冷や汁などの魚/汁の変則品も見た目重視で寄る
 * これらは同梱データ側でオーナー裁定どおりの値を手当てしてある（docs/56 §2-3）。
 */

export interface DishTypeGuessInput {
  title: string
  tags: readonly string[]
  ingredients: readonly Pick<Ingredient, 'name'>[]
}

/**
 * 料理名に書いてある「役割そのもの」の語（2026-08-23 便KG）。
 *
 * 推測ではなく**書いてある事実の転記**なので、材料から導く判定より先に取る。
 * 「作り置き」「お弁当」は入れない: 実データでは「日持ちする作り置きおかず【鶏むね肉の柔らか
 * 甘辛煮】」のように主菜にも付く言葉で、役割を表していない。
 */
const SIDE_ROLE_WORDS: readonly string[] = [
  '副菜',
  '常備菜',
  '小鉢',
  '箸休め',
  '付け合わせ',
  'つけ合わせ',
  'おつまみ',
  '酒の肴',
]

/**
 * 料理名が示す「あえ物・サラダ・漬物」の形（2026-08-23 便KG）。
 *
 * アイコンの判定では、たんぱく源（魚・卵・豆腐・鶏・肉）をサラダ・あえ物より先に取る決まりが
 * ある（見た目の分類としてはそれで正しい。「さばマヨサラダ」の絵は魚でよい）。
 * **役割としては逆**で、実データでは「切って混ぜるだけ♪ さばマヨ水菜サラダ」が3回とも
 * 夕食の主菜の枠に入った。役割だけをここで先に決める。
 *
 * 「漬け」1語は入れない（「鮭の西京みそ漬け」「豚肉の味噌漬け」は主菜）。
 */
const SIDE_DISH_WORDS: readonly string[] = [
  'サラダ',
  'あえ',
  '和え',
  'ナムル',
  'マリネ',
  'おひたし',
  'お浸し',
  '酢の物',
  '浅漬け',
  '漬物',
  'ぬか漬け',
  'ピクルス',
  '煮浸し',
  '煮びたし',
]

/** サラダ・あえ物の語に見えるが料理の形ではないもの（icon.ts の exclude と同じ考え方） */
const SIDE_DISH_EXCLUDE: readonly string[] = ['サラダ油', 'サラダチキン']

/**
 * 料理名の中の「鍋」が道具を指す言い方（「お鍋に放置」「鍋で煮る」。2026-08-23 便KG）。
 * 実データBの「鶏むね肉しっとり お鍋に放置でできる蒸し鶏」が汁物として保存されていた。
 * 助詞が続かない「寄せ鍋」「水炊き」等の鍋料理は今までどおり汁物のまま。
 */
const POT_AS_TOOL = /お?鍋[にでをへは]/g

/**
 * それ自体は汁物を意味しない「だし」の調味料（2026-08-23 便KG）。
 * 実データAの「ズボラ常備菜 にんじんしりしり」は、材料の「だしの素」で汁物になっていた
 * （icon.ts は「だし汁」だけを除いていて、粉末・液体のだしを知らなかった）。
 */
const SOUPY_SEASONING = /(だしの素|だしのもと|白だし|ほんだし|顆粒だし|和風だし|中華だし|だしパック|めんつゆ|そばつゆ|つゆの素)/

function hasWord(text: string, words: readonly string[]): boolean {
  return words.some((word) => text.includes(word))
}

/** アイコンの種別を役割へ写像する。どれにも当たらない（default）は保留＝undefined */
function roleOfIcon(icon: IconKey): DishType | undefined {
  switch (icon) {
    case 'soup':
      return 'soup'
    case 'salad':
    case 'vegetable':
      return 'side'
    case 'dessert':
    case 'drink':
    case 'bread':
      // dessert は UI 上「その他（おやつ・ご飯のお供など）」の役割枠。献立エンジンでは
      // 主菜・副菜どちらのプールにも入らない（logic/mealPlan.ts）。
      return 'dessert'
    case 'default':
      return undefined
    default:
      // fish / egg / tofu / chicken / meat / rice / pasta / noodle
      return 'main'
  }
}

/**
 * 料理名・タグ・材料から役割を読み取る（2026-08-23 便KG）。
 * **読み取れなかったときは undefined（保留）を返す**＝機械が決めた値をデータに書き込まない。
 * 登録フォームはこれを使い、保留のときはチップを未選択のまま出して利用者に選んでもらう。
 */
export function suggestDishType(input: DishTypeGuessInput): DishType | undefined {
  const title = input.title
  // ① 料理名に役割そのものが書いてある
  if (hasWord(title, SIDE_ROLE_WORDS)) return 'side'
  // ② あえ物・サラダ・漬物の形（たんぱく源の材料より先に取る）
  if (hasWord(title, SIDE_DISH_WORDS) && !hasWord(title, SIDE_DISH_EXCLUDE)) return 'side'

  // ③ アイコンの自動判定を役割へ写像する。料理名の「お鍋に」は道具なので外してから渡す
  const cleanedTitle = title.replace(POT_AS_TOOL, ' ')
  const icon = pickIconKey({ ...input, title: cleanedTitle })
  if (icon === 'soup') {
    const fromTitle = pickIconKey({ title: cleanedTitle, tags: [], ingredients: [] })
    if (fromTitle !== 'soup') {
      // 料理名では汁物と言っていない＝材料・タグの「白だし」「だしの素」で汁物になった。
      // だしの調味料を除いて判定し直す（除いても汁物なら、それは本当に汁物の材料）
      const withoutDashi = input.ingredients.filter((one) => !SOUPY_SEASONING.test(one.name))
      return roleOfIcon(pickIconKey({ title: cleanedTitle, tags: input.tags, ingredients: withoutDashi }))
    }
  }
  return roleOfIcon(icon)
}

/**
 * 役割を1つに決める（読み取れなければ主菜）。
 *
 * 献立エンジン・検索のように「未設定のレシピにも何かの役割を当てて動く」側が使う
 * （logic/mealPlan.ts の recipeDishType・logic/kana.ts の検索語）。ここでの主菜は
 * **データに書き込まない内部の当て推量**で、レシピの dishType 欄には残らない。
 * 保存する値を決める登録フォームは suggestDishType（保留を返す）を使うこと。
 */
export function guessDishType(input: DishTypeGuessInput): DishType {
  return suggestDishType(input) ?? 'main'
}
