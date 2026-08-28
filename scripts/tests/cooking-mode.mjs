// 調理中モード（カーソル・読み上げ・タイマー・声で操作）
// scripts/test-logic.mjs から読み込まれる。判定器(eq/neq)と合否の集計は ./_harness.mjs にある。
// 新しい検査はこのファイルの末尾に足す（節ごとにファイルが分かれているので、別の便とぶつからない）。
import { eq, scriptFileUrl } from './_harness.mjs'
import { formatMinutesSecondsLabel } from '../../src/logic/time.ts'
import {
  shouldShowPermissionHelp,
  shouldShowUnsupportedNote,
  vibrationSupported,
} from '../../src/logic/cookingSupport.ts'
import {
  TIMER_SOUND_VOLUMES,
  TIMER_SOUND_LENGTHS,
  timerSoundGain,
  timerSoundBeepCount,
  timerSoundSeconds,
} from '../../src/logic/timerSound.ts'
import {
  classifyStep,
  buildCookTimeline,
  showsWaitTimerButton,
  splitMixedStep,
  splitWaitFirstStep,
  recipeStepLabel,
} from '../../src/logic/cookNavi.ts'
import {
  parseCookNaviSession,
  reconcileSelectedIds,
  reconcileSelectedIdsForSession,
  resolveCookNaviSelection,
  pickDefaultSelectedIds,
  COOK_NAVI_MAX_RECIPES,
} from '../../src/logic/cookNaviSession.ts'
import {
  advanceCursor,
  applyStepPulls,
  backCursor,
  collapseStepText,
  cursorEquals,
  findCursorIndex,
  isCursorAtFirst,
  isCursorAtLast,
  nextStepsByRecipe,
  resolveColorMove,
  resolveCursor,
  resolveTimerStepLanding,
  resumeCursor,
  startCursor,
} from '../../src/logic/cookSession.ts'
import {
  matchVoiceColor,
  matchVoiceCommand,
  pickVoiceResumeTarget,
  pickVoiceStopTarget,
  resolveVoiceTimerSeconds,
} from '../../src/logic/voiceCommand.ts'
import {
  NAVI_COLOR_SPEECH,
  NAVI_COLOR_WORDS,
  NAVI_RECIPE_COLORS,
  naviColorWord,
} from '../../src/logic/naviColors.ts'
import { ja } from '../../src/i18n/ja.ts'
// 2026-08-26 便LG: 詰め込みの行組み（読点優先をやめて行数を最小にする経路）を測る
import { composeLines } from '../../src/logic/lineCompose.ts'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readFileSync } from 'node:fs'
// 並行調理ナビの診断が使う「割ってはいけない手順」の判定（2026-08-16 便HA・docs/68 の裁定）。
// 診断そのものは1回15秒かかるので、直接実行されたときだけ走るようになっている
// （`audit-cook-navi.mjs` の RUN_AUDIT）。ここでは判定の関数だけを読む
import { notSplittableReason, isMixedStep } from '../audit-cook-navi.mjs'

// ---------- DY-3 タイマー音の音量・長さ(2026-08-08 オーナー実機フィードバック③) ----------
// 「タイマー音量や長さは、設定から調整や確認できるようにしたい」。
// 既定値は必ず従来の音のまま＝設定を触っていない既存ユーザーの音を勝手に変えない
{
  eq('DY-3 タイマー音: 未設定の音量は従来値(0.4)', timerSoundGain(undefined), 0.4)
  eq('DY-3 タイマー音: 未設定の回数は従来値(3回)', timerSoundBeepCount(undefined), 3)
  eq('DY-3 タイマー音: 「ふつう」は未設定と同じ音量', timerSoundGain('normal'), timerSoundGain(undefined))
  eq('DY-3 タイマー音: 「約1秒」は未設定と同じ回数', timerSoundBeepCount('short'), timerSoundBeepCount(undefined))
  eq('DY-3 タイマー音: 音量は小さめ<ふつう<大きめ', [
    timerSoundGain('low') < timerSoundGain('normal'),
    timerSoundGain('normal') < timerSoundGain('high'),
  ], [true, true])
  eq('DY-3 タイマー音: 長さは短い<ふつう<長い', [
    timerSoundBeepCount('short') < timerSoundBeepCount('medium'),
    timerSoundBeepCount('medium') < timerSoundBeepCount('long'),
  ], [true, true])
  eq('DY-3 タイマー音: 選択肢は音量3段階・長さ3段階', [TIMER_SOUND_VOLUMES.length, TIMER_SOUND_LENGTHS.length], [3, 3])
  // 画面に出す秒数(選択肢のラベル)。1回0.4秒+0.45秒間隔で数えた値
  eq('DY-3 タイマー音: 選択肢のラベルは約1秒/約3秒/約5秒', TIMER_SOUND_LENGTHS.map(timerSoundSeconds), [1, 3, 5])
  // 壊れた保存値(将来の型変更・手で書き換えたIndexedDB)でも音が消えない
  eq('DY-3 タイマー音: 知らない値が保存されていても従来の音で鳴らす', [
    timerSoundGain('とんでもない値'),
    timerSoundBeepCount('とんでもない値'),
  ], [0.4, 3])
}

// ---------- EE-7 タイマー音の注意書き(2026-08-08 オーナー実機フィードバック) ----------
// 「音量と長さのボタン押下では音を鳴らさず、『音を鳴らして〜』ボタン押下ではじめて音が
// 鳴るようにする」「ボタン押下で音が鳴る注意書きがない」。
// どのボタンで鳴るかを言い切っているかを機械検査して、書き換えで曖昧に戻るのを止める
{
  eq(
    'EE-7 注意書きが「音量と鳴る長さのボタンでは鳴らない」と言っている',
    ja.settings.timerSoundPreviewNote.includes('音量と鳴る長さのボタンでは音は鳴りません'),
    true,
  )
  // 2026-08-28 便MC・オーナー原文「タイマー音：「「音を鳴らして確かめる」を押すと〜」削除。
  // ボタン名でわかるため。」＝**音が鳴るボタンの説明は書かない**。ボタンの名前がその説明。
  // 残すのは1文目だけ（押しても鳴らないことは、ボタンの名前からは読めない非自明な事実）。
  // それまでの「音の鳴るボタンを名前で挙げている」の見張りは、この指示で逆向きになった
  eq(
    'EE-7(便MC) 注意書きに「音を鳴らして確かめる」の説明を書き戻していない（ボタン名で分かる）',
    ja.settings.timerSoundPreviewNote.includes(ja.settings.timerSoundPreview),
    false,
  )
  eq(
    'EE-7(便MC) 注意書きは1文だけ',
    ja.settings.timerSoundPreviewNote.split('。').filter((s) => s.trim() !== '').length,
    1,
  )
  // 規約H: 説明文で「ここ」「これ」等の指示語で場所を示さない
  eq(
    'EE-7 注意書きに指示語が入っていない',
    /ここ|これ|それ|そこ|あちら/.test(ja.settings.timerSoundPreviewNote),
    false,
  )
}

// ---------- toSpeechText: 調理中モード読み上げの用語辞書reading適用(docs/20 §2・2026-07-12) ----------
{
  const { toSpeechText } = await import('../../src/logic/toSpeechText.ts')

  eq(
    '誤読しやすい語(粉ふき→こなふき)がreadingで置換される',
    toSpeechText('粉ふきいもにする。'),
    'こなふきいもにする。',
  )
  eq('小口切り→こぐちぎり', toSpeechText('小口切りにする。'), 'こぐちぎりにする。')
  eq(
    '最長一致: さいの目切りは全体がreadingに置換される(短いalias「さいの目」止まりで「切り」が残らない)',
    toSpeechText('大根はさいの目切りにする。'),
    '大根はさいのめぎりにする。',
  )
  eq(
    '1文に複数の辞書語があれば両方置換される',
    toSpeechText('小口切りにして塩もみする。'),
    'こぐちぎりにしてしおもみする。',
  )
  eq(
    'readingが未設定の語(ガク)はそのまま素通し(表示同様、読みに迷いが無い語は無変換でよい)',
    toSpeechText('ガクを切り落とす。'),
    'ガクを切り落とす。',
  )
  eq('食材名の辞書収載語も読みへ変換(甜麺醤=2026-07-12にFableが辞書へ追加)', toSpeechText('甜麺醤を加える。'), 'テンメンジャンを加える。')
  eq('辞書語を含まないテキストは無加工で返る', toSpeechText('よく混ぜ合わせる。'), 'よく混ぜ合わせる。')

  // 別表記に見出し語の読みを当てない(2026-07-28 機能④診断)。
  // 以前は「くし形」に「くしがたぎり」(=くし形切り)が当たり「くし形切りに切る」と重複して読まれた
  eq(
    '別表記「くし形」は「くしがた」と読む(見出し語くし形切りの読みを流用しない)',
    toSpeechText('玉ねぎはくし形に切る。'),
    '玉ねぎはくしがたに切る。',
  )
  eq(
    '別表記「さいの目」も同様(さいのめぎりにならない)',
    toSpeechText('豆腐はさいの目に切る。'),
    '豆腐はさいのめに切る。',
  )
  eq(
    '別表記「落とし蓋」は見出し語と同じ読みを明示しているのでそのまま当たる',
    toSpeechText('落とし蓋をして煮る。'),
    'おとしぶたをして煮る。',
  )
  eq(
    '別表記に読みを書いていない語(あく)は表記のまま読み上げる',
    toSpeechText('あくを取る。'),
    'あくを取る。',
  )
  eq(
    '見出し語そのものは従来どおりreadingで置換される(回帰)',
    toSpeechText('玉ねぎはくし形切りにする。'),
    '玉ねぎはくしがたぎりにする。',
  )

  // ---------- 2026-08-12 便FX・単位の読み（オーナー実機「『cm』をシーエムと読むくらいに酷い」）
  // 単位は data/unitReadings.ts で読みに置き換える（用語タップ辞書には入れない＝
  // 手順本文の「200g」がタップ対象にならない）。表示テキストは1文字も変えない。
  eq('FX-05 cmはセンチと読む', toSpeechText('4cm長さに切る。'), '4センチ長さに切る。')
  eq('FX-05 mmはミリと読む', toSpeechText('5mm幅の薄切りにする。'), '5ミリ幅の薄切りにする。')
  eq('FX-05 gはグラムと読む', toSpeechText('鶏むね肉300gを使う。'), '鶏むね肉300グラムを使う。')
  eq('FX-05 kgはキロと読む(gより先に当てる)', toSpeechText('野菜が1kg程度まで。'), '野菜が1キロ程度まで。')
  eq('FX-05 mlはミリリットルと読む', toSpeechText('水200mlを注ぐ。'), '水200ミリリットルを注ぐ。')
  eq('FX-05 Lはリットルと読む', toSpeechText('湯1Lに塩を入れる。'), '湯1リットルに塩を入れる。')
  eq('FX-05 ccはシーシーと読む', toSpeechText('だし200ccを加える。'), 'だし200シーシーを加える。')
  eq('FX-05 ℃は度と読む', toSpeechText('180℃に予熱する。'), '180度に予熱する。')
  eq('FX-05 %はパーセントと読む', toSpeechText('塩分2%で漬ける。'), '塩分2パーセントで漬ける。')
  eq('FX-05 大さじ・小さじはひらがなで読む', toSpeechText('大さじ2と小さじ1を混ぜる。'), 'おおさじ2とこさじ1を混ぜる。')
  eq('FX-05 分数は「◯分の◯」と読む', toSpeechText('卵液の1/3を流す。'), '卵液の3分の1を流す。')
  eq(
    'FX-05 単位も辞書語も入っている文は両方効く',
    toSpeechText('小口切りにして5cm幅に切る。'),
    'こぐちぎりにして5センチ幅に切る。',
  )
  // 数字が前に無い英字は触らない（英単語の中の l・g を壊さない）
  eq('FX-05 数字の前に無い英字は読み替えない', toSpeechText('Lサイズの卵を使う。'), 'Lサイズの卵を使う。')
  eq('FX-05 英単語の中は読み替えない', toSpeechText('1グラタン皿に入れる。'), '1グラタン皿に入れる。')
}

// ---------- 自由な時間のタイマーの秒刻み表示(formatMinutesSecondsLabel。2026-07-12秒刻み対応) ----------
eq('分のみ(秒0)は「3分」', formatMinutesSecondsLabel(180), '3分')
eq('分+秒は「3分30秒」', formatMinutesSecondsLabel(210), '3分30秒')
eq('1分未満は秒のみ「45秒」', formatMinutesSecondsLabel(45), '45秒')
eq('負数は0扱いで「0秒」', formatMinutesSecondsLabel(-5), '0秒')
eq('端数は丸める', formatMinutesSecondsLabel(60.4), '1分')

