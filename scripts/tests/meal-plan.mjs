// 献立（提案・週まとめ・日/週/月・ロック・navMemory）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, neq, scriptFileUrl } from './_harness.mjs'
import { pickDayCoverPhoto, setDayCoverChoice } from '../../src/logic/monthCover.ts'
import { diffDayEdit } from '../../src/logic/dayEdit.ts'
import {
  suggestCandidates,
  suggestForSlot,
  suggestPairForSlot,
  planWeekFill,
  isPastDate,
  shiftDate,
  dowIndex,
  sortMealSlots,
  sortMealGenres,
  toggleMealGenre,
  normalizePlanGenres,
  MEAL_GENRES,
  excludeYesterdayPlanRecipes,
  normalizeDateRange,
  rangeDayCount,
  proteinSourceOf,
  preferredProteinSources,
  isSlipperyDish,
  dishAvoidKeys,
  detectGenreMix,
  isMainDish,
  recipeGenre,
  cookedPlanEntryIds,
  mealOccasionCount,
  planRoleAssign,
  todayListPickedIds,
  todaySlotAddPlan,
  showsCookedPlanRowToday,
  staleTodayListFromPlanIds,
  recipeDishType,
  mealRoleForRecipe,
} from '../../src/logic/mealPlan.ts'
import { suggestionCandidates, DISH_TYPE_OPTIONS } from '../../src/logic/homeSuggest.ts'
import { preferSeasonWithFallback, SEASON_MIN_CANDIDATES } from '../../src/logic/season.ts'
import { backupFileName, selectedRecipesFileName } from '../../src/logic/fileSave.ts'
import { buildPriceIndex } from '../../src/logic/priceEstimate.ts'
import { summarizeRangeIntake, dayIntakeMap } from '../../src/logic/rangeSummary.ts'
import { MEAL_ROLES } from '../../src/db/types.ts'
import {
  WEEK_RETURN_KEY,
  WEEK_RETURN_PARAM,
  LAST_RECIPES_PATH_KEY,
  DAY_RETURN_KEY,
  MONTH_RETURN_KEY,
  MEAL_PLAN_TAB_TAP_KEY,
  DAY_SUGGEST_PIN_KEY,
  parseSuggestionPin,
  parseSuggestionPlanPin,
  parseViewReturn,
  parseWeekReturn,
  pickReturnAnchor,
  scrollTargetForAnchor,
  serializeSuggestionPin,
  serializeViewReturn,
  serializeWeekReturn,
} from '../../src/logic/navMemory.ts'
import {
  buildMonthDemoData,
  demoRecipeTitles,
  DEMO_PHOTO_KEYS,
  DEMO_TODAY,
} from '../../src/logic/monthDemo.ts'
import { starterDefs } from '../../src/db/starters.ts'
import {
  archiveFileName,
  buildArchiveDeleteConfirm,
  buildArchiveFile,
} from '../../src/logic/cookedArchive.ts'
import { ja } from '../../src/i18n/ja.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readdirSync, readFileSync } from 'node:fs'

