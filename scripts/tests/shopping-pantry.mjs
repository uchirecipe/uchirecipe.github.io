// 買い物メモと在庫（候補・売り場・チェック・在庫の名寄せ）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { readFileSync } from 'node:fs'
import { eq, neq } from './_harness.mjs'
import { toPantryKey } from '../../src/logic/kana.ts'
import {
  buildShoppingCandidates,
  sortShoppingByAisle,
  groupShoppingByAisle,
  resolveShoppingSources,
  combineAmountTexts,
  parseRecipeIdsParam,
  parseServingsParam,
  filterShoppingEntries,
  shoppingRangeIncludesTodayList,
  isShoppingRangeNarrowed,
  formatShoppingRangeDates,
  formatShoppingRangeLabel,
  toRawRiceIngredient,
  splitCheckedShoppingItems,
  COOKED_RICE_TO_RAW_RATIO,
} from '../../src/logic/shopping.ts'
import { selectPantryDowngrades } from '../../src/logic/pantry.ts'
import {
  categorizePantryName,
  resolvePantryGroup,
  groupPantryItems,
  categorizedFoodLabels,
  normalizeAisleOrder,
  moveAisleGroup,
  isDefaultAisleOrder,
  SHOPPING_AISLE_ORDER,
} from '../../src/logic/pantryGroups.ts'
import { NUTRITION_DATA } from '../../src/logic/nutritionData.ts'
import { ja } from '../../src/i18n/ja.ts'

// ---------- buildShoppingCandidates(「水」がチェック済みで入る・2026-07-09ペルソナ第2波) ----------
// 2026-08-22 便IX: 水・お湯・湯は「デフォルト未チェックで並べる」から「そもそも出さない」に
// 変わった(オーナーのテスト用データ31品で、買い物メモに「お湯」が並ぶことが分かったため)。
// 残りの3件(だし汁・鶏むね肉・しょうゆ)のチェックの向きは従来のまま
{
  const recipes = [
    {
      id: 1,
      ingredients: [
        { name: '水', amount: '600', unit: 'ml' },
        { name: 'お湯', amount: '200', unit: 'ml' },
        { name: '湯', amount: '400', unit: 'ml' },
        { name: 'だし汁', amount: '300', unit: 'ml' },
        { name: '鶏むね肉', amount: '1', unit: '枚' },
        { name: 'しょうゆ', amount: '2', unit: '大さじ' },
      ],
    },
  ]
  const candidates = buildShoppingCandidates(recipes, [])
  const byName = new Map(candidates.map((c) => [c.name, c]))
  eq('買い物候補: 水は買い物メモに出さない(便IXで未チェック→非表示)', byName.has('水'), false)
  eq('買い物候補: お湯も出さない', byName.has('お湯'), false)
  eq('買い物候補: 湯も出さない', byName.has('湯'), false)
  eq('買い物候補: だし汁は通常どおりチェック側', byName.get('だし汁')?.isSeasoningLike, false)
  eq('買い物候補: 主材料はチェック側のまま', byName.get('鶏むね肉')?.isSeasoningLike, false)
  eq('買い物候補: 調味料は従来どおり未チェック側', byName.get('しょうゆ')?.isSeasoningLike, true)
}

// ---------- buildShoppingCandidates: 食数スケール(2026-07-23 オーナー実機FB #3「食数の+/-」方式) ----------
{
  // 2人分レシピを「4食」ぶん(scale=2)作ると、数値化できる分量は2倍になる
  const c = buildShoppingCandidates(
    [
      {
        id: 1,
        ingredients: [
          { name: '玉ねぎ', amount: '1', unit: '個' },
          { name: '牛乳', amount: '100', unit: 'ml' },
          { name: '塩', amount: '少々', unit: '' }, // 数値化できない分量は原文のまま(スケールしない)
        ],
        scale: 2,
      },
    ],
    [],
  )
  const byName = new Map(c.map((x) => [x.name, x]))
  eq('食数スケール: 玉ねぎ1個×2=2個', byName.get('玉ねぎ')?.amount, '2個')
  eq('食数スケール: 牛乳100ml×2=200ml', byName.get('牛乳')?.amount, '200ml')
  eq('食数スケール: 少々はスケールしない', byName.get('塩')?.amount, '少々')
}
{
  // scale未指定は等倍(既存呼び出し=献立の「この週の買い物リストを作る」等を壊さない)
  const c = buildShoppingCandidates([{ id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }], [])
  eq('食数スケール: scale未指定は等倍', c[0]?.amount, '1個')
  // 別々のscaleを持つ同じ食材は、スケール後の数値で合算する(1個×2 + 1個×3 = 5個)
  const c2 = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 2 },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 3 },
    ],
    [],
  )
  eq('食数スケール: 別scaleの同一食材はスケール後に合算(5個)', c2[0]?.amount, '5個')
}

// ---------- buildShoppingCandidates: 分数分量(2026-07-29 便CC/C1。S1: 分母を無視して2〜4倍になっていた) ----------
{
  const amountOf = (ingredients, scale, have = []) =>
    buildShoppingCandidates([{ id: 1, ingredients, scale }], have)[0]?.amount

  // 等倍(食数=登録人数)は原文をそのまま見せる(レシピ詳細の表示と一致させる・C11)
  eq('買い物候補(分数): 1/2本 等倍→1/2本', amountOf([{ name: 'にんじん', amount: '1/2', unit: '本' }], 1), '1/2本')
  eq('買い物候補(分数): 大さじ1/2 等倍→大さじ1/2', amountOf([{ name: 'みりん', amount: '1/2', unit: '大さじ' }], 1), '大さじ1/2')
  eq(
    '買い物候補(分数): 帯分数「1と1/2個」等倍→原文のまま',
    amountOf([{ name: '玉ねぎ', amount: '1と1/2', unit: '個' }], 1),
    '1と1/2個',
  )
  // 2レシピぶんの合算は分母を解釈してから足す(1/2個 + 1/2個 = 1個)
  const half2 = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1/2', unit: '個' }] },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '1/2', unit: '個' }] },
    ],
    [],
  )
  eq('買い物候補(分数): 1/2個+1/2個=1個', half2[0]?.amount, '1個')
  // カレールー1/2箱を4人分レシピ→3食(scale=0.75)。レシピ詳細と同じ「1/2箱」になる
  eq(
    '買い物候補(分数): カレールー1/2箱×0.75→1/2箱(レシピ詳細と一致)',
    amountOf([{ name: 'カレールー', amount: '1/2', unit: '箱' }], 0.75),
    '1/2箱',
  )
  eq(
    '買い物候補(分数): 豆腐1/2丁×1.5→1丁',
    amountOf([{ name: '豆腐', amount: '1/2', unit: '丁' }], 1.5),
    '1丁',
  )
}

