// 並行調理ナビ（手順の分類・時間・段取りの組み立てと並べ替え）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
// 便KO（2026-08-25）: 取り込みで入らない項目と、1品に複数料理が入った品の見分け
import {
  missingImportFields,
  recipeGenreTag,
  tagsWithGenre,
  IMPORT_FIELD_KEYS,
  IMPORT_FIELD_NOTICE_SEEN_KEY,
} from '../../src/logic/importFieldGaps.ts'
import { detectMultiDish, multiDishCount } from '../../src/logic/multiDishImport.ts'
import {
  hasFillableWorkDuringWait,
  classifyStep,
  resolveStepMinutes,
  buildCookTimeline,
  buildCookPlan,
  isHandsOnStep,
  stepCategory,
  cutOrderRank,
  buildPlanSteps,
  isSoakWait,
  isLongRestStep,
  endsWithLongRest,
  showsWaitTimerButton,
  recipeServeTemp,
  estimateActiveMinutes,
  waitUrgency,
  waitOverrunAllowance,
  splitBoilWaterClause,
  splitMixedStep,
  splitWaitFirstStep,
  resolveWaitMinutes,
  recipeStepLabel,
  hasParallelCue,
  stepHeatShift,
  heatOffAtEnd,
  waitTimerSeconds,
  BOIL_WATER_MINUTES,
} from '../../src/logic/cookNavi.ts'
import {
  stepAppliance,
  stepApplianceFor,
  applianceCapacity,
  APPLIANCE_KEYS,
  kitchenFromSettings,
  clampBurners,
  DEFAULT_KITCHEN,
} from '../../src/logic/cookAppliance.ts'
import {
  parseCookNaviSession,
  restoreCookNaviSession,
  serializeCookNaviSession,
  reconcileSelectedIds,
  resolveCookNaviSelection,
  COOK_NAVI_SESSION_VERSION,
} from '../../src/logic/cookNaviSession.ts'
import {
  assignRecipeNotes,
  classifyRecipeNote,
  recipeNoteStepKey,
  splitRecipeNoteLines,
} from '../../src/logic/naviRecipeNotes.ts'
import {
  moveStepDownPull,
  moveStepUpPull,
  reorderIssues,
  reorderIssuesByStep,
  reorderStepKey,
} from '../../src/logic/cookReorder.ts'
import { applyStepPulls, resolveCursor } from '../../src/logic/cookSession.ts'
import {
  stepIngredientAmounts,
  recipeIngredientList,
} from '../../src/logic/naviIngredients.ts'
import {
  buildIngredientNames as naviIngredientNames,
  findIngredientMatches as naviIngredientMatches,
} from '../../src/logic/ingredientSpans.ts'
import { stepMinutesFromText, importedStepMinutes } from '../../src/logic/importStepMinutes.ts'
import { starterDefs } from '../../src/db/starters.ts'
import { ja } from '../../src/i18n/ja.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

// ---------- hasFillableWorkDuringWait(並行調理ナビ: 待ちの「この間に、次の手作業を進められます」を
// 出す条件。最後の待ちに出さない=2026-07-09ペルソナ第2波 / 同じ品の続きの手順に出さない=2026-08-12 便FS-2) ----------
{
  // 段取りの時刻つき（待ちを仕掛けても料理人の時計は進まないので、
  // 待ちの中に入る手作業は待ちが明ける前に始まる）
  const items = [
    { kind: 'active', startMin: 0, endMin: 4 },
    { kind: 'wait', startMin: 4, endMin: 19 }, // 15分の待ち。中に別の品の手作業が入る
    { kind: 'active', startMin: 4, endMin: 8 },
    { kind: 'wait', startMin: 8, endMin: 23 }, // 最後の待ち(後続の手作業なし)
  ]
  eq('ナビ: 待ちの中に入る手作業があればヒントあり', hasFillableWorkDuringWait(items, 1), true)
  eq('ナビ: 最後の待ちはヒントなし', hasFillableWorkDuringWait(items, 3), false)
  eq(
    'ナビ: 後続が待ちだけでもヒントなし',
    hasFillableWorkDuringWait(
      [
        { kind: 'active', startMin: 0, endMin: 4 },
        { kind: 'wait', startMin: 4, endMin: 9 },
        { kind: 'wait', startMin: 4, endMin: 14 },
      ],
      1,
    ),
    false,
  )
  // 便FS-2(2026-08-12 利用者テスト): 「鍋にだし汁…2分ほど煮る」の待ちに
  // 「この間に、次の手作業を進められます」と出るが、次は「火を弱め、みそを溶き入れる」＝
  // 同じ鍋の続き。同じ品の続きは待ちが明けてからしか始まらない（段取りの時刻がそう置く）ので、
  // 「待ちが明ける前に始まる手作業があるか」で判定すれば構造的に出なくなる
  eq(
    'ナビ: 次の手作業が待ちの明けたあと（同じ品の続き）ならヒントなし',
    hasFillableWorkDuringWait(
      [
        { kind: 'wait', startMin: 10, endMin: 12 }, // 味噌汁: 2分煮る
        { kind: 'active', startMin: 12, endMin: 14 }, // 味噌汁: 火を弱めてみそを溶く
      ],
      0,
    ),
    false,
  )
  eq(
    'ナビ: 同じ品の続きの後ろに、待ちの中へ入る別の品の手作業があればヒントあり',
    hasFillableWorkDuringWait(
      [
        { kind: 'wait', startMin: 10, endMin: 25 },
        { kind: 'active', startMin: 10, endMin: 14 },
      ],
      0,
    ),
    true,
  )
  eq('ナビ: 段取りに無い添字なら出さない', hasFillableWorkDuringWait(items, 99), false)
}

// ---------- findRunningStepTimer(手順のタイマーが動いているか・2026-08-12 便FS-5) ----------
{
  const { stepTimerKey, findRunningStepTimer } = await import('../../src/logic/timerOrder.ts')
  const t = (key, over) => ({ key, done: false, ...over })
  const timers = [
    t(stepTimerKey(7, 2, 120)), // レシピ7の手順3（stepIndex=2）で2分
    t(stepTimerKey(9, 0, 300)),
    t(stepTimerKey(7, 20, 60)), // 手順21。「7-2-」で拾ってはいけない
  ]
  eq('FS-TIMER その手順で動いていれば見つかる', findRunningStepTimer(timers, 7, 2)?.key, '7-2-120')
  eq('FS-TIMER 手順が違えば見つからない', findRunningStepTimer(timers, 7, 1), undefined)
  eq('FS-TIMER 手順番号の桁違いを取り違えない(7-2 と 7-20)', findRunningStepTimer(timers, 7, 20)?.key, '7-20-60')
  eq('FS-TIMER レシピが違えば見つからない', findRunningStepTimer(timers, 8, 2), undefined)
  eq(
    'FS-TIMER 鳴り終わったタイマーは動作中に数えない(「タイマーを始める」に戻す)',
    findRunningStepTimer([t(stepTimerKey(7, 2, 120), { done: true })], 7, 2),
    undefined,
  )
  eq(
    'FS-TIMER 一時停止中も動作中として扱う(「始める」に戻すと二重に立つ)',
    findRunningStepTimer([t(stepTimerKey(7, 2, 120), { pausedRemainingMs: 5000 })], 7, 2)?.key,
    '7-2-120',
  )
  eq('FS-TIMER 自分で決めた時間のタイマーは手順に紐付けない', findRunningStepTimer([t('custom-navi-180')], 0, 0), undefined)
}

// ---------- classifyStep(並行調理ナビ: フライパンの「焼く」は目を離せないので手作業系のまま。
// 素の/焼/を待ち系から外し、蒸し焼き・グリル・オーブン・レンジだけ待ち系にする。2026-07-14 Fable/Codexレビュー) ----------
{
  eq(
    'ナビ分類: 素の「焼く」は手作業系(焦げ付き事故防止のため待ちにしない)',
    classifyStep({ text: '5分焼く', minutes: 5 }),
    'active',
  )
  eq(
    'ナビ分類: 「蒸し焼き」は待ち系(フタして基本放置でよい)',
    classifyStep({ text: '8分蒸し焼きにする', minutes: 8 }),
    'wait',
  )
  eq(
    'ナビ分類: 「グリルで焼く」は待ち系(点火後は基本放置)',
    classifyStep({ text: 'グリルで10分焼く', minutes: 10 }),
    'wait',
  )
  eq(
    'ナビ分類: 「オーブンで焼く」は待ち系(既存挙動の回帰確認)',
    classifyStep({ text: 'オーブンで15分焼く', minutes: 15 }),
    'wait',
  )
  eq(
    'ナビ分類: 「炒める」は従来どおり手作業系(回帰確認)',
    classifyStep({ text: '3分炒める', minutes: 3 }),
    'active',
  )
}

