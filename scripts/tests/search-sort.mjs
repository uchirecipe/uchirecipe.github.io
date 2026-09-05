// 検索・絞り込み・並び替え（かな・タグ・一覧カードの見え方）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, neq, scriptFileUrl } from './_harness.mjs'
import {
  buildSearchWords,
  toHiragana,
  toTagKey,
  titleKanaKey,
  searchIndexNeedsRebuild,
  SEARCH_INDEX_VERSION,
  dishTypeSearchWord,
} from '../../src/logic/kana.ts'
import { READINGS_VERSION } from '../../src/logic/ingredientReadings.ts'
import { NUTRITION_DISPLAY_KEYS, nutritionLabelFor } from '../../src/logic/nutrition.ts'
import {
  sortResults,
  lastCookedDate,
  defaultSortDirection,
  buildNutrientSortValues,
  isNutrientSortOption,
  isFreeSortOption,
  NUTRIENT_SORT_OPTIONS,
  FREE_NUTRIENT_SORT_OPTIONS,
  PRO_NUTRIENT_SORT_OPTIONS,
  NUTRIENT_SORT_LABELS,
  NUTRIENT_SORT_FIELD,
} from '../../src/logic/recipeSort.ts'
import {
  pickMainIngredients,
  normalizeIngredientChipLabel,
  pickDisplayIngredientChips,
} from '../../src/logic/mainIngredients.ts'
import {
  searchRecipes,
  topTagsByUsage,
  tagUsageCounts,
  searchMatchReasons,
  searchMatchRowText,
  splitTerms,
  defaultSearchOptions,
} from '../../src/logic/search.ts'
import { ingredientColorToken } from '../../src/logic/ingredientColor.ts'
import { starterDefs } from '../../src/db/starters.ts'
import { ja } from '../../src/i18n/ja.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'

// ---------- buildSearchWords(「鮭」検索が調味料「酒」に誤ヒットする回帰・2026-07-09ペルソナ第1波) ----------
{
  // さばの味噌煮の実データ相当(酒50ml=単位付きでも、鮭(さけ)で引っかからないこと)
  const words = buildSearchWords(
    'さばの味噌煮',
    [
      { name: 'さば(切り身)', amount: '2', unit: '切れ' },
      { name: 'しょうが', amount: '1', unit: 'かけ' },
      { name: '味噌', amount: '2', unit: '大さじ' },
      { name: '酒', amount: '50', unit: 'ml' },
    ],
    ['和食', '魚'],
  )
  const salmonKey = toHiragana('鮭')
  eq('鮭検索が調味料の酒にヒットしない', words.some((w) => w.includes(salmonKey)), false)
  eq('タイトルの味噌は引き続きヒット', words.some((w) => w.includes(toHiragana('味噌'))), true)
  eq('タグ(魚)は引き続きヒット', words.some((w) => w.includes(toHiragana('魚'))), true)
  eq('主材料(さば)は引き続きヒット', words.some((w) => w.includes('さば')), true)
  // 調味料(大さじ)の酒も検索語に含めない
  const words2 = buildSearchWords(
    '豚の生姜焼き',
    [
      { name: '豚ロース薄切り', amount: '250', unit: 'g' },
      { name: '酒', amount: '1', unit: '大さじ' },
    ],
    ['和食'],
  )
  eq('大さじの酒も検索語から除外', words2.some((w) => w.includes(salmonKey)), false)
  eq('主材料(豚)は引き続きヒット', words2.some((w) => w.includes(toHiragana('豚'))), true)
}

// ---------- buildSearchWords: きのこカテゴリ語の追加(検索欄で「しめじ」「えのき」等でも
// 「きのこ」でも同じレシピにヒットしてほしい・2026-07-12オーナー実機フィードバック) ----------
{
  const mushroomKey = toHiragana('きのこ')
  const shimeji = buildSearchWords(
    'きのこの味噌汁',
    [{ name: 'しめじ', amount: '1', unit: 'パック' }],
    [],
  )
  eq('しめじで検索語「きのこ」が追加される', shimeji.some((w) => w.includes(mushroomKey)), true)

  const enoki = buildSearchWords('えのきのバター炒め', [{ name: 'えのき', amount: '1', unit: '袋' }], [])
  eq('えのきで検索語「きのこ」が追加される', enoki.some((w) => w.includes(mushroomKey)), true)

  // 漢字表記(椎茸・舞茸)でもカテゴリ語が追加されること(toHiragana変換後の一致確認)
  const shiitake = buildSearchWords('椎茸の炊き込みご飯', [{ name: '椎茸', amount: '4', unit: '枚' }], [])
  eq('椎茸(漢字)でも検索語「きのこ」が追加される', shiitake.some((w) => w.includes(mushroomKey)), true)

  // きのこ類を含まないレシピには追加されない(誤爆しないこと)
  const noMushroom = buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], [])
  eq('きのこを含まないレシピには「きのこ」が追加されない', noMushroom.some((w) => w.includes(mushroomKey)), false)
}

// ---------- buildSearchWords: keywords(検索キーワード欄・任意)がタイトル/材料/タグに
// 無い語でも検索にヒットするよう合流する(2026-07-12バッチ「検索キーワード欄」実装) ----------
{
  const aliasKey = toHiragana('チンジャオロース')
  const withKeyword = buildSearchWords(
    '青椒肉絲',
    [{ name: '豚肉', amount: '150', unit: 'g' }],
    ['中華'],
    ['チンジャオロース'],
  )
  eq(
    'keywordsの語がひらがな化されて検索語に合流する',
    withKeyword.some((w) => w.includes(aliasKey)),
    true,
  )
  // keywords省略(3引数呼び出し)でも従来どおり動く(既存呼び出し元・starters.ts等との後方互換)
  const withoutKeyword = buildSearchWords(
    '青椒肉絲',
    [{ name: '豚肉', amount: '150', unit: 'g' }],
    ['中華'],
  )
  eq(
    'keywords省略時はその語を含まない(既存データ=変化なしの確認)',
    withoutKeyword.some((w) => w.includes(aliasKey)),
    false,
  )
  // 空文字・空白だけのkeywordsはノイズを増やさない(trimして空になる語は無視)
  const baseline = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
  )
  const emptyKeyword = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    ['', '  '],
  )
  eq('空文字・空白だけのkeywordsは検索語を増やさない', emptyKeyword.length, baseline.length)

  // --- 便FS-6(2026-08-12 利用者テスト): 「電子レンジ」で検索すると0件、「レンジ」なら4件。
  // 手順に「電子レンジ(600W)」と書いてあるのに引けなかった ---
  const hits = (words, query) => words.some((w) => w.includes(toHiragana(query)))
  const renji = buildSearchWords(
    '蒸しなすの香味だれ',
    [{ name: 'なす', amount: '3', unit: '本' }],
    [],
    undefined,
    [{ text: 'なすはラップで包み、電子レンジ(600W)で5分加熱する。' }],
  )
  eq('FS-SEARCH 手順の「電子レンジ」で引ける', hits(renji, '電子レンジ'), true)
  eq('FS-SEARCH 「レンジ」でも引ける（従来の引き方を狭めない）', hits(renji, 'レンジ'), true)
  // 手順本文をまるごと入れない＝台所のどこにでもある道具や、手順の常套句では引かない
  eq('FS-SEARCH 手順の「ラップ」では引かない（手順本文は検索対象にしない）', hits(renji, 'ラップ'), false)
  eq('FS-SEARCH 手順の「加熱」では引かない', hits(renji, '加熱'), false)
  const nabe = buildSearchWords(
    '肉じゃが',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    undefined,
    [{ text: '鍋に油を熱し、フライパンは使わず中火で炒める。' }],
  )
  eq('FS-SEARCH 「フライパン」は器具の一覧に入れない（全体の4割に当たるため）', hits(nabe, 'ふらいぱん'), false)
  // メモは対象外（「温め直しは電子レンジで」はレンジ料理を意味しない）
  const memoOnly = buildSearchWords(
    'ポテトサラダ',
    [{ name: 'じゃがいも', amount: '3', unit: '個' }],
    [],
    undefined,
    [{ text: 'じゃがいもをゆでてつぶす。', memo: '温め直すときは電子レンジで' }],
  )
  eq('FS-SEARCH ひとことメモの器具では引かない', hits(memoOnly, '電子レンジ'), false)
  eq(
    'FS-SEARCH 手順を渡さない呼び出しはこれまでと同じ結果',
    buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], []).length,
    baseline.length,
  )
  eq(
    'FS-SEARCH 手順に器具が出てこなければ検索語は増えない',
    buildSearchWords('肉じゃが', [{ name: 'じゃがいも', amount: '3', unit: '個' }], [], undefined, [
      { text: '鍋で煮る。' },
    ]).length,
    baseline.length,
  )
}

// ---------- toTagKey(タグ候補のかな検索。2026-07-28 便BW・QA S3) ----------
// 実機QA: 既存タグに「夏」「作り置き」があるのに「なつ」「つく」と打っても候補が出なかった
// (読み仮名辞書は食材名だけで、タグ語の読みを持っていなかった)
{
  const suggest = (query, existing) =>
    existing.filter((t) => t !== query && toTagKey(t).includes(toTagKey(query)))
  const existingTags = ['夏', '作り置き', '和食', 'サラダ', '子ども']
  eq('タグ候補: 「なつ」→夏', suggest('なつ', existingTags), ['夏'])
  eq('タグ候補: 「つく」→作り置き', suggest('つく', existingTags), ['作り置き'])
  eq('タグ候補: 「わ」→和食', suggest('わ', existingTags), ['和食'])
  eq('タグ候補: 半角カナ「ｻﾗﾀﾞ」→サラダ(既存の挙動を維持)', suggest('ｻﾗﾀﾞ', existingTags), ['サラダ'])
  eq('タグ候補: 「こども」→子ども', suggest('こども', existingTags), ['子ども'])
  eq('タグ読み: 夏', toTagKey('夏'), 'なつ')
  eq('タグ読み: 作り置き', toTagKey('作り置き'), 'つくりおき')
  eq('タグ読み: 辞書にない語はそのまま', toTagKey('ぬか床'), 'ぬか床')
}

// ---------- searchIndexNeedsRebuild: 検索インデックス移行の判定(既存レシピのsearchWordsに
// きのこカテゴリ語等を反映させる一回きりの移行。2026-07-12) ----------
{
  const upToDate = { ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: SEARCH_INDEX_VERSION }
  eq('両方最新なら再構築不要', searchIndexNeedsRebuild(upToDate), false)
  eq('searchIndexVersionだけ古ければ再構築が必要', searchIndexNeedsRebuild({ ...upToDate, searchIndexVersion: 0 }), true)
  eq(
    'ingredientReadingsVersionだけ古くても再構築が必要',
    searchIndexNeedsRebuild({ ...upToDate, ingredientReadingsVersion: 0 }),
    true,
  )
  eq('未導入ユーザー(両方0)は再構築が必要', searchIndexNeedsRebuild({ ingredientReadingsVersion: 0, searchIndexVersion: 0 }), true)
}

