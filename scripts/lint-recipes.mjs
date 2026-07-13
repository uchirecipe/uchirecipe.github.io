// レシピ原稿の機械チェック(記法ルールR1〜R7・カタログ全体の整合性)。
// 人間・QAが見るべきもの(味の妥当性・D-④の解釈)は対象外、機械で潰せるものだけを見る。
// 実行: npx tsx scripts/lint-recipes.mjs
// 対象: starters.ts + src/sets/*.ts + (存在すれば)public/sets/data/review.json(docs/12原稿のレビュー用コピー)
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { readdirSync, existsSync, readFileSync } from 'node:fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// タグのホワイトリスト(2026-07-06時点の実使用タグから作成。増やす場合はここに追記する)
const TAG_WHITELIST = new Set([
  '和食', '洋食', '中華', 'おやつ',
  '高たんぱく', '作り置き', 'お弁当', '定番',
  '汁物', '麺', 'ご飯もの', 'サラダ', '煮物', '鍋', '魚',
  '冷凍ストック', // 2026-07-13追加: 第16弾「下味冷凍」の命名変更で使う新タグ(今回は土台のみ)
])

const WEIGHT_VOLUME_UNITS = new Set(['g', 'ml', 'cc'])

/** @typedef {{name:string, amount:string, unit:string, memo?:string, seasoningGroup?:number}} Ingredient */
/** @typedef {{text:string, minutes?:number, memo?:string}} Step */
/** @typedef {{title:string, servings:number, cookMinutes?:number, tags:string[], ingredients:Ingredient[], steps:Step[], quickSteps?:Step[], memo?:string}} RecipeLike */

/** @type {{source: string, recipe: RecipeLike}[]} */
const entries = []

// 基本レシピ21品
const startersMod = await import('../src/db/starters.ts')
for (const r of startersMod.starterDefs) {
  entries.push({ source: 'starters.ts', recipe: r })
}

// 用語タップ辞書(2026-07-11導入)。収載語は本文の括弧説明を持たなくても「説明済み」とみなす(ルール12で使用)。
const { COOKING_TERMS } = await import('../src/data/cookingTerms.ts')
const DICTIONARY_TERM_STRINGS = COOKING_TERMS.flatMap((t) => [t.term, ...(t.aliases ?? [])])

// 配布セット(src/sets/*.ts を全部読む。新しいセットを追加してもここは自動で拾う)
const setsDir = path.join(__dirname, '..', 'src', 'sets')
for (const file of readdirSync(setsDir).sort()) {
  if (!file.endsWith('.ts')) continue
  const mod = await import(`../src/sets/${file}`)
  for (const r of mod.recipes) {
    entries.push({ source: `sets/${file}`, recipe: r })
  }
}

// レビュー用コピー(原稿から生成される未承認レシピ。あればそれも同じ基準で見る)
for (const [reviewFileName, reviewLabel] of [
  ['review.json', 'review.json(docs/12原稿)'],
  ['review8.json', 'review8.json(docs/18原稿)'],
  ['review2.json', 'review2.json(docs/19原稿)'],
  ['review16.json', 'review16.json(docs/21原稿)'],
]) {
  const reviewPath = path.join(__dirname, '..', 'public', 'sets', 'data', reviewFileName)
  if (existsSync(reviewPath)) {
    const reviewFile = JSON.parse(readFileSync(reviewPath, 'utf-8'))
    for (const r of reviewFile.recipes) {
      entries.push({ source: reviewLabel, recipe: r })
    }
  }
}

const findings = []
const add = (severity, rule, source, title, detail) => {
  findings.push({ severity, rule, source, title, detail })
}

// --- 1. 混合分数の禁止(「1と1/2」のような表記) ---
const mixedFractionRe = /\d+\s*と\s*\d+\s*\/\s*\d+/
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients) {
    if (mixedFractionRe.test(ing.amount)) {
      add('高', '混合分数', source, recipe.title, `材料「${ing.name}」の分量「${ing.amount}」が混合分数`)
    }
  }
  for (const st of [...recipe.steps, ...(recipe.quickSteps ?? [])]) {
    if (mixedFractionRe.test(st.text)) {
      add('高', '混合分数', source, recipe.title, `手順文に混合分数表記の疑い: 「${st.text}」`)
    }
  }
}