// ---------- suggestForSlot(献立の自動提案の品質・2026-07-09ペルソナ第2波) ----------
{
  const mkRecipe = (id, over = {}) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
  const opts = (over = {}) => ({
    quickOnly: false,
    excludeNg: false,
    ngIngredients: [],
    usedRecipeIds: [],
    slot: 'dinner',
    season: 'summer',
    ...over,
  })
  // (a) 季節外レシピ(8月に冬タグのクリームシチュー等)は提案から除外する
  {
    const recipes = [mkRecipe(1, { season: 'winter' }), mkRecipe(2, { season: 'all' })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('提案: 季節外(冬)は夏に提案されない', picks.every((id) => id === 2), true)
  }
  eq('提案: 季節外しか無ければ提案なし', suggestForSlot([mkRecipe(1, { season: 'winter' })], opts()), undefined)
  eq('提案: 季節一致は提案される', suggestForSlot([mkRecipe(1, { season: 'summer' })], opts())?.id, 1)
  eq('提案: 季節未設定は除外されない', suggestForSlot([mkRecipe(1)], opts())?.id, 1)
  // (b) 夕食・昼食枠は主菜になりうるレシピ(汁物/サラダ/おやつタグ無し)を優先する
  {
    const recipes = [
      mkRecipe(1, { tags: ['汁物'] }),
      mkRecipe(2, { tags: ['サラダ'] }),
      mkRecipe(3, { tags: ['おやつ'] }),
      mkRecipe(4, { tags: ['和食'] }),
    ]
    const dinnerPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('提案: 夕食枠に汁物・サラダ・おやつ単品は出ない', dinnerPicks.every((id) => id === 4), true)
    const lunchPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ slot: 'lunch' }))?.id)
    eq('提案: 昼食枠も主菜を優先', lunchPicks.every((id) => id === 4), true)
  }
  // 主菜候補が足りないときだけ他を許可する(0件にはしない)
  eq('提案: 主菜が無ければ汁物でも提案する', suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts())?.id, 1)
  eq(
    '提案: 朝食枠は汁物等も普通に提案対象',
    suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts({ slot: 'breakfast' }))?.id,
    1,
  )

  // ---- 候補数の表示(2026-08-02 便DE-5) ----
  // suggestCandidates は「suggestForSlot が最後にくじを引く候補の一覧」をそのまま返す。
  // 画面の「候補◯品」がこの関数の件数なので、①絞り込みの結果と一致すること
  // ②suggestForSlot が返す品は必ずこの一覧に入っていること(＝提案の中身を変えていないこと)を固定する
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['汁物'] }),
      mkRecipe(3, { season: 'winter' }),
    ]
    const mainPool = suggestCandidates(recipes, opts({ role: 'main' }))
    eq('候補数: 主菜の候補は季節外・副菜系を除いた1品', mainPool.length, 1)
    eq('候補数: 主菜の候補の中身', mainPool[0].id, 1)
    const sidePool = suggestCandidates(recipes, opts({ role: 'side' }))
    eq('候補数: 副菜の候補は汁物の1品', sidePool.map((r) => r.id).join(','), '2')
    eq('候補数: 季節外しか無ければ0品', suggestCandidates([mkRecipe(9, { season: 'winter' })], opts()).length, 0)
    const poolIds = suggestCandidates(recipes, opts({ role: 'main' })).map((r) => r.id)
    const picked = Array.from({ length: 20 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq(
      '候補数: suggestForSlot は必ず候補一覧の中から選ぶ',
      picked.every((id) => poolIds.includes(id)),
      true,
    )
  }

  // ---- 汁物・その他の区分(2026-08-02 便DE-4) ----
  // 汁物の行は副菜と同じ候補プール(dishType: side/soup)から選び、寄せる種別だけが違う。
  // 「その他」の行は分類の受け皿なので役割で絞らない(デザートも選べる)
  {
    const soup = mkRecipe(1, { title: 'わかめのみそ汁', dishType: 'soup' })
    const side = mkRecipe(2, { title: 'ほうれん草のおひたし', dishType: 'side' })
    const main = mkRecipe(3, { title: '豚の生姜焼き', dishType: 'main' })
    const dessert = mkRecipe(4, { title: '水ようかん', dishType: 'dessert' })
    const pool = [soup, side, main, dessert]
    eq(
      'role:soup は主菜・デザートを候補にしない',
      suggestCandidates(pool, opts({ role: 'soup' })).map((r) => r.id).sort().join(','),
      '1,2',
    )
    eq(
      'role:soup + preferDishType:soup は汁物だけに寄せる',
      suggestCandidates(pool, opts({ role: 'soup', preferDishType: 'soup' })).map((r) => r.id).join(','),
      '1',
    )
    eq(
      'role:other は役割で絞らない(デザートも候補になる)',
      suggestCandidates(pool, opts({ role: 'other' })).length,
      4,
    )
  }

  // ---- role指定・ジャンル優先・ペア提案(2026-07-13献立の主菜+副菜構成) ----

  // role:'side'は副菜系タグ(汁物/サラダ。「副菜」専用タグは無いため代用。おやつは含めない=
  // 2026-07-13 Fable裁定)の品を優先する
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'side' }))?.id)
    eq('role:side は副菜系タグの品を優先する', picks.every((id) => id === 2), true)
  }
  // 副菜枠におやつは提案しない(夕食の副菜に杏仁豆腐が出るのを防ぐ。2026-07-13 Fable裁定)
  {
    const recipes = [mkRecipe(1, { tags: ['おやつ'] }), mkRecipe(2, { tags: ['サラダ'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'side' }))?.id)
    eq('role:side はおやつを提案しない', picks.every((id) => id === 2), true)
  }
  // role:'main'は副菜系タグを含まない品を優先する(従来のdinner/lunch挙動と同じロジックを流用)
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('role:main は副菜系タグを含まない品を優先する', picks.every((id) => id === 1), true)
  }
  // role省略時は従来どおり(後方互換): dinner/lunch枠だけ主菜優先、それ以外は区別しない
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['汁物'] })]
    const dinnerPicks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts())?.id)
    eq('role省略(後方互換): dinner枠は主菜優先のまま', dinnerPicks.every((id) => id === 1), true)
    eq(
      'role省略(後方互換): breakfast枠は汁物タグ品も普通に提案される',
      suggestForSlot([mkRecipe(1, { tags: ['汁物'] })], opts({ slot: 'breakfast' }))?.id,
      1,
    )
  }
  // ---- dishType優先・タグへのフォールバック(2026-07-13 dishType導入・献立の主菜+副菜提案精度向上) ----

  // dishTypeがあれば最優先で使う: タグに副菜系タグ(汁物)があってもdishType:'main'なら主菜候補になり、
  // 逆にタグは副菜系を含まなくてもdishType:'side'なら主菜候補にならない(旧タグ判定なら結果が逆転する組み合わせ)
  {
    const recipes = [
      mkRecipe(1, { tags: ['汁物'], dishType: 'main' }),
      mkRecipe(2, { tags: ['和食'], dishType: 'side' }),
    ]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('dishType優先: dishTypeがタグより優先される(タグ汁物でもdishType:mainなら主菜候補)', picks.every((id) => id === 1), true)
  }

  // dishType未設定のレシピ(ユーザー自作)は現行のタグヒューリスティックにフォールバックする(既存挙動を維持)
  {
    const recipes = [mkRecipe(1, { tags: ['汁物'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ role: 'main' }))?.id)
    eq('dishType未設定はタグヒューリスティックにフォールバックする(既存挙動維持)', picks.every((id) => id === 2), true)
  }

  // dishType:'dessert'は主菜からも副菜からも除外される(タグが「定番」のみでdishType側が最終判定になる)
  {
    const mainPickRecipes = [
      mkRecipe(1, { tags: ['定番'], dishType: 'dessert' }),
      mkRecipe(2, { tags: ['和食'], dishType: 'main' }),
    ]
    const mainPicks = Array.from(
      { length: 10 },
      () => suggestForSlot(mainPickRecipes, opts({ role: 'main' }))?.id,
    )
    eq('dishType:dessert は主菜候補から除外される', mainPicks.every((id) => id === 2), true)

    const sidePickRecipes = [
      mkRecipe(1, { tags: ['定番'], dishType: 'dessert' }),
      mkRecipe(3, { tags: ['和食'], dishType: 'side' }),
    ]
    const sidePicks = Array.from(
      { length: 10 },
      () => suggestForSlot(sidePickRecipes, opts({ role: 'side' }))?.id,
    )
    eq('dishType:dessert は副菜候補からも除外される', sidePicks.every((id) => id === 3), true)
  }

  // 本件の眼目: きんぴら等の「作り置き副菜」はタグ(作り置き/お弁当等)だけでは副菜と判別できず
  // 従来は主菜側に混ざっていたが、dishType:'side'を明示すれば副菜枠に提案されるようになる
  {
    const kinpira = mkRecipe(1, {
      title: 'きんぴらごぼう',
      tags: ['和食', '作り置き', 'お弁当'],
      dishType: 'side',
    })
    const mainDish = mkRecipe(2, { tags: ['和食', '定番'], dishType: 'main' })
    const picks = Array.from(
      { length: 10 },
      () => suggestForSlot([kinpira, mainDish], opts({ role: 'side' }))?.id,
    )
    eq('dishType: きんぴら(dishType:side・作り置きタグのみ)が副菜枠に提案される', picks.every((id) => id === 1), true)
  }

  // genre優先: 指定ジャンルのタグを持つ品を優先し、一致が無ければ他ジャンルも許可する
  {
    const recipes = [mkRecipe(1, { tags: ['洋食'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () => suggestForSlot(recipes, opts({ genre: '和食' }))?.id)
    eq('genre指定: 一致するジャンルの品を優先する', picks.every((id) => id === 2), true)
  }
  eq(
    'genre指定: 一致が無ければ他ジャンルも提案する(0件にしない)',
    suggestForSlot([mkRecipe(1, { tags: ['洋食'] })], opts({ genre: '和食' }))?.id,
    1,
  )
  // 高たんぱく優先の削除(2026-08-09 便EO・オーナー指示)の再発防止。
  // 「高たんぱく」タグはレシピ側に残しているが、提案の絞り込みには一切効かせない。
  // 候補の一覧(suggestCandidates)にタグ有り・タグ無しの両方が残ることで確かめる
  // (優先が復活すると、タグ無しの品が候補から落ちて1品だけになる)
  {
    const recipes = [mkRecipe(1, { tags: [] }), mkRecipe(2, { tags: ['高たんぱく'] })]
    eq(
      '高たんぱく: タグの有無で提案の候補を絞り込まない(削除済み)',
      suggestCandidates(recipes, opts()).map((r) => r.id).sort().join(','),
      '1,2',
    )
    eq(
      '高たんぱく: 廃止した preferHighProtein を渡しても候補は変わらない',
      suggestCandidates(recipes, opts({ preferHighProtein: true })).map((r) => r.id).sort().join(','),
      '1,2',
    )
  }

  // suggestPairForSlot: 主菜+副菜をペアで返し、ジャンル未指定なら主菜と同じジャンルの副菜を優先する
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }), // 和食の主菜候補(側菜タグ無し)
      mkRecipe(2, { tags: ['洋食', 'サラダ'] }), // 洋食の副菜候補
      mkRecipe(3, { tags: ['和食', '汁物'] }), // 和食の副菜候補
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案: 主菜が選ばれる', results.every((r) => r.main?.id === 1), true)
    eq(
      'ペア提案(和洋中の整合): 主菜と同じジャンル(和食)の副菜が優先される',
      results.every((r) => r.side?.id === 3),
      true,
    )
  }
  // ジャンル指定時は主菜・副菜の両方にそのジャンルの優先が適用される
  {
    const recipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食'] }),
      mkRecipe(3, { tags: ['和食', '汁物'] }),
      mkRecipe(4, { tags: ['洋食', 'サラダ'] }),
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts({ genre: '洋食' })))
    eq('ペア提案: ジャンル指定時は主菜も指定ジャンルが優先される', results.every((r) => r.main?.id === 2), true)
    eq('ペア提案: ジャンル指定時は副菜も指定ジャンルが優先される', results.every((r) => r.side?.id === 4), true)
  }

  // ---- IY: 料理のジャンルを複数選べるようにする(2026-08-22 便IY) ----
  // オーナー原文「週献立は、「料理のジャンル」は複数選択のほうがいいかも。１つしか選べないと、
  // １週間中華だけ、という献立しか組めない。全てを選ぶと、中華は入れたくないけど和洋食は
  // 混在させたい、ができない。」
  // 測るのは「利用者が確かめたいこと」＝選んだジャンルの中から出るか・1つだけ選んだときは
  // これまでと同じか・0件で終わらないか・1食の中は主菜に寄るか。
  {
    const genreRecipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食'] }),
      mkRecipe(3, { tags: ['中華'] }),
      mkRecipe(4, { tags: [] }), // ジャンルタグの無い品(どのジャンルにも合う万能枠)
    ]
    const idsOf = (list) => list.map((r) => r.id).sort((a, b) => a - b).join(',')
    // IY-1 は 2026-08-24 便KK で**向きを立て直した**。
    // 便IYのときは「その2つのジャンルの品だけが候補になる」＝タグ無しの品(id 4)も落ちることを
    // 固定していたが、それが「取り込んだ品が全部消える」を守る形になっていた
    // （取り込んだレシピにはジャンルタグが1件も付かない。実測90品すべて0件）。
    // 測るのは「**選ばなかったジャンルが落ちること**」と「**タグ無しの品は落ちないこと**」の2つに分ける
    eq(
      'IY-1 ジャンルを2つ選ぶと、選ばなかったジャンル(中華)の品は候補から外れる',
      suggestCandidates(genreRecipes, opts({ genres: ['和食', '洋食'] })).some((r) =>
        r.tags.includes('中華'),
      ),
      false,
    )
    eq(
      'IY-1 ジャンルを2つ選んでも、ジャンルタグの無い品は落とさない(どのジャンルにも合う万能枠)',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['和食', '洋食'] }))),
      '1,2,4',
    )
    eq(
      'IY-2 ジャンルを1つだけ選んだときは、これまでの単一指定(genre)と同じ候補になる',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['中華'] }))),
      idsOf(suggestCandidates(genreRecipes, opts({ genre: '中華' }))),
    )
    eq(
      'IY-3 ジャンルを全部選んだ状態は「指定なし」と同じ(ジャンルタグの無い品も候補に残る)',
      idsOf(suggestCandidates(genreRecipes, opts({ genres: ['和食', '洋食', '中華'] }))),
      idsOf(suggestCandidates(genreRecipes, opts())),
    )
    eq(
      'IY-4 選んだジャンルの品が1つも無ければ絞り込みを解く(0件で終わらせない)',
      suggestCandidates([mkRecipe(1, { tags: ['洋食'] })], opts({ genres: ['和食', '中華'] })).length,
      1,
    )
    eq(
      'IY-5 選んだジャンルが1つも読み取れない値でも候補は消えない(0件で終わらせない)',
      suggestCandidates(genreRecipes, opts({ genres: [] })).length,
      genreRecipes.length,
    )
  }
  // 1食の中は主菜のジャンルに寄せる(司令部の裁定③: 週の中の混在は止めないが、
  // 主菜と副菜は揃うほうを先に試す。揃わなければ混ざり、「主菜と別ジャンル」の印が知らせる)
  {
    const pairRecipes = [
      mkRecipe(1, { tags: ['和食'] }), // 和食の主菜候補
      mkRecipe(2, { tags: ['和食', '汁物'] }), // 和食の副菜候補
      mkRecipe(3, { tags: ['洋食', 'サラダ'] }), // 洋食の副菜候補
      mkRecipe(4, { tags: ['中華'] }), // 選んでいないジャンルの主菜候補(出てはいけない)
    ]
    // 主菜の候補そのものを見る(抽選の運に左右されない形で「絞り込みが効いたか」を測る)
    eq(
      'IY-6 複数選択でも、主菜の候補は選んだジャンルだけになる(選ばなかった中華は出ない)',
      suggestCandidates(pairRecipes, opts({ genres: ['和食', '洋食'], role: 'main' }))
        .map((r) => r.id)
        .sort((a, b) => a - b)
        .join(','),
      '1',
    )
    const results = Array.from({ length: 10 }, () =>
      suggestPairForSlot(pairRecipes, opts({ genres: ['和食', '洋食'] })),
    )
    eq('IY-6 複数選択でも、主菜は選んだジャンルから出る', results.every((r) => r.main?.id === 1), true)
    eq(
      'IY-6 複数選択でも、1食の中の副菜は主菜と同じジャンルが優先される',
      results.every((r) => r.side?.id === 2),
      true,
    )
  }
  // 主菜のジャンルの副菜が無ければ、選んだ別ジャンルの副菜で埋める(混ぜてでも埋める＝
  // 「主菜と別ジャンル」の印が出る側に倒す。detectGenreMix はこれまでどおり)
  {
    const mixRecipes = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食', 'サラダ'] }),
    ]
    const pair = suggestPairForSlot(mixRecipes, opts({ genres: ['和食', '洋食'] }))
    eq('IY-7 主菜と同じジャンルの副菜が無ければ、選んだ別ジャンルの副菜で埋める', pair.side?.id, 2)
    eq(
      'IY-7 その枠は「主菜と別ジャンル」と判定される(印はこれまでどおり出る)',
      detectGenreMix(pair.main, pair.side ? [pair.side] : []),
      true,
    )
  }
  // ジャンルの選び方そのもの(画面が使う純関数)。「最後の1つは外せない」はここで守る
  eq('IY-8 ジャンルの並びは押した順ではなく、選べる並び(和食→洋食→中華)にそろう',
    sortMealGenres(['中華', '和食']).join(','), '和食,中華')
  eq('IY-8 同じジャンルが重なっても1つに数える',
    sortMealGenres(['洋食', '洋食']).join(','), '洋食')
  eq('IY-9 選んでいないジャンルを押すと足される',
    toggleMealGenre(['和食'], '中華').join(','), '和食,中華')
  eq('IY-9 選んでいるジャンルを押すと外れる',
    toggleMealGenre([...MEAL_GENRES], '中華').join(','), '和食,洋食')
  eq('IY-9 最後の1つを押しても外れない(1つも選んでいない状態を作らせない)',
    toggleMealGenre(['和食'], '和食').join(','), '和食')
  eq('IY-9 足したあとも並びは選べる並びのまま(押した順に散らからない)',
    toggleMealGenre(['中華'], '和食').join(','), '和食,中華')
  // 保存された設定の読み替え(2026-08-22 便IY・司令部裁定B案)。
  // レシピ一覧のタグ絞り込み(便HZ・③ pages/RecipesPage.tsx)と同じ作法で、
  // **1つだけ選んでいた古い値も1件として読む**。壊れた値で候補を消さないことも見る
  eq('IY-10 保存が無い(これまでの利用者)ときは3つとも選んだ状態＝指定なし',
    normalizePlanGenres(undefined).join(','), MEAL_GENRES.join(','))
  eq('IY-10 1つだけ選んで保存されていた値は、その1つを選んだ状態として読む',
    normalizePlanGenres(['中華']).join(','), '中華')
  eq('IY-10 1つだけの値が配列でなく素の文字で保存されていても、1件として読む',
    normalizePlanGenres('洋食').join(','), '洋食')
  eq('IY-10 知らないジャンル名しか入っていなければ3つとも選んだ状態に倒す(候補を消さない)',
    normalizePlanGenres(['ロシア料理']).join(','), MEAL_GENRES.join(','))
  eq('IY-10 空の配列でも候補を消さない',
    normalizePlanGenres([]).join(','), MEAL_GENRES.join(','))
  eq('IY-10 数値など読み取れない値でも候補を消さない',
    normalizePlanGenres(0).join(','), MEAL_GENRES.join(','))
  eq('IY-10 知っているジャンルと知らない名前が混ざっていたら、知っているほうだけを読む',
    normalizePlanGenres(['ロシア料理', '和食']).join(','), '和食')
  eq('IY-10 保存の並びが崩れていても、選べる並びにそろえて読む',
    normalizePlanGenres(['中華', '和食']).join(','), '和食,中華')


  // ---- KK: ジャンルで絞っても、ジャンルタグを持たない品は落とさない ----
  // (2026-08-24 便KK・オーナー裁定B案「タグを持たない品は『どのジャンルにも合う』として落とさない」)
  //
  // 何が起きていたか(実データ90品＋同梱109品での実測):
  //   自分の取り込んだ品だけ … 「和食だけ」を選んでも絞られない(0件緩和で全部出る)
  //   同梱109品が入った実運用 … 「和食だけ」を選ぶと自分の品が0件になる
  // 取り込んだ90品にはジャンルタグが1件も付かないため、**同じボタンが状況で正反対に効いていた**。
  //
  // アプリはもともと「ジャンルタグの無い品はどのジャンルにも合う万能枠」という考え方を採っている
  // (detectGenreMix は「主菜と別ジャンル」の印にタグ無しを数えない)。同じ考え方を絞り込みにも当てる。
  // **選ばなかったジャンルのタグが付いた品は今までどおり落ちる**(「中華は入れたくない」は守る)。
  {
    const kkList = [
      mkRecipe(1, { tags: ['和食'] }),
      mkRecipe(2, { tags: ['洋食'] }),
      mkRecipe(3, { tags: ['中華'] }),
      mkRecipe(4, { tags: [] }), // 取り込んだ品(タグ0件)
      mkRecipe(5, { tags: ['作り置き'] }), // ジャンル以外のタグだけ付いた品
    ]
    const kkIds = (list) => list.map((r) => r.id).sort((a, b) => a - b).join(',')
    eq(
      'KK-1 ジャンルを1つ選んでも、ジャンルタグの無い品は候補に残る',
      kkIds(suggestCandidates(kkList, opts({ genres: ['和食'] }))),
      '1,4,5',
    )
    eq(
      'KK-1 ジャンルを2つ選んだときも、ジャンルタグの無い品は候補に残る',
      kkIds(suggestCandidates(kkList, opts({ genres: ['和食', '洋食'] }))),
      '1,2,4,5',
    )
    eq(
      'KK-2 選ばなかったジャンルのタグが付いた品は落ちる(中華を外せば中華の品は出ない)',
      suggestCandidates(kkList, opts({ genres: ['和食', '洋食'] })).some((r) => r.tags.includes('中華')),
      false,
    )
    // 0件緩和の崖: タグの付いた品が1品でも混ざると、タグ無しの品が全部消えていた。
    // 「タグ無しの品が何品残るか」は、まわりにタグ付きの品があるかどうかで変わってはいけない
    {
      const onlyTagless = [mkRecipe(4, { tags: [] }), mkRecipe(5, { tags: ['作り置き'] })]
      const taglessLeft = (list) =>
        suggestCandidates(list, opts({ genres: ['和食'] })).filter((r) => r.tags.every((t) => !MEAL_GENRES.includes(t)))
          .length
      eq(
        'KK-3 タグ無しの品が何品残るかは、タグ付きの品が混ざっても変わらない(0件緩和の崖が立たない)',
        [taglessLeft(onlyTagless), taglessLeft(kkList)],
        [2, 2],
      )
    }
    eq(
      'KK-4 絞り込みの考え方は「主菜と別ジャンル」の印(detectGenreMix)とそろえる＝タグ無しは万能枠',
      [
        detectGenreMix({ tags: ['和食'] }, [{ tags: [] }]),
        suggestCandidates([mkRecipe(4, { tags: [] })], opts({ genres: ['和食'] })).length,
      ],
      [false, 1],
    )
    // 1食の中で副菜を主菜のジャンルに寄せる側(options.genre)も同じ考え方にそろえる。
    // ここを直さないと、同梱レシピのように和食タグの副菜がある限り、取り込んだ品は副菜に出ない
    eq(
      'KK-5 主菜のジャンルに寄せるときも、タグ無しの品は「そろっている」として残す',
      kkIds(suggestCandidates(kkList, opts({ genre: '和食' }))),
      '1,4,5',
    )
  }
  // ---- 便BH-2: 一品もの・副菜純化・たんぱく源分散・ジャンル混在(docs/56) ----

  // 一品もの(丼・麺・鍋・カレー・シチュー)の主菜が選ばれた枠は副菜を空ける(主菜1品で完結)
  {
    // 主菜候補は一品ものだけ(カレー=タイトルで一品もの判定)。副菜候補も用意しておく
    const recipes = [
      mkRecipe(1, { title: 'カレーライス', tags: ['洋食', 'ご飯もの'] }),
      mkRecipe(2, { title: 'ポテトサラダ', tags: ['洋食', 'サラダ'], dishType: 'side' }),
    ]
    const results = Array.from({ length: 10 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案(一品もの): カレーが主菜に選ばれる', results.every((r) => r.main?.id === 1), true)
    eq('ペア提案(一品もの): 一品ものの主菜には副菜を付けない', results.every((r) => r.side === undefined), true)
  }

  // 副菜スロットは純粋な副菜(dishType:'side')に寄せる。汁物(dishType:'soup')は副菜より後回し
  {
    const recipes = [
      mkRecipe(1, { title: '味噌汁', tags: ['和食'], dishType: 'soup' }),
      mkRecipe(2, { title: 'ほうれん草のおひたし', tags: ['和食'], dishType: 'side' }),
    ]
    const picks = Array.from({ length: 12 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side' }))?.id,
    )
    eq('副菜純化: preferDishType=side は汁物(soup)より純粋な副菜(side)を優先する', picks.every((id) => id === 2), true)
  }
  // 純粋な副菜が無ければ緩和して汁物も副菜として許す(0件回避)
  eq(
    '副菜純化: 純粋な副菜が無ければ汁物(soup)を副菜として許す',
    suggestForSlot([mkRecipe(1, { title: '味噌汁', tags: ['和食'], dishType: 'soup' })], opts({ role: 'side', preferDishType: 'side' }))?.id,
    1,
  )

  // たんぱく源分散: preferProteinSources に挙げたソースの主菜を優先する(該当0件なら緩和)
  {
    const recipes = [
      mkRecipe(1, { title: '豚の生姜焼き', tags: ['和食'], dishType: 'main' }), // 肉
      mkRecipe(2, { title: '鮭の塩焼き', tags: ['和食'], dishType: 'main' }), // 魚
    ]
    const picks = Array.from({ length: 12 }, () =>
      suggestForSlot(recipes, opts({ role: 'main', preferProteinSources: ['魚'] }))?.id,
    )
    eq('たんぱく源分散: 魚を優先すると魚の主菜が選ばれる', picks.every((id) => id === 2), true)
  }
  eq(
    'たんぱく源分散: 指定ソースの主菜が無ければ緩和して他も提案する(0件にしない)',
    suggestForSlot([mkRecipe(1, { title: '豚の生姜焼き', dishType: 'main' })], opts({ role: 'main', preferProteinSources: ['魚'] }))?.id,
    1,
  )

  // proteinSourceOf: アイコン流用でたんぱく源を判定する(一品ものは主材料スキャン)
  eq('proteinSourceOf: 鮭の塩焼き→魚', proteinSourceOf({ title: '鮭の塩焼き', tags: [], ingredients: [{ name: '生鮭' }] }), '魚')
  eq('proteinSourceOf: だし巻き卵→卵', proteinSourceOf({ title: 'だし巻き卵', tags: [], ingredients: [{ name: '卵' }] }), '卵')
  eq('proteinSourceOf: 麻婆豆腐→豆腐', proteinSourceOf({ title: '麻婆豆腐', tags: [], ingredients: [{ name: '木綿豆腐' }] }), '豆腐')
  eq('proteinSourceOf: 豚の生姜焼き→肉', proteinSourceOf({ title: '豚の生姜焼き', tags: [], ingredients: [{ name: '豚ロース' }] }), '肉')
  eq('proteinSourceOf: 鶏の唐揚げ→肉', proteinSourceOf({ title: '鶏の唐揚げ', tags: [], ingredients: [{ name: '鶏もも肉' }] }), '肉')
  // 一品もの(丼)はアイコンがrice(主食)に寄るので主材料からたんぱく源を拾う
  eq(
    'proteinSourceOf: 牛丼→肉(一品ものは主材料スキャン)',
    proteinSourceOf({ title: '牛丼', tags: ['ご飯もの'], ingredients: [{ name: 'ご飯', amount: '300', unit: 'g' }, { name: '牛薄切り肉', amount: '200', unit: 'g' }] }),
    '肉',
  )
  eq('proteinSourceOf: 野菜中心はその他', proteinSourceOf({ title: 'きんぴらごぼう', tags: [], ingredients: [{ name: 'ごぼう' }] }), 'その他')

  // detectGenreMix: 主菜のジャンルと副菜/汁物のジャンルが食い違うか(混在バッジ用)
  eq(
    'detectGenreMix: 主菜和食+副菜中華は混在',
    detectGenreMix({ tags: ['和食'] }, [{ tags: ['中華'] }]),
    true,
  )
  eq(
    'detectGenreMix: 主菜和食+副菜和食は混在でない',
    detectGenreMix({ tags: ['和食'] }, [{ tags: ['和食'] }]),
    false,
  )
  eq(
    'detectGenreMix: ジャンルタグの無い副菜は万能枠=混在に数えない',
    detectGenreMix({ tags: ['和食'] }, [{ tags: [] }]),
    false,
  )
  eq('detectGenreMix: 主菜が無ければ混在なし', detectGenreMix(undefined, [{ tags: ['中華'] }]), false)
  eq('detectGenreMix: 主菜にジャンルが無ければ混在なし', detectGenreMix({ tags: [] }, [{ tags: ['中華'] }]), false)

  // isMainDish / recipeGenre: 外部公開の主菜判定・ジャンル取得(「今日なに作る?」等が使う)
  eq('isMainDish: dishType:main は主菜', isMainDish(mkRecipe(1, { dishType: 'main' })), true)
  eq('isMainDish: dishType:side は主菜でない', isMainDish(mkRecipe(1, { dishType: 'side' })), false)
  eq('isMainDish: dishType:dessert は主菜でない', isMainDish(mkRecipe(1, { dishType: 'dessert' })), false)
  eq('isMainDish: dishType未設定はタグヒューリスティック(汁物タグは主菜でない)', isMainDish(mkRecipe(1, { tags: ['汁物'] })), false)
  eq('recipeGenre: 和食タグ→和食', recipeGenre({ tags: ['定番', '和食'] }), '和食')
  eq('recipeGenre: ジャンルタグ無し→undefined', recipeGenre({ tags: ['定番'] }), undefined)

  // ---- ランダム週献立の保護2点(2026-07-16 便W-⑤・オーナー指示2026-07-16夜) ----

  // (a) 過去日不変: isPastDateは今日より前の日付だけtrueを返す(MealPlanPage側のfillWeek/
  // suggestRowはこれで過去日の枠を素通りする＝upsertしない。ここでは判定の純ロジックだけを検証)
  eq('過去日判定: 今日より前はtrue', isPastDate('2026-07-15', '2026-07-16'), true)
  eq('過去日判定: 今日はfalse(対象に含める)', isPastDate('2026-07-16', '2026-07-16'), false)
  eq('過去日判定: 今日より後はfalse', isPastDate('2026-07-17', '2026-07-16'), false)
  eq('shiftDate: 1日前(月またぎ)を正しく計算', shiftDate('2026-08-01', -1), '2026-07-31')
  eq('shiftDate: 1日後(年またぎ)を正しく計算', shiftDate('2025-12-31', 1), '2026-01-01')

  // (b) 昨日除外: 候補から昨日の週プランに入っていたレシピを除外する
  {
    const recipes = [mkRecipe(1, { tags: ['和食'] }), mkRecipe(2, { tags: ['和食'] })]
    const picks = Array.from({ length: 10 }, () =>
      suggestForSlot(recipes, opts({ yesterdayRecipeIds: [1] }))?.id,
    )
    eq('昨日除外: 昨日食べたレシピは候補から外れる', picks.every((id) => id === 2), true)
  }
  // 尽きたら解除: 除外すると候補が0件になる場合は除外を解いて提案する(空振りより重複がマシ)
  eq(
    '昨日除外: 候補が尽きる場合は除外を解除して提案する',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts({ yesterdayRecipeIds: [1] }))?.id,
    1,
  )
  // yesterdayRecipeIds未指定(従来呼び出し)は何も除外しない(後方互換)
  eq(
    '昨日除外: yesterdayRecipeIds省略時は従来どおり除外しない',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts())?.id,
    1,
  )
  // ---- 2026-07-29 便CD: PDCA2周目・献立診断の再発防止 ----

  // MP-02 曜日ラベル: 曜日は必ず日付から引く(月曜始まり 0=月 … 6=日)。
  // 以前は7日カードの並び順(配列インデックス)で引いており、「今日から7日間」表示では
  // 今日が月曜の日以外は全行の曜日が嘘になっていた
  eq('dowIndex: 2026-07-27(月)→0', dowIndex('2026-07-27'), 0)
  eq('dowIndex: 2026-07-29(水)→2', dowIndex('2026-07-29'), 2)
  eq('dowIndex: 2026-08-02(日)→6', dowIndex('2026-08-02'), 6)
  eq('dowIndex: 月をまたいでも日付から引ける(2026-08-01=土)', dowIndex('2026-08-01'), 5)
  {
    // 「今日から7日間」の再現: 水曜起点で7日並べると 水木金土日月火 になる(並び順とは一致しない)
    const rolling = Array.from({ length: 7 }, (_, i) => dowIndex(shiftDate('2026-07-29', i)))
    eq('dowIndex: 今日(水)起点の7日間は 水木金土日月火 の順になる', rolling, [2, 3, 4, 5, 6, 0, 1])
    eq('dowIndex: 並び順インデックスとは一致しない(旧実装の再発防止)', rolling.every((d, i) => d === i), false)
  }

  // MP-10 食事帯の並び: 押した順ではなく必ず 朝食→昼食→夕食 の順にする
  eq('sortMealSlots: 押した順(夕→朝→昼)でも朝昼夕に並べ直す', sortMealSlots(['dinner', 'breakfast', 'lunch']), ['breakfast', 'lunch', 'dinner'])
  eq('sortMealSlots: 既に正しい順はそのまま', sortMealSlots(['breakfast', 'dinner']), ['breakfast', 'dinner'])
  eq('sortMealSlots: 1件でも壊れない', sortMealSlots(['dinner']), ['dinner'])
  {
    const original = ['dinner', 'breakfast']
    sortMealSlots(original)
    eq('sortMealSlots: 元の配列を書き換えない(設定値を壊さない)', original, ['dinner', 'breakfast'])
  }

  // MP-03 たんぱく源分散の絞り込み: 'その他'を候補に入れ、「最少ちょうど」から「最少+1まで」に緩める。
  // 以前は'その他'が抜けていたため、たんぱく源が'その他'と判定される主菜8品
  // (ツナキャベツ丼・ペペロンチーノ・寄せ鍋・クリームシチュー等)が まとめて献立 から
  // 構造的に出なくなっていた(0/100枠)。docs/56 §3-6「軽く優先・厳格化しない」への復帰
  eq(
    'preferredProteinSources: 「その他」が候補から消えない(まとめて献立で出なくなる欠陥の再発防止)',
    preferredProteinSources({ 肉: 0, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }).includes('その他'),
    true,
  )
  eq(
    'preferredProteinSources: 最少+1までを候補にする(強制ローテーションにしない)',
    preferredProteinSources({ 肉: 2, 魚: 1, 卵: 0, 豆腐: 3, その他: 1 }),
    ['魚', '卵', 'その他'],
  )
  eq(
    'preferredProteinSources: 使用数が並んでいれば全ソースが候補',
    preferredProteinSources({ 肉: 1, 魚: 1, 卵: 1, 豆腐: 1, その他: 1 }),
    ['肉', '魚', '卵', '豆腐', 'その他'],
  )
  eq(
    'preferredProteinSources: 肉に偏っていれば肉は候補から外れる(分散機能は死なない)',
    preferredProteinSources({ 肉: 5, 魚: 0, 卵: 0, 豆腐: 0, その他: 0 }).includes('肉'),
    false,
  )

  // MP-04 同じ食事の中での食材・食感の重複回避。差し替え理由の69%がこのクラスタだった
  eq('isSlipperyDish: しらたきはつるっと系', isSlipperyDish({ title: 'しらたきのチャプチェ風', ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: 春雨はつるっと系', isSlipperyDish({ title: '春雨サラダ', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: こんにゃくはつるっと系', isSlipperyDish({ title: 'こんにゃくの炒り煮', ingredients: [{ name: 'こんにゃく', amount: '100', unit: 'g' }] }), true)
  eq('isSlipperyDish: 普通の副菜はつるっと系でない', isSlipperyDish({ title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草', amount: '100', unit: 'g' }] }), false)
  eq(
    'dishAvoidKeys: 主菜のたんぱく源と食感がキーになる',
    dishAvoidKeys({ title: 'しらたきのチャプチェ風', tags: ['中華'], ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }, { name: '牛切り落とし肉', amount: '100', unit: 'g' }] }),
    ['protein:肉', 'texture:つるっと'],
  )
  eq(
    'dishAvoidKeys: 「その他」(野菜が主役)はキーにしない(副菜がほぼ全滅して絞り込みにならないため)',
    dishAvoidKeys({ title: 'きんぴらごぼう', tags: ['和食'], ingredients: [{ name: 'ごぼう', amount: '100', unit: 'g' }] }),
    [],
  )
  {
    // 中華の副菜3品を再現し、つるっと系(春雨サラダ)が後回しになることを確認する
    const recipes = [
      mkRecipe(1, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '野菜炒め', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
      mkRecipe(3, { title: '蒸しなすの香味だれ', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'なす', amount: '100', unit: 'g' }] }),
    ]
    const picks = Array.from({ length: 20 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side', avoidKeys: ['protein:肉', 'texture:つるっと'] }))?.id,
    )
    eq('avoidKeys: つるっと系の主菜のとき、つるっと系の副菜(春雨サラダ)は出ない', picks.includes(1), false)
    eq('avoidKeys: 残り2品からは提案される(0件にはしない)', picks.every((id) => id === 2 || id === 3), true)
  }
  {
    // 主菜がえび(魚)のとき、ツナ副菜(魚)を後回しにする
    const recipes = [
      mkRecipe(1, { title: 'ツナと蒸し大豆の香味サラダ', tags: ['洋食'], dishType: 'side', ingredients: [{ name: 'ツナ缶', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: 'コールスロー', tags: ['洋食'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
    ]
    const picks = Array.from({ length: 20 }, () =>
      suggestForSlot(recipes, opts({ role: 'side', preferDishType: 'side', avoidKeys: ['protein:魚'] }))?.id,
    )
    eq('avoidKeys: 魚の主菜のとき、魚の副菜(ツナ)は出ない', picks.every((id) => id === 2), true)
  }
  eq(
    'avoidKeys: 一致しない候補が0件なら緩和して提案する(0件にしない)',
    suggestForSlot(
      [mkRecipe(1, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] })],
      opts({ role: 'side', preferDishType: 'side', avoidKeys: ['texture:つるっと'] }),
    )?.id,
    1,
  )
  {
    // ペア提案の実地: つるっと系の主菜には、つるっとしていない副菜が付く
    const recipes = [
      mkRecipe(1, { title: 'しらたきのチャプチェ風', tags: ['中華'], dishType: 'main', ingredients: [{ name: 'しらたき', amount: '100', unit: 'g' }, { name: '牛切り落とし肉', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '春雨サラダ', tags: ['中華'], dishType: 'side', ingredients: [{ name: '春雨', amount: '100', unit: 'g' }] }),
      mkRecipe(3, { title: '野菜炒め', tags: ['中華'], dishType: 'side', ingredients: [{ name: 'キャベツ', amount: '100', unit: 'g' }] }),
    ]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('ペア提案(MP-04): 主菜はしらたきのチャプチェ風', results.every((r) => r.main?.id === 1), true)
    eq('ペア提案(MP-04): つるっと系が重ならない副菜が選ばれる(春雨サラダは出ない)', results.every((r) => r.side?.id === 3), true)
  }

  // MP-09 デザートが副菜に出る/同じ料理が同じ枠に2回入る
  {
    // 「肉じゃが(main)」「水ようかん(dessert)」の2品しかない状態
    const recipes = [
      mkRecipe(1, { title: '肉じゃが', tags: ['和食'], dishType: 'main', ingredients: [{ name: '牛こま切れ肉', amount: '100', unit: 'g' }] }),
      mkRecipe(2, { title: '水ようかん', tags: ['和食'], dishType: 'dessert', ingredients: [{ name: 'こしあん', amount: '100', unit: 'g' }] }),
    ]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('MP-09: 副菜候補が0件でもデザートは副菜にしない(副菜なしにする)', results.every((r) => r.side === undefined), true)
    eq('MP-09: 主菜は肉じゃがのまま提案される', results.every((r) => r.main?.id === 1), true)
  }
  {
    // 主菜になりうる品が1品しかない状態でも、同じ料理が主菜と副菜の両方に入らない
    const recipes = [mkRecipe(1, { title: '肉じゃが', tags: ['和食'], dishType: 'main', ingredients: [{ name: '牛こま切れ肉', amount: '100', unit: 'g' }] })]
    const results = Array.from({ length: 20 }, () => suggestPairForSlot(recipes, opts()))
    eq('MP-09: 同じ枠の主菜と副菜に同じ料理は入らない', results.every((r) => r.main?.id === 1 && r.side === undefined), true)
  }
  eq(
    'excludeRecipeIds: 指定したレシピは段階的緩和でも復活しない(ハード除外)',
    suggestForSlot([mkRecipe(1, { tags: ['和食'] })], opts({ excludeRecipeIds: [1] })),
    undefined,
  )
  eq(
    'MP-09: 主菜候補が0件でもデザートは主菜にしない',
    suggestForSlot([mkRecipe(1, { title: '水ようかん', dishType: 'dessert' })], opts({ role: 'main' })),
    undefined,
  )
  eq(
    'MP-09: dishType未設定でも「おやつ」タグは副菜の緩和段で除外される',
    suggestForSlot([mkRecipe(1, { tags: ['おやつ'] })], opts({ role: 'side' })),
    undefined,
  )

  // excludeYesterdayPlanRecipes単体: 除外0件時はpoolをそのまま返す・id未設定要素は素通し
  {
    const pool = [{ id: 1 }, { id: 2 }, { id: 3 }]
    eq(
      'excludeYesterdayPlanRecipes: 該当を除外する',
      excludeYesterdayPlanRecipes(pool, [2]).map((r) => r.id),
      [1, 3],
    )
    eq(
      'excludeYesterdayPlanRecipes: 全滅する場合はpoolをそのまま返す',
      excludeYesterdayPlanRecipes(pool, [1, 2, 3]).map((r) => r.id),
      [1, 2, 3],
    )
    eq(
      'excludeYesterdayPlanRecipes: yesterdayRecipeIdsが空なら素通し',
      excludeYesterdayPlanRecipes(pool, []).map((r) => r.id),
      [1, 2, 3],
    )
  }
}

// ---------- preferSeasonWithFallback(提案の候補が季節で痩せる問題・2026-07-29 便CD/MP-12) ----------
// 季節ぴったりの品が少ないときは通年・季節指定なしの品も自動で混ぜる。同梱の夏タグは5品しかなく、
// 従来のpreferSeasonは「1品でもあればその季節の品だけ」に絞るため、何度振り直しても同じ5品しか出なかった。
{
  const mk = (id, season) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...(season ? { season } : {}),
  })
  // 夏5品＋通年20品 = 従来なら夏5品だけ。閾値(10)未満なので通年も混ぜて25品にする
  {
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => mk(i + 1, 'summer')),
      ...Array.from({ length: 20 }, (_, i) => mk(100 + i, 'all')),
    ]
    const got = preferSeasonWithFallback(pool, 'summer')
    eq('preferSeasonWithFallback: 季節の品が少なければ通年も混ぜる(夏5品固定の解消)', got.length, 25)
    eq('preferSeasonWithFallback: 季節の品は必ず残る', got.filter((r) => r.season === 'summer').length, 5)
  }
  // 季節の品が十分あれば従来どおり季節優先のまま(季節感を捨てない)
  {
    const pool = [
      ...Array.from({ length: SEASON_MIN_CANDIDATES, }, (_, i) => mk(i + 1, 'summer')),
      ...Array.from({ length: 20 }, (_, i) => mk(100 + i, 'all')),
    ]
    const got = preferSeasonWithFallback(pool, 'summer')
    eq('preferSeasonWithFallback: 季節の品が十分あれば季節優先のまま', got.length, SEASON_MIN_CANDIDATES)
  }
  // 季節外しか無ければ0件にはしない(そのまま返す)
  eq(
    'preferSeasonWithFallback: 季節外しか無ければ0件にせずそのまま返す',
    preferSeasonWithFallback([mk(1, 'winter')], 'summer').length,
    1,
  )
  eq('preferSeasonWithFallback: 空配列はそのまま', preferSeasonWithFallback([], 'summer').length, 0)
}

// ---------- 期間の食費(2026-07-17 便AB・docs/35 §5): normalizeDateRange/rangeDayCount ----------
eq(
  'normalizeDateRange: 開始<=終了はそのまま',
  normalizeDateRange('2026-07-03', '2026-07-08'),
  ['2026-07-03', '2026-07-08'],
)
eq(
  'normalizeDateRange: 終了<開始は自動で入れ替え',
  normalizeDateRange('2026-07-08', '2026-07-03'),
  ['2026-07-03', '2026-07-08'],
)
eq(
  'normalizeDateRange: 同日を2回タップしても1日の範囲になる',
  normalizeDateRange('2026-07-05', '2026-07-05'),
  ['2026-07-05', '2026-07-05'],
)
eq('rangeDayCount: 同日は1日', rangeDayCount('2026-07-05', '2026-07-05'), 1)
eq('rangeDayCount: 3日〜8日は6日間(両端含む)', rangeDayCount('2026-07-03', '2026-07-08'), 6)
eq('rangeDayCount: 月をまたぐ計算も正しい', rangeDayCount('2026-06-28', '2026-07-02'), 5)

// ---------- planWeekFill(「まとめて献立を立てる」の計画・2026-07-22 便BE) ----------
// 外部レビューで見つかった「手動配置を無警告で上書きする」欠陥の再発防止。
// 手動配置(auto以外)がある枠は残し、空き枠・自動提案由来の枠だけを埋め直す。過去日・非表示帯は対象外。
{
  const week = [
    '2026-07-20', // 月
    '2026-07-21', // 火
    '2026-07-22', // 水
    '2026-07-23', // 木
    '2026-07-24', // 金
    '2026-07-25', // 土
    '2026-07-26', // 日
  ]
  const mkEntry = (id, date, recipeId, over = {}) => ({ id, date, slot: 'dinner', recipeId, role: 'main', ...over })
  const keysOf = (slots) => slots.map((s) => `${s.date}|${s.slot}`)
  const sortedNums = (a) => [...a].sort((x, y) => x - y)
  const sortedStrs = (set) => Array.from(set).sort()

  // (1) まっさらな週(空): 表示中の全枠が埋め対象になる。手動保護なし・削除なし(MEALPLAN-04 1回目相当)
  {
    const plan = planWeekFill([], week, ['dinner'], '2026-07-20')
    eq('planWeekFill(空の週): 7日分の夕食すべてが埋め対象', keysOf(plan.slotsToFill), [
      '2026-07-20|dinner', '2026-07-21|dinner', '2026-07-22|dinner', '2026-07-23|dinner',
      '2026-07-24|dinner', '2026-07-25|dinner', '2026-07-26|dinner',
    ])
    eq('planWeekFill(空の週): 残す手動枠は0', plan.preservedSlotKeys.size, 0)
    eq('planWeekFill(空の週): 削除対象なし', plan.entryIdsToRemove, [])
    eq('planWeekFill(空の週): used除外なし', plan.usedRecipeIds, [])
  }

  // (2) 全枠が自動提案由来: 2回目のタップでも全枠を埋め直す(再抽選)＝手動保護は邪魔しない
  //     (MEALPLAN-04 2回目相当: 自動枠は削除→再作成される)
  {
    const entries = week.map((date, i) => mkEntry(i + 1, date, 10 + i, { auto: true }))
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(全自動枠): 全7枠が埋め直し対象', plan.slotsToFill.length, 7)
    eq('planWeekFill(全自動枠): 自動行は全件削除対象', sortedNums(plan.entryIdsToRemove), [1, 2, 3, 4, 5, 6, 7])
    eq('planWeekFill(全自動枠): 残す手動枠は0(再抽選できる)', plan.preservedSlotKeys.size, 0)
  }

  // (3) 手動配置は残し、空き枠だけ埋める。手動枠は埋め対象にも削除対象にもならない(タスク1の核心)
  {
    const entries = [
      mkEntry(1, '2026-07-20', 11), // 月・手動(auto未設定)
      mkEntry(2, '2026-07-21', 12, { auto: true }), // 火・自動
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(手動保護): 月の手動枠は残す枠に入る', sortedStrs(plan.preservedSlotKeys), ['2026-07-20|dinner'])
    eq(
      'planWeekFill(手動保護): 月(手動)は埋め対象から外れ、火〜日だけ埋める',
      keysOf(plan.slotsToFill),
      ['2026-07-21|dinner', '2026-07-22|dinner', '2026-07-23|dinner', '2026-07-24|dinner', '2026-07-25|dinner', '2026-07-26|dinner'],
    )
    eq('planWeekFill(手動保護): 手動行(id=1)は削除されず、火の自動行(id=2)だけ削除', plan.entryIdsToRemove, [2])
    eq('planWeekFill(手動保護): 手動枠のレシピ(11)は重複回避のusedに入る', plan.usedRecipeIds.includes(11), true)
    // 便BH-2(役割粒度): 手動で主菜だけ入れた月曜は、主菜を残したまま副菜だけを追加で埋める
    eq(
      'planWeekFill(役割粒度): 手動主菜だけの月曜は副菜だけを追加で埋める(partialFills)',
      plan.partialFills.map((p) => `${p.date}|${p.slot}|${p.fillRole}`),
      ['2026-07-20|dinner|side'],
    )
  }

  // (3b) 便BH-2(役割粒度): 手動で副菜だけ入れ、同じ枠に自動主菜がある場合。
  //      副菜(手動)は残し、自動主菜は削除して主菜だけを埋め直す
  {
    const entries = [
      mkEntry(1, '2026-07-20', 21, { role: 'side' }), // 月・手動副菜
      mkEntry(2, '2026-07-20', 22, { role: 'main', auto: true }), // 月・自動主菜
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(役割粒度): 手動副菜のある月曜は残す枠に入る', sortedStrs(plan.preservedSlotKeys), ['2026-07-20|dinner'])
    eq('planWeekFill(役割粒度): 自動主菜(id=2)は削除して主菜だけ埋め直す', plan.entryIdsToRemove.includes(2), true)
    eq('planWeekFill(役割粒度): 手動副菜(id=1)は削除されない', plan.entryIdsToRemove.includes(1), false)
    eq(
      'planWeekFill(役割粒度): 月曜は主菜だけ埋める(partialFills=main)',
      plan.partialFills.find((p) => p.date === '2026-07-20')?.fillRole,
      'main',
    )
    eq('planWeekFill(役割粒度): 手動副菜のレシピ(21)は重複回避のusedに入る', plan.usedRecipeIds.includes(21), true)
  }

  // (3c) 便DE-4(汁物・その他の区分): 自動提案が触るのは主菜・副菜だけ。
  //      汁物・その他の行は「消さない・埋め対象にしない・重複回避のusedには数える」。
  //      汁物だけが入っている枠は「まだ決まっていない」扱い＝主菜+副菜のペアで埋める
  {
    const entries = [
      mkEntry(1, '2026-07-20', 31, { role: 'soup' }), // 月・汁物(手で足した行)
      mkEntry(2, '2026-07-21', 32, { role: 'other', auto: true }), // 火・その他(autoが付いていても消さない)
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-20')
    eq('planWeekFill(便DE-4): 汁物・その他は削除対象にしない', plan.entryIdsToRemove, [])
    eq(
      'planWeekFill(便DE-4): 汁物だけの枠も主菜+副菜のペアで埋める',
      keysOf(plan.slotsToFill).includes('2026-07-20|dinner'),
      true,
    )
    eq('planWeekFill(便DE-4): 汁物・その他のレシピは重複回避のusedに入る', sortedNums(plan.usedRecipeIds), [31, 32])
    eq('planWeekFill(便DE-4): 汁物・その他だけの枠は「残す枠」に数えない', plan.preservedSlotKeys.size, 0)
  }

  // (4) 過去日・今日の手動・非表示帯・手動と自動が同居する枠、の複合ケース
  {
    const entries = [
      mkEntry(1, '2026-07-20', 100), // 月=過去日(today=水): 対象外→触らない・usedに入る
      mkEntry(2, '2026-07-22', 200), // 水=今日・手動→残す
      mkEntry(3, '2026-07-23', 300, { auto: true }), // 木・自動→削除して埋め直す
      mkEntry(4, '2026-07-24', 400, { auto: true }), // 金・自動 …だが同じ枠に手動(id=5)があるので枠ごと残す
      mkEntry(5, '2026-07-24', 401), // 金・手動→金の枠を残す
      mkEntry(6, '2026-07-25', 500, { slot: 'lunch' }), // 土・昼食(非表示帯)→対象外・usedに入る
    ]
    const plan = planWeekFill(entries, week, ['dinner'], '2026-07-22')
    eq('planWeekFill(複合): 残す枠は今日(水)と金の2枠', sortedStrs(plan.preservedSlotKeys), ['2026-07-22|dinner', '2026-07-24|dinner'])
    eq('planWeekFill(複合): 埋めるのは木・土・日の夕食', keysOf(plan.slotsToFill), [
      '2026-07-23|dinner', '2026-07-25|dinner', '2026-07-26|dinner',
    ])
    eq('planWeekFill(複合): 削除は木の自動(id=3)のみ。金の自動(id=4)は枠ごと残すので消さない', plan.entryIdsToRemove, [3])
    eq('planWeekFill(複合): 過去日・非表示帯・残す枠の全レシピがusedに入る', sortedNums(plan.usedRecipeIds), [100, 200, 400, 401, 500])
    // 便BH-2(役割粒度): 手動主菜だけの水(今日)・金は、副菜だけを追加で埋める
    eq(
      'planWeekFill(複合・役割粒度): 水と金は副菜だけを追加で埋める(partialFills)',
      plan.partialFills.map((p) => `${p.date}|${p.slot}|${p.fillRole}`).sort(),
      ['2026-07-22|dinner|side', '2026-07-24|dinner|side'],
    )
  }

  // (5) A-5 月の空日を一括提案(2026-07-29 便CB-2・docs/59)。同じ planWeekFill を
  // 日付の配列だけ「その月の全日」に広げて使う＝週と月で埋め方(手動保護・autoの再抽選・
  // 過去日の除外)が食い違わないことを固定する
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    const entries = [
      mkEntry(1, '2026-08-02', 100), // 過去日(today=8/5)→対象外
      mkEntry(2, '2026-08-10', 200), // 手動の主菜→枠ごと残し、副菜だけ足す
      mkEntry(3, '2026-08-11', 300, { auto: true }), // 自動→消して埋め直す(再抽選)
    ]
    const plan = planWeekFill(entries, august, ['dinner'], '2026-08-05')
    eq(
      'planWeekFill(月レンジ): 過去日(8/1〜8/4)は対象外',
      plan.slotsToFill.every((s) => s.date >= '2026-08-05'),
      true,
    )
    eq(
      'planWeekFill(月レンジ): 手動のある日を除いた未来日をペアで埋める(8/5〜8/31の26日分)',
      plan.slotsToFill.length,
      26,
    )
    eq(
      'planWeekFill(月レンジ): 手動主菜の日は枠ごと残し、副菜だけ足す',
      [sortedStrs(plan.preservedSlotKeys), plan.partialFills.map((p) => `${p.date}|${p.fillRole}`)],
      [['2026-08-10|dinner'], ['2026-08-10|side']],
    )
    eq(
      'planWeekFill(月レンジ): 自動提案由来の行だけを消して振り直す(手動は消さない)',
      plan.entryIdsToRemove,
      [3],
    )
    eq(
      'planWeekFill(月レンジ): 過去日と残す枠のレシピは重複回避のusedに入る',
      sortedNums(plan.usedRecipeIds),
      [100, 200],
    )
  }

  // (6) 便CH/C1(2026-07-30): 月の「献立をまとめて提案」は keepAuto=true で呼ぶ。
  // 自動提案で入った献立も保護し、2回目に押しても1品も消さない・入れ替えない
  // （確認文「今ある献立と作った記録は消えません」が事実になる。週タブの再抽選は既定値falseで不変）。
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    // 1回目で全日を自動配置し終えた状態（主菜+副菜が auto で入っている）
    const filled = august.flatMap((date, i) => [
      mkEntry(i * 2 + 1, date, 100 + i, { auto: true }),
      mkEntry(i * 2 + 2, date, 200 + i, { role: 'side', auto: true }),
    ])
    const again = planWeekFill(filled, august, ['dinner'], '2026-08-01', { keepAuto: true })
    eq(
      'planWeekFill(便CH/C1): 2回目は埋める枠が0（総入れ替えが起きない）',
      [again.slotsToFill.length, again.partialFills.length],
      [0, 0],
    )
    eq('planWeekFill(便CH/C1): 削除する行は0件（自動配置分も消さない）', again.entryIdsToRemove, [])
    eq(
      'planWeekFill(便CH/C1): 全31日が「すでに決まっている」枠として数えられる',
      again.preservedSlotKeys.size,
      31,
    )
    // 空き枠は従来どおり埋まる（保護しただけで機能は殺していない）
    const partial = planWeekFill(filled.slice(0, 4), august, ['dinner'], '2026-08-01', {
      keepAuto: true,
    })
    eq(
      'planWeekFill(便CH/C1): 自動で埋まっている2日を残し、残り29日は今までどおり埋める',
      [partial.preservedSlotKeys.size, partial.slotsToFill.length],
      [2, 29],
    )
    // 週タブ（既定値）は2026-07-14の再抽選仕様のまま＝自動枠は振り直す
    const weekDefault = planWeekFill(filled.slice(0, 2), august, ['dinner'], '2026-08-01')
    eq(
      'planWeekFill(便CH/C1): 既定(keepAuto無し)は従来どおり自動枠を振り直す＝週タブは不変',
      [weekDefault.preservedSlotKeys.size, sortedNums(weekDefault.entryIdsToRemove)],
      [0, [1, 2]],
    )
  }

  // (7) 便CH/C10(2026-07-30): その日のメモ（外食・実家に帰る 等）を書いた日は一括提案の対象外。
  // メモは「この日は献立が要らない」を表せる唯一の手段なのに、一括提案が無視して埋めており、
  // 外食の日の分まで月の食費・栄養に乗っていた
  {
    const august = Array.from(
      { length: 31 },
      (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
    )
    const plan = planWeekFill([mkEntry(1, '2026-08-20', 300)], august, ['dinner'], '2026-08-01', {
      keepAuto: true,
      skipDates: ['2026-08-15', '2026-08-16', '2026-07-31'], // 月の外・過去日の指定は無視される
    })
    eq(
      'planWeekFill(便CH/C10): メモを書いた日には献立を入れない',
      plan.slotsToFill.some((s) => s.date === '2026-08-15' || s.date === '2026-08-16'),
      false,
    )
    eq(
      'planWeekFill(便CH/C10): 外した日は確認文に件数を書けるよう返す(範囲外・過去日は数えない)',
      plan.skippedDates,
      ['2026-08-15', '2026-08-16'],
    )
    eq(
      'planWeekFill(便CH/C10): 外したのは2日だけで、ほかの空き日はこれまでどおり埋める',
      plan.slotsToFill.length,
      31 - 2 - 1, // メモ2日と、手動配置のある1日(こちらはpartialFillsで副菜だけ足す)
    )
    // メモの日に既に献立があっても触らない（消さない）。重複回避のusedにだけ入る
    const withNoteEntry = planWeekFill(
      [mkEntry(9, '2026-08-15', 777, { auto: true })],
      august,
      ['dinner'],
      '2026-08-01',
      { keepAuto: true, skipDates: ['2026-08-15'] },
    )
    eq(
      'planWeekFill(便CH/C10): メモの日に入っている献立は消さない(非破壊)',
      withNoteEntry.entryIdsToRemove,
      [],
    )
    eq(
      'planWeekFill(便CH/C10): メモの日のレシピは重複回避のusedに入る',
      withNoteEntry.usedRecipeIds,
      [777],
    )
  }

  // (8) 便DT-8(2026-08-07 オーナー指示): 週タブ「まとめて献立を入力」の入れかたスイッチ。
  //  fillEmpty  … keepAuto=true と同じ＝1品も消さない(完全に非破壊)
  //  replaceAll … 対象範囲の献立を手動配置も含めて全部消してから入れ直す
  // 総入れ替えでも「過去日・表示していない食事」には触らない＝対象範囲の定義は変えない、が要。
  {
    const entries = [
      mkEntry(1, '2026-07-19', 900), // 過去日(対象外)
      mkEntry(2, '2026-07-20', 100), // 手動(今日)
      mkEntry(3, '2026-07-21', 200, { auto: true }), // 自動
      mkEntry(4, '2026-07-21', 201, { auto: true, role: 'side' }),
      mkEntry(5, '2026-07-22', 300, { role: 'soup' }), // 汁物(自動提案は入れない役割)
      mkEntry(6, '2026-07-23', 400, { slot: 'breakfast' }), // 非表示帯(対象外)
    ]
    // 「まだ決まっていない枠だけ埋める」= keepAuto:true。1品も消さない
    const fillEmpty = planWeekFill(entries, week, ['dinner'], '2026-07-20', { keepAuto: true })
    eq('planWeekFill(便DT-8/空き枠だけ): 削除する行は0件(完全に非破壊)', fillEmpty.entryIdsToRemove, [])
    eq(
      'planWeekFill(便DT-8/空き枠だけ): すでに入っている3日は残す枠に数える',
      sortedStrs(fillEmpty.preservedSlotKeys),
      ['2026-07-20|dinner', '2026-07-21|dinner'],
    )
    eq(
      'planWeekFill(便DT-8/空き枠だけ): 空いている日だけ埋める(7日-すでに入っている2日=5日)',
      fillEmpty.slotsToFill.length,
      5,
    )

    // 「レシピを総入れ替え」= replaceAll:true。対象範囲の行は手動も自動も汁物も消す
    const replaceAll = planWeekFill(entries, week, ['dinner'], '2026-07-20', { replaceAll: true })
    eq(
      'planWeekFill(便DT-8/総入れ替え): 対象範囲の行は手動(2)・自動(3,4)・汁物(5)とも削除対象',
      sortedNums(replaceAll.entryIdsToRemove),
      [2, 3, 4, 5],
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 過去日(id=1)と非表示帯(id=6)は消さない',
      replaceAll.entryIdsToRemove.includes(1) || replaceAll.entryIdsToRemove.includes(6),
      false,
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 残す枠は0＝7日ぜんぶをペアで入れ直す',
      [replaceAll.preservedSlotKeys.size, replaceAll.slotsToFill.length, replaceAll.partialFills.length],
      [0, 7, 0],
    )
    eq(
      'planWeekFill(便DT-8/総入れ替え): 消す行のレシピは重複回避のusedに入れない(引き直せる)',
      sortedNums(replaceAll.usedRecipeIds),
      [400, 900], // 対象外の過去日・非表示帯だけ
    )
    // keepAuto と同時に指定されても、総入れ替えを優先する（矛盾した指定で「何も起きない」を作らない）
    const bothFlags = planWeekFill(entries, week, ['dinner'], '2026-07-20', {
      keepAuto: true,
      replaceAll: true,
    })
    eq(
      'planWeekFill(便DT-8): keepAutoと同時指定なら総入れ替えを優先する',
      sortedNums(bothFlags.entryIdsToRemove),
      [2, 3, 4, 5],
    )
  }
}

// ---------- navMemory(画面をまたぐ短期の記憶・2026-08-07 便DT-2) ----------
// 週タブからレシピ詳細を開いて戻ってきたとき、同じ週・同じスクロール位置に復元するための覚え書き。
// 壊れた値を読んだときに「変な場所へ飛ぶ」ことがないよう、受け付ける形をここで固定する。
{
  eq('DT2-NAV 覚えるキーは固定(別便が別名で書かない)', [WEEK_RETURN_KEY, LAST_RECIPES_PATH_KEY], [
    'mealPlan:weekReturn',
    'tabbar:lastRecipesPath',
  ])
  eq('DT2-NAV 復元の印は restore', WEEK_RETURN_PARAM, 'restore')
  eq(
    'DT2-NAV 覚えた形をそのまま読み戻せる',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 1234 })),
    { weekStart: '2026-08-03', scrollY: 1234 },
  )
  eq(
    'DT2-NAV スクロール位置は整数に丸めて覚える(小数のpxを持ち回らない)',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 12.7 })).scrollY,
    13,
  )
  eq(
    'DT2-NAV 負のスクロール位置は0に丸める',
    parseWeekReturn(serializeWeekReturn({ weekStart: '2026-08-03', scrollY: -50 })).scrollY,
    0,
  )
  eq('DT2-NAV 覚えが無ければnull(復元しない)', parseWeekReturn(null), null)
  eq('DT2-NAV 空文字はnull', parseWeekReturn(''), null)
  eq('DT2-NAV JSONでなければnull', parseWeekReturn('{壊れた'), null)
  eq('DT2-NAV 物体でなければnull', parseWeekReturn('123'), null)
  eq('DT2-NAV 日付の形が違えばnull', parseWeekReturn('{"weekStart":"2026/08/03","scrollY":0}'), null)
  eq('DT2-NAV 日付が無ければnull', parseWeekReturn('{"scrollY":10}'), null)
  eq('DT2-NAV スクロール位置が数値でなければnull', parseWeekReturn('{"weekStart":"2026-08-03","scrollY":"10"}'), null)
  eq('DT2-NAV NaNはnull', parseWeekReturn('{"weekStart":"2026-08-03","scrollY":null}'), null)
  // 2026-08-19 便ID・⑦: 人が開け閉めした曜日カードも一緒に覚える。
  // 覚えずに戻ると、開いていた日がまた畳まれてページの高さが変わり、
  // 覚えた縦位置に戻しても違う場所へ着く（e2e WEEKUI-DT で実測130pxずれた）
  eq(
    'ID-7 開け閉めした曜日カードも覚えて読み戻せる',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-03',
        scrollY: 100,
        dayFold: { '2026-08-03': false, '2026-08-04': true },
      }),
    ),
    { weekStart: '2026-08-03', scrollY: 100, dayFold: { '2026-08-03': false, '2026-08-04': true } },
  )
  eq(
    'ID-7 1つも触っていなければ書かない(以前の版と同じ形のまま)',
    serializeWeekReturn({ weekStart: '2026-08-03', scrollY: 100, dayFold: {} }),
    '{"weekStart":"2026-08-03","scrollY":100}',
  )
  eq(
    'ID-7 覚えが古い版で曜日カードの分が無くても、週と縦位置は読み戻せる',
    parseWeekReturn('{"weekStart":"2026-08-03","scrollY":100}'),
    { weekStart: '2026-08-03', scrollY: 100 },
  )
  eq(
    'ID-7 壊れた1件だけを捨てて残りを活かす(日付の形でない鍵・真偽でない値)',
    parseWeekReturn(
      '{"weekStart":"2026-08-03","scrollY":100,"dayFold":{"2026/08/03":true,"2026-08-04":"はい","2026-08-05":true}}',
    ).dayFold,
    { '2026-08-05': true },
  )
  eq(
    'ID-7 曜日カードの分が丸ごと壊れていても、週と縦位置は読み戻せる',
    parseWeekReturn('{"weekStart":"2026-08-03","scrollY":100,"dayFold":"こわれた"}'),
    { weekStart: '2026-08-03', scrollY: 100 },
  )
}