// ---------- timerOrder: タイマーの表示順と端末内保存の読み戻し(2026-07-28 機能④診断C6/C7) ----------
{
  const { sortTimersForDisplay, parseStoredTimers, RESTORE_GRACE_MS } = await import(
    '../../src/logic/timerOrder.ts'
  )

  // C6: 起動順のままだと「先に鳴るもの」が最下段に来ることがあった。
  // 終わったもの→残りが少ない順に並べ替える(元の配列は書き換えない)
  const base = [
    { id: 1, done: false, endsAt: 15_000 }, // 肉じゃが15分(先に起動・一番長い)
    { id: 2, done: false, endsAt: 5_000 }, // カレー5分
    { id: 3, done: false, endsAt: 2_000 }, // 味噌汁2分(最後に起動・一番先に鳴る)
  ]
  eq(
    'C6 起動順に関係なく残りが少ない順に並ぶ',
    sortTimersForDisplay(base).map((t) => t.id),
    [3, 2, 1],
  )
  eq('C6 元の配列(TimerProviderの状態)は並べ替えない', base.map((t) => t.id), [1, 2, 3])
  eq(
    'C6 終わったタイマーは残り時間に関わらず先頭に来る',
    sortTimersForDisplay([
      { id: 1, done: false, endsAt: 2_000 },
      { id: 2, done: true, endsAt: 9_000 },
      { id: 3, done: false, endsAt: 1_000 },
    ]).map((t) => t.id),
    [2, 3, 1],
  )
  eq('C6 0本・1本でも壊れない', sortTimersForDisplay([]).length, 0)

  // C7: リロード・タブ破棄でタイマーが全消滅していた。endsAtは絶対時刻なので保存→読み戻しで続く
  const now = 1_800_000_000_000
  const stored = JSON.stringify([
    {
      id: 7,
      key: '1-2-900',
      label: '肉じゃが',
      doneLabel: '煮込み終わり',
      recipeId: 1,
      stepNumber: 3,
      endsAt: now + 600_000,
      totalSeconds: 900,
      done: false,
      muted: false,
    },
  ])
  const restored = parseStoredTimers(stored, now)
  eq('C7 保存したタイマーが読み戻せる', restored.length, 1)
  eq('C7 終了予定時刻(絶対時刻)がそのまま復元される', restored[0].endsAt, now + 600_000)
  eq('C7 レシピID・手順番号・終了文言も保たれる', [restored[0].recipeId, restored[0].stepNumber, restored[0].doneLabel], [1, 3, '煮込み終わり'])
  eq(
    'C7 読み戻しの時点で終了時刻を過ぎている分は done で戻す(開いた瞬間に鳴らさない)',
    parseStoredTimers(stored, now + 900_000)[0].done,
    true,
  )
  eq(
    'C7 終了から1時間より古いものは捨てる(翌日に古い「終わり」が並ばない)',
    parseStoredTimers(stored, now + 600_000 + RESTORE_GRACE_MS + 1).length,
    0,
  )
  eq('C7 保存が無い・壊れているときは空で始める(起動を妨げない)', [
    parseStoredTimers(null, now).length,
    parseStoredTimers('', now).length,
    parseStoredTimers('{壊れたJSON', now).length,
    parseStoredTimers('{"not":"array"}', now).length,
  ], [0, 0, 0, 0])
  eq(
    'C7 idやendsAtが欠けた行は黙って捨てる',
    parseStoredTimers(JSON.stringify([{ label: 'こわれた行' }, null, 3]), now).length,
    0,
  )

  // 2026-08-03 便DS/実機FB②: 自分で時間を決めたタイマーを、手順のタイマーと見分けるための印。
  // 調理中モードから始めると戻り先として手順番号を持つため、番号バッジだけでは区別できず
  // 「どのレシピのどの手順のタイマーか」と誤読されていた。印は保存・読み戻しでも保たれること、
  // 印を持たない古い保存は従来どおり手順のタイマー扱いに落ちることを固定する
  const customStored = JSON.stringify([
    {
      id: 8,
      key: 'custom-1-180',
      label: 'タイマー',
      doneLabel: '終わり',
      recipeId: 1,
      stepNumber: 2,
      endsAt: now + 60_000,
      totalSeconds: 180,
      done: false,
      muted: false,
      isCustom: true,
    },
  ])
  eq('便DS② 自分で決めたタイマーの印が読み戻しでも保たれる', parseStoredTimers(customStored, now)[0].isCustom, true)
  eq(
    '便DS② 印を持ったまま戻り先の手順番号も保たれる(タップで手順へ戻れる)',
    parseStoredTimers(customStored, now)[0].stepNumber,
    2,
  )
  eq('便DS② 印の無い古い保存は手順のタイマー扱い(既存の見た目のまま)', parseStoredTimers(stored, now)[0].isCustom, false)
  eq(
    '便DS② 印が真偽値でない壊れた保存でも手順のタイマー扱いに倒す',
    parseStoredTimers(customStored.replace('"isCustom":true', '"isCustom":"はい"'), now)[0].isCustom,
    false,
  )

  // 2026-08-10 便EZ①: 声の「ストップ」でタイマーを一時停止できるようにしたぶんの回帰。
  // 止まっている間は時計を進めない／読み戻しても「終わり」に化けない／並びの後ろに回る
  const { timerRemainingSeconds } = await import('../../src/logic/timerOrder.ts')
  eq(
    '便EZ① 動作中の残りは終了予定時刻から数える',
    timerRemainingSeconds({ endsAt: now + 90_000 }, now),
    90,
  )
  eq(
    '便EZ① 一時停止中は止めた時点の残りを出す(時計が進まない)',
    [
      timerRemainingSeconds({ endsAt: now + 90_000, pausedRemainingMs: 90_000 }, now),
      timerRemainingSeconds({ endsAt: now + 90_000, pausedRemainingMs: 90_000 }, now + 60_000),
    ],
    [90, 90],
  )
  eq('便EZ① 残りが負になっても0で止める', timerRemainingSeconds({ endsAt: now - 5_000 }, now), 0)
  eq(
    '便EZ① 一時停止中のものは動作中より後ろに並ぶ(次に鳴る順を読み違えない)',
    sortTimersForDisplay([
      { id: 1, done: false, endsAt: 1_000, pausedRemainingMs: 1_000 },
      { id: 2, done: false, endsAt: 9_000 },
      { id: 3, done: true, endsAt: 20_000 },
    ]).map((t) => t.id),
    [3, 2, 1],
  )
  const pausedStored = JSON.stringify([
    {
      id: 9,
      key: '1-2-900',
      label: '肉じゃが',
      doneLabel: '煮込み終わり',
      recipeId: 1,
      stepNumber: 3,
      endsAt: now + 300_000,
      totalSeconds: 900,
      done: false,
      muted: false,
      pausedRemainingMs: 300_000,
    },
  ])
  eq(
    '便EZ① 一時停止したまま読み込み直しても、止まったまま残りが保たれる',
    (() => {
      const t = parseStoredTimers(pausedStored, now + 3_600_000 - 1)[0]
      return [t.pausedRemainingMs, t.done, t.endsAt - (now + 3_600_000 - 1)]
    })(),
    [300_000, false, 300_000],
  )
  eq(
    '便EZ① 止めたまま放置して終了予定から1時間過ぎた分は復元しない(翌日に残らない)',
    parseStoredTimers(pausedStored, now + 300_000 + RESTORE_GRACE_MS + 1).length,
    0,
  )
  eq(
    '便EZ① 一時停止の印が壊れている古い保存は、従来どおり動作中として読み戻す',
    (() => {
      const t = parseStoredTimers(pausedStored.replace('"pausedRemainingMs":300000', '"pausedRemainingMs":"はい"'), now)[0]
      return [t.pausedRemainingMs, t.done]
    })(),
    [undefined, false],
  )
}

// ---------- 便EZ②: タイマーが指す手順の呼び方(丸数字＋レシピ内の手順番号) ----------
// オーナー実機「タイマー『段取りの〜を開く』→『手順⑦3-1を開く』、『段取りの7番目』は削除」。
// 画面のバッジは「段取りの通し番号(大きい丸)＋レシピ内の手順番号(小さい丸・料理の色)」の2つで、
// 文字の側だけが「段取りの7番目」と別の呼び方をしていた
{
  const { circledNumber, naviStepText } = await import('../../src/logic/naviStepText.ts')
  eq('便EZ② 1〜20は①〜⑳', [circledNumber(1), circledNumber(7), circledNumber(20)], ['①', '⑦', '⑳'])
  eq('便EZ② 21〜35は㉑〜㉟', [circledNumber(21), circledNumber(35)], ['㉑', '㉟'])
  eq('便EZ② 36〜50は㊱〜㊿', [circledNumber(36), circledNumber(50)], ['㊱', '㊿'])
  eq(
    '便EZ② 丸数字の無い範囲はそのままの数字に落とす(表示が消えない)',
    [circledNumber(0), circledNumber(51), circledNumber(1.5)],
    ['0', '51', '1.5'],
  )
  eq('便EZ② 段取り7番目・レシピ内3-1は「⑦（3-1）」', naviStepText(7, '3-1'), '⑦（3-1）')
  eq('便EZ② レシピ内の手順番号が無い工程(湯を沸かす)は丸数字だけ', naviStepText(7), '⑦')
  // --- 便FU-4(2026-08-12 利用者テスト): 丸数字と数字がくっついて読めない ---
  // 指摘（原文）:「『前に開いていた手順⑫5から始まります。』⑫と5がくっついていて読めません。
  // タイマー調整のラベルも『手順③2のタイマーを調整』」
  eq('FU-4 丸数字とレシピ内の手順番号を続けて書かない', naviStepText(12, '5'), '⑫（5）')
  eq('FU-4 レシピ内番号が「3-1」の工程も同じ形', naviStepText(7, '3-1'), '⑦（3-1）')
  eq('FU-4 2桁のレシピ内番号でも区切りが入る', naviStepText(3, '12'), '③（12）')
  eq(
    'FU-4 くっついた形（⑫5・③2）はもう作らない',
    [naviStepText(12, '5'), naviStepText(3, '2')].some((s) => /[①-⑳㉑-㉟㊱-㊿]\d/.test(s)),
    false,
  )
}

// ---------- 声で操作のコマンド判定(2026-07-30 便CK/④-1) ----------
// 判定が /もう1?回|もういちど|もう一度/ で、「1」が半角数字だったため
// 案内文どおりの「もう一回」(漢数字)と「もういっかい」が完全無反応だった
// (読み上げが起きないだけでなく「聞き取りました」の手応えも出ない)
{
  eq('便CK/④-1 「もう一回」(漢数字)で読み上げ直す', matchVoiceCommand('もう一回'), 'repeat')
  eq('便CK/④-1 「もういっかい」でも読み上げ直す', matchVoiceCommand('もういっかい'), 'repeat')
  eq('便CK/④-1 「もう1回」(半角)は従来どおり動く', matchVoiceCommand('もう1回'), 'repeat')
  eq('便CK/④-1 「もう１回」(全角)も動く', matchVoiceCommand('もう１回'), 'repeat')
  eq('便CK/④-1 「もう一度」は従来どおり動く', matchVoiceCommand('もう一度'), 'repeat')
  eq('便CK/④-1 「もういちど」は従来どおり動く', matchVoiceCommand('もういちど'), 'repeat')
  eq('便CK/④-1 「次へ」は手順を進める', matchVoiceCommand('次へ'), 'next')
  eq('便CK/④-1 「つぎ」も手順を進める', matchVoiceCommand('つぎ'), 'next')
  eq('便CK/④-1 「戻って」は手順を戻す', matchVoiceCommand('戻って'), 'prev')
  eq('便CK/④-1 「まえ」も手順を戻す', matchVoiceCommand('まえ'), 'prev')
  eq('便CK/④-1 「ストップ」は読み上げを止める', matchVoiceCommand('ストップ'), 'stop')
  eq('便CK/④-1 「止めて」も読み上げを止める', matchVoiceCommand('止めて'), 'stop')
  eq('便CK/④-1 「タイマー」はタイマー', matchVoiceCommand('タイマー'), 'timer')
  eq('便CK/④-1 「3分タイマー」もタイマー', matchVoiceCommand('3分タイマー'), 'timer')
  eq('便CK/④-1 どれでもない言葉は無反応(手応えも出さない)', matchVoiceCommand('こんばんは'), undefined)
  // 分岐の優先順位は従来のif-elseの順番どおり(先に「次へ」を見る)
  // 2026-08-15 オーナー指示「全体一致に揃えて」で、「次」は発話まるごとの一致だけになった。
  // その副作用として**「次へ」を含む複合の言い方は通らなくなる**（ここでは読み上げ側に落ちる）。
  // 独り言（「次に塩を入れるんだっけ」）で手順が進む事故を消すほうを取った、という記録
  eq('便CK/④-1 「次へ」を含む複合は、もう「次へ」にはならない', matchVoiceCommand('次へもう一回'), 'repeat')

  // 2026-08-03 便DS/実機FB⑤: 時間の書かれていない手順で「タイマー」とだけ言うと、
  // 聞き取れていても何秒にすればよいか決められず、画面に何も出ないまま終わっていた。
  // 「決められない」ことが呼び出し側に伝わる形(undefined)を固定し、案内を出す道を守る
  eq('便DS⑤ 「3分タイマー」は発話の分数を使う', resolveVoiceTimerSeconds('3分タイマー', undefined, undefined), 180)
  eq(
    '便DS⑤ 発話の分数は手順の分数より優先される',
    resolveVoiceTimerSeconds('10分タイマー', 15, 300),
    600,
  )
  eq('便DS⑤ 「タイマー」だけなら手順に設定された分数を使う', resolveVoiceTimerSeconds('タイマー', 15, undefined), 900)
  eq(
    '便DS⑤ 手順に分数が無ければ本文中の最初の時間表記を使う',
    resolveVoiceTimerSeconds('タイマー', undefined, 300),
    300,
  )
  eq(
    '便DS⑤ 時間の手掛かりが何も無ければ「決められない」を返す(案内を出す合図)',
    resolveVoiceTimerSeconds('タイマー', undefined, undefined),
    undefined,
  )

  // 2026-08-10 便EZ①: オーナー実機「タイマー音声操作→『ストップ』は聞き取れていても
  // タイマーとまらない。他はOK」。**聞き取り(matchVoiceCommand)は元から正しく 'stop' を
  // 返していた**＝真因は画面側で 'stop' を読み上げの停止にしか繋いでいなかったこと。
  // 語形と、複数動いているときにどれを止めるかの決め方を、ここで固定する
  eq('便EZ① 「ストップ」は聞き取れている(判定は元から正しい)', matchVoiceCommand('ストップ'), 'stop')
  eq('便EZ① かなで返る端末の「すとっぷ」も受ける', matchVoiceCommand('すとっぷ'), 'stop')
  eq('便EZ① 「タイマーストップ」はタイマーの新規起動にしない', matchVoiceCommand('タイマーストップ'), 'stop')
  eq('便EZ① 「タイマー止めて」も止める側に倒す', matchVoiceCommand('タイマー止めて'), 'stop')
  eq('便EZ① 「停止」も受ける', matchVoiceCommand('停止'), 'stop')
  eq('便EZ① 「3分タイマー」は従来どおり新規起動のまま', matchVoiceCommand('3分タイマー'), 'timer')

  const stopTimers = [
    // 肉じゃが(recipeId:1)の2本。残りは 5分 と 1分
    { id: 1, done: false, endsAt: 300_000, recipeId: 1 },
    { id: 2, done: false, endsAt: 60_000, recipeId: 1 },
    // 味噌汁(recipeId:2)。残り30秒＝全体でいちばん先に鳴る
    { id: 3, done: false, endsAt: 30_000, recipeId: 2 },
  ]
  eq(
    '便EZ① いま画面に出している料理のタイマーを優先して止める',
    pickVoiceStopTarget(stopTimers, 1)?.id,
    2,
  )
  eq(
    '便EZ① その料理のタイマーが無ければ、次に鳴る1本を止める',
    pickVoiceStopTarget(stopTimers, 3)?.id,
    3,
  )
  eq(
    '便EZ① どの料理を見ているか分からないときも、次に鳴る1本を止める',
    pickVoiceStopTarget(stopTimers)?.id,
    3,
  )
  eq(
    '便EZ① 終わったタイマーは声では触らない(片付け=削除は取り消せないため)',
    pickVoiceStopTarget([{ id: 4, done: true, endsAt: 10, recipeId: 1 }], 1),
    undefined,
  )
  eq(
    '便EZ① すでに止めてあるタイマーは選ばない(「ストップ」で再開しない)',
    pickVoiceStopTarget([{ id: 5, done: false, endsAt: 10, recipeId: 1, pausedRemainingMs: 10 }], 1),
    undefined,
  )
  eq('便EZ① 1本も動いていなければ何も止めない', pickVoiceStopTarget([], 1), undefined)

  // 2026-08-10 便FC: オーナー実機フィードバック3件（タイマー）
  //   ・「いったん止める」→「一時停止」（画面の文言。声でもこの語で止められること）
  //   ・「一時停止の後に音声操作で再開できない」→ 声に「再開」を足す
  //   ・「『もう一度』で読み上げは、1回目からになるので『読み上げ』に変更」
  // 画面のボタン名と声の語がずれると「案内どおり言っても黙る」（便CK/④-1と同型）ので、
  // **画面に出ている語をそのまま言えば効く**ことをここで固定する
  eq('便FC① 画面の「一時停止」をそのまま言っても止まる', matchVoiceCommand('一時停止'), 'stop')
  eq('便FC② 画面の「再開」をそのまま言うと動かし直す', matchVoiceCommand('再開'), 'resume')
  eq('便FC② かなで返る端末の「さいかい」も受ける', matchVoiceCommand('さいかい'), 'resume')
  eq('便FC② オーナー案の「スタート」も受ける', matchVoiceCommand('スタート'), 'resume')
  eq('便FC② かなの「すたーと」も受ける', matchVoiceCommand('すたーと'), 'resume')
  eq('便FC② 「タイマー再開」はタイマーの新規起動にしない', matchVoiceCommand('タイマー再開'), 'resume')
  eq('便FC③ 画面の「読み上げ」で読み上げ直す', matchVoiceCommand('読み上げ'), 'repeat')
  eq('便FC③ かなの「よみあげ」も受ける', matchVoiceCommand('よみあげ'), 'repeat')
  eq('便FC③ 言い慣れた「もう一回」も今までどおり受ける', matchVoiceCommand('もう一回'), 'repeat')
  // 「読み上げ」を語に足したので、「読み上げストップ」と続けて言われる形が生まれた。
  // 止める側を先に判定する（読み上げ直してから止まる、が起きない）。
  // 2026-08-15 便GS でオーナー指示「読み上げをストップする方法が、音声にない」を受け、
  // **「読み上げ」と一緒に言われた止める言葉は読み上げの停止**に変えた（'stop' → 'readStop'）。
  // 「ストップ」単独がタイマーである点（便EZ）は変えていない＝下の便GS②で固定する
  eq('便FC③→GS② 「読み上げストップ」は読み上げを止める', matchVoiceCommand('読み上げストップ'), 'readStop')
  eq('便FC③→GS② 「読み上げ止めて」も読み上げを止める', matchVoiceCommand('読み上げ止めて'), 'readStop')
  eq('便FC 「3分タイマー」は従来どおり新規起動のまま', matchVoiceCommand('3分タイマー'), 'timer')

  // 「再開」でどれを動かすか。止めるとき(pickVoiceStopTarget)の裏返しにそろえる。
  // **残りは pausedRemainingMs で比べる**（止まっている間 endsAt は過去のまま固まるので、
  // endsAt で比べると「止めた順」になり、次に鳴るはずだった1本から外れる）
  const resumeTimers = [
    // 肉じゃが(recipeId:1)の2本。止めた時点の残りは 5分 と 1分
    { id: 1, done: false, endsAt: 1, recipeId: 1, pausedRemainingMs: 300_000 },
    { id: 2, done: false, endsAt: 2, recipeId: 1, pausedRemainingMs: 60_000 },
    // 味噌汁(recipeId:2)。残り30秒＝全体でいちばん先に鳴るはずだった1本
    { id: 3, done: false, endsAt: 3, recipeId: 2, pausedRemainingMs: 30_000 },
  ]
  eq(
    '便FC② いま画面に出している料理の止めたタイマーを優先して動かす',
    pickVoiceResumeTarget(resumeTimers, 1)?.id,
    2,
  )
  eq(
    '便FC② その料理のものが無ければ、動かせばいちばん先に鳴る1本',
    pickVoiceResumeTarget(resumeTimers, 3)?.id,
    3,
  )
  eq(
    '便FC② どの料理を見ているか分からないときも、いちばん先に鳴る1本',
    pickVoiceResumeTarget(resumeTimers)?.id,
    3,
  )
  eq(
    '便FC② 動いているタイマーは「再開」で触らない（止まっているものだけ）',
    pickVoiceResumeTarget([{ id: 4, done: false, endsAt: 10, recipeId: 1 }], 1),
    undefined,
  )
  eq(
    '便FC② 終わったタイマーは動かさない（片付け＝削除は声で受けない）',
    pickVoiceResumeTarget([{ id: 5, done: true, endsAt: 10, recipeId: 1, pausedRemainingMs: 10 }], 1),
    undefined,
  )
  eq('便FC② 1本も止めていなければ何も動かさない', pickVoiceResumeTarget([], 1), undefined)
  eq('便DS⑤ 「0分タイマー」は時間として使わず次の候補へ譲る', resolveVoiceTimerSeconds('0分タイマー', 5, undefined), 300)
  eq(
    '便DS⑤ 手順の分数が0でも「決められない」に落ちる(0秒タイマーを作らない)',
    resolveVoiceTimerSeconds('タイマー', 0, 0),
    undefined,
  )

  // ---------- 2026-08-15 便GS: オーナー実機（iPhone SE2・Chrome）フィードバック2件 ----------
  //   ①「『戻って』『戻る』の他に『前へ』『前』も対応したい（ボタンと同じ表記にも対応したい）」
  //   ②「読み上げをストップする方法が、音声にない。タイマーの停止と混同しそうなので、
  //     片方優先するならタイマー」
  //
  // ①は**部分一致で「前」を足すと「名前」「手前」「この前」で手順が飛ぶ**。色の言葉
  // （matchVoiceColor）と同じ「短い発話の全体一致」で受ける＝発話まるごとが一致したときだけ。
  // 台所で理由の分からない手順飛びが起きると、原因を突き止める手段が利用者にない
  eq('便GS① 漢字1文字の「前」で手順を戻す', matchVoiceCommand('前'), 'prev')
  eq('便GS① かなの「まえ」も従来どおり戻す', matchVoiceCommand('まえ'), 'prev')
  eq('便GS① 「前に」も戻す', matchVoiceCommand('前に'), 'prev')
  eq('便GS① 端末が付ける句点は落としてから比べる', matchVoiceCommand('前。'), 'prev')
  eq('便GS① 画面のボタンどおりの「前へ」は従来どおり戻す', matchVoiceCommand('前へ'), 'prev')
  eq('便GS① かなの「まえへ」も戻す', matchVoiceCommand('まえへ'), 'prev')
  eq('便GS① 「戻る」は従来どおり戻す', matchVoiceCommand('戻る'), 'prev')
  eq('便GS① 「戻って」も従来どおり戻す', matchVoiceCommand('戻って'), 'prev')
  // 誤爆の固定（部分一致に戻したらここが赤になる）
  eq('便GS① 「名前」では戻らない', matchVoiceCommand('名前'), undefined)
  eq('便GS① かなで返る端末の「なまえ」でも戻らない', matchVoiceCommand('なまえ'), undefined)
  eq('便GS① 「手前」では戻らない', matchVoiceCommand('手前'), undefined)
  eq('便GS① かなで返る端末の「てまえ」でも戻らない', matchVoiceCommand('てまえ'), undefined)
  eq('便GS① 「この前」では戻らない', matchVoiceCommand('この前'), undefined)
  eq('便GS① かなで返る端末の「このまえ」でも戻らない', matchVoiceCommand('このまえ'), undefined)
  eq('便GS① 「名前をつけて保存」でも戻らない', matchVoiceCommand('名前をつけて保存'), undefined)
  eq('便GS① 「手前に引く」でも戻らない', matchVoiceCommand('手前に引く'), undefined)
  eq('便GS① 「この前の残り」でも戻らない', matchVoiceCommand('この前の残り'), undefined)

  // ①の続き: 並行調理ナビの調理中モードの左上にある「最初の手順へ」も、ボタンの表記
  // そのままで言えるようにする（オーナー「ボタンと同じ表記にも対応したい」）。
  // 「最初」を部分一致にすると手順文の「最初に玉ねぎを炒める」で飛ぶので、ここも全体一致
  eq('便GS① 画面のボタンどおりの「最初の手順へ」で先頭へ戻る', matchVoiceCommand('最初の手順へ'), 'first')
  eq('便GS① 「最初の手順」でも同じ', matchVoiceCommand('最初の手順'), 'first')
  eq('便GS① 「最初へ」でも同じ', matchVoiceCommand('最初へ'), 'first')
  eq('便GS① 「最初」だけでも同じ', matchVoiceCommand('最初'), 'first')
  eq('便GS① かなで返る端末の「さいしょ」も受ける', matchVoiceCommand('さいしょ'), 'first')
  eq('便GS① かなの「さいしょのてじゅんへ」も受ける', matchVoiceCommand('さいしょのてじゅんへ'), 'first')
  eq('便GS① 手順文の「最初に玉ねぎを炒める」では飛ばない', matchVoiceCommand('最初に玉ねぎを炒める'), undefined)
  eq('便GS① 「最初は弱火で」でも飛ばない', matchVoiceCommand('最初は弱火で'), undefined)

  // ②読み上げを止める声。**「読み上げ」の語と一緒に言われたときだけ**読み上げを止める。
  // オーナー指示「タイマーの停止と混同しそうなので、片方優先するならタイマー」に従い、
  // **「ストップ」単独はタイマーのまま**（2026-08-10 便EZ でオーナー指摘を受けて直した挙動）。
  // ここが今回いちばん壊してはいけない場所
  eq('便GS② 「ストップ」単独は今までどおりタイマー', matchVoiceCommand('ストップ'), 'stop')
  eq('便GS② かなの「すとっぷ」単独もタイマー', matchVoiceCommand('すとっぷ'), 'stop')
  eq('便GS② 「止めて」単独もタイマー', matchVoiceCommand('止めて'), 'stop')
  eq('便GS② 「とめて」単独もタイマー', matchVoiceCommand('とめて'), 'stop')
  eq('便GS② 「停止」単独もタイマー', matchVoiceCommand('停止'), 'stop')
  eq('便GS② 画面の「一時停止」もタイマー', matchVoiceCommand('一時停止'), 'stop')
  eq('便GS② 「タイマーストップ」もタイマー', matchVoiceCommand('タイマーストップ'), 'stop')
  eq('便GS② 「タイマー止めて」もタイマー', matchVoiceCommand('タイマー止めて'), 'stop')
  // 「読み上げ」と一緒に言われたときだけ読み上げが止まる
  eq('便GS② 「読み上げストップ」は読み上げを止める', matchVoiceCommand('読み上げストップ'), 'readStop')
  eq('便GS② 「読み上げ止めて」も読み上げを止める', matchVoiceCommand('読み上げ止めて'), 'readStop')
  eq('便GS② 「読み上げやめて」も読み上げを止める', matchVoiceCommand('読み上げやめて'), 'readStop')
  eq('便GS② 「読み上げをやめて」も受ける', matchVoiceCommand('読み上げをやめて'), 'readStop')
  eq('便GS② 「読み上げ停止」も受ける', matchVoiceCommand('読み上げ停止'), 'readStop')
  eq('便GS② 「読み上げ中止」も受ける', matchVoiceCommand('読み上げ中止'), 'readStop')
  eq('便GS② かなで返る端末の「よみあげすとっぷ」も受ける', matchVoiceCommand('よみあげすとっぷ'), 'readStop')
  eq('便GS② かなの「よみあげやめて」も受ける', matchVoiceCommand('よみあげやめて'), 'readStop')
  // 読み上げ側の従来の言い方は変えていない
  eq('便GS② 「読み上げ」単独は今までどおり読み上げ直す', matchVoiceCommand('読み上げ'), 'repeat')
  eq('便GS② かなの「よみあげ」単独も読み上げ直す', matchVoiceCommand('よみあげ'), 'repeat')
  eq('便GS② 「読み上げて」も読み上げ直す', matchVoiceCommand('読み上げて'), 'repeat')
  eq('便GS② 「もう一回」も今までどおり読み上げ直す', matchVoiceCommand('もう一回'), 'repeat')
  eq('便GS② 「もう一度読み上げて」も読み上げ直す', matchVoiceCommand('もう一度読み上げて'), 'repeat')
  // 判定の順番を変えた（読み上げの組を再開・ストップより前に出した）ので、
  // 先に決まっていたものが動いていないことを確かめる
  // 「次」を全体一致にした（2026-08-15 オーナー指示）ので、複合の言い方は次へにならない
  eq('便GS② 「次へ」単独は進む', matchVoiceCommand('次へ'), 'next')
  eq('便GS② 独り言では進まない（次に塩を…）', matchVoiceCommand('次に塩を入れるんだっけ'), undefined)
  eq('便GS② 独り言では進まない（次の手順が長い）', matchVoiceCommand('次の手順が長いな'), undefined)
  eq('便GS② 「次」単独も進む（オーナーが実機で確認した言い方）', matchVoiceCommand('次'), 'next')
  eq('便GS② 「再開」は従来どおり動かし直す', matchVoiceCommand('再開'), 'resume')
  eq('便GS② 「タイマー再開」も従来どおり', matchVoiceCommand('タイマー再開'), 'resume')
  eq('便GS② 「3分タイマー」は従来どおり新規起動', matchVoiceCommand('3分タイマー'), 'timer')
  eq('便GS② どれでもない言葉は今までどおり無反応', matchVoiceCommand('こんばんは'), undefined)
}