// --- 2. タグのホワイトリスト外 ---
for (const { source, recipe } of entries) {
  for (const tag of recipe.tags) {
    if (!TAG_WHITELIST.has(tag)) {
      add('中', 'タグ逸脱', source, recipe.title, `ホワイトリストに無いタグ「${tag}」`)
    }
  }
}

// --- 3. 料理名の全カタログ重複 ---
const titleMap = new Map()
for (const { source, recipe } of entries) {
  const key = recipe.title
  if (!titleMap.has(key)) titleMap.set(key, [])
  titleMap.get(key).push(source)
}
for (const [title, sources] of titleMap) {
  if (sources.length > 1) {
    add('高', '料理名重複', sources.join(' / '), title, `「${title}」がカタログ内に${sources.length}件`)
  }
}

// --- 4. cookMinutesが5の倍数でない ---
for (const { source, recipe } of entries) {
  if (recipe.cookMinutes !== undefined && recipe.cookMinutes % 5 !== 0) {
    add('低', 'cookMinutes丸め', source, recipe.title, `cookMinutes=${recipe.cookMinutes}が5の倍数でない`)
  }
}

// --- 5. g/ml/cc表記が1未満(数値化されている場合のみ。「少々」等の非数値はスケール対象外なので除外) ---
const numericAmountRe = /^\d+(\.\d+)?$/
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients) {
    if (WEIGHT_VOLUME_UNITS.has(ing.unit) && numericAmountRe.test(ing.amount)) {
      const value = Number.parseFloat(ing.amount)
      if (value > 0 && value < 1) {
        add(
          '中',
          'g表記1g未満',
          source,
          recipe.title,
          `材料「${ing.name}」が${ing.amount}${ing.unit}(落とし穴3: 最小値フロアで丸め後の表示が意図と食い違う恐れ)`,
        )
      }
    }
  }
}

// --- 6. unit欄に数字が紛れている(本来グラム目安等はmemoに書くべきものが単位欄に入っている実バグパターン) ---
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients) {
    if (ing.unit && /\d/.test(ing.unit)) {
      add('高', '単位欄に数値', source, recipe.title, `材料「${ing.name}」のunit「${ing.unit}」に数字が含まれる`)
    }
  }
}

// --- 7. 半角/全角括弧の不整合(食材名の短いqualifierは半角、memo文中の説明は全角、が既存の慣習) ---
// memo文中で開き括弧と閉じ括弧の半角/全角が食い違っているものだけを機械的に検出する(誤検知を避けるため、
// 「開始が半角なのに終わりが全角」「開始が全角なのに終わりが半角」の対だけを見る)
const mismatchedParenRe = /\(([^()（）]*)）|（([^()（）]*)\)/
function checkParens(source, title, field, text) {
  if (!text) return
  if (mismatchedParenRe.test(text)) {
    add('中', '括弧の半角全角不整合', source, title, `${field}: 「${text}」`)
  }
}
for (const { source, recipe } of entries) {
  checkParens(source, recipe.title, 'レシピmemo', recipe.memo)
  for (const ing of recipe.ingredients) checkParens(source, recipe.title, `材料「${ing.name}」memo`, ing.memo)
  for (const st of [...recipe.steps, ...(recipe.quickSteps ?? [])]) checkParens(source, recipe.title, '手順memo', st.memo)
}

// --- 8. seasoningGroupの単独使用(1つの色に1材料しか居ない=合わせ調味料の意味を成さない) ---
for (const { source, recipe } of entries) {
  const groupCount = new Map()
  for (const ing of recipe.ingredients) {
    if (ing.seasoningGroup) {
      groupCount.set(ing.seasoningGroup, (groupCount.get(ing.seasoningGroup) ?? 0) + 1)
    }
  }
  for (const [group, count] of groupCount) {
    if (count < 2) {
      add('高', 'seasoningGroup単独', source, recipe.title, `グループ${group}の材料が${count}件しかない(2件以上でないと色分けの意味が無い)`)
    }
  }
}