// ---------- navMemory: 見ていた場所の目印(2026-08-14 便GH・再発防止) ----------
// 直したバグ: 週タブ→レシピ詳細→「戻る」で、離れる前と別の場所に着地する(実測695pxのずれ)。
// 覚えていたのがページ先頭からの距離(scrollY)だけで、離れている間にページの高さが変わると
// 同じ距離が別の場所を指すため(「栄養の概算を詳しく見る」で開いた明細は、離れると閉じる)。
{
  // 画面(高さ844)に4枚のカードが並び、上の2枚は上端が画面より上にある状態
  const cards = [
    { date: '2026-08-10', top: -500 },
    { date: '2026-08-11', top: -100 },
    { date: '2026-08-12', top: 300 },
    { date: '2026-08-13', top: 700 },
  ]
  eq('GH-ANCHOR 上端が画面の中から始まるカードのうち、いちばん上を目印にする', pickReturnAnchor(cards), {
    date: '2026-08-12',
    top: 300,
  })
  // 上端が画面より上のカードを目印にしてはいけない: そのカードの中で縮む部分（栄養の明細）も
  // 画面より上にあり、明細が閉じてもカードの上端は動かない＝ずれを打ち消せない（実測 -644px）
  eq(
    'GH-ANCHOR 上端が画面より上のカードは目印にしない(その中の縮む部分も画面の上なので直らない)',
    pickReturnAnchor([
      { date: '2026-08-14', top: -1055 },
      { date: '2026-08-15', top: 70 },
    ]).date,
    '2026-08-15',
  )
  eq(
    'GH-ANCHOR 上に貼り付く帯の下から数える(帯に隠れて上端が見えないカードは目印にしない)',
    pickReturnAnchor(cards, 320),
    { date: '2026-08-13', top: 700 },
  )
  eq(
    'GH-ANCHOR 画面いっぱいに1枚が広がっているときは、画面の下にある次のカードを目印にする',
    pickReturnAnchor([
      { date: '2026-08-14', top: -300 },
      { date: '2026-08-15', top: 1200 },
    ]),
    { date: '2026-08-15', top: 1200 },
  )
  eq(
    'GH-ANCHOR 最後のカードの中まで送っていれば目印なし(従来どおり縦位置だけで戻す)',
    pickReturnAnchor([{ date: '2026-08-10', top: -900 }]),
    null,
  )
  eq('GH-ANCHOR カードが1枚も無ければ目印なし', pickReturnAnchor([]), null)
  eq('GH-ANCHOR 上端は整数に丸める', pickReturnAnchor([{ date: '2026-08-10', top: 12.4 }]).top, 12)
  // 復元の計算: 目印のカードを離れたときと同じ高さに戻す
  eq(
    'GH-ANCHOR 上の中身が695px縮んでいても、目印のカードは同じ高さに戻る',
    // 離れたとき: 縦位置2511でカードの上端は70px。戻ったとき、明細が閉じて上が695px縮み、
    // 同じ縦位置2511ではカードの上端が-625pxまで上がっている
    scrollTargetForAnchor(2511, -625, { date: '2026-08-15', top: 70 }),
    2511 - 695,
  )
  eq(
    'GH-ANCHOR 高さが変わっていなければ、離れたときと同じ縦位置になる',
    scrollTargetForAnchor(1493, 70, { date: '2026-08-11', top: 70 }),
    1493,
  )
  eq(
    'GH-ANCHOR 上が伸びていれば、そのぶん下へ送る',
    scrollTargetForAnchor(1000, 260, { date: '2026-08-11', top: 60 }),
    1200,
  )
  eq(
    'GH-ANCHOR 先頭より手前へは戻さない(負の縦位置を作らない)',
    scrollTargetForAnchor(100, 0, { date: '2026-08-11', top: 500 }),
    0,
  )
  // 覚え書きの形: 目印は任意。付いていない古い覚え書きも、壊れた目印も、週の復元は止めない
  eq(
    'GH-ANCHOR 目印つきの覚え書きをそのまま読み戻せる',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-10',
        scrollY: 2511,
        anchor: { date: '2026-08-15', top: 70.4 },
      }),
    ),
    { weekStart: '2026-08-10', scrollY: 2511, anchor: { date: '2026-08-15', top: 70 } },
  )
  eq(
    'GH-ANCHOR 目印が無い覚え書きは以前と同じ形のまま(古い覚え書きも読める)',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印だけ壊れていたら目印を捨てて週の復元は続ける',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511,"anchor":{"date":"きのう","top":70}}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印の上端が数値でなければ目印を捨てる',
    parseWeekReturn('{"weekStart":"2026-08-10","scrollY":2511,"anchor":{"date":"2026-08-15","top":"70"}}'),
    { weekStart: '2026-08-10', scrollY: 2511 },
  )
  eq(
    'GH-ANCHOR 目印の上端は0未満に丸めない(画面の外を指す値も位置として意味がある)',
    parseWeekReturn(
      serializeWeekReturn({
        weekStart: '2026-08-10',
        scrollY: 2511,
        anchor: { date: '2026-08-15', top: -120 },
      }),
    ).anchor,
    { date: '2026-08-15', top: -120 },
  )
}

// ---------- navMemory: 献立の月タブ/日タブの居場所(2026-08-09 便EQ) ----------
// 「作った記録の一覧」へ行って戻ったとき、離れる直前の場所（月タブなら見ていた月も）へ帰す。
// 週タブと同じく、壊れた値を読んだときは「復元しない」に倒す＝変な場所へ飛ばさない。
{
  // 2026-08-17 便HG: ホーム画面の廃止で 'home:return' は使う画面が無くなったので外した
  eq('EQ-NAV 覚えるキーは固定(別便が別名で書かない)', [MONTH_RETURN_KEY, DAY_RETURN_KEY], [
    'mealPlan:monthReturn',
    'mealPlan:dayReturn',
  ])
  eq(
    'EQ-NAV 覚えた形をそのまま読み戻せる(月タブは見ていた月も一緒に覚える)',
    parseViewReturn(serializeViewReturn({ anchor: '2026-06-01', scrollY: 820 })),
    { anchor: '2026-06-01', scrollY: 820 },
  )
  eq(
    'EQ-NAV 目印が要らない画面(献立の日タブ)は空文字で覚える',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: 40 })),
    { anchor: '', scrollY: 40 },
  )
  eq(
    'EQ-NAV スクロール位置は整数に丸めて覚える',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: 12.7 })).scrollY,
    13,
  )
  eq(
    'EQ-NAV 負のスクロール位置は0に丸める',
    parseViewReturn(serializeViewReturn({ anchor: '', scrollY: -50 })).scrollY,
    0,
  )
  eq('EQ-NAV 覚えが無ければnull(復元しない)', parseViewReturn(null), null)
  eq('EQ-NAV 空文字はnull', parseViewReturn(''), null)
  eq('EQ-NAV JSONでなければnull', parseViewReturn('{壊れた'), null)
  eq('EQ-NAV 物体でなければnull', parseViewReturn('123'), null)
  eq('EQ-NAV 目印が文字列でなければnull', parseViewReturn('{"anchor":3,"scrollY":10}'), null)
  eq('EQ-NAV 目印が無ければnull', parseViewReturn('{"scrollY":10}'), null)
  eq('EQ-NAV スクロール位置が数値でなければnull', parseViewReturn('{"anchor":"","scrollY":"10"}'), null)
  eq('EQ-NAV NaNはnull', parseViewReturn('{"anchor":"","scrollY":null}'), null)
}