// ---------- 便DV-6/7: 「料理中」の設定の注記の出し分け(2026-08-04 オーナー指示) ----------
// 対応ブラウザには「対応ブラウザのみ」を出さない・許可の案内はスイッチONで許可が無いときだけ
{
  eq('DV-CAP 非対応のときだけ「対応していません」を出す', shouldShowUnsupportedNote(false), true)
  eq('DV-CAP 対応ブラウザには注記自体を出さない', shouldShowUnsupportedNote(true), false)

  eq(
    'DV-CAP ONで許可が下りていないときだけ案内を出す',
    shouldShowPermissionHelp(true, true, 'blocked'),
    true,
  )
  eq(
    'DV-CAP OFFのあいだは出さない(常時出す注記にしない)',
    shouldShowPermissionHelp(false, true, 'blocked'),
    false,
  )
  eq('DV-CAP 許可済みなら出さない', shouldShowPermissionHelp(true, true, 'granted'), false)
  eq(
    'DV-CAP まだ調べていない/調べようがないときは出さない',
    shouldShowPermissionHelp(true, true, 'unknown'),
    false,
  )
  eq(
    'DV-CAP 非対応のときは許可の案内ではなく「対応していません」だけを出す',
    shouldShowPermissionHelp(true, false, 'blocked'),
    false,
  )
}

// ---------- 便DW-1: 振動(Vibration API)の対応可否(2026-08-08 オーナー実機報告) ----------
// iPhone(Safari)はVibration APIを持たないので、アプリが何をしても振動しない。
// 「振動しない端末なのか、設定が悪いのか」を切り分けられるよう、非対応のときだけ注記を出す。
// navigator.vibrate の有無だけで判定する＝UserAgent文字列で端末を当てにいかない(偽装・変更に弱い)
{
  const orig = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const setNav = (value) =>
    Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })
  try {
    setNav({ vibrate: () => true })
    eq('DW-VIB vibrateを持つブラウザは対応と判定する', vibrationSupported(), true)
    eq('DW-VIB 対応ブラウザには注記を出さない', shouldShowUnsupportedNote(vibrationSupported()), false)

    // iOS Safari: navigator はあるが vibrate が無い
    setNav({})
    eq('DW-VIB vibrateが無いブラウザ(iOS Safari)は非対応', vibrationSupported(), false)
    eq('DW-VIB 非対応のときだけ注記を出す', shouldShowUnsupportedNote(vibrationSupported()), true)

    // vibrate という名前のプロパティがあっても関数でなければ呼べない(非対応扱い)
    setNav({ vibrate: true })
    eq('DW-VIB vibrateが関数でなければ非対応扱い', vibrationSupported(), false)
  } finally {
    if (orig) Object.defineProperty(globalThis, 'navigator', orig)
    else delete globalThis.navigator
  }
}