// ---------- classifyStep / resolveStepMinutes(並行調理ナビ: step.minutesが空でも本文の時間表記から
// 待ち分数を推定して分類する。2026-07-23 便BI・Fable裁定。貼り付け/URL取り込みのレシピはminutesが
// 空になる実態への対応。安全側=待ち動詞ホワイトリスト維持・迷ったら手作業・明示minutes最優先) ----------
{
  // 本文から待ち分数を推定して待ち系に分類する(minutes未設定=貼り付け相当)
  eq('ナビ推定: 「鍋で15分煮る」(minutes無)は待ち系', classifyStep({ text: '鍋で15分煮る' }), 'wait')
  eq('ナビ推定: 「弱火で20分煮込む」(minutes無)は待ち系', classifyStep({ text: '弱火で20分煮込む' }), 'wait')
  eq('ナビ推定: 「10分蒸らす」(minutes無)は待ち系', classifyStep({ text: '10分蒸らす' }), 'wait')
  eq('ナビ推定: 「そのまま10分おく」(minutes無)は待ち系', classifyStep({ text: 'そのまま10分おく' }), 'wait')
  eq('ナビ推定: 「600Wで3分加熱する」(minutes無)は待ち系(レンジ出力ワット数)', classifyStep({ text: '600Wで3分加熱する' }), 'wait')
  // 安全側: 待ち動詞でない工程は本文に時間があっても手作業系のまま
  eq('ナビ推定: 「5分炒める」(minutes無)は手作業系(炒めは目を離せない)', classifyStep({ text: '5分炒める' }), 'active')
  eq('ナビ推定: 「フライパンで3分焼く」(minutes無)は手作業系(素の焼く)', classifyStep({ text: 'フライパンで3分焼く' }), 'active')
  // 安全側: 1分未満(秒だけ)の待ちは並行の実益が無いので手作業系に倒す
  eq('ナビ推定: 「30秒茹でる」(minutes無)は手作業系(秒だけの待ちは並行しない)', classifyStep({ text: '30秒茹でる' }), 'active')
  // 2026-08-08 便ED で仕様変更: 時間の書かれていない待ち工程にも、時間が読める調理法
  // (煮る・ゆでる・蒸す 等)なら既定分数を当てる(docs/68 打ち手#1(a))。「じっくり煮込む」は待ち10分。
  // 表に無い待ち動詞(なじませる 等)は従来どおり手作業系のまま＝汎用フォールバックは置かない
  eq('ナビ推定: 「じっくり煮込む」は待ち系(調理法から既定分数10分)', classifyStep({ text: 'じっくり煮込む' }), 'wait')
  eq(
    'ナビ推定: 「味がなじむまでおく」は手作業系(既定分数の表に無い動詞)',
    classifyStep({ text: '味がなじむまでおく' }),
    'active',
  )
  // 待ち動詞も時間も無いふつうの工程は手作業系
  eq('ナビ推定: 「材料を切る」は手作業系', classifyStep({ text: '材料を切る' }), 'active')

  // resolveStepMinutes: 明示minutesが本文推定より優先される(明示データ>推定)
  eq('ナビ推定: 明示minutesは本文の時間より優先(15分本文でもminutes:20を採用)', resolveStepMinutes({ text: '15分煮る', minutes: 20 }), 20)
  eq('ナビ推定: minutes無なら本文の15分を採用', resolveStepMinutes({ text: '鍋で15分煮る' }), 15)
  eq('ナビ推定: 複数の時間表記があれば最長を採用(10分煮て5分蒸らす→10)', resolveStepMinutes({ text: '10分煮て5分蒸らす' }), 10)
  eq('ナビ推定: 秒だけ(30秒)は推定対象外(undefined)', resolveStepMinutes({ text: '30秒茹でる' }), undefined)
  eq('ナビ推定: 時間表記が無ければundefined', resolveStepMinutes({ text: 'じっくり煮込む' }), undefined)

  // タイムライン: 貼り付け相当(minutes無)でも長い待ちが認識され、隙間に別レシピの手作業が入る
  const timeline = buildCookTimeline([
    { id: 1, title: '煮物', steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const simmer = timeline.items.find((it) => it.text === '鍋で15分煮る')
  eq('ナビ組立: minutes無の「15分煮る」が待ち系として計上される', simmer?.kind, 'wait')
  eq('ナビ組立: minutes無でも待ち分数が本文から15分として入る', simmer?.waitMinutes, 15)
  // 待ち(order 2)の直後に別レシピ(サラダ)の手作業が差し込まれている=並行化されている
  const simmerOrder = simmer?.order ?? 0
  const nextItem = timeline.items.find((it) => it.order === simmerOrder + 1)
  eq('ナビ組立: 15分の待ちの隙間に別レシピの手作業が差し込まれる', nextItem?.recipeTitle, 'サラダ')
}

// ---------- buildCookTimeline(並行調理ナビ: フライパン焼き中に他レシピを差し込ませない。
// 2026-07-14 Fable/Codexレビュー) ----------
{
  const recipes = [
    {
      id: 1,
      title: '鮭のムニエル',
      steps: [
        { text: '下味をつける' },
        { text: 'フライパンで5分焼く', minutes: 5 },
        { text: '盛り付ける' },
      ],
    },
    {
      id: 2,
      title: 'サラダ',
      steps: [{ text: '野菜を切る' }, { text: 'ドレッシングを和える' }],
    },
  ]
  const timeline = buildCookTimeline(recipes)
  const yakuStep = timeline.items.find((it) => it.text === 'フライパンで5分焼く')
  eq('ナビ組立: 「焼く」は手作業系として計上される', yakuStep?.kind, 'active')
  eq('ナビ組立: 「焼く」は待ち扱いにならない(waitMinutes=0)', yakuStep?.waitMinutes, 0)
}

// ---------- isHandsOnStep / classifyStep(並行調理ナビ: 目を離せない工程は短くても待ちにしない。
// 2026-08-08 便EB・オーナー実機報告「肉巻きおにぎりの『焦げやすいので』の手順が待ちに分類され、
// 2分しかないのに他レシピの作業が挟まる」) ----------
{
  // 報告された実データそのもの(src/sets/pack07.ts 肉巻きおにぎり 手順5)
  const nikumaki = {
    text: 'しょうゆ・みりん・砂糖を加え、たれを絡めながら照りが出るまで煮からめる。',
    minutes: 2,
    memo: '焦げやすいので、フライパンをゆすりながらたれをからめること。',
  }
  eq('ナビ付きっきり: 肉巻きおにぎりの「煮からめる」は手作業系', classifyStep(nikumaki), 'active')
  eq('ナビ付きっきり: 肉巻きおにぎりの「煮からめる」を目を離せない工程と判定', isHandsOnStep(nikumaki), true)
  // 根拠が本文にある場合/memoにある場合のどちらでも拾う
  eq(
    'ナビ付きっきり: 本文の「煮からめる」だけでも手作業系',
    classifyStep({ text: 'たれを加えて煮からめる。', minutes: 3 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 注意書きの「焦げやすいので」だけでも手作業系',
    classifyStep({ text: 'グリルで3分焼く。', minutes: 3, memo: 'みそだれは焦げやすいので様子を見ること。' }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「絶えず混ぜながら」は手作業系',
    classifyStep({ text: '弱めの中火で2分ほど煮る。', minutes: 2, memo: '絶えず混ぜながら煮ること。' }),
    'active',
  )
  eq('ナビ付きっきり: 「煮詰める」は手作業系', classifyStep({ text: 'とろみが出るまで煮詰める。', minutes: 2 }), 'active')
  eq('ナビ付きっきり: 「炒り煮にする」は手作業系', classifyStep({ text: 'しょうゆを加えて炒り煮にする。', minutes: 4 }), 'active')
  eq('ナビ付きっきり: 「目を離さない」は手作業系', classifyStep({ text: '弱火で5分温める。', minutes: 5, memo: '目を離さないこと。' }), 'active')

  // 本物の待ちを潰さない(条件つきの注意は付きっきりにしない)。ここを緩めると機能価値が落ちる
  eq(
    'ナビ付きっきり: 「焦げないように水を足す」条件つき注意は待ちのまま',
    classifyStep({
      text: '落としぶたをして弱めの中火で15分ほど煮る。',
      minutes: 15,
      memo: '途中で煮汁がなくなりそうなら少量の水を足すこと（焦げつき防止）。',
    }),
    'wait',
  )
  eq(
    'ナビ付きっきり: 「焦げつきそうなら」も待ちのまま(ラタトゥイユ相当)',
    classifyStep({ text: 'ふたをして弱めの中火で煮る。', minutes: 12, memo: '焦げつきそうなら水を大さじ1ずつ足すこと。' }),
    'wait',
  )
  eq(
    'ナビ付きっきり: 「時々上下を返しながら」浸す工程は待ちのまま',
    classifyStep({ text: '食パンを卵液に浸し、時々上下を返しながらしっかり吸わせる。', minutes: 10 }),
    'wait',
  )

  // 待ち動詞より後ろに炒め・揚げが来る手順＝実体は炒め工程(旧実装はフライパンから目を離させていた)
  eq(
    'ナビ付きっきり: 「なじむまで炒める」は手作業系(卯の花)',
    classifyStep({ text: '生おからを加え、全体に油がなじむまで炒める。', minutes: 2 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「漬け汁ごと入れて炒める」は手作業系(えび)',
    classifyStep({ text: 'えびを漬け汁ごと入れて炒める。器に盛る。', minutes: 3 }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「炒め、…15分煮る」は待ちのまま(最後の動作が煮る)',
    classifyStep({ text: '鍋で鶏肉と野菜を炒め、水を加えて中火で15分煮る。', minutes: 15 }),
    'wait',
  )
  // 「チン」の誤爆(チンゲン菜・キッチンペーパー)を待ち動詞にしない
  eq(
    'ナビ分類: 「チンゲン菜を1分炒め」は手作業系(「チン」の誤爆を直す)',
    classifyStep({ text: 'チンゲン菜の茎を加えて強めの中火で1分炒める。', minutes: 1 }),
    'active',
  )
  eq(
    'ナビ分類: 「レンジで2分加熱」は従来どおり待ち系',
    classifyStep({ text: 'レンジで2分加熱する。', minutes: 2 }),
    'wait',
  )
  eq(
    'ナビ分類: 「重しをのせて10分水切りする」は待ち系(放置してよい)',
    classifyStep({ text: '木綿豆腐はキッチンペーパーに包み、重しをのせて水切りする。', minutes: 10 }),
    'wait',
  )
}

// ---------- classifyStep(並行調理ナビ: 時間の書かれていない待ち工程に調理法ごとの既定分数を当てる。
// 2026-08-08 便ED・docs/68 6-4。ユーザーが登録したレシピ(取り込み・手入力)は手順の分数欄が空で、
// 本文にも時間が書かれていないため待ちが1つも見つからず、段取りが1品ずつ作るのと同じになっていた。
// 既定分数は「時間が読める調理法」だけに当て、歯止め3つ(位置ルール・「さっと」・「〜ておく」)を必ず添える。
// **推定した分数はナビの計算にだけ使い、レシピのデータには書き込まない** ----------
{
  /**
   * 手順1つだけのレシピを組んで、その手順の判定と待ち分数を実際のタイムラインから読む。
   * ナビが足した工程（ゆでる手順の前の「湯を沸かす」）は読み飛ばす（2026-08-08 便EG）。
   */
  const only = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find((it) => !it.addedByNavi)
  /**
   * その手順の**待ちの工程**を読む。2026-08-13 便GD で、手作業と待ちが同居する手順は
   * 段取りの上で2つに分かれるようになった（「水を入れて｜煮る」）ので、
   * 1工程めだけを見ると待ち分数が読めない。
   */
  const waitOf = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find(
      (it) => !it.addedByNavi && it.kind === 'wait',
    )

  // (a) 既定分数テーブル: 時間の手掛かりが無い待ち工程も、調理法から分かる分だけ待ちにする
  eq('ナビ既定分数: 「水を沸かす」は待ち5分', only({ text: '水を沸かす' }).kind, 'wait')
  eq('ナビ既定分数: 「水を沸かす」の待ちは5分', only({ text: '水を沸かす' }).waitMinutes, 5)
  eq('ナビ既定分数: 「じゃがいもをゆでる」は待ち8分', only({ text: 'じゃがいもをゆでる' }).kind, 'wait')
  eq('ナビ既定分数: 「じゃがいもをゆでる」の待ちは8分', only({ text: 'じゃがいもをゆでる' }).waitMinutes, 8)
  // 「水を入れて煮る」は手作業（水を入れる）と待ち（煮る）が同居する手順なので、
  // 段取りの上では2工程になる（2026-08-13 便GD）。待ちは10分のまま
  eq('ナビ既定分数: 「水を入れて煮る」は待ち10分', waitOf({ text: '水を入れて煮る' }).kind, 'wait')
  eq('ナビ既定分数: 「水を入れて煮る」の待ちは10分', waitOf({ text: '水を入れて煮る' }).waitMinutes, 10)
  eq('ナビ既定分数: 「水を入れて煮る」の手作業も0分にしない', only({ text: '水を入れて煮る' }).activeMinutes > 0, true)

  // (a') 汎用フォールバックは置かない: 表に無い待ち動詞(なじませる)は従来どおり手作業のまま
  eq(
    'ナビ既定分数: 「残りの野菜も加えて油をなじませる」は手作業(表に無い動詞に一律の分数を当てない)',
    classifyStep({ text: '残りの野菜も加えて油をなじませる' }),
    'active',
  )

  // (b) 位置ルール: 手順の最後に来る動作が待ち動詞のときだけ待ちにする
  eq(
    'ナビ位置ルール: 「…中火にかけ、表面全体に焼き色をつけていきます」は手作業',
    classifyStep({ text: 'フライパンを強めの中火にかけ、表面全体に焼き色をつけていきます' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「…煮立ったら浮いてきたアクを取ります」は手作業',
    classifyStep({ text: '大根としょうが、水と調味料をすべて加え、煮立ったら浮いてきたアクを取ります' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「粗熱が取れたら殻をむく」は手作業(むく=手作業動詞)',
    classifyStep({ text: 'ゆで上がったらすぐ冷水にとり、粗熱が取れたら殻をむく。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 分数が入っている手順には位置ルールを当てない(ユーザーの入力を尊重)',
    classifyStep({ text: '落としぶたをして15分煮る。途中でアクを取る。', minutes: 15 }),
    'wait',
  )

  // (c) 除外語: 「さっと」「〜ておく」には既定分数を当てない
  eq('ナビ除外語: 「熱湯でさっとゆでる」は手作業', classifyStep({ text: '熱湯でさっとゆでる' }), 'active')
  eq(
    'ナビ除外語: 「…混ぜ合わせてたれを作っておく」は手作業(〜ておく)',
    classifyStep({ text: 'しょうゆ・みりん・酒・砂糖を混ぜ合わせてたれを作っておく' }),
    'active',
  )
  // 名詞の除外: 「漬け汁」「漬けだれ」を作る工程は漬け込みではない
  eq(
    'ナビ名詞除外: 「…混ぜ、漬け汁を作る」は手作業(「漬」に反応させない)',
    classifyStep({
      text: '保存容器(なければ深さのあるボウルや耐熱皿)にだし汁・しょうゆ・酢・砂糖を混ぜ、漬け汁を作る。',
    }),
    'active',
  )
  eq(
    'ナビ名詞除外: 「漬けだれを合わせる」は手作業',
    classifyStep({ text: 'ボウルに漬けだれの調味料を合わせる。' }),
    'active',
  )
  // 本物の漬け込みは従来どおり待ち
  eq(
    'ナビ名詞除外: 「冷蔵庫で半日〜一晩漬ける」は待ちのまま',
    classifyStep({ text: '保存袋にめんつゆと水、殻をむいた卵を入れて空気を抜き、冷蔵庫で半日〜一晩漬ける。' }),
    'wait',
  )

  // 安全側: 本文に秒だけの時間が書いてあるときは既定分数で上書きしない(1分未満と分かっているため)
  eq('ナビ既定分数: 「30秒茹でる」は手作業のまま(秒だけの時間を8分に化けさせない)', classifyStep({ text: '30秒茹でる' }), 'active')

  // 同梱109品を1件ずつ目視して見つけた4件の直し(2026-08-08 便ED・docs/68 6-3の裁定)
  eq(
    'ナビ既定分数: 「煮立てる」は5分(煮込み10分と同じにしない・さばの味噌煮)',
    // 「材料を入れて｜煮立てる」も同居する手順として2工程に分かれる（2026-08-13 便GD）
    waitOf({ text: '鍋に水・酒・みりん・砂糖・薄切りしょうがを入れて煮立てる。' }).waitMinutes,
    5,
  )
  eq(
    'ナビ名詞除外: 「オーブンシートを敷き」は手作業(オーブン加熱ではない・ヨーグルトバーク)',
    classifyStep({ text: 'バットにオーブンシートを敷き、ヨーグルトを平らに広げる。' }),
    'active',
  )
  eq(
    'ナビ付きっきり: 「沸騰直前まで温めたら火を弱める」は手作業(沸くのを見ている工程・冷しゃぶ)',
    classifyStep({ text: '鍋にたっぷりの湯を沸かし、酒を加えて沸騰直前まで温めたら火を弱める。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「茹で上がったら…洗い流し、氷水でしっかり締める」は手作業(うどんが伸びる)',
    classifyStep({
      text: '鍋にたっぷりの湯を沸かし、冷凍うどんを袋の表示に沿って茹でる。茹で上がったら流水でぬめりを洗い流し、氷水でしっかり締める。',
    }),
    'active',
  )

  // ホールドアウト標本(初見の9品)で見つかった危険側の誤り3件(2026-08-08 便ED)
  eq(
    'ナビ名詞除外: 「しょうゆで味をつける」は手作業(「しょう"ゆで"」を「ゆでる」と読まない)',
    classifyStep({ text: 'しょうゆで味をつける' }),
    'active',
  )
  eq(
    'ナビ名詞除外: 「めんつゆで味をととのえる」は手作業',
    classifyStep({ text: 'めんつゆで味をととのえる' }),
    'active',
  )
  eq('ナビ名詞除外: 「煮干しでだしをとる」は手作業', classifyStep({ text: '煮干しでだしをとる' }), 'active')
  eq('ナビ名詞除外: 「蒸し器にセットする」は手作業', classifyStep({ text: '蒸し器にセットする' }), 'active')
  eq('ナビ名詞除外: 「漬物を器に出す」は手作業', classifyStep({ text: '漬物を器に出す' }), 'active')
  eq(
    'ナビ麺類: 「そうめんをゆでる」は手作業(1〜2分で吹きこぼれる工程に既定8分を当てない)',
    classifyStep({ text: 'そうめんをゆでる' }),
    'active',
  )
  eq('ナビ麺類: 「パスタをゆでる」は手作業', classifyStep({ text: 'パスタをゆでる' }), 'active')
  eq(
    'ナビ麺類: 本文に時間があれば従来どおり待ち(スパゲッティを8分ゆでる)',
    only({ text: 'スパゲッティを8分ゆでる' }).waitMinutes,
    8,
  )
  eq(
    'ナビ麺類: 麺以外の「ゆでる」は既定8分のまま(じゃがいもをゆでる)',
    only({ text: 'じゃがいもをゆでる' }).waitMinutes,
    8,
  )
  // 位置ルールは待ち動詞の「終わり」で比べる: 「蒸し焼き」の中の「焼き」で待ちを消さない
  eq(
    'ナビ位置ルール: 「ふたをし、中火で15分蒸し焼きにします」は待ち(蒸し焼きの中の「焼き」で消さない)',
    classifyStep({ text: 'フライパンに水を1cmほど張り、包みを並べてふたをし、中火で15分蒸し焼きにします。' }),
    'wait',
  )

  // ---- docs/68「残る限界」2件の解消(2026-08-09 便EM) ----
  // (1) 1分の待ちは並行の材料にしない。ゆで上げの1分は鍋の前を離れられない工程で、
  //     ここに別の料理の作業を差し込むと「ゆですぎ」になる(診断で唯一残っていた危険側1件)
  eq(
    'ナビ最短待ち: 「にんじんを1分、ほうれん草を30秒ゆでます」は手作業(1分は並行の材料にしない)',
    classifyStep({ text: '鍋にたっぷりの湯を沸かし、塩を入れてにんじんを1分、ほうれん草を30秒ゆでます。' }),
    'active',
  )
  eq(
    'ナビ最短待ち: 分数欄に1分と入っていても手作業',
    classifyStep({ text: 'にんじんを1分ゆでる。', minutes: 1 }),
    'active',
  )
  eq(
    'ナビ最短待ち: 2分の待ちは従来どおり待ち(下限は2分)',
    classifyStep({ text: '沸いたら豆腐とわかめを入れて2分温める。', minutes: 2 }),
    'wait',
  )
  // (2) ひらがなの「水気をきる」も手作業動詞として位置ルールに載せる。
  //     「水に5分さらして水気をきります」は、末尾が手作業なので待ちにしない
  eq(
    'ナビ位置ルール: 「水に5分さらして水気をきります」は手作業(ひらがなの「きる」)',
    classifyStep({ text: 'ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「10分ゆでて湯をきる」は手作業(ひらがなの「きる」)',
    classifyStep({ text: 'マカロニを10分ゆでて湯をきる。' }),
    'active',
  )
  eq(
    'ナビ位置ルール: 「水気をきってから冷蔵庫で冷やす」は待ちのまま(最後の動作が待ち)',
    classifyStep({ text: '水気をきってから冷蔵庫で30分冷やす。' }),
    'wait',
  )
}

// ---------- classifyStep(並行調理ナビ: 放置してよい加熱を「待ち」と読む。2026-08-13 便GA・docs/72 第1段)
//
// 直した不具合(docs/71 R3・docs/72 §0): 「魚焼きグリルで15分焼く」が**手作業15分**と判定され、
// 15分ずっと手がふさがる前提で段取りが組まれていた。位置ルール(手順の最後に来る動作が主役)が
// 末尾の「焼く」を拾うためで、**手順に分数が書かれていないときだけ**起きる。同梱109品は分数欄が
// 埋まっていて位置ルールが適用されないので、同梱109品では絶対に見えない誤りだった。
//
// 直し方は2つ。どちらも位置ルール本体は残したまま、**位置ルールが数える「手作業の動作」から
// 外す**形にしてある(位置ルールは「煮立ったらアクを取る」を手作業に保つのに必要なため)。
//   (1) 手を離してよい器具(グリル・オーブン・トースター・電子レンジ)より後ろの「焼く」は、
//       その器具の加熱そのものであって手を動かす動作ではない
//   (2) 「ときどき」「途中で」に導かれる動作は、待ちの最中の一手であって待ちを終わらせる動作ではない
// ----------
{
  const only = (step) =>
    buildCookTimeline([{ id: 1, title: 'テスト', steps: [step] }]).items.find((it) => !it.addedByNavi)

  // (1) 放置してよい器具の加熱は、分数欄が空でも待ち
  eq(
    'ナビ放置調理: 「魚焼きグリルで15分焼く」は待ち(分数欄が空でも)',
    classifyStep({ text: '魚焼きグリルで15分焼く。' }),
    'wait',
  )
  eq('ナビ放置調理: 「魚焼きグリルで15分焼く」の待ちは15分', only({ text: '魚焼きグリルで15分焼く。' }).waitMinutes, 15)
  eq('ナビ放置調理: 「トースターで5分焼く」は待ち', classifyStep({ text: 'トースターで5分焼く' }), 'wait')
  eq('ナビ放置調理: 「オーブンで20分焼く」は待ち', classifyStep({ text: 'オーブンで20分焼く' }), 'wait')
  eq(
    'ナビ放置調理: 「グリルで両面をこんがり焼く」は待ち(時間が無ければ既定15分)',
    only({ text: 'グリルで両面をこんがり焼く' }).waitMinutes,
    15,
  )
  // 安全側(S1を増やさない): 器具の語が無い「焼く」は従来どおり手作業のまま
  eq(
    'ナビ放置調理: 「フライパンで3分焼く」は手作業のまま(器具の語が無い)',
    classifyStep({ text: 'フライパンで3分焼く' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「…中火にかけ、表面全体に焼き色をつけていきます」は手作業のまま',
    classifyStep({ text: 'フライパンを強めの中火にかけ、表面全体に焼き色をつけていきます' }),
    'active',
  )
  // 安全側: 器具の語があっても、加熱のあとに手を動かす動作が来る手順は手作業のまま
  eq(
    'ナビ放置調理: 「グリルで焼いた鮭を器に盛る」は手作業(加熱の後に盛り付けが来る)',
    classifyStep({ text: 'グリルで焼いた鮭を器に盛る。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「オーブンから取り出して…食べやすく切る」は手作業',
    classifyStep({ text: 'オーブンから取り出して粗熱を取り、食べやすく切る。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「レンジで2分加熱してから全体を混ぜる」は手作業(混ぜるが後ろに来る)',
    classifyStep({ text: 'レンジで2分加熱してから全体を混ぜる。' }),
    'active',
  )

  // (2) 「ときどき」「途中で」の一手は、待ちを終わらせる動作に数えない
  eq(
    'ナビ放置調理: 「25分煮込み、ときどき混ぜながら…」は待ち(ミートソース)',
    classifyStep({ text: 'ふたをせずに弱火で25分煮込み、ときどき混ぜながら水分をとばします。' }),
    'wait',
  )
  eq(
    'ナビ放置調理: 「60分煮ていきます。途中で上下を返すと…」は待ち(煮豚)',
    classifyStep({
      text: '落としぶたをして弱火に落とし、そこから60分ゆっくり煮ていきます。途中で上下を返すと色むらがなくなります。',
    }),
    'wait',
  )
  // 安全側: 「ときどき」が付いても、鍋から離れられない語があれば従来どおり付きっきり
  eq(
    'ナビ放置調理: 「ときどき混ぜながら…煮詰める」は手作業のまま(煮詰めるは鍋から離れられない)',
    classifyStep({ text: 'たれを加え、ときどき混ぜながらとろみが出るまで煮詰める。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「絶えず混ぜながら5分温める」は手作業のまま',
    classifyStep({ text: '絶えず混ぜながら弱火で5分温める。' }),
    'active',
  )
  eq(
    'ナビ放置調理: 「ときどき」の付かない「混ぜながら5分煮る」は手作業のまま',
    classifyStep({ text: '弱火にかけ、混ぜながら5分煮る。' }),
    'active',
  )
  // 位置ルール本体は残す(これを外すと危険側の誤判定が戻る)
  eq(
    'ナビ放置調理: 位置ルールは健在「煮立ったら浮いてきたアクを取ります」は手作業',
    classifyStep({ text: '大根としょうが、水と調味料をすべて加え、煮立ったら浮いてきたアクを取ります' }),
    'active',
  )
  eq(
    'ナビ放置調理: 位置ルールは健在「粗熱が取れたら殻をむく」は手作業',
    classifyStep({ text: 'ゆで上がったらすぐ冷水にとり、粗熱が取れたら殻をむく。' }),
    'active',
  )
}

// ---------- 並べ方（2026-08-13 便GB・docs/72 第2段）
//
// 直した不具合3つ。いずれも docs/71 R3（利用者が自分で登録した3品での実操作）で出たもの。
//   (1)「その間に」が読まれない … 利用者が本文に書いた並行の指示が、直前の待ちの**あと**に
//       置かれていた（レシピ内の手順を厳密に順番どおり実行するため、構造上その待ちの中に置けない）
//   (2)「最後に仕上げる」と「最後に着火する」が分かれていない … 冷たい品の仕上げを先にする規則が、
//       温かい品の**着火（長い放置調理の開始）**より上に立ち、グリルの着火が後ろへ送られていた
//   (3) 仕上げが早すぎる … 汁物が完成してから20分以上放置される段取りが出ていた
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  const finishOf = (timeline, title) =>
    timeline.items.reduce((at, it) => (it.recipeTitle === title ? it.endMin : at), 0)

  // ---- (1) 「その間に」を直前の待ちの中に置く ----
  eq('ナビ並行指示: 「その間に」は並行の合図', hasParallelCue('その間に☆を全部混ぜ合わせておく。'), true)
  eq('ナビ並行指示: 「炊いている間に」も並行の合図', hasParallelCue('炊いている間に大根を短冊切りにする。'), true)
  eq('ナビ並行指示: 「漬けている間に」も並行の合図', hasParallelCue('漬けている間にキャベツをせん切りにする。'), true)
  // 「〜ながら」は1つの動作の中の同時（ほぐしながら炒める）が大半なので合図にしない
  eq('ナビ並行指示: 「ほぐしながら炒める」は合図にしない', hasParallelCue('ひき肉をほぐしながら炒めます。'), false)
  eq('ナビ並行指示: ふつうの手順は合図にしない', hasParallelCue('鍋で15分煮る。'), false)

  {
    const t = buildCookTimeline([
      recipe(1, '煮もの', ['鍋に材料とだし汁を入れて15分煮る。', 'その間に小ねぎを小口切りにする。', '器に盛る。']),
    ])
    const wait = t.items.find((it) => it.kind === 'wait')
    const cue = t.items.find((it) => it.text.startsWith('その間に'))
    const after = t.items.find((it) => it.text === '器に盛る。')
    eq('ナビ並行指示: 「その間に」の手順は待ちが明ける前に始まる', cue.startMin < wait.endMin, true)
    eq('ナビ並行指示: その次の手順は待ちが明けてから', after.startMin >= wait.endMin, true)
    // 合図の無い手順は従来どおり待ちの外（レシピ内の順序を守る）
    const plain = buildCookTimeline([
      recipe(2, '煮もの', ['鍋に材料とだし汁を入れて15分煮る。', '小ねぎを小口切りにする。', '器に盛る。']),
    ])
    const plainWait = plain.items.find((it) => it.kind === 'wait')
    const plainNext = plain.items.find((it) => it.text === '小ねぎを小口切りにする。')
    eq('ナビ並行指示: 合図が無ければ従来どおり待ちの外', plainNext.startMin >= plainWait.endMin, true)
  }
  {
    // 直前が待ちでない手順に合図が付いていても、順序は動かさない（合図だけで前へ飛ばさない）
    const t = buildCookTimeline([recipe(1, 'テスト', ['野菜を切る。', 'その間にたれを混ぜる。'])])
    eq('ナビ並行指示: 直前が待ちでなければ順序は変わらない', t.items[0].text, '野菜を切る。')
    eq('ナビ並行指示: 直前が待ちでなければ重ならない', t.items[1].startMin >= t.items[0].endMin, true)
  }

  // ---- (2) 「最後に着火する」を「最後に仕上げる」から切り離す ----
  {
    // 冷たい品の仕上げ（1手順で完結＝いきなり最後の手順）と、
    // 温かい品の「着火の1つ手前」の手順がぶつかる場面。着火を先にする
    const t = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, 'トマトサラダ', ['切ったトマトをドレッシングで和える。']),
    ])
    eq('ナビ着火: 冷たい品の仕上げより、長い放置調理の着火の準備が先', t.items[0].recipeTitle, '鶏のグリル焼き')
    const grill = t.items.find((it) => it.kind === 'wait')
    eq('ナビ着火: グリルは段取りの前半で着火する', grill.startMin * 2 <= t.totalMinutes, true)
  }
  {
    // 着火の予定が無いときは従来どおり＝冷たい品を先に仕上げる（2026-08-08 便EGのオーナー指示）
    const t = buildCookTimeline([
      recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。']),
      recipe(2, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
    ])
    eq('ナビ着火: 長い放置調理が無ければ冷たい品を先に仕上げる', finishOf(t, 'トマトサラダ') < finishOf(t, '野菜炒め'), true)
  }

  // ---- (3) 温かい品・汁物の仕上げを、ほかの品の完成に合わせて後ろへ寄せる ----
  eq(
    'ナビ温度: 汁物は温かい品として扱う（冷めたら作り直せない）',
    recipeServeTemp(recipe(1, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', 'みそを溶いて火を止める。'], { dishType: 'soup' })),
    'hot',
  )
  eq(
    'ナビ温度: 冷たい汁物（冷や汁）は冷たい品のまま',
    recipeServeTemp(recipe(1, '冷や汁', ['だしを作る。', '粗熱を取り、冷蔵庫でよく冷やす。'], { dishType: 'soup' })),
    'cold',
  )
  {
    const t = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', '豆腐をさいの目に切る。', '沸いたら豆腐とわかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
    ])
    const idle = finishOf(t, '鶏のグリル焼き') - finishOf(t, '豆腐とわかめのみそ汁')
    eq('ナビ仕上げ: 汁物が主菜より10分以上早く仕上がらない', idle <= 10, true)
    // 遅らせても全体は伸びない（伸ばして揃えるのでは意味がない）
    eq('ナビ仕上げ: 遅らせても全体の目安は伸びない', t.totalMinutes <= 30, true)
  }
  {
    // 1品だけのときは遅らせない（比べる相手がいない＝ただの空白になる）
    const t = buildCookTimeline([
      recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。']),
    ])
    eq('ナビ仕上げ: 1品だけなら空白を作らない', t.items[t.items.length - 1].startMin, t.items[t.items.length - 2].endMin)
  }
  {
    // 仕上げを後ろへ寄せても全体は伸ばさない。実装中に一度ここで伸ばしてしまい、
    // 同梱109品の平均短縮率が 33.1%→31.9% と合格ライン（32.6%）を割った（歯止めの再発防止）
    const t = buildCookTimeline([
      recipe(1, 'マリネ', ['鶏肉をマリネ液に入れて冷蔵庫で30分漬ける。', 'フライパンで焼く。']),
      recipe(2, '煮物', ['大根を切る。', '鍋で20分煮る。', '器に盛る。']),
    ])
    // 2026-08-13 便GD: 「鶏肉をマリネ液に入れて｜冷蔵庫で30分漬ける」が2工程に分かれ、
    // これまで0分だった「マリネ液に入れる」の1分が段取りに乗るので 38→39 分になる
    // （後ろへ寄せたことで伸びたのではない。ここで見たいのは寄せても伸びないこと）
    eq('ナビ仕上げ: 後ろへ寄せても全体の目安は39分のまま（伸ばして揃えない）', t.totalMinutes, 39)
    // 着地は34分のままだが、**そこへ持っていくやり方が変わった**（2026-08-14 便GG）。
    //   旧: 3分に着火して23分に煮上がり、器に盛るのを34分まで待たせる＝鍋は11分火の上
    //   新: 着火そのものを12分に回し、32分に煮上がってすぐ火を止める＝火にかけたままにしない
    // 利用者の手順「だしを張って火にかけるのはグリルに入れてから」と同じ形。
    eq(
      'ナビ仕上げ: 煮物の仕上げは手の空いた時間の終わりに着地する',
      t.items.find((it) => it.text === '器に盛る。').endMin,
      34,
    )
    eq(
      'ナビ仕上げ: そこへは「着火を後ろへ回して」持っていく（火にかけたまま待たせない）',
      (() => {
        const simmer = t.items.find((it) => it.text === '鍋で20分煮る。')
        const serve = t.items.find((it) => it.text === '器に盛る。')
        return [simmer.startMin > 3, serve.startMin - simmer.endMin <= 3]
      })(),
      [true, true],
    )
  }
}

// ---------- 器具の占有（2026-08-13 便GC・docs/72 第3段）
//
// 直した不具合（docs/71 R2・コンロ1口の家）:
//   「回鍋肉＋味噌汁で段取りを作ったら…⑤鍋で2分煮る（待ち）→⑥フライパンで豚肉を炒める→⑦また鍋
//   →⑧またフライパン。うちは1口なので、この段取りはそもそも成立しません。警告もヒントも一切なし。」
// 段取りが「料理人1人」しか見ておらず、**器具が何台あるか**を見ていなかった。
// ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps: steps.map((text) => ({ text })) })
  const kitchen = (burners, extra) => ({
    burners,
    microwave: true,
    grill: true,
    toaster: true,
    ...extra,
  })

  // ---- (1) 器具の見分け ----
  eq('器具: 魚焼きグリル', stepAppliance('魚焼きグリルで15分焼く。'), 'grill')
  eq('器具: トースター', stepAppliance('トースターでこんがり焼き色がつくまで焼く。'), 'toaster')
  eq('器具: 電子レンジ', stepAppliance('耐熱ボウルに入れてラップをかけ、電子レンジで3分加熱する。'), 'microwave')
  eq('器具: ワット数の表記もレンジ', stepAppliance('ふんわりラップをかけて600Wで2分加熱する。'), 'microwave')
  eq('器具: オーブンはレンジと同じ1台として数える（家庭で多いのはオーブンレンジ）', stepAppliance('200度のオーブンで20分焼く。'), 'microwave')
  eq('器具: 火の言い回しがあればコンロ', stepAppliance('フライパンで豚肉を炒める。'), 'stove')
  eq('器具: 火の語が無くても鍋があればコンロ（安全側）', stepAppliance('鍋にだし汁を入れる。'), 'stove')
  eq('器具: 火から下りていればコンロと数えない', stepAppliance('鍋の中身をボウルに移して冷ます。'), null)
  eq('器具: 火を止める手順も、その時点までは火の上にある', stepAppliance('全体がまとまったら火を止める。'), 'stove')
  eq('器具: 器具を使わない手順', stepAppliance('ボウルに調味料を混ぜ合わせる。'), null)
  // 材料名の取り違え（見分けを間違えると、使っていない口を使っていることにしてしまう）
  eq('器具: 「油揚げ」は揚げ物ではない', stepAppliance('油揚げは短冊切りにする。'), null)
  eq('器具: 「蒸し大豆」は蒸す工程ではない', stepAppliance('ボウルにツナと蒸し大豆を入れてあえる。'), null)
  eq('器具: 「フレンチトースト」はトースターではない', stepAppliance('フレンチトーストの卵液を作る。'), null)
  eq('器具: 「グリルパン」はコンロで使う道具', stepAppliance('グリルパンに油をひく。'), 'stove')
  eq('器具: 「炒りごま」は炒る工程ではない', stepAppliance('すり鉢に炒りごまを入れる。'), null)

  // ---- (2) 持っていない器具はコンロ1口として数える ----
  eq(
    '器具: グリルを持っていない家では、グリルの工程はコンロを使う',
    stepApplianceFor('魚焼きグリルで15分焼く。', kitchen(2, { grill: false })),
    'stove',
  )
  eq(
    '器具: 持っていれば従来どおりグリル',
    stepApplianceFor('魚焼きグリルで15分焼く。', kitchen(2)),
    'grill',
  )

  // ---- (3) 設定の読み取り（未設定の端末は従来どおり） ----
  eq('器具: 既定は2口', DEFAULT_KITCHEN.burners, 2)
  eq('器具: 設定が空なら既定', kitchenFromSettings(undefined), DEFAULT_KITCHEN)
  eq('器具: 未設定の項目は「持っている」', kitchenFromSettings({}), DEFAULT_KITCHEN)
  eq(
    '器具: 「持っていない」だけを保存する形',
    kitchenFromSettings({ kitchenBurners: 1, kitchenNoGrill: true }),
    { burners: 1, microwave: true, grill: false, toaster: true },
  )
  eq('器具: 口数は1〜4に収める', [clampBurners(0), clampBurners(9)], [1, 4])

  // ---- (4) R2の実例。1口では同時に火にかけない ----
  // R2の訴えの形（鍋の煮込みが動いている最中に、フライパンの炒めものを差し込む段取り）
  const nimono = () =>
    recipe(1, '煮もの', ['大根を切る。', '鍋に大根とだし汁を入れて10分煮る。', '器に盛る。'])
  const itamemono = () =>
    recipe(2, '炒めもの', ['キャベツをざく切りにする。', 'フライパンで豚バラ肉を炒める。', '器に盛る。'])
  /** その段取りで、同時に何口のコンロを使っているかの最大 */
  const maxStove = (timeline) => {
    const uses = timeline.items
      .map((it) => ({
        key: stepAppliance(it.text),
        start: it.startMin,
        end: it.endMin,
        span: it.kind === 'wait' ? it.waitMinutes : it.activeMinutes,
        relaxed: it.kind === 'wait' && waitUrgency({ text: it.text }) === 'relaxed',
      }))
      .filter((u) => u.key === 'stove' && u.span > 0 && !u.relaxed && u.end > u.start)
    const events = uses.flatMap((u) => [[u.start, 1], [u.end, -1]])
    events.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    let now = 0
    let max = 0
    for (const [, d] of events) {
      now += d
      if (now > max) max = now
    }
    return max
  }
  eq(
    'ナビ器具: コンロ1口の家に、同時に2つ火にかける段取りを出さない',
    maxStove(buildCookTimeline([nimono(), itamemono()], kitchen(1))),
    1,
  )
  eq(
    'ナビ器具: 2口あれば重ねてよい（口数に余裕があるほど同時に進める）',
    maxStove(buildCookTimeline([nimono(), itamemono()], kitchen(2))),
    2,
  )
  eq(
    'ナビ器具: 1口のほうが段取りは長くなる（無理な順番を出さないぶん）',
    buildCookTimeline([nimono(), itamemono()], kitchen(1)).totalMinutes >
      buildCookTimeline([nimono(), itamemono()], kitchen(2)).totalMinutes,
    true,
  )
  eq(
    'ナビ器具: 設定を省くと既定（2口）で組む＝従来どおり',
    buildCookTimeline([nimono(), itamemono()]).totalMinutes,
    buildCookTimeline([nimono(), itamemono()], kitchen(2)).totalMinutes,
  )

  // ---- (4b) 縮まなかった理由を書き分ける（正直表示。序列「安全>正直>短縮効果」） ----
  {
    // どちらもコンロを使う2品。1口では並行の余地が無く、2口なら10分のゆでの中に焼きが入る
    const pair = () => [
      recipe(1, 'ゆで卵', ['鍋に湯を沸かし、卵を10分ゆでる。', '冷水にとって殻をむく。']),
      recipe(2, '照り焼き', ['フライパンで鶏もも肉を焼く。', 'たれをからめる。']),
    ]
    const one = buildCookPlan(pair(), kitchen(1))
    const many = buildCookPlan(pair(), kitchen(2))
    eq('ナビ器具: 1口では並行の余地が無く、1品ずつ作る順番を出す', one.mode, 'sequential')
    eq('ナビ器具: その理由は「待ちが無い」ではなく「口が足りない」と書き分ける', one.limitedByEquipment, true)
    eq('ナビ器具: 口に余裕があるときは並行の段取りになる', many.mode, 'parallel')
    eq('ナビ器具: 並行できたときは器具のせいにしない', many.limitedByEquipment, false)
    // 待ちがそもそも無い品は、口数に関係なく従来どおり「待ち時間が見つからない」側
    const noWait = buildCookPlan(
      [
        recipe(1, 'あえもの', ['きゅうりを薄切りにする。', '調味料と和える。']),
        recipe(2, 'サラダ', ['レタスをちぎる。', 'ドレッシングをかける。']),
      ],
      kitchen(1),
    )
    eq('ナビ器具: 待ちが無いだけのときは器具のせいにしない', noWait.limitedByEquipment, false)
  }


  // ---- (4b-2) 縮まなかった理由を「どの器具か」まで書き分ける（2026-08-24 便KK） ----
  // オーナー裁定A案「レンジが1台なので縮みません」＝理由を出す。
  //
  // なぜ要るか: 2026-08-23 便KDで電子レンジの二重予約を直した結果、**待ちはあるのに
  // レンジが空かない**ために1品ずつへ落ちる組が出た。便GCの見分け（isLimitedByEquipment）は
  // **コンロの口数に余裕を持たせて組み直す**やり方なので、レンジ・グリル・トースターのように
  // 「持っていても1台」の器具が理由のときは見つけられず、
  // 「手が空く待ち時間が見つかりませんでした」＝**利用者が自分のレシピを疑う文**が出ていた。
  {
    const applianceOnly = (id, title, text, minutes) => ({
      id,
      title,
      steps: [{ text, minutes }],
    })
    // 電子レンジしか使わない2品。レンジは1台なので、2品目は1品目が終わるまで始められない
    const microwavePair = () => [
      applianceOnly(1, 'レンジ蒸し野菜', '耐熱ボウルに野菜を入れ、ラップをかけて電子レンジで15分加熱する。', 15),
      applianceOnly(2, 'レンジ肉じゃが', '耐熱皿に材料を入れ、ラップをかけて電子レンジで15分加熱する。', 15),
    ]
    const mw = buildCookPlan(microwavePair(), kitchen(2))
    eq('KK-6 レンジ2品は1品ずつ作る順番になる', mw.mode, 'sequential')
    eq('KK-6 その理由は「待ちが無い」ではなく器具だと分かる', mw.limitedByEquipment, true)
    eq('KK-6 どの器具かまで分かる（コンロの口数に余裕があっても見つける）', mw.limitingAppliance, 'microwave')
    // 魚焼きグリルも同じ（1台しか無い器具はコンロと同じ理由で縮まない）
    const grillPair = () => [
      applianceOnly(1, '焼き魚', '魚焼きグリルで15分焼く。', 15),
      applianceOnly(2, '焼きなす', '魚焼きグリルで15分焼く。', 15),
    ]
    eq('KK-7 グリル2品も器具が理由だと分かる', buildCookPlan(grillPair(), kitchen(2)).limitingAppliance, 'grill')
    // コンロが理由のときは便GCのときと同じ「コンロ◯口では」の文を出す（名前が変わらない）
    const stovePair = () => [
      recipe(1, 'ゆで卵', ['鍋に湯を沸かし、卵を10分ゆでる。', '冷水にとって殻をむく。']),
      recipe(2, '照り焼き', ['フライパンで鶏もも肉を焼く。', 'たれをからめる。']),
    ]
    eq('KK-8 コンロが理由のときはコンロだと分かる', buildCookPlan(stovePair(), kitchen(1)).limitingAppliance, 'stove')
    // 嘘をつかない: 待ちがそもそも無い組は、今までどおりの文（器具のせいにしない）
    const noWait = buildCookPlan(
      [
        recipe(1, 'あえもの', ['きゅうりを薄切りにする。', '調味料と和える。']),
        recipe(2, 'サラダ', ['レタスをちぎる。', 'ドレッシングをかける。']),
      ],
      kitchen(1),
    )
    eq('KK-9 待ちが無いだけの組は器具の名前を出さない', noWait.limitingAppliance, undefined)
    eq('KK-9 待ちが無いだけの組は器具のせいにもしない', noWait.limitedByEquipment, false)
    // 並行に組めた組は理由そのものを出さない
    eq('KK-9 並行に組めた組は器具の名前を出さない', buildCookPlan(stovePair(), kitchen(2)).limitingAppliance, undefined)
    // 持っていない器具の名前は出さない（その工程はコンロとして数えているので、理由もコンロ）
    eq(
      'KK-10 グリルを持っていない家では、グリルの名前ではなくコンロが理由になる',
      buildCookPlan(grillPair(), kitchen(1, { grill: false })).limitingAppliance,
      'stove',
    )
    // 画面の文（器具の名前を入れられる形になっているか）
    eq(
      'KK-11 器具の名前を入れる文が用意されている',
      [
        (ja.cookNavi.noParallelByApplianceNote ?? '').includes('{appliance}'),
        (ja.cookNavi.noParallelByApplianceNote ?? '').includes('{n}'),
      ],
      [true, true],
    )
  }
  // ---- (4c) 火にかけた鍋は、火を止めるまで口をふさぎ続ける（2026-08-14 便GI） ----
  // 直した不具合（docs/68 の合格ライン引き直しで見つけた）:
  //   口をふさぐ長さを**その工程の長さ**だけで数えていたため、「中火で15分煮る」が終われば
  //   口が空くことになり、**まだ火にかかっている鍋の上にもう1つ鍋を置く段取り**が出ていた。
  //   コンロ1口の家で、手も口も足りていないのに「できる」と言っている段取り（＝理論下限を
  //   下回る段取り）が9通り。下はその実例（カレーの鍋が29分の時点でまだ火の上にあるのに、
  //   親子丼を火にかけていた）。
  {
    const curry = () => ({
      id: 1,
      title: 'カレー',
      steps: [
        { text: '野菜は食べやすい大きさに切る。玉ねぎは薄切りにすると溶けて甘みが出る。' },
        { text: '厚手の鍋で肉と玉ねぎを炒め、残りの野菜も加えて油をなじませる。' },
        { text: '水を注ぎ、あくを取りながら中火で15分煮る。', minutes: 15 },
        { text: 'いったん火を止めてルーを溶かし、弱火でとろみが付くまで5分煮る。', minutes: 5 },
        { text: 'ご飯にかけて完成。' },
      ],
    })
    const oyako = () => ({
      id: 2,
      title: '親子丼',
      steps: [
        { text: '鶏肉は一口大、玉ねぎは薄切りにする。' },
        { text: '小さめのフライパンにめんつゆと水を入れ、鶏肉と玉ねぎを中火で7分煮る。', minutes: 7 },
        { text: '溶き卵を2回に分けて回し入れ、ふたをして半熟で火を止める。' },
        { text: 'ご飯にのせ、お好みで三つ葉や刻みのりを散らす。' },
      ],
    })
    /** カレーの鍋が火から下りる時刻（この品は最後まで火を止める言葉が出てこない＝終わりまで火の上） */
    const potOffAt = (t) => Math.max(...t.items.filter((it) => it.recipeId === 1).map((it) => it.endMin))
    /** 親子丼を火にかける時刻 */
    const igniteAt = (t) => t.items.find((it) => it.recipeId === 2 && it.text.includes('7分煮る'))?.startMin
    const one = buildCookTimeline([curry(), oyako()], kitchen(1))
    eq(
      'ナビ器具: 1口の家では、火にかけた鍋が火から下りるまで別の品を火にかけない',
      igniteAt(one) >= potOffAt(one),
      true,
    )
    const two = buildCookTimeline([curry(), oyako()], kitchen(2))
    eq(
      'ナビ器具: 2口あれば、鍋を火にかけたままもう1品を火にかけてよい（縮める力を落とさない）',
      igniteAt(two) < potOffAt(two),
      true,
    )
    eq(
      'ナビ器具: 口をふさぎ続けるぶん、1口の段取りは2口より長くなる',
      one.totalMinutes > two.totalMinutes,
      true,
    )
  }

  // ---- (5) 占有しない待ち（漬ける・冷ます・寝かせる）は口をふさがない ----
  {
    const soak = buildCookTimeline(
      [
        recipe(1, 'マリネ', ['鶏肉をマリネ液に漬けて冷蔵庫で30分おく。', '器に盛る。']),
        recipe(2, 'みそ汁', ['鍋にだし汁を入れて火にかける。', '豆腐を入れて2分煮る。']),
      ],
      kitchen(1),
    )
    eq(
      'ナビ器具: 冷蔵庫で漬ける待ちの間も、1口の家でコンロを使える',
      soak.items.some((it) => /火にかける/.test(it.text) && it.startMin < 30),
      true,
    )
  }

  // ---- (6) レンジ・グリル・トースターは同時に1つまで ----
  {
    const twoMicrowave = buildCookTimeline(
      [
        recipe(1, '副菜A', ['耐熱皿に並べ、電子レンジで5分加熱する。', '和える。']),
        recipe(2, '副菜B', ['耐熱皿に並べ、電子レンジで5分加熱する。', '和える。']),
      ],
      kitchen(3),
    )
    const heats = twoMicrowave.items.filter((it) => /電子レンジ/.test(it.text))
    eq(
      'ナビ器具: 電子レンジは口数に関係なく同時に1つまで',
      heats[0].endMin <= heats[1].startMin || heats[1].endMin <= heats[0].startMin,
      true,
    )
  }
}

// ---------- 手作業と待ちの同居（2026-08-13 便GD・docs/72 対象2）
//
// 直した不具合（docs/71 R3）:
//   (1)「皮を取り、フォークで刺し、そぎ切りにする。10分おく」→ **待ち10分だけ**が段取りに乗り、
//       包丁仕事の4〜5分が0分。しかもタイマーを先に押すと漬け時間が5分しか残らない
//   (2)「鍋に水とだしの素を入れて中火にかける」→ **手作業2分だけ**で、沸くまでの4〜5分が0分。
//       「実際にはここで3分立ち尽くします」
//   (3) 待ちが先・手作業が後ろの同居（docs/68 3-3「どちらに倒しても正しくならない」）
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((s) => (typeof s === 'string' ? { text: s } : s)),
    ...extra,
  })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 手作業が先・待ちが後ろ ----
  const r3Step = t('鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。')
  eq('ナビ同居: R3の「そぎ切りにする。10分おく」を2つに分ける', splitMixedStep(r3Step), {
    active: { text: '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。', memo: undefined },
    wait: { text: '塩こしょうと酒をふって10分ほどおく。', minutes: undefined, memo: undefined },
  })
  eq(
    'ナビ同居: 読点の無い「水を入れて煮る」も動詞＋てで切る',
    (() => {
      const s = splitMixedStep(t('水を入れて煮る'))
      return [s.active.text, s.wait.text]
    })(),
    ['水を入れて', '煮る'],
  )
  {
    const plan = buildCookTimeline([recipe(1, '主菜', [r3Step])])
    const act = plan.items[0]
    const wait = plan.items[1]
    eq('ナビ同居: 手を動かす時間が0分でなくなる', act.activeMinutes > 0, true)
    eq('ナビ同居: 待ちの分数は変わらない', wait.waitMinutes, 10)
    // R3の実害そのもの: タイマーは待ちの工程にしか出ないので、手作業の前には押せない
    eq('ナビ同居: タイマーは待ちの工程だけに出る', [showsWaitTimerButton(act), showsWaitTimerButton(wait)], [false, true])
    eq('ナビ同居: 待ちは手作業が終わってから始まる', wait.startMin, act.endMin)
    eq('ナビ同居: 番号は「1-1」「1-2」', [recipeStepLabel(act), recipeStepLabel(wait)], ['1-1', '1-2'])
    // カーソル・タイマー・手順カードのidに使う識別子は必ず別（同じだと「次へ」が戻る）
    eq('ナビ同居: 2つの工程は別の識別子を持つ', act.stepIndex !== wait.stepIndex, true)
  }
  // 分けない側（迷ったら分けない）
  eq('ナビ同居: 分数欄が埋まっている手順は分けない', splitMixedStep(t('水を入れて煮る', 10)), undefined)
  eq('ナビ同居: 前半に手を動かす動詞が無ければ分けない', splitMixedStep(t('弱火で20分煮る。')), undefined)
  eq('ナビ同居: もともと手作業の手順は分けない', splitMixedStep(t('大根と調味料を加え、煮立ったら浮いてきたアクを取ります。')), undefined)
  eq(
    'ナビ同居: 括弧の中の但し書きは切る位置の根拠にしない（「器に盛る」を待ちにしない）',
    splitMixedStep(t('鮭を裏返し、中まで火が通るまで焼いて器に盛る（両面焼きグリルの場合は裏返さずそのまま両面を焼く）。')),
    undefined,
  )
  // 分けても待ちは1分も減らさない（減る書き方なら分けない、という歯止めの確認）
  for (const text of ['ポリ袋に入れてもみ込み、15分おきます。', 'ふたをずらしてのせ、弱めの中火で20分煮ます。', '水を入れて煮る']) {
    const s = splitMixedStep(t(text))
    eq(
      `ナビ同居: 分けても待ちは減らない（${text.slice(0, 12)}）`,
      resolveWaitMinutes(s.wait) >= resolveWaitMinutes(t(text)),
      true,
    )
  }

  // ---- (2) 本文に書かれていない「沸くまでの待ち」 ----
  {
    const soup = buildPlanSteps([
      t('鍋に水とだしの素を入れて中火にかける。'),
      t('豆腐をさいの目に切る。'),
      t('沸いたら豆腐と乾燥わかめを入れる。'),
      t('みそを溶いて火を止める。'),
    ])
    eq('ナビ沸くまで: 工程が1つ増える', soup.length, 5)
    eq('ナビ沸くまで: 「火にかける」の直後に待ちが入る', [soup[1].step.text, soup[1].step.minutes, soup[1].addedByNavi], [
      ja.cookNavi.addedBoilWaitStep,
      BOIL_WATER_MINUTES,
      true,
    ])
    eq('ナビ沸くまで: 番号は「1-1」「1-2」', [recipeStepLabel(soup[0]), recipeStepLabel(soup[1])], ['1-1', '1-2'])
    const plan = buildCookTimeline([recipe(1, 'みそ汁', ['鍋に水とだしの素を入れて中火にかける。', '豆腐をさいの目に切る。', '沸いたら豆腐と乾燥わかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' })])
    const boil = plan.items.find((it) => it.text === ja.cookNavi.addedBoilWaitStep)
    const cut = plan.items.find((it) => it.text === '豆腐をさいの目に切る。')
    eq('ナビ沸くまで: 待ちとして段取りに乗る', [boil.kind, boil.waitMinutes], ['wait', BOIL_WATER_MINUTES])
    eq('ナビ沸くまで: 沸くのを待つ間に次の手順を進められる', cut.startMin < boil.endMin, true)
    // 「沸いたら〜」の手順は沸くのを待つ工程そのもの。待ちの中に置かない
    const after = plan.items.find((it) => it.text === '沸いたら豆腐と乾燥わかめを入れる。')
    eq('ナビ沸くまで: 「沸いたら」の手順は沸いてから', after.startMin >= boil.endMin, true)
  }
  {
    // 「火にかける」の次の手順がいきなり「沸騰したら」のとき、それを待ちの中に置かない
    const plan = buildCookTimeline([
      recipe(1, 'ゆで卵', ['鍋に水を入れて中火にかける。', '沸騰したら卵をそっと入れる。', '冷水にとって殻をむく。']),
    ])
    const boil = plan.items.find((it) => it.text === ja.cookNavi.addedBoilWaitStep)
    const next = plan.items.find((it) => it.text === '沸騰したら卵をそっと入れる。')
    eq('ナビ沸くまで: 次の手順が「沸騰したら」ならその中に置かない', next.startMin >= boil.endMin, true)
  }
  eq(
    'ナビ沸くまで: 後ろに「沸いたら」が無ければ足さない',
    buildPlanSteps([t('フライパンを中火にかける。'), t('肉を入れて焼き色をつける。')]).length,
    2,
  )
  eq(
    'ナビ沸くまで: 同じ手順の中で作業が続く書き方には足さない',
    buildPlanSteps([t('鍋にだし汁を入れて火にかけ、煮立ったら豆腐を加えます。')]).filter((p) => p.addedByNavi).length,
    0,
  )
  eq(
    'ナビ沸くまで: 湯沸かしを足した品には足さない（鍋を二度沸かさない）',
    buildPlanSteps([t('鍋に水を入れて中火にかける。'), t('沸いたらそうめんをゆでる。')]).filter((p) => p.addedByNavi)
      .length,
    1,
  )

  // ---- (3) 待ちが先・手作業が後ろの同居 ----
  eq(
    'ナビ同居: 「水につけてもどし、水気を絞ってざく切りにする」は待ちと手作業に分ける',
    (() => {
      const s = splitWaitFirstStep(t('切り干し大根はたっぷりの水につけてもどし、水気を絞ってざく切りにする'))
      return [s.wait.text, s.active.text]
    })(),
    ['切り干し大根はたっぷりの水につけてもどし、', '水気を絞ってざく切りにする'],
  )
  // 2026-08-09 便EMで危険側1件として潰した形を戻さない（待ちの前に別の作業が2つ埋まっている）
  eq(
    'ナビ同居: 待ちが節をまたぐ手順は分けない（「ささがき、細切りにし、水に5分さらして水気をきる」）',
    splitWaitFirstStep(t('ごぼうはささがき、にんじんは細切りにし、ごぼうは水に5分さらして水気をきります。')),
    undefined,
  )
  eq(
    'ナビ同居: 「煮立ったらアクを取る」は分けない（待ちではなく合図）',
    splitWaitFirstStep(t('大根と調味料をすべて加え、煮立ったら浮いてきたアクを取ります。')),
    undefined,
  )

  // ---- (4) 段取りの比較が一周しない（R3で34→50分に伸びた再発防止） ----
  // 「切る工程どうしだけ最優先」を比較の途中に置くと、3品以上で並べ替えの結果が一周し、
  // 着火（長い放置調理）を控えた品が後ろへ落ちる
  {
    const plan = buildCookTimeline([
      recipe(1, '主菜', ['鶏むね肉をそぎ切りにする。', '塩をふって10分ほどおく。', '魚焼きグリルで15分焼く。', 'パセリをふる。']),
      recipe(2, '副菜', ['ほうれん草を切る。', '電子レンジで3分加熱する。', 'ごまと和える。']),
      recipe(3, '汁物', ['鍋にだしを入れて15分煮る。', 'みそを溶く。'], { dishType: 'soup' }),
    ])
    const grill = plan.items.find((it) => it.text === '魚焼きグリルで15分焼く。')
    eq('ナビ着火: 長い放置調理が段取りの前半で始まる', grill.startMin * 2 <= plan.totalMinutes, true)
    // まな板の順序（野菜→肉・魚）は保つ
    const cuts = plan.items.filter((it) => /切りにする。|を切る。/.test(it.text)).map((it) => it.recipeTitle)
    eq('ナビ切る順: 野菜を先に、肉・魚を後に切る', cuts, ['副菜', '主菜'])
  }
}

// ---------- 火にかけたまま放置しない（2026-08-14 便GG・docs/72 第5段）
//
// 直した不具合（利用者・料理歴20年の原文。docs/72 第5段）:
//   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。間に#8・#9・#10（グリル15分の待ち）が
//     挟まるので、豆腐とわかめが10分前後ぐつぐつ煮え続けます。レシピには『1〜2分煮る』と
//     書いてあるのに。豆腐は崩れるしわかめは溶けます。#7の後に『火を止める』も『弱火にする』も
//     出てきません。」
//
// 真因: 「遅くともこの時刻までに手を戻す」締め切り（2026-08-09 便EH）は**待ちの工程からしか
// 生まれず、その品の次の手順を出した瞬間に消えていた**。鍋を火にかけたまま次の手順に進む
// 「沸いたら豆腐とわかめを入れる」のような工程は待ちではないので締め切りを持てず、
// さらに「温かい品の仕上げを後ろへ寄せる」（2026-08-13 便GB）が締め切りを見ずに
// 最後の「みそを溶いて火を止める」を18分後ろへ送っていた。
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  /** その品が火にかかったまま、次の工程まで何分空いたかの最大（測り方は audit-cook-navi.mjs のN7と同じ） */
  const heatIdle = (timeline, title) => {
    const list = timeline.items.filter((it) => it.recipeTitle === title)
    // 2026-08-15 便GM: **手でタネを扱う工程（こねる・形を作る）も火から下りている**を足した。
    // 本体（cookNavi.ts の HEAT_OFF_PATTERN）と同じ考え方だが、ここは答え合わせ用に別に持つ
    const off = /火を止め|火をとめ|火を消|火からおろ|火から下ろ|器に盛|皿に盛|椀に|取り出|ざるにあげ|ざるに上げ|湯を切|水にとる|冷ま|粗熱|こね|捏ね|成形|形を作|形を整え/
    let onHeat = false
    let since = 0
    let worst = 0
    for (const it of list) {
      if (onHeat) worst = Math.max(worst, it.startMin - since)
      if (off.test(it.text)) onHeat = false
      else if (stepAppliance(it.text) === 'stove') {
        onHeat = true
        since = it.endMin
      } else if (onHeat) since = Math.max(since, it.endMin)
    }
    return worst
  }

  // ---- (1) 利用者の3品そのもの。豆腐を入れてから火を止めるまでが空かない ----
  {
    const plan = buildCookTimeline([
      recipe(1, '鶏むね肉のみそマヨ焼き', [
        '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
        'その間に☆を全部混ぜ合わせておく。',
        'アルミホイルに①を並べ、②を上から塗る。',
        '魚焼きグリルで15分焼く。',
        '焼けたら乾燥パセリをふる。',
      ]),
      recipe(2, 'ほうれん草とにんじんのごま和え', [
        'ほうれん草は3〜4cmの長さに切り、にんじんは細切りにする。',
        '耐熱ボウルに入れてラップをかけ、電子レンジで3分加熱する。',
        '水気をしぼって◎を加えて和える。',
      ]),
      recipe(3, '豆腐とわかめのみそ汁', [
        '鍋に水とだしの素を入れて中火にかける。',
        '豆腐をさいの目に切る。',
        '沸いたら豆腐と乾燥わかめを入れる。',
        'みそを溶いて火を止める。',
      ], { dishType: 'soup' }),
    ])
    const add = plan.items.find((it) => it.text === '沸いたら豆腐と乾燥わかめを入れる。')
    const stop = plan.items.find((it) => it.text === 'みそを溶いて火を止める。')
    // 利用者の手組みは「豆腐を入れて味噌を溶くのは焼き上がりの3分前」＝3分。猶予も3分に合わせる
    eq('ナビ火の番: 豆腐を入れてから火を止めるまで3分以内', stop.startMin - add.endMin <= 3, true)
    eq('ナビ火の番: 3品どれも火にかけたまま放置しない', [
      heatIdle(plan, '鶏むね肉のみそマヨ焼き') <= 3,
      heatIdle(plan, 'ほうれん草とにんじんのごま和え') <= 3,
      heatIdle(plan, '豆腐とわかめのみそ汁') <= 3,
    ], [true, true, true])
  }

  // ---- (2) 「温かい品の仕上げを後ろへ寄せる」が、火にかけたままの品には効かない ----
  {
    const plan = buildCookTimeline([
      recipe(1, '鶏のグリル焼き', ['アルミホイルに鶏肉を並べ、みそだれを塗る。', '魚焼きグリルで15分焼く。', '乾燥パセリをふる。']),
      recipe(2, '豆腐とわかめのみそ汁', ['鍋に水とだしの素を入れて中火にかける。', '沸いたら豆腐とわかめを入れる。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
    ])
    eq('ナビ火の番: 火にかけたままの汁物の仕上げを後ろへ寄せない', heatIdle(plan, '豆腐とわかめのみそ汁') <= 3, true)
  }
  // 火から下りている品では、従来どおり仕上げを後ろへ寄せる（便GBの機能を殺していないこと）
  {
    const plan = buildCookTimeline([
      recipe(1, '煮物', ['大根を切る。', '鍋で20分煮る。', '火を止めて器に盛る。']),
      recipe(2, 'ゼリー', ['ゼラチンを溶かす。', '冷蔵庫で30分冷やし固める。', '器に盛る。']),
    ])
    const nimono = plan.items.filter((it) => it.recipeTitle === '煮物')
    eq('ナビ火の番: 火から下りている品は従来どおり（煮上がりの直後に火を止める）', nimono[nimono.length - 1].startMin - nimono[nimono.length - 2].endMin <= 3, true)
  }

  // ---- (3) 火の見分け（引き継ぎの規則） ----
  {
    const plan = buildCookTimeline([recipe(1, '汁物', ['鍋に水を入れて中火にかける。', '沸いたら具を入れる。', 'みそを溶いて火を止める。', '器に盛る。'], { dishType: 'soup' })])
    eq('ナビ火の番: 火を止めた後は締め切りを持たない', plan.items[plan.items.length - 1].text, '器に盛る。')
    eq('ナビ火の番: 1品だけでも段取りは成立する', plan.totalMinutes > 0, true)
  }
  // 火を下ろす語と火にかける語が同居したら、あとに来たほうが主役（位置ルール）
  eq(
    'ナビ火の番: 「水気を絞って鍋に戻し、5分煮る」は火にかける',
    stepHeatShift({ text: '水気を絞って鍋に戻し、5分煮る。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'on',
  )
  eq(
    'ナビ火の番: 「煮汁がなくなったら火を止め、そのまま冷ます」は火から下りる',
    stepHeatShift({ text: '煮汁がなくなったら火を止め、そのまま冷ます。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'off',
  )
  eq(
    'ナビ火の番: 火に触れない手順は直前の状態を引き継ぐ',
    stepHeatShift({ text: '沸いたら豆腐と乾燥わかめを入れる。' }, { burners: 2, microwave: true, grill: true, toaster: true }),
    'keep',
  )

  // ---- (4) 最後の1口を、火にかけたままの鍋より先に取らせない ----
  // 実測（ホールドアウト標本）: 豚汁の炒めのあと、ほかの品の蒸し焼き15分に2口目を取られ、
  // フライパンが火にかかったまま15分中断していた
  {
    const plan = buildCookTimeline([
      recipe(1, '豚汁', ['野菜を切る。', '鍋にごま油を熱し、豚肉を炒める。', '野菜を加えて炒め合わせる。', 'だし汁を入れて12分煮る。', 'みそを溶いて火を止める。'], { dishType: 'soup' }),
      recipe(2, 'ホイル焼き', ['アルミホイルに包む。', 'フライパンに水を張り、ふたをして中火で15分蒸し焼きにする。', '器にのせる。']),
      recipe(3, 'ゆで鶏', ['鶏肉に塩をすり込んで20分おく。', '鍋に湯を沸かして鶏肉を入れ、火を止める。', 'ふたをして40分おく。', '鍋から取り出して薄切りにする。']),
    ])
    eq('ナビ火の番: 3品でも豚汁のフライパンを火にかけたまま中断しない', heatIdle(plan, '豚汁') <= 3, true)
  }

  // ---- (5) 手でタネを扱う工程は火の上ではできない（2026-08-15 便GM・docs/72 第5段の続き） ----
  //
  // 直した不具合: 手順本文に「火を止める」と書いていないレシピ（ハンバーグ）で、
  //   「玉ねぎをみじん切りにして炒める → ひき肉とまぜてこねる → 形を作る → 焼く」
  // の**最初の火が最後まで続いている**ことになっていた。実際にはボウルで肉をこねている間、
  // フライパンは火から下りている。そのため
  //   ①その品が最初から最後までコンロを1口ふさぎ続ける（ほかの品が火にかけられない）
  //   ②火にかかったままとみなされ、仕上げを揃える仕組みが一切効かない
  //   ③こねる・形を作るのあいだの空きを「火にかけたままの放置」に数えてしまう（監査で9件）
  // の3つが同時に起きていた。
  eq('ナビ火の番: 「炒める」は火にかける', stepHeatShift({ text: '玉ねぎをみじん切りにして炒める' }, DEFAULT_KITCHEN), 'on')
  eq(
    'ナビ火の番: 手でこねる工程は火が下りている（中身はボウルの中）',
    stepHeatShift({ text: 'ひき肉とまぜてこねる' }, DEFAULT_KITCHEN),
    'off',
  )
  eq('ナビ火の番: 形を作る工程も火が下りている', stepHeatShift({ text: '形を作る' }, DEFAULT_KITCHEN), 'off')
  eq(
    'ナビ火の番: 位置ルールは健在。「こねてからフライパンで焼く」は火にかける',
    stepHeatShift({ text: 'こねてからフライパンで両面を焼く' }, DEFAULT_KITCHEN),
    'on',
  )
  eq(
    'ナビ火の番: 鍋の中の「混ぜる」は火から下ろさない（取りこぼしを作らない）',
    stepHeatShift({ text: '鍋の中でときどき混ぜながら10分煮る' }, DEFAULT_KITCHEN),
    'on',
  )
  {
    // こねている間にコンロが空くので、ほかの品を待たせなくなる。
    // 見るのは**利用者に見えること**＝どの品も火にかけたまま猶予（3分）を超えて放置されないこと。
    // 直す前はカレーの鍋が5分放置されていた（ハンバーグが最後までコンロを1口占有していたため）
    const trio = buildCookTimeline([
      recipe(1, 'カレー', ['野菜を切る', '肉と野菜を炒める', '水を入れて煮る', 'ルーを入れる', 'ご飯にかける']),
      recipe(2, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
      recipe(3, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' }),
    ])
    eq(
      'ナビ火の番: 3品とも火にかけたまま猶予を超えて放置しない',
      ['カレー', 'ハンバーグ', 'みそ汁'].every((title) => heatIdle(trio, title) <= 3),
      true,
    )
    // 火を下ろせる工程を見分けたぶん段取りは短くなる。伸びていないことの歯止め（上限は保険）
    eq('ナビ火の番: 火の見分けを直しても段取りは伸びない', trio.totalMinutes <= 47, true)
  }
}

// ---------- 別の鍋に移る前に、火を止める／弱火にする（2026-08-15 便GO・docs/72 第7段）
//
// 利用者（料理歴20年）の原文:
//   「#7で豆腐とわかめを入れて煮始め、火を止めるのは#12。…豆腐とわかめが10分前後ぐつぐつ
//     煮え続けます。**#7の後に「火を止める」も「弱火にする」も出てきません。**」
//
// 便GMの調べで、残っていた放置89件は**すべて「鍋が2つ同時に手を待っている」場面**と分かった。
// 手は1組なので片方は必ず待たされる＝並べ替えでは消えない。実際の台所では、別の鍋に移る前に
// 火を弱めるか止める。それを段取りの一手として出す（レシピ本文は書き換えない＝規約D）。
//
// ここで測るのは**利用者が確かめたいこと**:
//   ①その鍋の火をどうするかが段取りに出てくるか ②どの品の火かが読めるか
//   ③加熱が残っている品に「止める」と言わないか ④要らない場面で出てこないか
//   ⑤足したぶん段取りが伸びないか ⑥レシピ本文が変わらないか
// ----------
{
  const recipe = (id, title, steps, extra) => ({
    id,
    title,
    steps: steps.map((text) => ({ text })),
    ...extra,
  })
  // BudouXのゼロ幅スペースを外してから読む（禁じ手②。照合は語の有無で見て、完全一致では見ない）
  const plain = (text) => (text ?? '').replaceAll('​', '')
  /** ナビが足した「火の一手」 */
  const heatBreaks = (timeline, title) =>
    timeline.items.filter(
      (it) => it.recipeTitle === title && it.addedByNavi && /火を止め|弱火/.test(plain(it.text)),
    )
  const allHeatBreaks = (timeline) =>
    timeline.items.filter((it) => it.addedByNavi && /火を止め|弱火/.test(plain(it.text)))
  /** その品の「レシピに書いてある手順」だけ（ナビが足した工程を除く） */
  const ownSteps = (timeline, title) =>
    timeline.items.filter((it) => it.recipeTitle === title && !it.addedByNavi)
  /** その工程は火を必要とするか（工程の終わりに火が下りる書き方も、その間は火の上） */
  const needsFire = (item) =>
    stepHeatShift({ text: plain(item.text), minutes: item.minutes }, DEFAULT_KITCHEN) === 'on' ||
    heatOffAtEnd({ text: plain(item.text), minutes: item.minutes })

  /**
   * どの段取りでも守られていないといけないこと（組み合わせを変えても同じ形で見る）。
   *   ・「火を止める」と言うのは、その品の残りに火が要る工程が1つも無いときだけ
   *     （加熱の途中で止めたら料理が変わる）
   *   ・足すのは猶予（3分）を超える空きの場面だけ（出しすぎない）
   *   ・足した一手は時間を取らない＝全体の目安が伸びない
   */
  const checkRules = (label, timeline) => {
    const breaks = allHeatBreaks(timeline)
    const unsafeStop = breaks.filter((it) => {
      if (!/火を止め/.test(plain(it.text))) return false
      return ownSteps(timeline, it.recipeTitle).some(
        (x) => x.startMin >= it.startMin && needsFire(x),
      )
    })
    eq(`ナビ火の一手(${label}): 加熱が残っている品には止めると言わない`, unsafeStop.length, 0)
    const tooEager = breaks.filter((it) => {
      const list = ownSteps(timeline, it.recipeTitle)
      const prev = list.filter((x) => x.endMin <= it.startMin).pop()
      const next = list.find((x) => x.startMin >= it.startMin)
      return prev == null || next == null || next.startMin - prev.endMin <= 3
    })
    eq(`ナビ火の一手(${label}): 猶予に収まる空きには足さない`, tooEager.length, 0)
    eq(
      `ナビ火の一手(${label}): 足した一手は時間を取らない`,
      breaks.every((it) => it.activeMinutes === 0 && it.endMin === it.startMin),
      true,
    )
    const lastOwn = timeline.items
      .filter((it) => !it.addedByNavi)
      .reduce((max, it) => Math.max(max, it.endMin), 0)
    eq(`ナビ火の一手(${label}): 足しても全体の目安は伸びない`, timeline.totalMinutes, lastOwn)
  }

  // ---- (1) 鍋が2つ同時に手を待つ場面。火をどうするかが段取りに出る ----
  {
    const soup = recipe(1, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' })
    const egg = recipe(2, 'ゆで卵', [
      '鍋に水を入れて沸かす',
      '卵を入れる',
      '好みのかたさになるまでゆでる',
      '冷水につけて殻をむく',
    ])
    const stirFry = recipe(3, '野菜炒め', ['材料を切る', '肉を炒める', '野菜を入れて炒める', '塩こしょうで味をつける', '皿に盛る'])
    const plan = buildCookTimeline([soup, egg, stirFry])
    checkRules('3品', plan)

    const soupBreaks = heatBreaks(plan, 'みそ汁')
    eq('ナビ火の一手: 鍋が2つ手を待つ場面で、火をどうするかが段取りに出る', soupBreaks.length >= 1, true)
    const stop = soupBreaks[0]
    const own = ownSteps(plan, 'みそ汁')
    if (stop) {
      // ②どの品の火かが読める（複数の鍋が動く場面で出る一手なので、取り違えると別の料理が止まる）
      eq('ナビ火の一手: どの品の火かが本文で分かる', plain(stop.text).includes('みそ汁'), true)
      // ③残りが「みそを溶く」だけ＝火の仕事は終わっている → 止めてよい
      eq('ナビ火の一手: 加熱が残っていない品では止める', /火を止め/.test(plain(stop.text)), true)
      // 置く時刻は「その鍋から手が離れた瞬間」＝直前の工程の終わりで、次に戻る前
      const before = own.filter((it) => it.endMin <= stop.startMin).pop()
      const after = own.find((it) => it.startMin >= stop.startMin)
      eq('ナビ火の一手: 手が離れた瞬間に置く', stop.startMin, before?.endMin)
      eq('ナビ火の一手: 次にその品へ戻る前に置く', stop.startMin <= after?.startMin, true)
    }
    // ゆで上がった鍋も同じ（卵を入れっぱなしのゆで湯を放置しない）
    const eggBreaks = heatBreaks(plan, 'ゆで卵')
    eq('ナビ火の一手: ゆで上がった鍋にも火の一手が出る', eggBreaks.length >= 1, true)
    // ⑥レシピ本文は1文字も変わらない（規約D）
    eq('ナビ火の一手: レシピの手順は書き換えない', soup.steps.map((s) => s.text), ['水を沸かす', '具を入れる', 'みそを溶く'])
    eq(
      'ナビ火の一手: 段取りに載る本文もレシピのまま',
      own.every((it) => soup.steps.some((s) => s.text === plain(it.text))),
      true,
    )
  }

  // ---- (2) 1品だけの段取りには出てこない（鍋を放置する場面がそもそも無い） ----
  {
    const solo = buildCookTimeline([
      recipe(1, 'みそ汁', ['水を沸かす', '具を入れる', 'みそを溶く'], { dishType: 'soup' }),
    ])
    eq('ナビ火の一手: 1品だけなら足さない', allHeatBreaks(solo).length, 0)
  }

  // ---- (3) 加熱の途中では止めない（「煮汁が少なくなるまで煮る」型） ----
  // 工程全体としては火が下りる書き方（「煮汁がほとんどなくなったら火を止め、そのまま冷ます」）でも、
  // その工程の**間は火の上**にいる。先に止めると煮詰まらないまま冷ますことになる
  {
    const plan = buildCookTimeline([
      recipe(1, '切り干し大根の煮もの', [
        '鍋にごま油を熱し、切り干し大根とにんじんを炒める',
        'だし汁と調味料を加えてひと煮立ちさせ、落としぶたをして10分煮る',
        '煮汁がほとんどなくなったら火を止め、そのまま冷ます',
      ]),
      recipe(2, '豚肉と大根の煮もの', [
        '大根は半月切りにし、豚バラ肉は食べやすい長さに切る',
        '鍋に油を熱し、豚バラ肉を色が変わるまで炒める',
        '大根と水、調味料を加え、煮立ったらアクを取る',
        'ふたをずらしてのせ、弱めの中火で20分煮ます。',
        '大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。',
      ]),
      recipe(3, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
    ])
    checkRules('煮もの3品', plan)
    const breaks = heatBreaks(plan, '切り干し大根の煮もの')
    eq(
      'ナビ火の一手: 煮詰める工程が残っているうちは止めない',
      breaks.every((it) => !/火を止め/.test(plain(it.text))),
      true,
    )
    /**
     * 2026-08-15 便GR: **件数（>=1）は決め打ちしない**（禁じ手③）。
     * 「火を止め、そのまま10分おいて味を含ませます」を待ちとして数えるようになった結果、
     * この3品では鍋が放置される場面そのものが消え、一手を足す必要がなくなった
     * （docs/68 第7段が「N4を直せば自然に解ける」と書いていたとおり）。
     * **足さないことも正解**なので、見るのは利用者に起きることのほう＝
     * 「煮ている鍋が、火にかかったまま長く空かないこと」。
     * 足して弱火にするか、そもそも空けないかは、どちらでもよい。
     */
    const kiriboshi = ownSteps(plan, '切り干し大根の煮もの')
    const worstGap = kiriboshi.reduce(
      (max, it, i) => (i === 0 ? max : Math.max(max, it.startMin - kiriboshi[i - 1].endMin)),
      0,
    )
    eq('ナビ火の一手: 煮ている鍋を火にかけたまま長く空けない', worstGap <= 5, true)
  }

  // ---- (4) 手でこねる工程の手前には足さない（2026-08-15 便GMの見分けを殺していないこと） ----
  // 「玉ねぎを炒める → ひき肉とまぜてこねる」は、ボウルの中の作業に移った時点で火が下りている。
  // ここに火の一手を出すと、要らない工程で段取りが読みにくくなる
  {
    const plan = buildCookTimeline([
      recipe(1, 'ゆで卵', ['鍋に水を入れて沸かす', '卵を入れる', '好みのかたさになるまでゆでる', '冷水につけて殻をむく']),
      recipe(2, 'ハンバーグ', ['玉ねぎをみじん切りにして炒める', 'ひき肉とまぜてこねる', '形を作る', '焼く', 'ソースをかける']),
    ])
    checkRules('こねる2品', plan)
    eq('ナビ火の一手: 手でこねる工程の手前には足さない', heatBreaks(plan, 'ハンバーグ').length, 0)
  }
}

// ---------- 2026-08-08 便EG・オーナー実機フィードバック（3品を実際に作って見つかった段取りの不備）
// (2)漬け込みの前に切る工程を片付ける (3)ゆでる工程に「湯を沸かす」を差し込む
// (4)冷やす品は先に・熱々の品は最後に仕上げる ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps: steps.map((text) => ({ text })) })

  // ---- (3) 湯を沸かす。レシピ本文は1文字も変えず、段取りの表示にだけ足す ----
  const boil = buildPlanSteps([{ text: 'じゃがいもをゆでる' }, { text: 'つぶす' }])
  eq('ナビ湯沸かし: ゆでる手順の前に1つ足す', boil.length, 3)
  eq('ナビ湯沸かし: 足す位置はゆでる手順の直前', boil[0].step.text, '湯を沸かす')
  eq('ナビ湯沸かし: 足した工程には印が付く', boil[0].addedByNavi, true)
  eq('ナビ湯沸かし: 足した工程は既定5分', boil[0].step.minutes, BOIL_WATER_MINUTES)
  eq('ナビ湯沸かし: 元の手順は番号も本文もそのまま', [boil[1].stepNumber, boil[1].step.text], [1, 'じゃがいもをゆでる'])
  const boiled = buildCookTimeline([recipe(1, 'テスト', ['じゃがいもをゆでる'])]).items[0]
  eq('ナビ湯沸かし: 足した工程は待ち5分として段取りに載る', [boiled.kind, boiled.waitMinutes], ['wait', 5])
  eq('ナビ湯沸かし: 足した工程は手順番号を持たない', boiled.stepNumber, 0)
  eq('ナビ湯沸かし: 足した工程には「目安です」の注記を重ねない（印は1つ）', boiled.waitEstimated, false)
  // すでに湯を沸かす手順があるレシピには足さない
  // 2026-08-09 便EH: 同じ手順の中に湯沸かしが書かれている場合は「足さない」ではなく
  // 「その部分だけ前の工程に切り出す」に変わった（沸かし始めからの時間を段取りに乗せるため）
  eq(
    'ナビ湯沸かし: 「鍋に湯を沸かし…ゆでる」は湯沸かしだけを切り出す',
    buildPlanSteps([{ text: '鍋にたっぷりの湯を沸かし、ほうれん草をゆでる' }]).map((p) => p.step.text),
    ['鍋にたっぷりの湯を沸かす', 'ほうれん草をゆでる'],
  )
  eq(
    // 2026-08-13 便GD: 「鍋に水を入れて｜沸騰させる」は同居する手順として2工程に分かれるので、
    // 工程数ではなく**ナビが足した工程が無いこと**で見る（見たいのは湯沸かしの二重差し込み）
    'ナビ湯沸かし: 前の手順で沸かしていれば足さない',
    buildPlanSteps([{ text: '鍋に水を入れて沸騰させる' }, { text: '卵をゆでる' }]).filter(
      (p) => p.addedByNavi,
    ).length,
    0,
  )
  // ゆで終わったものを指す言い方は湯沸かしの合図にしない
  eq('ナビ湯沸かし: 「ゆで上がったら湯を切る」には足さない', buildPlanSteps([{ text: 'ゆで上がったら湯を切る' }]).length, 1)
  eq('ナビ湯沸かし: 「ゆで卵を切る」には足さない', buildPlanSteps([{ text: 'ゆで卵を切る' }]).length, 1)
  eq('ナビ湯沸かし: 「しょうゆで味をつける」には足さない', buildPlanSteps([{ text: 'しょうゆで味をつける' }]).length, 1)
  eq('ナビ湯沸かし: ゆでる工程が無ければ足さない', buildPlanSteps([{ text: '野菜を炒める' }]).length, 1)
  eq(
    'ナビ湯沸かし: 1レシピにつき1回まで',
    buildPlanSteps([{ text: 'にんじんをゆでる' }, { text: 'ブロッコリーをゆでる' }]).filter(
      (p) => p.addedByNavi,
    ).length,
    1,
  )

  // ---- (2) 漬け込み・寝かせの前に、着手できる切る工程を片付ける ----
  eq('ナビ漬け込み: 「冷蔵庫で30分漬け込む」は漬け込みの待ち', isSoakWait({ text: '鶏肉を入れて冷蔵庫で30分漬け込む。' }), true)
  eq('ナビ漬け込み: 「弱火で15分煮る」は漬け込みではない', isSoakWait({ text: '弱火で15分煮る。' }), false)
  const soak = buildCookTimeline([
    recipe(1, 'マリネ肉', [
      'ボウルにオリーブオイルとレモン汁を混ぜてマリネ液を作る。',
      '鶏肉を入れて冷蔵庫で30分漬け込む。',
      'フライパンで焼く。',
    ]),
    recipe(2, 'サラダ', ['きゅうりとトマトを切る。', 'ドレッシングで和える。']),
  ])
  const soakOrder = soak.items.map((it) => it.text)
  eq(
    // 2026-08-13 便GD: 「鶏肉を入れて｜冷蔵庫で30分漬け込む」が2工程に分かれた。
    // 見たいのは「切る工程が漬け込みより後ろに落ちないこと」なので、
    // 漬け込みを**仕掛ける一手**も切る工程より後ろに来ることまで含めて固定する
    // （生の肉を漬けたあとで野菜を切らせない＝2026-08-08 便EGのオーナー指示）
    'ナビ漬け込み: マリネ液→カット→漬け込み の順になる（切る工程が漬け込みより後ろに落ちない）',
    soakOrder.slice(0, 4),
    [
      'ボウルにオリーブオイルとレモン汁を混ぜてマリネ液を作る。',
      'きゅうりとトマトを切る。',
      '鶏肉を入れて',
      '冷蔵庫で30分漬け込む。',
    ],
  )
  // ふつうの待ち（煮る）は今までどおり最優先で仕掛ける＝切る工程で遅らせない
  const simmer = buildCookTimeline([
    recipe(1, '煮物', ['鍋に材料と水を入れて15分煮る。', '器に盛る。']),
    recipe(2, 'サラダ', ['きゅうりとトマトを切る。', 'ドレッシングで和える。']),
  ])
  // 2026-08-13 便GD: 「鍋に材料と水を入れて｜15分煮る」も2工程に分かれるが、
  // 煮込みは漬け込みと違って**切る工程より先**（仕掛ける一手も含めて）のまま
  eq(
    'ナビ漬け込み: 煮る待ちは切る工程より先に仕掛ける（従来どおり）',
    simmer.items.slice(0, 2).map((it) => it.text),
    ['鍋に材料と水を入れて', '15分煮る。'],
  )

  // ---- (4) 出したい温度の推定と、完成の順番 ----
  eq(
    'ナビ温度: 「冷蔵庫でよく冷やす」がある品は冷やす品',
    recipeServeTemp(recipe(1, '茶碗蒸し', ['卵液を作る。', '蒸す。', '粗熱を取り、冷蔵庫でよく冷やす。'])),
    'cold',
  )
  eq('ナビ温度: 料理名がサラダなら冷やす品', recipeServeTemp(recipe(1, '大根サラダ', ['大根を切る。', '和える。'])), 'cold')
  eq(
    'ナビ温度: 加熱で終わる品は熱々の品',
    recipeServeTemp(recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。', '器に盛る。'])),
    'hot',
  )
  eq(
    'ナビ温度: 最後の手順に加熱と盛り付けが同居していても熱々の品',
    recipeServeTemp(recipe(1, '豚肉のケチャップ炒め', ['下味だれを作る。', 'フライパンで豚肉を炒める。器に盛る。'])),
    'hot',
  )
  eq(
    'ナビ温度: どちらとも読めない品は現状維持（どちらでもない）',
    recipeServeTemp(recipe(1, 'コールスロー', ['キャベツを塩もみして水気を絞る。'])),
    'neutral',
  )
  // 熱々の品の仕上げは最後、冷やす品の仕上げは先に
  const serve = buildCookTimeline([
    recipe(1, 'オムライス', ['ご飯を炒める。', '卵を焼いて包む。']),
    recipe(2, '鶏の照り焼き', ['鶏肉に下味をつける。', '皮目から焼く。', '裏返して中まで焼く。']),
    recipe(3, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
  ])
  const lastOf = (title) =>
    serve.items.reduce((at, it, i) => (it.recipeTitle === title ? i : at), -1)
  eq('ナビ完成順: 冷やす品を先に仕上げる', lastOf('トマトサラダ') < lastOf('オムライス'), true)
  eq('ナビ完成順: 熱々の品どうしは、他の品の作業が終わってから仕上げる', lastOf('オムライス') > lastOf('トマトサラダ'), true)
  // 1品ずつ作る順番でも同じ（冷やす品→どちらでもない→熱々）
  const seq = buildCookPlan([
    recipe(1, '野菜炒め', ['野菜を切る。', 'フライパンで炒める。']),
    recipe(2, 'トマトサラダ', ['トマトを切る。', 'ドレッシングで和える。']),
  ])
  eq('ナビ完成順: 1品ずつのときも冷やす品が先', seq.items[0].recipeTitle, 'トマトサラダ')
  eq('ナビ完成順: 1品ずつのときも熱々の品が最後', seq.items[seq.items.length - 1].recipeTitle, '野菜炒め')
}

// ---------- 2026-08-09 便EH・オーナー実機フィードバック
// (1)並行調理中に1品だけ「作った！」したときの選択の整合
// (2)待ち時間に詰め込みすぎない  (3)切る工程をレシピをまたいで隣接させる
// (4)手順に埋もれた「湯を沸かす」を段取り上で分離  (5)手作業の所要時間の見積り ----------
{
  const recipe = (id, title, steps) => ({ id, title, steps })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 1品だけ「作った！」したときに、覚えていた選択から確実に外れる ----
  // 起きていた不具合: 作った記録が付いた品は候補一覧から消えるので画面から外せず、
  // 段取りと「まとめて作った！」の対象にだけ残り続け、記録が二重に付いていた
  eq(
    'ナビ選択整合: 今日の献立から消えた品（作った記録が付いた品）は選択から外れる',
    reconcileSelectedIds([1, 2, 3], [1, 3]),
    [1, 3],
  )
  eq('ナビ選択整合: 残る品の順番（＝色の順）は変えない', reconcileSelectedIds([3, 1, 2], [1, 2, 3]), [3, 1, 2])
  eq('ナビ選択整合: 全部消えたら空になる', reconcileSelectedIds([1, 2], []), [])
  eq('ナビ選択整合: 変化が無ければそのまま', reconcileSelectedIds([1, 2], [1, 2, 5]), [1, 2])

  // ---- (5) 手作業の所要時間の見積り ----
  eq('ナビ所要: 手順に分数があればそれを使う', estimateActiveMinutes(t('鶏肉を焼く', 7)), {
    minutes: 7,
    estimated: false,
  })
  eq('ナビ所要: 短い手順の「3分炒める」は本文の3分をそのまま使う', estimateActiveMinutes(t('強火で3分炒める')), {
    minutes: 3,
    estimated: false,
  })
  eq('ナビ所要: 盛り付けは2分（一律4分をやめた）', estimateActiveMinutes(t('器に盛る')).minutes, 2)
  // 2026-08-09 便ES: 1動作＝3分にそろえ直した（複数動作の手順は節・文ごとに数えて足す）
  eq('ナビ所要: 切る工程は3分', estimateActiveMinutes(t('玉ねぎをみじん切りにする')).minutes, 3)
  eq(
    'ナビ所要: 1手順に複数の動作があれば足し上げる（炒め＋炒め合わせる）',
    estimateActiveMinutes(t('玉ねぎをしんなりするまで炒め、ご飯をほぐしながら炒め合わせる')).minutes,
    5,
  )
  eq(
    'ナビ所要: 3つの動作が並ぶ手順は、いちばん重い動作＋1分ずつ',
    estimateActiveMinutes(t('玉ねぎとにんじんを切り、フライパンで炒め、塩こしょうで味をととのえて器に盛る')).minutes,
    7,
  )
  eq(
    'ナビ所要: 材料の列挙（動作の無い読点）では増えない',
    estimateActiveMinutes(t('しょうゆ、みりん、酒、砂糖をボウルで混ぜる')).minutes,
    3,
  )
  eq('ナビ所要: 炒める工程は5分', estimateActiveMinutes(t('ひき肉を炒める')).minutes, 5)
  eq('ナビ所要: 「鍋に水を入れて火にかける」は準備動作で2分', estimateActiveMinutes(t('鍋に水とだしの素を入れて火にかける。')).minutes, 2)
  eq('ナビ所要: 見積りには印が付く', estimateActiveMinutes(t('器に盛る')).estimated, true)
  // 1段落まるごとが1手順になった取り込みレシピ（診断 docs/68 3-3）は、長さぶん上乗せする
  const paragraph = t(
    'なすを乱切りにして水に5分さらし、水気をふきます。フライパンにサラダ油を熱してなすを入れ、しんなりするまで3分炒めます。豚ひき肉を加えてほぐしながら炒め、色が変わったらしょうゆとみりんを加えて全体にからめます。汁気がなくなったら火を止めて器に盛ります。',
  )
  // 2026-08-09 便ES: 文字数ではなく「文・節ごとの動作の数」で数える形に変えた
  eq('ナビ所要: 1段落まるごとの手順を4分と数えない（動作の数だけ上乗せする）', estimateActiveMinutes(paragraph).minutes, 8)

  // ---- 待ちの「手を戻す締め切り」の厳しさ ----
  eq('ナビ締め切り: ゆでるは時間どおり（超過を許さない）', waitUrgency(t('にんじんを2分茹でる')), 'onTime')
  eq('ナビ締め切り: レンジは時間どおり', waitUrgency(t('600Wで3分加熱する')), 'onTime')
  eq('ナビ締め切り: 煮込みは少しの超過を許す', waitUrgency(t('弱火で15分煮る')), 'simmer')
  eq('ナビ締め切り: 漬け込みは超過を気にしない', waitUrgency(t('冷蔵庫で30分漬ける')), 'relaxed')
  eq('ナビ締め切り: 「火を止めてそのまま冷ます」は冷ますが主役', waitUrgency(t('煮汁がなくなったら火を止め、そのまま冷ます')), 'relaxed')
  eq('ナビ締め切り: ゆでるの猶予は0分', waitOverrunAllowance(t('にんじんを2分茹でる'), 2), 0)
  eq('ナビ締め切り: 15分煮るの猶予は3分（2割・上限5分）', waitOverrunAllowance(t('弱火で15分煮る'), 15), 3)
  eq('ナビ締め切り: 60分煮るの猶予は上限の5分', waitOverrunAllowance(t('弱火で60分煮込む'), 60), 5)
  eq('ナビ締め切り: 漬け込みの猶予は無制限', waitOverrunAllowance(t('冷蔵庫で30分漬ける'), 30), Infinity)

  // ---- (2) 待ち時間に詰め込みすぎない（オーナー実機報告の再現ケース） ----
  // 報告: 「茹で時間＝待ち時間4分想定の手順から、次の手順でザルにあげるまでに、
  // オムライスの鶏肉炒め＋玉ねぎしんなり＋ご飯ケチャップ＋皿に盛り付けまで入っている。無理。不可能」
  const packed = buildCookTimeline([
    recipe(1, 'にんじんのナムル', [
      t('にんじんは細切りにする。'),
      t('鍋にたっぷりの湯を沸かし、にんじんを4分茹でて冷水にとる。'),
      t('ごま油と塩で和える。'),
    ]),
    recipe(2, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('鶏肉を炒める。'),
      t('玉ねぎがしんなりするまで炒める。'),
      t('ご飯を入れてケチャップで炒める。'),
      t('卵を焼いて包み、皿に盛る。'),
    ]),
  ])
  const boilItem = packed.items.find((it) => it.text.startsWith('にんじんを4分'))
  eq('ナビ詰め込み: 4分のゆでが待ちとして載る', [boilItem.kind, boilItem.waitMinutes], ['wait', 4])
  // ゆで上がりまでに差し込まれた手作業の合計が、その4分を越えない
  const inserted = packed.items.filter(
    (it) => it.kind === 'active' && it.startMin >= boilItem.startMin && it.startMin < boilItem.endMin,
  )
  eq(
    'ナビ詰め込み: 4分の待ちに入れる手作業の合計は4分まで',
    inserted.reduce((a, it) => a + it.activeMinutes, 0) <= 4,
    true,
  )
  // ゆで上がったら、その品の次の手順が最優先で来る（ざるに上げるのを後回しにしない）
  const afterBoil = packed.items.find(
    (it) => it.recipeTitle === 'にんじんのナムル' && it.startMin >= boilItem.endMin,
  )
  eq('ナビ詰め込み: ゆで上がりの直後にその品の続きへ戻る', afterBoil.startMin, boilItem.endMin)
  // 3品での再現（司令部の検証e2eで赤になった組み合わせをそのまま単体に固定する）。
  // ゆで上がりまでに差し込まれた手作業の合計が、待ちの4分を超えないこと
  const packed3 = buildCookTimeline([
    recipe(1, 'ナムル', [
      t('にんじんは細切りにする。'),
      t('鍋にたっぷりの湯を沸かし、にんじんを4分茹でて冷水にとる。'),
      t('ごま油と塩で和える。'),
    ]),
    recipe(2, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('鶏肉を炒める。'),
      t('玉ねぎがしんなりするまで炒める。'),
      t('ご飯を入れてケチャップで炒める。', 3),
      t('卵を焼いて包み、皿に盛る。'),
    ]),
    recipe(3, '煮物', [t('大根を切る。'), t('鍋で15分煮る。'), t('器に盛る。')]),
  ])
  const boil3 = packed3.items.findIndex((it) => it.text.startsWith('にんじんを4分'))
  const back3 = packed3.items.findIndex(
    (it, i) => i > boil3 && it.recipeTitle === 'ナムル' && it.kind === 'active',
  )
  eq('ナビ詰め込み(3品): ゆで上がりのあとにその品の続きが来る', boil3 >= 0 && back3 > boil3, true)
  eq(
    'ナビ詰め込み(3品): 4分のゆで待ちに差し込む手作業の合計は4分まで',
    packed3.items
      .slice(boil3 + 1, back3)
      .filter((it) => it.kind === 'active')
      .reduce((a, it) => a + it.activeMinutes, 0) <= 4,
    true,
  )
  // 段取り全体が物理的に成り立つか（手作業どうしが重なっていない）も見ておく
  const activeSpans = packed3.items
    .filter((it) => it.kind === 'active')
    .sort((a, b) => a.startMin - b.startMin)
  eq(
    'ナビ詰め込み(3品): 手作業どうしが時間で重ならない（1人で作れる段取りになっている）',
    activeSpans.every((it, i) => i === 0 || it.startMin >= activeSpans[i - 1].endMin),
    true,
  )

  // 漬け込みの待ちには上限を掛けない（数分の遅れは料理に影響しないため）
  // 2026-08-13 便GB: 煮物に「アクを取り除く」を1つ足した。**この検査が見たいのは
  // 「漬け込みの待ちに手作業を詰められるか」**だが、元の標本で詰められる手作業は
  // 煮物の最後の手順（器に盛る）しかなく、それは便GBで入れた「温かい品の仕上げは
  // ほかの品の完成に合わせて後ろへ寄せる」の対象になり、詰め込みの可否とは別の理由で動く。
  // 途中の手作業を1つ足して、検査したい性質だけを見るようにした
  const soaked = buildCookTimeline([
    recipe(1, 'マリネ', [t('鶏肉をマリネ液に入れて冷蔵庫で30分漬ける。'), t('フライパンで焼く。')]),
    recipe(2, '煮物', [t('大根を切る。'), t('鍋で20分煮る。'), t('アクを取り除く。'), t('器に盛る。')]),
  ])
  eq(
    'ナビ詰め込み: 漬け込み30分の間は今までどおり他の作業を詰められる',
    soaked.items.filter((it) => it.kind === 'active' && it.startMin < 30).length >= 2,
    true,
  )

  // ---- (3) 切る工程をレシピをまたいで隣接させる ----
  // 報告: 「切る手順がまだ後回しになっている。全部レシピ分カットの流れが自然」
  const cutting = buildCookTimeline([
    recipe(1, 'マリネ野菜', [
      t('マリネ用の野菜を切る。'),
      t('マリネ液と和える。'),
      t('冷蔵庫で20分冷やす。'),
    ]),
    recipe(2, '鶏の照り焼き', [
      t('鶏もも肉に切り込みを入れる。'),
      t('下味だれを混ぜ合わせる。'),
      t('鶏もも肉にもみ込んで冷蔵庫で20分おく。'),
      t('皮目から焼く。'),
    ]),
    recipe(3, 'オムライス', [
      t('鶏肉と玉ねぎを切る。'),
      t('ご飯を炒める。'),
      t('卵を焼いて包む。'),
    ]),
  ])
  const cutPositions = cutting.items
    .map((it, i) => (/切る|切り込み/.test(it.text) ? i : -1))
    .filter((i) => i >= 0)
  eq('ナビ切る工程: 3品とも切る工程が段取りに載る', cutPositions.length, 3)
  eq(
    'ナビ切る工程: 3品の切る工程が途中で分断されずに並ぶ',
    cutPositions[cutPositions.length - 1] - cutPositions[0],
    cutPositions.length - 1,
  )

  // ---- (4) 手順に埋もれた「湯を沸かす」を段取り上で分離する ----
  // 報告: 「茹でるための湯沸かしが手順にない。もとのレシピでひとくくりにされているが、
  // 『沸かす』だけ分離できない?」
  eq('ナビ湯沸かし分離: 読点の直前の「沸かし」で切り、終止形にそろえる', splitBoilWaterClause('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。'), {
    boilWater: '鍋にたっぷりの湯を沸かす',
    rest: 'にんじんを2分茹でる。',
  })
  eq('ナビ湯沸かし分離: 「沸騰させて、」も切れる', splitBoilWaterClause('鍋に水を沸騰させて、卵をゆでる。').boilWater, '鍋に水を沸騰させる')
  eq(
    'ナビ湯沸かし分離: 別の作業が挟まる書き方は切らない（読める文にならないため）',
    splitBoilWaterClause('鍋に湯を沸かして塩を入れ、にんじんをゆでる。'),
    undefined,
  )
  eq(
    'ナビ湯沸かし分離: ゆでる作業が残らない書き方は切らない',
    splitBoilWaterClause('鍋にたっぷりの湯を沸かし、火を止める。'),
    undefined,
  )
  const separated = buildPlanSteps([
    t('にんじんは細切りにする。'),
    t('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。'),
  ])
  eq('ナビ湯沸かし分離: 手順が1つ増える', separated.length, 3)
  eq('ナビ湯沸かし分離: 湯沸かしが前の工程として入る', [separated[1].step.text, separated[1].step.minutes, separated[1].addedByNavi], ['鍋にたっぷりの湯を沸かす', BOIL_WATER_MINUTES, false || true])
  eq('ナビ湯沸かし分離: 残りの手順は元の手順番号を保つ', [separated[2].stepNumber, separated[2].step.text], [2, 'にんじんを2分茹でる。'])
  const separatedPlan = buildCookTimeline([
    recipe(1, 'ナムル', [t('にんじんは細切りにする。'), t('鍋にたっぷりの湯を沸かし、にんじんを2分茹でる。')]),
  ])
  eq(
    'ナビ湯沸かし分離: 沸かし始めからの5分が待ちとして段取りに乗る',
    separatedPlan.items.filter((it) => it.kind === 'wait').map((it) => it.waitMinutes),
    [5, 2],
  )
}

// ---------- 2026-08-11 便FL・実画面から見つかった段取りの実害3件 ----------
// (1)「半日〜一晩」が約20分の待ちとして見積りに入る
// (2)括弧内の任意の記述（レンジ加熱の時短）を、その手順の主たる動作（切る）と取り違える
// (3)湯沸かしを切り出すときに、同じ手順の前半にある手作業まで待ちに巻き込む
{
  const recipe = (id, title, steps) => ({ id, title, steps })
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  // ---- (1) 半日・一晩・数時間のように、その日の調理では終わらない待ち ----
  const ajitama = t('保存袋にめんつゆと水、殻をむいた卵を入れて空気を抜き、冷蔵庫で半日〜一晩漬ける。')
  eq('ナビ長い待ち: 「半日〜一晩漬ける」は待ちのまま（手順自体は消さない）', classifyStep(ajitama), 'wait')
  eq('ナビ長い待ち: 「半日〜一晩」を長い待ちと見分ける', isLongRestStep(ajitama), true)
  eq('ナビ長い待ち: 「一晩寝かせる」も長い待ち', isLongRestStep(t('ふたをして冷蔵庫で一晩寝かせる。')), true)
  eq('ナビ長い待ち: 「数時間おく」も長い待ち', isLongRestStep(t('冷蔵庫で数時間おいて味をなじませる。')), true)
  eq('ナビ長い待ち: 「3時間以上冷やし固める」も長い待ち', isLongRestStep(t('冷凍庫で3時間以上、しっかり凍るまで冷やし固める。')), true)
  eq('ナビ長い待ち: 「20分煮る」は長い待ちではない', isLongRestStep(t('落としぶたをして20分煮る。')), false)
  eq('ナビ長い待ち: 「30分漬ける」は長い待ちではない', isLongRestStep(t('冷蔵庫で30分漬ける。')), false)
  const longRestPlan = buildCookTimeline([
    recipe(1, '味玉', [
      t('卵を沸騰したお湯で10分ゆでる。', 10),
      t('冷水にとり、粗熱が取れたら殻をむく。'),
      ajitama,
    ]),
  ])
  const longRestItem = longRestPlan.items[longRestPlan.items.length - 1]
  // 2026-08-13 便GD: 「保存袋に…空気を抜き、｜冷蔵庫で半日〜一晩漬ける。」は
  // 手作業と待ちが同居する手順として2工程に分かれる。**本文はどちらにも残る**（黙って消さない）
  eq(
    'ナビ長い待ち: 段取りには残す（黙って消さない）',
    longRestPlan.items
      .filter((it) => it.recipeId === 1 && it.splitOf === 3)
      .map((it) => it.text)
      .join(''),
    ajitama.text,
  )
  eq('ナビ長い待ち: 待ちの工程は「半日〜一晩漬ける」の側', longRestItem.text, '冷蔵庫で半日〜一晩漬ける。')
  eq('ナビ長い待ち: 長い待ちの印を立てる', longRestItem.longRest, true)
  eq('ナビ長い待ち: 待ち分数を段取りに数えない（約20分と言わない）', longRestItem.waitMinutes, 0)
  eq(
    // 2026-08-13 便GD: 同居する手作業（保存袋に入れて空気を抜く）は数えるようになったので、
    // 「長い待ちの手順を丸ごと外した段取り」とは比べられない。
    // 長い待ちの工程そのものが1分も伸ばしていないことを直接見る
    'ナビ長い待ち: 全体の目安時間に含めない',
    [
      longRestItem.endMin - longRestItem.startMin,
      longRestPlan.totalMinutes - longRestPlan.items[longRestPlan.items.length - 2].endMin,
    ],
    [0, 0],
  )
  eq('ナビ長い待ち: 「目安です」の断りは出さない（分数自体を出さないため）', longRestItem.waitEstimated, false)

  // ---- (2) 括弧内の「やってもやらなくてよい」記述を主たる動作と取り違えない ----
  const tunaCabbage = t('キャベツをせん切りにする（レンジ600Wで1分半ほど加熱すると時短になる）。')
  eq('ナビ任意括弧: 括弧内の時短レンジは待ちにしない（主たる動作は「切る」）', classifyStep(tunaCabbage), 'active')
  eq('ナビ任意括弧: 作業の種類も「切る」になる', stepCategory(tunaCabbage), 'cut')
  eq('ナビ任意括弧: 所要時間も切る工程の目安になる', estimateActiveMinutes(tunaCabbage).minutes, 3)
  eq(
    'ナビ任意括弧: 「好みで」の括弧も主たる動作と取り違えない',
    classifyStep(t('きゅうりを薄切りにする（好みで塩もみして10分おいてもよい）。')),
    'active',
  )
  // 任意の合図が無い括弧（言い換え・道具が無いときの代わり）は今までどおり読む＝本物の待ちを潰さない
  eq(
    'ナビ任意括弧: 「なければ〜」の言い換えは伏せない（トースター/オーブンの待ちを残す）',
    classifyStep(t('トースター(なければオーブンを200度に予熱して10分ほど焼く)でチーズがこんがり焼き色づくまで焼き、そのまま食卓に出す(取り分ける場合は器に盛る)。', 7)),
    'wait',
  )
  eq(
    'ナビ任意括弧: 「〜の場合は」の但し書きも伏せない（グリルの待ちを残す）',
    classifyStep(t('鮭を裏返し、中まで火が通るまで焼いて器に盛る（両面焼きグリルの場合は裏返さずそのまま両面を焼く）。', 4)),
    'wait',
  )

  // ---- (3) 湯沸かしの切り出しで、同じ手順にある手作業を待ちに巻き込まない ----
  eq(
    'ナビ湯沸かし分離: 前の文の手作業（洗う）は湯沸かしに巻き込まない',
    splitBoilWaterClause('ほうれん草は根元の土を流水でよく洗い落とす。鍋にたっぷりの湯を沸かし、根元から入れて1分ほどゆでる。'),
    {
      boilWater: '鍋にたっぷりの湯を沸かす',
      rest: 'ほうれん草は根元の土を流水でよく洗い落とす。根元から入れて1分ほどゆでる。',
    },
  )
  eq(
    'ナビ湯沸かし分離: 同じ文の前半にある手作業も巻き込まない',
    splitBoilWaterClause('ほうれん草を洗い、鍋にたっぷりの湯を沸かし、根元から入れてゆでる。'),
    {
      boilWater: '鍋にたっぷりの湯を沸かす',
      rest: 'ほうれん草を洗い、根元から入れてゆでる。',
    },
  )
  const spinachPlan = buildPlanSteps([
    t('ほうれん草は根元の土を流水でよく洗い落とす。鍋にたっぷりの湯を沸かし、根元から入れて1分ほどゆでる。'),
    t('冷水にとって水気を絞り、4cm長さに切る。'),
  ])
  eq('ナビ湯沸かし分離: 湯沸かしの工程に手作業の文が混ざらない', spinachPlan[0].step.text, '鍋にたっぷりの湯を沸かす')
  eq('ナビ湯沸かし分離: 巻き込まれていた手作業は次の工程に残る', spinachPlan[1].step.text, 'ほうれん草は根元の土を流水でよく洗い落とす。根元から入れて1分ほどゆでる。')
  eq('ナビ湯沸かし分離: 巻き込まれていた手作業は手作業のまま', classifyStep(spinachPlan[1].step), 'active')

  // ---- (4) 長い待ちで終わる品に「完成」を出さない（2026-08-11 便FL・司令部裁定） ----
  // 「今回の調理では仕上がらない」と「完成」が同じカードに並ぶと、画面が自分で矛盾を言う
  const longRestItems = longRestPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest }))
  eq('ナビ完成の印: 最後の手順が長い待ちの品は「完成」にしない', endsWithLongRest(longRestItems, 1), true)
  const normalPlan = buildCookTimeline([
    recipe(2, '煮もの', [t('大根を切る。'), t('鍋に入れて15分煮る。', 15), t('火を止めて器に盛る。')]),
  ])
  eq(
    'ナビ完成の印: 普通の最後の手順は今までどおり「完成」',
    endsWithLongRest(normalPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest })), 2),
    false,
  )
  // 長い待ちが**途中**にある品は、最後まで進めれば本当に出来上がるので「完成」のまま
  const midRestPlan = buildCookTimeline([
    recipe(3, 'ヨーグルトバーク', [
      t('ボウルにヨーグルトとはちみつを入れてよく混ぜる。'),
      t('ラップをかけずに冷凍庫で3時間以上、しっかり凍るまで冷やし固める。'),
      t('凍ったらオーブンシートごと取り出し、手やナイフで食べやすい大きさに割る。'),
    ]),
  ])
  eq(
    'ナビ完成の印: 長い待ちが途中にある品は「完成」のまま',
    endsWithLongRest(midRestPlan.items.map((it) => ({ recipeId: it.recipeId, longRest: it.longRest })), 3),
    false,
  )
  eq(
    'ナビ完成の印: その途中の手順は長い待ちとして数える（時間は0）',
    midRestPlan.items.filter((it) => it.longRest).map((it) => it.waitMinutes),
    [0],
  )
  eq('ナビ完成の印: 段取りに無い品には印を出さない', endsWithLongRest(longRestItems, 999), false)

  // ---- (5) 待ちブロックの「タイマーを始める」が出たり出なかったりする（2026-08-11 便FN・利用者テスト） ----
  // 実測: 段取りAは手順1にボタンあり・手順9「豆腐とわかめを入れて2分温める」は同じ見た目でボタン無し。
  // 段取りBは待ち5つのうちボタンは1つだけ。ボタンが無いと本文中の小さな「15分」を押すしかない
  eq(
    'FN-WAITBTN 手順に分数が書かれた待ちにはボタンを出す',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 15 }),
    true,
  )
  eq(
    'FN-WAITBTN 本文に同じ分数が書いてあってもボタンを消さない（本文の小さな文字は押せない）',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 2 }),
    true,
  )
  eq(
    'FN-WAITBTN 分数が書かれていない待ち（調理法から当てた分数）にもボタンを出す',
    showsWaitTimerButton({ kind: 'wait', longRest: false, waitMinutes: 8 }),
    true,
  )
  eq(
    'FN-WAITBTN 長い待ち（半日〜一晩）は分数を持たないので出さない',
    showsWaitTimerButton({ kind: 'wait', longRest: true, waitMinutes: 0 }),
    false,
  )
  eq(
    'FN-WAITBTN 手作業の手順には出さない',
    showsWaitTimerButton({ kind: 'active', longRest: false, waitMinutes: 0 }),
    false,
  )
  // 実データでの確認: 味噌汁の「豆腐とわかめを入れて2分温める」と、時間の書かれていない
  // 「ふたをして弱火で煮る」の両方にボタンが出る（同じ待ちブロックなら同じ操作ができる）
  const waitBtnPlan = buildCookTimeline([
    recipe(11, 'FN味噌汁', [
      t('鍋にだしを入れて火にかける。'),
      t('豆腐とわかめを入れて2分温める。', 2),
      t('火を止めてみそを溶き入れる。'),
    ]),
    recipe(12, 'FN煮物', [
      t('大根を切る。'),
      t('鍋に入れ、ふたをして弱火で煮る。'),
      t('器に盛る。'),
    ]),
  ])
  eq(
    'FN-WAITBTN 実データ: 待ちと判定された手順は全部ボタンが出る',
    waitBtnPlan.items.filter((it) => it.kind === 'wait').map((it) => showsWaitTimerButton(it)),
    waitBtnPlan.items.filter((it) => it.kind === 'wait').map(() => true),
  )
  eq(
    'FN-WAITBTN 実データ: 待ちの手順が2つ以上ある（判定の前提が崩れていないこと）',
    waitBtnPlan.items.filter((it) => it.kind === 'wait').length >= 2,
    true,
  )
}

// ---------- stepMinutesFromText(取り込み時に手順の「分」の欄を本文から埋める。
// 2026-08-08 便ED・docs/68 打ち手#2。URL取り込み・貼り付け取り込みは分数欄が必ず空になり、
// 本文に「20分煮る」と書いてあってもタイマーにも並行調理ナビにも使えていなかった。
// 入れるのは本文に書いてある時間の転記だけ＝機械の推測値は入れない) ----------
{
  eq('取り込み分数: 「鍋で15分煮る」→15', stepMinutesFromText('鍋で15分煮る'), 15)
  eq('取り込み分数: 「弱火で1時間半煮込む」→90', stepMinutesFromText('弱火で1時間半煮込む'), 90)
  eq('取り込み分数: 「600Wで3分加熱する」→3', stepMinutesFromText('600Wで3分加熱する'), 3)
  eq('取り込み分数: 複数あれば最長(10分煮て5分蒸らす→10)', stepMinutesFromText('10分煮て5分蒸らす'), 10)
  eq('取り込み分数: 秒だけ(30秒ゆでる)は入れない', stepMinutesFromText('30秒ゆでる'), undefined)
  eq('取り込み分数: 時間表記が無ければ入れない', stepMinutesFromText('材料を切る'), undefined)
  // 推測はしない: 待ち動詞があっても本文に時間が無ければ空のまま(ナビの既定分数は保存しない)
  eq('取り込み分数: 「じっくり煮込む」は空のまま(推測値を保存しない)', stepMinutesFromText('じっくり煮込む'), undefined)
  eq(
    '取り込み分数: 手順の並びぶんを返す',
    importedStepMinutes(['材料を切る', '鍋で15分煮る', '器に盛る']).join(','),
    ',15,',
  )
}

// ---------- buildCookPlan(並行調理ナビ: 並行できないときは正直にそう言い、1品ずつ作る順番を出す。
// 2026-08-08 便ED・docs/68 打ち手#4。短縮5%未満で「約◯分」とだけ出すと、縮んでいないのに
// 縮んだように見える) ----------
{
  // 待ちが1つも無い2品=並行の余地なし
  const flat = buildCookPlan([
    { id: 1, title: 'サラダ', steps: [{ text: 'レタスをちぎる' }, { text: 'ドレッシングと和える' }] },
    { id: 2, title: 'あえもの', steps: [{ text: 'きゅうりを切る' }, { text: 'ごまと和える' }] },
  ])
  eq('ナビ正直表示: 待ちが無い2品は1品ずつ作る順番になる', flat.mode, 'sequential')
  eq('ナビ正直表示: 短縮率は0%', Math.round(flat.gainPercent), 0)
  eq('ナビ正直表示: 1品ずつの合計と全体の目安が一致する', flat.totalMinutes, flat.sequentialMinutes)
  // 1品ずつ完結する順番になっている(レシピが途中で入れ替わらない)
  const titles = flat.items.map((it) => it.recipeTitle)
  eq('ナビ正直表示: 1品ずつ完結する並び', titles.join(','), 'サラダ,サラダ,あえもの,あえもの')

  // 加熱で終わる温かい品は最後にまわす
  const warm = buildCookPlan([
    { id: 1, title: '炒めもの', steps: [{ text: '野菜を切る' }, { text: 'フライパンで炒める' }] },
    { id: 2, title: 'あえもの', steps: [{ text: 'きゅうりを切る' }, { text: 'ごまと和える' }] },
  ])
  eq('ナビ正直表示: 並行の余地なし', warm.mode, 'sequential')
  eq('ナビ正直表示: 加熱で終わる品を最後に作る', warm.items[warm.items.length - 1].recipeTitle, '炒めもの')

  // 加熱のあとに味つけ・盛り付けが続く品も「温かい品」として最後にまわす（実機スクショで判明）
  const warm2 = buildCookPlan([
    {
      id: 1,
      title: '野菜炒め',
      steps: [{ text: '材料を切る' }, { text: '肉を炒める' }, { text: '塩こしょうで味をつける' }, { text: '皿に盛る' }],
    },
    { id: 2, title: 'ツナサラダ', steps: [{ text: 'レタスをちぎる' }, { text: 'ドレッシングと和える' }] },
  ])
  eq('ナビ正直表示: 「炒める→味をつける→盛る」も温かい品として最後', warm2.items[0].recipeTitle, 'ツナサラダ')
  eq(
    'ナビ正直表示: 温かい品は最後まで通しで作る',
    warm2.items[warm2.items.length - 1].recipeTitle,
    '野菜炒め',
  )

  // 待ちが活きる組み合わせは従来どおり並行の段取り
  const par = buildCookPlan([
    { id: 1, title: '煮物', steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  eq('ナビ正直表示: 待ちが活きる組み合わせは並行の段取りのまま', par.mode, 'parallel')
  eq('ナビ正直表示: 並行のときは短縮率が5%以上', par.gainPercent >= 5, true)
  eq(
    'ナビ正直表示: 並行の段取りは1品ずつの合計より短い',
    par.totalMinutes < par.sequentialMinutes,
    true,
  )

  // --- 便FN(2026-08-11 利用者テスト): 2つの分数の食い違いを画面で確かめられるようにする ---
  // 指摘「レシピ一覧の所要時間の合計35分に対して段取りは『1品ずつ作ると約41分』。別の3品では
  // 一覧の合計95分に対して80分。多く出たり少なく出たりするので、どちらを信じてよいか分からない」。
  // ナビの分数はレシピ欄の「調理時間」と数え方が違う（一致させられない）ので、代わりに
  // 品ごとの内訳を出して「合計＝この積み上げ」が読めるようにした
  eq(
    'FN-SOLO 品ごとに「1品だけなら約◯分」を持つ',
    par.recipes.every((r) => typeof r.soloMinutes === 'number' && r.soloMinutes > 0),
    true,
  )
  eq(
    'FN-SOLO 品ごとの目安の合計が「1品ずつ作ると約◯分」と一致する',
    par.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
    par.sequentialMinutes,
  )
  eq(
    'FN-SOLO 1品ずつ作る段取りのときも内訳を持つ',
    flat.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
    flat.sequentialMinutes,
  )
  // レシピ欄の「調理時間」(cookMinutes)には一切影響されない＝ナビは自分の数え方だけで数える。
  // ここが混ざると「どちらの数字なのか」がその場その場で変わり、指摘そのものが再発する
  const withCookMinutes = buildCookPlan([
    { id: 1, title: '煮物', cookMinutes: 999, steps: [{ text: '材料を切る' }, { text: '鍋で15分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'サラダ', cookMinutes: 1, steps: [{ text: '野菜を切る' }, { text: 'ドレッシングと和える' }] },
  ])
  eq(
    'FN-SOLO レシピ欄の「調理時間」はナビの分数に混ぜない',
    withCookMinutes.recipes.map((r) => r.soloMinutes),
    par.recipes.map((r) => r.soloMinutes),
  )
}

// ---------- buildCookTimeline / buildCookPlan(並行調理ナビ: 画面に出ている数字どうしを合わせる。
// 2026-08-12 便FU-1・利用者テスト(4回中4回再現)) ----------
//
// 指摘（原文）: 「鶏むね肉のみそマヨ焼き 1品だけなら約37分」なのに、同じ画面の手順表示は
// 待ち10分＋3分＋2分＋待ち15分＋4分＝34分。他2品は一致するのに鶏だけ+3分ずれる。
//
// 真因: 待ちを仕掛けた品には「遅くともこの時刻までに手を戻す」締め切り（attendUntil＝
// 待ち終了＋煮込みの猶予2割）が立つ。差し込む手作業がその締め切りを越えないかを見る判定で、
// **その締め切りを立てた本人の手順まで弾いていた**。鍋に戻る作業そのものを鍋の締め切りで
// 止めていたことになり、締め切りの時刻まで何もしない空白が段取りに入る。
// 空白は手順のどこにも出ないので、手順の分数を足した値とヘッダーの合計が食い違う。
//
// 正しいのは手順の側（34分）。空白は料理の都合ではなく計算の産物なので、空白を作らない。
{
  const s = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  /** その手順カードに出る分数（待ちは待ち分数・手作業は目安時間。長い待ちは出さない＝0） */
  const shownMinutes = (it) => (it.kind === 'wait' ? it.waitMinutes : it.activeMinutes)
  const sumShown = (items) => items.reduce((sum, it) => sum + shownMinutes(it), 0)

  const misoMayo = {
    id: 1,
    title: '鶏むね肉のみそマヨ焼き',
    servings: 2,
    ingredients: [],
    steps: [
      s('鶏むね肉に☆をもみ込んで10分おく。', 10),
      s('玉ねぎを薄切りにする。', 3),
      s('天板にアルミホイルを敷く。', 2),
      s('魚焼きグリルの弱火で12〜15分焼く。', 15),
      s('器に盛り、細ねぎを散らす。', 4),
    ],
  }
  const misoMayoTimeline = buildCookTimeline([misoMayo])
  eq(
    'FU-1 手順に出る分数の並びは指摘のとおり（10・3・2・15・4）',
    misoMayoTimeline.items.map(shownMinutes),
    [10, 3, 2, 15, 4],
  )
  eq(
    'FU-1 ヘッダーの合計は、画面に出ている各手順の分数の足し算と一致する',
    misoMayoTimeline.totalMinutes,
    sumShown(misoMayoTimeline.items),
  )
  eq('FU-1 みそマヨ焼きの合計は34分（+3分の空白が入らない）', misoMayoTimeline.totalMinutes, 34)

  // 締め切りのある待ち（ゆで・煮込み）を持つ品を何通りか通しても、空白が入らないことを見張る。
  // 1品だけの段取りには「他にやることが無いので待つ」以外の空白は起こりえない
  const soloShapes = [
    [s('鍋にたっぷりの湯を沸かし、にんじんを4分ゆでる。'), s('ざるにあげて水気をきる。'), s('ごま油とめんつゆで和え、器に盛る。')],
    [s('大根は一口大に切る。'), s('鍋に大根とだしを入れて中火で15分煮る。', 15), s('火を止めて10分おき、器に盛る。', 10)],
    [s('豚肉に下味をもみ込んで20分漬ける。', 20), s('フライパンで両面を3分ずつ焼く。'), s('たれを煮からめ、器に盛る。')],
    [s('じゃがいもを600Wのレンジで5分加熱する。', 5), s('熱いうちにつぶす。'), s('マヨネーズと和えて器に盛る。')],
  ]
  soloShapes.forEach((steps, i) => {
    const t = buildCookTimeline([{ id: 1, title: `型${i + 1}`, servings: 2, ingredients: [], steps }])
    eq(
      `FU-1 1品だけの段取りに空白の分数が入らない（型${i + 1}）`,
      t.totalMinutes,
      sumShown(t.items),
    )
  })

  // 3品を並行に組んでも、品ごとの「1品だけなら約◯分」は、その品の手順に出ている分数の合計と一致する
  // （画面の照らし合わせは、ヘッダーの数字と手順の数字を機械で突き合わせる形で固定する）
  const plan = buildCookPlan([
    misoMayo,
    {
      id: 2,
      title: '豆腐とわかめのみそ汁',
      servings: 2,
      ingredients: [],
      steps: [s('鍋にだし汁を入れて火にかける。', 2), s('豆腐とわかめを加えて2分煮る。', 2), s('みそを溶き入れ、火を止める。', 4)],
    },
    {
      id: 3,
      title: 'ほうれん草のごま和え',
      servings: 2,
      ingredients: [],
      steps: [s('ほうれん草を洗う。', 3), s('鍋にたっぷりの湯を沸かし、1分ゆでる。', 3), s('水気を絞って4cm長さに切る。', 3), s('すりごまと砂糖で和える。', 3)],
    },
  ])
  plan.recipes.forEach((r) => {
    eq(
      `FU-1 「1品だけなら約◯分」＝その品の手順に出ている分数の合計（${r.title}）`,
      r.soloMinutes,
      sumShown(plan.items.filter((it) => it.recipeId === r.id)),
    )
  })
  eq(
    'FU-1 「1品ずつ作ると約◯分」は品ごとの目安の足し算のまま',
    plan.sequentialMinutes,
    plan.recipes.reduce((sum, r) => sum + r.soloMinutes, 0),
  )
}

// ---------- stepCategory / buildCookTimeline(並行調理ナビ: 3品全体の流れを整える。
// 2026-08-08 便EB・オーナー要望「野菜を切る工程はまとめたい」「準備→加熱→仕上げの流れ」) ----------
{
  eq('ナビ流れ: 「玉ねぎをみじん切りにする」は切る', stepCategory({ text: '玉ねぎをみじん切りにする。' }), 'cut')
  eq('ナビ流れ: 「フライパンで焼く」は加熱', stepCategory({ text: 'フライパンで焼く。' }), 'heat')
  eq('ナビ流れ: 「器に盛る」は仕上げ', stepCategory({ text: '器に盛る。' }), 'finish')
  eq('ナビ流れ: 「ドレッシングと和える」は下ごしらえ', stepCategory({ text: 'ドレッシングと和える。' }), 'season')
  // 複数の動作が並ぶ手順は「最後に来る動作」がその手順の主役
  eq('ナビ流れ: 「切った野菜を炒める」は加熱(最後の動作)', stepCategory({ text: '切った野菜を炒める。' }), 'heat')
  eq('ナビ流れ: 「焼いた肉を切って器に盛る」は仕上げ', stepCategory({ text: '焼いた肉を切って器に盛る。' }), 'finish')

  // 待ちが無い2品でも、レシピ1品を丸ごと終えてから次に移る組み方にしない
  // (旧実装は残りの待ちが同点だとレシピの選択順で決めていたため、A全部→B全部になっていた)
  const flow = buildCookTimeline([
    { id: 1, title: 'A', steps: [{ text: '野菜を切る' }, { text: 'フライパンで焼く' }, { text: '器に盛る' }] },
    { id: 2, title: 'B', steps: [{ text: 'きゅうりを切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const texts = flow.items.map((it) => it.text)
  eq(
    'ナビ流れ: 「切る」工程が続けて並ぶ(バラけない)',
    texts.indexOf('きゅうりを切る') - texts.indexOf('野菜を切る'),
    1,
  )
  eq('ナビ流れ: 盛り付けは最後にまわる', texts[texts.length - 1], '器に盛る')
  // 加熱は、着手できる「切る」工程を片付けてから（段階の大枠が崩れない）。
  // 「ドレッシングと和える」より後になるとは限らない＝残り時間の長い品を先に進める基準が優先される
  eq(
    'ナビ流れ: 加熱は2品ぶんの「切る」を片付けたあと',
    texts.indexOf('フライパンで焼く') > texts.indexOf('きゅうりを切る'),
    true,
  )

  // 残り時間が長い品を先に進める(流れを整えるために全体の所要時間を延ばさない)
  const span = buildCookTimeline([
    { id: 1, title: '短い', steps: [{ text: 'レタスを切る' }, { text: '器に盛る' }] },
    { id: 2, title: '長い', steps: [{ text: '玉ねぎを切る' }, { text: '弱火で30分煮る', minutes: 30 }, { text: '器に盛る' }] },
  ])
  eq('ナビ流れ: 長い待ちが控えている品の下ごしらえを先に始める', span.items[0].recipeTitle, '長い')
  eq('ナビ流れ: 2番目には30分の待ちを仕掛ける', span.items[1].kind, 'wait')
}

// ---------- cutOrderRank / buildCookTimeline(並行調理ナビ: 切る順番は野菜→肉。
// 2026-08-08 便ED・オーナー指示「切る順番を野菜→肉、肉は最後に」＝まな板の交差汚染を避ける定石) ----------
{
  eq('ナビ切る順: 「玉ねぎを切る」は先に切る側', cutOrderRank({ text: '玉ねぎを薄切りにする' }), 0)
  eq('ナビ切る順: 「鶏もも肉を切る」は最後に切る側', cutOrderRank({ text: '鶏もも肉を一口大に切る' }), 1)
  eq('ナビ切る順: 「豚バラ肉を切る」は最後に切る側', cutOrderRank({ text: '豚バラ薄切り肉を食べやすく切る' }), 1)
  eq('ナビ切る順: 「鮭の切り身」は最後に切る側', cutOrderRank({ text: '鮭の切り身を半分に切る' }), 1)
  // 判断が付かない語は野菜あつかい（余計に並べ替えない）
  eq('ナビ切る順: 「材料を切る」は先に切る側(判断が付かないものは動かさない)', cutOrderRank({ text: '材料を切る' }), 0)

  // 2品の「切る」が同時に着手できるとき、野菜の方が先に来る
  const cutOrder = buildCookTimeline([
    { id: 1, title: '肉料理', steps: [{ text: '鶏もも肉を一口大に切る' }, { text: 'フライパンで焼く' }] },
    { id: 2, title: 'サラダ', steps: [{ text: 'レタスとトマトを切る' }, { text: 'ドレッシングと和える' }] },
  ])
  const cutTexts = cutOrder.items.map((it) => it.text)
  eq(
    'ナビ切る順: 野菜を切る工程が肉を切る工程より先に来る',
    cutTexts.indexOf('レタスとトマトを切る') < cutTexts.indexOf('鶏もも肉を一口大に切る'),
    true,
  )
}

// ---------- parseCookNaviSession(並行調理ナビ: 作りかけの段取りを覚える。
// 2026-08-08 便ED・オーナー実機フィードバック①「画面移動するたびに段取りを作るところからやり直し」) ----------
{
  eq(
    'ナビ状態保持: 保存した内容をそのまま読み戻せる',
    JSON.stringify(parseCookNaviSession('{"selectedIds":[3,7],"showTimeline":true,"trialActive":false}')),
    JSON.stringify({ selectedIds: [3, 7], showTimeline: true, trialActive: false }),
  )
  eq('ナビ状態保持: 空の保存は覚えていない扱い', parseCookNaviSession(null), undefined)
  eq('ナビ状態保持: 壊れた保存は覚えていない扱い', parseCookNaviSession('{壊れ'), undefined)
  eq('ナビ状態保持: 選んだ品が無ければ覚えていない扱い', parseCookNaviSession('{"selectedIds":[]}'), undefined)
  eq(
    'ナビ状態保持: 数字でないIDは捨てる',
    JSON.stringify(parseCookNaviSession('{"selectedIds":[1,"x",null,2]}')?.selectedIds),
    JSON.stringify([1, 2]),
  )
  eq(
    'ナビ状態保持: お試し中かどうかも覚える(戻るたびに回数を失わないため)',
    parseCookNaviSession('{"selectedIds":[1],"trialActive":true}')?.trialActive,
    true,
  )
}

// ---------- stepIngredientAmounts / recipeIngredientList(並行調理ナビ: 段取り中に分量が見える。
// 2026-08-08 便EB・オーナー実機報告「ナビを選択すると、分量が消えるので計量できない」) ----------
{
  // 肉巻きおにぎり(src/sets/pack07.ts)の実データ
  const nikumakiIngredients = [
    { name: '豚バラ薄切り肉', amount: '200', unit: 'g' },
    { name: 'ご飯', amount: '2', unit: '杯分' },
    { name: '片栗粉', amount: '1', unit: '大さじ' },
    { name: 'しょうゆ', amount: '2', unit: '大さじ' },
    { name: 'みりん', amount: '2', unit: '大さじ' },
    { name: '砂糖', amount: '1', unit: '大さじ' },
    { name: 'サラダ油', amount: '適量', unit: '' },
  ]
  const label = (list) => list.map((x) => `${x.name} ${x.amount}`.trim())
  eq(
    'ナビ材料: 手順に出てくる材料だけを分量つきで拾う',
    label(
      stepIngredientAmounts('豚バラ肉をご飯に巻きつけ、片栗粉を薄くまぶす。', nikumakiIngredients, 2, 2),
    ),
    ['豚バラ薄切り肉 200g', 'ご飯 2杯分', '片栗粉 大さじ1'],
  )
  eq(
    'ナビ材料: 出てこない材料は返さない',
    label(stepIngredientAmounts('転がしながら全体に焼き色をつける。', nikumakiIngredients, 2, 2)),
    [],
  )
  eq(
    'ナビ材料: 人数を倍にすると分量も倍になる(詳細画面と同じ換算)',
    label(stepIngredientAmounts('豚バラ肉を巻きつける。', nikumakiIngredients, 2, 4)),
    ['豚バラ薄切り肉 400g'],
  )
  eq(
    'ナビ材料: 「適量」はそのまま出す',
    label(stepIngredientAmounts('フライパンにサラダ油を中火で熱する。', nikumakiIngredients, 2, 2)),
    ['サラダ油 適量'],
  )

  // 誤検出は出さない方に倒す(嘘の分量を出さない)
  const water = [
    { name: '水', amount: '300', unit: 'ml' },
    { name: '塩', amount: '少々', unit: '' },
  ]
  eq('ナビ材料: 「水を入れる」は水を拾う', label(stepIngredientAmounts('鍋に水を入れる。', water, 2, 2)), ['水 300ml'])
  eq('ナビ材料: 「水気を絞る」の水は拾わない', label(stepIngredientAmounts('水気をしっかり絞る。', water, 2, 2)), [])
  eq('ナビ材料: 「流水で洗う」の水は拾わない', label(stepIngredientAmounts('根元を流水でよく洗う。', water, 2, 2)), [])
  eq('ナビ材料: 「冷水にとる」の水は拾わない', label(stepIngredientAmounts('ざるにあげて冷水にとる。', water, 2, 2)), [])
  eq('ナビ材料: 「塩ゆで」の塩は拾わない', label(stepIngredientAmounts('塩ゆでする。', water, 2, 2)), [])
  eq('ナビ材料: 「塩をふる」の塩は拾う', label(stepIngredientAmounts('塩をふる。', water, 2, 2)), ['塩 少々'])
  // 同じ表記に材料欄の2行が当たるとき(2026-08-08 便EG・オーナー実機報告
  // 「下線は出るのに分量が出ない材料がある」)。黙って出さないと下線だけが浮くので、
  // 手順文に書かれた用途で絞り、決まらなければ括弧の注記つきで両方出す
  const katakuriko = [
    { name: '片栗粉(肉だね用)', amount: '1', unit: '大さじ' },
    { name: '片栗粉(あん用)', amount: '2', unit: '小さじ' },
  ]
  eq(
    'ナビ材料: 同名の材料が2行あり用途が読めないときは両方出す(下線だけ浮かせない)',
    label(stepIngredientAmounts('片栗粉を加えて混ぜる。', katakuriko, 2, 2)),
    ['片栗粉(肉だね用) 大さじ1', '片栗粉(あん用) 小さじ2'],
  )
  eq(
    'ナビ材料: 手順文に用途が書いてあれば1行に絞る(あん用)',
    label(stepIngredientAmounts('別の器に酢と片栗粉(あん用)を混ぜる。', katakuriko, 2, 2)),
    ['片栗粉(あん用) 小さじ2'],
  )
  // オーナー実機の例: 「オリーブオイル(下味用)」「オリーブオイル(焼く用)」
  const oliveOil = [
    { name: 'オリーブオイル(下味用)', amount: '1', unit: '大さじ' },
    { name: 'オリーブオイル(焼く用)', amount: '適量', unit: '' },
  ]
  eq(
    'ナビ材料: 「下味だれを作る」手順では下味用のオリーブオイルだけ出す',
    label(stepIngredientAmounts('袋にオリーブオイル・塩・こしょうを入れて下味だれを作る。', oliveOil, 2, 2)),
    ['オリーブオイル(下味用) 大さじ1'],
  )
  eq(
    'ナビ材料: 「焼く」手順では焼く用のオリーブオイルだけ出す',
    label(stepIngredientAmounts('フライパンにオリーブオイルを熱し、皮目を下にして焼く。', oliveOil, 2, 2)),
    ['オリーブオイル(焼く用) 適量'],
  )
  // 接頭語つきの材料名(2026-08-08 便EG): 材料欄「乾燥ハーブ(…)」・本文「ハーブ」でも拾う
  eq(
    'ナビ材料: 「乾燥ハーブ(オレガノ)」は本文の「ハーブ」で拾う',
    label(
      stepIngredientAmounts(
        '袋にハーブを入れて混ぜる。',
        [{ name: '乾燥ハーブ(オレガノまたはローズマリー)', amount: '1/2', unit: '小さじ' }],
        2,
        2,
      ),
    ),
    ['乾燥ハーブ(オレガノまたはローズマリー) 小さじ1/2'],
  )
  eq(
    'ナビ材料: 「乾燥わかめ」は本文の「わかめ」で拾う',
    label(
      stepIngredientAmounts('豆腐とわかめを加える。', [{ name: '乾燥わかめ', amount: '2', unit: 'g' }], 2, 2),
    ),
    ['乾燥わかめ 2g'],
  )
  // 下線と分量は必ず一致する(片方だけ当たる状態を作らない)。
  // 下線の根拠 findIngredientMatches をそのまま分量の根拠にしているかを、代表例で固定する
  {
    const names = naviIngredientNames(water)
    const cases = [
      '鍋に水を入れる。',
      '水気をしっかり絞る。',
      'ざるにあげて冷水にとる。',
      '水溶き片栗粉を回し入れる。',
      '塩ゆでする。',
      '塩をふる。',
    ]
    const mismatch = cases.filter((text) => {
      const underlined = naviIngredientMatches(text, names).length > 0
      const shown = stepIngredientAmounts(text, water, 2, 2).length > 0
      return underlined !== shown
    })
    eq('ナビ材料: 下線が引かれた語には必ず分量が出る(不一致0件)', mismatch, [])
  }
  // 「卵液」の卵など、既存の除外規則(ingredientSpans)はそのまま効く
  eq(
    'ナビ材料: 「卵液」の卵は拾わない(既存の除外規則を流用)',
    label(stepIngredientAmounts('卵液を流し入れる。', [{ name: '卵', amount: '2', unit: '個' }], 2, 2)),
    [],
  )

  // ③レシピごとの材料一覧(あらかじめ計量したい人向け。人数換算込みで全材料を返す)
  eq(
    'ナビ材料一覧: 全材料を材料欄の並びのまま分量つきで返す',
    label(recipeIngredientList(nikumakiIngredients, 2, 2)),
    [
      '豚バラ薄切り肉 200g',
      'ご飯 2杯分',
      '片栗粉 大さじ1',
      'しょうゆ 大さじ2',
      'みりん 大さじ2',
      '砂糖 大さじ1',
      'サラダ油 適量',
    ],
  )
  eq(
    'ナビ材料一覧: 4人分にすると分量が倍になる',
    label(recipeIngredientList(nikumakiIngredients, 2, 4)),
    [
      '豚バラ薄切り肉 400g',
      'ご飯 4杯分',
      '片栗粉 大さじ2',
      'しょうゆ 大さじ4',
      'みりん 大さじ4',
      '砂糖 大さじ2',
      'サラダ油 適量',
    ],
  )

  // --- 便FU-2(2026-08-12 利用者テスト): 合わせ調味料が段取り・調理中モードに出ない ---
  // 指摘（原文）:「☆の4つ・◎の4つを手で色付けしました（計8タップ）。ところが段取りの手順
  // 「その間に☆を全部混ぜ合わせておく。」には材料が1つも出ません。◎の手順も「しょうゆ 大さじ1」
  // しか出ず、すりごま・砂糖・だしの素は出ません」
  //
  // 画面の案内が「色分けしておくと調理中モードでまとめて表示されます」と約束しているので、
  // ①組の材料が1つでも当たったらその組を全部出す ②手順文の組の印（☆等）でも組を出す
  const misoMayoIngredients = [
    { name: '鶏むね肉', amount: '300', unit: 'g' },
    { name: 'みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: 'マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: '砂糖', amount: '1', unit: '小さじ', seasoningGroup: 1 },
    { name: '酒', amount: '1', unit: '小さじ', seasoningGroup: 1 },
  ]
  eq(
    'FU-2 組の材料が1つでも当たったら、その組を全部出す',
    label(stepIngredientAmounts('みそを混ぜ合わせる。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  eq(
    'FU-2 組の材料は材料欄の並び順で出す（当たった1つが先頭に来ない）',
    label(stepIngredientAmounts('酒をふる。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  eq(
    'FU-2 組に入っていない材料は今までどおり手順に出てくるものだけ',
    label(stepIngredientAmounts('鶏むね肉はそぎ切りにする。', misoMayoIngredients, 2, 2)),
    ['鶏むね肉 300g'],
  )
  eq(
    'FU-2 組がその手順に出てこなければ何も出さない（関係ない手順に持ち込まない）',
    label(stepIngredientAmounts('天板にアルミホイルを敷く。', misoMayoIngredients, 2, 2)),
    [],
  )
  // 組が1つだけのレシピでは、手順文の印（☆）が指す先はその組しかない＝推測にならない
  eq(
    'FU-2 「☆を全部混ぜ合わせておく」でも、組が1つだけならその組を出す',
    label(stepIngredientAmounts('その間に☆を全部混ぜ合わせておく。', misoMayoIngredients, 2, 2)),
    ['みそ 大さじ1', 'マヨネーズ 大さじ2', '砂糖 小さじ1', '酒 小さじ1'],
  )
  // 材料名の先頭に印が残っているレシピは、組が複数あっても印で見分けられる
  const markedIngredients = [
    { name: '鶏むね肉', amount: '300', unit: 'g' },
    { name: '☆みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: '☆マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: '◎しょうゆ', amount: '1', unit: '大さじ', seasoningGroup: 2 },
    { name: '◎すりごま', amount: '1', unit: '大さじ', seasoningGroup: 2 },
  ]
  eq(
    'FU-2 材料名に印が残っていれば、組が2つでも印で見分けて出す（☆）',
    label(stepIngredientAmounts('その間に☆を全部混ぜ合わせておく。', markedIngredients, 2, 2)),
    ['☆みそ 大さじ1', '☆マヨネーズ 大さじ2'],
  )
  eq(
    'FU-2 材料名に印が残っていれば、組が2つでも印で見分けて出す（◎）',
    label(stepIngredientAmounts('◎を混ぜて回しかける。', markedIngredients, 2, 2)),
    ['◎しょうゆ 大さじ1', '◎すりごま 大さじ1'],
  )
  // 印が材料名に無く、組が2つ以上あるときは、どの組かを機械が決められない＝出さない（嘘を出さない）
  const twoGroups = [
    { name: 'みそ', amount: '1', unit: '大さじ', seasoningGroup: 1 },
    { name: 'マヨネーズ', amount: '2', unit: '大さじ', seasoningGroup: 1 },
    { name: 'しょうゆ', amount: '1', unit: '大さじ', seasoningGroup: 2 },
    { name: 'すりごま', amount: '1', unit: '大さじ', seasoningGroup: 2 },
  ]
  eq(
    'FU-2 印の指す先が決められないときは出さない（当てずっぽうの組を出さない）',
    label(stepIngredientAmounts('☆を全部混ぜ合わせておく。', twoGroups, 2, 2)),
    [],
  )
  eq(
    'FU-2 印が無い手順では、組が1つでも勝手に出さない',
    label(stepIngredientAmounts('全体をよく混ぜる。', misoMayoIngredients, 2, 2)),
    [],
  )
  eq(
    'FU-2 出した材料には組の番号が付いている（画面の線の引き分けに使う）',
    stepIngredientAmounts('みそを混ぜ合わせる。', misoMayoIngredients, 2, 2).map((x) => x.seasoningGroup),
    [1, 1, 1, 1],
  )
}

// ---------- 便GJ: 段取りを手で並べ替える(2026-08-14・docs/71 R3/R4) ----------
// R3「段取りを手で並べ替える手段がない。上下ボタンもドラッグもなし。出てきた順番が
//     気に入らなくても直せません。」
// R4「順番の入れ替えも…できません。前後させると番号が合わなくなり、調理中モードは元の順で
//     進みます。」
//
// 動かす指示は**色で先にしたときと同じ `pulls` 1件**で表す（覚え書きの項目を増やさない＝
// docs/69「書ける状態は cookNaviSession ＋ current ＋ pulls だけ」）。
{
  const gjPlan = [
    { recipeId: 10, stepIndex: 0 }, // 0
    { recipeId: 20, stepIndex: 0 }, // 1
    { recipeId: 10, stepIndex: 1 }, // 2
    { recipeId: 30, stepIndex: 0 }, // 3
  ]
  const gjKey = (list) => list.map((x) => `${x.recipeId}:${x.stepIndex}`)
  const gjMove = (list, index, dir) => {
    const pull = dir === 'up' ? moveStepUpPull(list, index) : moveStepDownPull(list, index)
    return pull ? applyStepPulls(list, [pull]) : list
  }

  // --- ① 1つずつ動かせる ---
  eq('GJ-MOVE 手順を1つ上へ動かせる', gjKey(gjMove(gjPlan, 2, 'up')), [
    '10:0',
    '10:1',
    '20:0',
    '30:0',
  ])
  eq('GJ-MOVE 手順を1つ下へ動かせる', gjKey(gjMove(gjPlan, 1, 'down')), [
    '10:0',
    '10:1',
    '20:0',
    '30:0',
  ])
  eq('GJ-MOVE いちばん上の手順は上へ動かせない', moveStepUpPull(gjPlan, 0), undefined)
  eq(
    'GJ-MOVE いちばん下の手順は下へ動かせない',
    moveStepDownPull(gjPlan, gjPlan.length - 1),
    undefined,
  )
  eq('GJ-MOVE 段取りの外を指しても指示を作らない', moveStepUpPull(gjPlan, 99), undefined)
  eq('GJ-MOVE 手順の数は動かしても変わらない（1つも消えない）', gjMove(gjPlan, 3, 'up').length, 4)
  // 上下は同じ動きの裏表＝押しすぎても同じ数だけ押し返せば戻る（規約F「元に戻せる」）
  eq(
    'GJ-MOVE 上へと下へは同じ動きの裏表（i を上へ ＝ i-1 を下へ）',
    gjKey(gjMove(gjPlan, 2, 'up')),
    gjKey(gjMove(gjPlan, 1, 'down')),
  )
  eq(
    'GJ-MOVE 上へ→下へで元の並びに戻る',
    gjKey(gjMove(gjMove(gjPlan, 2, 'up'), 1, 'down')),
    gjKey(gjPlan),
  )
  eq(
    'GJ-MOVE いちばん下の手順を上へ動かしても壊れない',
    gjKey(gjMove(gjPlan, 3, 'up')),
    ['10:0', '20:0', '30:0', '10:1'],
  )
  // 覚えるのは指示だけ＝読み込み直して当て直しても同じ並びになる
  // 指示は**その場に出ている並び**から作る（画面と同じ）。並べて当て直すと同じ結果になる
  {
    const first = moveStepUpPull(gjPlan, 2)
    const afterFirst = applyStepPulls(gjPlan, [first])
    const second = moveStepDownPull(afterFirst, 0)
    eq(
      'GJ-SAVE 覚えた指示を組み直した段取りへ当て直すと、同じ並びになる',
      gjKey(applyStepPulls(gjPlan, [first, second])),
      gjKey(applyStepPulls(afterFirst, [second])),
    )
    eq(
      'GJ-SAVE 2回動かした結果（読み込み直しても同じ並びに戻る）',
      gjKey(applyStepPulls(gjPlan, [first, second])),
      ['10:1', '10:0', '20:0', '30:0'],
    )
  }
  eq(
    'GJ-SAVE 手順が消えていた指示は飛ばす（推測で近い場所に当てない）',
    gjKey(applyStepPulls(gjPlan, [{ before: { recipeId: 99, stepIndex: 0 }, target: gjPlan[1] }])),
    gjKey(gjPlan),
  )

  // --- ② 動かした結果が「うちの台所では無理」になったとき ---
  // 止めない。**印を出すだけ**（司令部の判断）。自動で組んだ並びを同じやり方で数えた結果を
  // 引き算するので、並びを変えていなければ印は1つも出ない。
  const gjRecipe = (id, title, steps) => ({
    id,
    title,
    steps: steps.map((s) => (typeof s === 'string' ? { text: s } : s)),
  })
  const gjKitchen = (burners) => ({ burners, microwave: true, grill: true, toaster: true })
  const gjRecipes = [
    gjRecipe(1, 'GJ煮物', ['大根を一口大に切る。', '鍋に大根とだしを入れて中火で12分煮る。', '器に盛る。']),
    gjRecipe(2, 'GJ炒めもの', ['にんじんを細切りにする。', 'フライパンで豚肉を炒める。', '器に盛る。']),
  ]
  const gjBase = buildCookPlan(gjRecipes, gjKitchen(2))
  eq(
    'GJ-WARN 並びを変えていなければ印は1つも出ない（自動の段取りの見え方は変わらない）',
    reorderIssues(gjBase.items, gjBase.items, gjKitchen(2)).length,
    0,
  )
  eq(
    'GJ-WARN コンロ1口でも、自動で組んだ並びには印を出さない',
    reorderIssues(
      buildCookPlan(gjRecipes, gjKitchen(1)).items,
      buildCookPlan(gjRecipes, gjKitchen(1)).items,
      gjKitchen(1),
    ).length,
    0,
  )
  // その品の中の順番を逆にすると、必ず印が出る（見積りではなく確かめられる事実）
  const gjSameRecipeIndexes = gjBase.items
    .map((item, index) => ({ item, index }))
    .filter((x) => x.item.recipeId === 1)
  const gjSwapped = applyStepPulls(gjBase.items, [
    { before: gjSameRecipeIndexes[0].item, target: gjSameRecipeIndexes[1].item },
  ])
  const gjSwapIssues = reorderIssues(gjBase.items, gjSwapped, gjKitchen(2))
  eq(
    'GJ-WARN その品の手順をレシピの順より前に出すと印が出る',
    gjSwapIssues.some((i) => i.kind === 'recipeOrder'),
    true,
  )
  eq(
    'GJ-WARN 印が付くのは、前に出したその手順',
    gjSwapIssues.find((i) => i.kind === 'recipeOrder')?.stepIndex,
    gjSameRecipeIndexes[1].item.stepIndex,
  )
  eq(
    'GJ-WARN 動かしても手順は1つも消えない（印を出すだけで段取りは壊さない）',
    gjSwapped.length,
    gjBase.items.length,
  )
  // コンロ1口の家で、煮込みの待ちの中へ別の品の炒めものを入れると口が足りない
  {
    const one = buildCookPlan(gjRecipes, gjKitchen(1))
    const simmer = one.items.findIndex((x) => x.recipeId === 1 && x.kind === 'wait')
    const fry = one.items.findIndex((x) => x.recipeId === 2 && /炒め/.test(x.text))
    if (simmer >= 0 && fry > simmer) {
      const moved = applyStepPulls(one.items, [
        { before: one.items[simmer + 1], target: one.items[fry] },
      ])
      const issues = reorderIssues(one.items, moved, gjKitchen(1))
      eq(
        'GJ-WARN 1口の家で、煮込みの待ちの中へ別の品の炒めものを入れると印が出る',
        issues.some((i) => i.kind === 'appliance' && i.appliance === 'stove'),
        true,
      )
      eq(
        'GJ-WARN 同じ並びを2口で見ると、その印は出ない（設定した台数で判断している）',
        reorderIssues(one.items, moved, gjKitchen(2)).some((i) => i.kind === 'appliance'),
        false,
      )
    }
  }
  // 印は手順ごとにまとめて引ける（画面はこの表を引くだけ）
  eq(
    'GJ-WARN 印は手順ごとにまとめて引ける',
    reorderIssuesByStep(gjSwapIssues).get(reorderStepKey(gjSameRecipeIndexes[1].item))?.length >= 1,
    true,
  )
  eq('GJ-WARN 印が無い段取りの表は空', reorderIssuesByStep([]).size, 0)
}

// ---------- 2026-08-11 便FM・レシピ本体のメモが並行調理ナビに1行も出ていなかった ----------
// 再発防止: レシピ詳細では出ている recipe.memo が、段取り(CookNaviPage)にも
// 調理中モード(CookSessionOverlay)にも描かれていなかった(両画面が出していたのは
// 手順ごとの item.memo だけ)。同梱109品のうち94品が本体のメモを持ち、その多くが
// 交差汚染・火通し・保存の行で、複数の品を同時に進める並行調理でこそ要るもの。
{
  /** レシピ定義から、割り当ての入力になる手順の並びを作る(ナビ追加工程なしの素の並び) */
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const byTitle = (title) => starterDefs.find((d) => d.title === title)
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)

  // ---- (1) 行の種類の見分け ----
  eq(
    'FM 交差汚染の行は raw(保存の語と同居していても洗う話を優先する)',
    classifyRecipeNote(
      '生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。冷蔵庫で1〜2日ほどで食べ切ること。',
    ),
    'raw',
  )
  eq(
    'FM 火通しの行は heat',
    classifyRecipeNote('卵は半熟で仕上げるので、お子様・高齢者・妊娠中の方や体調に不安があるときは、完全に火を通すこと。'),
    'heat',
  )
  eq('FM 保存の行は keep', classifyRecipeNote('・冷蔵で2〜3日を目安に食べ切ること。'), 'keep')
  eq('FM どれでもない行は other', classifyRecipeNote('・お好みのきのこで作ってよい(しいたけ・マッシュルームなど)。'), 'other')

  // ---- (2) 親子丼(オーナー報告の実データ)。洗う行は鶏肉を切る手順、半熟の行は卵の手順 ----
  const oyako = byTitle('親子丼')
  eq('FM 親子丼が同梱カタログにある', oyako != null, true)
  const oyakoSteps = noteSteps(1, oyako)
  const oyakoNotes = assignRecipeNotes(oyakoSteps, new Map([[1, oyako]]))
  // 手順1には交差汚染の行と、2026-08-11 便FQで足したご飯の用意の行(other)が並ぶ
  const OYAKO_RICE = '・ご飯を炊く時間は調理時間に含んでいない。卵をとじたら熱いうちに盛り付けるので、2杯分を先に炊いておくこと。'
  const OYAKO_WASH = '・生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。'
  eq(
    'FM 交差汚染の行は「鶏肉は一口大」の手順(手順1)に出る',
    notesAt(oyakoNotes, 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )
  eq(
    'FM 火通しの行は卵を入れる手順(手順3)に出る',
    notesAt(oyakoNotes, 1, 2),
    ['・卵は半熟で仕上げるので、お子様・高齢者・妊娠中の方や体調に不安があるときは、完全に火を通すこと。'],
  )
  eq('FM 関係のない手順には出さない(手順2)', notesAt(oyakoNotes, 1, 1), [])
  eq('FM 関係のない手順には出さない(手順4)', notesAt(oyakoNotes, 1, 3), [])

  // ---- (3) 段取りの並び替え(色で引き寄せ)や他の品との混在で割り当てが動かない ----
  const hourensou = byTitle('ほうれん草のおひたし')
  const mixed = [...noteSteps(2, hourensou), ...oyakoSteps]
  const mixedNotes = assignRecipeNotes(mixed, new Map([[1, oyako], [2, hourensou]]))
  eq(
    'FM 他の品と混ざった段取りでも同じ手順に付く',
    notesAt(mixedNotes, 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )
  eq(
    'FM 保存の行はその品の最後の手順に出る',
    notesAt(mixedNotes, 2, hourensou.steps.length - 1).length,
    2,
  )
  eq(
    'FM 並びを逆にしても割り当ては変わらない(色で引き寄せても動かない)',
    notesAt(assignRecipeNotes([...mixed].reverse(), new Map([[1, oyako], [2, hourensou]])), 1, 0),
    [OYAKO_RICE, OYAKO_WASH],
  )

  // ---- (4) ユーザーが自分で登録したレシピでも壊れない ----
  const ownSteps = [
    { recipeId: 9, stepIndex: 0, addedByNavi: false, text: '野菜を切る。' },
    { recipeId: 9, stepIndex: 1, addedByNavi: false, text: '炒めて盛る。' },
  ]
  eq(
    'FM メモが無いレシピには何も出さない',
    assignRecipeNotes(ownSteps, new Map([[9, { ingredients: [] }]])).size,
    0,
  )
  eq(
    'FM メモが空文字のレシピにも何も出さない',
    assignRecipeNotes(ownSteps, new Map([[9, { memo: '\n  \n', ingredients: [] }]])).size,
    0,
  )
  eq(
    'FM 安全の語が無い自作メモは、その品の最初の手順に出す',
    notesAt(
      assignRecipeNotes(ownSteps, new Map([[9, { memo: '母から教わった味。', ingredients: [] }]])),
      9,
      0,
    ),
    ['母から教わった味。'],
  )
  eq(
    'FM 段取りに無いレシピのメモは出さない',
    assignRecipeNotes(ownSteps, new Map([[8, { memo: '冷蔵で2日。', ingredients: [] }]])).size,
    0,
  )

  // ---- (5) ナビが段取りに足した工程(湯を沸かす)には付けない ----
  const withAdded = [
    { recipeId: 3, stepIndex: -1, addedByNavi: true, text: '湯を沸かす' },
    { recipeId: 3, stepIndex: 0, addedByNavi: false, text: '鶏肉を一口大に切る。' },
    { recipeId: 3, stepIndex: 1, addedByNavi: false, text: '10分ゆでて器に盛る。' },
  ]
  const addedNotes = assignRecipeNotes(
    withAdded,
    new Map([
      [
        3,
        {
          memo: '生の鶏肉にふれたまな板・包丁・手は、ほかの食材にさわる前に洗うこと。',
          ingredients: [{ name: '鶏もも肉' }],
        },
      ],
    ]),
  )
  eq('FM ナビが足した工程には割り当てない', addedNotes.has('3--1'), false)
  eq('FM 鶏肉を切る手順に割り当てる', notesAt(addedNotes, 3, 0).length, 1)

  // ---- (6) 同梱109品の全数検査。1行も落とさず、同じ行を2か所に出さない ----
  let checkedRecipes = 0
  let lostLines = 0
  let duplicatedLines = 0
  let outOfRange = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo)
    if (lines.length === 0) continue
    checkedRecipes++
    const steps = noteSteps(7, def)
    const map = assignRecipeNotes(steps, new Map([[7, def]]))
    const placed = []
    for (const [key, notes] of map) {
      if (!steps.some((s) => recipeNoteStepKey(s) === key)) outOfRange++
      for (const note of notes) placed.push(note.text)
    }
    for (const line of lines) {
      const count = placed.filter((t) => t === line).length
      if (count === 0) lostLines++
      if (count > 1) duplicatedLines++
    }
    if (placed.length !== lines.length) duplicatedLines++
  }
  // 96品＝便FM時点の94品＋便FQでメモを新設した2品(ツナキャベツ丼・牛丼)
  eq('FM 本体のメモを持つ同梱レシピは96品', checkedRecipes, 96)
  eq('FM 1行も落とさない', lostLines, 0)
  eq('FM 同じ行を2か所に出さない', duplicatedLines, 0)
  eq('FM 割り当て先はその品の手順だけ', outOfRange, 0)

  // ---- (7) 交差汚染の行が「生の肉を触る手順」に付く(材料名と綴りが違う書き方でも) ----
  const curry = byTitle('カレーライス')
  const curryNotes = assignRecipeNotes(noteSteps(4, curry), new Map([[4, curry]]))
  const curryIndex = curry.steps.findIndex((_, i) =>
    notesAt(curryNotes, 4, i).some((t) => t.includes('洗うこと')),
  )
  eq(
    'FM 「生の肉」(材料名は豚こま切れ肉)でも、肉を扱う手順に付く',
    curry.steps[curryIndex].text.includes('肉'),
    true,
  )
  const tara = byTitle('たらの香味レンジ蒸し')
  const taraNotes = assignRecipeNotes(noteSteps(5, tara), new Map([[5, tara]]))
  eq(
    'FM 「生の魚」(材料名は生だら)でも、たらを扱う最初の手順に付く',
    notesAt(taraNotes, 5, 0).length,
    1,
  )
}

// ---------- 2026-08-11 便FQ・ご飯を材料に持つのに、用意する手順が無い品の注意書き ----------
// 発見: テキストペルソナ3体が独立に「ご飯を炊く工程が段取りに無い」と指摘。調べると
// 9品が「ご飯を材料に持つのに、炊く・温める手順が無い」状態で、段取りの所要時間にも
// 入らないため「約21分」で作れるつもりが炊飯を忘れると成立しない。
// オーナー裁定=A案(手順は増やさず、レシピの注意書きに1行足す)。手順数も分数も変えない。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  /** ご飯を炊く時間が調理時間に入っていないことを断る行の見分け方 */
  const isRiceNote = (line) => /ご飯を炊く時間は調理時間に含んでいない。/.test(line)

  // 対象9品(材料にご飯があり、炊く・温める手順が無い品)
  const RICE_DISHES = [
    'カレーライス', 'ツナキャベツ丼', '親子丼', 'チャーハン', '牛丼',
    '鶏そぼろ丼', 'オムライス', '肉巻きおにぎり', '冷や汁',
  ]
  for (const title of RICE_DISHES) {
    const def = starterDefs.find((d) => d.title === title)
    eq(`FQ ${title}が同梱カタログにある`, def != null, true)
    if (!def) continue
    const lines = splitRecipeNoteLines(def.memo)
    const riceLines = lines.filter(isRiceNote)
    eq(`FQ ${title}の注意書きにご飯の用意の行が1行だけある`, riceLines.length, 1)
    // 注意書きなので、手順の本文・分数・手順数は一切変えない(A案の条件)
    eq(
      `FQ ${title}の手順にご飯を炊く工程は足していない`,
      def.steps.some((s) => /炊/.test(s.text)),
      false,
    )
    // 「炊く時間」を書くだけで機種依存の分数は書かない(炊飯器の時間は機種で違う)
    eq(
      `FQ ${title}のご飯の行に炊飯の分数を書かない`,
      /\d+\s*分/.test(riceLines[0] ?? ''),
      false,
    )
    // 段取り・調理中モードでは「その品の最初の手順」に出る(作り始めに読める位置)
    const map = assignRecipeNotes(noteSteps(11, def), new Map([[11, def]]))
    eq(`FQ ${title}のご飯の行は段取りの最初の手順に出る`, notesAt(map, 11, 0).some(isRiceNote), true)
    eq(
      `FQ ${title}のご飯の行は最初の手順以外には出ない`,
      def.steps.slice(1).some((_, i) => notesAt(map, 11, i + 1).some(isRiceNote)),
      false,
    )
  }
  // 品ごとに書き分ける(同じ一文を9品に貼らない)。ご飯の状態・量が品によって違うため
  const riceTexts = RICE_DISHES.map((title) => {
    const def = starterDefs.find((d) => d.title === title)
    return splitRecipeNoteLines(def?.memo).find(isRiceNote) ?? ''
  })
  eq('FQ 9品のご飯の行はすべて別の文言', new Set(riceTexts).size, 9)
  // 掃引の固定: ご飯を材料に持つ品は10品で、炊く手順があるのは五目炊き込みご飯だけ
  const riceIngredientDishes = starterDefs.filter((d) =>
    d.ingredients.some((i) => /^(ご飯|米)/.test(i.name)),
  )
  eq('FQ ご飯・米を材料に持つ同梱レシピは10品', riceIngredientDishes.length, 10)
  eq(
    'FQ そのうち炊く手順を持つのは五目炊き込みご飯だけ',
    riceIngredientDishes.filter((d) => d.steps.some((s) => /炊/.test(s.text))).map((d) => d.title),
    ['五目炊き込みご飯'],
  )
}

// ---------- 2026-08-12 便FR・材料の選び方の行が、段取りの最後に寄っていた ----------
// 利用者テスト「チャーハンの『ご飯は炊きたてか冷蔵保存のものを使い、常温に長く置いたご飯は
// 使わないこと。』が段取りの最後（完成の手順）に出る」。「冷蔵」「常温」に反応して保存の行と
// 判定されていたが、中身は**どのご飯を使うか**＝作り始める前の話なので最初の手順に出す。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  const CHAHAN_PICK = '・ご飯は炊きたてか冷蔵保存のものを使い、常温に長く置いたご飯は使わないこと。'

  // ---- (1) 行の見分け ----
  eq('FR-NOTE 材料の選び方の行は pick(保存の語が入っていても保存にしない)', classifyRecipeNote(CHAHAN_PICK), 'pick')
  eq('FR-NOTE 「使わない」だけでも材料の選び方と読む', classifyRecipeNote('しなびた野菜は使わないこと。'), 'pick')
  eq('FR-NOTE 「〜のものを使う」も材料の選び方', classifyRecipeNote('豆腐は木綿のものを使うとよい。'), 'pick')
  // 保存・交差汚染の行を横取りしない（同梱レシピに実在する言い回しで固定する）
  eq(
    'FR-NOTE 「使い切る」は材料の選び方ではない(保存のまま)',
    classifyRecipeNote('冷蔵庫で保存する場合は2〜3日を目安に使い切ること。'),
    'keep',
  )
  eq(
    'FR-NOTE 「使い捨て手袋」は材料の選び方ではない(交差汚染のまま)',
    classifyRecipeNote('・手に傷があるときは、使い捨て手袋であえると安心。'),
    'raw',
  )
  eq(
    'FR-NOTE 「◯◯を使い〜のため」の保存の行は保存のまま',
    classifyRecipeNote(
      '・生野菜や豆腐を使い冷たいまま食べる汁物のため、食べる直前まで冷蔵庫でよく冷やしておき、作った日のうちに食べ切ること。',
    ),
    'keep',
  )
  eq(
    'FR-NOTE 「◯◯を使っているので」の保存の行も保存のまま',
    classifyRecipeNote(
      '・冷蔵庫で1〜2日を目安に食べ切ること。牛乳を使っているので、粗熱が取れたら小分けにして早めに冷蔵庫へ入れること。',
    ),
    'keep',
  )

  // ---- (2) チャーハンの実データ。最初の手順に出て、最後の手順には出ない ----
  const chahan = starterDefs.find((d) => d.title === 'チャーハン')
  eq('FR-NOTE チャーハンが同梱カタログにある', chahan != null, true)
  const chahanNotes = assignRecipeNotes(noteSteps(12, chahan), new Map([[12, chahan]]))
  eq(
    'FR-NOTE ご飯の選び方の行は最初の手順に出る',
    notesAt(chahanNotes, 12, 0).includes(CHAHAN_PICK),
    true,
  )
  eq(
    'FR-NOTE 完成の手順には出ない(以前はここに出ていた)',
    notesAt(chahanNotes, 12, chahan.steps.length - 1).includes(CHAHAN_PICK),
    false,
  )
  // 便FQで足した「ご飯を炊く時間は…」と並び、メモに書かれた順のまま出る
  eq('FR-NOTE 最初の手順にはメモの順で2行が並ぶ', notesAt(chahanNotes, 12, 0), [
    '・ご飯を炊く時間は調理時間に含んでいない。炒め始めるまでに2杯分を用意しておくこと。',
    CHAHAN_PICK,
  ])

  // ---- (3) 全数の掃引。動いたのはこの1行だけであることを内訳で固定する ----
  const counts = { raw: 0, pick: 0, during: 0, keep: 0, heat: 0, other: 0 }
  let totalLines = 0
  for (const def of starterDefs) {
    for (const line of splitRecipeNoteLines(def.memo)) {
      counts[classifyRecipeNote(line)]++
      totalLines++
    }
  }
  eq('FR-NOTE 同梱109品の本体メモは169行', totalLines, 169)
  // 2026-08-12 便FX: during(調理の途中の話)を足したので、keepが1行だけそちらへ移る
  // (フレンチトーストの「浸けている間は必ず冷蔵庫に入れておくこと。」)
  eq('FR-NOTE 行の種類の内訳(pickは1行だけ＝チャーハン)', counts, {
    raw: 51,
    pick: 1,
    during: 1,
    keep: 94,
    heat: 8,
    other: 14,
  })
  // 材料の選び方と判定された行は、必ずその品の最初の手順に出る
  let pickLines = 0
  let pickAtFirst = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo).filter((l) => classifyRecipeNote(l) === 'pick')
    if (lines.length === 0) continue
    const map = assignRecipeNotes(noteSteps(13, def), new Map([[13, def]]))
    for (const line of lines) {
      pickLines++
      if (notesAt(map, 13, 0).includes(line)) pickAtFirst++
    }
  }
  eq('FR-NOTE 材料の選び方の行はすべて最初の手順に出る', [pickLines, pickAtFirst], [1, 1])
}

// ---------- 2026-08-12 便FX・調理の途中の話が、段取りの最後に寄っていた ----------
// オーナー実機「フレンチトーストの『浸けている間は必ず冷蔵庫に入れておくこと。』が最後の手順に
// 出る（本当に効くのは手順3＝卵液に浸す）」。「冷蔵」に反応して保存の行と読まれていた。
// 「〜ている間は」＝その作業をしている最中の話なので、保存より先に見分けてその手順に出す。
{
  const noteSteps = (recipeId, def) =>
    def.steps.map((s, i) => ({ recipeId, stepIndex: i, addedByNavi: false, text: s.text }))
  const notesAt = (map, recipeId, stepIndex) =>
    (map.get(recipeNoteStepKey({ recipeId, stepIndex })) ?? []).map((n) => n.text)
  const FT_DURING = '浸けている間は必ず冷蔵庫に入れておくこと。'

  // ---- (1) 行の見分け ----
  eq('FX-NOTE 「〜ている間は」の行は during(冷蔵の語があっても保存にしない)', classifyRecipeNote(FT_DURING), 'during')
  eq('FX-NOTE 「煮ている間は」も during', classifyRecipeNote('煮ている間は火から離れないこと。'), 'during')
  eq('FX-NOTE 「寝かせておく間は」も during', classifyRecipeNote('寝かせておく間は冷蔵庫に入れること。'), 'during')
  // 「時間は」を巻き込まない（同梱9品の「ご飯を炊く時間は調理時間に含んでいない」を動かさない）
  eq(
    'FX-NOTE 「炊く時間は」は during ではない(作り始めに読む行のまま)',
    classifyRecipeNote('・ご飯を炊く時間は調理時間に含んでいない。炒め始めるまでに2杯分を用意しておくこと。'),
    'other',
  )
  eq(
    'FX-NOTE ふつうの保存の行は保存のまま',
    classifyRecipeNote('・冷蔵で2〜3日を目安に食べ切ること。'),
    'keep',
  )

  // ---- (2) フレンチトーストの実データ。浸す手順に出て、最後の手順には出ない ----
  const frenchToast = starterDefs.find((d) => d.title === 'フレンチトースト')
  eq('FX-NOTE フレンチトーストが同梱カタログにある', frenchToast != null, true)
  const ftNotes = assignRecipeNotes(noteSteps(21, frenchToast), new Map([[21, frenchToast]]))
  const ftSoakIndex = frenchToast.steps.findIndex((s) => s.text.includes('卵液に浸し'))
  eq('FX-NOTE 卵液に浸す手順は3番目', ftSoakIndex, 2)
  eq('FX-NOTE 浸している手順に出る', notesAt(ftNotes, 21, ftSoakIndex).includes(FT_DURING), true)
  eq(
    'FX-NOTE 完成の手順には出ない(以前はここに出ていた)',
    notesAt(ftNotes, 21, frenchToast.steps.length - 1).includes(FT_DURING),
    false,
  )

  // ---- (3) 全数の掃引。169行のうち寄せ先が動いたのはこの1行だけ ----
  let movedLines = 0
  for (const def of starterDefs) {
    const lines = splitRecipeNoteLines(def.memo)
    if (lines.length === 0) continue
    const map = assignRecipeNotes(noteSteps(22, def), new Map([[22, def]]))
    for (const line of lines) {
      if (classifyRecipeNote(line) !== 'during') continue
      movedLines++
      // during と判定された行は、その動作が書かれた手順に出る（見つからなければ最初の手順）
      eq(
        `FX-NOTE during の行が浸す手順に出る(${def.title})`,
        notesAt(map, 22, ftSoakIndex).includes(line),
        true,
      )
    }
  }
  eq('FX-NOTE 同梱109品で during と読む行は1行だけ', movedLines, 1)
}

// ---------- 便FT: 段取りと途中の位置を、アプリを開き直しても残す
// (2026-08-12 利用者テスト「アプリを開き直すと、段取りも途中の位置も消える。
//  タイマーの残り時間は開き直しても続いているのに、段取りだけ消えるのはちぐはぐ」)
//
// この機能でいちばん怖いのは「消えること」ではなく**間違ったものが残ること**なので、
// 残す実装より先に**捨てる条件**をここで固定する。
//   ①覚え書きの形の版が違う ②覚えた日が今日でない ③日付・版が読めない ④形が壊れている
//   ⑤選んだ品が1品も無い ⑥段取りを出していないのに位置だけある
// さらに、読み戻した選択は今日の献立と突き合わせ(resolveCookNaviSelection)、
// 読み戻した位置は組み直した段取りに無ければ捨てる(resolveCursor)＝どちらも迂回しない。
// ----------
{
  const ftToday = '2026-08-12'
  const ftCursor = { recipeId: 20, stepIndex: 1 }
  const ftSession = {
    selectedIds: [10, 20, 30],
    showTimeline: true,
    trialActive: false,
    current: ftCursor,
  }
  const ftSaved = (session = ftSession, date = ftToday) =>
    serializeCookNaviSession(session, date)

  // --- 残す側 ---
  eq(
    'FT-KEEP-01 同じ日に覚えた段取りの元と調理中の位置は、そのまま読み戻せる',
    restoreCookNaviSession(ftSaved(), ftToday),
    { kind: 'ok', session: { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: ftCursor } },
  )
  eq(
    'FT-KEEP-02 保存には覚え書きの版と、覚えた日が入る（この2つで捨てる判断をする）',
    (() => {
      const saved = JSON.parse(ftSaved())
      return [saved.v, saved.date]
    })(),
    [COOK_NAVI_SESSION_VERSION, ftToday],
  )
  eq(
    'FT-KEEP-03 色で引き寄せた指示も、同じ日なら残る（並びだけ元に戻らない）',
    restoreCookNaviSession(
      ftSaved({ ...ftSession, pulls: [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }] }),
      ftToday,
    ).session.pulls,
    [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }],
  )
  eq(
    'FT-KEEP-04 お試しで使っている最中かどうかも残る（開き直すたびに1回失わない）',
    restoreCookNaviSession(ftSaved({ ...ftSession, trialActive: true }), ftToday).session.trialActive,
    true,
  )

  // --- 捨てる側 ---
  const ftExpired = restoreCookNaviSession(ftSaved(ftSession, '2026-08-11'), ftToday)
  eq('FT-DROP-01 覚えた日が今日でなければ捨てる（昨日の段取りが今日出てこない）', ftExpired.kind, 'expired')
  eq('FT-DROP-01 捨てた理由は「日付が変わった」', ftExpired.reason, 'date')
  eq('FT-DROP-01 捨てたときは中身を一切返さない（部分的に残さない）', ftExpired.session, undefined)
  eq(
    'FT-DROP-02 捨てたときも「段取りを出していたか」は返す（黙って消さないための知らせに使う）',
    [ftExpired.hadTimeline, ftExpired.hadCursor],
    [true, true],
  )
  eq(
    'FT-DROP-03 段取りを出していなかった覚え書きは、捨てても知らせない（失うものが無い）',
    (() => {
      const r = restoreCookNaviSession(
        ftSaved({ selectedIds: [10, 20], showTimeline: false, trialActive: false }, '2026-08-11'),
        ftToday,
      )
      return [r.kind, r.hadTimeline, r.hadCursor]
    })(),
    ['expired', false, false],
  )
  eq(
    'FT-DROP-04 覚え書きの形の版が違えば捨てる（古い形の位置を今の段取りに当てない）',
    (() => {
      const r = restoreCookNaviSession(
        JSON.stringify({ ...JSON.parse(ftSaved()), v: COOK_NAVI_SESSION_VERSION + 1 }),
        ftToday,
      )
      return [r.kind, r.reason]
    })(),
    ['expired', 'version'],
  )
  eq(
    'FT-DROP-05 版が入っていない保存は、うちの覚え書きではない扱いで捨てる',
    restoreCookNaviSession(JSON.stringify({ selectedIds: [10, 20], showTimeline: true, date: ftToday }), ftToday).kind,
    'none',
  )
  eq(
    'FT-DROP-06 日付が入っていない保存は捨てる（いつのものか確かめられない）',
    restoreCookNaviSession(
      JSON.stringify({ v: COOK_NAVI_SESSION_VERSION, selectedIds: [10, 20], showTimeline: true }),
      ftToday,
    ).kind,
    'none',
  )
  eq('FT-DROP-07 何も覚えていない・壊れた保存は捨てる', [
    restoreCookNaviSession(null, ftToday).kind,
    restoreCookNaviSession('{こわれ', ftToday).kind,
  ], ['none', 'none'])
  eq(
    'FT-DROP-08 時計が先に進んだ（明日の日付の）覚え書きも、今日と違えば捨てる',
    restoreCookNaviSession(ftSaved(ftSession, '2026-08-13'), ftToday).kind,
    'expired',
  )
  eq(
    'FT-DROP-09 選んだ品が1品も無い覚え書きは残さない',
    restoreCookNaviSession(ftSaved({ selectedIds: [], showTimeline: true, trialActive: false }), ftToday).kind,
    'none',
  )
  eq(
    'FT-DROP-10 段取りを出していないのに位置だけある不整合は、位置と引き寄せを捨てる',
    (() => {
      const r = restoreCookNaviSession(
        ftSaved({
          selectedIds: [10, 20],
          showTimeline: false,
          trialActive: false,
          current: ftCursor,
          pulls: [{ before: ftCursor, target: { recipeId: 30, stepIndex: 0 } }],
        }),
        ftToday,
      )
      return [r.kind, r.session.current, r.session.pulls]
    })(),
    ['ok', undefined, undefined],
  )

  // --- 読み戻したあと（既存の整合を迂回しない） ---
  eq(
    'FT-MIX-01 読み戻した選択は、そのまま使わず今日の献立と突き合わせる',
    resolveCookNaviSelection(
      restoreCookNaviSession(ftSaved(), ftToday).session.selectedIds,
      [20, 30],
      false,
    ),
    [20, 30],
  )
  eq(
    'FT-MIX-02 読み戻した選択が今日の献立に1品も無ければ、今日の献立から選び直す',
    resolveCookNaviSelection(
      restoreCookNaviSession(ftSaved(), ftToday).session.selectedIds,
      [40, 50, 60, 70],
      false,
    ),
    [40, 50, 60],
  )
  eq(
    'FT-MIX-03 読み戻した位置が組み直した段取りに無ければ、推測せず捨てる（一覧に戻す）',
    resolveCursor(
      [
        { recipeId: 10, stepIndex: 0 },
        { recipeId: 30, stepIndex: 0 },
      ],
      restoreCookNaviSession(ftSaved(), ftToday).session.current,
    ),
    undefined,
  )
  eq(
    'FT-MIX-04 読み戻した位置が段取りにあれば、その手順のまま続く',
    resolveCursor(
      [
        { recipeId: 10, stepIndex: 0 },
        { recipeId: 20, stepIndex: 1 },
        { recipeId: 30, stepIndex: 0 },
      ],
      restoreCookNaviSession(ftSaved(), ftToday).session.current,
    ),
    ftCursor,
  )
}

// ---------- GF-C 品ごとのできあがりの目安と、その開きを画面に出す ----------
// 2026-08-14 便GF・利用者テスト（原文）:
//   「アプリは合計だけ出して、各品が何分後にできるかは表示しません。開きは最大16分。
//     みそ汁ができてから主菜が焼き上がるまで12分放置になります。平日の夕食は3品同時に
//     出したいので、この開きが出ること自体を画面に出してほしい（今は自分で足し算しないと
//     分からない）」
// 数え方は docs/72 の N1（完成の揃い）と同じにそろえる＝**その品の最後の工程が終わる時刻**、
// 開きは**冷たくして出す品を除いた**最大−最小、線は全体の目安の30%。
{
  const { recipeFinishTimes, finishSpread } = await import('../../src/logic/cookFinish.ts')
  const trio = [
    {
      id: 1,
      title: 'GC鶏のグリル焼き',
      steps: [{ text: '鶏むね肉をそぎ切りにする' }, { text: '魚焼きグリルで15分焼く' }, { text: 'パセリをふる' }],
    },
    {
      id: 2,
      title: 'GCみそ汁',
      dishType: 'soup',
      steps: [{ text: '鍋に水とだしの素を入れて中火にかける' }, { text: '豆腐を切る' }, { text: 'みそを溶いて火を止める' }],
    },
    {
      id: 3,
      title: 'GCポテトサラダ',
      steps: [{ text: 'じゃがいもを切る' }, { text: '電子レンジで6分加熱する' }, { text: '冷蔵庫で冷やしてから和える' }],
    },
  ]
  const plan = buildCookPlan(trio)
  const finishes = recipeFinishTimes(plan.items, plan.recipes, (id) => trio.find((r) => r.id === id))
  // 監査（scripts/audit-cook-navi.mjs の finishTimes）と同じ数え方であること。
  // 実装を写すのではなく、段取りの endMin から**独立に**数え直して突き合わせる
  const expected = plan.recipes.map((r) => ({
    recipeId: r.id,
    minutes: plan.items
      .filter((it) => it.recipeId === r.id)
      .reduce((max, it) => Math.max(max, it.endMin), 0),
  }))
  eq(
    'GF-C 品ごとの完成時刻は「その品の最後の工程が終わる時刻」（docs/72 N1と同じ数え方）',
    finishes.map((f) => ({ recipeId: f.recipeId, minutes: f.minutes })),
    expected,
  )
  eq('GF-C 3品ぶんの目安が出る（1品も欠けない）', finishes.length, 3)
  eq(
    'GF-C 冷やしてから出す品は「冷たい品」と読む（開きの計算から外すため）',
    finishes.map((f) => f.cold),
    [false, false, true],
  )
  const gap = finishSpread(finishes)
  // 2026-08-14 便GK: 画面に出す開きは**全部の品**で数える（冷たい品を黙って外すと
  // 「4分は言うのに17分は何も言わない」になる）。段取りを測る N1 の定義は変えていない
  const all = finishes.map((f) => f.minutes)
  eq(
    'GF-C 開きは全部の品の最大−最小（先にできる品が冷たい品かどうかは文言で書き分ける）',
    gap.minutes,
    Math.max(...all) - Math.min(...all),
  )
  eq(
    'GF-C どの2品の開きなのかも返す（画面では品名で書く）',
    [gap.first.recipeId !== gap.last.recipeId, gap.first.minutes <= gap.last.minutes],
    [true, true],
  )
}
{
  const { recipeFinishTimes, finishSpread, isFinishSpreadWide } = await import(
    '../../src/logic/cookFinish.ts'
  )
  // 温かい品が1つしかないときは開きを言わない（比べる相手がいない）
  const two = [
    { id: 1, title: 'GC煮物', steps: [{ text: '材料を切る' }, { text: '鍋で20分煮る' }, { text: '盛る' }] },
    { id: 2, title: 'GC冷やしサラダ', steps: [{ text: '野菜を切る' }, { text: '冷蔵庫で冷やしてから和える' }] },
  ]
  const plan = buildCookPlan(two)
  const finishes = recipeFinishTimes(plan.items, plan.recipes, (id) => two.find((r) => r.id === id))
  // 2026-08-14 便GK: 冷たい品も開きの対象にする（先にできる理由は文言側で書き分ける）
  eq(
    'GF-C 冷たい品しか相手がいなくても開きは出す（黙って飛ばさない）',
    finishSpread(finishes).minutes > 0,
    true,
  )
  eq(
    'GF-C 先にできる品が冷たい品かどうかを返す',
    finishSpread(finishes).first.cold,
    true,
  )
  eq('GF-C 品が1つしかなければ開きは0（言わない）', finishSpread([finishes[0]]).minutes, 0)
  // 線は docs/72 N1 と同じ＝全体の30%を「超えた」ら大きいとみなす（ちょうど30%は大きくない）
  eq('GF-C 開きの線は全体の30%（ちょうどは大きくない）', isFinishSpreadWide(30, 100), false)
  eq('GF-C 30%を超えたら大きい', isFinishSpreadWide(31, 100), true)
  eq('GF-C 全体が0分なら大きいと言わない', isFinishSpreadWide(5, 0), false)
  // 利用者の実測（開き16分／12分放置）に相当する形は「大きい」と読む
  eq('GF-C 利用者の実測（44分中16分の開き）は大きいと読む', isFinishSpreadWide(16, 44), true)
}
{
  // 2026-08-25 便KT・オーナー原文:
  //   「「出来上がりの目安」削除。全体の調理時間が分かれば十分。細かく出したところで、
  //     個人の手のスピードや状況によってすぐに変わるので、ここまで細かく表示しても
  //     あまり意味がない。」
  // 便GF/GK が画面に出していた文言（finishTitle ほか）は**節ごと**消した。
  // ここは「文言が正しく差し込めるか」から「消した節が戻っていないか」の見張りに書き換える
  //（黙ってテストを消すと、次の便が同じ節を足し直しても誰も気づかない）。
  // 上の GF-C の純ロジック（logic/cookFinish.ts）はそのまま残す
  //  ＝docs/72 N1（完成の揃い）は段取りの質を測る物差しとして使い続ける
  const ktFinishKeys = ['finishTitle', 'finishItem', 'finishSpread', 'finishSpreadWide', 'finishSpreadCold']
  eq(
    'KT-5 「できあがりの目安」の文言が ja.ts に残っていない（2026-08-25 オーナー指示で削除）',
    ktFinishKeys.filter((k) => k in ja.cookNavi),
    [],
  )
  const ktNaviPageSrc = readFileSync(
    path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/pages/CookNaviPage.tsx'),
    'utf-8',
  )
  eq(
    'KT-5 画面（並行調理ナビ）からも品ごとの目安の枠が消えている',
    /navi-finish-times|navi-finish-minutes/.test(ktNaviPageSrc),
    false,
  )
}

// ==========================================================================================
// 便GK: 段取りの数字が信用できない件（2026-08-14 実操作テスト3回目）
// 利用者の原文は docs/71 に追記。ここは再発防止のケースだけを置く。
// ==========================================================================================

// ---------- GK-1: 分数欄が埋まっていても、混在手順を割る ----------
// 原文:「手順1の本文は『皮を取り、フォークで刺し、そぎ切りにする。塩こしょうと酒をふって10分ほどおく』…
//        それを手順まるごと『待ち』にして…押した瞬間から10:00がカウントダウンを始める。
//        でも私はまだ肉に触ってもいない」
// 真因: 2026-08-08 便ED の打ち手#2（取り込んだ手順の本文に書かれた時間を分数欄へ転記）以降、
//       URL取り込み・貼り付けで登録したレシピの分数欄は**埋まる**ようになった。
//       splitMixedStep は「分数欄が埋まっている手順は分けない」で外していたため、
//       R3の症状を直したはずの便GDが、実際の登録経路では1件も効いていなかった。
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  const chicken = t(
    '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
    10,
  )
  eq(
    'GK-1 分数欄が埋まっていても「◯分おく」型の混在は割る（待ちの側に同じ分数が書かれている）',
    (() => {
      const s = splitMixedStep(chicken)
      return s && [s.active.text, s.wait.text, s.wait.minutes, s.active.minutes]
    })(),
    [
      '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。',
      '塩こしょうと酒をふって10分ほどおく。',
      10,
      undefined,
    ],
  )
  const soup = t('沸いたら豆腐をさいの目に切って入れ、乾燥わかめも加えて1〜2分煮る。', 2)
  eq(
    'GK-1 「◯分煮る」型（豆腐を切る手作業が入っている）も割る',
    (() => {
      const s = splitMixedStep(soup)
      return s && [s.active.text, s.wait.text, s.wait.minutes]
    })(),
    // 切る位置はできるだけ後ろ（＝手を動かす部分をできるだけ残す）ので、
    // 豆腐を切るのもわかめを加えるのも手作業の側に残る
    ['沸いたら豆腐をさいの目に切って入れ、乾燥わかめも加えて', '1〜2分煮る。', 2],
  )
  // 迷ったら割らない側（S1を増やさない）: 分数欄の数字が本文の待ちの側に書かれていない手順は割らない
  eq(
    'GK-1 分数欄の数字が本文に書かれていない手順は今までどおり割らない',
    splitMixedStep(t('水を入れて煮る', 10)),
    undefined,
  )
  eq(
    'GK-1 手作業の側にだけ時間が書かれている手順は割らない',
    splitMixedStep(t('玉ねぎを10分炒めてから煮る', 10)),
    undefined,
  )
  {
    // アプリと同じ登録経路（貼り付け取り込み → 本文の時間を分数欄へ転記）を通しても割れること
    const raw = '鶏むね肉は皮を取り、フォークで数か所刺してからそぎ切りにする。塩こしょうと酒をふって10分ほどおく。'
    const step = { text: raw, minutes: stepMinutesFromText(raw) }
    eq('GK-1 取り込み経路では分数欄が埋まる（前提の確認）', step.minutes, 10)
    const plan = buildCookTimeline([{ id: 1, title: 'GK主菜', steps: [step] }])
    eq('GK-1 取り込んだレシピでも手を動かす時間が0分でなくなる', plan.items[0].activeMinutes > 0, true)
    eq('GK-1 待ちの分数は変わらない', plan.items[1].waitMinutes, 10)
    eq(
      'GK-1 タイマーは待ちの工程だけに出る（手作業の前には押せない）',
      [showsWaitTimerButton(plan.items[0]), showsWaitTimerButton(plan.items[1])],
      [false, true],
    )
    eq('GK-1 待ちは手作業が終わってから始まる', plan.items[1].startMin, plan.items[0].endMin)
    eq(
      'GK-1 番号は「1-1」「1-2」',
      [recipeStepLabel(plan.items[0]), recipeStepLabel(plan.items[1])],
      ['1-1', '1-2'],
    )
  }
}

// ---------- GK-2: 分数の書かれていない手作業の見積り ----------
// 原文:「『焼けたら乾燥パセリをふる』に4分。パセリをふるのに4分は取りません。10秒です。
//        逆に『ホイル敷いて肉を並べてみそマヨを塗ってチーズをのせる』が2分。…見積りが逆になっている」
{
  const t = (text) => ({ text })
  const one = estimateActiveMinutes(t('焼けたら乾燥パセリをふる。')).minutes
  const many = estimateActiveMinutes(
    t('アルミホイルを敷いて鶏を並べ、みそマヨを塗ってチーズをのせる。'),
  ).minutes
  eq('GK-2 「ふる」の一手は一律4分にしない', one <= 2, true)
  eq('GK-2 複数動作の組み立ては、一手より長く見る（見積りの逆転を起こさない）', many > one, true)
  eq('GK-2 「塩をふる」も一手として読む', estimateActiveMinutes(t('塩をふる。')).minutes <= 3, true)
  eq('GK-2 「器に盛って散らす」は仕上げのまま短い', estimateActiveMinutes(t('器に盛る。')).minutes, 2)
  // 手順の中でいちばん重い動作で見る（最後に出てきた語だけで決めない）
  eq(
    'GK-2 「炒めて器に盛る」は炒めの重さで見る（最後の「盛る」だけで2分にしない）',
    estimateActiveMinutes(t('ひき肉を炒めて器に盛る。')).minutes >= 5,
    true,
  )
  // やりすぎない側の歯止め（既存の見積りを壊さない）
  eq('GK-2 切る工程は3分のまま', estimateActiveMinutes(t('玉ねぎをみじん切りにする')).minutes, 3)
  eq('GK-2 炒める工程は5分のまま', estimateActiveMinutes(t('ひき肉を炒める')).minutes, 5)
  eq(
    'GK-2 「鍋に水を入れて火にかける」は準備動作で2分のまま',
    estimateActiveMinutes(t('鍋に水とだしの素を入れて火にかける。')).minutes,
    2,
  )
}

// ---------- GK-3: 範囲で書かれた時間のタイマーは短いほうで立てる ----------
// 原文:「本文は『12〜15分焼く』。ボタンのラベルは『12〜15分 タイマー開始』なのに、表示と実際の待ちは約15分。
//        チーズがのっているものを最初から15分放置に設定するのは危ない。12分で一度見るほうが正しい」
{
  const { findTimeTokens } = await import('../../src/logic/time.ts')
  const secs = (text) => findTimeTokens(text).map((x) => x.seconds)
  const maxSecs = (text) => findTimeTokens(text).map((x) => x.maxSeconds)
  eq('GK-3 タイマーにする長さは範囲の短いほう', [secs('12〜15分焼く。'), secs('1〜2分煮る。')], [[720], [60]])
  eq('GK-3 段取りの見積りに使う長さは範囲の長いほうのまま', maxSecs('12〜15分焼く。'), [900])
  eq('GK-3 単位が2回書かれる形でも短いほうで立てる', secs('12分〜15分煮る。'), [720])
  eq('GK-3 範囲でない時間は今までどおり', [secs('中火で15分煮る。'), maxSecs('中火で15分煮る。')], [[900], [900]])
  eq(
    'GK-3 段取りの待ち分数は上限のまま（先に短く見積もって詰め込まない）',
    resolveWaitMinutes({ text: '魚焼きグリルで12〜15分焼く。' }),
    15,
  )
  eq(
    'GK-3 待ちブロックのタイマーも短いほうで始める',
    waitTimerSeconds({ text: '魚焼きグリルで12〜15分焼く。', waitMinutes: 15, longRest: false }),
    720,
  )
  eq(
    'GK-3 範囲で書かれていない待ちは、その待ち分数どおりに始める',
    waitTimerSeconds({ text: '弱火で20分煮る。', waitMinutes: 20, longRest: false }),
    1200,
  )
  eq(
    'GK-3 分数を本文に持たない待ち（調理法から当てた分数）もその分数で始める',
    waitTimerSeconds({ text: '魚焼きグリルで焼く。', waitMinutes: 15, longRest: false }),
    900,
  )
  eq('GK-3 取り込みの分数欄には長いほうを写す（本文に書いてある事実の転記）', stepMinutesFromText('12〜15分焼く。'), 15)
}

// ---------- GK-4: 「1品だけなら約◯分」が手順の合計と合わない ----------
// 原文:「鶏の手順は 10＋3＋2＋15＋4＝34分。なのに『1品だけなら約31分』。
//        ごま和えは12分、みそ汁は13分でどちらもぴったり合うのに鶏だけ3分合わない」
// 真因: 利用者が本文に書いた「その間に」の手順と、ナビが差し込んだ「沸くのを待つ」の直後の手順は、
//       その品の待ちの**中**に置かれる（2026-08-13 便GB/GD）。品の所要時間には二重に足されないので、
//       画面の手順の分数を足した数より短くなる。画面がその重なりを何も言っていなかった。
{
  const chicken = {
    id: 1,
    title: 'GK鶏のみそマヨ焼き',
    steps: [
      {
        text: '鶏むね肉は皮を取り、そぎ切りにする。塩こしょうと酒をふって10分ほどおく。',
        minutes: 10,
      },
      { text: 'その間に☆を全部混ぜ合わせておく。' },
      { text: '魚焼きグリルで15分焼く。', minutes: 15 },
      { text: '焼けたら乾燥パセリをふる。' },
    ],
  }
  const side = {
    id: 2,
    title: 'GKごま和え',
    steps: [
      { text: 'ほうれん草を3〜4cmの長さに切る。' },
      { text: '電子レンジで3分加熱する。', minutes: 3 },
      { text: '水気をしぼって和える。' },
    ],
  }
  const plan = buildCookPlan([chicken, side])
  for (const r of plan.recipes) {
    eq(`GK-4 品ごとに手順の分数の合計を持つ（${r.title}）`, typeof r.stepSumMinutes === 'number', true)
    eq(
      `GK-4 手順の合計は「1品だけなら」の目安を下回らない（${r.title}）`,
      r.stepSumMinutes >= r.soloMinutes,
      true,
    )
  }
  const gap = plan.recipes.find((r) => r.id === 1)
  eq(
    'GK-4 「その間に」を書いた品は、手順の合計と1品だけの目安が食い違う（重なりぶん）',
    gap.stepSumMinutes - gap.soloMinutes > 0,
    true,
  )
  const even = plan.recipes.find((r) => r.id === 2)
  eq('GK-4 重なりの無い品はぴったり合う', even.stepSumMinutes, even.soloMinutes)
  eq(
    'GK-4 食い違う理由を画面に置く一文がある（手順の分数を足した数との関係を書く）',
    typeof ja.cookNavi.legendOverlapNote === 'string' && ja.cookNavi.legendOverlapNote.length > 0,
    true,
  )
}

// ---------- GK-5: 「台所を離れられる待ち時間」が言い過ぎ ----------
// 原文:「数えたら、手が空くのは（レンジ3分待ち）＋（沸くのを待つ5分）＋（煮る2分）＝10分でした。
//        でもこのうち7分は鍋の前です。吹きこぼれるので離れられない。『台所を離れられる』は言い過ぎ。
//        しかも例に出ている『漬ける・冷やす』はこの段取りに1つもない」
{
  eq('GK-5 「台所を離れられる」とは言わない', ja.cookNavi.totalAwayNote.includes('台所を離れられる'), false)
  eq(
    'GK-5 段取りに出てこないかもしれない調理法を例に出さない',
    ja.cookNavi.totalAwayNote.includes('漬ける') || ja.cookNavi.totalAwayNote.includes('冷やす'),
    false,
  )
  eq('GK-5 分数の差し込み口は残す', ja.cookNavi.totalAwayNote.includes('{n}'), true)
  // 火にかけている待ちは数えない（実装側の確認。文言だけ直して中身が違う、を防ぐ）
  {
    const plan = buildCookPlan([
      {
        id: 1,
        title: 'GK煮物',
        steps: [{ text: '材料を切る。' }, { text: '鍋に入れて弱火で20分煮る。', minutes: 20 }, { text: '器に盛る。' }],
      },
      {
        id: 2,
        title: 'GK漬け物',
        steps: [{ text: 'きゅうりを切る。' }, { text: '調味料と合わせて30分漬ける。', minutes: 30 }, { text: '器に盛る。' }],
      },
    ])
    eq('GK-5 火にかけている20分は「そばを離れてよい待ち」に数えない', plan.awayMinutes, 30)
  }
}

// ---------- GK-6: 完成の開きの警告が出る条件 ----------
// 原文:「ごま和えを17分後に和えて、鶏ができるのは34分後。17分放置。なのにアプリが警告するのは
//        『みそ汁ができてから鶏ができるまで約4分あきます』だけ。4分は言うのに17分は何も言わない。
//        判定基準がわからない」
{
  const { finishSpread } = await import('../../src/logic/cookFinish.ts')
  const finishes = [
    { recipeId: 1, minutes: 34, cold: false }, // 主菜
    { recipeId: 2, minutes: 30, cold: false }, // みそ汁
    { recipeId: 3, minutes: 17, cold: true }, // ごま和え（冷たい品と判定される）
  ]
  const gap = finishSpread(finishes)
  eq('GK-6 開きは全部の品で見る（冷たい品を黙って外さない）', gap.minutes, 34 - 17)
  eq('GK-6 いちばん早い品といちばん遅い品を返す', [gap.first.recipeId, gap.last.recipeId], [3, 1])
  eq('GK-6 先にできる品が冷たい品かどうかを返す（画面で理由を書き分けるため）', gap.first.cold, true)
  eq(
    'GK-6 温かい品どうしだけのときは今までどおり',
    finishSpread([
      { recipeId: 1, minutes: 34, cold: false },
      { recipeId: 2, minutes: 30, cold: false },
    ]).minutes,
    4,
  )
  eq('GK-6 1品だけなら開きは言わない', finishSpread([{ recipeId: 1, minutes: 20, cold: false }]).minutes, 0)
  // 開きの**分数**を画面に出す文言（finishSpread・finishSpreadCold ほか）は 2026-08-25 便KT で
  // 節ごと消した（オーナー原文「……ここまで細かく表示してもあまり意味がない。」）。
  // 「先にできた品が待つことになる」という**警告だけ**は分数抜きで残してある（KT-10）。
  // 開きを数える純ロジックは上のとおり残してある＝段取りの質はこの物差しで測り続ける
}

// ---------- 便KM: 並行調理ナビの上段と並べ替え（2026-08-25 オーナー書き溜め）----------
// オーナー原文:
//   「・全体の目安約◯分→全体の調理時間約◯分
//     　下の説明もながい。短く簡潔に。必要ない分は省いて。
//     ・順番の入れ替えをしても元に戻せない。
//     　上へ下へボタンの縦幅低くして。これのせいでページ全体が無駄に長い。
//     ・完成押下後の窓の説明も長い。読みたい人だけ読めるように、折りたたんでしまうか、
//     　さらに別の窓で表示のにしたい。」
{
  const kmDir = path.dirname(fileURLToPath(scriptFileUrl))
  const kmNaviSrc = readFileSync(path.join(kmDir, '../src/pages/CookNaviPage.tsx'), 'utf-8')
  const kmFinishSrc = readFileSync(path.join(kmDir, '../src/components/CookFinishModal.tsx'), 'utf-8')

  // ---- KM-1: 見出しは「全体の調理時間」（何の目安なのかを語で言う）----
  eq('KM-1 全体の分数の見出しが「全体の調理時間」', ja.cookNavi.totalEstimate, '全体の調理時間 約{n}分')
  eq('KM-1 旧い「全体の目安」の言い方が残っていない', ja.cookNavi.totalEstimate.includes('全体の目安'), false)
  // 画面の呼び名は1つに保つ（CLAUDE.md「画面の呼び名は、見出しに実際に出ている名前を正とする」）。
  // 見出しだけ変えて、その数字を指す他の文が古い呼び名のままだと、同じものが2つの名前で出る
  eq(
    'KM-1 その数字を指す他の文も同じ呼び名になっている',
    Object.entries(ja.cookNavi)
      .filter(([, v]) => typeof v === 'string' && v.includes('全体の目安'))
      .map(([k]) => k),
    [],
  )

  // ---- KM-2: その数字の下に**必ず**出る説明を短くする（同じことを2回言わない・自明を書かない）----
  // 「約◯分」と書いてある数字に「実際の火加減で前後します」を足すのは同じことの2回目。
  // 数え方の説明も、すぐ上に品ごとの「1品だけなら約◯分」が並んでいるので前半は自明。
  // 2026-08-25 便KT: この枠から2行が消えた（下の KT-3）ので、上限も実態に合わせて下げる。
  // 上限そのものの役目は変わらない＝「必ず出る説明が、また育っていないか」を見る
  const KM_ALWAYS_LIMIT = 60
  const kmAlways = [ja.cookNavi.orderNote]
  const kmAlwaysLen = kmAlways.reduce((sum, t) => sum + (t ?? '').length, 0)
  eq(
    `KM-2 全体の分数の下に必ず出る説明の合計が${KM_ALWAYS_LIMIT}字以内（実際=${kmAlwaysLen}字）`,
    kmAlwaysLen <= KM_ALWAYS_LIMIT,
    true,
  )
  eq('KM-2 「実際の火加減で前後します。」は消した（「約◯分」と同じことを言っている）', ja.cookNavi.totalNote, undefined)
  eq('KM-2 画面からも消えている', kmNaviSrc.includes('totalNote'), false)
  /*
   * ---- KT-3: 全体の分数の下に必ず出ていた2行を消した（2026-08-25 便KT・オーナー原文）----
   *   「「レシピの一覧に出ている〜一致しません」削除。どこのことかわからない上に
   *     違っているのは前提のうちなので不要」          → totalCountNote
   *   「「段取りと進んだところは、〜」削除」            → restoreKeepNote
   * 便KM は totalCountNote の前半だけを削って後半（数え方が違う）を残していたが、
   * オーナーはその後半こそ要らないと言っている。**消えたことを見張る**形に書き換える
   *（黙って検査を消すと、次の便が同じ2行を足し直しても誰も気づかない）。
   * 開き直しても段取りが残る作り（cookNaviSession）は変えていない＝書いておくのをやめただけ
   */
  eq('KT-3 数え方の断り書き（レシピの一覧と一致しない）が ja.ts に残っていない', 'totalCountNote' in ja.cookNavi, false)
  eq('KT-3 画面からも消えている', kmNaviSrc.includes('ja.cookNavi.totalCountNote'), false)
  eq(
    'KM-2 1品ずつのときの説明から、上の枠と重なる一文を消した',
    (ja.cookNavi.sequentialOrderNote ?? '').includes('1品を作り終えてから次の品に移ります'),
    false,
  )
  eq(
    'KM-2 加熱で仕上げる品を最後にしている、という中身は残っている',
    (ja.cookNavi.sequentialOrderNote ?? '').includes('加熱で仕上げる品'),
    true,
  )
  eq('KT-3 「段取りと進んだところは〜」が ja.ts に残っていない', 'restoreKeepNote' in ja.cookNavi, false)
  eq('KT-3 画面からも消えている', kmNaviSrc.includes('ja.cookNavi.restoreKeepNote'), false)
  // 日付をまたいで捨てたときは、その場で理由を言う側が残っていること（黙って消さない・規約F）
  eq(
    'KT-3 日付が変わって捨てたときの知らせは残っている（消したのは常に出る説明だけ）',
    [
      (ja.cookNavi.restoreExpiredByDate ?? '').includes('残していません'),
      (ja.cookNavi.restoreExpiredByDateCooking ?? '').includes('残していません'),
    ],
    [true, true],
  )

  // ---- KM-3: 並べ替えを、押したその場で1回で戻せる（他の操作と同じトーストの「元に戻す」）----
  // オーナー原文「順番の入れ替えをしても元に戻せない。」
  // 便GJ/GLの「1つ前の並びに戻す」は**一覧のいちばん上の欄**にしかなく、下のほうの手順を
  // 動かすと画面の外にある＝押しに行けない。トーストは画面の下に出るので、どこを動かしても届く
  eq(
    'KM-3 並べ替えたことをその場で知らせる文がある',
    typeof ja.cookNavi.reorderMovedToast === 'string' &&
      ja.cookNavi.reorderMovedToast.includes('{n}') &&
      ja.cookNavi.reorderMovedToast.includes('{dir}'),
    true,
  )
  eq('KM-3 知らせは1行に収まる長さ（40字以内）', (ja.cookNavi.reorderMovedToast ?? '').length <= 40, true)
  eq('KM-3 上へ・下へを押したらその知らせを出している', kmNaviSrc.includes('reorderMovedToast'), true)
  eq(
    'KM-3 その知らせの「元に戻す」は、他の操作と同じ ja.common.undo を使う',
    /actionLabel=\{toastUndo \? ja\.common\.undo : undefined\}/.test(kmNaviSrc),
    true,
  )
  eq(
    'KM-3 「元に戻す」の中身は、記録の取り消しと並べ替えの取り消しの両方が乗る',
    /const toastUndo = undoCooked[\s\S]{0,200}undoPull/.test(kmNaviSrc),
    true,
  )
  eq(
    'KM-3 「元に戻す」を押すと、直前の1回ぶんだけ戻る（全部は捨てない）',
    kmNaviSrc.includes('const undoLastPull = () => setPulls((prev) => prev.slice(0, -1))'),
    true,
  )

  // ---- KM-4: 上へ・下へのボタンは、見た目を低くしても押せる大きさ（44px）を保つ ----
  // オーナー原文「上へ下へボタンの縦幅低くして。これのせいでページ全体が無駄に長い。」
  const kmUpBtn = kmNaviSrc.slice(
    kmNaviSrc.indexOf('data-testid="navi-step-up"'),
    kmNaviSrc.indexOf('data-testid="navi-step-down"'),
  )
  const kmDownBtn = kmNaviSrc.slice(
    kmNaviSrc.indexOf('data-testid="navi-step-down"'),
    kmNaviSrc.indexOf('data-testid="navi-active-minutes"'),
  )
  eq('KM-4 前提: 上へ・下へのボタンを読めている', [kmUpBtn.length > 0, kmDownBtn.length > 0], [true, true])
  eq(
    'KM-4 当たり判定は .tap-target で44pxを保つ',
    [kmUpBtn.includes('tap-target'), kmDownBtn.includes('tap-target')],
    [true, true],
  )
  eq(
    'KM-4 見た目の上下の余白は py-3（46px）より低い',
    [/\bpy-3\b/.test(kmUpBtn), /\bpy-3\b/.test(kmDownBtn)],
    [false, false],
  )

  // ---- KM-5: 「完成！」の窓の説明は、読みたい人だけ開く（折りたたみ）----
  // オーナー原文「完成押下後の窓の説明も長い。読みたい人だけ読めるように、折りたたんでしまうか、
  // さらに別の窓で表示のにしたい。」
  eq(
    'KM-5 折りたたみを開く・閉じる文言がある',
    [
      typeof ja.cookNavi.sessionFinishDetailOpen === 'string' && ja.cookNavi.sessionFinishDetailOpen.length > 0,
      typeof ja.cookNavi.sessionFinishDetailClose === 'string' && ja.cookNavi.sessionFinishDetailClose.length > 0,
    ],
    [true, true],
  )
  eq('KM-5 窓はアプリ共通の折りたたみ（Collapse）を使う', kmFinishSrc.includes("from './Collapse'"), true)
  eq(
    'KM-5 何品に記録が付くかは畳まずに出す（畳むのは、消えるもの・残るものの説明だけ）',
    kmFinishSrc.includes('detail') && kmFinishSrc.includes('body'),
    true,
  )
}

// ==========================================================================================
// KO-1〜KO-6（2026-08-25 便KO）: 取り込んだレシピに「献立の絞り込みに要る項目」が入らない件
//
// 影響範囲テストの取り込み実データ90品の実測: ジャンル0件・季節0件・時間帯0件・
// 手間レベルは全品が既定値の「普通」のまま。その結果「和食だけ」で絞ると自分の品が全部消え、
// 「20分以内」で絞ると候補が枯れる。
//
// オーナーの裁定（3件・すべて推奨通り）:
//   ①タグを付ける道を作る（取り込み直後に1タップ）。絞り込みの挙動はいまのまま
//   ②自動で入らない項目の説明を、取り込みが終わった直後に。初回のみ・「今後表示しない」で消せる
//   ④1品に複数料理が入った品は、取り込みのときに知らせるだけ（機械で分けない）
//
//   KO-1 入らなかった項目だけを数える（入ったものを出さない）
//   KO-2 ジャンルはタグ1つで持ち、押し直すと外れる
//   KO-3 取り込みの結果に、入らなかった項目の並びと説明が出る（登録画面）
//   KO-4 説明は初回のみ・「今後表示しない」で消せて、設定から戻せる
//   KO-5 1品に複数料理が入った品を見分ける（同梱109品で誤検出0）
//   KO-6 足した文言が長文の規約（続けて読ませる本文160字まで）に収まっている
// ==========================================================================================
{
  const koRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const koFormSrc = readFileSync(path.join(koRoot, 'src/pages/RecipeFormPage.tsx'), 'utf-8')
  const koSettingsSrc = readFileSync(path.join(koRoot, 'src/pages/SettingsPage.tsx'), 'utf-8')

  // ---- KO-1: 入らなかった項目だけを数える ----
  const koEmpty = {
    tags: [],
    season: undefined,
    suitableFor: [],
    dishType: undefined,
    effortLevel: 'normal',
    // 2026-08-26 便LG: 印から作れる組の数（0＝印が無い／すでに組が付いている）
    seasoningGroupsFromMarks: 0,
  }
  eq('KO-1 取り込んだ直後（何も入っていない）は5項目とも足りない', missingImportFields(koEmpty), [
    'genre',
    'season',
    'suitableFor',
    'dishType',
    'effort',
  ])
  eq(
    'KO-1 ジャンルのタグが付いている品では、ジャンルを出さない',
    missingImportFields({ ...koEmpty, tags: ['中華', '作り置き'] }).includes('genre'),
    false,
  )
  eq(
    'KO-1 料理名から種別を当てられた品では、種別を出さない',
    missingImportFields({ ...koEmpty, dishType: 'side' }).includes('dishType'),
    false,
  )
  eq(
    'KO-1 手間レベルは既定値の「普通」なら足りない扱い（人が選んでいない）',
    [
      missingImportFields({ ...koEmpty, effortLevel: 'normal' }).includes('effort'),
      missingImportFields({ ...koEmpty, effortLevel: 'easy' }).includes('effort'),
    ],
    [true, false],
  )
  eq(
    'KO-1 全部そろっていれば1つも出さない',
    missingImportFields({
      tags: ['和食'],
      season: 'summer',
      suitableFor: ['dinner'],
      dishType: 'main',
      effortLevel: 'fancy',
    }),
    [],
  )
  // 2026-08-26 便LG・オーナー原文「自動で登録できない項目に計量一緒にできる設定は含みますか」で
  // 合わせ調味料の組（seasoningGroup）を足した。**材料の話なので最後**（献立の絞り込みに使う
  // 5つと混ぜて読ませない）
  eq('KO-1 出す順は画面の並びと同じ', [...IMPORT_FIELD_KEYS], [
    'genre',
    'season',
    'suitableFor',
    'dishType',
    'effort',
    'seasoningGroup',
  ])
  // ---- LG-1: 合わせ調味料の組は「印から実際に作れるとき」だけ並びに出す ----
  //   押しても何も起きないボタンを画面に置かないため（2026-08-26 便LG）
  eq(
    'LG-1 印から組が作れないレシピでは、合わせ調味料の組を出さない',
    missingImportFields({ ...koEmpty, seasoningGroupsFromMarks: 0 }).includes('seasoningGroup'),
    false,
  )
  eq(
    'LG-1 印から組が作れるレシピでは出す',
    missingImportFields({ ...koEmpty, seasoningGroupsFromMarks: 1 }).includes('seasoningGroup'),
    true,
  )

  // ---- KO-2: ジャンルはタグ1つ（絞り込みが読むのと同じ形） ----
  eq('KO-2 ジャンルはタグから読む', recipeGenreTag(['作り置き', '洋食']), '洋食')
  eq('KO-2 ジャンルのタグが無ければ undefined', recipeGenreTag(['作り置き']), undefined)
  eq('KO-2 選ぶと、他のタグを残したままジャンルのタグが1つ付く', tagsWithGenre(['作り置き'], '和食'), ['作り置き', '和食'])
  eq('KO-2 別のジャンルを選ぶと入れ替わる（2つ付かない）', tagsWithGenre(['和食', '作り置き'], '中華'), ['作り置き', '中華'])
  eq('KO-2 同じものを押すと外れる（季節・種別と同じ操作）', tagsWithGenre(['和食', '作り置き'], '和食'), ['作り置き'])

  // ---- KO-3: 取り込みの結果に、入らなかった項目の並びが出る ----
  eq(
    'KO-3 登録画面が「入らなかった項目」を数えている',
    koFormSrc.includes('missingImportFields('),
    true,
  )
  eq(
    'KO-3 取り込みの結果に、1タップで選べる並びを出している',
    koFormSrc.includes('data-testid="import-field-gaps"'),
    true,
  )
  eq(
    'KO-3 選ぶ部品は、登録画面の季節・時間帯・種別と同じもの（新しい形を作らない）',
    [koFormSrc.includes("from '../components/OptionPicker'"), existsSync(path.join(koRoot, 'src/components/OptionPicker.tsx'))],
    [true, true],
  )
  eq(
    'KO-3 取り込みの並びでは、既定の「普通」を選択中の色で塗らない（選んでいないのに選んだ顔にしない）',
    koFormSrc.includes('isPicked={(level) => effortPicked && effortLevel === level}'),
    true,
  )
  eq(
    'KO-3 「くわしく」の季節・時間帯・種別・手間レベルも同じ部品で描いている',
    (koFormSrc.match(/<OptionPicker/g) ?? []).length >= 5,
    true,
  )
  eq(
    'KO-3 見出しの文言が項目の数だけそろっている',
    IMPORT_FIELD_KEYS.map((key) => typeof ja.form.importGapField?.[key] === 'string' && ja.form.importGapField[key].length > 0),
    IMPORT_FIELD_KEYS.map(() => true),
  )

  // ---- KO-4: 説明は初回のみ・消せる・戻せる ----
  eq(
    'KO-4 見た記録は他の案内と重ならない鍵で持つ',
    IMPORT_FIELD_NOTICE_SEEN_KEY,
    'uchirecipe:importFieldNoticeSeen',
  )
  eq(
    'KO-4 見た記録の読み書きは、初回だけ出す案内の共通の作法（logic/noticeSeen.ts）に乗る',
    (() => {
      const src = readFileSync(path.join(koRoot, 'src/logic/importFieldGaps.ts'), 'utf-8')
      return (
        src.includes('hasSeenNotice(IMPORT_FIELD_NOTICE_SEEN_KEY)') &&
        src.includes('markNoticeSeen(IMPORT_FIELD_NOTICE_SEEN_KEY)') &&
        src.includes('forgetNoticeSeen(IMPORT_FIELD_NOTICE_SEEN_KEY)')
      )
    })(),
    true,
  )
  eq(
    'KO-4 登録画面に「今後表示しない」がある',
    koFormSrc.includes('ja.form.importGapNoticeHide') && typeof ja.form.importGapNoticeHide === 'string',
    true,
  )
  eq(
    'KO-4 押すと、その場で消えて見た記録も残る（2回目の取り込みでは出ない）',
    koFormSrc.includes('markImportFieldNoticeSeen()'),
    true,
  )
  eq(
    'KO-4 設定に戻せる場所がある（押した瞬間に二度と出せない形にしない）',
    [
      koSettingsSrc.includes('forgetImportFieldNoticeSeen'),
      koSettingsSrc.includes('data-testid="import-gap-notice-switch"'),
      typeof ja.settings.importGapNoticeTitle === 'string' && ja.settings.importGapNoticeTitle.length > 0,
    ],
    [true, true, true],
  )

  // ---- KO-5: 1品に複数料理が入った品を見分ける ----
  // 実データ（影響範囲テスト・90品）で測ってから決めた形をそのまま置く。
  // 実データそのものはリポジトリに入れないので、測って分かった「形」で書く
  eq(
    'KO-5 手順の行頭の見出しが2種類以上あれば複数料理',
    detectMultiDish({
      title: 'ねぎを使い切る',
      steps: [
        { text: '＜豚肉とねぎのごまポン酢しょうゆ＞ ねぎは4cm幅に切る。' },
        { text: 'フライパンにごま油を入れて熱し、豚肉を焼く。' },
        { text: '【ねぎ味噌】ねぎは小口切りにする。' },
      ],
    })?.headings,
    ['豚肉とねぎのごまポン酢しょうゆ', 'ねぎ味噌'],
  )
  eq(
    'KO-5 料理名が「◯選」「献立」なら、見出しが無くても知らせる',
    [
      detectMultiDish({ title: 'ブロッコリー使い切り3選', steps: [{ text: 'ゆでる。' }] }) !== undefined,
      detectMultiDish({ title: 'ねぎ3本使い切り献立', steps: [{ text: 'ゆでる。' }] }) !== undefined,
    ],
    [true, true],
  )
  eq(
    'KO-5 合わせ調味料の印は料理名ではない（文の途中の【A】【B】で誤検出しない）',
    detectMultiDish({
      title: '鶏むね肉の柔らか甘辛煮',
      steps: [
        { text: '保存袋に【A】を入れて混ぜ、鶏肉を加えて揉み込む。' },
        { text: '合わせておいた【B】を加えて照りが出るまで煮る。' },
      ],
    }),
    undefined,
  )
  eq(
    'KO-5 行頭でも料理名でない見出し（お好みで・調味料・煮汁）では知らせない',
    detectMultiDish({
      title: '五目豆',
      steps: [
        { text: '【調味料】を合わせる。' },
        { text: '【煮汁】が少なくなるまで煮る。' },
        { text: '【お好みで】大葉を添えても◯' },
      ],
    }),
    undefined,
  )
  eq(
    'KO-5 ふつうの1品では知らせない',
    detectMultiDish({ title: '麻婆豆腐', steps: [{ text: '豆腐を切る。' }, { text: '炒める。' }] }),
    undefined,
  )
  eq(
    'KO-5 数を言えるのは見出しから数えられたときだけ',
    [
      multiDishCount({ headings: ['あ', 'い', 'う'], titleSaysMany: false }),
      multiDishCount({ headings: [], titleSaysMany: true }),
    ],
    [3, undefined],
  )
  {
    // 同梱の基本レシピ109品は、どれも1品ぶんの原稿。1品でも複数料理と言ったら赤
    const { starterDefs: koStarters } = await import('../../src/db/starters.ts')
    eq('KO-5 前提: 同梱の基本レシピを読めている', koStarters.length > 100, true)
    eq(
      'KO-5 同梱の基本レシピで誤検出0件',
      koStarters.filter((r) => detectMultiDish({ title: r.title, steps: r.steps }) !== undefined).map((r) => r.title),
      [],
    )
  }
  eq(
    'KO-5 知らせるだけ（材料・手順を機械で分ける処理を持たない）',
    /split|divide|分割/.test(readFileSync(path.join(koRoot, 'src/logic/multiDishImport.ts'), 'utf-8')),
    false,
  )
  eq(
    'KO-5 登録画面が取り込みの結果で知らせている',
    koFormSrc.includes('detectMultiDish(') && koFormSrc.includes('data-testid="import-multi-dish"'),
    true,
  )

  // ---- KO-6: 足した文言が長文の規約に収まっている ----
  {
    const KO_LIMIT = 160
    const koTexts = [
      ['ja.form.importGapNoticeBody', ja.form.importGapNoticeBody],
      ['ja.form.importGapTitle', ja.form.importGapTitle],
      ['ja.form.importGapNoticeHide', ja.form.importGapNoticeHide],
      ['ja.form.importMultiDish', ja.form.importMultiDish],
      ['ja.form.importMultiDishUnknown', ja.form.importMultiDishUnknown],
      ['ja.settings.importGapNoticeTitle', ja.settings.importGapNoticeTitle],
      ['ja.settings.importGapNoticeDescription', ja.settings.importGapNoticeDescription],
      ['ja.settings.importGapNoticeShow', ja.settings.importGapNoticeShow],
    ]
    // 2026-08-26 オーナー指示（書き溜め0826）「『一度出すと〜』削除」。
    // スイッチの名前（「取り込みのあとに説明を出す」）と、上の説明文で足りるので消した。
    // 書き戻したら赤くなるようにしておく
    eq('KO-6 「一度出すと自動で切れます」の1行は残っていない', 'importGapNoticeOnce' in ja.settings, false)
    eq(
      'KO-6 設定の見出しが、どの取り込みの話かを名乗っている',
      ja.settings.importGapNoticeTitle,
      'レシピ自動取り込みのあとの説明',
    )
    eq(
      'KO-6 足した文言がすべて書かれている',
      koTexts.filter(([, text]) => typeof text !== 'string' || text.length === 0).map(([name]) => name),
      [],
    )
    eq(
      `KO-6 続けて読ませる本文が${KO_LIMIT}字以内`,
      koTexts.filter(([, text]) => typeof text === 'string' && text.length > KO_LIMIT).map(([name, text]) => `${name} ${text.length}字`),
      [],
    )
  }
}


// ==========================================================================================
// 便KQ: 熱いうちに食べたい品が先に仕上がって冷める
// （2026-08-25・影響範囲テストC「時間が無い人」の実データ30品）
//
// 起きていたこと（実データ30品の全435組を組み直して数えた）:
//   熱いうちに食べたい品が**その組に1つだけ**なのに、その品が全体の終わりより4分以上前に
//   仕上がる組が15組あった。いちばん大きいのは12分前（豚肉とキャベツの蒸ししゃぶ ＋
//   えのきとしめじの塩昆布和え）。蒸ししゃぶが15分で仕上がったあと、和え物の残りを
//   12分やってから食卓に出す段取りになっていた。
//   熱い品が2つある組（147件）は、どちらかが先に仕上がるのを物理的に避けられないので対象外。
//
// 測るのは**利用者が確かめたいこと**＝「熱いうちに食べたい品が、最後に仕上がること」。
// 工程が何番目に出るか・いくつに割れたかは見ない（段取りが伸びても縮んでも同じ判定になる形）。
// あわせて、2026-08-23 便KDで直した器具の二重予約が復活していないことと、
// 全体の目安が直す前より伸びていないことも同じ組で見る（並べ替えの代償を見逃さないため）。
// ==========================================================================================
{
  const kqRecipe = (id, title, dishType, steps) => ({
    id,
    title,
    dishType,
    servings: 2,
    ingredients: [],
    steps: steps.map(([text, minutes]) => (minutes == null ? { text } : { text, minutes })),
  })

  // 本文は実データ（レタスクラブ／デリッシュキッチン／クラシル）から取り込んだものそのまま
  const kqMushishabu = kqRecipe(9101, '豚肉とキャベツの蒸ししゃぶ', 'main', [
    ['キャベツはざく切りにする。トマトは1cm角に切ってボウルに入れ、Aを混ぜてトマトだれを作る。'],
    [
      'フライパンにキャベツを広げて入れ、豚肉を広げてのせて、塩少々、酒大さじ3をふる。ふたをして中火にかけ、肉に火が通るまで7～8分蒸し焼きにする。',
      8,
    ],
    ['器に盛ってトマトだれをかける。'],
  ])
  const kqShiokonbu = kqRecipe(9102, '簡単副菜 えのきとしめじの塩昆布和え', 'side', [
    ['えのき、しめじは石づきを切り落としておきます。'],
    ['えのきは半分に切ってほぐします。'],
    ['しめじは小房にほぐします。'],
    ['耐熱ボウルに1、2を入れ、ふんわりとラップをかけ、600Wの電子レンジで2分程加熱します。水気を切り、粗熱を取ります。', 2],
    ['ボウルに3、塩昆布、(A)を入れて和えます。'],
    ['器に盛り付けて完成です。'],
  ])
  const kqShumai = kqRecipe(9103, 'レンチンコーンシューマイ', 'main', [
    ['キャベツは1cm幅に切る。'],
    ['ボウルにあんの材料を入れてよく練り混ぜ、8等分して丸める。'],
    ['コーンは水けをしっかりきって別のボウルに入れ、片栗粉大さじ1を加えて混ぜる。２にまんべんなくつけ、もう一度丸め直す。'],
    ['耐熱の器にキャベツを広げて入れて３を間隔をあけて並べ、ラップをかけて6分レンチンする。しょうゆ適量を添える。', 6],
  ])
  const kqMizoreni = kqRecipe(9104, '火を使わずにとろとろおかず！ 鶏むね肉ときのこのレンチンみぞれ煮', 'main', [
    ['鶏肉はキッチンペーパーで水気をふきとり、一口大に切る。ビニール袋に鶏肉、マヨネーズを入れて揉み込む。'],
    ['しめじは根元を切り落とし、手でほぐす。大根は皮を厚めにむき、すりおろして軽く水気を切る(大根おろし)。'],
    ['耐熱容器に☆、1を入れて混ぜ、しめじ、大根おろしをのせてふんわりとラップをし、600Wのレンジで6分加熱し、ラップをしたまま2分おく。', 6],
    ['器に盛り、細ねぎをちらす。'],
  ])

  /** その組で熱いうちに食べたい品（1つだけのときに対象にする） */
  const kqHotOnes = (recipes) => recipes.filter((r) => recipeServeTemp(r) === 'hot')
  /** 熱い品が、全体の終わりより何分前に仕上がるか（大きいほど長く放置される） */
  const kqHotIdle = (recipes, plan) => {
    const hot = kqHotOnes(recipes)[0]
    const end = plan.items.reduce(
      (max, it) => (it.recipeId === hot.id ? Math.max(max, it.endMin) : max),
      0,
    )
    return plan.totalMinutes - end
  }
  /** 器具の台数を超えて同時に使っている瞬間があるか（数え方は KD-1 と同じ） */
  const kqOverCapacity = (items, kitchen) => {
    const over = []
    for (const key of APPLIANCE_KEYS) {
      const capacity = applianceCapacity(kitchen, key)
      const uses = items
        .map((it) => ({
          key: stepApplianceFor(it.text, kitchen),
          start: it.startMin,
          end: it.endMin,
          title: it.recipeTitle,
        }))
        .filter((u) => u.key === key && u.end > u.start)
      for (const at of new Set(uses.map((u) => u.start))) {
        const busy = new Set(uses.filter((u) => u.start <= at && u.end > at).map((u) => u.title))
        if (busy.size > capacity) over.push(`${key} ${at}分 ${[...busy].join(' / ')}`)
      }
    }
    return over
  }

  // 3つ目の数字は**直す前の全体の目安**（分）。これを上回ったら赤＝並べ替えで段取りが伸びている
  // （下回るのは構わない。伸びていないことだけを見る保険の上限）
  for (const [label, kqRecipes, wasTotal] of [
    ['蒸ししゃぶ ＋ 塩昆布和え', [kqMushishabu, kqShiokonbu], 27],
    ['コーンシューマイ ＋ 蒸ししゃぶ', [kqShumai, kqMushishabu], 25],
    ['塩昆布和え ＋ レンチンみぞれ煮', [kqShiokonbu, kqMizoreni], 32],
  ]) {
    const plan = buildCookPlan(kqRecipes, DEFAULT_KITCHEN)
    eq(
      `KQ-1 前提: 並行の段取りが出て、熱い品はこの組に1つだけ: ${label}`,
      [plan.mode, kqHotOnes(kqRecipes).length],
      ['parallel', 1],
    )
    const idle = kqHotIdle(kqRecipes, plan)
    eq(
      `KQ-1 熱い品が先に仕上がって放置にならない: ${label}（全体${plan.totalMinutes}分・熱い品はその${idle}分前に完成）`,
      idle < 4,
      true,
    )
    const over = kqOverCapacity(plan.items, DEFAULT_KITCHEN)
    eq(
      `KQ-2 並べ替えで器具の二重予約を作らない: ${label}（${over.join(' / ') || '重なりなし'}）`,
      over.length,
      0,
    )
    eq(
      `KQ-3 並べ替えで全体の目安が伸びていない: ${label}（${plan.totalMinutes}分 ≦ 直す前${wasTotal}分）`,
      plan.totalMinutes <= wasTotal,
      true,
    )
  }

  // ---- KQ-5: 同梱レシピでも、並べ替えの代償が出ていないか ----
  // 実データ30品だけで見ると「その30品に合わせただけ」になりうるので、**別の顔ぶれ**
  // （同梱の基本レシピ）でも同じ2つを見る。上限の数字は**直す前に測った値**で、
  // 増えたら赤・減らしたらその数字を下げる（理由なしに緩めない）。
  {
    const kqStarters = starterDefs.slice(0, 24).map((d, i) => ({ ...d, id: 91000 + i }))
    let kqSum = 0
    let kqPairs = 0
    let kqParallel = 0
    let kqIdlePairs = 0
    for (let a = 0; a < kqStarters.length; a++) {
      for (let b = a + 1; b < kqStarters.length; b++) {
        const pair = [kqStarters[a], kqStarters[b]]
        const plan = buildCookPlan(pair, DEFAULT_KITCHEN)
        kqSum += plan.totalMinutes
        kqPairs++
        if (plan.mode !== 'parallel') continue
        kqParallel++
        if (kqHotOnes(pair).length !== 1) continue
        if (kqHotIdle(pair, plan) >= 4) kqIdlePairs++
      }
    }
    eq('KQ-5 前提: 同梱レシピ24品の全組を組めている', kqPairs, 276)
    eq(
      `KQ-5 並べ替えで同梱レシピの段取りが伸びていない（合計${kqSum}分 ≦ 直す前8975分）`,
      kqSum <= 8975,
      true,
    )
    eq(
      `KQ-5 並行に組める組が減っていない（${kqParallel}組 ≧ 直す前252組）`,
      kqParallel >= 252,
      true,
    )
    eq(
      `KQ-5 熱い品が先に仕上がって放置になる組が増えていない（${kqIdlePairs}組 ≦ 直す前22組）`,
      kqIdlePairs <= 22,
      true,
    )
  }

  // 熱い品が2つある組は対象外＝どちらかが先に仕上がるのは物理的に避けられない。
  // ここで見るのは「対象外の組まで並べ替えて壊していないこと」＝二重予約と全体の目安
  {
    const kqShogayaki = kqRecipe(9105, '簡単！ 子供も食べやすい生姜焼き', 'main', [
      ['玉ねぎは根元を取り除き、薄切りにする。しょうがはすりおろす。トマトはへたを取り除き、4等分の放射状に切る(くし形切り)。'],
      ['豚肉は一口大に切る。ポリ袋に豚肉、片栗粉を入れて全体にまぶす。'],
      ['ボウルに1のしょうが、☆を入れて混ぜる(しょうがたれ)。'],
      ['フライパンにサラダ油を入れて中火で熱し、2の豚肉を入れて全体に火が通って肉の色が変わるまで3分ほど炒める。', 3],
      ['玉ねぎを加えてしんなりするまで炒め、しょうがたれを加えて炒め合わせる。'],
      ['器に盛り、キャベツ、トマトを添える。'],
    ])
    const kqMaboNasu = kqRecipe(9106, '子供でも食べられる！ 辛くない！麻婆茄子', 'main', [
      ['なすはへたを切り落とし、縦半分に切る。切り口を下にして横1cm幅に切る。水にさらして水気を切る。ねぎはみじん切りにする。'],
      ['ボウルに☆を入れて混ぜる。'],
      ['フライパンにごま油を入れて中火で熱し、豚ひき肉、おろしにんにく、おろししょうがを入れて肉の色が変わるまで炒める。なす、ねぎを加えてなすがしんなりするまで炒める。'],
      ['☆、水を加えて混ぜ、煮立ったらふたをして弱めの中火で3分ほど煮る。ふたを取り、弱火にして水溶き片栗粉を回し入れる。中火にし、とろみがつくまで混ぜる。', 3],
    ])
    const kqTwoHot = [kqShogayaki, kqMaboNasu]
    const plan = buildCookPlan(kqTwoHot, DEFAULT_KITCHEN)
    eq('KQ-4 前提: 熱い品が2つある組', kqHotOnes(kqTwoHot).length, 2)
    const over = kqOverCapacity(plan.items, DEFAULT_KITCHEN)
    eq(
      `KQ-4 熱い品が2つの組でも器具の二重予約を作らない（${over.join(' / ') || '重なりなし'}）`,
      over.length,
      0,
    )
    eq(
      `KQ-4 熱い品が2つの組の全体の目安が伸びていない（${plan.totalMinutes}分 ≦ 直す前39分）`,
      plan.totalMinutes <= 39,
      true,
    )
  }
}



// ============================================================================
// LG-01: 並行調理ナビ（2026-08-26 便LG・オーナーの書き溜め）
// ============================================================================
{
  const lgRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lgNavi = readFileSync(path.join(lgRoot, 'src/pages/CookNaviPage.tsx'), 'utf-8')

  // ---- 説明文を短くする ----
  // オーナー原文「「今日の献立から〜提案します。」→「今日の献立から選んだ2〜3品で
  //   「1本の段取り」を提案します。」短く。」
  eq(
    'LG-01 ナビの説明は「今日の献立から選んだ2〜3品で〜」の1文',
    ja.cookNavi.intro,
    '今日の献立から選んだ2〜3品で「1本の段取り」を提案します。',
  )
  eq('LG-01 説明は30字まで（短くする指示）', ja.cookNavi.intro.length <= 30, true)

  // ---- 「1品ずつ作ると〜◯分の短縮」は画面から消す ----
  // オーナー原文「削除。4分とかだと個人の裁量で直ぐに覆るし、目安でさえこれしか変わらないんだと
  //   思ってしまう。ない方がいい。」
  eq(
    'LG-01 比較の文言（totalCompare / totalGain）は ja.ts から消えている',
    ['totalCompare', 'totalGain'].filter((key) => key in ja.cookNavi),
    [],
  )
  eq('LG-01 画面もその行を描いていない', lgNavi.includes('navi-total-compare'), false)
  eq(
    'LG-01 全体の目安は残す（消しすぎていない）',
    [typeof ja.cookNavi.totalEstimate, lgNavi.includes('navi-total-estimate')],
    ['string', true],
  )

  // ---- 短縮の分数を出す計算は残す ----
  //   buildCookPlan の gainPercent は「並行で組むか、1品ずつの順番に落とすか」の分かれ目に
  //   使っている。画面から消えたからと落とすと、段取りの組み方そのものが変わる
  {
    const lgRecipes = [
      {
        id: 9101,
        title: 'LG煮もの',
        servings: 2,
        steps: [
          { text: '大根を切る。', minutes: 3 },
          { text: 'ふたをして弱火で20分煮る。', minutes: 20 },
          { text: '器に盛る。', minutes: 1 },
        ],
        ingredients: [{ name: '大根', amount: '1/4', unit: '本' }],
        tags: [],
        effortLevel: 'normal',
      },
      {
        id: 9102,
        title: 'LGあえもの',
        servings: 2,
        steps: [
          { text: 'ほうれん草をゆでる。', minutes: 3 },
          { text: 'しょうゆとごまであえる。', minutes: 2 },
        ],
        ingredients: [{ name: 'ほうれん草', amount: '1', unit: '束' }],
        tags: [],
        effortLevel: 'normal',
      },
    ]
    const lgPlan = buildCookPlan(lgRecipes)
    eq(
      'LG-01 1品ずつ作ったときの合計（sequentialMinutes）は今までどおり数えている',
      lgPlan.sequentialMinutes > 0,
      true,
    )
    eq(
      'LG-01 縮む割合（gainPercent）も数えている＝段取りの組み方の分かれ目に使う',
      typeof lgPlan.gainPercent === 'number' && lgPlan.gainPercent >= 0,
      true,
    )
    eq(
      'LG-01 1品ずつの合計は、並行の合計より短くならない',
      lgPlan.sequentialMinutes >= lgPlan.parallelMinutes,
      true,
    )
  }
}