// ---------- buildShoppingCandidates: 単位ごとの丸め(2026-07-29 便CC/C11。62.5g・0.3本など買えない粒度) ----------
{
  const amountOf = (ingredients, scale) =>
    buildShoppingCandidates([{ id: 1, ingredients, scale }], [])[0]?.amount
  eq('買い物候補(丸め): 250g×0.25→65g(5刻み)', amountOf([{ name: '豚こま切れ肉', amount: '250', unit: 'g' }], 0.25), '65g')
  // 2026-08-22 便IX: 「水」は買い物メモに出さなくなったので、丸めの見張りは同じml単位で
  // 店で買うもの(だし汁)に置き換えた。測っているのは10刻みの丸めで、食材名は関係しない
  eq('買い物候補(丸め): 700ml×0.25→180ml(10刻み)', amountOf([{ name: 'だし汁', amount: '700', unit: 'ml' }], 0.25), '180ml')
  eq('買い物候補(丸め): 1本×0.25→1/2本(個数系は0.5刻み・0にしない)', amountOf([{ name: 'にんじん', amount: '1', unit: '本' }], 0.25), '1/2本')
  eq('買い物候補(丸め): 1箱×0.25→1/2箱', amountOf([{ name: 'カレールー', amount: '1', unit: '箱' }], 0.25), '1/2箱')
}

// ---------- buildShoppingCandidates: 単位が混ざる/略記(2026-07-29 便CC/C12。数値側までスケールが落ちていた) ----------
{
  // 同じ単位グループに「少々」が混ざっても、数値側はスケールして合算する
  const mixed = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '塩', amount: '少々', unit: '' }], scale: 2 },
      { id: 2, ingredients: [{ name: '塩', amount: '2', unit: '' }], scale: 2 },
    ],
    [],
  )
  eq('買い物候補(混在): 数値側は2×2=4にスケールし「少々」は原文で併記', mixed[0]?.amount, '4・少々')
  // 「大2」「小1」の略記も大さじ/小さじとして解釈してスケールする
  const abbrev = buildShoppingCandidates(
    [{ id: 1, ingredients: [{ name: 'しょうゆ', amount: '大2', unit: '' }], scale: 2 }],
    [],
  )
  eq('買い物候補(略記): 大2×2→大さじ4', abbrev[0]?.amount, '大さじ4')
  // 範囲分量は人数スケールに非対応(レシピ詳細と同じ)。原文のまま残す
  const range = buildShoppingCandidates(
    [{ id: 1, ingredients: [{ name: '牛こま切れ肉', amount: '200〜250', unit: 'g' }] }],
    [],
  )
  eq('買い物候補(範囲): 200〜250gは原文のまま', range[0]?.amount, '200〜250g')
}

// ---------- combineAmountTexts(2026-07-29 便CC/C14。買い物メモの重複行の合算) ----------
{
  eq('メモ合算: 1束+2束=3束', combineAmountTexts(['1束', '2束']), '3束')
  eq('メモ合算: 200g+150g=350g', combineAmountTexts(['200g', '150g']), '350g')
  eq('メモ合算: 大さじ1+大さじ2=大さじ3', combineAmountTexts(['大さじ1', '大さじ2']), '大さじ3')
  eq('メモ合算: 1/2本+1/2本=1本', combineAmountTexts(['1/2本', '1/2本']), '1本')
  eq('メモ合算: 単位違いは「・」で並べる', combineAmountTexts(['1本', '100g']), '1本・100g')
  eq('メモ合算: 数値化できない分量は原文のまま並べる', combineAmountTexts(['少々', '1つまみ']), '少々・1つまみ')
  eq('メモ合算: 片方が空なら残りをそのまま', combineAmountTexts(['1袋', undefined]), '1袋')
  eq('メモ合算: 両方空なら空文字', combineAmountTexts([undefined, '']), '')
  eq('メモ合算: 範囲分量は原文のまま', combineAmountTexts(['200〜250g', undefined]), '200〜250g')
}

// ---------- parseRecipeIdsParam(2026-07-29 便CC/C10。献立経路に回数=倍率を乗せる) ----------
{
  eq('献立経路: 単純なID列は各1回分', parseRecipeIdsParam('1,2,3'), [
    { id: 1, times: 1 },
    { id: 2, times: 1 },
    { id: 3, times: 1 },
  ])
  eq('献立経路: 「1x3」は3回分', parseRecipeIdsParam('1x3,2'), [
    { id: 1, times: 3 },
    { id: 2, times: 1 },
  ])
  eq('献立経路: 同じIDの重複は回数として足す', parseRecipeIdsParam('5,5,7'), [
    { id: 5, times: 2 },
    { id: 7, times: 1 },
  ])
  eq('献立経路: 空文字・数値でない要素は無視', parseRecipeIdsParam('1,,abc,2'), [
    { id: 1, times: 1 },
    { id: 2, times: 1 },
  ])
  eq('献立経路: 空パラメータは0件', parseRecipeIdsParam(''), [])
}

// ---------- parseServingsParam(2026-08-03 便DJ。献立の枠ごとの食数を買い物メモへ渡す) ----------
// 再発防止: 食数を渡す経路が増えても「回数」経路の分量計算を壊さないこと、
// 壊れた値(0・負・数値でない)が分量計算に流れ込まないことを固定する
{
  const toObj = (m) => Object.fromEntries([...m].map(([k, v]) => [String(k), v]))
  eq('食数: 「1:8,3:4」はレシピごとの合計食数', toObj(parseServingsParam('1:8,3:4')), {
    1: 8,
    3: 4,
  })
  eq('食数: 同じIDが並んだら足し合わせる', toObj(parseServingsParam('2:3,2:5')), { 2: 8 })
  eq('食数: 0以下は捨てる(分量が0や負にならない)', toObj(parseServingsParam('1:0,2:-3,3:2')), {
    3: 2,
  })
  eq('食数: 数値でない値・欠けた値は捨てる', toObj(parseServingsParam('1:abc,2,,3:4')), { 3: 4 })
  eq('食数: 空パラメータは0件', toObj(parseServingsParam('')), {})
}