// ---------- 便EL: 調理中セッション（並行調理ナビの全画面表示）のカーソル遷移 ----------
// docs/69「状態の持ち方」。書ける状態はカーソル1つだけで、済んだ手順・各品の次手順・段取りは
// すべてここから導く。遷移表を先に固定してから画面を作る（docs/10 3章）。
{
  // 3品を並行に組んだ段取りの縮小版。stepIndex が -1 の行は「ナビが足した工程（湯を沸かす）」
  const plan = [
    { recipeId: 10, stepIndex: 0, text: '玉ねぎをみじん切りにする。' }, // 0
    { recipeId: 20, stepIndex: -1, text: '湯を沸かす' }, //               1
    { recipeId: 20, stepIndex: 0, text: 'にんじんを2分ゆでる。' }, //     2
    { recipeId: 10, stepIndex: 1, text: '鍋で15分煮る。' }, //            3
    { recipeId: 30, stepIndex: 0, text: 'ボウルに調味料を入れて混ぜ、マリネ液を作る。' }, // 4
    { recipeId: 10, stepIndex: 2, text: '器に盛る。' }, //                5
  ]
  const ids = [10, 20, 30]
  const at = (i) => ({ recipeId: plan[i].recipeId, stepIndex: plan[i].stepIndex })

  // 位置の特定（識別子は「レシピID＋レシピ内の手順の添字」。段取りの通し番号では持たない）
  eq('EL-CUR 先頭の位置', findCursorIndex(plan, at(0)), 0)
  eq('EL-CUR ナビが足した工程（添字-1）も指せる', findCursorIndex(plan, at(1)), 1)
  eq('EL-CUR 段取りに無い手順は-1', findCursorIndex(plan, { recipeId: 10, stepIndex: 9 }), -1)
  eq('EL-CUR 別レシピの同じ添字と取り違えない', findCursorIndex(plan, { recipeId: 30, stepIndex: 1 }), -1)
  eq('EL-CUR カーソル未設定は-1', findCursorIndex(plan, undefined), -1)
  eq('EL-CUR 同じ手順の判定', cursorEquals(at(3), { recipeId: 10, stepIndex: 1 }), true)
  eq('EL-CUR レシピが違えば別の手順', cursorEquals(at(3), { recipeId: 20, stepIndex: 1 }), false)
  eq('EL-CUR 片方が未設定なら常にfalse', cursorEquals(undefined, at(0)), false)

  // 開始
  eq('EL-CUR 開始は段取りの先頭', startCursor(plan), { recipeId: 10, stepIndex: 0 })
  eq('EL-CUR 段取りが空なら開始できない', startCursor([]), undefined)

  // 遷移表: 次へ
  eq('EL-CUR 次へ（先頭→2番目）', advanceCursor(plan, at(0)), { recipeId: 20, stepIndex: -1 })
  eq('EL-CUR 次へ（ナビが足した工程→本来の手順）', advanceCursor(plan, at(1)), { recipeId: 20, stepIndex: 0 })
  eq('EL-CUR 次へ（末尾では動かない）', advanceCursor(plan, at(5)), undefined)
  eq('EL-CUR 次へ（段取りに無い手順からは動かない）', advanceCursor(plan, { recipeId: 10, stepIndex: 9 }), undefined)

  // 遷移表: 戻る
  eq('EL-CUR 戻る（2番目→先頭）', backCursor(plan, at(1)), { recipeId: 10, stepIndex: 0 })
  eq('EL-CUR 戻る（先頭では動かない）', backCursor(plan, at(0)), undefined)
  eq('EL-CUR 戻る（段取りに無い手順からは動かない）', backCursor(plan, { recipeId: 99, stepIndex: 0 }), undefined)
  // 「次へ→戻って」で必ず元の手順に帰る（オーナーが挙げた懸念「戻ってと言っても違う手順にとばされる」）
  for (let i = 0; i < plan.length - 1; i++) {
    eq(
      `EL-CUR 次へ→戻るで元の手順に帰る(${i})`,
      backCursor(plan, advanceCursor(plan, at(i))),
      at(i),
    )
  }
  // 「戻って→次へ」も同じ手順に帰る（手順飛ばしが起きない）
  for (let i = 1; i < plan.length; i++) {
    eq(
      `EL-CUR 戻る→次へで元の手順に帰る(${i})`,
      advanceCursor(plan, backCursor(plan, at(i))),
      at(i),
    )
  }

  // 端の判定
  eq('EL-CUR 先頭にいる', isCursorAtFirst(plan, at(0)), true)
  eq('EL-CUR 先頭にいない', isCursorAtFirst(plan, at(1)), false)
  eq('EL-CUR 末尾にいる', isCursorAtLast(plan, at(5)), true)
  eq('EL-CUR 末尾にいない', isCursorAtLast(plan, at(4)), false)
  eq('EL-CUR 段取りに無い手順は末尾扱いにしない', isCursorAtLast(plan, { recipeId: 10, stepIndex: 9 }), false)

  // 復元（再読み込み時）。見つからなければ推測せず undefined＝段取りの一覧表示に戻す
  eq('EL-CUR 復元できる', resolveCursor(plan, { recipeId: 20, stepIndex: 0 }), { recipeId: 20, stepIndex: 0 })
  eq('EL-CUR 復元の失敗（手順が消えた）は推測しない', resolveCursor(plan, { recipeId: 20, stepIndex: 5 }), undefined)
  eq('EL-CUR 復元の失敗（レシピが段取りから外れた）', resolveCursor(plan, { recipeId: 40, stepIndex: 0 }), undefined)
  eq('EL-CUR 覚えていない状態からの復元', resolveCursor(plan, undefined), undefined)

  // 開き直し（2026-08-10 便FC・オーナー実機「一回閉じて再度開くと①に戻ってしまう。
  // 前回閉じた時の手順から再開したい」）。閉じてもカーソルを捨てなくなったので、
  // 「覚えていればそこから・無ければ先頭から」をここで固定する
  eq('FC-CUR 覚えていた手順が段取りにあれば、そこから再開する', resumeCursor(plan, at(3)), at(3))
  eq('FC-CUR ナビが足した工程からでも再開できる', resumeCursor(plan, at(1)), at(1))
  eq('FC-CUR 覚えていなければ先頭から', resumeCursor(plan, undefined), at(0))
  eq(
    'FC-CUR 覚えていた手順が段取りから消えていたら先頭から（近い手順を当てにいかない）',
    resumeCursor(plan, { recipeId: 10, stepIndex: 9 }),
    at(0),
  )
  eq('FC-CUR 段取りが空なら開けない', resumeCursor([], at(0)), undefined)

  // 各品の次の手順＝カーソルの投影（済みセットを持たない）
  eq(
    'EL-NEXT 先頭にいるとき、他2品の次の手順',
    nextStepsByRecipe(plan, at(0), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [20, -1],
      [30, 0],
    ],
  )
  eq(
    'EL-NEXT 進むと投影も進む（20の湯沸かしは済み扱いになる）',
    nextStepsByRecipe(plan, at(1), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [10, 1],
      [30, 0],
    ],
  )
  eq(
    'EL-NEXT 残っていない品は undefined（作り終えた表示にする）',
    nextStepsByRecipe(plan, at(5), ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    [
      [20, undefined],
      [30, undefined],
    ],
  )
  eq('EL-NEXT いま開いている品は下部に出さない', nextStepsByRecipe(plan, at(0), ids).some((x) => x.recipeId === 10), false)
  eq('EL-NEXT 並びはレシピの色の順で固定', nextStepsByRecipe(plan, at(4), ids).map((x) => x.recipeId), [10, 20])
  eq('EL-NEXT カーソルが段取りに無ければ何も出さない', nextStepsByRecipe(plan, { recipeId: 99, stepIndex: 0 }, ids), [])

  // ---------- 便GQ: タイマーの手順は「見るだけ」＝現在地を動かさない（2026-08-15） ----------
  // オーナー判断A案「タイマーが鳴る手順は、すでに通り過ぎた手順。やりたいのは『その手順を読んで、
  // その一手をやる』ことであって、進捗を戻すことではない」。
  // 便FC〜便GO は、タイマーの窓の「手順◯を開く」でカーソルそのものを動かしていた。
  // このアプリは「済んだ手順＝現在地より前」で数える（docs/69 の不変条件）ので、
  // 現在地が戻ると**通り過ぎた手順がまるごと「まだやっていない」に巻き戻り**、
  // 他の品の「次の手順」の表示もつられて巻き戻っていた（戻す手立ては「次へ」の押し直しだけ）。
  {
    /**
     * 利用者が確かめたいこと＝**タイマーから手順を見たあとも、どこに居るかが変わっていない**。
     * 「どこに居るか」は画面の文字ではなく、この2つの導出で見る:
     *   ①段取りの中の位置（＝済んだ手順がどこまでか）②各品の次の手順（その裏返しの投影）
     */
    const whereAmI = (cursor) => ({
      index: findCursorIndex(plan, cursor),
      next: nextStepsByRecipe(plan, cursor, ids).map((x) => [x.recipeId, x.item?.stepIndex]),
    })
    // 段取りの先頭でタイマーを始め、そこから何回か「次へ」を押して進んだところ
    const timerStep = at(0)
    const cooking = at(4)
    const before = whereAmI(cooking)
    const landing = resolveTimerStepLanding(plan, cooking, timerStep)
    eq('GQ-PEEK 通り過ぎた手順のタイマーは「見るだけ」で開く', landing, {
      kind: 'peek',
      target: timerStep,
    })
    eq('GQ-PEEK 見たあとも、どこに居るかは1つも変わらない', whereAmI(cooking), before)
    // 行き先に「新しい現在地」を含めない＝呼び出し側にカーソルを動かす材料を渡さない
    // （この1行が崩れたら、巻き戻しの不具合を作れる形に戻っている）
    eq('GQ-PEEK 行き先に新しい現在地は含まれない', Object.keys(landing).sort(), ['kind', 'target'])
    // 現在地より**後ろ**の手順のタイマー（段取りの一覧から先の手順のタイマーを始めた場合）も、
    // 同じく見るだけ。前へ飛ばすと、今度は**やっていない手順が「済んだ」に化ける**
    eq('GQ-PEEK 現在地より後ろの手順のタイマーも「見るだけ」（前へも動かさない）', {
      landing: resolveTimerStepLanding(plan, at(1), at(4)),
      where: whereAmI(at(1)),
    }, {
      landing: { kind: 'peek', target: at(4) },
      where: whereAmI(at(1)),
    })
    // いま開いている手順のタイマーでも扱いは同じ（押しても何も動かない＝押し損じが無害）
    eq('GQ-PEEK いま開いている手順のタイマーでも同じ扱い', resolveTimerStepLanding(plan, at(2), at(2)), {
      kind: 'peek',
      target: at(2),
    })
    // 調理していない（カーソルが無い）ときは今までどおり段取りの一覧の該当カードへ送る。
    // 巻き戻す現在地が無いので、こちらの動きは変えない
    eq('GQ-PEEK 調理していないときは段取りの一覧へ送る', resolveTimerStepLanding(plan, undefined, at(0)), {
      kind: 'list',
    })
    // 覚えていた現在地が組み直した段取りから消えていたら、推測せず一覧へ（docs/69「復元」）
    eq(
      'GQ-PEEK 現在地が段取りから消えていたら一覧へ（近い手順を当てにいかない）',
      resolveTimerStepLanding(plan, { recipeId: 10, stepIndex: 9 }, at(0)),
      { kind: 'list' },
    )
    // タイマーの手順のほうが段取りから消えている（レシピを直した等）ときも一覧へ
    eq(
      'GQ-PEEK タイマーの手順が段取りに無ければ一覧へ',
      resolveTimerStepLanding(plan, cooking, { recipeId: 20, stepIndex: 7 }),
      { kind: 'list' },
    )
    eq('GQ-PEEK 手順を指していないタイマーは一覧へ', resolveTimerStepLanding(plan, cooking, undefined), {
      kind: 'list',
    })
    // 段取りのどの位置から、どの手順のタイマーを開いても、現在地は1つも動かない（総当たり）
    for (let i = 0; i < plan.length; i++) {
      for (let j = 0; j < plan.length; j++) {
        const snapshot = whereAmI(at(i))
        resolveTimerStepLanding(plan, at(i), at(j))
        eq(`GQ-PEEK 現在地(${i})から手順(${j})を見ても居場所が動かない`, whereAmI(at(i)), snapshot)
      }
    }
  }

  // 畳んだ1行の書式（2026-08-09 オーナー決定「文頭…文末」）
  eq('EL-FOLD 上限内はそのまま', collapseStepText('玉ねぎをみじん切りにする。', 20), '玉ねぎをみじん切りにする。')
  eq(
    // 2026-08-09 便ES（オーナー指示E-8）: 語の途中で切らず、文節の切れ目でだけ切る。
    // 「オリーブオイル」の途中で切れる代わりに文頭が短くなり、余りは文末側に回す
    'EL-FOLD 長い手順は文節の切れ目で文頭と文末を残して中央を省く',
    collapseStepText('ボウルにオリーブオイルと酢、塩こしょうを入れてよく混ぜ、マリネ液を作る。', 20),
    'ボウルに…よく混ぜ、マリネ液を作る。',
  )
  eq(
    'EL-FOLD 文節の切れ目で切る（「みじん切りに」の途中で切らない）',
    collapseStepText('玉ねぎをみじん切りにしてから、フライパンでしんなりするまで炒める。', 20),
    '玉ねぎをみじん切りに…炒める。',
  )
  eq('EL-FOLD 省略しても上限の文字数を超えない', [...collapseStepText('あ'.repeat(80), 20)].length, 20)
  eq('EL-FOLD 前後の空白は落とす', collapseStepText('  器に盛る。  ', 20), '器に盛る。')
  eq('EL-FOLD 文末の残す量は指定できる', collapseStepText('あいうえおかきくけこさしすせそたちつてと', 11, 5), 'あいうえお…たちつてと')
  eq('EL-FOLD 上限ちょうどは省略しない', collapseStepText('あ'.repeat(20), 20), 'あ'.repeat(20))
  eq('EL-FOLD 1文字超えたら省略する', [...collapseStepText('あ'.repeat(21), 20)].join('').includes('…'), true)
}

// ---------- 便EL: 調理中は「作った記録」を段取りへ逆流させない（記録は一方通行） ----------
// docs/69 の不変条件。2026-08-09 に実発した「並行調理中に1品だけ『作った！』すると
// 段取りが崩壊する」と同型の事故を、実行中は母集合を動かさないことで封じる。
{
  eq(
    'EL-ONEWAY 調理中は1品がcookedになっても段取りの母集合が変わらない',
    reconcileSelectedIdsForSession([1, 2, 3], [1, 3], true),
    [1, 2, 3],
  )
  eq(
    'EL-ONEWAY 調理中でなければ従来どおり候補から消えた品を落とす',
    reconcileSelectedIdsForSession([1, 2, 3], [1, 3], false),
    [1, 3],
  )
  eq(
    'EL-ONEWAY 調理中に候補が全部消えても段取りは残る',
    reconcileSelectedIdsForSession([1, 2, 3], [], true),
    [1, 2, 3],
  )
  eq(
    'EL-ONEWAY 調理中でなければ従来の整合と同じ結果になる',
    reconcileSelectedIdsForSession([3, 1, 2], [1, 2, 3], false),
    reconcileSelectedIds([3, 1, 2], [1, 2, 3]),
  )
}

// ---------- 便ES: 候補が「読み込み中」のうちは選択を1品も落とさない ----------
// 2026-08-09 オーナー実機報告の重大バグ「段取りが消える／『今日の献立にない品を、
// 組み合わせから外しました。』が出る」の再発防止。今日の献立の候補は
// 「今日の献立リスト」「今週の献立の予定」「レシピ本体」の3つが揃って初めて決まる。
// 1本でも読み込み中なら候補は"まだ分からない"のであって"ゼロ"ではない。
{
  eq(
    'ES-LOADING 候補が未読込(undefined)なら選択をそのまま残す',
    reconcileSelectedIdsForSession([1, 2, 3], undefined, false),
    [1, 2, 3],
  )
  eq(
    'ES-LOADING 候補が未読込なら調理中でも選択をそのまま残す',
    reconcileSelectedIdsForSession([1, 2, 3], undefined, true),
    [1, 2, 3],
  )
  eq(
    'ES-LOADING 空配列(＝読み終えて候補ゼロ)は従来どおり落とす',
    reconcileSelectedIdsForSession([1, 2, 3], [], false),
    [],
  )
}

// ---------- 便FR: 覚えていた選択が1品も残らなかったら、初めて開いたときと同じ状態にする ----------
// 2026-08-12 利用者テストの実操作再現「今日の献立に3品入れて段取りを作り、3品とも別の品に
// 入れ替えてナビへ戻ると『0品を選択中』で『段取りを作る』が押せない。もう一度どこかへ行って
// 戻ると3品が選ばれて押せる」＝同じ画面が来るたびに違う状態で開いていた。
// 真因: 覚えていた選択があると初回の自動選択を止める札が立ち、覚えていた選択が整合で全部
// 落ちた後も札が立ったままだった（次に開くと覚え書きが消えていて初回扱いになる＝結果が揺れる）。
{
  eq('FR-RESELECT 選べる品数の上限は3品', COOK_NAVI_MAX_RECIPES, 3)
  eq('FR-RESELECT 初期選択は今日の献立の先頭3品', pickDefaultSelectedIds([7, 8, 9, 10]), [7, 8, 9])
  eq('FR-RESELECT 今日の献立が1品なら1品だけ', pickDefaultSelectedIds([7]), [7])
  eq('FR-RESELECT 今日の献立が空なら0品', pickDefaultSelectedIds([]), [])

  eq(
    'FR-RESELECT 1品でも残っていれば、その選択をそのまま使う',
    resolveCookNaviSelection([1, 2, 3], [3, 8, 9], false),
    [3],
  )
  eq(
    'FR-RESELECT 残る品の順番（＝色の順）も変えない',
    resolveCookNaviSelection([3, 1, 2], [1, 2, 3], false),
    [3, 1, 2],
  )
  eq(
    'FR-RESELECT 覚えていた選択が全部落ちたら、今日の献立の先頭3品を選ぶ（本題）',
    resolveCookNaviSelection([1, 2, 3], [7, 8, 9, 10], false),
    [7, 8, 9],
  )
  eq(
    'FR-RESELECT 全部落ちて今日の献立が1品なら1品を選ぶ',
    resolveCookNaviSelection([1, 2, 3], [7], false),
    [7],
  )
  eq(
    'FR-RESELECT 全部落ちて今日の献立も空なら0品のまま',
    resolveCookNaviSelection([1, 2, 3], [], false),
    [],
  )
  eq(
    'FR-RESELECT 自分で全部外した状態は勝手に選び直さない',
    resolveCookNaviSelection([], [7, 8, 9], false),
    [],
  )
  eq(
    'FR-RESELECT 候補が未読込(undefined)のときは選択に触らない',
    resolveCookNaviSelection([1, 2, 3], undefined, false),
    [1, 2, 3],
  )
  eq(
    'FR-RESELECT 候補が未読込で1品も選んでいなければ0品のまま',
    resolveCookNaviSelection([], undefined, false),
    [],
  )
  eq(
    'FR-RESELECT 調理中は1品も落とさない＝選び直しも起きない（docs/69 記録は一方通行）',
    resolveCookNaviSelection([1, 2, 3], [7, 8, 9], true),
    [1, 2, 3],
  )
  eq(
    'FR-RESELECT 一部だけ落ちたときは残りだけ（足して3品にしない）',
    resolveCookNaviSelection([1, 2, 3], [1, 8, 9], false),
    [1],
  )
  // 落ちた品が無ければ結果は入力そのまま＝画面側は「変わっていない」と判断できる
  eq(
    'FR-RESELECT 何も落ちなければ入力のまま',
    resolveCookNaviSelection([1, 2], [1, 2, 3], false),
    [1, 2],
  )
}

// ---------- 便EL: 調理中の手順の覚え書き（sessionStorage の読み取り） ----------
{
  eq(
    'EL-SESSION 調理中の手順を覚えられる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: false, current: { recipeId: 2, stepIndex: 0 } }),
    ),
    {
      selectedIds: [1, 2],
      showTimeline: true,
      trialActive: false,
      current: { recipeId: 2, stepIndex: 0 },
    },
  )
  eq(
    // 2026-08-12 便FT: 全画面を開いていたかどうかは覚え書きに入れない（別の置き場に移した）。
    // 「どこまで進んだか」は端末に残し、「全画面を開いていたか」はアプリを閉じるまで
    // ＝アプリを開き直したときは、必ず段取りの一覧に着地して「続きから見る」で本人が開く
    'FC-SESSION 全画面の開閉は覚え書きに混ぜない（位置だけを覚える）',
    parseCookNaviSession(
      JSON.stringify({
        selectedIds: [1, 2],
        showTimeline: true,
        trialActive: false,
        current: { recipeId: 2, stepIndex: 0 },
        sessionOpen: true,
      }),
    ).sessionOpen,
    undefined,
  )
  eq(
    'FC-SESSION 閉じていても調理中の手順は残る（開き直すと続きから）',
    parseCookNaviSession(
      JSON.stringify({
        selectedIds: [1, 2],
        showTimeline: true,
        trialActive: false,
        current: { recipeId: 2, stepIndex: 3 },
      }),
    )?.current,
    { recipeId: 2, stepIndex: 3 },
  )
  eq(
    'EL-SESSION ナビが足した工程（添字-1）も覚えられる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: false, current: { recipeId: 2, stepIndex: -1 } }),
    )?.current,
    { recipeId: 2, stepIndex: -1 },
  )
  eq(
    'EL-SESSION 壊れたカーソルは覚えていない扱い',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: true, current: { recipeId: 'x', stepIndex: 0 } }),
    )?.current,
    undefined,
  )
  eq(
    'EL-SESSION 段取りを表示していないのに調理中、という不整合は捨てる',
    parseCookNaviSession(
      JSON.stringify({ selectedIds: [1, 2], showTimeline: false, current: { recipeId: 2, stepIndex: 0 } }),
    )?.current,
    undefined,
  )
  eq(
    'EL-SESSION 旧形式（カーソルなし）はそのまま読める',
    parseCookNaviSession(JSON.stringify({ selectedIds: [1, 2], showTimeline: true, trialActive: true })),
    { selectedIds: [1, 2], showTimeline: true, trialActive: true },
  )
}