// ---------- navMemory: 「今日なに作る？」の候補を覚える(2026-08-17 便HI・再発防止) ----------
// オーナー実機「今日なに作るのレシピ詳細から戻ってきた時だけは、ランダムでレシピが変わらないように」。
// 候補はくじなので、画面を離れて戻ると引き直されてさっき見に行った料理が消えていた。
// ここで固定するのは「覚える形」と「読めないときは覚えていない扱いにする」の2点
// （読めない値でおかしな料理を出すより、ふつうにくじを引くほうが正しい）。
{
  eq('HI-PIN 覚えるキーは固定(別便が別名で書かない)', [MEAL_PLAN_TAB_TAP_KEY, DAY_SUGGEST_PIN_KEY], [
    'mealPlan:tabTap',
    'mealPlan:daySuggest',
  ])
  eq('HI-PIN 覚えた候補をそのまま読み戻せる', parseSuggestionPin(serializeSuggestionPin(42)), 42)
  eq('HI-PIN 覚えが無ければnull(ふつうにくじを引く)', parseSuggestionPin(null), null)
  eq('HI-PIN 空文字はnull', parseSuggestionPin(''), null)
  eq('HI-PIN JSONでなければnull', parseSuggestionPin('{壊れた'), null)
  eq('HI-PIN 物体でなければnull', parseSuggestionPin('42'), null)
  eq('HI-PIN IDが数値でなければnull', parseSuggestionPin('{"recipeId":"42"}'), null)
  eq('HI-PIN IDが整数でなければnull', parseSuggestionPin('{"recipeId":4.2}'), null)
  eq('HI-PIN IDが0以下ならnull', parseSuggestionPin('{"recipeId":0}'), null)
  eq('HI-PIN IDが無ければnull', parseSuggestionPin('{}'), null)
}

// ---------- navMemory: 「今日なに作る？」の**献立**側も覚える(2026-08-19 便HT・②の再発防止) ----------
// オーナー原文「提案された献立→レシピ詳細→戻る、の流れで、献立『今日なに作る？』の提案が
// 変更されないようにして。」
// 直すバグ: 1品側だけが「戻ってきた1回だけ引き直さない」を持っていて、献立側は画面を離れると
// 組んだ主菜・副菜が消え、戻った瞬間に別の組み合わせが出ていた。
// 新しい仕組みは作らず、1品側とまったく同じ覚え(同じキー・同じ1回きり)の中に項目を足す
// ＝覚える場所が2つに割れない。読めない値は「覚えていない」＝ふつうに引き直す。
{
  eq(
    'HT-PIN 献立の組も一緒に覚えて読み戻せる',
    parseSuggestionPlanPin(serializeSuggestionPin(42, [7, 9])),
    [7, 9],
  )
  eq(
    'HT-PIN 献立の組を足しても1品側の覚えは同じ形のまま読める',
    parseSuggestionPin(serializeSuggestionPin(42, [7, 9])),
    42,
  )
  eq('HT-PIN 献立の組が無ければ空(ふつうに組み直す)', parseSuggestionPlanPin(serializeSuggestionPin(42)), [])
  eq('HT-PIN 覚えが無ければ空', parseSuggestionPlanPin(null), [])
  eq('HT-PIN 空文字は空', parseSuggestionPlanPin(''), [])
  eq('HT-PIN JSONでなければ空', parseSuggestionPlanPin('{壊れた'), [])
  eq('HT-PIN 物体でなければ空', parseSuggestionPlanPin('42'), [])
  eq('HT-PIN 並びでなければ空', parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":7}'), [])
  eq(
    'HT-PIN IDに使えない値が混じっていれば空(中途半端に組を出さない)',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,"9"]}'),
    [],
  )
  eq(
    'HT-PIN IDが整数でなければ空',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,9.5]}'),
    [],
  )
  eq(
    'HT-PIN IDが0以下なら空',
    parseSuggestionPlanPin('{"recipeId":1,"planRecipeIds":[7,0]}'),
    [],
  )
}

// ---------- navMemory: レシピ詳細以外へ離れるときも組を控える(2026-08-21 便IP・①の再発防止) --
// 便IIの実測「『今日なに作る？』が戻るたびに別の献立を組み直す。主菜が一品もの（カレー・丼・麺・鍋）
// だと副菜のカードが付かず、節の高さが156〜170px→74px、ページの下端が82px上がる」。
// オーナーの指摘（便HT）はレシピ詳細からの戻りだけが直っていて、**作った記録の一覧からの戻り**は
// 組み直したままだった。
//
// 直しの要は「覚える形」のほうにある: 記録の一覧へ移るときは**開いた1品が無い**ので、
// これまでの覚え方（recipeId 必須）では献立の組だけを控えることができなかった。
// ここで固定するのは次の3つ。
//   ①1品が無くても献立の組を控えられる（recipeId を入れずに書ける）
//   ②その控えを読み戻すと、1品側は「覚えていない」＝ふつうにくじを引く（null）
//   ③どちらも無いときの形（1品も献立も出していない一瞬）でも、読み出しが壊れない
{
  eq(
    'IP-PIN 1品が無くても献立の組を控えられる',
    parseSuggestionPlanPin(serializeSuggestionPin(null, [7, 9])),
    [7, 9],
  )
  eq(
    'IP-PIN 1品を控えていなければ1品側は「覚えていない」（ふつうにくじを引く）',
    parseSuggestionPin(serializeSuggestionPin(null, [7, 9])),
    null,
  )
  eq('IP-PIN どちらも無いときも読み出しが壊れない', parseSuggestionPin(serializeSuggestionPin(null)), null)
  eq('IP-PIN どちらも無いときの組は空', parseSuggestionPlanPin(serializeSuggestionPin(null)), [])
  eq(
    'IP-PIN 1品と組の両方を控えたときは、これまでどおり両方読める',
    [
      parseSuggestionPin(serializeSuggestionPin(3, [7, 9])),
      parseSuggestionPlanPin(serializeSuggestionPin(3, [7, 9])),
    ],
    [3, [7, 9]],
  )
}

// ---------- 提案の条件「調理時間◯分以内を優先」の分数(2026-08-19 便HT・⑤の再発防止) ----------
// オーナー原文「調理時間15分いないを優先は、時間だけプルダウンで変更できるようにしたい。」
// ここで測るのは**選んだ分数が提案の中身に効いているか**であって、画面がプルダウンかどうかではない。
// 分数を渡さない呼び出し(月タブ・買い物メモなど、この条件を持たない場所)は
// これまでどおり15分のまま＝既存の呼び出しの結果を変えない。
{
  const mkQuick = (id, cookMinutes) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    cookMinutes,
  })
  const quickOpts = (over = {}) => ({
    quickOnly: true,
    excludeNg: false,
    ngIngredients: [],
    usedRecipeIds: [],
    slot: 'dinner',
    season: 'summer',
    ...over,
  })
  // 10分・15分・20分・30分・40分の5品。境界(ちょうど選んだ分数)は含む
  const quickPool = [mkQuick(10, 10), mkQuick(15, 15), mkQuick(20, 20), mkQuick(30, 30), mkQuick(40, 40)]
  const quickIds = (options) =>
    suggestCandidates(quickPool, options)
      .map((r) => r.id)
      .sort((a, b) => a - b)
  eq('HT-QUICK 分数を渡さなければ従来どおり15分以内', quickIds(quickOpts()), [10, 15])
  eq('HT-QUICK 10分を選ぶと10分以内だけが候補', quickIds(quickOpts({ quickMinutes: 10 })), [10])
  eq('HT-QUICK 20分を選ぶと20分の品まで候補に入る', quickIds(quickOpts({ quickMinutes: 20 })), [10, 15, 20])
  eq(
    'HT-QUICK 30分を選ぶと30分の品まで候補に入る(40分は入らない)',
    quickIds(quickOpts({ quickMinutes: 30 })),
    [10, 15, 20, 30],
  )
  eq(
    'HT-QUICK 優先を切っていれば分数は効かない(全部が候補)',
    quickIds(quickOpts({ quickOnly: false, quickMinutes: 10 })),
    [10, 15, 20, 30, 40],
  )
}

// ---------- cookedPlanEntryIds(週ビューの「作った見た目」対応付け・2026-07-24 便BH-3・タスク2) ----------
// 記録の食数だけ枠順(朝→昼→夕・主菜→副菜・id昇順)に先着で消費する。同名複数の枠は記録件数の分だけ・
// 非破壊(エントリは消さない=表示のみ)。「同名複数に注意」の中核。
{
  const mk = (id, slot, role, recipeId) => ({ id, slot, role, recipeId })
  const sortedSet = (set) => Array.from(set).sort((a, b) => a - b)

  // (1) 記録0件なら何も作った見た目にしない
  eq(
    'cookedPlanEntryIds: 記録0件なら空集合',
    sortedSet(cookedPlanEntryIds([mk(1, 'dinner', 'main', 10)], new Map())),
    [],
  )
  // (2) 記録のあるレシピの枠が作った見た目になる
  eq(
    'cookedPlanEntryIds: 記録のあるレシピの枠が対象',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'dinner', 'side', 20)],
        new Map([[10, 1]]),
      ),
    ),
    [1],
  )
  // (3) 同名(同一レシピ)が2枠あり記録1件 → 枠順(朝→昼→夕)で先着の1枠だけ
  eq(
    'cookedPlanEntryIds: 同名2枠・記録1件は枠順で先着の1枠だけ',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'lunch', 'main', 10)],
        new Map([[10, 1]]),
      ),
    ),
    [2], // 昼(lunch)が夕(dinner)より前=先着
  )
  // (4) 同名2枠・記録2件 → 両方
  eq(
    'cookedPlanEntryIds: 同名2枠・記録2件は両方',
    sortedSet(
      cookedPlanEntryIds(
        [mk(1, 'dinner', 'main', 10), mk(2, 'lunch', 'main', 10)],
        new Map([[10, 2]]),
      ),
    ),
    [1, 2],
  )
  // (5) 同枠内は主菜→副菜→id順で先着(同一レシピが主菜と副菜に入る変則ケースでも決定的)
  eq(
    'cookedPlanEntryIds: 同枠内は主菜が副菜より先着',
    sortedSet(
      cookedPlanEntryIds(
        [mk(5, 'dinner', 'side', 10), mk(3, 'dinner', 'main', 10)],
        new Map([[10, 1]]),
      ),
    ),
    [3], // 主菜(id=3)が副菜(id=5)より先着
  )
}

// ---------- mealOccasionCount(概算食費・期間の食費の「◯食分」・2026-07-24 便BH-3・タスク8/9) ----------
{
  eq('mealOccasionCount: 0件は0食', mealOccasionCount([]), 0)
  eq(
    'mealOccasionCount: 同じ日×枠に主菜+副菜が並んでも1食',
    mealOccasionCount([
      { date: '2026-07-24', slot: 'dinner' },
      { date: '2026-07-24', slot: 'dinner' },
    ]),
    1,
  )
  eq(
    'mealOccasionCount: 別の枠・別の日はそれぞれ1食',
    mealOccasionCount([
      { date: '2026-07-24', slot: 'dinner' },
      { date: '2026-07-24', slot: 'lunch' },
      { date: '2026-07-25', slot: 'dinner' },
    ]),
    3,
  )
}

// ---------- planRoleAssign(日タブ「食い違い」チップの役割粒度・2026-07-29 便CB-1)。
// 便CD報告の不具合の再発防止: 副菜の料理を押しても「その枠の主菜」を置き換えていたため、
// 夕食の主菜(肉じゃが)が副菜(きんぴら)に化けて消えていた。役割ごとに何をするかをここで固定する ----------
{
  const main1 = { id: 1, recipeId: 10, role: 'main' }
  const side1 = { id: 2, recipeId: 20, role: 'side' }
  eq(
    '再発防止: 副菜の料理は既存の主菜を置き換えず追加する(主菜が消えない)',
    planRoleAssign([main1], 30, 'side'),
    { kind: 'add' },
  )
  eq(
    '再発防止: 副菜の料理は既存の副菜も置き換えず追加する(副菜も消えない)',
    planRoleAssign([main1, side1], 30, 'side'),
    { kind: 'add' },
  )
  // 2026-08-24 便KI: 主菜の差し替えはやめた（もとからあった主菜が消えていた）。
  // 「主菜を差し替える」を測っていた2件は KI-1 の「消えない・足すだけ」へ引き継いである
  eq(
    '主菜の料理でも、その枠に主菜が無ければ追加する',
    planRoleAssign([side1], 30, 'main'),
    { kind: 'add' },
  )
  eq('空の枠はどちらの役割でも追加になる', planRoleAssign([], 30, 'main'), { kind: 'add' })
  eq(
    '同じ料理が既にその枠にあれば何もしない(同じ料理を2行に増やさない)',
    planRoleAssign([main1, side1], 20, 'side'),
    { kind: 'duplicate' },
  )
  eq(
    '同じ料理が主菜として入っている枠に、主菜として押しても何もしない',
    planRoleAssign([main1], 10, 'main'),
    { kind: 'duplicate' },
  )
  eq(
    'role未設定の既存データがあっても、副菜の料理は追加(既存を消さない)',
    planRoleAssign([{ id: 5, recipeId: 11 }], 30, 'side'),
    { kind: 'add' },
  )
  // 便DE-4(汁物・その他): 主菜以外はどれも「追加」＝既存の行を1件も消さない
  eq(
    '便DE-4: 汁物の料理は既存の主菜・副菜を消さず追加する',
    planRoleAssign([main1, side1], 30, 'soup'),
    { kind: 'add' },
  )
  eq(
    '便DE-4: その他の料理も既存を消さず追加する',
    planRoleAssign([main1, side1], 30, 'other'),
    { kind: 'add' },
  )
}

// ---------- マイ献立テンプレ(A-1)＋曜日固定の定番(B-2)・2026-07-29 便CB-2・docs/59 ----------
// テンプレは日付ではなく曜日で持つ。全曜日を選べばA-1(1週間まるごと)・1曜日だけ選べばB-2
// (毎週◯曜はカレー)になる、という統合設計をここで固定する。入るのは空いているところだけ(非破壊)
{
  const {
    buildTemplateItems,
    planTemplateFill,
    templateDowCounts,
    groupTemplateItems,
    removeTemplateItemAt,
    replaceTemplateItemRecipe,
  } = await import('../../src/logic/mealTemplate.ts')
  // 2026-07-27(月)〜08-02(日)の週
  const weekDatesArr = [
    '2026-07-27',
    '2026-07-28',
    '2026-07-29',
    '2026-07-30',
    '2026-07-31',
    '2026-08-01',
    '2026-08-02',
  ]
  const weekEntries = [
    { id: 1, date: '2026-07-27', slot: 'dinner', recipeId: 10, role: 'main' }, // 月
    { id: 2, date: '2026-07-27', slot: 'dinner', recipeId: 20, role: 'side' },
    { id: 3, date: '2026-07-31', slot: 'dinner', recipeId: 30, role: 'main' }, // 金＝カレー
    { id: 4, date: '2026-08-05', slot: 'dinner', recipeId: 99, role: 'main' }, // 週の外(取得範囲の重なり)
  ]
  const items = buildTemplateItems(weekEntries, weekDatesArr)
  eq('テンプレ保存: 表示中の週の献立だけを覚える(週の外の日は入れない)', items.length, 3)
  eq(
    'テンプレ保存: 日付ではなく曜日(0=月…6=日)で持つ',
    items.map((i) => [i.dow, i.slot, i.role, i.recipeId]),
    [
      [0, 'dinner', 'main', 10],
      [0, 'dinner', 'side', 20],
      [4, 'dinner', 'main', 30],
    ],
  )
  eq(
    'テンプレ保存: role未設定の既存データは主菜として覚える(後方互換)',
    buildTemplateItems([{ date: '2026-07-27', slot: 'dinner', recipeId: 10 }], weekDatesArr)[0].role,
    'main',
  )
  eq('曜日ごとの品数を数えられる(曜日チップの表示用)', templateDowCounts(items), [2, 0, 0, 0, 1, 0, 0])

  // ---- テンプレの中身を見る・直す(2026-08-02 便DE-9) ----
  // 画面は「曜日→食事→役割」の順に出し、直す対象は元の配列の位置(index)で指す。
  // 位置がずれると別の品を消す/差し替える事故になるので、並べ替えても位置が保たれることを固定する
  {
    const mixed = [
      { dow: 4, slot: 'dinner', role: 'side', recipeId: 41 }, // 金・副菜(あとで足した想定)
      { dow: 0, slot: 'dinner', role: 'side', recipeId: 20 },
      { dow: 0, slot: 'breakfast', role: 'main', recipeId: 11 },
      { dow: 0, slot: 'dinner', role: 'main', recipeId: 10 },
    ]
    const groups = groupTemplateItems(mixed)
    eq('テンプレの中身: 曜日の並びは月→金', groups.map((g) => g.dow), [0, 4])
    eq(
      'テンプレの中身: 同じ曜日は朝食→夕食の順',
      groups[0].slots.map((s) => s.slot),
      ['breakfast', 'dinner'],
    )
    eq(
      'テンプレの中身: 同じ食事は主菜→副菜の順',
      groups[0].slots[1].items.map((v) => v.item.role),
      ['main', 'side'],
    )
    eq(
      'テンプレの中身: 並べ替えても元の位置(index)を保つ',
      groups[0].slots[1].items.map((v) => v.index),
      [3, 1],
    )
    // 取り外し・差し替えは元の配列を変えず、指定した位置だけを直す
    const removed = removeTemplateItemAt(mixed, 3)
    eq('テンプレの中身: 指定した1品だけ外す', removed.map((i) => i.recipeId), [41, 20, 11])
    eq('テンプレの中身: 元の中身は変えない(非破壊)', mixed.length, 4)
    eq('テンプレの中身: 範囲外の位置は何も変えない', removeTemplateItemAt(mixed, 9).length, 4)
    const replaced = replaceTemplateItemRecipe(mixed, 1, 99)
    eq('テンプレの中身: 指定した1品のレシピだけ差し替える', replaced[1].recipeId, 99)
    eq(
      'テンプレの中身: 差し替えても曜日・食事・役割は変えない',
      [replaced[1].dow, replaced[1].slot, replaced[1].role],
      [0, 'dinner', 'side'],
    )
    eq('テンプレの中身: 差し替えでほかの品は変わらない', replaced[0].recipeId, 41)
  }

  // A-1: 翌週(8/3(月)〜8/9(日))へ丸ごと流し込む
  const nextWeek = [
    '2026-08-03',
    '2026-08-04',
    '2026-08-05',
    '2026-08-06',
    '2026-08-07',
    '2026-08-08',
    '2026-08-09',
  ]
  const applyAll = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    'A-1: 全曜日を選ぶと、同じ曜日の同じ食事に丸ごと入る',
    applyAll.ops.map((o) => [o.date, o.slot, o.role, o.recipeId]),
    [
      ['2026-08-03', 'dinner', 'main', 10],
      ['2026-08-03', 'dinner', 'side', 20],
      ['2026-08-07', 'dinner', 'main', 30],
    ],
  )
  eq('A-1: 埋まる食事の数と対象日数を数える(確認文の件数)', [applyAll.fillSlotCount, applyAll.targetDayCount, applyAll.keptSlotCount], [2, 2, 0])

  // 非破壊: すでに献立が入っている食事には入れない(手動・自動を問わず残す)
  const applyOverlap = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [{ date: '2026-08-03', slot: 'dinner' }],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    '非破壊: すでに献立がある食事は上書きせず飛ばす(残った数も数える)',
    [applyOverlap.ops.length, applyOverlap.fillSlotCount, applyOverlap.keptSlotCount],
    [1, 1, 1],
  )
  eq('非破壊: 飛ばすのはその食事だけで、空いている金曜には入る', applyOverlap.ops[0].date, '2026-08-07')

  // 過去日は対象外(便W-⑤a以来の共通ルール)
  const applyPast = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-08-05',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq('過去日(今日より前)には入れない', applyPast.ops.map((o) => o.date), ['2026-08-07'])

  // 表示していない食事には入れない(画面に出ない献立が黙って増えない)
  const applyHidden = planTemplateFill({
    items,
    dates: nextWeek,
    entries: [],
    today: '2026-07-29',
    allowedDows: [0, 1, 2, 3, 4, 5, 6],
    visibleSlots: ['breakfast'],
  })
  eq('表示していない食事(夕食を隠している)には入れない', applyHidden.ops.length, 0)
  // 2026-07-30 便CH/C14: 1品も入らなかった理由を言い分けるため、
  // 「テンプレに中身はあるが表示していない食事」を返す(従来は「選んだ曜日には献立がありません」
  // という事実と違う理由が出ていた。窓の曜日チップには「木 1品」と出ているのに)
  eq(
    'C14: 入らなかった理由が「表示していない食事」だと分かる(夕食を隠している)',
    applyHidden.hiddenSlots,
    ['dinner'],
  )
  eq(
    'C14: 表示している食事だけのテンプレなら hiddenSlots は空(理由の取り違えを起こさない)',
    applyAll.hiddenSlots,
    [],
  )

  // B-2: 金曜だけを選ぶ → 8月の毎週金曜(7/14/21/28)に同じ献立が入る
  const augustDates = Array.from(
    { length: 31 },
    (_, i) => `2026-08-${String(i + 1).padStart(2, '0')}`,
  )
  const applyFriday = planTemplateFill({
    items,
    dates: augustDates,
    entries: [],
    today: '2026-08-01',
    allowedDows: [4],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq(
    'B-2: 金曜だけを選ぶと、その月の毎週金曜に同じ献立が入る(毎週◯曜はカレー)',
    applyFriday.ops.map((o) => `${o.date}:${o.recipeId}`),
    ['2026-08-07:30', '2026-08-14:30', '2026-08-21:30', '2026-08-28:30'],
  )
  // 便LK: 入れた献立が0件でも every は true になるので、1件以上あることも同じ条件で見る
  eq(
    'B-2: 月曜のぶん(2品)は入らない=選んだ曜日だけ',
    applyFriday.ops.length > 0 && applyFriday.ops.every((o) => o.recipeId === 30),
    true,
  )
  const applyNoDow = planTemplateFill({
    items,
    dates: augustDates,
    entries: [],
    today: '2026-08-01',
    allowedDows: [1],
    visibleSlots: ['breakfast', 'lunch', 'dinner'],
  })
  eq('テンプレに中身の無い曜日を選ぶと0件(呼び出し側が案内を出す)', [applyNoDow.ops.length, applyNoDow.targetDayCount], [0, 0])
}

// ---------- 献立表(A-4 印刷／画像化)・2026-07-29 便CB-2・docs/59 ----------
// 紙(印刷HTML)・画面・画像(Canvas)の3つが同じこの結果を読む＝内容がずれないことをここで固定する。
// 2026-08-26 便LH（オーナー原文「献立表の内容は、すべて予定（朝昼夕の表示）。作った記録にしない。
// 記録になっている過去のデータも、予定と同じフォーマットで表示したい。」）:
// 載せるのは**登録した献立だけ**になった。過ぎた日も今日から先と同じ食事の行で出す（＋日付メモ）
{
  const { buildPlanSheet, planSheetLines, formatSheetDayLabel } = await import(
    '../../src/logic/planSheet.ts'
  )
  const titles = { 10: '肉じゃが', 20: 'きんぴらごぼう', 30: 'カレー' }
  const sheet = buildPlanSheet({
    title: '7/28〜7/30の献立',
    dates: ['2026-07-28', '2026-07-29', '2026-07-30'],
    visibleSlots: ['breakfast', 'dinner'],
    // 2026-08-02 オーナー指示で既定は「登録のない日を省く」。この一式は3日とも中身があるので
    // 省いても日数は変わらない(省く挙動そのものは下の専用ケースで固定する)
    entries: [
      { date: '2026-07-28', slot: 'dinner', role: 'main', recipeId: 30 }, // 過ぎた日の献立
      { date: '2026-07-29', slot: 'dinner', role: 'side', recipeId: 20 },
      { date: '2026-07-29', slot: 'dinner', role: 'main', recipeId: 10 },
      { date: '2026-07-30', slot: 'lunch', role: 'main', recipeId: 10 }, // 表示していない食事
    ],
    titleOf: (id) => titles[id],
    notes: new Map([['2026-07-30', '外食']]),
  })
  eq('献立表: 日付見出しは「7/29（水）」の形', formatSheetDayLabel('2026-07-29'), '7/29（水）')
  eq(
    '献立表(便LH): 過ぎた日も今日から先と同じ「食事の行」で載せる(作った記録の形にしない)',
    sheet.days[0].slots.map((s) => [s.slot, s.label, s.dishes.map((d) => `${d.role}:${d.title}`)]),
    [['dinner', '夕食', ['main:カレー']]],
  )
  eq(
    '献立表(便LH): 作った記録は献立表に載せない(1日分の形にも残っていない)',
    'cookedTitles' in sheet.days[0],
    false,
  )
  eq(
    '献立表: 登録した献立を主菜→副菜の順に載せる',
    sheet.days[1].slots.map((s) => [s.slot, s.dishes.map((d) => `${d.role}:${d.title}`)]),
    [['dinner', ['main:肉じゃが', 'side:きんぴらごぼう']]],
  )
  eq('献立表: 表示していない食事(昼食)は紙にも出さない', sheet.days[2].slots.length, 0)
  eq('献立表: 日付メモも一緒に載せる', sheet.days[2].note, '外食')
  eq(
    '献立表: 見つからないレシピ(隠している等)は載せない',
    buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      visibleSlots: ['dinner'],
      entries: [{ date: '2026-07-30', slot: 'dinner', role: 'main', recipeId: 999 }],
      titleOf: () => undefined,
      notes: new Map(),
      // 孤児行そのものが載らないことを見たいので、空の日を省く既定は切って日を残す
      includeEmptyDays: true,
    }).days[0].slots.length,
    0,
  )
  eq('献立表: 献立もメモも無ければ白紙と分かる(呼び出し側が案内を出す)', sheet.isEmpty, false)
  eq(
    '献立表: 空の期間は isEmpty=true',
    buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      visibleSlots: ['dinner'],
      entries: [],
      titleOf: () => undefined,
      notes: new Map(),
    }).isEmpty,
    true,
  )
  const lines = planSheetLines(sheet)
  // 2026-08-02 オーナー指示: 行頭ラベル(夕食・作った記録・この日のメモ)は本文と別に持つ。
  // 画像・画面・紙のいずれでも、ラベルだけを小さく薄く別の位置に描けるようにするため
  eq(
    '献立表(画像化): 日付見出し→中身→メモの順に平らにする(料理は1品1行・ラベルは本文と分けて持つ)',
    lines.map((l) => `${l.kind}:${l.label ?? ''}:${l.role ?? ''}:${l.text}`),
    [
      'day:::7/28（火）',
      'dish:夕食:主菜:カレー',
      'day:::7/29（水）',
      'dish:夕食:主菜:肉じゃが',
      'dish::副菜:きんぴらごぼう',
      'day:::7/30（木）',
      'note:この日のメモ::外食',
    ],
  )

  // 2026-08-02 オーナー指示: 献立も作った記録も日付メモも無い日は既定で載せない。
  // 以前は日付だけの行が並び、夕食しか登録していない月では書いてある日を探しにくかった。
  // チェックを入れれば元どおり全日出る(可逆・非破壊)
  {
    const sparseArgs = {
      title: 'x',
      dates: ['2026-07-28', '2026-07-29', '2026-07-30'],
      visibleSlots: ['dinner'],
      entries: [{ date: '2026-07-29', slot: 'dinner', role: 'main', recipeId: 10 }],
      titleOf: (id) => titles[id],
      notes: new Map(),
    }
    eq(
      '献立表: 既定では登録のない日を載せない(2026-08-02)',
      buildPlanSheet(sparseArgs).days.map((d) => d.date),
      ['2026-07-29'],
    )
    eq(
      '献立表: includeEmptyDays=trueなら従来どおり全日載せる',
      buildPlanSheet({ ...sparseArgs, includeEmptyDays: true }).days.map((d) => d.date),
      ['2026-07-28', '2026-07-29', '2026-07-30'],
    )
    eq(
      '献立表: 省いた結果0日でも「白紙」判定は省く前の全日で決める(案内文が変わらない)',
      buildPlanSheet({ ...sparseArgs, entries: [] }).isEmpty,
      true,
    )
    eq(
      '献立表: 中身のある日が1日でもあれば isEmpty=false のまま',
      buildPlanSheet(sparseArgs).isEmpty,
      false,
    )
    eq(
      '献立表(画像化): 省いた日は行にも出ない',
      planSheetLines(buildPlanSheet(sparseArgs)).map((l) => `${l.kind}:${l.text}`),
      ['day:7/29（水）', 'dish:肉じゃが'],
    )
  }

  // 2026-07-30 便CH/C6: 画像だけ料理名が「…」で切り捨てられていた(画面プレビューと印刷には
  // 出ているので、家族に送った先で初めて欠ける)。料理名の行を3行まで許して直したので、
  // 収録レシピで一番長くなる組み合わせ(主菜1+副菜2)がその枠に収まることを固定する。
  // 今後レシピ名が伸びて枠を超えたらここで落ちる＝また黙って欠けるのを防ぐ
  {
    const { MAX_WRAP_LINES, IMAGE_WIDE_CHARS_PER_LINE } = await import(
      '../../src/logic/planSheetImage.ts'
    )
    const longSheet = buildPlanSheet({
      title: 'x',
      dates: ['2026-07-30'],
      visibleSlots: ['dinner'],
      entries: [
        { date: '2026-07-30', slot: 'dinner', role: 'main', recipeId: 1 },
        { date: '2026-07-30', slot: 'dinner', role: 'side', recipeId: 2 },
        { date: '2026-07-30', slot: 'dinner', role: 'side', recipeId: 3 },
      ],
      titleOf: (id) =>
        ({
          1: '鶏もも肉のガーリックハーブ焼き',
          2: 'ブロッコリーとにんじんのハーブマリネ',
          3: '白菜とにんじんの中華とろみ煮',
        })[id],
      notes: new Map(),
    })
    // 2026-08-02: 料理を1品1行にしたので、1行に載るのは料理名1つだけになった。
    // 便CH/C6の趣旨（画像だけ料理名が「…」で欠けるのを防ぐ）は、いちばん長い料理名が
    // 行数上限に収まることで守る。ラベル2列ぶん本文幅が狭くなっている点も一緒に見張る
    const longLines = planSheetLines(longSheet).filter((l) => l.kind === 'dish')
    const longestDish = Math.max(...longLines.map((l) => l.text.length))
    eq(
      '献立表(画像化・便CH/C6): 収録レシピで最長級の料理名が、画像の行数上限に収まる',
      longestDish <= MAX_WRAP_LINES.dish * IMAGE_WIDE_CHARS_PER_LINE,
      true,
    )
    eq(
      '献立表(画像化・2026-08-02): 主菜1+副菜2は3行(1品1行)になる',
      longLines.length,
      3,
    )
    eq(
      '献立表(画像化・2026-08-02): ラベル2列を引いた本文幅の文字数目安で測っている',
      IMAGE_WIDE_CHARS_PER_LINE,
      19,
    )
  }
}

