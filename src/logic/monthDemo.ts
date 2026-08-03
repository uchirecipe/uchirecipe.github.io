/**
 * 月間画面のサンプルデモ用のデータ（2026-08-02 便DC・オーナー採用:
 * 「記録5件でも写真がないと月間の魅力が伝わらない。デモがあればお試しを使い切った人も確認できる」）。
 *
 * 考え方:
 *  - 見せるのは**本物の月タブそのもの**（MealPlanPage に demo を渡して同じ画面を描く）。
 *    デモ専用の作り物の画面は用意しない＝実物と食い違わない。
 *  - データは**この場で組み立ててメモリに置くだけ**で、IndexedDB には一切書かない。
 *    端末に入っている本人のレシピ・記録・献立・設定・解錠状態のどれにも触れない。
 *  - 料理は同梱の基本レシピ（db/starters.ts の starterDefs）をそのまま引く。
 *    栄養・食費の数字は本物の計算エンジン（logic/nutrition.ts・logic/priceEstimate.ts）が
 *    このレシピの材料から計算する＝**手書きの数値は1つも無い**。
 *  - 見本の月は固定（2026年5月・その月の「今日」は5/24）。実時間で動かすと、
 *    月初に開いた人だけ記録がほとんど無い月を見ることになるため。
 *
 * 写真は public/demo/*.webp（フリー素材サイト「ぱくたそ」の写真。出所・取得方法・
 * 利用規約の確認は scripts/build-demo-photos.mjs 冒頭）。
 */
import { starterDefs } from '../db/starters'
import { PRICE_DEFAULTS } from '../data/priceDefaults'
import { buildSearchWords } from './kana'
import { defaultSettings } from '../db/types'
import type {
  CookedLog,
  DayNote,
  MealPlanEntry,
  MealPurpose,
  PriceEntry,
  Recipe,
  Settings,
} from '../db/types'

/** 見本の月の「今日」。この日より前＝作った記録、この日以降＝登録した献立で画面が組まれる */
export const DEMO_TODAY = '2026-05-24'

/** 記録に付ける写真（public/demo/<キー>.webp）。キーは scripts/build-demo-photos.mjs と対応する */
export const DEMO_PHOTO_KEYS = [
  'curry',
  'hamburg',
  'nikujaga',
  'salmon',
  'mabo',
  'napolitan',
  'tonjiru',
  'karaage',
  'potatosalad',
  'oyakodon',
] as const
export type DemoPhotoKey = (typeof DEMO_PHOTO_KEYS)[number]

/** 作った記録1件ぶんの見本（料理名・作った人数・写真） */
interface DemoLogDef {
  title: string
  servings: number
  photo?: DemoPhotoKey
}

/**
 * 過ぎた日の「作った記録」。写真は各日の先頭の記録に付ける
 * （月カレンダーのセルは、その日の先頭の記録の写真を代表として敷くため）。
 * 記録の無い日・メモだけの日をあえて混ぜている（毎日きっちり埋まった月は現実の使い方と違うため）。
 */