// ---------- 便FI: 色を言うとその品の手順に移る（docs/69 第3段） ----------
// オーナー要望「並行調理ナビ調理中モードの、色で手順入れ替えはいつ実装しますか？」。
// docs/69 では第3段（色で実行を引き寄せる）を「実機の要望が出るまでやらない」と保留にしていた。
// 実装にあたっての危ないところは2つで、どちらもここで固定する。
//   ①語彙 … 原文の「赤・青・緑」ではなく**画面の実物と同じ 青・緑・ピンク**を使う
//            （画面と語彙が食い違うと「赤と言ったのに青が動く」事故になる）
//   ②誤爆 … 「青ねぎを切る」「緑黄色野菜を加える」で手順が飛ばないこと。
//            そのため色は**判定順のいちばん最後**・**発話まるごとの一致**に限る
{
  // --- ① 画面に出す色名と、声で受ける語が同じところから来ている（ばらけない） ---
  eq('FI-COLOR 色の数と色名の数がそろっている', NAVI_COLOR_WORDS.length, NAVI_RECIPE_COLORS.length)
  eq('FI-COLOR 1品目は青', naviColorWord(0), '青')
  eq('FI-COLOR 2品目は緑', naviColorWord(1), '緑')
  eq('FI-COLOR 3品目はピンク（原文の「赤」ではなく画面の実物に合わせる）', naviColorWord(2), 'ピンク')
  eq('FI-COLOR 声の語形も色ごとに1組ずつある', NAVI_COLOR_SPEECH.length, NAVI_COLOR_WORDS.length)
  eq(
    'FI-COLOR 画面に出す色名は、そのまま言っても通る',
    NAVI_COLOR_WORDS.map((word, i) => NAVI_COLOR_SPEECH[i].includes(word)),
    [true, true, true],
  )
  eq('FI-COLOR 「赤」は語彙に入れない（画面に赤の品が無いため）', matchVoiceColor('赤'), undefined)
  eq('FI-COLOR 「あか」も入れない', matchVoiceColor('あか'), undefined)

  // --- ② 語形（端末が漢字・かな・カナのどれで返しても同じ品に当たる） ---
  eq('FI-VOICE 「青」', matchVoiceColor('青'), 0)
  eq('FI-VOICE 「あお」', matchVoiceColor('あお'), 0)
  eq('FI-VOICE 「アオ」', matchVoiceColor('アオ'), 0)
  eq('FI-VOICE 「青色」', matchVoiceColor('青色'), 0)
  eq('FI-VOICE 「緑」', matchVoiceColor('緑'), 1)
  eq('FI-VOICE 「みどり」', matchVoiceColor('みどり'), 1)
  eq('FI-VOICE 「ミドリ」', matchVoiceColor('ミドリ'), 1)
  eq('FI-VOICE 「緑色」', matchVoiceColor('緑色'), 1)
  eq('FI-VOICE 「ピンク」', matchVoiceColor('ピンク'), 2)
  eq('FI-VOICE 「ぴんく」', matchVoiceColor('ぴんく'), 2)
  eq('FI-VOICE 「ピンク色」', matchVoiceColor('ピンク色'), 2)
  eq('FI-VOICE 端末が付ける句点は落として比べる', matchVoiceColor('青。'), 0)
  eq('FI-VOICE 前後の空白も落として比べる', matchVoiceColor(' 緑 '), 1)
  eq('FI-VOICE 何も聞き取れていないときは当てない', matchVoiceColor(''), undefined)

  // --- ③ 誤爆させない（ここが第3段を保留にしていた理由。全体一致だけに限る） ---
  eq('FI-MISS 「青ねぎ」で手順を飛ばさない', matchVoiceColor('青ねぎ'), undefined)
  eq('FI-MISS 「青ねぎを切る」でも飛ばさない', matchVoiceColor('青ねぎを切る'), undefined)
  eq('FI-MISS 「青ねぎを散らす」でも飛ばさない', matchVoiceColor('青ねぎを散らす'), undefined)
  eq('FI-MISS 「青のり」でも飛ばさない', matchVoiceColor('青のり'), undefined)
  eq('FI-MISS 「緑黄色野菜」で飛ばさない', matchVoiceColor('緑黄色野菜'), undefined)
  eq('FI-MISS 「緑黄色野菜を加える」でも飛ばさない', matchVoiceColor('緑黄色野菜を加える'), undefined)
  eq('FI-MISS 「みどり色の野菜」でも飛ばさない', matchVoiceColor('みどり色の野菜'), undefined)
  eq('FI-MISS 「ピンクペッパーをふる」で飛ばさない', matchVoiceColor('ピンクペッパーをふる'), undefined)
  eq('FI-MISS 「ピンクサーモン」でも飛ばさない', matchVoiceColor('ピンクサーモン'), undefined)
  eq('FI-MISS 手順の読み上げのような長い発話では動かない', matchVoiceColor('青ねぎと緑の野菜を切る'), undefined)

  // --- ④ 判定順（色はいちばん最後）。色の語をコマンド側に混ぜない ---
  eq('FI-ORDER 「青」はコマンドとしては当たらない（色は別で最後に見る）', matchVoiceCommand('青'), undefined)
  eq('FI-ORDER 「みどり」も同じ（「もどって」と取り違えない）', matchVoiceCommand('みどり'), undefined)
  eq('FI-ORDER 「ピンク」も同じ', matchVoiceCommand('ピンク'), undefined)
  // 2026-08-15 オーナー指示で「次」を全体一致にしたため、複合は当たらない＝何も起きない。
  // 何も起きないほうが安全という判断（「ピンクの次へ」が「進む」なのか
  // 「ピンクの手順を開く」なのか、発話からは決められないため）
  eq('FI-ORDER 「ピンクの次へ」は複合なので当たらない', matchVoiceCommand('ピンクの次へ'), undefined)
  eq('FI-ORDER 「戻って」を含む発話も同じ', matchVoiceCommand('青に戻って'), 'prev')
  eq('FI-ORDER 「3分タイマー」は従来どおりタイマーのまま', matchVoiceCommand('3分タイマー'), 'timer')

  // --- ⑤ 行き先（下部にその色で出ている行と同じ手順に移る） ---
  const fiPlan = [
    { recipeId: 10, stepIndex: 0 }, //  0 青
    { recipeId: 20, stepIndex: -1 }, // 1 緑（ナビが足した湯沸かし）
    { recipeId: 20, stepIndex: 0 }, //  2 緑
    { recipeId: 10, stepIndex: 1 }, //  3 青
    { recipeId: 30, stepIndex: 0 }, //  4 ピンク
    { recipeId: 10, stepIndex: 2 }, //  5 青
  ]
  const fiRecipes = [
    { id: 10, title: 'FI肉じゃが', colorIndex: 0 },
    { id: 20, title: 'FIみそ汁', colorIndex: 1 },
    { id: 30, title: 'FIマリネ', colorIndex: 2 },
  ]
  const fiIds = fiRecipes.map((r) => r.id)
  const fiAt = (i) => ({ recipeId: fiPlan[i].recipeId, stepIndex: fiPlan[i].stepIndex })

  eq('FI-MOVE 青の手順から「緑」でその品の次の手順へ', resolveColorMove(fiPlan, fiAt(0), 1, fiRecipes), {
    kind: 'move',
    recipeId: 20,
    cursor: { recipeId: 20, stepIndex: -1 },
  })
  eq('FI-MOVE 「ピンク」でも同じように移れる', resolveColorMove(fiPlan, fiAt(0), 2, fiRecipes), {
    kind: 'move',
    recipeId: 30,
    cursor: { recipeId: 30, stepIndex: 0 },
  })
  eq(
    'FI-MOVE 進んだ先からは、その先にある手順に移る（後戻りはしない）',
    resolveColorMove(fiPlan, fiAt(2), 0, fiRecipes),
    { kind: 'move', recipeId: 10, cursor: { recipeId: 10, stepIndex: 1 } },
  )
  eq(
    'FI-MOVE いま大きく出している品の色は、動かさずに状態を返す',
    resolveColorMove(fiPlan, fiAt(0), 0, fiRecipes),
    { kind: 'current', recipeId: 10 },
  )
  eq(
    'FI-MOVE ナビが足した工程を開いていても、同じ品の色なら動かない',
    resolveColorMove(fiPlan, fiAt(1), 1, fiRecipes),
    { kind: 'current', recipeId: 20 },
  )
  eq(
    'FI-MOVE 残りの手順が無い品（下部に「完成」と出ている品）は、動かさずに完成を返す',
    resolveColorMove(fiPlan, fiAt(5), 1, fiRecipes),
    { kind: 'done', recipeId: 20 },
  )
  eq(
    'FI-MOVE 段取りに無い色（2品で組んでいるのに3色目）は、その旨を返す',
    resolveColorMove(fiPlan, fiAt(0), 2, fiRecipes.slice(0, 2)),
    { kind: 'none' },
  )
  eq(
    'FI-MOVE カーソルが段取りに無いときは行き先を決めない',
    resolveColorMove(fiPlan, { recipeId: 99, stepIndex: 0 }, 1, fiRecipes),
    { kind: 'none' },
  )
  eq(
    'FI-MOVE 覚えていない状態からも行き先を決めない',
    resolveColorMove(fiPlan, undefined, 1, fiRecipes),
    { kind: 'none' },
  )
  // **黙って何も起きない**を作らない。どの言い方でも必ず種類が返る（画面はこれを文言にする）
  eq(
    'FI-MOVE どの位置・どの色でも必ず結果の種類が返る（無反応にならない）',
    fiPlan.every((_, i) =>
      [0, 1, 2].every((color) =>
        ['move', 'current', 'done', 'none'].includes(
          resolveColorMove(fiPlan, fiAt(i), color, fiRecipes).kind,
        ),
      ),
    ),
    true,
  )
  // 行き先は「下部にその色で出ている行」と必ず同じ＝言う前に目で確かめられる
  eq(
    'FI-MOVE 行き先は、下部にその色で出ている行の手順と必ず一致する',
    fiPlan.every((_, i) => {
      const rows = nextStepsByRecipe(fiPlan, fiAt(i), fiIds)
      return fiRecipes.every((recipe) => {
        const result = resolveColorMove(fiPlan, fiAt(i), recipe.colorIndex, fiRecipes)
        const row = rows.find((r) => r.recipeId === recipe.id)
        if (!row) return result.kind === 'current' // 下部に出ないのは、いま開いている品だけ
        if (!row.item) return result.kind === 'done'
        return (
          result.kind === 'move' &&
          result.cursor.recipeId === row.item.recipeId &&
          result.cursor.stepIndex === row.item.stepIndex
        )
      })
    }),
    true,
  )

  // --- ⑥ 引き寄せ（並べ替え）。**カーソルだけ先へ飛ばすと手順が消えるので、そうしない** ---
  // 飛ばす形（カーソルを目的の手順へ動かすだけ）だと、間にある他の品の手順が
  // 「カーソルより前＝済んだ手順」に化ける。実機で確認すると、1度も作っていない品が
  // 「完成」と表示された。引き寄せる形なら手順は1つも消えない。
  const fiKey = (list) => list.map((x) => `${x.recipeId}:${x.stepIndex}`)
  /** 色を言ったときに実際に起きること（並べ替え＋カーソル移動）をまとめて再現する */
  const fiSay = (list, cursor, colorIndex) => {
    const result = resolveColorMove(list, cursor, colorIndex, fiRecipes)
    if (result.kind !== 'move') return { list, cursor, result }
    return {
      list: applyStepPulls(list, [{ before: cursor, target: result.cursor }]),
      cursor: result.cursor,
      result,
    }
  }

  const fiSaidGreen = fiSay(fiPlan, fiAt(0), 1)
  eq(
    'FI-PULL 言われた品の手順が、いま開いていた手順の直前に来る',
    fiKey(fiSaidGreen.list),
    ['20:-1', '10:0', '20:0', '10:1', '30:0', '10:2'],
  )
  eq('FI-PULL 手順の数は変わらない（1つも消えない）', fiSaidGreen.list.length, fiPlan.length)
  eq(
    'FI-PULL 開いていた手順は1つ後ろに残る＝「次へ」で戻れる',
    advanceCursor(fiSaidGreen.list, fiSaidGreen.cursor),
    fiAt(0),
  )
  eq(
    'FI-PULL 引き寄せた手順より前に、まだやっていない手順を作らない（先頭に来る）',
    findCursorIndex(fiSaidGreen.list, fiSaidGreen.cursor),
    0,
  )
  // 遠くの品を引き寄せても、間の手順は「済んだこと」にならない
  const fiSaidPink = fiSay(fiPlan, fiAt(0), 2)
  eq(
    'FI-PULL 離れた手順を引き寄せても、間の手順は後ろに残る',
    fiKey(fiSaidPink.list),
    ['30:0', '10:0', '20:-1', '20:0', '10:1', '10:2'],
  )
  eq(
    'FI-PULL 引き寄せたあとも、その品の残りは「完成」扱いにならない',
    // 便LK: 行が0件でも every は true になる（次の手順が1つも出なくなった退行が緑で通る）
    (() => {
      const rows = nextStepsByRecipe(fiSaidPink.list, fiSaidPink.cursor, fiIds)
      return rows.length > 0 && rows.every((row) => row.item != null)
    })(),
    true,
  )
  // 各品の中の順番は絶対に入れ替わらない（先に切ってから煮る、が崩れない）
  const fiInOrder = (list) =>
    fiIds.every((id) => {
      const steps = list.filter((x) => x.recipeId === id).map((x) => x.stepIndex)
      return steps.every((v, i) => i === 0 || steps[i - 1] < v)
    })
  eq('FI-PULL その品の中の手順の順番は変わらない', fiInOrder(fiSaidGreen.list), true)
  eq('FI-PULL 離れた品を引き寄せても同じ', fiInOrder(fiSaidPink.list), true)
  // 続けて言い直しても壊れない
  const fiTwice = fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 2)
  eq('FI-PULL 続けて別の色を言っても手順は減らない', fiTwice.list.length, fiPlan.length)
  eq('FI-PULL 続けて言い直しても品の中の順番は保たれる', fiInOrder(fiTwice.list), true)
  eq(
    'FI-PULL 続けて言い直すと、いちばん新しく言った品が先頭に来る',
    fiKey(fiTwice.list)[0],
    '30:0',
  )
  eq(
    'FI-PULL 直前に引き寄せた手順は、そのすぐ後ろに残る',
    advanceCursor(fiTwice.list, fiTwice.cursor),
    fiAt(1),
  )
  // 並べ替えは保存しないので、組み直した段取りに毎回当て直す。当てられない1件は飛ばす
  eq(
    'FI-PULL 引き寄せが1つも無ければ、組み直した段取りをそのまま使う',
    applyStepPulls(fiPlan, []),
    fiPlan,
  )
  eq(
    'FI-PULL 手順が消えていた引き寄せは飛ばす（段取りは壊さない）',
    fiKey(applyStepPulls(fiPlan, [{ before: fiAt(0), target: { recipeId: 40, stepIndex: 0 } }])),
    fiKey(fiPlan),
  )
  eq(
    'FI-PULL 差し込み先が消えていた引き寄せも飛ばす',
    fiKey(applyStepPulls(fiPlan, [{ before: { recipeId: 40, stepIndex: 0 }, target: fiAt(4) }])),
    fiKey(fiPlan),
  )
  eq(
    'FI-PULL 同じ引き寄せを2回当てても結果は変わらない（毎回当て直しても同じ画面）',
    fiKey(applyStepPulls(fiPlan, [
      { before: fiAt(0), target: fiAt(1) },
      { before: fiAt(0), target: fiAt(1) },
    ])),
    fiKey(fiSaidGreen.list),
  )

  // --- ⑦ 可逆（docs/69「音声は可逆操作のみ」） ---
  eq(
    'FI-BACK 別の色を言えば移り直せる（言い間違えても言い直しで済む）',
    fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 2).result,
    { kind: 'move', recipeId: 30, cursor: { recipeId: 30, stepIndex: 0 } },
  )
  eq(
    'FI-BACK 同じ色をもう一度言っても二重には動かない',
    fiSay(fiSaidGreen.list, fiSaidGreen.cursor, 1).result,
    { kind: 'current', recipeId: 20 },
  )
  eq(
    'FI-BACK 「手順①へ」で必ず段取りの先頭に戻れる（色で並べ替えたあとも）',
    startCursor(fiSaidGreen.list),
    { recipeId: 20, stepIndex: -1 },
  )
  // --- ⑧ 覚え書き（2026-08-10 司令部裁定「引き寄せを保存する」）。
  // 保存するのは**ユーザーが出した指示**だけで、段取りは今までどおり毎回組み直す。
  // 保存しないと、読み込み直したときに並びだけ元へ戻り、作っていない品が「完成」と出る。
  const fiSaved = (session) => parseCookNaviSession(JSON.stringify(session))
  const fiBase = { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: fiAt(0) }
  eq(
    'FI-SAVE 引き寄せの指示を保存して読み戻せる',
    fiSaved({ ...fiBase, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    [{ before: fiAt(0), target: fiAt(1) }],
  )
  eq(
    'FI-SAVE 読み戻した指示を当て直すと、同じ並びになる（往復して壊れない）',
    fiKey(applyStepPulls(fiPlan, fiSaved({ ...fiBase, pulls: [{ before: fiAt(0), target: fiAt(1) }] }).pulls)),
    fiKey(fiSaidGreen.list),
  )
  eq(
    'FI-SAVE 保存された順は変えない（順番が変わると当て直した結果が変わる）',
    fiSaved({
      ...fiBase,
      pulls: [
        { before: fiAt(0), target: fiAt(4) },
        { before: fiAt(4), target: fiAt(1) },
      ],
    })?.pulls,
    [
      { before: fiAt(0), target: fiAt(4) },
      { before: fiAt(4), target: fiAt(1) },
    ],
  )
  eq(
    'FI-SAVE 形の壊れた1件だけを捨てて、残りは当て直す（推測で近い場所に当てない）',
    fiSaved({
      ...fiBase,
      pulls: [
        { before: fiAt(0), target: null },
        { target: fiAt(1) },
        'こわれ',
        { before: fiAt(0), target: fiAt(4) },
      ],
    })?.pulls,
    [{ before: fiAt(0), target: fiAt(4) }],
  )
  // 後方互換: この項目が無い（便FIより前の）覚え書きも今までどおり読める
  eq(
    'FI-SAVE 引き寄せを知らない古い覚え書きも読める（並べ替え無しとして扱う）',
    fiSaved(fiBase)?.pulls,
    undefined,
  )
  eq(
    'FI-SAVE 古い覚え書きの選択・表示・調理中の手順は今までどおり読める',
    { ...fiSaved(fiBase), pulls: undefined },
    { selectedIds: [10, 20, 30], showTimeline: true, trialActive: false, current: fiAt(0), pulls: undefined },
  )
  eq(
    'FI-SAVE 引き寄せが1件も無ければ項目そのものを持たない（覚え書きを太らせない）',
    fiSaved({ ...fiBase, pulls: [] })?.pulls,
    undefined,
  )
  eq(
    'FI-SAVE 段取りを表示していない覚え書きの並べ替えは読まない（調理中の手順と同じ扱い）',
    fiSaved({ selectedIds: [10, 20], showTimeline: false, trialActive: false, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    undefined,
  )
  // 2026-08-14 便GJ で線を1本だけ動かした。段取りの一覧から手で並べ替えられるようになり、
  // **調理中モードを開かずに並べ替える**のが普通の使い方になったため、
  // 並べ替えは「調理中の位置があるか」ではなく「段取りが出ているか」で読む。
  // 便FI の時点では並べ替えの手立てが調理中モードの中にしか無かったので、どちらでも同じだった
  eq(
    'GJ-SAVE 調理中の手順を覚えていなくても、段取りが出ていれば並べ替えは読む',
    fiSaved({ selectedIds: [10, 20], showTimeline: true, trialActive: false, pulls: [{ before: fiAt(0), target: fiAt(1) }] })?.pulls,
    [{ before: fiAt(0), target: fiAt(1) }],
  )
  eq(
    'FI-SAVE 並べ替えが配列でない壊れた覚え書きでも、他の項目は読める',
    fiSaved({ ...fiBase, pulls: 'こわれ' })?.current,
    fiAt(0),
  )

  eq(
    'FI-BACK 引き寄せたあとも「次へ→戻って」で元の手順に帰る',
    // 便LK: 手順が1つ以下だと下の every は中身を1回も見ずに true になる
    fiSaidGreen.list.length > 1 &&
      fiSaidGreen.list.every((_, i) => {
      if (i >= fiSaidGreen.list.length - 1) return true
      const at = { recipeId: fiSaidGreen.list[i].recipeId, stepIndex: fiSaidGreen.list[i].stepIndex }
      return JSON.stringify(backCursor(fiSaidGreen.list, advanceCursor(fiSaidGreen.list, at))) ===
        JSON.stringify(at)
    }),
    true,
  )
}

// ---------- 2026-08-12 便FX・調理中モードの手順の文字の大きさ ----------
// オーナー実機「調理中モードの文字の大きさは、ユーザーが自由に変更できない？
// 小さい画面だと表示できなくなるから無理か」。手順の枠は縦にスクロールするので、
// 大きくしても読めなくならない。設定に入っている値は必ず選べる4段のどれかに寄せる。
{
  const { COOK_FONT_SCALES, DEFAULT_COOK_FONT_SCALE, resolveCookFontScale, cookFontSize } =
    await import('../../src/logic/cookFontScale.ts')
  eq('FX-09 選べるのは4段', [...COOK_FONT_SCALES], [0.85, 1, 1.25, 1.5])
  eq('FX-09 既定はふつう(1倍)', DEFAULT_COOK_FONT_SCALE, 1)
  eq('FX-09 未設定は既定に寄せる', resolveCookFontScale(undefined), 1)
  eq('FX-09 一覧に無い値は既定に寄せる', resolveCookFontScale(3), 1)
  eq('FX-09 壊れた値も既定に寄せる', [resolveCookFontScale(Number.NaN), resolveCookFontScale(-1)], [1, 1])
  eq('FX-09 選べる値はそのまま返す', COOK_FONT_SCALES.map(resolveCookFontScale), [0.85, 1, 1.25, 1.5])
  // 手順本文は 1.5rem（text-2xl）が標準。倍率をかけた値をCSSに渡す
  eq('FX-09 手順本文の大きさ(標準1.5rem)', COOK_FONT_SCALES.map((s) => cookFontSize(1.5, s)), [
    '1.275rem',
    '1.5rem',
    '1.875rem',
    '2.25rem',
  ])
  eq('FX-09 枠の基準の大きさ(標準1rem)', COOK_FONT_SCALES.map((s) => cookFontSize(1, s)), [
    '0.85rem',
    '1rem',
    '1.25rem',
    '1.5rem',
  ])
}


// ---------- 便GL: 手順を進めたときのタイマーの一言 / 読み上げ名 ----------
{
  const { timerNoticeOnAdvance } = await import('../../src/logic/cookTimerNotice.ts')
  const { naviStepSpeechText } = await import('../../src/logic/naviStepText.ts')
  /** 段取りの手順1つぶん（判定に要るところだけ） */
  const it = (recipeId, stepIndex, over = {}) => ({
    recipeId,
    stepIndex,
    order: stepIndex + 1,
    stepNumber: stepIndex + 1,
    recipeId2: undefined,
    kind: 'active',
    text: '切る。',
    minutes: 3,
    waitMinutes: 0,
    activeMinutes: 3,
    longRest: false,
    addedByNavi: false,
    recipeTitle: `料理${recipeId}`,
    colorIndex: 0,
    startMin: 0,
    endMin: 3,
    ...over,
  })
  const wait = (recipeId, stepIndex, minutes, over = {}) =>
    it(recipeId, stepIndex, {
      kind: 'wait',
      waitMinutes: minutes,
      activeMinutes: 0,
      text: `${minutes}分焼く。`,
      ...over,
    })
  const timer = (id, recipeId, stepIndex, over = {}) => ({
    id,
    key: `${recipeId}-${stepIndex}-600`,
    recipeId,
    done: false,
    ...over,
  })
  const cur = (recipeId, stepIndex) => ({ recipeId, stepIndex })

  // ① タイマーを押さずに次へ進めた（利用者「グリル15分のタイマーを押さずに次へ進めてしまった」）
  {
    const items = [wait(1, 0, 15), it(2, 0)]
    eq(
      'GL-5① 待ちのタイマーを始めずに次へ進むと、その手順を指して伝える',
      JSON.stringify(timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [])),
      JSON.stringify({ kind: 'notStarted', recipeId: 1, stepIndex: 0 }),
    )
    eq(
      'GL-5① タイマーを始めてあれば何も言わない（うるさくしない）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [timer(9, 1, 0)]),
      null,
    )
    eq(
      'GL-5① 手を動かす手順から進んだときは何も言わない',
      timerNoticeOnAdvance([it(1, 0), it(2, 0)], cur(1, 0), cur(2, 0), []),
      null,
    )
    eq(
      'GL-5① 分数を出さない長い待ち（半日〜一晩）はタイマーが無いので言わない',
      timerNoticeOnAdvance(
        [wait(1, 0, 0, { longRest: true }), it(2, 0)],
        cur(1, 0),
        cur(2, 0),
        [],
      ),
      null,
    )
  }
  // ② その品のタイマーがまだ動いているのに、その品の次の手順へ進んだ
  //    （利用者「段取り6に進んだ時点で、鶏の下味10分タイマーがまだ09:12残っていました」）
  {
    const items = [wait(1, 0, 10), it(1, 1), it(2, 0)]
    eq(
      'GL-5② 同じ品のタイマーが動いたままその品の次の手順へ進むと、残り時間を伝える',
      JSON.stringify(timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [timer(7, 1, 0)])),
      JSON.stringify({ kind: 'stillRunning', timerId: 7 }),
    )
    eq(
      'GL-5② 別の品の手順へ進んだときは言わない（待ちの間に他の品をやるのは段取りどおり）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(2, 0), [timer(7, 1, 0)]),
      null,
    )
    eq(
      'GL-5② 一時停止しているタイマーでは言わない（急かさない）',
      timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [
        timer(7, 1, 0, { pausedRemainingMs: 60000 }),
      ]),
      null,
    )
    // 利用者が「その間に」と書いた手順は、待ちの中でやるのが正しいので黙る
    const cued = [wait(1, 0, 10), it(1, 1, { text: 'その間に☆を混ぜ合わせる。' }), it(2, 0)]
    eq(
      'GL-5② 「その間に」と書かれた手順へ進んだときは黙る（段取りどおりの並行作業）',
      timerNoticeOnAdvance(cued, cur(1, 0), cur(1, 1), [timer(7, 1, 0)]),
      null,
    )
    // ナビが足した湯沸かしの次の手順も同じ扱い
    const boil = [wait(1, 0, 5, { addedByNavi: true }), it(1, 1), it(2, 0)]
    eq(
      'GL-5② ナビが足した湯沸かしの次の手順でも黙る',
      timerNoticeOnAdvance(boil, cur(1, 0), cur(1, 1), [timer(7, 1, 0)]),
      null,
    )
  }
  // ①が②より先（火が入ったままのほうが先に伝わる）
  {
    const items = [wait(1, 0, 15), it(1, 1)]
    eq(
      'GL-5 どちらも当てはまるときは「始めていない」を先に伝える',
      timerNoticeOnAdvance(items, cur(1, 0), cur(1, 1), [timer(7, 1, 5)])?.kind,
      'notStarted',
    )
  }
  // 読み上げ名（利用者「同じ『手順』で2つの番号を指していて紛らわしい」）
  {
    eq(
      'GL-B 読み上げ名は2つの番号をそれぞれの名前で呼ぶ',
      naviStepSpeechText(9, '1-2'),
      '段取り9・手順1の2つめ',
    )
    eq('GL-B 分けていない手順はそのままの番号', naviStepSpeechText(9, '3'), '段取り9・手順3')
    eq('GL-B レシピ内の番号が無い工程は段取りの番号だけ', naviStepSpeechText(9), '段取り9')
    eq(
      'GL-B 読み上げ名に「手順」が2つの番号を指す形は残っていない',
      /手順\d+[（(]/.test(naviStepSpeechText(9, '1-2')),
      false,
    )
    // 画面に出る文字（バッジと並ぶ側）は便EZ のまま変えていない
    const { naviStepText } = await import('../../src/logic/naviStepText.ts')
    eq('GL-B 画面の文字は今までどおり', naviStepText(9, '1-2'), '⑨（1-2）')
  }
  // 画面文言（規約H）
  {
    eq(
      'GL-1 目安の分数の印は、何の数字かと何でないかを両方言い切る',
      // 言い回しそのものを固定しない（2026-08-15。「手で並べ替えたあと」は声・タップでも
      // 同じ印が出るため「並びを変えたあと」に直した。文言が育つたびに落ちるテストにしない）。
      // 見るのは①その数字が何なのかを言っているか ②何ではないかを打ち消しで言っているか の2つ
      ja.cookNavi.estimateStaleNote.includes('自動で組んだ並び') &&
        /ではありません|ではない/.test(ja.cookNavi.estimateStaleNote),
      true,
    )
    // 2026-08-25 便KT・オーナー原文「並行調理の手順変更「１つ前の並びに戻す」→（あと◯回）削除」。
    // 便GL が添えていた残り回数は消した。**押せる回数の上限は元から無い**（1件ずつ何度でも戻せる）。
    // 「あと0回」で押せなくなる作りではなく、戻せるものが無くなると**欄そのものが画面から消える**
    // ので、押せなくなることを別の形で伝える必要もない（KT-2 が画面側の条件を見張る）
    eq(
      'KT-2 戻すボタンに残り回数を書かない（差し込み口ごと無い）',
      /\{n\}/.test(ja.cookNavi.reorderUndoOne),
      false,
    )
    eq(
      'KT-2 戻せるものが無いときは、欄ごと画面に出さない（「あと0回」が出ない作り）',
      /\{pulls\.length > 0 && \(/.test(
        readFileSync(
          path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..', 'src/pages/CookNaviPage.tsx'),
          'utf-8',
        ),
      ),
      true,
    )
    eq(
      'GL-6 終わりの窓のタイマーの一言は、消す側・消さない側の両方を書く',
      ja.cookNavi.sessionFinishTimersStopNote.includes('残り時間はなくなります') &&
        ja.cookNavi.sessionFinishTimersKeepNote.includes('片づけの間も鳴ります'),
      true,
    )
    eq(
      'GL-A 沸くまでの待ちは、タイマーが何分ではかるかを押す前に書く（沸く時間は言い切らない）',
      ja.cookNavi.waitBlockBoilNote.includes('タイマーは{n}分ではかります') &&
        ja.cookNavi.waitBlockBoilNote.includes('火力と量で変わります'),
      true,
    )
  }
}

// ==========================================================================================
// 便GR: 混在手順の両方計上（docs/72 N4・2026-08-15）
//
// 利用者（料理歴20年・実機で3回テスト）の原文:
//   「みそ汁の手順1は『1-1 手を動かす2分／1-2 沸くのを待つ』に割ってくれている。できるのに、
//     本文に『10分おく』と書いてある側では割らない。ここが一番納得いかない。
//     この2つが直らないなら分数は見なくなります。」
//
// 測るのは**利用者が確かめたいこと**＝「手作業と待ちが両方入った手順で、両方の時間が
// 段取りに出ていること」。工程がいくつに割れたか・何番目に出たかは見ない
// （段取りが伸びても縮んでも同じ判定になる形にする）。
// ==========================================================================================
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })
  /**
   * その手順が段取りの上で持つ時間の合計（何工程に割れていてもまとめて数える）。
   * 元の手順1つに対応する工程は、割られていれば splitOf に元の手順番号が入る。
   */
  const stepTotals = (steps, stepNumber = 1) => {
    const items = buildCookTimeline([{ id: 1, title: '検査用', steps }]).items
    const mine = items.filter((it) => (it.splitOf ?? it.stepNumber) === stepNumber)
    return {
      active: mine.reduce((sum, it) => sum + it.activeMinutes, 0),
      wait: mine.reduce((sum, it) => sum + it.waitMinutes, 0),
    }
  }
  const bothCounted = (steps, stepNumber) => {
    const x = stepTotals(steps, stepNumber)
    return x.active > 0 && x.wait > 0
  }

  // ---- 手作業のあとに待ちが続く書き方（利用者が挙げた「10分おく」型）----
  // どれも実際に登録されているレシピの本文（URL取込・貼り付け・同梱）から取っている。
  // 分数欄は取り込み経路が本文から埋めるので、実機と同じ「埋まっている形」で見る
  for (const [label, step] of [
    ['「火を止め、そのまま10分おいて味を含ませます」（URL取込）', t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10)],
    ['「火を止め、そのまま10分おいて味を含ませる」（貼り付け）', t('火を止め、そのまま10分おいて味を含ませる', 10)],
    ['「火を止めてそのまま10分おき、味をしみ込ませる」（同梱）', t('火を止めてそのまま10分おき、味をしみ込ませる。', 10)],
    ['「もみ込んで15分おきます」（分数が本文にある）', t('ポリ袋に鶏むね肉としょうゆ、酒を入れてもみ込み、15分おきます。', 15)],
  ]) {
    eq(`GR-1 手作業と待ちの両方が段取りに出る: ${label}`, bothCounted([step]), true)
  }

  // ---- 待ちは1分も減らさない（割ったせいで待ちが短くなっていないか）----
  for (const step of [
    t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10),
    t('火を止めてそのまま10分おき、味をしみ込ませる。', 10),
    t('ポリ袋に鶏むね肉としょうゆ、酒を入れてもみ込み、15分おきます。', 15),
  ]) {
    eq(
      `GR-3 割っても待ちの分数は減らない（${step.text.slice(0, 14)}）`,
      stepTotals([step]).wait >= step.minutes,
      true,
    )
  }

  /**
   * まだ両方を数えられていない書き方（2026-08-15 便GR。**実測して見送った**ので記録だけ残す）。
   * ここをテストにすると「直っていないこと」を固定してしまうので、assert は置かない。
   *
   *   (a)「火を止めて、そのまま冷ましながら味を含ませます」「煮汁がなくなったら火を止め、そのまま冷ます」
   *       … 冷ます時間は動詞から読めない（5分のことも1時間のこともある）。
   *       既定分数を当てると N2（温かい品と汁物の放置）が53分→69分・N1が33.7%→37.5%に悪化した
   *   (b)「鍋に◯◯を入れて中火にかけ、煮立ったら△△を加えて3分ほど煮る」
   *       … 前半で火がつく形。割ると口をふさぐ時間が前半のぶん伸び、
   *       コンロ1口の家で理論下限を割る段取り（E5'-b）が1件出た
   */

  // ---- 危険側（S1）を増やさない: 手を動かし続ける工程に待ちを作らない ----
  for (const [label, step] of [
    ['たれを絡めながら煮からめる（焦げやすい）', t('しょうゆ・みりん・砂糖を加え、たれを絡めながら照りが出るまで煮からめる。', 2)],
    ['フライパンで炒める', t('フライパンに油を熱し、豚肉を色が変わるまで3分炒める。', 3)],
    ['煮立つ直前で火を止める', t('弱火にしてみそを溶き入れ、煮立つ直前で火を止めます。')],
    // 「弱火にかけ」のあとも鍋の前にいる工程（香りが立つまで＝目を離せない）。
    // 火にかける言い回しを合図に待ちを作ると、ここでフライパンから目を離させる
    ['弱火にかけて香りを立たせてから炒める', t('鍋にオリーブオイルとにんにくを入れて弱火にかけ、香りが立ったら玉ねぎとにんじんを加えてしんなりするまで炒めます。')],
  ]) {
    eq(`GR-4 手を動かし続ける工程に待ちを作らない: ${label}`, stepTotals([step]).wait, 0)
  }

  // ---- 割ったあとも「いまやる1手順」として読める（docs/69 の不変条件）----
  {
    const steps = [
      t('鍋にサラダ油を熱し、豚バラ薄切り肉を色が変わるまで炒めます。'),
      t('ふたをずらしてのせ、弱めの中火で20分煮ます。', 20),
      t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10),
      t('器に盛りつけて出来上がりです。'),
    ]
    const items = buildCookTimeline([{ id: 1, title: '豚肉と大根の煮もの', steps }]).items
    const mine = items.filter((it) => (it.splitOf ?? it.stepNumber) === 3)
    // 照合の前にゼロ幅スペースを外す（禁じ手②。BudouXが本文に差し込むので includes が外れる）
    const plainText = (text) => (text ?? '').replaceAll('​', '').trim()
    eq(
      'GR-5 割った工程はどれもレシピ本文の一部だけを持つ（本文を書き足していない）',
      mine.length > 0 && mine.every((it) => plainText(steps[2].text).includes(plainText(it.text))),
      true,
    )
    eq('GR-5 割った工程は別々の識別子を持つ（「次へ」が同じ手順に戻らない）', new Set(mine.map((it) => it.stepIndex)).size, mine.length)
    // 手作業が先・待ちが後ろ（タイマーは待ちの工程にしか出ない＝手を動かす前に押せない）
    const waits = mine.filter((it) => it.kind === 'wait')
    const actives = mine.filter((it) => it.kind === 'active')
    // 2026-08-27 便LO: **割れていること**を同じ判定式で見る（受け手が空だと every は
    // 中身を1回も見ずに true になる）。割るのをやめた瞬間、この2つは何も測らないまま緑になる
    eq('GR-5 この手順は手作業と待ちの両方に割れている（下の2つが空振りしない前提）', waits.length > 0 && actives.length > 0, true)
    eq(
      'GR-5 タイマーは待ちの工程だけに出る',
      actives.length > 0 && actives.every((it) => !showsWaitTimerButton(it)),
      true,
    )
    eq(
      'GR-5 待ちは手作業より後ろから始まる',
      waits.length > 0 &&
        actives.length > 0 &&
        waits.every((w) => actives.every((a) => w.startMin >= a.startMin)),
      true,
    )
    // 番号は「3-1」「3-2」…（湯沸かしの切り出しと同じ見せ方）
    eq(
      'GR-5 割った工程の番号は元の手順番号から枝分かれする',
      mine.length > 1 ? mine.every((it) => recipeStepLabel(it).startsWith('3')) : true,
      true,
    )
  }
}