// ---------- 月間画面のサンプルデモの見本データ(2026-08-02 便DC) ----------
{
  // 見本は同梱の基本レシピの名前で組む。レシピ名を変えたらここで気づけるようにする
  const known = new Set(starterDefs.map((d) => d.title))
  const unknown = demoRecipeTitles().filter((t) => !known.has(t))
  eq('DC-DEMO 見本の料理名はすべて基本レシピにある', unknown, [])

  const demo = buildMonthDemoData()
  eq('DC-DEMO 見本の「今日」は固定', demo.today, DEMO_TODAY)
  eq('DC-DEMO デモの中ではPro機能が開く', !!demo.settings.proCode, true)
  // 過ぎた日=作った記録・今日から先=登録した献立、の切り分けが見本データ側で崩れていないこと
  // (崩れると月間サマリーの合計に入らない記録・献立が出て、見本が実物と違う説明になる)
  const logDates = demo.recipes.flatMap((r) => r.cookedLogs.map((l) => l.date))
  eq('DC-DEMO 作った記録はすべて過ぎた日', logDates.every((d) => d < DEMO_TODAY), true)
  eq(
    'DC-DEMO 登録した献立はすべて今日から先',
    // 2026-08-27 便LO: 献立が1件も無いと every は中身を見ずに true になる。
    // 記録の側は下の「写真なしでも組み立てられる」が件数を固定しているが、献立の側は
    // 誰も固定していなかった＝見本から献立が丸ごと消えても緑だった
    demo.entries.length > 0 && demo.entries.every((e) => e.date >= DEMO_TODAY),
    true,
  )
  eq('DC-DEMO 見本は同じ月に収まっている', [...logDates, ...demo.entries.map((e) => e.date)].every((d) => d.slice(0, 7) === DEMO_TODAY.slice(0, 7)), true)
  // 献立エントリのidは重複しない(週+月を束ねるときにidをキーにしているため)
  eq('DC-DEMO 献立のidは重複しない', new Set(demo.entries.map((e) => e.id)).size, demo.entries.length)
  // 写真を渡さなくても組み立てられる(オフライン初回など、写真が読めない環境で落ちない)
  eq('DC-DEMO 写真なしでも組み立てられる', logDates.length > 0, true)
  eq('DC-DEMO 写真なしなら記録に写真は付かない', demo.recipes.every((r) => r.cookedLogs.every((l) => l.photo === undefined)), true)
  // 写真を渡した分だけ付く(キーはpublic/demo/*.webpのファイル名と対応する)
  const photos = new Map(DEMO_PHOTO_KEYS.map((k) => [k, new Blob([k])]))
  const withPhotos = buildMonthDemoData(photos)
  const photoCount = withPhotos.recipes.reduce(
    (sum, r) => sum + r.cookedLogs.filter((l) => l.photo).length,
    0,
  )
  eq('DC-DEMO 写真は用意した枚数ぶん使う', photoCount, DEMO_PHOTO_KEYS.length)
}

// ---------- 便DH: 献立の「日」の内訳／料理の種別(2026-08-03) ----------
{
  const mk = (id, over = {}) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })

  // todayListPickedIds: 「レシピ一覧から選択中」＝今日の献立から②に出ている予定ぶんを引いた残り
  const tl = (...ids) => ids.map((recipeId) => ({ recipeId }))
  eq('DH-PICK 週プランに無い品だけが残る', todayListPickedIds(tl(1, 2, 3), [2]), [1, 3])
  eq('DH-PICK 並び順は今日の献立の登録順のまま', todayListPickedIds(tl(3, 1, 2), [2]), [3, 1])
  eq('DH-PICK 全部が予定なら空', todayListPickedIds(tl(1, 2), [1, 2]), [])
  // 再発防止(旧todayPlanMismatch): 週プランが空のときに空配列を返してはいけない。
  // 旧関数は「食い違い警告を出さない」ために0件時は空を返していたが、便DHでは同じ結果を
  // 「レシピ一覧から選択中」の見出しの中身として使うため、週プランが空なら全部がこちらに入る
  eq('DH-PICK 週プランが空でも今日の献立はそのまま選択中に入る', todayListPickedIds(tl(1, 2), []), [1, 2])

  // --- 便FN(2026-08-11 利用者テスト): 「全て作った！」のあと同じレシピを今日の献立に戻せない ---
  // ②「今週の献立の予定」は今日すでに作った品を出さない。①がその予定を引き算し続けると、
  // 入れ直した品が①からも②からも消える＝日タブが空のまま何をしても出てこなくなる
  eq(
    'FN-PICK ②に出ていない予定（作り終えた品）は①を塞がない',
    // 今日の予定は 1,2,3。全部作ったので②は0件。自分で1を入れ直した
    todayListPickedIds(tl(1), [], [1, 2, 3]),
    [1],
  )
  eq(
    'FN-PICK ②に出ている予定は今までどおり①に出さない（二重に並べない）',
    todayListPickedIds(tl(1, 2), [1], [1, 2, 3]),
    [2],
  )
  eq(
    'FN-PICK 予定の写し(fromPlan)は、予定が残っているかぎり①へ回さない（便DP-4の退行防止）',
    // 自動取り込みで入った写し。作り終えて②から消えても「レシピ一覧から選択中」にはしない
    todayListPickedIds([{ recipeId: 1, fromPlan: true }], [], [1]),
    [],
  )
  eq(
    'FN-PICK 予定が消えた写しは従来どおり①に残る（片付けは staleTodayListFromPlanIds の仕事）',
    todayListPickedIds([{ recipeId: 9, fromPlan: true }], [], [1]),
    [9],
  )

  // --- 便FS-1(2026-08-12 利用者テスト): 「今日の夕食に戻しました」と言われた品が、
  // 「今週の献立の予定/夕食」ではなく「レシピ一覧から選択中」に並び、
  // 「朝食に入れる／昼食に入れる／夕食に入れる」が未選択のまま付いていた ---
  eq('FS-PLAN 作っていない予定の行は今までどおり出す', showsCookedPlanRowToday(false, false), true)
  eq(
    'FS-PLAN 作って今日の献立から外れた品は出さない（作った後は予定でなく記録）',
    showsCookedPlanRowToday(true, false),
    false,
  )
  eq(
    'FS-PLAN 作ったあと今日の献立へ戻した品は、予定の行としてその食事に出す',
    showsCookedPlanRowToday(true, true),
    true,
  )
  eq(
    'FS-PICK 予定の行として出た品は「レシピ一覧から選択中」に重ねない',
    // 戻した品(1)は②に出るので、①の引き算の相手にも入る＝食事を選び直す行が出ない
    todayListPickedIds(tl(1), [1], [1, 2, 3]),
    [],
  )

  // todaySlotAddPlan: レシピ詳細の「今日の献立に追加」→ 朝食/昼食/夕食
  eq('FN-SLOT その食事にまだ無ければ予定に足す', todaySlotAddPlan([2, 3], 1, false), 'add')
  eq('FN-SLOT 作っていない同じ品が既にあれば二重（何もしない）', todaySlotAddPlan([1, 2], 1, false), 'duplicate')
  eq(
    'FN-SLOT 今日すでに作った品なら、行は増やさず今日の献立へ戻す',
    todaySlotAddPlan([1, 2], 1, true),
    'restore',
  )
  eq(
    'FN-SLOT 作った品でも、その食事に行が無ければ普通に足す',
    todaySlotAddPlan([2], 1, true),
    'add',
  )

  // staleTodayListFromPlanIds: 「週の予定を削除したあと、今日の献立に『レシピ一覧から選択中』
  // として残る」バグの再発防止(2026-08-03 便DP-4)。日タブの自動取り込み(便U-3)で入った写しは
  // fromPlan の印が付き、その予定が消えたら一緒に片付ける。自分で足した品(印なし)は残す
  {
    const item = (recipeId, fromPlan) =>
      fromPlan === undefined ? { recipeId } : { recipeId, fromPlan }
    eq(
      'DP-STALE 予定が消えた写しだけを片付ける',
      staleTodayListFromPlanIds([item(1, true), item(2, true)], [2]),
      [1],
    )
    eq(
      'DP-STALE 自分で足した品は予定に無くても残す(印なしは対象外)',
      staleTodayListFromPlanIds([item(1), item(2, true)], []),
      [2],
    )
    eq(
      'DP-STALE 予定がそのまま残っていれば何も消さない',
      staleTodayListFromPlanIds([item(1, true), item(2, true)], [1, 2]),
      [],
    )
    eq(
      'DP-STALE fromPlan:false も自分で足した扱い(消さない)',
      staleTodayListFromPlanIds([item(1, false)], []),
      [],
    )
    eq('DP-STALE 今日の献立が空なら何も消さない', staleTodayListFromPlanIds([], [1, 2]), [])
    // 週の予定を全部消した直後の再現ケース: 写しが2件とも取り残される
    eq(
      'DP-STALE 週の予定をまとめて空にしたら写しも全部片付ける',
      staleTodayListFromPlanIds([item(1, true), item(2, true), item(3)], []),
      [1, 2],
    )
  }

  // recipeDishType: dishTypeがあれば最優先・無ければ登録時と同じ推定にフォールバック
  eq('DH-TYPE 登録済みのdishTypeをそのまま使う', recipeDishType(mk(1, { dishType: 'soup' })), 'soup')
  eq('DH-TYPE その他(dessert)もそのまま', recipeDishType(mk(2, { dishType: 'dessert' })), 'dessert')
  eq(
    'DH-TYPE 未設定は推定に倒す(みそ汁→汁物)',
    recipeDishType(mk(3, { title: 'わかめのみそ汁' })),
    'soup',
  )
  eq(
    'DH-TYPE 未設定の肉料理は主菜',
    recipeDishType(mk(4, { title: '豚の生姜焼き', ingredients: [{ name: '豚こま' }] })),
    'main',
  )
  // 4区分は重ならない(種別チップは「どれか1つ」に必ず入る前提で並べている)
  eq(
    'DH-TYPE 判定結果は必ず4区分のどれか1つ',
    ['main', 'side', 'soup', 'dessert'].includes(recipeDishType(mk(5, { title: '謎の料理' }))),
    true,
  )

  // mealRoleForRecipe: 「今日の献立に追加」で入れた品が、週タブで全部『主菜』になっていた
  // バグの再発防止(2026-08-11 便FP・利用者テスト④「おひたしも味噌汁も主菜になっていた」)
  eq('FP-ROLE 汁物のレシピは汁物の行', mealRoleForRecipe(mk(1, { dishType: 'soup' })), 'soup')
  eq('FP-ROLE 副菜のレシピは副菜の行', mealRoleForRecipe(mk(2, { dishType: 'side' })), 'side')
  eq('FP-ROLE 主菜のレシピは主菜の行', mealRoleForRecipe(mk(3, { dishType: 'main' })), 'main')
  eq(
    'FP-ROLE 種別の「その他(dessert)」は献立の「その他」の行に読み替える',
    mealRoleForRecipe(mk(4, { dishType: 'dessert' })),
    'other',
  )
  eq(
    'FP-ROLE 種別が未設定なら登録時と同じ推定に倒す(みそ汁→汁物)',
    mealRoleForRecipe(mk(5, { title: 'わかめのみそ汁' })),
    'soup',
  )
  eq(
    'FP-ROLE 役割は必ず献立の4区分のどれか1つ(dessertは残らない)',
    MEAL_ROLES.includes(mealRoleForRecipe(mk(6, { title: '謎の料理' }))),
    true,
  )

}

// ---------- 便DV-1: 「今日なに作る?」の種別しぼり(2026-08-04 オーナー実機報告) ----------
// 再発防止: 「主菜〜その他の全ボタンを選択すると候補が減る」。
// 原因は「種別で絞ってから季節の優先(preferSeasonWithFallback)をかける」順で、季節の優先が
// 「季節の品が10品以上あればその季節だけに絞る」しきい値を持つため、入れる集合が大きいほど
// 出てくる集合が小さくなる逆転が起きていた。
{
  const mk = (id, over = {}) => ({
    id,
    title: `レシピ${id}`,
    servings: 2,
    effortLevel: 'easy',
    tags: [],
    ingredients: [],
    steps: [],
    isFavorite: false,
    cookedLogs: [],
    searchWords: [],
    createdAt: 0,
    updatedAt: 0,
    ...over,
  })
  // 主菜: 夏5品+通年50品 / 副菜: 夏4品+通年5品 / 汁物: 通年3品 / その他: 夏1品+通年2品
  // → 全体の夏はちょうど10品(=SEASON_MIN_CANDIDATES)で、実機で起きた条件と同じ形
  const pool = []
  let nextId = 1
  const add = (dishType, season, count) => {
    for (let i = 0; i < count; i += 1) {
      pool.push(mk(nextId++, { dishType, season }))
    }
  }
  add('main', 'summer', 5)
  add('main', 'all', 50)
  add('side', 'summer', 4)
  add('side', 'all', 5)
  add('soup', 'all', 3)
  add('dessert', 'summer', 1)
  add('dessert', 'all', 2)

  const ids = (list) => list.map((r) => r.id).sort((a, b) => a - b)
  const count = (types) => suggestionCandidates(pool, types, 'summer').length

  eq('DV-SUG 未選択(絞らない)は全レシピが候補', count([]), pool.length)
  eq('DV-SUG 全選択は未選択と同じ件数', count(DISH_TYPE_OPTIONS), count([]))
  eq(
    'DV-SUG 全選択と未選択は候補の中身まで一致する',
    ids(suggestionCandidates(pool, DISH_TYPE_OPTIONS, 'summer')),
    ids(suggestionCandidates(pool, [], 'summer')),
  )
  // 本丸: 種別を足していくと候補は必ず増える(減らない)
  eq('DV-SUG 主菜だけ=主菜の全品', count(['main']), 55)
  eq('DV-SUG 主菜+副菜は主菜だけより多い', count(['main', 'side']) > count(['main']), true)
  eq(
    'DV-SUG 主菜+副菜+汁物はさらに多い',
    count(['main', 'side', 'soup']) > count(['main', 'side']),
    true,
  )
  eq(
    'DV-SUG 全選択が最多(種別を増やして減らない)',
    count(DISH_TYPE_OPTIONS) >= count(['main', 'side', 'soup']),
    true,
  )
  // 種別ごとの候補は、その種別のレシピだけで構成される(混ざらない)
  eq(
    'DV-SUG 汁物だけ選べば汁物しか出ない',
    suggestionCandidates(pool, ['soup'], 'summer').every((r) => r.dishType === 'soup'),
    true,
  )
  // 選ぶ順番を変えても候補の並びは同じ(抽選のブレを作らない)
  eq(
    'DV-SUG 選んだ順番では候補の並びは変わらない',
    suggestionCandidates(pool, ['soup', 'main'], 'summer').map((r) => r.id),
    suggestionCandidates(pool, ['main', 'soup'], 'summer').map((r) => r.id),
  )
  // 季節の優先は種別ごとに効く: その種別に季節の品が10品以上あれば、その種別は季節の品だけになる
  {
    const seasonal = []
    for (let i = 0; i < 12; i += 1) seasonal.push(mk(100 + i, { dishType: 'main', season: 'summer' }))
    for (let i = 0; i < 20; i += 1) seasonal.push(mk(200 + i, { dishType: 'main', season: 'all' }))
    eq(
      'DV-SUG 季節の品が十分あればその種別は季節の品だけに絞る',
      suggestionCandidates(seasonal, ['main'], 'summer').length,
      12,
    )
  }
  // 0件回避(従来どおり): 選んだ種別に1品も無いときだけ、種別を外して全体から選ぶ
  {
    const onlyMain = [mk(1, { dishType: 'main', season: 'all' }), mk(2, { dishType: 'main', season: 'all' })]
    eq('DV-SUG 選んだ種別が0件なら種別を外して全体から選ぶ', suggestionCandidates(onlyMain, ['soup'], 'summer').length, 2)
    eq('DV-SUG 候補が空なら空のまま(0件回避も空)', suggestionCandidates([], ['soup'], 'summer').length, 0)
  }
  // dishType未設定のレシピも4区分のどれかに必ず入る(未選択と全選択が食い違わない担保)
  {
    const guessed = [
      mk(1, { title: 'わかめのみそ汁', season: 'all' }),
      mk(2, { title: '豚の生姜焼き', ingredients: [{ name: '豚こま' }], season: 'all' }),
      mk(3, { title: 'ほうれん草のおひたし', ingredients: [{ name: 'ほうれん草' }], season: 'all' }),
    ]
    eq(
      'DV-SUG dishType未設定でも全選択=未選択',
      ids(suggestionCandidates(guessed, DISH_TYPE_OPTIONS, 'summer')),
      ids(suggestionCandidates(guessed, [], 'summer')),
    )
  }
}

// ---------- 便DU: 月カレンダーの写真の選び方(logic/monthCover.ts) ----------
{
  // 写真はBlobでなくても選べる純関数なので、テストでは見分けのつく文字列を入れる
  const cand = (recipeId, logPhoto, recipePhoto) => ({ recipeId, logPhoto, recipePhoto })

  // 再発防止(2026-08-07 便DU・オーナー指摘「カレンダーにレシピのサムネしか出ない」の真因):
  // 旧実装は「その日の**先頭の記録**の写真 ?? そのレシピの写真」だったため、
  // 1品目に記録写真が無く2品目にある日は、自分で撮った写真ではなくレシピの写真が出ていた
  eq(
    'DU-COVER 記録の写真は、その日の何品目にあってもレシピの写真より優先する',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1'), cand(2, 'log2', 'recipe2')]),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER 記録の写真が複数あれば先頭の1枚',
    pickDayCoverPhoto([cand(1, 'log1', 'recipe1'), cand(2, 'log2')]),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER 記録の写真が1枚も無ければレシピの写真に落ちる',
    pickDayCoverPhoto([cand(1, undefined, undefined), cand(2, undefined, 'recipe2')]),
    { photo: 'recipe2', source: 'recipe', recipeId: 2 },
  )
  eq('DU-COVER 写真が1枚も無い日は選ばない', pickDayCoverPhoto([cand(1)]), undefined)
  eq('DU-COVER 記録が無い日も選ばない', pickDayCoverPhoto([]), undefined)

  // 「レシピの写真は使わない」(オーナー指示②)
  eq(
    'DU-COVER レシピの写真を使わない設定では、記録の写真だけを出す',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1'), cand(2, 'log2')], { hideRecipePhoto: true }),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER レシピの写真を使わない設定で記録の写真が無ければ、写真は出さない',
    pickDayCoverPhoto([cand(1, undefined, 'recipe1')], { hideRecipePhoto: true }),
    undefined,
  )

  // 日ごとの指名(オーナー指示③)
  eq(
    'DU-COVER 日ごとに選んだ料理の写真を最優先で出す',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2, 'log2')], { chosenRecipeId: 2 }),
    { photo: 'log2', source: 'log', recipeId: 2 },
  )
  eq(
    'DU-COVER 選んだ料理に記録の写真が無ければ、その料理のレシピの写真を出す',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2, undefined, 'recipe2')], { chosenRecipeId: 2 }),
    { photo: 'recipe2', source: 'recipe', recipeId: 2 },
  )
  eq(
    'DU-COVER 選んだ料理から1枚も取れないときは既定の優先順に戻す(写真が消えない)',
    pickDayCoverPhoto([cand(1, 'log1'), cand(2)], { chosenRecipeId: 2 }),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER その日に無いレシピが選ばれたまま残っていても既定の優先順に戻す',
    pickDayCoverPhoto([cand(1, 'log1')], { chosenRecipeId: 99 }),
    { photo: 'log1', source: 'log', recipeId: 1 },
  )
  eq(
    'DU-COVER 同じ料理を1日に2回作った日は、写真のある記録を採る',
    pickDayCoverPhoto([cand(1, undefined), cand(1, 'log1b')], { chosenRecipeId: 1 }),
    { photo: 'log1b', source: 'log', recipeId: 1 },
  )

  // 日ごとの選択の持ち方(設定に日付→レシピidで残す。選ばない日は載せない)
  eq('DU-COVER 選ぶと日付→レシピidで残る', setDayCoverChoice(undefined, '2026-08-07', 3), {
    '2026-08-07': 3,
  })
  eq(
    'DU-COVER 自動に戻すとその日の分だけ消える',
    setDayCoverChoice({ '2026-08-07': 3, '2026-08-08': 4 }, '2026-08-07', undefined),
    { '2026-08-08': 4 },
  )
  eq(
    'DU-COVER 選び直しは上書き(他の日は触らない)',
    setDayCoverChoice({ '2026-08-07': 3, '2026-08-08': 4 }, '2026-08-07', 9),
    { '2026-08-07': 9, '2026-08-08': 4 },
  )
}