// --- 9. 分量・単位欄の全角数字(scaleAmountは正規化するが、原稿は半角が正) ---
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients) {
    if (/[０-９]/.test(ing.amount) || /[０-９]/.test(ing.unit)) {
      add('高', '全角数字', source, recipe.title, `材料「${ing.name}」の分量/単位に全角数字: 「${ing.amount}${ing.unit}」`)
    }
  }
}

// --- 9b. 分量欄への単位語の混入(「大さじ1」形式は数値と単位が分離されずscaleAmountが効かない・2026-07-11第8弾起草で実発生) ---
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients) {
    if (/(大さじ|小さじ|カップ)/.test(ing.amount)) {
      add('高', '分量欄に単位語', source, recipe.title, `材料「${ing.name}」の分量欄に単位語が混入: 「${ing.amount}」(「1 大さじ」の分離形式にすること。人数変更のスケールが効かなくなる)`)
    }
  }
}

// --- 9c. 手順文の「調味料」まとめ書き(R3: 名前を列挙する。用語説明の全角括弧内は対象外・2026-07-11オーナー指摘で統一) ---
for (const { source, recipe } of entries) {
  for (const [idx, step] of (recipe.steps ?? []).entries()) {
    const outside = (step.text ?? '').replace(/（[^）]*）/g, '')
    if (/調味料/.test(outside)) {
      add('中', '調味料まとめ書き', source, recipe.title, `手順${idx + 1}が「調味料」とまとめ書き(名前を列挙すること): 「${step.text}」`)
    }
  }
}

// --- 9d. 手順文の文末は「。」で終える(2026-07-11オーナー指示で全カタログ統一) ---
for (const { source, recipe } of entries) {
  for (const [idx, step] of (recipe.steps ?? []).entries()) {
    const text = (step.text ?? '').trim()
    if (text && !/[。！？…]$/.test(text)) {
      add('中', '文末の句点', source, recipe.title, `手順${idx + 1}の文末に「。」が無い: 「${text.slice(-20)}」`)
    }
  }
  for (const [idx, step] of (recipe.quickSteps ?? []).entries()) {
    const text = (step.text ?? '').trim()
    if (text && !/[。！？…]$/.test(text)) {
      add('中', '文末の句点', source, recipe.title, `時短手順${idx + 1}の文末に「。」が無い: 「${text.slice(-20)}」`)
    }
  }
}

// --- 9e. こしょう系の「少々」は目安memoか(お好みで)を必ず添える(2026-07-11オーナー指示) ---
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients ?? []) {
    if (/こしょう/.test(ing.name) && /少々/.test(ing.amount ?? '') && !ing.memo && !/お好みで/.test(ing.name) && !/お好みで/.test(ing.amount ?? '')) {
      add('中', 'こしょう少々の目安欠落', source, recipe.title, `「${ing.name} 少々」に目安memoも(お好みで)も無い`)
    }
  }
}

// --- 9f. こしょう単独へ塩用グラム目安を転用しない(2026-07-12・第16弾QAで発見。こしょうの目安は「2〜3ふり」) ---
for (const { source, recipe } of entries) {
  for (const ing of recipe.ingredients ?? []) {
    if (/こしょう/.test(ing.name) && !/塩こしょう/.test(ing.name) && /少々/.test(ing.amount ?? '') && /\d+(\.\d+)?\s*g/.test(ing.memo ?? '')) {
      add('中', 'こしょうへの塩用グラム目安の転用', source, recipe.title, `「${ing.name}」のmemoにグラム目安(${ing.memo})。こしょうは「2〜3ふり」で書く`)
    }
  }
}