// ---------- 読み上げの段取り(logic/speechEngine.ts): 2026-08-16 便GY・オーナー実機 ----------
// iPhone SE2/Safari「読み上げは、2-3回ONOFF繰り返し押さないと音が出ない気がします」。
// ブラウザの読み上げ（speechSynthesis）は、①取り消しの直後に話し始めると発話が捨てられる
// ②一時停止（paused）のまま残ると speak しても鳴らない ③声の一覧が後から届く、という癖がある。
// 実機が手元に無いので、speechSynthesis を差し替えて「呼ぶ順番」を固定する。
{
  const { createSpeechEngine } = await import('../../src/logic/speechEngine.ts')

  /** 読み上げエンジンの替え玉。呼ばれた順番と、渡された発話を覚える */
  const makeSynth = (voices = []) => {
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      voices,
      calls: [],
      spoken: [],
      speak(utterance) {
        synth.calls.push('speak')
        synth.spoken.push(utterance)
      },
      cancel() {
        synth.calls.push('cancel')
        synth.speaking = false
        synth.pending = false
      },
      resume() {
        synth.calls.push('resume')
        synth.paused = false
      },
      getVoices: () => synth.voices,
    }
    return synth
  }

  /** 待ち時間の替え玉。何ミリ秒かは測らず、「待ちに入ったか」「消化したか」だけを見る */
  const makeClock = () => {
    let nextId = 0
    const waits = new Map()
    return {
      setTimer(fn) {
        const id = ++nextId
        waits.set(id, fn)
        return id
      },
      clearTimer(id) {
        waits.delete(id)
      },
      /** いちばん古い待ちを1つだけ消化する。消化できたら true */
      runNext() {
        const entry = waits.entries().next()
        if (entry.done) return false
        waits.delete(entry.value[0])
        entry.value[1]()
        return true
      },
      /** 待ちが無くなるまで消化する（上限は暴走よけの保険。回数そのものは測らない） */
      runAll() {
        for (let guard = 0; guard < 50; guard++) {
          if (!this.runNext()) return
        }
      },
    }
  }

  const makeEngine = (synth, clock) => {
    const events = { speaking: [], notStarted: 0 }
    const engine = createSpeechEngine({
      synth,
      createUtterance: (text) => ({
        text,
        lang: '',
        voice: null,
        onstart: null,
        onend: null,
        onerror: null,
      }),
      setTimer: (fn) => clock.setTimer(fn),
      clearTimer: (handle) => clock.clearTimer(handle),
      onSpeakingChange: (value) => events.speaking.push(value),
      onNotStarted: () => {
        events.notStarted++
      },
    })
    return { engine, events }
  }

  // SPEAK-01: 何も鳴っていないのに毎回 cancel してから speak していた。
  // iOS/Safari はこの並びで発話を捨てることがある＝押しても鳴らない1回目になる
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('玉ねぎを炒める')
    eq(
      'SPEAK-01 何も鳴っていないときは取り消しを挟まずに読み上げを始める',
      synth.calls.filter((c) => c === 'cancel'),
      [],
    )
    eq('SPEAK-01 待たずにその場で発話を渡す(押した操作の流れを切らない)', synth.spoken.length, 1)
  }

  // SPEAK-02: 読み上げ中に読み直すときは取り消しが要る。ただし取り消しの直後に続けて
  // 話し始めない（間を置く）。同じ流れの中で cancel→speak と並べるのが捨てられる形
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    synth.speaking = true
    const spokenBefore = synth.spoken.length
    engine.speak('ふたつ目')
    eq(
      'SPEAK-02 読み上げ中の読み直しは、取り消しの直後に続けて話し始めない',
      synth.calls[synth.calls.length - 1],
      'cancel',
    )
    eq('SPEAK-02 間を置くまで次の発話は渡らない', synth.spoken.length, spokenBefore)
    clock.runNext()
    eq('SPEAK-02 間を置いたあとに読み上げが始まる', synth.spoken.length > spokenBefore, true)
  }

  // SPEAK-03: 一時停止（paused）のまま残っていると、speak しても鳴らない。
  // 読み上げの前に必ず動かし直す
  {
    const synth = makeSynth()
    synth.paused = true
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('鍋を火にかける')
    const resumedAt = synth.calls.indexOf('resume')
    const spokeAt = synth.calls.indexOf('speak')
    eq(
      'SPEAK-03 一時停止のまま残っていたら、読み上げの前に動かし直す',
      resumedAt !== -1 && resumedAt < spokeAt,
      true,
    )
  }

  // SPEAK-04: 声の一覧は後から届く（iOS/Safari は最初の呼び出しで空のことがある）。
  // 空でも黙り込まず、届いたら日本語の声を使い、そのあと空を返されても使い続ける
  {
    const jaVoice = { lang: 'ja-JP' }
    const enVoice = { lang: 'en-US' }
    const synth = makeSynth([])
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('声がまだ届いていない')
    eq('SPEAK-04 声の一覧が空でも読み上げを遅らせない', synth.spoken.length, 1)
    synth.voices = [enVoice, jaVoice]
    engine.speak('声が届いたあと')
    eq(
      'SPEAK-04 声が届いたら日本語の声を選ぶ',
      synth.spoken[synth.spoken.length - 1].voice,
      jaVoice,
    )
    synth.voices = []
    engine.speak('また空を返された')
    eq(
      'SPEAK-04 一度読み込めた声は、一覧が空を返しても使い続ける',
      synth.spoken[synth.spoken.length - 1].voice,
      jaVoice,
    )
  }

  // SPEAK-05: speak が無視されたときは onerror も来ない＝黙って終わってしまう。
  // 始まった合図が来ないまま時間が過ぎたら、言い直したうえで手応えを画面に返す
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('鳴らないことがある手順')
    const spokenBefore = synth.spoken.length
    clock.runAll()
    eq('SPEAK-05 諦める前に言い直す', synth.spoken.length > spokenBefore, true)
    eq('SPEAK-05 それでも始まらなければ、鳴らなかったことを画面に返す', events.notStarted > 0, true)
    eq(
      'SPEAK-05 読み上げ中の表示のまま残さない(次に押すと止めるだけになる)',
      events.speaking[events.speaking.length - 1],
      false,
    )
  }

  // SPEAK-06: 「読み上げストップ」（2026-08-15 便GS）を壊さない。
  // 間を置いて待っている発話も取り消す＝止めたのに後から鳴り出さない
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    synth.speaking = true
    engine.speak('ふたつ目')
    engine.stop()
    const spokenAtStop = synth.spoken.length
    clock.runAll()
    eq('SPEAK-06 読み上げストップは取り消しを呼ぶ', synth.calls.includes('cancel'), true)
    eq('SPEAK-06 待っていた発話は取り消され、後から鳴り出さない', synth.spoken.length, spokenAtStop)
    eq(
      'SPEAK-06 止めたあとは読み上げ中の表示にしない',
      events.speaking[events.speaking.length - 1],
      false,
    )
  }

  // SPEAK-07: 取り消した発話の終了通知は後から届く。これを新しい発話のものとして扱うと、
  // 鳴っているのにボタンが「読み上げ」に戻り、次に押すと読み直しになる（押す回数が増える）
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine, events } = makeEngine(synth, clock)
    engine.speak('ひとつ目')
    const first = synth.spoken[0]
    synth.speaking = true
    engine.speak('ふたつ目')
    clock.runNext()
    const second = synth.spoken[synth.spoken.length - 1]
    second.onstart?.()
    synth.speaking = true
    first.onerror?.()
    first.onend?.()
    eq(
      'SPEAK-07 取り消した発話の終了通知で、いまの読み上げ中の表示が消えない',
      events.speaking[events.speaking.length - 1],
      true,
    )
  }

  // SPEAK-08(便HD): 1回目の読み上げは、読み上げたい文だけをその場でブラウザへ渡す。
  //
  // オーナー実機 iPhone SE2/Safari「読み上げ1回目からなりましたが、1回目のみ音の出だしが
  // ワンテンポ遅かったのが気になりました」。出だしの遅れはブラウザ側の読み上げの立ち上がりで、
  // アプリ側の下ごしらえ(用語辞書の読み替え)は便HDの実測で1回目0.79ms・2回目以降0.06ms＝
  // 耳で分かる差にならない。
  //
  // 「無音の発話を先に1回通して温める」案は**採らなかった**（理由は便HDの報告に記載）。
  // ここで固定するのは、そのぶん**読み上げの前に何も割り込ませない**こと。
  // 先に別の発話を積むと、ブラウザに渡る順番が変わり、待ち行列に入ったぶん
  // かえって1回目が遅くなる（この読み上げの段取りは speaking/pending を見て
  // 「読み直し」と判断し、取り消し＋間を置く道へ入る）。
  {
    const synth = makeSynth()
    const clock = makeClock()
    const { engine } = makeEngine(synth, clock)
    engine.speak('玉ねぎをくし形に切る')
    eq(
      'SPEAK-08 1回目にブラウザへ渡るのは、読み上げたい文だけ(温めの発話を先に挟まない)',
      synth.spoken.map((u) => u.text),
      ['玉ねぎをくし形に切る'],
    )
    eq(
      'SPEAK-08 1回目は待ちを挟まずその場で渡す(押してから鳴るまでを長くしない)',
      synth.calls,
      ['speak'],
    )
  }
}