// ---------- 栄養並び替え(2026-07-13 Fable設計: カロリー/たんぱく質(1食)。
// 2026-07-16 便T-4で塩分・脂質・糖質を追加しPro機能化。算出不能は常に末尾) ----------
{
  const mkRecipe = (id, title, ingredients, updatedAt) => ({
    id,
    title,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients,
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: updatedAt,
    updatedAt,
  })
  // 砂糖100g / 砂糖10g / 名寄せできない材料のみ(自作レシピ相当) の3件
  const rHigh = mkRecipe(1, '高カロリー', [{ name: '砂糖', amount: '100', unit: 'g' }], 100)
  const rLow = mkRecipe(2, '低カロリー', [{ name: '砂糖', amount: '10', unit: 'g' }], 200)
  const rUnknown = mkRecipe(3, '算出不能', [{ name: '謎のたべもの', amount: '適量', unit: '' }], 300)
  const values = buildNutrientSortValues([rHigh, rLow, rUnknown])
  eq(
    // 2026-08-19 便HU・⑯: 顔ぶれが増えても書き写しが古くならないよう、
    // 「顔ぶれの全項目がnull」という規則で見る
    '栄養並び替え値: 名寄せできないレシピは顔ぶれの全項目がnull(算出不能)',
    NUTRITION_DISPLAY_KEYS.length > 0 &&
      NUTRITION_DISPLAY_KEYS.every((key) => values.get(3)[key] === null),
    true,
  )
  const results = [rUnknown, rHigh, rLow].map((recipe) => ({
    recipe,
    usedCount: 0,
    wantedCount: 0,
  }))
  eq(
    'カロリー昇順: 低→高で、算出不能は末尾',
    sortResults(results, 'kcal', [], 'asc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq(
    'カロリー降順: 高→低でも算出不能は末尾のまま',
    sortResults(results, 'kcal', [], 'desc', values).map((r) => r.recipe.id),
    [1, 2, 3],
  )
  eq(
    'たんぱく質降順: 同値(砂糖はたんぱく質ほぼ0)なら更新順(新しい順)で安定し、算出不能は末尾',
    sortResults(results, 'protein', [], 'desc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq(
    '糖質昇順: 砂糖10g<100gなので低→高、算出不能は末尾(便T-4で追加)',
    sortResults(results, 'carb', [], 'asc', values).map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq('カロリーの既定方向は昇順(低い方から)', defaultSortDirection.kcal, 'asc')
  eq('たんぱく質の既定方向は降順(多い方から)', defaultSortDirection.protein, 'desc')
  eq('糖質の既定方向は昇順(便T-4)', defaultSortDirection.carb, 'asc')
  eq('塩分の既定方向は昇順(便T-4)', defaultSortDirection.salt, 'asc')
  eq('脂質の既定方向は昇順(便T-4)', defaultSortDirection.fat, 'asc')

  // 塩(saltG高) / サラダ油(fatGのみ高)で塩分・脂質のsortResultsも検算する(便T-4)
  const rSalty = mkRecipe(4, 'しょっぱい', [{ name: '塩', amount: '100', unit: 'g' }], 400)
  const rMild = mkRecipe(5, 'うすあじ', [{ name: '塩', amount: '10', unit: 'g' }], 500)
  const rOily = mkRecipe(6, 'あぶらっこい', [{ name: 'サラダ油', amount: '100', unit: 'g' }], 600)
  const rLight = mkRecipe(7, 'あっさり', [{ name: 'サラダ油', amount: '10', unit: 'g' }], 700)
  const saltFatValues = buildNutrientSortValues([rSalty, rMild, rOily, rLight])
  const saltResults = [rMild, rSalty].map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
  eq(
    '塩分昇順: 塩10g<100gなので低→高(便T-4で追加)',
    sortResults(saltResults, 'salt', [], 'asc', saltFatValues).map((r) => r.recipe.id),
    [5, 4],
  )
  const fatResults = [rLight, rOily].map((recipe) => ({ recipe, usedCount: 0, wantedCount: 0 }))
  eq(
    '脂質昇順: サラダ油10g<100gなので低→高(便T-4で追加)',
    sortResults(fatResults, 'fat', [], 'asc', saltFatValues).map((r) => r.recipe.id),
    [7, 6],
  )

  eq('isNutrientSortOption: kcalは栄養並び替え', isNutrientSortOption('kcal'), true)
  eq('isNutrientSortOption: updatedは栄養並び替えでない', isNutrientSortOption('updated'), false)

  // ---- ⑯ 並び替えの顔ぶれ＝栄養表示の顔ぶれ(2026-08-19 便HU・オーナー
  // 「ラインナップをいつもの栄養価にして。糖質は炭水化物？鉄も入ってない」) ----
  // 顔ぶれを書き写して並べると、項目が増えたときに書き写しの方が古くなって当たらなくなる。
  // ここでは「栄養表示に出している項目の集合」と「並び替えで選べる項目の集合」が
  // 一致することだけを規則で見る(項目が増えても自動で見張りの対象に入る)。
  {
    const sortFields = NUTRIENT_SORT_OPTIONS.map((option) => NUTRIENT_SORT_FIELD[option])
    // 集合が空のまま「一致した」と合格に倒れないよう、先に数え上げが効いていることを確かめる
    eq(
      '⑯ 顔ぶれの照合が空振りしていない(並び替え・表示とも項目がある)',
      sortFields.length > 0 && NUTRITION_DISPLAY_KEYS.length > 0,
      true,
    )
    eq('⑯ 並び替えの顔ぶれに同じ項目が2回出ていない', sortFields.length, new Set(sortFields).size)
    eq(
      '⑯ 並び替えで選べる栄養の顔ぶれが栄養表示の顔ぶれと同じ',
      [...sortFields].sort(),
      [...NUTRITION_DISPLAY_KEYS].sort(),
    )
    // 名前も表示と同じにする(「糖質」と書いてあるのに中身は炭水化物=CHOCDF-、を二度と作らない)
    const labelMismatch = NUTRIENT_SORT_OPTIONS.filter(
      (option) => NUTRIENT_SORT_LABELS[option] !== nutritionLabelFor(NUTRIENT_SORT_FIELD[option]),
    ).map(
      (option) =>
        `${option}: 並び替え「${NUTRIENT_SORT_LABELS[option]}」/ 栄養表示「${nutritionLabelFor(NUTRIENT_SORT_FIELD[option])}」`,
    )
    eq('⑯ 並び替えの項目名が栄養表示の項目名と一致する', labelMismatch, [])
  }

  // 2026-08-01 線引きB'(オーナー確定): 栄養並び替えのうちカロリー(エネルギー)順だけを無料に開放し、
  // 残りはPro維持。並べ替えの計算自体は無料/Proで同じ。
  // 2026-08-19 便HU: 顔ぶれが5→8項目に増えたので、Pro側は「顔ぶれからエネルギーを引いた残り」
  // という規則で見る(顔ぶれが増えても無料側が勝手に増えない、という線引きの見張りになる)
  eq('FREE_NUTRIENT_SORT_OPTIONS: 無料はエネルギー順のみ', [...FREE_NUTRIENT_SORT_OPTIONS], ['kcal'])
  eq(
    "PRO_NUTRIENT_SORT_OPTIONS: 顔ぶれからエネルギーを引いた残り全部がPro(線引きB')",
    [...PRO_NUTRIENT_SORT_OPTIONS],
    NUTRIENT_SORT_OPTIONS.filter((option) => option !== 'kcal'),
  )
  eq('isFreeSortOption: カロリー順は無料で使える', isFreeSortOption('kcal'), true)
  eq('isFreeSortOption: 塩分順はPro', isFreeSortOption('salt'), false)
  eq('isFreeSortOption: たんぱく質順はPro', isFreeSortOption('protein'), false)
  eq('isFreeSortOption: 栄養以外(更新順)は無料', isFreeSortOption('updated'), true)
  // 無料に開放したのはUIの選択肢だけで、並べ替えの計算(sortResults)には解錠状態が入らない。
  // 上のカロリー昇順・塩分昇順の期待値がそのまま通っていることがその見張りになっている
}

// ---------- 「最近作った順」(2026-08-03 オーナー指示・便DI-7) ----------
// 「作った！」の記録の最新日付で並べる。記録が1件も無いレシピは昇順/降順に関わらず末尾。
// 記録は追加した順に入っていて日付順とは限らないので、必ず最大値を取ること(再発防止)
{
  const mkCooked = (id, title, dates, updatedAt) => ({
    id,
    title,
    servings: 2,
    effortLevel: 'normal',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: dates.map((date) => ({ date })),
    searchWords: [],
    createdAt: updatedAt,
    updatedAt,
  })
  // 記録の並びをわざと日付順にしない(2件目の方が古い)
  const rNew = mkCooked(1, 'きのう作った', ['2026-07-01', '2026-08-02'], 100)
  const rOld = mkCooked(2, '先月作った', ['2026-07-05'], 200)
  const rNever = mkCooked(3, '作ったことがない', [], 300)
  eq('最近作った順: 記録の最新日付を拾う(追加順が日付順でなくても)', lastCookedDate(rNew), '2026-08-02')
  eq('最近作った順: 記録が1件なら その日付', lastCookedDate(rOld), '2026-07-05')
  eq('最近作った順: 記録なしはnull', lastCookedDate(rNever), null)
  const cookedResults = [rOld, rNever, rNew].map((recipe) => ({
    recipe,
    usedCount: 0,
    wantedCount: 0,
  }))
  eq(
    '最近作った順(既定=降順): 新しい順に並び、記録なしは末尾',
    sortResults(cookedResults, 'recentCooked', []).map((r) => r.recipe.id),
    [1, 2, 3],
  )
  eq(
    '最近作った順(昇順=しばらく作っていない順): 古い順でも記録なしは末尾のまま',
    sortResults(cookedResults, 'recentCooked', [], 'asc').map((r) => r.recipe.id),
    [2, 1, 3],
  )
  eq('最近作った順の既定方向は降順(新しい方から)', defaultSortDirection.recentCooked, 'desc')
  // 回数で数える「よく使う順」とは別物であること(記録2件のrNewが回数では先頭)
  eq(
    'よく使う順は回数順のまま(最近作った順の追加で壊れていない)',
    sortResults(cookedResults, 'cooked', []).map((r) => r.recipe.id),
    [1, 2, 3],
  )
}

// ---------- 「よく使うタグ」チップの使用頻度集計(2026-08-03 オーナー指示・便DI-4) ----------
// 従来は「作り置き」「お弁当」の直書き固定2択で、レシピを増やしても中身が変わらなかった。
// 使用件数の多い順・同数はタグ名の五十音順で安定すること
{
  const withTags = (tags) => ({ tags })
  const tagRecipes = [
    withTags(['作り置き', 'お弁当']),
    withTags(['作り置き']),
    withTags(['作り置き', '朝ごはん']),
    withTags(['お弁当']),
    withTags(['朝ごはん']),
    withTags([]),
  ]
  eq('よく使うタグ: 使用件数の多い順', topTagsByUsage(tagRecipes, 3), ['作り置き', 'お弁当', '朝ごはん'])
  eq('よく使うタグ: limitで打ち切る', topTagsByUsage(tagRecipes, 1), ['作り置き'])
  eq('よく使うタグ: タグが無ければ空', topTagsByUsage([withTags([]), withTags([])], 6), [])
  eq('よく使うタグ: limit0は空', topTagsByUsage(tagRecipes, 0), [])
  eq(
    'よく使うタグ: 同じレシピ内の重複タグは1件と数える',
    topTagsByUsage([withTags(['朝ごはん', '朝ごはん']), withTags(['お弁当']), withTags(['お弁当'])], 1),
    ['お弁当'],
  )
  eq(
    'よく使うタグ: 同数なら五十音順で安定する(開くたびに入れ替わらない)',
    topTagsByUsage([withTags(['たまご', 'あさごはん', 'さかな'])], 3),
    ['あさごはん', 'さかな', 'たまご'],
  )
  eq('よく使うタグ: 空白だけのタグは数えない', topTagsByUsage([withTags(['  ', 'お弁当'])], 6), ['お弁当'])
}

// ---------- 「基本レシピ順」並び替えは2026-07-24 便BN・タスク4で廃止(配布テーマ全廃で
// 区分が無意味化したため。RecipeSortOptionから'theme'ごと削除) ----------

// ---------- pickMainIngredients(一覧カードの主要食材=調味料・水・油・粉類・だし系・薬味少量
// の名前辞書で除外。UI改善バッチ 2026-07-11 オーナー実機フィードバック「メインをはる材料に絞って」) ----------
{
  // こんにゃくの炒り煮(review.jsonの実データ)相当: 赤唐辛子(1/2本)は数値化できてしまうため
  // 分量・単位ベースのisSeasoningLikeだけでは除外できない=名前辞書が必要なことの再発防止ケース
  const konnyaku = [
    { name: 'こんにゃく', amount: '1', unit: '枚' },
    { name: '赤唐辛子', amount: '1/2', unit: '本' },
    { name: 'ごま油', amount: '1', unit: '大さじ' },
    { name: 'しょうゆ', amount: '1.5', unit: '大さじ' },
    { name: 'みりん', amount: '1.5', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '大さじ' },
    { name: 'かつお節', amount: '1', unit: '袋' },
  ]
  eq(
    '主要食材: こんにゃくの炒り煮は赤唐辛子が出ない',
    pickMainIngredients(konnyaku).map((i) => i.name),
    ['こんにゃく'],
  )

  // 手作り鮭フレーク(review.jsonの実データ)相当: 主材料の鮭は残り、酒・塩(お好みで)は出ない
  const sakeFlake = [
    { name: '甘塩鮭（切り身）', amount: '2', unit: '切れ' },
    { name: '酒', amount: '1', unit: '大さじ' },
    { name: '塩', amount: '少々(お好みで)', unit: '' },
  ]
  eq(
    '主要食材: 鮭フレークは鮭の切り身が残る',
    pickMainIngredients(sakeFlake).map((i) => i.name),
    ['甘塩鮭（切り身）'],
  )

  // 「お好みで」は数値と同居していてもisSeasoningLikeの非数値判定をすり抜けるため、
  // 名前辞書に無い食材でも isOptionalAmount 単独で除外できることの確認
  const optional = [
    { name: '鶏むね肉', amount: '1', unit: '枚' },
    { name: 'くるみ', amount: '2(お好みで)', unit: '個' },
  ]
  eq(
    '主要食材: 数値付き「お好みで」も除外される',
    pickMainIngredients(optional).map((i) => i.name),
    ['鶏むね肉'],
  )

  // 先頭から最大3件(水増ししない・4件目以降は出ない)
  const many = [
    { name: 'じゃがいも', amount: '3', unit: '個' },
    { name: '玉ねぎ', amount: '1', unit: '個' },
    { name: '人参', amount: '1', unit: '本' },
    { name: '牛こま切れ肉', amount: '200', unit: 'g' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
  ]
  eq(
    '主要食材: 先頭から最大3件',
    pickMainIngredients(many).map((i) => i.name),
    ['じゃがいも', '玉ねぎ', '人参'],
  )
}

// ---------- normalizeIngredientChipLabel / pickDisplayIngredientChips(一覧カードの食材チップを
// スッキリさせる・2026-07-12オーナー実機フィードバック「生鮭、甘塩鮭は鮭に統一。括弧は付けない」) ----------
{
  eq('括弧書き(半角)を除去', normalizeIngredientChipLabel('さば(切り身)'), 'さば')
  eq('括弧書き(全角)を除去', normalizeIngredientChipLabel('甜麺醤（テンメンジャン）'), '甜麺醤')
  eq('括弧書き(倍率表記)を除去', normalizeIngredientChipLabel('めんつゆ(3倍濃縮)'), 'めんつゆ')
  eq('括弧が複数あってもすべて除去', normalizeIngredientChipLabel('甘塩鮭(または生鮭)(切り身)'), '鮭')
  eq('括弧が半角開き・全角閉じの混在でも除去', normalizeIngredientChipLabel('しょうが(すりおろし）'), 'しょうが')
  eq('括弧の無い名前はそのまま', normalizeIngredientChipLabel('鶏むね肉'), '鶏むね肉')
  eq('生鮭は鮭に統一', normalizeIngredientChipLabel('生鮭'), '鮭')
  eq('甘塩鮭は鮭に統一', normalizeIngredientChipLabel('甘塩鮭'), '鮭')
  eq('生鮭(切り身)も鮭に統一(括弧除去+別名統一の組み合わせ)', normalizeIngredientChipLabel('生鮭(切り身)'), '鮭')

  // 切り方の注記除去(2026-07-12オーナー実機フィードバック: チップ「豚バラ薄切り肉」→「豚バラ肉」)
  eq('薄切りを除去', normalizeIngredientChipLabel('豚バラ薄切り肉'), '豚バラ肉')
  eq('厚切りを除去', normalizeIngredientChipLabel('ベーコン厚切り'), 'ベーコン')
  eq(
    '薄切り除去後も色分け(ingredientColorToken)は肉カテゴリのまま',
    ingredientColorToken(normalizeIngredientChipLabel('豚バラ薄切り肉')),
    '--chip-food-meat',
  )

  // 同カード内で正規化後に重複したら1つにまとめる(生鮭と甘塩鮭が両方並んでも「鮭」チップは1つだけ)
  const twoSalmonKinds = [
    { name: '生鮭(切り身)', amount: '2', unit: '切れ' },
    { name: '甘塩鮭', amount: '1', unit: '切れ' },
    { name: 'じゃがいも', amount: '2', unit: '個' },
  ]
  eq(
    '重複ラベルは1チップにまとめる',
    pickDisplayIngredientChips(twoSalmonKinds).map((c) => c.name),
    ['鮭', 'じゃがいも'],
  )

  // 表示ラベルは正規化されても、色分け判定(ingredientColorToken)は従来どおり効く
  eq('正規化後の「鮭」も魚介カテゴリ', ingredientColorToken('鮭'), '--chip-food-seafood')
  eq('正規化後の「牛乳」は肉カテゴリに誤分類されない', ingredientColorToken(normalizeIngredientChipLabel('牛乳')), '--chip-neutral')
}

// ---------- searchRecipes: 「時短」絞り込み(quickStepsを持つレシピだけに絞る。
// UI改善バッチ 2026-07-11) ----------
{
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const recipes = [
    { id: 1, title: '通常のみ', tags: [], searchWords: [], ingredients: [], quickSteps: undefined },
    { id: 2, title: '時短あり', tags: [], searchWords: [], ingredients: [], quickSteps: [{ text: 'レンジで加熱する' }] },
  ]
  eq(
    '時短絞り込みOFFは全件',
    searchRecipes(recipes, baseOptions).map((r) => r.recipe.id),
    [1, 2],
  )
  eq(
    '時短絞り込みONはquickStepsありのみ',
    searchRecipes(recipes, { ...baseOptions, quickOnly: true }).map((r) => r.recipe.id),
    [2],
  )
}

// ---------- searchRecipes: 「在庫の食材で絞る」(在庫(ある/少ない)の食材を材料に含むレシピだけ・
// 2026-07-24 便BN・司令部追加。判定は在庫との一致順と同じ部分一致) ----------
{
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const recipes = [
    {
      id: 1,
      title: '玉ねぎ炒め',
      tags: [],
      searchWords: [],
      ingredients: [{ name: '玉ねぎ' }, { name: 'しょうゆ' }],
    },
    {
      id: 2,
      title: '豆腐サラダ',
      tags: [],
      searchWords: [],
      ingredients: [{ name: '絹ごし豆腐' }, { name: 'トマト' }],
    },
  ]
  eq(
    '在庫絞り込みOFFは全件',
    searchRecipes(recipes, baseOptions).map((r) => r.recipe.id),
    [1, 2],
  )
  eq(
    '在庫絞り込みON: 在庫「玉ねぎ」を使うレシピだけ残る',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: ['玉ねぎ'] }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
  eq(
    // 2026-07-29 便CC/C4: 判定は部分一致から「総称語→具体名」の表に置き換えたが、
    // 在庫「豆腐」で絹ごし豆腐のレシピが出るという意図はそのまま保つ
    '在庫絞り込みON: 総称の「豆腐」が「絹ごし豆腐」にヒットする(在庫一致順と同じ判定)',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: ['豆腐'] }).map(
      (r) => r.recipe.id,
    ),
    [2],
  )
  eq(
    '在庫絞り込みON: 在庫が空なら0件',
    searchRecipes(recipes, { ...baseOptions, pantryOnly: true, pantryNames: [] }).map(
      (r) => r.recipe.id,
    ),
    [],
  )
}

// ---------- ⑬ 料理の種別は複数選べる(2026-08-19 便HU・オーナー
// 「料理の種別については複数選択できても良いと思う」) ----------
// 1つも選んでいない＝絞らない。選んだ種別の**どれか**に当たるレシピが残る(和集合)。
{
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const mk = (id, title, dishType) => ({
    id,
    title,
    tags: [],
    searchWords: [],
    ingredients: [],
    dishType,
  })
  const recipes = [
    mk(1, '豚の生姜焼き', 'main'),
    mk(2, 'ほうれん草のおひたし', 'side'),
    mk(3, 'わかめのみそ汁', 'soup'),
    mk(4, '水ようかん', 'dessert'),
  ]
  const ids = (options) => searchRecipes(recipes, { ...baseOptions, ...options }).map((r) => r.recipe.id)
  // 掴めていないまま合格に倒れないよう、まず絞らないときに全品出ることを確かめる
  eq('⑬ 種別を1つも選んでいなければ全品出る', ids({}), [1, 2, 3, 4])
  eq('⑬ 空の配列も「絞らない」と同じ', ids({ dishTypes: [] }), [1, 2, 3, 4])
  eq('⑬ 1つ選べばその種別だけ', ids({ dishTypes: ['main'] }), [1])
  eq('⑬ 2つ選ぶとどちらかに当たる品が出る(和集合)', ids({ dishTypes: ['main', 'soup'] }), [1, 3])
  eq('⑬ 4区分すべてを選ぶと全品出る(区分は重ならず全部を覆う)', ids({ dishTypes: ['main', 'side', 'soup', 'dessert'] }), [1, 2, 3, 4])
}

// ---------- ⑮ 「高たんぱく」は絞り込みのタグ候補に出さない(2026-08-19 便HU・オーナー指示) ----------
// レシピに付いているタグそのものは消さない（データを失う方に倒さない）。
// 候補に出さないだけなので、タグを指定した絞り込み自体は従来どおり効く。
{
  const { filterTagUsageCounts, FILTER_HIDDEN_TAGS } = await import('../../src/logic/search.ts')
  const withTags = (id, tags) => ({ id, title: `品${id}`, tags, searchWords: [], ingredients: [] })
  const recipes = [
    withTags(1, ['高たんぱく', '和食']),
    withTags(2, ['高たんぱく', '和食']),
    withTags(3, ['高たんぱく']),
    withTags(4, ['作り置き']),
  ]
  eq('⑮ 隠すタグの一覧に「高たんぱく」が入っている', [...FILTER_HIDDEN_TAGS].includes('高たんぱく'), true)
  // 前提: 生の集計では「高たんぱく」がいちばん多い＝隠さなければ必ず候補の先頭に出る
  eq(
    '⑮ 前提: 生の集計では「高たんぱく」が数えられている',
    tagUsageCounts(recipes, 6).map((u) => u.tag),
    ['高たんぱく', '和食', '作り置き'],
  )
  eq(
    '⑮ 絞り込みの候補からは「高たんぱく」が消える',
    filterTagUsageCounts(recipes, 6).map((u) => u.tag),
    ['和食', '作り置き'],
  )
  eq(
    '⑮ 隠したぶんで候補の枠が減らない(上限まで他のタグが入る)',
    filterTagUsageCounts(recipes, 1).map((u) => u.tag),
    ['和食'],
  )
  // レシピ側のタグは残っている＝データは失っていない
  eq(
    '⑮ レシピの「高たんぱく」タグは残っている(絞り込みの指定は今までどおり効く)',
    searchRecipes(recipes, {
      query: '',
      ingredients: '',
      time: 'all',
      effort: 'all',
      tag: '高たんぱく',
      favoriteOnly: false,
      excludeNg: false,
      quickOnly: false,
      ngIngredients: [],
    }).map((r) => r.recipe.id),
    [1, 2, 3],
  )
}

// ---------- 便HZ・② よく使う検索を「絞り込みのタグ」として登録する ----------
// オーナーの訂正:「検索結果にタグづけは、絞り込んだレシピにタグをつけるのではなく、
// 絞り込み機能の『タグ』に新しいタグを追加する、という意味でした。レシピ自体はいじりません」
// 「よく使うタグを自分で設定する機能です」。
// 以前の版(便HU・⑭)は、押した時点で検索に一致したレシピに実際にタグを書き込んでいた。
//
// 【この節でいちばん測ること】レシピのデータが1件も変わらないこと。
// 登録→押す→削除まで通しでやってから、レシピの配列を丸ごと比べる。
{
  const {
    savedSearchFromQuery,
    savedSearchesWith,
    savedSearchesWithout,
    countRecipesWithTag,
    tagsWithRemoved,
    buildSavedSearchRemoveConfirm,
    buildLegacyTagRemoveConfirm,
    SAVED_SEARCH_MAX_LENGTH,
  } = await import('../../src/logic/tagRegister.ts')
  const { confirmContentText } = await import('../../src/logic/confirmContent.ts')
  const baseOptions = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  // 登録できる言葉の作り方(空白の詰め方は検索と同じ＝登録した言葉をそのまま検索欄に戻せる)
  eq('② 前後の空白は落とす', savedSearchFromQuery('  作り置き  '), '作り置き')
  eq('② 語の間の空白は半角1つにまとめる', savedSearchFromQuery('鶏　むね'), '鶏 むね')
  eq('② 空の検索語では登録しない', savedSearchFromQuery('   '), null)
  eq(
    '② チップに収まらない長さは登録しない',
    savedSearchFromQuery('あ'.repeat(SAVED_SEARCH_MAX_LENGTH + 1)),
    null,
  )

  const mk = (id, title, tags) => ({
    id,
    title,
    tags,
    searchWords: [title],
    ingredients: [{ name: title }],
    cookedLogs: [],
  })
  const recipes = [mk(1, 'から揚げ', []), mk(2, 'から揚げ丼', ['和食']), mk(3, '肉じゃが', [])]
  // レシピが1件も変わらないことを測るための控え(通しでやったあとに丸ごと比べる)
  const recipesBefore = JSON.stringify(recipes)

  const hits = searchRecipes(recipes, { ...baseOptions, query: 'から揚げ' }).map((r) => r.recipe.id)
  eq('② 前提: 検索に一致した品が2品ある(空振りしていない)', hits, [1, 2])
  const name = savedSearchFromQuery('から揚げ')

  // 登録: 増えるのは「登録した言葉の控え」だけ
  let saved = savedSearchesWith(undefined, name)
  eq('② 登録すると控えに入る', saved, ['から揚げ'])
  eq('② 同じ言葉を2回登録しても控えは増えない', savedSearchesWith(saved, name), ['から揚げ'])

  // 押す: その検索が呼び戻される(登録したときと同じ結果に戻る)
  eq(
    '② 登録したタグを押すと、登録したときと同じ結果が戻る',
    searchRecipes(recipes, { ...baseOptions, query: name }).map((r) => r.recipe.id),
    hits,
  )
  eq('② 登録してもレシピのタグは1つも増えない', recipes.map((r) => r.tags), [[], ['和食'], []])
  eq(
    '② そのタグが付いた品は1品も無い(レシピには書き込んでいない)',
    countRecipesWithTag(recipes, name),
    0,
  )

  // 削除: 控えから消えるだけ
  saved = savedSearchesWithout(saved, name)
  eq('② 削除すると控えから消える', saved, [])
  eq(
    '② 登録→押す→削除を通してもレシピのデータが1件も変わらない',
    JSON.stringify(recipes),
    recipesBefore,
  )

  // 削除の確認(規約F: 何が消えて何が残るかを両方書く。「よろしいですか？」だけにしない)
  const removeText = confirmContentText(
    buildSavedSearchRemoveConfirm({ name: 'から揚げ', recipeCount: 3 }),
  )
  eq('② 削除の窓に消えるものが出る', removeText.includes('消えるもの'), true)
  eq('② 削除の窓に残るものが出る', removeText.includes('残るもの'), true)
  eq('② 削除の窓にレシピが1品も変わらないことが出る', removeText.includes('レシピ3品'), true)
  eq(
    '② 削除の窓が「よろしいですか？」だけになっていない',
    removeText.includes('よろしいですか'),
    false,
  )

  // 以前の版がレシピ本体に書き込んだタグの後始末。外す道は残す(データを失う方に倒さない)
  const legacy = [mk(1, 'から揚げ', ['から揚げ']), mk(2, 'から揚げ丼', ['和食', 'から揚げ'])]
  eq('② 前提: 以前の版で書き込まれたタグが2品に残っている', countRecipesWithTag(legacy, 'から揚げ'), 2)
  const cleaned = legacy.map((r) => ({ ...r, tags: tagsWithRemoved(r.tags, 'から揚げ') }))
  eq('② 外すとそのタグだけが消える', cleaned.map((r) => r.tags), [[], ['和食']])
  eq('② 外してもレシピそのものは残る', cleaned.map((r) => r.id), [1, 2])
  const legacyText = confirmContentText(buildLegacyTagRemoveConfirm({ tag: 'から揚げ', count: 2 }))
  eq('② 後始末の窓に消えるものが出る', legacyText.includes('消えるもの'), true)
  eq('② 後始末の窓に残るものが出る', legacyText.includes('残るもの'), true)
  eq('② 後始末の窓に何品から外れるかが出る', legacyText.includes('レシピ2品'), true)
}

// ---------- 便HZ・② レシピを書き換える経路が本当に無いことを、コードそのものから見る ----------
// 画面を立ち上げずに measure できる唯一の形。読み取りに失敗したら必ず落ちるようにする
// (ファイルが読めなかった＝合格、に倒れない)。同じ読み方で「在るもの」も読めることを
// 前提として確かめ、正規表現が空振りしているだけの合格を作らない。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  // 説明のコメントに書いた名前(「addTagToRecipes は便HZで削除した」等)を数えないよう、
  // コメントを落としてから読む＝コードとして残っているかどうかだけを見る
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/gm, '$1')
  const read = (rel) => {
    const text = readFileSync(path.join(appRoot, rel), 'utf-8')
    if (text.length < 200) throw new Error(`${rel} を読み取れていない(長さ=${text.length})`)
    const code = stripComments(text)
    if (code.length < 200) throw new Error(`${rel} のコメントを落としたら中身が残らない`)
    return code
  }
  const page = read('src/pages/RecipesPage.tsx')
  // タグのチップは2026-08-27 便LM で絞り込みパネルへ切り出した。
  // 「レシピを書き換える経路が無い」の見張りも一緒に移さないと、移した先で素通りする
  const filterPanel = read('src/components/RecipeFilterPanel.tsx')
  const dbRecipes = read('src/db/recipes.ts')
  const logic = read('src/logic/tagRegister.ts')
  // 前提: 同じ読み方で、いま在るものは「在る」と読める(見張りの空振り防止)
  eq(
    '② 前提: 見張りが空振りしていない(在る名前は読み取れる)',
    /savedSearchesWith/.test(logic) &&
      /savedSearchFromQuery/.test(page) &&
      /removeTagFromRecipes/.test(dbRecipes),
    true,
  )
  eq(
    '② レシピにタグを書き込む関数(addTagToRecipes)がDBから無くなった',
    /addTagToRecipes/.test(dbRecipes),
    false,
  )
  eq('② レシピ一覧からも addTagToRecipes を呼んでいない', /addTagToRecipes/.test(page), false)
  eq(
    '② 切り出した絞り込みパネルからも addTagToRecipes を呼んでいない（2026-08-27 便LM）',
    /addTagToRecipes/.test(filterPanel),
    false,
  )
  // 前提: 絞り込みパネルの側も、いま在るものは「在る」と読める（見張りの空振り防止）
  eq(
    '② 前提: 絞り込みパネルを読み取れている（タグのチップが在る）',
    /recipes-saved-search-chip/.test(filterPanel) && /recipes-tag-chip/.test(filterPanel),
    true,
  )
  eq(
    '② 登録のロジックにタグを足す道具(tagsWithAdded・recipeIdsMissingTag)が残っていない',
    /tagsWithAdded|recipeIdsMissingTag/.test(logic),
    false,
  )
}