// ---------- toPantryKey(2026-07-29 便CC/C4。在庫照合の名寄せキーを1本化) ----------
{
  eq('在庫キー: 括弧書きを落とす', toPantryKey('長ねぎ（白い部分）'), toPantryKey('長ねぎ'))
  eq('在庫キー: 半角括弧も落とす', toPantryKey('片栗粉(あん用)'), toPantryKey('片栗粉'))
  eq('在庫キー: 空白・中黒のゆれを吸収', toPantryKey('オリーブ・オイル'), toPantryKey('オリーブオイル'))
  eq('在庫キー: かな/漢字の表記ゆれを吸収', toPantryKey('とりにく'), toPantryKey('鶏肉'))
  // 別食材どうしがぶつからないこと(部分一致に寄せないための歯止め)
  neq('在庫キー: 豆腐と高野豆腐は別物', toPantryKey('豆腐'), toPantryKey('高野豆腐'))
  neq('在庫キー: 卵と砂糖(卵用)は別物', toPantryKey('卵'), toPantryKey('砂糖（卵用）'))
  neq('在庫キー: ねぎと玉ねぎは別物', toPantryKey('ねぎ'), toPantryKey('玉ねぎ'))
}

// ---------- 買い物候補の除外: 括弧付き材料も在庫「ある」で除外される(便CC/C4) ----------
{
  const c = buildShoppingCandidates(
    [
      {
        id: 1,
        ingredients: [
          { name: '長ねぎ（白い部分）', amount: '1/2', unit: '本' },
          { name: 'にんじん', amount: '1', unit: '本' },
        ],
      },
    ],
    ['長ねぎ'],
  )
  eq('買い物候補: 在庫「長ねぎ」ありなら「長ねぎ（白い部分）」も除外される', c.map((x) => x.name), ['にんじん'])
}

// ---------- 在庫チップの大分類グループ(2026-07-23 オーナー実機FB #1) ----------
{
  eq('在庫グループ: 玉ねぎ→野菜・きのこ', categorizePantryName('玉ねぎ'), 'vegetable')
  eq('在庫グループ: しめじ→野菜・きのこ', categorizePantryName('しめじ'), 'vegetable')
  eq('在庫グループ: 納豆→豆腐・卵・乳', categorizePantryName('納豆'), 'soyEgg')
  eq('在庫グループ: 卵→豆腐・卵・乳', categorizePantryName('卵'), 'soyEgg')
  eq('在庫グループ: 牛乳→豆腐・卵・乳', categorizePantryName('牛乳'), 'soyEgg')
  eq('在庫グループ: 米→主食・粉', categorizePantryName('米'), 'staple')
  eq('在庫グループ: しょうゆ→調味料', categorizePantryName('しょうゆ'), 'seasoning')
  eq('在庫グループ: 味噌→調味料', categorizePantryName('味噌'), 'seasoning')
  eq('在庫グループ: 鮭→肉・魚介', categorizePantryName('鮭'), 'meatFish')
  // 栄養DBに部位別しか無い総称語はキーワードで救済(#1フォールバック)
  eq('在庫グループ: 豚肉→肉・魚介(総称語フォールバック)', categorizePantryName('豚肉'), 'meatFish')
  eq('在庫グループ: 鶏肉→肉・魚介(総称語フォールバック)', categorizePantryName('鶏肉'), 'meatFish')
  // 未知の食材は その他
  eq('在庫グループ: 未知の食材→その他', categorizePantryName('架空の宇宙食材'), 'other')
  // 手動指定(group)は自動判定より優先
  eq('在庫グループ: 手動指定が自動判定より優先', resolvePantryGroup({ name: '豚肉', group: 'other' }), 'other')
  eq('在庫グループ: 手動指定なしは自動判定', resolvePantryGroup({ name: '玉ねぎ' }), 'vegetable')
}
{
  // カバレッジ: 栄養DBの全食品labelがどれかのグループに分類済み(未分類の取りこぼしを検知)
  const categorized = categorizedFoodLabels()
  const missing = NUTRITION_DATA.foods.map((f) => f.label).filter((label) => !categorized.has(label))
  eq('在庫グループ: 栄養DB全食品が分類済み(未分類0件)', missing, [])
}
{
  // groupPantryItems: PANTRY_GROUP_ORDER順にまとまり、空グループは出ない
  const grouped = groupPantryItems([
    { id: 1, name: 'しょうゆ' },
    { id: 2, name: '豚肉' },
    { id: 3, name: '玉ねぎ' },
  ])
  eq('在庫グループ分け: 肉→野菜→調味料の表示順で空グループは出ない', grouped.map((g) => g.key), [
    'meatFish',
    'vegetable',
    'seasoning',
  ])
}

// ---------- 買い物メモの売り場順(2026-07-24 実機FB #11) ----------
{
  // 在庫の表示順(肉が先)とは別に、買い物は売り場導線=野菜→肉→豆腐卵乳→主食粉→調味料→その他。
  // 同じグループ内は元の並び(既存の追加順)を安定して保つ
  const sorted = sortShoppingByAisle([
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉' }, // 肉・魚介
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん' }, // 野菜・きのこ(玉ねぎより後=既存順を維持する)
    { id: 5, name: '架空の宇宙食材' }, // その他
    { id: 6, name: '卵' }, // 豆腐・卵・乳
    { id: 7, name: '米' }, // 主食・粉
  ])
  eq('買い物売り場順: 野菜→肉→豆腐卵乳→主食粉→調味料→その他の順に並ぶ', sorted.map((s) => s.name), [
    '玉ねぎ',
    'にんじん',
    '豚肉',
    '卵',
    '米',
    'しょうゆ',
    '架空の宇宙食材',
  ])
}