// ---------- 便GY-2: マナーモードでのタイマー音（2026-08-16 オーナー実機確認） ----------
// 「タイマー音はマナーモードではなりません。オフラインでもタイマー動作の挙動は同じであることを確認」。
// iPhoneでは ①タイマー音が鳴らない ②Safariに振動の仕組みが無い が重なるので、
// マナーモード中は終わりに気づく手段が画面だけになる。
// 設定の注記は「タイマーの終了は音でお知らせします」と言い切っていて、そのままでは嘘になる。
{
  const appRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const mentionsSilentMode = (text) => text.includes('マナーモード') || text.includes('消音')
  eq(
    'GY-2 振動非対応の注記が「音でお知らせします」で言い切っていない(マナーモードでは鳴らない)',
    mentionsSilentMode(ja.settings.timerVibrationUnsupportedNote),
    true,
  )

  const manual = readFileSync(path.join(appRoot, 'public/about/manual.html'), 'utf-8')
  eq(
    'GY-2 使い方ページに「マナーモードではタイマー音が鳴らない」ことが書かれている',
    manual.split(/[。\n]/).some((s) => mentionsSilentMode(s) && s.includes('タイマー音')),
    true,
  )

  // オフラインの節（見出しのidで掴む＝並び順が変わっても外れない）に、
  // タイマーの挙動が電波のあるときと変わらないことが書かれているか
  const offlineStart = manual.indexOf('id="offline"')
  const offlineSection = manual.slice(offlineStart, manual.indexOf('<h3', offlineStart + 1))
  eq(
    'GY-2 オフラインの節に、タイマーの動きが電波のあるときと同じだと書かれている',
    offlineSection
      .split('\n')
      .some((line) => line.includes('タイマー') && (line.includes('同じ') || line.includes('変わ'))),
    true,
  )
}