// ---------- 便DU: 日の窓で何を変えたか(logic/dayEdit.ts) ----------
{
  const e = (id, recipeId, extra = {}) => ({ id, slot: 'dinner', role: 'main', recipeId, ...extra })
  const state = (entries, note = '') => ({ entries, note })

  eq(
    'DU-DAYEDIT 何も変えていなければ dirty=false(下は「閉じる」1つだけ)',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10)])),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 追加は added',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10), e(2, 11)])),
    { added: 1, removed: 0, changed: 0, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT 外したら removed',
    diffDayEdit(state([e(1, 10), e(2, 11)]), state([e(1, 10)])),
    { added: 0, removed: 1, changed: 0, noteChanged: false, dirty: true },
  )
  // 再発防止: 差し替え(updateMealEntryRecipe)は同じidのままレシピだけ変わる。
  // idで突き合わせないと「1品外して1品足した」に見え、確認文の件数が二重に出る
  eq(
    'DU-DAYEDIT 差し替えは changed 1件(外した+足したにしない)',
    diffDayEdit(state([e(1, 10)]), state([e(1, 12)])),
    { added: 0, removed: 0, changed: 1, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT 食数だけ変えても changed',
    diffDayEdit(state([e(1, 10)]), state([e(1, 10, { servings: 3 })])),
    { added: 0, removed: 0, changed: 1, noteChanged: false, dirty: true },
  )
  eq(
    'DU-DAYEDIT role未設定と主菜は同じ扱い(既存データを「変わった」と誤検知しない)',
    diffDayEdit(state([{ id: 1, slot: 'dinner', recipeId: 10 }]), state([e(1, 10)])),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 日付メモを書いたら noteChanged',
    diffDayEdit(state([e(1, 10)], ''), state([e(1, 10)], '外食')),
    { added: 0, removed: 0, changed: 0, noteChanged: true, dirty: true },
  )
  eq(
    'DU-DAYEDIT メモの前後の空白だけの違いは変更としない(保存側もtrimするため)',
    diffDayEdit(state([e(1, 10)], '外食'), state([e(1, 10)], ' 外食 ')),
    { added: 0, removed: 0, changed: 0, noteChanged: false, dirty: false },
  )
  eq(
    'DU-DAYEDIT 追加・差し替え・外す・メモが混ざっても全部数える',
    diffDayEdit(state([e(1, 10), e(2, 11)], 'もと'), state([e(1, 12), e(3, 13)], 'あと')),
    { added: 1, removed: 1, changed: 1, noteChanged: true, dirty: true },
  )
}