const DEMO_COOKED: Record<string, DemoLogDef[]> = {
  '2026-05-01': [
    { title: '鶏の唐揚げ', servings: 3, photo: 'karaage' },
    { title: 'キャベツの塩昆布あえ', servings: 3 },
  ],
  '2026-05-02': [{ title: 'カレーライス', servings: 4, photo: 'curry' }],
  '2026-05-03': [
    { title: 'ナポリタン', servings: 2, photo: 'napolitan' },
    { title: 'コールスロー', servings: 3 },
  ],
  '2026-05-05': [
    { title: 'ハンバーグ', servings: 3, photo: 'hamburg' },
    { title: 'コンソメ野菜スープ', servings: 3 },
  ],
  '2026-05-06': [
    { title: '麻婆豆腐', servings: 3, photo: 'mabo' },
    { title: '中華風卵スープ', servings: 3 },
  ],
  '2026-05-07': [
    { title: '鮭の塩焼き', servings: 2, photo: 'salmon' },
    { title: 'ほうれん草のおひたし', servings: 2 },
    { title: '豆腐とわかめの味噌汁', servings: 2 },
  ],
  '2026-05-08': [
    { title: '豚の生姜焼き', servings: 3 },
    { title: 'もやしのナムル', servings: 3 },
  ],
  '2026-05-09': [
    { title: '肉じゃが', servings: 3, photo: 'nikujaga' },
    { title: 'だし巻き卵', servings: 3 },
  ],
  '2026-05-10': [{ title: '親子丼', servings: 3, photo: 'oyakodon' }],
  '2026-05-12': [
    { title: '豚汁', servings: 4, photo: 'tonjiru' },
    { title: '野菜炒め', servings: 3 },
  ],
  '2026-05-13': [
    { title: 'クリームシチュー', servings: 4 },
    { title: 'コールスロー', servings: 3 },
  ],
  '2026-05-14': [
    { title: 'さばの味噌煮', servings: 2 },
    { title: 'きんぴらごぼう', servings: 3 },
  ],
  '2026-05-15': [
    { title: '鶏の照り焼き', servings: 3 },
    { title: 'ひじきの煮物', servings: 3 },
  ],
  '2026-05-16': [
    { title: 'ポテトサラダ', servings: 3, photo: 'potatosalad' },
    { title: '冷しゃぶサラダ', servings: 3 },
  ],
  '2026-05-17': [
    { title: 'オムライス', servings: 3 },
    { title: 'コンソメ野菜スープ', servings: 3 },
  ],
  '2026-05-19': [
    { title: '牛丼', servings: 3 },
    { title: 'きゅうりとわかめの酢の物', servings: 3 },
  ],
  '2026-05-20': [
    { title: '鶏むね肉のオイスター炒め', servings: 3 },
    { title: '白菜とにんじんの中華とろみ煮', servings: 3 },
  ],
  '2026-05-22': [
    { title: '回鍋肉(ホイコーロー)', servings: 3 },
    { title: '中華風卵スープ', servings: 3 },
  ],
  '2026-05-23': [
    { title: '寄せ鍋', servings: 4 },
    { title: '漬けるだけ味玉', servings: 3 },
  ],
}

/** 今日から先の「登録した献立」1日ぶん（夕食の主菜・副菜と、目的から組んだ日の目的） */
interface DemoPlanDef {
  main: string
  sides?: string[]
  purpose?: MealPurpose
}

const DEMO_PLAN: Record<string, DemoPlanDef> = {
  '2026-05-24': { main: '鶏の照り焼き', sides: ['ブロッコリーとにんじんのハーブマリネ'] },
  '2026-05-25': { main: '麻婆豆腐', sides: ['もやしのナムル'] },
  '2026-05-26': { main: '鮭のホイル焼き', sides: ['ひじきの煮物'] },
  '2026-05-27': {
    main: '豚の生姜焼き',
    sides: ['キャベツの塩昆布あえ'],
    purpose: 'protein',
  },
  '2026-05-28': {
    main: 'レンジ蒸し鶏（自家製サラダチキン）',
    sides: ['春雨サラダ'],
    purpose: 'protein',
  },
  // 一品で食事が完結する料理の日は副菜を入れない（自動提案と同じ扱い）
  '2026-05-29': { main: 'カレーライス' },
  '2026-05-30': { main: '寄せ鍋' },
  '2026-05-31': { main: 'さばの味噌煮', sides: ['ほうれん草のおひたし', 'なめこと豆腐の味噌汁'] },
}

/** 日付メモ。献立を入れていない日に「なぜ入れていないか」が残る使い方を見せる */
const DEMO_DAY_NOTES: Record<string, string> = {
  '2026-05-04': '実家に行く',
  '2026-05-11': '外食',
  '2026-05-26': 'お弁当いる',
}

/** デモ1回ぶんのデータ一式（すべてメモリ上の値。保存はしない） */
export interface MonthDemoData {
  /** 見本の月の「今日」 */
  today: string
  recipes: Recipe[]
  entries: MealPlanEntry[]
  dayNotes: DayNote[]
  priceEntries: PriceEntry[]
  /** デモ内だけの設定（Pro解錠済み扱い・カレンダーの表示切替もここに持つ） */
  settings: Settings
}