// ---------- 便HZ・③ タグの複数選択と、2つ以上選んだときの選び方の切り替え ----------
// オーナー「タグ検索は、複数選択できるよにして。AND検索OR検索の切り替え機能も欲しい」。
// 件数の決め打ちではなく、**2つ選んだときにANDとORで結果が実際に違う**ことと、
// **AND ⊆ OR** の関係で測る(タグの顔ぶれが増えても意味が変わらない形)。
{
  const { defaultSearchOptions } = await import('../../src/logic/search.ts')
  const mk = (id, tags) => ({
    id,
    title: `品${id}`,
    tags,
    searchWords: [],
    ingredients: [],
    cookedLogs: [],
  })
  const recipes = [mk(1, ['和食', '作り置き']), mk(2, ['和食']), mk(3, ['作り置き']), mk(4, ['洋食'])]
  const base = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ids = (tags, tagMatch) =>
    searchRecipes(recipes, { ...base, tags, tagMatch }).map((r) => r.recipe.id)

  eq('③ 1つも選んでいなければ絞らない', ids([], 'any'), [1, 2, 3, 4])
  eq('③ 空の配列も「絞らない」と同じ', ids([], 'all'), [1, 2, 3, 4])
  eq('③ 1つだけ選んだとき(どれかが付いている)', ids(['和食'], 'any'), [1, 2])
  eq('③ 1つだけなら選び方を変えても結果は同じ', ids(['和食'], 'all'), ids(['和食'], 'any'))

  const anyTwo = ids(['和食', '作り置き'], 'any')
  const allTwo = ids(['和食', '作り置き'], 'all')
  eq('③ 前提: 2つ選んだときどちらも空振りしていない', anyTwo.length > 0 && allTwo.length > 0, true)
  neq('③ 2つ選ぶと、選び方で結果が実際に違う', allTwo, anyTwo)
  eq(
    '③ 「すべて付いている」の結果は「どれかが付いている」に必ず含まれる',
    allTwo.every((id) => anyTwo.includes(id)),
    true,
  )
  eq('③ 「すべて付いている」の方が必ず少ない(選ぶほど絞れる)', allTwo.length < anyTwo.length, true)
  eq('③ どれかが付いている＝和集合', anyTwo, [1, 2, 3])
  eq('③ すべて付いている＝両方付いている品だけ', allTwo, [1])
  eq('③ 選び方を渡さないときは「どれかが付いている」として扱う', ids(['和食', '作り置き'], undefined), anyTwo)
  eq('③ 既定値も「どれかが付いている」', defaultSearchOptions.tagMatch, 'any')
  // 既定を「すべて付いている」にしない理由: 候補の上位は和食・洋食のように同時には付かない分類で、
  // 2つ目を押した瞬間に0品になり、壊れて見える
  eq('③ 同時には付かないタグ2つ: すべて付いている＝0品', ids(['和食', '洋食'], 'all'), [])
  eq('③ 同時には付かないタグ2つ: どれかが付いている＝品が出る', ids(['和食', '洋食'], 'any'), [1, 2, 4])
  // 1つだけ選ぶ旧来の指定(献立のレシピ選択ピッカー等)は今までどおり効く
  eq(
    '③ 1つだけ選ぶ旧来の指定(tag)は今までどおり効く',
    searchRecipes(recipes, { ...base, tag: '洋食' }).map((r) => r.recipe.id),
    [4],
  )
  eq(
    '③ 旧来の指定と複数選択は同時に指定しても両方効く',
    searchRecipes(recipes, { ...base, tag: '和食', tags: ['作り置き'], tagMatch: 'any' }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
}

// ---------- 便IB・② 登録したタグも、もとからあるタグと同じ「タグ」の並びで絞り込む ----------
// オーナー実機フィードバック「絞り込みタグは、実質キーワード検索？説明に『タグが付いている
// レシピの品数』とあるので、表現を揃えたい。やりたいことは『好きなキーワードをよく使うタグとして
// 絞り込みに登録したい』」。
//
// 直す前は、同じ「タグ」の欄に性質の違う2つが並んでいた:
//   ・もとからあるタグ = レシピに付いている印。押すと複数選択に入り、選び方(どれか/すべて)が効く
//   ・自分で登録したタグ = 保存した検索の言葉。押すと検索欄に入るだけで、選び方は効かない
// 利用者から見ると同じ「タグ」なのに、押したときの効き方が違っていた。
//
// 【この節で測ること】
//  (1) 登録したタグを押した結果が、その言葉で検索した結果と同じであること
//  (2) 登録したタグも、もとからあるタグと同じ選び方(どれか/すべて)に乗ること
//  (3) チップに出す数字が、そのタグだけで絞り込んだときに実際に出る品数と一致すること
//      (もとからあるタグ・登録したタグの両方で。数字と結果が食い違うと説明文が嘘になる)
//  (4) 登録したタグを使ってもレシピのデータが1件も変わらないこと(A案の一点)
// 件数の決め打ちはせず、同じ関数から取った2つの数の一致で見る。
{
  const { countRecipesMatchingKeyword } = await import('../../src/logic/search.ts')
  const mk = (id, title, tags) => ({
    id,
    title,
    tags,
    searchWords: [title],
    ingredients: [{ name: title }],
    cookedLogs: [],
  })
  const recipes = [
    mk(1, 'から揚げ', ['和食']), // 言葉にも当たり、タグも付いている
    mk(2, 'から揚げ丼', []), // 言葉にだけ当たる
    mk(3, '肉じゃが', ['和食']), // タグだけ付いている
    mk(4, 'パスタ', ['洋食']), // どちらでもない
  ]
  const recipesBefore = JSON.stringify(recipes)
  const base = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ids = (options) => searchRecipes(recipes, { ...base, ...options }).map((r) => r.recipe.id)

  // (1) 押したときの結果＝その言葉で検索した結果
  eq('IB② 登録したタグを押した結果は、その言葉の検索と同じ', ids({ keywords: ['から揚げ'] }), ids({ query: 'から揚げ' }))
  eq('IB② 前提: その言葉の検索が0品でも全品でもない', ids({ keywords: ['から揚げ'] }), [1, 2])
  eq('IB② 1つも選んでいなければ絞らない', ids({ keywords: [] }), [1, 2, 3, 4])

  // (2) もとからあるタグと同じ選び方に乗る
  const anyMixed = ids({ tags: ['和食'], keywords: ['から揚げ'], tagMatch: 'any' })
  const allMixed = ids({ tags: ['和食'], keywords: ['から揚げ'], tagMatch: 'all' })
  eq('IB② 前提: 混ぜて選んでもどちらも空振りしていない', anyMixed.length > 0 && allMixed.length > 0, true)
  eq('IB② どれかが当たる＝もとからあるタグと登録したタグの和集合', anyMixed, [1, 2, 3])
  eq('IB② すべて当たる＝両方に当たる品だけ', allMixed, [1])
  eq(
    'IB② 「すべて」の結果は「どれか」に必ず含まれる(混ぜても関係は同じ)',
    allMixed.every((id) => anyMixed.includes(id)),
    true,
  )
  eq('IB② 「すべて」の方が必ず少ない(混ぜても選ぶほど絞れる)', allMixed.length < anyMixed.length, true)
  eq('IB② 登録したタグ同士でも選び方が効く(どれか)', ids({ keywords: ['から揚げ', '肉じゃが'], tagMatch: 'any' }), [1, 2, 3])
  eq('IB② 登録したタグ同士でも選び方が効く(すべて)', ids({ keywords: ['から揚げ', '肉じゃが'], tagMatch: 'all' }), [])

  // (3) チップの数字＝そのタグだけで絞り込んだときに実際に出る品数
  eq('IB② 登録したタグの品数を数える道具がある', typeof countRecipesMatchingKeyword, 'function')
  // 道具がまだ無い版でも、この節の残りが「実行時エラーで止まる」ではなく
  // 「数字が読めない＝不合格」として出るようにする(読み取り失敗を素通り合格にしない)
  const countKeyword =
    typeof countRecipesMatchingKeyword === 'function' ? countRecipesMatchingKeyword : () => null
  const keywordShown = countKeyword(recipes, 'から揚げ')
  eq(
    'IB② 登録したタグ: 画面に出す数字と、押したときに出る品数が一致する',
    keywordShown,
    ids({ keywords: ['から揚げ'] }).length,
  )
  const tagShown = tagUsageCounts(recipes, 10).find((u) => u.tag === '和食')?.count
  eq(
    'IB② もとからあるタグ: 画面に出す数字と、押したときに出る品数が一致する',
    tagShown,
    ids({ tags: ['和食'] }).length,
  )
  eq('IB② 前提: 数字を読み取れている(0や未取得のまま合格にしない)', keywordShown > 0 && tagShown > 0, true)

  // (4) レシピのデータは1件も変わらない(A案: 登録したタグはレシピに書き込まない)
  eq('IB② 登録したタグで絞り込んでもレシピのデータが1件も変わらない', JSON.stringify(recipes), recipesBefore)
  eq('IB② そのタグが付いた品は1品も無い(レシピには書き込んでいない)', tagUsageCounts(recipes, 10).some((u) => u.tag === 'から揚げ'), false)
}

// ---------- 便CI 第3波: 検索の配線(C09/C21/C12/C11/C16) ----------
// 実機QAで「和食66件 / わしょく0件」「作り置き44件 / つくりおき0件」「鶏ひき肉3件 / とりひきにく0件」と、
// 登録時のタグ候補では引ける読みが検索では1件も引けなかった(読み辞書が検索に配線されていなかった)。
{
  // 全109品の基本レシピを実データとして使い、漢字表記とかな表記の件数が一致することを見る
  const ciRecipes = starterDefs.map((def, index) => ({
    id: index + 1,
    title: def.title,
    servings: def.servings ?? 2,
    effortLevel: def.effortLevel ?? 'normal',
    tags: def.tags ?? [],
    ingredients: def.ingredients ?? [],
    steps: def.steps ?? [],
    isFavorite: false,
    cookedLogs: [],
    createdAt: 0,
    updatedAt: index,
    searchWords: buildSearchWords(def.title, def.ingredients ?? [], def.tags ?? [], def.keywords),
  }))
  const ciBase = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const hits = (query) => searchRecipes(ciRecipes, { ...ciBase, query }).length

  // C09: タグのかな検索(漢字表記でも引けるままであること=既存の検索結果を1件も減らさない)
  for (const [kanji, kana] of [
    ['和食', 'わしょく'],
    ['中華', 'ちゅうか'],
    ['作り置き', 'つくりおき'],
    ['お弁当', 'おべんとう'],
    ['煮物', 'にもの'],
    ['汁物', 'しるもの'],
    ['鍋', 'なべ'],
    ['魚', 'さかな'],
    ['高たんぱく', 'こうたんぱく'],
    ['冷凍ストック', 'れいとうすとっく'],
  ]) {
    const kanjiHits = hits(kanji)
    eq(`C09 タグ「${kanji}」は1件以上ヒットする(従来どおり)`, kanjiHits > 0, true)
    eq(`C09 かな「${kana}」でも同じ件数になる`, hits(kana), kanjiHits)
  }

  // C21: 「鶏ひき肉」など、ひらがな交じりの材料名の読み
  eq('C21 「鶏ひき肉」は1件以上ヒットする', hits('鶏ひき肉') > 0, true)
  eq('C21 「とりひきにく」でも同じ件数', hits('とりひきにく'), hits('鶏ひき肉'))
  eq('C21 「鶏挽肉」(未使用表記)でも同じ件数', hits('鶏挽肉'), hits('鶏ひき肉'))
  eq('C21 「ひきにく」は鶏・豚をまとめて拾う', hits('ひきにく'), hits('ひき肉'))

  // C12: 料理名の読み。同梱レシピは全品が読みに変換できること(基本レシピを増やしたらここが落ちる)
  const unreadable = starterDefs
    .map((def) => def.title)
    .filter((title) => /[^ぁ-ゟーa-z0-9 ]/.test(titleKanaKey(title)))
  eq(`C12 同梱レシピの料理名はすべて読みに変換できる(未登録=${unreadable.join('・')})`, unreadable, [])
  eq('C12 読み: 肉じゃが', titleKanaKey('肉じゃが'), 'にくじゃが')
  eq('C12 読み: 豚汁(ぶたしるにしない)', titleKanaKey('豚汁'), 'とんじる')
  eq('C12 読み: 白和え', titleKanaKey('白和え'), 'しらあえ')
  eq('C12 辞書に無い料理名も、よく出る語の分だけ読みに寄せる', titleKanaKey('大葉の照り焼き'), '大葉のてりやき')
  // 五十音順が実際にあ→ん順になっている(旧実装では漢字始まりが末尾に固まっていた)
  const kanaSorted = sortResults(searchRecipes(ciRecipes, ciBase), 'kana', [], 'asc')
  const kanaKeys = kanaSorted.map((r) => titleKanaKey(r.recipe.title))
  const collatorJa = new Intl.Collator('ja')
  eq(
    'C12 五十音順の並びが読みの昇順になっている',
    kanaKeys.every((key, i) => i === 0 || collatorJa.compare(kanaKeys[i - 1], key) <= 0),
    true,
  )
  eq('C12 五十音順の先頭は「あ」で始まる読み', kanaKeys[0].startsWith('あ'), true)
  eq(
    'C12 漢字始まりの料理名が末尾に固まっていない(肉じゃがは「に」の位置)',
    kanaSorted.findIndex((r) => r.recipe.title === '肉じゃが') < kanaSorted.length - 20,
    true,
  )

  // C11: 「使いたい食材」を入れている間は、ぜんぶ使えるレシピが必ず先頭に出る
  const wanted = searchRecipes(ciRecipes, { ...ciBase, ingredients: 'キャベツ にんじん' })
  const sortedByUpdated = sortResults(wanted, 'updated', [])
  eq(
    'C11 並べ替えが更新順のままでも「ぜんぶ使える」が先頭に来る',
    sortedByUpdated[0].usedCount,
    2,
  )
  eq(
    'C11 usedCountの降順が崩れない(並べ替えの選択は同点内でだけ効く)',
    sortedByUpdated.every((r, i) => i === 0 || sortedByUpdated[i - 1].usedCount >= r.usedCount),
    true,
  )
  eq(
    'C11 五十音順を選んでも「ぜんぶ使える」優先は変わらない',
    sortResults(wanted, 'kana', [], 'asc')[0].usedCount,
    2,
  )
  eq(
    'C11 「使いたい食材」を入れていないときは並べ替えの結果を変えない',
    sortResults(searchRecipes(ciRecipes, ciBase), 'kana', [], 'asc').map((r) => r.recipe.id),
    kanaSorted.map((r) => r.recipe.id),
  )

  // C16: 作った記録のひとことメモも検索対象にする
  const withNote = ciRecipes.map((r) =>
    r.title === '肉じゃが'
      ? { ...r, cookedLogs: [{ date: '2026-07-20', note: '子どもが完食した' }] }
      : r,
  )
  eq(
    'C16 記録メモの言葉で検索するとそのレシピが出る',
    searchRecipes(withNote, { ...ciBase, query: '完食' }).map((r) => r.recipe.title),
    ['肉じゃが'],
  )
  eq(
    'C16 記録メモはレシピ保存を挟まなくても効く(searchWordsに入れない)',
    searchRecipes(ciRecipes, { ...ciBase, query: '完食' }).length,
    0,
  )
}

// ---------- 便FF-2/3/4: レシピタブの絞り込みの作り直し(2026-08-10 オーナー指示) ----------
{
  // (1) タグのチップに出す件数。並びの規則(件数の多い順・同数は五十音順)を数字で示す
  const withTags = (tags) => ({ tags })
  const ffTagRecipes = [
    withTags(['和食', '作り置き']),
    withTags(['和食']),
    withTags(['和食', 'お弁当']),
    withTags(['作り置き']),
    withTags([]),
  ]
  eq('FF-TAG チップは件数つきで多い順に返る', tagUsageCounts(ffTagRecipes, 3), [
    { tag: '和食', count: 3 },
    { tag: '作り置き', count: 2 },
    { tag: 'お弁当', count: 1 },
  ])
  eq('FF-TAG limitで打ち切る', tagUsageCounts(ffTagRecipes, 1), [{ tag: '和食', count: 3 }])
  eq('FF-TAG タグが無ければ空', tagUsageCounts([withTags([])], 6), [])
  eq(
    'FF-TAG 名前だけを返す従来の関数と並びが一致する(献立のレシピ選択が使う)',
    topTagsByUsage(ffTagRecipes, 3),
    tagUsageCounts(ffTagRecipes, 3).map((t) => t.tag),
  )

  // (2) 料理の種別での絞り込み。主菜/副菜はタグではなくレシピの項目(dishType)で、
  //     未設定のレシピは推定に倒す(=4区分で全レシピをちょうど覆う)
  const ffBase = {
    query: '',
    ingredients: '',
    time: 'all',
    effort: 'all',
    tag: 'all',
    dishType: 'all',
    favoriteOnly: false,
    excludeNg: false,
    quickOnly: false,
    ngIngredients: [],
  }
  const ffDish = (id, title, dishType, ingredients = []) => ({
    id,
    title,
    tags: [],
    searchWords: [],
    ingredients: ingredients.map((name) => ({ name })),
    cookedLogs: [],
    dishType,
  })
  const ffRecipes = [
    ffDish(1, '鶏の照り焼き', 'main'),
    ffDish(2, 'ほうれん草のおひたし', 'side'),
    ffDish(3, 'わかめのみそ汁', 'soup'),
    ffDish(4, '大学芋', 'dessert'),
    // dishType 未設定＝推定に倒す(材料の豚肉から主菜)
    ffDish(5, '肉じゃが', undefined, ['豚肉', 'じゃがいも']),
  ]
  // 2026-08-19 便HU・⑬: 1つだけ選ぶ形から複数選べる形（dishTypes）に変えた
  const ffIds = (dishTypes) =>
    searchRecipes(ffRecipes, { ...ffBase, dishTypes }).map((r) => r.recipe.id)
  eq('FF-DISH 何も選んでいなければ絞らない', ffIds([]), [1, 2, 3, 4, 5])
  eq('FF-DISH 主菜(未設定は推定で主菜に入る)', ffIds(['main']), [1, 5])
  eq('FF-DISH 副菜', ffIds(['side']), [2])
  eq('FF-DISH 汁物', ffIds(['soup']), [3])
  eq('FF-DISH その他', ffIds(['dessert']), [4])
  eq(
    'FF-DISH 4区分を合わせると全件になる(取りこぼしが出ない)',
    ffIds(['main', 'side', 'soup', 'dessert']),
    [1, 2, 3, 4, 5],
  )
  eq(
    'FF-DISH 項目を渡さない呼び出し側は従来どおり絞らない(献立のレシピ選択・テンプレ画面)',
    searchRecipes(ffRecipes, { ...ffBase, dishTypes: undefined }).map((r) => r.recipe.id),
    [1, 2, 3, 4, 5],
  )
  eq(
    'FF-DISH 他の絞り込みと重ねられる',
    searchRecipes(ffRecipes, { ...ffBase, dishTypes: ['main'], query: '照り焼き' }).map(
      (r) => r.recipe.id,
    ),
    [1],
  )
}

// ---------- 便GV-1: 検索窓に「主菜」「副菜」と打っても絞り込めない(2026-08-15 オーナー実機) ----------
// 原因: buildSearchWords が作る検索語は 料理名+主な材料+タグ+検索キーワード+手順の調理器具 で、
// 料理の種別(Recipe.dishType)が入っていなかった。絞り込みの「料理の種別」チップには
// 前からあるので、検索窓に打った人だけが0件に落ちていた。
// 測るのは「絞り込みチップと同じ言葉を検索窓に打てば同じ集合が出るか」。
{
  const soboro = { title: '鶏そぼろ丼', ingredients: [{ name: '鶏ひき肉', amount: '200', unit: 'g' }], tags: [] }
  const mainWords = buildSearchWords(soboro.title, soboro.ingredients, soboro.tags, undefined, undefined, 'main')
  eq('GV-1 主菜のレシピは「主菜」で引ける', mainWords.includes('主菜'), true)
  eq('GV-1 主菜のレシピは読み「しゅさい」でも引ける', mainWords.includes('しゅさい'), true)

  const ohitashi = { title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草', amount: '1', unit: '束' }], tags: [] }
  const sideWords = buildSearchWords(ohitashi.title, ohitashi.ingredients, ohitashi.tags, undefined, undefined, 'side')
  eq('GV-1 副菜のレシピは「副菜」で引ける', sideWords.includes('副菜'), true)
  eq('GV-1 副菜のレシピは読み「ふくさい」でも引ける', sideWords.includes('ふくさい'), true)
  eq('GV-1 副菜のレシピは「主菜」では引けない(種別の絞り込みと食い違わせない)', sideWords.includes('主菜'), false)

  const misoshiru = { title: '豆腐とわかめの味噌汁', ingredients: [{ name: '豆腐', amount: '1/2', unit: '丁' }], tags: [] }
  const soupWords = buildSearchWords(misoshiru.title, misoshiru.ingredients, misoshiru.tags, undefined, undefined, 'soup')
  eq('GV-1 汁物のレシピは「汁物」で引ける', soupWords.includes('汁物'), true)
  eq('GV-1 汁物のレシピは読み「しるもの」でも引ける', soupWords.includes('しるもの'), true)

  const daigakuimo = { title: '大学芋', ingredients: [{ name: 'さつまいも', amount: '2', unit: '本' }], tags: [] }
  const dessertWords = buildSearchWords(daigakuimo.title, daigakuimo.ingredients, daigakuimo.tags, undefined, undefined, 'dessert')
  eq('GV-1 その他のレシピは「その他」で引ける', dessertWords.includes('その他'), true)

  // 種別が未設定のレシピ(主にユーザー自作)も、絞り込みチップと同じ推定(dishTypeGuess)に倒す。
  // ここがずれると「絞り込みでは副菜に出るのに、検索窓の『副菜』では出ない」が起きる
  const guessed = buildSearchWords(misoshiru.title, misoshiru.ingredients, misoshiru.tags)
  eq('GV-1 種別が未設定でも推定した種別で引ける(絞り込みチップと同じ判定)', guessed.includes('汁物'), true)

  // 絞り込みチップの名前(ja.dishType)と検索語がずれると、打っても0件のままになる。
  // 文言を変えたらここが赤くなる＝索引の作り直し(SEARCH_INDEX_VERSION)を忘れないための歯止め
  for (const [type, label] of Object.entries(ja.dishType)) {
    const words = buildSearchWords('テスト料理', [{ name: '鶏もも肉', amount: '1', unit: '枚' }], [], undefined, undefined, type)
    eq(`GV-1 絞り込みチップ「${label}」と同じ言葉で検索できる`, words.includes(label), true)
  }

  // 広げすぎない: 「メイン」「おかず」「スープ」等の言い換えは入れない(誤ヒットが増えるため)。
  // 入れた語を増やすときは、この行も一緒に見直すこと
  eq('GV-1 種別の言い換え(メイン)は検索語に入れない', mainWords.some((w) => w.includes('めいん')), false)
  eq('GV-1 種別の言い換え(おかず)は検索語に入れない', mainWords.some((w) => w.includes('おかず')), false)
  eq('GV-1 種別の言い換え(スープ)は検索語に入れない', soupWords.some((w) => w.includes('すーぷ')), false)

  // 既に登録済みのレシピにも効かせるには索引の作り直しが要る(db/recipes.ts rebuildSearchWordsIfNeeded)。
  // 版を上げ忘れると、新規登録したレシピでしか「主菜」で引けない
  eq(
    'GV-1 種別を足す前(v3)に保存された検索語は起動時に作り直される',
    searchIndexNeedsRebuild({ ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: 3 }),
    true,
  )
  eq(
    'GV-1 いまの版で保存済みなら作り直さない(毎回作り直して起動が重くならない)',
    searchIndexNeedsRebuild({ ingredientReadingsVersion: READINGS_VERSION, searchIndexVersion: SEARCH_INDEX_VERSION }),
    false,
  )
}

// ---------- IL-5 「デザート」でも「おやつ」でも同じ品が出る（⑤） ----------
// オーナー原文: 「検索に引っかかるワードとしては『おやつ』も『デザート』もそれぞれで出てほしい。
//   内容としてはおなじなので、『デザート』で『おやつ』が表示されるのでも、逆でもいい。
//   ただ、大学芋がデザートかといえば違う気がするので『おやつ』だよなあ、はあります。種別はそのまま。」
// タグ名は「おやつ」のまま・種別の表示名も「その他」のまま。**タグの別名**として当てる
// （種別「その他」に「デザート」を足すと、パン・飲み物まで甘いもの扱いで並ぶため足さない）。
{
  const ilRecipe = (over) => ({
    id: 0,
    title: '',
    tags: [],
    keywords: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
  const ilWithWords = (r) => ({
    ...r,
    searchWords: buildSearchWords(r.title, r.ingredients, r.tags, r.keywords, r.steps, r.dishType),
  })
  // 同梱の基本レシピ（オーナーが実機で見ている中身そのもの）で測る
  const ilRecipes = starterDefs.map((def, i) => ilWithWords(ilRecipe({ ...def, id: i + 1 })))
  const ilFind = (q) =>
    searchRecipes(ilRecipes, { ...defaultSearchOptions, ngIngredients: [], query: q })
      .map((r) => r.recipe.title)
      .sort()
  const oyatsu = ilFind('おやつ')
  const dessert = ilFind('デザート')
  eq('IL-5 「おやつ」で当たる品がある（掴めていないまま合格に倒れない）', oyatsu.length > 0, true)
  eq('IL-5 「デザート」でも「おやつ」と同じ品が出る', dessert, oyatsu)
  // 種別「その他」には「鮭フレーク」「だしのとり方」も入っている。甘くない品まで並べない
  eq('IL-5 「デザート」で種別「その他」の品まで並ばない', dessert.includes('手作り鮭フレーク'), false)
  eq('IL-5 「デザート」で「だしのとり方」は出ない', dessert.includes('だしのとり方'), false)
  // 「その他」で絞る従来の道は今までどおり効く（種別の表示名は変えていない）
  eq('IL-5 種別の言葉「その他」は変えていない', dishTypeSearchWord('dessert'), 'その他')
  // 一致した場所の言い方: 別名で当たっても、レシピに書いてある言葉（タグ「おやつ」）を出す
  const ilDessertReasons = ilFind('デザート').length > 0
    ? searchMatchReasons(
        ilRecipes.find((r) => r.tags.includes('おやつ')),
        splitTerms('デザート'),
      )
    : []
  eq('IL-5 別名で当たったときは「タグ」に出る', ilDessertReasons.map((x) => x.field), ['tag'])
  eq(
    'IL-5 別名で当たったときはレシピに書いてある言葉を出す',
    ilDessertReasons.map((x) => x.word),
    ['おやつ'],
  )
  eq(
    'IL-5 一致した場所の行は ja の文言から作る',
    searchMatchRowText({ field: 'tag', word: 'おやつ', count: dessert.length }),
    ja.search.matchRow
      .replace('{field}', ja.search.matchFieldTag)
      .replace('{word}', 'おやつ')
      .replace('{n}', String(dessert.length)),
  )
}

// ============================================================================
// 2026-08-21 便IO: 「別の週から入れる」（中身を見ながら選ぶ）
//
// オーナー原文:
//   「先週に限らず、ユーザーが選んだ７日間を指定（献立一覧で表示して、今表示している
//     ７日間の献立を今週に反映、と言った感じ？献立の中身も確認できるし。いい案求む）
//     →この週の献立をコピー（名前はちゃんと考えて）、この週の献立をテンプレートとして
//     保存、みたいな？」
//
// 効く理由: 「先週」だけを選べる形では、**何が入っていたか思い出せないまま押す**ことになる。
// 中身を見ながら選べることが本題なので、測るのも次の2つにする:
//   ① 画面に並べる「その週の中身」が、実際にその週に入っているものと一致する
//   ② 入れたあと、その中身がそのまま入れ先の週に入っている
//
// 禁じ手よけ:
//  ・「今日」もコピー元も引数で渡す＝走らせた日の曜日・月替わりで結論が変わらない
//  ・文言は ja.ts から読む（画面の字を書き写さない）
//  ・関数が無いときは素通りせず、その場でNGにする
// ============================================================================
{
  const io = await import('../../src/logic/mealPlan.ts')
  const viewOf = io.copySourceWeekView
  const maxBack = io.maxCopySourceWeeksBack
  eq('IO-0 その週の中身を作る関数がある（copySourceWeekView）', typeof viewOf === 'function', true)
  eq(
    'IO-0 さかのぼれる上限を決める関数がある（maxCopySourceWeeksBack）',
    typeof maxBack === 'function',
    true,
  )
  if (typeof viewOf === 'function' && typeof maxBack === 'function') {
    const days = (start, n) => Array.from({ length: n }, (_, i) => io.shiftDate(start, i))
    // 日付は固定して渡す（曜日・月替わりの前提を置かない）。SRCの2週間あとがDST
    const SRC = days('2026-08-03', 7)
    const DST = days('2026-08-17', 7)
    const source = [
      { date: SRC[0], slot: 'dinner', recipeId: 11, role: 'main' },
      { date: SRC[0], slot: 'dinner', recipeId: 12, role: 'side' },
      { date: SRC[0], slot: 'breakfast', recipeId: 13, role: 'main' },
      { date: SRC[3], slot: 'dinner', recipeId: 14, role: 'main' },
      // この週の外（1日前）。取得範囲の重なりでまぎれ込みやすいので、必ず捨てることを見る
      { date: io.shiftDate(SRC[0], -1), slot: 'dinner', recipeId: 99, role: 'main' },
    ]
    const visible = ['dinner']
    const view = viewOf(source, SRC, visible)

    // --- ① 見えている中身が、その週に実際に入っているものと一致する ---
    eq(
      'IO-1 中身は、選んだ7日分をそのまま並べる（献立の無い日も抜けない）',
      view.map((d) => d.date),
      SRC,
    )
    eq(
      'IO-1 その週の外の日の献立はまぎれ込まない',
      view.flatMap((d) => d.slots.flatMap((s) => s.recipeIds)).includes(99),
      false,
    )
    eq(
      'IO-1 表示していない食事は中身にも出さない（入らないものを見せない）',
      view.flatMap((d) => d.slots.map((s) => s.slot)).filter((s) => s !== 'dinner'),
      [],
    )
    eq(
      'IO-1 ある日の中身が、その日に入っている献立と一致する',
      view.find((d) => d.date === SRC[0]).slots,
      [{ slot: 'dinner', recipeIds: [11, 12] }],
    )
    eq('IO-1 献立の無い日は空のまま並ぶ', view.find((d) => d.date === SRC[1]).slots, [])

    // --- ② 入れたあと、見えていた中身がそのまま入れ先に入っている ---
    const plan = io.planCopyLastWeek({
      dates: DST,
      today: DST[0],
      visibleSlots: visible,
      entries: [],
      prevEntries: source,
      weeksBack: 2,
    })
    const shown = view.flatMap((d) =>
      d.slots.flatMap((s) =>
        s.recipeIds.map((recipeId) => ({ date: d.date, slot: s.slot, recipeId })),
      ),
    )
    const put = plan.ops.map((op) => ({
      date: io.shiftDate(op.date, -14),
      slot: op.slot,
      recipeId: op.recipeId,
    }))
    eq('IO-2 見えていた中身が、1品も欠けずにそのまま入れ先へ入る', put, shown)
    eq('IO-2 前提: 入れるものが1品以上ある（0品どうしの一致で素通りしない）', shown.length, 3)

    // --- ③ どこまでさかのぼれるかは、献立のある一番古い日で決まる ---
    eq('IO-3 献立が1件も無ければ、1週間前までにする', maxBack(DST[0], undefined), 1)
    eq(
      'IO-3 入れ先より新しい献立しか無くても、1週間前までは見られる',
      maxBack(DST[0], io.shiftDate(DST[0], 3)),
      1,
    )
    eq('IO-3 1週間前の週の中に献立があれば、1週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -1)), 1)
    eq('IO-3 ちょうど7日前に献立があれば、1週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -7)), 1)
    eq('IO-3 8日前に献立があれば、2週間前まで', maxBack(DST[0], io.shiftDate(DST[0], -8)), 2)
    eq('IO-3 364日前に献立があれば、52週間前まで（去年の同じ時期に届く）', maxBack(DST[0], io.shiftDate(DST[0], -364)), 52)
  }

  // --- ④ 文言（画面の字は書き写さず、ja.ts に在ることだけを見る） ---
  eq(
    'IO-4 「別の週から入れる」の名前がある',
    typeof ja.mealPlan.copyPickTitle === 'string' && ja.mealPlan.copyPickTitle.length > 0,
    true,
  )
  eq(
    'IO-4 入れ先の週を日付で言う差し込み口がある',
    typeof ja.mealPlan.copyPickTarget === 'string' &&
      ja.mealPlan.copyPickTarget.includes('{start}') &&
      ja.mealPlan.copyPickTarget.includes('{end}'),
    true,
  )
  eq(
    'IO-4 実行のボタンに名前がある',
    typeof ja.mealPlan.copyPickRun === 'string' && ja.mealPlan.copyPickRun.length > 0,
    true,
  )
  eq(
    'IO-4 献立を1件も入れていない人に、行き止まりにしない1行がある',
    typeof ja.mealPlan.copyPickNoPlansYet === 'string' &&
      ja.mealPlan.copyPickNoPlansYet.length > 0,
    true,
  )
  eq(
    'IO-4 その週をテンプレートとして保存するボタンに名前がある',
    typeof ja.mealPlan.copyPickSaveTemplate === 'string' &&
      ja.mealPlan.copyPickSaveTemplate.length > 0,
    true,
  )
  // 規約F: 消す操作の確認文は、消える先の週も日付で言い切る
  eq(
    'IO-4 総入れ替えの確認文が、消える先の週を日付で言う（規約F）',
    typeof ja.mealPlan.copyWeekReplaceAllConfirmTitle === 'string' &&
      ja.mealPlan.copyWeekReplaceAllConfirmTitle.includes('{toStart}') &&
      ja.mealPlan.copyWeekReplaceAllConfirmTitle.includes('{toEnd}'),
    true,
  )
  // 同じことをする道が2つあると迷う＝古いプルダウンの文言は残さない
  eq(
    'IO-4 古い「コピー元の週」のプルダウンと出しかたの2択の文言が残っていない',
    [
      ja.mealPlan.copySourceWeekLabel,
      ja.mealPlan.copySourceWeekOption,
      ja.mealPlan.fillSourceCopy,
      ja.mealPlan.fillSourceSuggest,
      ja.mealPlan.fillSourceGroupLabel,
    ].filter((v) => v !== undefined),
    [],
  )
}


// ---------- 便MA（2026-08-28）: ひき肉の「挽き」の書き分けを、絞り込みが同じ1件に寄せる ----------
//
// オーナー原文: 「『合い挽き肉』で絞り込みしても『合いびき肉』が出せなかった。」
//
// 直した中身: 読み仮名の辞書（src/logic/ingredientReadings.ts）は「挽肉」（送り仮名なし）と
// 「ひき肉」（かな）は持っていたのに、**「挽き肉」（送り仮名あり）を1つも持っていなかった**。
// 置換は辞書のキーの1パスなので「合い挽き肉」はどのキーにも当たらず素通しになり、
// マスタ側の「合いびき肉」（→あいびきにく）と1文字も重ならなかった（実測: 213件のマスタで0件）。
//
// ここで見るのは2つ。①同じ肉の書き分けが同じキーに寄ること ②**絞り込みが緩くなっていないこと**
// （マスタの213語を1つずつ検索語にしたとき、当たる行が増えていないこと。増えると
//  「関係ない食材が出る」という別の不満に化ける）。
{
  const { PRICE_DEFAULTS } = await import('../../src/data/priceDefaults.ts')
  const masterNames = PRICE_DEFAULTS.map((e) => e.name)
  /** 「食材と価格」の絞り込みと同じ当て方（src/pages/IngredientPricesPage.tsx） */
  const filterMaster = (query) => {
    const q = toHiragana(query.trim())
    return masterNames.filter((name) => toHiragana(name).includes(q))
  }

  // ① オーナーが打った書き方で、マスタの書き方が出る
  eq('MA-1 「合い挽き肉」で絞り込むと「合いびき肉」が出る', filterMaster('合い挽き肉'), ['合いびき肉'])
  eq('MA-1 もとの「合いびき肉」でも今までどおり出る', filterMaster('合いびき肉'), ['合いびき肉'])
  // 同じ肉の書き分けは、どれも同じ照合キーへ寄る（片方だけ当たる形にしない）
  for (const spelling of ['合い挽き肉', '合挽き肉', '合い挽肉', '合挽肉', 'あいびき肉']) {
    eq(
      `MA-1 「${spelling}」の照合キーが「合いびき肉」と同じ`,
      toHiragana(spelling) === toHiragana('合いびき肉'),
      true,
    )
  }
  eq('MA-1 「鶏挽き肉」は「鶏ひき肉」と同じキー', toHiragana('鶏挽き肉'), toHiragana('鶏ひき肉'))
  eq('MA-1 「豚挽き肉」は「豚ひき肉」と同じキー', toHiragana('豚挽き肉'), toHiragana('豚ひき肉'))
  eq('MA-1 送り仮名ありの「挽き肉」も「ひき肉」と同じキー', toHiragana('挽き肉'), toHiragana('ひき肉'))

  // ② 広げすぎていないこと。**別の肉に当たるようにはしない**
  eq('MA-1 合いびきの絞り込みに、鶏や豚のひき肉は混ざらない', filterMaster('合い挽き肉').length, 1)
  // 2026-08-29 便MJ でここは 2件 → 3件 になった（合いびき肉が「ひき肉」で出るようになった）。
  // 数だけでなく**顔ぶれ**を見る＝「増えた1件が合いびき肉であること」まで押さえる
  eq('MA-1 「ひき肉」で当たるのは、マスタのひき肉3件', filterMaster('ひき肉').sort(), [
    '合いびき肉',
    '豚ひき肉',
    '鶏ひき肉',
  ])
  eq(
    'MA-1 マスタの名前で絞ると、必ずその名前自身が出る（辞書を足して自分を落とさない）',
    masterNames.filter((name) => !filterMaster(name).includes(name)).length,
    0,
  )
  /*
   * 「絞り込みが緩くなっていないか」を数で押さえる（2026-08-28 便MA の実測）。
   *
   * マスタの名前を1つずつ検索語にすると、のべ266件が当たる＝**自分以外に当たる余分は53件**
   * （「ねぎ」で「長ねぎ」も出る類の、意図した前方一致・部分一致）。辞書に語を足しすぎて
   * 別の食材まで同じキーへ潰すと、この余分が増える。
   * 片側だけ（増えたら赤）にしてあるのは、マスタに食材を足すと自分ぶんは両辺に1つずつ乗って
   * 動かないため。**もし理由があって増えるなら、その理由を書いてこの数を上げること。**
   */
  const extraHits =
    masterNames.reduce((sum, name) => sum + filterMaster(name).length, 0) - masterNames.length
  eq('MA-1 同じ語で当たる「自分以外の行」が53件を超えない（絞り込みが緩くなっていない）', extraHits <= 53, true)
  // 別の食材が同じ照合キーへ潰れていないこと（潰れると、片方を探しても両方が出る）
  eq(
    'MA-1 213件の照合キーが213通りある（別の食材が同じキーに潰れていない）',
    new Set(masterNames.map((name) => toHiragana(name))).size,
    masterNames.length,
  )
  // 辞書を足したら READINGS_VERSION を上げる決まり（既存レシピの索引を作り直す引き金）
  eq('MA-1 読み仮名の版が9以上（辞書に足したら上げる決まり）', READINGS_VERSION >= 9, true)
}


// ---------- 便MJ（2026-08-29）: 「ひき肉」で絞ると合いびき肉だけ出なかった ----------
//
// 前の便（便MA）の申し送り:「『ひき肉』で絞ると今も合いびき肉は出ません
// （キーが `あいびきにく` で `ひきにく` を含まないため）。広げるなら価格の解決と
// 五十音順の並び位置に波及するので、単独で測ってから。」
//
// 直した中身: 読み仮名の辞書（src/logic/ingredientReadings.ts）で、合いびき肉の**集約先**が
// 濁音の「あいびきにく」だったため、検索語「ひき肉」の照合キー「ひきにく」を含んでいなかった
// （「あい**びき**にく」と「**ひき**にく」は1文字ずれる）。集約先を清音の「あいひきにく」に
// 揃えた。この辞書の目的は読みの正しさではなく**同じ食材が同じキーに収束すること**なので
// （ファイル冒頭の方針）、集約先が清音でも差し支えない。
//
// ここで見るのは4つ。①ひき肉の仲間が「ひき肉」で1つ残らず出る ②合いびき肉に届く書き方が
// 全部つながっている ③**絞り込みが緩くなっていない**（合いびき肉が出る語が、ひき肉を指す語だけ）
// ④便MAが名指しした2つの波及先（価格の解決・五十音順の並び位置）が動いていない。
{
  const { PRICE_DEFAULTS } = await import('../../src/data/priceDefaults.ts')
  const { buildPriceIndex, matchPriceEntry } = await import('../../src/logic/priceEstimate.ts')
  const masterNames = PRICE_DEFAULTS.map((e) => e.name)
  const filterMaster = (query) => {
    const q = toHiragana(query.trim())
    return masterNames.filter((name) => toHiragana(name).includes(q))
  }

  // ① ひき肉の仲間が、どの書き方で絞っても1つ残らず出る
  const MINCE_ROWS = ['合いびき肉', '豚ひき肉', '鶏ひき肉']
  for (const spelling of ['ひき肉', '挽き肉', '挽肉', 'ひきにく']) {
    eq(`MJ-1 「${spelling}」でマスタのひき肉が全部出る`, filterMaster(spelling).sort(), [...MINCE_ROWS].sort())
  }
  // ② 合いびき肉に届く書き方が、どれも同じ1件に着く（送り仮名・かな・濁点のちがいで切れない）
  for (const spelling of [
    '合いびき肉', '合い挽き肉', '合挽き肉', '合い挽肉', '合挽肉', 'あいびき肉', 'あいびきにく', 'あいびき',
  ]) {
    eq(`MJ-1 「${spelling}」で合いびき肉が出る`, filterMaster(spelling), ['合いびき肉'])
  }

  /*
   * ③ **緩くなっていないこと**。合いびき肉が当たるのは「ひき肉を指す語」だけで、
   * 別の食材を探しているときに割り込まない。
   * 語彙は、実際に検索語として打たれうるものを全部（マスタの名前・成分表の食品名と別名・
   * 同梱レシピの材料名・読み仮名辞書のキー）並べる＝**713語**。
   * 直す前の実測では 430件がのべで当たり、直したあとは 435件（+5）。
   * 増えたのは「ひき肉」「挽き肉」「挽肉」の3語に合いびき肉が1件ずつ（+3）と、
   * 辞書に足したかな書きの受け皿2語ぶん（+2）だけで、**別の食材が当たるようになった語は0件**。
   * 2026-09-01 便MT: マッシュルーム(08031)追加で 713語→714語・435→436件（+1）。
   * 増えたのは新しい別名「ホワイトマッシュルーム」が価格マスタの「マッシュルーム」に
   * 当たる1件だけで、別の食材が当たるようになった語は0件（実測）。
   */
  const { NUTRITION_DATA } = await import('../../src/logic/nutritionData.ts')
  const { starterDefs } = await import('../../src/db/starters.ts')
  const { INGREDIENT_READINGS } = await import('../../src/logic/ingredientReadings.ts')
  const vocab = new Set(masterNames)
  for (const food of NUTRITION_DATA.foods) {
    vocab.add(food.label)
    for (const alias of food.aliases ?? []) vocab.add(alias)
  }
  for (const def of starterDefs) for (const ing of def.ingredients ?? []) vocab.add(ing.name)
  for (const key of Object.keys(INGREDIENT_READINGS)) vocab.add(key)
  const words = [...vocab].filter((w) => w && w.trim())
  const mincePhrases = words.filter((w) => filterMaster(w).includes('合いびき肉')).sort()
  eq(
    'MJ-1 合いびき肉が出るのは、ひき肉を指す語だけ（関係ない食材の検索に割り込まない）',
    mincePhrases,
    [
      'あいびき', 'あいびきにく', 'あいびき肉', 'ひき肉', '合いびき', '合いびき肉',
      '合い挽き', '合い挽き肉', '合い挽肉', '合挽き', '合挽き肉', '合挽肉', '挽き肉', '挽肉',
    ],
  )
  eq(
    'MJ-1 語彙714語で当たる行がのべ436件を超えない（絞り込みが緩くなっていない）',
    words.reduce((sum, w) => sum + filterMaster(w).length, 0) <= 436,
    true,
  )

  /*
   * ④ 便MAが名指しした2つの波及先。**どちらも動いていないこと**を数で押さえる。
   *
   * 価格の解決: 同梱レシピの材料を1つずつ食材価格マスタに当て、当たった行の顔ぶれを見る。
   * 集約先を変えると両辺が同じ辞書を通るので結果は変わらないはずで、実測でも
   * 367行の差分は0件だった。ここでは合いびき肉の行が210円/100gの行に当たり続けることを見る。
   *
   * 五十音順: 「食材と価格」は読み仮名（toHiragana）で並べる（db/prices.ts の listPriceEntries）。
   * 「あいびきにく」も「あいひきにく」も同じ位置（213件中2番目）なので、並びは動かない。
   * 便FBが集約先を変えたときに並び位置が飛んだ事故があるので、位置そのものを見張る。
   */
  const priceIndex = buildPriceIndex(PRICE_DEFAULTS.map((e) => ({ ...e, isDefault: true })))
  eq(
    'MJ-1 合いびき肉の価格が、いままでどおりマスタの「合いびき肉」に解決する',
    matchPriceEntry('合いびき肉', priceIndex)?.normalizedName,
    '合いびき肉',
  )
  for (const spelling of ['合い挽き肉', '合挽肉', 'あいびき肉']) {
    eq(
      `MJ-1 「${spelling}」の価格も同じ行に解決する`,
      matchPriceEntry(spelling, priceIndex)?.normalizedName,
      '合いびき肉',
    )
  }
  const collator = new Intl.Collator('ja')
  const kanaOrder = [...masterNames].sort((a, b) => collator.compare(toHiragana(a), toHiragana(b)))
  eq('MJ-1 五十音順で合いびき肉が2番目のまま（並び位置が動いていない）', kanaOrder.indexOf('合いびき肉'), 1)
  eq('MJ-1 五十音順の先頭2件', kanaOrder.slice(0, 2), ['アーモンドエッセンス', '合いびき肉'])
  // 辞書を変えたら READINGS_VERSION を上げる決まり（保存済みレシピの索引を作り直す引き金）
  eq('MJ-1 読み仮名の版が10以上（集約先を変えたら上げる）', READINGS_VERSION >= 10, true)
}

/*
 * 便ND（2026-09-05）: レシピ一覧の上の「最近作っていないレシピ」の区画（logic/recipeShelf）。
 *
 * オーナー原文「しばらく作っていない棚は、自分で登録したレシピが優先で出るようにする、
 * 毎回同じ作っていないレシピが並ば内容にする、ようにしたい」への直訳:
 *  ・ND-1 境目は「最近作ってない」の絞り込みと同じ14日（cookedWithinDays を流用）
 *  ・ND-2 自作（!isStarter）が先。足りないぶんは同梱で埋め、自作0品でも並ぶ
 *  ・ND-3 一度も作っていない品も入り、先頭側（案A）
 *  ・ND-4 並びは種で決まる: 同じ種なら何度でも同じ／種が変われば変わる（日替わりの種）
 *  ・ND-5 上位10件まで・該当0件なら空（呼び出し側が区画ごと出さない）
 */
{
  const { pickShelfRecipes, shelfSeed, SHELF_MAX, SHELF_NOT_RECENT_DAYS } = await import(
    '../../src/logic/recipeShelf.ts'
  )
  // 「n日前」のYYYY-MM-DD（logic/date.ts の todayString と同じ組み立て方・ローカル時刻）。
  // 境目の日数そのもの(14日ちょうど)は時差で割れるので使わない＝13日と15日で両側から挟む
  const shelfDay = (daysAgo) => {
    const d = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const p = (v) => String(v).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  }
  const shelfRecipe = (id, { starter = false, cookedDaysAgo = null, updatedAt = id } = {}) => ({
    id,
    title: `棚テスト${id}`,
    isStarter: starter || undefined,
    updatedAt,
    cookedLogs: cookedDaysAgo === null ? [] : [{ date: shelfDay(cookedDaysAgo) }],
  })

  eq('ND-4 種は今日の日付（日替わり。E2E_FAKE_TODAYで固定できる形）', shelfSeed(), shelfDay(0))
  eq('ND-1 境目の日数は絞り込み「最近作ってない」と同じ14日', SHELF_NOT_RECENT_DAYS, 14)
  eq('ND-5 区画に出す上限は10品', SHELF_MAX, 10)

  const own15 = shelfRecipe(1, { cookedDaysAgo: 15 }) // 自作・15日前に作った → 出る
  const own13 = shelfRecipe(2, { cookedDaysAgo: 13 }) // 自作・13日前に作った → 出ない
  const ownNeverA = shelfRecipe(3) // 自作・一度も作っていない → 出る(先頭側)
  const ownNeverB = shelfRecipe(4)
  const starters = Array.from({ length: 12 }, (_, i) => shelfRecipe(101 + i, { starter: true }))
  const starter2d = shelfRecipe(113, { starter: true, cookedDaysAgo: 2 }) // 同梱・2日前 → 出ない
  const all = [own15, own13, ownNeverA, ownNeverB, ...starters, starter2d]

  const picked = pickShelfRecipes(all, '2026-09-05')
  const pickedIds = picked.map((r) => r.id)
  eq('ND-5 候補が上限を超えるときは10品ちょうど', picked.length, SHELF_MAX)
  eq('ND-1 13日前に作った品は出ない(14日の境目の内側)', pickedIds.includes(2), false)
  eq('ND-1 2日前に作った同梱の品も出ない', pickedIds.includes(113), false)
  eq('ND-1 15日前に作った品は出る(境目の外側)', pickedIds.includes(1), true)
  eq(
    'ND-3 一度も作っていない自作の品は出て、自作の中でも先頭側(上位2つ)',
    [...pickedIds.slice(0, 2)].sort((a, b) => a - b),
    [3, 4],
  )
  eq('ND-2 自作3品が同梱より前(3番目=15日前に作った自作)', pickedIds[2], 1)
  eq(
    'ND-2 残りは同梱の基本レシピで埋まる(7品。空のままevery合格に倒れない=LK-2)',
    pickedIds.slice(3).length === 7 && pickedIds.slice(3).every((id) => id >= 101 && id <= 112),
    true,
  )

  eq(
    'ND-4 同じ種なら何度選んでも同じ並び(開き直し・詳細から戻っても変わらない)',
    pickShelfRecipes(all, '2026-09-05').map((r) => r.id),
    pickedIds,
  )
  neq(
    'ND-4 種が変われば並びが変わる(毎回同じ並びにならない)',
    pickShelfRecipes(all, '2026-09-06').map((r) => r.id).join(','),
    pickedIds.join(','),
  )

  eq(
    'ND-2 自作が0品でも同梱で埋まって並ぶ(区画は消えない)',
    pickShelfRecipes(starters, '2026-09-05').length,
    SHELF_MAX,
  )
  eq(
    'ND-3 同梱の中でも「一度も作っていない」が「前に作った」より先(案A)',
    pickShelfRecipes(
      [shelfRecipe(202, { starter: true, cookedDaysAgo: 20 }), shelfRecipe(201, { starter: true })],
      '2026-09-05',
    ).map((r) => r.id),
    [201, 202],
  )
  eq(
    'ND-5 全部14日以内に作っていたら空(呼び出し側が区画ごと出さない)',
    pickShelfRecipes([shelfRecipe(1, { cookedDaysAgo: 0 }), shelfRecipe(2, { cookedDaysAgo: 13 })], '2026-09-05'),
    [],
  )
}