// --- タイマーの調整を開く読み上げ名（2026-08-16）。自分で時間を決めたタイマーは名前が
//     そのまま「タイマー」なので、素直に当てはめると「タイマーのタイマーを調整」になっていた ---
{
  const { timerAdjustAria } = await import('../../src/logic/timerOrder.ts')
  const T = '{label}のタイマーを調整'
  eq('TIMERARIA-1 自分で決めたタイマーは名前を重ねない', timerAdjustAria('タイマー', T, 'タイマー'), 'タイマーを調整')
  eq('TIMERARIA-2 手順のタイマーは今までどおり名前を読む', timerAdjustAria('肉じゃが', T, 'タイマー'), '肉じゃがのタイマーを調整')
  eq('TIMERARIA-3 名前が空でも読める形にする', timerAdjustAria('', T, 'タイマー'), 'タイマーを調整')
  eq(
    'TIMERARIA-4 手順つきの名前も今までどおり',
    timerAdjustAria('肉じゃが・手順⑨（1-2）', T, 'タイマー'),
    '肉じゃが・手順⑨（1-2）のタイマーを調整',
  )
}

// ==========================================================================================
// 便HA: 「鍋から離れない一手」は割らない（docs/68 の裁定・2026-08-16）
//
// 何が起きていたか: N4（混在手順の両方計上）の**分母**に、割ってはいけない手順が入っていた。
// 監査の `isMixedStep` が「手作業の語が待ちの語より前にある」だけで混在と判定するため、
// 「弱火にしてみそを溶き入れ、煮立つ直前で火を止めます」のような**鍋の前を離れられない一手**まで
// 「手作業と待ちが同居している＝割れるはずなのに割れていない」と数えていた。
// **アプリは正しく動いているのに不合格と数えていた**ので、線（90%）は動かさず分母だけを直した。
//
// ここで固定するのは2つ。
//   ① 監査が、これらの手順を分母に入れない（＝測り方の回帰）
//   ② アプリが、これらの手順で**待ちを作らない**（＝利用者が確かめたいこと。
//      待ちを作った瞬間、ナビは「その間に別の料理をどうぞ」と鍋から目を離させる）
// 本文はすべて**実際の標本のもの**（URL取込・貼り付け・同梱）をそのまま使う。
// ==========================================================================================
{
  const t = (text, minutes) => (minutes == null ? { text } : { text, minutes })

  /** 割ってはいけない手順（分母から外した5件＋同梱の同型2件）。ラベルは「なぜ離れられないか」 */
  const notSplittable = [
    ['煮立つ瞬間を見て火を落とす（URL取込・みそ汁）', t('弱火にしてみそを溶き入れ、煮立つ直前で火を止めます。')],
    ['同（ホールドアウト・豚汁）', t('火を弱めてみそを溶き入れ、長ねぎを加えてひと煮したら火を止めます。')],
    ['同（同梱・豆腐とわかめの味噌汁）', t('火を弱めて味噌を溶き入れ、煮立たせる前に火を止める。')],
    ['油と香味野菜の香りを立てる（URL取込・ミートソース）', t('鍋にオリーブオイルとにんにくを入れて弱火にかけ、香りが立ったら玉ねぎとにんじんを加えてしんなりするまで炒めます。')],
    ['同（同梱・回鍋肉）', t('フライパンにサラダ油とにんにくを入れて中火にかけ、香りが立ったら豚肉を炒める。')],
    ['「煮詰めたたれ」は完了の連体修飾（貼り付け・煮豚）', t('食べやすい厚さに切り、煮汁を煮詰めたたれをかけていただきます。')],
    ['「ゆで汁は取っておくとよい」は助言（貼り付け・ゆで鶏）', t('鍋から取り出して薄切りにし、器に盛ります。ゆで汁はスープに使えるので取っておくとよいです。')],
  ]
  for (const [label, step] of notSplittable) {
    // ① 測る側: 分母から外す理由が付いている（理由の文面ではなく「理由が有ること」で見る）
    eq(`HA-1 N4の分母から外す: ${label}`, notSplittableReason(step) != null, true)
    eq(`HA-1 分母に入っていない: ${label}`, isMixedStep(step), false)
    // ② アプリ側: この手順から待ちが生まれない（何工程に割れても待ちの合計が0分）
    eq(`HA-2 アプリが待ちを作らない: ${label}`, classifyStep(step), 'active')
    eq(`HA-2 割らない（手作業→待ち）: ${label}`, splitMixedStep(step), undefined)
    eq(`HA-2 割らない（待ち→手作業）: ${label}`, splitWaitFirstStep(step), undefined)
    const items = buildCookTimeline([{ id: 1, title: '検査用', steps: [step] }]).items
    eq(
      `HA-2 段取りに待ちが1分も出ない: ${label}`,
      items.reduce((sum, it) => sum + it.waitMinutes, 0),
      0,
    )
  }

  // ---- 外しすぎていないことの歯止め（ここが崩れると「線を緩めた」のと同じになる）----
  // 同じ「煮立ったら火を止める」でも、**その手順の中で冷たい鍋に火をつけている**ものは
  // 沸くまでの待ちが本当にあるので分母に残す。規則の分かれ目そのもの。
  const keptInDenominator = [
    ['冷たいだし汁から沸かす（同梱・梅おろしぶっかけうどん）', t('小鍋にだし汁・しょうゆ・みりんを入れて中火にかけ、煮立ったら火を止める。')],
    ['火にかけて沸くのを待つ（URL取込・みそ汁）', t('鍋にだし汁を入れて火にかけ、煮立ったら木綿豆腐とわかめを加えます。')],
    ['火を止めたあとに本物の待ちが続く（URL取込・豚肉と大根の煮もの）', t('大根がやわらかくなったら火を止め、そのまま10分おいて味を含ませます。', 10)],
    ['冷ましながら味を含ませる（URL取込・かぼちゃの煮つけ）', t('火を止めて、そのまま冷ましながら味を含ませます。')],
    ['答え合わせが「本当にある待ち」と言っている二度揚げ（URL取込・から揚げ）', t('一度取り出して2分休ませ、油の温度を上げてもう1分揚げます。', 2)],
  ]
  for (const [label, step] of keptInDenominator) {
    eq(`HA-3 分母に残す（外しすぎない）: ${label}`, isMixedStep(step), true)
    eq(`HA-3 外す理由が付かない: ${label}`, notSplittableReason(step), null)
  }

  // 分母から外した件数は**毎回の監査の表に出す**（隠さない）。列があること自体を固定する
  {
    const scriptsDir = path.dirname(fileURLToPath(scriptFileUrl))
    const auditSource = readFileSync(path.join(scriptsDir, 'audit-cook-navi.mjs'), 'utf-8')
    eq(
      'HA-4 監査の表に「分母から外した」件数の列がある（外した数を隠さない）',
      auditSource.includes('分母から外した'),
      true,
    )
  }
}


// ============================================================================
// LG-2: 調理中モード（2026-08-26 便LG・オーナーの書き溜め）
// ============================================================================
{
  const lgRoot = path.join(path.dirname(fileURLToPath(scriptFileUrl)), '..')
  const lgOverlay = readFileSync(path.join(lgRoot, 'src/components/CookSessionOverlay.tsx'), 'utf-8')

  // ---- LG-2-a: 「タップすると全文が出ます〜」は消えている ----
  // オーナー原文「「タップすると全文が出ます〜」削除。触ればわかること。」
  eq(
    'LG-2 見出しの横の案内（sessionOthersHint）は ja.ts から消えている',
    'sessionOthersHint' in ja.cookNavi,
    false,
  )
  eq(
    'LG-2 画面もその案内を描いていない',
    lgOverlay.includes('cook-session-others-hint'),
    false,
  )

  // ---- LG-2-b: 「他の品」→「他のレシピ」 ----
  // オーナー原文「「他の品の次の手順」→「他のレシピの次の手順」」
  eq(
    'LG-2 下部の見出しは「レシピ」で呼ぶ（「品」ではない）',
    [ja.cookNavi.sessionOthersTitle.includes('レシピ'), ja.cookNavi.sessionOthersTitle.includes('品')],
    [true, false],
  )

  // ---- LG-2-c: エリア外をタップしても閉じる ----
  // オーナー原文「もう一度タップの他に、エリア外をタップでも元の大きさに戻るようにして。」
  eq(
    'LG-2 開いている枠の外を押したら閉じる仕掛けがある',
    /peekRowRef[\s\S]{0,900}pointerdown/.test(lgOverlay),
    true,
  )
  eq(
    'LG-2 掴むのは押し始めの捕捉段階（枠の中のボタンより先に効かせない）',
    lgOverlay.includes("document.addEventListener('pointerdown', onDown, true)"),
    true,
  )

  // ---- LG-2-d: レシピのメモは、細いスクロール欄をやめて窓で読む ----
  // オーナー原文「レシピのメモがスクロール付きの細いスペースにあるが、スクロールするよりは
  // タップで窓出した方が読みやすい。手順ないには「レシピのメモ」だけ表示。」
  eq(
    'LG-2 手順カードの中に高さ24vhのスクロール欄が残っていない',
    lgOverlay.includes('max-h-[24vh]'),
    false,
  )
  eq(
    'LG-2 手順カードに出すのは見出しだけの入口（押すと窓が開く）',
    [
      lgOverlay.includes('data-testid="cook-session-recipe-memo"'),
      lgOverlay.includes('setRecipeNotesOpen(true)'),
      lgOverlay.includes('ja.cookNavi.recipeNotesTitle'),
    ],
    [true, true, true],
  )
  eq(
    'LG-2 窓は他の窓と同じ作法（✕・背景・下の大きなボタンで閉じる）',
    (() => {
      const modal = readFileSync(path.join(lgRoot, 'src/components/CookRecipeNotesModal.tsx'), 'utf-8')
      return [
        modal.includes('useScrollLock'),
        modal.includes("e.key === 'Escape'"),
        modal.includes('onClick={onClose}'),
        modal.includes('data-testid="cook-session-recipe-memo-close"'),
      ]
    })(),
    [true, true, true, true],
  )
  eq('LG-2 入口の読み上げ名がある', typeof ja.cookNavi.recipeNotesOpenAria, 'string')

  // ---- LG-2-e: 収まらないときだけ改行位置を詰め直す ----
  // オーナー原文「文字数が多くてスクロールしないといけないばあい、改行位置をずらして
  // 画面に収まるようにしてください。」
  eq(
    'LG-2 はみ出しを実測してから詰め込みに切り替える（決め打ちの字数で切らない）',
    [
      lgOverlay.includes('box.scrollHeight > box.clientHeight'),
      lgOverlay.includes('packed={packStepText}'),
      lgOverlay.includes('new ResizeObserver(check)'),
    ],
    [true, true, true],
  )
  eq(
    'LG-2 手順が変わったら詰め込みは解く（前の手順の都合を引きずらない）',
    /setPackStepText\(false\)\s*\n\s*\}, \[index, fontScale\]\)/.test(lgOverlay),
    true,
  )
}

// ============================================================================
// LG-2-f: 詰め込みの行組み（logic/lineCompose.ts の packed）
//   既定の読点優先より行数が増えないこと・文節の切れ目以外で切らないことを固定する
// ============================================================================
{
  // 1文字=1幅の物差しで測る（テストは px ではなく字数で判定する＝端末差に依らない）
  const lgMeasure = (t) => [...t.replace(/​/g, '')].length
  const lgLineText = (line) => line.map((p) => p.text ?? '').join('')
  const lgCompose = (text, width, opts) =>
    composeLines([{ kind: 'text', text }], width, lgMeasure, { eps: 0, ...opts })

  // 読点優先は「残り幅に入らない句は詰め込まずに改行する」ので行が増える。
  // 詰め込みは同じ幅で行数が増えない（＝この手順が画面に収まる見込みが上がる）
  const lgSamples = [
    'なすを乱切りにして水に5分さらし、水気をふきます。フライパンに油を熱してなすを入れ、しんなりするまで3分炒めます。',
    'ボウルに酢・しょうゆ・砂糖・ごま油・鶏がらスープの素を混ぜ合わせ、春雨・きゅうり・ハムを加えてあえ、器に盛る。',
    '鍋にたっぷりの湯を沸かし、もやしを入れて1分ほどゆでる。',
    // 実測でいちばん長い同梱の手順（冷やし茶碗蒸し・83字）。390px幅の実機で10行→8行になった
    '蒸し器(なければフライパンで代用)の湯を沸かし、器を並べて入れる。ふたを少しずらすか、ふたの代わりに濡れ布巾をかけて、強火で1〜2分、その後弱火にして12分ほど蒸す。',
  ]
  for (const [i, text] of lgSamples.entries()) {
    const plain = lgCompose(text, 20)
    const packed = lgCompose(text, 20, { packed: true })
    eq(`LG-2 詰め込みは行数を増やさない（標本${i + 1}）`, packed.length <= plain.length, true)
    eq(`LG-2 詰め込みでも文字は1つも落ちない（標本${i + 1}）`, packed.map(lgLineText).join(''), text)
    eq(
      `LG-2 詰め込みでも1行が幅を超えない（標本${i + 1}）`,
      packed.every((line) => lgMeasure(lgLineText(line)) <= 20),
      true,
    )
  }
  // 少なくとも1つは実際に行が減る標本があること（何も変わらない実装になっていないか）
  eq(
    'LG-2 詰め込みで行が減る標本がある（切り替えても何も変わらない実装になっていない）',
    lgSamples.some(
      (text) => lgCompose(text, 20, { packed: true }).length < lgCompose(text, 20).length,
    ),
    true,
  )
  // 詰め込みが不利になる幅でも行は増えない（2026-08-26 便LG の実測: 幅14・標本1で
  // 素の詰め込みは6行→7行になった。両方組んで少ないほうを採る形にしてある）
  eq(
    'LG-2 幅が狭くても行数は増えない（両方組んで少ないほうを採る）',
    [14, 16, 18, 20, 24, 30].every((width) =>
      lgSamples.every(
        (text) => lgCompose(text, width, { packed: true }).length <= lgCompose(text, width).length,
      ),
    ),
    true,
  )
  // \n の強制改行は詰め込みでも効く
  eq(
    'LG-2 詰め込みでも改行（\\n）は行を分ける',
    lgCompose('あいうえお\nかきくけこ', 40, { packed: true }).length,
    2,
  )
}