// ---------- DY-1 買い物メモの売り場ブロック(2026-08-08 オーナー実機フィードバック①) ----------
// 「売り場順ごとに食材をブロック分けして表示して。たくさんの食材が羅列していて見づらい」。
// 見出しつきの塊に切り直すだけで、並べ替えの規則(sortShoppingByAisle)は一切変えない
{
  const items = [
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉' }, // 肉・魚介
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん' }, // 野菜・きのこ(玉ねぎより後=既存順を維持する)
    { id: 5, name: '卵', isChecked: true }, // 豆腐・卵・乳(チェック済みでも同じグループに残す)
  ]
  const groups = groupShoppingByAisle(items)
  eq(
    'DY-1 売り場ブロック: 既定順で見出しが並び、中身が0件の売り場(主食・粉/その他)は出さない',
    groups.map((g) => g.key),
    ['vegetable', 'meatFish', 'soyEgg', 'seasoning'],
  )
  eq(
    'DY-1 売り場ブロック: グループ内は元の並び(追加順)を保つ',
    groups.map((g) => g.items.map((i) => i.name)),
    [['玉ねぎ', 'にんじん'], ['豚肉'], ['卵'], ['しょうゆ']],
  )
  eq(
    'DY-1 売り場ブロック: チェック済みも元のグループに残す(買ったものが別枠へ飛ばない)',
    groups.find((g) => g.key === 'soyEgg').items.map((i) => i.isChecked),
    [true],
  )
  // 平らにすると従来の整列と完全に一致する＝並べ替えの既存挙動を壊していないことの担保
  eq(
    'DY-1 売り場ブロック: 平らにすると sortShoppingByAisle と同じ並び',
    groups.flatMap((g) => g.items).map((i) => i.name),
    sortShoppingByAisle(items).map((i) => i.name),
  )
  // 設定のカスタム売り場順にも従う(未知のキー・欠けは normalizeAisleOrder が補う)
  const custom = groupShoppingByAisle(items, ['seasoning', 'soyEgg'])
  eq(
    'DY-1 売り場ブロック: 設定のカスタム順に従い、残りは既定順で続く',
    custom.map((g) => g.key),
    ['seasoning', 'soyEgg', 'vegetable', 'meatFish'],
  )
  eq(
    'DY-1 売り場ブロック: カスタム順でも平らにすれば sortShoppingByAisle と同じ',
    custom.flatMap((g) => g.items).map((i) => i.name),
    sortShoppingByAisle(items, ['seasoning', 'soyEgg']).map((i) => i.name),
  )
  eq('DY-1 売り場ブロック: 空の買い物メモは見出しを1つも出さない', groupShoppingByAisle([]), [])
}

// ---------- EE-2 買い物メモのごはん→お米換算(2026-08-08 オーナー実機フィードバック) ----------
// 「ご飯はお米換算（g）にして欲しい」。レシピの材料は炊きあがりの重さで書くので、
// 買い物メモに入る分だけ生米のグラム(炊きあがり÷2.2)に置き換える
{
  eq('EE-2 炊きあがり→生米の倍率は2.2倍', COOKED_RICE_TO_RAW_RATIO, 2.2)
  // 茶碗1杯=炊きあがり150g(成分表 01088 の unitGrams) → 150÷2.2=68.2g → gの丸め(5g刻み)で70g
  eq('EE-2 「ご飯 1杯」→「米 70g」', toRawRiceIngredient({ name: 'ご飯', amount: '1', unit: '杯' }), {
    name: '米',
    amount: '70',
    unit: 'g',
  })
  // 2杯=300g → 136.4g → 100g以上は10g刻みで140g
  eq('EE-2 「ご飯 2杯」→「米 140g」', toRawRiceIngredient({ name: 'ご飯', amount: '2', unit: '杯' }), {
    name: '米',
    amount: '140',
    unit: 'g',
  })
  eq(
    'EE-2 ひらがな「ごはん」と単位「杯分」でも換算する',
    toRawRiceIngredient({ name: 'ごはん', amount: '2', unit: '杯分' }),
    { name: '米', amount: '140', unit: 'g' },
  )
  eq(
    'EE-2 炊きあがりをgで書いてあっても生米に戻す(300g→140g)',
    toRawRiceIngredient({ name: 'ご飯', amount: '300', unit: 'g' }),
    { name: '米', amount: '140', unit: 'g' },
  )
  // 量を数値にできない行は、買う量を作文せずそのまま出す
  eq(
    'EE-2 「ご飯 適量」は換算せずそのまま',
    toRawRiceIngredient({ name: 'ご飯', amount: '適量', unit: '' }),
    { name: 'ご飯', amount: '適量', unit: '' },
  )
  // 最初から生米で書いてある行・関係ない食材には触らない
  eq('EE-2 「米 2合」はそのまま', toRawRiceIngredient({ name: '米', amount: '2', unit: '合' }), {
    name: '米',
    amount: '2',
    unit: '合',
  })
  eq('EE-2 「玉ねぎ 1個」はそのまま', toRawRiceIngredient({ name: '玉ねぎ', amount: '1', unit: '個' }), {
    name: '玉ねぎ',
    amount: '1',
    unit: '個',
  })
  eq(
    'EE-2 「五目炊き込みご飯」のような料理名は換算しない',
    toRawRiceIngredient({ name: '五目炊き込みご飯', amount: '1', unit: '個' }).name,
    '五目炊き込みご飯',
  )
  // 買い物候補まで通したときの見え方(名前が「米」・分量が「140g」・調味料扱いにならない)
  {
    const built = buildShoppingCandidates(
      [
        {
          id: 1,
          ingredients: [
            { name: 'ご飯', amount: '2', unit: '杯' },
            { name: '卵', amount: '2', unit: '個' },
          ],
        },
      ],
      [],
    )
    eq('EE-2 買い物候補の食材名が「米」になる', built[0].name, '米')
    eq('EE-2 買い物候補の分量が「140g」になる', built[0].amount, '140g')
    eq('EE-2 換算した米は調味料あつかいにしない(既定でチェックが付く)', built[0].isSeasoningLike, false)
    eq(
      'EE-2 出所の内訳にも換算後の分量が入る',
      built[0].sources,
      [{ recipeId: 1, amount: '140g' }],
    )
  }
  // 在庫「ある」の照合は、元の名前(ご飯)と換算後の名前(米)の両方で効く
  {
    const recipes = [{ id: 1, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] }]
    eq('EE-2 在庫に「米」があれば候補に出さない', buildShoppingCandidates(recipes, ['米']), [])
    eq('EE-2 在庫に「ご飯」があれば候補に出さない', buildShoppingCandidates(recipes, ['ご飯']), [])
  }
  // 出所の小窓: 換算後の行(米)も、この変更より前に保存された行(ご飯)も分量が読める
  {
    const recipeById = new Map([
      [1, { title: '牛丼', ingredients: [{ name: 'ご飯', amount: '2', unit: '杯分' }] }],
    ])
    eq(
      'EE-2 出所の小窓: 「米」の行はレシピのご飯を換算した分量を出す',
      resolveShoppingSources({ name: '米', recipeIds: [1] }, recipeById).recipes[0].amount,
      '140g',
    )
    eq(
      'EE-2 出所の小窓: 換算前に保存された「ご飯」の行はレシピのままの分量を出す',
      resolveShoppingSources({ name: 'ご飯', recipeIds: [1] }, recipeById).recipes[0].amount,
      '2杯分',
    )
  }
  // 同じ食材として合算される＝「ご飯」と「米」で2行に割れない
  {
    const built = buildShoppingCandidates(
      [
        { id: 1, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] },
        { id: 2, ingredients: [{ name: 'ご飯', amount: '2', unit: '杯' }] },
      ],
      [],
    )
    eq('EE-2 複数レシピのごはんは「米」1行にまとまる', built.length, 1)
    eq('EE-2 まとまった分量は合算される(140+140=280g)', built[0].amount, '280g')
  }
}