// ---------- 献立のロック(2026-08-08 便DX・オーナー指示) ----------
// 鍵の掛かった食事は「自動でまとめて動かす操作」の対象から外れる。守る経路は5つ:
// ①まとめて献立を入力(空き枠だけ/レシピを総入れ替えの両方) ②テンプレートを適用
// ③先週の献立をコピー ④まとめて空にする ⑤月の献立をまとめて提案。
// 手での編集は鍵が掛かっていても自由(=画面側の話)。
// 保存の粒度は「日付×食事」の1階層で、画面の「日ごと」は3食まとめての掛け外しとして表す
//
// 2026-08-09 便EJ: どの経路も「鍵ありの結果」だけを見ると、そもそも動く対象が無くて
// 何も起きなかっただけでも合格してしまう(実際にe2eのLOCK-5がこの形で素通りしていた)。
// 以後この節の断定は必ず「鍵なしなら動く／鍵ありでは鍵の枠だけが動かない」の対で書き、
// 鍵を掛けていない枠が実際に埋まった・実際に消えたことを同時に固定する
{
  const {
    mealLockKey,
    isMealSlotLocked,
    isDayMealLocked,
    planDayLockToggle,
    planSlotLockToggle,
    planAllLockToggle,
    planCopyLastWeek,
    planClearMealSlots,
  } = await import('../../src/logic/mealPlan.ts')
  const { planTemplateFill } = await import('../../src/logic/mealTemplate.ts')
  const keys = (...pairs) => new Set(pairs.map(([d, s]) => mealLockKey(d, s)))
  const sortedStrs = (set) => [...set].sort()

  // --- 2階層(日ごと/時間帯ごと)の掛け外し ---
  eq('DX-LOCK キーは 日付|食事', mealLockKey('2026-08-10', 'dinner'), '2026-08-10|dinner')
  eq(
    'DX-LOCK 時間帯ごと: 掛かっていなければ掛ける',
    planSlotLockToggle(new Set(), '2026-08-10', 'dinner'),
    { lock: [{ date: '2026-08-10', slot: 'dinner' }], unlock: [] },
  )
  eq(
    'DX-LOCK 時間帯ごと: 掛かっていれば外す',
    planSlotLockToggle(keys(['2026-08-10', 'dinner']), '2026-08-10', 'dinner'),
    { lock: [], unlock: [{ date: '2026-08-10', slot: 'dinner' }] },
  )
  eq(
    'DX-LOCK 日ごと: 3食とも掛かっているときだけ「日がロック済み」',
    isDayMealLocked(keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch']), '2026-08-10'),
    false,
  )
  eq(
    'DX-LOCK 日ごと: 3食そろえばロック済み',
    isDayMealLocked(
      keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch'], ['2026-08-10', 'dinner']),
      '2026-08-10',
    ),
    true,
  )
  eq(
    'DX-LOCK 日ごと: 掛かっていない食事にだけ掛ける(すでに掛かっている夕食は二重にしない)',
    planDayLockToggle(keys(['2026-08-10', 'dinner']), '2026-08-10'),
    {
      lock: [
        { date: '2026-08-10', slot: 'breakfast' },
        { date: '2026-08-10', slot: 'lunch' },
      ],
      unlock: [],
    },
  )
  eq(
    'DX-LOCK 日ごと: 3食そろっていれば3食とも外す',
    planDayLockToggle(
      keys(['2026-08-10', 'breakfast'], ['2026-08-10', 'lunch'], ['2026-08-10', 'dinner']),
      '2026-08-10',
    ).unlock.length,
    3,
  )
  // 「すべてロック」→ もう一度押すと「すべて解除」(トグル)
  {
    const dates = ['2026-08-10', '2026-08-11']
    const first = planAllLockToggle(new Set(), dates)
    eq('DX-LOCK すべてロック: 2日×3食=6件を掛ける', first.lock.length, 6)
    eq('DX-LOCK すべてロック: 外すものは無い', first.unlock.length, 0)
    const allLocked = new Set(first.lock.map(({ date, slot }) => mealLockKey(date, slot)))
    const second = planAllLockToggle(allLocked, dates)
    eq('DX-LOCK すべて解除: 全部掛かっていれば6件とも外す', second.unlock.length, 6)
    eq('DX-LOCK すべて解除: 掛けるものは無い', second.lock.length, 0)
    // 時間帯ごとに掛けた鍵だけが残っている状態から押すと、まず「全部掛ける」側になる
    const partial = keys(['2026-08-10', 'dinner'])
    eq(
      'DX-LOCK すべてロック: 一部だけ掛かっていれば残り5件を掛ける(解除にはしない)',
      planAllLockToggle(partial, dates).lock.length,
      5,
    )
  }

  // --- ①まとめて献立を入力(planWeekFill) ---
  // 4日ぶんを用意し、鍵あり／鍵なしを必ず対で比べる。
  //  08-10 … 鍵あり・自動の献立が入っている  → 消されないことを見る
  //  08-11 … 鍵あり・空                      → 埋められないことを見る
  //  08-12 … 鍵なし・自動の献立が入っている  → 総入れ替えで実際に消えることを見る
  //  08-13 … 鍵なし・空                      → どちらの入れかたでも実際に埋まることを見る
  {
    const week = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
    const today = '2026-08-10'
    const entries = [
      { id: 1, date: '2026-08-10', slot: 'dinner', recipeId: 11, role: 'main', auto: true },
      { id: 2, date: '2026-08-12', slot: 'dinner', recipeId: 12, role: 'main', auto: true },
    ]
    const locked = keys(['2026-08-10', 'dinner'], ['2026-08-11', 'dinner'])
    const slotDates = (plan) => plan.slotsToFill.map((s) => s.date)

    // 空き枠だけ埋める(keepAuto=true)。鍵が無ければ空いている08-11と08-13が埋まる
    const fillEmptyFree = planWeekFill(entries, week, ['dinner'], today, { keepAuto: true })
    eq(
      'DX-LOCK 一括入力(空き枠だけ・鍵なし): 空いている2日とも埋め対象になる',
      slotDates(fillEmptyFree),
      ['2026-08-11', '2026-08-13'],
    )
    const fillEmpty = planWeekFill(entries, week, ['dinner'], today, { keepAuto: true, lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力(空き枠だけ): ロック枠(空の08-11)だけが埋め対象から外れ、08-13は埋まる',
      slotDates(fillEmpty),
      ['2026-08-13'],
    )
    eq('DX-LOCK 一括入力(空き枠だけ): ロック枠の行は消さない', fillEmpty.entryIdsToRemove, [])
    eq('DX-LOCK 一括入力(空き枠だけ): ロック枠の数を返す', fillEmpty.lockedSlotCount, 2)

    // レシピを総入れ替え(replaceAll=true)でもロック枠は触らない。
    // 鍵が無ければ4日とも入れ直し、入っている2品(id=1,2)とも消える
    const replaceAllFree = planWeekFill(entries, week, ['dinner'], today, { replaceAll: true })
    eq('DX-LOCK 一括入力(総入れ替え・鍵なし): 4日とも入れ直す', slotDates(replaceAllFree), week)
    eq('DX-LOCK 一括入力(総入れ替え・鍵なし): 入っている2品とも消える', replaceAllFree.entryIdsToRemove, [1, 2])
    const replaceAll = planWeekFill(entries, week, ['dinner'], today, { replaceAll: true, lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力(総入れ替え): ロックしていない2日だけ埋め直す',
      replaceAll.slotsToFill.map((s) => `${s.date}|${s.slot}`),
      ['2026-08-12|dinner', '2026-08-13|dinner'],
    )
    eq('DX-LOCK 一括入力(総入れ替え): 消すのはロックしていない行だけ', replaceAll.entryIdsToRemove, [2])
    eq('DX-LOCK 一括入力(総入れ替え): ロック枠の中身は重複回避のusedに入る', replaceAll.usedRecipeIds.includes(11), true)
    eq('DX-LOCK 一括入力(総入れ替え): ロック枠の数を返す', replaceAll.lockedSlotCount, 2)

    // 料理が入っていない空の食事でも、鍵が掛かっていれば埋めない
    const emptyLocked = planWeekFill([], week, ['dinner'], today, { lockedKeys: locked })
    eq(
      'DX-LOCK 一括入力: 空の食事でも鍵が掛かっていれば入れない',
      slotDates(emptyLocked),
      ['2026-08-12', '2026-08-13'],
    )
    eq('DX-LOCK 一括入力: 鍵を使っていなければ従来どおり(件数0)', planWeekFill([], week, ['dinner'], today).lockedSlotCount, 0)
  }

  // --- ②テンプレートを適用(planTemplateFill) ---
  {
    // 2026-08-10(月)・2026-08-11(火)。月=dow0・火=dow1
    const base = {
      items: [
        { dow: 0, slot: 'dinner', role: 'main', recipeId: 21 },
        { dow: 1, slot: 'dinner', role: 'main', recipeId: 22 },
      ],
      dates: ['2026-08-10', '2026-08-11'],
      entries: [],
      today: '2026-08-10',
      allowedDows: [0, 1, 2, 3, 4, 5, 6],
      visibleSlots: ['dinner'],
    }
    // 鍵が無ければ2日とも入る(=鍵ありの結果が「元から入らなかっただけ」ではない証明)
    const free = planTemplateFill(base)
    eq('DX-LOCK テンプレ適用(鍵なし): 2日とも入る', free.ops.length, 2)
    eq('DX-LOCK テンプレ適用(鍵なし): ロック件数は0', free.lockedSlotCount, 0)
    const plan = planTemplateFill({ ...base, lockedKeys: keys(['2026-08-10', 'dinner']) })
    eq('DX-LOCK テンプレ適用: ロック枠には入れない(鍵の無い11日には入る)', plan.ops, [
      { date: '2026-08-11', slot: 'dinner', role: 'main', recipeId: 22 },
    ])
    eq('DX-LOCK テンプレ適用: ロック枠の数を返す', plan.lockedSlotCount, 1)
    eq('DX-LOCK テンプレ適用: ロック枠は「すでに決まっている」とは別に数える', plan.keptSlotCount, 0)
  }

  // --- ③先週の献立をコピー(planCopyLastWeek) ---
  {
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      entries: [],
      prevEntries: [
        { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
        { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
      ],
    }
    const free = planCopyLastWeek(base)
    eq('DX-LOCK 先週コピー(鍵なし): 2日分とも写す', free.ops.length, 2)
    eq('DX-LOCK 先週コピー(鍵なし): ロック件数は0', free.lockedSlotCount, 0)
    const locked = planCopyLastWeek({ ...base, lockedKeys: keys(['2026-08-10', 'dinner']) })
    eq('DX-LOCK 先週コピー: ロック枠には写さない', locked.ops, [
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    eq('DX-LOCK 先週コピー: ロック枠の数を返す', locked.lockedSlotCount, 1)
    eq('DX-LOCK 先週コピー: コピー元の品数は鍵に関わらず数える', locked.sourceTotal, 2)
  }

  // --- ④まとめて空にする(planClearMealSlots) ---
  {
    const entries = [
      { id: 1, date: '2026-08-10', slot: 'dinner', recipeId: 41 },
      { id: 2, date: '2026-08-10', slot: 'dinner', recipeId: 42 },
      { id: 3, date: '2026-08-11', slot: 'dinner', recipeId: 43 },
      { id: 4, date: '2026-08-11', slot: 'breakfast', recipeId: 44 },
    ]
    const plan = planClearMealSlots(entries, ['dinner'], keys(['2026-08-10', 'dinner']))
    eq('DX-LOCK まとめて空にする: ロック枠の行は消さない', plan.entryIdsToRemove, [3])
    eq('DX-LOCK まとめて空にする: 消す品数はロックぶんを引いた数', plan.targetCount, 1)
    eq('DX-LOCK まとめて空にする: 残す品数を返す', plan.lockedEntryCount, 2)
    eq('DX-LOCK まとめて空にする: ロック枠の数(食分)を返す', plan.lockedSlotCount, 1)
    eq(
      'DX-LOCK まとめて空にする: 選んでいない食事は鍵に関わらず触らない',
      planClearMealSlots(entries, ['dinner'], new Set()).entryIdsToRemove,
      [1, 2, 3],
    )
  }

  // --- ⑤月タブ「献立をまとめて提案」(planWeekFill を月の日付範囲＋keepAuto＋skipDatesで呼ぶ) ---
  // 画面側(fillMonth)は週の一括入力と同じ純ロジックを、対象範囲だけ月に広げて使う。
  // メモを書いた日(skipDates)を外す仕組みと鍵が同時に効くことを、鍵なしとの対で固定する
  {
    const month = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13']
    const today = '2026-08-10'
    const noteDates = ['2026-08-12'] // 「外食」などのメモを書いた日
    const monthArgs = { keepAuto: true, skipDates: noteDates }
    const free = planWeekFill([], month, ['dinner'], today, monthArgs)
    eq(
      'DX-LOCK 月の未定日提案(鍵なし): メモの日だけ外し、残り3日は埋め対象になる',
      free.slotsToFill.map((s) => s.date),
      ['2026-08-10', '2026-08-11', '2026-08-13'],
    )
    const locked = planWeekFill([], month, ['dinner'], today, {
      ...monthArgs,
      lockedKeys: keys(['2026-08-11', 'dinner']),
    })
    eq(
      'DX-LOCK 月の未定日提案: 鍵の日も外れ、鍵もメモも無い2日は実際に埋まる',
      locked.slotsToFill.map((s) => s.date),
      ['2026-08-10', '2026-08-13'],
    )
    eq('DX-LOCK 月の未定日提案: ロック枠の数を返す(確認文の件数に使う)', locked.lockedSlotCount, 1)
    eq('DX-LOCK 月の未定日提案: メモの日は鍵とは別に数える', locked.skippedDates, noteDates)
    eq('DX-LOCK 月の未定日提案: 非破壊(1品も消さない)', locked.entryIdsToRemove, [])
  }

  // 鍵は「その日その食事」だけに効く(隣の日・隣の食事へ漏れない)
  {
    const locked = keys(['2026-08-10', 'dinner'])
    eq('DX-LOCK 鍵は同じ日の別の食事には効かない', isMealSlotLocked(locked, '2026-08-10', 'lunch'), false)
    eq('DX-LOCK 鍵は別の日の同じ食事には効かない', isMealSlotLocked(locked, '2026-08-11', 'dinner'), false)
    eq('DX-LOCK 掛けた食事にだけ効く', sortedStrs(locked), ['2026-08-10|dinner'])
  }
}

// ---------- 便EA: 今日の「作った記録」を集計に入れる(オーナー指摘) ----------
// 従来は「過去日=作った記録／今日以降=登録した献立」で切っていたため、今日すでに作ったものが
// 記録として数えられず予定側で数えられていた。今日は「作った記録があるものは記録・
// まだのものは予定」で数え、同じ料理を二重に数えないことを固定する。
{
  const TODAY = '2026-08-08'
  // 玉ねぎ1個=50円(全量)/2人分 → 1人分25円、鶏もも200g=260円(全量)/2人分 → 1人分130円
  const idx = buildPriceIndex([
    { name: '玉ねぎ', pricePerUnit: 50, unit: '1個' },
    { name: '鶏もも肉', pricePerUnit: 130, unit: '100g' },
  ])
  const onion = { ingredients: [{ name: '玉ねぎ', amount: '1', unit: '個' }], servings: 2 }
  const chicken = { ingredients: [{ name: '鶏もも肉', amount: '200', unit: 'g' }], servings: 2 }

  // 今日: 肉じゃが(id=1)を予定に入れていて、もう作った。副菜(id=2)はまだ作っていない
  const cooked = [{ date: TODAY, recipe: chicken, recipeId: 1, log: { servings: 2 } }]
  const planned = [
    { date: TODAY, recipe: chicken, recipeId: 1 },
    { date: TODAY, recipe: onion, recipeId: 2 },
  ]
  const sum = summarizeRangeIntake({
    start: TODAY,
    end: TODAY,
    today: TODAY,
    cooked,
    planned,
    priceIndex: idx,
  })
  eq('EA-TODAY 今日の作った記録が記録側に入る(1品)', sum.actual.dishCount, 1)
  eq('EA-TODAY 作ったぶんは今日の予定から外れる(残り1品)', sum.plan.dishCount, 1)
  eq('EA-TODAY 二重計上ゼロ: 1人分の合計は 130 + 25 = 155円', sum.personalYen, 155)
  eq('EA-TODAY 二重計上ゼロ: 栄養も3品ではなく2品で数える', sum.nutrition.dishCount, 2)
  eq('EA-TODAY 今日の記録は「全員分(作った食数ぶん)」にも入る', sum.cookedHouseholdYen, 260)
  eq('EA-TODAY 今日の記録がある日は「記録がある日数」に数える', sum.cookedDayCount, 1)

  // 同じ料理を今日2枠に予定して1回だけ作った日は、片方だけが記録へ移り、もう片方は予定に残る
  {
    const twice = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked,
      planned: [
        { date: TODAY, recipe: chicken, recipeId: 1 },
        { date: TODAY, recipe: chicken, recipeId: 1 },
      ],
      priceIndex: idx,
    })
    eq('EA-TODAY 同じ料理を2枠に予定して1回作った日: 記録1品・予定1品', {
      actual: twice.actual.dishCount,
      plan: twice.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // 予定に無いものを今日作った日は、記録として足されるだけ(予定は減らない)
  {
    const extra = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked: [{ date: TODAY, recipe: onion, recipeId: 9 }],
      planned: [{ date: TODAY, recipe: chicken, recipeId: 1 }],
      priceIndex: idx,
    })
    eq('EA-TODAY 予定に無い品を作った日は、記録1品+予定1品の2品', {
      actual: extra.actual.dishCount,
      plan: extra.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // recipeId を渡さない古い呼び出しでは照合しない(今日の予定はそのまま予定で数える)
  {
    const noId = summarizeRangeIntake({
      start: TODAY,
      end: TODAY,
      today: TODAY,
      cooked: [{ date: TODAY, recipe: chicken }],
      planned: [{ date: TODAY, recipe: chicken }],
      priceIndex: idx,
    })
    eq('EA-TODAY recipeIdが無ければ照合しない(記録1品+予定1品)', {
      actual: noId.actual.dishCount,
      plan: noId.plan.dishCount,
    }, { actual: 1, plan: 1 })
  }
  // 明日の予定は、今日の記録があっても落とさない
  {
    const tomorrow = summarizeRangeIntake({
      start: TODAY,
      end: '2026-08-09',
      today: TODAY,
      cooked,
      planned: [
        { date: TODAY, recipe: chicken, recipeId: 1 },
        { date: '2026-08-09', recipe: chicken, recipeId: 1 },
      ],
      priceIndex: idx,
    })
    eq('EA-TODAY 明日の同じ料理の予定は落とさない', tomorrow.plan.dishCount, 1)
  }

  // カレンダーのセルも同じ規則(今日のセルが「予定だけ」にならない)
  {
    const cells = dayIntakeMap({
      dates: ['2026-08-07', TODAY, '2026-08-09'],
      today: TODAY,
      cooked: [{ date: '2026-08-07', recipe: onion, recipeId: 5 }, ...cooked],
      planned: [...planned, { date: '2026-08-09', recipe: onion, recipeId: 2 }],
      priceIndex: idx,
    })
    eq('EA-TODAY カレンダー: 今日のセルは記録1品+まだの予定1品の2品', cells.get(TODAY).dishCount, 2)
    eq('EA-TODAY カレンダー: 今日のセルは記録があれば「作った記録」の基準になる', cells.get(TODAY).basis, 'actual')
    eq('EA-TODAY カレンダー: 過去日は従来どおり記録だけ', cells.get('2026-08-07').basis, 'actual')
    eq('EA-TODAY カレンダー: 未来日は従来どおり予定だけ', cells.get('2026-08-09').basis, 'plan')
    eq('EA-TODAY カレンダー: 今日の1人分は 130 + 25 = 155円', cells.get(TODAY).yen, 155)
  }
}

// ---------- 便EA: ロックは手での削除・変更も止める(オーナー指示) ----------
{
  const { mealLockKey, isMealEditBlocked, MEAL_SLOT_EDITS } = await import(
    '../../src/logic/mealPlan.ts'
  )
  const keys = new Set([mealLockKey('2026-08-10', 'dinner')])
  for (const edit of MEAL_SLOT_EDITS) {
    eq(
      `EA-LOCK 鍵の掛かった食事では「${edit}」が止まる`,
      isMealEditBlocked(keys, '2026-08-10', 'dinner', edit),
      true,
    )
    eq(
      `EA-LOCK 鍵の無い食事では「${edit}」は止まらない`,
      isMealEditBlocked(keys, '2026-08-10', 'lunch', edit),
      false,
    )
    eq(
      `EA-LOCK 別の日の同じ食事では「${edit}」は止まらない`,
      isMealEditBlocked(keys, '2026-08-11', 'dinner', edit),
      false,
    )
  }
  eq(
    'EA-LOCK 止める操作は 追加・差し替え・削除・食数変更・行のサイコロ の5つ',
    [...MEAL_SLOT_EDITS],
    ['add', 'replace', 'remove', 'servings', 'suggest'],
  )
  eq('EA-LOCK 鍵を外せば元どおり操作できる', isMealEditBlocked(new Set(), '2026-08-10', 'dinner', 'remove'), false)
  /*
   * 2026-08-27 便LT（オーナー原文「「ロックしました。鍵を外すまで〜」→「ロックしました。」
   * 説明しすぎなので」）: 鍵を掛けたときの知らせから、効き目の説明（旧 lockEffectNote）を外した。
   *
   * 2026-08-08 のオーナー指示「削除と変更ができない事がわかる一文にして」を捨てたのではなく、
   * **言う場所を変えた**（掛けた直後 → 変えようとした瞬間）。だから見張りも場所ごと移す:
   *  ・掛けたときの知らせは、終わったことだけを言う（1文・説明を足さない）
   *  ・「削除も変更もできない」は、掛かったまま触ったときの案内が言い続ける
   */
  eq('EA-LOCK 効き目の説明は、掛けたときの知らせから外してある', 'lockEffectNote' in ja.mealPlan, false)
  eq(
    'EA-LOCK 掛けたときの知らせは1文（差し込み口も持たない＝説明を足せない形）',
    ja.mealPlan.lockDone.split('。').filter(Boolean).length === 1 &&
      !ja.mealPlan.lockDone.includes('{') &&
      !ja.mealPlan.lockAllDone.includes('{'),
    true,
  )
  eq(
    'EA-LOCK 「変更できない」は、鍵が掛かったまま触ったときの案内が言い続ける',
    ja.mealPlan.lockedEditBlocked.includes('変更'),
    true,
  )
}

// ---------- 便ID(2026-08-19 オーナーの書き溜め7件) ----------
// 直したもの: ②入れかたのボタンを短く横1列に ③「提案の条件」→「現在の条件」
// ⑤「多め/ひかえめ」の見出しと選択肢名の両立 ⑥先週コピーの説明 ⑦曜日カードの既定の折りたたみ。
// 画面の見え方(窓で開くこと・位置が動かないこと)は e2e の WEEKCOND-01 / WEEKFOLD-01 が受け持ち、
// ここでは**言葉と実際の動きが食い違っていないか**と、日付に依らない判定だけを見る
{
  const mealPlanLogic = await import('../../src/logic/mealPlan.ts')
  const { planCopyLastWeek } = mealPlanLogic
  // 読み取りに失敗したら必ず落ちる形にする（見張りが「関数が無いので測れませんでした」で
  // 素通りしないよう、無ければここで1件NGにしてから空の実装で先へ進む）
  eq(
    'ID-7 曜日カードの既定を決める関数がある（無ければ以下は測れていない）',
    typeof mealPlanLogic.planDefaultFoldedDates === 'function',
    true,
  )
  const planDefaultFoldedDates =
    typeof mealPlanLogic.planDefaultFoldedDates === 'function'
      ? mealPlanLogic.planDefaultFoldedDates
      : () => ['(関数が無い)']

  // --- ⑦ 曜日カードの既定(planDefaultFoldedDates) ---
  // オーナー原文「過去の日付は折りたたみ、献立が空欄の未来の日付も折りたたみ、
  // 献立ありの未来の日付は開いて表示にしたい」。
  //
  // 禁じ手①(曜日・月替わりの前提)よけ: 「今日」は引数で渡す形にして、
  // **月初・月末・年またぎ・うるう日**の4通りで同じ結論になることを固定する。
  // 実行日がいつでも通る＝この見張り自体が日付で赤くならない
  {
    const cases = [
      ['月末をまたぐ', '2026-08-31', ['2026-08-29', '2026-08-30', '2026-08-31', '2026-09-01', '2026-09-02']],
      ['年をまたぐ', '2026-12-31', ['2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']],
      ['月初', '2026-03-01', ['2026-02-26', '2026-02-27', '2026-03-01', '2026-03-02', '2026-03-03']],
      ['うるう日', '2028-02-29', ['2028-02-27', '2028-02-28', '2028-02-29', '2028-03-01', '2028-03-02']],
    ]
    for (const [name, today, dates] of cases) {
      const past = dates.filter((d) => d < today)
      const future = dates.filter((d) => d > today)
      // 未来の1日目にだけ献立を入れる＝「献立あり/なし」で開閉が分かれることを見る
      const withPlan = new Set([future[0]])
      const folded = planDefaultFoldedDates({ dates, today, datesWithPlan: withPlan })
      // 便LK: 過ぎた日が0日だと every は中身を見ずに true になる
      eq(
        `ID-7 ${name}: 過ぎた日はすべて畳む`,
        past.length > 0 && past.every((d) => folded.includes(d)),
        true,
      )
      eq(`ID-7 ${name}: 献立のある未来の日は開く`, folded.includes(future[0]), false)
      eq(`ID-7 ${name}: 献立の無い未来の日は畳む`, folded.includes(future[1]), true)
      eq(`ID-7 ${name}: 今日は献立が無くても開く`, folded.includes(today), false)
    }
    // 献立が1品も無い週でも、今日だけは開く(今日が入っていない週は全部畳む)
    eq(
      'ID-7 献立が1品も無い未来の週は全部畳む',
      planDefaultFoldedDates({
        dates: ['2026-09-07', '2026-09-08'],
        today: '2026-09-01',
        datesWithPlan: new Set(),
      }),
      ['2026-09-07', '2026-09-08'],
    )
    eq(
      'ID-7 過ぎた日は献立が入っていても畳む(過ぎた日は予定を出さない画面のため)',
      planDefaultFoldedDates({
        dates: ['2026-08-30'],
        today: '2026-09-01',
        datesWithPlan: new Set(['2026-08-30']),
      }),
      ['2026-08-30'],
    )
  }

  // --- ⑥ 「先週の献立をコピー」の説明が、実際の動きと食い違っていないこと ---
  // オーナー案は「そのまま入力します」または「上書きします」。実装(planCopyLastWeek)は
  // **すでに入っている食事を1つも書き換えない**ので、「上書きします」と書いた瞬間に
  // 画面の言葉が嘘になる(規約F)。動きと言葉を1か所で結んで固定する
  {
    const prevEntries = [
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      prevEntries,
    }
    eq(
      'ID-6 空いている枠には入る(何も起きないテストで素通りしていないことの担保)',
      planCopyLastWeek({ ...base, entries: [] }).ops.length,
      2,
    )
    eq(
      'ID-6 すでに献立が入っている枠には1品も入れない(＝上書きしない)',
      planCopyLastWeek({
        ...base,
        entries: [
          { date: '2026-08-10', slot: 'dinner' },
          { date: '2026-08-11', slot: 'dinner' },
        ],
      }).ops.length,
      0,
    )
    eq(
      'ID-6 埋まっている日と空いている日が混ざっていれば、空いている日にだけ入る',
      planCopyLastWeek({ ...base, entries: [{ date: '2026-08-10', slot: 'dinner' }] }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' }],
    )
    /*
     * 2026-08-27 便LT（オーナー原文「入れかたの説明文削除。」「この週の献立をコピー押下後、
     * 確認画面は日付確認のみ。「今ある〜」削除。」）: 入れかたの下の1行（旧 copyWeekFillEmptyHint /
     * copyWeekReplaceAllHint）と、空いた枠だけの確認の本文（旧 copyWeekConfirm）を無くした。
     * 見張りは、**上書きしないことが確認の見出しから読めること**へ移す
     * ＝入る先を「まだ決まっていないところ」と言い切っているので、今ある献立に触らないと読める
     * （規約Fの例外・2026-08-25 裁定D。しかもこれは足すだけで、消えるものが1つも無い操作）。
     */
    eq(
      'ID-6(便LT) 入れかたの下の説明と、空いた枠だけの確認の本文は無くしてある',
      'copyWeekFillEmptyHint' in ja.mealPlan ||
        'copyWeekReplaceAllHint' in ja.mealPlan ||
        'copyWeekConfirm' in ja.mealPlan,
      false,
    )
    eq(
      'ID-6(便LT) 空いた枠だけの確認の見出しが、入る先を「まだ決まっていないところ」と言い切る',
      ja.mealPlan.copyWeekConfirmTitle.includes('まだ決まっていないところ') &&
        !/上書きします/.test(ja.mealPlan.copyWeekConfirmTitle),
      true,
    )
  }

  // --- ⑤ 「多め/ひかえめ」の見出しと選択肢名の両立 ---
  // プルダウンの中は区分(多め/ひかえめ)＋項目名だけ、閉じたときの要約は「たんぱく質多め」。
  // 2つの表示名がずれると、選んだ名前と要約の名前が別物になる。組み立てで結んで固定する
  {
    const { MORE_MEAL_PURPOSES, LESS_MEAL_PURPOSES } = await import('../../src/db/types.ts')
    const summaryOf = (purpose) =>
      ({
        protein: ja.mealPlan.purposeProtein,
        fiber: ja.mealPlan.purposeFiber,
        iron: ja.mealPlan.purposeIron,
        calcium: ja.mealPlan.purposeCalcium,
        lowEnergy: ja.mealPlan.purposeLowEnergy,
        lowFat: ja.mealPlan.purposeLowFat,
        lowCarb: ja.mealPlan.purposeLowCarb,
        lowSalt: ja.mealPlan.purposeLowSalt,
      })[purpose]
    const groups = [
      [MORE_MEAL_PURPOSES, ja.mealPlan.purposeGroupMore],
      [LESS_MEAL_PURPOSES, ja.mealPlan.purposeGroupLess],
    ]
    const mismatched = []
    let counted = 0
    for (const [purposes, groupLabel] of groups) {
      for (const purpose of purposes) {
        counted++
        const option = ja.mealPlan.purposeOption?.[purpose]
        if (!option || `${option}${groupLabel}` !== summaryOf(purpose)) {
          mismatched.push(`${purpose}: 選択肢=${option} 区分=${groupLabel} 要約=${summaryOf(purpose)}`)
        }
      }
    }
    eq('ID-5 見張る軸が8つそろっている(0件なら見張りが壊れている)', counted, 8)
    eq('ID-5 選択肢名＋区分名＝要約の名前(たんぱく質＋多め＝たんぱく質多め)', mismatched, [])
    eq(
      `ID-5 選択肢名そのものには「${ja.mealPlan.purposeGroupMore}」「${ja.mealPlan.purposeGroupLess}」を付けない(区分と二重に言わない)`,
      // 区分の名前は ja.ts から取る(書き写すと、区分の名前を直したときにこの見張りが何も測らなくなる)
      Object.values(ja.mealPlan.purposeOption ?? {}).filter((v) =>
        [ja.mealPlan.purposeGroupMore, ja.mealPlan.purposeGroupLess].some((g) => v.includes(g)),
      ),
      [],
    )
  }

  // --- ② 入れかたの2つのボタン ---
  // オーナー原文「横一列にボタンを配置。２列だと情報量自体が多く感じ、直感的に２択だとわからない」。
  // 画面側は2列のグリッドで必ず横1列に置くが、名前が長いとボタンの中で折り返して背が伸びる。
  // 「一部の単語のみでも内容がなんとなくわかる」長さに収まっていることを字数で固定する
  {
    for (const [name, label] of [
      ['空き埋め', ja.mealPlan.fillModeFillEmpty],
      ['総入れ替え', ja.mealPlan.fillModeReplaceAll],
    ]) {
      eq(`ID-2 入れかたのボタン「${name}」は6文字以内`, label.length <= 6, true)
    }
    neq('ID-2 2つのボタンは違う名前', ja.mealPlan.fillModeFillEmpty, ja.mealPlan.fillModeReplaceAll)
    /*
     * 2026-08-27 便LT（オーナー原文「サブタイ「入れかた」の「「まとめて献立を入力」を押すと〜」の
     * 説明は削除。選択肢の文だけで理解できる。」）: 下の1行（旧 fillModeFillEmptyHint /
     * fillModeReplaceAllHint）を無くした。**背負わせる先を変えた**ので、見張りもそこへ移す:
     *  ・押しても今ある献立が動かないことは、終わったあとの知らせが品数で言う
     *  ・消える側（総入れ替え）で何が消えて何が残るかは、押すと必ず出る確認の窓が言う（規約F）
     * 消したはずの1行が黙って戻ってこないことも、ここで見張る
     */
    eq(
      'ID-2(便LT) 入れかたの下の説明は無くしてある（選択肢の名前と確認の窓が受け持つ）',
      'fillModeFillEmptyHint' in ja.mealPlan || 'fillModeReplaceAllHint' in ja.mealPlan,
      false,
    )
    eq(
      'ID-2(便LT) 空き埋めは、終わったあとの知らせが「そのままにした品数」を言う',
      ja.mealPlan.fillWeekKeptManual.includes('そのまま') &&
        ja.mealPlan.fillWeekKeptManual.includes('{n}'),
      true,
    )
    eq(
      'ID-2(便LT) 総入れ替えは、確認の窓が消えるものと残るものを両方言う（規約F）',
      ja.mealPlan.fillModeReplaceAllGone.includes('{n}') &&
        ja.mealPlan.fillModeReplaceAllKept.length > 0,
      true,
    )
  }

  // --- ③ 「提案の条件」→「現在の条件」 ---
  {
    eq('ID-3 ボタンの名前は「現在の条件」', ja.mealPlan.suggestConditionsToggle, '現在の条件')
    eq(
      'ID-3 条件を選んでいないときに出す言葉がある(コロンの後ろを空にしない)',
      typeof ja.mealPlan.suggestConditionsNone === 'string' &&
        ja.mealPlan.suggestConditionsNone.length > 0,
      true,
    )
    // 2026-08-22 便IY: 便IDは「ボタン=いまの状態・窓=これから使う条件」と役割で呼び分けたが、
    // **同じものを指しているのに2つの名前で呼んでいる**ため、押した先で名前が変わって見えた。
    // 司令部裁定でオーナーが実機で言及した「現在の条件」に寄せる（規約H）
    eq(
      'ID-3(便IY) 窓の見出しは、押したボタンと同じ名前（同じものを2つの名前で呼ばない）',
      ja.mealPlan.suggestConditionsTitle,
      ja.mealPlan.suggestConditionsToggle,
    )
  }
}

// ---------- 便IF(2026-08-19 オーナーの書き溜め。週タブを「日タブのできること増加版」に作り直す) ----------
// ここで見張るのは**日付に左右されない中身**だけ:
//   ⑧ 先週コピーに「入れかた」が効く（総入れ替えを選ぶと決まっている枠も入れ替わる／
//      選ばなければ1品も入れ替わらない）
//   ④ コピー元の7日間の日付を、文言に差し込む場所があること（「先週」と固定で書かない）
//   ⑪ 過去だけの週ではロックのボタンを出さない／今日以降が1日でもあれば出す
// 画面の並び・見た目（⑥②③）は e2e の WEEKFMT-01 が受け持つ。
//
// 禁じ手よけ:
//  ・曜日・月替わりの前提を置かない＝「今日」は引数で渡し、月末・年またぎ・うるう日でも同じ結論を見る
//  ・読み取りに失敗したら必ず落ちる（関数や文言が無いときは、素通りではなくその場で1件NGにする）
{
  const mealPlanLogicIF = await import('../../src/logic/mealPlan.ts')
  const { planCopyLastWeek: copyIF } = mealPlanLogicIF

  // --- ⑧ 先週コピー×入れかた(planCopyLastWeek の replaceAll) ---
  {
    const prevEntries = [
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      prevEntries,
    }
    // 両日ともすでに決まっている状態を土台にする（＝「入れ替わったか」を見分けられる形）
    const filled = [
      { id: 101, date: '2026-08-10', slot: 'dinner', recipeId: 91 },
      { id: 102, date: '2026-08-11', slot: 'dinner', recipeId: 92 },
    ]
    const keep = copyIF({ ...base, entries: filled })
    eq('IF-8 選ばなければ入れ替わらない: 1品も入れない', keep.ops.length, 0)
    eq(
      'IF-8 選ばなければ入れ替わらない: 1件も消さない',
      Array.isArray(keep.entryIdsToRemove) ? keep.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [],
    )
    const swap = copyIF({ ...base, entries: filled, replaceAll: true })
    eq(
      'IF-8 上書きを選ぶと、決まっている枠の行を消す',
      Array.isArray(swap.entryIdsToRemove) ? [...swap.entryIdsToRemove].sort((a, b) => a - b) : '(entryIdsToRemoveが無い)',
      [101, 102],
    )
    eq(
      'IF-8 上書きを選ぶと、コピー元の献立がその枠に入る',
      swap.ops,
      [
        { date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' },
        { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
      ],
    )
    eq(
      'IF-8 入れ替える食事の数を返す(規約Fの件数に使う)',
      swap.replacedSlotCount,
      2,
    )
    // 空いている枠しか無いときは、どちらの入れかたでも結果が同じ（消すものが無い）
    const emptyKeep = copyIF({ ...base, entries: [] })
    const emptySwap = copyIF({ ...base, entries: [], replaceAll: true })
    eq('IF-8 空いている枠には、どちらの入れかたでも入る(素通り防止)', emptyKeep.ops.length, 2)
    eq('IF-8 空いている枠だけなら、上書きを選んでも消すものは無い', emptySwap.entryIdsToRemove, [])
    // 鍵と過去日は「上書き」でも触らない（既存の約束を崩していないこと）
    const lockedSwap = copyIF({
      ...base,
      entries: filled,
      replaceAll: true,
      lockedKeys: new Set(['2026-08-10|dinner']),
    })
    eq(
      'IF-8 鍵の掛かった食事は、上書きを選んでも消さない',
      Array.isArray(lockedSwap.entryIdsToRemove) ? lockedSwap.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [102],
    )
    eq('IF-8 鍵の掛かった食事は、上書きを選んでも入れない', lockedSwap.ops, [
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    const pastSwap = copyIF({
      ...base,
      today: '2026-08-11',
      entries: filled,
      replaceAll: true,
    })
    eq(
      'IF-8 過ぎた日は、上書きを選んでも消さない',
      Array.isArray(pastSwap.entryIdsToRemove) ? pastSwap.entryIdsToRemove : '(entryIdsToRemoveが無い)',
      [102],
    )
    // コピー元にその食事が無い日は、総入れ替えでは空になる（自動提案の総入れ替えと同じ意味）。
    // 消える側の挙動なので、言葉（確認の窓の「消えるもの」）と数が食い違わないよう固定しておく
    const halfSource = copyIF({
      ...base,
      entries: filled,
      replaceAll: true,
      prevEntries: [prevEntries[0]],
    })
    eq(
      'IF-8 コピー元にその食事が無い日は、上書きを選ぶと空になる（消す行に数える）',
      Array.isArray(halfSource.entryIdsToRemove)
        ? [...halfSource.entryIdsToRemove].sort((a, b) => a - b)
        : '(entryIdsToRemoveが無い)',
      [101, 102],
    )
    eq(
      'IF-8 コピー元にある日にだけ、コピー元の献立が入る',
      halfSource.ops,
      [{ date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' }],
    )
  }

  // --- ⑪ 週タブの鍵をどの週で出すか ---
  // 2026-08-19 便IF・⑪では「過去だけの週では出さない」としていた（当時は過ぎた日の鍵に
  // 守るものが無かったため）。2026-08-22 便JF でその前提が2つとも崩れたので**巻き戻した**:
  //   ①「まとめて空にする」は**表示している週の全日（過ぎた日を含む）**を消す対象にしており、
  //     鍵はそれを止める唯一の手段だった＝過去だけの週では、消せるのに守れなかった
  //   ②過ぎた日にも編集モードが付き、作った記録を後から足せるようになった
  // オーナー原文（2026-08-22）「ロックボタンは芯ではないだけで、結果としてあることに意味が
  // 出ました。「今のまま」というのは、ロックボタンがある状態ですか？」
  //
  // 判断の関数（planShowWeekLock）は**消した**。どの週でも出すので、常に true を返す関数を
  // 残すと「出さない週がある」と読み違える。ここでは「出す・出さないを日付で分けていないこと」を
  // 画面の側で見張る（実際に出ることは e2e の JFLOCK-06 が測る）。
  {
    eq(
      'IF-11(便JFで巻き戻し) 鍵を出すかを日付で分ける関数は残っていない',
      typeof mealPlanLogicIF.planShowWeekLock,
      'undefined',
    )
    // 状態と手続きは 2026-08-27 便LQ（docs/74 第4手）で
    // src/pages/mealPlan/useMealPlanState.ts へ移した（中身は1文字も動かしていない）。
    // ここは**画面一式**を1つの本文として読む＝「残っていない」を見る側なので、
    // 片方だけ読むと**別のファイルへ移しただけで素通り**してしまう
    const mealPlanPageSrcIF = ['src/pages/MealPlanPage.tsx', 'src/pages/mealPlan/useMealPlanState.ts']
      .map((rel) =>
        readFileSync(path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', rel), 'utf-8'),
      )
      .join('\n')
    eq(
      'IF-11(便JFで巻き戻し) 画面側にも「過去だけの週では出さない」の分岐が残っていない',
      /showWeekLock/.test(mealPlanPageSrcIF),
      false,
    )
    // 見張りそのものが動いているか（掴み損ねて素通りの合格に倒れない）
    eq(
      'IF-11 前提: 鍵のボタンそのものは画面に残っている',
      /data-testid="day-lock"/.test(mealPlanPageSrcIF) &&
        /data-testid="lock-all"/.test(mealPlanPageSrcIF),
      true,
    )
  }

  // --- ④ コピー元の日付期間を文言に差し込む場所があること ---
  // オーナー原文「『先週の献立をコピー』に、コピー元の日付期間を書いてほしい」。
  // 表示している週を送ればコピー元も動くので、**文言に日付を書き込まず差し込み口を持つ**。
  // 実際に出る日付が画面の週と合っているかは e2e の WEEKFMT-01 が見る
  {
    // 2026-08-27 便LT: 入れかたの下の説明の1行は無くしたので、この一覧からも外した
    const rangeTexts = {
      '空いた枠だけの確認の窓の見出し': ja.mealPlan.copyWeekConfirmTitle,
      '総入れ替えの確認の窓の見出し': ja.mealPlan.copyWeekReplaceAllConfirmTitle,
      'コピー元が空のときの知らせ': ja.mealPlan.copyWeekNoSource,
    }
    for (const [name, text] of Object.entries(rangeTexts)) {
      eq(
        `IF-4 ${name}にコピー元の期間の差し込み口({start}と{end})がある`,
        typeof text === 'string' && text.includes('{start}') && text.includes('{end}'),
        true,
      )
      eq(
        `IF-4 ${name}は「先週」と決め打ちで書かない(選んだ週で変わるため)`,
        typeof text === 'string' && !text.includes('先週'),
        true,
      )
    }
  }

  // --- ⑧ 文言が、直した動きと食い違っていないこと ---
  {
    /*
     * 2026-08-27 便LT: 入れかたの下の説明の1行は無くした（ID-6 に理由を書いた）。
     * 「入れかたが効いている」ことを言う先は、**確認の窓**だけになったので、
     * 見張りも2つの入れかたで確認の窓が別物であることへ移す
     * （どちらも同じ窓になったら、入れかたが効かなくなった合図）。
     */
    eq(
      'IF-8(便LT) 入れかたごとに確認の窓の見出しが違う（入れかたが効いている）',
      ja.mealPlan.copyWeekConfirmTitle !== ja.mealPlan.copyWeekReplaceAllConfirmTitle,
      true,
    )
    eq(
      'IF-8(便LT) 総入れ替えの側だけが「入れ替え」と名乗る（足すだけの側と読み違えない）',
      ja.mealPlan.copyWeekReplaceAllConfirmTitle.includes('入れ替え') &&
        !ja.mealPlan.copyWeekConfirmTitle.includes('入れ替え'),
      true,
    )
    // 規約F: 消える側の確認は「何が消えて何が残るか」を件数つきで両方言う
    eq(
      'IF-8 総入れ替えのコピーの確認に、消える品数の差し込み口がある',
      typeof ja.mealPlan.copyWeekReplaceAllGone === 'string' &&
        ja.mealPlan.copyWeekReplaceAllGone.includes('{n}') &&
        ja.mealPlan.copyWeekReplaceAllGone.includes('{s}'),
      true,
    )
    eq(
      'IF-8 総入れ替えのコピーの確認に、残るものを言う文がある',
      typeof ja.mealPlan.copyWeekReplaceAllKept === 'string' &&
        ja.mealPlan.copyWeekReplaceAllKept.length > 0,
      true,
    )
  }

  // --- ⑥ 出しかたの2択(おまかせ／週をコピー)は 2026-08-21 便IO で無くした ---
  // 別の週から入れる道は専用の画面へ独立したので、この節に2択そのものが無い。
  // 「古い文言が残っていないこと」は IO-4 が見る（消したはずのキーが復活したら赤くなる）
}

// ============================================================================
// 2026-08-20 便II: 献立の画面（オーナー承認済みだったのに着手できていなかった分）
//
// 禁じ手よけ:
//  ・曜日・月替わりの前提を置かない＝「今日」もコピー元も引数で渡し、日付を固定して結論を見る
//  ・読み取りに失敗したら必ず落ちる（関数や文言が無いときは、素通りではなくその場で1件NGにする）
// ============================================================================
{
  const mealPlanLogicII = await import('../../src/logic/mealPlan.ts')
  const { planCopyLastWeek: copyII, suggestCandidates: candidatesII } = mealPlanLogicII

  // --- ⑤ コピー元の週を選べる（planCopyLastWeek の weeksBack） ---
  // オーナー原文「先週をコピーは、先週以外を今週に反映したい時に使えない。
  // 表示している週をコピーにはできない？」
  // 第1段階＝コピー先（表示している週）はそのままに、**コピー元の週を選べる**ようにした。
  // 1週間前だけを見る形だと「2週間前を今週へ」が永久にできないので、そこを固定する。
  {
    const prevEntries = [
      // 1週間前（2026-08-03の週）
      { date: '2026-08-03', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-04', slot: 'dinner', recipeId: 32, role: 'main' },
      // 2週間前（2026-07-27の週）
      { date: '2026-07-27', slot: 'dinner', recipeId: 21, role: 'main' },
      { date: '2026-07-28', slot: 'dinner', recipeId: 22, role: 'main' },
    ]
    const base = {
      dates: ['2026-08-10', '2026-08-11'],
      today: '2026-08-10',
      visibleSlots: ['dinner'],
      entries: [],
      prevEntries,
    }
    const oneWeek = copyII(base)
    eq('II-5 選ばなければ、これまでどおり1週間前を写す（後方互換）', oneWeek.ops, [
      { date: '2026-08-10', slot: 'dinner', recipeId: 31, role: 'main' },
      { date: '2026-08-11', slot: 'dinner', recipeId: 32, role: 'main' },
    ])
    eq('II-5 1週間前を明示しても、選ばなかったときと同じ結果になる', copyII({ ...base, weeksBack: 1 }).ops, oneWeek.ops)
    const twoWeeks = copyII({ ...base, weeksBack: 2 })
    eq('II-5 2週間前を選ぶと、2週間前の献立を写す', twoWeeks.ops, [
      { date: '2026-08-10', slot: 'dinner', recipeId: 21, role: 'main' },
      { date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' },
    ])
    eq('II-5 コピー元の品数も、選んだ週のぶんだけ数える', twoWeeks.sourceTotal, 2)
    // 選んだ週に献立が無ければ「写すものが無い」＝黙って別の週から拾わない
    eq(
      'II-5 選んだ週に献立が無ければ、1品も写さない（別の週から拾わない）',
      copyII({ ...base, weeksBack: 3 }).ops,
      [],
    )
    eq('II-5 選んだ週に献立が無ければ、コピー元の品数も0', copyII({ ...base, weeksBack: 3 }).sourceTotal, 0)
    // 過ぎた日・鍵の約束は、どの週を選んでも変わらない
    eq(
      'II-5 コピー元を変えても、過ぎた日には入れない',
      copyII({ ...base, weeksBack: 2, today: '2026-08-11' }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' }],
    )
    eq(
      'II-5 コピー元を変えても、鍵の掛かった食事には入れない',
      copyII({ ...base, weeksBack: 2, lockedKeys: new Set(['2026-08-10|dinner']) }).ops,
      [{ date: '2026-08-11', slot: 'dinner', recipeId: 22, role: 'main' }],
    )
  }

  // --- ⑤ 文言: 2026-08-21 便IO で「コピー元の週」のプルダウンごと無くした ---
  // 中身を見ながら週を送って選ぶ画面に置き換えたので、文言の見張りは IO-4 が引き継ぐ

  // --- ① 調理時間の条件は「優先」ではなく「除外」（文言を実装に合わせる） ---
  // オーナー原文「「何分以内を優先する？」→指定した時間より長いレシピも選ばれるということ？
  // 表記も長いし、ここだけ疑問系なのが気になる。シンプルに「時間」でいいと思う」
  // 実装（logic/mealPlan.ts の suggestCandidates）は候補から**外して**いる。
  // 調理時間が入っていないレシピも一緒に外れるので、そこも文言で言う。
  {
    // まず実装の側を固定する（文言だけ直して実装が別物、を作らない）
    const r = (id, cookMinutes) => ({
      id,
      title: `品${id}`,
      tags: [],
      ingredients: [],
      steps: [],
      cookedLogs: [],
      cookMinutes,
    })
    const pool = [r(1, 10), r(2, 30), r(3, undefined), r(4, 0)]
    const picked = candidatesII(pool, {
      quickOnly: true,
      quickMinutes: 15,
      excludeNg: false,
      ngIngredients: [],
      usedRecipeIds: [],
      slot: 'dinner',
      season: 'summer',
    })
    eq(
      'II-1 実装: 調理時間の条件は「優先」ではなく候補から外す（15分より長い品は残らない）',
      picked.map((x) => x.id).sort((a, b) => a - b),
      [1],
    )
    eq(
      'II-1 実装: 調理時間を入れていない品も候補から外れる（文言で言うべき事実）',
      picked.some((x) => x.id === 3 || x.id === 4),
      false,
    )
    for (const [name, text] of [
      ['欄の名前', ja.mealPlan.quickMinutesLabel],
      ['選択肢', ja.mealPlan.quickMinutesOption],
      ['説明の1行', ja.mealPlan.quickOnlyHint],
    ]) {
      eq(
        `II-1 調理時間の条件の${name}に「優先」と書かない（実装は除外なので嘘になる）`,
        typeof text === 'string' && text.length > 0 && !text.includes('優先'),
        true,
      )
    }
    eq(
      'II-1 欄の名前は疑問形にしない（ここだけ問いかけになっていた）',
      typeof ja.mealPlan.quickMinutesLabel === 'string' &&
        !ja.mealPlan.quickMinutesLabel.includes('？') &&
        !ja.mealPlan.quickMinutesLabel.includes('?'),
      true,
    )
    eq(
      'II-1 欄の名前は短くする（8文字以内）',
      typeof ja.mealPlan.quickMinutesLabel === 'string' && ja.mealPlan.quickMinutesLabel.length <= 8,
      true,
    )
    eq(
      'II-1 調理時間を入れていない品が外れることを、説明の1行で言う',
      typeof ja.mealPlan.quickOnlyHint === 'string' &&
        ja.mealPlan.quickOnlyHint.includes('調理時間を入れていない'),
      true,
    )
    eq(
      'II-1 「指定なし」を選べる（条件を外す道が同じ欄の中にある）',
      typeof ja.mealPlan.quickMinutesNone === 'string' && ja.mealPlan.quickMinutesNone.length > 0,
      true,
    )
  }
}


// ==========================================================================================
// 便IJ: 説明まわりの3件（2026-08-20・すべてオーナー承認済み）
//
//  ① アーカイブの注意書き（「一覧のみ・写真の拡大なし」を**書き出す前に**知らせる）
//  ② NG食材の印に短い言葉（印だけでは意味が分からない）
//  ③ バックアップまわりの説明を読みやすく（アプリ＋説明ページ）
//
// 禁じ手よけ:
//  ・**文言を書き写さない**。画面に出る文字は ja.ts から読み、位置は e2e が実DOMで測る
//  ・**読み取りに失敗したら必ず落ちる**。拾えた数が0のときは、その場で不合格にする
//  ・要素の置き場所・入れ子の段数に依存しない（ここは文言と規則だけを見る）
// ==========================================================================================
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const esc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const len = (t) => (typeof t === 'string' ? t.replace(/​/g, '').length : -1)
  /** 文言が消えていても見張りが落ちる形で読む（未定義で例外にすると、何が欠けたか出ない） */
  const lines = (v) => (Array.isArray(v) ? v : [])
  const str = (v) => (typeof v === 'string' ? v : '')

  // ---- ① アーカイブファイルの読みかた（書き出す前に読む注意書き） --------------------------
  // オーナー原文:
  //   「アーカイブが一覧のみになるのは注意書きはありますか？写真の拡大もできないし、
  //     情報が削れるなら先に知りたい。」
  // 測るのは利用者が確かめたいこと＝**何が入るか／どう読むか／戻せるか**が画面の文言にあること。
  // 「どこに出ているか」は e2e（IJ-01）が実DOMのY座標で測る（役割を二重にしない）。
  {
    const rows = ja.settings.archiveFileRows
    eq('IJ-1 アーカイブファイルの説明が表の形で用意されている', Array.isArray(rows) && rows.length >= 3, true)
    const rowsOk = Array.isArray(rows) ? rows : []
    eq(
      'IJ-1 表の各行に見出しの語と本文がある',
      rowsOk.filter((r) => !r || !r.name || !r.body),
      [],
    )
    const body = rowsOk.map((r) => `${r?.name ?? ''}: ${r?.body ?? ''}`).join('\n')
    // ファイルに何が入るかを名指しする（「情報が削れる」と読まれないため）。
    // 何を挙げるべきかは**ファイルの形**（logic/cookedArchive.ts の ArchivedCookedLog）から取る
    // ＝項目が増えたら、この見張りが「説明に足りていない」と教える
    const FILE_FIELDS = [
      { field: 'date', word: '日付' },
      { field: 'recipeTitle', word: '料理名' },
      { field: 'note', word: 'メモ' },
      { field: 'servings', word: '人分' },
      { field: 'photoBase64', word: '写真' },
    ]
    {
      const sample = buildArchiveFile([
        {
          id: 'ij-1',
          date: '2026-01-02',
          recipeTitle: 'テスト煮',
          note: 'ひとこと',
          servings: 2,
          photoBase64: 'AAAA',
          photoType: 'image/jpeg',
        },
      ])
      const inFile = Object.keys(sample.logs[0] ?? {})
      eq(
        'IJ-1 見張りが当たっている（アーカイブファイルの項目を読めている）',
        FILE_FIELDS.filter(({ field }) => !inFile.includes(field)),
        [],
      )
      eq(
        'IJ-1 ファイルに入る項目が、説明の「入るもの」から抜けていない',
        FILE_FIELDS.filter(({ word }) => !body.includes(word)).map((f) => f.word),
        [],
      )
    }
    // 読みかたの制限（一覧だけ・写真は拡大できない）
    eq(
      'IJ-1 読む手段が「アーカイブを見る」の一覧だけであることを書いている',
      str(ja.settings.archiveViewButton).length > 0 && body.includes(str(ja.settings.archiveViewButton)) && body.includes('一覧'),
      true,
    )
    eq('IJ-1 写真を拡大できないことを書いている', body.includes('拡大'), true)
    eq('IJ-1 アプリには戻せないことを書いている', body.includes('戻せ') || body.includes('戻す'), true)
    // 「情報が削れる」の誤解を打ち消す1行（消えるのは端末側の記録で、ファイルの中身は減らない）
    eq(
      'IJ-1 消えるのは端末の記録のほうだと書いている',
      typeof ja.settings.archiveFileKeepNote === 'string' &&
        ja.settings.archiveFileKeepNote.includes('端末') &&
        ja.settings.archiveFileKeepNote.includes('ファイル'),
      true,
    )
    // 端末から消す最後の関門（規約Fの窓）にも、同じ制限が出ること
    for (const [name, exported] of [
      ['レシピの中の記録だけ', { logs: 2, photos: 0, detachedLogs: 0, cutoff: '2026-07-16' }],
      ['残った記録も混ざる', { logs: 5, photos: 2, detachedLogs: 2, cutoff: '2026-07-16' }],
    ]) {
      const notes = buildArchiveDeleteConfirm(exported).notes ?? []
      eq(
        `IJ-1 消す前の確認にも読みかたの制限が出る（${name}）`,
        notes.some((n) => n.includes(str(ja.settings.archiveViewButton)) && n.includes('拡大')),
        true,
      )
    }
  }

  // ---- ② NG食材の印の隣に出す短い言葉 --------------------------------------------------
  // オーナー原文:
  //   「レシピから追加のNG食材について、マークだけあっても意味がわからない。
  //     NG食材あり、など超短く説明欲しい。」
  // ここでは文言の性質（短い・読み上げ用と別物・呼び名がそろっている）だけを見る。
  // どのカードに出す／出さないかは e2e（IJ-02）が実DOMで測る。
  {
    const short = str(ja.card.ngBadgeShort)
    eq('IJ-2 印の隣に出す短い言葉がある', typeof short === 'string' && short.length > 0, true)
    eq('IJ-2 「超短く」（6文字以内）', len(short) <= 6, true)
    neq('IJ-2 読み上げ用の説明とは別の文言', short, ja.card.ngBadge)
    // 呼び名をそろえる: 設定の欄名・絞り込みと同じ言葉で呼ぶ（同じものを別名で呼ばない）。
    // 「NG食材」という語そのものを書き写さず、**設定の欄名の先頭から**取る
    const ngWord = str(ja.settings.ngTitle).split('（')[0]
    eq(
      'IJ-2 見張りが当たっている（設定の欄名から呼び名を取れている）',
      ngWord.length >= 2 && str(ja.search.excludeNg).includes(ngWord),
      true,
    )
    eq('IJ-2 設定の欄名と同じ呼び名を使っている', short.includes(ngWord), true)
    // 画面に出す口が共通のカード部品にあること（画面ごとに書き写していない）
    const cardSrc = readFileSync(path.join(appRoot, 'src/components/RecipeCard.tsx'), 'utf-8')
    eq('IJ-2 共通のカード部品が短い言葉を出している', cardSrc.includes('ja.card.ngBadgeShort'), true)
    const others = ['src/pages', 'src/components']
      .flatMap((dir) =>
        // 2026-08-25 便KZ で src/pages/mealPlan/ ができたので、下の階層まで走査する
        readdirSync(path.join(appRoot, dir), { recursive: true })
          .filter((f) => f.endsWith('.tsx') && f !== 'RecipeCard.tsx')
          .map((f) => `${dir}/${f}`),
      )
      .filter((rel) => readFileSync(path.join(appRoot, rel), 'utf-8').includes('ngBadgeShort'))
    eq('IJ-2 短い言葉を画面側で書き写していない（出すのはカード部品だけ）', others, [])
  }

  // ---- ③ バックアップまわりの説明 ---------------------------------------------------------
  // オーナー原文:
  //   「バックアップまわりの説明が、文字ばかりで読みにくい。機種変更でアプリ卒業される。
  //     目につく単語だけで大体の内容を理解できるように、シンプルにしてください。
  //     詳しくは説明ページに案内すればOK。ただ、説明ページも同様に読みづらいので直してほしい。」
  //
  // 短くするときにいちばん危ないのは、**知らないと事故になる事実を一緒に消すこと**なので、
  // (a)並びの形 (b)事故になる事実 (c)説明ページの食い違い の3つを別々に測る。
  {
    // (a) 1つの塊だった説明が、短い行に分かれていること
    const SPLIT = [
      ['「作った記録」の写真のチェックの注記', ja.settings.backupIncludeCookedPhotosNotes],
      ['機種変更の注意', ja.settings.moveGuideNotes],
      ['ブラウザの設定でデータを消すときの注意', ja.settings.refreshAppCacheClearWarnings],
    ]
    for (const [name, lines] of SPLIT) {
      eq(`IJ-3 ${name}が短い行に分かれている`, Array.isArray(lines) && lines.length >= 2, true)
      eq(
        `IJ-3 ${name}の1行が長くなっていない（60字以内）`,
        (Array.isArray(lines) ? lines : []).filter((t) => len(t) > 60),
        [],
      )
    }
    // 書き出したあとの説明は「見出しの語＋短い本文」の形にする（目につく語だけで話が分かる）。
    // 2026-08-26 オーナー指示（書き溜め0826）「『端末が軽くなるのは』削除。『ファイルの場所』に
    // 内容だけ箇条書きで移動」で、見出しの語は2つ（ファイルの場所／そのあとのバックアップ）になり、
    // 「ファイルの場所」の本文は箇条書き（archiveWhereSavedLines）になった
    const LABELLED = [
      ['ファイルの場所', ja.settings.archiveWhereSavedLabel, lines(ja.settings.archiveWhereSavedLines).join('')],
      ['そのあとのバックアップ', ja.settings.archiveBackupLabel, ja.settings.archiveBackupNote],
    ]
    for (const [name, label, text] of LABELLED) {
      eq(`IJ-3 ${name}に見出しの語がある`, typeof label === 'string' && label.length > 0 && len(label) <= 12, true)
      eq(`IJ-3 ${name}の本文がある`, len(text) > 0, true)
    }
    // 箇条書きにした「ファイルの場所」は、1行ずつが短いこと（塊に戻さない）
    eq(
      'IJ-3 ファイルの場所が箇条書きに分かれている',
      Array.isArray(ja.settings.archiveWhereSavedLines) && ja.settings.archiveWhereSavedLines.length >= 2,
      true,
    )
    eq(
      'IJ-3 ファイルの場所の1行が長くなっていない（60字以内）',
      lines(ja.settings.archiveWhereSavedLines).filter((t) => len(t) > 60),
      [],
    )
    eq(
      'IJ-3 「端末が軽くなるのは」の見出しの語は残っていない',
      ['archiveSpaceLabel', 'archiveSpaceNote'].filter((k) => k in ja.settings),
      [],
    )
    // 見出しを消しても、端末が軽くなる条件（外へ移す＋端末の記録を消す）は落としていない
    {
      const where = lines(ja.settings.archiveWhereSavedLines).join('\n')
      eq(
        'IJ-3 端末が軽くなる条件（外へ移す・端末の記録を消す）が残っている',
        [/端末の外へ移/.test(where), /端末の記録を消/.test(where)],
        [true, true],
      )
    }
    eq('IJ-3 そのあとのバックアップの本文が長くなっていない（60字以内）', len(ja.settings.archiveBackupNote) <= 60, true)

    // (b) 知らないと事故になる事実が、**アプリの中から**消えていないこと。
    // 言い回しは規約Hで変わり続けるので、事実の核になる語だけを見る。
    // あわせて「その文言が設定の画面から参照されているか」も見る＝ja に残っていても
    // 画面から外れていたら落ちる（説明ページへ送っただけ、を事故にしない）。
    const screenSrc = ['src/pages/SettingsPage.tsx', 'src/logic/backup.ts', 'src/logic/cookedArchive.ts']
      .map((rel) => readFileSync(path.join(appRoot, rel), 'utf-8'))
      .join('\n')
    const HAZARDS = [
      {
        name: '「作った記録」の写真は既定でバックアップに入らない',
        key: 'backupIncludeCookedPhotosNotes',
        text: lines(ja.settings.backupIncludeCookedPhotosNotes).join('\n'),
        must: [/OFF/, /写真/, /入りません|入らず|入らない/],
      },
      {
        name: 'バックアップファイルには解錠コードが入る（他の人に渡さない）',
        key: 'backupContainsCodeNotice',
        text: str(ja.settings.backupContainsCodeNotice),
        must: [/解錠コード/, /渡さない/],
      },
      {
        name: '「データを上書き」は今のデータを消す',
        key: 'importReplaceCaption',
        text: str(ja.settings.importReplaceCaption),
        must: [/今のデータ/, /消して|消す/],
      },
      {
        name: '「元に戻す」はこの設定画面を離れると使えない',
        key: 'backupImportReplaceNote',
        text: str(ja.settings.backupImportReplaceNote),
        must: [new RegExp(esc(str(ja.settings.replaceUndoButton))), /画面/, /戻せません|使えなく/],
      },
      {
        name: '「前回の場所に上書き」がどのファイルを書き換えるか分かる',
        key: 'backupOverwriteNoteWithName',
        text: str(ja.settings.backupOverwriteNoteWithName),
        must: [/\{name\}/, /上書き/],
      },
      {
        name: '機種変更: 記録の写真はチェックをONにしてから書き出す',
        key: 'moveGuideStep1Note',
        text: str(ja.settings.moveGuideStep1Note),
        must: [/写真/, /ON/],
      },
      {
        name: '機種変更: 新しい端末の中身が上書きで消える／手放すのは確かめてから',
        key: 'moveGuideNotes',
        text: lines(ja.settings.moveGuideNotes).join('\n'),
        must: [/上書き/, /消え/, /初期化|下取り/, /確かめて/],
      },
      {
        name: 'ブラウザの設定でサイトデータを消すと全部消える（戻せるのはバックアップだけ）',
        key: 'refreshAppCacheClearWarnings',
        text: lines(ja.settings.refreshAppCacheClearWarnings).join('\n'),
        must: [/Cookie/, /消え/, /バックアップ/],
      },
      {
        name: '書き出しただけでは端末の記録は減らない（消すのは別のボタン）',
        key: 'archiveDeleteNote',
        text: `${lines(ja.settings.archiveSteps).join('\n')}\n${str(ja.settings.archiveDeleteNote)}`,
        must: [new RegExp(esc(str(ja.settings.archiveDeleteButton))), /確かめて/],
      },
      {
        name: '端末から消した記録は、そのあとのバックアップに入らない',
        key: 'archiveBackupNote',
        // 見出しの語と本文で1つの話（見出しに「バックアップ」、本文に「入りません」）
        text: `${str(ja.settings.archiveBackupLabel)}\n${str(ja.settings.archiveBackupNote)}`,
        must: [/バックアップ/, /入りません/, /控え/],
      },
      {
        name: 'ファイル名の「.json」を消すと読み込むときに選べない',
        key: 'fileNameFreeNote',
        text: str(ja.settings.fileNameFreeNote),
        must: [/\.json/, /選べ/],
      },
    ]
    eq('IJ-3 見張りが対象を拾えている（事故になる事実の一覧が空でない）', HAZARDS.length >= 10, true)
    eq(
      'IJ-3 事故になる事実の文言が、どれも空になっていない',
      HAZARDS.filter((h) => len(h.text) === 0).map((h) => h.name),
      [],
    )
    eq(
      'IJ-3 事故になる事実が、アプリの中から1つも消えていない',
      HAZARDS.flatMap((h) =>
        h.must.filter((re) => !re.test(h.text)).map((re) => `${h.name} ← ${re}`),
      ),
      [],
    )
    eq(
      'IJ-3 事故になる事実の文言が、設定の画面から参照されている（説明ページへ送っただけにしない）',
      HAZARDS.filter((h) => !screenSrc.includes(h.key)).map((h) => h.name),
      [],
    )

    // (c) 説明ページとアプリの食い違い: 書いてあるファイル名の頭が、実際に書き出す名前と合うこと。
    // 2026-08-20 便IH・④でアーカイブの名前を records → archive に変えたとき、使い方ページだけが
    // 古い名前のまま残っていた（アプリと説明ページで別の名前を案内していた）。
    // 個別の文字列を書き写さず、**「uchi-recipe-◯◯-」の形を掃いて実際の名前と突き合わせる**。
    {
      const realNames = [
        backupFileName(new Date(2026, 7, 2)),
        selectedRecipesFileName(new Date(2026, 7, 2)),
        archiveFileName(new Date(2026, 7, 2)),
      ]
      // 見るのは**利用者の目に触れる文字**だけ。作りのコメント（「records から archive に変えた」
      // のような経緯のメモ）は画面に出ないので落とす
      const noComments = (src) =>
        src
          .replace(/\/\*[\s\S]*?\*\//g, ' ')
          .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
          .replace(/<!--[\s\S]*?-->/g, ' ')
      const targets = [
        { rel: 'src/i18n/ja.ts', text: noComments(readFileSync(path.join(appRoot, 'src/i18n/ja.ts'), 'utf-8')) },
      ]
      const aboutDir = path.join(appRoot, 'public/about')
      for (const name of readdirSync(aboutDir).filter((f) => f.endsWith('.html')).sort()) {
        targets.push({
          rel: `public/about/${name}`,
          text: noComments(readFileSync(path.join(aboutDir, name), 'utf-8')),
        })
      }
      const found = []
      const wrong = []
      for (const { rel, text } of targets) {
        for (const m of text.matchAll(/uchi-recipe-[a-z]+-/g)) {
          found.push(`${rel} ${m[0]}`)
          if (!realNames.some((n) => n.startsWith(m[0]))) wrong.push(`${rel} 「${m[0]}」`)
        }
      }
      eq('IJ-3 見張りが当たっている（ファイル名の頭を1つ以上拾えている）', found.length > 0, true)
      eq(
        'IJ-3 説明ページとアプリが同じファイル名を案内している',
        wrong,
        [],
      )
    }
  }
}


// ==========================================================================================
// 便IL: URLからの取り込み5件（2026-08-20 オーナー実機報告・プリンのレシピ）
// ==========================================================================================

// ---------- KI-1 / KI-2（2026-08-24 便KI・オーナー実機）----------
// オーナー原文:
//   「レシピ一覧から選択中から『夕食に入れる』した場合、今週の献立にもとからあった夕食の主菜と
//     入れ替えに消える。もしくは既存レシピと入れ替えになって、全て入らない。追加のみしてください。」
//
// 何が起きていたか（2026-08-24 に実データで再現）:
//   (a) 夕食に主菜「肉じゃが」がある状態で、主菜「鶏の唐揚げ」の「夕食に入れる」を押すと、
//       肉じゃがが**行ごと差し替わって消えた**（planRoleAssign が kind:'replace' を返していた）。
//   (b) 主菜を3品選んで順に「夕食に入れる」を押すと、押すたびに前の1品を置き換えるので
//       最後の1品しか残らない＝「全て入らない」。
//
// 直しかた: この入口は**足すだけ**にする。役割が主菜でも既存の主菜を差し替えない
//   ＝ planRoleAssign から 'replace' を無くす（返しうるのは 'add' と 'duplicate' の2つだけ）。
// 上限は設けない。同じ枠へ入れる他の入口（週の行の「＋料理を追加」・レシピ詳細の
//   「今日の献立に追加」→食事を選ぶ・レシピ一覧の選択→「今日の献立に入れる」）はどれも
//   上限を持たないので、ここだけ止めると同じ枠なのに押すボタンで結果が変わる。
// 重複（同じ料理が同じ枠にすでにある）は今までどおり足さない＝同じ料理が2行に並ぶと、
//   作った記録の対応付け（cookedPlanEntryIds）がどちらか1行だけを「作った」に見せて読めなくなる。
{
  const main1 = { id: 1, recipeId: 10, role: 'main' }
  const side1 = { id: 2, recipeId: 20, role: 'side' }
  eq(
    'KI-1 (a)の再発防止: 主菜の料理を入れても、その枠の主菜は消えない（差し替えず追加する）',
    planRoleAssign([main1], 30, 'main'),
    { kind: 'add' },
  )
  eq(
    'KI-1 (a)の再発防止: 主菜と副菜が入っている枠でも、主菜の料理は追加になる',
    planRoleAssign([main1, side1], 30, 'main'),
    { kind: 'add' },
  )
  eq(
    'KI-1 role未設定の既存データ(2026-07-13より前)も消さない＝主菜の料理は追加になる',
    planRoleAssign([{ id: 5, recipeId: 11 }], 30, 'main'),
    { kind: 'add' },
  )
  eq(
    'KI-1 (b)の再発防止: 主菜を続けて入れても、前に入れた主菜は残る（2品目も追加になる）',
    planRoleAssign(
      [
        { id: 1, recipeId: 10, role: 'main' },
        { id: 2, recipeId: 30, role: 'main' },
      ],
      40,
      'main',
    ),
    { kind: 'add' },
  )
  eq(
    'KI-1 「入れる」が献立を消す道は1つも残っていない（返しうるのは追加と重複だけ）',
    ['main', 'side', 'soup', 'other']
      .map((role) => planRoleAssign([main1, side1], 30, role).kind)
      .filter((kind) => kind !== 'add' && kind !== 'duplicate'),
    [],
  )
  // 上限は設けない（2026-08-24 オーナー原文「追加のみは上限なしでいいと思います。
  // 2回目だったら追加済みであることのお知らせを出せばよいのでは？」）。
  // 違う料理なら、その枠にいくつ入っていても足せる＝押しても入らない枠を作らない
  eq(
    'KI-1 上限は無い: 主菜が5品入っている枠でも、違う主菜はさらに足せる',
    planRoleAssign(
      [1, 2, 3, 4, 5].map((n) => ({ id: n, recipeId: n * 10, role: 'main' })),
      99,
      'main',
    ),
    { kind: 'add' },
  )
  eq(
    'KI-1 上限は無い: 主菜・副菜・汁物・その他が並んでいる枠でも足せる',
    planRoleAssign(
      [
        { id: 1, recipeId: 10, role: 'main' },
        { id: 2, recipeId: 20, role: 'side' },
        { id: 3, recipeId: 30, role: 'soup' },
        { id: 4, recipeId: 40, role: 'other' },
      ],
      50,
      'main',
    ),
    { kind: 'add' },
  )
  // 2回目（同じ料理をもう一度）は足さずに知らせるだけ。知らせは**すでにあるものを使う**
  // （新しい文言を足すと、同じことを2つの言い方で書くことになる）
  eq(
    'KI-1 2回目の知らせが用意されている（すでに入っていることを料理名つきで言う）',
    ja.mealPlan.planMismatchAlready.includes('{title}') &&
      ja.mealPlan.planMismatchAlready.includes('{slot}'),
    true,
  )
  {
    // 状態と手続きは 2026-08-27 便LQ（docs/74 第4手）で
    // src/pages/mealPlan/useMealPlanState.ts へ移した（中身は1文字も動かしていない）。
    // ここは**画面一式**を1つの本文として読む＝分ける前と同じものを見ている
    const kiPageSrc = ['src/pages/MealPlanPage.tsx', 'src/pages/mealPlan/useMealPlanState.ts']
      .map((rel) =>
        readFileSync(path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', rel), 'utf-8'),
      )
      .join('\n')
    eq(
      'KI-1 「◯食に入れる」の2回目は、その用意された知らせを出している',
      kiPageSrc.includes('ja.mealPlan.planMismatchAlready'),
      true,
    )
    // 「すでに◯◯に入っています」を言う文言を、この機会に増やさない（同じことを2つの言い方で
    // 書かないため。場面ごとに1本ずつあり、「◯食に入れる」の2回目は planMismatchAlready を使う）
    eq(
      'KI-1 「すでに入っています」と言う文言が増えていない（2回目の知らせを新しく作らない）',
      Object.entries(ja.mealPlan)
        .filter(([, v]) => typeof v === 'string' && v.includes('すでに') && v.includes('入っています'))
        .map(([k]) => k)
        .sort(),
      ['monthDayModalDirtyNote', 'planMismatchAlready', 'todayAddOneAlready', 'todaySuggestAllAlready'],
    )
    eq(
      'KI-1 レシピ詳細側の同じ知らせは、今までどおりそちらで使われている（重複して作らない）',
      readFileSync(
        path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/pages/RecipeDetailPage.tsx'),
        'utf-8',
      ).includes('ja.detail.todaySlotDuplicateToast'),
      true,
    )
  }
  eq(
    'KI-1 同じ料理が既にその枠にあれば足さない（同じ料理を2行に増やさない）',
    planRoleAssign([main1, side1], 20, 'side'),
    { kind: 'duplicate' },
  )
  eq(
    'KI-1 同じ料理が主菜として入っている枠に、主菜として押しても足さない',
    planRoleAssign([main1], 10, 'main'),
    { kind: 'duplicate' },
  )
}