// --- 10. 「器に盛る」だけの単独手順(添え物・盛り方の説明が無ければ前の手順に統合する方針・2026-07-07ユーザー決定) ---
for (const { source, recipe } of entries) {
  for (const st of recipe.steps) {
    if (st.text.trim() === '器に盛る' && !st.memo) {
      add('中', '器に盛る単独手順', source, recipe.title, '説明なしの「器に盛る」だけで手順を1つ使っている(前の手順に統合する)')
    }
  }
}

// --- 11. お好みで使う食材が材料欄に無い(memo/手順にだけ書くと買い物段階で気づけない・2026-07-08ユーザー発見) ---
// 例外: 挙げた食材のどれかが材料欄に既にあれば意図的な運用(オムライスの仕上げケチャップ等)とみなす
const optionalMentionRe = /お好みで([^。]{1,30}?)を?(?:添え|かけ|振|ふっ|のせ|散ら)/g
for (const { source, recipe } of entries) {
  const ingredientNames = recipe.ingredients.map((i) => i.name)
  const textsToCheck = [recipe.memo ?? '', ...recipe.steps.map((s) => s.text)]
  for (const text of textsToCheck) {
    for (const m of text.matchAll(optionalMentionRe)) {
      const items = m[1].split(/[やと、・]/).map((s) => s.replace(/[()（）\s]/g, '').trim()).filter(Boolean)
      const anyListed = items.some((item) =>
        ingredientNames.some((n) => n.includes(item) || item.includes(n.replace(/[（(].*/, ''))),
      )
      if (!anyListed && items.length > 0) {
        add('中', 'お好みで食材の材料欄漏れ', source, recipe.title, `「お好みで${m[1]}〜」が材料欄に無い(買い物・下ごしらえで気づけない)`)
      }
    }
  }
}

// --- 12. 用語説明の欠落(初心者が知らない用語は、そのレシピ内で意味を説明する・落とし穴6) ---
// 用語 → そのレシピのどこかに含まれるべき説明の断片
const TERM_EXPLANATIONS = [
  [/小口切り/, /端から薄/, '小口切り（端から薄い輪切りにすること）'],
  [/炒め煮/, /炒めてから調味料/, '炒め煮（炒めてから調味料を加えて煮詰めること）'],
  [/落と?し(ぶた|蓋)/, /直接のせる/, '落としぶた（鍋の中身に直接のせる小さめのふたやアルミホイル）'],
  [/含め煮/, /煮物の技法|しみ込ませる煮物/, '含め煮とは〜煮物の技法(レシピmemo)'],
  [/土佐酢/, /合わせ酢/, '土佐酢とは〜合わせ酢(レシピmemo)'],
  [/ハリハリ漬け/, /名前の由来/, 'ハリハリ漬けとは〜(レシピmemo)'],
  [/アク|あくを取/, /泡|えぐみ/, 'アク（煮汁に浮く泡／切り口から出るえぐみ成分）'],
  // 2026-07-08 深層QAで追加(初心者の作業が止まる稀出用語。せん切り・みじん切り・粗熱等の頻出語は
  // 全レシピ強制にすると本文が膨らむため辞書に入れず、原稿執筆時の層2チェックで個別判断する)
  [/乱切り/, /向きを変えながら|一口大の斜め/, '乱切り（向きを変えながら一口大の斜め切りにすること）'],
  [/油抜き/, /余分な油/, '油抜き（表面の余分な油を熱湯で洗い流すこと）'],
  [/下茹で/, /軽く茹で/, '下茹で（軽く茹でて水分やアクを抜くこと）'],
  [/乾煎り/, /油をひかずに/, '乾煎り（油をひかずに炒って水分を飛ばすこと）'],
  [/炒り煮/, /汁気を飛ばしながら|汁気がなくなるまで煮ること/, '炒り煮（汁気を飛ばしながら煮ること）'],
  [/俵形/, /筒のような形/, '俵形（丸い筒のような形）'],
  [/石づき/, /根元のかたい部分/, '石づき（根元のかたい部分）'],
  // 2026-07-09 基本21品の深層QAで追加(用語説明のmemo追記と同時に辞書化)
  [/くし形/, /放射状に等分/, 'くし形（縦半分に切った玉ねぎを切り口から放射状に等分する切り方）'],
  [/いちょう切り/, /十字に4等分/, 'いちょう切り（輪切りを十字に4等分した扇形）'],
  [/ささがき/, /鉛筆を削るように/, 'ささがき（鉛筆を削るようにごぼうを回しながら薄くそぐ切り方）'],
  [/粉ふき/, /表面の水気を飛ばす/, '粉ふき（湯を切って鍋を揺すり、表面の水気を飛ばすこと）'],
  [/乳化/, /白っぽくとろりと/, '乳化（油とゆで汁が混ざって白っぽくとろりとすること）'],
]
for (const [termRe] of TERM_EXPLANATIONS) {
  // 用語タップ辞書(cookingTerms.ts)に収載済みの語は、本文の括弧説明が無くても
  // タップで説明を確認できるため「説明済み」とみなし、このルールでは検出しない。
  // 辞書に無い語だけ従来どおり本文中の説明有無を機械チェックする。
  termRe.coveredByDictionary = DICTIONARY_TERM_STRINGS.some((t) => termRe.test(t))
}
for (const { source, recipe } of entries) {
  const usageText = [recipe.title, ...recipe.steps.map((s) => s.text)].join('\n')
  const allText = [
    recipe.title,
    recipe.memo ?? '',
    ...recipe.steps.flatMap((s) => [s.text, s.memo ?? '']),
    ...(recipe.quickSteps ?? []).flatMap((s) => [s.text, s.memo ?? '']),
    ...recipe.ingredients.flatMap((i) => [i.name, i.memo ?? '']),
  ].join('\n')
  for (const [termRe, explainRe, example] of TERM_EXPLANATIONS) {
    if (termRe.coveredByDictionary) continue
    if (termRe.test(usageText) && !explainRe.test(allText)) {
      add('中', '用語説明の欠落', source, recipe.title, `「${usageText.match(termRe)[0]}」の説明が同じレシピ内に無い(例: ${example})`)
    }
  }
}

// --- 13. 「袋の表示時間」とアプリ内固定タイマーの矛盾(袋に従えと言いながら固定分数のタイマーを付けている) ---
// memo側も「袋の表示時間を目安に」の言い回しだけ検査する(「袋に表示があればそちらを優先」のような
// 優先順位を明示した書き方は矛盾ではないので対象外・2026-07-08深層QAの学び)
for (const { source, recipe } of entries) {
  for (const st of [...recipe.steps, ...(recipe.quickSteps ?? [])]) {
    if (st.minutes === undefined) continue
    if (/袋の表示時間を目安に/.test(st.text) || /袋の表示時間を目安に/.test(st.memo ?? '')) {
      add('中', '袋表示とタイマー矛盾', source, recipe.title, `「袋の表示時間を目安に」なのに固定タイマー(${st.minutes}分)が付いている: 「${st.text}」`)
    }
  }
}

// --- 15. 「お好みで」材料が手順に登場しない(材料欄に移しただけだと使うタイミングが分からない・2026-07-08深層QA) ---
// 手順memoでの言及も可(きんぴらごぼうの赤唐辛子・鮭フレークの塩のように、memoで使い方を示す様式があるため)
for (const { source, recipe } of entries) {
  const allStepText = [...recipe.steps, ...(recipe.quickSteps ?? [])]
    .map((s) => `${s.text}\n${s.memo ?? ''}`)
    .join('\n')
  for (const ing of recipe.ingredients) {
    const optional = /お好みで/.test(`${ing.amount}${ing.unit}`)
    if (!optional) continue
    // 名前から括弧の注記を外した主要部で照合(「すだち(またはレモン)」→「すだち」)
    const baseName = ing.name.replace(/[（(].*$/, '').trim()
    if (baseName && !allStepText.includes(baseName)) {
      add('中', 'お好みで材料の使いどころ欠落', source, recipe.title, `「${ing.name}」が手順のどこにも登場しない(いつ使うか分からない)`)
    }
  }
}

// --- 14. グリル使用レシピで両面焼き/片面焼きの機種差に触れていない(2026-07-08ユーザー発見) ---
for (const { source, recipe } of entries) {
  const allStepText = recipe.steps.map((s) => `${s.text} ${s.memo ?? ''}`).join('\n')
  if (/グリル/.test(allStepText) && /裏返/.test(allStepText) && !/両面焼き/.test(allStepText)) {
    add('低', 'グリル機種差', source, recipe.title, 'グリルで裏返す手順があるが、両面焼きグリル(裏返し不要)への言及が無い')
  }
}

// --- 16. レンジ加熱stepのmemoに、用語辞書「電子レンジ」へ集約済みの汎用知識(増量時の加熱時間追加・
// 加熱ムラ対策・複数回に分ける案内)が再出現していないか(2026-07-13オーナー方針。再発防止のPDCA)。
// 誤検知を避けるため、doneness文(「〜ずつ追加加熱すること」等)単体では拾わず、量に触れる語との
// 組み合わせでのみ判定する。
// 対象はstarters.ts + sets/*.ts(このアプリが実際に配布する確定カタログ)のみ。review*.json は
// 別パイプライン(レシピセット制作)で執筆中の未承認原稿で、このタスクの編集範囲外のため対象外にする
// (rule12のDICTIONARY_TERM_STRINGS判定と違い、こちらは原稿の書き方そのものを縛る新ルールのため)。
const CONFIRMED_CATALOG_RE = /^(starters\.ts|sets\/)/
const RANGE_STEP_RE = /(電子レンジ|レンジ|\d+W[)）]?で)/
const QUANTITY_TRIGGER_RE = /(量を増やす|量が多い|本数を増やす|人数が多い|以上作る|以上は|を超える場合)/
const ADD_TIME_RE = /(ずつ(追加|加熱)|分を目安に追加)/
const UNEVEN_RE = /(位置を入れ替え|向きを変え)/
const SPLIT_BATCH_RE = /分けて加熱/
for (const { source, recipe } of entries) {
  if (!CONFIRMED_CATALOG_RE.test(source)) continue
  for (const st of [...(recipe.steps ?? []), ...(recipe.quickSteps ?? [])]) {
    if (!st.memo || !RANGE_STEP_RE.test(st.text ?? '')) continue
    if (QUANTITY_TRIGGER_RE.test(st.memo) && ADD_TIME_RE.test(st.memo)) {
      add('低', 'レンジ加熱memoに増量時間追加の定型が再出現', source, recipe.title, `用語辞書「電子レンジ」に集約済みのはずの定型が手順memoに再出現: 「${st.memo}」`)
    }
    if (UNEVEN_RE.test(st.memo)) {
      add('低', 'レンジ加熱memoに加熱ムラ対策の定型が再出現', source, recipe.title, `用語辞書「電子レンジ」に集約済みのはずの定型が手順memoに再出現: 「${st.memo}」`)
    }
    if (SPLIT_BATCH_RE.test(st.memo)) {
      add('低', 'レンジ加熱memoに分割加熱案内の定型が再出現', source, recipe.title, `用語辞書「電子レンジ」に集約済みのはずの定型が手順memoに再出現: 「${st.memo}」`)
    }
  }
}

// --- 出力 ---
const bySeverity = { 高: [], 中: [], 低: [] }
for (const f of findings) bySeverity[f.severity].push(f)

console.log(`チェック対象: ${entries.length}品`)
console.log(`指摘件数: 高${bySeverity['高'].length} / 中${bySeverity['中'].length} / 低${bySeverity['低'].length}`)
console.log()
for (const sev of ['高', '中', '低']) {
  for (const f of bySeverity[sev]) {
    console.log(`[${f.severity}][${f.rule}] ${f.source} 「${f.title}」: ${f.detail}`)
  }
}
if (findings.length === 0) {
  console.log('指摘なし。')
}

process.exit(findings.some((f) => f.severity === '高') ? 1 : 0)