// ---------- EE-5 チェック済みを下にまとめる(2026-08-08 オーナー実機フィードバック) ----------
// 「スイッチで、チェックした商品をまとめてページの下方に表示し、チェックしていない食材だけが
// 上に残るようにしたい」。既定(スイッチOFF)はこの関数を通さない＝従来どおり
{
  const items = [
    { id: 1, name: 'しょうゆ' }, // 調味料
    { id: 2, name: '豚肉', isChecked: true }, // 肉・魚介(この売り場は全部チェック済みになる)
    { id: 3, name: '玉ねぎ' }, // 野菜・きのこ
    { id: 4, name: 'にんじん', isChecked: true }, // 野菜・きのこ
    { id: 5, name: '卵', isChecked: true }, // 豆腐・卵・乳(この売り場も全部チェック済み)
  ]
  const groups = groupShoppingByAisle(items)
  const split = splitCheckedShoppingItems(groups)
  eq(
    'EE-5 上に残るのは未チェックだけ',
    split.groups.map((g) => g.items.map((i) => i.name)),
    [['玉ねぎ'], ['しょうゆ']],
  )
  eq(
    'EE-5 中身が全部チェック済みになった売り場は見出しごと消える',
    split.groups.map((g) => g.key),
    ['vegetable', 'seasoning'],
  )
  eq(
    'EE-5 下にまとめたチェック済みは売り場順のまま',
    split.checked.map((i) => i.name),
    ['にんじん', '豚肉', '卵'],
  )
  // 1件も落とさない＝上＋下で元の全件がそろう(買い物メモから食材が消えたように見せない)
  eq(
    'EE-5 上と下を合わせると元の全件がそろう',
    [...split.groups.flatMap((g) => g.items), ...split.checked].map((i) => i.id).sort(),
    [1, 2, 3, 4, 5],
  )
  // 全部チェック済み/1件もチェックしていないときの端
  eq(
    'EE-5 全部チェック済みなら上の売り場ブロックは1つも残らない',
    splitCheckedShoppingItems(groupShoppingByAisle([{ id: 1, name: '卵', isChecked: true }])).groups,
    [],
  )
  eq(
    'EE-5 1件もチェックしていなければ売り場ブロックは元のまま',
    splitCheckedShoppingItems(groupShoppingByAisle([{ id: 1, name: '卵' }])).groups.map((g) => g.key),
    ['soyEgg'],
  )
  eq('EE-5 空の買い物メモでも壊れない', splitCheckedShoppingItems([]), { groups: [], checked: [] })
}