/**
 * デモで使う料理名の一覧（重複なし）。基本レシピに無い名前が混ざっていないかは
 * scripts/test-logic.mjs で検査する（レシピ名を変えたらここも直す、を検知できるようにするため）。
 */
export function demoRecipeTitles(): string[] {
  const titles = new Set<string>()
  for (const logs of Object.values(DEMO_COOKED)) for (const l of logs) titles.add(l.title)
  for (const plan of Object.values(DEMO_PLAN)) {
    titles.add(plan.main)
    for (const s of plan.sides ?? []) titles.add(s)
  }
  return [...titles]
}

/**
 * サンプル1か月分を組み立てる。
 * photos は public/demo/*.webp を読み込んだ Blob（読み込めなかった分は写真なしで進み、
 * 料理カテゴリのアイコンが出る＝アプリの通常の見え方に落ちるだけ）。
 */
export function buildMonthDemoData(photos: ReadonlyMap<string, Blob> = new Map()): MonthDemoData {
  const now = Date.parse(`${DEMO_TODAY}T12:00:00`)
  const defByTitle = new Map(starterDefs.map((d) => [d.title, d] as const))

  // 使う料理だけを Recipe の形にする（idは連番。メモリ上だけの番号で、端末のidとは無関係）
  const recipes: Recipe[] = []
  const idByTitle = new Map<string, number>()
  for (const title of demoRecipeTitles()) {
    const def = defByTitle.get(title)
    if (!def) continue
    const id = recipes.length + 1
    idByTitle.set(title, id)
    recipes.push({
      ...def,
      id,
      isFavorite: false,
      cookedLogs: [],
      isStarter: true,
      searchWords: buildSearchWords(def.title, def.ingredients, def.tags),
      createdAt: now,
      updatedAt: now,
    })
  }
  const recipeById = new Map(recipes.map((r) => [r.id as number, r] as const))

  // 作った記録はレシピに埋め込む（本物と同じ持ち方）
  for (const [date, logs] of Object.entries(DEMO_COOKED)) {
    for (const def of logs) {
      const id = idByTitle.get(def.title)
      const recipe = id != null ? recipeById.get(id) : undefined
      if (!recipe) continue
      const log: CookedLog = { date, servings: def.servings }
      const photo = def.photo ? photos.get(def.photo) : undefined
      if (photo) log.photo = photo
      recipe.cookedLogs.push(log)
    }
  }

  // 登録した献立（今日から先）。目的を指定して組んだ日は auto+purpose を残す
  const entries: MealPlanEntry[] = []
  for (const [date, plan] of Object.entries(DEMO_PLAN)) {
    const push = (title: string, role: 'main' | 'side') => {
      const recipeId = idByTitle.get(title)
      if (recipeId == null) return
      const entry: MealPlanEntry = { id: entries.length + 1, date, slot: 'dinner', recipeId, role }
      if (plan.purpose) {
        entry.auto = true
        entry.purpose = plan.purpose
      }
      entries.push(entry)
    }
    push(plan.main, 'main')
    for (const side of plan.sides ?? []) push(side, 'side')
  }

  const dayNotes: DayNote[] = Object.entries(DEMO_DAY_NOTES).map(([date, text]) => ({
    date,
    text,
    updatedAt: now,
  }))

  // 食費は「食材と価格」の目安価格マスタの初期値で計算する（本人が書き換えた価格は使わない＝
  // 誰が見ても同じ見本になる）。計算そのものは本物の priceEstimate.ts が行う
  const priceEntries: PriceEntry[] = PRICE_DEFAULTS.map((item, index) => ({
    ...item,
    id: index + 1,
    updatedAt: now,
    isDefault: true,
    defaultPricePerUnit: item.pricePerUnit,
    defaultUnit: item.unit,
  }))

  const settings: Settings = {
    ...defaultSettings,
    // デモの中だけ月間献立と栄養8項目を開ける（端末に保存している本物の解錠状態は読まないし書かない）
    proCode: 'DEMO',
    monthCellMode: 'photo',
    visibleMealSlots: ['dinner'],
  }

  return { today: DEMO_TODAY, recipes, entries, dayNotes, priceEntries, settings }
}