// ---------- DY-2 買い物メモの出所(2026-08-08 オーナー実機フィードバック②) ----------
// 「食材をタップしたら、どのレシピから登録したのか確認できるように小窓出して欲しい」。
// 実装確認の結果、行が持っていたのは fromRecipeIds(レシピIDの並び)だけで分量は持っていなかった。
// 生成時にレシピごとの分量(sources)を持たせ、古い行はレシピの材料欄から読み直す
{
  // 下書きを作った時点で、レシピごとの内訳が食数スケール込みで載る
  const built = buildShoppingCandidates(
    [
      { id: 1, ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], scale: 2 },
      { id: 2, ingredients: [{ name: '玉ねぎ', amount: '100', unit: 'g' }], scale: 1 },
    ],
    [],
  )
  eq('DY-2 出所: レシピごとの分量を持つ(食数スケール込み)', built[0].sources, [
    { recipeId: 1, amount: '2個' },
    { recipeId: 2, amount: '100g' },
  ])
  eq('DY-2 出所: recipeIds は sources と同じ並びのまま(既存の呼び出しを壊さない)', built[0].recipeIds, [1, 2])
  // 同じレシピが同じ材料を2行書いていたら、そのレシピの内訳の中で合算する
  const dup = buildShoppingCandidates(
    [{ id: 5, ingredients: [{ name: '砂糖', amount: '1', unit: '大さじ' }, { name: '砂糖', amount: '2', unit: '大さじ' }] }],
    [],
  )
  eq('DY-2 出所: 同じレシピ内の重複行は1件にまとめる', dup[0].sources, [{ recipeId: 5, amount: '大さじ3' }])

  const recipeById = new Map([
    [1, { title: '肉じゃが', ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }] }],
    [2, { title: 'カレーライス', ingredients: [{ name: '玉ねぎ', amount: '100', unit: 'g' }] }],
  ])
  eq(
    'DY-2 出所: sources があればレシピ名と分量をそのまま出す',
    resolveShoppingSources({ name: '玉ねぎ', sources: built[0].sources }, recipeById),
    {
      recipes: [
        { recipeId: 1, title: '肉じゃが', amount: '2個' },
        { recipeId: 2, title: 'カレーライス', amount: '100g' },
      ],
      manual: false,
      missing: 0,
    },
  )
  // 後方互換: この機能より前に作った行は fromRecipeIds しか持たない→レシピの材料欄から分量を読む
  eq(
    'DY-2 出所: 古い行(レシピIDだけ)はレシピの材料欄から分量を読む',
    resolveShoppingSources({ name: '玉ねぎ', recipeIds: [1, 2] }, recipeById),
    {
      recipes: [
        { recipeId: 1, title: '肉じゃが', amount: '1個' },
        { recipeId: 2, title: 'カレーライス', amount: '100g' },
      ],
      manual: false,
      missing: 0,
    },
  )
  eq(
    'DY-2 出所: 手で足した行は「自分で追加」(レシピは0件)',
    resolveShoppingSources({ name: 'ラップ', manualAdded: true }, recipeById),
    { recipes: [], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: 出所の記録が何も無い行も「自分で追加」として扱う',
    resolveShoppingSources({ name: 'ラップ' }, recipeById),
    { recipes: [], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: レシピ由来の行に手で足した分があれば両方出す',
    resolveShoppingSources(
      { name: '玉ねぎ', sources: [{ recipeId: 1, amount: '2個' }], manualAdded: true },
      recipeById,
    ),
    { recipes: [{ recipeId: 1, title: '肉じゃが', amount: '2個' }], manual: true, missing: 0 },
  )
  eq(
    'DY-2 出所: 削除されたレシピは一覧から落として件数だけ返す',
    resolveShoppingSources({ name: '玉ねぎ', recipeIds: [1, 999] }, recipeById),
    { recipes: [{ recipeId: 1, title: '肉じゃが', amount: '1個' }], manual: false, missing: 1 },
  )
  eq(
    'DY-2 出所: レシピに無い食材(在庫から手で足した等)は分量を作文せず空にする',
    resolveShoppingSources({ name: 'ラップ', recipeIds: [1] }, recipeById).recipes,
    [{ recipeId: 1, title: '肉じゃが', amount: '' }],
  )
}

// ---------- EE-3/EE-4 買い物完了の確認文(2026-08-08 → 2026-08-26 オーナー指示で短縮) --------
// 2026-08-08 ③「『買い物終了』後の文章が読みづらい」→内容ごとに改行。
//
// 2026-08-26 オーナー指示(書き溜め0826):
//   ・確認文「「反映せず完了」を押すと〜」→削除。ボタンの名前で意味がわかるため。
//   ・「あとにする」…ボタンの名前で意味がわかるため、説明文２つも削除。
// **規約Fは満たしたまま**にする＝どちらのボタンでも消える件数({n})と残る件数({m})は書く。
// 落としたのは「反映せず完了」を押したときの結果だけで、これはボタンの名前が言い切っている
// （2026-08-25 差し戻しDで足した規約Fの例外と同じ形）。
{
  eq('EE-3 買い物完了の確認は3行に分かれている', ja.shopping.completeConfirmLines.length, 3)
  // 規約F: 何が消えて何が残るかを件数つきで両方書く
  eq(
    'EE-3 消える件数({n})と残る件数({m})を両方書いている',
    [
      ja.shopping.completeConfirmLines.some((l) => l.includes('{n}') && l.includes('消えます')),
      ja.shopping.completeConfirmLines.some((l) => l.includes('{m}') && l.includes('残ります')),
    ],
    [true, true],
  )
  // 在庫に入るほうは、押すボタンの名前で結果を書く（ここは名前だけでは読み取れない）
  eq(
    `EE-3 確認文が「${ja.shopping.completeYes}」を押したときの結果を書いている`,
    ja.shopping.completeConfirmLines.some((l) => l.includes(`「${ja.shopping.completeYes}」を押すと`)),
    true,
  )
  // 2026-08-26: 「反映せず完了」の説明は書き戻さない（ボタンの名前が言い切っている）
  eq(
    `EE-3 「${ja.shopping.completeNo}」を押したときの説明を並べ立てていない`,
    ja.shopping.completeConfirmLines.some((l) => l.includes(`「${ja.shopping.completeNo}」を押すと`)),
    false,
  )
  // どちらを押しても消える／残る、は1行で言い切る（ボタンごとに書き分けない）
  eq(
    'EE-3 消える件数はボタンを問わない1行で書いている',
    ja.shopping.completeConfirmLines.some((l) => l.includes('どちらを押しても')),
    true,
  )
  // 2026-08-26: 「あとにする」の説明2行は ja.ts ごと消えている（画面にも出さない）
  eq('EE-4 「あとにする」の説明文を ja.ts に残していない', 'completeLaterLines' in ja.shopping, false)
  eq(
    'EE-4 画面側でも「あとにする」の説明を書き写していない',
    readFileSync(new URL('../../src/pages/ShoppingPage.tsx', import.meta.url), 'utf-8').includes(
      'completeLaterLines',
    ),
    false,
  )
  // 押したあとに何が起きたかは、これまでどおりトーストが言う（黙って閉じない）
  eq('EE-4 押したあとの結果はトーストで言う', ja.shopping.completeLaterToast, '買い物メモはそのままにしました')
}

// ---------- selectPantryDowngrades(2026-07-23 オーナー実機FB #11「作った!」の在庫反映) ----------
{
  const items = [
    { id: 1, name: '豚バラ肉', level: 'have', isFrequent: true }, // 使った→ある→少ない
    { id: 2, name: '玉ねぎ', level: 'low', isFrequent: true }, // 使った→少ない→ない
    { id: 3, name: 'しょうゆ', level: 'have', isFrequent: true }, // 調味料→対象外
    { id: 4, name: 'にんじん', level: 'have', isFrequent: true }, // レシピに無い→変化なし
    { id: 5, name: 'キャベツ', level: 'none', isFrequent: true }, // 使ったが既にない→据え置き
  ]
  const ingredients = ['豚バラ肉', '玉ねぎ', 'しょうゆ', 'キャベツ']
  const down = selectPantryDowngrades(items, ingredients)
  const byId = new Map(down.map((d) => [d.id, d.level]))
  eq('在庫反映: 豚バラ肉 ある→少ない', byId.get(1), 'low')
  eq('在庫反映: 玉ねぎ 少ない→ない', byId.get(2), 'none')
  eq('在庫反映: しょうゆ(調味料)は対象外', byId.has(3), false)
  eq('在庫反映: 使っていないにんじんは変化なし', byId.has(4), false)
  eq('在庫反映: 既にない食材は据え置き(変更リストに出ない)', byId.has(5), false)
  eq('在庫反映: 変化するのは2件だけ', down.length, 2)
  // 材料が空なら何も下げない
  eq('在庫反映: 材料が空なら0件', selectPantryDowngrades(items, []).length, 0)
}

// ---------- selectPantryDowngrades: 名寄せの誤爆と不発(2026-07-29 便CC/C3。QA S2) ----------
{
  const down = (chipName, ingredientNames) =>
    selectPantryDowngrades([{ id: 1, name: chipName, level: 'have', isFrequent: true }], ingredientNames)
      .length > 0

  // 誤爆側: 部分一致をやめたので別食材で減らない
  eq('在庫反映(誤爆): 「ねぎ」チップは玉ねぎで減らない', down('ねぎ', ['玉ねぎ']), false)
  eq('在庫反映(誤爆): 「豆腐」チップは高野豆腐で減らない', down('豆腐', ['高野豆腐']), false)
  eq('在庫反映(総称): 「豆腐」チップは絹ごし豆腐で減る', down('豆腐', ['絹ごし豆腐']), true)
  eq('在庫反映(誤爆): 「卵」チップは「砂糖（卵用）」で減らない', down('卵', ['砂糖（卵用）']), false)
  eq('在庫反映(誤爆): 「米」チップは米酢で減らない', down('米', ['米酢']), false)
  eq('在庫反映(誤爆): 「ごま」チップはごま油で減らない', down('ごま', ['ごま油']), false)
  // 不発側: 括弧付きの材料名でも同じ食材として減る
  eq('在庫反映: 「長ねぎ」チップは「長ねぎ（白い部分）」で減る', down('長ねぎ', ['長ねぎ（白い部分）']), true)
  eq('在庫反映: 同名はこれまでどおり減る', down('玉ねぎ', ['玉ねぎ']), true)
  // 不発側: プリセットの総称チップ(豚肉・鶏肉)が部位名の材料で減る
  eq('在庫反映(総称): 「豚肉」チップは豚こま切れ肉で減る', down('豚肉', ['豚こま切れ肉']), true)
  eq('在庫反映(総称): 「鶏肉」チップは鶏もも肉で減る', down('鶏肉', ['鶏もも肉']), true)
  eq('在庫反映(総称): 「牛肉」チップは牛こま切れ肉で減る', down('牛肉', ['牛こま切れ肉']), true)
  // 総称チップの巻き添え防止: 調味料や別の肉では減らない
  eq('在庫反映(総称): 「鶏肉」チップは鶏がらスープの素で減らない', down('鶏肉', ['鶏がらスープの素']), false)
  eq('在庫反映(総称): 「豚肉」チップは鶏もも肉で減らない', down('豚肉', ['鶏もも肉']), false)
}

// ---------- categorizePantryName: かな書きの総称語(2026-07-29 便CC/C4。QA S3の「とりにく」) ----------
{
  eq('在庫グループ: かな「とりにく」→肉・魚介', categorizePantryName('とりにく'), 'meatFish')
  eq('在庫グループ: かな「ぶたにく」→肉・魚介', categorizePantryName('ぶたにく'), 'meatFish')
  eq('在庫グループ: かな「ぎゅうにく」→肉・魚介', categorizePantryName('ぎゅうにく'), 'meatFish')
  // 「にく」の部分一致に寄せていないこと(にんにくが肉売り場に行かない)
  eq('在庫グループ: 「にんにく」は肉・魚介にしない', categorizePantryName('にんにく') !== 'meatFish', true)
}

// ---------- 便CT/C15: 買い物メモの売り場順カスタム(2026-08-02 オーナー承認) ----------
{
  // 未設定(既存ユーザー)は従来どおりの既定順のまま
  eq('CT-AISLE 未設定は既定順', normalizeAisleOrder(undefined), [
    'vegetable',
    'meatFish',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 空配列も既定順', normalizeAisleOrder([]), [...SHOPPING_AISLE_ORDER])
  // 保存した並びはそのまま使う
  eq(
    'CT-AISLE 保存した並びをそのまま使う',
    normalizeAisleOrder(['seasoning', 'other', 'staple', 'soyEgg', 'meatFish', 'vegetable']),
    ['seasoning', 'other', 'staple', 'soyEgg', 'meatFish', 'vegetable'],
  )
  // 欠けているグループは既定順で末尾に補う(グループが増えても買い物メモから消えない)
  eq('CT-AISLE 欠けたグループは末尾に補う', normalizeAisleOrder(['seasoning', 'vegetable']), [
    'seasoning',
    'vegetable',
    'meatFish',
    'soyEgg',
    'staple',
    'other',
  ])
  // 壊れた保存値(未知のキー・重複)は黙って捨て、必ず6グループ揃った並びにする
  eq(
    'CT-AISLE 未知のキーは捨てる',
    normalizeAisleOrder(['sweets', 'seasoning', 'vegetable']),
    ['seasoning', 'vegetable', 'meatFish', 'soyEgg', 'staple', 'other'],
  )
  eq(
    'CT-AISLE 重複は最初の1つだけ残す',
    normalizeAisleOrder(['seasoning', 'seasoning', 'vegetable']),
    ['seasoning', 'vegetable', 'meatFish', 'soyEgg', 'staple', 'other'],
  )
  eq('CT-AISLE 常に6グループ揃う', normalizeAisleOrder(['other']).length, 6)

  // 上下移動(隣同士の入れ替え方式)
  eq('CT-AISLE 下へ移動', moveAisleGroup(SHOPPING_AISLE_ORDER, 0, 1), [
    'meatFish',
    'vegetable',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 上へ移動', moveAisleGroup(SHOPPING_AISLE_ORDER, 1, -1), [
    'meatFish',
    'vegetable',
    'soyEgg',
    'staple',
    'seasoning',
    'other',
  ])
  eq('CT-AISLE 先頭を上へ押しても変わらない', moveAisleGroup(SHOPPING_AISLE_ORDER, 0, -1), [
    ...SHOPPING_AISLE_ORDER,
  ])
  eq('CT-AISLE 末尾を下へ押しても変わらない', moveAisleGroup(SHOPPING_AISLE_ORDER, 5, 1), [
    ...SHOPPING_AISLE_ORDER,
  ])
  eq('CT-AISLE 元の配列は書き換えない', SHOPPING_AISLE_ORDER[0], 'vegetable')

  eq('CT-AISLE 未設定は既定扱い', isDefaultAisleOrder(undefined), true)
  eq('CT-AISLE 既定と同じ並びは既定扱い', isDefaultAisleOrder([...SHOPPING_AISLE_ORDER]), true)
  eq(
    'CT-AISLE 入れ替えたら既定ではない',
    isDefaultAisleOrder(moveAisleGroup(SHOPPING_AISLE_ORDER, 0, 1)),
    false,
  )

  // 買い物メモの整列に即反映される(表示専用の並べ替え・同グループ内は追加順を保つ)
  const memo = [
    { name: 'しょうゆ' },
    { name: '玉ねぎ' },
    { name: '豚こま切れ肉' },
    { name: 'にんじん' },
  ]
  eq(
    'CT-AISLE 既定順では野菜→肉→調味料',
    sortShoppingByAisle(memo).map((i) => i.name),
    ['玉ねぎ', 'にんじん', '豚こま切れ肉', 'しょうゆ'],
  )
  eq(
    'CT-AISLE 調味料を先頭にした並びが整列に反映される',
    sortShoppingByAisle(memo, ['seasoning', 'meatFish', 'vegetable', 'soyEgg', 'staple', 'other']).map(
      (i) => i.name,
    ),
    ['しょうゆ', '豚こま切れ肉', '玉ねぎ', 'にんじん'],
  )
  eq(
    'CT-AISLE 欠けた保存値でも整列できる(補完した既定順で並ぶ)',
    sortShoppingByAisle(memo, ['seasoning']).map((i) => i.name),
    ['しょうゆ', '玉ねぎ', 'にんじん', '豚こま切れ肉'],
  )
  eq(
    'CT-AISLE 同じグループ内は元の追加順を保つ',
    sortShoppingByAisle([{ name: 'にんじん' }, { name: '玉ねぎ' }]).map((i) => i.name),
    ['にんじん', '玉ねぎ'],
  )
}

// ---------- 便EA: 買い物リストの範囲えらび(オーナー要望「3日分とか」) ----------
// オーナー原文「選択した日付や時間帯レシピから買い物リスト作成したい。3日分とか、
// １週間分まとめて買い物とは限らない」。
// 既定(絞っていない=null)は表示中の週ぜんぶ＝従来と1品も変わらないことを最優先で固定する。
{
  const week = ['2026-08-08', '2026-08-09', '2026-08-10', '2026-08-11']
  const entries = [
    { date: '2026-08-08', slot: 'breakfast', recipeId: 1 },
    { date: '2026-08-08', slot: 'dinner', recipeId: 2 },
    { date: '2026-08-09', slot: 'lunch', recipeId: 3 },
    { date: '2026-08-09', slot: 'dinner', recipeId: 4 },
    { date: '2026-08-10', slot: 'dinner', recipeId: 5 },
    { date: '2026-08-11', slot: 'breakfast', recipeId: 6 },
  ]
  const all = ['breakfast', 'lunch', 'dinner']
  const ids = (rows) => rows.map((r) => r.recipeId)

  // --- 既定(絞っていない): 表示している食事の枠が全部そのまま入る ---
  eq(
    'EA-RANGE 既定(range無し)は表示中の週ぜんぶ',
    ids(filterShoppingEntries(entries, all)),
    [1, 2, 3, 4, 5, 6],
  )
  eq(
    'EA-RANGE 既定(dates/slotsともnull)も表示中の週ぜんぶ',
    ids(filterShoppingEntries(entries, all, { dates: null, slots: null })),
    [1, 2, 3, 4, 5, 6],
  )
  // 表示していない食事は、絞る前から対象外(従来どおり)
  eq(
    'EA-RANGE 表示していない食事は元から入らない',
    ids(filterShoppingEntries(entries, ['dinner'])),
    [2, 4, 5],
  )

  // --- 日付だけで絞る(オーナーの「3日分とか」) ---
  eq(
    'EA-RANGE 選んだ日付だけが集計される',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-09', '2026-08-10'] })),
    [3, 4, 5],
  )
  eq(
    'EA-RANGE 選んでいない日は1品も入らない',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-11'] })),
    [6],
  )

  // --- 食事だけで絞る(時間帯) ---
  eq(
    'EA-RANGE 選んだ食事だけが集計される',
    ids(filterShoppingEntries(entries, all, { slots: ['dinner'] })),
    [2, 4, 5],
  )

  // --- 日付と食事の両方で絞る(かけ算で効く) ---
  eq(
    'EA-RANGE 日付と食事の両方で絞ると、その交わりだけが集計される',
    ids(
      filterShoppingEntries(entries, all, {
        dates: ['2026-08-08', '2026-08-09'],
        slots: ['dinner'],
      }),
    ),
    [2, 4],
  )
  eq(
    'EA-RANGE 選んだ範囲に献立が無ければ0件',
    ids(filterShoppingEntries(entries, all, { dates: ['2026-08-10'], slots: ['breakfast'] })),
    [],
  )
  // 表示していない食事は、範囲で選んでも入らない(表示の設定が優先)
  eq(
    'EA-RANGE 表示していない食事は範囲で選んでも入らない',
    ids(filterShoppingEntries(entries, ['dinner'], { slots: ['breakfast', 'dinner'] })),
    [2, 4, 5],
  )

  // --- 「今日の献立」(食事の情報が無いリスト)を足すかの判定 ---
  eq('EA-RANGE 既定では「今日の献立」も足す', shoppingRangeIncludesTodayList('2026-08-08'), true)
  eq(
    'EA-RANGE 今日を含む日付を選んだら「今日の献立」も足す',
    shoppingRangeIncludesTodayList('2026-08-08', { dates: ['2026-08-08', '2026-08-09'] }),
    true,
  )
  eq(
    'EA-RANGE 今日を外したら「今日の献立」は足さない',
    shoppingRangeIncludesTodayList('2026-08-08', { dates: ['2026-08-09'] }),
    false,
  )
  eq(
    'EA-RANGE 食事で絞ったら「今日の献立」は足さない(食事の情報が無く多く買わせるため)',
    shoppingRangeIncludesTodayList('2026-08-08', { slots: ['dinner'] }),
    false,
  )

  // --- 「絞っているか」の判定(全部選び直した状態は絞っていない扱い) ---
  eq('EA-RANGE 未選択は絞っていない', isShoppingRangeNarrowed(undefined, week, all), false)
  eq(
    'EA-RANGE 全部選び直した状態は絞っていない扱い',
    isShoppingRangeNarrowed({ dates: [...week], slots: [...all] }, week, all),
    false,
  )
  eq(
    'EA-RANGE 1日でも外れていれば絞っている',
    isShoppingRangeNarrowed({ dates: week.slice(0, 3) }, week, all),
    true,
  )
  eq(
    'EA-RANGE 食事が1つでも外れていれば絞っている',
    isShoppingRangeNarrowed({ slots: ['dinner'] }, week, all),
    true,
  )

  // --- 範囲の言い表し(買い物メモの下書きに出す1行) ---
  eq('EA-RANGE 日付が連続していれば「8/8〜8/11」', formatShoppingRangeDates(week), '8/8〜8/11')
  eq('EA-RANGE 1日だけなら「8/9」', formatShoppingRangeDates(['2026-08-09']), '8/9')
  eq(
    'EA-RANGE 飛んでいれば「・」で並べる',
    formatShoppingRangeDates(['2026-08-08', '2026-08-10']),
    '8/8・8/10',
  )
  eq('EA-RANGE 月をまたいでも連続なら範囲表記', formatShoppingRangeDates(['2026-08-31', '2026-09-01']), '8/31〜9/1')
  eq('EA-RANGE 日付が0件なら空文字(行を出さない)', formatShoppingRangeDates([]), '')
  eq(
    'EA-RANGE 範囲の1行に日付と食事が入る',
    formatShoppingRangeLabel({
      dates: ['2026-08-08', '2026-08-09'],
      slots: ['dinner'],
      includesTodayList: false,
    }),
    '献立の8/8〜8/9・夕食から作りました',
  )
  eq(
    'EA-RANGE 「今日の献立」を足したときは、その旨も書く',
    formatShoppingRangeLabel({
      dates: ['2026-08-08'],
      slots: ['breakfast', 'lunch', 'dinner'],
      includesTodayList: true,
    }),
    '献立の8/8・朝食・昼食・夕食から作りました（「今日の献立」の分も入れています）',
  )
  eq(
    'EA-RANGE 対象の日が0件なら範囲の行は出さない',
    formatShoppingRangeLabel({ dates: [], slots: ['dinner'], includesTodayList: false }),
    '',
  )
}

